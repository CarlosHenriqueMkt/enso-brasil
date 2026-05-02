/**
 * ENSO Brasil — Dedup + worst-alert comparator (RISK-05, D-04).
 *
 * Behavior:
 *  - Group alerts by (hazard_kind, state_uf) tuple.
 *  - Within a group, collapse alerts whose validity windows overlap.
 *  - Survivor = `compareWorst` winner (severity desc → fetched_at desc → source_key asc).
 *  - Non-survivors retained on `attribution[]` so explanation can render multi-source.
 *  - Non-overlap or different-hazard alerts produce separate output groups.
 *  - Pure: input array NOT mutated; all sorts on copies.
 */

import type { Alert, Severity } from "./types";

export const SEVERITY_RANK: Readonly<Record<Severity, number>> = Object.freeze({
  extreme: 4,
  high: 3,
  moderate: 2,
  low: 1,
});

/**
 * Compare two Alerts by "worst-first" precedence (D-04).
 * Higher severity → first. Tie → newer fetched_at first. Tie → source_key asc.
 */
export function compareWorst(a: Alert, b: Alert): number {
  const dr = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  if (dr !== 0) return dr;
  const dt = new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime();
  if (dt !== 0) return dt;
  return a.source_key.localeCompare(b.source_key);
}

export interface DedupGroup {
  /** Worst alert in the group (drives RiskLevel + explanation prose). */
  survivor: Alert;
  /** All alerts that contributed to this group, including the survivor. Order: compareWorst. */
  attribution: Alert[];
}

/**
 * Returns one DedupGroup per (hazard_kind, state_uf) cluster of overlapping alerts.
 * Non-overlapping alerts in the same hazard+state cluster split into separate groups.
 */
export function dedupForCalc(alerts: readonly Alert[]): DedupGroup[] {
  // Group by (hazard_kind, state_uf)
  const buckets = new Map<string, Alert[]>();
  for (const a of alerts) {
    const key = `${a.hazard_kind}|${a.state_uf}`;
    const arr = buckets.get(key);
    if (arr) arr.push(a);
    else buckets.set(key, [a]);
  }

  const groups: DedupGroup[] = [];
  for (const bucket of buckets.values()) {
    // Sort by fetched_at asc to make overlap-merge deterministic
    const sorted = [...bucket].sort(
      (a, b) => new Date(a.fetched_at).getTime() - new Date(b.fetched_at).getTime(),
    );

    // Build overlap clusters: for each alert, find an existing cluster whose union-window overlaps.
    type Cluster = { start: number; end: number; alerts: Alert[] };
    const clusters: Cluster[] = [];
    for (const a of sorted) {
      const start = new Date(a.valid_from ?? a.fetched_at).getTime();
      const end = a.valid_until
        ? new Date(a.valid_until).getTime()
        : new Date(a.fetched_at).getTime() + 24 * 3600 * 1000;
      const hit = clusters.find((c) => start <= c.end && end >= c.start);
      if (hit) {
        hit.start = Math.min(hit.start, start);
        hit.end = Math.max(hit.end, end);
        hit.alerts.push(a);
      } else {
        clusters.push({ start, end, alerts: [a] });
      }
    }

    for (const c of clusters) {
      const ranked = [...c.alerts].sort(compareWorst);
      groups.push({ survivor: ranked[0]!, attribution: ranked });
    }
  }

  return groups;
}
