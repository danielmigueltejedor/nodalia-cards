import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadWeatherApi() {
  const sandbox = {
    URL,
    window: null,
    customElements: { define() {}, get() { return null; } },
    HTMLElement: class {},
    globalThis: null,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-weather-card.js"), sandbox);
  const api = sandbox.window.__NODALIA_WEATHER__ || sandbox.__NODALIA_WEATHER__;
  assert.ok(api, "weather public API should be registered");
  return api;
}

test("weather card registers custom element and bundle entry", () => {
  const source = read("nodalia-weather-card.js");
  assert.match(source, /defineLazyCustomElement\(CARD_TAG, loadNodaliaWeatherCard/);
  assert.match(source, /window\.__NODALIA_WEATHER__/);
  assert.match(read("scripts/build-bundle.mjs"), /src\/cards\/weather\/index\.ts/);
  assert.match(read("scripts/build-src-cards.mjs"), /src\/cards\/weather\/standalone\.ts/);
});

test("weather public API normalizes entity and actions", () => {
  const api = loadWeatherApi();
  assert.equal(api.CARD_TAG, "nodalia-weather-card");
  const config = api.normalizeConfig({
    entity: "weather.home",
    tap_action: "more-info",
    double_tap_action: "bogus",
  });
  assert.equal(config.entity, "weather.home");
  assert.equal(config.tap_action, "more-info");
  assert.equal(config.double_tap_action, "none");
});
