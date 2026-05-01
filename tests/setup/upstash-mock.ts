/**
 * In-memory Map-backed Redis stub matching the @upstash/redis surface used by
 * Phase 2 modules. Shared across plans 02-03 (cache wrapper) and 02-07 (read API)
 * to avoid hitting real Upstash during tests.
 *
 * Public-safety note: setSnapshot in production MUST NOT pass `ex` (REQ-S2.02).
 * The mock supports `ex` only so tests can assert TTL=-1 when omitted.
 */
export class UpstashRedisMock {
  private store = new Map<string, { value: unknown; expiresAt?: number }>();

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, opts?: { ex?: number }): Promise<"OK"> {
    this.store.set(key, {
      value,
      expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : undefined,
    });
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (!entry.expiresAt) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  /** Test helper: wipe internal state between tests. */
  _clear() {
    this.store.clear();
  }
}
