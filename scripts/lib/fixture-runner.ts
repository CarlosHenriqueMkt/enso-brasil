/**
 * Shared fixture-refresh runner for INMET (and future CEMADEN, P5).
 *
 * Provides:
 *   - `structuralDiff`: classifies two JSON-compatible values as
 *     "leaf_only" or "structural_drift" without comparing leaf values.
 *   - `runFixtureRefresh`: fetches payload, finds the most recent prior
 *     fixture, writes the new dated file, and returns a DiffResult.
 *
 * Zero new runtime dependencies beyond Node built-ins.
 */

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiffKind = "no_prior" | "leaf_only" | "structural_drift";

export type DiffResult = {
  kind: DiffKind;
  diff: string;
  newPath: string;
  priorPath: string | null;
};

// ---------------------------------------------------------------------------
// structuralDiff
// ---------------------------------------------------------------------------

/**
 * Compare two JSON-compatible values for structural equivalence.
 *
 * Rules:
 * - Different primitive type (string vs number, etc.) → "structural_drift"
 * - Object with added or removed keys at any depth → "structural_drift"
 * - Array elements with added or removed keys → "structural_drift"
 * - Array length change alone (same element shape) → "leaf_only"
 * - Identical values or different leaf values with same shape → "leaf_only"
 */
export function structuralDiff(prior: unknown, next: unknown): "leaf_only" | "structural_drift" {
  return _diff(prior, next) ? "structural_drift" : "leaf_only";
}

/** Returns true if a structural difference is found. */
function _diff(a: unknown, b: unknown): boolean {
  // Same reference or primitive equality → no structural diff
  if (a === b) return false;

  const typeA = typeof a;
  const typeB = typeof b;

  // Type mismatch at non-null → structural
  if (typeA !== typeB) return true;

  // null is typeof "object" — handle specially
  const aNull = a === null;
  const bNull = b === null;
  if (aNull !== bNull) return true;
  if (aNull && bNull) return false;

  // Arrays
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr !== bArr) return true; // one array, one object → structural
  if (aArr && bArr) {
    // Array length difference alone is NOT structural (data change, not schema change).
    // But if any element shape differs, it is structural.
    const aA = a as unknown[];
    const bA = b as unknown[];
    const minLen = Math.min(aA.length, bA.length);
    for (let i = 0; i < minLen; i++) {
      if (_diff(aA[i], bA[i])) return true;
    }
    return false;
  }

  // Plain objects
  if (typeA === "object") {
    const aO = a as Record<string, unknown>;
    const bO = b as Record<string, unknown>;
    const keysA = Object.keys(aO).sort();
    const keysB = Object.keys(bO).sort();
    if (keysA.length !== keysB.length) return true;
    for (let i = 0; i < keysA.length; i++) {
      if (keysA[i] !== keysB[i]) return true;
    }
    for (const k of keysA) {
      if (_diff(aO[k], bO[k])) return true;
    }
    return false;
  }

  // Primitive values differ but same type → leaf_only (no structural diff)
  return false;
}

// ---------------------------------------------------------------------------
// Line-based unified diff (hand-rolled, no deps)
// ---------------------------------------------------------------------------

function unifiedDiff(
  priorText: string,
  nextText: string,
  priorLabel: string,
  nextLabel: string,
): string {
  const priorLines = priorText.split("\n");
  const nextLines = nextText.split("\n");
  const lines: string[] = [`--- ${priorLabel}`, `+++ ${nextLabel}`];

  // Simple O(n) approach: emit a context-style diff without a full LCS.
  // For fixture comparison purposes, line-by-line context is sufficient.
  const maxLen = Math.max(priorLines.length, nextLines.length);
  for (let i = 0; i < maxLen; i++) {
    const priorLine = priorLines[i] ?? "";
    const nextLine = nextLines[i] ?? "";
    if (priorLine === nextLine) {
      lines.push(` ${priorLine}`);
    } else {
      if (i < priorLines.length) lines.push(`-${priorLine}`);
      if (i < nextLines.length) lines.push(`+${nextLine}`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// runFixtureRefresh
// ---------------------------------------------------------------------------

export async function runFixtureRefresh(opts: {
  /** Source key — used for filename prefix. */
  source: "cemaden" | "inmet";
  /** Extension, e.g. "json", "xml", "list.json". */
  ext: "json" | "xml" | "list.json";
  /** Async thunk that returns the raw payload string to persist. */
  fetchPayload: () => Promise<string>;
  /**
   * Optional: parse the raw string into a value for `structuralDiff`.
   * If omitted, the raw text is compared line-by-line only (no structural
   * classification — result is always "leaf_only" unless prior is absent).
   */
  parseForDiff?: (text: string) => unknown;
}): Promise<DiffResult> {
  const fixturesDir = "tests/fixtures/sources";
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const filename = `${opts.source}-${today}.${opts.ext}`;
  const newPath = join(fixturesDir, filename);

  // Fetch new payload
  const newText = await opts.fetchPayload();

  // Ensure output directory exists
  if (!existsSync(fixturesDir)) {
    await mkdir(fixturesDir, { recursive: true });
  }

  // Find most recent prior fixture (alphabetical = chronological for ISO dates)
  const suffix = `.${opts.ext}`;
  const prefix = `${opts.source}-`;
  let priorPath: string | null = null;
  try {
    const entries = await readdir(fixturesDir);
    const matches = entries
      .filter((e) => e.startsWith(prefix) && e.endsWith(suffix) && e !== filename)
      .sort();
    const last = matches.at(-1);
    if (last !== undefined) {
      priorPath = join(fixturesDir, last);
    }
  } catch {
    // directory may not exist yet — handled above
  }

  // Write new file
  await writeFile(newPath, newText, "utf8");

  // No prior — done
  if (priorPath === null) {
    return { kind: "no_prior", diff: "", newPath, priorPath: null };
  }

  // Diff against prior
  const priorText = await readFile(priorPath, "utf8");
  const diff = unifiedDiff(priorText, newText, dirname(priorPath) + "/" + priorPath, newPath);

  let kind: "leaf_only" | "structural_drift" = "leaf_only";
  if (opts.parseForDiff) {
    try {
      const parsedPrior = opts.parseForDiff(priorText);
      const parsedNext = opts.parseForDiff(newText);
      kind = structuralDiff(parsedPrior, parsedNext);
    } catch {
      // Parse failure on either side = structural change
      kind = "structural_drift";
    }
  }

  return { kind, diff, newPath, priorPath };
}
