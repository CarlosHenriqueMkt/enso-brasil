# ENSO Brasil

## What This Is

A public Portuguese-language dashboard that surfaces, per Brazilian state, the active climate hazards related to the ENSO cycle (El Niño / La Niña / Neutral). Aggregates official sources (CEMADEN, INMET, INPE, NASA FIRMS, NOAA/CPC) into a single accessible view. Open source, zero-budget, free-tier hosted.

## Core Value

**The ONE thing that must work:** A person in a vulnerable region (encosta, margem de rio, Semiárido) opens the site on a 3G phone, picks their state, and within seconds sees — in plain Portuguese — whether there are active official hazard alerts where they live, what kind, and where the information came from.

If only this works, the project has shipped.

## Context

**Climate moment (April 2026):** NOAA Final La Niña Advisory + El Niño Watch. ENSO-neutral with transition to El Niño expected May–Jul 2026, persisting through end of 2026, with significant chance of a strong event. Architecture must be flexible across the entire ENSO cycle, not hardcoded for El Niño.

**Audience (priority order):**
1. People in fragile locations (slopes, riverbanks, drought-prone Semiárido, flood-prone urban areas)
2. Small rural producers / farmers dependent on climate forecasts
3. Curious citizens wanting to understand if extreme events relate to ENSO

**Language:** PT-BR, simple, jargon-translated. Architecture i18n-ready (`next-intl`) for later ES/EN expansion.

**Stance:** Aggregator of official sources, **not** an alert system. Defesa Civil and CEMADEN are the official systems. Strong disclaimer on every page.

## Requirements

### Validated

(None yet — greenfield. Validation happens by shipping v1 and observing real-user behavior.)

### Active (v1 hypotheses)

- [ ] **DASH-01**: User sees all 27 Brazilian states with current risk level (green/yellow/orange/red) on a single dashboard page
- [ ] **DASH-02**: Desktop layout shows interactive Brazil map (right) + info panel (left); clicking a state updates the panel
- [ ] **DASH-03**: Mobile layout shows vertically stacked per-state cards with search/filter; map is secondary
- [ ] **RISK-01**: Risk level for each state is computed from active official alerts via the v0 formula (see `docs/risk-formula-v0.md`)
- [ ] **RISK-02**: Each displayed hazard cites its source with link to the original official publication
- [ ] **RISK-03**: Last-update timestamp visible per state and globally
- [ ] **RISK-04**: When all integrated sources are stale > 1h, state shows "Dados indisponíveis" (gray), never green-by-default
- [ ] **DATA-01**: At least 2 official sources integrated via public APIs (target: CEMADEN + INMET; stretch: INPE/FIRMS)
- [ ] **DATA-02**: Ingestion runs every 15 minutes via Vercel Cron with aggressive caching to survive free tier
- [ ] **DATA-03**: Source-failure handling: last good snapshot used, UI flags staleness, no silent downgrade
- [ ] **A11Y-01**: WCAG AA compliant — keyboard navigation, sufficient contrast, color-blind safe (icons + text, not color alone)
- [ ] **A11Y-02**: Usable on 3G connection (lighthouse perf budget)
- [ ] **LEGAL-01**: Mandatory footer disclaimer on every page directing emergencies to 199 (Defesa Civil) / 193 (Bombeiros)
- [ ] **OSS-01**: Public GitHub repo with README (PT-BR + EN), MIT LICENSE, CONTRIBUTING from day 1
- [ ] **OSS-02**: CI runs tests on every PR (GitHub Actions)
- [ ] **DEPLOY-01**: Site live on a public domain (Vercel subdomain or cheap .com.br)

### Out of Scope (v1)

- ENSO global status display — *deferred to M5 (avoids scope creep, must ship hazard core first)*
- Per-state expanded view (rainfall/temperature anomalies, recent events) — *deferred to M4 (requires statistical methodology)*
- "Sobre o ENSO" explainer page — *deferred to M2 (editorial, no API dependency)*
- "Fontes e Metodologia" page — *deferred to M3 (link to GitHub README in v1 for transparency)*
- Preparedness content (no shopping links, no brands) — *deferred to M6 (large editorial effort)*
- Survival skills videos — *deferred to M7*
- Public API for third parties — *deferred to M8*
- State Defesa Civil scraping — *deferred to M9 (v1 is API-only, no scraping)*
- Historical comparison (1997–98, 2015–16, 2023–24) — *deferred to M10*
- Notifications (push/email/Telegram) — *deferred to M11*
- ES/EN translations — *deferred to M12 (i18n scaffolding ready in v1)*
- NASA/ECMWF integrations — *deferred to M13*
- User accounts, social features, monetization — *never. Permanent non-goals.*
- Own forecast model — *never. Aggregator only.*
- Affiliate links / shopping / commerce — *never.*

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js 15 (App Router) over Nest.js | Free tiers running Nest (Render/Fly) have cold starts; Next.js consolidates frontend + API + cron on Vercel free tier | Locked |
| Vercel free tier as primary host | Zero budget; integrated cron, KV, Postgres in single platform | Locked |
| `react-simple-maps` + IBGE TopoJSON over Mapbox/Google | Cost (free), no vendor lock-in, self-hostable assets | Locked |
| `next-intl` from day 1 even though v1 is PT-BR only | Cheaper to set up structure now than retrofit when M12 hits | Locked |
| TypeScript strict + Vitest + Playwright | Standard 2026 web stack; Playwright only for critical flows in v1 | Locked |
| API-only sources in v1 (no scraping) | Legal/credibility safety; scraping moved to M9 with proper governance | Locked |
| Risk formula v0 mirrors source severity rather than synthesizing new analysis | v1 is aggregator; novel statistical synthesis requires validation we can't do at v1 scope | Locked (see `docs/risk-formula-v0.md`) |
| Conservative on missing data (gray "Dados indisponíveis", not green) | Green must be a positive assertion of "no alerts", not silence | Locked |
| Dedup INMET+CEMADEN same-hazard alerts; show both sources, count once | Avoid inflating risk while preserving attribution | Locked |
| 15-min cron poll, no websockets in v1 | Sufficient for hazard timescales; cheap on free tier | Locked |
| Open source MIT from commit 1 | Trust/credibility for a public-safety-adjacent project | Locked |
| No analytics or privacy-invasive tracking; Plausible if needed | Audience includes vulnerable populations; minimize tracking surface | Locked |

## Open Decisions (revisit during build)

These are flagged in the idea document as questions still open. They do not block v1 scaffolding:

- Final project name and domain (current: "ENSO Brasil" provisional)
- Visual design system (palette beyond risk colors, typography)
- SEO and launch strategy
- OSS governance model (PR review, code of conduct, release cadence)
- Prioritization order of M2–M13 (scheduled per milestone, not v1)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-28 after initialization*
