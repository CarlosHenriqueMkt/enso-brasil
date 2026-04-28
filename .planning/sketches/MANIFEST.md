# Sketch Manifest — ENSO Brasil

## Design Direction

**Civic and accessible**, not SaaS-startup. Reference: INMET portal aesthetic crossed with Wikipedia sobriety, modernized with cleaner typography and hierarchy. Color is reserved exclusively for risk levels — chrome (header, navigation, surfaces) stays neutral. Type weights limited to 400 and 500. Borders 0.5px equivalent (1px hairline `#dcdcd6`). No gradients, no decorative shadows, no elaborate animations. Tone calm and direct — never alarmist. Performance-first for 3G; WCAG AA non-negotiable; PT-BR throughout.

## Reference Points

- INMET portal (`alertas2.inmet.gov.br`) — palette anchor and visual sobriety
- Wikipedia — neutrality of chrome, generous whitespace, hairline rules
- UK Met Office warnings page — accessible alternative-text patterns
- US Drought Monitor — single-canvas regional severity composition

## Constraints (locked from `.planning/research/SUMMARY.md` and project files)

- Risk levels: 5 — `green / yellow / orange / red / unknown`
- PT-BR labels: "Sem alertas / Atenção / Alerta / Perigo / Dados indisponíveis"
- 3 redundant signals per level: color + icon + text
- Yellow `#eab308` on white fails WCAG — palette uses INMET-aligned darker yellows with dark ink on light fill
- Map projection: Albers conic (sketch uses schematic representation)
- No external font files — system stack only (3G performance budget)

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | dashboard-desktop-layout | Does 40/60 panel-on-left + map-on-right feel right at ≥1024px, or should the map breathe more? | **C — top legend + 50/50, map left** | layout, desktop, hierarchy |
| 002 | mobile-dashboard | Mobile-first vertical card list ordered by severity — what density, hierarchy, and interaction model? | _pending_ | layout, mobile, cards |
| 003 | edge-states | How to show "Verde — sem alertas" without looking like a bug, and how to flag a stale source? | _planned_ | states, error, empty |

## Notes

- Sketches use a schematic Brazil representation (regional polygons + UF dots). Production uses precise IBGE TopoJSON via `react-simple-maps` with Albers conic. Sketches focus on layout/composition/typography judgment — not map fidelity.
- All sketches are static HTML + CSS + a tiny vanilla JS for tab switching. No build step. No external assets.
