---
phase: 05-cemaden-dashboard-ui
plan: 02
type: execute
wave: 0
depends_on: ["05-01"]
files_modified:
  - src/lib/sources/schema.ts
  - src/lib/sources/schema.test.ts
  - src/lib/messages.ts
  - src/lib/messages.test.ts
  - README.pt-BR.md
  - .planning/phases/05-cemaden-dashboard-ui/05-02-CONTEXT-corrections.md
autonomous: true
requirements: [ADAPT-01, DASH-09]
must_haves:
  truths:
    - "HAZARD_KINDS includes `deslizamento` mapped to CEMADEN 'Movimento de Massa'"
    - "D-04 corrected: CEMADEN timestamps parsed as UTC, displayed via @date-fns/tz with per-UF zones"
    - "PT-BR README has stable `#formula-v0` anchor section explaining v0 risk levels"
  artifacts:
    - path: ".planning/phases/05-cemaden-dashboard-ui/05-02-CONTEXT-corrections.md"
      provides: "D-04 rewrite, locked"
      contains: "rewrites D-04"
    - path: "README.pt-BR.md"
      provides: "stable anchor for DASH-09"
      contains: "formula-v0"
  key_links:
    - from: "src/lib/sources/schema.ts"
      to: "src/lib/messages.ts"
      via: "HAZARD_KINDS literal union mirrored by hazard noun phrases"
      pattern: "deslizamento"
---

<objective>
Lock the three CONTEXT/RESEARCH open items that downstream plans depend on: extend the hazard taxonomy with `deslizamento`, rewrite D-04 (timestamps are UTC not BRT-naive), and add a stable PT-BR README anchor for the "Como calculamos isso?" link.

