/**
 * Phase 3 — composed-pipeline integration test (AC-3 closure).
 *
 * Demonstrates that the PUBLIC API surface
 *   `applyStaleness(calculateRiskLevel(alerts, now), sourcesHealth, now)`
 * emits each of the 5 RiskLevels: green | yellow | orange | red | unknown.
 *
 * Why this lives in a dedicated file: SPEC AC-3 ("returns each of 5 levels")
 * is satisfied by the COMPOSITION, not by calculate.ts alone (which never emits
 * "unknown" — that is staleness-derived). Plan 09 covers green/yellow/orange/red
 * directly; Plan 10 covers "unknown" in isolation. This test makes the composition
 * explicit so the gate is unambiguous.
 */

import { describe, it, expect } from "vitest";
import { calculateRiskLevel } from "./calculate";
import { applyStaleness } from "./snapshot";
import type { Alert, RiskLevel, SourcesHealthRow } from "./types";

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
  payload_hash: "a".repeat(64),
  raw: {},
  ...overrides,
});

const freshHealth: SourcesHealthRow[] = [
  { source_key: "cemaden", last_successful_fetch: iso(-5) }, // 5 min ago — fresh
  { source_key: "inmet", last_successful_fetch: iso(-5) },
];

const staleHealth: SourcesHealthRow[] = [
  { source_key: "cemaden", last_successful_fetch: iso(-90) }, // 90 min ago — stale (>1h)
  { source_key: "inmet", last_successful_fetch: iso(-90) },
];

function pipeline(alerts: Alert[], health: SourcesHealthRow[], now: Date): RiskLevel {
  const baseLevel = calculateRiskLevel(alerts, now);
  return applyStaleness(baseLevel, health, now);
}

describe("composed pipeline (AC-3) — calculate → applyStaleness emits all 5 RiskLevels", () => {
  it("green: no alerts, fresh sources", () => {
    expect(pipeline([], freshHealth, baseTime)).toBe("green");
  });

  it("yellow: 1 low-severity alert, fresh sources", () => {
    expect(pipeline([mkAlert({ severity: "low" })], freshHealth, baseTime)).toBe("yellow");
  });

  it("orange: 1 moderate-severity alert, fresh sources", () => {
    expect(pipeline([mkAlert({ severity: "moderate" })], freshHealth, baseTime)).toBe("orange");
  });

  it("red: 1 high-severity alert, fresh sources", () => {
    expect(pipeline([mkAlert({ severity: "high" })], freshHealth, baseTime)).toBe("red");
  });

  it("unknown: any input but ALL sources stale (>1h)", () => {
    // Input alerts are irrelevant — staleness override always wins per RISK-07.
    expect(pipeline([mkAlert({ severity: "extreme" })], staleHealth, baseTime)).toBe("unknown");
    expect(pipeline([], staleHealth, baseTime)).toBe("unknown");
  });
});
