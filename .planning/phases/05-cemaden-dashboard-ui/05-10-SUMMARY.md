---
phase: 05-cemaden-dashboard-ui
plan: 10
subsystem: dashboard-ui
tags: [home-route, ssr, snapshot-loader, region-filter]
requires:
  - "@/lib/cache/upstash#getSnapshot"
  - "@/db/schema#snapshotArchive,sourcesHealth"
  - "@/lib/api/schemas#StateSnapshotsResponseSchema,UF27"
  - "@/lib/geo/regions#REGION_FROM_SLUG,UF_TO_REGION"
  - "@/components/staleness/StaleSourceBanner"
  - "@/components/filters/RegionFilter"
  - "@/components/map/BrazilMap"
  - "@/components/cards/StateCard"
provides:
  - "@/lib/snapshot/load#loadSnapshotForUi,UiSnapshot,UiHealthEntry,SourceHealthRow,LoadDeps"
  - "GET / Home Server Component"
  - "messages.page_title"
affects:
  - src/app/page.tsx
  - src/app/page.test.tsx
  - src/lib/snapshot/load.ts
  - src/lib/snapshot/load.test.ts
  - src/lib/messages.ts
tech-stack:
  added: []
  patterns:
    - injectable-deps-test-seam (LoadDeps reader functions)
    - server-component RSC awaited-children rendered via renderToStaticMarkup
    - vi.mock for both load-orchestrator and async BrazilMap to make page testable
key-files:
  created:
    - src/lib/snapshot/load.ts
    - src/lib/snapshot/load.test.ts
    - src/app/page.test.tsx
  modified:
    - src/app/page.tsx (replaced 9-line stub)
    - src/lib/messages.ts (added page_title)
decisions:
  - "Snapshot loader uses functional dependency-injection seam (readCache/readArchive/readHealth) rather than module-level mocks — keeps tests fully synchronous-safe and avoids Proxy-DB plumbing in unit tests."
  - "BrazilMap is stubbed in page.test.tsx because its real implementation is an async RSC that awaits a TopoJSON file read; renderToStaticMarkup cannot suspend. The stub preserves the locked 27-anchor DOM contract so the test still asserts the map renders the full 27 UFs regardless of filter."
  - "revalidate = 30 (not force-dynamic) — matches Upstash cache TTL semantics and gives free per-segment CDN caching for the unfiltered root."
  - "Region param accepts SLUG ONLY (norte/nordeste/centro-oeste/sudeste/sul) per UI-SPEC. Uppercase region codes (N/NE/etc.) are silently treated as invalid → all 27."
metrics:
  duration_minutes: ~10
  tasks_completed: 2
  tests_added: 16
  tests_passing: 16
  files_created: 3
  files_modified: 2
  completed_at: 2026-05-19
---

# Phase 5 Plan 10: Home Route Summary

One-liner: SSR home `/` composes Wave-2 primitives (banner → h1 → filter → map+cards) over a never-throwing snapshot loader with cache → archive → floor fallback.

## What was built

### Task 1 — `loadSnapshotForUi` (commit `61f5307`, RED `9294a35`)

Pure orchestrator at `src/lib/snapshot/load.ts`. Returns `{ states, health, generatedAt, degraded }` — **always 27 states, never throws**. Three branches:

1. **Cache hit** — `getSnapshot()` validated against `StateSnapshotsResponseSchema` → `degraded:false`.
2. **Cache miss / schema mismatch** — newest `snapshot_archive` row body parsed → `degraded:true`.
3. **Total-failure floor** — 27 `risk:"unknown"` placeholders, all health rows forced to `isStale:true, lastSuccess:null` (sketch-finding 007-C).

Health is read independently via `sources_health` rows, enriched with `displayName`/`stability` from `registry-meta`, and computed `isStale` against a 30-min threshold matching `StaleSourceBanner`.

Tests (7/7 passing): cache hit, archive fallback, floor, staleness threshold, registry enrichment, never-throws on internal errors, schema-invalid cache falls through.

### Task 2 — `HomePage /` (commit `e890c11`, RED `6e3d293`)

