---
phase: 04-first-two-adapters
plan: 04
type: execute
wave: 1
depends_on: ["04-01"]
files_modified:
  - scripts/lib/fixture-runner.ts
  - scripts/lib/fixture-runner.test.ts
  - scripts/refresh-inmet.ts
  - tests/fixtures/sources/_stub/inmet-list-stub.json
  - tests/fixtures/sources/_stub/inmet-cap-stub.xml
  - package.json
autonomous: true
requirements: [ADAPT-04]
must_haves:
  truths:
    - "pnpm fixtures:refresh:inmet exists and runs"
    - "Refresh writes inmet-<ISO-date>.xml + inmet-<ISO-date>.list.json into tests/fixtures/sources/"
    - "On no prior fixture: writes new fixture, exits 0"
    - "On unchanged shape (only leaf-value diffs): exits 0 with diff printed"
    - "On structural drift (keys added/removed/renamed): exits 1 with diff printed"
    - "Script supports --dry-run mode that reads from tests/fixtures/sources/_stub/ instead of network"
    - "INGEST_TOKEN is NOT required — refresh hits upstream APIs directly, not /api/ingest"
    - "vitest.config.ts is NOT modified by this plan (Wave 0 pre-extended the glob)"
  artifacts:
    - path: "scripts/lib/fixture-runner.ts"
      provides: "Shared write/diff/exit logic + structural-diff util"
      exports: ["runFixtureRefresh", "structuralDiff", "DiffResult"]
    - path: "scripts/lib/fixture-runner.test.ts"
      provides: "Vitest coverage on structuralDiff (leaf-only vs structural)"
      min_lines: 100
    - path: "scripts/refresh-inmet.ts"
      provides: "INMET refresh entrypoint (list + at least one CAP doc) with --dry-run support"
      max_lines: 80
    - path: "tests/fixtures/sources/_stub/inmet-list-stub.json"
      provides: "Local stub for --dry-run mode"
      min_lines: 1
    - path: "tests/fixtures/sources/_stub/inmet-cap-stub.xml"
      provides: "Local stub for --dry-run mode"
      min_lines: 5
    - path: "package.json"
      provides: "fixtures:refresh:inmet script"
      contains: "fixtures:refresh:inmet"
  key_links:
    - from: "scripts/refresh-inmet.ts"
      to: "scripts/lib/fixture-runner.ts"
      via: "import { runFixtureRefresh }"
      pattern: "from \\\"\\./lib/fixture-runner\\\""
---

<objective>
Ship `pnpm fixtures:refresh:inmet` plus the shared runner library that powers it. The runner fetches the live INMET source (or a local stub in `--dry-run` mode), validates against the source's zod schema, writes a date-stamped fixture, and emits a unified diff with a structural-vs-leaf classification (exit 0 = leaf-only, exit 1 = structural drift).

**CEMADEN refresh is NOT shipped in Phase 4** (Path C — CEMADEN deferred to P5). The `runFixtureRefresh` runner is parameterized on `source` so P5 can add `scripts/refresh-cemaden.ts` as a thin entrypoint with no runner changes.

Purpose: Maintainer tooling for capturing real INMET responses and detecting upstream schema drift. This is Canal 1 (manual refresh) of the three-canal drift strategy; Canal 3 (contract tests in CI) ships in plan 04-05; Canal 2 (proactive sentinel) deferred to P6 per CONTEXT.

Output: Shared runner + INMET refresh script + `--dry-run` mode + local stubs + `package.json` script. **Does NOT modify `vitest.config.ts`** (Wave 0 pre-extended the include glob — resolves W-4).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/04-first-two-adapters/04-SPEC.md
@.planning/phases/04-first-two-adapters/04-CONTEXT.md
@.planning/phases/04-first-two-adapters/04-RESEARCH.md
@.planning/phases/04-first-two-adapters/04-01-SUMMARY.md

<interfaces>
<!-- Wave 0 dep already pinned. Use tsx (devDep added in 04-01) to run TS directly. -->
<!-- DO NOT import from src/lib/sources/inmet.ts — Wave 1 parallel; refresh script uses raw HTTP only and (for diff) the Wave 0 parseCapXml. -->

Refresh runner contract:

```ts
export type DiffResult = {
  kind: "no_prior" | "leaf_only" | "structural_drift";
  diff: string;
  newPath: string;
  priorPath: string | null;
};

export async function runFixtureRefresh(opts: {
  source: "cemaden" | "inmet"; // 'cemaden' reserved for P5; only 'inmet' wired in P4
  ext: "json" | "xml" | "list.json";
  fetchPayload: () => Promise<string>;
  parseForDiff?: (text: string) => unknown;
}): Promise<DiffResult>;
```

CLI contract for `scripts/refresh-inmet.ts`:

