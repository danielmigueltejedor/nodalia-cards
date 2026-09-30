import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";

function load(localized = false) {
  const sandbox = { Date };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync("nodalia-utils.js", "utf8"), sandbox);
  if (localized) vm.runInContext(fs.readFileSync("nodalia-i18n.js", "utf8"), sandbox);
  vm.runInContext(buildSync({ entryPoints: ["src/cards/weather/weather-helpers.ts"], bundle: true, write: false, format: "iife", globalName: "api" }).outputFiles[0].text, sandbox);
  return sandbox.api;
}
const api = load();
const plain = value => JSON.parse(JSON.stringify(value));
const state = (value, attrs = {}) => ({ entity_id: "weather.one", state: value, attributes: attrs });

test("Weather missing numeric values stay absent while actual zeros and numeric strings remain visible", () => {
  for (const value of [null, undefined, "", "  ", false, [], {}, NaN, Infinity]) {
    assert.equal(api.formatNumber(value), null);
    assert.equal(api.formatCompactTemperature(value), "");
    assert.equal(api.getForecastTemperatureSeriesValue({ temperature: value }, "high"), null);
  }
  assert.equal(api.formatNumber(0), "0");
  assert.equal(api.formatNumber("2.4"), "2.4");
  assert.equal(api.formatCompactTemperature(0), "0°");
  assert.equal(api.getForecastTemperatureValue({ temperature: null, templow: -2 }, "daily"), -2);
  assert.equal(api.getForecastTemperatureValue({ temperature: 0, templow: -2 }, "daily"), 0);
});

test("Weather absent rain probability does not mask precipitation amount with a fabricated zero percent", () => {
  assert.equal(api.getForecastPrecipitationLabel({ precipitation_probability: null, precipitation: 2 }, "mm"), "2 mm");
  assert.equal(api.getForecastPrecipitationLabel({ precipitation_probability: 0, precipitation: 2 }, "mm"), "0%");
  assert.equal(api.getForecastPrecipitationLabel({ precipitation: 0 }, "mm"), "0 mm");
  assert.equal(api.getForecastPrecipitationLabel({ precipitation_probability: null, precipitation: null }, "mm"), "");
});

test("Weather date helpers keep actual timestamps but do not turn missing dates into the epoch", () => {
  for (const value of [null, undefined, "bad", [], {}]) {
    assert.equal(api.formatForecastDateTime(value, "hourly", "en-GB"), "");
  }
  assert.equal(api.formatMeteoalarmDate(null, null, "en"), "");
  assert.notEqual(api.formatForecastDateTime(0, "hourly", "en-GB"), "");
  assert.notEqual(api.formatForecastDateTime("2026-01-15T12:00:00Z", "daily", "en-GB"), "");
});

test("Weather keeps feature masks, temperature color stops and separate condition/temperature chart palettes", () => {
  assert.deepEqual(plain(api.getSupportedForecastTypes(state("sunny", { supported_features: 2 }))), ["hourly"]);
  assert.deepEqual(plain(api.getSupportedForecastTypes(state("sunny", { supported_features: 1 }))), ["daily"]);
  assert.deepEqual(plain(api.getSupportedForecastTypes(null)), ["hourly", "daily"]);
  assert.equal(api.getTemperatureScaleColor(-100), "rgb(22, 58, 143)");
  assert.equal(api.getTemperatureScaleColor(100), "rgb(140, 28, 28)");
  assert.equal(api.getTemperatureScaleColor(18), "rgb(238, 206, 76)");
  assert.equal(api.getForecastChartPointColor({ item: { condition: "sunny" }, value: 18 }, "condition", "cloudy"), "#ffd65b");
  assert.equal(api.getForecastChartPointColor({ item: { condition: "sunny" }, value: 18 }, "temperature", "cloudy"), "rgb(238, 206, 76)");
});

test("Weather keeps condition/Meteoalarm mappings and delegates translations to the shipped runtime", () => {
  assert.equal(api.getConditionIcon("lightning-rainy"), "mdi:weather-lightning-rainy");
  assert.equal(api.getMeteoalarmAccentColor(state("on", { awareness_level: "3; orange; Severe" })), "#ff9b4a");
  assert.deepEqual(plain(api.getMeteoalarmAwarenessParts(state("on", { awareness_level: "3; orange; Severe" }))), { color: "orange", label: "Severe", level: "3" });
  const localized = load(true);
  assert.equal(localized.translateCondition("sunny", { states: {}, language: "es" }, "es"), "Soleado");
  assert.equal(localized.translateMeteoalarmValue("moderate", { states: {}, language: "es" }, "es"), "Moderado");
});

test("Weather retains unit aliases and source wind/temperature interpretation", () => {
  for (const value of ["metric", "eu", "european"]) assert.equal(api.normalizeUnitSystem(value), "metric");
  for (const value of ["us", "american"]) assert.equal(api.normalizeUnitSystem(value), "imperial");
  assert.equal(api.normalizeTemperatureUnitPreference("centigrade"), "c");
  assert.equal(api.normalizeTemperatureUnitPreference("fahrenheit"), "f");
  assert.equal(api.normalizeWindUnitPreference("kilometres_per_hour"), "kmh");
  assert.equal(api.normalizeWindUnitFromState("m/s"), "ms");
  assert.equal(api.normalizeWindUnitFromState("mph"), "mph");
});

test("Shared Weather/Insignia compaction preserves false, zero and empty arrays while rejecting unsafe keys", () => {
  const input = JSON.parse('{"false":false,"zero":0,"empty":"","items":["",2,[]],"nested":{"empty":null,"yes":1},"__proto__":{"polluted":true}}');
  assert.deepEqual(plain(api.compactConfig(input)), { false: false, zero: 0, items: [2, []], nested: { yes: 1 } });
  assert.equal(Object.prototype.polluted, undefined);
});
