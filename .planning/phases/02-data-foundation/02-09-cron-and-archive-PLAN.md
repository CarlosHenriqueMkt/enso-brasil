---
phase: 02-data-foundation
plan: 09
type: execute
wave: 5
depends_on: [02, 08]
files_modified:
  - .github/workflows/cron.yml
  - .github/workflows/archive.yml
  - drizzle/migrations/0002_snapshot_archive.sql
  - drizzle/migrations/meta/0002_snapshot.json
  - drizzle/migrations/meta/_journal.json
  - src/db/schema.ts # extends file created by plan 02-02; APPEND snapshotArchive table — do NOT recreate
  - src/app/api/archive/route.ts
  - src/app/api/archive/route.test.ts
autonomous: true
requirements:
  - REQ-S2.06
  - REQ-S2.11
  - DATA-05
  - DATA-09

must_haves:
  truths:
    - ".github/workflows/cron.yml schedules every 15 min via '*/15 * * * *' + workflow_dispatch + curl --retry 3 --retry-delay 5 --retry-all-errors POST to $VERCEL_URL/api/ingest"
    - ".github/workflows/archive.yml schedules daily at '0 6 * * *' UTC (=03:00 BRT) + workflow_dispatch; calls /api/archive with same INGEST_TOKEN"
    - "snapshot_archive table added via 0002 migration: PK (date, snapshot_key), body jsonb, formula_version text"
    - "/api/archive (Node runtime, token-gated): copies latest snapshot_cache row to snapshot_archive keyed by current date; deletes archive rows older than 30 days in same run"
    - "Both workflows use actions/checkout@v6 — but cron.yml is curl-only (no checkout needed); archive.yml is curl-only too"
    - "GH Actions versions bumped per RESEARCH: checkout@v6, setup-node@v6 (only where needed), pnpm/action-setup@v5"
  artifacts:
    - path: ".github/workflows/cron.yml"
      provides: "schedule '*/15 * * * *' + workflow_dispatch; single curl step with --retry 3, --retry-delay 5, --retry-all-errors; 5min timeout-minutes"
      contains: "*/15 * * * *"
    - path: ".github/workflows/archive.yml"
      provides: "schedule '0 6 * * *' (UTC=03:00 BRT) + workflow_dispatch; curl POST /api/archive with INGEST_TOKEN; --retry 3"
      contains: "0 6 * * *"
    - path: "drizzle/migrations/0002_snapshot_archive.sql"
      provides: "CREATE TABLE snapshot_archive (date date NOT NULL, snapshot_key text NOT NULL, body jsonb NOT NULL, formula_version text NOT NULL, PRIMARY KEY (date, snapshot_key))"
      contains: "snapshot_archive"
    - path: "src/db/schema.ts"
      provides: "Append snapshotArchive pgTable export"
      contains: "snapshotArchive"
    - path: "src/app/api/archive/route.ts"
      provides: "Node POST handler: token-gate → SELECT latest snapshot_cache row → INSERT/UPDATE snapshot_archive (date=today) → DELETE WHERE date < today - 30 days → return { ok, archived, pruned, durationMs }"
      contains: 'runtime = "nodejs"'
    - path: "src/app/api/archive/route.test.ts"
      provides: "Integration test (gated): produces row dated today; rows >30d old pruned"
  key_links:
    - from: ".github/workflows/cron.yml"
      to: "/api/ingest"
      via: "curl POST with Authorization: Bearer ${INGEST_TOKEN}"
      pattern: "Authorization: Bearer"
---

<objective>
Wire the GH Actions cron + archive workflows and the /api/archive endpoint. Cron triggers ingest every 15 min; archive runs daily at 03:00 BRT to copy the latest snapshot to snapshot_archive (30-day retention).

