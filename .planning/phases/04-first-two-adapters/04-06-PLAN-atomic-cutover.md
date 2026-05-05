---
phase: 04-first-two-adapters
plan: 06
type: execute
wave: 3
depends_on: ["04-05"]
files_modified:
  - src/lib/sources/registry.ts
  - src/lib/sources/stub.ts
  - src/lib/sources/stub.test.ts
  - tests/fixtures/sources/stub-default.json
  - src/app/api/ingest/route.ts
  - README.md
  - CONTRIBUTING.md
autonomous: false
requirements: [ADAPT-02, ADAPT-04]
must_haves:
  truths:
    - "src/lib/sources/registry.ts exports [inmetAdapter] only (Path C — CEMADEN deferred to P5)"
    - "src/lib/sources/stub.ts no longer exists"
    - "src/lib/sources/stub.test.ts no longer exists"
    - "tests/fixtures/sources/stub-default.json no longer exists"
    - "No file in src/, tests/, or scripts/ imports stubAdapter or references the stub fixture path"
    - "/api/ingest uses Promise.allSettled([inmetAdapter]) — futures-proof for P5 CEMADEN append"
    - "Registry-isolation grep gate (P2) still passes"
    - "dep-cruiser RISK-01 isolation rule still passes"
    - "No CEMADEN file in src/lib/sources/ (Path C invariant)"
    - "All commits in this plan land as a single atomic commit on the phase branch"
    - "README + CONTRIBUTING document the fixture-refresh procedure (INMET only; note CEMADEN deferred)"
    - "End-to-end smoke against preview: /api/states returns alerts with source: inmet (or sources_health shows recent lastSuccessfulFetch when no alerts active)"
  artifacts:
    - path: "src/lib/sources/registry.ts"
      provides: "Updated registry with INMET only"
      contains: "inmetAdapter"
    - path: "README.md"
      provides: "Section pointing maintainers at fixture-refresh scripts"
      contains: "fixtures:refresh:inmet"
    - path: "CONTRIBUTING.md"
      provides: "Fixture-refresh procedure"
      contains: "pnpm fixtures:refresh"
  key_links:
    - from: "src/lib/sources/registry.ts"
      to: "src/lib/sources/inmet.ts"
      via: "import { inmetAdapter }"
      pattern: "from \\\"\\./inmet\\\""
---

<objective>
Atomic cutover under **Path C (INMET-only)**: in a single commit, register `[inmetAdapter]` in `registry.ts` AND delete `stub.ts`, `stub.test.ts`, and the stub fixture. Update `/api/ingest` to call `Promise.allSettled([inmetAdapter])` (futures-proof for P5 CEMADEN append — orchestrator does not need re-edit when CEMADEN ships). Update README + CONTRIBUTING with the fixture-refresh procedure (note CEMADEN deferred to P5). Verify CI green and run a manual smoke against preview deployment.

Purpose: REQ-3 from SPEC (atomic stub cutover, Q6=a fallback path). After this commit, the entire ingest pipeline runs on real INMET data. The stub is dead. CEMADEN slot reserved for P5 with zero orchestrator changes needed.

Output: One atomic cutover commit + README/CONTRIBUTING updates + preview-deploy human-verify checkpoint.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/04-first-two-adapters/04-SPEC.md
@.planning/phases/04-first-two-adapters/04-CONTEXT.md
@.planning/phases/04-first-two-adapters/04-03-SUMMARY.md
@.planning/phases/04-first-two-adapters/04-05-SUMMARY.md

<interfaces>
<!-- Pre-cutover registry: -->
```ts
// src/lib/sources/registry.ts (current)
import type { SourceAdapter } from "./types";
import { stubAdapter } from "./stub";
export const sources: readonly SourceAdapter[] = [stubAdapter];
```

<!-- Post-cutover (Path C — INMET only): -->

```ts
import type { SourceAdapter } from "./types";
import { inmetAdapter } from "./inmet";

// Phase 4 (Path C): INMET only. CEMADEN deferred to Phase 5.
// Append cemadenAdapter to this array in P5 — no orchestrator changes needed
// (Promise.allSettled is N-arity safe).
export const sources: readonly SourceAdapter[] = [inmetAdapter];

export const sourceDisplayNames: Record<string, string> = Object.freeze(
  Object.fromEntries(sources.map((s) => [s.key, s.displayName])),
);
```

Orchestrator (`/api/ingest`):

```ts
// Iterates the sources[] array; uses Promise.allSettled regardless of arity.
// In P4: settles 1 promise (INMET). In P5: settles 2 (INMET + CEMADEN).
// No code change needed when CEMADEN ships in P5.
const results = await Promise.allSettled(sources.map((s) => s.fetch()));
```

