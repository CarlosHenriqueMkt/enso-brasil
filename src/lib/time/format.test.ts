/**
 * Tests for presentation-layer time formatting (UTC → BRT/AC/AM zones, PT-BR phrasing).
 */
import { describe, it, expect } from "vitest";
import { toBrtFromIsoZ, formatRelativePtBr, formatAbsolutePtBr } from "./format";

describe("formatRelativePtBr", () => {
  const NOW = new Date("2026-05-18T22:15:00Z");

  it("returns minutes phrasing under 60 minutes", () => {
    const fiveMinAgo = new Date(NOW.getTime() - 5 * 60_000).toISOString();
    expect(formatRelativePtBr(fiveMinAgo, NOW)).toBe("Atualizado há 5 minutos");
  });

  it("returns hours phrasing under 24 hours", () => {
    const twoHoursAgo = new Date(NOW.getTime() - 2 * 3600_000).toISOString();
    expect(formatRelativePtBr(twoHoursAgo, NOW)).toBe("Atualizado há 2 horas");
  });

  it("returns over_day phrasing past 24 hours", () => {
    const fortyEight = new Date(NOW.getTime() - 48 * 3600_000).toISOString();
    expect(formatRelativePtBr(fortyEight, NOW)).toBe("Atualizado há mais de 24h");
  });

  it("treats future timestamps as 0 minutes (deterministic floor)", () => {
    const future = new Date(NOW.getTime() + 5 * 60_000).toISOString();
    expect(formatRelativePtBr(future, NOW)).toBe("Atualizado há 0 minutos");
  });

  it("throws on invalid timestamp", () => {
    expect(() => formatRelativePtBr("foo", NOW)).toThrow(/Invalid timestamp/);
  });

  it("boundary: exactly 60 minutes → 1 hour bucket", () => {
    const oneHour = new Date(NOW.getTime() - 60 * 60_000).toISOString();
    expect(formatRelativePtBr(oneHour, NOW)).toBe("Atualizado há 1 horas");
  });

  it("boundary: exactly 24h → over_day bucket", () => {
    const dayBoundary = new Date(NOW.getTime() - 24 * 3600_000).toISOString();
    expect(formatRelativePtBr(dayBoundary, NOW)).toBe("Atualizado há mais de 24h");
  });
});

describe("toBrtFromIsoZ", () => {
  it("defaults to America/Sao_Paulo (UTC-3, no DST) for unspecified UF", () => {
    // 2026-05-18T22:15:01Z → 19:15:01 in São Paulo
    const d = toBrtFromIsoZ("2026-05-18T22:15:01Z");
    // The returned Date is anchored to the zone — formatting via formatAbsolutePtBr is the contract.
    expect(formatAbsolutePtBr("2026-05-18T22:15:01Z")).toBe("18/05/2026 19:15");
    expect(d).toBeInstanceOf(Date);
  });

  it("AC → America/Rio_Branco (UTC-5): 22:15Z formats as 17:15", () => {
    expect(formatAbsolutePtBr("2026-05-18T22:15:01Z", "AC")).toBe("18/05/2026 17:15");
  });

  it("AM → America/Manaus (UTC-4): 22:15Z formats as 18:15", () => {
    expect(formatAbsolutePtBr("2026-05-18T22:15:01Z", "AM")).toBe("18/05/2026 18:15");
  });

  it("SP → America/Sao_Paulo (UTC-3): 22:15Z formats as 19:15", () => {
    expect(formatAbsolutePtBr("2026-05-18T22:15:01Z", "SP")).toBe("18/05/2026 19:15");
  });

  it("throws on invalid timestamp", () => {
    expect(() => toBrtFromIsoZ("foo")).toThrow(/Invalid timestamp/);
    expect(() => formatAbsolutePtBr("foo")).toThrow(/Invalid timestamp/);
  });
});
