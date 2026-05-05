---
phase: 04-first-two-adapters
plan: 05
type: execute
wave: 2
depends_on: ["04-02", "04-03", "04-04"]
files_modified:
  - tests/fixtures/sources/cemaden-{ISO-date}.json
  - tests/fixtures/sources/inmet-{ISO-date}.xml
  - tests/fixtures/sources/inmet-{ISO-date}.list.json
  - tests/contract/cemaden.test.ts
  - tests/contract/inmet.test.ts
  - vitest.config.ts
autonomous: true
requirements: [ADAPT-01, ADAPT-02, ADAPT-04]
must_haves:
  truths:
    - "tests/fixtures/sources/cemaden-<ISO-date>.json exists, captured via pnpm fixtures:refresh:cemaden"
    - "tests/fixtures/sources/inmet-<ISO-date>.xml exists, captured via pnpm fixtures:refresh:inmet"
    - "Per-adapter contract test loads its real fixture via DI stub and asserts produced Alert[] matches a stored snapshot"
    - "Mutating any captured field causes the contract test to fail with a readable diff"
    - "Schema-drift integration test: mocking CEMADEN to fail zod still allows INMET-sourced alerts through"
    - "Contract tests run as part of the default `pnpm test` suite (not separately gated)"
  artifacts:
    - path: "tests/contract/cemaden.test.ts"
      provides: "Real-fixture contract test for CEMADEN adapter"
      min_lines: 60
    - path: "tests/contract/inmet.test.ts"
      provides: "Real-fixture contract test for INMET adapter (list + CAP)"
      min_lines: 80
    - path: "tests/fixtures/sources/cemaden-<ISO-date>.json"
      provides: "Real CEMADEN national-scope response, captured ISO-date"
      min_lines: 1
    - path: "tests/fixtures/sources/inmet-<ISO-date>.xml"
      provides: "Real INMET CAP XML for one active alert"
      min_lines: 10
  key_links:
    - from: "tests/contract/cemaden.test.ts"
      to: "src/lib/sources/cemaden.ts"
      via: "import { createCemadenAdapter }"
      pattern: "createCemadenAdapter"
    - from: "tests/contract/inmet.test.ts"
      to: "src/lib/sources/inmet.ts"
      via: "import { createInmetAdapter }"
      pattern: "createInmetAdapter"
---

<objective>
Capture real golden fixtures from CEMADEN + INMET via the refresh scripts (plan 04-04), commit them, and write per-adapter contract tests that load the real fixtures through the DI stub and snapshot the produced `Alert[]`. Add the schema-drift integration test (REQ-7 from SPEC: per-source isolation).

Purpose: REQ-4 + REQ-5 + REQ-7 from SPEC. Closes the "did real responses actually parse?" loop. Replaces inline hand-crafted fixtures (Wave 1) with canonical real captures.

Output: Two real fixtures committed, two contract tests, one cross-source isolation test. CI green.

**Conditional scope (Q6=a fallback):** If plan 04-02 halted at Task 0 (CEMADEN endpoint unresolved), this plan ships INMET-only contract tests; the cross-source isolation test stubs CEMADEN as the failing branch and asserts INMET still flows.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/04-first-two-adapters/04-SPEC.md
@.planning/phases/04-first-two-adapters/04-CONTEXT.md
@.planning/phases/04-01-SUMMARY.md
@.planning/phases/04-02-SUMMARY.md
@.planning/phases/04-03-SUMMARY.md
@.planning/phases/04-04-SUMMARY.md

<interfaces>
<!-- Wave 1 outputs are now in context. -->

From `src/lib/sources/cemaden.ts`:

```ts
export function createCemadenAdapter(httpClient: HttpClient): SourceAdapter;
```

From `src/lib/sources/inmet.ts`:

```ts
export function createInmetAdapter(httpClient: HttpClient): SourceAdapter;
export const INMET_LIST_ENDPOINT: string;
export const INMET_CAP_ENDPOINT_TEMPLATE: string;
```

