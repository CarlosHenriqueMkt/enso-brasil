# Phase 3: Pure Risk Engine — Specification

**Created:** 2026-05-02
**Ambiguity score:** 0.08 (gate: ≤ 0.20)
**Requirements:** 10 locked

## Goal

Ship a pure, edge-safe TypeScript library at `src/lib/risk/` that implements the v0.1 risk formula — `calculateRiskLevel(alerts: Alert[]): RiskLevel`, a snapshot-staleness override helper, source-severity mapping tables, and a PT-BR plain-language explanation generator — with 100% line + branch coverage and zero I/O. Phase 3 ships the library only; wiring into `/api/ingest` and `/api/archive` (replacing the `v0-placeholder` string with real `v0` output) is deferred to Phase 4 alongside the real CEMADEN/INMET adapters.

## Background

P2 shipped the data plumbing with a placeholder risk path: `src/app/api/ingest/route.ts` (lines 190, 203, 207) writes the literal string `"v0-placeholder"` into `snapshot_cache.formula_version` and never computes a real per-state risk level — every state's level is effectively `unknown`/synthetic. The same placeholder lives in `/api/archive/route.ts`, the test fixtures (`route.test.ts`, `schemas.test.ts`, `diff.test.ts`), and the API schema (`src/lib/api/schemas.ts:61` — already typed as `z.string()`, no migration needed).

The contract is fully written down: `risk-formula-v0.md` (algorithm + level definitions + per-source severity mappings + checklist), `.planning/research/SUMMARY.md` (v0.1 corrections — `unknown` level + `moderate` default), and `.planning/REQUIREMENTS.md` RISK-01..10. The `Alert` type already exists at `src/lib/sources/schema.ts:55` (zod-derived). What does NOT exist: any file under `src/lib/risk/`, any tests for risk computation, any vocab table for hazard PT-BR names, any plain-language generator.

This phase converts the locked formula into code, lockstep-tested, ready for P4 to wire in.

## Requirements

1. **Pure calculateRiskLevel function** (RISK-01): Edge-safe pure function with no I/O.
   - Current: No risk function exists. `/api/ingest` writes `"v0-placeholder"` instead of computing.
   - Target: `src/lib/risk/calculate.ts` exports `calculateRiskLevel(alerts: Alert[]): RiskLevel`. No imports outside `./types` and standard JS globals (`Date`). Verifiable via dependency-cruiser rule in CI.
   - Acceptance: `import { calculateRiskLevel } from '@/lib/risk/calculate'` works in an Edge runtime context (no Node-only APIs). `dependency-cruiser` rule fails CI if calculate.ts imports anything outside `./types`.

2. **Five risk levels including `unknown`** (RISK-02): Type union `green | yellow | orange | red | unknown`.
   - Current: No `RiskLevel` type exists in repo. `risk-formula-v0.md` algorithm shows only 4 levels — research SUMMARY corrected to 5.
   - Target: `src/lib/risk/types.ts` exports `RiskLevel = 'green' | 'yellow' | 'orange' | 'red' | 'unknown'`.
   - Acceptance: TypeScript compile fails if any consumer narrows to 4 levels. Vitest has dedicated tests for each of the 5 outputs.

3. **Severity type** (RISK-03): `low | moderate | high | extreme`.
   - Current: No `Severity` type exists. `Alert.severity` in `src/lib/sources/schema.ts` already exists — confirm it matches.
   - Target: `src/lib/risk/types.ts` exports `Severity = 'low' | 'moderate' | 'high' | 'extreme'`. Re-exported / aliased so `Alert.severity` and risk module agree at the type level.
   - Acceptance: A type-only test (`tsc --noEmit` against a compatibility fixture) proves `Alert['severity']` is assignable to `Severity` and vice versa.

4. **Default-`moderate` for unknown source terms** (RISK-04): Conservative bias for unmapped severity strings.
   - Current: No mapping function exists.
   - Target: `src/lib/risk/sources/cemaden.ts` and `src/lib/risk/sources/inmet.ts` each export `mapSeverity(rawTerm: string): Severity`. Unknown input returns `'moderate'` (NOT `'low'`).
   - Acceptance: Vitest cases assert each known term maps correctly AND that an unrecognized string returns `'moderate'`. Snapshot test of the full mapping table per source.

