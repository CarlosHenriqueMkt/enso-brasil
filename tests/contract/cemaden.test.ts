/**
 * CEMADEN adapter contract tests (Plan 05-04, Task 3).
 *
 * Mirrors `tests/contract/inmet.test.ts` structure: loads the most recent
 * dated CEMADEN fixture from disk, feeds it through the DI-stub
 * `CemadenHttpClient`, and asserts the produced Alert[] + schema invariants
 * against the committed fixture contract.
 *
 * Invariants under test:
 *   - severity vocabulary membership: nivel ∈ {"Moderado","Alto","Muito Alto"}
 *   - hazard taxonomy membership: evento mappable via the CEMADEN
 *     `/^Risco Hidrol[óo]gico/i` OR `/^Movimento de Massa/i` regexes
 *   - per-alert `datahoracriacao` parses to ISO-Z (naive treated as UTC)
 *   - root `atualizado` parses as "DD-MM-YYYY HH:MM:SS UTC"
 *   - source isolation: no INMET/FIRMS/NOAA payload bleed through cemaden
 *     adapter (mirrors `tests/contract/cross-source-isolation.test.ts` /
 *     INMET contract pattern at `tests/contract/inmet.test.ts`).
 *
 * W-1: every error assertion goes through `isSourceError()` —
 *      never `instanceof SourceError`.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import {
  createCemadenAdapter,
  CEMADEN_WS_ALERTAS_URL,
  type CemadenHttpClient,
} from "@/lib/sources/cemaden";
import { isSourceError } from "@/lib/sources/errors";
import { WsAlertas2ResponseSchema, assertWsAlertas2Response } from "@/lib/sources/cemaden.schema";

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

const FIXTURES_DIR = "tests/fixtures/sources";

async function loadLatestCemadenFixture(): Promise<{ raw: string; parsed: unknown }> {
  const entries = await readdir(FIXTURES_DIR);
  const files = entries.filter((e) => /^cemaden-\d{4}-\d{2}-\d{2}\.json$/.test(e)).sort();

  if (files.length === 0) {
    throw new Error(
      "No CEMADEN fixture files found. Run `pnpm tsx scripts/refresh-cemaden.ts --dry-run` first.",
    );
  }

  const latest = files.at(-1)!;
  const raw = await readFile(join(FIXTURES_DIR, latest), "utf8");
  return { raw, parsed: JSON.parse(raw) };
}

function buildStubClient(payload: unknown): CemadenHttpClient {
  return {
    async getJson<T = unknown>(url: string): Promise<T> {
      if (url !== CEMADEN_WS_ALERTAS_URL) {
        throw new Error(`stub getJson: unexpected URL: ${url}`);
      }
      return payload as T;
    },
  };
}

// ---------------------------------------------------------------------------
// Suite state
// ---------------------------------------------------------------------------

let raw: string;
let parsed: { alertas: Array<Record<string, unknown>>; atualizado: string };

beforeAll(async () => {
  const f = await loadLatestCemadenFixture();
  raw = f.raw;
  parsed = f.parsed as typeof parsed;
});

// ---------------------------------------------------------------------------
// Schema contract: fixture parses under WsAlertas2ResponseSchema
// ---------------------------------------------------------------------------

describe("CEMADEN contract: schema membership", () => {
  it("fixture parses under WsAlertas2ResponseSchema (root + per-alert)", () => {
    const result = WsAlertas2ResponseSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it("root `atualizado` matches DD-MM-YYYY HH:MM:SS UTC format", () => {
    expect(parsed.atualizado).toMatch(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2} UTC$/);
  });

  it("every per-alert `nivel` is in severity vocab {Moderado, Alto, Muito Alto}", () => {
    const allowed = new Set(["Moderado", "Alto", "Muito Alto"]);
    expect(parsed.alertas.length).toBeGreaterThan(0);
    for (const a of parsed.alertas) {
      expect(allowed.has(a.nivel as string)).toBe(true);
    }
  });

  it("every per-alert `datahoracriacao` matches `YYYY-MM-DD HH:MM:SS[.fff]`", () => {
    const re = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
    for (const a of parsed.alertas) {
      expect(a.datahoracriacao as string).toMatch(re);
    }
  });
});

// ---------------------------------------------------------------------------
// Hazard taxonomy membership
// ---------------------------------------------------------------------------

describe("CEMADEN contract: hazard taxonomy", () => {
  it("every per-alert `evento` maps via CEMADEN hazard regexes", () => {
    const hidro = /^Risco Hidrol[óo]gico/i;
    const massa = /^Movimento de Massa/i;
    for (const a of parsed.alertas) {
      const evento = a.evento as string;
      const ok = hidro.test(evento) || massa.test(evento);
      expect(ok, `evento "${evento}" matches neither CEMADEN hazard regex`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// UTC parsing correctness (per-alert + root)
// ---------------------------------------------------------------------------

describe("CEMADEN contract: UTC parsing", () => {
  it("adapter emits ISO-Z timestamps for every alert (naive timestamps treated as UTC)", async () => {
    const adapter = createCemadenAdapter(buildStubClient(parsed));
    const out = await adapter.fetch();
    expect(out.length).toBe(parsed.alertas.length);
    for (const alert of out) {
      expect(alert.valid_from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);
      expect(alert.valid_until).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);
      expect(alert.fetched_at).toMatch(/Z$/);
    }
  });

  it("naive `datahoracriacao` 'YYYY-MM-DD HH:MM:SS' parses as UTC, not local time", async () => {
    const adapter = createCemadenAdapter(buildStubClient(parsed));
    const out = await adapter.fetch();
    // For the first fixture alert, reconstruct expected ISO-Z from the raw
    // `datahoracriacao` by simply replacing the space with 'T' and appending 'Z'.
    // If the adapter were applying local-timezone offset, this string equality
    // would fail on any non-UTC dev machine.
    const first = parsed.alertas[0]!;
    const expected = (first.datahoracriacao as string).replace(" ", "T") + "Z";
    expect(out[0]!.valid_from).toBe(expected);
  });

  it("root `atualizado` round-trips assertWsAlertas2Response without throwing", () => {
    const ok = assertWsAlertas2Response(parsed);
    expect(ok.atualizado).toBe(parsed.atualizado);
  });
});

// ---------------------------------------------------------------------------
// Source isolation (mirrors cross-source-isolation pattern)
// ---------------------------------------------------------------------------

describe("CEMADEN contract: source isolation", () => {
  it("every produced Alert has source_key === 'cemaden' (no cross-source pollution)", async () => {
    const adapter = createCemadenAdapter(buildStubClient(parsed));
    const out = await adapter.fetch();
    for (const alert of out) {
      expect(alert.source_key).toBe("cemaden");
      expect(alert.source_url).toBe(CEMADEN_WS_ALERTAS_URL);
    }
  });

  it("an INMET-shaped payload fed to cemadenAdapter is rejected as schema_invalid", async () => {
    // INMET CAP list shape — definitely NOT a wsAlertas2 envelope.
    const inmetShaped = { hoje: [], futuro: [] };
    const adapter = createCemadenAdapter(buildStubClient(inmetShaped));
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "schema_invalid",
    );
  });

  it("fixture file lives at tests/fixtures/sources/cemaden-YYYY-MM-DD.json (path convention)", async () => {
    const entries = await readdir(FIXTURES_DIR);
    const cemadenFiles = entries.filter((e) => /^cemaden-\d{4}-\d{2}-\d{2}\.json$/.test(e));
    expect(cemadenFiles.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Raw-text invariants (locked at the fixture level)
// ---------------------------------------------------------------------------

describe("CEMADEN contract: fixture raw-text invariants", () => {
  it("fixture is valid JSON (parses without throwing)", () => {
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("fixture contains both top-level keys `alertas` and `atualizado`", () => {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    expect(obj).toHaveProperty("alertas");
    expect(obj).toHaveProperty("atualizado");
    expect(Array.isArray(obj.alertas)).toBe(true);
  });
});
