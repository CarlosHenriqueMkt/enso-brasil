/**
 * Edge-safe source metadata (key + displayName only).
 *
 * /api/health (edge runtime, plan 02-07) needs displayName lookups but
 * CANNOT import `./registry` because the registry transitively imports
 * `./stub`, which references `node:fs` at module top — fatal in V8 isolates.
 *
 * This module is pure data (string → string). It MUST be kept in lockstep
 * with `./registry`'s `sources` array; the drift detector in
 * `./registry.test.ts` enforces this. When adding a new source: append the
 * adapter to registry.ts AND append its `{ key, displayName }` here.
 */
export const sourceMetadata: ReadonlyArray<{
  readonly key: string;
  readonly displayName: string;
}> = Object.freeze([{ key: "stub", displayName: "Stub (fixture)" }]);

export const sourceDisplayNames: Record<string, string> = Object.freeze(
  Object.fromEntries(sourceMetadata.map((s) => [s.key, s.displayName])),
);
