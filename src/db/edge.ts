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
 * Consumers: `/api/states`, `/api/health` (read-only edge routes).
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (edge)");

export const db = drizzle(neon(url), { schema });
export type EdgeDB = typeof db;
