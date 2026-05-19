/**
 * Snapshot-composition tests for POST /api/ingest (Phase 5 risk-engine wiring).
 *
 * Unlike route.test.ts (which gates on DATABASE_URL_TEST and exercises real
 * Postgres + Upstash), this suite is INFRA-INDEPENDENT: every external
 * collaborator is vi.mocked at the module boundary. Goal: verify that the
 * /api/ingest composer actually pipes alerts through the risk engine
 * (calculateRiskLevel -> applyStaleness -> generateExplanation) and writes
 * a non-placeholder snapshot.
 *
 * Specifically guards against the regression where Step 5 hardcoded
 * risk:"unknown" + formulaVersion:"v0-placeholder" for all 27 UFs.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { computePayloadHash } from "@/lib/sources/hash";
import type { Alert } from "@/lib/sources/schema";
import type { StateSnapshot } from "@/lib/api/schemas";

// --------------------------------------------------------------------------
// Module mocks
// --------------------------------------------------------------------------

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuthVerify = vi.fn(() => true);
vi.mock("@/lib/auth/token", () => ({
  verifyBearerToken: () => mockAuthVerify(),
}));

const mockGetSnapshot = vi.fn(async (): Promise<unknown> => null);
const mockSetSnapshot = vi.fn(async (_body: unknown): Promise<void> => {});
vi.mock("@/lib/cache/upstash", () => ({
  getSnapshot: () => mockGetSnapshot(),
  setSnapshot: (body: unknown) => mockSetSnapshot(body),
}));

// Adapter fixtures: SP high (-> red), RJ moderate (-> orange),
// AM low (-> yellow), MG no alerts (-> green via no DB rows).
function makeAlert(partial: Omit<Alert, "payload_hash">): Alert {
  return { ...partial, payload_hash: computePayloadHash(partial) };
}

// Use runtime-relative times so the test is independent of wall-clock drift.
const RUNTIME_NOW = new Date();
const FIXED_NOW_ISO = RUNTIME_NOW.toISOString();
const VALID_UNTIL_ISO = new Date(RUNTIME_NOW.getTime() + 6 * 60 * 60 * 1000).toISOString();

const FIXTURE_ALERTS: Alert[] = [
  makeAlert({
    source_key: "inmet",
    hazard_kind: "enchente",
    state_uf: "SP",
    severity: "high",
    headline: "Risco de enchente em SP",
    fetched_at: FIXED_NOW_ISO,
    valid_from: FIXED_NOW_ISO,
    valid_until: VALID_UNTIL_ISO,
    raw: { uf: "SP" },
  }),
  makeAlert({
    source_key: "inmet",
    hazard_kind: "queimada",
    state_uf: "RJ",
    severity: "moderate",
    headline: "Foco moderado em RJ",
    fetched_at: FIXED_NOW_ISO,
    valid_from: FIXED_NOW_ISO,
    valid_until: VALID_UNTIL_ISO,
    raw: { uf: "RJ" },
  }),
  makeAlert({
    source_key: "inmet",
    hazard_kind: "estiagem",
    state_uf: "AM",
    severity: "low",
    headline: "Estiagem leve em AM",
    fetched_at: FIXED_NOW_ISO,
    valid_from: FIXED_NOW_ISO,
    valid_until: VALID_UNTIL_ISO,
    raw: { uf: "AM" },
  }),
];

const mockAdapterFetch = vi.fn<() => Promise<Alert[]>>();
vi.mock("@/lib/sources/registry", () => ({
  sources: [{ key: "inmet", displayName: "INMET", fetch: () => mockAdapterFetch() }],
  sourceDisplayNames: { inmet: "INMET" },
}));

// --------------------------------------------------------------------------
// Drizzle `db` stub — chainable, returning configurable rows. Each test
// reassigns `dbSelectQueue` to control which select-call returns which rows.
// --------------------------------------------------------------------------

type DbRow = Record<string, unknown>;
let dbSelectQueue: DbRow[][] = [];
let dbInsertedSnapshots: Array<{ body: StateSnapshot[]; formulaVersion: string }> = [];

function makeSelectChain(rows: DbRow[]) {
  // Awaitable at any point in the chain:
  //   db.select().from(t)                          -> rows
  //   db.select().from(t).where(...)               -> rows
  const chain: {
    from: () => typeof chain;
    where: () => Promise<DbRow[]>;
    then: <T>(onFulfilled: (v: DbRow[]) => T) => Promise<T>;
  } = {
    from: () => chain,
    where: () => Promise.resolve(rows),
    then: (onFulfilled) => Promise.resolve(rows).then(onFulfilled),
  };
  return chain;
}

const dbStub = {
  select: () => makeSelectChain(dbSelectQueue.shift() ?? []),
  insert: (table: { _: { name?: string } } | unknown) => {
    void table;
    return {
      values: (vals: DbRow | DbRow[]) => {
        const valuesArr = Array.isArray(vals) ? vals : [vals];
        const onConflict = {
          returning: () =>
            Promise.resolve(valuesArr.map(() => ({ id: "00000000-0000-0000-0000-000000000000" }))),
        };
        const builder = {
          onConflictDoNothing: () => ({
            ...onConflict,
            then: (resolve: (v: unknown[]) => unknown) =>
              Promise.resolve(valuesArr.map(() => ({ id: "x" }))).then(resolve),
          }),
          onConflictDoUpdate: (_arg: unknown) => {
            void _arg;
            // Capture snapshot_cache writes for assertions.
            for (const v of valuesArr) {
              if ("snapshotKey" in v && v.snapshotKey === "current") {
                dbInsertedSnapshots.push({
                  body: v.body as StateSnapshot[],
                  formulaVersion: v.formulaVersion as string,
                });
              }
            }
            return Promise.resolve(undefined);
          },
          returning: () => Promise.resolve(valuesArr.map(() => ({ id: "x" }))),
          then: (resolve: (v: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
        };
        return builder;
      },
    };
  },
};

vi.mock("@/db/node", () => ({ db: dbStub }));

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe("POST /api/ingest — snapshot composition (risk-engine wiring)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthVerify.mockReturnValue(true);
    mockAdapterFetch.mockResolvedValue([...FIXTURE_ALERTS]);
    mockGetSnapshot.mockResolvedValue(null);
    mockSetSnapshot.mockResolvedValue(undefined);
    dbInsertedSnapshots = [];
    process.env.INGEST_TOKEN = "test-token";
    // Two select calls per POST: (1) active alerts (2) sources_health.
    // Default: tests reassign before invoking POST.
    dbSelectQueue = [];
  });

  function makeActiveRows(): DbRow[] {
    return FIXTURE_ALERTS.map((a) => ({
      sourceKey: a.source_key,
      hazardKind: a.hazard_kind,
      stateUf: a.state_uf,
      severity: a.severity,
      headline: a.headline,
      body: a.body ?? null,
      sourceUrl: a.source_url ?? null,
      fetchedAt: new Date(a.fetched_at),
      validFrom: a.valid_from ? new Date(a.valid_from) : null,
      validUntil: a.valid_until ? new Date(a.valid_until) : null,
      payloadHash: a.payload_hash,
      raw: a.raw,
    }));
  }

  function makeHealthRows(stale = false): DbRow[] {
    const now = new Date();
    const lastSuccessAt = stale
      ? new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2h ago (stale)
      : now; // fresh
    return [{ sourceKey: "inmet", lastSuccessAt }];
  }

  async function callRoute() {
    const { POST } = await import("./route");
    return POST(
      new Request("http://x.test/api/ingest", {
        method: "POST",
        headers: { authorization: "Bearer test-token" },
      }),
    );
  }

  it("composes per-UF risk via the engine (SP=red, RJ=orange, AM=yellow, MG=green)", async () => {
    dbSelectQueue = [makeActiveRows(), makeHealthRows(false)];
    const res = await callRoute();
    expect(res.status).toBe(200);

    expect(dbInsertedSnapshots.length).toBe(1);
    const snap = dbInsertedSnapshots[0]!.body;
    expect(snap.length).toBe(27);

    const byUf = new Map(snap.map((s) => [s.uf, s]));
    expect(byUf.get("SP")!.risk).toBe("red");
    expect(byUf.get("RJ")!.risk).toBe("orange");
    expect(byUf.get("AM")!.risk).toBe("yellow");
    expect(byUf.get("MG")!.risk).toBe("green");
  });

  it("riskReason is non-empty PT-BR text for non-unknown levels (regression guard)", async () => {
    dbSelectQueue = [makeActiveRows(), makeHealthRows(false)];
    await callRoute();
    const snap = dbInsertedSnapshots[0]!.body;
    const byUf = new Map(snap.map((s) => [s.uf, s]));
    // SP has a high-severity alert -> explanation must mention it.
    expect(byUf.get("SP")!.riskReason).toMatch(/alerta/i);
    expect(byUf.get("SP")!.riskReason).not.toBe("Dados indisponíveis no momento.");
    // MG has no alerts -> 'green' uses "Sem alertas ativos."
    expect(byUf.get("MG")!.riskReason).toBe("Sem alertas ativos.");
  });

  it("writes FORMULA_VERSION='v0' (not the placeholder string)", async () => {
    dbSelectQueue = [makeActiveRows(), makeHealthRows(false)];
    await callRoute();
    expect(dbInsertedSnapshots[0]!.formulaVersion).toBe("v0");
    const snap = dbInsertedSnapshots[0]!.body;
    for (const s of snap) {
      expect(s.formulaVersion).toBe("v0");
    }
    // setSnapshot (Upstash) received the same composed body.
    expect(mockSetSnapshot).toHaveBeenCalledTimes(1);
    const firstCall = mockSetSnapshot.mock.calls[0];
    if (!firstCall) throw new Error("setSnapshot was not called");
    const upstashBody = firstCall[0] as StateSnapshot[];
    expect(upstashBody.every((s) => s.formulaVersion === "v0")).toBe(true);
  });

  it("staleness override: all sources stale >1h -> every UF risk='unknown'", async () => {
    dbSelectQueue = [makeActiveRows(), makeHealthRows(true)];
    await callRoute();
    const snap = dbInsertedSnapshots[0]!.body;
    for (const s of snap) {
      expect(s.risk).toBe("unknown");
      expect(s.riskReason).toBe("Dados indisponíveis no momento.");
    }
  });

  it("snapshot shape preserved: 27 entries, all required StateSnapshot fields", async () => {
    dbSelectQueue = [makeActiveRows(), makeHealthRows(false)];
    await callRoute();
    const snap = dbInsertedSnapshots[0]!.body;
    expect(snap.length).toBe(27);
    for (const s of snap) {
      expect(typeof s.uf).toBe("string");
      expect(typeof s.risk).toBe("string");
      expect(typeof s.riskReason).toBe("string");
      expect(s.riskReason.length).toBeGreaterThan(0);
      expect(typeof s.alertCount).toBe("number");
      expect(s.formulaVersion).toBe("v0");
    }
  });
});
