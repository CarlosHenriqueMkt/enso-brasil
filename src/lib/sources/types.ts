import type { Alert } from "./schema";

export type { Alert };

/**
 * SourceAdapter contract (REQ-S2.04).
 *
 * The orchestrator (/api/ingest, plan 02-08) iterates `sources[]` from
 * `./registry` via Promise.allSettled and NEVER imports concrete adapter
 * modules directly. Adding a new source = create one file under
 * `src/lib/sources/<name>.ts` exporting a SourceAdapter, then append to
 * the array in `./registry`.
 */
export interface SourceAdapter {
  readonly key: string;
  readonly displayName: string;
  fetch(): Promise<Alert[]>;
}
