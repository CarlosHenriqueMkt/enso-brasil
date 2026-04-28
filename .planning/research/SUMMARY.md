# Research Summary — ENSO Brasil

> Synthesis of STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md. Read this before planning Phase 1.

## TL;DR — What changed vs the idea document

The idea document is solid in vision and ethics. Research surfaced **non-obvious infrastructural and product choices** that must be locked before Phase 1, plus six **table-stakes gaps** in v1 that came in cheap.

### Five biggest delta-from-idea-doc decisions

1. **Vercel Cron → GitHub Actions cron.** Vercel Hobby is now once-per-day max (2026). 15-min ingestion lives in GH Actions, calling a token-protected `/api/ingest` Vercel endpoint. Public OSS repo = unlimited Action minutes.
2. **Vercel KV → Upstash Redis.** Vercel KV no longer exists as a product (auto-migrated Dec 2024). Use `@upstash/redis` directly. Free tier: 500K commands/mo, 256 MB.
3. **Vercel Postgres → Neon.** Better fit for read-heavy time-series with scale-to-zero. Free 0.5 GB + 100 compute hrs.
4. **Prisma → Drizzle ORM.** Prisma's serverless cold-start cost is meaningful here.
5. **Native fetch → ofetch.** Built-in retry/timeout/status-aware retry. TS-first, isomorphic.

### Six v1 table-stakes gaps to add (low cost, high value)

1. Per-state deep-linkable URLs (`/estado/{uf}`) — WhatsApp is the distribution channel for vulnerable audiences
2. One-line plain-language explanation per state (the formula already produces this; just plumb to UI)
3. "Compartilhar" button + per-state Open Graph / Twitter cards
4. `/texto` accessible text-only route (UK Met Office pattern; serves a11y AND 3G fallback)
5. "Como calculamos isso?" link to GitHub README (transparency before M3 ships)
6. Region filter chips (Norte/Nordeste/Centro-Oeste/Sudeste/Sul) — matches Brazilian mental model

### Five must-prevent catastrophic pitfalls

1. **Silent green-by-default when sources stale.** Risk formula v0 needs an `unknown` level. Default for unknown source terms = `moderate`, NOT `low` (current spec is anti-conservative).
2. **Semiárido chronic drought painted green.** CEMADEN issues episodic alerts; chronic situations look green most days. Document as known v1 limitation; structural fix is M4.
3. **Stale snapshot during a real red alert.** Use on-demand `revalidatePath` after every poll that detects a state-level change — don't rely on time-based ISR alone.
4. **Free-tier exhaustion at worst moment.** Hobby caps reset every 30 days. Single edge-cached JSON, full static snapshot, GH Actions mirror as backup.
5. **Disclaimer in client JS.** Must be SSR-rendered. If JS fails, disclaimer must still be there.

---

## Stack — confirmed and prescriptive

| Component | Choice | Version | Confidence |
|-----------|--------|---------|------------|
| Framework | Next.js | 15.5.x (NOT 16.x — `'use cache'` + next-intl interop pending) | HIGH |
| React | React | 19.x | HIGH |
| Lang | TypeScript | 5.x strict | HIGH |
| Styling | Tailwind | v4 (Oxide engine) | HIGH |
| i18n | next-intl | latest pinned | HIGH |
| Map | react-simple-maps | pin version; fork `@vnedyalk0v/react19-simple-maps` available if maintenance lapses | MEDIUM (maintenance risk) |
| TopoJSON | `carolinabigonha/br-atlas` simplified states (~80 KB) | latest | HIGH |
| Map projection | Albers conic, parallels `[-7,-22]`, rotate `[54,0]` | — | HIGH (Mercator distorts Brazil) |
| HTTP client | ofetch (unjs) | latest | HIGH |
| Cron | GitHub Actions (NOT Vercel Hobby) | — | HIGH |
| Cache | Upstash Redis (`@upstash/redis`) | latest | HIGH |
| DB | Neon Postgres + Drizzle ORM | latest | HIGH |
| Tests | Vitest + Playwright | latest | HIGH |
| CI | GitHub Actions | — | HIGH |
| Lint/format | ESLint + Prettier + Husky | latest | HIGH |

