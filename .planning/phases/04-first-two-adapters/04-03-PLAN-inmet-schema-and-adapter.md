---
phase: 04-first-two-adapters
plan: 03
type: execute
wave: 1
depends_on: ["04-01"]
files_modified:
  - src/lib/sources/inmet.ts
  - src/lib/sources/inmet.schema.ts
  - src/lib/sources/inmet.test.ts
autonomous: true
requirements: [ADAPT-02, ADAPT-04]
must_haves:
  truths:
    - "createInmetAdapter(httpClient) returns a SourceAdapter with key='inmet'"
    - "Two-step fetch: GET INMET_CAP_LIST → GET INMET_CAP_DETAIL(id) per active alert"
    - "CAP XML parsed via shared parseCapXml() (Wave 0)"
    - 'Adapter selects <info xml:lang="pt-BR"> block; missing → sourceError code=''missing_pt_br'''
    - "Severity raw → P3 mapSeverity (moderate-default for unknowns)"
    - "INMET hazard vocabulary preserved (incendio vs queimada, inundacao vs enchente)"
    - "All Alert timestamps are ISO-8601 UTC (Z suffix)"
    - "INMET-affected states with multi-state alerts produce one Alert per UF"
    - "Per-alert CAP fetch failures degrade that alert only — overall fetch returns the rest"
    - "All errors thrown via sourceError() factory from ./errors — NO `class SourceError extends Error` anywhere"
  artifacts:
    - path: "src/lib/sources/inmet.schema.ts"
      provides: "zod schemas for INMET /avisos/ativos list + parsed CAP structure"
      exports: ["InmetActiveListSchema", "InmetCapDocumentSchema"]
    - path: "src/lib/sources/inmet.ts"
      provides: "createInmetAdapter factory + inmetAdapter instance + endpoint constants"
      exports: ["createInmetAdapter", "inmetAdapter", "INMET_CAP_LIST", "INMET_CAP_DETAIL"]
    - path: "src/lib/sources/inmet.test.ts"
      provides: "Unit coverage on factory using DI stub + hand-crafted CAP XML strings"
      min_lines: 250
  key_links:
    - from: "src/lib/sources/inmet.ts"
      to: "src/lib/sources/xml.ts"
      via: "import { parseCapXml } from './xml'"
      pattern: "from \\\"\\./xml\\\""
    - from: "src/lib/sources/inmet.ts"
      to: "src/lib/sources/errors.ts"
      via: "import { sourceError } from './errors'"
      pattern: "from \\\"\\./errors\\\""
    - from: "src/lib/sources/inmet.ts"
      to: "src/lib/risk/sources/inmet.ts"
      via: "import { mapSeverity }"
      pattern: "from \\\"@/lib/risk/sources/inmet\\\""
---

<objective>
Implement the INMET source adapter as a `(httpClient) => SourceAdapter` factory consuming INMET's two-step API: list active alerts via `INMET_CAP_LIST`, then fetch CAP XML per alert via `INMET_CAP_DETAIL(id)`. CAP parsing uses the shared `parseCapXml` from Wave 0. PT-BR `<info>` selection is mandatory — fail loud via `sourceError("missing_pt_br", ...)` if absent.

Purpose: The sole real source adapter shipping in Phase 4 (Path C — CEMADEN deferred to P5 per RESEARCH Q1 resolution). Contract test (plan 04-05) will use a real captured CAP fixture; this plan ships the factory with hand-crafted CAP XML strings and 100% coverage.

Output: Working factory + zod schemas + unit tests, all errors thrown via the `sourceError()` factory landed in 04-01.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-first-two-adapters/04-SPEC.md
@.planning/phases/04-first-two-adapters/04-CONTEXT.md
@.planning/phases/04-first-two-adapters/04-RESEARCH.md
@.planning/phases/04-first-two-adapters/04-01-SUMMARY.md
@risk-formula-v0.md

<interfaces>
<!-- INMET endpoints pinned per RESEARCH Q2 resolution. -->

INMET endpoint constants (LOCKED by RESEARCH Q2):

