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
  - README.md
  - CONTRIBUTING.md
autonomous: true
requirements: [ADAPT-01, ADAPT-02, ADAPT-04]
must_haves:
  truths:
    - "src/lib/sources/registry.ts exports [cemadenAdapter, inmetAdapter] (or [inmetAdapter] in Q6=a fallback)"
    - "src/lib/sources/stub.ts no longer exists"
    - "src/lib/sources/stub.test.ts no longer exists"
    - "tests/fixtures/sources/stub-default.json no longer exists"
    - "No file in src/, tests/, or scripts/ imports stubAdapter or references the stub fixture path"
    - "Registry-isolation grep gate (P2) still passes"
    - "dep-cruiser RISK-01 isolation rule still passes"
    - "All commits in this plan land as a single atomic commit on the phase branch"
    - "README + CONTRIBUTING document the fixture-refresh procedure"
    - "End-to-end smoke against preview: /api/states returns alerts with source: cemaden and/or inmet (or sources_health shows recent lastSuccessfulFetch when no alerts active)"
  artifacts:
    - path: "src/lib/sources/registry.ts"
      provides: "Updated registry with real adapters"
      contains: "cemadenAdapter"
    - path: "README.md"
      provides: "Section pointing maintainers at fixture-refresh scripts"
      contains: "fixtures:refresh"
    - path: "CONTRIBUTING.md"
      provides: "Fixture-refresh procedure"
      contains: "pnpm fixtures:refresh"
  key_links:
    - from: "src/lib/sources/registry.ts"
      to: "src/lib/sources/cemaden.ts"
      via: "import { cemadenAdapter }"
      pattern: "from \\\"\\./cemaden\\\""
    - from: "src/lib/sources/registry.ts"
      to: "src/lib/sources/inmet.ts"
      via: "import { inmetAdapter }"
      pattern: "from \\\"\\./inmet\\\""
---

<objective>
Atomic cutover: in a single commit, register the real adapters in `registry.ts` AND delete `stub.ts`, `stub.test.ts`, and the stub fixture. Update README + CONTRIBUTING with the fixture-refresh procedure. Verify CI green and run a manual smoke against the preview deployment.

Purpose: REQ-3 from SPEC (atomic stub cutover). After this commit, the entire ingest pipeline runs on real Brazilian official data. The stub is dead.

Output: One atomic commit + README/CONTRIBUTING updates + preview-deploy smoke.
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
@.planning/phases/04-02-SUMMARY.md
@.planning/phases/04-03-SUMMARY.md
@.planning/phases/04-05-SUMMARY.md

<interfaces>
<!-- Current registry (pre-cutover): -->
```ts
// src/lib/sources/registry.ts
import type { SourceAdapter } from "./types";
import { stubAdapter } from "./stub";
export const sources: readonly SourceAdapter[] = [stubAdapter];
export const sourceDisplayNames: Record<string, string> = Object.freeze(
  Object.fromEntries(sources.map((s) => [s.key, s.displayName])),
);
```

<!-- Post-cutover (standard path): -->

```ts
import type { SourceAdapter } from "./types";
import { cemadenAdapter } from "./cemaden";
import { inmetAdapter } from "./inmet";
export const sources: readonly SourceAdapter[] = [cemadenAdapter, inmetAdapter];
export const sourceDisplayNames: Record<string, string> = Object.freeze(
  Object.fromEntries(sources.map((s) => [s.key, s.displayName])),
);
```

<!-- Q6=a fallback path: registry = [inmetAdapter] only; stub still removed. -->
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
    3. Registry-isolation grep gate (from P2 CI) is documented in `.github/workflows/ci.yml` — verify the command:
       `grep -rE "import.*Stub|import.*Cemaden|import.*Inmet" src/lib src/app | grep -v "src/lib/sources/" | wc -l` returns 0.
    4. Wave 1 + Wave 2 outputs exist: `src/lib/sources/cemaden.ts`, `src/lib/sources/inmet.ts`, `tests/contract/cemaden.test.ts`, `tests/contract/inmet.test.ts`, fixtures present.
    5. Q6 status determined: full-path (both adapters) or Q6=a (INMET only).

    If ANY precondition fails: STOP. Do not proceed to deletion. Escalate to orchestrator.

  </action>
  <verify>
    <automated>pnpm test && pnpm depcruise && bash -c 'COUNT=$(grep -rE "import.*[sS]tub|import.*Cemaden|import.*Inmet" src/lib src/app 2>/dev/null | grep -v "src/lib/sources/" | grep -v "^[[:space:]]*\\*\\|^[[:space:]]*//" | wc -l); if [ "$COUNT" -ne 0 ]; then echo "registry isolation broken: $COUNT lines"; exit 1; fi'</automated>
  </verify>
  <done>All preconditions confirmed; registry isolation intact; Q6 path decided.</done>
