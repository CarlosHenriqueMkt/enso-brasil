/**
 * Vitest globalSetup — runs ONCE before any worker starts.
 *
 * Applies drizzle migrations against the test DB so the schema exists before
 * per-worker setupFiles run. Without this, multiple worker processes race on
 * `CREATE SCHEMA drizzle` and trip a unique-constraint violation on
 * pg_namespace_nspname_index.
 *
 * Driver: drizzle-orm/node-postgres + pg Pool (vanilla Postgres). The neon
 * serverless driver requires WebSocket and won't talk to localhost vanilla PG.
 *
 * No-ops if DATABASE_URL_TEST/DATABASE_URL is unset (integration suites
 * self-skip via describe.skipIf).
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

export default async function setup() {
  const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
  if (!url) return;
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  await pool.end();
}
