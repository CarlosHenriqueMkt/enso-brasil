# Plan 04-03 SUMMARY — INMET Adapter Shipped

**Branch**: `phase-4-adapters-cemaden-inmet`
**Commits**: `3ea67bb` (schemas), `0b1a57c` (factory), `b8c379a` (tests), `0846b04` (Unicode fix), `5013b57` (W-1 comment)
**Date**: 2026-05-09

## What was built

### Pinned endpoints (INMET_CAP_LIST / INMET_CAP_DETAIL)

```
INMET_CAP_LIST   = https://apiprevmet3.inmet.gov.br/avisos/ativos
INMET_CAP_DETAIL = (id) => https://alertas2.inmet.gov.br/${id}
```

Both constants are exported from `src/lib/sources/inmet.ts` and duplicated (not imported) in `scripts/refresh-inmet.ts` to honour the registry-isolation constraint (scripts/ must not import from src/lib/sources/).

### Two-step fetch

1. `httpGet(INMET_CAP_LIST)` → `InmetActiveList` (array of `{ id, ... }`)
2. `Promise.allSettled(ids.map(id => httpGetText(INMET_CAP_DETAIL(id))))` → per-alert CAP XML

Per-alert failures are isolated: a 404 on one CAP doc does not abort the rest.

### pt-BR info-block selection

`selectPtBrInfo()` iterates `doc.alert.info[]` and returns the first entry with `xml:lang` matching `/^pt(-BR)?$/i`. If no pt-BR block exists, it throws `sourceError("missing_pt_br", ...)`. Any other language block (e.g. `en`) is ignored.

### Severity mapping

`mapSeverity()` (from `src/lib/risk/sources/inmet.ts`) converts CAP `<severity>` tokens to the `Alert.severity` union. Unknown tokens map to `"moderate"` (safe default).

### Hazard vocabulary table

`HAZARD_PATTERNS` maps Portuguese CAP `<event>` text to `HAZARD_KINDS` via regex:

| Pattern                        | Hazard          |
| ------------------------------ | --------------- |
| `chuva\s+intensa`              | `chuva_intensa` |
| `vendaval\|vento`              | `vento_forte`   |
| `granizo`                      | `granizo`       |
| `tempestade`                   | `tempestade`    |
| `inunda[çc]`                   | `inundacao`     |
| `seca\|estiagem`               | `seca`          |
| `geada`                        | `geada`         |
| `neve`                         | `neve`          |
| `maré\|mar\s+agitado`          | `mare_alta`     |
| `raio\|trovoada`               | `raio`          |
| `deslizamento\|escorregamento` | `deslizamento`  |
| `erosão\|erosao`               | `erosao`        |

No match → `"outros"`.

### UF resolution heuristic + Unicode boundary fix

`extractUFs()` walks `<area><areaDesc>` text and `<geocode><value>` codes to build a `Set<UF>`. State names match via named regexes (e.g. `/Pará/iu`).

**Unicode boundary fix** (`fix(04-03)` commit): JS `\b` is ASCII-only and fails at accented letter boundaries, causing "Pará" to match inside "Paraná". Replaced with Unicode-aware look-ahead/look-behind using `\p{L}` under the `/u` flag:

```ts
const B_OPEN = String.raw`(?<![\p{L}])`;
const B_CLOSE = String.raw`(?![\p{L}])`;
const ufName = (body: string): RegExp => new RegExp(`${B_OPEN}${body}${B_CLOSE}`, "iu");
```

### Factory-based error handling (W-1 invariant)

All errors are thrown via `sourceError(code, message, { cause? })`. No `new SourceError(...)` constructor calls, no `class extends Error` subclasses in `src/lib/sources/inmet.ts` or `src/lib/sources/inmet.schema.ts`. Enforced by literal grep gate:

```
grep -E "new\s+SourceError|class\s+\w+\s+extends\s+Error" \
  src/lib/sources/inmet.ts src/lib/sources/inmet.schema.ts | wc -l
# must be 0
```

The JSDoc comment in `inmet.schema.ts` was originally written with quoted disallowed strings; the `chore(04-03)` commit rewords it to avoid the false-positive grep match.

### `AlertArraySchema.safeParse` tripwire decision

The `AlertArraySchema.safeParse` throw arm in `normalizeCapDoc` is structurally unreachable: the function only reaches that point after `AlertArraySchema.parse()` already succeeds, so the `safeParse` failure branch can never fire at runtime. Rather than removing the defensive check (which serves as a documentation tripwire), it is covered with `/* v8 ignore next */` to keep coverage at 100 without a dedicated test for an impossible state.

### `wrapHttpError` handles `name` on root and `cause`

The HTTP error mapper inspects both `err.name` (for cases where `HttpError` is thrown directly) and `err.cause?.name` (for wrapped errors from retry logic). Both paths resolve `"not_found"` (404) vs `"fetch_error"` (other HTTP errors).

## Coverage

| File                              | Stmts | Branch | Funcs | Lines |
| --------------------------------- | ----- | ------ | ----- | ----- |
| `src/lib/sources/inmet.ts`        | 100   | 100    | 100   | 100   |
| `src/lib/sources/inmet.schema.ts` | 100   | 100    | 100   | 100   |

## 41-test breakdown

| Group                | Count | Description                                                                                       |
| -------------------- | ----- | ------------------------------------------------------------------------------------------------- |
| Production instance  | 1     | `inmetAdapter` is a non-null `SourceAdapter`                                                      |
| `fetch()` happy path | 2     | 0 alerts (empty list), 1 alert (pt-BR XML)                                                        |
| Error propagation    | 14    | `sourceError` codes: `missing_pt_br`, `not_found`, `fetch_error`, `parse_error`, `schema_invalid` |
| UF extraction        | 6     | geocode codes, areaDesc text, Unicode accent boundaries, multiple UFs                             |
| Hazard vocab         | 8     | All HAZARD_PATTERNS match + `"outros"` fallback                                                   |
| Severity mapping     | 4     | `Extreme`→`critical`, `Severe`→`high`, unknown→`moderate`, CAP pass-through                       |
| Timestamp            | 3     | ISO-Z normalization, missing onset, invalid format                                                |
| `wrapHttpError`      | 3     | 404/name-on-root, 503/name-on-cause, unknown-error                                                |

## Snapshot CRLF noise

`src/lib/risk/sources/__snapshots__/inmet.test.ts.snap` showed whitespace-only churn on Windows checkout (LF↔CRLF normalization). Discarded via `git checkout --` — same resolution as documented in 04-01 SUMMARY.

## Verification gates satisfied

- W-1 grep gate: 0 matches
- `sourceError` count: 14 (≥ 4 required)
- `missing_pt_br` count: 1 (≥ 1 required)
- `Promise.allSettled` count: 1 (≥ 1 required)
- `INMET_CAP_LIST|INMET_CAP_DETAIL` count: 7 (≥ 2 required)
- Coverage: 100/100/100/100 on both files
- `pnpm lint`: 2 pre-existing anonymous-default-export warnings (baseline); 0 errors
- `pnpm exec tsc --noEmit`: 0 errors
- `pnpm depcruise`: 0 violations
