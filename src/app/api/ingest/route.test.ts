/**
 * Integration tests for POST /api/ingest (REQ-S2.07).
 *
 * Gated on DATABASE_URL_TEST (Postgres docker setup lands in plan 02-10);
 * skipped silently when absent so CI stays green pre-02-10.
 *
 * Auth + Upstash mock cases run regardless via the 401 branch which
 * short-circuits before any DB access.
 *
 * Phase 4 cutover (plan 04-06): stub adapter removed; registry now exports
 * inmetAdapter. The registry is mocked here to provide deterministic test
 * data (3 fixed alerts) without real network calls to INMET.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { __setRedisForTest } from "@/lib/cache/upstash";
import { UpstashRedisMock } from "../../../../tests/setup/upstash-mock";
import { computePayloadHash } from "@/lib/sources/hash";
import type { Alert } from "@/lib/sources/schema";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ---------------------------------------------------------------------------
// Deterministic test alerts (3 alerts, 3 distinct UFs → 27 state snapshots).
// Replaces the old stub-default.json fixture. Source key updated to "inmet"
// following the Phase 4 atomic cutover.
// ---------------------------------------------------------------------------

function makeTestAlert(partial: Omit<Alert, "payload_hash">): Alert {
  return { ...partial, payload_hash: computePayloadHash(partial) };
}

const INGEST_TEST_ALERTS: Alert[] = [
  makeTestAlert({
    source_key: "inmet",
    hazard_kind: "queimada",
    state_uf: "SP",
    severity: "moderate",
    headline: "Foco de queimada detectado em zona rural",
    body: "Test fixture — ingest integration.",
    source_url: "https://stub.example/sp/queimada",
    fetched_at: "2026-05-01T00:00:00.000Z",
    valid_from: "2026-05-01T00:00:00.000Z",
    valid_until: "2026-05-01T06:00:00.000Z",
    raw: { stub: true, uf: "SP" },
  }),
  makeTestAlert({
    source_key: "inmet",
    hazard_kind: "enchente",
    state_uf: "RJ",
    severity: "high",
    headline: "Risco de enchente em áreas baixas",
    body: "Test fixture — ingest integration.",
    source_url: "https://stub.example/rj/enchente",
    fetched_at: "2026-05-01T00:00:00.000Z",
    valid_from: "2026-05-01T00:00:00.000Z",
    valid_until: "2026-05-01T12:00:00.000Z",
    raw: { stub: true, uf: "RJ" },
  }),
  makeTestAlert({
    source_key: "inmet",
    hazard_kind: "estiagem",
    state_uf: "AM",
    severity: "extreme",
    headline: "Estiagem severa afeta comunidades ribeirinhas",
    body: "Test fixture — ingest integration.",
    source_url: "https://stub.example/am/estiagem",
    fetched_at: "2026-05-01T00:00:00.000Z",
    valid_from: "2026-05-01T00:00:00.000Z",
    valid_until: "2026-05-08T00:00:00.000Z",
    raw: { stub: true, uf: "AM" },
  }),
];

// ---------------------------------------------------------------------------
// Registry mock — injects controlled test source instead of live inmetAdapter.
// A module-scope vi.fn() lets individual tests override the return value.
// ---------------------------------------------------------------------------

const mockInmetFetch = vi.fn<() => Promise<Alert[]>>();

vi.mock("@/lib/sources/registry", () => ({
  sources: [
    {
      key: "inmet",
      displayName: "INMET — Alert-AS",
      fetch: mockInmetFetch,
    },
  ],
  sourceDisplayNames: { inmet: "INMET — Alert-AS" },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const skip = !process.env.DATABASE_URL_TEST;

// Lazy holders — populated only when DATABASE_URL_TEST is set, so importing
// @/db/node (which evaluates getPool() at module-load) doesn't crash CI when
// the test PG container (plan 02-10) isn't available.
type DbModule = typeof import("@/db/node");
type SchemaModule = typeof import("@/db/schema");
let dbMod: DbModule;
let schemaMod: SchemaModule;

describe.skipIf(skip)("POST /api/ingest (integration)", () => {
  let mock: UpstashRedisMock;

  beforeEach(async () => {
    if (!dbMod) {
      // DATABASE_URL must be aliased to DATABASE_URL_TEST for the node pool.
      process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
      dbMod = await import("@/db/node");
      schemaMod = await import("@/db/schema");
    }
    mock = new UpstashRedisMock();
    __setRedisForTest(mock as never);
    process.env.INGEST_TOKEN = "test-token-abc";
    // Default: mock returns 3 deterministic test alerts per fetch.
    mockInmetFetch.mockResolvedValue([...INGEST_TEST_ALERTS]);
    await dbMod.db.delete(schemaMod.alerts);
    await dbMod.db.delete(schemaMod.sourcesHealth);
    await dbMod.db.delete(schemaMod.snapshotCache);
    vi.clearAllMocks();
    // Re-apply default after clearAllMocks (which clears implementations too).
    mockInmetFetch.mockResolvedValue([...INGEST_TEST_ALERTS]);
  });

  it("rejects request without Authorization → 401", async () => {
    const { POST } = await import("./route");
    const res = await POST(new Request("http://x.test/api/ingest", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("rejects bad token → 401", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://x.test/api/ingest", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("valid token → 200 + adopts 3 alerts on first call", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://x.test/api/ingest", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.adoptedCount).toBe(3);
    const all = await dbMod.db.select().from(schemaMod.alerts);
    expect(all.length).toBe(3);
  });

  it("dedup: second call adds 0 new rows", async () => {
    const { POST } = await import("./route");
    const headers = { authorization: "Bearer test-token-abc" };
    await POST(new Request("http://x.test/api/ingest", { method: "POST", headers }));
    const res2 = await POST(new Request("http://x.test/api/ingest", { method: "POST", headers }));
    const body2 = await res2.json();
    expect(body2.adoptedCount).toBe(0);
    const all = await dbMod.db.select().from(schemaMod.alerts);
    expect(all.length).toBe(3);
  });

  it("snapshot:current set in Upstash with length 27", async () => {
    const { POST } = await import("./route");
    await POST(
      new Request("http://x.test/api/ingest", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc" },
      }),
    );
    const cached = await mock.get<unknown[]>("snapshot:current");
    expect(Array.isArray(cached)).toBe(true);
    expect(cached!.length).toBe(27);
  });

  it("snapshot_cache table receives matching row", async () => {
    const { POST } = await import("./route");
    await POST(
      new Request("http://x.test/api/ingest", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc" },
      }),
    );
    const rows = await dbMod.db.select().from(schemaMod.snapshotCache);
    expect(rows.length).toBe(1);
    expect(rows[0]!.formulaVersion).toBe("v0");
  });

  it("revalidatePath called for all 27 UFs + root on cold start", async () => {
    const { revalidatePath } = await import("next/cache");
    const { POST } = await import("./route");
    await POST(
      new Request("http://x.test/api/ingest", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc" },
      }),
    );
    expect(revalidatePath).toHaveBeenCalledTimes(28);
  });

  it("revalidatePath called 0 times on second steady-state call (placeholder unchanged)", async () => {
    const { revalidatePath } = await import("next/cache");
    const { POST } = await import("./route");
    const headers = { authorization: "Bearer test-token-abc" };
    await POST(new Request("http://x.test/api/ingest", { method: "POST", headers }));
    vi.clearAllMocks();
    mockInmetFetch.mockResolvedValue([...INGEST_TEST_ALERTS]);
    await POST(new Request("http://x.test/api/ingest", { method: "POST", headers }));
    expect(revalidatePath).toHaveBeenCalledTimes(0);
  });

  it("adapter throw bumps consecutive_failures + writes last_error", async () => {
    // Make the inmet adapter throw a network error for this test only.
    mockInmetFetch.mockRejectedValueOnce(new Error("simulated network failure"));
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://x.test/api/ingest", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sources[0].status).toBe("error");
    const health = await dbMod.db.select().from(schemaMod.sourcesHealth);
    expect(health[0]!.sourceKey).toBe("inmet");
    expect(health[0]!.consecutiveFailures).toBeGreaterThanOrEqual(1);
    expect(health[0]!.lastError).toBeTruthy();
  });
});
