/**
 * ENSO Brasil — PT-BR plain-language explanation generator (RISK-09).
 *
 * Behavior:
 *  - Empty alerts                  → "Sem alertas ativos."
 *  - level === "unknown"           → "Dados indisponíveis no momento."
 *  - 1 alert                       → "1 alerta de {SeverityPT} do {SourceName} para {hazardPT}"
 *  - N>1 alerts                    → "N alertas ativos. Pior: {SeverityPT} do {SourceName} para {hazardPT}"
 *  - Multi-source same hazard      → join sources: "do INMET + CEMADEN" (post-dedup attribution[])
 *
 * Pure / edge-safe. No I/O. Imports vocab + dedup only.
 */

import type { Alert, RiskLevel } from "./types";
import { compareWorst, dedupForCalc } from "./dedup";
import { SEVERITY_LABEL, HAZARD_LABEL, SOURCE_LABEL } from "./vocab";

function sourceName(key: string): string {
  return (SOURCE_LABEL as Record<string, string>)[key] ?? key;
}

/**
 * Pick the worst alert (D-04 comparator). Joins attribution sources for multi-source
 * same-hazard groups: e.g., "INMET + CEMADEN" preserving compareWorst order.
 */
function attributionFragment(alerts: readonly Alert[]): {
  worst: Alert;
  sources: string;
} {
  const ranked = [...alerts].sort(compareWorst);
  const worst = ranked[0]!;
  // Unique sources, in compareWorst-induced order
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const a of ranked) {
    const name = sourceName(a.source_key);
    if (!seen.has(name)) {
      seen.add(name);
      ordered.push(name);
    }
  }
  return { worst, sources: ordered.join(" + ") };
}

export function generateExplanation(level: RiskLevel, alerts: readonly Alert[]): string {
  if (level === "unknown") return "Dados indisponíveis no momento.";
  if (alerts.length === 0) return "Sem alertas ativos.";

  // Use dedup so multi-source same-hazard alerts contribute to one "Pior" attribution.
  const groups = dedupForCalc(alerts);
  // Pick the worst group: the one whose survivor wins compareWorst across all groups.
  const worstGroup = [...groups].sort((a, b) => compareWorst(a.survivor, b.survivor))[0]!;
  const { worst, sources } = attributionFragment(worstGroup.attribution);
  const sevPT = SEVERITY_LABEL[worst.severity];
  const hazPT = HAZARD_LABEL[worst.hazard_kind];

  if (alerts.length === 1) {
    return `1 alerta de ${sevPT} do ${sources} para ${hazPT}`;
  }
  return `${alerts.length} alertas ativos. Pior: ${sevPT} do ${sources} para ${hazPT}`;
}
