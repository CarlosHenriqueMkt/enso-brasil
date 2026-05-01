---
phase: 02-data-foundation
plan: 04
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/lib/log/node.ts
  - src/lib/log/edge.ts
  - src/lib/log/node.test.ts
  - src/lib/log/edge.test.ts
  - eslint.config.mjs
autonomous: true
requirements:
  - REQ-S2.07
  - REQ-S2.10
  - DATA-06

must_haves:
  truths:
    - "src/lib/log/node.ts exports pino logger with redaction config covering INGEST_TOKEN, DATABASE_URL, UPSTASH_REDIS_REST_TOKEN, *.token, *.secret, *.password (D-03 amended)"
    - "src/lib/log/edge.ts exports JSON helper with hand-rolled redaction for the same field-paths; ZERO pino import"
    - "Both modules expose identical surface: logger.info(event, fields), logger.error(event, err, fields)"
    - "ESLint no-restricted-imports rule blocks pino import from any file under src/app/api/{states,health}/** (edge routes)"
    - "There is NO src/lib/log/index.ts — prevents accidental edge import of pino"
    - "Plan B fallback documented inline (D-03)"
  artifacts:
    - path: "src/lib/log/node.ts"
      provides: "pino instance: level from LOG_LEVEL or 'info' prod / 'debug' dev; redact paths; pino-pretty in dev only; surface info/warn/error/debug each accepting (event: string, fields?: Record<string, unknown>)"
      contains: "pino"
    - path: "src/lib/log/edge.ts"
      provides: "logEdge(level, event, fields): writes JSON.stringify({ts, level, event, ...redact(fields)}) to console; redact() walks fields and replaces values whose key matches token|secret|password|*_url with '[REDACTED]'"
      contains: "JSON.stringify"
    - path: "src/lib/log/node.test.ts"
      provides: "Vitest unit asserts redact paths actually mask values; level coercion from LOG_LEVEL works"
    - path: "src/lib/log/edge.test.ts"
      provides: "Vitest unit asserts edge logger emits JSON with ts/level/event keys; redacts tokens; never imports pino"
    - path: "eslint.config.mjs"
      provides: "no-restricted-imports rule blocking 'pino' from src/app/api/states/**, src/app/api/health/**, src/db/edge.ts"
      contains: "no-restricted-imports"
  key_links:
    - from: "src/lib/log/node.ts"
      to: "pino with redaction"
      via: "pino({ redact: { paths, censor } })"
      pattern: "redact.*paths"
    - from: "src/lib/log/edge.ts"
      to: "console.log JSON helper"
      via: "console.log(JSON.stringify(...))"
      pattern: "console\\.log\\(JSON\\.stringify"
---

<objective>
Implement the dual-runtime logging split (D-03 amended): pino for Node routes, hand-rolled JSON helper for Edge routes. Both expose identical surface so callers don't branch on runtime.

Purpose: Structured logging is mandatory for public-safety incident triage. pino works everywhere it CAN work (Node), and a 30-LOC JSON helper covers edge where pino can't run. The two-file split + ESLint guard prevents the deploy-time failure of edge routes accidentally importing pino.
Output: 2 logger modules + 2 vitest specs + ESLint guard rule.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-data-foundation/02-CONTEXT.md
@.planning/phases/02-data-foundation/02-RESEARCH.md

<interfaces>
D-03 amended:
  Node: pino with redaction (info default, debug via LOG_LEVEL); pino-pretty in dev only; redact paths INGEST_TOKEN, DATABASE_URL, UPSTASH_REDIS_REST_TOKEN, *.token, *.secret, *.password
  Edge: console.log(JSON.stringify({ ts, level, event, ...redact(fields) })); ~30 LOC; same field-path list redacted
  Common surface: logger.info(event, fields), logger.warn, logger.error(event, err, fields), logger.debug
  NO src/lib/log/index.ts (prevents accidental edge import of pino)
  next.config.ts already has serverExternalPackages opt-out (plan 02-01) — required for pino under Turbopack

