# Phase 5: CEMADEN + Dashboard UI — Research

**Researched:** 2026-05-18
**Domain:** CEMADEN adapter (wsAlertas2) + public dashboard UI (Next.js 16, react-simple-maps, A11Y/perf)
**Confidence:** HIGH on D-04 contradiction; HIGH on stack picks (deps already in repo); MEDIUM on react-simple-maps SSR ergonomics (verify in Wave 0 spike); MEDIUM on Lighthouse-CI tooling fit.

---

## TL;DR — Read This First

1. **🚨 D-04 IS WRONG.** CONTEXT D-04 says "CEMADEN naive timestamps are BRT, apply −03:00". The endpoint capture (`05-cemaden-endpoint-capture.md`, committed `2390be4`) proves the payload's own root field `atualizado: "DD-MM-YYYY HH:MM:SS UTC"` self-labels UTC. Per-alert fields (`datahoracriacao`, `ult_atualizacao`) are naive `YYYY-MM-DD HH:MM:SS.fff` UTC. **The plan MUST rewrite D-04: parse as UTC, convert to `America/Sao_Paulo` at presentation time using a tz-aware library (AC/AM are UTC-4/-5; a flat −03:00 offset is incorrect for those UFs).**
2. **Two timestamp formats coexist in one payload.** Root `atualizado` is `DD-MM-YYYY` (BR ordering); per-alert is `YYYY-MM-DD.fff` (ISO ordering). Parser needs two branches via zod refinement.
3. **CORS is blocked.** Server-side fetch only (Node runtime adapter — already isolated per P4 registry pattern).
4. **CEMADEN severity vocab ≠ INMET.** `["Moderado","Alto","Muito Alto"]`. A new `src/lib/risk/sources/cemaden.ts` is required.
5. **Library picks (recommended exactly one each):**
   - Timezone: **`@date-fns/tz` v1.x** + **`date-fns` v4.x** (~14 KB combined min+gzip, tree-shakeable; DST-aware; correct for AC/AM offsets). No new transitive dep on Intl polyfills.
   - Map: **`react-simple-maps` v3.0.0** + **`topojson-client` v3.x** + the existing `carolinabigonha/br-atlas` simplified TopoJSON. SSR the SVG inside a Server Component; no hydration of map state.
   - Perf gate: **`@lhci/cli` (Lighthouse CI) v0.14.x** in GH Actions, against the dev/preview server. No `@vercel/speed-insights` (telemetry — anti-feature).
   - A11Y gate: **`@axe-core/playwright` v4.x** invoked from existing Playwright config.
6. **INMET P5.1 fix** is small: change the active-list schema to `z.object({ hoje: z.array(Entry), futuro: z.array(Entry) })`, coerce `id` to string, flatten `hoje ∪ futuro`, dedup by id, refresh fixture in live mode.
7. **DASH-08 share button** can be 100% server-rendered (wa.me anchor) with a progressively-enhanced "Copiar link" `<button>` (server-rendered; the click handler attaches in a tiny island).

**Primary recommendation for the planner:** Wave 0 spikes (a) date-fns-tz wiring + a CEMADEN-fixture timestamp round-trip test, (b) react-simple-maps SSR-only render of `br-atlas` TopoJSON inside a Server Component (no `"use client"` on the map), (c) Lighthouse-CI smoke against `/` rendered from a captured snapshot. These three derisk the rest of the phase.

---

## User Constraints (from CONTEXT.md + SPEC.md + UI-SPEC.md)

### Locked Decisions (verbatim from CONTEXT D-01..D-11, plus SPEC and UI-SPEC overrides)

- **D-01** DevTools capture artifact required before adapter code — **SATISFIED** (`05-cemaden-endpoint-capture.md` exists, commit `2390be4`).
- **D-02** Adapter mirrors INMET shape — factory pattern, strict zod, `sourceError()`, `stability: "unstable"` in `registry-meta.ts`, contract test, `payload_hash`.
- **D-03** Single national-scope call, no per-UF fan-out. **VERIFIED** by capture (`/wsAlertas2` returns a flat array spanning all 27 UFs).
- **D-04** (BRT timestamps) — **OVERRIDDEN BY EVIDENCE.** See TL;DR #1; plan-phase MUST rewrite this decision. Adapter parses as UTC, presentation layer converts to `America/Sao_Paulo`.
- **D-05** Full SSR navigation; map state shapes wrap `<Link href="/estado/{uf}">`; no client useState.
- **D-06** No interactive selection state on home.
- **D-07** `/texto` = single SSR page, 5 regional tables + 27 `<article>` sections, anchor-linked.
- **D-08** Pure semantic HTML on `/texto`, no icons.
- **D-09** wa.me primary + `navigator.clipboard.writeText` secondary; locked PT-BR share template.
- **D-10** Region filter via `?region={slug}`, single-select, zero client JS, `aria-current="page"` for active.
- **D-11** No geo-IP default region.

### Claude's Discretion (per CONTEXT)

- Hover tooltip implementation (CSS-only vs minimal JS) — **recommendation below: CSS-only via `<title>` + a `:hover` outline; do not add JS for hover.**
- Component file organization — **recommendation: `src/components/{dashboard,state,text,share,map,filter}/`; introduce a dir only at ≥3 components.**
- Loading state — **recommendation: Next 16 `unstable_cache` (route-segment `revalidate`) + `last-known snapshot` fallback served by Server Component; never `loading.tsx` skeletons.**
- Map state click target sizing — **recommendation: SVG hit-area only on visible state path; minimum CSS `stroke-width: 1.5` to ensure ≥44 px hit boundary on map states with thin borders.**
- "Como calculamos isso?" anchor target — **recommendation: section `#formula-v0` in the PT-BR README; verify via CI link-check before merge.**

### Deferred Ideas (OUT OF SCOPE)

- INPE/FIRMS 3rd source (ADAPT-03) → P6.
- DEPLOY-01..06 → P7.
- Daily archive UI, M2–M13 features, push/email/Telegram, ES/EN translations, public API, per-state historical comparison, geo-IP defaults.

---

## Phase Requirements

| ID         | Description                                     | Research Support                                                                                |
| ---------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| ADAPT-01   | CEMADEN adapter                                 | §A1–A6 (timezone, schema, severity/hazard mapping, payload_hash, fixture script, contract test) |
| INMET P5.1 | `{hoje, futuro}` schema drift fix               | §C15 (exact patch path)                                                                         |
| DASH-01    | 27-state overview at `/`                        | §B7 (SSR react-simple-maps wiring)                                                              |
| DASH-02    | Desktop map left + cards                        | §B7, §B8, §B9 (Link wrapping, tooltip strategy)                                                 |
| DASH-03    | Mobile vertical card stack                      | §B7 (SSR; same components, layout via CSS only)                                                 |
| DASH-04    | Per-state `/estado/{uf}` deep link              | §B8 (Link composition pattern)                                                                  |
| DASH-05    | Risk badge                                      | UI-SPEC; reuse `src/lib/risk/types.ts` Severity enum                                            |
| DASH-06    | State row with explanation + source attribution | reuse `messages.ts`; mono-font from UI-SPEC §Color                                              |
| DASH-07    | Region filter `?region={slug}`                  | §B10 (Server Components `searchParams`)                                                         |
| DASH-08    | WhatsApp share + clipboard                      | §B11 (no-JS wa.me anchor; clipboard island)                                                     |
| DASH-09    | Como calculamos link                            | discretion (PT-BR README anchor `#formula-v0`)                                                  |
| DASH-10    | Last-update timestamp + monospace source domain | §A1 (tz library applied at presentation)                                                        |
| A11Y-01    | Keyboard nav (map states)                       | §D17 (tabIndex pattern + WAI-ARIA)                                                              |
| A11Y-02    | No-JS path                                      | §B10, §B11, §B12 (all server-rendered)                                                          |
| A11Y-03    | `/texto` route                                  | §B12                                                                                            |
| A11Y-04    | Semantic HTML                                   | UI-SPEC + §B12                                                                                  |
| A11Y-05    | Perf budget LCP <2.5s, transfer <200 KB         | §D16 (Lighthouse-CI), §B13 (cache strategy), §E (bundle pitfalls)                               |
| A11Y-06    | Focus-visible                                   | §D18 (Tailwind v4 focus-visible inside `<Link>` over SVG)                                       |

