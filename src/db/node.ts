/**
 * Node-runtime DB client.
 *
 * Uses drizzle-orm/neon-serverless + @neondatabase/serverless `Pool` (WebSocket).
 * Module-level pool reused across warm Vercel function invocations within the
 * same container. Hot-reload safe via globalThis singleton (Next dev re-evals
 * modules; pool would otherwise leak on every reload).
 *
 * Required for transactional writes — neon-http does NOT support transactions.
 *
 * Consumers: `/api/ingest`, `/api/archive`, migration runner (`pnpm db:migrate`).
 */
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const globalForPool = globalThis as unknown as { __ensoPool?: Pool };

function getPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (node)");
  if (!globalForPool.__ensoPool) {
    globalForPool.__ensoPool = new Pool({ connectionString: url });
  }
  return globalForPool.__ensoPool;
}

export const db = drizzle(getPool(), { schema });
export type NodeDB = typeof db;
