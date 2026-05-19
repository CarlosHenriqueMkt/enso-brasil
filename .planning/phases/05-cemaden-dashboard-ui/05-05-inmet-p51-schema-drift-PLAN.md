---
phase: 05-cemaden-dashboard-ui
plan: 05
type: execute
wave: 1
depends_on: ["05-01"]
files_modified:
  - src/lib/sources/inmet.schema.ts
  - src/lib/sources/inmet.ts
  - tests/sources/inmet.test.ts
  - tests/sources/inmet.contract.test.ts
  - tests/fixtures/sources/inmet-2026-05-18.list.json
autonomous: true
requirements: [ADAPT-02]
must_haves:
  truths:
    - "INMET adapter consumes `{hoje:[...], futuro:[...]}` envelope and flattens to unified id-deduped list"
    - "Live INMET fixture refreshed; existing 41 unit tests still pass; new contract test green"
  artifacts:
    - path: "src/lib/sources/inmet.schema.ts"
      provides: "InmetActiveListSchema updated to envelope shape"
    - path: "tests/fixtures/sources/inmet-2026-05-18.list.json"
      provides: "Refreshed live fixture"
  key_links:
    - from: "src/lib/sources/inmet.ts"
      to: "src/lib/sources/inmet.schema.ts"
      via: "AssertActiveList consumes new envelope"
      pattern: "InmetActiveListSchema"
---

<objective>
Independent INMET schema drift fix surfaced in `04-05-SUMMARY`. Runs in Wave 1 parallel to CEMADEN cluster (no file overlap).

Purpose: live `/avisos/ativos` returns `{hoje, futuro}` envelope, not flat array. Adapter currently fails or returns 0 alerts.

Output: schema updated; adapter flattens (`hoje ∪ futuro`, dedup by `id`); fixture refreshed; tests green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-first-two-adapters/04-05-SUMMARY.md
@.planning/phases/05-cemaden-dashboard-ui/05-PATTERNS.md
@src/lib/sources/inmet.ts
@src/lib/sources/inmet.schema.ts
@tests/sources/inmet.test.ts
@tests/sources/inmet.contract.test.ts
@scripts/refresh-inmet.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Update InmetActiveListSchema to envelope</name>
  <files>src/lib/sources/inmet.schema.ts, src/lib/sources/inmet.ts</files>
  <behavior>
    - `InmetActiveListSchema` accepts `{ hoje: z.array(InmetActiveItemSchema), futuro: z.array(InmetActiveItemSchema) }`.
    - Adapter flattens: `const list = [...raw.hoje, ...raw.futuro];` after `assertActiveList`.
    - Dedup by `id` (Map keyed by id, last-write wins for `futuro` over `hoje` if conflict — document choice in adapter comment).
    - On unknown shape (e.g. legacy flat array), throw `sourceError("schema_invalid", "INMET active list envelope shape changed")`.
  </behavior>
  <action>
    Update schema. Touch `inmet.ts:260` (post-assertActiveList) to flatten + dedup before passing to detail-fetch loop. Update existing assertActiveList tests in `inmet.test.ts` to use envelope shape. Comment cites `04-05-SUMMARY` and field semantics: `hoje` = active today, `futuro` = upcoming; union represents active+upcoming per INMET portal convention.
  </action>
  <verify>
    <automated>pnpm test:ci tests/sources/inmet.test.ts</automated>
  </verify>
  <done>All 41 existing tests pass; new envelope test added.</done>
</task>

<task type="auto">
  <name>Task 2: Refresh INMET fixture from live API</name>
  <files>tests/fixtures/sources/inmet-2026-05-18.list.json</files>
  <action>
    Run `pnpm fixtures:refresh:inmet` against live `https://apiprevmet3.inmet.gov.br/avisos/ativos`. If live API is unreachable from CI runner, fall back to manually `curl -s` the URL, save the response, and commit. Confirm fixture matches `{hoje, futuro}` envelope shape. If live API returns the legacy flat-array shape, the adapter's defensive "envelope shape changed" sourceError still fires — surface as a blocker (out of scope to handle both shapes).

    Delete or archive prior `inmet-*.list.json` fixtures (keep latest only — per glob-sort-desc contract test pattern).

  </action>
  <verify>
    <automated>node -e "const f=require('./tests/fixtures/sources/inmet-2026-05-18.list.json'); if(!Array.isArray(f.hoje)||!Array.isArray(f.futuro)) process.exit(1)"</automated>
  </verify>
  <done>Fixture has `hoje` + `futuro` arrays; old fixtures pruned.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Update contract test for envelope</name>
  <files>tests/sources/inmet.contract.test.ts</files>
  <behavior>
    Contract test loads the refreshed fixture, runs full adapter, asserts `Alert[]` parses against `AlertArraySchema`. Add explicit assertion: `expect(parsed.hoje).toBeInstanceOf(Array)` and `expect(parsed.futuro).toBeInstanceOf(Array)` on the raw fixture before adapter run, to lock the envelope shape contract.
  </behavior>
  <action>
    Minimal diff from current file.
  </action>
  <verify>
    <automated>pnpm test:ci tests/sources/inmet.contract.test.ts</automated>
  </verify>
  <done>Contract test green against new fixture.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-08 | Tampering | INMET payload shape | mitigate | Strict schema rejects legacy flat-array shape loudly |
</threat_model>

<verification>
- `pnpm test:ci tests/sources/inmet*` green (all 41+ tests)
- `pnpm test:coverage` for `src/lib/sources/inmet.ts` still 100/100/100/100
</verification>

<success_criteria>

- Envelope schema landed
- Fixture refreshed
- Contract test enforces envelope shape
  </success_criteria>

<output>
Create `.planning/phases/05-cemaden-dashboard-ui/05-05-SUMMARY.md`.
</output>
