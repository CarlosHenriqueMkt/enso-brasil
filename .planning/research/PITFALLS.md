# Pitfalls Research — ENSO Brasil

**Researched:** 2026-04-28
**Mode:** Ecosystem (pitfalls-deep)
**Overall confidence:** MEDIUM-HIGH (HIGH on Vercel/FIRMS/LGPD; MEDIUM on CEMADEN/INMET internals — official API specs are sparse, so several findings rely on community evidence and known patterns. Flagged inline.)

> Domain-specific failure modes for a public-safety-adjacent Brazilian climate aggregator. Each pitfall is mapped to a concrete prevention and the build phase that owns it. Cite real incidents where possible.

---

## Top 5 Catastrophic (must-prevent in v1)

Ordered by **severity × likelihood**, where severity is "harm to a vulnerable user trusting the page" and likelihood is "happens within first 6 months of operation."

### 1. Silent green-by-default during a real disaster
**What goes wrong:** All upstream sources (CEMADEN/INMET) are down or returning HTTP 200 with stale cached payloads (no staleness header). The app dutifully recomputes risk = `green` because `active.length === 0`. Site shows "Sem alertas" while a city is flooding. This is the single worst failure mode for the product's core promise.
**Why it happens (concretely):**
- CEMADEN/INMET are run by federal agencies on aging infrastructure; outages are not rare and almost never announced
- Edge caches (Vercel, intermediate CDNs) can serve a stale 200 for hours
- `calculateRiskLevel()` v0 has no "I don't know" return — only green/yellow/orange/red
**Early warning signs:** Source-fetch p95 latency drop to ~0 (means served from cache); identical payload hash for >2 polling cycles; Defesa Civil Twitter/X mentions an event your map shows as green.
**Prevention:**
- Per-source `lastSuccessfulFetch` timestamp persisted in KV; surface "Dados de [fonte] desatualizados há X min" in UI when >30 min
- Hard rule (RISK-04, already in PROJECT.md): if **all** sources stale >1h, return `unknown` (gray "Dados indisponíveis"), never `green`
- Compare current payload hash to previous; if identical for N cycles, treat as suspicious and degrade confidence
- Add a synthetic canary: a known never-changing endpoint to detect "we're getting served stale by middleboxes" vs "the API really has nothing"
**Phase:** P1 (data ingestion) — must ship in v1.

### 2. Risk underestimation in chronic-drought Semiárido
**What goes wrong:** The Semiárido (BA/PI/CE/PB/PE/RN/AL/SE + parts of MG) lives in chronic agricultural drought. CEMADEN tends not to issue point-in-time *alerts* for chronic conditions — alerts are episodic. v0 formula computes `green` for these states most days, while a small farmer there is actually in crisis. The product visually contradicts the lived reality of its top-priority audience.
**Early warning signs:** Bahia, Piauí, Pernambuco repeatedly green on dry-season days while local news reports drought; user feedback says "the map is wrong."
**Prevention (v1):**
- UI strip per state: "Condição crônica conhecida: seca no Semiárido" — editorial banner on green that doesn't change risk color but warns the user
- README/Methodology page: explicit "Limitação conhecida da v0" callout
- Reserve risk-formula v1 (M4) to add anomaly-based component (rainfall deficit vs 30-yr normal)
**Phase:** P3 (UI per-state) for the editorial banner; M4 for true fix.

