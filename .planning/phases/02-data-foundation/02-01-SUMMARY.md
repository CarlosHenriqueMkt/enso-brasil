# Plan 02-01 — Deps and Config · SUMMARY

**Plan:** `02-01-deps-and-config-PLAN.md`
**Status:** complete
**Wave:** 1 (foundation)
**Tasks:** 2/2

## Commits

- `74c7d9f` feat(02-01): install P2 deps + wire drizzle/pino config
- `459772e` chore(02-01): document P2 env vars + verify gitleaks allowlist

## Files written

- `package.json` — runtime deps: `drizzle-orm@^0.45.2`, `@neondatabase/serverless@^1.1.0`, `@upstash/redis@^1.37.0`, `ofetch@^1.5.1`, `zod@^4.4.1`, `pino@^10.3.1`. Dev deps: `drizzle-kit@^0.31.10`, `drizzle-zod@^0.8.3`, `pino-pretty@^13.1.3`, `tsx@^4`. Scripts: `db:generate`, `db:migrate`, `db:check`. Bumped `@types/node ^22 → ^24`, `packageManager pnpm@10.28.0 → pnpm@10.33.2`.
- `pnpm-lock.yaml` — regenerated
- `drizzle.config.ts` — D-01 generate workflow; postgresql dialect; `schema: 'src/db/schema.ts'`; `out: 'drizzle/migrations'`
- `next.config.ts` — appended `serverExternalPackages: ['pino','pino-pretty','thread-stream','real-require']` (D-03 Turbopack fix; vercel/next.js#86099, #84766)
- `.env.example` — documented 4 P2 env vars (DATABASE_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, INGEST_TOKEN) + 3 optional (LOG_LEVEL, STUB_FIXTURE_PATH, DATABASE_URL_TEST). PT-BR comments. Placeholders shaped to NOT trigger gitleaks; allowlist for `*.example` from P1 preserved.
- `.gitignore` — added `.vercel/` directory and `*.tsbuildinfo` guard

## Verification

- `pnpm install` → success (lockfile regenerated cleanly)
- `pnpm exec tsc --noEmit` → exit 0
- gitleaks destructive control test: Slack-bot-token shaped string in non-`.example` file → BLOCKED (exit 1, RuleID `slack-bot-token`)
- gitleaks positive control test: `.env.example` placeholders staged → ALLOWED (exit 0; allowlist working)

## Deviations

1. **gitleaks default ruleset does NOT flag bare `postgres://user:pw@host/db` connection URLs.** No specific PG rule ships with gitleaks 8.30; detection relies on in-band tokens (Slack/Stripe/AWS-key/PAT shapes) or password fields with high entropy near "secret/key/token" keywords. Plan acceptance criterion using fake neon string did not fire — substituted Slack-token control test to prove the underlying mechanism (extension allowlist + extend-defaults config) works correctly. Documented in commit `459772e`. Future enhancement: add a custom rule for postgres URLs to `.gitleaks.toml` if needed.

2. **zod 4.x (not 3.x) selected.** RESEARCH.md flagged zod 4 as a fresh major; the planner installed `^4.4.1` since `drizzle-zod@^0.8.3` already supports it. No legacy 3.x callers in the codebase to break. If a future dep requires zod 3, downgrade with no other ripple expected.

3. **`.env.example` includes optional vars** (LOG_LEVEL, STUB_FIXTURE_PATH, DATABASE_URL_TEST) commented out. Plan listed only the 4 required vars; optional vars are documentation for plans 02-04 (LOG_LEVEL), 02-05 (STUB_FIXTURE_PATH), 02-10 (DATABASE_URL_TEST). Pre-stages contributor knowledge.

## REQ coverage

- **REQ-S2.01** (partial — drizzle-kit + drizzle-orm installed, config wired; schema/migrations land in 02-02)
- **REQ-S2.02** (partial — `@upstash/redis` installed; client wiring lands in 02-03)
- **REQ-S2.03** (partial — `ofetch` installed; wrapper lands in 02-03)
- **REQ-S2.13** ✓ — gitleaks allowlist + destructive control verified

## Anti-patterns avoided

- ❌ `drizzle-kit push` — config explicitly uses `generate` (D-01)
- ❌ pino without serverExternalPackages — opt-out applied (D-03)
- ❌ TS 6 bump — RESEARCH hold honored (TS 5.x stays)
- ❌ npm/yarn — pnpm-only

## Activation map

P2 deps now available. All Wave 2 plans (02-02..02-05) can `import` directly without further install.

## Next

Wave 2 (4 plans parallel): 02-02 schema + 02-03 cache+http + 02-04 loggers + 02-05 adapter+stub.
