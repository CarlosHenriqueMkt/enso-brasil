/**
 * INMET fixture refresh script.
 *
 * Rebuilt 2026-06 for issue #12 (Bug A) — the legacy CAP detail endpoint is
 * dead; the adapter now consumes the full inline payload at `/avisos/ativos`.
 * The refresh script accordingly:
 *
 *   - GETs `https://apiprevmet3.inmet.gov.br/avisos/ativos`
 *   - structural-diffs the response against the prior committed list fixture
 *   - writes a fresh `tests/fixtures/sources/inmet-YYYY-MM-DD.list.json`
 *
 * No CAP XML fetch path. The pre-2026-06 stub fixture under
 * `tests/fixtures/sources/_stub/` is retained for offline `--dry-run` mode
 * but is not loaded in live mode.
 *
 * Exit codes: 0 = no prior / leaf-only diff. 1 = structural drift (review
 * required before commit).
 */

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { runFixtureRefresh } from "./lib/fixture-runner.js";

// Inline-duplicated endpoint constant (DO NOT import from src/lib/sources/inmet.ts —
// scripts/ must not depend on src/lib/sources/ per registry-isolation policy).
const INMET_CAP_LIST = "https://apiprevmet3.inmet.gov.br/avisos/ativos";

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

  // Sanity-check cardinality so under-warning regressions surface here too.
  type Entry = { id: string | number };
  type Envelope = { hoje?: Entry[]; futuro?: Entry[] };
  const raw = JSON.parse(await readFile(listResult.newPath, "utf8")) as Envelope | Entry[];
  const entries: Entry[] = Array.isArray(raw)
    ? raw
    : [...(raw.hoje ?? []), ...(raw.futuro ?? [])];
  console.log(`[refresh-inmet] active entries: ${entries.length}`);

  const exitCode = kindSeverity(listResult.kind);
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
