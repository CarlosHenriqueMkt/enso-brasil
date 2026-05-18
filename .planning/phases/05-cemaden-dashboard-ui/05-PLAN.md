---
phase: 05-cemaden-dashboard-ui
type: index
plan_count: 12
wave_count: 5
generated: 2026-05-18
---

# Phase 5 — Plan Index

CEMADEN adapter carry-over + INMET P5.1 schema-drift fix + full public dashboard surface (home, /estado, /texto, region filter, share, axe + LHCI verification). 17 requirements (ADAPT-01 + ADAPT-02 fix + DASH-01..10 + A11Y-01..06).

## Wave Structure

| Wave | Plans                      | Autonomous                                              | Notes                                                                                                          |
| ---- | -------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 0    | 05-01, 05-02               | 01 has 1 checkpoint (package legitimacy); 02 autonomous | Prep + spike + locks                                                                                           |
| 1    | 05-03, 05-05               | both autonomous                                         | Parallel: CEMADEN adapter source + INMET schema drift fix (zero file overlap)                                  |
| 2    | 05-04, 05-07, 05-08, 05-09 | all autonomous                                          | CEMADEN tests + theme/primitives + map subsystem + cards/filter/share — all parallel (file ownership disjoint) |
| 3    | 05-06, 05-10, 05-11        | all autonomous                                          | Registry wire-up + home route + state/texto routes (consume Wave 2 primitives)                                 |
| 4    | 05-12                      | 1 human checkpoint (Vercel preview smoke)               | a11y + perf gate + sign-off                                                                                    |

## Plans

| Plan                                                                               | Wave | Files                                                                                             | Verification                                                            |
| ---------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [05-01-wave0-deps-and-spike-PLAN.md](05-01-wave0-deps-and-spike-PLAN.md)           | 0    | package.json + lockfile + spike-results.md                                                        | `pnpm install --frozen-lockfile && pnpm exec tsc --noEmit`              |
| [05-02-wave0-prep-locks-PLAN.md](05-02-wave0-prep-locks-PLAN.md)                   | 0    | schema.ts (+deslizamento), messages.ts, README.pt-BR.md, CONTEXT-corrections.md (D-04 rewrite)    | `pnpm test:ci src/lib/sources/schema.test.ts`                           |
| [05-03-cemaden-adapter-PLAN.md](05-03-cemaden-adapter-PLAN.md)                     | 1    | cemaden.ts + cemaden.schema.ts + risk/sources/cemaden.ts                                          | `pnpm exec tsc --noEmit && pnpm exec eslint src/lib/sources/cemaden.ts` |
| [05-04-cemaden-tests-and-fixture-PLAN.md](05-04-cemaden-tests-and-fixture-PLAN.md) | 2    | cemaden.test.ts + cemaden.contract.test.ts + fixture + refresh-cemaden.ts                         | `pnpm test:coverage tests/sources/cemaden.test.ts` (100/100/100/100)    |
| [05-05-inmet-p51-schema-drift-PLAN.md](05-05-inmet-p51-schema-drift-PLAN.md)       | 1    | inmet.schema.ts (envelope) + inmet.ts (flatten) + refreshed fixture                               | `pnpm test:ci tests/sources/inmet*`                                     |
| [05-06-registry-and-isolation-PLAN.md](05-06-registry-and-isolation-PLAN.md)       | 3    | registry.ts + registry-meta.ts (+stability) + cross-source-isolation.test.ts                      | `pnpm test:ci src/lib/sources/registry.test.ts`                         |
| [05-07-theme-and-primitives-PLAN.md](05-07-theme-and-primitives-PLAN.md)           | 2    | globals.css + messages.ts (+severity/share copy) + time/format.ts + RiskBadge + StaleSourceBanner | `pnpm test:coverage src/lib/time/format.test.ts`                        |
| [05-08-map-and-geo-PLAN.md](05-08-map-and-geo-PLAN.md)                             | 2    | geo/br-atlas.ts + geo/regions.ts + components/map/{BrazilMap,StateShape}                          | `pnpm test:ci src/components/map/ && pnpm build`                        |
| [05-09-cards-filter-share-PLAN.md](05-09-cards-filter-share-PLAN.md)               | 2    | components/{cards,filters,share} + lib/share/url.ts                                               | `pnpm test:ci src/components/{cards,filters,share}`                     |
| [05-10-home-route-PLAN.md](05-10-home-route-PLAN.md)                               | 3    | app/page.tsx + snapshot/load.ts                                                                   | `pnpm build && curl /` → 27 cards                                       |
| [05-11-state-and-texto-routes-PLAN.md](05-11-state-and-texto-routes-PLAN.md)       | 3    | app/estado/[uf]/page.tsx + opengraph-image.tsx + app/texto/page.tsx                               | `pnpm build` generates 27 static pages + /texto + OG images             |
| [05-12-a11y-perf-verification-PLAN.md](05-12-a11y-perf-verification-PLAN.md)       | 4    | e2e/a11y.spec.ts + keyboard-nav.spec.ts + .lighthouserc.json + CI workflow                        | `pnpm test:e2e && pnpm exec lhci autorun` + human checkpoint            |

## Dependency Graph

