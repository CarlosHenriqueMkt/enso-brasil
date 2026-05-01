---
phase: 02-data-foundation
plan: 10
type: execute
wave: 6
depends_on: [02]
files_modified:
  - docker-compose.test.yml
  - tests/setup/db.ts
  - vitest.config.ts
  - .github/workflows/ci.yml
  - CONTRIBUTING.md
autonomous: true
requirements:
  - REQ-S2.01
  - REQ-S2.07
  - REQ-S2.08
  - REQ-S2.10
  - REQ-S2.11

must_haves:
  truths:
    - "docker-compose.test.yml spins up postgres:17-alpine on port 5433 (D-02)"
    - "tests/setup/db.ts runs drizzle migrations against DATABASE_URL_TEST + truncates tables between tests for isolation"
    - "vitest.config.ts setupFiles wires tests/setup/db.ts; pool: 'forks' for PG isolation"
    - "CI ci.yml updated: postgres:17-alpine services block + db:migrate step before vitest; GH Actions versions bumped per RESEARCH (checkout@v6, setup-node@v6, pnpm/action-setup@v5)"
    - "All previously-gated integration tests (states/health/ingest/archive) now run automatically when DATABASE_URL_TEST is set"
    - "CONTRIBUTING.md gains 'Como rodar testes' section explaining docker-compose flow"
  artifacts:
    - path: "docker-compose.test.yml"
      provides: "service `postgres`: image postgres:17-alpine, port 5433:5432, env POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres POSTGRES_DB=test, ephemeral (no volumes)"
      contains: "postgres:17-alpine"
    - path: "tests/setup/db.ts"
      provides: "vitest beforeAll: applies drizzle migrations to DATABASE_URL_TEST; beforeEach: truncates alerts, sources_health, snapshot_cache, snapshot_archive"
      contains: "DATABASE_URL_TEST"
    - path: "vitest.config.ts"
      provides: "setupFiles: ['./tests/setup/db.ts']; pool: 'forks'; preserves jsdom env + tests/e2e exclusion from P1"
      contains: "setupFiles"
    - path: ".github/workflows/ci.yml"
      provides: "postgres:17-alpine services block; env DATABASE_URL_TEST; pnpm db:migrate step before pnpm test; bumped action versions"
      contains: "postgres:17-alpine"
    - path: "CONTRIBUTING.md"
      provides: "'Como rodar testes' section: docker compose up, pnpm test, docker compose down"
  key_links:
    - from: "vitest.config.ts"
      to: "tests/setup/db.ts"
      via: "setupFiles"
      pattern: "setupFiles.*tests/setup/db"
    - from: ".github/workflows/ci.yml services postgres"
      to: "DATABASE_URL_TEST env"
      via: "GitHub Actions services exposed via localhost:5432 in container"
      pattern: "postgres://postgres:postgres@localhost"
---

<objective>
Wire docker-compose Postgres for local + GH Actions services for CI (D-02). Make all integration tests in plans 02-07/02-08/02-09 actually run.

Purpose: Without this plan, the integration tests sit gated on DATABASE_URL_TEST and never execute. This plan flips them on. Also bumps GH Actions versions per RESEARCH action items #6.
Output: docker-compose.test.yml + setup hook + vitest config update + CI update + CONTRIBUTING entry.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-data-foundation/02-CONTEXT.md
@.planning/phases/02-data-foundation/02-RESEARCH.md
@.github/workflows/ci.yml
@vitest.config.ts

<interfaces>
D-02 Test DB:
  docker-compose.test.yml: postgres:17-alpine, port 5433, ephemeral
  CI: GH Actions services block (same image)
  DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5433/test (local)
  CI: postgres://postgres:postgres@localhost:5432/test (GH services exposed on 5432)

RESEARCH §GitHub Actions: bump checkout@v6, setup-node@v6, pnpm/action-setup@v5 (drop with.version), gitleaks-action@v2.3.9

