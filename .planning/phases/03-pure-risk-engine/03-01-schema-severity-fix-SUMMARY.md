---
phase: 03-pure-risk-engine
plan: 01
subsystem: risk-engine/schema
tags: [schema, severity, risk-levels, fixtures, D-01]
requires: []
provides:
  - "Severity type = low|moderate|high|extreme on Alert.severity"
  - "RISK_LEVELS canonical SoT in src/lib/sources/schema.ts"
  - "api/schemas.ts re-exports RISK_LEVELS (deduplicated)"
  - "stub-default.json + all-red.json fixtures with Severity values + recomputed payload_hash"
affects:
  - "src/lib/sources/schema.ts"
  - "src/lib/api/schemas.ts"
  - "src/lib/sources/schema.test.ts"
  - "src/lib/sources/stub.test.ts"
  - "tests/fixtures/sources/stub-default.json"
  - "tests/fixtures/sources/all-red.json"
tech-stack:
  added: []
  patterns: ["one-shot Node .mjs regen script (no tsx dep)"]
key-files:
  created: []
  modified:
    - src/lib/sources/schema.ts
    - src/lib/api/schemas.ts
    - src/lib/sources/schema.test.ts
    - src/lib/sources/stub.test.ts
    - tests/fixtures/sources/stub-default.json
    - tests/fixtures/sources/all-red.json
decisions:
  - "Canonicalize RISK_LEVELS in sources/schema.ts; api/schemas.ts re-exports"
  - "Map unknown -> moderate (RISK-04 conservative default)"
metrics:
  duration: "~5 minutes (recovery from prior dirty parallel run)"
  completed: 2026-05-02
---

# Phase 3 Plan 01: D-01 Alert.severity schema fix Summary

**One-liner:** Split the Severity (per-alert: low/moderate/high/extreme) and RiskLevel (state-level: green/yellow/orange/red/unknown) dimensions into distinct const exports with sources/schema.ts as the single source of truth; regenerated stub fixtures with new severity values and recomputed payload_hash.

## Tasks completed

| Task | Description                                                      | Commit  |
| ---- | ---------------------------------------------------------------- | ------- |
| 1.1  | Flip SEVERITIES + add RISK_LEVELS in src/lib/sources/schema.ts   | 482fdb4 |
| 1.2  | Re-export RISK_LEVELS from src/lib/api/schemas.ts                | f5f8f4d |
| 1.3  | Regen stub-default.json + all-red.json severities & payload_hash | 41f7cd4 |
| 1.4  | Sweep for Alert.severity RiskLevel literals (no-op — zero hits)  | n/a     |

## Notes

- Plan was previously partially executed in a parallel run that left dirty uncommitted state. Recovered cleanly: schema.ts edits matched plan Task 1.1 expectation and were committed as-is; api/schemas.ts re-export and fixture regen completed per plan.
- `all-red.json` was not explicitly listed in the plan's Files Touched, but it carries the same `severity` field that participates in `payload_hash` canonical input. Per Rule 2 (auto-add missing critical functionality) it had to be regenerated alongside `stub-default.json` to keep `stub.test.ts` (`STUB_FIXTURE_PATH=all-red.json` branch) green.
- Regen script `scripts/regen-stub-hashes.mjs` was created, executed, then deleted per plan Task 1.3 step C (one-shot, deletion prevents drift).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Also regen all-red.json**

- **Found during:** Task 1.3
- **Issue:** Plan listed only `stub-default.json` but `all-red.json` carries the same `severity` schema field, which is part of the canonical hash input. Without regen, the existing `stub.test.ts` branch using `STUB_FIXTURE_PATH=all-red.json` would have either failed schema validation (severity="red" not in SEVERITIES) or had stale hashes.
- **Fix:** Extended regen script to accept multiple files; regenerated 27 entries in all-red.json mapping red -> extreme.
- **Files modified:** tests/fixtures/sources/all-red.json
- **Commit:** 41f7cd4

**2. [Rule 2 - Missing critical functionality] Update stub.test.ts severity literal**

- **Found during:** Initial state inspection
- **Issue:** stub.test.ts asserted `a.severity === "red"` against the all-red fixture; with all-red.json now using "extreme", the test would fail.
- **Fix:** Updated to `a.severity === "extreme"`.
- **Files modified:** src/lib/sources/stub.test.ts
- **Commit:** 41f7cd4

## Verification

- `pnpm tsc --noEmit`: clean (no errors)
- `pnpm vitest run`: 65 passed | 14 skipped (16 test files); 0 failures
- `grep RISK_LEVELS\s*=` in `src/lib/api/schemas.ts`: 0 hits (re-export only)
- `grep RISK_LEVELS\s*=` in `src/lib/sources/schema.ts`: 1 hit (canonical declaration)
- `grep severity:\s*['\"](green|yellow|orange|red|unknown)['\"]` across src + tests: 0 hits

## Self-Check: PASSED

- src/lib/sources/schema.ts: SEVERITIES (low..extreme) + RISK_LEVELS (green..unknown) both present
- src/lib/api/schemas.ts: re-exports RISK_LEVELS, no local declaration
- tests/fixtures/sources/stub-default.json: 3 entries with Severity values + new hashes
- tests/fixtures/sources/all-red.json: 27 entries with severity="extreme" + new hashes
- Commits 482fdb4, f5f8f4d, 41f7cd4 all present in git log
- scripts/regen-stub-hashes.mjs deleted (one-shot, no longer in tree)
