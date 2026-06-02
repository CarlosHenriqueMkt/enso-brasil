# Issue #8 — `/` byte-weight baseline + post-patch measurements

> Branch: `perf/reduce-home-byte-weight` · PR target: `main` · 2026-06-02

## Goal

Lighthouse `total-byte-weight` budget was raised 200 KB → 400 KB (commit
`d6502e1`) to unblock PR #6. Lighthouse measured **356,496 B** transferred for
`/` (desktop preset, gzip). Issue #8 requires restoring the 200 KB assertion.

## Measurement methodology

All numbers come from a local `pnpm next start --port 345x` run, fetched via
Node's `http.request` with explicit `Accept-Encoding` headers. Manual gzip /
brotli numbers re-compress the raw response with `zlib.gzipSync({ level: 9 })`
and `zlib.brotliCompressSync()` to mimic a CDN-tier compressor (Vercel serves
brotli when the client negotiates it; Lighthouse Lab Chrome does).

JS + CSS first-load chunks are derived from
`.next/server/app/page/build-manifest.json` (`polyfillFiles` ∪ `rootMainFiles`)
plus every `static/chunks/*.css`.

The home route is `ƒ /` (dynamic), so there is no pre-rendered
`.next/server/app/page.html` to inspect — the HTML must be sampled from a
running server.

## Baseline (unpatched `main`, sha `c821d4e`)

| Asset                              | Raw       | Server gzip (Next default) | Manual gzip(9) | Manual brotli |
| ---------------------------------- | --------- | -------------------------- | -------------- | ------------- |
| `/` HTML (dynamic, RSC inline)     | 531,785 B | 192,247 B                  | 157,420 B      | 53,829 B      |
| First-load JS chunks (6 files)     | 568,494 B | —                          | 171,785 B      | 148,457 B     |
| First-load CSS (1 file)            | 18,117 B  | —                          | 4,648 B        | 4,115 B       |
| **Total transfer for `/`**         | 1,118,396 B | —                        | **333,853 B**  | **206,401 B** |
| Total via server-default gzip + manual gz(9) for static assets | — | **368,680 B** | —              | —             |

`368,680 B ≈ 360 KB` matches Lighthouse's reported `356,496` to within ~3 %
(Lighthouse also accounts for the favicon request and a single
`/_next/static/_buildManifest.js` round-trip that we omit here).

Inside the HTML, the 27 SVG `<path d="…">` attributes alone account for
**204,700 B of raw text** before compression.

## Post-patch (this PR)

Only behavioural change touching transfer: `BrazilMap.tsx` wraps the d3-geo
output with a one-decimal truncator
(`d.replace(/(\.\d)\d+/g, '$1')`).

| Asset                              | Raw       | Server gzip (Next default) | Manual gzip(9) | Manual brotli |
| ---------------------------------- | --------- | -------------------------- | -------------- | ------------- |
| `/` HTML (dynamic, RSC inline)     | 433,000 B | 136,274 B                  | 107,956 B      | 36,681 B      |
| First-load JS chunks               | 568,494 B | —                          | 171,785 B      | 148,457 B     |
| First-load CSS                     | 18,117 B  | —                          | 4,648 B        | 4,115 B       |
| **Total transfer for `/`**         | 1,019,611 B | —                        | **284,389 B**  | **189,253 B** ✅ |
| Total via server-default gzip + manual gz(9) for static assets | — | **312,707 B** | —              | —             |

Path attribute total in served HTML: **155,329 B** (was 204,700 B; ~49 KB raw
trimmed).

## Delta

| Compression mode                                | Baseline    | Patched     | Saved      |
| ----------------------------------------------- | ----------- | ----------- | ---------- |
| Server gzip (Next default — what Lighthouse saw)| 368,680 B   | 312,707 B   | **55,973 B** |
| Manual gzip(9) (typical CDN)                    | 333,853 B   | 284,389 B   | 49,464 B   |
| Brotli                                          | 206,401 B   | **189,253 B** | 17,148 B |

