const REDACT_KEYS = /^(token|secret|password|databaseUrl)$/i;
const REDACT_PATH_KEYS = new Set([
  "INGEST_TOKEN",
  "DATABASE_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "authorization",
]);

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.test(k) || REDACT_PATH_KEYS.has(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, event: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    service: "enso-brasil",
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  });
  console.log(line);
}

export const logger = {
  debug: (event: string, fields?: Record<string, unknown>) => emit("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) => emit("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit("warn", event, fields),
  error: (event: string, err?: unknown, fields?: Record<string, unknown>) => {
    const errFields =
      err instanceof Error
        ? { err: { message: err.message, name: err.name, stack: err.stack } }
        : { err };
    emit("error", event, { ...errFields, ...fields });
  },
};
export type EdgeLogger = typeof logger;
export { redact as __redact };
