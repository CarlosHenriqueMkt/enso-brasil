# Phase 1 — Skeleton & OSS Foundation · SPEC

> Falsifiable requirements that lock WHAT this phase delivers. Implementation decisions ("HOW") are handled by `/gsd-discuss-phase 1` and `/gsd-plan-phase 1`.

**Phase number:** 1
**Phase name:** Skeleton & OSS Foundation
**Status:** SPEC locked
**Ambiguity:** 0.15 (gate ≤ 0.20 ✓)

## Phase Goal

Ship a public, accessible, MIT-licensed Next.js (latest stable 16.x line) skeleton on Vercel — disclaimer + LGPD page render server-side, CI passes on every PR, no data flow yet. The next phase (Data Foundation) plugs into this shell.

## Locked decisions inherited from PROJECT.md

- Next.js latest stable (16.x line) App Router — pin reversed in 01-CONTEXT.md D-13 (original 15.5.x pin existed for next-intl interop, now removed)
- TypeScript strict
- Tailwind v4 (Oxide engine)
- React 19.x
- ESLint + Prettier + Husky pre-commit
- Vitest (unit) + Playwright (e2e smoke)
- GitHub Actions CI
- MIT license, PT-BR README primary
- **PT-BR ONLY** — `next-intl` REMOVED from stack (decision reversed during this SPEC). Translation utilities will live in the ingestion pipeline as a future feature, not in routing.
- All theme tokens, copy strings, and design contracts come from the `sketch-findings-enso-brasil` skill.

## Requirements

### REQ-S1.01 — Public GitHub repo with OSS scaffolding

- **Current state:** Empty local git repo at `enso-brasil/`. No remote pushed yet.
- **Target state:** Repo public on GitHub at `github.com/CarlosHenriqueMkt/enso-brasil`. Files at root: `LICENSE` (MIT), `README.md` (PT-BR primary), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.gitignore` (already exists).
- **Acceptance:** `git clone` of the public URL succeeds for an unauthenticated user; all four files exist and are non-empty; LICENSE contains MIT text with `2026` and the project name.

### REQ-S1.02 — Next.js latest stable (16.x line) App Router scaffolding

- **Current state:** No `package.json`, no `src/app/` directory, no Next.js install.
- **Target state:** `package.json` declares `next@^16` (latest stable), `react@^19`, `react-dom@^19`, `typescript@^5`. `src/app/` directory with `layout.tsx`, `page.tsx`, `not-found.tsx`, `error.tsx`, `loading.tsx`. `next.config.ts` configured with `reactStrictMode: true`, default output (no `standalone`), no `images.domains` yet. Package manager: pnpm. Node 24 LTS pinned (`.nvmrc`, `engines.node >= 24`, `packageManager: pnpm@<latest>`).
- **Acceptance:** `pnpm install` succeeds; `pnpm build` completes without errors; the production build serves `/` and `/privacidade` over `pnpm start` (`next start`).

### REQ-S1.03 — TypeScript strict + path aliases

- **Current state:** No `tsconfig.json`.
- **Target state:** `tsconfig.json` with `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, path alias `@/*` → `src/*`.
- **Acceptance:** `npx tsc --noEmit` returns exit code 0; introducing `let x: any = 1` triggers a lint error.

### REQ-S1.04 — Tailwind v4 + theme tokens from sketch-findings skill

- **Current state:** No Tailwind install, no theme tokens applied to code.
- **Target state:** Tailwind v4 installed. `app/globals.css` contains `@theme` block populated with the token system from `sketch-findings-enso-brasil/references/03-tokens-theme.md` — surfaces, ink, hairlines, INMET-aligned risk colors (5 levels), 8pt spacing scale, system-font stack, radii 2/4/6.
- **Acceptance:** Querying `getComputedStyle(root).getPropertyValue('--color-risk-red-bg')` returns `#fde2e2`; running an HTML page applying `class="bg-surface text-ink-1"` renders with the locked tokens; no external font files are referenced anywhere in the build output.

### REQ-S1.05 — Lint, format, pre-commit hooks

- **Current state:** No ESLint, Prettier, or Husky.
- **Target state:** ESLint with `eslint-config-next` and TS rules. Prettier with project config. Husky pre-commit runs `lint-staged` (eslint --fix + prettier --write) plus a separate `gitleaks protect --staged` step. Same `gitleaks` scan also runs in GitHub Actions CI on every PR (defense in depth — see CONTEXT D-04).
- **Acceptance:** Committing a file with `console.log` triggers ESLint warning (config-driven); committing a file containing `const SECRET_TOKEN = "abc"` is blocked by the pre-commit hook.

