---
phase: 02-data-foundation
plan: 10
supplement: "Post-merge CI fix sprint — driver swap and migration race"
date: 2026-05-02
parent: 02-10-SUMMARY.md
---

# Plan 02-10 Supplement: Post-Merge CI Fix Sprint

The original plan shipped with `drizzle-orm/neon-http` + `ws` shim against the
docker-compose Postgres. CI was flaky and produced 1–2 archive integration test
failures. Two distinct root causes, fixed in sequence.

## Fix sequence (chronological)

### 1. Driver swap: neon-http → node-postgres (commits leading up to 0cc2a72)

Neon's serverless driver requires WebSocket transport; `ws` shim worked locally
but on CI the migration step itself ran via drizzle-kit's bundled pg driver
while runtime tests used neon-serverless, producing two driver paths against
the same DB. Switched test infra to `drizzle-orm/node-postgres` + `pg` Pool
(matches drizzle-kit migrate driver) so test runtime and migration runtime are
the same client. Production routes still use neon-http on edge / neon-serverless
on Node — only test infra changed.

Dropped `ws`, `@types/ws`, `tsx`, `migrate.ts`, `drizzle-zod` (orphans after
switch). Tightened knip rule.

### 2. drizzle-orm dual-instance + globalSetup race (commit 048f522)

Two issues kept Wave 6 tests flaky after the driver swap:

**Cause A — drizzle-orm installed twice with different peer-dep hashes:**

- Instance A: peers `@neondatabase/serverless + @upstash/redis` (no pg)
- Instance B: peers `@neondatabase/serverless + @upstash/redis + pg + @types/pg`

App code (Node routes via pg) and tests (via @/db/schema imports) resolved
different instances. Drizzle table objects didn't match via `instanceof`, so
INSERTs from one module became invisible to SELECTs from another — manifested
as 0 rows where 1 was expected, and TS errors with "Property 'config' is
protected but type 'Column' is not a class derived from 'Column'".

Fix: moved `pg` from devDependencies → dependencies so pg is in scope at every
drizzle-orm import site, plus added `pnpm.overrides` to lock the version. Full
node_modules nuke + reinstall — single drizzle-orm dir results.

**Cause B — per-worker setupFiles raced on `CREATE SCHEMA drizzle`:**

`tests/setup/db.ts` ran drizzle migrate inside `beforeAll`, which vitest
executes per worker (one worker per test file under `pool: "forks"`). Multiple
workers concurrently issued `CREATE SCHEMA drizzle`, tripping
`pg_namespace_nspname_index` unique-constraint violations.

Fix: moved `migrate()` to vitest `globalSetup` (`tests/setup/global.ts`, runs
once before any worker starts). Per-worker `tests/setup/db.ts` is now a thin
env-propagation hook only. Test files own their own row cleanup.

## Result

- 77/77 tests pass locally + on CI
- Single `drizzle-orm@0.45.2_*` dir in `node_modules/.pnpm`
- Typecheck clean, lint clean, knip clean
- Commit `048f522` is the convergence point

## Files changed (post-merge from original 02-10)

| File                               | Change                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `package.json`                     | pg moved devDeps→deps, `pnpm.overrides` added, ws+tsx+drizzle-zod removed |
| `pnpm-lock.yaml`                   | full re-resolution after override + dep move                              |
| `tests/setup/db.ts`                | migrate logic moved out; now env-propagation only                         |
| `tests/setup/global.ts`            | NEW — vitest globalSetup running migrate once                             |
| `vitest.config.ts`                 | added `globalSetup` entry                                                 |
| `src/db/node.ts`                   | switched to `drizzle-orm/node-postgres`                                   |
| `package.json` script `db:migrate` | uses drizzle-kit (pg driver)                                              |
| `.github/workflows/ci.yml`         | timeout 8→12min for Playwright install                                    |

## Lessons

1. **Optional peer-deps cause silent dual-resolution under pnpm.** When a lib
   declares many optional peers (drizzle-orm has ~12), each combination of
   peers in a consumer's scope creates a separate virtual install. Two
   consumers with non-overlapping peer sets get two instances of the lib, and
   their objects fail `instanceof` checks at runtime. Move ambiguous peers
   into the root `dependencies` so resolution is uniform across all import
   sites.

2. **Vitest `setupFiles` runs per worker; `globalSetup` runs once.** Anything
   that mutates shared state (DDL, file creation) must live in `globalSetup`.
   Per-worker hooks can only assume the shared state already exists.

3. **`vercel env pull` masks Sensitive vars as `""`.** Operators must source
   secrets from the underlying platform (Neon, Upstash) when running migrations
   from a developer machine. CI/Vercel runtime sees the real values.
