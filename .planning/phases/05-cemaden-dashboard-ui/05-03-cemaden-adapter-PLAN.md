---
phase: 05-cemaden-dashboard-ui
plan: 03
type: execute
wave: 1
depends_on: ["05-02"]
files_modified:
  - src/lib/sources/cemaden.schema.ts
  - src/lib/sources/cemaden.ts
  - src/lib/risk/sources/cemaden.ts
  - tests/sources/cemaden.test.ts
  - tests/sources/cemaden.contract.test.ts
  - tests/fixtures/sources/cemaden-2026-05-18.json
  - scripts/refresh-cemaden.ts
  - package.json
autonomous: true
requirements: [ADAPT-01]
must_haves:
  truths:
    - "CEMADEN adapter parses `/wsAlertas2` payload and emits `Alert[]` with UTC ISO-Z timestamps"
    - "Severity Moderado/Alto/Muito Alto maps to moderate/high/extreme; unknown defaults to moderate"
    - "Hazard taxonomy maps `Risco Hidrológico` → enchente; `Movimento de Massa` → deslizamento"
    - "Single national GET — no per-UF iteration"
    - "All errors flow through sourceError() factory; never throw class Error"
    - "Contract test fails on schema drift"
  artifacts:
    - path: "src/lib/sources/cemaden.ts"
      provides: "createCemadenAdapter + default cemadenAdapter"
      exports:
        ["createCemadenAdapter", "cemadenAdapter", "CemadenHttpClient", "CEMADEN_WS_ALERTAS_URL"]
    - path: "src/lib/sources/cemaden.schema.ts"
      provides: "WsAlertas2Schema (zod)"
    - path: "src/lib/risk/sources/cemaden.ts"
      provides: "CEMADEN severity mapping"
      exports: ["mapSeverity", "SEVERITY_TABLE"]
    - path: "tests/fixtures/sources/cemaden-2026-05-18.json"
      provides: "Golden fixture from capture"
    - path: "scripts/refresh-cemaden.ts"
      provides: "Fixture refresh CLI"
  key_links:
    - from: "src/lib/sources/cemaden.ts"
      to: "src/lib/sources/errors.ts"
      via: "sourceError(code, message, cause) factory"
      pattern: "sourceError\\("
    - from: "src/lib/sources/cemaden.ts"
      to: "src/lib/sources/schema.ts"
      via: "Alert / HAZARD_KINDS / UF27_PROVISIONAL imports"
      pattern: 'from "./schema"'
---

<objective>
Build the CEMADEN adapter cluster mirroring INMET. Independent of UI work — runs parallel with plans 04 + 05 in Wave 1.

Purpose: registers a second authoritative source so DoD#2 (≥2 sources) lands. The endpoint (`https://painelalertas.cemaden.gov.br/wsAlertas2`) is verified, auth-free server-side, single national call (D-03 confirmed).

Output: adapter + schema + severity map + unit tests + contract test + fixture + refresh script.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-cemaden-dashboard-ui/05-cemaden-endpoint-capture.md
@.planning/phases/05-cemaden-dashboard-ui/05-02-CONTEXT-corrections.md
@.planning/phases/05-cemaden-dashboard-ui/05-PATTERNS.md
@.planning/phases/05-cemaden-dashboard-ui/05-RESEARCH.md
@src/lib/sources/inmet.ts
@src/lib/sources/inmet.schema.ts
@src/lib/sources/errors.ts
@src/lib/sources/schema.ts
@src/lib/sources/hash.ts
@src/lib/risk/sources/inmet.ts
@tests/sources/inmet.test.ts
@tests/sources/inmet.contract.test.ts
@scripts/refresh-inmet.ts
@scripts/lib/fixture-runner.ts

