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
    - "Two-step fetch: GET /avisos/ativos (list) → GET CAP XML per active alert"
    - "CAP XML parsed via shared createCapXmlParser() (Wave 0)"
    - 'Adapter selects <info xml:lang="pt-BR"> block; missing → SourceError code=''missing_pt_br'''
    - "Severity raw → P3 mapSeverity (moderate-default for unknowns)"
    - "INMET hazard vocabulary preserved (incendio vs queimada, inundacao vs enchente)"
    - "All Alert timestamps are ISO-8601 UTC (Z suffix)"
    - "INMET-affected states with multi-state alerts produce one Alert per UF"
    - "Per-alert CAP fetch failures degrade that alert only — overall fetch returns the rest"
  artifacts:
    - path: "src/lib/sources/inmet.schema.ts"
      provides: "zod schemas for INMET /avisos/ativos list + parsed CAP structure"
      exports: ["InmetActiveListSchema", "InmetCapDocumentSchema"]
    - path: "src/lib/sources/inmet.ts"
      provides: "createInmetAdapter factory + inmetAdapter instance + endpoint constants"
      exports:
        ["createInmetAdapter", "inmetAdapter", "INMET_LIST_ENDPOINT", "INMET_CAP_ENDPOINT_TEMPLATE"]
    - path: "src/lib/sources/inmet.test.ts"
      provides: "Unit coverage on factory using DI stub + hand-crafted CAP XML strings"
      min_lines: 250
  key_links:
    - from: "src/lib/sources/inmet.ts"
      to: "src/lib/sources/xml.ts"
      via: "import { parseCapXml, SourceError } from './xml'"
      pattern: "from \\\"\\./xml\\\""
    - from: "src/lib/sources/inmet.ts"
      to: "src/lib/risk/sources/inmet.ts"
      via: "import { mapSeverity }"
      pattern: "from \\\"@/lib/risk/sources/inmet\\\""
---

<objective>
Implement the INMET source adapter as a `(httpClient) => SourceAdapter` factory consuming INMET's two-step API: list active alerts via `https://apiprevmet3.inmet.gov.br/avisos/ativos`, then fetch CAP XML per alert. CAP parsing uses the shared `parseCapXml` from Wave 0. PT-BR `<info>` selection is mandatory — fail loud if absent.

Purpose: Second real source adapter. Contract test (plan 04-05) will use a real captured CAP fixture; this plan ships the factory with hand-crafted CAP XML strings and 100% coverage.

Output: Working factory + zod schemas + unit tests.
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
@.planning/phases/04-01-SUMMARY.md
@risk-formula-v0.md

<interfaces>
<!-- Same SourceAdapter / Alert / HAZARD_KINDS / SEVERITIES / UF27_PROVISIONAL contracts as plan 04-02. -->

From `src/lib/sources/xml.ts` (Wave 0):

```ts
export function parseCapXml(xml: string): unknown;
export class SourceError extends Error { readonly code: SourceErrorCode; ... }
```

From `src/lib/risk/sources/inmet.ts` (P3):

```ts
export const SEVERITY_TABLE: Readonly<Record<string, Severity>>;
export function mapSeverity(raw: string): Severity; // unknown → "moderate"
```

INMET endpoints (from 04-RESEARCH.md):

- LIST: `https://apiprevmet3.inmet.gov.br/avisos/ativos` → JSON list of active alert IDs + metadata
- CAP per alert: `https://alertas2.inmet.gov.br/{id}` (raw CAP) — research-confirmed
- Two-step pattern locked by critical_constraint #8

CAP 1.2 / pt-BR canonical fields used:

