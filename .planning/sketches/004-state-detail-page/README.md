---
sketch: 004
name: state-detail-page
question: "What does /estado/{uf} look like — the page that receives WhatsApp shares and serves as the per-state deep link?"
winner: null
tags: [layout, page, deep-link, content-architecture]
---

# Sketch 004: `/estado/{uf}` State Detail Page

## Design Question

The home dashboard is the national-glance entry. The per-state detail page is a different beast: it's where users **arrive from a WhatsApp share** ("Olha o que tá acontecendo no Maranhão!"), so the URL itself is the entry, the OG card sells the share, and the page must answer in seconds: *what's happening here, how serious is it, what should I do, who said so, where do I go for more*.

Three structural approaches:

- **A — Linear / long-form.** Top-down narrative: stale banner → header → breadcrumb → hero → status block → action bar → emergency strip → alerts → methodology → fontes → Defesa Civil estadual → footer. Like a Wikipedia article — read top to bottom, comprehensive.
- **B — Tabbed sections.** Status + actions + emergency strip pinned at top. Three tabs below: **Alertas** (default), **Metodologia**, **Fontes & Defesa Civil**. Faster for users who know what they want.
- **C — Two-column desktop / linear mobile.** Desktop puts alerts in the main column, with a permanent aside containing fontes, Defesa Civil estadual, and **navigation to other states in the same region** (Nordeste shown). Mobile collapses aside into sections at the end. Mirrors the home dashboard's two-column logic.

## How to View

```
open .planning/sketches/004-state-detail-page/index.html
```

Each variant pane shows desktop (1100px) AND mobile (390px) side-by-side using the same data (Maranhão, vermelho, 3 alertas, with CEMADEN stale banner active).

## Variants

- **A — Linear** — `<scroll>` from top to bottom. Best for readers who want the whole story; everything indexable in one URL.
- **B — Tabbed** — `<scroll>` ends at the alerts tab content. Cleanest "I came here for an alert" experience; methodology and fontes are one tap away.
- **C — Two-column** — desktop uses the right rail for fontes / Defesa Civil / nearby states; mobile streams them as final sections. Best for navigation between states (Nordeste neighbors).

## What to Look For

1. **WhatsApp landing.** A user lands cold from a shared link. Which variant gets them to "what's happening, what do I do" fastest? A wins on first-screen density; B wins on focus; C wins if they want to compare with neighbor states.
2. **Methodology placement.** A puts it inline (read the article); B puts it in a tab (don't bother me with this); C puts it after alerts (reasonable middle).
3. **Defesa Civil estadual link** — required REQ. A places it after methodology; B inside the third tab; C in the right aside (always visible). Which positioning maps to actual user intent ("how do I reach my state's defense agency")?
4. **Stale-source banner** at the top — locked principle from sketch 003. All variants honor it. Watch how it composes with the rest of the chrome.
5. **Compartilhar button** — the action bar appears in all three but at slightly different visual weight. Which makes "share this with my family on WhatsApp" feel obvious without being pushy?
6. **Mobile parity.** On the phone view, A becomes a long scroll, B keeps the tabs (they wrap horizontally), C streams the aside as final sections. Which mobile experience holds up best on 3G + small screen?
7. **Neighbor states navigation** (variant C only) — does this matter for the audience, or is it sidebar bloat? In a real emergency, "what's happening next door" can be load-bearing.

## Notes

- All variants honor the locked principles from earlier sketches: stale notice always at top, 199/193/190 mandatory, fonte oficial in mono-font, copy directly transferable to `pt-BR.ts` constants.
- The OG card / Twitter card preview is **out of scope** for this sketch — that's a meta-tag concern visible in the WhatsApp paste preview, not in the rendered page itself. Will sketch separately if needed.
- Hero shows a `subline` ("3 alertas · 21 municípios afetados · pop. estimada 4.2M"). Population/municipality counts are nice-to-have — only include in v1 if data is cheap to ship.
- "Outros estados · Nordeste" navigation in C is per-region. The data already segments by region; extracting these neighbors costs nothing.
- Alert detail card now includes `dl.facts` for structured Afeta/Início/Válido/Severidade — same pattern as mobile home cards (sketch 002 winner B), composed deeper here.

## Implementation hints

- **Variant A** is path-of-least-resistance for Next.js: a single Server Component reading the snapshot and rendering the full page server-side. Zero client JS needed. No tabs to wire.
- **Variant B** needs client-side state for the active tab — either a simple `'use client'` component scoped to the tab bar, or URL-based `?tab=alerts` for shareable deep-tabs (preferred — preserves the WhatsApp-shareable invariant).
- **Variant C** desktop is `grid-cols-[minmax(0,1fr)_320px] gap-8`; mobile is just stacked. The aside is server-rendered with the same snapshot. No client JS needed.
- All variants use the same Server Component API: snapshot, state UF, and a single render. Theme tokens come from `sketch-findings-enso-brasil` skill.
- Population counts (if shown) come from IBGE static data baked at build time — no per-request fetch.
