# Roadmap — ENSO Brasil v1

**Milestone:** v1 — Per-state hazard dashboard
**Granularity:** Fine (7 phases)
**Mode:** YOLO + parallel execution
**Workflow:** research ✓ · plan-check ✓ · verifier ✓

7 phases, every v1 REQ-ID mapped, success criteria are observable user-facing behaviors.

---

## Phase Map

| #   | Phase                              | Goal                                                                                                                                                                                | Requirements                                       | Success criteria |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------- |
| 1   | **Skeleton & OSS Foundation** ✅   | Public repo, scaffolded Next.js app, CI green, accessibility shell, disclaimer + privacy live · SPEC locked at `phases/01-skeleton-oss-foundation/01-SPEC.md` · VERIFIED 2026-05-01 | FOUND-01,02,04..10 (FOUND-03 removed)              | 4/4 ✓            |
| 2   | **Data Foundation**                | Postgres + Upstash + ofetch + adapter contract + cron skeleton wired end-to-end with no real source yet                                                                             | DATA-01..09                                        | 4                |
| 3   | **Pure Risk Engine**               | `calculateRiskLevel()` shipped with `unknown` level, 100% test coverage, plain-language explanations, versioned snapshot shape                                                      | RISK-01..10                                        | 4                |
| 4   | **First Adapter (INMET) — Path C** | INMET adapter live; full ingest → normalize → store → snapshot → cache → serve flow on real INMET data. CEMADEN deferred to Phase 5.                                                | ADAPT-02, ADAPT-04                                 | 5                |
| 5   | **CEMADEN + Dashboard UI**         | CEMADEN adapter (carry-over from P4 Path C) + Map + cards + per-state route + share + filter + `/texto` route live; WCAG AA passes                                                  | ADAPT-01, DASH-01..10, A11Y-01..06                 | 6                |
| 6   | **Hardening + 3rd Source**         | INPE Queimadas or NASA FIRMS integrated; perf budget met; canary deploy; observability minimal viable                                                                               | ADAPT-03, A11Y-05 (re-verify), DATA-09 (re-verify) | 4                |
| 7   | **Launch**                         | Domain live, OG cards verified across WhatsApp/Twitter/LinkedIn, README final, Plausible wired, outreach sent                                                                       | DEPLOY-01..06                                      | 4                |

**Total:** 7 phases · 45 v1 requirements mapped · all v1 covered ✓

---

## Completion Status

- [x] Phase 1: Skeleton & OSS Foundation
- [x] Phase 2: Data Foundation
- [x] Phase 3: Pure Risk Engine
- [x] Phase 4: First Adapter (INMET) — Path C
- [ ] Phase 5: CEMADEN + Dashboard UI
- [ ] Phase 6: Hardening + 3rd Source
- [ ] Phase 7: Launch

---

## Phase Details

### Phase 1: Skeleton & OSS Foundation

**Goal:** A public, accessible, MIT-licensed Next.js skeleton that already feels like ENSO Brasil — disclaimer visible, privacy page live, CI green — but no data flow yet.

**Requirements:** FOUND-01, FOUND-02, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09, FOUND-10, FOUND-11 _(FOUND-03 removed — no i18n)_

**Success criteria:**

1. Public GitHub repo with MIT LICENSE, README (PT-BR primary), CONTRIBUTING, CODE_OF_CONDUCT visible at root
2. `npm run build` succeeds; `/` and `/privacidade` render server-side without errors
3. GitHub Actions CI runs typecheck, lint, Vitest, Playwright smoke on PR; passes on main
4. Visiting `/` and `/privacidade` with JavaScript disabled still shows disclaimer text in the rendered HTML

**Depends on:** none (this is the entry phase)

**Plans:** 5 plans

Plans:

- [ ] 01-01-scaffold-PLAN.md — Next 16 + TS strict + Tailwind v4 + pnpm scaffold
- [ ] 01-02-tooling-and-tests-PLAN.md — Lint/format/pre-commit + Vitest/Playwright + Wave-0 test stubs
- [ ] 01-03-theme-and-strings-PLAN.md — @theme tokens + messages.ts + SourceLink
- [ ] 01-04-oss-files-PLAN.md — LICENSE + README PT-BR + governance files + Renovate
- [ ] 01-05-pages-and-ci-PLAN.md — SSR layout + /privacidade + CI workflow + human checkpoint

