# Phase 2: Data Foundation — Research

**Researched:** 2026-05-01
**Domain:** Postgres + Redis + HTTP ingestion plumbing on Next.js 16 / Vercel
**Confidence:** HIGH (all versions verified against npm registry on 2026-05-01)

## Summary

P2 installs the entire data layer: Drizzle + Neon Postgres + Upstash Redis + ofetch + zod + pino, plus GH Actions cron and Vercel preview wiring. Every dependency was verified against the live npm registry on 2026-05-01. All locked-decision packages from CONTEXT.md (D-01..D-04) are available at stable versions with no blocking issues, but **three landmines** require planner attention:

1. **`drizzle-orm/neon-http` does NOT support transactions** — `/api/ingest` orchestration MUST use `drizzle-orm/neon-serverless` (already mandated by CONTEXT.md "Implementation Notes" line 107). Confirmed.
2. **`pino` is Node-runtime only** — cannot import in `/api/states` or `/api/health` (edge routes). Those routes must use `console.log` with a thin structured-JSON helper, or be moved to Node runtime. **D-03 in CONTEXT.md does not address this split — flag for planner.**
3. **`pino` + Next.js 16 Turbopack has known bundling bugs** ([next#86099](https://github.com/vercel/next.js/issues/86099), [next#84766](https://github.com/vercel/next.js/issues/84766)) requiring `serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream', 'real-require']` in `next.config.ts`.

**Primary recommendation:** Pin every dep to the verified versions in §"Verified Versions"; use neon-http only for read-path edge routes (`/api/states`, `/api/health`); use neon-serverless for write/orchestration (`/api/ingest`, `/api/archive`, migrations); restrict pino imports to Node runtime files only.

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-04)

- **D-01 Drizzle migration workflow:** `drizzle-kit generate` produces SQL files committed to `drizzle/migrations/`; `pnpm db:migrate` applies them via `drizzle-orm/migrator`. No `drizzle-kit push`.
- **D-02 Test DB:** docker-compose `postgres:17-alpine` on port 5433 locally + GH Actions `services:` block (same image) in CI. Truncate-between-tests for isolation. `DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5433/test`.
- **D-03 Logging:** `pino` (info default, debug via `LOG_LEVEL`) + `pino-pretty` (dev only). Auto-redact `INGEST_TOKEN`, `DATABASE_URL`, `UPSTASH_REDIS_REST_TOKEN`, `*.token`, `*.secret`, `*.password`. Vercel ingests stdout. Forbidden: plain `console.log` strings.
- **D-04 revalidatePath wiring:** `src/lib/snapshot/diff.ts` exports `diffSnapshot(prev, curr)`; ingest calls `revalidatePath('/estado/' + uf)` per changed UF + `revalidatePath('/')` once if any. Behaves as no-op under P2's placeholder `unknown` (correct — not dead code).

### Claude's Discretion

- Exact `drizzle.config.ts` shape, `next.config.ts` `serverExternalPackages` list, choice of `pino` transport mechanism (dev script pipe vs. transport target), `crypto.timingSafeEqual` wrapper signature, whether `Alert` zod schema is exported via `z.infer` from a single file or split per-source, fixture JSON file naming convention.

### Deferred Ideas (OUT OF SCOPE)

- DB read-through fallback on cache miss → P6
- Per-source rate limiting → P4
- Sentry / GlitchTip forwarder → P6
- Cron failure email/Slack → P6
- Connection pool tuning → P6
- Production Neon branch → P7
- Custom domain → P7
- Plausible analytics → P7
- `drizzle-kit studio` → optional, not required
- Webhook-based revalidation from external systems → out of scope entirely

## Phase Requirements

| ID        | Description                        | Research Support                                    |
| --------- | ---------------------------------- | --------------------------------------------------- |
| REQ-S2.01 | Neon schema via Drizzle            | drizzle-orm 0.45.2 + drizzle-kit 0.31.10 verified   |
| REQ-S2.02 | Upstash no-TTL cache               | @upstash/redis 1.37.0 verified                      |
| REQ-S2.03 | ofetch retry/timeout wrapper       | ofetch 1.5.1 verified, retry+timeout API stable     |
| REQ-S2.04 | SourceAdapter registry             | pure TS, no deps; verifiable via grep               |
| REQ-S2.05 | Stub adapter + env fixture         | zod 4.4.1 validates fixture                         |
| REQ-S2.06 | GH Actions cron 15 min             | curl-only, no actions/setup-node needed in cron.yml |
| REQ-S2.07 | `/api/ingest` Node route           | neon-serverless required (transactions, atomicity)  |
| REQ-S2.08 | sources_health staleness           | covered by Drizzle insert/update                    |
| REQ-S2.09 | zod validation + payload-hash      | zod 4 schemas, sha256 via Node `crypto`             |
| REQ-S2.10 | `/api/states` + `/api/health` edge | neon-http for read-only edge access                 |
| REQ-S2.11 | Daily archive job                  | separate `archive.yml` workflow + Node route        |
| REQ-S2.12 | Vercel preview deploy              | vercel CLI 53.0.1 (env-var management)              |
| REQ-S2.13 | gitleaks no-regression             | already wired in P1, no version bump needed         |

## Architectural Responsibility Map

| Capability                       | Primary Tier                         | Secondary Tier          | Rationale                            |
| -------------------------------- | ------------------------------------ | ----------------------- | ------------------------------------ |
| Cron trigger                     | GH Actions                           | —                       | Vercel Cron is paid; locked decision |
| Ingest orchestration             | API/Backend (Node runtime)           | —                       | Drizzle write transactions + zod     |
| Source fetch                     | API/Backend (Node runtime)           | —                       | ofetch wrapper, retry, timeout       |
| Snapshot read                    | API/Backend (Edge runtime)           | CDN (Vercel edge cache) | Low latency, neon-http compatible    |
| Snapshot cache                   | External (Upstash Redis REST)        | —                       | Edge-safe REST API, no-TTL           |
| Snapshot archive (write-through) | Database (Neon Postgres)             | —                       | Audit + 30-day retention             |
| Health surfacing                 | API/Backend (Edge runtime)           | —                       | Read-only, edge-safe                 |
| Observability                    | Stdout structured JSON → Vercel logs | —                       | Foundation for P6 forwarder          |

## Verified Versions

All values fetched from npm registry on **2026-05-01**.

### Already Installed (P1 baseline — no bump needed)

| Package                | Installed        | Latest Stable    | Action                                                                                                                                                                                                                  |
| ---------------------- | ---------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`                 | ^16 (16.2.4)     | **16.2.4**       | Hold. 16.3 is canary only, 17 not announced. [VERIFIED: npm view next dist-tags]                                                                                                                                        |
| `react`                | ^19 (19.2.5)     | **19.2.5**       | Hold.                                                                                                                                                                                                                   |
| `react-dom`            | ^19              | **19.2.5**       | Hold.                                                                                                                                                                                                                   |
| `typescript`           | ^5               | **6.0.3**        | **YELLOW: TS 6 is fresh major.** Hold on TS 5.x in P2 (no Drizzle/zod compat blocker for TS 5). Plan TS6 bump as separate phase post-P2 to avoid surprise. [VERIFIED: npm view typescript dist-tags shows latest=6.0.3] |
| `tailwindcss`          | ^4 (4.2.4)       | **4.2.4**        | Hold.                                                                                                                                                                                                                   |
| `@tailwindcss/postcss` | ^4 (4.2.4)       | **4.2.4**        | Hold.                                                                                                                                                                                                                   |
| `pnpm`                 | 10.28.0 (pinned) | **10.33.2**      | Optional bump: `packageManager: pnpm@10.33.2`. Same minor, low risk.                                                                                                                                                    |
| `eslint-config-next`   | ^16              | **16.2.4**       | Hold.                                                                                                                                                                                                                   |
| `vitest`               | ^4.1.5           | **4.1.5**        | Hold.                                                                                                                                                                                                                   |
| `@types/node`          | ^22              | (verify in plan) | Bump to ^24 to match `engines.node >=24` — actionable for planner.                                                                                                                                                      |

### NEW for P2 (recommended pins)

| Package                    | Latest Stable           | Recommended Pin                           | Source                   | Notes                                                                                                                                                           |
| -------------------------- | ----------------------- | ----------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drizzle-orm`              | **0.45.2** (2026-03-27) | `^0.45.2`                                 | npm registry, 2026-05-01 | Peer accepts `@neondatabase/serverless >=0.10.0`, `@upstash/redis >=1.34.7` — both satisfied.                                                                   |
| `drizzle-kit`              | **0.31.10**             | `^0.31.10`                                | npm registry             | CLI commands current: `drizzle-kit generate`, `drizzle-kit migrate`, `drizzle-kit check`. Legacy `drizzle-kit:up` is deprecated. [CITED: orm.drizzle.team/docs] |
| `@neondatabase/serverless` | **1.1.0**               | `^1.1.0`                                  | npm registry             | Major version 1.x stable. Both `neon()` HTTP and `Pool` WebSocket exports available.                                                                            |
| `@upstash/redis`           | **1.37.0**              | `^1.37.0`                                 | npm registry             | REST client; edge-safe.                                                                                                                                         |
| `ofetch`                   | **1.5.1**               | `^1.5.1`                                  | npm registry             | `retry`, `retryDelay`, `retryStatusCodes`, `timeout` options stable.                                                                                            |
| `zod`                      | **4.4.1**               | `^4.4.1`                                  | npm registry             | **YELLOW:** Zod 4 is current major. Drizzle-zod peer is `zod ^3.25.0 \|\| ^4.0.0` so compatible. [VERIFIED: npm view drizzle-zod peerDependencies]              |
| `drizzle-zod`              | **0.8.3**               | `^0.8.3`                                  | npm registry             | Peer: `drizzle-orm >=0.36.0` — satisfied. Optional but recommended for `Alert` schema reuse.                                                                    |
| `pino`                     | **10.3.1**              | `^10.3.1`                                 | npm registry             | Node-only (see §Edge Caveats).                                                                                                                                  |
| `pino-pretty`              | **13.1.3**              | `^13.1.3` (devDep)                        | npm registry             | Dev-only transport.                                                                                                                                             |
| `@types/pg`                | **8.20.0**              | NOT NEEDED                                | —                        | `@neondatabase/serverless` ships its own types. Skip unless raw `pg` is added.                                                                                  |
| `postgres` (postgres.js)   | —                       | NOT NEEDED                                | —                        | Drizzle uses neon driver; postgres.js redundant.                                                                                                                |
| `vercel` (CLI)             | **53.0.1**              | install globally OR run via `pnpx vercel` | npm registry             | Used only for `vercel env pull` and `vercel link` during preview-deploy setup. Not a project devDep.                                                            |

### GitHub Actions Versions (verified via `gh api releases/latest` 2026-05-01)

| Action                     | Currently in repo | Latest                  | Recommended              | Notes                                                                                                                                   |
| -------------------------- | ----------------- | ----------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `actions/checkout`         | (whatever P1 set) | **v6.0.2** (2026-01-09) | `@v6`                    | Major bump from v4. Updates Node runtime to v22 (resolves the deprecation warning P1 saw).                                              |
| `actions/setup-node`       | (whatever P1 set) | **v6.4.0** (2026-04-20) | `@v6`                    | Major bump from v4. Supports Node 24. Uses `pnpm/action-setup` for cache.                                                               |
| `pnpm/action-setup`        | v4 (P1)           | **v5.0.0** (2026-03-17) | `@v5`                    | Major bump. Auto-detects `packageManager` from package.json (P1's bug is fixed in v5).                                                  |
| `gitleaks/gitleaks-action` | v2 (P1)           | **v2.3.9** (2025-04-17) | `@v2.3.9`                | No major bump; pin to specific patch for reproducibility.                                                                               |
| Postgres test image        | n/a               | `postgres:17-alpine`    | **`postgres:17-alpine`** | PG 18 is released and Alpine image exists, but D-02 in CONTEXT.md locks PG17. PG17 is still under active support; no reason to deviate. |

## Edge-Runtime Caveats

Critical compatibility matrix for the edge/Node split mandated by SPEC REQ-S2.10 + CONTEXT line 107:

| Package                                         | Edge Runtime                 | Node Runtime | P2 Usage                                                                                                              |
| ----------------------------------------------- | ---------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `drizzle-orm/neon-http`                         | ✅                           | ✅           | `/api/states`, `/api/health` (read-only, no transactions)                                                             |
| `drizzle-orm/neon-serverless`                   | ❌ (uses `ws`)               | ✅           | `/api/ingest`, `/api/archive`, `pnpm db:migrate`                                                                      |
| `@neondatabase/serverless` `neon()`             | ✅                           | ✅           | HTTP path                                                                                                             |
| `@neondatabase/serverless` `Pool`               | ❌                           | ✅           | WebSocket path (Node only)                                                                                            |
| `@upstash/redis` (REST)                         | ✅                           | ✅           | All routes                                                                                                            |
| `ofetch`                                        | ✅                           | ✅           | Adapter HTTP calls (Node — adapters run in `/api/ingest`)                                                             |
| `zod`                                           | ✅                           | ✅           | All schemas                                                                                                           |
| `pino`                                          | ❌                           | ✅           | **Node routes only.** Edge routes must use a `structuredLog()` helper that wraps `console.log({...})`.                |
| `next/cache` `revalidatePath`                   | ❌                           | ✅           | `/api/ingest` (Node) — confirmed by Next.js docs. [CITED: nextjs.org/docs/app/api-reference/functions/revalidatePath] |
| Node `crypto` (`timingSafeEqual`, `createHash`) | ⚠️ partial (Web Crypto only) | ✅           | Token compare + payload_hash → use Node runtime where used. Edge routes don't compute hashes.                         |

**Action item for planner:** Add a `src/lib/log/edge.ts` (just `console.log` JSON wrapper, no pino) and `src/lib/log/node.ts` (full pino with redaction). Two-file split avoids accidental pino import in edge bundle.

## Landmine Answers (specific user questions)

### Q1: Does `drizzle-orm/neon-http` support transactions?

**No.** Confirmed via [Drizzle docs](https://orm.drizzle.team/docs/connect-neon) and [community report](https://www.answeroverflow.com/m/1149370348593217619). Use `drizzle-orm/neon-serverless` for any code path that needs `db.transaction()`. P2's `/api/ingest` writes to `alerts` (insert), `sources_health` (upsert), and `snapshot_cache` (insert) — these SHOULD be in one transaction. Even if you don't use `db.transaction()` explicitly, prefer neon-serverless for the orchestrator to keep that option open. CONTEXT line 107 already mandates this split — confirmed correct.

### Q2: Does `revalidatePath` work in Node-runtime API routes?

**Yes.** Next.js docs confirm: "Route Handlers can use `revalidatePath` to invalidate cached data." Requires `export const runtime = 'nodejs'` (default). [CITED: nextjs.org/docs/app/api-reference/functions/revalidatePath]

### Q3: Does pino work in Edge runtime?

**No.** pino uses `worker_threads` for async transports; edge runtime has no worker_threads. Confirmed by multiple Next.js issues including [vercel/next.js#86099](https://github.com/vercel/next.js/issues/86099) and [vercel/next.js#84766](https://github.com/vercel/next.js/issues/84766). Even on Node runtime under Next 16 + Turbopack, pino requires `next.config.ts`:

```ts
export default {
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream", "real-require"],
};
```

**Action item:** Planner must include this `next.config.ts` change as part of the "install pino" task.

### Q4: pgcrypto vs `gen_random_uuid()` for UUID PK in PG 17?

**Use `gen_random_uuid()` directly — no extension needed.** Since PG 13, `gen_random_uuid()` is a built-in function (no `pgcrypto` extension required). Drizzle column: `uuid('id').primaryKey().defaultRandom()` emits `DEFAULT gen_random_uuid()`. PG 17 + 18 both ship this built-in.

### Q5: PG 18 alpine vs PG 17 alpine?

PG 18 is released and `postgres:18-alpine` exists. CONTEXT D-02 locks PG 17. Recommendation: **stay on PG 17** — PG 17 is fully supported, ENSO Brasil's queries are vanilla SQL (no PG 18-only features needed), and matches the locked CONTEXT decision. Document this so a future contributor doesn't bump it without a reason.

### Q6: Vercel CLI version + Next.js 16 quirks?

- `vercel` CLI **53.0.1** stable. Used only for `vercel link` and `vercel env add` during one-time provisioning.
- Next.js 16 + Vercel: no known quirks beyond the pino/Turbopack issue above. Drizzle works on both edge and Node functions on Vercel without configuration.

## Migration Path Notes

- **Zod 3 → 4:** Project has no zod yet, so installing 4.x directly. No migration needed. Watch for: zod 4 deprecated `.default()` chaining order semantics, made `.parse()` errors more verbose, removed some pre-3.20 APIs. Drizzle-zod 0.8.x supports both. **Not a risk for P2** because all schemas are written fresh.
- **TypeScript 5 → 6:** Hold off in P2. Plan as a follow-up between P2 and P3. No drizzle/zod/pino blockers identified, but TS 6 is < 30 days old and ecosystem may still surface bugs.
- **pnpm 10.28 → 10.33:** Same minor; recommend bump to 10.33.2 to match contributor environments (low risk). Update `packageManager` field + `pnpm/action-setup` will auto-detect.
- **GH Actions v4 → v6:** Bump checkout, setup-node, pnpm/action-setup as part of the cron.yml task. Delete any `with: version:` for pnpm/action-setup (auto-detect from `packageManager`).

## Project Constraints (from CLAUDE.md)

- Stack locked: Next 16 + TS strict + Tailwind v4 + Drizzle + Neon + Upstash + ofetch + GH Actions cron — research conforms.
- **NO `next-intl`** — not in scope of P2; no impact on data layer.
- Risk levels include `unknown`; PT-BR severity labels verbatim. P2 stamps `unknown` for all 27 UFs (per SPEC).
- Open-source MIT, public-safety-conservative. All deps verified MIT/ISC/Apache 2.0 compatible. (Verify in license-audit task if planner adds one.)
- Anti-features: no analytics tracking, no user accounts — N/A for data layer.

## Risk Table

| Risk                                                             | Likelihood         | Impact                  | Mitigation                                                                                                                 |
| ---------------------------------------------------------------- | ------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Pino fails to bundle under Next 16 Turbopack                     | HIGH (known issue) | HIGH (cron silent fail) | Add `serverExternalPackages` config; smoke-test ingest endpoint in CI                                                      |
| Edge route imports pino by accident                              | MED                | HIGH (build fails late) | Two-file split `log/edge.ts` vs `log/node.ts`; ESLint no-restricted-imports rule                                           |
| `neon-http` used in `/api/ingest` and transactions silently fail | MED                | HIGH (data corruption)  | Strict naming: `db/edge.ts` (http) vs `db/node.ts` (serverless); type-level guard via separate `EdgeDB` and `NodeDB` types |
| Upstash 500k cmd/mo quota burned                                 | LOW                | HIGH (cache offline)    | Cron 4×/hr × 24h × 30d ≈ 2,880 ingest ticks; each does ~3 commands = ~9k/mo. Well under limit. Log baseline.               |
| Neon free tier (100 compute hrs) exceeded                        | LOW                | HIGH (DB offline)       | HTTP driver doesn't pin compute; only ingest+archive run. Stay <5 compute hrs/mo at P2 stub load.                          |
| Zod 4 breaks drizzle-zod inference                               | LOW                | MED                     | Peer compat verified; pin both at known-good versions; integration test catches it                                         |
| GH Actions v4 → v6 breaks CI                                     | LOW                | LOW                     | Pin specific majors; test in PR before merging cron.yml                                                                    |
| pnpm 10.33 packageManager mismatch in CI                         | LOW                | LOW                     | Bump packageManager + pnpm/action-setup@v5 simultaneously                                                                  |
| TS 6 surprise bump kills build                                   | LOW (held in P2)   | HIGH                    | Hold TS 5.x; defer TS 6 to dedicated phase                                                                                 |
| `postgres:17-alpine` image security CVE in next 60 days          | LOW                | LOW                     | Docker pulls latest 17-alpine on each CI run; PG 17.minor patches auto-apply                                               |

## Action Items for the Planner

1. **Use the dual-driver pattern** as already mandated by CONTEXT line 107:
   - `src/db/edge.ts` exports neon-http Drizzle instance for `/api/states`, `/api/health`
   - `src/db/node.ts` exports neon-serverless Drizzle instance for `/api/ingest`, `/api/archive`, migrations
2. **Add `serverExternalPackages` to `next.config.ts`** when installing pino: `['pino', 'pino-pretty', 'thread-stream', 'real-require']`
3. **Split logging by runtime:**
   - `src/lib/log/node.ts` → full pino with redaction (D-03)
   - `src/lib/log/edge.ts` → `console.log(JSON.stringify({...}))` helper, no pino import
4. **Hold TypeScript at 5.x in P2.** Plan TS 6 bump as separate phase later. Document in commit msg.
5. **Bump `@types/node` to ^24** to match `engines.node >=24`.
6. **Bump GH Actions:** `actions/checkout@v6`, `actions/setup-node@v6`, `pnpm/action-setup@v5`. Drop any `with.version:` for pnpm/action-setup (auto-detect).
7. **Bump `packageManager` to `pnpm@10.33.2`** in package.json (optional but recommended).
8. **Use `gen_random_uuid()`** for UUID PKs (Drizzle: `.defaultRandom()`); no `pgcrypto` extension migration needed.
9. **Force Node runtime** in `/api/ingest` and `/api/archive` via `export const runtime = 'nodejs'`. Force edge runtime in `/api/states` and `/api/health` via `export const runtime = 'edge'`.
10. **Constant-time token compare:** import `timingSafeEqual` from `node:crypto` in Node routes. Wrap with Buffer-length normalization to avoid leaking length difference. Document inline (CONTEXT line 108).
11. **Pin `postgres:17-alpine`** in both `docker-compose.test.yml` and CI `services:` block (do NOT use floating `postgres:17`).
12. **Add a license-audit task** if not already in P1 (deps now include 10+ new packages); cheap with `pnpm licenses list`.
13. **`drizzle-zod` is optional but recommended** — single source of truth for `Alert` insert schema + zod runtime validation. Plan task can mark it discretionary; default = include.

## Validation Architecture

| Property    | Value                            |
| ----------- | -------------------------------- |
| Framework   | Vitest 4.1.5 (already installed) |
| Config file | `vitest.config.ts` (P1)          |
| Quick run   | `pnpm test`                      |
| Full suite  | `pnpm test && pnpm test:e2e`     |

### Phase Requirements → Test Map

| Req       | Test Type                       | Command                                                                                            | Wave 0? |
| --------- | ------------------------------- | -------------------------------------------------------------------------------------------------- | ------- |
| REQ-S2.01 | integration (against docker PG) | `pnpm test src/db/schema.test.ts`                                                                  | ❌ new  |
| REQ-S2.02 | integration (mock Upstash)      | `pnpm test src/lib/cache/upstash.test.ts`                                                          | ❌ new  |
| REQ-S2.03 | unit (mocked fetch)             | `pnpm test src/lib/http/fetcher.test.ts`                                                           | ❌ new  |
| REQ-S2.04 | grep verifier                   | shell: `! grep -r "import.*Stub\|import.*Cemaden\|import.*Inmet" src/lib/orchestrator src/lib/api` | ❌ new  |
| REQ-S2.05 | unit                            | `pnpm test src/lib/sources/stub.test.ts`                                                           | ❌ new  |
| REQ-S2.06 | YAML parse + actionlint         | `actionlint .github/workflows/cron.yml`                                                            | ❌ new  |
| REQ-S2.07 | integration (PG + mock Upstash) | `pnpm test src/app/api/ingest/route.test.ts`                                                       | ❌ new  |
| REQ-S2.08 | integration                     | same as 2.07                                                                                       | ❌ new  |
| REQ-S2.09 | unit                            | `pnpm test src/lib/sources/schema.test.ts`                                                         | ❌ new  |
| REQ-S2.10 | contract                        | `pnpm test src/lib/api/schemas.test.ts` + route shape tests                                        | ❌ new  |
| REQ-S2.11 | integration                     | `pnpm test src/app/api/archive/route.test.ts`                                                      | ❌ new  |
| REQ-S2.12 | manual smoke                    | `gh workflow run cron.yml --ref <branch>` post-deploy                                              | manual  |
| REQ-S2.13 | gitleaks already wired          | `pre-commit` hook                                                                                  | ✅ P1   |

### Wave 0 Gaps

- [ ] `tests/setup/db.ts` — runs `drizzle-orm/migrator` + truncate-between-tests helper
- [ ] `docker-compose.test.yml` — `postgres:17-alpine` service
- [ ] `tests/setup/upstash-mock.ts` — in-memory Map-backed mock
- [ ] `tests/fixtures/sources/stub-default.json` + `tests/fixtures/sources/README.md`
- [ ] `vitest.config.ts` — add `setupFiles: ['tests/setup/db.ts']` and `pool: 'forks'` for PG isolation
- [ ] CI workflow update — add `services: postgres: image: postgres:17-alpine` block + `pnpm db:migrate` step before `pnpm test`

## Security Domain

| ASVS Category         | Applies          | Standard Control                                                                                  |
| --------------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| V2 Authentication     | yes (token-only) | `crypto.timingSafeEqual` for `INGEST_TOKEN`                                                       |
| V3 Session Management | no               | No sessions in P2 (no users)                                                                      |
| V4 Access Control     | yes              | Bearer token gate on `/api/ingest` + `/api/archive`                                               |
| V5 Input Validation   | yes              | zod 4 schemas on every adapter response + API route                                               |
| V6 Cryptography       | yes              | Node `crypto.createHash('sha256')` for payload_hash; `timingSafeEqual` for token; never hand-roll |
| V7 Error Handling     | yes              | pino structured logs with redaction (D-03)                                                        |
| V8 Data Protection    | yes              | gitleaks pre-commit + CI (P1, REQ-S2.13)                                                          |
| V9 Communication      | yes              | All external HTTP via ofetch with HTTPS-only inputs                                               |

### Known Threat Patterns

| Pattern                                               | STRIDE                     | Mitigation                                                               |
| ----------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| Token brute-force on `/api/ingest`                    | Spoofing                   | Long random token + constant-time compare + Vercel rate limit (built-in) |
| Timing attack on token compare                        | Information disclosure     | `crypto.timingSafeEqual` (CONTEXT line 108)                              |
| Adapter response schema drift causing cache poisoning | Tampering                  | zod validation BEFORE persistence (REQ-S2.09)                            |
| Secret leak via logs                                  | Information disclosure     | pino redaction config (D-03) + gitleaks (P1)                             |
| SQL injection                                         | Tampering                  | Drizzle parameterized queries; never raw SQL strings                     |
| Stale cache served as fresh                           | Denial of service / safety | `lastSuccessfulFetch` field in StateSnapshot + isStale flag (REQ-S2.08)  |

## Environment Availability

| Dependency         | Required By               | Available                                 | Version               | Fallback                                                          |
| ------------------ | ------------------------- | ----------------------------------------- | --------------------- | ----------------------------------------------------------------- |
| Node               | Build/test                | ✅                                        | (per `engines: >=24`) | —                                                                 |
| pnpm               | Build/test                | ✅                                        | 10.28.0               | —                                                                 |
| Docker             | Test PG container locally | (assumed dev has it; CI uses GH services) | —                     | CI uses GH `services:` block — no docker-compose dependency in CI |
| Neon account       | Preview deploy            | ❌ (provision in P2)                      | —                     | Blocking — must create Neon project + dev branch                  |
| Upstash account    | Preview deploy            | ❌ (provision in P2)                      | —                     | Blocking — must create Upstash Redis DB                           |
| Vercel account     | Preview deploy            | ❌ (provision in P2)                      | —                     | Blocking — must `vercel link`                                     |
| GH Actions secrets | cron.yml + Vercel env     | ❌ (set in P2)                            | —                     | Blocking — `INGEST_TOKEN`, `VERCEL_URL` must be set               |

**Missing dependencies with no fallback (planner must include provisioning tasks):**

- Neon project + dev branch + `DATABASE_URL`
- Upstash Redis DB + `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Vercel project link + 4 env vars wired
- GH Actions repo secrets: `INGEST_TOKEN`, `VERCEL_URL`

## Assumptions Log

| #   | Claim                                                                                    | Section         | Risk if Wrong                                                                          |
| --- | ---------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------- |
| A1  | Free-tier quotas (Upstash 500k/mo, Neon 100 compute hrs) unchanged in 2026               | Risk Table      | Low — even 50% reduction still leaves headroom                                         |
| A2  | `serverExternalPackages` is the canonical fix in Next 16.2.x for pino/Turbopack bundling | Action Items #2 | If incorrect: pino still bundles, ingest fails at runtime — caught by integration test |
| A3  | `gen_random_uuid()` available without extension in PG 17                                 | Q4              | [VERIFIED via PG 13+ docs] but worth adding `pg_dump --schema-only` check to CI        |

## Sources

### Primary (HIGH)

- npm registry (`npm view <pkg>` 2026-05-01) — every dep version
- GitHub Releases API (`gh api releases/latest`) — actions/checkout, setup-node, pnpm/action-setup, gitleaks-action
- [Drizzle ORM docs — Connect Neon](https://orm.drizzle.team/docs/connect-neon)
- [Next.js docs — revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)

### Secondary (MEDIUM)

- [vercel/next.js#86099 — pino + Turbopack 16 bundling](https://github.com/vercel/next.js/issues/86099)
- [vercel/next.js#84766 — pino worker_threads in Next 16](https://github.com/vercel/next.js/issues/84766)
- [Drizzle community — neon-http transactions limitation](https://www.answeroverflow.com/m/1149370348593217619)
- [Docker Hub — postgres official image (17-alpine, 18-alpine)](https://hub.docker.com/_/postgres)

## Metadata

**Confidence breakdown:**

- Standard stack versions: HIGH — live npm registry queried 2026-05-01
- Edge-runtime caveats: HIGH — confirmed via Next.js docs + community issues
- Pino + Turbopack workaround: MEDIUM — fix is documented in active issues, planner should integration-test
- GH Actions versions: HIGH — `gh api` confirmed
- Free-tier quotas: MEDIUM — assumed unchanged, plan should log baseline

**Research date:** 2026-05-01
**Valid until:** 2026-05-31 (deps move fast — re-verify if planning slips beyond 30 days)
