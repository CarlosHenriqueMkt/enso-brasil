/**
 * INMET adapter unit tests (Plan 04-03, Task 3).
 *
 * Hand-crafted CAP XML strings + DI stub client. The contract test in
 * Plan 04-05 (tests/contract/inmet.test.ts) replaces these stubs with a
 * real captured fixture; this file focuses on branch coverage.
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
  INMET_CAP_DETAIL,
  type InmetHttpClient,
} from "./inmet";
import { isSourceError } from "./errors";
import { httpGet, httpGetText } from "@/lib/http/fetcher";
import { SEVERITY_TABLE } from "@/lib/risk/sources/inmet";

// --- Stub client builder ---------------------------------------------------

interface StubInputs {
  list?: unknown | (() => Promise<unknown>);
  capById?: Record<string, string | (() => Promise<string>)>;
}

function makeStubClient(inputs: StubInputs): InmetHttpClient {
  return {
    async getJson<T = unknown>(url: string): Promise<T> {
      if (url !== INMET_CAP_LIST) {
        throw new Error(`stub getJson called with unexpected URL: ${url}`);
      }
      const v = inputs.list;
      if (typeof v === "function") return (await v()) as T;
      return v as T;
    },
    async getText(url: string): Promise<string> {
      const map = inputs.capById ?? {};
      for (const [id, value] of Object.entries(map)) {
        if (url === INMET_CAP_DETAIL(id)) {
          if (typeof value === "function") return await value();
          return value;
        }
      }
      throw new Error(`stub getText called with unexpected URL: ${url}`);
    },
  };
}

// --- CAP XML builders ------------------------------------------------------

interface CapInfoSpec {
  lang?: string;
  severity?: string;
  event?: string;
  effective?: string;
  expires?: string;
  headline?: string;
  description?: string;
  areaDesc?: string;
}

function buildCap(opts: {
  identifier?: string;
  sent?: string;
  status?: string;
  infos: CapInfoSpec[];
}): string {
  const id = opts.identifier ?? "INMET-2026-001";
  const sent = opts.sent ?? "2026-05-05T12:00:00-03:00";
  const status = opts.status ?? "Actual";
  const infoBlocks = opts.infos
    .map((i) => {
      const lang = i.lang ?? "pt-BR";
      const sev = i.severity ?? "Severe";
      const event = i.event ?? "Inundação";
      const eff = i.effective ?? "2026-05-05T12:00:00-03:00";
      const exp = i.expires ?? "2026-05-06T12:00:00-03:00";
      const headline = i.headline ?? "Alerta de inundação";
      const desc = i.description ?? "Descrição.";
      const areaDesc = i.areaDesc ?? "Minas Gerais";
      return `
  <info xml:lang="${lang}">
    <severity>${sev}</severity>
    <event>${event}</event>
    <effective>${eff}</effective>
    <expires>${exp}</expires>
    <headline>${headline}</headline>
    <description>${desc}</description>
    <area>
      <areaDesc>${areaDesc}</areaDesc>
    </area>
  </info>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>${id}</identifier>
  <sent>${sent}</sent>
  <status>${status}</status>${infoBlocks}
</alert>`;
}

// --- Tests ------------------------------------------------------------------

describe("createInmetAdapter — happy paths", () => {
  it("single alert, single UF → 1 Alert, ISO-Z timestamps", async () => {
    const adapter = createInmetAdapter(
      makeStubClient({
        list: [{ id: "A1" }],
        capById: { A1: buildCap({ identifier: "A1", infos: [{}] }) },
      }),
    );
    const out = await adapter.fetch();
    expect(out).toHaveLength(1);
    const a = out[0]!;
    expect(a.source_key).toBe("inmet");
    expect(a.state_uf).toBe("MG");
    expect(a.hazard_kind).toBe("inundacao");
    expect(a.severity).toBe("high");
    expect(a.source_url).toBe(INMET_CAP_DETAIL("A1"));
    expect(a.valid_from).toMatch(/Z$/);
    expect(a.valid_until).toMatch(/Z$/);
    expect(a.fetched_at).toMatch(/Z$/);
    expect(a.payload_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("multi-alert + multi-UF: 2 ids, one CAP covers 'MG, SP' → 3 Alerts", async () => {
    const adapter = createInmetAdapter(
      makeStubClient({
        list: [{ id: "A1" }, { id: "A2" }],
        capById: {
          A1: buildCap({
            identifier: "A1",
            infos: [{ areaDesc: "MG, SP" }],
          }),
          A2: buildCap({
            identifier: "A2",
            infos: [{ areaDesc: "Rio de Janeiro" }],
          }),
        },
      }),
    );
    const out = await adapter.fetch();
    expect(out).toHaveLength(3);
    const ufs = new Set(out.map((a) => a.state_uf));
    expect(ufs).toEqual(new Set(["MG", "SP", "RJ"]));
  });

  it("areaDesc with non-UF 2-letter codes ignores them but keeps real UFs", async () => {
    const xml = buildCap({
      identifier: "M1",
      infos: [{ areaDesc: "XX, ZZ, BA" }],
    });
    const adapter = createInmetAdapter(
      makeStubClient({ list: [{ id: "M1" }], capById: { M1: xml } }),
    );
    const out = await adapter.fetch();
    expect(out).toHaveLength(1);
    expect(out[0]!.state_uf).toBe("BA");
  });

  it("array-of-areas (multiple <area> blocks) resolves all UFs", async () => {
    // fast-xml-parser collapses repeated <area> children to an array.
    const xml = `<?xml version="1.0"?>
<alert>
  <identifier>A1</identifier>
  <sent>2026-05-05T12:00:00Z</sent>
  <info xml:lang="pt-BR">
    <severity>Moderate</severity>
    <event>Enchente</event>
    <headline>H</headline>
    <area><areaDesc>Bahia</areaDesc></area>
    <area><areaDesc>Sergipe</areaDesc></area>
  </info>
</alert>`;
    const adapter = createInmetAdapter(
      makeStubClient({ list: [{ id: "A1" }], capById: { A1: xml } }),
    );
    const out = await adapter.fetch();
    expect(new Set(out.map((a) => a.state_uf))).toEqual(new Set(["BA", "SE"]));
  });

  it("empty list → empty Alert[]", async () => {
    const adapter = createInmetAdapter(makeStubClient({ list: [] }));
    expect(await adapter.fetch()).toEqual([]);
  });
});

describe("createInmetAdapter — language selection", () => {
  it("CAP with en-US + pt-BR → adapter picks pt-BR", async () => {
    const xml = buildCap({
      identifier: "L1",
      infos: [
        { lang: "en-US", event: "Flood", headline: "Flood warning" },
        {
          lang: "pt-BR",
          event: "Enchente",
          headline: "Aviso de enchente",
          areaDesc: "Paraná",
        },
      ],
    });
    const adapter = createInmetAdapter(
      makeStubClient({ list: [{ id: "L1" }], capById: { L1: xml } }),
    );
    const out = await adapter.fetch();
    expect(out).toHaveLength(1);
    expect(out[0]!.headline).toBe("Aviso de enchente");
    expect(out[0]!.hazard_kind).toBe("enchente");
    expect(out[0]!.state_uf).toBe("PR");
  });

  it("missing pt-BR (only en-US) → that alert dropped, sibling survives", async () => {
    const onlyEn = buildCap({
      identifier: "EN1",
      infos: [{ lang: "en-US", headline: "EN only" }],
    });
    const ptBr = buildCap({
      identifier: "PT1",
      infos: [{ areaDesc: "Goiás" }],
    });
    const adapter = createInmetAdapter(
      makeStubClient({
        list: [{ id: "EN1" }, { id: "PT1" }],
        capById: { EN1: onlyEn, PT1: ptBr },
      }),
    );
    const out = await adapter.fetch();
    expect(out).toHaveLength(1);
    expect(out[0]!.state_uf).toBe("GO");
  });
});

describe("createInmetAdapter — severity mapping", () => {
  it("unknown severity defaults to 'moderate' (per RISK-04)", async () => {
    const xml = buildCap({
      identifier: "S1",
      infos: [{ severity: "NotAValue" }],
    });
    const adapter = createInmetAdapter(
      makeStubClient({ list: [{ id: "S1" }], capById: { S1: xml } }),
    );
    const out = await adapter.fetch();
    expect(out[0]!.severity).toBe("moderate");
  });

  it.each(Object.entries(SEVERITY_TABLE))("known severity %s → %s", async (raw, expected) => {
    const xml = buildCap({
      identifier: "S",
      infos: [{ severity: raw }],
    });
    const adapter = createInmetAdapter(
      makeStubClient({ list: [{ id: "S" }], capById: { S: xml } }),
    );
    const out = await adapter.fetch();
    expect(out[0]!.severity).toBe(expected);
  });
});

describe("createInmetAdapter — hazard vocab (CLAUDE.md distinctions)", () => {
  it.each([
    ["Incêndio Florestal", "incendio"],
    ["Queimada", "queimada"],
    ["Inundação", "inundacao"],
    ["Enchente", "enchente"],
  ])("event %s → hazard %s", async (event, hazard) => {
    const xml = buildCap({ identifier: "H", infos: [{ event }] });
    const adapter = createInmetAdapter(
      makeStubClient({ list: [{ id: "H" }], capById: { H: xml } }),
    );
    const out = await adapter.fetch();
    expect(out[0]!.hazard_kind).toBe(hazard);
  });

  it("unknown event drops the alert (schema_invalid via per-alert isolation)", async () => {
    const bad = buildCap({
      identifier: "BAD",
      infos: [{ event: "Tempestade Tropical" }],
    });
    const ok = buildCap({
      identifier: "OK",
      infos: [{ areaDesc: "Bahia" }],
    });
    const adapter = createInmetAdapter(
      makeStubClient({
        list: [{ id: "BAD" }, { id: "OK" }],
        capById: { BAD: bad, OK: ok },
      }),
    );
    const out = await adapter.fetch();
    expect(out).toHaveLength(1);
    expect(out[0]!.state_uf).toBe("BA");
  });
});

describe("createInmetAdapter — timestamps", () => {
  it("BRT effective '2026-05-05T12:00:00-03:00' → ISO-Z '2026-05-05T15:00:00.000Z'", async () => {
    const xml = buildCap({
      identifier: "T1",
      infos: [{ effective: "2026-05-05T12:00:00-03:00" }],
    });
    const adapter = createInmetAdapter(
      makeStubClient({ list: [{ id: "T1" }], capById: { T1: xml } }),
    );
    const out = await adapter.fetch();
    expect(out[0]!.valid_from).toBe("2026-05-05T15:00:00.000Z");
  });

  it("missing effective/expires → undefined (optional fields)", async () => {
    const xml = `<?xml version="1.0"?>
<alert>
  <identifier>T2</identifier>
  <sent>2026-05-05T12:00:00Z</sent>
  <info xml:lang="pt-BR">
    <severity>Moderate</severity>
    <event>Enchente</event>
    <headline>H</headline>
    <area><areaDesc>Ceará</areaDesc></area>
  </info>
</alert>`;
    const adapter = createInmetAdapter(
      makeStubClient({ list: [{ id: "T2" }], capById: { T2: xml } }),
    );
    const out = await adapter.fetch();
    expect(out[0]!.valid_from).toBeUndefined();
    expect(out[0]!.valid_until).toBeUndefined();
  });

  it("unparseable timestamp drops the alert (schema_invalid)", async () => {
    const bad = buildCap({
      identifier: "BAD",
      infos: [{ effective: "not-a-date" }],
    });
    const ok = buildCap({
      identifier: "OK",
      infos: [{ areaDesc: "Bahia" }],
    });
    const adapter = createInmetAdapter(
      makeStubClient({
        list: [{ id: "BAD" }, { id: "OK" }],
        capById: { BAD: bad, OK: ok },
      }),
    );
    const out = await adapter.fetch();
    expect(out).toHaveLength(1);
    expect(out[0]!.state_uf).toBe("BA");
  });

  it("alert with empty <sent> drops via schema_invalid (zod allows empty string)", async () => {
    const empty = `<?xml version="1.0"?>
<alert>
  <identifier>EMPTY</identifier>
  <sent></sent>
  <info xml:lang="pt-BR">
    <severity>Moderate</severity>
    <event>Enchente</event>
    <headline>H</headline>
    <area><areaDesc>Bahia</areaDesc></area>
  </info>
</alert>`;
    const ok = buildCap({
      identifier: "OK",
      infos: [{ areaDesc: "Sergipe" }],
    });
    const adapter = createInmetAdapter(
      makeStubClient({
        list: [{ id: "EMPTY" }, { id: "OK" }],
        capById: { EMPTY: empty, OK: ok },
      }),
    );
    const out = await adapter.fetch();
    expect(out).toHaveLength(1);
    expect(out[0]!.state_uf).toBe("SE");
  });

  it("alert with unparseable <sent> drops via schema_invalid", async () => {
    // Zod requires `sent` non-optional but allows empty string. The
    // requireIsoZ guard inside normalizeCapDoc rejects unparseable values.
    const bad = `<?xml version="1.0"?>
<alert>
  <identifier>BAD</identifier>
  <sent>not-a-date</sent>
  <info xml:lang="pt-BR">
    <severity>Moderate</severity>
    <event>Enchente</event>
    <headline>H</headline>
    <area><areaDesc>Bahia</areaDesc></area>
  </info>
</alert>`;
    const adapter = createInmetAdapter(
      makeStubClient({ list: [{ id: "BAD" }], capById: { BAD: bad } }),
    );
    const out = await adapter.fetch();
    expect(out).toEqual([]);
  });
});

describe("createInmetAdapter — error paths", () => {
  it("malformed CAP XML drops the alert (xml_malformed); sibling survives", async () => {
    const ok = buildCap({
      identifier: "OK",
      infos: [{ areaDesc: "Bahia" }],
    });
    const adapter = createInmetAdapter(
      makeStubClient({
        list: [{ id: "BAD" }, { id: "OK" }],
        capById: {
          BAD: "<alert><info></alert>",
          OK: ok,
        },
      }),
    );
    const out = await adapter.fetch();
    expect(out).toHaveLength(1);
    expect(out[0]!.state_uf).toBe("BA");
  });

  it("CAP schema drift drops the alert (schema_invalid)", async () => {
    const driftXml = `<?xml version="1.0"?>
<alert>
  <identifier>D1</identifier>
  <sent>2026-05-05T12:00:00Z</sent>
  <info xml:lang="pt-BR">
    <event>Enchente</event>
    <area><areaDesc>BA</areaDesc></area>
  </info>
</alert>`;
    const ok = buildCap({
      identifier: "OK",
      infos: [{ areaDesc: "Bahia" }],
    });
    const adapter = createInmetAdapter(
      makeStubClient({
        list: [{ id: "D1" }, { id: "OK" }],
        capById: { D1: driftXml, OK: ok },
      }),
    );
    const out = await adapter.fetch();
    expect(out).toHaveLength(1);
    expect(out[0]!.state_uf).toBe("BA");
  });

  it("alert with no resolvable UF dropped (schema_invalid)", async () => {
    const noUf = buildCap({
      identifier: "NOUF",
      infos: [{ areaDesc: "Some unknown area" }],
    });
    const ok = buildCap({
      identifier: "OK",
      infos: [{ areaDesc: "Bahia" }],
    });
    const adapter = createInmetAdapter(
      makeStubClient({
        list: [{ id: "NOUF" }, { id: "OK" }],
        capById: { NOUF: noUf, OK: ok },
      }),
    );
    const out = await adapter.fetch();
    expect(out).toHaveLength(1);
    expect(out[0]!.state_uf).toBe("BA");
  });

  it("alert with no <area> at all dropped (schema_invalid)", async () => {
    const noArea = `<?xml version="1.0"?>
<alert>
  <identifier>N1</identifier>
  <sent>2026-05-05T12:00:00Z</sent>
  <info xml:lang="pt-BR">
    <severity>Moderate</severity>
    <event>Enchente</event>
    <headline>H</headline>
  </info>
</alert>`;
    const adapter = createInmetAdapter(
      makeStubClient({ list: [{ id: "N1" }], capById: { N1: noArea } }),
    );
    expect(await adapter.fetch()).toEqual([]);
  });

  it("list 429 → sourceError code='http_5xx'", async () => {
    const adapter = createInmetAdapter(
      makeStubClient({
        list: () => {
          const e = new Error("rate-limited") as Error & { status?: number };
          e.status = 429;
          return Promise.reject(e);
        },
      }),
    );
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "http_5xx",
    );
  });

  it("list 500 → sourceError code='http_5xx'", async () => {
    const adapter = createInmetAdapter(
      makeStubClient({
        list: () => {
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

  it("list 400 generic 4xx → sourceError code='http_5xx' (collapsed)", async () => {
    const adapter = createInmetAdapter(
      makeStubClient({
        list: () => {
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

  it("list error with no status field → sourceError code='http_5xx'", async () => {
    const adapter = createInmetAdapter(
      makeStubClient({
        list: () => Promise.reject(new Error("generic network")),
      }),
    );
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "http_5xx",
    );
  });

  it("list error with no message at all → sourceError code='http_5xx' ('unknown' fallback)", async () => {
    const adapter = createInmetAdapter(
      makeStubClient({
        list: () => Promise.reject({}),
      }),
    );
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "http_5xx" && e.message.includes("unknown"),
    );
  });

  it("list AbortError → sourceError code='timeout'", async () => {
    const adapter = createInmetAdapter(
      makeStubClient({
        list: () => {
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

  it("list TimeoutError via cause.name → sourceError code='timeout'", async () => {
    const adapter = createInmetAdapter(
      makeStubClient({
        list: () => {
          const e = new Error("wrapped") as Error & {
            cause?: { name?: string };
          };
          e.cause = { name: "TimeoutError" };
          return Promise.reject(e);
        },
      }),
    );
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "timeout",
    );
  });

  it("list payload that is not an array → sourceError code='schema_invalid'", async () => {
    const adapter = createInmetAdapter(makeStubClient({ list: { not: "an array" } }));
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "schema_invalid",
    );
  });

  it("production inmetAdapter wires httpGet/httpGetText (PROD_HTTP_CLIENT path)", async () => {
    // Exercises the no-arg createInmetAdapter() default-arg path so the
    // PROD_HTTP_CLIENT.getJson / .getText arrow bodies are covered.
    vi.clearAllMocks();
    vi.mocked(httpGet).mockResolvedValueOnce([{ id: "P1" }]);
    vi.mocked(httpGetText).mockResolvedValueOnce(
      buildCap({ identifier: "P1", infos: [{ areaDesc: "Bahia" }] }),
    );
    const out = await inmetAdapter.fetch();
    expect(out).toHaveLength(1);
    expect(out[0]!.state_uf).toBe("BA");
    expect(vi.mocked(httpGet)).toHaveBeenCalledWith(INMET_CAP_LIST);
    expect(vi.mocked(httpGetText)).toHaveBeenCalledWith(INMET_CAP_DETAIL("P1"));
  });

  it("per-alert timeout drops that alert; sibling returns", async () => {
    const ok = buildCap({
      identifier: "OK",
      infos: [{ areaDesc: "Bahia" }],
    });
    const adapter = createInmetAdapter(
      makeStubClient({
        list: [{ id: "SLOW" }, { id: "OK" }],
        capById: {
          SLOW: () => {
            const e = new Error("aborted") as Error & { name: string };
            e.name = "AbortError";
            return Promise.reject(e);
          },
          OK: ok,
        },
      }),
    );
    const out = await adapter.fetch();
    expect(out).toHaveLength(1);
    expect(out[0]!.state_uf).toBe("BA");
  });
});
