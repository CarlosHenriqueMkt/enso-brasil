---
phase: 03-pure-risk-engine
plan: 08
type: execute
wave: 3
depends_on: [04]
files_modified:
  - src/lib/risk/dedup.ts
  - src/lib/risk/dedup.test.ts
autonomous: true
requirements: [RISK-05]
must_haves:
  truths:
    - "src/lib/risk/dedup.ts exports SEVERITY_RANK = { extreme:4, high:3, moderate:2, low:1 }"
    - "Exports compareWorst(a, b): number — sev desc, then fetched_at desc, then source_key asc"
    - "Exports dedupForCalc(alerts): { survivor: Alert; attribution: Alert[] }[]"
    - "Dedup groups by (hazard_kind, state_uf) when validity windows overlap"
    - "Survivor selection uses compareWorst (D-04)"
    - "Non-overlap or different-hazard alerts retained as separate groups"
    - "Original input array NOT mutated (sort on copies)"
    - "Tie-break determinism proven across 100 shuffles"
    - "100% line + branch coverage"
  artifacts:
    - path: "src/lib/risk/dedup.ts"
      provides: "SEVERITY_RANK, compareWorst, dedupForCalc"
      min_lines: 50
    - path: "src/lib/risk/dedup.test.ts"
      provides: "RISK-05 cases (a/b/c) + D-04 tie-break cases (sev tie / fetched_at tie / source_key tie / shuffle determinism)"
  key_links:
    - from: "src/lib/risk/dedup.ts"
      to: "src/lib/risk/types.ts"
      via: "import type { Severity } from './types' + import type { Alert } from '@/lib/sources/schema'"
      pattern: "from\\s+['\"]\\.\\./?types['\"]"
---

# Plan 08 — Dedup + worst-alert comparator (RISK-05, D-04)

**Goal:** Pure dedup with deterministic tie-break. Dedup result feeds both `calculate.ts` (Plan 09) and `explanation.ts` (Plan 11).

## Required reading

- `.planning/phases/03-pure-risk-engine/03-SPEC.md` (RISK-05)
- `.planning/phases/03-pure-risk-engine/03-CONTEXT.md` (D-04 — full procedure with code)
- `.planning/phases/03-pure-risk-engine/03-RESEARCH.md` (lines 379-393 — V8 sort stability + comparator)
- `.planning/phases/03-pure-risk-engine/03-PATTERNS.md` (lines 81-86 — `diff.ts` Map-grouping idiom)
- `src/lib/snapshot/diff.ts` (analog: pure transform with Map grouping)
- `src/lib/snapshot/diff.test.ts` (analog: fixture builder + describe blocks)
- `src/lib/sources/schema.ts` (Alert shape; field names — `hazard_kind`, `state_uf`, `severity`, `fetched_at`, `valid_from?`, `valid_until?`, `source_key`)

## Files touched

| Path                         | Change |
| ---------------------------- | ------ |
| `src/lib/risk/dedup.ts`      | create |
| `src/lib/risk/dedup.test.ts` | create |

## Tasks

### Task 8.1 — Create `src/lib/risk/dedup.ts`

Files: `src/lib/risk/dedup.ts`

Action: per CONTEXT D-04 + PATTERNS line 84:

