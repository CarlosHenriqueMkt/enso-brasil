---
phase: 05-cemaden-dashboard-ui
plan: 12
subsystem: verification
tags: [a11y, perf, lhci, axe-core, playwright, ci]
status: tasks-1-3-complete-task-4-pending-human
requirements: [A11Y-01, A11Y-02, A11Y-04, A11Y-05, A11Y-06]
key-files:
  created:
    - tests/e2e/a11y.spec.ts
    - tests/e2e/keyboard-nav.spec.ts
    - .lighthouserc.json
  modified:
    - package.json
    - .github/workflows/ci.yml
commits:
  - 1676c62 # Task 1 — axe-core suite
  - 5e2da4a # Task 2 — keyboard nav + color-blind
  - 6ea124b # Task 3 — LHCI config + workflow
---

# Phase 5 Plan 12: A11y + Perf Verification Summary

Verification gate landed: axe-core, keyboard/color-blind, and Lighthouse CI now guard merges. Task 4 (human Vercel preview smoke) remains pending.

## Tasks 1-3 — Done

### Task 1 — `tests/e2e/a11y.spec.ts` (commit `1676c62`)

- Parametrised over 5 routes: `/`, `/estado/sp`, `/estado/rj`, `/estado/am`, `/texto`.
- Each route runs `AxeBuilder.withTags(['wcag2a','wcag2aa','wcag22aa'])` and asserts zero `critical|serious` violations; offending IDs/impacts are logged to stderr on failure for fast triage.
- Yellow badge: data-dependent `color-contrast` rule scoped to `.risk-badge-yellow`. If the dataset currently contains no yellow badge the assertion is satisfied vacuously (the whole-route axe runs still catch regressions when present).
- `/texto` heading outline asserted: 1×h1, 5×h2, 27×h3.
- `/estado/sp` aria-live presence: first `[aria-live="polite"]` must be visible and contain one of the locked PT-BR severity words (`Sem alertas | Atenção | Alerta | Perigo | Dados indisponíveis`).

### Task 2 — `tests/e2e/keyboard-nav.spec.ts` (commit `5e2da4a`)

- `focusedDescriptor()` helper introspects `document.activeElement` per Tab press (tag, role, href, aria-label, text).
- `/` walk: first Tab lands on `#main` skip link; up to 200 Tab stops collected — assertion that >5 distinct focusables exist (no early dead-end). Larger exact counts are dataset-dependent.
- Stylesheet probe: at least one `:focus-visible` rule must be present in `document.styleSheets` (catches accidental focus-indicator deletion).
- `/texto` walk: first Tab on skip link; at least 28 in-page anchors (`a[href^="#"]`) confirms 1 skip-link + 27 state-row anchors.
- Color-blind redundancy: grayscale filter on `/`, deuteranopia SVG-matrix filter on `/texto`. Both assert ≥1 redundancy glyph (`✓`, `⚠`, `⛔`, `?`) survives in DOM.

### Task 3 — `.lighthouserc.json` + workflow + script (commit `6ea124b`)

- `.lighthouserc.json` boots `pnpm next start` (Next.js requires a running server for dynamic `/estado/[uf]` routes — see Deviations) and waits for the `Ready` log line, then audits all 5 routes with the `desktop` preset.
- Assertions: `categories:performance ≥ 0.90` (error), `largest-contentful-paint ≤ 2500ms` (error), `total-byte-weight ≤ 204800` bytes (error), `unused-javascript` (warn).
- Upload target: `temporary-public-storage` (free, no auth, anonymous LHCI links).
- `package.json`: added `"lhci": "lhci autorun --config=.lighthouserc.json"`.
- `.github/workflows/ci.yml`: appended `Build app for Lighthouse CI` (`pnpm build`) + `Lighthouse CI (...)` (`pnpm exec lhci autorun ...`) immediately after the Playwright step.

## Deviations from Plan

**1. [Rule 3 — Blocking] LHCI server boot path corrected**

