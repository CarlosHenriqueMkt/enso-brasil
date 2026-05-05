// @vitest-environment node
/**
 * Edge runtime smoke test (RISK-01 acceptance).
 *
 * Imports calculate.ts in a Node-only Vitest env. If calculate.ts pulled in
 * any node:* module (banned by depcruise + ESLint), this would still pass —
 * BUT depcruise catches that statically. This smoke confirms the function
 * actually executes without throwing on a basic invocation.
 *
 * Real edge-runtime validation happens in P4 when the wired route is `next build`-ed.
 */

import { describe, it, expect } from "vitest";
import { calculateRiskLevel } from "./calculate";

describe("calculate.ts — edge runtime smoke (RISK-01)", () => {
  it("imports cleanly and runs with empty input", () => {
    const level = calculateRiskLevel([], new Date("2026-01-01T00:00:00Z"));
    expect(level).toBe("green");
  });

  it("returns one of the 5 RiskLevels for any valid input", () => {
    const level = calculateRiskLevel([], new Date());
    expect(["green", "yellow", "orange", "red", "unknown"]).toContain(level);
  });
});
