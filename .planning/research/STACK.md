# Stack Research — ENSO Brasil

**Researched:** 2026-04-28
**Mode:** Ecosystem (greenfield, zero-budget, free-tier hosted)
**Overall confidence:** HIGH on locked stack; MEDIUM-HIGH on open recommendations

## Summary (TL;DR)

Lock the stack as proposed in PROJECT.md with **two critical changes**: (1) **Vercel Hobby cron is once-per-day only** in 2026 — the 15-min ingestion cadence MUST run from **GitHub Actions** (free, generous, every 5 min supported), not Vercel Cron; (2) "Vercel KV" no longer exists as a distinct product — it auto-migrated to **Upstash Redis** in Dec 2024, with a 500K commands/month free tier. Use **Neon Postgres** (not Supabase or Turso) for serverless Postgres with scale-to-zero, **ofetch** as the ingestion HTTP client, **react-simple-maps** as already locked (with a forked React 19 build), and **carolinabigonha/br-atlas** as the IBGE TopoJSON source. Use **Next.js 15.x LTS** (not 16.x bleeding edge) to keep next-intl + 'use cache' interactions stable. Tailwind **v4**, Vitest 3, Playwright 1.5x, ESLint 9 flat config.

## Locked Stack (confirmed)

| Component | Choice | Version (Apr 2026) | Rationale | Confidence |
|---|---|---|---|---|
| Framework | Next.js (App Router) | **15.5.x** (LTS-track) — NOT 16.x | 16.x is current stable but `'use cache'` directive does not yet work seamlessly with next-intl (root-params unshipped). 15.5.x is mature, supports React 19, Turbopack builds beta. | HIGH |
| Runtime React | React 19 | 19.x | Required by Next 15+. | HIGH |
| Language | TypeScript strict | 5.7.x | `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. | HIGH |
| Styling | Tailwind CSS | **v4.x** (Oxide engine) | ~70% smaller production CSS than v3; CSS-first `@theme` config; new projects should start on v4. | HIGH |
| i18n | next-intl | 3.x latest | 2KB bundle, native Server Component support, type-safe keys. Confirmed Next.js 16-compatible (still pin to 15 here). | HIGH |
| Map library | react-simple-maps | 3.x | Locked. 34.8 KB gzipped. Note: original repo low maintenance — pin version, vendor-fork if needed. For React 19 compat use `@vnedyalk0v/react19-simple-maps` if upstream errors. | MEDIUM |
| Brazil geometry | IBGE via `carolinabigonha/br-atlas` (TopoJSON) | 2024 IBGE shapes | Official IBGE source, MIT-style permissive, prebuilt TopoJSON for `uf` (states). Use simplified `br-states.json` (~50–80 KB) for 3G budget. EPSG:4326. | HIGH |
| Hosting | Vercel Hobby | n/a | Locked. 100 GB bandwidth, 1M function invocations, 4 hr Active CPU/month. | HIGH |
| Cron | **GitHub Actions** (PRIMARY) — Vercel Cron is 1×/day max on Hobby | n/a | Vercel Hobby cron is daily-only in 2026. GH Actions supports `*/15 * * * *` for free. Worker calls a protected `/api/ingest` route on Vercel. | HIGH |
| Database | **Neon Postgres** | latest serverless | 0.5 GB storage / 100 CU-hours/month, scale-to-zero (5-min idle), branching. Workload (thousands of alert rows, read-heavy via cache) fits comfortably. | HIGH |
| Cache | **Upstash Redis** (formerly "Vercel KV") | latest | Vercel KV was migrated to Upstash in Dec 2024. Free tier: 500K commands/month, 256 MB. Edge-runtime SDK. | HIGH |
| HTTP client | **ofetch** (unjs) | 1.4.x | Built-in retry, timeout, status-code retry list, isomorphic, TS-first. Lighter than `got`, smarter than raw fetch. | HIGH |
| Testing — unit | Vitest | 3.x | 5–10× faster than Jest; shares Vite config; native ESM/TS. | HIGH |
| Testing — e2e | Playwright | 1.5x | Replaced Cypress as default in 2026. First-class TS, CI-friendly, low flake. | HIGH |
| Lint/format | ESLint 9 (flat config) + Prettier 3 + Husky 9 + lint-staged | latest | Standard 2026 hygiene. Use `@next/eslint-plugin-next`, `eslint-plugin-tailwindcss`. | HIGH |
| CI | GitHub Actions | n/a | Matrix job: lint → typecheck → vitest → playwright. Cache `~/.npm` and Playwright browsers. | HIGH |

## Free-Tier Reality Check

### Vercel Hobby (2026)

| Limit | Value | Risk for ENSO Brasil |
|---|---|---|
| Bandwidth | 100 GB/month | LOW — site is mostly static dashboard + cached JSON. With ISR + edge caching of state data (15-min TTL), comfortable headroom even at 100k visits/month. |
| Function invocations | 1M/month | LOW — frontend is mostly static. API ingest hits external sources; client reads cached snapshots. |
| Active CPU | 4 hours/month | MEDIUM — must keep ingestion lean. Move heavy parsing to GH Actions workers if needed. |
| **Cron jobs** | **2 jobs, ONCE PER DAY** | **HIGH BLOCKER** — kills the 15-min ingestion plan. **Mitigation: run cron from GitHub Actions** hitting a protected Vercel endpoint, or doing the fetch + DB write directly from the Action. |
| Edge config / KV | Use Upstash | Adequate. |

### Upstash Redis Free Tier
- 500K commands / month (~16K/day average)
- 256 MB storage
- 27 states × 4 sources × 96 polls/day = ~10,400 writes/day if naive. Fits, but tight. **Mitigation: write only on change (diff snapshots), aggregate per-state.**

### Neon Free Tier
- 0.5 GB / 100 CU-hours per month per project
- Scale-to-zero after 5 min idle
- Cold start ~500 ms — acceptable for read-heavy dashboard backed by cache
- Branching free → preview deployments per PR

### Cron Cadence Math (with GitHub Actions)
- 4 sources × 27 states polled every 15 min from a single GH Actions runner
- ~96 runs/day × ~30s each = ~50 minutes/day = 25 hours/month of runner time
- **GH Actions free tier: 2,000 minutes/month for private repos, UNLIMITED for public repos.** Public OSS repo → no cap. HIGH confidence headroom.

### Fallback Plan (if a tier is exceeded)
1. Bandwidth → enable Cloudflare in front of Vercel.
2. Cron exceeded → GH Actions (already primary).
3. Neon CU exceeded → swap to **Turso** (5 GB, 500M row reads/month free).
4. Upstash exceeded → drop cache layer, rely on Vercel data cache + ISR.

## Open Recommendations (idea doc was vague)

### 1. Database: **Neon** > Supabase > Turso
- **Neon** wins: serverless Postgres, scale-to-zero, branching for PR previews, fits Drizzle/Kysely cleanly. No need for Supabase auth/storage/realtime (we have none).
- Supabase: free tier pauses inactive projects (worse for a public dashboard). Bundles things we don't need.
- Turso (libSQL/SQLite): excellent free tier but SQL dialect quirks, no PostGIS if we ever want spatial queries. Keep as fallback.

### 2. ORM/query builder: **Drizzle ORM** (not Prisma)
- Prisma is overkill — generates a heavy client, slow cold starts on Vercel, schema migration friction.
- Drizzle: lightweight, SQL-first, edge-compatible, ~10× faster cold start. Pairs perfectly with Neon's serverless driver `@neondatabase/serverless`.
- Confidence: HIGH.

### 3. HTTP client: **ofetch** (unjs)
- Native fetch lacks retry/timeout. `got` is Node-only (heavy). `ofetch` is isomorphic, TS-first, has `retry`, `retryDelay`, `retryStatusCodes`, `timeout` built in.
- Wrap each source in `createFetch({ baseURL, retry: 3, retryDelay: 500, timeout: 10000 })` for consistent ingestion behavior.
- Confidence: HIGH.

### 4. Cache: **Upstash Redis** (no real choice — Vercel KV no longer exists)
- Use `@upstash/redis` (REST-based, Edge-runtime compatible).
- For pure HTTP-cache-style needs, also leverage Next.js `unstable_cache` + ISR `revalidate` on route segments. Two layers: Next.js cache for HTTP responses, Upstash for cross-runtime shared state and rate-limit counters.

### 5. Map library: **react-simple-maps** (locked) with caveats
- 34.8 KB gz; reasonable for 3G when code-split into a client component (`dynamic(() => import('./BrazilMap'), { ssr: false })`).
- Original repo lightly maintained — pin exact version. If React 19 issues arise, swap to community fork `@vnedyalk0v/react19-simple-maps`.
- Alternatives considered: raw d3-geo (more code to write, lighter bundle ~20 KB but no React component layer), datamaps (deprecated, jQuery era — REJECT).

### 6. TopoJSON source: `carolinabigonha/br-atlas`
- Generates from official IBGE shapefiles. Use `br-states.json` at "low" resolution (≤80 KB) for the default view. Ship as a static asset under `/public/geo/br-states.json` — cached at the edge forever (immutable filename + version).
- License: permissive (verify MIT in final commit). Cite IBGE source as origin in attribution.

### 7. Form/state: **No form library, no Zustand/Redux**
- v1 is read-only dashboard. Use React Server Components + URL state (`searchParams`) for selected state. No client store needed.

### 8. Validation: **Zod** 3.x (or 4 if released)
- Validate every external API response before persisting. Required for ingestion safety.

### 9. Observability (free): **Vercel Analytics (free Web Vitals)** + **Sentry free tier** (5K errors/month)
- Plausible Cloud is paid; defer until needed. Self-hosted Plausible adds ops cost — skip in v1.

## What NOT to Use

| Rejected | Why |
|---|---|
| **Mapbox / Google Maps** | Cost, vendor lock-in, requires API keys, overkill for choropleth of 27 polygons. |
| **Nest.js** | Already rejected in PROJECT.md. Cold starts on Render/Fly free tiers, duplicates what Next API routes give us. |
| **Prisma** | Heavy client, slow cold starts on serverless, codegen friction. Drizzle wins for this workload. |
| **Supabase Auth/Realtime/Storage** | Don't need any of it. Adds free-tier pause risk on inactivity. |
| **Vercel Cron (Hobby)** for 15-min cadence | Hard-capped at 1×/day on Hobby. Use GH Actions. |
| **Vercel KV (as a distinct product)** | Discontinued/migrated to Upstash in Dec 2024. |
| **Cypress** | Playwright is the default in 2026. No new project should pick Cypress. |
| **Jest** | Vitest is faster, ESM-native, shares Vite config. Pick Vitest. |
| **Axios** | Heavy, no native ESM, no edge support. ofetch covers all needs. |
| **datamaps / amCharts free** | Deprecated / restrictive licenses. |
| **Mapbox-gl-js as "just for SVG"** | 200+ KB gzipped, killer on 3G. Hard NO. |
| **Real-time / WebSockets / Pusher / Ably** | 15-min cadence is enough; all add complexity & cost. |
| **Plausible Cloud / GA4** | Paid (Plausible) or privacy-invasive (GA4). Defer analytics; Vercel Analytics free Web Vitals suffices for v1. |
| **Tailwind v3** | v4 is stable, 70% smaller CSS, faster builds. No reason to start on v3. |
| **ESLint 8 / legacy config** | ESLint 9 flat config is standard in 2026. |
| **Husky + commitizen + commitlint full suite** | Husky + lint-staged is enough. Don't over-engineer commit linting. |
| **Pages Router** | App Router only — required for Server Components, `next-intl` setup we want, and modern caching. |

## Risks & Watch-outs (6-month horizon)

1. **react-simple-maps maintenance risk.** Repo has slow commits. If a React minor break lands, swap to community fork or fall back to raw d3-geo + custom React component. *Mitigation: vendor the rendering code into `/lib/map/` so a swap is a 1-day job.*
2. **next-intl + Next.js 16 `'use cache'` interaction.** Stay on 15.x until next-intl + `next/root-params` ship cleanly together. Track amannn/next-intl issues. *Mitigation: pin Next at 15.5.x in v1; bump only when next-intl publishes a "16-ready" release note.*
3. **Upstash 500K commands/month.** A naive "write every poll" pattern blows this budget. *Mitigation: write-on-diff only; use Postgres as truth, Redis only for hot reads + rate-limit + last-update timestamps.*
4. **Vercel Hobby Active CPU (4 hr/month).** Heavy parsing of FIRMS GeoJSON (megabytes) on Vercel functions could exhaust this. *Mitigation: do parsing in GitHub Actions, push compact rows to Neon, let Vercel only serve.*
5. **CEMADEN / INMET API instability.** Real-world Brazilian gov APIs have unannounced outages. *Mitigation: ofetch retry/timeout, last-good-snapshot fallback, gray "Dados indisponíveis" state — already in risk-formula-v0.*
6. **TopoJSON file size on 3G.** Even ~80 KB with full coastline detail can be slow. *Mitigation: serve the simplified states-only TopoJSON; avoid municipalities geometry in v1.*
7. **GitHub Actions schedule drift.** Scheduled workflows can be delayed under high load. *Mitigation: 15-min cadence is forgiving; UI already shows "last updated X min ago".*
8. **Vercel free-tier policy changes.** Vercel has shifted limits before. *Mitigation: keep deployment portable — no Vercel-locked APIs beyond cron (already moved off) and Edge runtime for cache reads.*

## Sources

- [Vercel Hobby Plan limits](https://vercel.com/docs/plans/hobby)
- [Vercel Cron Jobs usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel general limits](https://vercel.com/docs/limits)
- [Upstash Redis pricing & limits](https://upstash.com/pricing/redis)
- [Vercel Redis (Upstash) docs](https://vercel.com/docs/redis)
- [Neon pricing](https://neon.com/pricing)
- [Neon plans](https://neon.com/docs/introduction/plans)
- [Next.js 15 release notes](https://nextjs.org/blog/next-15)
- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [next-intl GitHub](https://github.com/amannn/next-intl)
- [react-simple-maps](https://www.react-simple-maps.io/)
- [react19-simple-maps fork](https://github.com/vnedyalk0v/react19-simple-maps)
- [carolinabigonha/br-atlas (IBGE TopoJSON)](https://github.com/carolinabigonha/br-atlas)
- [mtrovo/br-atlas (alternative)](https://github.com/mtrovo/br-atlas)
- [ofetch (unjs)](https://github.com/unjs/ofetch)
- [Tailwind v4 migration guide](https://dev.to/pockit_tools/tailwind-css-v4-migration-guide-everything-that-changed-and-how-to-upgrade-2026-5d4)
- [Database free tier comparison 2026](https://agentdeals.dev/database-free-tier-comparison-2026)
- [Vitest + Playwright stack 2026](https://www.pkgpulse.com/blog/vitest-jest-playwright-complete-testing-stack-2026)
- [GH Actions vs Vercel Cron](https://viadreams.cc/en/blog/cron-schedule-serverless-github-actions-vercel-cloudflare/)
