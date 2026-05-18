# Phase 5: cemaden-dashboard-ui — Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 15 new + 1 patch
**Analogs found:** 11 exact / 3 role-match / 2 net-new

## File Classification

| New / Modified File                              | Role                           | Data Flow                       | Closest Analog                                                         | Match            |
| ------------------------------------------------ | ------------------------------ | ------------------------------- | ---------------------------------------------------------------------- | ---------------- |
| `src/lib/sources/cemaden.ts`                     | adapter / source               | request-response (HTTP→Alert[]) | `src/lib/sources/inmet.ts`                                             | exact            |
| `src/lib/risk/sources/cemaden.ts`                | severity mapper                | transform                       | `src/lib/risk/sources/inmet.ts`                                        | exact            |
| `tests/sources/cemaden.test.ts`                  | unit test                      | n/a                             | `tests/sources/inmet.test.ts`                                          | exact            |
| `tests/sources/cemaden.contract.test.ts`         | contract test (fixture-driven) | n/a                             | `tests/sources/inmet.contract.test.ts`                                 | exact            |
| `tests/fixtures/sources/cemaden-YYYY-MM-DD.json` | fixture                        | n/a                             | `tests/fixtures/sources/inmet-2026-05-09.list.json`                    | exact            |
| `scripts/refresh-cemaden.ts`                     | CLI / fixture refresher        | request-response                | `scripts/refresh-inmet.ts`                                             | exact            |
| `src/lib/sources/registry.ts` (patch)            | registry                       | n/a                             | self                                                                   | exact            |
| `src/lib/sources/registry-meta.ts` (patch)       | edge-safe meta                 | n/a                             | self                                                                   | exact            |
| `src/lib/sources/inmet.ts` (patch P5.1)          | adapter schema fix             | n/a                             | self                                                                   | exact            |
| `src/app/page.tsx`                               | route / server component       | read-through (snapshot→UI)      | `src/app/api/states/route.ts` (data shape) + `src/app/page.tsx` (stub) | role-match       |
| `src/app/estado/[uf]/page.tsx`                   | dynamic route                  | read-through                    | none in repo                                                           | **net-new**      |
| `src/app/texto/page.tsx`                         | route / text-only mirror       | read-through                    | none in repo                                                           | **net-new**      |
| `src/components/map/*` (BrazilMap, StateShape)   | RSC component                  | read-only render                | `src/components/SourceLink.tsx` (component shape only)                 | role-match       |
| `src/components/cards/StateCard.tsx`             | RSC component                  | read-only render                | `src/components/SourceLink.tsx`                                        | role-match       |
| `src/components/filters/RegionFilter.tsx`        | client component (URL state)   | event-driven                    | none — flag client/`use client` boundary                               | **net-new**      |
| `src/components/share/ShareButton.tsx`           | client component               | event-driven                    | none — first wa.me/clipboard use                                       | **net-new**      |
| `src/components/disclaimer/*`                    | layout fragment                | n/a                             | already inlined in `src/app/layout.tsx:20-23`                          | extract-existing |
| `src/app/globals.css` (additive)                 | theme tokens                   | n/a                             | self `@theme` block lines 12-43                                        | exact            |

## Pattern Assignments — CEMADEN Adapter Cluster

### `src/lib/sources/cemaden.ts`

**Analog:** `src/lib/sources/inmet.ts` (entire file is the template).

**Copy verbatim:**

- Module header docblock structure (lines 1-13).
- `sourceError` import + every `throw sourceError(code, msg, cause)` call site — NO `class extends Error` (`src/lib/sources/errors.ts:38-45`).
- `InmetHttpClient` interface + `PROD_HTTP_CLIENT` factory injection (lines 36-44). Rename to `CemadenHttpClient`. Same shape `{ getJson, getText }` — but CEMADEN per `05-cemaden-endpoint-capture.md` is JSON-only, so `getText` may be dropped.
- `wrapHttpError` block (lines 170-197) — same `timeout`/`http_5xx` taxonomy.
- `toIsoZ` / `requireIsoZ` (lines 153-168).
- `extractUFs` helpers and `UF_NAMES` / `UF_CODE_RE` tables (lines 66-135) — **CEMADEN payload is already per-município with `cd_estado`/`uf`; reuse `UF_SET` membership check only, drop the regex passes.**
- `computePayloadHash` per-alert call (line 238) and final `AlertArraySchema.safeParse` tripwire (lines 292-302) — verbatim.
- `createCemadenAdapter` factory shape (lines 246-305) + default export `cemadenAdapter = createCemadenAdapter()`.
- `Promise.allSettled` per-alert isolation pattern (lines 264-286) — if CEMADEN returns one bulk payload, this is N=1 settled; still keep the wrapper to preserve "one source's bad alert doesn't poison the tick" invariant.

