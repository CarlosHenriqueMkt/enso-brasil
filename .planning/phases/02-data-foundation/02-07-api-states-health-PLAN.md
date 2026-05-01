---
phase: 02-data-foundation
plan: 07
type: execute
wave: 3
depends_on: [01, 03, 04, 06]
files_modified:
  - src/app/api/states/route.ts
  - src/app/api/health/route.ts
  - src/app/api/states/route.test.ts
  - src/app/api/health/route.test.ts
autonomous: true
requirements:
  - REQ-S2.10
  - REQ-S2.08
  - DATA-07

must_haves:
  truths:
    - "GET /api/states (edge runtime) reads from Upstash, parses with StateSnapshotsResponseSchema, returns 200 JSON"
    - "GET /api/states returns 503 with { error: 'snapshot_unavailable' } on cache miss"
    - "GET /api/health (edge runtime) returns parsed HealthReportSchema (sources surface from sources_health table via neon-http)"
    - "Both routes export `runtime = 'edge'`"
    - "Both routes import from src/lib/log/edge.ts (NOT src/lib/log/node.ts) — enforced by ESLint rule from plan 02-04"
    - "Both routes do NOT import pino"
  artifacts:
    - path: "src/app/api/states/route.ts"
      provides: "Edge GET handler: getSnapshot() → if null 503; else StateSnapshotsResponseSchema.parse + return JSON"
      contains: 'runtime = "edge"'
    - path: "src/app/api/health/route.ts"
      provides: "Edge GET handler: query sources_health via neon-http, build HealthReport, parse, return JSON"
      contains: 'runtime = "edge"'
    - path: "src/app/api/states/route.test.ts"
      provides: "Vitest contract test: cache hit returns parsed StateSnapshotsResponse; cache miss returns 503"
    - path: "src/app/api/health/route.test.ts"
      provides: "Vitest contract test: response matches HealthReportSchema; isStale=true when last_success_at > 30min ago"
  key_links:
    - from: "src/app/api/states/route.ts"
      to: "Upstash cache"
      via: "import { getSnapshot } from '@/lib/cache/upstash'"
      pattern: "getSnapshot"
    - from: "src/app/api/health/route.ts"
      to: "neon-http edge db"
      via: "import { db } from '@/db/edge'"
      pattern: 'from "@/db/edge"'
---

<objective>
Ship the two read-path edge routes that serve the public API. Both are thin: parse → return JSON. No business logic, no risk computation (placeholder unknown is set in /api/ingest).

Purpose: P5 UI consumes these. Locking them now means UI work in P5 can mock against the zod schemas without back-and-forth. Edge runtime keeps latency low and avoids consuming Vercel function quota for read traffic.
Output: 2 route files + 2 vitest contract tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-data-foundation/02-SPEC.md
@.planning/phases/02-data-foundation/02-CONTEXT.md
@.planning/phases/02-data-foundation/02-RESEARCH.md
@.planning/phases/02-data-foundation/02-06-SUMMARY.md

<interfaces>
SPEC REQ-S2.10:
  /api/states (edge):
    Read from Upstash via getSnapshot()
    On miss: 503 with body { error: "snapshot_unavailable" }
    On hit: parse via StateSnapshotsResponseSchema; return 200 JSON
  /api/health (edge):
    Query all rows from sources_health table
    For each row, derive isStale = (now - last_success_at) > 30min OR last_success_at === null
    Return HealthReport: { generatedAt, sources: [SourceHealth] }

RESEARCH §Edge Caveats:
drizzle-orm/neon-http: edge-safe, NO transactions
pino: NOT edge-safe — use src/lib/log/edge.ts only
ESLint guard from plan 02-04 already blocks accidental pino import in src/app/api/states + health

Cache miss vs cache hit (REQ-S2.10): 503 on miss is intentional — DB read-through fallback is deferred to P6.

