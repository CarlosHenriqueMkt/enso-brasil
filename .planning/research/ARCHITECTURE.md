# Architecture Research — ENSO Brasil

**Domain:** Climate hazard aggregation dashboard
**Stack (locked):** Next.js 15 App Router, Vercel free tier (Functions + Cron + KV + Postgres), TypeScript strict, react-simple-maps, next-intl, Tailwind
**Researched:** 2026-04-28
**Confidence:** HIGH (stack locked, patterns well-documented)

---

## System Diagram (ASCII)

```
                    ┌──────────────────────────────────────────┐
                    │           VERCEL CRON (every 15 min)     │
                    │           POST /api/cron/ingest          │
                    └──────────────────┬───────────────────────┘
                                       │ Bearer CRON_SECRET
                                       ▼
                    ┌──────────────────────────────────────────┐
                    │   Cron Orchestrator (Node runtime)       │
                    │   - Promise.allSettled across adapters   │
                    │   - 60s max budget                       │
                    └─┬──────────┬──────────┬──────────┬───────┘
                      │          │          │          │
              ┌───────▼──┐ ┌─────▼────┐ ┌───▼──────┐ ┌─▼──────┐
              │ CEMADEN  │ │  INMET   │ │  INPE    │ │ FIRMS  │
              │ adapter  │ │ adapter  │ │ adapter  │ │adapter │
              └───────┬──┘ └─────┬────┘ └───┬──────┘ └─┬──────┘
                      │          │          │          │
                      └──────────┴────┬─────┴──────────┘
                                      │ Alert[] (normalized)
                                      ▼
                          ┌────────────────────────┐
                          │  Normalize + Dedup     │
                          │  (pure functions)      │
                          └────────┬───────────────┘
                                   │
                ┌──────────────────┴───────────────────┐
                ▼                                      ▼
       ┌────────────────┐                    ┌──────────────────┐
       │ Postgres       │                    │  Risk Calculator │
       │ alerts_raw     │                    │  (pure fn)       │
       │ sources_health │                    │  → snapshot      │
       │ snapshot_cache │                    └────────┬─────────┘
       └────────────────┘                             │
                                                      ▼
                                          ┌────────────────────┐
                                          │  Vercel KV         │
                                          │  snapshot:current  │
                                          │  (TTL 30min)       │
                                          └─────────┬──────────┘
                                                    │
       ┌────────────────────────────────────────────┴────────┐
       ▼                                                     ▼
┌──────────────────┐                              ┌────────────────────┐
│ /api/states      │ ◄─── browser fetch ◄──── │ /  (Server Comp.)  │
│ Edge runtime     │                              │ - reads KV         │
│ s-maxage=60      │                              │ - hydrates islands │
└──────────────────┘                              └─────────┬──────────┘
                                                            │
                                            ┌───────────────┴──────────┐
                                            ▼                          ▼
                                  ┌──────────────────┐      ┌──────────────────┐
                                  │ <BrazilMap/>     │      │ <StatePanel/>    │
                                  │ (client island,  │      │ (client island,  │
                                  │ react-simple-maps│      │ shows alerts)    │
                                  └──────────────────┘      └──────────────────┘
```

---

## Components

