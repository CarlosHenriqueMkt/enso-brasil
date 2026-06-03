/**
 * INMET source adapter (rebuilt 2026-06 for issue #12 — Bug A).
 *
 * Wave 2 (pre-2026-06) flow: list `/avisos/ativos` → per-id GET on
 * `alertas2.inmet.gov.br/{id}` → CAP 1.2 XML → parse → normalize.
 *
 * Live flow (2026-06+): list `/avisos/ativos` IS the full payload. Each
 * envelope entry carries `descricao`, `severidade`, `estados`, `geocodes`,
 * `inicio`, `fim`, `riscos`, `instrucoes` — everything we used to pull from
 * the CAP detail. The legacy CAP subdomain (`alertas2.inmet.gov.br`) is dead
 * (ECONNRESET — see .planning/phases/06-hardening/06-under-warning-RC.md).
 *
 * Public-safety invariants (CLAUDE.md):
 *   - All errors via `sourceError()` factory (W-1).
 *   - `Promise.allSettled` per-entry isolation (T-04-03-05) — one bad row
 *     does NOT poison the tick. Unmappable hazards fall back to "enchente"
 *     (over-warning, per CLAUDE.md), unmappable severity to "moderate" (RISK-04).
 */

import { AlertArraySchema, UF27_PROVISIONAL, type Alert } from "./schema";
import type { HAZARD_KINDS } from "./schema";
import { computePayloadHash } from "./hash";
import { sourceError } from "./errors";
import {
  assertActiveList,
  type InmetActiveListEntry,
} from "./inmet.schema";
import { mapSeverity } from "@/lib/risk/sources/inmet";
import { httpGet } from "@/lib/http/fetcher";

// --- Endpoint constants ------------------------------------------------------

export const INMET_CAP_LIST = "https://apiprevmet3.inmet.gov.br/avisos/ativos";

// --- HTTP client contract ----------------------------------------------------

export interface InmetHttpClient {
  getJson<T = unknown>(url: string): Promise<T>;
}

const PROD_HTTP_CLIENT: InmetHttpClient = {
  getJson: <T>(url: string) => httpGet<T>(url),
};

// --- Hazard vocab table ------------------------------------------------------
//
// INMET `descricao` values observed live 2026-06-02:
//   "Chuvas Intensas", "Acumulado de Chuva", "Tempestade"
// Historic CAP `<event>` values (pre-2026-06): "Inundação", "Incêndio Florestal",
// "Queimada", "Enchente". Patterns below cover both.
//
// Unknown `descricao` → "enchente" (per CLAUDE.md over-warning rule). We
// previously threw for unmapped events, which silently dropped every entry
// inside Promise.allSettled — the precise failure mode that produced
// issue #12. Defaulting to a real hazard tag means the alert STILL surfaces
// to users with at-least-moderate severity rather than vanishing.

type Hazard = (typeof HAZARD_KINDS)[number];

const HAZARD_PATTERNS: ReadonlyArray<{ pattern: RegExp; hazard: Hazard }> = [
  // Specific compounds first — order matters.
  { pattern: /inc[eê]ndio\s+florestal/i, hazard: "incendio" },
  { pattern: /movimento(?:s)?\s+de\s+massa/i, hazard: "deslizamento" },
  { pattern: /deslizamento/i, hazard: "deslizamento" },
  { pattern: /inc[eê]ndio/i, hazard: "incendio" },
  { pattern: /queimada/i, hazard: "queimada" },
  { pattern: /(?:seca|estiagem)/i, hazard: "estiagem" },
  { pattern: /inunda[çc][aã]o/i, hazard: "inundacao" },
  { pattern: /(?:enchente|alagamento)/i, hazard: "enchente" },
  // Rain / storm family — all map to "enchente" (closest water-hazard tag in
  // HAZARD_KINDS; CLAUDE.md locks "enchente" as the primary hydro term).
  { pattern: /chuvas?|tempestades?|trov[oõ]ada/i, hazard: "enchente" },
];

const HAZARD_FALLBACK: Hazard = "enchente";

function mapHazard(descricao: string): Hazard {
  for (const { pattern, hazard } of HAZARD_PATTERNS) {
    if (pattern.test(descricao)) return hazard;
  }
  return HAZARD_FALLBACK;
}

// --- UF resolution -----------------------------------------------------------

type UF = (typeof UF27_PROVISIONAL)[number];

const UF_SET: ReadonlySet<UF> = new Set(UF27_PROVISIONAL);

// Unicode-aware letter boundary so "Pará" matches but "Paraná" / "Paraíba" do not.
const B_OPEN = String.raw`(?<![\p{L}])`;
const B_CLOSE = String.raw`(?![\p{L}])`;
const ufName = (body: string): RegExp => new RegExp(`${B_OPEN}${body}${B_CLOSE}`, "iu");

