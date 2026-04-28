---
sketch: 003
name: edge-states
question: "How to show 'Verde — sem alertas' without looking like a bug, and how to flag a stale source — using direct, no-fluff Portuguese?"
winner: null
tags: [states, error, empty, copy]
---

# Sketch 003: Edge States

## Design Question

Edge states are where credibility is won or lost. Two specific cases:

1. **Verde / Sem alertas.** Has to feel like a positive verification, not a failed load. The user must understand we *checked* and found nothing — not that nothing came back.
2. **Fonte stale / Dados indisponíveis.** When a source is down, we need to be honest: redirect the user to the source's own site instead of pretending to have data.

The copy is **locked** by the user as authoritative, no-fluff Portuguese:

- **Verde:** "Não encontramos nenhuma emergência nessa localidade. Verifique em outras fontes de informação antes de decidir o que você vai fazer."
- **Stale source:** "Não estamos recebendo dados do(a) [Fonte]. Acesse [site da fonte] diretamente e busque a informação que você precisa."

The design question is *where* and *how* this copy lives across four scenarios.

## How to View

```
open .planning/sketches/003-edge-states/index.html
```

Each variant shows the same 4 scenarios stacked, so you can scroll a single phone frame and see the whole story:

1. Verde state in the list view
2. Estado com fonte parcialmente fora (laranja com strip CEMADEN stale)
3. Estado com todas as fontes fora (cinza "Dados indisponíveis")
4. Detalhe `/estado/{uf}` em estado verde

## Variants

- **A — Inline minimal.** Copy lives where the data should have been. No banners, no extra chrome. The verde lead reads exactly like the locked sentence; the stale notice is a small orange strip inside the affected state's card; the "Indisponível" card lists official sites inline. Tone: text does the work.

- **B — Structured callouts.** Dedicated containers for each edge case. The verde card includes a green "verified" callout box; the stale strip is more prominently colored; the "Indisponível" card has a labeled "Sites oficiais" section listing fonts with mono-font domains and ✗ markers. Tone: containerized clarity.

- **C — Top banner + lean cards.** When sources are degraded globally, an orange banner sits at the very top of the page explaining once. Individual cards stay lean — minor footers note "INMET ✓ · CEMADEN ⚠". Per-state full-fail still uses a gray card. Tone: speak globally first, cards stay calm.

## What to Look For

1. **Honesty without alarm.** A and B carry the warning per-card; C centralizes it. Which feels honest without making every card look broken?
2. **Action gradient.** All variants include outbound links to the source sites. Which makes "go to the official site" feel like the natural next step rather than "this app is broken"?
3. **Verde as positive verification.** Does the layout sell the assertion "we checked, nothing here" — or does it look like a card that failed to populate?
4. **Trust under partial failure.** When CEMADEN is stale but INMET is fine, the user still gets actionable info. Which variant makes the *partial* nature of the degradation clearest?
5. **Mobile attention budget.** A user under stress reads one or two lines max. Where does each variant put the most important sentence?
6. **3G / payload friendliness.** A renders identical bytes whether sources are healthy or not (text varies). C requires the banner only when degraded — server-side conditional render.

## Notes

- Mono-font domain names ("alertas.cemaden.gov.br") are a deliberate choice: they signal "this is an external link to an official site", not an in-app navigation. Helps for trust.
- Gray uses **dashed** left border (vs solid for severity colors). Visual signal that gray is a meta-state, not a hazard level.
- Footer disclaimer (199 / 193) is preserved across all variants and viewports — never replaced by an edge-state message.
- All variants share the same theme tokens. Risk colors are still reserved for severity; gray is the only "meta" color introduced for the absence-of-data case.

## Implementation hints

- The locked verde sentence and stale-source sentence are constants — store them in a single PT-BR strings file (`src/lib/i18n/messages/pt-BR.ts`) so they translate cleanly when M12 lands.
- Source URLs ship with the snapshot (each `Source` entity carries its public URL). Keep them in the data model from Phase 1 — retrofitting is painful.
- "Verde = positive verification" is enforced by the risk engine (REQ-RISK-07): if no source has been refreshed in >1h, the state's level becomes `unknown` (gray), never green. The verde card's footer always shows "Verificado há X min" because by definition the calculation succeeded.
- The "stale source" detection happens in the snapshot layer (per-source `lastSuccessfulFetch`). UI just renders what the snapshot says.
