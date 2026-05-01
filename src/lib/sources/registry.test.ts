import { describe, it, expect } from "vitest";
import { sources } from "./registry";
import { sourceMetadata, sourceDisplayNames } from "./registry-meta";

/**
 * Drift detector: registry-meta.ts must stay in lockstep with registry.ts.
 * Edge routes (e.g. /api/health) import only registry-meta to avoid pulling
 * stub.ts (which references node:fs at module top) into the edge bundle.
 */
describe("registry-meta drift detector", () => {
  it("every source in registry has a matching metadata entry", () => {
    expect(sourceMetadata.length).toBe(sources.length);
    for (const s of sources) {
      const meta = sourceMetadata.find((m) => m.key === s.key);
      expect(meta, `missing metadata for source key '${s.key}'`).toBeDefined();
      expect(meta!.displayName).toBe(s.displayName);
    }
  });

  it("sourceDisplayNames map matches metadata", () => {
    for (const m of sourceMetadata) {
      expect(sourceDisplayNames[m.key]).toBe(m.displayName);
    }
  });
});
