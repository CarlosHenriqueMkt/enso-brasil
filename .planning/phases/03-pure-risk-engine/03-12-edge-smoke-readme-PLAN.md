---
phase: 03-pure-risk-engine
plan: 12
type: execute
wave: 5
depends_on: [09, 11]
files_modified:
  - src/lib/risk/calculate.edge-smoke.test.ts
  - README.md
autonomous: true
requirements: [RISK-01]
must_haves:
  truths:
    - "src/lib/risk/calculate.edge-smoke.test.ts uses @vitest-environment node and imports calculateRiskLevel"
    - "Smoke test runs the function with empty input and asserts 'green' return"
    - "README.md has a new PT-BR section '## Como calculamos o risco — v0' with the locked MG worked example using HAZARD_KINDS-canonical 'enchente'"
    - "README example sentence is verbatim: '2 alertas ativos. Pior: Alerta do INMET + CEMADEN para enchente' (matches Plan 11 case 5 locked snapshot)"
    - "README addendum cross-links to risk-formula-v0.md"
  artifacts:
    - path: "src/lib/risk/calculate.edge-smoke.test.ts"
      provides: "Edge-runtime import smoke + execution"
    - path: "README.md"
      provides: "PT-BR addendum 'Como calculamos o risco — v0' with worked MG example using 'enchente'"
      contains: "Como calculamos o risco"
  key_links:
    - from: "README.md"
      to: "risk-formula-v0.md"
      via: "markdown link"
      pattern: "risk-formula-v0\\.md"
---

# Plan 12 — Edge smoke test + README PT-BR addendum (RISK-01 acceptance + AC-13)

**Goal:** Two tasks closing two SPEC acceptance criteria. Edge smoke proves `calculate.ts` import is clean; README addendum documents the v0 formula in PT-BR for users.

## Required reading

