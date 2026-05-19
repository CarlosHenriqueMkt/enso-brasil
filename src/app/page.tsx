/**
 * Home `/` — server-rendered overview of the 27 UFs (REQ-DASH-01..03, DASH-07).
 *
 * Server Component. Composes Wave-2 primitives:
 *   - StaleSourceBanner   → top-of-page degraded-source notice (DATA-07)
 *   - <h1>                → locked PT-BR title
 *   - RegionFilter        → anchor-only chip strip (no JS)
 *   - BrazilMap           → always-full 27-UF choropleth (filter doesn't shrink it)
 *   - StateCard × N       → region-filtered card list (1 / 3 / 4 / 7 / 9 / 27)
 *
 * `?region=<slug>` is validated against REGION_FROM_SLUG (slug only — uppercase
 * region codes are rejected to keep the URL space single-canonical). Invalid
 * values are silently treated as absent (T-05-18 mitigation; no 404).
 *
 * Layout shell (skip-link, disclaimer, footer) lives in `layout.tsx` — do NOT
 * duplicate here. The h1 inside `<main id="main">` is the skip-link target.
 *
 * Revalidation: every 30 s matches the Upstash cache TTL semantics from /api/
 * states. We do NOT force `dynamic="force-dynamic"` because Next will still
 * regenerate on every request when revalidate is short and the request carries
 * search params — and revalidate gives us free per-segment CDN caching for the
 * unfiltered root.
 */
import type { ReactElement } from "react";
import { loadSnapshotForUi } from "@/lib/snapshot/load";
import { StaleSourceBanner } from "@/components/staleness/StaleSourceBanner";
import { RegionFilter } from "@/components/filters/RegionFilter";
import { BrazilMap } from "@/components/map/BrazilMap";
import { StateCard } from "@/components/cards/StateCard";
import { REGION_FROM_SLUG, UF_TO_REGION, type Region } from "@/lib/geo/regions";
import { messages } from "@/lib/messages";
import type { StateSnapshot, UF } from "@/lib/api/schemas";

export const revalidate = 30;

interface HomePageProps {
  searchParams: Promise<{ region?: string }>;
}

/** Coerce `?region=<raw>` → canonical `Region` code or `null`. */
function validateRegion(raw: string | undefined): Region | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const lower = raw.toLowerCase();
  const region = REGION_FROM_SLUG[lower];
  return region ?? null;
}

/** Project StateSnapshot[] into BrazilMap's `{ uf, level }` shape. */
function statesForMap(
  states: ReadonlyArray<StateSnapshot>,
): Array<{ uf: UF; level: StateSnapshot["risk"] }> {
  return states.map((s) => ({ uf: s.uf, level: s.risk }));
}

export default async function HomePage({ searchParams }: HomePageProps): Promise<ReactElement> {
  const params = await searchParams;
  const activeRegion = validateRegion(params.region);

  const { states, health } = await loadSnapshotForUi();

  // BrazilMap always shows all 27 UFs (UI-SPEC interaction table — region
  // filter affects card list only).
  const allStates = states;

  // Card list — filtered by region when set, otherwise full 27.
  const filteredStates =
    activeRegion === null ? states : states.filter((s) => UF_TO_REGION[s.uf] === activeRegion);

  return (
    <main id="main" className="enso-home flex flex-col gap-s-3 px-s-3 py-s-3">
      <StaleSourceBanner sources={health} />

      <h1 className="text-page-title" style={{ fontWeight: 500 }}>
        {messages.page_title}
      </h1>

      <RegionFilter active={activeRegion} />

      <section
        aria-label="Mapa e cartões por estado"
        className="enso-home-grid grid grid-cols-1 md:grid-cols-2 gap-s-3 items-start"
      >
        <div className="enso-home-map">
          <BrazilMap states={statesForMap(allStates)} />
        </div>
        <div className="enso-home-cards flex flex-col gap-s-2">
          {filteredStates.map((s) => (
            <StateCard key={s.uf} snapshot={s} />
          ))}
        </div>
      </section>
    </main>
  );
}
