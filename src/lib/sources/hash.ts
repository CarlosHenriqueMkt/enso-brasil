import { createHash } from "node:crypto";
import type { Alert } from "./schema";

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
 *
 * Node-only — uses `node:crypto`. Do NOT import from edge-runtime modules.
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
