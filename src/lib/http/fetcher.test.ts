import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, httpGet } from "./fetcher";

const URL = "https://example.test/data";

describe("httpGet", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  it("returns parsed JSON on first-attempt success", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, n: 1 }));
    const out = await httpGet<{ ok: boolean; n: number }>(URL);
    expect(out).toEqual({ ok: true, n: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on 503 then succeeds (5xx → 5xx → 200)", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ err: "first" }, 503))
      .mockResolvedValueOnce(jsonResponse({ err: "second" }, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const out = await httpGet<{ ok: boolean }>(URL, { retries: 2 });
    expect(out).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry on 404 (4xx fails fast)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ err: "not found" }, 404));
    await expect(httpGet(URL, { retries: 2 })).rejects.toBeInstanceOf(HttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws HttpError after exhausting retries on 502", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ err: "down" }, 502)));
    const err = await httpGet(URL, { retries: 2 }).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).url).toBe(URL);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("times out and surfaces HttpError when request exceeds timeoutMs", async () => {
    fetchMock.mockImplementationOnce(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        }),
    );
    await expect(httpGet(URL, { timeoutMs: 50, retries: 0 })).rejects.toBeInstanceOf(HttpError);
  });
});
