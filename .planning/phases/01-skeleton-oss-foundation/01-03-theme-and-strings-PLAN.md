---
phase: 01-skeleton-oss-foundation
plan: 03
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/app/globals.css
  - src/lib/messages.ts
  - src/components/SourceLink.tsx
autonomous: true
requirements:
  - FOUND-07
  - FOUND-08
  - FOUND-09
  - FOUND-10
  - FOUND-11

must_haves:
  truths:
    - 'Importing `messages.emergency.inline` returns `"199 Defesa Civil · 193 Bombeiros · 190 Polícia"` verbatim'
    - "All 5 risk-level CSS variables exist (`--color-risk-{green,yellow,orange,red,gray}-bg`)"
    - "Yellow border variable equals `#d4a017` (darkened, NOT default `#eab308`)"
    - 'SourceLink renders the URL hostname inside `<span class="font-mono">`'
    - "Wave-0 unit tests for messages and SourceLink now pass (no longer skipped)"
  artifacts:
    - path: "src/app/globals.css"
      provides: "Tailwind v4 @theme block with full token system from sketch-findings 03-tokens-theme.md"
      contains: "@theme"
    - path: "src/lib/messages.ts"
      provides: "PT-BR strings SoT — emergency, disclaimer, edgeStates, severityLabels, privacy"
      exports: ["messages"]
    - path: "src/components/SourceLink.tsx"
      provides: "Reusable external link with mono-font hostname (REQ-S1.10 + FOUND-10)"
      exports: ["SourceLink"]
  key_links:
    - from: "src/lib/messages.ts"
      to: "consumers (layout, /privacidade)"
      via: "named export `messages`"
      pattern: "export const messages"
    - from: "src/components/SourceLink.tsx"
      to: "@theme font-mono utility"
      via: 'className="font-mono"'
      pattern: "font-mono"
    - from: "src/app/globals.css @theme"
      to: "Tailwind utility generation"
      via: "Tailwind v4 Oxide build"
      pattern: "--color-risk-yellow-bd:\\s*#d4a017"
---

<objective>
Land the design contract: full @theme token block (from sketch-findings 03-tokens-theme.md), the PT-BR strings SoT (`messages.ts`), and the SourceLink component. These three artifacts are the design/copy interface every later phase consumes — no UI invention, only locked tokens.

Purpose: Pure-content plan with zero dependencies on routing/CI. Runs in parallel with plan 02 (tooling) because file sets are disjoint.
Output: globals.css with @theme · messages.ts with locked strings · SourceLink.tsx + the Wave-0 tests from plan 02 now flip from skipped → passing.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-skeleton-oss-foundation/01-SPEC.md
@.planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md
@.planning/phases/01-skeleton-oss-foundation/01-RESEARCH.md
@.claude/skills/sketch-findings-enso-brasil/SKILL.md
@.claude/skills/sketch-findings-enso-brasil/references/03-tokens-theme.md
@.claude/skills/sketch-findings-enso-brasil/references/02-edge-states-source-trust.md

<interfaces>
LOCKED — copy verbatim, do NOT paraphrase:

Emergency line (sketch-findings hard rule, NEVER bare numbers):
"199 Defesa Civil · 193 Bombeiros · 190 Polícia"

Severity labels (5, locked verbatim from CEMADEN/INMET vocabulary):
green → "Sem alertas"
yellow → "Atenção"
orange → "Alerta"
red → "Perigo"
gray → "Dados indisponíveis"

Edge-state copy (FOUND-09 + sketch-findings/02):
Verde: "Não encontramos nenhuma emergência nessa localidade. Verifique em outras fontes de informação antes de decidir o que você vai fazer."
Stale: "Não estamos recebendo dados do(a) {fonte}. Acesse {url} diretamente e busque a informação que você precisa."

Disclaimer body (aggregator stance):
"Este site agrega informações de fontes oficiais. Não substitui sistemas oficiais de alerta. Em emergência, ligue:"
(followed by emergency.inline)

Privacy version format (D-06):
"Versão de 30 de abril de 2026"

Theme tokens (RESEARCH Pattern 1 — full set):
Surfaces: --color-bg #fafaf8 · --color-surface #ffffff · --color-ink-1 #111111 · --color-ink-2 #555555 · --color-hairline #e5e5e0
Risk (5): green-bg #e7f3e8 / bd #2e7d32
yellow-bg #fff7d6 / bd #d4a017 ← DARKENED, NEVER #eab308 (Pitfall 3)
orange-bg #ffe7cc / bd #e76f00
red-bg #fde2e2 / bd #c62828
gray-bg #ececec / bd #757575
Spacing: --spacing 0.5rem (8pt scale)
Radii: --radius-sm 2px · --radius-md 4px · --radius-lg 6px
Fonts: system stack (NO external font files)

