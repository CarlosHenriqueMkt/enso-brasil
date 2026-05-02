---
phase: 03-pure-risk-engine
plan: 11
type: execute
wave: 4
depends_on: [05, 08]
files_modified:
  - src/lib/risk/explanation.ts
  - src/lib/risk/explanation.test.ts
autonomous: true
requirements: [RISK-09]
must_haves:
  truths:
    - "src/lib/risk/explanation.ts exports generateExplanation(level, alerts): string returning a single PT-BR sentence"
    - "Empty alerts → 'Sem alertas ativos.'"
    - "level === 'unknown' → 'Dados indisponíveis no momento.'"
    - "Single alert → '1 alerta de {SeverityPT} do {SourceName} para {hazardPT}'"
    - "Multi-alert → 'N alertas ativos. Pior: {SeverityPT} do {SourceName} para {hazardPT}'"
    - "Multi-source same-hazard (post-dedup) → '... do INMET + CEMADEN ...' (joined attributions, deterministic order from compareWorst: same-severity ties broken by newer fetched_at first)"
    - "Pluralization: '1 alerta' vs 'N alertas' (n>=2 OR n=0 — but n=0 short-circuits earlier)"
    - "Source attribution uses SOURCE_LABEL[source_key] ?? source_key (defensive fallback)"
    - "100% line + branch coverage; 6 inline snapshot tests covering all cases (case 5 string is locked, not bake-on-first-run)"
  artifacts:
    - path: "src/lib/risk/explanation.ts"
      provides: "generateExplanation pure function"
      min_lines: 40
    - path: "src/lib/risk/explanation.test.ts"
      provides: "6 inline-snapshot cases per SPEC RISK-09 acceptance"
  key_links:
    - from: "src/lib/risk/explanation.ts"
      to: "src/lib/risk/vocab.ts"
      via: "import { LEVEL_LABEL, SEVERITY_LABEL, HAZARD_LABEL, SOURCE_LABEL } from './vocab'"
      pattern: "from\\s+['\"]\\./vocab['\"]"
    - from: "src/lib/risk/explanation.ts"
      to: "src/lib/risk/dedup.ts"
      via: "import { compareWorst } from './dedup'"
      pattern: "compareWorst"
---

# Plan 11 — generateExplanation PT-BR generator (RISK-09)

**Goal:** Pure string builder producing one PT-BR sentence per state. Used by P4 wiring (snapshot write) and P5 UI (card display).

## Required reading

- `.planning/phases/03-pure-risk-engine/03-SPEC.md` (RISK-09 — full template list)
- `.planning/phases/03-pure-risk-engine/03-CONTEXT.md` (D-04 — `compareWorst` reuse for "Pior" pick; Implementation Notes — README example)
- `.planning/phases/03-pure-risk-engine/03-RESEARCH.md` (Pattern 6 — pluralization ternary; Pattern 7 — inline snapshot format)
- `.planning/phases/03-pure-risk-engine/03-PATTERNS.md` (lines 99-103 — explanation analog; line 244 — vocab.ts is only file that imports messages, NOT explanation.ts)
- `.planning/research/SUMMARY.md` (RISK-09 attribution language)
- `src/lib/risk/vocab.ts` (post Plan 05)
- `src/lib/risk/dedup.ts` (post Plan 08 — `compareWorst`, `dedupForCalc`, `DedupGroup`)

## Files touched

| Path                               | Change |
| ---------------------------------- | ------ |
| `src/lib/risk/explanation.ts`      | create |
| `src/lib/risk/explanation.test.ts` | create |

## Tasks

### Task 11.1 — Create `src/lib/risk/explanation.ts`

Files: `src/lib/risk/explanation.ts`

Action: per SPEC RISK-09 templates + RESEARCH open Q 4 (defensive fallback) + CONTEXT D-04 (reuse `compareWorst`):

