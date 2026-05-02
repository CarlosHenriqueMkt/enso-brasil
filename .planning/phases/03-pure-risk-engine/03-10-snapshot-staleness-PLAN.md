---
phase: 03-pure-risk-engine
plan: 10
type: execute
wave: 3
depends_on: [04]
files_modified:
  - src/lib/risk/snapshot.ts
  - src/lib/risk/snapshot.test.ts
autonomous: true
requirements: [RISK-07, RISK-08]
must_haves:
  truths:
    - "src/lib/risk/snapshot.ts exports FORMULA_VERSION = 'v0' as const"
    - "Exports applyStaleness(level, sourcesHealth, now?): RiskLevel"
    - "All sources stale > 1h → 'unknown'"
    - "≥1 source fresh → input level passes through"
    - "Empty health array → 'unknown' (defensive — never silently green)"
    - "Re-exports StateSnapshotPayload from ./types"
    - "100% line + branch coverage"
  artifacts:
    - path: "src/lib/risk/snapshot.ts"
      provides: "FORMULA_VERSION, applyStaleness, StateSnapshotPayload re-export"
      min_lines: 25
    - path: "src/lib/risk/snapshot.test.ts"
      provides: "4 staleness cases + FORMULA_VERSION constant test + type-test for StateSnapshotPayload"
  key_links:
    - from: "src/lib/risk/snapshot.ts"
      to: "src/lib/risk/types.ts"
      via: "import type { RiskLevel, SourcesHealthRow, StateSnapshotPayload } from './types'"
      pattern: "from\\s+['\"]\\./types['\"]"
---

# Plan 10 — snapshot.ts: FORMULA_VERSION + applyStaleness (RISK-07, RISK-08)

**Goal:** The override that turns `calculateRiskLevel` output into `unknown` when sources go cold. Plus the locked `FORMULA_VERSION = "v0"` const that P4 will write into `snapshot_cache.formula_version`.

## Required reading

- `.planning/phases/03-pure-risk-engine/03-SPEC.md` (RISK-07, RISK-08)
- `.planning/phases/03-pure-risk-engine/03-CONTEXT.md` (D-01 step 5; Implementation Notes — `SourcesHealthRow` shape)
- `.planning/phases/03-pure-risk-engine/03-PATTERNS.md` (lines 88-96 — snapshot.ts analogs)
- `src/lib/risk/types.ts` (post Plan 04 — `SourcesHealthRow`, `RiskLevel`, `StateSnapshotPayload`)
- `src/lib/api/schemas.ts` (`StateSnapshot` shape — for type-test)

## Files touched

| Path                            | Change |
| ------------------------------- | ------ |
| `src/lib/risk/snapshot.ts`      | create |
| `src/lib/risk/snapshot.test.ts` | create |

## Tasks

### Task 10.1 — Create `src/lib/risk/snapshot.ts`

Files: `src/lib/risk/snapshot.ts`

Action:

```ts
/**
 * ENSO Brasil — Snapshot helpers (RISK-07, RISK-08).
 *
 * Behavior:
 *  - FORMULA_VERSION: literal "v0" — written to snapshot_cache.formula_version by P4.
 *  - applyStaleness: turns calculateRiskLevel output into "unknown" when all
 *    integrated sources have gone stale (>1h since last successful fetch),
 *    OR when the sources_health array is empty (defensive — never silently green).
 *
 * Pure / edge-safe. now arg is injectable.
 */

import type { RiskLevel, SourcesHealthRow, StateSnapshotPayload } from "./types";

/** Locked engine formula version (RISK-08). P4 writes this to snapshot_cache.formula_version. */
export const FORMULA_VERSION = "v0" as const;

/** Re-export so consumers get the payload type from one place. */
export type { StateSnapshotPayload };

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Apply source-staleness override (RISK-07).
 *
 *  - Empty sourcesHealth array       → "unknown" (defensive)
 *  - All sources stale > 1h          → "unknown"
 *  - ≥1 source fresh (≤1h)           → input level (pass-through)
 *
 * A source is "stale" iff last_successful_fetch is null OR older than now - 1h.
 */
export function applyStaleness(
  level: RiskLevel,
  sourcesHealth: readonly SourcesHealthRow[],
  now: Date = new Date(),
): RiskLevel {
  if (sourcesHealth.length === 0) return "unknown";

  const cutoff = now.getTime() - ONE_HOUR_MS;
  const anyFresh = sourcesHealth.some((row) => {
    if (!row.last_successful_fetch) return false;
    return new Date(row.last_successful_fetch).getTime() >= cutoff;
  });

  return anyFresh ? level : "unknown";
}
```