| Component | Responsibility | Runtime | Build phase |
|---|---|---|---|
| `lib/sources/types.ts` | `Alert`, `Severity`, `RiskLevel`, `SourceAdapter` interface | n/a | P1 |
| `lib/sources/cemaden.ts` | Fetch CEMADEN, normalize → `Alert[]` | Node | P3 |
| `lib/sources/inmet.ts` | Fetch INMET, normalize → `Alert[]` | Node | P3 |
| `lib/sources/inpe.ts` | Fetch INPE Queimadas, normalize → `Alert[]` | Node | P5 (post-MVP) |
| `lib/sources/firms.ts` | NASA FIRMS backup for fire | Node | P5 |
| `lib/sources/registry.ts` | Adapter registry + parallel runner | Node | P3 |
| `lib/risk/calculate.ts` | `calculateRiskLevel(alerts)` pure fn (v0 formula) | Edge-safe | P2 |
| `lib/risk/dedup.ts` | Same-hazard-same-state-overlapping merger | Edge-safe | P2 |
| `lib/risk/snapshot.ts` | Build per-state `StateSnapshot[]` from alerts + sources_health | Edge-safe | P3 |
| `lib/db/client.ts` | Postgres client (`@vercel/postgres`) | Node | P1 |
| `lib/db/schema.sql` | DDL for `alerts_raw`, `sources_health`, `snapshot_cache` | n/a | P1 |
| `lib/db/repositories.ts` | Typed CRUD over the 3 tables | Node | P1 |
| `lib/cache/kv.ts` | Vercel KV thin wrapper, key conventions | Node/Edge | P3 |
| `app/api/cron/ingest/route.ts` | Cron orchestrator: fetch all → store → recompute → cache | Node (60s) | P3 |
| `app/api/states/route.ts` | Serve cached snapshot JSON | Edge | P4 |
| `app/api/health/route.ts` | Per-source last-success, cron last-run | Edge | P6 |
| `app/[locale]/page.tsx` | Server Component shell, reads KV directly | Node (RSC) | P4 |
| `components/BrazilMap.tsx` | Client island, `react-simple-maps` + IBGE TopoJSON | Client | P4 |
| `components/StatePanel.tsx` | Client island, hazard list + sources | Client | P4 |
| `components/RiskBadge.tsx` | Color + icon + label (a11y) | RSC | P2 |
| `i18n/` | `next-intl` config, PT-BR messages, locale routing | RSC | P1 |
| `vercel.json` | Cron schedule (`*/15 * * * *`) | n/a | P3 |

---

## Data Flow

### Ingestion (every 15 min)

1. **Vercel Cron** POSTs `/api/cron/ingest` with `Authorization: Bearer ${CRON_SECRET}`.
2. Orchestrator validates secret (reject otherwise).
3. Loads adapter registry, runs all enabled adapters via `Promise.allSettled` with **per-adapter 20s timeout**.
4. Each successful adapter returns `Alert[]`. Each failed adapter logs reason; `sources_health` row is updated either way (`last_attempt_at`, on success also `last_success_at`).
5. Aggregate `Alert[]` from successful sources. **Dedup**: group by `(hazardType, state)` with overlapping `[publishedAt, activeUntil]` window → keep one logical alert, but preserve all `sources[]` for UI attribution.
6. Upsert raw alerts to `alerts_raw` (idempotent on `(source, source_alert_id)`).
7. Run `calculateRiskLevel` per state (27 invocations, pure, ~ms total).
8. Build `Snapshot { generatedAt, states: StateSnapshot[27], sourcesHealth }`.
9. Write to `snapshot_cache` (Postgres, durable) and to **KV `snapshot:current` with TTL 1800s**.
10. Return `{ ok: true, durationMs, perSource: {...} }`.

### Read (user request)

1. Browser → `GET /` (Edge or RSC) → page Server Component fetches KV `snapshot:current`.
2. KV miss → fall back to Postgres `snapshot_cache` (most-recent row), set KV with shorter TTL, render with `staleness` flag.
3. Page returns HTML with embedded snapshot for first paint; client islands hydrate.
4. Subsequent client navigation / panel updates → `GET /api/states` (Edge runtime, `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`).
5. If snapshot age > 1h AND no source has `last_success_at` within 1h → snapshot returns each state as `risk: 'unavailable'` (gray) per v0 formula §"Confiança mínima".

---

## Adapter Contract

```ts
// lib/sources/types.ts
export type Severity = 'low' | 'moderate' | 'high' | 'extreme'
export type HazardType = 'drought' | 'flood' | 'heatwave' | 'landslide' | 'fire' | 'storm'
export type StateCode = 'AC' | 'AL' | /* ... 27 UFs ... */ 'TO'

export interface Alert {
  source: string              // 'cemaden' | 'inmet' | ...
  sourceAlertId: string       // stable ID from upstream for dedup
  hazardType: HazardType
  severity: Severity
  state: StateCode
  activeUntil: Date | null
  sourceUrl: string
  publishedAt: Date
  rawTitle: string            // original PT-BR title for UI
  rawSeverityLabel: string    // original term for transparency
}

export interface AdapterResult {
  alerts: Alert[]
  fetchedAt: Date
  upstreamLatencyMs: number
}

export interface SourceAdapter {
  readonly id: string                       // 'cemaden'
  readonly displayName: string              // 'CEMADEN'
  readonly homepage: string
  readonly enabled: boolean                 // feature-flag
  readonly timeoutMs: number                // default 20_000
  fetch(signal: AbortSignal): Promise<AdapterResult>
}
```

