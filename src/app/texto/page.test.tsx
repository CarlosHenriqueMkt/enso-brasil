/**
 * /texto tests — pure SSR semantic single-page (REQ-DASH-09, A11Y-03).
 *
 * Server-rendering via renderToStaticMarkup (mirrors home + estado precedent).
 * `loadSnapshotForUi` mocked through vi.mock.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { UF27, type StateSnapshot } from "@/lib/api/schemas";
import { messages } from "@/lib/messages";

const pagePath = resolve(__dirname, "page.tsx");

const NOW = new Date("2026-05-19T12:00:00Z");
const FRESH = new Date(NOW.getTime() - 5 * 60_000).toISOString();

function freshSnapshots(): StateSnapshot[] {
  return UF27.map((uf) => ({
    uf,
    risk: "green",
    riskReason: "",
    alertCount: 0,
    lastSuccessfulFetch: FRESH,
    formulaVersion: "v0",
  }));
}

vi.mock("@/lib/snapshot/load", () => ({
  loadSnapshotForUi: vi.fn(),
}));

async function renderPage(): Promise<string> {
  const Page = (await import("./page")).default;
  const node = await Page();
  return renderToStaticMarkup(node);
}

describe.skipIf(!existsSync(pagePath))("/texto", () => {
  let loadMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/snapshot/load");
    loadMock = mod.loadSnapshotForUi as unknown as ReturnType<typeof vi.fn>;
    loadMock.mockReset();
    loadMock.mockResolvedValue({
      states: freshSnapshots(),
      health: [],
      generatedAt: NOW.toISOString(),
      degraded: false,
    });
  });

  it("renders the locked h1 page title", async () => {
    const html = await renderPage();
    expect(html).toContain("<h1");
    expect(html).toContain(messages.texto.page_title);
  });

  it("renders exactly 5 regional tables (one per IBGE macro-region)", async () => {
    const html = await renderPage();
    const tables = html.match(/<table\b/g);
    expect(tables?.length).toBe(5);
  });

  it("renders exactly 27 article sections with lowercase ids", async () => {
    const html = await renderPage();
    const articles = html.match(/<article\b[^>]*id="[a-z]{2}"/g);
    expect(articles?.length).toBe(27);
  });

  it("renders 27 total table data rows across all 5 region tables", async () => {
    const html = await renderPage();
    // Each tbody row contains a header-cell anchor `<a href="#{uf}">`.
    const anchors = html.match(/href="#[a-z]{2}"/g);
    expect(anchors?.length).toBe(27);
  });

  it("region table row counts match IBGE breakdown (N=7, NE=9, CO=4, SE=4, S=3)", async () => {
    const html = await renderPage();
    // Headings appear in order; slice between consecutive h2s.
    const regions = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];
    const expected = [7, 9, 4, 4, 3];
    for (let i = 0; i < regions.length; i++) {
      const start = html.indexOf(`>${regions[i]}<`);
      const endName = regions[i + 1] ? `>${regions[i + 1]}<` : '<h2 id="estados"';
      const end = html.indexOf(endName, start);
      const slice = html.slice(start, end === -1 ? undefined : end);
      const tableRows = (slice.match(/<tbody[\s\S]*?<\/tbody>/g) ?? []).join("");
      const rows = tableRows.match(/<tr\b/g);
      expect(rows?.length).toBe(expected[i]);
    }
  });

  it("severity cell renders the PT-BR label as text (no icon glyph)", async () => {
    const html = await renderPage();
    // green snapshots → "Sem alertas" label must appear in tbody.
    expect(html).toContain("Sem alertas");
    // Icon glyphs from messages.severity_icon (e.g. ✓) must NOT appear inside
    // the table rows. Guard by checking the icon does not appear in any
    // table cell.
    const tableContent = html.match(/<table[\s\S]*?<\/table>/g)?.join("") ?? "";
    expect(tableContent).not.toContain("✓");
    expect(tableContent).not.toContain("⚠");
    expect(tableContent).not.toContain("⛔");
  });

  it("domain links inside articles use the mono class", async () => {
    // Inject a red snapshot for SP so the article has an emergency line with
    // domain text; check at least one font-mono class is rendered somewhere
    // (the article structure emits the mono class on every <SourceLink>-style
    // host span).
    const states = freshSnapshots();
    const spIdx = states.findIndex((s) => s.uf === "SP");
    states[spIdx] = { ...states[spIdx]!, risk: "red", riskReason: "Chuva forte." };
    loadMock.mockResolvedValue({
      states,
      health: [],
      generatedAt: NOW.toISOString(),
      degraded: false,
    });
    const html = await renderPage();
    expect(html).toContain("font-mono");
  });

  it("page source file contains no `use client` directive", () => {
    const src = readFileSync(pagePath, "utf-8");
    expect(src).not.toMatch(/^\s*["']use client["']/m);
  });

  it("heading outline is h1 -> h2 (regions) -> h3 (states)", async () => {
    const html = await renderPage();
    const h1Count = (html.match(/<h1\b/g) ?? []).length;
    const h2Count = (html.match(/<h2\b/g) ?? []).length;
    const h3Count = (html.match(/<h3\b/g) ?? []).length;
    expect(h1Count).toBe(1);
    expect(h2Count).toBeGreaterThanOrEqual(5);
    expect(h3Count).toBe(27);
  });
});
