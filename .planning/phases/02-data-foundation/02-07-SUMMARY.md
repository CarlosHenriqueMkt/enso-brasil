# Plan 02-07 — /api/states + /api/health · SUMMARY

**Plan:** `02-07-api-states-health-PLAN.md`
**Status:** complete
**Wave:** 3
**Tasks:** 2/2 (TDD red+green per route)

## Commits

- `e945762` test(02-07): add failing contract tests for /api/states edge route
- `579e0b8` feat(02-07): implement /api/states edge route + add vitest @ alias
- `beee2d8` test(02-07): add failing contract tests for /api/health + registry-meta drift
- `<later>` feat(02-07): /api/health edge route + edge-safe registry-meta

## Files written

- `src/app/api/states/route.ts` — edge GET; reads getSnapshot() → 503 `{error: "snapshot_unavailable"}` on miss → parse via StateSnapshotsResponseSchema → 200 JSON; 502 on schema mismatch
- `src/app/api/states/route.test.ts` — vitest contract: cache miss → 503; cache hit → 200; bogus content → 502
- `src/app/api/health/route.ts` — edge GET; queries `sourcesHealth` via neon-http; maps rows to HealthReport with isStale (NULL OR >30min) + displayName lookup with sourceKey fallback; 502 on DB error
- `src/app/api/health/route.test.ts` — vitest contract: empty rows → 200 empty; null lastSuccess → isStale true; >30min → isStale true; <30min → isStale false; unknown source → fallback displayName
- `src/lib/sources/registry-meta.ts` — edge-safe `sourceDisplayNames: Record<string,string>` derived from `sourceMetadata` array. Frozen objects. Drift-detected via `registry.test.ts` (planner deviation #1 from plan-check).
- vitest config update: added `@/` alias resolver for path imports

## Verification

- `pnpm exec tsc --noEmit` → exit 0
- `pnpm test` → 57/57 pass (13 test files)
- 5/5 health route tests pass (mocked db.select)
- 3/3 states route tests pass (UpstashRedisMock)
- ESLint guard from 02-04 active: `import pino` in either route file would fail lint
- 503 response shape exactly `{ error: "snapshot_unavailable" }` (UI in P5 keys off this)

## Deviations

1. **`registry-meta.ts` planner-deviation honored.** Plan called for direct `sourceDisplayNames` import from `registry.ts`, but registry transitively imports `stub.ts` which uses `node:fs`. Edge isolate cannot resolve fs. Extracted edge-safe meta layer. Drift detector in `registry.test.ts` enforces lockstep (planner reported this in plan-check; orchestrator validated and committed).
2. **DB mock pattern via `vi.mock("@/db/edge")`.** Plan didn't prescribe mocking strategy. Chose vi.mock with a `select().from()` chain returning a shared `rows` array — keeps tests pure (no Neon dependency in CI). Integration tests against real PG land in 02-10.
3. **Health test fixtures use camelCase row keys** (sourceKey, lastSuccessAt) matching drizzle's `$inferSelect` output for `sourcesHealth` table. Snake_case DB columns auto-converted by Drizzle.

## REQ coverage

- **REQ-S2.10** ✓ — both edge routes ship with zod-locked response shapes
- **REQ-S2.08** ✓ — /api/health surfaces isStale per 30-min rule
- **DATA-07** ✓ — staleness flag end-to-end (test asserts boundary)

## Anti-patterns avoided

- ❌ `import pino` in edge route (lint guard from 02-04)
- ❌ DB read-through fallback on cache miss (deferred to P6 per SPEC; 503 explicit)
- ❌ `import "@/lib/sources/stub"` from edge code (would import node:fs at module top)
- ❌ Inline displayName strings (single source of truth in registry-meta)
