import { describe, it, expect, beforeEach } from "vitest";
import { UpstashRedisMock } from "../../../../tests/setup/upstash-mock";
import { __setRedisForTest } from "@/lib/cache/upstash";
import { UF27 } from "@/lib/api/schemas";
import { GET } from "./route";

const validSnap = (uf: string) => ({
  uf,
  risk: "unknown",
  riskReason: "Dados indisponíveis",
  alertCount: 0,
  lastSuccessfulFetch: null,
  formulaVersion: "v0-placeholder",
});
const all27 = UF27.map(validSnap);

describe("GET /api/states", () => {
  let mock: UpstashRedisMock;
  beforeEach(() => {
    mock = new UpstashRedisMock();
    __setRedisForTest(mock as never);
  });

  it("returns 503 + {error:'snapshot_unavailable'} on cache miss", async () => {
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "snapshot_unavailable" });
  });

  it("returns 200 + valid StateSnapshotsResponse on cache hit", async () => {
    await mock.set("snapshot:current", all27);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(27);
    expect(body[0]).toMatchObject({ uf: expect.any(String), risk: expect.any(String) });
  });

  it("returns 502 on schema-mismatched cache content", async () => {
    await mock.set("snapshot:current", [{ bogus: true }]);
    const res = await GET();
    expect(res.status).toBe(502);
  });
});
