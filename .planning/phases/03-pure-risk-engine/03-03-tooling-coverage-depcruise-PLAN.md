---
phase: 03-pure-risk-engine
plan: 03
type: execute
wave: 0
depends_on: []
files_modified:
  - package.json
  - vitest.config.ts
  - eslint.config.mjs
  - .dependency-cruiser.cjs
  - .github/workflows/ci.yml
autonomous: true
requirements: [RISK-01]
must_haves:
  truths:
    - "dependency-cruiser@^17.3.10 + @vitest/coverage-v8@4.1.5 installed as devDeps"
    - ".dependency-cruiser.cjs exists with risk-engine-isolation + risk-engine-no-node forbidden rules"
    - "vitest.config.ts has coverage block scoped to src/lib/risk/** with 100/100/100/100 thresholds"
    - "eslint.config.mjs has override for src/lib/risk/**/*.ts (production code only) banning node:* + fs/path/crypto/os + pino/@/lib/log; sibling override re-allows node:* in src/lib/risk/**/*.test.ts so test files can import node:fs/node:crypto for fixture setup"
    - "package.json has depcruise + test:coverage scripts"
    - ".github/workflows/ci.yml runs pnpm depcruise (test:coverage step is deferred to Plan 04 to avoid empty-include vacuous failure)"
    - "pnpm depcruise exits 0 (no risk/ files exist yet, so no rule applies — vacuously green)"
  artifacts:
    - path: ".dependency-cruiser.cjs"
      provides: "risk-engine-isolation + risk-engine-no-node forbidden rules"
      contains: "risk-engine-isolation"
    - path: "vitest.config.ts"
      provides: "coverage block with src/lib/risk/** include + 100% thresholds"
      contains: "coverage:"
    - path: "eslint.config.mjs"
      provides: "src/lib/risk/**/*.ts production override + src/lib/risk/**/*.test.ts re-allow override"
      contains: "src/lib/risk/**"
    - path: "package.json"
      provides: "depcruise + test:coverage scripts; new devDeps"
      contains: '"depcruise":'
    - path: ".github/workflows/ci.yml"
      provides: "pnpm depcruise CI step (test:coverage step lands in Plan 04)"
      contains: "depcruise"
  key_links:
    - from: ".github/workflows/ci.yml"
      to: "package.json scripts"
      via: "pnpm depcruise"
      pattern: "pnpm depcruise"
    - from: ".dependency-cruiser.cjs"
      to: "tsconfig.json"
      via: "options.tsConfig.fileName"
      pattern: "tsConfig.*tsconfig\\.json"
---

# Plan 03 — D-03 Tooling: dep-cruiser + scoped Vitest coverage + ESLint guard

**Goal:** Install + configure all three CI-enforcement tools BEFORE any `src/lib/risk/` code exists. This way every later plan's first commit hits the gates immediately.

**Sequencing note (per plan-checker W-7):** The `pnpm test:coverage` CI step is added in Plan 04 (after `types.ts` lands), NOT here. Vitest v8 coverage with `include: ["src/lib/risk/**/*.ts"]` may fail vacuously when the include glob matches zero files. Plan 03 lands depcruise + scripts + Vitest config + ESLint config; Plan 04 wires the coverage step into CI.

## Required reading

- `.planning/phases/03-pure-risk-engine/03-CONTEXT.md` (D-03 — full 3-step procedure)
- `.planning/phases/03-pure-risk-engine/03-RESEARCH.md` (Patterns 1, 2, 3 — verbatim configs + pitfalls)
- `.planning/phases/03-pure-risk-engine/03-PATTERNS.md` (lines 155-172 — config-mod analogs)
- `package.json` (current scripts + devDependencies)
- `vitest.config.ts` (current `test:` block — must preserve `pool: forks`, `globalSetup`, `setupFiles`)
- `eslint.config.mjs` (existing override at lines 7-42 is the analog)
- `.github/workflows/ci.yml` (existing step pattern at lines 50-60)
- `tsconfig.json` (dep-cruiser needs to read paths)

## Files touched

| Path                       | Change                                                               |
| -------------------------- | -------------------------------------------------------------------- |
| `package.json`             | modify (devDeps + scripts)                                           |
| `vitest.config.ts`         | modify (append `coverage:` block)                                    |
| `eslint.config.mjs`        | modify (append override block + sibling test override)               |
| `.dependency-cruiser.cjs`  | **create**                                                           |
| `.github/workflows/ci.yml` | modify (add depcruise step only — coverage step deferred to Plan 04) |

## Tasks

### Task 3.1 — Install devDeps + add scripts

<files>package.json</files>