Adding a new source = create one file implementing `SourceAdapter`, register in `lib/sources/registry.ts`. **No other code changes** — orchestrator iterates registry, dedup is hazard+state based, UI groups by hazard and shows all attributions automatically. This is the M9 leverage point.

---

## Storage Schema

```sql
-- alerts_raw: append-mostly, idempotent upserts
CREATE TABLE alerts_raw (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL,
  source_alert_id TEXT NOT NULL,
  hazard_type     TEXT NOT NULL,
  severity        TEXT NOT NULL,
  state           CHAR(2) NOT NULL,
  active_until    TIMESTAMPTZ,
  source_url      TEXT NOT NULL,
  published_at    TIMESTAMPTZ NOT NULL,
  raw_title       TEXT NOT NULL,
  raw_severity_label TEXT NOT NULL,
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_alert_id)
);
CREATE INDEX idx_alerts_state_active ON alerts_raw (state, active_until);
CREATE INDEX idx_alerts_published    ON alerts_raw (published_at DESC);

-- sources_health: one row per source, updated each cron tick
CREATE TABLE sources_health (
  source            TEXT PRIMARY KEY,
  last_attempt_at   TIMESTAMPTZ NOT NULL,
  last_success_at   TIMESTAMPTZ,
  last_error        TEXT,
  consecutive_fails INT NOT NULL DEFAULT 0
);

-- snapshot_cache: durable copy of the computed snapshot (KV is volatile)
CREATE TABLE snapshot_cache (
  id           BIGSERIAL PRIMARY KEY,
  generated_at TIMESTAMPTZ NOT NULL,
  payload      JSONB NOT NULL,
  formula_ver  TEXT NOT NULL DEFAULT 'v0'
);
CREATE INDEX idx_snapshot_generated ON snapshot_cache (generated_at DESC);
```

**Indexes chosen for scale (~hundreds of alerts/day, 27 states):**
- `(state, active_until)` covers the main per-state read path.
- `(source, source_alert_id)` enforces idempotency for cron retries.
- Snapshot table only ever reads `ORDER BY generated_at DESC LIMIT 1`; covered by index. Periodic cleanup via `DELETE WHERE generated_at < NOW() - '7 days'` in cron.

**Why both KV and Postgres for snapshot:** KV gives sub-10ms reads at the edge but is volatile and has eviction risk on free tier. Postgres is the durable source-of-truth for recovery if KV is empty (cold KV after deploy, eviction, or KV outage).

---

## Caching Strategy

| Layer | Key/Path | TTL | Invalidation | Rationale |
|---|---|---|---|---|
| **Vercel KV** | `snapshot:current` | 1800s | Overwrite on each cron success | Hot path for `/api/states` and RSC reads |
| **Vercel KV** | `source:{id}:last` | 3600s | Overwrite on success | Quick health checks |
| **Edge cache (CDN)** | `/api/states` | `s-maxage=60, swr=300` | Time-based; cron writes new KV → next request after 60s revalidates | Free-tier function-invocation savings |
| **Route segment** | `app/[locale]/page.tsx` | `export const revalidate = 60` | ISR | Reduces cold RSC renders |
| **Static** | TopoJSON IBGE, flags, icons | 1y immutable | Filename hash | `react-simple-maps` boundaries don't change |
| **Browser** | i18n messages | session | next-intl handles | — |

**Free-tier sizing math:**
- Cron: 96 runs/day × 30 days = 2,880 invocations/month (well under limits).
- Public reads: with `s-maxage=60` → max ~43k origin hits/month at 1 RPS sustained — acceptable, CDN absorbs the rest.
- Postgres rows: ~hundreds/day alerts + 96 snapshots/day → cleanup keeps DB <100 MB easily.