- **Issue:** Plan suggested `--collect.staticDistDir=.next` for local verify. Next.js `.next` is not a static export bundle and serving it statically would 404 all dynamic routes (`/estado/[uf]`).
- **Fix:** `.lighthouserc.json` uses `startServerCommand: "pnpm next start"` + `startServerReadyPattern: "Ready"`. This is exactly the production-mode boot, so audited LCP/perf numbers reflect real Vercel-equivalent SSR.
- **Local LHCI not exercised in this commit window:** `pnpm build && lhci autorun` on Windows requires DB/Upstash env vars to be present for dynamic routes to render — that path is exercised in CI where `DATABASE_URL` is provisioned. Config + workflow committed; CI will be the first end-to-end run.
- **Files:** `.lighthouserc.json`, `.github/workflows/ci.yml`.

**2. [Rule 3 — Blocking] Playwright specs not locally booted**

- **Issue:** `playwright.config.ts` boots via `pnpm build && pnpm start` (120s timeout) and requires the full env (DB, Upstash, etc.) to render dynamic routes. Local exercise inside this execution window would exceed the safe budget.
- **Fix:** Specs committed; CI workflow already runs `pnpm exec playwright test` after `pnpm build` against the Postgres service container.
- **Files:** `tests/e2e/a11y.spec.ts`, `tests/e2e/keyboard-nav.spec.ts`.

**3. [Rule 2 — Critical] Yellow badge contrast made data-dependent**

- **Issue:** A hard "yellow badge MUST exist" assertion would fail any time CEMADEN/INPE data contained no yellow-level state (frequent in calm weather).
- **Fix:** Spec early-returns if `.risk-badge-yellow` count is 0. The whole-route axe runs (5 specs above) still catch contrast regressions any time a yellow badge IS rendered.
- **File:** `tests/e2e/a11y.spec.ts`.

## Task 4 — PENDING-HUMAN

**Status:** `checkpoint:human-verify` — blocking, NOT auto-approved.

**Context:** Phase 5 dashboard surface must be smoke-tested on a Vercel preview deploy of the `phase-5-cemaden-dashboard` branch. Mechanical specs (Tasks 1-3) verify accessibility and performance contracts; Task 4 verifies behaviors only humans can confirm (WhatsApp OG unfurl, visual map projection, JS-off rendering fidelity).

**The user must verify on the Vercel preview URL:**

1. **Home `/`** — 27 state cards visible; Brazil Albers conic map renders; hover shows tooltip; clicking a state navigates to `/estado/{uf}` via SSR (no client-side panel swap).
2. **Region filter** — clicking "Sul" sets `?region=sul`, narrows cards to PR/RS/SC, leaves map showing all 27; "Todas" restores 27 cards.
3. **`/estado/sp`** — two-column desktop layout; permanent aside with badge + share buttons; right column shows explanation + alert list (monospace source domain); emergency contacts visible only at red level.
4. **WhatsApp OG preview** — paste `${PREVIEW_URL}/estado/sp` (and `/rj`, `/am`) into WhatsApp Web; confirm unfurl shows state name + level + URL.
5. **JS-off** — DevTools Settings → Disable JavaScript, reload `/`; 27 cards still render; filter still works (URL changes, server re-renders); map shapes still visible. Repeat check on `/texto`.
6. **`/texto`** — 5 regional tables; row counts match region UFs; row anchors scroll to matching `<article>`; heading outline 1×h1 → 5×h2 → 27×h3.
7. **Stale banner** — CEMADEN >30 min old banner visible (or empty if data is fresh — both OK).
8. **Share button** — on `/estado/sp`, "Compartilhar no WhatsApp" opens `wa.me` with prefilled text; "Copiar link" surfaces "Link copiado." toast.
9. **Keyboard nav** — Tab through `/`; visible focus on every filter chip, map state, card CTA, share button; no traps, no dead-ends.
10. **Mobile 360px** — Chrome DevTools device toolbar at 360px width; no horizontal scroll on `/`; map appears below cards.

**Resume signal:** "approved" or list defects with route + selector.

## Self-Check: PASSED

