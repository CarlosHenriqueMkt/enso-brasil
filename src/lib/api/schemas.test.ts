import { describe, it, expect } from "vitest";
import {
  UF27,
  StateSnapshotSchema,
  StateSnapshotsResponseSchema,
  HealthReportSchema,
} from "./schemas";

const validSnap = (uf: string) => ({
  uf,
  risk: "unknown" as const,
  riskReason: "Dados indisponíveis",
  alertCount: 0,
  lastSuccessfulFetch: null,
  formulaVersion: "v0-placeholder",
});

describe("StateSnapshotSchema", () => {
  it("accepts a valid placeholder snapshot", () => {
    expect(() => StateSnapshotSchema.parse(validSnap("SP"))).not.toThrow();
  });
  it("rejects bad UF", () => {
    expect(() => StateSnapshotSchema.parse(validSnap("ZZ"))).toThrow();
  });
  it("rejects negative alertCount", () => {
    expect(() => StateSnapshotSchema.parse({ ...validSnap("SP"), alertCount: -1 })).toThrow();
  });
  it("rejects bad risk enum", () => {
    expect(() => StateSnapshotSchema.parse({ ...validSnap("SP"), risk: "purple" })).toThrow();
  });
});

describe("StateSnapshotsResponseSchema (length 27)", () => {
  const all27 = UF27.map((u) => validSnap(u));
  it("accepts all 27 UFs", () => {
    expect(() => StateSnapshotsResponseSchema.parse(all27)).not.toThrow();
  });
  it("rejects length 26", () => {
    expect(() => StateSnapshotsResponseSchema.parse(all27.slice(0, 26))).toThrow();
  });
  it("rejects length 28", () => {
    expect(() => StateSnapshotsResponseSchema.parse([...all27, validSnap("SP")])).toThrow();
  });
});

describe("HealthReportSchema", () => {
  it("accepts a valid HealthReport", () => {
    const report = {
      generatedAt: new Date().toISOString(),
      sources: [
        {
          key: "stub",
          displayName: "Stub",
          lastSuccessAt: null,
          consecutiveFailures: 0,
          isStale: false,
          payloadDriftCount: 0,
        },
      ],
    };
    expect(() => HealthReportSchema.parse(report)).not.toThrow();
  });
  it("rejects bad generatedAt", () => {
    expect(() => HealthReportSchema.parse({ generatedAt: "not-iso", sources: [] })).toThrow();
  });
});

describe("UF27", () => {
  it("has exactly 27 entries", () => {
    expect(UF27.length).toBe(27);
  });
});
