---
phase: 01-skeleton-oss-foundation
plan: 04
subsystem: oss-governance
tags: [oss, license, readme, contributing, security, github-templates, renovate]
requires:
  - .planning/phases/01-skeleton-oss-foundation/01-SPEC.md (D-07, D-08, D-09, D-05)
  - .planning/PROJECT.md (anti-features, locked stack, audience)
  - CLAUDE.md (mission, anti-features)
  - risk-formula-v0.md (linked from README §Como funciona)
provides:
  - LICENSE (MIT, 2026, ENSO Brasil)
  - README.md (PT-BR, 9 sections, Disclaimer with 199/193/190 + agency names)
  - CONTRIBUTING.md (PR-only workflow, Pitfall 7 admin-bypass note, anti-features)
  - CODE_OF_CONDUCT.md (Contributor Covenant 2.1, PT-BR translation, LinkedIn contact)
  - SECURITY.md (LinkedIn DM disclosure, 7-day SLA, scope)
  - .github/ISSUE_TEMPLATE/bug_report.md
  - .github/ISSUE_TEMPLATE/data_discrepancy.md (project-unique per D-08)
  - .github/ISSUE_TEMPLATE/feature_request.md (with anti-features disclaimer)
  - .github/PULL_REQUEST_TEMPLATE.md (REQ-ID linkage + 8-item checklist)
  - .github/renovate.json (config:recommended + 4 packageRules)
affects:
  - Plan 01-05 CI workflow will reference CONTRIBUTING (branch-protection workaround) and PR template
  - All future PRs gated by PR template checklist
tech-stack:
  added: []
  patterns:
    - LinkedIn DM as single contact channel (D-05) — used in SECURITY + CODE_OF_CONDUCT until P7
    - Renovate grouped weekly schedule (Mon 6am America/Sao_Paulo) with framework-major isolation
    - Anti-features list duplicated in CONTRIBUTING + feature_request template (defense in depth vs scope creep)
key-files:
  created:
    - LICENSE
    - README.md
    - CONTRIBUTING.md
    - CODE_OF_CONDUCT.md
    - SECURITY.md
    - .github/ISSUE_TEMPLATE/bug_report.md
    - .github/ISSUE_TEMPLATE/data_discrepancy.md
    - .github/ISSUE_TEMPLATE/feature_request.md
    - .github/PULL_REQUEST_TEMPLATE.md
    - .github/renovate.json
  modified: []
decisions:
  - "MIT LICENSE pinned to 2026 ENSO Brasil — matches PROJECT.md and CLAUDE.md"
  - "Contributor Covenant 2.1 PT-BR adopted with mantenedor's translation note (Assumption A3 from RESEARCH — official PT-BR translation deferred to user review)"
  - "Renovate uses both matchPackageNames and matchPackagePatterns for lint tooling group (covers eslint-* plugins and @typescript-eslint/* scoped packages)"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-01"
  tasks_total: 2
  tasks_completed: 2
  files_created: 10
  files_modified: 0
---

# Phase 1 Plan 4: OSS Files Summary

MIT-licensed public-repo scaffolding for ENSO Brasil — LICENSE, PT-BR README with all 9 D-07 sections (including Disclaimer with 199/193/190 paired with agency names), CONTRIBUTING with Pitfall 7 admin-bypass workaround, Contributor Covenant 2.1 (PT-BR), SECURITY routing disclosures to LinkedIn DM, three issue templates including the project-unique `data_discrepancy`, PR template with REQ-ID linkage and 8-item checklist, and Renovate config grouping lint/test tooling and isolating Next/React major-version PRs.

## What was built

### Task 1 — LICENSE + README (commit `d2acdbb`)

- **LICENSE:** Standard MIT text, header `MIT License` + `Copyright (c) 2026 ENSO Brasil`, full warranty disclaimer (not abbreviated).
- **README.md:** PT-BR primary, 9 H2 sections in the exact D-07 order:
  1. O que é
  2. Por quê
  3. Como funciona (links `risk-formula-v0.md`)
  4. Fontes oficiais (CEMADEN, INMET, INPE/FIRMS, NOAA — domains in inline mono code)
  5. Status (Fase 1 atual, link para ROADMAP)
  6. Como rodar localmente (corepack/pnpm/dev/test/playwright/build, Node 24 LTS)
  7. Como contribuir (link para CONTRIBUTING, mention Pitfall 7)
  8. Limitações conhecidas (5 items pulled from STATE.md Risk Watch — semiárido, CEMADEN endpoint drift, free-tier exhaustion, stale snapshot, yellow contrast)
  9. Disclaimer (literal block with all 6 emergency tokens 199/193/190 + Defesa Civil/Bombeiros/Polícia + "não substitui sistemas oficiais" + MIT 2026 footer)
