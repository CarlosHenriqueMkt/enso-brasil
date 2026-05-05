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
  },
  disclaimer: {
    body: "Este site agrega informações de fontes oficiais. Não substitui sistemas oficiais de alerta. Em emergência, ligue:",
  },
  severity: {
    // CEMADEN/INMET vocabulary — locked verbatim
    green: "Sem alertas",
    yellow: "Atenção",
    orange: "Alerta",
    red: "Perigo",
    gray: "Dados indisponíveis",
  },
  edgeStates: {
    verde:
      "Não encontramos nenhuma emergência nessa localidade. Verifique em outras fontes de informação antes de decidir o que você vai fazer.",
    // {fonte} and {url} are template slots filled by the renderer in P5/P6.
    staleTemplate:
      "Não estamos recebendo dados do(a) {fonte}. Acesse {url} diretamente e busque a informação que você precisa.",
  },
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
    },
    /** Source display names for explanation prose attribution. */
    source: {
      cemaden: "CEMADEN",
      inmet: "INMET",
      stub: "Stub",
    },
  },
} as const;
