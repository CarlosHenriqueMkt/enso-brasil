/**
 * StateShape — leaf RSC for a single UF on the BrazilMap.
 *
 * Wraps a projected `<path>` in `<Link href="/estado/{uf}">` for full SSR
 * navigation. `prefetch={false}` is mandatory — 27 simultaneous prefetches on
 * first paint would blow the perf budget (UI-SPEC Q3, threat T-05-14).
 *
 * Fills use CSS vars `--color-risk-{level}-bg` — never hard-coded hex.
 */
import type { ReactElement } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { RiskLevel } from "@/lib/sources/schema";
import { messages } from "@/lib/messages";
import type { UF } from "@/lib/geo/br-atlas";

export interface StateShapeProps {
  uf: UF;
  /** PT-BR state name (e.g. "Acre"), sourced from TopoJSON properties. */
  stateName: string;
  level: RiskLevel;
  /** Pre-projected SVG path "d" attribute. Computed server-side via d3-geo. */
  d: string;
}

/**
 * Maps the canonical RiskLevel union to the CSS-var palette suffix.
 * `unknown` → `gray` palette (palette tokens predate the `unknown` rename).
 */
function paletteKey(level: RiskLevel): "green" | "yellow" | "orange" | "red" | "gray" {
  return level === "unknown" ? "gray" : level;
}

/**
 * Maps RiskLevel to the `messages.severity` key. The `messages.severity`
 * object exposes both `unknown` and `gray` aliases (both resolve to
 * "Dados indisponíveis").
 */
function severityLabel(level: RiskLevel): string {
  return messages.severity[level];
}

export function StateShape({ uf, stateName, level, d }: StateShapeProps): ReactElement {
  const palette = paletteKey(level);
  const label = `${stateName}: ${severityLabel(level)}`;
  // Cast: `/estado/[uf]` route lands in plan 11; Next 16 typed-routes does
  // not yet know about it at the time this component is authored.
  const href = `/estado/${uf.toLowerCase()}` as Route;
  return (
    <Link href={href} prefetch={false} tabIndex={0} aria-label={label} data-uf={uf}>
      <path
        d={d}
        fill={`var(--color-risk-${palette}-bg)`}
        stroke="var(--color-line-strong)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      >
        <title>{label}</title>
      </path>
    </Link>
  );
}
