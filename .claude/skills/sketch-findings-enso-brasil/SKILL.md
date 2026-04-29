---
name: sketch-findings-enso-brasil
description: Validated design decisions, CSS patterns, theme tokens, and visual direction from sketch experiments. Auto-loaded during UI implementation on enso-brasil.
---

<context>
## Project: enso-brasil

ENSO Brasil — public PT-BR climate hazard aggregator dashboard. Visual direction is **civic and accessible** (think INMET portal × Wikipedia sobriety, modernized). Built for vulnerable populations on 3G connections; life-safety-adjacent so anti-sensationalism is a hard constraint.

**Reference points used during sketching:**
- INMET portal (`alertas2.inmet.gov.br`) — palette anchor and visual sobriety
- Wikipedia — chrome neutrality, generous whitespace, hairline rules
- UK Met Office warnings — accessible-alternative patterns
- US Drought Monitor — single-canvas regional severity composition

**Sketch sessions wrapped:** 2026-04-28
</context>

<design_direction>
## Overall Direction

- **Civic, sober, never SaaS-startup.** Color reserved exclusively for risk levels — chrome (header, top legend, banner cinza/laranja) stays neutral.
- **Type weights 400 + 500 only.** No bold-bold, no italics for emphasis, no decorative type.
- **Hairline borders** (1px in `#dcdcd6`, simulating 0.5px) — no shadows, no gradients, no glows.
- **System font stack** (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, …`) — no external font files (3G performance budget).
- **Risk palette = INMET-aligned** four levels + a fifth `unknown` (gray) reserved for absence-of-data, never auto-assigned to green.
- **Three redundant signals per risk level**: color + icon + text label. Never color alone.
- **PT-BR labels locked verbatim** to CEMADEN/INMET vocabulary: "Sem alertas / Atenção / Alerta / Perigo / Dados indisponíveis".
- **PT-BR ONLY · no i18n routing.** Project dropped `next-intl` and locale routing entirely. Strings live in `src/lib/messages.ts` as plain TypeScript constants, not as a translation catalog.
- **Anti-sensationalism guardrails**: no animation on alerts, no pulsing, no ALL-CAPS warnings, same type weight across severities. Severity is conveyed by color + position + structure.
- **Mobile-first**: most users arrive via WhatsApp link. Card hierarchy locked to scan order — Lead → Afeta → Válido → Fontes → Chips → 199/193/190 (red only) → Timestamp.
- **Stale/desatualizado notices ALWAYS at the top of the page** (SSR-rendered, above all main content, never inline-only).
- **Fonte oficial sempre linkada** quando referenciada; domínio em mono-font (`alertas.cemaden.gov.br`) sinaliza link externo.
- **Emergency contacts on every page disclaimer**: 199 (Defesa Civil) · 193 (Bombeiros) · 190 (Polícia).
- **Edge-state copy locked**:
  - Verde: "Não encontramos nenhuma emergência nessa localidade. Verifique em outras fontes de informação antes de decidir o que você vai fazer."
  - Stale source: "Não estamos recebendo dados do(a) {fonte}. Acesse {url} diretamente e busque a informação que você precisa."
</design_direction>

<findings_index>
## Design Areas

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Layout & Composition | `references/01-layout-composition.md` | Desktop = top-legend strip + 50/50 with map left. Mobile = generous cards with locked life-safety reading order. |
| Edge States & Source Trust | `references/02-edge-states-source-trust.md` | Stale notices at top of page (banner). Verde = positive verification + redirect to other sources. Cinza = honest "go to the source" with linked official sites in mono-font. |
| Tokens & Theme | `references/03-tokens-theme.md` | Full CSS custom-property system: surfaces, ink, hairlines, INMET-aligned risk colors, 8pt spacing scale, system-font stack. |
| Page Architecture & States | `references/04-page-architecture-and-states.md` | `/estado/{uf}` two-column with permanent aside; tablet = constrained mobile-up (no separate layout); search = inline URL-params (zero JS); loading = SSR-instant + last-known fallback (never skeleton); total-failure floor mandatory. |

## Theme

The winning theme file is at `sources/themes/default.css` — full set of CSS custom properties to be ported into Tailwind config (`@theme`) when implementation begins.

## Source Files

Original sketch HTML files (with all variants preserved, winners marked ★) live in:
- `sources/001-dashboard-desktop-layout/index.html` — winner: Variant C
- `sources/002-mobile-dashboard/index.html` — winner: Variant B (refined for life-safety)
- `sources/003-edge-states/index.html` — winner: Variant C
- `sources/004-state-detail-page/index.html` — winner: Variant C (two-column desktop / linear mobile)
- `sources/005-tablet-viewport/index.html` — winner: Variant A (constrained mobile-up)
- `sources/006-search-filter-states/index.html` — winner: Variant A (migration trigger logged to C drawer if filters grow)
- `sources/007-loading-skeleton/index.html` — winners: Variant A (primary path) + Variant C (mandatory failure floor)
</findings_index>

<usage>
## When this skill activates

Auto-load whenever working on UI for ENSO Brasil — building components, pages, layouts, theming, copywriting microcopy. Specifically:

- Phase 1 (Skeleton & OSS Foundation) — disclaimer footer, layout shell, root theme tokens
- Phase 5 (Dashboard UI) — the entire visual surface, especially home dashboard, state cards, mobile responsive, `/estado/{uf}` deep-link pages, `/texto` accessible alternative
- Any future milestone touching UI (M2 explainer, M3 metodologia, M4 expanded view, M6 preparedness, M11 notifications)

## How to apply

1. Match the user's UI ask to one of the three design areas in the index
2. Read the corresponding `references/NN-*.md` for decisions, CSS patterns, HTML structures, and explicit anti-patterns
3. Open the matching `sources/NNN-*/index.html` for full visual reference if needed
4. **Never invent severity labels or relax the anti-sensationalism guardrails** — these are user-locked principles

## Hard rules (non-negotiable)

- ⛔ Never use color alone to convey risk — always color + icon + text label
- ⛔ Never use bold weight beyond 500 — type stays 400/500
- ⛔ Never animate alert content (no pulsing, shaking, blinking) — anti-sensationalism
- ⛔ Never use white text on yellow background (WCAG AA contrast fail) — black ink on yellow always
- ⛔ Never render an emergency contact list missing 190 (Polícia)
- ⛔ Never show emergency numbers without their agency names — "199 Defesa Civil · 193 Bombeiros · 190 Polícia", never bare digits. The number alone is incomplete information.
- ⛔ Never bury a stale-data notice inline only — top of page is the contract
- ⛔ Never present green as default-when-uncertain — risk engine produces `unknown` (gray) when sources stale
- ⛔ Never replace the locked edge-state PT-BR strings without explicit user approval
</usage>

<metadata>
## Processed Sketches

- 001-dashboard-desktop-layout
- 002-mobile-dashboard
- 003-edge-states
- 004-state-detail-page
- 005-tablet-viewport
- 006-search-filter-states
- 007-loading-skeleton

## Sketch sessions wrapped

- 2026-04-28 (initial: 001–003)
- 2026-04-28 (frontier round: 004–007)
</metadata>
