/**
 * HTTP wrapper built on ofetch with retry + timeout (REQ-S2.03).
 *
 * Adapters under `src/lib/sources/**` MUST consume this module — direct
 * `fetch()` calls in that tree are forbidden (verifier greps for absence).
 *
 * Defaults:
 *   - timeout: 8s
 *   - retries: 2 on 5xx / timeout / ECONNRESET
 *   - backoff: 250ms then 500ms (exponential)
 *   - retry on 4xx: NO
 */

import { ofetch, type FetchOptions } from "ofetch";

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_RETRIES = 2;
const RETRY_BACKOFF_MS = [250, 500] as const;
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "EAI_AGAIN"]);

export interface HttpGetOptions extends Omit<FetchOptions<"json">, "method" | "retry" | "timeout"> {
  timeoutMs?: number;
  retries?: number;
}

export class HttpError extends Error {
  readonly status?: number;
  readonly url: string;
  override readonly cause?: unknown;
  constructor(message: string, opts: { url: string; status?: number; cause?: unknown }) {
    super(message);
    this.name = "HttpError";
    this.url = opts.url;
    this.status = opts.status;
    this.cause = opts.cause;
  }
}

function isRetryableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code =
    (err as { code?: string; cause?: { code?: string } }).code ??
    (err as { cause?: { code?: string } }).cause?.code;
  if (code && RETRYABLE_ERROR_CODES.has(code)) return true;
  const name = (err as { name?: string }).name;
  if (name === "TimeoutError" || name === "AbortError") return true;
  return false;
}

function isRetryableStatus(status: number | undefined): boolean {
  return status !== undefined && RETRYABLE_STATUS.has(status);
}

/**
 * GET a JSON resource with automatic retry/timeout.
 *
 * Throws `HttpError` after final attempt. 4xx responses fail fast (no retry).
 */
export async function httpGet<R = unknown>(url: string, opts: HttpGetOptions = {}): Promise<R> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, ...rest } = opts;
  const maxAttempts = retries + 1;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await ofetch<R>(url, {
        ...rest,
        method: "GET",
        responseType: "json",
        timeout: timeoutMs,
        retry: 0, // we own the retry loop
      });
      return result;
    } catch (err) {
      lastErr = err;
      const status =
        (err as { response?: { status?: number }; statusCode?: number }).response?.status ??
        (err as { statusCode?: number }).statusCode;

      const retryable =
        isRetryableStatus(status) || (status === undefined && isRetryableError(err));
      const isLast = attempt === maxAttempts - 1;

      if (!retryable || isLast) {
        throw new HttpError(
          status !== undefined
            ? `GET ${url} failed with status ${status}`
            : `GET ${url} failed: ${(err as Error).message ?? String(err)}`,
          { url, status, cause: err },
        );
      }

      const backoff = RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
      await new Promise<void>((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw new HttpError("unreachable", { url, cause: lastErr });
}
