---
phase: 04-first-two-adapters
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - package.json
  - pnpm-lock.yaml
  - src/lib/sources/xml.ts
  - src/lib/sources/xml.test.ts
  - src/lib/sources/errors.ts
  - src/lib/sources/errors.test.ts
  - vitest.config.ts
autonomous: true
requirements: [ADAPT-02]
must_haves:
  truths:
    - "fast-xml-parser is installed at a pinned 5.x version (no caret/tilde)"
    - "A shared parser-config module exposes the configured XMLParser used by INMET adapter"
    - "Round-trip parse of a minimal CAP fixture preserves attributes and forces <info> arrays"
    - "sourceError() factory produces tagged Errors with code property (no Error subclass — per CONTEXT D-XX taxonomy)"
    - "vitest.config.ts include glob covers scripts/**/*.test.ts AND tests/**/*.test.ts before Wave 1 lands"
  artifacts:
    - path: "package.json"
      provides: "Pinned fast-xml-parser dep + tsx devDep for refresh scripts"
      contains: "fast-xml-parser"
    - path: "src/lib/sources/xml.ts"
      provides: "Shared XMLParser factory for CAP feeds"
      exports: ["createCapXmlParser", "parseCapXml"]
    - path: "src/lib/sources/xml.test.ts"
      provides: "Smoke test asserting attributeNamePrefix, parseTagValue, isArray for <info>"
      min_lines: 30
    - path: "src/lib/sources/errors.ts"
      provides: "sourceError() factory + SourceErrorCode union (NO Error subclass per CONTEXT taxonomy)"
      exports: ["sourceError", "isSourceError", "SourceErrorCode"]
    - path: "src/lib/sources/errors.test.ts"
      provides: "Unit tests on factory: code attached, cause preserved, instanceof Error true"
      min_lines: 40
    - path: "vitest.config.ts"
      provides: "Test include glob extended to scripts/**/*.test.ts and tests/**/*.test.ts (Wave 0 pre-extension)"
      contains: "scripts"
  key_links:
    - from: "src/lib/sources/xml.ts"
      to: "fast-xml-parser"
      via: "named import { XMLParser }"
      pattern: "from \\\"fast-xml-parser\\\""
    - from: "src/lib/sources/xml.ts"
      to: "src/lib/sources/errors.ts"
      via: "import { sourceError } from './errors'"
      pattern: "from \\\"\\./errors\\\""
---

<objective>
Add `fast-xml-parser` at a pinned 5.x version, ship the shared CAP parser config module, the canonical `sourceError()` factory + `SourceErrorCode` union (CONTEXT-locked taxonomy), and pre-extend `vitest.config.ts` to cover scripts and contract globs. Wave 0, sequential — must land before any plan that imports it.

Purpose:

- Give every downstream plan an identical parser configuration (attributes preserved, tag values un-coerced, `<info>` always an array).
- Land the canonical error factory ONCE so plans 04-03/04-05 import a stable contract (resolves W-1: no Error subclass).
- Pre-extend the vitest include glob so Wave 1 plans don't race on `vitest.config.ts` (resolves W-4).

Output: Lockfile updated, shared `xml.ts` + `errors.ts` modules, vitest glob extended, smoke + factory tests green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-first-two-adapters/04-SPEC.md
@.planning/phases/04-first-two-adapters/04-CONTEXT.md
@.planning/phases/04-first-two-adapters/04-RESEARCH.md

<interfaces>
<!-- Pinned target from RESEARCH.md (fast-xml-parser 5.3.0, 2025-10-03 stable). -->
<!-- Parser config locked by CONTEXT.md and critical_constraints #8. -->
<!-- Error taxonomy locked by CONTEXT.md "Error taxonomy" section: cause + code, NO subclasses. -->

Required parser options:

```ts
{
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,         // severity terms are strings, not numbers
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name: string, jpath: string) =>
    jpath === "alert.info",     // CAP allows multiple <info> blocks (one per language)
}
```

Error factory contract (CONTEXT-locked taxonomy — no `class extends Error`):

