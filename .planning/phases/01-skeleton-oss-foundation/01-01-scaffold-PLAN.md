---
phase: 01-skeleton-oss-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - pnpm-lock.yaml
  - tsconfig.json
  - next.config.ts
  - postcss.config.mjs
  - eslint.config.mjs
  - .nvmrc
  - .env.example
  - .gitignore
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/app/not-found.tsx
  - src/app/error.tsx
  - src/app/loading.tsx
  - src/app/globals.css
autonomous: true
requirements:
  - FOUND-02
  - FOUND-07
user_setup:
  - service: nodejs
    why: "Build/runtime needs Node 24 LTS"
    env_vars: []
    dashboard_config:
      - task: "Install Node 24 LTS via nvm/volta/winget if not present"
        location: "local machine"
  - service: pnpm
    why: "Package manager (D-02)"
    env_vars: []
    dashboard_config:
      - task: "Run `corepack enable && corepack prepare pnpm@latest --activate` if pnpm missing"
        location: "local machine"

must_haves:
  truths:
    - "Fresh `pnpm install` then `pnpm build` completes without errors"
    - "TypeScript strict compiles with zero errors (`pnpm exec tsc --noEmit` exits 0)"
    - '`<html lang="pt-BR">` is the rendered root element'
    - "Path alias `@/*` resolves to `src/*`"
    - "next.config.ts uses `reactStrictMode: true` and `poweredByHeader: false`"
  artifacts:
    - path: "package.json"
      provides: "Pinned deps (next ^16, react ^19, typescript ^5, tailwindcss ^4) + Node 24 engines + pnpm packageManager"
      contains: '"next": "^16'
    - path: "tsconfig.json"
      provides: "TS strict + noUncheckedIndexedAccess + path alias @/*"
      contains: '"strict": true'
    - path: "next.config.ts"
      provides: "Minimal Next 16 config per D-12"
    - path: "src/app/layout.tsx"
      provides: "Root layout with lang='pt-BR' (placeholder body — disclaimer wired in plan 05)"
    - path: "src/app/page.tsx"
      provides: "Placeholder home page (real content in P5)"
    - path: ".nvmrc"
      provides: "Node 24 pin"
      contains: "24"
  key_links:
    - from: "package.json"
      to: ".nvmrc + engines.node"
      via: "Node version pin"
      pattern: "\"node\":\\s*\">=\\s*24\""
    - from: "tsconfig.json"
      to: "src/*"
      via: "paths alias"
      pattern: "\"@/\\*\":\\s*\\[\"\\./src/\\*\"\\]"
---

<objective>
Bootstrap the Next.js 16 + TypeScript strict + Tailwind v4 + pnpm scaffold per D-01, D-02, D-12, D-13. Produces the empty App Router shell that all other plans extend.

Purpose: Single foundation install — every other plan in this wave attaches to this scaffold. Doing scaffold-only here keeps blast radius contained and lets W2 plans run in parallel.
Output: package.json + lockfile + tsconfig + next.config + postcss + eslint flat config + src/app/\* RSC stubs + globals.css (tailwind import only — `@theme` block lands in plan 03) + .nvmrc + .env.example + .gitignore.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/01-skeleton-oss-foundation/01-SPEC.md
@.planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md
@.planning/phases/01-skeleton-oss-foundation/01-RESEARCH.md

<interfaces>
Verified npm versions (RESEARCH §Standard Stack, 2026-04-30):
- next ^16 (latest 16.2.4) · react ^19 (19.2.5) · react-dom ^19 (19.2.5)
- typescript ^5 (5.9.x) · tailwindcss ^4 (4.2.4) · @tailwindcss/postcss ^4 (4.2.4)
- eslint ^10 (10.2.1) · eslint-config-next ^16 (16.2.4)

Locked decisions used here:

- D-01: flat root, src/{app,components,lib}
- D-02: pnpm, Node 24 LTS, packageManager field
- D-12: minimal next.config.ts (reactStrictMode, poweredByHeader: false, experimental.typedRoutes: true)
- D-13: Next 16.x line (15.5.x reversal — next-intl is GONE, do not add it)

Anti-patterns (RESEARCH §Anti-Patterns) — must NOT appear:

