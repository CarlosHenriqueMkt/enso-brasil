# Phase 2: Data Foundation — Specification

**Created:** 2026-05-01
**Ambiguity score:** 0.13 (gate: ≤ 0.20)
**Requirements:** 13 locked

## Goal

Wire the full data plumbing — Neon Postgres schema, Drizzle ORM, Upstash Redis cache, ofetch HTTP wrapper, `SourceAdapter` registry, GH Actions cron, `/api/ingest` + `/api/states` + `/api/health` endpoints, daily archive — end-to-end with a deterministic stub adapter, deployed to a Vercel preview environment. After P2 ships, every cron tick fetches stub alerts → normalizes → persists → caches → serves via API; no real CEMADEN/INMET adapters yet (P4) and no risk computation yet (P3 fills `formula_version: "v0"`; P2 stamps `unknown` placeholder).

## Background

Phase 1 shipped the public Next 16 + Tailwind v4 + pnpm scaffold with SSR disclaimer, `/privacidade`, full CI (typecheck + lint + knip + vitest + playwright + gitleaks), MIT OSS files, and a branch-protection ruleset. Today the codebase has zero data layer:

- No `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `@upstash/redis`, `ofetch`, or `zod` installed
- No `src/db/`, `src/lib/cache/`, `src/lib/sources/`, `src/lib/api/` directories
- No `src/app/api/` routes
- No `.github/workflows/cron.yml`
- No Neon project, no Upstash database, no Vercel project linked
- `messages.ts` references `messages.severity` keys (green/yellow/orange/red/gray) and `messages.edgeStates` — these will inform the snapshot shape but P2 does not consume them yet (UI is P5)

Phase 2 must produce: a deployed Vercel preview where a GH Actions cron tick every 15 min triggers a full ingest cycle and `/api/states` returns the most recent snapshot. Stub adapter is the only data source — it is a default 3-state fixture with an `STUB_FIXTURE_PATH` env override for fixture swapping.

## Requirements

1. **REQ-S2.01 — Neon Postgres schema via Drizzle** (covers DATA-01)
   - Current: No DB, no schema, no migrations.
   - Target: `src/db/schema.ts` defines tables `alerts`, `sources_health`, `snapshot_cache` using Drizzle's `pgTable`. Migrations live in `drizzle/migrations/`. `pnpm db:migrate` (script) applies them to the configured `DATABASE_URL`. Schema includes:
     - `alerts(id uuid pk, source_key text, hazard_kind text, state_uf char(2), severity text, headline text, body text, source_url text, fetched_at timestamptz, valid_from timestamptz, valid_until timestamptz, payload_hash text, raw jsonb)` with indexes `(state_uf, fetched_at desc)`, `(source_key, payload_hash)` (dedup), and `(valid_until)` (expiry sweeps).
     - `sources_health(source_key text pk, last_attempt_at timestamptz, last_success_at timestamptz, last_error text, consecutive_failures int, payload_hash_drift_count int)`.
     - `snapshot_cache(snapshot_key text pk, body jsonb, computed_at timestamptz, formula_version text)` — write-through for archive (DATA-09); Upstash is hot path.
   - Acceptance: `pnpm db:migrate` against a fresh Neon dev branch creates all 3 tables; `pg_dump --schema-only` emits exactly the indexes listed; `drizzle-kit check` exits 0.

2. **REQ-S2.02 — Upstash Redis snapshot cache (no-TTL, overwrite-only)** (covers DATA-02)
   - Current: No cache layer.
   - Target: `src/lib/cache/upstash.ts` exposes `getSnapshot()`, `setSnapshot(snapshot)`. Single key `snapshot:current`. **No TTL** — entries persist until next ingest overwrites them. Public-safety stance: stale-data-with-flag > empty.
   - Acceptance: After an ingest, `redis-cli GET snapshot:current` returns valid zod-parseable `StateSnapshot[]` JSON; key has `TTL = -1` (no expiry); subsequent ingest overwrites the same key (atomic SET).

3. **REQ-S2.03 — ofetch HTTP wrapper with retry + timeout** (covers DATA-03)
   - Current: No HTTP client.
   - Target: `src/lib/http/fetcher.ts` exports `httpGet(url, opts)` built on `ofetch`. Defaults: 8s timeout, 2 retries on 5xx/timeout/ECONNRESET, exponential backoff (250ms → 500ms), no retry on 4xx. Adapters MUST use this wrapper — direct `fetch()` is forbidden in `src/lib/sources/**`.
   - Acceptance: Vitest test mocks 5xx → 5xx → 200 sequence and confirms 2 retries fire then success; mocks 404 and confirms zero retries; mocks 9s delay and confirms timeout fires before completion.

4. **REQ-S2.04 — SourceAdapter interface + registry pattern** (covers DATA-04)
   - Current: No source abstraction.
   - Target: `src/lib/sources/types.ts` defines `interface SourceAdapter { key: string; displayName: string; fetch(): Promise<Alert[]>; }`. `src/lib/sources/registry.ts` exports `sources: SourceAdapter[]` — a flat array. Adding a new source = append to the array. Orchestrator iterates `sources` with `Promise.allSettled`, never references concrete sources by name.
   - Acceptance: `grep -r "import.*Stub\|import.*Cemaden\|import.*Inmet" src/lib/orchestrator src/lib/api` returns zero matches outside the registry file; new source can be plugged in via single registry append; existing tests still pass.

5. **REQ-S2.05 — Stub adapter with env-configurable fixture** (P2-locked behavior)
   - Current: No adapter implementations.
   - Target: `src/lib/sources/stub.ts` implements `SourceAdapter` with `key: "stub"`. **Default behavior:** loads `tests/fixtures/sources/stub-default.json` (3 states: SP/RJ/AM, 1 alert each, hazard kinds queimada/enchente/estiagem). **Override:** if `process.env.STUB_FIXTURE_PATH` is set, load from that path instead (resolved relative to repo root). Fixture is validated against `Alert[]` zod schema before return.
   - Acceptance: Default produces `Alert[]` of length 3 with state_uf values `["SP","RJ","AM"]`; setting `STUB_FIXTURE_PATH=tests/fixtures/sources/all-red.json` returns the alternate fixture; invalid fixture throws zod error before any persistence.

6. **REQ-S2.06 — GH Actions cron every 15 min with auto-retry** (covers DATA-05)
   - Current: No cron workflow.
   - Target: `.github/workflows/cron.yml` runs on `schedule: '*/15 * * * *'` and `workflow_dispatch` (manual re-trigger). Single step: `curl -fsSL --retry 3 --retry-delay 5 --retry-all-errors -X POST -H "Authorization: Bearer $INGEST_TOKEN" "$VERCEL_URL/api/ingest"`. Job timeout 5 min. `INGEST_TOKEN` and `VERCEL_URL` from `secrets`.
   - Acceptance: Workflow YAML parses; manual `gh workflow run cron.yml` triggers it; 3 retries are configured in the curl invocation; no caching of dependencies (no setup-node — pure curl).

