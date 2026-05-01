---
phase: 02-data-foundation
plan: 06
type: execute
wave: 3
depends_on: [01, 05]
files_modified:
  - src/lib/api/schemas.ts
  - src/lib/api/schemas.test.ts
  - src/lib/snapshot/diff.ts
  - src/lib/snapshot/diff.test.ts
autonomous: true
requirements:
  - REQ-S2.10
  - REQ-S2.07

must_haves:
  truths:
    - "src/lib/api/schemas.ts exports UF27 enum, StateSnapshotSchema, HealthReportSchema, StateSnapshotsResponseSchema (length 27) per REQ-S2.10"
    - "src/lib/snapshot/diff.ts exports diffSnapshot(prev, curr): { changedUFs, rootChanged } per D-04"
    - "TS types are inferred via z.infer (single source of truth — no dual interface declarations)"
    - "Diff returns all 27 UFs as changed when prev is null (cold start); empty array when prev === curr (steady state)"
  artifacts:
    - path: "src/lib/api/schemas.ts"
      provides: "UF27 const tuple; StateSnapshotSchema (uf+risk+riskReason+alertCount+lastSuccessfulFetch+formulaVersion); SourceHealthSchema; HealthReportSchema; StateSnapshotsResponseSchema = z.array(StateSnapshotSchema).length(27); plus inferred types"
      contains: "z.array(StateSnapshotSchema).length(27)"
    - path: "src/lib/snapshot/diff.ts"
      provides: "diffSnapshot(prev: StateSnapshot[] | null, curr: StateSnapshot[]): { changedUFs: string[]; rootChanged: boolean }"
      contains: "diffSnapshot"
    - path: "src/lib/api/schemas.test.ts"
      provides: "Vitest unit covering all 27 UFs accepted; risk enum lock; length(27) constraint"
    - path: "src/lib/snapshot/diff.test.ts"
      provides: "Vitest unit covering null prev (all 27 changed), identical (empty), partial change (subset returned), rootChanged flag"
  key_links:
    - from: "src/lib/api/schemas.ts"
      to: "zod 4"
      via: "import { z } from 'zod'"
      pattern: "z\\.enum\\(UF27\\)"
    - from: "src/lib/snapshot/diff.ts"
      to: "StateSnapshot type"
      via: "import"
      pattern: "from \"\\.\\./api/schemas\""
---

<objective>
Lock the public API response shapes (REQ-S2.10) and implement the snapshot-diff utility (D-04) that drives `revalidatePath` calls in /api/ingest.

Purpose: Schemas are the contract that /api/states + /api/health + UI (P5) all depend on. Defined now to prevent UI rework in P5. Diff util has its own bugs (null prev, length mismatch, ordering) that we test now even though P2's placeholder `unknown` always produces empty diffs.
Output: 2 lib modules + 2 vitest specs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-data-foundation/02-SPEC.md
@.planning/phases/02-data-foundation/02-CONTEXT.md
@.planning/phases/02-data-foundation/02-05-SUMMARY.md
@src/lib/messages.ts

<interfaces>
SPEC REQ-S2.10:
  StateSnapshotSchema = z.object({
    uf: z.enum(UF27),
    risk: z.enum(['green','yellow','orange','red','unknown']),
    riskReason: z.string(),
    alertCount: z.number().int().nonnegative(),
    lastSuccessfulFetch: z.string().datetime().nullable(),
    formulaVersion: z.string()
  })
  HealthReportSchema = z.object({
    generatedAt: z.string().datetime(),
    sources: z.array(SourceHealthSchema)
  })
  SourceHealthSchema = z.object({
    key: z.string(), displayName: z.string(),
    lastSuccessAt: z.string().datetime().nullable(),
    consecutiveFailures: z.number().int().nonnegative(),
    isStale: z.boolean(),
    payloadDriftCount: z.number().int().nonnegative()
  })
  StateSnapshotsResponseSchema = z.array(StateSnapshotSchema).length(27)
  // length(27): always all 27 UFs, missing → unknown placeholder

D-04 diff:
diffSnapshot(prev: null, curr): all 27 UFs in changedUFs, rootChanged true (cold cache → fire revalidatePath for each + root)
diffSnapshot(prev, curr) where every UF risk matches: changedUFs=[], rootChanged=false
diffSnapshot detects partial changes: only UFs whose risk differs are returned