- `tailwind.config.js` JS config file (use `@theme` in CSS instead, plan 03)
- `tailwindcss: {}` PostCSS plugin (use `@tailwindcss/postcss: {}`)
- `output: 'standalone'` (deferred to P6)
- Any reference to next-intl, i18n, lingui, react-i18next, /[locale]/ routes
- External font imports (next/font/google, fonts.googleapis)
  </interfaces>
  </context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Scaffold Next.js 16 + TS strict + Tailwind v4 base</name>
  <read_first>
    - .planning/phases/01-skeleton-oss-foundation/01-SPEC.md (REQ-S1.02, REQ-S1.03)
    - .planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md (D-01, D-02, D-12, D-13)
    - .planning/phases/01-skeleton-oss-foundation/01-RESEARCH.md (Standard Stack, Patterns 1-2, Code Examples)
  </read_first>
  <files>package.json, pnpm-lock.yaml, tsconfig.json, next.config.ts, postcss.config.mjs, eslint.config.mjs, .nvmrc, .env.example, .gitignore, src/app/layout.tsx, src/app/page.tsx, src/app/not-found.tsx, src/app/error.tsx, src/app/loading.tsx, src/app/globals.css</files>
  <action>
    Run create-next-app to generate the scaffold, then trim and lock per D-01/D-02/D-12. EXACT commands:

    1. From repo root run:
       ```
       pnpm dlx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --turbopack --no-git
       ```
       (Use `.` to install in current dir. `--no-git` because the repo already has git. If create-next-app refuses non-empty dir, scaffold to a temp dir and copy files in.)

    2. Edit `package.json` to add EXACTLY these fields (per D-02, D-13):
       ```json
       {
         "engines": { "node": ">=24" },
         "packageManager": "pnpm@latest"
       }
       ```
       Replace `pnpm@latest` with the actual current pnpm version (e.g. `pnpm@10.x.x` — query `pnpm --version`).

    3. Verify `package.json` `dependencies` are pinned with caret ranges to:
       - `"next": "^16"` (per D-13 — REVERSAL of original 15.5.x pin; next-intl is REMOVED so the 16.x interop block is moot)
       - `"react": "^19"` and `"react-dom": "^19"`
       And `devDependencies`:
       - `"typescript": "^5"`
       - `"tailwindcss": "^4"`
       - `"@tailwindcss/postcss": "^4"`
       - `"eslint": "^10"`
       - `"eslint-config-next": "^16"`
       - `"@types/node"`, `"@types/react"`, `"@types/react-dom"` at latest

    4. Write `.nvmrc` with literal content: `24` (and trailing newline).

    5. Replace `next.config.ts` with EXACTLY (per D-12):
       ```ts
       import type { NextConfig } from "next";

       const config: NextConfig = {
         reactStrictMode: true,
         poweredByHeader: false,
         experimental: {
           typedRoutes: true,
         },
       };

       export default config;
       ```

    6. Verify `postcss.config.mjs` is EXACTLY:
       ```js
       export default {
         plugins: { "@tailwindcss/postcss": {} },
       };
       ```
       (Pitfall 1 — old `tailwindcss: {}` form silently no-ops. Must be `@tailwindcss/postcss`.)

    7. Replace `tsconfig.json` with the strict version from RESEARCH §Code Examples — must include:
       - `"strict": true`
       - `"noUncheckedIndexedAccess": true`
       - `"noImplicitOverride": true`
       - `"paths": { "@/*": ["./src/*"] }`
       - `"plugins": [{ "name": "next" }]`
       - `"moduleResolution": "bundler"`

    8. Replace `src/app/layout.tsx` with a MINIMAL placeholder root layout (real disclaimer footer arrives in plan 05). Body should render `{children}` only — no footer yet:
       ```tsx
       import "./globals.css";

       export const metadata = {
         title: "ENSO Brasil",
         description: "Agregador público de alertas climáticos no Brasil.",
       };

       export default function RootLayout({ children }: { children: React.ReactNode }) {
         return (
           <html lang="pt-BR">
             <body>{children}</body>
           </html>
         );
       }
       ```
       The `lang="pt-BR"` attribute is REQUIRED here (REQ-S1.09 a11y shell). Skip-link + focus styles + footer arrive in plan 05.

    9. Replace `src/app/page.tsx` with a server-component placeholder (NO `'use client'`):
       ```tsx
       export default function HomePage() {
         return (
           <main id="main">
             <h1>ENSO Brasil</h1>
             <p>Em construção. Disclaimer no rodapé.</p>
           </main>
         );
       }
       ```

    10. Create `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/loading.tsx` as minimal server components (default Next 16 conventions; PT-BR copy: "Página não encontrada", "Erro ao carregar", "Carregando…"). `error.tsx` MUST start with `'use client'` (Next requirement) — that is the ONLY client component allowed in this plan.

    11. Replace `src/app/globals.css` with ONLY:
        ```css
        @import "tailwindcss";
        ```
        (The full `@theme` block lands in plan 03 — keep this plan focused.)

    12. Write `.env.example` with header comment + empty body (per D-12 — no env vars consumed in P1):
        ```
        # ENSO Brasil — environment variables
        # P1 consumes none. Future phases will add: DATABASE_URL (P2), UPSTASH_REDIS_* (P2), INGEST_TOKEN (P2).
        ```

    13. Verify `.gitignore` (already exists per gitStatus) includes `node_modules`, `.next`, `.env.local`, `*.log`. Append any missing entries.

    14. Strip ANY boilerplate from create-next-app that violates anti-features (CLAUDE.md):
        - Remove demo content from `src/app/page.tsx` (already done in step 9)
        - Remove any analytics scripts, telemetry, or tracking
        - Verify NO references to `next-intl`, `i18n`, `lingui`, `react-i18next`, `/[locale]/` anywhere (`grep -r "next-intl\\|/\\[locale\\]" src/ package.json` MUST return empty)

    15. Run `pnpm install --frozen-lockfile=false` to regenerate `pnpm-lock.yaml` after edits, then run `pnpm build` to verify the scaffold compiles.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm install --frozen-lockfile=false && pnpm exec tsc --noEmit && pnpm build</automated>
  </verify>
  <acceptance_criteria>
    - File `package.json` exists; `node -e "const p=require('./package.json'); process.exit(p.dependencies.next && p.dependencies.next.startsWith('^16') ? 0 : 1)"` exits 0
    - File `package.json` field `engines.node` matches regex `>=\s*24`
    - File `package.json` field `packageManager` starts with `pnpm@`
    - File `.nvmrc` contents (trimmed) === `24`
    - File `tsconfig.json` parsed JSON has `compilerOptions.strict === true` AND `compilerOptions.noUncheckedIndexedAccess === true`
    - File `tsconfig.json` parsed JSON has `compilerOptions.paths["@/*"]` === `["./src/*"]`
    - `grep -c '"@tailwindcss/postcss"' postcss.config.mjs` returns >= 1; `grep -c '^\s*tailwindcss:' postcss.config.mjs` returns 0
    - `grep -c 'reactStrictMode: true' next.config.ts` returns 1; `grep -c 'poweredByHeader: false' next.config.ts` returns 1
    - `grep -c 'lang="pt-BR"' src/app/layout.tsx` returns 1
    - File `src/app/page.tsx` does NOT contain `'use client'` (`grep -c "'use client'" src/app/page.tsx` returns 0)
    - `grep -rE "next-intl|lingui|react-i18next|/\[locale\]" src/ package.json` returns no matches (exit 1 from grep)
    - `grep -rE "fonts\.googleapis|next/font/google" src/` returns no matches
    - `pnpm exec tsc --noEmit` exits 0
    - `pnpm build` exits 0
    - File `pnpm-lock.yaml` exists
  </acceptance_criteria>
  <done>Scaffold installs, typechecks, and builds. lang="pt-BR" set. No next-intl, no external fonts, no demo boilerplate. Plan 03 will add the @theme block; plan 05 will wire the disclaimer footer.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary            | Description                                                           |
