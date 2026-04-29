# Page Architecture & States

Decisions from sketches 004–007 (state-detail page, tablet viewport, search & filter, loading & error). Layered on top of the foundational decisions in `01-layout-composition.md`, `02-edge-states-source-trust.md`, and `03-tokens-theme.md`.

## State-Detail Page (`/estado/{uf}`) — sketch 004 winner C

This is the page that **receives WhatsApp shares**. Treat URLs as the entry, not the home page. Layout mirrors the home dashboard's two-column logic for consistency.

### Page structure (top to bottom)

| Region | Renders | Notes |
|--------|---------|-------|
| Top banner | conditional stale-source notice | Locked principle: ALWAYS at top of page |
| Header | project name + global timestamp | Same as home dashboard |
| Breadcrumb | `← Brasil` · region · state name | Navigates back to home; preserves user mental map |
| Hero | region label · state name · subline ("3 alertas oficiais ativos · 21 municípios afetados") | h2 large, no decorative weight |
| Status block | risk level + headline + descriptive sentence + stats (alertas / municípios / tempo até expirar) | Color-coded by risk level; 5px left border on red |
| Action bar | Compartilhar (primary) · Copiar link · Como calculamos? | Compartilhar pre-fills WhatsApp share intent |
| Emergency block | only on red — prominent ` 199 Defesa Civil · 193 Bombeiros · 190 Polícia ` | Always with agency name |
| Main column | Alertas detail list + Methodology block | Each alert has dl.facts (Afeta / Início / Válido / Severidade) and meta-row with mono-font source URL + timestamp |
| Aside (desktop) | Fontes consultadas · Defesa Civil estadual · Outros estados · Nordeste | Permanent right rail at 320px wide |
| Aside (mobile) | Same content streams as final sections | Mobile collapses aside into bottom sections |
| Footer disclaimer | mandatory 199/193/190 with agency names | Locked |

### Desktop two-column grid

```css
.twocol {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 32px;
  padding: 0 28px;
}
@media (max-width: 1023px) { .twocol { display: block; padding: 0; } }
```

### Aside content structure

Three blocks in this exact order:

1. **Fontes consultadas** — every source linked to its public site, domain in mono-font, ✓ / ⚠ / ✗ marker
2. **Defesa Civil — {UF}** — coordenadoria estadual; specific to the state (different URL per UF)
3. **Outros estados · {Region}** — neighbor states in same region, each with a small risk badge for at-a-glance comparison

### Implementation hints

```tsx
// app/estado/[uf]/page.tsx (Server Component, no client JS needed)
export default async function StateDetailPage({ params }: { params: { uf: string } }) {
  const snapshot = await readUpstashSnapshot();
  const state = snapshot.states[params.uf.toUpperCase()];
  if (!state) return notFound();

  return (
    <>
      {snapshot.staleSourceCount > 0 && <StaleSourceBanner sources={snapshot.staleSources} />}
      <Header />
      <Breadcrumb state={state} />
      <Hero state={state} />
      <main className="twocol">
        <div className="main">
          <StatusBlock state={state} />
          <ActionBar uf={state.uf} />
          {state.level === "red" && <EmergencyBlock />}
          <AlertList alerts={state.alerts} />
          <MethodologyBlock formulaVersion="v0" />
        </div>
        <aside className="aside">
          <SourcesBlock sources={snapshot.sources} />
          <DefesaCivilBlock uf={state.uf} />
          <NeighborStates region={state.region} currentUf={state.uf} snapshot={snapshot} />
        </aside>
      </main>
      <Disclaimer />
    </>
  );
}
```

### Open Graph metadata for WhatsApp share

