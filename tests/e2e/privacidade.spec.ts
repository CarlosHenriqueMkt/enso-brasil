import { test, expect } from "@playwright/test";

test("/privacidade renders all 7 LGPD sections SSR (JS disabled)", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("/privacidade");
  const html = await page.content();
  expect(html).toMatch(/O que coletamos/i);
  expect(html).toMatch(/Por quanto tempo/i);
  expect(html).toMatch(/Para qu[êe]/i);
  expect(html).toMatch(/O que NÃO coletamos/i);
  expect(html).toMatch(/Direitos do titular/i);
  expect(html).toMatch(/Contato/i);
  expect(html).toMatch(/Vers[ãa]o/i);
  expect(html).toMatch(/LGPD/);
  await ctx.close();
});
