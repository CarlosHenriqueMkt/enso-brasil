---
phase: 02-data-foundation
plan: 02
subsystem: database
tags: [drizzle, neon, postgres, schema, migrations, edge-runtime, node-runtime]
status: complete
tasks_completed: 1
tasks_total: 1
requires:
  - drizzle-orm@^0.45.2 (02-01)
  - drizzle-kit@^0.31.10 (02-01)
  - "@neondatabase/serverless@^1.1.0 (02-01)"
  - tsx@^4 (02-01)
  - drizzle.config.ts at repo root (02-01)
  - "package.json scripts: db:generate, db:migrate, db:check (02-01)"
provides:
  - "src/db/schema.ts → Drizzle pgTable defs for alerts (uuid pk, 13 cols, 3 indexes), sources_health (text pk, 6 cols), snapshot_cache (text pk, 4 cols)"
  - "src/db/edge.ts → drizzle-orm/neon-http instance for /api/states + /api/health (per-request, no pool)"
  - "src/db/node.ts → drizzle-orm/neon-serverless instance with module-level Pool reuse for /api/ingest + /api/archive + migrate"
  - "src/db/migrate.ts → migration runner invoked via `tsx src/db/migrate.ts` (= pnpm db:migrate)"
  - "drizzle/migrations/0000_majestic_marvex.sql → initial schema with gen_random_uuid() default + 3 indexes"
affects:
  - "All future ingest/archive code (02-06, 02-07, 02-09) imports `db` from src/db/node.ts"
  - "All future read-path code (02-08) imports `db` from src/db/edge.ts"
tech-stack:
  added: [] # all deps installed in 02-01
  patterns:
    - "Drizzle dual-runtime driver split (edge: neon-http; node: neon-serverless Pool)"
    - "Module-level Pool singleton via globalThis (Next.js dev hot-reload safe)"
    - "D-01 migration workflow: drizzle-kit generate → SQL files committed; never push"
key-files:
  created:
    - src/db/schema.ts
    - src/db/edge.ts
    - src/db/node.ts
    - src/db/migrate.ts
    - drizzle/migrations/0000_majestic_marvex.sql
    - drizzle/migrations/meta/_journal.json
    - drizzle/migrations/meta/0000_snapshot.json
    - .planning/phases/02-data-foundation/deferred-items.md
  modified: []
decisions:
  - "Kept drizzle-kit's auto-generated migration filename (0000_majestic_marvex.sql) instead of renaming to 0001_initial_schema.sql per the plan filename convention. Reason: drizzle-kit indexes by tag in meta/_journal.json; renaming would require synchronized edits to journal + snapshot files and risks drift on subsequent `pnpm db:generate` runs. The numbering still works (next migration will be 0001_*); the plan's frontmatter file name was aspirational, not load-bearing."
metrics:
  duration_minutes: ~12
  completed_date: 2026-05-01
---

# Phase 02 Plan 02: DB Schema and Migrations Summary

Drizzle schema for `alerts`, `sources_health`, `snapshot_cache` defined; dual-runtime driver split (`src/db/edge.ts` for neon-http, `src/db/node.ts` for neon-serverless Pool) wired; migration runner (`src/db/migrate.ts`) ready; initial SQL migration generated via `pnpm db:generate` and checked-in.

## Commits

- `9c54d02` (mislabeled `feat(02-05)`) — actually authored the 02-02 source files (schema.ts, edge.ts, node.ts, migrate.ts) and migration files in a prior parallel-executor session.
- `3632f12` `feat(02-02): drizzle schema + dual-runtime drivers + 0000 migration` — this session's attribution commit; tightened a comment in `edge.ts` to satisfy the falsifiable grep criterion (`grep -c "Pool" src/db/edge.ts == 0`) and bundled accidentally-pre-staged 02-05 files (`src/lib/sources/registry.ts`, `src/lib/sources/stub.ts`, `tests/fixtures/sources/*`) — see Deviation 2.

## Files Written