| ------------------- | --------------------------------------------------------------------- |
| developer → repo    | Untrusted boilerplate from `create-next-app` template enters the repo |
| repo → npm registry | Downloaded dependency code executes during install/build              |

## STRIDE Threat Register

| Threat ID | Category               | Component                   | Disposition | Mitigation Plan                                                                                              |
| --------- | ---------------------- | --------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| T-01-01   | Tampering              | create-next-app boilerplate | mitigate    | Step 14 strips demo content + verifies no analytics/telemetry/i18n via grep gates in `<acceptance_criteria>` |
| T-01-02   | Information Disclosure | .env.example                | mitigate    | Plan instructs empty body with documentation comment only — no real secrets ever written here (D-12)         |
| T-01-03   | Tampering              | npm dependency chain        | accept      | Renovate (plan 04) + lockfile commit (D-03) provide ongoing provenance; deeper SCA deferred to P6 hardening  |

</threat_model>

<verification>
On a fresh clone: `pnpm install --frozen-lockfile && pnpm exec tsc --noEmit && pnpm build` all exit 0.
</verification>

<success_criteria>
Next.js 16 App Router scaffold installs and builds; TS strict passes; `lang="pt-BR"` rendered; no banned dependencies present.
</success_criteria>

<output>
After completion, create `.planning/phases/01-skeleton-oss-foundation/01-01-SUMMARY.md`
</output>
