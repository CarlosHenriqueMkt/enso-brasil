/**
 * StateCard — single-UF dashboard card.
 *
 * Pure Server Component. Composes existing primitives:
 *   - <RiskBadge level={snapshot.risk} />
 *   - <ShareButton stateName level explanation url /> (first "use client" leaf)
 *   - formatRelativePtBr(snapshot.lastSuccessfulFetch) — PT-BR relative time
 *   - <Link prefetch={false}> for the primary CTA to /estado/<uf>
 *
 * Locked design contracts (sketch-findings + UI-SPEC §Interaction Contracts):
 *   - Left border stripe: 3px in var(--color-risk-{level}-bd)
 *   - Mobile reading order: name → badge → explanation → emergency (red only)
 *     → CTA → share → meta (sketch-finding 002-B)
 *   - Emergency contacts line renders ONLY for `risk === "red"`
 *   - Yellow badge never pairs white text on yellow fill (RiskBadge enforces;
 *     this card stays neutral and lets the badge own its palette)
 *
 * Plan-vs-schema deviation: PLAN.md task 4 references `snapshot.level` /
 * `.explanation` / `.alerts` / `.updatedAt` — these are not on the StateSnapshot
 * schema locked in P2 (src/lib/api/schemas.ts). We map to the actual fields:
 *   level       → risk
 *   explanation → riskReason
 *   updatedAt   → lastSuccessfulFetch  (nullable — guarded)
 *   alerts list → omitted (schema has only alertCount; per-alert SourceLink
 *                 list deferred to a future plan once the snapshot carries
 *                 individual alert objects).
 */
import Link from "next/link";
import type { Route } from "next";
import { RiskBadge } from "@/components/badge/RiskBadge";
import { ShareButton } from "@/components/share/ShareButton";
import { messages } from "@/lib/messages";
import { formatRelativePtBr } from "@/lib/time/format";
import type { StateSnapshot, UF } from "@/lib/api/schemas";
import type { RiskLevel } from "@/lib/sources/schema";

type Props = {
  snapshot: StateSnapshot;
};

/**
 * Canonical PT-BR state names for the 27 UFs (IBGE official).
 * Local to this module — no shared util needed yet. Promote to
 * src/lib/geo/state-names.ts when a second consumer appears.
 */
const UF_NAME_PT: Record<UF, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

/** Canonical site origin for share URLs. Hardcoded — public, non-secret. */
const CANONICAL_ORIGIN = "https://ensobrasil.com.br";

/** Repo URL for the "Como calculamos isso?" link target. */
const REPO_URL =
  process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/CarlosHenriqueMkt/enso-brasil";
const FORMULA_ANCHOR = `${REPO_URL}/blob/main/README.md#formula-v0`;

/** Fallback source URL used by the unknown-state explainer. */
const PRIMARY_SOURCE_URL = "https://www.cemaden.gov.br";

function levelClassToken(level: RiskLevel): "green" | "yellow" | "orange" | "red" | "gray" {
  return level === "unknown" ? "gray" : level;
}

export function StateCard({ snapshot }: Props) {
  const { uf, risk, riskReason, lastSuccessfulFetch } = snapshot;
  const stateName = UF_NAME_PT[uf];
  const stateUrl = `${CANONICAL_ORIGIN}/estado/${uf.toLowerCase()}`;
  const token = levelClassToken(risk);

  // 3px left stripe in the per-level border token (Pitfall 3 — token only).
  const stripeStyle: React.CSSProperties = {
    borderLeft: "3px solid var(--color-risk-" + token + "-bd)",
  };

  // Explanation body: prefer the snapshot's riskReason, but for green/unknown
  // fall back to the locked empty-state copy when the reason is missing.
  const explanationBody: string =
    risk === "green" && !riskReason
      ? messages.empty.green_state
      : risk === "unknown" && !riskReason
        ? messages.empty.unknown_explainer(PRIMARY_SOURCE_URL)
        : riskReason;

  // Green and unknown render their canonical empty-state copy regardless of
  // riskReason content, per UI-SPEC §Empty States.
  const supplementaryEmpty =
    risk === "green"
      ? messages.empty.green_state
      : risk === "unknown"
        ? messages.empty.unknown_explainer(PRIMARY_SOURCE_URL)
        : null;

  return (
    <article
      className="state-card bg-surface rounded-r-3 p-s-3 flex flex-col gap-s-2"
      style={stripeStyle}
      aria-labelledby={`state-card-${uf}-title`}
    >
      {/* 1. State name + UF code */}
      <h3 id={`state-card-${uf}-title`} className="text-card-title" style={{ fontWeight: 500 }}>
        {stateName} ({uf})
      </h3>

      {/* 2. Risk badge */}
      <RiskBadge level={risk} />

      {/* 3. Plain-language explanation */}
      <p className="text-body">{explanationBody}</p>

      {/* 4. Empty-state copy for green / unknown (rendered in addition to the
            explanation paragraph so screen readers always hit the locked copy) */}
      {supplementaryEmpty && supplementaryEmpty !== explanationBody && (
        <p className="text-card-meta text-ink-2">{supplementaryEmpty}</p>
      )}

      {/* 5. Emergency contacts — red only (sketch-finding 002-B) */}
      {risk === "red" && (
        <p className="text-card-meta" aria-label="Contatos de emergência">
          {messages.emergency_contacts}
        </p>
      )}

      {/* 6. Primary CTA → state-detail page */}
      <Link
        href={`/estado/${uf.toLowerCase()}` as Route}
        prefetch={false}
        className="state-card-cta text-body"
      >
        {messages.cta.state_detail(stateName)}
      </Link>

      {/* 7. Share button (leaf "use client" component) */}
      <ShareButton
        stateName={stateName}
        level={risk}
        explanation={riskReason || stateName}
        url={stateUrl}
      />

      {/* 8. Meta footer — relative timestamp + formula explainer */}
      <footer className="state-card-meta text-card-meta text-ink-2 flex flex-wrap gap-s-2 items-baseline">
        <span>
          {lastSuccessfulFetch
            ? formatRelativePtBr(lastSuccessfulFetch)
            : messages.timestamp_template.over_day}
        </span>
        <a href={FORMULA_ANCHOR} target="_blank" rel="noopener noreferrer">
          {messages.cta.formula_explainer}
        </a>
      </footer>
    </article>
  );
}