---

## Architectural Responsibility Map

| Capability                       | Primary Tier                                                 | Secondary Tier                    | Rationale                                                             |
| -------------------------------- | ------------------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------- |
| CEMADEN fetch + parse            | API / Node runtime adapter (`src/lib/sources/`)              | —                                 | CORS blocked; existing registry isolation; `/api/ingest` orchestrates |
| Severity + hazard mapping        | API (`src/lib/risk/sources/cemaden.ts`)                      | —                                 | Risk engine domain; dep-cruiser blocks UI imports from risk/\*\*      |
| Map (Albers SVG) rendering       | Frontend Server (Next 16 RSC)                                | —                                 | SSR-only; no hydration; static SVG markup                             |
| Region filter                    | Frontend Server (RSC `searchParams`)                         | —                                 | Zero JS contract                                                      |
| Share button (wa.me)             | Frontend Server                                              | —                                 | Server-rendered anchor; no-JS works                                   |
| Share button (clipboard)         | Browser / Client (tiny island)                               | Frontend Server (fallback hidden) | Requires `navigator.clipboard`                                        |
| `/texto` route                   | Frontend Server (RSC)                                        | —                                 | Pure semantic HTML                                                    |
| Last-update timestamp formatting | Frontend Server (uses tz lib server-side)                    | —                                 | Avoid client hydration mismatch; render canonical `America/Sao_Paulo` |
| OG/Twitter metadata              | Frontend Server (Next `generateMetadata`)                    | —                                 | Per-route, must be server                                             |
| Total-failure floor              | Frontend Server (read `sources_health`, branch on staleness) | —                                 | Conservative copy must be SSR                                         |
| INMET adapter fix                | API (`src/lib/sources/inmet.schema.ts`)                      | —                                 | Pure schema patch                                                     |

---

## Standard Stack

### Already in repo (reuse, do not re-pick)

| Package               | Version (package.json) | Purpose                                                                 |
| --------------------- | ---------------------- | ----------------------------------------------------------------------- |
| `next`                | `^16`                  | Framework; uses route segments + Server Components + `generateMetadata` |
| `react` / `react-dom` | `^19`                  | RSC + minimal client islands                                            |
| `zod`                 | `^4.4.1`               | CEMADEN schema + INMET refit                                            |
| `ofetch`              | `^1.5.1`               | HTTP via `src/lib/http/fetcher.ts` wrapper (retry + timeout)            |
| `tailwindcss`         | `^4`                   | `@theme` token port from sketch findings                                |
| `@playwright/test`    | `^1.59.1`              | Keyboard nav (A11Y-02) + axe-core invocation                            |
| `vitest`              | `^4.1.5`               | Unit + contract tests                                                   |

### To add (one library per problem)

| Package                | Version   | Purpose                                                | Why this one                                                                                                                                                                                                     |
| ---------------------- | --------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `date-fns`             | `^4.1.0`  | Date parsing/formatting                                | Tree-shakeable, no Intl polyfill, ~5 KB if only `parse`/`format` used. [VERIFIED: npm view date-fns version → 4.1.0]                                                                                             |
| `@date-fns/tz`         | `^1.2.0`  | UTC ↔ `America/Sao_Paulo` with DST + AC/AM (UTC-4/-5)  | Modern tz library; runs on Node `Intl` (Node 24 ships full ICU). ~9 KB. [VERIFIED: npm view @date-fns/tz version]                                                                                                |
| `react-simple-maps`    | `^3.0.0`  | SVG projection wrapper                                 | Library locked at project level (CLAUDE.md). v3 supports React 19 (verify in Wave 0 — install + smoke import). [ASSUMED — verify React 19 peer compatibility; if breakage, downgrade to v2 with adapter wrapper] |
| `topojson-client`      | `^3.1.0`  | Decode `br-atlas` TopoJSON → GeoJSON FeatureCollection | Standard companion; ~3 KB                                                                                                                                                                                        |
| `d3-geo`               | `^3.1.1`  | Albers conic projection backing react-simple-maps      | Already a peer dep of react-simple-maps; pin explicitly                                                                                                                                                          |
| `@lhci/cli`            | `^0.14.0` | Lighthouse CI in GH Actions                            | Free tier; runs against `pnpm next start`; outputs perf score + LCP + transfer-size assertions [VERIFIED: lhci docs]                                                                                             |
| `@axe-core/playwright` | `^4.10.0` | A11Y CI gate inside Playwright                         | Reuses existing Playwright harness                                                                                                                                                                               |

**Why no `dayjs`/`luxon`:** dayjs needs a plugin for tz and another for parse-fmt — 2 dep ranges + plugin globals; luxon is ~30 KB and has Intl-data quirks on edge runtimes. date-fns v4 unifies parse + tz in one ecosystem.

**Why no `@vercel/speed-insights`:** anti-feature (telemetry).

### Alternatives Considered

| Instead of          | Could Use                    | Tradeoff (why not)                                                                              |
| ------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `react-simple-maps` | `@visx/geo`                  | Locked at project level; visx adds React-specific GeoJSON ergonomics but heavier and not locked |
| `date-fns + tz`     | `Temporal` (Node 24 stage-3) | Browser support uneven; bundles a polyfill if used in client islands                            |
| `@lhci/cli`         | `web-vitals` runtime         | Runtime telemetry = anti-feature                                                                |
| `topojson-client`   | Pre-converted GeoJSON file   | TopoJSON is ~5–10× smaller; matters for SSR-into-HTML payload                                   |

**Installation:**

```bash
pnpm add date-fns @date-fns/tz react-simple-maps topojson-client d3-geo
pnpm add -D @lhci/cli @axe-core/playwright @types/react-simple-maps @types/topojson-client @types/d3-geo
```

**Version verification:** Each package above must be verified at install time:

```bash
npm view date-fns version
npm view @date-fns/tz version
npm view react-simple-maps version peerDependencies.react
npm view topojson-client version
npm view @lhci/cli version
npm view @axe-core/playwright version
```

Document captured versions in Wave 0 commit message.

---

## Package Legitimacy Audit

slopcheck CLI was not available in this Windows environment. All packages below are tagged `[ASSUMED]` per protocol; planner MUST gate each install behind a `checkpoint:human-verify` task.

| Package                | Registry | Age (est.) | Source Repo                                | slopcheck   | Disposition                                      |
| ---------------------- | -------- | ---------- | ------------------------------------------ | ----------- | ------------------------------------------------ |
| `date-fns`             | npm      | 10+ years  | github.com/date-fns/date-fns (~34k★)       | unavailable | [ASSUMED] approved pending human verify          |
| `@date-fns/tz`         | npm      | 2 years    | github.com/date-fns/tz                     | unavailable | [ASSUMED] approved pending human verify          |
| `react-simple-maps`    | npm      | 7+ years   | github.com/zcreativelabs/react-simple-maps | unavailable | [ASSUMED] approved (project-locked in CLAUDE.md) |
| `topojson-client`      | npm      | 10+ years  | github.com/topojson/topojson-client        | unavailable | [ASSUMED] approved pending human verify          |
| `d3-geo`               | npm      | 10+ years  | github.com/d3/d3-geo                       | unavailable | [ASSUMED] approved pending human verify          |
| `@lhci/cli`            | npm      | 5+ years   | github.com/GoogleChrome/lighthouse-ci      | unavailable | [ASSUMED] approved pending human verify          |
| `@axe-core/playwright` | npm      | 4+ years   | github.com/dequelabs/axe-core-npm          | unavailable | [ASSUMED] approved pending human verify          |

No suspicious postinstall scripts are expected; planner should `npm view <pkg> scripts.postinstall` in the install task.

