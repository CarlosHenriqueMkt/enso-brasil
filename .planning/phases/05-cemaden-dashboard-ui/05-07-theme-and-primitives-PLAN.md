---
phase: 05-cemaden-dashboard-ui
plan: 07
type: execute
wave: 2
depends_on: ["05-01"]
files_modified:
  - src/app/globals.css
  - src/lib/messages.ts
  - src/lib/messages.test.ts
  - src/lib/time/format.ts
  - src/lib/time/format.test.ts
  - src/components/badge/RiskBadge.tsx
  - src/components/badge/RiskBadge.test.tsx
  - src/components/staleness/StaleSourceBanner.tsx
  - src/components/staleness/StaleSourceBanner.test.tsx
autonomous: true
requirements: [DASH-06, DASH-10, A11Y-01, FOUND-08, DATA-07]
must_haves:
  truths:
    - "Tailwind @theme has all sketch-findings tokens (typography sizes, ink scale, line palette, mono font, radii r-1..r-3, spacing exceptions documented)"
    - "Risk badge renders 5 levels with locked PT-BR labels, color + icon + text"
    - "Yellow badge passes WCAG AA on white (axe-core zero violations)"
    - "Stale-source banner renders at top of page when source >30 min stale"
    - "Time formatter converts UTC ISO-Z to America/Sao_Paulo + relative '{N} minutos' phrasing"
  artifacts:
    - path: "src/components/badge/RiskBadge.tsx"
      provides: "<RiskBadge level={RiskLevel} />"
      exports: ["RiskBadge"]
    - path: "src/components/staleness/StaleSourceBanner.tsx"
      provides: "<StaleSourceBanner source url />"
    - path: "src/lib/time/format.ts"
      provides: "formatRelativePtBr + toBrtFromIsoZ"
  key_links:
    - from: "src/components/badge/RiskBadge.tsx"
      to: "src/lib/messages.ts"
      via: "messages.severity[level] verbatim labels"
      pattern: "messages\\.severity"
---

<objective>
UI primitives shared by home, /estado, /texto. Built before route plans so route work has dependencies ready.

