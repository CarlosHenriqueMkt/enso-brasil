/**
 * ENSO Brasil — Risk vocab typed re-exports (RISK-09).
 *
 * The ONLY file under `src/lib/risk/` allowed to import `@/lib/messages`.
 * Other risk modules consume PT-BR strings exclusively via this re-export layer.
 * (Enforced by ESLint no-restricted-imports override + dependency-cruiser scan.)
 *
 * D-02 — single SoT for PT-BR copy lives in messages.ts; this file freezes
 * the shape with explicit typed maps for autocompletion and exhaustiveness.
 */

import { messages } from "@/lib/messages";
import type { RiskLevel, Severity } from "./types";

/** RiskLevel → PT-BR label (state-level UI copy). */
export const LEVEL_LABEL: Readonly<Record<RiskLevel, string>> = Object.freeze({
  green: messages.severity.green,
  yellow: messages.severity.yellow,
  orange: messages.severity.orange,
  red: messages.severity.red,
  unknown: messages.severity.gray,
});

/** Severity → PT-BR label (per-alert UI copy). */
export const SEVERITY_LABEL: Readonly<Record<Severity, string>> = Object.freeze({
  low: messages.risk.severity.low,
  moderate: messages.risk.severity.moderate,
  high: messages.risk.severity.high,
  extreme: messages.risk.severity.extreme,
});

/** HazardKind → PT-BR noun phrase (for explanation prose). */
export const HAZARD_LABEL = Object.freeze({ ...messages.risk.hazard });

/** source_key → display name (e.g., "cemaden" → "CEMADEN"). */
export const SOURCE_LABEL = Object.freeze({ ...messages.risk.source });
