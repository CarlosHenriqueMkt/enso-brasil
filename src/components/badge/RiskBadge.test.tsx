import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { messages } from "@/lib/messages";
import { RISK_LEVELS } from "@/lib/sources/schema";

const componentPath = resolve(__dirname, "RiskBadge.tsx");

describe("RiskBadge", () => {
  it.skipIf(!existsSync(componentPath))(
    "renders all 5 levels with the locked PT-BR severity label + Unicode icon",
    async () => {
      const { RiskBadge } = await import("./RiskBadge");

      for (const level of RISK_LEVELS) {
        const html = renderToStaticMarkup(<RiskBadge level={level} />);
        expect(html).toContain(messages.severity[level]);
        expect(html).toContain(messages.severity_icon[level]);
        // ARIA label must match the locked severity copy verbatim.
        expect(html).toMatch(
          new RegExp(
            `aria-label="${messages.severity[level].replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}"`,
          ),
        );
        // Icon span hidden from screen readers (label is the canonical signal).
        expect(html).toMatch(/<span aria-hidden="true">/);
      }
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "yellow level uses text-risk-yellow-ink class, never text-white or inline #fff",
    async () => {
      const { RiskBadge } = await import("./RiskBadge");
      const html = renderToStaticMarkup(<RiskBadge level="yellow" />);
      expect(html).toContain("text-risk-yellow-ink");
      expect(html).toContain("bg-risk-yellow-bg");
      expect(html).toContain("border-risk-yellow-bd");
      // Hard contrast lock — white-on-yellow is forbidden by sketch-findings 03.
      expect(html).not.toMatch(/text-white/);
      expect(html).not.toMatch(/color:\s*#fff/i);
      expect(html).not.toMatch(/color:\s*white/i);
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "unknown level maps to the gray visual palette",
    async () => {
      const { RiskBadge } = await import("./RiskBadge");
      const html = renderToStaticMarkup(<RiskBadge level="unknown" />);
      expect(html).toContain("bg-risk-gray-bg");
      expect(html).toContain("text-risk-gray-ink");
      expect(html).toContain("border-risk-gray-bd");
      expect(html).toContain("Dados indisponíveis");
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "never emits a raw color hex (theme tokens only)",
    async () => {
      const { RiskBadge } = await import("./RiskBadge");
      for (const level of RISK_LEVELS) {
        const html = renderToStaticMarkup(<RiskBadge level={level} />);
        expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      }
    },
  );
});
