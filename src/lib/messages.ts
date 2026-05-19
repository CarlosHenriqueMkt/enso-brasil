/**
 * ENSO Brasil — PT-BR strings (single source of truth).
 *
 * NOT an i18n catalog. Project is PT-BR only — `next-intl` is intentionally
 * REMOVED from the stack (see PROJECT.md key decisions, P1 CONTEXT D-13 history).
 *
 * Locked verbatim by sketch-findings-enso-brasil skill. Do not paraphrase.
 */
export const messages = {
  emergency: {
    // Sketch-findings HARD RULE: never bare numbers — always paired with agency.
    inline: "199 Defesa Civil · 193 Bombeiros · 190 Polícia",
    button_label: "Emergência",
    panel_title: "Em emergência, ligue:",
    entries: [
      { number: "199", agency: "Defesa Civil" },
      { number: "193", agency: "Bombeiros" },
      { number: "190", agency: "Polícia" },
    ] as const,
  },
  // P5 alias for the locked emergency line — referenced by UI primitives.
  emergency_contacts: "199 Defesa Civil · 193 Bombeiros · 190 Polícia",
  disclaimer: {
    body: "Este site agrega informações de fontes oficiais. Não substitui sistemas oficiais de alerta.",
  },
  severity: {
    // CEMADEN/INMET vocabulary — locked verbatim
    green: "Sem alertas",
    yellow: "Atenção",
    orange: "Alerta",
    red: "Perigo",
    gray: "Dados indisponíveis",
    // P5 alias — UI-SPEC RiskLevel union uses `unknown` (semantic) where
    // the legacy palette uses `gray` (visual). Both resolve to the same label.
    unknown: "Dados indisponíveis",
  },
  severity_icon: {
    // Unicode glyphs only — no SVG, no icon font (3G budget).
    // Color + icon + text are redundant signals (A11Y-04).
    green: "✓",
    yellow: "⚠",
    orange: "⚠⚠",
    red: "⛔",
    unknown: "?",
  },
  edgeStates: {
    verde:
      "Não encontramos nenhuma emergência nessa localidade. Verifique em outras fontes de informação antes de decidir o que você vai fazer.",
    // {fonte} and {url} are template slots filled by the renderer in P5/P6.
    staleTemplate:
      "Não estamos recebendo dados do(a) {fonte}. Acesse {url} diretamente e busque a informação que você precisa.",
  },
  empty: {
    green_state:
      "Não encontramos nenhuma emergência nessa localidade. Verifique em outras fontes de informação antes de decidir o que você vai fazer.",
    stale_source: (fonte: string, url: string) =>
      `Não estamos recebendo dados do(a) ${fonte}. Acesse ${url} diretamente e busque a informação que você precisa.`,
    unknown_explainer: (url: string) =>
      `Dados indisponíveis no momento. Verifique diretamente em ${url}.`,
    not_found_uf: "Estado não encontrado. Volte para a página inicial.",
  },
  cta: {
    state_detail: (uf: string) => `Ver detalhes de ${uf}`,
    share_whatsapp: "Compartilhar no WhatsApp",
    share_clipboard: "Copiar link",
    share_clipboard_confirm: "Link copiado.",
    formula_explainer: "Como calculamos isso?",
  },
  filter: {
    all: "Todas",
    regions: {
      N: "Norte",
      NE: "Nordeste",
      CO: "Centro-Oeste",
      SE: "Sudeste",
      S: "Sul",
    },
  },
  timestamp_template: {
    minutes: (n: number) => `Atualizado há ${n} minutos`,
    hours: (n: number) => `Atualizado há ${n} horas`,
    over_day: "Atualizado há mais de 24h",
  },
  share_text_template: (estado: string, nivel: string, expl: string, url: string) =>
    `${estado}: ${nivel} — ${expl}. Veja em ${url}.`,
  texto: {
    page_title: "Versão em texto",
    table_headers: ["Estado", "Nível", "Alertas ativos", "Atualizado há"],
  },
  // P5 plan 10 — locked PT-BR copy for the home page <h1>.
  page_title: "Alertas climáticos por estado",
  skip_link: "Pular para o conteúdo",
  a11y: {
    skipLink: "Pular para o conteúdo principal",
  },
  privacy: {
    // D-06: date-only PT-BR natural format. Update on every revision.
    version: "Versão de 30 de abril de 2026",
    sections: {
      coletamos: "O que coletamos",
      retencao: "Por quanto tempo",
      paraQue: "Para quê",
      naoColetamos: "O que NÃO coletamos",
      direitos: "Direitos do titular sob a LGPD",
      contato: "Contato responsável",
      versao: "Versão e data da política",
    },
    // D-05: LinkedIn is the contact channel for ALL matters during v1
    contactUrl: "https://www.linkedin.com/in/carloshenriquerp/",
    contactName: "Carlos Henrique (mantenedor)",
  },
  risk: {
    /** Per-alert severity labels (verbatim CEMADEN/INMET vocabulary, RISK-09). */
    severity: {
      low: "Atenção",
      moderate: "Alerta",
      high: "Perigo",
      extreme: "Perigo extremo",
    },
    /** Hazard noun phrases for explanation prose. Keys mirror HAZARD_KINDS exactly. */
    hazard: {
      queimada: "queimada",
      enchente: "enchente",
      estiagem: "estiagem",
      incendio: "incêndio",
      inundacao: "inundação",
      seca: "seca",
      deslizamento: "deslizamento",
    },
    /** Source display names for explanation prose attribution. */
    source: {
      cemaden: "CEMADEN",
      inmet: "INMET",
      stub: "Stub",
    },
  },
} as const;
