/**
 * INMET source-specific zod schemas (Plan 04-03).
 *
 * - `InmetActiveListSchema`: tolerant view of the JSON shape returned by
 *   `INMET_CAP_LIST` (https://apiprevmet3.inmet.gov.br/avisos/ativos).
 *   Strict on `id` only; everything else passes through.
 * - `InmetCapDocumentSchema`: post-`fast-xml-parser` shape for a CAP 1.2
 *   document fetched from `INMET_CAP_DETAIL(id)`. The Wave 0 parser config
 *   forces `alert.info` to an array (one entry per `xml:lang`).
 *
 * Both helpers throw via the canonical `sourceError(...)` factory — never
 * `new SourceError(...)` and never via `class extends Error` (W-1 invariant
 * locked by 04-CONTEXT taxonomy).
 */

import { z } from "zod";
import { sourceError } from "./errors";

export const InmetActiveListEntrySchema = z
  .object({
    id: z.string().min(1),
  })
  .passthrough();

export const InmetActiveListSchema = z.array(InmetActiveListEntrySchema);

export type InmetActiveListEntry = z.infer<typeof InmetActiveListEntrySchema>;
export type InmetActiveList = z.infer<typeof InmetActiveListSchema>;

const InmetAreaSchema = z
  .object({
    areaDesc: z.string(),
    geocode: z.unknown().optional(),
  })
  .passthrough();

const InmetInfoSchema = z
  .object({
    "@_xml:lang": z.string().optional(),
    severity: z.string(),
    event: z.string(),
    effective: z.string().optional(),
    expires: z.string().optional(),
    headline: z.string(),
    description: z.string().optional(),
    web: z.string().url().optional(),
    area: z.union([InmetAreaSchema, z.array(InmetAreaSchema)]).optional(),
  })
  .passthrough();

export const InmetCapDocumentSchema = z
  .object({
    alert: z
      .object({
        identifier: z.string(),
        sent: z.string(),
        status: z.string().optional(),
        info: z.array(InmetInfoSchema).min(1),
      })
      .passthrough(),
  })
  .passthrough();

export type InmetCapDocument = z.infer<typeof InmetCapDocumentSchema>;
export type InmetInfo = z.infer<typeof InmetInfoSchema>;
export type InmetArea = z.infer<typeof InmetAreaSchema>;

export function assertActiveList(raw: unknown): InmetActiveList {
  const result = InmetActiveListSchema.safeParse(raw);
  if (!result.success) {
    throw sourceError(
      "schema_invalid",
      `INMET active-list payload failed schema validation: ${result.error.message}`,
      result.error,
    );
  }
  return result.data;
}

export function assertCapDocument(raw: unknown): InmetCapDocument {
  const result = InmetCapDocumentSchema.safeParse(raw);
  if (!result.success) {
    throw sourceError(
      "schema_invalid",
      `INMET CAP document failed schema validation: ${result.error.message}`,
      result.error,
    );
  }
  return result.data;
}
