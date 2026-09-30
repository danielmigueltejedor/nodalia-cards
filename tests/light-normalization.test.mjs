import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";

function load(part) {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync("nodalia-utils.js", "utf8"), sandbox);
  vm.runInContext(buildSync({ entryPoints: [`src/cards/light/light-${part}.ts`], bundle: true, write: false, format: "iife", globalName: "api" }).outputFiles[0].text, sandbox);
  return sandbox.api;
}
const plain = value => JSON.parse(JSON.stringify(value));
const api = load("config");
const helpers = load("helpers");

test("Light normalizes unknown YAML and primitive style/animation branches without crashing", () => {
  for (const value of [null, false, 7, "bad", [], { styles: { icon: true, card: null }, animations: true }]) {
    const normalized = api.normalizeConfig(value);
    assert.deepEqual(plain(normalized.styles), plain(api.DEFAULT_CONFIG.styles));
    assert.deepEqual(plain(normalized.quick_brightness), [10, 35, 65, 100]);
    assert.equal(normalized.animations.power_duration, 600);
  }
});

test("Light preserves brightness bounds, four preset slots and empty-list fallbacks", () => {
  const config = api.normalizeConfig({ quick_brightness: [-10, "35.4", "bad", 120, null], color_presets: [{ color: "F00", label: " Red " }, { color: "#abc" }, null, { color: "bad!" }, { color: "#00ff00" }] });
  assert.deepEqual(plain(config.quick_brightness), [1, 35, 100, 1]);
  assert.deepEqual(plain(config.color_presets), [{ color: "#ff0000", label: "Red" }, { color: "#aabbcc", label: "" }]);
  assert.deepEqual(plain(api.normalizeConfig({ quick_brightness: ["bad"], color_presets: [] }).quick_brightness), [10, 35, 65, 100]);
  assert.deepEqual(plain(api.normalizeConfig({ color_presets: true }).color_presets), plain(api.DEFAULT_CONFIG.color_presets));
});

test("Light keeps collapsed aliases, animation bounds, inactive-color migration and extension isolation", () => {
  const raw = {
    keep_collapsed: true, state_position: "BELOW", extension: { retained: true },
    animations: { enabled: false, power_duration: 9000, controls_duration: 1, mode_switch_duration: "bad", button_bounce_duration: 1500, mode_switch_horizontal: false },
    styles: { icon: { off_color: "var(--state-inactive-color, gray)" }, card: { padding: "18px", background: "red;display:none" } },
  };
  const before = plain(raw);
  const config = api.normalizeConfig(raw);
  assert.equal(config.auto_expand, false);
  assert.equal(Object.hasOwn(config, "keep_collapsed"), false);
  assert.equal(config.state_position, "below");
  assert.deepEqual(plain(config.animations), { enabled: false, power_duration: 4000, controls_duration: 120, mode_switch_duration: 600, button_bounce_duration: 1200, mode_switch_horizontal: false });
  assert.equal(config.styles.icon.off_color, api.DEFAULT_CONFIG.styles.icon.off_color);
  assert.equal(config.styles.card.background, api.DEFAULT_CONFIG.styles.card.background);
  assert.equal(config.styles.card.padding, "18px");
  config.extension.retained = false;
  assert.deepEqual(plain(raw), before);
});

test("Light retains native HA actions, explicit overrides and existing icon defaults", () => {
  const config = api.normalizeConfig({
    tap_action: { action: "perform-action", perform_action: "light.turn_on", data: { brightness: 90 }, target: { entity_id: "light.room" } },
    icon_tap_action: { action: "url", url_path: "https://example.org", new_tab: true },
    hold_action: { action: "navigate", navigation_path: "/lovelace/light" },
    icon_hold_action: "", tap_service_data: { brightness: 120 },
    security: { strict_service_actions: true, allowed_services: [" LIGHT.TURN_ON "] },
  });
  assert.equal(config.tap_action, "service");
  assert.deepEqual(JSON.parse(config.tap_service_data), { brightness: 120 });
  assert.deepEqual(JSON.parse(config.tap_service_target), { entity_id: "light.room" });
  assert.equal(config.icon_tap_action, "url");
  assert.equal(config.icon_tap_new_tab, true);
  assert.equal(config.hold_navigation_path, "/lovelace/light");
  assert.equal(config.icon_hold_action, "");
  assert.equal(api.normalizeConfig({}).icon_tap_action, "toggle");
  assert.deepEqual(plain(config.security.allowed_services), ["light.turn_on"]);
});

test("Light RGB/hex conversion produces known hue/saturation values and rejects nonfinite channels", () => {
  for (const [hex, expected] of [["f00", [0, 100]], ["00ff00", [120, 100]], ["0000ff", [240, 100]], ["808080", [0, 0]], ["000", [0, 0]]]) {
    assert.deepEqual(plain(helpers.rgbToHs(helpers.hexToRgb(hex))), expected);
  }
  for (const value of [null, [], [0, 0], [0, 0, 0, 0], [NaN, 0, 0], [Infinity, 0, 0], ["bad", 0, 0]]) assert.equal(helpers.rgbToHs(value), null);
  assert.deepEqual(plain(helpers.rgbToHs(["255", 0, 0])), [0, 100]);
  assert.equal(helpers.hexToRgb("red;display:none"), null);
});

test("Light Kelvin/mired conversion and track direction preserve warm/cool semantics", () => {
  assert.equal(helpers.miredToKelvin(200), 5000);
  assert.equal(helpers.kelvinToMired(5000), 200);
  for (const value of [undefined, null, "bad", 0, -10]) {
    assert.equal(helpers.miredToKelvin(value), 0);
    assert.equal(helpers.kelvinToMired(value), 0);
  }
  assert.match(helpers.getTemperatureSliderTrackGradient("mired"), /^linear-gradient\(90deg, #8fd3ff 0%/);
  assert.match(helpers.getTemperatureSliderTrackGradient("kelvin"), /^linear-gradient\(90deg, #f4b55f 0%/);
});
