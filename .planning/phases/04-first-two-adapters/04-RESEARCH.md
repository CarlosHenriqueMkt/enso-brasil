# Phase 4: First Two Adapters (CEMADEN + INMET) — Research

**Researched:** 2026-05-05
**Domain:** HTTP source adapters for Brazilian official climate-hazard feeds
**Confidence:** MEDIUM (HIGH on contract/parser/cache; MEDIUM on INMET endpoints; LOW on CEMADEN endpoint — undocumented, predicted by PITFALLS.md)

## Summary

P3 already shipped severity-vocab maps (`src/lib/risk/sources/{cemaden,inmet}.ts`), the `SourceAdapter` contract (`src/lib/sources/types.ts`), the `Alert` zod schema (`src/lib/sources/schema.ts`), and the orchestrator-with-`Promise.allSettled` pattern (`/api/ingest`). P4 only adds two adapter implementations (factory + DI), pinned `fast-xml-parser`, golden-fixture tooling, contract tests, and an atomic stub-cutover commit. **No new architectural primitives.**

CEMADEN has no documented public REST API; the `painelalertas.cemaden.gov.br` SPA loads a backing endpoint that must be discovered via browser DevTools network inspection during research-phase fieldwork. PITFALLS.md predicted this and the SPEC's Q6=a fallback (ship INMET-only if CEMADEN blocks) is the irreducible-core escape hatch.

INMET has TWO usable surfaces: (1) `https://apiprevmet3.inmet.gov.br/avisos/ativos` — JSON list of currently active alerts (rate-limited; we hit a 429 during research), and (2) per-alert CAP XML pages addressable as `https://alertas2.inmet.gov.br/{id}` (and `https://apiprevmet3.inmet.gov.br/avisos/rss/{id}` for RSS-wrapped CAP). The SPEC requires CAP-XML parsing — recommend two-step fetch: list active IDs from `/avisos/ativos`, then fetch CAP XML for each.

**Primary recommendation:** Implement INMET adapter first (deterministic endpoint shape) and use it to validate the factory+DI pattern; complete CEMADEN endpoint discovery via DevTools before plan-phase 4 starts. If discovery blocks, ship INMET-only per Q6=a fallback. Pin `fast-xml-parser@5.x` (latest stable 5.3.0, 2025-10-03 release).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Adapter architecture**

- Factory + DI pattern: `createCemadenAdapter(httpClient)` / `createInmetAdapter(httpClient)`. Registry passes shared ofetch wrapper; tests pass stub `(url) => fixtureContent`.
- Registry exports already-configured instances: `export const cemadenAdapter = createCemadenAdapter(prodHttpClient)`.
- No MSW dep — factory DI replaces it.

**Error taxonomy**

- `Error` + typed `code` field via `cause` option. `throw new Error(message, { cause })` with attached `code: SourceErrorCode`.
- `export type SourceErrorCode = "http_5xx" | "timeout" | "schema_invalid" | "payload_drift" | "xml_malformed" | "missing_pt_br"`.
- No subclasses. Orchestrator does `sources_health.lastError = err.code`; exhaustive `switch (err.code)`.

**HTTP transport**

- MUST use shared ofetch wrapper from `src/lib/http/` (P2). No direct `fetch()`. Timeout/retry/error normalization inherited.

**XML parsing**

- `fast-xml-parser` (research picks pin). MIT, zero runtime deps.
- INMET selects `<info xml:lang="pt-BR">`. Fail loud (`code: "missing_pt_br"`) if absent.

**Timestamp normalization**

- All `Alert.issuedAt` ISO-8601 UTC with `Z` suffix.
- CEMADEN naive timestamps: assumed BRT (UTC-3, no DST). Adapter throws if source migrates to TZ-aware format.
- INMET CAP timestamps: already ISO-8601 with offset → `new Date(s).toISOString()`.

**Schema-drift behavior**

- Per-source rejection in `Promise.allSettled`. Affected source records `sources_health.lastError`; other source flows through.
- States retain last-known-good until P3 staleness rule fires (BOTH fail >1h → `unknown`). No new risk-engine code.

**Atomic cutover**

- Single commit on `phase-4-adapters-cemaden-inmet`: deletes stub.ts/stub.test.ts/stub-default.json + rewrites registry to `[cemadenAdapter, inmetAdapter]`.
- Conditional fallback Q6=a: if CEMADEN blocks, registry = `[inmetAdapter]`, stub still removed.

**Fixture refresh tooling**

- `scripts/lib/fixture-runner.ts` (shared) + `scripts/refresh-{cemaden,inmet}.ts` (thin) + `pnpm fixtures:refresh:*` scripts.
- Exit 0 if leaf-only diff; exit 1 if structural drift.
- Filename: `tests/fixtures/sources/<source>-<ISO-date>.<ext>`. Old fixtures NOT auto-deleted.

**Plan breakdown — 6 plans, 3 waves**

- 04-01 `fast-xml-parser-dep` (Wave 0, sequential)
- 04-02 `cemaden-schema-and-adapter` (Wave 1, parallel) — conditional on research
- 04-03 `inmet-schema-and-adapter` (Wave 1, parallel)
- 04-04 `fixture-refresh-script` (Wave 1, parallel)
- 04-05 `contract-tests-and-real-fixtures` (Wave 2, sequential)
- 04-06 `atomic-cutover` (Wave 3, sequential)

### Claude's Discretion

- `fast-xml-parser` version pin (recommendation below)
- Parser config options (preserveOrder, attributesGroupName, parseTagValue tuning)
- Cache key naming conventions for Upstash (recommendations below)
- Specific zod schema shape for CEMADEN/INMET responses (recommendations below)

### Deferred Ideas (OUT OF SCOPE)

