/**
 * SourceLink — external link to an official source with the hostname in mono font.
 *
 * Locked design rule (sketch-findings FOUND-10): fonte oficial sempre linkada;
 * o domínio em mono-font sinaliza link externo / oficial.
 *
 * P1 use: contact line on /privacidade (D-05 — LinkedIn).
 * P5+ use: every card that cites CEMADEN, INMET, IBGE, Defesa Civil, NOAA.
 *
 * Server Component (no 'use client') — pure render, no client state.
 */
type Props = {
  href: string;
  name: string;
};

export function SourceLink({ href, name }: Props) {
  const domain = new URL(href).hostname;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {name} <span className="font-mono text-ink-2">({domain})</span>
    </a>
  );
}
