# Phase 1: Skeleton & OSS Foundation - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Public, accessible, MIT-licensed Next.js skeleton on Vercel free tier. Disclaimer footer (199/193/190 + agency names) and `/privacidade` LGPD page render server-side. Lean CI green on every PR. Theme tokens applied via `@theme`. **No data flow, no risk engine, no source adapters, no dashboard UI** — those land in P2–P5.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**11 requirements are locked.** See `01-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `01-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Public GitHub repo + MIT LICENSE + README (PT-BR) + CONTRIBUTING + CODE_OF_CONDUCT
- Next.js latest-stable App Router scaffolding (TS strict, Tailwind v4, React 19) — *version line revised, see D-13*
- Theme tokens applied via `@theme` (sketch-findings palette + spacing + radii + system fonts)
- Root layout with SSR disclaimer footer (199/193/190 with agency names)
- `/privacidade` page in PT-BR draft completo
- Accessibility shell (lang attribute, skip link, focus styles, reduced motion)
- ESLint + Prettier + Husky + lint-staged + secret scan
- GitHub Actions CI: typecheck + lint + Vitest + Playwright smoke (1 test)
- `src/lib/messages.ts` strings module (locked PT-BR constants)
- `src/components/SourceLink.tsx` (mono-font domain rendering)

**Out of scope (from SPEC.md):**
- Data layer (Drizzle, Neon, Upstash, ofetch, ingestion endpoint) — Phase 2
- Risk engine — Phase 3
- Source adapters (CEMADEN, INMET, INPE/FIRMS) — Phases 4 & 6
- Dashboard UI — Phase 5
- `next-intl` / i18n routing — REMOVED from project entirely
- Translation utilities — deferred to M5+
- axe-core in CI — Phase 5
- Lighthouse perf budget — Phase 6
- Plausible analytics — Phase 7
- OG cards / share intents — Phase 5
- Production domain — Phase 7
- Defesa Civil estadual lookup — Phase 5
- `/api/health` endpoint — Phase 6

**SPEC deltas captured during this discussion (apply before plan-phase):**
- REQ-S1.02: `next@~15.5.0` → `next@^16` (latest stable). Rationale below in D-13.
- REQ-S1.02: Acceptance text "`npm install`" → "`pnpm install`" per D-02.
- REQ-S1.05: "simple regex `[A-Z_]+_KEY|TOKEN|SECRET`" → gitleaks (pre-commit + CI). See D-04.
- Acceptance criteria checklist line "`npm install && npm run build`" → "`pnpm install && pnpm build`".

</spec_lock>

<decisions>
## Implementation Decisions

### Repo structure & toolchain
- **D-01:** Flat root Next.js app — no monorepo. Layout: `src/app/`, `src/components/`, `src/lib/`. Future packages, if any, deferred to whenever a real second deployable surface exists.
- **D-02:** **pnpm** as package manager. **Node 24 LTS** pinned via `.nvmrc` + `engines.node >= 24` + `packageManager: pnpm@<latest>` in `package.json`. CI uses `pnpm install --frozen-lockfile`.
- **D-03:** Caret `^` ranges in `package.json` + `pnpm-lock.yaml` committed. Lockfile is source of truth in CI. Renovate (preferred over Dependabot) wired with grouped weekly schedule.

### Secret scan
- **D-04:** **gitleaks** for secret detection. Runs in **two places**: Husky pre-commit (via lint-staged or direct hook) + GitHub Actions CI on every PR. Default ruleset; no custom tuning for v1. Pre-commit failure blocks commit; CI failure blocks merge.

### Privacy page (`/privacidade`)
- **D-05:** Contact channel for **all** matters (LGPD requests, security disclosure, general contact) = LinkedIn URL `https://www.linkedin.com/in/carloshenriquerp/`. Page text states explicitly that LGPD direitos (acesso, correção, exclusão) are exercised via this channel during v1; transitions to email at P7 if domain lands.
- **D-06:** Version field format: **date only, PT-BR natural** — e.g., "Versão de 30 de abril de 2026". Single source of truth in `src/lib/messages.ts` (`messages.privacy.version`).