```
Usage: tsx scripts/refresh-inmet.ts [--dry-run]

  --dry-run   Read fixtures from tests/fixtures/sources/_stub/ instead of
              hitting INMET. Used by automated verify; does NOT touch the
              network. Writes outputs with today's date as usual.
```

Output filename convention: `tests/fixtures/sources/{source}-{YYYY-MM-DD}.{ext}` (UTC).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Shared runner + structuralDiff util + tests</name>
  <files>scripts/lib/fixture-runner.ts, scripts/lib/fixture-runner.test.ts</files>
  <behavior>
    - `structuralDiff(prior: unknown, next: unknown): "leaf_only" | "structural_drift"`:
      - Deep-walk both trees. If the SET of keys at every object level matches AND every array length is comparable, classify as `leaf_only` even if values differ.
      - If any key added/removed/renamed at any depth, OR an array element has new/missing key shape, classify as `structural_drift`.
      - Type changes (string → number) at leaves count as structural_drift.
    - `runFixtureRefresh`:
      1. Fetch payload text via `opts.fetchPayload()`.
      2. Find most recent prior fixture matching `tests/fixtures/sources/{source}-*.${ext}` (alphabetical = chronological).
      3. Compute target path with today's UTC date.
      4. If no prior: write new file → return `{ kind: "no_prior", ... }`.
      5. If prior exists: write new file, then compute diff:
         - Unified diff (line-based) of prior vs new text.
         - If `parseForDiff` provided: parse both → run `structuralDiff(parsedPrior, parsedNext)`.
         - Else: simple "did keys change" heuristic on JSON.parse for `.json`.
      6. Return `DiffResult`.
    - Caller decides exit code: `no_prior` / `leaf_only` → 0; `structural_drift` → 1.

    Tests (10 cases):
    - structuralDiff identical → leaf_only.
    - structuralDiff same shape, different values → leaf_only.
    - structuralDiff extra key at depth 2 → structural_drift.
    - structuralDiff removed key → structural_drift.
    - structuralDiff array length differs same shape → leaf_only.
    - structuralDiff array element new key → structural_drift.
    - structuralDiff type change → structural_drift.
    - runFixtureRefresh no prior → writes file, returns `no_prior`.
    - runFixtureRefresh unchanged prior → returns `leaf_only`.
    - runFixtureRefresh structural diff → returns `structural_drift`.

  </behavior>
  <action>
    1. Create `scripts/lib/fixture-runner.ts` with `node:fs/promises`, `node:path`, recursive `structuralDiff`, `runFixtureRefresh`. Hand-roll minimal line-by-line diff (zero new runtime deps).
    2. Create `scripts/lib/fixture-runner.test.ts` with the 10 cases.
    3. **Do NOT modify `vitest.config.ts`** — Wave 0 already extended the glob to cover `scripts/**/*.test.ts` (W-4 resolution).
  </action>
  <verify>
    <automated>pnpm test -- scripts/lib/fixture-runner.test.ts</automated>
  </verify>
  <done>fixture-runner.ts compiles, all 10 tests pass; vitest.config.ts UNCHANGED.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: scripts/refresh-inmet.ts with --dry-run + stub fixtures + package.json wiring</name>
  <files>scripts/refresh-inmet.ts, tests/fixtures/sources/_stub/inmet-list-stub.json, tests/fixtures/sources/_stub/inmet-cap-stub.xml, package.json</files>
  <behavior>
    - `refresh-inmet.ts`: TWO fetches against INMET (or stub files in `--dry-run`).
      - List: `INMET_CAP_LIST` → JSON list. Picks the first active id.
      - CAP: fetches that one CAP XML by id via `INMET_CAP_DETAIL(id)`.
      - Writes:
        - `tests/fixtures/sources/inmet-{date}.xml` (CAP doc)
        - `tests/fixtures/sources/inmet-{date}.list.json` (list response)
      - parseForDiff: `.xml` → `parseCapXml` (from Wave 0); `.list.json` → `JSON.parse`.
      - Runner called twice; final exit code = `max(kind1, kind2)` severity.
      - If list returns 0 active alerts: write list-only fixture, log warning, exit 0.
    - `--dry-run` flag: instead of `fetch()`, read from `tests/fixtures/sources/_stub/inmet-list-stub.json` and `_stub/inmet-cap-stub.xml`. Otherwise behavior identical (writes dated fixture, computes diff vs any prior dated fixture).
    - Stub fixtures: minimal but schema-valid INMET list + CAP XML with `<info xml:lang="pt-BR">`.
    - `package.json`:
      ```json
      "fixtures:refresh:inmet": "tsx scripts/refresh-inmet.ts"
      ```
    - **CEMADEN refresh script NOT created in this plan** — deferred to P5 per Path C.
  </behavior>
  <action>
    1. Create `scripts/refresh-inmet.ts` (~70 lines):
       - Const URLs duplicated locally (DO NOT import from src/lib/sources/inmet.ts — Wave 1 parallel).
       - `parseArgs` for `--dry-run`.
       - In dry-run: `readFile("tests/fixtures/sources/_stub/inmet-list-stub.json")` and `_stub/inmet-cap-stub.xml`.
       - Otherwise: `fetch()` (Node 24 global) the live endpoints.
       - Call runner twice, exit per `max(kind1, kind2)`.
    2. Create `tests/fixtures/sources/_stub/inmet-list-stub.json` — JSON array with one `{ "id": "stub-12345", ... }` entry.
    3. Create `tests/fixtures/sources/_stub/inmet-cap-stub.xml` — minimal CAP doc with one `<info xml:lang="pt-BR">` block (severity, event, headline, area).
    4. Edit `package.json`: add the `fixtures:refresh:inmet` script alphabetically.
    5. **Do NOT add CEMADEN script.** P5 will add it.
  </action>
  <verify>
    <automated>tsx scripts/refresh-inmet.ts --dry-run && node -e "const fs=require('fs');const f=fs.readdirSync('tests/fixtures/sources').filter(x=>/^inmet-\\d{4}-\\d{2}-\\d{2}\\.(xml|list\\.json)$/.test(x));if(f.length<2){console.error('expected 2 dated fixtures, got',f);process.exit(1)};console.log('wrote',f);const p=require('./package.json');if(!p.scripts['fixtures:refresh:inmet']){console.error('missing script');process.exit(1)}"</automated>
  </verify>
  <done>--dry-run executes against local stubs, writes 2 dated fixtures, exit 0; package.json script present; no network used; vitest.config.ts unchanged.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                            | Description                                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| upstream INMET API → refresh script | Same as adapter — untrusted payload, but no production effect (only writes to dev-tree fixture file) |
