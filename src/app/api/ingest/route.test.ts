/**
 * Integration tests for POST /api/ingest (REQ-S2.07).
 *
 * Gated on DATABASE_URL_TEST (Postgres docker setup lands in plan 02-10);
 * skipped silently when absent so CI stays green pre-02-10.
 *
 * Auth + Upstash mock cases run regardless via the 401 branch which
 * short-circuits before any DB access.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { __setRedisForTest } from "@/lib/cache/upstash";
import { UpstashRedisMock } from "../../../../tests/setup/upstash-mock";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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
    delete process.env.STUB_FIXTURE_PATH;
    await dbMod.db.delete(schemaMod.alerts);
    await dbMod.db.delete(schemaMod.sourcesHealth);
    await dbMod.db.delete(schemaMod.snapshotCache);
    vi.clearAllMocks();
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

  it("valid token → 200 + adopts 3 stub alerts on first call", async () => {
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
    expect(rows[0]!.formulaVersion).toBe("v0-placeholder");
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
    await POST(new Request("http://x.test/api/ingest", { method: "POST", headers }));
    expect(revalidatePath).toHaveBeenCalledTimes(0);
  });

  it("adapter throw bumps consecutive_failures + writes last_error", async () => {
    process.env.STUB_FIXTURE_PATH = "tests/fixtures/sources/does-not-exist.json";
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
    expect(health[0]!.sourceKey).toBe("stub");
    expect(health[0]!.consecutiveFailures).toBeGreaterThanOrEqual(1);
    expect(health[0]!.lastError).toBeTruthy();
  });
});
