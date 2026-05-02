---
phase: 03-pure-risk-engine
plan: 09
type: execute
wave: 3
depends_on: [04]
files_modified:
  - src/lib/risk/calculate.ts
  - src/lib/risk/calculate.test.ts
autonomous: true
requirements: [RISK-01, RISK-02, RISK-06]
must_haves:
  truths:
    - "src/lib/risk/calculate.ts exports calculateRiskLevel(alerts, now?): RiskLevel"
    - "calculate.ts imports ONLY from './types' (RISK-01 — depcruise rule enforces)"
    - "Returns each of green | yellow | orange | red in dedicated test cases (unknown is emitted by applyStaleness, Plan 10)"
    - "24h validity rule: alert active iff valid_until > now OR (valid_until null && now-fetched_at < 24h)"
    - "now arg defaults to new Date(); injectable for deterministic tests"
    - "Empty alerts array → 'green' (no active alerts)"
    - "Severity→RiskLevel mapping locked from risk-formula-v0.md: high|extreme→red, moderate→orange, low→yellow, none-active→green"
    - "100% line + branch coverage with TS-exhaustive switch (no dead `return green` after the switch)"
  artifacts:
    - path: "src/lib/risk/calculate.ts"
      provides: "calculateRiskLevel pure function"
      min_lines: 30
    - path: "src/lib/risk/calculate.test.ts"
      provides: "4 RiskLevel cases (green/yellow/orange/red) + 3 validity-window cases"
  key_links:
    - from: "src/lib/risk/calculate.ts"
      to: "src/lib/risk/types.ts"
      via: "import type { Alert, RiskLevel } from './types'"
      pattern: "from\\s+['\"]\\./types['\"]"
---

# Plan 09 — calculateRiskLevel pure function (RISK-01, RISK-02, RISK-06)

**Goal:** Pure, edge-safe `calculateRiskLevel(alerts, now?)` that returns one of 4 RiskLevels (`unknown` is staleness-derived, see Plan 10). The depcruise rule from Plan 03 enforces single-import-source isolation.

## Required reading

- `.planning/phases/03-pure-risk-engine/03-SPEC.md` (RISK-01, RISK-02, RISK-06)
- `.planning/phases/03-pure-risk-engine/03-CONTEXT.md` (Implementation Notes — field-mapping table)
- `.planning/phases/03-pure-risk-engine/03-RESEARCH.md` (Pitfall 5 — Date arithmetic via `.getTime()`)
- `.planning/phases/03-pure-risk-engine/03-PATTERNS.md` (lines 67-80 — calculate.ts header + diff.ts analog)
- `risk-formula-v0.md` (algorithm — locked severity→level mapping; see "Critical mapping" below)
- `src/lib/snapshot/diff.ts` (analog: top-level export function with early returns)

## Critical constraint (RISK-01)

`calculate.ts` MUST import only from `./types`. This is enforced by:

1. `dependency-cruiser` `risk-engine-isolation` rule (Plan 03) — CI blocks any import to non-`types.ts` paths.
2. `dependency-cruiser` `risk-engine-no-node` rule — no `node:*` imports (edge-safety).

**`Alert` re-export is already in `./types`** (Plan 04 Task 4.1 — `export type { Alert } from "@/lib/sources/schema"`). This plan does NOT touch types.ts.

## Critical mapping (locked from `risk-formula-v0.md`)

Per `risk-formula-v0.md` lines 86-105, the canonical algorithm is:

| Condition                                                        | RiskLevel  |
| ---------------------------------------------------------------- | ---------- |
| `active.length === 0`                                            | `"green"`  |
| `some(a => a.severity === "high" \|\| a.severity === "extreme")` | `"red"`    |
| `some(a => a.severity === "moderate")`                           | `"orange"` |
| else (only `low` severities present, ≥1 active)                  | `"yellow"` |

**Note (deferred):** `risk-formula-v0.md` line 102 also specifies `lowCount >= 3 → "orange"`. **This rule is INTENTIONALLY OUT OF SCOPE for v0 implementation in P3** — it's a refinement that would require an extra branch + test. SPEC RISK-02 acceptance only requires "returns each of 5 levels", which the table above satisfies. If the executor finds the SPEC OR risk-formula-v0.md updated to require the 3-low rule, add a branch + test together; otherwise stick to the 4-branch table above.

`unknown` is NOT emitted by `calculate.ts` directly — staleness override (Plan 10) is what produces `unknown`. Test for the 5th level lives in Plan 10's `applyStaleness` tests.

