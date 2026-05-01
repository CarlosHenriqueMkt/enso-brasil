import { describe, it, expect, beforeEach } from "vitest";
import { UpstashRedisMock } from "../../../tests/setup/upstash-mock";
import {
  getSnapshot,
  setSnapshot,
  __setRedisForTest,
  SNAPSHOT_KEY,
} from "./upstash";

describe("upstash snapshot cache (REQ-S2.02 — no-TTL public-safety)", () => {
  let mock: UpstashRedisMock;

  beforeEach(() => {
    mock = new UpstashRedisMock();
    __setRedisForTest(mock as never);
  });

  it("set then get round-trips deep-equal value", async () => {
    const payload = [{ uf: "SP", risk: "unknown" }];
    await setSnapshot(payload);
    expect(await getSnapshot()).toEqual(payload);
  });

  it("uses key snapshot:current", async () => {
    await setSnapshot({ a: 1 });
    expect(await mock.get(SNAPSHOT_KEY)).toEqual({ a: 1 });
  });

  it("applies NO TTL (REQ-S2.02 — stale-with-flag > empty)", async () => {
    await setSnapshot({ a: 1 });
    expect(await mock.ttl(SNAPSHOT_KEY)).toBe(-1);
  });

  it("overwrites on subsequent set (atomic, last-wins)", async () => {
    await setSnapshot({ v: 1 });
    await setSnapshot({ v: 2 });
    expect(await getSnapshot()).toEqual({ v: 2 });
  });

  it("returns null on missing key", async () => {
    expect(await getSnapshot()).toBeNull();
  });
});
