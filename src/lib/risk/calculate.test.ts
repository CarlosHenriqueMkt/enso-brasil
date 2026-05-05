import { describe, it, expect } from "vitest";
import { calculateRiskLevel } from "./calculate";
import type { Alert } from "./types";

const baseTime = new Date("2026-05-02T12:00:00Z");
const baseMs = baseTime.getTime();
const iso = (offsetMin: number) => new Date(baseMs + offsetMin * 60_000).toISOString();

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

describe("calculateRiskLevel (RISK-02)", () => {
  it("returns 'green' for empty input", () => {
    expect(calculateRiskLevel([], baseTime)).toBe("green");
  });

  it("returns 'green' when all alerts expired", () => {
    const a = mkAlert({ valid_until: iso(-60) });
    expect(calculateRiskLevel([a], baseTime)).toBe("green");
  });

  it("returns 'yellow' for worst-severity = low", () => {
    const a = mkAlert({ severity: "low" });
    expect(calculateRiskLevel([a], baseTime)).toBe("yellow");
  });

  it("returns 'orange' for worst-severity = moderate", () => {
    const a = mkAlert({ severity: "moderate" });
    expect(calculateRiskLevel([a], baseTime)).toBe("orange");
  });

  it("returns 'red' for worst-severity = high", () => {
    const a = mkAlert({ severity: "high" });
    expect(calculateRiskLevel([a], baseTime)).toBe("red");
  });

  it("returns 'red' for worst-severity = extreme", () => {
    const a = mkAlert({ severity: "extreme" });
    expect(calculateRiskLevel([a], baseTime)).toBe("red");
  });

  it("picks worst across mixed severities", () => {
    const out = calculateRiskLevel(
      [
        mkAlert({ severity: "low" }),
        mkAlert({ severity: "high" }),
        mkAlert({ severity: "moderate" }),
      ],
      baseTime,
    );
    expect(out).toBe("red");
  });

  it("orange beats yellow when low + moderate present", () => {
    const out = calculateRiskLevel(
      [mkAlert({ severity: "low" }), mkAlert({ severity: "moderate" })],
      baseTime,
    );
    expect(out).toBe("orange");
  });
});

describe("calculateRiskLevel — 24h validity window (RISK-06)", () => {
  it("(a) valid_until=null, fetched_at=now-23h → active", () => {
    const a = mkAlert({
      valid_until: undefined,
      fetched_at: iso(-23 * 60),
      valid_from: undefined,
      severity: "high",
    });
    expect(calculateRiskLevel([a], baseTime)).toBe("red");
  });

  it("(b) valid_until=null, fetched_at=now-25h → expired → green", () => {
    const a = mkAlert({
      valid_until: undefined,
      fetched_at: iso(-25 * 60),
      valid_from: undefined,
      severity: "high",
    });
    expect(calculateRiskLevel([a], baseTime)).toBe("green");
  });

  it("(c) explicit valid_until in past → expired regardless of fetched_at", () => {
    const a = mkAlert({
      valid_until: iso(-1),
      fetched_at: iso(-30), // would be active under 24h rule, but explicit valid_until wins
      severity: "extreme",
    });
    expect(calculateRiskLevel([a], baseTime)).toBe("green");
  });
});

describe("calculateRiskLevel — purity", () => {
  it("does not mutate input array", () => {
    const input: Alert[] = [mkAlert(), mkAlert({ severity: "high" })];
    const snapshot = JSON.stringify(input);
    calculateRiskLevel(input, baseTime);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("`now` defaults to new Date() and is overridable", () => {
    expect(() => calculateRiskLevel([])).not.toThrow();
  });
});
