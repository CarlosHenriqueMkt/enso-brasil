/**
 * Tests for RegionFilter — pure RSC anchor-link chip strip.
 *
 * Drives `renderToStaticMarkup` (no jsdom client mount — RSC contract).
 * Mirrors the idiom in RiskBadge.test.tsx / StaleSourceBanner.test.tsx.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { messages } from "@/lib/messages";
import { REGION_SLUGS, type Region } from "@/lib/geo/regions";

const componentPath = resolve(__dirname, "RegionFilter.tsx");

const ALL_REGIONS: Region[] = ["N", "NE", "CO", "SE", "S"];

describe("RegionFilter", () => {
  it.skipIf(!existsSync(componentPath))("renders 6 chips (Todas + 5 regions)", async () => {
    const { RegionFilter } = await import("./RegionFilter");
    const html = renderToStaticMarkup(<RegionFilter active={null} />);
    // Count <a> tags.
    const anchorCount = (html.match(/<a\s/g) ?? []).length;
    expect(anchorCount).toBe(6);
  });

  it.skipIf(!existsSync(componentPath))("hrefs match REGION_SLUGS and root", async () => {
    const { RegionFilter } = await import("./RegionFilter");
    const html = renderToStaticMarkup(<RegionFilter active={null} />);
    expect(html).toMatch(/href="\/"/);
    for (const r of ALL_REGIONS) {
      const slug = REGION_SLUGS[r];
      expect(html).toContain(`href="/?region=${slug}"`);
    }
  });

  it.skipIf(!existsSync(componentPath))(
    "active=null sets aria-current=page on Todas only",
    async () => {
      const { RegionFilter } = await import("./RegionFilter");
      const html = renderToStaticMarkup(<RegionFilter active={null} />);
      const currentMatches = html.match(/aria-current="page"/g) ?? [];
      expect(currentMatches.length).toBe(1);
      // Active chip must be the Todas anchor (href="/"). Attribute order is
      // not guaranteed by next/link, so match attributes within a single tag.
      expect(html).toMatch(/<a\b(?=[^>]*\bhref="\/")(?=[^>]*\baria-current="page")/);
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "active='N' sets aria-current=page on Norte only",
    async () => {
      const { RegionFilter } = await import("./RegionFilter");
      const html = renderToStaticMarkup(<RegionFilter active="N" />);
      const currentMatches = html.match(/aria-current="page"/g) ?? [];
      expect(currentMatches.length).toBe(1);
      expect(html).toMatch(/<a\b(?=[^>]*\bhref="\/\?region=norte")(?=[^>]*\baria-current="page")/);
    },
  );

  it.skipIf(!existsSync(componentPath))("renders locked PT-BR labels verbatim", async () => {
    const { RegionFilter } = await import("./RegionFilter");
    const html = renderToStaticMarkup(<RegionFilter active={null} />);
    expect(html).toContain(messages.filter.all);
    expect(html).toContain(messages.filter.regions.N);
    expect(html).toContain(messages.filter.regions.NE);
    expect(html).toContain(messages.filter.regions.CO);
    expect(html).toContain(messages.filter.regions.SE);
    expect(html).toContain(messages.filter.regions.S);
  });

  it.skipIf(!existsSync(componentPath))(
    "active chip carries the inverse-visual class",
    async () => {
      const { RegionFilter } = await import("./RegionFilter");
      const html = renderToStaticMarkup(<RegionFilter active="SE" />);
      expect(html).toMatch(/<a\b(?=[^>]*\bhref="\/\?region=sudeste")(?=[^>]*\bregion-chip-active)/);
    },
  );
});