```tsx
export async function generateMetadata({ params }: Props) {
  const state = await getState(params.uf);
  return {
    title: `${state.name} — ${riskLabel(state.level)} | ENSO Brasil`,
    description: state.leadSentence,
    openGraph: {
      title: `${state.name} · ${riskLabel(state.level)}`,
      description: state.leadSentence,
      url: `https://enso.com.br/estado/${state.uf.toLowerCase()}`,
      images: [{ url: `/og/estado/${state.uf.toLowerCase()}.png`, width: 1200, height: 630 }],
    },
  };
}
```

OG images are pre-rendered server-side per state with current risk level.

---

## Tablet Viewport — sketch 005 winner A

Locked breakpoint rule: **constrained mobile-up**. Cards retain mobile width; page chrome scales.

### The rule

- Card list `max-width: 560px` regardless of viewport
- Page horizontal padding scales with `clamp(16px, 4vw, 64px)`
- Type scale increments slightly at `≥1024px` (h3 18 → 19, body 14.5 → 15.5)
- Mobile layout *is* the tablet layout — only spacing/type tokens differ

### Implementation

```tsx
<div className="max-w-[560px] mx-auto px-4 sm:px-8 md:px-12 lg:px-16 flex flex-col gap-3.5 md:gap-4 py-5 md:py-6">
  {states.map(s => <StateCard key={s.uf} state={s} />)}
</div>
```

Single Tailwind chain. **No tablet-specific layout code.** The dashboard renders the same component tree at every viewport ≥640px; only the wrapper margins/type scale changes.

### Why this won (over desktop-down compression and grid layouts)

- Reading comfort — ~50 chars per line at all viewports
- Visual continuity — user that bookmarks on phone sees the same UI on iPad
- Lowest implementation cost — one media query, no dedicated tablet components
- Works with sketch 002's mobile life-safety hierarchy verbatim

### Implications for the breakpoint system

- `sm`  640px — mobile/tablet boundary; cards start using larger padding
- `md`  768px — iPad portrait; padding grows
- `lg`  1024px — desktop layout activates (top legend + 50/50 map+panel from sketch 001 winner C)

The 640–1023 range is "constrained mobile-up". The desktop two-column composition only activates at `lg` (≥1024px).

---

## Search & Filter — sketch 006 winner A

**Inline always-visible** for v1. Migration trigger logged in case filters grow.

### Rule for v1

- Search input + region chips visible at all times (no autocomplete, no drawer)
- URL params drive filter state: `/?q=ma&region=Nordeste` is the canonical URL
- All filter combinations are deep-link shareable
- Server-renders the filtered list; **zero client JS** for filter functionality
- Active-filters strip above the list shows count and "Limpar" button
- `<mark>` highlight on search matches uses `--yellow-bg` (theme token)

### Migration trigger

If a 4th filter dimension lands (hazard type, ENSO status from M5, source-specific filtering), migrate to **Variant C drawer pattern**:
- Header reduces to free search + "⚙ Filtrar" button with badge count
- Bottom drawer hosts region + level + new dimensions
- Filter button shows `<span class="badge">N</span>` for active count

### Empty / no-results pattern

Every variant of search ends up showing an empty state when filters return nothing. Locked structure:

- Icon (subtle, low opacity)
- One-line bold message ("Nenhum estado bate com esses filtros")
- One-line guidance ("Tente afrouxar a região, ou inclua mais níveis")
- Two action buttons: "Limpar busca" / "Ver todos os 27"

Tone matches the project: calm, no exclamation marks, offers concrete recovery actions.

### Implementation (winning v1 path)

```tsx
// app/page.tsx
export default async function Home({ searchParams }: { searchParams: { q?: string, region?: string } }) {
  const snapshot = await readUpstashSnapshot();
  const visible = filterStates(snapshot.states, searchParams);

  return (
    <>
      <Header />
      <form action="/" method="get">
        <SearchInput defaultValue={searchParams.q} />
        <RegionChips active={searchParams.region} />
      </form>
      {visible.length === 0
        ? <EmptyResults searchParams={searchParams} />
        : <CardList states={visible} />}
    </>
  );
}
```

`<form>` with method GET means the URL updates on submit — no client JS, all bookmarkable.

---

## Loading & Error States — sketch 007 winners A + C

**A is the primary path. C is the mandatory floor.** They are complementary, not rival.

### A — SSR-instant + last-known (primary)

The architecture's dual snapshot store (Upstash hot + Postgres durable) means we never need to render an empty page. The page lifecycle:

```
1. Server Component runs
2. Read Upstash snapshot
3a. Hit → render full page with `há N min` pill (green if fresh, orange if stale)
3b. Miss → fall back to Postgres last snapshot, render with `há N min` pill orange + top banner "Mostrando snapshot de N min atrás. Estamos buscando dados novos."
4. Client mounts; map SVG island progressively renders with text fallback "📍 Mapa carregando…" + link to `/texto`
```

### Freshness pill (new component)

```html
<span class="age-pill fresh"><span class="dot"></span>há 8 min</span>
<span class="age-pill stale"><span class="dot"></span>há 17 min</span>
```

Shown next to the project name in the header. Green dot when ≤10 min, orange dot when >10 min.

### Map island fallback

The map SVG is the heaviest island. Wrap it in `<Suspense>` with a text fallback that links to `/texto`:

```tsx
<Suspense fallback={
  <div className="map-fallback">
    📍 Mapa carregando…<br />
    <small>Use a lista acima ou a <a href="/texto">versão em texto</a>.</small>
  </div>
}>
  <BrazilMap snapshot={snapshot} />
