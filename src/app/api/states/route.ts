/**
 * GET /api/states — public read-path edge route (REQ-S2.10).
 *
 * Reads from Upstash via getSnapshot(); on miss returns 503 with
 * `{ error: "snapshot_unavailable" }` (DB read-through fallback deferred to P6).
 * On hit, validates against StateSnapshotsResponseSchema (length-27 contract,
 * mitigates T-02-15) and serves JSON. On schema mismatch returns 502.
 *
 * Edge runtime — pino is BANNED (D-03 + ESLint guard). Uses src/lib/log/edge.ts.
 */
import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/cache/upstash";
import { StateSnapshotsResponseSchema } from "@/lib/api/schemas";
import { logger } from "@/lib/log/edge";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  try {
    const cached = await getSnapshot();
    if (!cached) {
      logger.warn("api.states.miss", { durationMs: Date.now() - t0 });
      return NextResponse.json({ error: "snapshot_unavailable" }, { status: 503 });
    }
    const parsed = StateSnapshotsResponseSchema.parse(cached);
    logger.info("api.states.ok", { durationMs: Date.now() - t0, count: parsed.length });
    return NextResponse.json(parsed, { status: 200 });
  } catch (err) {
    logger.error("api.states.error", err, { durationMs: Date.now() - t0 });
    return NextResponse.json({ error: "snapshot_corrupt" }, { status: 502 });
  }
}
