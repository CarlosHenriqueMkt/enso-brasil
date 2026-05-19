/**
 * ENSO Brasil — CEMADEN severity mapping (Plan 05-03, RISK-04, RISK-10).
 *
 * Vocabulary source: .planning/phases/05-cemaden-dashboard-ui/05-cemaden-endpoint-capture.md
 * (three observed `nivel` terms in `/wsAlertas2`: "Moderado", "Alto", "Muito Alto").
 *
 * Locked v0.1 mapping per risk-formula-v0.md:
 *   - Moderado   → moderate
 *   - Alto       → high
 *   - Muito Alto → extreme
 *
 * Unknown source terms default to "moderate" per risk-formula-v0.md v0.1
 * correction (NOT "low"). Conservative fail-open posture for a public-safety
 * surface — CLAUDE.md mandates over-warning over under-warning.
 */

import type { Severity } from "../types";

export const SEVERITY_TABLE: Readonly<Record<string, Severity>> = Object.freeze({
  Moderado: "moderate",
  Alto: "high",
  "Muito Alto": "extreme",
});

export function mapSeverity(raw: string): Severity {
  return SEVERITY_TABLE[raw] ?? "moderate";
}
