# Under-warning RC — issue #12 (P0)

**Date:** 2026-06-02
**Branch:** `maintenance/under-warning-issue-12`
**Probe:** `scripts/probe-adapter.ts` (read-only, against `tests/fixtures/sources/{cemaden,inmet}-2026-06-02.*`)

## Symptoms (production, captured by reporter on 2026-05-19)

- `/api/states` → all 27 UFs `risk: "green", alertCount: 0, lastSuccessfulFetch: null`
- `/api/health` → both `cemaden` and `inmet` report `consecutiveFailures: 0, isStale: false` (the adapter "succeeded" by returning `[]`)
- Manual `gh workflow run cron.yml` does not change the outcome

CLAUDE.md locks the project to **fail toward over-warning, never under-warning**. We were silently doing the opposite.

## Root cause

The under-warning is caused by **three independent bugs** that compound:

### Bug A — INMET legacy CAP detail endpoint is dead

`src/lib/sources/inmet.ts:32`

```ts
export const INMET_CAP_DETAIL = (id: string): string =>
  `https://alertas2.inmet.gov.br/${id}`;
```

The subdomain `alertas2.inmet.gov.br` responds to TLS handshake but then resets the connection (`* Recv failure: Connection was reset` — confirmed via curl on 2026-06-02). Every CAP detail fetch fails inside `Promise.allSettled` (inmet.ts:275-288). The settled-rejections arm is silently dropped (inmet.ts:294-297), so the adapter returns `[]` without throwing globally. `consecutiveFailures` stays at 0.

**100% drop rate** on a 9-entry live envelope.

### Bug B — CEMADEN hazard regex misses plural "Movimentos"

`src/lib/sources/cemaden.ts:51`

```ts
{ pattern: /^Movimento de Massa/i, hazard: "deslizamento" },
```

Live data emits **`Movimentos de Massa - Moderado`** (note plural "Movimentos") for landslide alerts. The regex demands the singular form, so every such item throws inside `Promise.allSettled` (cemaden.ts:174-176) and is silently dropped.

**33% drop rate** on the 2026-06-02 live envelope (4 of 12).

### Bug C — CEMADEN synthetic `valid_until` filters everything out downstream

`src/lib/sources/cemaden.ts:120,129`

```ts
const VALIDITY_WINDOW_MS = 24 * 60 * 60 * 1000;          // 24h
const validUntil = new Date(new Date(validFrom).getTime() + VALIDITY_WINDOW_MS).toISOString();
```

`datahoracriacao` is the **creation** timestamp, not the alert start time. CEMADEN keeps alerts active for as long as the underlying risk persists — often many days (the live envelope today has alerts from 2026-05-14, i.e. 19 days ago).

The active-rows query in `src/app/api/ingest/route.ts:189-194` filters by `valid_until > now`, so the 8 alerts that pass the hazard regex are then *all* dropped at snapshot composition time. Net effect: even when CEMADEN ingest succeeds end-to-end, the snapshot is empty.

This is why `/api/states` was empty even though the adapter wrote rows into the `alerts` table.

## Per-item replay (probe output, 2026-06-02)

```
[probe] CEMADEN fixture cemaden-2026-06-02.json
[probe] envelope.alertas.length=12
[probe] adapter returned 8 alerts
[probe] CARDINALITY MISMATCH — per-item replay:
  id=2127  Risco Hidrológico - Alto         -> OK
  id=2162  Risco Hidrológico - Moderado     -> OK
  id=2121  Risco Hidrológico - Moderado     -> OK
  id=2092  Risco Hidrológico - Moderado     -> OK
  id=2166  Risco Hidrológico - Moderado     -> OK
  id=2169  Movimentos de Massa - Moderado   -> EMPTY  ← Bug B
  id=2170  Movimentos de Massa - Moderado   -> EMPTY  ← Bug B
  id=2171  Risco Hidrológico - Moderado     -> OK
  id=2176  Movimentos de Massa - Moderado   -> EMPTY  ← Bug B
  id=2177  Movimentos de Massa - Moderado   -> EMPTY  ← Bug B
  id=2178  Risco Hidrológico - Moderado     -> OK
  id=2179  Risco Hidrológico - Moderado     -> OK