- No anti-features mentioned. No `next-intl`/`i18n`/locale routing/EN README references.

### Task 2 — Governance + GH templates + Renovate (commit `248a9a2`)

- **CONTRIBUTING.md:** Sections covering PR-only workflow (D-09), local run, code standards (TS strict, ESLint, Prettier, conventional commits), pre-commit (Husky + lint-staged + gitleaks with install instructions), branch protection with verbatim Pitfall 7 admin-bypass note, issue templates list, security disclosure pointer, and full anti-features rejection list.
- **CODE_OF_CONDUCT.md:** Contributor Covenant 2.1 PT-BR translation (mantainer's translation per Assumption A3, with disclaimer at top), canonical contact = LinkedIn URL.
- **SECURITY.md:** PT-BR, "Política de segurança" heading, LinkedIn DM channel, "NÃO abra issue público", 7-day SLA, in-scope/out-of-scope sections, P7 transition note for future email channel.
- **3 issue templates** (all PT-BR with frontmatter): bug_report, data_discrepancy (project-unique, with state UF + official source citation + verification time), feature_request (with mandatory anti-features disclaimer block).
- **PR template:** "O que muda" / "Requirement linkado" (with REQ-ID example) / "Checklist" with 8 boxes (tsc, lint, test, playwright, no secrets, messages.ts, theme tokens, STATE.md).
- **renovate.json:** valid JSON, `config:recommended` preset, weekly Monday schedule, America/Sao_Paulo TZ, 4 packageRules: lint tooling (with both matchPackageNames + matchPackagePatterns for eslint-* and @typescript-eslint/*), test tooling, framework-major (with `needs-review` label), framework-minor.

## Acceptance criteria — all pass

- LICENSE non-empty, contains MIT License + 2026 ENSO Brasil + WITHOUT WARRANTY (each grep returns 1).
- README has all 9 H2 sections (single grep returned 9).
- All 6 emergency tokens (199, 193, 190, Defesa Civil, Bombeiros, Polícia) present.
- "não substitui sistemas oficiais" literal phrase present (verified after one minor edit — initial version had capital N).
- No anti-feature words (user accounts, comments, forecasting, affiliate, shopping) in README.
- No next-intl / i18n / locale routing / README.en.md references.
- All 8 OSS files non-empty.
- Contributor Covenant + 2.1 + LinkedIn URL in CODE_OF_CONDUCT.
- LinkedIn URL in SECURITY.
- "admin-bypass" + "gitleaks" in CONTRIBUTING.
- "data-discrepancy" label in data_discrepancy template.
- All 3 issue templates have correct `name:` frontmatter.
- PR template contains REQ- and 3+ pnpm verification commands.
- renovate.json parses; extends includes `config:recommended`; groupNames include lint tooling + test tooling + framework-major.
- `.github/FUNDING.yml` does not exist.

## Deviations from plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] "não substitui sistemas oficiais" capitalization**

- **Found during:** Task 1 verification.
- **Issue:** Initial README draft had `**Não substitui sistemas oficiais de alerta.**` (capitalized N) inside the §O que é paragraph — the literal lowercase phrase required by acceptance criteria (`grep -Fc "não substitui sistemas oficiais"` returns >= 1) was missing. The Disclaimer block has the bold capitalized version, but the criterion uses case-sensitive `grep -F`.
- **Fix:** Reworded the §O que é sentence so the lowercase phrase appears mid-sentence: "...não um sistema de alerta oficial — **não substitui sistemas oficiais de alerta**...". Disclaimer block kept verbatim.
- **Files modified:** README.md
- **Commit:** included in `d2acdbb` (single-pass commit after fix).

No other deviations. Anti-features list, Renovate package rules, and Pitfall 7 verbatim copy all match the plan exactly.

## Authentication gates

None — pure docs/templates plan, no external services touched.

## TDD Gate Compliance

N/A — plan has `tdd="false"` on both tasks (governance/docs only).

## Self-Check: PASSED

Files verified to exist:

- FOUND: LICENSE
- FOUND: README.md
- FOUND: CONTRIBUTING.md
- FOUND: CODE_OF_CONDUCT.md
- FOUND: SECURITY.md
- FOUND: .github/ISSUE_TEMPLATE/bug_report.md
- FOUND: .github/ISSUE_TEMPLATE/data_discrepancy.md
- FOUND: .github/ISSUE_TEMPLATE/feature_request.md
- FOUND: .github/PULL_REQUEST_TEMPLATE.md
- FOUND: .github/renovate.json

Commits verified in git log:

- FOUND: d2acdbb (Task 1 — LICENSE + README)
- FOUND: 248a9a2 (Task 2 — governance + templates + Renovate)
