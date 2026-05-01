import type { SourceAdapter } from "./types";
import { stubAdapter } from "./stub";

/**
 * Registry of all SourceAdapters (REQ-S2.04). Adding a new source is a
 * single append here — orchestrator (`/api/ingest`, plan 02-08) iterates
 * this array via `Promise.allSettled` and NEVER imports concrete adapter
 * modules. The grep gate in CI verifies that constraint:
 *
 *   grep -rE "import.*Stub|import.*Cemaden|import.*Inmet" src/lib src/app \
 *     | grep -v "src/lib/sources/" | wc -l   →   must be 0
 */
export const sources: readonly SourceAdapter[] = [stubAdapter];

/**
 * Edge-safe lookup of source displayNames derived from the registry.
 * Consumed by `/api/health` (edge runtime) in plan 02-07 — that route
 * cannot import `stub.ts` directly because `stub.ts` uses `node:fs`.
 * This map is plain data (string → string), safe in V8 isolates.
 */
export const sourceDisplayNames: Record<string, string> = Object.freeze(
  Object.fromEntries(sources.map((s) => [s.key, s.displayName])),
);
