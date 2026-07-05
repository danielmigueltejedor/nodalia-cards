import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadMenuHelpers() {
  const sandbox = {
    URL,
    window: {
      location: { origin: "http://homeassistant.local:8123", pathname: "/lovelace/home", search: "", hash: "" },
      NodaliaUtils: { registerCustomCard() {} },
    },
    customElements: { define() {}, get() { return null; } },
    HTMLElement: class {},
    globalThis: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-menu-card.js"), sandbox);
  return sandbox.__NODALIA_MENU__;
}

const menu = loadMenuHelpers();

function baseConfig(overrides = {}) {
  return menu.normalizeConfig({
    variant: "segmented",
    mode: "navigate",
    active_source: "url",
    items: [
      { id: "home", name: "Home", icon: "mdi:home", navigation_path: "/lovelace/home" },
      { id: "rooms", name: "Rooms", icon: "mdi:floor-plan", navigation_path: "/lovelace/rooms", badge: "2" },
    ],
    ...overrides,
  });
}

test("menu card registers custom element and bundle entry", () => {
  const source = read("nodalia-menu-card.js");
  const build = read("scripts/build-bundle.mjs");
  const pkg = JSON.parse(read("package.json"));

  assert.match(source, /const CARD_TAG = "nodalia-menu-card"/);
  assert.match(source, /customElements\.define\(CARD_TAG, NodaliaMenuCard\)/);
  assert.match(build, /nodalia-menu-card\.js/);
  assert.ok(pkg.files.includes("nodalia-menu-card.js"));
  assert.equal(source.match(/CARD_VERSION = "2\.0\.0-alpha\.3"/)?.length, 1);
});

test("menu card renders basic items", () => {
  const config = baseConfig();
  assert.equal(config.items.length, 2);
  assert.equal(config.items[0].id, "home");
  const source = read("nodalia-menu-card.js");
  assert.match(source, /menu-item/);
  assert.match(source, /items\.map/);
});

test("menu navigate mode uses navigation path", () => {
  const source = read("nodalia-menu-card.js");
  assert.match(source, /hass-navigate/);
  assert.match(source, /_executeItemAction/);
  assert.match(source, /this\._navigate\(item\.navigation_path\)/);
});

test("menu helper mode calls input_select.select_option", () => {
  const source = read("nodalia-menu-card.js");
  assert.match(source, /getHelperDomain/);
  assert.match(source, /input_select\./);
  assert.match(source, /select_option/);
  assert.match(source, /entity_id: target, option/);
});

test("menu helper mode calls select.select_option", () => {
  const source = read("nodalia-menu-card.js");
  assert.match(source, /select\./);
  const config = menu.normalizeConfig({
    mode: "helper",
    target: "select.dashboard_section",
    items: [{ id: "home", name: "Home", value: "home" }],
  });
  assert.equal(config.target, "select.dashboard_section");
});

test("menu action mode uses item tap_action", () => {
  const source = read("nodalia-menu-card.js");
  assert.match(source, /mode === "action"/);
  assert.match(source, /resolveMenuItemTapAction/);
  assert.match(source, /perform-action|perform_action|service/s);
});

test("menu active_source manual marks active item", () => {
  const config = baseConfig({ active_source: "manual", active: "rooms" });
  assert.equal(menu.resolveActiveItemId(config, null, "/"), "rooms");
});

test("menu active_source helper marks active item by state", () => {
  const config = menu.normalizeConfig({
    mode: "helper",
    active_source: "helper",
    target: "input_select.dashboard_section",
    items: [
      { id: "home", value: "home" },
      { id: "security", value: "security" },
    ],
  });
  const hass = { states: { "input_select.dashboard_section": { state: "security" } } };
  assert.equal(menu.resolveActiveItemId(config, hass, "/"), "security");
});

test("menu static badges are resolved", () => {
  const config = baseConfig();
  const badge = menu.resolveItemBadge(config.items[1], null, config);
  assert.equal(badge?.value, "2");
});

test("menu badge_entity reads hass.states", () => {
  const config = baseConfig({
    items: [{ id: "alerts", name: "Alerts", badge_entity: "sensor.alerts" }],
  });
  const hass = { states: { "sensor.alerts": { state: "4" } } };
  const badge = menu.resolveItemBadge(config.items[0], hass, config);
  assert.equal(badge?.value, "4");
});

test("menu zero badge hidden by default", () => {
  const config = baseConfig({
    items: [{ id: "alerts", badge_entity: "sensor.alerts" }],
  });
  const hass = { states: { "sensor.alerts": { state: "0" } } };
  assert.equal(menu.resolveItemBadge(config.items[0], hass, config), null);
});

test("menu missing badge entity does not break", () => {
  const config = baseConfig({
    items: [{ id: "alerts", badge_entity: "sensor.missing" }],
  });
  assert.equal(menu.resolveItemBadge(config.items[0], { states: {} }, config), null);
});

test("menu icon_only variant hides labels", () => {
  const source = read("nodalia-menu-card.js");
  assert.match(source, /variant !== "icon_only"/);
  assert.match(source, /menu-wrap--icon_only/);
  const config = menu.normalizeConfig({ variant: "icon_only", items: [{ id: "home", name: "Home" }] });
  assert.equal(config.variant, "icon_only");
});

test("menu editor emits valid config", () => {
  const source = read("nodalia-menu-card.js");
  assert.match(source, /stripEqualToDefaults/);
  assert.match(source, /config-changed/);
  assert.match(source, /NodaliaMenuCardEditor/);
});

test("menu editor preserves unknown fields via merge", () => {
  const config = menu.normalizeConfig({ variant: "pill", future_field: "keep" });
  assert.equal(config.future_field, "keep");
});

test("menu url active source matches current path", () => {
  const config = baseConfig({ active_source: "url" });
  assert.equal(menu.resolveActiveItemId(config, null, "/lovelace/home"), "home");
});