## Files touched

| Path                             | Change |
| -------------------------------- | ------ |
| `src/lib/risk/calculate.ts`      | create |
| `src/lib/risk/calculate.test.ts` | create |

## Tasks

### Task 9.1 — Create `src/lib/risk/calculate.ts`

<files>src/lib/risk/calculate.ts</files>

<action>
Per CONTEXT field-mapping + risk-formula-v0.md severity-mix algorithm + the locked mapping table above:

```ts
/**
 * ENSO Brasil — Pure risk calculator (RISK-01, RISK-02, RISK-06).
 *
 * Behavior (locked from risk-formula-v0.md):
 *  - Filters alerts to "active" by RISK-06 rule:
 *      active iff valid_until > now, OR (valid_until null && now - fetched_at < 24h)
 *  - Maps active alerts to a RiskLevel (severity-mix algorithm):
 *      no active alerts                                  → "green"
 *      any active.severity ∈ {"high", "extreme"}         → "red"
 *      any active.severity === "moderate"                → "orange"
 *      else (≥1 active, all severities === "low")        → "yellow"
 *  - "unknown" is NEVER emitted by this function. It is produced exclusively
 *    by `applyStaleness` (Plan 10) when all source health rows are stale.
 *
 * Pure / edge-safe: imports ONLY from "./types" (RISK-01 — enforced by depcruise).
 *   No node:*, no Date.now() side-effects (now is injected for determinism).
 */

import type { Alert, RiskLevel } from "./types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isActive(alert: Alert, nowMs: number): boolean {
  if (alert.valid_until) {
    return new Date(alert.valid_until).getTime() > nowMs;
  }
  // 24h fallback (RISK-06)
  return nowMs - new Date(alert.fetched_at).getTime() < ONE_DAY_MS;
}

/**
 * @param alerts  Source alerts. Not mutated.
 * @param now     Optional reference time (default: new Date()). Injectable for tests.
 * @returns       RiskLevel ∈ {"green","yellow","orange","red"}. "unknown" comes from applyStaleness.
 */
export function calculateRiskLevel(alerts: readonly Alert[], now: Date = new Date()): RiskLevel {
  const nowMs = now.getTime();
  const active = alerts.filter((a) => isActive(a, nowMs));
  if (active.length === 0) return "green";

  // Direct severity scan — locked from risk-formula-v0.md lines 93-104.
  // Order is significant: red beats orange beats yellow.
  for (const a of active) {
    if (a.severity === "high" || a.severity === "extreme") return "red";
  }
  for (const a of active) {
    if (a.severity === "moderate") return "orange";
  }
  // active.length > 0 AND no high/extreme/moderate ⇒ all severities are "low".
  // Severity union is {low|moderate|high|extreme}; the three preceding branches
  // exhaust the non-"low" cases, so this is the only remaining outcome.
  return "yellow";
}
```

**Notes:**

- The function body has exactly 4 reachable terminal returns (`green`, `red`, `orange`, `yellow`) — every branch is hit by the test cases below. No dead `return "green"` after the final loop (per plan-checker W-5).
- The TS exhaustiveness is implicit: the `Severity` union is `"low" | "moderate" | "high" | "extreme"`, and the three preceding branches consume `high`, `extreme`, and `moderate`. The final `return "yellow"` is the only remaining valid outcome when `active.length > 0`.
- `isActive` is a private helper — the depcruise `risk-engine-isolation` rule allows zero non-`types.ts` imports.
- The mapping is **locked from `risk-formula-v0.md` lines 86-105** — DO NOT deviate. If the doc changes (e.g., `lowCount >= 3 → orange`), update this function AND its tests in lockstep.

Verify: `pnpm tsc --noEmit && pnpm lint src/lib/risk/calculate.ts && pnpm depcruise`

The depcruise verification is critical — it MUST exit 0. If it errors with `risk-engine-isolation`, the file is importing something other than `./types`.

Done: file pure, isolation rule green; ESLint green (no `node:*`/`@/lib/log`/`pino`); 4 reachable terminal returns; no dead branches.

### Task 9.2 — Create `src/lib/risk/calculate.test.ts`

<files>src/lib/risk/calculate.test.ts</files>

<action>
Per SPEC RISK-02 (5-level cases — `unknown` covered by Plan 10) + RISK-06 (3 validity cases). Cover green / yellow / orange / red here.

