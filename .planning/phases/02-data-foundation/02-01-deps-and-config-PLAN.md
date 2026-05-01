---
phase: 02-data-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - pnpm-lock.yaml
  - drizzle.config.ts
  - next.config.ts
  - .env.example
  - .gitignore
autonomous: true
requirements:
  - REQ-S2.01
  - REQ-S2.02
  - REQ-S2.03
  - REQ-S2.13
  - DATA-01
  - DATA-02
  - DATA-03

must_haves:
  truths:
    - "All 8 P2 runtime/dev deps installed at the RESEARCH-pinned versions"
    - "`pnpm db:generate` and `pnpm db:migrate` scripts exist"
    - "next.config.ts opts pino out of Turbopack via serverExternalPackages (D-03 fix for vercel/next.js#86099/#84766)"
    - ".env.example documents 4 new env vars; .env.local is gitignored; gitleaks does not block .example placeholders (REQ-S2.13)"
  artifacts:
    - path: "package.json"
      provides: "deps drizzle-orm@^0.45.2, drizzle-kit@^0.31.10, @neondatabase/serverless@^1.1.0, @upstash/redis@^1.37.0, ofetch@^1.5.1, zod@^4.4.1, pino@^10.3.1; devDeps drizzle-zod@^0.8.3, pino-pretty@^13.1.3, tsx; @types/node bumped to ^24; packageManager pnpm@10.33.2; scripts db:generate, db:migrate, db:check"
      contains: "drizzle-orm"
    - path: "drizzle.config.ts"
      provides: "drizzle-kit config: schema=./src/db/schema.ts, out=./drizzle/migrations, dialect=postgresql, dbCredentials.url=process.env.DATABASE_URL"
      contains: 'dialect: "postgresql"'
    - path: "next.config.ts"
      provides: "serverExternalPackages: ['pino','pino-pretty','thread-stream','real-require'] — D-03 Turbopack opt-out"
      contains: "serverExternalPackages"
    - path: ".env.example"
      provides: "Documents DATABASE_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, INGEST_TOKEN with placeholder values"
      contains: "DATABASE_URL="
    - path: ".gitignore"
      provides: ".env.local + .env.*.local + drizzle/.cache excluded"
      contains: ".env.local"
  key_links:
    - from: "next.config.ts"
      to: "pino bundler opt-out"
      via: "serverExternalPackages array"
      pattern: "serverExternalPackages.*pino"
    - from: "package.json scripts"
      to: "drizzle-kit + migration runner"
      via: "pnpm db:generate / pnpm db:migrate"
      pattern: "db:generate.*drizzle-kit generate"
---

<objective>
Install every P2 runtime + dev dep at the RESEARCH-verified versions (npm registry 2026-05-01), wire `drizzle.config.ts`, opt pino out of Turbopack per D-03, and document the four new env vars in `.env.example`. Foundation for all Wave-2+ plans.

Purpose: One plan owns ALL deps + global config — no merge conflicts in Wave 2. Locks every version per RESEARCH §Verified Versions. Honors D-03 (Turbopack opt-out) and CONTEXT line 107 (driver split — both `neon-http` and `neon-serverless` ship from the same `@neondatabase/serverless` package).
Output: package.json + lockfile + drizzle.config.ts + next.config.ts amended + .env.example + .gitignore updated.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-data-foundation/02-SPEC.md
@.planning/phases/02-data-foundation/02-CONTEXT.md
@.planning/phases/02-data-foundation/02-RESEARCH.md

