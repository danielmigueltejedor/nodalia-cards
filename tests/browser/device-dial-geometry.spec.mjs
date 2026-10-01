import { expect, test } from "@playwright/test";

const cards = [
  { card: "fan", prefix: "fan", entity: "fan.room", service: "set_percentage", field: "percentage", value: 50, attributes: { percentage: 25, percentage_step: 1, supported_features: 1 } },
  { card: "humidifier", prefix: "humidifier", entity: "humidifier.room", service: "set_humidity", field: "humidity", value: 50, attributes: { humidity: 40, min_humidity: 30, max_humidity: 70, supported_features: 1 } },
  { card: "cover", prefix: "fan", entity: "cover.room", service: "set_cover_position", field: "position", value: 50, attributes: { current_position: 25, supported_features: 4 } },
];

for (const config of cards) {
  test(`${config.card} circular pointer commits the middle of its range once`, async ({ page }) => {
    await page.goto("/tests/fixtures/browser.html");
    await page.waitForFunction(card => customElements.get(`nodalia-${card}-card`), config.card);
    await page.evaluate(config => {
      window.dialCalls = [];
      const card = document.createElement(`nodalia-${config.card}-card`);
      card.setConfig({ entity: config.entity, layout: "circular", animations: { enabled: false }, haptics: { enabled: false } });
      card.hass = window.createHassFixture({ entities: { [config.entity]: { state: config.card === "cover" ? "open" : "on", attributes: config.attributes } }, overrides: {
        callService: async (domain, service, data) => { window.dialCalls.push({ domain, service, data }); },
      } });
      document.querySelector("#fixture").append(card);
    }, config);
    const dial = page.locator(`nodalia-${config.card}-card`).locator(`.${config.prefix}-card__circular-dial`);
    await expect(dial).toBeVisible();
    let box;
    // The deferred initial resize can replace the dial between layout reads.
    await expect.poll(async () => {
      box = await dial.boundingBox();
      return Boolean(box && box.width > 0 && box.height > 0);
    }).toBe(true);
    // The arc's midpoint is at the top of the circle (270 degrees).
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * (0.5 - 86 / 240));
    await page.mouse.down();
    expect(await page.evaluate(() => window.dialCalls.length)).toBe(0);
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => window.dialCalls)).toEqual([
      { domain: config.card, service: config.service, data: { entity_id: config.entity, [config.field]: config.value } },
    ]);
    await expect(dial).not.toHaveClass(/is-dragging/);
  });
}
