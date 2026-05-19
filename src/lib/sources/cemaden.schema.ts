/**
 * CEMADEN source-specific zod schemas (Plan 05-03, REQ ADAPT-01).
 *
 * Validates the `/wsAlertas2` payload shape per:
 *   - .planning/phases/05-cemaden-dashboard-ui/05-cemaden-endpoint-capture.md
 *   - .planning/phases/05-cemaden-dashboard-ui/05-02-CONTEXT-corrections.md (D-04)
 *
 * Two datetime formats coexist in the payload (intentionally — CEMADEN ships
 * the root `atualizado` as "DD-MM-YYYY HH:MM:SS UTC" while per-alert fields use
 * "YYYY-MM-DD HH:MM:SS.fff"). Schema validates only the SHAPE; the adapter
 * (cemaden.ts) parses the strings to UTC ISO-Z. Strict mode (`.strict()`) is
 * the tripwire — any new upstream field breaks parsing loudly.
 *
 * All errors flow through `sourceError()` factory per W-1 invariant.
 */

import { z } from "zod";
import { sourceError } from "./errors";
import { UF27_PROVISIONAL } from "./schema";

// Per-alert datetime: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD HH:MM:SS.fff"
// (captured 2026-05-18 — see 05-cemaden-endpoint-capture.md §Schema).
const ALERT_DT_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;

// Root `atualizado` datetime: "DD-MM-YYYY HH:MM:SS UTC"
// (captured 2026-05-18 — see 05-cemaden-endpoint-capture.md §Schema).
const ROOT_DT_RE = /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2} UTC$/;

export const WsAlertas2ItemSchema = z
  .object({
    cod_alerta: z.union([z.string(), z.number()]),
    datahoracriacao: z.string().regex(ALERT_DT_RE),
    ult_atualizacao: z.string().regex(ALERT_DT_RE),
    codibge: z.union([z.string(), z.number()]),
    evento: z.string().min(1),
    nivel: z.enum(["Moderado", "Alto", "Muito Alto"]),
    status: z.string(),
    uf: z.enum(UF27_PROVISIONAL),
    municipio: z.string(),
    latitude: z.union([z.string(), z.number()]),
    longitude: z.union([z.string(), z.number()]),
  })
  .strict();

export const WsAlertas2ResponseSchema = z
  .object({
    alertas: z.array(WsAlertas2ItemSchema),
    atualizado: z.string().regex(ROOT_DT_RE),
  })
  .strict();

export type WsAlertas2Item = z.infer<typeof WsAlertas2ItemSchema>;
export type WsAlertas2Response = z.infer<typeof WsAlertas2ResponseSchema>;

export function assertWsAlertas2Response(raw: unknown): WsAlertas2Response {
  const result = WsAlertas2ResponseSchema.safeParse(raw);
  if (!result.success) {
    throw sourceError(
      "schema_invalid",
      `CEMADEN /wsAlertas2 payload failed schema validation: ${result.error.message}`,
      result.error,
    );
  }
  return result.data;
}
