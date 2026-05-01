# Phase 2: Data Foundation — Context

**Created:** 2026-05-01
**SPEC.md:** `.planning/phases/02-data-foundation/02-SPEC.md` (13 requirements locked)
**Decisions captured:** 4 implementation choices (migration workflow, test DB, logging, revalidate wiring)

## Domain

Wire data plumbing end-to-end with stub adapter, deployed to Vercel preview. APIs ship + observable + tested; no real adapters (P4) and no risk computation (P3). After P2, every cron tick runs full ingest → cache → serve flow against fixture data.

## Spec Lock

Requirements, boundaries, constraints, and acceptance criteria are LOCKED by `02-SPEC.md`. Downstream agents (researcher, planner, executor) MUST read SPEC.md as the contract for WHAT to build. This CONTEXT.md only captures HOW decisions.

## Canonical Refs

Every downstream agent MUST read these:

- `.planning/phases/02-data-foundation/02-SPEC.md` — **Locked requirements (read first)**
- `.planning/PROJECT.md` — Locked decisions (stack, anti-features, mission)
- `.planning/REQUIREMENTS.md` — DATA-01..09 source-of-truth
- `.planning/ROADMAP.md` — Phase 2 goal + 4 success criteria
- `.planning/research/SUMMARY.md` — Stack reversals (Vercel Cron→GH Actions, Vercel KV→Upstash, Vercel Postgres→Neon, Prisma→Drizzle), Pitfall 3 (free-tier exhaustion at peak)
- `.planning/research/STACK.md` — verified dep versions + Drizzle/Neon/Upstash specifics
- `.planning/research/PITFALLS.md` — endpoint instability + cache exhaustion + stale snapshot patterns
- `.planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md` — D-13 Next.js 16.x reversal context
- `risk-formula-v0.md` — placeholder semantics (P3 fills real formula; P2 stamps `unknown`)
- `CLAUDE.md` — project guide (locked decisions, anti-features)

## Code Context

Reusable assets from P1 (already in `main`):

- `src/lib/messages.ts` — PT-BR SoT. `messages.severity.{green,yellow,orange,red,gray}` informs the snapshot's `risk` enum. `messages.edgeStates.{verde,staleTemplate}` informs the future `riskReason` UI strings — P2 stamps `riskReason: messages.severity.gray` ("Dados indisponíveis") under placeholder unknown.
- `src/components/SourceLink.tsx` — server component for source URLs. Not consumed by P2 APIs but informs adapter normalization (each `Alert` carries `source_url`).
- `src/app/layout.tsx` — root layout pattern (no `'use client'`, SSR strict). API routes follow the same SSR-first principle.
- `.husky/pre-commit` + `.gitleaks.toml` — D-04 tier 1 secret scan. P2 must NOT regress (REQ-S2.13).
- `.github/workflows/ci.yml` — existing CI lane (typecheck + lint + knip + vitest + playwright + gitleaks). P2 extends with docker-compose service for PG and a new `cron.yml` workflow.

Integration points new to P2:

- `src/db/` (new) — Drizzle schema + migration runner
- `src/lib/cache/` (new) — Upstash client
- `src/lib/http/` (new) — ofetch wrapper
- `src/lib/sources/` (new) — adapter interface + registry + stub
- `src/lib/api/` (new) — zod schemas (`StateSnapshotSchema`, `HealthReportSchema`)
- `src/lib/log.ts` (new) — pino logger
- `src/app/api/{ingest,states,health,archive}/route.ts` (new)
- `.github/workflows/{cron,archive}.yml` (new)
- `drizzle/migrations/*.sql` (new — committed)
- `docker-compose.test.yml` (new)
- `tests/fixtures/sources/stub-default.json` + alternate fixtures (new)

## Decisions

### D-01 Drizzle migration workflow

**Choice:** `drizzle-kit generate` — SQL files committed to `drizzle/migrations/`.

- Schema lives in `src/db/schema.ts`. After every change, `pnpm drizzle-kit generate` produces a numbered SQL file (e.g., `drizzle/migrations/0001_initial_schema.sql`).
- Migrations are immutable in git history. Editing an applied migration is forbidden — new changes always become a new migration file.
- `pnpm db:migrate` script runs the migrator (drizzle-orm/migrator runMigrations) against `DATABASE_URL`.
- Contributors clone the repo, point `DATABASE_URL` at any PG (docker or Neon), run `pnpm db:migrate`, get exact schema state.
- `drizzle.config.ts` at repo root configures the generator (schema path, out path, dialect).
- **Why:** OSS-friendly (deterministic across envs, audit trail), public-safety (rollback story exists), avoids the "schema drift" failure mode common to push-based workflows.

