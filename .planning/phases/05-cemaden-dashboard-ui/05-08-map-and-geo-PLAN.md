---
phase: 05-cemaden-dashboard-ui
plan: 08
type: execute
wave: 2
depends_on: ["05-01", "05-07"]
files_modified:
  - src/lib/geo/br-atlas.ts
  - src/lib/geo/br-atlas.test.ts
  - src/lib/geo/regions.ts
  - src/lib/geo/regions.test.ts
  - src/lib/geo/data/states.json
  - src/components/map/BrazilMap.tsx
  - src/components/map/BrazilMap.test.tsx
  - src/components/map/StateShape.tsx
autonomous: true
requirements: [DASH-02, A11Y-02, A11Y-05]
must_haves:
  truths:
    - "BrazilMap renders 27 SSR `<path>` elements with Albers conic projection (parallels [-7,-22], rotate [54,0])"
    - "Each path is wrapped in `<Link href=/estado/{uf}>` for full SSR navigation"
    - "Map is keyboard-navigable; tab order follows feature order in br-atlas TopoJSON"
    - "TopoJSON loaded server-side and cached in module scope (single load per server lifetime)"
    - "5-region UF→region map exists with all 27 UFs covered"
  artifacts:
    - path: "src/lib/geo/br-atlas.ts"
      provides: "loadBrAtlas(): FeatureCollection — server-side cached TopoJSON loader"
      exports: ["loadBrAtlas"]
    - path: "src/lib/geo/regions.ts"
      provides: "UF_TO_REGION map + REGION_SLUGS"
      exports: ["UF_TO_REGION", "REGION_SLUGS", "ufsInRegion", "type Region"]
    - path: "src/components/map/BrazilMap.tsx"
      provides: "SSR Albers map with per-state Link wrapping"
  key_links:
    - from: "src/components/map/BrazilMap.tsx"
      to: "src/lib/geo/br-atlas.ts"
      via: "loadBrAtlas() server-side call"
      pattern: "loadBrAtlas\\(\\)"
    - from: "src/components/map/StateShape.tsx"
      to: "next/link"
      via: "<Link href={`/estado/${uf}`}>"
      pattern: "/estado/"
---

<objective>
Map subsystem. Built independently of routes — routes consume `<BrazilMap />` as a primitive.

