---
phase: 01-skeleton-oss-foundation
plan: 05
type: execute
wave: 3
depends_on: [01, 02, 03, 04]
files_modified:
  - src/app/layout.tsx
  - src/app/privacidade/page.tsx
  - .github/workflows/ci.yml
autonomous: false
requirements:
  - FOUND-04
  - FOUND-05
  - FOUND-06
  - FOUND-07

must_haves:
  truths:
    - "GET / (JS disabled) returns HTML containing all six tokens: 199, Defesa Civil, 193, Bombeiros, 190, Polícia"
    - "GET /privacidade (JS disabled) returns HTML containing all 7 LGPD section headings + LGPD term"
    - "GET / contains a skip link with the locked text 'Pular para o conteúdo principal'"
    - "GitHub Actions CI runs typecheck + lint + knip + vitest + playwright + gitleaks on every PR"
    - "CI does NOT cache Playwright browsers (Pitfall 4)"
    - "Wave-0 e2e tests (disclaimer.spec, privacidade.spec) now pass"
  artifacts:
    - path: "src/app/layout.tsx"
      provides: "Root layout with SSR disclaimer footer + skip link + main landmark + lang=pt-BR"
      contains: "messages.emergency.inline"
    - path: "src/app/privacidade/page.tsx"
      provides: "Server-rendered LGPD page with 7 sections + LinkedIn contact via SourceLink"
      contains: "LGPD"
    - path: ".github/workflows/ci.yml"
      provides: "Lean CI: checkout -> setup-node(pnpm cache) -> install -> tsc -> lint -> knip -> vitest -> playwright install + run -> gitleaks scan"
      contains: "playwright install --with-deps"
  key_links:
    - from: "src/app/layout.tsx"
      to: "src/lib/messages.ts"
      via: "named import { messages }"
      pattern: "import \\{ messages \\} from \"@/lib/messages\""
    - from: "src/app/privacidade/page.tsx"
      to: "src/components/SourceLink.tsx"
      via: "import for LinkedIn contact line (planner answer #3 — dogfood)"
      pattern: "import \\{ SourceLink \\}"
    - from: ".github/workflows/ci.yml"
      to: "gitleaks-action@v2"
      via: "CI tier 2 of D-04 defense in depth"
      pattern: "gitleaks/gitleaks-action@v2"
---

