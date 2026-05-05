---
phase: 03-pure-risk-engine
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - src/lib/sources/schema.ts
  - src/lib/api/schemas.ts
  - tests/fixtures/sources/stub-default.json
  - tests/fixtures/sources/stub-default.test.ts # if exists; otherwise N/A
autonomous: true
requirements: [RISK-03]
must_haves:
  truths:
    - "AlertSchema['severity'] accepts only 'low' | 'moderate' | 'high' | 'extreme'"
    - "RISK_LEVELS const exported from src/lib/sources/schema.ts as canonical SoT"
    - "src/lib/api/schemas.ts re-exports RISK_LEVELS from sources/schema (no duplicate)"
    - "tests/fixtures/sources/stub-default.json severity values are Severity (not RiskLevel) strings"
    - "Each fixture entry's payload_hash is recomputed via computePayloadHash"
    - "Hash regen is done by a one-shot plain Node .mjs script using native crypto/fs (tsx is NOT in devDependencies — confirmed against package.json)"
    - "P2 ingest/archive/diff route tests still pass (they assert on snapshot.formulaVersion + snapshot shape, not Alert.severity values)"
  artifacts:
    - path: "src/lib/sources/schema.ts"
      provides: "SEVERITIES = ['low','moderate','high','extreme'] + RISK_LEVELS = ['green','yellow','orange','red','unknown']"
    - path: "src/lib/api/schemas.ts"
      provides: "Re-export of RISK_LEVELS from sources/schema (no local declaration)"
    - path: "tests/fixtures/sources/stub-default.json"
      provides: "Fixture with Severity-valued severity field + recomputed payload_hash per entry"
  key_links:
    - from: "src/lib/api/schemas.ts"
      to: "src/lib/sources/schema.ts"
      via: "import { RISK_LEVELS } from '@/lib/sources/schema' (or relative)"
      pattern: "import.*RISK_LEVELS.*sources/schema"
---

# Plan 01 — D-01 Alert.severity schema fix + RISK_LEVELS reconciliation

**Goal:** Fix the P2 schema/contract mismatch so `Alert.severity` carries `Severity` (per-alert dimension) and `RISK_LEVELS` lives in one place. Unblocks RISK-02/03/04 type tests in later waves.

## Required reading

- `.planning/phases/03-pure-risk-engine/03-SPEC.md` (RISK-03)
- `.planning/phases/03-pure-risk-engine/03-CONTEXT.md` (D-01 — full 5-step procedure)
- `.planning/phases/03-pure-risk-engine/03-PATTERNS.md` (lines 178-188 — "src/lib/sources/schema.ts modification (D-01)" and recommendation to canonicalize in schema.ts)
- `src/lib/sources/schema.ts` (current `SEVERITIES` at line 19; `computePayloadHash` at lines 99-110)
- `src/lib/api/schemas.ts` (current `RISK_LEVELS` at line 49)
- `tests/fixtures/sources/stub-default.json` (3 entries — lines 4, 22, 40 carry `severity`)
- `risk-formula-v0.md` (severity vocabulary)
- `package.json` (confirmed: NO `tsx` in devDependencies — regen script must be plain Node `.mjs`)

## Files touched

| Path                                       | Change                | Notes                                                                      |
| ------------------------------------------ | --------------------- | -------------------------------------------------------------------------- | -------- | -------- | ----- | ------------------------------------- |
| `src/lib/sources/schema.ts`                | modify                | Flip `SEVERITIES` values; add `RISK_LEVELS` const                          |
| `src/lib/api/schemas.ts`                   | modify                | Replace local `RISK_LEVELS` declaration with re-export from sources/schema |
| `tests/fixtures/sources/stub-default.json` | modify                | Severity values + recomputed `payload_hash` per row                        |
| _grep targets_                             | modify (only if hits) | P2 tests that assert literal `severity: "green"                            | "yellow" | "orange" | "red" | "unknown"` on Alert (NOT on snapshot) |

## Tasks

### Task 1.1 — Flip `SEVERITIES` + add `RISK_LEVELS` in `src/lib/sources/schema.ts`

<files>src/lib/sources/schema.ts</files>

<action>
Per D-01 step 1:

1. Replace line 19 from `export const SEVERITIES = ["green","yellow","orange","red","unknown"] as const;` (or current values) to:
   ```ts
   export const SEVERITIES = ["low", "moderate", "high", "extreme"] as const;
   ```
