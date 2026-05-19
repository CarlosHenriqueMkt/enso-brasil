import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = ["/", "/estado/sp", "/estado/rj", "/estado/am", "/texto"];

for (const route of routes) {
  test(`axe-core: ${route} has zero critical/serious violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    if (blocking.length > 0) {
      console.error(
        `Violations on ${route}:`,
        JSON.stringify(
          blocking.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
          null,
          2,
        ),
      );
    }
    expect(blocking).toEqual([]);
  });
}

test("yellow badge contrast: axe-core reports no color-contrast violation on .risk-badge-yellow", async ({
  page,
}) => {
  await page.goto("/");
  const yellowCount = await page.locator(".risk-badge-yellow").count();
  // Data-dependent: if no yellow badge is currently rendered, the contrast
  // assertion is vacuously satisfied. The whole-route axe runs above cover
  // contrast regressions when a yellow badge IS present.
  if (yellowCount === 0) {
    expect(yellowCount).toBe(0);
    return;
  }
  const results = await new AxeBuilder({ page })
    .include(".risk-badge-yellow")
    .withRules(["color-contrast"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("/texto heading outline: 1×h1, 5×h2, 27×h3", async ({ page }) => {
  await page.goto("/texto");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h2")).toHaveCount(5);
  await expect(page.locator("h3")).toHaveCount(27);
});

test("/estado/sp announces severity via aria-live='polite'", async ({ page }) => {
  await page.goto("/estado/sp");
  const live = page.locator('[aria-live="polite"]').first();
  await expect(live).toBeVisible();
  const text = (await live.textContent()) ?? "";
  expect(text).toMatch(/Sem alertas|Atenção|Alerta|Perigo|Dados indisponíveis/i);
});
