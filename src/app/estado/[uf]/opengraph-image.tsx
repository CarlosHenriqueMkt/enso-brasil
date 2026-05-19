/**
 * /estado/[uf] OG image — text-only ImageResponse (REQ-DASH-04, T-05-21).
 *
 * Next.js convention file. Statically generated at build time for each of the
 * 27 UFs (paired with `generateStaticParams` in `page.tsx`).
 *
 * Hard constraints (CLAUDE.md + sketch-findings + threat-model):
 *   - 1200×630 (canonical OG size — WhatsApp, Twitter X, LinkedIn all accept).
 *   - SYSTEM fonts only — NEVER load external fonts (CLAUDE.md / 3G budget /
 *     deterministic build).
 *   - No external images, no PII, no analytics pixels (T-05-21).
 *   - Background `--color-bg` (#fafaf8) + left risk stripe in
 *     `--color-risk-{token}-bd`.
 *
 * Content (top-to-bottom): state name (large), severity label, one-line lead,
 * canonical domain, timestamp line.
 *
 * Note: `next/og` ImageResponse only accepts inline CSS — Tailwind token
 * variables are NOT available at build time inside the OG runtime. We hard-
 * code the canonical hex values mirrored from globals.css (see
 * sketch-findings risk-token table). Keep these in sync if globals.css
 * tokens change.
 */
import { ImageResponse } from "next/og";
import { loadSnapshotForUi } from "@/lib/snapshot/load";
import { UF27, type UF } from "@/lib/api/schemas";
import { messages } from "@/lib/messages";
import type { RiskLevel } from "@/lib/sources/schema";

export const runtime = "nodejs";
export const alt = "ENSO Brasil — Alertas climáticos por estado";
export const size = { width: 1200, height: 630 } as const;
export const contentType = "image/png";

const UF27_LOWER: ReadonlySet<string> = new Set(UF27.map((u) => u.toLowerCase()));

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

/** Locked palette mirrored from globals.css. Keep in sync. */
const RISK_BD: Record<"green" | "yellow" | "orange" | "red" | "gray", string> = {
  green: "#2e7d32",
  yellow: "#f9a825",
  orange: "#ef6c00",
  red: "#c62828",
  gray: "#9e9e9e",
};

const BG = "#fafaf8";
const INK = "#1a1a1a";
const INK_2 = "#5a5a5a";

function levelToken(level: RiskLevel): "green" | "yellow" | "orange" | "red" | "gray" {
  return level === "unknown" ? "gray" : level;
}

function severityLabel(level: RiskLevel): string {
  return level === "unknown" ? messages.severity.unknown : messages.severity[level];
}

export default async function StateOgImage({
  params,
}: {
  params: { uf: string };
}): Promise<ImageResponse> {
  const raw = params.uf;
  // Lowercase-only contract identical to page.tsx
  const validLower = raw === raw.toLowerCase() && UF27_LOWER.has(raw);
  const uf = (validLower ? raw.toUpperCase() : "BR") as UF;

  const { states } = await loadSnapshotForUi();
  const snapshot = validLower ? (states.find((s) => s.uf === uf) ?? null) : null;

  const level: RiskLevel = snapshot?.risk ?? "unknown";
  const stateName = validLower ? UF_NAME_PT[uf] : "Brasil";
  const token = levelToken(level);
  const sevLabel = severityLabel(level);
  const lead =
    snapshot?.riskReason && snapshot.riskReason.length > 0
      ? snapshot.riskReason
      : level === "green"
        ? "Sem emergências no momento."
        : "Dados indisponíveis no momento.";

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: BG,
        color: INK,
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* Left risk stripe — 24px wide, full height */}
      <div
        style={{
          width: 24,
          height: "100%",
          background: RISK_BD[token],
        }}
      />
      {/* Body */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: 64,
          gap: 24,
          flex: 1,
        }}
      >
        <div style={{ fontSize: 28, color: INK_2 }}>ENSO Brasil</div>
        <div style={{ fontSize: 88, fontWeight: 600, lineHeight: 1.05 }}>
          {stateName} <span style={{ color: INK_2 }}>({uf})</span>
        </div>
        <div style={{ fontSize: 56, color: RISK_BD[token], fontWeight: 500 }}>{sevLabel}</div>
        <div
          style={{
            fontSize: 32,
            color: INK,
            maxWidth: 980,
            lineHeight: 1.25,
            display: "flex",
          }}
        >
          {lead}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "auto",
            fontSize: 24,
            color: INK_2,
          }}
        >
          <span>ensobrasil.com.br/estado/{uf.toLowerCase()}</span>
          <span>
            {snapshot?.lastSuccessfulFetch
              ? new Date(snapshot.lastSuccessfulFetch).toISOString().slice(0, 16) + "Z"
              : "Dados indisponíveis"}
          </span>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
