---
phase: 05-cemaden-dashboard-ui
plan: 09
subsystem: ui/components
tags: [dashboard, components, share, filter, card, server-components, a11y, ptbr]
requires:
  - 05-07 (PATTERNS, UI-SPEC, CONTEXT — design contracts)
  - lib/share/url (task 1, this plan)
  - lib/messages (PT-BR copy)
  - lib/time/format (formatRelativePtBr)
  - lib/geo/regions (REGION_SLUGS)
  - lib/api/schemas (StateSnapshot)
  - components/badge/RiskBadge
provides:
  - components/share/ShareButton (FIRST "use client" — leaf only)
  - components/filters/RegionFilter (RSC, zero JS)
  - components/cards/StateCard (RSC)
  - lib/share/url (buildShareText + buildWaMeHref)
  - globals.css @media (scripting: none) rule for .share-clipboard
affects:
  - src/app/page.tsx (consumer in plan 05-10)
tech-stack:
  added: []
  patterns:
    - 'FIRST ''"use client"'' leaf in repo (ShareButton)'
    - "CSS-driven progressive enhancement (@media (scripting: none)) — avoids React 19 set-state-in-effect lint"
    - "renderToStaticMarkup + dynamic import test idiom (no @testing-library)"
key-files:
  created:
    - src/lib/share/url.ts
    - src/lib/share/url.test.ts
    - src/components/share/ShareButton.tsx
    - src/components/share/ShareButton.test.tsx
    - src/components/filters/RegionFilter.tsx
    - src/components/filters/RegionFilter.test.tsx
    - src/components/cards/StateCard.tsx
    - src/components/cards/StateCard.test.tsx
  modified:
    - src/app/globals.css
decisions:
  - "Mapped plan field names (level/explanation/updatedAt/alerts) to actual StateSnapshot schema (risk/riskReason/lastSuccessfulFetch/alertCount) — schema is the locked SoT from P2; per-alert SourceLink loop deferred until schema gains an alerts array."
  - "RegionFilter uses next/link (not raw <a>) to satisfy @next/next/no-html-link-for-pages; still renders <a> + prefetch=false, preserving zero-JS contract."
  - "UF→PT-BR name map is local to StateCard; promote to src/lib/geo/state-names.ts when a second consumer appears."
metrics:
  duration_minutes: ~25
  completed_date: 2026-05-19
---

# Phase 5 Plan 09: cards-filter-share Summary

JWT-free, public, zero-JS-capable dashboard primitives — share-URL composition (`buildShareText` + `buildWaMeHref`), the FIRST `"use client"` leaf (`ShareButton`), a zero-JS region filter (anchor chips with `aria-current="page"`), and the composing `StateCard` — all wired with locked PT-BR copy and INMET-aligned risk tokens.

## Tasks Completed

| #   | Task              | Files                                                   | Commit                                          |
| --- | ----------------- | ------------------------------------------------------- | ----------------------------------------------- |
| 1   | share/url helpers | `src/lib/share/url.ts` + `.test.ts`                     | `35eebdc` (initial), `7ffc556` (helpers refine) |
| 2   | ShareButton       | `src/components/share/ShareButton.tsx` + `.test.tsx`    | `bf4ccbc`                                       |
| 3   | RegionFilter      | `src/components/filters/RegionFilter.tsx` + `.test.tsx` | `645eda7`                                       |
| 3b  | CSS no-JS guard   | `src/app/globals.css` (`@media (scripting: none)`)      | `5c0acd2`                                       |
| 4   | StateCard         | `src/components/cards/StateCard.tsx` + `.test.tsx`      | `12a8067`                                       |

## Verification

- `pnpm test:ci src/components/filters/` → **6/6 pass**.
- `pnpm test:ci src/components/cards/` → **11/11 pass**.
- `pnpm exec eslint src/components/` → **clean** (no errors, no warnings).
- `grep -E '^"use client"' src/components/` → **exactly one match** (`ShareButton.tsx`).
- Tasks 1+2 verified previously (commits noted above).

## Deviations from Plan

