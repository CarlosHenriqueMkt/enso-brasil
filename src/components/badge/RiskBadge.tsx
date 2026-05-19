/**
 * RiskBadge — state-level risk indicator.
 *
 * Renders one of 5 RiskLevel values (green/yellow/orange/red/unknown) with the
 * locked PT-BR severity label (CEMADEN/INMET vocabulary) and a redundant Unicode
 * icon. Color + icon + text are three independent signals per A11Y-04.
 *
 * Theme contract (sketch-findings 03-tokens-theme):
 *   - Yellow level NEVER pairs white text on yellow fill. Uses --color-risk-yellow-ink
 *     (#6b5006) on --color-risk-yellow-bg (#fef7d6) — WCAG AA verified.
 *   - All tokens via Tailwind v4 @theme custom-properties; no hard-coded hex.
 *
 * Pure Server Component. No "use client".
 */
import { messages } from "@/lib/messages";
import type { RiskLevel } from "@/lib/risk/types";

type Props = {
  level: RiskLevel;
};

/**
 * Token suffix per level. `unknown` maps to the visual `gray` palette
 * (semantic vs. visual split — see messages.severity.unknown / .gray).
 */
const LEVEL_TOKEN: Record<RiskLevel, "green" | "yellow" | "orange" | "red" | "gray"> = {
  green: "green",
  yellow: "yellow",
  orange: "orange",
  red: "red",
  unknown: "gray",
};

export function RiskBadge({ level }: Props) {
  const token = LEVEL_TOKEN[level];
  const label = messages.severity[level];
  const icon = messages.severity_icon[level];

  // Tailwind v4 utilities resolve to the --color-risk-{token}-{bg|bd|ink} tokens
  // declared in @theme inside globals.css. NEVER replace with hex literals.
  const classes = [
    "risk-badge",
    `risk-badge-${level}`,
    "inline-flex",
    "items-center",
    "gap-1",
    `bg-risk-${token}-bg`,
    `border-risk-${token}-bd`,
    `text-risk-${token}-ink`,
    "border",
    "rounded-r-2",
    "px-s-2",
    "py-s-1",
    "text-meta",
  ].join(" ");

  return (
    <span className={classes} aria-label={label}>
      <span aria-hidden="true">{icon}</span> {label}
    </span>
  );
}
