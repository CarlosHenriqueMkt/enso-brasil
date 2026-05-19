---
phase: 05-cemaden-dashboard-ui
plan: 06
subsystem: sources-registry
tags: [registry, isolation, cemaden, contract-test]
requirements: [ADAPT-01, DATA-04]
provides:
  - "registry exports [inmetAdapter, cemadenAdapter] — N=2, real adapters only"
  - "registry-meta carries readonly stability field (stable | unstable)"
  - "sourceStability map derived from registry-meta"
  - "cross-source isolation contract exercised against real cemadenAdapter"
requires:
  - "src/lib/sources/cemaden.ts createCemadenAdapter(http) factory (Plan 05-03)"
  - "src/lib/sources/registry.test.ts drift detector (Plan 04-04)"
affects:
  - "/api/ingest orchestrator (no change — Promise.allSettled is N-arity safe)"
  - "/api/health edge route (consumes sourceDisplayNames + sourceStability)"
tech_stack_added: []
patterns_added:
  - "stability annotation on edge-safe source metadata (T-05-09 mitigation)"
key_files_created: []
key_files_modified:
  - src/lib/sources/registry-meta.ts
  - src/lib/sources/registry.ts
  - tests/contract/cross-source-isolation.test.ts
decisions:
  - "Stability annotation lives in registry-meta (edge-safe) — UI degraded-source banner reads from this map without pulling adapter modules"
  - "Path C invariant assertions (cemaden.ts must not exist) removed — CEMADEN code now lives in src/ as of Plan 05-03"
  - "Failing CEMADEN simulated via injected CemadenHttpClient that throws sourceError(http_5xx); not via direct adapter stub"
metrics:
  tasks_completed: 3
  duration_min: 5
  completed_at: 2026-05-19
commits:
  - 74f9449 # Task 1: stability + cemaden meta entry
  - bdafd10 # Task 2: append cemadenAdapter to registry
  - 1b55a1a # Task 3: real cemadenAdapter in isolation test
---

# Phase 5 Plan 06: Registry & Isolation Summary

Wired the real CEMADEN adapter into the source registry, added a `stability` annotation to edge-safe metadata (T-05-09 mitigation), and rewrote the cross-source isolation contract to exercise the production `cemadenAdapter` via injected failing HTTP client.

## Tasks

### Task 1 — Extend registry-meta with stability + cemaden entry (74f9449)

- Added `readonly stability: "stable" | "unstable"` to `sourceMetadata` items.
- INMET: `stability: "stable"`. CEMADEN: `stability: "unstable"` (per CEMADEN endpoint capture instability flag).
- Derived `sourceStability: Record<string,"stable"|"unstable">` map alongside the existing `sourceDisplayNames` map.
- Kept module edge-safe (no node imports, no `./registry` import).
- Drift detector failed as expected after Task 1 in isolation (length 1 vs 2) — resolved by Task 2.

### Task 2 — Append cemadenAdapter to registry (bdafd10)

- `sources = [inmetAdapter, cemadenAdapter]` (INMET first, CEMADEN appended).
- Removed `TODO(P5)` docblock lines.
- Added `import { cemadenAdapter } from "./cemaden";`.
- Drift detector green.

### Task 3 — Real cemadenAdapter in isolation test (1b55a1a)

- Removed `cemadenStub()` factory entirely (`grep cemadenStub` → 0 hits).
- Test now imports `createCemadenAdapter` + `CemadenHttpClient` from `@/lib/sources/cemaden`.
- Simulated failure: `failingCemadenHttp.getJson` throws `sourceError("http_5xx", ...)`.
- Forward isolation: CEMADEN rejects with `http_5xx`, INMET fulfills `Alert[]` independently.
- Reverse isolation: INMET stub rejects, CEMADEN also rejects independently — both branches `rejected` under `Promise.allSettled`.
- Removed obsolete Path C invariant assertions (`cemaden.ts` does not exist) — these were correct in P4 but contradict P5-03 (CEMADEN code now lives in `src/`).

## Verification

- `pnpm test:ci src/lib/sources/registry.test.ts` → 2/2 pass
- `pnpm test:ci tests/contract/cross-source-isolation.test.ts` → 2/2 pass
- `grep -rn cemadenStub tests/` → 0 matches

## Deviations from Plan

**[Rule 3 - Blocking]** Plan did not call out that the prior file contained a Path C invariant block asserting `src/lib/sources/cemaden.ts` does NOT exist (lines 163-171 of the pre-edit file). After P5-03 created that file, the assertion would have failed. Removed the entire `Path C invariant` describe block as part of Task 3 since its premise (Path C carry-over) is invalidated by P5-03. Documented in the new file header comment.

## Pre-existing Out-of-Scope Issues (logged, not fixed)

- `src/components/cards/StateCard.tsx:151` TS2322 typed route error for `/estado/${string}` — unrelated to this plan, pre-existing on branch.

## Threat Flags

None — surface area added is metadata-only (stability annotation) and a registry append; both fall under the existing T-05-09 / T-05-10 mitigations in the plan's threat_model.

## Known Stubs

None — the real adapter wiring is the entire point of this plan.

## Self-Check: PASSED

- src/lib/sources/registry-meta.ts: FOUND
- src/lib/sources/registry.ts: FOUND (imports cemadenAdapter; length 2)
- tests/contract/cross-source-isolation.test.ts: FOUND (no cemadenStub)
- Commits 74f9449, bdafd10, 1b55a1a: FOUND on phase-5-cemaden-dashboard
