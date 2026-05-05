/**
 * ENSO Brasil — CEMADEN severity mapping (RISK-04, RISK-10).
 *
 * Locked v0.1 table from risk-formula-v0.md. Unknown terms default to "moderate"
 * per RISK-04 conservative bias (never silently low).
 */

import type { Severity } from "../types";

export const SEVERITY_TABLE: Readonly<Record<string, Severity>> = Object.freeze({
  Observação: "low",
  Atenção: "moderate",
  Alerta: "high",
  "Alerta Máximo": "extreme",
});

export function mapSeverity(raw: string): Severity {
  return SEVERITY_TABLE[raw] ?? "moderate";
}
