---
phase: 05-cemaden-dashboard-ui
plan: 12
type: execute
wave: 4
depends_on: ["05-06", "05-10", "05-11"]
files_modified:
  - tests/e2e/a11y.spec.ts
  - tests/e2e/keyboard-nav.spec.ts
  - .lighthouserc.json
  - .github/workflows/ci.yml
  - playwright.config.ts
autonomous: false
requirements: [A11Y-01, A11Y-02, A11Y-04, A11Y-05, A11Y-06]
must_haves:
  truths:
    - "axe-core/playwright runs on /, /estado/sp, /estado/rj, /estado/am, /texto with ZERO critical violations"
    - "Lighthouse CI on the same 5 routes meets perf >=90, LCP <2.5s, transfer <200KB on simulated 3G"
    - "Playwright keyboard nav test passes: tab through map → cards → filter → share without dead-end focus"
    - "Color-blind safety asserted (deuteranopia + protanopia simulated)"
    - "Yellow contrast WCAG AA verified by axe-core (zero contrast violations)"
    - "Live region announcement on /estado route load verified"
    - "Human checkpoint on Vercel preview confirms WhatsApp OG preview + JS-off rendering"
  artifacts:
    - path: "tests/e2e/a11y.spec.ts"
      provides: "axe-core × 5 routes"
    - path: "tests/e2e/keyboard-nav.spec.ts"
      provides: "Tab order verification"
    - path: ".lighthouserc.json"
      provides: "LHCI config — perf/LCP/transfer assertions"
  key_links: []
---

<objective>
The verification gate. Mechanical checks (axe-core, lighthouse, playwright) + one human checkpoint on Vercel preview.

Output: 3 CI assets + checkpoint.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-cemaden-dashboard-ui/05-RESEARCH.md
@.planning/phases/05-cemaden-dashboard-ui/05-UI-SPEC.md
@playwright.config.ts
@tests/e2e
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: axe-core e2e suite</name>
  <files>tests/e2e/a11y.spec.ts</files>
  <behavior>
    - 5 spec cases: GET `/`, `/estado/sp`, `/estado/rj`, `/estado/am`, `/texto`.
    - Each spec: navigate, run `await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag22aa']).analyze()`, assert `results.violations.filter(v=>v.impact==='critical' || v.impact==='serious').length === 0`.
    - Specific assertions beyond axe-core defaults:
      - Yellow badge contrast: assert axe-core has no `color-contrast` violation on `.risk-badge-yellow` selector.
      - On `/texto`: assert heading outline (h1 count = 1, h2 count = 5, h3 count = 27) via DOM querying.
      - On `/estado/sp`: assert presence of `[aria-live="polite"]` element containing "Alerta" or the actual severity word.
  </behavior>
  <action>
    Mirror existing Playwright spec shape. Use `@axe-core/playwright` from plan 01 install.
  </action>
  <verify>
    <automated>pnpm test:e2e tests/e2e/a11y.spec.ts</automated>
  </verify>
  <done>All 5 routes return zero critical/serious violations.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Keyboard nav + color-blind specs</name>
  <files>tests/e2e/keyboard-nav.spec.ts</files>
  <behavior>
    - On `/`: tab from skip-link → 6 filter chips → 27 state shapes (map) → 27 state cards (each card has internal Tab order: CTA → share-wa → share-clipboard → formula-link) → footer disclaimer. No focus traps. No dead-end (every focused element has a visible focus indicator — check `:focus-visible` styling exists).
    - On `/texto`: tab order: skip-link → 5 region table anchor links (27 row anchors total) → 27 article sections (their inner CTAs).
    - Color-blind: use Playwright's `page.emulateMedia` or a CSS filter overlay to simulate deuteranopia and protanopia. Assert that for each state, the badge's icon glyph (`✓ ⚠ ⚠⚠ ⛔ ?`) is present in DOM (proves icon redundancy survives color removal).
  </behavior>
  <action>
    Use `page.keyboard.press('Tab')` loop with focused-element introspection.
  </action>
  <verify>
    <automated>pnpm test:e2e tests/e2e/keyboard-nav.spec.ts</automated>
  </verify>
  <done>Tab order completes; icons present under simulated color-blindness.</done>
</task>