```ts
/**
 * ENSO Brasil — Dedup + worst-alert comparator (RISK-05, D-04).
 *
 * Behavior:
 *  - Group alerts by (hazard_kind, state_uf) tuple.
 *  - Within a group, collapse alerts whose validity windows overlap.
 *  - Survivor = `compareWorst` winner (severity desc → fetched_at desc → source_key asc).
 *  - Non-survivors retained on `attribution[]` so explanation can render multi-source.
 *  - Non-overlap or different-hazard alerts produce separate output groups.
 *  - Pure: input array NOT mutated; all sorts on copies.
 */

import type { Alert } from "@/lib/sources/schema";
import type { Severity } from "./types";

export const SEVERITY_RANK: Readonly<Record<Severity, number>> = Object.freeze({
  extreme: 4,
  high: 3,
  moderate: 2,
  low: 1,
});

/**
 * Compare two Alerts by "worst-first" precedence (D-04).
 * Higher severity → first. Tie → newer fetched_at first. Tie → source_key asc.
 */
export function compareWorst(a: Alert, b: Alert): number {
  const dr = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  if (dr !== 0) return dr;
  const dt = new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime();
  if (dt !== 0) return dt;
  return a.source_key.localeCompare(b.source_key);
}

export interface DedupGroup {
  /** Worst alert in the group (drives RiskLevel + explanation prose). */
  survivor: Alert;
  /** All alerts that contributed to this group, including the survivor. Order: compareWorst. */
  attribution: Alert[];
}

/**
 * Returns one DedupGroup per (hazard_kind, state_uf) cluster of overlapping alerts.
 * Non-overlapping alerts in the same hazard+state cluster split into separate groups.
 */
export function dedupForCalc(alerts: readonly Alert[]): DedupGroup[] {
  // Group by (hazard_kind, state_uf)
  const buckets = new Map<string, Alert[]>();
  for (const a of alerts) {
    const key = `${a.hazard_kind}|${a.state_uf}`;
    const arr = buckets.get(key);
    if (arr) arr.push(a);
    else buckets.set(key, [a]);
  }

  const groups: DedupGroup[] = [];
  for (const bucket of buckets.values()) {
    // Sort by fetched_at asc to make overlap-merge deterministic
    const sorted = [...bucket].sort(
      (a, b) => new Date(a.fetched_at).getTime() - new Date(b.fetched_at).getTime(),
    );

    // Build overlap clusters: for each alert, find an existing cluster whose union-window overlaps.
    type Cluster = { start: number; end: number; alerts: Alert[] };
    const clusters: Cluster[] = [];
    for (const a of sorted) {
      const start = new Date(a.valid_from ?? a.fetched_at).getTime();
      const end = a.valid_until
        ? new Date(a.valid_until).getTime()
        : new Date(a.fetched_at).getTime() + 24 * 3600 * 1000;
      const hit = clusters.find((c) => start <= c.end && end >= c.start);
      if (hit) {
        hit.start = Math.min(hit.start, start);
        hit.end = Math.max(hit.end, end);
        hit.alerts.push(a);
      } else {
        clusters.push({ start, end, alerts: [a] });
      }
    }

    for (const c of clusters) {
      const ranked = [...c.alerts].sort(compareWorst);
      groups.push({ survivor: ranked[0]!, attribution: ranked });
    }
  }

  return groups;
}
```

Notes:

- `valid_from ?? fetched_at` start; `valid_until ?? fetched_at + 24h` end (RISK-06 24h fallback). Same window definition used in `calculate.ts` (Plan 09) — keep both in sync.
- `compareWorst` is exported so explanation.ts (Plan 11) can pick the "Pior" alert for prose without re-implementing.
- No `import type { ... } from "@/lib/messages"` — engine stays string-free.

Verify: `pnpm tsc --noEmit && pnpm lint src/lib/risk/dedup.ts && pnpm depcruise`

Done: file exports `SEVERITY_RANK`, `compareWorst`, `dedupForCalc`, `DedupGroup`; tsc/lint/depcruise green.

### Task 8.2 — Create `src/lib/risk/dedup.test.ts`

Files: `src/lib/risk/dedup.test.ts`

Action: per PATTERNS line 213 (test fixture builder) + SPEC RISK-05 cases (a/b/c) + D-04 acceptance:

