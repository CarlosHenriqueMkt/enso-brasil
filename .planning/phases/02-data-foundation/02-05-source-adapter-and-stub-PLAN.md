---
phase: 02-data-foundation
plan: 05
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/lib/sources/types.ts
  - src/lib/sources/schema.ts
  - src/lib/sources/registry.ts
  - src/lib/sources/stub.ts
  - src/lib/sources/stub.test.ts
  - src/lib/sources/schema.test.ts
  - tests/fixtures/sources/stub-default.json
  - tests/fixtures/sources/all-red.json
  - tests/fixtures/sources/README.md
autonomous: true
requirements:
  - REQ-S2.04
  - REQ-S2.05
  - REQ-S2.09
  - DATA-04
  - DATA-08

must_haves:
  truths:
    - "src/lib/sources/types.ts defines SourceAdapter interface with key/displayName/fetch() per REQ-S2.04"
    - "src/lib/sources/registry.ts exports a flat sources array; adding a 3rd source = single append"
    - "src/lib/sources/stub.ts implements SourceAdapter; default loads tests/fixtures/sources/stub-default.json (3 alerts SP/RJ/AM); STUB_FIXTURE_PATH env override works"
    - "src/lib/sources/schema.ts exports AlertSchema (zod 4) with payload_hash deterministic SHA256 of canonical normalized fields"
    - "Concrete adapter imports (Stub/Cemaden/Inmet) appear ONLY in registry.ts — verified via grep across src/lib + src/app"
    - "Invalid fixture throws zod error BEFORE persistence (REQ-S2.05 acceptance)"
  artifacts:
    - path: "src/lib/sources/types.ts"
      provides: "interface SourceAdapter { key: string; displayName: string; fetch(): Promise<Alert[]>; } + Alert type re-export"
      contains: "SourceAdapter"
    - path: "src/lib/sources/schema.ts"
      provides: "AlertSchema = z.object({...}); computePayloadHash(alert): string (sha256 over canonical JSON of normalized fields)"
      contains: "z.object"
    - path: "src/lib/sources/registry.ts"
      provides: "import { stubAdapter } from './stub'; export const sources: SourceAdapter[] = [stubAdapter]"
      contains: "sources: SourceAdapter[]"
    - path: "src/lib/sources/stub.ts"
      provides: "stubAdapter: SourceAdapter; loads fixture from STUB_FIXTURE_PATH ?? 'tests/fixtures/sources/stub-default.json'; validates via AlertSchema.array().parse()"
      contains: "STUB_FIXTURE_PATH"
    - path: "tests/fixtures/sources/stub-default.json"
      provides: "3 Alert objects: SP queimada, RJ enchente, AM estiagem; all valid"
      contains: '"state_uf"'
    - path: "tests/fixtures/sources/all-red.json"
      provides: "27 Alert objects (one per UF) with severity='extreme'; for ingest stress fixtures"
    - path: "tests/fixtures/sources/README.md"
      provides: "Documents fixture schema + how to author new fixtures + lists STUB_FIXTURE_PATH usage"
  key_links:
    - from: "src/lib/sources/stub.ts"
      to: "ofetch wrapper"
      via: "MUST NOT use raw fetch — use httpGet from src/lib/http/fetcher.ts when fetching remote (stub uses fs only, so direct fetch is N/A)"
      pattern: "(no raw fetch in src/lib/sources/**)"
    - from: "src/lib/sources/registry.ts"
      to: "concrete adapters"
      via: "import"
      pattern: "from \"\\./stub\""
---

<objective>
Implement the SourceAdapter interface, the registry pattern (REQ-S2.04), the Alert zod schema with payload-hash (REQ-S2.09), and the deterministic stub adapter (REQ-S2.05). All four together form the abstraction the orchestrator (plan 02-08) iterates over with `Promise.allSettled`.

Purpose: Locks the contract that future real adapters (CEMADEN, INMET — phase 4) implement. Adding a new source MUST be a single registry append + one new file under src/lib/sources/ — no orchestrator changes. Stub uses local file I/O (no network), so doesn't exercise httpGet directly, but the no-raw-fetch rule applies to all future adapters.
Output: 4 source files + 2 test files + 2 fixtures + README.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-data-foundation/02-SPEC.md
@.planning/phases/02-data-foundation/02-CONTEXT.md
@.planning/phases/02-data-foundation/02-RESEARCH.md
@.planning/phases/02-data-foundation/02-02-SUMMARY.md
@.planning/phases/02-data-foundation/02-03-SUMMARY.md
@src/lib/messages.ts