`src/app/page.tsx` — `async` Server Component. Reads `searchParams: Promise<{region?:string}>`, validates against `REGION_FROM_SLUG` (slug only — invalid silently ignored, T-05-18). Renders in document order:

1. `<StaleSourceBanner sources={health}>` — top
2. `<h1>` `messages.page_title` ("Alertas climáticos por estado")
3. `<RegionFilter active={validatedRegion}>`
4. 2-col grid (mobile vertical) — `<BrazilMap states={all 27}>` left, filtered `<StateCard>` list right.

`export const revalidate = 30`. BrazilMap always receives all 27 UFs regardless of filter (UI-SPEC interaction table).

Tests (9/9 passing): h1, 27 cards no-filter, ?region=sul→3, ?region=norte→7, invalid region→27, map=27 in both, stale banner, total-failure floor, region chips.

## Commits

| Hash      | Subject                                              |
| --------- | ---------------------------------------------------- |
| `9294a35` | test(05-10): add failing tests for loadSnapshotForUi |
| `61f5307` | feat(05-10): implement loadSnapshotForUi loader      |
| `6e3d293` | test(05-10): add failing tests for HomePage /        |
| `e890c11` | feat(05-10): implement HomePage SSR composition      |

## Deviations from Plan

**1. [Rule 3 - Blocking] BrazilMap async RSC could not be rendered via `renderToStaticMarkup`**

- **Found during:** Task 2 GREEN run — `renderToStaticMarkup` suspended on BrazilMap's awaited TopoJSON read.
- **Fix:** Added a `vi.mock("@/components/map/BrazilMap")` stub that emits the locked 27-anchor DOM (`<a href="/estado/{uf}">`), preserving the contract the BrazilMap unit test owns. Real BrazilMap rendering is exercised in `src/components/map/BrazilMap.test.tsx` (already green from plan 05-06).
- **Files modified:** `src/app/page.test.tsx`.
- **Commit:** `e890c11`.

**2. [Rule 1 - Bug] Card-count regex matched too many classnames**

- **Found during:** Task 2 first GREEN run — `/class="state-card/g` matched 81 (27×3) because StateCard contains `state-card`, `state-card-cta`, `state-card-meta` classes.
- **Fix:** Tightened regex to `class="state-card /g` (trailing space) so only the outer `<article>` matches.
- **Files modified:** `src/app/page.test.tsx`.
- **Commit:** `e890c11`.

## Threat Mitigations Applied

- **T-05-18** — `?region=` param validated via `REGION_FROM_SLUG` lookup; invalid values silently → null (no 404, no echo of attacker-supplied string into markup).
- **T-05-19** — Snapshot empty case never leaks error details. Floor branch emits locked PT-BR copy via existing primitives (`messages.empty.stale_source`, `messages.empty.unknown_explainer`).

## Known Stubs

None. Floor branch uses real `risk:"unknown"` semantics — `StateCard` handles it via its existing `levelClassToken` mapping.

## Deferred Verification

Per plan-execution instructions, the build/curl integration step is **deferred to plan 12**:

- `pnpm build`
- `pnpm next start` and `curl -s / | grep -c 'state-card '` ≥ 27
- `curl -s '/?region=sul' | grep -c 'state-card '` = 3

The unit-test layer fully covers card counts (27/3/7/27) and the BrazilMap 27-anchor contract via the stub.

## Self-Check: PASSED

- src/lib/snapshot/load.ts — FOUND
- src/lib/snapshot/load.test.ts — FOUND
- src/app/page.tsx — FOUND (replaces stub)
- src/app/page.test.tsx — FOUND
- src/lib/messages.ts — modified (page_title added)
- Commit `9294a35` — FOUND
- Commit `61f5307` — FOUND
- Commit `6e3d293` — FOUND
- Commit `e890c11` — FOUND
- `pnpm test:ci src/lib/snapshot/load.test.ts src/app/page.test.tsx` — 16/16 passed

## TDD Gate Compliance

Both tasks followed strict RED → GREEN:

- Task 1: `test(05-10)` (9294a35) → `feat(05-10)` (61f5307) ✓
- Task 2: `test(05-10)` (6e3d293) → `feat(05-10)` (e890c11) ✓

No REFACTOR commits needed — the implementations were already minimal.
