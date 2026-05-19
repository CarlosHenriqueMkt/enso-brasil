# Phase 5 — Spike Results

**Date:** 2026-05-18
**Branch:** phase-5-cemaden-dashboard

## RSM SSR

Verdict: PIVOT
Reason: react-simple-maps@3.0.0 incompatible with React 19 + Next 16 SSR.

- Server-Component import throws `createContext is not a function` (RSM calls `React.createContext` at module top level — the Node SSR context shape does not match).
- Wrapping page as `"use client"` lets Next.js SSR initial HTML, but `<Geographies>` defers geography processing to client-side useState/useEffect regardless of whether the `geography` prop is a synchronous FeatureCollection. SSR HTML output: `<g class="rsm-geographies "></g>` empty — **0 `<path>` elements**.

Fallback path (LOCKED): plan 08 pivot branch — hand-rolled `<svg>` + `d3-geo` `geoPath()` server-side over `loadBrAtlas()` FeatureCollection. DOM invariant unchanged: 27 × `<a href="/estado/{uf}"><path/></a>`.

Package action: `react-simple-maps` + `@types/react-simple-maps` REMOVED (commit `a4417d4`). `topojson-client` + `d3-geo` RETAINED for the pivot path.

## br-atlas

Original locked-decision (`carolinabigonha/br-atlas`) abandoned — repo publishes only Python+GDAL build scripts + Makefile, **no fetchable JSON artifact** (no `dist/`, no `gh-pages`, no jsDelivr, no GitHub Releases).

Replacement (LOCKED, amends CLAUDE.md line 42):

- **Source:** IBGE Malhas Territoriais `BR_UF_2022.shp` (official Brazilian authority — same source used by CEMADEN/INMET via `codibge`).
- **Vintage:** 2022 (URL: `https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2022/Brasil/BR/BR_UF_2022.zip`). 2023 and 2024 returned 404 from geoftp at time of build — fallback chain in `scripts/build-geo.ts` tries 2024→2023→2022.
- **Pipeline:** `pnpm geo:build` → `mapshaper@0.7.18` Visvalingam simplification + reproject SIRGAS 2000 → WGS84 + filter to `{uf, name}` properties → TopoJSON.
- **Output:** `src/lib/geo/data/states.json` (**78.4 KB**, 27 features).
- **Topology object key:** `BR_UF_2022`
- **First feature properties:** `{"uf":"AC","name":"Acre"}` ✓
- **Reproducibility:** re-run `pnpm geo:build` after IBGE publishes new malha; commit diff.

Supply chain notes for `mapshaper@0.7.18`:

- Publisher: `mbloch` (Matthew Bloch) — canonical.
- License: MPL-2.0.
- Build-time only (`devDependencies`); zero runtime impact on bundle.
- No `postinstall` / `preinstall` scripts.

## @date-fns/tz

(pending Task 3 execution)
