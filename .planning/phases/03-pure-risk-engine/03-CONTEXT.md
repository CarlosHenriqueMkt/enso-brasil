# Phase 3: Pure Risk Engine — Context

**Created:** 2026-05-02
**Phase:** 03-pure-risk-engine
**Spec:** `.planning/phases/03-pure-risk-engine/03-SPEC.md` (10 RISK-IDs locked)

## Domain

Pure, edge-safe TypeScript library at `src/lib/risk/` implementing the v0.1 risk formula. No I/O, 100% line+branch coverage. Replaces the `v0-placeholder` semantic shipped by P2. Phase 3 ships the library only — Phase 4 wires it into `/api/ingest` and `/api/archive` alongside real CEMADEN/INMET adapters.

## Spec Lock

Requirements, boundaries, constraints, and acceptance criteria are LOCKED by `03-SPEC.md`. Downstream agents (researcher, planner, executor) MUST read SPEC.md as the contract for WHAT to build. This CONTEXT.md only captures HOW decisions.

## Canonical Refs

Every downstream agent MUST read these:

- `.planning/phases/03-pure-risk-engine/03-SPEC.md` — **Locked requirements (read first)**
- `.planning/PROJECT.md` — Locked decisions (stack, anti-features, mission, risk-formula link)
- `.planning/REQUIREMENTS.md` — RISK-01..10 source-of-truth
- `.planning/ROADMAP.md` — Phase 3 goal + 4 success criteria
- `.planning/research/SUMMARY.md` — v0.1 corrections (`unknown` level, `moderate` default, severity vs riskLevel separation)
- `risk-formula-v0.md` — algorithm + per-source severity tables + complementary rules
- `.planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md` — D-13 (Next.js 16.x), PT-BR-only, messages.ts as SoT
- `.planning/phases/02-data-foundation/02-CONTEXT.md` — Alert schema location (`src/lib/sources/schema.ts`), placeholder semantics (`v0-placeholder` write sites), `messages.severity` SoT contract
- `src/lib/sources/schema.ts` — Existing `Alert` zod schema (snake_case fields) — **must be modified by P3 per D-01 below**
- `src/lib/messages.ts` — PT-BR string SoT (extended by P3 per D-02 below)
- `CLAUDE.md` — project guide (locked decisions, anti-features, hazard vocabulary hard rules)

## Code Context

**Reusable assets (P1 + P2, in `main`):**

- `src/lib/sources/schema.ts` — `AlertSchema` (zod) with snake_case fields: `source_key`, `hazard_kind` (enum HAZARD_KINDS = queimada/enchente/estiagem/incendio/inundacao/seca), `state_uf` (UF27), `severity` (currently misnamed — see D-01), `headline`, `body?`, `source_url?`, `fetched_at` (ISO datetime), `valid_from?`, `valid_until?`, `payload_hash`, `raw`. Engine consumes this exact shape.
- `src/lib/messages.ts` — PT-BR SoT. `messages.severity.{green,yellow,orange,red,gray}` already declared. P3 extends with `messages.risk.severity` (alert-level: low/moderate/high/extreme → Atenção/Alerta/Perigo/Perigo extremo) and `messages.risk.hazard` (hazard_kind → noun PT-BR phrase). See D-02.
- `src/db/schema.ts` — `snapshot_cache.formula_version` is `text` column. Accepts `"v0"` without migration when P4 swaps the value.
- `src/lib/api/schemas.ts:61` — `formulaVersion: z.string()` already permissive. No schema change needed for P3.
- `vitest.config.ts` — Vitest 4.1.5, `pool: forks`, `environment: jsdom`, `globals: true`. P3 extends with v8 coverage thresholds scoped to `src/lib/risk/**` (D-03).
- `eslint.config.mjs` — flat config exists. P3 adds `no-restricted-imports` rule for `src/lib/risk/**` (D-03).

**Integration points new to P3:**

