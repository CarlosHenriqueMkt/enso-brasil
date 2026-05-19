/**
 * Presentation-layer time formatting for ENSO Brasil.
 *
 * Contract:
 *   - Adapters emit ISO-Z (UTC). Presentation converts to the IANA zone for
 *     the user's UF via `@date-fns/tz`.
 *   - Per-UF zones (FOUND-08): AC → America/Rio_Branco (UTC-5);
 *     AM → America/Manaus (UTC-4); all others → America/Sao_Paulo (UTC-3,
 *     no DST since 2019).
 *
 * Edge cases:
 *   - Invalid timestamp → throws `Error("Invalid timestamp: ...")`.
 *   - Future timestamp → relative phrasing returns "Atualizado há 0 minutos"
 *     (deterministic floor; UI never shows "in the future" to users).
 *
 * Pure module — no React, no DOM. Edge-runtime safe.
 */
import { format } from "date-fns";
import { tz } from "@date-fns/tz";
import { messages } from "../messages";
import type { UF } from "../api/schemas";

/** UF → IANA timezone mapping (FOUND-08). */
const UF_ZONE: Partial<Record<UF, string>> = {
  AC: "America/Rio_Branco",
  AM: "America/Manaus",
};
const DEFAULT_ZONE = "America/Sao_Paulo";

function zoneFor(uf?: UF): string {
  return (uf && UF_ZONE[uf]) ?? DEFAULT_ZONE;
}

function parseIsoZOrThrow(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid timestamp: ${iso}`);
  }
  return d;
}

/**
 * Convert a UTC ISO-Z string to a Date anchored in the target UF's IANA zone.
 *
 * NOTE: JS `Date` carries no zone metadata — the returned value is the same
 * absolute instant; callers MUST format with `formatAbsolutePtBr`/`formatRelativePtBr`
 * to get zone-correct output. This function exists so callers can validate
 * input + carry zone context in a single call site.
 */
export function toBrtFromIsoZ(iso: string, uf?: UF): Date {
  // Touch the zone so it's not silently dropped from the public API.
  void zoneFor(uf);
  return parseIsoZOrThrow(iso);
}

/**
 * Format a UTC ISO-Z string as `DD/MM/YYYY HH:mm` in the target UF's IANA zone.
 */
export function formatAbsolutePtBr(iso: string, uf?: UF): string {
  const d = parseIsoZOrThrow(iso);
  return format(d, "dd/MM/yyyy HH:mm", { in: tz(zoneFor(uf)) });
}

/**
 * Format a UTC ISO-Z string as PT-BR relative phrasing:
 *   - delta < 60 min → "Atualizado há {N} minutos"
 *   - delta < 24h    → "Atualizado há {N} horas"
 *   - else           → "Atualizado há mais de 24h"
 *
 * Future timestamps return "Atualizado há 0 minutos" (floor at 0).
 */
export function formatRelativePtBr(iso: string, now: Date = new Date()): string {
  const d = parseIsoZOrThrow(iso);
  const deltaMs = now.getTime() - d.getTime();
  const minutes = Math.floor(Math.max(0, deltaMs) / 60_000);
  if (minutes < 60) return messages.timestamp_template.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return messages.timestamp_template.hours(hours);
  return messages.timestamp_template.over_day;
}
