---
phase: 03-pure-risk-engine
plan: 13
type: execute
wave: 5
depends_on: [01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12]
files_modified:
  - src/lib/risk/pipeline.integration.test.ts
  - .planning/phases/03-pure-risk-engine/03-13-VERIFY-LOG.md
autonomous: true
requirements:
  [RISK-01, RISK-02, RISK-03, RISK-04, RISK-05, RISK-06, RISK-07, RISK-08, RISK-09, RISK-10]
must_haves:
  truths:
    - "pnpm depcruise exits 0"
    - "pnpm test:coverage reports 100/100/100/100 for every file under src/lib/risk/** (excluding types.ts and *.test.ts per Plan 03 config)"
    - "pnpm lint exits 0"
    - "pnpm tsc --noEmit exits 0"
    - "pnpm test exits 0 (full suite, including P2 carry-over)"
    - "git diff --stat src/app/api/ on the phase branch is empty (P3 doesn't touch wiring)"
    - "All 8 files exist in src/lib/risk/{types,calculate,dedup,snapshot,explanation,vocab}.ts + src/lib/risk/sources/{cemaden,inmet}.ts"
    - "FORMULA_VERSION === 'v0' verifiable via grep"
    - "Composed pipeline integration test demonstrates calculate→applyStaleness emits each of the 5 RiskLevels (closes AC-3 across the public API surface)"
  artifacts:
    - path: ".planning/phases/03-pure-risk-engine/03-13-VERIFY-LOG.md"
      provides: "Captured output of each verification command (committed for audit trail)"
    - path: "src/lib/risk/pipeline.integration.test.ts"
      provides: "Composed calculate→applyStaleness test proving all 5 RiskLevels emerge from the public API surface (AC-3)"
  key_links: []
---

# Plan 13 — Final phase verification (acceptance gate)

**Goal:** Run the full SPEC acceptance suite. Adds one composed pipeline integration test (per plan-checker non-blocking suggestion) to make AC-3 ("returns each of 5 levels") observable via the public API surface, since `calculate.ts` alone never emits `unknown` (staleness rule does).

This plan is a checkpoint. If any command fails, route back into the failing plan's wave (do NOT patch in Plan 13).

## Required reading

- `.planning/phases/03-pure-risk-engine/03-SPEC.md` (Acceptance Criteria — all 13 checkboxes lines 111-124)
- `.planning/phases/03-pure-risk-engine/03-PLAN-INDEX.md` (acceptance → plan map)
- `.planning/phases/03-pure-risk-engine/03-09-calculate-PLAN.md` (calculate.ts — never emits "unknown")
- `.planning/phases/03-pure-risk-engine/03-10-snapshot-staleness-PLAN.md` (applyStaleness — emits "unknown" when all sources stale)

## Files touched

| Path                                                       | Change               |
| ---------------------------------------------------------- | -------------------- |
| `src/lib/risk/pipeline.integration.test.ts`                | create               |
| `.planning/phases/03-pure-risk-engine/03-13-VERIFY-LOG.md` | create (audit trail) |

## Tasks

### Task 13.1 — Create composed pipeline integration test (AC-3 closure)

Files: `src/lib/risk/pipeline.integration.test.ts`

Action: per plan-checker suggestion. SPEC AC-3 requires the public API to emit each of the 5 RiskLevels. `calculate.ts` alone emits 4 (`green | yellow | orange | red`); `applyStaleness` produces `"unknown"`. Compose them in one test to demonstrate the full surface.

