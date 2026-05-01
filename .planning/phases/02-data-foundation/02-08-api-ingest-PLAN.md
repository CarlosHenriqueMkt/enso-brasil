---
phase: 02-data-foundation
plan: 08
type: execute
wave: 4
depends_on: [02, 03, 04, 05, 06, 07]
files_modified:
  - src/app/api/ingest/route.ts
  - src/app/api/ingest/route.test.ts
  - src/lib/auth/token.ts
  - src/lib/auth/token.test.ts
autonomous: true
requirements:
  - REQ-S2.07
  - REQ-S2.08
  - REQ-S2.09
  - DATA-06
  - DATA-07

must_haves:
  truths:
    - "POST /api/ingest (Node runtime) requires Authorization: Bearer ${INGEST_TOKEN}; constant-time compared via crypto.timingSafeEqual"
    - "Without auth → 401; bad token → 401; valid token → 200 with full report shape"
    - "Orchestration: Promise.allSettled(sources.map(s=>s.fetch())) → zod validate → dedup vs (source_key, payload_hash) → INSERT new alerts → compute placeholder snapshot (risk=unknown for all 27) → setSnapshot Upstash + INSERT snapshot_cache → diffSnapshot + revalidatePath per changed UF + root if any"
    - "On adapter throw: bumps sources_health.consecutive_failures + writes last_error; ingest still completes for other sources (allSettled)"
    - "On zod validation fail: bumps sources_health.payload_hash_drift_count + logs schema_drift; persists nothing for that source"
    - "Second consecutive call adds zero new alerts rows (dedup via UNIQUE INDEX (source_key, payload_hash))"
    - "Logs structured { event, runId, durationMs }"
  artifacts:
    - path: "src/lib/auth/token.ts"
      provides: "verifyBearerToken(req: Request, expected: string): boolean — constant-time via timingSafeEqual; Buffer-length normalization"
      contains: "timingSafeEqual"
    - path: "src/app/api/ingest/route.ts"
      provides: "Node POST handler implementing REQ-S2.07 8-step flow; uses src/db/node.ts (neon-serverless) for transactional safety; calls revalidatePath via next/cache"
      contains: 'runtime = "nodejs"'
    - path: "src/app/api/ingest/route.test.ts"
      provides: "Integration test (gated on DATABASE_URL_TEST + Upstash mock): 401/200/dedup/health-tracking/revalidate-spy"
    - path: "src/lib/auth/token.test.ts"
      provides: "Unit test: timing-attack resistance (length mismatch is constant-time); valid token → true; bad token → false; missing header → false"
  key_links:
    - from: "src/app/api/ingest/route.ts"
      to: "registry sources"
      via: "import { sources } from '@/lib/sources/registry'"
      pattern: 'from "@/lib/sources/registry"'
    - from: "src/app/api/ingest/route.ts"
      to: "revalidatePath"
      via: "import { revalidatePath } from 'next/cache'"
      pattern: "next/cache"
    - from: "src/app/api/ingest/route.ts"
      to: "Node DB driver"
      via: "import { db } from '@/db/node'"
      pattern: 'from "@/db/node"'
---

<objective>
Implement the orchestrator endpoint — the heart of P2's ingest flow. Single Node-runtime route that runs every 15 min via GH Actions cron and produces the cached snapshot.

Purpose: This route ties together every Wave-2 + Wave-3 module. Token-gated, structured-logged, transactional, zod-validated, dedup'd, write-through cached, and revalidation-wired. Behavior is the executable definition of REQ-S2.07.
Output: 2 route files + 2 auth files + integration test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-data-foundation/02-SPEC.md
@.planning/phases/02-data-foundation/02-CONTEXT.md
@.planning/phases/02-data-foundation/02-RESEARCH.md
@.planning/phases/02-data-foundation/02-02-SUMMARY.md
@.planning/phases/02-data-foundation/02-04-SUMMARY.md
@.planning/phases/02-data-foundation/02-05-SUMMARY.md
@.planning/phases/02-data-foundation/02-06-SUMMARY.md
@src/lib/messages.ts