## Architecture — 6-phase build order (Fine granularity)

```
P0 Skeleton           → Next.js + i18n + Tailwind + CI + lint + repo scaffolding + LICENSE/README/CONTRIBUTING + accessibility shell + disclaimer
P1 Data Foundation    → Drizzle + Neon schema + Upstash + ofetch wrapper + adapter contract + GH Actions cron skeleton + ingest endpoint stub
P2 Pure Risk Engine   → calculateRiskLevel() + Severity/RiskLevel types + dedup + unknown level + per-source freshness + 100% test coverage
P3 First Two Adapters → CEMADEN (undocumented endpoint, schema-validated) + INMET (CAP XML) → end-to-end flow: cron→fetch→normalize→store→snapshot→serve
P4 UI                 → Map (Albers conic) + state panel + cards (mobile) + region filter + per-state route + share + /texto fallback + a11y polish
P5 Hardening + 3rd src → INPE Queimadas OR FIRMS + observability + perf budgets + WCAG audit + free-tier headroom check + canary deploy
P6 Launch             → Domain + OG cards + Plausible analytics + Defesa Civil outreach + post-launch monitoring + README polish
```

Each phase ships a deployable increment. P2 deliberately precedes P3 — adapters are written against the engine's types.

## Critical contracts (lock before P1)

- **Risk levels:** `green | yellow | orange | red | unknown` (added `unknown`)
- **Severity:** `low | moderate | high | extreme`
- **Default for unknown source severity terms:** `moderate` (changed from spec's `low`)
- **Snapshot shape:** versioned (`formula_version: "v0"`), additive-only fields → forward-compatible for M8 public API and M11 notification diffs
- **PT-BR severity labels (locked, match CEMADEN/INMET):** "Sem alertas" / "Atenção" / "Alerta" / "Perigo"
- **Hazard names (locked, CEMADEN/INMET verbatim):** queimada (vegetação) ≠ incêndio; estiagem (moderada) vs seca (severa); enchente (urbana) vs inundação (rio)

## Source-specific gotchas (lock before P3)

| Source | Gotcha | Mitigation |
|--------|--------|-----------|
| CEMADEN | No documented public REST API; Painel de Alertas backing endpoint is undocumented | Schema-validate every poll; payload-hash anomaly detection; outreach to CEMADEN for stable endpoint |
| INMET | Alert-AS is **CAP XML**, not JSON | Use a CAP XML parser; do not assume JSON |
| INPE Queimadas | Public API exists but rate-limited and document patterns vary by region | Cache aggressively; batch by region not state |
| NASA FIRMS | 5,000 transactions / 10 min; multi-day requests count as multiple | Country-level single call, NOT per-state fan-out |
| NOAA/CPC | Used only for global ENSO status (M5, not v1) | Out of scope for v1 risk calc |

## Color and accessibility (must fix in formula v0)

- **Yellow `#eab308` on white fails WCAG AA contrast (2.34:1).** Either darken yellow OR enforce black text on yellow background, NEVER white text on yellow.
- All four risk levels must carry icon + text label + color (color is third).
- `/texto` route serves screen-reader users and 3G users with one cheap addition.

## Legal & ethics deltas

- **LGPD applies even without user accounts** (server logs, IP addresses count). v1 needs a PT-BR privacy page describing what is logged and for how long.
- **Disclaimer must be server-rendered**, present even when JS fails.
- **Anti-feature confirmed:** no user-submitted reports (USDM has CMOR-style submissions; ENSO Brasil deliberately doesn't — conflicts with aggregator-of-official-sources stance).

## What stayed unchanged

- Mission, audience, ethics, anti-features
- Open source MIT, public repo from day 1
- 15-minute ingestion cadence (just moved to GH Actions)
- v0 risk formula structure (additions only: `unknown` level, `moderate` default)
- M2–M13 milestone breakdown

## Source documents

- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`
