/**
 * Upstash Redis snapshot cache wrapper.
 *
 * REQ-S2.02 — single key `snapshot:current`, NO TTL, atomic overwrite-only.
 * Public-safety stance: stale data with explicit flag is preferable to an
 * empty UI. Reverting this rule requires updating 02-SPEC.md.
 *
 * Edge-runtime safe: pure REST client, no node:fs / node:net.
 */
import { Redis } from "@upstash/redis";

export const SNAPSHOT_KEY = "snapshot:current";

type RedisLike = {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, opts?: { ex?: number }) => Promise<"OK">;
};

let _client: RedisLike | null = null;

export function getRedis(): RedisLike {
  if (_client) return _client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set");
  }
  _client = new Redis({ url, token }) as unknown as RedisLike;
  return _client;
}

/** Test-only seam: inject an in-memory mock to avoid hitting real Upstash. */
export function __setRedisForTest(mock: RedisLike | null): void {
  _client = mock;
}

export async function getSnapshot<T = unknown>(): Promise<T | null> {
  return await getRedis().get<T>(SNAPSHOT_KEY);
}

export async function setSnapshot(value: unknown): Promise<void> {
  // REQ-S2.02 — NO TTL. Atomic overwrite SET only.
  // DO NOT add an `ex` / `px` option here without updating 02-SPEC.md first.
  await getRedis().set(SNAPSHOT_KEY, value);
}
