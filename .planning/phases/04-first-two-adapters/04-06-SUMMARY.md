# Plan 04-06 SUMMARY — Atomic Cutover Shipped

**Branch**: `phase-4-adapters-cemaden-inmet`
**Commits**: `ae214c9` (cutover + stub rm), `8068a4f` (README + CONTRIBUTING docs)
**Date**: 2026-05-09

## What was done

### Atomic cutover commit (`ae214c9`)

Single commit, verified by `git show ae214c9 --name-status`:

| Status | File                                       |
| ------ | ------------------------------------------ |
| M      | `src/lib/sources/registry.ts`              |
| M      | `src/lib/sources/registry-meta.ts`         |
| D      | `src/lib/sources/stub.ts`                  |
| D      | `src/lib/sources/stub.test.ts`             |
| D      | `tests/fixtures/sources/stub-default.json` |
| M      | `src/app/api/health/route.test.ts`         |
| M      | `src/app/api/ingest/route.test.ts`         |
| M      | `tests/fixtures/sources/README.md`         |

### registry.ts

```ts
import { inmetAdapter } from "./inmet";
// TODO(P5): append cemadenAdapter — Promise.allSettled is N-arity safe;
// orchestrator needs no change. Schema drift fix required first (04-05-SUMMARY).
export const sources: readonly SourceAdapter[] = [inmetAdapter];
```

### registry-meta.ts

Updated from `{ key: "stub", displayName: "Stub (fixture)" }` → `{ key: "inmet", displayName: "INMET — Alert-AS" }`. The drift detector test (`registry.test.ts`) enforces lockstep.

### Stub files deleted

- `src/lib/sources/stub.ts` — Node-only adapter reading from JSON fixture file
- `src/lib/sources/stub.test.ts` — 4 unit tests for the stub adapter
- `tests/fixtures/sources/stub-default.json` — 3-alert test fixture (SP/RJ/AM)

### Test updates

**`src/app/api/health/route.test.ts`**: Changed mock DB row `sourceKey: "stub"` → `"inmet"` in 3 tests. Updated `displayName: "Stub (fixture)"` → `"INMET — Alert-AS"`.

**`src/app/api/ingest/route.test.ts`**: Major update — added `vi.mock("@/lib/sources/registry")` with a `mockInmetFetch` module-scope `vi.fn()`. Tests now inject deterministic 3-alert fixture data via the mock rather than relying on file-system env var (`STUB_FIXTURE_PATH`). Removed all `STUB_FIXTURE_PATH` references. Updated `sourceKey: "stub"` → `"inmet"` in assertions.

## Pre-cutover gates satisfied

- `pnpm test`: 209 pass, 14 skipped (pre-existing DB-gated integration tests)
- `pnpm exec tsc --noEmit`: 0 errors
- `pnpm lint`: 2 baseline warnings, 0 errors
- `pnpm depcruise`: 0 violations (89 modules, 148 dependencies)
- `git diff HEAD -- vitest.config.ts | wc -l`: 0 (W-4 invariant)
- `Promise.allSettled` on `src/app/api/ingest/route.ts:60`: already N-arity safe
- Path C: `test ! -f src/lib/sources/cemaden.ts && test ! -f src/lib/sources/cemaden.schema.ts` — PASS
- Straggler check: `stubAdapter|stub-default|STUB_FIXTURE_PATH` = 0 non-comment hits

## 04-06 verification gates

- `git show ae214c9 --name-status` shows `M registry.ts` + `D stub.ts` + `D stub.test.ts` + `D stub-default.json` ✅
- `grep -c "inmetAdapter" src/lib/sources/registry.ts` = 2 (declaration + import) ✅
- `grep "cemadenAdapter" src/lib/sources/registry.ts` — only in `TODO(P5)` comment, 0 in code ✅
- `grep -c "TODO(P5)"` registry.ts + cross-source-isolation.test.ts = 2 ✅
- README has `fixtures:refresh:inmet` reference ✅
- CONTRIBUTING has `pnpm fixtures:refresh` reference and mentions "Fase 5" ✅

## Preview-deploy status

Branch pushed to `phase-4-adapters-cemaden-inmet` on 2026-05-09. Vercel preview deployment triggered at push time. Human smoke verification against the preview URL is required before opening the PR (plan 04-06, Task 4, gate=blocking).

Smoke acceptance criteria:

- `/api/ingest` 200 with `sources[0].key === "inmet"` in response
- `/api/health` shows `inmet` source with recent `lastSuccessAt` (or empty during quiet period)
- No CEMADEN source appears in any response

## CEMADEN P5 carry-over

The `TODO(P5)` comment in `registry.ts` documents the exact step to complete when CEMADEN is implemented in Phase 5: append `cemadenAdapter` to the `sources` array. The orchestrator (`/api/ingest`) requires zero changes — `Promise.allSettled` already handles N adapters.

The inline `cemadenStub` in `tests/contract/cross-source-isolation.test.ts` has a matching `TODO(P5)` comment.