```ts
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

export function sourceError(
  code: SourceErrorCode,
  message: string,
  cause?: unknown,
): SourceErrorLike;

export function isSourceError(e: unknown): e is SourceErrorLike;
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pin fast-xml-parser + tsx devDep, lockfile sync</name>
  <files>package.json, pnpm-lock.yaml</files>
  <behavior>
    - `package.json` `dependencies["fast-xml-parser"]` is the exact string `"5.3.0"` (no `^`, no `~`).
    - `package.json` `devDependencies["tsx"]` exists at a pinned recent version (>=4.19.0, exact pin) — needed by plan 04-04 refresh scripts.
    - `pnpm install --frozen-lockfile` succeeds after the change.
    - `node -e "console.log(require('fast-xml-parser').XMLParser)"` prints `[Function: XMLParser]`.
  </behavior>
  <action>
    1. Edit `package.json`:
       - Add to `dependencies`: `"fast-xml-parser": "5.3.0"` (alphabetical).
       - Add to `devDependencies`: `"tsx": "4.19.2"` (alphabetical).
    2. Run `pnpm install` (writes lockfile).
    3. Verify `pnpm install --frozen-lockfile` is clean (no diff).
    4. Do NOT add `^` or `~`.
  </action>
  <verify>
    <automated>pnpm install --frozen-lockfile && node -e "const {XMLParser}=require('fast-xml-parser'); if(typeof XMLParser!=='function')process.exit(1)"</automated>
  </verify>
  <done>fast-xml-parser pinned to 5.3.0 exact, tsx pinned, lockfile committed, frozen install clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: sourceError() factory + SourceErrorCode union (errors.ts)</name>
  <files>src/lib/sources/errors.ts, src/lib/sources/errors.test.ts</files>
  <behavior>
    - Per CONTEXT "Error taxonomy" decision: NO `class extends Error`. Use a factory that returns a tagged Error.
    - `sourceError(code, message, cause?)` returns a real `Error` with `code` attached as own property and `cause` set via `Error` constructor options.
    - `isSourceError(e)` narrows to `SourceErrorLike` by checking `e instanceof Error && typeof (e as any).code === "string"` AND that the code is in the locked union.
    - Tests: factory attaches `code`; `cause` is preserved on the returned Error; `instanceof Error` is true; `e.name === "Error"` (NOT a custom name — V8-friendly per CONTEXT); narrowing helper rejects plain Errors with no code; narrowing helper rejects errors with a code outside the union.
  </behavior>
  <action>
    Create `src/lib/sources/errors.ts`:
    ```ts
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

    const CODES: ReadonlySet<SourceErrorCode> = new Set([
      "http_5xx",
      "timeout",
      "schema_invalid",
      "payload_drift",
      "xml_malformed",
      "missing_pt_br",
    ]);

    /**
     * Factory for source-adapter errors. Returns a tagged Error per CONTEXT
     * taxonomy (cause + code, NO Error subclass — V8 prototype-chain pegadinhas).
     */
    export function sourceError(
      code: SourceErrorCode,
      message: string,
      cause?: unknown,
    ): SourceErrorLike {
      const err = new Error(message, cause === undefined ? undefined : { cause });
      return Object.assign(err, { code });
    }

    export function isSourceError(e: unknown): e is SourceErrorLike {
      return (
        e instanceof Error &&
        typeof (e as { code?: unknown }).code === "string" &&
        CODES.has((e as { code: SourceErrorCode }).code)
      );
    }
    ```
    Create `src/lib/sources/errors.test.ts` with 5 cases (factory attaches code, cause preserved, instanceof Error, isSourceError accepts/rejects).

  </action>
  <verify>
    <automated>pnpm test -- src/lib/sources/errors.test.ts</automated>
  </verify>
  <done>errors.ts exports sourceError, isSourceError, SourceErrorCode; errors.test.ts has 5 passing cases; no `class extends Error` anywhere in the file.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Shared CAP parser module + smoke test</name>
  <files>src/lib/sources/xml.ts, src/lib/sources/xml.test.ts</files>
  <behavior>
    - `createCapXmlParser()` returns an `XMLParser` configured with the locked options.
    - `parseCapXml(xml: string): unknown` parses + returns the result; throws via `sourceError("xml_malformed", ...)` when input is not well-formed.
    - Test 1: parses `<alert><info xml:lang="pt-BR"><severity>Severe</severity></info></alert>` and asserts `result.alert.info` is an array of length 1.
    - Test 2: parses two `<info>` blocks and asserts length 2, both retain `@_xml:lang` attribute.
    - Test 3: malformed XML throws — `isSourceError(err) && err.code === "xml_malformed"`.
    - Test 4: numeric-looking strings preserved as strings.
  </behavior>
  <action>
    Create `src/lib/sources/xml.ts`:
    ```ts
    import { XMLParser } from "fast-xml-parser";
    import { sourceError } from "./errors";

    export function createCapXmlParser(): XMLParser {
      return new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        parseTagValue: false,
        parseAttributeValue: false,
        trimValues: true,
        isArray: (_name, jpath) => jpath === "alert.info",
      });
    }

    export function parseCapXml(xml: string): unknown {
      const parser = createCapXmlParser();
      try {
        return parser.parse(xml, true); // validate=true → throws on malformed
      } catch (err) {
        throw sourceError("xml_malformed", "CAP XML failed to parse", err);
      }
    }
    ```
    Create `src/lib/sources/xml.test.ts` with the 4 cases. Use `isSourceError` from `./errors` for the malformed-XML assertion.

  </action>
  <verify>
    <automated>pnpm test -- src/lib/sources/xml.test.ts</automated>
  </verify>
  <done>xml.ts exports createCapXmlParser + parseCapXml; xml.test.ts has 4 passing cases including the &lt;info&gt; array invariant; xml.ts imports sourceError from ./errors (no class subclass).</done>
</task>

<task type="auto">
  <name>Task 4: Pre-extend vitest.config.ts include glob (resolves W-4)</name>
  <files>vitest.config.ts</files>
  <behavior>
    - `vitest.config.ts` `test.include` covers ALL of: `src/**/*.test.ts` (existing), `tests/**/*.test.ts`, `scripts/**/*.test.ts`.
    - Pre-extending here guarantees plans 04-04 (scripts tests) and 04-05 (contract tests) do NOT need to touch `vitest.config.ts` — eliminates the dual-edit race flagged by plan-checker W-4.
    - No other config change. globalSetup, setupFiles, etc. unchanged.
  </behavior>
  <action>
    1. Read current `vitest.config.ts`. If `test.include` is the implicit default, set it explicitly:
       ```ts
       test: {
         include: [
           "src/**/*.test.ts",
           "tests/**/*.test.ts",
           "scripts/**/*.test.ts",
         ],
         // ...rest unchanged
       }
       ```
    2. Run `pnpm test` — must remain green (no new test files yet at scripts/ or tests/contract/, but glob is permissive — empty match is fine).
    3. Document in commit message: "Pre-extend vitest include for Wave 1 plans 04-04/04-05; resolves W-4."
  </action>
  <verify>
    <automated>node -e "const c=require('fs').readFileSync('vitest.config.ts','utf8'); if(!c.includes('scripts')||!c.includes('tests')){console.error('include glob missing scripts or tests');process.exit(1)}" && pnpm test</automated>
  </verify>
  <done>vitest.config.ts include explicitly lists src/tests/scripts globs; full test suite still green.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                                    | Description                                                            |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| upstream CAP feed → INMET adapter (consumer of this module) | XML payload is untrusted; parser must not enable XXE or DTD resolution |

## STRIDE Threat Register (ASVS L2)

| Threat ID  | Category               | Component                                                                      | Disposition | Mitigation Plan                                                                                                                                                                     |
| ---------- | ---------------------- | ------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-04-01-01 | Tampering              | fast-xml-parser version drift                                                  | mitigate    | Exact-pin `5.3.0` (no `^`/`~`); Renovate PR-only; manual review on bump                                                                                                             |
| T-04-01-02 | Information Disclosure | XXE / external entity expansion                                                | mitigate    | fast-xml-parser does NOT resolve external entities by default; xml.ts code comment asserts this; regression test ensures `<!ENTITY xxe SYSTEM "file:///etc/passwd">` does not exfil |
| T-04-01-03 | Denial of Service      | Billion-laughs / deeply nested XML                                             | accept      | fast-xml-parser has internal nesting limits; payload size bounded by ofetch wrapper response cap (P2). Re-evaluate in P6 hardening                                                  |
| T-04-01-04 | Tampering              | Numeric coercion in severity strings (e.g., severity="3" silently parsed to 3) | mitigate    | `parseTagValue: false`, `parseAttributeValue: false` locked; smoke test asserts `"123"` stays string                                                                                |
| T-04-01-05 | Tampering              | Error-shape divergence between modules (subclass vs factory drift)             | mitigate    | Single canonical `sourceError()` factory in errors.ts; ESLint rule (or grep gate) ensures no `class .* extends Error` lands in `src/lib/sources/`                                   |

</threat_model>

<verification>
- `pnpm install --frozen-lockfile` clean
- `pnpm test -- src/lib/sources/errors.test.ts src/lib/sources/xml.test.ts` passes (≥9 cases combined)
- `pnpm test` full suite green (proves vitest config glob extension didn't break P3 tests)
- `pnpm lint` clean
- `grep -E "\"fast-xml-parser\":\\s*\"\\^|~" package.json` returns nothing (no caret/tilde)
- `grep -c "isArray" src/lib/sources/xml.ts` ≥ 1
- `grep -E "class\\s+\\w+\\s+extends\\s+Error" src/lib/sources/` returns nothing (Nyquist invariant — no Error subclass per CONTEXT)
- `grep -c "sourceError" src/lib/sources/xml.ts` ≥ 1 (factory wired into parser)
- `grep -E "scripts|tests" vitest.config.ts | grep -v '^#'` shows the glob extension
</verification>

<success_criteria>
fast-xml-parser pinned 5.3.0 exact, tsx pinned, shared parser module exports `createCapXmlParser` + `parseCapXml`, errors.ts ships the canonical `sourceError()` factory + `SourceErrorCode` union (no Error subclass), and `vitest.config.ts` is pre-extended for Wave 1 plans. Wave 1 plans 04-03/04-04/04-05 import `sourceError` and `isSourceError` from `./errors` without ANY remaining `class SourceError extends Error` reference in the codebase.

## Dimension 8 Validation Requirements

Four load-bearing invariants under explicit tests/grep gates:

1. `<info>` is always an array even with one block
2. Numeric-looking tag values remain strings
3. Malformed XML rejects with `code: "xml_malformed"` via the factory (no subclass)
4. NO `class extends Error` exists in `src/lib/sources/` (grep gate, CONTEXT taxonomy invariant)
   </success_criteria>

<output>
After completion, create `.planning/phases/04-first-two-adapters/04-01-SUMMARY.md` documenting pinned version, parser config rationale, factory-vs-subclass decision (W-1 resolution), and vitest glob pre-extension (W-4 resolution).
</output>
