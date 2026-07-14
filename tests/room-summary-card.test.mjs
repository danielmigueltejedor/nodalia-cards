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
    window: { NodaliaUtils: { registerCustomCard() {} } },
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
  assert.equal(source.match(/CARD_VERSION = "2\.0\.0-alpha\.23"/)?.length, 1);
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

test("room summary executes normalized Lovelace actions without mixing tap and hold navigation", () => {
  const source = read("nodalia-room-summary-card.js");
  assert.match(source, /action === "service"[\s\S]*?_runConfiguredService\(prefix\)/);
  assert.match(source, /action === "toggle"[\s\S]*?_toggleEntity\(this\._primaryActionEntity\(\)\)/);
  assert.match(source, /_parseActionObject\(this\._config\?\.\[\x60\$\{prefix\}_service_target\x60\]\)/);
  assert.match(source, /prefix === "tap" \? cfg\.navigation_path : cfg\[\x60\$\{prefix\}_navigation_path\x60\]/);
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

test("room summary hub layout exposes navigation rail and panels", () => {
  const source = read("nodalia-room-summary-card.js");
  assert.match(source, /layout: "hub"/);
  assert.match(source, /_renderHub\(/);
  assert.match(source, /room-hub__rail/);
  assert.match(source, /`nav:\$\{item\.id\}`/);
  assert.match(source, /_renderHubLightPanel/);
  assert.match(source, /_renderHubVacuumPanel/);
  assert.match(source, /_renderHubFanPanel/);
  assert.match(source, /_renderHubHumidifierPanel/);
  assert.match(source, /_renderHubOthersPanel/);
  assert.match(source, /"humidifiers"/);
  assert.match(source, /"others"/);
});

test("room summary normalizeConfig accepts vacuums, fans, humidifiers, and others", () => {
  const config = rs.normalizeConfig({
    vacuums: "vacuum.kitchen",
    fans: ["fan.bedroom", "fan.bedroom"],
    humidifiers: "humidifier.bedroom",
    others: ["switch.plug", "switch.plug", "sensor.test"],
  });
  assert.equal(config.vacuums.length, 1);
  assert.equal(config.vacuums[0], "vacuum.kitchen");
  assert.equal(config.fans.length, 1);
  assert.equal(config.humidifiers.length, 1);
  assert.equal(config.humidifiers[0], "humidifier.bedroom");
  assert.equal(config.others.length, 2);
  assert.equal(config.others[0], "switch.plug");
});

test("room summary hub media players combine primary and extras", () => {
  const config = rs.normalizeConfig({
    media_player: "media_player.salon",
    media_players: ["media_player.kitchen", "media_player.salon"],
  });
  assert.equal(rs.hubMediaPlayerIds(config).join("|"), "media_player.salon|media_player.kitchen");
  assert.equal(config.media_players.length, 1);
  assert.equal(config.media_players[0], "media_player.kitchen");
});

test("room summary preserves native media config and embedded card icon overrides", () => {
  const config = rs.normalizeConfig({
    media_config: {
      players: [{
        entity: "media_player.projector",
        label: "Projector",
        icon: "mdi:projector",
        tv_mode: true,
        power_action_off: {
          action: "call-service",
          service: "input_boolean.turn_off",
          service_data: '{"entity_id":"input_boolean.media_power"}',
        },
      }],
      show_unavailable_badge: false,
      styles: { player: { artwork_size: "52px", active_tint_color: "#006d8f" } },
    },
    lights: ["light.bedroom"],
    embed_options: {
      lights: [{ entity: "light.bedroom", name: "Bed light", icon: "mdi:ceiling-light" }],
    },
  });
  assert.equal(rs.hubMediaPlayerIds(config).join("|"), "media_player.projector");
  assert.equal(config.media_config.players[0].power_action_off.service, "input_boolean.turn_off");
  assert.equal(config.media_config.show_unavailable_badge, false);
  assert.equal(config.media_config.styles.player.artwork_size, "52px");
  assert.equal(config.embed_options.lights[0].name, "Bed light");
  assert.equal(config.embed_options.lights[0].icon, "mdi:ceiling-light");
});

test("room summary hub layout uses embedded nodalia cards and flat home header", () => {
  const source = read("nodalia-room-summary-card.js");
  assert.match(source, /data-hub-embed="light"/);
  assert.match(source, /data-hub-embed="vacuum"/);
  assert.match(source, /data-hub-embed="fan"/);
  assert.match(source, /data-hub-embed="humidifier"/);
  assert.match(source, /data-hub-embed="entity"/);
  assert.match(source, /data-hub-embed="media"/);
  assert.match(source, /_mountHubEmbeddedCards/);
  assert.match(source, /_hubEmbedCache = new Map/);
  assert.match(source, /_activateHubPanel\(next\)/);
  assert.match(source, /data-hub-panel=/);
  assert.match(source, /view\.hidden = !active/);
  assert.match(source, /data-hub-slot="home"/);
  assert.match(source, /animations: \{ \.\.\.deepClone\(base\.animations\), content_duration: 0 \}/);
  assert.match(source, /panel_duration: 0/);
  assert.match(source, /nodalia-media-player-editor/);
  assert.match(source, /media_config/);
  assert.match(source, /embed_options/);
  assert.match(source, /card\.parentElement !== host/);
  assert.match(source, /room-hub__home-header/);
  assert.match(source, /room-hub__status-chips/);
  assert.match(source, /more-info:/);
  assert.match(source, /compact_layout_mode: "never"/);
  assert.match(source, /media_players/);
  assert.match(source, /hubMediaPlayerIds/);
  assert.match(source, /room-summary-card--hub[\s\S]*overflow:\s*visible/);
  assert.match(source, /nodalia-media-player/);
  assert.match(source, /styles\.accent/);
  assert.doesNotMatch(source, /room-hub__hero/);
});

test("room summary editor emits valid config and preserves unknown fields", () => {
  const source = read("nodalia-room-summary-card.js");
  assert.match(source, /stripEqualToDefaults/);
  assert.match(source, /config-changed/);
  assert.match(source, /_emitConfig\(true\)/);
  assert.match(source, /value-changed/);
  assert.match(source, /editorStatesSignature/);
  assert.doesNotMatch(source, /editorFilteredStatesSignature\?\.\(hass, this\._config\?\.language/);
  const merged = rs.normalizeConfig({ name: "Salon", custom_dashboard_flag: true });
  assert.equal(merged.custom_dashboard_flag, true);
});
