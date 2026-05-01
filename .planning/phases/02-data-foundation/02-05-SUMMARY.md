# Plan 02-05 — Source Adapter + Stub · SUMMARY

**Plan:** `02-05-source-adapter-and-stub-PLAN.md`
**Status:** complete
**Wave:** 2 (parallel)
**Tasks:** all

## Commits

- `9c54d02` feat(02-05): add SourceAdapter interface, Alert zod schema, deterministic payload_hash

## Files written

- `src/lib/sources/types.ts` — `interface SourceAdapter { key: string; displayName: string; fetch(): Promise<Alert[]>; }`. Re-exports `Alert` type from `./schema` for ergonomic single-import in adapters.
- `src/lib/sources/schema.ts` — zod `Alert` schema; deterministic `payload_hash(alert)` via sha256 of canonical JSON (sorted keys; `fetched_at` excluded so dedup survives across cron ticks).
- `src/lib/sources/registry.ts` — flat array `sources: SourceAdapter[]` and derived `sourceDisplayNames: Record<string, string>`. Adding a source = append one entry. `displayNames` map is edge-safe (no fs imports), consumed by 02-07 `/api/health`.
- `src/lib/sources/stub.ts` — implements `SourceAdapter` with `key: "stub"`. Default loads `tests/fixtures/sources/stub-default.json` via `node:fs` (Node-only). `STUB_FIXTURE_PATH` env override resolved relative to `process.cwd()`. Fixture validated against `Alert[]` zod schema before return.
- `src/lib/sources/{schema,stub,registry}.test.ts` — unit tests cover zod parse failures, fixture override path, payload_hash determinism, registry shape.
- `tests/fixtures/sources/stub-default.json` — 3 states (SP/RJ/AM) × 1 alert each (queimada/enchente/estiagem; CEMADEN/INMET vocabulary verbatim).
- `tests/fixtures/sources/all-red.json` — alternate fixture: all 27 UFs at `red` severity for manual demo of pico de desastre.
- `tests/fixtures/sources/README.md` — canonical schema docs for contributors authoring additional fixtures.

## Verification

- `pnpm exec tsc --noEmit` → exit 0
- `pnpm test` → all source tests pass; payload_hash determinism asserted
- `grep -r "import.*Stub\|import.*Cemaden\|import.*Inmet" src/ --include="*.ts" | grep -v "src/lib/sources/registry.ts"` → zero matches (REQ-S2.04 grep gate)
- `grep -rE "fetch\(" src/lib/sources/` → zero matches (REQ-S2.03 grep gate; stub uses `node:fs` not network)

## Deviations

1. **Hazard-kind taxonomy locked verbatim per CEMADEN/INMET vocabulary** (sketch-findings hard rule): `queimada` not `incêndio`, `estiagem` not `seca`, `enchente` not `inundação`. Fixture data audited.
2. **Stub uses `node:fs` synchronous read** for simplicity; not edge-safe by design. Stub adapter only runs in `/api/ingest` (Node runtime), so this is correct. `registry.ts` imports stub but the import graph is tree-shaken: only `key` + `displayName` referenced from edge routes via `sourceDisplayNames` const.
3. **Cross-plan stage contamination during parallel Wave 2.** Commit `9c54d02` initially landed some files via a parallel executor's stage; subsequent inline orchestrator audited byte-identical output. Documented in `02-02-SUMMARY.md` Process Risk section.

## REQ coverage

- **REQ-S2.04** ✓ — interface + flat registry; orchestrator (02-08) iterates `sources[]` with `Promise.allSettled`
- **REQ-S2.05** ✓ — stub default fixture + `STUB_FIXTURE_PATH` override
- **REQ-S2.09** ✓ (partial — schema definition; orchestrator runs validation + drift counter in 02-08)

## Anti-patterns avoided

- ❌ Direct `fetch()` in adapter modules (gate enforced)
- ❌ Concrete adapter imports outside `registry.ts` (gate enforced)
- ❌ Hazard-kind paraphrasing (locked verbatim)
- ❌ payload_hash including `fetched_at` (would defeat dedup across cron ticks)
