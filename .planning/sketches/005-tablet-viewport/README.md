---
sketch: 005
name: tablet-viewport
question: "How does the layout adapt at 640–1024 px (the gap zone between mobile and desktop)?"
winner: null
tags: [layout, responsive, breakpoint, tablet]
---

# Sketch 005: Tablet Viewport (640–1024 px)

## Design Question

The original brief specifies desktop ≥ 1024 px and mobile ≤ 640 px. The 640–1024 zone — iPad portrait (768) and landscape (1024 minus chrome) — is unspecified. Three approaches:

- **A — Constrained mobile-up** (per directive): cards mantêm largura próxima ao mobile (~560 px max-width, centralizados); página cresce com **margens laterais maiores** e **escala suave de tipografia**. Não alarga cada card individualmente.
- **B — Desktop-down adapted**: mantém o layout desktop (top-legend + 50/50 map+panel) e comprime as proporções. Mostra Brasil + estado simultaneamente.
- **C — Cards grid + map below**: composição iPad-native — grid de cards (2 colunas em 768, 3 em 1024) com mapa empurrado para baixo como secundário. Aproveita largura sem alargar cada card.

## How to View

```
open .planning/sketches/005-tablet-viewport/index.html
```

Cada variante mostra **iPad portrait (768 × 1000)** e **iPad landscape (1024 × 720)** lado a lado. Tabs alternam A/B/C.

## Variants

- **A — Constrained mobile-up.** Per directive: cards limitados a 560 px de largura, centralizados na página. Margens laterais escalam (24 px em 768 → 64 px em 1024). Tipografia escala suavemente (h3 18 → 19, body 14.5 → 15.5). Mantém o card-anatomy locked do mobile (Lead → Afeta → Válido → Fontes → Chips → 199/193/190 → Timestamp). Verbose mas confortável de ler.
- **B — Desktop-down adapted.** Recompõe o desktop em viewport menor: top legend (compactada) + grid 50/50 (mapa + panel). Painel direito fica apertado em 768 px (alertas com fonte 11.5–12.5 px). Em 1024 melhora.
- **C — Cards grid + map below.** Cards compactos em grid 2-col (768) ou 3-col (1024); mapa nacional aparece como seção secundária após os cards. Próximo da experiência iPad-native (Pinterest-like). Sacrifica detalhe per-card.

## What to Look For

1. **Reading comfort.** A entrega largura ergonômica (~50 caracteres por linha de texto). B e C variam.
2. **First-paint contract.** A mantém o mesmo contrato visual do mobile — usuário que acessa do celular e abre no iPad vê a mesma estrutura. B e C "viram outro app" ao mudar de viewport.
3. **Information density per screen.** B mostra Brasil-todo + estado-único simultaneamente. C mostra muitos estados de uma vez. A mostra um estado por vez.
4. **Implementation cost.** A é praticamente "mobile com padding maior" — uma media query simples. B e C exigem layouts dedicados.
5. **Acessibilidade em zoom 200%.** A se comporta como o mobile (já testado). B fica difícil. C colapsa para 1 col rapidamente.
6. **Margens vs preenchimento.** A tem espaço lateral generoso — alguns chamarão de "desperdício". É na verdade respiração que melhora a leitura em telas grandes seguradas perto.

## Notes

- Direção do usuário: "Não precisa alargar os cards no mobile-up, basta ajustar as margens laterais e o tamanho das letras." Variant A foi construída exatamente nesse princípio.
- Esta é uma decisão de **breakpoint**, não de feature. O escolhido vira media query no Tailwind config.
- Em todos os tablets, o stale banner permanece no topo (princípio locked do sketch 003).
- 199/193/190 sempre com nome do órgão (princípio locked do sketch 004).

## Implementation hints

### If A wins (constrained mobile-up)

```css
.card-list {
  max-width: 560px;
  margin: 0 auto;
  padding: 18px clamp(16px, 4vw, 64px);
  display: flex; flex-direction: column; gap: 14px;
}
@media (min-width: 1024px) {
  .card-list { gap: 18px; padding-block: 22px; }
  .state-card h3 { font-size: 19px; }
  .state-card .lead { font-size: 15.5px; }
}
```

Single Tailwind class set:
```html
<div class="max-w-[560px] mx-auto px-4 sm:px-8 md:px-12 lg:px-16 flex flex-col gap-3.5 md:gap-4 py-5 md:py-6">
```

The mobile layout *is* the tablet layout — only spacing/type tokens differ. **Lowest implementation cost**.

### If B wins (desktop-down)

Needs a third media query block (768–1023) with compressed proportions. Map at 50% becomes cramped under 800 px content width.

### If C wins (grid layout)

`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` for the card list; map moves below; per-card content trimmed (no facts list, no chips). Requires a separate "compact card" component variant.
