import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadRoomSummaryHelpers() {
  const sandbox = {
    URL,
    window: { NodaliaUtils: {} },
    customElements: { define() {}, get() { return null; } },
    HTMLElement: class {},
    globalThis: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-room-summary-card.js"), sandbox);
  return sandbox.__NODALIA_ROOM_SUMMARY__;
}

const rs = loadRoomSummaryHelpers();

function mockHass(states = {}) {
  return { states };
}

const state = (entityId, value, attrs = {}) => ({
  entity_id: entityId,
  state: value,
  attributes: attrs,
});

test("room summary card registers custom element and bundle entry", () => {
  const source = read("nodalia-room-summary-card.js");
  const build = read("scripts/build-bundle.mjs");
  const pkg = JSON.parse(read("package.json"));

  assert.match(source, /const CARD_TAG = "nodalia-room-summary-card"/);
  assert.match(source, /customElements\.define\(CARD_TAG, NodaliaRoomSummaryCard\)/);
  assert.match(source, /registerCustomCard/);
  assert.match(build, /nodalia-room-summary-card\.js/);
  assert.ok(pkg.files.includes("nodalia-room-summary-card.js"));
  assert.equal(source.match(/CARD_VERSION = "2\.0\.0-alpha\.3"/)?.length, 1);
});

test("room summary renders empty state without entities", () => {
  const source = read("nodalia-room-summary-card.js");
  assert.match(source, /hasRoomContent\(config\)/);
  assert.match(source, /room-summary-card--empty/);
  assert.equal(rs.hasRoomContent({}), false);
});

test("room summary renders minimal room with temperature", () => {
  const config = rs.normalizeConfig({ name: "Salón", temperature: "sensor.salon_temperature" });
  const summary = rs.buildRoomSummary(
    mockHass({ "sensor.salon_temperature": state("sensor.salon_temperature", "22.5", { unit_of_measurement: "°C" }) }),
    config,
  );
  assert.equal(config.name, "Salón");
  assert.match(summary.temperature, /22\.5/);
});

test("room summary does not break when configured entity is missing", () => {
  const summary = rs.buildRoomSummary(mockHass({}), rs.normalizeConfig({
    name: "Salón",
    temperature: "sensor.missing",
    lights: ["light.missing"],
  }));
  assert.equal(summary.temperature, "—");
  assert.equal(summary.lightsOn, 0);
});

test("room summary handles unknown and unavailable sensors", () => {
  const summary = rs.buildRoomSummary(mockHass({
    "sensor.temp": state("sensor.temp", "unavailable"),
    "sensor.humidity": state("sensor.humidity", "unknown"),
  }), rs.normalizeConfig({ temperature: "sensor.temp", humidity: "sensor.humidity" }));
  assert.equal(summary.temperature, "—");
  assert.equal(summary.humidity, "—");
});

test("room summary counts lights on correctly", () => {
  const summary = rs.buildRoomSummary(mockHass({
    "light.a": state("light.a", "on"),
    "light.b": state("light.b", "off"),
    "light.c": state("light.c", "on"),
  }), rs.normalizeConfig({ lights: ["light.a", "light.b", "light.c"] }));
  assert.equal(summary.lightsOn, 2);
  assert.equal(summary.lights_on, true);
});

test("room summary detects occupied and empty presence", () => {
  const occupied = rs.buildRoomSummary(mockHass({
    "binary_sensor.presence": state("binary_sensor.presence", "on"),
  }), rs.normalizeConfig({ presence: "binary_sensor.presence" }));
  const empty = rs.buildRoomSummary(mockHass({
    "binary_sensor.presence": state("binary_sensor.presence", "off"),
  }), rs.normalizeConfig({ presence: "binary_sensor.presence" }));
  assert.equal(occupied.occupied, true);
  assert.equal(empty.empty, true);
});

test("room summary detects media player playing", () => {
  const summary = rs.buildRoomSummary(mockHass({
    "media_player.salon": state("media_player.salon", "playing"),
  }), rs.normalizeConfig({ media_player: "media_player.salon" }));
  assert.equal(summary.media_playing, true);
});

test("room summary detects open doors and windows", () => {
  const summary = rs.buildRoomSummary(mockHass({
    "binary_sensor.door": state("binary_sensor.door", "on"),
    "binary_sensor.window": state("binary_sensor.window", "open"),
  }), rs.normalizeConfig({ doors: "binary_sensor.door", windows: ["binary_sensor.window"] }));
  assert.equal(summary.doorsOpen, 1);
  assert.equal(summary.windowsOpen, 1);
  assert.equal(summary.security_issue, true);
});

test("room summary does not expose lock quick actions by default", () => {
  const source = read("nodalia-room-summary-card.js");
  assert.doesNotMatch(source, /quick:lock/);
  assert.doesNotMatch(source, /lock\.(lock|unlock|open)/);
  const quickBlock = source.slice(source.indexOf("_quickActions"), source.indexOf("_render("));
  assert.doesNotMatch(quickBlock, /locks/);
});

test("room summary quick action calls light service", () => {
  const source = read("nodalia-room-summary-card.js");
  assert.match(source, /_runQuickAction\(action\)/);
  assert.match(source, /action === "lights_off".*light", "turn_off"/s);
  assert.match(source, /action === "lights_on".*light", "turn_on"/s);
});

test("room summary compact layout renders without overflow basics", () => {
  const source = read("nodalia-room-summary-card.js");
  assert.match(source, /room-summary-card--\$\{escapeHtml\(layout\)\}/);
  assert.match(source, /layout === "compact"/);
  assert.match(source, /overflow:\s*hidden|text-overflow:\s*ellipsis|min-width:\s*0/);
});

test("room summary security layout prioritizes security indicators", () => {
  const source = read("nodalia-room-summary-card.js");
  const renderBlock = source.slice(source.indexOf("_render()"), source.indexOf("class NodaliaRoomSummaryCardEditor"));
  assert.match(renderBlock, /layout === "security"/);
  assert.match(source, /show_security/);
  assert.match(source, /security_issue/);
});

test("room summary normalizeConfig accepts scalar and list entity fields", () => {
  const config = rs.normalizeConfig({
    temperature: "sensor.temp",
    lights: "light.single",
    covers: ["cover.a", "cover.a"],
  });
  assert.equal(config.temperature, "sensor.temp");
  assert.equal(config.lights.length, 1);
  assert.equal(config.lights[0], "light.single");
  assert.equal(config.covers.length, 1);
  assert.equal(config.covers[0], "cover.a");
});

test("room summary editor emits valid config and preserves unknown fields", () => {
  const source = read("nodalia-room-summary-card.js");
  assert.match(source, /stripEqualToDefaults/);
  assert.match(source, /config-changed/);
  assert.match(source, /_emitConfig\(true\)/);
  assert.match(source, /value-changed/);
  const merged = rs.normalizeConfig({ name: "Salon", custom_dashboard_flag: true });
  assert.equal(merged.custom_dashboard_flag, true);
});
