import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time Bearer-token verification (CONTEXT Implementation Notes line 108).
 * Mitigates timing attack on /api/ingest + /api/archive token compare (T-02-20).
 *
 * Buffer-length normalization: pads the shorter buffer to the longer length so
 * `timingSafeEqual` doesn't throw on length mismatch and doesn't leak length
 * differences via early-return branching. The final equality includes an
 * integer-equal length check (constant-time, not data-dependent).
 *
 * Reusable by /api/archive in plan 02-09 (same token-gated invariant).
 */
export function verifyBearerToken(req: Request, expected: string): boolean {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return false;
  const provided = auth.slice("Bearer ".length);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const len = Math.max(a.length, b.length, 1);
  const aPad = Buffer.alloc(len);
  const bPad = Buffer.alloc(len);
  a.copy(aPad);
  b.copy(bPad);
  // timingSafeEqual on equal-length padded buffers + integer-equal length check.
  // Both branches always execute regardless of token contents.
  const sameBytes = timingSafeEqual(aPad, bPad);
  const sameLen = a.length === b.length;
  return sameBytes && sameLen;
}
