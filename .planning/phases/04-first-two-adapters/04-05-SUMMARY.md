# Plan 04-05 SUMMARY — Contract Tests + Real Fixtures

**Branch**: `phase-4-adapters-cemaden-inmet`
**Commits**: `74ba08d` (fixtures), `9af58e4` (inmet contract), `7cb89c8` (cross-source isolation)
**Date**: 2026-05-09

## What was built

### Fixture capture (Task 1)

**Fixture files**:

- `tests/fixtures/sources/inmet-2026-05-09.list.json`
- `tests/fixtures/sources/inmet-2026-05-09.xml`

**Capture mode**: `--dry-run` from stub files (not live). See below for live API findings.

**Live INMET API findings** (schema drift, Canal 1 detection):

The live INMET endpoint (`https://apiprevmet3.inmet.gov.br/avisos/ativos`) was attempted twice.
The second attempt returned real active alerts, but in a different structure than `InmetActiveListSchema` expects:

- **Expected** (flat array): `[{"id": "string", ...}, ...]`
- **Actual** (object): `{"hoje": [{"id": 54303, ...}, ...], "futuro": [...]}`

Additionally, the `id` field in the live response is a **number** (e.g. `54303`), not a string.
`InmetActiveListSchema` validates `id: z.string().min(1)`, so numeric IDs fail validation.

This is a confirmed schema drift between the RESEARCH-documented API shape and the live API. The adapter
needs to be updated in a P5.1 follow-up to:

1. Accept `{hoje: [...], futuro: [...]}` top-level shape
2. Handle numeric `id` fields (coerce or update schema to `z.number()`)

The live list JSON was not staged because it cannot be used with the current adapter without fixes.
Instead, the canonical stub fixtures (`AVISO_STUB_001`, `Inundação` event) were used. The stub XML was
updated from `Chuva Intensa` (no matching HAZARD_PATTERN) to `Inundação` (matches `/inunda[çc][aã]o/i`
→ `"inundacao"` hazard kind).

**Stub fixture content**:

- `inmet-2026-05-09.list.json`: `[{"id":"AVISO_STUB_001"}]`
- `inmet-2026-05-09.xml`: CAP 1.2 doc, `<info xml:lang="pt-BR">`, severity `Severe`→`high`, event `Inundação`→`inundacao`, area `São Paulo`→`SP`

### INMET contract test (`tests/contract/inmet.test.ts`, Task 2)

7 test cases:

| Case                             | Description                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Snapshot round-trip              | `fetch()` → `Alert[]` → `toMatchSnapshot()` (fetched_at normalized)             |
| Empty list                       | `getJson` returns `[]` → `fetch()` returns `[]` without error                   |
| Strip pt-BR info                 | No pt-BR `<info>` block → all per-alert rejections → `fetch()` returns `[]`     |
| Unknown severity                 | `<severity>Unknown</severity>` → output severity is `"moderate"` (safe default) |
| Event not in HAZARD_PATTERNS     | `"Tornado"` → all per-alert rejections → `[]`                                   |
| Path C: cemaden.ts absent        | `existsSync("src/lib/sources/cemaden.ts")` = false                              |
| Path C: cemaden.schema.ts absent | same for `.schema.ts`                                                           |

All assertions use `isSourceError()` (W-1 invariant; never `instanceof SourceError`).

Snapshot file: `tests/contract/__snapshots__/inmet.test.ts.snap`

### Cross-source isolation test (`tests/contract/cross-source-isolation.test.ts`, Task 3)

```ts
// TODO(P5): replace inline cemadenStub with real cemadenAdapter once Phase 5 ships.
function cemadenStub(): SourceAdapter { ... }
```

4 test cases:

| Case                                        | Description                                                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| CEMADEN rejects, INMET fulfills             | `Promise.allSettled([cemaden.fetch(), inmet.fetch()])` — cemaden: `rejected/schema_invalid`; inmet: `fulfilled/Alert[]` |
| INMET throws, CEMADEN rejects independently | reverse isolation — both reject, each with their own error                                                              |
| Path C: cemaden.ts absent                   | Path C invariant                                                                                                        |
| Path C: cemaden.schema.ts absent            | Path C invariant                                                                                                        |

The `cemadenStub` factory is INSIDE the test file, not in `src/`. This satisfies the Path C constraint that no real CEMADEN code lands in `src/` during Phase 4.

## Verification gates satisfied

- `tests/fixtures/sources/inmet-2026-05-09.xml` + `inmet-2026-05-09.list.json`: exist ✅
- `pnpm test -- tests/contract/`: 11/11 pass ✅
- Snapshot committed: `tests/contract/__snapshots__/inmet.test.ts.snap` ✅
- `test ! -f src/lib/sources/cemaden.ts && test ! -f src/lib/sources/cemaden.schema.ts`: ✅
- `grep -c "cemadenStub" tests/contract/cross-source-isolation.test.ts`: 7 (≥ 1) ✅
- `grep -c "isSourceError" tests/contract/inmet.test.ts`: 3 (≥ 2) ✅
- `git diff HEAD -- vitest.config.ts | wc -l`: 0 (W-4 invariant) ✅
- `pnpm exec tsc --noEmit`: 0 errors ✅

## Schema drift finding → P5.1 issue

The INMET live API has drifted from the RESEARCH-documented schema. Key discrepancies:

1. **Top-level shape**: `{hoje: Alert[], futuro: Alert[]}` vs expected `Alert[]`
2. **ID type**: `number` vs expected `string`
3. **Additional fields**: `id_aviso`, `codigo` (URN), `municipios`, `icone` (base64 PNG), etc.

The `codigo` field is a URN like `"urn:oid:2.49.0.0.76.0.2026.27351.1"` — this may be the correct
alert identifier to use for `INMET_CAP_DETAIL`. The numeric `id` (54303) may be an internal DB key.

Action required in P5.1:

1. Update `InmetActiveListSchema` to accept `{hoje: z.array(...), futuro: z.array(...)}`
2. Update `InmetActiveListEntrySchema.id` to `z.union([z.string(), z.number()]).transform(String)`
3. Re-run `pnpm fixtures:refresh:inmet` (live mode) to capture real fixture
4. Update contract test snapshot

## CEMADEN P5 carry-over

The `TODO(P5)` comment in `cross-source-isolation.test.ts` marks where to replace the inline stub with
the real `cemadenAdapter`. The `SourceAdapter` interface (`key`, `displayName`, `fetch()`) is unchanged
from Phase 2; no orchestrator changes are needed to add CEMADEN.
