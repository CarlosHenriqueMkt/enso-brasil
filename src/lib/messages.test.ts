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
        deslizamento: "deslizamento",
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

describe("messages — P5 additions (UI primitives)", () => {
  it("exposes all 5 severity levels with locked PT-BR labels + icons", async () => {
    const { messages } = await import("./messages");
    // Labels — green/yellow/orange/red/unknown
    expect(messages.severity.green).toBe("Sem alertas");
    expect(messages.severity.yellow).toBe("Atenção");
    expect(messages.severity.orange).toBe("Alerta");
    expect(messages.severity.red).toBe("Perigo");
    // `unknown` alias for `gray` (UI-SPEC RiskLevel union).
    expect(messages.severity.unknown).toBe("Dados indisponíveis");

    // Icons — every level has a glyph
    expect(messages.severity_icon.green).toBe("✓");
    expect(messages.severity_icon.yellow).toBe("⚠");
    expect(messages.severity_icon.orange).toBe("⚠⚠");
    expect(messages.severity_icon.red).toBe("⛔");
    expect(messages.severity_icon.unknown).toBe("?");
  });

  it("exposes emergency_contacts with all three agencies + numbers", async () => {
    const { messages } = await import("./messages");
    const s = messages.emergency_contacts;
    expect(s).toContain("199");
    expect(s).toContain("193");
    expect(s).toContain("190");
    expect(s).toContain("Defesa Civil");
    expect(s).toContain("Bombeiros");
    expect(s).toContain("Polícia");
  });

  it("exposes CTA template functions", async () => {
    const { messages } = await import("./messages");
    expect(messages.cta.state_detail("SP")).toBe("Ver detalhes de SP");
    expect(messages.cta.share_whatsapp).toBe("Compartilhar no WhatsApp");
    expect(messages.cta.share_clipboard).toBe("Copiar link");
    expect(messages.cta.share_clipboard_confirm).toBe("Link copiado.");
    expect(messages.cta.formula_explainer).toBe("Como calculamos isso?");
  });

  it("exposes region filter labels", async () => {
    const { messages } = await import("./messages");
    expect(messages.filter.all).toBe("Todas");
    expect(messages.filter.regions).toEqual({
      N: "Norte",
      NE: "Nordeste",
      CO: "Centro-Oeste",
      SE: "Sudeste",
      S: "Sul",
    });
  });

  it("exposes timestamp templates", async () => {
    const { messages } = await import("./messages");
    expect(messages.timestamp_template.minutes(5)).toBe("Atualizado há 5 minutos");
    expect(messages.timestamp_template.hours(2)).toBe("Atualizado há 2 horas");
    expect(messages.timestamp_template.over_day).toBe("Atualizado há mais de 24h");
  });

  it("exposes share_text_template with verbatim format", async () => {
    const { messages } = await import("./messages");
    expect(messages.share_text_template("SP", "Atenção", "chuva forte", "https://x")).toBe(
      "SP: Atenção — chuva forte. Veja em https://x.",
    );
  });

  it("exposes empty / edge state copy", async () => {
    const { messages } = await import("./messages");
    expect(messages.empty.green_state).toMatch(/Não encontramos nenhuma emergência/);
    expect(messages.empty.stale_source("CEMADEN", "https://x")).toBe(
      "Não estamos recebendo dados do(a) CEMADEN. Acesse https://x diretamente e busque a informação que você precisa.",
    );
    expect(messages.empty.unknown_explainer("https://x")).toMatch(/Dados indisponíveis/);
    expect(messages.empty.not_found_uf).toMatch(/Estado não encontrado/);
  });

  it("exposes /texto page strings", async () => {
    const { messages } = await import("./messages");
    expect(messages.texto.page_title).toBe("Versão em texto");
    expect(messages.texto.table_headers).toEqual([
      "Estado",
      "Nível",
      "Alertas ativos",
      "Atualizado há",
    ]);
  });

  it("exposes skip_link locked string", async () => {
    const { messages } = await import("./messages");
    expect(messages.skip_link).toBe("Pular para o conteúdo");
  });
});
