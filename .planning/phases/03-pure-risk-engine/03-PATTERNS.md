# Phase 3: Pure Risk Engine — Pattern Map

**Mapped:** 2026-05-02
**Files analyzed:** 18 (8 new modules + 8 co-located tests + 6 modified configs/fixtures + README addendum)
**Analogs found:** 16 / 18 (2 = "new pattern, no analog" — depcruise config, README PT-BR section uses generic markdown)

## Conventions discovered

| Question                   | Answer (evidence)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test co-location?          | **Co-located `foo.ts` + `foo.test.ts` same dir.** Every test in repo lives next to source — `src/lib/snapshot/diff.test.ts`, `src/lib/sources/schema.test.ts`, `src/lib/messages.test.ts`. No `tests/` mirror. `tests/` only holds setup + fixtures + e2e. **Note:** Snapshot files use Vitest's default `__snapshots__/` co-located subdirectory (e.g., `src/lib/risk/sources/__snapshots__/cemaden.test.ts.snap`) — this is NOT a test mirror, it's Vitest's storage convention for `toMatchSnapshot()` artifacts. The source-vs-test co-location rule still holds; `__snapshots__/` is generated artifact storage, not hand-authored test code. Plans 06/07/13 reference this directory accordingly. |
| Path alias usage in tests? | **Relative imports** for sibling-dir modules (`./diff`, `./schema`, `../api/schemas`). `@/` alias used only by production code crossing many dirs. `vitest.config.ts` has `@` → `src/*` alias available if needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Test imports               | `import { describe, it, expect } from "vitest";` — explicit, NOT relying on globals despite `globals: true`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| File header style          | JSDoc block at top: title line, blank line, prose explaining purpose + cross-refs to plan IDs (D-XX, REQ-S2.YY). See `src/lib/snapshot/diff.ts` lines 1-14, `src/lib/api/schemas.ts` lines 1-9.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Const-table export style   | `export const FOO = [...] as const;` then `export type Foo = (typeof FOO)[number];` — see `HAZARD_KINDS` (schema.ts:9-16), `UF27` (schemas.ts:13-42), `RISK_LEVELS` (schemas.ts:49-50).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Object-literal SoT style   | `export const messages = { ... } as const;` — single nested literal, not split.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| messages.ts test           | `it.skipIf(!existsSync(messagesPath))` guard + `await import("./messages")` dynamic load. Pattern reusable for vocab.ts test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| zod schema → type          | `z.infer<typeof Schema>` — never dual-declare.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## File Classification

| New / Modified File                                 | Role                   | Data Flow       | Closest Analog                                                            | Match       |
| --------------------------------------------------- | ---------------------- | --------------- | ------------------------------------------------------------------------- | ----------- |
| `src/lib/risk/types.ts`                             | type-only module       | n/a (transform) | `src/lib/api/schemas.ts` (RISK_LEVELS + types section)                    | exact       |
| `src/lib/risk/calculate.ts`                         | pure utility           | transform       | `src/lib/snapshot/diff.ts`                                                | exact       |
| `src/lib/risk/dedup.ts`                             | pure utility           | array transform | `src/lib/snapshot/diff.ts`                                                | exact       |
| `src/lib/risk/snapshot.ts`                          | pure utility + const   | transform       | `src/lib/snapshot/diff.ts` + `src/lib/api/schemas.ts` (const + type)      | exact       |
| `src/lib/risk/explanation.ts`                       | pure string builder    | transform       | `src/lib/snapshot/diff.ts` (pure fn) + `src/lib/messages.ts` (string SoT) | role-match  |
| `src/lib/risk/vocab.ts`                             | typed re-export        | n/a             | `src/lib/sources/registry-meta.ts` (frozen typed re-shaping)              | role-match  |
| `src/lib/risk/sources/cemaden.ts`                   | mapping table + map fn | transform       | `src/lib/sources/registry-meta.ts` (const + Object.fromEntries)           | role-match  |
| `src/lib/risk/sources/inmet.ts`                     | mapping table + map fn | transform       | same as cemaden.ts                                                        | role-match  |
| `src/lib/risk/*.test.ts` (each)                     | test                   | n/a             | `src/lib/snapshot/diff.test.ts`, `src/lib/sources/schema.test.ts`         | exact       |
| `src/lib/risk/vocab.test.ts`                        | test (string SoT)      | n/a             | `src/lib/messages.test.ts` (skipIf + dynamic import)                      | exact       |
| `.dependency-cruiser.cjs` (new)                     | tooling config         | n/a             | none — D-03 spec is the source                                            | new pattern |
| `vitest.config.ts` (modify)                         | tooling config         | n/a             | self (extend `test:` block)                                               | exact       |
| `eslint.config.mjs` (modify)                        | tooling config         | n/a             | self (existing edge-route override at lines 7-42)                         | exact       |
| `.github/workflows/ci.yml` (modify)                 | CI config              | n/a             | self (insert pnpm step between Lint/Knip and tests)                       | exact       |
| `tests/fixtures/sources/stub-default.json` (modify) | fixture                | n/a             | self (replace severity values)                                            | exact       |
| `src/lib/sources/schema.ts` (modify, D-01)          | zod schema             | n/a             | self (existing `SEVERITIES` line 19; add `RISK_LEVELS` next to it)        | exact       |
| `src/lib/messages.ts` (modify, D-02)                | string SoT             | n/a             | self (extend object literal additively)                                   | exact       |
| `package.json` (modify)                             | manifest               | n/a             | self (devDependencies + scripts)                                          | exact       |
| README addendum                                     | docs                   | n/a             | README.md heading style at lines 19-23                                    | role-match  |

