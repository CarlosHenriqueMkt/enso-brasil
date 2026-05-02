# Phase 1: Skeleton & OSS Foundation — Research

**Researched:** 2026-04-30
**Domain:** Next.js 16 App Router scaffolding, Tailwind v4, OSS hygiene, lean CI, SSR a11y shell
**Confidence:** HIGH

## Summary

Phase 1 builds a public, MIT-licensed Next.js 16 (App Router, Turbopack default) skeleton on Vercel with TypeScript strict, Tailwind v4 (CSS-first `@theme`), Vitest + Playwright smoke, ESLint+Prettier+Husky+gitleaks, and a SSR-rendered disclaimer + `/privacidade` LGPD page. No data flow.

All target versions verified live against npm registry on 2026-04-30. Next.js 16 is stable (16.2.4 latest); Tailwind v4 is stable (4.2.4 latest); both have first-class integration. Major shifts vs. older training data: **Turbopack is now default** (no `--turbo` flag), `tailwind.config.js` is **gone** (CSS-first), PostCSS plugin is now `@tailwindcss/postcss`. Caching strategy for CI: `actions/setup-node` with `cache: pnpm` for deps; **do not** cache Playwright browsers (per official Playwright recommendation — restore time ≈ download time, OS deps still required).

**Primary recommendation:** Use `create-next-app@latest` (App Router + TS + Tailwind preset) as the initial scaffold, then strip what we don't need (no ESLint flat-config opinion conflicts), pin everything via `pnpm-lock.yaml`, and layer Husky + gitleaks + Vitest + Playwright on top in distinct atomic commits.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Repo & toolchain:**

- D-01: Flat root Next.js app, no monorepo. Layout: `src/app/`, `src/components/`, `src/lib/`.
- D-02: **pnpm** package manager. **Node 24 LTS** pinned via `.nvmrc` + `engines.node >= 24` + `packageManager: pnpm@<latest>`. CI uses `pnpm install --frozen-lockfile`.
- D-03: Caret `^` ranges in `package.json` + `pnpm-lock.yaml` committed. **Renovate** (preferred over Dependabot), grouped weekly schedule.

**Secret scan:**

- D-04: **gitleaks** in two places — Husky pre-commit + GitHub Actions CI. Default ruleset, no custom tuning v1.

**Privacy page:**

- D-05: Contact channel for ALL matters (LGPD, security disclosure, general) = `https://www.linkedin.com/in/carloshenriquerp/` during v1; transitions to email at P7.
- D-06: Version field format = date only, PT-BR natural — e.g., "Versão de 30 de abril de 2026". SoT in `src/lib/messages.ts` (`messages.privacy.version`).

**README & OSS polish:**

- D-07: **Full PT-BR README** in P1 (not stub). Sections: O que é, Por quê, Como funciona, Fontes oficiais, Status, Como rodar localmente, Como contribuir, Limitações conhecidas, Disclaimer + emergency contacts.
- D-08: P1 ships `SECURITY.md` (LinkedIn DM disclosure), GitHub Issue templates (bug, **data discrepancy**, feature), PR template (tests/types/no-secrets/REQ-ID checklist). **No** `.github/FUNDING.yml` in P1.
- D-09: **Branch protection on `main` from day 1.** 1 PR review, all CI checks green, linear history, no force-push, no self-approval.

**Stack specifics:**

- D-10: ESLint + Prettier (Biome rejected — no `eslint-plugin-tailwindcss` parity in 2026).
- D-11: **Knip** added to CI for unused-exports/dead-deps. Storybook + Madge skipped.
- D-12: `next.config.ts` minimal (`reactStrictMode: true`, default output, no `images.domains`). `.env.local` gitignored, `.env.example` committed (no secrets, documents required vars). No env vars consumed in P1.
- D-13: **Next.js `^16` (16.x line)** — reversal of original 15.5.x pin (next-intl interop block now moot since next-intl removed).
- D-14: All other deps = "latest stable as of 2026-04-30". Planner verifies live npm + writes pinned versions.

### Claude's Discretion

- Exact `eslint-config-next` rules beyond defaults — Claude picks reasonable defaults.
- `next.config.ts` minor flags (`poweredByHeader: false`, `experimental.typedRoutes`) — Claude picks per Next 16 best practices.
- Husky + lint-staged exact glob/command wiring — idiomatic config.
- Prettier rules (print width, tabs vs spaces, trailing comma) — community defaults; documented in `.prettierrc`.
- Issue / PR template exact wording — Claude drafts in PT-BR; user reviews in PR.

### Deferred Ideas (OUT OF SCOPE)

- `.github/FUNDING.yml` (Sponsors) → P7
- Biome replacement → revisit when `eslint-plugin-tailwindcss` parity exists
- `output: 'standalone'` → P6 hardening
- `images.domains` pre-config → P5
- Email LGPD contact (replace LinkedIn) → P7
- Storybook → P5
- Dependabot vs Renovate → cheap to switch

## Phase Requirements

