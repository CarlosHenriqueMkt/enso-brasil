# Phase 2 — Discussion Log

**Date:** 2026-05-01
**Mode:** discuss (default; SPEC.md pre-loaded)
**Areas selected:** 4 of 4 presented

## Areas presented

User multiSelect chose all 4 from:

1. Drizzle migration workflow — generate vs push
2. Test DB strategy — real Neon, docker PG, or pglite
3. Logging strategy — pino vs cheap-mode console.log
4. `revalidatePath` wiring with placeholder `unknown` — wire now or defer

## Clarifications requested mid-flow

### Why Drizzle? (before answering migration question)

**User question:** Por quê Drizzle?
**Claude response:** Cited research SUMMARY.md line 14 (Prisma cold-start cost). Walked through 6 reasons: cold start (Drizzle ~7kb vs Prisma ~50MB engine), edge runtime support (native via `@neondatabase/serverless`), TS-first schema (no code-gen step), deterministic OSS-friendly migrations via `drizzle-kit generate`, bundle size, official Neon stack alignment. Trade-offs: smaller community, less mature migration tooling, no Prisma Studio (drizzle-kit studio exists). Alternatives explicitly rejected: Prisma (cold start), Kysely (no schema/migrations), TypeORM/Sequelize (legacy/cold-start), raw `pg` (loses type safety). Noted that switching would ripple PROJECT.md + REQUIREMENTS.md + SPEC.md + research/SUMMARY + CLAUDE.md.
**Outcome:** User accepted Drizzle, no ripple needed.

### Which strategy facilitates collaboration? (before answering test DB question)

**User question:** Qual estratégia facilita a colaboração?
**Claude response:** Walked through OSS-collaboration trade-offs for the 3 test DB options. Docker-compose wins clearly: contributor needs `docker compose up -d && pnpm test` (offline-capable, no cloud secrets, no API keys, fork PRs work without GH secrets). Real Neon dev branch: contributor needs Neon account + API key + understanding of ephemeral branches; fork PRs blocked without secrets; quota burn at 100 hrs free × N contributors; fails offline. pglite: zero setup but fidelity gap (PG extensions, GIST/GIN partial) → "passes locally fails in prod" pattern is bad for public-safety project.
**Outcome:** User confirmed collaboration is the right axis; chose docker-compose.

## Decisions locked

| ID   | Question                                   | Choice                                                                  |
| ---- | ------------------------------------------ | ----------------------------------------------------------------------- |
| D-01 | Migration workflow — generate vs push?     | `drizzle-kit generate` — SQL files in git                               |
| D-02 | Test DB strategy?                          | docker-compose `postgres:17-alpine` in CI + locally                     |
| D-03 | Logging strategy?                          | `pino` + `pino-pretty` for dev; secret-redaction config                 |
| D-04 | `revalidatePath` wiring under placeholder? | Wire diff logic + revalidate calls now; no-op until P3 lands real risks |

## Deferred ideas (logged in CONTEXT.md → Deferred Ideas)

- DB read-through fallback when cache misses — P6
- Per-source rate limiting — P4
- Sentry / GlitchTip forwarder — P6
- Cron failure email/Slack notification — P6
- Connection pool tuning + slow query log — P6
- Production Neon branch — P7
- Custom domain — P7
- Plausible analytics — P7
- `drizzle-kit studio` — optional dev convenience
- Webhook-based revalidation from external systems — out of v1

## Notes for downstream agents

- All 13 requirements from SPEC are LOCKED and treated as contract
- 4 implementation decisions (D-01..D-04) are LOCKED in CONTEXT.md
- Implementation Notes section in CONTEXT.md provides guard-rails (Drizzle driver split, constant-time token compare, connection lifecycle, CI sequence, fixture schema)
- Anti-Patterns Specifically Rejected section enumerates patterns the planner MUST NOT introduce

## Mode + workflow notes

- gsd-sdk CLI unavailable on this Windows machine (CLAUDE.md note); workflow ran via direct file reads
- SPEC.md just-written this session (commit `959cc99`); CONTEXT.md does not duplicate any SPEC content
- No `.continue-here.md` blocking anti-patterns
- No prior CONTEXT.md to update; first context for P2
