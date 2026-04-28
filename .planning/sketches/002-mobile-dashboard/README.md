---
sketch: 002
name: mobile-dashboard
question: "Mobile-first vertical card list ordered by severity — what density, hierarchy, and interaction model serves the audience best on 3G?"
winner: "B"
tags: [layout, mobile, cards]
---

# Sketch 002: Mobile Dashboard

## Design Question

The project is mobile-first — most users in vulnerable regions arrive via WhatsApp link on a 3G connection. The brief specifies vertical cards ordered by severity descending (red first, green last), 4px colored left border, search/filter, and a secondary map below. Three densities + interaction models to compare:

How dense should each card be? Should "see the alerts" be a tap-to-expand action that keeps everything on one scroll, or a navigation to a detail page?

## How to View

```
open .planning/sketches/002-mobile-dashboard/index.html
```

Each variant is shown inside a 390×780 phone frame. Tabs switch between A/B/C.

## Variants

- **A — Dense list rows.** News-feed feel. Each row: 4px colored stripe + state name + UF code + risk icon + 2-line summary + meta line ("PERIGO · 3 alertas · há 12 min"). Tap navigates to `/estado/{uf}` deep-link page. Optimizes for scanning many states at a glance.
- **B — Generous cards.** Each card: bigger title, region label, prominent badge top-right, full sentence summary, hazard-type chips ("Chuva extrema", "Inundação"), source/timestamp footer. Same tap-to-page navigation. More breathing room, more visual weight per state, fewer states visible per screen.
- **C — Expandable accordion.** Compact closed state (minimal info, tap to expand). Opening a row reveals all alerts inline with sources, plus "Ver detalhes" + "Compartilhar" actions. The Maranhão row opens by default to demonstrate the expanded state. Keeps everything on one page; reduces navigation cost for users with poor connectivity.

## What to Look For

1. **Scan vs depth tradeoff.** Variant A maximizes how many states fit above the fold. B sacrifices some scanning to give weight per card. C lets the user choose per row.
2. **Cognitive load on 3G + small screen.** Which variant feels readable when the user is anxious (real emergency) vs casual (general check-in)?
3. **WhatsApp share moment.** When a user lands from a shared link, the deep-link page handles detail. The home screen's job is "where in Brazil is something happening?" — A and B match this. C blurs the boundary by allowing inline drill-in.
4. **Connectivity behavior.** A and B require navigation (one extra request) to see alerts. C keeps everything in the initial payload (cheaper on 3G if the user actually opens rows; wasteful if they don't).
5. **Severity ordering legibility.** All variants order red→green. Which variant makes the gradient feel intentional vs accidental?
6. **One-handed reach.** Search field, badge tap targets, accordion chevron — which variant feels best on a thumb at 390px?

## Notes

- The phone frame is sketch chrome — production renders responsively in the browser. Layout judgment is what matters, not the device frame.
- All three variants share the same data (1 red + 3 orange + 3 yellow + 2 green sample). Real deployment will render all 27.
- Mini map at the bottom is a secondary visualization (per the brief: "Mapa pode aparecer abaixo como visualização secundária"). Use the same schematic representation as sketch 001.
- Severity counts pill-bar at the top serves the same role as variant C's top legend in sketch 001 — at-a-glance national status.

## Decision (winner: B — refined for life-safety)

**Generous cards with critical facts upfront.** The card hierarchy was redesigned around the principle that this is life-safety information — sober but precise, never sensationalist. Every card now follows the same scan order:

1. **Lead sentence** — one bold line stating what's happening
2. **Facts list** (Afeta · Válido · Fontes) — quick-scan structured data answering *where, until when, who said so*
3. **Hazard chips** — typed categories for filtering and at-a-glance pattern recognition
4. **Emergency strip** — only on red cards: 199 / 193 numbers visible inline (no extra tap needed in a real emergency)
5. **Footer** — timestamp + arrow to detail

The four refinements vs the original B variant:
- **"Afeta"** names actual cities/regions (not generic "interior do estado")
- **"Válido até"** with relative time ("≈ 31 h") — alerts have time bounds and users need them
- **Emergency phone strip** appears only on red cards — actionable, not decorative
- **More breathing room** — 14px gap between cards, 16px padding, 5px stripe on red (visual weight matches severity)

Anti-sensationalism guardrails enforced:
- No animation, no pulse, no shake
- Same typography weight (500) across all severities
- Color reserved for risk; text and chrome stay neutral
- Lead sentences describe events, not consequences ("chuva extrema com risco de inundação", not "PERIGO IMINENTE!!")

## Implementation hints

- Variant A: `<a href="/estado/{uf}">` wrapping each row — pure server component. No client JS needed at all on the home page beyond search filter.
- Variant B: same as A; chips are static. Keeps the data model identical.
- Variant C: requires client JS (or `<details>`/`<summary>`) for expansion. Inline alerts mean the home payload includes per-state alert rows — bigger initial JSON. Worth measuring against the 3G transfer budget (REQ A11Y-05: < 200 KB).