7. **REQ-S2.07 — `/api/ingest` orchestrator endpoint** (covers DATA-06)
   - Current: No API routes.
   - Target: `src/app/api/ingest/route.ts` (Node runtime, **not** edge — needs Drizzle + zod). Accepts only `POST` with `Authorization: Bearer ${INGEST_TOKEN}` (constant-time compare). Flow:
     1. `Promise.allSettled(sources.map(s => s.fetch()))`
     2. Validate each result against `Alert[]` zod schema; record failures in `sources_health`
     3. Dedup new alerts against existing `(source_key, payload_hash)` rows
     4. Insert net-new rows into `alerts`
     5. Compute snapshot: per-state group; risk = `'unknown'` (placeholder until P3); `formula_version: "v0-placeholder"`
     6. `await setSnapshot(snapshot)` (Upstash) AND `INSERT INTO snapshot_cache (write-through archive)`
     7. For each state whose snapshot risk level differs from previous, call `revalidatePath('/estado/' + uf)` and `revalidatePath('/')`
     8. Return JSON `{ ok: true, sources: [{ key, status, alertCount }], adoptedCount, durationMs }`
   - Acceptance: POST without auth → 401; POST with bad token → 401; POST with valid token → 200 with full report shape; `alerts` row count increases on first call, stays equal on second (dedup); Upstash `snapshot:current` is updated; logs structured JSON with `runId`, `durationMs`.