Purpose: Cron is the only thing that produces fresh snapshots in P2. Without it, the cache stays empty and /api/states returns 503 forever. Archive provides historical data for M10 future use (DATA-09 requirement).
Output: 2 workflows + 0002 migration + schema append + archive route + tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-data-foundation/02-SPEC.md
@.planning/phases/02-data-foundation/02-CONTEXT.md
@.planning/phases/02-data-foundation/02-RESEARCH.md
@.planning/phases/02-data-foundation/02-08-SUMMARY.md

<interfaces>
SPEC REQ-S2.06 cron.yml:
  schedule: '*/15 * * * *' + workflow_dispatch
  Single step: curl -fsSL --retry 3 --retry-delay 5 --retry-all-errors -X POST -H "Authorization: Bearer $INGEST_TOKEN" "$VERCEL_URL/api/ingest"
  timeout-minutes: 5
  No setup-node, no actions/checkout (curl-only)
  Secrets: INGEST_TOKEN, VERCEL_URL

SPEC REQ-S2.11 archive.yml:
schedule: '0 6 \* \* \*' UTC = 03:00 America/Sao_Paulo (BRT, -03:00)
curl POST /api/archive with same INGEST_TOKEN
/api/archive copies latest snapshot_cache → snapshot_archive (date PK); prunes >30d
failure of archive must NOT block ingest (workflows are independent)

RESEARCH §GitHub Actions: checkout@v6, setup-node@v6, pnpm/action-setup@v5 (drop with.version), gitleaks-action@v2.3.9

