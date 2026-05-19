/**
 * CEMADEN fixture refresh script (Plan 05-04, Task 3).
 *
 * Mirrors `scripts/refresh-inmet.ts`. Uses the shared `runFixtureRefresh`
 * helper at `scripts/lib/fixture-runner.ts` (source-key union already
 * includes "cemaden").
 *
 * Usage:
 *   pnpm tsx scripts/refresh-cemaden.ts [--dry-run]
 *
 * --dry-run  Replay from the most recent
 *            tests/fixtures/sources/cemaden-YYYY-MM-DD.json (no network).
 *            Schema-parses against WsAlertas2ResponseSchema and exits 0
 *            on success.
 *
 * Default (live):
 *   GET https://painelalertas.cemaden.gov.br/wsAlertas2 with ofetch
 *   (per CLAUDE.md HTTP stack), schema-parse via WsAlertas2ResponseSchema,
 *   write to tests/fixtures/sources/cemaden-{YYYY-MM-DD}.json, then print
 *   a delta vs the previous fixture: record count, new hazard kinds,
 *   new severity terms.
 *
 * Exit codes:
 *   0  fixture written + schema parse OK; delta is informational
 *   1  schema parse failed OR upstream structural_drift
 *
 * Registry-isolation policy: scripts/ MUST NOT statically import from
 * src/lib/sources/. The CEMADEN endpoint URL is inline-duplicated here.
 * The schema is loaded via dynamic import to keep depcruise happy
 * (mirrors the `getParseCapXml` dynamic-import pattern in
 * `scripts/refresh-inmet.ts`).
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { ofetch } from "ofetch";
import { runFixtureRefresh } from "./lib/fixture-runner.js";

// Inline-duplicated endpoint constant (DO NOT import from src/lib/sources/cemaden.ts).
const CEMADEN_WS_ALERTAS_URL = "https://painelalertas.cemaden.gov.br/wsAlertas2";

const FIXTURES_DIR = "tests/fixtures/sources";
const USER_AGENT = "enso-brasil/1.0 fixture-refresh";

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { "dry-run": { type: "boolean", default: false } },
});
const isDryRun = values["dry-run"] as boolean;

// ---------------------------------------------------------------------------
// Dynamic schema import (depcruise-safe; mirrors refresh-inmet.ts pattern)
// ---------------------------------------------------------------------------

type WsAlertas2Item = {
  cod_alerta: number;
  datahoracriacao: string;
  evento: string;
  nivel: "Moderado" | "Alto" | "Muito Alto";
  uf: string;
};

type WsAlertas2Response = {
  alertas: WsAlertas2Item[];
  atualizado: string;
};

async function getSchemaAsserter(): Promise<(raw: unknown) => WsAlertas2Response> {
  const mod = await import("../src/lib/sources/cemaden.schema.js");
  return mod.assertWsAlertas2Response as (raw: unknown) => WsAlertas2Response;
}

// ---------------------------------------------------------------------------
// Payload fetchers
// ---------------------------------------------------------------------------

async function findLatestPriorFixture(): Promise<string | null> {
  try {
    const entries = await readdir(FIXTURES_DIR);
    const matches = entries.filter((e) => /^cemaden-\d{4}-\d{2}-\d{2}\.json$/.test(e)).sort();
    const last = matches.at(-1);
    return last !== undefined ? join(FIXTURES_DIR, last) : null;
  } catch {
    return null;
  }
}

async function fetchPayloadLive(): Promise<string> {
  // ofetch returns parsed JSON by default; force text so we can persist verbatim.
  // ofetch generic narrows responseType per the return type; cast options
  // so we can force-text against a JSON-shaped endpoint without surrendering
  // the string return type.
  const text = await ofetch<string>(CEMADEN_WS_ALERTAS_URL, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    responseType: "text" as "json",
  });
  return text;
}

async function fetchPayloadDryRun(): Promise<string> {
  const prior = await findLatestPriorFixture();
  if (prior === null) {
    throw new Error(
      "[refresh-cemaden] --dry-run requires an existing tests/fixtures/sources/cemaden-*.json; none found.",
    );
  }
  return readFile(prior, "utf8");
}

// ---------------------------------------------------------------------------
// Delta helpers
// ---------------------------------------------------------------------------

type DeltaSummary = {
  priorCount: number;
  nextCount: number;
  newHazardKinds: string[];
  newSeverityTerms: string[];
};

function computeDelta(prior: WsAlertas2Response | null, next: WsAlertas2Response): DeltaSummary {
  const priorEventos = new Set((prior?.alertas ?? []).map((a) => a.evento));
  const priorNiveis = new Set((prior?.alertas ?? []).map((a) => a.nivel));

  const newHazardKinds: string[] = [];
  const newSeverityTerms: string[] = [];

  const seenEventos = new Set<string>();
  const seenNiveis = new Set<string>();
  for (const a of next.alertas) {
    if (!priorEventos.has(a.evento) && !seenEventos.has(a.evento)) {
      newHazardKinds.push(a.evento);
      seenEventos.add(a.evento);
    }
    if (!priorNiveis.has(a.nivel) && !seenNiveis.has(a.nivel)) {
      newSeverityTerms.push(a.nivel);
      seenNiveis.add(a.nivel);
    }
  }

  return {
    priorCount: prior?.alertas.length ?? 0,
    nextCount: next.alertas.length,
    newHazardKinds,
    newSeverityTerms,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`[refresh-cemaden] mode=${isDryRun ? "dry-run" : "live"}`);

  const assertSchema = await getSchemaAsserter();

  // Snapshot the latest prior fixture BEFORE runFixtureRefresh writes today's file.
  // (When --dry-run replays today's file, this would otherwise be the same file.)
  const priorPathSnapshot = await findLatestPriorFixture();

  const result = await runFixtureRefresh({
    source: "cemaden",
    ext: "json",
    fetchPayload: isDryRun ? fetchPayloadDryRun : fetchPayloadLive,
    parseForDiff: JSON.parse,
  });

  console.log(`[refresh-cemaden] kind=${result.kind} → ${result.newPath}`);

  // Schema parse the newly written payload (the verification gate).
  const newText = await readFile(result.newPath, "utf8");
  let nextParsed: WsAlertas2Response;
  try {
    nextParsed = assertSchema(JSON.parse(newText));
  } catch (err) {
    console.error(
      "[refresh-cemaden] SCHEMA PARSE FAILED — upstream may have drifted.",
      err instanceof Error ? err.message : err,
    );
    process.exitCode = 1;
    return;
  }

  // Compute delta against the prior fixture (if any AND distinct from the new file).
  let priorParsed: WsAlertas2Response | null = null;
  if (priorPathSnapshot !== null && priorPathSnapshot !== result.newPath) {
    try {
      priorParsed = assertSchema(JSON.parse(await readFile(priorPathSnapshot, "utf8")));
    } catch {
      // Prior fixture may have been from an older schema — treat as no prior.
      priorParsed = null;
    }
  }

  const delta = computeDelta(priorParsed, nextParsed);
  console.log("[refresh-cemaden] delta:");
  console.log(`  records: ${delta.priorCount} → ${delta.nextCount}`);
  console.log(
    `  new hazard kinds: ${delta.newHazardKinds.length === 0 ? "(none)" : delta.newHazardKinds.join(", ")}`,
  );
  console.log(
    `  new severity terms: ${delta.newSeverityTerms.length === 0 ? "(none)" : delta.newSeverityTerms.join(", ")}`,
  );

  if (result.kind === "structural_drift") {
    console.error(
      "[refresh-cemaden] STRUCTURAL DRIFT — review diff against prior fixture before committing.",
    );
    if (result.diff) console.log(result.diff);
    process.exitCode = 1;
    return;
  }

  process.exitCode = 0;
}

main().catch((err) => {
  console.error("[refresh-cemaden] fatal:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
