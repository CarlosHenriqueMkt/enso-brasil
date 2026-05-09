/**
 * Cross-source isolation contract test (Plan 04-05, REQ-7).
 *
 * Proves that `Promise.allSettled` provides per-source isolation:
 * one source rejecting does NOT prevent the other from fulfilling (or
 * rejecting independently).
 *
 * Path C constraint: no real CEMADEN code in `src/`. The `cemadenStub`
 * factory below is declared INSIDE this test file only.
 * TODO(P5): replace inline cemadenStub with real cemadenAdapter once Phase 5 ships.
 */

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { createInmetAdapter, INMET_CAP_LIST, type InmetHttpClient } from "@/lib/sources/inmet";
import { sourceError, isSourceError } from "@/lib/sources/errors";
import type { SourceAdapter } from "@/lib/sources/types";

// ---------------------------------------------------------------------------
// Inline cemadenStub — Path C carry-over.
// No real CEMADEN code exists in src/. This stub exists only to exercise
// Promise.allSettled isolation semantics.
// ---------------------------------------------------------------------------

function cemadenStub(): SourceAdapter {
  return {
    key: "cemaden",
    displayName: "CEMADEN — stub (P4 carry-over to P5)",
    fetch: async () => {
      throw sourceError("schema_invalid", "cemaden stub: P5 carry-over");
    },
  };
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = "tests/fixtures/sources";

async function loadLatestInmetPair(): Promise<{ listJson: string; capXml: string } | null> {
  try {
    const entries = await readdir(FIXTURES_DIR);
    const listFiles = entries.filter((e) => /^inmet-\d{4}-\d{2}-\d{2}\.list\.json$/.test(e)).sort();
    const xmlFiles = entries.filter((e) => /^inmet-\d{4}-\d{2}-\d{2}\.xml$/.test(e)).sort();

    if (listFiles.length === 0 || xmlFiles.length === 0) return null;

    const listJson = await readFile(join(FIXTURES_DIR, listFiles.at(-1)!), "utf8");
    const capXml = await readFile(join(FIXTURES_DIR, xmlFiles.at(-1)!), "utf8");
    return { listJson, capXml };
  } catch {
    return null;
  }
}

function buildInmetStub(listJson: string, capXml: string): InmetHttpClient {
  return {
    async getJson<T>(url: string): Promise<T> {
      if (url === INMET_CAP_LIST) return JSON.parse(listJson) as T;
      throw new Error(`unexpected URL: ${url}`);
    },
    async getText(url: string): Promise<string> {
      if (url.startsWith("https://alertas2.inmet.gov.br/")) return capXml;
      throw new Error(`unexpected URL: ${url}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Cross-source isolation tests
// ---------------------------------------------------------------------------

describe("cross-source isolation via Promise.allSettled", () => {
  it("CEMADEN-stub rejects; INMET fulfills independently", async () => {
    const fixtures = await loadLatestInmetPair();
    if (!fixtures) {
      // Fixtures missing — use minimal inline stubs
      const minimalInmetStub: InmetHttpClient = {
        async getJson<T>(): Promise<T> {
          return [] as unknown as T; // empty list → inmet returns []
        },
        async getText(): Promise<string> {
          return "";
        },
      };
      const inmet = createInmetAdapter(minimalInmetStub);
      const [cemadenResult, inmetResult] = await Promise.allSettled([
        cemadenStub().fetch(),
        inmet.fetch(),
      ]);

      expect(cemadenResult.status).toBe("rejected");
      if (cemadenResult.status === "rejected") {
        expect(isSourceError(cemadenResult.reason)).toBe(true);
        expect((cemadenResult.reason as ReturnType<typeof sourceError>).code).toBe(
          "schema_invalid",
        );
      }

      expect(inmetResult.status).toBe("fulfilled");
      if (inmetResult.status === "fulfilled") {
        expect(Array.isArray(inmetResult.value)).toBe(true);
      }
      return;
    }

    const inmet = createInmetAdapter(buildInmetStub(fixtures.listJson, fixtures.capXml));
    const [cemadenResult, inmetResult] = await Promise.allSettled([
      cemadenStub().fetch(),
      inmet.fetch(),
    ]);

    // CEMADEN stub always rejects with schema_invalid
    expect(cemadenResult.status).toBe("rejected");
    if (cemadenResult.status === "rejected") {
      expect(isSourceError(cemadenResult.reason)).toBe(true);
      expect((cemadenResult.reason as ReturnType<typeof sourceError>).code).toBe("schema_invalid");
    }

    // INMET adapter fetches independently and fulfills
    expect(inmetResult.status).toBe("fulfilled");
    if (inmetResult.status === "fulfilled") {
      expect(Array.isArray(inmetResult.value)).toBe(true);
    }
  });

  it("INMET-stub throws; CEMADEN-stub rejects independently (reverse isolation)", async () => {
    const throwingInmetStub: InmetHttpClient = {
      async getJson<T>(): Promise<T> {
        throw sourceError("http_5xx", "inmet stub: simulated network failure");
      },
      async getText(): Promise<string> {
        return "";
      },
    };

    const inmet = createInmetAdapter(throwingInmetStub);
    const [cemadenResult, inmetResult] = await Promise.allSettled([
      cemadenStub().fetch(),
      inmet.fetch(),
    ]);

    // Both reject independently — isolation works in both directions
    expect(cemadenResult.status).toBe("rejected");
    expect(inmetResult.status).toBe("rejected");

    if (cemadenResult.status === "rejected") {
      expect(isSourceError(cemadenResult.reason)).toBe(true);
    }
    if (inmetResult.status === "rejected") {
      expect(isSourceError(inmetResult.reason)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Path C invariant assertions
// ---------------------------------------------------------------------------

describe("Path C invariant: no CEMADEN code in src/", () => {
  it("src/lib/sources/cemaden.ts does not exist", () => {
    expect(existsSync("src/lib/sources/cemaden.ts")).toBe(false);
  });

  it("src/lib/sources/cemaden.schema.ts does not exist", () => {
    expect(existsSync("src/lib/sources/cemaden.schema.ts")).toBe(false);
  });
});