8. **REQ-S2.08 — Sources health tracking + 30-min staleness flag** (covers DATA-07)
   - Current: No health table or surfacing.
   - Target: `sources_health` updated atomically inside ingest: success path bumps `last_success_at` and resets `consecutive_failures`; failure path bumps `consecutive_failures`, sets `last_error`. `getHealth()` query exposes per-source booleans `isStale = (now - last_success_at) > 30min`.
   - Acceptance: Forcing stub adapter to throw produces a row in `sources_health` with `consecutive_failures >= 1` and a `last_error` containing the thrown message; after 30 min of forced failures, `isStale === true`.

9. **REQ-S2.09 — zod validation on every adapter response + payload-hash drift detection** (covers DATA-08)
   - Current: No zod, no schema validation, no anomaly logging.
   - Target: Every `SourceAdapter.fetch()` result MUST be validated by the orchestrator against `Alert[]` zod schema (defined in `src/lib/sources/schema.ts`). Each `Alert` carries a deterministic `payload_hash = sha256(canonical JSON of normalized fields)`. When a hash for `(source_key, payload_hash)` already exists, dedup. When zod validation fails, increment `sources_health.payload_hash_drift_count`, log structured `{ event: "schema_drift", source_key, errors }`, persist nothing for that source on that tick.
   - Acceptance: Vitest unit asserts that an `Alert[]` missing required fields throws zod error and increments drift counter without writing to `alerts`; same hash twice produces only one row.

10. **REQ-S2.10 — `/api/states` and `/api/health` zod-locked response shapes** (P2-locked contract)
    - Current: No API routes.
    - Target: `src/lib/api/schemas.ts` defines:
      - `StateSnapshotSchema` = `{ uf: z.enum(UF27), risk: z.enum(['green','yellow','orange','red','unknown']), riskReason: z.string(), alertCount: z.number().int().nonnegative(), lastSuccessfulFetch: z.string().datetime() | z.null(), formulaVersion: z.string() }`
      - `HealthReportSchema` = `{ generatedAt: z.string().datetime(), sources: z.array(SourceHealthSchema) }` where `SourceHealthSchema` = `{ key, displayName, lastSuccessAt: nullable, consecutiveFailures, isStale, payloadDriftCount }`
      - `StateSnapshotsResponseSchema` = `z.array(StateSnapshotSchema).length(27)` (always all 27 UFs; missing data → unknown).
    - `src/app/api/states/route.ts` (edge runtime): reads from Upstash, parses with schema, returns 200 JSON; on cache miss returns 503 with `{ error: "snapshot_unavailable" }` (DB fallback intentionally deferred to P6).
    - `src/app/api/health/route.ts` (edge runtime): returns parsed `HealthReportSchema`.
    - Acceptance: `pnpm test` includes contract tests asserting both routes return objects matching their schemas across stub data; `tsc --noEmit` proves TS types are inferred from zod schemas (single source of truth).

11. **REQ-S2.11 — Daily archive snapshot job** (covers DATA-09)
    - Current: No archive process.
    - Target: Each ingest already writes to `snapshot_cache` (DB write-through). Daily archive at 03:00 America/Sao_Paulo via separate GH Actions schedule `0 6 * * *` (UTC) calls `/api/archive` (token-protected, same `INGEST_TOKEN`) which copies the latest `snapshot_cache` row to a `snapshot_archive` table keyed by `(date, snapshot_key)`. Retains last 30 days; rows older than 30 days are deleted by the same job.
    - Acceptance: Migration adds `snapshot_archive` table; manual `gh workflow run archive.yml` produces a row in `snapshot_archive` with today's date; rows older than 30 days are pruned within the same run.

12. **REQ-S2.12 — Vercel preview deployment with linked Neon + Upstash** (P2-locked deploy boundary)
    - Current: No Vercel project, no cloud provisioning.
    - Target: Repo connected to a Vercel project named `enso-brasil`. Preview deployments fire on every PR. Environment variables wired: `DATABASE_URL` (Neon dev branch), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `INGEST_TOKEN`. Production deployment from `main` writes to the same Neon dev branch in P2 (production Neon branch is provisioned in P7). README's "Como rodar local" section gets a "Como deployar" appendix listing the 4 env vars and where they come from.
    - Acceptance: A PR push produces a Vercel preview URL where `/api/states` returns 503 immediately after deploy (cold start, no snapshot yet) and 200 after `gh workflow run cron.yml --ref <branch>` triggers a manual ingest. README section "Como deployar" lists all 4 env vars with their provisioning origins.

