---
phase: 05-cemaden-dashboard-ui
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - package.json
  - pnpm-lock.yaml
  - .planning/phases/05-cemaden-dashboard-ui/05-01-spike-results.md
autonomous: false
requirements: [ADAPT-01, DASH-01, DASH-02, A11Y-01, A11Y-05]
must_haves:
  truths:
    - "All P5 third-party deps pinned at versions verified in RESEARCH"
    - "react-simple-maps@3 renders 27 paths server-side under React 19 with no hydration warnings"
    - "br-atlas TopoJSON source decided (npm vs vendor) and recorded"
    - "@date-fns/tz round-trips America/Sao_Paulo, America/Manaus, America/Rio_Branco correctly on Node 24"
  artifacts:
    - path: ".planning/phases/05-cemaden-dashboard-ui/05-01-spike-results.md"
      provides: "RESEARCH open Qs 2+3 answered; ADR for br-atlas source path"
    - path: "package.json"
      provides: "9 new deps pinned"
      contains: "react-simple-maps"
  key_links: []
---

<objective>
Land the Phase 5 dependency floor and resolve the three risk items from RESEARCH (react-simple-maps SSR under React 19, br-atlas packaging, @date-fns/tz Acre/Amazonas correctness). Produces a short spike-results doc that Waves 1–3 read as ADR.

Purpose: every later plan assumes these libs exist and SSR works. If they don't, downstream pivots (e.g. hand-rolled `<path>` rendering) get decided here once, not 4 plans deep.

Output: `package.json` + lockfile updated; `05-01-spike-results.md` committed with decisions.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-cemaden-dashboard-ui/05-RESEARCH.md
@.planning/phases/05-cemaden-dashboard-ui/05-PATTERNS.md
@CLAUDE.md
@package.json
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking-human">
  <name>Task 0: Package legitimacy gate (RESEARCH §Package Legitimacy Audit — all [ASSUMED])</name>
  <what-built>RESEARCH flagged 6 packages as `[ASSUMED]` (no slopcheck output). Before any install, confirm each is the canonical project (right org, weekly downloads consistent with age, no typosquat).</what-built>
  <how-to-verify>
    For each package below, open the URL and confirm: (a) repo URL matches RESEARCH §B5 column, (b) weekly downloads &gt; 10k (mature library), (c) last publish &lt; 12 months.
    1. https://www.npmjs.com/package/date-fns
    2. https://www.npmjs.com/package/@date-fns/tz
    3. https://www.npmjs.com/package/react-simple-maps
    4. https://www.npmjs.com/package/topojson-client
    5. https://www.npmjs.com/package/d3-geo
    6. https://www.npmjs.com/package/@lhci/cli
    7. https://www.npmjs.com/package/@axe-core/playwright
    Plus types-only: `@types/react-simple-maps`, `@types/topojson-client`, `@types/d3-geo` (DefinitelyTyped — confirm `@types/` scope only).
  </how-to-verify>
  <resume-signal>Type "approved" or list any package you reject so the planner can re-evaluate.</resume-signal>
</task>

<task type="auto">
  <name>Task 1: Install pinned deps</name>
  <files>package.json, pnpm-lock.yaml</files>
  <action>**Pin EXACT versions (no caret)** per audit `6e3dd0b` MEDIUM mitigation. Run `pnpm add -E date-fns@4.1.0 @date-fns/tz@1.2.0 react-simple-maps@3.0.0 topojson-client@3.1.0 d3-geo@3.1.1` (runtime). Then `pnpm add -DE @lhci/cli@0.14.0 @axe-core/playwright@4.10.2`. Types: only install `@types/topojson-client` and `@types/d3-geo` — `react-simple-maps@3.0.0` bundles its own types per audit; skip `@types/react-simple-maps` (will fail if not on registry). Do NOT add `@vercel/speed-insights`, `web-vitals`, or any analytics package — anti-feature per CLAUDE.md. After install, run `pnpm exec tsc --noEmit` to confirm no type breakage. Then run `pnpm audit --prod --audit-level high` and record output baseline in commit message. Commit lockfile.</action>
  <verify>
    <automated>pnpm install --frozen-lockfile &amp;&amp; pnpm exec tsc --noEmit</automated>
  </verify>
  <done>9 new deps appear in `package.json`; `pnpm install --frozen-lockfile` exits 0; typecheck green.</done>
</task>

