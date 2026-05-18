# Phase 5: CEMADEN + Dashboard UI - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the public-facing v1 dashboard surface: 27-state overview at `/`, deep-linkable per-state pages at `/estado/{uf}`, accessible text-only mirror at `/texto`, region filter chips, WhatsApp-first share button. Plus the CEMADEN adapter carry-over from Phase 4 Path C (ADAPT-01), bringing total integrated sources to ≥2 and satisfying v1 DoD #2.

**In scope (REQ-IDs, mapped per ROADMAP not stale REQUIREMENTS.md table):** ADAPT-01 (CEMADEN), DASH-01..10 (10 dashboard reqs), A11Y-01..06 (6 accessibility reqs). 17 requirements total.

**Out of scope (deferred to later phases):** ADAPT-03 (INPE/FIRMS 3rd source → P6), DEPLOY-01..06 → P7. M2–M11 capabilities (explainer page, metodologia page, expanded view, ENSO global, preparedness, public API, etc.) — all out of v1.

</domain>

<decisions>
## Implementation Decisions

### CEMADEN Adapter Strategy

- **D-01 — DevTools discovery path chosen.** Schedule a 30–60 min human-in-the-loop browser session against `https://painelalertas.cemaden.gov.br` to capture the SPA's backing endpoint via network inspection. Persist findings as `.planning/phases/05-cemaden-dashboard-ui/05-cemaden-endpoint-capture.md` (URL, method, query params, sample response JSON, auth/headers, observed BRT timestamp format) BEFORE plan-phase finalizes the CEMADEN adapter plan. First P5 plan blocks on this artifact.

- **D-02 — Adapter built with explicit instability markers.** Implement `src/lib/sources/cemaden.ts` with: strict zod schema validation, `payload_hash` drift detection (logs schema migration), contract test against captured fixture, `stability: "unstable"` annotation in registry-meta drift detector. Failure mode: registry continues with INMET-only when CEMADEN throws; `sources_health` records last-success timestamp; UI surfaces staleness ≥30 min per DATA-07.

- **D-03 — Per-state CEMADEN fan-out forbidden.** Single national-scope call only (per P4 RESEARCH constraint + free-tier rule). If endpoint requires per-UF param, document plan + escalate.

- **D-04 — BRT timestamp handling.** CEMADEN naive timestamps assumed UTC-3 no DST (Brazil 2019 abolition, verified P4 RESEARCH A6). Adapter explicitly applies `+ -03:00` offset; throws if source migrates to TZ-aware format (forces fixture refresh).

  > **SUPERSEDED 2026-05-18 — see `05-02-CONTEXT-corrections.md`.** Endpoint capture (`05-cemaden-endpoint-capture.md`, commit `2390be4`) proves CEMADEN serves UTC (payload self-labels `atualizado: "DD-MM-YYYY HH:MM:SS UTC"`). Adapter parses as UTC and outputs ISO-Z; presentation layer converts to `America/Sao_Paulo` via `@date-fns/tz`, with per-UF overrides for AC (UTC-5) and Manaus (UTC-4). DO NOT apply a flat -03:00 offset.

### Desktop Interaction Model (Map ↔ Panel)

- **D-05 — Full SSR navigation, no client-side panel swap.** Home `/` is a read-only overview: map (Albers conic, locked projection params) + all 27 state cards. Map state shapes wrap `<Link href="/estado/{uf}">`. Hover renders a tooltip (CSS-only or minimal JS, no panel mutation). `/estado/{uf}` is the canonical per-state detail page (sketch finding 004 two-column layout). Back/forward works natively. Simplest model; aligns with WCAG (works no-JS) and `/texto` mirror semantics.

- **D-06 — No interactive selection state on home.** Eliminates the need for client useState + URL sync hybrid. Each click is a navigation, cached at the edge per snapshot.

### `/texto` Route Shape (A11Y-03)