---

### Phase 2: Data Foundation

**Goal:** All the plumbing to ingest, store, cache, and serve hazard data — wired end-to-end with a stub adapter that returns deterministic fake alerts. No real source yet, no risk computation yet, no UI yet.

**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, DATA-09

**Success criteria:**

1. Drizzle migration creates `alerts`, `sources_health`, `snapshot_cache` tables in Neon dev branch with the right indexes
2. GitHub Actions cron workflow runs every 15 min on `main`; calls token-protected `/api/ingest`; logs success
3. A stub `SourceAdapter` returning fake `Alert[]` for 3 states gets persisted to Postgres, dedup runs, snapshot is computed (with placeholder risk = `unknown` until P3 lands), cached in Upstash, retrievable via `/api/states`
4. `/api/health` returns per-source `lastSuccessfulFetch` timestamps; pre-commit secret scan blocks any committed credentials

**Plans:** 11 plans

Plans:

- [ ] 02-01-deps-and-config-PLAN.md — install all P2 deps at pinned versions, drizzle.config.ts, next.config.ts pino opt-out, .env.example with 4 env vars
- [ ] 02-02-db-schema-and-migrations-PLAN.md — Drizzle schema (alerts/sources_health/snapshot_cache) + 0001 migration + dual-runtime drivers (edge.ts/node.ts) + migrate.ts runner
- [ ] 02-03-cache-and-http-PLAN.md — Upstash no-TTL cache wrapper + ofetch retry/timeout wrapper + in-memory mock + 9 unit tests
- [ ] 02-04-loggers-PLAN.md — pino Node logger with redaction + edge JSON helper (no pino) + ESLint no-restricted-imports guard (D-03)
- [ ] 02-05-source-adapter-and-stub-PLAN.md — SourceAdapter interface + Alert zod schema + payload_hash util + stub adapter + fixtures + registry-isolation grep gate
- [ ] 02-06-api-schemas-and-diff-PLAN.md — UF27/StateSnapshotSchema/HealthReportSchema/StateSnapshotsResponseSchema (length 27) + diffSnapshot util (D-04)
- [ ] 02-07-api-states-health-PLAN.md — /api/states + /api/health edge routes (neon-http) + registry-meta drift detector + contract tests
- [ ] 02-08-api-ingest-PLAN.md — /api/ingest Node route (8-step orchestration: allSettled → zod → dedup → insert → snapshot → setSnapshot+write-through → diff+revalidatePath) + verifyBearerToken (constant-time) + 8 integration tests
- [ ] 02-09-cron-and-archive-PLAN.md — .github/workflows/cron.yml (every 15 min) + archive.yml (daily 03:00 BRT) + 0002 migration (snapshot_archive) + /api/archive Node route with 30-day prune
- [ ] 02-10-test-infra-docker-pg-PLAN.md — docker-compose.test.yml (postgres:17-alpine) + tests/setup/db.ts + vitest.config.ts setupFiles + ci.yml services + GH Actions version bumps + CONTRIBUTING entry
- [ ] 02-11-vercel-provision-and-deploy-PLAN.md — HUMAN GATES: provision Neon + Upstash + Vercel + GH secrets + first deploy smoke validation + README "Como deployar"

**Depends on:** Phase 1

---

### Phase 3: Pure Risk Engine

**Goal:** A pure, edge-safe `calculateRiskLevel()` that fully implements the v0 formula (with the research-flagged corrections: `unknown` level + `moderate` default for unknown terms). No I/O. 100% test coverage. Replaces the placeholder in P2's snapshot computation.

**Requirements:** RISK-01, RISK-02, RISK-03, RISK-04, RISK-05, RISK-06, RISK-07, RISK-08, RISK-09, RISK-10

**Success criteria:**

