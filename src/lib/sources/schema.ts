import { z } from "zod";
import { createHash } from "node:crypto";

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

/**
 * Canonical JSON: keys sorted recursively. Stable across Node versions
 * so that two equivalent alert payloads produce the same SHA-256 hash.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) {
      out[k] = canonicalize((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

/**
 * Compute deterministic SHA-256 over the normalized fields that define alert
 * identity. Excludes `payload_hash` (would be circular) and `raw` (upstream-
 * shaped and may vary trivially without a meaningful change). Excludes
 * `fetched_at` (changes every tick — would defeat dedup).
 */
export function computePayloadHash(
  alert: Omit<Alert, "payload_hash" | "raw"> & { raw?: unknown },
): string {
  const normalized = {
    source_key: alert.source_key,
    hazard_kind: alert.hazard_kind,
    state_uf: alert.state_uf,
    severity: alert.severity,
    headline: alert.headline,
    body: alert.body ?? null,
    source_url: alert.source_url ?? null,
    valid_from: alert.valid_from ?? null,
    valid_until: alert.valid_until ?? null,
  };
  const json = JSON.stringify(canonicalize(normalized));
  return createHash("sha256").update(json).digest("hex");
}
