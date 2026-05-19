---
phase: 05-cemaden-dashboard-ui
plan: 10
type: execute
wave: 3
depends_on: ["05-06", "05-08", "05-09"]
files_modified:
  - src/app/page.tsx
  - src/app/page.test.tsx
  - src/lib/snapshot/load.ts
  - src/lib/snapshot/load.test.ts
autonomous: true
requirements: [DASH-01, DASH-02, DASH-03, DASH-07, A11Y-01, A11Y-02, DATA-07]
must_haves:
  truths:
    - "GET / renders 27 states server-side"
    - "?region={slug} server-filters card list while map stays full"
    - "Map (desktop) + cards (mobile/tablet) layout matches sketch finding 001-C"
    - "Stale-source banner renders at top when any source >30 min stale or null"
    - "Total-failure floor (all sources stale): gray cards + banner + emergency contacts"
    - "Works with JavaScript disabled"
  artifacts:
    - path: "src/app/page.tsx"
      provides: "Home Server Component"
    - path: "src/lib/snapshot/load.ts"
      provides: "loadSnapshotForUi(): Promise<{states, health}>"
      exports: ["loadSnapshotForUi"]
  key_links:
    - from: "src/app/page.tsx"
      to: "src/lib/cache/upstash.ts"
      via: "getSnapshot()"
      pattern: "getSnapshot"
    - from: "src/app/page.tsx"
      to: "src/components/map/BrazilMap.tsx"
      via: "RSC import"
      pattern: "BrazilMap"
---

<objective>
Home route — composes all Wave 2 primitives into the SSR `/` page with optional `?region=` filter.

Output: `/` renders 27-state overview, map + cards, region filter, stale banner.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-cemaden-dashboard-ui/05-UI-SPEC.md
@.planning/phases/05-cemaden-dashboard-ui/05-PATTERNS.md
@.planning/phases/05-cemaden-dashboard-ui/05-CONTEXT.md
@.claude/skills/sketch-findings-enso-brasil/references/01-layout-composition.md
@src/app/api/states/route.ts
@src/lib/cache/upstash.ts
@src/lib/api/schemas.ts
@src/components/map/BrazilMap.tsx
@src/components/cards/StateCard.tsx
@src/components/filters/RegionFilter.tsx
@src/components/staleness/StaleSourceBanner.tsx
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: loadSnapshotForUi — shared snapshot+health loader</name>
  <files>src/lib/snapshot/load.ts, src/lib/snapshot/load.test.ts</files>
  <behavior>
    - `loadSnapshotForUi(): Promise<{ states: StateSnapshot[], health: SourceHealth[], generatedAt: string }>`.
    - Calls `getSnapshot()` from `@/lib/cache/upstash`; if null returns last-known fallback (read from a `snapshot_archive` table or signal "total failure" — defer to existing P2 fallback semantics; if no fallback exists, return empty states array with all sources stale).
    - Parses against `StateSnapshotsResponseSchema`.
    - Augments with `sourceHealth` from `/api/health` endpoint OR direct DB read (prefer DB since this is Node runtime).
    - Never throws; always returns a shape. UI decides whether to render full / partial / failure-floor.

    Tests:
    - Cache hit → returns parsed states (length 27)
    - Cache miss with DB fallback → returns archived states with `degraded: true`
    - Cache miss with no fallback → returns empty states + all sources marked stale (total-failure floor signal)
    - Health: each source has `key, displayName, url, lastSuccess, stability` — feeds StaleSourceBanner

  </behavior>
  <action>
    Pure orchestration. No UI.
  </action>
  <verify>
    <automated>pnpm test:ci src/lib/snapshot/load.test.ts</automated>
  </verify>
  <done>Three fallback branches tested.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Home page — / Server Component</name>
  <files>src/app/page.tsx, src/app/page.test.tsx</files>
  <behavior>
    - `export default async function HomePage({ searchParams }: { searchParams: Promise<{ region?: string }> })`.
    - Reads `region` from awaited searchParams; validates against `REGION_FROM_SLUG`; if invalid value present, treat as absent (no 404 — graceful).
    - Calls `loadSnapshotForUi()`.
    - Renders, in document order (for tab/screen-reader sequence):
      1. `<StaleSourceBanner sources={health}>` at top
      2. `<h1>` page title (locked PT-BR — add to messages if not present: "Alertas climáticos por estado")
      3. `<RegionFilter active={validatedRegion}>`
      4. Two-column section (desktop) / vertical (mobile) via CSS Grid:
         - Left/desktop top: `<BrazilMap states={allStates} />` — always full 27 (filter only affects card list per UI-SPEC interaction table)
         - Right/below: filtered list of `<StateCard>` (filter by `UF_TO_REGION[uf] === validatedRegion` when present)
      5. Total-failure floor branch: if `health.every(h => stale)`, render gray cards for all 27 UFs (level="unknown") + pinned banner + emergency contacts visible. Per sketch-finding 007-C.
    - Layout: existing `src/app/layout.tsx` provides SSR disclaimer + skip-link — DO NOT duplicate.
    - Force dynamic to ensure SSR fresh on every request (or use Upstash TTL via `revalidate = 30`). Choose `revalidate = 30` (matches cache TTL semantics from P2; consistent with `/api/states`).
    - Filter for `?region=N` (uppercase code) AND `?region=norte` (slug) both accepted? UI-SPEC says slug only (`?region=sul`) — slug only.

    Tests (jsdom RSC harness or integration via mocking loadSnapshotForUi):
    - Renders 27 cards when no filter
    - `?region=norte` filters to 7 cards (N region)
    - Invalid region (`?region=hawaii`) renders all 27 (graceful)
    - Total-failure floor: when all sources stale, renders 27 gray cards
    - Stale banner appears when CEMADEN >30 min stale
    - BrazilMap always renders 27 (filter doesn't reduce map)
    - h1 + skip-link target verified

  </behavior>
  <action>
    Replace the existing 9-line stub in `src/app/page.tsx`. Add page title to `messages.ts` if missing.
  </action>
  <verify>
    <automated>pnpm test:ci src/app/page.test.tsx &amp;&amp; pnpm build &amp;&amp; (pnpm next start &amp; sleep 5; curl -s http://localhost:3000/ | grep -c 'state-card' &gt;= 27; kill %1)</automated>
  </verify>
  <done>Build green; 27 cards on JS-off curl; filter works.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-18 | Injection | `?region=` param | mitigate | Validated against REGION_FROM_SLUG enum; invalid silently ignored |
| T-05-19 | Information disclosure | Snapshot empty case | mitigate | Total-failure floor copy is locked PT-BR; never leaks error internals |
</threat_model>

<verification>
- `curl -s http://localhost:3000/ | grep -c '<path'` ≥ 27 (map)
- `curl -s 'http://localhost:3000/?region=sul' | grep -c 'state-card'` = 3
- JS-off rendering confirmed via grep on raw HTML
</verification>

<success_criteria>

- Home renders SSR with 27 states
- Filter works server-side
- Stale banner integrated
  </success_criteria>

<output>
Create `.planning/phases/05-cemaden-dashboard-ui/05-10-SUMMARY.md`.
</output>