<interfaces>
From src/lib/sources/inmet.ts:
- `export interface InmetHttpClient { getJson(url): Promise<unknown>; getText(url): Promise<string> }`
- `export function createInmetAdapter(http: InmetHttpClient = PROD_HTTP_CLIENT): SourceAdapter`
- All throws via `sourceError("schema_invalid" | "timeout" | "http_5xx", message, cause?)`
- `toIsoZ(raw)` and `requireIsoZ(raw, label)` helpers — DO NOT reuse for CEMADEN; CEMADEN parser is different.

From src/lib/sources/errors.ts:

- `sourceError(code: SourceErrorCode, message: string, cause?: unknown): SourceError`

From src/lib/sources/schema.ts:

- `HAZARD_KINDS` (includes `deslizamento` after plan 02), `UF27_PROVISIONAL`, `AlertArraySchema`, `type Alert`.

From src/lib/sources/types.ts (verify in execution):

- `SourceAdapter { key: string; displayName: string; stability?: "stable" | "unstable"; fetch(): Promise<Alert[]> }`
  </interfaces>
  </context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: cemaden.schema.ts — zod for /wsAlertas2 payload</name>
  <files>src/lib/sources/cemaden.schema.ts</files>
  <behavior>
    - `WsAlertas2ItemSchema` accepts all 11 fields from `05-cemaden-endpoint-capture.md` §Schema (cod_alerta, datahoracriacao, ult_atualizacao, codibge, evento, nivel, status, uf, municipio, latitude, longitude).
    - `nivel` is `z.enum(["Moderado", "Alto", "Muito Alto"])` (the three observed vocabulary terms).
    - `uf` is constrained to `z.enum(UF27_PROVISIONAL)`.
    - `WsAlertas2ResponseSchema = z.object({ alertas: z.array(WsAlertas2ItemSchema), atualizado: z.string() })`.
    - Strict — `.strict()` on both schemas so any new field fails the tripwire.
    - Datetime fields are `z.string()` (regex `/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/`) — adapter parses, schema only validates shape.
  </behavior>
  <action>
    Mirror `src/lib/sources/inmet.schema.ts` structure. Export `WsAlertas2ResponseSchema`, `WsAlertas2ItemSchema`, `type WsAlertas2Item`. Datetime regex documented in a comment citing the capture file. `atualizado` regex: `/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2} UTC$/`.
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit</automated>
  </verify>
  <done>Schema file imports cleanly; types exported.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: cemaden.ts adapter — factory + parse + UTC normalization</name>
  <files>src/lib/sources/cemaden.ts</files>
  <behavior>
    - `createCemadenAdapter(http: CemadenHttpClient = PROD_HTTP_CLIENT)` returns SourceAdapter with `key: "cemaden"`, `displayName: "CEMADEN — Alertas vigentes"`, `stability: "unstable"`, `fetch(): Promise<Alert[]>`.
    - Single GET to `CEMADEN_WS_ALERTAS_URL = "https://painelalertas.cemaden.gov.br/wsAlertas2"` — no query params, no per-UF loop.
    - HTTP errors mapped via `wrapHttpError` (copy from `inmet.ts:170-197`) → `sourceError("timeout" | "http_5xx", ...)`. NEVER `class extends Error`.
    - Response validated via `WsAlertas2ResponseSchema.safeParse`; on fail throw `sourceError("schema_invalid", ...)`.
    - Hazard mapping (`CEMADEN_HAZARD_PATTERNS`):
      - `/^Risco Hidrol[óo]gico/i` → `"enchente"` (LOCKED — plan-review M-3; matches CLAUDE.md vocab "enchente vs inundação" and existing HAZARD_KINDS; `alagamento` not in the union, do NOT introduce)
      - `/^Movimento de Massa/i` → `"deslizamento"`
      - No match → throw `sourceError("schema_invalid", "CEMADEN evento not mappable")` (loud — matches INMET pattern at `inmet.ts:63`).
    - Severity normalized via `mapSeverity` (Task 3).
    - Timestamps: parse `datahoracriacao` as UTC. Implementation: `new Date(raw.replace(" ", "T") + "Z").toISOString()`. If `isNaN`, throw `sourceError("schema_invalid", ...)`. Per D-04 corrected (plan 02 corrections file).
    - Drift tripwire: if parsed date is before `2010-01-01T00:00:00Z` or after `now + 30 days`, throw `sourceError("schema_invalid", "CEMADEN timestamp out of plausible range")`.
    - `valid_from = isoZ(datahoracriacao)`; `valid_until = valid_from + 24h` (CEMADEN payload has no explicit expiry — apply 24h default per RISK-05 validity window).
    - `payload_hash` per alert via `computePayloadHash` from `src/lib/sources/hash.ts`.
    - Per-alert isolation via `Promise.allSettled` mirroring `inmet.ts:264-286` — one bad alert never poisons the whole tick.
    - Final `AlertArraySchema.safeParse(out)` tripwire before return.
    - Module docblock cites `05-cemaden-endpoint-capture.md` and `05-02-CONTEXT-corrections.md` D-04.
  </behavior>
  <action>
    Copy `src/lib/sources/inmet.ts` structure verbatim per `05-PATTERNS.md` §"Copy verbatim". Apply the diffs in `05-PATTERNS.md` §"Must differ". Do NOT copy `selectPtBrInfo` (CEMADEN is mono-language) or the CAP-document branch. UF normalization: CEMADEN payload already carries `uf` (validated by schema) → use directly; drop INMET's regex extraction. Export `createCemadenAdapter`, `cemadenAdapter = createCemadenAdapter()`, `CEMADEN_WS_ALERTAS_URL`, `type CemadenHttpClient`.
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit &amp;&amp; pnpm exec eslint src/lib/sources/cemaden.ts</automated>
  </verify>
  <done>File compiles, lints clean; exports match interfaces block.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: cemaden severity map</name>
  <files>src/lib/risk/sources/cemaden.ts</files>
  <behavior>
    - `SEVERITY_TABLE` frozen `Record<string, Severity>`:
      - `Moderado: "moderate"`
      - `Alto: "high"`
      - `Muito Alto: "extreme"`
    - `mapSeverity(raw)` returns `SEVERITY_TABLE[raw] ?? "moderate"` (RISK-04 default).
  </behavior>
  <action>
    Copy `src/lib/risk/sources/inmet.ts` verbatim (30 lines). Replace table contents only. Docblock cites `risk-formula-v0.md` and `05-cemaden-endpoint-capture.md` for vocabulary source.
  </action>
  <verify>
    <automated>pnpm test:ci tests/risk-sources/cemaden.test.ts 2>/dev/null || pnpm exec tsc --noEmit</automated>
  </verify>
  <done>Module exports `mapSeverity`, `SEVERITY_TABLE`; typecheck green.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-03 | Tampering | CEMADEN payload | mitigate | strict zod schema rejects unknown fields; drift tripwire on impossible dates |
| T-05-04 | Spoofing | CEMADEN endpoint | accept | endpoint is HTTPS asset path; no auth offered; risk delegated to TLS |
| T-05-05 | DoS | adapter HTTP call | mitigate | ofetch timeout (existing `src/lib/http/fetcher.ts`) + sourceError on timeout |
| T-05-06 | Information disclosure | error messages | mitigate | sourceError messages contain URL + status only, never payload bodies |
</threat_model>

<verification>
- `pnpm exec tsc --noEmit` green
- `pnpm exec eslint src/lib/sources/cemaden.ts src/lib/risk/sources/cemaden.ts` clean
- Files compile; tests land in plan 06
</verification>

<success_criteria>

- Three files exist matching interfaces block
- D-04 corrected behaviour reflected in adapter (UTC parse)
- Hazard mapping covers both observed CEMADEN event prefixes
  </success_criteria>

<output>
Create `.planning/phases/05-cemaden-dashboard-ui/05-03-SUMMARY.md`.
</output>
