---
phase: 04-first-two-adapters
plan: 05
type: execute
wave: 2
depends_on: ["04-03", "04-04"]
files_modified:
  - tests/fixtures/sources/inmet-{ISO-date}.xml
  - tests/fixtures/sources/inmet-{ISO-date}.list.json
  - tests/contract/inmet.test.ts
  - tests/contract/cross-source-isolation.test.ts
autonomous: true
requirements: [ADAPT-02, ADAPT-04]
must_haves:
  truths:
    - "tests/fixtures/sources/inmet-<ISO-date>.xml exists, captured via pnpm fixtures:refresh:inmet"
    - "tests/fixtures/sources/inmet-<ISO-date>.list.json exists alongside the CAP XML"
    - "Contract test loads the real INMET fixture via DI stub and asserts produced Alert[] matches a stored snapshot"
    - "Mutating any captured field causes the contract test to fail with a readable diff"
    - "Cross-source isolation test uses an inline cemadenStub factory that throws — NO real CEMADEN code in src/"
    - "Cross-source isolation proves Promise.allSettled keeps INMET flowing while CEMADEN-stub rejects"
    - "Contract tests run as part of the default `pnpm test` suite"
    - "vitest.config.ts is NOT modified by this plan (Wave 0 pre-extended the glob)"
  artifacts:
    - path: "tests/contract/inmet.test.ts"
      provides: "Real-fixture contract test for INMET adapter (list + CAP)"
      min_lines: 80
    - path: "tests/contract/cross-source-isolation.test.ts"
      provides: "REQ-7 isolation proof using inline cemadenStub + real inmetAdapter"
      min_lines: 60
    - path: "tests/fixtures/sources/inmet-<ISO-date>.xml"
      provides: "Real INMET CAP XML for one active alert"
      min_lines: 10
    - path: "tests/fixtures/sources/inmet-<ISO-date>.list.json"
      provides: "Real INMET active-alerts list response"
      min_lines: 1
  key_links:
    - from: "tests/contract/inmet.test.ts"
      to: "src/lib/sources/inmet.ts"
      via: "import { createInmetAdapter, INMET_CAP_LIST, INMET_CAP_DETAIL }"
      pattern: "createInmetAdapter"
    - from: "tests/contract/cross-source-isolation.test.ts"
      to: "src/lib/sources/inmet.ts"
      via: "import { createInmetAdapter }"
      pattern: "createInmetAdapter"
    - from: "tests/contract/cross-source-isolation.test.ts"
      to: "src/lib/sources/errors.ts"
      via: "import { sourceError } from inline stub"
      pattern: "sourceError"
---

<objective>
Capture real golden fixtures from INMET via the refresh script (plan 04-04), commit them, and write the INMET contract test that loads the real fixtures through the DI stub and snapshots the produced `Alert[]`. Also ship the cross-source isolation integration test (REQ-7) using an **inline `cemadenStub` factory** declared inside the test file — no real CEMADEN code lands in `src/` (Path C constraint).

Purpose: REQ-4 + REQ-5 + REQ-7 from SPEC, scoped to Path C. Closes the "did real INMET responses actually parse?" loop. Replaces inline hand-crafted fixtures (Wave 1) with canonical real captures.

Output: One real INMET fixture pair committed, one INMET contract test, one cross-source isolation test (with inline cemadenStub). CI green. **No CEMADEN code added to `src/`.**
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
@.planning/phases/04-first-two-adapters/04-03-SUMMARY.md
@.planning/phases/04-first-two-adapters/04-04-SUMMARY.md

<interfaces>
<!-- Wave 1 outputs are now in context. -->

From `src/lib/sources/inmet.ts`:

```ts
export function createInmetAdapter(httpClient: HttpClient): SourceAdapter;
export const INMET_CAP_LIST: string;
export const INMET_CAP_DETAIL: (id: string) => string;
```

From `src/lib/sources/errors.ts` (Wave 0):

```ts
export function sourceError(
  code: SourceErrorCode,
  message: string,
  cause?: unknown,
): SourceErrorLike;
export function isSourceError(e: unknown): e is SourceErrorLike;
```

Inline cemadenStub pattern (declared INSIDE cross-source-isolation.test.ts — NOT in src/):

```ts
// Inline factory — proves Promise.allSettled isolation without landing real CEMADEN code.
// Replaced by real cemadenAdapter in Phase 5.
function cemadenStub(): SourceAdapter {
  return {
    key: "cemaden",
    displayName: "CEMADEN — stub (P4 carry-over to P5)",
    fetch: async () => {
      throw sourceError("schema_invalid", "cemaden stub: P5 carry-over");
    },
  };
}
```

