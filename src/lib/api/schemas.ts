/**
 * ENSO Brasil — Public API response contracts (REQ-S2.10).
 *
 * Single source of truth for the shapes /api/states and /api/health serve.
 * UF27 enum centralized here; src/lib/sources/schema.ts will refactor to
 * import UF27 from this module in a future plan.
 *
 * TS types are inferred via z.infer to avoid dual declarations.
 */
import { z } from "zod";

/** 27 Brazilian federation units (26 states + DF), alphabetical. */
export const UF27 = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;
export type UF = (typeof UF27)[number];

/**
 * Risk levels — five values including `unknown` for placeholder/stale state.
 * Maps 1:1 to messages.severity keys (green/yellow/orange/red/gray).
 * Note: 'gray' is the message key for risk='unknown' (PT-BR copy lookup).
 */
export const RISK_LEVELS = ["green", "yellow", "orange", "red", "unknown"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RiskLevelSchema = z.enum(RISK_LEVELS);

/** Per-state snapshot served by /api/states. */
export const StateSnapshotSchema = z.object({
  uf: z.enum(UF27),
  risk: z.enum(RISK_LEVELS),
  riskReason: z.string(),
  alertCount: z.number().int().nonnegative(),
  lastSuccessfulFetch: z.string().datetime().nullable(),
  formulaVersion: z.string(),
});
export type StateSnapshot = z.infer<typeof StateSnapshotSchema>;

/** Per-source health row served by /api/health. */
export const SourceHealthSchema = z.object({
  key: z.string(),
  displayName: z.string(),
  lastSuccessAt: z.string().datetime().nullable(),
  consecutiveFailures: z.number().int().nonnegative(),
  isStale: z.boolean(),
  payloadDriftCount: z.number().int().nonnegative(),
});
export type SourceHealth = z.infer<typeof SourceHealthSchema>;

/** Top-level health report served by /api/health. */
export const HealthReportSchema = z.object({
  generatedAt: z.string().datetime(),
  sources: z.array(SourceHealthSchema),
});
export type HealthReport = z.infer<typeof HealthReportSchema>;

/**
 * Snapshot response: ALWAYS exactly 27 UFs. Missing data → `unknown` placeholder.
 * Length contract enforced at parse time (mitigates T-02-15).
 */
export const StateSnapshotsResponseSchema = z.array(StateSnapshotSchema).length(27);
export type StateSnapshotsResponse = z.infer<typeof StateSnapshotsResponseSchema>;
