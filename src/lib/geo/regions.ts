/**
 * UF ↔ Brazilian macro-region mapping (canonical IBGE — 5 regions, 27 UFs).
 *
 * Used by:
 *   - `?region=<slug>` query param parser on the home dashboard
 *   - region filter chips in `<FilterRow />`
 *   - SSR `<title>` strings on regional landing pages
 *
 * Slugs are PT-BR kebab-case (`centro-oeste`, never `centroOeste`).
 */
import { UF27_PROVISIONAL } from "@/lib/sources/schema";

export type UF = (typeof UF27_PROVISIONAL)[number];

export type Region = "N" | "NE" | "CO" | "SE" | "S";

/** Region → PT-BR URL slug. Locked decision (P5 UI-SPEC, RFC 3986 segment-safe). */
export const REGION_SLUGS: Record<Region, string> = Object.freeze({
  N: "norte",
  NE: "nordeste",
  CO: "centro-oeste",
  SE: "sudeste",
  S: "sul",
}) as Record<Region, string>;

/** Inverse of REGION_SLUGS. `undefined` on unknown slug (query-param defence). */
export const REGION_FROM_SLUG: Readonly<Record<string, Region | undefined>> = Object.freeze({
  norte: "N",
  nordeste: "NE",
  "centro-oeste": "CO",
  sudeste: "SE",
  sul: "S",
}) as Record<string, Region | undefined>;

/**
 * Canonical UF → Region mapping (IBGE 5 macro-regions).
 *   N (7):  AC AM AP PA RO RR TO
 *   NE (9): AL BA CE MA PB PE PI RN SE
 *   CO (4): DF GO MT MS
 *   SE (4): ES MG RJ SP
 *   S (3):  PR RS SC
 */
export const UF_TO_REGION: Readonly<Record<UF, Region>> = Object.freeze({
  // Norte
  AC: "N",
  AM: "N",
  AP: "N",
  PA: "N",
  RO: "N",
  RR: "N",
  TO: "N",
  // Nordeste
  AL: "NE",
  BA: "NE",
  CE: "NE",
  MA: "NE",
  PB: "NE",
  PE: "NE",
  PI: "NE",
  RN: "NE",
  SE: "NE",
  // Centro-Oeste
  DF: "CO",
  GO: "CO",
  MT: "CO",
  MS: "CO",
  // Sudeste
  ES: "SE",
  MG: "SE",
  RJ: "SE",
  SP: "SE",
  // Sul
  PR: "S",
  RS: "S",
  SC: "S",
}) as Record<UF, Region>;

/** All UFs belonging to a region (order matches UF_TO_REGION insertion order). */
export function ufsInRegion(region: Region): UF[] {
  const out: UF[] = [];
  for (const uf of UF27_PROVISIONAL) {
    if (UF_TO_REGION[uf] === region) out.push(uf);
  }
  return out;
}
