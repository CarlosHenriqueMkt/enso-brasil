import { describe, it, expect } from "vitest";
import { AlertSchema, computePayloadHash } from "./schema";

const valid = {
  source_key: "stub",
  hazard_kind: "queimada" as const,
  state_uf: "SP" as const,
  severity: "yellow" as const,
  headline: "Foco de queimada detectado",
  body: "Long body",
  source_url: "https://example.test/x",
  fetched_at: new Date().toISOString(),
  valid_from: new Date().toISOString(),
  valid_until: new Date(Date.now() + 3600_000).toISOString(),
  payload_hash: "a".repeat(64),
  raw: { foo: 1 },
};

describe("AlertSchema", () => {
  it("accepts a complete valid Alert", () => {
    expect(() => AlertSchema.parse(valid)).not.toThrow();
  });
  it("rejects missing required field (REQ-S2.09 zod gate)", () => {
    expect(() => AlertSchema.parse({ ...valid, headline: undefined })).toThrow();
  });
  it("rejects bad UF", () => {
    expect(() => AlertSchema.parse({ ...valid, state_uf: "ZZ" })).toThrow();
  });
  it("rejects non-hex payload_hash", () => {
    expect(() => AlertSchema.parse({ ...valid, payload_hash: "not-hex" })).toThrow();
  });
});

describe("computePayloadHash", () => {
  const base = {
    source_key: valid.source_key,
    hazard_kind: valid.hazard_kind,
    state_uf: valid.state_uf,
    severity: valid.severity,
    headline: valid.headline,
    body: valid.body,
    source_url: valid.source_url,
    fetched_at: valid.fetched_at,
    valid_from: valid.valid_from,
    valid_until: valid.valid_until,
  };
  it("is deterministic across calls", () => {
    expect(computePayloadHash(base)).toBe(computePayloadHash(base));
  });
  it("differs when a normalized field changes", () => {
    const a = computePayloadHash(base);
    const b = computePayloadHash({ ...base, severity: "red" });
    expect(a).not.toBe(b);
  });
  it("ignores `raw` field for stability", () => {
    const a = computePayloadHash(base);
    const b = computePayloadHash({ ...base, raw: { whatever: Math.random() } });
    expect(a).toBe(b);
  });
  it("returns 64-char hex", () => {
    expect(computePayloadHash(base)).toMatch(/^[a-f0-9]{64}$/);
  });
});
