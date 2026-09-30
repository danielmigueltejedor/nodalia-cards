import { expect, test } from "@playwright/test";

for (const layout of ["grid", "list", "single"]) {
  test(`Scenes ${layout} activates once and reflects renamed entities`, async ({ page }) => {
    await page.goto("/tests/fixtures/browser.html");
    await page.waitForFunction(() => customElements.get("nodalia-scenes-card"));
    await page.evaluate(layout => {
      window.calls = [];
      window.sceneHass = window.createHassFixture({ entities: {
        "scene.evening": { state: "scening", attributes: { friendly_name: "Evening", icon: "mdi:weather-night" } },
      }, overrides: { callService: async (domain, service, data) => { window.calls.push({ domain, service, data }); } } });
      const card = document.createElement("nodalia-scenes-card");
      card.setConfig({ layout, scenes: ["scene.evening"], animations: { enabled: false } });
      card.hass = window.sceneHass;
      document.querySelector("#fixture").append(card);
    }, layout);
    const card = page.locator("nodalia-scenes-card");
    await card.locator('[data-scene-entity="scene.evening"]').click();
    await expect.poll(() => page.evaluate(() => window.calls)).toEqual([
      { domain: "scene", service: "turn_on", data: { entity_id: "scene.evening" } },
    ]);
    await page.evaluate(() => {
      window.sceneHass.states["scene.evening"] = { ...window.sceneHass.states["scene.evening"], attributes: { friendly_name: "Relax", icon: "mdi:sofa" } };
      document.querySelector("nodalia-scenes-card").hass = window.sceneHass;
    });
    await expect(card.locator('[data-scene-entity="scene.evening"]')).toHaveAttribute("aria-label", "Relax");
    await expect(card.locator('ha-icon[icon="mdi:sofa"]')).toHaveCount(1);
  });
}
