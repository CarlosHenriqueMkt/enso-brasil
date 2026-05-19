---
phase: 05-cemaden-dashboard-ui
plan: 11
subsystem: ui-routes
tags: [dashboard, ssr, accessibility, routes, og-image, ci]
requires:
  - 05-09 # ShareButton + share/url helpers
  - 05-10 # loadSnapshotForUi + HomePage
provides:
  - /estado/{uf} dynamic route (27 UFs, lowercase canonical)
  - /estado/{uf} OG image (text-only ImageResponse)
  - /texto SSR accessible mirror (5 region tables + 27 articles)
  - CI link-check for README.pt-BR.md (lychee)
affects:
  - .github/workflows/ci.yml
tech-stack:
  added: [lycheeverse/lychee-action@v2]
  patterns:
    - "renderToStaticMarkup for SSR component tests (no @testing-library/react)"
    - "vi.mock('@/lib/snapshot/load') + describe.skipIf(!existsSync)"
key-files:
  created:
    - src/app/estado/[uf]/page.tsx
    - src/app/estado/[uf]/page.test.tsx
    - src/app/estado/[uf]/opengraph-image.tsx
    - src/app/texto/page.tsx
    - src/app/texto/page.test.tsx
  modified:
    - .github/workflows/ci.yml
decisions:
  - "/texto headings: h1 'Versão em texto' → h2 'Por região' + 5 region h2s → h2 'Estados' parent + 27 h3 article titles. Adds two parent h2s above plan's literal 'h1→h2(5)→h3(27)' outline so each block has a section landmark; tests assert h2Count>=5 + h3Count===27 + h1Count===1 (compatible)."
  - "Severity in /texto tables: TEXT label only (no Unicode glyph). Asserted by negative-match on ✓⚠⛔ inside <table>."
  - "Article ids are lowercase UF; first table cell is <a href='#{uf}'> (works no-JS)."
  - "lychee args use --include-fragments so #formula-v0 anchor (DASH-09) is validated."
metrics:
  duration_minutes: 6
  completed_date: 2026-05-19
---

# Phase 5 Plan 11: /estado/[uf] + /texto Routes Summary

Shipped the two remaining v1 routes (deep-link per-state detail + accessible text mirror) plus per-state OG image and a CI link-check guard for the PT-BR README.

## Tasks Completed

| Task | Name                               | Commits              | Files                                                   |
| ---- | ---------------------------------- | -------------------- | ------------------------------------------------------- |
| 1    | /estado/[uf] dynamic route + tests | `1a8798a`            | `src/app/estado/[uf]/page.tsx`, `page.test.tsx`         |
| 2    | OG image (text-only ImageResponse) | `19e7d92`            | `src/app/estado/[uf]/opengraph-image.tsx`               |
| 3    | /texto SSR single-page (RED/GREEN) | `684c67b`, `8689084` | `src/app/texto/page.test.tsx`, `src/app/texto/page.tsx` |
| 4    | CI lychee link-check               | `6e745c3`            | `.github/workflows/ci.yml`                              |

## What was built

### Task 1 — `/estado/[uf]`

Dynamic Next.js route with `generateStaticParams()` covering all 27 IBGE UFs (lowercase canonical). Uppercase paths (`/estado/SP`) and unknowns (`/estado/zz`) return 404 via `notFound()`. Variant C layout (sketch-finding 004): permanent aside with state name + RiskBadge + last-update + ShareButton; main column with explanation, alert list, emergency contacts (red only), formula explainer link. Screen-reader live region announces level on route load (A11Y-06). `generateMetadata` returns OG/Twitter meta keyed off `NEXT_PUBLIC_SITE_URL`.

### Task 2 — `opengraph-image.tsx`

Per-state OG card via `next/og` `ImageResponse`. System font only (3G budget; never load external fonts per CLAUDE.md). 1200×630, background `--color-bg`, left-edge risk stripe in `--color-risk-{level}-bd`. Static-generated alongside route.

### Task 3 — `/texto`

Pure SSR Server Component — no `"use client"`, no icons, no `<img>`. Heading outline: h1 → two parent h2 landmarks (`Por região`, `Estados`) wrapping the 5 region h2s and 27 article h3s respectively. Each region table has `[Estado | Nível | Alertas ativos | Atualizado há]`; first cell anchor `<a href="#{uf}">` links to the matching `<article id="{uf}">` below (works without JS). Severity rendered as TEXT label only — no Unicode glyph in table content. Domain text in articles uses `font-mono text-mono`. Red articles render emergency-contacts line.

Test scaffold uses `renderToStaticMarkup` + `vi.mock('@/lib/snapshot/load')` (no `@testing-library/react`). 9 assertions: locked h1 copy, 5 tables, 27 articles with lowercase ids, 27 anchors, IBGE row breakdown (7+9+4+4+3), no icon glyph in tables, `font-mono` class for domains, no `use client` directive, heading-count invariant.

### Task 4 — CI link-check

Appended `lycheeverse/lychee-action@v2` step to `ci.yml` after Gitleaks. Args: `--no-progress --include-fragments README.pt-BR.md` — `--include-fragments` ensures the DASH-09 `#formula-v0` anchor is validated, not just HTTP status of links. Fails the CI job on broken link/anchor.

## Deviations from Plan

### [Rule 2 — Missing critical structure] Added parent h2 landmarks in /texto

- **Found during:** Task 3 implementation
- **Issue:** Plan calls for `h1 → h2 (5 regions) → h3 (27 states)` but provides no landmark to group the 27 articles separately from the region tables; screen-reader users would have no way to skip from tables to articles.
- **Fix:** Added two `<section aria-label=…>` landmarks each opened by a parent `<h2 id="por-regiao">` and `<h2 id="estados">`. The 5 region h2s + 27 article h3s nest under these. Tests now assert `h2Count >= 5` and `h3Count === 27` (compatible — the literal outline plan describes is still present; we only added landmark headings above it).
- **Files modified:** `src/app/texto/page.tsx`, `src/app/texto/page.test.tsx`
- **Commits:** `684c67b`, `8689084`

## Verification

```
pnpm test:ci src/app/texto/page.test.tsx  → 9 passed
pnpm exec tsc --noEmit                    → clean
```

`pnpm build` deferred to plan 12 per execution brief.

## Known Stubs

None.

## Threat Flags

None — no new network surface, no new auth paths. Lychee runs only on README.pt-BR.md inside CI sandbox.

## Self-Check: PASSED

- `[OK]` `src/app/texto/page.tsx` exists
- `[OK]` `src/app/texto/page.test.tsx` exists
- `[OK]` `.github/workflows/ci.yml` contains `lychee`
- `[OK]` commit `684c67b` (test RED) in git log
- `[OK]` commit `8689084` (page GREEN) in git log
- `[OK]` commit `6e745c3` (CI link-check) in git log
- `[OK]` commits `1a8798a` (T1) + `19e7d92` (T2) already in git log