```ts
export const INMET_CAP_LIST = "https://apiprevmet3.inmet.gov.br/avisos/ativos";
export const INMET_CAP_DETAIL = (id: string) => `https://alertas2.inmet.gov.br/${id}`;
```

From `src/lib/sources/errors.ts` (Wave 0):

```ts
export function sourceError(
  code: SourceErrorCode,
  message: string,
  cause?: unknown,
): SourceErrorLike;
export function isSourceError(e: unknown): e is SourceErrorLike;
```

From `src/lib/sources/xml.ts` (Wave 0):

```ts
export function parseCapXml(xml: string): unknown; // throws sourceError("xml_malformed", ...) on bad input
```

From `src/lib/risk/sources/inmet.ts` (P3):

```ts
export const SEVERITY_TABLE: Readonly<Record<string, Severity>>;
export function mapSeverity(raw: string): Severity; // unknown → "moderate"
```

CAP 1.2 / pt-BR canonical fields used:

- `alert.identifier`, `alert.sent`, `alert.status`, `alert.msgType`
- `alert.info` is an array (forced by Wave 0 isArray callback). Adapter selects entry where `info["@_xml:lang"] === "pt-BR"`.
- Within selected info: `severity`, `event`, `effective`, `expires`, `headline`, `description`, `web`
- `info.area` may be array or object; `area.geocode` carries the UF (or `area.areaDesc` includes state name).
  </interfaces>
  </context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: zod schemas for INMET list + parsed CAP (inmet.schema.ts)</name>
  <files>src/lib/sources/inmet.schema.ts</files>
  <behavior>
    - `InmetActiveListSchema` models the `INMET_CAP_LIST` JSON shape: array of `{ id, ... }` objects, tolerant via `.passthrough()`, strict on `id`.
    - `InmetCapDocumentSchema` models the parsed CAP structure (post-fast-xml-parser):
      ```ts
      z.object({
        alert: z.object({
          identifier: z.string(),
          sent: z.string(),
          status: z.string().optional(),
          info: z.array(z.object({
            "@_xml:lang": z.string().optional(),
            severity: z.string(),
            event: z.string(),
            effective: z.string().optional(),
            expires: z.string().optional(),
            headline: z.string(),
            description: z.string().optional(),
            web: z.string().url().optional(),
            area: z.union([
              z.object({ areaDesc: z.string(), geocode: z.unknown().optional() }).passthrough(),
              z.array(z.object({ areaDesc: z.string(), geocode: z.unknown().optional() }).passthrough()),
            ]).optional(),
          }).passthrough()).min(1),
        }).passthrough(),
      }).passthrough();
      ```
    - Helpers: `assertActiveList(raw)` and `assertCapDocument(raw)` throw `sourceError("schema_invalid", message, cause)` on parse failure (NOT `new SourceError(...)` — factory only).
  </behavior>
  <action>
    Create `src/lib/sources/inmet.schema.ts` with the above. Import `sourceError` from `./errors`. Export both schemas + the assert helpers + types.
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit && grep -E "class\\s+\\w+\\s+extends\\s+Error" src/lib/sources/inmet.schema.ts | wc -l | grep -q '^0$'</automated>
  </verify>
  <done>inmet.schema.ts compiles; both helpers throw via sourceError() factory; no Error subclass present.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: createInmetAdapter factory + production instance (inmet.ts)</name>
  <files>src/lib/sources/inmet.ts</files>
  <behavior>
    - `createInmetAdapter(httpClient): SourceAdapter` — pure factory, key="inmet", displayName="INMET — Alert-AS".
    - Export `INMET_CAP_LIST = "https://apiprevmet3.inmet.gov.br/avisos/ativos"` and `INMET_CAP_DETAIL = (id: string) => \`https://alertas2.inmet.gov.br/${id}\`` (constants pinned per RESEARCH Q2).
    - Step 1: `httpClient(INMET_CAP_LIST)` → JSON → `assertActiveList`.
    - Step 2: For each active id, `httpClient(INMET_CAP_DETAIL(id))` returning XML text → `parseCapXml` → `assertCapDocument`.
    - Use `Promise.allSettled` across per-alert CAP fetches. A rejection on one alert logs at warn level and continues — does NOT fail the whole adapter call.
    - `<info>` selection: filter `alert.info[]` for `["@_xml:lang"] === "pt-BR"`. If zero matches → throw `sourceError("missing_pt_br", \`alert ${id} has no pt-BR info block\`)`. NO fallback.
    - Severity mapping via P3 `mapSeverity`. Hazard vocab: map INMET `event` → canonical HAZARD_KINDS preserving incendio/queimada and inundacao/enchente; unknown event throws via `sourceError("schema_invalid", ...)`.
    - Multi-area alerts: emit one `Alert` per UF derived from `info.area`. If no UF resolves, throw `sourceError("schema_invalid", ...)` for that alert (per-alert allSettled isolation drops it).
    - Timestamps: `new Date(s).toISOString()` for `sent`/`effective`/`expires`.
    - `Alert.source_url` = `INMET_CAP_DETAIL(id)`. `Alert.payload_hash` = `computePayloadHash(parsedCapDocument)`.
    - HTTP errors (list step): full failure → `sourceError("http_5xx" | "timeout", ...)`. List 429 → `sourceError("http_5xx", "INMET list rate-limited")`.
    - Production export: `inmetAdapter = createInmetAdapter(prodHttpClient)`.
    - INVARIANT: every thrown error in this file flows through `sourceError(...)`. NO `new SourceError(...)` and NO `class extends Error`.
  </behavior>
  <action>
    1. Re-read `src/lib/http/fetcher.ts` to confirm wrapper signature for JSON vs raw text.
    2. Implement `createInmetAdapter`:
       - Helper `wrapHttpError(err)` returns `sourceError("timeout"|"http_5xx", ...)`.
       - List → ids → `Promise.allSettled(ids.map(fetchCap))`.
       - Per fulfilled CAP doc → `normalizeCapDoc(doc, capUrl)` → `Alert[]`.
       - Concat → `AlertArraySchema.parse(...)` defense-in-depth gate.
    3. Define and export `INMET_CAP_LIST`, `INMET_CAP_DETAIL`.
    4. JSDoc references SPEC ADAPT-02, ADAPT-04, CONTEXT decisions, and RESEARCH Q2 endpoint pin.
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit && pnpm lint -- src/lib/sources/inmet.ts && grep -E "new\\s+SourceError|class\\s+\\w+\\s+extends\\s+Error" src/lib/sources/inmet.ts | wc -l | grep -q '^0$'</automated>
  </verify>
  <done>inmet.ts exports createInmetAdapter, inmetAdapter, INMET_CAP_LIST, INMET_CAP_DETAIL; type-checks; lints; ZERO `new SourceError` or Error subclass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Unit tests for inmet adapter (inmet.test.ts) — DI stub, hand-crafted CAP XML</name>
  <files>src/lib/sources/inmet.test.ts</files>
  <behavior>
    Coverage: 100% lines + branches on inmet.ts and inmet.schema.ts.

    Stub client: dispatches based on URL — list endpoint returns canned JSON, CAP URLs return canned XML strings keyed by id.

    Required cases:
    - HAPPY PATH (single alert, single UF): list → 1 id, CAP returns valid pt-BR alert → 1 Alert, all timestamps Z-suffixed.
    - HAPPY PATH (multi-alert, multi-UF): 2 ids, one CAP covers "MG, SP" → 3 Alerts.
    - PT-BR SELECTION: CAP has en-US AND pt-BR → adapter picks pt-BR.
    - MISSING PT-BR: CAP has only en-US → adapter throws err with `isSourceError(err) && err.code === "missing_pt_br"` for that alert; sibling with valid pt-BR still appears.
    - SEVERITY UNKNOWN → MODERATE: `<severity>NotAValue</severity>` → output `severity: "moderate"`.
    - SEVERITY KNOWN: parameterized over P3 SEVERITY_TABLE.
    - HAZARD VOCAB: "Incêndio Florestal" → "incendio", "Queimada" → "queimada", "Inundação" → "inundacao", "Enchente" → "enchente". Unknown event → `code: "schema_invalid"`.
    - TIMESTAMP CONVERSION: `effective="2026-05-05T12:00:00-03:00"` → `valid_from: "2026-05-05T15:00:00.000Z"`.
    - CAP MALFORMED: stub returns `"<alert><info></alert>"` → adapter throws with `code: "xml_malformed"` for that alert; sibling still flows.
    - CAP SCHEMA DRIFT: valid XML missing required field → `code: "schema_invalid"` for that alert.
    - LIST 429: list rejects with 429 → adapter throws with `code: "http_5xx"`.
    - LIST TIMEOUT: list rejects with AbortError → `code: "timeout"`.
    - LIST EMPTY: `[]` → adapter returns `[]`.
    - PER-ALERT TIMEOUT: one CAP times out → adapter returns 1 Alert (the working one).
    - DEFENSE-IN-DEPTH: simulate normalization producing output that fails AlertArraySchema → `code: "schema_invalid"`.

    All error assertions use `isSourceError(err)` from `./errors` (NOT instanceof checks against a class).

  </behavior>
  <action>
    Use Vitest. Build a `makeStubClient({ list, capById })` helper. Hand-craft minimal CAP XML strings. Assert via explicit string equality on critical fields.

    Run coverage and assert 100/100 line+branch on inmet.ts + inmet.schema.ts.

  </action>
  <verify>
    <automated>pnpm test:coverage -- src/lib/sources/inmet && node -e "const c=require('./coverage/coverage-summary.json');const f=Object.keys(c).find(k=>k.includes('sources/inmet.ts'));if(!f)process.exit(0);const m=c[f];if(m.lines.pct<100||m.branches.pct<100){console.error('coverage gap',m);process.exit(1)}"</automated>
  </verify>
  <done>All listed cases pass; coverage 100/100 on inmet.ts and inmet.schema.ts; all error assertions use isSourceError().</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                          | Description                                    |