DI pattern: contract tests build `httpClient` stubs that read from disk fixtures, dispatch by URL.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Capture real fixtures via refresh scripts</name>
  <files>tests/fixtures/sources/cemaden-{ISO-date}.json, tests/fixtures/sources/inmet-{ISO-date}.xml, tests/fixtures/sources/inmet-{ISO-date}.list.json</files>
  <action>
    1. Run `pnpm fixtures:refresh:cemaden`. If it exits 0 (no_prior or leaf_only) → fixture file is at `tests/fixtures/sources/cemaden-{today-ISO}.json`. If it errors (CEMADEN endpoint unavailable, schema mismatch), document in 04-05-SUMMARY and proceed with INMET-only.
    2. Run `pnpm fixtures:refresh:inmet`. Two files appear: `inmet-{today-ISO}.xml` and `inmet-{today-ISO}.list.json`. If list returns zero active alerts, retry during a known-active period (rainy season — RESEARCH noted this). If still empty, ship the empty list as the captured fixture and document.
    3. Inspect each fixture in an editor:
       - Confirm CEMADEN JSON is real (not an HTML error page).
       - Confirm INMET CAP XML has both `<info xml:lang="pt-BR">` and useful severity/event/area data.
       - Redact any unexpected PII (RESEARCH did not flag any, but verify body fields are public alert text only).
    4. Stage all 3 fixture files for commit.

    Note: Subsequent refreshes by maintainers replace these files; old fixtures are removed in the same PR (CONTEXT decision).

  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const f=fs.readdirSync('tests/fixtures/sources');const c=f.filter(x=>/^cemaden-\\d{4}-\\d{2}-\\d{2}\\.json$/.test(x));const i=f.filter(x=>/^inmet-\\d{4}-\\d{2}-\\d{2}\\.xml$/.test(x));console.log('cemaden:',c.length,'inmet:',i.length);if(i.length===0)process.exit(1)" </automated>
  </verify>
  <done>At least one INMET fixture exists; at least one CEMADEN fixture exists OR phase is in Q6=a fallback (documented in SUMMARY).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: CEMADEN contract test (tests/contract/cemaden.test.ts)</name>
  <files>tests/contract/cemaden.test.ts, vitest.config.ts</files>
  <behavior>
    - Loads the latest `cemaden-*.json` fixture (glob + alphabetical sort).
    - Builds a stub httpClient that returns the fixture text parsed as JSON when called with `CEMADEN_ENDPOINT`.
    - Invokes `createCemadenAdapter(stub).fetch()` → produces `Alert[]`.
    - Asserts via `toMatchSnapshot()` against `tests/contract/__snapshots__/cemaden.test.ts.snap`. The snapshot captures: count, every Alert's `{source_key, hazard_kind, state_uf, severity, headline, valid_from, valid_until}` (omit `fetched_at` since it's `new Date()`-dependent — the test injects a fixed date via vi.useFakeTimers or normalizes after).
    - Mutation test: a second test mutates a clone of the fixture (e.g., delete a required field) → asserts the adapter throws SourceError code="schema_invalid".
    - If `cemaden-*.json` fixture is absent (Q6=a fallback), test file uses `describe.skip` and emits a console warning. Plan 04-06 will not register cemaden in registry in fallback mode — consistent.
  </behavior>
  <action>
    1. Create `tests/contract/cemaden.test.ts`. Use `globSync` (or readdir + filter) to find the latest fixture.
    2. If `vitest.config.ts` doesn't already include `tests/**/*.test.ts`, extend `test.include` to add it.
    3. Run, capture initial snapshot, commit it. Verify a manual fixture mutation breaks the snapshot test (manual smoke; do not commit the mutation).
    4. Coverage on cemaden.ts via this test should still match 100% (or higher line counts) when combined with Wave 1 unit tests — verify with `pnpm test:coverage`.
  </action>
  <verify>
    <automated>pnpm test -- tests/contract/cemaden.test.ts</automated>
  </verify>
  <done>Contract test passes against the captured fixture; snapshot file exists; mutating the fixture causes the test to fail.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: INMET contract test (tests/contract/inmet.test.ts)</name>
  <files>tests/contract/inmet.test.ts</files>
  <behavior>
    - Loads latest `inmet-*.list.json` and the matching `inmet-*.xml`.
    - Stub httpClient dispatches: list URL → list JSON; CAP URL (any) → the captured CAP XML.
    - `createInmetAdapter(stub).fetch()` → `Alert[]` → snapshot.
    - Mutation tests:
      - Strip `<info xml:lang="pt-BR">` from a clone → adapter rejects with code="missing_pt_br" for that alert.
      - Mutate `<severity>` to a value NOT in P3 SEVERITY_TABLE → output severity is `"moderate"` (NOT throws — the moderate-default is the documented behavior).
      - Replace `<event>` with `"Tornado"` (not in HAZARD_KINDS) → adapter throws schema_invalid for that alert; per-alert isolation means others still flow.
    - If list fixture is empty: snapshot is `[]` and the assertion is "fetch() resolves to [] without throwing".
  </behavior>
  <action>
    1. Create `tests/contract/inmet.test.ts` with the cases above.
    2. Use a small helper to clone-and-mutate the CAP XML string (regex replace for `xml:lang` attribute removal).
    3. Run, commit snapshot, verify mutations fail the relevant tests.
  </action>
  <verify>
    <automated>pnpm test -- tests/contract/inmet.test.ts</automated>
  </verify>
  <done>Contract test green; snapshot committed; mutation cases verified.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Cross-source isolation integration test (REQ-7)</name>
  <files>tests/contract/cross-source-isolation.test.ts</files>
  <behavior>
    - Builds both adapters with stubs: CEMADEN stub returns malformed JSON (rejects with schema_invalid); INMET stub returns the captured fixture.
    - Test invokes both via `Promise.allSettled([cemaden.fetch(), inmet.fetch()])`.
    - Asserts:
      - CEMADEN result is `{status: "rejected", reason: SourceError({code: "schema_invalid"})}`.
      - INMET result is `{status: "fulfilled", value: Alert[]}` with length ≥ 0.
      - The test does NOT call `/api/ingest` (the orchestrator integration with these adapters lands when registry is rewired in plan 04-06; this test is unit-level on the allSettled contract).
    - Also: reverse case (INMET fails, CEMADEN ok if available) — same assertion with roles swapped.
    - In Q6=a fallback (no cemaden fixture): test uses inline crafted CEMADEN-like response and stubs accordingly.
  </behavior>
  <action>
    Create `tests/contract/cross-source-isolation.test.ts` covering both directions. Assert via `expect.toMatchObject({status:"rejected", reason: expect.objectContaining({code:"schema_invalid"})})`.
  </action>
  <verify>
    <automated>pnpm test -- tests/contract/cross-source-isolation.test.ts</automated>
  </verify>
  <done>Test passes; demonstrates per-source isolation contract independent of orchestrator wiring.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                    | Description                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| committed real fixture → contract test → CI | Trusted (maintainer-reviewed); but stale fixture can mask drift between captures |

