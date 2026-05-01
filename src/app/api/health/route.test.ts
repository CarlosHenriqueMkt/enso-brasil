/**
 * Contract tests for GET /api/health (edge route, REQ-S2.08 + REQ-S2.10).
 *
 * Strategy: mock @/db/edge so we do NOT need a live Neon connection (and so
 * importing the route doesn't trip the `DATABASE_URL is not set` guard at
 * module top). Each test seeds the mocked rows array, then drives GET().
 *
 * Integration tests against real Postgres land in plan 02-10 (test DB hook).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HealthReportSchema } from "@/lib/api/schemas";

const rows: unknown[] = [];

vi.mock("@/db/edge", () => ({
  db: {
    select: () => ({
      from: () => Promise.resolve(rows),
    }),
  },
}));

import { GET } from "./route";

beforeEach(() => {
  rows.length = 0;
});

describe("GET /api/health (mocked db)", () => {
  it("returns 200 + valid HealthReport when sources_health is empty", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => HealthReportSchema.parse(body)).not.toThrow();
    expect(body.sources).toEqual([]);
    expect(typeof body.generatedAt).toBe("string");
  });

  it("marks isStale=true for null last_success_at", async () => {
    rows.push({
      sourceKey: "stub",
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastError: null,
      consecutiveFailures: 0,
      payloadHashDriftCount: 0,
    });
    const res = await GET();
    const body = await res.json();
    expect(body.sources[0]).toMatchObject({
      key: "stub",
      displayName: "Stub (fixture)",
      lastSuccessAt: null,
      isStale: true,
      consecutiveFailures: 0,
      payloadDriftCount: 0,
    });
  });

  it("marks isStale=true for last_success_at older than 30min", async () => {
    rows.push({
      sourceKey: "stub",
      lastAttemptAt: new Date(),
      lastSuccessAt: new Date(Date.now() - 31 * 60 * 1000),
      lastError: null,
      consecutiveFailures: 0,
      payloadHashDriftCount: 0,
    });
    const res = await GET();
    const body = await res.json();
    expect(body.sources[0].isStale).toBe(true);
    expect(body.sources[0].lastSuccessAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("marks isStale=false for last_success_at within 30min", async () => {
    rows.push({
      sourceKey: "stub",
      lastAttemptAt: new Date(),
      lastSuccessAt: new Date(Date.now() - 5 * 60 * 1000),
      lastError: null,
      consecutiveFailures: 0,
      payloadHashDriftCount: 0,
    });
    const res = await GET();
    const body = await res.json();
    expect(body.sources[0].isStale).toBe(false);
  });

  it("falls back to sourceKey as displayName when key is unknown to registry", async () => {
    rows.push({
      sourceKey: "unknown-source",
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastError: null,
      consecutiveFailures: 0,
      payloadHashDriftCount: 0,
    });
    const res = await GET();
    const body = await res.json();
    expect(body.sources[0].displayName).toBe("unknown-source");
    expect(body.sources[0].isStale).toBe(true);
  });
});
