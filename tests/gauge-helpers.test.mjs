import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";
function load(extra = {}) {
  const box = { ...extra }; box.window = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync("nodalia-utils.js", "utf8"), box);
  vm.runInContext(buildSync({ entryPoints: ["src/cards/circular-gauge/circular-gauge-helpers.ts"], bundle: true, write: false, format: "iife", globalName: "api" }).outputFiles[0].text, box);
  return box.api;
}
const api = load();
const plain = value => JSON.parse(JSON.stringify(value));

test("Gauge missing numeric values stay absent and actual zeros retain locale formatting", () => {
  for (const value of [null, undefined, "", " ", false, [], {}, NaN, Infinity]) assert.equal(api.formatNumberValue(value), "--");
  assert.equal(api.formatNumberValue(0, 1, "es"), "0,0");
  assert.equal(api.formatNumberValue("2.5", 1, "en"), "2.5");
  assert.equal(api.formatNumberValue(5, NaN, "en"), "5");
  assert.equal(api.inferDecimals("-2,3456"), 3);
  assert.equal(api.getStepPrecision("0.01"), 2);
});

test("Gauge detects theme luminance from modern translucent RGB and percentage colors", () => {
  assert.deepEqual(plain(api.parseRgbColor("color(srgb 0 0.5 1 / 0.25)")), { red: 0, green: 127.5, blue: 255 });
  assert.deepEqual(plain(api.parseRgbColor("rgb(100% 0% 0% / 50%)")), { red: 255, green: 0, blue: 0 });
  assert.deepEqual(plain(api.parseRgbColor("#11223344")), { red: 17, green: 34, blue: 51 });
  assert.equal(api.parseRgbColor("rgb(bad, 1, 2, 3)"), null);
  assert.equal(api.getRelativeLuminance(api.parseRgbColor("#000")), 0);
  assert.equal(api.getRelativeLuminance(api.parseRgbColor("#fff")), 1);
});

test("Gauge color probes are removed even when computed style throws", () => {
  let removed = 0;
  const probe = { style: {}, remove: () => { removed++; } };
  const context = { appendChild: element => assert.equal(element, probe) };
  const failing = load({ document: { createElement: () => probe }, getComputedStyle: () => { throw new Error("computed style failed"); } });
  assert.throws(() => failing.resolveColorInContext(context, "var(--color)"), /computed style failed/);
  assert.equal(removed, 1);
});

test("Gauge retains dial marker geometry and continuous thumb rotation across the wrap", () => {
  assert.deepEqual(plain(api.getDialMarkerCoordinates(0)), { x: 206, y: 120 });
  assert.deepEqual(plain(api.getDialMarkerPosition(90)), { left: 50, top: 85.833 });
  assert.equal(api.getDialThumbRotate(135), 225);
  assert.equal(api.getContinuousThumbRotate(null, 135), 225);
  assert.equal(api.getContinuousThumbRotate(440, 0), 450);
  assert.equal(api.getContinuousThumbRotate(100, 350), 80);
});

test("Gauge preserves automatic unit ranges and adjusts stub ranges from the selected entity", () => {
  const state = { entity_id: "sensor.power", state: "200", attributes: { friendly_name: "Power", unit_of_measurement: "W" } };
  assert.equal(api.inferReasonableMax(200, "W", state), 2500);
  assert.equal(api.inferReasonableMax(2, "kW", state), 10);
  assert.equal(api.inferReasonableMax(5, "%", null), 100);
  assert.equal(api.inferReasonableMax(5, "l/min", state), 60);
  assert.equal(api.inferReasonableMax(450, "", null), 500);
  const config = { entity: "", name: "", max: "" };
  assert.equal(api.applyStubEntity(config, { states: { "sensor.power": state } }, ["sensor"], ["sensor.power"]), config);
  assert.equal(config.entity, "sensor.power");
  assert.equal(config.max, 250);
  assert.equal(config.min, 0);
});

test("Gauge tint interpolation preserves stops and handles malformed scale entries", () => {
  assert.equal(api.getGaugeSvgFallbackColor(0), "rgb(126, 136, 146)");
  assert.equal(api.getGaugeSvgFallbackColor(1), "rgb(255, 125, 87)");
  assert.equal(api.resolveGaugeTintColor([{ offset: 0, color: "red" }, { offset: 1, color: "blue" }], 0.5), "color-mix(in srgb, red 50%, blue 50%)");
  assert.equal(api.resolveGaugeTintColor([null, { offset: NaN, color: false }], 1), "#ff7d57");
  assert.equal(api.resolveGaugeSvgStrokeColor("var(--color)", "red"), "red");
});

test("Gauge checked style projection rejects malformed groups without losing configurable leaves", () => {
  const styles = api.getSafeStyles({ card: false, icon: [], gauge: { size: "300px", stroke: "2px; bad" }, title_size: "21px" });
  assert.equal(styles.title_size, "21px");
  assert.equal(styles.gauge.size, "300px");
  assert.equal(styles.gauge.stroke, "18px");
  assert.equal(styles.card.padding, "16px");
});
