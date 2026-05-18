---
phase: 05-cemaden-dashboard-ui
plan: 09
type: execute
wave: 2
depends_on: ["05-07"]
files_modified:
  - src/components/cards/StateCard.tsx
  - src/components/cards/StateCard.test.tsx
  - src/components/filters/RegionFilter.tsx
  - src/components/filters/RegionFilter.test.tsx
  - src/components/share/ShareButton.tsx
  - src/components/share/ShareButton.test.tsx
  - src/lib/share/url.ts
  - src/lib/share/url.test.ts
autonomous: true
requirements: [DASH-01, DASH-05, DASH-07, DASH-08, A11Y-02]
must_haves:
  truths:
    - "StateCard renders for one UF: name, RiskBadge, plain-language explanation, alert list, last-update, share buttons, primary CTA"
    - "RegionFilter renders 6 anchor-link chips (Todas + 5 regions); active chip has aria-current=page; works no-JS"
    - "ShareButton renders wa.me anchor (primary) + clipboard button (secondary) with locked share-text template"
    - "Share URL composition sanitizes inputs (no script injection in text fragment)"
  artifacts:
    - path: "src/components/cards/StateCard.tsx"
      provides: "<StateCard state={StateSnapshot} />"
    - path: "src/components/filters/RegionFilter.tsx"
      provides: "<RegionFilter active={Region|null} />"
    - path: "src/components/share/ShareButton.tsx"
      provides: "<ShareButton stateName level explanation url />"
    - path: "src/lib/share/url.ts"
      provides: "buildShareText + buildWaMeHref pure functions"
  key_links:
    - from: "src/components/share/ShareButton.tsx"
      to: "src/lib/share/url.ts"
      via: "buildWaMeHref(text)"
      pattern: "buildWaMeHref"
---

<objective>
The three remaining primitives. Filter is a server component (anchor chips, zero JS). Share button is the FIRST `"use client"` component in the repo (per `05-PATTERNS.md` net-new flag) — gated to leaf only.

