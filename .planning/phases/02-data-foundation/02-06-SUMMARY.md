---
phase: 02-data-foundation
plan: 06
subsystem: api-schemas-and-diff
tags: [zod, schemas, diff, contract, REQ-S2.10, D-04]
requires: [01-tooling-and-deps, 05-source-runner-and-stub]
provides:
  - "UF27 const tuple (single source of truth for 27 BR federation units)"
  - "RISK_LEVELS const + RiskLevelSchema (5 values incl. 'unknown')"
  - "StateSnapshotSchema + StateSnapshotsResponseSchema (length-27 contract)"
  - "SourceHealthSchema + HealthReportSchema"
  - "diffSnapshot(prev, curr) → { changedUFs, rootChanged } for /api/ingest"
affects: [api-states, api-health, api-ingest, ui-p5]
tech-stack:
  added: []
  patterns:
    - "z.infer everywhere — no dual TS interface declarations"
    - "z.array(StateSnapshotSchema).length(27) enforces full-coverage response"
key-files:
  created:
    - src/lib/api/schemas.ts
    - src/lib/api/schemas.test.ts
    - src/lib/snapshot/diff.ts
    - src/lib/snapshot/diff.test.ts
  modified: []
decisions:
  - "UF27 alphabetical order matches src/lib/sources/schema.ts UF27_PROVISIONAL — future plan should refactor sources/schema.ts to import from api/schemas.ts (deferred, no behavior change today)"
  - "Diff equality is risk-only (not riskReason/alertCount) — only risk level transitions trigger Next.js cache revalidation; secondary fields refresh implicitly via the cached state row"
metrics:
  duration: ~5min
  completed: 2026-05-01
---

# Phase 2 Plan 6: API Schemas and Snapshot Diff Summary

Locked the public API response shapes for `/api/states` and `/api/health` via zod 4 (REQ-S2.10) and shipped the `diffSnapshot` utility (D-04) that drives Next.js `revalidatePath` after every ingest tick.

## What was built

- **`src/lib/api/schemas.ts`** — Centralized `UF27` tuple (27 BR federation units, alphabetical), `RISK_LEVELS` (`green|yellow|orange|red|unknown`), `StateSnapshotSchema`, `SourceHealthSchema`, `HealthReportSchema`, and `StateSnapshotsResponseSchema = z.array(StateSnapshotSchema).length(27)`. All TS types inferred via `z.infer`.
- **`src/lib/snapshot/diff.ts`** — `diffSnapshot(prev, curr)` returning `{ changedUFs, rootChanged }`. Cold start (`prev=null`) returns all UFs in `curr`; identical inputs return `{ changedUFs: [], rootChanged: false }`; partial change returns only the UFs whose risk transitioned; missing UF in prev is treated as changed.
- **Tests** — 15 vitest cases across both modules: schema acceptance/rejection (bad UF, negative count, bad enum, length 26/28), HealthReport datetime validation, UF27 length, and four diff behaviors (cold/steady/partial/length-mismatch).

## Verification

- `pnpm test --run src/lib/api src/lib/snapshot` → **15/15 passed** (Test Files 2 passed, Duration 3.09s).
- `grep -c "z.array(StateSnapshotSchema).length(27)" src/lib/api/schemas.ts` → 1
- `grep -c "z.enum(UF27)" src/lib/api/schemas.ts` → 1
- `grep -c "z.enum(RISK_LEVELS)" src/lib/api/schemas.ts` → 2 (RiskLevelSchema + StateSnapshotSchema.risk)
- `grep -c "z.infer" src/lib/api/schemas.ts` → 5 (one per major schema + UF type ≥4 satisfied)
- `grep -c "diffSnapshot" src/lib/snapshot/diff.ts` → 1

## Threat mitigations

- **T-02-15 (length-27 contract):** `StateSnapshotsResponseSchema.length(27)` enforces at parse time. `/api/states` (future plan) will zod-validate before serving so a malformed response cannot escape to the UI.

## Commits

| Phase | Hash      | Message                                                          |
| ----- | --------- | ---------------------------------------------------------------- |
| RED   | `8590586` | test(02-06): add failing tests for API schemas and snapshot diff |
| GREEN | `9553e2a` | feat(02-06): lock API response schemas and snapshot diff util    |

## Deviations from Plan

None — plan executed exactly as written. Linter auto-formatted long parameter lines onto single lines in `schemas.test.ts`, `diff.test.ts`, and `diff.ts` (Prettier print-width); no semantic changes.

## Known Stubs

None. The diff util appears trivially correct under P2's all-`unknown` placeholder state, but the test suite covers the real-data behaviors (partial change, cold start, length mismatch) so no rework is anticipated when P3 lands the real risk computation.

## TDD Gate Compliance

- RED gate: `test(02-06)` commit `8590586` — confirmed `Tests no tests` / 2 transform errors before implementation existed.
- GREEN gate: `feat(02-06)` commit `9553e2a` — `15/15 passed` after writing implementation.
- REFACTOR gate: not needed (implementation is minimal and focused).

## Self-Check: PASSED

- FOUND: src/lib/api/schemas.ts
- FOUND: src/lib/api/schemas.test.ts
- FOUND: src/lib/snapshot/diff.ts
- FOUND: src/lib/snapshot/diff.test.ts
- FOUND commit: 8590586
- FOUND commit: 9553e2a
