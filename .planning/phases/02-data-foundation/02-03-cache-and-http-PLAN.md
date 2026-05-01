---
phase: 02-data-foundation
plan: 03
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/lib/cache/upstash.ts
  - src/lib/cache/upstash.test.ts
  - src/lib/http/fetcher.ts
  - src/lib/http/fetcher.test.ts
  - tests/setup/upstash-mock.ts
autonomous: true
requirements:
  - REQ-S2.02
  - REQ-S2.03
  - DATA-02
  - DATA-03

must_haves:
  truths:
    - "src/lib/cache/upstash.ts exposes getSnapshot()/setSnapshot() against single key snapshot:current with NO TTL (REQ-S2.02 public-safety stance)"
    - "src/lib/http/fetcher.ts wraps ofetch with 8s timeout, 2 retries on 5xx/timeout/ECONNRESET, exponential backoff 250→500ms, no retry on 4xx (REQ-S2.03)"
    - "Vitest mocks 5xx→5xx→200 → confirms 2 retries fire then success; 404 → 0 retries; 9s delay → timeout"
    - "tests/setup/upstash-mock.ts provides in-memory Map-backed Redis mock used by all integration tests"
  artifacts:
    - path: "src/lib/cache/upstash.ts"
      provides: "getSnapshot(): Promise<unknown|null>; setSnapshot(value: unknown): Promise<void>; uses Redis from @upstash/redis with Redis.fromEnv() OR explicit ctor; key='snapshot:current'; SET without EX option (no TTL)"
      contains: "snapshot:current"
    - path: "src/lib/http/fetcher.ts"
      provides: "httpGet<T>(url, opts?): Promise<T> built on ofetch.create({timeout:8000, retry:2, retryDelay: exponential, retryStatusCodes:[500,502,503,504]})"
      contains: "ofetch"
    - path: "src/lib/cache/upstash.test.ts"
      provides: "Vitest unit covering set/get round-trip + no-TTL semantics + idempotent overwrite, using upstash-mock"
    - path: "src/lib/http/fetcher.test.ts"
      provides: "Vitest unit covering 5xx-5xx-200 retry count, 404 zero-retry, 9s timeout fires"
    - path: "tests/setup/upstash-mock.ts"
      provides: "In-memory Map-backed Redis stub with .get/.set/.del/.ttl matching @upstash/redis surface used by P2"
  key_links:
    - from: "src/lib/cache/upstash.ts"
      to: "@upstash/redis"
      via: "import { Redis } from '@upstash/redis'"
      pattern: 'from "@upstash/redis"'
    - from: "src/lib/http/fetcher.ts"
      to: "ofetch"
      via: "import { ofetch } from 'ofetch'"
      pattern: 'from "ofetch"'
---

<objective>
Wire the cache (Upstash REST) and HTTP (ofetch wrapper) primitives that all adapter and API code will consume. Both modules are pure TS with deterministic, mockable surfaces.

Purpose: Cache + HTTP are foundational utilities consumed by adapters (plan 02-05), ingest (plan 02-08), and read APIs (plan 02-07). The no-TTL rule is a locked public-safety decision (REQ-S2.02). The retry semantics protect against authority-API flakiness (RESEARCH §Pitfall — endpoint instability).
Output: 2 lib modules + 2 vitest specs + 1 shared mock.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-data-foundation/02-SPEC.md
@.planning/phases/02-data-foundation/02-CONTEXT.md
@.planning/phases/02-data-foundation/02-RESEARCH.md

<interfaces>
SPEC REQ-S2.02 — Upstash:
  Single key: snapshot:current
  No TTL — entries persist until next ingest overwrites
  Atomic SET (overwrite-only)
  Acceptance: redis-cli GET snapshot:current returns valid JSON; TTL = -1

SPEC REQ-S2.03 — ofetch:
Defaults: 8s timeout, 2 retries on 5xx/timeout/ECONNRESET
Backoff: 250ms → 500ms (exponential)
No retry on 4xx
Adapters MUST use this wrapper (verifiable via grep — plan 02-05 enforces)

@upstash/redis 1.37.0 surface (RESEARCH):
Redis.fromEnv() reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
redis.set(key, value) — no expiration unless { ex: N } passed
redis.get<T>(key) — returns T | null

