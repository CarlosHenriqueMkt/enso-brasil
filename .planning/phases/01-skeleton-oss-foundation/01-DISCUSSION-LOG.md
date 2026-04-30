# Phase 1: Skeleton & OSS Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 1-Skeleton & OSS Foundation
**Areas discussed:** Repo structure + package manager, Secret scan strategy, /privacidade content + contact, README depth + repo polish, Tech stack specifics

---

## Repo structure + package manager

### Q1.1 — Repo layout

| Option | Description | Selected |
|--------|-------------|----------|
| Flat root Next.js app (Recommended) | Single package.json at repo root, app/ src/ etc. directly under root. Simpler for OSS contributors. | ✓ |
| apps/web + future packages/ | pnpm/npm workspaces from day 1. Premature for v1 — SPEC says no separate packages in P1–P7. | |

**User's choice:** Flat root with `src/` directory layout (`src/app/`, `src/components/`, etc.).
**Notes:** User specified "src/app/, src/components..." pattern explicitly. Locked as D-01.

### Q1.2 — Package manager + Node version

| Option | Description | Selected |
|--------|-------------|----------|
| pnpm + Node 20 LTS (Recommended) | pnpm fast, disk-efficient, strict node_modules. Vercel native support. | |
| npm + Node 22 LTS | Lowest contributor friction. SPEC's `npm install` matches without edit. | |
| bun + Node 22 LTS | Fastest install. Vercel build still uses npm/pnpm under the hood; rough edges remain. | |

**User's choice:** pnpm + Node 24 LTS (free-text override of recommended Node 20).
**Notes:** Node 24 became Active LTS in Oct 2025. SPEC delta: REQ-S1.02 acceptance text "`npm install`" must update to "`pnpm install`". Locked as D-02 + D-03.

---

## Secret scan strategy

### Q2.1 — Tool choice

| Option | Description | Selected |
|--------|-------------|----------|
| gitleaks (Recommended) | Battle-tested OSS, curated rules, sane defaults, MIT. | ✓ |
| Inline regex per SPEC | Simple `[A-Z_]+_KEY|TOKEN|SECRET`. Trivially bypassable, high false-positive. | |
| Both: regex pre-commit + gitleaks CI | Defense in depth. Slightly more config to maintain. | |

**User's choice:** gitleaks.
**Notes:** SPEC delta: REQ-S1.05 regex rule replaced by gitleaks. Locked as D-04.

### Q2.2 — Scan location

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-commit + CI on every PR (Recommended) | Defense in depth. CI is the enforcement gate. | ✓ |
| Pre-commit only | Per SPEC literal. `--no-verify` bypass risk for public repo. | |
| CI only | No local friction. Bad commit lands in history before catch — public repo = mandatory rotation. | |

**User's choice:** Pre-commit + CI on every PR.

---

## /privacidade content + contact

### Q3.1 — LGPD contact

| Option | Description | Selected |
|--------|-------------|----------|
| Use falacom.ocarlos@gmail.com | Real personal email. Will be scraped by spam. | |
| Stub privacidade@enso.com.br + GitHub Issues fallback | Forward-looking; non-compliant until forwards. | |
| GitHub Issues as primary contact | Transparent; works for 1-person OSS; interim until P7. | |

**User's choice:** LinkedIn URL `https://www.linkedin.com/in/carloshenriquerp/` (free-text, all options bypassed).
**Notes:** Single contact channel for everything (LGPD direitos, security disclosure, general). Locked as D-05.

### Q3.2 — Version field format

| Option | Description | Selected |
|--------|-------------|----------|
| Date only — "Versão de 29 de abril de 2026" (Recommended) | PT-BR-natural, single source of truth in messages.ts. | ✓ |
| Semver + date — "v0.1 · 29/04/2026" | Useful with grandfathered users; ENSO has no accounts. | |

**User's choice:** Date only, PT-BR.

---

## README depth + repo polish

### Q4.1 — README depth in P1

| Option | Description | Selected |
|--------|-------------|----------|
| Lean stub (Recommended) | Just pitch + links to .planning/. Full README at P7. | |
| Full PT-BR draft now | All sections drafted; P7 only refines. Risk: documents nonexistent features. | ✓ |
| Minimal "em construção" placeholder | Just enough to not look abandoned. Underwhelming. | |

**User's choice:** Full PT-BR draft now.
**Notes:** User wants the public face strong from day 1. Acceptable — SPEC doesn't constrain README depth. Locked as D-07.