2. Immediately after, add:
   ```ts
   /** State-level computed RiskLevel set (RISK-02). Canonical SoT — re-exported by api/schemas.ts. */
   export const RISK_LEVELS = ["green", "yellow", "orange", "red", "unknown"] as const;
   export type RiskLevel = (typeof RISK_LEVELS)[number];
   ```
3. Confirm the existing `Severity` type alias (`export type Severity = (typeof SEVERITIES)[number];`) is present near the const — if not, add it.
4. Confirm `AlertSchema.severity` uses `z.enum(SEVERITIES)` (not a hardcoded array literal). If hardcoded, switch to `z.enum(SEVERITIES)`.
5. Header JSDoc: append a one-line note: `// D-01: SEVERITIES = per-alert severity (low..extreme); RISK_LEVELS = state-level computed (green..unknown).`
   </action>

<verify>
  <automated>pnpm tsc --noEmit</automated>
</verify>

<done>
- `SEVERITIES` exports the 4 alert-severity literals
- `RISK_LEVELS` + `RiskLevel` type exported from same file
- `AlertSchema.severity` is `z.enum(SEVERITIES)` (no hardcoded literal list)
- `tsc --noEmit` clean
</done>

### Task 1.2 — Re-export `RISK_LEVELS` from `src/lib/api/schemas.ts` (deduplicate)

<files>src/lib/api/schemas.ts</files>

<action>
Per D-01 step 5 + RESEARCH open question 2 + PATTERNS line 187-188:

1. Locate the existing `RISK_LEVELS` declaration at ~line 49 (currently `export const RISK_LEVELS = [...] as const;` with `RiskLevel` type alias).
2. Replace the local declaration with a re-export:
   ```ts
   export { RISK_LEVELS, type RiskLevel } from "@/lib/sources/schema";
   ```
   (Keep relative path `../sources/schema` if rest of file uses relative imports — match existing convention by reading the file's other imports.)
3. Verify all existing usages of `RISK_LEVELS` / `RiskLevel` within this file still type-check (they should — names unchanged).
4. Verify zod usages like `z.enum(RISK_LEVELS)` still work (re-exported const has same shape).
   </action>

<verify>
  <automated>pnpm tsc --noEmit && pnpm test src/lib/api/schemas.test.ts</automated>
</verify>

<done>
- `RISK_LEVELS` no longer locally declared in `api/schemas.ts`
- Re-exported from `@/lib/sources/schema`
- Existing `api/schemas.test.ts` passes (P2 test, asserts schema shape)
- `tsc --noEmit` clean
</done>

### Task 1.3 — Update `tests/fixtures/sources/stub-default.json` severity values + regen `payload_hash` (plain Node `.mjs`)

<files>tests/fixtures/sources/stub-default.json, scripts/regen-stub-hashes.mjs (TEMP, deleted at end of task)</files>

<action>
Per D-01 step 2 + PATTERNS line 173-176.

**Tooling lock (per plan-checker W-6):** `tsx` is NOT in `devDependencies` (verified against `package.json`). The regen script MUST be a plain Node `.mjs` file using native `node:crypto` and `node:fs` imports. Do NOT introduce `tsx` as a transitive dependency.

**Step A — Map old→new severity values** (preserves relative ranking):

| Old (RiskLevel) | New (Severity) |
| --------------- | -------------- | ------------------------------------ |
| `green`         | `low`          |
| `yellow`        | `moderate`     |
| `orange`        | `high`         |
| `red`           | `extreme`      |
| `unknown`       | `moderate`     | _(per RISK-04 conservative default)_ |

Edit `tests/fixtures/sources/stub-default.json` — replace each entry's `severity` value using the mapping above. Do NOT touch other fields.

**Step B — Recompute `payload_hash` for every entry** using a plain Node `.mjs` script.

The hash is part of the canonical input (`schema.ts:99-110`), so flipping `severity` invalidates each hash. Read `src/lib/sources/schema.ts` lines 99-110 to extract the canonical-input + sha256 algorithm, then port it inline into the script (so we don't need to compile TS to run it).

Create `scripts/regen-stub-hashes.mjs`:

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

// PORTED from src/lib/sources/schema.ts:99-110 — keep in sync if the canonical
// algorithm changes. Algorithm: sort keys recursively, JSON.stringify, sha256.

function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = canonicalize(value[key]);
  }
  return sorted;
}