Output: TopoJSON loader, regions module, BrazilMap RSC component, StateShape leaf, tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-cemaden-dashboard-ui/05-01-spike-results.md
@.planning/phases/05-cemaden-dashboard-ui/05-RESEARCH.md
@.planning/phases/05-cemaden-dashboard-ui/05-UI-SPEC.md
@.planning/phases/05-cemaden-dashboard-ui/05-PATTERNS.md
@CLAUDE.md
@src/lib/sources/schema.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: br-atlas TopoJSON loader (per spike decision)</name>
  <files>src/lib/geo/br-atlas.ts, src/lib/geo/br-atlas.test.ts, src/lib/geo/data/states.json (vendor case only)</files>
  <action>
    Read `05-01-spike-results.md` to determine source path:
    - If `br_atlas_source: "npm"`: import from the published package; loader path = `node_modules/@carolinabigonha/br-atlas/data/states.json` or whatever the package surfaces.
    - If `br_atlas_source: "vendor"`: commit the vendored `states.json` to `src/lib/geo/data/states.json` (SHA pinned in spike-results doc). File size expected 30-50 KB per RESEARCH §B7.

    Implement `loadBrAtlas(): Promise<FeatureCollection>`:
    - Reads TopoJSON via `node:fs/promises.readFile` (Node-only — UI route that uses this must NOT be edge runtime).
    - Caches result in module-scope `Promise<FeatureCollection> | null` (single load per server lifetime).
    - Uses `topojson-client`'s `feature(topology, topology.objects.states)` (or whatever object key br-atlas uses — verify with `Object.keys(topology.objects)`).
    - Returns a `FeatureCollection` of 27 features, each with `properties.uf` (2-letter UF code) and `properties.name` (PT-BR state name). If properties don't already carry UF codes (verify in spike), inject them from a mapping table (state name → UF code, all 27 covered).

    Tests:
    - Loads 27 features
    - Every feature has `properties.uf` and `properties.uf ∈ UF27_PROVISIONAL`
    - Second call returns same instance (cache check via `===`)

  </action>
  <verify>
    <automated>pnpm test:ci src/lib/geo/br-atlas.test.ts</automated>
  </verify>
  <done>27 features loaded, properties normalized, cache works.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: regions module — UF↔Region mapping</name>
  <files>src/lib/geo/regions.ts, src/lib/geo/regions.test.ts</files>
  <behavior>
    - `type Region = "N" | "NE" | "CO" | "SE" | "S"`.
    - `REGION_SLUGS: Record<Region, string>` → `{ N:"norte", NE:"nordeste", CO:"centro-oeste", SE:"sudeste", S:"sul" }`.
    - `REGION_FROM_SLUG: Record<string, Region|undefined>` → inverse (used by `?region=` param parser).
    - `UF_TO_REGION: Record<UF, Region>` — all 27 UFs covered, frozen. Canonical IBGE mapping:
      - N: AC AM AP PA RO RR TO (7)
      - NE: AL BA CE MA PB PE PI RN SE (9)
      - CO: DF GO MT MS (4)
      - SE: ES MG RJ SP (4)
      - S: PR RS SC (3)
    - `ufsInRegion(region: Region): UF[]` — derived.

    Tests:
    - All 27 UFs map to exactly one region
    - Region totals: N=7 NE=9 CO=4 SE=4 S=3 = 27
    - Round trip slug → region → slug

  </behavior>
  <action>Pure data + helpers.</action>
  <verify>
    <automated>pnpm test:ci src/lib/geo/regions.test.ts</automated>
  </verify>
  <done>Tests green; total 27.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: BrazilMap + StateShape components</name>
  <files>src/components/map/BrazilMap.tsx, src/components/map/BrazilMap.test.tsx, src/components/map/StateShape.tsx</files>
  <behavior>
    - `BrazilMap` is a Server Component (no `"use client"`). Props: `{ states: Array<{uf:UF, level:RiskLevel}>, projection?: ProjectionConfig }`.
    - Calls `loadBrAtlas()` server-side, projects via react-simple-maps `<ComposableMap projection="geoConicEqualArea" projectionConfig={{ parallels:[-7,-22], rotate:[54,0,0], scale:600 }}>`. (Exact `scale` value tuned in spike — record in spike-results.)
    - For each feature, renders `<StateShape uf={f.properties.uf} level={lookupLevel(f.properties.uf)} feature={f} />`.
    - Provides `<title>` element inside each path for hover tooltip (CSS-only, no JS) — content: `${stateName}: ${messages.severity[level]}`.
    - Sets `<svg role="img" aria-label="Mapa do Brasil — risco por estado">` on outer.

    - `StateShape` (leaf RSC): renders `<Link href={`/estado/${uf.toLowerCase()}`} prefetch={false} tabIndex={0} aria-label={`${stateName}: ${messages.severity[level]}`}><path d={projectedD} fill={riskFill(level)} stroke="var(--color-line-strong)" /></Link>`. `prefetch={false}` to avoid 27-prefetch storm on first paint (per planning notes Q3).
    - Fill colors use CSS vars: `var(--color-risk-{level}-bg)` — never hardcoded hex.
    - Minimum touch target 44px on mobile (per UI-SPEC spacing exception); enforced via min-area heuristic — if projected path bbox < 44px on smaller states (DF, AL, SE), inflate via CSS `stroke-width: 2px` + outer hit area `<rect>` overlay (acceptable per WCAG touch target).

    Tests (jsdom):
    - Renders 27 `<Link>` elements after `loadBrAtlas` resolves
    - Each Link has `href="/estado/{lowercase-uf}"`
    - All `<path>` get fill from var(--color-risk-{level}-bg) (assert via class or style attr)
    - SVG has `role="img"` and `aria-label`
    - Tab order: tab through container visits all 27 in document order

    Spike pivot branch: if `05-01-spike-results.md` says PIVOT, replace `<ComposableMap>` with hand-rolled `<svg>` + `d3-geo`'s `geoPath()` server-side. Same props contract. **DOM invariant (LOCKED, both branches):** rendered output MUST contain exactly 27 occurrences of `<a href="/estado/{uf}"><path …/></a>` (one per UF, lowercase href). Plan 10 `grep -c '<path'` verify and any anchor-count assertions depend on this invariant — pivot must not break it.

  </behavior>
  <action>
    Read spike-results first. Implement chosen path. Document choice in component docblock.
  </action>
  <verify>
    <automated>pnpm test:ci src/components/map/BrazilMap.test.tsx &amp;&amp; pnpm build</automated>
  </verify>
  <done>27 links render SSR; tests green; build succeeds.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-13 | Injection | UF path param | mitigate | StateShape's href is built from UF27 enum, not user input |
| T-05-14 | DoS | 27 prefetch storm | mitigate | `prefetch={false}` on map links |
</threat_model>

<verification>
- `pnpm test:ci` map + geo tests green
- `pnpm build` succeeds
- `curl http://localhost:3000/ | grep -c '<path'` ≥ 27 (verified in plan 09 home wiring)
</verification>

<success_criteria>

- Albers projection locked params verified visually (manual checkpoint in plan 12)
- 27 SSR `<a>` elements wrap 27 `<path>` elements
  </success_criteria>

<output>
Create `.planning/phases/05-cemaden-dashboard-ui/05-08-SUMMARY.md` recording chosen rendering path (react-simple-maps vs d3-geo fallback).
</output>