Plan B fallback (D-03 trigger conditions): if pino+Turbopack flakes, drop pino and promote edge.ts to the only logger. ~30 min refactor.

ESLint no-restricted-imports: block 'pino', 'pino-pretty' in:

- src/app/api/states/\*\* (edge route)
- src/app/api/health/\*\* (edge route)
- src/db/edge.ts
  </interfaces>
  </context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: pino node logger + edge JSON helper + ESLint guard + tests</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-CONTEXT.md (D-03 full text + Plan B)
    - .planning/phases/02-data-foundation/02-RESEARCH.md (Q3, §Edge-Runtime Caveats)
    - eslint.config.mjs OR .eslintrc.* (whatever P1 uses; check both)
  </read_first>
  <behavior>
    - logger.info("ingest.start", { runId: "abc" }) → emits JSON with `event:"ingest.start"`, `runId:"abc"`, `level:"info"`, `ts: <number>`
    - logger.info("test", { token: "supersecret", inner: { password: "xyz" } }) → emitted JSON has token === "[REDACTED]" and inner.password === "[REDACTED]"
    - Edge helper emits to console.log a single JSON line; never imports pino
    - ESLint: linting a fixture file in src/app/api/states/ that imports 'pino' fails with rule no-restricted-imports
  </behavior>
  <files>src/lib/log/node.ts, src/lib/log/edge.ts, src/lib/log/node.test.ts, src/lib/log/edge.test.ts, eslint.config.mjs</files>
  <action>
    1. Write `src/lib/log/node.ts` (Node-only — pino with redaction; pino-pretty in dev):
       ```ts
       import pino, { type Logger } from "pino";

       const isDev = process.env.NODE_ENV !== "production";
       const level = process.env.LOG_LEVEL ?? (isDev ? "debug" : "info");

       const baseOptions: pino.LoggerOptions = {
         level,
         redact: {
           paths: [
             "INGEST_TOKEN",
             "DATABASE_URL",
             "UPSTASH_REDIS_REST_TOKEN",
             "UPSTASH_REDIS_REST_URL",
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
         ? pino({ ...baseOptions, transport: { target: "pino-pretty", options: { singleLine: true, colorize: true } } })
         : pino(baseOptions);

       function makeFacade(l: Logger) {
         return {
           debug: (event: string, fields?: Record<string, unknown>) => l.debug({ event, ...fields }, event),
           info: (event: string, fields?: Record<string, unknown>) => l.info({ event, ...fields }, event),
           warn: (event: string, fields?: Record<string, unknown>) => l.warn({ event, ...fields }, event),
           error: (event: string, err?: unknown, fields?: Record<string, unknown>) =>
             l.error({ event, err: err instanceof Error ? { message: err.message, stack: err.stack, name: err.name } : err, ...fields }, event),
           child: (bindings: Record<string, unknown>) => makeFacade(l.child(bindings)),
         };
       }

       export const logger = makeFacade(baseLogger);
       export type NodeLogger = typeof logger;
       ```

    2. Write `src/lib/log/edge.ts` (Edge-safe — no pino):
       ```ts
       const REDACT_KEYS = /^(token|secret|password|databaseUrl)$/i;
       const REDACT_PATH_KEYS = new Set(["INGEST_TOKEN", "DATABASE_URL", "UPSTASH_REDIS_REST_TOKEN", "UPSTASH_REDIS_REST_URL", "authorization"]);

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
         // eslint-disable-next-line no-console
         console.log(line);
       }

       export const logger = {
         debug: (event: string, fields?: Record<string, unknown>) => emit("debug", event, fields),
         info: (event: string, fields?: Record<string, unknown>) => emit("info", event, fields),
         warn: (event: string, fields?: Record<string, unknown>) => emit("warn", event, fields),
         error: (event: string, err?: unknown, fields?: Record<string, unknown>) => {
           const errFields = err instanceof Error ? { err: { message: err.message, name: err.name, stack: err.stack } } : { err };
           emit("error", event, { ...errFields, ...fields });
         },
       };
       export type EdgeLogger = typeof logger;
       export { redact as __redact };
       ```

    3. Update `eslint.config.mjs` (or P1 equivalent). Locate the flat-config exports array; add:
       ```js
       {
         files: ["src/app/api/states/**/*.{ts,tsx}", "src/app/api/health/**/*.{ts,tsx}", "src/db/edge.ts"],
         rules: {
           "no-restricted-imports": ["error", {
             paths: [
               { name: "pino", message: "pino is Node-only — use src/lib/log/edge.ts in edge routes (D-03)." },
               { name: "pino-pretty", message: "pino-pretty is Node-only — use src/lib/log/edge.ts in edge routes (D-03)." },
               { name: "../../../lib/log/node", message: "Edge routes must import from src/lib/log/edge.ts." },
               { name: "@/lib/log/node", message: "Edge routes must import from src/lib/log/edge.ts." },
             ],
           }],
         },
       }
       ```
       If P1 used `.eslintrc.json` instead, port equivalent override there. Run `pnpm lint` to confirm config parses.

    4. Write `src/lib/log/node.test.ts`:
       ```ts
       import { describe, it, expect, vi } from "vitest";

       describe("node logger", () => {
         it("emits JSON containing event + fields", async () => {
           const writes: string[] = [];
           const origWrite = process.stdout.write.bind(process.stdout);
           // @ts-expect-error monkey-patch
           process.stdout.write = (chunk: string) => { writes.push(typeof chunk === "string" ? chunk : chunk.toString()); return true; };
           try {
             const { logger } = await import("./node");
             logger.info("test.event", { runId: "abc-123" });
           } finally {
             // @ts-expect-error restore
             process.stdout.write = origWrite;
           }
           const line = writes.find((l) => l.includes("test.event"));
           expect(line).toBeDefined();
           expect(line!).toMatch(/test\.event/);
           expect(line!).toMatch(/abc-123/);
         });

         it("redacts token/secret/password fields", async () => {
           const writes: string[] = [];
           const origWrite = process.stdout.write.bind(process.stdout);
           // @ts-expect-error monkey-patch
           process.stdout.write = (chunk: string) => { writes.push(typeof chunk === "string" ? chunk : chunk.toString()); return true; };
           try {
             vi.resetModules();
             process.env.NODE_ENV = "production"; // disable pino-pretty for predictable JSON
             const { logger } = await import("./node");
             logger.info("redact.test", { token: "abc", nested: { password: "xyz", ok: 1 } });
           } finally {
             // @ts-expect-error restore
             process.stdout.write = origWrite;
           }
           const line = writes.find((l) => l.includes("redact.test"));
           expect(line).toBeDefined();
           expect(line!).toContain("[REDACTED]");
           expect(line!).not.toContain("\"abc\"");
           expect(line!).not.toContain("\"xyz\"");
         });
       });
       ```

    5. Write `src/lib/log/edge.test.ts`:
       ```ts
       import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
       import { logger, __redact } from "./edge";

       describe("edge logger", () => {
         let logSpy: ReturnType<typeof vi.spyOn>;
         beforeEach(() => { logSpy = vi.spyOn(console, "log").mockImplementation(() => {}); });
         afterEach(() => { logSpy.mockRestore(); });

         it("emits a single JSON line containing ts/level/event", () => {
           logger.info("test.start", { runId: "r1" });
           expect(logSpy).toHaveBeenCalledOnce();
           const line = logSpy.mock.calls[0][0] as string;
           const parsed = JSON.parse(line);
           expect(parsed.event).toBe("test.start");
           expect(parsed.level).toBe("info");
           expect(parsed.runId).toBe("r1");
           expect(typeof parsed.ts).toBe("string");
         });

         it("redacts token/secret/password keys (case-insensitive)", () => {
           const out = __redact({ token: "abc", inner: { Password: "xyz" }, ok: 1 }) as Record<string, unknown>;
           expect(out.token).toBe("[REDACTED]");
           expect((out.inner as Record<string, unknown>).Password).toBe("[REDACTED]");
           expect(out.ok).toBe(1);
         });

         it("redacts INGEST_TOKEN / DATABASE_URL / UPSTASH_* path keys", () => {
           const out = __redact({ INGEST_TOKEN: "x", DATABASE_URL: "y", UPSTASH_REDIS_REST_TOKEN: "z", safe: "ok" }) as Record<string, unknown>;
           expect(out.INGEST_TOKEN).toBe("[REDACTED]");
           expect(out.DATABASE_URL).toBe("[REDACTED]");
           expect(out.UPSTASH_REDIS_REST_TOKEN).toBe("[REDACTED]");
           expect(out.safe).toBe("ok");
         });
       });

       it("edge.ts does not import pino", async () => {
         const { readFileSync } = await import("node:fs");
         const src = readFileSync(new URL("./edge.ts", import.meta.url), "utf8");
         expect(src).not.toMatch(/from\s+["']pino["']/);
       });
       ```

    6. Run `pnpm test src/lib/log` and `pnpm lint`. Expect zero failures.

    7. Confirm there is NO `src/lib/log/index.ts` file (would risk accidental edge import of pino):
       ```
       test ! -f src/lib/log/index.ts
       ```

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && pnpm test src/lib/log && pnpm lint && test ! -f src/lib/log/index.ts && grep -c "no-restricted-imports" eslint.config.mjs && grep -c "console.log(JSON.stringify" src/lib/log/edge.ts && grep -c "from \"pino\"" src/lib/log/edge.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test src/lib/log` exits 0 with all log tests passing
    - `pnpm lint` exits 0
    - File `src/lib/log/index.ts` does NOT exist
    - `grep -c "no-restricted-imports" eslint.config.mjs` returns >= 1
    - `grep -c "from \"pino\"" src/lib/log/edge.ts` returns 0 (zero pino imports in edge)
    - `grep -c "from \"pino\"" src/lib/log/node.ts` returns 1
    - `grep -c "console.log" src/lib/log/edge.ts` returns >= 1
    - `grep -cE "INGEST_TOKEN|DATABASE_URL|UPSTASH_REDIS_REST_TOKEN" src/lib/log/node.ts` returns >= 3
    - `grep -cE "INGEST_TOKEN|DATABASE_URL|UPSTASH_REDIS_REST_TOKEN" src/lib/log/edge.ts` returns >= 3
  </acceptance_criteria>
  <done>Both loggers expose identical surface; pino is Node-only and redacted; edge helper is dependency-free; ESLint blocks accidental pino imports in edge files.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                             | Description                                               |
| ------------------------------------ | --------------------------------------------------------- |
| App code → stdout (Vercel ingestion) | Untrusted strings (request bodies, errors) flow into logs |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                                         | Disposition | Mitigation Plan                                                                                                         |
| --------- | ---------------------- | --------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| T-02-10   | Information Disclosure | INGEST_TOKEN/DATABASE_URL leaked into logs                                        | mitigate    | pino redact paths + edge hand-rolled redact (D-03); 2 unit tests assert masking                                         |
| T-02-11   | Information Disclosure | Edge route accidentally imports pino at deploy time → silent bundle bloat or fail | mitigate    | ESLint no-restricted-imports + no src/lib/log/index.ts barrel + integration test in plan 02-07                          |
| T-02-12   | Tampering              | Log injection via newline in user-supplied event name                             | accept      | All `event` strings are static literals chosen by code (never user input); JSON.stringify escapes any embedded newlines |

</threat_model>

<verification>
log tests pass; ESLint guard parses; edge.ts contains zero pino imports; both loggers redact 3 sensitive env-var-shaped keys.
</verification>

<success_criteria>
Structured logging available everywhere; deploy-time pino-in-edge regression blocked by ESLint; D-03 Plan B remains a 30-min refactor (just delete node.ts, rename edge.ts).
</success_criteria>

<output>
After completion, create `.planning/phases/02-data-foundation/02-04-SUMMARY.md`
</output>
