# Phase 5: CEMADEN + Dashboard UI — Specification

**Created:** 2026-05-16
**Ambiguity score:** 0.084 (gate: ≤ 0.20)
**Requirements:** 14 locked

## Goal

Ship the user-facing v1 dashboard (home `/`, per-state `/estado/{uf}`, text-only `/texto`, region filter, WhatsApp share) AND land the CEMADEN adapter carry-over from Phase 4 Path C. After this phase, `/api/states` returns data from ≥2 official sources (INMET + CEMADEN) and the public surface meets WCAG AA + a Lighthouse 3G perf budget.

## Background

After Phase 4 (merged as `2b6fad2`, 2026-05-11), the project has:

- **Live data path** — `/api/ingest` orchestrates `Promise.allSettled([inmetAdapter])`; `/api/states` returns the snapshot; cache + DB + dedup + risk engine all working.
- **One real source** — INMET adapter shipped (41 unit tests, 100/100/100/100 coverage). CEMADEN was deferred from P4 under SPEC's Q6=a fallback (Path C, 2026-05-05); only an inline `cemadenStub` factory exists in `tests/contract/cross-source-isolation.test.ts`.
- **Known INMET schema drift** — live `/avisos/ativos` returns `{hoje:[...], futuro:[...]}` envelope, not the flat array the P4 adapter assumes (P5.1 fix documented in `04-05-SUMMARY`).
- **No UI surface yet** — `src/app/page.tsx` still renders the P1 disclaimer shell; no map, no state cards, no `/estado/{uf}`, no `/texto`.
- **Locked UI design contract** — sketch findings (2026-04-28) freeze layout, theme tokens, edge-state copy, `/estado/{uf}` two-column, search-via-URL-params, SSR-instant loading.
- **CEMADEN endpoint undocumented** — `painelalertas.cemaden.gov.br` is an SPA; backing endpoint requires DevTools network capture (decided in `05-CONTEXT.md` D-01).

## Requirements

1. **CEMADEN endpoint capture artifact (pre-req gate)**: A captured, committed endpoint specification exists before any CEMADEN adapter code lands.
   - Current: No CEMADEN endpoint discovered; `painelalertas.cemaden.gov.br` SPA backing API is undocumented.
   - Target: `.planning/phases/05-cemaden-dashboard-ui/05-cemaden-endpoint-capture.md` committed, containing URL, HTTP method, query params, sample response JSON (≥1 real capture), required headers/auth, observed BRT timestamp format.
   - Acceptance: File exists in repo; first CEMADEN adapter plan (Wave 0 or 1) references the captured URL verbatim; no CEMADEN adapter PR merges without this artifact.

2. **CEMADEN adapter (ADAPT-01)**: Production CEMADEN adapter integrated into the registry.
   - Current: Only inline `cemadenStub` factory in a test file; no `src/lib/sources/cemaden.ts`.
   - Target: `src/lib/sources/cemaden.ts` ships via factory pattern (mirrors `inmet.ts`), strict zod schema, `sourceError()` for failures, BRT timestamp handling (`+ -03:00` offset), `stability: "unstable"` in `registry-meta.ts`, golden-file fixture at `tests/fixtures/sources/cemaden-<ISO-date>.json`, contract test that fails on schema drift. Registry appends `cemadenAdapter`.
   - Acceptance: `pnpm test` passes including new CEMADEN unit + contract tests; `tests/contract/cross-source-isolation.test.ts` replaces inline `cemadenStub` with the real `cemadenAdapter`; `/api/ingest` writes CEMADEN alerts to Postgres on a manual trigger using a captured fixture.

3. **INMET P5.1 schema drift fix**: INMET adapter handles the live `{hoje:[...], futuro:[...]}` envelope shape.
   - Current: P4 adapter assumes flat array from `/avisos/ativos`; live API returns `{hoje, futuro}` envelope. Adapter currently fails or returns 0 alerts.
   - Target: INMET adapter normalizes the envelope (concatenate or select-active per source semantics, documented in code); fixture refreshed from live API; contract test green.
   - Acceptance: New INMET contract test against `{hoje,futuro}` fixture passes; existing 41 unit tests still pass; `/api/ingest` end-to-end against live INMET returns ≥1 alert when alerts exist nationally.