- `alert.identifier`, `alert.sent`, `alert.status`, `alert.msgType`
- `alert.info` is an array (forced by Wave 0 isArray callback). Adapter selects entry where `info["@_xml:lang"] === "pt-BR"`.
- Within selected info: `severity`, `event` (hazard descriptor), `effective`, `expires`, `headline`, `description`, `web`
- `info.area` may be array or object; each `area.geocode` carries the UF (or `area.areaDesc` includes state name — research-confirmed mapping).
  </interfaces>
  </context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: zod schemas for INMET list + parsed CAP (inmet.schema.ts)</name>
  <files>src/lib/sources/inmet.schema.ts</files>
  <behavior>
    - `InmetActiveListSchema` models the `/avisos/ativos` JSON shape per RESEARCH.md (typically: array of `{ id, ... }` objects with optional metadata). Tolerant via `.passthrough()` on each item; strict on `id`.
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
    - Helpers: `assertActiveList(raw)` and `assertCapDocument(raw)` throw `SourceError("schema_invalid")` on parse failure.
  </behavior>
  <action>
    Create `src/lib/sources/inmet.schema.ts` with the above. Match the actual list shape captured in RESEARCH.md (RESEARCH noted the list is rate-limited but documented). Export both schemas + the assert helpers + types.
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit</automated>
  </verify>
  <done>inmet.schema.ts compiles; both helpers exist and throw SourceError on bad input.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: createInmetAdapter factory + production instance (inmet.ts)</name>
  <files>src/lib/sources/inmet.ts</files>
  <behavior>
    - `createInmetAdapter(httpClient): SourceAdapter` — pure factory, key="inmet", displayName="INMET — Alert-AS".
    - Step 1: `httpClient(INMET_LIST_ENDPOINT)` → JSON → `assertActiveList`.
    - Step 2: For each active id, `httpClient(INMET_CAP_ENDPOINT_TEMPLATE.replace("{id}", id))` returning XML text → `parseCapXml` → `assertCapDocument`.
    - Use `Promise.allSettled` across per-alert CAP fetches. A rejection on one alert logs at warn level and continues with the rest — does NOT fail the whole adapter call. (Public-safety: one bad alert ≠ entire INMET source down.)
    - `<info>` selection: filter `alert.info[]` for `["@_xml:lang"] === "pt-BR"`. If zero matches → throw `SourceError("missing_pt_br", \`alert ${id} has no pt-BR info block\`)`. NO fallback to other languages (CONTEXT decision).
    - Severity mapping via P3 `mapSeverity`. Hazard vocab: map INMET `event` value → canonical HAZARD_KINDS preserving incendio/queimada and inundacao/enchente distinctions; unknown event throws `schema_invalid`.
    - Multi-area alerts: emit one `Alert` per UF derived from `info.area` entries. If a single `area.areaDesc` covers multiple UFs (e.g., "MG, SP"), parse the comma-list and produce one Alert per UF. Per-area UF resolution must be deterministic — if no UF can be resolved, throw `schema_invalid` for that alert (orchestrator drops it via per-alert allSettled isolation).
    - Timestamps: CAP `sent`, `effective`, `expires` are ISO-8601 with offset → `new Date(s).toISOString()` → ends in Z.
    - `Alert.source_url` = the CAP URL for that alert. `Alert.payload_hash` = `computePayloadHash(parsedCapDocument)`.
    - HTTP errors (list step): full failure → throw `SourceError("http_5xx" | "timeout")`. List step rate-limit (HTTP 429) → throw `SourceError("http_5xx", "INMET list rate-limited")` so the orchestrator records `sources_health.lastError = "http_5xx"` and INMET degrades for this tick.
    - Production export: `inmetAdapter = createInmetAdapter(prodHttpClient)`.
  </behavior>
  <action>
    1. Re-read `src/lib/http/fetcher.ts` to confirm wrapper signature and how it returns text vs JSON. The list call wants JSON; the CAP call wants raw text. If the wrapper auto-parses by content-type, pass an explicit `responseType: "text"` for CAP fetches (or whatever the wrapper supports).
    2. Implement `createInmetAdapter`:
       - Error helper: `wrapHttpError(err)` → returns `SourceError("timeout"|"http_5xx", ...)`.
       - List → ids → `Promise.allSettled(ids.map(fetchCap))`.
       - For each fulfilled CAP doc → `normalizeCapDoc(doc, capUrl)` → `Alert[]` (1+ per multi-UF).
       - Concat all → `AlertArraySchema.parse(...)` defense-in-depth gate → return.
    3. Define and export `INMET_LIST_ENDPOINT`, `INMET_CAP_ENDPOINT_TEMPLATE`.
    4. JSDoc references SPEC ADAPT-02, ADAPT-04 and CONTEXT decisions.
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit && pnpm lint -- src/lib/sources/inmet.ts</automated>
  </verify>
  <done>inmet.ts exports createInmetAdapter, inmetAdapter, INMET_LIST_ENDPOINT, INMET_CAP_ENDPOINT_TEMPLATE; type-checks; lints.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Unit tests for inmet adapter (inmet.test.ts) — DI stub, hand-crafted CAP XML</name>
  <files>src/lib/sources/inmet.test.ts</files>
  <behavior>
    Coverage: 100% lines + branches on inmet.ts and inmet.schema.ts.

    Stub client: dispatches based on URL prefix — list endpoint returns canned JSON, CAP URLs return canned XML strings keyed by id.

    Required cases:
    - HAPPY PATH (single alert, single UF): list → 1 id, CAP returns valid pt-BR alert → adapter outputs 1 Alert with all timestamps Z-suffixed.
    - HAPPY PATH (multi-alert, multi-UF): list → 2 ids, one CAP has area covering "MG, SP" → adapter emits 3 Alerts total.
    - PT-BR SELECTION: CAP has `<info xml:lang="en-US">` and `<info xml:lang="pt-BR">` — adapter picks pt-BR, ignores en-US.
    - MISSING PT-BR: CAP has only `<info xml:lang="en-US">` → adapter throws SourceError code="missing_pt_br" for that alert; isolation test: a sibling alert in the same fetch with valid pt-BR still appears in results.
    - SEVERITY UNKNOWN → MODERATE: `<severity>NotAValue</severity>` → output `severity: "moderate"` (assert string).
    - SEVERITY KNOWN: each P3 SEVERITY_TABLE term maps correctly (parameterized test).
    - HAZARD VOCAB: event="Incêndio Florestal" → hazard_kind="incendio". event="Queimada" → "queimada" (NOT collapsed). event="Inundação" → "inundacao". event="Enchente" → "enchente". Unknown event → throws schema_invalid for that alert.
    - TIMESTAMP CONVERSION: CAP `effective="2026-05-05T12:00:00-03:00"` → `valid_from: "2026-05-05T15:00:00.000Z"`.
    - CAP MALFORMED: stub returns `"<alert><info></alert>"` → adapter throws SourceError code="xml_malformed" for that alert; sibling alert still flows.
    - CAP SCHEMA DRIFT: valid XML missing required `severity` field → schema_invalid for that alert; sibling flows.
    - LIST 429: list step rejects with 429 → adapter throws SourceError code="http_5xx" (whole-source degrade).
    - LIST TIMEOUT: list step rejects with AbortError → SourceError code="timeout".
    - LIST EMPTY: `[]` → adapter returns `[]` (no alerts active is a valid state).
    - PER-ALERT TIMEOUT: list returns 2 ids, one CAP fetch times out → adapter returns 1 Alert (the working one) and warn-logs the failure.
    - DEFENSE-IN-DEPTH: simulate normalization producing an output that fails AlertArraySchema (e.g., manipulate parser output via spy) → adapter throws schema_invalid (post-normalization gate fires).

  </behavior>
  <action>
    Use Vitest. Build a `makeStubClient({ list, capById })` helper. Hand-craft minimal CAP XML strings — keep them small but valid against the schema. Assert with explicit string equality on critical fields (severity values, hazard kinds, ISO-Z timestamps); only one happy-path inline snapshot.

    Run coverage and assert 100/100 line+branch on inmet.ts + inmet.schema.ts.

  </action>
  <verify>
    <automated>pnpm test:coverage -- src/lib/sources/inmet && node -e "const c=require('./coverage/coverage-summary.json');const f=Object.keys(c).find(k=>k.includes('sources/inmet.ts'));if(!f)process.exit(0);const m=c[f];if(m.lines.pct<100||m.branches.pct<100){console.error('coverage gap',m);process.exit(1)}"</automated>
  </verify>
  <done>All listed cases pass; coverage 100/100 on inmet.ts and inmet.schema.ts.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                          | Description                                    |
