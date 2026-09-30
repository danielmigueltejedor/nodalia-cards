import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";

const plain = value => JSON.parse(JSON.stringify(value));
function loadConfig(card) {
  const source = buildSync({ entryPoints: [`src/cards/${card}/${card}-config.ts`], bundle: true, write: false, format: "iife", globalName: "card" }).outputFiles[0].text;
  const sandbox = { console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(new URL("../nodalia-utils.js", import.meta.url), "utf8"), sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.card;
}

for (const card of ["fan", "humidifier"]) {
  const api = loadConfig(card);
  test(`${card} handles malformed YAML and style branches without throwing`, () => {
    for (const input of [null, false, 3, "invalid", [], { styles: null }, { styles: { icon: true, card: 42, control: [] } }]) {
      const config = api.normalizeConfig(input);
      assert.equal(config.layout, "compact");
      assert.deepEqual(plain(config.styles), plain(api.DEFAULT_CONFIG.styles));
      assert.equal(config.security.strict_service_actions, true);
    }
    assert.doesNotThrow(() => api.migrateLegacyIconOffColor(true, "red"));
  });

  test(`${card} preserves valid styles, extensions and legacy inactive colors without mutating input`, () => {
    const input = {
      layout: "CIRCULAR", extra: { retained: true },
      styles: { icon: { off_color: "var(--state-inactive-color, gray)" }, card: { padding: "18px", background: "red;display:none" }, control: { accent_background: "rgba(90, 80, 70, 0.2)" } },
    };
    const before = plain(input);
    const config = api.normalizeConfig(input);
    assert.equal(config.layout, "circular");
    assert.equal(config.styles.icon.off_color, api.DEFAULT_CONFIG.styles.icon.off_color);
    assert.equal(config.styles.card.padding, "18px");
    assert.equal(config.styles.card.background, api.DEFAULT_CONFIG.styles.card.background);
    assert.equal(config.styles.control.accent_background, "rgba(90, 80, 70, 0.2)");
    assert.deepEqual(plain(config.extra), { retained: true });
    assert.deepEqual(plain(input), before);
    config.extra.retained = false;
    assert.equal(input.extra.retained, true);
    const unsafe = api.normalizeConfig(JSON.parse('{"__proto__":{"polluted":true},"styles":{"card":{"constructor":"red","padding":"20px"}}}'));
    assert.equal(Object.hasOwn(unsafe, "__proto__"), false);
    assert.equal(Object.hasOwn(unsafe.styles.card, "constructor"), false);
  });

  test(`${card} retains HA action objects, explicit overrides and empty icon actions`, () => {
    const config = api.normalizeConfig({
      tap_action: { action: "perform-action", perform_action: `${card}.turn_on`, data: { test: 1 }, target: { entity_id: `${card}.room` } },
      hold_action: { action: "navigate", navigation_path: "/lovelace/room" },
      icon_tap_action: { action: "url", url_path: "https://example.org", new_tab: true },
      icon_hold_action: "", tap_service_data: { explicit: true },
    });
    assert.equal(config.tap_action, "service");
    assert.equal(config.tap_service, `${card}.turn_on`);
    assert.deepEqual(JSON.parse(config.tap_service_data), { explicit: true });
    assert.deepEqual(JSON.parse(config.tap_service_target), { entity_id: `${card}.room` });
    assert.equal(config.hold_action, "navigate");
    assert.equal(config.hold_navigation_path, "/lovelace/room");
    assert.equal(config.icon_tap_action, "url");
    assert.equal(config.icon_tap_new_tab, true);
    assert.equal(config.icon_hold_action, "");
    assert.equal(api.normalizeConfig({ tap_action: "unknown" }).tap_action, "toggle");
    const fallback = api.normalizeConfig({ icon_hold_action: "navigate", icon_hold_url: "/fallback" });
    assert.equal(fallback.icon_hold_navigation_path, "/fallback");
  });

  test(`${card} normalizes hidden modes and does not relax service restrictions`, () => {
    const fields = card === "fan" ? ["hidden_preset_modes"] : ["hidden_modes", "hidden_fan_modes"];
    for (const field of fields) {
      assert.deepEqual(plain(api.normalizeConfig({ [field]: " silent, ,auto " })[field]), ["silent", "auto"]);
      assert.deepEqual(plain(api.normalizeConfig({ [field]: [" silent ", null, "auto"] })[field]), ["silent", "auto"]);
      assert.deepEqual(plain(api.normalizeConfig({ [field]: true })[field]), []);
    }
    assert.equal(api.normalizeConfig({ security: null }).security.strict_service_actions, true);
    assert.equal(api.normalizeConfig({ security: { strict_service_actions: "true" } }).security.strict_service_actions, false);
    assert.deepEqual(plain(api.normalizeConfig({ security: { allowed_services: [" FAN.TURN_ON "] } }).security.allowed_services), ["fan.turn_on"]);
  });
}

test("Fan preserves all six action families including double tap", () => {
  const api = loadConfig("fan");
  const config = api.normalizeConfig({
    double_tap_action: { action: "perform-action", perform_action: "fan.set_percentage", data: { percentage: 65 } },
    icon_double_tap_action: { action: "navigate", navigation_path: "/fan" },
  });
  assert.equal(config.double_tap_action, "service");
  assert.equal(config.double_tap_service, "fan.set_percentage");
  assert.deepEqual(JSON.parse(config.double_tap_service_data), { percentage: 65 });
  assert.equal(config.icon_double_tap_navigation_path, "/fan");
  assert.equal(api.normalizeConfig({ double_tap_action: "unknown" }).double_tap_action, "none");
});

test("Cover keeps its legacy layouts, allowlists and HA actions with checked style normalization", () => {
  const api = loadConfig("cover");
  const input = {
    layout: "circular", compact_layout_mode: "always", open_close_icons: "HORIZONTAL",
    security: { allowed_services: ["COVER.OPEN_COVER"] },
    tap_action: { action: "perform-action", perform_action: "cover.open_cover", target: { entity_id: "cover.room" } },
    styles: { card: { padding: "18px", background: "red;display:none" } },
  };
  const before = plain(input);
  const config = api.normalizeConfig(input);
  assert.equal(config.layout, "circular");
  assert.equal(config.compact_layout_mode, "always");
  assert.equal(config.open_close_icons, "horizontal");
  assert.deepEqual(plain(config.security.allowed_services), ["cover.open_cover"]);
  assert.equal(config.tap_action, "service");
  assert.equal(config.tap_service, "cover.open_cover");
  assert.deepEqual(JSON.parse(config.tap_service_target), { entity_id: "cover.room" });
  assert.equal(config.styles.card.padding, "18px");
  assert.equal(config.styles.card.background, api.DEFAULT_CONFIG.styles.card.background);
  assert.deepEqual(plain(input), before);
  for (const value of [null, 3, false, [], "invalid", { styles: null, security: null }]) {
    const result = api.normalizeConfig(value);
    assert.equal(result.layout, "compact");
    assert.deepEqual(plain(result.styles), plain(api.DEFAULT_CONFIG.styles));
  }
});