<task type="auto">
  <name>Task 2: Spike A — react-simple-maps@3 SSR under React 19 + br-atlas source decision</name>
  <files>
    .planning/phases/05-cemaden-dashboard-ui/05-01-spike-results.md,
    scripts/spike/rsm-ssr-smoke.ts (delete after spike)
  </files>
  <action>
    Create a throwaway smoke test that imports `ComposableMap`, `Geographies`, `Geography` from `react-simple-maps` inside a Server Component context (a temporary `src/app/__spike/page.tsx` is acceptable — delete after spike). Render with Albers conic `projection="geoConicEqualArea"` parallels `[-7,-22]` rotate `[54,0]`. Run `pnpm build &amp;&amp; pnpm next start` and `curl -s http://localhost:3000/__spike | grep -c '&lt;path'` — expect &gt;0 inline `<path>` elements (no `__next_f` hydration island wrapping the SVG).
    br-atlas decision PRE-RESOLVED per audit `6e3dd0b`: `@carolinabigonha/br-atlas` returns 404 on npm. **Decision: vendor.** Fetch the TopoJSON from a pinned GitHub commit SHA of `carolinabigonha/br-atlas` (use the `states.json` at the most recent `main` commit SHA — record the full SHA in spike-results doc). Place under `src/lib/geo/data/states.json`. Do NOT use the unpinned `raw/main/` URL — must pin to immutable commit SHA. Verify file size 30-50 KB and `Object.keys(topology.objects)` includes a `states`-like key.
    Write `05-01-spike-results.md` with: (a) PASS/PIVOT verdict on react-simple-maps SSR, (b) br-atlas line: `br-atlas: vendor @ <full-commit-SHA>` (LOCKED per audit), (c) if PIVOT, the fallback approach (precomputed `<path>` array via `d3-geo` `geoPath` server-side; downstream map plan switches to that). Delete `src/app/__spike/` and `scripts/spike/`.
  </action>
  <verify>
    <automated>test -f .planning/phases/05-cemaden-dashboard-ui/05-01-spike-results.md &amp;&amp; grep -E '^(Verdict|br-atlas):' .planning/phases/05-cemaden-dashboard-ui/05-01-spike-results.md &amp;&amp; test ! -d src/app/__spike &amp;&amp; test ! -d scripts/spike &amp;&amp; test ! -d tests/spike</automated>
  </verify>
  <done>Spike-results doc records SSR verdict + br-atlas source + fallback plan if needed. Spike scaffolding deleted (`git ls-files src/app/__spike` returns empty).</done>
</task>

<task type="auto">
  <name>Task 3: Spike B — @date-fns/tz Acre/Amazonas correctness</name>
  <files>tests/spike/date-fns-tz.test.ts (delete after spike), .planning/phases/05-cemaden-dashboard-ui/05-01-spike-results.md (append)</files>
  <action>
    Write a temporary Vitest test (under `tests/spike/`, deleted after) that:
    1. Parses `"2026-05-18 22:15:01"` as UTC via `date-fns` `parse` + `@date-fns/tz` `tz("UTC")`.
    2. Formats via `tz("America/Sao_Paulo")` → expect `"2026-05-18 19:15:01"` (UTC-3, no DST post-2019).
    3. Formats via `tz("America/Manaus")` → expect `"2026-05-18 18:15:01"` (UTC-4).
    4. Formats via `tz("America/Rio_Branco")` → expect `"2026-05-18 17:15:01"` (UTC-5).
    Run `pnpm test:ci tests/spike/`. If green: append "tz verified" to spike-results. If red: append "tz BROKEN — fallback to luxon" and surface as a blocker (do NOT proceed; reopen plan-phase). Delete `tests/spike/`.
  </action>
  <verify>
    <automated>grep -E 'tz verified' .planning/phases/05-cemaden-dashboard-ui/05-01-spike-results.md</automated>
  </verify>
  <done>Spike-results records "tz verified" line; spike test deleted; no `tests/spike/` directory left behind.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary            | Description                                        |
| ------------------- | -------------------------------------------------- |
| npm registry → repo | Untrusted package code crosses here during install |

## STRIDE Threat Register

| Threat ID | Category  | Component    | Disposition | Mitigation Plan                                                            |
| --------- | --------- | ------------ | ----------- | -------------------------------------------------------------------------- |
| T-05-01   | Tampering | npm installs | mitigate    | Task 0 blocking human checkpoint per RESEARCH `[ASSUMED]` legitimacy flags |
| T-05-SC   | Tampering | supply chain | mitigate    | Pinned versions; lockfile committed; pre-commit gitleaks active            |

</threat_model>

<verification>
- `pnpm install --frozen-lockfile` clean
- `pnpm exec tsc --noEmit` green
- `.planning/phases/05-cemaden-dashboard-ui/05-01-spike-results.md` exists with all three verdicts
- No `src/app/__spike` or `tests/spike` or `scripts/spike` left in tree
</verification>

<success_criteria>

- 9 deps installed at pinned versions
- 3 spike verdicts recorded
- Downstream plans can import `react-simple-maps`, `@date-fns/tz`, `topojson-client` without further version research
  </success_criteria>

<output>
Create `.planning/phases/05-cemaden-dashboard-ui/05-01-SUMMARY.md` with: deps added, spike verdicts (verbatim), and `br_atlas_source: "npm" | "vendor"`.
</output>
