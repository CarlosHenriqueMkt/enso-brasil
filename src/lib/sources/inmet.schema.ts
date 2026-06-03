/**
 * INMET source-specific zod schemas.
 *
 * As of 2026-06 (issue #12 RC, see .planning/phases/06-hardening/06-under-warning-RC.md):
 * the INMET API at `/avisos/ativos` returns the **full** alert payload inline.
 * The legacy CAP XML detail endpoint at `alertas2.inmet.gov.br/{id}` is dead
 * (ECONNRESET — confirmed 2026-06-02). The adapter no longer fetches CAP docs;
 * everything we need is in the list response.
 *
 * `InmetActiveListEntrySchema` strictly validates the fields the adapter reads
 * and `.passthrough()`-tolerates every other field (the upstream payload ships
 * ~30 keys per entry that we do not consume).
 *
 * All errors flow through the canonical `sourceError` factory (W-1 invariant).
 */

import { z } from "zod";
import { sourceError } from "./errors";

/**
 * Per-entry alert record from `https://apiprevmet3.inmet.gov.br/avisos/ativos`.
 *
 * Required fields (we read them in `inmet.ts`):
 *   - id          → string identifier; live API ships number, legacy fixture ships string
 *   - descricao   → event type (e.g. "Chuvas Intensas", "Tempestade")
 *   - severidade  → CAP-aligned PT-BR severity (e.g. "Perigo", "Perigo Potencial")
 *   - estados     → comma-separated PT-BR UF names (e.g. "Pernambuco,Paraíba")
 *   - geocodes    → comma-separated IBGE codes (UF fallback; first 2 digits → UF)
 *   - inicio      → "YYYY-MM-DD HH:MM" in BRT (UTC-3)
 *   - fim         → "YYYY-MM-DD HH:MM" in BRT (UTC-3)
 *
 * Everything else passes through. `.strict()` is intentionally NOT used —
 * INMET ships marketing/UI fields (icone base64, aviso_cor, etc.) and the
 * 2026-06 schema drift caught us out once; tolerate unknown additions.
 */
export const InmetActiveListEntrySchema = z
  .object({
    id: z.coerce.string().min(1),
    descricao: z.string().min(1),
    severidade: z.string().min(1),
    estados: z.string().min(1),
    geocodes: z.string(),
    inicio: z.string().min(1),
    fim: z.string().min(1),
  })
  .passthrough();

/**
 * INMET active-list envelope.
 *
 * `/avisos/ativos` returns `{ hoje, futuro }` — `hoje` = currently active,
 * `futuro` = scheduled/upcoming within the active window. The adapter
 * flattens `hoje ∪ futuro` and dedups by `id` (futuro wins on collision —
 * see `inmet.ts`).
 *
 * Legacy flat-array shape is rejected by this schema deliberately
 * (T-05-08): a silent regression upstream must surface as `schema_invalid`,
 * never as "zero alerts".
 */
export const InmetActiveListSchema = z
  .object({
    hoje: z.array(InmetActiveListEntrySchema),
    futuro: z.array(InmetActiveListEntrySchema),
  })
  .passthrough();

export type InmetActiveListEntry = z.infer<typeof InmetActiveListEntrySchema>;
export type InmetActiveList = z.infer<typeof InmetActiveListSchema>;

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
