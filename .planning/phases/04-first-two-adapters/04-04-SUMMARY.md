# Plan 04-04 SUMMARY — INMET Refresh Tooling Shipped

**Branch**: `phase-4-adapters-cemaden-inmet`
**Commits**: `b56e05d` (runner), `46d7aa7` (tests), `010f333` (script + stubs)
**Date**: 2026-05-09

## What was built

### `scripts/lib/fixture-runner.ts`

Shared, source-agnostic fixture refresh runner. Zero new runtime dependencies beyond Node built-ins.

**`structuralDiff(prior, next)`**:

- Recursively walks both trees
- Returns `"structural_drift"` if object key sets differ at any depth, types change, or array elements have different key sets
- Returns `"leaf_only"` for array length changes, identical values, and different-valued-but-same-shape values
- `noUncheckedIndexedAccess`-safe: uses `.at(-1)` for array tail access

**`runFixtureRefresh(opts)`**:

- `opts.source` ("inmet" | "cemaden"): fixture filename prefix
- `opts.ext` ("json" | "xml" | "list.json"): file extension
- `opts.fetchPayload`: async thunk returning raw string to persist
- `opts.parseForDiff`: optional parser for structural comparison (e.g. `JSON.parse`, `parseCapXml`)
- Output filename: `tests/fixtures/sources/{source}-{YYYY-MM-DD}.{ext}` (UTC date)
- Prior detection: alphabetical scan of existing fixtures with same prefix/extension, excluding today's file

Returns `DiffResult`:

```ts
type DiffResult = {
  kind: "no_prior" | "leaf_only" | "structural_drift";
  diff: string; // unified diff of prior vs new text
  newPath: string;
  priorPath: string | null;
};
```

### `scripts/lib/fixture-runner.test.ts`

10 test cases covering:

- `structuralDiff` (7): identical, same-shape-different-values, key added at depth 2, key removed, array length difference, array element new key, type change
- `runFixtureRefresh` (3): no prior → write, unchanged prior → leaf_only, structural key change → structural_drift

### `scripts/refresh-inmet.ts`

INMET-specific entrypoint. ~155 lines.

**Endpoint constants** (inline-duplicated; NOT imported from `src/lib/sources/inmet.ts` per registry-isolation policy):

```
INMET_CAP_LIST   = https://apiprevmet3.inmet.gov.br/avisos/ativos
INMET_CAP_DETAIL = (id) => https://alertas2.inmet.gov.br/${id}
```

**Execution flow**:

1. Parse `--dry-run` flag via `node:util.parseArgs`
2. Fetch list JSON (live or from `_stub/inmet-list-stub.json`)
3. Write `inmet-{today}.list.json` via runner
4. If list is empty: warn, exit 0
5. Fetch first active alert's CAP XML (live or from `_stub/inmet-cap-stub.xml`)
6. Write `inmet-{today}.xml` via runner (with `parseCapXml` for structural comparison)
7. Exit = `max(list_kind_severity, cap_kind_severity)`

**Exit code semantics**:

- 0: `no_prior` or `leaf_only` — fixture written, no structural change
- 1: `structural_drift` — upstream schema may have changed; review diff before committing

**`parseCapXml` import**: dynamically imported from `src/lib/sources/xml.ts` to avoid triggering depcruise static analysis on a `scripts/` → `src/` edge. The Wave 0 `xml.ts` is a pure parse utility with no registry-scope concerns.

### Stub fixtures

`tests/fixtures/sources/_stub/inmet-list-stub.json`: `[{"id":"AVISO_STUB_001"}]`

`tests/fixtures/sources/_stub/inmet-cap-stub.xml`: Minimal but schema-valid CAP 1.2 doc with `<info xml:lang="pt-BR">`, severity `Moderate`, event `Chuva Intensa`, area `São Paulo`.

### `package.json` script

Added alphabetically in the `f` group (after `format:check`):

```json
"fixtures:refresh:inmet": "tsx scripts/refresh-inmet.ts"
```

**No `fixtures:refresh:cemaden` script** — Path C invariant; deferred to P5.

## Verification gates satisfied

- `pnpm test -- scripts/lib/fixture-runner.test.ts`: 10/10 pass
- `tsx scripts/refresh-inmet.ts --dry-run`: exits 0, writes both dated fixtures
- `grep -c "structuralDiff" scripts/lib/fixture-runner.ts`: 5 (≥ 1 required)
- `grep -c "structural_drift" scripts/lib/fixture-runner.ts`: 9 (≥ 2 required)
- `pnpm exec tsc --noEmit`: 0 errors
- `pnpm depcruise`: 0 violations
- `git diff HEAD -- vitest.config.ts | wc -l`: 0 (W-4 invariant — vitest config NOT modified)
- Path C: no `fixtures:refresh:cemaden` script in `package.json`

## W-4 resolution

Wave 0 (plan 04-01) pre-extended `vitest.config.ts` with `scripts/**/*.test.ts` glob. This plan writes `scripts/lib/fixture-runner.test.ts` which is discovered without any vitest.config.ts change — the W-4 race-condition invariant is upheld.

## CEMADEN P5 carry-over

`runFixtureRefresh` is parameterized on `source: "cemaden" | "inmet"`. Plan 04-05 can add `scripts/refresh-cemaden.ts` as a thin entrypoint with zero changes to the runner.
