/**
 * INMET source adapter (Plan 04-03, REQ-S2.04 / ADAPT-02 / ADAPT-04).
 *
 * Two-step fetch pipeline:
 *   1. GET INMET_CAP_LIST   → JSON array of `{ id, ... }`
 *   2. GET INMET_CAP_DETAIL(id) → CAP 1.2 XML, parsed via Wave 0 parseCapXml
 *
 * Endpoint constants are pinned per RESEARCH Q2 (2026-05-05). Path C ships
 * INMET only — CEMADEN deferred to Phase 5.
 *
 * All error throws flow through the canonical `sourceError(...)` factory
 * (W-1 invariant locked by 04-CONTEXT taxonomy — NO `class extends Error`).
 */

import { AlertArraySchema, HAZARD_KINDS, UF27_PROVISIONAL, type Alert } from "./schema";
import { computePayloadHash } from "./hash";
import { sourceError } from "./errors";
import { parseCapXml } from "./xml";
import {
  assertActiveList,
  assertCapDocument,
  type InmetArea,
  type InmetCapDocument,
  type InmetInfo,
} from "./inmet.schema";
import { mapSeverity } from "@/lib/risk/sources/inmet";
import { httpGet, httpGetText } from "@/lib/http/fetcher";

// --- Endpoint constants (pinned per RESEARCH Q2) ----------------------------

export const INMET_CAP_LIST = "https://apiprevmet3.inmet.gov.br/avisos/ativos";
export const INMET_CAP_DETAIL = (id: string): string => `https://alertas2.inmet.gov.br/${id}`;

// --- HTTP client contract ----------------------------------------------------

export interface InmetHttpClient {
  getJson<T = unknown>(url: string): Promise<T>;
  getText(url: string): Promise<string>;
}

const PROD_HTTP_CLIENT: InmetHttpClient = {
  getJson: <T>(url: string) => httpGet<T>(url),
  getText: (url: string) => httpGetText(url),
};

// --- Hazard vocab table (CLAUDE.md: preserve CEMADEN/INMET distinctions) ----

type Hazard = (typeof HAZARD_KINDS)[number];

const HAZARD_PATTERNS: ReadonlyArray<{ pattern: RegExp; hazard: Hazard }> = [
  // Specific compounds first — order matters.
  { pattern: /inc[eê]ndio\s+florestal/i, hazard: "incendio" },
  { pattern: /inc[eê]ndio/i, hazard: "incendio" },
  { pattern: /queimada/i, hazard: "queimada" },
  { pattern: /inunda[çc][aã]o/i, hazard: "inundacao" },
  { pattern: /enchente/i, hazard: "enchente" },
];

function mapHazard(event: string): Hazard {
  for (const { pattern, hazard } of HAZARD_PATTERNS) {
    if (pattern.test(event)) return hazard;
  }
  throw sourceError("schema_invalid", `INMET event "${event}" does not map to any v1 hazard kind`);
}

// --- UF resolution (areaDesc / geocode) -------------------------------------

type UF = (typeof UF27_PROVISIONAL)[number];

const UF_SET: ReadonlySet<UF> = new Set(UF27_PROVISIONAL);

const UF_NAMES: ReadonlyArray<{ name: RegExp; uf: UF }> = [
  // Longer compound names first to avoid "Mato Grosso" matching "Mato Grosso do Sul".
  { name: /mato\s+grosso\s+do\s+sul/i, uf: "MS" },
  { name: /rio\s+grande\s+do\s+sul/i, uf: "RS" },
  { name: /rio\s+grande\s+do\s+norte/i, uf: "RN" },
  { name: /rio\s+de\s+janeiro/i, uf: "RJ" },
  { name: /esp[ií]rito\s+santo/i, uf: "ES" },
  { name: /distrito\s+federal/i, uf: "DF" },
  { name: /santa\s+catarina/i, uf: "SC" },
  { name: /s[aã]o\s+paulo/i, uf: "SP" },
  { name: /minas\s+gerais/i, uf: "MG" },
  { name: /mato\s+grosso/i, uf: "MT" },
  { name: /pernambuco/i, uf: "PE" },
  { name: /maranh[aã]o/i, uf: "MA" },
  { name: /rond[oô]nia/i, uf: "RO" },
  { name: /amazonas/i, uf: "AM" },
  { name: /alagoas/i, uf: "AL" },
  { name: /tocantins/i, uf: "TO" },
  { name: /sergipe/i, uf: "SE" },
  { name: /roraima/i, uf: "RR" },
  { name: /para[ií]ba/i, uf: "PB" },
  { name: /paran[aá]/i, uf: "PR" },
  { name: /goi[aá]s/i, uf: "GO" },
  { name: /cear[aá]/i, uf: "CE" },
  { name: /bahia/i, uf: "BA" },
  { name: /piau[ií]/i, uf: "PI" },
  { name: /amap[aá]/i, uf: "AP" },
  { name: /par[aá]/i, uf: "PA" },
  { name: /acre/i, uf: "AC" },
];

