/**
 * Vitest global setup hook for integration tests against a real Postgres.
 *
 * Behavior:
 * - If `DATABASE_URL_TEST` (or fallback `DATABASE_URL`) is set: connect to the
 *   test DB, apply drizzle migrations once before the suite, and TRUNCATE all
 *   test tables before each test for isolation.
 * - If unset: no-op. Integration tests gate themselves via
 *   `describe.skipIf(!process.env.DATABASE_URL_TEST)` and skip cleanly.
 *
 * Driver: `drizzle-orm/node-postgres` + `pg` Pool. Vanilla Postgres speaks the
 * pg wire protocol natively; `@neondatabase/serverless` would require WebSocket
 * (incompatible with localhost vanilla PG). App routes still use neon driver
 * in production via `src/db/{node,edge}.ts`; this file is test-infra only.
 *
 * Truncation list must be kept in sync with `src/db/schema.ts`. Add new tables
 * here when the schema grows.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { afterAll, beforeAll, beforeEach } from "vitest";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;

let pool: pg.Pool | null = null;

beforeAll(async () => {
  if (!url) return; // Integration suites self-skip via describe.skipIf
  process.env.DATABASE_URL = url;
  pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
});

beforeEach(async () => {
  if (!pool) return;
  const db = drizzle(pool);
  await db.execute(
    sql`TRUNCATE TABLE alerts, sources_health, snapshot_cache, snapshot_archive RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await pool?.end();
});