### README, OSS polish & branch hygiene
- **D-07:** **Full PT-BR README draft** ships in P1 (not lean stub). Sections: O que é, Por quê, Como funciona (fórmula link), Fontes oficiais (links), Status (em construção, fase atual), Como rodar localmente, Como contribuir, Limitações conhecidas, Disclaimer + emergency contacts. P7 only refines wording and adds screenshots.
- **D-08:** **OSS files shipped in P1:** `SECURITY.md` (vulnerability disclosure → LinkedIn DM), GitHub Issue templates (bug report, **data discrepancy**, feature request), Pull Request template (checklist: tests / types / no secrets / linked requirement ID). **No** `.github/FUNDING.yml` in P1.
- **D-09:** **Branch protection on `main` from day 1.** Require: 1 PR review, all CI checks green, linear history (no merge commits), no force-push, no self-approval. Solo dev workflow = every change goes through a PR (acceptable friction for a public-safety-adjacent OSS project).

### Tech stack specifics
- **D-10:** **Lint/format = ESLint + Prettier** (per SPEC). Biome rejected for v1 — smaller plugin ecosystem, no `eslint-plugin-tailwindcss` equivalent in 2026.
- **D-11:** **Knip** added to CI for unused-exports/dead-deps detection. Storybook + Madge skipped (Storybook = P5, Madge unnecessary at this size).
- **D-12:** **`next.config.ts` minimal:** `reactStrictMode: true`, default output (no `standalone`), no `images.domains` yet. Env via `.env.local` (gitignored) + `.env.example` (committed, no secrets, documents required vars). No env vars actually consumed in P1 — schema lives in P2 when ingestion lands.
- **D-13:** **Next.js version locked decision REVERSED.** Move from `next@~15.5.0` to `next@^16` (latest stable LTS line). **Why:** Original 16.x block in PROJECT.md was "`'use cache'` does not integrate cleanly with next-intl". Next-intl was dropped from the project during the SPEC phase (commit c23a2a0). With next-intl gone, the only blocker for 16.x is gone. **Ripple writes** (this discussion's commit will perform them):
  - `.planning/PROJECT.md` — Key Decisions row updated.
  - `.planning/phases/01-skeleton-oss-foundation/01-SPEC.md` — Goal line, locked-decisions list, REQ-S1.02 target state, In-Scope bullet, acceptance pnpm fix.
  - `.planning/REQUIREMENTS.md` — FOUND-02 text updated.
  - `CLAUDE.md` — stack line updated.
  - `.planning/research/STACK.md` and `.planning/research/SUMMARY.md` — historical research; add a note that the constraint was lifted, do NOT rewrite (preserve research provenance).
- **D-14:** All other deps follow rule **"latest stable as of 2026-04-30"** unless otherwise locked: React 19.x, Tailwind v4 latest, TypeScript ^5 latest, Vitest latest, Playwright latest, Husky latest, Prettier latest, ESLint latest with `eslint-config-next` matching Next 16. Planner verifies live npm + writes pinned versions to PLAN.md.

### Claude's Discretion
- Exact `eslint-config-next` rules beyond defaults (e.g., enable/disable specific rules) — Claude picks reasonable defaults; user can amend post-execute.
- `next.config.ts` minor flags not enumerated above (e.g., `poweredByHeader: false`, `experimental.typedRoutes`) — Claude picks per Next 16 best practices.
- Husky + lint-staged exact glob/command wiring — Claude picks idiomatic config.
- Prettier rules (print width, tabs vs spaces, trailing comma) — Claude picks community defaults; document in `.prettierrc` for transparency.
- Issue / PR template exact wording — Claude drafts in PT-BR; user reviews in PR.

### Folded Todos
None — no pending todos matched this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase-locking specs
- `.planning/phases/01-skeleton-oss-foundation/01-SPEC.md` — **Locked requirements (11). MUST read before planning.** Apply SPEC deltas listed in `<spec_lock>` above.
- `.planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md` — this file.

### Project-level locks
- `.planning/PROJECT.md` — Locked Key Decisions table (stack, hosting, cache, DB, HTTP, map, risk levels, PT-BR-only).
- `.planning/REQUIREMENTS.md` — All v1 REQ-IDs (FOUND, DATA, RISK, ADAPT, DASH, A11Y, DEPLOY).
- `.planning/ROADMAP.md` §"Phase 1 — Skeleton & OSS Foundation" — Phase goal + success criteria.
- `CLAUDE.md` — Project guide; locked decisions; anti-features.

### Design tokens, copy, hard rules (auto-loaded skill)
- `.claude/skills/sketch-findings-enso-brasil/SKILL.md` — Overall design direction + hard rules.
- `.claude/skills/sketch-findings-enso-brasil/references/03-tokens-theme.md` — **Source of truth for `@theme` block** (surfaces, ink, hairlines, INMET-aligned 5-level risk palette, 8pt spacing, radii 2/4/6, system-font stack, Tailwind v4 port snippet).
- `.claude/skills/sketch-findings-enso-brasil/references/01-layout-composition.md` — Layout / disclaimer composition.
- `.claude/skills/sketch-findings-enso-brasil/references/02-edge-states-source-trust.md` — Edge-state PT-BR copy + stale-data banner contract.
- `.claude/skills/sketch-findings-enso-brasil/references/04-page-architecture-and-states.md` — Page architecture (cards, top legend, banners, footer disclaimer).

### Research provenance (do not rewrite; reference only)
- `.planning/research/SUMMARY.md` — Five biggest deltas from idea doc; stack confirmation.
- `.planning/research/STACK.md` — Per-dep rationale (Next, Tailwind, ofetch, Drizzle, Neon, Upstash, react-simple-maps).
- `risk-formula-v0.md` — Risk formula contract (not used in P1 but referenced in README).
- `gsd-new-project-prompt.md` — Original idea document (traceability).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
None — repository has no `package.json`, no `src/`, no `app/` yet. P1 builds the skeleton from zero.

### Established Patterns
- Planning artifacts live under `.planning/` (PROJECT, REQUIREMENTS, ROADMAP, STATE, phases/, research/, sketches/).
- Sketch design system already crystallized into a project-local skill (`.claude/skills/sketch-findings-enso-brasil/`). Implementation MUST consume this skill, not invent visual decisions.
- Decision-reversal pattern (used for next-intl removal during SPEC phase, commit c23a2a0): same artifact updated in one commit propagates to PROJECT/REQUIREMENTS/ROADMAP/STATE/CLAUDE.md/skill. D-13 follows the same pattern.

### Integration Points
- `src/lib/messages.ts` is the **single PT-BR string source**. Phase 2+ (data layer error states), Phase 5 (dashboard UI), Phase 6 (stale-data banners) all import from here. Schema must be flat-enough that future edge-state additions don't require refactor.
- `src/components/SourceLink.tsx` will be reused on every page that links to an official source (CEMADEN, INMET, IBGE, Defesa Civil, NOAA). P1 uses it on `/privacidade` if a contact-source link is rendered. P5 uses it inside cards.
- Root `app/layout.tsx` SSR disclaimer footer is the contract every future page inherits. Footer composition must NOT depend on client JS.

</code_context>

<specifics>
## Specific Ideas

- **Disclaimer copy is locked verbatim** in sketch-findings (rule: never bare numbers, always paired with agency names — "199 Defesa Civil · 193 Bombeiros · 190 Polícia"). Implementation pulls from `messages.disclaimer` and `messages.emergency.inline`.
- **System fonts only** — zero external font files. Verified by `grep -r "fonts.googleapis" .next/` returning empty (already in SPEC acceptance).
- **Albers conic projection** is for the map (P5), not P1. Mentioned only so map atlas dependency stays out of P1's `package.json`.
- **Risk palette tokens** include 5 levels (`green | yellow | orange | red | gray`) with `bg / border / ink` triplets — wired into `@theme` even though risk engine doesn't ship until P3. Reason: tokens are the design contract, not implementation-coupled.
- **Yellow contrast caveat** (sketch-findings): bespoke `#d4a017` border + black ink only. CSS comment in `globals.css` calling this out.

</specifics>

<deferred>
## Deferred Ideas

- `.github/FUNDING.yml` (Sponsors button) — considered, rejected for P1. Revisit at P7 launch if it fits the OSS positioning.
- Biome as ESLint+Prettier replacement — revisit when `eslint-plugin-tailwindcss` parity exists or Tailwind ships first-party Biome support.
- `output: 'standalone'` for smaller Vercel cold starts — consider in P6 hardening.
- Image domains pre-config — defer to P5 when actual remote images appear.
- Email-based LGPD contact channel (replace LinkedIn) — P7 when domain is purchased.
- Storybook for components — P5 when dashboard components exist.
- Dependabot vs Renovate — picking Renovate now, but no strong commitment; switch is cheap.

### Reviewed Todos (not folded)
None — no pending todos surfaced for this phase.

</deferred>

---

*Phase: 1-Skeleton & OSS Foundation*
*Context gathered: 2026-04-30*
