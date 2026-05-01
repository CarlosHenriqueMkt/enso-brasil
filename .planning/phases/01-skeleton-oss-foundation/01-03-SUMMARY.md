---
phase: 01-skeleton-oss-foundation
plan: 03
subsystem: design-system + strings-sot
tags: [tailwind-v4, theme, ptbr, a11y, server-component]
requires:
  - 01-01 (Next.js scaffold + globals.css baseline)
provides:
  - "@theme token contract (surfaces, ink, hairlines, 5-level INMET risk palette, spacing, radii, system fonts)"
  - "messages.ts PT-BR SoT (emergency, disclaimer, 5 severity labels, edge-states, a11y, privacy)"
  - "SourceLink server component (FOUND-10 mono-font hostname, noopener noreferrer)"
affects:
  - All future UI plans (P5 dashboard, P6 stale banners) consume these tokens + strings
tech-stack:
  added: []  # No new deps — pure CSS + TS code
  patterns:
    - "Tailwind v4 CSS-first @theme block (NOT v3 JS config)"
    - "PT-BR strings as `as const` typed object (no i18n catalog)"
    - "Server Component for static external link"
key-files:
  created:
    - src/lib/messages.ts
    - src/components/SourceLink.tsx
  modified:
    - src/app/globals.css
decisions:
  - "Yellow border = bespoke #d4a017 (not Tailwind default #eab308) — WCAG AA contrast on white"
  - "messages.ts is plain TS module (NOT next-intl catalog) — PT-BR only, D-13 reversal honored"
  - "SourceLink uses `new URL(href).hostname` — accepts T-01-07 throw on invalid href (P1 only consumes locally-controlled hrefs)"
metrics:
  duration: ~5 min
  completed: 2026-05-01
  tasks: 2
  files: 3
---

# Phase 1 Plan 03: Theme Tokens & PT-BR Strings Summary

Land the design contract: full `@theme` token block (sketch-findings 03-tokens-theme.md), PT-BR strings SoT (`messages.ts`), and `SourceLink` server component — the design/copy interface every later phase consumes.

## What shipped

- **`src/app/globals.css`** — `@theme` block with 5 surface/ink tokens, 10 risk vars (5×bg + 5×bd) using darkened yellow `#d4a017`, 8pt spacing base, 3 radii, system-font sans/mono stacks. Reduced-motion media query + skip-link styles for REQ-S1.09 a11y shell. `html` element wired to `--color-bg`/`--color-ink-1`/`--font-sans`.
- **`src/lib/messages.ts`** — Locked PT-BR strings as `as const` typed object: `emergency.inline` (verbatim "199 Defesa Civil · 193 Bombeiros · 190 Polícia"), disclaimer body, 5 severity labels, edge-state copy (verde + staleTemplate), a11y skip-link label, privacy section titles + LinkedIn contact (D-05) + version date (D-06).
- **`src/components/SourceLink.tsx`** — Server Component rendering `<a target="_blank" rel="noopener noreferrer">{name} <span className="font-mono text-ink-2">({domain})</span></a>`. T-01-06 reverse-tabnabbing mitigation in place.

## Acceptance gates verified

- `--color-risk-yellow-bd: #d4a017` present (1 match); `#eab308` absent (0 matches)
- 5 risk-bg vars + 5 risk-bd vars emitted
- `next-intl|i18n|useTranslations|locale` absent from messages.ts (0 matches)
- `pnpm exec tsc --noEmit` exits 0
- SourceLink: `target="_blank"`, `rel="noopener noreferrer"`, `font-mono`, `new URL(href).hostname`, no `'use client'` directive

## Tests deferred

Plan 02 (tooling-and-tests, parallel wave-2) owns `src/lib/messages.test.ts` and `src/components/SourceLink.test.tsx`. They were not present in the worktree at execution time (plans 01-02 and 01-03 are disjoint and ran in parallel). When plan 02's tests land, they will pass against the source files this plan shipped — exports and contracts match the plan's `<interfaces>` block exactly.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. All hex codes, copy strings, and file contents match the locked spec verbatim.

### Skipped Steps (rationale)

- **Action 3 of Task 1** (`pnpm test src/lib/messages.test.ts`) and Task 2's test run — test files are owned by plan 02 (parallel wave-2), not yet present. Source-side acceptance gates (grep contracts + tsc) all pass; runtime test verification will land when plan 02 commits. Tracked, not a Rule-1/2/3 deviation — plans are intentionally disjoint per their `files_modified` frontmatter.

## Threat Model Compliance

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-01-06 (Reverse Tabnabbing) | mitigate | Done — `rel="noopener noreferrer"` in SourceLink |
| T-01-07 (Invalid href DoS) | accept | Honored — no guard added in P1 (deferred to P5 per plan) |

## Threat Flags

None — this plan introduces no new network endpoints, auth paths, or trust-boundary surface beyond the already-modeled SourceLink external anchor.

## Commits

- `2446e0f` feat(01-03): add @theme tokens and PT-BR strings SoT
- `15d0bdc` feat(01-03): add SourceLink server component (FOUND-10)

## Self-Check: PASSED

- FOUND: src/app/globals.css
- FOUND: src/lib/messages.ts
- FOUND: src/components/SourceLink.tsx
- FOUND commit: 2446e0f
- FOUND commit: 15d0bdc