Notes:

- `as const` literal for `FORMULA_VERSION` so its type is the string literal `"v0"` (not `string`) — feeds the type-test for `StateSnapshotPayload`.
- Re-exporting `StateSnapshotPayload` here is convenience, not requirement; consumers may import directly from `./types`.

Verify: `pnpm tsc --noEmit && pnpm lint src/lib/risk/snapshot.ts && pnpm depcruise`

Done: file exports `FORMULA_VERSION`, `applyStaleness`; tsc/lint/depcruise green.

### Task 10.2 — Create `src/lib/risk/snapshot.test.ts`

Files: `src/lib/risk/snapshot.test.ts`

Action: per SPEC RISK-07 4 cases + RISK-08 constant assertion + type-test:

```ts
import { describe, it, expect, expectTypeOf } from "vitest";
import { FORMULA_VERSION, applyStaleness } from "./snapshot";
import type { SourcesHealthRow, StateSnapshotPayload } from "./types";
import type { StateSnapshot } from "@/lib/api/schemas";

const now = new Date("2026-05-02T12:00:00Z");
const iso = (offsetMin: number) => new Date(now.getTime() + offsetMin * 60_000).toISOString();

const fresh: SourcesHealthRow = {
  source_key: "cemaden",
  last_successful_fetch: iso(-30), // 30 min ago = fresh
};
const stale: SourcesHealthRow = {
  source_key: "inmet",
  last_successful_fetch: iso(-90), // 90 min ago = stale
};
const never: SourcesHealthRow = {
  source_key: "stub",
  last_successful_fetch: null,
};

describe("FORMULA_VERSION (RISK-08)", () => {
  it("equals 'v0' as const", () => {
    expect(FORMULA_VERSION).toBe("v0");
    expectTypeOf(FORMULA_VERSION).toEqualTypeOf<"v0">();
  });
});

describe("applyStaleness (RISK-07)", () => {
  it("(a) all sources fresh → input level passes through", () => {
    expect(applyStaleness("orange", [fresh, fresh], now)).toBe("orange");
    expect(applyStaleness("red", [fresh], now)).toBe("red");
    expect(applyStaleness("green", [fresh], now)).toBe("green");
  });

  it("(b) all sources stale > 1h → 'unknown'", () => {
    expect(applyStaleness("red", [stale, stale], now)).toBe("unknown");
    expect(applyStaleness("orange", [stale, never], now)).toBe("unknown");
  });

  it("(c) one fresh + others stale → input level (≥1 source current)", () => {
    expect(applyStaleness("orange", [fresh, stale, never], now)).toBe("orange");
  });

  it("(d) empty sources array → 'unknown' (defensive)", () => {
    expect(applyStaleness("red", [], now)).toBe("unknown");
    expect(applyStaleness("green", [], now)).toBe("unknown");
  });

  it("does not mutate sourcesHealth input", () => {
    const input: SourcesHealthRow[] = [fresh, stale];
    const snapshot = JSON.stringify(input);
    applyStaleness("red", input, now);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("now defaults to new Date()", () => {
    expect(() => applyStaleness("green", [fresh])).not.toThrow();
  });

  it("source with last_successful_fetch=null is treated as stale", () => {
    expect(applyStaleness("red", [never], now)).toBe("unknown");
  });
});

describe("StateSnapshotPayload type (RISK-08)", () => {
  it("is structural superset of P2 StateSnapshot", () => {
    // Compile-time only (run-time no-op).
    expectTypeOf<Omit<StateSnapshotPayload, "explanation">>().toMatchTypeOf<StateSnapshot>();
  });
});
```

Verify: `pnpm test src/lib/risk/snapshot.test.ts`

Done: all `it` blocks pass; coverage 100/100/100/100 for snapshot.ts; type-test compiles.

## Verification (plan-wide)

```bash
pnpm test src/lib/risk/snapshot.test.ts
pnpm tsc --noEmit
pnpm lint src/lib/risk
pnpm depcruise
pnpm test:coverage 2>&1 | grep -E "snapshot\\.ts"
```

## RISK-IDs covered

- RISK-07 (staleness override — 4 cases)
- RISK-08 (FORMULA_VERSION + StateSnapshotPayload superset)

## Dependencies

Plan 04 (`SourcesHealthRow`, `RiskLevel`, `StateSnapshotPayload` from `./types`).

## Estimated commits

2.