### REQ-S1.06 — CI lean pipeline

- **Current state:** No `.github/workflows/`.
- **Target state:** GitHub Actions workflow `ci.yml` running on every PR + push to main. Steps: checkout → setup-node (LTS) → npm ci → typecheck → lint → vitest → playwright smoke (single test that hits `/` and asserts the disclaimer text). Cache enabled. Total runtime budget: < 4 minutes on standard runner.
- **Acceptance:** A PR with `let x: any = 1` introduced fails CI on lint; a PR removing the disclaimer text from the layout fails CI on the Playwright smoke; a clean PR passes all jobs in < 4 minutes.

### REQ-S1.07 — Mandatory disclaimer SSR-rendered with all 3 emergency contacts

- **Current state:** No layout, no disclaimer rendered.
- **Target state:** Root layout (`app/layout.tsx`) renders `<footer>` with the locked disclaimer content from `messages.ts` including: aggregator stance + emergency line "199 Defesa Civil · 193 Bombeiros · 190 Polícia" (each number paired with agency name) + "não substitui sistemas oficiais de alerta". Footer is server-rendered — visible in raw HTML response.
- **Acceptance:** `curl https://localhost:3000/` (or wget without JS) returns HTML containing the literal strings `199`, `Defesa Civil`, `193`, `Bombeiros`, `190`, `Polícia` in the rendered footer; running with JavaScript disabled in the browser still shows the disclaimer.

### REQ-S1.08 — `/privacidade` page in PT-BR draft completo (LGPD)

- **Current state:** No `/privacidade` route.
- **Target state:** Server-rendered page at `/privacidade` with the following sections:
  - O que coletamos (logs de servidor: IP, user-agent, URL, timestamp)
  - Por quanto tempo (retenção: 30 dias para logs operacionais)
  - Para quê (debug, métricas agregadas, segurança)
  - O que NÃO coletamos (cookies de tracking, identificadores cross-site, dados pessoais voluntários)
  - Direitos do titular sob a LGPD (acesso, correção, exclusão, contato)
  - Contato responsável (email + canal alternativo)
  - Versão e data da política
- **Acceptance:** Visiting `/privacidade` renders all 7 sections in PT-BR; the page passes `npx playwright test --grep privacidade` (smoke test verifies headings exist); content is server-rendered (works with JS disabled).

### REQ-S1.09 — Accessibility shell (no axe-core in CI yet)

- **Current state:** No accessibility infrastructure.
- **Target state:** `<html lang="pt-BR">`, `<body>` with skip link to `#main`, focus-visible styles, reduced-motion respect, color-blind safe contract documented (icon + text + color). axe-core install is **deferred to Phase 5** where there's actual UI to test.
- **Acceptance:** Tab from page top reveals a `Pular para o conteúdo principal` skip link; `<html lang>` attribute is `pt-BR`; CSS uses `prefers-reduced-motion` to neutralize transitions.

### REQ-S1.10 — Centralized PT-BR strings module

- **Current state:** No strings module.
- **Target state:** File `src/lib/messages.ts` exporting a `messages` object containing all locked PT-BR strings: edge-state copy (verde, stale, gray), emergency line (full + inline), severity labels (Sem alertas / Atenção / Alerta / Perigo / Dados indisponíveis), disclaimer body. Strings are plain TypeScript constants (NOT `next-intl` catalog) since the project is PT-BR only.
- **Acceptance:** Importing `import { messages } from '@/lib/messages'` and accessing `messages.emergency.inline` returns `"199 Defesa Civil · 193 Bombeiros · 190 Polícia"` verbatim; the file contains no references to locale, intl, or translation libraries.

### REQ-S1.11 — Source-link component with mono-font domain

- **Current state:** No reusable source-link component.
- **Target state:** Component `src/components/SourceLink.tsx` rendering an external link with the human-readable name (regular font) and the domain (mono font) per the locked design contract. Used in `/privacidade` for the "contato responsável" if applicable. Tested via Vitest snapshot.
- **Acceptance:** `<SourceLink href="https://alertas.cemaden.gov.br" name="CEMADEN" />` renders with the domain text wrapped in `<span class="font-mono">`; Vitest snapshot test passes.

## In Scope (this phase ships)

