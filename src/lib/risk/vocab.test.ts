import { describe, it, expect } from "vitest";

import { LEVEL_LABEL, SEVERITY_LABEL, HAZARD_LABEL, SOURCE_LABEL } from "./vocab";

describe("risk/vocab — typed PT-BR re-exports (RISK-09)", () => {
  it("LEVEL_LABEL maps every RiskLevel to locked PT-BR copy", () => {
    expect(LEVEL_LABEL).toEqual({
      green: "Sem alertas",
      yellow: "Atenção",
      orange: "Alerta",
      red: "Perigo",
      unknown: "Dados indisponíveis",
    });
  });

  it("SEVERITY_LABEL maps every Severity to locked PT-BR copy", () => {
    expect(SEVERITY_LABEL).toEqual({
      low: "Atenção",
      moderate: "Alerta",
      high: "Perigo",
      extreme: "Perigo extremo",
    });
  });

  it("HAZARD_LABEL covers every HAZARD_KINDS literal", () => {
    expect(HAZARD_LABEL).toEqual({
      queimada: "queimada",
      enchente: "enchente",
      estiagem: "estiagem",
      incendio: "incêndio",
      inundacao: "inundação",
      seca: "seca",
    });
  });

  it("SOURCE_LABEL covers cemaden/inmet/stub", () => {
    expect(SOURCE_LABEL).toEqual({
      cemaden: "CEMADEN",
      inmet: "INMET",
      stub: "Stub",
    });
  });

  it("all maps are frozen (Object.freeze)", () => {
    expect(Object.isFrozen(LEVEL_LABEL)).toBe(true);
    expect(Object.isFrozen(SEVERITY_LABEL)).toBe(true);
    expect(Object.isFrozen(HAZARD_LABEL)).toBe(true);
    expect(Object.isFrozen(SOURCE_LABEL)).toBe(true);
  });
});