## Pattern Assignments

### `src/lib/risk/types.ts` — type-only module

**Analog:** `src/lib/api/schemas.ts` lines 44-52 (RISK_LEVELS const + type alias from `(typeof X)[number]`).

**Header pattern** (mirror `src/lib/api/schemas.ts:1-9`):

```ts
/**
 * ENSO Brasil — Pure risk engine type contracts (RISK-02, RISK-03, RISK-08).
 *
 * RiskLevel: state-level computed output. Severity: per-alert input dimension.
 * Severity is re-exported from `@/lib/sources/schema` (single SoT, D-01).
 * Types only — no runtime code. Excluded from coverage thresholds.
 */
```

**Re-export pattern** (per CONTEXT D-01 step 5): `import { SEVERITIES, RISK_LEVELS } from "@/lib/sources/schema";` then `export type Severity = (typeof SEVERITIES)[number];`. Use `@/` alias because `risk/` is a new sibling — relative `../sources/schema` is also acceptable (matches `diff.ts:15` which uses `../api/schemas`).

**StateSnapshotPayload** must extend `StateSnapshot` from `src/lib/api/schemas.ts:63` (intersection type or `interface extends`) — additive only per RISK-08.

### `src/lib/risk/calculate.ts` — pure transform

**Analog:** `src/lib/snapshot/diff.ts` (entire file, 37 lines).

**Header pattern** (mirror `diff.ts:1-14`): JSDoc block — title, blank line, "Behavior:" bullet list with each branch enumerated. Cross-ref RISK-IDs and CONTEXT D-IDs.

**Imports pattern** (mirror `diff.ts:15`): `import type { Alert } from "./types";` — type-only relative import, no `@/`. **DO NOT** import anything else (depcruise rule blocks it).

**Function signature pattern** (mirror `diff.ts:22`):

```ts
export function calculateRiskLevel(alerts: Alert[], now: Date = new Date()): RiskLevel {
```

— top-level `export function`, defaulted optional positional arg per CONTEXT (now overridden in test).

**Branch style** (mirror `diff.ts:23-35`): early returns, no nested ternaries, named `Map` constructions for grouping. Body must remain free of regexes / strings (vocab is forbidden here — see ESLint override below).

### `src/lib/risk/dedup.ts` — pure array transform

**Analog:** `src/lib/snapshot/diff.ts` (Map-based grouping at lines 29-35).

Use the same `new Map(arr.map(x => [key, x]))` idiom for `(hazard_kind, state_uf)` grouping. Implement `compareWorst` per CONTEXT D-04 as a top-level `function compareWorst(a, b): number` (not arrow) — matches `diff.ts:22` style. Return shape: `{ survivor: Alert; attribution: Alert[] }[]` (CONTEXT D-04 step 3).

### `src/lib/risk/snapshot.ts` — const + pure helper

**Analog (const+type):** `src/lib/api/schemas.ts:49-50` (`RISK_LEVELS as const` + type derivation).
**Analog (pure fn):** `src/lib/snapshot/diff.ts:22-36`.

```ts
export const FORMULA_VERSION = "v0" as const;
```

`SourcesHealthRow` interface defined in `./types` (per CONTEXT Implementation Notes — pure interface, no Drizzle import).

### `src/lib/risk/explanation.ts` — pure string builder

**Analog (function shape):** `diff.ts:22-36`.
**Analog (string SoT consumption):** none in repo yet — use `vocab.ts` re-exports only. Never `import { messages }` directly here (ESLint rule per D-03).

