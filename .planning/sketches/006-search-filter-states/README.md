---
sketch: 006
name: search-filter-states
question: "Search input + region chips: empty / typing / no-results / active-chip combinations — what interaction model serves life-safety-adjacent UX best?"
winner: null
tags: [interaction, search, filter]
---

# Sketch 006: Search & Filter States

## Design Question

Home dashboard tem dois mecanismos de filtro: search por estado (REQ DASH-01 home + DASH-04 deep-link) e region chips (REQ DASH-07: Norte / Nordeste / Centro-Oeste / Sudeste / Sul). Nunca exploramos os estados de interação: vazio / focado / digitando / sem-resultado / chip ativo / combinações. Para uma audiência sob estresse, a fricção do filtro precisa ser zero.

## How to View

```
open .planning/sketches/006-search-filter-states/index.html
```

Cada variante mostra **4 estados em phones lado a lado**, do default ao filtro composto.

## Variants

- **A — Inline filter (always visible).** Search e region chips visíveis ao mesmo tempo, sempre. Filtro aplica imediatamente. Strip discreto acima da lista mostra "Mostrando 3 de 27 · busca 'ma'" com botão Limpar. Zero JS extra para mostrar resultados — só `.filter()` no servidor (URL params). **Mais simples · sem dropdown · sem dialog.**
- **B — Autocomplete dropdown.** Search abre dropdown estilo command-palette com sugestões agrupadas por nível de risco (Em perigo · Em alerta · Em atenção). Tap navega direto para `/estado/{uf}` — busca como atalho de navegação. Region chips ficam abaixo, separados.
- **C — Filter button → drawer.** Header reduzido com search livre + botão "Filtrar" (com badge contador). Tap abre bottom-drawer com **região + nível de risco**. Bom quando v1 evoluir para 4+ filtros (M5 status ENSO, M9 múltiplas fontes). Mais cliques para o caso simples.

## What to Look For

1. **Tempo até "encontrei meu estado".** A: digite 2 letras → vê resultado. B: digite → tap na sugestão → navega. C: tap "Filtrar" → escolhe → aplica.
2. **Discoverability dos region chips.** A mostra todas as 5 regiões inline (alguém scroll-rola sem ver). B as separa abaixo. C as esconde no drawer.
3. **3G + cold-cache friendliness.** A é puro server-render (URL `?q=ma&region=Nordeste`). B requer JSON pre-carregado para autocomplete. C é server-render mas precisa client JS para o drawer.
4. **A11y: keyboard navigation.** A: Tab passa por chips → input → cards. B: ↑/↓ navega no dropdown, Enter abre. C: Tab navega; precisa trap focus no drawer aberto.
5. **No-results dignified.** Todos têm — A inline na própria lista, B inline no dropdown, C ocupa todo o conteúdo. Qual carrega bem o tom calmo + atalho de recuperação?
6. **Filtros compostos.** A mostra "2 filtros · 1 resultado" no strip. B não combina nativamente (autocomplete não tem chips de região). C exibe badge com contador de filtros no botão.
7. **Implementation cost para v1.** A é o mais barato. C é o mais flexível para crescer. B é o mais "command-K-like" mas requer client-side data.

## Notes

- O empty-state ("Nenhum estado encontrado") segue o tom calmo do projeto — sem exclamação, oferece ações concretas (Limpar busca / Ver todos os 27).
- Highlight de match (`<mark>`) usa o yellow-bg dos tokens — coerente com o sistema, não verde-fosforescente.
- Variant A trata `?q=` e `?region=` como URL params — toda combinação de filtros é shareable e bookmarkable. Útil para um jornalista que quer linkar "Nordeste em alerta".
- Variant B precisa estar acessível em `<noscript>` — se o autocomplete depende 100% de JS, precisa fallback para busca regular.
- Variant C drawer requer `inert` no resto da página enquanto aberto, focus trap, e `Escape` para fechar — padrão dialog acessível.

## Implementation hints

### If A wins (most likely for v1 — zero-JS-friendly)

```html
<form action="/" method="get" class="filter-bar">
  <input type="search" name="q" value={searchParams.q} placeholder="Buscar estado…">
  <fieldset class="m-regions">
    <button name="region" value="Nordeste" aria-pressed={searchParams.region === "Nordeste"}>
      Nordeste <span class="count">9</span>
    </button>
    {/* ... */}
  </fieldset>
</form>
```

URL is the single source of truth. Server component reads `searchParams`, filters the snapshot, renders. **No `'use client'` anywhere.**

### If B wins

Need `app/components/StateSearchCommand.tsx` as a client component that loads a tiny JSON of all 27 states (UF + name + region + current risk) at mount. Use `cmdk` library or build vanilla. Make sure `<noscript>` fallback exists.

### If C wins

Drawer is a `<dialog>` element with `popover="auto"` (or controlled). Server-render the closed state; open is client-only. Submit POSTs back with selected filters via URL params (so deep-links still work).