5. **Dedup rule for risk calc** (RISK-05): Same `hazardType` + `state` + overlapping time windows = 1 alert in computation, both kept for UI attribution.
   - Current: No dedup logic exists in risk path. P2 has a `payload_hash` dedup at insert time but that is exact-match, not semantic.
   - Target: `src/lib/risk/dedup.ts` exports `dedupForCalc(alerts: Alert[]): Alert[]` that collapses by `(hazardType, state)` when `[publishedAt, activeUntil]` windows overlap, choosing the highest severity. Original input array preserved for UI consumers.
   - Acceptance: Vitest cases: (a) two CEMADEN+INMET alerts same hazard + state + overlapping window → 1 alert in dedup output (highest severity wins); (b) two same-hazard alerts with NON-overlapping windows → 2 alerts; (c) different hazards same state → 2 alerts.

6. **24h validity window** (RISK-06): Alerts without `activeUntil` expire 24h after `publishedAt`.
   - Current: P2 algorithm pseudocode in `risk-formula-v0.md` filters by `activeUntil` only — null → treated as forever-active. Research-flagged correction needed.
   - Target: Inside `calculateRiskLevel`, an alert is "active" iff: `activeUntil != null && activeUntil > now`, OR `activeUntil == null && (now - publishedAt) < 24h`. `now` injectable for tests via optional 2nd arg `now?: Date` (defaults to `new Date()`).
   - Acceptance: Vitest cases: (a) `activeUntil = null, publishedAt = now-23h` → active; (b) `activeUntil = null, publishedAt = now-25h` → expired; (c) explicit `activeUntil = past` → expired regardless of publishedAt.

7. **Source-staleness `unknown` rule** (RISK-07): All-sources-stale > 1h → state level = `unknown`.
   - Current: No staleness logic. `sources_health` table exists in P2 but is not consulted by any risk path.
   - Target: `src/lib/risk/snapshot.ts` exports `applyStaleness(level: RiskLevel, sourcesHealth: SourcesHealthRow[], now?: Date): RiskLevel` — pure function. If every integrated source's `lastSuccessfulFetch` is older than `now - 1h`, returns `'unknown'`. Otherwise returns input `level` unchanged. Engine remains pure (function takes data, not DB handle).
   - Acceptance: Vitest cases: (a) all sources fresh → input level passes through; (b) all sources stale > 1h → returns `'unknown'`; (c) one source fresh, others stale → returns input level (NOT unknown — at least one source is current); (d) empty sources array → returns `'unknown'` (defensive — never silently green).

8. **Versioned additive snapshot output** (RISK-08): `formula_version: "v0"` + additive-only schema.
   - Current: P2 writes `"v0-placeholder"`. The DB column (`snapshot_cache.formula_version`) and zod schema (`StateSnapshotSchema.formulaVersion: z.string()`) accept any string — no migration required to flip the value.
   - Target: `src/lib/risk/snapshot.ts` exports a const `FORMULA_VERSION = "v0"` and a `StateSnapshotPayload` type matching the additive contract from `.planning/research/SUMMARY.md` (existing fields preserved + room for `explanation: string` from RISK-09). P3 does NOT modify `/api/ingest`, `/api/archive`, or P2 tests — it only ships the lib + the constant. P4 imports and writes them.
   - Acceptance: Vitest cases assert `FORMULA_VERSION === "v0"` and that the payload type compiles against the existing `StateSnapshotSchema` shape (additive — no removed fields). A type-level test demonstrates a P2-shape snapshot is forward-assignable.

9. **PT-BR plain-language explanation generator** (RISK-09): One sentence per state, generated by the engine.
   - Current: No generator. Card UIs (P5) would have to compose strings client-side, risking drift between dashboard, `/texto` route (A11Y-04), and future M11 notifications / M8 public API.
   - Target: `src/lib/risk/explanation.ts` exports `generateExplanation(level: RiskLevel, alerts: Alert[]): string` returning a single PT-BR sentence. Vocab table at `src/lib/risk/vocab.ts` covers: hazardType → PT-BR noun (queimada, estiagem, enchente, deslizamento, chuva forte, …); severity → PT-BR label (Atenção, Alerta, Perigo); level → PT-BR label (Sem alertas, Atenção, Alerta, Perigo, Dados indisponíveis). Multi-alert format: `"{N} alertas ativos. Pior: {SeverityPT} do {SourceName} para {hazardPT}"`. Single alert: `"1 alerta de {SeverityPT} do {SourceName} para {hazardPT}"`. Multi-source same-hazard (post-dedup): join attributions `"INMET + CEMADEN"`. Empty alerts: `"Sem alertas ativos."`. `unknown` level: `"Dados indisponíveis no momento."`.
   - Acceptance: Vitest snapshot tests covering: 0 alerts/`green`, 1 alert/`yellow`, 1 alert/`orange`, multi-alert/`red`, multi-source-same-hazard, `unknown`. Pluralization correct ("1 alerta" vs "2 alertas"). Source attribution matches CEMADEN/INMET verbatim casing.

