---
phase: 03-pure-risk-engine
plan: 02
type: execute
wave: 0
depends_on: []
files_modified:
  - src/lib/messages.ts
  - src/lib/messages.test.ts
autonomous: true
requirements: [RISK-09]
must_haves:
  truths:
    - "messages.risk.severity maps low|moderate|high|extreme → Atenção|Alerta|Perigo|Perigo extremo (verbatim)"
    - "messages.risk.hazard maps every HAZARD_KINDS literal → PT-BR noun phrase"
    - "messages.risk.source maps cemaden|inmet|stub → CEMADEN|INMET|Stub"
    - "Existing messages.* keys (severity, app, privacy, etc.) untouched"
    - "messages.test.ts updated to assert presence + exact strings of new risk block"
  artifacts:
    - path: "src/lib/messages.ts"
      provides: "Additive risk: { severity, hazard, source } block"
      contains: "messages.risk.severity"
  key_links:
    - from: "src/lib/messages.ts"
      to: "src/lib/risk/vocab.ts (Plan 05)"
      via: "import { messages } from '@/lib/messages'"
      pattern: "messages\\.risk\\."
---

# Plan 02 — D-02 messages.ts extension (PT-BR risk vocab SoT)

**Goal:** Add additive `risk.{severity,hazard,source}` block to `src/lib/messages.ts`. Locks PT-BR copy as single SoT; Plan 05 will re-export typed views from this.

## Required reading

- `.planning/phases/03-pure-risk-engine/03-CONTEXT.md` (D-02 — full block in step 1)
- `.planning/phases/03-pure-risk-engine/03-PATTERNS.md` (lines 189-191 — append after `privacy` block)
- `src/lib/messages.ts` (current shape — `as const` literal)
- `src/lib/messages.test.ts` (existing skipIf + dynamic-import pattern)
- `src/lib/sources/schema.ts` (`HAZARD_KINDS` enum — names must match keys verbatim)

## Files touched

| Path                       | Change                                       |
| -------------------------- | -------------------------------------------- |
| `src/lib/messages.ts`      | modify (additive — new top-level `risk` key) |
| `src/lib/messages.test.ts` | modify (add assertions for new block)        |

## Tasks

### Task 2.1 — Append `risk` block to `messages` object

<files>src/lib/messages.ts</files>

<action>
Per D-02 step 1 (verbatim):

1. Locate the `messages` object literal (currently `export const messages = { ... } as const;`).
2. Locate the existing `privacy` block (last existing top-level key per PATTERNS line 191).
3. Append immediately after `privacy` (and any trailing comma), before the closing `} as const;`:

```ts
risk: {
  /** Per-alert severity labels (verbatim CEMADEN/INMET vocabulary, RISK-09). */
  severity: {
    low: "Atenção",
    moderate: "Alerta",
    high: "Perigo",
    extreme: "Perigo extremo",
  },
  /** Hazard noun phrases for explanation prose. Keys mirror HAZARD_KINDS exactly. */
  hazard: {
    queimada: "queimada",
    enchente: "enchente",
    estiagem: "estiagem",
    incendio: "incêndio",
    inundacao: "inundação",
    seca: "seca",
  },
  /** Source display names for explanation prose attribution. */
  source: {
    cemaden: "CEMADEN",
    inmet: "INMET",
    stub: "Stub",
  },
},
```

4. Do NOT modify any existing key. Do NOT rename. Order of keys inside `risk.severity` and `risk.hazard` MUST match the order shown (downstream snapshot tests will key on this).
5. Verify the file still parses as `as const` (no comma slip).
   </action>

<verify>
  <automated>pnpm tsc --noEmit && node -e "import('./src/lib/messages.ts').then(m=>{const r=m.messages.risk;if(r.severity.low!=='Atenção'||r.severity.extreme!=='Perigo extremo'||r.hazard.queimada!=='queimada'||r.source.cemaden!=='CEMADEN')process.exit(1)})"</automated>
</verify>

<done>
- `messages.risk.severity.low === "Atenção"`, `.moderate === "Alerta"`, `.high === "Perigo"`, `.extreme === "Perigo extremo"`
- `messages.risk.hazard.{queimada,enchente,estiagem,incendio,inundacao,seca}` all present with PT-BR values
- `messages.risk.source.{cemaden,inmet,stub}` present
- Existing `messages.severity.{green,yellow,orange,red,gray}` untouched
- `tsc --noEmit` clean
</done>

### Task 2.2 — Extend `messages.test.ts` with risk-block assertions

<files>src/lib/messages.test.ts</files>

<action>
Mirror the existing `skipIf(!existsSync(...)) + await import("./messages")` pattern (PATTERNS line 17). Add a new `describe("messages.risk", ...)` block:

```ts
describe("messages.risk (RISK-09 vocab SoT)", () => {
  it.skipIf(!existsSync(messagesPath))(
    "exposes severity / hazard / source maps with locked PT-BR labels",
    async () => {
      const { messages } = await import("./messages");
      // Severity (per-alert)
      expect(messages.risk.severity).toEqual({
        low: "Atenção",
        moderate: "Alerta",
        high: "Perigo",
        extreme: "Perigo extremo",
      });
      // Hazard noun phrases — keys must match HAZARD_KINDS verbatim
      expect(messages.risk.hazard).toEqual({
        queimada: "queimada",
        enchente: "enchente",
        estiagem: "estiagem",
        incendio: "incêndio",
        inundacao: "inundação",
        seca: "seca",
      });
      // Source attribution
      expect(messages.risk.source).toEqual({
        cemaden: "CEMADEN",
        inmet: "INMET",
        stub: "Stub",
      });
    },
  );

  it.skipIf(!existsSync(messagesPath))(
    "preserves existing messages.severity (state-level RiskLevel labels)",
    async () => {
      const { messages } = await import("./messages");
      // Sanity: green/gray must still resolve to locked PT-BR labels per PROJECT.md
      expect(messages.severity.green).toBe("Sem alertas");
      expect(messages.severity.gray).toBe("Dados indisponíveis");
    },
  );
});
```

Reuse whatever `messagesPath` constant the existing test file already has. Place the new `describe` block at the end of the file.
</action>

<verify>
  <automated>pnpm test src/lib/messages.test.ts</automated>
</verify>

<done>
- Both new `it` blocks pass
- Existing `messages.test.ts` assertions still pass
- No mocks; tests load real `messages.ts` via dynamic import
</done>

## Verification (plan-wide)

```bash
pnpm tsc --noEmit
pnpm test src/lib/messages.test.ts
```

## RISK-IDs covered

- **RISK-09** (vocabulary source — generator consumes via Plan 05)

## Dependencies

None (Wave 0). Independent of Plan 01 (no file overlap).

## Estimated commits

2 (one per task).