| ID        | Description                                                                     | Research Support                                                     |
| --------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| REQ-S1.01 | Public GitHub repo + OSS scaffolding (LICENSE, README PT-BR, CONTRIBUTING, COC) | OSS Scaffolding section + Contributor Covenant 2.1 [CITED]           |
| REQ-S1.02 | Next 16 App Router scaffold (next^16, react^19, ts^5, pnpm, Node 24)            | Standard Stack table; Next 16.2.4 verified [VERIFIED: npm view next] |
| REQ-S1.03 | TS strict + path aliases (`@/*` → `src/*`)                                      | tsconfig pattern in Code Examples                                    |
| REQ-S1.04 | Tailwind v4 + theme tokens via `@theme` from sketch-findings skill              | Tailwind v4 setup pattern; `@tailwindcss/postcss` 4.2.4 verified     |
| REQ-S1.05 | Lint, format, pre-commit (ESLint + Prettier + Husky + lint-staged + gitleaks)   | Husky 9.1.7 + lint-staged 16.4.0 verified; gitleaks 2-tier pattern   |
| REQ-S1.06 | CI pipeline < 4 min (typecheck + lint + Vitest + Playwright smoke)              | GH Actions caching pattern; do NOT cache Playwright browsers         |
| REQ-S1.07 | SSR disclaimer footer with 199/193/190 + agency names                           | Server Component default in App Router; sketch-findings skill copy   |
| REQ-S1.08 | `/privacidade` LGPD page in PT-BR draft completo (7 sections)                   | Server-rendered route; messages.ts as SoT for content                |
| REQ-S1.09 | A11y shell (lang="pt-BR", skip link, focus-visible, reduced-motion)             | A11y patterns; axe-core deferred to P5                               |
| REQ-S1.10 | `src/lib/messages.ts` plain TS constants (NOT next-intl)                        | Flat module pattern; future P2/P5/P6 import from here                |
| REQ-S1.11 | `src/components/SourceLink.tsx` mono-font domain                                | React component + Vitest snapshot test                               |

## Architectural Responsibility Map

| Capability                     | Primary Tier                     | Secondary Tier           | Rationale                                                               |
| ------------------------------ | -------------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| Disclaimer footer rendering    | Frontend Server (RSC)            | —                        | MUST be SSR — verifiable with JS disabled (REQ-S1.07)                   |
| `/privacidade` page rendering  | Frontend Server (RSC)            | —                        | Static SSR content; no client interactivity needed (REQ-S1.08)          |
| Skip link + focus styles       | Browser / Client (CSS only)      | —                        | Pure CSS; no JS needed for `:focus-visible` or `prefers-reduced-motion` |
| Theme tokens (`@theme`)        | Build-time (Tailwind v4 Oxide)   | Browser (CSS variables)  | CSS variables generated at build time, consumed in browser              |
| Strings module (`messages.ts`) | Build-time                       | Frontend Server (import) | Plain TS constants; tree-shaken into RSCs                               |
| SourceLink component           | Frontend Server (RSC default)    | —                        | No client state; render server-side                                     |
| CI pipeline                    | GitHub Actions runners           | —                        | Out-of-band, never touches user-facing tier                             |
| Secret scan                    | Pre-commit (local) + CI (remote) | —                        | Defense in depth: local fast-fail + remote enforcement                  |

## Standard Stack

### Core (versions VERIFIED via `npm view` on 2026-04-30)

| Library              | Version        | Purpose                     | Why Standard                                                                  |
| -------------------- | -------------- | --------------------------- | ----------------------------------------------------------------------------- |
| next                 | 16.2.4         | React framework, App Router | Latest stable; Turbopack now default [VERIFIED: npm registry]                 |
| react                | 19.2.5         | UI library                  | Required peer for Next 16 [VERIFIED: npm registry]                            |
| react-dom            | 19.2.5         | DOM renderer                | Pair with react 19 [VERIFIED: npm registry]                                   |
| typescript           | 5.9.x (latest) | Type system                 | TS strict mandated by SPEC                                                    |
| tailwindcss          | 4.2.4          | Utility CSS                 | CSS-first config via `@theme` [VERIFIED: npm registry]                        |
| @tailwindcss/postcss | 4.2.4          | PostCSS plugin              | New in v4 (replaces old `tailwindcss` PostCSS entry) [VERIFIED: npm registry] |

### Supporting

| Library            | Version           | Purpose            | When to Use                                           |
| ------------------ | ----------------- | ------------------ | ----------------------------------------------------- |
| eslint             | 10.2.1            | Linter             | Required by `eslint-config-next` [VERIFIED]           |
| eslint-config-next | 16.2.4            | Next.js lint rules | Matches Next major; flat-config compatible [VERIFIED] |
| prettier           | 3.8.3             | Formatter          | Standard JS/TS formatter [VERIFIED]                   |
| husky              | 9.1.7             | Git hooks          | Pre-commit hook orchestration [VERIFIED]              |
| lint-staged        | 16.4.0            | Stage-aware runner | Run eslint+prettier only on staged files [VERIFIED]   |
| vitest             | 4.1.5             | Unit test runner   | Vite-based, fast, native ESM, RSC-friendly [VERIFIED] |
| @playwright/test   | 1.59.1            | E2E test runner    | Smoke test for SSR disclaimer [VERIFIED]              |
| knip               | 6.9.0             | Dead code detector | Unused exports/deps in CI (D-11) [VERIFIED]           |
| gitleaks           | (binary, not npm) | Secret scanner     | Pre-commit + CI; install via brew/winget/GH release   |