| --------------------------------- | ---------------------------------------------- |
| INMET list endpoint → adapter     | Untrusted JSON (rate-limited, schema unstable) |
| INMET CAP XML per alert → adapter | Untrusted XML (XXE risk, encoding tricks)      |

## STRIDE Threat Register (ASVS L2)

| Threat ID  | Category               | Component                                           | Disposition | Mitigation Plan                                                                                                           |
| ---------- | ---------------------- | --------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| T-04-03-01 | Tampering              | CAP XML uses non-pt-BR `<info>` only                | mitigate    | Adapter throws missing_pt_br per CONTEXT decision; never silently uses en-US (which could mistranslate severity terms)    |
| T-04-03-02 | Information Disclosure | XXE expansion on CAP XML                            | mitigate    | parseCapXml inherits Wave 0 fast-xml-parser config (no external entity resolution)                                        |
| T-04-03-03 | Tampering              | Hazard `event` text mismapped (Incêndio → queimada) | mitigate    | Adapter preserves vocab distinctions; unknown events reject; 4 unit tests                                                 |
| T-04-03-04 | Denial of Service      | List endpoint 429 cascades                          | mitigate    | Adapter surfaces SourceError("http_5xx"); orchestrator does not retry within tick (P2 backoff); next 15-min tick recovers |
| T-04-03-05 | Tampering              | Single corrupt CAP poisons entire INMET tick        | mitigate    | Per-alert allSettled isolation — one bad CAP does not block the rest                                                      |
| T-04-03-06 | Spoofing               | DNS hijack of `apiprevmet3.inmet.gov.br`            | accept      | HTTPS-only via P2 wrapper; ofetch validates TLS                                                                           |
| T-04-03-07 | Tampering              | Timestamps already-Z parsed twice (double-shifted)  | mitigate    | Adapter uses `new Date(s).toISOString()` which is idempotent for ISO-Z input; unit-tested                                 |
| T-04-03-08 | Repudiation            | Cannot reproduce which CAP doc emitted which Alert  | mitigate    | `Alert.source_url` = CAP URL; `Alert.raw` = parsed CAP doc; `Alert.payload_hash` enables drift detection                  |

