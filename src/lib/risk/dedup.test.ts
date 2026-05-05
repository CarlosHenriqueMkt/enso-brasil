import { describe, it, expect } from "vitest";
import { dedupForCalc, compareWorst, SEVERITY_RANK } from "./dedup";
import type { Alert } from "./types";

const baseTime = new Date("2026-05-02T12:00:00Z").getTime();
const iso = (offsetMin: number) => new Date(baseTime + offsetMin * 60_000).toISOString();
const HASH = "a".repeat(64);

const mkAlert = (overrides: Partial<Alert> = {}): Alert => ({
  source_key: "cemaden",
  hazard_kind: "enchente",
  state_uf: "MG",
  severity: "moderate",
  headline: "test",
  fetched_at: iso(0),
  valid_from: iso(0),
  valid_until: iso(60),
  payload_hash: HASH,
  raw: {},
  ...overrides,
});

describe("dedupForCalc (RISK-05)", () => {
  it("(a) two CEMADEN+INMET alerts same hazard+state, overlapping window → 1 group; highest severity survives", () => {
    const c = mkAlert({ source_key: "cemaden", severity: "moderate", fetched_at: iso(0) });
    const i = mkAlert({
      source_key: "inmet",
      severity: "high",
      fetched_at: iso(10),
      valid_from: iso(30),
      valid_until: iso(120),
    });
    const out = dedupForCalc([c, i]);
    expect(out).toHaveLength(1);
    expect(out[0]!.survivor.source_key).toBe("inmet");
    expect(out[0]!.survivor.severity).toBe("high");
    expect(out[0]!.attribution).toHaveLength(2);
  });

  it("(b) two same-hazard alerts, NON-overlapping windows → 2 groups", () => {
    const a = mkAlert({ valid_from: iso(0), valid_until: iso(30) });
    const b = mkAlert({ valid_from: iso(120), valid_until: iso(180), fetched_at: iso(120) });
    const out = dedupForCalc([a, b]);
    expect(out).toHaveLength(2);
  });

  it("(c) different hazards, same state → 2 groups", () => {
    const a = mkAlert({ hazard_kind: "enchente" });
    const b = mkAlert({ hazard_kind: "queimada" });
    const out = dedupForCalc([a, b]);
    expect(out).toHaveLength(2);
  });

  it("does not mutate input array", () => {
    const input: Alert[] = [
      mkAlert({ fetched_at: iso(60) }),
      mkAlert({ source_key: "inmet", severity: "high", fetched_at: iso(0) }),
    ];
    const snapshot = JSON.stringify(input);
    dedupForCalc(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("uses 24h fallback when valid_until is undefined", () => {
    const a = mkAlert({ valid_until: undefined, fetched_at: iso(0), valid_from: undefined });
    const b = mkAlert({
      valid_until: undefined,
      fetched_at: iso(12 * 60),
      valid_from: undefined,
      source_key: "inmet",
      severity: "high",
    });
    const out = dedupForCalc([a, b]);
    expect(out).toHaveLength(1);
  });

  it("returns empty array when given empty input", () => {
    expect(dedupForCalc([])).toEqual([]);
  });

  it("single alert → single group with attribution=[alert]", () => {
    const a = mkAlert();
    const out = dedupForCalc([a]);
    expect(out).toHaveLength(1);
    expect(out[0]!.survivor).toBe(a);
    expect(out[0]!.attribution).toEqual([a]);
  });
});

describe("compareWorst (D-04)", () => {
  it("severity differs → higher severity wins (extreme over moderate)", () => {
    const a = mkAlert({ severity: "moderate" });
    const b = mkAlert({ severity: "extreme" });
    expect([a, b].sort(compareWorst)[0]).toBe(b);
  });

  it("(a) same severity, different fetched_at → newer wins", () => {
    const a = mkAlert({ severity: "moderate", fetched_at: iso(0) });
    const b = mkAlert({ severity: "moderate", fetched_at: iso(60) });
    expect([a, b].sort(compareWorst)[0]).toBe(b);
  });

  it("(b) same severity + fetched_at, different source_key → alphabetical asc wins", () => {
    const a = mkAlert({ source_key: "cemaden", fetched_at: iso(0) });
    const b = mkAlert({ source_key: "inmet", fetched_at: iso(0) });
    expect([a, b].sort(compareWorst)[0]).toBe(a);
    // Reversed input → still cemaden first
    expect([b, a].sort(compareWorst)[0]).toBe(a);
  });

  it("(c) deterministic across 100 shuffles", () => {
    const fixtures = [
      mkAlert({ source_key: "cemaden", severity: "high", fetched_at: iso(0) }),
      mkAlert({ source_key: "inmet", severity: "high", fetched_at: iso(0) }),
      mkAlert({ source_key: "stub", severity: "moderate", fetched_at: iso(60) }),
      mkAlert({ source_key: "cemaden", severity: "extreme", fetched_at: iso(-30) }),
    ];
    const expected = [...fixtures].sort(compareWorst).map((a) => a.source_key + a.severity);
    for (let i = 0; i < 100; i++) {
      const shuffled = [...fixtures].sort(() => Math.random() - 0.5);
      const actual = shuffled.sort(compareWorst).map((a) => a.source_key + a.severity);
      expect(actual).toEqual(expected);
    }
  });
});

describe("SEVERITY_RANK", () => {
  it("ranks extreme > high > moderate > low", () => {
    expect(SEVERITY_RANK.extreme).toBeGreaterThan(SEVERITY_RANK.high);
    expect(SEVERITY_RANK.high).toBeGreaterThan(SEVERITY_RANK.moderate);
    expect(SEVERITY_RANK.moderate).toBeGreaterThan(SEVERITY_RANK.low);
  });
});
