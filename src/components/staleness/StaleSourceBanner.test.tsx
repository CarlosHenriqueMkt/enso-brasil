import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { messages } from "@/lib/messages";

const componentPath = resolve(__dirname, "StaleSourceBanner.tsx");

/** Deterministic "now" so relative phrasing is reproducible. */
const NOW = new Date("2026-05-18T12:00:00Z");

/** Helpers for ISO timestamps relative to NOW. */
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000).toISOString();

describe("StaleSourceBanner", () => {
  it.skipIf(!existsSync(componentPath))("renders nothing when sources array is empty", async () => {
    const { StaleSourceBanner } = await import("./StaleSourceBanner");
    const html = renderToStaticMarkup(<StaleSourceBanner sources={[]} now={NOW} />);
    expect(html).toBe("");
  });

  it.skipIf(!existsSync(componentPath))(
    "renders nothing when every source is fresh (< 30 min)",
    async () => {
      const { StaleSourceBanner } = await import("./StaleSourceBanner");
      const html = renderToStaticMarkup(
        <StaleSourceBanner
          sources={[
            {
              key: "cemaden",
              displayName: "CEMADEN",
              url: "https://alertas.cemaden.gov.br",
              lastSuccess: minutesAgo(10),
              stability: "stable",
            },
            {
              key: "inmet",
              displayName: "INMET",
              url: "https://portal.inmet.gov.br",
              lastSuccess: minutesAgo(29),
              stability: "stable",
            },
          ]}
          now={NOW}
        />,
      );
      expect(html).toBe("");
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "renders one banner when exactly one source is stale (verbatim copy)",
    async () => {
      const { StaleSourceBanner } = await import("./StaleSourceBanner");
      const html = renderToStaticMarkup(
        <StaleSourceBanner
          sources={[
            {
              key: "cemaden",
              displayName: "CEMADEN",
              url: "https://alertas.cemaden.gov.br",
              lastSuccess: minutesAgo(45),
              stability: "stable",
            },
            {
              key: "inmet",
              displayName: "INMET",
              url: "https://portal.inmet.gov.br",
              lastSuccess: minutesAgo(5),
              stability: "stable",
            },
          ]}
          now={NOW}
        />,
      );
      const expected = messages.empty.stale_source("CEMADEN", "https://alertas.cemaden.gov.br");
      expect(html).toContain(expected);
      expect(html).not.toContain("INMET");
      // Exactly one stale-source-banner block rendered.
      expect(html.match(/stale-source-banner-/g)?.length).toBe(1);
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "renders two banners when two sources are stale (stacked)",
    async () => {
      const { StaleSourceBanner } = await import("./StaleSourceBanner");
      const html = renderToStaticMarkup(
        <StaleSourceBanner
          sources={[
            {
              key: "cemaden",
              displayName: "CEMADEN",
              url: "https://alertas.cemaden.gov.br",
              lastSuccess: minutesAgo(60),
              stability: "stable",
            },
            {
              key: "inmet",
              displayName: "INMET",
              url: "https://portal.inmet.gov.br",
              lastSuccess: null,
              stability: "unstable",
            },
          ]}
          now={NOW}
        />,
      );
      expect(html.match(/stale-source-banner-/g)?.length).toBe(2);
      expect(html).toContain("CEMADEN");
      expect(html).toContain("INMET");
      // Unstable source uses gray palette; stable uses orange.
      expect(html).toContain("bg-risk-orange-bg");
      expect(html).toContain("bg-risk-gray-bg");
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "treats lastSuccess=null as stale (never succeeded)",
    async () => {
      const { StaleSourceBanner } = await import("./StaleSourceBanner");
      const html = renderToStaticMarkup(
        <StaleSourceBanner
          sources={[
            {
              key: "noaa",
              displayName: "NOAA",
              url: "https://psl.noaa.gov",
              lastSuccess: null,
              stability: "unstable",
            },
          ]}
          now={NOW}
        />,
      );
      expect(html).toContain("NOAA");
      expect(html).toContain("https://psl.noaa.gov");
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "uses formatRelativePtBr for the secondary timestamp line",
    async () => {
      const { StaleSourceBanner } = await import("./StaleSourceBanner");
      const html = renderToStaticMarkup(
        <StaleSourceBanner
          sources={[
            {
              key: "cemaden",
              displayName: "CEMADEN",
              url: "https://alertas.cemaden.gov.br",
              lastSuccess: minutesAgo(45),
              stability: "stable",
            },
          ]}
          now={NOW}
        />,
      );
      // 45 min ago → hours bucket = 0? No: 45 < 60, so minutes bucket.
      expect(html).toContain("Atualizado há 45 minutos");
      expect(html).toContain('data-relative-timestamp="true"');
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "never renders yellow palette classes or white text (contrast lock)",
    async () => {
      const { StaleSourceBanner } = await import("./StaleSourceBanner");
      const html = renderToStaticMarkup(
        <StaleSourceBanner
          sources={[
            {
              key: "cemaden",
              displayName: "CEMADEN",
              url: "https://alertas.cemaden.gov.br",
              lastSuccess: null,
              stability: "stable",
            },
            {
              key: "inmet",
              displayName: "INMET",
              url: "https://portal.inmet.gov.br",
              lastSuccess: null,
              stability: "unstable",
            },
          ]}
          now={NOW}
        />,
      );
      expect(html).not.toMatch(/risk-yellow/);
      expect(html).not.toMatch(/text-white/);
      expect(html).not.toMatch(/color:\s*#fff/i);
      expect(html).not.toMatch(/color:\s*white/i);
    },
  );
});
