# Features Research — ENSO Brasil

**Domain:** Public-facing climate hazard aggregation dashboard (PT-BR)
**Researched:** 2026-04-28
**Mode:** Ecosystem
**Overall confidence:** MEDIUM-HIGH (Brazilian sources verified; international comparables verified; some PT-BR UX patterns based on documented terminology rather than direct UX testing)

---

## Comparable Projects Reviewed

### Brazilian (primary references)

- **CEMADEN — Painel de Alertas** — https://painelalertas.cemaden.gov.br/ — Per-state list of active alerts with severity tiers ("Moderado", "Alto", "Muito Alto") and hazard categories ("Mov. Massa" / "Risco Hidro"). Confirms severity vocabulary used in `risk-formula-v0.md`. (HIGH)
- **CEMADEN — Mapa Interativo** — https://mapainterativo.cemaden.gov.br/ — Google Maps base, click-to-detail icons, historical data toggle. Heavy/JS-dependent — counter-example for low-bandwidth target. (HIGH)
- **CEMADEN-RJ Defesa Civil panel** — https://painelcemadenrj.defesacivil.rj.gov.br/monitoramento/v2/mapa/ — State-level integration showing how a state Defesa Civil consumes CEMADEN data. (MEDIUM)
- **INMET Avisos / Alert-AS** — https://alertas2.inmet.gov.br/ — Three nominal severities: **Aviso de Perigo Potencial (amarelo) / Aviso de Perigo (laranja) / Aviso de Grande Perigo (vermelho)**. Map shows polygons of affected geographic areas (not strictly per-UF). (HIGH)
- **SP Sempre Alerta** — https://www.spsemprealerta.sp.gov.br/ — CEP-based SMS subscription (40199), preventive guidance pages per hazard type. Demonstrates Brazilian convention of CEP as primary geo-key. (HIGH)
- **Defesa Civil RJ** — https://defesacivil.rj.gov.br/ — SMS to 40199 + CEP. Same CEP-based pattern. (HIGH)

### International analogues

- **US Drought Monitor** — https://droughtmonitor.unl.edu/ — Strong examples of: comparison slider (week-vs-week), grayscale (color-blind) map toggle, Spanish toggle, multi-format download (PNG/PDF/TIF/AI), CMOR community reports with photos. (HIGH)
- **UK Met Office Warnings** — https://weather.metoffice.gov.uk/warnings-and-advice/uk-warnings — Three-tier yellow/amber/red, day-by-day timeline (Tue → Mon), filter, **accessible alternative version** (text-only mode), email subscription, social share buttons. Strong "what to do" advice integrated per warning. (HIGH)
- **Bureau of Meteorology Australia (BOM)** — https://www.bom.gov.au/australia/warnings/ + state subpages (e.g. `/wa/`, `/vic/`) — Per-state subpage URL structure (deep-linkable), map-layer toggles (rain / radar / warnings), zoom-aware clustering of warning counts, push notifications for ≤9 hazard types. (HIGH)
- **NOAA Climate.gov ENSO** — https://www.climate.gov/enso — ENSO dashboard with index comparison, blog editorial format. Note: site marked as archived June 2025 — informs ENSO Brasil's M5 design but not actively maintained. (MEDIUM)
- **ECMWF charts** — https://www.ecmwf.int/en/forecasts/charts — Severe-weather and ensemble charts; technical audience, **not** a model for public ENSO Brasil UX. Useful only for M13. (MEDIUM)

### Brazilian community open-source

- No PT-BR open-source hazard dashboard with the exact ENSO-aggregator scope was found. Adjacent: BR-DWGD (research datasets), brclimr (R package), ASOC weather datasets. Implication: **ENSO Brasil would be the first PT-BR public hazard aggregator at this scope** — modest moat, but no UX precedent to copy from. (MEDIUM)

---

## Table Stakes (v1 must-have)

Features that, if missing, will make the site feel broken or untrustworthy. All present in the v1 requirement list unless noted.