- `.planning/phases/03-pure-risk-engine/03-SPEC.md` (acceptance #10 — edge smoke; #12 — README addendum)
- `.planning/phases/03-pure-risk-engine/03-CONTEXT.md` (Implementation Notes — README MG example)
- `.planning/phases/03-pure-risk-engine/03-RESEARCH.md` (Pattern 4 — plain `// @vitest-environment node` smoke)
- `.planning/phases/03-pure-risk-engine/03-PATTERNS.md` (lines 199-201 — README heading style)
- `README.md` (current PT-BR addendum target — heading style at lines 19, 25, 35, 41)
- `risk-formula-v0.md` (cross-link target)
- `src/lib/risk/calculate.ts` (post Plan 09)
- `.planning/phases/03-pure-risk-engine/03-11-explanation-PLAN.md` (case 5 locked snapshot — README must match)

## Files touched

| Path                                        | Change                  |
| ------------------------------------------- | ----------------------- |
| `src/lib/risk/calculate.edge-smoke.test.ts` | create                  |
| `README.md`                                 | modify (append section) |

## Tasks

### Task 12.1 — Create `src/lib/risk/calculate.edge-smoke.test.ts`

Files: `src/lib/risk/calculate.edge-smoke.test.ts`

Action: per RESEARCH Pattern 4 verbatim:

```ts
// @vitest-environment node
/**
 * Edge runtime smoke test (RISK-01 acceptance).
 *
 * Imports calculate.ts in a Node-only Vitest env. If calculate.ts pulled in
 * any node:* module (banned by depcruise + ESLint), this would still pass —
 * BUT depcruise catches that statically. This smoke confirms the function
 * actually executes without throwing on a basic invocation.
 *
 * Real edge-runtime validation happens in P4 when the wired route is `next build`-ed.
 */

import { describe, it, expect } from "vitest";
import { calculateRiskLevel } from "./calculate";

describe("calculate.ts — edge runtime smoke (RISK-01)", () => {
  it("imports cleanly and runs with empty input", () => {
    const level = calculateRiskLevel([], new Date("2026-01-01T00:00:00Z"));
    expect(level).toBe("green");
  });

  it("returns one of the 5 RiskLevels for any valid input", () => {
    const level = calculateRiskLevel([], new Date());
    expect(["green", "yellow", "orange", "red", "unknown"]).toContain(level);
  });
});
```

Verify: `pnpm test src/lib/risk/calculate.edge-smoke.test.ts`

Done: smoke test passes; coverage of `calculate.ts` already at 100% from Plan 09 — this test contributes redundantly.

### Task 12.2 — Append PT-BR README addendum (LOCKED to HAZARD_KINDS-canonical 'enchente')

Files: `README.md`

Action: per CONTEXT Implementation Notes + PATTERNS line 199-201. The example is **LOCKED** to use `enchente` (a HAZARD_KINDS-canonical value), not `chuva forte`. The sentence must match Plan 11 case 5's locked snapshot verbatim.

1. Decide placement:
   - Option A: Insert between "Como funciona" and "Fontes oficiais" sections (PATTERNS recommendation).
   - Option B: Append at the end of the file.
   - **Pick Option A** — keeps the explanation near the top where users naturally read.

2. Insert a new `##` heading + body. Verbatim PT-BR copy:

```markdown
## Como calculamos o risco — v0

O risco de cada estado é calculado a partir dos alertas oficiais ativos
recebidos das fontes integradas. A versão atual da fórmula é **v0** — o
contrato completo está em [`risk-formula-v0.md`](./risk-formula-v0.md).

**Em resumo, para cada estado:**

1. **Coletamos** os alertas das fontes oficiais (CEMADEN, INMET) a cada 15 minutos.
2. **Filtramos** os que ainda estão ativos (validade explícita, ou janela de 24 h
   se a fonte não informou prazo).
3. **Mapeamos** a severidade declarada por cada fonte para uma escala interna
   (`low | moderate | high | extreme`). Termos desconhecidos viram `moderate`
   por precaução — nunca silenciamos um alerta como baixo.
4. **Combinamos** alertas duplicados do mesmo tipo de evento no mesmo estado
   quando os períodos de validade se sobrepõem. O alerta mais severo "vence",
   mas todos os emissores ficam registrados.
5. **Classificamos** o estado em uma das 5 faixas:
   `Sem alertas` | `Atenção` | `Alerta` | `Perigo` | `Dados indisponíveis`.
6. **Override de defasagem:** se todas as fontes integradas estão com mais
   de 1 hora sem atualização, o estado vai para `Dados indisponíveis` —
   nunca afirmamos `Sem alertas` quando não temos certeza.

### Exemplo (Minas Gerais)

Suponha que recebemos dois alertas para MG no mesmo intervalo, ambos
classificados como `moderate` na escala interna, ambos para o mesmo tipo
de evento (`enchente`):

- **INMET** — Aviso de Perigo (enchente) → severidade interna `moderate`
- **CEMADEN** — Alerta (enchente) → severidade interna `moderate`

Como o tipo de evento e o estado coincidem e os períodos se sobrepõem,
o motor combina os dois em um único alerta efetivo, mantendo ambas as
fontes na atribuição. Com severidade combinada `moderate`, o estado é
classificado como **Alerta** (laranja).

A explicação gerada automaticamente em PT-BR seria:

> "2 alertas ativos. Pior: Alerta do INMET + CEMADEN para enchente"

Esta frase única é o que aparece no card do estado, no `/texto`
(rota acessível) e em qualquer notificação futura — uma só fonte,
sem divergência entre superfícies.

### Limitações conhecidas (v0)

- Apenas duas fontes integradas neste milestone (CEMADEN, INMET).
  INPE Queimadas e NASA FIRMS chegam em fases futuras.
- Granularidade estadual; não calculamos risco por município ainda.
- O motor não faz previsão — apenas espelha alertas oficiais ativos.
- Versionamos a fórmula (`v0`, futuras `v1`, `v2`...) para que mudanças
  de algoritmo fiquem rastreáveis no banco e na UI.
```

3. **Verify the example sentence matches Plan 11 case 5 verbatim:**
   - Expected: `"2 alertas ativos. Pior: Alerta do INMET + CEMADEN para enchente"`
   - This string is locked across two surfaces (Plan 11 inline snapshot + README) and must remain bit-identical.
   - `enchente` is in `HAZARD_KINDS` (per `src/lib/sources/schema.ts:9-16`); `chuva forte` is NOT — DO NOT use `chuva forte`.
4. Verify the cross-link to `risk-formula-v0.md` resolves (file exists at repo root).

Verify: `grep -c "Como calculamos o risco" README.md` (expect 1) + `grep -c "risk-formula-v0.md" README.md` (expect ≥ 1) + `grep -c "Pior: Alerta do INMET + CEMADEN para enchente" README.md` (expect 1)

Done:

- Section header `## Como calculamos o risco — v0` exists in README.md
- Worked example uses `enchente` (HAZARD_KINDS canonical) — `chuva forte` is NOT used anywhere in the addendum
- Worked example sentence is bit-identical to Plan 11 case 5 locked snapshot
- Cross-link to `risk-formula-v0.md` present
- No existing README content removed (only insertion)

## Verification (plan-wide)

```bash
pnpm test src/lib/risk/calculate.edge-smoke.test.ts
grep -n "Como calculamos o risco" README.md
grep -n "risk-formula-v0.md" README.md
grep -n "Pior: Alerta do INMET + CEMADEN para enchente" README.md
grep -c "chuva forte" README.md   # expect 0 in the new addendum
```

## RISK-IDs covered

- RISK-01 (smoke acceptance)
- (README addendum — SPEC AC-13)

## Dependencies

- Plan 09 (`calculate.ts` exists)
- Plan 11 (explanation case 5 locked snapshot — README sentence must match bit-identically)

## Estimated commits

2.
