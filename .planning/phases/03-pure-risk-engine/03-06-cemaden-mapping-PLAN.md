---
phase: 03-pure-risk-engine
plan: 06
type: execute
wave: 2
depends_on: [04]
files_modified:
  - src/lib/risk/sources/cemaden.ts
  - src/lib/risk/sources/cemaden.test.ts
  - src/lib/risk/sources/__snapshots__/cemaden.test.ts.snap
autonomous: true
requirements: [RISK-04, RISK-10]
must_haves:
  truths:
    - "src/lib/risk/sources/cemaden.ts exports SEVERITY_TABLE (Object.frozen Record<string, Severity>)"
    - "Table covers all CEMADEN terms from risk-formula-v0.md: Observação→low, Atenção→moderate, Alerta→high, Alerta Máximo→extreme"
    - "mapSeverity(raw: string): Severity returns SEVERITY_TABLE[raw] ?? 'moderate' (RISK-04 default)"
    - "Snapshot test of full SEVERITY_TABLE locks the contract"
    - "Unit test asserts default-moderate for unknown input"
    - "100% line + branch coverage of cemaden.ts"
  artifacts:
    - path: "src/lib/risk/sources/cemaden.ts"
      provides: "SEVERITY_TABLE, mapSeverity"
      min_lines: 20
    - path: "src/lib/risk/sources/cemaden.test.ts"
      provides: "Snapshot + default-moderate + each-known-term tests"
  key_links:
    - from: "src/lib/risk/sources/cemaden.ts"
      to: "src/lib/risk/types.ts"
      via: "import type { Severity } from '../types'"
      pattern: "from\\s+['\"]\\.\\./types['\"]"
---

# Plan 06 — CEMADEN severity mapping (RISK-04, RISK-10)

**Goal:** Codify the locked v0.1 CEMADEN severity table from `risk-formula-v0.md`. Default `moderate` for unknown terms (conservative bias).

## Required reading

- `.planning/phases/03-pure-risk-engine/03-SPEC.md` (RISK-04, RISK-10)
- `.planning/phases/03-pure-risk-engine/03-PATTERNS.md` (lines 117-134 — sources/\*.ts pattern with `Object.freeze` + relative `../types` import)
- `risk-formula-v0.md` — CEMADEN section
- `src/lib/risk/types.ts` (post Plan 04 — `Severity` import)
- `src/lib/sources/registry-meta.ts` (analog for `Object.freeze` + typed re-shape)

## Files touched

| Path                                                      | Change                      |
| --------------------------------------------------------- | --------------------------- |
| `src/lib/risk/sources/cemaden.ts`                         | create                      |
| `src/lib/risk/sources/cemaden.test.ts`                    | create                      |
| `src/lib/risk/sources/__snapshots__/cemaden.test.ts.snap` | auto-generated on first run |

## Tasks

### Task 6.1 — Create `src/lib/risk/sources/cemaden.ts`

Files: `src/lib/risk/sources/cemaden.ts`

Action:

```ts
/**
 * ENSO Brasil — CEMADEN severity mapping (RISK-04, RISK-10).
 *
 * Locked v0.1 table from risk-formula-v0.md. Unknown terms default to "moderate"
 * per RISK-04 conservative bias (never silently low).
 */

import type { Severity } from "../types";

export const SEVERITY_TABLE: Readonly<Record<string, Severity>> = Object.freeze({
  Observação: "low",
  Atenção: "moderate",
  Alerta: "high",
  "Alerta Máximo": "extreme",
});

export function mapSeverity(raw: string): Severity {
  return SEVERITY_TABLE[raw] ?? "moderate";
}
```

Critical: diacritics preserved exactly (composed Unicode); UTF-8 encoding required. If `risk-formula-v0.md` lists alternates, do NOT add without bumping the formula version (source-side normalization belongs in P4 adapter).

Verify: `pnpm tsc --noEmit && pnpm lint src/lib/risk/sources/cemaden.ts && pnpm depcruise`

Done: file exists with locked table + mapSeverity; tsc/lint/depcruise green.

### Task 6.2 — Create `src/lib/risk/sources/cemaden.test.ts`

Files: `src/lib/risk/sources/cemaden.test.ts`

Action: per RESEARCH Pattern 7 (file snapshot for tables, inline assertions for fallback):

```ts
import { describe, it, expect } from "vitest";
import { SEVERITY_TABLE, mapSeverity } from "./cemaden";

describe("CEMADEN severity mapping (RISK-04, RISK-10)", () => {
  it("exposes the locked v0.1 SEVERITY_TABLE", () => {
    expect(SEVERITY_TABLE).toMatchSnapshot();
  });

  it("table is frozen", () => {
    expect(Object.isFrozen(SEVERITY_TABLE)).toBe(true);
  });

  it.each([
    ["Observação", "low"],
    ["Atenção", "moderate"],
    ["Alerta", "high"],
    ["Alerta Máximo", "extreme"],
  ] as const)("maps known term %s → %s", (raw, expected) => {
    expect(mapSeverity(raw)).toBe(expected);
  });

  it("falls back to 'moderate' for unknown terms (RISK-04)", () => {
    expect(mapSeverity("Random Term")).toBe("moderate");
    expect(mapSeverity("")).toBe("moderate");
    expect(mapSeverity("ATENÇÃO")).toBe("moderate"); // case-sensitive on purpose
  });
});
```

The case-sensitive assertion locks the contract — adapter is responsible for normalization, not the engine.

Verify: `pnpm test src/lib/risk/sources/cemaden.test.ts`

Done: snapshot file generated under `__snapshots__/cemaden.test.ts.snap`; all assertions pass; coverage of `cemaden.ts` reports 100% lines + branches.

## Verification (plan-wide)

```bash
pnpm test src/lib/risk/sources/cemaden.test.ts
pnpm tsc --noEmit
pnpm lint src/lib/risk/sources
pnpm depcruise
pnpm test:coverage 2>&1 | grep -E "cemaden\\.ts"
# expect 100/100/100/100
```

## RISK-IDs covered

- RISK-04 (default-moderate)
- RISK-10 (CEMADEN table)

## Dependencies

Plan 04 (`Severity` type from `./types`).

## Estimated commits

2.