</Suspense>
```

### C — Total failure floor (mandatory)

Three scenarios, one component:

1. **Snapshot vazio · primeiro deploy** — `<TotalFailurePage scenario="bootstrap" />`
2. **Todas as fontes fora >1h** — `<TotalFailurePage scenario="all-sources-down" />`
3. **Erro 500** — `app/error.tsx` renders `<TotalFailurePage scenario="server-error" errorId={...} />`

Each scenario shares the same structure:

- Top banner (gray, neutral) explaining the situation
- Header with the situation in `.sub`
- Centered hero: icon + h2 + explanatory paragraph
- Sources block (always present): linked list of official sites with mono-font domains
- Emergency block (always present): 199 Defesa Civil · 193 Bombeiros · 190 Polícia in the red callout pattern
- Disclaimer footer

The page assumes responsibility for the problem ("Algo deu errado de nosso lado", "Estamos coletando os primeiros dados") rather than blaming the user. Always redirects to the source's own portal — never leaves the user without an action.

### Why B (skeleton + streaming) was rejected

- Skeleton bars are decorative animation in life-safety content — contradicts anti-sensationalism
- During the 800–2000 ms shimmer window, the user has *no* information; A delivers honest stale data instead
- Anyone confident enough to want B can still get 95% there with A: SSR is fast enough on hot cache that no skeleton is needed; Postgres fallback covers the cold case

### Hard rules

- ⛔ Never render a loading skeleton for content that has a Postgres last-snapshot fallback available
- ⛔ Never render a freshness pill without a colored dot (color + position + text — multi-channel)
- ⛔ Never render a 500 page that doesn't include source links + emergency contacts
- ⛔ Never render the page chrome before establishing whether a stale-source banner is needed (banner is at the top — must be in the initial HTML response)
- ⛔ Never animate the freshness pill (no pulsing) — anti-sensationalism applies even here

## Origin

Synthesized from sketches:
- 004-state-detail-page (winner C — two-column desktop / linear mobile)
- 005-tablet-viewport (winner A — constrained mobile-up)
- 006-search-filter-states (winner A — inline always-visible · migration trigger to C drawer)
- 007-loading-skeleton (winners A + C — SSR-instant primary + total-failure floor)

Source files: `sources/004-state-detail-page/`, `sources/005-tablet-viewport/`, `sources/006-search-filter-states/`, `sources/007-loading-skeleton/`
