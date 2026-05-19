---
phase: 05-cemaden-dashboard-ui
plan: 11
type: execute
wave: 3
depends_on: ["05-09", "05-10"]
files_modified:
  - src/app/estado/[uf]/page.tsx
  - src/app/estado/[uf]/page.test.tsx
  - src/app/estado/[uf]/opengraph-image.tsx
  - src/app/texto/page.tsx
  - src/app/texto/page.test.tsx
  - src/lib/messages.ts
autonomous: true
requirements: [DASH-04, DASH-09, A11Y-03, A11Y-06]
must_haves:
  truths:
    - "/estado/{uf} returns 200 for all 27 UFs; 404 for unknown UF"
    - "/estado/{uf} matches sketch-finding 004 Variant C two-column layout (permanent aside, full SSR)"
    - "OG + Twitter meta tags render correct preview (state name + level + share URL)"
    - "/texto renders 5 regional tables + 27 article sections in one SSR page; pure HTML; zero JS"
    - "/texto heading outline h1 → h2 (region) → h3 (state); tab order: table → articles"
    - "Screen-reader live region announces level change on /estado route load"
  artifacts:
    - path: "src/app/estado/[uf]/page.tsx"
      provides: "Dynamic per-state route"
    - path: "src/app/texto/page.tsx"
      provides: "/texto SSR single-page"
    - path: "src/app/estado/[uf]/opengraph-image.tsx"
      provides: "Per-state OG image (text-only)"
  key_links:
    - from: "src/app/estado/[uf]/page.tsx"
      to: "src/lib/snapshot/load.ts"
      via: "loadSnapshotForUi()"
      pattern: "loadSnapshotForUi"
---

<objective>
Build the two remaining routes. /estado/{uf} is the deep-link target for map clicks + share URLs. /texto is the accessible mirror.

