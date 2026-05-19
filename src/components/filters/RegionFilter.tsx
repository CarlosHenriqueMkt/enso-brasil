/**
 * RegionFilter — anchor-link chip strip for ?region=<slug> navigation.
 *
 * Pure Server Component. Zero JS — works fully without hydration.
 *   - "Todas" chip → `/` (clears the filter)
 *   - One chip per IBGE macro-region → `/?region=<slug>`
 *   - Active chip carries `aria-current="page"` + the inverse-visual class
 *     `region-chip-active` (bg-ink-1 text-surface per UI-SPEC).
 *
 * Touch-target floor of 44px enforced via inline min-h/min-w on every chip
 * (UI-SPEC §Spacing exception — explicit pixel value, not a scale token).
 *
 * Consumer (home page, plan 10) is responsible for validating the
 * `?region=<slug>` query param against `REGION_FROM_SLUG` before passing
 * `active` here (T-05-16 mitigation).
 */
import Link from "next/link";
import { messages } from "@/lib/messages";
import { REGION_SLUGS, type Region } from "@/lib/geo/regions";

type Props = {
  active: Region | null;
};

const REGION_ORDER: readonly Region[] = ["N", "NE", "CO", "SE", "S"] as const;

const BASE_CLASS = [
  "region-chip",
  "inline-flex",
  "items-center",
  "justify-center",
  "border",
  "rounded-r-2",
  "px-s-2",
  "py-s-1",
  "text-meta",
].join(" ");

const INACTIVE_CLASS = "bg-surface-muted border-line text-ink-1";
const ACTIVE_CLASS = "region-chip-active bg-ink-1 border-ink-1 text-surface";

// 44px minimum touch target (UI-SPEC spacing exception — hand-tuned pixel).
const TOUCH_TARGET_STYLE: React.CSSProperties = { minHeight: 44, minWidth: 44 };

function chipClass(isActive: boolean): string {
  return `${BASE_CLASS} ${isActive ? ACTIVE_CLASS : INACTIVE_CLASS}`;
}

export function RegionFilter({ active }: Props) {
  const todasActive = active === null;
  return (
    <nav aria-label="Filtro por região" className="region-filter inline-flex gap-s-1 flex-wrap">
      <Link
        href="/"
        prefetch={false}
        className={chipClass(todasActive)}
        style={TOUCH_TARGET_STYLE}
        {...(todasActive ? { "aria-current": "page" as const } : {})}
      >
        {messages.filter.all}
      </Link>
      {REGION_ORDER.map((r) => {
        const isActive = active === r;
        return (
          <Link
            key={r}
            href={`/?region=${REGION_SLUGS[r]}`}
            prefetch={false}
            className={chipClass(isActive)}
            style={TOUCH_TARGET_STYLE}
            {...(isActive ? { "aria-current": "page" as const } : {})}
          >
            {messages.filter.regions[r]}
          </Link>
        );
      })}
    </nav>
  );
}
