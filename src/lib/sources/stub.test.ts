import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { stubAdapter } from "./stub";

describe("stubAdapter", () => {
  const original = process.env.STUB_FIXTURE_PATH;
  beforeEach(() => {
    delete process.env.STUB_FIXTURE_PATH;
  });
  afterEach(() => {
    if (original) process.env.STUB_FIXTURE_PATH = original;
    else delete process.env.STUB_FIXTURE_PATH;
  });

  it("default fixture returns 3 alerts SP/RJ/AM", async () => {
    const out = await stubAdapter.fetch();
    expect(out.length).toBe(3);
    const ufs = out.map((a) => a.state_uf).sort();
    expect(ufs).toEqual(["AM", "RJ", "SP"]);
  });

  it("STUB_FIXTURE_PATH override loads alternate fixture", async () => {
    process.env.STUB_FIXTURE_PATH = "tests/fixtures/sources/all-red.json";
    const out = await stubAdapter.fetch();
    expect(out.length).toBe(27);
    expect(out.every((a) => a.severity === "extreme")).toBe(true);
  });

  it("invalid fixture path throws", async () => {
    process.env.STUB_FIXTURE_PATH = "tests/fixtures/sources/does-not-exist.json";
    await expect(stubAdapter.fetch()).rejects.toBeDefined();
  });

  it("adapter shape matches SourceAdapter contract", () => {
    expect(stubAdapter.key).toBe("stub");
    expect(typeof stubAdapter.displayName).toBe("string");
    expect(typeof stubAdapter.fetch).toBe("function");
  });
});
