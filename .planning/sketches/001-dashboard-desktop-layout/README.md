---
sketch: 001
name: dashboard-desktop-layout
question: "Does the 40/60 panel-on-left + map-on-right composition feel right at ≥1024px, or should the map breathe more?"
winner: "C"
tags: [layout, desktop, hierarchy]
---

# Sketch 001: Dashboard Desktop Layout

## Design Question

The brief specifies a 40 / 60 split (info panel left, map right). Before locking that, compare against two alternatives that subtly shift weight toward the map and one that inverts the composition. The decision sets the page chrome for v1 and is hard to change later without reflowing every state-detail screen.

## How to View

```
open .planning/sketches/001-dashboard-desktop-layout/index.html
```

(or paste the absolute path into your browser)

## Variants

- **A — 40 / 60 (per spec).** Info panel left at 40%, map right at 60%. Single header strip with global timestamp. Legend sits above the map.
- **B — 35 / 65 + sticky update band.** Narrower panel; second strip below the header shows freshness + per-source health + at-a-glance counts. Map gets more room.
- **C — Top-legend strip + 50 / 50, map on left.** Legend becomes a full-width strip above the body with state-counts per level. Map dominates the visual entry on the left; panel anchors on the right.

## What to Look For

1. **First-glance hierarchy** — when you open it, does your eye land on the map (national overview) or the panel (specific state)? The "right" answer depends on whether the audience comes for "show me my state" (panel-first) or "show me Brazil right now" (map-first).
2. **Panel density at 40% vs 35%** — does the alert list feel cramped at 35%? Test by reading the meta lines (timestamp + source link) without horizontal scroll.
3. **Legend placement** — above the map (A, B) vs above everything (C). Which makes the color encoding feel more like a contract and less like decoration?
4. **Update freshness signal** — header-only (A) vs dedicated band (B) vs implied via legend counts (C). Which conveys "this is alive" without alarming?
5. **Map breathing room** — does the map feel cramped at 60% (A), comfortable at 65% (B), or unnecessarily roomy at 50% (C)?
6. **Reading direction** — Brazilian users read left-to-right; the panel-first composition (A, B) leads with the personalized answer. C asks the user to scan the country first. Which matches the audience priority (vulnerable populations seeking their own state)?

## Decision (winner: C)

**Top-legend strip + 50/50, map on the left.** The full-width legend doubles as a national-scale snapshot ("17 sem alertas · 6 atenção · 3 alerta · 1 perigo") that anchors the page. The 50/50 split gives the map more weight than the spec's 40/60 without crowding the panel. Map-first reading direction works for a national dashboard where users land on `/` to scan Brazil; per-state focus moves to the deep-link route `/estado/{uf}` (REQ DASH-04).

Implementation hint: top-legend counts derive from the snapshot — keep the legend a server component fed by the same payload that paints the map. Avoid client-side recomputation.

## Notes

- Map rendering is **schematic** — simplified rectangle tiles with approximate geographic placement, country silhouette behind. Production uses precise IBGE TopoJSON via `react-simple-maps` with Albers conic projection. Don't judge the map aesthetics, judge the composition.
- All variants share the same theme tokens from `../themes/default.css`. Risk colors match INMET portal palette per `claude-design-prompt.md`.
- Disclaimer is rendered server-side equivalent (in plain HTML in the sketch). No client JS dependency for the public-safety disclaimer.
- The example state shown (Maranhão / red) and the orange/yellow distribution match the realistic example data in the design prompt.

## Implementation hints (for the winner)

- Variant A path-of-least-resistance for Next.js + Tailwind: `<main className="grid grid-cols-[40%_60%] min-h-[calc(100vh-60px)]">` with a sticky `<header>` and a separate `<footer>`. Each child is a server component; map is a client island under `'use client'` once.
- If B wins, the update band is its own server component with revalidation tied to the snapshot timestamp. Cheap.
- If C wins, the top legend becomes the single source of truth for state counts — derive from snapshot.
