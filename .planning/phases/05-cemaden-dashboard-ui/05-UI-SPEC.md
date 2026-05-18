---
phase: 5
slug: cemaden-dashboard-ui
status: draft
shadcn_initialized: false
preset: none
created: 2026-05-18
---

# Phase 5 — UI Design Contract

> Visual and interaction contract for the public dashboard surface (home `/`, `/estado/{uf}`, `/texto`, region filter, share). Derived verbatim from the locked sketch findings (2026-04-28) and Phase 5 CONTEXT/SPEC. All tokens, copy, and weights below are LOCKED — do not relitigate without `/gsd-new-milestone`.

---

## Design System

| Property          | Value                                                                                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool              | none (no shadcn — civic theme is bespoke, no component-library presets)                                                                                                                                              |
| Preset            | not applicable                                                                                                                                                                                                       |
| Component library | none — hand-built atomic components on Tailwind v4 `@theme` tokens                                                                                                                                                   |
| Icon library      | Unicode glyphs only (`✓`, `⚠`, `⚠⚠`, `⛔`, `?`) — no icon font, no SVG library (3G perf budget A11Y-05)                                                                                                              |
| Font              | system stack: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Mono: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace`. NEVER load external font files. |

shadcn rationale: ENSO Brasil is a public-safety dashboard with a locked civic theme (sketch findings 2026-04-28). It rejects SaaS aesthetics (rounded > 8px, shadows, gradients, weight ≥ 600). shadcn presets do not align. Theme ships as Tailwind v4 `@theme` block in `src/app/globals.css`, ported from `.claude/skills/sketch-findings-enso-brasil/sources/themes/default.css`.

---

## Spacing Scale

8-point scale, declared as CSS custom properties / Tailwind tokens.

| Token   | Value | Usage                                                                 |
| ------- | ----- | --------------------------------------------------------------------- |
| `--s-1` | 4px   | Icon gaps, inline padding, tight risk-pill internal gap               |
| `--s-2` | 8px   | Compact element spacing, risk-pill gap                                |
| `--s-3` | 12px  | Mobile outer padding, card-list inter-card gap (14px exception below) |
| `--s-4` | 16px  | Default element spacing, card padding                                 |
| `--s-5` | 24px  | Section padding, two-column gutter                                    |
| `--s-6` | 32px  | Desktop topbar horizontal padding, layout gaps                        |
| `--s-7` | 48px  | Major section breaks                                                  |
| `--s-8` | 64px  | Page-level spacing                                                    |

Exceptions (locked from sketch findings):

- **14px** mobile card-list gap (between cards). Not a multiple of 4 — locked by sketch finding 002 to maintain card breathing on 360px viewports.
- **14px** desktop topbar vertical padding (paired with 32px horizontal). Locked sketch finding 001.
- **44px** minimum touch target for map state shapes and chip links (WCAG AA, mobile clickability).

---

## Typography

Weight contract: **400 + 500 ONLY.** No 600/700/800, no italics, no condensed.

| Role                                                   | Size        | Weight | Line Height                                                 |
| ------------------------------------------------------ | ----------- | ------ | ----------------------------------------------------------- |
| Body default                                           | 15px        | 400    | 1.5                                                         |
| h1 (page title)                                        | 22px        | 500    | 1.3                                                         |
| h2 (region heading on `/texto`, section heads)         | 18px        | 500    | 1.35                                                        |
| h3 (state name on `/texto` article, card name desktop) | 15px        | 500    | 1.4                                                         |
| Card name (mobile)                                     | 17px        | 500    | 1.3                                                         |
| Card lead ("what is happening")                        | 14.5px      | 500    | 1.45                                                        |
| Card body / supporting text                            | 13.5px      | 400    | 1.55                                                        |
| Card meta / footer (timestamps, source counts)         | 12px        | 400    | 1.4                                                         |
| Section uppercase label                                | 11.5–12.5px | 500    | 1.35 (`letter-spacing: 0.06em; text-transform: uppercase;`) |
| Mono domain (e.g. `alertas.cemaden.gov.br`)            | 11.5px      | 400    | 1 (mono stack)                                              |
| Topbar project name                                    | 18px        | 500    | 1.3                                                         |

Headings use `--ink-1` (#1a1a1a). Body uses `--ink-1`. Meta uses `--ink-3` (#707070). Captions/placeholders use `--ink-4` (#9a9a9a).

---

## Color

60/30/10 split with risk colors as the sole accent system. Color is ONE of three redundant signals (color + icon + text label) — never used alone to convey state.

| Role            | Value                                                   | Usage                                                                  |
| --------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| Dominant (60%)  | `#fafaf8` (`--bg`)                                      | Page background — off-white, slightly warm                             |
| Secondary (30%) | `#ffffff` (`--surface`) + `#f3f3f0` (`--surface-muted`) | Cards, header, footer, panel background, search-field/pill backgrounds |
| Accent (10%)    | Risk palette only — see table below                     | Risk pills, badges, state row left-border, severity background blocks  |
| Destructive     | not applicable                                          | No user-initiated destructive actions in P5 (read-only dashboard)      |

