/**
 * INMET adapter contract test.
 *
 * Replays the production flow against the newest committed live fixture
 * `tests/fixtures/sources/inmet-YYYY-MM-DD.list.json`. Rebuilt 2026-06 for
 * issue #12 (Bug A): the legacy CAP XML detail endpoint is dead; the
 * adapter now consumes the full inline payload from `/avisos/ativos`.
 *
 * Lock-ins:
 *  - Envelope `{hoje, futuro}` membership (regression guard for the
 *    pre-05-05 flat-array shape).
 *  - Snapshot of the adapter's normalized Alert[] (a stable, deterministic
 *    contract — regenerate via `pnpm test -u` when the fixture is refreshed).
 *  - Cardinality invariant (REQ-12): with the live fixture, adapter MUST
 *    emit at least one alert (issue #12 guardrail). The dedicated
 *    `tests/contract/cardinality.test.ts` re-asserts this in isolation.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import {
  createInmetAdapter,
  INMET_CAP_LIST,
  type InmetHttpClient,
} from "@/lib/sources/inmet";
import { isSourceError } from "@/lib/sources/errors";

// ---------------------------------------------------------------------------
// Fixture loading helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = "tests/fixtures/sources";

async function loadLatestListFixture(): Promise<string> {
  const entries = await readdir(FIXTURES_DIR);
  const listFiles = entries
    .filter((e) => /^inmet-\d{4}-\d{2}-\d{2}\.list\.json$/.test(e))
    .sort();

  if (listFiles.length === 0) {
    throw new Error("No INMET list fixtures found. Run `pnpm fixtures:refresh:inmet` first.");
  }
  return await readFile(join(FIXTURES_DIR, listFiles.at(-1)!), "utf8");
}

function buildStubClient(listJson: string): InmetHttpClient {
  return {
    async getJson<T = unknown>(url: string): Promise<T> {
      if (url === INMET_CAP_LIST) {
        return JSON.parse(listJson) as T;
      }
      throw new Error(`stub getJson: unexpected URL: ${url}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Load fixtures once for the suite
// ---------------------------------------------------------------------------

let listJson: string;

beforeAll(async () => {
  listJson = await loadLatestListFixture();
});

// ---------------------------------------------------------------------------
// Happy path — snapshot
// ---------------------------------------------------------------------------

describe("INMET contract: real fixture round-trip", () => {
  it("fixture matches `{hoje, futuro}` envelope contract (Plan 05-05 + issue #12)", () => {
    // Lock the envelope shape at the fixture level so a future refresh that
    // accidentally captures the legacy flat-array shape fails this assertion
    // before adapter code is exercised (T-05-08).
    const parsed = JSON.parse(listJson) as { hoje?: unknown; futuro?: unknown };
    expect(Array.isArray(parsed.hoje)).toBe(true);
    expect(Array.isArray(parsed.futuro)).toBe(true);
  });

  it("every entry carries the inline-payload fields the post-#12 adapter requires", () => {
    const parsed = JSON.parse(listJson) as {
      hoje: Array<Record<string, unknown>>;
      futuro: Array<Record<string, unknown>>;
    };
    const all = [...parsed.hoje, ...parsed.futuro];
    expect(all.length).toBeGreaterThan(0);
    for (const entry of all) {
      // Bug A regression guard: if INMET ever reverts the schema, surface
      // the required-field gap at fixture-load time.
      expect(typeof entry.descricao).toBe("string");
      expect(typeof entry.severidade).toBe("string");
      expect(typeof entry.estados).toBe("string");
      expect(typeof entry.inicio).toBe("string");
      expect(typeof entry.fim).toBe("string");
    }
  });

  it("fetch() resolves to Alert[] matching committed snapshot", async () => {
    const adapter = createInmetAdapter(buildStubClient(listJson));
    const alerts = await adapter.fetch();

    // Normalize `fetched_at` so snapshot is deterministic
    const normalized = alerts.map((a) => ({ ...a, fetched_at: "NORMALIZED" }));
    expect(normalized).toMatchSnapshot();
  });

  it("fetch() with empty envelope returns []", async () => {
    const emptyStub: InmetHttpClient = {
      async getJson<T>(): Promise<T> {
        return { hoje: [], futuro: [] } as unknown as T;
      },
    };
    const adapter = createInmetAdapter(emptyStub);
    const out = await adapter.fetch();
    expect(out).toEqual([]);
  });

  it("cardinality guardrail: non-empty fixture MUST produce ≥1 alert (issue #12)", async () => {
    const adapter = createInmetAdapter(buildStubClient(listJson));
    const out = await adapter.fetch();
    const parsed = JSON.parse(listJson) as {
      hoje: unknown[];
      futuro: unknown[];
    };
    const upstreamCount = parsed.hoje.length + parsed.futuro.length;
    if (upstreamCount > 0) {
      expect(
        out.length,
        `Adapter produced ZERO alerts despite ${upstreamCount} upstream entries (under-warning).`,
      ).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Mutation smokes (W-1: all assertions via isSourceError)
// ---------------------------------------------------------------------------

describe("INMET contract: mutation smokes", () => {
  it("event 'Tornado' (not in HAZARD_PATTERNS) → fallback to 'enchente' (over-warning)", async () => {
    // Replace every descricao with a non-mapped string. Adapter MUST still
    // emit alerts (using the enchente fallback) — issue #12 lesson learned:
    // silent drop is the failure mode we are guarding against.
    const parsed = JSON.parse(listJson) as {
      hoje: Array<Record<string, unknown>>;
      futuro: Array<Record<string, unknown>>;
    };
    for (const e of [...parsed.hoje, ...parsed.futuro]) {
      e.descricao = "Tornado";
    }
    const stub = buildStubClient(JSON.stringify(parsed));
    const adapter = createInmetAdapter(stub);
    const out = await adapter.fetch();
    expect(out.length).toBeGreaterThan(0);
    for (const a of out) expect(a.hazard_kind).toBe("enchente");
  });

  it("unknown severity → 'moderate' default (safe under-warning floor)", async () => {
    const parsed = JSON.parse(listJson) as {
      hoje: Array<Record<string, unknown>>;
      futuro: Array<Record<string, unknown>>;
    };
    for (const e of [...parsed.hoje, ...parsed.futuro]) {
      e.severidade = "Catastrófico";
    }
    const stub = buildStubClient(JSON.stringify(parsed));
    const adapter = createInmetAdapter(stub);
    const out = await adapter.fetch();
    if (out.length > 0) {
      expect(out[0]!.severity).toBe("moderate");
    }
  });

  it("legacy flat-array shape is rejected as schema_invalid (T-05-08 guard)", async () => {
    const flat = JSON.parse(listJson) as {
      hoje: unknown[];
      futuro: unknown[];
    };
    const stub: InmetHttpClient = {
      async getJson<T>(): Promise<T> {
        return [...flat.hoje, ...flat.futuro] as unknown as T;
      },
    };
    const adapter = createInmetAdapter(stub);
    await expect(adapter.fetch()).rejects.toSatisfy(
      (e) => isSourceError(e) && e.code === "schema_invalid",
    );
  });
});
