---
phase: 02-data-foundation
plan: 10
subsystem: test-infra
tags: [test-infra, docker, postgres, ci, drizzle]
requires: [02-02 schema/migrate, 02-07/02-08/02-09 gated integration suites]
provides:
  - docker-compose.test.yml (postgres:17-alpine on port 5433, ephemeral, healthcheck)
  - tests/setup/db.ts (vitest beforeAll migrate + beforeEach truncate)
  - vitest.config.ts setupFiles wiring + pool='forks'
  - GH Actions services block (postgres:17-alpine) + db:migrate CI step
  - CONTRIBUTING.md "Como rodar testes" section
affects:
  - .github/workflows/ci.yml (sequence: install -> db:migrate -> tsc -> lint -> knip -> vitest -> playwright -> gitleaks)
  - vitest.config.ts (now applies global setup hook)
tech-stack:
  added: [ws@^8 (devDep, neon-serverless WebSocket shim), @types/ws]
  patterns:
    - "neon-serverless against local PG requires neonConfig.webSocketConstructor = ws"
    - "GH Actions services block exposes postgres on localhost:5432 inside the runner"
    - "Vitest setupFiles run per-worker; pool='forks' guarantees PG client isolation"
key-files:
  created:
    - docker-compose.test.yml
    - tests/setup/db.ts
    - .planning/phases/02-data-foundation/02-10-SUMMARY.md
  modified:
    - vitest.config.ts (setupFiles + pool=forks)
    - .github/workflows/ci.yml (services + db:migrate + version bumps)
    - CONTRIBUTING.md ("Como rodar testes" section)
    - package.json + pnpm-lock.yaml (add ws, @types/ws devDeps)
decisions:
  - "Use neon-serverless driver (matches prod Node runtime) with ws shim for local PG instead of switching to pg package — keeps test driver identical to production driver, only difference is the WebSocket shim"
  - "Truncate-between-tests instead of per-test transaction rollback — simpler; integration tests are not yet a hot path"
  - "Drop with.version on pnpm/action-setup@v5 — defers to packageManager field per P1 fix 8a6847d"
  - "CI timeout 6 -> 8 minutes to absorb services container startup + db:migrate step"
metrics:
  duration: ~12 minutes
  completed: 2026-05-01
  tasks_completed: 2
  files_changed: 7
---

# Phase 2 Plan 10: Test Infrastructure (Docker + Postgres + CI services) Summary

Wire docker-compose Postgres for local + GH Actions services block for CI (D-02), with a vitest setup hook that runs migrations and truncates tables, so all integration suites gated on `DATABASE_URL_TEST` (plans 02-07, 02-08, 02-09) actually execute.

## What Shipped

### docker-compose.test.yml

`postgres:17-alpine`, container `enso-test-pg`, port `5433:5432` (avoids local PG 5432 collision), `POSTGRES_USER/PASSWORD/DB=postgres/postgres/test`, ephemeral (no volumes), `pg_isready` healthcheck.

### tests/setup/db.ts

Vitest global setup hook:

- `beforeAll`: if `DATABASE_URL_TEST` (or fallback `DATABASE_URL`) set, configure `neonConfig.webSocketConstructor = ws`, point `process.env.DATABASE_URL` at the test DB, instantiate a neon-serverless `Pool`, run `migrate(db, { migrationsFolder: "./drizzle/migrations" })`.
- `beforeEach`: `TRUNCATE TABLE alerts, sources_health, snapshot_cache, snapshot_archive RESTART IDENTITY CASCADE` for isolation.
- `afterAll`: `pool.end()`.
- Fully no-op when `DATABASE_URL_TEST` is unset — integration tests self-skip via `describe.skipIf`.

### vitest.config.ts

- `pool: "forks"` — guarantees per-test-file isolation of PG clients (prevents WebSocket pool corruption across worker threads).
- `setupFiles: ["./tests/setup/db.ts"]`.
- Preserves P1 invariants: `jsdom` env, `globals: true`, `tests/e2e` exclusion, `@/*` alias.

### .github/workflows/ci.yml

- `services.postgres: postgres:17-alpine` exposed on `5432:5432` (localhost inside runner) with `pg_isready` healthcheck.
- `env.DATABASE_URL` + `env.DATABASE_URL_TEST` both point at `postgres://postgres:postgres@localhost:5432/test`.
- New `Apply migrations to test DB` step (`pnpm db:migrate`) inserted before typecheck.
- Action version bumps per RESEARCH §GitHub Actions item #6:
  - `actions/checkout@v4` → `@v6`
  - `actions/setup-node@v4` → `@v6`
  - `pnpm/action-setup@v4` → `@v5` (dropped `with.version` per P1 fix `8a6847d`; defers to `packageManager` field in package.json)
  - `gitleaks/gitleaks-action@v2` → pinned `@v2.3.9`