| committed fixture → contract tests  | Trusted: developer reviews diff before commit                                                        |

## STRIDE Threat Register (ASVS L2)

| Threat ID  | Category               | Component                                                | Disposition | Mitigation Plan                                                                         |
| ---------- | ---------------------- | -------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| T-04-04-01 | Tampering              | Auto-committed fixtures hide silent drift                | mitigate    | Refresh is manual; structural_drift exit-1 surfaces on `pnpm` invocation                |
| T-04-04-02 | Information Disclosure | Refresh prints upstream payload to terminal/log          | mitigate    | Print only diff classification + counts + path; full diff via `--verbose`               |
| T-04-04-03 | Tampering              | Maintainer overwrites real-prod fixture with bad capture | accept      | Manual commit gate; PR review                                                           |
| T-04-04-04 | DoS                    | Script bombards INMET list endpoint causing 429          | mitigate    | Single fetch per run; `--dry-run` for tests; if rate-limited, exit with helpful message |

</threat_model>

<verification>
- `pnpm test -- scripts/lib/fixture-runner.test.ts` passes (10 cases)
- `tsx scripts/refresh-inmet.ts --dry-run` exits 0, writes `tests/fixtures/sources/inmet-{today}.xml` + `inmet-{today}.list.json`
- `node -e "const p=require('./package.json');if(!p.scripts['fixtures:refresh:inmet']){process.exit(1)}"` passes
- `node -e "const p=require('./package.json');if(p.scripts['fixtures:refresh:cemaden']){console.error('CEMADEN script must NOT exist in P4');process.exit(1)}"` passes (Path C invariant)
- `grep -c "structuralDiff" scripts/lib/fixture-runner.ts` ≥ 1
- `grep -c "structural_drift" scripts/lib/fixture-runner.ts` ≥ 2
- `pnpm exec tsc --noEmit` clean
- `git diff HEAD -- vitest.config.ts | wc -l` = 0 (vitest config NOT touched — W-4 invariant)
</verification>

<success_criteria>
INMET refresh script ships with `--dry-run` support backed by local stub fixtures. Shared runner is source-agnostic and ready for P5 to add `scripts/refresh-cemaden.ts`. `vitest.config.ts` is NOT modified by this plan (W-4 resolved by Wave 0 pre-extension). Plan 04-05 uses this script (in dry-run mode if INMET is rate-limited) to capture canonical fixtures.

## Dimension 8 Validation Requirements

Three load-bearing invariants under explicit verification:

1. Structural-vs-leaf classifier covered by 7 unit tests.
2. `--dry-run` path produces correct dated fixtures with no network — verified via `tsx ... --dry-run` exit 0 + file presence assertion.
3. `vitest.config.ts` NOT modified (W-4 resolution; race-prevention).
   </success_criteria>

<output>
After completion, create `.planning/phases/04-first-two-adapters/04-04-SUMMARY.md` documenting endpoint constants used, exit-code semantics, --dry-run mechanics, W-3/W-4 resolutions, and CEMADEN P5 carry-over.
</output>
