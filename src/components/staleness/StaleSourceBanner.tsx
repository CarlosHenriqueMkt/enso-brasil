/**
 * StaleSourceBanner — top-of-page notice when a data source goes stale (DATA-07).
 *
 * Contract (sketch-findings 02-edge-states-source-trust):
 *   - Renders one banner per stale source, stacked vertically.
 *   - "Stale" = `lastSuccess === null` OR `lastSuccess` older than 30 minutes.
 *   - Copy verbatim from `messages.empty.stale_source(displayName, url)`.
 *   - When ALL sources are fresh → returns `null` (no banner).
 *   - Stable source → orange palette; unstable source → gray palette.
 *   - SSR-only, deterministic from props. No "use client".
 *
 * Threat-model (T-05-11): banner exposes ONLY displayName + url; never raw error
 * payloads or upstream response bodies.
 */
import { messages } from "@/lib/messages";
import { formatRelativePtBr } from "@/lib/time/format";

/** 30-minute staleness threshold (DATA-07). */
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

export type StaleSourceProps = {
  key: string;
  displayName: string;
  url: string;
  /** ISO-Z timestamp of last successful fetch, or null if never succeeded. */
  lastSuccess: string | null;
  /** Affects banner palette — stable=orange, unstable=gray (UI-SPEC interaction table). */
  stability: "stable" | "unstable";
};

type Props = {
  sources: ReadonlyArray<StaleSourceProps>;
  /** Override clock for deterministic SSR + tests. Defaults to `new Date()`. */
  now?: Date;
};

function isStale(lastSuccess: string | null, now: Date): boolean {
  if (lastSuccess === null) return true;
  const t = new Date(lastSuccess).getTime();
  if (Number.isNaN(t)) return true;
  return now.getTime() - t >= STALE_THRESHOLD_MS;
}

export function StaleSourceBanner({ sources, now = new Date() }: Props) {
  const stale = sources.filter((s) => isStale(s.lastSuccess, now));
  if (stale.length === 0) return null;

  return (
    <div role="region" aria-label="Avisos de fontes indisponíveis">
      {stale.map((s) => {
        const palette =
          s.stability === "stable"
            ? "bg-risk-orange-bg border-risk-orange-bd text-risk-orange-ink"
            : "bg-risk-gray-bg border-risk-gray-bd text-risk-gray-ink";
        const classes = [
          "stale-source-banner",
          `stale-source-banner-${s.stability}`,
          palette,
          "border",
          "rounded-r-2",
          "px-s-3",
          "py-s-2",
          "mb-s-2",
        ].join(" ");
        const relative = s.lastSuccess !== null ? formatRelativePtBr(s.lastSuccess, now) : null;
        return (
          <div key={s.key} className={classes} role="status">
            <p>{messages.empty.stale_source(s.displayName, s.url)}</p>
            {relative !== null && (
              <p className="text-meta" data-relative-timestamp="true">
                {relative}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