| Feature | v1 req? | Notes |
|---|---|---|
| Per-state risk indicator (color + icon + text label) | DASH-01, RISK-01, A11Y-01 | Matches CEMADEN/INMET conventions |
| Severity tiers using familiar PT-BR vocabulary | risk-formula v0 | "Atenção / Alerta / Perigo / Sem alertas" — see PT-BR Notes |
| Source attribution on each hazard with deep link to original publication | RISK-02 | Industry standard — UK Met, BOM, USDM all do this |
| Last-updated timestamp (per-state and global) | RISK-03 | Required for trust |
| "Dados indisponíveis" gray state when sources stale | RISK-04 | Conservative — better than CEMADEN/INMET which can silently show stale data |
| Mobile-first stacked cards with state search/filter | DASH-03 | Brazil mobile-first market |
| Desktop map + side panel | DASH-02 | Standard hazard-dashboard layout (BOM, UK Met) |
| WCAG AA, keyboard nav, high contrast | A11Y-01 | Color-blind safe (icons + text, not color alone) confirmed in v1 |
| 3G performance budget | A11Y-02 | Critical for vulnerable audience — counter to CEMADEN's heavy Google-Maps portal |
| Mandatory disclaimer footer (199 / 193) | LEGAL-01 | Legal positioning as aggregator |
| 15-min cron ingestion with last-good-snapshot fallback | DATA-02, DATA-03 | Sufficient for hazard timescales |
| ≥2 official sources via public APIs (CEMADEN + INMET) | DATA-01 | API-only locked for v1 |
| Open-source repo (MIT) with README PT-BR + EN | OSS-01 | Trust requirement |

---

## Table Stakes Gaps (recommend adding to v1)

These are features so commonly expected on hazard dashboards that their absence will be noticed. The doc defers them — flagging risk and recommendation:

| Feature | Doc status | Recommendation | Risk if deferred |
|---|---|---|---|
| **Deep-linkable per-state URL** (e.g. `/estado/sp`) | Not explicit in v1 reqs | **Add to v1.** Trivial in Next.js App Router; required for SEO, social sharing, screen-reader bookmarking, and emergency linking ("compartilhe esse link com seu vizinho"). BOM has it; UK Met has it. | High. Without per-state URLs, social share collapses to "see homepage" — kills viral utility in actual emergencies. |
| **Plain-language one-line risk explanation per state** | Implicit in risk-formula v0 ("Frase explicativa") but not in DASH/RISK reqs | **Add explicit DASH req.** v0 formula already specifies "Laranja: 1 alerta de Perigo do INMET para chuva forte" — promote from buried doc detail to first-class v1 acceptance criterion. | Medium. Without this, the color is opaque — vulnerable users can't understand *why*. |
| **"Como calculamos isso?" link** to GitHub README methodology | Mentioned in risk-formula doc, not in v1 reqs | **Add to v1** (link can point at GitHub README until M3 ships). | Medium. Transparency is the credibility moat for an aggregator. |
| **"Acessível em texto" / text-only fallback view** | Not in reqs | Consider for v1, otherwise M2. UK Met has this. | Low-Medium. WCAG AA already requires structural accessibility; text-only is a 3G-bandwidth + low-end-device concern. |
| **Search by CEP** (postal code → state) | Not in reqs | **Defer to M2** but mention. Brazilian users expect CEP — SP and RJ Defesa Civil both use it as primary geo-key. v1 ships per-state only; OK for v1, but flag user expectation gap. | Low for v1 (state granularity is the v1 promise) but high once users compare to SP Alerta. |
| **"Compartilhar" / social share button per state** | Not in reqs | **Add to v1** (one-line meta tags + WhatsApp/Twitter share). Mobile-first audiences share via WhatsApp, not by typing URLs. | Medium. WhatsApp is the *primary* info-distribution channel for vulnerable Brazilian audiences. |
| **OG/Twitter card per state** with current risk color rendered | Not in reqs | **Add to v1.** Cheap; makes WhatsApp/Twitter shares carry the alert visually. | Medium. Same reasoning as share. |

---

