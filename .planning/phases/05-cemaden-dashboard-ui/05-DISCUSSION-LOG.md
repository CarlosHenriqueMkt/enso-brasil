# Phase 5: CEMADEN + Dashboard UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 5-cemaden-dashboard-ui
**Areas discussed:** CEMADEN adapter strategy, Desktop map↔panel interaction, /texto route content shape, Share + filter behavior

---

## CEMADEN adapter strategy

| Option                                   | Description                                                                                                                                                                                                                     | Selected |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| DevTools discovery + adapter             | 30–60 min DevTools session against painelalertas.cemaden.gov.br to capture backing endpoint. Build adapter with strict zod + payload-hash drift + contract test. Mark as `stability: unstable`. Risk: endpoint breaks silently. | ✓        |
| Outreach + INMET-only ship               | Defer CEMADEN further. Send DEPLOY-06 outreach in P5 asking for stable API. Ship dashboard INMET-only with explicit "CEMADEN: aguardando endpoint estável" banner. Move ADAPT-01 to P6/M2.                                      |          |
| PED-derived risk + transparency          | Use PED rainfall data, define accumulation thresholds. Reframe as "chuva acumulada" indicator, NOT alerta CEMADEN. Anti-feature risk: derives alerts where CEMADEN doesn't — violates aggregator-vs-authority line.             |          |
| I'll decide after research subagent runs | Spawn research subagent for live painelalertas fetch + response shape mapping; decide based on findings.                                                                                                                        |          |

**User's choice:** DevTools discovery + adapter
**Notes:** Discovery is human-in-the-loop. First P5 plan blocks on the captured endpoint artifact (URL, method, payload, sample response, headers, BRT timestamp format). Persist as `.planning/phases/05-cemaden-dashboard-ui/05-cemaden-endpoint-capture.md`.

---

## Desktop map↔panel interaction

| Option                             | Description                                                                                                                                         | Selected |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| URL-param-sync, RSC-first          | Click → /?uf=SP (Server Component re-renders panel). Browser back/forward works. Map is Client Component, panel is Server Component.                |          |
| Client-side panel swap             | Click → useState updates panel (no URL change). Hover tooltip. Share button copies /estado/{uf}. Faster perceived; loses deep-link from home.       |          |
| Hybrid: client swap + URL on share | Client swap on click; history.replaceState only on share. Back button does NOT cycle.                                                               |          |
| Full SSR on each click             | Click → Link nav to /estado/{uf}. Home is read-only overview; per-state page is the canonical detail. Map = navigation menu. Simplest; works no-JS. | ✓        |

**User's choice:** Full SSR on each click
**Notes:** Map state shapes wrap `<Link href="/estado/{uf}">`. Home stays read-only. Aligns with WCAG (no-JS works), `/texto` mirror semantics, and cacheability.

---

## /texto route content shape

| Option                                       | Description                                                                                                                            | Selected |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Single table, all 27 rows, grouped by region | One table per region. Columns: Estado / Nível / Alertas ativos / Atualizado há. Anchor links to same-page sections. Smallest payload.  |          |
| Table + per-state expanded sections          | Top: regional tables. Below: 27 `<article>` sections per UF with h3 + alert list + sources + timestamps. Single long SSR page.         | ✓        |
| Index + per-state /texto/{uf}                | /texto = lean index. Per-state pages live at /texto/{uf}. N+1 routes; each tiny. Better for failing connections.                       |          |
| Prose-first, table optional                  | Prose summary at top ("3 estados em Perigo: SP, RJ, MG..."). Tables as supporting data. Friendlier for screen readers; harder to scan. |          |

**User's choice:** Table + per-state expanded sections
**Notes:** Anchor links from table rows (`#sp`, `#rj`, etc.) → state sections. No `/texto/{uf}` sub-routes. Pure semantic HTML; no decorative icons (text labels carry severity).

---

## Share + filter behavior

### Share (DASH-08)

| Option                                   | Description                                                                                                                            | Selected |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Web Share API + clipboard fallback       | navigator.share() on supported. Fallback: clipboard copy + toast. Native share sheet on mobile.                                        |          |
| Direct wa.me URL                         | Anchor to https://wa.me/?text={text}. WhatsApp-specific. Works no-JS. Loses native share for non-WA users.                             |          |
| Both: wa.me primary, clipboard secondary | Primary = wa.me link (no-JS). Secondary "Copiar link" = clipboard. Honest about WhatsApp-first BR audience without locking out others. | ✓        |

**User's choice:** Both: wa.me primary, clipboard secondary
**Notes:** Share text template (locked PT-BR): `"{Estado}: {Nível} — {explicação}. Veja em {URL}."` Both buttons render on `/estado/{uf}` and home cards.

### Filter (DASH-07)

| Option                               | Description                                                                                                             | Selected |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| URL-param ?region=sul, single select | Chips link to /?region=sul. Server filters cards. Active chip highlighted. "Todas" = /. Zero JS.                        | ✓        |
| URL-param multi-select via comma     | /?region=sul,sudeste. Server splits + filters. Each chip toggles. Still zero client JS.                                 |          |
| Default to user's UF (with geo hint) | Server reads accept-language or Vercel geo header to default filter. Chip overrides. More magical; risks wrong on VPNs. |          |

**User's choice:** URL-param ?region=sul, single select
**Notes:** Active chip uses `aria-current="page"` + visual treatment. Default (no param) = all 27 states. No geo-IP magic per CLAUDE.md anti-feature stance on user tracking.

---

## Claude's Discretion

- Hover tooltip implementation choice (CSS-only via `<title>` vs minimal JS) — pick what hits A11Y-05 perf budget (LCP < 2.5s, total transfer < 200 KB).
- Component file organization under `src/components/` — match P1/P2 conventions.
- Loading state for `/estado/{uf}` first paint — sketch finding mandates "SSR-instant + last-known fallback (never skeleton)"; pick implementation consistent with that.
- Map state click target sizing — choose values that pass Lighthouse mobile + Playwright keyboard nav (A11Y-02).
- "Como calculamos isso?" anchor target (DASH-09) — choose stable README anchor; verify before linking.

## Deferred Ideas

- INPE Queimadas / NASA FIRMS (ADAPT-03) → P6.
- CEMADEN outreach packet (DEPLOY-06) → P7.
- Per-state historical comparison → M10.
- ES/EN translations → REMOVED (M12 deleted).
- Push/email/Telegram notifications → M11.
- Plausible analytics → P7 (DEPLOY-05).
- Public API → M8.
