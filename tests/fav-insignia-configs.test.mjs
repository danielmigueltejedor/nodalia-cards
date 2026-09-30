import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";

function load(card, part) {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync("nodalia-utils.js", "utf8"), sandbox);
  vm.runInContext(fs.readFileSync("nodalia-bubble-contrast.js", "utf8"), sandbox);
  vm.runInContext(buildSync({ entryPoints: [`src/cards/${card}/${card}-${part}.ts`], bundle: true, write: false, format: "iife", globalName: "api" }).outputFiles[0].text, sandbox);
  return sandbox.api;
}
const plain = value => JSON.parse(JSON.stringify(value));
const fav = load("fav", "config");
const insignia = load("insignia", "config");
const favHelpers = load("fav", "helpers");
const insigniaHelpers = load("insignia", "helpers");

test("Fav tolerates malformed YAML/style branches and preserves its sanitized CSS contract", () => {
  for (const raw of [null, false, 7, "bad", [], { styles: null }, { styles: { icon: true, card: false } }]) {
    assert.deepEqual(plain(fav.normalizeConfig(raw).styles), plain(fav.DEFAULT_CONFIG.styles));
  }
  const raw = { extension: { retained: true }, styles: { card: { padding: "18px", background: "red;display:none" }, icon: { background: "#fff" } } };
  const before = plain(raw);
  const config = fav.normalizeConfig(raw);
  assert.equal(config.styles.card.padding, "18px");
  assert.equal(config.styles.card.background, fav.DEFAULT_CONFIG.styles.card.background);
  assert.equal(config.styles.icon.background, fav.DEFAULT_CONFIG.styles.icon.background);
  assert.deepEqual(plain(config.extension), { retained: true });
  assert.deepEqual(raw, before);
});

test("Fav retains HA service/target action objects, navigation and security normalization", () => {
  const config = fav.normalizeConfig({ tap_action: { action: "perform-action", perform_action: "light.turn_on", data: { brightness: 80 }, target: { entity_id: "light.one" } }, security: { allowed_services: ["light.turn_on", "lock.unlock"], allowed_service_domains: ["light"] } });
  assert.equal(config.tap_action, "service");
  assert.equal(config.tap_service, "light.turn_on");
  assert.deepEqual(JSON.parse(config.tap_service_data), { brightness: 80 });
  assert.deepEqual(JSON.parse(config.tap_service_target), { entity_id: "light.one" });
  assert.deepEqual(plain(config.security.allowed_services), ["light.turn_on", "lock.unlock"]);
  assert.equal(fav.normalizeConfig({ tap_action: { action: "navigate", navigation_path: "/dashboard/one" } }).navigation_path, "/dashboard/one");
  assert.equal(fav.normalizeConfig({ tap_action: "" }).tap_action, "auto");
});

test("Insignia keeps all legacy tint aliases and explicit tint precedence", () => {
  for (const alias of ["grey", "light_grey", "light_gray"]) {
    const config = insignia.normalizeConfig({ color: alias });
    assert.equal(config.tint_auto, false);
    assert.equal(config.styles.tint.color, insigniaHelpers.getTintPresetColor("gray"));
  }
  assert.equal(insignia.normalizeConfig({ color: "red" }).styles.tint.color, "#ff6b6b");
  assert.equal(insignia.normalizeConfig({ color: "unknown_preset" }).styles.tint.color, "#4da3ff");
  assert.equal(insignia.normalizeConfig({ tint_preset: "auto", tint_auto: false }).tint_auto, true);
  assert.equal(insignia.normalizeConfig({ tint_preset: "red", styles: { tint: { color: "#123456" } } }).styles.tint.color, "#123456");
});

test("Insignia guards malformed tint styles, preserves hold defaults/extensions and sanitizes at rendering", () => {
  for (const raw of [null, true, [], { styles: false, color: "red" }, { styles: { tint: null }, color: "red" }]) {
    assert.equal(typeof insignia.normalizeConfig(raw).styles.tint.color, "string");
  }
  const config = insignia.normalizeConfig({ hold_action: " TOGGLE ", hold_new_tab: true, extension: { retained: true }, styles: { icon: true, tint: { color: "red;display:none" } } });
  assert.equal(config.hold_action, "toggle");
  assert.equal(config.hold_new_tab, true);
  assert.deepEqual(plain(config.extension), { retained: true });
  assert.equal(insignia.normalizeConfig({ hold_action: "bad" }).hold_action, "none");
  const styles = insigniaHelpers.getSafeStyles(config.styles);
  assert.deepEqual(plain(styles.icon), plain(insignia.DEFAULT_CONFIG.styles.icon));
  assert.equal(styles.tint.color, insignia.DEFAULT_CONFIG.styles.tint.color);
});

test("Insignia compaction and editor paths retain own fields and reject prototype traversal", () => {
  const raw = JSON.parse('{"empty":"","false":false,"zero":0,"nested":{"empty":null,"yes":1},"items":["",2],"__proto__":{"polluted":true}}');
  assert.deepEqual(plain(insigniaHelpers.compactConfig(raw)), { false: false, zero: 0, nested: { yes: 1 }, items: [2] });
  const target = Object.create({ inherited: { retained: true } });
  insigniaHelpers.setByPath(target, "inherited.color", "blue");
  assert.deepEqual(plain(target.inherited), { color: "blue" });
  assert.equal(Object.getPrototypeOf(target).inherited.retained, true);
  for (const path of ["__proto__.polluted", "constructor.prototype.polluted", "valid.prototype.polluted"]) insigniaHelpers.setByPath(target, path, true);
  assert.equal(Object.prototype.polluted, undefined);
  insigniaHelpers.deleteByPath(target, "inherited.color");
  assert.deepEqual(plain(target.inherited), {});
});

test("Fav and Insignia retain distinct domain icon and numeric policies", () => {
  const state = (entity_id, value, attributes = {}) => ({ entity_id, state: value, attributes });
  assert.equal(favHelpers.getDynamicEntityIcon(state("lock.one", "jammed")), "mdi:lock-alert");
  assert.equal(insigniaHelpers.getDynamicEntityIcon(state("lock.one", "jammed")), "mdi:lock");
  assert.equal(favHelpers.coverEntityIsOpen(state("cover.one", "unknown", { current_position: 15 })), true);
  assert.equal(favHelpers.coverEntityIsOpen(state("cover.one", "closed", { current_position: 15 })), false);
  assert.equal(favHelpers.entitySupportsFeature(state("cover.one", "open", { supported_features: 9 }), 8), true);
  assert.equal(favHelpers.parseNumericValue(""), null);
  assert.equal(favHelpers.parseNumericValue(Infinity), null);
  assert.equal(favHelpers.miredToKelvin(250), 4000);
  assert.equal(insigniaHelpers.formatNumericString("23.500"), "23.5");
  for (const helpers of [favHelpers, insigniaHelpers]) assert.equal(helpers.isUnavailableState(state("sensor.one", "unknown")), false);
});
