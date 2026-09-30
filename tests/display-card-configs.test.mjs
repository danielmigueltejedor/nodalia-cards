import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";

function load(card) {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync("nodalia-utils.js", "utf8"), sandbox);
  vm.runInContext(buildSync({ entryPoints: [`src/cards/${card}/${card}-config.ts`], bundle: true, write: false, format: "iife", globalName: "api" }).outputFiles[0].text, sandbox);
  return sandbox.api;
}
const plain = value => JSON.parse(JSON.stringify(value));
const weather = load("weather");
const gauge = load("circular-gauge");
const news = load("news");

test("Display configs guard malformed YAML/styles and retain extensions without mutating input", () => {
  for (const api of [weather, gauge, news]) {
    for (const value of [null, 7, false, "bad", [], { styles: true }, { styles: { card: null, icon: true } }]) assert.deepEqual(plain(api.normalizeConfig(value).styles), plain(api.DEFAULT_CONFIG.styles));
    const raw = { entity: "sensor.one", extension: { retained: true }, styles: { card: { padding: "18px", background: "red;display:none" } } };
    const before = plain(raw);
    const config = api.normalizeConfig(raw);
    assert.equal(config.styles.card.padding, "18px");
    assert.equal(config.styles.card.background, api.DEFAULT_CONFIG.styles.card.background);
    assert.deepEqual(plain(config.extension), { retained: true });
    assert.deepEqual(raw, before);
  }
});

test("Weather keeps its restricted actions and unchanged forecast/unit configuration", () => {
  const config = weather.normalizeConfig({ entity: "weather.one", tap_action: " NONE ", hold_action: "toggle", double_tap_action: "MORE-INFO", forecast_type: "daily", forecast_slots_daily: "12", temperature_unit: "fahrenheit", wind_speed_unit: "mph" });
  assert.equal(config.tap_action, "none");
  assert.equal(config.hold_action, "more-info");
  assert.equal(config.double_tap_action, "more-info");
  assert.equal(config.forecast_type, "daily");
  assert.equal(config.forecast_slots_daily, "12");
  assert.equal(config.temperature_unit, "fahrenheit");
  assert.equal(config.wind_speed_unit, "mph");
});

test("Circular Gauge retains numeric/string bounds, custom units and optional foreground tint", () => {
  const config = gauge.normalizeConfig({ min: "-20", max: 90, decimals: "1", unit: "%", start_from_zero: false, styles: { gauge: { foreground_color: "#123456", size: "220px" } } });
  assert.equal(config.min, "-20");
  assert.equal(config.max, 90);
  assert.equal(config.decimals, "1");
  assert.equal(config.start_from_zero, false);
  assert.equal(config.styles.gauge.foreground_color, "#123456");
  assert.equal(config.styles.gauge.size, "220px");
  assert.equal(gauge.normalizeConfig({}).styles.gauge.foreground_color, "");
  assert.equal(gauge.normalizeConfig({ styles: { gauge: { foreground_color: "#123456;<style>" } } }).styles.gauge.foreground_color, "");
});

test("News narrows source rows and preserves entity aliases, filtering and history compatibility", () => {
  const config = news.normalizeConfig({ sources: [null, 7, "sensor.ignored", { entity_id: " sensor.one ", name: " One ", icon: " mdi:newspaper " }, { entity: "", entity_id: "sensor.ignored" }, { entity: "sensor.two", category: " World " }], filters: { hide_older_than: " 12h ", max_per_source: -3, include_keywords: ["one", 5], exclude_keywords: true }, history_entity: "input_text.old", history_helper: null, language: " ", max_items: 500 });
  assert.deepEqual(plain(config.sources), [{ entity: "sensor.one", name: "One", icon: "mdi:newspaper", category: "" }, { entity: "sensor.two", name: "", icon: "", category: "World" }]);
  assert.deepEqual(plain(config.filters), { hide_older_than: "12h", max_per_source: 0, include_keywords: ["one", "5"], exclude_keywords: [] });
  assert.equal(config.history_helper, "input_text.old");
  assert.equal(config.language, "auto");
  assert.equal(config.max_items, 50);
  assert.equal(news.normalizeConfig({ max_items: 0 }).max_items, 5);
  assert.equal(news.normalizeConfig({ max_items: -1 }).max_items, 1);
});

test("News layout/preset normalization retains defaults and explicit false visibility", () => {
  const config = news.normalizeConfig({ layout: { mode: "invalid", density: "invalid", show_images: false, show_summary: false }, appearance: true, sources: false, filters: null });
  assert.equal(config.layout.mode, news.DEFAULT_CONFIG.layout.mode);
  assert.equal(config.layout.density, news.DEFAULT_CONFIG.layout.density);
  assert.equal(config.layout.show_images, false);
  assert.equal(config.layout.show_summary, false);
  assert.equal(config.layout.show_source, true);
  assert.equal(config.appearance.preset, news.DEFAULT_CONFIG.appearance.preset);
  assert.deepEqual(plain(config.sources), []);
});
