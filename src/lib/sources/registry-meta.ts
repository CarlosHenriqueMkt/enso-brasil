/**
 * Edge-safe source metadata (key + displayName + stability).
 *
 * /api/health (edge runtime, plan 02-07) needs displayName lookups but
 * CANNOT import `./registry` because the registry transitively imports
 * `./stub`, which references `node:fs` at module top — fatal in V8 isolates.
 *
 * This module is pure data (string → string). It MUST be kept in lockstep
 * with `./registry`'s `sources` array; the drift detector in
 * `./registry.test.ts` enforces this. When adding a new source: append the
 * adapter to registry.ts AND append its `{ key, displayName, stability }` here.
 *
 * `stability` annotation (T-05-09 mitigation) surfaces "unstable" sources to
 * the UI degraded-source banner — see 05-06 PLAN threat_model.
 */
export const sourceMetadata: ReadonlyArray<{
  readonly key: string;
  readonly displayName: string;
  readonly stability: "stable" | "unstable";
}> = Object.freeze([
  { key: "inmet", displayName: "INMET — Alert-AS", stability: "stable" },
  { key: "cemaden", displayName: "CEMADEN — Alertas vigentes", stability: "unstable" },
]);

export const sourceDisplayNames: Record<string, string> = Object.freeze(
  Object.fromEntries(sourceMetadata.map((s) => [s.key, s.displayName])),
);

export const sourceStability: Record<string, "stable" | "unstable"> = Object.freeze(
  Object.fromEntries(sourceMetadata.map((s) => [s.key, s.stability])),
);