<task type="auto">
  <name>Task 3: Lighthouse CI config + workflow step</name>
  <files>.lighthouserc.json, .github/workflows/ci.yml, package.json</files>
  <action>
    Create `.lighthouserc.json`:
    - `ci.collect.url`: 5 routes (build + start the app via `pnpm build &amp;&amp; pnpm next start`, then point LHCI at `http://localhost:3000/`, `/estado/sp`, `/estado/rj`, `/estado/am`, `/texto`).
    - `ci.collect.settings.preset`: `"desktop"` for default, plus a second config block for `"mobile"` with throttling `slow4G` (closest preset to 3G).
    - `ci.assert.assertions`:
      - `categories:performance`: `["error", {"minScore": 0.90}]`
      - `largest-contentful-paint`: `["error", {"maxNumericValue": 2500}]`
      - `total-byte-weight`: `["error", {"maxNumericValue": 204800}]` (200 KB)
      - `unused-javascript`: `["warn"]`
    - `ci.upload.target`: `"temporary-public-storage"` (free, no auth).

    Append to CI workflow:
    ```yaml
    - name: Lighthouse CI
      run: pnpm exec lhci autorun --config=.lighthouserc.json
    ```

    Add script to `package.json`: `"lhci": "lhci autorun --config=.lighthouserc.json"`.

  </action>
  <verify>
    <automated>pnpm exec lhci autorun --config=.lighthouserc.json --collect.staticDistDir=.next 2>&amp;1 | tee lhci.log; grep -E 'failed|passed' lhci.log</automated>
  </verify>
  <done>LHCI assertions pass locally; CI step lands.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Vercel preview smoke (WhatsApp OG + JS-off + map projection)</name>
  <what-built>Phase 5 dashboard surface deployed to Vercel preview from the feature branch.</what-built>
  <how-to-verify>
    Visit the Vercel preview URL (auto-deployed from `phase-5-cemaden-dashboard` branch) and verify:

    1. **Home `/`**: 27 state cards visible. Map renders Albers conic shape of Brazil. Hover a state — tooltip appears. Click → navigates to `/estado/{uf}` (no client-side panel swap).
    2. **Region filter**: click "Sul" chip → URL becomes `/?region=sul` → only 3 cards (PR, RS, SC) visible → map still shows all 27 → click "Todas" → 27 cards return.
    3. **`/estado/sp`**: two-column desktop layout. Permanent aside with badge + share buttons. Right column with explanation, alert list (each with monospace source domain), emergency contacts only if level is red.
    4. **WhatsApp OG preview**: paste `${PREVIEW_URL}/estado/sp` into WhatsApp Web. Wait for unfurl. Confirm: state name + level + share URL appear. Repeat for `/estado/rj` and `/estado/am`.
    5. **JS-off**: in browser devtools, Settings → Debugger → "Disable JavaScript". Reload `/`. Confirm: 27 cards still render, filter still works (click "Sul" → URL changes → server re-renders), map still shows shapes. Disable JS check on `/texto` too.
    6. **`/texto`**: 5 regional tables, each with row count matching region UFs. Click any row anchor → page scrolls to that state's `<article>`. Heading outline: h1 → 5×h2 → 27×h3.
    7. **Stale banner**: confirm CEMADEN stale banner (if data is >30 min old). Or wait, or query Upstash directly to confirm. (May be empty if data is fresh — that's OK.)
    8. **Share button**: on `/estado/sp` click "Compartilhar no WhatsApp" → opens wa.me with prefilled text matching `messages.share_text_template`. Click "Copiar link" → toast "Link copiado." appears.
    9. **Keyboard nav** (`/`): Tab through page. Confirm visible focus on each filter chip, each map state, each card CTA, each share button. No focus trap, no dead-ends.
    10. **Mobile 360px**: open Chrome DevTools device toolbar, set to 360px width. Confirm no horizontal scroll on `/`. Map appears below cards.

  </how-to-verify>
  <resume-signal>Type "approved" or list defects with route+selector.</resume-signal>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-23 | Tampering | A11Y regression | mitigate | axe-core CI gates merges |
| T-05-24 | DoS | Perf regression | mitigate | LHCI assertions block on perf<90 / LCP>2.5s / transfer>200KB |
</threat_model>

<verification>
- `pnpm test:e2e` green (all specs)
- `pnpm exec lhci autorun` green
- Human checkpoint approved
</verification>

<success_criteria>

- Phase 5 acceptance criteria #1-34 all green
- Branch ready for PR
  </success_criteria>

<output>
Create `.planning/phases/05-cemaden-dashboard-ui/05-12-SUMMARY.md` with LHCI scores per route + axe violation count (expected 0).
</output>