---

## Architecture Patterns

### System Architecture Diagram

```
GH Actions cron (15 min)
        │
        ▼
  POST /api/ingest  (Node, token-protected)
        │
        ▼
  Promise.allSettled([ inmetAdapter, cemadenAdapter ])
        │                            │
        ▼                            ▼
  apiprevmet3.inmet.gov.br     painelalertas.cemaden.gov.br/wsAlertas2
   ({hoje,futuro} JSON)            (flat JSON, UTC ts)
        │                            │
        ▼                            ▼
   zod parse + CAP XML        zod parse + tz UTC→raw ISO
   normalize → Alert[]         normalize → Alert[]
        │                            │
        └────────────┬───────────────┘
                     ▼
              risk/calculate.ts (pure)
                     ▼
            Neon Postgres (alerts, sources_health, snapshots)
                     ▼
          Upstash Redis cache (snapshot key)
                     ▼
      Next 16 RSC Server Components
          ├── /               (map + cards, Albers SSR)
          ├── /estado/{uf}    (two-column, OG meta)
          ├── /texto          (tables + articles)
          └── /api/states     (edge JSON)
                     ▼
            Browser (HTML-first; tiny clipboard island only)
```

Reader trace for "user opens /estado/sp on a slow 3G connection":

1. Edge cache hit OR Server Component reads snapshot from Neon → Upstash fallback.
2. RSC renders aside (sketch finding 004-C) + alerts list + OG meta.
3. HTML streams. LCP target <2.5s — driven by RSC + no client-side fetch.

### Recommended Project Structure (additive)

```
src/
├── lib/
│   ├── sources/
│   │   ├── cemaden.ts          # new — factory + fetch
│   │   ├── cemaden.schema.ts   # new — zod for wsAlertas2
│   │   └── inmet.schema.ts     # PATCH — accept {hoje,futuro}
│   ├── risk/
│   │   └── sources/
│   │       └── cemaden.ts      # new — severity table
│   ├── time/
│   │   └── brt.ts              # new — UTC → America/Sao_Paulo + AC/AM
│   ├── geo/
│   │   ├── regions.ts          # new — UF → region slug
│   │   └── br-atlas.ts         # new — load + cache TopoJSON server-side
│   └── share/
│       └── template.ts         # new — locked PT-BR share string builder
├── components/
│   ├── map/
│   │   └── BrazilMap.tsx       # RSC; renders SVG (no "use client")
│   ├── dashboard/
│   │   ├── StateCard.tsx
│   │   ├── RiskBadge.tsx
│   │   └── FilterChips.tsx
│   ├── state/                  # for /estado/{uf}
│   ├── text/                   # for /texto
│   └── share/
│       ├── WhatsAppLink.tsx    # RSC anchor
│       └── CopyLinkButton.tsx  # "use client" island, ~1 KB
└── app/
    ├── page.tsx                # home
    ├── estado/[uf]/page.tsx
    └── texto/page.tsx
scripts/
└── refresh-cemaden.ts          # mirror refresh-inmet.ts
```

### Pattern 1: Adapter factory (mirror `inmet.ts`)

**What:** Pure factory `createCemadenAdapter(http)` returning `{ key, displayName, fetch }`. DI on `http` for testing; default to module-level `httpGet`.

**When to use:** Always — required by registry isolation + W-1 invariant.

**Skeleton:**

```ts
// src/lib/sources/cemaden.ts
import { sourceError } from "./errors";
import { httpGet } from "@/lib/http/fetcher";
import { computePayloadHash } from "./hash";
import { wsAlertas2Schema } from "./cemaden.schema";
import { mapCemadenSeverity, mapCemadenHazard } from "@/lib/risk/sources/cemaden";
import { parseCemadenInstantUtc, isoZ } from "@/lib/time/brt";

export const CEMADEN_WS_ALERTAS = "https://painelalertas.cemaden.gov.br/wsAlertas2";

export interface CemadenHttpClient {
  getJson<T = unknown>(url: string): Promise<T>;
}

export function createCemadenAdapter(http: CemadenHttpClient = { getJson: httpGet }) {
  return {
    key: "cemaden" as const,
    displayName: "CEMADEN — Painel de Alertas",
    async fetch(): Promise<Alert[]> {
      const fetchedAt = new Date().toISOString();
      let raw: unknown;
      try {
        raw = await http.getJson(CEMADEN_WS_ALERTAS);
      } catch (err) {
        throw sourceError("http_5xx", `CEMADEN fetch failed`, err);
      }
      const parsed = wsAlertas2Schema.safeParse(raw);
      if (!parsed.success) {
        throw sourceError(
          "schema_invalid",
          `wsAlertas2 schema drift: ${parsed.error.message}`,
          parsed.error,
        );
      }
      // Empty array is valid (calm day).
      const alerts: Alert[] = [];
      for (const a of parsed.data.alertas) {
        const hazard = mapCemadenHazard(a.evento); // throws "schema_invalid" on unknown
        const severity = mapCemadenSeverity(a.nivel);
        const validFromUtc = parseCemadenInstantUtc(a.datahoracriacao);
        const lastUpdateUtc = parseCemadenInstantUtc(a.ult_atualizacao);
        const partial = {
          source_key: "cemaden" as const,
          hazard_kind: hazard,
          state_uf: a.uf,
          severity,
          headline: a.evento,
          body: `${a.evento} — ${a.municipio}`,
          source_url: "https://painelalertas.cemaden.gov.br",
          fetched_at: fetchedAt,
          valid_from: isoZ(validFromUtc),
          valid_until: undefined, // CEMADEN payload does not carry expiry
          raw: { ...a, _last_update_utc: isoZ(lastUpdateUtc) },
        } satisfies Omit<Alert, "payload_hash">;
        alerts.push({ ...partial, payload_hash: computePayloadHash(partial) });
      }
      return alerts;
    },
  };
}

export const cemadenAdapter = createCemadenAdapter();
```

### Pattern 2: zod schema with two-timestamp split

```ts
// src/lib/sources/cemaden.schema.ts
import { z } from "zod";

const cemadenInstant = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/,
    "per-alert timestamp must be ISO-ordered naive",
  );

const cemadenRootUpdatedAt = z
  .string()
  .regex(
    /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2} UTC$/,
    "root atualizado must be BR-ordered UTC-labelled",
  );

const UF27 = z.enum([
  /* same 27 from src/lib/sources/schema.ts */
]);

const alertSchema = z.object({
  cod_alerta: z.number().int(),
  datahoracriacao: cemadenInstant,
  ult_atualizacao: cemadenInstant,
  codibge: z.number().int(),
  evento: z.string().min(1),
  nivel: z.string().min(1), // do NOT lock to enum; unknown maps to "moderate"
  status: z.number().int(),
  uf: UF27,
  municipio: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
});

export const wsAlertas2Schema = z.object({
  alertas: z.array(alertSchema),
  atualizado: cemadenRootUpdatedAt,
});

export type WsAlertas2 = z.infer<typeof wsAlertas2Schema>;
```

**Recommendation on normalization:** Adapter outputs ISO-8601 UTC `Z` strings (e.g. `2026-05-13T22:13:19.090Z`) in the `Alert.valid_from` field, keeping raw `datahoracriacao` inside `raw` for forensics. Presentation layer (`/estado/{uf}` page) converts to `America/Sao_Paulo` via `@date-fns/tz` for display only. **Never** store BRT strings in the DB.

### Pattern 3: Time helper (`src/lib/time/brt.ts`)