<objective>
Wire the SSR disclaimer footer in the root layout, ship the /privacidade LGPD page (7 sections, dogfooding SourceLink for the LinkedIn contact line per planner answer #3), and stand up the lean GitHub Actions CI pipeline (typecheck + lint + knip + Vitest + Playwright + gitleaks). After this plan: every Wave-0 test from plan 02 passes; SPEC acceptance criteria are satisfied; CI gates merges per D-09.

Purpose: Final wave. All upstream artifacts are ready (scaffold from 01, tooling+tests from 02, theme+strings+SourceLink from 03, OSS files from 04). This plan makes everything observable end-to-end.
Output: Real layout.tsx replacing plan 01's placeholder · /privacidade page · ci.yml workflow · 1 human-verify checkpoint at the end (visual + repo-public verification).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-skeleton-oss-foundation/01-SPEC.md
@.planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md
@.planning/phases/01-skeleton-oss-foundation/01-RESEARCH.md
@.claude/skills/sketch-findings-enso-brasil/SKILL.md
@src/lib/messages.ts
@src/components/SourceLink.tsx
@tests/e2e/disclaimer.spec.ts
@tests/e2e/privacidade.spec.ts

<interfaces>
Imports available (from earlier waves):
- `import { messages } from "@/lib/messages"` — exports messages.emergency.inline, messages.disclaimer.body, messages.a11y.skipLink, messages.privacy.{version,sections,contactUrl,contactName}, messages.severity, messages.edgeStates
- `import { SourceLink } from "@/components/SourceLink"` — Server Component <a> with mono-font hostname

Tailwind utilities available (from globals.css @theme):

- bg utilities: `bg-bg`, `bg-surface`, `bg-risk-{green,yellow,orange,red,gray}-bg`
- text utilities: `text-ink-1`, `text-ink-2`, `text-risk-{...}-bd`
- border utility: `border-hairline`
- font utilities: `font-sans`, `font-mono`
- radius: `rounded-sm`, `rounded-md`, `rounded-lg`

Sketch-findings layout contract (references/01-layout-composition.md, references/04):

- Footer disclaimer ALWAYS at bottom of every page (root layout footer)
- Skip link MUST be the first focusable element
- `<main id="main">` is the skip-link target
- Hairline border `border-hairline` separates footer from main
- Anti-sensationalism: no animation/pulse on disclaimer

CI contract (RESEARCH Pattern 7):

- runs-on: ubuntu-latest, timeout-minutes: 6 (budget < 4 min — see SPEC REQ-S1.06)
- Steps in order: checkout v4 -> pnpm/action-setup v4 -> setup-node v4 (Node 24, cache: pnpm) -> install --frozen-lockfile -> tsc --noEmit -> pnpm lint -> pnpm exec knip -> pnpm test -> playwright install --with-deps chromium -> playwright test -> gitleaks-action v2
- DO NOT add `actions/cache` for `~/.cache/ms-playwright` (Pitfall 4)
- gitleaks-action requires `GITHUB_TOKEN` env var (auto-provided by Actions)
  </interfaces>
  </context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Real root layout with SSR disclaimer footer + skip link</name>
  <read_first>
    - .planning/phases/01-skeleton-oss-foundation/01-SPEC.md (REQ-S1.07, REQ-S1.09)
    - .planning/phases/01-skeleton-oss-foundation/01-RESEARCH.md (Pattern 2, Pitfall 2)
    - .claude/skills/sketch-findings-enso-brasil/SKILL.md (hard rules: no bare numbers, no animation)
    - .claude/skills/sketch-findings-enso-brasil/references/01-layout-composition.md
    - src/app/layout.tsx (current placeholder from plan 01)
    - src/lib/messages.ts (the strings)
    - tests/e2e/disclaimer.spec.ts (the contract this layout must satisfy)
  </read_first>
  <behavior>
    - WHEN GET / responds (with JS disabled), THEN HTML body contains literal: "199", "Defesa Civil", "193", "Bombeiros", "190", "Polícia", AND `não substitui sistemas oficiais`.
    - WHEN GET / responds, THEN `<html lang="pt-BR">` is present.
    - WHEN user presses Tab on the page, THEN the skip link with text "Pular para o conteúdo principal" becomes the first focusable element pointing to `#main`.
    - The layout file MUST NOT contain `'use client'` (Pitfall 2 — SSR contract).
  </behavior>
  <files>src/app/layout.tsx</files>
  <action>
    REPLACE `src/app/layout.tsx` with EXACTLY (extends RESEARCH Pattern 2 with sketch-findings layout discipline):

    ```tsx
    import "./globals.css";
    import { messages } from "@/lib/messages";

    export const metadata = {
      title: "ENSO Brasil",
      description: "Agregador público de alertas climáticos no Brasil. Não substitui sistemas oficiais de alerta.",
    };

    export default function RootLayout({ children }: { children: React.ReactNode }) {
      return (
        <html lang="pt-BR">
          <body className="bg-bg text-ink-1 font-sans">
            {/* Skip link — first focusable element (REQ-S1.09) */}
            <a href="#main" className="skip-link">
              {messages.a11y.skipLink}
            </a>

            <main id="main">{children}</main>

            {/*
              Disclaimer footer — SSR-rendered (REQ-S1.07).
              Sketch-findings hard rule: never bare numbers; always paired with agency.
              Anti-sensationalism: no animation, no pulse, type weight 400.
            */}
            <footer className="border-t border-hairline p-4 text-ink-2">
              <p>{messages.disclaimer.body}</p>
              <p className="font-mono">{messages.emergency.inline}</p>
            </footer>
          </body>
        </html>
      );
    }
    ```

    Then run the disclaimer e2e test (this requires `pnpm build && pnpm start` to be running, which `playwright.config.ts` webServer handles automatically):
    ```
    pnpm exec playwright test tests/e2e/disclaimer.spec.ts
    ```
    Both tests in disclaimer.spec.ts MUST pass.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm exec tsc --noEmit && pnpm exec playwright test tests/e2e/disclaimer.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm exec tsc --noEmit` exits 0
    - `pnpm exec playwright test tests/e2e/disclaimer.spec.ts` exits 0 (both tests pass)
    - `grep -c "'use client'" src/app/layout.tsx` returns 0
    - `grep -c "lang=\"pt-BR\"" src/app/layout.tsx` returns 1
    - `grep -c "messages.emergency.inline" src/app/layout.tsx` returns 1
    - `grep -c "messages.disclaimer.body" src/app/layout.tsx` returns 1
    - `grep -c "messages.a11y.skipLink" src/app/layout.tsx` returns 1
    - `grep -c '<main id="main"' src/app/layout.tsx` returns 1
    - `grep -c 'href="#main"' src/app/layout.tsx` returns 1
    - `grep -cE 'animate|pulse|blink' src/app/layout.tsx` returns 0 (anti-sensationalism)
  </acceptance_criteria>
  <done>Root layout SSR-renders the disclaimer footer with all 6 emergency tokens. Skip link works. Plan 02's disclaimer.spec.ts (2 tests) passes against the live build.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: /privacidade LGPD page (7 sections + SourceLink dogfood)</name>
  <read_first>
    - .planning/phases/01-skeleton-oss-foundation/01-SPEC.md (REQ-S1.08)
    - .planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md (D-05 LinkedIn, D-06 version format)
    - .planning/phases/01-skeleton-oss-foundation/01-RESEARCH.md (Open Question 3 + planner answer #3 — YES dogfood SourceLink)
    - src/lib/messages.ts (privacy.sections labels + privacy.contactUrl + privacy.version)
    - src/components/SourceLink.tsx (the component being dogfooded)
    - tests/e2e/privacidade.spec.ts (the contract)
  </read_first>
  <behavior>
    - WHEN GET /privacidade responds (JS disabled), THEN HTML contains the literal text from messages.privacy.sections for all 7 keys (coletamos, retencao, paraQue, naoColetamos, direitos, contato, versao) AND the literal "LGPD".
    - WHEN the contact section renders, THEN the LinkedIn URL appears via `<SourceLink>` (verifiable: HTML output contains `font-mono` span wrapping `www.linkedin.com`).
    - The page MUST be a Server Component (no `'use client'`).
  </behavior>
  <files>src/app/privacidade/page.tsx</files>
  <action>
    Create `src/app/privacidade/page.tsx` (Server Component) with EXACTLY this structure (PT-BR draft completo per REQ-S1.08 + D-05 + D-06 + planner answer #3):

    ```tsx
    import { messages } from "@/lib/messages";
    import { SourceLink } from "@/components/SourceLink";

    export const metadata = {
      title: "Privacidade · ENSO Brasil",
      description: "Política de privacidade conforme a LGPD.",
    };

    export default function PrivacyPage() {
      const s = messages.privacy.sections;
      return (
        <article className="mx-auto max-w-2xl p-4">
          <h1>Privacidade · LGPD</h1>

          <section>
            <h2>{s.coletamos}</h2>
            <p>
              Logs de servidor: endereço IP, user-agent, URL acessada, timestamp.
              Esses dados são padrão de qualquer servidor web e nos ajudam a
              identificar erros e abuso.
            </p>
          </section>

          <section>
            <h2>{s.retencao}</h2>
            <p>
              Logs operacionais são retidos por 30 dias e então descartados
              automaticamente. Métricas agregadas (sem identificação individual)
              podem ser mantidas por mais tempo para acompanhamento de uso.
            </p>
          </section>

          <section>
            <h2>{s.paraQue}</h2>
            <p>
              Debug de erros, métricas agregadas de uso, segurança (mitigação de
              abuso e ataques). Nada é compartilhado com terceiros para fins
              comerciais.
            </p>
          </section>

          <section>
            <h2>{s.naoColetamos}</h2>
            <ul>
              <li>Cookies de tracking ou analytics que identifiquem usuários individualmente</li>
              <li>Identificadores cross-site</li>
              <li>Dados pessoais voluntários (não há cadastro, login, ou formulários de contato)</li>
              <li>Localização precisa via GPS ou similar</li>
            </ul>
          </section>

          <section>
            <h2>{s.direitos}</h2>
            <p>
              Sob a LGPD (Lei 13.709/2018), você tem direito a: acesso aos seus
              dados, correção, exclusão, portabilidade, revogação de consentimento,
              e informação sobre uso. Como o ENSO Brasil não coleta dados pessoais
              identificáveis além de logs operacionais limitados, o exercício
              desses direitos no v1 se limita a solicitar a exclusão antecipada
              de logs associados ao seu IP via o canal de contato abaixo.
            </p>
          </section>

          <section>
            <h2>{s.contato}</h2>
            <p>
              Para todas as questões — solicitações LGPD, disclosure de
              segurança, dúvidas gerais — entre em contato com{" "}
              {messages.privacy.contactName} via:{" "}
              <SourceLink href={messages.privacy.contactUrl} name="LinkedIn" />.
              Quando o domínio próprio for adquirido (previsto na fase de
              lançamento), este canal será atualizado para um e-mail dedicado.
            </p>
          </section>

          <section>
            <h2>{s.versao}</h2>
            <p>{messages.privacy.version}</p>
          </section>
        </article>
      );
    }
    ```

    Then run the privacidade e2e test:
    ```
    pnpm exec playwright test tests/e2e/privacidade.spec.ts
    ```
    Test MUST pass.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm exec tsc --noEmit && pnpm exec playwright test tests/e2e/privacidade.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm exec tsc --noEmit` exits 0
    - `pnpm exec playwright test tests/e2e/privacidade.spec.ts` exits 0
    - File `src/app/privacidade/page.tsx` exists
    - `grep -c "'use client'" src/app/privacidade/page.tsx` returns 0 (Server Component)
    - `grep -c "import { SourceLink }" src/app/privacidade/page.tsx` returns 1 (planner answer #3 dogfood)
    - `grep -c "messages.privacy.contactUrl" src/app/privacidade/page.tsx` returns 1
    - `grep -c "messages.privacy.version" src/app/privacidade/page.tsx` returns 1
    - `grep -c "<h2>{s\." src/app/privacidade/page.tsx` returns 7 (all 7 sections render via messages)
    - `grep -c "13.709" src/app/privacidade/page.tsx` >= 1 (LGPD law citation)
  </acceptance_criteria>
  <done>/privacidade ships with 7 LGPD sections SSR-rendered. SourceLink dogfooded on the LinkedIn contact line per planner answer #3. Plan 02's privacidade.spec.ts passes.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: GitHub Actions CI workflow (lean, < 4 min, no Playwright cache)</name>
  <read_first>
    - .planning/phases/01-skeleton-oss-foundation/01-SPEC.md (REQ-S1.06 — < 4 min budget)
    - .planning/phases/01-skeleton-oss-foundation/01-RESEARCH.md (Pattern 7, Pitfall 4, Pitfall 5)
    - .planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md (D-04 gitleaks tier 2, D-11 knip)
  </read_first>
  <files>.github/workflows/ci.yml</files>
  <action>
    Create `.github/workflows/ci.yml` with EXACTLY (RESEARCH Pattern 7):

    ```yaml
    name: CI

    on:
      pull_request:
      push:
        branches: [main]

    jobs:
      ci:
        runs-on: ubuntu-latest
        timeout-minutes: 6
        steps:
          - uses: actions/checkout@v4
            with:
              fetch-depth: 0  # gitleaks needs full history for diff scan

          - uses: pnpm/action-setup@v4
            with:
              version: latest

          - uses: actions/setup-node@v4
            with:
              node-version: 24
              cache: pnpm

          - name: Install dependencies
            run: pnpm install --frozen-lockfile

          - name: Typecheck
            run: pnpm exec tsc --noEmit

          - name: Lint
            run: pnpm lint

          - name: Knip (unused exports / dead deps)
            run: pnpm exec knip

          - name: Unit tests (Vitest)
            run: pnpm test

          # Pitfall 4: do NOT cache Playwright browsers — restore time ~ download time,
          # OS deps still need install. Just run fresh each time.
          - name: Install Playwright browsers
            run: pnpm exec playwright install --with-deps chromium

          - name: E2E smoke tests (Playwright)
            run: pnpm exec playwright test

          # D-04 tier 2: gitleaks runs in CI in addition to pre-commit (defense in depth)
          - name: Gitleaks scan
            uses: gitleaks/gitleaks-action@v2
            env:
              GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    ```

    Validate the YAML is parseable:
    ```
    node -e "const yaml=require('js-yaml'); yaml.load(require('fs').readFileSync('.github/workflows/ci.yml','utf8'))"
    ```
    (If `js-yaml` is not installed, install transiently: `pnpm dlx js-yaml --version` — or alternatively use `npx --yes yaml-lint .github/workflows/ci.yml`.)

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && grep -c "playwright install --with-deps" .github/workflows/ci.yml && grep -c "gitleaks/gitleaks-action@v2" .github/workflows/ci.yml && ! grep -E "actions/cache.*ms-playwright|cache.*playwright/browsers" .github/workflows/ci.yml</automated>
  </verify>
  <acceptance_criteria>
    - File `.github/workflows/ci.yml` exists
    - `grep -c "node-version: 24" .github/workflows/ci.yml` returns 1
    - `grep -c "cache: pnpm" .github/workflows/ci.yml` returns 1
    - `grep -c "pnpm install --frozen-lockfile" .github/workflows/ci.yml` returns 1
    - `grep -c "tsc --noEmit" .github/workflows/ci.yml` returns 1
    - `grep -c "pnpm lint" .github/workflows/ci.yml` returns 1
    - `grep -c "pnpm exec knip" .github/workflows/ci.yml` returns 1 (D-11)
    - `grep -c "pnpm test" .github/workflows/ci.yml` returns >= 1
    - `grep -c "playwright install --with-deps" .github/workflows/ci.yml` returns 1
    - `grep -c "playwright test" .github/workflows/ci.yml` returns >= 1
    - `grep -c "gitleaks/gitleaks-action@v2" .github/workflows/ci.yml` returns 1 (D-04 tier 2)
    - `grep -cE "actions/cache.*ms-playwright|path:.*playwright" .github/workflows/ci.yml` returns 0 (Pitfall 4 — Playwright browsers MUST NOT be cached)
    - `grep -c "timeout-minutes:" .github/workflows/ci.yml` returns 1
  </acceptance_criteria>
  <done>CI workflow runs typecheck + lint + knip + Vitest + Playwright (no browser cache) + gitleaks. Budget timeout 6 min, target < 4 min. Will validate end-to-end after first PR push (next checkpoint).</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Human verification — public repo + first CI run + branch protection</name>
  <what-built>
    Plan 01 + 02 + 03 + 04 produced: Next 16 scaffold, full tooling/test stack, theme tokens, locked PT-BR strings, SourceLink, OSS files, Renovate. This plan added the SSR layout, /privacidade page, and CI workflow. Everything that Claude can automate is done. The remaining steps require human credentials (GitHub repo creation, push, branch protection enable, PR review).
  </what-built>
  <how-to-verify>
    1. **Repo public + initial push:**
       - Run `gh repo create CarlosHenriqueMkt/enso-brasil --public --source=. --remote=origin --description "Agregador público de alertas climáticos no Brasil. PT-BR. MIT."` (or use the GitHub web UI if `gh` is not authenticated).
       - Push: `git push -u origin main`
       - Confirm `git clone https://github.com/CarlosHenriqueMkt/enso-brasil` works in a fresh terminal as an unauthenticated user.

    2. **First CI run green:**
       - Open a throwaway PR (e.g. `git checkout -b ci-smoke && echo "" >> README.md && git commit -am "chore: trigger first CI run" && git push -u origin ci-smoke`).
       - Open PR via `gh pr create --fill`.
       - Watch `gh pr checks --watch`. CI must finish green within 6 minutes.
       - If green: merge the PR (or close — the test was just to validate the workflow).
       - If red: capture the failure, type "issue: " + paste the failing step.

    3. **Branch protection on main (D-09):**
       - Visit https://github.com/CarlosHenriqueMkt/enso-brasil/settings/branches
       - Add rule for `main`:
         - Require pull request before merging: 1 approval
         - Require status checks to pass: select `ci`
         - Require linear history: ON
         - Do not allow force pushes: ON
         - Do not allow deletions: ON
         - Allow specified actors to bypass required pull requests: add yourself (CarlosHenriqueMkt) as the bypass actor (Pitfall 7 solo-dev workaround documented in CONTRIBUTING.md)
       - Save.

    4. **Smoke checks on the deployed site (optional in P1 — Vercel deploy is P7, but local pnpm start is verifiable now):**
       - `pnpm build && pnpm start`
       - Open http://localhost:3000/ in a browser with JS disabled (DevTools -> Settings -> Debugger -> Disable JavaScript). Confirm:
         - Disclaimer text "Este site agrega informações de fontes oficiais. Não substitui sistemas oficiais de alerta. Em emergência, ligue:" is visible
         - "199 Defesa Civil · 193 Bombeiros · 190 Polícia" is visible (mono font)
         - Tab key reveals "Pular para o conteúdo principal" skip link
         - `<html lang="pt-BR">` (View Source -> first line)
       - Open http://localhost:3000/privacidade with JS disabled. Confirm:
         - Title "Privacidade · LGPD" is visible
         - All 7 section headings appear in PT-BR
         - LinkedIn link renders with `(www.linkedin.com)` in mono font next to it (SourceLink dogfood — planner answer #3)
         - Disclaimer footer ALSO appears here (inherited from root layout)

    5. **Final SPEC acceptance grep gate:**
       - `pnpm build` succeeds
       - `grep -r "fonts.googleapis" .next/` returns empty (system fonts only)
       - `grep -rE "next-intl|/\[locale\]" src/ package.json` returns empty (no i18n)

  </how-to-verify>
  <resume-signal>Type "approved" if all 5 checks pass; or "issue: ..." describing what failed.</resume-signal>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                           | Description                                                              |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Internet -> /privacidade           | Public LGPD page; no input handling but SEO bots crawl it                |
| GitHub PR contributor -> CI runner | External PRs run CI workflow with repo secrets (GITHUB_TOKEN only in P1) |
| CI runner -> gitleaks scan         | Secret leaks blocked at merge gate (tier 2 of D-04)                      |

## STRIDE Threat Register

| Threat ID | Category               | Component                                           | Disposition | Mitigation Plan                                                                                                                                |
| --------- | ---------------------- | --------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| T-01-11   | Spoofing               | Disclaimer rendered as Client Component (Pitfall 2) | mitigate    | layout.tsx has no `'use client'`; `<automated>` test asserts grep-count of `'use client'` is 0; Playwright JS-disabled test catches regression |
| T-01-12   | Information Disclosure | Secret committed bypasses pre-commit                | mitigate    | gitleaks-action@v2 runs in CI as tier 2 of D-04 (defense in depth) — blocks merge even if local pre-commit was skipped                         |
| T-01-13   | Tampering              | Force-push rewrites main history                    | mitigate    | Branch protection (Task 4 step 3) disables force-push and deletion on main per D-09                                                            |
| T-01-14   | Elevation of Privilege | External PR exfiltrates secrets via CI              | accept      | P1 has no secrets beyond auto-provided GITHUB_TOKEN; Renovate token added in P2+ will need pull_request_target hardening at that point         |
| T-01-15   | Information Disclosure | /privacidade leaks more than declared               | mitigate    | Page is static SSR — content is the policy itself; no data binding to user state in P1                                                         |

</threat_model>

<verification>
After human checkpoint completes:
- `gh repo view CarlosHenriqueMkt/enso-brasil --json visibility -q .visibility` returns `"PUBLIC"`
- `gh pr checks` on the smoke PR shows all checks green
- `gh api repos/CarlosHenriqueMkt/enso-brasil/branches/main/protection` returns 200 with `required_pull_request_reviews.required_approving_review_count >= 1` and `allow_force_pushes.enabled == false`
- All Wave-0 e2e tests pass (`pnpm exec playwright test` exits 0)
- All SPEC acceptance criteria checked off (manual review against 01-SPEC.md §Acceptance Criteria)
</verification>

<success_criteria>
Phase 1 success criteria from ROADMAP all satisfied:

1. Public GitHub repo with MIT LICENSE, README (PT-BR), CONTRIBUTING, CODE_OF_CONDUCT — covered by plan 04 + Task 4 step 1
2. `pnpm build` succeeds; `/` and `/privacidade` render server-side without errors — covered by Tasks 1-2 + Task 4 step 4
3. GitHub Actions CI runs typecheck, lint, Vitest, Playwright on PR; passes on main — covered by Task 3 + Task 4 step 2
4. Visiting `/` and `/privacidade` with JS disabled still shows disclaimer text — covered by Tasks 1-2 + Task 4 step 4
   </success_criteria>

<output>
After completion, create `.planning/phases/01-skeleton-oss-foundation/01-05-SUMMARY.md`
</output>