```ts
import { describe, it, expect } from "vitest";
import { dedupForCalc, compareWorst, SEVERITY_RANK } from "./dedup";
import type { Alert } from "@/lib/sources/schema";

const baseTime = new Date("2026-05-02T12:00:00Z").getTime();
const iso = (offsetMin: number) => new Date(baseTime + offsetMin * 60_000).toISOString();

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

describe("dedupForCalc (RISK-05)", () => {
  it("(a) two CEMADEN+INMET alerts same hazard+state, overlapping window → 1 group; highest severity survives", () => {
    const c = mkAlert({ source_key: "cemaden", severity: "moderate", fetched_at: iso(0) });
    const i = mkAlert({
      source_key: "inmet",
      severity: "high",
      fetched_at: iso(10),
      valid_from: iso(30),
      valid_until: iso(120),
    });
    const out = dedupForCalc([c, i]);
    expect(out).toHaveLength(1);
    expect(out[0]!.survivor.source_key).toBe("inmet");
    expect(out[0]!.survivor.severity).toBe("high");
    expect(out[0]!.attribution).toHaveLength(2);
  });

  it("(b) two same-hazard alerts, NON-overlapping windows → 2 groups", () => {
    const a = mkAlert({ valid_from: iso(0), valid_until: iso(30) });
    const b = mkAlert({ valid_from: iso(120), valid_until: iso(180), fetched_at: iso(120) });
    const out = dedupForCalc([a, b]);
    expect(out).toHaveLength(2);
  });

  it("(c) different hazards, same state → 2 groups", () => {
    const a = mkAlert({ hazard_kind: "enchente" });
    const b = mkAlert({ hazard_kind: "queimada" });
    const out = dedupForCalc([a, b]);
    expect(out).toHaveLength(2);
  });

  it("does not mutate input array", () => {
    const input: Alert[] = [mkAlert(), mkAlert({ source_key: "inmet", severity: "high" })];
    const snapshot = JSON.stringify(input);
    dedupForCalc(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("uses 24h fallback when valid_until is null", () => {
    // 2 alerts: A fetched at t=0 with no valid_until → window [0, 24h].
    // B fetched at t=12h with no valid_until → window [12h, 36h]. Overlap → 1 group.
    const a = mkAlert({ valid_until: undefined, fetched_at: iso(0), valid_from: undefined });
    const b = mkAlert({
      valid_until: undefined,
      fetched_at: iso(12 * 60),
      valid_from: undefined,
      source_key: "inmet",
      severity: "high",
    });
    const out = dedupForCalc([a, b]);
    expect(out).toHaveLength(1);
  });
});

describe("compareWorst (D-04)", () => {
  it("(a) same severity, different fetched_at → newer wins", () => {
    const a = mkAlert({ severity: "moderate", fetched_at: iso(0) });
    const b = mkAlert({ severity: "moderate", fetched_at: iso(60) });
    expect([a, b].sort(compareWorst)[0]).toBe(b);
  });

  it("(b) same severity + fetched_at, different source_key → alphabetical asc wins", () => {
    const a = mkAlert({ source_key: "cemaden", fetched_at: iso(0) });
    const b = mkAlert({ source_key: "inmet", fetched_at: iso(0) });
    expect([a, b].sort(compareWorst)[0]).toBe(a);
    // Reversed input → still cemaden first
    expect([b, a].sort(compareWorst)[0]).toBe(a);
  });

  it("(c) deterministic across 100 shuffles", () => {
    const fixtures = [
      mkAlert({ source_key: "cemaden", severity: "high", fetched_at: iso(0) }),
      mkAlert({ source_key: "inmet", severity: "high", fetched_at: iso(0) }),
      mkAlert({ source_key: "stub", severity: "moderate", fetched_at: iso(60) }),
      mkAlert({ source_key: "cemaden", severity: "extreme", fetched_at: iso(-30) }),
    ];
    const expected = [...fixtures].sort(compareWorst).map((a) => a.source_key + a.severity);
    for (let i = 0; i < 100; i++) {
      const shuffled = [...fixtures].sort(() => Math.random() - 0.5);
      const actual = shuffled.sort(compareWorst).map((a) => a.source_key + a.severity);
      expect(actual).toEqual(expected);
    }
  });
});

describe("SEVERITY_RANK", () => {
  it("ranks extreme > high > moderate > low", () => {
    expect(SEVERITY_RANK.extreme).toBeGreaterThan(SEVERITY_RANK.high);
    expect(SEVERITY_RANK.high).toBeGreaterThan(SEVERITY_RANK.moderate);
    expect(SEVERITY_RANK.moderate).toBeGreaterThan(SEVERITY_RANK.low);
  });
});
```

If `Alert` requires fields not listed in `mkAlert` defaults (e.g., `source_url`, `body`), add them with sensible undefineds — the executor reads `src/lib/sources/schema.ts` for the canonical shape and tunes `mkAlert`.

Verify: `pnpm test src/lib/risk/dedup.test.ts`

Done: all `it` blocks pass; coverage of `dedup.ts` reports 100/100/100/100; no input mutation.

## Verification (plan-wide)

```bash
pnpm test src/lib/risk/dedup.test.ts
pnpm tsc --noEmit
pnpm lint src/lib/risk
pnpm depcruise
pnpm test:coverage 2>&1 | grep -E "dedup\\.ts"
```

## RISK-IDs covered

- RISK-05 (dedup overlap collapse + non-overlap split + diff-hazard split)
- D-04 (deterministic tie-break)

## Dependencies

Plan 04 (`Severity` type).

## Estimated commits

2.
