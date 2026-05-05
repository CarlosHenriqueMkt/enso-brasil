# Phase 4: First Two Adapters (CEMADEN + INMET) — Specification

**Created:** 2026-05-05
**Ambiguity score:** 0.12 (gate: ≤ 0.20)
**Requirements:** 8 locked

## Goal

Replace the stub adapter with two real source adapters — CEMADEN (Painel de Alertas backing endpoint) and INMET (Alert-AS CAP XML) — so that every cron tick produces an `/api/states` snapshot built from genuine Brazilian official-source data, with the stub adapter removed from the registry in the same atomic cutover commit.

## Background

Phase 2 shipped the full ingest → normalize → store → snapshot → cache → serve pipeline using a single `stubAdapter` (`src/lib/sources/stub.ts`) that reads `tests/fixtures/sources/stub-default.json`. Phase 3 shipped the pure risk engine (`src/lib/risk/calculate.ts`) plus per-source severity vocabulary maps for CEMADEN and INMET (`src/lib/risk/sources/cemaden.ts`, `inmet.ts`). The orchestrator (`/api/ingest`) iterates `sources[]` from `src/lib/sources/registry.ts` via `Promise.allSettled` and never imports concrete adapter modules — registry isolation is enforced in CI by `dependency-cruiser`. Today the registry contains only `[stubAdapter]`. There are zero real-source adapters, zero golden-file fixtures captured from real responses, and zero contract tests guarding against upstream schema drift.

## Requirements

1. **CEMADEN adapter**: Fetches alerts from CEMADEN's Painel de Alertas backing endpoint and normalizes to `Alert[]`.
   - Current: No CEMADEN adapter exists. The exact endpoint URL, auth requirements, and response shape are unknown — research deliverable owns endpoint discovery.
   - Target: `src/lib/sources/cemaden.ts` exports a `SourceAdapter` with `key: "cemaden"` that fetches via the shared ofetch wrapper (timeout/retry inherited from P2), zod-validates the response, normalizes severity terms via `src/lib/risk/sources/cemaden.ts`, converts timestamps to ISO-8601 UTC (`Z` suffix), and returns `Alert[]`.
   - Acceptance: Adapter unit test feeds a captured fixture and asserts the produced `Alert[]` matches a snapshot; running against a mocked HTTP layer returning the fixture produces zero zod errors.

2. **INMET adapter**: Parses Alert-AS CAP XML responses and normalizes to `Alert[]`.
   - Current: No INMET adapter exists. P3 shipped only the severity vocabulary table.
   - Target: `src/lib/sources/inmet.ts` exports a `SourceAdapter` with `key: "inmet"` that fetches the Alert-AS CAP XML feed via the shared ofetch wrapper, parses XML using `fast-xml-parser`, selects the `<info xml:lang="pt-BR">` block (failing loudly with a logged error and propagated reject if absent), converts CAP timestamps to ISO-8601 UTC, and returns `Alert[]` with correct attribution + `sourceUrl`.
   - Acceptance: Adapter unit test feeds a captured CAP XML fixture and asserts the produced `Alert[]`; a fixture missing pt-BR `<info>` causes the adapter to reject with a clear error message (no silent fallback to other languages).

3. **Atomic stub cutover**: The `stubAdapter` is removed from the registry in a single commit that simultaneously registers CEMADEN + INMET, after both pass golden-file contract tests.
   - Current: `src/lib/sources/registry.ts` exports `sources: readonly SourceAdapter[] = [stubAdapter]`. `src/lib/sources/stub.ts` exists.
   - Target: Single commit on `phase-4-adapters-cemaden-inmet` branch deletes `stub.ts` + `stub.test.ts` + `stub-default.json` fixture, and rewrites `registry.ts` to `[cemadenAdapter, inmetAdapter]`. Stub-related references in any other file are removed in that commit. Registry-isolation grep gate (P2) and dep-cruiser still pass.
   - Acceptance: `git log` shows one commit that adds both adapters to the registry AND removes the stub file/fixture/test in the same diff; `ls src/lib/sources/stub*` returns nothing; CI green.