</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pre-cutover gate — verify all preconditions</name>
  <files>(read-only)</files>
  <action>
    Confirm before any deletion:
    1. `pnpm test` is green on the phase branch.
    2. `pnpm depcruise` passes (RISK-01 isolation preserved).
    3. Registry-isolation grep gate (P2 CI):
       `grep -rE "import.*[sS]tub|import.*Inmet" src/lib src/app | grep -v "src/lib/sources/" | grep -v '^[[:space:]]*\\*\\|^[[:space:]]*//' | wc -l` returns 0.
    4. Wave 1 + Wave 2 outputs exist: `src/lib/sources/inmet.ts`, `tests/contract/inmet.test.ts`, `tests/contract/cross-source-isolation.test.ts`, real INMET fixture.
    5. **Path C invariant:** `test ! -f src/lib/sources/cemaden.ts && test ! -f src/lib/sources/cemaden.schema.ts` — NO CEMADEN code present.
    6. `/api/ingest` already iterates `sources[]` (P2 contract). Confirm via `grep -c "Promise.allSettled" src/app/api/ingest/route.ts` ≥ 1. If the route hardcodes a single adapter call, this task FAILS — a Promise.allSettled iteration over `sources[]` is mandatory for P5 future-proofing.

    If ANY precondition fails: STOP. Do not proceed to deletion.

  </action>
  <verify>
    <automated>pnpm test && pnpm depcruise && bash -c 'test ! -f src/lib/sources/cemaden.ts && test ! -f src/lib/sources/cemaden.schema.ts && grep -c "Promise.allSettled" src/app/api/ingest/route.ts'</automated>
  </verify>
  <done>All preconditions confirmed; registry isolation intact; Path C invariant holds; orchestrator already iterates sources[].</done>
</task>