<interfaces>
SPEC REQ-S2.07 — 8-step flow:
  1. Promise.allSettled(sources.map(s => s.fetch()))
  2. Validate each result with AlertArraySchema; failures → record sources_health.last_error + bump consecutive_failures + bump payload_hash_drift_count if zod failure
  3. Dedup new alerts against existing (source_key, payload_hash) rows (use UNIQUE INDEX from plan 02-02)
  4. INSERT net-new rows into alerts
  5. Compute snapshot: per-state group; risk = 'unknown' (placeholder); riskReason = messages.severity.gray ("Dados indisponíveis"); formula_version = 'v0-placeholder'; ALL 27 UFs always present (length 27 contract)
  6. setSnapshot(Upstash) AND INSERT INTO snapshot_cache (write-through)
  7. diffSnapshot(prev, curr) → for each changed UF revalidatePath('/estado/' + uf); if any changed revalidatePath('/')
  8. Return JSON { ok: true, sources: [{key, status, alertCount}], adoptedCount, durationMs }

CONTEXT Implementation Notes line 108: constant-time token compare via crypto.timingSafeEqual + Buffer-length normalization.
CONTEXT Implementation Notes line 134: Node runtime, neon-serverless driver (transactions).
RESEARCH Q1 confirmed: neon-http does NOT support transactions; ingest MUST use neon-serverless.

Dedup strategy: ON CONFLICT (source_key, payload_hash) DO NOTHING — leverages the UNIQUE INDEX defined in plan 02-02. Drizzle: `.onConflictDoNothing()`.

Idempotent: 2 consecutive calls → 1st inserts N rows, 2nd inserts 0 (alerts UNIQUE INDEX); both produce identical snapshot in cache (overwrite is atomic).