<action>
1. Run: `pnpm add -D dependency-cruiser@^17.3.10 @vitest/coverage-v8@4.1.5`
   - **Pin `@vitest/coverage-v8` exactly to `4.1.5`** to match `vitest@4.1.5` minor (RESEARCH §"Standard Stack" — coupling required).
2. Open `package.json`. In `scripts`, add (alphabetical insertion near existing `test*` scripts):
   ```json
   "depcruise": "depcruise --config .dependency-cruiser.cjs src",
   "test:coverage": "vitest run --coverage"
   ```
3. Confirm `devDependencies` now contains:
   - `"dependency-cruiser": "^17.3.10"`
   - `"@vitest/coverage-v8": "4.1.5"` (no caret — exact pin)
4. Commit `package.json` + `pnpm-lock.yaml` together.
</action>

<verify>
  <automated>pnpm exec depcruise --version && pnpm exec vitest --version && grep -E "\"depcruise\"|\"test:coverage\"" package.json | wc -l</automated>
</verify>

<done>
- `pnpm exec depcruise --version` prints `17.3.x`
- `pnpm exec vitest --version` prints `4.1.5`
- `grep` returns `2` (both new scripts present)
- `pnpm-lock.yaml` updated
</done>

### Task 3.2 — Create `.dependency-cruiser.cjs`

<files>.dependency-cruiser.cjs</files>

<action>
Per D-03 step 1 + RESEARCH Pattern 1 (verbatim) — file at repo root:

```js
/** @type {import('dependency-cruiser').IConfiguration} */
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
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
  },
};
```

**Pitfalls reaffirmed (RESEARCH lines 158-164):**

- Forward-slash regex only — even on Windows, dep-cruiser normalizes.
- `tsConfig` MUST be set or alias resolution fails silently → false-negative passes.
- Do NOT pass `--include-only` — full `src/` scan needed for transitive `node:*` detection.
  </action>

<verify>
  <automated>pnpm depcruise && pnpm depcruise --validate</automated>
</verify>

<done>
- `.dependency-cruiser.cjs` exists at repo root
- `pnpm depcruise` exits 0 (no `src/lib/risk/` files exist yet → vacuously green)
- Config validates (exit 0)
</done>

### Task 3.3 — Extend `vitest.config.ts` with scoped coverage block

<files>vitest.config.ts</files>

<action>
Per D-03 step 2 + RESEARCH Pattern 2:

1. Open `vitest.config.ts`. Locate the existing `test: { ... }` block.
2. Inside `test:` (after the existing `exclude:` field — preserve all existing fields including `pool: 'forks'`, `globalSetup`, `setupFiles`, `environment`, `globals`), append:
   ```ts
   coverage: {
     provider: "v8",
     include: ["src/lib/risk/**/*.ts"],
     exclude: [
       "src/lib/risk/**/*.test.ts",
       "src/lib/risk/types.ts",
     ],
     thresholds: {
       lines: 100,
       branches: 100,
       functions: 100,
       statements: 100,
     },
     reporter: ["text", "json-summary"],
   },
   ```
3. **Do NOT touch** `pool`, `globalSetup`, `setupFiles` — these are load-bearing per the user's MEMORY note (Vitest globalSetup vs setupFiles).
4. **Note on `types.ts` exclusion** (RESEARCH Pitfall 1): `types.ts` will be created in Plan 04 as type-only. Excluding it prevents v8 reporting `0/0` artefacts. If `types.ts` ends up containing a runtime const (it should NOT per Plan 04), revisit this exclusion.
   </action>

<verify>
  <automated>pnpm test 2>&1 | tail -5 && grep -n "coverage:" vitest.config.ts</automated>
</verify>

<done>
- `coverage:` block present and valid TS
- Existing tests still execute (P2 suite green via `pnpm test`)
- Note: `pnpm test:coverage` is NOT verified in this plan — Plan 04 wires it into CI once `types.ts` exists. Local invocation may fail vacuously here; that's expected and the reason for the deferral.
</done>

### Task 3.4 — Extend `eslint.config.mjs` with `src/lib/risk/**` override (production + test sibling)

<files>eslint.config.mjs</files>

<action>
Per D-03 step 3 + RESEARCH Pattern 3 + PATTERNS line 218 (mirror existing edge-route override at lines 7-42).

**Two-block strategy (per plan-checker W-1):** the production override bans node:_ / fs / pino. The test sibling override RE-ALLOWS node:_ + fs / crypto so risk test files can use Node built-ins for fixture setup (e.g., reading snapshot files, crypto for hash sanity checks).