**Must differ:**

- Endpoint constants: a single GeoJSON / JSON endpoint per `05-cemaden-endpoint-capture.md` (no two-step list→detail).
- Schema validation: replace `assertActiveList` + `assertCapDocument` with a CEMADEN Zod schema (new file: `src/lib/sources/cemaden.schema.ts`, mirror `src/lib/sources/inmet.schema.ts`).
- Hazard mapping: CEMADEN vocab is `Alagamento / Deslizamento / Enxurrada / Movimento de massa / Chuvas Intensas / Hidrológico` etc. Build a fresh `HAZARD_PATTERNS` table — preserve CEMADEN vocabulary verbatim (CLAUDE.md locked rule: enchente vs inundação).
- UTC parsing: CEMADEN timestamps are local Brasília without offset per capture → must apply `-03:00` before `new Date()`. INMET uses ISO with offset — do NOT copy `toIsoZ` blindly; wrap it.
- No `selectPtBrInfo` (CEMADEN is mono-language).
- `displayName: "CEMADEN — Alertas vigentes"` (or per `05-RESEARCH.md`).

**Open uncertainty:** confirm whether CEMADEN response is GeoJSON FeatureCollection or flat JSON; capture file path is the source of truth. Schema design must follow that capture, not RESEARCH `[ASSUMED]` picks.

---

### `src/lib/risk/sources/cemaden.ts`

**Analog:** `src/lib/risk/sources/inmet.ts` (30 lines total, copy structure verbatim).

**Copy verbatim:**

- `Readonly<Record<string, Severity>>` + `Object.freeze` (line 13).
- `mapSeverity(raw)` with `?? "moderate"` fallback (line 28-30) — locked by RISK-04 / CLAUDE.md.

**Must differ:**

- Table contents: CEMADEN levels are `Observação / Atenção / Alerta / Alerta Máximo` (verify against capture). Map to `low / moderate / high / extreme`. Cross-reference `risk-formula-v0.md` for the canonical table.

---

### `tests/sources/cemaden.test.ts` + `cemaden.contract.test.ts`

**Analog:** `tests/sources/inmet.test.ts`, `tests/sources/inmet.contract.test.ts`.

**Copy verbatim:**

- File header, Vitest imports, `describe`/`it` layout.
- Mock injection pattern via the `createInmetAdapter(http)` injection seam — CEMADEN adapter MUST expose the same DI seam (`createCemadenAdapter(http)`).
- Error-taxonomy assertions: `expect(err.code).toBe("schema_invalid")` etc.
- Contract test: load latest fixture from `tests/fixtures/sources/cemaden-*.json` (sorted desc), feed to a stubbed HTTP client, assert `Alert[]` parses against `AlertArraySchema`.

**Must differ:** mock returns a single JSON payload (not list+xml). Drop XML-related test cases.

---

### `scripts/refresh-cemaden.ts`

**Analog:** `scripts/refresh-inmet.ts` + `scripts/lib/fixture-runner.ts` (re-use).

**Copy verbatim:**

- `parseArgs` `--dry-run` flag pattern (lines 31-35).
- `runFixtureRefresh({source:"cemaden", ext:"json", fetchPayload, parseForDiff: JSON.parse})` — runner already has `"cemaden"` in its type union (`scripts/lib/fixture-runner.ts:137`).
- Exit-code severity ladder (lines 85-88, 142-150).
- `USER_AGENT = "enso-brasil/1.0 fixture-refresh"`.
- Inline-duplicate endpoint constants (no import from `src/lib/sources/cemaden.ts` — registry-isolation policy, comment at line 19-22 of `refresh-inmet.ts`).
- Add `"fixtures:refresh:cemaden": "tsx scripts/refresh-cemaden.ts"` to `package.json` scripts (mirror line 18).

**Must differ:**

- Single-step fetch (no `firstId` → CAP detail loop).
- One `runFixtureRefresh` call, not two.

---

### `src/lib/sources/registry.ts` patch

