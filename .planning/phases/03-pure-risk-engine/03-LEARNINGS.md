---
phase: 03-pure-risk-engine
phase_number: 3
extracted: 2026-05-02
---

# Phase 3 — Learnings: Pure Risk Engine

## Decisions Worth Remembering

- **D-01 schema fix in P3 (not P4):** P2 conflated `Severity` (alert-level: low..extreme) with `RiskLevel` (state-level: green..unknown). Fixed in P3 because RISK-03 acceptance test depended on it. Two-name strategy (parallel `AlertCalcInput`) rejected — adapter layer with no benefit over a one-time refactor.
- **D-02 single SoT for vocab:** `messages.ts` is the only PT-BR string source. `vocab.ts` is the sole `@/lib/messages` consumer in `src/lib/risk/`, enforced by ESLint `no-restricted-imports`. Designer/copy edits land in one file.
- **D-03 belt-and-suspenders edge-safety:** dep-cruiser (CI gate) + scoped vitest v8 coverage (100/100/100/100) + ESLint override (IDE feedback). RISK-01 isolation enforced at three layers.
- **D-04 deterministic dedup tie-break:** severity desc → fetched_at desc → source_key alphabetical. Source-priority hierarchy (INMET > CEMADEN) rejected — ages poorly when INPE/NASA arrive in P6.
- **P3 = lib only, no wiring:** P4 owns the `v0-placeholder` → `v0` swap in `/api/ingest` + `/api/archive`. AC-14 enforced empty `src/app/api/**` diff post-phase.

## Lessons Learned

- **Parallel executor agents + lint-staged + git = race condition.** Wave 0 spawned 3 agents simultaneously (Plans 01/02/03 — different files, "should be safe"). Lint-staged's stash/unstash dance corrupted the index. Recovery cost ~3 commits worth of debugging. **Rule:** sequential execution always when husky+lint-staged is active. Parallel only safe for read-only research.
- **Coverage gate catches dead code.** `explanation.ts` shipped with 3 unreachable branches (pluralAlertas n===1, hazardName fallback for type-safe enum, sourceName for never-multi-same-source). Coverage at 78.57% branches → fixed by inlining + adding same-source-dedup test. Lesson: type-safe defensive fallbacks for enum-typed inputs kill 100% coverage. Trust the type system or add tests with `as any`.
- **Composed pipeline test required for AC-3.** SPEC said `calculateRiskLevel` returns 5 levels but `calculate` alone never emits `unknown` — that's `applyStaleness`'s job. Plan-checker caught this; Plan 13 added `pipeline.integration.test.ts`. Lesson: when SPEC describes pipeline behavior, test the composed surface, not unit functions.
- **CONTEXT thoroughness pays off.** D-01..D-04 locked 4 specific HOW decisions before planning. Research + planner had little ambiguity to resolve. Plan-checker passed in 1 revision round. Compare to less-locked phases where iteration count is higher.
- **PowerShell path-mangling on `>file.txt`.** Redirecting depcruise output to a relative path inside the repo created a single-entry file with the path literal as the filename (`C\357\200\272UsersUserAppData...`). Lesson: pipe to `head` / `tail` instead of redirecting to files when iterating.

## Patterns Discovered

- **Pure-lib phase template:** SPEC (locked criteria) → CONTEXT (HOW decisions) → RESEARCH (version pins, exact config) → PATTERNS (closest analogs) → 13 PLANs across 6 waves → execute → UAT (mostly automated). Worked end-to-end with minimal human input outside Wave 0 recovery.
- **D-01-style schema fix wave-0 + types wave-1 ordering:** schema correction must precede pure-type module. Coverage CI step deferred until at least one risk file lands (W-7 fix — vacuous-empty-include behavior).
- **Const-array → derived type:** `as const` array → `(typeof X)[number]` is the universal pattern in this repo (HAZARD_KINDS, UF27, RISK_LEVELS, SEVERITIES). Mirror it for any new enum-like surface.
- **Test co-location is the convention here:** `foo.ts` + `foo.test.ts` same dir. Snapshot files in `__snapshots__/` Vitest default subdir is OK — that's storage, not a test mirror. Don't move tests to `__tests__/` or `tests/` mirror without explicit user direction.

## Surprises

- **`RISK_LEVELS` already existed in `api/schemas.ts:49` from P2.** Pattern-mapper caught the collision before planner committed to a new declaration. Fix: canonicalize in `sources/schema.ts`, re-export from `api/schemas.ts`. Lesson: pattern-mapper is more useful than it looks even for "new module" phases.
- **`tsx` not in devDeps.** Regen script (Plan 01 Task 1.3) needed plain Node `.mjs` instead of TS. W-6 caught this in plan revision; would have been a runtime executor failure otherwise. Always check devDep availability before locking script runtime.
- **V8 sort stability since Node 12** + D-04 comparator → fully deterministic dedup with native `[...].sort()`. No need for stable-sort library.
- **`pool: forks` + `@vitest/coverage-v8@4.1.5` exact-pin works fine.** RESEARCH flagged risk; reality showed compatibility from Vitest 1.6+. Exact pin to vitest minor (4.1.5) was the right call.
- **dep-cruiser regex paths normalize forward-slash on Windows.** Cross-platform safe out of the box. Concern from RESEARCH was unfounded.
- **Plan 09 calculate.ts forced local SEVERITY_RANK duplication** (cannot import from `./dedup` per RISK-01 isolation). Accepted as deliberate trade-off in CONTEXT — depcruise rule wins, DRY loses. Two declarations for ~5 lines of code.

## Anti-Patterns Avoided

- Logging in pure engine — banned by ESLint, enforced from day 1
- Source-priority hierarchy in dedup — rejected D-04 in favor of temporal/alphabetical
- Two-name `Alert` / `AlertCalcInput` strategy — rejected D-01
- Repo-wide coverage thresholds — scoped to `src/lib/risk/**` so P2 isn't held to 100% retroactively
- Mutating input arrays in pure functions — every dedup/sort uses `[...alerts]` spread
- Bake-on-first-run snapshot for case 5 — W-2 locked exact string instead, preventing silent regression masking

## Carryover for Future Phases

- **P4 must:** swap `"v0-placeholder"` → `FORMULA_VERSION` in `/api/ingest` + `/api/archive`, update P2 test fixtures asserting on placeholder string, wire `calculateRiskLevel`/`applyStaleness`/`generateExplanation` into the ingest/archive routes alongside real CEMADEN/INMET adapters.
- **P6 must:** add `src/lib/risk/sources/{inpe,nasa}.ts` mirroring cemaden/inmet pattern. Mapping tables only — no algorithm change without versioning to `v1`.
- **All future phases:** sequential executor agents only when husky+lint-staged active. If parallelism is needed, isolate via worktrees.