</task>

<task type="auto">
  <name>Task 2: Atomic cutover commit — registry rewrite + stub deletion</name>
  <files>src/lib/sources/registry.ts, src/lib/sources/stub.ts (deleted), src/lib/sources/stub.test.ts (deleted), tests/fixtures/sources/stub-default.json (deleted)</files>
  <behavior>
    Single git commit containing:
    - Rewrite `src/lib/sources/registry.ts` per &lt;interfaces&gt; (full path or Q6=a fallback).
    - Delete `src/lib/sources/stub.ts`.
    - Delete `src/lib/sources/stub.test.ts`.
    - Delete `tests/fixtures/sources/stub-default.json`.
    - Remove any orphaned `STUB_FIXTURE_PATH` env reference (`.env.example`, README, CONTRIBUTING) — grep before commit.

    Commit message:
    ```
    feat(04): atomic cutover — register real adapters, delete stub

    Replaces stubAdapter with cemadenAdapter + inmetAdapter (or inmet only
    under Q6=a fallback). Deletes stub.ts, stub.test.ts, and the stub
    fixture in the same diff. Registry-isolation grep gate and depcruise
    RISK-01 still pass.

    Closes REQ-S4-3 (atomic cutover) from .planning/phases/04-first-two-adapters/04-SPEC.md.
    ```

  </behavior>
  <action>
    1. Edit `src/lib/sources/registry.ts` — full rewrite per interfaces block.
    2. `git rm src/lib/sources/stub.ts src/lib/sources/stub.test.ts tests/fixtures/sources/stub-default.json`.
    3. Grep for stragglers: `grep -rn "stubAdapter\|stub-default\|STUB_FIXTURE_PATH" src/ tests/ scripts/ .env.example README.md CONTRIBUTING.md` → must be 0 lines (excluding code comments that explicitly reference past-state e.g. "previously stub" — but prefer to remove those too).
    4. Run `pnpm test`, `pnpm depcruise`, `pnpm lint`, `pnpm exec tsc --noEmit`.
    5. If all green: `git add` the changes + deletions, `git commit` with the message above.
    6. Verify `git show --stat HEAD` shows: registry.ts modified, 3 files deleted, no other src changes.
  </action>
  <verify>
    <automated>bash -c 'test ! -f src/lib/sources/stub.ts && test ! -f src/lib/sources/stub.test.ts && test ! -f tests/fixtures/sources/stub-default.json && pnpm test && pnpm depcruise && pnpm lint && pnpm exec tsc --noEmit'</automated>
  </verify>
  <done>Single atomic commit on phase branch deletes stub artifacts and registers real adapters; CI green locally.</done>
</task>

<task type="auto">
  <name>Task 3: README + CONTRIBUTING updates for fixture-refresh procedure</name>
  <files>README.md, CONTRIBUTING.md</files>
  <behavior>
    - README PT-BR (primary) addendum: short section "Atualizando fixtures" — explains `pnpm fixtures:refresh:cemaden` and `pnpm fixtures:refresh:inmet`, when to run (when contract test fails or planned drift check), exit codes, manual review of diff.
    - CONTRIBUTING.md: fuller procedure — workflow for capturing, reviewing diff, removing obsolete fixture, opening PR. Reference issue #4 for the deferred sentinel.
  </behavior>
  <action>
    1. Add an "Atualizando fixtures de fontes" section to README.md (PT-BR primary; EN secondary if README has bilingual structure).
    2. Add a "Refresh source fixtures" section to CONTRIBUTING.md (English) describing the full maintainer workflow: when, how, exit-code semantics, diff review, remove obsolete file in same PR, link to drift-sentinel issue #4.
    3. Commit: `docs(04): document fixture-refresh procedure`.
  </action>
  <verify>
    <automated>grep -c "fixtures:refresh:cemaden" README.md && grep -c "fixtures:refresh:inmet" README.md && grep -c "fixtures:refresh" CONTRIBUTING.md</automated>
  </verify>
  <done>Both files reference the refresh scripts; CONTRIBUTING describes the procedure end-to-end.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Real-data ingest live on preview deployment. Atomic cutover commit on phase branch; PR ready to open.
  </what-built>
  <how-to-verify>
    1. Push the phase branch: `git push origin phase-4-adapters-cemaden-inmet`.
    2. Wait for Vercel preview deployment to go green.
    3. With `INGEST_TOKEN` from Vercel env (env pull masks Sensitive vars per memory feedback — get from Vercel dashboard):
       ```
       curl -X POST https://<preview-url>/api/ingest -H "Authorization: Bearer $INGEST_TOKEN"
       ```
       Expect HTTP 200 with a per-source summary; if Q6=a fallback, only `inmet` appears in the summary.
    4. `curl https://<preview-url>/api/states | jq '[.snapshots[] | .alerts[] | .source_key] | unique'` → should include `"cemaden"` and/or `"inmet"`. If both sources currently have zero active alerts nationally (possible during quiet periods), proceed to step 5.
    5. `curl https://<preview-url>/api/health | jq '.sources'` → both sources show a `lastSuccessfulFetch` timestamp within the last few minutes (proof the fetch ran even if 0 alerts emitted).
    6. Open PR with title `Phase 4: First Two Adapters (CEMADEN + INMET)` and the standard summary; do NOT merge — that's a separate user action.
  </how-to-verify>
  <resume-signal>Type "approved" once preview smoke is green and PR is open. Describe issues if any.</resume-signal>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                     | Description                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| committed cutover diff → CI → preview deploy | Trusted (atomic commit, mandatory CI gate); stub-removal asymmetry eliminated by single-diff rule |
