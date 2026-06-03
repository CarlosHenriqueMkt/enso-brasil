/**
 * Cardinality guardrail (issue #12 acceptance criterion).
 *
 * The under-warning class of failure occurs when an adapter returns `[]`
 * because every per-item normalization throws inside `Promise.allSettled`,
 * masking the failure as "calm day". This suite asserts the inverse: given
 * a committed live fixture with N ≥ 1 upstream alerts, the adapter MUST
 * emit ≥ 1 normalized alert.
 *
 * Re-asserts the same invariant exercised inside the per-source contract
 * tests, but in isolation so a regression is visible at a glance.
 *
 * If a future schema drift breaks normalization for every entry, this test
 * fails LOUDLY rather than silently shipping a green-everywhere snapshot.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  createCemadenAdapter,
  CEMADEN_WS_ALERTAS_URL,
  type CemadenHttpClient,
} from "@/lib/sources/cemaden";
import {
  createInmetAdapter,
  INMET_CAP_LIST,
  type InmetHttpClient,
} from "@/lib/sources/inmet";

const FIXTURES_DIR = "tests/fixtures/sources";

async function newest(prefix: string, suffix: string): Promise<string | null> {
  const entries = await readdir(FIXTURES_DIR);
  const re = new RegExp(`^${prefix}-\\d{4}-\\d{2}-\\d{2}${suffix.replace(/\./g, "\\.")}$`);
  const files = entries.filter((e) => re.test(e)).sort();
  if (files.length === 0) return null;
  return join(FIXTURES_DIR, files.at(-1)!);
}

describe("cardinality guardrail (issue #12)", () => {
  it("CEMADEN: live fixture with N ≥ 1 alerts MUST normalize to N ≥ 1 Alert[]", async () => {
    const path = await newest("cemaden", ".json");
    expect(path, "no CEMADEN fixture in tests/fixtures/sources/").not.toBeNull();
    const payload = JSON.parse(await readFile(path!, "utf8")) as {
      alertas: unknown[];
    };
    const upstreamCount = payload.alertas.length;
    if (upstreamCount === 0) {
      // Calm day — nothing to guard.
      return;
    }
    const stub: CemadenHttpClient = {
      async getJson<T>(url: string): Promise<T> {
        if (url !== CEMADEN_WS_ALERTAS_URL) throw new Error(`unexpected URL: ${url}`);
        return payload as unknown as T;
      },
    };
    const adapter = createCemadenAdapter(stub);
    const out = await adapter.fetch();
    expect(
      out.length,
      `CEMADEN adapter produced ZERO alerts despite ${upstreamCount} upstream entries — under-warning regressed.`,
    ).toBeGreaterThan(0);
  });

  it("INMET: live fixture with N ≥ 1 entries MUST normalize to N ≥ 1 Alert[]", async () => {
    const path = await newest("inmet", ".list.json");
    expect(path, "no INMET list fixture in tests/fixtures/sources/").not.toBeNull();
    const payload = JSON.parse(await readFile(path!, "utf8")) as {
      hoje?: unknown[];
      futuro?: unknown[];
    };
    const upstreamCount = (payload.hoje?.length ?? 0) + (payload.futuro?.length ?? 0);
    if (upstreamCount === 0) {
      // Calm day — nothing to guard.
      return;
    }
    const stub: InmetHttpClient = {
      async getJson<T>(url: string): Promise<T> {
        if (url !== INMET_CAP_LIST) throw new Error(`unexpected URL: ${url}`);
        return payload as unknown as T;
      },
    };
    const adapter = createInmetAdapter(stub);
    const out = await adapter.fetch();
    expect(
      out.length,
      `INMET adapter produced ZERO alerts despite ${upstreamCount} upstream entries — under-warning regressed.`,
    ).toBeGreaterThan(0);
  });

  it("CEMADEN: payload where EVERY item is unmappable surfaces as zero — caught here, not in prod", async () => {
    // Defense-in-depth: even if the adapter handles per-item rejection
    // gracefully, a 100%-drop result MUST be visible. This contrast case
    // documents the under-warning failure mode at the test level. We
    // synthesize a payload of all-Tornado eventos (no CEMADEN regex matches).
    const tornadoPayload = {
      alertas: [
        {
          cod_alerta: 1,
          datahoracriacao: "2026-06-02 12:00:00",
          ult_atualizacao: "2026-06-02 12:00:00",
          codibge: 3100302,
          evento: "Terremoto",
          nivel: "Moderado",
          status: 1,
          uf: "MG",
          municipio: "MG_CITY",
          latitude: -19.9,
          longitude: -43.9,
        },
      ],
      atualizado: "02-06-2026 12:00:00 UTC",
    };
    const stub: CemadenHttpClient = {
      async getJson<T>(): Promise<T> {
        return tornadoPayload as unknown as T;
      },
    };
    const adapter = createCemadenAdapter(stub);
    const out = await adapter.fetch();
    // CEMADEN's mapHazard throws for unmappable evento → per-allSettled drop → []
    // The guard above (against the LIVE fixture) catches this in practice.
    // Here we just lock the contract: the failure is visible (`out.length === 0`),
    // not hidden behind a half-populated array.
    expect(out.length).toBe(0);
  });
});
