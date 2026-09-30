import { expect, test } from "@playwright/test";

test("Graph renders real zeros and accepts malformed history/statistics rows without fabricating blank readings", async ({ page }) => {
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-graph-card"));
  await page.evaluate(() => {
    window.graphFixtures = {};
    for (const source of ["history", "statistics"]) {
      const entity = "sensor." + source;
      const card = document.createElement("nodalia-graph-card");
      card.dataset.source = source;
      card.setConfig({ entity, language: "en", points: 50.8, animations: { enabled: false } });
      const callWS = async request => {
        if (request.type === "history/history_during_period") return { [entity]: source === "history" ? [
          null, { last_changed: request.start_time, state: "" },
          { last_changed: request.start_time, state: "0" }, { last_changed: request.end_time, state: "5" },
        ] : [null] };
        if (request.type === "recorder/statistics_during_period") return { [entity]: [
          null, { start: request.start_time, mean: null, state: "" },
          { start: request.start_time, mean: 0 }, { start: request.end_time, mean: 5 },
        ] };
        return {};
      };
      card.hass = window.createHassFixture({ entities: { [entity]: { state: "", attributes: { unit_of_measurement: "W" } } }, overrides: { callWS } });
      document.querySelector("#fixture").append(card);
      window.graphFixtures[source] = { card, callWS, entity };
    }
  });
  for (const source of ["history", "statistics"]) {
    const card = page.locator(`nodalia-graph-card[data-source="${source}"]`);
    await expect.poll(() => page.evaluate(source => window.graphFixtures[source].card._historySeries[0]?.rawEventCount, source)).toBe(2);
    await expect(card.locator(".graph-card__value-number")).toHaveText("--");
    const paths = await card.locator("svg path[d]").evaluateAll(nodes => nodes.map(node => node.getAttribute("d")));
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every(path => !/NaN|Infinity|undefined/.test(path))).toBe(true);
    await page.evaluate(source => {
      const fixture = window.graphFixtures[source];
      fixture.card.hass = window.createHassFixture({ entities: { [fixture.entity]: { state: "0", attributes: { unit_of_measurement: "W" } } }, overrides: { callWS: fixture.callWS } });
    }, source);
    await expect(card.locator(".graph-card__value-number")).toHaveText("0");
  }
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