DI pattern: contract tests build `httpClient` stubs that read from disk fixtures.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Capture real INMET fixture via refresh script</name>
  <files>tests/fixtures/sources/inmet-{ISO-date}.xml, tests/fixtures/sources/inmet-{ISO-date}.list.json</files>
  <action>
    1. Run `pnpm fixtures:refresh:inmet`. Two files appear: `inmet-{today-ISO}.xml` and `inmet-{today-ISO}.list.json`. If list returns zero active alerts, retry during a known-active period (rainy season). If still empty after one retry, fall back to `--dry-run` capture from local stubs and document in 04-05-SUMMARY (research notes empty-fixture is acceptable for schema gate).
    2. Inspect each fixture:
       - Confirm CAP XML has `<info xml:lang="pt-BR">` and useful severity/event/area data.
       - Redact any unexpected PII (RESEARCH did not flag any; verify body fields are public alert text only).
    3. Stage both fixture files.

    **No CEMADEN fixture in this phase.** P5 captures it.

  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const f=fs.readdirSync('tests/fixtures/sources');const i=f.filter(x=>/^inmet-\\d{4}-\\d{2}-\\d{2}\\.xml$/.test(x));const l=f.filter(x=>/^inmet-\\d{4}-\\d{2}-\\d{2}\\.list\\.json$/.test(x));if(i.length===0||l.length===0){console.error('inmet fixtures missing',{xml:i,list:l});process.exit(1)};console.log('OK',{xml:i,list:l})"</automated>
  </verify>
  <done>At least one INMET CAP XML fixture + one list-JSON sibling exist with matching dates.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: INMET contract test (tests/contract/inmet.test.ts)</name>
  <files>tests/contract/inmet.test.ts</files>
  <behavior>
    - Loads latest `inmet-*.list.json` and matching `inmet-*.xml` via glob + alphabetical sort.
    - Stub httpClient dispatches: list URL → list JSON; CAP URL (any) → captured CAP XML.
    - `createInmetAdapter(stub).fetch()` → `Alert[]` → snapshot via `toMatchSnapshot()`.
    - Snapshot omits `fetched_at` (use vi.useFakeTimers or post-process to normalize).
    - Mutation tests:
      - Strip `<info xml:lang="pt-BR">` from a clone → adapter rejects with `isSourceError(err) && err.code === "missing_pt_br"` for that alert.
      - Mutate `<severity>` to a value NOT in P3 SEVERITY_TABLE → output severity is `"moderate"` (NOT throws — moderate-default is documented behavior).
      - Replace `<event>` with `"Tornado"` (not in HAZARD_KINDS) → `code: "schema_invalid"` for that alert; per-alert isolation means others still flow.
    - If list fixture is empty: snapshot is `[]` and assertion is "fetch() resolves to [] without throwing".
    - **All error assertions use `isSourceError()` from `./errors`** — no `instanceof SourceError` (W-1 invariant).
  </behavior>
  <action>
    1. Create `tests/contract/inmet.test.ts` with cases above.
    2. Use a small helper to clone-and-mutate the CAP XML string (regex replace for `xml:lang` removal).
    3. Run, commit snapshot, verify mutations fail relevant tests.
    4. **Do NOT modify `vitest.config.ts`** — Wave 0 already covers `tests/**/*.test.ts`.
  </action>
  <verify>
    <automated>pnpm test -- tests/contract/inmet.test.ts</automated>
  </verify>
  <done>Contract test green; snapshot committed; mutation cases verified; vitest.config.ts unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Cross-source isolation test with inline cemadenStub (REQ-7)</name>
  <files>tests/contract/cross-source-isolation.test.ts</files>
  <behavior>
    - **Inline cemadenStub factory declared inside this test file**:
      ```ts
      import { sourceError } from "@/lib/sources/errors";
      import type { SourceAdapter } from "@/lib/sources/types";

      function cemadenStub(): SourceAdapter {
        return {
          key: "cemaden",
          displayName: "CEMADEN — stub (P4 carry-over to P5)",
          fetch: async () => {
            throw sourceError("schema_invalid", "cemaden stub: P5 carry-over");
          },
        };
      }
      ```
    - Real `inmetAdapter` built via `createInmetAdapter(stubHttp)` where `stubHttp` returns the captured INMET fixture.
    - Test invokes both via `Promise.allSettled([cemadenStub().fetch(), inmet.fetch()])`.
    - Asserts:
      - CEMADEN result `{status: "rejected", reason}` where `isSourceError(reason) && reason.code === "schema_invalid"`.
      - INMET result `{status: "fulfilled", value: Alert[]}` with length ≥ 0.
      - The test does NOT call `/api/ingest` (orchestrator wiring lands in 04-06).
    - Reverse case: simulate INMET-failure (stubHttp throws) and assert CEMADEN-stub still rejects independently — proves both directions of isolation contract.
    - **CRITICAL Path C invariant:** verify with grep that NO file in `src/lib/sources/cemaden*` exists. The cemadenStub is purely test-file-local.

  </behavior>
  <action>
    1. Create `tests/contract/cross-source-isolation.test.ts` with the inline `cemadenStub` factory and both directional cases.
    2. Add a lightweight assertion at top of test file (or in a separate Nyquist gate):
       ```ts
       it("Path C invariant: no CEMADEN adapter in src/", () => {
         expect(existsSync("src/lib/sources/cemaden.ts")).toBe(false);
         expect(existsSync("src/lib/sources/cemaden.schema.ts")).toBe(false);
       });
       ```
    3. Use `expect.toMatchObject({status:"rejected", reason: expect.objectContaining({code:"schema_invalid"})})`.
  </action>
  <verify>
    <automated>pnpm test -- tests/contract/cross-source-isolation.test.ts && test ! -f src/lib/sources/cemaden.ts && test ! -f src/lib/sources/cemaden.schema.ts</automated>
  </verify>
  <done>Test passes; demonstrates per-source isolation contract via inline stub; NO CEMADEN code in src/.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                    | Description                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| committed real fixture → contract test → CI | Trusted (maintainer-reviewed); but stale fixture can mask drift between captures |