Purpose: each item is small but blocks specific downstream tasks (CEMADEN adapter hazard mapping, presentation-layer tz conversion, state row's formula explainer link). Bundling here avoids touching the schema file 3 times across waves.

Output: schema + messages updated, CONTEXT-corrections.md recorded, README anchor live.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-cemaden-dashboard-ui/05-CONTEXT.md
@.planning/phases/05-cemaden-dashboard-ui/05-RESEARCH.md
@.planning/phases/05-cemaden-dashboard-ui/05-cemaden-endpoint-capture.md
@CLAUDE.md
@src/lib/sources/schema.ts
@src/lib/messages.ts

<interfaces>
From src/lib/sources/schema.ts:
- `HAZARD_KINDS` is a `readonly [...] as const` literal tuple → derived `z.enum(HAZARD_KINDS)` in Alert schema
- `Alert.hazard_kind: z.enum(HAZARD_KINDS)`

From src/lib/messages.ts:

- `messages.hazard.noun[kind]` provides PT-BR noun phrase for each HAZARD_KIND; messages.test.ts asserts every HAZARD_KIND has a noun phrase
  </interfaces>
  </context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend HAZARD_KINDS with `deslizamento`</name>
  <files>src/lib/sources/schema.ts, src/lib/sources/schema.test.ts, src/lib/messages.ts, src/lib/messages.test.ts</files>
  <behavior>
    - `HAZARD_KINDS` array contains the literal `"deslizamento"` (lowercase, no accent — match existing convention).
    - `Alert.hazard_kind` accepts `"deslizamento"` via zod parse.
    - `messages.hazard.noun.deslizamento` returns the bare PT-BR noun `"deslizamento"` (locked per CLAUDE.md vernacular rule — consistent with existing `enchente`/`queimada`/`estiagem` style; CEMADEN's verbatim `"Movimento de Massa"` is preserved inside the adapter `raw` field per plan 03).
    - `messages.test.ts` "covers every HAZARD_KIND" assertion still passes.
  </behavior>
  <action>
    Append `"deslizamento"` to the `HAZARD_KINDS` tuple in `src/lib/sources/schema.ts` (after the existing entries; do NOT reorder existing — order is part of the public contract). Add the noun phrase entry to `messages.hazard.noun` in `src/lib/messages.ts`: `deslizamento: "deslizamento de terra"`. Update any noun-phrase coverage test in `messages.test.ts` and `schema.test.ts` if needed.

    Decision (per D-XX in CONTEXT discretion + CLAUDE.md vocab rule): hazard kind is stored as the lowercase ENSO Brasil literal `"deslizamento"`. CEMADEN's verbatim `"Movimento de Massa"` is preserved inside the adapter's `raw` field (plan 03) but normalized to `"deslizamento"` for the unified Alert shape. This mirrors the INMET pattern where source-specific event strings are normalized via `HAZARD_PATTERNS`.

  </action>
  <verify>
    <automated>pnpm test:ci src/lib/sources/schema.test.ts src/lib/messages.test.ts</automated>
  </verify>
  <done>Both test files pass; `pnpm exec tsc --noEmit` green.</done>
</task>

<task type="auto">
  <name>Task 2: Rewrite D-04 — CEMADEN timestamps are UTC</name>
  <files>.planning/phases/05-cemaden-dashboard-ui/05-02-CONTEXT-corrections.md</files>
  <action>
    Create a new file `05-02-CONTEXT-corrections.md` with a `<rewrites>` block. Use this exact structure:

    ```
    # Phase 5 — CONTEXT.md Corrections

    ## D-04 (REWRITTEN 2026-05-18)

    <rewrites decision="D-04" original="`05-CONTEXT.md` lines 28">

    **Original (now superseded):**
    > D-04 — BRT timestamp handling. CEMADEN naive timestamps assumed UTC-3 no DST … adapter explicitly applies + -03:00 offset; throws if source migrates to TZ-aware format.

    **Corrected (LOCKED 2026-05-18, evidence in `05-cemaden-endpoint-capture.md`):**
    > D-04 — CEMADEN timestamps are UTC. The payload root `atualizado` field self-labels as `"DD-MM-YYYY HH:MM:SS UTC"`. Per-alert fields (`datahoracriacao`, `ult_atualizacao`) are naive `"YYYY-MM-DD HH:MM:SS.fff"` but in the same payload as the UTC-labelled root — so they are parsed as UTC. Adapter outputs ISO-8601 `Z` strings (e.g. `2026-05-13T22:13:19.090Z`) into `Alert.valid_from` / `Alert.valid_until`. Presentation layer (`/estado/{uf}` and home cards) converts to `America/Sao_Paulo` via `@date-fns/tz`. For UFs with non-Brasília civil time (AC = `America/Rio_Branco` UTC-5, parts of AM = `America/Manaus` UTC-4), use the IANA zone for that UF. Adapter THROWS if any timestamp parses to a date before 2010 or after now+30days (drift tripwire).

    **Reasoning for flip:** Endpoint capture 2026-05-18 verified UTC labelling. Applying -03:00 offset blindly would have skewed AM/AC timestamps by 1–2 hours in the wrong direction.

    </rewrites>
    ```

    Plan-review remediation 2026-05-18 (H-1): `05-CONTEXT.md` already received an inline `> SUPERSEDED 2026-05-18 — see 05-02-CONTEXT-corrections.md` marker above the original D-04 block (closes audit-trail leak). Executor verifies the marker is present (does NOT re-add); the corrections file remains the canonical override. Plan 03 cites the corrections file in its docblock.

  </action>
  <verify>
    <automated>grep -q 'CEMADEN timestamps are UTC' .planning/phases/05-cemaden-dashboard-ui/05-02-CONTEXT-corrections.md &amp;&amp; grep -q 'rewrites decision="D-04"' .planning/phases/05-cemaden-dashboard-ui/05-02-CONTEXT-corrections.md &amp;&amp; grep -q 'SUPERSEDED 2026-05-18' .planning/phases/05-cemaden-dashboard-ui/05-CONTEXT.md</automated>
  </verify>
  <done>File exists with the rewrites block; references the endpoint capture as evidence.</done>
</task>

<task type="auto">
  <name>Task 3: Add stable `#formula-v0` anchor to PT-BR README</name>
  <files>README.pt-BR.md</files>
  <action>
    Locate the PT-BR README (`README.pt-BR.md` — if filename differs, use the project's canonical PT-BR README). Add a new section with the EXACT heading `## Como calculamos isso? {#formula-v0}` (Markdown heading-ID extension). If the README's Markdown processor doesn't support `{#...}` syntax, fall back to an explicit `<a id="formula-v0"></a>` HTML anchor immediately before the `## Como calculamos isso?` heading.

    Section body (PT-BR, ≥6 lines): summarize v0 risk formula from `risk-formula-v0.md`:
    - 5 levels: green / yellow / orange / red / unknown
    - Severity mapping (low/moderate/high/extreme; unknown source terms default to moderate)
    - 24h validity window
    - Dedup rule
    - Source: link to `risk-formula-v0.md` in the repo
    - Disclaimer: "Esta é uma fórmula v0. Não substitui a Defesa Civil (199), Bombeiros (193) ou Polícia (190)."

    Verify the anchor renders by running `pnpm exec markdown-link-check README.pt-BR.md` (if not installed, skip — DASH-09 link-check CI step lands in plan 11).

  </action>
  <verify>
    <automated>grep -E '(\{#formula-v0\}|id="formula-v0")' README.pt-BR.md</automated>
  </verify>
  <done>Anchor exists; section body explains v0 formula in PT-BR; "199 Defesa Civil · 193 Bombeiros · 190 Polícia" agency-named numbers present.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-02 | Tampering | hazard taxonomy contract | mitigate | Schema test enforces literal union; new entry covered by existing "noun phrase coverage" test |
</threat_model>

<verification>
- `pnpm test:ci` green
- `pnpm exec tsc --noEmit` green
- Both anchor + corrections file committed
</verification>

<success_criteria>

- Plan 03 (CEMADEN adapter) can import `"deslizamento"` literal from HAZARD_KINDS
- Plan 03 can cite D-04 corrected text without ambiguity
- Plan 09 (per-state route) can link `<a href="https://github.com/{org}/{repo}/blob/main/README.pt-BR.md#formula-v0">` and the anchor will resolve
  </success_criteria>

<output>
Create `.planning/phases/05-cemaden-dashboard-ui/05-02-SUMMARY.md` listing the three locked items.
</output>