4. **Golden-file fixtures with provenance**: Real captured responses for both sources, stored under `tests/fixtures/sources/`.
   - Current: Only `tests/fixtures/sources/stub-default.json` exists.
   - Target: `tests/fixtures/sources/cemaden-<ISO-date>.json` and `tests/fixtures/sources/inmet-<ISO-date>.xml` are committed, captured from live sources via the refresh script (REQ-7). Each fixture filename encodes the capture date for proveniência.
   - Acceptance: Fixture files exist, are non-empty, and parse cleanly through their respective adapters when injected via the test HTTP mock.

5. **Contract tests**: Adapter contract tests fail when source response shape changes.
   - Current: Stub-only test (`stub.test.ts`) exercises only the local fixture.
   - Target: Per-adapter Vitest contract test that loads its golden fixture, runs the adapter against a mocked HTTP layer returning that fixture, and asserts the produced `Alert[]` matches a stored snapshot. Adding/removing/renaming a field in the fixture causes the test to fail.
   - Acceptance: Mutating any captured field in a fixture (or the parsed structure) causes the contract test to fail with a clear diff; running unmutated fixtures passes 100%.

6. **End-to-end real-data flow**: A cron tick produces real-source data in `/api/states`.
   - Current: Cron tick produces stub data (`source: "stub"` in alerts). `/api/states` snapshots return fixture-derived alerts.
   - Target: A manual run of `/api/ingest` (with valid `INGEST_TOKEN` Bearer header) against the live deployment fetches both real sources in parallel, dedupes, computes risk via `calculateRiskLevel()`, writes the snapshot to Upstash, and `/api/states` returns alerts with `source: "cemaden"` and/or `source: "inmet"` and non-stub `issuedAt` timestamps.
   - Acceptance: Smoke test against the preview deployment shows at least one CEMADEN-sourced and one INMET-sourced alert in `/api/states` response (when alerts exist nationally), or both sources appear in `sources_health` with `lastSuccessfulFetch` recent if zero alerts were emitted at fetch time.

7. **Per-source schema-drift behavior**: When a payload-hash anomaly fires, only the affected source degrades — not the whole tick.
   - Current: P2 shipped payload-hash detection at the orchestrator level; behavior on drift was not finalized for real sources.
   - Target: When CEMADEN or INMET response fails zod validation OR the payload-hash diverges by more than a threshold from the rolling baseline, that source's branch in `Promise.allSettled` rejects, the orchestrator records `sources_health.lastError = "schema_drift"` for that source only, and the other source still flows through dedup → snapshot. P3's staleness rule then downgrades affected states to `unknown` if BOTH sources fail for >1h (already implemented in P3 — no new code needed there).
   - Acceptance: Integration test forces CEMADEN to reject (mocked) while INMET returns valid data; `/api/states` returns INMET-sourced alerts and `/api/health` shows `cemaden.lastError = "schema_drift"`; states with no INMET alerts retain their last-known-good value (not `unknown`) until the 1h staleness window passes.

8. **Fixture refresh script with proveniência**: A maintainer command captures a fresh response from the live source and emits a diff vs the previous fixture.
   - Current: No fixture-refresh tooling. Updating fixtures would require manual paste-replace.
   - Target: `pnpm fixtures:refresh:cemaden` and `pnpm fixtures:refresh:inmet` exist as `package.json` scripts (backed by `scripts/refresh-fixture.ts`). Each command fetches the live source, runs zod validation, writes the response to `tests/fixtures/sources/<source>-<ISO-date>.<ext>`, prints a unified diff vs the previous fixture, and exits with code 0 if shape matches the prior fixture or code 1 if shape changed (signaling human review).
   - Acceptance: Running the script with no prior fixture creates one cleanly; running it with an unchanged source produces an empty diff and exit 0; running it after manually mutating the prior fixture (to simulate drift) produces a non-empty diff and exit 1.

## Boundaries

**In scope:**

