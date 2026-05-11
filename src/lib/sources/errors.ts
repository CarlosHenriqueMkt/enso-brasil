/**
 * Source-adapter error taxonomy.
 *
 * Per Phase 4 CONTEXT D-XX taxonomy decision: NO `class extends Error`.
 * Subclassing Error has V8 prototype-chain pegadinhas (broken `instanceof`
 * across realms, transpiled prototype loss, etc.). Instead we ship a factory
 * that returns a real `Error` with a `code` tag attached as an own property
 * and `cause` set via the standard `Error` constructor option.
 *
 * Trust boundary: errors thrown here cross the adapter -> ingestion route
 * boundary. The `code` field is the stable contract consumed by `/api/ingest`.
 */
export type SourceErrorCode =
  | "http_5xx"
  | "timeout"
  | "schema_invalid"
  | "payload_drift"
  | "xml_malformed"
  | "missing_pt_br";

export interface SourceErrorLike extends Error {
  code: SourceErrorCode;
}

const CODES: ReadonlySet<SourceErrorCode> = new Set<SourceErrorCode>([
  "http_5xx",
  "timeout",
  "schema_invalid",
  "payload_drift",
  "xml_malformed",
  "missing_pt_br",
]);

/**
 * Factory for source-adapter errors. Returns a tagged `Error` per CONTEXT
 * taxonomy (cause + code, NO Error subclass).
 */
export function sourceError(
  code: SourceErrorCode,
  message: string,
  cause?: unknown,
): SourceErrorLike {
  const err = cause === undefined ? new Error(message) : new Error(message, { cause });
  return Object.assign(err, { code });
}

/**
 * Type guard narrowing `unknown` to `SourceErrorLike`. Rejects plain Errors,
 * non-Errors, and Errors whose `code` falls outside the locked union.
 */
export function isSourceError(e: unknown): e is SourceErrorLike {
  if (!(e instanceof Error)) return false;
  const code = (e as { code?: unknown }).code;
  return typeof code === "string" && CODES.has(code as SourceErrorCode);
}
