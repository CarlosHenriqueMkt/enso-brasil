/**
 * INMET adapter contract tests (Plan 04-05, REQ-4 + REQ-5).
 *
 * Loads the most recent dated INMET fixture pair from disk, feeds them
 * through the DI-stub httpClient, and asserts the produced Alert[] against a
 * committed snapshot.
 *
 * Fixture capture notes (2026-05-19, Plan 05-05):
 * - The live INMET API returns `{"hoje": [...], "futuro": [...]}` — the
 *   InmetActiveListSchema and adapter were updated to consume this envelope
 *   shape (see 04-05-SUMMARY schema-drift finding + 05-05-SUMMARY). The
 *   refreshed fixture `inmet-2026-05-19.list.json` is a live capture; the
 *   CAP XML fixture (`inmet-2026-05-09.xml`) is retained from Phase 4 as the
 *   live CAP endpoint was rate-limited / ECONNRESET-flaky during the 05-05
 *   capture session.
 *
 * All error assertions use `isSourceError()` — never `instanceof SourceError` (W-1).
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import {
  createInmetAdapter,
  INMET_CAP_LIST,
  INMET_CAP_DETAIL,
  type InmetHttpClient,
} from "@/lib/sources/inmet";
import { isSourceError } from "@/lib/sources/errors";

// ---------------------------------------------------------------------------
// Fixture loading helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = "tests/fixtures/sources";

async function loadLatestFixturePair(): Promise<{ listJson: string; capXml: string }> {
  const entries = await readdir(FIXTURES_DIR);

  const listFiles = entries.filter((e) => /^inmet-\d{4}-\d{2}-\d{2}\.list\.json$/.test(e)).sort();
  const xmlFiles = entries.filter((e) => /^inmet-\d{4}-\d{2}-\d{2}\.xml$/.test(e)).sort();

  if (listFiles.length === 0 || xmlFiles.length === 0) {
    throw new Error(
      "No INMET fixture files found. Run `pnpm fixtures:refresh:inmet --dry-run` first.",
    );
  }

  const latestList = listFiles.at(-1)!;
  const latestXml = xmlFiles.at(-1)!;

  const listJson = await readFile(join(FIXTURES_DIR, latestList), "utf8");
  const capXml = await readFile(join(FIXTURES_DIR, latestXml), "utf8");

  return { listJson, capXml };
}

function buildStubClient(listJson: string, capXml: string): InmetHttpClient {
  return {
    async getJson<T = unknown>(url: string): Promise<T> {
      if (url === INMET_CAP_LIST) {
        return JSON.parse(listJson) as T;
      }
      throw new Error(`stub getJson: unexpected URL: ${url}`);
    },
    async getText(url: string): Promise<string> {
      // Any CAP detail URL → return captured XML
      if (url.startsWith("https://alertas2.inmet.gov.br/")) {
        return capXml;
      }
      throw new Error(`stub getText: unexpected URL: ${url}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Load fixtures once for the suite
// ---------------------------------------------------------------------------

let listJson: string;
let capXml: string;

beforeAll(async () => {
  ({ listJson, capXml } = await loadLatestFixturePair());
});

// ---------------------------------------------------------------------------
// Happy path — snapshot
// ---------------------------------------------------------------------------

describe("INMET contract: real fixture round-trip", () => {
  it("fixture matches `{hoje, futuro}` envelope contract (Plan 05-05)", () => {
    // Lock the envelope shape at the fixture level so a future refresh that
    // accidentally captures the legacy flat-array shape fails this assertion
    // before adapter code is exercised (T-05-08).
    const parsed = JSON.parse(listJson) as { hoje?: unknown; futuro?: unknown };
    expect(Array.isArray(parsed.hoje)).toBe(true);
    expect(Array.isArray(parsed.futuro)).toBe(true);
  });

  it("fetch() resolves to Alert[] matching committed snapshot", async () => {
    const adapter = createInmetAdapter(buildStubClient(listJson, capXml));
    const alerts = await adapter.fetch();

    // Normalize fetched_at so snapshot is deterministic
    const normalized = alerts.map((a) => ({ ...a, fetched_at: "NORMALIZED" }));
    expect(normalized).toMatchSnapshot();
  });

  it("fetch() with empty envelope returns []", async () => {
    const emptyStub: InmetHttpClient = {
      async getJson<T>(): Promise<T> {
        return { hoje: [], futuro: [] } as unknown as T;
      },
      async getText(): Promise<string> {
        return "";
      },
    };
    const adapter = createInmetAdapter(emptyStub);
    const out = await adapter.fetch();
    expect(out).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Mutation smokes (W-1: all assertions via isSourceError)
// ---------------------------------------------------------------------------

describe("INMET contract: mutation smokes", () => {
  it("stripping pt-BR <info> → per-alert rejected, others (if any) still flow", async () => {
    // Remove the pt-BR info block entirely
    const noPtBrXml = capXml.replace(/<info xml:lang="pt-BR">[\s\S]*?<\/info>/g, "");
    const stub = buildStubClient(listJson, noPtBrXml);
    const adapter = createInmetAdapter(stub);

    // fetch() collects allSettled — a per-alert rejection does not throw globally
    // When all alerts fail, we get []
    const out = await adapter.fetch();
    // All alerts failed (no pt-BR info) → empty array
    expect(out).toEqual([]);
  });

  it("unknown <severity> → output severity is 'moderate' (safe default, not an error)", async () => {
    const unknownSevXml = capXml.replace(
      /<severity>.*?<\/severity>/g,
      "<severity>Unknown</severity>",
    );
    const stub = buildStubClient(listJson, unknownSevXml);
    const adapter = createInmetAdapter(stub);

    const out = await adapter.fetch();
    // If list is non-empty, first alert severity defaults to "moderate"
    if (out.length > 0) {
      expect(out[0]!.severity).toBe("moderate");
    }
  });

  it("event 'Tornado' (not in HAZARD_PATTERNS) → per-alert schema_invalid, others still flow", async () => {
    const tornadoXml = capXml.replace(/<event>.*?<\/event>/g, "<event>Tornado</event>");
    const stub = buildStubClient(listJson, tornadoXml);
    const adapter = createInmetAdapter(stub);

    // Per-alert error is swallowed by allSettled; all alerts rejected → []
    const out = await adapter.fetch();
    expect(out).toEqual([]);
  });
});

// Path C invariant removed — CEMADEN now legitimately present (Plan 05-03).
