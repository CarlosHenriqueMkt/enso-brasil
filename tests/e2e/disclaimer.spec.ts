import { test, expect } from "@playwright/test";

test("home renders <html lang='pt-BR'> and skip link is reachable via Tab", async ({ page }) => {
  await page.goto("/");
  const lang = await page.locator("html").getAttribute("lang");
  expect(lang).toBe("pt-BR");
  const skipLink = page.locator('a[href="#main"]');
  await expect(skipLink).toHaveText(/Pular para o conteúdo principal/);
});

test("disclaimer renders SSR with all 3 emergency contacts paired with agency names (JS disabled)", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("/");
  const html = await page.content();
  expect(html).toContain("199");
  expect(html).toContain("Defesa Civil");
  expect(html).toContain("193");
  expect(html).toContain("Bombeiros");
  expect(html).toContain("190");
  expect(html).toContain("Polícia");
  expect(html).toMatch(/não substitui sistemas oficiais/i);
  await ctx.close();
});
