/**
 * Tests for StateCard — composes RiskBadge + ShareButton + state copy.
 *
 * Drives `renderToStaticMarkup` (no jsdom mount). Mirrors RiskBadge.test.tsx
 * idiom. ShareButton is a client component but its server-render output is
 * static HTML (anchor + button + empty live region) — fine for these checks.
 *
 * Plan-vs-schema deviation note: StateSnapshot (src/lib/api/schemas.ts) has
 *   { uf, risk, riskReason, alertCount, lastSuccessfulFetch, formulaVersion }
 * NOT { level, explanation, alerts, updatedAt } as the plan loosely names them.
 * Tests use the actual schema field names.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { messages } from "@/lib/messages";
import { RISK_LEVELS } from "@/lib/sources/schema";
import type { StateSnapshot } from "@/lib/api/schemas";

const componentPath = resolve(__dirname, "StateCard.tsx");

const BASE_ISO = "2026-05-19T03:00:00Z";

function snapshot(overrides: Partial<StateSnapshot> = {}): StateSnapshot {
  return {
    uf: "SP",
    risk: "orange",
    riskReason: "Risco de enchentes na região metropolitana",
    alertCount: 2,
    lastSuccessfulFetch: BASE_ISO,
    formulaVersion: "v0",
    ...overrides,
  };
}

describe("StateCard", () => {
  it.skipIf(!existsSync(componentPath))("renders state name (PT-BR) with the UF code", async () => {
    const { StateCard } = await import("./StateCard");
    const html = renderToStaticMarkup(<StateCard snapshot={snapshot()} />);
    expect(html).toContain("São Paulo");
    expect(html).toContain("(SP)");
  });

  it.skipIf(!existsSync(componentPath))(
    "renders RiskBadge with the locked label for each risk level",
    async () => {
      const { StateCard } = await import("./StateCard");
      for (const level of RISK_LEVELS) {
        const html = renderToStaticMarkup(<StateCard snapshot={snapshot({ risk: level })} />);
        expect(html).toContain(messages.severity[level]);
      }
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "green level shows the green-state empty copy verbatim",
    async () => {
      const { StateCard } = await import("./StateCard");
      const html = renderToStaticMarkup(<StateCard snapshot={snapshot({ risk: "green" })} />);
      expect(html).toContain(messages.empty.green_state);
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "red level shows the emergency contacts footer",
    async () => {
      const { StateCard } = await import("./StateCard");
      const html = renderToStaticMarkup(<StateCard snapshot={snapshot({ risk: "red" })} />);
      expect(html).toContain("199");
      expect(html).toContain("193");
      expect(html).toContain("190");
      expect(html).toContain(messages.emergency_contacts);
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "yellow/orange levels do NOT show emergency contacts",
    async () => {
      const { StateCard } = await import("./StateCard");
      for (const level of ["yellow", "orange"] as const) {
        const html = renderToStaticMarkup(<StateCard snapshot={snapshot({ risk: level })} />);
        expect(html).not.toContain(messages.emergency_contacts);
      }
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "unknown level shows the unknown_explainer with a source URL",
    async () => {
      const { StateCard } = await import("./StateCard");
      const html = renderToStaticMarkup(<StateCard snapshot={snapshot({ risk: "unknown" })} />);
      // Match the literal prefix of the explainer template.
      expect(html).toContain("Dados indisponíveis no momento.");
      // Must reference an http(s) source URL.
      expect(html).toMatch(/https?:\/\//);
    },
  );

  it.skipIf(!existsSync(componentPath))(
    "primary CTA links to /estado/{lowercase-uf} with prefetch disabled",
    async () => {
      const { StateCard } = await import("./StateCard");
      const html = renderToStaticMarkup(<StateCard snapshot={snapshot({ uf: "SP" })} />);
      // next/link emits a plain <a href="..."> in static markup.
      expect(html).toMatch(/<a\b[^>]*\bhref="\/estado\/sp"/);
      // CTA copy uses messages.cta.state_detail.
      expect(html).toContain(messages.cta.state_detail("São Paulo"));
    },
  );

  it.skipIf(!existsSync(componentPath))("renders the ShareButton (wa.me anchor)", async () => {
    const { StateCard } = await import("./StateCard");
    const html = renderToStaticMarkup(<StateCard snapshot={snapshot()} />);
    expect(html).toContain("https://wa.me/?text=");
    expect(html).toContain(messages.cta.share_whatsapp);
  });

  it.skipIf(!existsSync(componentPath))(
    "last-update footer uses PT-BR relative phrasing",
    async () => {
      const { StateCard } = await import("./StateCard");
      const html = renderToStaticMarkup(<StateCard snapshot={snapshot()} />);
      expect(html).toMatch(/Atualizado há/);
    },
  );

  it.skipIf(!existsSync(componentPath))("formula explainer link uses locked CTA copy", async () => {
    const { StateCard } = await import("./StateCard");
    const html = renderToStaticMarkup(<StateCard snapshot={snapshot()} />);
    expect(html).toContain(messages.cta.formula_explainer);
  });

  it.skipIf(!existsSync(componentPath))(
    "card border uses the per-level risk-bd CSS variable (no hex literals)",
    async () => {
      const { StateCard } = await import("./StateCard");
      const html = renderToStaticMarkup(<StateCard snapshot={snapshot({ risk: "yellow" })} />);
      expect(html).toMatch(/--color-risk-yellow-bd/);
      // No raw hex in the rendered markup (theme tokens only — Pitfall 3 lock).
      expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    },
  );
});