</threat_model>

<verification>
- `pnpm typecheck` clean
- `pnpm test -- src/lib/sources/inmet` all pass
- `pnpm test:coverage -- src/lib/sources/inmet` shows 100/100 lines+branches on inmet.ts + inmet.schema.ts
- `pnpm lint` clean
- `grep -v '^[[:space:]]*\\*\\|^[[:space:]]*//' src/lib/sources/inmet.ts | grep -c '"low"'` = 0 (no low-default)
- `grep -c "missing_pt_br" src/lib/sources/inmet.ts` ≥ 1 (fail-loud invariant)
- `grep -c "Promise.allSettled" src/lib/sources/inmet.ts` ≥ 1 (per-alert isolation)
</verification>

<success_criteria>
INMET adapter ships as factory + DI + production instance, two-step fetch, fail-loud on missing pt-BR, P3 severity mapping (moderate-default), INMET hazard vocab preserved, ISO-Z timestamps, per-alert isolation, 100% coverage. Plan 04-05 will replace inline CAP XML with a real captured fixture.

## Dimension 8 Validation Requirements

Three load-bearing invariants under explicit unit tests: (1) missing pt-BR `<info>` throws `missing_pt_br` (no language fallback); (2) per-alert CAP failure does not poison the rest of the INMET tick; (3) hazard vocab distinctions (incendio vs queimada, inundacao vs enchente) preserved. Coverage 100/100 line+branch.
</success_criteria>

<output>
After completion, create `.planning/phases/04-first-two-adapters/04-03-SUMMARY.md` documenting endpoints used, CAP fields consumed, UF resolution heuristic, and coverage results.
</output>