UF27 list: AC,AL,AP,AM,BA,CE,DF,ES,GO,MA,MT,MS,MG,PA,PB,PR,PE,PI,RJ,RN,RS,RO,RR,SC,SP,SE,TO
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Lock zod response schemas + diff util + tests</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-SPEC.md (REQ-S2.10 full)
    - .planning/phases/02-data-foundation/02-CONTEXT.md (D-04)
  </read_first>
  <behavior>
    - StateSnapshotsResponseSchema rejects length-26 input AND length-28 input
    - diffSnapshot(null, [27 alerts]) returns { changedUFs: [27], rootChanged: true }
    - diffSnapshot(prev, curr) where curr === prev returns { changedUFs: [], rootChanged: false }
    - diffSnapshot when only SP risk changed returns { changedUFs: ["SP"], rootChanged: true }
    - Type inference: z.infer<typeof StateSnapshotSchema> is consumable as TS type
  </behavior>
  <files>src/lib/api/schemas.ts, src/lib/api/schemas.test.ts, src/lib/snapshot/diff.ts, src/lib/snapshot/diff.test.ts</files>
  <action>
    1. Write `src/lib/api/schemas.ts`:
       ```ts
       import { z } from "zod";

       export const UF27 = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;
       export type UF = (typeof UF27)[number];

       export const RISK_LEVELS = ["green","yellow","orange","red","unknown"] as const;

       export const StateSnapshotSchema = z.object({
         uf: z.enum(UF27),
         risk: z.enum(RISK_LEVELS),
         riskReason: z.string(),
         alertCount: z.number().int().nonnegative(),
         lastSuccessfulFetch: z.string().datetime().nullable(),
         formulaVersion: z.string(),
       });
       export type StateSnapshot = z.infer<typeof StateSnapshotSchema>;

       export const SourceHealthSchema = z.object({
         key: z.string(),
         displayName: z.string(),
         lastSuccessAt: z.string().datetime().nullable(),
         consecutiveFailures: z.number().int().nonnegative(),
         isStale: z.boolean(),
         payloadDriftCount: z.number().int().nonnegative(),
       });
       export type SourceHealth = z.infer<typeof SourceHealthSchema>;

       export const HealthReportSchema = z.object({
         generatedAt: z.string().datetime(),
         sources: z.array(SourceHealthSchema),
       });
       export type HealthReport = z.infer<typeof HealthReportSchema>;

       export const StateSnapshotsResponseSchema = z.array(StateSnapshotSchema).length(27);
       export type StateSnapshotsResponse = z.infer<typeof StateSnapshotsResponseSchema>;
       ```

    2. Write `src/lib/api/schemas.test.ts`:
       ```ts
       import { describe, it, expect } from "vitest";
       import { UF27, StateSnapshotSchema, StateSnapshotsResponseSchema, HealthReportSchema, SourceHealthSchema } from "./schemas";

       const validSnap = (uf: string) => ({
         uf, risk: "unknown" as const, riskReason: "Dados indisponíveis",
         alertCount: 0, lastSuccessfulFetch: null, formulaVersion: "v0-placeholder",
       });

       describe("StateSnapshotSchema", () => {
         it("accepts a valid placeholder snapshot", () => {
           expect(() => StateSnapshotSchema.parse(validSnap("SP"))).not.toThrow();
         });
         it("rejects bad UF", () => {
           expect(() => StateSnapshotSchema.parse(validSnap("ZZ"))).toThrow();
         });
         it("rejects negative alertCount", () => {
           expect(() => StateSnapshotSchema.parse({ ...validSnap("SP"), alertCount: -1 })).toThrow();
         });
         it("rejects bad risk enum", () => {
           expect(() => StateSnapshotSchema.parse({ ...validSnap("SP"), risk: "purple" })).toThrow();
         });
       });

       describe("StateSnapshotsResponseSchema (length 27)", () => {
         const all27 = UF27.map((u) => validSnap(u));
         it("accepts all 27 UFs", () => {
           expect(() => StateSnapshotsResponseSchema.parse(all27)).not.toThrow();
         });
         it("rejects length 26", () => {
           expect(() => StateSnapshotsResponseSchema.parse(all27.slice(0, 26))).toThrow();
         });
         it("rejects length 28", () => {
           expect(() => StateSnapshotsResponseSchema.parse([...all27, validSnap("SP")])).toThrow();
         });
       });

       describe("HealthReportSchema", () => {
         it("accepts a valid HealthReport", () => {
           const report = {
             generatedAt: new Date().toISOString(),
             sources: [{ key: "stub", displayName: "Stub", lastSuccessAt: null, consecutiveFailures: 0, isStale: false, payloadDriftCount: 0 }],
           };
           expect(() => HealthReportSchema.parse(report)).not.toThrow();
         });
         it("rejects bad generatedAt", () => {
           expect(() => HealthReportSchema.parse({ generatedAt: "not-iso", sources: [] })).toThrow();
         });
       });

       describe("UF27", () => {
         it("has exactly 27 entries", () => {
           expect(UF27.length).toBe(27);
         });
       });
       ```

    3. Write `src/lib/snapshot/diff.ts`:
       ```ts
       import type { StateSnapshot } from "../api/schemas";

       export interface SnapshotDiff {
         changedUFs: string[];
         rootChanged: boolean;
       }

       /**
        * Compare prev vs curr. Returns the UFs whose risk level differs (so /api/ingest can
        * call revalidatePath('/estado/{uf}') for each), plus rootChanged=true if any UF changed.
        *
        * D-04: Under P2 placeholder `risk: 'unknown'` everywhere, prev and curr always match
        * after the first ingest, so changedUFs returns []. Cold start (prev=null) returns all 27.
        */
       export function diffSnapshot(prev: StateSnapshot[] | null, curr: StateSnapshot[]): SnapshotDiff {
         if (!prev) {
           return {
             changedUFs: curr.map((s) => s.uf),
             rootChanged: curr.length > 0,
           };
         }
         const prevByUF = new Map(prev.map((s) => [s.uf, s]));
         const changedUFs: string[] = [];
         for (const c of curr) {
           const p = prevByUF.get(c.uf);
           if (!p || p.risk !== c.risk) changedUFs.push(c.uf);
         }
         return { changedUFs, rootChanged: changedUFs.length > 0 };
       }
       ```

    4. Write `src/lib/snapshot/diff.test.ts`:
       ```ts
       import { describe, it, expect } from "vitest";
       import { diffSnapshot } from "./diff";
       import { UF27, type StateSnapshot } from "../api/schemas";

       const snap = (uf: string, risk: StateSnapshot["risk"] = "unknown"): StateSnapshot => ({
         uf, risk, riskReason: "x", alertCount: 0, lastSuccessfulFetch: null, formulaVersion: "v0-placeholder",
       });

       describe("diffSnapshot", () => {
         const all27 = UF27.map((u) => snap(u));

         it("null prev → all UFs in changedUFs + rootChanged true (cold start)", () => {
           const out = diffSnapshot(null, all27);
           expect(out.changedUFs.length).toBe(27);
           expect(out.rootChanged).toBe(true);
         });

         it("identical prev/curr → empty changedUFs + rootChanged false (P2 steady state)", () => {
           const out = diffSnapshot(all27, all27);
           expect(out.changedUFs).toEqual([]);
           expect(out.rootChanged).toBe(false);
         });

         it("single UF risk change → only that UF returned + rootChanged true", () => {
           const curr = all27.map((s) => (s.uf === "SP" ? { ...s, risk: "red" as const } : s));
           const out = diffSnapshot(all27, curr);
           expect(out.changedUFs).toEqual(["SP"]);
           expect(out.rootChanged).toBe(true);
         });

         it("multiple UFs change → all listed", () => {
           const curr = all27.map((s) => (["SP", "RJ", "AM"].includes(s.uf) ? { ...s, risk: "yellow" as const } : s));
           const out = diffSnapshot(all27, curr);
           expect(out.changedUFs.sort()).toEqual(["AM", "RJ", "SP"]);
           expect(out.rootChanged).toBe(true);
         });

         it("missing UF in prev (length mismatch) treated as changed", () => {
           const partialPrev = all27.slice(0, 26); // missing TO
           const out = diffSnapshot(partialPrev, all27);
           expect(out.changedUFs).toContain("TO");
         });
       });
       ```

    5. Run `pnpm test src/lib/api src/lib/snapshot`. Expect 14 tests pass.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm test src/lib/api src/lib/snapshot && grep -c "z.array(StateSnapshotSchema).length(27)" src/lib/api/schemas.ts && grep -c "diffSnapshot" src/lib/snapshot/diff.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test src/lib/api src/lib/snapshot` exits 0; >= 14 tests pass
    - `grep -c "z.array(StateSnapshotSchema).length(27)" src/lib/api/schemas.ts` returns 1
    - `grep -c "z.enum(UF27)" src/lib/api/schemas.ts` returns 1
    - `grep -c "z.enum(RISK_LEVELS)" src/lib/api/schemas.ts` returns 1
    - `grep -c "z.infer" src/lib/api/schemas.ts` returns >= 4 (one per major schema)
    - `grep -c "diffSnapshot" src/lib/snapshot/diff.ts` returns >= 1
  </acceptance_criteria>
  <done>API contracts locked via zod; UF27 enum centralized; diff util ready for /api/ingest with full coverage of P2 cold-start + steady-state + partial-change cases.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-15 | Tampering | Snapshot length=27 contract violated downstream | mitigate | StateSnapshotsResponseSchema enforces .length(27) at parse time; /api/states zod-validates before serving |
</threat_model>

<verification>
14 tests pass; UF27 has exactly 27 entries; length(27) constraint enforced on response shape.
</verification>

<success_criteria>
API contracts immutable until next phase; diff util zero rework when P3 lands real risk computation.
</success_criteria>

<output>
After completion, create `.planning/phases/02-data-foundation/02-06-SUMMARY.md`
</output>
