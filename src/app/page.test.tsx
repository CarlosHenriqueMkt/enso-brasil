/**
 * Home `/` server-component tests.
 *
 * No @testing-library/react — server-only rendering via renderToStaticMarkup
 * (mirrors RiskBadge / StaleSourceBanner / StateCard test precedent).
 *
 * `loadSnapshotForUi` is mocked through `vi.mock` so each test pins a
 * deterministic data shape (no Redis / no Postgres / no fetch).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { UF27, type StateSnapshot } from "@/lib/api/schemas";
import { messages } from "@/lib/messages";

const pagePath = resolve(__dirname, "page.tsx");

const NOW = new Date("2026-05-19T12:00:00Z");
const FRESH = new Date(NOW.getTime() - 5 * 60_000).toISOString();

function snapshots(): StateSnapshot[] {
  return UF27.map((uf) => ({
    uf,
    risk: "green",
    riskReason: "",
    alertCount: 0,
    lastSuccessfulFetch: FRESH,
    formulaVersion: "v0",
  }));
}

function unknownSnapshots(): StateSnapshot[] {
  return UF27.map((uf) => ({
    uf,
    risk: "unknown",
    riskReason: "",
    alertCount: 0,
    lastSuccessfulFetch: null,
    formulaVersion: "v0",
  }));
}

const freshHealth = [
  {
    key: "cemaden",
    displayName: "CEMADEN",
    url: "https://alertas.cemaden.gov.br",
    lastSuccess: FRESH,
    stability: "unstable" as const,
    consecutiveFailures: 0,
    payloadDriftCount: 0,
    isStale: false,
  },
  {
    key: "inmet",
    displayName: "INMET",
    url: "https://portal.inmet.gov.br",
    lastSuccess: FRESH,
    stability: "stable" as const,
    consecutiveFailures: 0,
    payloadDriftCount: 0,
    isStale: false,
  },
];

const staleHealth = freshHealth.map((h) => ({ ...h, lastSuccess: null, isStale: true }));

vi.mock("@/lib/snapshot/load", () => ({
  loadSnapshotForUi: vi.fn(),
}));

async function renderPage(searchParams: { region?: string } = {}): Promise<string> {
  const Page = (await import("./page")).default;
  // RSC: returns ReactElement
  const node = await Page({ searchParams: Promise.resolve(searchParams) });
  return renderToStaticMarkup(node);
}

describe.skipIf(!existsSync(pagePath))("HomePage /", () => {
  let loadMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/snapshot/load");
    loadMock = mod.loadSnapshotForUi as unknown as ReturnType<typeof vi.fn>;
    loadMock.mockReset();
  });

  it("renders the page title h1", async () => {
    loadMock.mockResolvedValue({
      states: snapshots(),
      health: freshHealth,
      generatedAt: NOW.toISOString(),
      degraded: false,
    });
    const html = await renderPage();
    expect(html).toContain(`<h1`);
    expect(html).toContain(messages.page_title);
  });

  it("renders 27 state cards when no region filter is set", async () => {
    loadMock.mockResolvedValue({
      states: snapshots(),
      health: freshHealth,
      generatedAt: NOW.toISOString(),
      degraded: false,
    });
    const html = await renderPage();
    const cards = html.match(/class="state-card/g);
    expect(cards?.length).toBe(27);
  });

  it("filters cards to the Sul region (3 UFs) when ?region=sul", async () => {
    loadMock.mockResolvedValue({
      states: snapshots(),
      health: freshHealth,
      generatedAt: NOW.toISOString(),
      degraded: false,
    });
    const html = await renderPage({ region: "sul" });
    const cards = html.match(/class="state-card/g);
    expect(cards?.length).toBe(3);
    expect(html).toContain("Paraná");
    expect(html).toContain("Rio Grande do Sul");
    expect(html).toContain("Santa Catarina");
  });

  it("filters cards to the Norte region (7 UFs) when ?region=norte", async () => {
    loadMock.mockResolvedValue({
      states: snapshots(),
      health: freshHealth,
      generatedAt: NOW.toISOString(),
      degraded: false,
    });
    const html = await renderPage({ region: "norte" });
    const cards = html.match(/class="state-card/g);
    expect(cards?.length).toBe(7);
  });

  it("gracefully ignores an invalid region (renders all 27)", async () => {
    loadMock.mockResolvedValue({
      states: snapshots(),
      health: freshHealth,
      generatedAt: NOW.toISOString(),
      degraded: false,
    });
    const html = await renderPage({ region: "hawaii" });
    const cards = html.match(/class="state-card/g);
    expect(cards?.length).toBe(27);
  });

  it("BrazilMap always renders all 27 UFs regardless of region filter", async () => {
    loadMock.mockResolvedValue({
      states: snapshots(),
      health: freshHealth,
      generatedAt: NOW.toISOString(),
      degraded: false,
    });
    const htmlAll = await renderPage();
    const htmlSul = await renderPage({ region: "sul" });
    // The BrazilMap emits one <a href="/estado/{uf}"> per UF (locked DOM
    // contract). Count those occurrences; must be 27 in both cases.
    const countMapLinks = (html: string) => (html.match(/href="\/estado\/[a-z]{2}"/g) ?? []).length;
    expect(countMapLinks(htmlAll)).toBeGreaterThanOrEqual(27);
    expect(countMapLinks(htmlSul)).toBeGreaterThanOrEqual(27);
  });

  it("renders the stale-source banner when any source is stale", async () => {
    loadMock.mockResolvedValue({
      states: snapshots(),
      health: [{ ...freshHealth[0]!, lastSuccess: null, isStale: true }, freshHealth[1]!],
      generatedAt: NOW.toISOString(),
      degraded: true,
    });
    const html = await renderPage();
    expect(html).toContain("stale-source-banner");
    expect(html).toContain("CEMADEN");
  });

  it("total-failure floor: renders 27 unknown/gray cards when all sources are stale", async () => {
    loadMock.mockResolvedValue({
      states: unknownSnapshots(),
      health: staleHealth,
      generatedAt: NOW.toISOString(),
      degraded: true,
    });
    const html = await renderPage();
    const cards = html.match(/class="state-card/g);
    expect(cards?.length).toBe(27);
    // Gray-stripe token must be present on every card (StateCard maps
    // risk="unknown" → token "gray").
    expect(html).toContain("--color-risk-gray-bd");
    // Stale banner must also be visible (sketch-finding 007-C).
    expect(html).toContain("stale-source-banner");
  });

  it("renders the region filter chip strip", async () => {
    loadMock.mockResolvedValue({
      states: snapshots(),
      health: freshHealth,
      generatedAt: NOW.toISOString(),
      degraded: false,
    });
    const html = await renderPage();
    expect(html).toContain("region-filter");
    expect(html).toContain(messages.filter.all);
    expect(html).toContain(messages.filter.regions.S);
  });
});
