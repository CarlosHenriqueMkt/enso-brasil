---
phase: 01-skeleton-oss-foundation
plan: 01
subsystem: scaffold
tags: [scaffold, nextjs-16, typescript-strict, tailwind-v4, pnpm]
requires: []
provides:
  - "Next.js 16 App Router scaffold (src/app/*)"
  - "TS strict + path alias @/* -> src/*"
  - "Tailwind v4 PostCSS pipeline (no theme yet)"
  - "pnpm workspace with Node 24 pin"
affects: []
tech-stack:
  added:
    - "next@16.2.4"
    - "react@19.2.5 + react-dom@19.2.5"
    - "typescript@5.9.3"
    - "tailwindcss@4.2.4 + @tailwindcss/postcss@4.2.4"
    - "eslint@9.39.4 + eslint-config-next@16.2.4 + @eslint/eslintrc@3"
    - "@types/node@22, @types/react@19, @types/react-dom@19"
  patterns:
    - "App Router (src/app), all RSC except error boundary (mandatory client)"
    - "ESLint flat config via FlatCompat shim for next/core-web-vitals + next/typescript"
    - "PostCSS-only Tailwind v4 (no JS config file; @theme block lands in plan 03)"
key-files:
  created:
    - package.json
    - pnpm-lock.yaml
    - tsconfig.json
    - next.config.ts
    - postcss.config.mjs
    - eslint.config.mjs
    - .nvmrc
    - .env.example
    - next-env.d.ts
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/app/not-found.tsx
    - src/app/error.tsx
    - src/app/loading.tsx
    - src/app/globals.css
  modified:
    - .gitignore
decisions:
  - "Pin eslint to ^9 (not ^10 as plan stated): eslint-config-next@16.2.4 transitive deps (eslint-plugin-import/react/jsx-a11y) cap eslint at <=9. Plan target was aspirational; market reality forced ^9. ESLint 10 can be revisited when next-config-next ships v17."
  - "typedRoutes lives at top level of next.config.ts (not under experimental.) — Next 16 deprecation."
  - "next-env.d.ts committed (Next standard) — does not violate any plan constraint."
  - "Skipped create-next-app and wrote files directly: dir non-empty (.planning/, CLAUDE.md, etc.) made CNA scaffolding into a temp dir + copy more error-prone than direct authoring; output is identical to a stripped CNA result."
metrics:
  duration: ~12 min wall (most spent on pnpm cold install)
  tasks_completed: 1/1
  files_created: 15
  files_modified: 1
  completed: 2026-05-01
---

# Phase 1 Plan 01: Scaffold Next 16 + TS strict + Tailwind v4 + pnpm Summary

**One-liner:** Bootstrap Next.js 16 App Router with strict TypeScript, Tailwind v4 PostCSS pipeline, pnpm + Node 24 pinning, and PT-BR App Router stubs (no theme, no disclaimer, no tooling — those land in plans 02/03/05).

## What was built

- **Build pipeline:** `pnpm install` → `pnpm exec tsc --noEmit` → `pnpm build` all exit 0.
- **App Router shell:** `src/app/{layout,page,not-found,error,loading}.tsx` — minimal PT-BR stubs. `<html lang="pt-BR">` set on root layout per REQ-S1.09. Only `error.tsx` is a client component (Next requirement).
- **TS contract:** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, path alias `@/* -> ./src/*`, Next plugin wired.
- **Tailwind v4 pipeline:** `postcss.config.mjs` uses `@tailwindcss/postcss` (NOT the legacy `tailwindcss: {}` form — Pitfall 1 avoided). `globals.css` has only `@import "tailwindcss";` — `@theme` block intentionally deferred to plan 03.
- **Pin file:** `.nvmrc=24`, `engines.node>=24`, `packageManager=pnpm@10.28.0`.
- **No banned deps:** verified zero references to next-intl, lingui, react-i18next, `/[locale]/`, fonts.googleapis, next/font/google.
- **next.config.ts:** `reactStrictMode: true`, `poweredByHeader: false`, `typedRoutes: true` (top-level — Next 16 moved it out of `experimental`).

## Decisions Made

See frontmatter `decisions`. Key: **eslint locked to ^9** (eslint-config-next@16 peer-dep cap), **typedRoutes at top level** (Next 16 API change), **direct authoring instead of create-next-app** (existing non-empty repo).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adjust eslint version from ^10 to ^9**
- **Found during:** Task 1 first install
- **Issue:** Plan specified `eslint ^10`, but `eslint-config-next@16.2.4` transitively requires `eslint-plugin-import/react/jsx-a11y`, all of which cap eslint at `<=9`. Install produced 4 unmet peer dep warnings.
- **Fix:** Locked `eslint` to `^9` and added `@eslint/eslintrc ^3` (FlatCompat dep). Clean second install showed zero peer warnings.
- **Files modified:** package.json
- **Commit:** 523d04c

