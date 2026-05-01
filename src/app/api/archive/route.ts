/**
 * POST /api/archive — REQ-S2.11 daily archive (Node runtime).
 *
 * Token-gated handler invoked by GitHub Actions cron at 06:00 UTC (=03:00 BRT).
 * Five-step flow:
 *   1. verifyBearerToken (constant-time, mirrors /api/ingest)
 *   2. SELECT latest snapshot_cache row (ordered by computed_at desc, limit 1)
 *   3. INSERT into snapshot_archive keyed by today's UTC date — ON CONFLICT
 *      DO UPDATE so reruns same day overwrite (idempotent per REQ-S2.11)
 *   4. DELETE archive rows older than RETENTION_DAYS (30) — same run
 *   5. Return JSON { ok, archived, pruned, durationMs }
 *
 * Failure of /api/archive must NOT block /api/ingest — workflows independent.
 */
import { NextResponse } from "next/server";
import { desc, lt } from "drizzle-orm";
import { db } from "@/db/node";
import { snapshotCache, snapshotArchive } from "@/db/schema";
import { verifyBearerToken } from "@/lib/auth/token";
import { logger } from "@/lib/log/node";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETENTION_DAYS = 30;

export async function POST(req: Request) {
  const t0 = Date.now();
  const runId = crypto.randomUUID();
  const log = logger.child({ runId });

  const expected = process.env.INGEST_TOKEN;
  if (!expected) {
    log.error("archive.misconfig", new Error("INGEST_TOKEN not set"));
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  if (!verifyBearerToken(req, expected)) {
    log.warn("archive.unauthorized");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  log.info("archive.start");

  // Step 2: latest snapshot_cache row (P2 has snapshotKey === 'current' only).
  const latest = await db
    .select()
    .from(snapshotCache)
    .orderBy(desc(snapshotCache.computedAt))
    .limit(1);

  if (latest.length === 0) {
    log.warn("archive.no_snapshot");
    const durationMs = Date.now() - t0;
    return NextResponse.json({ ok: true, archived: 0, pruned: 0, durationMs }, { status: 200 });
  }
  const row = latest[0]!;

  // Step 3: INSERT keyed by today's UTC date; idempotent via ON CONFLICT.
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10); // YYYY-MM-DD UTC

  await db
    .insert(snapshotArchive)
    .values({
      date: dateStr,
      snapshotKey: row.snapshotKey,
      body: row.body,
      formulaVersion: row.formulaVersion,
    })
    .onConflictDoUpdate({
      target: [snapshotArchive.date, snapshotArchive.snapshotKey],
      set: { body: row.body, formulaVersion: row.formulaVersion },
    });

  // Step 4: prune > RETENTION_DAYS old.
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const pruned = await db
    .delete(snapshotArchive)
    .where(lt(snapshotArchive.date, cutoffStr))
    .returning({ date: snapshotArchive.date });

  const durationMs = Date.now() - t0;
  log.info("archive.done", { archived: 1, pruned: pruned.length, durationMs });
  return NextResponse.json(
    { ok: true, archived: 1, pruned: pruned.length, durationMs },
    { status: 200 },
  );
}
