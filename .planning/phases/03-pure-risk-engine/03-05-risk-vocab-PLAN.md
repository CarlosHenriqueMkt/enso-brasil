---
phase: 03-pure-risk-engine
plan: 05
type: execute
wave: 1
depends_on: [02, 04]
files_modified:
  - src/lib/risk/vocab.ts
  - src/lib/risk/vocab.test.ts
autonomous: true
requirements: [RISK-09]
must_haves:
  truths:
    - "src/lib/risk/vocab.ts re-exports messages.risk.* as typed maps"
    - "LEVEL_LABEL maps green→'Sem alertas', yellow→'Atenção', orange→'Alerta', red→'Perigo', unknown→'Dados indisponíveis'"
    - "SEVERITY_LABEL is messages.risk.severity (typed Record<Severity,string>)"
    - "HAZARD_LABEL is messages.risk.hazard"
    - "SOURCE_LABEL is messages.risk.source"
    - "vocab.ts is the only file under src/lib/risk/ that imports @/lib/messages (verified by ESLint override + manual grep)"
    - "vocab.test.ts asserts each map's contents (snapshot or equality)"
  artifacts:
    - path: "src/lib/risk/vocab.ts"
      provides: "LEVEL_LABEL, SEVERITY_LABEL, HAZARD_LABEL, SOURCE_LABEL typed re-exports"
    - path: "src/lib/risk/vocab.test.ts"
      provides: "Equality assertions covering all map keys"
  key_links:
    - from: "src/lib/risk/vocab.ts"
      to: "src/lib/messages.ts"
      via: "import { messages } from '@/lib/messages'"
      pattern: "from\\s+['\"]@/lib/messages['\"]"
---

# Plan 05 — Risk vocab module (RISK-09 typed re-exports)

**Goal:** Thin typed re-export layer over `messages.risk.*`. The only file in `src/lib/risk/` allowed to import `@/lib/messages` (gated by Plan 03 ESLint override).

## Required reading

- `.planning/phases/03-pure-risk-engine/03-CONTEXT.md` (D-02 step 2 — `vocab.ts` shape verbatim)
- `.planning/phases/03-pure-risk-engine/03-PATTERNS.md` (lines 105-115 — vocab.ts analog `registry-meta.ts`)
- `src/lib/messages.ts` (post Plan 02)
- `src/lib/risk/types.ts` (post Plan 04 — Severity, RiskLevel imports)
- `src/lib/messages.test.ts` (skipIf+dynamic-import pattern for vocab.test.ts)

## Files touched

| Path                         | Change     |
| ---------------------------- | ---------- |
| `src/lib/risk/vocab.ts`      | **create** |
| `src/lib/risk/vocab.test.ts` | **create** |

## Tasks

### Task 5.1 — Create `src/lib/risk/vocab.ts`

<files>src/lib/risk/vocab.ts</files>

<action>
Per CONTEXT D-02 step 2 (verbatim):

```ts
/**
 * ENSO Brasil — Risk vocab typed re-exports (RISK-09).
 *
 * The ONLY file under `src/lib/risk/` allowed to import `@/lib/messages`.
 * Other risk modules consume PT-BR strings exclusively via this re-export layer.
 * (Enforced by ESLint no-restricted-imports override + dependency-cruiser scan.)
 *
 * D-02 — single SoT for PT-BR copy lives in messages.ts; this file freezes
 * the shape with explicit typed maps for autocompletion and exhaustiveness.
 */

import { messages } from "@/lib/messages";
import type { RiskLevel, Severity } from "./types";

/** RiskLevel → PT-BR label (state-level UI copy). */
export const LEVEL_LABEL: Readonly<Record<RiskLevel, string>> = Object.freeze({
  green: messages.severity.green,
  yellow: messages.severity.yellow,
  orange: messages.severity.orange,
  red: messages.severity.red,
  unknown: messages.severity.gray,
});

/** Severity → PT-BR label (per-alert UI copy). */
export const SEVERITY_LABEL: Readonly<Record<Severity, string>> = Object.freeze({
  low: messages.risk.severity.low,
  moderate: messages.risk.severity.moderate,
  high: messages.risk.severity.high,
  extreme: messages.risk.severity.extreme,
});

/** HazardKind → PT-BR noun phrase (for explanation prose). */
export const HAZARD_LABEL = Object.freeze({ ...messages.risk.hazard });

/** source_key → display name (e.g., "cemaden" → "CEMADEN"). */
export const SOURCE_LABEL = Object.freeze({ ...messages.risk.source });
```

**Notes:**

- `Object.freeze` mirrors `registry-meta.ts` pattern (PATTERNS line 220).
- Explicit `Readonly<Record<RiskLevel, string>>` for `LEVEL_LABEL` + `SEVERITY_LABEL` makes TS enforce exhaustiveness — adding a new RiskLevel without updating this map → compile error.
- `HAZARD_LABEL` and `SOURCE_LABEL` use `{ ...messages.risk.X }` spread (typed by inference) so adding a new hazard or source key in `messages.ts` flows through automatically — explanation generator handles unmapped via `?? raw_key` (RESEARCH open Q 4).
  </action>