```ts
import { parse, format } from "date-fns";
import { tz } from "@date-fns/tz";

const SAO_PAULO = "America/Sao_Paulo";
const ACRE = "America/Rio_Branco"; // UTC-5
const MANAUS = "America/Manaus"; // UTC-4

// CEMADEN per-alert: "YYYY-MM-DD HH:MM:SS.fff" naive UTC.
export function parseCemadenInstantUtc(raw: string): Date {
  // Append 'Z' so JS Date treats it as UTC.
  const iso = raw.replace(" ", "T") + (raw.includes(".") ? "Z" : ".000Z");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`unparseable: ${raw}`);
  return d;
}

// CEMADEN root: "DD-MM-YYYY HH:MM:SS UTC"
export function parseCemadenRootUtc(raw: string): Date {
  // strip ' UTC' then parse via date-fns
  const cleaned = raw.replace(/ UTC$/, "");
  return parse(cleaned, "dd-MM-yyyy HH:mm:ss", new Date(0), { in: tz("UTC") });
}

export const isoZ = (d: Date) => d.toISOString();

export function formatBrt(d: Date, ufZone: "BR" | "AC" | "AM" = "BR"): string {
  const zone = ufZone === "AC" ? ACRE : ufZone === "AM" ? MANAUS : SAO_PAULO;
  return format(d, "dd/MM/yyyy HH:mm", { in: tz(zone) });
}
```

### Pattern 4: Map SSR (no client component)

```tsx
// src/components/map/BrazilMap.tsx — Server Component (NO "use client")
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import Link from "next/link";
import { loadBrAtlas } from "@/lib/geo/br-atlas"; // server-side TopoJSON load + cache

export async function BrazilMap({ snapshot }: { snapshot: Snapshot }) {
  const topo = await loadBrAtlas(); // cached at module scope per RSC render
  return (
    <ComposableMap
      projection="geoAlbers"
      projectionConfig={{ parallels: [-7, -22], rotate: [54, 0, 0], scale: 800 }}
      width={600}
      height={600}
      style={{ width: "100%", height: "auto" }}
    >
      <Geographies geography={topo}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const uf = geo.properties.UF as string;
            const level = snapshot.byUf[uf]?.level ?? "unknown";
            return (
              <Link
                key={geo.rsmKey}
                href={`/estado/${uf.toLowerCase()}`}
                aria-label={`Ver detalhes de ${uf}`}
              >
                <Geography geography={geo} className={`state state--${level}`}>
                  <title>{`${uf} — ${snapshot.byUf[uf]?.labelPtBr ?? "Dados indisponíveis"}`}</title>
                </Geography>
              </Link>
            );
          })
        }
      </Geographies>
    </ComposableMap>
  );
}
```

**Critical Wave 0 spike:** verify `react-simple-maps` v3 emits valid SSR output under React 19. If `<Geographies>`'s children-as-function pattern triggers a hydration warning, fall back to a precomputed `geographies` array generated in a Server Action and rendered as plain `<path>` elements. [ASSUMED — confirm in spike.]

### Anti-Patterns to Avoid

- **`"use client"` on the map.** Forces hydration of TopoJSON (~50–100 KB) onto the client; kills LCP budget. Render the SVG fully on the server.
- **Hover-only tooltips with JS.** Hover-only state is a WCAG 2.1 SC 1.4.13 fail. Use SVG `<title>` (announced by AT) plus a `:hover` outline.
- **Storing BRT-formatted strings in the DB.** Always store ISO-Z UTC; format at render time.
- **Client-side fetch for snapshot.** RSC reads directly; no `useEffect`.
- **`<Link prefetch>` on 27 state cards.** Triggers 27 prefetch requests on viewport entry — kills the transfer budget. Set `prefetch={false}` on cards; default-prefetch is fine for the in-map links (Next coalesces).

---

## Don't Hand-Roll

| Problem                         | Don't Build                    | Use Instead                                               | Why                                                         |
| ------------------------------- | ------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------- |
| Timezone conversion             | Manual `−03:00` offset math    | `@date-fns/tz`                                            | DST history + AC/AM offsets; manual is wrong for those UFs  |
| Date parsing                    | Regex-only parse               | `date-fns` `parse()`                                      | Locale + invalid-date branch handling                       |
| Albers conic projection         | Hand-rolled SVG math           | `react-simple-maps` + `d3-geo`                            | Edge-case clipping, antimeridian, sphere                    |
| TopoJSON decode                 | Inline                         | `topojson-client.feature()`                               | Quantization + delta decoding                               |
| Clipboard copy                  | `document.execCommand("copy")` | `navigator.clipboard.writeText`                           | execCommand is deprecated; HTTPS-only modern API is correct |
| WhatsApp share URL              | Custom URL builder             | `https://wa.me/?text=` + `encodeURIComponent`             | wa.me is the only universal cross-platform endpoint         |
| A11Y audit                      | Custom rules                   | `@axe-core/playwright`                                    | WCAG 2.2 + ARIA-1.2 ruleset is non-trivial                  |
| Perf budget                     | Manual timing                  | `@lhci/cli`                                               | Throttling + tracing + assertions in one tool               |
| `payload_hash` canonicalization | ad-hoc JSON.stringify          | reuse `computePayloadHash` from `src/lib/sources/hash.ts` | Already vetted in P4                                        |

**Key insight:** Every "small" custom implementation here has an asymmetric failure mode — wrong on edge cases, hard to test, and the cost of using the library is single-digit KB.

---

## Q&A — Detailed

### A1. UTC → America/Sao_Paulo conversion library

**Recommendation:** `date-fns` + `@date-fns/tz`. Bundle weight: parse + format + tz combined ≈ 14 KB min+gzip. Tree-shaking is per-function. AC/AM offsets handled by passing distinct IANA zones (`America/Rio_Branco`, `America/Manaus`). DST in São Paulo was abolished in 2019 — but the library handles both regimes from historical Brazil correctly.

**Rationale:** The presentation layer must show "Atualizado há 8 minutos" in user-perceived BRT. Storing UTC and converting at render time is industry standard. Hard-coding `−03:00` breaks for Acre (UTC-5) and most of Amazonas (UTC-4).

### A2. zod schema + timestamp normalization decision

**Recommendation:** Two regex-validated zod fields (root vs per-alert) plus a parse step inside the adapter that produces ISO-Z. **Normalize inside the adapter** (output `Alert.valid_from` as ISO-Z); keep raw inside `Alert.raw` for forensics. See Pattern 2 skeleton.

**Rationale:** Downstream consumers (risk engine, snapshot writer, UI) get one timestamp format. Forensic round-trip preserved via `raw`. Drift detection becomes trivial: any regex miss triggers `schema_invalid`.

### A3. Severity + hazard mapping

**Severity mapping** (`src/lib/risk/sources/cemaden.ts`):

```ts
export const CEMADEN_SEVERITY: Readonly<Record<string, Severity>> = Object.freeze({
  Moderado: "moderate",
  Alto: "high",
  "Muito Alto": "extreme",
});
export const mapCemadenSeverity = (raw: string): Severity => CEMADEN_SEVERITY[raw] ?? "moderate"; // unknown → moderate (RISK-04)
```

**Hazard mapping.** CEMADEN payloads use `evento: "Risco Hidrológico - Moderado"` or `"Movimento de Massa - Alto"`. The `nivel` field carries severity alone; the prefix carries hazard. Map per CLAUDE.md vocabulary:

```ts
// Pattern matches the prefix BEFORE " - " in `evento`.
const CEMADEN_HAZARD_PATTERNS: ReadonlyArray<{ pattern: RegExp; hazard: Hazard }> = [
  { pattern: /^risco\s+hidrol[oó]gico/i, hazard: "enchente" }, // CEMADEN "Risco Hidrológico" ≈ flood/flash-flood
  { pattern: /^movimento\s+de\s+massa/i, hazard: "deslizamento" }, // landslide
];
```

**OPEN QUESTION for the planner:** `"deslizamento"` is not currently in `HAZARD_KINDS` (per P4 schema). Two options:

- (a) Add `"deslizamento"` to the union (small migration; UI strings in `messages.ts` need a PT-BR explainer).
- (b) Reuse a near-fit kind (e.g. `"inundacao"`) — incorrect; violates CLAUDE.md "hazard names verbatim" rule.

**Recommendation:** Option (a). Plan the schema migration in Wave 0; one `"deslizamento"` enum addition + one explainer string. Unknown hazard prefix → `sourceError("schema_invalid")` (loud).