4. **Home page — 27-state overview (DASH-01, DASH-02 desktop, DASH-03 mobile)**: `/` renders all 27 Brazilian states with current risk level, desktop map left + cards / mobile vertical card stack.
   - Current: `/` renders only the P1 disclaimer shell. No map, no state list.
   - Target: Home Server Component reads snapshot, renders 27 states; desktop = Albers conic map (parallels [-7,-22], rotate [54,0]) using `carolinabigonha/br-atlas` TopoJSON on left, cards on right (sketch finding 01 layout); mobile = vertical card stack, map secondary below (sketch finding 05-A constrained mobile-up for tablet); each state shape on map wraps `<Link href="/estado/{uf}">`.
   - Acceptance: Viewing `/` server-rendered (JS off) shows 27 states with risk levels; clicking a map shape navigates to `/estado/{uf}`; mobile width 360px renders cards without horizontal scroll.

5. **Per-state page (DASH-04)**: Deep-linkable `/estado/{uf}` for all 27 UFs with social card metadata.
   - Current: Route does not exist.
   - Target: `/estado/{uf}` dynamic route renders per sketch finding 004 Variant C two-column layout (permanent aside); Open Graph + Twitter card meta tags include state name, level, explanation, share URL; canonical URL uses `NEXT_PUBLIC_SITE_URL`.
   - Acceptance: All 27 UFs return 200 server-rendered with full data; unknown UF returns 404; pasting a state URL into WhatsApp Web shows correct OG preview (text + state name + level).

6. **Risk badges and state rows (DASH-05, DASH-06, DASH-10)**: Each state surface shows badge (color + icon + label), plain-language explanation, alert list with attribution + source link, last-update timestamp; yellow level meets WCAG AA contrast.
   - Current: No badge or row components exist.
   - Target: Badge component renders the 5 levels with locked PT-BR labels ("Sem alertas" / "Atenção" / "Alerta" / "Perigo" / "Dados indisponíveis"), icon (✓/⚠/⚠⚠/⛔/?), and color; row component shows the explanation from `RISK-09`, per-alert source attribution + monospace-domain link to original publication (FOUND-10), relative timestamp ("Atualizado há 8 minutos"); yellow `#eab308` uses darkened token OR black text only — NEVER white on yellow.
   - Acceptance: Visual contract matches sketch finding 03 tokens; axe-core reports zero contrast violations for badge + row on yellow level; relative timestamp updates on cache refresh.

7. **Region filter (DASH-07)**: Single-select region filter via URL params, zero client JS.
   - Current: No filter UI.
   - Target: 5 region chips (Norte / Nordeste / Centro-Oeste / Sudeste / Sul) + "Todas" chip; chips are anchor links to `/?region={slug}` / `/`; home reads `searchParams.region` server-side and filters card list; active chip uses `aria-current="page"` + visual treatment; no geo-IP default.
   - Acceptance: Clicking each chip navigates with URL change; filtered set matches the documented UF→region mapping; "Todas" returns full 27; works with JS disabled.

8. **Share button (DASH-08)**: WhatsApp-primary + clipboard-secondary share controls on each state surface.
   - Current: No share UI.
   - Target: Per-state and per-card share button = anchor to `https://wa.me/?text={encodedText}` (no-JS); secondary "Copiar link" button uses `navigator.clipboard.writeText(url)` + toast confirmation. Share text template (locked): `"{Estado}: {Nível} — {explicação}. Veja em {URL}."`
   - Acceptance: wa.me link works with JS disabled; clipboard button shows confirmation toast on click; share text matches template verbatim.

9. **Formula explainer link (DASH-09)**: Each state row links to a stable PT-BR README anchor that explains the v0 formula.
   - Current: No link.
   - Target: "Como calculamos isso?" anchor link points to a verified `#` section in the public PT-BR README explaining v0 risk levels + severity mapping; anchor existence verified before merge.
   - Acceptance: Clicking the link from any state row scrolls to a real, populated section in the GitHub README; CI link-check passes.

10. **Accessible text-only route (A11Y-03)**: `/texto` route renders full data, no map, server-rendered, screen-reader-friendly.
    - Current: Route does not exist.
    - Target: Single SSR page; top section = one `<table>` per region (columns Estado | Nível | Alertas ativos | Atualizado há) with row anchor links to per-UF sections; below = 27 `<article>` sections with `<h3>` heading, plain-language explanation, alert list (per-alert source link + timestamp), region tag; pure semantic HTML, no icons (text labels carry severity); no client JS required; no `/texto/{uf}` sub-routes.
    - Acceptance: `/texto` renders fully with JS disabled; tab order goes table → article sections; screen-reader heading outline = h1 → region h2 → state h3.