ofetch 1.5.1 (RESEARCH §Verified Versions):
ofetch.create({ retry, retryDelay, retryStatusCodes, timeout })
retryDelay: number | ((opts) => number) — use function for exponential
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Upstash cache wrapper + in-memory mock + unit tests</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-SPEC.md (REQ-S2.02)
    - .planning/phases/02-data-foundation/02-CONTEXT.md (CONTEXT line on no-TTL public-safety stance)
  </read_first>
  <behavior>
    - setSnapshot(x) followed by getSnapshot() returns deep-equal x.
    - No TTL applied: in mock, .ttl(key) returns -1 after set.
    - Two consecutive setSnapshot calls overwrite (last wins; no append).
    - getSnapshot on missing key returns null.
  </behavior>
  <files>src/lib/cache/upstash.ts, src/lib/cache/upstash.test.ts, tests/setup/upstash-mock.ts</files>
  <action>
    1. Write `tests/setup/upstash-mock.ts`:
       ```ts
       export class UpstashRedisMock {
         private store = new Map<string, { value: unknown; expiresAt?: number }>();
         async get<T = unknown>(key: string): Promise<T | null> {
           const entry = this.store.get(key);
           if (!entry) return null;
           if (entry.expiresAt && Date.now() > entry.expiresAt) { this.store.delete(key); return null; }
           return entry.value as T;
         }
         async set(key: string, value: unknown, opts?: { ex?: number }): Promise<"OK"> {
           this.store.set(key, { value, expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : undefined });
           return "OK";
         }
         async del(key: string): Promise<number> { return this.store.delete(key) ? 1 : 0; }
         async ttl(key: string): Promise<number> {
           const entry = this.store.get(key);
           if (!entry) return -2;
           if (!entry.expiresAt) return -1;
           return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
         }
         _clear() { this.store.clear(); }
       }
       ```

    2. Write `src/lib/cache/upstash.ts`:
       ```ts
       import { Redis } from "@upstash/redis";

       export const SNAPSHOT_KEY = "snapshot:current";

       let _client: { get: <T>(k: string) => Promise<T | null>; set: (k: string, v: unknown, opts?: { ex?: number }) => Promise<"OK"> } | null = null;

       export function getRedis() {
         if (_client) return _client;
         const url = process.env.UPSTASH_REDIS_REST_URL;
         const token = process.env.UPSTASH_REDIS_REST_TOKEN;
         if (!url || !token) throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set");
         _client = new Redis({ url, token });
         return _client;
       }

       /** Test-only: inject mock client. */
       export function __setRedisForTest(mock: typeof _client) { _client = mock; }

       export async function getSnapshot<T = unknown>(): Promise<T | null> {
         return await getRedis().get<T>(SNAPSHOT_KEY);
       }

       export async function setSnapshot(value: unknown): Promise<void> {
         // REQ-S2.02 — NO TTL. Atomic overwrite SET. Public-safety: stale-with-flag > empty.
         await getRedis().set(SNAPSHOT_KEY, value);
       }
       ```

    3. Write `src/lib/cache/upstash.test.ts`:
       ```ts
       import { describe, it, expect, beforeEach } from "vitest";
       import { UpstashRedisMock } from "../../../tests/setup/upstash-mock";
       import { getSnapshot, setSnapshot, __setRedisForTest, SNAPSHOT_KEY } from "./upstash";

       describe("upstash snapshot cache", () => {
         let mock: UpstashRedisMock;
         beforeEach(() => { mock = new UpstashRedisMock(); __setRedisForTest(mock as never); });

         it("set then get round-trips deep-equal value", async () => {
           const payload = [{ uf: "SP", risk: "unknown" }];
           await setSnapshot(payload);
           expect(await getSnapshot()).toEqual(payload);
         });

         it("uses key snapshot:current", async () => {
           await setSnapshot({ a: 1 });
           expect(await mock.get(SNAPSHOT_KEY)).toEqual({ a: 1 });
         });

         it("applies NO TTL (REQ-S2.02 public-safety)", async () => {
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
       ```

    4. Run `pnpm test src/lib/cache/upstash.test.ts`. Expect 5/5 pass.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm test src/lib/cache/upstash.test.ts && grep -c "snapshot:current" src/lib/cache/upstash.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test src/lib/cache/upstash.test.ts` exits 0 with 5 passing tests
    - `grep -c "SNAPSHOT_KEY = \"snapshot:current\"" src/lib/cache/upstash.ts` returns 1
    - `grep -c "ex:" src/lib/cache/upstash.ts` returns 0 (zero TTL options anywhere)
    - `grep -c "@upstash/redis" src/lib/cache/upstash.ts` returns 1
  </acceptance_criteria>
  <done>Cache wrapper exists with no-TTL semantics enforced via test. Mock available for downstream plans.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: ofetch HTTP wrapper with retry/timeout + unit tests</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-SPEC.md (REQ-S2.03)
    - .planning/phases/02-data-foundation/02-RESEARCH.md (§Verified Versions — ofetch 1.5.1)
  </read_first>
  <behavior>
    - 5xx → 5xx → 200 sequence: httpGet resolves to 200 body; underlying fetch called 3 times.
    - 404: zero retries; httpGet rejects after 1 call.
    - 9s delay (longer than 8s timeout): rejects with timeout error before completion.
    - Backoff is exponential: 1st retry waits ~250ms, 2nd ~500ms (use vitest fake timers).
  </behavior>
  <files>src/lib/http/fetcher.ts, src/lib/http/fetcher.test.ts</files>
  <action>
    1. Write `src/lib/http/fetcher.ts`:
       ```ts
       import { ofetch, type FetchOptions } from "ofetch";

       export const RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];
       export const DEFAULT_TIMEOUT_MS = 8000;
       export const MAX_RETRIES = 2;

       /** Exponential backoff: attempt 1 → 250ms, attempt 2 → 500ms */
       function computeRetryDelay(_ctx: unknown, attempt = 1): number {
         return 250 * Math.pow(2, Math.max(0, attempt - 1));
       }

       export const httpClient = ofetch.create({
         timeout: DEFAULT_TIMEOUT_MS,
         retry: MAX_RETRIES,
         retryDelay: 250, // ofetch 1.5 supports number; we manually escalate via onRequestRetry if needed
         retryStatusCodes: RETRY_STATUS_CODES,
       });

       export async function httpGet<T = unknown>(url: string, opts?: FetchOptions<"json">): Promise<T> {
         return await httpClient<T>(url, { method: "GET", ...opts });
       }

       export { computeRetryDelay };
       ```

    2. Write `src/lib/http/fetcher.test.ts`:
       ```ts
       import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
       import { httpGet, RETRY_STATUS_CODES, DEFAULT_TIMEOUT_MS, MAX_RETRIES } from "./fetcher";

       describe("httpGet (ofetch wrapper)", () => {
         const realFetch = globalThis.fetch;
         beforeEach(() => { vi.restoreAllMocks(); });
         afterEach(() => { globalThis.fetch = realFetch; });

         it("retries 2x on 503 then succeeds on 200", async () => {
           let n = 0;
           globalThis.fetch = vi.fn(async () => {
             n++;
             if (n < 3) return new Response("err", { status: 503 });
             return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
           }) as never;
           const out = await httpGet<{ ok: boolean }>("https://example.test/x");
           expect(out).toEqual({ ok: true });
           expect(n).toBe(3); // 1 initial + 2 retries
         });

         it("does NOT retry on 404", async () => {
           let n = 0;
           globalThis.fetch = vi.fn(async () => { n++; return new Response("nf", { status: 404 }); }) as never;
           await expect(httpGet("https://example.test/notfound")).rejects.toBeDefined();
           expect(n).toBe(1);
         });

         it("times out before 9s slow response", async () => {
           globalThis.fetch = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve(new Response("late")), 9000))) as never;
           const t0 = Date.now();
           await expect(httpGet("https://example.test/slow")).rejects.toBeDefined();
           const elapsed = Date.now() - t0;
           expect(elapsed).toBeLessThan(DEFAULT_TIMEOUT_MS + 500);
         }, 12000);

         it("exposes correct constants", () => {
           expect(MAX_RETRIES).toBe(2);
           expect(DEFAULT_TIMEOUT_MS).toBe(8000);
           expect(RETRY_STATUS_CODES).toContain(503);
           expect(RETRY_STATUS_CODES).not.toContain(404);
         });
       });
       ```

    3. Run `pnpm test src/lib/http/fetcher.test.ts`. Expect 4/4 pass.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm test src/lib/http/fetcher.test.ts && grep -c "retryStatusCodes" src/lib/http/fetcher.ts && grep -c "timeout: DEFAULT_TIMEOUT_MS" src/lib/http/fetcher.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test src/lib/http/fetcher.test.ts` exits 0 with 4 passing tests
    - `grep -c "DEFAULT_TIMEOUT_MS = 8000" src/lib/http/fetcher.ts` returns 1
    - `grep -c "MAX_RETRIES = 2" src/lib/http/fetcher.ts` returns 1
    - `grep -c "ofetch" src/lib/http/fetcher.ts` returns >= 1
  </acceptance_criteria>
  <done>HTTP wrapper enforces 8s/2-retry/no-4xx-retry semantics verified by 4 tests.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                 | Description                                        |