| --------------------------------- | ---------------------------------------------- |
| INMET list endpoint → adapter     | Untrusted JSON (rate-limited, schema unstable) |
| INMET CAP XML per alert → adapter | Untrusted XML (XXE risk, encoding tricks)      |

## STRIDE Threat Register (ASVS L2)

| Threat ID  | Category               | Component                                           | Disposition | Mitigation Plan                                                                                                      |
| ---------- | ---------------------- | --------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| T-04-03-01 | Tampering              | CAP XML uses non-pt-BR `<info>` only                | mitigate    | Adapter throws `sourceError("missing_pt_br", ...)` per CONTEXT decision                                              |
| T-04-03-02 | Information Disclosure | XXE expansion on CAP XML                            | mitigate    | parseCapXml inherits Wave 0 fast-xml-parser config (no external entity resolution)                                   |
| T-04-03-03 | Tampering              | Hazard `event` text mismapped (Incêndio → queimada) | mitigate    | Adapter preserves vocab distinctions; unknown events reject; 4 unit tests                                            |
| T-04-03-04 | Denial of Service      | List endpoint 429 cascades                          | mitigate    | Adapter surfaces `sourceError("http_5xx")`; orchestrator does not retry within tick (P2 backoff); next tick recovers |
| T-04-03-05 | Tampering              | Single corrupt CAP poisons entire INMET tick        | mitigate    | Per-alert allSettled isolation                                                                                       |
| T-04-03-06 | Spoofing               | DNS hijack of `apiprevmet3.inmet.gov.br`            | accept      | HTTPS-only via P2 wrapper; ofetch validates TLS                                                                      |
| T-04-03-07 | Tampering              | Timestamps already-Z parsed twice (double-shifted)  | mitigate    | `new Date(s).toISOString()` is idempotent for ISO-Z input; unit-tested                                               |
| T-04-03-08 | Repudiation            | Cannot reproduce which CAP doc emitted which Alert  | mitigate    | `Alert.source_url` = `INMET_CAP_DETAIL(id)`; `Alert.payload_hash` enables drift detection                            |
| T-04-03-09 | Tampering              | Error-shape divergence (subclass leaks past Wave 0) | mitigate    | Grep gate: `grep -E "new SourceError\|class.*extends Error" src/lib/sources/inmet.ts` returns 0; verified in CI      |