11. **WCAG AA verified (A11Y-01, A11Y-02, A11Y-04, A11Y-06)**: Axe-core in CI proves zero critical violations on home + 3 sampled UF pages + `/texto`; keyboard nav + color-blind safety + live-region announcement preserved.
    - Current: No axe-core integration in CI; no keyboard nav verification.
    - Target: CI step runs axe-core against `/`, `/estado/sp`, `/estado/rj`, `/estado/am` (or fixed sample), `/texto`; tab order logical on map + cards; every risk level identified by icon + text + color (color is third); screen-reader live region announces state-level change when state route loads.
    - Acceptance: Axe-core CI step exits 0; manual Playwright keyboard nav test passes (tab through map → cards → filter → share without dead-end focus); color-blind simulator (deuteranopia + protanopia) preserves level differentiation.

12. **Performance budget (A11Y-05)**: Lighthouse 3G profile meets perf ≥ 90, LCP < 2.5s, total transfer < 200 KB on home + 3 sampled UF pages + `/texto`.
    - Current: Routes do not exist; budget unverified.
    - Target: CI Lighthouse step runs against the same 5 routes as A11Y-01; perf score, LCP, and transfer size all within budget on simulated Slow 4G / 3G profile.
    - Acceptance: Lighthouse CI step exits 0 on all 5 routes; per-route report archived as CI artifact.

13. **CEMADEN failure isolation (DATA-04 verified at P5)**: Phase preserves the registry contract — CEMADEN failure does not break INMET flow or UI.
    - Current: Registry uses `Promise.allSettled` (N-arity safe per P4); inline `cemadenStub` rejection proves isolation in test.
    - Target: Real `cemadenAdapter` substituted for the stub; cross-source isolation test rewritten to use the real adapter rejecting via `sourceError`; `sources_health` records CEMADEN last-success timestamp; UI surfaces staleness ≥30 min per DATA-07 banner pattern (top-of-page, SSR, FOUND-08).
    - Acceptance: `tests/contract/cross-source-isolation.test.ts` green with `cemadenAdapter` instead of inline stub; INMET-only ingest tick on simulated CEMADEN failure produces full snapshot; staleness banner renders SSR on `/` when `sources_health` reports CEMADEN > 30 min stale.

14. **Per-state CEMADEN fan-out forbidden**: CEMADEN adapter makes a single national-scope call per cron tick.
    - Current: No CEMADEN code exists.
    - Target: Adapter calls captured endpoint exactly once per `fetch()` invocation; no per-UF iteration; if captured endpoint requires per-UF param, the adapter plan must escalate before implementation.
    - Acceptance: Code review confirms zero per-UF loops in `src/lib/sources/cemaden.ts`; ingest tick logs show 1 CEMADEN HTTP call per cron run; Upstash + Neon + Vercel function invocations remain within free-tier soak headroom.

## Boundaries

**In scope:**

- CEMADEN endpoint discovery artifact (`05-cemaden-endpoint-capture.md`) — pre-req gate before adapter code
- `src/lib/sources/cemaden.ts` + zod schema + golden fixture + contract test + `stability: "unstable"` registry annotation
- INMET P5.1 schema drift fix (`{hoje, futuro}` envelope) — adapter normalization + fixture refresh + contract test
- Home `/` (Server Component): map (desktop) + cards (mobile/tablet) + region filter + share buttons + 27-state overview
- `/estado/{uf}` dynamic route: two-column layout (sketch finding 004 Variant C) + OG/Twitter card metadata
- `/texto` SSR route: regional tables + per-UF article sections, anchor-linked
- Risk badges + state row component + yellow contrast fix + monospace source domains (FOUND-10 reuse)
- Region filter via `?region={slug}` URL param (server-filtered, zero client JS)
- WhatsApp wa.me primary + clipboard secondary share controls + locked PT-BR share text template
- "Como calculamos isso?" link to PT-BR README anchor (verified stable)
- Axe-core CI step on home + 3 sampled UF pages + `/texto`
- Lighthouse CI step on the same 5 routes (perf ≥ 90 / LCP < 2.5s / transfer < 200 KB on 3G profile)
- Keyboard nav verification on map + cards
- Screen-reader live region for state-level change
- Tailwind v4 `@theme` token port from sketch findings `themes/default.css`
- Stale-source banner integration (DATA-07 banner rendered at top of `/` per FOUND-08)