```

The 8 "OK" outputs then carry `valid_until = creation + 24h`. With creation timestamps in mid-May and `composerNow ≈ 2026-06-02`, every emitted alert lands behind the `valid_until > now` filter (Bug C). Net snapshot rows: 0.

```
[probe] INMET fixture inmet-2026-06-02.list.json
[probe] envelope hoje=5 futuro=4 (total 9)
[probe] adapter returned 0 alerts (from 9 entries)
[probe] CARDINALITY MISMATCH — under-warning condition reproduced
```

## Live API shape changes since fixtures were captured (2026-05-18/19)

### INMET — Wave 2 schema drift (breaking)

The list at `/avisos/ativos` is **no longer a thin pointer to CAP XML documents**. Each entry now carries the full alert payload inline:

```jsonc
{
  "id": 54542,
  "data_inicio": "2026-06-02T00:00:00.000Z",
  "hora_inicio": "08:48",
  "data_fim":    "2026-06-02T00:00:00.000Z",
  "hora_fim":    "23:59",
  "estados":     "Pernambuco,Paraíba,Rio Grande do Norte,Alagoas",
  "geocodes":    "2600054,2600302,2600401,...",
  "descricao":   "Chuvas Intensas",     // event type
  "severidade":  "Perigo Potencial",    // already in our SEVERITY_TABLE
  "riscos":      [ "Chuva entre 20 e 30 mm/h..." ],
  "instrucoes":  [ "Em caso de rajadas de vento...", ... ],
  // ... ~25 more fields
}
```

The legacy CAP XML detail endpoint `alertas2.inmet.gov.br/{id}` is no longer routable from the public internet. The adapter must consume the list payload directly.

Observed `descricao` values on 2026-06-02: `Chuvas Intensas`, `Acumulado de Chuva`, `Tempestade`.
Observed `severidade` values on 2026-06-02: `Perigo Potencial`, `Perigo` (table already covers both).

### CEMADEN — unchanged shape, new event variant

Envelope `{alertas, atualizado}` matches the existing strict schema. The only delta is the new plural form `Movimentos de Massa - Moderado`, which our regex rejects (Bug B).

## Fixes (Phase C)

| Bug | Fix |
|---|---|
| A — INMET CAP detail dead | Rewrite the INMET adapter to consume `/avisos/ativos` inline. Drop `parseCapXml`, `assertCapDocument`, `selectPtBrInfo`, `INMET_CAP_DETAIL`. |
| B — Movimentos plural | Tighten hazard regex to `^Movimentos?\s+de\s+Massa` (matches both forms). |
| C — Synthetic 24h `valid_until` | Stop synthesizing `valid_until`. CEMADEN keeps alerts active until they exit the `wsAlertas2` response; presence in the active list IS the validity signal. The ingest query already handles `valid_until IS NULL AND fetched_at > now - 24h` correctly, so the per-tick fetched_at refresh keeps the alert active until CEMADEN drops it from the upstream list. |

## Guardrail (acceptance for #12 + #4)

- `tests/contract/cardinality.test.ts` — given fixture with N ≥ 1 upstream alerts, the adapter MUST emit ≥ 1 alert. Catches Bug B/A regressions.
- `SourceReport.outputCount` — added to `/api/ingest` response so silent zero is observable in `/api/health` follow-ups.
- `.github/workflows/drift-sentinel.yml` — 72h-gated shape-hash check that opens an issue on structural drift. Catches future "schema changed under our feet" regressions.

## Why this passed CI

- INMET contract test uses a hand-built stub CAP XML (`tests/fixtures/sources/inmet-2026-05-09.xml`) and the `buildStubClient` returns it for any `alertas2.inmet.gov.br/*` URL. The dead-subdomain failure is **never exercised** in tests.
- CEMADEN contract test loads `cemaden-2026-05-18.json` which only contains "Risco Hidrológico" events (no "Movimentos de Massa" present at that snapshot date). The plural-regex blind spot is **never exercised** in tests.
- No end-to-end live-data check, no `outputCount` guardrail, no cardinality assertion.

## Failure mode (added to `risk-formula-v0.md`)

**Under-warning class.** Adapter returns `[]` because every per-item normalization throws inside `Promise.allSettled` (or a downstream filter zeroes the contribution). Health reports `ok` because the adapter call did not throw. Snapshot becomes uniformly `green`. CLAUDE.md inverts this: errors must fail TOWARD over-warning. We now guard with the cardinality test + outputCount + drift sentinel.
