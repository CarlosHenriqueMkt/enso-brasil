# Phase 4 — Context: First Two Adapters (CEMADEN + INMET)

**Created:** 2026-05-05
**Phase goal:** Replace stub adapter with real CEMADEN + INMET adapters via atomic registry swap; full ingest → normalize → store → snapshot → cache → serve flow uses real Brazilian official-source data.
**Status:** Ready for `/gsd-plan-phase 4` after research phase resolves CEMADEN endpoint.

## Domain

Adapter implementation phase. Pure-data transforms (HTTP response → `Alert[]`) running under Node runtime in `/api/ingest`. No UI, no risk math (P3 owns it), no orchestration changes (P2 owns it). Two production adapters + atomic stub removal + fixture refresh tooling.

## Spec lock

`.planning/phases/04-first-two-adapters/04-SPEC.md` — 8 requirements locked, ambiguity 0.12. **Downstream agents MUST read SPEC.md first.** This CONTEXT.md captures HOW; SPEC.md captures WHAT.

Issue [#4](https://github.com/CarlosHenriqueMkt/enso-brasil/issues/4) — Drift sentinel workflow deferred to Phase 6.

## Canonical refs

Every downstream agent (researcher, planner, executor) MUST read these before action:

- `.planning/phases/04-first-two-adapters/04-SPEC.md` — Locked requirements (MUST read before planning)
- `.planning/REQUIREMENTS.md` — ADAPT-01, ADAPT-02, ADAPT-04
- `.planning/ROADMAP.md` — Phase 4 success criteria (5 SCs)
- `.planning/PROJECT.md` — Locked stack decisions, anti-features, conservatism principle
- `.planning/STATE.md` — Phase progression, repo policy
- `risk-formula-v0.md` — v0 risk formula contract (P3 inputs)
- `.planning/research/SUMMARY.md` — v0.1 corrections (`unknown` level, `moderate` default)
- `.planning/research/PITFALLS.md` — CEMADEN instability, INMET CAP parsing, free-tier exhaustion
- `.planning/phases/03-pure-risk-engine/03-LEARNINGS.md` — Wave-race lessons, lint-staged sequential mode
- `src/lib/sources/types.ts` — `SourceAdapter` contract
- `src/lib/sources/registry.ts` — Registry isolation pattern
- `src/lib/sources/schema.ts` — `Alert` zod schema
- `src/lib/risk/sources/cemaden.ts` + `inmet.ts` — Severity vocabulary maps (P3, do not redefine)
- `CONTRIBUTING.md` — Squash-merge policy, conventional commits, testing setup

## Decisions (implementation choices locked in this discussion)

### Adapter architecture

- **Factory + DI pattern:** Each adapter exports `createCemadenAdapter(httpClient)` / `createInmetAdapter(httpClient)`. Production registry passes the shared ofetch wrapper; tests pass a stub `(url) => fixtureContent`. Adapters become pure functions of their inputs — testable without mock framework.
- **Registry exports already-configured instances:** `export const cemadenAdapter = createCemadenAdapter(prodHttpClient)`. Registry import surface unchanged from current shape.
- **No MSW dep:** Industry-standard mocking is overkill for 2 adapters. Factory DI gives equivalent isolation with zero new runtime deps.

### Error taxonomy

- **`Error` + typed `code` field via `cause` option** (Node 16+ standard): `throw new Error(message, { cause: originalError })` with a `code: SourceErrorCode` property attached.
- **Exported discriminated union:** `export type SourceErrorCode = "http_5xx" | "timeout" | "schema_invalid" | "payload_drift" | "xml_malformed" | "missing_pt_br"`.
- **Stack traces preserved** for production edge logs; pino redaction config from P2 already serializes `cause`.
- **Orchestrator integration:** `sources_health.lastError = err.code` directly (no string parsing). `switch (err.code)` exhaustive in error-handling paths.
- **No subclasses:** Avoid `Error` prototype-chain pegadinhas in V8.

### HTTP transport

- Adapters MUST use the shared ofetch wrapper from P2 (`src/lib/http/`) — no direct `fetch()` calls.
- Timeout, retry, and error normalization inherited from P2 wrapper. If wrapper-level config insufficient, propose changes to P2 wrapper before forking adapter-specific behavior.
- HTTP layer injection via factory DI (above) — production wires real wrapper, tests wire stub.

### XML parsing

- `fast-xml-parser` (pinned version, picked by research phase) — MIT, zero runtime deps.
- INMET adapter selects `<info xml:lang="pt-BR">` block. **Fail loud** if absent: throw `Error` with `code: "missing_pt_br"`. No silent fallback.
- Parser config: preserve attributes, parse numbers conservatively (severity terms are strings, not numeric). Research phase finalizes parser options.

### Timestamp normalization

- All adapter outputs in `Alert.issuedAt` are **ISO-8601 UTC strings** with `Z` suffix.
- CEMADEN naive timestamps assumed BRT (UTC-3, no DST). Documented adapter assumption — if source migrates to TZ-aware format, adapter throws and forces fixture/code review.
- INMET CAP timestamps already ISO-8601 with offset; conversion is `new Date(s).toISOString()`.
- DB column type: `timestamptz` (P2 schema; no change).

### Schema-drift behavior (P3 staleness alignment)

- Per-source rejection in `Promise.allSettled` — affected source records `sources_health.lastError`, other source flows through.
- States retain last-known-good snapshot until P3 staleness rule fires (BOTH sources fail >1h → `unknown`).
- No new code in risk engine; P3 already implements this contract.

### Atomic cutover

- Single commit on `phase-4-adapters-cemaden-inmet`:
  - Deletes `src/lib/sources/stub.ts`, `stub.test.ts`, `tests/fixtures/sources/stub-default.json`
  - Rewrites `src/lib/sources/registry.ts` to `[cemadenAdapter, inmetAdapter]`
  - Removes any orchestrator/edge import referencing stub
- **Precondition:** Both adapters pass golden-file contract tests + dep-cruiser RISK-01 + grep gate.
- Conditional fallback: if CEMADEN research blocks, registry = `[inmetAdapter]` only; stub still removed.

### Fixture refresh tooling

- **Helper + thin scripts:** `scripts/lib/fixture-runner.ts` (shared diff/write/exit logic) + `scripts/refresh-cemaden.ts` + `scripts/refresh-inmet.ts` (4-5 lines each, import adapter + call runner).
- **`package.json` scripts:** `"fixtures:refresh:cemaden": "tsx scripts/refresh-cemaden.ts"`, `"fixtures:refresh:inmet": "tsx scripts/refresh-inmet.ts"`.
- **Output format:** Full unified diff + structural-change heuristic.
  - Exit 0 if only leaf values changed (alerts entered/exited — normal operation)
  - Exit 1 if keys added/removed/renamed (structural drift — human review required)
- **Filename convention:** `tests/fixtures/sources/<source>-<ISO-date>.<ext>`. Old fixtures NOT auto-deleted; maintainer commits new + manually removes obsolete in same PR.
- **Drift sentinel automation deferred to P6** (tracked in #4).

### Plan breakdown — Medium granularity (6 plans, 3 waves)

| #     | Plan                               | Wave           | Description                                                                                                                                                                                                                                                            |
| ----- | ---------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 04-01 | `fast-xml-parser-dep`              | 0 (sequential) | Add `fast-xml-parser` at pinned version; lockfile update; trivial smoke test for parser. Must land before adapters reference it.                                                                                                                                       |
| 04-02 | `cemaden-schema-and-adapter`       | 1 (parallel)   | zod schema for CEMADEN response; `createCemadenAdapter` factory; severity normalization via P3 vocab; unit tests with hand-crafted inline fixture. **Conditional on research:** if CEMADEN endpoint blocks, plan rewrites to "skip cemaden" + downstream plans adjust. |
| 04-03 | `inmet-schema-and-adapter`         | 1 (parallel)   | zod schema for parsed INMET CAP structure; `createInmetAdapter` factory; pt-BR `<info>` selection; unit tests with hand-crafted inline fixture.                                                                                                                        |
| 04-04 | `fixture-refresh-script`           | 1 (parallel)   | `scripts/lib/fixture-runner.ts` shared helper; `scripts/refresh-cemaden.ts` + `scripts/refresh-inmet.ts` thin entrypoints; package.json scripts; structural diff util with tests.                                                                                      |
| 04-05 | `contract-tests-and-real-fixtures` | 2 (sequential) | Run refresh scripts to capture real fixtures; commit `cemaden-<ISO>.json` + `inmet-<ISO>.xml`; per-adapter contract tests using captured fixtures + factory DI.                                                                                                        |
| 04-06 | `atomic-cutover`                   | 3 (sequential) | Single commit: delete stub + register real adapters in registry. Verify CI green.                                                                                                                                                                                      |

**Wave-race mitigation (P3 LEARNINGS):** Wave 1 parallel limited to 3 truly-independent plans. If lint-staged race re-emerges, drop to sequential per LEARNINGS guidance.

## Code context (reusable assets)

### Existing patterns to reuse

- **Adapter contract:** `src/lib/sources/types.ts` — `SourceAdapter { key, displayName, fetch }`
- **Severity vocabulary:** `src/lib/risk/sources/cemaden.ts` + `inmet.ts` — already shipped P3, import + reuse
- **Alert schema:** `src/lib/sources/schema.ts` — zod `Alert` type, `AlertArraySchema`
- **Payload hash:** `src/lib/sources/hash.ts` — edge-safe; orchestrator uses for drift detection (no adapter responsibility)
- **HTTP wrapper:** `src/lib/http/` (P2) — ofetch-based, retry/timeout configured
- **Logger:** `src/lib/logger/` (P2) — pino with redaction; adapter errors logged via this layer at orchestrator
- **Test infra:** `tests/setup/db.ts`, `vitest.config.ts` (P2) — Postgres test container, integration test gate
- **Registry isolation grep gate:** `.github/workflows/ci.yml` — verifies orchestrator never imports concrete adapter

### Files to be CREATED

- `src/lib/sources/cemaden.ts` (factory)
- `src/lib/sources/inmet.ts` (factory)
- `src/lib/sources/cemaden.test.ts` (unit, hand-crafted fixtures)
- `src/lib/sources/inmet.test.ts` (unit, hand-crafted fixtures)
- `tests/contract/cemaden.test.ts` (real fixture, contract test)
- `tests/contract/inmet.test.ts` (real fixture, contract test)
- `tests/fixtures/sources/cemaden-<ISO-date>.json`
- `tests/fixtures/sources/inmet-<ISO-date>.xml`
- `scripts/lib/fixture-runner.ts`
- `scripts/refresh-cemaden.ts`
- `scripts/refresh-inmet.ts`

### Files to be DELETED (atomic cutover plan 04-06)

- `src/lib/sources/stub.ts`
- `src/lib/sources/stub.test.ts`
- `tests/fixtures/sources/stub-default.json`

### Files to be MODIFIED

- `src/lib/sources/registry.ts` — `[stubAdapter]` → `[cemadenAdapter, inmetAdapter]`
- `package.json` — Add `fast-xml-parser` dep + `fixtures:refresh:*` scripts
- `pnpm-lock.yaml` — Lockfile sync
- README PT-BR — addendum about fixture refresh policy
- `CONTRIBUTING.md` — Reference fixture-refresh procedure

## Constraints inherited

- Edge-safety isolation (RISK-01 from P3) preserved — adapters Node-only, never imported by edge routes
- Free-tier budget — single national-scope HTTP per source per cron tick; 2 calls × 96 ticks/day = 192/day platform-wide
- Squash-merge to main per repo policy 2026-05-04 (PR #2)
- All commits prefixed `feat(04)`, `test(04)`, `fix(04)`, `chore(04)`, `docs(04)`
- Solo-dev `--admin` bypass after CI green for self-merge
- PR title format: `Phase 4: First Two Adapters (CEMADEN + INMET)` (will be PR #5+)

## Research deliverables required before plan-phase

`/gsd-plan-phase 4` blocks until research phase resolves:

1. **CEMADEN endpoint URL** — Painel de Alertas backing API confirmed location
2. **CEMADEN auth** — token / IP allowlist / fully public
3. **CEMADEN response shape** — JSON contract example, severity field names, alert structure
4. **CEMADEN national-scope feasibility** — confirm single call returns all states (or document fan-out plan within free-tier limits)
5. **INMET Alert-AS CAP feed URL** — exact endpoint
6. **INMET CAP version** — 1.1, 1.2 (parser config implications)
7. **`fast-xml-parser` version pin** — picked + lockfile recommendation

If CEMADEN research blocks (endpoint inaccessible, auth unavailable, schema not zod-validatable within reasonable effort): plan-phase routes to INMET-only fallback per SPEC Q6.

## Deferred ideas (captured for backlog / future phases)

| Idea                                                    | Reason                                               | Tracking                                                        |
| ------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| Drift sentinel workflow (72h-gated)                     | P6 Hardening scope; defense-in-depth, not core to P4 | [#4](https://github.com/CarlosHenriqueMkt/enso-brasil/issues/4) |
| INPE Queimadas / NASA FIRMS adapter                     | ADAPT-03, scoped to P6 in REQUIREMENTS.md            | ROADMAP P6                                                      |
| Translation utilities for foreign-language sources      | Becomes relevant when NOAA/NASA enter                | Future milestone (M5+)                                          |
| Outreach to CEMADEN/INMET for stable endpoints          | Phase 7 (Launch) responsibility                      | ROADMAP P7                                                      |
| Production database "production branch" cutover on Neon | Phase 7 deploy hardening                             | ROADMAP P7                                                      |

## Open questions for research phase

- CEMADEN endpoint discovery method (DevTools network inspection of Painel de Alertas, public API docs if any)
- INMET CAP feed update frequency (informs cache-control / fetch cadence within 15min cron)
- Fixture capture timing strategy: when alerts are absent nationally, fixture is `[]` — does that exercise the schema enough? Consider capturing during known-active period (rainy season).

---

_Phase: 04-first-two-adapters_
_Context captured: 2026-05-05_
_Next step: `/gsd-plan-phase 4` (research phase will fire first per workflow.research config)_

---

## Decision Update (2026-05-05): Path C — INMET-only

CEMADEN dropped from Phase 4. **Path C** activates the SPEC's locked Q6=a fallback (see `04-SPEC.md` line 86).

**Rationale:** Live discovery on 2026-05-05 confirmed CEMADEN's only documented public REST API (`https://sws.cemaden.gov.br/PED/api/ui/`, Swagger 2.0) is **PED — Plataforma de Entrega de Dados** — observational data only (PCDs, accumulated rainfall, weather stations). 15 paths, zero alert/aviso/risco endpoints. JWT-protected. Deriving alerts from raw rainfall crosses ENSO Brasil's aggregator-vs-authority line (CLAUDE.md anti-features).

CEMADEN authoritative alerts live behind `painelalertas.cemaden.gov.br` SPA. Backend is undocumented; DevTools fieldwork exceeds Phase 4's scope budget.

**Impact on Phase 4:**

- **CEMADEN adapter, schema, contract test:** deferred to **Phase 5** (carry-over).
- **PED swagger** saved at `.planning/phases/04-first-two-adapters/04-cemaden-PED-swagger.json` for Phase 5 reference. **Do not delete.**
- **Phase 4 = INMET adapter + inline-stub CEMADEN for cross-source tests only.** No real CEMADEN code in `src/`.
- **Plan set:** 5 plans (04-01, 04-03, 04-04, 04-05, 04-06). Plan 04-02 deleted. Renumbering NOT performed — gaps preserve traceability with prior CONTEXT.md plan-table references.
- **Registry:** `[inmetAdapter]` only. Orchestrator uses `Promise.allSettled([inmetAdapter])` (futures-proof for P5 append).
- **Stub still removed atomically** in 04-06.

**Cross-source isolation (REQ-7) preservation:** Plan 04-05's cross-source isolation test uses an **inline `cemadenStub` factory inside the test file** that always throws `SourceError({code: "schema_invalid"})`. This proves the `Promise.allSettled` isolation contract without landing real CEMADEN code in `src/`. When CEMADEN ships in P5, the inline stub is replaced by the real adapter.

**Tracking note:** Add to `.planning/STATE.md` Risk Watch: "CEMADEN authoritative alerts feed undocumented; PED API ≠ alerts; carry to P5."
