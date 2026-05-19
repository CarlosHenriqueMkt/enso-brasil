---
phase: 05-cemaden-dashboard-ui
plan: 05
subsystem: sources/inmet
tags: [adapter, schema-drift, fixture-refresh, contract-test]
requires:
  - src/lib/sources/inmet.ts (Phase 4)
  - src/lib/sources/inmet.schema.ts (Phase 4)
  - tests/contract/inmet.test.ts (Phase 4)
provides:
  - InmetActiveListSchema accepts `{hoje, futuro}` envelope
  - Adapter flattens hoje ∪ futuro and dedups by id (futuro wins)
  - Live INMET fixture refreshed to envelope shape
  - Contract test locks envelope shape at fixture level
affects: [sources/inmet]
tech-stack:
  added: []
  patterns:
    - "Zod envelope schema with z.coerce.string() for cross-shape ids"
    - "Map-based dedup with last-write-wins for futuro over hoje"
key-files:
  created:
    - tests/fixtures/sources/inmet-2026-05-19.list.json
    - .planning/phases/05-cemaden-dashboard-ui/deferred-items.md
    - .planning/phases/05-cemaden-dashboard-ui/05-05-SUMMARY.md
  modified:
    - src/lib/sources/inmet.schema.ts
    - src/lib/sources/inmet.ts
    - src/lib/sources/inmet.test.ts
    - tests/contract/inmet.test.ts
    - tests/contract/__snapshots__/inmet.test.ts.snap
    - scripts/refresh-inmet.ts
  deleted:
    - tests/fixtures/sources/inmet-2026-05-09.list.json
decisions:
  - "Use futuro-wins dedup so forward-looking metadata (typically longer effective window) supersedes today's stale variant"
  - "Coerce id to string in schema to bridge live (numeric) and stub (string) fixtures without leaking type variance downstream"
  - "Retain inmet-2026-05-09.xml as CAP fallback (live alertas2.inmet.gov.br ECONNRESET-flaky during capture); contract test pairs latest list + latest XML independently"
metrics:
  duration: ~12min
  completed: 2026-05-18
  commits: 4
  tasks_completed: 3
  files_modified: 8
---

# Phase 5 Plan 5: INMET Schema Drift Fix Summary

JWT-free schema-drift fix for the INMET active-list adapter: live `/avisos/ativos` now returns a `{hoje, futuro}` envelope (not a flat array as Phase 4 assumed), and the adapter flattens + dedups by id while the live fixture is refreshed.

## What Shipped

- **Schema (`src/lib/sources/inmet.schema.ts`)** — `InmetActiveListSchema` is now `z.object({hoje, futuro})` of arrays. The legacy flat-array shape is rejected loudly via `sourceError("schema_invalid", ...)`, satisfying T-05-08 (silent regression upstream must surface, never become "zero alerts"). `id` is coerced to string to absorb live numeric ids (e.g. `54412`).
- **Adapter (`src/lib/sources/inmet.ts:260`)** — After `assertActiveList`, flattens `hoje ∪ futuro` into a `Map<string, entry>` keyed by id with futuro-wins-on-collision semantics; downstream CAP fetch loop is unchanged.
- **Live fixture (`tests/fixtures/sources/inmet-2026-05-19.list.json`)** — Captured directly from `https://apiprevmet3.inmet.gov.br/avisos/ativos`: **hoje=3, futuro=3, 6 unique ids, 0% dedup overlap on this snapshot**. Stale `inmet-2026-05-09.list.json` pruned.
- **Contract test (`tests/contract/inmet.test.ts`)** — New `"fixture matches \`{hoje, futuro}\` envelope contract"`assertion locks shape at the fixture-load level (before adapter runs); empty-list test migrated to`{hoje:[], futuro:[]}`; snapshot regenerated.
- **Script patch (`scripts/refresh-inmet.ts`)** — Pick first CAP id from `hoje ∪ futuro` envelope instead of `listData[0]` on a flat array.

## Tasks Completed

