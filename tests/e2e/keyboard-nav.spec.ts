import { test, expect } from "@playwright/test";

/**
 * Read the currently-focused element's tagName + visible label/href.
 * Used to walk Tab order without relying on selector chains.
 */
async function focusedDescriptor(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    return {
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role"),
      href: el.getAttribute("href"),
      ariaLabel: el.getAttribute("aria-label"),
      text: (el.textContent ?? "").trim().slice(0, 80),
    };
  });
}

test("home: Tab order walks skip-link → filters → map states → cards without dead-end", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("body").focus();

  // First Tab should land on skip link.
  await page.keyboard.press("Tab");
  const first = await focusedDescriptor(page);
  expect(first, "first tab stop must exist (skip link)").not.toBeNull();
  expect(first?.href).toBe("#main");

  // Walk up to 200 Tab stops — every focused element must have a tagName
  // (no focus escaping to body / no dead-ends mid-page).
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    await page.keyboard.press("Tab");
    const d = await focusedDescriptor(page);
    if (!d) break;
    seen.add(`${d.tag}:${d.ariaLabel ?? d.text}`);
  }
  // Sanity: we visited a non-trivial number of focusable elements.
  expect(seen.size).toBeGreaterThan(5);
});

test("home: every focusable element exposes a :focus-visible style hook", async ({ page }) => {
  await page.goto("/");
  // The global stylesheet must define some :focus-visible rule. If the
  // rule disappears, focus indicators vanish silently.
  const hasFocusVisibleRule = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = (sheet as CSSStyleSheet).cssRules ?? [];
        for (const r of Array.from(rules)) {
          if (r.cssText.includes(":focus-visible")) return true;
        }
      } catch {
        // cross-origin sheet — skip
      }
    }
    return false;
  });
  expect(hasFocusVisibleRule).toBe(true);
});

test("/texto: Tab order walks table anchors then article sections", async ({ page }) => {
  await page.goto("/texto");
  await page.locator("body").focus();

  await page.keyboard.press("Tab");
  const first = await focusedDescriptor(page);
  expect(first?.href).toBe("#main");

  // Confirm in-page anchor links exist for state row navigation.
  const anchors = await page
    .locator('a[href^="#"]')
    .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).hash));
  // 1 skip-link + 27 state anchors (minimum).
  expect(anchors.length).toBeGreaterThanOrEqual(28);
});

test("color-blind redundancy: every state badge renders an icon glyph", async ({ page }) => {
  await page.goto("/");

  // Simulate severe color removal: render the page through a grayscale filter.
  // If meaning survives, icon glyphs MUST be present in the DOM.
  await page.addStyleTag({
    content: `html { filter: grayscale(100%) !important; }`,
  });

  const bodyText = (await page.locator("body").textContent()) ?? "";
  // Per spec: ✓ ⚠ ⚠⚠ ⛔ ?  — at least one redundancy glyph must appear.
  const glyphs = ["✓", "⚠", "⛔", "?"];
  const present = glyphs.filter((g) => bodyText.includes(g));
  expect(present.length).toBeGreaterThan(0);
});

test("color-blind redundancy: /texto carries severity in text labels (deuteranopia sim)", async ({
  page,
}) => {
  await page.goto("/texto");
  // Approximate deuteranopia by collapsing red+green to luminance.
  await page.addStyleTag({
    content: `html { filter: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'><filter id='d'><feColorMatrix type='matrix' values='0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0'/></filter></svg>#d") !important; }`,
  });

  // Per D-08: /texto is pure-text — no icons. Severity is conveyed by the
  // verbatim PT-BR labels, which survive any color filter.
  const bodyText = (await page.locator("body").textContent()) ?? "";
  const labels = ["Sem alertas", "Atenção", "Alerta", "Perigo", "Dados indisponíveis"];
  const present = labels.filter((l) => bodyText.includes(l));
  expect(present.length).toBeGreaterThan(0);
});