---

## Failure Mode Matrix

| Mode | Detection | UI Behavior | Recovery |
|---|---|---|---|
| **One source down** (e.g., CEMADEN 5xx) | Adapter throws / timeout; `sources_health.consecutive_fails++` | Other sources still flow into risk calc. Banner: "Dados de CEMADEN desatualizados há X min" per v0 §"Falha de fonte" | Next cron tick auto-retries |
| **One source slow** | 20s adapter timeout fires | Same as down | — |
| **Cron skipped** (Vercel hiccup) | `snapshot_cache.generated_at` age > 20min | UI shows global staleness banner. Risk levels remain on last snapshot | Next cron tick (15min) |
| **Cron failing repeatedly** | `consecutive_fails ≥ 4` on all sources | After 1h with zero source success, every state → `unavailable` (gray) per v0 | Manual: re-deploy / fix adapter |
| **DB stale > 1h, KV stale** | `Date.now() - generatedAt > 3600_000` | All states gray "Dados indisponíveis" — never green-by-default | — |
| **All sources down (network, DNS)** | `Promise.allSettled` all rejected | Snapshot generation **aborted** — prior snapshot kept, age increments. After 1h → gray | — |
| **KV empty/evicted** | `kv.get` → null | Fall back to `snapshot_cache` Postgres row, repopulate KV | Auto on next read |
| **Postgres down** | Query throws | KV serves last good snapshot; `/api/health` reports DB red | Vercel Postgres SLA |
| **Cron auth misconfig** | 401 on POST `/api/cron/ingest` | Stale data piles up → eventually gray | Fix `CRON_SECRET` |
| **Bad data from source** (parse error) | Adapter throws inside fetch | Treated as "source down" — rest proceed | — |

**Invariant:** UI never shows green when source-of-truth was not consulted within 1h. Green is a positive assertion.

---

## Suggested Phase Progression (Fine granularity, 6 phases)

### Phase 1 — Skeleton & Contracts
**Goal:** Walking skeleton: Next.js 15 + Vercel + Postgres + KV + i18n + CI green on `main`.
**In:** empty repo. **Out:** deployable site that renders "Olá, ENSO Brasil" in PT-BR with footer disclaimer.
**Key plans:**
- Bootstrap Next 15 App Router, TS strict, Tailwind, ESLint/Prettier/Husky.
- Wire `next-intl` with `pt-BR` locale and `[locale]` segment.
- Provision Vercel Postgres + KV; commit `schema.sql`; run migration via script.
- Define `Alert`, `Severity`, `RiskLevel`, `SourceAdapter` types — these are contracts everything else binds to.
- GitHub Actions: install, typecheck, vitest, build.
- MIT LICENSE, README PT-BR/EN, CONTRIBUTING from commit 1 (OSS-01).

**Dependencies:** none. **Serves:** DEPLOY-01, OSS-01, OSS-02.

### Phase 2 — Risk Engine (Pure Core)
**Goal:** v0 formula implemented and exhaustively tested in isolation.
**In:** types from P1. **Out:** `calculateRiskLevel`, `dedupAlerts`, `buildSnapshot` as pure, edge-safe functions with 100% branch coverage.
**Key plans:**
- Implement v0 algorithm exactly as `risk-formula-v0.md` §Algoritmo.
- Implement dedup: same `hazardType` + same `state` + overlapping `[publishedAt, activeUntil]`.
- Implement 24h fallback expiry for null `activeUntil`.
- Implement "all sources stale > 1h → unavailable" rule.
- Vitest cases: each level transition, dedup edge cases, source-failure scenarios, formula version stamped in output.
- `RiskBadge` RSC component with icon+label+color (a11y baseline).

**Dependencies:** P1. **Serves:** RISK-01, RISK-04, A11Y-01 (partial).