Existing CI sequence (P1):
install → typecheck → lint → knip → vitest → playwright install → playwright test → gitleaks
New sequence (P2):
install → db:migrate (test PG) → typecheck → lint → knip → vitest → playwright install → playwright test → gitleaks
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: docker-compose.test.yml + tests/setup/db.ts + vitest.config.ts wiring</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-CONTEXT.md (D-02)
    - vitest.config.ts (current — preserve jsdom env + tests/e2e exclusion)
    - src/db/schema.ts (table list for truncation)
  </read_first>
  <files>docker-compose.test.yml, tests/setup/db.ts, vitest.config.ts</files>
  <action>
    1. Write `docker-compose.test.yml`:
       ```yaml
       version: "3.9"

       services:
         postgres:
           image: postgres:17-alpine
           container_name: enso-test-pg
           environment:
             POSTGRES_USER: postgres
             POSTGRES_PASSWORD: postgres
             POSTGRES_DB: test
           ports:
             - "5433:5432"
           healthcheck:
             test: ["CMD-SHELL", "pg_isready -U postgres -d test"]
             interval: 2s
             timeout: 3s
             retries: 10
       ```

    2. Write `tests/setup/db.ts`:
       ```ts
       import { Pool } from "@neondatabase/serverless";
       import { drizzle } from "drizzle-orm/neon-serverless";
       import { migrate } from "drizzle-orm/neon-serverless/migrator";
       import { afterAll, beforeAll, beforeEach } from "vitest";
       import { sql } from "drizzle-orm";

       const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;

       let pool: Pool | null = null;

       beforeAll(async () => {
         if (!url) return; // skip-mode: integration tests gated themselves on DATABASE_URL_TEST
         // Make app code (which reads DATABASE_URL) hit the test DB
         process.env.DATABASE_URL = url;
         pool = new Pool({ connectionString: url });
         const db = drizzle(pool);
         await migrate(db, { migrationsFolder: "./drizzle/migrations" });
       });

       beforeEach(async () => {
         if (!pool) return;
         const db = drizzle(pool);
         // Truncate every test table for isolation. Add tables here as schema grows.
         await db.execute(sql`TRUNCATE TABLE alerts, sources_health, snapshot_cache, snapshot_archive RESTART IDENTITY CASCADE`);
       });

       afterAll(async () => {
         await pool?.end();
       });
       ```
       NOTE: neon-serverless Pool over WebSocket can connect to a vanilla PG server using the `webSocketConstructor` shim — for local docker PG you may need `import { neonConfig } from "@neondatabase/serverless"; neonConfig.webSocketConstructor = require('ws')` AND install `ws`. If issues arise during execution, an alternative is to switch tests/setup/db.ts to use `pg` package directly. Decision documented inline as a known follow-up; keep neon-serverless first attempt; if tests can't connect to localhost:5433 PG, add `ws` to devDeps and configure neonConfig (or add `pg` as a test-only dep). Document the decision in 02-10-SUMMARY.md.

    3. Update `vitest.config.ts` (preserve P1 settings):
       ```ts
       import { defineConfig } from "vitest/config";
       import react from "@vitejs/plugin-react";

       export default defineConfig({
         plugins: [react()],
         test: {
           environment: "jsdom",
           globals: true,
           pool: "forks",
           setupFiles: ["./tests/setup/db.ts"],
           exclude: ["**/node_modules/**", "**/tests/e2e/**", "**/.next/**"],
         },
       });
       ```

    4. Local smoke (assumes Docker is running):
       ```
       docker compose -f docker-compose.test.yml up -d
       export DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5433/test
       pnpm db:migrate
       pnpm test
       docker compose -f docker-compose.test.yml down
       ```
       All previously-gated integration tests should now run. If `ws` is required for neon-serverless against localhost PG, install it: `pnpm add -D ws @types/ws` and add the neonConfig shim at top of tests/setup/db.ts. Note: if Docker is unavailable on the runner machine, gracefully skip the smoke and rely on CI to validate (CI uses GH services block).

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && test -f docker-compose.test.yml && grep -c "postgres:17-alpine" docker-compose.test.yml && test -f tests/setup/db.ts && grep -c "DATABASE_URL_TEST" tests/setup/db.ts && grep -c "setupFiles" vitest.config.ts && grep -c "TRUNCATE" tests/setup/db.ts</automated>
  </verify>
  <acceptance_criteria>
    - File `docker-compose.test.yml` exists with service `postgres`, image `postgres:17-alpine`, port mapping `5433:5432`
    - File `tests/setup/db.ts` exists; contains `migrate(`, `TRUNCATE`, `beforeAll`, `beforeEach`
    - File `vitest.config.ts` `grep -c "setupFiles" vitest.config.ts` returns 1
    - File `vitest.config.ts` `grep -c "pool: \"forks\"" vitest.config.ts` returns 1
    - File `vitest.config.ts` still excludes `tests/e2e` (P1 invariant): `grep -c "tests/e2e" vitest.config.ts` returns >= 1
    - Local smoke (when Docker available): full `pnpm test` exits 0 with previously-gated integration tests now executing (they no longer skip)
  </acceptance_criteria>
  <done>Docker PG + setup hook + vitest config wired. Integration tests now actually run when DATABASE_URL_TEST is set.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Update CI ci.yml — postgres services + db:migrate + version bumps + CONTRIBUTING entry</name>
  <read_first>
    - .github/workflows/ci.yml (P1 baseline)
    - .planning/phases/02-data-foundation/02-RESEARCH.md (§GitHub Actions Versions, action items #6, #7)
  </read_first>
  <files>.github/workflows/ci.yml, CONTRIBUTING.md</files>
  <action>
    1. Rewrite `.github/workflows/ci.yml`:
       ```yaml
       name: CI

       on:
         pull_request:
         push:
           branches: [main]

       jobs:
         ci:
           runs-on: ubuntu-latest
           timeout-minutes: 8

           services:
             postgres:
               image: postgres:17-alpine
               env:
                 POSTGRES_USER: postgres
                 POSTGRES_PASSWORD: postgres
                 POSTGRES_DB: test
               ports:
                 - 5432:5432
               options: >-
                 --health-cmd "pg_isready -U postgres -d test"
                 --health-interval 2s
                 --health-timeout 3s
                 --health-retries 10

           env:
             DATABASE_URL: postgres://postgres:postgres@localhost:5432/test
             DATABASE_URL_TEST: postgres://postgres:postgres@localhost:5432/test

           steps:
             - uses: actions/checkout@v6
               with:
                 fetch-depth: 0

             - uses: pnpm/action-setup@v5

             - uses: actions/setup-node@v6
               with:
                 node-version: 24
                 cache: pnpm

             - name: Install dependencies
               run: pnpm install --frozen-lockfile

             - name: Apply migrations to test DB
               run: pnpm db:migrate

             - name: Typecheck
               run: pnpm exec tsc --noEmit

             - name: Lint
               run: pnpm lint

             - name: Knip (unused exports / dead deps)
               run: pnpm exec knip

             - name: Unit + integration tests (Vitest)
               run: pnpm test

             - name: Install Playwright browsers
               run: pnpm exec playwright install --with-deps chromium

             - name: E2E smoke tests (Playwright)
               run: pnpm exec playwright test

             - name: Gitleaks scan
               uses: gitleaks/gitleaks-action@v2.3.9
               env:
                 GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
       ```

    2. Append to `CONTRIBUTING.md` (or create if missing):
       ```markdown
       ## Como rodar testes

       Os testes de integração (Drizzle + Postgres) precisam de uma instância local do Postgres.

       ### Setup local

       1. Suba o container de teste (porta 5433):
          ```
          docker compose -f docker-compose.test.yml up -d
          ```
       2. Exporte a URL do banco de teste:
          ```
          export DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5433/test
          export DATABASE_URL=$DATABASE_URL_TEST
          ```
       3. Aplique as migrações:
          ```
          pnpm db:migrate
          ```
       4. Rode os testes:
          ```
          pnpm test
          ```
       5. Quando terminar:
          ```
          docker compose -f docker-compose.test.yml down
          ```

       ### CI

       O CI usa um GH Actions `services:` block (mesma imagem `postgres:17-alpine`) — sem necessidade de docker-compose no runner. Veja `.github/workflows/ci.yml`.
       ```

    3. Run `pnpm exec actionlint .github/workflows/ci.yml` if actionlint binary is available; otherwise validate by visual inspection (yaml).

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && grep -c "postgres:17-alpine" .github/workflows/ci.yml && grep -c "actions/checkout@v6" .github/workflows/ci.yml && grep -c "actions/setup-node@v6" .github/workflows/ci.yml && grep -c "pnpm/action-setup@v5" .github/workflows/ci.yml && grep -c "pnpm db:migrate" .github/workflows/ci.yml && grep -c "Como rodar testes" CONTRIBUTING.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "postgres:17-alpine" .github/workflows/ci.yml` returns >= 1
    - `grep -c "actions/checkout@v6" .github/workflows/ci.yml` returns 1
    - `grep -c "actions/setup-node@v6" .github/workflows/ci.yml` returns 1
    - `grep -c "pnpm/action-setup@v5" .github/workflows/ci.yml` returns 1
    - `grep -c "gitleaks-action@v2.3.9" .github/workflows/ci.yml` returns 1
    - `grep -c "pnpm db:migrate" .github/workflows/ci.yml` returns 1
    - `grep -c "DATABASE_URL_TEST" .github/workflows/ci.yml` returns >= 1
    - `grep -c "Como rodar testes" CONTRIBUTING.md` returns 1
    - CI step ordering: install → db:migrate → typecheck → lint → knip → vitest → playwright (verify by reading ci.yml top-to-bottom)
  </acceptance_criteria>
  <done>CI runs against ephemeral postgres:17-alpine; migrations applied before vitest; action versions bumped per RESEARCH; CONTRIBUTING documents the docker-compose flow.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-28 | Information Disclosure | Test DB credentials leak | accept | Hard-coded `postgres/postgres` is a well-known test default; ephemeral; no production secrets touch CI |
| T-02-29 | Tampering | Migration drift between local + CI | mitigate | Both run identical drizzle/migrations/\*.sql via `pnpm db:migrate`; `pnpm db:check` in plan 02-02 catches drift |
</threat_model>

<verification>
docker-compose.test.yml + setup hook in place; CI uses postgres:17-alpine services block; action versions match RESEARCH; CONTRIBUTING explains the flow.
</verification>

<success_criteria>
Integration tests now run automatically in CI; new contributors can `docker compose up + pnpm test` in <1 min from clone.
</success_criteria>

<output>
After completion, create `.planning/phases/02-data-foundation/02-10-SUMMARY.md`
</output>