Output: 4 components + share-URL pure module + tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-cemaden-dashboard-ui/05-UI-SPEC.md
@.planning/phases/05-cemaden-dashboard-ui/05-PATTERNS.md
@.planning/phases/05-cemaden-dashboard-ui/05-CONTEXT.md
@src/components/badge/RiskBadge.tsx
@src/components/SourceLink.tsx
@src/lib/messages.ts
@src/lib/time/format.ts
@src/lib/geo/regions.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: share/url.ts — pure share-URL composition</name>
  <files>src/lib/share/url.ts, src/lib/share/url.test.ts</files>
  <behavior>
    - `buildShareText({estado, nivel, explicacao, url}): string` — applies `messages.share_text_template` verbatim.
    - `buildWaMeHref(text: string): string` — returns `\`https://wa.me/?text=\${encodeURIComponent(text)}\``.
    - Input sanitization: `explicacao` may come from RISK-09 generator (already PT-BR plain text) but we defensively `String(input)` and reject if it contains `<`, `>`, control chars (0x00-0x1F except space). Throws `Error("Invalid share input")`.
    - Tests: golden output for SP example from UI-SPEC ("São Paulo: Alerta — Risco de enchentes na região metropolitana até sexta. Veja em https://ensobrasil.com.br/estado/sp."); encoding test for accents (`Atenção` → `Aten%C3%A7%C3%A3o`); injection test (`<script>alert(1)</script>` throws).
  </behavior>
  <action>Pure module. Edge-safe.</action>
  <verify>
    <automated>pnpm test:coverage src/lib/share/url.test.ts</automated>
  </verify>
  <done>100/100/100/100 coverage; injection test passes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: ShareButton component (FIRST "use client")</name>
  <files>src/components/share/ShareButton.tsx, src/components/share/ShareButton.test.tsx</files>
  <behavior>
    - File header: `"use client";` (FIRST in repo — flagged in `05-PATTERNS.md` as net-new).
    - Props: `{ stateName: string, level: RiskLevel, explanation: string, url: string }`.
    - Composes share text via `buildShareText`.
    - Renders TWO controls:
      1. `<a href={buildWaMeHref(text)}>` with `target="_blank" rel="noopener noreferrer"`. Label per `messages.cta.share_whatsapp` ("Compartilhar no WhatsApp"). Works with JS disabled.
      2. `<button type="button" onClick={async()=>{ await navigator.clipboard.writeText(url); setToast("Link copiado."); setTimeout(()=>setToast(null), 2000); }}>` — `messages.cta.share_clipboard`.
    - Toast: simple `aria-live="polite"` `<span>` (no portal). Auto-dismiss 2s. Confirmation copy per `messages.cta.share_clipboard_confirm`.
    - DO NOT use Web Share API (`navigator.share`) — anti-feature per UI-SPEC hard rules.
    - DO NOT import server-only modules.

    Tests (jsdom):
    - Renders wa.me anchor with encoded text
    - Renders clipboard button
    - Clicking clipboard calls `navigator.clipboard.writeText(url)` (mocked); toast appears with "Link copiado." then disappears
    - Anchor has `rel="noopener noreferrer"`
    - No `navigator.share` reference (grep test)

  </behavior>
  <action>
    Minimal client component. Lint exception: `"use client";` allowed in this file.
  </action>
  <verify>
    <automated>pnpm test:ci src/components/share/ShareButton.test.tsx</automated>
  </verify>
  <done>Tests green; component is the only `"use client"` in `src/components/share/`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: RegionFilter component (server, anchor-link chips)</name>
  <files>src/components/filters/RegionFilter.tsx, src/components/filters/RegionFilter.test.tsx</files>
  <behavior>
    - Pure RSC. Props: `{ active: Region | null }`.
    - Renders 6 `<a>` chips: "Todas" → `/`; "Norte" → `/?region=norte`; ...; "Sul" → `/?region=sul`.
    - Active chip: `aria-current="page"` + class `region-chip-active` (inverse visual per UI-SPEC: `bg-ink-1 text-surface`).
    - Inactive chips: `bg-surface-muted border-line text-ink-1`.
    - Anchor links only — no `<button>`, no `useSearchParams`, no JS handlers.
    - Each chip has minimum 44px touch target (per spacing exception).

    Tests:
    - 6 chips render
    - `active="N"` (Norte) sets `aria-current="page"` on Norte chip only
    - `active=null` sets `aria-current="page"` on Todas chip
    - Hrefs match `REGION_SLUGS`

  </behavior>
  <action>
    Use `messages.filter` for labels. Use `REGION_SLUGS` for hrefs.
  </action>
  <verify>
    <automated>pnpm test:ci src/components/filters/RegionFilter.test.tsx</automated>
  </verify>
  <done>6 chips, aria-current correct, no client JS.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: StateCard component</name>
  <files>src/components/cards/StateCard.tsx, src/components/cards/StateCard.test.tsx</files>
  <behavior>
    - Pure RSC. Props: `{ snapshot: StateSnapshot }` where StateSnapshot follows the existing schema from `src/lib/api/schemas.ts`.
    - Renders:
      1. `<h3>{stateName} ({uf})</h3>` (`text-card-name` typography token, weight 500)
      2. `<RiskBadge level={snapshot.level} />`
      3. Plain-language explanation `<p>` from `snapshot.explanation` (already RISK-09 PT-BR)
      4. Empty/green-state copy: if `level === "green"` show `messages.empty.green_state`; if `level === "unknown"` show `messages.empty.unknown_explainer(primarySourceUrl)`
      5. Alert list: each alert renders `<SourceLink>` (existing) + relative timestamp via `formatRelativePtBr`
      6. "199 Defesa Civil · 193 Bombeiros · 190 Polícia" footer — ONLY for `level === "red"` (per UI-SPEC mobile reading order; sketch-finding 002-B); never for other levels
      7. Last-update timestamp footer using `formatRelativePtBr(snapshot.updatedAt)`
      8. Primary CTA `<Link href={`/estado/${uf}`} prefetch={false}>` with `messages.cta.state_detail(stateName)` text
      9. `<ShareButton>` instance
      10. Formula explainer link: `<a href={`${repoUrl}/blob/main/README.pt-BR.md#formula-v0`}>` with `messages.cta.formula_explainer` text. `repoUrl` from `process.env.NEXT_PUBLIC_REPO_URL` or hardcoded canonical.
    - Card border: left stripe in `var(--color-risk-{level}-bd)`, 3px wide.
    - Yellow case: badge uses ink token, NEVER white text (verified by RiskBadge tests, but smoke-assert here too).
    - Mobile reading order locked per UI-SPEC §Interaction Contracts (sketch-finding 002-B).

    Tests:
    - Renders all 5 risk levels with matching badge + explanation
    - Green level shows `messages.empty.green_state` verbatim
    - Red level shows emergency contacts string with "199" "193" "190"
    - Yellow/orange levels do NOT show emergency contacts
    - Unknown shows source URL in explainer
    - CTA links to `/estado/{lowercase-uf}` with prefetch={false}
    - Share button rendered with correct props
    - Last-update timestamp uses relative phrasing

  </behavior>
  <action>
    Compose from existing primitives — no new tokens, no new copy.
  </action>
  <verify>
    <automated>pnpm test:ci src/components/cards/StateCard.test.tsx</automated>
  </verify>
  <done>All 5 level branches green; mobile reading order matches sketch finding.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-15 | Injection | Share text fragment | mitigate | buildShareText sanitizes; encodeURIComponent on URL; injection test in url.test.ts |
| T-05-16 | Injection | ?region= param | mitigate | RegionFilter only emits valid slugs; consumer (home page, plan 10) validates against REGION_FROM_SLUG before use |
| T-05-17 | Tampering | Active chip indicator | mitigate | `aria-current="page"` derives from server-validated `active` prop |
</threat_model>

<verification>
- All 4 component tests green
- `pnpm exec eslint src/components/` clean
- `grep -r '"use client"' src/components/` returns exactly one match (ShareButton)
</verification>

<success_criteria>

- StateCard renders all 5 risk-level branches
- Filter is zero-JS
- Share button works JS-on AND JS-off (primary anchor)
  </success_criteria>

<output>
Create `.planning/phases/05-cemaden-dashboard-ui/05-09-SUMMARY.md`.
</output>
