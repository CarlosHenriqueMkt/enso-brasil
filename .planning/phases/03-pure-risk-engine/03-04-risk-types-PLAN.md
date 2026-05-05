---
phase: 03-pure-risk-engine
plan: 04
type: execute
wave: 1
depends_on: [01]
files_modified:
  - src/lib/risk/types.ts
  - src/lib/risk/types.type-test.ts
  - .github/workflows/ci.yml
autonomous: true
requirements: [RISK-02, RISK-03, RISK-08]
must_haves:
  truths:
    - "src/lib/risk/types.ts exists and is a TYPE-ONLY module (no runtime const)"
    - "RiskLevel re-exported from @/lib/sources/schema (D-01 single SoT)"
    - "Severity re-exported from @/lib/sources/schema (D-01 single SoT)"
    - "Alert re-exported from @/lib/sources/schema (so calculate.ts honors RISK-01 isolation)"
    - "SourcesHealthRow interface declared with { source_key: string; last_successful_fetch: string | null }"
    - "StateSnapshotPayload type is structural superset of api/schemas StateSnapshot (extends, no removals)"
    - "Type-test file proves Severity assignable to/from Alert['severity'] AND P2 StateSnapshot assignable to StateSnapshotPayload"
    - "CI workflow now invokes pnpm test:coverage (gated until at least one risk file exists — types.ts qualifies)"
  artifacts:
    - path: "src/lib/risk/types.ts"
      provides: "RiskLevel, Severity, Alert, SourcesHealthRow, StateSnapshotPayload types"
      min_lines: 25
    - path: "src/lib/risk/types.type-test.ts"
      provides: "Compile-time assignability tests; no runtime"
    - path: ".github/workflows/ci.yml"
      provides: "Test + coverage CI step (added here, not Plan 03, to avoid empty-include vacuous failure)"
  key_links:
    - from: "src/lib/risk/types.ts"
      to: "src/lib/sources/schema.ts"
      via: "import type { Severity, RiskLevel, Alert } from '@/lib/sources/schema'"
      pattern: "from\\s+['\"]@?/lib/sources/schema['\"]"
    - from: "src/lib/risk/types.ts"
      to: "src/lib/api/schemas.ts"
      via: "import type { StateSnapshot } from '@/lib/api/schemas'"
      pattern: "StateSnapshot"
---

# Plan 04 — Risk types module (RISK-02, RISK-03, RISK-08)

**Goal:** Ship the type contracts every other risk file imports. Pure type-only module — no runtime code, excluded from coverage. Also lands the `pnpm test:coverage` CI step (deferred from Plan 03 to avoid Vitest v8 vacuous-empty-include failure when zero `src/lib/risk/**` files exist).

## Required reading

- `.planning/phases/03-pure-risk-engine/03-SPEC.md` (RISK-02, RISK-03, RISK-08)
- `.planning/phases/03-pure-risk-engine/03-CONTEXT.md` (D-01 step 5; Implementation Notes — `SourcesHealthRow` recommendation)
- `.planning/phases/03-pure-risk-engine/03-RESEARCH.md` (open question 3 — `string | null`)
- `.planning/phases/03-pure-risk-engine/03-PATTERNS.md` (lines 47-65 — types.ts header + re-export pattern)
- `src/lib/sources/schema.ts` (post Plan 01 — exports `SEVERITIES`, `Severity`, `RISK_LEVELS`, `RiskLevel`, `Alert`)
- `src/lib/api/schemas.ts` (`StateSnapshot` / `StateSnapshotSchema` — the additive-superset target)

## Files touched

