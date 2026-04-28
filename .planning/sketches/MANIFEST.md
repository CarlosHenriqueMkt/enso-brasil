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
| 002 | mobile-dashboard | Mobile-first vertical card list ordered by severity — what density, hierarchy, and interaction model? | **B — generous cards (refined: Afeta + Válido + 199/193 inline em vermelho)** | layout, mobile, cards |
| 003 | edge-states | How to show "Verde — sem alertas" without looking like a bug, and how to flag a stale source? | **C — top banner global + cards lean** | states, error, empty |
| 004 | state-detail-page | What does the `/estado/{uf}` deep-link page look like — the screen that receives WhatsApp shares? | **C — two-column desktop / linear mobile** | layout, page, deep-link |
| 005 | tablet-viewport | How does the layout adapt at 640–1024 px (the gap zone between mobile and desktop)? | _planned_ | layout, responsive, breakpoint |
| 006 | search-filter-states | Search input + region chips interaction: empty, typing, no-results, active chip combinations | _planned_ | interaction, search, filter |
| 007 | loading-skeleton | Cold-cache and 3G initial paint: skeleton vs SSR-instant vs prefetch shell | _planned_ | states, loading, perf |

## Locked Principles (from sketch decisions)

These came out of sketch winners and are now project-wide design contracts:

1. **Avisos de stale/desatualizado SEMPRE no topo da página** (acima do conteúdo, primeira informação que o usuário vê). Nunca apenas inline. — sketch 003 winner C
2. **Toda página exibe** (a) link para a fonte oficial original e (b) contatos de emergência completos: **199 Defesa Civil · 193 Bombeiros · 190 Polícia**. Sem esquecer 190 e **sempre pareando o número com o nome do órgão** — nunca "199 · 193 · 190" sozinhos.
3. **Copy de borda travada** em PT-BR direto, sem enrolação:
   - Verde: "Não encontramos nenhuma emergência nessa localidade. Verifique em outras fontes de informação antes de decidir o que você vai fazer."
   - Stale source: "Não estamos recebendo dados do(a) [Fonte]. Acesse [site] diretamente e busque a informação que você precisa."
4. **Top legend = national snapshot** (sketch 001 winner C): contagem por nível ("17 sem alertas · 6 atenção · 3 alerta · 1 perigo") fica no topo do dashboard desktop.
5. **Card mobile life-safety** (sketch 002 winner B refinado): ordem de leitura locked como Lead → Afeta → Válido → Fontes → Chips → 199/193/190 (em vermelho) → Timestamp.
6. **Color reserved for risk** — chrome (header, top legend, banner cinza/laranja para staleness) usa cinza/neutros.
7. **Domínios em mono-font** (`alertas.cemaden.gov.br`) em todo link externo a site oficial — sinaliza "isso te leva pra fora".

## Notes

- Sketches use a schematic Brazil representation (regional polygons + UF dots). Production uses precise IBGE TopoJSON via `react-simple-maps` with Albers conic. Sketches focus on layout/composition/typography judgment — not map fidelity.
- All sketches are static HTML + CSS + a tiny vanilla JS for tab switching. No build step. No external assets.
