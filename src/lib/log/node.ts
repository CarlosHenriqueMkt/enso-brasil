import pino, { type Logger, type LoggerOptions } from "pino";

const isDev = process.env.NODE_ENV !== "production";
const level = process.env.LOG_LEVEL ?? (isDev ? "debug" : "info");

const baseOptions: LoggerOptions = {
  level,
  redact: {
    paths: [
      "INGEST_TOKEN",
      "DATABASE_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "UPSTASH_REDIS_REST_URL",
      "token",
      "secret",
      "password",
      "*.token",
      "*.secret",
      "*.password",
      "headers.authorization",
      "*.databaseUrl",
    ],
    censor: "[REDACTED]",
  },
  base: { service: "enso-brasil" },
  timestamp: pino.stdTimeFunctions.isoTime,
};

const baseLogger: Logger = isDev
  ? pino({
      ...baseOptions,
      transport: {
        target: "pino-pretty",
        options: { singleLine: true, colorize: true },
      },
    })
  : pino(baseOptions);

function makeFacade(l: Logger) {
  return {
    debug: (event: string, fields?: Record<string, unknown>) =>
      l.debug({ event, ...fields }, event),
    info: (event: string, fields?: Record<string, unknown>) => l.info({ event, ...fields }, event),
    warn: (event: string, fields?: Record<string, unknown>) => l.warn({ event, ...fields }, event),
    error: (event: string, err?: unknown, fields?: Record<string, unknown>) =>
      l.error(
        {
          event,
          err:
            err instanceof Error ? { message: err.message, stack: err.stack, name: err.name } : err,
          ...fields,
        },
        event,
      ),
    child: (bindings: Record<string, unknown>) => makeFacade(l.child(bindings)),
  };
}

export const logger = makeFacade(baseLogger);
export type NodeLogger = typeof logger;