**2. [Rule 1 - Bug] `experimental.typedRoutes` deprecated in Next 16**
- **Found during:** Task 1 first build
- **Issue:** Build emitted warning: "experimental.typedRoutes has been moved to typedRoutes". Plan code snippet (and D-12) used the old location.
- **Fix:** Hoisted `typedRoutes: true` to top-level NextConfig, removed `experimental` block.
- **Files modified:** next.config.ts
- **Commit:** 523d04c

**3. [Rule 2 - Hygiene] Add `*.tsbuildinfo` to .gitignore**
- **Found during:** Task 1 post-build
- **Issue:** First build wrote `tsconfig.tsbuildinfo` into repo root; not ignored.
- **Fix:** Appended `*.tsbuildinfo` + `tsconfig.tsbuildinfo` patterns to `.gitignore`.
- **Files modified:** .gitignore
- **Commit:** 523d04c

**4. [Rule 1 - Environmental] First install left next bin missing**
- **Found during:** Task 1 first install
- **Issue:** Initial `pnpm install` produced "Failed to create bin at .../next.EXE: ENOENT" warnings; `node_modules/next/dist/bin/` was empty in the public tree even though present in `.pnpm` store. Likely a transient pnpm/Windows symlink hiccup.
- **Fix:** `rm -rf node_modules pnpm-lock.yaml && pnpm install` — clean reinstall produced bins correctly.
- **Files modified:** none (regenerated lockfile)
- **Commit:** 523d04c (lockfile from clean install)

### Tooling note

Skipped `pnpm dlx create-next-app` — directory already contained `.planning/`, `CLAUDE.md`, `.gitignore`, etc., so CNA would have refused. Plan suggested falling back to "scaffold to a temp dir and copy"; chose direct file authoring instead because the resulting files are identical to a stripped CNA scaffold and the trim/strip cycle had higher error surface than just writing the small set directly. This is captured here for transparency.

## Authentication Gates

None — fully autonomous local install.

## Acceptance Criteria — Verified

| Criterion | Result |
|---|---|
| `next` pinned to ^16 | next@16.2.4 installed |
| `engines.node` matches `>=24` | yes |
| `packageManager` starts with `pnpm@` | `pnpm@10.28.0` |
| `.nvmrc` === `24` | yes |
| `tsconfig.json` strict + noUncheckedIndexedAccess | yes |
| `tsconfig.json` paths `@/*` → `["./src/*"]` | yes (Next added `.next/dev/types/**/*.ts` to include — kept) |
| postcss uses `@tailwindcss/postcss` (not `tailwindcss:`) | yes |
| `reactStrictMode: true` + `poweredByHeader: false` | yes |
| `lang="pt-BR"` on root html | yes |
| `src/app/page.tsx` is RSC (no `'use client'`) | yes |
| No next-intl / lingui / react-i18next / `/[locale]/` | grep clean |
| No fonts.googleapis / next/font/google | grep clean |
| `pnpm exec tsc --noEmit` exit 0 | yes |
| `pnpm build` exit 0 | yes (clean — no warnings after typedRoutes fix) |
| `pnpm-lock.yaml` exists | yes |

## Threat Flags

None. T-01-01 (boilerplate strip) auto-mitigated by direct authoring (never imported CNA boilerplate). T-01-02 (.env.example) wrote header comment only, no secrets. T-01-03 (npm chain) accepted per plan disposition.

## Known Stubs

- `src/app/page.tsx` is intentionally a placeholder (real dashboard is Phase 5).
- `src/app/layout.tsx` body has no disclaimer footer yet (lands in plan 05 per D-12 deferral).
- `src/app/globals.css` has no `@theme` block yet (lands in plan 03).

All three are documented in the plan as expected boundaries — not regressions.

## Self-Check: PASSED

Files verified to exist:
- FOUND: package.json, tsconfig.json, next.config.ts, postcss.config.mjs, eslint.config.mjs, .nvmrc, .env.example, pnpm-lock.yaml, next-env.d.ts
- FOUND: src/app/layout.tsx, src/app/page.tsx, src/app/not-found.tsx, src/app/error.tsx, src/app/loading.tsx, src/app/globals.css

Commit verified:
- FOUND: 523d04c
