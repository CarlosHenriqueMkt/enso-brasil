# Roadmap — ENSO Brasil v1

**Milestone:** v1 — Per-state hazard dashboard
**Granularity:** Fine (7 phases)
**Mode:** YOLO + parallel execution
**Workflow:** research ✓ · plan-check ✓ · verifier ✓

7 phases, every v1 REQ-ID mapped, success criteria are observable user-facing behaviors.

---

## Phase Map

| # | Phase | Goal | Requirements | Success criteria |
|---|-------|------|--------------|------------------|
| 1 | **Skeleton & OSS Foundation** | Public repo, scaffolded Next.js app, CI green, accessibility shell, disclaimer + privacy live · SPEC locked at `phases/01-skeleton-oss-foundation/01-SPEC.md` | FOUND-01,02,04..10 (FOUND-03 removed) | 4 |
| 2 | **Data Foundation** | Postgres + Upstash + ofetch + adapter contract + cron skeleton wired end-to-end with no real source yet | DATA-01..09 | 4 |
| 3 | **Pure Risk Engine** | `calculateRiskLevel()` shipped with `unknown` level, 100% test coverage, plain-language explanations, versioned snapshot shape | RISK-01..10 | 4 |
| 4 | **First Two Adapters** | CEMADEN + INMET adapters live; full ingest → normalize → store → snapshot → cache → serve flow working | ADAPT-01, ADAPT-02, ADAPT-04 | 5 |
| 5 | **Dashboard UI** | Map + cards + per-state route + share + filter + `/texto` route live; WCAG AA passes | DASH-01..10, A11Y-01..06 | 5 |
| 6 | **Hardening + 3rd Source** | INPE Queimadas or NASA FIRMS integrated; perf budget met; canary deploy; observability minimal viable | ADAPT-03, A11Y-05 (re-verify), DATA-09 (re-verify) | 4 |
| 7 | **Launch** | Domain live, OG cards verified across WhatsApp/Twitter/LinkedIn, README final, Plausible wired, outreach sent | DEPLOY-01..06 | 4 |

**Total:** 7 phases · 45 v1 requirements mapped · all v1 covered ✓

---

## Phase Details

### Phase 1 — Skeleton & OSS Foundation

**Goal:** A public, accessible, MIT-licensed Next.js skeleton that already feels like ENSO Brasil — disclaimer visible, privacy page live, CI green — but no data flow yet.

**Requirements:** FOUND-01, FOUND-02, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09, FOUND-10, FOUND-11 *(FOUND-03 removed — no i18n)*

**Success criteria:**
1. Public GitHub repo with MIT LICENSE, README (PT-BR primary), CONTRIBUTING, CODE_OF_CONDUCT visible at root
2. `npm run build` succeeds; `/` and `/privacidade` render server-side without errors
3. GitHub Actions CI runs typecheck, lint, Vitest, Playwright smoke on PR; passes on main
4. Visiting `/` and `/privacidade` with JavaScript disabled still shows disclaimer text in the rendered HTML

**Depends on:** none (this is the entry phase)

---

### Phase 2 — Data Foundation

**Goal:** All the plumbing to ingest, store, cache, and serve hazard data — wired end-to-end with a stub adapter that returns deterministic fake alerts. No real source yet, no risk computation yet, no UI yet.

**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, DATA-09

**Success criteria:**
1. Drizzle migration creates `alerts`, `sources_health`, `snapshot_cache` tables in Neon dev branch with the right indexes
2. GitHub Actions cron workflow runs every 15 min on `main`; calls token-protected `/api/ingest`; logs success
3. A stub `SourceAdapter` returning fake `Alert[]` for 3 states gets persisted to Postgres, dedup runs, snapshot is computed (with placeholder risk = `unknown` until P3 lands), cached in Upstash, retrievable via `/api/states`
4. `/api/health` returns per-source `lastSuccessfulFetch` timestamps; pre-commit secret scan blocks any committed credentials

**Depends on:** Phase 1

---

### Phase 3 — Pure Risk Engine

**Goal:** A pure, edge-safe `calculateRiskLevel()` that fully implements the v0 formula (with the research-flagged corrections: `unknown` level + `moderate` default for unknown terms). No I/O. 100% test coverage. Replaces the placeholder in P2's snapshot computation.

**Requirements:** RISK-01, RISK-02, RISK-03, RISK-04, RISK-05, RISK-06, RISK-07, RISK-08, RISK-09, RISK-10

