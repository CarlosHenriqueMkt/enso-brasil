/**
 * loadSnapshotForUi — orchestrates the three read paths the home page needs
 * (REQ-DASH-01, DASH-02, DATA-07, threat T-05-19).
 *
 * Contract:
 *   - Returns `{ states, health, generatedAt, degraded }` ALWAYS — never throws.
 *   - `states` is always a 27-length array. On total failure, every entry is a
 *     gray "unknown" placeholder (sketch-finding 007-C floor copy).
 *   - `degraded` is true unless the live Upstash cache validated cleanly.
 *
 * Read order (each step is best-effort and isolated):
 *   1. Upstash live snapshot (`getSnapshot()`)
 *   2. Postgres `snapshot_archive` newest row
 *   3. Floor (27 unknown placeholders + all sources marked stale)
 *
 * Health is read independently — it is informational and is allowed to be
 * empty (the StaleSourceBanner will simply not render a row).
 *
 * Test seam: every external read is injected via `deps` so unit tests can
 * exercise all branches without spinning up Redis/Postgres.
 */
import { desc } from "drizzle-orm";
import { z } from "zod";
import { StateSnapshotsResponseSchema, UF27, type StateSnapshot } from "@/lib/api/schemas";
import type { StaleSourceProps } from "@/components/staleness/StaleSourceBanner";
import { sourceDisplayNames, sourceStability } from "@/lib/sources/registry-meta";

/** 30-minute staleness threshold (DATA-07, mirrors StaleSourceBanner). */
const STALE_MS = 30 * 60 * 1000;

/** Shape of a `sources_health` row as it is returned by drizzle. */
export interface SourceHealthRow {
  sourceKey: string;
  lastSuccessAt: Date | null;
  consecutiveFailures: number;
  payloadHashDriftCount: number;
}

/** Health entry surfaced to the UI — enriched form of `SourceHealthRow`. */
export interface UiHealthEntry extends StaleSourceProps {
  consecutiveFailures: number;
  payloadDriftCount: number;
  isStale: boolean;
}

export interface UiSnapshot {
  states: StateSnapshot[];
  health: UiHealthEntry[];
  generatedAt: string;
  /** True whenever the live cache miss/archive fallback/floor branch was used. */
  degraded: boolean;
}

export interface LoadDeps {
  /** Override clock for deterministic tests. Defaults to `new Date()`. */
  now?: Date;
  /** Read Upstash `snapshot:current`. Returns parsed body or null on miss. */
  readCache?: () => Promise<unknown>;
  /** Read newest `snapshot_archive` body. Returns body or null on miss. */
  readArchive?: () => Promise<unknown>;
  /** Read all `sources_health` rows. */
  readHealth?: () => Promise<SourceHealthRow[]>;
}

/**
 * Build the 27-entry "unknown" floor. Every UF gets a gray placeholder; this
 * keeps downstream UI code branch-free (always 27 cards).
 */
function buildFloorStates(generatedAt: string): StateSnapshot[] {
  return UF27.map((uf) => ({
    uf,
    risk: "unknown" as const,
    riskReason: "",
    alertCount: 0,
    lastSuccessfulFetch: null,
    formulaVersion: "v0",
  })).map((s) => {
    void generatedAt;
    return s;
  });
}

/**
 * Floor health: every source registered in `sourceDisplayNames` is reported
 * with `lastSuccess = null` so the StaleSourceBanner always has something to
 * render in the catastrophic branch.
 */
function buildFloorHealth(): UiHealthEntry[] {
  const keys = Object.keys(sourceDisplayNames);
  // If registry-meta is empty (shouldn't be), at least surface the two known
  // primary sources so the banner is never silent.
  const fallback = keys.length > 0 ? keys : ["cemaden", "inmet"];
  return fallback.map((key) => ({
    key,
    displayName: sourceDisplayNames[key] ?? key,
    url: "",
    lastSuccess: null,
    stability: sourceStability[key] ?? "unstable",
    consecutiveFailures: 0,
    payloadDriftCount: 0,
    isStale: true,
  }));
}

