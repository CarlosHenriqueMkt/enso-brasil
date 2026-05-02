import { z } from "zod";

/**
 * Hazard kinds — CEMADEN/INMET vocabulary verbatim (CLAUDE.md hard rule).
 * Use "queimada" (NOT incêndio), "estiagem" (NOT seca), "enchente" (NOT inundação)
 * as primary terms. Alternates kept enum-valid for future authority payloads.
 */
export const HAZARD_KINDS = [
  "queimada",
  "enchente",
  "estiagem",
  "incendio",
  "inundacao",
  "seca",
] as const;

/**
 * Per-alert severity levels (Severity dimension — RISK-03).
 * D-01: SEVERITIES = per-alert severity (low..extreme); RISK_LEVELS = state-level computed (green..unknown).
 */
export const SEVERITIES = ["low", "moderate", "high", "extreme"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** State-level computed RiskLevel set (RISK-02). Canonical SoT — re-exported by api/schemas.ts. */
export const RISK_LEVELS = ["green", "yellow", "orange", "red", "unknown"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/**
 * Provisional UF27 enum. Plan 02-06 will own the canonical UF27 export
 * in src/lib/api/schemas.ts; this stub will refactor to import from there.
 */
export const UF27_PROVISIONAL = [
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

export const AlertSchema = z.object({
  source_key: z.string().min(1),
  hazard_kind: z.enum(HAZARD_KINDS),
  state_uf: z.enum(UF27_PROVISIONAL),
  severity: z.enum(SEVERITIES),
  headline: z.string().min(1),
  body: z.string().optional(),
  source_url: z.string().url().optional(),
  fetched_at: z.string().datetime(),
  valid_from: z.string().datetime().optional(),
  valid_until: z.string().datetime().optional(),
  payload_hash: z.string().regex(/^[a-f0-9]{64}$/, "payload_hash must be 64-char hex sha256"),
  raw: z.unknown(),
});

export type Alert = z.infer<typeof AlertSchema>;
export const AlertArraySchema = AlertSchema.array();

// computePayloadHash lives in ./hash.ts (Node-only — uses node:crypto).
// schema.ts is edge-safe (zod only). Import the hash function directly
// from "@/lib/sources/hash" in Node contexts (api routes, tests).
// Re-exporting here would force bundlers to pull node:crypto into edge
// modules that only need types from this file.