Single-line append at line 16:

```ts
export const sources: readonly SourceAdapter[] = [inmetAdapter, cemadenAdapter];
```

Plus matching `import { cemadenAdapter } from "./cemaden";`. Remove the `TODO(P5)` comment.

### `src/lib/sources/registry-meta.ts` patch

Append `{ key: "cemaden", displayName: "..." }` to the frozen array (line 16). Drift detector in `registry.test.ts` enforces lockstep.

### `src/lib/sources/inmet.ts` P5.1 patch

INMET active-list payload is `{hoje:[...], futuro:[...]}` not a flat array. Touch points:

- `src/lib/sources/inmet.schema.ts` — change `InmetActiveListSchema` to object with `hoje` + `futuro` arrays (or union for back-compat); flatten in adapter.
- `src/lib/sources/inmet.ts:260` — after `assertActiveList`, flatten: `const list = [...raw.hoje, ...raw.futuro];`.
- Refresh fixture `tests/fixtures/sources/inmet-YYYY-MM-DD.list.json`.

## Pattern Assignments — Dashboard UI Cluster

### `src/app/page.tsx` (home — 27-state overview)

**Analog (data shape):** `src/app/api/states/route.ts` — the canonical `StateSnapshotsResponseSchema` (length-27) lives at `@/lib/api/schemas`.

**Recommended data fetch pattern:** **Server Component calls `getSnapshot()` directly from `@/lib/cache/upstash`** — DO NOT proxy through `/api/states` (avoids self-fetch, lets Next 16 RSC stream). Reuse the same `StateSnapshotsResponseSchema.parse` validation.

```ts
// src/app/page.tsx (sketch)
import { getSnapshot } from "@/lib/cache/upstash";
import { StateSnapshotsResponseSchema } from "@/lib/api/schemas";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const { region } = await searchParams;
  const cached = await getSnapshot();
  if (!cached) return <SnapshotUnavailable />;
  const states = StateSnapshotsResponseSchema.parse(cached);
  // filter by region if present, render map+cards
}
```

**Copy from existing `src/app/layout.tsx`:**

- `messages` import + verbatim PT-BR usage (line 2, 15, 21-22).
- Tailwind class style: `bg-bg text-ink-1 font-sans` semantic tokens (line 13).
- Skip-link affordance is already in layout — do not duplicate.

**Must differ:** current `src/app/page.tsx` is a 9-line stub; replace entirely. Region filter reads from `searchParams.region` (URL state, no client component needed for the filter container — chips become Links).

### `src/app/estado/[uf]/page.tsx`

**No direct analog.** Follow Next 16 dynamic-segment idiom:

```ts
export default async function StatePage({ params }: { params: Promise<{ uf: string }> }) {
  const { uf } = await params;
  // validate against UF27_PROVISIONAL from @/lib/sources/schema, else notFound()
}
```

**Reuse:** `UF27_PROVISIONAL` from `src/lib/sources/schema.ts` for the validation guard + `generateStaticParams` to pre-render all 27.

### `src/app/texto/page.tsx`

**No analog.** Pure SSR HTML table. Same `getSnapshot()` source-of-truth. No client JS.

### `src/components/cards/StateCard.tsx`, `src/components/map/*`

**Analog (shape only):** `src/components/SourceLink.tsx` — single-file RSC with co-located test `SourceLink.test.tsx`. Mirror that file layout.

**Theme:** consume design tokens via Tailwind classes already exposed in `globals.css` (`bg-risk-red-bg`, `border-risk-red-bd`, `text-ink-1`). The sketch-findings skill is the source of truth.

**react-simple-maps:** **NEW dependency** — confirm pinned version per `05-RESEARCH.md`. Map wrapper is a client component (`"use client"`) only for interactive hover/zoom; the SVG itself can stay server-rendered.

### `src/components/filters/RegionFilter.tsx`

Region filter is a set of `<Link href="/?region=NE">` chips — **stays a server component**. Active-state styling derived from `searchParams` passed from the page. Avoid `useSearchParams` unless interactivity demands it.

### `src/components/share/ShareButton.tsx`

`"use client"` required (clipboard API + `wa.me` window.open). First client component in repo — flag for planner: ESLint rules must permit `"use client"`, and the file must not import from server-only modules.

### `src/components/disclaimer/*` — already exists inline

