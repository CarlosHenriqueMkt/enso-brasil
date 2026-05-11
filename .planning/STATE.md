# Project State — ENSO Brasil

**Project:** ENSO Brasil — public Brazilian climate hazard aggregator dashboard
**Current milestone:** v1 — Per-state hazard dashboard
**Status:** Phase 4 SHIPPED (Path C — INMET-only; CEMADEN P5) · Phase 5 NEXT
**Last updated:** 2026-05-09

## Current Phase

**Phase 4 verdict:** SHIPPED — PR #5 opened 2026-05-09 on branch `phase-4-adapters-cemaden-inmet`. Pending squash-merge after CI + Vercel preview smoke verification. INMET adapter (41 unit tests, 100/100/100/100 coverage), fixture refresh script, contract tests, atomic cutover from stub to inmetAdapter. CEMADEN deferred to P5 (Path C). Schema drift finding: live INMET API returns `{hoje:[...], futuro:[...]}` instead of flat array — P5.1 fix documented in 04-05-SUMMARY.
**Next:** Phase 5 — CEMADEN + Dashboard UI
**Command to run:** `/gsd-execute-phase 5`

**Path C revision (2026-05-05):** Plan-checker round produced findings B-1/B-2/B-3 (CEMADEN endpoint discovery) and W-1/W-3/W-4 (taxonomy + verify + vitest race). Live discovery confirmed CEMADEN's only documented public REST API (`https://sws.cemaden.gov.br/PED/api/ui/`) is **PED — Plataforma de Entrega de Dados** — observational data only (PCDs, accumulated rainfall, weather stations), 15 paths, ZERO alert endpoints. PED ≠ alerts; deriving alerts from raw rainfall crosses the aggregator-vs-authority line in CLAUDE.md anti-features. CEMADEN authoritative alerts (`painelalertas.cemaden.gov.br` SPA) require DevTools-on-live-SPA fieldwork that exceeds Phase 4's scope budget.

**Path C plan revisions:**

- Plan 04-02 (CEMADEN adapter) **deleted**.
- Plan 04-01: Replaced `class SourceError extends Error` with `sourceError(code, message, cause?)` factory (W-1 fix). Added Wave 0 task pre-extending `vitest.config.ts` glob to `tests/**/*.test.ts` and `scripts/**/*.test.ts` (W-4 fix — eliminates dual-edit race in 04-04/04-05).
- Plan 04-03: INMET endpoints pinned per RESEARCH Q2 — `INMET_CAP_LIST = "https://apiprevmet3.inmet.gov.br/avisos/ativos"`, `INMET_CAP_DETAIL(id) = "https://alertas2.inmet.gov.br/{id}"`. All errors thrown via `sourceError()` factory.
- Plan 04-04: INMET-only refresh script with `--dry-run` mode reading from `tests/fixtures/sources/_stub/` (W-3 fix — `--help` was unimplemented; replaced with real dry-run verification). Removed `vitest.config.ts` from `files_modified` (W-4).
- Plan 04-05: INMET-only contract test + cross-source isolation via **inline `cemadenStub` factory in test file** (no real CEMADEN code in `src/`). Removed `vitest.config.ts` from `files_modified` (W-4).
- Plan 04-06: Registry registers `[inmetAdapter]` only. `/api/ingest` uses `Promise.allSettled([inmetAdapter])` (futures-proof for P5). Atomic stub deletion: ONLY the INMET stub deleted; inline `cemadenStub` stays with `TODO(P5)` comment. Preview-deploy human-verify checkpoint (Task 4, autonomous: false).

**PED swagger** preserved at `.planning/phases/04-first-two-adapters/04-cemaden-PED-swagger.json` for P5 reference.

**Plan set:** 5 plans (was 6) · 4 waves (0/1/2/3) · all plans include `<threat_model>` ASVS L2 + Dimension 8 Nyquist validation.

**Phase 3 verdict:** SHIPPED — PR #1 squash-merged to main as `8137afda` on 2026-05-04. UAT 14/14, security audit PASS (12/12 ASVS L2), coverage 100/100/100/100 across `src/lib/risk/**`. dep-cruiser RISK-01 isolation rule active in CI. Branch `phase-3-risk-engine` deleted on remote.