**Risk palette** (INMET-aligned, all ink-on-fill verified WCAG AA):

| Level          | bg        | border    | ink       | PT-BR label         | Icon |
| -------------- | --------- | --------- | --------- | ------------------- | ---- |
| Green          | `#d1e7dd` | `#16a34a` | `#0d4f1e` | Sem alertas         | ✓    |
| Yellow         | `#fef7d6` | `#d4a017` | `#6b5006` | Atenção             | ⚠    |
| Orange         | `#fef0e1` | `#ea7c0c` | `#6b3206` | Alerta              | ⚠⚠   |
| Red            | `#fde2e2` | `#dc2626` | `#7a1f1f` | Perigo              | ⛔   |
| Gray (unknown) | `#ececea` | `#9a9a9a` | `#4a4a4a` | Dados indisponíveis | ?    |

**Yellow contrast lock:** Tailwind `yellow-500` (`#eab308`) fails WCAG AA on white (2.34:1). Use bespoke `#d4a017` border on `#fef7d6` fill with `#6b5006` ink. **NEVER white text on yellow.**

**Hairlines (border palette):**

- `--line` `#dcdcd6` — default 1px border (simulates 0.5px aesthetic)
- `--line-strong` `#bfbfb8` — footer top, phone-frame separators

**Ink scale:**

- `--ink-1` `#1a1a1a` primary text
- `--ink-2` `#444444` secondary text
- `--ink-3` `#707070` tertiary/metadata
- `--ink-4` `#9a9a9a` muted captions

Accent reserved for: **risk pills, risk badges, state row severity stripe (left border on `/estado/{uf}` aside), regional table "Nível" column cell, stale-source banner (orange/gray only)**. NEVER used on chrome (header, footer, topbar, region chips inactive state, share buttons, filter chips, links). Region filter chip "active" state uses `--ink-1` background + `--surface` text (inverse), NOT risk colors.

**Radii (locked minimal):**

- `--r-1` 2px (rare)
- `--r-2` 4px (risk pills, badges, source-link blocks)
- `--r-3` 6px (cards, callouts, inputs)
- No radii > 8px. SaaS rounded-corner aesthetic rejected.

**Anti-decoration locks:** no shadows, no gradients, no glows, no animations on alerts (no pulsing/blinking/shaking), no parallax, no blurred glass.

---

## Copywriting Contract

All copy PT-BR, locked verbatim. No translations, no variants.

### Severity labels (locked)

| Level   | Label (verbatim)    |
| ------- | ------------------- |
| Green   | Sem alertas         |
| Yellow  | Atenção             |
| Orange  | Alerta              |
| Red     | Perigo              |
| Unknown | Dados indisponíveis |

### Page elements