1. `src/lib/risk/calculate.ts` exports `calculateRiskLevel(alerts: Alert[]): RiskLevel` with no imports outside `./types` — verifiable via dependency-cruiser rule in CI
2. Vitest suite covers all 5 levels (`green`, `yellow`, `orange`, `red`, `unknown`), dedup rule, 24h validity window, source-staleness `unknown` rule, both `low`-default and `moderate`-default paths — 100% line + branch coverage
3. Snapshot output includes `formula_version: "v0"` and follows the additive-only contract documented in `.planning/research/SUMMARY.md`
4. Plain-language explanation generator returns a single PT-BR sentence per state matching the locked label set ("Sem alertas" / "Atenção" / "Alerta" / "Perigo" / "Dados indisponíveis")

**Depends on:** Phase 2

---

### Phase 4: First Adapter (INMET) — Path C

**Goal:** Replace the stub adapter with the INMET adapter. After this phase, `/api/states` returns real Brazilian alert data on every cron tick. CEMADEN is **deferred to Phase 5** under the SPEC's locked Q6=a fallback (Path C, decided 2026-05-05).

**Path C rationale:** Live discovery on 2026-05-05 confirmed CEMADEN's only documented public REST API (`https://sws.cemaden.gov.br/PED/api/ui/`) is **PED** — observational data only (PCDs, rainfall, weather stations), 15 paths, zero alert endpoints. Deriving alerts from raw rainfall would cross the aggregator-vs-authority line. CEMADEN authoritative alerts (`painelalertas.cemaden.gov.br`) require DevTools-on-live-SPA fieldwork that exceeds Phase 4's scope budget. PED swagger preserved at `.planning/phases/04-first-two-adapters/04-cemaden-PED-swagger.json` for P5.

**Requirements:** ADAPT-02, ADAPT-04

**Success criteria:**

1. INMET adapter parses Alert-AS **CAP XML** correctly (verified against captured real samples) and normalizes to `Alert[]` with proper attribution + sourceUrl
2. Golden-file fixture of real INMET response checked into `tests/fixtures/sources/inmet-<ISO-date>.{xml,list.json}`; adapter contract test fails if response shape changes
3. End-to-end: GH Actions cron tick → INMET adapter fires → dedup → store → risk computed → snapshot cached → `/api/states` returns real INMET data with non-stub timestamps
4. Cross-source isolation test (REQ-7) preserved via inline `cemadenStub` factory in test file — proves `Promise.allSettled` keeps INMET flowing when CEMADEN-stub rejects. **NO real CEMADEN code lands in `src/`.**
5. Atomic stub cutover: registry rewritten to `[inmetAdapter]` AND `stub.ts`/`stub.test.ts`/`stub-default.json` deleted in the same commit. Orchestrator uses `Promise.allSettled(sources.map(...))` which is N-arity safe — Phase 5 can append `cemadenAdapter` to the registry with zero `/api/ingest` changes.

**Depends on:** Phase 3

**Plans:** 5 plans (was 6 — plan 04-02 deleted under Path C)

Plans:

- [ ] 04-01-PLAN-fast-xml-parser-dep.md — Pin fast-xml-parser 5.3.0 + shared CAP parser module + sourceError() factory + vitest glob pre-extend (Wave 0)
- [ ] 04-03-PLAN-inmet-schema-and-adapter.md — INMET two-step adapter (INMET_CAP_LIST + INMET_CAP_DETAIL) + CAP parsing + pt-BR selection (Wave 1)
- [ ] 04-04-PLAN-fixture-refresh-script.md — pnpm fixtures:refresh:inmet + --dry-run + structural-diff util (Wave 1; CEMADEN refresh deferred to P5)
- [ ] 04-05-PLAN-contract-tests-and-real-fixtures.md — Capture real INMET fixture + contract test + cross-source isolation via inline cemadenStub (Wave 2)
- [ ] 04-06-PLAN-atomic-cutover.md — Atomic stub-removal + registry=[inmetAdapter] + preview smoke (Wave 3)

---

### Phase 5: CEMADEN + Dashboard UI