### Rule 1 — Plan-vs-schema field-name mismatch (StateCard, Task 4)

- **Found during:** Task 4 implementation.
- **Issue:** PLAN.md task 4 spec references `snapshot.level`, `snapshot.explanation`, `snapshot.updatedAt`, and an `snapshot.alerts` array. The actual `StateSnapshot` (locked in P2, `src/lib/api/schemas.ts`) has `{ uf, risk, riskReason, alertCount, lastSuccessfulFetch, formulaVersion }`. No `stateName` field; no `alerts` array.
- **Fix:** Mapped at the component boundary:
  - `level` → `risk`
  - `explanation` → `riskReason`
  - `updatedAt` → `lastSuccessfulFetch` (nullable — guarded with the `over_day` fallback string)
  - `stateName` → derived via a local 27-UF PT-BR name map (`UF_NAME_PT`)
  - `alerts` per-item `<SourceLink>` loop → **omitted** (snapshot has only `alertCount`, no per-alert detail). A future plan will revisit when the schema is extended.
- **Files modified:** `src/components/cards/StateCard.tsx`, `src/components/cards/StateCard.test.tsx`.
- **Commit:** `12a8067`.

### Rule 3 — RegionFilter raw `<a>` → `next/link` (Task 3)

- **Found during:** Task 3 ESLint check.
- **Issue:** `@next/next/no-html-link-for-pages` errored on `<a href="/">`.
- **Fix:** Switched to `<Link prefetch={false}>` from `next/link`. Renders `<a>` in the DOM, preserves zero-JS contract (anchor navigation works without hydration), prefetch disabled to honor the "no client JS" intent.
- **Test follow-up:** Loosened attribute-order regexes (`href` and `aria-current` may appear in any order under `next/link`); used lookahead-style matchers.
- **Files modified:** `src/components/filters/RegionFilter.tsx`, `src/components/filters/RegionFilter.test.tsx`.
- **Commit:** `645eda7`.

## Known Stubs

- **`StateCard` does not render a per-alert list.** It surfaces `alertCount` implicitly via `riskReason` copy and shows the locked empty-state strings for `green` / `unknown`. The plan's task-4 item 5 (alert list with `<SourceLink>` per alert + relative timestamp per alert) is deferred — the schema currently exposes only `alertCount`. Plan 10 (home page consumer) is unaffected; when the snapshot schema gains an `alerts: AlertItem[]` field, extend `StateCard` here.

## Deferred Issues (out of scope — pre-existing)

- `src/app/api/ingest/route.test.ts` integration tests fail in the local environment (Upstash / DB integration). Last touched in Phase 2 commit `4e5fcf5`. Untouched by this plan. Should be addressed in a dedicated infra/test plan.

## Threat Model Touchpoints

- **T-05-15 (share text injection):** mitigated in `src/lib/share/url.ts` via `String(input)` + control-char/`<`/`>` rejection + `encodeURIComponent`. Unchanged this session.
- **T-05-16 (`?region=` injection):** `RegionFilter` only emits hrefs derived from `REGION_SLUGS` (closed set of 5 PT-BR slugs). Consumer (plan 10) must validate inbound `?region=` against `REGION_FROM_SLUG` before passing it back as `active`.
- **T-05-17 (active chip tampering):** `aria-current="page"` is derived only from the server-validated `active` prop; never from client state.

## Self-Check: PASSED

- `src/components/filters/RegionFilter.tsx` — FOUND
- `src/components/filters/RegionFilter.test.tsx` — FOUND
- `src/components/cards/StateCard.tsx` — FOUND
- `src/components/cards/StateCard.test.tsx` — FOUND
- `src/app/globals.css` modification — FOUND (`@media (scripting: none) { .share-clipboard { display: none } }`)
- Commits `35eebdc`, `7ffc556`, `bf4ccbc`, `645eda7`, `5c0acd2`, `12a8067` — present in `git log`.
- ESLint `src/components/` clean.
- `RegionFilter` + `StateCard` test suites green (17/17 combined).
- Exactly one `"use client"` directive across `src/components/`.
