import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

const componentPath = resolve(__dirname, "SourceLink.tsx");

describe("SourceLink", () => {
  it.skipIf(!existsSync(componentPath))(
    "renders the domain wrapped in a font-mono span",
    async () => {
      const { SourceLink } = await import("./SourceLink");
      const html = renderToStaticMarkup(
        <SourceLink href="https://alertas.cemaden.gov.br" name="CEMADEN" />,
      );
      expect(html).toContain("CEMADEN");
      expect(html).toMatch(
        /<span[^>]*class="[^"]*font-mono[^"]*"[^>]*>[^<]*alertas\.cemaden\.gov\.br/,
      );
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toContain('target="_blank"');
    },
  );
});