## STRIDE Threat Register (ASVS L2)

| Threat ID  | Category               | Component                                                                           | Disposition | Mitigation Plan                                                                                                                                                      |
| ---------- | ---------------------- | ----------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-04-05-01 | Tampering              | Stale committed fixture diverges from live source; CI green while production breaks | mitigate    | Canal 3 (this plan) catches divergence-from-fixture; Canal 1 (refresh script) catches divergence-from-live; Canal 2 (sentinel) deferred to P6 with tracking issue #4 |
| T-04-05-02 | Information Disclosure | Real fixture contains PII                                                           | mitigate    | Manual review at capture time (Task 1 step 3); CEMADEN/INMET are public-alert sources — no expected PII; if found, redact and document                               |
| T-04-05-03 | Tampering              | Snapshot accidentally regenerated by `--update-snapshots` masking real drift        | mitigate    | CI runs `pnpm test` (no `--update`); review-required for snapshot changes via PR diff                                                                                |
| T-04-05-04 | Repudiation            | Cannot tell when fixture was captured                                               | mitigate    | Filename encodes capture date (ISO-YYYY-MM-DD per CONTEXT)                                                                                                           |

</threat_model>

<verification>
- Real CEMADEN fixture committed (or fallback documented in SUMMARY)
- Real INMET fixture committed (XML + list JSON sibling)
- `pnpm test -- tests/contract/` all pass
- Snapshot files committed under `tests/contract/__snapshots__/`
- Manual mutation smoke: replacing a required field in any committed fixture breaks the relevant test
- `pnpm test:coverage` still shows 100/100 on cemaden.ts + inmet.ts (combined unit + contract coverage)
- `grep -rn "describe.skip" tests/contract/` only matches the cemaden file in Q6=a fallback mode (documented)
</verification>

<success_criteria>
Real fixtures captured, contract tests run them through the adapters, snapshots committed, mutation tests verify the drift gate, cross-source isolation test demonstrates REQ-7. Plan 04-06 can register the real adapters with confidence.

## Dimension 8 Validation Requirements

Three drift-detection invariants under explicit tests: (1) snapshot diff fails when any captured field changes; (2) mutating fixture to violate `<info xml:lang="pt-BR">` triggers `missing_pt_br`; (3) one source rejecting (allSettled) does not block the other. The cross-source isolation test is the canonical proof of REQ-7 from SPEC.
</success_criteria>

<output>
After completion, create `.planning/phases/04-first-two-adapters/04-05-SUMMARY.md` documenting capture dates, fixture sizes, snapshot file locations, and any Q6=a fallback decisions.
</output>
