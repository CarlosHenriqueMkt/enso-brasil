---
phase: 02-data-foundation
plan: 08
subsystem: ingest-orchestrator
tags: [api, ingest, auth, drizzle, neon-serverless, upstash, revalidate, zod]
requires:
  - 02-02 # alerts/sourcesHealth/snapshotCache schema + UNIQUE INDEX
  - 02-03 # Upstash cache wrapper
  - 02-04 # pino node logger + redact paths
  - 02-05 # SourceAdapter contract + stub adapter + AlertArraySchema
  - 02-06 # UF27, StateSnapshot, diffSnapshot
  - 02-07 # nothing direct, but co-located /api routing patterns
provides:
  - "POST /api/ingest (Node runtime) — cron-fed ingest orchestrator (REQ-S2.07)"
  - "verifyBearerToken — constant-time Bearer auth, reusable by /api/archive (plan 02-09)"
affects:
  - "Cache key snapshot:current is now written-through every ingest tick (REQ-S2.02)"
  - "snapshot_cache table receives one row keyed 'current' on every successful ingest"
  - "revalidatePath wiring active — /estado/{uf} + / invalidated when diff detects risk-level change"
tech-stack:
  added: []
  patterns:
    - "Promise.allSettled per-source isolation — one adapter throw never blocks others"
    - "Drizzle onConflictDoNothing().returning() for native dedup — count returned rows = adoptedCount"
    - "Drizzle onConflictDoUpdate with sql`col + 1` template for atomic counter bumps"
    - "Lazy await import('@/db/node') in tests so suite skips cleanly without DATABASE_URL_TEST"
    - "Constant-time token compare: timingSafeEqual on length-padded buffers + integer-equal length check"
key-files:
  created:
    - "src/lib/auth/token.ts"
    - "src/lib/auth/token.test.ts"
    - "src/app/api/ingest/route.ts"
    - "src/app/api/ingest/route.test.ts"
  modified: []
decisions:
  - "alertCount in placeholder snapshot reflects payloads observed *this tick* (not cumulative DB count). Avoids per-UF SELECT round-trip on every ingest. P5 risk formula will replace this with proper aggregation."
  - "Test-suite gating via `describe.skipIf` + lazy DB import — production code stays clean, no test-mode branches in route.ts."
  - "verifyBearerToken takes a Request (not raw header string) — matches Web Fetch API surface used by Next route handlers; same shape will plug into /api/archive in plan 02-09."
metrics:
  duration_minutes: 6
  completed: 2026-05-01
  tasks_completed: 2
  files_created: 4
  commits: 2
---

# Phase 02 Plan 08: API Ingest Orchestrator Summary

`/api/ingest` is now a Node-runtime, token-gated endpoint that runs the full REQ-S2.07 8-step flow on every cron tick: parallel adapter fetch → zod validation → dedup'd insert → placeholder snapshot → write-through cache (Upstash + Postgres) → ISR revalidation. Constant-time Bearer auth lives in a reusable `src/lib/auth/token.ts` so plan 02-09's `/api/archive` can drop it in directly.

## What landed

### 1. `src/lib/auth/token.ts` + 6-test coverage

`verifyBearerToken(req, expected)` — `node:crypto.timingSafeEqual` over length-padded buffers, plus integer-equal length check. Tests cover: match, wrong-same-length, missing header, no Bearer prefix, length-mismatch (must not throw), empty token. Mitigates **T-02-20** (timing attack).

### 2. `src/app/api/ingest/route.ts` — 8-step orchestrator

- **Auth gate** (T-02-19, T-02-23): 401 on missing/bad token; 500 on missing `INGEST_TOKEN` env (server misconfigured, not user-recoverable).
- **Step 1** — `Promise.allSettled(sources.map(s => s.fetch()))`. Per-adapter throw isolated (T-02-22).
- **Step 2** — `AlertArraySchema.safeParse(...)` per source. Failures bump `payload_hash_drift_count` and persist _nothing_ for that source (REQ-S2.09, T-02-21).
- **Steps 3+4** — Bulk `INSERT … ON CONFLICT (source_key, payload_hash) DO NOTHING RETURNING id`. Returned-row count = adoptedCount. Idempotent: 2nd consecutive call adopts 0.
- **Step 5** — Placeholder snapshot: 27 UFs all at `risk='unknown'`, `riskReason=messages.severity.gray` ("Dados indisponíveis"), `formulaVersion='v0-placeholder'`. `alertCount` = adapter payloads observed for that UF this tick. `lastSuccessfulFetch` = most-recent `fetched_at` for that UF or null.
- **Step 6** — Write-through: `setSnapshot(curr)` (Upstash, no TTL — REQ-S2.02) + `INSERT INTO snapshot_cache (snapshotKey='current')` with `onConflictDoUpdate`.
- **Step 7** — `diffSnapshot(prev, curr)` → `revalidatePath('/estado/' + uf)` per changed UF + `revalidatePath('/')` if `rootChanged`. Cold start fires 28 calls; steady-state placeholder fires 0.
- **Step 8** — JSON `{ ok: true, sources: [{key, status, alertCount}], adoptedCount, durationMs }`.

Health-table writes for both success (resets `consecutive_failures` to 0, clears `last_error`) and failure (atomic `+1` via Drizzle `sql\`${col} + 1\``) paths, idempotent across cold cache (using `onConflictDoUpdate`against`sourceKey` PK).

