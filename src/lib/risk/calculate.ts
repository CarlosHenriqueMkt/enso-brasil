/**
 * ENSO Brasil — Pure risk calculator (RISK-01, RISK-02, RISK-06).
 *
 * Behavior (locked from risk-formula-v0.md):
 *  - Filters alerts to "active" by RISK-06 rule:
 *      active iff valid_until > now, OR (valid_until null && now - fetched_at < 24h)
 *  - Maps active alerts to a RiskLevel (severity-mix algorithm):
 *      no active alerts                                  → "green"
 *      any active.severity ∈ {"high", "extreme"}         → "red"
 *      any active.severity === "moderate"                → "orange"
 *      else (≥1 active, all severities === "low")        → "yellow"
 *  - "unknown" is NEVER emitted by this function. It is produced exclusively
 *    by `applyStaleness` (Plan 10) when all source health rows are stale.
 *
 * Pure / edge-safe: imports ONLY from "./types" (RISK-01 — enforced by depcruise).
 *   No node:*, no Date.now() side-effects (now is injected for determinism).
 */

import type { Alert, RiskLevel } from "./types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isActive(alert: Alert, nowMs: number): boolean {
  if (alert.valid_until) {
    return new Date(alert.valid_until).getTime() > nowMs;
  }
  // 24h fallback (RISK-06)
  return nowMs - new Date(alert.fetched_at).getTime() < ONE_DAY_MS;
}

/**
 * @param alerts  Source alerts. Not mutated.
 * @param now     Optional reference time (default: new Date()). Injectable for tests.
 * @returns       RiskLevel ∈ {"green","yellow","orange","red"}. "unknown" comes from applyStaleness.
 */
export function calculateRiskLevel(alerts: readonly Alert[], now: Date = new Date()): RiskLevel {
  const nowMs = now.getTime();
  const active = alerts.filter((a) => isActive(a, nowMs));
  if (active.length === 0) return "green";

  // Direct severity scan — locked from risk-formula-v0.md lines 93-104.
  // Order is significant: red beats orange beats yellow.
  for (const a of active) {
    if (a.severity === "high" || a.severity === "extreme") return "red";
  }
  for (const a of active) {
    if (a.severity === "moderate") return "orange";
  }
  // active.length > 0 AND no high/extreme/moderate ⇒ all severities are "low".
  // Severity union is {low|moderate|high|extreme}; the three preceding branches
  // exhaust the non-"low" cases, so this is the only remaining outcome.
  return "yellow";
}