```ts
/**
 * Phase 3 — composed-pipeline integration test (AC-3 closure).
 *
 * Demonstrates that the PUBLIC API surface
 *   `applyStaleness(calculateRiskLevel(alerts, now), sourcesHealth, now)`
 * emits each of the 5 RiskLevels: green | yellow | orange | red | unknown.
 *
 * Why this lives in a dedicated file: SPEC AC-3 ("returns each of 5 levels")
 * is satisfied by the COMPOSITION, not by calculate.ts alone (which never emits
 * "unknown" — that is staleness-derived). Plan 09 covers green/yellow/orange/red
 * directly; Plan 10 covers "unknown" in isolation. This test makes the composition
 * explicit so the gate is unambiguous.
 */

import { describe, it, expect } from "vitest";
import { calculateRiskLevel } from "./calculate";
import { applyStaleness } from "./snapshot";
import type { Alert, RiskLevel, SourcesHealthRow } from "./types";

const baseTime = new Date("2026-05-02T12:00:00Z");
const baseMs = baseTime.getTime();
const iso = (offsetMin: number) => new Date(baseMs + offsetMin * 60_000).toISOString();

const mkAlert = (overrides: Partial<Alert> = {}): Alert => ({
  source_key: "cemaden",
  hazard_kind: "enchente",
  state_uf: "MG",
  severity: "moderate",
  headline: "test",
  fetched_at: iso(0),
  valid_from: iso(0),
  valid_until: iso(60),
  payload_hash: "hash",
  raw: {},
  ...overrides,
});

const freshHealth: SourcesHealthRow[] = [
  { source_key: "cemaden", last_successful_fetch: iso(-5) }, // 5 min ago — fresh
  { source_key: "inmet", last_successful_fetch: iso(-5) },
];

const staleHealth: SourcesHealthRow[] = [
  { source_key: "cemaden", last_successful_fetch: iso(-90) }, // 90 min ago — stale (>1h)
  { source_key: "inmet", last_successful_fetch: iso(-90) },
];

function pipeline(alerts: Alert[], health: SourcesHealthRow[], now: Date): RiskLevel {
  const baseLevel = calculateRiskLevel(alerts, now);
  return applyStaleness(baseLevel, health, now);
}

describe("composed pipeline (AC-3) — calculate → applyStaleness emits all 5 RiskLevels", () => {
  it("green: no alerts, fresh sources", () => {
    expect(pipeline([], freshHealth, baseTime)).toBe("green");
  });

  it("yellow: 1 low-severity alert, fresh sources", () => {
    expect(pipeline([mkAlert({ severity: "low" })], freshHealth, baseTime)).toBe("yellow");
  });

  it("orange: 1 moderate-severity alert, fresh sources", () => {
    expect(pipeline([mkAlert({ severity: "moderate" })], freshHealth, baseTime)).toBe("orange");
  });

  it("red: 1 high-severity alert, fresh sources", () => {
    expect(pipeline([mkAlert({ severity: "high" })], freshHealth, baseTime)).toBe("red");
  });

  it("unknown: any input but ALL sources stale (>1h)", () => {
    // Input alerts are irrelevant — staleness override always wins per RISK-07.
    expect(pipeline([mkAlert({ severity: "extreme" })], staleHealth, baseTime)).toBe("unknown");
    expect(pipeline([], staleHealth, baseTime)).toBe("unknown");
  });
});
```

**Notes:**

- The test imports both `calculate` and `snapshot` — that is allowed because the depcruise `risk-engine-isolation` rule only applies to `calculate.ts` (production), not test files. ESLint Plan 03 BLOCK B re-allows test files to import freely within `src/lib/risk/`.
- If `applyStaleness`'s signature differs from `(level, health, now)`, the executor adjusts the `pipeline` helper accordingly. The contract (5-level emission across the composition) is what matters.
- This test does NOT replace Plan 09's per-level tests or Plan 10's `applyStaleness` tests — it is an integration gate sitting on top.

Verify: `pnpm test src/lib/risk/pipeline.integration.test.ts`

Done: 5 `it` blocks pass; each of `green | yellow | orange | red | unknown` returned by the composed pipeline at least once.

### Task 13.2 — Run the full acceptance suite

Files: none (read-only verification)

Action: from repo root, run each command and capture output:

```bash
# 1. Type check
pnpm tsc --noEmit

# 2. Lint (catches risk/ violations + general)
pnpm lint

# 3. Dependency-cruiser (RISK-01 isolation + no-node)
pnpm depcruise

# 4. Full test suite + coverage (must be 100/100/100/100 on src/lib/risk/**)
pnpm test:coverage

# 5. Confirm 8 risk modules + sources subtree exist
ls src/lib/risk/types.ts src/lib/risk/calculate.ts src/lib/risk/dedup.ts \
   src/lib/risk/snapshot.ts src/lib/risk/explanation.ts src/lib/risk/vocab.ts \
   src/lib/risk/sources/cemaden.ts src/lib/risk/sources/inmet.ts

# 6. FORMULA_VERSION constant present
grep -n "FORMULA_VERSION" src/lib/risk/snapshot.ts

# 7. depcruise rules exist with expected names
grep -E "risk-engine-isolation|risk-engine-no-node" .dependency-cruiser.cjs

# 8. CI workflow has both new steps (depcruise from Plan 03, test:coverage from Plan 04)
grep -E "depcruise|test:coverage" .github/workflows/ci.yml

# 9. README addendum present + uses HAZARD_KINDS-canonical 'enchente'
grep -n "Como calculamos o risco" README.md
grep -c "Pior: Alerta do INMET + CEMADEN para enchente" README.md   # expect 1

# 10. CRITICAL: src/app/api/ untouched on phase branch
git diff --stat $(git merge-base HEAD main) -- src/app/api/
# Expected output: empty (no lines)

# 11. Sources mapping tables snapshot files exist (Vitest default __snapshots__/)
ls src/lib/risk/sources/__snapshots__/cemaden.test.ts.snap
ls src/lib/risk/sources/__snapshots__/inmet.test.ts.snap

# 12. Composed pipeline integration test (AC-3 closure) ran and passed
pnpm test src/lib/risk/pipeline.integration.test.ts
```

