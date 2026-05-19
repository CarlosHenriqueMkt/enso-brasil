# Phase 5 Dependency Security Audit

**Date:** 2026-05-18
**Auditor:** general-purpose subagent (npm registry + maintainer cross-check)
**Source:** RESEARCH §Package Legitimacy Audit + plan 01 Task 0
**Method:** Direct npm registry API (`registry.npmjs.org`) for metadata, `api.npmjs.org/downloads` for weekly downloads, repository-field cross-check against expected GitHub orgs.

## Summary

- **Total packages audited:** 11 (10 from plan 01 + `@carolinabigonha/br-atlas`)
- **BLOCKER:** 0
- **HIGH:** 0
- **MEDIUM:** 2 (`react-simple-maps` stale + single maintainer; `topojson-client` 6+ years since last release)
- **LOW:** 8
- **Not on npm:** 1 (`@carolinabigonha/br-atlas` — must vendor TopoJSON file from GitHub raw, no install)
- **Recommendation:** **APPROVE-WITH-MITIGATIONS** — install all 10 npm packages with `pnpm install --frozen-lockfile` in CI; pin `react-simple-maps@3.0.0` exactly; vendor `br-atlas` TopoJSON as a static asset rather than installing.

No CVE-class issues, no install scripts (`preinstall`/`postinstall`/`install` all null on every package), all licenses permissive (MIT / ISC / Apache-2.0 / MPL-2.0).

## Per-package findings

### 1. `date-fns@^4.1.0` (resolves to `4.2.1`)

- **Publisher / org:** `kossnocorp` (Sasha Koss, founder of date-fns project) — official
- **Repo:** `github.com/date-fns/date-fns` — matches
- **Weekly downloads:** ~87M (ubiquitous)
- **Last publish:** 2026-05-18 (today — actively maintained)
- **License:** MIT
- **Install scripts:** none
- **Direct deps:** 0 (zero-dep)
- **Maintainer bus factor:** 1 listed on npm, but org has wider GitHub contributors
- **Signed commits / provenance:** npm signatures present; no SLSA `--provenance` attestation
- **Versions:** 206
- **Risk:** **LOW** — canonical package, zero-dep, MIT, actively shipping.

### 2. `@date-fns/tz@^1.2.0` (resolves to `1.4.1`)

- **Publisher:** `kossnocorp` (same as date-fns) — confirmed official companion, not third-party
- **Repo:** `github.com/date-fns/tz` — date-fns org
- **Weekly downloads:** ~25.5M
- **Last publish:** 2025-08-12 (within 12mo)
- **License:** MIT
- **Install scripts:** none; zero deps
- **Versions:** 17
- **Signed:** yes (npm sigs); no provenance
- **Risk:** **LOW** — official v1.x replacement for legacy `date-fns-tz`. Confirmed not typosquat.

### 3. `react-simple-maps@^3.0.0` (resolves to `3.0.0`)

- **Publisher:** `zimrick` — historic maintainer at `zcreativelabs`
- **Repo:** `github.com/zcreativelabs/react-simple-maps` — matches expected org
- **Weekly downloads:** ~592k (mature)
- **Last publish:** 2022-07-25 (**~3.8 years stale**)
- **License:** MIT
- **Install scripts:** none
- **Direct deps:** `d3-geo`, `d3-selection`, `d3-zoom`, `topojson-client` (all d3 ecosystem — low risk)
- **Maintainer bus factor:** **1 on npm** (zimrick) — fragile
- **Versions:** 54
- **Signed:** yes; no provenance
- **Risk:** **MEDIUM** — confirmed legitimate `zcreativelabs` package and v3 is the latest major, but two yellow flags: (a) single npm maintainer, (b) no release in ~3.8 years. Stable surface (SVG components) mitigates abandonment risk for v1. **Mitigation:** pin to exact `3.0.0`; document fork-plan if maintainer disappears; consider migrating to a maintained alternative in M2+ if needed.

### 4. `topojson-client@^3.1.0` (resolves to `3.1.0`)

- **Publisher:** `mbostock` (Mike Bostock, creator of D3 / Observable) — canonical
- **Repo:** `github.com/topojson/topojson-client` — matches
- **Weekly downloads:** ~4.3M
- **Last publish:** 2019-11-06 (**~6.5 years stale**)
- **License:** ISC
- **Install scripts:** none
- **Direct deps:** `commander` (CLI lib — for `topo2geo` binary, not used in our import path)
- **Maintainer bus factor:** 1 (mbostock), but stable mathematical lib; effectively "done"
- **Versions:** 8
- **Signed:** yes
- **Risk:** **MEDIUM** — long since last publish, but the package is fundamentally feature-complete (TopoJSON → GeoJSON is a closed spec). High download count + Bostock authorship = trustworthy. **Mitigation:** none required for v1; monitor advisories.

### 5. `d3-geo@^3.1.1` (resolves to `3.1.1`)

- **Publisher:** `mbostock` + `recifs` — D3 org maintainers
- **Repo:** `github.com/d3/d3-geo` — matches
- **Weekly downloads:** ~17.5M
- **Last publish:** 2024-03-12 (within 24mo)
- **License:** ISC
- **Install scripts:** none
- **Direct deps:** `d3-array`
- **Maintainer bus factor:** 2
- **Risk:** **LOW** — canonical D3 module.

### 6. `@lhci/cli@^0.14.0` (latest `0.15.1` — caret will resolve to 0.14.x)