function computePayloadHash(input) {
  // CONFIRM: read schema.ts:99-110 and adjust if the real implementation differs
  // (e.g., specific keys excluded from the hash input).
  const canonical = canonicalize(input);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

const file = "tests/fixtures/sources/stub-default.json";
const data = JSON.parse(readFileSync(file, "utf8"));
const rows = Array.isArray(data) ? data : data.alerts;
for (const row of rows) {
  // Strip existing payload_hash so it isn't fed back into the hash input.
  const { payload_hash, ...rest } = row;
  row.payload_hash = computePayloadHash(rest);
}
writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(`Regenerated ${rows.length} hashes in ${file}.`);
```

Run: `node scripts/regen-stub-hashes.mjs`

**Critical:** before committing, run a vitest pass over the fixture loader test (Step D below) to confirm the regenerated hashes match what `computePayloadHash` (the real one in TS) would produce. If a vitest sanity test exists that imports the fixture and re-hashes, the hashes must round-trip. If they don't, the ported algorithm in the `.mjs` script diverged from the TS source — fix the script to match.

**Step C — Delete the script**: `rm scripts/regen-stub-hashes.mjs` (it was a one-shot — keeping it tempts future drift).

**Step D — Sanity check**: load the fixture in a vitest run and confirm `AlertSchema.parse(row)` succeeds for every entry (zod will reject if severity is wrong shape). If a "hash matches computePayloadHash" assertion exists in any P2 test, that test now serves as the regen ground-truth check.
</action>

<verify>
  <automated>pnpm test -- tests/fixtures/sources</automated>
</verify>

<done>
- All entries in `tests/fixtures/sources/stub-default.json` have severity ∈ {low, moderate, high, extreme}
- All `payload_hash` values regenerated via plain Node `.mjs` script (no `tsx`, no new dependencies)
- `scripts/regen-stub-hashes.mjs` deleted
- Any P2 test that loads this fixture still passes (including any hash-roundtrip assertion)
</done>

### Task 1.4 — Sweep + fix P2 tests that grep on Alert.severity literals

<files>(any \*.test.ts under src/ and tests/ that match the grep below — TBD by sweep)</files>

<action>
Per D-01 step 3:

1. Run sweep: `grep -rEn "severity\\s*:\\s*['\"](green|yellow|orange|red|unknown)['\"]" src tests` (or use Grep tool).
2. For each hit, classify:
   - **(a) Asserts on `Alert.severity` value** → Convert to Severity literal using mapping in Task 1.3 Step A.
   - **(b) Asserts on `StateSnapshot.level` or `snapshot.level` (RiskLevel context)** → Leave unchanged. RISK_LEVELS still uses these strings.
   - **(c) JSON fixture comment/doc** → Leave; only string-asserted code matters.
3. Run `pnpm test` after sweep — investigate any new failures: are they (a) the expected fixture-content mismatch we just fixed, or (b) a real regression?
4. Commit a single targeted edit per file. If sweep returns zero hits in code (only the fixture file), this task is a no-op; commit message: `test(03-01): no Alert.severity literal assertions found in tree`.
   </action>

<verify>
  <automated>pnpm test && pnpm tsc --noEmit && grep -rEn "severity\\s*:\\s*['\"](green|yellow|orange|red|unknown)['\"]" src tests | grep -v "level:" | wc -l</automated>
</verify>

<done>
- Sweep returns zero hits where the grepped line is asserting on `Alert.severity` (RISK_LEVELS hits on `snapshot.level` are fine and expected)
- `pnpm test` green
- `pnpm tsc --noEmit` clean
</done>

## Verification (plan-wide)

```bash
pnpm tsc --noEmit               # types compile after schema split
pnpm test                       # P2 suite still green
grep -n "RISK_LEVELS\\s*=" src/lib/api/schemas.ts  # expect 0 hits (only re-export)
grep -n "RISK_LEVELS\\s*=" src/lib/sources/schema.ts # expect 1 hit
```

Expected output:

- `tsc --noEmit`: no errors
- `pnpm test`: existing P2 suite passes (route tests still see `formulaVersion: "v0-placeholder"` until P4 swaps)
- grep: canonical `RISK_LEVELS` lives only in `sources/schema.ts`

## RISK-IDs covered

- **RISK-03** — `Severity` type now correctly `low|moderate|high|extreme`; `Alert['severity']` carries it.

## Dependencies

None (Wave 0).

## Estimated commits

4 (one per task: 1.1 schema flip, 1.2 api re-export, 1.3 fixture regen, 1.4 sweep — last may be empty/skipped).
