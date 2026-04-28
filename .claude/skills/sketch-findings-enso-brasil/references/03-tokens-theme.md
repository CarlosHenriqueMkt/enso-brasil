# Tokens & Theme

The full set of CSS custom properties from the winning theme. Port these directly into the Tailwind v4 `@theme` block (or to CSS variables for non-Tailwind usage). The theme file lives at `sources/themes/default.css`.

## Surfaces & Ink

| Token | Hex | Role |
|-------|-----|------|
| `--bg` | `#fafaf8` | Page background — off-white, slightly warm |
| `--surface` | `#ffffff` | Cards, header, footer, panel background |
| `--surface-muted` | `#f3f3f0` | Search field background, count-pill area, subtle zones |
| `--ink-1` | `#1a1a1a` | Primary text |
| `--ink-2` | `#444444` | Secondary text |
| `--ink-3` | `#707070` | Tertiary / metadata / labels |
| `--ink-4` | `#9a9a9a` | Muted captions, placeholders |

## Hairlines (border palette)

| Token | Hex | Role |
|-------|-----|------|
| `--line` | `#dcdcd6` | Default border (1px simulating 0.5px aesthetic) |
| `--line-strong` | `#bfbfb8` | Stronger separator (footer top, phone frame) |

## Risk Colors — INMET-aligned

Each level has three tokens: background fill, border, ink (text on the fill). All hand-tuned to pass WCAG AA contrast for ink-on-fill.

| Level | `-bg` | `-border` | `-ink` |
|-------|-------|-----------|--------|
| Green  | `#d1e7dd` | `#16a34a` | `#0d4f1e` |
| Yellow | `#fef7d6` | `#d4a017` | `#6b5006` |
| Orange | `#fef0e1` | `#ea7c0c` | `#6b3206` |
| Red    | `#fde2e2` | `#dc2626` | `#7a1f1f` |
| Gray (Indisponível) | `#ececea` | `#9a9a9a` | `#4a4a4a` |

**Yellow contrast warning:** Tailwind's `#eab308` on white fails WCAG AA (2.34:1). The bespoke `#d4a017` here passes, but **never put white text on a yellow fill** — black ink only.

**Five levels, not four.** `unknown` (gray) is mandatory and reserved for absence-of-data. Risk engine never returns plain `green` when sources are stale.

## Spacing Scale (8pt)

| Token | px |
|-------|----|
| `--s-1` | 4 |
| `--s-2` | 8 |
| `--s-3` | 12 |
| `--s-4` | 16 |
| `--s-5` | 24 |
| `--s-6` | 32 |
| `--s-7` | 48 |
| `--s-8` | 64 |

Card-list mobile spec: 14px gap between cards, 16px card padding, 12px outer padding.
Desktop topbar: 14px vertical · 32px horizontal.

## Radii — minimal

| Token | px | Use |
|-------|----|----|
| `--r-1` | 2 | Tight (rare) |
| `--r-2` | 4 | Risk pills, badges, source-link blocks |
| `--r-3` | 6 | Cards, callouts, inputs |

No larger radii. The civic feel rejects rounded-corner SaaS aesthetics.

## Typography

```css
--font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
```

System-stack only. **Never load external font files** — 3G performance budget (REQ A11Y-05).

### Type scale

| Element | Size | Weight | Line-height | Notes |
|---------|------|--------|-------------|-------|
| Body default | 15px | 400 | 1.5 | Regular text |
| h1 | 22px | 500 | 1.3 | Topbar project name uses smaller (18px) variant |
| h2 | 18px | 500 | 1.35 | |
| h3 | 15px | 500 | 1.4 | |
| Card name (mobile) | 17px | 500 | 1.3 | |
| Card lead | 14.5px | 500 | 1.45 | The bold "what is happening" line |
| Card body-text | 13.5px | 400 | 1.55 | Supporting text |
| Card meta / footer | 12px | 400 | 1.4 | Timestamps, source counts |
| Section header (uppercase label) | 11.5–12.5px | 500 | 1.35 | `letter-spacing: 0.04em–0.06em; text-transform: uppercase;` |
| Mono domain | 11.5px | 400 | 1 | Font: var(--mono) |

