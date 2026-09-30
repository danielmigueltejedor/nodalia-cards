import { expect, test } from "@playwright/test";

test("Theme variable colors resolve immediately after a change and modern translucent blue retains contrast", async ({ page }) => {
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => window.NodaliaBubbleContrast);
  const result = await page.evaluate(() => {
    const api = window.NodaliaBubbleContrast;
    const state = { entity_id: "light.room", state: "on", attributes: {} };
    const spansBefore = document.body.querySelectorAll("span").length;
    document.documentElement.style.setProperty("--contrast-test-tint", "#ff8800");
    const firstHue = api.parseCssColorHue("var(--contrast-test-tint)");
    document.documentElement.style.setProperty("--contrast-test-tint", "#0000ff");
    const nextHue = api.parseCssColorHue("var(--contrast-test-tint)");
    return { firstHue, nextHue, dark: api.shouldDarkenBubbleIconGlyph(state, "color(srgb 0 0 1 / .24)"), leaked: document.body.querySelectorAll("span").length - spansBefore };
  });
  expect(result.firstHue).toBeCloseTo(32, 1);
  expect(result.nextHue).toBeCloseTo(240, 1);
  expect(result.dark).toBe(true);
  expect(result.leaked).toBe(0);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