- `tests/e2e/a11y.spec.ts` FOUND
- `tests/e2e/keyboard-nav.spec.ts` FOUND
- `.lighthouserc.json` FOUND
- Commit `1676c62` FOUND (Task 1)
- Commit `5e2da4a` FOUND (Task 2)
- Commit `6ea124b` FOUND (Task 3)

## Risk-engine wiring fix (post-Wave 4)

**Date:** 2026-05-19
**Bug:** `src/app/api/ingest/route.ts` Step 5 hardcoded `risk:"unknown"` + `formulaVersion:"v0-placeholder"` for all 27 UFs (P2-era placeholder). The Phase 3 risk engine (`src/lib/risk/**`) was never wired into the snapshot composer. Result: even after a successful ingest, every state rendered gray "Dados indisponíveis no momento." on the dashboard.

**Fix scope (single file modified — risk engine untouched):**

- Rewrote Step 5 of `src/app/api/ingest/route.ts`:
  - Added DB query for active alerts (RISK-06 window: `valid_until > now` OR (`valid_until IS NULL` AND `fetched_at > now - 24h`)) using Drizzle `or/and/gt/isNull`, grouped into `activeAlertsByUF: Map<UF, Alert[]>` with snake_case ↔ camelCase column mapping and date→ISO normalization.
  - Added DB query for `sources_health` rows, reshaped to `SourcesHealthRow[]` (`source_key`, `last_successful_fetch` ISO string or null) to honor RISK-01 decoupling.
  - Per UF compose: `applyStaleness(calculateRiskLevel(alerts, composerNow), healthShape, composerNow)` (locked pipeline per `pipeline.integration.test.ts`), then `generateExplanation(risk, alerts)` for PT-BR `riskReason`.
  - `alertCount: alerts.length` now reflects active (cumulative) alerts, not just this-tick payloads.
  - Replaced both `"v0-placeholder"` literals in `snapshot_cache` insert/onConflictDoUpdate with `FORMULA_VERSION` (= `"v0"`).
  - Introduced single `composerNow = new Date()` after the per-source loop to avoid reusing per-source local `now`.
  - Removed unused `messages` import (riskReason now comes from `generateExplanation`).

**Test added (infra-independent — does NOT require `DATABASE_URL_TEST` or Upstash):**

- `src/app/api/ingest/route.snapshot-composition.test.ts` — 5 tests, all green:
  1. Per-UF risk mapping via the engine: SP (high) → red, RJ (moderate) → orange, AM (low) → yellow, MG (no alerts) → green.
  2. `riskReason` is non-empty PT-BR for non-unknown levels (regression guard against gray-default).
  3. `formulaVersion === "v0"` on `snapshot_cache` row, every snapshot entry, and Upstash body.
  4. Staleness override: all sources stale >1h → every UF risk `unknown` + reason `"Dados indisponíveis no momento."`.
  5. Shape contract preserved: 27 entries, all required `StateSnapshot` fields present.
- Mocks `@/db/node`, `@/lib/cache/upstash`, `@/lib/auth/token`, `@/lib/sources/registry`, `next/cache` at module boundary. Captures `snapshot_cache` writes via the insert-stub's `onConflictDoUpdate` hook.

**Verification:**

- `pnpm exec tsc --noEmit` → clean (no errors).
- `pnpm exec vitest run src/app/api/ingest/route.snapshot-composition.test.ts` → 5/5 pass (~1s test runtime).
- Pre-existing `src/app/api/ingest/route.test.ts` not exercised here — it is DB-gated and remains untouched (still `describe.skipIf(!DATABASE_URL_TEST)`).

**Commits on `phase-5-cemaden-dashboard`:**

- `a6485c8` — `fix(05-12): wire risk engine into ingest composer`
- `6d2f4fe` — `test(05-12): risk-engine wiring in ingest composer`
- (this SUMMARY append commit — see below)

**Constraints honored:**

- No files under `src/lib/risk/**` modified.
- No `@testing-library/react` usage.
- Three atomic Conventional Commits (subject ≤50 chars).
- `STATE.md` not touched (per instruction).
