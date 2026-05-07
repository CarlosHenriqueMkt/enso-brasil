import { describe, it, expect } from "vitest";
import { sourceError, isSourceError, type SourceErrorCode } from "./errors";

describe("sourceError factory", () => {
  it("attaches code as own property and returns a real Error", () => {
    const err = sourceError("http_5xx", "upstream 503");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("http_5xx");
    expect(err.message).toBe("upstream 503");
    // V8-friendly: no custom name, no subclass
    expect(err.name).toBe("Error");
  });

  it("preserves cause when provided", () => {
    const original = new Error("network down");
    const err = sourceError("timeout", "fetch timed out", original);
    expect(err.cause).toBe(original);
  });

  it("omits cause when not provided", () => {
    const err = sourceError("schema_invalid", "zod failed");
    expect(err.cause).toBeUndefined();
  });

  it("isSourceError accepts factory output for every locked code", () => {
    const codes: SourceErrorCode[] = [
      "http_5xx",
      "timeout",
      "schema_invalid",
      "payload_drift",
      "xml_malformed",
      "missing_pt_br",
    ];
    for (const code of codes) {
      const err = sourceError(code, `msg-${code}`);
      expect(isSourceError(err)).toBe(true);
    }
  });

  it("isSourceError rejects plain Errors with no code", () => {
    expect(isSourceError(new Error("plain"))).toBe(false);
  });

  it("isSourceError rejects Errors whose code is outside the locked union", () => {
    const fake = Object.assign(new Error("bogus"), { code: "nope_unknown" });
    expect(isSourceError(fake)).toBe(false);
  });

  it("isSourceError rejects non-Error values", () => {
    expect(isSourceError(null)).toBe(false);
    expect(isSourceError(undefined)).toBe(false);
    expect(isSourceError({ code: "http_5xx", message: "x" })).toBe(false);
    expect(isSourceError("string")).toBe(false);
  });
});