- `timeout-minutes` 6 → 8 to absorb services startup + migrate step (still well under D-02's stated ~10s overhead acceptance).

### CONTRIBUTING.md

Added "Como rodar testes" section between "Como rodar local" and "Padrões de código":

- Setup local: `docker compose up -d` → export envs → `pnpm db:migrate` → `pnpm test` → `down`
- Without Docker: tests still run; integration suites self-skip
- CI: documents the GH Actions services block approach

## Verification

Without `DATABASE_URL_TEST` (this developer machine, no Docker running):

```
Test Files  14 passed | 2 skipped (16)
Tests       63 passed | 14 skipped (77)
```

Matches plan expectation exactly (~63 pass + ~14 skipped from prior plans). The skipped suites are the integration tests waiting for a real PG; CI will exercise them on next push because the services block sets `DATABASE_URL_TEST`.

Acceptance grep matrix (all returned ≥ 1 as required):

| Check                                    | Result |
| ---------------------------------------- | ------ |
| `postgres:17-alpine` in docker-compose   | 1      |
| `DATABASE_URL_TEST` in tests/setup/db.ts | 3      |
| `setupFiles` in vitest.config.ts         | 1      |
| `pool: "forks"` in vitest.config.ts      | 1      |
| `TRUNCATE` in tests/setup/db.ts          | 2      |
| `tests/e2e` exclusion preserved          | 1      |
| `postgres:17-alpine` in ci.yml           | 1      |
| `actions/checkout@v6` in ci.yml          | 1      |
| `actions/setup-node@v6` in ci.yml        | 1      |
| `pnpm/action-setup@v5` in ci.yml         | 1      |
| `gitleaks-action@v2.3.9` in ci.yml       | 1      |
| `pnpm db:migrate` in ci.yml              | 1      |
| `Como rodar testes` in CONTRIBUTING.md   | 1      |

## Commits

| Task | Type  | Hash      | Scope                                                                       |
| ---- | ----- | --------- | --------------------------------------------------------------------------- |
| 1    | chore | `92a94de` | docker-compose.test.yml + tests/setup/db.ts + vitest.config.ts + ws devDeps |
| 2a   | ci    | `34afe8e` | .github/workflows/ci.yml (services + db:migrate + action version bumps)     |
| 2b   | docs  | `eee5eb2` | CONTRIBUTING.md ("Como rodar testes" section)                               |

Task 2 split into two commits (`ci(...)` and `docs(...)`) per the user's commit-prefix routing instructions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Proactively added `ws` + `@types/ws` devDeps and configured `neonConfig.webSocketConstructor` from the start, instead of waiting to discover the connection failure**

- **Found during:** Task 1 design (read-time analysis of plan's NOTE block in step 2)
- **Issue:** Plan said "first attempt neon-serverless; if connection issues, install `ws`". Without the WebSocket shim, neon-serverless cannot reach a vanilla local Postgres — it would always fail on first run. The "if issues arise" branch is the only branch that works.
- **Fix:** Added `ws` + `@types/ws` to devDependencies up front; `tests/setup/db.ts` configures `neonConfig.webSocketConstructor = ws` unconditionally inside `beforeAll`. Production paths (against real Neon endpoints) ignore this config; only the test path against local PG uses it.
- **Files modified:** `package.json`, `pnpm-lock.yaml`, `tests/setup/db.ts`
- **Commit:** `92a94de`
- **Why this is correct (not architectural):** This stays inside the plan's explicitly-permitted fallback branch and uses the driver the plan named first. No driver swap to `pg`, no schema change, no new dep on a different ORM. Just shipping the working branch on first attempt to avoid a guaranteed CI red on first push.

### Auth Gates

None.

### Architectural Decisions Required

None.

## Authentication Gates

None — fully autonomous plan.

## Known Stubs

None.

## Threat Flags

None — no new attack surface introduced (test DB credentials are well-known dev defaults per T-02-28; ephemeral, never deployed).

## Self-Check: PASSED

- `docker-compose.test.yml` — FOUND
- `tests/setup/db.ts` — FOUND
- `vitest.config.ts` — modified (setupFiles + pool=forks)
- `.github/workflows/ci.yml` — modified (services + db:migrate + version bumps)
- `CONTRIBUTING.md` — modified ("Como rodar testes" section)
- Commits `92a94de`, `34afe8e`, `eee5eb2` — FOUND in git log
- Vitest exit 0 with 63 pass + 14 skipped (matches plan expectation)

## Follow-Ups

- **CI verification on next push** (per P1 pattern). This local environment cannot run Docker; the GH Actions services block is unverified until next push to main or PR. Expected behavior: `pnpm db:migrate` succeeds against `localhost:5432` services container, then the 14 currently-skipped integration tests execute and pass.
- **`ws` shim is test-only.** Production Node routes use neon-serverless against real Neon endpoints, which provide native WebSocket support — no shim needed. The `ws` import lives in `tests/setup/db.ts` only.
- **Truncation list maintenance.** When schema grows (future plans add tables), `tests/setup/db.ts` truncate list must be updated in lockstep. Inline comment flags this.
