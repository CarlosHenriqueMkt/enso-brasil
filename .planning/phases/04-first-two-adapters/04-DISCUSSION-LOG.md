# Phase 4 — Discussion Log

**Date:** 2026-05-05
**Mode:** discuss-phase, default
**Phase:** 04-first-two-adapters
**SPEC.md detected:** Yes (8 requirements locked, ambiguity 0.12)

This is the human-readable audit trail of `/gsd-discuss-phase 4`. Not consumed by downstream agents — they read CONTEXT.md.

## Areas selected

User selected all 4 gray areas:

- A — HTTP mock layer for tests
- B — Error taxonomy
- C — Refresh script shape (split into C1 + C2)
- D — Plan breakdown / wave structure

## Discussion turns

### Area A — HTTP mock layer

**Question:** How do adapters receive injectable HTTP for tests?

**Options presented:**

1. ofetch `createFetch` interceptor per test
2. Factory + DI: `createCemadenAdapter(httpClient)`
3. MSW (Mock Service Worker)

**User selection:** 2

**Rationale (Claude):** Adapter pure → testable without mock framework. Registry exports already-configured instances. Production code path matches test path. Pattern matches P3 risk engine (pure functions with explicit inputs).

### Area B — Error taxonomy

**Question:** How to differentiate 6 adapter failure modes (HTTP 5xx, timeout, zod invalid, payload drift, XML malformed, missing pt-BR `<info>`)?

**Options presented:**

1. Typed Error subclasses (`CemadenSchemaError`, etc.)
2. Discriminated union via thrown plain object (`{ kind, source, details }`)
3. `Error` + typed `code` field via `cause` option

**User selection:** 3

**Rationale (Claude):** Stack traces preserved for production edge logs. pino redaction config already serializes `cause`. Exported `SourceErrorCode` union enables exhaustive `switch (err.code)`. `sources_health.lastError` receives `code` directly. No prototype-chain pegadinhas.

### Area C1 — Refresh script structure

**Question:** Single parametrized command vs dedicated scripts?

**Options presented:**

1. Single `tsx scripts/refresh-fixture.ts <source>` with switch
2. Two dedicated scripts (duplicated logic)
3. Helper shared lib + thin scripts

**User selection:** 3

**Rationale (Claude):** Matches DI pattern from Area A. Adding source = 4 lines new thin script. No switch statement.

### Area C2 — Drift detection (exit code policy)

**Question:** How to define "shape changed" for exit 0 vs exit 1?

**Options presented:**

1. zod schema diff only (frail with `.strict()` mode)
2. JSON structure diff (keys ignoring leaf values)
3. Full diff + structural-change heuristic

**User selection:** 3

**Rationale (Claude):** SPEC requires unified diff for human review. Exit code governed only by structural (keys/types) change, not by leaf values. Daily alert oscillation does not trip exit 1.

### Area C — follow-up: drift awareness channel

**User question:** "How does human become aware of structural problems to react to changes?"

**Discussion:** Three channels surfaced:

- Canal 1: Local script run output (immediate, when human runs) — already in SPEC
- Canal 2: Drift sentinel agendado (proactive, between manual runs)
- Canal 3: Contract test in CI (reactive, defense in depth) — already in SPEC

**Decision:** Canal 1 + Canal 3 already cover 80%. Canal 2 (sentinel) is the gap.

**User direction:** Defer Canal 2 to future phase + open GitHub issue for collaborator visibility.

**Action taken:** Issue [#4](https://github.com/CarlosHenriqueMkt/enso-brasil/issues/4) opened, labeled `enhancement`, milestone-suggested Phase 6 (Hardening). SPEC.md "Out of scope" updated with deferral note + issue link.

**Cadência configurada:** 72h between automatic runs, but counter resets on any manual `workflow_dispatch` or PR-triggered run touching `src/lib/sources/**` or `tests/fixtures/sources/**`. Implementation via `gh run list` query in workflow gate (no external state needed).

### Area D — Plan breakdown granularity

**Question:** How granular should plans be?

**Options presented:**

1. Coarse — 3 plans, sequential
2. Medium — 6 plans, 3 waves parallel
3. Fine — 9-10 plans, P3-style granularity

**Comparison table presented:** plans count, parallel waves, wave-race risk, atomic revert granularity, plan-checker overhead, time estimate, complexity match.

**User selection:** 2

**Rationale (Claude):** P4 lacks P3's complexity (8 pure modules + risk math). 2 adapters + cutover + script. Medium granularity matches actual scope. Wave-race lessons from P3 LEARNINGS already inform Wave 1 limits to 3 truly-independent plans.

## Deferred ideas (captured for backlog / future phases)

| Idea                    | Reason                             | Tracking                                                                      |
| ----------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| Drift sentinel workflow | Defense in depth, dilutes P4 scope | [#4](https://github.com/CarlosHenriqueMkt/enso-brasil/issues/4), suggested P6 |

## Decisions count

7 implementation decisions locked (areas A, B, C1, C2, sentinel-deferral, D, plus follow-up sentinel cadence design).

## Next step

`/gsd-plan-phase 4` — research phase will fire first per `workflow.research: true` config; planner consumes CONTEXT.md + SPEC.md after research delivers CEMADEN endpoint specifics.