`src/app/layout.tsx:20-23` already SSR-renders the footer disclaimer using `messages.disclaimer.body`. Planner decision: extract to `src/components/disclaimer/Disclaimer.tsx` (one component reused on home + /estado + /texto), or keep inline in layout. Either way, MUST remain SSR — REQ-S1.09.

## Shared Patterns

### Error handling (adapter cluster)

**Source:** `src/lib/sources/errors.ts:38-45`.
**Apply to:** `src/lib/sources/cemaden.ts` exclusively. UI cluster does NOT use `sourceError` — UI surfaces "Dados indisponíveis" via the `unknown` risk level.

### Snapshot read (UI cluster)

**Source:** `src/app/api/states/route.ts:19-33`.
**Apply to:** all 3 new pages.
**Excerpt:**

```ts
const cached = await getSnapshot();
if (!cached) {
  /* render unavailable surface */
}
const parsed = StateSnapshotsResponseSchema.parse(cached);
```

### PT-BR copy

**Source:** `src/lib/messages.ts` (verbatim from CLAUDE.md locked vocab + sketch-findings).
**Apply to:** every UI file. NEVER hard-code "Sem alertas / Atenção / Alerta / Perigo / Dados indisponíveis" — always reference `messages.*`.

### Theme tokens

**Source:** `src/app/globals.css` `@theme` block lines 12-43.
**Apply to:** any new tokens needed for P5 — append additively inside the same `@theme {}` block. New tokens auto-generate Tailwind utilities (`--color-foo` → `bg-foo`). The risk palette + spacing scale + radii are already locked; do not redefine.
**Pitfall:** WCAG note in lines 8-11 — yellow border is bespoke `#d4a017`, NEVER `yellow-500`, NEVER white text on yellow.

### Component file layout

**Source:** `src/components/SourceLink.tsx` + `src/components/SourceLink.test.tsx`.
**Apply to:** every new component — single `.tsx` file + co-located `.test.tsx` (Vitest + `@vitejs/plugin-react` + jsdom env, already in `package.json`).

### E2E

**Source:** `tests/e2e/` directory exists + `@playwright/test ^1.59.1` already a devDep + `test:e2e` script wired (`package.json:24,45`).
**Apply to:** P5 happy-path: home renders 27 cards, /estado/SP renders detail, /texto renders 5 regional tables. Planner can write Playwright specs without bootstrapping the framework.

## Net-new patterns (no analog — planner must design)

| Pattern                                          | Why net-new                                            | Recommendation                                                                                                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --------------------------------- |
| Next 16 `"use cache"` / `cacheLife` / `cacheTag` | Not used anywhere in `src/` per repo grep (no matches) | Planner decides: snapshot freshness via Upstash TTL already exists. Recommend **skipping `"use cache"` for v1** — rely on Upstash + `force-dynamic` parity with `/api/states` (line 17). Revisit in P6. |
| First `"use client"` component                   | All current components are RSC                         | Planner: gate `"use client"` to leaf components only (`ShareButton`, optional map zoom wrapper). Document in plan.                                                                                      |
| `react-simple-maps` integration                  | New dep                                                | Pin version per RESEARCH; verify Albers conic projection params from CLAUDE.md (parallels [-7,-22], rotate [54,0]) + `carolinabigonha/br-atlas` TopoJSON path.                                          |
| Region filter URL contract                       | No prior `searchParams` usage                          | Lock keys: `?region=N                                                                                                                                                                                   | NE  | CO  | SE  | S` (5 regions). Document in plan. |
| `wa.me` share URL contract                       | First social-share surface                             | Lock URL template + UTF-8 encoding. No tracking params.                                                                                                                                                 |
| `/api/states` vs direct DB/cache from RSC        | Both paths exist                                       | **Recommend direct `getSnapshot()` in RSC**; keep `/api/states` for clients that might consume it externally (consistency with edge-runtime contract).                                                  |

## Metadata

**Analog search scope:** `src/lib/sources/`, `src/lib/risk/`, `src/app/`, `src/components/`, `tests/`, `scripts/`, `package.json`.
**Pattern extraction date:** 2026-05-18.
**Verified absent in codebase:** `use cache`, `cacheLife`, `cacheTag`, `unstable_cache` (grep returned no matches).
**Verified present:** `@playwright/test`, `vitest`, `tests/e2e/`, `tests/contract/`, `tests/fixtures/sources/_stub/`.