### D-02 Test DB strategy

**Choice:** docker-compose Postgres in CI + locally.

- `docker-compose.test.yml` at repo root spins up `postgres:17-alpine` on port 5433, ephemeral volume, no persistence.
- CI uses GH Actions `services:` block with `postgres:17-alpine` image (avoids docker-compose runtime dep in workflow).
- Local dev: `docker compose -f docker-compose.test.yml up -d` then `pnpm test`. Document in CONTRIBUTING.md "Como rodar testes" section.
- Test setup hook runs migrations against the test DB before suite starts; truncates tables between tests for isolation.
- `DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5433/test` is the test-only connection string.
- **Why:** OSS-collaboration-first (zero cloud secrets needed for fork PRs), full PG feature parity (no pglite gaps), reliable CI without burning Neon free quota.
- **Trade-off accepted:** ~10s CI startup overhead for the service container. Acceptable inside the 6-min CI budget.

### D-03 Logging strategy (amended post-research)

**Choice:** Dual-runtime split — `pino` for Node, `console.log(JSON.stringify(...))` helper for edge.

**Background:** RESEARCH.md flagged two pino-specific issues with Next 16:

1. Pino uses Node `worker_threads` + `pino/file` → **edge runtime incompatible** (no fs/threads in V8 isolate)
2. Pino + Next 16 + Turbopack has known bundling bugs (vercel/next.js#86099, #84766) requiring `next.config.ts` opt-out

**Implementation:**

- `src/lib/log/node.ts` — pino instance for Node runtime routes (`/api/ingest`, `/api/archive`) and migration runner. Structured JSON to stdout, level `info` prod / `debug` local via `LOG_LEVEL`, redaction config auto-strips `INGEST_TOKEN`, `DATABASE_URL`, `UPSTASH_REDIS_REST_TOKEN`, and paths `*.token`, `*.secret`, `*.password`. Dev pipe through `pino-pretty`.
- `src/lib/log/edge.ts` — minimal JSON helper for edge routes (`/api/states`, `/api/health`): `function log(level, event, fields) { console.log(JSON.stringify({ ts: Date.now(), level, event, ...redact(fields) })); }`. ~30 LOC. Hand-rolled redaction for the same field-path list as pino. No deps.
- Both modules expose the same surface: `logger.info(event, fields)`, `logger.error(event, err, fields)`, etc. Routes import the right module for their runtime — there is no shared `src/lib/log/index.ts` (avoids accidental edge import of pino).
- `next.config.ts` adds `serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream', 'real-require']` — required to stop Turbopack from bundling pino's worker code.
- Every API route emits at minimum `{ event, runId, durationMs }`. Errors carry `{ event, error: serializedErr }`.
- **Why:** structured-logging is mandatory for public-safety incident triage; pino in Node where it works (richer features, redaction, perf); cheap-mode in edge where pino can't run (correctness > consistency); serverExternalPackages opt-out is the documented Next 16 fix for the Turbopack bundling bug.
- **Anti-pattern explicitly rejected:** plain `console.log(string)` (loses machine-grep at the worst possible moment); importing pino in edge routes (will silently fail at deploy).

### D-04 `revalidatePath` wiring under placeholder `unknown`

**Choice:** Wire diffing + revalidatePath calls now; behaves as a no-op until P3 lands real risk levels.

- `src/lib/snapshot/diff.ts` exports `diffSnapshot(prev: StateSnapshot[] | null, curr: StateSnapshot[]): { changedUFs: string[]; rootChanged: boolean }`.
- Returns `changedUFs = []` when previous snapshot is null OR every state matches previous risk level. Returns `rootChanged = true` if any UF changed (so `revalidatePath('/')` fires once).
- Ingest endpoint (REQ-S2.07 step 7) calls: `for (const uf of changedUFs) revalidatePath('/estado/' + uf); if (rootChanged) revalidatePath('/');`.
- With P2's placeholder `risk: 'unknown'` for all 27 UFs, every ingest's `prev` and `curr` match → `changedUFs = []` → zero revalidate calls. CORRECT behavior; not dead code.
- Test asserts: (a) first ingest with no prev → diff returns all 27 UFs (cold cache); (b) second ingest with same data → empty array; (c) revalidatePath spy receives expected calls in both cases.
- **Why:** Zero rework when P3 lands (just swap `risk: 'unknown'` for real formula output); SPEC REQ-S2.07 explicitly mandates the call so deferring would violate SPEC; the diffing logic itself has real bugs to test now (nulls, length mismatches, ordering).

## Implementation Notes

These are guard-rails for the planner, not full design:

- **Drizzle Neon driver split:** Edge runtime (`/api/states`, `/api/health`) MUST use `drizzle-orm/neon-http` + `@neondatabase/serverless` (HTTP, edge-safe). Node runtime (`/api/ingest`, `/api/archive`, migration runner) uses `drizzle-orm/neon-serverless` + WebSocket pool (better for batch writes). Two thin wrapper modules in `src/db/{edge,node}.ts` to avoid leaking driver choice into business code.
- **Constant-time token compare:** `/api/ingest` and `/api/archive` MUST compare `Authorization: Bearer ...` against `INGEST_TOKEN` via `crypto.timingSafeEqual` (after Buffer normalization), not `===`. Mitigates timing attack. Document inline.
- **Connection lifecycle:** Edge driver is per-request (no pool — HTTP). Node driver SHOULD reuse a module-level pool for the lifetime of the function instance (warm reuse on subsequent invocations within the same Vercel container).
- **Migrations in CI:** `pnpm db:migrate` runs as a CI step before vitest starts (against the docker-compose PG). New CI job sequence: `install → db:migrate (test PG) → tsc → lint → knip → vitest → playwright install → playwright test → gitleaks`.
- **Stub fixture canonical schema:** `tests/fixtures/sources/*.json` files are validated against `Alert[]` zod schema at load time. Document the shape in `tests/fixtures/sources/README.md` so contributors can author additional fixtures (e.g., `all-red-states.json`, `all-stale.json` for edge-case manual testing).
- **`revalidatePath` import:** From `next/cache`. Must run inside a Server Action / Route Handler (Node runtime). Confirms the Node runtime split for `/api/ingest`.

## Project-Level Carryover

- D-04 from P1 (gitleaks tier 1+2) — REQ-S2.13 reaffirms; planner must NOT touch `.gitleaks.toml` extend rule (already correct).
- D-13 from P1 CONTEXT — Next.js 16.x line locked (no next-intl, no `[locale]` route segment). P2 inherits.
- PT-BR only — `messages.ts` is the only string SoT. P2 API responses include `riskReason` strings sourced from `messages.severity.gray` ("Dados indisponíveis") under placeholder unknown.
- Public-safety conservative bias — already encoded in REQ-S2.02 (no-TTL stale-with-flag).

## Deferred Ideas (out of P2 — not lost)

These came up while designing P2 but belong elsewhere; capturing for future-phase backlog:

- **DB read-through fallback when Upstash cache misses** — P6 hardening (REQ-S2.10 returns 503 on miss in P2)
- **Per-source rate limiting** — P4 hardening once real CEMADEN/INMET adapters land (avoid bursting against authority endpoints)
- **Sentry / GlitchTip error forwarder** — P6 (pino structured logs are the foundation; the forwarder is the next layer)
- **Cron failure email/Slack notification** — P6 (rely on GH Actions default email until then)
- **Connection pool tuning + slow query log** — P6 hardening
- **Production Neon branch (separate from dev)** — P7 launch
- **Custom domain** — P7
- **Plausible analytics** — P7
- **`drizzle-kit studio` GUI for DB inspection** — optional dev convenience, not required
- **Webhook-based revalidation from external systems** — out of scope; P2 only orchestrator-triggered

## Anti-Patterns Specifically Rejected

- ❌ `drizzle-kit push` workflow — kills OSS deterministic replay
- ❌ pglite for tests — fidelity gap risks "passes locally, fails in prod"
- ❌ Real Neon dev branch in CI — quota burn + blocks fork PRs
- ❌ Plain `console.log` strings — kills incident triage
- ❌ Skipping `revalidatePath` in P2 — SPEC REQ-S2.07 mandates it; deferring risks P3 forgetting
- ❌ Hammering `revalidatePath('/')` every tick — wastes ISR cache (locked-out option in D-04)
- ❌ Direct `fetch()` in adapters — REQ-S2.03 mandates ofetch wrapper (verifiable via grep in CI)
- ❌ Concrete adapter imports outside the registry — REQ-S2.04 mandates abstraction (verifiable via grep)

## Universal Anti-Patterns Reaffirmed

- No new abstractions beyond what 13 SPEC reqs require
- No premature features (e.g., per-state cache keys, Redis cluster, sharding)
- No backward-compat shims (no real adapter exists yet → no migration story to bridge)
- No "soft defaults" — every default value justified by the SPEC
- Conventional commits with `(02-XX)` plan-scope prefixes once plans land

---

_Phase: 02-data-foundation_
_Context created: 2026-05-01_
_Next step: `/gsd-plan-phase 2` — produce per-task PLANs from SPEC + CONTEXT_