- **D-07 — Regional tables + per-UF expanded articles, single SSR page.** Top: one `<table>` per region (Norte / Nordeste / Centro-Oeste / Sudeste / Sul) with columns Estado | Nível | Alertas ativos (count) | Atualizado há. Below: 27 `<article>` sections (one per UF) with `<h3>` heading, plain-language explanation, alert list (source link + timestamp per alert), region tag. Table rows anchor-link to state sections (`#sp`, `#rj`, ...). No `/texto/{uf}` sub-routes.

- **D-08 — Semantic HTML primary; no decoration.** No icons (unicode or otherwise) in `/texto` — text labels carry severity ("Sem alertas", "Atenção", "Alerta", "Perigo", "Dados indisponíveis"). Pure HTML; works with JS off, screen readers, and 3G.

### Share Button (DASH-08)

- **D-09 — Dual transport: wa.me primary, clipboard secondary.** Primary button = anchor link to `https://wa.me/?text={encodedText}` (works no-JS). Secondary button "Copiar link" = `navigator.clipboard.writeText(url)` with toast confirmation. Share text template (PT-BR, locked): `"{Estado}: {Nível} — {explicação}. Veja em {URL}."` Both buttons visible on `/estado/{uf}` and on each home card.

### Region Filter (DASH-07)

- **D-10 — URL-param `?region={slug}`, single-select.** Chips link to `/?region=sul` etc. Server reads param, filters cards. Active chip highlighted via aria-current="page" + visual treatment. "Todas" chip = `/` (no param). Zero client JS. Aligns with sketch finding "inline URL-params, zero JS" (sources/006).

- **D-11 — No geo-default magic.** Don't infer user region from `accept-language` or Vercel geo headers — risks getting region wrong on shared connections, VPNs, mobile data carriers. Default = all 27 states visible.

### Claude's Discretion

- Hover tooltip implementation (CSS-only via `<title>` attribute vs minimal JS) — pick what hits Lighthouse perf budget (LCP < 2.5s, total transfer < 200 KB) per A11Y-05.
- Component file organization under `src/components/` — match P1/P2 conventions; introduce new dirs only where they cluster ≥3 components.
- Loading state for first-paint on `/estado/{uf}`: sketch finding mandates "SSR-instant + last-known fallback (never skeleton)" — pick implementation (cached snapshot fallback, route segment cache config) consistent with that contract.
- Map state click target sizing — DASH-02 doesn't specify; choose values that pass Lighthouse mobile + Playwright keyboard nav (A11Y-02).
- "Como calculamos isso?" anchor target (DASH-09) — choose a stable anchor on the GitHub README; verify it exists before linking.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project locks

- `CLAUDE.md` — locked stack, hosting, risk levels, hazard vocabulary, anti-features
- `.planning/PROJECT.md` — vision, audience, locked decisions
- `.planning/REQUIREMENTS.md` — REQ-IDs (note: traceability table lines 126-135 uses stale P0–P6 numbering; ROADMAP.md is authoritative for phase mapping)
- `.planning/ROADMAP.md` §"Phase 5: CEMADEN + Dashboard UI" — phase scope + success criteria
- `risk-formula-v0.md` — risk levels, severity, PT-BR labels, dedup rule (already implemented in `src/lib/risk/**`)
- `.planning/research/SUMMARY.md` — research-flagged corrections (`unknown` + `moderate` defaults)

### Phase 4 carry-over artifacts

- `.planning/phases/04-first-two-adapters/04-RESEARCH.md` §CEMADEN + PITFALLS — endpoint discovery context, fallback chain, BRT/timestamp pitfalls
- `.planning/phases/04-first-two-adapters/04-cemaden-PED-swagger.json` — PED API surface (observational only, NOT alerts); reference for what CEMADEN does NOT offer publicly
- `.planning/phases/04-first-two-adapters/04-05-SUMMARY.md` §"Schema drift finding" — INMET P5.1 fix item (`{hoje:[...], futuro:[...]}` not flat array); may need to ship in P5

