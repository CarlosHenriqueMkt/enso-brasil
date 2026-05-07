import { XMLParser } from "fast-xml-parser";
import { sourceError } from "./errors";

/**
 * Shared CAP (Common Alerting Protocol) XML parser.
 *
 * Locked options per Phase 4 CONTEXT and SPEC:
 *  - `ignoreAttributes: false` — CAP <info xml:lang="pt-BR"> selection requires attributes.
 *  - `attributeNamePrefix: "@_"` — fast-xml-parser default; explicit for clarity.
 *  - `parseTagValue: false` — severity terms ("Severe", "Extreme") are strings; never coerce
 *    to numbers (T-04-01-04).
 *  - `parseAttributeValue: false` — same reasoning at the attribute level.
 *  - `trimValues: true` — strip leading/trailing whitespace from text nodes.
 *  - `isArray: jpath === "alert.info"` — CAP allows multiple <info> blocks (one per
 *    language). Force array shape so downstream code can iterate without branching on
 *    "single info" vs "info[]".
 *
 * Security: fast-xml-parser does NOT resolve external entities by default — XXE
 * (T-04-01-02) is mitigated. We do not enable any DTD/entity option.
 */
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

/**
 * Parse a CAP XML string. Throws `sourceError("xml_malformed", ...)` on bad input
 * with the underlying parser error preserved as `cause`.
 */
export function parseCapXml(xml: string): unknown {
  const parser = createCapXmlParser();
  try {
    // Second arg `true` enables fast-xml-parser's well-formedness validation;
    // throws on mismatched tags, unclosed elements, etc.
    return parser.parse(xml, true);
  } catch (err) {
    throw sourceError("xml_malformed", "CAP XML failed to parse", err);
  }
}
