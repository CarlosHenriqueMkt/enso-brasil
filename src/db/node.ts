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
 * Supports transactional writes (neon-http does NOT — that's why edge routes
 * are read-only).
 *
 * Consumers: `/api/ingest`, `/api/archive`.
 */
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const globalForPool = globalThis as unknown as { __ensoPool?: pg.Pool };

function getPool(): pg.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (node)");
  if (!globalForPool.__ensoPool) {
    globalForPool.__ensoPool = new pg.Pool({ connectionString: url });
  }
  return globalForPool.__ensoPool;
}

export const db = drizzle(getPool(), { schema });
export type NodeDB = typeof db;