- `src/lib/sources/cemaden.ts` — CEMADEN adapter implementing `SourceAdapter` contract
- `src/lib/sources/inmet.ts` — INMET adapter implementing `SourceAdapter` contract
- Deletion of `src/lib/sources/stub.ts`, `stub.test.ts`, and `tests/fixtures/sources/stub-default.json`
- Rewrite of `src/lib/sources/registry.ts` to `[cemadenAdapter, inmetAdapter]`
- `tests/fixtures/sources/cemaden-<date>.json` + `inmet-<date>.xml` golden fixtures captured from live sources
- Per-adapter contract tests (Vitest) using the golden fixtures + HTTP mock layer
- `scripts/refresh-fixture.ts` + `pnpm fixtures:refresh:cemaden` / `:inmet` package.json scripts
- ISO-8601 UTC timestamp normalization at adapter boundary (`Z` suffix output)
- `fast-xml-parser` dependency added at pinned version
- Adapter consumes existing P3 severity vocabulary maps (`src/lib/risk/sources/{cemaden,inmet}.ts`) — does not redefine them
- README addendum or fixture-refresh docs (where to find scripts, when to run them)

**Out of scope:**

- ADAPT-03 (INPE Queimadas / NASA FIRMS) — explicitly Phase 6, not Phase 4
- Any UI changes (map, cards, per-state route) — Phase 5
- Risk engine changes — Phase 3 is the contract; this phase consumes it as-is
- Outreach to CEMADEN / INMET / Defesa Civil for stable endpoints — Phase 7
- Translation utilities for foreign-language sources (NOAA / NASA) — deferred to Phase 6 or later milestone
- Production database "production branch" cutover on Neon — Phase 7
- Per-state CEMADEN fan-out — design must use single national-scope call (free-tier headroom); 27× HTTP/15min is anti-pattern
- Auto-refresh of fixtures via CI / nightly GH Actions — explicitly rejected (auto-acceptance of drift = silent safety regression)
- Backwards-compat wrapper to keep stub running alongside real adapters — atomic swap is required (Q4=c)
- Drift sentinel workflow (72h-gated GH Actions monitoring upstream schema changes) — **deferred to Phase 6 (Hardening)** per discuss-phase decision; tracked in [#4](https://github.com/CarlosHenriqueMkt/enso-brasil/issues/4). Phase 4 ships Canal 1 (manual `pnpm fixtures:refresh:*`) + Canal 3 (contract tests in CI). Canal 2 (proactive sentinel) is defense-in-depth and dilutes P4 scope.

**Conditional fallback (irreducible core, locked Q6=a):** If CEMADEN endpoint research blocks within Phase 4 (endpoint inaccessible, requires unavailable auth, or schema is not zod-validatable within reasonable effort), Phase 4 ships INMET-only — `registry.ts = [inmetAdapter]`, stub still removed, CEMADEN deferred to Phase 5 or 6. The registry pattern allows late append without orchestrator changes.

## Constraints

- HTTP transport: Both adapters use the shared ofetch wrapper from P2 (`src/lib/http/`); no direct `fetch()` calls. Timeout, retry, and error normalization inherited.
- Edge-safety: Adapters run in the Node runtime under `/api/ingest`. They MAY use Node-only APIs (no edge-runtime constraint). They MUST NOT be imported by edge routes (`/api/states`, `/api/health`) — registry isolation enforces this.
- Pinned dependency: `fast-xml-parser` added at a specific version (research will pick), MIT, zero runtime deps.
- Free tier: National-scope single fetch per source per cron tick. No per-state HTTP fan-out. Total: 2 HTTP calls every 15 min × 96 ticks/day = 192 outbound requests/day from the platform.
- Endpoint discovery: CEMADEN endpoint URL, auth, and response contract are unknown today. Research phase MUST resolve them before plan-phase. Plan must not silently assume an endpoint.
- PT-BR only: Adapters select pt-BR content where sources offer multilingual responses. No fallback to other languages — fail loud.
- Conventional Commits: All commits prefixed `feat(04)`, `test(04)`, `fix(04)`, `chore(04)`, `docs(04)`. Squash-merge to main per repo policy locked 2026-05-04.

## Acceptance Criteria

- [ ] `src/lib/sources/cemaden.ts` exists, exports `cemadenAdapter: SourceAdapter` with `key: "cemaden"`, passes zod validation against captured fixture (or phase ships INMET-only per fallback)
- [ ] `src/lib/sources/inmet.ts` exists, exports `inmetAdapter: SourceAdapter` with `key: "inmet"`, parses CAP XML via `fast-xml-parser`, selects `<info xml:lang="pt-BR">`, fails loudly if absent
- [ ] `src/lib/sources/registry.ts` lists real adapters only; no `stubAdapter` import or reference anywhere in `src/`, `tests/`, or `scripts/`
- [ ] `src/lib/sources/stub.ts`, `stub.test.ts`, and `tests/fixtures/sources/stub-default.json` are deleted in the same commit that registers the real adapters
- [ ] Per-adapter contract tests load their golden fixtures and pass; mutating any captured field causes the contract test to fail with a readable diff
- [ ] `tests/fixtures/sources/cemaden-<ISO-date>.json` and `inmet-<ISO-date>.xml` files exist and were captured via the refresh script (filename encodes date)
- [ ] Adapter timestamps in `Alert.issuedAt` are ISO-8601 UTC strings ending with `Z` — verifiable via a unit test that parses each fixture and asserts every `issuedAt` matches `/Z$/`
- [ ] Manual smoke against preview deployment: `/api/states` returns alerts with `source: "cemaden"` and/or `source: "inmet"`, and `/api/health` shows recent `lastSuccessfulFetch` for both sources
- [ ] Schema-drift integration test: mocking CEMADEN to fail zod validation does not block INMET; `/api/states` returns INMET data; `/api/health` reports `cemaden.lastError`
- [ ] `pnpm fixtures:refresh:cemaden` and `pnpm fixtures:refresh:inmet` exist; running with unchanged source produces empty diff + exit 0; running after a forced fixture mutation produces non-empty diff + exit 1
- [ ] dep-cruiser RISK-01 isolation rule still passes (P3 contract preserved)
- [ ] Registry-isolation grep gate from P2 still passes (orchestrator does not import concrete adapter modules)
- [ ] CI green on the `phase-4-adapters-cemaden-inmet` branch before PR open

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes                                                                                     |
| ------------------- | ----- | ----- | ------ | ----------------------------------------------------------------------------------------- |
| Goal Clarity        | 0.92  | 0.75  | ✓      | Atomic swap locked; INMET-only fallback documented                                        |
| Boundary Clarity    | 0.88  | 0.70  | ✓      | Explicit out-of-scope incl. ADAPT-03, UI, prod branch, auto-refresh                       |
| Constraint Clarity  | 0.82  | 0.65  | ✓      | Endpoint specifics deferred to research-phase deliverable (known unknown, not assumption) |
| Acceptance Criteria | 0.88  | 0.70  | ✓      | 13 pass/fail checkboxes                                                                   |
| **Ambiguity**       | 0.12  | ≤0.20 | ✓      |                                                                                           |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective     | Question summary                             | Decision locked                                                                          |
| ----- | --------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1     | Researcher      | Stub fate after P4?                          | (a) Remove stub from registry entirely — delete `stub.ts` + fixture + test               |
| 1     | Researcher      | CEMADEN endpoint, auth, fan-out scope?       | Defer to research phase — endpoint specifics unknown, will resolve before plan-phase     |
| 1     | Researcher      | CAP XML parser library?                      | (a) `fast-xml-parser` — pinned version, edge-compatible, MIT, zero deps                  |
| 2     | Simplifier      | Cutover sequence stub → real?                | (c) Atomic registry swap in single commit after both adapters pass contract test         |
| 2     | Boundary Keeper | Schema-drift behavior?                       | (c) Per-source fail → P3 staleness rule downgrades to `unknown` only after 1h both-fail  |
| 2     | Simplifier      | Irreducible core if CEMADEN research blocks? | (a) Ship INMET only, defer CEMADEN to P5/P6 (registry pattern allows late append)        |
| 3     | Failure Analyst | INMET CAP `<info>` multilingual selection?   | (a) Always `xml:lang="pt-BR"`; fail loudly if absent (no silent fallback)                |
| 3     | Failure Analyst | Timestamp normalization in adapter output?   | (a) ISO-8601 UTC with `Z` suffix; UI converts to America/Sao_Paulo at render             |
| 3     | Failure Analyst | Golden-fixture refresh policy?               | (b) Scripted helper `pnpm fixtures:refresh:<source>`; manual invocation; explicit commit |

---

_Phase: 04-first-two-adapters_
_Spec created: 2026-05-05_
_Next step: /gsd-discuss-phase 4 — implementation decisions (HTTP mock layer, parser config, fixture script structure, error taxonomy)_