- `src/lib/risk/types.ts` (new) — `RiskLevel`, `Severity`, `StateSnapshotPayload`
- `src/lib/risk/calculate.ts` (new) — pure `calculateRiskLevel(alerts, now?)`
- `src/lib/risk/dedup.ts` (new) — pure `dedupForCalc(alerts)`
- `src/lib/risk/snapshot.ts` (new) — `FORMULA_VERSION = "v0"` + `applyStaleness(level, sourcesHealth, now?)`
- `src/lib/risk/explanation.ts` (new) — pure `generateExplanation(level, alerts): string`
- `src/lib/risk/vocab.ts` (new) — typed re-exports from `messages.risk.*`
- `src/lib/risk/sources/cemaden.ts` (new) — `mapSeverity` + `SEVERITY_TABLE`
- `src/lib/risk/sources/inmet.ts` (new) — `mapSeverity` + `SEVERITY_TABLE`
- `src/lib/messages.ts` (modified — additive only) — adds `messages.risk.{severity,hazard}` blocks
- `src/lib/sources/schema.ts` (modified — semantic fix per D-01) — `SEVERITIES` → `["low","moderate","high","extreme"]`
- `tests/fixtures/sources/stub-default.json` (modified — fixture severity values updated)
- `vitest.config.ts` (modified — coverage thresholds added per D-03)
- `eslint.config.mjs` (modified — `no-restricted-imports` rule added per D-03)
- `.dependency-cruiser.cjs` (new) — dep-cruiser config (D-03)
- `.github/workflows/ci.yml` (modified — adds `pnpm depcruise` step)
- `package.json` (modified — adds `dependency-cruiser` + `@vitest/coverage-v8` dev deps)
- README addendum (PT-BR section) — "Como calculamos o risco — v0"

## Decisions

### D-01 — Fix Alert.severity in P3 (resolve schema/contract mismatch)

P2 declared `SEVERITIES = ["green","yellow","orange","red","unknown"]` in `src/lib/sources/schema.ts` and typed `Alert.severity` with these values. **That is the RiskLevel set, not the per-alert Severity.** Per `risk-formula-v0.md` and SPEC.md RISK-03, `Severity = "low" | "moderate" | "high" | "extreme"` (alert-level), `RiskLevel = "green" | "yellow" | "orange" | "red" | "unknown"` (state-level computed).

**Why:** RISK-03 acceptance criterion (type-only test that `Alert['severity']` is assignable to `Severity`) cannot pass without this fix. Two-name strategy (separate `AlertCalcInput`) was rejected to avoid an extra mapping layer that has no benefit beyond avoiding a one-time refactor. Adding a parallel field was rejected as more invasive (Drizzle column, fixture, schema, migration).

**How to apply (P3 scope, no P4 wiring):**

1. Edit `src/lib/sources/schema.ts`:
   - Rename existing `SEVERITIES` → keep symbol but change values to `["low","moderate","high","extreme"]`.
   - Add a separate exported `RISK_LEVELS = ["green","yellow","orange","red","unknown"] as const` (used only by snapshot/UI consumers — Alert never carries a RiskLevel).
2. Update `tests/fixtures/sources/stub-default.json` — change every `"severity"` value from a RiskLevel string to a Severity string. Pick `"moderate"` as the default for ambiguous fixture entries (matches RISK-04 conservative bias).
3. Update any P2 test that asserts on Alert severity values — search `grep -rE "severity.*['\"](green|yellow|orange|red|unknown)['\"]" src tests` and convert to Severity values. Tests that assert on snapshot RiskLevel are unaffected (snapshot uses RISK_LEVELS).
4. P3 does **not** modify `src/db/schema.ts` (no `severity` column on `alerts` table — Alert.severity is in-memory + serialized through `raw` payload). If `alerts.body` (jsonb) contains historical `green`/`yellow` strings from P2 stub runs, those rows are dev-only and will be discarded by the next ingest tick — no data migration needed.
5. `src/lib/risk/types.ts` re-exports `Severity` from `@/lib/sources/schema` and exports its own `RiskLevel = (typeof RISK_LEVELS)[number]` aliased from the same source. Single source of truth: the schema file.

**Acceptance:** RISK-03 type test compiles. Existing P2 ingest/archive route tests still pass (they assert on `formulaVersion: "v0-placeholder"` and snapshot shape, not Alert severity values per state).

### D-02 — Extend `messages.ts` as PT-BR SoT for risk vocab

`messages.ts` is already the locked PT-BR SoT (sketch-findings hard rule, P1 D-13). Adding risk vocab elsewhere creates drift risk. `messages.severity` already covers state-level RiskLevel labels — keep using it for level. Add two new namespaces for what's missing.

**Why:** Single SoT means designer/copy edits land in one file. `vocab.ts` becomes thin typed re-export layer — risk module stays decoupled from messages internals.

