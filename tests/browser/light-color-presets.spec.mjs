import { expect, test } from "@playwright/test";

test("Light normalized color preset sends a finite HS pair and preserves the four-slot limit", async ({ page }) => {
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-light-card"));
  await page.evaluate(() => {
    window.lightPresetCalls = [];
    const card = document.createElement("nodalia-light-card");
    card.setConfig({ entity: "light.room", compact_layout_mode: "never", show_quick_color_presets: true, animations: { enabled: false }, haptics: { enabled: false }, color_presets: [
      { color: "f00", label: "Red" }, { color: "#0f0", label: "Green" }, { color: "#00f", label: "Blue" }, { color: "#fff", label: "White" }, { color: "#123456", label: "Extra" },
    ] });
    card.hass = window.createHassFixture({ entities: { "light.room": { state: "on", attributes: { brightness: 180, supported_color_modes: ["hs"], color_mode: "hs", hs_color: [0, 50] } } }, overrides: {
      callService: async (domain, service, data) => { window.lightPresetCalls.push({ domain, service, data }); },
    } });
    document.querySelector("#fixture").append(card);
  });
  const card = page.locator("nodalia-light-card");
  await card.locator('[data-light-action="mode"][data-mode="color"]').click();
  const presets = card.locator('[data-light-action="color"]');
  await expect(presets).toHaveCount(4);
  await expect(presets.first()).toHaveAttribute("data-hs", "0,100");
  await presets.first().click();
  await expect.poll(() => page.evaluate(() => window.lightPresetCalls)).toEqual([
    { domain: "light", service: "turn_on", data: { entity_id: "light.room", hs_color: [0, 100] } },
  ]);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
