/**
 * ENSO Brasil — Snapshot helpers (RISK-07, RISK-08).
 *
 * Behavior:
 *  - FORMULA_VERSION: literal "v0" — written to snapshot_cache.formula_version by P4.
 *  - applyStaleness: turns calculateRiskLevel output into "unknown" when all
 *    integrated sources have gone stale (>1h since last successful fetch),
 *    OR when the sources_health array is empty (defensive — never silently green).
 *
 * Pure / edge-safe. now arg is injectable.
 */

import type { RiskLevel, SourcesHealthRow, StateSnapshotPayload } from "./types";

/** Locked engine formula version (RISK-08). P4 writes this to snapshot_cache.formula_version. */
export const FORMULA_VERSION = "v0" as const;

/** Re-export so consumers get the payload type from one place. */
export type { StateSnapshotPayload };

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Apply source-staleness override (RISK-07).
 *
 *  - Empty sourcesHealth array       → "unknown" (defensive)
 *  - All sources stale > 1h          → "unknown"
 *  - ≥1 source fresh (≤1h)           → input level (pass-through)
 *
 * A source is "stale" iff last_successful_fetch is null OR older than now - 1h.
 */
export function applyStaleness(
  level: RiskLevel,
  sourcesHealth: readonly SourcesHealthRow[],
  now: Date = new Date(),
): RiskLevel {
  if (sourcesHealth.length === 0) return "unknown";

  const cutoff = now.getTime() - ONE_HOUR_MS;
  const anyFresh = sourcesHealth.some((row) => {
    if (!row.last_successful_fetch) return false;
    return new Date(row.last_successful_fetch).getTime() >= cutoff;
  });

  return anyFresh ? level : "unknown";
}
