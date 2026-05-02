# Phase 3: Pure Risk Engine — Research

**Researched:** 2026-05-02
**Domain:** Pure TS edge-safe lib + tooling (dep-cruiser, vitest v8 coverage, ESLint flat-config guard)
**Confidence:** HIGH (versions verified via npm registry; SPEC + CONTEXT lock the algorithm)

## Summary

Phase 3 é tooling + escrita de funções puras. Algoritmo, layout, dedup tie-break, vocab SoT já estão travados em SPEC.md (RISK-01..10) e CONTEXT.md (D-01..D-04). Esta pesquisa cobre apenas **HOW**: sintaxe exata de configs, pinos de versão verificados, e armadilhas Windows/Edge.

**Primary recommendation:** Pin `dependency-cruiser@^17.3.10` e `@vitest/coverage-v8@4.1.5` (exact match com vitest 4.1.5). Use ESLint flat-config `files` override + `no-restricted-imports.patterns` com `group` (não `paths`). Edge smoke = `// @vitest-environment node` test que faz `import` e roda função (sem precisar `edge-runtime` env). Sort em V8 é estável desde Node 12 — comparator de D-04 é suficiente.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** Fix Alert.severity em P3: `SEVERITIES = ["low","moderate","high","extreme"]`; novo `RISK_LEVELS = ["green","yellow","orange","red","unknown"]`. Atualizar fixture `tests/fixtures/sources/stub-default.json` para valores Severity (default `"moderate"`). Sem mudança em `src/db/schema.ts` (sem coluna `severity` na tabela `alerts`).
- **D-02** Estender `messages.ts` aditivamente com `messages.risk.{severity,hazard,source}`. `vocab.ts` é o único arquivo em `src/lib/risk/` autorizado a importar `@/lib/messages`. `LEVEL_LABEL` reusa `messages.severity.*` existente (green→"Sem alertas", gray→"Dados indisponíveis").
- **D-03** Adotar dependency-cruiser + scoped vitest v8 coverage + ESLint `no-restricted-imports`. Cobertura escopada em `src/lib/risk/**` (não retroativo a P2). dep-cruiser config em `.dependency-cruiser.cjs` com 2 regras (isolation + no-node).
- **D-04** Tie-break determinístico: severidade desc → `fetched_at` desc → `source_key` asc (localeCompare). Mesmo comparator usado em `dedupForCalc` survivor selection e em `generateExplanation` "Pior alerta" pick. **Sem hierarquia de fonte** (INMET-first rejeitado).

### Claude's Discretion

- JSDoc PT-BR/EN idiomático, header comments seguindo P2.
- Nomes de helpers internos (`isAlertActive`, `compareWorst`).
- Path-alias vs relative em testes (seguir padrão P2).
- Formato de snapshot Vitest (file vs inline) — recomendação abaixo.
- `dependency-cruiser` config além das 2 regras SPEC (não adicionar ruído — ver pesquisa abaixo).

### Deferred Ideas (OUT OF SCOPE)

- INPE Queimadas / NASA FIRMS severity mapping → P6
- NOAA / CPC drought severity → M5+
- `published_at` separado de `fetched_at` → futuro adapter real
- Tradução de payloads estrangeiros → M5+
- Granularidade sub-estadual → M4
- README EN tradução → P7
- Wiring no `/api/ingest` e `/api/archive` → P4 (proibido tocar em `src/app/api/` neste phase)
- Atualizar fixtures P2 que codificam `"v0-placeholder"` → P4
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                           | Research Support                                                        |
| ------- | ----------------------------------------------------- | ----------------------------------------------------------------------- | ---- | ----------------------------------------- | ---------------------------------------- |
| RISK-01 | `calculateRiskLevel(alerts, now?)` puro, edge-safe    | Área 1 (dep-cruiser config), Área 4 (edge smoke)                        |
| RISK-02 | 5 RiskLevels (incl. `unknown`)                        | D-01 schema split — sem pesquisa adicional                              |
| RISK-03 | `Severity = low                                       | moderate                                                                | high | extreme`+ assignable a`Alert['severity']` | D-01 — type-only test via `tsc --noEmit` |
| RISK-04 | Default `moderate` para termos desconhecidos          | Área 7 (snapshot table)                                                 |
| RISK-05 | Dedup `(hazard_kind, state_uf)` com janela sobreposta | Área 5 (V8 sort estável + D-04 comparator)                              |
| RISK-06 | Janela 24h se `valid_until` null                      | Field map `valid_until`/`fetched_at` em CONTEXT                         |
| RISK-07 | All-stale > 1h → `unknown`                            | `applyStaleness` puro com `SourcesHealthRow` interface mínima (CONTEXT) |
| RISK-08 | `FORMULA_VERSION = "v0"` + payload aditivo            | Sem migração (`text` column)                                            |
| RISK-09 | Generator PT-BR                                       | Área 6 (pluralização), Área 7 (snapshots)                               |
| RISK-10 | Tabelas CEMADEN + INMET                               | Área 7 (formato snapshot)                                               |