### UI design contract (LOCKED — sketch findings 2026-04-28)

- `.claude/skills/sketch-findings-enso-brasil/SKILL.md` — auto-loaded; visual direction, hard rules
- `.claude/skills/sketch-findings-enso-brasil/references/01-layout-composition.md` — desktop top-legend + 50/50 (map left); mobile card stack with locked reading order
- `.claude/skills/sketch-findings-enso-brasil/references/02-edge-states-source-trust.md` — stale notices at top; verde/cinza copy locked
- `.claude/skills/sketch-findings-enso-brasil/references/03-tokens-theme.md` — CSS custom-property system; port to Tailwind v4 `@theme`
- `.claude/skills/sketch-findings-enso-brasil/references/04-page-architecture-and-states.md` — `/estado/{uf}` two-column with permanent aside; tablet constrained mobile-up; search inline URL-params; SSR-instant loading; total-failure floor mandatory
- `.claude/skills/sketch-findings-enso-brasil/sources/themes/default.css` — winning theme to port
- `.claude/skills/sketch-findings-enso-brasil/sources/004-state-detail-page/index.html` — per-state page winner (Variant C)
- `.claude/skills/sketch-findings-enso-brasil/sources/006-search-filter-states/index.html` — filter pattern winner (Variant A)
- `.claude/skills/sketch-findings-enso-brasil/sources/007-loading-skeleton/index.html` — winners A (SSR-instant) + C (failure floor)

### Prior phase contexts (no re-asking)

- `.planning/phases/02-data-foundation/02-CONTEXT.md` — DB schema decisions, cache pattern, ofetch wrapper, `/api/ingest` orchestration shape
- `.planning/phases/03-pure-risk-engine/03-CONTEXT.md` — risk engine contract, `formula_version: "v0"`, snapshot shape
- `.planning/phases/04-first-two-adapters/04-CONTEXT.md` — adapter factory+DI pattern, sourceError factory, Path C rationale

### State

- `.planning/STATE.md` — Phase 4 MERGED (`2b6fad2` 2026-05-11), branch `phase-5-cemaden-dashboard`

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`src/lib/sources/inmet.ts`** — INMET adapter blueprint. Factory pattern (`createInmetAdapter(httpClient)`), strict zod, `sourceError()` factory for errors, registry-isolation guarantee. CEMADEN adapter should mirror this shape exactly (D-02).
- **`src/lib/sources/errors.ts`** — `sourceError(code, message, cause?)` factory + `isSourceError()` predicate. CEMADEN adapter throws via this factory (NOT class-based) — locked W-1 fix from P4.
- **`src/lib/sources/registry.ts`** — adapter registry currently registers `[inmetAdapter]`. CEMADEN adapter appends here. `/api/ingest` already uses `Promise.allSettled` (N-arity safe per P4).
- **`src/lib/sources/registry-meta.ts`** — drift detector. Extend `stability: "stable" | "unstable"` annotation; CEMADEN gets `"unstable"`.
- **`src/lib/http/fetcher.ts`** — ofetch wrapper with retry/timeout. CEMADEN adapter uses this.
- **`src/lib/risk/sources/`** — severity mapping per source (RISK-10). Add `cemaden.ts` here mapping CEMADEN severity terms to `low|moderate|high|extreme`.
- **`src/lib/risk/calculate.ts`** — pure risk engine. Already handles N adapters via input `Alert[]`. Zero changes needed.
- **`src/lib/messages.ts`** — PT-BR string constants (FOUND-09). New UI strings (filter chips, share button text, /texto headers) go here.
- **`src/app/layout.tsx`** — root layout already SSR-renders the FOUND-05 disclaimer with 199/193/190 + agency names. Reuse intact.
- **`src/app/api/states/route.ts`** — `/api/states` edge route already returns snapshot shape. UI consumes this directly (or via direct DB read on Server Component).
- **`tests/fixtures/sources/_stub/`** — fixture stub pattern; mirror with `tests/fixtures/sources/cemaden-{date}.json` (captured during DevTools session).
- **`scripts/refresh-inmet.ts` + `scripts/lib/fixture-runner.ts`** — fixture refresh script blueprint; clone for `scripts/refresh-cemaden.ts`.