For each command:

- Exit code 0 → ✅ pass
- Non-zero or unexpected output → ❌ fail. Identify the failing acceptance criterion in the INDEX map. Route the executor back to the relevant plan (e.g., coverage gap on `dedup.ts` → re-open Plan 08 to add the missing branch).

Verify: each command above

Done: every command exits 0 (or for command 10, returns no diff lines).

### Task 13.3 — Write `03-13-VERIFY-LOG.md`

Files: `.planning/phases/03-pure-risk-engine/03-13-VERIFY-LOG.md`

Action: capture the actual output of each verification command above into a markdown file. Format:

```markdown
# Phase 3 — Final Verification Log

**Date:** YYYY-MM-DD
**Commit:** {git rev-parse HEAD}
**Branch:** phase-3-risk-engine

## Acceptance gate results

### 1. `pnpm tsc --noEmit`
```

{captured output — should be empty on success}

```
✅ PASS

### 2. `pnpm lint`
```

{captured output}

```
✅ PASS

### 3. `pnpm depcruise`
```

{captured output: "no dependency violations found"}

```
✅ PASS

### 4. `pnpm test:coverage` (truncated to risk/ summary)
```

{capture the coverage summary table — every src/lib/risk/\* file showing 100% lines + branches}

```
✅ PASS — 100/100/100/100 on all risk files

### 5..12. (one section each, mirror the same shape; #12 covers composed pipeline)

## SPEC Acceptance Criteria — final state

| # | Criterion | Status |
|---|---|---|
| 1 | 8 risk modules exist with documented APIs | ✅ |
| 2 | 100% lines + branches in src/lib/risk/** | ✅ |
| 3 | calculateRiskLevel + applyStaleness composed pipeline returns each of 5 RiskLevels | ✅ (Plan 13 integration test) |
| 4 | 24h null-validUntil rule (3 cases) | ✅ |
| 5 | dedupForCalc collapse + non-overlap split + diff-hazard split | ✅ |
| 6 | applyStaleness 4 cases | ✅ |
| 7 | CEMADEN + INMET mapSeverity defaults to moderate | ✅ |
| 8 | generateExplanation 6 PT-BR cases + pluralization + verbatim attribution | ✅ |
| 9 | FORMULA_VERSION === "v0" | ✅ |
| 10 | depcruise CI rule passes | ✅ |
| 11 | Edge runtime smoke compiles + runs | ✅ |
| 12 | StateSnapshotPayload structural superset | ✅ |
| 13 | README has "Como calculamos o risco — v0" with worked example using `enchente` | ✅ |
| 14 | git diff src/app/api/ empty | ✅ |

Phase 3 ready for `/gsd-verify-work`.
```

Verify: file exists, all 14 acceptance items marked ✅. If any ❌, do NOT mark the phase complete — route back to the failing plan.

Done: `03-13-VERIFY-LOG.md` committed; phase verification report ready for the user.

## Verification (plan-wide)

The plan IS the verification. Task 13.1 adds the composed pipeline test; Task 13.2 runs the full gate; Task 13.3 captures the log.

## RISK-IDs covered

All 10 RISK-IDs (acceptance gate). AC-3 in particular is now closed via the composed pipeline integration test.

## Dependencies

All prior plans (01..12).

## Estimated commits

2 (composed pipeline test + verify log).

---

**After Plan 13 ships:**

- Run `/gsd-verify-work` (UAT).
- After UAT pass: phase 3 enters "shipped" state, P4 unblocks.
