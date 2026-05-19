import { describe, it, expect } from "vitest";
import { SEVERITY_TABLE, mapSeverity } from "./cemaden";

describe("CEMADEN severity mapping (RISK-04, RISK-10)", () => {
  it("exposes the locked v0.1 SEVERITY_TABLE", () => {
    expect(SEVERITY_TABLE).toMatchSnapshot();
  });

  it("table is frozen", () => {
    expect(Object.isFrozen(SEVERITY_TABLE)).toBe(true);
  });

  it.each([
    ["Moderado", "moderate"],
    ["Alto", "high"],
    ["Muito Alto", "extreme"],
  ] as const)("maps known CEMADEN nivel %s → %s", (raw, expected) => {
    expect(mapSeverity(raw)).toBe(expected);
  });

  it("falls back to 'moderate' for unknown terms (RISK-04)", () => {
    expect(mapSeverity("Random Term")).toBe("moderate");
    expect(mapSeverity("")).toBe("moderate");
    expect(mapSeverity("MODERADO")).toBe("moderate"); // case-sensitive on purpose
  });
});