10. **Per-source severity mapping files** (RISK-10): `src/lib/risk/sources/{cemaden,inmet}.ts` with v0.1 tables.
    - Current: No per-source mapping anywhere.
    - Target: One file per source. Each exports `mapSeverity(raw: string): Severity` and a `SEVERITY_TABLE` const for documentation/snapshot tests. CEMADEN table covers known terms from `risk-formula-v0.md` (Observação/Atenção/Alerta/Alerta Máximo). INMET table covers CAP severity values (Minor/Moderate/Severe/Extreme) and PT-BR aliases. Both default-fallback to `'moderate'` per RISK-04.
    - Acceptance: Vitest snapshot test of each `SEVERITY_TABLE`. Coverage proves every documented term in `risk-formula-v0.md` is mapped.

## Boundaries

**In scope:**

- `src/lib/risk/types.ts` — `RiskLevel`, `Severity`, `StateSnapshotPayload` types
- `src/lib/risk/calculate.ts` — pure `calculateRiskLevel(alerts, now?)`
- `src/lib/risk/dedup.ts` — pure `dedupForCalc(alerts)`
- `src/lib/risk/snapshot.ts` — `FORMULA_VERSION` const + pure `applyStaleness(level, sourcesHealth, now?)`
- `src/lib/risk/explanation.ts` — pure `generateExplanation(level, alerts): string`
- `src/lib/risk/vocab.ts` — hazardType + severity + level → PT-BR strings
- `src/lib/risk/sources/cemaden.ts` — CEMADEN severity mapping table + `mapSeverity`
- `src/lib/risk/sources/inmet.ts` — INMET severity mapping table + `mapSeverity`
- Vitest suite: 100% line + branch coverage of all the above
- `dependency-cruiser` rule enforcing `src/lib/risk/calculate.ts` imports only from `./types`
- README addendum (PT-BR section) explaining v0 formula with one concrete worked example

**Out of scope:**

- Wiring `calculateRiskLevel`, `applyStaleness`, `generateExplanation` into `/api/ingest/route.ts` and `/api/archive/route.ts` — Phase 4 owns the swap (alongside real CEMADEN/INMET adapters)
- Updating P2 test fixtures that hardcode `"v0-placeholder"` — Phase 4 changes those
- Real CEMADEN / INMET adapters — Phase 4
- INPE Queimadas / NASA FIRMS source mapping — Phase 6 (only CEMADEN + INMET tables required for v0.1 in this phase)
- Risk computation for sub-state geographies (municipality/region) — out of v1 milestone entirely (M4)
- Forecasting / predictive synthesis — anti-feature, never
- UI rendering of the explanation — Phase 5 (UI consumes `snapshot.explanation` as-is)
- I18n of explanation strings — locked decision: PT-BR only, no `next-intl`
- Database schema changes — `snapshot_cache.formula_version` column is `text`, accepts `"v0"` without migration
- Risk formula v1+ revisions — versioning contract documented but not exercised this phase

## Constraints

- **Edge-safe:** every file under `src/lib/risk/` must run in the Vercel Edge runtime. No Node-only modules, no `process.env`, no filesystem, no `crypto.randomUUID` reliance. `Date` allowed.
- **Pure functions only:** no I/O, no module-level side effects, no logging, no mutation of input arrays. `calculate.ts` and `snapshot.ts` take `now?: Date` arg for deterministic testing.
- **100% test coverage:** Vitest reports `lines: 100, branches: 100, functions: 100, statements: 100` for every file under `src/lib/risk/`. CI fails below threshold.
- **Dependency isolation:** `src/lib/risk/calculate.ts` imports only from `./types`. Enforced by `dependency-cruiser` rule added to existing config (P2 already uses it). `explanation.ts` may import `./vocab` and `./types` only.
- **Snapshot additive contract:** the `StateSnapshotPayload` type must be a structural superset of the existing P2 `StateSnapshotSchema` — adding fields (e.g., `explanation`) is allowed, removing/renaming is not.
- **PT-BR vocabulary verbatim:** hazard PT-BR names + severity labels + level labels match CEMADEN/INMET terminology and the locked PROJECT.md table. No invented synonyms.

