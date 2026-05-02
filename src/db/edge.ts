/**
 * Edge-runtime DB client.
 *
 * Uses drizzle-orm/neon-http + @neondatabase/serverless `neon()` HTTP fetcher.
 * Per-request — NO connection pool. Edge runtime has no `ws` module, so the
 * neon-serverless WebSocket pooled path is unavailable here.
 *
 * IMPORTANT: neon-http does NOT support transactions (RESEARCH Q1). Any code
 * path needing `db.transaction()` MUST import from `./node` instead.
 *
 * Lazy via Proxy: `process.env.DATABASE_URL` is read on first method access,
 * not at module load. Required so Next.js page-data collection (which
 * evaluates route modules at build time without runtime env) does not throw.
 *
 * Consumers: `/api/states`, `/api/health` (read-only edge routes).
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type EdgeDrizzle = ReturnType<typeof drizzle<typeof schema>>;

let _db: EdgeDrizzle | null = null;

function getDb(): EdgeDrizzle {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (edge)");
  _db = drizzle(neon(url), { schema });
  return _db;
}

export const db = new Proxy({} as EdgeDrizzle, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export type EdgeDB = EdgeDrizzle;