### Alternatives Considered

| Instead of        | Could Use | Tradeoff                                                                               |
| ----------------- | --------- | -------------------------------------------------------------------------------------- |
| ESLint+Prettier   | Biome     | Rejected per D-10 — no `eslint-plugin-tailwindcss` parity                              |
| Husky+lint-staged | Lefthook  | Single YAML, faster — but D-10 locks Husky; switch is cheap later                      |
| Vitest            | Jest      | Vitest is Vite-native; faster; better ESM/TS; community standard for new Next projects |

**Installation (single command for the planner):**

```bash
pnpm dlx create-next-app@latest enso-brasil \
  --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --turbopack
# Then add:
pnpm add -D vitest @vitejs/plugin-react @playwright/test prettier husky lint-staged knip
pnpm exec playwright install --with-deps
```

**Version verification command (planner MUST re-run before pinning):**

```bash
npm view next version
npm view tailwindcss version
# ... etc for each
```

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  Developer Machine                                            │
│   ├─ git commit ─→ Husky pre-commit ─→ lint-staged           │
│   │                                     ├─ eslint --fix       │
│   │                                     ├─ prettier --write   │
│   │                                     └─ gitleaks protect   │
│   └─ git push                                                 │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  GitHub                                                       │
│   ├─ Branch protection on main (1 review, CI green, linear)  │
│   └─ Actions CI on PR + push:                                 │
│       checkout → setup-node(pnpm cache) → pnpm install        │
│         → typecheck → lint → knip → vitest                    │
│         → playwright install → playwright test (smoke)        │
│         → gitleaks scan                                       │
│       (budget: < 4 min)                                       │
└──────────────────┬───────────────────────────────────────────┘
                   │ merge to main
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  Vercel                                                       │
│   └─ build (next build, Turbopack) → deploy                  │
│       └─ runtime: RSCs render on every request                │
│           ├─ / (home, placeholder, disclaimer footer)         │
│           ├─ /privacidade (LGPD page)                         │
│           ├─ not-found.tsx, error.tsx, loading.tsx            │
│           └─ Server-rendered HTML reaches browser              │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  Browser (PT-BR user, possibly JS-disabled)                  │
│   ├─ <html lang="pt-BR">                                     │
│   ├─ Skip link (Tab key reveals)                              │
│   ├─ Page content (works with JS off)                         │
│   └─ <footer> Disclaimer + 199/193/190 + agency names         │
└──────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
enso-brasil/
├── .github/
│   ├── workflows/ci.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── data_discrepancy.md
│   │   └── feature_request.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── renovate.json
├── .husky/
│   └── pre-commit
├── src/
│   ├── app/
│   │   ├── layout.tsx          # SSR disclaimer footer here
│   │   ├── page.tsx            # / (P1: placeholder)
│   │   ├── not-found.tsx
│   │   ├── error.tsx
│   │   ├── loading.tsx
│   │   ├── globals.css         # @import "tailwindcss"; @theme {...}
│   │   └── privacidade/
│   │       └── page.tsx        # /privacidade
│   ├── components/
│   │   ├── SourceLink.tsx
│   │   └── SourceLink.test.tsx # Vitest snapshot
│   └── lib/
│       └── messages.ts         # PT-BR strings SoT
├── tests/
│   └── e2e/
│       └── disclaimer.spec.ts  # Playwright smoke
├── .nvmrc                      # 24
├── .env.example                # documents future vars (empty in P1)
├── .gitignore
├── .gitleaks.toml              # (optional — default ruleset is fine)
├── .prettierrc
├── .lintstagedrc               # or in package.json
├── eslint.config.mjs           # flat config
├── next.config.ts
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml
├── postcss.config.mjs
├── tsconfig.json
├── vitest.config.ts
├── LICENSE                     # MIT, 2026, "ENSO Brasil"
├── README.md                   # PT-BR primary
├── README.en.md                # EN secondary (optional, deferred OK)
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md          # Contributor Covenant 2.1 PT-BR
└── SECURITY.md
```

### Pattern 1: Tailwind v4 CSS-first config (replaces tailwind.config.js)

**What:** All design tokens live in CSS via `@theme`. No JS config file.
**When to use:** Always in v4. The old JS config still works via `@config` but is legacy.

```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  /* Surfaces (from sketch-findings/03-tokens-theme.md) */
  --color-bg: #fafaf8;
  --color-surface: #ffffff;
  --color-ink-1: #111111;
  --color-ink-2: #555555;
  --color-hairline: #e5e5e0;

  /* INMET-aligned 5-level risk palette (bg / border / ink triplets) */
  --color-risk-green-bg: #e7f3e8;
  --color-risk-green-bd: #2e7d32;
  --color-risk-yellow-bg: #fff7d6;
  --color-risk-yellow-bd: #d4a017; /* darkened — bespoke; NEVER white text */
  --color-risk-orange-bg: #ffe7cc;
  --color-risk-orange-bd: #e76f00;
  --color-risk-red-bg: #fde2e2;
  --color-risk-red-bd: #c62828;
  --color-risk-gray-bg: #ececec;
  --color-risk-gray-bd: #757575;

  /* 8pt spacing scale */
  --spacing: 0.5rem; /* 8px base; Tailwind generates p-1..p-N */

  /* Radii 2/4/6 */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;

  /* System fonts (no external font files) */
  --font-sans:
    ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}

