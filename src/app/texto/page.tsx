/**
 * /texto — accessible single-page mirror of the dashboard (REQ-DASH-09, A11Y-03).
 *
 * Pure SSR Server Component. NO `"use client"`. NO icons. NO images.
 * Pure semantic HTML — works without JS, prints cleanly, screen-reader-first.
 *
 * Layout:
 *   - h1 (page title)
 *   - StaleSourceBanner (if any source stale)
 *   - h2 "Por região"          ← parent for the 5 regional tables
 *     - h2 (region name) ×5 + <table> with [Estado | Nível | Alertas ativos | Atualizado há]
 *       (rows ordered by IBGE macro-region; first cell is an `<a href="#{uf}">`)
 *   - h2 "Estados"             ← parent for the 27 article sections
 *     - <article id="{uf}"> ×27 (alphabetical UF order)
 *       - h3 "{State name} ({UF})"
 *       - Plain-language explanation
 *       - Region tag
 *       - "Atualizado há …"
 *       - Emergency-contacts line (red only) with domain in mono font
 *
 * Severity cells render the locked PT-BR label as TEXT only — no icon glyph
 * (D-08, sketch-finding 02-edge-states).
 *
 * Tab order: skip-link → 5 tables (each row's `<a>` anchor) → 27 articles.
 */
import type { ReactElement } from "react";
import { loadSnapshotForUi } from "@/lib/snapshot/load";
import { StaleSourceBanner } from "@/components/staleness/StaleSourceBanner";
import { messages } from "@/lib/messages";
import { formatRelativePtBr } from "@/lib/time/format";
import { UF27, type StateSnapshot, type UF } from "@/lib/api/schemas";
import { UF_TO_REGION, type Region } from "@/lib/geo/regions";
import type { RiskLevel } from "@/lib/sources/schema";

export const revalidate = 30;

/** Canonical PT-BR state names (IBGE official). */
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

const REGION_ORDER: ReadonlyArray<Region> = ["N", "NE", "CO", "SE", "S"];

const PRIMARY_SOURCE_URL = "https://www.cemaden.gov.br";
const PRIMARY_SOURCE_DOMAIN = "cemaden.gov.br";

function severityLabel(level: RiskLevel): string {
  return level === "unknown" ? messages.severity.unknown : messages.severity[level];
}

function explanationFor(snapshot: StateSnapshot): string {
  if (snapshot.risk === "green" && !snapshot.riskReason) return messages.empty.green_state;
  if (snapshot.risk === "unknown" && !snapshot.riskReason) {
    return messages.empty.unknown_explainer(PRIMARY_SOURCE_URL);
  }
  return snapshot.riskReason;
}

function relativeOrFallback(iso: string | null): string {
  if (iso === null) return messages.timestamp_template.over_day;
  return formatRelativePtBr(iso);
}

export default async function TextoPage(): Promise<ReactElement> {
  const { states, health } = await loadSnapshotForUi();

  // Index snapshots by UF for fast lookup in the per-region tables.
  const byUf = new Map<UF, StateSnapshot>(states.map((s) => [s.uf, s]));

  // Group UFs by region in IBGE order (used by the 5 tables).
  const byRegion: Record<Region, UF[]> = { N: [], NE: [], CO: [], SE: [], S: [] };
  for (const uf of UF27) {
    byRegion[UF_TO_REGION[uf]].push(uf);
  }

  // Article sections: alphabetical UF order (locked by test).
  const articleUfs = [...UF27].sort();
  const headers = messages.texto.table_headers;

  return (
    <main id="main" className="enso-texto flex flex-col gap-s-3 px-s-3 py-s-3">
      <h1 className="text-page-title" style={{ fontWeight: 600 }}>
        {messages.texto.page_title}
      </h1>

      <StaleSourceBanner sources={health} />

      <section aria-label="Resumo por região">
        {REGION_ORDER.map((region) => {
          const regionName = messages.filter.regions[region];
          return (
            <section key={region} aria-label={regionName}>
              <h2 className="text-section-title" style={{ fontWeight: 500 }}>
                {regionName}
              </h2>
              <table className="enso-texto-table">
                <thead>
                  <tr>
                    {headers.map((h) => (
                      <th key={h} scope="col">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byRegion[region].map((uf) => {
                    const snap = byUf.get(uf);
                    if (!snap) return null;
                    const stateName = UF_NAME_PT[uf];
                    return (
                      <tr key={uf}>
                        <th scope="row">
                          <a href={`#${uf.toLowerCase()}`}>
                            {stateName} ({uf})
                          </a>
                        </th>
                        <td data-severity={snap.risk}>{severityLabel(snap.risk)}</td>
                        <td>{snap.alertCount}</td>
                        <td>{relativeOrFallback(snap.lastSuccessfulFetch)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
      </section>

      <section aria-label="Detalhes por estado" id="estados">
        {articleUfs.map((uf) => {
          const snap = byUf.get(uf);
          if (!snap) return null;
          const stateName = UF_NAME_PT[uf];
          const region = UF_TO_REGION[uf];
          const regionName = messages.filter.regions[region];
          const explanation = explanationFor(snap);
          return (
            <article
              key={uf}
              id={uf.toLowerCase()}
              className="enso-texto-article"
              aria-labelledby={`article-${uf}-title`}
            >
              <h3
                id={`article-${uf}-title`}
                className="text-card-title"
                style={{ fontWeight: 500 }}
              >
                {stateName} ({uf})
              </h3>
              <p className="text-card-meta text-ink-2">Região: {regionName}</p>
              <p className="text-body">
                <strong>{severityLabel(snap.risk)}.</strong> {explanation}
              </p>
              <p className="text-card-meta text-ink-2">
                {relativeOrFallback(snap.lastSuccessfulFetch)} ·{" "}
                <span className="font-mono text-mono">{PRIMARY_SOURCE_DOMAIN}</span>
              </p>
              {snap.alertCount > 0 && (
                <p className="text-card-meta text-ink-2">
                  {snap.alertCount} alerta{snap.alertCount === 1 ? "" : "s"} ativo
                  {snap.alertCount === 1 ? "" : "s"}.
                </p>
              )}
              {snap.risk === "red" && (
                <p
                  className="text-card-meta"
                  aria-label="Contatos de emergência"
                  data-emergency-contacts="true"
                >
                  {messages.emergency_contacts}
                </p>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