**How to apply:**

1. Extend `src/lib/messages.ts` (additive — do not rename existing keys):

   ```ts
   // Existing: messages.severity = { green, yellow, orange, red, gray }
   // Add:
   risk: {
     // Per-alert severity labels (CEMADEN/INMET vocabulary verbatim)
     severity: {
       low: "Atenção",
       moderate: "Alerta",
       high: "Perigo",
       extreme: "Perigo extremo",
     },
     // Hazard noun phrases for explanation prose (HAZARD_KINDS)
     hazard: {
       queimada: "queimada",
       enchente: "enchente",
       estiagem: "estiagem",
       incendio: "incêndio",
       inundacao: "inundação",
       seca: "seca",
     },
     // Source display names for explanation prose
     source: {
       cemaden: "CEMADEN",
       inmet: "INMET",
       stub: "Stub",
     },
   }
   ```

2. `src/lib/risk/vocab.ts` re-exports as typed maps:

   ```ts
   import { messages } from "@/lib/messages";
   export const LEVEL_LABEL = {
     green: messages.severity.green, // "Sem alertas"
     yellow: messages.severity.yellow, // "Atenção"
     orange: messages.severity.orange, // "Alerta"
     red: messages.severity.red, // "Perigo"
     unknown: messages.severity.gray, // "Dados indisponíveis"
   } as const;
   export const SEVERITY_LABEL = messages.risk.severity;
   export const HAZARD_LABEL = messages.risk.hazard;
   export const SOURCE_LABEL = messages.risk.source;
   ```

3. `vocab.ts` is the **only** file in `src/lib/risk/` allowed to import `@/lib/messages` (enforced by no-restricted-imports — see D-03). `calculate.ts` and `dedup.ts` and `snapshot.ts` stay free of strings.

**Acceptance:** `generateExplanation` produces PT-BR sentences matching SPEC RISK-09 templates. Changing copy in `messages.ts` updates explanation output immediately (verified via snapshot test).

### D-03 — Tooling: dep-cruiser + scoped vitest coverage + ESLint guard

Adopt all three (user: "follow recommendations and best practices"). Belt-and-suspenders for edge-safety + RISK-01 enforcement.

**Why:** RISK-01 acceptance requires CI-enforced isolation of `calculate.ts`. Scoped 100% coverage avoids retroactively holding P2 code to a threshold it wasn't designed for. ESLint adds defense-in-depth in IDE before CI catches it.

**How to apply:**

1. **dependency-cruiser:**
   - Add `dependency-cruiser` (latest stable, pin to minor in package.json) as devDep via pnpm.
   - New file `.dependency-cruiser.cjs` at repo root — minimal config, only the rule the SPEC requires:
     ```js
     module.exports = {
       forbidden: [
         {
           name: "risk-engine-isolation",
           severity: "error",
           comment: "src/lib/risk/calculate.ts must only import from ./types (RISK-01)",
           from: { path: "^src/lib/risk/calculate\\.ts$" },
           to: { pathNot: "^src/lib/risk/types\\.ts$" },
         },
         {
           name: "risk-engine-no-node",
           severity: "error",
           comment: "src/lib/risk/** must not import node:* (edge-safe)",
           from: { path: "^src/lib/risk/" },
           to: { path: "^node:" },
         },
       ],
       options: { tsConfig: { fileName: "tsconfig.json" } },
     };
     ```
   - Add `"depcruise": "depcruise --config .dependency-cruiser.cjs src"` to `package.json` scripts.
   - Add `pnpm depcruise` step to `.github/workflows/ci.yml` between `lint` and `vitest`.

2. **Vitest coverage scoped to src/lib/risk/\*\*:**
   - Add `@vitest/coverage-v8` (matching vitest 4.1.5 minor) as devDep.
   - Extend `vitest.config.ts`:
     ```ts
     test: {
       // ...existing...
       coverage: {
         provider: "v8",
         include: ["src/lib/risk/**/*.ts"],
         exclude: ["src/lib/risk/**/*.test.ts", "src/lib/risk/types.ts"],
         thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
         reporter: ["text", "json-summary"],
       },
     }
     ```
   - Add `"test:coverage": "vitest run --coverage"` to `package.json` scripts.
   - Add `pnpm test:coverage` step to CI (replace or augment existing `pnpm test`).
   - Note: `types.ts` excluded from coverage — pure type declarations have no executable lines.

