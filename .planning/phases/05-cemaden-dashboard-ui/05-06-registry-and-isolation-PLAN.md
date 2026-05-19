---
phase: 05-cemaden-dashboard-ui
plan: 06
type: execute
wave: 3
depends_on: ["05-04", "05-05"]
files_modified:
  - src/lib/sources/registry.ts
  - src/lib/sources/registry-meta.ts
  - src/lib/sources/registry.test.ts
  - tests/contract/cross-source-isolation.test.ts
autonomous: true
requirements: [ADAPT-01, DATA-04]
must_haves:
  truths:
    - "Registry exports `[inmetAdapter, cemadenAdapter]` — both real, no stubs"
    - "registry-meta has `{key:'cemaden', displayName:'CEMADEN — Alertas vigentes', stability:'unstable'}`"
    - "Cross-source isolation test uses real cemadenAdapter, not inline stub"
    - "/api/ingest unchanged (Promise.allSettled is N-arity safe)"
  artifacts:
    - path: "src/lib/sources/registry.ts"
      provides: "Final adapter list"
      contains: "cemadenAdapter"
    - path: "src/lib/sources/registry-meta.ts"
      provides: "Edge-safe metadata"
      contains: "stability"
  key_links:
    - from: "src/lib/sources/registry.ts"
      to: "src/lib/sources/cemaden.ts"
      via: "import { cemadenAdapter }"
      pattern: 'from "./cemaden"'
---

<objective>
Wire the CEMADEN adapter into the registry, extend metadata with `stability` annotation, and rewrite the cross-source isolation test to use the real adapter (removing the inline stub from `tests/contract/cross-source-isolation.test.ts`).

Purpose: completes ADAPT-01 + verifies DATA-04 with production code.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/sources/registry.ts
@src/lib/sources/registry-meta.ts
@src/lib/sources/registry.test.ts
@tests/contract/cross-source-isolation.test.ts
@src/lib/sources/cemaden.ts
@.planning/phases/05-cemaden-dashboard-ui/05-PATTERNS.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend registry-meta with stability + cemaden entry</name>
  <files>src/lib/sources/registry-meta.ts</files>
  <behavior>
    - `sourceMetadata` items gain a `readonly stability: "stable" | "unstable"` field.
    - INMET entry: `{ key: "inmet", displayName: "INMET — Alert-AS", stability: "stable" }`.
    - CEMADEN entry: `{ key: "cemaden", displayName: "CEMADEN — Alertas vigentes", stability: "unstable" }`.
    - Module remains edge-safe (no imports from `./registry`, no node-only deps).
  </behavior>
  <action>
    Update the frozen array at `registry-meta.ts:16`. Keep `sourceDisplayNames` derivation. Add a `sourceStability: Record<string,"stable"|"unstable">` derived map.
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit &amp;&amp; pnpm test:ci src/lib/sources/registry.test.ts</automated>
  </verify>
  <done>Both fields present; registry test drift detector green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Append cemadenAdapter to registry</name>
  <files>src/lib/sources/registry.ts</files>
  <behavior>
    - `sources` array becomes `[inmetAdapter, cemadenAdapter]` (in that order — INMET first per existing registration).
    - Remove the `TODO(P5)` docblock comment lines 13-14.
    - `import { cemadenAdapter } from "./cemaden";` added.
    - registry.test.ts drift detector compares registry length + keys against registry-meta — passes.
  </behavior>
  <action>
    Single-line append per `05-PATTERNS.md`. Drift detector will now fail if registry and registry-meta diverge — that's the intended invariant.
  </action>
  <verify>
    <automated>pnpm test:ci src/lib/sources/registry.test.ts</automated>
  </verify>
  <done>Test green; grep gate from registry docblock still 0 hits.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Replace inline cemadenStub with real cemadenAdapter in isolation test</name>
  <files>tests/contract/cross-source-isolation.test.ts</files>
  <behavior>
    - Test imports `cemadenAdapter` from `@/lib/sources/cemaden` (or per project's path alias).
    - Simulated CEMADEN failure: inject a mock HTTP client into `createCemadenAdapter(mockHttp)` where `mockHttp.getJson` rejects with `sourceError("http_5xx", ...)`.
    - Assert: `/api/ingest`-equivalent orchestration (`Promise.allSettled([inmet, cemaden])`) still resolves; INMET branch returns Alert[]; CEMADEN branch is `rejected` with the sourceError.
    - Snapshot pipeline (`snapshot.ts`) consumes INMET-only Alert[] and produces 27-state output with CEMADEN's contribution absent (UFs with INMET-only alerts still render real risk; UFs with no INMET alerts and CEMADEN-only would have shown alerts now render green/unknown — verify case).
    - Remove the `TODO(P5)` comment and any `cemadenStub` factory definition lines.
  </behavior>
  <action>
    Identify the existing `cemadenStub` factory in the test file; replace usages with `createCemadenAdapter(mockHttp)`. Keep the assertion shape unchanged where possible.
  </action>
  <verify>
    <automated>pnpm test:ci tests/contract/cross-source-isolation.test.ts</automated>
  </verify>
  <done>Test green; `grep -n "cemadenStub" tests/contract/cross-source-isolation.test.ts` returns 0 matches.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-09 | Repudiation | source attribution | mitigate | registry-meta stability annotation surfaces "unstable" → UI shows degraded-source banner |
| T-05-10 | DoS | CEMADEN dragging INMET down | mitigate | Promise.allSettled isolation verified by this test |
</threat_model>

<verification>
- `pnpm test:ci` whole suite green
- `pnpm exec tsc --noEmit` green
- No `cemadenStub` references in `tests/contract/`
</verification>

<success_criteria>

- Registry length = 2
- Cross-source isolation contract uses real adapter
  </success_criteria>

<output>
Create `.planning/phases/05-cemaden-dashboard-ui/05-06-SUMMARY.md`.
</output>
