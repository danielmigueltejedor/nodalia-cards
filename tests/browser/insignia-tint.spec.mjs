import { expect, test } from "@playwright/test";

test("Insignia retains legacy preset tint and guards malformed CSS branches on real cards", async ({ page }) => {
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-insignia-card"));
  const result = await page.evaluate(() => {
    const hass = window.createHassFixture({ entities: { "input_boolean.example": { state: "on", attributes: { friendly_name: "Example" } } } });
    const mount = config => {
      const card = document.createElement("nodalia-insignia-card");
      card.setConfig({ entity: "input_boolean.example", ...config });
      card.hass = hass;
      document.querySelector("#fixture").append(card);
      return card;
    };
    const red = mount({ color: "red", styles: { icon: true } });
    const explicit = mount({ color: "red", styles: { tint: { color: "#123456" } } });
    const presetColor = red._getTintColor(hass.states["input_boolean.example"]);
    const explicitColor = explicit._getTintColor(hass.states["input_boolean.example"]);
    const icon = red.shadowRoot.querySelector(".insignia-card__icon");
    const rect = icon.getBoundingClientRect();
    red.setConfig({ entity: "input_boolean.example", color: "blue", styles: { tint: null } });
    return { presetColor, explicitColor, size: [rect.width, rect.height], updatedColor: red._getTintColor(hass.states["input_boolean.example"]), title: explicit.shadowRoot.querySelector(".insignia-card__title").textContent };
  });
  expect(result.presetColor).toBe("#ff6b6b");
  expect(result.explicitColor).toBe("#123456");
  expect(result.updatedColor).toBe("#4da3ff");
  expect(result.size[0]).toBeGreaterThan(0);
  expect(result.size[0]).toBeCloseTo(result.size[1], 0);
  expect(result.title).toBe("Example");
  const errors = await page.evaluate(() => window.bundleErrors);
  expect(errors).toEqual([]);
});
