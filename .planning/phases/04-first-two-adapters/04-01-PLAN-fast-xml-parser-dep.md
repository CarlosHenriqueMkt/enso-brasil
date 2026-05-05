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
autonomous: true
requirements: [ADAPT-02]
must_haves:
  truths:
    - "fast-xml-parser is installed at a pinned 5.x version (no caret/tilde)"
    - "A shared parser-config module exposes the configured XMLParser used by INMET adapter"
    - "Round-trip parse of a minimal CAP fixture preserves attributes and forces <info> arrays"
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
  key_links:
    - from: "src/lib/sources/xml.ts"
      to: "fast-xml-parser"
      via: "named import { XMLParser }"
      pattern: "from \\\"fast-xml-parser\\\""
---

<objective>
Add `fast-xml-parser` at a pinned 5.x version and ship a shared CAP parser config module that the INMET adapter (plan 04-03) will consume. Wave 0, sequential — must land before any plan that imports it.

Purpose: Give every downstream plan an identical parser configuration (attributes preserved, tag values un-coerced, `<info>` always an array) so CAP-XML behavior is deterministic across adapters, contract tests, and refresh scripts.

Output: Lockfile updated, shared `xml.ts` module with `createCapXmlParser()` and `parseCapXml(text)`, smoke test green.
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

Required parser options (from RESEARCH.md INMET section + CONTEXT.md):

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
       - Add to `dependencies`: `"fast-xml-parser": "5.3.0"` (alphabetical — between `drizzle-orm` and `next`).
       - Add to `devDependencies`: `"tsx": "4.19.2"` (alphabetical — between `typescript` and `vitest`).
    2. Run `pnpm install` (writes lockfile).
    3. Verify `pnpm install --frozen-lockfile` is clean (no diff).
    4. Do NOT add `^` or `~` — research flagged CEMADEN/INMET schema-drift risk; bumping the parser is a manual decision.
  </action>
  <verify>
    <automated>pnpm install --frozen-lockfile && node -e "const {XMLParser}=require('fast-xml-parser'); console.log(typeof XMLParser)" | grep -q function</automated>
  </verify>
  <done>fast-xml-parser pinned to 5.3.0 exact, tsx pinned, lockfile committed, frozen install clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Shared CAP parser module + smoke test</name>
  <files>src/lib/sources/xml.ts, src/lib/sources/xml.test.ts</files>
  <behavior>
    - `createCapXmlParser()` returns an `XMLParser` configured with the locked options (see &lt;interfaces&gt;).
    - `parseCapXml(xml: string): unknown` parses + returns the result; throws an `Error` with `code: "xml_malformed"` (attached via `cause` or own property) when input is not well-formed.
    - Test 1: parses `<alert><info xml:lang="pt-BR"><severity>Severe</severity></info></alert>` and asserts `result.alert.info` is an array of length 1 (not an object).
    - Test 2: parses two `<info>` blocks and asserts length 2, both retain `@_xml:lang` attribute.
    - Test 3: malformed XML (`<alert><info></alert>`) throws with `code === "xml_malformed"`.
    - Test 4: numeric-looking strings are preserved as strings (e.g., `<area>123</area>` → `"123"`, not `123`).
  </behavior>
  <action>
    Create `src/lib/sources/xml.ts`:
    ```ts
    import { XMLParser } from "fast-xml-parser";

    export type SourceErrorCode =
      | "http_5xx"
      | "timeout"
      | "schema_invalid"
      | "payload_drift"
      | "xml_malformed"
      | "missing_pt_br";

    export class SourceError extends Error {
      readonly code: SourceErrorCode;
      constructor(code: SourceErrorCode, message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.code = code;
        this.name = "SourceError";
      }
    }

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
        throw new SourceError("xml_malformed", "CAP XML failed to parse", { cause: err });
      }
    }
    ```
    Create `src/lib/sources/xml.test.ts` with the 4 cases above. Use `expect.toThrowError` with a property check on `code`.

    Note: `SourceError` is co-located here for Wave 0 ergonomics; plans 04-02/03 import it. If a separate errors module is later preferred, refactor in 04-06.

  </action>
  <verify>
    <automated>pnpm test -- src/lib/sources/xml.test.ts</automated>
  </verify>
  <done>xml.ts exports createCapXmlParser, parseCapXml, SourceError, SourceErrorCode; xml.test.ts has 4 passing cases including the &lt;info&gt; array invariant.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                                    | Description                                                            |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| upstream CAP feed → INMET adapter (consumer of this module) | XML payload is untrusted; parser must not enable XXE or DTD resolution |

## STRIDE Threat Register (ASVS L2)

| Threat ID  | Category               | Component                                                                      | Disposition | Mitigation Plan                                                                                                                                                                                |
| ---------- | ---------------------- | ------------------------------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-04-01-01 | Tampering              | fast-xml-parser version drift                                                  | mitigate    | Exact-pin `5.3.0` (no `^`/`~`); Renovate PR-only; manual review on bump                                                                                                                        |
| T-04-01-02 | Information Disclosure | XXE / external entity expansion                                                | mitigate    | fast-xml-parser does NOT resolve external entities by default; add code comment in xml.ts asserting this and a regression test that `<!ENTITY xxe SYSTEM "file:///etc/passwd">` does not exfil |
| T-04-01-03 | Denial of Service      | Billion-laughs / deeply nested XML                                             | accept      | fast-xml-parser has internal nesting limits; payload size bounded by ofetch wrapper response cap (P2). Re-evaluate in P6 hardening                                                             |
| T-04-01-04 | Tampering              | Numeric coercion in severity strings (e.g., severity="3" silently parsed to 3) | mitigate    | `parseTagValue: false`, `parseAttributeValue: false` locked; smoke test asserts `"123"` stays string                                                                                           |

</threat_model>

<verification>
- `pnpm install --frozen-lockfile` clean
- `pnpm test -- src/lib/sources/xml.test.ts` passes (4 cases)
- `pnpm lint` clean
- `grep -E "\"fast-xml-parser\":\\s*\"\\^|~" package.json` returns nothing (no caret/tilde)
- `grep -c "isArray" src/lib/sources/xml.ts` ≥ 1
</verification>

<success_criteria>
fast-xml-parser pinned 5.3.0 exact, tsx pinned, shared parser module exports `createCapXmlParser`, `parseCapXml`, `SourceError`, `SourceErrorCode`. Smoke test covers attribute preservation, `<info>` array invariant, malformed-XML rejection, and numeric-string preservation. Wave 1 plans 04-02 and 04-03 can `import { SourceError } from "./xml"` without circular deps.

## Dimension 8 Validation Requirements

Every adapter test that exercises `parseCapXml` must assert: (a) `<info>` is always an array even with one block; (b) numeric-looking tag values remain strings; (c) malformed XML rejects with `code: "xml_malformed"`. These three invariants are this module's public contract — break them and 04-03/04-05 break.
</success_criteria>

<output>
After completion, create `.planning/phases/04-first-two-adapters/04-01-SUMMARY.md` documenting pinned version, parser config rationale, and any deviations.
</output>