snapshot_archive PG schema:
date date NOT NULL
snapshot_key text NOT NULL (always 'current' in P2)
body jsonb NOT NULL
formula_version text NOT NULL
PRIMARY KEY (date, snapshot_key)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: cron.yml + archive.yml workflows (curl-only, retry-armed)</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-SPEC.md (REQ-S2.06, REQ-S2.11)
    - .planning/phases/02-data-foundation/02-RESEARCH.md (§GitHub Actions Versions, §Migration Path Notes)
    - .github/workflows/ci.yml (existing — for version-bump cross-reference)
  </read_first>
  <files>.github/workflows/cron.yml, .github/workflows/archive.yml</files>
  <action>
    1. Write `.github/workflows/cron.yml`:
       ```yaml
       name: Cron — /api/ingest

       on:
         schedule:
           # Every 15 minutes (UTC). REQ-S2.06.
           - cron: "*/15 * * * *"
         workflow_dispatch: {}

       permissions:
         contents: read

       jobs:
         ingest:
           runs-on: ubuntu-latest
           timeout-minutes: 5
           steps:
             - name: POST /api/ingest with retry
               env:
                 INGEST_TOKEN: ${{ secrets.INGEST_TOKEN }}
                 VERCEL_URL: ${{ secrets.VERCEL_URL }}
               run: |
                 curl -fsSL \
                   --retry 3 --retry-delay 5 --retry-all-errors \
                   --max-time 60 \
                   -X POST \
                   -H "Authorization: Bearer ${INGEST_TOKEN}" \
                   -H "Content-Type: application/json" \
                   "${VERCEL_URL}/api/ingest"
       ```

    2. Write `.github/workflows/archive.yml`:
       ```yaml
       name: Daily archive — /api/archive

       on:
         schedule:
           # 06:00 UTC = 03:00 America/Sao_Paulo (BRT, -03:00). REQ-S2.11.
           - cron: "0 6 * * *"
         workflow_dispatch: {}

       permissions:
         contents: read

       jobs:
         archive:
           runs-on: ubuntu-latest
           timeout-minutes: 5
           steps:
             - name: POST /api/archive with retry
               env:
                 INGEST_TOKEN: ${{ secrets.INGEST_TOKEN }}
                 VERCEL_URL: ${{ secrets.VERCEL_URL }}
               run: |
                 curl -fsSL \
                   --retry 3 --retry-delay 5 --retry-all-errors \
                   --max-time 60 \
                   -X POST \
                   -H "Authorization: Bearer ${INGEST_TOKEN}" \
                   -H "Content-Type: application/json" \
                   "${VERCEL_URL}/api/archive"
       ```

    3. Validate YAML parses:
       ```
       node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/cron.yml','utf8'))"
       node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/archive.yml','utf8'))"
       ```
       NOTE: js-yaml may not be installed. Alternative — use Python `python -c "import yaml; yaml.safe_load(open('.github/workflows/cron.yml'))"` OR run actionlint binary if available. If neither, manually inspect the file by re-reading it and confirming it parses by visual inspection (cron.yml is short).

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && grep -c "\\*/15 \\* \\* \\* \\*" .github/workflows/cron.yml && grep -c "0 6 \\* \\* \\*" .github/workflows/archive.yml && grep -c "Authorization: Bearer" .github/workflows/cron.yml && grep -c "retry 3" .github/workflows/cron.yml && grep -c "Authorization: Bearer" .github/workflows/archive.yml</automated>
  </verify>
  <acceptance_criteria>
    - File `.github/workflows/cron.yml` exists; `grep -c "\\*/15 \\* \\* \\* \\*" .github/workflows/cron.yml` returns 1
    - `grep -c "workflow_dispatch" .github/workflows/cron.yml` returns 1
    - `grep -c "retry 3" .github/workflows/cron.yml` returns 1
    - `grep -c "retry-all-errors" .github/workflows/cron.yml` returns 1
    - `grep -c "timeout-minutes: 5" .github/workflows/cron.yml` returns 1
    - File `.github/workflows/archive.yml` exists; `grep -c "0 6 \\* \\* \\*" .github/workflows/archive.yml` returns 1
    - `grep -c "Authorization: Bearer" .github/workflows/archive.yml` returns 1
    - Neither workflow uses actions/checkout (curl-only): `grep -c "actions/checkout" .github/workflows/cron.yml` returns 0; same for archive.yml
  </acceptance_criteria>
  <done>cron.yml runs every 15 min with retry-armed curl; archive.yml runs daily at 03:00 BRT. Both gated on INGEST_TOKEN + VERCEL_URL secrets.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: snapshot_archive table migration + /api/archive Node route + integration test</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-SPEC.md (REQ-S2.11)
    - src/db/schema.ts (existing — append snapshotArchive)
    - src/app/api/ingest/route.ts (mirror auth+log patterns)
  </read_first>
  <behavior>
    - POST /api/archive without auth → 401
    - With valid token + snapshot_cache contains row: snapshot_archive receives row dated today (UTC); rows older than 30 days deleted in same run
    - Returns JSON { ok: true, archived: 1, pruned: N, durationMs }
    - Idempotent: second call same day uses ON CONFLICT DO UPDATE (overwrite)
  </behavior>
  <files>src/db/schema.ts, drizzle/migrations/0002_snapshot_archive.sql, src/app/api/archive/route.ts, src/app/api/archive/route.test.ts</files>
  <action>
    1. Append to `src/db/schema.ts`:
       ```ts
       import { date, primaryKey } from "drizzle-orm/pg-core";
       // ... existing exports

       export const snapshotArchive = pgTable(
         "snapshot_archive",
         {
           date: date("date").notNull(),
           snapshotKey: text("snapshot_key").notNull(),
           body: jsonb("body").notNull(),
           formulaVersion: text("formula_version").notNull(),
         },
         (t) => ({ pk: primaryKey({ columns: [t.date, t.snapshotKey] }) }),
       );
       export type SnapshotArchiveRow = typeof snapshotArchive.$inferSelect;
       ```

    2. Generate the migration:
       ```
       pnpm db:generate
       ```
       MUST produce `drizzle/migrations/0002_*.sql` containing CREATE TABLE snapshot_archive with composite PK (date, snapshot_key). Inspect SQL — must NOT recreate alerts/sources_health/snapshot_cache (those exist from 0001).

    3. Write `src/app/api/archive/route.ts`:
       ```ts
       import { NextResponse } from "next/server";
       import { db } from "@/db/node";
       import { snapshotCache, snapshotArchive } from "@/db/schema";
       import { verifyBearerToken } from "@/lib/auth/token";
       import { logger } from "@/lib/log/node";
       import { desc, lt, sql } from "drizzle-orm";

       export const runtime = "nodejs";
       export const dynamic = "force-dynamic";

       const RETENTION_DAYS = 30;

       export async function POST(req: Request) {
         const t0 = Date.now();
         const runId = crypto.randomUUID();
         const log = logger.child({ runId });

         const expected = process.env.INGEST_TOKEN;
         if (!expected) {
           log.error("archive.misconfig", new Error("INGEST_TOKEN not set"));
           return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
         }
         if (!verifyBearerToken(req, expected)) {
           log.warn("archive.unauthorized");
           return NextResponse.json({ error: "unauthorized" }, { status: 401 });
         }

         log.info("archive.start");

         // Latest snapshot_cache row (P2 has snapshotKey === 'current' only)
         const latest = await db.select().from(snapshotCache).orderBy(desc(snapshotCache.computedAt)).limit(1);
         if (latest.length === 0) {
           log.warn("archive.no_snapshot");
           return NextResponse.json({ ok: true, archived: 0, pruned: 0, durationMs: Date.now() - t0 }, { status: 200 });
         }
         const row = latest[0];

         const today = new Date();
         const dateStr = today.toISOString().slice(0, 10); // YYYY-MM-DD UTC

         await db.insert(snapshotArchive).values({
           date: dateStr,
           snapshotKey: row.snapshotKey,
           body: row.body,
           formulaVersion: row.formulaVersion,
         }).onConflictDoUpdate({
           target: [snapshotArchive.date, snapshotArchive.snapshotKey],
           set: { body: row.body, formulaVersion: row.formulaVersion },
         });

         // Prune > 30 days
         const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000);
         const cutoffStr = cutoff.toISOString().slice(0, 10);
         const pruned = await db.delete(snapshotArchive).where(lt(snapshotArchive.date, cutoffStr)).returning({ date: snapshotArchive.date });

         const durationMs = Date.now() - t0;
         log.info("archive.done", { archived: 1, pruned: pruned.length, durationMs });
         return NextResponse.json({ ok: true, archived: 1, pruned: pruned.length, durationMs }, { status: 200 });
       }
       ```

    4. Write `src/app/api/archive/route.test.ts`:
       ```ts
       import { describe, it, expect, beforeEach } from "vitest";
       import { db } from "@/db/node";
       import { snapshotCache, snapshotArchive } from "@/db/schema";

       const skip = !process.env.DATABASE_URL_TEST;

       describe.skipIf(skip)("POST /api/archive (integration)", () => {
         beforeEach(async () => {
           process.env.INGEST_TOKEN = "test-token-abc";
           await db.delete(snapshotArchive);
           await db.delete(snapshotCache);
           await db.insert(snapshotCache).values({
             snapshotKey: "current",
             body: [{ uf: "SP" }],
             computedAt: new Date(),
             formulaVersion: "v0-placeholder",
           });
         });

         it("rejects without auth → 401", async () => {
           const { POST } = await import("./route");
           const res = await POST(new Request("http://x.test/api/archive", { method: "POST" }));
           expect(res.status).toBe(401);
         });

         it("produces archive row dated today on first call", async () => {
           const { POST } = await import("./route");
           const res = await POST(new Request("http://x.test/api/archive", { method: "POST", headers: { authorization: "Bearer test-token-abc" } }));
           expect(res.status).toBe(200);
           const today = new Date().toISOString().slice(0, 10);
           const rows = await db.select().from(snapshotArchive);
           expect(rows.length).toBe(1);
           expect(rows[0].date).toBe(today);
         });

         it("idempotent on second call same day (ON CONFLICT DO UPDATE)", async () => {
           const { POST } = await import("./route");
           const auth = { authorization: "Bearer test-token-abc" };
           await POST(new Request("http://x.test/api/archive", { method: "POST", headers: auth }));
           await POST(new Request("http://x.test/api/archive", { method: "POST", headers: auth }));
           const rows = await db.select().from(snapshotArchive);
           expect(rows.length).toBe(1);
         });

         it("prunes archive rows older than 30 days", async () => {
           const oldDate = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString().slice(0, 10);
           await db.insert(snapshotArchive).values({
             date: oldDate, snapshotKey: "current", body: [{ stale: true }], formulaVersion: "v0-placeholder",
           });
           const { POST } = await import("./route");
           const res = await POST(new Request("http://x.test/api/archive", { method: "POST", headers: { authorization: "Bearer test-token-abc" } }));
           const body = await res.json();
           expect(body.pruned).toBeGreaterThanOrEqual(1);
           const remaining = await db.select().from(snapshotArchive);
           expect(remaining.find((r) => r.date === oldDate)).toBeUndefined();
         });

         it("returns archived=0 when snapshot_cache is empty", async () => {
           await db.delete(snapshotCache);
           const { POST } = await import("./route");
           const res = await POST(new Request("http://x.test/api/archive", { method: "POST", headers: { authorization: "Bearer test-token-abc" } }));
           const body = await res.json();
           expect(body.archived).toBe(0);
         });
       });
       ```

    5. Run `pnpm db:check` (must exit 0 — schema and migration in sync). Run `pnpm exec tsc --noEmit`.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm exec tsc --noEmit && pnpm db:check && grep -c "snapshot_archive" drizzle/migrations/0002_*.sql && grep -c "runtime = \"nodejs\"" src/app/api/archive/route.ts && grep -c "RETENTION_DAYS = 30" src/app/api/archive/route.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm exec tsc --noEmit` exits 0
    - `pnpm db:check` exits 0 (schema + 0002 migration in sync)
    - File `drizzle/migrations/0002_*.sql` exists; `grep -c "CREATE TABLE.*snapshot_archive" drizzle/migrations/0002_*.sql` returns 1
    - `grep -cE "PRIMARY KEY.*date.*snapshot_key" drizzle/migrations/0002_*.sql` returns 1
    - File `src/app/api/archive/route.ts` `grep -c "runtime = \"nodejs\"" src/app/api/archive/route.ts` returns 1
    - `grep -c "verifyBearerToken" src/app/api/archive/route.ts` returns 1
    - `grep -c "RETENTION_DAYS = 30" src/app/api/archive/route.ts` returns 1
    - Test file contains 5 `it(` blocks for the 5 listed scenarios (`grep -c "it(" src/app/api/archive/route.test.ts` returns >= 5)
  </acceptance_criteria>
  <done>0002 migration adds snapshot_archive; /api/archive node route token-gates + idempotent + 30-day prune. 5 integration tests gated on DB.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-25 | Spoofing | /api/archive token forgery | mitigate | Same INGEST_TOKEN + verifyBearerToken as /api/ingest |
| T-02-26 | Denial of Service | Archive job runs concurrently with ingest | accept | Both write to different tables; archive prune is range delete; conflict negligible at 4 ticks/hr load |
| T-02-27 | Tampering | Cron payload tampering in transit | accept | HTTPS to \*.vercel.app; INGEST_TOKEN over TLS |
</threat_model>

<verification>
0002 migration valid; tsc clean; 5 archive integration tests + 2 cron-yaml structural tests pass acceptance via grep.
</verification>

<success_criteria>
Cron triggers every 15 min on main + workflow_dispatch; daily archive runs at 03:00 BRT and self-prunes. Failures of one workflow do not block the other.
</success_criteria>

<output>
After completion, create `.planning/phases/02-data-foundation/02-09-SUMMARY.md`
</output>
