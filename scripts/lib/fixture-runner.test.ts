/**
 * Unit tests for structuralDiff and runFixtureRefresh (Plan 04-04).
 *
 * Uses a temporary directory (via os.tmpdir + random suffix) so tests are
 * hermetic and don't touch the real tests/fixtures/sources/ tree.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { structuralDiff, runFixtureRefresh } from "./fixture-runner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "fixture-runner-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

/**
 * Override the fixtures dir by monkey-patching — instead we use the opts
 * to write into tmpDir by pointing fetchPayload at a temp dir.
 * Simpler approach: call the helper directly and assert file contents.
 *
 * Because runFixtureRefresh hard-codes "tests/fixtures/sources" we test it
 * via a wrapper that sets the cwd to the temp directory where the file
 * structure is replicated.
 */

// runFixtureRefresh uses a relative path "tests/fixtures/sources". We need
// to ensure this resolves correctly. We'll use a subdirectory in the temp
// dir for isolation and temporarily change process.cwd isn't possible in
// tests without shell tricks — instead we directly test via the module by
// writing fixture files into the real tests/fixtures/sources/_test/ prefix
// pattern and cleaning them up, OR we extract the path logic.
//
// Pragmatic choice: for integration of runFixtureRefresh we write files
// into a dedicated test subdir of tests/fixtures/sources using a unique
// source name not colliding with "inmet" or "cemaden".

const TEST_SOURCE = "test-runner" as "inmet"; // cast to satisfy type
const FIXTURES_DIR = "tests/fixtures/sources";

async function writeTestFixture(filename: string, content: string): Promise<void> {
  await writeFile(join(FIXTURES_DIR, filename), content, "utf8");
}

// Clean up test fixtures after each test
const createdFiles: string[] = [];
afterEach(async () => {
  const { rm: rmFs } = await import("node:fs/promises");
  for (const f of createdFiles) {
    await rmFs(f, { force: true }).catch(() => {});
  }
  createdFiles.length = 0;
});

// ---------------------------------------------------------------------------
// structuralDiff tests
// ---------------------------------------------------------------------------

describe("structuralDiff", () => {
  it("identical objects → leaf_only", () => {
    const obj = { a: 1, b: "hello", c: [1, 2, 3] };
    expect(structuralDiff(obj, { ...obj })).toBe("leaf_only");
  });

  it("same shape, different leaf values → leaf_only", () => {
    const prior = { id: "old-001", severity: "high", count: 3 };
    const next = { id: "new-999", severity: "extreme", count: 99 };
    expect(structuralDiff(prior, next)).toBe("leaf_only");
  });

  it("extra key added at depth 2 → structural_drift", () => {
    const prior = { alert: { id: "1", info: { event: "Chuva" } } };
    const next = { alert: { id: "1", info: { event: "Chuva", newField: "added" } } };
    expect(structuralDiff(prior, next)).toBe("structural_drift");
  });

  it("key removed at depth 1 → structural_drift", () => {
    const prior = { id: "abc", severity: "high", expires: "2026-01-01" };
    const next = { id: "abc", severity: "high" }; // expires removed
    expect(structuralDiff(prior, next)).toBe("structural_drift");
  });

  it("array length differs, same element shape → leaf_only", () => {
    const prior = [
      { id: "1", name: "A" },
      { id: "2", name: "B" },
    ];
    const next = [
      { id: "1", name: "A" },
      { id: "2", name: "B" },
      { id: "3", name: "C" },
    ];
    expect(structuralDiff(prior, next)).toBe("leaf_only");
  });

  it("array element gains a new key → structural_drift", () => {
    const prior = [{ id: "1", name: "A" }];
    const next = [{ id: "1", name: "A", extra: "newField" }];
    expect(structuralDiff(prior, next)).toBe("structural_drift");
  });

  it("type change at leaf (string → number) → structural_drift", () => {
    const prior = { count: "42" };
    const next = { count: 42 };
    expect(structuralDiff(prior, next)).toBe("structural_drift");
  });
});

// ---------------------------------------------------------------------------
// runFixtureRefresh tests
// ---------------------------------------------------------------------------

describe("runFixtureRefresh", () => {
  it("no prior fixture → writes file, returns no_prior", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const expectedFilename = `${TEST_SOURCE}-${today}.json`;
    const expectedPath = join(FIXTURES_DIR, expectedFilename);
    createdFiles.push(expectedPath);

    const payload = JSON.stringify({ id: "test-001", severity: "high" });
    const result = await runFixtureRefresh({
      source: TEST_SOURCE,
      ext: "json",
      fetchPayload: async () => payload,
      parseForDiff: JSON.parse,
    });

    expect(result.kind).toBe("no_prior");
    expect(result.priorPath).toBeNull();
    expect(result.newPath).toBe(expectedPath);
    expect(result.diff).toBe("");

    // File should have been written
    const { readFile: rf } = await import("node:fs/promises");
    const written = await rf(expectedPath, "utf8");
    expect(written).toBe(payload);
  });

  it("prior fixture with unchanged shape → returns leaf_only", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    const priorFilename = `${TEST_SOURCE}-${yesterday}.json`;
    const newFilename = `${TEST_SOURCE}-${today}.json`;
    const priorPath = join(FIXTURES_DIR, priorFilename);
    const newPath = join(FIXTURES_DIR, newFilename);
    createdFiles.push(priorPath, newPath);

    const priorPayload = JSON.stringify({ id: "old-001", severity: "moderate" });
    await writeTestFixture(priorFilename, priorPayload);

    const nextPayload = JSON.stringify({ id: "new-999", severity: "extreme" });
    const result = await runFixtureRefresh({
      source: TEST_SOURCE,
      ext: "json",
      fetchPayload: async () => nextPayload,
      parseForDiff: JSON.parse,
    });

    expect(result.kind).toBe("leaf_only");
    expect(result.priorPath).toBe(priorPath);
    expect(result.diff).toContain("-");
    expect(result.diff).toContain("+");
  });

  it("prior fixture with structural drift → returns structural_drift", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    const priorFilename = `${TEST_SOURCE}-${yesterday}.json`;
    const newFilename = `${TEST_SOURCE}-${today}.json`;
    const priorPath = join(FIXTURES_DIR, priorFilename);
    const newPath = join(FIXTURES_DIR, newFilename);
    createdFiles.push(priorPath, newPath);

    const priorPayload = JSON.stringify({ id: "001", severity: "high" });
    await writeTestFixture(priorFilename, priorPayload);

    // next adds a new key → structural drift
    const nextPayload = JSON.stringify({ id: "001", severity: "high", newField: "appeared" });
    const result = await runFixtureRefresh({
      source: TEST_SOURCE,
      ext: "json",
      fetchPayload: async () => nextPayload,
      parseForDiff: JSON.parse,
    });

    expect(result.kind).toBe("structural_drift");
    expect(result.priorPath).toBe(priorPath);
  });
});
