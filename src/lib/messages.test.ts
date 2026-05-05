import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const messagesPath = resolve(__dirname, "messages.ts");

describe("messages module", () => {
  it.skipIf(!existsSync(messagesPath))(
    "exports messages.emergency.inline with the locked PT-BR string",
    async () => {
      const mod = await import("./messages");
      expect(mod.messages.emergency.inline).toBe("199 Defesa Civil · 193 Bombeiros · 190 Polícia");
    },
  );

  it.skipIf(!existsSync(messagesPath))(
    "exports messages.disclaimer.body as a non-empty string",
    async () => {
      const mod = await import("./messages");
      expect(typeof mod.messages.disclaimer.body).toBe("string");
      expect(mod.messages.disclaimer.body.length).toBeGreaterThan(20);
    },
  );

  it.skipIf(!existsSync(messagesPath))(
    "contains no i18n / locale references in the messages module (code, not comments)",
    () => {
      const raw = readFileSync(messagesPath, "utf8");
      // Strip block + line comments so doc explaining "next-intl intentionally absent" doesn't match.
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code).not.toMatch(/from\s+['"]next-intl['"]|useTranslations\s*\(|locale\s*:/);
    },
  );
});

describe("messages.risk (RISK-09 vocab SoT)", () => {
  it.skipIf(!existsSync(messagesPath))(
    "exposes severity / hazard / source maps with locked PT-BR labels",
    async () => {
      const { messages } = await import("./messages");
      // Severity (per-alert)
      expect(messages.risk.severity).toEqual({
        low: "Atenção",
        moderate: "Alerta",
        high: "Perigo",
        extreme: "Perigo extremo",
      });
      // Hazard noun phrases — keys must match HAZARD_KINDS verbatim
      expect(messages.risk.hazard).toEqual({
        queimada: "queimada",
        enchente: "enchente",
        estiagem: "estiagem",
        incendio: "incêndio",
        inundacao: "inundação",
        seca: "seca",
      });
      // Source attribution
      expect(messages.risk.source).toEqual({
        cemaden: "CEMADEN",
        inmet: "INMET",
        stub: "Stub",
      });
    },
  );

  it.skipIf(!existsSync(messagesPath))(
    "preserves existing messages.severity (state-level RiskLevel labels)",
    async () => {
      const { messages } = await import("./messages");
      // Sanity: green/gray must still resolve to locked PT-BR labels per PROJECT.md
      expect(messages.severity.green).toBe("Sem alertas");
      expect(messages.severity.gray).toBe("Dados indisponíveis");
    },
  );
});
