import { describe, it, expect } from "vitest";
import { createCapXmlParser, parseCapXml } from "./xml";
import { isSourceError } from "./errors";

describe("createCapXmlParser / parseCapXml", () => {
  it("forces alert.info to be an array even with a single <info> block", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<alert>
  <identifier>abc-1</identifier>
  <info xml:lang="pt-BR">
    <severity>Severe</severity>
    <event>Chuvas Intensas</event>
  </info>
</alert>`;
    const result = parseCapXml(xml) as {
      alert: { info: Array<{ severity: string; "@_xml:lang": string }> };
    };
    expect(Array.isArray(result.alert.info)).toBe(true);
    expect(result.alert.info).toHaveLength(1);
    expect(result.alert.info[0]?.severity).toBe("Severe");
    expect(result.alert.info[0]?.["@_xml:lang"]).toBe("pt-BR");
  });

  it("preserves multiple <info> blocks with their xml:lang attributes", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<alert>
  <info xml:lang="pt-BR"><severity>Severe</severity></info>
  <info xml:lang="en-US"><severity>Severe</severity></info>
</alert>`;
    const result = parseCapXml(xml) as {
      alert: { info: Array<{ "@_xml:lang": string }> };
    };
    expect(result.alert.info).toHaveLength(2);
    expect(result.alert.info[0]?.["@_xml:lang"]).toBe("pt-BR");
    expect(result.alert.info[1]?.["@_xml:lang"]).toBe("en-US");
  });

  it("throws sourceError with code 'xml_malformed' on malformed input", () => {
    const malformed = "<alert><info><severity>Severe</info></alert>";
    let caught: unknown;
    try {
      parseCapXml(malformed);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(isSourceError(caught)).toBe(true);
    if (isSourceError(caught)) {
      expect(caught.code).toBe("xml_malformed");
    }
  });

  it("preserves numeric-looking strings as strings (parseTagValue=false)", () => {
    const xml = `<alert><info xml:lang="pt-BR"><severity>3</severity><event>123</event></info></alert>`;
    const result = parseCapXml(xml) as {
      alert: { info: Array<{ severity: unknown; event: unknown }> };
    };
    expect(typeof result.alert.info[0]?.severity).toBe("string");
    expect(result.alert.info[0]?.severity).toBe("3");
    expect(typeof result.alert.info[0]?.event).toBe("string");
    expect(result.alert.info[0]?.event).toBe("123");
  });

  it("createCapXmlParser returns an XMLParser instance with parse()", () => {
    const parser = createCapXmlParser();
    expect(typeof parser.parse).toBe("function");
  });
});
