# Sketch Wrap-Up Summary

**Date:** 2026-04-28
**Sketches processed:** 3 (all included)
**Design areas:** Layout & Composition · Edge States & Source Trust · Tokens & Theme
**Skill output:** `./.claude/skills/sketch-findings-enso-brasil/`

## Included Sketches

| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 001 | dashboard-desktop-layout | C — top legend + 50/50 map-left | Layout & Composition |
| 002 | mobile-dashboard | B refined — generous cards, life-safety reading order | Layout & Composition |
| 003 | edge-states | C — top banner + lean cards | Edge States & Source Trust |

## Excluded Sketches

(None — all 3 produced clean winners with coherent decisions.)

## Design Direction (consolidated)

**Civic, sober, INMET-portal-like.** Color reserved exclusively for risk levels — chrome neutral. Type weights 400/500 only. Hairline borders. No shadows, no gradients, no animations on alert content. System font stack (3G performance). PT-BR labels match CEMADEN/INMET vocabulary verbatim. Anti-sensationalism is a hard contract — life-safety information is communicated through structure and layout, not visual aggression.

## Key Decisions

### Layout
- Desktop: top-legend strip (national snapshot) + 50/50 split, **map on the left**
- Mobile: generous cards with locked reading order — Lead → Afeta → Válido → Fontes → Chips → 199/193/190 (red only) → Timestamp
- Card severity ordering: red → orange → yellow → green
- Map on mobile is secondary, appears after the card list

### Palette
- INMET-aligned 4 risk levels + gray `unknown` for absence-of-data (5 total)
- Yellow uses bespoke `#d4a017` (Tailwind default fails WCAG AA)
- Each level has bg/border/ink token triplet; ink-on-bg passes WCAG AA
- Solid 4px left borders for severity; **dashed** for gray (visual signal: meta-state, not severity)
- Red cards get 5px border (visual weight matches severity without changing palette)

### Typography
- 400 + 500 weights only — never 600+
- System font stack only — no external font files
- 8pt spacing scale; radii limited to 2/4/6 px

### Edge state contracts
- **Stale notices ALWAYS at top of page**, SSR-rendered, never inline-only
- **Verde** is positive verification: "Não encontramos nenhuma emergência…" + redirect to other sources (humility)
- **Cinza/Indisponível** lists official sites in mono-font with ✗ markers — honest fallback to source's own portal
- **Source domain in mono-font** signals external/official link

### Locked PT-BR copy
- Verde: "Não encontramos nenhuma emergência nessa localidade. Verifique em outras fontes de informação antes de decidir o que você vai fazer."
- Stale source: "Não estamos recebendo dados do(a) {fonte}. Acesse {url} diretamente e busque a informação que você precisa."
- Severity labels: "Sem alertas / Atenção / Alerta / Perigo / Dados indisponíveis"

### Emergency contacts (every page disclaimer)
- **199** Defesa Civil · **193** Bombeiros · **190** Polícia (190 was added through user feedback — do not omit)

## Skill Structure

```
.claude/skills/sketch-findings-enso-brasil/
├── SKILL.md                                 # Auto-loaded; usage rules, hard contracts
├── references/
│   ├── 01-layout-composition.md             # Desktop + mobile layout decisions, CSS, HTML
│   ├── 02-edge-states-source-trust.md       # Stale banner, verde, cinza, locked copy
│   └── 03-tokens-theme.md                   # Full token system, Tailwind v4 port
└── sources/
    ├── themes/default.css                   # Original theme CSS
    ├── 001-dashboard-desktop-layout/index.html  # All variants, winner ★ on C
    ├── 002-mobile-dashboard/index.html          # All variants, winner ★ on B
    └── 003-edge-states/index.html               # All variants, winner ★ on C
```

## Auto-load routing

`CLAUDE.md` was updated with a routing line so the skill auto-loads on UI work.
