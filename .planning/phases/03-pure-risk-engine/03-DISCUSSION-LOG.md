# Phase 3 — Discussion Log

**Phase:** 03-pure-risk-engine
**Date:** 2026-05-02
**Mode:** discuss (default)
**Spec:** 03-SPEC.md (10 RISK-IDs locked before this discussion)

This log is for human reference (audits, retrospectives). Downstream agents read CONTEXT.md, not this file.

## Areas Discussed

### 1. Schema conflict — Alert.severity collision with formula contract

**Why surfaced:** Codebase scout found `src/lib/sources/schema.ts` declares `SEVERITIES = ["green","yellow","orange","red","unknown"]` and types `Alert.severity` with these values. Per `risk-formula-v0.md` and SPEC.md RISK-03, `Severity` must be `low|moderate|high|extreme` (per-alert) and `RiskLevel` is the green/yellow/orange/red/unknown set (per-state computed). P2 conflated the two. Without resolution, RISK-03 type-only test cannot pass.

**Options presented:**

1. **Fix Alert schema in P3 (Recommended)** — Change `SEVERITIES` to formula values. Update stub fixture + P2 tests that assert on severity values. Field names stay snake_case. ~10 file touches in P3.
2. Two-name strategy — Keep Alert.severity as P2 contract; ship separate `AlertCalcInput` type in P3; map Alert→AlertCalcInput in P4 wiring. No P2 churn but adds adapter layer.
3. Rename Alert.severity → riskLevel + add new severity field — most invasive; touches Drizzle schema potentially.

**User selected:** Option 1 — Fix Alert schema in P3.

**Notes:** No data migration needed — `alerts` table doesn't store `severity` as a typed column; values live in `body` jsonb and are dev-only stub data that the next ingest tick discards.

### 2. PT-BR vocab strategy for explanation generator

**Why surfaced:** `src/lib/messages.ts` is the locked PT-BR SoT (P1 D-13 + sketch-findings hard rule). `messages.severity` already covers state-level RiskLevel labels. Per-alert severity labels (Atenção/Alerta/Perigo) and hazard noun phrases (queimada/enchente/...) don't exist there yet. Question: where do they live?

**Options presented:**

1. **Extend messages.ts (Recommended)** — Add `messages.risk.{severity,hazard,source}` blocks. `vocab.ts` re-exports as typed maps. Single SoT honored.
2. Standalone `risk/vocab.ts` — owns own PT-BR strings. Faster to write, drift risk on copy edits.
3. Hybrid — level labels from messages.ts; severity + hazard maps in vocab.ts.

**User selected:** Option 1 — Extend messages.ts.

**Notes:** `vocab.ts` becomes thin typed re-export; only file in `src/lib/risk/` allowed to import `@/lib/messages` (enforced by ESLint rule per area 3).

### 3. Tooling additions in P3

**Why surfaced:** SPEC RISK-01 requires CI-enforced isolation of `calculate.ts` to `./types` only. SPEC also requires 100% coverage. Need to decide which tooling to add and at what scope.

**Options presented (multi-select):**

- dependency-cruiser (Recommended) — devDep + config + CI step.
- Vitest coverage thresholds scoped to `src/lib/risk/**` — adds `@vitest/coverage-v8`, scoped include avoids holding P2 to 100%.
- ESLint `no-restricted-imports` for `src/lib/risk/**` — defense-in-depth, catches in IDE.

**User response:** "Siga suas recomendações e as melhores práticas."

**Resolved as:** All three adopted. Belt-and-suspenders for edge-safety + RISK-01 enforcement. Detailed config in CONTEXT.md D-03.

### 4. Tie-breaking + "worst alert" selection for explanation

**Why surfaced:** Dedup rule (RISK-05) collapses overlapping same-hazard alerts; "highest severity wins" leaves the case where severities tie. Explanation generator (RISK-09) picks one alert as "Pior". Without explicit ordering, sort instability causes flaky snapshot tests.

**Options presented:**

1. **Severity desc → publishedAt desc → source asc (Recommended)** — Deterministic temporal tie-break, alphabetical final.
2. Severity desc → source priority (INMET > CEMADEN) → publishedAt desc — authority hierarchy first.

**User selected:** Option 1 — temporal + alphabetical tie-break.

**Notes:** `published_at` not on Alert schema — substituted by `fetched_at` (only timestamp consistently present). Source-priority rejected because it ages poorly when INPE/NASA arrive in P6.

## Deferred Ideas (logged in CONTEXT.md)

- INPE Queimadas + NASA FIRMS severity files → P6
- NOAA / CPC drought severity → out of v1
- Separate `published_at` field on Alert distinct from `fetched_at` → future, not blocking v1
- Translation pipeline for foreign-language alert bodies → M5+ ingestion concern
- Sub-state granularity (municipality, region) → M4
- README EN translation of "Como calculamos o risco" → P7 Launch

## Claude's Discretion (logged in CONTEXT.md)

- JSDoc wording, file headers, helper naming, snapshot test format, dep-cruiser config beyond required rules.

## Areas NOT Discussed (locked by SPEC.md, not re-asked)

- File layout under `src/lib/risk/` — locked by SPEC In-Scope list
- Function signatures for `calculateRiskLevel`, `dedupForCalc`, `applyStaleness`, `generateExplanation` — locked by SPEC Requirements
- 100% coverage requirement — locked by SPEC Constraints (scope decided in CONTEXT D-03)
- Out-of-scope items (no /api/ wiring in P3, no real adapters, no INPE/NASA) — locked by SPEC Boundaries
- Snapshot additive contract — locked by SPEC RISK-08
- Default `moderate` for unknown source terms — locked by SPEC RISK-04
- Five risk levels including `unknown` — locked by SPEC RISK-02