- Public GitHub repo + MIT LICENSE + README (PT-BR) + CONTRIBUTING + CODE_OF_CONDUCT
- Next.js latest stable (16.x line) App Router scaffolding (TS strict, Tailwind v4, React 19, pnpm, Node 24 LTS)
- Theme tokens applied via `@theme` (sketch-findings palette + spacing + radii + system fonts)
- Root layout with SSR disclaimer footer (199/193/190 with agency names)
- `/privacidade` page in PT-BR draft completo
- Accessibility shell (lang attribute, skip link, focus styles, reduced motion)
- ESLint + Prettier + Husky + lint-staged + secret scan
- GitHub Actions CI: typecheck + lint + Vitest + Playwright smoke (1 test)
- `src/lib/messages.ts` strings module (locked PT-BR constants)
- `src/components/SourceLink.tsx` (mono-font domain rendering)

## Out of Scope (explicitly NOT in this phase)

- **Data layer** (Drizzle, Neon, Upstash, ofetch, ingestion endpoint) — Phase 2
- **Risk engine** (`calculateRiskLevel()`, severity types, dedup) — Phase 3
- **Source adapters** (CEMADEN, INMET, INPE/FIRMS) — Phases 4 & 6
- **Dashboard UI** (cards, top legend, map, search, filter, /estado/{uf}, /texto) — Phase 5
- **`next-intl`** — REMOVED from project; PT-BR only; no `/[locale]/...` routes
- **Translation utilities** for foreign-language content — deferred to whenever M5 (NOAA ENSO global status) lands; not in v1
- **axe-core in CI** — deferred to Phase 5 (real UI to test)
- **Lighthouse perf budget in CI** — deferred to Phase 6 (hardening with real content)
- **Plausible analytics** — Phase 7 (launch)
- **OG cards / Twitter cards / share intents** — Phase 5 (dashboard UI introduces share)
- **Production domain (`.com.br` or Vercel custom)** — Phase 7
- **Defesa Civil estadual lookup table** — Phase 5 (used on `/estado/{uf}` aside)
- **Health endpoint `/api/health`** — Phase 6 (after data layer exists)

## Acceptance Criteria (final pass/fail)

Phase 1 is DONE when **every** box checks:

- [ ] `git clone https://github.com/CarlosHenriqueMkt/enso-brasil` works for unauthenticated users
- [ ] `LICENSE`, `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` exist and are non-empty
- [ ] `pnpm install && pnpm build` completes without errors on a fresh clone
- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` (Vitest) exits 0
- [ ] `pnpm playwright test` (smoke) exits 0
- [ ] CI workflow passes on a PR within 4 minutes
- [ ] `curl http://localhost:3000/` HTML body contains "199 Defesa Civil", "193 Bombeiros", "190 Polícia"
- [ ] `curl http://localhost:3000/privacidade` HTML body contains the 7 LGPD sections in PT-BR
- [ ] Browser with JS disabled still shows disclaimer + privacy page content
- [ ] `<html>` element has `lang="pt-BR"` attribute
- [ ] No external font files are referenced in the production build (`grep -r "fonts.googleapis" .next/` returns empty)
- [ ] No reference to `next-intl`, `i18n`, or locale routing in `package.json` or source code
- [ ] Pre-commit hook blocks a commit containing `SECRET_TOKEN="abc123"`
- [ ] Theme tokens render correctly: `body { background: var(--color-bg) }` paints `#fafaf8`

## Ambiguity Report

| Dimension          | Score | Min  | Status |
|--------------------|-------|------|--------|
| Goal Clarity       | 0.90  | 0.75 | ✓     |
| Boundary Clarity   | 0.85  | 0.70 | ✓     |
| Constraint Clarity | 0.85  | 0.65 | ✓     |
| Acceptance Criteria| 0.75  | 0.70 | ✓     |
| **Ambiguity**      | **0.15** | **0.20** | **✓ Gate passed** |

All four dimensions exceed minimums. SPEC.md is locked.

## Decisions made during this SPEC (propagated to other artifacts)

1. **`next-intl` and i18n routing removed from project entirely.** PT-BR only. M12 (ES/EN translation) deleted from roadmap. Translation utilities for ingesting foreign-language content (e.g., NOAA, NASA) become an ingestion-pipeline concern, decided when M5 lands.
2. **`/privacidade` ships PT-BR draft completo in P1**, not a placeholder.
3. **CI in P1 stays lean** (typecheck + lint + Vitest + Playwright smoke); axe-core moves to P5; Lighthouse perf budget moves to P6.

## Next step

`/gsd-discuss-phase 1` — discuss-phase will detect this SPEC.md and focus only on implementation choices (file structure, exact dependency versions, CI workflow YAML structure, etc.).
