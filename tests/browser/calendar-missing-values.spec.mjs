import { expect, test } from "@playwright/test";

test("Calendar filters malformed events and renders forecast alternatives without inventing zero temperatures", async ({ page }) => {
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-calendar-card"));
  await page.evaluate(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const card = document.createElement("nodalia-calendar-card");
    card.setConfig({ calendars: ["calendar.home"], weather_entity: "weather.home", animations: { enabled: false } });
    card.hass = window.createHassFixture({ entities: {
      "calendar.home": { state: "off", attributes: { friendly_name: "Home" } },
      "weather.home": { state: "clear-night", attributes: { forecast: [{ date: today, temperature: null, temperature_max: 12, templow: "", temperature_min: 0, condition: "clear-night" }] } },
    }, overrides: { callApi: async () => ({ events: [null, "invalid", [], { start: { date: today }, end: { date: today }, summary: "All-day test" }] }) } });
    document.querySelector("#fixture").append(card);
    window.calendarFixture = card;
  });
  const card = page.locator("nodalia-calendar-card");
  await expect(card.locator("ha-card .calendar-event__summary")).toContainText("All-day test");
  await expect(card.locator("ha-card .calendar-day__weather span")).toHaveText("0° / 12°");
  await expect(card.locator("ha-card .calendar-day__weather ha-icon")).toHaveAttribute("icon", "mdi:weather-night");
  expect(await page.evaluate(() => window.calendarFixture._events.length)).toBe(1);
  await page.evaluate(() => {
    const card = window.calendarFixture;
    card._hass.states['weather.home'].attributes = { temperature: null, native_temperature: '', templow: null };
    card._applyWeatherForecastRows([]);
    card._renderIfChanged(true);
  });
  await expect(card.locator("ha-card .calendar-day__weather span")).toHaveText("— / —");
  const scores = await page.evaluate(() => {
    const now = new Date();
    const key = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const value = { condition: 'sunny', tempMax: 12, tempMin: 0 };
    return [window.calendarFixture._scoreForecastMap(new Map([[key(yesterday), value]])), window.calendarFixture._scoreForecastMap(new Map([[key(now), value]]))];
  });
  expect(scores[1] - scores[0]).toBe(10000);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