```ts
/**
 * ENSO Brasil — PT-BR plain-language explanation generator (RISK-09).
 *
 * Behavior:
 *  - Empty alerts                  → "Sem alertas ativos."
 *  - level === "unknown"           → "Dados indisponíveis no momento."
 *  - 1 alert                       → "1 alerta de {SeverityPT} do {SourceName} para {hazardPT}"
 *  - N>1 alerts                    → "N alertas ativos. Pior: {SeverityPT} do {SourceName} para {hazardPT}"
 *  - Multi-source same hazard      → join sources: "do INMET + CEMADEN" (post-dedup attribution[])
 *
 * Pure / edge-safe. No I/O. Imports vocab + dedup only.
 */

import type { Alert, RiskLevel } from "./types";
import { compareWorst, dedupForCalc } from "./dedup";
import { SEVERITY_LABEL, HAZARD_LABEL, SOURCE_LABEL } from "./vocab";

function pluralAlertas(n: number): string {
  return n === 1 ? "1 alerta" : `${n} alertas`;
}

function sourceName(key: string): string {
  return (SOURCE_LABEL as Record<string, string>)[key] ?? key;
}

function hazardName(kind: Alert["hazard_kind"]): string {
  return (HAZARD_LABEL as Record<string, string>)[kind] ?? kind;
}

/**
 * Pick the worst alert (D-04 comparator). Joins attribution sources for multi-source
 * same-hazard groups: e.g., "INMET + CEMADEN" preserving compareWorst order.
 */
function attributionFragment(alerts: readonly Alert[]): {
  worst: Alert;
  sources: string;
} {
  const ranked = [...alerts].sort(compareWorst);
  const worst = ranked[0]!;
  // Unique sources, in compareWorst-induced order
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const a of ranked) {
    const name = sourceName(a.source_key);
    if (!seen.has(name)) {
      seen.add(name);
      ordered.push(name);
    }
  }
  return { worst, sources: ordered.join(" + ") };
}

export function generateExplanation(level: RiskLevel, alerts: readonly Alert[]): string {
  if (level === "unknown") return "Dados indisponíveis no momento.";
  if (alerts.length === 0) return "Sem alertas ativos.";

  // Use dedup so multi-source same-hazard alerts contribute to one "Pior" attribution.
  const groups = dedupForCalc(alerts);
  // Pick the worst group: the one whose survivor wins compareWorst across all groups.
  const worstGroup = [...groups].sort((a, b) => compareWorst(a.survivor, b.survivor))[0]!;
  const { worst, sources } = attributionFragment(worstGroup.attribution);
  const sevPT = SEVERITY_LABEL[worst.severity];
  const hazPT = hazardName(worst.hazard_kind);

  if (alerts.length === 1) {
    return `1 alerta de ${sevPT} do ${sources} para ${hazPT}`;
  }
  return `${pluralAlertas(alerts.length)} ativos. Pior: ${sevPT} do ${sources} para ${hazPT}`;
}
```

Notes:

- The "do {SourceName}" preposition is correct PT-BR for masculine source acronyms (INMET, CEMADEN). The locked SPEC template uses this form verbatim — do not switch to "da" unless project copy is updated in `messages.ts` first.
- `dedupForCalc` is called from inside `generateExplanation` so callers can pass raw alerts (P4 wiring) or pre-deduped groups will collapse harmlessly.
- `compareWorst` requires `fetched_at` and `source_key` fields — Alert always has them (zod-required).
- ESLint allows imports from `./vocab` and `./dedup` (only `node:*`/`@/lib/log`/`pino` banned). Re-verify with `pnpm lint`.

Verify: `pnpm tsc --noEmit && pnpm lint src/lib/risk/explanation.ts && pnpm depcruise`

Done: file exports `generateExplanation`; tsc/lint/depcruise green.

### Task 11.2 — Create `src/lib/risk/explanation.test.ts`

Files: `src/lib/risk/explanation.test.ts`

Action: per SPEC RISK-09 acceptance — 6 cases via inline snapshot (RESEARCH Pattern 7). Case 5's string is **LOCKED** (not bake-on-first-run) per plan-checker W-2.

**Determinism analysis for case 5 (locked):**

- Two alerts, both `severity = "moderate"`, same `(hazard_kind="enchente", state_uf)`, overlapping windows.
- D-04 `compareWorst` order: same severity → newer `fetched_at` wins.
  - INMET alert has `fetched_at: iso(10)` (newer)
  - CEMADEN alert has `fetched_at: iso(0)`
- Therefore `compareWorst` order: **INMET first, CEMADEN second**.
- `attributionFragment` ordered sources: `["INMET", "CEMADEN"]` → joined as `"INMET + CEMADEN"`.
- Severity = `"moderate"` → `SEVERITY_LABEL["moderate"]` = `"Alerta"` (per CONTEXT D-02 verbatim PT-BR labels).
- Hazard = `"enchente"` → `HAZARD_LABEL["enchente"]` = `"enchente"` (verbatim, per HAZARD_KINDS).
- Plural with N=2 → `"2 alertas ativos."`
- **Final locked string:** `"2 alertas ativos. Pior: Alerta do INMET + CEMADEN para enchente"`