const UF_CODE_RE = /\b([A-Z]{2})\b/g;

function extractUFs(area: InmetInfo["area"]): Set<UF> {
  const ufs = new Set<UF>();
  if (!area) return ufs;
  const entries: InmetArea[] = Array.isArray(area) ? area : [area];

  for (const entry of entries) {
    const desc = entry.areaDesc ?? "";

    // Pass 1: full state names (longest-first table).
    for (const { name, uf } of UF_NAMES) {
      if (name.test(desc)) ufs.add(uf);
    }

    // Pass 2: 2-letter codes (e.g. "MG, SP").
    let match: RegExpExecArray | null;
    UF_CODE_RE.lastIndex = 0;
    while ((match = UF_CODE_RE.exec(desc)) !== null) {
      const code = match[1] as UF;
      if (UF_SET.has(code)) ufs.add(code);
    }
  }

  return ufs;
}

// --- Info-block selection (pt-BR mandatory) ---------------------------------

function selectPtBrInfo(doc: InmetCapDocument, alertId: string): InmetInfo {
  const infos = doc.alert.info;
  const ptBr = infos.find((i) => i["@_xml:lang"] === "pt-BR");
  if (!ptBr) {
    throw sourceError(
      "missing_pt_br",
      `INMET alert ${alertId} has no <info xml:lang="pt-BR"> block`,
    );
  }
  return ptBr;
}

// --- Timestamp normalization -------------------------------------------------

function toIsoZ(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw sourceError("schema_invalid", `INMET timestamp not parseable: ${raw}`);
  }
  return d.toISOString();
}

function requireIsoZ(raw: string, label: string): string {
  const out = toIsoZ(raw);
  if (!out) {
    throw sourceError("schema_invalid", `INMET ${label} required but empty`);
  }
  return out;
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
  const name = e.name ?? e.cause?.name;
  if (name === "AbortError" || name === "TimeoutError") {
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

// --- CAP doc → Alert[] normalization ----------------------------------------

function normalizeCapDoc(doc: InmetCapDocument, capUrl: string, fetchedAt: string): Alert[] {
  const id = doc.alert.identifier;
  const info = selectPtBrInfo(doc, id);
  const hazard = mapHazard(info.event);
  const severity = mapSeverity(info.severity);
  const ufs = extractUFs(info.area);

  if (ufs.size === 0) {
    throw sourceError(
      "schema_invalid",
      `INMET alert ${id} resolves to no UF (area: ${JSON.stringify(info.area ?? null)})`,
    );
  }

  const validFrom = toIsoZ(info.effective);
  const validUntil = toIsoZ(info.expires);
  // Fail loud if `sent` is missing/unparseable — every CAP alert must carry it.
  void requireIsoZ(doc.alert.sent, "alert.sent");

  const alerts: Alert[] = [];
  for (const uf of ufs) {
    const partial = {
      source_key: "inmet",
      hazard_kind: hazard,
      state_uf: uf,
      severity,
      headline: info.headline,
      body: info.description,
      source_url: capUrl,
      fetched_at: fetchedAt,
      valid_from: validFrom,
      valid_until: validUntil,
      raw: doc,
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
    displayName: "INMET — Alert-AS",
    async fetch(): Promise<Alert[]> {
      const fetchedAt = new Date().toISOString();

      // Step 1: list active alerts.
      let rawList: unknown;
      try {
        rawList = await http.getJson(INMET_CAP_LIST);
      } catch (err) {
        wrapHttpError(err, INMET_CAP_LIST);
      }
      const list = assertActiveList(rawList);
      if (list.length === 0) return [];

      // Step 2: per-alert CAP fetch with isolation.
      const settled = await Promise.allSettled(
        list.map(async (entry) => {
          const url = INMET_CAP_DETAIL(entry.id);
          let xml: string;
          try {
            xml = await http.getText(url);
          } catch (err) {
            wrapHttpError(err, url);
          }
          const parsed = parseCapXml(xml);
          const doc = assertCapDocument(parsed);
          return normalizeCapDoc(doc, url, fetchedAt);
        }),
      );

      const collected: Alert[] = [];
      for (const result of settled) {
        if (result.status === "fulfilled") {
          collected.push(...result.value);
        }
        // Rejected per-alert results are intentionally dropped — CAP failures
        // for one alert must not poison the rest of the INMET tick (T-04-03-05).
      }

      // Defense-in-depth: parse the final array against AlertArraySchema.
      const validated = AlertArraySchema.safeParse(collected);
      if (!validated.success) {
        throw sourceError(
          "schema_invalid",
          `INMET adapter produced Alert[] that fails AlertArraySchema: ${validated.error.message}`,
          validated.error,
        );
      }
      return validated.data;
    },
  };
}

export const inmetAdapter = createInmetAdapter();
