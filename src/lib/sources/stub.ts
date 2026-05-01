import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AlertArraySchema, type Alert } from "./schema";
import type { SourceAdapter } from "./types";

/**
 * Default fixture path (relative to repo root / process.cwd()).
 * Override via `STUB_FIXTURE_PATH` env (also resolved from process.cwd()).
 */
const DEFAULT_FIXTURE = "tests/fixtures/sources/stub-default.json";

/**
 * Stub adapter (REQ-S2.05). NOT edge-safe — uses `node:fs`. Only consumed
 * by `/api/ingest` (Node runtime). Fixture is validated against `AlertSchema`
 * before return; invalid fixture throws a zod error before any persistence
 * (REQ-S2.05 acceptance).
 */
export const stubAdapter: SourceAdapter = {
  key: "stub",
  displayName: "Stub (fixture)",
  async fetch(): Promise<Alert[]> {
    const fixturePath = process.env.STUB_FIXTURE_PATH ?? DEFAULT_FIXTURE;
    const absPath = resolve(process.cwd(), fixturePath);
    const raw = await readFile(absPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return AlertArraySchema.parse(parsed);
  },
};
