---
phase: 05-cemaden-dashboard-ui
plan: 04
type: execute
wave: 2
depends_on: ["05-03"]
files_modified:
  - tests/sources/cemaden.test.ts
  - tests/sources/cemaden.contract.test.ts
  - tests/fixtures/sources/cemaden-2026-05-18.json
  - scripts/refresh-cemaden.ts
  - scripts/lib/fixture-runner.ts
  - package.json
autonomous: true
requirements: [ADAPT-01]
must_haves:
  truths:
    - "CEMADEN unit tests cover happy path + each sourceError code (schema_invalid, timeout, http_5xx)"
    - "Contract test loads latest cemaden-*.json fixture and asserts schema + severity vocab + hazard vocab"
    - "Fixture refresh script runs against live `/wsAlertas2` and writes new fixture; --dry-run mode parses existing fixture"
  artifacts:
    - path: "tests/fixtures/sources/cemaden-2026-05-18.json"
      provides: "Golden fixture extracted from endpoint capture"
    - path: "tests/sources/cemaden.test.ts"
      provides: "Unit tests, target 100/100/100/100 like INMET"
    - path: "tests/sources/cemaden.contract.test.ts"
      provides: "Fixture-driven contract test"
    - path: "scripts/refresh-cemaden.ts"
      provides: "CLI: pnpm fixtures:refresh:cemaden [--dry-run]"
  key_links:
    - from: "tests/sources/cemaden.contract.test.ts"
      to: "tests/fixtures/sources/cemaden-*.json"
      via: "glob sort-desc, load latest"
      pattern: "cemaden-\\*\\.json"
---

<objective>
Cover the CEMADEN adapter with the same test rigor INMET has (41 unit tests, 100/100/100/100). Plus contract test + fixture + refresh script.

Output: 4 test/script files, package.json script entry.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-cemaden-dashboard-ui/05-cemaden-endpoint-capture.md
@.planning/phases/05-cemaden-dashboard-ui/05-PATTERNS.md
@src/lib/sources/cemaden.ts
@src/lib/sources/cemaden.schema.ts
@tests/sources/inmet.test.ts
@tests/sources/inmet.contract.test.ts
@scripts/refresh-inmet.ts
@scripts/lib/fixture-runner.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Commit golden fixture from capture</name>
  <files>tests/fixtures/sources/cemaden-2026-05-18.json</files>
  <action>
    Extract the 5-alert sample JSON from `05-cemaden-endpoint-capture.md` Endpoint 2 §"Sample response" verbatim — the full `{alertas:[...5 items...], atualizado: "18-05-2026 22:15:01 UTC"}` block. Write to `tests/fixtures/sources/cemaden-2026-05-18.json`. Validate it parses against `WsAlertas2ResponseSchema` (a one-shot Node REPL: `pnpm exec tsx -e "import {WsAlertas2ResponseSchema} from './src/lib/sources/cemaden.schema'; import f from './tests/fixtures/sources/cemaden-2026-05-18.json'; console.log(WsAlertas2ResponseSchema.parse(f).alertas.length)"` → expect `5`).

    IMPORTANT: This is REAL captured data. Do not synthesize. If the capture file has any redactions, surface as a blocker.

  </action>
  <verify>
    <automated>test -f tests/fixtures/sources/cemaden-2026-05-18.json &amp;&amp; node -e "const f=require('./tests/fixtures/sources/cemaden-2026-05-18.json'); if (f.alertas.length!==5) process.exit(1)"</automated>
  </verify>
  <done>Fixture file matches capture verbatim; 5 alertas; root `atualizado` present.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Unit tests — cemaden.test.ts</name>
  <files>tests/sources/cemaden.test.ts</files>
  <behavior>
    Mirror `tests/sources/inmet.test.ts` structure. Mock HTTP via `createCemadenAdapter(mockHttp)` DI seam. Cover:
    - Happy path: fixture payload → 5 Alert objects with UTC ISO-Z timestamps.
    - `nivel` → severity mapping (Moderado→moderate, Alto→high, Muito Alto→extreme).
    - Hazard mapping: `Risco Hidrológico - Moderado` → `enchente`; synthetic `Movimento de Massa - Alto` → `deslizamento`.
    - Schema invalid (extra field, missing field) → `sourceError` with `code: "schema_invalid"`.
    - Timeout (mock rejects with `{ name: "FetchError", message: "timeout" }`) → `sourceError("timeout")`.
    - HTTP 500 (mock rejects with `{ statusCode: 500 }`) → `sourceError("http_5xx")`.
    - Drift tripwire: timestamp `"1900-01-01 00:00:00"` → `sourceError("schema_invalid")` with message containing "out of plausible range".
    - Drift tripwire: timestamp 60 days future → same.
    - Empty alertas array → returns `[]` (calm day case from capture §Observations).
    - Unmappable `evento: "Terremoto"` → `sourceError("schema_invalid")` with "not mappable".
    - Target coverage: 100/100/100/100 (line/branch/func/stmt). Add cases until V8 coverage reports 100%.
  </behavior>
  <action>
    Use `vi.fn()` mocks. Import fixture directly. Each `it()` is named after the failure mode.
  </action>
  <verify>
    <automated>pnpm test:coverage tests/sources/cemaden.test.ts</automated>
  </verify>
  <done>All assertions green; coverage report shows 100/100/100/100 for `src/lib/sources/cemaden.ts` and `src/lib/sources/cemaden.schema.ts`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Contract test — cemaden.contract.test.ts</name>
  <files>tests/sources/cemaden.contract.test.ts</files>
  <behavior>
    Mirror `tests/sources/inmet.contract.test.ts`. Load latest `tests/fixtures/sources/cemaden-*.json` (sort desc by filename); inject via stub HTTP client; assert:
    - Result parses against `AlertArraySchema`.
    - Every `severity` is in `["low", "moderate", "high", "extreme"]`.
    - Every `hazard_kind` is in `HAZARD_KINDS`.
    - Every `uf` is in `UF27_PROVISIONAL`.
    - Every `valid_from` ends with `Z` (ISO-Z).
    - `payload_hash` is a non-empty string.

    Fail-loud test: synthesize a payload variant where `nivel: "Atenção"` (INMET-style vocab leak) → expect `sourceError("schema_invalid")`. This proves the CEMADEN-specific vocab boundary.

  </behavior>
  <action>
    Use `glob` or `fs.readdirSync` + filter — mirror INMET pattern exactly.
  </action>
  <verify>
    <automated>pnpm test:ci tests/sources/cemaden.contract.test.ts</automated>
  </verify>
  <done>Contract test green; fails reproducibly when fixture is corrupted (manual sanity: temporarily add an extra field to fixture → test fails → revert).</done>