SourceLink contract (REQ-S1.11 + FOUND-10):
Props: { href: string; name: string }
Render: <a href={href} target="_blank" rel="noopener noreferrer">{name} <span class="font-mono text-ink-2">({hostname})</span></a>
Server Component (no 'use client').
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Theme tokens (@theme) + PT-BR strings module</name>
  <read_first>
    - .planning/phases/01-skeleton-oss-foundation/01-SPEC.md (REQ-S1.04, REQ-S1.10)
    - .claude/skills/sketch-findings-enso-brasil/references/03-tokens-theme.md (full token system — SoT)
    - .claude/skills/sketch-findings-enso-brasil/SKILL.md (locked PT-BR copy + hard rules)
    - .planning/phases/01-skeleton-oss-foundation/01-RESEARCH.md (Pattern 1, Pattern 3, Pitfall 3)
    - src/app/globals.css (current state from plan 01)
    - src/lib/messages.test.ts (the test that defines what messages.ts must export)
  </read_first>
  <behavior>
    - WHEN globals.css is processed by Tailwind v4 Oxide, THEN every required CSS custom property is emitted (10 surface/ink + 10 risk-color + spacing + 3 radii + 2 font stacks).
    - WHEN messages.test.ts runs, THEN `messages.emergency.inline` exact-match passes; disclaimer.body length > 20; messages module contains zero matches for `next-intl|i18n|useTranslations|locale`.
    - The SPEC acceptance grep `grep -r "fonts.googleapis" .next/` returns empty (system fonts only).
  </behavior>
  <files>src/app/globals.css, src/lib/messages.ts</files>
  <action>
    1. REPLACE `src/app/globals.css` with EXACTLY (copy hex codes verbatim — they are locked design contract from sketch-findings):
       ```css
       @import "tailwindcss";

       /*
        * ENSO Brasil — design tokens.
        * Source of truth: .claude/skills/sketch-findings-enso-brasil/references/03-tokens-theme.md
        * Risk palette is INMET-aligned (5 levels including `unknown` → gray).
        *
        * WCAG note (Pitfall 3): yellow border is the DARKENED #d4a017 — Tailwind's
        * default `yellow-500` (#eab308) fails WCAG AA on white (2.34:1 contrast).
        * NEVER pair white text with yellow background — black ink on yellow always.
        */
       @theme {
         /* Surfaces */
         --color-bg: #fafaf8;
         --color-surface: #ffffff;
         --color-ink-1: #111111;
         --color-ink-2: #555555;
         --color-hairline: #e5e5e0;

         /* INMET-aligned 5-level risk palette (bg / border triplets) */
         --color-risk-green-bg:  #e7f3e8;
         --color-risk-green-bd:  #2e7d32;
         --color-risk-yellow-bg: #fff7d6;
         --color-risk-yellow-bd: #d4a017;  /* darkened — bespoke; NEVER white text on yellow */
         --color-risk-orange-bg: #ffe7cc;
         --color-risk-orange-bd: #e76f00;
         --color-risk-red-bg:    #fde2e2;
         --color-risk-red-bd:    #c62828;
         --color-risk-gray-bg:   #ececec;
         --color-risk-gray-bd:   #757575;

         /* 8pt spacing scale (Tailwind v4 generates p-1..p-N from this base) */
         --spacing: 0.5rem;

         /* Radii */
         --radius-sm: 2px;
         --radius-md: 4px;
         --radius-lg: 6px;

         /* System fonts only — NO external font files (3G performance budget) */
         --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
         --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
       }

       /* Reduced motion (REQ-S1.09 a11y shell) */
       @media (prefers-reduced-motion: reduce) {
         *,
         *::before,
         *::after {
           animation-duration: 0.01ms !important;
           animation-iteration-count: 1 !important;
           transition-duration: 0.01ms !important;
         }
       }

       /* Skip link visibility on focus (REQ-S1.09) */
       .skip-link {
         position: absolute;
         left: -9999px;
       }
       .skip-link:focus-visible {
         left: 0.5rem;
         top: 0.5rem;
         padding: 0.5rem 0.75rem;
         background: var(--color-surface);
         color: var(--color-ink-1);
         border: 1px solid var(--color-hairline);
         border-radius: var(--radius-md);
         z-index: 100;
       }

       html {
         background: var(--color-bg);
         color: var(--color-ink-1);
         font-family: var(--font-sans);
       }
       ```

    2. CREATE `src/lib/messages.ts` (per REQ-S1.10, D-06, sketch-findings hard rules — copy verbatim, do NOT paraphrase any string):
       ```ts
       /**
        * ENSO Brasil — PT-BR strings (single source of truth).
        *
        * NOT an i18n catalog. Project is PT-BR only — `next-intl` is intentionally
        * REMOVED from the stack (see PROJECT.md key decisions, P1 CONTEXT D-13 history).
        *
        * Locked verbatim by sketch-findings-enso-brasil skill. Do not paraphrase.
        */
       export const messages = {
         emergency: {
           // Sketch-findings HARD RULE: never bare numbers — always paired with agency.
           inline: "199 Defesa Civil · 193 Bombeiros · 190 Polícia",
         },
         disclaimer: {
           body: "Este site agrega informações de fontes oficiais. Não substitui sistemas oficiais de alerta. Em emergência, ligue:",
         },
         severity: {
           // CEMADEN/INMET vocabulary — locked verbatim
           green: "Sem alertas",
           yellow: "Atenção",
           orange: "Alerta",
           red: "Perigo",
           gray: "Dados indisponíveis",
         },
         edgeStates: {
           verde:
             "Não encontramos nenhuma emergência nessa localidade. Verifique em outras fontes de informação antes de decidir o que você vai fazer.",
           // {fonte} and {url} are template slots filled by the renderer in P5/P6.
           staleTemplate:
             "Não estamos recebendo dados do(a) {fonte}. Acesse {url} diretamente e busque a informação que você precisa.",
         },
         a11y: {
           skipLink: "Pular para o conteúdo principal",
         },
         privacy: {
           // D-06: date-only PT-BR natural format. Update on every revision.
           version: "Versão de 30 de abril de 2026",
           sections: {
             coletamos: "O que coletamos",
             retencao: "Por quanto tempo",
             paraQue: "Para quê",
             naoColetamos: "O que NÃO coletamos",
             direitos: "Direitos do titular sob a LGPD",
             contato: "Contato responsável",
             versao: "Versão e data da política",
           },
           // D-05: LinkedIn is the contact channel for ALL matters during v1
           contactUrl: "https://www.linkedin.com/in/carloshenriquerp/",
           contactName: "Carlos Henrique (mantenedor)",
         },
       } as const;
       ```

    3. Run the unit tests written in plan 02:
       ```
       pnpm test src/lib/messages.test.ts
       ```
       All 3 tests in messages.test.ts should now pass (no longer skipped).

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm test src/lib/messages.test.ts && pnpm exec tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test src/lib/messages.test.ts` exits 0 with 3 passed (NOT skipped)
    - `grep -F -c "199 Defesa Civil · 193 Bombeiros · 190 Polícia" src/lib/messages.ts` returns 1
    - `grep -c "@theme" src/app/globals.css` returns 1
    - `grep -c -- "--color-risk-yellow-bd: #d4a017" src/app/globals.css` returns 1
    - `grep -c -- "#eab308" src/app/globals.css` returns 0 (default Tailwind yellow MUST NOT appear)
    - `grep -cE -- "--color-risk-(green|yellow|orange|red|gray)-bg" src/app/globals.css` returns 5
    - `grep -cE -- "--color-risk-(green|yellow|orange|red|gray)-bd" src/app/globals.css` returns 5
    - `grep -c "ui-sans-serif" src/app/globals.css` returns 1 (system font stack)
    - `grep -cE "fonts\.googleapis|@import url\(" src/app/globals.css` returns 0
    - `grep -cE "next-intl|useTranslations|i18n|locale" src/lib/messages.ts` returns 0
    - `pnpm exec tsc --noEmit` exits 0
    - All 5 severity labels appear verbatim: `grep -Fc '"Sem alertas"' src/lib/messages.ts` returns 1; same for `"Atenção"`, `"Alerta"`, `"Perigo"`, `"Dados indisponíveis"`
  </acceptance_criteria>
  <done>Theme tokens land with the darkened yellow #d4a017. messages.ts exports the locked strings verbatim. Plan 02's messages.test.ts now passes (3/3, no skips). Zero next-intl footprint.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: SourceLink component (FOUND-10 + REQ-S1.11)</name>
  <read_first>
    - .planning/phases/01-skeleton-oss-foundation/01-SPEC.md (REQ-S1.11)
    - .planning/phases/01-skeleton-oss-foundation/01-RESEARCH.md (Code Examples §SourceLink)
    - .claude/skills/sketch-findings-enso-brasil/SKILL.md (FOUND-10 hard rule: domain in mono-font)
    - src/components/SourceLink.test.tsx (the test contract)
  </read_first>
  <behavior>
    WHEN `<SourceLink href="https://alertas.cemaden.gov.br" name="CEMADEN" />` is rendered server-side, THEN:
    - The output contains the literal text "CEMADEN"
    - The hostname `alertas.cemaden.gov.br` appears wrapped in a `<span>` whose class includes `font-mono`
    - The anchor has `target="_blank"` AND `rel="noopener noreferrer"` (security baseline for external links)
    - No `'use client'` directive (Server Component)
  </behavior>
  <files>src/components/SourceLink.tsx</files>
  <action>
    Create `src/components/SourceLink.tsx` with EXACTLY (RESEARCH §Code Examples):
    ```tsx
    /**
     * SourceLink — external link to an official source with the hostname in mono font.
     *
     * Locked design rule (sketch-findings FOUND-10): fonte oficial sempre linkada;
     * o domínio em mono-font sinaliza link externo / oficial.
     *
     * P1 use: contact line on /privacidade (D-05 — LinkedIn).
     * P5+ use: every card that cites CEMADEN, INMET, IBGE, Defesa Civil, NOAA.
     *
     * Server Component (no 'use client') — pure render, no client state.
     */
    type Props = {
      href: string;
      name: string;
    };

    export function SourceLink({ href, name }: Props) {
      const domain = new URL(href).hostname;
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {name} <span className="font-mono text-ink-2">({domain})</span>
        </a>
      );
    }
    ```

    Run the snapshot test from plan 02:
    ```
    pnpm test src/components/SourceLink.test.tsx
    ```
    Must pass (1/1, no longer skipped).

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm test src/components/SourceLink.test.tsx && pnpm exec tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test src/components/SourceLink.test.tsx` exits 0 with 1 passed (NOT skipped)
    - `grep -c "'use client'" src/components/SourceLink.tsx` returns 0
    - `grep -c "font-mono" src/components/SourceLink.tsx` returns 1
    - `grep -c 'rel="noopener noreferrer"' src/components/SourceLink.tsx` returns 1
    - `grep -c 'target="_blank"' src/components/SourceLink.tsx` returns 1
    - `grep -c "new URL(href).hostname" src/components/SourceLink.tsx` returns 1
    - `grep -cE "export (function|const) SourceLink" src/components/SourceLink.tsx` returns 1
    - `pnpm exec tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>SourceLink ships as Server Component with mono-font hostname; plan 02's snapshot test passes. Ready for plan 05 to dogfood it on the LinkedIn contact line in /privacidade.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary               | Description                                                      |
| ---------------------- | ---------------------------------------------------------------- |
| href prop → user click | External URLs open in new tab — must isolate from opener context |
| URL constructor input  | `new URL(href)` will throw on invalid input                      |

## STRIDE Threat Register

| Threat ID | Category                       | Component                          | Disposition | Mitigation Plan                                                                                                                                            |
| --------- | ------------------------------ | ---------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-01-06   | Tampering / Reverse Tabnabbing | SourceLink external links          | mitigate    | `rel="noopener noreferrer"` on every external anchor (verified by grep gate in `<acceptance_criteria>`)                                                    |
| T-01-07   | Denial of Service              | Invalid `href` crashes `new URL()` | accept      | P1 only consumes locally-controlled hrefs (LinkedIn URL, sketch-findings examples). Untrusted-href guard deferred to P5 when user-data-driven sources land |

</threat_model>

<verification>
`pnpm test` exits 0 with 4 tests passed (3 messages + 1 SourceLink) — none skipped. `pnpm exec tsc --noEmit` exits 0.
</verification>

<success_criteria>
@theme block emits the full sketch-findings token set with darkened yellow #d4a017. messages.ts is the SoT for PT-BR strings with locked emergency line and 5 severity labels. SourceLink dogfoods FOUND-10 mono-font hostname rendering.
</success_criteria>

<output>
After completion, create `.planning/phases/01-skeleton-oss-foundation/01-03-SUMMARY.md`
</output>
