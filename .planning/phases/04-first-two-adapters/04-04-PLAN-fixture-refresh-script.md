---
phase: 04-first-two-adapters
plan: 04
type: execute
wave: 1
depends_on: ["04-01"]
files_modified:
  - scripts/lib/fixture-runner.ts
  - scripts/lib/fixture-runner.test.ts
  - scripts/refresh-cemaden.ts
  - scripts/refresh-inmet.ts
  - package.json
autonomous: true
requirements: [ADAPT-04]
must_haves:
  truths:
    - "pnpm fixtures:refresh:cemaden and pnpm fixtures:refresh:inmet exist and run"
    - "Refresh writes <source>-<ISO-date>.<ext> into tests/fixtures/sources/"
    - "On no prior fixture: writes new fixture, exits 0"
    - "On unchanged shape (only leaf-value diffs): exits 0 with diff printed"
    - "On structural drift (keys added/removed/renamed): exits 1 with diff printed"
    - "INGEST_TOKEN is NOT required — refresh hits upstream APIs directly, not /api/ingest"
  artifacts:
    - path: "scripts/lib/fixture-runner.ts"
      provides: "Shared write/diff/exit logic + structural-diff util"
      exports: ["runFixtureRefresh", "structuralDiff", "DiffResult"]
    - path: "scripts/lib/fixture-runner.test.ts"
      provides: "Vitest coverage on structuralDiff (leaf-only vs structural)"
      min_lines: 100
    - path: "scripts/refresh-cemaden.ts"
      provides: "Thin entrypoint for CEMADEN"
      max_lines: 30
    - path: "scripts/refresh-inmet.ts"
      provides: "Thin entrypoint for INMET (list + at least one CAP doc bundled)"
      max_lines: 40
    - path: "package.json"
      provides: "fixtures:refresh:cemaden + :inmet scripts"
      contains: "fixtures:refresh:cemaden"
  key_links:
    - from: "scripts/refresh-cemaden.ts"
      to: "scripts/lib/fixture-runner.ts"
      via: "import { runFixtureRefresh }"
      pattern: "from \\\"\\./lib/fixture-runner\\\""
    - from: "scripts/refresh-inmet.ts"
      to: "scripts/lib/fixture-runner.ts"
      via: "import { runFixtureRefresh }"
      pattern: "from \\\"\\./lib/fixture-runner\\\""
---

<objective>
Ship `pnpm fixtures:refresh:cemaden` and `pnpm fixtures:refresh:inmet` plus the shared runner library that powers both. The runner fetches the live source, optionally validates against the source's zod schema, writes a date-stamped fixture, and emits a unified diff with a structural-vs-leaf classification (exit 0 = leaf-only, exit 1 = structural drift).

Purpose: Maintainer tooling for capturing real responses and detecting upstream schema drift. This is Canal 1 (manual refresh) of the three-canal drift strategy; Canal 3 (contract tests in CI) ships in plan 04-05; Canal 2 (proactive sentinel) is deferred to P6 per CONTEXT.

Output: Two refresh scripts + shared runner + `package.json` scripts.
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
@.planning/phases/04-01-SUMMARY.md

<interfaces>
<!-- Wave 0 dep already pinned. Use tsx (devDep added in 04-01) to run TS directly. -->
<!-- DO NOT import from src/lib/sources/cemaden.ts or inmet.ts here — those are Wave 1 parallel and may not exist yet. Refresh scripts use raw HTTP only and (for inmet) the Wave 0 parseCapXml. -->

Refresh runner contract:

```ts
export type DiffResult = {
  kind: "no_prior" | "leaf_only" | "structural_drift";
  diff: string; // unified diff text
  newPath: string; // path written
  priorPath: string | null;
};

export async function runFixtureRefresh(opts: {
  source: "cemaden" | "inmet";
  ext: "json" | "xml";
  fetchPayload: () => Promise<string>; // raw text content to write
  parseForDiff?: (text: string) => unknown; // optional: parse before structural-diff (XML for inmet)
}): Promise<DiffResult>;
```