3. **ESLint no-restricted-imports for `src/lib/risk/**`:\*\*
   - Extend `eslint.config.mjs` with an override block for `src/lib/risk/**/*.ts`:
     ```js
     {
       files: ["src/lib/risk/**/*.ts"],
       rules: {
         "no-restricted-imports": ["error", {
           patterns: [
             { group: ["node:*"], message: "Edge-safe — no node:* imports in risk engine." },
             { group: ["fs", "path", "crypto", "os"], message: "Edge-safe — no Node built-ins." },
             { group: ["pino", "@/lib/log"], message: "Pure module — no logging in risk engine." },
           ],
         }],
       },
     }
     ```
   - `vocab.ts` allowed to import `@/lib/messages` (no rule prevents this — only node:\* and logger banned).

**Acceptance:** CI fails if (a) `calculate.ts` imports anything outside `./types`, (b) any risk file imports `node:*`, (c) coverage drops below 100% on any risk file. ESLint flags violations in IDE before commit.

### D-04 — Dedup tie-breaking + "worst alert" selection

Deterministic ordering — same input always produces same explanation output. Required for snapshot test stability.

**Why:** Without explicit tie-break, sort instability causes flaky tests and inconsistent UI presentation across cron ticks. Source-priority hierarchy (INMET > CEMADEN) was rejected — adds a decision that ages poorly when INPE/NASA arrive in P6.

**How to apply:**

1. Severity ordering (constant in `src/lib/risk/dedup.ts`):
   ```ts
   const SEVERITY_RANK: Record<Severity, number> = {
     extreme: 4,
     high: 3,
     moderate: 2,
     low: 1,
   };
   ```
2. Comparator for "worst" alert selection (used by both dedup and explanation):
   ```ts
   // Higher severity wins. Tie → most recent fetched_at wins. Tie → source_key alphabetical asc.
   function compareWorst(a: Alert, b: Alert): number {
     const dr = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
     if (dr !== 0) return dr;
     const dt = new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime();
     if (dt !== 0) return dt;
     return a.source_key.localeCompare(b.source_key);
   }
   ```
3. Dedup collapses by `(hazard_kind, state_uf)` when validity windows overlap (using `valid_from`/`valid_until`/`fetched_at`+24h per RISK-06). Survivor = `compareWorst` winner. Non-survivors retained in a separate `attribution[]` array on the dedup result so multi-source explanation ("INMET + CEMADEN") still works.
4. `generateExplanation` uses the same `compareWorst` to pick the "Pior" alert when N > 1.

**Acceptance:** Vitest tie-break tests: (a) same severity, different fetched_at → newer wins; (b) same severity + fetched_at, different source_key → alphabetical wins; (c) deterministic across 100 shuffled inputs.

## Implementation Notes

Field-name mapping from SPEC.md/risk-formula-v0.md pseudocode → real Alert (snake_case):

| Pseudocode (SPEC) | Real Alert field           | Notes                                                       |
| ----------------- | -------------------------- | ----------------------------------------------------------- |
| `activeUntil`     | `valid_until`              | ISO datetime string; null/undefined → fall back to 24h rule |
| `publishedAt`     | `fetched_at`               | ISO datetime string; always present (zod-required)          |
| `hazardType`      | `hazard_kind`              | Enum from HAZARD_KINDS                                      |
| `state`           | `state_uf`                 | UF27 enum                                                   |
| `source`          | `source_key`               | Free string (cemaden/inmet/stub today)                      |
| `sourceUrl`       | `source_url`               | Optional                                                    |
| `severity`        | `severity` (post-D-01 fix) | After D-01: low/moderate/high/extreme                       |

The 24h validity rule (RISK-06) operates on `fetched_at` (since `published_at` is not on the schema; `fetched_at` is the closest surrogate and is what P2 captures). Document this in `calculate.ts` JSDoc.

`sources_health` row shape for `applyStaleness` (RISK-07): import `SourcesHealthRow` from `src/db/schema.ts` Drizzle inferred type, OR define a minimal pure interface in `src/lib/risk/types.ts` (`{ source_key: string; last_successful_fetch: string | null }`) — prefer the latter to keep `risk/` decoupled from Drizzle. Planner picks; verify zero `@/db/*` imports in any `src/lib/risk/` file.