13. **REQ-S2.13 — Pre-commit secret scan still blocks credentials** (covers DATA acceptance criterion 4 from ROADMAP)
    - Current: gitleaks pre-commit hook + CI tier-2 ruleset already installed in P1.
    - Target: No regression. P2 introduces real env var names (DATABASE*URL, UPSTASH*\*, INGEST_TOKEN) — `.gitleaks.toml` is reviewed to ensure these names alone do not trigger but real values do. `.env.example` documents all 4 names with placeholder shapes; `.env.local` is gitignored.
    - Acceptance: Staging a fake Neon connection string `postgres://user:realpw@ep-foo.neon.tech/db` triggers gitleaks block; staging the literal `DATABASE_URL=postgres://example:password@localhost:5432/db` in `.env.example` does NOT (allowlist for `.example` files already exists from P1).

## Boundaries

**In scope:**

- Drizzle schema + migrations for `alerts`, `sources_health`, `snapshot_cache`, `snapshot_archive`
- Upstash Redis client wired with no-TTL overwrite-only snapshot key
- ofetch wrapper with retry/timeout/status-aware retry
- `SourceAdapter` interface + flat-array registry
- Single stub adapter (3 states default, fixture-swappable via env)
- `/api/ingest` (Node runtime), `/api/states` + `/api/health` (edge runtime), `/api/archive`
- GH Actions workflows: `cron.yml` (every 15 min) + `archive.yml` (daily 03:00 BRT)
- zod schemas as single source of truth for `Alert`, `StateSnapshot`, `HealthReport`
- Per-state cache invalidation (`revalidatePath`) when risk level changes (placeholder `unknown` only — real diffing once P3 lands)
- Vercel preview deployment + Neon dev branch + Upstash dev DB provisioning
- README "Como deployar" section
- Daily archive job with 30-day retention
- DB connection string + cache token + ingest token wired through GH secrets and Vercel env

**Out of scope:**

- **Real CEMADEN or INMET adapters** — Phase 4. Stub is the only source in P2.
- **Risk formula implementation** — Phase 3. P2 stamps `risk: 'unknown'` and `formulaVersion: 'v0-placeholder'`.
- **UI consumption** — Phase 5. P2 ships APIs but no client renders them yet.
- **DB-fallback when cache misses** — Phase 6. P2 returns 503; P6 wires DB read-through.
- **Production Neon branch** — Phase 7. P2 uses the same dev branch for both preview and production.
- **Custom domain** — Phase 7. P2 lives on `*.vercel.app`.
- **Plausible analytics** — Phase 7.
- **Sentry / GlitchTip error reporting** — Phase 6.
- **Connection pooling tuning, slow query log analysis** — deferred to P6 hardening.
- **Webhook-based `revalidatePath` from external systems** — orchestrator-only invalidation in P2.
- **Soak test (7-day continuous ingest under load)** — Phase 6.

## Constraints

- **Free tier discipline (Pitfall 3 in research):** Upstash 500k cmds/mo, Neon 0.5GB + 100 compute hrs, Vercel function invocations limit, GH Actions on public OSS. P2 must measure and log baseline usage per cron tick to surface drift before it becomes a P6 incident.
- **No-TTL cache rule (REQ-S2.02):** intentional public-safety choice — public-safety project prefers stale data with explicit flag over empty UI. Anyone reverting must update SPEC.md.
- **Adapter abstraction (REQ-S2.04):** orchestrator MUST iterate `sources[]` generically. Verifiable via grep — concrete adapter imports outside registry fail review.
- **Edge runtime split:** `/api/states` + `/api/health` = edge. `/api/ingest` + `/api/archive` = Node (Drizzle + zod heavy paths). Documented inline.
- **`DATA-09` archive job runs separately from ingest** — failure of archive must NOT block ingest. They share `INGEST_TOKEN` for simplicity.
- **Zod schemas exported as types** via `z.infer<typeof Schema>` — single source of truth; no dual TS interface declarations.
- **Cron schedule UTC translation:** GitHub schedules in UTC. America/Sao_Paulo offset is -03:00. `cron.yml` runs `*/15 * * * *` (every 15 min always); `archive.yml` runs `0 6 * * *` UTC = 03:00 BRT. Document in workflow comment.