Output: 2 routes + OG image generator + tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-cemaden-dashboard-ui/05-UI-SPEC.md
@.planning/phases/05-cemaden-dashboard-ui/05-CONTEXT.md
@.claude/skills/sketch-findings-enso-brasil/sources/004-state-detail-page/index.html
@.claude/skills/sketch-findings-enso-brasil/references/04-page-architecture-and-states.md
@src/lib/snapshot/load.ts
@src/components/cards/StateCard.tsx
@src/components/share/ShareButton.tsx
@src/components/badge/RiskBadge.tsx
@src/lib/sources/schema.ts
@src/lib/geo/regions.ts
@src/lib/messages.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: /estado/[uf] dynamic route + generateStaticParams + 404</name>
  <files>src/app/estado/[uf]/page.tsx, src/app/estado/[uf]/page.test.tsx</files>
  <behavior>
    - `export async function generateStaticParams()` → returns 27 `{uf:lowercase}` entries from `UF27_PROVISIONAL`.
    - `export default async function StatePage({ params }: { params: Promise<{uf:string}> })`:
      - Validate param against `UF27_PROVISIONAL` lowercase-only; any other value (including uppercase like `SP`) → `notFound()`. Lowercase is the canonical URL contract (matches `generateStaticParams` output + sketch findings + sitemap).
      - Call `loadSnapshotForUi()`; find target state.
      - Render Variant C sketch-finding 004 layout: two-column (desktop) with permanent aside (left = state context: name, level badge, last-update, share controls; right = main content: explanation, alert list with SourceLink + relative timestamp, emergency contacts for `red` level, formula explainer link).
      - Mobile: linear stack with locked reading order (lead → afeta → válido → fontes → chips → 199/193/190 if red → timestamp).
      - Loading state per UI-SPEC: SSR-instant with last-known fallback (NEVER skeleton). Total-failure floor: gray card + emergency contacts visible (sketch finding 007-A + 007-C).
      - Screen-reader live region: `<div aria-live="polite" className="sr-only">{messages.severity[level]} em {stateName}</div>` at top of `<main>` so route load announces level (A11Y-06).
      - Compose `<ShareButton>` and emergency contacts and formula explainer link as in StateCard, but with full-page detail layout.
    - `export async function generateMetadata({params})` → returns OG metadata (title, description, openGraph={images: [opengraph-image.tsx output]}, twitter card). Use `NEXT_PUBLIC_SITE_URL` for canonical.

    Tests:
    - All 27 UFs return 200 (generateStaticParams covers them)
    - Unknown UF "zz" → notFound
    - Uppercase "SP" → 404 (lowercase-only contract; documented in OG meta as canonical lowercase URL)
    - Red level renders "199 Defesa Civil"
    - Yellow level renders no emergency footer
    - Live region present
    - Share button rendered with canonical URL ${NEXT_PUBLIC_SITE_URL}/estado/{uf}

  </behavior>
  <action>
    Compose existing components. No new tokens, no new copy. Sketch-finding 004 Variant C is the visual contract — read the HTML source to extract structure.
  </action>
  <verify>
    <automated>pnpm test:ci src/app/estado &amp;&amp; pnpm build</automated>
  </verify>
  <done>All 27 routes build; unknown UF 404; build green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: opengraph-image.tsx — per-state OG card</name>
  <files>src/app/estado/[uf]/opengraph-image.tsx</files>
  <behavior>
    - Next.js convention file. Generates 1200×630 OG image server-side using Next's `ImageResponse` with system fonts only (NEVER load external fonts per CLAUDE.md).
    - Content (text-only, no decoration): state name (large), level label + icon, brief explanation (one line), domain ("ensobrasil.com.br" or canonical), updated timestamp.
    - Background: `--color-bg` (#fafaf8). Risk stripe on left edge in `--color-risk-{level}-bd`.
    - Generated at build time (per static generation of /estado/[uf]).
    - WhatsApp Web preview shows correct OG (verified manually in plan 12 checkpoint).
  </behavior>
  <action>
    Use `next/og`'s `ImageResponse`. System font only. No images.
  </action>
  <verify>
    <automated>pnpm build &amp;&amp; test -f .next/server/app/estado/\[uf\]/opengraph-image*.js</automated>
  </verify>
  <done>OG image generated for all 27 UFs at build.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: /texto SSR single-page</name>
  <files>src/app/texto/page.tsx, src/app/texto/page.test.tsx</files>
  <behavior>
    - `export default async function TextoPage()` — pure SSR, no client JS.
    - Calls `loadSnapshotForUi()`.
    - Renders:
      1. `<h1>Versão em texto</h1>` (messages.texto.page_title)
      2. Stale banner (if any source stale) — reuse `<StaleSourceBanner>`
      3. For each region in order [N, NE, CO, SE, S]:
         - `<h2>{messages.filter.regions[region]}</h2>`
         - `<table>` with thead row [Estado | Nível | Alertas ativos | Atualizado há] (messages.texto.table_headers)
         - tbody rows for each UF in region, with first cell `<a href="#{uf-lowercase}">` linking to article section. Severity cell uses TEXT only (NO icon — D-08). Active alerts column shows numeric count from `snapshot[uf].alerts.length` post-dedup (LOCKED — same source as DASH-02 card count; ensures table matches card). Updated cell uses `formatRelativePtBr`.
      4. After all tables, 27 `<article id="{uf-lowercase}">` sections in alphabetical UF order:
         - `<h3>{stateName} ({uf})</h3>`
         - Plain-language explanation
         - Region tag (small text)
         - Alert list: each alert with `<SourceLink>` + timestamp (use mono font for domain — `font-mono text-mono`)
         - Emergency contacts only if level === red
    - Heading outline: h1 → h2 (5 regions) → h3 (27 states). Verified via Playwright a11y test in plan 12.
    - Tab order: skip-link → 5 tables (rows are tab-stops via inner `<a>` anchors) → 27 articles (their headings + links).
    - NO icons. NO `<img>`. NO `"use client"`. Pure semantic HTML.
    - Anchor links work no-JS (test by curling and grepping for `href="#sp"`).

    Tests:
    - 5 tables, one per region
    - 27 articles, each with `<h3>` and `id={uf-lowercase}`
    - Table row count totals: 7+9+4+4+3 = 27
    - Severity cell contains text label not icon
    - Domain links use mono class
    - No `"use client"` directive

  </behavior>
  <action>
    Single page, large but flat. Read sketch-findings 02-edge-states for stale notice copy.
  </action>
  <verify>
    <automated>pnpm test:ci src/app/texto/page.test.tsx &amp;&amp; pnpm build</automated>
  </verify>
  <done>27 articles + 5 tables; heading outline correct; build green.</done>
</task>

<task type="auto">
  <name>Task 4: DASH-09 link check in CI workflow</name>
  <files>.github/workflows/ci.yml (or existing CI yaml)</files>
  <action>
    Append a `link-check-readme` step using `lycheeverse/lychee-action@v2` (popular & free), scoped to `README.pt-BR.md`. Asserts every `#anchor` resolves within the document and external URLs return 2xx/3xx. The `#formula-v0` anchor from plan 02 must pass.

    Skip if a link-check is already wired — append only the README.pt-BR.md scope.

  </action>
  <verify>
    <automated>grep -E 'lychee|markdown-link-check' .github/workflows/ci.yml</automated>
  </verify>
  <done>CI step present; passes on a local dry run (`lychee README.pt-BR.md`).</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-20 | Injection | UF path param | mitigate | Validated against UF27 enum; notFound() on miss |
| T-05-21 | Information disclosure | OG image content | mitigate | Static text from snapshot; no PII; no analytics pixel |
| T-05-22 | Tampering | /texto heading outline | mitigate | Playwright a11y test in plan 12 asserts outline |
</threat_model>

<verification>
- `pnpm build` green; 27 static pages + /texto + / generated
- `curl -s http://localhost:3000/estado/sp | grep -q 'opengraph'` (meta tag present)
- `curl -s http://localhost:3000/texto | grep -c '<article'` = 27
- `curl -s http://localhost:3000/estado/zz` returns 404
</verification>

<success_criteria>

- All 27 /estado routes ship with OG cards
- /texto is fully semantic SSR
- DASH-09 anchor resolves under CI link-check
  </success_criteria>

<output>
Create `.planning/phases/05-cemaden-dashboard-ui/05-11-SUMMARY.md`.
</output>
