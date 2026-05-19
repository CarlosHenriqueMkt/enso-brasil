/**
 * Tests for loadSnapshotForUi — orchestrates cache → archive fallback → floor.
 *
 * Never throws. Three branches:
 *   1. Cache hit  → parsed states, degraded:false
 *   2. Cache miss + archive hit → archived states, degraded:true
 *   3. Cache miss + archive miss → 27 unknown floor cards, degraded:true,
 *      all health sources marked stale
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { UF27, type StateSnapshot } from "@/lib/api/schemas";

const modulePath = resolve(__dirname, "load.ts");

const NOW = new Date("2026-05-19T12:00:00Z");
const FRESH_ISO = new Date(NOW.getTime() - 5 * 60_000).toISOString();
const STALE_ISO = new Date(NOW.getTime() - 60 * 60_000).toISOString();

/** Build a valid 27-length snapshot, all green. */
function fullSnapshot(): StateSnapshot[] {
  return UF27.map((uf) => ({
    uf,
    risk: "green" as const,
    riskReason: "",
    alertCount: 0,
    lastSuccessfulFetch: FRESH_ISO,
    formulaVersion: "v0",
  }));
}

type HealthRow = {
  sourceKey: string;
  lastSuccessAt: Date | null;
  consecutiveFailures: number;
  payloadHashDriftCount: number;
};

function healthRows(opts: { cemaden?: Date | null; inmet?: Date | null } = {}): HealthRow[] {
  return [
    {
      sourceKey: "cemaden",
      lastSuccessAt: opts.cemaden === undefined ? new Date(FRESH_ISO) : opts.cemaden,
      consecutiveFailures: 0,
      payloadHashDriftCount: 0,
    },
    {
      sourceKey: "inmet",
      lastSuccessAt: opts.inmet === undefined ? new Date(FRESH_ISO) : opts.inmet,
      consecutiveFailures: 0,
      payloadHashDriftCount: 0,
    },
  ];
}

describe("loadSnapshotForUi", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it.skipIf(!existsSync(modulePath))(
    "cache hit → returns parsed states (length 27), degraded=false",
    async () => {
      const { loadSnapshotForUi } = await import("./load");
      const body = fullSnapshot();
      const result = await loadSnapshotForUi({
        now: NOW,
        readCache: async () => body,
        readArchive: async () => null,
        readHealth: async () => healthRows(),
      });
      expect(result.states).toHaveLength(27);
      expect(result.states[0]!.uf).toBe("AC");
      expect(result.degraded).toBe(false);
      expect(result.generatedAt).toBe(NOW.toISOString());
      expect(result.health).toHaveLength(2);
      expect(result.health.every((h) => h.isStale === false)).toBe(true);
    },
  );

  it.skipIf(!existsSync(modulePath))(
    "cache miss + archive hit → archived states, degraded=true",
    async () => {
      const { loadSnapshotForUi } = await import("./load");
      const body = fullSnapshot();
      const result = await loadSnapshotForUi({
        now: NOW,
        readCache: async () => null,
        readArchive: async () => body,
        readHealth: async () => healthRows(),
      });
      expect(result.states).toHaveLength(27);
      expect(result.degraded).toBe(true);
    },
  );

  it.skipIf(!existsSync(modulePath))(
    "cache miss + archive miss → total-failure floor (27 unknown states, all health stale)",
    async () => {
      const { loadSnapshotForUi } = await import("./load");
      const result = await loadSnapshotForUi({
        now: NOW,
        readCache: async () => null,
        readArchive: async () => null,
        readHealth: async () => healthRows({ cemaden: null, inmet: null }),
      });
      expect(result.states).toHaveLength(27);
      expect(result.states.every((s) => s.risk === "unknown")).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.health.every((h) => h.isStale === true)).toBe(true);
      // UFs cover all 27 canonical codes
      const ufs = new Set(result.states.map((s) => s.uf));
      for (const u of UF27) expect(ufs.has(u)).toBe(true);
    },
  );

  it.skipIf(!existsSync(modulePath))("health rows older than 30 min are marked stale", async () => {
    const { loadSnapshotForUi } = await import("./load");
    const result = await loadSnapshotForUi({
      now: NOW,
      readCache: async () => fullSnapshot(),
      readArchive: async () => null,
      readHealth: async () => healthRows({ cemaden: new Date(STALE_ISO) }),
    });
    const cem = result.health.find((h) => h.key === "cemaden");
    expect(cem?.isStale).toBe(true);
    const inm = result.health.find((h) => h.key === "inmet");
    expect(inm?.isStale).toBe(false);
  });

  it.skipIf(!existsSync(modulePath))(
    "health entries carry displayName + stability from registry-meta",
    async () => {
      const { loadSnapshotForUi } = await import("./load");
      const result = await loadSnapshotForUi({
        now: NOW,
        readCache: async () => fullSnapshot(),
        readArchive: async () => null,
        readHealth: async () => healthRows(),
      });
      const cem = result.health.find((h) => h.key === "cemaden");
      expect(cem?.displayName).toContain("CEMADEN");
      expect(cem?.stability).toBe("unstable");
      const inm = result.health.find((h) => h.key === "inmet");
      expect(inm?.displayName).toContain("INMET");
      expect(inm?.stability).toBe("stable");
    },
  );

  it.skipIf(!existsSync(modulePath))(
    "never throws on internal errors — returns floor",
    async () => {
      const { loadSnapshotForUi } = await import("./load");
      const result = await loadSnapshotForUi({
        now: NOW,
        readCache: async () => {
          throw new Error("redis down");
        },
        readArchive: async () => {
          throw new Error("db down");
        },
        readHealth: async () => {
          throw new Error("db down");
        },
      });
      expect(result.states).toHaveLength(27);
      expect(result.states.every((s) => s.risk === "unknown")).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.health.length).toBeGreaterThanOrEqual(2);
      expect(result.health.every((h) => h.isStale === true)).toBe(true);
    },
  );

  it.skipIf(!existsSync(modulePath))(
    "schema-invalid cache body falls through to archive fallback",
    async () => {
      const { loadSnapshotForUi } = await import("./load");
      const archived = fullSnapshot();
      const result = await loadSnapshotForUi({
        now: NOW,
        readCache: async () => [{ uf: "AC", risk: "green" }] as unknown,
        readArchive: async () => archived,
        readHealth: async () => healthRows(),
      });
      expect(result.states).toHaveLength(27);
      expect(result.degraded).toBe(true);
    },
  );
});