```ts
import { describe, it, expect } from "vitest";
import { generateExplanation } from "./explanation";
import type { Alert } from "./types";

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

describe("generateExplanation (RISK-09) — 6 acceptance cases", () => {
  it("(1) 0 alerts / green", () => {
    expect(generateExplanation("green", [])).toMatchInlineSnapshot(`"Sem alertas ativos."`);
  });

  it("(2) 1 alert / yellow (severity=low)", () => {
    const a = mkAlert({ severity: "low", source_key: "inmet", hazard_kind: "queimada" });
    expect(generateExplanation("yellow", [a])).toMatchInlineSnapshot(
      `"1 alerta de Atenção do INMET para queimada"`,
    );
  });

  it("(3) 1 alert / orange (severity=moderate)", () => {
    const a = mkAlert({ severity: "moderate", source_key: "cemaden", hazard_kind: "enchente" });
    expect(generateExplanation("orange", [a])).toMatchInlineSnapshot(
      `"1 alerta de Alerta do CEMADEN para enchente"`,
    );
  });

  it("(4) multi-alert / red", () => {
    const alerts = [
      mkAlert({
        severity: "moderate",
        source_key: "cemaden",
        hazard_kind: "enchente",
        state_uf: "MG",
      }),
      mkAlert({
        severity: "high",
        source_key: "inmet",
        hazard_kind: "estiagem",
        state_uf: "MG",
        fetched_at: iso(10),
        valid_from: iso(0),
        valid_until: iso(120),
      }),
      mkAlert({
        severity: "extreme",
        source_key: "inmet",
        hazard_kind: "queimada",
        state_uf: "MG",
        fetched_at: iso(20),
        valid_from: iso(0),
        valid_until: iso(120),
      }),
    ];
    expect(generateExplanation("red", alerts)).toMatchInlineSnapshot(
      `"3 alertas ativos. Pior: Perigo extremo do INMET para queimada"`,
    );
  });

  it("(5) multi-source same-hazard (post-dedup) → joined attribution (LOCKED string per D-04 comparator)", () => {
    // Two alerts, same (hazard_kind, state_uf), both moderate, overlapping windows.
    // compareWorst tie-breaker: newer fetched_at wins → INMET (iso(10)) first, CEMADEN (iso(0)) second.
    const alerts = [
      mkAlert({
        severity: "moderate",
        source_key: "cemaden",
        hazard_kind: "enchente",
        fetched_at: iso(0),
      }),
      mkAlert({
        severity: "moderate",
        source_key: "inmet",
        hazard_kind: "enchente",
        fetched_at: iso(10),
        valid_from: iso(30),
        valid_until: iso(120),
      }),
    ];
    expect(generateExplanation("orange", alerts)).toMatchInlineSnapshot(
      `"2 alertas ativos. Pior: Alerta do INMET + CEMADEN para enchente"`,
    );
    // Locked from D-04 comparator. If this test fails, the regression is in:
    //   (a) compareWorst tie-break order, or
    //   (b) SOURCE_LABEL casing (must yield "INMET" / "CEMADEN" uppercase), or
    //   (c) SEVERITY_LABEL["moderate"] !== "Alerta", or
    //   (d) HAZARD_LABEL["enchente"] !== "enchente".
    // Fix the regression — DO NOT bake a new snapshot.
  });

  it("(6) unknown level", () => {
    const alerts = [mkAlert()]; // even with alerts, unknown short-circuits
    expect(generateExplanation("unknown", alerts)).toMatchInlineSnapshot(
      `"Dados indisponíveis no momento."`,
    );
    expect(generateExplanation("unknown", [])).toMatchInlineSnapshot(
      `"Dados indisponíveis no momento."`,
    );
  });

  it("pluralization: 1 vs 2", () => {
    const a = mkAlert({ source_key: "cemaden", hazard_kind: "enchente" });
    const b = mkAlert({
      source_key: "inmet",
      hazard_kind: "queimada",
      fetched_at: iso(60),
      valid_from: iso(60),
      valid_until: iso(120),
    });
    expect(generateExplanation("yellow", [a])).toMatch(/^1 alerta /);
    expect(generateExplanation("orange", [a, b])).toMatch(/^2 alertas /);
  });

  it("defensive fallback: unknown source_key renders raw key", () => {
    const a = mkAlert({ source_key: "noaa-future" }); // not in SOURCE_LABEL
    const out = generateExplanation("yellow", [a]);
    expect(out).toContain("noaa-future"); // raw key passes through
  });
});
```

**Snapshot bootstrap protocol (cases 1-4, 6):** the inline-snapshot strings are derived from D-02 verbatim PT-BR labels + locked vocabulary. They are EXPECTED-FIRST. Run `pnpm test src/lib/risk/explanation.test.ts` and confirm pass on first execution. If a case fails, fix the implementation OR the vocab table — DO NOT regenerate snapshots blindly. Case 5 specifically is locked and a regression there indicates a real contract drift (compareWorst order or label table change).

Verify: `pnpm test src/lib/risk/explanation.test.ts`

Done: all 8 `it` blocks pass; inline snapshots locked per D-02/D-04 derivation; coverage 100/100/100/100 for explanation.ts.

## Verification (plan-wide)

```bash
pnpm test src/lib/risk/explanation.test.ts
pnpm tsc --noEmit
pnpm lint src/lib/risk
pnpm depcruise
pnpm test:coverage 2>&1 | grep -E "explanation\\.ts"
```

## RISK-IDs covered

- RISK-09 (generator + 6 acceptance cases + pluralization + defensive fallback)

## Dependencies

- Plan 05 (`vocab.ts`)
- Plan 08 (`dedup.ts` — `compareWorst`, `dedupForCalc`)
- Plan 04 (types — transitively via 05/08)

## Estimated commits

2.