## Differentiators (M2+) — already mapped

| Feature | Mapped to | Comparable does it? |
|---|---|---|
| "Sobre o ENSO" explainer page | M2 | NOAA Climate.gov ENSO does extensively |
| "Fontes e Metodologia" page | M3 | USDM has methodology section; UK Met has "About warnings" |
| Per-state expanded view (rainfall/temp anomalies, recent events, "what this means for you") | M4 | USDM week-comparison; BOM state subpages |
| Global ENSO status display + 3-month forecast | M5 | NOAA Climate.gov ENSO dashboard |
| Preparedness content (educational, no commerce) | M6 | UK Met integrates per-warning advice; Defesa Civil portals do this |
| Survival skills videos (curated/embed) | M7 | None of the comparables — fits PT-BR YouTube-heavy media culture |
| Public API for third parties | M8 | USDM has data download + web service; BOM has services |
| State Defesa Civil scraping | M9 | n/a — this is filling a Brazilian-specific gap |
| Historical ENSO comparison (1997/2015/2023) | M10 | USDM comparison slider; NOAA ENSO dashboard |
| Notifications (push/email/Telegram) | M11 | BOM push, UK Met email, SP/RJ SMS — Telegram is PT-BR–idiomatic addition |
| ES / EN translations | M12 | USDM has Spanish; ECMWF multilingual |
| NASA / ECMWF integration | M13 | comparable to ECMWF charts but for general public |

---

## Anti-Features (explicitly excluded — confirm and justify)

| Anti-feature | Rationale | Justification holds? |
|---|---|---|
| Issuing official alerts | Defesa Civil and CEMADEN are statutory authorities | YES — legal liability, would invite prosecution under Brazil's emergency-management laws |
| Own forecast model | Aggregator stance | YES — would require meteorologist team and validation we can't do |
| User accounts / login | Privacy + scope | YES — vulnerable populations should not need to identify themselves to read public-safety info |
| Social features / forums | Out of scope | YES — moderation cost + misinformation risk during emergencies is enormous |
| Affiliate / shopping / commerce links | Ethics | YES — preparedness content (M6) educational only |
| Invasive analytics (Google Analytics, Meta Pixel) | Privacy | YES — vulnerable audience; Plausible OK if needed |
| Push notifications in v1 | Cost / complexity / anti-spam | YES — defer to M11 with proper opt-in design |
| Real-time websockets | Cost / unnecessary | YES — hazard timescales tolerate 15-min poll |
| Scraping in v1 | Legal / credibility | YES — defer to M9 with proper governance |
| Donation/Pix button | Out of mission | Implicit in "no monetization" — confirm in README |
| **Discovery: "user-submitted reports" CMOR-style** (USDM has it) | — | **Recommend remaining anti-feature**: invites unverified reports on a public-safety site, requires moderation, conflicts with "aggregator of official sources" stance |

---

## Discoveries (research surprises)

Features observed in comparables that the idea doc didn't mention. Recommendations marked.

1. **Day-by-day timeline filter** (UK Met Office: Tue / Wed / ... / Mon) — alerts often have validity windows. ENSO Brasil v1 currently treats time as "now". **Recommendation: defer to M4** but ensure data model captures `activeUntil` (already in risk-formula v0) so a future timeline view doesn't require schema change.

2. **Map-layer toggle** (BOM: rain / radar / warnings) — ENSO Brasil v1 plans only "warnings" so this isn't needed in v1. **Recommendation: keep map architecturally extensible to layers** even if v1 ships one layer.

3. **Comparison slider / week-over-week** (USDM) — directly maps to M10 historical comparison. **Recommendation: M10 should adopt this UX pattern** (proven, intuitive).

4. **Grayscale map toggle** for color-blind users (USDM) — *complementary* to the icon-and-text accessibility ENSO Brasil already plans. **Recommendation: add as nice-to-have v1 OR M2**, very cheap (one CSS filter toggle on the SVG map). Strengthens A11Y-01.

