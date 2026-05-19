/**
 * CEMADEN adapter unit tests (Plan 05-04, Task 2).
 *
 * Mirrors `src/lib/sources/inmet.test.ts` structure: DI seam via
 * `createCemadenAdapter(http)`, vi-mocked production wiring, every error
 * assertion through `isSourceError(e) && e.code === "..."` (W-1 invariant
 * — no `instanceof SourceError`).
 *
 * Target: 100/100/100/100 line/branch/func/stmt for
 *   - src/lib/sources/cemaden.ts
 *   - src/lib/sources/cemaden.schema.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/http/fetcher", () => ({
  httpGet: vi.fn(),
  httpGetText: vi.fn(),
  HttpError: class extends Error {},
}));

import {
  createCemadenAdapter,
  cemadenAdapter,
  CEMADEN_WS_ALERTAS_URL,
  type CemadenHttpClient,
} from "@/lib/sources/cemaden";
import { isSourceError } from "@/lib/sources/errors";
import { WsAlertas2ResponseSchema, assertWsAlertas2Response } from "@/lib/sources/cemaden.schema";
import { httpGet } from "@/lib/http/fetcher";
import fixture from "../fixtures/sources/cemaden-2026-05-18.json";

// --- Stub client builder ---------------------------------------------------

interface StubInputs {
  payload?: unknown | (() => Promise<unknown>);
}

function makeStubClient(inputs: StubInputs): CemadenHttpClient {
  return {
    async getJson<T = unknown>(url: string): Promise<T> {
      if (url !== CEMADEN_WS_ALERTAS_URL) {
        throw new Error(`stub getJson called with unexpected URL: ${url}`);
      }
      const v = inputs.payload;
      if (typeof v === "function") return (await (v as () => Promise<unknown>)()) as T;
      return v as T;
    },
  };
}

// --- Payload builders ------------------------------------------------------

type Alertar = {
  cod_alerta: number;
  datahoracriacao: string;
  ult_atualizacao: string;
  codibge: number;
  evento: string;
  nivel: "Moderado" | "Alto" | "Muito Alto";
  status: number;
  uf: string;
  municipio: string;
  latitude: number;
  longitude: number;
};

function makeAlert(overrides: Partial<Alertar> = {}): Alertar {
  return {
    cod_alerta: 1,
    datahoracriacao: "2026-05-09 17:30:37.092",
    ult_atualizacao: "2026-05-09 17:30:37.092",
    codibge: 1302504,
    evento: "Risco Hidrológico - Moderado",
    nivel: "Moderado",
    status: 1,
    uf: "AM",
    municipio: "MANACAPURU",
    latitude: -3.29,
    longitude: -60.95,
    ...overrides,
  };
}

function makePayload(alertas: Alertar[]): unknown {
  return {
    alertas,
    atualizado: "18-05-2026 22:15:01 UTC",
  };
}

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe("createCemadenAdapter — happy paths", () => {
  it("fixture payload → 5 Alert objects with UTC ISO-Z timestamps", async () => {
    const adapter = createCemadenAdapter(makeStubClient({ payload: fixture }));
    const out = await adapter.fetch();
    expect(out).toHaveLength(5);
    for (const a of out) {
      expect(a.source_key).toBe("cemaden");
      expect(a.valid_from).toMatch(/Z$/);
      expect(a.valid_until).toMatch(/Z$/);
      expect(a.fetched_at).toMatch(/Z$/);
      expect(a.payload_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(a.source_url).toBe(CEMADEN_WS_ALERTAS_URL);
    }
  });

  it("first fixture alert: AM/MANACAPURU → enchente + moderate; valid_from ISO-Z exact", async () => {
    const adapter = createCemadenAdapter(makeStubClient({ payload: fixture }));
    const out = await adapter.fetch();
    const a = out[0]!;
    expect(a.state_uf).toBe("AM");
    expect(a.hazard_kind).toBe("enchente");
    expect(a.severity).toBe("moderate");
    expect(a.headline).toBe("Risco Hidrológico - Moderado — MANACAPURU/AM");
    // datahoracriacao "2026-05-09 17:30:37.092" → ISO-Z
    expect(a.valid_from).toBe("2026-05-09T17:30:37.092Z");
    // 24h validity window (RISK-05 default)
    expect(a.valid_until).toBe("2026-05-10T17:30:37.092Z");
  });

  it("body field is undefined (CEMADEN payload has no body)", async () => {
    const adapter = createCemadenAdapter(makeStubClient({ payload: fixture }));
    const out = await adapter.fetch();
    expect(out[0]!.body).toBeUndefined();
  });

  it("third fixture alert (AP) has severity 'high'", async () => {
    const adapter = createCemadenAdapter(makeStubClient({ payload: fixture }));
    const out = await adapter.fetch();
    expect(out[2]!.severity).toBe("high");
    expect(out[2]!.state_uf).toBe("AP");
  });
});

// ---------------------------------------------------------------------------
// nivel → severity mapping
// ---------------------------------------------------------------------------

describe("createCemadenAdapter — severity mapping", () => {
  it.each([
    ["Moderado", "moderate"],
    ["Alto", "high"],
    ["Muito Alto", "extreme"],
  ] as const)("nivel %s → severity %s", async (nivel, expected) => {
    const payload = makePayload([makeAlert({ nivel })]);
    const adapter = createCemadenAdapter(makeStubClient({ payload }));
    const out = await adapter.fetch();
    expect(out[0]!.severity).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Hazard mapping (CLAUDE.md CEMADEN vocab)
// ---------------------------------------------------------------------------

describe("createCemadenAdapter — hazard mapping", () => {
  it("'Risco Hidrológico - Moderado' → enchente", async () => {
    const payload = makePayload([makeAlert({ evento: "Risco Hidrológico - Moderado" })]);
    const adapter = createCemadenAdapter(makeStubClient({ payload }));
    const out = await adapter.fetch();
    expect(out[0]!.hazard_kind).toBe("enchente");
  });

  it("'Movimento de Massa - Alto' → deslizamento", async () => {
    const payload = makePayload([
      makeAlert({ evento: "Movimento de Massa - Alto", nivel: "Alto" }),
    ]);
    const adapter = createCemadenAdapter(makeStubClient({ payload }));
    const out = await adapter.fetch();
    expect(out[0]!.hazard_kind).toBe("deslizamento");
  });

  it("unmappable evento 'Terremoto' → all alerts drop (per-alert isolation), returns []", async () => {
    const payload = makePayload([makeAlert({ evento: "Terremoto" })]);
    const adapter = createCemadenAdapter(makeStubClient({ payload }));
    const out = await adapter.fetch();
    // Per-alert allSettled isolation — one bad alert drops, doesn't poison the tick.
    expect(out).toEqual([]);
  });

  it("unmappable evento drops bad alert; sibling survives", async () => {
    const payload = makePayload([
      makeAlert({ cod_alerta: 1, evento: "Terremoto" }),
      makeAlert({ cod_alerta: 2, evento: "Risco Hidrológico - Alto", nivel: "Alto" }),
    ]);
    const adapter = createCemadenAdapter(makeStubClient({ payload }));
    const out = await adapter.fetch();
    expect(out).toHaveLength(1);
    expect(out[0]!.severity).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// Schema invalid
// ---------------------------------------------------------------------------

describe("createCemadenAdapter — schema_invalid (top-level payload)", () => {
  it("missing 'alertas' field → sourceError code='schema_invalid'", async () => {
    const adapter = createCemadenAdapter(
      makeStubClient({ payload: { atualizado: "18-05-2026 22:15:01 UTC" } }),
    );
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "schema_invalid",
    );
  });

  it("extra top-level field rejected by .strict()", async () => {
    const payload = { ...(makePayload([]) as object), extraField: "nope" };
    const adapter = createCemadenAdapter(makeStubClient({ payload }));
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "schema_invalid",
    );
  });

  it("missing 'atualizado' field → schema_invalid", async () => {
    const adapter = createCemadenAdapter(makeStubClient({ payload: { alertas: [] } }));
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "schema_invalid",
    );
  });

  it("'atualizado' wrong format → schema_invalid", async () => {
    const adapter = createCemadenAdapter(
      makeStubClient({ payload: { alertas: [], atualizado: "2026-05-18T22:15:01Z" } }),
    );
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "schema_invalid",
    );
  });

  it("per-alert extra field rejected by .strict() → alert dropped", async () => {
    const a = { ...makeAlert(), bogus: "field" } as unknown as Alertar;
    const payload = makePayload([a]);
    const adapter = createCemadenAdapter(makeStubClient({ payload }));
    // The top-level safeParse fails because the alert sub-schema is also strict.
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "schema_invalid",
    );
  });

  it("invalid uf (not in UF27) → schema_invalid", async () => {
    const a = makeAlert();
    (a as unknown as { uf: string }).uf = "ZZ";
    const payload = makePayload([a]);
    const adapter = createCemadenAdapter(makeStubClient({ payload }));
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "schema_invalid",
    );
  });

  it("invalid nivel ('Atenção' — INMET vocab leak) → schema_invalid", async () => {
    const a = makeAlert();
    (a as unknown as { nivel: string }).nivel = "Atenção";
    const payload = makePayload([a]);
    const adapter = createCemadenAdapter(makeStubClient({ payload }));
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "schema_invalid",
    );
  });

  it("invalid datahoracriacao format → schema_invalid", async () => {
    const a = makeAlert({ datahoracriacao: "not-a-date" });
    const payload = makePayload([a]);
    const adapter = createCemadenAdapter(makeStubClient({ payload }));
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "schema_invalid",
    );
  });
});

// ---------------------------------------------------------------------------
// HTTP errors
// ---------------------------------------------------------------------------

describe("createCemadenAdapter — http error mapping", () => {
  it("AbortError (top-level name) → sourceError code='timeout'", async () => {
    const adapter = createCemadenAdapter(
      makeStubClient({
        payload: () => {
          const e = new Error("aborted") as Error & { name: string };
          e.name = "AbortError";
          return Promise.reject(e);
        },
      }),
    );
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "timeout",
    );
  });

  it("TimeoutError via cause.name → sourceError code='timeout'", async () => {
    const adapter = createCemadenAdapter(
      makeStubClient({
        payload: () => {
          const e = new Error("wrapped") as Error & { cause?: { name?: string } };
          e.cause = { name: "TimeoutError" };
          return Promise.reject(e);
        },
      }),
    );
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "timeout",
    );
  });

  it("HTTP 500 → sourceError code='http_5xx'", async () => {
    const adapter = createCemadenAdapter(
      makeStubClient({
        payload: () => {
          const e = new Error("upstream 500") as Error & { status?: number };
          e.status = 500;
          return Promise.reject(e);
        },
      }),
    );
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "http_5xx",
    );
  });

  it("HTTP 429 → sourceError code='http_5xx' (collapsed)", async () => {
    const adapter = createCemadenAdapter(
      makeStubClient({
        payload: () => {
          const e = new Error("rate limit") as Error & { status?: number };
          e.status = 429;
          return Promise.reject(e);
        },
      }),
    );
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "http_5xx",
    );
  });

  it("HTTP 400 generic 4xx → sourceError code='http_5xx' (collapsed)", async () => {
    const adapter = createCemadenAdapter(
      makeStubClient({
        payload: () => {
          const e = new Error("bad request") as Error & { status?: number };
          e.status = 400;
          return Promise.reject(e);
        },
      }),
    );
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "http_5xx",
    );
  });

  it("error with no status field → sourceError code='http_5xx'", async () => {
    const adapter = createCemadenAdapter(
      makeStubClient({
        payload: () => Promise.reject(new Error("generic network failure")),
      }),
    );
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "http_5xx",
    );
  });

  it("error with no message → sourceError code='http_5xx' ('unknown' fallback)", async () => {
    const adapter = createCemadenAdapter(makeStubClient({ payload: () => Promise.reject({}) }));
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "http_5xx" && e.message.includes("unknown"),
    );
  });
});

// ---------------------------------------------------------------------------
// Drift tripwires
// ---------------------------------------------------------------------------

describe("createCemadenAdapter — drift tripwires", () => {
  it("timestamp 1900-01-01 (below MIN_VALID_MS) → bad alert dropped (out of plausible range)", async () => {
    // Use a valid format but out-of-range date. Schema regex requires ISO-like
    // `YYYY-MM-DD HH:MM:SS[.fff]` — `1900-01-01 00:00:00` matches the shape,
    // so it passes schema; the adapter's parseCemadenUtc tripwire then rejects.
    const a = makeAlert({ datahoracriacao: "1900-01-01 00:00:00" });
    const payload = makePayload([a]);
    const adapter = createCemadenAdapter(makeStubClient({ payload }));
    const out = await adapter.fetch();
    expect(out).toEqual([]);
  });

  it("timestamp 60 days in the future (beyond DRIFT_FORWARD_MS) → dropped", async () => {
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    // Format as "YYYY-MM-DD HH:MM:SS"
    const pad = (n: number) => String(n).padStart(2, "0");
    const ts =
      `${future.getUTCFullYear()}-${pad(future.getUTCMonth() + 1)}-${pad(future.getUTCDate())} ` +
      `${pad(future.getUTCHours())}:${pad(future.getUTCMinutes())}:${pad(future.getUTCSeconds())}`;
    const a = makeAlert({ datahoracriacao: ts });
    const payload = makePayload([a]);
    const adapter = createCemadenAdapter(makeStubClient({ payload }));
    const out = await adapter.fetch();
    expect(out).toEqual([]);
  });

  it("bad timestamp drops bad alert; sibling survives", async () => {
    const payload = makePayload([
      makeAlert({ cod_alerta: 1, datahoracriacao: "1900-01-01 00:00:00" }),
      makeAlert({ cod_alerta: 2 }),
    ]);
    const adapter = createCemadenAdapter(makeStubClient({ payload }));
    const out = await adapter.fetch();
    expect(out).toHaveLength(1);
    expect(out[0]!.valid_from).toBe("2026-05-09T17:30:37.092Z");
  });

  it("unparseable but schema-valid-shape timestamp throws (assertion of branch)", () => {
    // The regex tolerates "9999-99-99 99:99:99"? No — \d{2} matches but Date()
    // returns NaN. Verify the parser branch via direct schema parse (shape OK)
    // → adapter drops alert. We assert via the contract test elsewhere; here
    // we just lock the schema regex behavior: format "2026-13-01 25:00:00"
    // has all-digit positions, so it passes regex but `new Date()` is NaN.
    const a = makeAlert({ datahoracriacao: "2026-13-01 25:00:00" });
    const result = WsAlertas2ResponseSchema.safeParse(makePayload([a]));
    // Regex accepts the shape (purely digit-positional), so schema passes.
    expect(result.success).toBe(true);
  });

  it("schema-valid-shape but Date()-unparseable timestamp drops alert at adapter layer", async () => {
    const a = makeAlert({ datahoracriacao: "2026-13-01 25:00:00" });
    const payload = makePayload([a]);
    const adapter = createCemadenAdapter(makeStubClient({ payload }));
    const out = await adapter.fetch();
    expect(out).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("createCemadenAdapter — edge cases", () => {
  it("empty alertas array → returns [] (calm day)", async () => {
    const adapter = createCemadenAdapter(makeStubClient({ payload: makePayload([]) }));
    const out = await adapter.fetch();
    expect(out).toEqual([]);
  });

  it("production cemadenAdapter wires httpGet (PROD_HTTP_CLIENT path)", async () => {
    vi.clearAllMocks();
    vi.mocked(httpGet).mockResolvedValueOnce(fixture);
    const out = await cemadenAdapter.fetch();
    expect(out).toHaveLength(5);
    expect(vi.mocked(httpGet)).toHaveBeenCalledWith(CEMADEN_WS_ALERTAS_URL);
  });
});

// ---------------------------------------------------------------------------
// Schema helper coverage (cemaden.schema.ts)
// ---------------------------------------------------------------------------

describe("assertWsAlertas2Response", () => {
  it("returns parsed value for a valid payload", () => {
    const ok = assertWsAlertas2Response(fixture);
    expect(ok.alertas).toHaveLength(5);
    expect(ok.atualizado).toBe("18-05-2026 22:15:01 UTC");
  });

  it("throws sourceError('schema_invalid') for non-object input", () => {
    let caught: unknown;
    try {
      assertWsAlertas2Response("nope" as unknown);
    } catch (e) {
      caught = e;
    }
    expect(isSourceError(caught) && caught.code === "schema_invalid").toBe(true);
  });

  it("throws sourceError('schema_invalid') for null input", () => {
    let caught: unknown;
    try {
      assertWsAlertas2Response(null as unknown);
    } catch (e) {
      caught = e;
    }
    expect(isSourceError(caught) && caught.code === "schema_invalid").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Reset module state between suites that touch the mocked module
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.clearAllMocks();
});