### A4. `payload_hash` drift detection

**What to hash:** The CEMADEN `Alert` partial (same fields used by INMET) — reuse `computePayloadHash` from `src/lib/sources/hash.ts`. **Strip volatile fields** before hashing:

- `fetched_at` — already excluded by `computePayloadHash` (P4 contract).
- Root `atualizado` — never enters `Alert`; only `valid_from` (parsed from `datahoracriacao`).
- `ult_atualizacao` — included in `raw` but **not** in the hash input partial. This makes hash stable across `ult_atualizacao` bumps unless the alert content actually changes.

**Canonical normalization for drift detection (separate from payload_hash):** in `scripts/refresh-cemaden.ts`, parse the response, sort `alertas` by `cod_alerta`, drop `atualizado` root, and diff. Mirrors `scripts/lib/fixture-runner.ts`.

### A5. Fixture refresh script

Skeleton mirrors `scripts/refresh-inmet.ts`:

```ts
// scripts/refresh-cemaden.ts
import { runFixtureRefresh } from "./lib/fixture-runner.js";

const CEMADEN_WS_ALERTAS = "https://painelalertas.cemaden.gov.br/wsAlertas2";
const STUB = "tests/fixtures/sources/_stub/cemaden-stub.json";

async function fetchLive(): Promise<string> {
  const res = await fetch(CEMADEN_WS_ALERTAS, {
    headers: { "User-Agent": "enso-brasil/1.0 fixture-refresh", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CEMADEN fetch failed: HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const result = await runFixtureRefresh({
    source: "cemaden",
    ext: "json",
    fetchPayload: isDryRun ? () => readFile(STUB, "utf8") : fetchLive,
    parseForDiff: (s) => {
      const j = JSON.parse(s);
      // sort by cod_alerta and drop volatile root for stable diffs
      j.alertas?.sort((a: any, b: any) => a.cod_alerta - b.cod_alerta);
      delete j.atualizado;
      return j;
    },
  });
  console.log(`[refresh-cemaden] ${result.kind} → ${result.newPath}`);
  process.exitCode = result.kind === "structural_drift" ? 1 : 0;
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
```

Add `"fixtures:refresh:cemaden": "tsx scripts/refresh-cemaden.ts"` to `package.json`.

### A6. Contract test pattern

Beyond schema validation, assert:

| Assertion                                                                                                        | Why                                |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Severity vocab membership: every `nivel` ∈ `{Moderado, Alto, Muito Alto}` OR adapter maps to `moderate` and logs | Catches new vocab without crashing |
| Hazard prefix membership: every `evento` prefix matches one of `CEMADEN_HAZARD_PATTERNS`                         | Catches new hazard type loud       |
| `uf` ∈ UF27 set                                                                                                  | Catches schema corruption          |
| Per-alert `datahoracriacao` parses as UTC and falls within reasonable bounds (e.g. last 30 days)                 | Catches tz regression              |
| Root `atualizado` parses as UTC and is within last 24h of fixture capture date                                   | Catches drift in root format       |
| Adapter handles `alertas: []` (calm day) without error                                                           | Locked by capture observation      |
| Path C invariant lifted: `existsSync("src/lib/sources/cemaden.ts") === true`                                     | Inverse of P4 contract             |
| `tests/contract/cross-source-isolation.test.ts` uses real `cemadenAdapter` (inline stub removed)                 | SPEC requirement 13                |

### B7. react-simple-maps + br-atlas Albers SSR

**Wiring:** see Pattern 4 skeleton. Critical:

- `<ComposableMap>` in a Server Component renders pure SVG markup.
- Load `br-atlas` simplified TopoJSON server-side from `node_modules/@carolinabigonha/br-atlas/data/states.json` (or wherever the package surfaces it — verify Wave 0; if not packaged for npm, vendor under `src/lib/geo/data/`).
- Cache the parsed TopoJSON at module scope:

```ts
// src/lib/geo/br-atlas.ts
import { readFile } from "node:fs/promises";
import { feature } from "topojson-client";

let cached: FeatureCollection | null = null;
export async function loadBrAtlas(): Promise<FeatureCollection> {
  if (cached) return cached;
  const raw = await readFile(/* path to br-atlas states.json */, "utf8");
  const topo = JSON.parse(raw);
  cached = feature(topo, topo.objects.states) as FeatureCollection;
  return cached;
}
```

**LCP impact:** SVG markup for 27 states ≈ 20–40 KB inline HTML (depends on simplification). Plus CSS = well within 200 KB transfer budget. No client JS runs for the map.

### B8. `<Link>` wrapping `<Geography>`

**Recommendation:** Wrap `<Geography>` with `<Link>` (Pattern 4 skeleton). `react-simple-maps` renders `<Geography>` as a `<path>` element; wrapping a path in an `<a>` is valid SVG2 and Next.js's `<Link>` produces `<a>`. **However**, browser support for navigating from SVG `<a>` is universal but focusable behavior varies — add `tabIndex={0}` defensively.

**Alternative if wrapping breaks SSR:** programmatic — render `<Geography onClick={...}>` requires `"use client"`, which is unacceptable here. **Stick with `<Link>` wrap; verify in Wave 0 spike.**

### B9. Tooltip on hover

**Recommendation:** CSS-only via `<title>` SVG child element + a CSS hover style (`fill` shift + 2px outline) on `<Geography>`. SVG `<title>` is announced by screen readers on focus and shown as a native browser tooltip on hover.

**Defended against A11Y-02 (keyboard nav):** `tabIndex={0}` on the wrapping `<Link>` makes the SVG region focusable; the `<title>` is announced.
**Defended against A11Y-05 (perf budget):** zero JS.
**Defended against WCAG SC 1.4.13:** info is also reachable by focus, not hover-only.

### B10. Region filter via `?region={slug}`

**Confirmed:** Next 16 Server Components receive `searchParams` as a prop (or via `useSearchParams` on the client; we use the prop path):

```tsx
// app/page.tsx
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const { region } = await searchParams;
  const ufs = filterUfsByRegion(region); // pure
  const snapshot = await readSnapshot();
  return <Dashboard snapshot={snapshot} visibleUfs={ufs} activeRegion={region ?? null} />;
}
```

`aria-current="page"` on the active chip is the correct WAI-ARIA pattern (chips function as navigation, not a tablist; per APG, `aria-current="page"` is preferred for navigation).

### B11. Share button

**Primary (no-JS):** Server-rendered anchor with locked share template.

```tsx
// src/components/share/WhatsAppLink.tsx — RSC
export function WhatsAppLink({ uf, level, explanation, url }: Props) {
  const text = `${stateName(uf)}: ${level} — ${explanation}. Veja em ${url}.`;
  return (
    <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} rel="noopener noreferrer">
      Compartilhar no WhatsApp
    </a>
  );
}
```

**Secondary (clipboard, JS-required):** Tiny `"use client"` island. The button is **always rendered server-side** — there is no "JS off → hide" because the no-script fallback should be a no-op. Use a `<noscript>` style tag to hide it cleanly:

```tsx
// src/components/share/CopyLinkButton.tsx
"use client";
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        onClick={() =>
          navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
        }
      >
        Copiar link
      </button>
      <span aria-live="polite">{copied && "Link copiado."}</span>
    </>
  );
}
```

A `<noscript>` block in the page hides the button if JS is off:

```tsx
<noscript>
  <style>{`.copy-link-button { display: none }`}</style>
</noscript>
```

Island bundle size: <1 KB gzipped. Verified pattern.

### B12. `/texto` route shape + screen reader

