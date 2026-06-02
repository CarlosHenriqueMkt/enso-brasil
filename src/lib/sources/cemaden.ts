/**
 * CEMADEN source adapter (Plan 05-03, REQ ADAPT-01).
 *
 * Single national GET to `/wsAlertas2` (no per-UF iteration, no query params).
 * Endpoint captured + verified in:
 *   - .planning/phases/05-cemaden-dashboard-ui/05-cemaden-endpoint-capture.md
 *
 * Timestamp parsing follows D-04 (corrected) — see
 *   .planning/phases/05-cemaden-dashboard-ui/05-02-CONTEXT-corrections.md
 * Per-alert datetimes are emitted by CEMADEN as naive "YYYY-MM-DD HH:MM:SS.fff"
 * strings already in UTC (per the root `atualizado ... UTC` annotation). We
 * parse them as UTC and re-emit as ISO-Z.
 *
 * Hazard mapping is LOCKED (plan body §Hazard mapping):
 *   - /^Risco Hidrológico/i → "enchente"   (CLAUDE.md vocab; `alagamento` NOT
 *                                           in HAZARD_KINDS union — do NOT add)
 *   - /^Movimento de Massa/i → "deslizamento"
 *   - No match → sourceError("schema_invalid", ...) — fail loud, never silent.
 *
 * All error throws flow through the canonical `sourceError(...)` factory
 * (W-1 invariant locked by 04-CONTEXT taxonomy — NO `class extends Error`).
 */

import { AlertArraySchema, HAZARD_KINDS, type Alert } from "./schema";
import { computePayloadHash } from "./hash";
import { sourceError } from "./errors";
import { assertWsAlertas2Response, type WsAlertas2Item } from "./cemaden.schema";
import { mapSeverity } from "@/lib/risk/sources/cemaden";
import { httpGet } from "@/lib/http/fetcher";

// --- Endpoint constant (pinned per 05-cemaden-endpoint-capture.md) ----------

export const CEMADEN_WS_ALERTAS_URL = "https://painelalertas.cemaden.gov.br/wsAlertas2";

// --- HTTP client contract ----------------------------------------------------

export interface CemadenHttpClient {
  getJson<T = unknown>(url: string): Promise<T>;
}

const PROD_HTTP_CLIENT: CemadenHttpClient = {
  getJson: <T>(url: string) => httpGet<T>(url),
};

// --- Hazard vocab table (CLAUDE.md: CEMADEN vocabulary verbatim) ------------

type Hazard = (typeof HAZARD_KINDS)[number];

const CEMADEN_HAZARD_PATTERNS: ReadonlyArray<{ pattern: RegExp; hazard: Hazard }> = [
  { pattern: /^Risco Hidrol[óo]gico/i, hazard: "enchente" },
  // CEMADEN emits both "Movimento de Massa" (singular, pre-2026-06) and
  // "Movimentos de Massa" (plural, observed live 2026-06-02). Accept either.
  { pattern: /^Movimentos?\s+de\s+Massa/i, hazard: "deslizamento" },
];

function mapHazard(event: string): Hazard {
  for (const { pattern, hazard } of CEMADEN_HAZARD_PATTERNS) {
    if (pattern.test(event)) return hazard;
  }
  throw sourceError("schema_invalid", `CEMADEN evento not mappable: "${event}"`);
}

// --- Timestamp normalization (D-04 corrected) -------------------------------