function isHealthStale(lastSuccess: Date | null, now: Date): boolean {
  if (lastSuccess === null) return true;
  const t = lastSuccess.getTime();
  if (Number.isNaN(t)) return true;
  return now.getTime() - t >= STALE_MS;
}

function rowsToHealth(rows: SourceHealthRow[], now: Date): UiHealthEntry[] {
  return rows.map((r) => ({
    key: r.sourceKey,
    displayName: sourceDisplayNames[r.sourceKey] ?? r.sourceKey,
    url: "",
    lastSuccess: r.lastSuccessAt ? r.lastSuccessAt.toISOString() : null,
    stability: sourceStability[r.sourceKey] ?? "unstable",
    consecutiveFailures: r.consecutiveFailures,
    payloadDriftCount: r.payloadHashDriftCount,
    isStale: isHealthStale(r.lastSuccessAt, now),
  }));
}

/** Lazy default readers — only imported when no override is supplied. */
async function defaultReadCache(): Promise<unknown> {
  const { getSnapshot } = await import("@/lib/cache/upstash");
  return getSnapshot();
}

async function defaultReadArchive(): Promise<unknown> {
  const { db } = await import("@/db/node");
  const { snapshotArchive } = await import("@/db/schema");
  const rows = await db.select().from(snapshotArchive).orderBy(desc(snapshotArchive.date)).limit(1);
  if (rows.length === 0) return null;
  return rows[0]!.body;
}

async function defaultReadHealth(): Promise<SourceHealthRow[]> {
  const { db } = await import("@/db/node");
  const { sourcesHealth } = await import("@/db/schema");
  const rows = (await db.select().from(sourcesHealth)) as unknown as SourceHealthRow[];
  return rows;
}

function tryParseStates(body: unknown): StateSnapshot[] | null {
  const parsed = z.safeParse(StateSnapshotsResponseSchema, body);
  return parsed.success ? (parsed.data as StateSnapshot[]) : null;
}

export async function loadSnapshotForUi(deps: LoadDeps = {}): Promise<UiSnapshot> {
  const now = deps.now ?? new Date();
  const generatedAt = now.toISOString();
  const readCache = deps.readCache ?? defaultReadCache;
  const readArchive = deps.readArchive ?? defaultReadArchive;
  const readHealth = deps.readHealth ?? defaultReadHealth;

  // ─── Health (best-effort, isolated failure) ──────────────────────────────
  let health: UiHealthEntry[];
  try {
    const rows = await readHealth();
    health = rowsToHealth(rows, now);
    if (health.length === 0) health = buildFloorHealth();
  } catch {
    health = buildFloorHealth();
  }

  // ─── Branch 1: live cache hit ────────────────────────────────────────────
  try {
    const cached = await readCache();
    if (cached !== null && cached !== undefined) {
      const states = tryParseStates(cached);
      if (states) {
        return { states, health, generatedAt, degraded: false };
      }
      // Schema mismatch — fall through to archive.
    }
  } catch {
    // swallow; fall through to archive.
  }

  // ─── Branch 2: archive fallback ──────────────────────────────────────────
  try {
    const archived = await readArchive();
    if (archived !== null && archived !== undefined) {
      const states = tryParseStates(archived);
      if (states) {
        return { states, health, generatedAt, degraded: true };
      }
    }
  } catch {
    // swallow; fall through to floor.
  }

  // ─── Branch 3: total-failure floor ───────────────────────────────────────
  return {
    states: buildFloorStates(generatedAt),
    // In the floor branch, every source is forcibly reported as stale so the
    // banner is always visible (sketch-finding 007-C contract).
    health: health.map((h) => ({ ...h, isStale: true, lastSuccess: null })),
    generatedAt,
    degraded: true,
  };
}