<interfaces>
RESEARCH §Verified Versions (npm 2026-05-01 — DO NOT pick newer):
  Runtime: drizzle-orm@^0.45.2, @neondatabase/serverless@^1.1.0, @upstash/redis@^1.37.0, ofetch@^1.5.1, zod@^4.4.1, pino@^10.3.1
  Dev: drizzle-kit@^0.31.10, drizzle-zod@^0.8.3, pino-pretty@^13.1.3
  Bumps: @types/node ^22→^24 (engines.node >=24); packageManager pnpm@10.28.0→pnpm@10.33.2
  HOLD: TypeScript stays on ^5 (RESEARCH action item #4)

D-03 amended: pino is Node-only. Edge logger lives in src/lib/log/edge.ts (no pino import). Plan 02-04 implements both modules; this plan only installs deps + opt-out.

Existing baseline (package.json read 2026-05-01): next ^16, react ^19, vitest ^4.1.5, eslint ^9, husky ^9.1.7, knip ^6.9.0. No drizzle/neon/upstash/ofetch/zod/pino installed.
next.config.ts currently exports { reactStrictMode: true, poweredByHeader: false, typedRoutes: true } — must amend ADDITIVELY.

Anti-patterns:

- Installing `postgres` (postgres.js) — RESEARCH says NOT NEEDED
- Installing `@types/pg` — @neondatabase/serverless ships its own types
- Bumping TypeScript to 6.x — RESEARCH §Action Items #4 defers
- `drizzle-kit push` — D-01 mandates `generate` (SQL committed)
  </interfaces>
  </context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Install all P2 deps at pinned versions, write drizzle.config.ts, opt pino out of Turbopack</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-RESEARCH.md (§Verified Versions, §Action Items #1-#7, §Q3)
    - .planning/phases/02-data-foundation/02-CONTEXT.md (D-01, D-03, Implementation Notes)
    - package.json (confirm next ^16, no P2 deps)
    - next.config.ts (amend additively)
  </read_first>
  <files>package.json, pnpm-lock.yaml, drizzle.config.ts, next.config.ts</files>
  <action>
    1. In package.json: bump `packageManager` from `pnpm@10.28.0` → `pnpm@10.33.2`; bump `@types/node` `^22` → `^24`.

    2. Install runtime deps (single command):
       ```
       pnpm add drizzle-orm@^0.45.2 @neondatabase/serverless@^1.1.0 @upstash/redis@^1.37.0 ofetch@^1.5.1 zod@^4.4.1 pino@^10.3.1
       ```

    3. Install dev deps:
       ```
       pnpm add -D drizzle-kit@^0.31.10 drizzle-zod@^0.8.3 pino-pretty@^13.1.3 tsx@^4
       ```

    4. Add scripts to package.json (preserve existing):
       ```json
       {
         "scripts": {
           "db:generate": "drizzle-kit generate",
           "db:migrate": "tsx src/db/migrate.ts",
           "db:check": "drizzle-kit check"
         }
       }
       ```
       The `src/db/migrate.ts` runner is created in plan 02-02; this plan only wires the script.

    5. Write `drizzle.config.ts` at repo root EXACTLY (D-01):
       ```ts
       import { defineConfig } from "drizzle-kit";

       export default defineConfig({
         schema: "./src/db/schema.ts",
         out: "./drizzle/migrations",
         dialect: "postgresql",
         dbCredentials: { url: process.env.DATABASE_URL ?? "" },
         strict: true,
         verbose: true,
       });
       ```

    6. Amend `next.config.ts` ADDITIVELY (D-03):
       ```ts
       import type { NextConfig } from "next";

       const config: NextConfig = {
         reactStrictMode: true,
         poweredByHeader: false,
         typedRoutes: true,
         // D-03 (P2 CONTEXT) — pino + Next 16 Turbopack bundling fix
         // (vercel/next.js#86099, vercel/next.js#84766)
         serverExternalPackages: ["pino", "pino-pretty", "thread-stream", "real-require"],
       };

       export default config;
       ```

    7. Verify install:
       ```
       pnpm install --frozen-lockfile
       pnpm exec tsc --noEmit
       pnpm lint
       ```
       All must exit 0. If tsc errors on `drizzle.config.ts`, add it to tsconfig.json `exclude`.

    8. Commit (`feat(02-01): install P2 deps + wire drizzle/pino config`). Lockfile MUST be in commit.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm install --frozen-lockfile && pnpm exec tsc --noEmit && grep -c "serverExternalPackages" next.config.ts && grep -c "drizzle-orm" package.json && grep -c "dialect: \"postgresql\"" drizzle.config.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm install --frozen-lockfile` exits 0; `pnpm exec tsc --noEmit` exits 0
    - `grep -c '"drizzle-orm"' package.json` returns 1; same for `@neondatabase/serverless`, `@upstash/redis`, `ofetch`, `zod`, `pino`, `drizzle-kit`, `drizzle-zod`, `pino-pretty`
    - `grep -c '"db:generate"' package.json` returns 1; same for `db:migrate`, `db:check`
    - `grep -c "pnpm@10.33.2" package.json` returns 1
    - `grep -c '"@types/node": "\\^24"' package.json` returns 1
    - `grep -c '"typescript": "\\^5"' package.json` returns 1 (TS HOLD)
    - `drizzle.config.ts` exists; contains `schema: "./src/db/schema.ts"` and `out: "./drizzle/migrations"`
    - `next.config.ts` contains `serverExternalPackages` array with all 4 packages
  </acceptance_criteria>
  <done>All P2 deps installed at pinned versions. drizzle.config.ts wired. next.config.ts opts pino out of Turbopack. tsc + install pass.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Document new env vars in .env.example, update .gitignore, verify gitleaks allowlist (REQ-S2.13 no-regression)</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-SPEC.md (REQ-S2.13)
    - .planning/phases/02-data-foundation/02-CONTEXT.md (D-01..D-04 env var names)
    - .gitleaks.toml (P1 allowlist for `.example` MUST be present)
    - .gitignore (current state)
  </read_first>
  <files>.env.example, .gitignore</files>
  <action>
    1. Write `.env.example` at repo root with all 4 required vars + 3 optional (LOG_LEVEL, STUB_FIXTURE_PATH, DATABASE_URL_TEST). Each var documented with PT-BR comment and provisioning source. Use realistic placeholder shapes (e.g. `postgres://example_user:example_password@ep-example.neon.tech/db?sslmode=require`, `https://example-12345.upstash.io`, `replace_with_openssl_rand_hex_32_output`).

    2. Read `.gitignore`. If `.env.local` not present, append:
       ```
       # Local env files (P2)
       .env.local
       .env.*.local

       # Drizzle-kit local cache
       drizzle/.cache/
       ```
       NEVER add `.env.example` to gitignore.

    3. Verify P1 gitleaks allowlist still excludes `.example` (REQ-S2.13 no-regression):
       ```
       grep -c "\\.example" .gitleaks.toml
       ```
       Expected >= 1. If 0 → STOP and surface checkpoint to user.

    4. Destructive validation (DO NOT commit either file):
       a. Stage temp `__gitleaks_smoke.txt` containing `DATABASE_URL=postgres://user:realpw@ep-foo.neon.tech/db`. Run `gitleaks protect --staged --redact --verbose`. Confirm non-zero exit (BLOCKED).
       b. Unstage and delete temp file.
       c. Stage `.env.example`. Run gitleaks again. Confirm exit 0 (ALLOWED via allowlist).

    5. Run `pnpm format`.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && test -f .env.example && grep -c "DATABASE_URL=" .env.example && grep -c "UPSTASH_REDIS_REST_URL=" .env.example && grep -c "UPSTASH_REDIS_REST_TOKEN=" .env.example && grep -c "INGEST_TOKEN=" .env.example && grep -c "\.env\.local" .gitignore && grep -c "\\.example" .gitleaks.toml</automated>
  </verify>
  <acceptance_criteria>
    - `.env.example` exists with all 4 var names
    - `grep -c "\.env\.local" .gitignore` >= 1
    - `grep -c "\\.example" .gitleaks.toml` >= 1
    - Step 4 destructive test: realistic neon string outside .example BLOCKS; same string inside .env.example PASSES
  </acceptance_criteria>
  <done>4 env vars documented. .env.local gitignored. REQ-S2.13 no-regression confirmed via destructive test.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                     | Description                                    |
| ---------------------------- | ---------------------------------------------- |
| developer machine → git repo | Untrusted strings (real secrets) via `git add` |
| package registry → repo      | Untrusted code via `pnpm add`                  |

## STRIDE Threat Register

| Threat ID | Category               | Component                         | Disposition | Mitigation Plan                                                                    |
| --------- | ---------------------- | --------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| T-02-01   | Information Disclosure | .env.local accidentally committed | mitigate    | .gitignore rule + gitleaks pre-commit (P1 D-04) + REQ-S2.13 destructive test       |
| T-02-02   | Tampering              | Compromised npm transitive        | mitigate    | `pnpm install --frozen-lockfile`; lockfile committed; versions pinned per RESEARCH |
| T-02-03   | Information Disclosure | INGEST_TOKEN leaked in logs       | mitigate    | Documented as redaction target (D-03); wired in plan 02-04                         |

</threat_model>

<verification>
`pnpm install --frozen-lockfile` exits 0; `tsc --noEmit` exits 0; all 8 deps present; next.config.ts contains serverExternalPackages; gitleaks blocks fake neon string outside .example, allows inside.
</verification>

<success_criteria>
Foundation deps locked at RESEARCH-pinned versions. drizzle-kit + pino-Turbopack opt-out + env documentation in place. No P1 gitleaks regression.
</success_criteria>

<output>
After completion, create `.planning/phases/02-data-foundation/02-01-SUMMARY.md`
</output>