**Success criteria:**
1. `src/lib/risk/calculate.ts` exports `calculateRiskLevel(alerts: Alert[]): RiskLevel` with no imports outside `./types` — verifiable via dependency-cruiser rule in CI
2. Vitest suite covers all 5 levels (`green`, `yellow`, `orange`, `red`, `unknown`), dedup rule, 24h validity window, source-staleness `unknown` rule, both `low`-default and `moderate`-default paths — 100% line + branch coverage
3. Snapshot output includes `formula_version: "v0"` and follows the additive-only contract documented in `.planning/research/SUMMARY.md`
4. Plain-language explanation generator returns a single PT-BR sentence per state matching the locked label set ("Sem alertas" / "Atenção" / "Alerta" / "Perigo" / "Dados indisponíveis")

**Depends on:** Phase 2

---

### Phase 4 — First Two Adapters (CEMADEN + INMET)

**Goal:** Replace the stub adapter with real CEMADEN and INMET adapters. After this phase, `/api/states` returns real Brazilian alert data on every cron tick.

**Requirements:** ADAPT-01, ADAPT-02, ADAPT-04

**Success criteria:**
1. CEMADEN adapter fetches the Painel de Alertas backing endpoint, schema-validates with zod, normalizes to `Alert[]`; payload-hash anomaly detection logs schema drift
2. INMET adapter parses Alert-AS **CAP XML** correctly (verified against captured real samples) and normalizes to `Alert[]` with proper attribution + sourceUrl
3. Golden-file fixtures of real responses checked into `tests/fixtures/sources/` for both sources; adapter contract tests fail if response shape changes
4. End-to-end: GH Actions cron tick → both adapters fire in parallel → dedup → store → risk computed → snapshot cached → `/api/states` returns real data with non-stub timestamps
5. When either source is forced offline (mocked), the other still flows through; `sources_health` reflects the failure; risk for affected states downgrades to `unknown` only if BOTH fail for >1h

**Depends on:** Phase 3

---

### Phase 5 — Dashboard UI

**Goal:** Everything users see. Map (desktop) + cards (mobile), per-state route, share, filter, `/texto` accessible alternative — and WCAG AA verified via axe-core in CI.

**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, DASH-08, DASH-09, DASH-10, A11Y-01, A11Y-02, A11Y-03, A11Y-04, A11Y-05, A11Y-06

**Success criteria:**
1. Home `/` renders all 27 states with current risk level, badges (color + icon + label), source attribution, last-update timestamp; data comes from Upstash snapshot served via Edge runtime
2. `/estado/{uf}` route works for all 27 UFs with per-state OG/Twitter cards rendering correctly when pasted into WhatsApp web preview
3. Mobile cards layout works at 360px width; map appears below as secondary; region filter chips work
4. `/texto` route renders full data with no map, no client JS dependency, screen-reader-friendly heading structure
5. CI runs axe-core against home + 3 random state pages; zero critical violations. Lighthouse on simulated 3G profile shows perf ≥ 90, LCP < 2.5s, initial-route transfer < 200 KB

**Depends on:** Phase 4

---

### Phase 6 — Hardening + 3rd Source

**Goal:** Add the optional 3rd source (INPE Queimadas OR NASA FIRMS) using the registry pattern with no orchestrator/UI changes. Verify free-tier headroom under 27-state × 3-source × 15-min load. Add minimal observability.

**Requirements:** ADAPT-03, plus re-verification of A11Y-05, DATA-09

**Success criteria:**
1. INPE Queimadas adapter (preferred) OR NASA FIRMS adapter (country-level single call) integrated; map flow shows fire alerts where applicable; dedup correctly distinguishes "queimada" from "incêndio"
2. 7-day soak run on staging confirms: Upstash commands < 80% of monthly free tier · Neon compute hrs < 80% · Vercel function invocations < 80% · GH Actions minutes well under public-OSS limit
3. Daily Postgres archive snapshot job (DATA-09) runs and retains last 30 days; archived rows are queryable
4. `/api/health` exposes the data needed to wire Plausible custom events later; Sentry-style error reporting wired (free tier or self-hosted GlitchTip)

**Depends on:** Phase 5

---

### Phase 7 — Launch

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

Every v1 REQ-ID in `REQUIREMENTS.md` maps to exactly one phase ✓
No phase contains requirements from other milestones ✓
M2–M13 capabilities are out-of-scope for this milestone ✓

## After v1

Once v1 ships and observes real users, the project enters a new milestone cycle. Re-prioritization order for M2–M13 is an Open Decision — to be settled via `/gsd-new-milestone` after v1 launch and a short stabilization period.