| Element                                  | Copy                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| Primary CTA (per state row)              | "Ver detalhes de {Estado}" → link to `/estado/{uf}`                                   |
| Secondary CTA (share, primary transport) | "Compartilhar no WhatsApp" → anchor to `https://wa.me/?text={encoded}`                |
| Secondary CTA (share, clipboard)         | "Copiar link" → `navigator.clipboard.writeText(url)`                                  |
| Clipboard confirmation toast             | "Link copiado." (auto-dismiss 2s)                                                     |
| Formula explainer link (per state row)   | "Como calculamos isso?" → anchor to PT-BR README `#` section                          |
| Filter chips                             | "Todas" · "Norte" · "Nordeste" · "Centro-Oeste" · "Sudeste" · "Sul"                   |
| Active filter chip aria                  | `aria-current="page"`                                                                 |
| Skip-link                                | "Pular para o conteúdo"                                                               |
| `/texto` page title                      | "Versão em texto" (h1)                                                                |
| `/texto` table column headers            | "Estado" · "Nível" · "Alertas ativos" · "Atualizado há"                               |
| Timestamp format                         | "Atualizado há {N} minutos" / "Atualizado há {N} horas" / "Atualizado há mais de 24h" |

### Empty / edge-state copy (LOCKED — never replace without explicit user approval)

| State                                   | Copy                                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Green state explainer (per state)       | "Não encontramos nenhuma emergência nessa localidade. Verifique em outras fontes de informação antes de decidir o que você vai fazer." |
| Stale source banner (top-of-page, SSR)  | "Não estamos recebendo dados do(a) {fonte}. Acesse {url} diretamente e busque a informação que você precisa."                          |
| Unknown level explainer                 | "Dados indisponíveis no momento. Verifique diretamente em {url da fonte}."                                                             |
| Total-failure floor (all sources stale) | Stale banner pinned top + gray cards for all 27 UFs + emergency contacts visible. Sketch finding 007 Variant C mandatory.              |
| 404 (unknown UF)                        | "Estado não encontrado. Volte para a página inicial." + link to `/`                                                                    |

### Share text template (LOCKED verbatim)

```
{Estado}: {Nível} — {explicação}. Veja em {URL}.
```

Example: `São Paulo: Alerta — Risco de enchentes na região metropolitana até sexta. Veja em https://ensobrasil.com.br/estado/sp.`

### Emergency contacts (mandatory on every page disclaimer, SSR)

```
199 Defesa Civil · 193 Bombeiros · 190 Polícia
```

Never bare digits. Never omit any of the three. Number-only formatting is incomplete information.

### Destructive confirmation

Not applicable — P5 surface is read-only. No destructive user actions exist.

---

## Interaction Contracts (P5-specific)

| Surface                          | Contract                                                                                                                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home `/` desktop                 | Top legend strip + 50/50 split, map left (Albers conic, parallels [-7,-22], rotate [54,0]) + cards right. Sketch finding 001-C.                                                                                                                                     |
| Home `/` mobile                  | Vertical card stack, generous spacing, locked reading order: Lead → Afeta → Válido → Fontes → Chips → 199/193/190 (red only) → Timestamp. Sketch finding 002-B. Map secondary below cards.                                                                          |
| Home `/` tablet                  | Constrained mobile-up (single CSS path, no separate breakpoint logic). Sketch finding 005-A.                                                                                                                                                                        |
| Map → `/estado/{uf}`             | Map state shapes wrap `<Link href="/estado/{uf}">`. No client useState. No panel swap. Full SSR navigation. Hover = CSS-only tooltip (prefer `<title>` attribute or minimal CSS pseudo, no panel mutation).                                                         |
| Per-state `/estado/{uf}` desktop | Two-column with permanent aside. Sketch finding 004-C verbatim.                                                                                                                                                                                                     |
| Per-state mobile                 | Linear stack, same reading order as home cards.                                                                                                                                                                                                                     |
| Region filter                    | URL-param `?region={slug}` single-select. Anchor links only, zero JS. Active chip `aria-current="page"` + inverse visual treatment (`--ink-1` bg, `--surface` text).                                                                                                |
| Share primary                    | `<a href="https://wa.me/?text={encoded}">` — works JS-off.                                                                                                                                                                                                          |
| Share secondary                  | `<button onclick="navigator.clipboard.writeText(url)">` + toast "Link copiado."                                                                                                                                                                                     |
| `/texto`                         | Single SSR page. Top: 5 regional `<table>` (Norte/NE/CO/SE/Sul). Bottom: 27 `<article id="{uf}">` sections, h3 per state. Table rows anchor-link to `#{uf}`. No icons (text labels carry severity). Pure semantic HTML. Heading outline: h1 → region h2 → state h3. |
| Loading state                    | SSR-instant with last-known fallback. NEVER skeleton. Sketch finding 007-A.                                                                                                                                                                                         |
| Total-failure floor              | All sources stale ≥ threshold → gray cards + top banner + emergency contacts. Sketch finding 007-C. Mandatory.                                                                                                                                                      |
| Stale-source banner              | SSR-rendered at TOP of page, never inline-only. FOUND-08 / DATA-07.                                                                                                                                                                                                 |
| Source attribution               | Per-alert source link with domain in mono-font (`ui-monospace`). Signals link is external.                                                                                                                                                                          |

