# Layout & Composition

## Design Decisions

### Desktop dashboard (≥1024px) — Variant C of sketch 001

**Top-legend strip + 50/50, map on the left, panel on the right.**

| Property | Decision | Why this won |
|----------|----------|-------------|
| Vertical structure | `header` (project name + global timestamp) → `top-legend` (full-width national snapshot strip) → 50/50 split (map left, panel right) → `disclaimer` footer | The top-legend doubles as a national-scale glance ("17 sem alertas · 6 atenção · 3 alerta · 1 perigo") and an explicit color-encoding contract. Anchors the page. |
| Horizontal split | 50% / 50% | Spec proposed 40/60 (panel left, map right). Tested 35/65 too. 50/50 with **map first** matches the home-page job: "show me Brazil right now". Per-state focus moves to the deep-link route `/estado/{uf}` (REQ DASH-04). |
| Reading direction | Map → Panel (LTR) | Brazilian users read left-to-right; national overview lands first, specific state drilldown second. |
| Top-legend = single source of truth for state counts | Always present, derives from snapshot — no client-side recomputation | Server component fed by the same payload that paints the map |

### Mobile dashboard (≤640px) — Variant B refined of sketch 002

**Generous cards with locked life-safety reading order.**

Reading order **inside every card** (locked):

1. **Head row** — state name + region label (small uppercase) + risk badge top-right with icon
2. **Lead** — one bold sentence stating what is happening
3. **Facts list** (`<dl>`) — Afeta, Válido, Fontes (small uppercase labels in left column, content right)
4. **Chips** — typed hazard categories
5. **Emergency strip** — RED CARDS ONLY. Inline 199 / 193 / 190 with mono-font numerals
6. **Footer** — timestamp + arrow to detail

Why this won (over A "dense list" and C "expandable accordion"):
- **Generous breathing room** (14px gap between cards, 16px padding) gives weight to life-safety information without sensationalism.
- **Critical facts upfront** ("Afeta: Oeste e centro · São Luís, Imperatriz, bacia do Mearim") — the user lands stressed; they need *where, until when, who said so* in 1-2 lines.
- **Emergency contacts inline on red cards** — no extra tap during a real emergency.
- Anti-sensationalism enforced: no animation, same type weight (500) across severities, color reserved for risk only.

### Severity ordering on mobile

States ordered by severity descending: red → orange → yellow → green. National counts pill-bar (red, orange, yellow, green) sits between header and search field.

### Map on mobile

Mini map appears **after** the card list, labeled "Mapa" with "Ver completo →" link. Secondary; never the entry point on mobile.

## CSS Patterns

### Top-legend strip (desktop, sketch 001 winner)

```css
.top-legend {
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  padding: 12px 32px;
  display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
}
.top-legend .lbl-h {
  font-size: 12.5px; font-weight: 500;
  color: var(--ink-3);
  text-transform: uppercase; letter-spacing: 0.06em;
  margin-right: 8px;
}
```

Pair with risk-pill chips that include count + label:

```html
<span class="risk-pill risk-green">✓ Sem alertas · 17 estados</span>
```

### Generous mobile card (sketch 002 winner B refined)

```css
.state-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-left: 4px solid var(--line-strong);
  border-radius: 6px;
  padding: 16px;
  display: block;
  text-decoration: none; color: inherit;
}
.state-card.r-red    { border-left-color: var(--red-border);    border-left-width: 5px; }
.state-card.r-orange { border-left-color: var(--orange-border); }
.state-card.r-yellow { border-left-color: var(--yellow-border); }
.state-card.r-green  { border-left-color: var(--green-border);  }
.state-card .lead { font-size: 14.5px; font-weight: 500; line-height: 1.45; }
.state-card .facts {
  display: grid; grid-template-columns: auto 1fr; gap: 4px 10px;
  font-size: 13px; color: var(--ink-2);
}
.state-card .facts dt {
  color: var(--ink-3); font-size: 11.5px;
  letter-spacing: 0.03em; text-transform: uppercase;
}
.state-card .facts dd { margin: 0; color: var(--ink-1); }
```

Note the **5px** left border on red (vs 4px on others) — visual weight matches severity without changing palette.