| preview API → curl smoke                     | INGEST_TOKEN bearer auth (P2); HTTPS only                                                         |

## STRIDE Threat Register (ASVS L2)

| Threat ID  | Category               | Component                                                                      | Disposition | Mitigation Plan                                                                                                                                                             |
| ---------- | ---------------------- | ------------------------------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-04-06-01 | Tampering              | Partial cutover (stub removed but registry still references it) deploys broken | mitigate    | Single atomic commit; pre-commit grep + tsc + test gate; verifier loop runs after this plan                                                                                 |
| T-04-06-02 | Tampering              | Stub fixture path remains in env defaults / docs, future regression            | mitigate    | Task 2 grep sweep across src/tests/scripts/.env.example/README/CONTRIBUTING                                                                                                 |
| T-04-06-03 | Information Disclosure | INGEST_TOKEN leaked via shell history during smoke                             | mitigate    | Use Vercel dashboard or `vercel env pull` to a gitignored file (memory: feedback_vercel_sensitive_vars masks Sensitive vars; pull from dashboard); never inline in commands |
| T-04-06-04 | Spoofing               | apex→www redirect drops Authorization header on smoke curl                     | mitigate    | Smoke uses canonical `https://www.ensobrasil.com.br/...` per memory feedback_apex_redirect_auth                                                                             |
| T-04-06-05 | Tampering              | Squash-merge collapses cutover with unrelated commits, hiding atomic property  | mitigate    | Phase branch contains only Phase 4 commits; PR description points to atomic-cutover commit by SHA in body                                                                   |
| T-04-06-06 | DoS                    | Cutover increases outbound traffic (2 calls/15min) above free tier             | accept      | Per CONTEXT free-tier math: 192 outbound calls/day; well under any limit                                                                                                    |

</threat_model>

<verification>
- `git log --oneline phase-4-adapters-cemaden-inmet` shows the atomic-cutover commit
- `git show <cutover-sha> --stat` shows registry.ts modified + 3 files deleted, nothing else
- `pnpm test`, `pnpm depcruise`, `pnpm lint`, `pnpm exec tsc --noEmit` all green
- `grep -rE "import.*[sS]tub|stub-default|STUB_FIXTURE_PATH" src tests scripts .env.example README.md CONTRIBUTING.md 2>/dev/null | grep -v '^[[:space:]]*\\*\\|^[[:space:]]*//' | grep -v ':0$' | wc -l` returns 0
- Preview deploy smoke: `/api/states` includes real source_key values OR `/api/health` shows recent lastSuccessfulFetch for both sources
- PR opened with phase title; not yet merged
</verification>

<success_criteria>
Stub-to-real cutover landed atomically; preview deploy returns real Brazilian official-source data through the full P2 pipeline; CI green; PR ready for human merge. Phase 4 SPEC acceptance criteria all met (or Q6=a fallback documented in 04-06-SUMMARY with CEMADEN deferred to P5/P6).

## Dimension 8 Validation Requirements

The atomicity invariant is load-bearing: `git show <sha> --name-status` must show registry.ts modified AND 3 stub files deleted in the same commit. Any partial cutover (modified registry without deleted stub, or vice versa) fails the verification grep gate. The preview-deploy smoke is the canonical proof that REQ-6 (end-to-end real-data flow) is met.
</success_criteria>

<output>
After completion, create `.planning/phases/04-first-two-adapters/04-06-SUMMARY.md` documenting cutover commit SHA, Q6 path taken, preview smoke results, PR URL, and any deviations.
</output>