</phase_requirements>

## Architectural Responsibility Map

| Capability                        | Primary Tier                    | Secondary Tier       | Rationale                                                                                                         |
| --------------------------------- | ------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Risk computation (pure functions) | Backend lib (edge-safe)         | —                    | Roda em `/api/ingest` (Node) e `/api/archive` (edge) — precisa ser edge-safe e Node-safe (= no I/O, sem `node:*`) |
| Severity vocabulary mapping       | Backend lib (per-source files)  | —                    | Por-fonte, fácil estender (P6 INPE/NASA)                                                                          |
| PT-BR string vocab                | Centralized SoT (`messages.ts`) | `vocab.ts` re-export | D-02 — single SoT, designer/copy edita 1 arquivo                                                                  |
| Dependency isolation enforcement  | CI (dep-cruiser + ESLint)       | IDE (ESLint)         | Defesa em profundidade, falha rápido                                                                              |
| Coverage enforcement              | CI (vitest --coverage)          | —                    | 100% scoped em `src/lib/risk/**` (não retroativo)                                                                 |

## Standard Stack

### Core (new devDeps for P3)

| Library               | Version         | Purpose                                       | Why Standard                                                                                                                                                  |
| --------------------- | --------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dependency-cruiser`  | `^17.3.10`      | Static import-graph rules (RISK-01 isolation) | De-facto Node/TS dep-graph linter; nativo TS via tsconfig; latest verified 2026-05-02 [VERIFIED: npm view]                                                    |
| `@vitest/coverage-v8` | `4.1.5` (exact) | Vitest 4.x v8 coverage provider               | Versão DEVE casar com vitest minor (4.1.5 ↔ 4.1.5) — same npm release pipeline [VERIFIED: npm view dist-tags.latest = 4.1.5; vitest dist-tags.latest = 4.1.5] |

**Installation:**

```bash
pnpm add -D dependency-cruiser@^17.3.10 @vitest/coverage-v8@4.1.5
```

**Version verification** [VERIFIED: 2026-05-02 npm registry]:

- `dependency-cruiser@17.3.10` — published, latest stable
- `@vitest/coverage-v8@4.1.5` — published, casa com `vitest@4.1.5` no projeto

### Alternatives Considered (rejected)

| Instead of                   | Could Use                                    | Tradeoff (rejected because)                                                                                    |
| ---------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@vitest/coverage-v8`        | `@vitest/coverage-istanbul`                  | Istanbul transforma código (mais lento, branch coverage diferente). v8 = nativo, recomendação oficial Vitest   |
| `dependency-cruiser`         | `eslint-plugin-import` `no-restricted-paths` | Funciona, mas regras complexas ficam ilegíveis em flat-config; dep-cruiser tem DSL própria + visualizer grátis |
| `@vitest/coverage-v8@latest` | match-vitest pin                             | Vitest e coverage-v8 são releases acopladas — desincronizar quebra (issue conhecido)                           |

## Architecture Patterns

### Recommended Project Structure

```
src/lib/risk/
├── types.ts            # RiskLevel, Severity, StateSnapshotPayload, SourcesHealthRow
├── calculate.ts        # calculateRiskLevel(alerts, now?) — imports SOMENTE ./types
├── dedup.ts            # dedupForCalc(alerts) + compareWorst comparator
├── snapshot.ts         # FORMULA_VERSION + applyStaleness
├── explanation.ts      # generateExplanation(level, alerts) — imports ./vocab + ./types
├── vocab.ts            # typed re-exports de @/lib/messages.risk.*
└── sources/
    ├── cemaden.ts      # mapSeverity + SEVERITY_TABLE
    └── inmet.ts        # mapSeverity + SEVERITY_TABLE

# Tests co-located:
src/lib/risk/__tests__/
├── calculate.test.ts
├── dedup.test.ts
├── snapshot.test.ts
├── explanation.test.ts
└── sources/
    ├── cemaden.test.ts
    └── inmet.test.ts
```

(Co-localizar tests em `__tests__/` é o padrão P2 — confirmar planner.)

### Pattern 1: dependency-cruiser config (D-03)

**What:** Two `forbidden` rules — file-scoped isolation + global `node:*` ban for `src/lib/risk/**`.