**Weight contract: 400 + 500 ONLY.** No 600, 700, italics, or condensed.

## Iconography

Risk-level icon glyphs (Unicode, no icon font needed):

| Level | Icon |
|-------|------|
| Green | ✓ |
| Yellow | ⚠ |
| Orange | ⚠⚠ |
| Red | ⛔ |
| Gray | ? |

Always paired with the textual label ("Sem alertas", "Atenção", "Alerta", "Perigo", "Dados indisponíveis"). Never use the icon alone.

## Component recipes (recurring atoms)

### Risk pill (atomic)

Used in legend, badges, inline level indicators.

```css
.risk-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: var(--r-2);
  font-size: 13px;
  font-weight: 500;
  background: var(--surface);
}
.risk-green  { background: var(--green-bg);  color: var(--green-ink);  border-color: var(--green-border);  }
.risk-yellow { background: var(--yellow-bg); color: var(--yellow-ink); border-color: var(--yellow-border); }
.risk-orange { background: var(--orange-bg); color: var(--orange-ink); border-color: var(--orange-border); }
.risk-red    { background: var(--red-bg);    color: var(--red-ink);    border-color: var(--red-border);    }
.risk-gray   { background: var(--gray-bg);   color: var(--gray-ink);   border-color: var(--gray-border);   }
```

### Section header (small uppercase label)

```css
.section-h {
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin: 14px 0 8px;
}
```

### Skip link (a11y)

```css
.skip { position: absolute; left: -9999px; }
.skip:focus {
  left: 12px; top: 12px;
  background: var(--ink-1); color: var(--surface);
  padding: 8px 12px; border-radius: 4px; z-index: 200;
}
```

## Tailwind v4 port (suggested)

```css
@theme {
  --color-bg: #fafaf8;
  --color-surface: #ffffff;
  --color-surface-muted: #f3f3f0;
  --color-ink-1: #1a1a1a;
  --color-ink-2: #444444;
  --color-ink-3: #707070;
  --color-ink-4: #9a9a9a;
  --color-line: #dcdcd6;
  --color-line-strong: #bfbfb8;

  --color-risk-green-bg: #d1e7dd;
  --color-risk-green-border: #16a34a;
  --color-risk-green-ink: #0d4f1e;
  --color-risk-yellow-bg: #fef7d6;
  --color-risk-yellow-border: #d4a017;
  --color-risk-yellow-ink: #6b5006;
  --color-risk-orange-bg: #fef0e1;
  --color-risk-orange-border: #ea7c0c;
  --color-risk-orange-ink: #6b3206;
  --color-risk-red-bg: #fde2e2;
  --color-risk-red-border: #dc2626;
  --color-risk-red-ink: #7a1f1f;
  --color-risk-gray-bg: #ececea;
  --color-risk-gray-border: #9a9a9a;
  --color-risk-gray-ink: #4a4a4a;

  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;

  --radius-1: 2px;
  --radius-2: 4px;
  --radius-3: 6px;
}
```

## What to Avoid

| Rejected | Reason |
|----------|--------|
| External font loading (Google Fonts, Inter, etc.) | 3G performance budget; visual direction is system-font-friendly |
| Radii > 8px | SaaS-feel; civic direction prefers tight corners |
| Font weights 600/700/800 | Locked to 400 + 500 only — anti-sensationalism |
| Italic for emphasis | Same — emphasis comes from layout and color |
| Tailwind default `yellow-500` on white | Fails WCAG AA contrast; use bespoke `#d4a017` |
| Drop shadows / elevation system | Civic direction explicitly rejects them — use hairline borders for separation |
| Gradients | Same — chrome stays flat |
| Animated backgrounds, parallax, blurred glass | Anti-sensationalism; nothing distracts from the data |

## Origin

Theme file: `sources/themes/default.css` — full CSS custom-property declarations.

Synthesized from all three sketches (001/002/003) which share the theme.
