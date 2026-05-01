---
phase: 02-data-foundation
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/db/schema.ts
  - src/db/edge.ts
  - src/db/node.ts
  - src/db/migrate.ts
  - drizzle/migrations/0001_initial_schema.sql
  - drizzle/migrations/meta/_journal.json
  - drizzle/migrations/meta/0001_snapshot.json
autonomous: true
requirements:
  - REQ-S2.01
  - REQ-S2.07
  - REQ-S2.08
  - REQ-S2.09
  - REQ-S2.10
  - DATA-01

must_haves:
  truths:
    - "src/db/schema.ts defines alerts, sources_health, snapshot_cache tables with indexes per SPEC REQ-S2.01"
    - "drizzle/migrations/0001_*.sql exists and is checked-in (D-01 generate workflow — NEVER push)"
    - "src/db/edge.ts exports drizzle-orm/neon-http instance; src/db/node.ts exports drizzle-orm/neon-serverless pooled instance"
    - "src/db/migrate.ts runs drizzle-orm/migrator against DATABASE_URL using neon-serverless"
    - "`pnpm db:generate` produces no diff after this plan (schema and migration in sync — drizzle-kit check exits 0)"
    - "alerts.id uses gen_random_uuid() (PG17 built-in, no pgcrypto extension needed) per RESEARCH Q4"
  artifacts:
    - path: "src/db/schema.ts"
      provides: "Drizzle pgTable defs for alerts (uuid pk + 13 cols + 3 indexes), sources_health (text pk + 5 cols), snapshot_cache (text pk + 4 cols)"
      contains: "pgTable"
    - path: "src/db/edge.ts"
      provides: "Edge runtime DB: `export const db = drizzle(neon(process.env.DATABASE_URL!))` from drizzle-orm/neon-http"
      contains: "neon-http"
    - path: "src/db/node.ts"
      provides: "Node runtime DB: module-level Pool from @neondatabase/serverless + drizzle-orm/neon-serverless; reused across warm invocations"
      contains: "neon-serverless"
    - path: "src/db/migrate.ts"
      provides: "Migration runner — invokes runMigrations from drizzle-orm/neon-serverless/migrator with migrationsFolder='./drizzle/migrations'"
      contains: "migrate"
    - path: "drizzle/migrations/0001_initial_schema.sql"
      provides: "Generated SQL: CREATE TABLE alerts/sources_health/snapshot_cache + 3 indexes; uses gen_random_uuid() default"
      contains: "CREATE TABLE"
  key_links:
    - from: "src/db/migrate.ts"
      to: "DATABASE_URL"
      via: "process.env"
      pattern: "process\\.env\\.DATABASE_URL"
    - from: "src/db/edge.ts"
      to: "drizzle-orm/neon-http"
      via: "import"
      pattern: 'from "drizzle-orm/neon-http"'
    - from: "src/db/node.ts"
      to: "drizzle-orm/neon-serverless"
      via: "import"
      pattern: 'from "drizzle-orm/neon-serverless"'
---

<objective>
Define the Postgres schema in Drizzle, generate the initial SQL migration via `drizzle-kit generate` (D-01), and wire the dual-runtime driver split (edge: neon-http; node: neon-serverless pool) per CONTEXT Implementation Notes line 134.

Purpose: All data writes (ingest, archive) and reads (states, health) flow through the modules created here. The driver split is mandatory: neon-http does NOT support transactions (RESEARCH Q1), so /api/ingest MUST use neon-serverless.
Output: schema + 0001 migration + edge.ts + node.ts + migrate.ts.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-data-foundation/02-SPEC.md
@.planning/phases/02-data-foundation/02-CONTEXT.md
@.planning/phases/02-data-foundation/02-RESEARCH.md
@.planning/phases/02-data-foundation/02-01-SUMMARY.md

<interfaces>
SPEC REQ-S2.01 — `alerts` columns:
  id uuid PK default gen_random_uuid()
  source_key text NOT NULL
  hazard_kind text NOT NULL
  state_uf char(2) NOT NULL
  severity text NOT NULL
  headline text NOT NULL
  body text
  source_url text
  fetched_at timestamptz NOT NULL
  valid_from timestamptz
  valid_until timestamptz
  payload_hash text NOT NULL
  raw jsonb NOT NULL
  Indexes: (state_uf, fetched_at DESC); (source_key, payload_hash) UNIQUE; (valid_until)

`sources_health` columns:
source_key text PK
last_attempt_at timestamptz
last_success_at timestamptz
last_error text
consecutive_failures int NOT NULL default 0
payload_hash_drift_count int NOT NULL default 0

`snapshot_cache` columns:
snapshot_key text PK
body jsonb NOT NULL
computed_at timestamptz NOT NULL
formula_version text NOT NULL

NOTE: snapshot_archive table is added in plan 02-09 (separate migration 0002).

RESEARCH Q4: gen_random_uuid() is built-in PG 13+ — Drizzle column: `uuid('id').primaryKey().defaultRandom()` emits this. NO pgcrypto extension migration needed.

