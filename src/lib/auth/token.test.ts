import { describe, it, expect } from "vitest";
import { verifyBearerToken } from "./token";

const mkReq = (auth?: string) =>
  new Request("http://x.test", { headers: auth ? { authorization: auth } : {} });

describe("verifyBearerToken", () => {
  it("returns true for matching Bearer token", () => {
    expect(verifyBearerToken(mkReq("Bearer abc123"), "abc123")).toBe(true);
  });
  it("returns false for wrong token (same length)", () => {
    expect(verifyBearerToken(mkReq("Bearer abc124"), "abc123")).toBe(false);
  });
  it("returns false for missing Authorization header", () => {
    expect(verifyBearerToken(mkReq(), "abc123")).toBe(false);
  });
  it("returns false for header without Bearer prefix", () => {
    expect(verifyBearerToken(mkReq("Basic abc123"), "abc123")).toBe(false);
  });
  it("returns false for length mismatch (constant-time path, no throw)", () => {
    expect(verifyBearerToken(mkReq("Bearer ab"), "abcdef")).toBe(false);
  });
  it("does not throw on empty token after Bearer prefix", () => {
    expect(() => verifyBearerToken(mkReq("Bearer "), "abc")).not.toThrow();
    expect(verifyBearerToken(mkReq("Bearer "), "abc")).toBe(false);
  });
});