1. Open `eslint.config.mjs`. Locate the closing `]` of the exported flat-config array.
2. Append two new override objects as the LAST elements (preserves existing edge-route override at lines 7-42 — flat-config cascades concatenate per RESEARCH line 244):

   ```js
   // BLOCK A — production code under src/lib/risk/ (edge-safe; pure)
   {
     files: ["src/lib/risk/**/*.ts"],
     ignores: ["src/lib/risk/**/*.test.ts", "src/lib/risk/**/*.type-test.ts"],
     rules: {
       "no-restricted-imports": [
         "error",
         {
           paths: [
             { name: "pino", message: "Pure module — no logging in risk engine." },
             { name: "@/lib/log", message: "Pure module — no logging in risk engine." },
             { name: "fs", message: "Edge-safe — no Node built-ins in risk engine." },
             { name: "path", message: "Edge-safe — no Node built-ins in risk engine." },
             { name: "crypto", message: "Edge-safe — no Node built-ins in risk engine." },
             { name: "os", message: "Edge-safe — no Node built-ins in risk engine." },
           ],
           patterns: [
             {
               group: ["node:*"],
               message: "Edge-safe — no node:* imports in risk engine.",
             },
             {
               group: ["pino-*", "@/lib/log/*", "fs/*", "node:fs/*"],
               message: "Edge-safe — no Node built-ins / no logging in risk engine.",
             },
           ],
         },
       ],
     },
   },
   // BLOCK B — test files under src/lib/risk/: re-allow node:* + Node built-ins.
   //   Tests run only in Node (Vitest pool=forks); Node imports here do not leak
   //   into the edge-safe production graph (depcruise also exempts test files via
   //   the `from.path` regex which scopes to *.ts not *.test.ts in calculate.ts).
   {
     files: ["src/lib/risk/**/*.test.ts", "src/lib/risk/**/*.type-test.ts"],
     rules: {
       // Disable the restriction set above. ESLint flat-config cascades:
       // later override wins for matching files.
       "no-restricted-imports": "off",
     },
   },
   ```

3. **Note:** `vocab.ts` is allowed to import `@/lib/messages` — no rule blocks it (only `@/lib/log` is banned). PATTERNS line 244 confirms.
4. Verify `pnpm lint` still passes (no risk/ files yet → vacuous).
   </action>

<verify>
  <automated>pnpm lint</automated>
</verify>

<done>
- BLOCK A (production override) present with `paths` + `patterns` + `ignores: [*.test.ts, *.type-test.ts]`
- BLOCK B (test sibling override) present, sets `no-restricted-imports: off` for `*.test.ts` + `*.type-test.ts`
- `pnpm lint` exits 0 against existing tree
</done>

### Task 3.5 — Add depcruise CI step to `.github/workflows/ci.yml`

<files>.github/workflows/ci.yml</files>

<action>
Per D-03 step 1 + PATTERNS line 168-171.

**Sequencing note (W-7):** ONLY the depcruise step lands here. The `pnpm test:coverage` step is added in Plan 04 Task 4.3 — once `types.ts` exists, the v8 coverage include glob has at least one match and the step runs without vacuous-empty failure.

1. Open `.github/workflows/ci.yml`. Locate the test job's step list (around lines 50-60).
2. Insert a new step BETWEEN the existing `Lint` step and the existing test step:
   ```yaml
   - name: Dep-cruise (risk engine isolation)
     run: pnpm depcruise
   ```
3. **Do NOT modify the existing `pnpm test` step in this plan.** Plan 04 will replace it with `pnpm test:coverage`.
4. Commit. Push branch. Inspect first PR / push CI run for green status (depcruise should exit 0 vacuously since no risk/ files exist yet).
   </action>

<verify>
  <automated>git diff --stat .github/workflows/ci.yml && grep -E "depcruise" .github/workflows/ci.yml</automated>
</verify>

<done>
- `pnpm depcruise` step exists between Lint and Test
- Existing `pnpm test` step UNCHANGED (will be replaced in Plan 04)
- `git diff` shows only the depcruise insertion in the test job (no other jobs modified)
- Local CI dry-run via `act` (optional, if installed) or first push surfaces green
</done>

## Verification (plan-wide)

```bash
pnpm install                    # confirm lockfile
pnpm depcruise                  # exit 0 (vacuous; no src/lib/risk/ yet)
pnpm test                       # P2 suite green
pnpm lint                       # still green
pnpm tsc --noEmit               # still green
grep "depcruise" package.json .github/workflows/ci.yml
```

Expected: all commands exit 0; `depcruise` referenced in CI yml + scripts. `test:coverage` script exists in package.json but is NOT yet wired into CI (Plan 04 does that).

## RISK-IDs covered

- **RISK-01** — CI gate enforcement (the static lint that proves `calculate.ts` isolation in Plan 09).

## Dependencies

None (Wave 0). Independent of Plans 01, 02 (no file overlap).

## Estimated commits

5 (one per task). Tasks 3.1–3.4 can be squashed if reviewer prefers, but per-task commits make the toolchain history readable.