5. **Email-alert subscription** (UK Met) — natural M11 anchor; cheaper to ship than push. **Recommendation: M11 starts with email, not push.** Email = no service worker, no permission UX, no Vercel push infra.

6. **Accessible alternative version** (UK Met "accessible alternative") — text-only HTML page mirroring the map. **Recommendation: ship a `/texto` route in v1** that renders the same data as a semantic HTML list grouped by region. Tiny effort, huge a11y win, also serves as graceful 3G fallback.

7. **Multiple download formats** (USDM: PNG / PDF / TIF / AI) — overkill for v1 audience. **Recommendation: skip in v1, consider PNG-of-current-map for share-card use only.**

8. **Per-warning "what to do" advice** (UK Met integrates protective actions inline with each warning) — overlaps with M6 preparedness. **Recommendation: in v1 ship a 1-line "O que fazer" link per hazard type pointing at Defesa Civil's existing guidance** (no editorial work — just curated outbound links). Defers M6 effort while giving v1 actionable value. **Strong recommendation.**

9. **Regional grouping** (Norte/Nordeste/Centro-Oeste/Sudeste/Sul) — Brazilian users navigate by macro-region as well as state. CEMADEN and INMET use regions. **Recommendation: in v1 cards list, add a region filter chip** (Norte/Nordeste/CO/Sudeste/Sul). Trivial; matches mental model.

10. **CMOR community reports with photos** (USDM) — kept as **anti-feature** (see above). Worth naming explicitly so future contributors don't propose it.

11. **State subpage URL structure** (BOM `/wa/`, `/vic/`) — see Table Stakes Gaps; promote per-state URLs to v1.

12. **Persistent search/filter via URL params** — when a user filters to "only Sudeste", that state should be in the URL for sharing. Cheap with App Router. **Recommendation: add to v1** (part of deep-linking).

---

## PT-BR UX Notes

### Severity vocabulary — use what users already recognize

Users encounter these terms across CEMADEN, INMET, and Defesa Civil. **Do not invent new labels**; map ENSO Brasil's 4-tier color system onto recognized PT-BR terminology.

| Color | Recommended label | Source precedent |
|---|---|---|
| Verde | **"Sem alertas"** | (own; CEMADEN does not use a "green" label, INMET has no green) |
| Amarelo | **"Atenção"** | INMET "Perigo Potencial (amarelo)"; CEMADEN "Observação/Atenção" |
| Laranja | **"Alerta"** | INMET "Aviso de Perigo (laranja)"; CEMADEN "Alerta" |
| Vermelho | **"Perigo"** | INMET "Aviso de Grande Perigo (vermelho)"; CEMADEN "Alerta Máximo" |

The risk-formula v0 doc already specifies these labels — keep them; do not change. Word "Atenção" is **especially important** — it's the established CEMADEN/INMET term for low-severity, and using "Aviso" or "Cuidado" instead would surprise users.

### Hazard type names

Use standard CEMADEN/INMET PT-BR terms, not translations:

| Internal | UI label PT-BR |
|---|---|
| `flood` | **Enchente** (urban) / **Inundação** (river-overflow). CEMADEN uses both — pick one or surface both. Recommend "Enchente" as primary, "Inundação" as subtype. |
| `landslide` | **Deslizamento** (CEMADEN: "Movimento de massa") |
| `drought` | **Seca / Estiagem** — "Seca" for severe, "Estiagem" for moderate (this is actual CEMADEN/INMET convention) |
| `heatwave` | **Onda de calor** |
| `fire` | **Queimada** (vegetation fire — INPE/PRODES term) — **not** "Incêndio" which implies structure fire |
| `storm` | **Tempestade / Chuva forte** |
| `wind` | **Vendaval** |
| `cold` | **Onda de frio / Frente fria** |

### State naming

- Brazilian users overwhelmingly use **2-letter UF abbreviations** (SP, RJ, MG, BA, PE, RS) in casual context.
- For unambiguous public-safety use, **show both**: full name as label, UF in a smaller bracket — e.g. "São Paulo (SP)".
- Sort default: **alphabetical by full name** (more inclusive than UF order — UF order privileges the Southeast).
- Mobile filter: enable both ("são paulo" and "sp" should match).

