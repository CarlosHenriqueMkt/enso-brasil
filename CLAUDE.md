# ENSO Brasil — Project Guide for Claude

> Aggregator dashboard for Brazilian climate hazards via official APIs (CEMADEN, INMET, INPE/FIRMS, NOAA). Public, open source, zero budget. Read this before any work.

## Mission

Deliver clear, accessible information in PT-BR that helps Brazilians in vulnerable regions understand the climate risks of their state. Focus on **anomalies and events with potential to cause deaths or serious losses**.

This project is **public-safety adjacent**. Be conservative. Errors should fail toward over-warning, never under-warning.

## How we work

This project uses **Get Shit Done (GSD)**. Workflow is `discuss → plan → execute → verify` per phase. Settings in `.planning/config.json`:

- YOLO mode (auto-approve gates)
- Fine granularity (7 phases for v1)
- Parallel execution on
- Research, plan-check, verifier all on

Always start with `.planning/STATE.md` to know the current phase, then `.planning/ROADMAP.md` for phase-specific goals and success criteria.

## Source-of-truth files (read these before substantive changes)

| File | When to read |
|------|--------------|
| `.planning/PROJECT.md` | Vision, audience, locked decisions, key decisions table |
| `.planning/REQUIREMENTS.md` | All v1 REQ-IDs |
| `.planning/ROADMAP.md` | Phase breakdown + success criteria |
| `.planning/STATE.md` | Current phase, status, open decisions |
| `.planning/research/SUMMARY.md` | What changed vs the original idea doc — load-bearing |
| `risk-formula-v0.md` | Risk formula contract. Apply v0.1 corrections from SUMMARY: `unknown` level + `moderate` default for unknown source terms |
| `gsd-new-project-prompt.md` | Original idea document — preserved for traceability |

## Locked decisions (do not relitigate without `/gsd-new-milestone`)

- Stack: Next.js latest stable (16.x line, locked-decision reversed in P1 CONTEXT — original 16.x block was next-intl interop, now moot since next-intl is removed) + TypeScript strict + Tailwind v4 + react-simple-maps. **NO `next-intl` — PT-BR only, no i18n routing.** Translation utilities live in ingestion pipeline (deferred to M5+).
- Hosting: Vercel free tier (Functions only — **NOT** Vercel Cron, **NOT** Vercel KV, **NOT** Vercel Postgres)
- Cron: **GitHub Actions** every 15 min → token-protected `/api/ingest`
- Cache: **Upstash Redis** (`@upstash/redis`)
- DB: **Neon Postgres** + **Drizzle ORM**
- HTTP: **ofetch** (unjs)
- Map: **Albers conic** projection, parallels [-7, -22], rotate [54, 0], using `carolinabigonha/br-atlas` simplified TopoJSON
- Risk levels: `green | yellow | orange | red | unknown` (5, including `unknown`)
- Default severity for unknown source terms: `moderate` (NOT `low`)
- PT-BR severity labels (verbatim): "Sem alertas / Atenção / Alerta / Perigo / Dados indisponíveis"
- Hazard names follow CEMADEN/INMET vocabulary verbatim (queimada vs incêndio; estiagem vs seca; enchente vs inundação)
- Disclaimer must be SSR-rendered. LGPD privacy page mandatory.
- Open source MIT from commit 1. PT-BR README primary, EN secondary.

## Anti-features (never)

- User accounts, social, comments, user-submitted reports
- Forecasting model
- Affiliate links / shopping / brand recommendations / commerce
- Analytics that track individuals
- Replacing Defesa Civil / CEMADEN as official alert systems

## Auto-loaded skills

- **Sketch findings for enso-brasil** (validated design decisions, CSS patterns, theme tokens, locked PT-BR copy, hard UI contracts) → `Skill("sketch-findings-enso-brasil")`. Auto-load this whenever building UI for ENSO Brasil (Phase 1 disclaimer/layout shell, Phase 5 dashboard, any future UI milestone).

## Running GSD commands

- `/gsd-progress` — see current phase and next action
- `/gsd-discuss-phase N` — clarify approach before planning a phase
- `/gsd-plan-phase N` — produce PLAN.md for a phase
- `/gsd-execute-phase N` — execute the plan with atomic commits
- `/gsd-verify-work` — UAT after a phase finishes
- `/gsd-help` — full command list

## When in doubt

- **Does the user need this in v1?** Check REQUIREMENTS.md. If not there, it's deferred — push back.
- **Is this an aggregator action or an authority action?** If it's authority (deciding alerts), it's out of scope.
- **Does this expose vulnerable users to harm via misinformation?** If yes, escalate to the user. Conservative wins.
- **Does this break the v0 risk formula contract?** Don't change the formula without versioning it (`v1`, `v2`...).

## Notes for this environment

The GSD SDK (`gsd-sdk` CLI) failed to install fully on this Windows machine. Planning files were scaffolded manually but they are valid and complete. Subsequent `/gsd-*` slash commands read directly from `.planning/` and should work. If the SDK is fixed later, no rework is needed.