<interfaces>
SPEC REQ-S2.04 — SourceAdapter:
  interface SourceAdapter { key: string; displayName: string; fetch(): Promise<Alert[]>; }
  registry.ts: export const sources: SourceAdapter[] = [...]
  Acceptance: grep concrete adapter imports outside registry.ts → 0 matches

SPEC REQ-S2.05 — Stub:
Default fixture: tests/fixtures/sources/stub-default.json — 3 Alert: SP/RJ/AM with hazard kinds queimada/enchente/estiagem
Override: STUB_FIXTURE_PATH (resolved relative to repo root)
Validation: AlertSchema.array().parse() before return

SPEC REQ-S2.09 — payload_hash:
Deterministic SHA256 of canonical JSON of normalized fields
Same hash twice → dedup (one row in alerts)
Drift detection wired in plan 02-08 ingest

Alert schema (derived from REQ-S2.01 alerts table):
source_key: string non-empty
hazard_kind: enum from CEMADEN/INMET vocabulary (CLAUDE.md: queimada/incêndio, estiagem/seca, enchente/inundação) — for P2 stub use literal set ['queimada','enchente','estiagem']
state_uf: 2-char UF (use UF27 enum exported from plan 02-06 — for P2-stub time-of-write, redefine here as inline enum; plan 02-06 will own the canonical UF27)
severity: enum from messages.severity keys: 'green'|'yellow'|'orange'|'red'|'unknown' (mapped to authority severity verbatim per CLAUDE.md)
headline: string non-empty
body: string optional
source_url: url optional
fetched_at: ISO datetime string
valid_from: ISO datetime optional
valid_until: ISO datetime optional
payload_hash: string sha256 hex (64 chars) — computed via computePayloadHash before validation
raw: unknown (jsonb passthrough)

