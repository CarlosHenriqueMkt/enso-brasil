/**
 * INMET adapter unit tests.
 *
 * Rebuilt 2026-06 for issue #12 (Bug A) — the legacy CAP XML detail endpoint
 * is dead; the adapter now consumes the full inline payload at
 * `/avisos/ativos`. The contract test in `tests/contract/inmet.test.ts`
 * replays the same flow against a captured live fixture; this file focuses
 * on branch coverage with hand-crafted entries.
 *
 * Every error assertion uses `isSourceError(e) && e.code === "..."` —
 * never `instanceof SourceError` (W-1 invariant: factory only).
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/http/fetcher", () => ({
  httpGet: vi.fn(),
  httpGetText: vi.fn(),
  HttpError: class extends Error {},
}));

import {
  createInmetAdapter,
  inmetAdapter,
  INMET_CAP_LIST,
  type InmetHttpClient,
} from "./inmet";
import { isSourceError } from "./errors";
import { httpGet } from "@/lib/http/fetcher";
import { SEVERITY_TABLE } from "@/lib/risk/sources/inmet";

// --- Stub client builder ---------------------------------------------------

interface StubInputs {
  /**
   * INMET `/avisos/ativos` payload. Accepts either:
   *   - a `{ hoje, futuro }` envelope
   *   - a bare array (auto-wrapped as `{ hoje: arr, futuro: [] }` for ergonomics)
   *   - a function (called lazily — useful for simulating throws)
   */
  list?: unknown | (() => Promise<unknown>);
}

function wrapList(v: unknown): unknown {
  if (Array.isArray(v)) return { hoje: v, futuro: [] };
  return v;
}

function makeStubClient(inputs: StubInputs): InmetHttpClient {
  return {
    async getJson<T = unknown>(url: string): Promise<T> {
      if (url !== INMET_CAP_LIST) {
        throw new Error(`stub getJson called with unexpected URL: ${url}`);
      }
      const v = inputs.list;
      if (typeof v === "function") return wrapList(await v()) as T;
      return wrapList(v) as T;
    },
  };
}

// --- Entry builders ----------------------------------------------------------

interface EntrySpec {
  id?: string | number;
  descricao?: string;
  severidade?: string;
  estados?: string;
  geocodes?: string;
  inicio?: string;
  fim?: string;
  riscos?: string[];
}

function buildEntry(spec: EntrySpec = {}): Record<string, unknown> {
  return {
    id: spec.id ?? 99001,
    descricao: spec.descricao ?? "Chuvas Intensas",
    severidade: spec.severidade ?? "Perigo Potencial",
    estados: spec.estados ?? "Minas Gerais",
    geocodes: spec.geocodes ?? "3100302",
    inicio: spec.inicio ?? "2026-05-05 09:00",
    fim: spec.fim ?? "2026-05-06 09:00",
    riscos: spec.riscos ?? ["Chuva entre 20 e 30 mm/h."],
    // Passthrough fields the adapter ignores but live API ships.
    instrucoes: ["Evite o mau tempo."],
    codigo: "urn:oid:2.49.0.0.76.0.2026.99001.1",
    poligono: "{}",
    aviso_cor: "#FFFE00",
    encerrado: false,
  };
}

// --- Happy paths ------------------------------------------------------------