```
Wave 0:    [01] ──> [02]
                     │
Wave 1:              ├──> [03] (CEMADEN adapter)
                     └──> [05] (INMET P5.1)
                          │
Wave 2:    [01]──> [07] (theme)──┐
            │       │             │
            ├────> [08] (map)─────┤
            │       │             │
            ├────> [09] (cards)───┤
                                  │
           [03]──> [04] (CEMADEN tests)
                                  │
Wave 3:    [04]+[05] ──> [06] (registry wire)
           [07]+[08]+[09] ──> [10] (home /)
                          ──> [11] (/estado + /texto)
                                  │
Wave 4:    [06]+[10]+[11] ──> [12] (a11y + LHCI + checkpoint)
```

## File Ownership (no overlap within same wave)

- **Wave 1:** plan 03 owns `src/lib/sources/cemaden*` + `src/lib/risk/sources/cemaden.ts`; plan 05 owns `src/lib/sources/inmet*`. Zero overlap.
- **Wave 2:** plan 04 owns `tests/sources/cemaden*` + `scripts/refresh-cemaden.ts` + fixture; plan 07 owns `globals.css` + `time/` + `components/badge` + `components/staleness`; plan 08 owns `lib/geo/` + `components/map/`; plan 09 owns `components/cards` + `components/filters` + `components/share` + `lib/share/`. Disjoint.
  - `messages.ts` is touched by plans 02 + 07. They run in different waves (0 vs 2) — no conflict.
  - `package.json` is touched by plans 01 + 04 + 12 — different waves.
- **Wave 3:** plan 06 owns registry/contract; plan 10 owns `app/page.tsx` + `lib/snapshot/`; plan 11 owns `app/estado/` + `app/texto/`. Disjoint.

## Source Coverage Audit (mandatory)

**GOAL coverage (ROADMAP Phase 5 success criteria 6/6):**

- ✓ #1 CEMADEN adapter ships → plans 03+04+06
- ✓ #2 Home `/` renders 27 states via Upstash snapshot → plan 10
- ✓ #3 `/estado/{uf}` + OG cards → plan 11
- ✓ #4 Mobile 360px + region filter → plans 09+10
- ✓ #5 `/texto` SSR no-JS → plan 11
- ✓ #6 axe-core + Lighthouse 3G → plan 12

**REQ coverage (17 reqs):**

- ✓ ADAPT-01 → 03+04+06
- ✓ ADAPT-02 (fix) → 05
- ✓ DASH-01 (home overview) → 10
- ✓ DASH-02 (map) → 08+10
- ✓ DASH-03 (mobile) → 10
- ✓ DASH-04 (per-state) → 11
- ✓ DASH-05 (badge labels) → 07
- ✓ DASH-06 (yellow contrast) → 07
- ✓ DASH-07 (region filter) → 09+10
- ✓ DASH-08 (share) → 09+11
- ✓ DASH-09 (formula explainer) → 02+11
- ✓ DASH-10 (timestamp, source attribution) → 07+09
- ✓ A11Y-01 (axe-core CI) → 12
- ✓ A11Y-02 (keyboard nav) → 08+12
- ✓ A11Y-03 (/texto) → 11
- ✓ A11Y-04 (color-blind) → 07+12
- ✓ A11Y-05 (Lighthouse 3G) → 12
- ✓ A11Y-06 (live region) → 11+12

**CONTEXT D-01..D-11 coverage:**

- D-01 (DevTools capture) → done pre-plan (capture file committed `2390be4`)
- D-02 (adapter instability marker) → 03+06
- D-03 (no per-UF fan-out) → 03 (single GET)
- D-04 (timestamp handling) → **REWRITTEN in 02** + 03 + 07 (format.ts) per RESEARCH §B6 evidence (CEMADEN serves UTC, not BRT)
- D-05 (full SSR navigation) → 08+10
- D-06 (no client useState on home) → 10
- D-07 (/texto shape) → 11
- D-08 (semantic HTML on /texto) → 11
- D-09 (share dual transport) → 09
- D-10 (URL-param filter) → 09+10
- D-11 (no geo-default) → 10 (silent ignore of invalid region)

**RESEARCH open questions:**

- Q1 (deslizamento hazard) → 02 (added to HAZARD_KINDS)
- Q2 (RSM SSR under React 19) → 01 (spike) + 08 (pivot branch documented)
- Q3 (br-atlas npm vs vendor) → 01 (spike ADR)
- Q4 (#formula-v0 anchor) → 02
- Q5 (timestamp normalization location) → 03 (adapter outputs ISO-Z) + 07 (format.ts converts at presentation)

**No gaps. No deferred-idea leakage.** Hover tooltip (Claude discretion) → CSS-only `<title>` element in plan 08. Component layout (Claude discretion) → matches `SourceLink` convention (single .tsx + co-located .test.tsx) across plans 07/08/09.

## Threat Model Highlights (per-plan threat tables)

- T-05-01 (supply chain): plan 01 blocking checkpoint for [ASSUMED] packages
- T-05-04, T-05-15, T-05-18, T-05-20 (injection): UF/region/share inputs validated server-side
- T-05-10 (DoS via slow CEMADEN): Promise.allSettled isolation verified by plan 06
- T-05-23/24 (a11y/perf regression): CI gates in plan 12

## Verification Gate

`pnpm test:ci && pnpm test:coverage && pnpm test:e2e && pnpm exec lhci autorun && pnpm build` — all green before `/gsd-verify-work`.
