import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, __redact } from "./edge";

describe("edge logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
  });

  it("emits a single JSON line containing ts/level/event", () => {
    logger.info("test.start", { runId: "r1" });
    expect(logSpy).toHaveBeenCalledOnce();
    const line = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.event).toBe("test.start");
    expect(parsed.level).toBe("info");
    expect(parsed.runId).toBe("r1");
    expect(typeof parsed.ts).toBe("string");
  });

  it("redacts token/secret/password keys (case-insensitive)", () => {
    const out = __redact({ token: "abc", inner: { Password: "xyz" }, ok: 1 }) as Record<
      string,
      unknown
    >;
    expect(out.token).toBe("[REDACTED]");
    expect((out.inner as Record<string, unknown>).Password).toBe("[REDACTED]");
    expect(out.ok).toBe(1);
  });

  it("redacts INGEST_TOKEN / DATABASE_URL / UPSTASH_* path keys", () => {
    const out = __redact({
      INGEST_TOKEN: "x",
      DATABASE_URL: "y",
      UPSTASH_REDIS_REST_TOKEN: "z",
      safe: "ok",
    }) as Record<string, unknown>;
    expect(out.INGEST_TOKEN).toBe("[REDACTED]");
    expect(out.DATABASE_URL).toBe("[REDACTED]");
    expect(out.UPSTASH_REDIS_REST_TOKEN).toBe("[REDACTED]");
    expect(out.safe).toBe("ok");
  });

  it("edge.ts does not import pino", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(here, "edge.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["']pino["']/);
  });
});