const UF_NAMES: ReadonlyArray<{ name: RegExp; uf: UF }> = [
  // Longer compound names first to avoid "Mato Grosso" matching "Mato Grosso do Sul".
  { name: ufName(String.raw`mato\s+grosso\s+do\s+sul`), uf: "MS" },
  { name: ufName(String.raw`rio\s+grande\s+do\s+sul`), uf: "RS" },
  { name: ufName(String.raw`rio\s+grande\s+do\s+norte`), uf: "RN" },
  { name: ufName(String.raw`rio\s+de\s+janeiro`), uf: "RJ" },
  { name: ufName(String.raw`esp[ií]rito\s+santo`), uf: "ES" },
  { name: ufName(String.raw`distrito\s+federal`), uf: "DF" },
  { name: ufName(String.raw`santa\s+catarina`), uf: "SC" },
  { name: ufName(String.raw`s[aã]o\s+paulo`), uf: "SP" },
  { name: ufName(String.raw`minas\s+gerais`), uf: "MG" },
  { name: ufName(String.raw`mato\s+grosso(?!\s+do\s+sul)`), uf: "MT" },
  { name: ufName(String.raw`pernambuco`), uf: "PE" },
  { name: ufName(String.raw`maranh[aã]o`), uf: "MA" },
  { name: ufName(String.raw`rond[oô]nia`), uf: "RO" },
  { name: ufName(String.raw`amazonas`), uf: "AM" },
  { name: ufName(String.raw`alagoas`), uf: "AL" },
  { name: ufName(String.raw`tocantins`), uf: "TO" },
  { name: ufName(String.raw`sergipe`), uf: "SE" },
  { name: ufName(String.raw`roraima`), uf: "RR" },
  { name: ufName(String.raw`para[ií]ba`), uf: "PB" },
  { name: ufName(String.raw`paran[aá]`), uf: "PR" },
  { name: ufName(String.raw`goi[aá]s`), uf: "GO" },
  { name: ufName(String.raw`cear[aá]`), uf: "CE" },
  { name: ufName(String.raw`bahia`), uf: "BA" },
  { name: ufName(String.raw`piau[ií]`), uf: "PI" },
  { name: ufName(String.raw`amap[aá]`), uf: "AP" },
  { name: ufName(String.raw`par[aá]`), uf: "PA" },
  { name: ufName(String.raw`acre`), uf: "AC" },
];

// IBGE municipality code → UF (first 2 digits). Fallback for the case where
// `estados` text is ambiguous or missing.
const IBGE_PREFIX_TO_UF: Readonly<Record<string, UF>> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
  "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
  "41": "PR", "42": "SC", "43": "RS",
  "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

function extractUFs(entry: InmetActiveListEntry): Set<UF> {
  const ufs = new Set<UF>();

  // Pass 1: PT-BR state names (longest-first table).
  for (const { name, uf } of UF_NAMES) {
    if (name.test(entry.estados)) ufs.add(uf);
  }

  // Pass 2: IBGE 2-digit prefixes from `geocodes` (CSV of 7-digit codes).
  if (ufs.size === 0 && entry.geocodes) {
    const codes = entry.geocodes.split(",");
    for (const raw of codes) {
      const trimmed = raw.trim();
      if (trimmed.length < 2) continue;
      const prefix = trimmed.slice(0, 2);
      const uf = IBGE_PREFIX_TO_UF[prefix];
      if (uf !== undefined && UF_SET.has(uf)) ufs.add(uf);
    }
  }

  return ufs;
}

// --- Timestamp normalization -------------------------------------------------
//
// INMET ships `inicio` / `fim` as "YYYY-MM-DD HH:MM" in BRT (UTC-3, no DST
// in Brazil since 2019). We convert to ISO-Z by inserting the `-03:00`
// offset and re-emitting via Date.toISOString().

const INMET_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/;