Output filename convention: `tests/fixtures/sources/{source}-{YYYY-MM-DD}.{ext}` (UTC date).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Shared runner + structuralDiff util + tests</name>
  <files>scripts/lib/fixture-runner.ts, scripts/lib/fixture-runner.test.ts</files>
  <behavior>
    - `structuralDiff(prior: unknown, next: unknown): "leaf_only" | "structural_drift"`:
      - Deep-walk both trees. If the SET of keys at every object level matches AND every array length is comparable (length differs OK if elements have same keys), classify as `leaf_only` even if values differ.
      - If any key added/removed/renamed at any depth, OR an array element has a new/missing key shape, classify as `structural_drift`.
      - Type changes (string → number) at leaves count as structural_drift.
    - `runFixtureRefresh`:
      1. Fetch payload text via `opts.fetchPayload()`.
      2. Find the most recent prior fixture matching `tests/fixtures/sources/{source}-*.${ext}` (alphabetical sort = chronological because of ISO date).
      3. Compute target path with today's UTC date.
      4. If no prior: write new file → return `{ kind: "no_prior", diff: "(new fixture)", newPath, priorPath: null }`.
      5. If prior exists: write new file, then compute diff:
         - Unified diff (line-based) of prior vs new text → store in `diff`.
         - If `parseForDiff` provided: parse both → run `structuralDiff(parsedPrior, parsedNext)` → set `kind`.
         - Else: use simple "did keys change" heuristic on JSON.parse for `.json`.
      6. Return `DiffResult`.
    - Caller decides exit code based on `result.kind`:
      - `no_prior` → exit 0
      - `leaf_only` → exit 0
      - `structural_drift` → exit 1

    Tests:
    - `structuralDiff` with identical objects → leaf_only.
    - `structuralDiff` same shape, different leaf values → leaf_only.
    - `structuralDiff` extra key at depth 2 → structural_drift.
    - `structuralDiff` removed key → structural_drift.
    - `structuralDiff` array length differs but elements have same keys → leaf_only.
    - `structuralDiff` array element has new key → structural_drift.
    - `structuralDiff` type change (string vs number) → structural_drift.
    - `runFixtureRefresh` with no prior fixture → writes file, returns `no_prior`.
    - `runFixtureRefresh` with unchanged prior (mocked fs) → returns `leaf_only`.
    - `runFixtureRefresh` with structural diff → returns `structural_drift`.

  </behavior>
  <action>
    1. Create `scripts/lib/fixture-runner.ts`:
       - Import `node:fs/promises`, `node:path`. Implement `structuralDiff` (recursive). Implement `runFixtureRefresh`.
       - For unified diff: hand-roll a minimal line-by-line diff (no jsdiff dep — keep zero new runtime deps; jsdiff is dev-only and unnecessary if we just stream the new vs prior text). Acceptable: print "PRIOR:\n...\n\nNEW:\n..." with line counts. (Researcher prefers minimum-viable diff; maintainer reviews structural classification — full diff beauty is deferred to P6 with the sentinel.)
       - Export `runFixtureRefresh`, `structuralDiff`, `DiffResult`.
    2. Create `scripts/lib/fixture-runner.test.ts` with the 10 cases listed.
    3. Configure vitest to include `scripts/**/*.test.ts` (verify `vitest.config.ts` glob — extend if necessary).
  </action>
  <verify>
    <automated>pnpm test -- scripts/lib/fixture-runner.test.ts</automated>
  </verify>
  <done>fixture-runner.ts compiles, all 10 tests pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: scripts/refresh-cemaden.ts + refresh-inmet.ts + package.json wiring</name>
  <files>scripts/refresh-cemaden.ts, scripts/refresh-inmet.ts, package.json</files>
  <behavior>
    - `refresh-cemaden.ts`: fetches `CEMADEN_ENDPOINT` (constant duplicated locally — DO NOT import adapter; that's Wave 1 parallel and may not exist yet, plus we want refresh to work even if adapter is broken), gets text, calls `runFixtureRefresh({source:"cemaden", ext:"json", fetchPayload, parseForDiff: JSON.parse})`. Logs `result.diff`, exits per `result.kind`.
    - `refresh-inmet.ts`: TWO fetches.
      - List: `INMET_LIST_ENDPOINT` → JSON list. Picks the first active id (or all, configurable via `--all`).
      - CAP: fetches that one CAP XML by id.
      - Bundles list + CAP into a single multi-document fixture: write `inmet-{date}.xml` containing the CAP XML for one alert (per SPEC acceptance: `inmet-<ISO>.xml`); write a sibling `inmet-{date}.list.json` containing the list response.
      - parseForDiff: for the .xml use `parseCapXml` from `src/lib/sources/xml.ts`; for the .list.json use `JSON.parse`. Run runner twice (once per file) and exit with `max(kind1, kind2)` severity.
      - If list step returns 0 active alerts: write list-only fixture, log warning "no active alerts to capture CAP for", exit 0. (Real-world capture during quiet periods is normal.)
    - `package.json`:
      ```json
      "fixtures:refresh:cemaden": "tsx scripts/refresh-cemaden.ts",
      "fixtures:refresh:inmet": "tsx scripts/refresh-inmet.ts"
      ```
      Place alphabetically among scripts.
  </behavior>
  <action>
    1. Create `scripts/refresh-cemaden.ts` (~25 lines): const ENDPOINT, async main, fetch via `fetch()` builtin (Node 24 has it global; no need for ofetch dep in scripts), call runner, exit.
    2. Create `scripts/refresh-inmet.ts` (~40 lines): two fetches, two runner calls, combined exit code.
    3. Edit `package.json` to add the two scripts.
    4. Both scripts must be runnable as `pnpm fixtures:refresh:cemaden` and `pnpm fixtures:refresh:inmet`.
    5. Manual smoke (NOT automated): execute each once with prior fixture absent → confirm a fixture file appears in `tests/fixtures/sources/`. Do NOT commit those fixtures here — plan 04-05 commits the canonical real fixtures captured via these scripts.
  </action>
  <verify>
    <automated>pnpm run fixtures:refresh:cemaden --help 2>&1 | tee /dev/null ; node -e "const p=require('./package.json');if(!p.scripts['fixtures:refresh:cemaden']||!p.scripts['fixtures:refresh:inmet']){console.error('missing scripts');process.exit(1)};console.log('scripts present')"</automated>
  </verify>
  <done>Both scripts exist, run via pnpm, write fixtures with correct naming and exit-code semantics.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                           | Description                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| upstream API → refresh script      | Same as adapter — untrusted payload, but no production effect (only writes to dev-tree fixture file) |
| committed fixture → contract tests | Trusted: developer reviews diff before commit                                                        |

## STRIDE Threat Register (ASVS L2)

| Threat ID  | Category               | Component                                                            | Disposition | Mitigation Plan                                                                                                                                                                                   |
| ---------- | ---------------------- | -------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-04-04-01 | Tampering              | Auto-committed fixtures hide silent drift                            | mitigate    | Refresh is manual (no CI auto-refresh per SPEC out-of-scope); maintainer commits explicitly; structural_drift exit-1 surfaces on `pnpm` invocation                                                |
| T-04-04-02 | Information Disclosure | Refresh script prints upstream payload to terminal/log including PII | mitigate    | Print only the diff classification + counts + path; full diff text on request via `--verbose` flag; do NOT redirect raw payload to git history except via the fixture file the maintainer reviews |
| T-04-04-03 | Tampering              | Maintainer overwrites a real-prod fixture with a bad capture         | accept      | Manual commit gate; PR review catches obviously wrong files; old fixtures are not auto-deleted (maintainer removes obsolete in same PR)                                                           |
| T-04-04-04 | DoS                    | Script bombards INMET list endpoint causing 429                      | mitigate    | Single fetch per run; no retry loop; if rate-limited, script exits with helpful message ("INMET rate-limited; retry in N min")                                                                    |

</threat_model>

<verification>
- `pnpm test -- scripts/lib/fixture-runner.test.ts` passes
- `node -e "const p=require('./package.json');console.log(p.scripts['fixtures:refresh:cemaden']);console.log(p.scripts['fixtures:refresh:inmet'])"` prints both `tsx scripts/refresh-*.ts` lines
- `grep -c "structuralDiff" scripts/lib/fixture-runner.ts` ≥ 1
- `grep -c "structural_drift" scripts/lib/fixture-runner.ts` ≥ 2 (definition + usage)
- `pnpm exec tsc --noEmit` clean
</verification>

<success_criteria>
Refresh scripts ship and behave per SPEC REQ-7: writes date-stamped fixture, exits 0 on no-prior or leaf-only diff, exits 1 on structural drift. Plan 04-05 uses these scripts to capture canonical fixtures.

## Dimension 8 Validation Requirements

Structural-vs-leaf classification is the load-bearing invariant. 7 unit tests cover the classifier (identical / leaf-diff / extra key / removed key / array-length / array-element-shape / type-change). The refresh runner integration smoke covers no-prior/leaf-only/structural-drift paths.
</success_criteria>

<output>
After completion, create `.planning/phases/04-first-two-adapters/04-04-SUMMARY.md` documenting endpoint constants used, exit-code semantics, and any deviations from CONTEXT.
</output>