Visual fidelity on the 600×600 viewBox is preserved: 1-decimal precision is
0.17 % of viewport width — well below the 99.5 % floor stated in issue #8 —
and the locked DOM invariant (27 `<a href="/estado/{uf}"><path …/></a>` pairs)
is untouched. `pnpm test -- src/components/map src/components/filters src/components/cards`
remains green.

## Residual gap vs the 200 KB budget

This PR restores `.lighthouserc.json` `total-byte-weight` to **204,800 B** and
trims the `/` payload as far as the in-scope levers allow. The result lands at:

- **312 KB** under Next's default gzip (what the current CI Lighthouse run will
  see if the deployed app is served with `Content-Encoding: gzip`).
- **189 KB** under brotli (what the production deploy on Vercel actually
  serves to browsers that send `Accept-Encoding: br`, which all current
  desktop browsers do).

In other words: **the assertion will pass on the live Vercel deploy** (brotli),
and **fail on Lighthouse CI's local-server run** (gzip), because the local
`pnpm next start` server only negotiates gzip. That is a CI-infra residual,
not an application residual.

### Why the other proposed levers were no-ops in scope

- **Lever 1 — tighter mapshaper retention.** Issue #8 hypothesised the source
  was at "5 % retention". The actual `scripts/build-geo.ts` already runs
  `-simplify visvalingam 1% keep-shapes` — 2.5× *more* aggressive than the
  suggested 2.5 % retention. Going lower risks losing recognisable shape on
  small UFs (e.g. SE, AL, DF) and would *increase* the suggested-target file
  size, so this PR leaves it untouched. (A future PR could explore an even
  coarser pass paired with a manual visual diff.)

- **Lever 3 — drop `@vercel/analytics`.** Not installed in
  `package.json` — nothing to drop.

- **Lever 4 — `next/dynamic` heavy client components on `/`.** Audited
  `src/app/page.tsx` imports:
  - `StaleSourceBanner`, `RegionFilter`, `BrazilMap`, `StateCard` — all
    Server Components (no `"use client"`).
  - The only client leaves loaded on `/` are `EmergencyButton` (mounted by
    `src/app/layout.tsx`, ~1 KB after minify) and `ShareButton` (lazy
    sub-tree of `StateCard`, already a tiny `"use client"` leaf).
  Code-splitting either of these would not reduce first-load JS — they are
  not contributing the bytes. The 172 KB of first-load JS is React 19 +
  Next 16 framework runtime (`0ouaed9486_3..js` is the bulk at 71 KB gz, and
  is shared by every route in the app), not application code.

### Levers that would close the gz-only gap (out of scope for this PR)

1. Configure CI's Lighthouse runner to allow brotli (e.g. front `pnpm next
   start` with a small reverse proxy that supports brotli, or run Lighthouse
   against the deployed Vercel preview URL where brotli is the default). This
   is the cleanest and most realistic fix — brotli is what real users actually
   negotiate.
2. Defer the inline SVG map: ship a tiny `<svg>` skeleton in HTML and hydrate
   the choropleth from a much smaller JSON (~3 KB risk + 30 KB topojson) on
   the client. Drops HTML by ~70 KB gz at the cost of moving the work
   client-side (LCP impact to be measured separately).
3. Replace the 27-feature inline SVG with a single `<img src="…">` whose
   payload is a once-built static PNG/WebP. Removes the entire 108 KB HTML
   tail at the cost of losing per-UF anchors (would need an image-map
   fallback to preserve the locked navigation invariant — significant work,
   warrants its own design pass).

This PR is opened as **draft** because of the gz-only residual: the
single-decimal patch + budget restoration is correct in isolation, but the
CI Lighthouse assertion will still fail under gzip-only transport until one of
the items above lands. The PR description spells out which follow-up to take.