### Established Patterns

- **Wave-0 dependency installs** — `react-simple-maps`, TopoJSON loader, react-simple-maps types; install pinned versions in first plan.
- **Tailwind v4 `@theme`** — port sketch findings theme tokens (`sources/themes/default.css`) into `src/app/globals.css` `@theme` block. Don't introduce a separate config file.
- **Pre-commit gate** — lint-staged + gitleaks + prettier already wired. UI commits must pass.
- **No `next-intl`** — strings are plain TS in `src/lib/messages.ts`. Never reintroduce i18n routing.
- **dep-cruiser RISK-01** — isolation rule prevents `src/lib/risk/**` from importing UI/adapter code. UI consumes risk output via snapshot shape, never imports calculate.ts directly.
- **Edge runtime constraints** — `/api/states` is edge; adapters MUST stay Node-only (registry isolation). UI routes can be edge if they don't touch adapters directly.

### Integration Points

- **Map → `/estado/{uf}` navigation** (D-05): react-simple-maps state shape onClick triggers Next.js `<Link>` navigation. No state held in client.
- **Region filter** (D-10): home `page.tsx` reads `searchParams.region`, filters card list server-side. Cards still render full data — only the visible set differs.
- **/api/states ↔ /texto** (D-07): /texto can read snapshot directly via DB (server component) or via cached `/api/states` — pick path that hits A11Y-05 perf budget.
- **Share button URL composition** (D-09): server-rendered link uses canonical site URL (env var `NEXT_PUBLIC_SITE_URL` already exists per P2).
- **CEMADEN adapter ↔ `/api/ingest`** (D-02): registry appends `cemadenAdapter`; orchestrator unchanged (Promise.allSettled handles N).

</code_context>

<specifics>
## Specific Ideas

- Sketch finding 004 (per-state detail page) is the binding visual contract for `/estado/{uf}`. Implement Variant C verbatim.
- "Como calculamos isso?" (DASH-09) anchor target — point to a stable section in PT-BR README explaining v0 formula. Verify the anchor exists before merging.
- Tablet implementation: NO separate breakpoint logic. Constrained mobile-up only (locked sketch finding 005-A). Single CSS path serves mobile + tablet; desktop has its own layout.
- INMET P5.1 fix (schema drift `{hoje:[...], futuro:[...]}` returned by live API) — ship in P5 as a small first-wave plan, OR roll into the contract-test refresh during fixture work. Planner to decide.
- Don't add geo-IP defaults or any user-tracking telemetry. Anti-feature per CLAUDE.md.

</specifics>

<deferred>
## Deferred Ideas

- **INPE Queimadas / NASA FIRMS 3rd source (ADAPT-03)** — moved to P6 per ROADMAP. Not in P5 scope even though the registry pattern supports it trivially.
- **CEMADEN outreach packet (DEPLOY-06)** — P7 (Launch). Even though CEMADEN endpoint instability is known, formal outreach is part of launch.
- **Per-state historical comparison** — M10 (Historical comparison 1997-98 / 2015-16 / 2023-24). Daily archive table already exists from P2 (DATA-09); UI for it is later.
- **ES/EN translations** — M12 REMOVED. Project is PT-BR only.
- **Push/email/Telegram notifications** — M11; v1 only needs risk-transition shape (already versioned per RISK-08).
- **Plausible analytics** — DEPLOY-05 in P7.
- **Public API for third parties** — M8; snapshot shape is already versioned in v1.

### Reviewed Todos (not folded)

None — no todos surfaced by `gsd-sdk query todo.match-phase 5`.

</deferred>

---

_Phase: 5-cemaden-dashboard-ui_
_Context gathered: 2026-05-11_
