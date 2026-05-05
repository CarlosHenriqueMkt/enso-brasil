/**
 * ENSO Brasil — INMET severity mapping (RISK-04, RISK-10).
 *
 * Locked v0.1 table from risk-formula-v0.md. Covers:
 *   - CAP standard severity values (Minor / Moderate / Severe / Extreme)
 *   - PT-BR INMET aliases (Aviso, Perigo, Grande Perigo, etc.)
 *
 * Unknown terms default to "moderate" per RISK-04.
 */

import type { Severity } from "../types";

export const SEVERITY_TABLE: Readonly<Record<string, Severity>> = Object.freeze({
  // CAP English (verbatim case)
  Minor: "low",
  Moderate: "moderate",
  Severe: "high",
  Extreme: "extreme",

  // INMET PT-BR aliases (verbatim from risk-formula-v0.md)
  Aviso: "moderate",
  "Aviso de Perigo": "high",
  Perigo: "high",
  "Perigo Potencial": "moderate",
  "Grande Perigo": "extreme",
});

export function mapSeverity(raw: string): Severity {
  return SEVERITY_TABLE[raw] ?? "moderate";
}