## Acceptance Criteria

- [ ] `src/lib/risk/{types,calculate,dedup,snapshot,explanation,vocab}.ts` and `src/lib/risk/sources/{cemaden,inmet}.ts` all exist and export the documented APIs
- [ ] `vitest run --coverage` reports 100% lines + 100% branches for every file under `src/lib/risk/`
- [ ] `calculateRiskLevel` returns each of `green | yellow | orange | red | unknown` in dedicated test cases
- [ ] `calculateRiskLevel` correctly applies the 24h null-`activeUntil` validity window (3 cases: under-24h active, over-24h expired, explicit-past expired)
- [ ] `dedupForCalc` collapses overlapping same-hazard same-state alerts to 1 (highest severity wins) and preserves non-overlapping or different-hazard alerts as separate
- [ ] `applyStaleness` returns `'unknown'` when all sources stale > 1h, returns input level when ≥ 1 source fresh, returns `'unknown'` for empty health array
- [ ] CEMADEN + INMET `mapSeverity` return `'moderate'` for unrecognized strings (snapshot test of full tables included)
- [ ] `generateExplanation` produces correct PT-BR sentence for: 0 alerts/green, 1 alert/yellow, 1 alert/orange, multi-alert/red, multi-source-same-hazard post-dedup, unknown — with correct pluralization and verbatim source attribution
- [ ] `FORMULA_VERSION === "v0"` exported from `src/lib/risk/snapshot.ts`
- [ ] `dependency-cruiser` CI rule passes: `src/lib/risk/calculate.ts` imports only from `./types`
- [ ] Edge runtime smoke test: importing `@/lib/risk/calculate` in an Edge route compiles without warnings
- [ ] `StateSnapshotPayload` type is a structural superset of P2's `StateSnapshotSchema` (type-level test)
- [ ] README has a PT-BR section "Como calculamos o risco — v0" with one concrete worked example (state with 2 alerts → level → explanation)
- [ ] No file under `src/app/api/` is modified in this phase (P4 owns the wiring) — `git diff --stat src/app/api/` is empty post-phase

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes                                                               |
| ------------------- | ----- | ----- | ------ | ------------------------------------------------------------------- |
| Goal Clarity        | 0.95  | 0.75  | ✓      | Pure lib + 100% coverage; staleness override + explanation locked   |
| Boundary Clarity    | 0.92  | 0.70  | ✓      | P3 = lib only; P4 owns swap; explicit no-touch on `src/app/api/`    |
| Constraint Clarity  | 0.88  | 0.65  | ✓      | Edge-safe, pure, 100% coverage, dep-cruiser rule, additive snapshot |
| Acceptance Criteria | 0.92  | 0.70  | ✓      | 13 pass/fail checkboxes — all observable                            |
| **Ambiguity**       | 0.08  | ≤0.20 | ✓      |                                                                     |

## Interview Log

| Round | Perspective     | Question summary                                       | Decision locked                                                                                                                                                                                                                 |
| ----- | --------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Initial assess  | Roadmap + RISK-01..10 + risk-formula-v0.md sufficient? | Gate already passed at 0.15 from existing context — only 4 fuzzy spots remain                                                                                                                                                   |
| 1     | Boundary Keeper | Where does staleness rule (RISK-07) live?              | `applyStaleness` helper in `src/lib/risk/snapshot.ts` — pure, takes sourcesHealth as arg; engine stays pure                                                                                                                     |
| 1     | Boundary Keeper | Who swaps `v0-placeholder` → `v0` in /api/ingest?      | Phase 4 — P3 ships lib only; production stays placeholder until P4 wires real adapters + risk                                                                                                                                   |
| 1     | Simplifier      | Engine emits prose or structured fields for RISK-09?   | Engine emits PT-BR string. Vocab in `src/lib/risk/vocab.ts`. Multi-alert → "N alertas. Pior: …". Multi-source → "INMET + CEMADEN". Reasoning: M11 notifications and M8 public API reuse the string; PT-BR locked, i18n risk low |

---

_Phase: 03-pure-risk-engine_
_Spec created: 2026-05-02_
_Next step: /gsd-discuss-phase 3 — implementation decisions (file layout details, dep-cruiser config, vocab table extent, README example state choice)_