### Phase 3 — Ingestion Pipeline (2 Sources Live)
**Goal:** CEMADEN + INMET adapters, cron orchestrator, snapshot persisted to Postgres + KV.
**In:** P1 infra, P2 risk engine. **Out:** every 15 min a fresh snapshot lands in KV; `sources_health` updated.
**Key plans:**
- Implement `cemaden.ts` and `inmet.ts` adapters with documented endpoints, timeouts, AbortSignal.
- Adapter registry + parallel `Promise.allSettled` runner.
- `app/api/cron/ingest/route.ts` (Node runtime, `maxDuration: 60`, Bearer auth).
- `vercel.json` cron `*/15 * * * *`.
- Repositories for `alerts_raw`, `sources_health`, `snapshot_cache` with idempotent upserts.
- Integration tests with recorded fixtures (no live network in CI).

**Dependencies:** P1, P2. **Serves:** DATA-01, DATA-02, DATA-03, RISK-03.

### Phase 4 — Dashboard UI (Map + Panel + Mobile Cards)
**Goal:** v1 dashboard live and consumable.
**In:** snapshot in KV from P3. **Out:** Public dashboard reads snapshot, renders 27 states with risk + alerts + sources.
**Key plans:**
- Server Component `app/[locale]/page.tsx` reads KV (fallback Postgres) and embeds snapshot.
- `BrazilMap` client island: `react-simple-maps` + IBGE UF TopoJSON, lazy-loaded (`next/dynamic` with `ssr: false`) — keeps initial bundle small for 3G.
- `StatePanel` client island: list of active hazards with source links, "última atualização" timestamp, "Como calculamos?" link to GitHub README.
- Mobile layout: stacked cards with search/filter, map below as secondary.
- `/api/states` Edge route serving same snapshot for client navigation.
- Tailwind responsive breakpoints; color-blind-safe palette (icons + labels).

**Dependencies:** P3. **Serves:** DASH-01, DASH-02, DASH-03, RISK-02, RISK-03.

### Phase 5 — Source Expansion + Hardening
**Goal:** 3rd source (INPE Queimadas), fault-injection tests, performance budget met.
**In:** P3 adapter pattern. **Out:** 3 sources live; failure modes proven; Lighthouse 3G budget green.
**Key plans:**
- `inpe.ts` adapter (only if research confirms stable endpoint per v0 §INPE caveat — otherwise informative-count only, not severity-bearing).
- Optional `firms.ts` as fire backup.
- Inject failure scenarios in tests: one source down, all sources down, cron skipped, DB stale.
- Lighthouse CI in GitHub Actions; 3G performance budget gate.
- `/api/health` endpoint (Edge) with sources_health summary.
- Playwright smoke tests for critical flows (load page, click state, see alerts).

**Dependencies:** P3, P4. **Serves:** DATA-01 (stretch), A11Y-02, observability baseline.

### Phase 6 — Launch Readiness
**Goal:** Public launch on real domain.
**In:** working dashboard. **Out:** Site live, monitored, documented.
**Key plans:**
- Domain (Vercel subdomain or .com.br).
- README expanded: methodology section explaining v0 formula with worked example (transparency cannot wait for M3).
- "Sources & Methodology" link in footer → GitHub README anchor.
- Optional: Plausible analytics (privacy-first) if decided.
- Final WCAG AA audit (manual + axe).
- Disclaimer audit on every page (LEGAL-01).
- Launch checklist: backups, secrets rotated, error logging confirmed.

**Dependencies:** P5. **Serves:** LEGAL-01, OSS-01, A11Y-01, DEPLOY-01.

---

## Future Bend Points (M4–M13)

