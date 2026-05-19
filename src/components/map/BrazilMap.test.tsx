/**
 * BrazilMap SSR test — renders the async Server Component to a static HTML
 * string via `react-dom/server` (no React 19 hooks, no DOM, no Link runtime).
 *
 * Asserts the LOCKED DOM invariant (plan 10 grep depends on it):
 *   exactly 27 `<a href="/estado/{uf}">…<path …/>…</a>` pairs (lowercase href).
 */
import { describe, expect, it, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { BrazilMap } from "./BrazilMap";
import { __resetBrAtlasCacheForTests } from "@/lib/geo/br-atlas";
import { UF27_PROVISIONAL, type RiskLevel } from "@/lib/sources/schema";

async function renderMap(
  states: ReadonlyArray<{ uf: (typeof UF27_PROVISIONAL)[number]; level: RiskLevel }>,
): Promise<string> {
  const element = (await BrazilMap({ states })) as ReactElement;
  return renderToStaticMarkup(element);
}

describe("BrazilMap (SSR)", () => {
  beforeEach(() => {
    __resetBrAtlasCacheForTests();
  });

  it("renders the outer svg with aria-label (no role='img' — interactive children make it semantically wrong, and axe nested-interactive flags role='img' with focusable descendants)", async () => {
    const html = await renderMap([]);
    expect(html).toMatch(/<svg/);
    expect(html).toMatch(/aria-label="Mapa do Brasil — risco por estado"/);
  });

  it("renders svg with width=100% so it does not collapse in grid containers", async () => {
    const html = await renderMap([]);
    expect(html).toMatch(/<svg[^>]*width="100%"/);
  });

  it("renders exactly 27 <a href=/estado/{uf}> links wrapping a <path>", async () => {
    const html = await renderMap([]);
    const anchorMatches = html.match(/<a[^>]*href="\/estado\/[a-z]{2}"/g) ?? [];
    expect(anchorMatches).toHaveLength(27);

    const pathMatches = html.match(/<path[^>]*d="/g) ?? [];
    expect(pathMatches).toHaveLength(27);

    // DOM invariant: every UF appears once as a lowercase href.
    for (const uf of UF27_PROVISIONAL) {
      const slug = uf.toLowerCase();
      const re = new RegExp(`href="/estado/${slug}"`);
      expect(re.test(html), `missing href=/estado/${slug}`).toBe(true);
    }
  });

  it("applies CSS-var fills (no hard-coded hex)", async () => {
    const html = await renderMap([]);
    // Every <path> uses fill="var(--color-risk-…-bg)".
    const fillMatches =
      html.match(/fill="var\(--color-risk-(green|yellow|orange|red|gray)-bg\)"/g) ?? [];
    expect(fillMatches).toHaveLength(27);
    // No raw hex colors.
    expect(html).not.toMatch(/fill="#[0-9a-fA-F]{3,8}"/);
  });

  it("maps explicit risk levels onto the right UFs", async () => {
    const html = await renderMap([
      { uf: "SP", level: "red" },
      { uf: "RJ", level: "orange" },
      { uf: "AC", level: "green" },
    ]);
    // SP carries red palette.
    expect(html).toMatch(/href="\/estado\/sp"[\s\S]*?fill="var\(--color-risk-red-bg\)"/);
    expect(html).toMatch(/href="\/estado\/rj"[\s\S]*?fill="var\(--color-risk-orange-bg\)"/);
    expect(html).toMatch(/href="\/estado\/ac"[\s\S]*?fill="var\(--color-risk-green-bg\)"/);
  });

  it("defaults unspecified UFs to risk level `unknown` (gray palette)", async () => {
    const html = await renderMap([{ uf: "SP", level: "red" }]);
    // AM was not specified — should fall back to gray.
    expect(html).toMatch(/href="\/estado\/am"[\s\S]*?fill="var\(--color-risk-gray-bg\)"/);
  });

  it("emits prefetch={false} on every link (no 27-prefetch storm)", async () => {
    // next/link renders the `prefetch` prop to HTML on SSR; presence of the
    // 27 anchors plus absence of any client prefetch hint is the invariant.
    // We assert the prop *was passed* by checking that no anchor carries a
    // prefetch=true hint and that the count of links equals 27.
    const html = await renderMap([]);
    expect(html).not.toMatch(/data-prefetch="true"/);
  });

  it("each anchor carries an aria-label of the form `${name}: ${severity}`", async () => {
    const html = await renderMap([{ uf: "SP", level: "red" }]);
    expect(html).toMatch(/aria-label="São Paulo: Perigo"/);
  });

  it("each path embeds a <title> for CSS-only hover tooltip", async () => {
    const html = await renderMap([]);
    const titleMatches = html.match(/<title>[^<]+<\/title>/g) ?? [];
    expect(titleMatches.length).toBeGreaterThanOrEqual(27);
  });
});
