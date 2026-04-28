# Edge States & Source Trust

## Design Decisions

### Stale data / source-failure notices — ALWAYS at the top of the page

Variant C of sketch 003 won. **Hard rule:** when any source's last successful fetch is older than 30 minutes, an orange banner renders at the very top of the page (above all main content), SSR-rendered. Never inline-only.

Banner content pattern:

> **{Source} fora há {N} min.** Estamos mostrando dados antigos dessa fonte. Acesse {URL} para verificar diretamente.

Where:
- `{Source}` is the human-readable source name (CEMADEN, INMET, INPE Queimadas, NASA FIRMS)
- `{N}` is rounded minutes since last success
- `{URL}` is the source's own public site, rendered as a clickable link with the domain in mono-font

When **multiple** sources are degraded simultaneously, the banner stacks (one strip per source) — never collapses into "várias fontes fora" because the user needs to know *which* source to verify against.

### Verde / Sem alertas — positive verification, never default-on-uncertainty

When a state has no active alerts AND all sources are fresh, the card/page shows green. Locked PT-BR copy:

> **Não encontramos nenhuma emergência nessa localidade. Verifique em outras fontes de informação antes de decidir o que você vai fazer.**

Why this exact wording:
- "Não encontramos" affirms we *checked* (positive verification, not silence)
- "nessa localidade" is humble (we didn't say "no problems anywhere", just here)
- "Verifique em outras fontes" is the load-bearing phrase — **we are an aggregator, not an authority**. Defesa Civil is. The user must always know to seek further verification.

The state-detail page (`/estado/{uf}`) for green states includes an explicit "Fontes verificadas há 8 min" section listing each source with ✓ marker and a link to its own portal in mono-font.

### Cinza / Dados indisponíveis — honest "go to the source"

When *all* integrated sources are stale > 1h for a state, the risk level becomes `unknown` (gray, dashed left border). Locked PT-BR copy:

> **Não estamos recebendo dados das fontes oficiais.** Acesse os sites diretamente para buscar a informação que você precisa.

The card body lists each official site with the domain in mono-font and a ✗ marker indicating the source is currently unreachable. This is the trust-preserving fallback: better to redirect honestly than to fake a green when we don't know.

### Source-link presentation pattern

Every link to an official source renders the domain name in **monospace font**. This signals "external link to an official site, not in-app navigation":

```
CEMADEN              alertas.cemaden.gov.br
INMET                alertas2.inmet.gov.br
Defesa Civil PA      defesacivil.pa.gov.br
```

### Emergency contacts — always present, never partial, **always with agency name**

Every page disclaimer includes all three emergency numbers, **and every number is always paired with the name of the agency it dials**. Many users do not memorize which number reaches which service — the number alone is incomplete information.

> **199** Defesa Civil · **193** Bombeiros · **190** Polícia

**Wrong:** "Em emergência: 199 · 193 · 190."
**Right:** "Em emergência: 199 Defesa Civil · 193 Bombeiros · 190 Polícia."

Do not compress the number-name pairing for any reason — including narrow mobile viewports, footer constraints, or word count. If space is a problem, drop other words ("Em emergência:" can be shortened) or stack the contacts vertically — never strip the agency name.

190 was missing from earlier drafts and was explicitly added by the user. Do not omit any of the three. They appear in:
- The footer disclaimer of every page (mandatory)
- Inline emergency strip on red cards (mobile)
- The state-detail page for any state with risk ≥ orange

### Severity vs absence — color contract

| Level | Color | Border style | Meaning |
|-------|-------|--------------|---------|
| Green | `--green-*` | solid 4px | Verified: no active alerts |
| Yellow | `--yellow-*` | solid 4px | At least one low-severity alert |
| Orange | `--orange-*` | solid 4px | Moderate severity OR 3+ low simultaneous |
| Red | `--red-*` | solid **5px** | High or extreme severity |
| Gray | `--gray-*` | **dashed** 4px | Data unavailable — meta-state, not a hazard level |

The dashed border on gray is intentional: visual signal that gray is *not* a severity ranking, just absence of data.

## CSS Patterns

### Top stale banner (sketch 003 winner C)

```css
.top-banner {
  padding: 12px 16px;
  background: #fef0e1;            /* orange-bg */
  border-bottom: 1px solid var(--orange-border);
  border-top: 3px solid var(--orange-border);
  color: var(--orange-ink);
  font-size: 13px; line-height: 1.5;
}
.top-banner strong { font-weight: 500; color: var(--ink-1); }
.top-banner a { color: var(--orange-ink); }
```

Render conditionally — server-component prop driven by `snapshot.staleSourceCount > 0`.

### Source-link list (mono-font domains)

```css
.src-links {
  display: flex; flex-direction: column; gap: 6px;
  padding: 10px 12px;
  background: var(--surface-muted);
  border-radius: 4px;
  border: 1px solid var(--line);
}
.src-links a {
  font-size: 13px; color: var(--ink-1);
  display: flex; justify-content: space-between; align-items: center;
  padding: 3px 0;
  text-decoration: none;
}
.src-links a .domain {
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 11.5px;
}
.src-links a.ok    .domain::before { content: "✓ "; color: var(--green-border); }
.src-links a.fail  .domain::before { content: "✗ "; color: var(--red-border); }
.src-links a.stale .domain::before { content: "⚠ "; color: var(--orange-border); }
```

### Verified-positive callout (green detail page)

```css
.detail-status-green {
  padding: 16px;
  border: 1px solid var(--green-border);
  border-left-width: 5px;
  background: var(--green-bg);
  border-radius: 6px;
}
.detail-status-green h3 { font-size: 17px; color: var(--green-ink); font-weight: 500; }
.detail-status-green p { font-size: 13.5px; color: var(--ink-1); line-height: 1.55; }
```

### Gray "Indisponível" detail callout

```css
.detail-status-gray {
  padding: 16px;
  border: 1px dashed var(--gray-border);
  border-left-width: 5px;
  background: var(--gray-bg);
  border-radius: 6px;
}
```

## HTML Structures

### Top banner — render conditionally above main content

```html
<div class="top-banner warning" role="status">
  <strong>CEMADEN fora há 47 min.</strong>
  Estamos mostrando dados antigos dessa fonte. Acesse
  <a href="https://alertas.cemaden.gov.br" rel="external">alertas.cemaden.gov.br</a>
  para verificar diretamente.
</div>

<header class="m-head">…</header>
<main>…</main>
<footer class="disclaimer">…</footer>
```

### Verde card — positive verification

```html
<a href="/estado/sc" class="state-card r-green">
  <div class="head">
    <div class="name"><h3>Santa Catarina</h3><div class="region">Sul · SC</div></div>
    <span class="badge">✓ Sem alertas</span>
  </div>
  <div class="lead">Não encontramos nenhuma emergência nessa localidade.</div>
  <div class="body-text">Verifique em outras fontes antes de decidir o que você vai fazer.</div>
  <div class="foot">
    <span>Verificado há <span class="tnum">8 min</span> · CEMADEN ✓ INMET ✓</span>
    <span class="arrow">→</span>
  </div>
</a>
```

### Cinza card — all sources down

```html
<a href="/estado/pa" class="state-card r-gray">
  <div class="head">
    <div class="name"><h3>Pará</h3><div class="region">Norte · PA</div></div>
    <span class="badge">? Indisponível</span>
  </div>
  <div class="lead">Não estamos recebendo dados das fontes oficiais.</div>
  <div class="body-text">Acesse os sites diretamente para buscar a informação que você precisa:</div>
  <div class="src-links">
    <a class="fail" href="https://alertas.cemaden.gov.br" rel="external">
      <span>CEMADEN</span><span class="domain">alertas.cemaden.gov.br</span>
    </a>
    <a class="fail" href="https://alertas2.inmet.gov.br" rel="external">
      <span>INMET</span><span class="domain">alertas2.inmet.gov.br</span>
    </a>
    <a class="fail" href="https://defesacivil.pa.gov.br" rel="external">
      <span>Defesa Civil PA</span><span class="domain">defesacivil.pa.gov.br</span>
    </a>
  </div>
  <div class="foot">
    <span>Última tentativa há <span class="tnum">1 h 12 min</span></span>
    <span class="arrow">→</span>
  </div>
</a>
```

### Footer disclaimer — every page (3 emergency contacts mandatory)

```html
<footer class="disclaimer">
  Este site agrega informações de fontes oficiais para facilitar o acesso. Em caso de emergência, ligue
  <strong>199</strong> (Defesa Civil), <strong>193</strong> (Bombeiros) ou <strong>190</strong> (Polícia).
  O ENSO Brasil não substitui sistemas oficiais de alerta.
</footer>
```

## Locked Copy Strings (canonical)

Centralize in `src/lib/i18n/messages/pt-BR.ts`:

```ts
export const messages = {
  edge: {
    greenLead: "Não encontramos nenhuma emergência nessa localidade.",
    greenBody: "Verifique em outras fontes de informação antes de decidir o que você vai fazer.",
    grayLead: "Não estamos recebendo dados das fontes oficiais.",
    grayBody: "Acesse os sites diretamente para buscar a informação que você precisa:",
    staleSource: (source: string, url: string) =>
      `Não estamos recebendo dados do(a) ${source}. Acesse ${url} diretamente e busque a informação que você precisa.`,
    staleBannerLead: (source: string, minutes: number) =>
      `${source} fora há ${minutes} min. Estamos mostrando dados antigos dessa fonte.`,
    staleBannerCta: (url: string) =>
      `Acesse ${url} para verificar diretamente.`,
  },
  emergency: {
    full: "Em caso de emergência, ligue 199 (Defesa Civil), 193 (Bombeiros) ou 190 (Polícia).",
    inline: "199 Defesa Civil · 193 Bombeiros · 190 Polícia",
    // ALWAYS pair number + agency. Never use the bare numbers without their agency names.
  },
  disclaimer: "Este site agrega informações de fontes oficiais para facilitar o acesso. O ENSO Brasil não substitui sistemas oficiais de alerta.",
};
```

Do not edit these strings without explicit user approval — they were locked through user feedback during sketching.

## What to Avoid

| Rejected | Reason |
|----------|--------|
| Inline-only stale notices | Buries critical staleness info; user must see it as the *first* thing on the page |
| "Verde = OK" without verification phrasing | Reads as "everything's fine" without humility — we are aggregator, not authority |
| Auto-defaulting to green when sources fail | Public-safety hazard — a stale upstream during a real disaster could paint a state green |
| Source-failure messaging that hides which source | Users need to know *which* official site to consult |
| Removing/abbreviating any of the 3 emergency numbers | 190 was added explicitly; all three must always be present |
| Showing emergency numbers without their agency names | "199 · 193 · 190" without "Defesa Civil / Bombeiros / Polícia" — many users don't memorize which is which; the bare number is incomplete information |
| Translating or rewording the locked PT-BR strings | They were locked through user feedback — unauthorized changes degrade trust |
| Severity-color borders on "Indisponível" | Gray must read as meta-state; dashed border + gray ink is the contract |
| White text on yellow background | Fails WCAG AA contrast; always black ink on yellow |

## Origin

Synthesized from sketch:
- 003-edge-states (winner C — top banner + lean cards)

Plus copy locked through user feedback during sketch 002 review (190 Polícia inclusion) and sketch 003 review (verde + stale source PT-BR strings).

Source file: `sources/003-edge-states/index.html`
