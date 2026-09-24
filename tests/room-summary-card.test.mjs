import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadRoomSummaryHelpers() {
  const registry = new Map();
  class FakeHTMLElement {
    constructor() {
      this.isConnected = true;
    }

    attachShadow() {
      this.shadowRoot = {
        addEventListener() {},
        removeEventListener() {},
        innerHTML: "",
        querySelector() { return null; },
        querySelectorAll() { return []; },
      };
      return this.shadowRoot;
    }

    dispatchEvent() {
      return true;
    }
  }
  const sandbox = {
    console,
    URL,
    window: null,
    customElements: {
      define(name, klass) { registry.set(name, klass); },
      get(name) { return registry.get(name); },
    },
    HTMLElement: FakeHTMLElement,
    globalThis: {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-room-summary-model.js"), sandbox);
  vm.runInContext(read("nodalia-room-summary-card.js"), sandbox);
  return {
    ...sandbox.__NODALIA_ROOM_SUMMARY__,
    Card: registry.get("nodalia-room-summary-card"),
  };
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

  assert.match(source, /(?:const|let|var) CARD_TAG = "nodalia-room-summary-card"/);
  assert.match(source, /defineLazyCustomElement\(CARD_TAG, loadNodaliaRoomSummaryCard/);
  assert.match(source, /registerCustomCard/);
  assert.match(build, /nodalia-room-summary-card\.js/);
  assert.ok(pkg.files.includes("nodalia-room-summary-card.js"));
  const escapedVersion = pkg.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.equal(source.match(new RegExp(`CARD_VERSION = "${escapedVersion}"`))?.length, 1);
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
  assert.match(source, /bindHostPointerHoldGesture\(this,[\s\S]*onHold: \(\) => this\._performCardAction\("hold"\)/);
  assert.match(source, /markHoldConsumedClick:[\s\S]*this\._suppressNextPrimaryClick = true/);
  assert.match(source, /action === "primary"[\s\S]*this\._suppressNextPrimaryClick = false;[\s\S]*this\._performCardAction\("tap"\)/);
});

test("room summary gates only configured services with the strict allowlist", () => {
  const card = new rs.Card();
  const calls = [];
  card._invoke = (...args) => calls.push(args);
  card._config = rs.normalizeConfig({
    tap_action: "service",
    tap_service: "script.room_mode",
  });

  card._runConfiguredService("tap");
  assert.equal(calls.length, 0, "strict mode should deny unlisted YAML services");

  card._config = rs.normalizeConfig({
    tap_action: "service",
    tap_service: "script.room_mode",
    security: { allowed_services: ["script.room_mode"] },
  });
  card._runConfiguredService("tap");
  assert.equal(calls.length, 1, "an explicitly allowed configured service should run");
  assert.deepEqual(calls[0].slice(0, 2), ["script", "room_mode"]);
});

test("room summary render signature tracks security and camera entities", () => {
  const card = new rs.Card();
  card._config = rs.normalizeConfig({
    name: "Entry",
    camera: "camera.entry",
    doors: ["binary_sensor.entry_door"],
    windows: ["binary_sensor.entry_window"],
    locks: ["lock.entry"],
    alerts: ["binary_sensor.entry_motion"],
  });
  card._configSignature = JSON.stringify(card._config);
  let renders = 0;
  let patches = 0;
  card._render = () => {
    renders += 1;
    card.shadowRoot.innerHTML = "<ha-card class=\"room-summary-card--hub\"></ha-card>";
  };
  card._patchHubState = () => {
    patches += 1;
    return true;
  };

  const baseStates = {
    "camera.entry": { state: "idle", last_updated: "2026-07-28T10:00:00Z", attributes: {} },
    "binary_sensor.entry_door": { state: "off", last_updated: "2026-07-28T10:00:00Z", attributes: {} },
    "binary_sensor.entry_window": { state: "off", last_updated: "2026-07-28T10:00:00Z", attributes: {} },
    "lock.entry": { state: "locked", last_updated: "2026-07-28T10:00:00Z", attributes: {} },
    "binary_sensor.entry_motion": { state: "off", last_updated: "2026-07-28T10:00:00Z", attributes: {} },
  };
  card.hass = { states: baseStates };
  card.hass = {
    states: {
      ...baseStates,
      "binary_sensor.entry_door": { state: "on", last_updated: "2026-07-28T10:00:01Z", attributes: {} },
    },
  };
  card.hass = {
    states: {
      ...card._hass.states,
      "sensor.unrelated": { state: "1", last_updated: "2026-07-28T10:00:02Z", attributes: {} },
    },
  };

  assert.equal(renders, 1);
  assert.equal(patches, 1, "tracked security changes should patch the hub while unrelated updates stay gated");
});

test("room summary always migrates legacy layouts to Hub", () => {
  const source = read("nodalia-room-summary-card.js");
  const editorStart = source.search(/(?:class NodaliaRoomSummaryCardEditor|NodaliaRoomSummaryCardEditor = class)/);
  const editorBlock = source.slice(editorStart);

  for (const layout of ["compact", "standard", "detailed", "security", "climate"]) {
    const config = rs.normalizeConfig({ layout, density: "compact" });
    assert.equal(config.layout, "hub");
    assert.equal(config.density, undefined);
  }
  assert.match(source, /config\.layout = "hub"/);
  assert.doesNotMatch(editorBlock, /ed\.room_summary\.layout/);
  assert.doesNotMatch(editorBlock, /"layout", c\.layout/);
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

test("room summary reuses normalized config and caches its render signature", () => {
  const source = read("nodalia-room-summary-card.js");
  const config = rs.normalizeConfig({ name: "Office", lights: ["light.office"] });
  assert.equal(rs.normalizeConfig(config), config);
  assert.match(source, /(?:const|let|var) NORMALIZED_ROOM_CONFIG = (?:\/\* @__PURE__ \*\/ )?Symbol/);
  assert.match(source, /this\._configSignature = JSON\.stringify\(this\._config\)/);
  assert.match(source, /\|\$\{this\._configSignature\}`/);
  assert.match(source, /normalizeConfig\(deepClone\(this\._config\)\)/);
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

test("room summary hub icon-only controls have accessible names", () => {
  const source = read("nodalia-room-summary-card.js");
  const coverPanel = source.slice(source.indexOf("  _renderHubCoverPanel(config) {"), source.indexOf("  _renderHubClimatePanel(config) {"));
  const climatePanel = source.slice(source.indexOf("  _renderHubClimatePanel(config) {"), source.indexOf("  _renderHubVacuumPanel(config) {"));
  assert.equal((coverPanel.match(/aria-label=/g) || []).length, 4);
  assert.equal((climatePanel.match(/aria-label=/g) || []).length, 0);
  assert.match(climatePanel, /_renderHubEmbedHosts\(\[config\.climate\], "climate"\)/);
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

test("room summary preserves native camera streams and alarm entities", () => {
  const config = rs.normalizeConfig({
    camera_config: {
      entity: "camera.salon",
      camera_streams: [{
        camera: "camera.salon",
        provider: "go2rtc",
        url: "http://go2rtc.local:1984",
        stream: "salon",
        mode: "mse",
      }],
    },
    alarms: ["alarm_control_panel.house", "alarm_control_panel.house"],
  });
  assert.equal(config.camera, "camera.salon");
  assert.equal(config.camera_config.camera_streams[0].provider, "go2rtc");
  assert.equal(config.camera_config.camera_streams[0].stream, "salon");
  assert.equal(config.alarms.length, 1);
  assert.equal(config.alarms[0], "alarm_control_panel.house");
  assert.equal(rs.hasRoomContent({ alarms: ["alarm_control_panel.house"] }), true);
  assert.equal(rs.hubAlarmEntityIds(config).join("|"), "alarm_control_panel.house");

  const triggered = rs.buildRoomSummary(mockHass({
    "alarm_control_panel.house": state("alarm_control_panel.house", "triggered"),
  }), config);
  assert.equal(triggered.alarmsTriggered, 1);
  assert.equal(triggered.security_issue, true);
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
  assert.match(source, /data-hub-embed="climate"/);
  assert.match(source, /data-hub-embed="alarm"/);
  assert.match(source, /data-hub-embed="entity"/);
  assert.match(source, /data-hub-embed="media"/);
  assert.match(source, /data-hub-embed="camera"/);
  assert.match(source, /_mountHubEmbeddedCards/);
  assert.match(source, /_hubEmbedCache = (?:\/\* @__PURE__ \*\/ )?new Map/);
  assert.match(source, /_hubEmbedConfigSignatures = (?:\/\* @__PURE__ \*\/ )?new WeakMap/);
  assert.match(source, /_activateHubPanel\(next\)/);
  assert.match(source, /data-hub-panel=/);
  assert.match(source, /const renderedPanels = \[activePanel\]/);
  assert.match(source, /data-hub-slot="group"/);
  assert.match(source, /data-hub-slot="live"/);
  assert.match(source, /_parkHubEmbeddedCards/);
  assert.match(source, /createDocumentFragment/);
  assert.match(source, /room-hub--camera-expanded/);
  assert.match(source, /nodalia-overlay-change/);
  assert.match(source, /transform:none/);
  assert.doesNotMatch(source, /room-hub-slide[^\n]* both/);
  assert.match(source, /animations: \{ \.\.\.deepClone\(base\.animations\), content_duration: 0 \}/);
  assert.match(source, /panel_duration: 0/);
  assert.match(source, /nodalia-media-player-editor/);
  assert.match(source, /nodalia-camera-card-editor/);
  assert.match(source, /media_config/);
  assert.match(source, /camera_config/);
  assert.match(source, /embed_options/);
  assert.match(source, /card\.parentElement !== host/);
  assert.match(source, /room-hub__home-header/);
  assert.match(source, /room-hub__status-chips/);
  assert.match(source, /more-info:/);
  assert.match(source, /compact_layout_mode: "never"/);
  assert.match(source, /layout: "compact"/);
  assert.match(source, /media_players/);
  assert.match(source, /hubMediaPlayerIds/);
  assert.match(source, /_hubMediaEmbedConfig\(/);
  assert.match(source, /layoutMode = explicitModes\.has\(requestedMode\) \? requestedMode : "standard"/);
  assert.match(source, /columns: Number\.isFinite\(configuredColumns\) && configuredColumns > 0 \? configuredColumns : 12/);
  assert.match(source, /room-summary-card--hub[\s\S]*overflow:\s*visible/);
  assert.match(source, /nodalia-media-player/);
  assert.match(source, /styles\.accent/);
  assert.doesNotMatch(source, /room-hub__hero/);
});

test("room summary patches Hub state without remounting embedded cards", () => {
  const source = read("nodalia-room-summary-card.js");
  const patchStart = source.indexOf("_patchHubState() {");
  const patchEnd = source.indexOf("_toggleEntity(", patchStart);
  const patchBlock = source.slice(patchStart, patchEnd);
  const chromeStart = source.indexOf("_syncHubChrome(");
  const chromeEnd = source.indexOf("_activateHubPanel(", chromeStart);
  const chromeBlock = source.slice(chromeStart, chromeEnd);
  const mountStart = source.indexOf("_mountHubEmbeddedCards() {");
  const mountEnd = source.indexOf("_renderHubEmbedHosts(", mountStart);
  const mountBlock = source.slice(mountStart, mountEnd);

  assert.match(source, /if \(prev && this\._patchHubState\(\)\) return;/);
  assert.match(chromeBlock, /header\.outerHTML = this\._renderHubHeader/);
  assert.match(chromeBlock, /contextActions\.innerHTML = this\._renderHubContextActions/);
  assert.match(patchBlock, /this\._syncHubChrome\(/);
  assert.match(patchBlock, /this\._mountHubEmbeddedCards\(\)/);
  assert.doesNotMatch(patchBlock, /shadowRoot\.innerHTML\s*=/);
  assert.match(mountBlock, /const configSignature = JSON\.stringify\(cardConfig\)/);
  assert.match(mountBlock, /_hubEmbedConfigSignatures\.get\(card\) !== configSignature/);
  assert.match(mountBlock, /_hubConfiguredEmbedKeys/);
  assert.ok(
    mountBlock.indexOf("card.setConfig(cardConfig)") < mountBlock.indexOf("card.hass = this._hass"),
    "embedded card config should settle before hass triggers its render",
  );
  assert.match(mountBlock, /if \(!customElements\.get\(tagName\)\) return;/);
  assert.match(source, /state\.last_updated \|\| state\.last_changed/);
});

test("room summary keeps a grouped media player and surfaces camera plus security entities", () => {
  const source = read("nodalia-room-summary-card.js");
  const mediaPanel = source.slice(source.indexOf("_renderHubMediaPanel"), source.indexOf("_renderHubCameraPanel"));
  const securityPanel = source.slice(source.indexOf("  _renderHubSecurityPanel(config) {"), source.indexOf("  _renderHubPanelContent(panel, config, summary, styles, accentColor) {"));

  assert.match(mediaPanel, /data-hub-media="group"/);
  assert.doesNotMatch(mediaPanel, /_renderHubEmbedHosts\(ids, "media"\)/);
  assert.match(source, /album_cover_background: native\.album_cover_background !== false/);
  assert.match(source, /show: true/);
  assert.doesNotMatch(source, /active_tint_color: accent/);
  assert.match(source, /nodalia-camera-card/);
  assert.match(source, /_renderHubHomeCamera/);
  assert.match(source, /_renderHubSecurityPanel/);
  assert.match(source, /hubSecurityEntityIds/);
  assert.match(source, /hubAlarmEntityIds/);
  assert.match(securityPanel, /_renderHubEmbedHosts\(alarmIds, "alarm"\)/);
  assert.match(source, /nodalia-alarm-panel-card/);
  assert.match(source, /nodalia-climate-card/);
  assert.match(source, /room-hub__metric-bubble--power/);
  assert.match(source, /room-hub__metric-bubble--air/);
});

test("room summary hub uses stable control icons and active tint classes", () => {
  const source = read("nodalia-room-summary-card.js");
  const navBlock = source.slice(source.indexOf("_getHubNavItems"), source.indexOf("_getContextualActions"));
  const contextualBlock = source.slice(source.indexOf("_getContextualActions"), source.indexOf("_setHubPanel"));

  assert.doesNotMatch(navBlock, /mdi:(lightbulb-outline|fan-off|air-humidifier-off|play-circle-outline)/);
  assert.doesNotMatch(contextualBlock, /mdi:(lightbulb-off|lightbulb-on|fan-off|window-shutter-open)/);
  assert.match(source, /item\.active === true/);
  assert.match(source, /room-hub__context-action--active/);
});

test("room summary status chips and smart actions use raised bubble styling", () => {
  const source = read("nodalia-room-summary-card.js");

  assert.match(source, /context_action_size: "42px"/);
  assert.match(source, /context_action_icon_size: "20px"/);
  assert.match(source, /\.room-hub__metric-bubble \{[\s\S]*box-shadow:inset 0 1px 0[\s\S]*0 8px 18px/);
  assert.match(source, /\.room-hub__context-action \{[\s\S]*box-shadow:inset 0 1px 0[\s\S]*0 10px 24px/);
  assert.match(source, /data-hub-context-actions/);
  assert.match(source, /\.room-hub__context-actions\[hidden\] \{ display:none; \}/);
});

test("room summary hub protects the full room name and top-aligns sparse panels", () => {
  const source = read("nodalia-room-summary-card.js");
  const headerStart = source.indexOf("_renderHubHeader");
  const headerBlock = source.slice(headerStart, source.indexOf("\n  _renderHubStatusChips(", headerStart));

  assert.match(headerBlock, /room-hub__room-title[\s\S]*room-hub__status-chips/);
  assert.doesNotMatch(headerBlock, /room-hub__room-title-row/);
  assert.match(source, /\.room-hub \{ align-items:start;/);
  assert.match(source, /\.room-hub__stage \{ align-content:start;/);
  assert.match(source, /\.room-hub__view \{ align-content:start; display:grid;/);
  assert.match(source, /\.room-hub__embed-list \{ align-content:start;/);
  assert.match(source, /\.room-hub__panel \{ align-content:start; display:grid;/);
  assert.match(source, /\.room-hub__status-chips \{[\s\S]*justify-content:flex-start;[\s\S]*width:100%;/);
});

test("room summary hub supports a collapsible compact mode", () => {
  const source = read("nodalia-room-summary-card.js");
  const normalized = rs.normalizeConfig({ layout: "hub", collapsible: true });

  assert.equal(normalized.collapsible, true);
  assert.match(source, /collapsible: false/);
  assert.match(source, /this\._hubExpanded = false/);
  assert.match(source, /collapsible === true && this\._hubExpanded !== true \? 2 : 4/);
  assert.match(source, /action === "toggle-hub-expand"/);
  assert.match(source, /const renderedPanels = \[activePanel\]/);
  assert.match(source, /!collapsed && navItems\.length/);
  assert.match(source, /collapsed \? "mdi:chevron-down" : "mdi:chevron-up"/);
  assert.match(source, /aria-expanded="\$\{collapsed \? "false" : "true"\}"/);
  assert.match(source, /_renderHubHome\(config, summary, styles, accentColor, collapsed\)/);
  assert.match(source, /\$\{this\._renderHubRoomIcon\(config\.icon, title, styles\)\}/);
  assert.match(source, /\.room-hub__header--collapsed \.room-hub__room-icon \{ height:42px; width:42px; \}/);
  assert.match(source, /ed\.room_summary\.collapsible/);
});

test("room summary editor mounts nested camera and media editors without throwing", () => {
  const registry = new Map();
  class FakeHTMLElement {
    constructor() {
      this.isConnected = true;
      this.dataset = {};
    }

    attachShadow() {
      this.shadowRoot = {
        addEventListener() {},
        removeEventListener() {},
        innerHTML: "",
        querySelector() { return null; },
        querySelectorAll(selector) {
          const key = String(selector).match(/data-mounted-control="([^"]+)"/)?.[1];
          if (key === "media-config-editor" || key === "camera-config-editor") {
            const host = new FakeHTMLElement();
            host.dataset.mountedControl = key;
            return [host];
          }
          return [];
        },
      };
      return this.shadowRoot;
    }

    addEventListener() {}
    replaceChildren() {}
    dispatchEvent() { return true; }
  }
  const sandbox = {
    console,
    URL,
    location: { protocol: "https:", href: "https://home-assistant.example/lovelace/home" },
    window: null,
    document: {
      createElement(tag) {
        const Ctor = registry.get(tag) || FakeHTMLElement;
        return new Ctor();
      },
    },
    customElements: {
      define(name, klass) { registry.set(name, klass); },
      get(name) { return registry.get(name); },
    },
    HTMLElement: FakeHTMLElement,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: id => globalThis.clearTimeout(id),
    globalThis: {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-room-summary-model.js"), sandbox);
  vm.runInContext(read("nodalia-camera-card.js"), sandbox);
  vm.runInContext(read("nodalia-media-player.js"), sandbox);
  vm.runInContext(read("nodalia-room-summary-card.js"), sandbox);
  const Editor = registry.get("nodalia-room-summary-card-editor");
  assert.equal(typeof Editor, "function");
  const editor = new Editor();
  assert.doesNotThrow(() => editor.setConfig({
    name: "Salón",
    camera: "camera.salon",
    media_player: "media_player.salon",
  }));
});

test("room summary setConfig renders without missing buildRoomSummary import", () => {
  const card = new rs.Card();
  assert.doesNotThrow(() => card.setConfig({ name: "Salón", temperature: "sensor.salon_temperature" }));
  card.hass = mockHass({
    "sensor.salon_temperature": state("sensor.salon_temperature", "22.5", { unit_of_measurement: "°C" }),
  });
  assert.ok(card.shadowRoot?.innerHTML?.length > 0);
  assert.match(card.shadowRoot.innerHTML, /Salón|22/);
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
