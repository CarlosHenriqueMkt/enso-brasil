/**
 * POST /api/ingest — REQ-S2.07 orchestrator (Node runtime).
 *
 * Eight-step flow (token-gated, every 15 min via GH Actions cron):
 *   1. Promise.allSettled(sources.map(s => s.fetch()))
 *   2. zod-validate each result; failures bump sources_health drift counters
 *   3. Dedup new alerts via UNIQUE INDEX (source_key, payload_hash)
 *   4. INSERT net-new rows (onConflictDoNothing.returning)
 *   5. Compute placeholder snapshot — risk='unknown' for all 27 UFs (P2 phase)
 *   6. Write-through: setSnapshot(Upstash) + INSERT snapshot_cache
 *   7. diffSnapshot(prev, curr) → revalidatePath per changed UF + '/' if any
 *   8. Return JSON { ok, sources, adoptedCount, durationMs }
 *
 * Per-source failures isolated via allSettled (T-02-22). Public-safety stance:
 * never silently swallow errors — all failures logged with structured fields
 * and persisted to sources_health for /api/health surfacing.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db/node";
import { alerts, sourcesHealth, snapshotCache } from "@/db/schema";
import { sources } from "@/lib/sources/registry";
import { AlertArraySchema, type Alert } from "@/lib/sources/schema";
import { UF27, type StateSnapshot } from "@/lib/api/schemas";
import { diffSnapshot } from "@/lib/snapshot/diff";
import { getSnapshot, setSnapshot } from "@/lib/cache/upstash";
import { verifyBearerToken } from "@/lib/auth/token";
import { logger } from "@/lib/log/node";
import { messages } from "@/lib/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SourceReport {
  key: string;
  status: "ok" | "error" | "drift";
  alertCount: number;
  error?: string;
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const runId = crypto.randomUUID();
  const log = logger.child({ runId });

  const expected = process.env.INGEST_TOKEN;
  if (!expected) {
    log.error("ingest.misconfig", new Error("INGEST_TOKEN not set"));
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  if (!verifyBearerToken(req, expected)) {
    log.warn("ingest.unauthorized");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  log.info("ingest.start", { sourceCount: sources.length });

  // Step 1: parallel fetch — allSettled isolates per-adapter failure (T-02-22).
  const settled = await Promise.allSettled(sources.map((s) => s.fetch()));
  const reports: SourceReport[] = [];
  const adopted: Alert[] = [];
  const insertedAlertsByUF = new Map<string, Alert[]>();

  // Zip sources with settled results — pair-iteration narrows both to defined.
  const pairs = sources.map(
    (src, i) => [src, settled[i] as PromiseSettledResult<Alert[]>] as const,
  );

  for (const [src, result] of pairs) {
    const now = new Date();

    if (result.status === "rejected") {
      const err = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
      log.error("ingest.source.fetch_failed", err, { sourceKey: src.key });
      await db
        .insert(sourcesHealth)
        .values({
          sourceKey: src.key,
          lastAttemptAt: now,
          lastError: err.message,
          consecutiveFailures: 1,
        })
        .onConflictDoUpdate({
          target: sourcesHealth.sourceKey,
          set: {
            lastAttemptAt: now,
            lastError: err.message,
            consecutiveFailures: sql`${sourcesHealth.consecutiveFailures} + 1`,
          },
        });
      reports.push({ key: src.key, status: "error", alertCount: 0, error: err.message });
      continue;
    }

    // Step 2: zod-validate the adapter's payload.
    // (Some adapters may parse internally too — defense-in-depth.)
    const parsed = AlertArraySchema.safeParse(result.value);
    if (!parsed.success) {
      log.error("schema_drift", parsed.error, { sourceKey: src.key });
      await db
        .insert(sourcesHealth)
        .values({
          sourceKey: src.key,
          lastAttemptAt: now,
          lastError: parsed.error.message,
          consecutiveFailures: 1,
          payloadHashDriftCount: 1,
        })
        .onConflictDoUpdate({
          target: sourcesHealth.sourceKey,
          set: {
            lastAttemptAt: now,
            lastError: parsed.error.message,
            consecutiveFailures: sql`${sourcesHealth.consecutiveFailures} + 1`,
            payloadHashDriftCount: sql`${sourcesHealth.payloadHashDriftCount} + 1`,
          },
        });
      reports.push({
        key: src.key,
        status: "drift",
        alertCount: 0,
        error: parsed.error.message,
      });
      continue;
    }

    // Step 3 + 4: bulk INSERT with dedup via UNIQUE (source_key, payload_hash).
    const rows = parsed.data.map((a) => ({
      sourceKey: a.source_key,
      hazardKind: a.hazard_kind,
      stateUf: a.state_uf,
      severity: a.severity,
      headline: a.headline,
      body: a.body,
      sourceUrl: a.source_url,
      fetchedAt: new Date(a.fetched_at),
      validFrom: a.valid_from ? new Date(a.valid_from) : null,
      validUntil: a.valid_until ? new Date(a.valid_until) : null,
      payloadHash: a.payload_hash,
      raw: a.raw,
    }));
    const inserted =
      rows.length === 0
        ? []
        : await db.insert(alerts).values(rows).onConflictDoNothing().returning({ id: alerts.id });

    adopted.push(...parsed.data);
    for (const a of parsed.data) {
      const arr = insertedAlertsByUF.get(a.state_uf) ?? [];
      arr.push(a);
      insertedAlertsByUF.set(a.state_uf, arr);
    }
    reports.push({ key: src.key, status: "ok", alertCount: inserted.length });

    // Health: success path resets failure counters.
    await db
      .insert(sourcesHealth)
      .values({
        sourceKey: src.key,
        lastAttemptAt: now,
        lastSuccessAt: now,
        consecutiveFailures: 0,
      })
      .onConflictDoUpdate({
        target: sourcesHealth.sourceKey,
        set: {
          lastAttemptAt: now,
          lastSuccessAt: now,
          consecutiveFailures: 0,
          lastError: null,
        },
      });
  }

  // Step 5: compute placeholder snapshot — all UFs 'unknown' in P2.
  // alertCount reflects payloads observed this tick (not cumulative).
  const curr: StateSnapshot[] = UF27.map((uf) => {
    const ufAlerts = insertedAlertsByUF.get(uf) ?? [];
    const lastFetch = ufAlerts.reduce<string | null>(
      (acc, a) => (!acc || a.fetched_at > acc ? a.fetched_at : acc),
      null,
    );
    return {
      uf,
      risk: "unknown" as const,
      riskReason: messages.severity.gray,
      alertCount: ufAlerts.length,
      lastSuccessfulFetch: lastFetch,
      formulaVersion: "v0-placeholder",
    };
  });

  // Step 6: write-through cache (Upstash hot path + Postgres archive).
  const prev = await getSnapshot<StateSnapshot[]>();
  await setSnapshot(curr);
  await db
    .insert(snapshotCache)
    .values({
      snapshotKey: "current",
      body: curr,
      computedAt: new Date(),
      formulaVersion: "v0-placeholder",
    })
    .onConflictDoUpdate({
      target: snapshotCache.snapshotKey,
      set: { body: curr, computedAt: new Date(), formulaVersion: "v0-placeholder" },
    });

  // Step 7: revalidate ISR for changed UFs (D-04).
  const { changedUFs, rootChanged } = diffSnapshot(prev, curr);
  for (const uf of changedUFs) revalidatePath("/estado/" + uf);
  if (rootChanged) revalidatePath("/");

  const durationMs = Date.now() - t0;
  const adoptedCount = reports.reduce((acc, r) => acc + r.alertCount, 0);
  log.info("ingest.done", {
    durationMs,
    adoptedCount,
    changedUFs: changedUFs.length,
    rootChanged,
  });

  return NextResponse.json(
    { ok: true, sources: reports, adoptedCount, durationMs },
    { status: 200 },
  );
}
