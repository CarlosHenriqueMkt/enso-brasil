/**
 * Adapter probe — read-only diagnostic for issue #12 (under-warning).
 *
 * Replays an adapter against a captured live fixture (or against the live
 * upstream when --live is passed) and prints per-item normalization
 * outcome. This is the canonical reproducer for the under-warning class of
 * failure: when an adapter returns `[]` because every item is silently
 * dropped inside `Promise.allSettled`, this script surfaces the rejection
 * reason for each entry.
 *
 * Usage:
 *   pnpm exec tsx scripts/probe-adapter.ts cemaden [--live]
 *   pnpm exec tsx scripts/probe-adapter.ts inmet   [--live]
 *
 * Default fixture path:
 *   cemaden → newest `tests/fixtures/sources/cemaden-YYYY-MM-DD.json`
 *   inmet   → newest `tests/fixtures/sources/inmet-YYYY-MM-DD.list.json`
 *
 * Exit code is 0 even on adapter failure — this is a diagnostic, not a gate.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

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
import { httpGet } from "@/lib/http/fetcher";
import { isSourceError } from "@/lib/sources/errors";
import { assertWsAlertas2Response } from "@/lib/sources/cemaden.schema";
import { assertActiveList } from "@/lib/sources/inmet.schema";

const FIXTURES_DIR = "tests/fixtures/sources";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { live: { type: "boolean", default: false } },
});

const source = positionals[0];
if (source !== "cemaden" && source !== "inmet") {
  console.error("Usage: probe-adapter.ts <cemaden|inmet> [--live]");
  process.exit(2);
}

const isLive = Boolean(values.live);

async function newestFixture(prefix: string, suffix: string): Promise<string> {
  const entries = await readdir(FIXTURES_DIR);
  const re = new RegExp(`^${prefix}-\\d{4}-\\d{2}-\\d{2}${suffix.replace(/\./g, "\\.")}$`);
  const files = entries.filter((e) => re.test(e)).sort();
  if (files.length === 0) {
    throw new Error(`No fixture matching /${re.source}/ found in ${FIXTURES_DIR}`);
  }
  return join(FIXTURES_DIR, files.at(-1)!);
}

async function probeCemaden(): Promise<void> {
  let payload: unknown;
  if (isLive) {
    console.log("[probe] CEMADEN live GET", CEMADEN_WS_ALERTAS_URL);
    payload = await httpGet(CEMADEN_WS_ALERTAS_URL);
  } else {
    const path = await newestFixture("cemaden", ".json");
    console.log("[probe] CEMADEN fixture", path);
    payload = JSON.parse(await readFile(path, "utf8"));
  }

  const envelope = assertWsAlertas2Response(payload);
  console.log(`[probe] envelope.alertas.length=${envelope.alertas.length}`);

  const stub: CemadenHttpClient = {
    async getJson<T>(): Promise<T> {
      return payload as T;
    },
  };
  const adapter = createCemadenAdapter(stub);

  const out = await adapter.fetch();
  console.log(`[probe] adapter returned ${out.length} alerts`);

  if (out.length === envelope.alertas.length) {
    console.log("[probe] CARDINALITY OK — every input produced an alert");
    return;
  }

  // Per-item replay — re-run each item through a single-item payload to
  // surface per-item rejection reason precisely.
  console.log("[probe] CARDINALITY MISMATCH — per-item replay:");
  for (const item of envelope.alertas) {
    const singletonPayload = { alertas: [item], atualizado: envelope.atualizado };
    const singletonStub: CemadenHttpClient = {
      async getJson<T>(): Promise<T> {
        return singletonPayload as T;
      },
    };
    const singletonAdapter = createCemadenAdapter(singletonStub);
    try {
      const result = await singletonAdapter.fetch();
      const status = result.length === 1 ? "OK" : `EMPTY (returned ${result.length})`;
      console.log(`  id=${String(item.cod_alerta)} evento="${item.evento}" -> ${status}`);
    } catch (err) {
      const msg = isSourceError(err) ? `${err.code}: ${err.message}` : String(err);
      console.log(`  id=${String(item.cod_alerta)} evento="${item.evento}" -> THROW ${msg}`);
    }
  }
}

async function probeInmet(): Promise<void> {
  let listPayload: unknown;
  if (isLive) {
    console.log("[probe] INMET live GET", INMET_CAP_LIST);
    listPayload = await httpGet(INMET_CAP_LIST);
  } else {
    const path = await newestFixture("inmet", ".list.json");
    console.log("[probe] INMET fixture", path);
    listPayload = JSON.parse(await readFile(path, "utf8"));
  }

  const envelope = assertActiveList(listPayload);
  const total = envelope.hoje.length + envelope.futuro.length;
  console.log(`[probe] envelope hoje=${envelope.hoje.length} futuro=${envelope.futuro.length} (total ${total})`);

  // Post-#12 adapter: no CAP detail fetch — the list payload IS the data.
  const stub: InmetHttpClient = {
    async getJson<T>(): Promise<T> {
      return listPayload as T;
    },
  };
  const adapter = createInmetAdapter(stub);

  let out;
  try {
    out = await adapter.fetch();
  } catch (err) {
    const msg = isSourceError(err) ? `${err.code}: ${err.message}` : String(err);
    console.log(`[probe] adapter THREW: ${msg}`);
    return;
  }
  console.log(`[probe] adapter returned ${out.length} alerts (from ${total} entries)`);

  if (out.length === 0 && total > 0) {
    console.log("[probe] CARDINALITY MISMATCH — under-warning condition reproduced");
  } else if (out.length > 0) {
    console.log("[probe] adapter produced alerts — first one:");
    const first = out[0]!;
    console.log({
      hazard_kind: first.hazard_kind,
      state_uf: first.state_uf,
      severity: first.severity,
      headline: first.headline,
      valid_from: first.valid_from,
      valid_until: first.valid_until,
    });
  }
}
async function main(): Promise<void> {
  if (source === "cemaden") await probeCemaden();
  else await probeInmet();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