/* Source: tailwindcss.com/docs/theme + sketch-findings/03-tokens-theme.md */
```

```js
// postcss.config.mjs
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
// Source: https://tailwindcss.com/docs/installation/using-postcss
```

### Pattern 2: Next.js 16 App Router root layout with SSR disclaimer

**What:** Server Component (default in App Router) renders disclaimer in raw HTML.
**When to use:** Every Next 16 App Router project.

```tsx
// src/app/layout.tsx
import "./globals.css";
import { messages } from "@/lib/messages";

export const metadata = {
  title: "ENSO Brasil",
  description: "Agregador público de alertas climáticos no Brasil.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:p-2 focus:bg-surface focus:text-ink-1"
        >
          Pular para o conteúdo principal
        </a>
        <main id="main">{children}</main>
        <footer className="border-t border-hairline p-4 text-ink-2">
          <p>{messages.disclaimer.body}</p>
          <p className="font-mono">{messages.emergency.inline}</p>
        </footer>
      </body>
    </html>
  );
}
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/layout
```

### Pattern 3: Strings module (NOT next-intl)

```ts
// src/lib/messages.ts
export const messages = {
  emergency: {
    inline: "199 Defesa Civil · 193 Bombeiros · 190 Polícia",
  },
  disclaimer: {
    body: "Este site agrega informações de fontes oficiais. Não substitui sistemas oficiais de alerta. Em emergência, ligue:",
  },
  privacy: {
    version: "Versão de 30 de abril de 2026",
    // ...sections...
  },
  // edge-state copy, severity labels, etc. — see sketch-findings skill
} as const;
```

### Pattern 4: Vitest + Playwright coexistence

**Vitest excludes Playwright dir; Playwright excludes Vitest specs.**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["**/node_modules/**", "**/tests/e2e/**"],
  },
});
```

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  webServer: {
    command: "pnpm build && pnpm start",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: "http://localhost:3000" },
});
// Source: https://playwright.dev/docs/test-configuration
```

### Pattern 5: SSR verification (curl + Playwright JS-disabled)

```ts
// tests/e2e/disclaimer.spec.ts
import { test, expect } from "@playwright/test";

test("disclaimer renders SSR with all 3 emergency contacts", async ({ browser }) => {
  // JS disabled context — proves SSR
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("/");
  const html = await page.content();
  expect(html).toContain("199");
  expect(html).toContain("Defesa Civil");
  expect(html).toContain("193");
  expect(html).toContain("Bombeiros");
  expect(html).toContain("190");
  expect(html).toContain("Polícia");
});
```

### Pattern 6: Husky + lint-staged + gitleaks pre-commit

```sh
# .husky/pre-commit
pnpm exec lint-staged
gitleaks protect --staged --redact --verbose
```

```json
// package.json (lint-staged section)
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

### Pattern 7: GitHub Actions CI (lean, < 4 min)

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
  push: { branches: [main] }
jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 6
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: latest }
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec tsc --noEmit
      - run: pnpm lint
      - run: pnpm exec knip
      - run: pnpm test                       # vitest
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm exec playwright test
      - uses: gitleaks/gitleaks-action@v2
        env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
