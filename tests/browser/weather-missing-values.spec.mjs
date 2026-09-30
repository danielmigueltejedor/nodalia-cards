import { expect, test } from "@playwright/test";

test("Weather forecasts preserve real zero values and keep missing values distinct", async ({ page }) => {
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-weather-card"));
  await page.evaluate(() => {
    const card = document.createElement("nodalia-weather-card");
    card.setConfig({ entity: "weather.one", language: "en", forecast_type: "daily", show_forecast_details: true, animations: { enabled: false } });
    card.hass = window.createHassFixture({ entities: { "weather.one": { state: "sunny", attributes: { temperature: 10, temperature_unit: "°C", precipitation_unit: "mm", supported_features: 1, forecast: [
      { datetime: null, condition: "rainy", temperature: null, templow: null, precipitation_probability: null, precipitation: 2 },
      { datetime: "2026-10-01T12:00:00Z", condition: "sunny", temperature: 0, templow: 0, precipitation_probability: 0, precipitation: 2 },
      { datetime: "2026-10-02T12:00:00Z", condition: "sunny", temperature: 5, templow: null },
    ] } } } });
    document.querySelector("#fixture").append(card);
  });
  const items = page.locator("nodalia-weather-card .weather-card__forecast-item");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0).locator(".weather-card__forecast-temp")).toHaveText("--");
  await expect(items.nth(0).locator(".weather-card__forecast-rain")).toHaveText("2 mm");
  await expect(items.nth(0).locator(".weather-card__forecast-time")).toBeEmpty();
  await expect(items.nth(1).locator(".weather-card__forecast-temp")).toHaveText("0°C / 0°C");
  await expect(items.nth(1).locator(".weather-card__forecast-rain")).toHaveText("0%");
  await expect(items.nth(2).locator(".weather-card__forecast-temp")).toHaveText("5°C");
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