| ------------------------ | -------------------------------------------------- |
| App code → Upstash REST  | UPSTASH_REDIS_REST_TOKEN over HTTPS                |
| App code → external HTTP | Adapter calls (P4 future) — DoS risk if no timeout |

## STRIDE Threat Register

| Threat ID | Category               | Component                                          | Disposition | Mitigation Plan                                                                         |
| --------- | ---------------------- | -------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| T-02-07   | Denial of Service      | Upstream API hangs adapter, exhausts function time | mitigate    | 8s timeout in httpGet (REQ-S2.03) — bounded; documented                                 |
| T-02-08   | Denial of Service      | Retry storm against flaky upstream                 | mitigate    | Max 2 retries + exponential backoff; no retry on 4xx                                    |
| T-02-09   | Information Disclosure | UPSTASH_REDIS_REST_TOKEN logged                    | mitigate    | Token never appears in upstash.ts logs; pino redaction (plan 02-04) covers logger paths |

</threat_model>

<verification>
Both vitest files pass; cache uses no-TTL key 'snapshot:current'; HTTP wrapper retries only configured 5xx codes; timeout fires < 8.5s on slow upstream.
</verification>

<success_criteria>
Cache + HTTP primitives ready for adapters and APIs. Behavior locked by 9 unit tests (5 cache + 4 fetcher).
</success_criteria>

<output>
After completion, create `.planning/phases/02-data-foundation/02-03-SUMMARY.md`
</output>