Output: theme tokens extended, RiskBadge, StaleSourceBanner, time formatter — all with co-located Vitest tests per `SourceLink.tsx` analog pattern.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-cemaden-dashboard-ui/05-UI-SPEC.md
@.planning/phases/05-cemaden-dashboard-ui/05-PATTERNS.md
@.claude/skills/sketch-findings-enso-brasil/references/03-tokens-theme.md
@.claude/skills/sketch-findings-enso-brasil/references/02-edge-states-source-trust.md
@src/app/globals.css
@src/components/SourceLink.tsx
@src/lib/messages.ts
@risk-formula-v0.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend @theme tokens (additive)</name>
  <files>src/app/globals.css</files>
  <action>
    Append to the existing `@theme {}` block at `src/app/globals.css:12-43` (do NOT create a separate config file — Tailwind v4 idiom):

    1. Update yellow palette to UI-SPEC §Color values:
       - `--color-risk-yellow-bg: #fef7d6;`
       - `--color-risk-yellow-bd: #d4a017;`
       - `--color-risk-yellow-ink: #6b5006;` (NEW — for "never white on yellow" rule)
    2. Add full ink scale: `--color-ink-3: #707070;`, `--color-ink-4: #9a9a9a;` (existing `ink-1` keeps `#111111` — UI-SPEC says `#1a1a1a` but we keep existing `#111111` to avoid breaking existing snapshots; document the 0x09 delta as accepted in a CSS comment).
    3. Update line tokens: `--color-line: #dcdcd6;`, `--color-line-strong: #bfbfb8;` (replaces existing `--color-hairline` — keep `--color-hairline: var(--color-line);` for backward compat).
    4. Add per-level ink for risk: `--color-risk-green-ink: #0d4f1e;`, `--color-risk-orange-ink: #6b3206;`, `--color-risk-red-ink: #7a1f1f;`, `--color-risk-gray-ink: #4a4a4a;`.
    5. Add radii alias: `--radius-r-1: 2px; --radius-r-2: 4px; --radius-r-3: 6px;` (Tailwind v4 generates `rounded-r-1` etc.).
    6. Add typography custom properties (sizes 11.5px..22px, weights 400/500 only — per UI-SPEC §Typography). Use CSS var names `--text-meta`, `--text-mono`, `--text-body`, `--text-card-meta`, etc. Document the 9-size scale verbatim.

    DO NOT change `--spacing` (existing `0.5rem` works). DO NOT add weight tokens above 500. DO NOT add shadow tokens (anti-decoration lock).

    Update the existing WCAG comment (lines 8-11) to cite the new `--color-risk-yellow-ink` token.

  </action>
  <verify>
    <automated>pnpm build &amp;&amp; grep -E "risk-yellow-ink|color-ink-3|color-line-strong" src/app/globals.css</automated>
  </verify>
  <done>All new tokens present; `pnpm build` succeeds.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: messages.ts — severity labels, share template, /texto strings</name>
  <files>src/lib/messages.ts, src/lib/messages.test.ts</files>
  <behavior>
    Extend `messages` object with (verbatim from UI-SPEC §Copywriting):
    - `messages.severity = { green: "Sem alertas", yellow: "Atenção", orange: "Alerta", red: "Perigo", unknown: "Dados indisponíveis" }` (frozen).
    - `messages.severity_icon = { green: "✓", yellow: "⚠", orange: "⚠⚠", red: "⛔", unknown: "?" }`.
    - `messages.cta = { state_detail: (uf)=>\`Ver detalhes de \${uf}\`, share_whatsapp: "Compartilhar no WhatsApp", share_clipboard: "Copiar link", share_clipboard_confirm: "Link copiado.", formula_explainer: "Como calculamos isso?" }`.
    - `messages.filter = { all: "Todas", regions: { N:"Norte", NE:"Nordeste", CO:"Centro-Oeste", SE:"Sudeste", S:"Sul" } }`.
    - `messages.skip_link = "Pular para o conteúdo"`.
    - `messages.texto = { page_title: "Versão em texto", table_headers: ["Estado","Nível","Alertas ativos","Atualizado há"] }`.
    - `messages.timestamp_template = { minutes: (n)=>\`Atualizado há \${n} minutos\`, hours: (n)=>\`Atualizado há \${n} horas\`, over_day: "Atualizado há mais de 24h" }`.
    - `messages.share_text_template = (estado, nivel, expl, url)=>\`\${estado}: \${nivel} — \${expl}. Veja em \${url}.\`` (verbatim).
    - `messages.empty = { green_state: "Não encontramos nenhuma emergência nessa localidade. Verifique em outras fontes de informação antes de decidir o que você vai fazer.", stale_source: (fonte, url)=>\`Não estamos recebendo dados do(a) \${fonte}. Acesse \${url} diretamente e busque a informação que você precisa.\`, unknown_explainer: (url)=>\`Dados indisponíveis no momento. Verifique diretamente em \${url}.\`, not_found_uf: "Estado não encontrado. Volte para a página inicial." }`.
    - `messages.emergency_contacts = "199 Defesa Civil · 193 Bombeiros · 190 Polícia"` (LOCKED — never split, never digit-only).
    - All locked verbatim. Test coverage asserts: every severity level has a label + icon; emergency_contacts string contains "199", "193", "190", "Defesa Civil", "Bombeiros", "Polícia".
  </behavior>
  <action>
    Additive. Do NOT delete existing keys (P1/P2 may import them). Run existing `messages.test.ts` coverage check.
  </action>
  <verify>
    <automated>pnpm test:ci src/lib/messages.test.ts</automated>
  </verify>
  <done>All new keys present; test asserts emergency_contacts membership; existing tests still pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: time/format.ts — UTC → BRT/AC/AM + relative phrasing</name>
  <files>src/lib/time/format.ts, src/lib/time/format.test.ts</files>
  <behavior>
    - `toBrtFromIsoZ(iso: string, uf?: UF): Date` — accepts ISO-Z string, returns a `Date` in the IANA zone for the UF. Default zone: `America/Sao_Paulo`. Per-UF zones: `AC → America/Rio_Branco`; `AM → America/Manaus`. All other UFs default to `America/Sao_Paulo`. Uses `@date-fns/tz`.
    - `formatRelativePtBr(iso: string, now: Date = new Date()): string` — returns `"Atualizado há {N} minutos"` if delta < 60min, `"Atualizado há {N} horas"` if delta < 24h, `"Atualizado há mais de 24h"` else. Uses `messages.timestamp_template`.
    - `formatAbsolutePtBr(iso: string, uf?: UF): string` — formats as `DD/MM/YYYY HH:mm` in target zone (for the topbar timestamp).
    - Edge cases: invalid date → throw `Error("Invalid timestamp")` (callers handle); future date → `"agora"` (sketch-finding edge case, not in UI-SPEC; choose minimal — emit `"Atualizado há 0 minutos"` to keep deterministic). Document in docblock.

    Tests:
    - 5min ago → "Atualizado há 5 minutos"
    - 2h ago → "Atualizado há 2 horas"
    - 48h ago → "Atualizado há mais de 24h"
    - UTC `2026-05-18T22:15:01Z` in `AM` → formats hour 18 not 19 (Manaus UTC-4)
    - UTC `2026-05-18T22:15:01Z` in `AC` → formats hour 17 (Rio Branco UTC-5)
    - Invalid `"foo"` → throws

  </behavior>
  <action>
    Pure function module. No React, no DOM. Edge-safe.
  </action>
  <verify>
    <automated>pnpm test:coverage src/lib/time/format.test.ts</automated>
  </verify>
  <done>Coverage 100/100/100/100; AM/AC zone tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: RiskBadge component + test</name>
  <files>src/components/badge/RiskBadge.tsx, src/components/badge/RiskBadge.test.tsx</files>
  <behavior>
    - Pure RSC (no `"use client"`). Props: `{ level: RiskLevel }`.
    - Renders `<span class="risk-badge risk-badge-{level}" aria-label="{messages.severity[level]}"><span aria-hidden="true">{icon}</span> {label}</span>`.
    - Tailwind classes use the @theme tokens: `bg-risk-{level}-bg border-risk-{level}-bd text-risk-{level}-ink rounded-r-2 px-s-2 py-s-1 text-meta`. Map `level → token` cleanly. NEVER hard-code color hex.
    - Icon glyphs from `messages.severity_icon` (Unicode, no SVG, no icon font).
    - Yellow case: ink = `#6b5006` on `#fef7d6` fill, contrast verified WCAG AA. NEVER white text.
    - Color + icon + text are redundant — color is third signal per A11Y-04.

    Tests:
    - Renders all 5 levels with correct label + icon
    - Yellow uses `text-risk-yellow-ink` class (not `text-white`)
    - `aria-label` matches `messages.severity[level]` verbatim
    - `aria-hidden="true"` on icon span (screen reader reads label only)

  </behavior>
  <action>
    Mirror `src/components/SourceLink.tsx` file shape (single .tsx + co-located .test.tsx, jsdom env via vitest config). Snapshot is fine but assert classes explicitly.
  </action>
  <verify>
    <automated>pnpm test:ci src/components/badge/RiskBadge.test.tsx</automated>
  </verify>
  <done>5 levels render; yellow ink class verified; tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: StaleSourceBanner + test</name>
  <files>src/components/staleness/StaleSourceBanner.tsx, src/components/staleness/StaleSourceBanner.test.tsx</files>
  <behavior>
    - Pure RSC. Props: `{ sources: Array<{ key:string, displayName:string, url:string, lastSuccess: string|null, stability:"stable"|"unstable" }> }`.
    - Renders at top of page when ANY source has `lastSuccess` older than 30 minutes OR `lastSuccess === null`.
    - Banner text per `messages.empty.stale_source(displayName, url)` template VERBATIM.
    - One banner per stale source (stacked). Color: orange or gray bg (per UI-SPEC interaction table) — use `bg-risk-orange-bg border-risk-orange-bd text-risk-orange-ink` for `stability==="stable"` sources, `bg-risk-gray-bg` for `stability==="unstable"`.
    - When NO sources are stale, renders nothing (returns `null`).
    - SSR-only — render is deterministic from props.
    - Total-failure floor (all sources stale): pinned at top + sketch-finding 007-C contract delegated to home page composition (plan 09); banner just stacks.

    Tests:
    - Empty array → renders nothing
    - One stale source → one banner with verbatim copy
    - Two stale → two banners
    - Fresh source (< 30 min) → not in banner list
    - Yellow text-on-bg never used (smoke test absence)

  </behavior>
  <action>
    Plain RSC. No state. `messages.empty.stale_source` provides copy.
  </action>
  <verify>
    <automated>pnpm test:ci src/components/staleness/StaleSourceBanner.test.tsx</automated>
  </verify>
  <done>Tests green; banner integrated by home/per-state plans later.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-11 | Information disclosure | Stale banner contents | mitigate | Banner shows only displayName + URL, never raw error payloads |
| T-05-12 | Tampering | severity labels | mitigate | messages.ts is the single source of truth; tests freeze the map |
</threat_model>

<verification>
- `pnpm test:coverage` 100/100/100/100 on time/format
- `pnpm test:ci` all new test files green
- `pnpm build` green
</verification>

<success_criteria>

- 9 files committed
- Tokens extended additively
- Primitives ready for home + /estado + /texto consumption
  </success_criteria>

<output>
Create `.planning/phases/05-cemaden-dashboard-ui/05-07-SUMMARY.md`.
</output>
