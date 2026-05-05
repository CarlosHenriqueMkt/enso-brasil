---
phase: 04-first-two-adapters
plan: 02
type: execute
wave: 1
depends_on: ["04-01"]
files_modified:
  - src/lib/sources/cemaden.ts
  - src/lib/sources/cemaden.schema.ts
  - src/lib/sources/cemaden.test.ts
autonomous: true
requirements: [ADAPT-01, ADAPT-04]
must_haves:
  truths:
    - "createCemadenAdapter(httpClient) returns a SourceAdapter with key='cemaden'"
    - "Response is zod-validated against CemadenResponseSchema before normalization"
    - "Severity terms are mapped through P3 vocab (src/lib/risk/sources/cemaden.ts mapSeverity)"
    - "Unknown source severity terms default to 'moderate' (NOT 'low' — risk-formula-v0)"
    - "All Alert.fetched_at / valid_from / valid_until are ISO-8601 UTC strings ending in 'Z'"
    - "Hazard kind preserves CEMADEN vocabulary verbatim (queimada vs incendio, estiagem vs seca)"
    - "Schema-invalid responses throw SourceError with code='schema_invalid'"
    - "HTTP 5xx and timeouts surface as SourceError with code='http_5xx' / 'timeout'"
  artifacts:
    - path: "src/lib/sources/cemaden.schema.ts"
      provides: "zod schema for CEMADEN national-scope alert list payload"
      exports: ["CemadenResponseSchema", "CemadenAlertSchema", "CemadenAlert"]
    - path: "src/lib/sources/cemaden.ts"
      provides: "createCemadenAdapter factory + cemadenAdapter prod instance"
      exports: ["createCemadenAdapter", "cemadenAdapter", "CEMADEN_ENDPOINT"]
    - path: "src/lib/sources/cemaden.test.ts"
      provides: "Unit coverage on factory with hand-crafted inline fixtures + DI httpClient stub"
      min_lines: 200
  key_links:
    - from: "src/lib/sources/cemaden.ts"
      to: "src/lib/risk/sources/cemaden.ts"
      via: "import { mapSeverity } from '@/lib/risk/sources/cemaden'"
      pattern: "from \\\"@/lib/risk/sources/cemaden\\\""
    - from: "src/lib/sources/cemaden.ts"
      to: "src/lib/sources/xml.ts"
      via: "import { SourceError } — error taxonomy"
      pattern: "SourceError"
    - from: "src/lib/sources/cemaden.ts"
      to: "src/lib/sources/hash.ts"
      via: "computePayloadHash for Alert.payload_hash"
      pattern: "computePayloadHash"
---

<objective>
Implement the CEMADEN source adapter as a `(httpClient) => SourceAdapter` factory plus a production-wired `cemadenAdapter` instance. The factory takes the HTTP client by DI (per CONTEXT.md adapter architecture) so tests pass an in-memory stub.

Purpose: First real source adapter. Replaces the stub for CEMADEN. Conservative bias on severity (default `moderate` for unknowns), strict zod validation, fail-loud on schema drift.

Output: Working factory + zod schema + 100% unit-test coverage on the adapter module using hand-crafted inline fixtures (real-fixture contract test ships in plan 04-05).