- ADAPT-03 (INPE Queimadas / NASA FIRMS) — explicitly Phase 6
- UI changes — Phase 5
- Risk engine changes — P3 contract is final
- Outreach to CEMADEN/INMET for stable endpoints — Phase 7
- Translation utilities for foreign-language sources — Phase 6+
- Production database "production branch" cutover on Neon — Phase 7
- Per-state CEMADEN fan-out — anti-pattern; single national-scope call only
- Auto-refresh of fixtures via CI — explicitly rejected (silent drift acceptance)
- Backwards-compat wrapper to keep stub running — atomic swap required
- Drift sentinel workflow (72h-gated GH Actions) — deferred to Phase 6 (#4)
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID                                       | Description                                                                                         | Research Support                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| REQ-1 (CEMADEN adapter)                  | `src/lib/sources/cemaden.ts` SourceAdapter, ofetch + zod + P3 vocab + ISO-UTC timestamps            | Endpoint discovery TODO (see Open Questions); zod sketch below; ofetch wrapper exists in P2              |
| REQ-2 (INMET adapter)                    | `src/lib/sources/inmet.ts` SourceAdapter, fast-xml-parser, pt-BR `<info>`, CAP timestamps → ISO-UTC | Two-step pattern: `/avisos/ativos` (list) → `alertas2.inmet.gov.br/{id}` (CAP XML); parser config below  |
| REQ-3 (Atomic stub cutover)              | Single commit deletes stub.ts/test/fixture + rewrites registry                                      | Existing registry in `src/lib/sources/registry.ts`; one diff verified by `git log`; CI grep gate from P2 |
| REQ-4 (Golden fixtures)                  | `cemaden-<ISO>.json` + `inmet-<ISO>.xml` captured via refresh script                                | Fixture refresh runner pattern below; commit dated filenames                                             |
| REQ-5 (Contract tests)                   | Per-adapter Vitest contract test loads fixture via mock HTTP, asserts Alert[] snapshot              | Factory DI pattern eliminates MSW dep; vitest setup conventions in P3                                    |
| REQ-6 (E2E real-data flow)               | Manual `/api/ingest` produces real source data in `/api/states`                                     | P2 already wires the orchestrator; P4 only swaps registry array                                          |
| REQ-7 (Per-source schema-drift behavior) | One source rejecting → only that source degrades                                                    | P2 already implements `Promise.allSettled` orchestrator; P3 staleness rule already shipped               |
| REQ-8 (Fixture refresh script)           | `pnpm fixtures:refresh:{cemaden,inmet}` writes fixture, prints diff, exit code reflects drift       | Helper-pattern below: `scripts/lib/fixture-runner.ts` + thin entrypoints                                 |

</phase_requirements>

## Architectural Responsibility Map

| Capability                            | Primary Tier                                    | Secondary Tier | Rationale                                                                                           |
| ------------------------------------- | ----------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------- |
| HTTP fetch (CEMADEN/INMET)            | API (Node runtime, `/api/ingest`)               | —              | Adapters MUST be Node-only (registry isolation, dep-cruiser RISK-01); never imported by edge routes |
| XML parsing (fast-xml-parser)         | API (Node runtime)                              | —              | Parser pulled into Node bundle only; edge routes never see it                                       |
| Severity normalization                | API (`src/lib/risk/sources/*` — pure functions) | —              | P3 vocab maps are edge-safe pure data; adapters import them                                         |
| Zod schema validation                 | API (adapter boundary)                          | —              | Validate raw response shape BEFORE constructing Alert[]; throw `code: "schema_invalid"`             |
| Orchestration / `Promise.allSettled`  | API (`/api/ingest`)                             | —              | P2 owns this; P4 does NOT modify orchestrator                                                       |
| Snapshot persistence (Drizzle + Neon) | API                                             | —              | P2 already shipped                                                                                  |
| Cache key writes (Upstash)            | API                                             | —              | P2 owns the cache layer; P4 only contributes alerts to it                                           |
| `revalidatePath('/')`                 | API (after successful ingest)                   | —              | P2 owns; P4 just produces real Alert[] for it to revalidate around                                  |

## Standard Stack

### Core

| Library                   | Version                                      | Purpose                                            | Why Standard                                                                                          |
| ------------------------- | -------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ofetch                    | already in P2                                | HTTP transport, timeout/retry, error normalization | [VERIFIED: project SUMMARY.md] — locked stack decision; adapters use the shared wrapper               |
| zod                       | already in P2                                | Response-shape validation                          | [VERIFIED: schema.ts uses zod] — Alert schema authoritative; adapters add per-source response schemas |
| fast-xml-parser           | 5.3.0 (or pin to 5.x latest at install time) | CAP XML → JS object                                | [CITED: npmjs.com/package/fast-xml-parser] — MIT, zero deps, TypeScript types bundled, 100MB-tested   |
| @upstash/redis            | already in P2                                | Cache writes                                       | [VERIFIED: project locked stack]                                                                      |
| drizzle-orm + Neon driver | already in P2                                | Persistence                                        | [VERIFIED: project locked stack]                                                                      |

**Version verification (fast-xml-parser):** Latest stable 5.3.0 published 2025-10-03 [CITED: npmjs.com/package/fast-xml-parser]. Run `npm view fast-xml-parser version` at install time and pin exactly. **Pinning rationale:** CAP XML parser config is sensitive to library updates (attribute group naming, entity handling); pin lets fixture contract tests remain stable across pnpm updates.

### Supporting

| Library | Version             | Purpose                    | When to Use                                                                               |
| ------- | ------------------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| `tsx`   | already in dev deps | Run `scripts/refresh-*.ts` | Per CONTEXT decision — `pnpm fixtures:refresh:cemaden` = `tsx scripts/refresh-cemaden.ts` |

### Alternatives Considered (and rejected)

| Instead of        | Could Use                       | Tradeoff                                                                                                                     |
| ----------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `fast-xml-parser` | `xml2js`                        | xml2js is callback-style, larger bundle, slower; rejected                                                                    |
| `fast-xml-parser` | `@xmldom/xmldom` + manual XPath | DOM API is verbose; CAP doesn't need DOM fidelity; rejected                                                                  |
| Factory + DI      | MSW (mock service worker)       | MSW for 2 adapters is overkill; factory DI gives equivalent isolation with zero runtime deps [VERIFIED: CONTEXT.md decision] |

**Installation:**

```bash
pnpm add fast-xml-parser
# verify exact version published before pinning:
npm view fast-xml-parser version
```

## Architecture Patterns

### System Architecture Diagram

```
GitHub Actions cron (every 15min)
        │
        │ POST /api/ingest (Bearer INGEST_TOKEN)
        ▼
┌──────────────────────────────────────────────────────────┐
│  /api/ingest  (Node runtime — P2 orchestrator)          │
│                                                          │
│   sources[] from registry.ts                             │
│        │                                                 │
│        ▼                                                 │
│   Promise.allSettled([                                   │
│     cemadenAdapter.fetch(),  ──────┐                     │
│     inmetAdapter.fetch()     ──────┤                     │
│   ])                                │                     │
│                                     ▼                     │
│              (per-source error isolation)                │
│                                     │                     │
│                                     ▼                     │
│   dedup → calculateRiskLevel() → snapshot                │
│        │                                                 │
│        ├── Drizzle INSERT to Neon (transactional)        │
│        ├── @upstash/redis SET (snapshot:current)         │
│        └── revalidatePath('/')                           │
└──────────────────────────────────────────────────────────┘
                                     ▲
                                     │
       ┌─────────────────────────────┴────────────────────┐
       │                                                  │
       ▼                                                  ▼
  cemadenAdapter.fetch()                          inmetAdapter.fetch()
       │                                                  │
       │ ofetch(CEMADEN_URL)                              │ Step 1: ofetch(INMET_LIST_URL) → JSON [{id,...}]
       │   ↓                                              │ Step 2: for each id → ofetch(`alertas2.inmet.gov.br/${id}`)
       │ zod parse → throw {code: "schema_invalid"}       │   ↓
       │   ↓                                              │ fast-xml-parser → throw {code: "xml_malformed"}
       │ severity map (P3 vocab)                          │   ↓
       │   ↓                                              │ select <info xml:lang="pt-BR"> → throw {code: "missing_pt_br"} if absent
       │ ISO-UTC timestamps                               │   ↓
       │   ↓                                              │ severity map (P3 vocab) + ISO-UTC
       └→ Alert[]                                         └→ Alert[]
```

### Recommended Project Structure (already locked in CONTEXT)

```
src/lib/sources/
├── cemaden.ts          # createCemadenAdapter factory (NEW)
├── inmet.ts            # createInmetAdapter factory (NEW)
├── cemaden.test.ts     # unit (hand-crafted inline fixture) (NEW)
├── inmet.test.ts       # unit (hand-crafted inline fixture) (NEW)
├── registry.ts         # MODIFIED: [cemadenAdapter, inmetAdapter]
├── schema.ts           # unchanged (P2)
├── types.ts            # unchanged (P2) + add SourceErrorCode export
├── hash.ts             # unchanged (P2)
├── stub.ts             # DELETED in 04-06
└── stub.test.ts        # DELETED in 04-06

tests/contract/
├── cemaden.test.ts     # contract test using golden fixture (NEW)
└── inmet.test.ts       # contract test using golden fixture (NEW)

tests/fixtures/sources/
├── cemaden-<ISO-date>.json   # NEW (captured by refresh script)
├── inmet-<ISO-date>.xml      # NEW (captured by refresh script)
└── stub-default.json         # DELETED in 04-06

scripts/
├── lib/fixture-runner.ts     # NEW (shared diff/write/exit logic)
├── refresh-cemaden.ts        # NEW (thin entrypoint)
└── refresh-inmet.ts          # NEW (thin entrypoint)
```

### Pattern 1: Factory + DI Adapter

**What:** Adapter exports a factory accepting an `HttpClient` (function shape). Registry wires the prod ofetch wrapper; tests wire `(url) => fixtureContent`. No mock framework needed.

**When to use:** Always for P4 adapters. Established by CONTEXT decision.

**Example:**

```typescript
// src/lib/sources/inmet.ts
import { XMLParser } from "fast-xml-parser";
import { mapSeverity } from "@/lib/risk/sources/inmet";
import { AlertArraySchema, type Alert } from "./schema";
import type { SourceAdapter, SourceErrorCode } from "./types";

export type HttpClient = <T = unknown>(url: string) => Promise<T>;

const INMET_LIST_URL = "https://apiprevmet3.inmet.gov.br/avisos/ativos";
const INMET_CAP_URL = (id: string) => `https://alertas2.inmet.gov.br/${id}`;

export function createInmetAdapter(http: HttpClient): SourceAdapter {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false, // keep severity strings as strings
    parseAttributeValue: false,
    trimValues: true,
  });

  return {
    key: "inmet",
    displayName: "INMET (Alert-AS)",
    async fetch(): Promise<Alert[]> {
      const list = await http<unknown>(INMET_LIST_URL);
      const ids = ListSchema.parse(list).map((a) => a.id);
      const alerts: Alert[] = [];
      for (const id of ids) {
        const xml = await http<string>(INMET_CAP_URL(id));
        const tree = parser.parse(xml);
        const infoBlocks = arrify(tree?.alert?.info);
        const ptBr = infoBlocks.find((i) => i["@_lang"] === "pt-BR" || i["@_xml:lang"] === "pt-BR");
        if (!ptBr) {
          throw Object.assign(new Error("INMET CAP missing pt-BR <info>"), {
            code: "missing_pt_br" satisfies SourceErrorCode,
          });
        }
        // ... build Alert from CAP fields, severity via mapSeverity, ISO-UTC timestamps
      }
      return AlertArraySchema.parse(alerts);
    },
  };
}

