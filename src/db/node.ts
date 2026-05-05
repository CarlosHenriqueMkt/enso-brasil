/**
 * Node-runtime DB client.
 *
 * Uses drizzle-orm/node-postgres + `pg` Pool. Standard postgres protocol over
 * TCP — works against both vanilla PG (CI test container) and Neon (production
 * over their TCP gateway). The neon-serverless WebSocket driver is reserved for
 * edge routes only (src/db/edge.ts uses neon-http for HTTP fetch fan-out).
 *
 * Module-level pool reused across warm Vercel function invocations within the
 * same container. Hot-reload safe via globalThis singleton (Next dev re-evals
 * modules; pool would otherwise leak on every reload).
 *
 * Lazy via Proxy: `process.env.DATABASE_URL` is read on first method access,
 * not at module load. Required so Next.js page-data collection (which
 * evaluates route modules at build time without runtime env) does not throw.
 *
 * Supports transactional writes (neon-http does NOT — that's why edge routes
 * are read-only).
 *
 * Consumers: `/api/ingest`, `/api/archive`.
 */
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const globalForPool = globalThis as unknown as { __ensoPool?: pg.Pool };

type NodeDrizzle = ReturnType<typeof drizzle<typeof schema>>;

function getPool(): pg.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (node)");
  if (!globalForPool.__ensoPool) {
    globalForPool.__ensoPool = new pg.Pool({ connectionString: url });
  }
  return globalForPool.__ensoPool;
}

let _db: NodeDrizzle | null = null;

function getDb(): NodeDrizzle {
  if (_db) return _db;
  _db = drizzle(getPool(), { schema });
  return _db;
}

export const db = new Proxy({} as NodeDrizzle, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export type NodeDB = NodeDrizzle;