NOTE on UF27: defined inline here as a temporary const; plan 02-06 makes it the canonical export and stub.ts will refactor to import from there. Acceptable since plan 02-06 is wave 3 and depends on this plan's surface being present.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: SourceAdapter interface + Alert zod schema + payload_hash util + tests</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-SPEC.md (REQ-S2.04, REQ-S2.05, REQ-S2.09)
    - .planning/phases/02-data-foundation/02-CONTEXT.md (Implementation Notes — fixture canonical schema)
    - src/lib/messages.ts (severity keys)
    - CLAUDE.md (hazard vocabulary lock)
  </read_first>
  <behavior>
    - AlertSchema accepts a fully-shaped object and rejects missing required fields with zod error
    - computePayloadHash(alert) returns identical hex for two equivalent alerts and different hex for one differing field
    - Hash is deterministic across runs (canonical JSON ordering)
  </behavior>
  <files>src/lib/sources/types.ts, src/lib/sources/schema.ts, src/lib/sources/schema.test.ts</files>
  <action>
    1. Write `src/lib/sources/schema.ts`:
       ```ts
       import { z } from "zod";
       import { createHash } from "node:crypto";

       export const HAZARD_KINDS = ["queimada", "enchente", "estiagem", "incendio", "inundacao", "seca"] as const;
       export const SEVERITIES = ["green", "yellow", "orange", "red", "unknown"] as const;
       // Provisional UF27 — canonical export moves to src/lib/api/schemas.ts (plan 02-06).
       export const UF27_PROVISIONAL = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;

       export const AlertSchema = z.object({
         source_key: z.string().min(1),
         hazard_kind: z.enum(HAZARD_KINDS),
         state_uf: z.enum(UF27_PROVISIONAL),
         severity: z.enum(SEVERITIES),
         headline: z.string().min(1),
         body: z.string().optional(),
         source_url: z.string().url().optional(),
         fetched_at: z.string().datetime(),
         valid_from: z.string().datetime().optional(),
         valid_until: z.string().datetime().optional(),
         payload_hash: z.string().regex(/^[a-f0-9]{64}$/, "payload_hash must be 64-char hex sha256"),
         raw: z.unknown(),
       });

       export type Alert = z.infer<typeof AlertSchema>;
       export const AlertArraySchema = AlertSchema.array();

       /** Canonical JSON: keys sorted recursively. Stable across Node versions. */
       function canonicalize(value: unknown): unknown {
         if (Array.isArray(value)) return value.map(canonicalize);
         if (value && typeof value === "object") {
           const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
           const out: Record<string, unknown> = {};
           for (const k of sortedKeys) out[k] = canonicalize((value as Record<string, unknown>)[k]);
           return out;
         }
         return value;
       }

       /**
        * Compute deterministic SHA256 over the normalized fields that define alert identity.
        * Excludes payload_hash itself + raw (raw is upstream-shaped and may vary trivially).
        */
       export function computePayloadHash(alert: Omit<Alert, "payload_hash" | "raw"> & { raw?: unknown }): string {
         const normalized = {
           source_key: alert.source_key,
           hazard_kind: alert.hazard_kind,
           state_uf: alert.state_uf,
           severity: alert.severity,
           headline: alert.headline,
           body: alert.body ?? null,
           source_url: alert.source_url ?? null,
           valid_from: alert.valid_from ?? null,
           valid_until: alert.valid_until ?? null,
         };
         const json = JSON.stringify(canonicalize(normalized));
         return createHash("sha256").update(json).digest("hex");
       }
       ```

    2. Write `src/lib/sources/types.ts`:
       ```ts
       import type { Alert } from "./schema";
       export type { Alert };

       export interface SourceAdapter {
         readonly key: string;
         readonly displayName: string;
         fetch(): Promise<Alert[]>;
       }
       ```

    3. Write `src/lib/sources/schema.test.ts`:
       ```ts
       import { describe, it, expect } from "vitest";
       import { AlertSchema, computePayloadHash } from "./schema";

       const valid = {
         source_key: "stub",
         hazard_kind: "queimada" as const,
         state_uf: "SP" as const,
         severity: "yellow" as const,
         headline: "Foco de queimada detectado",
         body: "Long body",
         source_url: "https://example.test/x",
         fetched_at: new Date().toISOString(),
         valid_from: new Date().toISOString(),
         valid_until: new Date(Date.now() + 3600_000).toISOString(),
         payload_hash: "a".repeat(64),
         raw: { foo: 1 },
       };

       describe("AlertSchema", () => {
         it("accepts a complete valid Alert", () => {
           expect(() => AlertSchema.parse(valid)).not.toThrow();
         });
         it("rejects missing required field (REQ-S2.09 zod gate)", () => {
           // @ts-expect-error testing runtime rejection
           expect(() => AlertSchema.parse({ ...valid, headline: undefined })).toThrow();
         });
         it("rejects bad UF", () => {
           expect(() => AlertSchema.parse({ ...valid, state_uf: "ZZ" })).toThrow();
         });
         it("rejects non-hex payload_hash", () => {
           expect(() => AlertSchema.parse({ ...valid, payload_hash: "not-hex" })).toThrow();
         });
       });

       describe("computePayloadHash", () => {
         const base = { ...valid };
         delete (base as Partial<typeof base>).payload_hash;
         delete (base as Partial<typeof base>).raw;
         it("is deterministic across calls", () => {
           expect(computePayloadHash(base as never)).toBe(computePayloadHash(base as never));
         });
         it("differs when a normalized field changes", () => {
           const a = computePayloadHash(base as never);
           const b = computePayloadHash({ ...(base as never), severity: "red" });
           expect(a).not.toBe(b);
         });
         it("ignores `raw` field for stability", () => {
           const a = computePayloadHash(base as never);
           const b = computePayloadHash({ ...(base as never), raw: { whatever: Math.random() } });
           expect(a).toBe(b);
         });
         it("returns 64-char hex", () => {
           expect(computePayloadHash(base as never)).toMatch(/^[a-f0-9]{64}$/);
         });
       });
       ```

    4. Run `pnpm test src/lib/sources/schema.test.ts`. Expect 8/8 pass.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm test src/lib/sources/schema.test.ts && grep -c "interface SourceAdapter" src/lib/sources/types.ts && grep -c "z.object" src/lib/sources/schema.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test src/lib/sources/schema.test.ts` exits 0 with 8 passing tests
    - `grep -c "interface SourceAdapter" src/lib/sources/types.ts` returns 1
    - `grep -c "key: string" src/lib/sources/types.ts` returns 1
    - `grep -c "fetch(): Promise<Alert\\[\\]>" src/lib/sources/types.ts` returns 1
    - `grep -c "AlertSchema" src/lib/sources/schema.ts` returns >= 1
    - `grep -c "computePayloadHash" src/lib/sources/schema.ts` returns >= 1
    - `grep -c "createHash(\"sha256\")" src/lib/sources/schema.ts` returns 1
  </acceptance_criteria>
  <done>SourceAdapter contract + Alert schema + deterministic payload-hash all exist with full unit coverage.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Stub adapter + fixtures + registry + adapter-isolation grep gate</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-SPEC.md (REQ-S2.04, REQ-S2.05)
    - .planning/phases/02-data-foundation/02-CONTEXT.md (Implementation Notes — fixture canonical schema)
  </read_first>
  <behavior>
    - stubAdapter.fetch() with no STUB_FIXTURE_PATH returns 3 alerts with state_uf in [SP, RJ, AM]
    - Setting STUB_FIXTURE_PATH=tests/fixtures/sources/all-red.json returns 27 alerts
    - Invalid fixture (e.g., missing headline) throws zod error before any persistence (caller sees the error)
    - registry.ts contains the only concrete adapter import in the codebase
  </behavior>
  <files>src/lib/sources/stub.ts, src/lib/sources/stub.test.ts, src/lib/sources/registry.ts, tests/fixtures/sources/stub-default.json, tests/fixtures/sources/all-red.json, tests/fixtures/sources/README.md</files>
  <action>
    1. Write `tests/fixtures/sources/stub-default.json` — array of 3 Alert objects (SP queimada, RJ enchente, AM estiagem). Each must have computed payload_hash. Use a one-off Node script (in the action description, not committed) to compute hashes:
       ```
       node -e 'const {computePayloadHash} = require("./dist-or-direct"); console.log(computePayloadHash({source_key:"stub",hazard_kind:"queimada",state_uf:"SP",severity:"yellow",headline:"...",fetched_at:"2026-05-01T00:00:00.000Z"}))'
       ```
       Or simpler: write fixtures with payload_hash="<placeholder>" and include a build-step note that stub.ts re-computes payload_hash for fixtures whose hash starts with "GEN_". Decision: use real precomputed hashes — author by running `pnpm tsx tests/fixtures/sources/regen.ts` (a tiny script you create alongside, NOT committed as part of build pipeline). To keep this self-contained: in the fixture file, set fetched_at to a fixed ISO string, severity/headline/etc. fixed, and set payload_hash to the actual sha256 you compute manually using the algorithm in schema.ts. EXAMPLE precomputed:
       ```json
       [
         {
           "source_key": "stub",
           "hazard_kind": "queimada",
           "state_uf": "SP",
           "severity": "yellow",
           "headline": "Foco de queimada detectado em zona rural",
           "body": "Stub fixture — não use em produção.",
           "source_url": "https://stub.example/sp/queimada",
           "fetched_at": "2026-05-01T00:00:00.000Z",
           "valid_from": "2026-05-01T00:00:00.000Z",
           "valid_until": "2026-05-01T06:00:00.000Z",
           "payload_hash": "<COMPUTE_AT_AUTHOR_TIME>",
           "raw": { "stub": true, "uf": "SP" }
         },
         { ...RJ enchente orange... },
         { ...AM estiagem red... }
       ]
       ```
       To avoid manual hash computation drift: STUB.TS validates fixtures with AlertSchema (which checks hex shape but NOT correctness of hash vs payload). Acceptable: stub.ts trusts the fixture's payload_hash as-stored. **Author the fixture by running this one-liner once at fixture creation time** and pasting the output:
       ```
       pnpm tsx -e "import('./src/lib/sources/schema').then(({computePayloadHash})=>{const a={source_key:'stub',hazard_kind:'queimada',state_uf:'SP',severity:'yellow',headline:'Foco de queimada detectado em zona rural',body:'Stub fixture — não use em produção.',source_url:'https://stub.example/sp/queimada',fetched_at:'2026-05-01T00:00:00.000Z',valid_from:'2026-05-01T00:00:00.000Z',valid_until:'2026-05-01T06:00:00.000Z'};console.log(computePayloadHash(a))})"
       ```
       Do this 3 times (one per UF) and paste each into the fixture. Do NOT commit the one-liner script.

    2. Write `tests/fixtures/sources/all-red.json` with 27 alerts (one per UF, all severity='red', hazard_kind='queimada'). Use the same hash computation procedure (27 invocations).

    3. Write `tests/fixtures/sources/README.md`:
       ```markdown
       # Fontes — fixtures

       Cada arquivo `*.json` é validado contra `AlertSchema` (src/lib/sources/schema.ts) no momento do load.

       ## Como autorar uma nova fixture

       1. Copie `stub-default.json` como template.
       2. Edite os campos. Para cada Alert, calcule `payload_hash` rodando uma vez:
          ```
          pnpm tsx -e "..." # ver action do plano 02-05 task 2 step 1
          ```
       3. Cole o hash no campo `payload_hash` do objeto.
       4. Aponte `STUB_FIXTURE_PATH=tests/fixtures/sources/<seu-arquivo>.json` para usar.

       ## Fixtures atuais

       - `stub-default.json` — 3 alertas (SP queimada, RJ enchente, AM estiagem). Default do stubAdapter.
       - `all-red.json` — 27 alertas (1 por UF, severity=red). Para teste de stress + revalidatePath.

       ## Limites

       - `payload_hash` deve ser sha256 hex 64 chars.
       - Severidade: green | yellow | orange | red | unknown.
       - Hazard kind: queimada | enchente | estiagem | incendio | inundacao | seca.
       - state_uf: uma das 27 UFs válidas.
       ```

    4. Write `src/lib/sources/stub.ts`:
       ```ts
       import { readFile } from "node:fs/promises";
       import { resolve } from "node:path";
       import { AlertArraySchema, type Alert } from "./schema";
       import type { SourceAdapter } from "./types";

       const DEFAULT_FIXTURE = "tests/fixtures/sources/stub-default.json";

       export const stubAdapter: SourceAdapter = {
         key: "stub",
         displayName: "Stub (fixture)",
         async fetch(): Promise<Alert[]> {
           const fixturePath = process.env.STUB_FIXTURE_PATH ?? DEFAULT_FIXTURE;
           const absPath = resolve(process.cwd(), fixturePath);
           const raw = await readFile(absPath, "utf8");
           const parsed = JSON.parse(raw);
           // REQ-S2.05: validate before return; throws zod error if invalid (caller catches).
           return AlertArraySchema.parse(parsed);
         },
       };
       ```

    5. Write `src/lib/sources/registry.ts`:
       ```ts
       import type { SourceAdapter } from "./types";
       import { stubAdapter } from "./stub";

       /**
        * Registry of all SourceAdapters. Adding a new source = single append here.
        * Orchestrator (/api/ingest) iterates this array via Promise.allSettled and
        * NEVER imports concrete adapters by name (REQ-S2.04 enforced via grep).
        */
       export const sources: readonly SourceAdapter[] = [stubAdapter];
       ```

    6. Write `src/lib/sources/stub.test.ts`:
       ```ts
       import { describe, it, expect, beforeEach, afterEach } from "vitest";
       import { stubAdapter } from "./stub";

       describe("stubAdapter", () => {
         const original = process.env.STUB_FIXTURE_PATH;
         beforeEach(() => { delete process.env.STUB_FIXTURE_PATH; });
         afterEach(() => { if (original) process.env.STUB_FIXTURE_PATH = original; else delete process.env.STUB_FIXTURE_PATH; });

         it("default fixture returns 3 alerts SP/RJ/AM", async () => {
           const out = await stubAdapter.fetch();
           expect(out.length).toBe(3);
           const ufs = out.map((a) => a.state_uf).sort();
           expect(ufs).toEqual(["AM", "RJ", "SP"]);
         });

         it("STUB_FIXTURE_PATH override loads alternate fixture", async () => {
           process.env.STUB_FIXTURE_PATH = "tests/fixtures/sources/all-red.json";
           const out = await stubAdapter.fetch();
           expect(out.length).toBe(27);
           expect(out.every((a) => a.severity === "red")).toBe(true);
         });

         it("invalid fixture path throws", async () => {
           process.env.STUB_FIXTURE_PATH = "tests/fixtures/sources/does-not-exist.json";
           await expect(stubAdapter.fetch()).rejects.toBeDefined();
         });

         it("adapter shape matches SourceAdapter contract", () => {
           expect(stubAdapter.key).toBe("stub");
           expect(typeof stubAdapter.displayName).toBe("string");
           expect(typeof stubAdapter.fetch).toBe("function");
         });
       });
       ```

    7. Run `pnpm test src/lib/sources`. Expect all stub + schema tests pass (12 total).

    8. Run the registry-isolation grep gate (REQ-S2.04 acceptance):
       ```
       grep -rE "import.*Stub|import.*Cemaden|import.*Inmet" src/lib src/app | grep -v "src/lib/sources/registry.ts" | grep -v "src/lib/sources/stub" | wc -l
       ```
       Expected: 0. If non-zero, refactor offending file to import only the abstract type from src/lib/sources/types.

    9. Run no-raw-fetch gate:
       ```
       grep -nE "\\bfetch\\(" src/lib/sources/ | grep -v ".test." | grep -v "node:fs"
       ```
       Expected: empty (stub uses fs.readFile, not fetch). Confirms REQ-S2.03 anti-pattern not violated.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm test src/lib/sources && bash -c "grep -rE 'import.*Stub|import.*Cemaden|import.*Inmet' src/lib src/app 2>/dev/null | grep -v 'src/lib/sources/registry.ts' | grep -v 'src/lib/sources/stub' | wc -l" && grep -c "sources: readonly SourceAdapter\\[\\]" src/lib/sources/registry.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test src/lib/sources` exits 0 with all 12 tests passing (8 schema + 4 stub)
    - File `tests/fixtures/sources/stub-default.json` parses as JSON array of length 3
    - File `tests/fixtures/sources/all-red.json` parses as JSON array of length 27
    - `grep -c "key: \"stub\"" src/lib/sources/stub.ts` returns 1
    - `grep -c "STUB_FIXTURE_PATH" src/lib/sources/stub.ts` returns 1
    - `grep -c "sources: readonly SourceAdapter\\[\\]" src/lib/sources/registry.ts` returns 1
    - Registry isolation gate (REQ-S2.04): `grep -rE "import.*Stub|import.*Cemaden|import.*Inmet" src/lib src/app | grep -v "src/lib/sources/" | wc -l` returns 0
    - No raw fetch in adapters: `grep -nE "\\bfetch\\(" src/lib/sources/ | grep -v ".test." | grep -v "node:fs" | wc -l` returns 0
  </acceptance_criteria>
  <done>Stub adapter + fixtures + registry exist; abstraction enforced by grep gates; default + override behaviors covered by 4 unit tests; invalid fixture rejected pre-persistence.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                         | Description                          |
| -------------------------------- | ------------------------------------ |
| Filesystem (fixture files) → app | JSON parse + zod validate before use |

## STRIDE Threat Register

| Threat ID | Category               | Component                                               | Disposition | Mitigation Plan                                                                                                           |
| --------- | ---------------------- | ------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| T-02-13   | Tampering              | Malformed fixture pollutes alerts table                 | mitigate    | AlertSchema.array().parse() in stub.ts before return; rejection propagates to ingest which records sources_health failure |
| T-02-14   | Information Disclosure | STUB_FIXTURE_PATH points at sensitive file outside repo | accept      | Stub is dev/test-only; production sources will be authority HTTPS endpoints (P4); resolve from cwd documents origin       |

</threat_model>

<verification>
12 unit tests pass; default fixture is 3 alerts SP/RJ/AM; override returns 27 red alerts; registry-isolation grep returns 0; no-raw-fetch grep returns 0.
</verification>

<success_criteria>
SourceAdapter contract is the only surface the orchestrator depends on. Adding CEMADEN in P4 = create src/lib/sources/cemaden.ts + append to registry. Zero changes to /api/ingest required.
</success_criteria>

<output>
After completion, create `.planning/phases/02-data-foundation/02-05-SUMMARY.md`
</output>
