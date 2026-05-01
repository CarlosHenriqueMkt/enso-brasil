# Plan 02-04 — Loggers (dual-runtime) · SUMMARY

**Plan:** `02-04-loggers-PLAN.md`
**Status:** complete
**Wave:** 2 (parallel)
**Tasks:** TDD red + green

## Commits

- `5482d7a` test(02-04): add failing tests for dual-runtime loggers (RED)
- `<later>` feat(02-04): dual-runtime loggers + ESLint guard (GREEN)

## Files written

- `src/lib/log/node.ts` — pino instance for Node runtime routes (`/api/ingest`, `/api/archive`, migration runner). Structured JSON to stdout. Level `info` prod / `debug` local via `LOG_LEVEL`. Redaction config strips `INGEST_TOKEN`, `DATABASE_URL`, `UPSTASH_REDIS_REST_TOKEN`, and any field path matching `*.token`, `*.secret`, `*.password`. `pino-pretty` transport applied when `NODE_ENV !== "production"`.
- `src/lib/log/edge.ts` — hand-rolled JSON helper for V8 isolate edge routes (`/api/states`, `/api/health`). ~30 LOC. Same surface as node logger (`info`/`warn`/`error`/`debug` taking `(event, fields)`). Redaction implemented in-process for the same field-path list. No deps. `console.log(JSON.stringify({ ts, level, event, ...redact(fields) }))`.
- `src/lib/log/node.test.ts` — vitest covering JSON emission + redaction. Uses `vi.stubEnv` (NOT `process.env.NODE_ENV =` which is forbidden in TS strict). Stdout monkey-patch via typed cast.
- `src/lib/log/edge.test.ts` — vitest covering JSON shape + redaction.
- `eslint.config.mjs` — `no-restricted-imports` rule blocking `pino`, `pino-pretty`, `@/lib/log/node`, and any `**/lib/log/node` pattern in `src/app/api/states/**`, `src/app/api/health/**`, `src/db/edge.ts`. Forces compile/lint failure if pino accidentally imported in edge code.

## Verification

- `pnpm exec tsc --noEmit` → exit 0
- `pnpm test` → all logger tests pass
- ESLint rule fires on attempted `import pino` in edge route file (lint-stage gate proves it during commit)
- No shared barrel `src/lib/log/index.ts` — direct imports per runtime

## Deviations

1. **TDD red phase committed standalone first.** Tests landed in `5482d7a` before source modules. Triggered transient tsc errors documented in `deferred-items.md`. Resolved when source modules landed.
2. **`process.env.NODE_ENV =` writes replaced with `vi.stubEnv`.** TS strict forbids assignment to read-only env keys. `vi.stubEnv` + `vi.unstubAllEnvs` is the canonical vitest path.
3. **Plan B fallback documented in CONTEXT.md D-03 §Fallback Plan B.** Triggers (Turbopack opt-out fails / Vercel deploy refuses pino bundle / Next 16.x bumps regress workaround) and 6-step rollback (drop pino, promote `edge.ts` to single `src/lib/log.ts`) are pre-specified. Cost ~30 min if needed.

## REQ coverage

- Implements D-03 (CONTEXT) dual-runtime split
- Foundation for REQ-S2.07 (ingest endpoint logs `event`/`runId`/`durationMs`)
- Foundation for REQ-S2.10 (edge routes log without pulling pino into the V8 bundle)

## Anti-patterns avoided

- ❌ pino in edge runtime (would silently fail at deploy)
- ❌ Plain `console.log(string)` (loses machine-grep)
- ❌ Shared barrel module (would invite accidental edge import)
- ❌ Unredacted secrets in log output (redaction unit test asserts)