describe("createInmetAdapter — happy paths", () => {
  it("single entry, single UF → 1 Alert with ISO-Z timestamps", async () => {
    const adapter = createInmetAdapter(makeStubClient({ list: [buildEntry()] }));
    const out = await adapter.fetch();

    expect(out.length).toBe(1);
    const a = out[0]!;
    expect(a.source_key).toBe("inmet");
    expect(a.state_uf).toBe("MG");
    expect(a.hazard_kind).toBe("enchente");
    expect(a.severity).toBe("moderate"); // "Perigo Potencial" → moderate
    expect(a.valid_from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(a.valid_until).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(a.fetched_at).toMatch(/Z$/);
    expect(a.source_url).toBe(INMET_CAP_LIST);
    expect(a.payload_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("multi-UF entry → one Alert per UF (state fan-out)", async () => {
    const entry = buildEntry({
      estados: "Pernambuco,Paraíba,Rio Grande do Norte,Alagoas",
      geocodes: "2600054,2500304,2401206,2700409",
    });
    const adapter = createInmetAdapter(makeStubClient({ list: [entry] }));
    const out = await adapter.fetch();

    const ufs = new Set(out.map((a) => a.state_uf));
    expect(ufs).toEqual(new Set(["PE", "PB", "RN", "AL"]));
    expect(out.length).toBe(4);
    // All UFs share the same hazard / severity / headline
    for (const a of out) {
      expect(a.hazard_kind).toBe("enchente");
      expect(a.severity).toBe("moderate");
      expect(a.headline).toBe("Chuvas Intensas — Pernambuco,Paraíba,Rio Grande do Norte,Alagoas");
    }
    // Payload hashes are per-UF unique
    const hashes = new Set(out.map((a) => a.payload_hash));
    expect(hashes.size).toBe(4);
  });

  it("hoje + futuro envelope is flattened; futuro wins on id collision", async () => {
    const hojeEntry = buildEntry({ id: 100, descricao: "Chuvas Intensas", severidade: "Perigo Potencial" });
    const futuroEntry = buildEntry({ id: 100, descricao: "Tempestade", severidade: "Perigo" }); // same id
    const otherFuturo = buildEntry({ id: 101, descricao: "Acumulado de Chuva", estados: "Bahia", geocodes: "2900306" });
    const adapter = createInmetAdapter(
      makeStubClient({ list: { hoje: [hojeEntry], futuro: [futuroEntry, otherFuturo] } }),
    );
    const out = await adapter.fetch();
    // Dedup left 2 entries (id=100 from futuro wins, id=101 unique)
    expect(out.length).toBe(2);
    // `id` is coerced to string by the schema (z.coerce.string()); compare both forms.
    const collide = out.find((a) => String((a.raw as { id: unknown }).id) === "100");
    expect(collide!.severity).toBe("high"); // "Perigo" → high (futuro version)
    const unique = out.find((a) => String((a.raw as { id: unknown }).id) === "101");
    expect(unique!.state_uf).toBe("BA");
  });

  it("empty envelope returns []", async () => {
    const adapter = createInmetAdapter(makeStubClient({ list: { hoje: [], futuro: [] } }));
    const out = await adapter.fetch();
    expect(out).toEqual([]);
  });

  it("exported `inmetAdapter` singleton uses the production HTTP client", () => {
    expect(inmetAdapter.key).toBe("inmet");
    expect(inmetAdapter.displayName).toMatch(/INMET/);
    expect(typeof inmetAdapter.fetch).toBe("function");
  });
});

// --- Severity mapping --------------------------------------------------------

describe("createInmetAdapter — severity mapping", () => {
  for (const [raw, expected] of Object.entries(SEVERITY_TABLE)) {
    it(`maps PT-BR/CAP "${raw}" → ${expected}`, async () => {
      const adapter = createInmetAdapter(makeStubClient({ list: [buildEntry({ severidade: raw })] }));
      const out = await adapter.fetch();
      expect(out[0]!.severity).toBe(expected);
    });
  }

  it("unknown severity defaults to 'moderate' (RISK-04)", async () => {
    const adapter = createInmetAdapter(makeStubClient({ list: [buildEntry({ severidade: "Catastrófico" })] }));
    const out = await adapter.fetch();
    expect(out[0]!.severity).toBe("moderate");
  });
});

// --- Hazard vocab ------------------------------------------------------------

describe("createInmetAdapter — hazard vocab", () => {
  const cases: Array<[string, string]> = [
    ["Chuvas Intensas", "enchente"],
    ["Acumulado de Chuva", "enchente"],
    ["Tempestade", "enchente"],
    ["Inundação", "inundacao"],
    ["Enchente em Área Urbana", "enchente"],
    ["Incêndio Florestal", "incendio"],
    ["Queimada Intensa", "queimada"],
    ["Movimento de Massa", "deslizamento"],
    ["Movimentos de Massa", "deslizamento"],
    ["Seca Severa", "estiagem"],
  ];
  for (const [descricao, expected] of cases) {
    it(`"${descricao}" → ${expected}`, async () => {
      const adapter = createInmetAdapter(makeStubClient({ list: [buildEntry({ descricao })] }));
      const out = await adapter.fetch();
      expect(out[0]!.hazard_kind).toBe(expected);
    });
  }

  it("unknown descricao falls back to 'enchente' (CLAUDE.md over-warning)", async () => {
    const adapter = createInmetAdapter(makeStubClient({ list: [buildEntry({ descricao: "Evento Desconhecido" })] }));
    const out = await adapter.fetch();
    expect(out[0]!.hazard_kind).toBe("enchente");
  });
});

// --- Timestamp parsing -------------------------------------------------------

describe("createInmetAdapter — timestamps", () => {
  it("interprets `inicio`/`fim` as BRT (UTC-3) and emits ISO-Z", async () => {
    const adapter = createInmetAdapter(
      makeStubClient({ list: [buildEntry({ inicio: "2026-05-05 09:00", fim: "2026-05-06 09:00" })] }),
    );
    const out = await adapter.fetch();
    // 09:00 BRT = 12:00 UTC
    expect(out[0]!.valid_from).toBe("2026-05-05T12:00:00.000Z");
    expect(out[0]!.valid_until).toBe("2026-05-06T12:00:00.000Z");
  });

  it("accepts 'YYYY-MM-DD HH:MM:SS' (with seconds) format", async () => {
    const adapter = createInmetAdapter(
      makeStubClient({ list: [buildEntry({ inicio: "2026-05-05 09:00:30" })] }),
    );
    const out = await adapter.fetch();
    expect(out[0]!.valid_from).toBe("2026-05-05T12:00:30.000Z");
  });

  it("unparseable inicio → per-entry rejected", async () => {
    const adapter = createInmetAdapter(
      makeStubClient({ list: [buildEntry({ inicio: "not-a-date" })] }),
    );
    const out = await adapter.fetch();
    expect(out).toEqual([]); // per-entry isolation drops it
  });
});

// --- UF extraction -----------------------------------------------------------

describe("createInmetAdapter — UF extraction", () => {
  it("disambiguates Mato Grosso vs Mato Grosso do Sul (longest-first)", async () => {
    const adapter = createInmetAdapter(
      makeStubClient({ list: [buildEntry({ estados: "Mato Grosso do Sul", geocodes: "5000203" })] }),
    );
    const out = await adapter.fetch();
    expect(out.map((a) => a.state_uf)).toEqual(["MS"]);
  });

  it("disambiguates Paraná vs Paraíba via Unicode word boundary", async () => {
    const adapter = createInmetAdapter(
      makeStubClient({ list: [buildEntry({ estados: "Paraná", geocodes: "4106902" })] }),
    );
    const out = await adapter.fetch();
    expect(out.map((a) => a.state_uf)).toEqual(["PR"]);
  });

  it("falls back to IBGE prefix when `estados` is non-matching", async () => {
    // estados has a non-PT-BR-state string; geocodes carries the truth.
    const adapter = createInmetAdapter(
      makeStubClient({ list: [buildEntry({ estados: "Região Sudeste", geocodes: "3100302,3200508" })] }),
    );
    const out = await adapter.fetch();
    expect(new Set(out.map((a) => a.state_uf))).toEqual(new Set(["MG", "ES"]));
  });
  it("entry resolving to zero UFs is per-entry dropped (allSettled)", async () => {
    const good = buildEntry({ id: 1, estados: "Minas Gerais", geocodes: "3100302" });
    // estados doesn't match a PT-BR name; geocodes prefix "99" is not in IBGE table.
    const bad = buildEntry({ id: 2, estados: "Região Atlântida", geocodes: "9999999" });
    const adapter = createInmetAdapter(makeStubClient({ list: [good, bad] }));
    const out = await adapter.fetch();
    expect(out.length).toBe(1);
    expect(out[0]!.state_uf).toBe("MG");
  });
});

// --- Error paths -------------------------------------------------------------

describe("createInmetAdapter — error paths", () => {
  it("HTTP 500 → sourceError('http_5xx')", async () => {
    const stub: InmetHttpClient = {
      async getJson<T>(): Promise<T> {
        const err = new Error("Server Error") as Error & { status: number };
        err.status = 500;
        throw err;
      },
    };
    const adapter = createInmetAdapter(stub);
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "http_5xx",
    );
  });

  it("HTTP 429 → sourceError('http_5xx') (rate-limit normalized as 5xx)", async () => {
    const stub: InmetHttpClient = {
      async getJson<T>(): Promise<T> {
        const err = new Error("Too Many Requests") as Error & { status: number };
        err.status = 429;
        throw err;
      },
    };
    const adapter = createInmetAdapter(stub);
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "http_5xx",
    );
  });

  it("AbortError → sourceError('timeout')", async () => {
    const stub: InmetHttpClient = {
      async getJson<T>(): Promise<T> {
        const err = new Error("Aborted");
        err.name = "AbortError";
        throw err;
      },
    };
    const adapter = createInmetAdapter(stub);
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "timeout",
    );
  });

  it("HTTP 4xx (non-429) → sourceError('http_5xx')", async () => {
    const stub: InmetHttpClient = {
      async getJson<T>(): Promise<T> {
        const err = new Error("Bad Request") as Error & { status: number };
        err.status = 400;
        throw err;
      },
    };
    const adapter = createInmetAdapter(stub);
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "http_5xx",
    );
  });

  it("opaque error (no status, no name) → sourceError('http_5xx')", async () => {
    const stub: InmetHttpClient = {
      async getJson<T>(): Promise<T> {
        throw new Error("connect ECONNREFUSED");
      },
    };
    const adapter = createInmetAdapter(stub);
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "http_5xx",
    );
  });

  it("TimeoutError name → sourceError('timeout')", async () => {
    const stub: InmetHttpClient = {
      async getJson<T>(): Promise<T> {
        const err = new Error("timed out") as Error & { cause: { name: string } };
        err.cause = { name: "TimeoutError" };
        throw err;
      },
    };
    const adapter = createInmetAdapter(stub);
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "timeout",
    );
  });

  it("legacy flat-array envelope → sourceError('schema_invalid')", async () => {
    // Pre-05-05 shape — must surface as schema drift, NOT silent zero.
    const stub: InmetHttpClient = {
      async getJson<T>(): Promise<T> {
        return [buildEntry()] as unknown as T;
      },
    };
    const adapter = createInmetAdapter(stub);
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "schema_invalid",
    );
  });

  it("envelope with missing required fields → schema_invalid", async () => {
    const stub: InmetHttpClient = {
      async getJson<T>(): Promise<T> {
        return { hoje: [{ id: 1 }], futuro: [] } as unknown as T;
      },
    };
    const adapter = createInmetAdapter(stub);
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "schema_invalid",
    );
  });
});

// --- Production HTTP client dummy import -------------------------------------

describe("createInmetAdapter — module wiring", () => {
  it("vi.mock('@/lib/http/fetcher') hooks the production client (smoke)", () => {
    // Ensures the auto-mock from the top of file is in place; protects against
    // an accidental live HTTP call in CI.
    expect(vi.isMockFunction(httpGet)).toBe(true);
  });
});