**Conditional scope (per SPEC Q6=a / CONTEXT critical_constraint #7):** This plan depends on the CEMADEN endpoint and response shape captured in `04-RESEARCH.md`. If RESEARCH did not resolve a usable endpoint, the executor MUST stop at Task 0 and escalate via the orchestrator — do NOT invent an endpoint. Phase ships INMET-only via fallback path.
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
<!-- Existing contracts the adapter MUST honor — extracted from current codebase. -->
<!-- Do NOT redefine these. Import + use as-is. -->

From `src/lib/sources/types.ts`:

```ts
export interface SourceAdapter {
  readonly key: string;
  readonly displayName: string;
  fetch(): Promise<Alert[]>;
}
```

From `src/lib/sources/schema.ts`:

```ts
export const HAZARD_KINDS = [
  "queimada",
  "enchente",
  "estiagem",
  "incendio",
  "inundacao",
  "seca",
] as const;
export const SEVERITIES = ["low", "moderate", "high", "extreme"] as const;
export const UF27_PROVISIONAL = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;
export const AlertSchema = z.object({
  source_key: z.string().min(1),
  hazard_kind: z.enum(HAZARD_KINDS),
  state_uf: z.enum(UF27_PROVISIONAL),
  severity: z.enum(SEVERITIES),
  headline: z.string().min(1),
  body: z.string().optional(),
  source_url: z.string().url().optional(),
  fetched_at: z.string().datetime(), // ISO-8601 with offset/Z
  valid_from: z.string().datetime().optional(),
  valid_until: z.string().datetime().optional(),
  payload_hash: z.string().regex(/^[a-f0-9]{64}$/),
  raw: z.unknown(),
});
```

From `src/lib/risk/sources/cemaden.ts` (P3 vocab — already shipped):

```ts
export const SEVERITY_TABLE: Readonly<Record<string, Severity>>;
export function mapSeverity(raw: string): Severity; // unknown → "moderate"
```

From `src/lib/sources/hash.ts` (P2):

```ts
export function computePayloadHash(payload: unknown): string; // sha256 hex 64 chars
```

From `src/lib/http/fetcher.ts` (P2): the shared ofetch wrapper. Production passes the wrapper; tests pass `(url: string, opts?: any) => Promise<unknown>`.

From `src/lib/sources/xml.ts` (Wave 0):

```ts
export class SourceError extends Error { readonly code: SourceErrorCode; ... }
export type SourceErrorCode = "http_5xx" | "timeout" | "schema_invalid" | "payload_drift" | "xml_malformed" | "missing_pt_br";
```

</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 0: Confirm endpoint + response shape from RESEARCH.md, fail loud if absent</name>
  <files>(read-only verification)</files>
  <action>
    Read `.planning/phases/04-first-two-adapters/04-RESEARCH.md` and confirm:
    1. CEMADEN endpoint URL is documented (a concrete `https://...` for the Painel de Alertas backing API).
    2. Auth posture is documented (public / token / IP allowlist).
    3. A representative response shape is captured (at least field names + types for severity, location/UF, valid times, headline/body equivalents).

    If ANY of these are missing or marked "blocked / unknown" in RESEARCH.md:
    - STOP. Do not write code that assumes an endpoint.
    - Return to the orchestrator with status `BLOCKED — CEMADEN endpoint unresolved`.
    - Phase enters Q6=a fallback: skip plans 04-02 and 04-05 CEMADEN test, plan 04-06 registers `[inmetAdapter]` only, deferred to P5/P6.

    If all three are present, proceed to Task 1.

  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const r=fs.readFileSync('.planning/phases/04-first-two-adapters/04-RESEARCH.md','utf8');if(!/painelalertas\.cemaden|apicemaden|sgaa\.cemaden|cemaden\.gov\.br/i.test(r))process.exit(1);console.log('endpoint reference present')"</automated>
  </verify>
  <done>RESEARCH.md confirms endpoint + auth + shape, OR plan halts and orchestrator routes to fallback.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 1: zod schema for CEMADEN response (cemaden.schema.ts)</name>
  <files>src/lib/sources/cemaden.schema.ts</files>
  <behavior>
    - Schema models the structure described in `04-RESEARCH.md` for CEMADEN's national-scope alert payload.
    - Required fields per record (minimum, adjust to actual shape): id/identifier, severity term (raw string), state code or municipality with UF derivable, hazard descriptor, issued/published timestamp, optional valid-until, optional URL.
    - All timestamp fields parse as `z.string()` (raw) — conversion to ISO-Z happens in the adapter.
    - Tolerant on optional/extra fields via `.passthrough()` at the top level (we don't want to reject benign new fields), but STRICT on the required set (missing/wrong-type → throws).
    - `CemadenResponseSchema` = array OR `{alerts: [...]}` envelope (whichever RESEARCH.md confirms — pick one and document the choice).
  </behavior>
  <action>
    Create `src/lib/sources/cemaden.schema.ts`:
    1. Import `z` from `zod`.
    2. Define `CemadenAlertSchema` matching the captured shape, e.g.:
       ```ts
       export const CemadenAlertSchema = z.object({
         id: z.union([z.string(), z.number()]),
         severity: z.string().min(1),     // raw — mapped via P3 vocab
         hazard: z.string().min(1),       // CEMADEN term verbatim
         state: z.string().length(2),     // UF code from response, OR derive from municipality field
         issuedAt: z.string().min(1),     // raw ISO/naive — adapter converts
         validUntil: z.string().optional(),
         headline: z.string().min(1),
         body: z.string().optional(),
         url: z.string().url().optional(),
       }).passthrough();
       export type CemadenAlert = z.infer<typeof CemadenAlertSchema>;
       export const CemadenResponseSchema = z.array(CemadenAlertSchema);
       ```
       (Adjust the field set to match RESEARCH.md exactly — these names are illustrative.)
    3. Export an `assertCemadenResponse(raw: unknown): CemadenAlert[]` helper that calls `.safeParse` and on failure throws `new SourceError("schema_invalid", ..., { cause: parseResult.error })`.
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit -p tsconfig.json && pnpm test -- src/lib/sources/cemaden.schema || pnpm test -- src/lib/sources/cemaden  # schema is exercised by adapter tests in Task 3</automated>
  </verify>
  <done>cemaden.schema.ts exports CemadenResponseSchema, CemadenAlertSchema, CemadenAlert, assertCemadenResponse; types compile; field set matches RESEARCH.md.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: createCemadenAdapter factory + production instance (cemaden.ts)</name>
  <files>src/lib/sources/cemaden.ts</files>
  <behavior>
    - `createCemadenAdapter(httpClient: HttpClient): SourceAdapter` — pure factory.
    - Calls `httpClient(CEMADEN_ENDPOINT)`, validates with `CemadenResponseSchema`, normalizes to `Alert[]`.
    - Severity raw string → P3 `mapSeverity` (defaults `moderate` for unknowns — verified by Task 3 tests).
    - Hazard descriptor → canonical `HAZARD_KINDS` value, preserving CEMADEN vocab distinctions ("queimada" stays queimada, NOT collapsed to "incendio"; "estiagem" stays estiagem, NOT "seca"). Unknown hazard string → adapter throws `SourceError("schema_invalid")` (we do NOT silently map to a wrong hazard — risk-formula sees one fewer alert, but never a mislabeled one).
    - Naive timestamps from CEMADEN are interpreted as BRT (UTC-3, no DST) → `+03:00` offset, then `.toISOString()` → ends in `Z`. If a timestamp already carries an offset, pass through `new Date(s).toISOString()`.
    - Each output `Alert.payload_hash` = `computePayloadHash(rawRecord)`.
    - Each output `Alert.raw` = the original record (unmodified) for downstream debugging / drift detection.
    - HTTP errors: `httpClient` rejection bubbles as `SourceError("http_5xx" | "timeout", ...)`. Wrapper categorizes; if it doesn't, this adapter wraps with code "http_5xx" (the orchestrator can refine later).
    - Production export: `export const cemadenAdapter = createCemadenAdapter(prodHttpClient)` where `prodHttpClient` is the P2 ofetch wrapper. Use a lazy thunk or direct export per existing P2 conventions (read `src/lib/http/fetcher.ts` and match — do not invent a new wrapper).
  </behavior>
  <action>
    1. Read `src/lib/http/fetcher.ts` to learn the wrapper export shape.
    2. Define a local `HttpClient` type: `(url: string, opts?: { timeoutMs?: number; signal?: AbortSignal }) => Promise<unknown>` (or whatever matches the P2 wrapper signature).
    3. Implement `createCemadenAdapter(httpClient)`:
       - `key: "cemaden"`
       - `displayName: "CEMADEN — Painel de Alertas"` (Portuguese display per PT-BR-only stack)
       - `async fetch()`:
         a. `const raw = await httpClient(CEMADEN_ENDPOINT)` (catch and re-throw as `SourceError("http_5xx"|"timeout", ...)` based on `err.cause` shape from ofetch).
         b. `const records = assertCemadenResponse(raw)` (throws `SourceError("schema_invalid", ...)` on zod failure).
         c. `const fetchedAt = new Date().toISOString()` — captured once per fetch.
         d. Map each record → `Alert`. Helper `normalizeOne(rec): Alert` does severity mapping, hazard validation, UF resolution, ISO conversion, payload_hash.
         e. Return the resulting `Alert[]` (validated again with `AlertArraySchema.parse(...)` as a defense-in-depth gate — drift in our normalization throws here, never silently emits malformed alerts).
    4. Export `CEMADEN_ENDPOINT` constant from RESEARCH.md.
    5. Export `cemadenAdapter` production instance using P2's wrapper.
    6. JSDoc on the factory references SPEC requirement IDs (ADAPT-01, ADAPT-04) and CONTEXT decisions.
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit && pnpm lint -- src/lib/sources/cemaden.ts</automated>
  </verify>
  <done>cemaden.ts exports createCemadenAdapter, cemadenAdapter, CEMADEN_ENDPOINT; type-checks clean; lints clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Unit tests for cemaden adapter (cemaden.test.ts) — DI stub, hand-crafted fixtures</name>
  <files>src/lib/sources/cemaden.test.ts</files>
  <behavior>
    Coverage target: 100% lines + branches on `cemaden.ts` and `cemaden.schema.ts` (matches P3 bar). All tests use `createCemadenAdapter(stubClient)` — no MSW, no real HTTP.

    Required cases:
    - HAPPY PATH: stub returns 2 valid records spanning 2 states + 2 hazard kinds → adapter produces `Alert[]` length 2, every `fetched_at` ends in `Z`, every `payload_hash` is 64-hex.
    - SEVERITY MAPPING — known: raw severity matches P3 SEVERITY_TABLE → mapped correctly.
    - SEVERITY MAPPING — unknown: raw severity = `"made-up-term"` → output severity is `"moderate"` (NOT `"low"` — explicitly assert string equality).
    - HAZARD VOCAB: input `hazard = "queimada"` → output `hazard_kind = "queimada"` (NOT collapsed to "incendio"). Input `hazard = "incendio"` → output `hazard_kind = "incendio"`. Input `hazard = "estiagem"` → output `hazard_kind = "estiagem"` (NOT "seca"). All four CEMADEN distinctions assert separately.
    - HAZARD UNKNOWN: input `hazard = "tornado"` → adapter throws SourceError with `code: "schema_invalid"`.
    - TIMESTAMP — naive BRT: `"2026-05-05 12:00:00"` → output UTC `"2026-05-05T15:00:00.000Z"`.
    - TIMESTAMP — already with offset: `"2026-05-05T12:00:00-03:00"` → `"2026-05-05T15:00:00.000Z"`.
    - SCHEMA DRIFT: stub returns `[{ id: 1 }]` (missing required fields) → throws SourceError `code: "schema_invalid"`.
    - SCHEMA DRIFT — extra fields: stub returns valid record with an unexpected `extra: "field"` → adapter does NOT throw (passthrough), record normalizes successfully.
    - HTTP 5xx: stub rejects with an FetchError-shaped error containing status 503 → adapter throws SourceError `code: "http_5xx"`.
    - HTTP TIMEOUT: stub rejects with `{ name: "AbortError" }` or ofetch's timeout shape → throws SourceError `code: "timeout"`.
    - UF MAPPING: every UF27 value validates; invalid UF (e.g., "XX") throws schema_invalid.
    - ALERT GATE: simulate normalization producing an Alert that fails AlertSchema (mock `mapSeverity` to return invalid via vi.spyOn — or pass a payload that triggers a known internal mismatch); assert the post-normalization AlertArraySchema gate catches it.

  </behavior>
  <action>
    1. Use Vitest. Import `createCemadenAdapter`, `SourceError` from xml.ts.
    2. Build a `makeStubClient(response: unknown | Error)` helper.
    3. Group tests by behavior section (happy / severity / hazard / timestamps / schema drift / HTTP errors).
    4. Use `expect.toMatchInlineSnapshot()` only for the happy-path Alert shape — avoid brittle snapshots elsewhere.
    5. Achieve 100% line + branch coverage. Run `pnpm test:coverage -- src/lib/sources/cemaden` and assert via the coverage thresholds in vitest.config.ts (extend if necessary — match P3's setting).
  </action>
  <verify>
    <automated>pnpm test:coverage -- src/lib/sources/cemaden && node -e "const c=require('./coverage/coverage-summary.json');const f=Object.keys(c).find(k=>k.includes('sources/cemaden.ts'));if(!f){process.exit(0)}const m=c[f];if(m.lines.pct<100||m.branches.pct<100){console.error('coverage gap',m);process.exit(1)}"</automated>
  </verify>
  <done>cemaden.test.ts has all listed cases passing; line + branch coverage on cemaden.ts and cemaden.schema.ts is 100%.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                        | Description                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| CEMADEN HTTP response → adapter | Untrusted: schema unstable, no contract guarantees                                                         |
| adapter → orchestrator          | Trusted (in-process), but orchestrator relies on SourceError discriminated union — code must always be set |

## STRIDE Threat Register (ASVS L2)

| Threat ID  | Category               | Component                                                                         | Disposition | Mitigation Plan                                                                                                                                    |
| ---------- | ---------------------- | --------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-04-02-01 | Tampering              | CEMADEN response field renamed/removed                                            | mitigate    | zod `safeParse` → `SourceError("schema_invalid")`; orchestrator records sources_health.lastError; per-source isolation keeps INMET flowing (REQ-7) |
| T-04-02-02 | Tampering              | Severity term unknown to vocab → silently mismapped                               | mitigate    | P3 mapSeverity defaults `moderate` (NOT `low`) — conservative bias; unit-tested                                                                    |
| T-04-02-03 | Information Disclosure | Adapter logs leak full upstream payload (potential PII in body fields)            | mitigate    | Adapter throws SourceError with message only; orchestrator (P2) uses pino redaction; never log `Alert.raw` at info level                           |
| T-04-02-04 | Spoofing               | Attacker MITMs CEMADEN endpoint and serves crafted JSON                           | accept      | HTTPS-only via P2 wrapper; CEMADEN endpoint is HTTPS; ofetch validates TLS by default                                                              |
| T-04-02-05 | Denial of Service      | Huge response body exhausts Vercel function memory                                | mitigate    | P2 wrapper enforces response size cap; if absent, propose addition before adapter ships (raise gate to plan-checker)                               |
| T-04-02-06 | Tampering              | Hazard vocabulary collapsed (queimada → incendio) → wrong public-safety semantics | mitigate    | Adapter preserves CEMADEN vocab verbatim; unknown hazard rejects (no silent re-mapping); unit-tested across 4 distinctions                         |
| T-04-02-07 | Tampering              | Naive timestamp interpreted as wrong TZ → alert appears expired or future         | mitigate    | Adapter assumes BRT (UTC-3, no DST) per CONTEXT.md; assumption documented in JSDoc; integration test asserts conversion                            |
| T-04-02-08 | Repudiation            | No record of which response shape was parsed                                      | mitigate    | `Alert.raw` carries the original record; `Alert.payload_hash` enables drift detection                                                              |

</threat_model>

<verification>
- `pnpm typecheck` clean
- `pnpm test -- src/lib/sources/cemaden` all pass
- `pnpm test:coverage -- src/lib/sources/cemaden` shows 100/100 lines+branches on cemaden.ts and cemaden.schema.ts
- `pnpm lint` clean
- `grep -v '^[[:space:]]*\\*\\|^[[:space:]]*//' src/lib/sources/cemaden.ts | grep -c '"low"'` = 0 (must NOT default to low; this is the unknown→moderate invariant)
- `grep -c "mapSeverity" src/lib/sources/cemaden.ts` ≥ 1 (uses P3 vocab)
- `grep -c "passthrough" src/lib/sources/cemaden.schema.ts` ≥ 1 (top-level tolerant)
</verification>

<success_criteria>
CEMADEN adapter ships as factory + DI + production instance, with zod schema gate, P3 severity mapping (moderate-default), CEMADEN hazard vocab preserved, ISO-Z timestamps, payload_hash on every Alert, and 100% test coverage. Plan 04-05 will replace inline fixtures with a real captured fixture (contract test). Plan 04-06 will register `cemadenAdapter` in registry.

## Dimension 8 Validation Requirements

The unknown-severity → `moderate` invariant, the queimada/incendio + estiagem/seca distinction invariant, and the ISO-Z timestamp invariant are this adapter's load-bearing public-safety contracts. Every contract has an explicit unit test; mutations to any of the three must fail the suite. Coverage gate is 100% line + branch (matches P3 bar).
</success_criteria>

<output>
After completion, create `.planning/phases/04-first-two-adapters/04-02-SUMMARY.md` documenting endpoint chosen, schema fields covered, deviations from RESEARCH.md (if any), coverage results, and any wrapper-level gaps surfaced.
</output>
