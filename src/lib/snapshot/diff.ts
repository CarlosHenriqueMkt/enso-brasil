/**
 * D-04 — Snapshot diff util.
 *
 * Drives the per-UF revalidatePath('/estado/{uf}') and revalidatePath('/')
 * calls in /api/ingest after a successful refresh.
 *
 * Behavior:
 *  - prev=null (cold cache): every UF in `curr` is reported changed +
 *    rootChanged=true so /api/ingest invalidates everything once.
 *  - prev/curr identical: empty list + rootChanged=false (P2 steady state,
 *    where every UF stays at risk='unknown').
 *  - Partial change: only UFs whose risk level differs are returned.
 *  - Length mismatch (UF missing in prev): treated as changed.
 */
import type { StateSnapshot } from "../api/schemas";

export interface SnapshotDiff {
  changedUFs: string[];
  rootChanged: boolean;
}

export function diffSnapshot(prev: StateSnapshot[] | null, curr: StateSnapshot[]): SnapshotDiff {
  if (!prev) {
    return {
      changedUFs: curr.map((s) => s.uf),
      rootChanged: curr.length > 0,
    };
  }
  const prevByUF = new Map(prev.map((s) => [s.uf, s]));
  const changedUFs: string[] = [];
  for (const c of curr) {
    const p = prevByUF.get(c.uf);
    if (!p || p.risk !== c.risk) changedUFs.push(c.uf);
  }
  return { changedUFs, rootChanged: changedUFs.length > 0 };
}