Structured logging via pino child logger with `runId` (uuid) on every event: `ingest.start`, `ingest.unauthorized`, `ingest.source.fetch_failed`, `schema_drift`, `ingest.done`. Token never enters logs (redact paths from plan 02-04 cover `INGEST_TOKEN`, `headers.authorization`, etc. — T-02-24).

### 3. `src/app/api/ingest/route.test.ts` — 9 integration tests

Suite gates via `describe.skipIf(!process.env.DATABASE_URL_TEST)`. Plan 02-10 will stand up the docker PG container; tests will then run automatically. Lazy `await import('@/db/node')` avoids the eager `DATABASE_URL is not set` throw at module-load.

Coverage: missing auth → 401, bad token → 401, valid token → 200 + 3 alerts adopted, dedup (2nd call adopts 0), `snapshot:current` in Upstash has length 27, snapshot_cache row written, revalidatePath called 28× on cold start, 0× on steady state, adapter throw bumps `consecutive_failures` + writes `last_error`.

## Verification

| Check                          | Result                                  |
| ------------------------------ | --------------------------------------- |
| `pnpm exec tsc --noEmit`       | clean                                   |
| `pnpm lint`                    | 0 errors (2 pre-existing repo warnings) |
| `pnpm test src/lib/auth`       | 6/6 pass                                |
| `pnpm test src/app/api/ingest` | 9 skipped (DATABASE_URL_TEST gate)      |
| Full suite (`pnpm test --run`) | 63 pass / 9 skipped — no regressions    |
| grep `runtime = "nodejs"`      | 1                                       |
| grep `verifyBearerToken`       | 2 (≥1)                                  |
| grep `Promise.allSettled`      | 2 (≥1)                                  |
| grep `onConflictDoNothing`     | 2 (≥1)                                  |
| grep `revalidatePath`          | 4 (≥2)                                  |
| grep `diffSnapshot`            | 3 (≥1)                                  |
| grep `from "@/db/node"`        | 1                                       |
| grep `v0-placeholder`          | 3 (≥1)                                  |
| grep `it(` in route.test.ts    | 9 (≥8)                                  |

## Deviations from Plan

**1. [Rule 3 - blocking] Lazy DB import in test file.**

- **Found during:** Task 2, first vitest run.
- **Issue:** Top-level `import { db } from "@/db/node"` triggers `getPool()` at module-eval time, which throws `DATABASE_URL is not set` and aborts test-file collection — even though `describe.skipIf` would otherwise skip every test.
- **Fix:** Moved `db` + `schema` imports into a `beforeEach` `await import('@/db/node')` guarded by `if (!dbMod)`. Aliases `process.env.DATABASE_URL = process.env.DATABASE_URL_TEST` before the import so the pool initializes against the test container when plan 02-10 lands.
- **Files modified:** `src/app/api/ingest/route.test.ts`
- **Commit:** `4e5fcf5`

**2. [Rule 1 - bug] TS strict-mode index narrowing.**

- **Found during:** Task 2 tsc run.
- **Issue:** `tsconfig` has `noUncheckedIndexedAccess`, so `sources[i]` and `settled[i]` were typed `T | undefined` in the index loop. Manual narrowing was rejected.
- **Fix:** Replaced index loop with `sources.map(...) → for (const [src, result] of pairs)` — `Array.map` callback narrows `src` to non-undefined; `settled[i]` cast to `PromiseSettledResult<Alert[]>` once at construction time. `result.status === "rejected"` then discriminates the union cleanly.
- **Files modified:** `src/app/api/ingest/route.ts`
- **Commit:** `4e5fcf5`

## Threat Mitigations Confirmed

| Threat ID | Mitigation                                                                                                                             |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| T-02-19   | `INGEST_TOKEN` env required; 401 on missing/bad; 500 on misconfigured (server-side problem, not client).                               |
| T-02-20   | `verifyBearerToken` uses `crypto.timingSafeEqual` on equal-length padded buffers + integer-equal length check; 6 unit tests cover.     |
| T-02-21   | `AlertArraySchema.safeParse` per source before any DB write; failure bumps `payload_hash_drift_count` and persists nothing.            |
| T-02-22   | `Promise.allSettled` ensures one adapter throw doesn't cascade; per-source health entry written for both success and failure branches. |
| T-02-23   | Strict `auth.startsWith("Bearer ")` prefix check; constant-time compare on payload; missing-header test passes.                        |
| T-02-24   | pino redact paths from plan 02-04 cover `INGEST_TOKEN`, `headers.authorization`, `*.token`, `*.secret`, `*.password`.                  |

## Notes for Plan 02-09 (`/api/archive`)

- `verifyBearerToken(req, process.env.INGEST_TOKEN!)` plugs in directly. Same auth contract.
- The snapshot_cache `current` row is the source of truth that 02-09's archive job will copy into snapshot_archive on a daily cadence.

## Notes for Plan 02-10 (Docker PG / CI)

- Set `DATABASE_URL_TEST=postgres://…` in CI env. The 9 ingest tests will activate automatically.
- No Pool warmup quirks observed on Windows (pool initializes lazily inside the route, not at startup).

## Self-Check: PASSED

Created files verified on disk:

- `src/lib/auth/token.ts` — exists
- `src/lib/auth/token.test.ts` — exists
- `src/app/api/ingest/route.ts` — exists
- `src/app/api/ingest/route.test.ts` — exists

Commits verified in `git log`:

- `12fca46` feat(02-08): constant-time Bearer-token verifier
- `4e5fcf5` feat(02-08): /api/ingest Node-runtime orchestrator (REQ-S2.07)