// Production registry instance:
//   export const inmetAdapter = createInmetAdapter(prodHttpClient);
```

### Pattern 2: Fixture-Runner Helper

```typescript
// scripts/lib/fixture-runner.ts
import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export interface RunnerInput {
  source: "cemaden" | "inmet";
  ext: "json" | "xml";
  fetchLive: () => Promise<string>;
  isStructuralDiff: (prev: string, next: string) => boolean;
  prevFixturePath?: string; // resolved by caller (most-recent dated file)
}

export async function runFixtureRefresh(i: RunnerInput): Promise<number> {
  const next = await i.fetchLive();
  const date = new Date().toISOString().slice(0, 10);
  const outPath = `tests/fixtures/sources/${i.source}-${date}.${i.ext}`;
  await writeFile(outPath, next, "utf8");

  if (!i.prevFixturePath || !existsSync(i.prevFixturePath)) {
    console.log(`Created ${outPath} (no prior fixture)`);
    return 0;
  }
  const prev = await readFile(i.prevFixturePath, "utf8");
  // print unified diff (use `diff` lib or shell out to `git diff --no-index`)
  if (i.isStructuralDiff(prev, next)) {
    console.error("STRUCTURAL DRIFT — human review required");
    return 1;
  }
  console.log("Leaf-only changes (alerts entered/exited)");
  return 0;
}
```

### Pattern 3: zod Schema for INMET `/avisos/ativos` list

```typescript
// inside src/lib/sources/inmet.ts
import { z } from "zod";