### Emergency strip (red cards only)

```css
.state-card .emerg {
  margin-top: 10px;
  background: var(--red-bg);
  border: 1px solid var(--red-border);
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 12.5px;
  color: var(--red-ink);
  display: flex; align-items: center; gap: 8px;
}
.state-card .emerg .num {
  background: var(--surface);
  color: var(--red-ink);
  font-weight: 500;
  border: 1px solid var(--red-border);
  padding: 1px 7px;
  border-radius: 4px;
  font-family: var(--mono);
}
```

## HTML Structures

### Desktop page shell

```html
<header class="topbar">
  <h1>ENSO Brasil <span class="sub">perigos climáticos por estado</span></h1>
  <span class="meta">Atualizado às 14:32 · há 8 min</span>
</header>

<div class="top-legend" role="region" aria-label="Legenda">
  <span class="lbl-h">Níveis</span>
  <span class="risk-pill risk-green">✓ Sem alertas · 17 estados</span>
  <span class="risk-pill risk-yellow">⚠ Atenção · 6</span>
  <span class="risk-pill risk-orange">⚠⚠ Alerta · 3</span>
  <span class="risk-pill risk-red">⛔ Perigo · 1</span>
  <span class="risk-pill risk-gray">? Indisponível · 0</span>
</div>

<main class="grid grid-cols-[50%_50%]">
  <section class="map-area" aria-label="Mapa do Brasil por nível de risco"><!-- ... --></section>
  <aside class="panel" aria-label="Detalhes do estado selecionado"><!-- ... --></aside>
</main>

<footer class="disclaimer">
  Em caso de emergência: <strong>199</strong> Defesa Civil · <strong>193</strong> Bombeiros · <strong>190</strong> Polícia.
</footer>
```

### Mobile card (generous, life-safety)

```html
<a href="/estado/ma" class="state-card r-red">
  <div class="head">
    <div class="name"><h3>Maranhão</h3><div class="region">Nordeste · MA</div></div>
    <span class="badge">⛔ Perigo</span>
  </div>
  <div class="lead">Chuva extrema com risco de inundação e deslizamento.</div>
  <dl class="facts">
    <dt>Afeta</dt><dd>Oeste e centro · São Luís, Imperatriz, bacia do Mearim</dd>
    <dt>Válido</dt><dd>Até quarta-feira, 22h00 (≈ 31 h)</dd>
    <dt>Fontes</dt><dd>INMET (Grande Perigo) · CEMADEN (2 alertas)</dd>
  </dl>
  <div class="chips">
    <span class="chip">Chuva extrema</span>
    <span class="chip">Inundação</span>
    <span class="chip">Deslizamento</span>
  </div>
  <div class="emerg" role="note">
    <span aria-hidden="true">📞</span>
    <span>Em emergência: <span class="num">199</span> Defesa Civil · <span class="num">193</span> Bombeiros · <span class="num">190</span> Polícia</span>
  </div>
  <div class="foot">
    <span>Atualizado há <span class="tnum">12 min</span></span>
    <span class="arrow">→</span>
  </div>
</a>
```

## What to Avoid

| Rejected | Reason |
|----------|--------|
| 40/60 (panel left, map right) — original spec | Spec was correct for "user comes for my state" but the home page is now the national-glance entry; per-state focus moved to `/estado/{uf}` deep-links |
| 35/65 with sticky update band | Worked but cramped the panel at 35%; alert metadata wrapped awkwardly |
| Mobile dense list (variant A of sketch 002) | Optimized scanning over comprehension; under stress users miss critical facts |
| Mobile expandable accordion (variant C of sketch 002) | Bigger initial JSON payload (per-state alert rows pre-loaded) — wasted on 3G if users don't expand |
| Inline emergency-contacts in green/yellow/orange cards | Contacts must be visible *only* when actually needed (red); on every card it becomes noise |

## Origin

Synthesized from sketches:
- 001-dashboard-desktop-layout (winner C)
- 002-mobile-dashboard (winner B refined)

Source files: `sources/001-dashboard-desktop-layout/`, `sources/002-mobile-dashboard/`
