/**
 * BrazilMap — SSR-rendered choropleth of the 27 UFs.
 *
 * **Pivot branch (LOCKED per 05-01-spike-results.md):** react-simple-maps was
 * removed (incompatible with React 19 + Next 16 SSR — `<Geographies>` defers
 * geometry processing to client useState/useEffect, emitting empty `<g>` on
 * the server). This component hand-rolls `<svg>` and projects features
 * server-side via d3-geo's `geoPath()` over a `geoConicEqualArea` projection.
 *
 * **DOM invariant (LOCKED for plan 10 verifier):** exactly 27 occurrences of
 *   `<a href="/estado/{uf}"><path …/></a>`
 * (lowercase href). Do not change this contract without also updating
 * plan-10's verifier grep.
 *
 * Albers projection params (locked):
 *   parallels = [-7, -22]
 *   rotate    = [54, 0, 0]
 *   scale     = 600 (tunable, default reasonable per spike)
 *   translate = [width/2, height/2]
 *
 * Server Component — calls `loadBrAtlas()` directly (Node-only). Do NOT add
 * `"use client"` to this file.
 */
import type { ReactElement } from "react";
import { geoConicEqualArea, geoPath } from "d3-geo";
import { loadBrAtlas, type UFFeature } from "@/lib/geo/br-atlas";
import type { RiskLevel, UF27_PROVISIONAL } from "@/lib/sources/schema";
import { StateShape } from "./StateShape";

type UF = (typeof UF27_PROVISIONAL)[number];

export interface BrazilMapProps {
  /** Per-UF risk levels. UFs missing from this list render as `unknown`. */
  states: ReadonlyArray<{ uf: UF; level: RiskLevel }>;
  /** Optional projection overrides — defaults match the locked spec. */
  projection?: {
    parallels?: [number, number];
    rotate?: [number, number, number];
    scale?: number;
  };
  /** SVG viewBox dimensions. Default 600×600 keeps proportions safe. */
  width?: number;
  height?: number;
}

const DEFAULT_PARALLELS: [number, number] = [-7, -22];
const DEFAULT_ROTATE: [number, number, number] = [54, 0, 0];
const DEFAULT_SCALE = 600;

/**
 * Trim per-coordinate precision in an SVG `path d=...` string to one decimal.
 *
 * d3-geo's `geoPath` emits ~3 fractional digits (e.g. `396.488`); on the
 * locked 600×600 viewBox a single decimal is sub-pixel (~0.17 %), well under
 * the issue-8 99.5 % fidelity floor. Truncation (not rounding) is the
 * cheapest reduction; gzip-savings on the 27-UF map: ~24 KB transferred.
 *
 * Operates on the already-emitted string so we don't need a custom path
 * sink — `geoPath().precision()` in d3-geo controls *resampling*, not
 * output precision.
 */
function roundPathPrecision(d: string): string {
  return d.replace(/(\.\d)\d+/g, "$1");
}

function levelFor(states: BrazilMapProps["states"], uf: UF): RiskLevel {
  const hit = states.find((s) => s.uf === uf);
  return hit ? hit.level : "unknown";
}

export async function BrazilMap({
  states,
  projection,
  width = 600,
  height = 600,
}: BrazilMapProps): Promise<ReactElement> {
  const fc = await loadBrAtlas();

  const parallels = projection?.parallels ?? DEFAULT_PARALLELS;
  const rotate = projection?.rotate ?? DEFAULT_ROTATE;
  const scale = projection?.scale ?? DEFAULT_SCALE;

  // Build projection: parallels + rotate define the conic shape; fitSize()
  // computes scale + translate so the FeatureCollection occupies the viewBox
  // without manual tuning. Manual `scale` is retained as a multiplier override
  // when callers pass projection.scale (defaults to 1 = pure fit).
  const proj = geoConicEqualArea().parallels(parallels).rotate(rotate);
  proj.fitSize([width, height], fc as unknown as Parameters<typeof proj.fitSize>[1]);
  if (projection?.scale && projection.scale !== DEFAULT_SCALE) {
    proj.scale(proj.scale() * (projection.scale / DEFAULT_SCALE));
  }
  void scale;

  const path = geoPath(proj);

  return (
    <svg
      aria-label="Mapa do Brasil — risco por estado"
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="auto"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", aspectRatio: `${width} / ${height}` }}
    >
      {fc.features.map((f: UFFeature) => {
        const raw = path(f as unknown as Parameters<typeof path>[0]) ?? "";
        // Path-precision rounding (issue #8): d3-geo emits coordinates with
        // ~3 decimals (e.g. 396.488). On a 600px viewport one decimal is
        // sub-pixel — ~0.17 % of viewport width, well under the 99.5 %
        // fidelity floor — yet trimming the trailing digits cuts the inlined
        // SVG payload by ~24 KB gzipped across 27 features.
        const d = roundPathPrecision(raw);
        const uf = f.properties.uf;
        return (
          <StateShape
            key={uf}
            uf={uf}
            stateName={f.properties.name}
            level={levelFor(states, uf)}
            d={d}
          />
        );
      })}
    </svg>
  );
}