The README addendum lives at the bottom of the existing PT-BR README, new section `## Como calculamos o risco — v0`. Use a worked example for one state (suggest **MG** with 2 alerts: 1 INMET "Aviso de Perigo" → moderate + 1 CEMADEN "Alerta" → moderate → state level `orange`, explanation "2 alertas ativos. Pior: Alerta do INMET para chuva forte"). Wire to RISK-formula-v0.md as the formal contract.

## Project-Level Carryover

- **D-13 (P1):** Next.js 16.x line, no next-intl, PT-BR only. P3 honors — no i18n in vocab.
- **PT-BR SoT (P1+P2):** `src/lib/messages.ts` is the single source for user-facing strings. P3 extends additively (D-02), never duplicates.
- **Hazard vocabulary hard rule (CLAUDE.md):** queimada ≠ incêndio, estiagem ≠ seca, enchente ≠ inundação. `HAZARD_KINDS` enum already enforces; vocab table preserves the distinction.
- **Public-safety conservative bias:** `moderate` default for unknown source terms (RISK-04). Never silently green (RISK-07). Both encoded in pure functions and tested.
- **Anti-feature (PROJECT.md):** No forecasting, no novel statistical synthesis. Engine mirrors source severity only.

## Anti-Patterns Specifically Rejected

- **Logging inside the engine** — `pino` and `@/lib/log` banned by ESLint rule (D-03). Engine is pure; logging belongs in the wiring layer (P4).
- **Source-priority hierarchy in dedup** — rejected in D-04. Deterministic temporal/alphabetical tie-break instead. INMET-first risks aging when INPE/NASA arrive.
- **Two-name Alert/AlertCalcInput strategy** — rejected in D-01. Adds a useless adapter layer; the schema fix is small and one-time.
- **Coverage thresholds applied repo-wide** — rejected in D-03. Scoped to `src/lib/risk/**` so P2 isn't held to 100% retroactively.
- **`now: Date = new Date()` non-injectable** — rejected. All time-aware functions take optional `now?: Date` for deterministic tests.
- **Mutation of input alerts array** — rejected. Engine is pure; create new arrays in dedup, sort on copies.

## Universal Anti-Patterns Reaffirmed

- No mock returning `null` to silence tests — every test asserts a real outcome.
- No `as any` / `// @ts-ignore` in engine code — `tsc --noEmit` must be clean.
- No `console.log` left in committed code (CI enforces via existing P2 lint).
- No new env vars introduced by P3 (engine is pure, edge-safe, deterministic).

## Deferred Ideas (out of P3 — not lost)

- INPE Queimadas + NASA FIRMS severity mapping files (`src/lib/risk/sources/{inpe,nasa}.ts`) — Phase 6 (Hardening + 3rd Source).
- NOAA / CPC drought severity — out of v1 milestone (NOAA in M5+ ingestion).
- `published_at` field on Alert (separate from `fetched_at`) — document as future addition if real adapter payloads carry an authoritative publication timestamp distinct from fetch time. Not blocking v1.
- Translation pipeline for foreign-language source bodies (NOAA/NASA) — M5+ ingestion concern, not engine concern.
- Sub-state geographic granularity (municipality, region) — M4 milestone.
- v1 / v2 formula revisions — versioning contract documented (RISK-08 additive-only) but not exercised.
- README EN translation of "Como calculamos o risco" section — P7 (Launch).

## Claude's Discretion

- Exact JSDoc wording on each exported function — Claude writes idiomatic PT-BR (or EN where standard) JSDoc; user reviews in PR.
- File-level header comments (license, purpose) — Claude follows P2 conventions.
- Internal helper naming inside files (e.g., `isAlertActive`, `compareWorst`) — Claude picks descriptive names.
- Choice of `@/lib/risk` path-alias vs relative imports for tests — Claude picks per existing P2 test conventions.
- Snapshot test fixture format — Claude picks idiomatic Vitest snapshot format.
- Exact `dependency-cruiser` config beyond the two SPEC-required rules (e.g., orphan detection) — Claude adds only what's needed for RISK-01 acceptance.

---

_Phase: 03-pure-risk-engine_
_Context created: 2026-05-02_
_Next step: `/gsd-plan-phase 3` — produce PLAN.md from this CONTEXT + 03-SPEC.md_