function parseInmetBrtToIsoZ(raw: string, label: string): string {
  const m = INMET_DATETIME_RE.exec(raw);
  if (!m) {
    throw sourceError("schema_invalid", `INMET ${label} not parseable: ${raw}`);
  }
  const [, y, mo, d, h, mi, s] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s ?? "00"}-03:00`;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) {
    throw sourceError("schema_invalid", `INMET ${label} not parseable: ${raw}`);
  }
  return t.toISOString();
}

// --- HTTP error → sourceError mapping ---------------------------------------

interface MaybeHttpError {
  status?: number;
  name?: string;
  cause?: { name?: string; code?: string };
  message?: string;
}

function wrapHttpError(err: unknown, url: string): never {
  const e = err as MaybeHttpError;
  const status = e.status;
  const names = [e.name, e.cause?.name].filter((n): n is string => typeof n === "string");
  const isTimeout = names.some((n) => n === "AbortError" || n === "TimeoutError");
  if (isTimeout) {
    throw sourceError("timeout", `INMET fetch timed out: ${url}`, err);
  }
  if (status !== undefined && status >= 500) {
    throw sourceError("http_5xx", `INMET fetch ${url} failed with status ${status}`, err);
  }
  if (status === 429) {
    throw sourceError("http_5xx", `INMET fetch rate-limited (429): ${url}`, err);
  }
  if (status !== undefined && status >= 400) {
    throw sourceError("http_5xx", `INMET fetch ${url} failed with status ${status}`, err);
  }
  throw sourceError("http_5xx", `INMET fetch ${url} failed: ${e.message ?? "unknown"}`, err);
}

// --- Entry → Alert[] normalization -------------------------------------------

function extractBody(entry: InmetActiveListEntry): string | undefined {
  const riscos = (entry as { riscos?: unknown }).riscos;
  if (Array.isArray(riscos) && riscos.length > 0 && typeof riscos[0] === "string") {
    return riscos[0];
  }
  return undefined;
}

function normalizeEntry(entry: InmetActiveListEntry, fetchedAt: string): Alert[] {
  const hazard = mapHazard(entry.descricao);
  const severity = mapSeverity(entry.severidade);
  const ufs = extractUFs(entry);

  if (ufs.size === 0) {
    throw sourceError(
      "schema_invalid",
      `INMET alert ${entry.id} resolves to no UF (estados="${entry.estados}", geocodes prefix mismatch)`,
    );
  }

  const validFrom = parseInmetBrtToIsoZ(entry.inicio, "inicio");
  const validUntil = parseInmetBrtToIsoZ(entry.fim, "fim");
  const body = extractBody(entry);

  const headline = `${entry.descricao} — ${entry.estados}`;

  const alerts: Alert[] = [];
  for (const uf of ufs) {
    const partial = {
      source_key: "inmet",
      hazard_kind: hazard,
      state_uf: uf,
      severity,
      headline,
      body,
      source_url: INMET_CAP_LIST,
      fetched_at: fetchedAt,
      valid_from: validFrom,
      valid_until: validUntil,
      raw: entry,
    } satisfies Omit<Alert, "payload_hash">;

    alerts.push({
      ...partial,
      payload_hash: computePayloadHash(partial),
    });
  }
  return alerts;
}

// --- Adapter factory --------------------------------------------------------

export function createInmetAdapter(http: InmetHttpClient = PROD_HTTP_CLIENT) {
  return {
    key: "inmet" as const,
    displayName: "INMET — Avisos Ativos",
    async fetch(): Promise<Alert[]> {
      const fetchedAt = new Date().toISOString();

      let rawList: unknown;
      try {
        rawList = await http.getJson(INMET_CAP_LIST);
      } catch (err) {
        wrapHttpError(err, INMET_CAP_LIST);
      }
      const envelope = assertActiveList(rawList);

      // Flatten and dedup by id; `futuro` wins on collision so an entry that
      // has both active-today and scheduled-future metadata uses the forward-
      // looking record (typically the longer effective window). Both arms
      // semantically represent "active+upcoming" per the INMET portal.
      const byId = new Map<string, InmetActiveListEntry>();
      for (const entry of envelope.hoje) byId.set(entry.id, entry);
      for (const entry of envelope.futuro) byId.set(entry.id, entry); // futuro wins
      const list = Array.from(byId.values());
      if (list.length === 0) return [];

      // Per-entry isolation — one malformed entry must not poison the tick.
      const settled = await Promise.allSettled(
        list.map(async (entry) => normalizeEntry(entry, fetchedAt)),
      );

      const collected: Alert[] = [];
      for (const result of settled) {
        if (result.status === "fulfilled") {
          collected.push(...result.value);
        }
        // Rejected per-entry results are intentionally dropped — a single
        // bad entry must not poison the tick (T-04-03-05). The cardinality
        // guardrail in tests/contract/cardinality.test.ts ensures a TOTAL
        // wipeout (every entry dropped) is caught.
      }

      // Defense-in-depth: parse the final array against AlertArraySchema.
      const validated = AlertArraySchema.safeParse(collected);
      /* v8 ignore start */
      if (!validated.success) {
        throw sourceError(
          "schema_invalid",
          `INMET adapter produced Alert[] that fails AlertArraySchema: ${validated.error.message}`,
          validated.error,
        );
      }
      /* v8 ignore stop */
      return validated.data;
    },
  };
}

export const inmetAdapter = createInmetAdapter();
