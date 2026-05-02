import { describe, it, expect } from "vitest";
import { SEVERITY_TABLE, mapSeverity } from "./inmet";

describe("INMET severity mapping (RISK-04, RISK-10)", () => {
  it("exposes the locked v0.1 SEVERITY_TABLE", () => {
    expect(SEVERITY_TABLE).toMatchSnapshot();
  });

  it("table is frozen", () => {
    expect(Object.isFrozen(SEVERITY_TABLE)).toBe(true);
  });

  describe("CAP standard values (English)", () => {
    it.each([
      ["Minor", "low"],
      ["Moderate", "moderate"],
      ["Severe", "high"],
      ["Extreme", "extreme"],
    ] as const)("maps %s → %s", (raw, expected) => {
      expect(mapSeverity(raw)).toBe(expected);
    });
  });

  describe("PT-BR INMET aliases", () => {
    it.each([
      ["Aviso", "moderate"],
      ["Aviso de Perigo", "high"],
      ["Perigo", "high"],
      ["Perigo Potencial", "moderate"],
      ["Grande Perigo", "extreme"],
    ] as const)("maps %s → %s", (raw, expected) => {
      expect(mapSeverity(raw)).toBe(expected);
    });
  });

  it("falls back to 'moderate' for unknown terms (RISK-04)", () => {
    expect(mapSeverity("Random Term")).toBe("moderate");
    expect(mapSeverity("")).toBe("moderate");
    expect(mapSeverity("MINOR")).toBe("moderate"); // case-sensitive
    expect(mapSeverity("aviso")).toBe("moderate"); // case-sensitive
  });
});