Template builder: prefer `${tpl}` template strings over array.join for readability. Per CONTEXT D-04, reuse `compareWorst` from `./dedup` — exported from there as `export { compareWorst }` for cross-module use.

### `src/lib/risk/vocab.ts` — typed re-export

**Analog:** `src/lib/sources/registry-meta.ts` (frozen typed re-shape of source-of-truth data).

```ts
import { messages } from "@/lib/messages";
export const LEVEL_LABEL = { green: messages.severity.green, ... } as const;
export const SEVERITY_LABEL = messages.risk.severity;
```

This is the **only** file in `src/lib/risk/` allowed to import `@/lib/messages` (D-03 ESLint override gates this).

### `src/lib/risk/sources/{cemaden,inmet}.ts` — mapping tables

**Analog:** `src/lib/sources/registry-meta.ts:13-20`.

Pattern:

```ts
export const SEVERITY_TABLE: Readonly<Record<string, Severity>> = Object.freeze({
  Observação: "low",
  Atenção: "moderate",
  // ...
});

export function mapSeverity(raw: string): Severity {
  return SEVERITY_TABLE[raw] ?? "moderate"; // RISK-04 conservative default
}
```

Import `Severity` from `../types` (relative — sibling subdir). Snapshot test with `expect(SEVERITY_TABLE).toMatchSnapshot()` per RISK-10.

### Test files — `*.test.ts` co-located

**Analog:** `src/lib/snapshot/diff.test.ts` (canonical) + `src/lib/sources/schema.test.ts` (zod schema testing).

**Imports pattern** (mirror `diff.test.ts:1-3`):

```ts
import { describe, it, expect } from "vitest";
import { calculateRiskLevel } from "./calculate";
import type { Alert } from "./types";
```

**Fixture builder pattern** (mirror `diff.test.ts:5-12`): module-level helper `const mkAlert = (overrides: Partial<Alert> = {}): Alert => ({ ...defaults, ...overrides });` keeps each `it` body terse.

**Multiple `describe` blocks per file allowed** (see `schema.test.ts` lines 19, 34).

**Snapshot tests** (RISK-09, RISK-10): use Vitest inline `expect(x).toMatchSnapshot()`. No analog exists in repo yet — first usage. Snapshots land in `src/lib/risk/__snapshots__/foo.test.ts.snap` (Vitest default — see Conventions table note above: `__snapshots__/` is Vitest storage, not a test mirror).

**`vocab.test.ts`** mirrors `messages.test.ts:1-34` — `it.skipIf(!existsSync(...))` + dynamic `await import("./vocab")` to allow incremental scaffolding.

### `.dependency-cruiser.cjs` (new)

**No analog in repo.** Use the verbatim config in CONTEXT D-03 step 1. CommonJS extension `.cjs` because repo is ESM (`"type": "module"` is implicit via `package.json` Next 16). File lives at repo root next to `eslint.config.mjs`.

### `vitest.config.ts` modification (D-03 step 2)

**Analog:** self. Insert the `coverage:` block inside the existing `test: { ... }` literal at lines 14-21, after `exclude:`. Do NOT touch `pool`, `globalSetup`, `setupFiles` (load-bearing per MEMORY note on Vitest globalSetup vs setupFiles).

### `eslint.config.mjs` modification (D-03 step 3)

**Analog:** self. The file already contains an override block at lines 7-42 for edge routes with the exact `no-restricted-imports` shape needed. Append a second override object after line 42, before the closing `]`. Mirror the existing structure: `files`, `rules: { "no-restricted-imports": ["error", { paths: [...], patterns: [...] }] }`. Use `paths` for exact module names (`pino`, `@/lib/log`), `patterns` for globs (`node:*`).

### `.github/workflows/ci.yml` modification

**Analog:** self. Insert two new steps using the existing `- name: X\n  run: pnpm Y` pattern (lines 50-60). Recommended order:

- After "Lint" (line 53): `- name: Dep-cruise (risk engine isolation)\n  run: pnpm depcruise`
- Replace `pnpm test` (line 60) with `pnpm test:coverage` OR keep `pnpm test` and add a sibling step `- name: Coverage thresholds\n  run: pnpm test:coverage` — pick one (CONTEXT D-03 says "replace or augment"). **Sequencing note:** the `test:coverage` CI step is added in Plan 04 (after types.ts lands), not Plan 03 — Vitest v8 coverage with `include: ["src/lib/risk/**/*.ts"]` may fail vacuously when zero files match the include glob. Plan 03 lands the depcruise step + scripts + config; Plan 04 adds the coverage step.

### `tests/fixtures/sources/stub-default.json` modification

