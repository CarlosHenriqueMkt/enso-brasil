import { describe, it, expect, vi } from "vitest";

type WriteFn = typeof process.stdout.write;

function patchStdout(writes: string[]): WriteFn {
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout as unknown as { write: WriteFn }).write = ((chunk: unknown) => {
    writes.push(typeof chunk === "string" ? chunk : String(chunk));
    return true;
  }) as WriteFn;
  return orig;
}

function restoreStdout(orig: WriteFn): void {
  (process.stdout as unknown as { write: WriteFn }).write = orig;
}

describe("node logger", () => {
  it("emits JSON containing event + fields", async () => {
    const writes: string[] = [];
    const orig = patchStdout(writes);
    try {
      vi.resetModules();
      vi.stubEnv("NODE_ENV", "production");
      const { logger } = await import("./node");
      logger.info("test.event", { runId: "abc-123" });
    } finally {
      restoreStdout(orig);
      vi.unstubAllEnvs();
    }
    const line = writes.find((l) => l.includes("test.event"));
    expect(line).toBeDefined();
    expect(line!).toMatch(/test\.event/);
    expect(line!).toMatch(/abc-123/);
  });

  it("redacts token/secret/password fields", async () => {
    const writes: string[] = [];
    const orig = patchStdout(writes);
    try {
      vi.resetModules();
      vi.stubEnv("NODE_ENV", "production");
      const { logger } = await import("./node");
      logger.info("redact.test", { token: "abc", nested: { password: "xyz", ok: 1 } });
    } finally {
      restoreStdout(orig);
      vi.unstubAllEnvs();
    }
    const line = writes.find((l) => l.includes("redact.test"));
    expect(line).toBeDefined();
    expect(line!).toContain("[REDACTED]");
    expect(line!).not.toContain('"abc"');
    expect(line!).not.toContain('"xyz"');
  });
});
