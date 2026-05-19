/**
 * /estado/[uf] — per-state detail page (REQ-DASH-04, A11Y-03, A11Y-06).
 *
 * Server Component. Statically generated for the 27 UFs via
 * `generateStaticParams`. Unknown UF or uppercase param → notFound().
 * (Lowercase is the canonical URL contract — matches sketch-finding 004 +
 * sitemap + share URLs.)
 *
 * Layout: sketch-finding 004 Variant C — desktop two-column with permanent
 * left aside (state context: name, badge, last-update, share). Mobile linear
 * stack with locked reading order: lead → afeta → válido → fontes → chips
 * → 199/193/190 (red only) → timestamp.
 *
 * Loading state: SSR-instant with last-known fallback (UI-SPEC). Total-failure
 * floor renders an "unknown" gray card. Emergency contacts always visible on
 * red. Screen-reader polite live region announces the level on load (A11Y-06).
 *
 * Composition: re-uses RiskBadge + ShareButton + StaleSourceBanner; copy lives
 * entirely in `messages.ts`.
 */
import type { Metadata } from "next";
import type { Route } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { loadSnapshotForUi } from "@/lib/snapshot/load";
import { RiskBadge } from "@/components/badge/RiskBadge";
import { ShareButton } from "@/components/share/ShareButton";
import { StaleSourceBanner } from "@/components/staleness/StaleSourceBanner";
import { messages } from "@/lib/messages";
import { formatRelativePtBr } from "@/lib/time/format";
import { UF27, type UF } from "@/lib/api/schemas";
import { UF_TO_REGION } from "@/lib/geo/regions";
import type { RiskLevel } from "@/lib/sources/schema";

/** Canonical lowercase UF set (mirrors generateStaticParams output). */
const UF27_LOWER: ReadonlySet<string> = new Set(UF27.map((u) => u.toLowerCase()));

/** Canonical PT-BR state names (IBGE official). Duplicated from StateCard;
 * promote to `@/lib/geo/state-names` when a third consumer appears. */
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

const CANONICAL_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ensobrasil.com.br";

const REPO_URL =
  process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/CarlosHenriqueMkt/enso-brasil";
const FORMULA_ANCHOR = `${REPO_URL}/blob/main/README.md#formula-v0`;

const PRIMARY_SOURCE_URL = "https://www.cemaden.gov.br";

function severityLabel(level: RiskLevel): string {
  return level === "unknown" ? messages.severity.unknown : messages.severity[level];
}

function levelToken(level: RiskLevel): "green" | "yellow" | "orange" | "red" | "gray" {
  return level === "unknown" ? "gray" : level;
}

/** Pre-render all 27 routes at build time. Lowercase is canonical. */
export async function generateStaticParams(): Promise<Array<{ uf: string }>> {
  return UF27.map((uf) => ({ uf: uf.toLowerCase() }));
}

/** Validate the route param. Returns the UPPERCASE UF or null on miss. */
function parseUf(raw: string): UF | null {
  // Strict lowercase-only contract. Uppercase / mixed-case → 404.
  if (raw !== raw.toLowerCase()) return null;
  if (!UF27_LOWER.has(raw)) return null;
  return raw.toUpperCase() as UF;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ uf: string }>;
}): Promise<Metadata> {
  const { uf: rawUf } = await params;
  const uf = parseUf(rawUf);
  if (uf === null) return {};
  const stateName = UF_NAME_PT[uf];
  const url = `${CANONICAL_ORIGIN}/estado/${uf.toLowerCase()}`;
  const title = `${stateName} — Alertas climáticos`;
  const description = `Alertas e nível de risco climático para ${stateName} agregados de fontes oficiais.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "ENSO Brasil",
      type: "website",
      locale: "pt_BR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function StatePage({ params }: { params: Promise<{ uf: string }> }) {
  const { uf: rawUf } = await params;
  const uf = parseUf(rawUf);
  if (uf === null) {
    notFound();
  }

  const { states, health } = await loadSnapshotForUi();
  const snapshot = states.find((s) => s.uf === uf);
  if (!snapshot) {
    notFound();
  }

  const stateName = UF_NAME_PT[uf];
  const region = UF_TO_REGION[uf];
  const regionLabel = messages.filter.regions[region];
  const level = snapshot.risk;
  const token = levelToken(level);
  const stateUrl = `${CANONICAL_ORIGIN}/estado/${uf.toLowerCase()}`;
  const sevLabel = severityLabel(level);

  const explanation =
    level === "green" && !snapshot.riskReason
      ? messages.empty.green_state
      : level === "unknown" && !snapshot.riskReason
        ? messages.empty.unknown_explainer(PRIMARY_SOURCE_URL)
        : snapshot.riskReason;

  const stripeStyle = {
    borderLeft: `3px solid var(--color-risk-${token}-bd)`,
  } satisfies React.CSSProperties;

  return (
    <main id="main" className="enso-state-page flex flex-col gap-s-3 px-s-3 py-s-3">
      {/* A11Y-06: polite live region announces level on route load */}
      <div aria-live="polite" className="sr-only">
        {sevLabel} em {stateName}
      </div>

      <StaleSourceBanner sources={health} />

      <div
        className="enso-state-layout grid grid-cols-1 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] gap-s-3 items-start"
        style={stripeStyle}
      >
        {/* Left aside — permanent state context (desktop) / leads stack (mobile) */}
        <aside
          aria-label={`Resumo de ${stateName}`}
          className="enso-state-aside flex flex-col gap-s-2 bg-surface rounded-r-3 p-s-3"
        >
          <h1 className="text-page-title" style={{ fontWeight: 600 }}>
            {stateName} <span className="text-ink-2">({uf})</span>
          </h1>
          <p className="text-card-meta text-ink-2">{regionLabel}</p>
          <RiskBadge level={level} />
          <p className="text-card-meta text-ink-2">
            {snapshot.lastSuccessfulFetch
              ? formatRelativePtBr(snapshot.lastSuccessfulFetch)
              : messages.timestamp_template.over_day}
          </p>
          <ShareButton
            stateName={stateName}
            level={level}
            explanation={snapshot.riskReason || stateName}
            url={stateUrl}
          />
        </aside>

        {/* Right main column — explanation, alerts, emergency, formula link */}
        <section
          aria-label={`Detalhes de ${stateName}`}
          className="enso-state-main flex flex-col gap-s-3 bg-surface rounded-r-3 p-s-3"
        >
          <p className="text-body">{explanation}</p>

          {/* Alert list placeholder: schema currently exposes only alertCount.
              Per-alert SourceLink list arrives once snapshot carries Alert[]. */}
          {snapshot.alertCount > 0 && (
            <p className="text-card-meta text-ink-2">
              {snapshot.alertCount} alerta{snapshot.alertCount === 1 ? "" : "s"} ativo
              {snapshot.alertCount === 1 ? "" : "s"}.
            </p>
          )}

          {/* Emergency contacts — red only (locked sketch-finding 002-B) */}
          {level === "red" && (
            <p
              className="text-card-meta"
              aria-label="Contatos de emergência"
              data-emergency-contacts="true"
            >
              {messages.emergency_contacts}
            </p>
          )}

          <Link href={"/" as Route} prefetch={false} className="text-body" data-back-link="true">
            ← Voltar para todos os estados
          </Link>

          <footer className="text-card-meta text-ink-2">
            <a href={FORMULA_ANCHOR} target="_blank" rel="noopener noreferrer">
              {messages.cta.formula_explainer}
            </a>
          </footer>
        </section>
      </div>
    </main>
  );
}