**Repo policy locked 2026-05-04 (PR #2):** Squash-only merges. Merge commit + rebase disabled at repo settings + ruleset 15829967. Auto-delete branches on merge. Solo-dev uses `--admin` bypass after CI green.

**Phase 3 progress:** All 13 plans executed. 28+ atomic commits on `phase-3-risk-engine`. Coverage 100/100/100/100 across `src/lib/risk/**` (8 modules). dep-cruiser RISK-01 isolation rule passes. ESLint risk override active. PT-BR README addendum shipped. `src/app/api/**` untouched (P4 owns wiring). Recovery note: Wave 0 parallel run hit lint-staged race; switched to sequential mid-execution.

**Phase 2 verdict:** SHIPPED — 11/11 plans complete, all REQ-S2.\* met, production deploy verified end-to-end. Cron workflow green, Neon + Upstash provisioned, DNS live (`ensobrasil.com.br` + `www.ensobrasil.com.br`).

**Phase 1 verdict:** PASS — 4/4 ROADMAP success criteria, 11/11 REQ-S1.\*, 8/8 locked decisions. Repo public at `https://github.com/CarlosHenriqueMkt/enso-brasil`.

**Project-level decision change** (locked 2026-04-28): **i18n removed entirely.** Project is PT-BR only. `next-intl` dropped from stack. M12 (ES/EN translations) deleted from roadmap.

**Project-level decision REVERSAL** (locked 2026-04-30, P1 D-13): **Next.js 15.5.x pin reversed → latest stable (16.x line).** Original 16.x block was next-intl interop; with next-intl removed, the constraint is moot.

## Phase Progression

| #   | Phase                          | Status                                                          |
| --- | ------------------------------ | --------------------------------------------------------------- |
| 1   | Skeleton & OSS Foundation      | ✅ complete + verified (CI green, repo public, ruleset active)  |
| 2   | Data Foundation                | ✅ shipped — production live, cron green, all 11 plans complete |
| 3   | Pure Risk Engine               | ✅ shipped — PR #1 squash-merged 2026-05-04 (`8137afda`)        |
| 4   | First Adapter (INMET) — Path C | ✅ shipped — PR #5 opened 2026-05-09; pending squash-merge      |
| 5   | CEMADEN + Dashboard UI         | ⏳ **next** — absorbs CEMADEN adapter from P4 Path C carry-over |
| 6   | Hardening + 3rd Source         | ⏳ pending                                                      |
| 7   | Launch                         | ⏳ pending                                                      |

## Key Artifacts

- `.planning/PROJECT.md` — vision, audience, locked decisions
- `.planning/REQUIREMENTS.md` — 45 v1 REQ-IDs grouped by category
- `.planning/ROADMAP.md` — 7-phase fine-granularity breakdown (updated 2026-05-05 for Path C)
- `.planning/config.json` — workflow config
- `.planning/research/SUMMARY.md` — synthesized research findings
- `.planning/phases/04-first-two-adapters/04-cemaden-PED-swagger.json` — CEMADEN PED API swagger (P5 reference)
- `risk-formula-v0.md` — risk formula contract

## Workflow Settings (from config.json)

- Mode: **YOLO** (auto-approve gates)
- Granularity: **Fine** (7 phases)
- Parallel execution: **on**
- Research: **on**
- Plan-check: **on**
- Verifier: **on**
- Nyquist validation: **on**
- Auto-advance: **on**
- Commit docs: **on**
- Model profile: **balanced**

## Open Decisions (revisit during build)

- Final project name and `.com.br` domain
- Visual design system beyond risk colors (typography, spacing scale)
- SEO + launch strategy (Phase 7)
- OSS governance (PR review cadence, code of conduct details)
- M2–M13 prioritization order (post-v1 via `/gsd-new-milestone`)

## Risk Watch

These came out of `.planning/research/PITFALLS.md` and apply across phases:

1. **CEMADEN authoritative alerts feed undocumented; PED API ≠ alerts; carry to P5.** PED (`https://sws.cemaden.gov.br/PED/api/ui/`) exposes observational data only — PCDs, rainfall, weather stations, JWT-protected. Painel de Alertas SPA (`painelalertas.cemaden.gov.br`) holds the alert authority surface; backend is undocumented; DevTools fieldwork required in P5. **Mitigation: Phase 4 ships INMET-only (Path C); Phase 5 carry-over.**
2. **CEMADEN endpoint instability** (when reached in P5) — schema-validate every poll; outreach to authority planned in Phase 7.
3. **INMET CAP XML parsing** — golden-file fixtures from real responses required; `<info xml:lang="pt-BR">` selection mandatory; fail loud.
4. **INMET `/avisos/ativos` rate-limit** — encountered 429 during research; single national-scope call per cron tick; `User-Agent: enso-brasil/1.0` for identification.
5. **Free-tier exhaustion at peak alert moments** — single edge-cached JSON, full static fallback, 7-day soak in Phase 6.
6. **Stale snapshot during real red alert** — on-demand `revalidatePath` in Phase 2's ingestion endpoint.
7. **Semiárido chronic drought painted green** — known v1 limitation; documented in README; structural fix is M4.
8. **Yellow `#eab308` fails WCAG AA on white** — darken or use black text only; locked in Phase 5.

## Notes

- This project did not run with the GSD SDK (Windows install issue). Files were scaffolded manually using the same workflow contract. Subsequent `/gsd-*` commands should still work since they read from `.planning/` files.
- **Phase 4 numbering:** Plan files are 04-01, 04-03, 04-04, 04-05, 04-06 (gap at 04-02 is intentional after Path C revision — preserves traceability with prior CONTEXT.md plan-table references).