| Task | Description                               | Commit    |
| ---- | ----------------------------------------- | --------- |
| 1    | Schema + adapter envelope migration (TDD) | `d610cbc` |
| 2a   | Prune stale flat-array fixture            | `46ac816` |
| 2b   | Add live envelope fixture + script patch  | `a913b08` |
| 3    | Contract envelope assertion + snapshot    | `bbc25ce` |

## Verification

- `pnpm vitest run src/lib/sources/inmet.test.ts` → **44/44 passing**.
- `pnpm vitest run src/lib/sources/inmet.test.ts --coverage` for `inmet.ts` + `inmet.schema.ts` → **100% / 100% / 100% / 100%** (parity with Phase 4).
- `pnpm vitest run tests/contract/inmet.test.ts` → **6/8 passing**; 2 failures are out-of-scope (see Deferred Issues).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `id` typed as `z.string()` but live API returns `number`**

- **Found during:** Task 3 (contract test against refreshed fixture)
- **Issue:** Live `/avisos/ativos` returns `"id": 54412` (number), not `"54412"` (string). Phase 4's stub fixture used strings, so the bug never surfaced.
- **Fix:** Replaced `z.string().min(1)` with `z.coerce.string().min(1)` so both shapes parse, downstream always sees a non-empty string.
- **Files modified:** `src/lib/sources/inmet.schema.ts`
- **Commit:** `bbc25ce`

**2. [Rule 1 - Bug] `scripts/refresh-inmet.ts` flat-array assumption broken**

- **Found during:** Task 2 (live fixture refresh)
- **Issue:** Script cast list response to `Array<{id}>` and indexed `listData[0]?.id`; with the envelope this yields `firstId = ""` → CAP fetch 404.
- **Fix:** Detect envelope vs. legacy array; flatten `hoje ∪ futuro` before picking first id.
- **Files modified:** `scripts/refresh-inmet.ts`
- **Commit:** `a913b08`

### Auth Gates

None — all upstream endpoints are public.

## Deferred Issues

- **Path C invariants** in `tests/contract/inmet.test.ts` (lines 174–181) still assert `src/lib/sources/cemaden.ts` and `cemaden.schema.ts` do NOT exist. Plan 03 (CEMADEN adapter, parallel agent) creates these legitimately. These two test failures are owned by Plan 03/06 to retire when CEMADEN lands. Logged in `.planning/phases/05-cemaden-dashboard-ui/deferred-items.md`. Plan 05-05 deliberately did not modify these tests (parallel-safety scope boundary: owns only `inmet*` files).

- **CAP XML fixture date staleness** — `tests/fixtures/sources/inmet-2026-05-09.xml` was retained (not refreshed to 2026-05-19) because `alertas2.inmet.gov.br/{id}` returned ECONNRESET intermittently during this capture session. The contract test sorts list + XML fixtures independently and uses `.at(-1)` for each, so the date mismatch is harmless. Refresh CAP fixture in a later plan when the endpoint is stable.

## Threat Flags

None — no new threat surface introduced. T-05-08 (tampering / payload shape) is now actively mitigated by the strict envelope schema.

## Risk Assessment

**Low.** Schema is strictly stricter than before (rejects what was previously accepted as valid input); adapter dedup is conservative (futuro-wins is documented and tested); live fixture confirms the production endpoint matches the new contract.

## Self-Check: PASSED

- File `src/lib/sources/inmet.schema.ts` exists: FOUND
- File `src/lib/sources/inmet.ts` exists: FOUND
- File `tests/fixtures/sources/inmet-2026-05-19.list.json` exists: FOUND
- File `tests/fixtures/sources/inmet-2026-05-09.list.json` exists: REMOVED (intentional, per plan)
- Commit `d610cbc` (Task 1 schema/adapter): FOUND
- Commit `46ac816` (Task 2 fixture prune): FOUND
- Commit `a913b08` (Task 2 fixture add + script patch): FOUND
- Commit `bbc25ce` (Task 3 contract + snapshot): FOUND