**Out of scope:**

- INPE Queimadas / NASA FIRMS adapter (ADAPT-03) — Phase 6 per ROADMAP
- Public deployment + domain + analytics + outreach (DEPLOY-01..06) — Phase 7
- 7-day soak run / observability wiring (Sentry/GlitchTip) — Phase 6
- Daily archive cron beyond what P2 already provides — already in place from P2
- ENSO global status / forecast / preparedness / videos / public API — milestones M2–M13
- Push/email/Telegram notifications — M11
- ES/EN translations — REMOVED (M12 deleted)
- Per-state historical comparison UI — M10
- `next-intl` reintroduction — locked out at project level
- Forecasting, alert authoring, replacing Defesa Civil — anti-features (CLAUDE.md)
- User accounts, social, comments, user-submitted reports — anti-features
- `/texto/{uf}` sub-routes — single-page semantic HTML only (D-07)
- Geo-IP region default — anti-feature (D-11)
- Web Share API — wa.me + clipboard only (D-09)
- Client-side panel swap on home — full SSR navigation only (D-05/D-06)

## Constraints

- **Stack locked:** Next.js latest stable (16.x line), TypeScript strict, Tailwind v4 `@theme` block, `react-simple-maps` + `carolinabigonha/br-atlas` TopoJSON, ofetch via existing `src/lib/http/fetcher.ts`, no `next-intl`.
- **Map projection locked:** Albers conic, parallels `[-7, -22]`, rotate `[54, 0]`.
- **Risk levels locked:** `green | yellow | orange | red | unknown` (5 levels).
- **PT-BR labels locked verbatim:** "Sem alertas / Atenção / Alerta / Perigo / Dados indisponíveis".
- **Hazard vocabulary locked:** CEMADEN/INMET terms verbatim (queimada vs incêndio; estiagem vs seca; enchente vs inundação).
- **CEMADEN call shape:** Single national-scope call per cron tick — per-UF fan-out forbidden.
- **CEMADEN stability annotation:** `stability: "unstable"` in `registry-meta.ts` — drift detector logs schema migrations.
- **BRT timestamp handling:** Naive timestamps from CEMADEN treated as UTC-3 no DST; adapter throws if source migrates to TZ-aware format.
- **Adapter isolation (dep-cruiser):** `src/lib/risk/**` cannot import UI or adapter code; UI consumes risk output via snapshot shape only.
- **Edge runtime constraint:** `/api/states` stays edge (already P2); adapters stay Node-only; UI routes can be edge if they don't touch adapters directly.
- **No client JS for filter, share-primary, or `/texto`:** zero JS dependency for core data access paths.
- **Yellow contrast:** darkened token OR black text only on yellow background — never white on yellow.
- **Disclaimer + LGPD:** SSR-rendered, never client-only; existing P1 layout reused intact.
- **Free-tier headroom:** all paths must respect Vercel Functions / Upstash / Neon / GH Actions free-tier soak budget (formal soak verification deferred to P6, but P5 architecture must not preclude it).
- **Pre-commit gates active:** lint-staged + gitleaks + prettier — all UI commits must pass.

## Acceptance Criteria

