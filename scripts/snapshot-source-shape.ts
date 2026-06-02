/**
 * Source-shape snapshot helper (issue #4 — drift sentinel).
 *
 * Extracts a CANONICAL SHAPE from a JSON payload: the type tree (object
 * keys + value types), with no actual values. Stable across cosmetic
 * changes (counts, ids, timestamps) but breaks on structural drift (new
 * keys, removed keys, type changes for a key).
 *
 * Two modes:
 *   `dump <url>` — fetch live URL, write shape to stdout (drift workflow uses this)
 *   `compare <url> <path/to/shape.json>` — fetch live, compare to committed shape, exit 1 on drift
 *
 * Used by `.github/workflows/drift-sentinel.yml` to gate fixture refresh
 * cadence: a daily cron only fires the actual `pnpm fixtures:refresh:*`
 * scripts if the shape has changed in the last 72h.
 */

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

type Shape =
  | { type: "object"; keys: Record<string, Shape> }
  | { type: "array"; item: Shape | null }
  | { type: "string" | "number" | "boolean" | "null" | "undefined" };

function shapeOf(value: unknown): Shape {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) {
    if (value.length === 0) return { type: "array", item: null };
    // Merge shapes across every item so a single optional key on item[1] is
    // still visible in the canonical shape.
    let merged = shapeOf(value[0]);
    for (let i = 1; i < value.length; i++) {
      merged = mergeShapes(merged, shapeOf(value[i]));
    }
    return { type: "array", item: merged };
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys: Record<string, Shape> = {};
    for (const k of Object.keys(obj).sort()) {
      keys[k] = shapeOf(obj[k]);
    }
    return { type: "object", keys };
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return { type: typeof value as "string" | "number" | "boolean" | "undefined" };
  }
  return { type: "string" }; // fallback
}

function mergeShapes(a: Shape, b: Shape): Shape {
  if (a.type !== b.type) {
    // Type changed across array items — keep `a`'s type as the canonical
    // (first-wins). Drift surfaces in the diff anyway.
    return a;
  }
  if (a.type === "object" && b.type === "object") {
    const keys: Record<string, Shape> = { ...a.keys };
    for (const [k, v] of Object.entries(b.keys)) {
      keys[k] = keys[k] === undefined ? v : mergeShapes(keys[k], v);
    }
    return { type: "object", keys: Object.fromEntries(Object.entries(keys).sort(([x], [y]) => x.localeCompare(y))) };
  }
  if (a.type === "array" && b.type === "array") {
    if (a.item === null) return b;
    if (b.item === null) return a;
    return { type: "array", item: mergeShapes(a.item, b.item) };
  }
  return a;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "enso-brasil/1.0 drift-sentinel",
      Accept: "application/json, */*",
    },
  });
  if (!res.ok) {
    throw new Error(`fetch ${url} → HTTP ${res.status}`);
  }
  return await res.json();
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function main(): Promise<void> {
  const { positionals } = parseArgs({ allowPositionals: true });
  const [mode, urlOrPath, shapePath] = positionals;

  if (mode === "dump" && urlOrPath) {
    const payload = await fetchJson(urlOrPath);
    process.stdout.write(canonicalJson(shapeOf(payload)) + "\n");
    return;
  }
  if (mode === "compare" && urlOrPath && shapePath) {
    const expected = JSON.parse(await readFile(shapePath, "utf8"));
    const payload = await fetchJson(urlOrPath);
    const actual = shapeOf(payload);
    const expectedStr = canonicalJson(expected);
    const actualStr = canonicalJson(actual);
    if (expectedStr === actualStr) {
      console.log(`[drift] ${urlOrPath}: SHAPE OK (matches ${shapePath})`);
      process.exitCode = 0;
      return;
    }
    console.error(`[drift] ${urlOrPath}: SHAPE DRIFT`);
    console.error(`--- expected (${shapePath})`);
    console.error(expectedStr);
    console.error(`+++ actual`);
    console.error(actualStr);
    process.exitCode = 1;
    return;
  }

  console.error("Usage:");
  console.error("  snapshot-source-shape.ts dump <url>");
  console.error("  snapshot-source-shape.ts compare <url> <path/to/shape.json>");
  process.exitCode = 2;
}

main().catch((err) => {
  console.error("[drift] fatal:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
