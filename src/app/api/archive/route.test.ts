/**
 * Integration tests for POST /api/archive (REQ-S2.11).
 *
 * Gated on DATABASE_URL_TEST (Postgres docker setup lands in plan 02-10);
 * skipped silently when absent so CI stays green pre-02-10.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";

const skip = !process.env.DATABASE_URL_TEST;

// Lazy holders — populated only when DATABASE_URL_TEST is set, so importing
// @/db/node (which evaluates getPool() at module-load) doesn't crash CI when
// the test PG container (plan 02-10) isn't available.
type DbModule = typeof import("@/db/node");
type SchemaModule = typeof import("@/db/schema");
type RouteModule = typeof import("./route");
let dbMod: DbModule;
let schemaMod: SchemaModule;
let routeMod: RouteModule;

describe.skipIf(skip)("POST /api/archive (integration)", () => {
  beforeAll(async () => {
    dbMod = await import("@/db/node");
    schemaMod = await import("@/db/schema");
    routeMod = await import("./route");
  });

  // Helper run AT START of each test body so it executes AFTER the global
  // setup file's TRUNCATE beforeEach (vitest v4 runs setup-file hooks LAST,
  // after test-file beforeEach hooks — so a beforeEach-based seed gets wiped).
  async function seedSnapshotCache() {
    process.env.INGEST_TOKEN = "test-token-abc";
    await dbMod.db.delete(schemaMod.snapshotArchive);
    await dbMod.db.delete(schemaMod.snapshotCache);
    await dbMod.db.insert(schemaMod.snapshotCache).values({
      snapshotKey: "current",
      body: [{ uf: "SP" }],
      computedAt: new Date(),
      formulaVersion: "v0-placeholder",
    });
  }

  beforeEach(() => {
    process.env.INGEST_TOKEN = "test-token-abc";
  });

  it("rejects without auth → 401", async () => {
    const res = await routeMod.POST(new Request("http://x.test/api/archive", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("produces archive row dated today on first call", async () => {
    await seedSnapshotCache();
    const res = await routeMod.POST(
      new Request("http://x.test/api/archive", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc" },
      }),
    );
    expect(res.status).toBe(200);
    const today = new Date().toISOString().slice(0, 10);
    const rows = await dbMod.db.select().from(schemaMod.snapshotArchive);
    expect(rows.length).toBe(1);
    expect(rows[0]!.date).toBe(today);
  });

  it("idempotent on second call same day (ON CONFLICT DO UPDATE)", async () => {
    await seedSnapshotCache();
    const auth = { authorization: "Bearer test-token-abc" };
    await routeMod.POST(
      new Request("http://x.test/api/archive", { method: "POST", headers: auth }),
    );
    await routeMod.POST(
      new Request("http://x.test/api/archive", { method: "POST", headers: auth }),
    );
    const rows = await dbMod.db.select().from(schemaMod.snapshotArchive);
    expect(rows.length).toBe(1);
  });

  it("prunes archive rows older than 30 days", async () => {
    await seedSnapshotCache();
    const oldDate = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    await dbMod.db.insert(schemaMod.snapshotArchive).values({
      date: oldDate,
      snapshotKey: "current",
      body: [{ stale: true }],
      formulaVersion: "v0-placeholder",
    });
    const res = await routeMod.POST(
      new Request("http://x.test/api/archive", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc" },
      }),
    );
    const body = (await res.json()) as { pruned: number };
    expect(body.pruned).toBeGreaterThanOrEqual(1);
    const remaining = await dbMod.db.select().from(schemaMod.snapshotArchive);
    expect(remaining.find((r) => r.date === oldDate)).toBeUndefined();
  });

  it("returns archived=0 when snapshot_cache is empty", async () => {
    await dbMod.db.delete(schemaMod.snapshotCache);
    const res = await routeMod.POST(
      new Request("http://x.test/api/archive", {
        method: "POST",
        headers: { authorization: "Bearer test-token-abc" },
      }),
    );
    const body = (await res.json()) as { archived: number };
    expect(body.archived).toBe(0);
  });
});
