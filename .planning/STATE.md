# Project State — ENSO Brasil

**Project:** ENSO Brasil — public Brazilian climate hazard aggregator dashboard
**Current milestone:** v1 — Per-state hazard dashboard
**Status:** Phase 1 complete + verified · ready for Phase 2
**Last updated:** 2026-05-01

## Current Phase

**Next:** Phase 2 — Data Foundation (Postgres + Upstash + ofetch + adapter contract + cron skeleton)
**Command to run:** `/gsd-discuss-phase 2`

**Phase 1 verdict:** PASS — 4/4 ROADMAP success criteria, 11/11 REQ-S1.\*, 8/8 locked decisions. Verification at `.planning/phases/01-skeleton-oss-foundation/01-VERIFICATION.md`. Repo public at `https://github.com/CarlosHenriqueMkt/enso-brasil`. CI green, branch ruleset 15829967 active.

**Project-level decision change** (locked 2026-04-28 during SPEC): **i18n removed entirely.** Project is PT-BR only. `next-intl` dropped from stack. M12 (ES/EN translations) deleted from roadmap. Translation utilities for foreign-language ingestion (NOAA, NASA) become an ingestion-pipeline concern, decided when M5 lands.

**Project-level decision REVERSAL** (locked 2026-04-30 during P1 discuss-phase, see `.planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md` D-13): **Next.js 15.5.x pin reversed → latest stable (16.x line).** Original 16.x block was next-intl interop; with next-intl removed, the constraint is moot. Rippled to PROJECT.md, REQUIREMENTS.md, SPEC.md, CLAUDE.md.

## Phase Progression

| #   | Phase                                | Status                                                         |
| --- | ------------------------------------ | -------------------------------------------------------------- |
| 1   | Skeleton & OSS Foundation            | ✅ complete + verified (CI green, repo public, ruleset active) |
| 2   | Data Foundation                      | 📋 ready for `/gsd-discuss-phase 2`                            |
| 3   | Pure Risk Engine                     | ⏳ pending                                                     |
| 4   | First Two Adapters (CEMADEN + INMET) | ⏳ pending                                                     |
| 5   | Dashboard UI                         | ⏳ pending                                                     |
| 6   | Hardening + 3rd Source               | ⏳ pending                                                     |
| 7   | Launch                               | ⏳ pending                                                     |

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