## Acceptance Criteria

- [ ] `pnpm db:migrate` applied to fresh Neon dev branch creates `alerts`, `sources_health`, `snapshot_cache`, `snapshot_archive` tables with all listed indexes
- [ ] `pnpm test` passes including new contract tests (zod schemas, ofetch retry, dedup, sources_health bookkeeping, /api/states + /api/health shape)
- [ ] Direct `fetch()` call inside `src/lib/sources/**` returns ZERO matches
- [ ] Concrete adapter imports outside `src/lib/sources/registry.ts` return ZERO matches
- [ ] GH Actions `cron.yml` runs every 15 min on `main` and `workflow_dispatch`; manual run logs successful POST to `/api/ingest`
- [ ] POST `/api/ingest` without `Authorization` header → 401; with valid token → 200; second consecutive call adds zero new `alerts` rows (dedup)
- [ ] After successful ingest, Upstash key `snapshot:current` returns valid `StateSnapshotsResponseSchema`-conforming JSON with length 27
- [ ] After successful ingest, `snapshot_cache` table has a new row matching the Upstash payload
- [ ] Forcing stub adapter to throw bumps `sources_health.consecutive_failures` and writes `last_error`
- [ ] `archive.yml` produces a `snapshot_archive` row dated today; rows older than 30 days deleted in same run
- [ ] Vercel preview deployment of any PR responds 200 on `/api/states` after one cron tick
- [ ] README contains a "Como deployar" section listing the 4 required env vars
- [ ] Pre-commit hook still blocks a fake `postgres://...neon.tech/db` connection string staged outside `.example` files
- [ ] `tsc --noEmit` exits 0; `pnpm lint` exits 0; `pnpm exec knip` exits 0

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes                                                |
| ------------------- | ----- | ----- | ------ | ---------------------------------------------------- |
| Goal Clarity        | 0.90  | 0.75  | ✓      | Stub-only, all 9 DATA reqs mapped + 4 P2-locked      |
| Boundary Clarity    | 0.85  | 0.70  | ✓      | Vercel preview deploy IN; production Neon branch OUT |
| Constraint Clarity  | 0.85  | 0.65  | ✓      | No-TTL cache + cron retry + edge/node split locked   |
| Acceptance Criteria | 0.88  | 0.70  | ✓      | 14 pass/fail criteria, all falsifiable by grep/test  |
| **Ambiguity**       | 0.13  | ≤0.20 | ✓      | Gate passed; ready for /gsd-discuss-phase 2          |

## Interview Log

| Round | Perspective | Question summary                                | Decision locked                                                         |
| ----- | ----------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| 1     | Researcher  | Where does P2 actually run end-to-end?          | Provision Neon + Upstash dev tier; deploy to Vercel preview             |
| 1     | Researcher  | What happens when GH Actions cron tick fails?   | Auto-retry inside workflow (3 attempts with backoff)                    |
| 1     | Boundary    | Where does `/api/ingest` token live?            | GH Actions secret + Vercel env var, manually rotated                    |
| 2     | Simplifier  | What exactly does the stub adapter return?      | 3 states fixed default + `STUB_FIXTURE_PATH` env override               |
| 2     | Boundary    | Upstash snapshot cache TTL + invalidation rule? | No TTL; ingest overwrites only (public-safety: stale-with-flag > empty) |
| 2     | Boundary    | `/api/states` + `/api/health` shape — when?     | Lock both shapes now via zod schemas in `src/lib/api/schemas.ts`        |

---

_Phase: 02-data-foundation_
_Spec created: 2026-05-01_
_Next step: /gsd-discuss-phase 2 — implementation decisions (Drizzle schema layout, ofetch retry semantics, stub fixture format, Vercel project setup, etc.)_