Driver split (CONTEXT line 134, RESEARCH §Edge Caveats):
Edge (states/health): drizzle-orm/neon-http + neon() — per-request, no pool
Node (ingest/archive/migrate): drizzle-orm/neon-serverless + Pool — module-level, warm reuse
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Define Drizzle schema, dual-runtime driver wrappers, migration runner</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-SPEC.md (REQ-S2.01)
    - .planning/phases/02-data-foundation/02-CONTEXT.md (Implementation Notes — driver split, connection lifecycle)
    - .planning/phases/02-data-foundation/02-RESEARCH.md (Q1, Q4, §Edge-Runtime Caveats)
  </read_first>
  <behavior>
    - schema.ts compiles with `tsc --noEmit` and exports 3 typed tables.
    - edge.ts imports neon-http only; never imports `Pool` (would fail at edge build).
    - node.ts uses module-level Pool (single instance across warm invocations) — verified via `process.env.NODE_ENV !== 'test' || globalThis.__pool` pattern OR a simple module-scope singleton with hot-reload guard for dev.
    - migrate.ts is invoked via `tsx src/db/migrate.ts`; calls `migrate(db, { migrationsFolder: './drizzle/migrations' })` from drizzle-orm/neon-serverless/migrator; logs success then exits 0.
  </behavior>
  <files>src/db/schema.ts, src/db/edge.ts, src/db/node.ts, src/db/migrate.ts</files>
  <action>
    1. Create `src/db/schema.ts`:
       ```ts
       import { pgTable, uuid, text, char, timestamp, jsonb, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

       export const alerts = pgTable(
         "alerts",
         {
           id: uuid("id").primaryKey().defaultRandom(),
           sourceKey: text("source_key").notNull(),
           hazardKind: text("hazard_kind").notNull(),
           stateUf: char("state_uf", { length: 2 }).notNull(),
           severity: text("severity").notNull(),
           headline: text("headline").notNull(),
           body: text("body"),
           sourceUrl: text("source_url"),
           fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
           validFrom: timestamp("valid_from", { withTimezone: true }),
           validUntil: timestamp("valid_until", { withTimezone: true }),
           payloadHash: text("payload_hash").notNull(),
           raw: jsonb("raw").notNull(),
         },
         (t) => ({
           stateFetchedIdx: index("alerts_state_fetched_idx").on(t.stateUf, t.fetchedAt.desc()),
           sourceHashUq: uniqueIndex("alerts_source_payload_hash_uq").on(t.sourceKey, t.payloadHash),
           validUntilIdx: index("alerts_valid_until_idx").on(t.validUntil),
         }),
       );

       export const sourcesHealth = pgTable("sources_health", {
         sourceKey: text("source_key").primaryKey(),
         lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
         lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
         lastError: text("last_error"),
         consecutiveFailures: integer("consecutive_failures").notNull().default(0),
         payloadHashDriftCount: integer("payload_hash_drift_count").notNull().default(0),
       });

       export const snapshotCache = pgTable("snapshot_cache", {
         snapshotKey: text("snapshot_key").primaryKey(),
         body: jsonb("body").notNull(),
         computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
         formulaVersion: text("formula_version").notNull(),
       });

       export type Alert = typeof alerts.$inferSelect;
       export type NewAlert = typeof alerts.$inferInsert;
       export type SourceHealth = typeof sourcesHealth.$inferSelect;
       export type SnapshotCacheRow = typeof snapshotCache.$inferSelect;
       ```

    2. Create `src/db/edge.ts`:
       ```ts
       import { neon } from "@neondatabase/serverless";
       import { drizzle } from "drizzle-orm/neon-http";
       import * as schema from "./schema";

       const url = process.env.DATABASE_URL;
       if (!url) throw new Error("DATABASE_URL is not set (edge)");
       export const db = drizzle(neon(url), { schema });
       export type EdgeDB = typeof db;
       ```

    3. Create `src/db/node.ts` (module-level pool reuse, hot-reload safe):
       ```ts
       import { Pool } from "@neondatabase/serverless";
       import { drizzle } from "drizzle-orm/neon-serverless";
       import * as schema from "./schema";

       const globalForPool = globalThis as unknown as { __ensoPool?: Pool };

       function getPool(): Pool {
         const url = process.env.DATABASE_URL;
         if (!url) throw new Error("DATABASE_URL is not set (node)");
         if (!globalForPool.__ensoPool) {
           globalForPool.__ensoPool = new Pool({ connectionString: url });
         }
         return globalForPool.__ensoPool;
       }

       export const db = drizzle(getPool(), { schema });
       export type NodeDB = typeof db;
       ```

    4. Create `src/db/migrate.ts` runner:
       ```ts
       import { Pool } from "@neondatabase/serverless";
       import { drizzle } from "drizzle-orm/neon-serverless";
       import { migrate } from "drizzle-orm/neon-serverless/migrator";

       async function main() {
         const url = process.env.DATABASE_URL;
         if (!url) throw new Error("DATABASE_URL is not set");
         const pool = new Pool({ connectionString: url });
         const db = drizzle(pool);
         console.log(JSON.stringify({ event: "migrate.start", url: url.replace(/:\/\/[^@]+@/, "://***@") }));
         await migrate(db, { migrationsFolder: "./drizzle/migrations" });
         console.log(JSON.stringify({ event: "migrate.done" }));
         await pool.end();
       }

       main().catch((err) => {
         console.error(JSON.stringify({ event: "migrate.error", error: String(err) }));
         process.exit(1);
       });
       ```

    5. Generate the initial migration:
       ```
       pnpm db:generate
       ```
       This MUST produce `drizzle/migrations/0001_*.sql` plus `drizzle/migrations/meta/_journal.json` and `drizzle/migrations/meta/0001_snapshot.json`. Inspect the SQL — must contain CREATE TABLE for all 3 tables, gen_random_uuid() default on alerts.id, and 3 indexes. If column types are wrong, fix schema.ts and re-generate (delete prior 0001 first; this migration is not yet applied anywhere).

    6. Verify:
       ```
       pnpm db:check
       pnpm exec tsc --noEmit
       ```
       Both exit 0.

    7. Commit `feat(02-02): drizzle schema + dual-runtime drivers + 0001 migration`. Include the SQL migration file + meta/ directory.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm exec tsc --noEmit && pnpm db:check && test -f drizzle/migrations/meta/_journal.json && grep -c "CREATE TABLE.*alerts" drizzle/migrations/0001_*.sql && grep -c "neon-http" src/db/edge.ts && grep -c "neon-serverless" src/db/node.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm exec tsc --noEmit` exits 0
    - `pnpm db:check` exits 0 (schema matches generated migration)
    - File `src/db/schema.ts` defines 3 pgTable instances; `grep -c "pgTable" src/db/schema.ts` returns 3
    - File `src/db/schema.ts` `grep -c "defaultRandom" src/db/schema.ts` returns 1 (alerts.id uuid)
    - File `src/db/edge.ts` `grep -c "drizzle-orm/neon-http" src/db/edge.ts` returns 1
    - File `src/db/edge.ts` `grep -c "Pool" src/db/edge.ts` returns 0 (must NOT import Pool)
    - File `src/db/node.ts` `grep -c "drizzle-orm/neon-serverless" src/db/node.ts` returns 1
    - File `src/db/node.ts` `grep -c "Pool" src/db/node.ts` returns >= 1
    - File `src/db/migrate.ts` `grep -c "migrationsFolder" src/db/migrate.ts` returns 1
    - File `drizzle/migrations/0001_*.sql` contains `CREATE TABLE` for alerts, sources_health, snapshot_cache (3 separate `grep -c "CREATE TABLE.*<name>"` each returning >= 1)
    - File `drizzle/migrations/0001_*.sql` `grep -c "gen_random_uuid" drizzle/migrations/0001_*.sql` returns 1
    - `grep -cE "CREATE.*INDEX" drizzle/migrations/0001_*.sql` returns >= 3 (3 indexes on alerts)
  </acceptance_criteria>
  <done>Schema + dual-runtime drivers + initial migration committed. drizzle-kit check exits 0 (no drift). Migration runs against any PG via `pnpm db:migrate`.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary            | Description                                       |
| ------------------- | ------------------------------------------------- |
| App code → Postgres | All writes parameterized via Drizzle (no raw SQL) |

## STRIDE Threat Register

| Threat ID | Category               | Component                                  | Disposition | Mitigation Plan                                                                 |
| --------- | ---------------------- | ------------------------------------------ | ----------- | ------------------------------------------------------------------------------- |
| T-02-04   | Tampering              | SQL injection via raw query                | mitigate    | Drizzle parameterized queries only; no `sql.raw()` in P2                        |
| T-02-05   | Information Disclosure | DATABASE_URL leaked in migrate logs        | mitigate    | migrate.ts redacts user:pass via regex before logging                           |
| T-02-06   | Denial of Service      | Connection pool exhaustion in Node runtime | accept      | Single module-level pool reused; tuning deferred to P6 (CONTEXT Deferred Ideas) |

</threat_model>

<verification>
`pnpm db:check` exits 0; `tsc --noEmit` exits 0; 0001 migration contains all 3 CREATE TABLE statements + 3 indexes; gen_random_uuid present; edge.ts imports zero Pool; node.ts imports neon-serverless.
</verification>

<success_criteria>
Schema matches SPEC REQ-S2.01 verbatim. Driver split enforced at file level (edge.ts/node.ts). Migration is reproducible via `pnpm db:generate` and applies via `pnpm db:migrate`.
</success_criteria>

<output>
After completion, create `.planning/phases/02-data-foundation/02-02-SUMMARY.md`
</output>
