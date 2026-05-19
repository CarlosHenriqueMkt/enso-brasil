import { describe, expect, it, beforeEach } from "vitest";
import { loadBrAtlas, __resetBrAtlasCacheForTests } from "./br-atlas";
import { UF27_PROVISIONAL } from "@/lib/sources/schema";

describe("loadBrAtlas", () => {
  beforeEach(() => {
    __resetBrAtlasCacheForTests();
  });

  it("loads a FeatureCollection with 27 features", async () => {
    const fc = await loadBrAtlas();
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(27);
  });

  it("every feature has properties.uf in UF27 and a name", async () => {
    const fc = await loadBrAtlas();
    const ufSet = new Set<string>(UF27_PROVISIONAL);
    for (const f of fc.features) {
      expect(f.properties).toBeTruthy();
      expect(ufSet.has(f.properties.uf)).toBe(true);
      expect(typeof f.properties.name).toBe("string");
      expect(f.properties.name.length).toBeGreaterThan(0);
    }
    // All 27 UFs present, no duplicates.
    const ufs = fc.features.map((f: { properties: { uf: string } }) => f.properties.uf);
    expect(new Set(ufs).size).toBe(27);
  });

  it("returns the same FeatureCollection instance on second call (module cache)", async () => {
    const first = await loadBrAtlas();
    const second = await loadBrAtlas();
    expect(second).toBe(first);
  });
});
