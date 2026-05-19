/**
 * INMET fixture refresh script (Plan 04-04).
 *
 * Usage:
 *   tsx scripts/refresh-inmet.ts [--dry-run]
 *
 * --dry-run  Read from tests/fixtures/sources/_stub/ instead of INMET.
 *            Writes dated fixtures as usual; does NOT touch the network.
 *
 * Exit codes:
 *   0  no_prior or leaf_only — fixture written; no structural change
 *   1  structural_drift — upstream schema may have changed; review diff
 */

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { runFixtureRefresh } from "./lib/fixture-runner.js";

// Inline-duplicated endpoint constants (DO NOT import from src/lib/sources/inmet.ts —
// scripts/ must not depend on src/lib/sources/ per registry-isolation policy).
const INMET_CAP_LIST = "https://apiprevmet3.inmet.gov.br/avisos/ativos";
const INMET_CAP_DETAIL = (id: string): string => `https://alertas2.inmet.gov.br/${id}`;

const STUB_DIR = "tests/fixtures/sources/_stub";
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
// CAP XML parser (Wave 0 — allowed import: scripts/ → src/lib/sources/xml.ts
// is a parse utility with no registry-scope concerns)
// ---------------------------------------------------------------------------

// Dynamic import to avoid depcruise flagging a static import from scripts/
// to src/ at module-analysis time. The Wave 0 xml.ts is a pure utility.
async function getParseCapXml(): Promise<(xml: string) => unknown> {
  const mod = await import("../src/lib/sources/xml.js");

  return mod.parseCapXml;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchListJson(): Promise<string> {
  if (isDryRun) {
    return readFile(`${STUB_DIR}/inmet-list-stub.json`, "utf8");
  }
  const res = await fetch(INMET_CAP_LIST, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`INMET list fetch failed: HTTP ${res.status}`);
  }
  return res.text();
}

async function fetchCapXml(id: string): Promise<string> {
  if (isDryRun) {
    return readFile(`${STUB_DIR}/inmet-cap-stub.xml`, "utf8");
  }
  const url = INMET_CAP_DETAIL(id);
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/xml, text/xml, */*" },
  });
  if (!res.ok) {
    throw new Error(`INMET CAP fetch failed for id=${id}: HTTP ${res.status}`);
  }
  return res.text();
}

// ---------------------------------------------------------------------------
// Exit-severity helper
// ---------------------------------------------------------------------------

function kindSeverity(kind: "no_prior" | "leaf_only" | "structural_drift"): number {
  if (kind === "structural_drift") return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`[refresh-inmet] mode=${isDryRun ? "dry-run" : "live"}`);

  const parseCapXml = await getParseCapXml();

  // --- Step 1: list fixture ---
  const listResult = await runFixtureRefresh({
    source: "inmet",
    ext: "list.json",
    fetchPayload: fetchListJson,
    parseForDiff: JSON.parse,
  });

  console.log(`[refresh-inmet] list: kind=${listResult.kind} → ${listResult.newPath}`);
  if (listResult.diff) {
    console.log(listResult.diff);
  }

  // Parse list to find first active id.
  // Plan 05-05: INMET response is `{hoje:[...], futuro:[...]}` envelope, not a
  // flat array. We fall back to the legacy flat-array shape only for the
  // pre-05-05 stub fixture (`tests/fixtures/sources/_stub/inmet-list-stub.json`).
  type Entry = { id: string | number };
  type Envelope = { hoje?: Entry[]; futuro?: Entry[] };
  const raw = JSON.parse(
    await (async () => {
      const { readFile: rf } = await import("node:fs/promises");
      return rf(listResult.newPath, "utf8");
    })(),
  ) as Envelope | Entry[];

  const entries: Entry[] = Array.isArray(raw) ? raw : [...(raw.hoje ?? []), ...(raw.futuro ?? [])];

  if (entries.length === 0) {
    console.warn("[refresh-inmet] WARNING: INMET returned 0 active alerts. Skipping CAP fixture.");
    process.exitCode = 0;
    return;
  }

  const firstId = String(entries[0]?.id ?? "");
  console.log(`[refresh-inmet] fetching CAP for id=${firstId}`);

  // --- Step 2: CAP XML fixture ---
  const capResult = await runFixtureRefresh({
    source: "inmet",
    ext: "xml",
    fetchPayload: () => fetchCapXml(firstId),
    parseForDiff: parseCapXml,
  });

  console.log(`[refresh-inmet] cap: kind=${capResult.kind} → ${capResult.newPath}`);
  if (capResult.diff) {
    console.log(capResult.diff);
  }

  // Exit code = max severity
  const exitCode = Math.max(kindSeverity(listResult.kind), kindSeverity(capResult.kind));
  if (exitCode > 0) {
    console.error(
      `[refresh-inmet] STRUCTURAL DRIFT DETECTED — review diff above before committing fixtures`,
    );
  }
  process.exitCode = exitCode;
}

main().catch((err) => {
  console.error("[refresh-inmet] fatal:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