| Milestone | Pinch point | Mitigation built into v1 |
|---|---|---|
| **M4 — Anomaly stats per state** | Risk engine becomes more than alert aggregation; needs historical timeseries (rainfall/temp). | Keep `calculateRiskLevel` pure and small. Add a sibling `calculateAnomalies()` rather than overloading. New `observations_raw` table parallel to `alerts_raw`. |
| **M5 — ENSO global status** | New data shape (not state-scoped). | Add `enso_status` KV key + own ingestion. **Do not** mix into `RiskLevel`. Snapshot grows a `enso` field; UI consumes additively. |
| **M6/M7 — Editorial/video content** | Content scaling. | App Router segments already isolate routes; add `app/[locale]/preparacao/` with MDX. No backend impact. |
| **M8 — Public API** | Rate limiting, auth, OpenAPI. | Snapshot already JSON-serializable; just version `/api/v1/states` and document. Add Upstash rate-limit at Edge. |
| **M9 — Scraping sources (state Defesa Civil)** | Long-running scrapes don't fit 60s cron. | Adapter contract is **already source-agnostic**. For scraping: (a) use GitHub Actions on a separate schedule writing into Postgres, OR (b) move heavy ingestion to a separate Vercel function with longer `maxDuration`. The `SourceAdapter` interface is unchanged. |
| **M10 — Historical comparison** | Need persisted snapshots over years. | `snapshot_cache` retention policy: instead of 7-day delete, archive daily `00:00` snapshot to a `snapshot_archive` table. Schema-stable from day 1. |
| **M11 — Notifications** | Need diff detection (level transitions) + delivery infra. | Compute `previousLevel` per state in snapshot builder (cheap with last `snapshot_cache` row). Persist transition events to a `risk_transitions` table — already useful in v1 for debugging. |
| **M12 — i18n ES/EN** | Translation pipeline. | `next-intl` + `[locale]` segment from P1; just add message catalogs. |
| **M13 — NASA/ECMWF** | More sources, possibly different cadences. | Adapter registry already supports per-source `cadenceMinutes` (add field to interface in v1, default 15). Cron orchestrator runs only adapters whose cadence aligns. |

**Pinch points to watch in v1:**
- `Snapshot` shape: keep it **versioned and additive**. Renaming a field in v1 = breaking change for M8 API consumers later.
- Don't bake the v0 formula into the snapshot consumer. Always include `formula_version` in the snapshot so M4 can ship `v1` of the formula side-by-side.

---

## Edge vs Node Runtime Decisions

| Route | Runtime | Why |
|---|---|---|
| `app/[locale]/page.tsx` (RSC) | Node (default) | Reads Postgres fallback when KV cold; `@vercel/postgres` not edge-friendly historically. ISR `revalidate=60`. |
| `app/api/states/route.ts` | **Edge** | Read-only, KV-only, hot path, latency-sensitive. `export const runtime = 'edge'`. |
| `app/api/cron/ingest/route.ts` | **Node**, `maxDuration: 60` | Multiple HTTP fetches in parallel + Postgres writes; needs full Node APIs and longer budget. |
| `app/api/health/route.ts` | **Edge** | Reads only KV/lightweight DB metadata. |
| Static assets (TopoJSON, icons) | CDN | Immutable, hashed. |

---

## Observability (Free-Tier Minimal Viable)

1. **Structured logs.** Every adapter logs `{source, durationMs, alertCount, ok, errorMessage?}` — visible in Vercel logs.
2. **Cron return payload.** `/api/cron/ingest` returns JSON summary; Vercel surfaces it in Cron logs UI.
3. **`/api/health` endpoint.** Returns JSON: `{snapshotAge, perSource: [{id, lastSuccessAt, consecutiveFails}], dbReachable, kvReachable}`. Use as up-time monitor target.
4. **External uptime ping** (optional, free): UptimeRobot hits `/api/health` every 5min; alerts to email/Telegram.
5. **Error visibility.** Sentry free tier OR just rely on Vercel logs in v1 (zero budget). Decide in P6.
6. **Formula version stamped** in every snapshot — invaluable when comparing pre/post formula changes.

No APM, no analytics by default (privacy stance per PROJECT.md). Plausible considered in P6 if public metrics are needed.

---

## Sources

- Next.js 15 App Router docs (route segment config, runtime, revalidate) — official, HIGH.
- Vercel Cron Jobs docs (Bearer auth pattern, `vercel.json` schedule, 60s function limits) — official, HIGH.
- `@vercel/postgres` and `@vercel/kv` docs — official, HIGH.
- `react-simple-maps` README + IBGE TopoJSON usage patterns — official + community, MEDIUM.
- `next-intl` App Router setup guide — official, HIGH.
- `risk-formula-v0.md` (in this repo) — authoritative contract for risk engine, HIGH.
- `PROJECT.md` (in this repo) — locked decisions and v1 scope, HIGH.