Snapshot computation under placeholder:
prev snapshot = await getSnapshot() (may be null on first run)
curr snapshot = UF27.map((uf) => ({ uf, risk: 'unknown', riskReason: messages.severity.gray, alertCount: count of alerts whose state_uf===uf, lastSuccessfulFetch: latest fetched_at for that uf or null, formulaVersion: 'v0-placeholder' }))
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Constant-time bearer-token verifier + unit tests</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-CONTEXT.md (Implementation Notes — constant-time token compare)
    - .planning/phases/02-data-foundation/02-RESEARCH.md (§Security Domain V2)
  </read_first>
  <behavior>
    - verifyBearerToken({ headers: { authorization: 'Bearer abc' } }, 'abc') → true
    - bad token → false
    - missing header → false
    - missing 'Bearer ' prefix → false
    - Buffer-length normalization: even when supplied token differs in LENGTH from expected, comparison still uses constant-time path (no early length-based reject branch leaking info)
  </behavior>
  <files>src/lib/auth/token.ts, src/lib/auth/token.test.ts</files>
  <action>
    1. Write `src/lib/auth/token.ts`:
       ```ts
       import { timingSafeEqual } from "node:crypto";

       /**
        * Constant-time Bearer-token verification (CONTEXT Implementation Notes line 108).
        * Mitigates timing attack on /api/ingest + /api/archive token compare.
        *
        * Buffer-length normalization: pads the shorter buffer to the longer length so
        * timingSafeEqual doesn't leak length differences (it requires equal-length inputs).
        */
       export function verifyBearerToken(req: Request, expected: string): boolean {
         const auth = req.headers.get("authorization");
         if (!auth || !auth.startsWith("Bearer ")) return false;
         const provided = auth.slice("Bearer ".length);
         const a = Buffer.from(provided);
         const b = Buffer.from(expected);
         // Normalize to max length so timingSafeEqual accepts inputs.
         const len = Math.max(a.length, b.length);
         const aPad = Buffer.alloc(len);
         const bPad = Buffer.alloc(len);
         a.copy(aPad);
         b.copy(bPad);
         // Final equality includes a length check that is itself constant-time-safe
         // (a.length === b.length comparison is integer-equal, not data-dependent).
         return timingSafeEqual(aPad, bPad) && a.length === b.length;
       }
       ```

    2. Write `src/lib/auth/token.test.ts`:
       ```ts
       import { describe, it, expect } from "vitest";
       import { verifyBearerToken } from "./token";

       const mkReq = (auth?: string) => new Request("http://x.test", { headers: auth ? { authorization: auth } : {} });

       describe("verifyBearerToken", () => {
         it("returns true for matching Bearer token", () => {
           expect(verifyBearerToken(mkReq("Bearer abc123"), "abc123")).toBe(true);
         });
         it("returns false for wrong token", () => {
           expect(verifyBearerToken(mkReq("Bearer abc123"), "different")).toBe(false);
         });
         it("returns false for missing Authorization header", () => {
           expect(verifyBearerToken(mkReq(), "abc123")).toBe(false);
         });
         it("returns false for header without Bearer prefix", () => {
           expect(verifyBearerToken(mkReq("Basic abc123"), "abc123")).toBe(false);
         });
         it("returns false for length mismatch (constant-time path)", () => {
           expect(verifyBearerToken(mkReq("Bearer ab"), "abcdef")).toBe(false);
         });
         it("does not throw on empty token", () => {
           expect(() => verifyBearerToken(mkReq("Bearer "), "abc")).not.toThrow();
         });
       });
       ```

    3. Run `pnpm test src/lib/auth`. Expect 6/6 pass.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm test src/lib/auth && grep -c "timingSafeEqual" src/lib/auth/token.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test src/lib/auth` exits 0 with 6 passing tests
    - `grep -c "timingSafeEqual" src/lib/auth/token.ts` returns 1
    - `grep -c "node:crypto" src/lib/auth/token.ts` returns 1
  </acceptance_criteria>
  <done>Constant-time bearer verifier with 6-test coverage including length-mismatch and missing-header cases.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: /api/ingest Node route — full 8-step orchestration + integration test</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-SPEC.md (REQ-S2.07 full)
    - .planning/phases/02-data-foundation/02-CONTEXT.md (D-04 revalidatePath wiring)
    - src/db/schema.ts (alerts, sources_health, snapshot_cache)
    - src/lib/sources/registry.ts (sources array)
    - src/lib/sources/schema.ts (AlertArraySchema, computePayloadHash)
    - src/lib/api/schemas.ts (UF27, StateSnapshot, StateSnapshotsResponseSchema)
    - src/lib/snapshot/diff.ts (diffSnapshot)
    - src/lib/cache/upstash.ts (getSnapshot, setSnapshot)
    - src/lib/log/node.ts (logger)
    - src/lib/messages.ts (severity.gray)
  </read_first>
  <behavior>
    - POST /api/ingest without Authorization → 401
    - POST /api/ingest with bad token → 401
    - POST /api/ingest with valid token → 200 + body { ok: true, sources: [...], adoptedCount, durationMs }
    - First call: alerts row count increases by 3 (default stub fixture); cache `snapshot:current` set; snapshot_cache row inserted
    - Second consecutive call: alerts row count unchanged (dedup); cache overwritten (still 27-length); revalidatePath spy called 0 times (P2 placeholder steady state) OR 27+1 times on first call (cold start)
    - When STUB_FIXTURE_PATH points at a fixture that throws zod error: sources_health row for 'stub' has consecutive_failures >= 1 and payload_hash_drift_count >= 1
  </behavior>
  <files>src/app/api/ingest/route.ts, src/app/api/ingest/route.test.ts</files>
  <action>
    1. Write `src/app/api/ingest/route.ts` (full implementation):
       ```ts
       import { NextResponse } from "next/server";
       import { revalidatePath } from "next/cache";
       import { db } from "@/db/node";
       import { alerts, sourcesHealth, snapshotCache } from "@/db/schema";
       import { sources } from "@/lib/sources/registry";
       import { AlertArraySchema, type Alert } from "@/lib/sources/schema";
       import { UF27, type StateSnapshot } from "@/lib/api/schemas";
       import { diffSnapshot } from "@/lib/snapshot/diff";
       import { getSnapshot, setSnapshot } from "@/lib/cache/upstash";
       import { verifyBearerToken } from "@/lib/auth/token";
       import { logger } from "@/lib/log/node";
       import { messages } from "@/lib/messages";
       import { sql } from "drizzle-orm";

       export const runtime = "nodejs";
       export const dynamic = "force-dynamic";

       interface SourceReport {
         key: string;
         status: "ok" | "error" | "drift";
         alertCount: number;
         error?: string;
       }

       export async function POST(req: Request) {
         const t0 = Date.now();
         const runId = crypto.randomUUID();
         const log = logger.child({ runId });

         const expected = process.env.INGEST_TOKEN;
         if (!expected) {
           log.error("ingest.misconfig", new Error("INGEST_TOKEN not set"));
           return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
         }
         if (!verifyBearerToken(req, expected)) {
           log.warn("ingest.unauthorized");
           return NextResponse.json({ error: "unauthorized" }, { status: 401 });
         }

         log.info("ingest.start", { sourceCount: sources.length });

         // Step 1: parallel fetch
         const settled = await Promise.allSettled(sources.map((s) => s.fetch()));
         const reports: SourceReport[] = [];
         const adopted: Alert[] = [];

         for (let i = 0; i < sources.length; i++) {
           const src = sources[i];
           const result = settled[i];
           if (result.status === "rejected") {
             const err = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
             log.error("ingest.source.fetch_failed", err, { sourceKey: src.key });
             await db.insert(sourcesHealth).values({
               sourceKey: src.key, lastAttemptAt: new Date(), lastError: err.message, consecutiveFailures: 1,
             }).onConflictDoUpdate({
               target: sourcesHealth.sourceKey,
               set: { lastAttemptAt: new Date(), lastError: err.message, consecutiveFailures: sql`${sourcesHealth.consecutiveFailures} + 1` },
             });
             reports.push({ key: src.key, status: "error", alertCount: 0, error: err.message });
             continue;
           }

           // Step 2: zod validate
           const parsed = AlertArraySchema.safeParse(result.value);
           if (!parsed.success) {
             log.error("schema_drift", parsed.error, { sourceKey: src.key });
             await db.insert(sourcesHealth).values({
               sourceKey: src.key, lastAttemptAt: new Date(), lastError: parsed.error.message,
               consecutiveFailures: 1, payloadHashDriftCount: 1,
             }).onConflictDoUpdate({
               target: sourcesHealth.sourceKey,
               set: {
                 lastAttemptAt: new Date(), lastError: parsed.error.message,
                 consecutiveFailures: sql`${sourcesHealth.consecutiveFailures} + 1`,
                 payloadHashDriftCount: sql`${sourcesHealth.payloadHashDriftCount} + 1`,
               },
             });
             reports.push({ key: src.key, status: "drift", alertCount: 0, error: parsed.error.message });
             continue;
           }

           // Step 4: insert with dedup
           const rows = parsed.data.map((a) => ({
             sourceKey: a.source_key, hazardKind: a.hazard_kind, stateUf: a.state_uf,
             severity: a.severity, headline: a.headline, body: a.body, sourceUrl: a.source_url,
             fetchedAt: new Date(a.fetched_at),
             validFrom: a.valid_from ? new Date(a.valid_from) : null,
             validUntil: a.valid_until ? new Date(a.valid_until) : null,
             payloadHash: a.payload_hash, raw: a.raw,
           }));
           const inserted = rows.length === 0 ? [] : await db.insert(alerts).values(rows).onConflictDoNothing().returning({ id: alerts.id });
           adopted.push(...parsed.data);
           reports.push({ key: src.key, status: "ok", alertCount: inserted.length });

           // Update health: success
           await db.insert(sourcesHealth).values({
             sourceKey: src.key, lastAttemptAt: new Date(), lastSuccessAt: new Date(), consecutiveFailures: 0,
           }).onConflictDoUpdate({
             target: sourcesHealth.sourceKey,
             set: { lastAttemptAt: new Date(), lastSuccessAt: new Date(), consecutiveFailures: 0, lastError: null },
           });
         }

         // Step 5: compute placeholder snapshot (P2 — all UFs unknown)
         const alertsByUF = new Map<string, Alert[]>();
         for (const a of adopted) {
           const arr = alertsByUF.get(a.state_uf) ?? [];
           arr.push(a);
           alertsByUF.set(a.state_uf, arr);
         }
         const curr: StateSnapshot[] = UF27.map((uf) => {
           const ufAlerts = alertsByUF.get(uf) ?? [];
           const lastFetch = ufAlerts.reduce<string | null>((acc, a) => {
             return !acc || a.fetched_at > acc ? a.fetched_at : acc;
           }, null);
           return {
             uf,
             risk: "unknown" as const,
             riskReason: messages.severity.gray,
             alertCount: ufAlerts.length,
             lastSuccessfulFetch: lastFetch,
             formulaVersion: "v0-placeholder",
           };
         });

         // Step 6: write-through (Upstash + snapshot_cache)
         const prev = await getSnapshot<StateSnapshot[]>();
         await setSnapshot(curr);
         await db.insert(snapshotCache).values({
           snapshotKey: "current", body: curr, computedAt: new Date(), formulaVersion: "v0-placeholder",
         }).onConflictDoUpdate({
           target: snapshotCache.snapshotKey,
           set: { body: curr, computedAt: new Date(), formulaVersion: "v0-placeholder" },
         });

         // Step 7: revalidate
         const { changedUFs, rootChanged } = diffSnapshot(prev, curr);
         for (const uf of changedUFs) revalidatePath("/estado/" + uf);
         if (rootChanged) revalidatePath("/");

         const durationMs = Date.now() - t0;
         const adoptedCount = reports.reduce((acc, r) => acc + r.alertCount, 0);
         log.info("ingest.done", { durationMs, adoptedCount, changedUFs: changedUFs.length, rootChanged });

         return NextResponse.json({ ok: true, sources: reports, adoptedCount, durationMs }, { status: 200 });
       }
       ```

    2. Write `src/app/api/ingest/route.test.ts` (gated on DATABASE_URL_TEST + Upstash mock):
       ```ts
       import { describe, it, expect, beforeEach, vi } from "vitest";
       import { db } from "@/db/node";
       import { alerts, sourcesHealth, snapshotCache } from "@/db/schema";
       import { __setRedisForTest } from "@/lib/cache/upstash";
       import { UpstashRedisMock } from "../../../../tests/setup/upstash-mock";

       vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

       const skip = !process.env.DATABASE_URL_TEST;

       describe.skipIf(skip)("POST /api/ingest (integration)", () => {
         let mock: UpstashRedisMock;
         beforeEach(async () => {
           mock = new UpstashRedisMock();
           __setRedisForTest(mock as never);
           process.env.INGEST_TOKEN = "test-token-abc";
           delete process.env.STUB_FIXTURE_PATH;
           await db.delete(alerts);
           await db.delete(sourcesHealth);
           await db.delete(snapshotCache);
           vi.clearAllMocks();
         });

         it("rejects request without Authorization → 401", async () => {
           const { POST } = await import("./route");
           const res = await POST(new Request("http://x.test/api/ingest", { method: "POST" }));
           expect(res.status).toBe(401);
         });

         it("rejects bad token → 401", async () => {
           const { POST } = await import("./route");
           const res = await POST(new Request("http://x.test/api/ingest", { method: "POST", headers: { authorization: "Bearer wrong" } }));
           expect(res.status).toBe(401);
         });

         it("valid token → 200 + adopts 3 stub alerts on first call", async () => {
           const { POST } = await import("./route");
           const res = await POST(new Request("http://x.test/api/ingest", { method: "POST", headers: { authorization: "Bearer test-token-abc" } }));
           expect(res.status).toBe(200);
           const body = await res.json();
           expect(body.ok).toBe(true);
           expect(body.adoptedCount).toBe(3);
           const all = await db.select().from(alerts);
           expect(all.length).toBe(3);
         });

         it("dedup: second call adds 0 new rows", async () => {
           const { POST } = await import("./route");
           const auth = { authorization: "Bearer test-token-abc" };
           await POST(new Request("http://x.test/api/ingest", { method: "POST", headers: auth }));
           const res2 = await POST(new Request("http://x.test/api/ingest", { method: "POST", headers: auth }));
           const body2 = await res2.json();
           expect(body2.adoptedCount).toBe(0);
           const all = await db.select().from(alerts);
           expect(all.length).toBe(3);
         });

         it("snapshot:current set in Upstash with length 27", async () => {
           const { POST } = await import("./route");
           await POST(new Request("http://x.test/api/ingest", { method: "POST", headers: { authorization: "Bearer test-token-abc" } }));
           const cached = await mock.get<unknown[]>("snapshot:current");
           expect(Array.isArray(cached)).toBe(true);
           expect(cached!.length).toBe(27);
         });

         it("snapshot_cache table receives matching row", async () => {
           const { POST } = await import("./route");
           await POST(new Request("http://x.test/api/ingest", { method: "POST", headers: { authorization: "Bearer test-token-abc" } }));
           const rows = await db.select().from(snapshotCache);
           expect(rows.length).toBe(1);
           expect(rows[0].formulaVersion).toBe("v0-placeholder");
         });

         it("revalidatePath called for all 27 UFs + root on cold start", async () => {
           const { revalidatePath } = await import("next/cache");
           const { POST } = await import("./route");
           await POST(new Request("http://x.test/api/ingest", { method: "POST", headers: { authorization: "Bearer test-token-abc" } }));
           expect(revalidatePath).toHaveBeenCalledTimes(28);
         });

         it("revalidatePath called 0 times on second steady-state call (P2 placeholder unchanged)", async () => {
           const { revalidatePath } = await import("next/cache");
           const { POST } = await import("./route");
           const auth = { authorization: "Bearer test-token-abc" };
           await POST(new Request("http://x.test/api/ingest", { method: "POST", headers: auth }));
           vi.clearAllMocks();
           await POST(new Request("http://x.test/api/ingest", { method: "POST", headers: auth }));
           expect(revalidatePath).toHaveBeenCalledTimes(0);
         });

         it("adapter throw bumps consecutive_failures + writes last_error", async () => {
           process.env.STUB_FIXTURE_PATH = "tests/fixtures/sources/does-not-exist.json";
           const { POST } = await import("./route");
           const res = await POST(new Request("http://x.test/api/ingest", { method: "POST", headers: { authorization: "Bearer test-token-abc" } }));
           expect(res.status).toBe(200);
           const body = await res.json();
           expect(body.sources[0].status).toBe("error");
           const health = await db.select().from(sourcesHealth);
           expect(health[0].sourceKey).toBe("stub");
           expect(health[0].consecutiveFailures).toBeGreaterThanOrEqual(1);
           expect(health[0].lastError).toBeTruthy();
         });
       });
       ```

    3. Run `pnpm test src/app/api/ingest`. Tests gated on DATABASE_URL_TEST — they are skipped until plan 02-10 sets up docker PG. Acceptance verifies the file structure regardless.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm exec tsc --noEmit && pnpm lint && grep -c "runtime = \"nodejs\"" src/app/api/ingest/route.ts && grep -c "verifyBearerToken" src/app/api/ingest/route.ts && grep -c "Promise.allSettled" src/app/api/ingest/route.ts && grep -c "onConflictDoNothing" src/app/api/ingest/route.ts && grep -c "revalidatePath" src/app/api/ingest/route.ts && grep -c "diffSnapshot" src/app/api/ingest/route.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm exec tsc --noEmit` exits 0
    - `pnpm lint` exits 0
    - `grep -c "runtime = \"nodejs\"" src/app/api/ingest/route.ts` returns 1
    - `grep -c "verifyBearerToken" src/app/api/ingest/route.ts` returns 1
    - `grep -c "Promise.allSettled" src/app/api/ingest/route.ts` returns 1
    - `grep -c "onConflictDoNothing" src/app/api/ingest/route.ts` returns 1
    - `grep -c "revalidatePath" src/app/api/ingest/route.ts` returns >= 2
    - `grep -c "diffSnapshot" src/app/api/ingest/route.ts` returns 1
    - `grep -c "from \"@/db/node\"" src/app/api/ingest/route.ts` returns 1 (NOT @/db/edge)
    - `grep -c "v0-placeholder" src/app/api/ingest/route.ts` returns >= 1
    - All 8 listed integration tests are present in the test file (verify via `grep -c "it(" src/app/api/ingest/route.test.ts` returns >= 8) — execution gated on docker PG (plan 02-10)
  </acceptance_criteria>
  <done>/api/ingest implements full 8-step REQ-S2.07 flow: token-gated, allSettled, zod-validated, dedup'd, write-through cached, revalidate-wired. 8 integration tests cover auth/200/dedup/health/cache/revalidate.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                            | Description                          |