- **Publisher:** `paulirish`, `patrickhulce`, `hoten`, `adamraine` — Google Chrome team
- **Repo:** `github.com/GoogleChrome/lighthouse-ci` — confirmed official
- **Weekly downloads:** ~1.29M
- **Last publish:** 2025-06-25 (within 12mo)
- **License:** Apache-2.0
- **Install scripts:** none
- **Direct deps:** 15 (Lighthouse + Express + Yargs + Puppeteer-chain) — large transitive tree, but dev-only
- **Maintainer bus factor:** 4 (Google-backed)
- **Risk:** **LOW** — official `GoogleChrome` org. Dev-only, never ships to production.

### 7. `@axe-core/playwright@^4.10.0` (latest `4.11.3`)

- **Publisher:** `dqlabs`, `wilcofiers`, `dylanb`, `npmdeque` — Deque Labs (axe-core authors)
- **Repo:** `github.com/dequelabs/axe-core-npm` — confirmed
- **Weekly downloads:** ~4.5M
- **Last publish:** 2026-04-30 (active)
- **License:** MPL-2.0 (weak copyleft — file-level, OK for our usage as we don't modify axe sources)
- **Install scripts:** none
- **Direct deps:** `axe-core` only
- **Maintainer bus factor:** 4
- **Signed:** yes; **SLSA `--provenance` attestation present** (only package in this audit with provenance)
- **Risk:** **LOW** — best provenance posture of the set. MPL-2.0 is fine for unmodified consumption.

### 8. `@types/react-simple-maps` (resolves to `3.0.6`)

- **Publisher:** `types` (DefinitelyTyped bot) — official
- **Repo:** `github.com/DefinitelyTyped/DefinitelyTyped`
- **Weekly downloads:** ~359k
- **Last publish:** 2024-07-29
- **License:** MIT; no install scripts
- **Deps:** `@types/react`, `@types/d3-geo`, `@types/d3-zoom`, `@types/geojson`
- **Risk:** **LOW** — official `@types` scope. (Note: package DOES exist; RESEARCH not over-specified.)

### 9. `@types/topojson-client` (resolves to `3.1.5`)

- Publisher `types`; DefinitelyTyped; MIT; last publish 2024-09-16; deps: `@types/geojson`, `@types/topojson-specification`. **Risk: LOW.**

### 10. `@types/d3-geo` (resolves to `3.1.0`)

- Publisher `types`; DefinitelyTyped; MIT; last publish 2023-11-12; weekly ~13M; dep `@types/geojson`. **Risk: LOW.**

### 11. `@carolinabigonha/br-atlas` — **NOT ON NPM (404)**

- **Status:** Package does **not exist on npm** under this scope. The asset lives only at `github.com/carolinabigonha/br-atlas` as a TopoJSON file repo.
- **Action:** **Must vendor.** Download the specific TopoJSON file (e.g. `br-states.json`) at a pinned commit SHA into `public/maps/` (or equivalent). Do **not** add to `package.json`. This eliminates install-script risk entirely.
- **License check (out-of-band):** The br-atlas repo is MIT per its README — verify the LICENSE file at the pinned SHA and record it in `THIRD_PARTY_NOTICES.md`.
- **Risk:** **LOW** once vendored at a pinned SHA with checksum recorded; would have been HIGH if installed from an arbitrary tarball.

## Cross-cutting findings

- **Install scripts:** Zero packages declare `preinstall`, `install`, or `postinstall`. This is the single biggest supply-chain win — no arbitrary code runs at `pnpm install` time.
- **npm signatures:** All 10 packages have npm registry signatures. Only `@axe-core/playwright` has a true SLSA **`--provenance`** attestation (build-system-signed).
- **Licenses:** All permissive — MIT (7), ISC (2), Apache-2.0 (1), MPL-2.0 (1). No GPL/AGPL/SSPL. No custom or missing licenses.
- **Stale-release flags:** `topojson-client` (6.5y) and `react-simple-maps` (3.8y) are the two stale packages. Both are feature-complete in practice; track in `RISKS.md` for M2.
- **Pinning policy:** Recommend committing `pnpm-lock.yaml` and running `pnpm install --frozen-lockfile` in CI / GitHub Actions ingest runner. Use exact pin `react-simple-maps: "3.0.0"` (no caret) given the single-maintainer + stale-release combo.
- **`pnpm audit --prod` baseline:** Run immediately after first install; record output at `.planning/phases/05-cemaden-dashboard-ui/05-PNPM-AUDIT-BASELINE.txt`. Expected clean given zero-CVE current state.
- **Renovate / Dependabot:** Recommend enabling Dependabot for `npm` ecosystem with weekly schedule + grouped minor/patch PRs; treat `react-simple-maps` major bumps as manual-review-only.

## Mitigations (action checklist for Wave 0)

1. **Pin exact:** Change `react-simple-maps: "^3.0.0"` → `"3.0.0"` (no caret) in `package.json`.
2. **Vendor br-atlas:** Add a script `scripts/fetch-br-atlas.mjs` that downloads `br-states.json` from a pinned commit SHA into `public/maps/` and verifies a SHA-256 checksum. Commit the resulting JSON. Do NOT add to dependencies.
3. **Frozen lockfile in CI:** Ensure ingest workflow uses `pnpm install --frozen-lockfile`.
4. **Provenance preference:** Where alternatives exist with SLSA provenance (only `@axe-core/playwright` in this set), prefer them. Document this as a tie-breaker in CONTRIBUTING.
5. **Track stale packages:** Add `react-simple-maps` and `topojson-client` to `.planning/RISKS.md` with a fork-or-replace plan if either receives a CVE.
6. **THIRD_PARTY_NOTICES.md:** Generate from `pnpm licenses list` and commit; include MPL-2.0 attribution for `@axe-core/playwright`.
7. **No new packages without re-audit:** Any addition to Phase 5 deps re-triggers this audit checklist.