| Path                              | Change                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `src/lib/risk/types.ts`           | **create**                                                                              |
| `src/lib/risk/types.type-test.ts` | **create** (compile-only; no `*.test.ts` so vitest doesn't run it as a behavioral test) |
| `.github/workflows/ci.yml`        | modify (add `pnpm test:coverage` step — deferred from Plan 03)                          |

## Tasks

### Task 4.1 — Create `src/lib/risk/types.ts`

<files>src/lib/risk/types.ts</files>

<action>
Per PATTERNS lines 47-65 + CONTEXT D-01 step 5 + RESEARCH open Q 3:

```ts
/**
 * ENSO Brasil — Pure risk engine type contracts (RISK-02, RISK-03, RISK-08).
 *
 * RiskLevel: state-level computed output (5 levels incl. unknown).
 * Severity: per-alert input dimension (4 values).
 * Alert: re-exported from sources/schema so calculate.ts can stay isolated
 *   (RISK-01 — depcruise rule allows calculate.ts to import only ./types).
 * SourcesHealthRow: minimal shape consumed by applyStaleness (decoupled from Drizzle).
 * StateSnapshotPayload: structural superset of P2 StateSnapshot (additive-only per RISK-08).
 *
 * Type-only module. Zero runtime exports. Excluded from coverage thresholds.
 */

import type { Severity, RiskLevel, Alert } from "@/lib/sources/schema";
import type { StateSnapshot } from "@/lib/api/schemas";

export type { Severity, RiskLevel };

/** Re-exported so calculate.ts honors the dependency-cruiser isolation rule (RISK-01). */
export type { Alert };

/**
 * Minimal shape for applyStaleness (RISK-07).
 * Decoupled from Drizzle row type to keep src/lib/risk/ free of @/db/* imports.
 * P4 will adapt the Drizzle inferred row to this shape at the wiring layer.
 */
export interface SourcesHealthRow {
  /** Source identifier (e.g., "cemaden", "inmet"). */
  source_key: string;
  /** ISO-8601 datetime string of last successful fetch, or null if never. */
  last_successful_fetch: string | null;
}

/**
 * Snapshot payload written by P4 wiring layer.
 *
 * Structural superset of P2 StateSnapshot (RISK-08 — additive only, no removed/renamed fields).
 * P3 ships the type; P4 imports it and writes to snapshot_cache.
 *
 * `formula_version` is the literal "v0" type to enforce the constant from snapshot.ts.
 * `explanation` is added in P3 to satisfy RISK-09 — UIs consume it as-is.
 */
export interface StateSnapshotPayload extends StateSnapshot {
  /** PT-BR plain-language explanation generated by `generateExplanation`. */
  explanation: string;
}
```

**Notes:**

- File MUST contain zero runtime code (`export type`/`export interface`/`import type` only). v8 coverage skips type-only files cleanly when the include glob matches but no executable lines exist; combined with the explicit exclude in `vitest.config.ts` (Plan 03), this file is safely excluded.
- `import type { ... }` syntax used so this file is fully erased at runtime.
- If `StateSnapshot` is named differently in `api/schemas.ts` (e.g., `z.infer<typeof StateSnapshotSchema>`), substitute accordingly — the executor must read `api/schemas.ts` to confirm the exported type name and adjust the import.
- The `Alert` re-export is included HERE (not deferred to Plan 09) so that the depcruise `risk-engine-isolation` rule passes the moment calculate.ts lands in Wave 3.
  </action>

<verify>
  <automated>pnpm tsc --noEmit && grep -cE "^(import|export) type" src/lib/risk/types.ts</automated>
</verify>

<done>
- `src/lib/risk/types.ts` exists
- All exports are types/interfaces (no `const`, no `function`, no `class`)
- `tsc --noEmit` clean
- `pnpm depcruise` still exits 0 (the file imports only from `@/lib/sources/schema` + `@/lib/api/schemas` — calculate.ts isolation rule doesn't apply to types.ts)
- `Alert` is re-exported (`grep "export type { Alert }" src/lib/risk/types.ts` returns 1 hit)
</done>

### Task 4.2 — Create `src/lib/risk/types.type-test.ts` (compile-only assignability tests)

<files>src/lib/risk/types.type-test.ts</files>

<action>
Per RESEARCH "Don't Hand-Roll" line 261 — type-level test via `tsc --noEmit`:

```ts
/**
 * Compile-time type tests for risk engine contracts.
 *
 * Filename ends `.type-test.ts` (NOT `.test.ts`) so Vitest does not execute it.
 * `tsc --noEmit` covers it as part of the project's type-check.
 *
 * RISK-03 — Severity ↔ Alert.severity bidirectional assignability.
 * RISK-08 — P2 StateSnapshot forward-assignable to StateSnapshotPayload (superset).
 */

import type { Alert } from "@/lib/sources/schema";
import type { StateSnapshot } from "@/lib/api/schemas";
import type { Severity, StateSnapshotPayload } from "./types";

// RISK-03 (a): Severity is assignable to Alert['severity']
const _sevToAlert: Alert["severity"] = "moderate" as Severity;
// RISK-03 (b): Alert['severity'] is assignable to Severity
const _alertToSev: Severity = "low" as Alert["severity"];

// RISK-08: P2 StateSnapshot is forward-assignable to StateSnapshotPayload
// (additive superset — adding `explanation` MUST be the only structural delta)
declare const p2Snap: StateSnapshot;
const _superset: Omit<StateSnapshotPayload, "explanation"> = p2Snap;

// Suppress unused-var warnings (file exists for type-checking only)
void _sevToAlert;
void _alertToSev;
void _superset;
```

Run `pnpm tsc --noEmit`. If any assertion fails, the contract is broken — fix the contract, not the test.
</action>

<verify>
  <automated>pnpm tsc --noEmit && pnpm depcruise</automated>
</verify>

<done>
- `pnpm tsc --noEmit` exits 0 (assignability holds)
- File extension is `.type-test.ts`, not `.test.ts` (Vitest does not pick it up)
- `pnpm depcruise` still green
</done>

### Task 4.3 — Add `pnpm test:coverage` step to `.github/workflows/ci.yml` (deferred from Plan 03)

<files>.github/workflows/ci.yml</files>

<action>
**Why this lives here, not Plan 03:** Vitest v8 coverage with `include: ["src/lib/risk/**/*.ts"]` may fail vacuously when the glob matches zero files (Plan 03 lands before any risk module exists). After Task 4.1 lands `types.ts`, the include glob has at least one match — even though `types.ts` is excluded from thresholds, the v8 reporter no longer warns about empty inputs.

1. Open `.github/workflows/ci.yml`.
2. Locate the existing test step (e.g., `- name: Test\n  run: pnpm test`).
3. Replace with:
   ```yaml
   - name: Test + coverage
     run: pnpm test:coverage
   ```
   (CONTEXT D-03 step 2: "replace or augment" — pick replace because `test:coverage = vitest run --coverage` already runs the suite.)
4. Confirm the depcruise step (added in Plan 03 Task 3.5) is still present and ordered BEFORE this step.
   </action>

<verify>
  <automated>grep -E "test:coverage|depcruise" .github/workflows/ci.yml</automated>
</verify>

<done>
- `pnpm test:coverage` step present in CI workflow
- `pnpm depcruise` step present and ordered earlier
- First push to phase branch surfaces green CI (or, locally: `pnpm test:coverage` exits 0 with `types.ts` excluded from thresholds)
</done>

## Verification (plan-wide)

```bash
pnpm tsc --noEmit
pnpm depcruise
pnpm lint
pnpm test:coverage          # now passes — at least types.ts matches the include glob
ls src/lib/risk/
# expect: types.ts  types.type-test.ts
grep -n "test:coverage" .github/workflows/ci.yml
```

## RISK-IDs covered

- **RISK-02** (RiskLevel re-export — 5 levels)
- **RISK-03** (Severity bidirectional assignability proven by type-test)
- **RISK-08** (StateSnapshotPayload superset proven by type-test)
- **RISK-01** (CI gate completion — coverage step joins depcruise step)

## Dependencies

- Plan 01 (needs `Severity` + `RISK_LEVELS` + `RiskLevel` + `Alert` exports from `src/lib/sources/schema.ts`)
- Plan 03 (CI workflow already has depcruise step + scripts; this plan adds the coverage step on top)

## Estimated commits

3 (Task 4.1 types.ts, Task 4.2 type-test, Task 4.3 CI coverage step).