// Drift tripwire bounds — CEMADEN timestamps outside this window indicate a
// schema/source shift (e.g. timezone semantics flip) we must surface loudly.
const MIN_VALID_MS = Date.UTC(2010, 0, 1);
const DRIFT_FORWARD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function parseCemadenUtc(raw: string, label: string): string {
  // CEMADEN emits "YYYY-MM-DD HH:MM:SS[.fff]" already in UTC (root `atualizado`
  // carries an explicit "UTC" suffix that applies to the whole payload). We
  // construct an ISO-8601 UTC instant by swapping the space for "T" and
  // appending "Z", then re-emit via .toISOString() to canonicalize.
  const isoCandidate = raw.replace(" ", "T") + "Z";
  const d = new Date(isoCandidate);
  const ms = d.getTime();
  if (Number.isNaN(ms)) {
    throw sourceError("schema_invalid", `CEMADEN ${label} timestamp not parseable: ${raw}`);
  }
  const nowMs = Date.now();
  if (ms < MIN_VALID_MS || ms > nowMs + DRIFT_FORWARD_MS) {
    throw sourceError(
      "schema_invalid",
      `CEMADEN timestamp out of plausible range (${label}=${raw})`,
    );
  }
  return d.toISOString();
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
    throw sourceError("timeout", `CEMADEN fetch timed out: ${url}`, err);
  }
  if (status !== undefined && status >= 500) {
    throw sourceError("http_5xx", `CEMADEN fetch ${url} failed with status ${status}`, err);
  }
  if (status === 429) {
    throw sourceError("http_5xx", `CEMADEN fetch rate-limited (429): ${url}`, err);
  }
  if (status !== undefined && status >= 400) {
    throw sourceError("http_5xx", `CEMADEN fetch ${url} failed with status ${status}`, err);
  }
  throw sourceError("http_5xx", `CEMADEN fetch ${url} failed: ${e.message ?? "unknown"}`, err);
}

// --- Item → Alert[] normalization -------------------------------------------

function normalizeItem(item: WsAlertas2Item, fetchedAt: string): Alert {
  const hazard = mapHazard(item.evento);
  const severity = mapSeverity(item.nivel);

  const validFrom = parseCemadenUtc(item.datahoracriacao, "datahoracriacao");
  // CEMADEN does not expose an expiry field — alerts remain active as long
  // as they are present in the `wsAlertas2` response. We previously
  // synthesized a 24h window from `datahoracriacao`, which silently filtered
  // long-running alerts out of `/api/states` (issue #12 root cause Bug C).
  // Leaving `valid_until` undefined lets the ingest active-rows query fall
  // back to the `fetched_at > now - 24h` clause (route.ts:189-194), keeping
  // any alert alive for as long as we keep observing it upstream.
  const validUntil: string | undefined = undefined;

  const headline = `${item.evento} — ${item.municipio}/${item.uf}`;

  const partial = {
    source_key: "cemaden",
    hazard_kind: hazard,
    state_uf: item.uf,
    severity,
    headline,
    body: undefined,
    source_url: CEMADEN_WS_ALERTAS_URL,
    fetched_at: fetchedAt,
    valid_from: validFrom,
    valid_until: validUntil,
    raw: item,
  } satisfies Omit<Alert, "payload_hash">;

  return {
    ...partial,
    payload_hash: computePayloadHash(partial),
  };
}

// --- Adapter factory --------------------------------------------------------

export function createCemadenAdapter(http: CemadenHttpClient = PROD_HTTP_CLIENT) {
  return {
    key: "cemaden" as const,
    displayName: "CEMADEN — Alertas vigentes",
    async fetch(): Promise<Alert[]> {
      const fetchedAt = new Date().toISOString();

      let rawPayload: unknown;
      try {
        rawPayload = await http.getJson(CEMADEN_WS_ALERTAS_URL);
      } catch (err) {
        wrapHttpError(err, CEMADEN_WS_ALERTAS_URL);
      }

      const payload = assertWsAlertas2Response(rawPayload);
      if (payload.alertas.length === 0) return [];

      // Per-alert isolation — one malformed alert must not poison the tick
      // (mirrors INMET adapter pattern at inmet.ts:264-286).
      const settled = await Promise.allSettled(
        payload.alertas.map(async (item) => normalizeItem(item, fetchedAt)),
      );

      const collected: Alert[] = [];
      for (const result of settled) {
        if (result.status === "fulfilled") {
          collected.push(result.value);
        }
        // Rejected per-alert results are intentionally dropped.
      }

      // Defense-in-depth tripwire — every emitted alert must satisfy
      // AlertArraySchema. Unreachable under normal flow (normalizeItem fields
      // are field-by-field valid) but kept for future refactor safety.
      const validated = AlertArraySchema.safeParse(collected);
      /* v8 ignore start */
      if (!validated.success) {
        throw sourceError(
          "schema_invalid",
          `CEMADEN adapter produced Alert[] that fails AlertArraySchema: ${validated.error.message}`,
          validated.error,
        );
      }
      /* v8 ignore stop */
      return validated.data;
    },
  };
}

export const cemadenAdapter = createCemadenAdapter();