Source displayName lookup: query the sources registry to enrich health rows with displayName. Registry is server-side; importing src/lib/sources/registry.ts in an edge route is fine (registry.ts only imports from src/lib/sources/stub.ts which uses fs — edge can't run fs at runtime, but the import graph is tree-shaken: only the type/key/displayName are referenced from the route, NOT fetch()). To be safe: extract a `sourceDisplayNames: Record<string, string>` const in registry.ts and import only that into edge routes.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: /api/states edge route + contract test</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-SPEC.md (REQ-S2.10)
    - src/lib/cache/upstash.ts (getSnapshot signature + __setRedisForTest)
    - src/lib/api/schemas.ts (StateSnapshotsResponseSchema)
  </read_first>
  <behavior>
    - GET /api/states with valid cached snapshot → 200 + JSON array length 27
    - GET /api/states with empty cache → 503 + { error: "snapshot_unavailable" }
    - Response Content-Type: application/json
  </behavior>
  <files>src/app/api/states/route.ts, src/app/api/states/route.test.ts</files>
  <action>
    1. Write `src/app/api/states/route.ts`:
       ```ts
       import { NextResponse } from "next/server";
       import { getSnapshot } from "@/lib/cache/upstash";
       import { StateSnapshotsResponseSchema } from "@/lib/api/schemas";
       import { logger } from "@/lib/log/edge";

       export const runtime = "edge";
       export const dynamic = "force-dynamic";

       export async function GET() {
         const t0 = Date.now();
         try {
           const cached = await getSnapshot();
           if (!cached) {
             logger.warn("api.states.miss", { durationMs: Date.now() - t0 });
             return NextResponse.json({ error: "snapshot_unavailable" }, { status: 503 });
           }
           const parsed = StateSnapshotsResponseSchema.parse(cached);
           logger.info("api.states.ok", { durationMs: Date.now() - t0, count: parsed.length });
           return NextResponse.json(parsed, { status: 200 });
         } catch (err) {
           logger.error("api.states.error", err, { durationMs: Date.now() - t0 });
           return NextResponse.json({ error: "snapshot_corrupt" }, { status: 502 });
         }
       }
       ```

    2. Write `src/app/api/states/route.test.ts`:
       ```ts
       import { describe, it, expect, beforeEach } from "vitest";
       import { UpstashRedisMock } from "../../../../tests/setup/upstash-mock";
       import { __setRedisForTest } from "@/lib/cache/upstash";
       import { UF27 } from "@/lib/api/schemas";
       import { GET } from "./route";

       const validSnap = (uf: string) => ({
         uf, risk: "unknown", riskReason: "Dados indisponíveis",
         alertCount: 0, lastSuccessfulFetch: null, formulaVersion: "v0-placeholder",
       });
       const all27 = UF27.map(validSnap);

       describe("GET /api/states", () => {
         let mock: UpstashRedisMock;
         beforeEach(() => { mock = new UpstashRedisMock(); __setRedisForTest(mock as never); });

         it("returns 503 + {error:'snapshot_unavailable'} on cache miss", async () => {
           const res = await GET();
           expect(res.status).toBe(503);
           const body = await res.json();
           expect(body).toEqual({ error: "snapshot_unavailable" });
         });

         it("returns 200 + valid StateSnapshotsResponse on cache hit", async () => {
           await mock.set("snapshot:current", all27);
           const res = await GET();
           expect(res.status).toBe(200);
           const body = await res.json();
           expect(Array.isArray(body)).toBe(true);
           expect(body.length).toBe(27);
           expect(body[0]).toMatchObject({ uf: expect.any(String), risk: expect.any(String) });
         });

         it("returns 502 on schema-mismatched cache content", async () => {
           await mock.set("snapshot:current", [{ bogus: true }]);
           const res = await GET();
           expect(res.status).toBe(502);
         });
       });
       ```

    3. Run `pnpm test src/app/api/states`. Expect 3/3 pass.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm test src/app/api/states && grep -c "runtime = \"edge\"" src/app/api/states/route.ts && grep -c "from \"pino\"" src/app/api/states/route.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test src/app/api/states` exits 0 with 3 passing tests
    - `grep -c "runtime = \"edge\"" src/app/api/states/route.ts` returns 1
    - `grep -c "from \"pino\"" src/app/api/states/route.ts` returns 0 (no pino in edge)
    - `grep -c "StateSnapshotsResponseSchema" src/app/api/states/route.ts` returns >= 1
    - `grep -c "snapshot_unavailable" src/app/api/states/route.ts` returns 1
    - `pnpm lint` exits 0 (ESLint no-restricted-imports guard from plan 02-04 passes)
  </acceptance_criteria>
  <done>/api/states ships edge route with 503-on-miss + 200-on-hit semantics; zero pino import; 3 contract tests lock the contract.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: /api/health edge route + contract test</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-SPEC.md (REQ-S2.08, REQ-S2.10)
    - src/db/edge.ts (neon-http db instance)
    - src/lib/sources/registry.ts (for displayName lookup — extract a names map if needed)
  </read_first>
  <behavior>
    - GET /api/health returns 200 + HealthReport
    - Each source row has isStale = true if last_success_at is null OR > 30min ago
    - Response parses against HealthReportSchema
  </behavior>
  <files>src/app/api/health/route.ts, src/app/api/health/route.test.ts</files>
  <action>
    1. First, augment `src/lib/sources/registry.ts` with an edge-safe displayNames lookup (single edit — append):
       ```ts
       /** Edge-safe: only the names map; importing this avoids pulling fs from stub.ts. */
       export const sourceDisplayNames: Record<string, string> = Object.fromEntries(
         sources.map((s) => [s.key, s.displayName]),
       );
       ```
       NOTE: `sources` array is already exported. The displayNames const is derived. Tree-shakers will still drag in stub.ts at build time, BUT because edge runtime resolves modules statically, the `fs` import in stub.ts is referenced only inside `fetch()` — V8 isolates evaluate the module body which calls `import { readFile } from 'node:fs/promises'`, which fails. To AVOID this, refactor: split the registry into `registry-meta.ts` (only key+displayName) and `registry.ts` (full adapters with fetch). Make this refactor as part of this task. New file `src/lib/sources/registry-meta.ts`:
       ```ts
       /** Edge-safe metadata only. Kept in sync with registry.ts manually (3 fields, low churn). */
       export const sourceMetadata: ReadonlyArray<{ key: string; displayName: string }> = [
         { key: "stub", displayName: "Stub (fixture)" },
       ];
       export const sourceDisplayNames: Record<string, string> = Object.fromEntries(sourceMetadata.map((s) => [s.key, s.displayName]));
       ```
       And add a unit test in `src/lib/sources/registry.test.ts` that asserts every entry in `sources` has a corresponding entry in `sourceMetadata` with identical key+displayName (drift detector). This file is added as part of this task.

       NOTE: this means files_modified for this plan also touches `src/lib/sources/registry-meta.ts` and `src/lib/sources/registry.test.ts`. Add them to the commit.

    2. Write `src/app/api/health/route.ts`:
       ```ts
       import { NextResponse } from "next/server";
       import { db } from "@/db/edge";
       import { sourcesHealth } from "@/db/schema";
       import { HealthReportSchema, type SourceHealth } from "@/lib/api/schemas";
       import { sourceDisplayNames } from "@/lib/sources/registry-meta";
       import { logger } from "@/lib/log/edge";

       export const runtime = "edge";
       export const dynamic = "force-dynamic";

       const STALE_THRESHOLD_MS = 30 * 60 * 1000;

       export async function GET() {
         const t0 = Date.now();
         try {
           const rows = await db.select().from(sourcesHealth);
           const now = Date.now();
           const sources: SourceHealth[] = rows.map((r) => {
             const lastSuccessIso = r.lastSuccessAt ? new Date(r.lastSuccessAt).toISOString() : null;
             const lastTs = r.lastSuccessAt ? new Date(r.lastSuccessAt).getTime() : null;
             const isStale = lastTs === null || now - lastTs > STALE_THRESHOLD_MS;
             return {
               key: r.sourceKey,
               displayName: sourceDisplayNames[r.sourceKey] ?? r.sourceKey,
               lastSuccessAt: lastSuccessIso,
               consecutiveFailures: r.consecutiveFailures,
               isStale,
               payloadDriftCount: r.payloadHashDriftCount,
             };
           });
           const report = { generatedAt: new Date().toISOString(), sources };
           const parsed = HealthReportSchema.parse(report);
           logger.info("api.health.ok", { durationMs: Date.now() - t0, sourceCount: sources.length });
           return NextResponse.json(parsed, { status: 200 });
         } catch (err) {
           logger.error("api.health.error", err, { durationMs: Date.now() - t0 });
           return NextResponse.json({ error: "health_unavailable" }, { status: 503 });
         }
       }
       ```

    3. Write `src/app/api/health/route.test.ts` (uses docker PG via vitest setup hook from plan 02-10; if that hook isn't present yet — it lands in wave 6 — gate the test with `it.skipIf(!process.env.DATABASE_URL_TEST)`):
       ```ts
       import { describe, it, expect, beforeEach } from "vitest";
       import { db } from "@/db/edge";
       import { sourcesHealth } from "@/db/schema";
       import { HealthReportSchema } from "@/lib/api/schemas";

       const skip = !process.env.DATABASE_URL_TEST;

       describe.skipIf(skip)("GET /api/health (integration)", () => {
         beforeEach(async () => {
           await db.delete(sourcesHealth);
         });

         it("returns valid HealthReport when sources_health is empty", async () => {
           const { GET } = await import("./route");
           const res = await GET();
           expect(res.status).toBe(200);
           const body = await res.json();
           expect(() => HealthReportSchema.parse(body)).not.toThrow();
           expect(body.sources).toEqual([]);
         });

         it("marks isStale=true for null last_success_at", async () => {
           await db.insert(sourcesHealth).values({ sourceKey: "stub" });
           const { GET } = await import("./route");
           const res = await GET();
           const body = await res.json();
           expect(body.sources[0]).toMatchObject({ key: "stub", isStale: true });
         });

         it("marks isStale=true for last_success_at older than 30min", async () => {
           await db.insert(sourcesHealth).values({
             sourceKey: "stub",
             lastSuccessAt: new Date(Date.now() - 31 * 60 * 1000),
           });
           const { GET } = await import("./route");
           const res = await GET();
           const body = await res.json();
           expect(body.sources[0].isStale).toBe(true);
         });

         it("marks isStale=false for last_success_at within 30min", async () => {
           await db.insert(sourcesHealth).values({
             sourceKey: "stub",
             lastSuccessAt: new Date(Date.now() - 5 * 60 * 1000),
           });
           const { GET } = await import("./route");
           const res = await GET();
           const body = await res.json();
           expect(body.sources[0].isStale).toBe(false);
         });
       });
       ```

    4. Write `src/lib/sources/registry.test.ts` (drift detector for registry-meta):
       ```ts
       import { describe, it, expect } from "vitest";
       import { sources } from "./registry";
       import { sourceMetadata } from "./registry-meta";

       describe("registry-meta drift detector", () => {
         it("every source in registry has matching metadata entry", () => {
           expect(sourceMetadata.length).toBe(sources.length);
           for (const s of sources) {
             const meta = sourceMetadata.find((m) => m.key === s.key);
             expect(meta).toBeDefined();
             expect(meta!.displayName).toBe(s.displayName);
           }
         });
       });
       ```

    5. Run `pnpm test src/app/api/health src/lib/sources/registry.test.ts`. Until plan 02-10 lands, the integration tests are skipped via `skip` flag — that's expected (gate is honored by the test, no failure). Drift test must pass unconditionally.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm test src/app/api/health src/lib/sources/registry.test.ts && grep -c "runtime = \"edge\"" src/app/api/health/route.ts && grep -c "from \"pino\"" src/app/api/health/route.ts && test -f src/lib/sources/registry-meta.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test src/app/api/health src/lib/sources/registry.test.ts` exits 0 (integration tests skipped if DATABASE_URL_TEST unset; drift test passes)
    - `grep -c "runtime = \"edge\"" src/app/api/health/route.ts` returns 1
    - `grep -c "from \"pino\"" src/app/api/health/route.ts` returns 0
    - `grep -c "STALE_THRESHOLD_MS = 30 \\* 60 \\* 1000" src/app/api/health/route.ts` returns 1
    - File `src/lib/sources/registry-meta.ts` exists and exports sourceDisplayNames
    - `pnpm lint` exits 0
  </acceptance_criteria>
  <done>/api/health ships edge route + drift-protected registry-meta + 4 contract tests (3 integration gated on DB, 1 always-on drift).</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                             | Description               |
| ------------------------------------ | ------------------------- |
| Internet → /api/states + /api/health | Public endpoints, no auth |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                 | Disposition | Mitigation Plan                                                                    |
| --------- | ---------------------- | --------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| T-02-16   | Information Disclosure | Cache poisoning serves bad payload as valid               | mitigate    | StateSnapshotsResponseSchema.parse on every read; 502 on parse fail                |
| T-02-17   | Denial of Service      | Public endpoints rate-abused                              | accept      | Vercel built-in rate limit + edge runtime ~100ms response; revisit in P7 if needed |
| T-02-18   | Information Disclosure | Edge route accidentally bundles pino → silent deploy fail | mitigate    | ESLint no-restricted-imports rule from plan 02-04 + grep gate in acceptance        |

</threat_model>

<verification>
4 unit + 4 integration (gated) tests pass; both routes export edge runtime; no pino import; cache-miss returns 503; cache-hit returns parsed JSON.
</verification>

<success_criteria>
Read APIs ship with locked zod contract. UI in P5 can mock against StateSnapshotsResponseSchema and HealthReportSchema directly.
</success_criteria>

<output>
After completion, create `.planning/phases/02-data-foundation/02-07-SUMMARY.md`
</output>
