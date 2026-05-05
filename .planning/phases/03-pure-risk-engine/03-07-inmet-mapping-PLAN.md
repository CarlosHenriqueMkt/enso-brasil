---
phase: 03-pure-risk-engine
plan: 07
type: execute
wave: 2
depends_on: [04]
files_modified:
  - src/lib/risk/sources/inmet.ts
  - src/lib/risk/sources/inmet.test.ts
  - src/lib/risk/sources/__snapshots__/inmet.test.ts.snap
autonomous: true
requirements: [RISK-04, RISK-10]
must_haves:
  truths:
    - "src/lib/risk/sources/inmet.ts exports SEVERITY_TABLE covering CAP severity values + PT-BR aliases"
    - "CAP English values: Minor→low, Moderate→moderate, Severe→high, Extreme→extreme"
    - "PT-BR aliases: Aviso→moderate, Aviso de Perigo→high, Perigo→high, Perigo Potencial→moderate, Grande Perigo→extreme (per risk-formula-v0.md)"
    - "mapSeverity returns 'moderate' for unknown terms (RISK-04)"
    - "Snapshot test locks table; case-sensitive lookup proven"
    - "100% line + branch coverage"
  artifacts:
    - path: "src/lib/risk/sources/inmet.ts"
      provides: "SEVERITY_TABLE, mapSeverity"
      min_lines: 25
    - path: "src/lib/risk/sources/inmet.test.ts"
      provides: "Snapshot + default-moderate + per-known-term assertions"
  key_links:
    - from: "src/lib/risk/sources/inmet.ts"
      to: "src/lib/risk/types.ts"
      via: "import type { Severity } from '../types'"
      pattern: "from\\s+['\"]\\.\\./types['\"]"
---

# Plan 07 — INMET severity mapping (RISK-04, RISK-10)

**Goal:** Codify INMET CAP severity values + PT-BR aliases per `risk-formula-v0.md`. Same default-`moderate` bias as Plan 06.

## Required reading

- `.planning/phases/03-pure-risk-engine/03-SPEC.md` (RISK-04, RISK-10)
- `.planning/phases/03-pure-risk-engine/03-PATTERNS.md` (lines 117-134)
- `risk-formula-v0.md` — INMET section (CAP + PT-BR alias table)
- `src/lib/risk/types.ts` (post Plan 04)
- `src/lib/risk/sources/cemaden.ts` (post Plan 06 — same shape)

## Files touched

| Path                                                    | Change         |
| ------------------------------------------------------- | -------------- |
| `src/lib/risk/sources/inmet.ts`                         | create         |
| `src/lib/risk/sources/inmet.test.ts`                    | create         |
| `src/lib/risk/sources/__snapshots__/inmet.test.ts.snap` | auto-generated |

## Tasks

### Task 7.1 — Create `src/lib/risk/sources/inmet.ts`

Files: `src/lib/risk/sources/inmet.ts`

Action: read `risk-formula-v0.md` INMET section verbatim and transcribe both CAP and PT-BR alias entries. The locked v0.1 table:

```ts
/**
 * ENSO Brasil — INMET severity mapping (RISK-04, RISK-10).
 *
 * Locked v0.1 table from risk-formula-v0.md. Covers:
 *   - CAP standard severity values (Minor / Moderate / Severe / Extreme)
 *   - PT-BR INMET aliases (Aviso, Perigo, Grande Perigo, etc.)
 *
 * Unknown terms default to "moderate" per RISK-04.
 */

import type { Severity } from "../types";

export const SEVERITY_TABLE: Readonly<Record<string, Severity>> = Object.freeze({
  // CAP English (verbatim case)
  Minor: "low",
  Moderate: "moderate",
  Severe: "high",
  Extreme: "extreme",

  // INMET PT-BR aliases (verbatim from risk-formula-v0.md)
  Aviso: "moderate",
  "Aviso de Perigo": "high",
  Perigo: "high",
  "Perigo Potencial": "moderate",
  "Grande Perigo": "extreme",
});

export function mapSeverity(raw: string): Severity {
  return SEVERITY_TABLE[raw] ?? "moderate";
}
```

If `risk-formula-v0.md` shows different aliases or omits some — transcribe verbatim from the doc, not from this plan. Treat the doc as authoritative; this plan only lists the expected mapping.

Verify: `pnpm tsc --noEmit && pnpm lint src/lib/risk/sources/inmet.ts && pnpm depcruise`

Done: file exists with full locked table; tsc/lint/depcruise green.

### Task 7.2 — Create `src/lib/risk/sources/inmet.test.ts`

Files: `src/lib/risk/sources/inmet.test.ts`

Action: mirror Plan 06's test structure with INMET-specific assertions:

```ts
import { describe, it, expect } from "vitest";
import { SEVERITY_TABLE, mapSeverity } from "./inmet";

describe("INMET severity mapping (RISK-04, RISK-10)", () => {
  it("exposes the locked v0.1 SEVERITY_TABLE", () => {
    expect(SEVERITY_TABLE).toMatchSnapshot();
  });

  it("table is frozen", () => {
    expect(Object.isFrozen(SEVERITY_TABLE)).toBe(true);
  });

  describe("CAP standard values (English)", () => {
    it.each([
      ["Minor", "low"],
      ["Moderate", "moderate"],
      ["Severe", "high"],
      ["Extreme", "extreme"],
    ] as const)("maps %s → %s", (raw, expected) => {
      expect(mapSeverity(raw)).toBe(expected);
    });
  });

  describe("PT-BR INMET aliases", () => {
    it.each([
      ["Aviso", "moderate"],
      ["Aviso de Perigo", "high"],
      ["Perigo", "high"],
      ["Perigo Potencial", "moderate"],
      ["Grande Perigo", "extreme"],
    ] as const)("maps %s → %s", (raw, expected) => {
      expect(mapSeverity(raw)).toBe(expected);
    });
  });

  it("falls back to 'moderate' for unknown terms (RISK-04)", () => {
    expect(mapSeverity("Random Term")).toBe("moderate");
    expect(mapSeverity("")).toBe("moderate");
    expect(mapSeverity("MINOR")).toBe("moderate"); // case-sensitive
    expect(mapSeverity("aviso")).toBe("moderate"); // case-sensitive
  });
});
```

If Plan 07 Task 7.1 finalized different aliases than listed here (because doc differed), update the `it.each` rows to match what's exported — single SoT is the file under test.

Verify: `pnpm test src/lib/risk/sources/inmet.test.ts`

Done: all assertions pass; snapshot generated; coverage 100/100/100/100 for inmet.ts.

## Verification (plan-wide)

```bash
pnpm test src/lib/risk/sources/inmet.test.ts
pnpm tsc --noEmit
pnpm lint src/lib/risk/sources
pnpm depcruise
pnpm test:coverage 2>&1 | grep -E "inmet\\.ts"
```

## RISK-IDs covered

- RISK-04
- RISK-10

## Dependencies

Plan 04. Independent of Plan 06 (different file).

## Estimated commits

2.