<task type="auto">
  <name>Task 2: Atomic cutover commit — registry rewrite (INMET only) + stub deletion</name>
  <files>src/lib/sources/registry.ts, src/lib/sources/stub.ts (deleted), src/lib/sources/stub.test.ts (deleted), tests/fixtures/sources/stub-default.json (deleted), src/app/api/ingest/route.ts (verify-only)</files>
  <behavior>
    Single git commit containing:
    - Rewrite `src/lib/sources/registry.ts` per &lt;interfaces&gt; (Path C: INMET only, with `// TODO(P5): append cemadenAdapter` comment for future maintainers).
    - Delete ONLY the INMET-related stub artifacts:
      - `src/lib/sources/stub.ts`
      - `src/lib/sources/stub.test.ts`
      - `tests/fixtures/sources/stub-default.json`
    - **CEMADEN stub** (the inline `cemadenStub` factory inside `tests/contract/cross-source-isolation.test.ts`) **STAYS** — it's the test-only carry-over until P5 lands real CEMADEN. Add a tracking comment at top of that test file: `// TODO(P5): replace inline cemadenStub with real cemadenAdapter once Phase 5 ships`.
    - Remove any orphaned `STUB_FIXTURE_PATH` env reference (`.env.example`, README, CONTRIBUTING).
    - Verify `/api/ingest/route.ts` already uses `Promise.allSettled(sources.map(...))` — if it does, NO modification needed; if it hardcodes a single adapter, FAIL the task and escalate (P2 contract should have shipped this; if not, it's a P2 regression).

    Commit message:
    ```
    feat(04): atomic cutover — register inmetAdapter, delete stub (Path C)

    Registers [inmetAdapter] only in src/lib/sources/registry.ts. Deletes
    stub.ts, stub.test.ts, and tests/fixtures/sources/stub-default.json in
    the same diff. CEMADEN deferred to Phase 5 (Path C); orchestrator uses
    Promise.allSettled([inmetAdapter]) which is N-arity safe — no
    /api/ingest changes needed when CEMADEN ships.

    The inline cemadenStub in tests/contract/cross-source-isolation.test.ts
    stays until P5 (carry-over per CONTEXT Decision Update 2026-05-05).

    Closes REQ-3 (atomic cutover, Q6=a fallback) from .planning/phases/04-first-two-adapters/04-SPEC.md.
    ```

  </behavior>
  <action>
    1. Edit `src/lib/sources/registry.ts` — rewrite per interfaces. Include the TODO(P5) comment.
    2. `git rm src/lib/sources/stub.ts src/lib/sources/stub.test.ts tests/fixtures/sources/stub-default.json`.
    3. Add tracking comment to top of `tests/contract/cross-source-isolation.test.ts`: `// TODO(P5): replace inline cemadenStub with real cemadenAdapter once Phase 5 ships`.
    4. Grep for stragglers: `grep -rn "stubAdapter\\|stub-default\\|STUB_FIXTURE_PATH" src/ tests/ scripts/ .env.example README.md CONTRIBUTING.md` → must be 0.
    5. Verify `/api/ingest/route.ts` is unchanged (Promise.allSettled iteration was P2 contract).
    6. Run `pnpm test`, `pnpm depcruise`, `pnpm lint`, `pnpm exec tsc --noEmit`.
    7. If all green: `git add` + `git commit` with the message above.
    8. Verify `git show --stat HEAD` shows: registry.ts modified, 3 files deleted, cross-source-isolation.test.ts comment-only edit. NO other src changes.
  </action>
  <verify>
    <automated>bash -c 'test ! -f src/lib/sources/stub.ts && test ! -f src/lib/sources/stub.test.ts && test ! -f tests/fixtures/sources/stub-default.json && test ! -f src/lib/sources/cemaden.ts && pnpm test && pnpm depcruise && pnpm lint && pnpm exec tsc --noEmit'</automated>
  </verify>
  <done>Single atomic commit deletes ONLY the INMET stub artifacts, registers inmetAdapter, leaves inline cemadenStub in test file with TODO(P5); CI green locally.</done>
</task>

<task type="auto">
  <name>Task 3: README + CONTRIBUTING updates for fixture-refresh procedure</name>
  <files>README.md, CONTRIBUTING.md</files>
  <behavior>
    - README PT-BR (primary) addendum: short section "Atualizando fixtures" — explains `pnpm fixtures:refresh:inmet`, when to run, exit codes, manual review of diff. Note: "CEMADEN será adicionado na Fase 5 — veja issue de carry-over."
    - CONTRIBUTING.md: fuller procedure — workflow for capturing INMET, reviewing diff, removing obsolete fixture, opening PR. Reference issue #4 for deferred sentinel. Reference Path C decision in CONTEXT.md for CEMADEN P5 carry-over.
  </behavior>
  <action>
    1. Add "Atualizando fixtures de fontes" section to README.md (PT-BR primary).
    2. Add "Refresh source fixtures" section to CONTRIBUTING.md describing the maintainer workflow for INMET. Note CEMADEN deferred to P5.
    3. Commit: `docs(04): document INMET fixture-refresh procedure (CEMADEN P5)`.
  </action>
  <verify>
    <automated>grep -c "fixtures:refresh:inmet" README.md && grep -c "fixtures:refresh" CONTRIBUTING.md && grep -ci "fase 5\\|phase 5" README.md CONTRIBUTING.md</automated>
  </verify>
  <done>Both files reference the INMET refresh script and note CEMADEN P5 deferral.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Real-INMET-data ingest live on preview deployment under Path C. Atomic cutover commit on phase branch; PR ready to open. CEMADEN slot reserved for P5 (zero orchestrator changes when it ships).
  </what-built>
  <how-to-verify>
    1. Push the phase branch: `git push origin phase-4-adapters-cemaden-inmet`.
    2. Wait for Vercel preview deployment to go green.
    3. With `INGEST_TOKEN` from Vercel dashboard (NOT `vercel env pull` — Sensitive vars are masked per memory feedback):
       ```
       curl -X POST https://<preview-url>/api/ingest -H "Authorization: Bearer $INGEST_TOKEN"
       ```
       Expect HTTP 200 with a per-source summary listing only `inmet` (Path C).
    4. `curl https://<preview-url>/api/states | jq '[.snapshots[] | .alerts[] | .source_key] | unique'` → should include `"inmet"` (or be `[]` during quiet periods).
    5. `curl https://<preview-url>/api/health | jq '.sources'` → INMET shows `lastSuccessfulFetch` within last few minutes. CEMADEN is absent from sources_health (or shows `state: "deferred"` if P2 health surface accommodates that — otherwise simply absent is correct).
    6. Use canonical `https://www.ensobrasil.com.br/...` (NOT apex) per memory `feedback_apex_redirect_auth` — Bearer header drops on apex→www redirect.
    7. Open PR with title `Phase 4: First Two Adapters — INMET (Path C, CEMADEN P5)`. Body explicitly notes Path C decision + CEMADEN carry-over to P5. Do NOT merge.
  </how-to-verify>
  <resume-signal>Type "approved" once preview smoke is green and PR is open. Describe issues if any.</resume-signal>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                     | Description                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| committed cutover diff → CI → preview deploy | Trusted (atomic commit, mandatory CI gate); stub-removal asymmetry eliminated by single-diff rule |
| preview API → curl smoke                     | INGEST_TOKEN bearer auth (P2); HTTPS only; canonical www host                                     |

## STRIDE Threat Register (ASVS L2)

| Threat ID  | Category               | Component                                                                      | Disposition | Mitigation Plan                                                                                                                                                          |
| ---------- | ---------------------- | ------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-04-06-01 | Tampering              | Partial cutover (stub removed but registry still references it) deploys broken | mitigate    | Single atomic commit; pre-commit grep + tsc + test gate; verifier loop runs after this plan                                                                              |
| T-04-06-02 | Tampering              | Stub fixture path remains in env defaults / docs                               | mitigate    | Task 2 grep sweep across src/tests/scripts/.env.example/README/CONTRIBUTING                                                                                              |
| T-04-06-03 | Information Disclosure | INGEST_TOKEN leaked via shell history                                          | mitigate    | Use Vercel dashboard for Sensitive vars (memory feedback); never inline in commands                                                                                      |
| T-04-06-04 | Spoofing               | Apex→www redirect drops Authorization header on smoke                          | mitigate    | Smoke uses canonical `https://www.ensobrasil.com.br/...` per memory feedback                                                                                             |
| T-04-06-05 | Tampering              | Squash-merge collapses cutover with unrelated commits                          | mitigate    | Phase branch contains only Phase 4 commits; PR body points to atomic-cutover SHA                                                                                         |
| T-04-06-06 | DoS                    | Cutover increases outbound traffic (1 call/15min INMET) above free tier        | accept      | Per CONTEXT free-tier math: 96 outbound calls/day from P4; well under any limit; doubles to 192/day in P5 — still safe                                                   |
| T-04-06-07 | Tampering              | P5 CEMADEN append requires orchestrator change (forgotten future-proofing)     | mitigate    | Pre-cutover gate (Task 1) verifies `Promise.allSettled(sources.map(...))` iteration is in place; registry append in P5 is single-line change with no /api/ingest re-edit |

</threat_model>

<verification>
- `git log --oneline phase-4-adapters-cemaden-inmet` shows the atomic-cutover commit
- `git show <cutover-sha> --stat` shows registry.ts modified + 3 files deleted + cross-source-isolation.test.ts comment-only edit
- `pnpm test`, `pnpm depcruise`, `pnpm lint`, `pnpm exec tsc --noEmit` all green
- `grep -rE "import.*[sS]tub|stub-default|STUB_FIXTURE_PATH" src tests scripts .env.example README.md CONTRIBUTING.md 2>/dev/null | grep -v '^[[:space:]]*\\*\\|^[[:space:]]*//' | grep -v ':0$' | wc -l` returns 0
- `test ! -f src/lib/sources/cemaden.ts && test ! -f src/lib/sources/cemaden.schema.ts` (Path C invariant)
- `grep -c "inmetAdapter" src/lib/sources/registry.ts` ≥ 1
- `grep -c "cemadenAdapter" src/lib/sources/registry.ts` = 0 (CEMADEN not registered)
- `grep -c "TODO(P5)" src/lib/sources/registry.ts tests/contract/cross-source-isolation.test.ts` ≥ 2 (carry-over markers)
- Preview deploy smoke: `/api/states` includes `source_key: "inmet"` OR `/api/health` shows recent inmet `lastSuccessfulFetch`
- PR opened with phase title noting Path C
</verification>

<success_criteria>
INMET-only stub-to-real cutover landed atomically; preview deploy returns real INMET data through the full P2 pipeline; CI green; PR ready for human merge. Phase 4 SPEC acceptance criteria met under Q6=a fallback. CEMADEN slot reserved for P5 with zero orchestrator changes needed (Promise.allSettled is N-arity safe).

## Dimension 8 Validation Requirements

Five load-bearing invariants:

1. Atomicity — `git show <sha> --name-status` shows registry.ts modified AND 3 stub files deleted in the same commit.
2. Path C — NO `src/lib/sources/cemaden*` files exist.
3. P5 future-proofing — `/api/ingest` uses `Promise.allSettled(sources.map(...))` (N-arity safe).
4. TODO(P5) markers present in registry.ts and cross-source-isolation.test.ts.
5. Preview-deploy smoke proves REQ-6 (end-to-end real-data flow) under Path C.
   </success_criteria>

<output>
After completion, create `.planning/phases/04-first-two-adapters/04-06-SUMMARY.md` documenting cutover commit SHA, Path C path taken, preview smoke results, PR URL, CEMADEN P5 carry-over note, and any deviations.
</output>