---

## Registry Safety

| Registry        | Blocks Used            | Safety Gate    |
| --------------- | ---------------------- | -------------- |
| shadcn official | none — not initialized | not applicable |
| third-party     | none                   | not applicable |

No registry blocks consumed. All components built bespoke against the locked theme tokens. No safety vetting required.

---

## Hard Rules (non-negotiable, mirrored from sketch findings)

- ⛔ Never use color alone to convey risk — always color + icon + text label.
- ⛔ Never use weight ≥ 600. Locked to 400 + 500.
- ⛔ Never animate alert content (no pulsing, shaking, blinking).
- ⛔ Never use white text on yellow background.
- ⛔ Never render emergency contacts missing 190 (Polícia).
- ⛔ Never show emergency numbers without agency names ("199 Defesa Civil", not "199").
- ⛔ Never bury a stale-data notice inline only — top of page is the contract.
- ⛔ Never present green as default-when-uncertain — unknown (gray) when sources stale.
- ⛔ Never replace locked edge-state PT-BR strings without explicit user approval.
- ⛔ Never load external font files (Google Fonts, Inter, etc.).
- ⛔ Never use `next-intl` or i18n routing — PT-BR only, strings in `src/lib/messages.ts`.
- ⛔ Never introduce client-side panel swap on home — full SSR navigation only (D-05).
- ⛔ Never infer user region from geo-IP / accept-language — no default region (D-11).
- ⛔ Never use the Web Share API — wa.me anchor + clipboard only (D-09).
- ⛔ Never fan-out CEMADEN per-UF — single national-scope call per cron tick.

---

## Pre-Population Sources

| Source                              | Decisions Used                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `05-CONTEXT.md`                     | 11 decisions (D-01..D-11): SSR navigation model, /texto shape, share dual transport, filter URL-param, no geo-default |
| `05-SPEC.md`                        | 14 requirements + acceptance criteria (badge labels, share template, OG metadata, axe-core/Lighthouse gates)          |
| `sketch-findings-enso-brasil` SKILL | Locked theme tokens (2026-04-28), spacing scale, type scale, weight contract, hard rules, edge-state copy             |
| `references/03-tokens-theme.md`     | Verbatim color tokens, risk palette, radii, type scale, component recipes                                             |
| `CLAUDE.md`                         | Stack lock, risk levels, severity labels, hazard vocabulary, anti-features                                            |
| `risk-formula-v0.md`                | 5 levels including `unknown`, severity defaults                                                                       |
| User input                          | 0 questions asked — sketch findings + CONTEXT/SPEC fully covered the contract                                         |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

_Phase: 05-cemaden-dashboard-ui_
_UI-SPEC created: 2026-05-18_
_Theme source: `.claude/skills/sketch-findings-enso-brasil/sources/themes/default.css` (locked 2026-04-28)_