# Source: https://playwright.dev/docs/ci + https://pnpm.io/continuous-integration
```

### Anti-Patterns to Avoid

- **Disclaimer in `'use client'` component or rendered via `useEffect`** — fails SSR contract; invisible with JS off. Keep the footer in `app/layout.tsx` as a Server Component (default).
- **External font imports (`next/font/google`, `<link href="fonts.googleapis...">`)** — SPEC mandates system fonts only. Verified by `grep -r "fonts.googleapis" .next/`.
- **Caching Playwright browsers via `actions/cache`** — restore time ≈ download time, OS deps still need install. Just run `playwright install --with-deps` fresh each CI run.
- **Old PostCSS config (`tailwindcss: {}`)** — Tailwind v4 uses `@tailwindcss/postcss: {}`. Old form silently no-ops.
- **`tailwind.config.js` for tokens** — v4 deprecates this in favor of `@theme` in CSS. Use the new pattern.
- **Custom secret-detection regex** (e.g., `[A-Z_]+_KEY|TOKEN`) — D-04 explicitly replaces this with gitleaks. Don't reintroduce.
- **`output: 'standalone'`** — D-12 explicitly defers this to P6.
- **`/[locale]/page.tsx` route shape, `next-intl`, `lingui`, `react-i18next`** — REMOVED from project; PT-BR only.

## Don't Hand-Roll

| Problem                       | Don't Build                      | Use Instead                                      | Why                                                             |
| ----------------------------- | -------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| Secret detection              | Custom regex on staged files     | gitleaks (D-04)                                  | Mature ruleset, low false positives, used industry-wide         |
| Pre-commit hook orchestration | Raw shell in `.git/hooks/`       | Husky 9                                          | Versioned, shareable across team                                |
| Stage-aware command runner    | Iterate over `git diff --cached` | lint-staged 16                                   | Handles partial-stage edge cases, file globs                    |
| Code of Conduct text          | Write from scratch               | Contributor Covenant 2.1 (PT-BR translation)     | Industry standard; has official BR-PT translation               |
| Tailwind theme config         | Inline `style={{}}` props        | `@theme` block + utility classes                 | One source of truth; tree-shaken; matches sketch-findings skill |
| TypeScript path aliases       | Relative `../../../lib/messages` | `tsconfig.json paths` + `@/*`                    | Refactor-safe, IDE-supported                                    |
| Skip-link CSS                 | Custom JS focus management       | `:focus-visible` + `sr-only` utility             | Pure CSS, no JS, accessibility-correct                          |
| Reduced-motion handling       | JS detection of preference       | `@media (prefers-reduced-motion: reduce)` in CSS | Browser-native, zero JS                                         |
| README badges/structure       | Bespoke design                   | shields.io conventions + standard sections       | Recognizable to OSS contributors                                |
| Renovate config               | Hand-tuned cron + PR rules       | `config:base` + grouped weekly                   | Maintained presets; D-03                                        |

**Key insight:** Phase 1 is 90% off-the-shelf. The ONLY bespoke code is `messages.ts` constants, the disclaimer footer JSX, the `/privacidade` page content, and the SourceLink component. Everything else is configuration of well-known tools.

## Common Pitfalls

### Pitfall 1: Tailwind v4 PostCSS plugin name change

**What goes wrong:** Copy-pasted v3 config (`postcss.config.js` with `tailwindcss: {}`) silently does nothing in v4 — no error, no styles emitted.
**Why it happens:** v4 split the PostCSS plugin into `@tailwindcss/postcss` (renamed package).
**How to avoid:** Use exactly `import("@tailwindcss/postcss")` in `postcss.config.mjs`. Verify by checking that `pnpm build` output contains generated utility classes.
**Warning signs:** Built page renders with NO Tailwind utilities applied; `globals.css` looks like raw `@import "tailwindcss"` text in browser.

### Pitfall 2: Disclaimer accidentally becomes Client Component

**What goes wrong:** Adding any hook (`useState`, `useEffect`) or event handler to a footer subcomponent flips it to Client. SPEC requires SSR rendering.
**Why it happens:** Devs reach for hooks reflexively; `'use client'` propagates upward to nearest server boundary.
**How to avoid:** Footer in `app/layout.tsx` MUST stay a Server Component. The Playwright JS-disabled smoke test catches regressions automatically.
**Warning signs:** `view-source:` of the page does NOT show disclaimer text inline; or Playwright JS-off test fails.

### Pitfall 3: Yellow `#eab308` fails WCAG AA on white

**What goes wrong:** Pure yellow on white background = 2.34:1 contrast. WCAG AA needs 4.5:1 normal text / 3:1 large text.
**Why it happens:** Tailwind's default `yellow-500` is too light for accessible text.
**How to avoid:** Use the **darkened** `#d4a017` for the yellow risk-level border AND mandate **black** ink (`--color-ink-1: #111111`) on yellow backgrounds. NEVER white text on yellow. Add a CSS comment in `globals.css` calling this out (per CONTEXT specifics). [VERIFIED via WebAIM contrast checker logic; locked in sketch-findings skill]
**Warning signs:** Any WCAG checker flagging Yellow/white pair; `<span class="bg-risk-yellow-bg text-white">` in code review.

### Pitfall 4: Caching Playwright browsers in CI

**What goes wrong:** Adding `actions/cache` for `~/.cache/ms-playwright` saves no real time AND skips OS-dep installation.
**Why it happens:** Intuition says "binaries are slow to download, cache them."
**How to avoid:** Per official Playwright docs and GH community discussion, just run `pnpm exec playwright install --with-deps chromium` fresh each run. Cache `~/.local/share/pnpm/store` instead via `cache: pnpm`.
**Warning signs:** CI fails with "missing libnss3" or "browser not found" after cache hit.

### Pitfall 5: ESLint flat-config conflicts with `eslint-config-next`

**What goes wrong:** `eslint-config-next` historically shipped as legacy `.eslintrc.json`; flat config (`eslint.config.mjs`) was rocky in earlier versions.
**Why it happens:** Migration period 2024–2026.
**How to avoid:** As of `eslint-config-next` 16.2.4 + `eslint` 10.2.1 (2026-04-30), flat config is supported. Use `eslint.config.mjs` shape from current Next docs. If in doubt, `create-next-app@latest` generates the correct file.
**Warning signs:** `pnpm lint` errors about "FlatConfig is not iterable" or unknown config key.

### Pitfall 6: gitleaks false positive blocks legitimate commits

**What goes wrong:** Default rules flag base64 strings, JWT-shaped strings in test fixtures.
**Why it happens:** Default ruleset is broad.
**How to avoid:** Allowlist via inline comment `# gitleaks:allow` on the offending line, OR add a path-scoped allowlist in `.gitleaks.toml`. Don't disable globally.
**Warning signs:** Pre-commit blocking on a string the developer knows is safe.

### Pitfall 7: Branch protection on day 1 locks out solo dev

**What goes wrong:** D-09 requires "1 PR review, no self-approval" — solo dev can't merge own PRs.
**Why it happens:** Self-approval prevention is the rule.
**How to avoid:** GitHub allows the **repo owner** to merge with admin override, or configure "require approvals: 1, allow specified actors to bypass" with the owner as bypass actor. Document this trade-off in CONTRIBUTING.md.
**Warning signs:** First PR after branch protection setup gets stuck "Review required" with no other reviewers available.

## Code Examples

### tsconfig.json (TS strict + path alias)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
// Source: https://nextjs.org/docs/app/api-reference/config/typescript
```

### next.config.ts (D-12 minimal)

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
// Source: https://nextjs.org/docs/app/api-reference/config/next-config-js
```

### SourceLink component (REQ-S1.11)

```tsx
// src/components/SourceLink.tsx
type Props = { href: string; name: string };

export function SourceLink({ href, name }: Props) {
  const domain = new URL(href).hostname;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {name} <span className="font-mono text-ink-2">({domain})</span>
    </a>
  );
}
```

### MIT LICENSE template

```
MIT License

Copyright (c) 2026 ENSO Brasil

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, ...
```

## State of the Art

| Old Approach                     | Current Approach                     | When Changed            | Impact                                                                              |
| -------------------------------- | ------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------- |
| `next dev --turbo` opt-in        | Turbopack default in Next 16         | 2025-12 (Next 16 GA)    | No flag needed; faster builds out of the box [CITED: nextjs.org/blog/next-16]       |
| `tailwind.config.js` (JS)        | `@theme {}` in CSS (CSS-first)       | Tailwind v4 GA          | One less file; tokens live with styles [CITED: tailwindcss.com/blog/tailwindcss-v4] |
| `tailwindcss: {}` PostCSS plugin | `@tailwindcss/postcss: {}`           | Tailwind v4             | Plugin extracted; old name silently no-ops                                          |
| ESLint `.eslintrc.json` legacy   | `eslint.config.mjs` flat config      | ESLint 9+, Next 15+     | Modern config shape; flat is now stable for Next                                    |
| Husky 8 (`npm prepare` script)   | Husky 9 (`husky` CLI install)        | 2024                    | Smaller, faster init                                                                |
| Vercel Cron                      | GitHub Actions cron                  | 2026 (Hobby = once/day) | Out of P1 scope but locked for P2                                                   |
| Vercel KV                        | Upstash Redis                        | 2024-12 (KV migrated)   | Out of P1 scope but locked for P2                                                   |
| `experimental.turbopack`         | Top-level `turbopack` in next.config | Next 16 GA              | Stable API surface                                                                  |

**Deprecated/outdated:**

- `next-intl` for this project: REMOVED entirely (PT-BR only)
- `tailwind.config.js` for new projects: deprecated in favor of `@theme`
- Caching Playwright browsers in CI: officially discouraged

## Assumptions Log

| #   | Claim                                                                                                                             | Section         | Risk if Wrong                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| A1  | `eslint-config-next@16.2.4` works with `eslint@10.2.1` flat config out of the box                                                 | Standard Stack  | LOW — `create-next-app` generates the right config; planner verifies on first install                                |
| A2  | Solo-dev branch protection workaround (admin override or bypass actor) is acceptable to the user                                  | Pitfall 7       | MEDIUM — if user wants strict enforcement, must add a 2nd reviewer (Claude/AI bot or co-maintainer) before P1 merges |
| A3  | Contributor Covenant 2.1 official PT-BR translation exists at contributor-covenant.org/translations                               | OSS Scaffolding | LOW — page lists many translations; verifiable at planner time                                                       |
| A4  | Vitest 4.x + `@vitejs/plugin-react` correctly transforms RSC files for unit tests of pure components like SourceLink              | Pattern 4       | LOW — SourceLink is a pure function component; no RSC-specific features                                              |
| A5  | `gitleaks` binary install method (winget on Windows, brew on mac, apt/release on Linux) is acceptable; documented in CONTRIBUTING | Pitfall 6       | LOW — well-known tool with clear install docs                                                                        |

## Open Questions

1. **Should `README.en.md` ship in P1 or defer to P7?**
   - What we know: REQ-S1.01 says "PT-BR primary, EN secondary"; D-07 details PT-BR sections only.
   - What's unclear: Does "EN secondary" mean "ships in P1" or "added by P7 launch"?
   - Recommendation: Planner ships a minimal `README.en.md` stub in P1 (3 paragraphs: what/why/link to PT-BR for full info) — cheap and satisfies REQ literally.

2. **Renovate config: `config:base` preset or custom grouping?**
   - What we know: D-03 says "grouped weekly schedule".
   - What's unclear: Exact group definitions (e.g., group all `@types/*`, group all eslint-related).
   - Recommendation: Use `config:recommended` + add `packageRules` for `groupName: "lint tooling"` (eslint, prettier, lint-staged, husky), `groupName: "test tooling"` (vitest, playwright). Document in `renovate.json`.

3. **Should the `/privacidade` page link the LinkedIn URL inline or use the SourceLink component?**
   - What we know: D-05 says LinkedIn is the contact channel; REQ-S1.11 says SourceLink shows domain in mono font.
   - What's unclear: Does "linkedin.com" rendering as `(linkedin.com)` mono-font in the contact line look professional, or should the contact line use a different presentation?
   - Recommendation: Use SourceLink — it dogfoods the component AND honors the "external link → mono domain" hard rule from sketch-findings. Test it in P1 review and adjust if it looks awkward.

## Environment Availability

| Dependency          | Required By                      | Available                          | Version | Fallback                                                                     |
| ------------------- | -------------------------------- | ---------------------------------- | ------- | ---------------------------------------------------------------------------- |
| Node.js 24 LTS      | Next 16 build/runtime            | Verify before run                  | —       | Install via nvm/volta                                                        |
| pnpm                | All install/build                | Verify before run                  | —       | `corepack enable && corepack prepare pnpm@latest --activate`                 |
| git                 | Husky, GitHub                    | ✓ (assumed)                        | —       | —                                                                            |
| GitHub CLI (`gh`)   | Repo creation, branch protection | Likely ✓                           | —       | Web UI fallback                                                              |
| gitleaks            | Pre-commit + CI                  | Verify before run                  | —       | winget install gitleaks (Windows) / brew (macOS) / GH release binary (Linux) |
| Playwright browsers | E2E smoke                        | Installed via `playwright install` | —       | — (always reinstall in CI)                                                   |

**Missing dependencies with no fallback:** None — all are installable on the dev machine.

**Missing dependencies with fallback:** gitleaks if not pre-installed → install instructions in CONTRIBUTING.md.

## Validation Architecture

### Test Framework

| Property           | Value                                          |
| ------------------ | ---------------------------------------------- |
| Unit framework     | Vitest 4.1.5 + jsdom + @vitejs/plugin-react    |
| E2E framework      | @playwright/test 1.59.1 (chromium only for P1) |
| Config files       | `vitest.config.ts`, `playwright.config.ts`     |
| Quick run command  | `pnpm test` (vitest in watch-off mode)         |
| Full suite command | `pnpm test && pnpm exec playwright test`       |

### Phase Requirements → Test Map

| Req ID    | Behavior                                  | Test Type                           | Automated Command                                                                               | File Exists?                                     |
| --------- | ----------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| REQ-S1.01 | OSS files exist + non-empty               | smoke (CI step, not test file)      | `test -s LICENSE && test -s README.md && test -s CONTRIBUTING.md && test -s CODE_OF_CONDUCT.md` | ❌ Wave 0 (CI YAML)                              |
| REQ-S1.02 | `pnpm build` succeeds                     | smoke (CI step)                     | `pnpm install --frozen-lockfile && pnpm build`                                                  | ❌ Wave 0 (CI YAML)                              |
| REQ-S1.03 | TS strict passes                          | unit (CI step)                      | `pnpm exec tsc --noEmit`                                                                        | ❌ Wave 0 (CI YAML)                              |
| REQ-S1.04 | Theme tokens render                       | manual + visual                     | (Optional Vitest snapshot of computed CSS vars)                                                 | manual-only acceptable                           |
| REQ-S1.05 | Pre-commit blocks `console.log` + secrets | manual / smoke                      | Manual: `git commit` test in CONTRIBUTING; or shell script in CI                                | ❌ Wave 0 (script)                               |
| REQ-S1.06 | CI passes < 4 min                         | meta (CI itself)                    | `gh run list --limit 1` post-merge                                                              | n/a                                              |
| REQ-S1.07 | Disclaimer SSR + 199/193/190              | e2e Playwright                      | `pnpm exec playwright test tests/e2e/disclaimer.spec.ts`                                        | ❌ Wave 0 (`tests/e2e/disclaimer.spec.ts`)       |
| REQ-S1.08 | `/privacidade` 7 sections SSR             | e2e Playwright                      | `pnpm exec playwright test tests/e2e/privacidade.spec.ts`                                       | ❌ Wave 0 (`tests/e2e/privacidade.spec.ts`)      |
| REQ-S1.09 | Skip link + lang attribute                | e2e Playwright (in disclaimer.spec) | `playwright test --grep "a11y shell"`                                                           | ❌ Wave 0 (extend disclaimer.spec)               |
| REQ-S1.10 | `messages.emergency.inline` exact string  | unit Vitest                         | `pnpm test src/lib/messages.test.ts`                                                            | ❌ Wave 0 (`src/lib/messages.test.ts`)           |
| REQ-S1.11 | SourceLink renders domain in mono         | unit Vitest snapshot                | `pnpm test src/components/SourceLink.test.tsx`                                                  | ❌ Wave 0 (`src/components/SourceLink.test.tsx`) |

### Sampling Rate

- **Per task commit:** `pnpm exec tsc --noEmit && pnpm test` (~10s)
- **Per wave merge:** `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm exec playwright test` (~90s)
- **Phase gate:** Full CI workflow green on PR before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — Vitest config
- [ ] `playwright.config.ts` — Playwright config
- [ ] `tests/e2e/disclaimer.spec.ts` — covers REQ-S1.07, REQ-S1.09
- [ ] `tests/e2e/privacidade.spec.ts` — covers REQ-S1.08
- [ ] `src/lib/messages.test.ts` — covers REQ-S1.10
- [ ] `src/components/SourceLink.test.tsx` — covers REQ-S1.11
- [ ] Framework install: `pnpm add -D vitest @vitejs/plugin-react jsdom @playwright/test && pnpm exec playwright install --with-deps chromium`

## Project Constraints (from CLAUDE.md)

The planner MUST honor these directives — they have the same authority as locked decisions:

- **Public-safety adjacent:** Errors should fail toward over-warning, never under-warning. P1 has no risk logic but the disclaimer copy must be conservative.
- **Aggregator stance, NOT authority:** Disclaimer must explicitly say "não substitui sistemas oficiais de alerta".
- **Anti-features (NEVER add):** user accounts, social, comments, user-submitted reports, forecasting, affiliate links, commerce, individual analytics. P1 has none of these — verify nothing creeps in via boilerplate (e.g., `create-next-app` may include comment-feature analytics; strip it).
- **PT-BR ONLY:** No `next-intl`, no `i18n`, no locale routing. Verified by SPEC acceptance grep.
- **Open source MIT from commit 1:** LICENSE in initial commit, never added later.
- **Auto-load skill `sketch-findings-enso-brasil`** — all theme tokens, copy strings, layout decisions come from this skill. Don't invent visual design.
- **Disclaimer must be SSR-rendered** — verifiable with JS disabled.
- **LGPD privacy page mandatory** at `/privacidade`.
- **GSD workflow:** `discuss → plan → execute → verify`. P1 is at "ready to plan" — next command after this research is `/gsd-plan-phase 1`.

## Sources

### Primary (HIGH confidence)

- [Next.js 16 release blog](https://nextjs.org/blog/next-16) — Turbopack default, App Router default, version GA
- [Next.js 16 upgrading guide](https://nextjs.org/docs/app/guides/upgrading/version-16) — breaking changes, codemods
- [Next.js Turbopack config reference](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack) — config shape (now top-level)
- [Tailwind CSS v4.0 blog](https://tailwindcss.com/blog/tailwindcss-v4) — CSS-first config, `@theme`, Oxide engine
- [Tailwind + Next.js install guide](https://tailwindcss.com/docs/guides/nextjs) — `@tailwindcss/postcss` setup
- [Playwright CI docs](https://playwright.dev/docs/ci) — caching guidance (do NOT cache browsers)
- [pnpm continuous-integration docs](https://pnpm.io/continuous-integration) — `actions/setup-node` with `cache: pnpm`
- [Playwright + Next.js testing guide](https://nextjs.org/docs/pages/guides/testing/playwright) — official integration
- [Husky get-started](https://typicode.github.io/husky/get-started.html) — Husky 9 install
- [Gitleaks GitHub](https://github.com/gitleaks/gitleaks) — pre-commit + Action setup
- [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) — COC text + translations page
- npm registry version queries via `npm view` (2026-04-30)

### Secondary (MEDIUM confidence)

- [Caching Playwright Binaries in GH Actions (DEV)](https://dev.to/jpoehnelt/caching-playwright-binaries-in-github-actions-2mfc) — confirms anti-pattern
- [GH community: caching npm + Playwright + pre-commit](https://github.com/orgs/community/discussions/187290) — current best practices
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) — yellow contrast analysis tool
- [Next.js 16.2 blog (Turbopack)](https://nextjs.org/blog/next-16-2-turbopack) — Turbopack stability stats

### Tertiary (LOW confidence — flagged for validation at plan time)

- Solo-dev workaround for branch protection self-approval (Pitfall 7) — based on general GitHub UX knowledge, not a specific cited doc. Planner should test on the actual repo before locking in P1.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — versions verified live via `npm view`; Next 16 + Tailwind v4 confirmed stable via official blogs
- Architecture: **HIGH** — App Router patterns are well-documented; SSR contract is unambiguous
- Pitfalls: **HIGH** — most pitfalls (Tailwind plugin name, JS-disabled SSR, Playwright browser cache) are known traps with documented mitigations
- A11y / WCAG: **HIGH** — yellow contrast issue is mathematically verifiable; sketch-findings skill already locks the darkened variant
- OSS scaffolding: **HIGH** — Contributor Covenant 2.1 is industry standard; gitleaks is well-known

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (Next.js + Tailwind are fast-moving; re-verify versions if planner runs > 30 days from this date)

## Planner Answers (resolved 2026-04-30)

User answers to open questions:

1. **README.en.md in P1?** → **DEFER to P7.** P1 ships PT-BR README only. EN README joins at launch.
2. **Renovate grouping config?** → **Researcher's call.** Recommend: `config:recommended` + grouped lint/test devDeps + Next.js/React major-version PRs in separate group (so security review isn't bundled with framework jumps).
3. **SourceLink on LinkedIn contact line?** → **YES.** Dogfood the component on the only outbound link present in P1.
