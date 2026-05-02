import { describe, it, expect, expectTypeOf } from "vitest";
import { FORMULA_VERSION, applyStaleness } from "./snapshot";
import type { SourcesHealthRow, StateSnapshotPayload } from "./types";
import type { StateSnapshot } from "@/lib/api/schemas";

const now = new Date("2026-05-02T12:00:00Z");
const iso = (offsetMin: number) => new Date(now.getTime() + offsetMin * 60_000).toISOString();

const fresh: SourcesHealthRow = {
  source_key: "cemaden",
  last_successful_fetch: iso(-30), // 30 min ago = fresh
};
const stale: SourcesHealthRow = {
  source_key: "inmet",
  last_successful_fetch: iso(-90), // 90 min ago = stale
};
const neverFetched: SourcesHealthRow = {
  source_key: "stub",
  last_successful_fetch: null,
};

describe("FORMULA_VERSION (RISK-08)", () => {
  it("equals 'v0' as const", () => {
    expect(FORMULA_VERSION).toBe("v0");
    expectTypeOf(FORMULA_VERSION).toEqualTypeOf<"v0">();
  });
});

describe("applyStaleness (RISK-07)", () => {
  it("(a) all sources fresh → input level passes through", () => {
    expect(applyStaleness("orange", [fresh, fresh], now)).toBe("orange");
    expect(applyStaleness("red", [fresh], now)).toBe("red");
    expect(applyStaleness("green", [fresh], now)).toBe("green");
  });

  it("(b) all sources stale > 1h → 'unknown'", () => {
    expect(applyStaleness("red", [stale, stale], now)).toBe("unknown");
    expect(applyStaleness("orange", [stale, neverFetched], now)).toBe("unknown");
  });

  it("(c) one fresh + others stale → input level (≥1 source current)", () => {
    expect(applyStaleness("orange", [fresh, stale, neverFetched], now)).toBe("orange");
  });

  it("(d) empty sources array → 'unknown' (defensive)", () => {
    expect(applyStaleness("red", [], now)).toBe("unknown");
    expect(applyStaleness("green", [], now)).toBe("unknown");
  });

  it("does not mutate sourcesHealth input", () => {
    const input: SourcesHealthRow[] = [fresh, stale];
    const snapshot = JSON.stringify(input);
    applyStaleness("red", input, now);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("now defaults to new Date()", () => {
    expect(() => applyStaleness("green", [fresh])).not.toThrow();
  });

  it("source with last_successful_fetch=null is treated as stale", () => {
    expect(applyStaleness("red", [neverFetched], now)).toBe("unknown");
  });
});

describe("StateSnapshotPayload type (RISK-08)", () => {
  it("is structural superset of P2 StateSnapshot", () => {
    // Compile-time only (run-time no-op).
    expectTypeOf<Omit<StateSnapshotPayload, "explanation">>().toMatchTypeOf<StateSnapshot>();
  });
});
