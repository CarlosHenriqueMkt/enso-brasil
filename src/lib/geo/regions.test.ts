import { describe, expect, it } from "vitest";
import { REGION_SLUGS, REGION_FROM_SLUG, UF_TO_REGION, ufsInRegion, type Region } from "./regions";
import { UF27_PROVISIONAL } from "@/lib/sources/schema";

describe("regions", () => {
  it("REGION_SLUGS maps all 5 regions to canonical IBGE PT-BR slugs", () => {
    expect(REGION_SLUGS).toStrictEqual({
      N: "norte",
      NE: "nordeste",
      CO: "centro-oeste",
      SE: "sudeste",
      S: "sul",
    });
  });

  it("REGION_FROM_SLUG is the inverse of REGION_SLUGS", () => {
    for (const [region, slug] of Object.entries(REGION_SLUGS)) {
      expect(REGION_FROM_SLUG[slug]).toBe(region as Region);
    }
    expect(REGION_FROM_SLUG["nao-existe"]).toBeUndefined();
  });

  it("every one of the 27 UFs maps to exactly one region", () => {
    for (const uf of UF27_PROVISIONAL) {
      const region = UF_TO_REGION[uf];
      expect(region, `UF ${uf} has no region`).toBeDefined();
      expect(["N", "NE", "CO", "SE", "S"]).toContain(region);
    }
  });

  it("region totals are 7 / 9 / 4 / 4 / 3 = 27", () => {
    expect(ufsInRegion("N")).toHaveLength(7);
    expect(ufsInRegion("NE")).toHaveLength(9);
    expect(ufsInRegion("CO")).toHaveLength(4);
    expect(ufsInRegion("SE")).toHaveLength(4);
    expect(ufsInRegion("S")).toHaveLength(3);

    const total =
      ufsInRegion("N").length +
      ufsInRegion("NE").length +
      ufsInRegion("CO").length +
      ufsInRegion("SE").length +
      ufsInRegion("S").length;
    expect(total).toBe(27);
  });

  it("Norte = AC AM AP PA RO RR TO (verbatim IBGE)", () => {
    expect([...ufsInRegion("N")].sort()).toStrictEqual(
      ["AC", "AM", "AP", "PA", "RO", "RR", "TO"].sort(),
    );
  });

  it("Nordeste = AL BA CE MA PB PE PI RN SE", () => {
    expect([...ufsInRegion("NE")].sort()).toStrictEqual(
      ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"].sort(),
    );
  });

  it("Centro-Oeste = DF GO MT MS", () => {
    expect([...ufsInRegion("CO")].sort()).toStrictEqual(["DF", "GO", "MS", "MT"].sort());
  });

  it("Sudeste = ES MG RJ SP", () => {
    expect([...ufsInRegion("SE")].sort()).toStrictEqual(["ES", "MG", "RJ", "SP"].sort());
  });

  it("Sul = PR RS SC", () => {
    expect([...ufsInRegion("S")].sort()).toStrictEqual(["PR", "RS", "SC"].sort());
  });

  it("round trip: slug → region → slug for every region", () => {
    for (const region of ["N", "NE", "CO", "SE", "S"] as const) {
      const slug = REGION_SLUGS[region];
      expect(REGION_FROM_SLUG[slug]).toBe(region);
      expect(REGION_SLUGS[REGION_FROM_SLUG[slug]!]).toBe(slug);
    }
  });
});
