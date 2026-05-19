/**
 * /estado/[uf] tests — server-only rendering via renderToStaticMarkup
 * (mirrors the home page precedent in src/app/page.test.tsx).
 *
 * - `loadSnapshotForUi` mocked via vi.mock to inject deterministic snapshots.
 * - `next/navigation` notFound mocked so we can assert on invalid UFs without
 *   throwing through React.
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

function snapshotsAt(level: StateSnapshot["risk"]): StateSnapshot[] {
  return UF27.map((uf) => ({
    uf,
    risk: level,
    riskReason: level === "red" ? "Chuva forte com risco de deslizamento." : "",
    alertCount: level === "red" ? 3 : 0,
    lastSuccessfulFetch: FRESH,
    formulaVersion: "v0",
  }));
}

vi.mock("@/lib/snapshot/load", () => ({
  loadSnapshotForUi: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

async function renderStatePage(uf: string): Promise<string> {
  const Page = (await import("./page")).default;
  const node = await Page({ params: Promise.resolve({ uf }) });
  return renderToStaticMarkup(node);
}

describe.skipIf(!existsSync(pagePath))("/estado/[uf]", () => {
  let loadMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/snapshot/load");
    loadMock = mod.loadSnapshotForUi as unknown as ReturnType<typeof vi.fn>;
    loadMock.mockReset();
    loadMock.mockResolvedValue({
      states: snapshotsAt("green"),
      health: [],
      generatedAt: NOW.toISOString(),
      degraded: false,
    });
  });

  it("generateStaticParams returns 27 lowercase entries", async () => {
    const { generateStaticParams } = await import("./page");
    const params = await generateStaticParams();
    expect(params).toHaveLength(27);
    expect(params.every((p) => p.uf === p.uf.toLowerCase())).toBe(true);
    expect(params.map((p) => p.uf)).toContain("sp");
  });

  it("renders 200 for all 27 lowercase UFs", async () => {
    for (const uf of UF27) {
      const html = await renderStatePage(uf.toLowerCase());
      expect(html).toContain("<main");
    }
  });

  it("calls notFound() for an unknown UF code", async () => {
    const { notFound } = await import("next/navigation");
    await expect(renderStatePage("zz")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("calls notFound() for an uppercase UF (lowercase-only contract)", async () => {
    const { notFound } = await import("next/navigation");
    await expect(renderStatePage("SP")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("red level: renders emergency contacts line (199 Defesa Civil)", async () => {
    loadMock.mockResolvedValue({
      states: snapshotsAt("red"),
      health: [],
      generatedAt: NOW.toISOString(),
      degraded: false,
    });
    const html = await renderStatePage("sp");
    expect(html).toContain("199 Defesa Civil");
  });

  it("yellow level: does NOT render emergency contacts line", async () => {
    loadMock.mockResolvedValue({
      states: snapshotsAt("yellow"),
      health: [],
      generatedAt: NOW.toISOString(),
      degraded: false,
    });
    const html = await renderStatePage("sp");
    expect(html).not.toContain("199 Defesa Civil");
  });

  it("renders a polite aria-live region announcing the severity + state name", async () => {
    const html = await renderStatePage("sp");
    expect(html).toMatch(/aria-live="polite"/);
    expect(html).toContain(messages.severity.green);
    expect(html).toContain("São Paulo");
  });

  it("renders a ShareButton wrapper with the canonical lowercase URL", async () => {
    const html = await renderStatePage("sp");
    // ShareButton renders a `share-button` span and a wa.me anchor that
    // embeds the URL URL-encoded. Assert the encoded canonical path is
    // present and the wrapper class is rendered.
    expect(html).toContain("share-button");
    expect(html).toMatch(/%2Festado%2Fsp/);
  });
});
