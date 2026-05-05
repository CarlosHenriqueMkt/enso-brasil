# Project State — ENSO Brasil

**Project:** ENSO Brasil — public Brazilian climate hazard aggregator dashboard
**Current milestone:** v1 — Per-state hazard dashboard
**Status:** Phase 3 SHIPPED · ready for Phase 4
**Last updated:** 2026-05-04

## Current Phase

**Next:** Phase 4 — First Two Adapters (CEMADEN + INMET)
**Command to run:** `/gsd-spec-phase 4` (or `/gsd-discuss-phase 4` if SPEC stays simple)

**Phase 3 verdict:** SHIPPED — PR #1 squash-merged to main as `8137afda` on 2026-05-04. UAT 14/14, security audit PASS (12/12 ASVS L2), coverage 100/100/100/100 across `src/lib/risk/**`. dep-cruiser RISK-01 isolation rule active in CI. Branch `phase-3-risk-engine` deleted on remote.

**Repo policy locked 2026-05-04 (PR #2):** Squash-only merges. Merge commit + rebase disabled at repo settings + ruleset 15829967. Auto-delete branches on merge. Solo-dev uses `--admin` bypass after CI green.

**Phase 3 progress:** All 13 plans executed. 28+ atomic commits on `phase-3-risk-engine`. Coverage 100/100/100/100 across `src/lib/risk/**` (8 modules: types, calculate, dedup, snapshot, explanation, vocab, sources/cemaden, sources/inmet). dep-cruiser RISK-01 isolation rule passes. ESLint risk override active. PT-BR README addendum shipped. `src/app/api/**` untouched (P4 owns wiring). Recovery note: Wave 0 parallel run hit lint-staged race; switched to sequential mid-execution. Final coverage gate fix (4bc1540) inlined dead branches in explanation.ts to restore 100% branches.

**Phase 2 verdict:** SHIPPED — 11/11 plans complete, all REQ-S2.\* met, production deploy verified end-to-end. Cron workflow green, Neon + Upstash provisioned, DNS live (`ensobrasil.com.br` + `www.ensobrasil.com.br`). Smoke matrix in `.planning/phases/02-data-foundation/02-11-SUMMARY.md`. Two CI fix sprints documented in `02-10-SUMMARY-supplement.md` (driver swap neon-http→node-postgres for tests, drizzle-orm dual-instance dedupe, vitest globalSetup race fix).

**Phase 1 verdict:** PASS — 4/4 ROADMAP success criteria, 11/11 REQ-S1.\*, 8/8 locked decisions. Verification at `.planning/phases/01-skeleton-oss-foundation/01-VERIFICATION.md`. Repo public at `https://github.com/CarlosHenriqueMkt/enso-brasil`. CI green, branch ruleset 15829967 active.

**Project-level decision change** (locked 2026-04-28 during SPEC): **i18n removed entirely.** Project is PT-BR only. `next-intl` dropped from stack. M12 (ES/EN translations) deleted from roadmap. Translation utilities for foreign-language ingestion (NOAA, NASA) become an ingestion-pipeline concern, decided when M5 lands.

**Project-level decision REVERSAL** (locked 2026-04-30 during P1 discuss-phase, see `.planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md` D-13): **Next.js 15.5.x pin reversed → latest stable (16.x line).** Original 16.x block was next-intl interop; with next-intl removed, the constraint is moot. Rippled to PROJECT.md, REQUIREMENTS.md, SPEC.md, CLAUDE.md.

## Phase Progression

| #   | Phase                                | Status                                                          |
| --- | ------------------------------------ | --------------------------------------------------------------- |
| 1   | Skeleton & OSS Foundation            | ✅ complete + verified (CI green, repo public, ruleset active)  |
| 2   | Data Foundation                      | ✅ shipped — production live, cron green, all 11 plans complete |
| 3   | Pure Risk Engine                     | ✅ shipped — PR #1 squash-merged 2026-05-04 (`8137afda`)        |
| 4   | First Two Adapters (CEMADEN + INMET) | ⏳ next                                                         |
| 5   | Dashboard UI                         | ⏳ pending                                                      |
| 6   | Hardening + 3rd Source               | ⏳ pending                                                      |
| 7   | Launch                               | ⏳ pending                                                      |

## Key Artifacts

- `.planning/PROJECT.md` — vision, audience, locked decisions
- `.planning/REQUIREMENTS.md` — 45 v1 REQ-IDs grouped by category
- `.planning/ROADMAP.md` — 7-phase fine-granularity breakdown
- `.planning/config.json` — workflow config (YOLO + parallel + research + plan-check + verifier)
- `.planning/research/SUMMARY.md` — synthesized research findings (read this before planning Phase 1)
- `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS}.md` — full research outputs
- `risk-formula-v0.md` — risk formula contract (root of repo, treat as authoritative — except apply v0.1 corrections from research)
- `gsd-new-project-prompt.md` — original idea document (preserved for traceability)

## Workflow Settings (from config.json)

- Mode: **YOLO** (auto-approve gates)
- Granularity: **Fine** (7 phases)
- Parallel execution: **on**
- Research: **on**
- Plan-check: **on**
- Verifier: **on**
- Nyquist validation: **on**
- Auto-advance: **on**
- Commit docs: **on** (planning tracked in git)
- Model profile: **balanced**

## Open Decisions (revisit during build)

These are flagged in PROJECT.md but do not block Phase 1:

- Final project name and `.com.br` domain
- Visual design system beyond risk colors (typography, spacing scale)
- SEO + launch strategy (decided in Phase 7)
- OSS governance (PR review cadence, code of conduct details)
- M2–M13 prioritization order (decided post-v1 via `/gsd-new-milestone`)

## Risk Watch

These came out of `.planning/research/PITFALLS.md` and apply across phases:

1. **CEMADEN endpoint instability** — schema-validate every poll; outreach to authority planned in Phase 7
2. **INMET CAP XML parsing** — golden-file fixtures from real responses required
3. **Free-tier exhaustion at peak alert moments** — single edge-cached JSON, full static fallback, 7-day soak in Phase 6
4. **Stale snapshot during real red alert** — on-demand `revalidatePath` in Phase 2's ingestion endpoint
5. **Semiárido chronic drought painted green** — known v1 limitation; documented in README; structural fix is M4
6. **Yellow `#eab308` fails WCAG AA on white** — darken or use black text only; locked in Phase 5

## Notes

- This project did not run with the GSD SDK (Windows install issue). Files were scaffolded manually using the same workflow contract. Subsequent `/gsd-*` commands should still work since they read from `.planning/` files, but the SDK-driven helpers (`gsd-sdk query ...`) won't execute. If the SDK is fixed, no rework needed — just re-run.
