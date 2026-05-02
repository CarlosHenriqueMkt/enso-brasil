---
phase: 01-skeleton-oss-foundation
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - package.json
  - .prettierrc
  - .lintstagedrc.json
  - .husky/pre-commit
  - .gitleaks.toml
  - vitest.config.ts
  - playwright.config.ts
  - tests/e2e/disclaimer.spec.ts
  - tests/e2e/privacidade.spec.ts
  - src/lib/messages.test.ts
  - src/components/SourceLink.test.tsx
autonomous: true
requirements:
  - FOUND-05
user_setup:
  - service: gitleaks
    why: "Pre-commit + CI secret scan (D-04)"
    env_vars: []
    dashboard_config:
      - task: "Install gitleaks binary: `winget install gitleaks` (Windows) | `brew install gitleaks` (mac) | GH releases binary (linux). Verify `gitleaks version` works."
        location: "local machine"

must_haves:
  truths:
    - 'Pre-commit hook blocks a commit containing `SECRET_TOKEN="abc123"`'
    - "Pre-commit hook runs ESLint --fix + Prettier --write on staged TS/TSX files"
    - "`pnpm test` (Vitest) and `pnpm exec playwright test` exit 0 against Wave-0 test stubs"
    - "Vitest excludes the Playwright dir; Playwright excludes Vitest specs"
  artifacts:
    - path: "package.json"
      provides: "devDeps for prettier, husky, lint-staged, vitest, @vitejs/plugin-react, jsdom, @playwright/test, knip + scripts (test, lint, format, prepare)"
      contains: '"vitest"'
    - path: ".husky/pre-commit"
      provides: "Husky 9 pre-commit hook running lint-staged + gitleaks"
      contains: "gitleaks protect --staged"
    - path: ".lintstagedrc.json"
      provides: "ESLint+Prettier on TS/TSX, Prettier on json/md/css"
      contains: "eslint --fix"
    - path: ".prettierrc"
      provides: "Project Prettier config (community defaults — singleQuote false, trailingComma all, printWidth 100, semi true)"
    - path: "vitest.config.ts"
      provides: "Vitest jsdom + react plugin; excludes tests/e2e"
      contains: "tests/e2e"
    - path: "playwright.config.ts"
      provides: "Playwright config with webServer = pnpm build && pnpm start, baseURL localhost:3000"
      contains: "pnpm build && pnpm start"
    - path: "tests/e2e/disclaimer.spec.ts"
      provides: "Wave-0 placeholder e2e test (will assert SSR disclaimer once plan 05 wires the footer)"
    - path: "tests/e2e/privacidade.spec.ts"
      provides: "Wave-0 placeholder e2e test for /privacidade (plan 05 wires the page)"
    - path: "src/lib/messages.test.ts"
      provides: "Wave-0 unit test for messages.emergency.inline (plan 03 creates messages.ts)"
    - path: "src/components/SourceLink.test.tsx"
      provides: "Wave-0 Vitest snapshot test for SourceLink (plan 03 creates the component)"
  key_links:
    - from: ".husky/pre-commit"
      to: "lint-staged + gitleaks binary"
      via: "shell exec"
      pattern: "pnpm exec lint-staged.*gitleaks protect"
    - from: "vitest.config.ts"
      to: "tests/e2e exclusion"
      via: "exclude array"
      pattern: "tests/e2e"
---

<objective>
Wire all dev-tooling and test scaffolding so the rest of the wave can implement against working test runners. Per RESEARCH §Validation Architecture Wave 0 Gaps, this plan creates the test files BEFORE the source files they target — plans 03 and 05 implement to make these tests pass (Nyquist).

Purpose: One plan owns ALL config + test scaffolding so plans 03 and 05 don't fight over package.json. Test files are placeholders here (skip if target file missing) and become real assertions once their target source lands.
Output: Prettier + Husky + lint-staged + gitleaks pre-commit + Vitest config + Playwright config + 4 Wave-0 test stubs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-skeleton-oss-foundation/01-SPEC.md
@.planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md
@.planning/phases/01-skeleton-oss-foundation/01-RESEARCH.md

<interfaces>
RESEARCH §Standard Stack verified versions (2026-04-30):
- prettier ^3 (3.8.3) · husky ^9 (9.1.7) · lint-staged ^16 (16.4.0)
- vitest ^4 (4.1.5) · @vitejs/plugin-react latest · jsdom latest
- @playwright/test ^1 (1.59.1) · knip ^6 (6.9.0)

