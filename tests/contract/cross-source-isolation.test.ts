/**
 * Cross-source isolation contract test (Plan 04-05, REQ-7; updated 05-06).
 *
 * Proves that `Promise.allSettled` provides per-source isolation:
 * one source rejecting does NOT prevent the other from fulfilling (or
 * rejecting independently).
 *
 * Updated in 05-06: real `cemadenAdapter` replaces the prior Path C inline
 * stub. CEMADEN failure is now simulated by injecting a mock HTTP client
 * whose `getJson` rejects with `sourceError("http_5xx", ...)`.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { createInmetAdapter, INMET_CAP_LIST, type InmetHttpClient } from "@/lib/sources/inmet";
import { createCemadenAdapter, type CemadenHttpClient } from "@/lib/sources/cemaden";
import { sourceError, isSourceError } from "@/lib/sources/errors";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = "tests/fixtures/sources";

async function loadLatestInmetList(): Promise<string | null> {
  try {
    const entries = await readdir(FIXTURES_DIR);
    const listFiles = entries
      .filter((e) => /^inmet-\d{4}-\d{2}-\d{2}\.list\.json$/.test(e))
      .sort();
    if (listFiles.length === 0) return null;
    return await readFile(join(FIXTURES_DIR, listFiles.at(-1)!), "utf8");
  } catch {
    return null;
  }
}

function buildInmetStub(listJson: string): InmetHttpClient {
  return {
    async getJson<T>(url: string): Promise<T> {
      if (url === INMET_CAP_LIST) return JSON.parse(listJson) as T;
      throw new Error(`unexpected URL: ${url}`);
    },
  };
}

// Mock CEMADEN HTTP client that always rejects with http_5xx — simulates
// upstream outage; exercises Promise.allSettled isolation.
const failingCemadenHttp: CemadenHttpClient = {
  async getJson<T>(): Promise<T> {
    throw sourceError("http_5xx", "cemaden mock: simulated 503");
  },
};

// ---------------------------------------------------------------------------
// Cross-source isolation tests
// ---------------------------------------------------------------------------

describe("cross-source isolation via Promise.allSettled", () => {
  it("CEMADEN rejects; INMET fulfills independently", async () => {
    const cemaden = createCemadenAdapter(failingCemadenHttp);

    const listJson = await loadLatestInmetList();
    if (!listJson) {
      // Fixtures missing — use minimal inline stub
      const minimalInmetStub: InmetHttpClient = {
        async getJson<T>(): Promise<T> {
          return { hoje: [], futuro: [] } as unknown as T;
        },
      };
      const inmet = createInmetAdapter(minimalInmetStub);
      const [cemadenResult, inmetResult] = await Promise.allSettled([
        cemaden.fetch(),
        inmet.fetch(),
      ]);

      expect(cemadenResult.status).toBe("rejected");
      if (cemadenResult.status === "rejected") {
        expect(isSourceError(cemadenResult.reason)).toBe(true);
        expect((cemadenResult.reason as ReturnType<typeof sourceError>).code).toBe("http_5xx");
      }

      expect(inmetResult.status).toBe("fulfilled");
      if (inmetResult.status === "fulfilled") {
        expect(Array.isArray(inmetResult.value)).toBe(true);
      }
      return;
    }

    const inmet = createInmetAdapter(buildInmetStub(listJson));
    const [cemadenResult, inmetResult] = await Promise.allSettled([cemaden.fetch(), inmet.fetch()]);

    // CEMADEN adapter wraps mockHttp rejection as sourceError(http_5xx)
    expect(cemadenResult.status).toBe("rejected");
    if (cemadenResult.status === "rejected") {
      expect(isSourceError(cemadenResult.reason)).toBe(true);
      expect((cemadenResult.reason as ReturnType<typeof sourceError>).code).toBe("http_5xx");
    }

    // INMET adapter fetches independently and fulfills
    expect(inmetResult.status).toBe("fulfilled");
    if (inmetResult.status === "fulfilled") {
      expect(Array.isArray(inmetResult.value)).toBe(true);
    }
  });

  it("INMET-stub throws; CEMADEN rejects independently (reverse isolation)", async () => {
    const throwingInmetStub: InmetHttpClient = {
      async getJson<T>(): Promise<T> {
        throw sourceError("http_5xx", "inmet stub: simulated network failure");
      },
    };

    const inmet = createInmetAdapter(throwingInmetStub);
    const cemaden = createCemadenAdapter(failingCemadenHttp);
    const [cemadenResult, inmetResult] = await Promise.allSettled([cemaden.fetch(), inmet.fetch()]);

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