**Goal:** Land the real CEMADEN adapter (carry-over from Phase 4 Path C) AND ship the user-facing dashboard. Map (desktop) + cards (mobile), per-state route, share, filter, `/texto` accessible alternative — and WCAG AA verified via axe-core in CI.

**CEMADEN scope:** Discover the `painelalertas.cemaden.gov.br` SPA backing endpoint via DevTools network inspection; ship `src/lib/sources/cemaden.ts` factory + zod schema + golden fixture + contract test; replace the inline `cemadenStub` in `tests/contract/cross-source-isolation.test.ts` with the real adapter; append `cemadenAdapter` to `src/lib/sources/registry.ts` (zero `/api/ingest` changes — Promise.allSettled is N-arity safe).

**Requirements:** ADAPT-01 (CEMADEN, carry-over from P4), DASH-01..10, A11Y-01..06

**Success criteria:**

1. CEMADEN adapter ships with real captured fixture; cross-source isolation test now uses real `cemadenAdapter` instead of inline stub
2. Home `/` renders all 27 states with current risk level, badges (color + icon + label), source attribution, last-update timestamp; data comes from Upstash snapshot served via Edge runtime
3. `/estado/{uf}` route works for all 27 UFs with per-state OG/Twitter cards rendering correctly when pasted into WhatsApp web preview
4. Mobile cards layout works at 360px width; map appears below as secondary; region filter chips work
5. `/texto` route renders full data with no map, no client JS dependency, screen-reader-friendly heading structure
6. CI runs axe-core against home + 3 random state pages; zero critical violations. Lighthouse on simulated 3G profile shows perf ≥ 90, LCP < 2.5s, initial-route transfer < 200 KB

**Depends on:** Phase 4

---

### Phase 6: Hardening + 3rd Source

**Goal:** Add the optional 3rd source (INPE Queimadas OR NASA FIRMS) using the registry pattern with no orchestrator/UI changes. Verify free-tier headroom under 27-state × 3-source × 15-min load. Add minimal observability.

**Requirements:** ADAPT-03, plus re-verification of A11Y-05, DATA-09

**Success criteria:**

1. INPE Queimadas adapter (preferred) OR NASA FIRMS adapter (country-level single call) integrated; map flow shows fire alerts where applicable; dedup correctly distinguishes "queimada" from "incêndio"
2. 7-day soak run on staging confirms: Upstash commands < 80% of monthly free tier · Neon compute hrs < 80% · Vercel function invocations < 80% · GH Actions minutes well under public-OSS limit
3. Daily Postgres archive snapshot job (DATA-09) runs and retains last 30 days; archived rows are queryable
4. `/api/health` exposes the data needed to wire Plausible custom events later; Sentry-style error reporting wired (free tier or self-hosted GlitchTip)

**Depends on:** Phase 5

---

### Phase 7: Launch

**Goal:** Make the project public. Domain, social cards, README, analytics, outreach — and a clean main branch ready to invite contributors.

**Requirements:** DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06

**Success criteria:**

1. Site live on a stable public domain (Vercel `*.vercel.app` subdomain or `enso.com.br`-style domain); HTTPS auto, redirect from `www`
2. README in PT-BR (primary) + EN (secondary) covers: what, why, fórmula explained inline, sources, known limitations, how to contribute, how to run locally, deployment notes
3. Sharing the home URL and at least 3 state URLs in WhatsApp / Twitter / LinkedIn produces correct OG previews; Plausible records visits without cookies
4. Outreach emails sent to CEMADEN, INMET, and the federal Defesa Civil announcing the project + asking for guidance on stable endpoints; received-confirmation tracked

**Depends on:** Phase 6

---

## Coverage Validation

Every v1 REQ-ID in `REQUIREMENTS.md` maps to exactly one phase ✓ (ADAPT-01 moved P4→P5 under Path C)
No phase contains requirements from other milestones ✓
M2–M13 capabilities are out-of-scope for this milestone ✓

## After v1

Once v1 ships and observes real users, the project enters a new milestone cycle. Re-prioritization order for M2–M13 is an Open Decision — to be settled via `/gsd-new-milestone` after v1 launch and a short stabilization period.