## STRIDE Threat Register (ASVS L2)

| Threat ID  | Category               | Component                                                 | Disposition | Mitigation Plan                                                                                                                         |
| ---------- | ---------------------- | --------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| T-04-05-01 | Tampering              | Stale committed INMET fixture diverges from live source   | mitigate    | Canal 3 (this plan) catches divergence-from-fixture; Canal 1 (refresh script) catches divergence-from-live; Canal 2 deferred to P6 (#4) |
| T-04-05-02 | Information Disclosure | Real fixture contains PII                                 | mitigate    | Manual review at capture time; INMET sources are public-alert — no expected PII; redact + document if found                             |
| T-04-05-03 | Tampering              | Snapshot accidentally regenerated by `--update-snapshots` | mitigate    | CI runs `pnpm test` (no `--update`); snapshot changes review-required via PR diff                                                       |
| T-04-05-04 | Repudiation            | Cannot tell when fixture was captured                     | mitigate    | Filename encodes capture date (ISO-YYYY-MM-DD)                                                                                          |
| T-04-05-05 | Tampering              | Inline cemadenStub leaks into production code             | mitigate    | Stub declared in test-file scope only; Nyquist gate `existsSync("src/lib/sources/cemaden.ts")===false` enforces Path C invariant        |

</threat_model>

<verification>
- Real INMET fixture committed (XML + list-JSON sibling, matching dates)
- `pnpm test -- tests/contract/` all pass
- Snapshot file committed under `tests/contract/__snapshots__/inmet.test.ts.snap`
- Manual mutation smoke: removing `<info xml:lang="pt-BR">` breaks the relevant test
- `pnpm test:coverage` still shows 100/100 on inmet.ts (combined unit + contract)
- `test ! -f src/lib/sources/cemaden.ts && test ! -f src/lib/sources/cemaden.schema.ts` (Path C invariant)
- `grep -E "from ['\"]@?/.*cemaden" src/ | wc -l` = 0 (no src/ imports CEMADEN)
- `grep -c "cemadenStub" tests/contract/cross-source-isolation.test.ts` ≥ 1 (inline stub present)
- `grep -c "isSourceError\|err\\.code" tests/contract/inmet.test.ts` ≥ 2 (W-1 factory-based assertions)
- `git diff HEAD -- vitest.config.ts | wc -l` = 0 (W-4 invariant)
</verification>

<success_criteria>
Real INMET fixture captured, contract test runs it through the adapter, snapshot committed, mutation tests verify the drift gate, cross-source isolation test demonstrates REQ-7 via an inline cemadenStub. NO CEMADEN code in `src/` (Path C). Plan 04-06 can register `[inmetAdapter]` only with confidence.

## Dimension 8 Validation Requirements

Four invariants under explicit tests + grep gates:

1. Snapshot diff fails when any captured INMET field changes.
2. Mutating fixture to violate `<info xml:lang="pt-BR">` triggers `missing_pt_br` (factory-based assertion).
3. One source rejecting (allSettled) does not block the other — cross-source isolation test.
4. Path C invariant: no `src/lib/sources/cemaden*` files exist.
   </success_criteria>

<output>
After completion, create `.planning/phases/04-first-two-adapters/04-05-SUMMARY.md` documenting capture date, fixture sizes, snapshot file location, inline-stub pattern (Path C), W-1/W-4 resolutions, and CEMADEN P5 carry-over note.
</output>