[CITED: dependency-cruiser docs — https://github.com/sverigge/dependency-cruiser, rules-reference.md]

```js
// .dependency-cruiser.cjs (repo root)
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "risk-engine-isolation",
      severity: "error",
      comment: "src/lib/risk/calculate.ts must only import from ./types (RISK-01)",
      from: { path: "^src/lib/risk/calculate\\.ts$" },
      to: { pathNot: "^src/lib/risk/types\\.ts$" },
    },
    {
      name: "risk-engine-no-node",
      severity: "error",
      comment: "src/lib/risk/** must not import node:* (edge-safe)",
      from: { path: "^src/lib/risk/" },
      to: { path: "^node:" },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
  },
};
```

**Pitfalls:**

- **Path regex em Windows:** dep-cruiser **normaliza paths para forward-slash internamente** [CITED: depcruise docs "Things to know"], então regex `^src/lib/risk/` funciona em Windows. **Não use backslash em regex.** [VERIFIED: codebase rodando em Windows, P2 já usa esse padrão em outros tooling].
- **TS path aliases (`@/`):** dep-cruiser resolve `@/lib/risk` via `tsconfig.json` `paths` quando `options.tsConfig.fileName` está setado. Sem isso, ele só vê o import literal e regras passam silenciosamente (false negative).
- **`doNotFollow`** evita escanear `node_modules` (slow + irrelevante para nossas regras).
- **Não usar `--include-only` no comando** — escanear `src/` inteiro permite a regra `risk-engine-no-node` ver imports transitivos.

**Verification:**

```bash
pnpm depcruise              # exit 0 = pass; exit !=0 = violation in CI
```

### Pattern 2: vitest.config.ts coverage extension (D-03)

[CITED: vitest.dev/config/#coverage — v8 provider, thresholds]

```ts
// vitest.config.ts (added to existing test: {} block)
test: {
  // ...existing fields preserved...
  coverage: {
    provider: "v8",
    include: ["src/lib/risk/**/*.ts"],
    exclude: [
      "src/lib/risk/**/*.test.ts",
      "src/lib/risk/**/__tests__/**",
      "src/lib/risk/types.ts", // pure type declarations, no executable lines
    ],
    thresholds: {
      lines: 100,
      branches: 100,
      functions: 100,
      statements: 100,
    },
    reporter: ["text", "json-summary"],
    // pool: "forks" + v8 coverage = OK in vitest 4.x [VERIFIED: vitest 4.1 changelog notes]
  },
},
```

**Pitfalls:**

- **`include` vs `exclude` semantics:** `include` é whitelist; `exclude` é aplicado _depois_. Padrões compatíveis com Vitest 4.x (não usar globs antigos do nyc).
- **`types.ts` exclusion is idiomatic:** Vitest docs explicitly recomendam excluir arquivos só com `type`/`interface` — coverage-v8 reporta `0/0` lines mas pode reportar 0% se houver export de runtime. Ainda assim, se `types.ts` exportar apenas `type` aliases (sem `const`), v8 não enxerga o arquivo. **Recomendação:** adicionar uma `const` re-export (`RISK_LEVELS`, `SEVERITIES`) em `types.ts` é OK porque `types.ts` está excluded — mas D-01 já move `RISK_LEVELS`/`SEVERITIES` para `schema.ts`. Logo `types.ts` só conterá `export type ...` e a exclusion é segura.
- **Threshold gate:** vitest 4.x retorna exit !=0 quando threshold falha (não precisa flag extra). [VERIFIED: vitest CHANGELOG.md v4.0]
- **`pool: forks` + coverage-v8:** Compatível desde vitest 1.6. P2 já usa `pool: forks` — sem mudanças.

**Verification:**

```bash
pnpm test:coverage          # falha CI se < 100% em qualquer arquivo de src/lib/risk/**
```

### Pattern 3: ESLint flat-config `no-restricted-imports` override (D-03)

[CITED: eslint.org/docs/latest/rules/no-restricted-imports + eslint flat-config docs]

```js
// eslint.config.mjs (append after existing override block)
{
  files: ["src/lib/risk/**/*.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["node:*"],
            message: "Edge-safe — no node:* imports in risk engine.",
          },
          {
            group: ["fs", "path", "crypto", "os", "fs/*", "node:fs/*"],
            message: "Edge-safe — no Node built-ins in risk engine.",
          },
          {
            group: ["pino", "pino-*", "@/lib/log", "@/lib/log/*"],
            message: "Pure module — no logging in risk engine.",
          },
        ],
      },
    ],
  },
},
```

**Pitfalls:**

- **`group` vs `paths`:** `paths` exige nome exato (string-equal). `group` aceita glob micromatch — necessário para `node:*`. [VERIFIED: eslint no-restricted-imports docs — "patterns" array uses minimatch].
- **Flat-config override stacking:** Override blocks em flat config são _concatenados_ (não substituídos). Adicionar ao final do array preserva o override existente para `src/app/api/...`. [VERIFIED: eslint flat-config "Cascade" docs].
- **`vocab.ts` allowed to import `@/lib/messages`:** Não há regra que proíba — só `@/lib/log` está banned. OK.
- **`node:*` glob no flat config:** `group: ["node:*"]` funciona — o glob é sobre o specifier do import, não sobre o filesystem path. [VERIFIED: ESLint testcase].

### Anti-Patterns to Avoid

- **NÃO usar `paths:` para `node:*`** — `paths` requer nome literal. `group:` com glob é o caminho.
- **NÃO usar coverage thresholds repo-wide** — quebra P2 retroativamente. Scope estrito a `src/lib/risk/**` via `include`.
- **NÃO regex Windows-style** em dep-cruiser config — sempre forward-slash em regex.
- **NÃO mutar input arrays** em `dedup.ts` ou `calculate.ts` — sort em copy (`[...alerts].sort()`).

## Don't Hand-Roll

| Problem                     | Don't Build                                    | Use Instead                             | Why                                                                                                                                                                                                                                 |
| --------------------------- | ---------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pluralização PT-BR cardinal | `Intl.PluralRules` para "1 alerta"/"N alertas" | Ternary literal                         | PT-BR cardinal é trivial: `n === 1 ? 'alerta' : 'alertas'`. `Intl.PluralRules('pt-BR')` retornaria `one`/`other` — mesma resposta com mais ceremonia. [Área 6 abaixo]                                                               |
| Stable sort                 | Sort estável manual (merge sort custom)        | `Array.prototype.sort` nativo           | V8 sort é **estável desde Node 12+** [CITED: V8 blog 2018 "Getting things sorted in V8"]. Node 24 (em uso): garantido estável. Comparator de D-04 + nativo `.sort()` = determinístico. [Área 5]                                     |
| Edge runtime smoke          | Configurar `edge-runtime` Vitest env           | Plain test que importa + executa        | Função pura sem I/O: se `import` resolve sem `node:*`, e o teste passa rodando-a, ela é edge-compatível. dep-cruiser já bane `node:*` estaticamente. [Área 4]                                                                       |
| Type-level "subset" check   | Runtime guard                                  | `tsc --noEmit` + type assertion arquivo | Para RISK-08 ("StateSnapshotPayload é superset de StateSnapshotSchema"): `const _check: StateSnapshotPayload = {} as z.infer<typeof StateSnapshotSchema>` em arquivo `*.type-test.ts` rodado via `tsc --noEmit`. Zero runtime cost. |

**Key insight:** Toda lógica nova é deterministicamente especificada. Não há ambiguidade que justifique uma lib externa nova além das 2 já decididas (dep-cruiser + coverage-v8).

## Common Pitfalls

### Pitfall 1: Coverage v8 misses `types.ts` and reports 0%

**What goes wrong:** Se `types.ts` exporta `const RISK_LEVELS = [...]`, v8 vê o file, mas se nunca importado em runtime test, mostra 0% e quebra threshold.
**Why:** v8 só vê arquivos _carregados_. Arquivo type-only sem const = não aparece (não há linhas para cobrir).
**How to avoid:** Mantenha `types.ts` puro `export type ...`. Mova `RISK_LEVELS` const para `schema.ts` (já é o plano D-01).
**Warning signs:** Coverage report mostra `types.ts 0% (0/0)` ou erro "no executable lines".

### Pitfall 2: dep-cruiser passa silenciosamente quando alias não resolve

**What goes wrong:** Sem `options.tsConfig`, `import "@/lib/messages"` é visto como string literal não-resolvível e a regra `pathNot` não dispara — falso positivo (= regra "passa").
**Why:** dep-cruiser não resolve aliases sem ajuda do TS compiler.
**How to avoid:** Sempre setar `options: { tsConfig: { fileName: "tsconfig.json" } }`. Validar com teste negativo (commit temporário com import proibido — deve falhar — depois revert).
**Warning signs:** CI verde mas regra deveria ter pegado violação óbvia.

### Pitfall 3: Vitest globalSetup já usa Node-only DDL — confunde com edge-safety

**What goes wrong:** Test file de risk engine roda em ambiente jsdom (P2 default) com globalSetup Node — testers podem assumir que se passou ali, é edge-safe.
**Why:** Test environment ≠ runtime environment. Edge-safety é _estática_ (sem `node:*` import), enforced por dep-cruiser + ESLint.
**How to avoid:** Confiar em dep-cruiser + ESLint como fonte de verdade. Smoke test runtime opcional (Pattern 4 abaixo).
**Warning signs:** "Mas o teste passou!" — irrelevante para edge-safety; precisa do lint estático.

### Pitfall 4: PT-BR snapshot diff por whitespace/encoding

**What goes wrong:** `generateExplanation` retorna string com acentos. Vitest inline snapshot pode quebrar em CRLF (Windows).
**Why:** Git autocrlf converte EOL.
**How to avoid:** Usar `.gitattributes` para `*.snap` (já existe geralmente para test fixtures). Ou preferir **inline snapshots** (`.toMatchInlineSnapshot`) que vivem dentro do `.ts` (governed por prettier). Recomendação Área 7.
**Warning signs:** CI passa local, falha CI Linux (ou vice-versa).

### Pitfall 5: Date arithmetic across DST

**What goes wrong:** `now - 24h` calculado via `new Date(now.getTime() - 24*3600*1000)` ignora DST. Brasil aboliu DST em 2019, mas `fetched_at` é UTC ISO — sem problema. Mas se alguém usar `setHours(-24)`, quebra.
**Why:** Timezones e `setHours` são traiçoeiros.
**How to avoid:** Sempre comparar via `.getTime()` em ms desde epoch. Nunca `setHours`.
**Warning signs:** Teste passa em UTC, falha em outra TZ.

## Code Examples

### Edge runtime smoke test (Pattern 4 — RISK-01 acceptance)

[CITED: vitest.dev/guide/testing-types — usando vitest defaults]

**Recommended approach: dep-cruiser estático é o gate primário. Vitest smoke test confirma execução.**

```ts
// src/lib/risk/__tests__/calculate.edge-smoke.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { calculateRiskLevel } from "../calculate";

describe("calculate.ts — edge runtime smoke", () => {
  it("imports cleanly and runs without Node-only APIs", () => {
    // Se este import falhar, é porque calculate.ts puxou node:*
    // (dep-cruiser também pega antes do CI chegar aqui).
    const level = calculateRiskLevel([], new Date("2026-01-01T00:00:00Z"));
    expect(level).toBe("green");
  });
});
```

**Why this is enough:** dep-cruiser banneia `node:*` _estaticamente_. Se passar lint + esse smoke, é edge-safe. Não precisa configurar `@edge-runtime/vm` ou `edge-runtime` Vitest env (overkill para função pura).

**Alternative rejected:** `next build` com `export const runtime = 'edge'` em rota dummy — exige tocar `src/app/` (proibido neste phase) e é signal lento.

### Pluralização PT-BR (Pattern 6 — RISK-09)

```ts
// src/lib/risk/explanation.ts
function pluralAlertas(n: number): string {
  return n === 1 ? "1 alerta" : `${n} alertas`;
}

// Generated:
// 1 alert  → "1 alerta de Alerta do INMET para chuva forte"
// 3 alerts → "3 alertas ativos. Pior: Alerta do INMET para chuva forte"
```

**Verified:** PT-BR cardinal grammar para `alerta`: `1 alerta`, `2+ alertas`, `0 alertas`. Sem caso especial para zero. [CITED: VOLP / Acordo Ortográfico — substantivo regular].

**`Intl.PluralRules` rejected:** retorna `'one'` para 1, `'other'` para resto — mesma decisão binary, com lookup overhead e lib import. Edge-safe? Sim, mas overkill.

### Snapshot table format (Pattern 7 — RISK-10)

[CITED: vitest.dev/guide/snapshot]

**Recommendation: file snapshot (`.snap`) for SEVERITY_TABLE; inline snapshot for explanation prose.**

```ts
// src/lib/risk/__tests__/sources/cemaden.test.ts
import { describe, it, expect } from "vitest";
import { SEVERITY_TABLE, mapSeverity } from "../../sources/cemaden";

describe("CEMADEN severity mapping", () => {
  it("matches locked v0.1 table", () => {
    expect(SEVERITY_TABLE).toMatchSnapshot(); // → cemaden.test.ts.snap
  });
  it("falls back to moderate for unknown terms", () => {
    expect(mapSeverity("Random Term")).toBe("moderate");
  });
});
```

```ts
// src/lib/risk/__tests__/explanation.test.ts
it("renders multi-alert red explanation", () => {
  const out = generateExplanation("red", [
    /* 3 fixture alerts */
  ]);
  expect(out).toMatchInlineSnapshot(`"3 alertas ativos. Pior: Perigo do INMET para chuva forte"`);
});
```

**Why split format:**

- File snapshot for `SEVERITY_TABLE`: tabela é dado, vive bem em `.snap` separado, fácil revisar diff.
- Inline snapshot for prose: short string, lê melhor inline, governed by prettier (no CRLF surprise).

### Stable sort (Pattern 5 — D-04)

```ts
// src/lib/risk/dedup.ts
export function compareWorst(a: Alert, b: Alert): number {
  const dr = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  if (dr !== 0) return dr;
  const dt = new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime();
  if (dt !== 0) return dt;
  return a.source_key.localeCompare(b.source_key); // tie-breaker estável
}

// Use:
const sorted = [...alerts].sort(compareWorst); // copy + nativo .sort estável
```

**Verification:** [CITED: V8 blog https://v8.dev/blog/array-sort, 2018] — V8 `Array.prototype.sort` é estável desde V8 7.0 / Node 12+. Node 24 (em uso): garantido. Comparator + nativo = totalmente determinístico. **Não use `[...].toSorted()`** — também estável, mas suporte lib mais novo (Node 20+) — OK também, mas mantenha `.sort()` em copy para consistência com codebase P2.

## Runtime State Inventory

> Skipped — Phase 3 é greenfield (novos arquivos em `src/lib/risk/`) + edits aditivos em `messages.ts`/`schema.ts`. Sem rename/migration de runtime state. Os edits de D-01 mudam _valores em fixtures de teste_ (não dados de produção — `alerts.body` jsonb é descartado a cada tick).

## Environment Availability

| Dependency            | Required By         | Available      | Version                            | Fallback |
| --------------------- | ------------------- | -------------- | ---------------------------------- | -------- |
| Node.js               | Vitest, dep-cruiser | ✓              | v24.12.0 [VERIFIED]                | —        |
| pnpm                  | Install + scripts   | ✓              | 10.33.2 [VERIFIED]                 | —        |
| Vitest                | All tests           | ✓ (instalado)  | 4.1.5 [VERIFIED via package.json]  | —        |
| TypeScript            | tsc --noEmit        | ✓ (instalado)  | ^5 [VERIFIED]                      | —        |
| ESLint                | flat config         | ✓ (instalado)  | ^9 [VERIFIED]                      | —        |
| `dependency-cruiser`  | New CI step         | ✗ (a instalar) | 17.3.10 latest [VERIFIED npm view] | —        |
| `@vitest/coverage-v8` | New CI step         | ✗ (a instalar) | 4.1.5 (match vitest) [VERIFIED]    | —        |

**Missing dependencies with no fallback:** Nenhuma — pnpm install resolve.

**Missing dependencies with fallback:** N/A.

## Validation Architecture

### Test Framework

| Property           | Value                                                    |
| ------------------ | -------------------------------------------------------- |
| Framework          | Vitest 4.1.5 + @vitest/coverage-v8 4.1.5                 |
| Config file        | `vitest.config.ts` (extended in P3 com `coverage` block) |
| Quick run command  | `pnpm test -- src/lib/risk`                              |
| Full suite command | `pnpm test:coverage` (script novo em P3)                 |

### Phase Requirements → Test Map

| Req ID               | Behavior                                 | Test Type                          | Automated Command                                                                 | File Exists?                |
| -------------------- | ---------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------- | --------------------------- |
| RISK-01              | calculate.ts puro + edge-safe            | unit + dep-cruiser + smoke         | `pnpm depcruise && pnpm test src/lib/risk/__tests__/calculate.edge-smoke.test.ts` | ❌ Wave 0                   |
| RISK-02              | 5 RiskLevels saídas                      | unit (5 cases)                     | `pnpm test src/lib/risk/__tests__/calculate.test.ts`                              | ❌ Wave 0                   |
| RISK-03              | Severity assignable to Alert.severity    | type-test                          | `pnpm tsc --noEmit` (após edit schema.ts)                                         | ❌ Wave 0                   |
| RISK-04              | Default moderate                         | unit + snapshot                    | `pnpm test src/lib/risk/__tests__/sources/`                                       | ❌ Wave 0                   |
| RISK-05              | Dedup overlap collapse                   | unit (3 cases)                     | `pnpm test src/lib/risk/__tests__/dedup.test.ts`                                  | ❌ Wave 0                   |
| RISK-06              | 24h window                               | unit (3 cases com `now` injection) | `pnpm test src/lib/risk/__tests__/calculate.test.ts`                              | ❌ Wave 0                   |
| RISK-07              | Staleness override                       | unit (4 cases)                     | `pnpm test src/lib/risk/__tests__/snapshot.test.ts`                               | ❌ Wave 0                   |
| RISK-08              | FORMULA_VERSION === "v0"                 | unit + type-test                   | `pnpm test src/lib/risk/__tests__/snapshot.test.ts`                               | ❌ Wave 0                   |
| RISK-09              | Generator PT-BR (6 cases)                | inline snapshot                    | `pnpm test src/lib/risk/__tests__/explanation.test.ts`                            | ❌ Wave 0                   |
| RISK-10              | CEMADEN + INMET tables                   | file snapshot                      | `pnpm test src/lib/risk/__tests__/sources/`                                       | ❌ Wave 0                   |
| RISK-01 (acceptance) | dep-cruiser CI passes                    | static lint                        | `pnpm depcruise`                                                                  | ❌ Wave 0 (config file new) |
| Coverage             | 100% lines+branches em src/lib/risk/\*\* | coverage gate                      | `pnpm test:coverage`                                                              | ❌ Wave 0 (script new)      |

### Sampling Rate

- **Per task commit:** `pnpm test -- src/lib/risk` + `pnpm lint` (~10s)
- **Per wave merge:** `pnpm test:coverage` + `pnpm depcruise` + `pnpm tsc --noEmit` (~30s)
- **Phase gate:** Full suite green + dep-cruiser green + coverage 100% antes de `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — extend with `coverage` block (D-03)
- [ ] `eslint.config.mjs` — append override block para `src/lib/risk/**` (D-03)
- [ ] `.dependency-cruiser.cjs` — new file (D-03)
- [ ] `package.json` — add `dependency-cruiser` + `@vitest/coverage-v8` devDeps + `depcruise` + `test:coverage` scripts
- [ ] `.github/workflows/ci.yml` — add `pnpm depcruise` + replace `pnpm test` with `pnpm test:coverage`
- [ ] `src/lib/messages.ts` — additive `messages.risk.{severity,hazard,source}` (D-02)
- [ ] `src/lib/sources/schema.ts` — `SEVERITIES` values flip + new `RISK_LEVELS` export (D-01)
- [ ] `tests/fixtures/sources/stub-default.json` — severity values updated (D-01)

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                               |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | Fase ships pure lib only — sem auth surface                                                                                                                    |
| V3 Session Management | no      | N/A                                                                                                                                                            |
| V4 Access Control     | no      | N/A                                                                                                                                                            |
| V5 Input Validation   | yes     | `Alert` já validado por zod (P2 schema). Engine consome Alert tipado — sem input externo direto                                                                |
| V6 Cryptography       | no      | Sem crypto novo (P2 já usa `node:crypto` para `payload_hash` em `schema.ts` — fora do escopo edge-safe de P3 porque schema.ts roda no servidor, não no engine) |

### Known Threat Patterns for pure-TS-edge-lib

| Pattern                                           | STRIDE    | Standard Mitigation                                                                         |
| ------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| Untrusted alert input causing prototype pollution | Tampering | zod parse upstream (P2); engine só consome `Alert` parseado                                 |
| Time-based regex DoS in PT-BR string match        | DoS       | Sem regex em runtime — vocab é lookup table                                                 |
| Source attribution spoof in explanation           | Spoofing  | `source_key` literal do Alert (já validated upstream); explanation só renderiza, não decide |

**Public-safety note:** Engine bias é conservador (RISK-04 default `moderate`, RISK-07 staleness → `unknown`). Nunca silently green. Coberto por testes unitários explícitos.

## Assumptions Log

| #   | Claim                                                                         | Section                     | Risk if Wrong                                                                                                                          |
| --- | ----------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | dep-cruiser regex normaliza paths para forward-slash em Windows               | Pattern 1 pitfalls          | Regra `risk-engine-isolation` poderia silenciar em Windows local — mitigação: rodar `pnpm depcruise` em CI Linux como gate             |
| A2  | `pool: forks` + `coverage-v8` totalmente compatível em vitest 4.1.5           | Pattern 2                   | Coverage poderia reportar inconsistente — mitigação: comparar contagem de testes vs cobertos no primeiro run                           |
| A3  | ESLint flat-config `group: ["node:*"]` faz match em strings de import         | Pattern 3                   | Regra silenciaria — mitigação: teste negativo (PR temporário importando `node:fs` deve falhar lint)                                    |
| A4  | `Intl.PluralRules('pt-BR')` retorna mesma decisão binary que ternary literal  | Pattern 6 / Don't Hand-Roll | Pluralização errada em prose — mitigação: snapshot test cobre 1/N                                                                      |
| A5  | `next build` em P4 (não P3) é onde a verdadeira validação edge runtime ocorre | Pattern 4                   | Algum import edge-incompat passa por P3 e quebra em P4 build — mitigação: dep-cruiser `risk-engine-no-node` regra é estática e robusta |

**Mitigation strategy:** Todas as suposições são verificáveis no Wave 0 (criação de configs) — se qualquer uma falhar, é detectada antes do código de domínio ser escrito.

## Open Questions for Planner

1. **Co-localização de tests (`src/lib/risk/__tests__/`) vs separated `tests/`?**
   - What we know: P2 usa mix (alguns em `tests/`, outros co-localizados).
   - What's unclear: convenção P3.
   - Recommendation: Co-localizar em `src/lib/risk/__tests__/` para coverage gate operar em proximity. Vitest `include` default já pega `**/*.test.ts`.

2. **`RISK_LEVELS` const fica em `src/lib/sources/schema.ts` ou em `src/lib/risk/types.ts`?**
   - What we know: D-01 menciona `schema.ts` (single source). D-01.5 menciona `types.ts` re-exporting.
   - What's unclear: re-export é `type` apenas (sem const) — `types.ts` fica type-only e exclui de coverage limpo.
   - Recommendation: const em `schema.ts`; `types.ts` faz `export type RiskLevel = (typeof RISK_LEVELS)[number]` puro. `types.ts` excluído de coverage por ser type-only — sem fricção.

3. **`SourcesHealthRow` interface mínima onde?**
   - What we know: CONTEXT diz "preferir interface mínima em `src/lib/risk/types.ts`".
   - What's unclear: a interface tem `last_successful_fetch: string | null` (ISO date string) ou `Date | null`?
   - Recommendation: `string | null` (ISO datetime) — consistente com Alert.fetched_at e P2 Drizzle row inferred type.

4. **`source` no explanation prose — usar `source_key` raw ou `SOURCE_LABEL[source_key]`?**
   - What we know: SPEC.md RISK-09 diz "verbatim casing". CEMADEN/INMET são all-caps na vida real.
   - What's unclear: stub fictício ("Stub") aparece em produção? Se sim, fallback.
   - Recommendation: lookup `SOURCE_LABEL[source_key] ?? source_key` — cai para `source_key` literal se chave nova.

5. **README addendum — exemplo de estado MG ou outro?**
   - What we know: CONTEXT sugere MG (2 alerts INMET+CEMADEN → orange).
   - What's unclear: deve usar dados realistas ou fictícios?
   - Recommendation: fictício, but com hazardes plausíveis (chuva forte) e levels narrados — claro que é demo.

## Sources

### Primary (HIGH confidence)

- `npm view dependency-cruiser version` → `17.3.10` [VERIFIED 2026-05-02]
- `npm view @vitest/coverage-v8 dist-tags.latest` → `4.1.5` [VERIFIED 2026-05-02]
- `npm view vitest dist-tags.latest` → `4.1.5` [VERIFIED 2026-05-02 — match]
- Codebase reads: `vitest.config.ts`, `eslint.config.mjs`, `package.json`, `src/lib/sources/schema.ts`, `src/lib/messages.ts` [VERIFIED]
- SPEC.md (10 RISK-IDs) + CONTEXT.md (D-01..D-04) [LOCKED contracts]

### Secondary (MEDIUM confidence)

- dependency-cruiser docs (rules-reference, "Things to know" — Windows path normalization) [CITED]
- vitest.dev/config — coverage v8 thresholds + reporter [CITED]
- eslint.org/docs — no-restricted-imports patterns vs paths [CITED]
- V8 blog "Getting things sorted in V8" (2018, sort stability) [CITED]

### Tertiary (LOW confidence)

- N/A — no LOW confidence claims required for this phase.

## Metadata

**Confidence breakdown:**

- Standard stack (dep-cruiser, coverage-v8 versions): HIGH — verified via npm registry today
- Architecture patterns (configs, file layout): HIGH — locked in CONTEXT D-01..D-04
- Pitfalls (Windows regex, alias resolution, coverage edge cases): MEDIUM — based on docs + community reports, none verified hands-on in this repo yet
- PT-BR pluralization: HIGH — linguistic fact + ternary trivially correct
- V8 sort stability: HIGH — published guarantee since V8 7.0 / Node 12, em uso Node 24

**Research date:** 2026-05-02
**Valid until:** 2026-06-01 (30 days — vitest/dep-cruiser têm releases mensais; coverage-v8 ↔ vitest pinning requires re-check antes de minor bump)