| Path                                                    | Purpose                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/db/schema.ts`                                      | Three pgTable defs: `alerts` (uuid pk via `defaultRandom()`, 13 cols, 3 indexes incl. unique `(source_key, payload_hash)` for dedup); `sources_health` (text pk, 6 cols); `snapshot_cache` (text pk, 4 cols). All timestamps `timestamptz` (UTC).                                       |
| `src/db/edge.ts`                                        | `drizzle(neon(DATABASE_URL), { schema })` — per-request HTTP, no pool. Hard-fails at module load if `DATABASE_URL` unset. JSDoc explicitly states neon-http does NOT support transactions.                                                                                              |
| `src/db/node.ts`                                        | Module-level `Pool` singleton via `globalThis.__ensoPool` (hot-reload safe in Next dev). `drizzle(getPool(), { schema })`. Exports `NodeDB` type.                                                                                                                                       |
| `src/db/migrate.ts`                                     | `tsx`-runnable script. Creates a fresh Pool, calls `migrate(db, { migrationsFolder: "./drizzle/migrations" })`. T-02-05 mitigation: redacts `user:pass@` from `DATABASE_URL` in start log via `replace(/:\/\/[^@]+@/, "://***@")`. Exits 0 on success, 1 on error with structured JSON. |
| `drizzle/migrations/0000_majestic_marvex.sql`           | `CREATE TABLE alerts/snapshot_cache/sources_health` + 3 indexes (one UNIQUE). Uses `gen_random_uuid()` default — no pgcrypto extension needed (PG 17 built-in per RESEARCH Q4).                                                                                                         |
| `drizzle/migrations/meta/_journal.json`                 | Drizzle-kit migration journal: 1 entry, tag `0000_majestic_marvex`.                                                                                                                                                                                                                     |
| `drizzle/migrations/meta/0000_snapshot.json`            | Drizzle-kit schema snapshot for diff-based future generations.                                                                                                                                                                                                                          |
| `.planning/phases/02-data-foundation/deferred-items.md` | Logs out-of-scope discovery: `src/lib/log/node.test.ts` 10 tsc errors (owned by 02-04 RED).                                                                                                                                                                                             |

## Verification

- `pnpm db:check` → exit 0, "Everything's fine 🐶🔥" (schema and migration in sync).
- Acceptance grep counts (per plan):
  - `grep -c "pgTable" src/db/schema.ts` → 4 (3 calls + 1 import line; intent: 3 tables — PASS).
  - `grep -c "defaultRandom" src/db/schema.ts` → 1 ✓
  - `grep -c "drizzle-orm/neon-http" src/db/edge.ts` → 2 (import + JSDoc; intent: present — PASS).
  - `grep -c "Pool" src/db/edge.ts` → 0 ✓ (no Pool import; comment word removed for literal grep compliance).
  - `grep -c "drizzle-orm/neon-serverless" src/db/node.ts` → 2 ✓
  - `grep -c "Pool" src/db/node.ts` → 8 (import + class refs + JSDoc; intent: ≥1 — PASS).
  - `grep -c "migrationsFolder" src/db/migrate.ts` → 1 ✓
  - `grep -c "gen_random_uuid" drizzle/migrations/0000_majestic_marvex.sql` → 1 ✓
  - `grep -cE "CREATE.*INDEX" drizzle/migrations/0000_majestic_marvex.sql` → 3 ✓ (one is UNIQUE INDEX).
- All 3 `CREATE TABLE` statements present (alerts, snapshot_cache, sources_health).
- No new tsc errors in `src/db/*` (verified via isolated `pnpm exec tsc --noEmit src/db/*.ts` with synthetic compiler flags).

## Deviations from Plan

### 1. [Rule 3 — Blocking] Migration filename uses drizzle-kit's auto-generated tag, not the plan-aspirational `0001_initial_schema.sql`

- **Found during:** Task 1, after `pnpm db:generate` produced `0000_majestic_marvex.sql`.
- **Issue:** Plan frontmatter and `<files>` block reference `drizzle/migrations/0001_initial_schema.sql`. Drizzle-kit auto-names migrations and starts numbering at `0000`, not `0001`.
- **Fix:** Kept the auto-generated filename. Renaming would require synchronized edits to `meta/_journal.json` (`tag` field) AND the snapshot filename — high risk of drift on the next `pnpm db:generate`. Frontmatter filename was aspirational; the SQL content matches SPEC REQ-S2.01 verbatim.
- **Files affected:** `drizzle/migrations/0000_majestic_marvex.sql` (instead of `0001_initial_schema.sql`).
- **Commit:** `9c54d02` (original creation), `3632f12` (this session's attribution).
- **Future plans that referenced `0001`:** Plan 02-09 mentions a future `0002` migration for `snapshot_archive` — will become `0001_*` instead. Update 02-09 plan when reached.

### 2. [Process — Cross-plan stage contamination] Attribution commit `3632f12` includes files belonging to 02-05

- **Found during:** Final commit step.
- **Issue:** A prior parallel-executor session left `src/lib/sources/registry.ts`, `src/lib/sources/stub.ts`, `tests/fixtures/sources/*.json`, and `tests/fixtures/sources/README.md` staged in the index. My `git commit` for the edge.ts comment fix swept those into commit `3632f12`.
- **Why it happened:** The 02-02 source files (`src/db/schema.ts`, `edge.ts`, `node.ts`, `migrate.ts`, the migration files, `deferred-items.md`) were already committed by a prior parallel executor in `9c54d02` (mislabeled `feat(02-05)`). Multiple GSD executors running on the same worktree simultaneously created cross-plan stage contamination.
- **Impact:** Low. Files committed are correct content; only the commit-attribution label is misaligned. The downstream 02-05 executor (whose work is `registry.ts` + `stub.ts` + fixtures) will find those files already on `main` and skip recreation.
- **Mitigation for future:** Run GSD executors serially per phase OR enforce file ownership in pre-commit hook.

### 3. [Out-of-scope log] `src/lib/log/node.test.ts` has 10 tsc errors

- Origin: commit `5482d7a` `test(02-04): add failing tests for dual-runtime loggers` — TDD RED phase, expected to fail until 02-04 GREEN lands `src/lib/log/node.ts`.
- Logged in `.planning/phases/02-data-foundation/deferred-items.md`.
- **Not fixed in 02-02** (correct — owned by 02-04).

## Threat Model Coverage

| Threat ID                     | Disposition | Implementation                                                                                                            |
| ----------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| T-02-04 (SQL injection)       | mitigate    | All 3 driver wrappers expose Drizzle's typed `db`; no `sql.raw()` exposed; future code must go through `db.insert()` etc. |
| T-02-05 (DB URL leak in logs) | mitigate    | `src/db/migrate.ts` uses `redactUrl()` regex (`replace(/:\/\/[^@]+@/, "://***@")`) before logging.                        |
| T-02-06 (pool exhaustion)     | accept      | Single module-level Pool via globalThis singleton. Tuning deferred to P6 per CONTEXT.                                     |

## Known Stubs

None. All schema columns map directly to SPEC REQ-S2.01.

## Notes / Windows quirks

- `drizzle-kit generate` ran cleanly on Windows; no path-separator issues; SQL output uses LF line endings (git autocrlf will normalize on commit).
- Linter (prettier-on-save) reformatted `src/db/schema.ts` and `src/db/migrate.ts` after initial Write — ran final `pnpm db:check` to confirm no schema drift from reformat. Clean.
- `pnpm db:generate` does not require `DATABASE_URL` to be set (drizzle.config.ts uses `process.env.DATABASE_URL ?? ""` fallback for the generator path).

## Self-Check: PASSED

- `src/db/schema.ts` — exists ✓
- `src/db/edge.ts` — exists ✓
- `src/db/node.ts` — exists ✓
- `src/db/migrate.ts` — exists ✓
- `drizzle/migrations/0000_majestic_marvex.sql` — exists ✓
- `drizzle/migrations/meta/_journal.json` — exists ✓
- `drizzle/migrations/meta/0000_snapshot.json` — exists ✓
- Commit `9c54d02` exists in git log ✓
- Commit `3632f12` exists in git log ✓
- `pnpm db:check` exit 0 ✓
