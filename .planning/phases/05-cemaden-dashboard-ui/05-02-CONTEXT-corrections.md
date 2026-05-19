# Phase 5 — CONTEXT.md Corrections

## D-04 (REWRITTEN 2026-05-18)

<rewrites decision="D-04" original="`05-CONTEXT.md` lines 28">

**Original (now superseded):**

> D-04 — BRT timestamp handling. CEMADEN naive timestamps assumed UTC-3 no DST … adapter explicitly applies + -03:00 offset; throws if source migrates to TZ-aware format.

**Corrected (LOCKED 2026-05-18, evidence in `05-cemaden-endpoint-capture.md`):**

> D-04 — CEMADEN timestamps are UTC. The payload root `atualizado` field self-labels as `"DD-MM-YYYY HH:MM:SS UTC"`. Per-alert fields (`datahoracriacao`, `ult_atualizacao`) are naive `"YYYY-MM-DD HH:MM:SS.fff"` but in the same payload as the UTC-labelled root — so they are parsed as UTC. Adapter outputs ISO-8601 `Z` strings (e.g. `2026-05-13T22:13:19.090Z`) into `Alert.valid_from` / `Alert.valid_until`. Presentation layer (`/estado/{uf}` and home cards) converts to `America/Sao_Paulo` via `@date-fns/tz`. For UFs with non-Brasília civil time (AC = `America/Rio_Branco` UTC-5, parts of AM = `America/Manaus` UTC-4), use the IANA zone for that UF. Adapter THROWS if any timestamp parses to a date before 2010 or after now+30days (drift tripwire).

**Reasoning for flip:** Endpoint capture 2026-05-18 verified UTC labelling. Applying -03:00 offset blindly would have skewed AM/AC timestamps by 1–2 hours in the wrong direction.

</rewrites>

## Audit trail

- Inline SUPERSEDED marker present in `05-CONTEXT.md` (line 30) — points readers to this file as the canonical override.
- Plan 03 (CEMADEN adapter) docblock cites this corrections file when implementing UTC parsing and per-UF tz overrides.
- Plan-review remediation 2026-05-18 (H-1): close audit-trail leak by ensuring both the inline marker and this corrections file co-exist.
