/**
 * Vitest per-worker setup hook.
 *
 * Migrations are applied ONCE in `tests/setup/global.ts` (vitest globalSetup)
 * before any worker starts, to avoid concurrent `CREATE SCHEMA drizzle` races.
 *
 * This per-worker hook only propagates DATABASE_URL_TEST → DATABASE_URL so
 * route code reading process.env.DATABASE_URL sees the test DB. Test files
 * own their own row cleanup (TRUNCATE in beforeEach) so suites stay isolated.
 *
 * Integration suites self-skip via `describe.skipIf(!process.env.DATABASE_URL_TEST)`
 * when the env var is unset.
 */
const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (url) {
  process.env.DATABASE_URL = url;
}