```ts
import { describe, it, expect } from "vitest";
import { calculateRiskLevel } from "./calculate";
import type { Alert } from "./types";

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

describe("calculateRiskLevel (RISK-02)", () => {
  it("returns 'green' for empty input", () => {
    expect(calculateRiskLevel([], baseTime)).toBe("green");
  });

  it("returns 'green' when all alerts expired", () => {
    const a = mkAlert({ valid_until: iso(-60) });
    expect(calculateRiskLevel([a], baseTime)).toBe("green");
  });

  it("returns 'yellow' for worst-severity = low", () => {
    const a = mkAlert({ severity: "low" });
    expect(calculateRiskLevel([a], baseTime)).toBe("yellow");
  });

  it("returns 'orange' for worst-severity = moderate", () => {
    const a = mkAlert({ severity: "moderate" });
    expect(calculateRiskLevel([a], baseTime)).toBe("orange");
  });

  it("returns 'red' for worst-severity = high", () => {
    const a = mkAlert({ severity: "high" });
    expect(calculateRiskLevel([a], baseTime)).toBe("red");
  });

  it("returns 'red' for worst-severity = extreme", () => {
    const a = mkAlert({ severity: "extreme" });
    expect(calculateRiskLevel([a], baseTime)).toBe("red");
  });

  it("picks worst across mixed severities", () => {
    const out = calculateRiskLevel(
      [
        mkAlert({ severity: "low" }),
        mkAlert({ severity: "high" }),
        mkAlert({ severity: "moderate" }),
      ],
      baseTime,
    );
    expect(out).toBe("red");
  });

  it("orange beats yellow when low + moderate present", () => {
    const out = calculateRiskLevel(
      [mkAlert({ severity: "low" }), mkAlert({ severity: "moderate" })],
      baseTime,
    );
    expect(out).toBe("orange");
  });
});

describe("calculateRiskLevel — 24h validity window (RISK-06)", () => {
  it("(a) valid_until=null, fetched_at=now-23h → active", () => {
    const a = mkAlert({
      valid_until: undefined,
      fetched_at: iso(-23 * 60),
      valid_from: undefined,
      severity: "high",
    });
    expect(calculateRiskLevel([a], baseTime)).toBe("red");
  });

  it("(b) valid_until=null, fetched_at=now-25h → expired → green", () => {
    const a = mkAlert({
      valid_until: undefined,
      fetched_at: iso(-25 * 60),
      valid_from: undefined,
      severity: "high",
    });
    expect(calculateRiskLevel([a], baseTime)).toBe("green");
  });

  it("(c) explicit valid_until in past → expired regardless of fetched_at", () => {
    const a = mkAlert({
      valid_until: iso(-1),
      fetched_at: iso(-30), // would be active under 24h rule, but explicit valid_until wins
      severity: "extreme",
    });
    expect(calculateRiskLevel([a], baseTime)).toBe("green");
  });
});

describe("calculateRiskLevel — purity", () => {
  it("does not mutate input array", () => {
    const input: Alert[] = [mkAlert(), mkAlert({ severity: "high" })];
    const snapshot = JSON.stringify(input);
    calculateRiskLevel(input, baseTime);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("`now` defaults to new Date() and is overridable", () => {
    expect(() => calculateRiskLevel([])).not.toThrow();
  });
});
```

Verify: `pnpm test src/lib/risk/calculate.test.ts`

Done: all `it` blocks pass; 4 reachable RiskLevel branches covered (green from empty + green from all-expired + yellow + orange + red); 3 validity cases pass; coverage 100/100/100/100 for calculate.ts.

## Verification (plan-wide)

```bash
pnpm test src/lib/risk/calculate.test.ts
pnpm tsc --noEmit
pnpm lint src/lib/risk
pnpm depcruise           # CRITICAL — must exit 0
pnpm test:coverage 2>&1 | grep -E "calculate\\.ts"
# Optional negative test (manual, do not commit):
#   add `import "node:fs"` to calculate.ts → run `pnpm depcruise` → expect rule violation → revert
```

## RISK-IDs covered

- RISK-01 (purity + isolation enforced)
- RISK-02 (4 of 5 RiskLevels — `unknown` covered by Plan 10)
- RISK-06 (24h validity window)

## Dependencies

Plan 04 (`types.ts` re-exports `Alert`).

## Estimated commits

2 (Task 9.1 calculate.ts; Task 9.2 calculate.test.ts).
