import { expect, test } from "@playwright/test";

test("Gauge keeps automatic bounds, inferred decimals, explicit zeros and absent native readings distinct", async ({ page }) => {
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-circular-gauge-card"));
  await page.evaluate(() => {
    const card = document.createElement("nodalia-circular-gauge-card");
    card.setConfig({ entity: "sensor.reading", language: "en", animations: { enabled: false } });
    card.hass = window.createHassFixture({ entities: { "sensor.reading": { state: "12.5", attributes: { unit_of_measurement: "W", min: null, max: null } } } });
    document.querySelector("#fixture").append(card);
    window.gaugeTestCard = card;
  });
  const card = page.locator("nodalia-circular-gauge-card");
  await expect(card.locator(".gauge-card__value")).toHaveText("12.5 W");
  await expect(card.locator(".gauge-card__range-label--max")).toHaveText("2,500.0");
  await page.evaluate(() => {
    window.gaugeTestCard.setConfig({ entity: "sensor.reading", language: "en", min: 0, max: 50, decimals: 0, animations: { enabled: false } });
    window.gaugeTestCard.hass = window.createHassFixture({ entities: { "sensor.reading": { state: "0", attributes: { unit_of_measurement: "W" } } } });
  });
  await expect(card.locator(".gauge-card__value")).toHaveText("0 W");
  await expect(card.locator(".gauge-card__range-label--min")).toHaveText("0");
  await expect(card.locator(".gauge-card__range-label--max")).toHaveText("50");
  await page.evaluate(() => {
    window.gaugeTestCard.setConfig({ entity: "sensor.reading", language: "en", animations: { enabled: false } });
    window.gaugeTestCard.hass = window.createHassFixture({ entities: { "sensor.reading": { state: "2,5", attributes: { friendly_name: "Power", unit_of_measurement: "kW" } } } });
  });
  await expect(card.locator(".gauge-card__value")).toHaveText("2.5 kW");
  await expect(card.locator(".gauge-card__range-label--max")).toHaveText("10.0");
  await page.evaluate(() => {
    window.gaugeTestCard.hass = window.createHassFixture({ entities: { "sensor.reading": { state: "unknown", attributes: { unit_of_measurement: "W", native_value: null } } } });
  });
  await expect(card.locator(".gauge-card__value")).toHaveText("-- W");
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