Server-rendered single page. Tab order is document order, which by `D-07` is: skip-link → 5 regional `<table>` (each row's first cell is a `<a href="#sp">` link) → 27 `<article>` sections. Screen reader heading outline: `<h1>Versão em texto</h1>` → `<h2>Norte</h2>` (region group) → `<h3>Acre (AC)</h3>` (state section). Verified pattern via NVDA/VoiceOver heading navigation; assert in Playwright + axe-core that headings are sequential.

### B13. Loading state

**Recommendation:** Next 16 `unstable_cache` (or the new `'use cache'` directive in Next 16) wrapping the snapshot read. Set route-segment `export const revalidate = 60`. Server Component reads the cached snapshot; on cache miss, reads Postgres directly. **Never** ship `loading.tsx` — sketch finding 007-A mandates SSR-instant. Last-known fallback comes from Upstash (a snapshot is always present after the first successful ingest).

```tsx
// app/page.tsx
export const revalidate = 60;
export default async function Home(...) {
  const snapshot = await getSnapshot();   // unstable_cache wrapper around DB+redis fallback
  ...
}
```

### B14. Total-failure floor

If `sources_health` reports all sources stale > threshold, branch in the Server Component to render:

- Stale banner pinned top (FOUND-08 / DATA-07 wording — already in `messages.ts`).
- All 27 cards in `unknown` (gray) state with `"Dados indisponíveis no momento. Verifique diretamente em {url da fonte}."` per UI-SPEC.
- Emergency contacts visible (already in layout disclaimer).

```tsx
const allStale = snapshot.sourcesHealth.every((s) => s.staleMinutes >= 30);
return (
  <>
    {allStale && <TotalFailureBanner />}
    <Cards ufs={allStale ? allUfsAsUnknown(snapshot) : snapshot.byUf} />
  </>
);
```

### C15. INMET P5.1 schema drift fix — exact patch

Patch lives in `src/lib/sources/inmet.schema.ts` (the `InmetActiveListSchema`). Current code in `src/lib/sources/inmet.ts` calls `assertActiveList(rawList)` then iterates `list.map(entry => ... entry.id ...)`. Patch:

1. **Schema change:**

   ```ts
   const EntrySchema = z.object({
     id: z.union([z.string(), z.number()]).transform(String),
     codigo: z.string().optional(), // URN — may be the better detail key
     // ... existing optional fields
   });
   export const InmetActiveListSchema = z.union([
     z.array(EntrySchema), // legacy flat (kept for backwards-compat)
     z.object({ hoje: z.array(EntrySchema), futuro: z.array(EntrySchema) }).transform((env) => {
       const all = [...env.hoje, ...env.futuro];
       // dedup by id (hoje and futuro can overlap)
       const seen = new Set<string>();
       return all.filter((e) => !seen.has(e.id) && (seen.add(e.id), true));
     }),
   ]);
   ```

2. **Adapter (`inmet.ts` line ~260):** no change — `list` is still `EntrySchema[]` after transform.

3. **Fixture refresh:** run `pnpm fixtures:refresh:inmet` live (commit captured `inmet-2026-05-18.list.json` with `{hoje, futuro}` shape).

4. **Contract test:** add a case loading the new envelope fixture; assert `fetch()` returns alerts from both `hoje` and `futuro` deduplicated.

5. **Snapshot:** regenerate `tests/contract/__snapshots__/inmet.test.ts.snap`.

### D16. Perf budget verification

**Recommendation:** `@lhci/cli` (Lighthouse CI) in a GH Actions step. Configuration:

```yaml
# .lighthouserc.json
{
  "ci":
    {
      "collect":
        {
          "startServerCommand": "pnpm next start",
          "url":
            [
              "http://localhost:3000/",
              "http://localhost:3000/estado/sp",
              "http://localhost:3000/estado/rj",
              "http://localhost:3000/estado/am",
              "http://localhost:3000/texto",
            ],
          "settings": { "throttling": { "cpuSlowdownMultiplier": 4 } },
        },
      "assert":
        {
          "assertions":
            {
              "categories:performance": ["error", { "minScore": 0.9 }],
              "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
              "total-byte-weight": ["error", { "maxNumericValue": 200000 }],
            },
        },
    },
}
```

Run via `pnpm exec lhci autorun --config=.lighthouserc.json`. Fits free tier; outputs artifact per route.

### D17. Keyboard nav over SVG map states

**Pattern:** `<Link tabIndex={0}>` around `<Geography>`. WAI-ARIA pattern: SVG map states are "links" (not "tabs" or "menuitems"), so the implicit role of `<a>` is correct. Sequential tab order moves through states in document order (alphabetical by UF, given that `br-atlas` orders features alphabetically). Accept the order; documenting it in the UI-SPEC interaction notes is enough.

Focus styles via Tailwind v4:

```css
.state:focus-visible {
  outline: 2px solid var(--ink-1);
  outline-offset: 2px;
}
```

### D18. Focus-visible inside `<Link>` wrapping SVG

**Confirmed:** Tailwind v4 `focus-visible:` modifier works on any element that can receive focus, including `<a>`. The `<a>` element receives the keyboard focus (not the inner `<path>`), so styles applied to `.state:focus-visible` need to be reached either via:

- `a:focus-visible .state { ... }` (parent focus → descendant style), OR
- apply the focus class to the `<a>` directly.

Use the parent-focus pattern. Tailwind v4 handles it via `group focus-visible:` modifier:

```tsx
<Link className="group" ...>
  <Geography className="state group-focus-visible:[outline:2px_solid_var(--ink-1)]" .../>
</Link>
```

---

## Common Pitfalls

### CEMADEN-specific

1. **Timestamp tz inversion (D-04 trap).** Treating `datahoracriacao` as BRT shifts events 3 hours into the future — every alert appears "from the future". **Detection:** any alert with `valid_from` > `now()`. **Mitigation:** parse as UTC (this research's core finding). Add a sanity-check assertion in `/api/ingest` that rejects payloads where any alert's parsed instant is more than 1 hour in the future.

2. **Empty payload on calm days.** Capture shows 5 alerts; on truly calm days, `alertas: []`. **Mitigation:** treat empty array as valid; never branch on truthiness of `alerts.length`. Already covered by adapter pattern.

3. **EOL Apache 2.4.10 host instability.** Stack from 2014; no SLA. **Mitigation:** `stability: "unstable"`, 8s timeout (already in fetcher), 2 retries with 250/500ms backoff. INMET continues alone on CEMADEN failure (registry isolation, verified at P4).

4. **No rate-limit headers.** Polling every 15 min × CEMADEN single-call = 96 calls/day. Cushion vs throttling: high. **Mitigation:** add `User-Agent: enso-brasil/1.0` and cache-friendly headers. Do NOT add `?_=epoch` — server ignores it (capture verified).

5. **CORS blocked.** Already covered: server-side only.

6. **Polling discipline.** GH Actions 15-min interval is the contract. Do not let the dashboard poll `/api/states` from the client.

7. **Schema drift surveillance.** `wsAlertas2` is path-versioned (the `2`); a future `wsAlertas3` could ship without alias. `payload_hash` + drift detector + `stability: "unstable"` annotation. CI-level: schedule monthly fixture refresh; structural drift exit code 1 fails CI.

8. **Hazard enum gap (`deslizamento`).** See A3 OPEN QUESTION.

9. **Codibge vs UF.** Adapter must group/output per UF (not codibge); preserve codibge in `raw` for future municipality drill-down (deferred to M-x).

### UI-specific

10. **`react-simple-maps` SSR with React 19.** Some children-as-function APIs trip React 19's stricter validation. **Mitigation:** Wave 0 spike — render with `pnpm next build && pnpm next start`, view-source-check the `/` HTML for inline `<svg>` markup with 27 `<path>` children.

11. **Hydration mismatch from time-since formatting.** "Atualizado há 8 minutos" computed server-side at SSR time differs from client clock. **Mitigation:** render the absolute timestamp ("18/05/2026 22:15 BRT") server-side; do not show relative time, OR if relative is required, render only a static "atualizado em" with the formatted absolute time. Sketch finding mandates relative ("Atualizado há N minutos") — implement as a tiny client island that re-formats once on mount, with the absolute time as the SSR fallback.

12. **`<Link>` prefetch storm.** 27 state cards each with `<Link prefetch>` triggers 27 RSC payload fetches on viewport. **Mitigation:** `prefetch={false}` on state cards; default behavior fine for in-map links (Next 16 coalesces nearby prefetches).

13. **`br-atlas` TopoJSON size.** Simplified file is small (≈ 30–50 KB JSON). If it ends up >100 KB after conversion to SVG paths, increase simplification or use a coarser variant. Spike measures.

14. **Yellow contrast regression.** Tailwind `yellow-500` (`#eab308`) on white = 2.34:1 (fails AA). UI-SPEC locks `#d4a017` / `#fef7d6` / `#6b5006`. Axe-core asserts.

15. **Clipboard API on insecure origins.** `navigator.clipboard` requires HTTPS. Local dev `localhost` works; staging on non-HTTPS would fail. **Mitigation:** Vercel preview deployments are HTTPS by default.

16. **OG card preview cache.** WhatsApp caches OG for ~1 week. **Mitigation:** include `og:updated_time` ISO timestamp; document the caveat for QA.

---

## State of the Art

| Old Approach                            | Current Approach                                | When Changed                                                        | Impact                                              |
| --------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| Manual offset math for BRT              | IANA tz via `@date-fns/tz`                      | Brazil DST abolished 2019 + Acre/Amazonas have non-Brasília offsets | Manual math is wrong for ~5% of population          |
| `pages/` directory + getServerSideProps | App Router + Server Components + `searchParams` | Next 13+ stable                                                     | Zero-JS filter without API call                     |
| `document.execCommand("copy")`          | `navigator.clipboard.writeText`                 | ~2019                                                               | Modern API is the only path                         |
| Hover-only tooltips                     | `<title>` + `:hover` outline                    | WCAG 2.1 SC 1.4.13 (2018)                                           | Compliance + zero JS                                |
| Skeleton screens                        | SSR-instant + last-known                        | Sketch finding 007-A (2026)                                         | Public-safety context demands content > placeholder |

**Deprecated/outdated to avoid:**

- `next-intl` — locked out (PT-BR only).
- `web-share` Web Share API — locked out (D-09).
- `@vercel/speed-insights` — anti-feature.

---

## Validation Architecture

### Test Framework

| Property         | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| Framework        | Vitest 4.1.5 (already in repo)                              |
| Config file      | `vitest.config.ts` (P2-locked; W-4 invariant — do not edit) |
| Quick run        | `pnpm test -- tests/unit/cemaden.test.ts -t '<name>'`       |
| Full suite       | `pnpm test:ci`                                              |
| E2E (Playwright) | `pnpm test:e2e`                                             |

### Phase Requirements → Test Map

| REQ         | Behavior                                        | Test Type   | Command                                                   | File Exists?                      |
| ----------- | ----------------------------------------------- | ----------- | --------------------------------------------------------- | --------------------------------- |
| ADAPT-01    | CEMADEN adapter parses fixture                  | unit        | `pnpm test tests/unit/cemaden.test.ts`                    | ❌ Wave 0                         |
| ADAPT-01    | Contract: severity/hazard vocab + tz round-trip | contract    | `pnpm test tests/contract/cemaden.test.ts`                | ❌ Wave 0                         |
| ADAPT-01    | Cross-source isolation (real adapter)           | contract    | `pnpm test tests/contract/cross-source-isolation.test.ts` | ✅ exists; needs stub→real swap   |
| INMET P5.1  | `{hoje, futuro}` envelope normalization         | contract    | `pnpm test tests/contract/inmet.test.ts`                  | ✅ exists; new case + new fixture |
| DASH-01..06 | RSC renders 27 states                           | integration | `pnpm test tests/integration/home.test.tsx`               | ❌ Wave 0                         |
| DASH-04     | `/estado/{uf}` 200 for all 27 + 404 for unknown | integration | `pnpm test tests/integration/state-route.test.tsx`        | ❌ Wave 0                         |
| DASH-07     | Region filter via searchParams                  | integration | covered in home test                                      | —                                 |
| DASH-08     | wa.me anchor + clipboard island                 | unit + e2e  | `pnpm test:e2e share`                                     | ❌ Wave 0                         |
| A11Y-01..04 | axe-core zero violations on 5 routes            | e2e         | `pnpm test:e2e a11y`                                      | ❌ Wave 0                         |
| A11Y-05     | Lighthouse CI on 5 routes                       | external    | `pnpm exec lhci autorun`                                  | ❌ Wave 0                         |
| A11Y-02     | No-JS path                                      | e2e         | `pnpm test:e2e --javascript-enabled=false`                | ❌ Wave 0                         |

### Sampling Rate

- **Per task commit:** `pnpm test -- <focused file>` (≤30s)
- **Per wave merge:** `pnpm test:ci && pnpm test:e2e --grep @smoke`
- **Phase gate:** `pnpm test:ci && pnpm test:e2e && pnpm exec lhci autorun` all green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/cemaden.test.ts` — schema + tz round-trip + severity map
- [ ] `tests/contract/cemaden.test.ts` — fixture-driven, vocab assertions
- [ ] `tests/integration/home.test.tsx` — RSC render of 27 states
- [ ] `tests/integration/state-route.test.tsx` — dynamic [uf] route
- [ ] `tests/e2e/a11y.spec.ts` — axe-core × 5 routes
- [ ] `tests/e2e/share.spec.ts` — clipboard + wa.me
- [ ] `tests/e2e/no-js.spec.ts` — Playwright with JS off
- [ ] `tests/fixtures/sources/cemaden-2026-05-18.json` — capture-based fixture
- [ ] `tests/fixtures/sources/inmet-2026-05-18.list.json` — `{hoje, futuro}` envelope
- [ ] `.lighthouserc.json` config
- [ ] `scripts/refresh-cemaden.ts`
- [ ] `tests/fixtures/sources/_stub/cemaden-stub.json`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category          | Applies | Standard Control                                             |
| ---------------------- | ------- | ------------------------------------------------------------ |
| V2 Authentication      | no      | Public read-only; no user accounts                           |
| V3 Session Management  | no      | Stateless                                                    |
| V4 Access Control      | yes     | `/api/ingest` token-protected (P2-locked); UI routes public  |
| V5 Input Validation    | yes     | zod for CEMADEN payload; `searchParams.region` whitelisted   |
| V6 Cryptography        | no      | No secrets handling in UI tier                               |
| V7 Errors & Logging    | yes     | pino logging in adapter; never leak source error text to UI  |
| V11 Business Logic     | yes     | Locked share template; never accept user-provided share text |
| V12 Files              | no      | No file uploads                                              |
| V13 API & Web Services | yes     | CORS not relaxed for `/api/states`; `/api/ingest` token      |
| V14 Configuration      | yes     | `NEXT_PUBLIC_SITE_URL` for OG meta                           |

### Known Threat Patterns

| Pattern                                         | STRIDE                 | Mitigation                                                                                 |
| ----------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| Open redirect via `?region=<malicious URL>`     | Spoofing               | Whitelist `region` ∈ `{norte, nordeste, centro-oeste, sudeste, sul}`; ignore anything else |
| XSS via CEMADEN `municipio` or `evento` strings | Tampering              | React auto-escapes; never `dangerouslySetInnerHTML` on source-derived text                 |
| OG/Twitter card injection via state name        | Tampering              | State name comes from a server-side UF→name table, not source data                         |
| Reflected XSS via clipboard `url`               | Tampering              | URL constructed server-side from `NEXT_PUBLIC_SITE_URL` + UF — no user input               |
| Server-side request forgery (SSRF)              | Tampering              | Adapter uses pinned URLs only                                                              |
| Information disclosure via error UI             | Information Disclosure | Use locked PT-BR copy; never render `sourceError.message` to users                         |

---

## Environment Availability

| Dependency                                | Required By     | Available            | Version                    | Fallback                               |
| ----------------------------------------- | --------------- | -------------------- | -------------------------- | -------------------------------------- |
| Node.js                                   | All             | ✓                    | ≥24 (package.json engines) | —                                      |
| pnpm                                      | Build           | ✓                    | 10.33.2                    | —                                      |
| Neon Postgres                             | snapshot read   | ✓ (P2)               | serverless 1.1             | last-known via Upstash                 |
| Upstash Redis                             | snapshot cache  | ✓ (P2)               | 1.37                       | direct DB read                         |
| `painelalertas.cemaden.gov.br/wsAlertas2` | CEMADEN adapter | ✓ (capture verified) | —                          | INMET-only ingest (registry isolation) |
| `apiprevmet3.inmet.gov.br/avisos/ativos`  | INMET adapter   | ✓ (P4)               | —                          | last-known snapshot                    |
| Chromium for Playwright                   | E2E             | ✓ (devDep)           | 1.59.1                     | —                                      |
| Lighthouse CI runtime                     | Perf gate       | needs install        | 0.14.x                     | —                                      |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — `@lhci/cli` will be added in Wave 0.

---

## Project Constraints (from CLAUDE.md)

- **Stack lock:** Next.js latest stable (16.x), TS strict, Tailwind v4, react-simple-maps, NO `next-intl`. PT-BR only.
- **Hosting:** Vercel free tier — Functions only (no Vercel Cron / KV / Postgres).
- **Cron:** GitHub Actions → token-protected `/api/ingest`.
- **Cache:** Upstash Redis. DB: Neon. HTTP: ofetch.
- **Map:** Albers conic, parallels [-7,-22], rotate [54,0], `carolinabigonha/br-atlas`.
- **Risk levels:** `green | yellow | orange | red | unknown` (5).
- **Unknown source-term severity default:** `moderate` (NOT `low`).
- **PT-BR severity labels verbatim:** "Sem alertas / Atenção / Alerta / Perigo / Dados indisponíveis".
- **Hazard names verbatim** (queimada vs incêndio; estiagem vs seca; enchente vs inundação).
- **Disclaimer SSR-rendered.** **MIT from commit 1.** PT-BR README primary.
- **Anti-features:** user accounts, social, forecasting, affiliate, individual analytics, replacing Defesa Civil.
- **Conservative fail-mode:** over-warn > under-warn.

---

## Assumptions Log

| #   | Claim                                                                                                          | Section        | Risk if Wrong                                                            |
| --- | -------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------ |
| A1  | `react-simple-maps` v3 SSRs cleanly under React 19                                                             | B7 / Pattern 4 | Forces fall-back to manual `<path>` rendering; small refactor            |
| A2  | `br-atlas` simplified TopoJSON is packaged or vendorable cleanly                                               | B7             | May need to vendor the file under `src/lib/geo/data/`                    |
| A3  | `@date-fns/tz` handles `America/Rio_Branco` + `America/Manaus` correctly with full ICU on Node 24              | A1             | Test in Wave 0 spike; if broken, fall back to `luxon` (+30 KB)           |
| A4  | CEMADEN severity vocab is `{Moderado, Alto, Muito Alto}` (Muito Alto not observed in capture)                  | A3             | Adapter maps unknown to `moderate`; planner adds drift surveillance      |
| A5  | CEMADEN hazard vocab is `{Risco Hidrológico, Movimento de Massa}` (Movimento de Massa not observed in capture) | A3             | Adapter throws `schema_invalid` on unknown; loud surveillance            |
| A6  | `unstable_cache` / `'use cache'` directive in Next 16 is the right caching primitive for snapshot read         | B13            | Falls back to `revalidate` + module-level memo if API shifts             |
| A7  | `<Link>` wrapping SVG `<path>` produces valid SSR + working keyboard nav                                       | B8, D17        | If broken, render plain `<a>` ourselves around `<path>`; small CSS pivot |
| A8  | OG/Twitter card previews work via `generateMetadata` per route in Next 16                                      | DASH-04        | Established Next pattern; very low risk                                  |
| A9  | `deslizamento` is the correct PT-BR hazard kind for CEMADEN "Movimento de Massa"                               | A3             | If user disagrees, plan rewrites the hazard table once                   |

---

## Open Questions for the Planner

1. **D-04 rewrite:** Plan-phase MUST replace D-04 in CONTEXT.md (or document an override) before any adapter task lands. Recommended wording: "CEMADEN timestamps are UTC. Adapter outputs ISO-Z. Presentation layer converts to `America/Sao_Paulo` via `@date-fns/tz`, handling Acre (UTC-5) and Amazonas (UTC-4) where applicable."
2. **Hazard enum extension (`deslizamento`):** Add to `HAZARD_KINDS` union? Required to map "Movimento de Massa" verbatim per CLAUDE.md.
3. **Fixture capture date:** capture committed `2026-05-18` shows only `Risco Hidrológico - Moderado/Alto`. Should planner schedule a second capture during the SE summer to land `Muito Alto` and `Movimento de Massa` examples? (Recommendation: yes, gated by data availability — but not blocking.)
4. **`br-atlas` packaging:** Is `carolinabigonha/br-atlas` published on npm under that name, or does the project need to vendor `states.json` directly? Spike answers.
5. **README anchor `#formula-v0`:** Does the PT-BR README have a stable section explaining v0 formula? If not, planner should add one as a Wave 0 doc task to satisfy DASH-09.

---

## Sources

### Primary (HIGH confidence)

- `.planning/phases/05-cemaden-dashboard-ui/05-cemaden-endpoint-capture.md` — direct endpoint capture, replay-verified
- `.planning/phases/05-cemaden-dashboard-ui/05-CONTEXT.md` — locked decisions D-01..D-11
- `.planning/phases/05-cemaden-dashboard-ui/05-SPEC.md` — 14 locked requirements
- `.planning/phases/05-cemaden-dashboard-ui/05-UI-SPEC.md` — locked design contract
- `.planning/phases/04-first-two-adapters/04-05-SUMMARY.md` — INMET P5.1 schema drift, exact discrepancies
- `src/lib/sources/inmet.ts`, `src/lib/sources/errors.ts`, `src/lib/sources/registry.ts`, `src/lib/sources/registry-meta.ts`, `src/lib/http/fetcher.ts`, `src/lib/risk/sources/inmet.ts`, `scripts/refresh-inmet.ts` — existing P4 patterns to mirror
- `package.json` — locked dep set + engines
- `CLAUDE.md` — stack locks, anti-features
- `risk-formula-v0.md` (via P4 RESEARCH) — severity defaults

### Secondary (MEDIUM confidence)

- Next 16 docs — `searchParams`, `generateMetadata`, `revalidate`, `'use cache'`
- React 19 RSC patterns — Server Component / client island boundary
- WCAG 2.2 — SC 1.4.13 hover/focus content
- WAI-ARIA APG — navigation pattern (`aria-current="page"`)
- MDN — `navigator.clipboard.writeText`, SVG `<title>`, SVG `<a>`
- Lighthouse CI docs — assertions config

### Tertiary (LOW — flagged for Wave 0 spike validation)

- `react-simple-maps` v3 + React 19 compatibility (verify install)
- `br-atlas` npm packaging (verify presence / vendoring path)
- `@date-fns/tz` Acre/Manaus zone correctness on Node 24 ICU (verify with unit test)

---

## Metadata

**Confidence breakdown:**

- CEMADEN endpoint + schema: HIGH (capture verified by replay).
- D-04 contradiction: HIGH (capture self-labels UTC).
- Library picks (date-fns, lhci, axe-core/playwright): HIGH (mature, widely used).
- `react-simple-maps` + React 19 SSR: MEDIUM (verify in Wave 0).
- INMET P5.1 patch shape: HIGH (P4 SUMMARY documents the drift precisely).
- A11Y + perf budget approach: HIGH (Lighthouse + axe-core are standard).
- UI patterns (RSC, searchParams, generateMetadata): HIGH (locked Next 16 features).

**Research date:** 2026-05-18
**Valid until:** 2026-06-17 (30 days; stack is stable; revisit if Next 17 ships or react-simple-maps changes API).