D-04: gitleaks runs in TWO places — pre-commit (here) AND CI (plan 05).
D-10: ESLint + Prettier (Biome rejected).
D-11: knip in CI (plan 05).

Anti-patterns:

- Custom regex for secret detection (D-04 explicitly replaces — use gitleaks)
- Caching Playwright browsers in CI (Pitfall 4 — plan 05 must NOT add cache)
- Vitest scanning `tests/e2e/**` (will fail; Playwright dir must be excluded)

Test files target (Wave 0 contract — RESEARCH §Validation Architecture):

- `tests/e2e/disclaimer.spec.ts` → asserts plan 05's footer (SSR with JS off)
- `tests/e2e/privacidade.spec.ts` → asserts plan 05's /privacidade page (7 sections)
- `src/lib/messages.test.ts` → asserts plan 03's `messages.emergency.inline` exact string
- `src/components/SourceLink.test.tsx` → asserts plan 03's SourceLink renders mono-font domain
  </interfaces>
  </context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Install dev tooling + write configs (prettier/husky/lint-staged/gitleaks)</name>
  <read_first>
    - .planning/phases/01-skeleton-oss-foundation/01-RESEARCH.md (Pattern 6, Standard Stack, Pitfall 6)
    - .planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md (D-04, D-10, D-11)
    - .planning/phases/01-skeleton-oss-foundation/01-SPEC.md (REQ-S1.05)
    - package.json (current state from plan 01)
  </read_first>
  <files>package.json, .prettierrc, .lintstagedrc.json, .husky/pre-commit, .gitleaks.toml</files>
  <action>
    1. Install devDependencies (single command):
       ```
       pnpm add -D prettier@^3 husky@^9 lint-staged@^16 knip@^6
       ```

    2. Add scripts to `package.json` (merge with existing scripts from create-next-app — keep `dev`, `build`, `start`, `lint`):
       ```json
       {
         "scripts": {
           "format": "prettier --write .",
           "format:check": "prettier --check .",
           "test": "vitest run",
           "test:watch": "vitest",
           "test:e2e": "playwright test",
           "knip": "knip",
           "prepare": "husky"
         }
       }
       ```

    3. Initialize Husky 9: run `pnpm exec husky init`. This creates `.husky/pre-commit` with a default echo. Replace its contents with EXACTLY (per RESEARCH Pattern 6):
       ```sh
       pnpm exec lint-staged
       gitleaks protect --staged --redact --verbose
       ```
       Make sure the file is executable (`chmod +x .husky/pre-commit` on Unix; on Windows git tracks the executable bit via `git update-index --chmod=+x .husky/pre-commit` — run this).

    4. Write `.lintstagedrc.json` (RESEARCH Pattern 6):
       ```json
       {
         "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
         "*.{json,md,css,yml,yaml}": ["prettier --write"]
       }
       ```

    5. Write `.prettierrc` (Claude's discretion per CONTEXT — community defaults, documented):
       ```json
       {
         "semi": true,
         "singleQuote": false,
         "trailingComma": "all",
         "printWidth": 100,
         "tabWidth": 2,
         "useTabs": false,
         "arrowParens": "always",
         "endOfLine": "lf"
       }
       ```

    6. Write `.gitleaks.toml` with a minimal allowlist for the planning artifacts (Pitfall 6 — preempt false positives on .planning/ docs that may contain example tokens):
       ```toml
       # gitleaks default ruleset is used (no custom rules added).
       # Allowlist below scopes-out planning docs that document example secret SHAPES (not real secrets).
       [allowlist]
         description = "Planning documents may reference example secret shapes for documentation"
         paths = [
           '''.planning/.*\.md$''',
           '''.*\.example$''',
         ]
       ```

    7. Verify gitleaks binary is installed: run `gitleaks version`. If it fails, STOP and surface a checkpoint to the user requesting installation per the user_setup block. Do NOT mask gitleaks failure as success.

    8. Validate the pre-commit setup with a destructive test (DO NOT commit the result):
       - Stage a file containing `const FAKE_AWS_KEY = "AKIAIOSFODNN7EXAMPLE";` (this matches gitleaks default rules)
       - Run `pnpm exec lint-staged && gitleaks protect --staged --redact --verbose` directly
       - Confirm it exits non-zero (block)
       - Unstage and delete the test file

    9. Run `pnpm format` once to normalize all files.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && gitleaks version && test -x .husky/pre-commit && grep -c "gitleaks protect --staged" .husky/pre-commit</automated>
  </verify>
  <acceptance_criteria>
    - `gitleaks version` exits 0
    - File `.husky/pre-commit` exists and is executable
    - `grep -c "gitleaks protect --staged" .husky/pre-commit` returns 1
    - `grep -c "pnpm exec lint-staged" .husky/pre-commit` returns 1
    - File `.lintstagedrc.json` parsed JSON has key `*.{ts,tsx,js,jsx}` whose value array contains `"eslint --fix"` AND `"prettier --write"`
    - File `.prettierrc` parsed JSON has `printWidth === 100` AND `semi === true` AND `trailingComma === "all"`
    - File `package.json` `devDependencies` contains keys `prettier`, `husky`, `lint-staged`, `knip` (versions starting `^3`, `^9`, `^16`, `^6` respectively)
    - File `package.json` `scripts` contains keys `format`, `test`, `test:e2e`, `knip`, `prepare`
    - Manual destructive test in step 8: staging `AKIAIOSFODNN7EXAMPLE` triggers gitleaks block (non-zero exit)
  </acceptance_criteria>
  <done>Pre-commit blocks fake AWS-key-shaped string. lint-staged runs eslint+prettier on TS/TSX. All configs match locked decisions D-04, D-10, D-11.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Install Vitest + Playwright + write configs and Wave-0 test stubs</name>
  <read_first>
    - .planning/phases/01-skeleton-oss-foundation/01-RESEARCH.md (Pattern 4, Pattern 5, Validation Architecture, Pitfall 4)
    - .planning/phases/01-skeleton-oss-foundation/01-SPEC.md (REQ-S1.07, REQ-S1.08, REQ-S1.09, REQ-S1.10, REQ-S1.11)
    - .claude/skills/sketch-findings-enso-brasil/SKILL.md (locked emergency string)
  </read_first>
  <behavior>
    Wave-0 test files exist BEFORE their target source. Each test starts skipped or as a guard (file-existence check) so it does not fail in Wave 1 of plan execution. Once plans 03 and 05 land, these tests become live assertions.

    - messages.test.ts: WHEN messages.ts exists, THEN `messages.emergency.inline` === `"199 Defesa Civil · 193 Bombeiros · 190 Polícia"` exactly (locked verbatim from sketch-findings).
    - SourceLink.test.tsx: WHEN component exists, THEN rendering with href="https://alertas.cemaden.gov.br" name="CEMADEN" produces output containing `<span class="font-mono">` wrapping `alertas.cemaden.gov.br`.
    - disclaimer.spec.ts: WHEN homepage built, THEN GET / with JS disabled returns HTML containing all six tokens: "199", "Defesa Civil", "193", "Bombeiros", "190", "Polícia".
    - privacidade.spec.ts: WHEN /privacidade built, THEN GET /privacidade returns HTML containing all 7 LGPD section headings.

  </behavior>
  <files>package.json, vitest.config.ts, playwright.config.ts, tests/e2e/disclaimer.spec.ts, tests/e2e/privacidade.spec.ts, src/lib/messages.test.ts, src/components/SourceLink.test.tsx</files>
  <action>
    1. Install test dev deps:
       ```
       pnpm add -D vitest@^4 @vitejs/plugin-react jsdom @playwright/test@^1
       pnpm exec playwright install --with-deps chromium
       ```

    2. Write `vitest.config.ts` EXACTLY (RESEARCH Pattern 4):
       ```ts
       import { defineConfig } from "vitest/config";
       import react from "@vitejs/plugin-react";

       export default defineConfig({
         plugins: [react()],
         test: {
           environment: "jsdom",
           globals: true,
           exclude: ["**/node_modules/**", "**/tests/e2e/**", "**/.next/**"],
         },
       });
       ```

    3. Write `playwright.config.ts` EXACTLY (RESEARCH Pattern 4):
       ```ts
       import { defineConfig } from "@playwright/test";

       export default defineConfig({
         testDir: "./tests/e2e",
         fullyParallel: true,
         timeout: 30000,
         webServer: {
           command: "pnpm build && pnpm start",
           port: 3000,
           reuseExistingServer: !process.env.CI,
           timeout: 120000,
         },
         use: { baseURL: "http://localhost:3000" },
         projects: [{ name: "chromium", use: { browserName: "chromium" } }],
       });
       ```

    4. Write `src/lib/messages.test.ts` (guarded — passes if messages.ts not yet created; asserts when it exists):
       ```ts
       import { describe, it, expect } from "vitest";
       import { existsSync } from "node:fs";
       import { resolve } from "node:path";

       const messagesPath = resolve(__dirname, "messages.ts");

       describe("messages module", () => {
         it.skipIf(!existsSync(messagesPath))(
           "exports messages.emergency.inline with the locked PT-BR string",
           async () => {
             const mod = await import("./messages");
             expect(mod.messages.emergency.inline).toBe(
               "199 Defesa Civil · 193 Bombeiros · 190 Polícia",
             );
           },
         );

         it.skipIf(!existsSync(messagesPath))(
           "exports messages.disclaimer.body as a non-empty string",
           async () => {
             const mod = await import("./messages");
             expect(typeof mod.messages.disclaimer.body).toBe("string");
             expect(mod.messages.disclaimer.body.length).toBeGreaterThan(20);
           },
         );

         it.skipIf(!existsSync(messagesPath))(
           "contains no i18n / locale references in the messages module",
           async () => {
             const { readFileSync } = await import("node:fs");
             const src = readFileSync(messagesPath, "utf8");
             expect(src).not.toMatch(/next-intl|i18n|useTranslations|locale/i);
           },
         );
       });
       ```

    5. Write `src/components/SourceLink.test.tsx` (guarded snapshot test):
       ```tsx
       import { describe, it, expect } from "vitest";
       import { existsSync } from "node:fs";
       import { resolve } from "node:path";
       import { renderToStaticMarkup } from "react-dom/server";

       const componentPath = resolve(__dirname, "SourceLink.tsx");

       describe("SourceLink", () => {
         it.skipIf(!existsSync(componentPath))(
           "renders the domain wrapped in a font-mono span",
           async () => {
             const { SourceLink } = await import("./SourceLink");
             const html = renderToStaticMarkup(
               <SourceLink href="https://alertas.cemaden.gov.br" name="CEMADEN" />,
             );
             expect(html).toContain("CEMADEN");
             expect(html).toMatch(/<span[^>]*class="[^"]*font-mono[^"]*"[^>]*>[^<]*alertas\.cemaden\.gov\.br/);
             expect(html).toContain('rel="noopener noreferrer"');
             expect(html).toContain('target="_blank"');
           },
         );
       });
       ```
       Add `react-dom` to test resolution if needed (it's already in dependencies from plan 01).

    6. Write `tests/e2e/disclaimer.spec.ts` (RESEARCH Pattern 5 + REQ-S1.07 + REQ-S1.09):
       ```ts
       import { test, expect } from "@playwright/test";

       test("home renders <html lang='pt-BR'> and skip link is reachable via Tab", async ({ page }) => {
         await page.goto("/");
         const lang = await page.locator("html").getAttribute("lang");
         expect(lang).toBe("pt-BR");
         // Skip link should exist and contain the locked PT-BR text
         const skipLink = page.locator('a[href="#main"]');
         await expect(skipLink).toHaveText(/Pular para o conteúdo principal/);
       });

       test("disclaimer renders SSR with all 3 emergency contacts paired with agency names (JS disabled)", async ({ browser }) => {
         const ctx = await browser.newContext({ javaScriptEnabled: false });
         const page = await ctx.newPage();
         await page.goto("/");
         const html = await page.content();
         // Locked sketch-findings rule: NEVER bare numbers — always paired with agency
         expect(html).toContain("199");
         expect(html).toContain("Defesa Civil");
         expect(html).toContain("193");
         expect(html).toContain("Bombeiros");
         expect(html).toContain("190");
         expect(html).toContain("Polícia");
         // Aggregator stance per CLAUDE.md
         expect(html).toMatch(/não substitui sistemas oficiais/i);
         await ctx.close();
       });
       ```

    7. Write `tests/e2e/privacidade.spec.ts` (REQ-S1.08 — 7 LGPD sections):
       ```ts
       import { test, expect } from "@playwright/test";

       test("/privacidade renders all 7 LGPD sections SSR (JS disabled)", async ({ browser }) => {
         const ctx = await browser.newContext({ javaScriptEnabled: false });
         const page = await ctx.newPage();
         await page.goto("/privacidade");
         const html = await page.content();
         // 7 sections per REQ-S1.08
         expect(html).toMatch(/O que coletamos/i);
         expect(html).toMatch(/Por quanto tempo/i);
         expect(html).toMatch(/Para qu[êe]/i);
         expect(html).toMatch(/O que NÃO coletamos/i);
         expect(html).toMatch(/Direitos do titular/i);
         expect(html).toMatch(/Contato/i);
         expect(html).toMatch(/Vers[ãa]o/i);
         // PT-BR + LGPD anchor terms
         expect(html).toMatch(/LGPD/);
         await ctx.close();
       });
       ```

    8. Run vitest once to confirm zero failures (skipped tests OK):
       ```
       pnpm test
       ```
       Expected: 4 tests reported as skipped (or 0 ran), zero failures.

    9. Run a one-off Playwright dry-run to confirm config loads (do NOT spin webServer here — that requires the full plan 05 to ship). Use `pnpm exec playwright test --list` which only enumerates tests:
       ```
       pnpm exec playwright test --list
       ```
       Expected: lists 3 test cases across 2 spec files, exits 0.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm test && pnpm exec playwright test --list</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test` exits 0 (Vitest runs; tests are skipped via `it.skipIf` because target source files don't exist yet — that is the expected Wave-0 state)
    - `pnpm exec playwright test --list` exits 0 and stdout includes `disclaimer.spec.ts` AND `privacidade.spec.ts`
    - File `vitest.config.ts` `grep -c "tests/e2e" vitest.config.ts` returns >= 1
    - File `playwright.config.ts` `grep -c "pnpm build && pnpm start" playwright.config.ts` returns 1
    - File `playwright.config.ts` `grep -c "testDir.*tests/e2e" playwright.config.ts` returns 1
    - File `tests/e2e/disclaimer.spec.ts` `grep -c "javaScriptEnabled: false" tests/e2e/disclaimer.spec.ts` returns 1
    - File `tests/e2e/disclaimer.spec.ts` contains literal strings: `"199"`, `"Defesa Civil"`, `"193"`, `"Bombeiros"`, `"190"`, `"Polícia"` (all six — verify via 6 separate `grep -c` invocations each returning >= 1)
    - File `tests/e2e/privacidade.spec.ts` contains 7 LGPD section regex patterns (`grep -cE "O que coletamos|Por quanto tempo|Direitos do titular" tests/e2e/privacidade.spec.ts` returns >= 3)
    - File `src/lib/messages.test.ts` contains the literal locked string `"199 Defesa Civil · 193 Bombeiros · 190 Polícia"` (`grep -F -c "199 Defesa Civil · 193 Bombeiros · 190 Polícia" src/lib/messages.test.ts` returns 1)
    - File `src/components/SourceLink.test.tsx` `grep -c "font-mono" src/components/SourceLink.test.tsx` returns >= 1
    - File `package.json` `devDependencies` contains `vitest`, `@vitejs/plugin-react`, `jsdom`, `@playwright/test`
  </acceptance_criteria>
  <done>Vitest + Playwright installed and configured. Wave-0 test files exist with guards. Locked emergency string `"199 Defesa Civil · 193 Bombeiros · 190 Polícia"` is asserted verbatim in BOTH unit and e2e tests. Tests will activate automatically when plans 03 and 05 ship the source files.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                     | Description                                                  |
| ---------------------------- | ------------------------------------------------------------ |
| developer machine → git repo | Untrusted strings (potential secrets) flow through `git add` |

## STRIDE Threat Register

| Threat ID | Category               | Component                             | Disposition | Mitigation Plan                                                                                                                              |
| --------- | ---------------------- | ------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| T-01-04   | Information Disclosure | Pre-commit secret leak                | mitigate    | gitleaks runs in `.husky/pre-commit` (D-04 tier 1); validated via destructive AWS-key test in step 8; tier 2 enforcement lives in plan 05 CI |
| T-01-05   | Denial of Service      | gitleaks false positive blocks commit | accept      | `.gitleaks.toml` allowlist scopes-out planning docs (Pitfall 6); developer can use `# gitleaks:allow` inline for legitimate edge cases       |

</threat_model>

<verification>
`gitleaks version` succeeds. `pnpm test` exits 0 (skipped tests). `pnpm exec playwright test --list` exits 0 with both spec files enumerated. Destructive AWS-key staging test in task 1 step 8 was blocked.
</verification>

<success_criteria>
Pre-commit secret scan blocks AWS-key-shaped strings. Vitest + Playwright configs honor mutual-exclusion (Pattern 4). Wave-0 test stubs encode REQ-S1.07/08/09/10/11 assertions and activate when target source files appear.
</success_criteria>

<output>
After completion, create `.planning/phases/01-skeleton-oss-foundation/01-02-SUMMARY.md`
</output>