- [ ] `.planning/phases/05-cemaden-dashboard-ui/05-cemaden-endpoint-capture.md` committed BEFORE any CEMADEN adapter code merges
- [ ] `src/lib/sources/cemaden.ts` exists, factory-pattern, strict zod, BRT offset, `sourceError()` factory
- [ ] CEMADEN registry entry has `stability: "unstable"`
- [ ] Golden CEMADEN fixture at `tests/fixtures/sources/cemaden-<ISO-date>.json` committed
- [ ] CEMADEN contract test green; fails when fixture shape changes
- [ ] `tests/contract/cross-source-isolation.test.ts` uses real `cemadenAdapter` (inline stub removed)
- [ ] INMET adapter normalizes `{hoje, futuro}` envelope; refreshed fixture + new contract test green
- [ ] Existing 41 INMET unit tests still pass
- [ ] `/` renders 27 states server-rendered (verify JS-off)
- [ ] Desktop `/` shows Albers conic map (locked params) + cards layout per sketch finding 01
- [ ] Mobile `/` at 360px width renders cards with no horizontal scroll
- [ ] Map state shapes navigate via `<Link>` to `/estado/{uf}` (no client state)
- [ ] `/estado/{uf}` returns 200 for all 27 UFs, 404 for unknown UF
- [ ] `/estado/{uf}` two-column layout matches sketch finding 004 Variant C
- [ ] OG + Twitter meta tags render correct preview in WhatsApp Web for ≥3 state URLs
- [ ] Risk badge component renders 5 levels with locked labels + icons + colors
- [ ] State row shows explanation, source attribution, monospace source domain, relative timestamp
- [ ] Yellow level passes WCAG AA contrast (axe-core zero violations)
- [ ] Region filter chips link to `/?region={slug}`; "Todas" links to `/`
- [ ] Region filter works JS-off; active chip uses `aria-current="page"`
- [ ] No geo-IP region default
- [ ] Per-state and per-card share button = `https://wa.me/?text={encoded}` anchor
- [ ] "Copiar link" secondary button writes canonical URL to clipboard + toast confirms
- [ ] Share text matches template `"{Estado}: {Nível} — {explicação}. Veja em {URL}."` verbatim
- [ ] "Como calculamos isso?" links to a verified, populated PT-BR README anchor
- [ ] `/texto` renders fully JS-off with regional tables + 27 article sections
- [ ] `/texto` tab order: table → articles; heading outline: h1 → region h2 → state h3
- [ ] Axe-core CI step exits 0 on `/`, 3 sampled `/estado/{uf}`, `/texto`
- [ ] Lighthouse CI step exits 0 on the same 5 routes: perf ≥ 90, LCP < 2.5s, transfer < 200 KB
- [ ] Playwright keyboard nav test passes on map + cards + filter + share
- [ ] Screen-reader live region announces state-level on `/estado/{uf}` route load
- [ ] Stale-source banner (CEMADEN ≥ 30 min) renders SSR at top of `/`
- [ ] CEMADEN ingest makes exactly 1 HTTP call per cron tick (no per-UF loops)
- [ ] CEMADEN failure on ingest still produces full snapshot from INMET (cross-source isolation green end-to-end)

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes                                                                       |
| ------------------- | ----- | ----- | ------ | --------------------------------------------------------------------------- |
| Goal Clarity        | 0.92  | 0.75  | ✓      | 14 falsifiable requirements; INMET P5.1 + DevTools gate added discrete      |
| Boundary Clarity    | 0.92  | 0.70  | ✓      | Explicit in/out lists with reasoning; 4 routes in scope, P6/P7 + M2–M13 out |
| Constraint Clarity  | 0.90  | 0.65  | ✓      | Stack, projection, labels, vocabulary, isolation, perf scope all locked     |
| Acceptance Criteria | 0.92  | 0.70  | ✓      | 34 pass/fail checkboxes; CI gates for axe + Lighthouse defined              |
| **Ambiguity**       | 0.084 | ≤0.20 | ✓      |                                                                             |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective                       | Question summary                                           | Decision locked                                                                         |
| ----- | --------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 0     | Initial assessment (no interview) | Score ambiguity from ROADMAP + REQUIREMENTS + CONTEXT only | Gate already passing at 0.145; one optional round agreed                                |
| 1     | Researcher + Boundary Keeper      | DevTools capture treatment in SPEC?                        | Pre-req gating artifact — `05-cemaden-endpoint-capture.md` required before adapter code |
| 1     | Researcher + Boundary Keeper      | INMET P5.1 schema drift fix scope?                         | In scope, separate requirement with discrete acceptance (Req 3)                         |
| 1     | Researcher + Boundary Keeper      | A11Y-05 perf budget applies to which routes?               | `/` + 3 sampled `/estado/{uf}` + `/texto` — same routes as axe-core CI                  |

Note: P5 ran discuss-phase BEFORE spec-phase (CONTEXT.md `5b8cef0` 2026-05-11). SPEC.md is retroactive — it locks the requirements that CONTEXT.md's 11 decisions already implied, plus 3 round-1 clarifications. discuss-phase deliverables (CONTEXT.md, DISCUSSION-LOG.md) remain authoritative for HOW; this SPEC.md is authoritative for WHAT.

---

_Phase: 05-cemaden-dashboard-ui_
_Spec created: 2026-05-16_
_Next step: /gsd-plan-phase 5 — research + structured plans + plan-check (CONTEXT.md + SPEC.md both consumed by planner)_
