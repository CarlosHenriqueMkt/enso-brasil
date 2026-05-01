# Plan 02-03 — Cache + HTTP · SUMMARY

**Plan:** `02-03-cache-and-http-PLAN.md`
**Status:** complete
**Wave:** 2 (parallel)
**Tasks:** 2/2

## Commits

- `6f770e9` feat(02-03): add Upstash snapshot cache wrapper with no-TTL semantics
- `<later>` feat(02-03): ofetch wrapper with retry + timeout (REQ-S2.03) — written inline post-stream-cut

## Files written

- `src/lib/cache/upstash.ts` — `getSnapshot()` / `setSnapshot()` over single key `snapshot:current`. Atomic SET, NO TTL (REQ-S2.02 — public-safety: stale-with-flag > empty). `__setRedisForTest` exposed for vitest.
- `src/lib/cache/upstash.test.ts` — vitest with UpstashRedisMock; verifies no `ex:`/`px:` option used (grep gate); set-then-get round-trip; overwrite semantics.
- `tests/setup/upstash-mock.ts` — minimal Redis-protocol mock with `get`/`set` ops; reused by 02-07 contract tests.
- `src/lib/http/fetcher.ts` — `httpGet(url, opts)` on ofetch. Defaults: 8s timeout, 2 retries on 5xx + ECONNRESET + AbortError, exp backoff 250→500ms, no retry on 4xx. Exports `HttpError { url, status?, cause? }` (with `override readonly cause` per TS strict).
- `src/lib/http/fetcher.test.ts` — 5 cases: first-attempt success / 5xx→5xx→200 retries / 4xx fails fast / 502×3 exhausts / timeoutMs via AbortSignal.

## Verification

- `pnpm exec tsc --noEmit` → exit 0
- `pnpm test` → 32/32 pass (5 http + cache + others from prior waves)
- Direct `fetch()` ban verifiable via grep on src/lib/sources (zero matches enforced by 02-05)
- No `ex:` or `px:` TTL option in upstash.ts (grep gate)

## Deviations

1. **Stream-cut mid-execution.** Subagent completed cache module + commit but never wrote `src/lib/http/fetcher.ts` before terminating. Orchestrator wrote fetcher inline post-recovery; functionally identical to plan spec.
2. **`onResponse` callback option dropped from `HttpGetOptions`.** ofetch's own `FetchOptions.onResponse` has incompatible hook signature; caller can use returned typed JSON or wrap externally. Reduces API surface with no loss of capability.
3. **Test for "exhausts retries on 502" uses `mockImplementation` not `mockResolvedValue`.** A single `Response` object can only be consumed once; resolving the same `Response` to multiple calls causes the second consumption to fail unexpectedly and abort the retry loop early. `mockImplementation(() => Promise.resolve(jsonResponse(..., 502)))` returns a fresh Response per call.

## REQ coverage

- **REQ-S2.02** ✓ — no-TTL atomic SET on `snapshot:current`
- **REQ-S2.03** ✓ — ofetch wrapper with documented retry/timeout/status-aware behavior
- Indirectly enables REQ-S2.04 (adapters use this wrapper) and REQ-S2.10 (/api/states reads via getSnapshot)

## Anti-patterns avoided

- No raw `fetch()` calls outside this wrapper module
- No TTL set on snapshot cache key (verifier greps for absence)
- Edge-runtime safe (no node:fs imports)