### Q4.2 — OSS polish files (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| SECURITY.md (vulnerability disclosure via LinkedIn) | Standard OSS signal. | ✓ |
| GitHub Issue + PR templates | Bug, data discrepancy, feature templates + PR checklist. | ✓ |
| Branch protection on main + require PR review | 1 approver + CI green. Solo dev = every change PRed. | ✓ |
| .github/FUNDING.yml | Sponsors button. Free. | |

**User's choice:** SECURITY.md + Issue/PR templates + branch protection. NOT FUNDING.yml.
**Notes:** Locked as D-08, D-09. FUNDING.yml deferred to P7 review.

---

## Tech stack specifics

### Q5.1 — Stack scope still open (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Exact dep versions + lockfile pins | engines field, pin ranges, transitive overrides. | ✓ |
| Tooling adjuncts (Storybook, Knip, Madge, Biome) | Optional dev tooling. | ✓ |
| Vercel project config (next.config.ts, env strategy) | Minimal config now, env example committed. | ✓ |
| Nothing new — skip | | |

### Q5.2 — Pin strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Caret ^ + pnpm-lock.yaml (Recommended) | Lockfile is CI source of truth. Renovate/Dependabot for bumps. | ✓ |
| Tilde ~ patch-only | Stricter. More PR noise. | |
| Exact pins | Maximum determinism. Heavy maintenance. | |

**User's choice:** Caret ^ + lockfile committed. Locked as D-03.

### Q5.3 — Lint/format tool

| Option | Description | Selected |
|--------|-------------|----------|
| ESLint + Prettier (per SPEC, Recommended) | Mature, ecosystem-standard. | ✓ |
| Biome (single tool, ~10x faster) | Smaller plugin ecosystem; SPEC delta required. | |

**User's choice:** ESLint + Prettier. Biome deferred. Locked as D-10.

### Q5.4 — Dev tooling adjuncts (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Knip (unused exports/deps) | Catches dead code/deps in CI. | ✓ |
| Renovate or Dependabot | Auto dep PRs. Pick one. | |
| Skip Storybook + Madge for P1 | Storybook = P5; Madge unnecessary at this size. | ✓ |

**User's choice:** Knip + skip Storybook/Madge + free-text "Todos os Packages @latest LTS. Ex: Next.js 16.4.x".
**Notes:** Free-text triggered Q5.5 (Next.js version reversal). Locked as D-11, D-14. Renovate selected by Claude in D-03 (defaulted, user did not pick between Renovate/Dependabot — Claude chose Renovate for grouped PRs).

### Q5.5 — next.config.ts + env loading

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal (Recommended) | reactStrictMode, default output, no images domains, .env.example. | ✓ |
| Standalone output + image domains stub | Premature. | |

**User's choice:** Minimal. Locked as D-12.

### Q5.6 — Confirm: override PROJECT.md locked decision (Next 15.5.x → latest stable, e.g., 16.x)?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — reverse to latest stable. Original block (next-intl) gone. | Update PROJECT.md + SPEC.md + CLAUDE.md ripple. | ✓ |
| Keep Next 15.5.x | Stick with PROJECT.md lock. | |
| Pick latest stable per dep individually during plan-phase | Defer to gsd-planner with rule. | |

**User's choice:** Reverse to latest stable.
**Notes:** Locked decision REVERSAL. Same propagation pattern as next-intl removal (commit c23a2a0). Locked as D-13. Ripple writes performed in this discussion's commit.

---

## Claude's Discretion

- Exact `eslint-config-next` rule overrides — Claude picks reasonable defaults.
- `next.config.ts` minor flags beyond `reactStrictMode` — Claude picks per Next 16 best practices.
- Husky + lint-staged exact wiring — Claude picks idiomatic config.
- Prettier rules — Claude picks community defaults; documented in `.prettierrc`.
- Issue / PR template exact wording — Claude drafts in PT-BR; user reviews in PR.
- Renovate vs Dependabot — Claude picked Renovate (grouped weekly PRs).

## Deferred Ideas

- `.github/FUNDING.yml` — revisit at P7.
- Biome — revisit when `eslint-plugin-tailwindcss` parity exists.
- `output: 'standalone'` — P6 hardening.
- Image domains config — P5.
- Email-based LGPD contact (replace LinkedIn) — P7 when domain bought.
- Storybook — P5 when components exist.
- Dependabot vs Renovate — switching cost is low; revisit if Renovate noisy.