</threat_model>

<verification>
- `pnpm typecheck` clean
- `pnpm test -- src/lib/sources/inmet` all pass
- `pnpm test:coverage -- src/lib/sources/inmet` shows 100/100 lines+branches
- `pnpm lint` clean
- `grep -v '^[[:space:]]*\\*\\|^[[:space:]]*//' src/lib/sources/inmet.ts | grep -c '"low"'` = 0
- `grep -c "missing_pt_br" src/lib/sources/inmet.ts` ≥ 1
- `grep -c "Promise.allSettled" src/lib/sources/inmet.ts` ≥ 1
- `grep -c "sourceError" src/lib/sources/inmet.ts` ≥ 4 (factory used for all error paths)
- `grep -E "new SourceError|class\\s+\\w+\\s+extends\\s+Error" src/lib/sources/inmet.ts src/lib/sources/inmet.schema.ts | wc -l` = 0 (W-1 invariant)
- `grep -c "INMET_CAP_LIST\|INMET_CAP_DETAIL" src/lib/sources/inmet.ts` ≥ 2 (both endpoint constants exported)
</verification>

<success_criteria>
INMET adapter ships as factory + DI + production instance, two-step fetch with pinned constants, fail-loud via `sourceError("missing_pt_br")` on missing pt-BR, P3 severity mapping (moderate-default), INMET hazard vocab preserved, ISO-Z timestamps, per-alert isolation, 100% coverage, ZERO Error subclass usage anywhere.

## Dimension 8 Validation Requirements

Four load-bearing invariants under explicit tests + grep gates:

1. Missing pt-BR `<info>` throws `code: "missing_pt_br"` via factory (no language fallback).
2. Per-alert CAP failure does not poison the rest of the INMET tick.
3. Hazard vocab distinctions preserved (incendio vs queimada, inundacao vs enchente).
4. Coverage 100/100 line+branch.
5. (W-1 invariant) NO `class extends Error` and NO `new SourceError(...)` in this plan's files; all errors through `sourceError()`.
   </success_criteria>

<output>
After completion, create `.planning/phases/04-first-two-adapters/04-03-SUMMARY.md` documenting endpoints used (constants pinned per RESEARCH Q2), CAP fields consumed, UF resolution heuristic, factory-based error handling (W-1), and coverage results.
</output>