### Date/time formatting

- **24h time** ("14:30", not "2:30 PM").
- Relative time first ("**há 8 minutos**"), absolute time on hover/tap ("28/04/2026 às 14:30 BRT").
- All timestamps in **horário de Brasília (BRT, UTC−3)** with explicit "BRT" suffix when absolute.
- Date format: **DD/MM/AAAA** (never MM/DD).

### Tone

- Calm, factual. **Avoid alarmist verbs** ("catástrofe", "tragédia", "iminente") unless the source uses them.
- 5th-grade reading level for body copy (per the M6 editorial principle — apply to v1 also).
- Reference official channels in every alert detail: "Em emergência: 199 (Defesa Civil) ou 193 (Bombeiros)".
- Source attribution prefix: "**Fonte: CEMADEN**" / "**Fonte: INMET**" — always with link icon.

### Mobile / WhatsApp idioms

- "**Compartilhar**" button (not "Share") — primary target: WhatsApp.
- WhatsApp share text template: `"⚠ [Estado]: [nível] — [perigo]. Fonte oficial: [URL ENSO Brasil]/estado/[uf]"` — short enough to fit WhatsApp preview.
- Avoid emoji-heavy UI (vulnerable audience may use older Android with broken emoji rendering); use SVG icons instead.

### Accessibility-specific (vulnerable audience)

- **Screen-reader narration** of risk: every state card must announce "São Paulo, nível Alerta laranja, 2 perigos ativos: chuva forte e deslizamento, atualizado há 8 minutos" — not just "orange". Use `aria-label` constructed from same data the visible card uses.
- **Color-blind-safe**: icons + text always present. Do not rely on color. ENSO Brasil v1 already commits to this. Add the **grayscale toggle** as discovery #4.
- **Low-bandwidth mode**: ship the `/texto` route (discovery #6) — semantic HTML list, no map, < 30 KB total. Counter-example: CEMADEN's Google-Maps-based portal is unusable on real 3G.
- **Simple-language toggle** (deferred): not needed in v1 if base copy is already 5th-grade. Reconsider in M2.
- **Font size**: respect system text-size scaling (relative units, no `px` for body copy). Vulnerable audience skews older.

---

## Sources

- [CEMADEN Painel de Alertas](https://painelalertas.cemaden.gov.br/)
- [CEMADEN Mapa Interativo](https://mapainterativo.cemaden.gov.br/)
- [CEMADEN-RJ Defesa Civil panel](https://painelcemadenrj.defesacivil.rj.gov.br/monitoramento/v2/mapa/)
- [INMET Alert-AS](https://alertas2.inmet.gov.br/)
- [INMET portal](https://portal.inmet.gov.br/)
- [SP Sempre Alerta](https://www.spsemprealerta.sp.gov.br/)
- [Defesa Civil RJ](https://defesacivil.rj.gov.br/)
- [US Drought Monitor](https://droughtmonitor.unl.edu/)
- [UK Met Office Warnings](https://weather.metoffice.gov.uk/warnings-and-advice/uk-warnings)
- [Bureau of Meteorology Australia — National Warnings](https://www.bom.gov.au/australia/warnings/)
- [BOM Weather app help](https://www.bom.gov.au/bom-weather-app/weather-app-help-and-support)
- [NOAA Climate.gov ENSO](https://www.climate.gov/enso)
- [NOAA CPC ENSO Diagnostic Discussion](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml)
- [ECMWF charts](https://www.ecmwf.int/en/forecasts/charts)
- [W3C ARIA Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)
- [USWDS Alert accessibility tests](https://designsystem.digital.gov/components/alert/accessibility-tests/)
- [BMC: Communication materials for vulnerable groups](https://bmcpublichealth.biomedcentral.com/articles/10.1186/s12889-016-3546-3)
- [Harvard Chan: Climate communication tips](https://hsph.harvard.edu/research/health-communication/resources/climate-communication-tips/)