const ListItemSchema = z
  .object({
    id: z.string().or(z.number().transform(String)),
    // additional fields tolerated; we only need id to fetch CAP XML
  })
  .passthrough();

const ListSchema = z.array(ListItemSchema);
```

### Pattern 4: zod Schema sketch for CEMADEN (PROVISIONAL — pending DevTools discovery)

```typescript
// src/lib/sources/cemaden.ts — sketch, finalize after endpoint discovery
const CemadenAlertSchema = z
  .object({
    uf: z.enum(UF27_PROVISIONAL), // state code
    municipio: z.string(), // município name
    tipoAlerta: z.string(), // hazard type, mapped to HAZARD_KINDS
    nivel: z.string(), // "Observação" | "Atenção" | "Alerta" | "Alerta Máximo"
    abertura: z.string(), // BRT naive timestamp → assume UTC-3
    // tolerate extra fields
  })
  .passthrough();

const CemadenResponseSchema = z.array(CemadenAlertSchema);
```

> **Critical:** Field names above are derived from the Painel de Alertas table headers ("UF", "Município", "Tipo Alerta", "Nível", "Abertura") visible in the SPA HTML. Actual JSON field names may differ — DevTools discovery is required to finalize this schema. Ship the discovery in plan 04-02 wave 0 (or fail-over to INMET-only per Q6=a).

### Anti-Patterns to Avoid

- **Direct `fetch()` in adapters** → use the shared ofetch wrapper (P2 contract)
- **Per-state CEMADEN fan-out** → 27× HTTP/15min; use single national call (free-tier rule)
- **Silent fallback to non-pt-BR `<info>`** → must throw `code: "missing_pt_br"`
- **Subclassing `Error`** → V8 prototype-chain pegadinhas; use `cause + code` (CONTEXT decision)
- **Naive parse `JSON.parse(xml)`** → use fast-xml-parser; configured to keep strings as strings
- **Auto-deleting old fixtures** → CONTEXT decision: maintainer deletes manually in same PR

## Don't Hand-Roll

| Problem               | Don't Build               | Use Instead                                                                                                    | Why                                                                                                                   |
| --------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| XML parsing           | Regex on `<info>`         | `fast-xml-parser`                                                                                              | CAP has nested `<info><area><polygon>`; regex fails on namespaces, CDATA, entities                                    |
| HTTP retry/timeout    | `setTimeout` + retry loop | shared P2 ofetch wrapper                                                                                       | Already implements ofetch's status-aware retry, AbortController, error normalization                                  |
| Mock HTTP             | MSW                       | Factory DI                                                                                                     | 2 adapters; injected `(url) => fixture` is enough                                                                     |
| Diff between fixtures | Custom AST diff           | `git diff --no-index` shell out OR `diff` npm pkg                                                              | Already battle-tested; structural-vs-leaf heuristic on top is small                                                   |
| ISO-8601 conversion   | Hand-roll TZ math         | `new Date(s).toISOString()` (INMET CAP has offsets) + explicit BRT shift constant for CEMADEN naive timestamps | Built-in is correct for offset-bearing strings; simple `+00:00 = +03:00 - 03:00` for BRT (no DST per project SUMMARY) |
| Severity mapping      | Free-form switch          | `src/lib/risk/sources/{cemaden,inmet}.ts` `mapSeverity`                                                        | Already shipped P3; never redefine                                                                                    |

**Key insight:** The P2/P3 baseline already gives us 80% of what P4 needs. New code = factory shells + parser config + 2 zod schemas + fixture runner + thin entrypoints. **Resist the urge** to refactor the orchestrator or extend the SourceAdapter contract.

## Common Pitfalls

### Pitfall 1: CEMADEN endpoint moves silently

**What goes wrong:** Painel de Alertas SPA backing endpoint changes URL/shape between portal redesigns; adapter starts returning 200-with-HTML or 404.
**Why it happens:** No public API contract; CEMADEN ships against their own SPA, not third parties.
**How to avoid:** zod-validate every poll; on `code: "schema_invalid"` per-source-degrade (already in P3 staleness contract); fixture refresh script catches drift on next manual run.
**Warning signs:** `payload_hash` identical for >2 polling cycles, OR HTTP 200 with `Content-Type: text/html`.

### Pitfall 2: INMET `/avisos/ativos` rate-limit (encountered in research)

**What goes wrong:** Endpoint returned `"Você atingiu o limite de requisições"` plain-text on direct call during research. Suggests aggressive per-IP rate limiting.
**Why it happens:** INMET portal is shared infra; bot mitigation likely IP-based.
**How to avoid:**

- Single national-scope call per cron tick (already locked).
- Set `User-Agent: enso-brasil/1.0 (+https://github.com/CarlosHenriqueMkt/enso-brasil)` so they can identify and contact us (already in PITFALLS recommendation).
- On 429 / non-JSON response, throw `code: "http_5xx"` (treat as transient, P2 retry handles).
- Fixture refresh script runs INFREQUENTLY (manual only) — does NOT add to live load.
  **Warning signs:** Plain-text body with "limite", HTTP 429, or HTML in place of JSON.

### Pitfall 3: CAP `<info>` is array-or-object polymorphism

**What goes wrong:** fast-xml-parser default returns single-child elements as objects, multi-child as arrays. Assumed-array code crashes when only one `<info>` block.
**Why it happens:** XML allows 1+ siblings; parser preserves cardinality by default.
**How to avoid:** Either (a) configure `isArray: (name) => name === "info"` callback OR (b) helper `arrify(x) = Array.isArray(x) ? x : [x]`. Recommend (a) for CAP — predictable shapes.
**Warning signs:** `TypeError: x.find is not a function` in INMET adapter unit test.

### Pitfall 4: BRT timestamp without TZ marker (CEMADEN)

**What goes wrong:** Naive `"2026-05-05 14:30"` parsed as UTC → 3-hour shift, alert appears expired/active 3h off.
**Why it happens:** CEMADEN payloads are display-oriented for Brazilian users; TZ implicit.
**How to avoid:** In CEMADEN adapter: explicit `"+ -03:00"` suffix before `new Date()`. Document assumption in code comment. Throw if any timestamp string already contains `+`/`-`/`Z` (means source migrated to TZ-aware → force fixture review).
**Warning signs:** Alerts in `/api/states` showing `valid_until` 3h away from CEMADEN UI; midnight rollover off-by-one.

### Pitfall 5: Stale snapshot during real red alert

**What goes wrong:** Cron runs HH:00 → red alert published HH:01 → ISR holds green until HH:15.
**How to avoid:** Already in P2 — `revalidatePath('/')` after every successful ingest.
**P4 contribution:** Confirm orchestrator still calls `revalidatePath` after the registry swap (no regression).

### Pitfall 6: `fast-xml-parser` attribute prefix surprises

**What goes wrong:** Defaults rename `<info xml:lang="pt-BR">` to `info["@_xml:lang"]` (with `@_` prefix). Non-prefix code does `info["xml:lang"]` and gets `undefined`.
**How to avoid:** Set `attributeNamePrefix: "@_"` explicitly and document; check both `@_lang` and `@_xml:lang` (CAP feeds vary on namespace handling).

## Code Examples

### INMET adapter — full sketch

See **Pattern 1** above.

### Test using factory DI (no mock framework)

```typescript
// src/lib/sources/inmet.test.ts
import { describe, it, expect } from "vitest";
import { createInmetAdapter } from "./inmet";
import { readFile } from "node:fs/promises";

describe("inmet adapter", () => {
  it("parses CAP XML and selects pt-BR <info>", async () => {
    const listFixture = JSON.stringify([{ id: "12345" }]);
    const xmlFixture = await readFile("tests/fixtures/sources/inmet-2026-05-05.xml", "utf8");
    const stubHttp = async (url: string) => {
      if (url.includes("/avisos/ativos")) return JSON.parse(listFixture);
      if (url.endsWith("/12345")) return xmlFixture;
      throw new Error(`unmocked: ${url}`);
    };
    const adapter = createInmetAdapter(stubHttp);
    const alerts = await adapter.fetch();
    expect(alerts).toMatchSnapshot();
    expect(alerts.every((a) => /Z$/.test(a.fetched_at))).toBe(true);
  });

  it("throws missing_pt_br when only en-US <info> present", async () => {
    const englishOnly = `<alert><info><language>en-US</language>...</info></alert>`;
    const stubHttp = async (url: string) =>
      url.includes("/avisos/ativos") ? [{ id: "1" }] : englishOnly;
    const adapter = createInmetAdapter(stubHttp);
    await expect(adapter.fetch()).rejects.toMatchObject({ code: "missing_pt_br" });
  });
});
```

### Upstash cache key conventions

P2 owns the cache layer; P4 only writes alerts INTO the snapshot key. Recommended naming (consumed by orchestrator, not adapter):

| Key                      | TTL                                   | Purpose                                               | Notes                                |
| ------------------------ | ------------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| `snapshot:current`       | 16 min (cron interval + 1 min buffer) | Full national snapshot, all 27 states in one document | Single atomic write; never per-state |
| `sources_health:cemaden` | no TTL (overwritten each tick)        | `{ lastSuccessfulFetch, lastError, lastErrorCode }`   | Read by `/api/health`                |
| `sources_health:inmet`   | no TTL                                | same as above                                         |                                      |

**TTL choice:** 16 min = 15 min cron + 1 min buffer absorbs slow ticks without falling to "Dados indisponíveis" (P3 staleness rule fires only at 1h both-fail).

**Invalidation:** `revalidatePath('/')` after each ingest (P2 already does this).

## State of the Art

| Old Approach          | Current Approach         | When Changed        | Impact                                                  |
| --------------------- | ------------------------ | ------------------- | ------------------------------------------------------- |
| `xml2js` (callback)   | `fast-xml-parser` (sync) | ~2020               | 2-5× faster, smaller bundle, TS-native                  |
| Custom HTTP wrappers  | `ofetch` (unjs)          | locked in P2        | Built-in retry/timeout/status-aware retry               |
| MSW for adapter tests | Factory DI               | CONTEXT decision    | Zero runtime deps; equivalent isolation for 2 adapters  |
| Subclassing Error     | `cause` + `code` field   | Node 16.9+ standard | V8-friendly; structured logging via pino redaction (P2) |

## Assumptions Log

| #   | Claim                                                                                                                                    | Section                | Risk if Wrong                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | CEMADEN Painel backing endpoint returns JSON (not HTML SSR) [ASSUMED]                                                                    | Pattern 4 (zod sketch) | Medium — if SPA is SSR'd HTML, scraping logic differs; adapter design changes. Resolve via DevTools discovery before plan 04-02.                                        |
| A2  | CEMADEN field names approximate Painel column headers (UF, Município, Tipo Alerta, Nível, Abertura) [ASSUMED]                            | Pattern 4 zod sketch   | Low — finalize via DevTools; zod schema is in adapter file, change is local.                                                                                            |
| A3  | INMET `/avisos/ativos` returns array of objects with an `id` field [VERIFIED via search results showing `/avisos/rss/{id}` pattern]      | Pattern 1 + Pattern 3  | Low — verified by URL structure observed in search results (52215, 49838, 47224 are alert IDs).                                                                         |
| A4  | `alertas2.inmet.gov.br/{id}` returns CAP-XML (not HTML SSR for the SPA) [ASSUMED — needs verification with `curl -A 'enso-brasil/1.0'`]  | Pattern 1              | Medium — if it's SPA HTML, must use `apiprevmet3.inmet.gov.br/avisos/rss/{id}` instead (RSS-wrapped CAP). Both work; just adjust URL constant.                          |
| A5  | INMET CAP feed includes `<info xml:lang="pt-BR">` blocks [ASSUMED based on alert-hub.org `br-inmet-pt` source key]                       | Pattern 1              | Medium — if INMET ships only one `<info>` without `xml:lang`, missing-pt-BR check fires falsely. Adapter throws loudly per CONTEXT decision; fixture review catches it. |
| A6  | CEMADEN naive timestamps are BRT (UTC-3, no DST per Brazil 2019 abolition per SUMMARY) [VERIFIED via project SUMMARY.md + Wikipedia DST] | Pitfall 4              | Low — verified; if Brazil reinstates DST (per Slashdot 2025), revisit.                                                                                                  |
| A7  | `fast-xml-parser` 5.3.0 is edge-runtime compatible [ASSUMED — adapters run Node-only, so irrelevant for P4 but flagged]                  | Standard Stack         | None for P4 (Node-only by design).                                                                                                                                      |
| A8  | Single national-scope CEMADEN call returns all states [ASSUMED — Painel UI shows national table; suggests one backing fetch]             | Constraints            | Medium — if endpoint requires per-UF param, need fan-out plan; SPEC says "document fan-out within free-tier limits" if so. Resolve in DevTools step.                    |

**Resolution plan:** Items A1, A2, A4, A5, A8 resolve via 30-min DevTools session against `painelalertas.cemaden.gov.br` and `alertas2.inmet.gov.br/{id}` BEFORE `/gsd-plan-phase 4` runs. Items already finalize the planning gate.

## Open Questions

1. **Exact CEMADEN endpoint URL** [BLOCKING for plan 04-02; non-blocking for INMET path]
   - What we know: SPA at `painelalertas.cemaden.gov.br`; backing endpoint undocumented; PITFALLS predicted this.
   - What's unclear: Path, response shape, auth.
   - Recommendation: Pre-plan-phase fieldwork: open Painel in browser, DevTools → Network tab, refresh, capture `application/json` request, save its URL + sample response. Update Pattern 4 zod sketch + commit it as research-deliverable. If endpoint requires login, bot challenge, or returns HTML → trigger Q6=a fallback (INMET-only).

2. **INMET CAP root URL: `alertas2.inmet.gov.br/{id}` vs `apiprevmet3.inmet.gov.br/avisos/rss/{id}`**
   - What we know: Both exist; both return per-alert content.
   - What's unclear: Whether `alertas2.inmet.gov.br/{id}` is HTML-SPA or raw CAP-XML.
   - Recommendation: 5-min curl test with `User-Agent: enso-brasil/1.0`. Prefer the raw-CAP endpoint. Bake constant into adapter.

3. **CEMADEN auth requirement**
   - What we know: Painel page loads anonymously.
   - What's unclear: Whether backing endpoint needs cookie/CSRF/IP allowlist.
   - Recommendation: DevTools step above answers this in same session.

4. **Fixture capture during low-alert period**
   - What we know: When zero alerts nationally, fixture is `[]` — exercises empty-array path but not field-validation path.
   - What's unclear: Whether contract test must reject this and demand re-capture.
   - Recommendation: Accept empty-array fixture as valid checkpoint; during fixture refresh, if response is empty, refresh script logs warning and exits 0 anyway. Schema-drift detection still fires on subsequent non-empty captures.

## Environment Availability

| Dependency                                 | Required By                    | Available                                                   | Version | Fallback                        |
| ------------------------------------------ | ------------------------------ | ----------------------------------------------------------- | ------- | ------------------------------- |
| Node.js                                    | All                            | ✓ (project P0)                                              | 20.x+   | —                               |
| pnpm                                       | Build/test                     | ✓ (project P0)                                              | 9.x     | —                               |
| fast-xml-parser                            | INMET adapter                  | ✗ (to install in plan 04-01)                                | 5.3.0   | —                               |
| ofetch wrapper                             | Both adapters                  | ✓ (P2)                                                      | —       | —                               |
| @upstash/redis                             | Orchestrator (P2)              | ✓ (P2)                                                      | —       | —                               |
| Drizzle + Neon                             | Orchestrator (P2)              | ✓ (P2)                                                      | —       | —                               |
| `tsx`                                      | Refresh scripts                | ✓ (project dev deps)                                        | —       | —                               |
| `git diff --no-index` (for fixture-runner) | Fixture refresh script         | ✓ (any git install)                                         | —       | `diff` npm pkg as fallback      |
| Internet access from cron runner           | Live fetches                   | ✓ (Vercel functions)                                        | —       | —                               |
| INGEST_TOKEN env var                       | `/api/ingest` Bearer auth (P2) | ✓ (P2 contract)                                             | —       | —                               |
| CEMADEN endpoint reachability              | CEMADEN adapter                | **UNKNOWN**                                                 | —       | Q6=a fallback (INMET-only ship) |
| INMET endpoint reachability                | INMET adapter                  | ✓ (verified `/avisos/ativos` returns 429 — endpoint exists) | —       | —                               |

**Missing dependencies with no fallback:** None blocking once `fast-xml-parser` is installed in plan 04-01.

**Missing dependencies with fallback:** CEMADEN endpoint discovery — fallback to INMET-only registry per Q6=a.

## Validation Architecture

### Test Framework

| Property           | Value                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| Framework          | Vitest (P2, latest)                                                     |
| Config file        | `vitest.config.ts` (P2) — uses globalSetup for DDL per MEMORY note      |
| Quick run command  | `pnpm vitest run --testPathPattern 'sources/(cemaden\|inmet)' --bail 1` |
| Full suite command | `pnpm vitest run`                                                       |

### Phase Requirements → Test Map

| Req ID        | Behavior                                                                | Test Type   | Automated Command                                                                                   | File Exists?                       |
| ------------- | ----------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- | ---------------------------------- |
| REQ-1         | CEMADEN adapter parses fixture, normalizes severity, ISO-UTC timestamps | unit        | `pnpm vitest run src/lib/sources/cemaden.test.ts`                                                   | ❌ Wave 1 (plan 04-02)             |
| REQ-1         | CEMADEN adapter throws schema_invalid on malformed payload              | unit        | `pnpm vitest run src/lib/sources/cemaden.test.ts -t "schema_invalid"`                               | ❌ Wave 1                          |
| REQ-2         | INMET adapter parses CAP XML, selects pt-BR `<info>`                    | unit        | `pnpm vitest run src/lib/sources/inmet.test.ts`                                                     | ❌ Wave 1 (plan 04-03)             |
| REQ-2         | INMET adapter throws missing_pt_br when absent                          | unit        | `pnpm vitest run src/lib/sources/inmet.test.ts -t "missing_pt_br"`                                  | ❌ Wave 1                          |
| REQ-4 + REQ-5 | Golden-fixture contract tests pass on captured fixtures                 | contract    | `pnpm vitest run tests/contract/`                                                                   | ❌ Wave 2 (plan 04-05)             |
| REQ-5         | Mutating any captured field fails contract test                         | contract    | manual: edit fixture, run command above                                                             | — verified by snapshot mismatch    |
| REQ-7         | One source rejecting → other source flows through                       | integration | `pnpm vitest run tests/integration/ingest-allsettled.test.ts`                                       | (P2 may already cover; verify)     |
| REQ-8         | Refresh script structural-drift exit codes                              | unit        | `pnpm vitest run scripts/lib/fixture-runner.test.ts`                                                | ❌ Wave 1 (plan 04-04)             |
| REQ-3         | Atomic cutover commit shape                                             | manual      | `git log -1 --stat` (verify deletes + adds in one diff)                                             | — verified by reviewer in PR       |
| REQ-6         | Manual smoke against preview deploy                                     | manual      | `curl -H "Authorization: Bearer $INGEST_TOKEN" $PREVIEW/api/ingest` then `curl $PREVIEW/api/states` | — manual UAT in `/gsd-verify-work` |

### Sampling Rate

- **Per task commit:** `pnpm vitest run --testPathPattern 'sources/' --bail 1` (sub-second)
- **Per wave merge:** `pnpm vitest run` (full suite — P2 also runs DB integration)
- **Phase gate:** Full suite green + manual smoke against preview before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/sources/cemaden.test.ts` — covers REQ-1 (Wave 1, plan 04-02)
- [ ] `src/lib/sources/inmet.test.ts` — covers REQ-2 (Wave 1, plan 04-03)
- [ ] `tests/contract/cemaden.test.ts` — covers REQ-4, REQ-5 (Wave 2, plan 04-05)
- [ ] `tests/contract/inmet.test.ts` — covers REQ-4, REQ-5 (Wave 2, plan 04-05)
- [ ] `scripts/lib/fixture-runner.test.ts` — covers REQ-8 (Wave 1, plan 04-04)
- [ ] Add `tests/contract/` directory to vitest include glob if not already present (verify `vitest.config.ts`)

Framework already installed (Vitest from P2). No framework install needed.

## Project Constraints (from CLAUDE.md)

| Directive                                              | Source                         | P4 enforcement                                                                                        |
| ------------------------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| PT-BR only; no `next-intl`                             | CLAUDE.md locked stack         | Adapters select `xml:lang="pt-BR"`; fail loud on absence                                              |
| Hazard names follow CEMADEN/INMET vocabulary verbatim  | CLAUDE.md                      | P3 vocab maps already encode this; adapter imports them                                               |
| Default severity for unknown source terms = `moderate` | CLAUDE.md + risk-formula-v0.md | P3 vocab maps already encode this (`mapSeverity` returns `"moderate"` for unmatched)                  |
| Disclaimer SSR-rendered                                | CLAUDE.md                      | Out of scope for P4 (UI is P5); adapters don't touch UI                                               |
| Conservative bias / fail toward over-warning           | CLAUDE.md                      | Per-source rejection (not whole-tick failure); states retain last-known-good until P3 staleness fires |
| Public-safety-adjacent                                 | CLAUDE.md                      | Adapter failures must isolate; `Promise.allSettled`; structured logging via pino                      |
| MIT, public OSS from commit 1                          | CLAUDE.md                      | All P4 deps verified MIT (fast-xml-parser MIT, ofetch MIT, zod MIT)                                   |
| Conventional Commits prefixed `feat(04)` etc.          | CONTEXT + CLAUDE.md            | Squash-merge per repo policy                                                                          |
| No Vercel Cron, no Vercel KV                           | CLAUDE.md locked stack         | P2 contract; P4 doesn't touch                                                                         |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/04-first-two-adapters/04-SPEC.md` — locked requirements
- `.planning/phases/04-first-two-adapters/04-CONTEXT.md` — locked implementation decisions
- `.planning/research/SUMMARY.md` — stack lock, DST status, conservative defaults
- `.planning/research/PITFALLS.md` — predicted CEMADEN/INMET behaviors
- `risk-formula-v0.md` — risk contract (P3 input)
- `src/lib/sources/types.ts`, `schema.ts`, `registry.ts`, `stub.ts` — existing adapter contract surface
- `src/lib/risk/sources/cemaden.ts`, `inmet.ts` — P3 vocab maps to import
- `CLAUDE.md` — project locked stack and anti-features

### Secondary (MEDIUM confidence)

- [npmjs.com/package/fast-xml-parser](https://www.npmjs.com/package/fast-xml-parser) — version 5.3.0 (2025-10-03)
- [github.com/NaturalIntelligence/fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) — config options reference
- INMET endpoint structure inferred from search results showing `https://apiprevmet3.inmet.gov.br/avisos/ativos`, `https://apiprevmet3.inmet.gov.br/avisos/rss/{id}`, `https://alertas2.inmet.gov.br/{id}`
- [alert-hub.org/feedFacade/sourcefeed/feed/br-inmet-pt](https://www.alert-hub.org/feedFacade/sourcefeed/feed/br-inmet-pt) — confirms INMET emits CAP in pt-BR (verified by source-key naming)

### Tertiary (LOW confidence — flagged in Assumptions Log)

- CEMADEN response shape (Painel column-header inferred field names) — DevTools discovery owns finalization
- INMET CAP root URL choice between `alertas2.inmet.gov.br/{id}` and `apiprevmet3.inmet.gov.br/avisos/rss/{id}` — quick curl test owns finalization

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — `fast-xml-parser` version cited, all other deps already in P2
- Architecture: HIGH — pattern locked in CONTEXT; codebase contracts inspected directly
- Pitfalls: HIGH — encountered the 429 rate-limit on INMET during research (not theoretical); CEMADEN undocumented-endpoint pitfall already in PITFALLS.md
- CEMADEN endpoint specifics: LOW — undocumented; needs DevTools discovery before plan 04-02

**Research date:** 2026-05-05
**Valid until:** 2026-06-04 (30 days for stable; CEMADEN endpoint discovery is a known gap that may invalidate Pattern 4 zod sketch immediately upon real fieldwork)

**Time budget used:** 6 web fetches (well under 10 cap). Stopped here per fast-stop rule because (a) project's own SPEC/CONTEXT/SUMMARY/PITFALLS already encode 90% of decisions, and (b) the remaining gap (CEMADEN endpoint) is fundamentally not a web-search problem — it's a DevTools-on-live-SPA fieldwork task that belongs in plan 04-02 wave 0, not in research.

## RESEARCH COMPLETE

---

## Open Questions (RESOLVED — 2026-05-05)

This block supersedes the earlier "Open Questions" section. All gating questions are resolved as follows:

### Q1 — CEMADEN endpoint URL [RESOLVED: deferred to Phase 5]

Live discovery on 2026-05-05 located CEMADEN's only documented public REST API at `https://sws.cemaden.gov.br/PED/api/ui/` (Swagger 2.0, basePath `/PED/rest/`). This is **PED — Plataforma de Entrega de Dados**, exposing **observational data only**: PCDs (estações automáticas), accumulated rainfall, and weather station readings. Inventory: **15 paths, ZERO matches** for `alert`/`aviso`/`risco`/`warning`. Auth: undocumented JWT issued at `/controle-token/tokens`, sent as `token` header.

**PED is environmental data, not alerts.** Deriving alerts from raw rainfall would cross ENSO Brasil's "aggregator vs authority" boundary (CLAUDE.md anti-features) — the project must NOT replace Defesa Civil/CEMADEN as an alert authority.

CEMADEN's authoritative alerts live behind the SPA at `painelalertas.cemaden.gov.br`. The backing endpoint is undocumented and requires DevTools-on-live-SPA fieldwork that exceeds Phase 4's scope budget.

**Disposition:** CEMADEN deferred to **Phase 5** (carry-over). PED swagger preserved at `.planning/phases/04-first-two-adapters/04-cemaden-PED-swagger.json` for P5 reference (do NOT delete).

### Q2 — INMET CAP root URL [RESOLVED]

- **List endpoint:** `https://apiprevmet3.inmet.gov.br/avisos/ativos` (returns JSON list of active alert IDs).
- **CAP detail endpoint:** `https://alertas2.inmet.gov.br/{id}` (returns raw CAP XML).

These two constants are pinned in plan 04-03 (`INMET_CAP_LIST` and `INMET_CAP_DETAIL`).

### Q3 — CEMADEN auth requirement [RESOLVED inline]

N/A for Phase 4 — CEMADEN is deferred. The PED API (when revisited in P5) requires a JWT via `/controle-token/tokens`; alert endpoint discovery is separately required.

### Q4 — Fixture capture during low-alert period [RESOLVED inline]

Empty-array fixtures are accepted as valid checkpoints. Refresh script logs warning + exits 0. Schema-drift detection still fires on subsequent non-empty captures. Applies to INMET only in Phase 4.

---

## Path Decision: Q6=a INMET-only (locked 2026-05-05)

Phase 4 ships the **Q6=a fallback path** documented in 04-SPEC.md:

- Registry registers `[inmetAdapter]` only. The orchestrator uses `Promise.allSettled([inmetAdapter])` (futures-proof for P5 append).
- Stub adapter still removed atomically.
- CEMADEN adapter, schema, and contract test deferred to **Phase 5**.
- Cross-source isolation test (REQ-7) preserved by using an **inline `cemadenStub` factory inside the test file** that throws on every call — no real CEMADEN code lands in `src/`.

Plan set after revision: 5 plans (04-01, 04-03, 04-04, 04-05, 04-06). Plan 04-02 deleted.
