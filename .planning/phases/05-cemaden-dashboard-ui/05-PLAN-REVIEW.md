# Phase 5 Plan Review

**Reviewer:** gsd-plan-checker
**Date:** 2026-05-18
**Verdict:** PASS_WITH_FIXES (7 targeted edits, no replan)

## Coverage Matrix (17 requirements)

All 17 covered. No gaps.

| REQ                            | Plans                  |
| ------------------------------ | ---------------------- |
| ADAPT-01 (CEMADEN)             | 03 + 04 + 06           |
| ADAPT-02 (INMET P5.1 fix)      | 05                     |
| DASH-01..10                    | 07 / 08 / 09 / 10 / 11 |
| A11Y-01..06                    | 07 / 08 / 11 / 12      |
| DATA-04                        | 06                     |
| DATA-07 / FOUND-08 (staleness) | 07 + 10                |

## Findings

### BLOCKER

- **B-1** — `05-RESEARCH.md:1037` heading `## Open Questions for the Planner` triggers Dim-11 gate. All 5 Qs ARE answered in plans (Q1→02, Q2→01, Q3→01, Q4→02, Q5→03/07) but heading suggests otherwise.
  - **Fix:** rename heading to `## Open Questions for the Planner (RESOLVED)` + add per-question `RESOLVED:` markers citing plan.

### HIGH

- **H-1** — Plan 02 Task 2 forbids editing `05-CONTEXT.md` in place. D-04 audit-trail leak: future readers hit stale `-03:00` text first. Public-safety risk on AC/AM/Brasília fusos.
  - **Fix:** add `> SUPERSEDED 2026-05-18 — see 05-02-CONTEXT-corrections.md` line above D-04 block in CONTEXT.md.
- **H-2** — Plan 10 `depends_on` must include `"05-06"` explicitly. Parallel Wave 3 without this dep lets `/api/ingest` run before CEMADEN registered.
  - **Fix:** confirm `depends_on: ["05-06","05-08","05-09"]` in plan 10 frontmatter.
- **H-3** — Plan 11 Task 1 contradicts: `generateStaticParams` emits lowercase but claims case-insensitivity. Next.js 404s uppercase.
  - **Fix:** drop case-insensitivity; lowercase-only for v1.
- **H-4** — Plan 08 spike-pivot to `d3-geo` preserves "same props contract" but no DOM invariant. Plan 10's `grep -c '<path'` verify breaks if pivot taken.
  - **Fix:** append DOM invariant `27 × <a href="/estado/{uf}"><path/></a>` to Task 3.

### MEDIUM

- **M-1** — LHCI `slow4G` preset vs SPEC "3G profile" label mismatch. Functionally equivalent; document in SUMMARY.
- **M-2** — Plan 09 T-05-16 credits plan 10 for `?region=` validation. Cross-plan but correct.
- **M-3** — Plan 03 defers `enchente` vs `alagamento` to executor.
  - **Fix:** lock `Risco Hidrológico → enchente`.
- **M-4** — Plan 02 invents `"deslizamento de terra"` noun phrase. CLAUDE.md vernacular rule.
  - **Fix:** use bare `"deslizamento"`.
- **M-5** — Plan 04 contract test never exercises `Movimento de Massa`/`Muito Alto` (not in captured fixture); unit tests cover synthetically. Note in SUMMARY; non-blocking.
- **M-6** — `revalidate = 30` + total-failure floor chain verified correct.

### LOW

- **L-1** — Plan 01 spike-scaffolding deletion not asserted.
  - **Fix:** add `test ! -d src/app/__spike && test ! -d tests/spike && test ! -d scripts/spike`.
- **L-2** — Plan 06 Task 3 stub-replacement may surface P4-era stub coupling; executor risk.
- **L-3** — Plan 11 `/texto` "Alertas ativos" count source unspecified.
  - **Fix:** lock to `snapshot[uf].alerts.length` post-dedup.
- **L-4** — Plan 12 200 KB budget tight given ~50 KB TopoJSON; monitor at checkpoint.

### INFO

- **I-1** — Hazard mapping conservatism (throw on unknown): good.
- **I-2** — Single-source-of-truth `messages.ts`: good.
- **I-3** — Locked PT-BR copy preserved verbatim: good.

## Cross-Cutting (all PASS)

- Anti-features absent: `next-intl`, analytics, accounts, Web Share API, geo-IP defaults
- Single CEMADEN call enforced
- Wave 2 file ownership disjoint (04=tests/sources, 07=time/badge/staleness, 08=geo/map, 09=cards/filters/share)
- Threat model present in all 12 plans
- Nyquist verify present on every task
- D-04 contradiction handled via `<rewrites>` block (H-1 is the audit-trail leak only)
- Total-failure floor copy quotes UI-SPEC verbatim
- `?region=` validated via allowlist enum (plan 10)
- Share text uses `encodeURIComponent` + injection test (plan 09)
- `#formula-v0` anchor created (plan 02) + lychee CI gate (plan 11)
- No skeleton loader; no 27-prefetch storm (`prefetch={false}`)

## Iteration: 7 Targeted Edits

1. `05-RESEARCH.md:1037` — heading `(RESOLVED)` + per-Q markers
2. `05-02-PLAN.md` Task 2 — insert `> SUPERSEDED` line above D-04 in CONTEXT.md
3. `05-10-PLAN.md` frontmatter — `depends_on` includes `"05-06"`
4. `05-11-PLAN.md` Task 1 — drop case-insensitivity; lowercase-only
5. `05-08-PLAN.md` Task 3 — append DOM invariant
6. `05-03-PLAN.md` Task 2 — lock `Risco Hidrológico → enchente`
7. `05-02-PLAN.md` Task 1 — `"deslizamento de terra"` → `"deslizamento"`

After fixes: PASS. Wave 0 can begin.
