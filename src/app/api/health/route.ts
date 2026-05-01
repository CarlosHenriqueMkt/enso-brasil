/**
 * GET /api/health — public health-report edge route (REQ-S2.08 + REQ-S2.10).
 *
 * Reads sources_health rows via neon-http (edge), maps to HealthReport via
 * sourceDisplayNames lookup (edge-safe — registry-meta has zero fs imports).
 *
 * isStale rule: last_success_at IS NULL OR (now - last_success_at) > 30min.
 *
 * Edge runtime — pino is BANNED (D-03 + ESLint guard). Uses src/lib/log/edge.ts.
 */
import { NextResponse } from "next/server";
import { db } from "@/db/edge";
import { sourcesHealth } from "@/db/schema";
import { sourceDisplayNames } from "@/lib/sources/registry-meta";
import { HealthReportSchema, type SourceHealth } from "@/lib/api/schemas";
import { logger } from "@/lib/log/edge";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const STALE_MS = 30 * 60 * 1000;

interface HealthRow {
  sourceKey: string;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
  payloadHashDriftCount: number;
}

function isStale(lastSuccessAt: Date | null, now: number): boolean {
  if (lastSuccessAt === null) return true;
  return now - lastSuccessAt.getTime() > STALE_MS;
}

function toSourceHealth(row: HealthRow, now: number): SourceHealth {
  return {
    key: row.sourceKey,
    displayName: sourceDisplayNames[row.sourceKey] ?? row.sourceKey,
    lastSuccessAt: row.lastSuccessAt ? row.lastSuccessAt.toISOString() : null,
    consecutiveFailures: row.consecutiveFailures,
    isStale: isStale(row.lastSuccessAt, now),
    payloadDriftCount: row.payloadHashDriftCount,
  };
}

export async function GET() {
  const t0 = Date.now();
  try {
    const rows = (await db.select().from(sourcesHealth)) as unknown as HealthRow[];
    const now = Date.now();
    const report = {
      generatedAt: new Date(now).toISOString(),
      sources: rows.map((r) => toSourceHealth(r, now)),
    };
    const parsed = HealthReportSchema.parse(report);
    logger.info("api.health.ok", {
      durationMs: Date.now() - t0,
      sourceCount: parsed.sources.length,
    });
    return NextResponse.json(parsed, { status: 200 });
  } catch (err) {
    logger.error("api.health.error", err, { durationMs: Date.now() - t0 });
    return NextResponse.json({ error: "health_unavailable" }, { status: 502 });
  }
}
