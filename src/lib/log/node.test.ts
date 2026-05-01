import { describe, it, expect, vi } from "vitest";

describe("node logger", () => {
  it("emits JSON containing event + fields", async () => {
    const writes: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    // @ts-expect-error monkey-patch
    process.stdout.write = (chunk: string) => {
      writes.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    };
    try {
      vi.resetModules();
      process.env.NODE_ENV = "production";
      const { logger } = await import("./node");
      logger.info("test.event", { runId: "abc-123" });
    } finally {
      // @ts-expect-error restore
      process.stdout.write = origWrite;
    }
    const line = writes.find((l) => l.includes("test.event"));
    expect(line).toBeDefined();
    expect(line!).toMatch(/test\.event/);
    expect(line!).toMatch(/abc-123/);
  });

  it("redacts token/secret/password fields", async () => {
    const writes: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    // @ts-expect-error monkey-patch
    process.stdout.write = (chunk: string) => {
      writes.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    };
    try {
      vi.resetModules();
      process.env.NODE_ENV = "production";
      const { logger } = await import("./node");
      logger.info("redact.test", { token: "abc", nested: { password: "xyz", ok: 1 } });
    } finally {
      // @ts-expect-error restore
      process.stdout.write = origWrite;
    }
    const line = writes.find((l) => l.includes("redact.test"));
    expect(line).toBeDefined();
    expect(line!).toContain("[REDACTED]");
    expect(line!).not.toContain('"abc"');
    expect(line!).not.toContain('"xyz"');
  });
});
