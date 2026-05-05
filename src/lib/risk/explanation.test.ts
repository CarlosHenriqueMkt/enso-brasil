import { describe, it, expect } from "vitest";
import { generateExplanation } from "./explanation";
import type { Alert } from "./types";

const baseTime = new Date("2026-05-02T12:00:00Z").getTime();
const iso = (offsetMin: number) => new Date(baseTime + offsetMin * 60_000).toISOString();

const mkAlert = (overrides: Partial<Alert> = {}): Alert => ({
  source_key: "cemaden",
  hazard_kind: "enchente",
  state_uf: "MG",
  severity: "moderate",
  headline: "test",
  fetched_at: iso(0),
  valid_from: iso(0),
  valid_until: iso(60),
  payload_hash: "hash",
  raw: {},
  ...overrides,
});

describe("generateExplanation (RISK-09) — 6 acceptance cases", () => {
  it("(1) 0 alerts / green", () => {
    expect(generateExplanation("green", [])).toMatchInlineSnapshot(`"Sem alertas ativos."`);
  });

  it("(2) 1 alert / yellow (severity=low)", () => {
    const a = mkAlert({ severity: "low", source_key: "inmet", hazard_kind: "queimada" });
    expect(generateExplanation("yellow", [a])).toMatchInlineSnapshot(
      `"1 alerta de Atenção do INMET para queimada"`,
    );
  });

  it("(3) 1 alert / orange (severity=moderate)", () => {
    const a = mkAlert({ severity: "moderate", source_key: "cemaden", hazard_kind: "enchente" });
    expect(generateExplanation("orange", [a])).toMatchInlineSnapshot(
      `"1 alerta de Alerta do CEMADEN para enchente"`,
    );
  });

  it("(4) multi-alert / red", () => {
    const alerts = [
      mkAlert({
        severity: "moderate",
        source_key: "cemaden",
        hazard_kind: "enchente",
        state_uf: "MG",
      }),
      mkAlert({
        severity: "high",
        source_key: "inmet",
        hazard_kind: "estiagem",
        state_uf: "MG",
        fetched_at: iso(10),
        valid_from: iso(0),
        valid_until: iso(120),
      }),
      mkAlert({
        severity: "extreme",
        source_key: "inmet",
        hazard_kind: "queimada",
        state_uf: "MG",
        fetched_at: iso(20),
        valid_from: iso(0),
        valid_until: iso(120),
      }),
    ];
    expect(generateExplanation("red", alerts)).toMatchInlineSnapshot(
      `"3 alertas ativos. Pior: Perigo extremo do INMET para queimada"`,
    );
  });

  it("(5) multi-source same-hazard (post-dedup) → joined attribution (LOCKED string per D-04 comparator)", () => {
    // Two alerts, same (hazard_kind, state_uf), both moderate, overlapping windows.
    // compareWorst tie-breaker: newer fetched_at wins → INMET (iso(10)) first, CEMADEN (iso(0)) second.
    const alerts = [
      mkAlert({
        severity: "moderate",
        source_key: "cemaden",
        hazard_kind: "enchente",
        fetched_at: iso(0),
      }),
      mkAlert({
        severity: "moderate",
        source_key: "inmet",
        hazard_kind: "enchente",
        fetched_at: iso(10),
        valid_from: iso(30),
        valid_until: iso(120),
      }),
    ];
    expect(generateExplanation("orange", alerts)).toMatchInlineSnapshot(
      `"2 alertas ativos. Pior: Alerta do INMET + CEMADEN para enchente"`,
    );
    // Locked from D-04 comparator. If this test fails, the regression is in:
    //   (a) compareWorst tie-break order, or
    //   (b) SOURCE_LABEL casing (must yield "INMET" / "CEMADEN" uppercase), or
    //   (c) SEVERITY_LABEL["moderate"] !== "Alerta", or
    //   (d) HAZARD_LABEL["enchente"] !== "enchente".
    // Fix the regression — DO NOT bake a new snapshot.
  });

  it("(6) unknown level", () => {
    const alerts = [mkAlert()]; // even with alerts, unknown short-circuits
    expect(generateExplanation("unknown", alerts)).toMatchInlineSnapshot(
      `"Dados indisponíveis no momento."`,
    );
    expect(generateExplanation("unknown", [])).toMatchInlineSnapshot(
      `"Dados indisponíveis no momento."`,
    );
  });

  it("pluralization: 1 vs 2", () => {
    const a = mkAlert({ source_key: "cemaden", hazard_kind: "enchente" });
    const b = mkAlert({
      source_key: "inmet",
      hazard_kind: "queimada",
      fetched_at: iso(60),
      valid_from: iso(60),
      valid_until: iso(120),
    });
    expect(generateExplanation("yellow", [a])).toMatch(/^1 alerta /);
    expect(generateExplanation("orange", [a, b])).toMatch(/^2 alertas /);
  });

  it("defensive fallback: unknown source_key renders raw key", () => {
    const a = mkAlert({ source_key: "noaa-future" }); // not in SOURCE_LABEL
    const out = generateExplanation("yellow", [a]);
    expect(out).toContain("noaa-future"); // raw key passes through
  });

  it("attribution dedupes same-source duplicates within a group", () => {
    // Two alerts same (hazard_kind, state_uf, source_key), overlapping windows → 1 dedup group
    // with 2 attribution entries from same source. Source name must appear once, not twice.
    const alerts = [
      mkAlert({
        severity: "moderate",
        source_key: "inmet",
        hazard_kind: "enchente",
        fetched_at: iso(0),
      }),
      mkAlert({
        severity: "moderate",
        source_key: "inmet",
        hazard_kind: "enchente",
        fetched_at: iso(10),
      }),
    ];
    const out = generateExplanation("orange", alerts);
    expect(out).toBe("2 alertas ativos. Pior: Alerta do INMET para enchente");
    expect(out.match(/INMET/g)?.length).toBe(1); // not "INMET + INMET"
  });
});