</task>

<task type="auto">
  <name>Task 4: refresh-cemaden.ts CLI + fixture-runner type union update + pnpm script</name>
  <files>scripts/refresh-cemaden.ts, scripts/lib/fixture-runner.ts, package.json</files>
  <action>
    Copy `scripts/refresh-inmet.ts` per `05-PATTERNS.md` §"Copy verbatim" rules for the refresh script:
    - `parseArgs` `--dry-run` flag from `refresh-inmet.ts:31-35`.
    - Single `runFixtureRefresh({source:"cemaden", ext:"json", fetchPayload, parseForDiff: JSON.parse})` call.
    - Exit-code severity ladder verbatim.
    - `USER_AGENT = "enso-brasil/1.0 fixture-refresh"`.
    - Inline-duplicate `CEMADEN_WS_ALERTAS_URL` (registry-isolation: do NOT import from `src/lib/sources/cemaden.ts`).
    - `--dry-run` reads latest `tests/fixtures/sources/cemaden-*.json` and runs through the parser without HTTP.

    Confirm `scripts/lib/fixture-runner.ts` already has `"cemaden"` in its source type union (per 05-PATTERNS line 99 — `:137`). If not, append.

    Add to `package.json` `scripts`: `"fixtures:refresh:cemaden": "tsx scripts/refresh-cemaden.ts"` (alphabetical between `fixtures:refresh:inmet` lines).

  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit &amp;&amp; pnpm fixtures:refresh:cemaden --dry-run</automated>
  </verify>
  <done>--dry-run exits 0 and prints parsed fixture summary; package.json script added.</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-07 | Tampering | fixture file | mitigate | Contract test parses against strict schema on every CI run |
</threat_model>

<verification>
- `pnpm test:coverage tests/sources/cemaden.test.ts` → 100/100/100/100
- `pnpm test:ci tests/sources/cemaden.contract.test.ts` green
- `pnpm fixtures:refresh:cemaden --dry-run` exits 0
</verification>

<success_criteria>

- 4 files committed; coverage matches INMET (100×4)
- Contract test rejects schema drift loudly
  </success_criteria>

<output>
Create `.planning/phases/05-cemaden-dashboard-ui/05-04-SUMMARY.md` with test counts + coverage numbers.
</output>