<verify>
  <automated>pnpm tsc --noEmit && pnpm lint src/lib/risk/vocab.ts && pnpm depcruise</automated>
</verify>

<done>
- `src/lib/risk/vocab.ts` exists, exports 4 maps
- TypeScript exhaustiveness compiles
- ESLint passes (the import of `@/lib/messages` is allowed in vocab.ts only — no rule blocks it; logger imports would fail, but vocab doesn't use them)
- dep-cruiser green
</done>

### Task 5.2 — Create `src/lib/risk/vocab.test.ts`

<files>src/lib/risk/vocab.test.ts</files>

<action>
Mirror `src/lib/messages.test.ts` skipIf+dynamic-import pattern (PATTERNS line 153):

```ts
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const vocabPath = path.resolve(__dirname, "vocab.ts");

describe("risk/vocab — typed PT-BR re-exports (RISK-09)", () => {
  it.skipIf(!existsSync(vocabPath))(
    "LEVEL_LABEL maps every RiskLevel to locked PT-BR copy",
    async () => {
      const { LEVEL_LABEL } = await import("./vocab");
      expect(LEVEL_LABEL).toEqual({
        green: "Sem alertas",
        yellow: "Atenção",
        orange: "Alerta",
        red: "Perigo",
        unknown: "Dados indisponíveis",
      });
    },
  );

  it.skipIf(!existsSync(vocabPath))(
    "SEVERITY_LABEL maps every Severity to locked PT-BR copy",
    async () => {
      const { SEVERITY_LABEL } = await import("./vocab");
      expect(SEVERITY_LABEL).toEqual({
        low: "Atenção",
        moderate: "Alerta",
        high: "Perigo",
        extreme: "Perigo extremo",
      });
    },
  );

  it.skipIf(!existsSync(vocabPath))("HAZARD_LABEL covers every HAZARD_KINDS literal", async () => {
    const { HAZARD_LABEL } = await import("./vocab");
    expect(HAZARD_LABEL).toEqual({
      queimada: "queimada",
      enchente: "enchente",
      estiagem: "estiagem",
      incendio: "incêndio",
      inundacao: "inundação",
      seca: "seca",
    });
  });

  it.skipIf(!existsSync(vocabPath))("SOURCE_LABEL covers cemaden/inmet/stub", async () => {
    const { SOURCE_LABEL } = await import("./vocab");
    expect(SOURCE_LABEL).toEqual({
      cemaden: "CEMADEN",
      inmet: "INMET",
      stub: "Stub",
    });
  });

  it.skipIf(!existsSync(vocabPath))("all maps are frozen (Object.freeze)", async () => {
    const mod = await import("./vocab");
    expect(Object.isFrozen(mod.LEVEL_LABEL)).toBe(true);
    expect(Object.isFrozen(mod.SEVERITY_LABEL)).toBe(true);
    expect(Object.isFrozen(mod.HAZARD_LABEL)).toBe(true);
    expect(Object.isFrozen(mod.SOURCE_LABEL)).toBe(true);
  });
});
```

**Notes:**

- The `node:fs`/`node:path` imports are in the TEST file, not vocab.ts. Plan 03 ESLint override is scoped to `src/lib/risk/**/*.ts` which DOES include test files — verify the override allows test-time `node:*` (it does NOT by default).
- **Mitigation:** If ESLint blocks `node:fs` in this test file, narrow the override files glob to `src/lib/risk/**/*.ts` excluding `*.test.ts`, OR drop the `existsSync` guard (vocab.ts always exists post-Task 5.1). **Preferred:** drop the guard — Plan 05 always runs after vocab.ts is created, so the skipIf is defensive theater inherited from messages.test.ts. Use plain `it(...)` without skipIf.
- Adjust the test file accordingly: remove `node:fs`/`node:path` imports, remove `vocabPath`, change `it.skipIf(...)` → `it(...)`.
  </action>

<verify>
  <automated>pnpm test src/lib/risk/vocab.test.ts && pnpm lint src/lib/risk/vocab.test.ts</automated>
</verify>

<done>
- All 5 `it` blocks pass
- ESLint clean on the test file
- Coverage of `vocab.ts` reports 100% lines + branches (frozen object literal — every key referenced by tests)
</done>

## Verification (plan-wide)

```bash
pnpm test src/lib/risk/vocab.test.ts
pnpm tsc --noEmit
pnpm lint src/lib/risk
pnpm depcruise
# Sanity: vocab.ts is the ONLY risk/ file importing @/lib/messages
grep -rn "@/lib/messages" src/lib/risk/   # expect 1 hit (vocab.ts only)
```

## RISK-IDs covered

- **RISK-09** (vocab — consumed by explanation.ts in Plan 11)

## Dependencies

- Plan 02 (`messages.risk.*` block exists)
- Plan 04 (`Severity`/`RiskLevel` types from `./types`)

## Estimated commits

2.