| ----------------------------------- | ------------------------------------ |
| GH Actions / internet → /api/ingest | Bearer token authentication required |
| Adapter response → DB               | zod validation before persistence    |

## STRIDE Threat Register

| Threat ID | Category               | Component                                  | Disposition | Mitigation Plan                                                                                                          |
| --------- | ---------------------- | ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| T-02-19   | Spoofing               | Token forgery on /api/ingest               | mitigate    | INGEST_TOKEN required; openssl rand -hex 32 documented in .env.example; verifyBearerToken                                |
| T-02-20   | Information Disclosure | Timing attack on token compare             | mitigate    | crypto.timingSafeEqual + Buffer-length normalization (CONTEXT line 108); 6 unit tests in plan task 1                     |
| T-02-21   | Tampering              | Adapter payload corrupts cache             | mitigate    | AlertArraySchema.safeParse before persistence (REQ-S2.09); failure increments payload_hash_drift_count, persists nothing |
| T-02-22   | Denial of Service      | Adapter timeout cascades to ingest timeout | mitigate    | httpGet 8s timeout (plan 02-03); allSettled isolates per-adapter failure; 5min job timeout in cron.yml (plan 02-09)      |
| T-02-23   | Elevation of Privilege | Bypassing auth via header trick            | mitigate    | Strict "Bearer " prefix check; constant-time comparison; integration test 1 covers no-header rejection                   |
| T-02-24   | Information Disclosure | Adapter exception message contains secret  | mitigate    | logger.error serializes Error → { message, stack, name }; pino redact paths cover token/secret/password (plan 02-04)     |

</threat_model>

<verification>
tsc + lint clean; route file contains all REQ-S2.07 8-step markers via grep; 8 integration tests structured + gated on DB; auth unit tests cover 6 scenarios.
</verification>

<success_criteria>
Every cron tick produces a deterministic, auth-gated, zod-validated, dedup'd snapshot in cache + DB write-through. Failures isolated per-adapter via allSettled. Public-safety stance preserved (errors logged, never silently swallowed).
</success_criteria>

<output>
After completion, create `.planning/phases/02-data-foundation/02-08-SUMMARY.md`
</output>
