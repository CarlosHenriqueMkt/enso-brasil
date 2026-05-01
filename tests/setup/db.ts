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
 * Driver choice: uses `@neondatabase/serverless` Pool (WebSocket) — same driver
 * the production Node runtime uses (`drizzle-orm/neon-serverless`). For local
 * docker Postgres, neon-serverless requires the `ws` WebSocket shim, configured
 * via `neonConfig.webSocketConstructor`. Production (against real Neon) does
 * not need the shim — Neon's HTTP/WebSocket endpoints handle it natively.
 *
 * Truncation list must be kept in sync with `src/db/schema.ts`. Add new tables
 * here when the schema grows.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";
import { afterAll, beforeAll, beforeEach } from "vitest";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;

let pool: Pool | null = null;

beforeAll(async () => {
  if (!url) return; // Integration suites self-skip via describe.skipIf
  // neon-serverless drives Postgres via WebSocket. Local docker PG doesn't
  // ship a WS endpoint, so we shim it with the `ws` package.
  neonConfig.webSocketConstructor = ws;
  // App code reads DATABASE_URL — make it hit the test DB too.
  process.env.DATABASE_URL = url;
  pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
});

beforeEach(async () => {
  if (!pool) return;
  const db = drizzle(pool);
  // Truncate every integration table for isolation. Keep this list aligned
  // with src/db/schema.ts. RESTART IDENTITY resets serials; CASCADE handles FKs.
  await db.execute(
    sql`TRUNCATE TABLE alerts, sources_health, snapshot_cache, snapshot_archive RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await pool?.end();
});
