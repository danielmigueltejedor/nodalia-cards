import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";

function load(card, part = "config") {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ["nodalia-utils.js", ...(card === "room-summary" ? ["nodalia-room-summary-model.js"] : [])]) {
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox);
  }
  const source = buildSync({ entryPoints: [`src/cards/${card}/${card}-${part}.ts`], bundle: true, write: false, format: "iife", globalName: "api" }).outputFiles[0].text;
  vm.runInContext(source, sandbox);
  return sandbox.api;
}
const plain = value => JSON.parse(JSON.stringify(value));

for (const card of ["person", "alarm-panel"]) {
  test(`${card} checked configuration handles unknown YAML, CSS rejection and input isolation`, () => {
    const api = load(card);
    for (const raw of [null, false, 3, "bad", [], { styles: { card: null } }]) {
      const normalized = api.normalizeConfig(raw);
      assert.deepEqual(plain(normalized.styles), plain(api.DEFAULT_CONFIG.styles));
    }
    const raw = { extension: { nested: true }, styles: { card: { padding: "17px", background: "red;display:none" } } };
    const normalized = api.normalizeConfig(raw);
    assert.equal(normalized.styles.card.padding, "17px");
    assert.equal(normalized.styles.card.background, api.DEFAULT_CONFIG.styles.card.background);
    normalized.extension.nested = false;
    assert.equal(raw.extension.nested, true);
    const guarded = api.normalizeConfig(JSON.parse('{"__proto__":{"polluted":true},"styles":{"constructor":"red"}}'));
    assert.equal(Object.hasOwn(guarded, "__proto__"), false);
  });
}

test("Alarm code-input aliases and feedback delays retain their supported behavior", () => {
  const api = load("alarm-panel");
  for (const value of [true, "true", "always"]) assert.equal(api.normalizeConfig({ show_code_input: value }).show_code_input, true);
  for (const value of [false, "false", "never"]) assert.equal(api.normalizeConfig({ show_code_input: value }).show_code_input, false);
  for (const value of [null, "auto", "bad"]) assert.equal(api.normalizeConfig({ show_code_input: value }).show_code_input, "auto");
  for (const [raw, expected] of [[50, 2000], [90000, 30000], [7500.6, 7501], ["bad", 5000]]) {
    assert.equal(api.normalizeConfig({ wrong_code_feedback_ms: raw }).wrong_code_feedback_ms, expected);
  }
});

test("Person retains HA action objects, explicit action entities and allowlists", () => {
  const api = load("person");
  const config = api.normalizeConfig({
    tap_action: { action: "perform-action", perform_action: "light.turn_on", entity: "light.room", data: { brightness: 100 } },
    hold_action: { action: "navigate", navigation_path: "/lovelace/home" },
    double_tap_action: "more-info", double_tap_action_entity: " person.other ",
    security: { strict_service_actions: true, allowed_services: [" LIGHT.TURN_ON "] },
  });
  assert.equal(config.tap_action, "service");
  assert.equal(config.tap_action_entity, "light.room");
  assert.deepEqual(JSON.parse(config.tap_service_data), { brightness: 100 });
  assert.equal(config.hold_navigation_path, "/lovelace/home");
  assert.equal(config.double_tap_action_entity, "person.other");
  assert.deepEqual(plain(config.security.allowed_services), ["light.turn_on"]);
  assert.equal(api.normalizeConfig({ tap_action: "bad" }).tap_action, "more-info");
});

test("Checked stub helpers keep domain selection, friendly names and explicit fallback order", () => {
  for (const card of ["alarm-panel", "person", "fan", "humidifier", "cover", "vacuum"]) {
    const api = load(card, "helpers");
    const domain = card === "alarm-panel" ? "alarm_control_panel" : card;
    const entityId = `${domain}.room`;
    const otherId = `${domain}.other`;
    const hass = { states: { [entityId]: { entity_id: entityId, state: "unknown", attributes: { friendly_name: "Room" } }, [otherId]: { entity_id: otherId, state: "unknown", attributes: {} }, "sensor.other": { entity_id: "sensor.other", state: "on", attributes: {} } } };
    const config = { entity: "", name: "" };
    assert.equal(api.applyStubEntity(config, hass, [domain], [entityId]), config);
    assert.equal(config.entity, entityId);
    assert.equal(config.name, "Room");
    assert.equal(api.getStubEntityId(hass, [domain], [], [otherId]), otherId);
    assert.equal(api.getStubEntityId(null, [domain]), "");
  }
});

test("Room helper lists tolerate malformed YAML and preserve valid security order", () => {
  const api = load("room-summary", "helpers");
  for (const value of [null, true, "bad", { doors: true, windows: {}, alarms: "bad" }]) {
    assert.deepEqual(plain(api.hubSecurityEntityIds(value)), []);
    assert.deepEqual(plain(api.hubAlarmEntityIds(value)), []);
  }
  assert.deepEqual(plain(api.hubSecurityEntityIds({ doors: [" binary_sensor.door "], windows: ["binary_sensor.window"], locks: ["lock.front"], alerts: ["binary_sensor.fire"] })), ["binary_sensor.door", "binary_sensor.window", "lock.front", "binary_sensor.fire"]);
  assert.deepEqual(plain(api.entityList([], [" light.room ", "light.other"])), ["light.room", "light.other"]);
});

test("Room helper editor paths preserve arrays and reject unsafe prototype paths", () => {
  const api = load("room-summary", "helpers");
  const config = {};
  api.setByPath(config, "rooms.0.entity", "light.room");
  api.setByPath(config, "rooms.1.entity", "lock.front");
  assert.deepEqual(plain(config), { rooms: [{ entity: "light.room" }, { entity: "lock.front" }] });
  for (const path of ["__proto__.polluted", "rooms.0.constructor.prototype.polluted", "rooms.foo.entity"]) api.setByPath(config, path, true);
  assert.equal({}.polluted, undefined);
  assert.equal(config.rooms.foo, undefined);
  const list = ["a", "b", "c"];
  api.moveListItem(list, 0, 2);
  assert.deepEqual(list, ["b", "c", "a"]);
  api.moveListItem(list, 0.5, 1);
  assert.deepEqual(list, ["b", "c", "a"]);
  const input = { styles: { card: { padding: "12px", color: "red" } }, rooms: [{ entity: "light.room" }] };
  const reduced = api.stripEqualToDefaults(input, { styles: { card: { padding: "12px" } } });
  assert.deepEqual(plain(reduced), { styles: { card: { color: "red" } }, rooms: [{ entity: "light.room" }] });
  assert.equal(input.styles.card.padding, "12px");
});