**Analog:** self. Three entries at lines 4, 22, 40. Per CONTEXT D-01 step 2: change `"yellow"` → `"moderate"`, `"orange"` → `"high"`, `"red"` → `"extreme"` (mapping rationale: preserve relative severity ranking; `"moderate"` covers ambiguous/default per RISK-04). `payload_hash` values must be **recomputed** because `severity` is in the canonicalized hash input (`schema.ts:99-110`). Run a one-off node script invoking `computePayloadHash` to regenerate hashes — do NOT hand-edit.

### `src/lib/sources/schema.ts` modification (D-01)

**Analog:** self. Edit line 19:

```ts
export const SEVERITIES = ["low", "moderate", "high", "extreme"] as const;
```

Add immediately after (per D-01 step 1):

```ts
export const RISK_LEVELS = ["green", "yellow", "orange", "red", "unknown"] as const;
```

Note: `src/lib/api/schemas.ts:49` already defines `RISK_LEVELS` locally for the API layer. Decide: (a) re-export from `api/schemas` instead of redeclaring, OR (b) move canonical `RISK_LEVELS` to `sources/schema.ts` and have `api/schemas.ts` re-export. Planner picks — recommend (b) per CONTEXT D-01 step 5 ("Single source of truth: the schema file").

### `src/lib/messages.ts` modification (D-02)

**Analog:** self. The file is one `as const` literal (lines 9-51). Append a new top-level key `risk: { severity: {...}, hazard: {...}, source: {...} }` after the existing `privacy` block (line 50), before the closing `} as const;`. Verbatim values from CONTEXT D-02 step 1.

### `package.json` modification

**Analog:** self.

- `devDependencies`: add `"dependency-cruiser": "^X.Y"` and `"@vitest/coverage-v8": "^4.1.5"` (match vitest minor — line 59).
- `scripts`: add `"depcruise": "depcruise --config .dependency-cruiser.cjs src"` and `"test:coverage": "vitest run --coverage"`. Insert alphabetically near existing `test` scripts (lines 18-19).

### README addendum

**Analog:** README.md heading style at lines 19, 25, 35, 41. Use `## Como calculamos o risco — v0` heading. Match prose voice (PT-BR, conservative tone). Use fenced code blocks ` ```bash ` for any commands, plain prose for the worked example. CONTEXT Implementation Notes provides the concrete MG example — copy verbatim. Place section between "Como funciona" (line 19) and "Fontes oficiais" (line 25), OR at file bottom — planner picks. Cross-link to `risk-formula-v0.md` (already cited at line 23).

## Shared Patterns

### Pure-function file header

**Source:** `src/lib/snapshot/diff.ts:1-14`. Apply to all 7 new `src/lib/risk/*.ts` files. Title line + blank + "Behavior:" bullet list of branches + RISK-ID/D-ID cross-refs.

### Const-table + derived-type export

**Source:** `src/lib/api/schemas.ts:49-50`, `src/lib/sources/schema.ts:9-19`. Apply to: `types.ts` (RiskLevel derivation), `dedup.ts` (SEVERITY_RANK), sources/\*.ts (SEVERITY_TABLE).

### Test file imports

**Source:** `src/lib/snapshot/diff.test.ts:1-3`. Apply to all new `*.test.ts` files. Always explicit `from "vitest"` even with `globals: true`.

### Test fixture builder

**Source:** `src/lib/snapshot/diff.test.ts:5-12` (`snap()`) and `src/lib/sources/schema.test.ts:4-17` (`valid` literal). Apply to every risk test that needs Alert instances — module-level builder with sensible defaults + override merge.

### ESLint override block

**Source:** `eslint.config.mjs:7-42`. Apply to D-03 step 3. Use `paths:` for exact names, `patterns:` for globs.

### Object.freeze re-export

**Source:** `src/lib/sources/registry-meta.ts:13-20`. Apply to: `vocab.ts`, `sources/*.ts` SEVERITY_TABLE.

## No Analog Found

| File                            | Reason                              | Fallback                                                                                              |
| ------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `.dependency-cruiser.cjs`       | First depcruise config in repo.     | Use CONTEXT D-03 step 1 verbatim — already a complete working config.                                 |
| Snapshot test format (`*.snap`) | First Vitest snapshot test in repo. | Vitest default `__snapshots__/` directory + `toMatchSnapshot()`. No project-specific override needed. |

## Metadata

**Analog search scope:** `src/lib/**`, `src/app/api/**`, `tests/**`, repo root configs.
**Files scanned:** 24 `.ts`, 4 configs (vitest, eslint, ci.yml, package.json), 1 fixture, 1 README.
**Pattern extraction date:** 2026-05-02.