### 3. Stale snapshot after a real red alert lands
**What goes wrong:** Cron poll runs at HH:00. A red alert is published at HH:01. ISR/edge cache holds the green snapshot until HH:15 (or HH:60 if revalidate is wrong). 14 minutes of "green during red" — exactly when traffic spikes from people checking the dashboard.
**Early warning signs:** Diff between `published_at` of latest alert and our `last_render_at` exceeds polling interval; cache HIT ratio near 100% during traffic spike.
**Prevention:**
- Use **on-demand revalidation** (`revalidatePath`/`revalidateTag`) at the end of every cron poll that detected a state-level risk *change*, not only time-based ISR
- Short `s-maxage` (60s) + `stale-while-revalidate` for the dashboard route; never serve >2-min-old data without a revalidation kick
- KV write uses CAS pattern: read version → write only if version matches; otherwise re-read & retry (Vercel's own ISR coordinator uses this pattern, per [Mintlify edge caching post](https://www.mintlify.com/blog/page-speed-improvements))
- Lock with auto-expire (30 min) on the cron job to prevent overlapping polls during slow upstream responses
**Phase:** P1 (caching layer).

### 4. Free-tier exhaustion at the worst moment
**What goes wrong:** A real disaster causes a 50× traffic spike. Vercel Hobby's caps trip: 100 GB/mo bandwidth, 1M Edge Requests/mo, 1M function invocations/mo, 4h Active CPU/mo. When you exceed Hobby, you wait **30 days** for reset (per [Vercel Hobby docs](https://vercel.com/docs/plans/hobby)). Site goes dark precisely when needed most.
**Early warning signs:** Vercel usage dashboard >70% on any meter mid-month; sudden traffic from a news article linking the site.
**Prevention:**
- Aggressive static export of the dashboard shell + JSON snapshot file (`/api/snapshot.json`) cached at edge with `s-maxage=60` so 99% of requests never hit a function
- Map TopoJSON shipped as a static asset (one-time download, browser-cached forever via content hash)
- No per-state route fan-out — single page, single snapshot
- Bandwidth: gzip/brotli everything; TopoJSON simplified aggressively (see #map pitfalls); avatars/screenshots banned
- Monitoring: a daily GitHub Action that hits the Vercel API and posts usage to a status repo issue; alert >50% threshold by the 15th
- **Funding contingency:** README has a "If we hit traffic, here's the emergency backup plan" section (Cloudflare Pages mirror, GitHub Pages static fallback)
**Phase:** P1 (infra) + P5 (monitoring).

### 5. Public-safety information shown without disclaimer is a credibility/legal grenade
**What goes wrong:** A user takes a screenshot of "Verde — Sem alertas" and posts to social media after a death. Defesa Civil questions our methodology. Without rigorous disclaimer + visible "última atualização" + source-link traceability, the project loses standing instantly.
**Early warning signs:** First news mention; first Defesa Civil contact (welcome it, don't dread it).
**Prevention:**
- LEGAL-01 disclaimer is **non-removable** — render it server-side, not via client JS that could fail
- Every state card has `Atualizado há X min · Fonte: CEMADEN/INMET` directly under the badge
- Robots.txt allows indexing but `<meta name="robots" content="noarchive">` to discourage cached snapshots being weaponized
- Methodology link in v1 README explicitly versioned (`risk-formula-v0`) — never claim "current truth," always claim "snapshot of official sources at HH:MM"
- Copy review by a Portuguese-fluent person: tone neutral, never "perigo iminente" unless source uses it
**Phase:** P3 (UI/copy) + P0 (repo bootstrap for README/disclaimer).

---

## API-specific Pitfalls

| Source | Pitfall | Detection | Prevention | Phase |
|---|---|---|---|---|
| **CEMADEN** | No publicly documented alert REST API as of 2026; the [Painel de Alertas](https://painelalertas.cemaden.gov.br/) is the canonical UI but the backing endpoint is undocumented and may change without notice. WebService PDF ([INPE/TerraMA²](https://trac.dpi.inpe.br/terrama2/raw-attachment/ticket/86/DOC01_webservice_cemaden.pdf)) describes pluviometer data, not the alert feed. **Confidence: MEDIUM** | Schema diff between polls; HTTP 200 with HTML instead of JSON (means redirect to login wall) | Pin a JSON-schema validator on every poll; alert (Slack/issue) on schema drift; never assume field presence; treat the painel-alertas endpoint as best-effort and have fallback path to gov.br/cemaden RSS/news | P1 |
| **CEMADEN** | Alerts are issued at **município** level (5,570 of them) — aggregating to 27 UF without losing per-event signal is non-trivial. A single red alert in one município should NOT make a state of 800 municípios uniformly red on the map, but it MUST surface in the state's panel | Visual mismatch between map color and panel content; user reports "but it's only one city" | Two-tier model: state risk = highest active município severity (preserves safety bias), but state panel lists *which* municípios and links to each. IBGE municipality codes (7-digit) → UF (2-letter) mapping table baked into repo (rarely changes; new municípios are extremely rare events) | P1 |
| **CEMADEN** | "Cessado/Encerrado" alerts: server may not always send the cessation message; phantom alerts persist. Already noted in risk-formula-v0.md | `activeUntil` null + `publishedAt` very old | 24h auto-expire (already in v0) — verify it's tested | P1 |
| **INMET** | INMET has multiple portals: `portal.inmet.gov.br` (main), `apitempo.inmet.gov.br` (data), `alertas2.inmet.gov.br` (Alert-AS, CAP/XML for warnings). The Alert-AS endpoint is **CAP (Common Alerting Protocol) XML**, not JSON — easy to overlook. **Confidence: MEDIUM** (API is real, format details from community usage) | XML parser explosions if assumed JSON | Use a CAP parser library (xml2js + CAP schema mapping); test against archived CAP samples; document which endpoint vs which format in code comments | P1 |
| **INMET** | API has been observed to silently change response field names and casing across portal redesigns ([2023 redesign noted on portal news](https://portal.inmet.gov.br/noticias/inmet-lan%C3%A7a-novo-portal)) | Type errors in production; missing fields | Defensive parsing with zod schema + fallback to "low" severity on parse fail (never crash the whole snapshot for one malformed alert) | P1 |
| **INMET** | SSL certificates on gov.br subdomains have expired in the past with no notice; `node-fetch`/`undici` will refuse the connection | TLS handshake errors in cron logs | Don't blindly disable cert checks. Catch the specific error class, log it, and fall back to last-known-good snapshot. Add a runbook step: when this fires, verify with `openssl s_client` and file an issue with the agency | P1 |
| **NASA FIRMS** | MAP_KEY rate limit is **5,000 transactions per 10-minute window**, but a multi-day request counts as multiple transactions. Every-15-min polls of 7 days × 27 states could blow this fast ([NASA FIRMS API docs](https://firms.modaps.eosdis.nasa.gov/api/map_key/)) | HTTP 429; key disabled | Single country-level poll (`/country/csv/{key}/MODIS_NRT/BRA/1`) is **one** transaction, not 27. Parse client-side into per-state. Cache for full 15-min cycle. Never request >1 day at a time | P1 |
| **NASA FIRMS** | CSV endpoint, not JSON. Date column timezone is **UTC** (not BRT). 27 states across 4 time zones in Brazil (UTC-2 to UTC-5). | "fire detected today" off-by-one across day boundary | Convert to America/Sao_Paulo (most common admin) for display, but store UTC. Document timezone in every API caller | P1 |
| **NASA FIRMS** | MAP_KEY is per-email; if leaked in a commit it can be revoked, leaving the project blind | Public repo grep finds key | Vercel env var only, never in code; pre-commit hook scans for known key patterns; rotate on suspicion | P0 |
| **INPE/CPTEC Queimadas** | API exists but documentation is scattered across portal sub-pages and Trac wikis; endpoints have moved between subdomains historically | 404s on previously working URL | Pin the exact endpoint version in a constants file; integration test runs daily in CI | P1 |
| **NOAA/CPC** | Not used for v1 risk (only M5+ for ENSO global status). But: ENSO advisories are **monthly text bulletins**, not a structured feed. Don't try to parse them automatically in v1 | n/a in v1 | Defer entirely to M5; in v1, link out only | M5 |
| **All sources** | None publish an SLA or status page. "Down" must be inferred | Timeout / non-2xx / schema invalid | Per-source circuit breaker with exponential backoff (1, 2, 4, 8 min); don't hammer a sick endpoint | P1 |
| **All sources** | License/redistribution terms vary. INMET data is "público e gratuito"; FIRMS requires attribution; CEMADEN is implicit public domain via Lei de Acesso à Informação. None permit "presented as our own" | Defesa Civil/agency complaint | Footer per state card: "Fonte: [logo+name] · [link to original]". Methodology page lists all licenses. Add `attribution.json` per source in repo | P3 |

---

## Risk-Formula Pitfalls (deepens risk-formula-v0.md §"Riscos conhecidos")

| Pitfall | Concrete failure | Prevention |
|---|---|---|
| **No `unknown` return in v0** | When all sources stale, returning `green` is technically wrong vs spec | Add `RiskLevel = 'green' \| 'yellow' \| 'orange' \| 'red' \| 'unknown'`. UI maps `unknown` → gray "Dados indisponíveis". Test case: empty alerts + all sources stale → `unknown`, not `green` |
| **Time-zone bug on `activeUntil`** | Alert with `activeUntil: "2026-04-28 23:00"` (no TZ) parsed as UTC → expires 3h early in Brazil | Always parse with explicit TZ. Source-specific parsers must encode their TZ assumption. Use `date-fns-tz` or Temporal API. Test with America/Sao_Paulo, America/Manaus (UTC-4), America/Noronha (UTC-2) |
| **DST assumption** | Brazil **abolished DST in 2019** (per [Wikipedia: DST in Brazil](https://en.wikipedia.org/wiki/Daylight_saving_time_in_Brazil), [Time.is news](https://time.is/time_zone_news/no_dst_in_brazil_in_2019)). Old date libraries with stale tzdata may still try to shift. There has been recurring political talk of reinstating it (per [Slashdot Jan 2025](https://yro.slashdot.org/story/25/01/04/0530245/brazil-ended-daylight-saving-time-but-it-might-bring-it-back)) | Pin a tzdata-bundled date lib; add unit tests that assert no DST shift in 2026 dates; subscribe to IANA tz announcements (governance task) |
| **Midnight rollover** | Alert "active until 23:59" — at 00:00 of next day, does the cron poll see it as expired? Off-by-one risk | Half-open intervals: alert active iff `now < activeUntil`. Test 23:59:59 and 00:00:00 boundary explicitly |
| **Dedup hides cascading alerts** | INMET + CEMADEN both alert "chuva forte" + a third agency alerts "deslizamento" — same state, overlapping window. Naïve dedup by `hazardType` could collapse them | Dedup only when `hazardType` AND `state` AND time-window match — never collapse across different `hazardType`s. Show all sources in UI even when counted once |
| **"3+ low → orange" rule cliff edge** | A state with exactly 3 low alerts is orange; with 2 it's yellow. State that toggles 2↔3 every poll causes flicker | Hysteresis: once orange, require <2 low to drop to yellow (sticky for one cycle). Or: rule is monotonic + 1-cycle smoothing |
| **Severity mapping silently wrong** | If CEMADEN renames "Alerta" → "Alerta Severo", current mapping defaults to `low` (per spec) — silently downgrading. Spec says "conservative" but defaulting unknown to `low` is the OPPOSITE of conservative for an upgrade | Critical fix: **default unknown severity to `moderate`**, not `low`. Log the unmapped term loudly. Reasoning: a new label from an alert agency is more likely a real event than not |
| **No way to express "this is informational"** | INPE focos counts can fire on every state in dry season; treating each as `low` paints Centro-Oeste yellow constantly | Already noted in v0 doc: don't use INPE for severity if no anomaly threshold. Reinforce in code: `severityFromInpe` returns `null` when below anomaly threshold, not `low` |
| **Multi-state alerts (regional)** | "Aviso de chuva forte para todo o Sul" — one alert applies to RS, SC, PR. Source may issue once or thrice | Parse `affectedStates: string[]` and explode into per-state records; dedup by `(source, originalId, state)` |
| **Future-dated alerts** | INMET issues warnings *for the next 24h*. `publishedAt = now`, `activeUntil = now+24h`, but the storm is forecasted to start `now+6h`. v0 treats it active immediately — debatably correct | Document: "active" = "in the official validity window," which usually starts at publication. Include `validFrom` field; if absent assume `publishedAt` |

---

## Free-Tier Pitfalls

Vercel Hobby specifics (per [vercel.com/docs/limits](https://vercel.com/docs/limits) and [Hobby plan docs](https://vercel.com/docs/plans/hobby), confirmed 2026):

| Limit | Value (Hobby) | How we hit it | Prevention |
|---|---|---|---|
| Function timeout | 60s default (was 10s historically — verify current) | Slow CEMADEN response on cron | 30s soft timeout with `AbortController`; partial snapshot is better than none |
| Bandwidth | 100 GB/mo | One viral moment | Static-first: dashboard is SSG with revalidate; TopoJSON is hashed asset; brotli enabled; no images >50KB |
| Edge requests | 1M/mo | Crawler attack | `robots.txt` + per-IP rate limit at edge middleware; cache headers tuned to maximize HIT ratio |
| Function invocations | 1M/mo | Each user → 1 API call | Don't expose `/api/*` for client polling. Client reads the static snapshot. Only cron + on-demand revalidation invoke functions |
| Active CPU | 4 hours/mo | Map rendering on server | Map is client-side (`react-simple-maps`); server only does JSON aggregation |
| KV commands | per-product limit (verify in Vercel docs at build time) | Per-state per-poll write | Single document `snapshot:current` with all 27 states, not 27 keys; one write per poll |
| Cron | 2 cron jobs on Hobby (verify) | We need 1 (every 15 min) — fine | Don't add gratuitous crons for cleanup; do cleanup inside the main poll |
| **Reset semantics** | **30 days** to reset after over-quota | "Spike during disaster → site dark for a month" | See Top 5 #4 — backup mirror plan; usage alerting at 50% threshold |

**Bandwidth math sanity check:** 100 GB / 30 days ≈ 3.3 GB/day. If average page is 200 KB total transfer, that's ~16,500 page views/day. A trending tweet = 100K visitors in an hour. **The product MUST function as a static asset that CDN caches for everyone.**

---

## Accessibility Pitfalls

WCAG AA in a map-heavy dashboard has specific failure modes ([BOIA on interactive maps](https://www.boia.org/blog/interactive-maps-and-accessibility-4-tips), [Level Access on keyboard nav](https://www.levelaccess.com/blog/keyboard-navigation-complete-web-accessibility-guide/)):

| Pitfall | Concrete failure | Prevention | Phase |
|---|---|---|---|
| **`react-simple-maps` is not keyboard-accessible by default** | The library renders SVG `<path>` for each state with `onClick` — but `<path>` is not in the tab order; screen reader users can't reach states from the map | Wrap each `Geography` with `<g role="button" tabIndex={0}>`, add `onKeyDown` (Enter/Space → click), and `aria-label="Estado: São Paulo, risco laranja"` per state. WCAG 2.1.1 Keyboard requires this | P3 |
| **Focus-visible invisible** | SVG focus ring on transparent fill is invisible | Custom `:focus-visible` outline on the geography path with high-contrast stroke | P3 |
| **Color-only state encoding** | "Verde/amarelo/laranja/vermelho" without text or icon fails WCAG 1.4.1 Use of Color | Already in v0 spec — icons + text label per badge. Verify with daltonism simulator (Chrome devtools) | P3 |
| **Map updates panel without announcing** | Click a state, panel changes silently — screen reader users don't know | `aria-live="polite"` on the panel container; on selection, panel header announces "Painel de São Paulo atualizado" | P3 |
| **Mobile hit-areas too small** | SVG paths follow geographic borders → tiny states (DF, SE, AL) are sub-44px | Mobile fallback: cards-first layout (already in DASH-03); on the map, augment small states with invisible hit-area circles ≥44×44px | P3 |
| **Contrast on yellow** | `#eab308` on white is **2.34:1** — fails WCAG AA (4.5:1) | Use yellow only as background with black text, or darken to `#a16207`; verify with axe-core in CI | P3 |
| **Reduced motion** | Pulsing red dots on alerts trigger `prefers-reduced-motion: reduce` users | All animations gated by media query | P3 |
| **3G perf budget breaks a11y** | Lighthouse a11y often regresses when you optimize for size by removing labels | Lighthouse CI on every PR; budget = a11y ≥95, perf ≥90 on Slow 3G | P0 (CI) |

---

## Legal/Credibility Pitfalls

| Pitfall | Risk | Prevention | Phase |
|---|---|---|---|
| **LGPD applies even with no user accounts** | LGPD scope is "processing of personal data of individuals located in Brazil" ([IAPP overview](https://iapp.org/news/a/an-overview-of-brazils-lgpd), [DLA Piper](https://www.dlapiperdataprotection.com/index.html?t=law&c=BR)). IP addresses + access logs MAY count. Even Plausible Analytics processes IPs (briefly) | Privacy policy page (PT-BR) stating: no cookies that aren't strictly necessary, no personal data collected, server logs auto-purged after 7 days, no third-party analytics in v1. If Plausible added later, document under LGPD Art. 7 (legitimate interest) | P3 / OSS-01 |
| **Defesa Civil objection** | They may worry the site is mistaken for an official channel | Pre-emptively reach out to Defesa Civil with "we link people TO you, here's our methodology" letter. Disclaimer at top + bottom of every page repeats the 199/193 numbers | P5 / launch |
| **Source TOS prohibits redistribution** | NASA FIRMS allows redistribution with attribution; INMET implicit public; CEMADEN public via LAI. But IF a state Defesa Civil portal (M9) prohibits scraping, must respect | Per-source `LICENSE.md` excerpt in repo; M9 (scraping) requires explicit per-source review | P3 / M9 |
| **Liability via implied advice** | If users say "site told me everything was fine, then a flood killed someone" | Disclaimer is necessary but not sufficient. Avoid prescriptive language ("você está seguro"); use descriptive language ("nenhum alerta oficial publicado para este estado em [HH:MM]"). Lawyer review before scaling | P3 / pre-launch |
| **Alarmism backlash** | Overstating "perigo extremo" loses credibility fast | Style guide: never use stronger language than the source. If source says "Atenção," we say "Atenção" | P3 |
| **Project name/domain dispute** | "ENSO Brasil" provisional — INPE has products with similar names | Trademark search before locking domain; consider obviously distinguishable name (e.g., "Clima Brasil Aberto," "Atlas de Riscos Climáticos") | P0 |

---

## Map-Rendering Pitfalls

react-simple-maps + IBGE TopoJSON + Brazil specifics:

| Pitfall | What goes wrong | Prevention | Phase |
|---|---|---|---|
| **Mercator distorts Brazil badly** | Default `geoMercator` exaggerates the equatorial north (Roraima, Amapá look smaller than they should relative to RS); also wastes pixels on stretched poles | Use `geoConicEqualArea` (Albers) with parallels tuned for Brazil (~`-7°` and `-22°`) OR `geoMercator` is ACCEPTABLE here because Brazil straddles equator only modestly — the bigger sin is using global Mercator centered on (0,0). Custom projection with `parallels: [-7, -22], rotate: [54, 0]` (centers on Brazil). See ([gist: Brazilian States Albers vs Mercator](https://gist.github.com/ppKrauss/e6c12bf84e732ca4cbf0694808619cad)) | P3 |
| **TopoJSON simplification too aggressive** | Coastline jagged, small states deformed (DF, SE) | Use IBGE Malha Municipal at the **estados** layer with `topojson-simplify` retaining ~10% of points (test visually). Don't ship the município-level malha (massive file) until M9 | P3 |
| **TopoJSON simplification too light** | File >2 MB, mobile 3G chokes | Target <150 KB gzipped for the 27-state map. Verify on Slow 3G in Chrome devtools | P3 |
| **Sliver gaps between states** | Naïve simplification splits shared borders → visible white seams | Use `topojson` (preserves topology) NOT `geojson` for simplification; `topojson-simplify` retains shared arcs | P3 |
| **State acronym (UF) confusion** | Users in their own state may not recognize "UF" or even their own sigla in another script | Always show "São Paulo (SP)" — never just "SP". Tooltip on hover/focus | P3 |
| **Accent breakage** | `São Paulo` vs `Sao Paulo` in URL slugs / search; user types "sao paulo" and gets nothing | Normalize search input with `String.prototype.normalize('NFD').replace(/\p{Diacritic}/gu, '')` on both sides | P3 |
| **Map hit-area on touch** | Tiny states unreachable by finger | Cards layout primary on mobile per DASH-03; map secondary | P3 |
| **Re-render storm on snapshot update** | All 27 paths re-render every 15 min, browser jank | Memoize Geographies; only color-prop changes; use `key` stability | P3 |
| **Static asset versioning** | Update TopoJSON shape → CDN serves old + new for an hour → browser mismatch | Content-hashed filenames (`/maps/br-states-a3f9c1.json`); never overwrite | P1 |

---

## Open Source Pitfalls

| Pitfall | What goes wrong | Prevention | Phase |
|---|---|---|---|
| **Secrets in commits** | NASA FIRMS MAP_KEY pushed to public repo, key revoked, project blind | Pre-commit hook (Husky) running `gitleaks` or simple regex; `.env*` in `.gitignore`; rotate-on-suspicion runbook in CONTRIBUTING.md | P0 |
| **No CONTRIBUTING.md = drive-by PRs of varying quality** | Time sink reviewing PRs that don't follow conventions | CONTRIBUTING.md from day 1: PR template, commit conventions (Conventional Commits), branch naming, "no unsolicited refactors" rule, "translations welcome but coordinate first" | P0 / OSS-01 |
| **Public source list = abuse target** | A list "we hit CEMADEN every 15 min" invites bad actors hammering CEMADEN with our user-agent | Use a project-specific UA `enso-brasil/1.0 (+https://...)` so agencies can identify and contact us; don't publish full poll cadence in code comments visible on GitHub search; document "rate limits respected" prominently | P1 |
| **No code of conduct** | Toxic interactions, especially given political sensitivity of climate topic in Brazil | Adopt Contributor Covenant 2.1 (PT-BR translation exists); enforce | P0 |
| **License confusion** | Code MIT, but data redistribution? | Top-level `LICENSE` (MIT for code) + `DATA-LICENSE.md` describing per-source data attribution requirements | P0 |
| **i18n PR floods before infra ready** | Volunteers translate strings into Spanish/English in v1 before next-intl files are stable, creating merge hell | CONTRIBUTING explicitly says: "v1 is PT-BR only. Translation PRs accepted starting M12." | P0 |
| **No release/changelog discipline** | Risk formula changes silently — a public-safety project must have versioned methodology | `CHANGELOG.md` required for every PR touching `src/lib/risk/`; UI displays formula version | P1 |

---

## Brazilian-Specific UX Pitfalls

| Pitfall | What goes wrong | Prevention | Phase |
|---|---|---|---|
| **Mobile data plans charged per byte** | Vulnerable users on prepaid 3G plans pay R$/MB | Page <100 KB transfer on first load; lazy-load TopoJSON only on desktop or on user tap; offer "modo leve" toggle (text-only cards, no map) | P3 |
| **3G round-trip latency** | Brazil's 3G has high RTT to São Paulo region; outside SP it's worse | Vercel edge (multiple São Paulo POPs); preconnect headers; HTTP/3 enabled | P1 |
| **UF acronyms** | Non-locals don't know "TO," "AP," "RR" | Full name + UF as noted in map pitfalls | P3 |
| **Accent search** | "ceara" doesn't find "Ceará" | Diacritic-insensitive search | P3 |
| **Regionalism in hazard names** | "Estiagem" vs "seca" vs "secura" — same thing, regional words | Display canonical term ("Seca") + localized variant in tooltip if known | P3 |
| **Trust deficit with .gov.br branding mimicry** | Site styled like gov.br portal might mislead users into thinking it IS official | Distinct visual identity; never use Brazilian flag colors as primary palette in a way that mimics official sites; explicit "site não-oficial" in header on first visit | P3 |
| **Time-of-day asymmetry** | Real disasters often peak overnight (heavy rain 02:00-05:00); cron at HH:00 means up to 14-min lag | Already addressed in #3; consider higher poll cadence overnight if free tier allows | P1 / future |

---

## Cache-Coherence Pitfalls (deep dive)

Beyond Top-5 #3:

| Pitfall | Failure | Prevention |
|---|---|---|
| **`fetch` cache: 'force-cache' default** | Next.js 15 changed default; if a route handler does `fetch(cemadenUrl)` it may be cached forever | Explicitly `cache: 'no-store'` in cron poller; `revalidate: 0` |
| **CDN edge serves stale during revalidation lock** | One pod is rebuilding the snapshot; other pods/PoPs serve old | `stale-while-revalidate=300` is OK because /total/ time stale is still bounded by next poll + SWR window; document this trade-off |
| **KV partial write** | Cron writes 27 states one-by-one; crashes after 13. Snapshot is internally inconsistent | Single atomic write of full snapshot (`SET snapshot:current` to one JSON blob). Never per-state writes |
| **Browser localStorage caching** | A returning user sees their own stale state from localStorage when a real alert is active | Don't cache snapshots in localStorage in v1. If added later, max-age 60s |
| **Service worker** | None in v1 | Explicitly NO service worker in v1 (don't risk offline showing stale-during-emergency); revisit in M11 with care |

---

## Phase-Mapping Summary

| Phase | Pitfalls owned |
|---|---|
| **P0 — Project bootstrap (repo, CI, infra setup)** | Secrets in commits; CONTRIBUTING/CoC/LICENSE; project name/domain; lighthouse CI; pre-commit hooks; trademark check |
| **P1 — Data ingestion + cache layer** | All API-specific (CEMADEN/INMET/FIRMS/INPE); silent green-by-default (#1); stale snapshot (#3); free-tier exhaustion infra (#4); KV atomic writes; map asset versioning; UA identification; cache-coherence; município→UF aggregation; circuit breaker; SSL cert handling; CHANGELOG discipline |
| **P2 — Risk formula implementation** | All risk-formula pitfalls; `unknown` return type; TZ handling; midnight rollover; dedup; severity-mapping defaults; multi-state alerts |
| **P3 — UI / dashboard / map** | All accessibility (a11y); all map-rendering (Mercator, simplification, slivers, hit-areas); all UX-Brazilian (UF, accents, mobile data, trust); chronic-drought editorial banner (#2); disclaimers (#5); legal/credibility copy; per-source attribution UI; reduced motion |
| **P4 — i18n scaffolding** | next-intl App Router params-Promise migration; translation contribution policy |
| **P5 — Launch + monitoring** | Defesa Civil outreach; usage alerting at 50%; backup mirror plan; canary monitoring; status page |
| **M4 (post-v1)** | Chronic-drought structural fix via anomaly statistics |
| **M5 (post-v1)** | NOAA/CPC ENSO bulletin integration |
| **M9 (post-v1)** | Scraping governance, robots.txt respect, per-source TOS review |
| **M11 (post-v1)** | Notifications + service worker considerations |
| **M12 (post-v1)** | Translation rollout |

---

## Confidence Notes

- **HIGH:** Vercel limits (official docs, current); NASA FIRMS rate limits (official docs); LGPD scope (multiple authoritative sources); Brazil DST status (multiple sources confirm 2019 abolition).
- **MEDIUM:** CEMADEN/INMET API behaviors (public docs sparse; relied on community evidence and known patterns of Brazilian gov APIs). Validate by direct integration testing in P1.
- **LOW:** Specific INMET schema-drift incidents (inferred from portal-redesign news, not from documented post-mortems). Treat as "plausible, design defensively."

---

## Sources

- [Vercel Limits](https://vercel.com/docs/limits)
- [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby)
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations)
- [Vercel Pricing 2026 (Costbench)](https://costbench.com/software/developer-tools/vercel/free-plan/)
- [NASA FIRMS API - Map Key](https://firms.modaps.eosdis.nasa.gov/api/map_key/)
- [NASA FIRMS API - Country](https://firms.modaps.eosdis.nasa.gov/api/country/)
- [NASA FIRMS API - Area](https://firms.modaps.eosdis.nasa.gov/api/area/)
- [INMET Portal](https://portal.inmet.gov.br/)
- [INMET Alert-AS](https://alertas2.inmet.gov.br/)
- [CEMADEN Painel de Alertas](https://painelalertas.cemaden.gov.br/)
- [CEMADEN gov.br](https://www.gov.br/cemaden/pt-br)
- [CEMADEN WebService doc (TerraMA² / INPE)](https://trac.dpi.inpe.br/terrama2/raw-attachment/ticket/86/DOC01_webservice_cemaden.pdf)
- [Wikipedia: Daylight saving time in Brazil](https://en.wikipedia.org/wiki/Daylight_saving_time_in_Brazil)
- [Time.is: No DST in Brazil](https://time.is/time_zone_news/no_dst_in_brazil_in_2019)
- [Slashdot Jan 2025: Brazil might bring DST back](https://yro.slashdot.org/story/25/01/04/0530245/brazil-ended-daylight-saving-time-but-it-might-bring-it-back)
- [LGPD overview - IAPP](https://iapp.org/news/a/an-overview-of-brazils-lgpd)
- [Data protection laws in Brazil - DLA Piper](https://www.dlapiperdataprotection.com/index.html?t=law&c=BR)
- [Berkeley: Brazil Privacy Law](https://oercs.berkeley.edu/privacy/international-privacy-laws/brazil-privacy-law)
- [next-intl App Router setup](https://next-intl.dev/docs/getting-started/app-router)
- [next-intl Routing Configuration](https://next-intl.dev/docs/routing/configuration)
- [Next-intl + Next 15 SSG migration (Medium)](https://medium.com/@pilniczek/next-intl-with-next-15-ssg-c374a7241ad8)
- [Vercel ISR revalidation gotcha (Flavio Copes)](https://flaviocopes.com/revalidation-and-isr-gotcha-on-vercel/)
- [Mintlify edge caching write-up](https://www.mintlify.com/blog/page-speed-improvements)
- [BOIA: Interactive Maps & Accessibility](https://www.boia.org/blog/interactive-maps-and-accessibility-4-tips)
- [Level Access: Keyboard Navigation Guide](https://www.levelaccess.com/blog/keyboard-navigation-complete-web-accessibility-guide/)
- [Brazilian States: Albers vs Mercator (gist)](https://gist.github.com/ppKrauss/e6c12bf84e732ca4cbf0694808619cad)
- [USGS: How are different map projections used?](https://www.usgs.gov/faqs/how-are-different-map-projections-used)
