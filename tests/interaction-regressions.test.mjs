import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadI18nRuntime({ rootHass = null, docLang = "", navigatorLanguage = "es-ES", includeEditor = false } = {}) {
  const sandbox = {
    document: {
      documentElement: { getAttribute(name) { return name === "lang" ? docLang : ""; } },
      querySelector(selector) {
        return selector === "home-assistant" && rootHass ? { hass: rootHass } : null;
      },
    },
    navigator: { language: navigatorLanguage },
    window: null,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-i18n.js"), sandbox);
  if (includeEditor) {
    vm.runInContext(read("nodalia-editor-ui.js"), sandbox);
  }
  return sandbox.window.NodaliaI18n;
}

function loadClimateCardClass() {
  const registry = new Map();
  class FakeHTMLElement {
    attachShadow() {
      this.shadowRoot = {
        addEventListener() {},
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
    clearTimeout,
    console,
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    customElements: {
      define(name, klass) { registry.set(name, klass); },
      get(name) { return registry.get(name); },
      whenDefined() { return Promise.resolve(); },
    },
    document: {
      createElement() { return {}; },
      documentElement: { getAttribute() { return ""; } },
      querySelector() { return null; },
    },
    HTMLElement: FakeHTMLElement,
    navigator: {},
    setTimeout,
    window: null,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-climate-card.js"), sandbox);
  return registry.get("nodalia-climate-card");
}

function loadPowerFlowCardClass() {
  const registry = new Map();
  class FakeHTMLElement {
    attachShadow() {
      this.shadowRoot = {
        addEventListener() {},
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
    clearTimeout,
    console,
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    customElements: {
      define(name, klass) { registry.set(name, klass); },
      get(name) { return registry.get(name); },
      whenDefined() { return Promise.resolve(); },
    },
    document: {
      createElement() { return {}; },
      documentElement: { getAttribute() { return ""; } },
      querySelector() { return null; },
    },
    HTMLElement: FakeHTMLElement,
    navigator: {},
    setTimeout,
    window: null,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-power-flow-card.js"), sandbox);
  return registry.get("nodalia-power-flow-card");
}

test("graph tooltip keeps document hover watch guards", () => {
  const source = read("nodalia-graph-card.js");
  assert.match(source, /_onDocumentPointerMove\(/);
  assert.match(source, /_attachDocumentHoverWatch\(/);
  assert.match(source, /_detachDocumentHoverWatch\(/);
  assert.match(source, /document\.addEventListener\("pointermove", this\._onDocumentPointerMove, true\)/);
  assert.match(source, /document\.removeEventListener\("pointermove", this\._onDocumentPointerMove, true\)/);
  assert.match(source, /_scheduleHoverRender\(null\)/);
});

test("graph card chart tap shows tooltip and hold_action defaults to more-info", () => {
  const source = read("nodalia-graph-card.js");
  assert.match(source, /hold_action:\s*"more-info"/);
  assert.match(source, /_onShadowPointerDown/);
  assert.match(source, /_fireChartHoldAction/);
  assert.match(source, /_canRunHoldAction/);
});

test("light card power-down skips expanded controls shell when panel was collapsed", () => {
  const source = read("nodalia-light-card.js");
  assert.match(source, /} else if \(this\._lastControlsMarkup && this\._lastRenderedShowDetailedControls\) \{/);
  assert.match(source, /stale `_lastControlsMarkup` would otherwise force a full-height shell/);
});

test("nav media/popup entrance animations are transition-driven", () => {
  const source = read("nodalia-navigation-bar.js");
  assert.match(source, /_lastMediaToggleVisible/);
  assert.match(source, /_playPopupEntrance/);
  assert.match(source, /media-player-toggle--entering/);
  assert.match(source, /popup-panel--entering/);
  assert.match(source, /playMediaToggleEntrance = .*?!this\._lastMediaToggleVisible/);
});

test("service-security controls are exposed in visual editors", () => {
  const files = [
    "nodalia-insignia-card.js",
    "nodalia-entity-card.js",
    "nodalia-fav-card.js",
    "nodalia-advance-vacuum-card.js",
    "nodalia-notifications-card.js",
  ];

  files.forEach(file => {
    const source = read(file);
    assert.match(source, /security\.strict_service_actions/);
    assert.match(source, /security\.allowed_services/);
    assert.match(source, /valueType:\s*"csv"|data-value-type="\$\{escapeHtml\(valueType\)\}"/);
  });
});

test("insignia icon-only pills keep bottom breathing room in scroll strips", () => {
  const source = read("nodalia-insignia-card.js");
  assert.match(source, /--insignia-scroll-strip-padding-block/);
  assert.match(source, /var\(--insignia-scroll-strip-margin-block, 4px 8px\)/);
  assert.match(source, /var\(--insignia-scroll-strip-margin-block, 4px 6px\)/);
  assert.match(source, /align-self: center;/);
  assert.match(source, /overflow: visible;[\s\S]*width: auto;/);
});

test("advanced vacuum internal service calls bypass strict external allowlist", () => {
  const source = read("nodalia-advance-vacuum-card.js");
  assert.match(source, /_callInternalService\(service, data = \{\}, target = null\)/);
  assert.match(source, /_callNamedService\(service, data = \{\}, target = null\)/);
  assert.doesNotMatch(source, /persistenceBypass/);
  assert.match(source, /_callInternalService\("input_text\.set_value"/);
  assert.match(source, /_callInternalService\("vacuum\.send_command"/);
  assert.match(source, /_callInternalService\("roborock\.set_vacuum_goto_position"/);
  assert.match(source, /_callNamedService\(item\.service, serviceData, item\.target \|\| null\)/);
});

test("advanced vacuum webhook-only persistence deduplicates empty sessions", () => {
  const source = read("nodalia-advance-vacuum-card.js");
  assert.match(source, /const hasEntityTarget = Boolean\(entityId\)/);
  assert.match(source, /const hasWebhookTarget = Boolean\(webhookId\)/);
  assert.match(source, /if \(hasEntityTarget && serializedTrim === currentValue\)/);
  assert.match(source, /if \(hasEntityTarget && serializedTrim === this\._lastSubmittedSharedCleaningSessionValue\)/);
  assert.match(
    source,
    /!hasEntityTarget &&\s*hasWebhookTarget &&\s*serializedTrim === this\._lastSubmittedSharedCleaningSessionValue/,
  );
  assert.doesNotMatch(source, /serializedTrim !== "" &&\s*serializedTrim === this\._lastSubmittedSharedCleaningSessionValue/);
});

test("advanced vacuum skips remote write when serialized session still overflows", () => {
  const source = read("nodalia-advance-vacuum-card.js");
  assert.match(source, /if \(serialized\.length > maxLength\) \{\s*serialized = this\._serializeSharedCleaningSession\(session, \{ minimal: true \}\);\s*\}/);
  assert.match(source, /console\.warn\("Nodalia Advance Vacuum Card shared cleaning session exceeds helper length limit"\)/);
  assert.match(source, /SHARED_CLEANING_SESSION_OVERFLOW_SENTINEL/);
  assert.doesNotMatch(source, /if \(serialized\.length > maxLength\) \{[\s\S]*serialized = ""/);
});

test("navigation media player toggle keeps theme fallbacks after sanitized values", () => {
  const source = read("nodalia-navigation-bar.js");
  assert.match(source, /const mediaToggleBackgroundBase = sanitizeCssRuntimeValue\(config\.styles\.media_player\.background\)[\s\S]*"var\(--ha-card-background, var\(--card-background-color\)\)"/);
  assert.match(source, /const mediaToggleBorder = sanitizeCssRuntimeValue\(config\.styles\.media_player\.border\)[\s\S]*"1px solid color-mix\(in srgb, var\(--primary-text-color\) 8%, transparent\)"/);
  assert.match(source, /const mediaToggleBorderRadius = sanitizeCssRuntimeValue\(config\.styles\.media_player\.border_radius\)[\s\S]*"18px"/);
  assert.match(source, /const mediaToggleBoxShadow = sanitizeCssRuntimeValue\(config\.styles\.media_player\.box_shadow\)[\s\S]*"inset 0 1px 0 color-mix\(in srgb, var\(--primary-text-color\) 4%, transparent\), 0 10px 24px rgba\(0, 0, 0, 0\.16\)"/);
});

test("notifications mobile sent state only marks successful deliveries", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(source, /Promise\.all\(\[[\s\S]*\]\)\.then\(results => \{/);
  assert.match(source, /const delivered = results\.some\(Boolean\)/);
  assert.match(source, /if \(delivered\) \{\s*this\._mobileSent\.add\(hash\);/);
});

test("calendar native webhook failures show composer errors", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /if \(!ok\) \{\s*this\._setComposerError\("native", this\._uiText\("errors\.createEvent"/);
});

test("i18n automatic language prefers HA profile locale over stale legacy language", () => {
  const i18n = loadI18nRuntime({
    rootHass: {
      language: "es",
      locale: { language: "en-US" },
      selectedLanguage: "en",
    },
    navigatorLanguage: "es-ES",
  });

  assert.equal(i18n.resolveLanguage(null, "auto"), "en");
  assert.equal(i18n.resolveLanguage({ language: "es", locale: { language: "en-US" } }, "auto"), "en");
  assert.equal(i18n.resolveLanguage({ language: "es", selectedLanguage: "en" }, "auto"), "en");
  assert.equal(i18n.resolveLanguage({ language: "es", user: { language: "en" } }, "auto"), "en");
  assert.equal(i18n.resolveLanguage({ language: "es" }, "English"), "en");
});

test("i18n automatic language does not use browser Spanish inside Home Assistant", () => {
  const i18n = loadI18nRuntime({
    rootHass: { states: {} },
    navigatorLanguage: "es-ES",
  });

  assert.equal(i18n.resolveLanguage(null, "auto"), "en");
});

test("editor labels follow HA profile language before stale legacy language", () => {
  const i18n = loadI18nRuntime({
    rootHass: {
      selectedLanguage: "en",
      language: "es",
    },
    navigatorLanguage: "es-ES",
    includeEditor: true,
  });

  const hass = { selectedLanguage: "en", language: "es" };
  assert.equal(i18n.editorStr(hass, "auto", "Subir"), "Move up");
  assert.equal(i18n.editorStr(hass, "auto", "Nombre"), "Name");
  assert.equal(i18n.editorStr(hass, "auto", "Horas a mostrar"), "Hours to show");
});

test("climate dial drag attaches window listeners only while dragging", () => {
  const source = read("nodalia-climate-card.js");
  assert.match(source, /this\._dragWindowListenersAttached = false/);
  assert.match(source, /_setDragWindowListeners\(enabled\)/);
  assert.match(source, /this\._setDragWindowListeners\(true\)/);
  assert.match(source, /this\._setDragWindowListeners\(false\)/);
});

test("climate five-mode dial controls use dense two-row sizing", () => {
  const source = read("nodalia-climate-card.js");
  assert.match(source, /if \(n === 5 \|\| n === 6\) \{\s*return \[fragments\.slice\(0, 3\), fragments\.slice\(3\)\];/);
  assert.match(source, /modeDialButtonCount === 5 \|\| modeDialButtonCount === 6/);
  assert.match(source, /modeDialButtonCount >= 5\s*\?\s*Math\.max\(28, Math\.round\(modeControlSize - 6\)\)/);
  assert.match(source, /modeDialButtonCount >= 5\s*\?\s*\(tightLayout \? "4px" : "5px"\)/);
});

test("climate off null setpoint step buttons wake and create a setpoint from current temperature", async () => {
  const ClimateCard = loadClimateCardClass();
  assert.ok(ClimateCard, "climate card custom element should register");

  const buildCard = (stateValue = "off") => {
    const calls = [];
    const card = new ClimateCard();
    card._config = {
      entity: "climate.ecobee",
      haptics: { enabled: false },
    };
    card._hass = {
      callService: async (...args) => {
        calls.push(args);
      },
      states: {
        "climate.ecobee": {
          state: stateValue,
          attributes: {
            current_temperature: 22.5,
            hvac_action: "idle",
            hvac_modes: ["heat_cool", "heat", "cool", "off"],
            max_temp: 35,
            min_temp: 7,
            supported_features: 411,
            target_temp_high: null,
            target_temp_low: null,
            target_temp_step: 0.5,
            temperature: null,
          },
        },
      },
    };
    return { calls, card };
  };

  const plus = buildCard();
  plus.card._changeTemperatureBy(1);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(plus.calls)), [
    ["climate", "set_hvac_mode", { entity_id: "climate.ecobee", hvac_mode: "heat" }],
    ["climate", "set_temperature", { entity_id: "climate.ecobee", temperature: 23, hvac_mode: "heat" }],
  ]);

  const minus = buildCard();
  minus.card._changeTemperatureBy(-1);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(minus.calls)), [
    ["climate", "set_hvac_mode", { entity_id: "climate.ecobee", hvac_mode: "heat" }],
    ["climate", "set_temperature", { entity_id: "climate.ecobee", temperature: 22, hvac_mode: "heat" }],
  ]);

  const heatCool = buildCard("heat_cool");
  heatCool.card._changeTemperatureBy(1);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(heatCool.calls)), [
    ["climate", "set_hvac_mode", { entity_id: "climate.ecobee", hvac_mode: "heat" }],
    ["climate", "set_temperature", { entity_id: "climate.ecobee", temperature: 23, hvac_mode: "heat" }],
  ]);
});

test("climate single-setpoint support keeps min/max fallback and rejects null target", async () => {
  const ClimateCard = loadClimateCardClass();
  assert.ok(ClimateCard, "climate card custom element should register");

  const calls = [];
  const card = new ClimateCard();
  card._config = {
    entity: "climate.single",
    haptics: { enabled: false },
  };
  card._hass = {
    callService: async (...args) => {
      calls.push(args);
    },
    states: {
      "climate.single": {
        state: "heat",
        attributes: {
          current_temperature: null,
          hvac_modes: ["heat", "off"],
          max_temp: 35,
          min_temp: 7,
          supported_features: 1,
          target_temp_high: null,
          target_temp_low: null,
          target_temp_step: 0.5,
          temperature: null,
        },
      },
    },
  };

  const state = card._getState();
  assert.equal(card._supportsTargetTemperature(state), true);

  card._changeTemperatureBy(1);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, []);
});

test("climate queued wake commits include hvac_mode in set_temperature", async () => {
  const ClimateCard = loadClimateCardClass();
  assert.ok(ClimateCard, "climate card custom element should register");

  const calls = [];
  const card = new ClimateCard();
  card._config = {
    entity: "climate.ecobee",
    haptics: { enabled: false },
  };
  card._hass = {
    callService: async (...args) => {
      calls.push(args);
    },
    states: {
      "climate.ecobee": {
        state: "off",
        attributes: {
          current_temperature: 22.5,
          hvac_modes: ["heat_cool", "heat", "cool", "off"],
          max_temp: 35,
          min_temp: 7,
          supported_features: 411,
          target_temp_high: null,
          target_temp_low: null,
          target_temp_step: 0.5,
          temperature: null,
        },
      },
    },
  };

  const queued = card._queueTemperatureCommit(23, {
    hvacWake: true,
    immediate: true,
    render: false,
  });
  assert.equal(queued, 23);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["climate", "set_hvac_mode", { entity_id: "climate.ecobee", hvac_mode: "heat" }],
    ["climate", "set_temperature", { entity_id: "climate.ecobee", temperature: 23, hvac_mode: "heat" }],
  ]);
  card.disconnectedCallback();

  calls.length = 0;
  card._hass.states["climate.ecobee"].attributes.hvac_modes = ["off"];
  const direct = card._queueTemperatureCommit(22, {
    hvacWake: true,
    immediate: true,
    render: false,
  });
  assert.equal(direct, 22);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["climate", "set_temperature", { entity_id: "climate.ecobee", temperature: 22 }],
  ]);
  card.disconnectedCallback();
});

test("power flow derives grid import, export, and battery charge paths from home demand", () => {
  const PowerFlowCard = loadPowerFlowCardClass();
  assert.ok(PowerFlowCard, "power flow card custom element should register");

  const buildCard = ({ home = 100, solar = 0, battery = 0, batteryLevel = null }) => {
    const card = new PowerFlowCard();
    card._config = {
      entities: {
        home: { entity: "sensor.home", color: "#ffffff" },
        grid: { color: "#6da8ff", export_color: "#44d07b" },
        solar: { entity: "sensor.solar", color: "#f6b73c" },
        battery: { entity: "sensor.battery", color: "#61c97a", secondary_info: { attribute: "battery_level" } },
        water: {},
        gas: {},
        individual: [],
      },
      display_zero_lines: { mode: "hide", transparency: 50, grey_color: [189, 189, 189] },
      show_secondary_info: true,
      show_values: true,
      show_labels: true,
    };
    card._hass = {
      states: {
        "sensor.home": { state: String(home), attributes: { unit_of_measurement: "W", friendly_name: "Home" } },
        "sensor.solar": { state: String(solar), attributes: { unit_of_measurement: "W", friendly_name: "Solar" } },
        "sensor.battery": {
          state: String(battery),
          attributes: {
            unit_of_measurement: "W",
            friendly_name: "Battery",
            ...(batteryLevel === null ? {} : { battery_level: batteryLevel }),
          },
        },
      },
    };
    return card;
  };

  const gridImport = buildCard({ home: 100, solar: 0, battery: 0 })._getNodes();
  assert.equal(gridImport.grid.entityId, "sensor.home");
  assert.equal(gridImport.grid.value, 100);
  assert.equal(gridImport._flowValues.gridHome, 100);
  assert.equal(gridImport.grid.position.x, 18);
  assert.equal(gridImport.grid.position.y, 52);
  assert.equal(gridImport.home.position.x, 82);
  assert.equal(gridImport.home.position.y, 52);
  assert.equal(buildCard({ home: 100, solar: 0, battery: 0 })._getGridDirectionIcon(gridImport.grid), "mdi:transmission-tower-export");

  const solarCoversHome = buildCard({ home: 100, solar: 100, battery: 0 })._getNodes();
  assert.equal(solarCoversHome.grid.value, 0);
  assert.equal(solarCoversHome._flowValues.solarHome, 100);
  assert.equal(solarCoversHome._flowValues.gridHome, 0);

  const batteryCoversHome = buildCard({ home: 100, solar: 0, battery: 100 })._getNodes();
  assert.equal(batteryCoversHome.grid.value, 0);
  assert.equal(batteryCoversHome._flowValues.batteryHome, 100);
  assert.equal(batteryCoversHome.battery.icon, "mdi:battery-arrow-down");

  const solarChargesBattery = buildCard({ home: 100, solar: 200, battery: -100 });
  const solarChargeNodes = solarChargesBattery._getNodes();
  const solarChargeLines = solarChargesBattery._buildLines(solarChargeNodes).filter(line => line.active).map(line => line.id).sort();
  assert.equal(solarChargeNodes.grid.value, 0);
  assert.equal(solarChargeNodes._flowValues.solarBattery, 100);
  assert.ok(solarChargeLines.includes("solar-battery"));
  assert.ok(solarChargeNodes._flowValues.solarGrid === 0);

  const gridChargesBattery = buildCard({ home: 100, solar: 0, battery: -100 });
  const gridChargeNodes = gridChargesBattery._getNodes();
  const gridChargeLines = gridChargesBattery._buildLines(gridChargeNodes).filter(line => line.active).map(line => line.id).sort();
  assert.equal(gridChargeNodes.grid.value, 200);
  assert.equal(gridChargeNodes._flowValues.gridHome, 100);
  assert.equal(gridChargeNodes._flowValues.gridBattery, 100);
  assert.equal(gridChargeNodes.battery.icon, "mdi:battery-charging");
  assert.ok(gridChargeLines.includes("grid-battery"));

  const splitBatteryDischargeMatchesSingle = () => {
    const card = new PowerFlowCard();
    card._config = {
      entities: {
        home: { entity: "sensor.home", color: "#ffffff" },
        grid: { color: "#6da8ff", export_color: "#44d07b" },
        solar: { entity: "sensor.solar", color: "#f6b73c" },
        battery: {
          entity: { consumption: "sensor.battery_in", production: "sensor.battery_out" },
          color: "#61c97a",
        },
        water: {},
        gas: {},
        individual: [],
      },
      display_zero_lines: { mode: "hide", transparency: 50, grey_color: [189, 189, 189] },
      show_secondary_info: true,
      show_values: true,
      show_labels: true,
    };
    card._hass = {
      states: {
        "sensor.home": { state: "176", attributes: { unit_of_measurement: "W", friendly_name: "Home" } },
        "sensor.solar": { state: "4200", attributes: { unit_of_measurement: "W", friendly_name: "Solar" } },
        "sensor.battery_in": { state: "0", attributes: { unit_of_measurement: "W", friendly_name: "Battery in" } },
        "sensor.battery_out": { state: "1200", attributes: { unit_of_measurement: "W", friendly_name: "Battery out" } },
      },
    };
    return card;
  };
  const splitNodes = splitBatteryDischargeMatchesSingle()._getNodes();
  assert.equal(splitNodes.battery.value, 1200, "split battery: production minus consumption = discharge (positive)");
  assert.equal(splitNodes._flowValues.gridBattery, 0);
  assert.equal(splitNodes._flowValues.batteryGrid, 1200);
  assert.ok(splitBatteryDischargeMatchesSingle()._buildLines(splitNodes).some(line => line.id === "battery-grid" && line.active));

  const exportNodes = buildCard({ home: 100, solar: 200, battery: 0, batteryLevel: 100 })._getNodes();
  const exportLines = buildCard({ home: 100, solar: 200, battery: 0, batteryLevel: 100 })
    ._buildLines(exportNodes)
    .filter(line => line.active)
    .map(line => line.id)
    .sort();
  assert.equal(exportNodes.grid.value, -100);
  assert.equal(exportNodes.grid.isExporting, true);
  assert.equal(exportNodes.grid.secondary, "");
  assert.equal(buildCard({ home: 100, solar: 200, battery: 0 })._getGridDirectionIcon(exportNodes.grid), "mdi:transmission-tower-import");
  assert.equal(exportNodes.battery.icon, "mdi:battery-check");
  assert.equal(exportNodes._flowValues.gridHome, 0);
  assert.equal(exportNodes._flowValues.solarGrid, 100);
  assert.ok(exportLines.includes("solar-grid"));
  assert.ok(!exportLines.includes("grid"));

  const buildMeasuredCard = ({ grid = 0, solar = 0, battery = 0 }) => {
    const card = new PowerFlowCard();
    card._config = {
      entities: {
        home: {},
        grid: { entity: "sensor.grid", color: "#6da8ff", export_color: "#44d07b" },
        solar: { entity: "sensor.solar", color: "#f6b73c" },
        battery: { entity: "sensor.battery", color: "#61c97a" },
        water: {},
        gas: {},
        individual: [],
      },
      display_zero_lines: { mode: "hide", transparency: 50, grey_color: [189, 189, 189] },
      show_secondary_info: true,
      show_values: true,
      show_labels: true,
    };
    card._hass = {
      states: {
        "sensor.grid": { state: String(grid), attributes: { unit_of_measurement: "W", friendly_name: "Grid" } },
        "sensor.solar": { state: String(solar), attributes: { unit_of_measurement: "W", friendly_name: "Solar" } },
        "sensor.battery": { state: String(battery), attributes: { unit_of_measurement: "W", friendly_name: "Battery" } },
      },
    };
    return card;
  };

  const measuredSolarExportCard = buildMeasuredCard({ grid: -100, solar: 200, battery: 0 });
  const measuredSolarExport = measuredSolarExportCard._getNodes();
  const measuredSolarExportLines = measuredSolarExportCard._buildLines(measuredSolarExport)
    .filter(line => line.active)
    .map(line => line.id)
    .sort();
  assert.equal(measuredSolarExport.home.value, 100);
  assert.equal(measuredSolarExport._flowValues.gridHome, 0);
  assert.equal(measuredSolarExport._flowValues.solarHome, 100);
  assert.equal(measuredSolarExport._flowValues.solarGrid, 100);
  assert.ok(measuredSolarExportLines.includes("solar-grid"));
  assert.ok(!measuredSolarExportLines.includes("grid"));

  const measuredBatteryExportCard = buildMeasuredCard({ grid: -50, solar: 0, battery: 100 });
  const measuredBatteryExport = measuredBatteryExportCard._getNodes();
  const measuredBatteryExportLines = measuredBatteryExportCard._buildLines(measuredBatteryExport)
    .filter(line => line.active)
    .map(line => line.id)
    .sort();
  assert.equal(measuredBatteryExport.home.value, 50);
  assert.equal(measuredBatteryExport._flowValues.batteryHome, 50);
  assert.equal(measuredBatteryExport._flowValues.batteryGrid, 50);
  assert.ok(measuredBatteryExportLines.includes("battery-grid"));
  assert.ok(!measuredBatteryExportLines.includes("grid"));
});

test("cover editor uses domain-filtered pickers and fan-style editor controls", () => {
  const source = read("nodalia-cover-card.js");
  const editorLabels = JSON.parse(read("i18n/editor/en.json"));
  assert.match(source, /control\.includeDomains = \["cover"\]/);
  assert.match(source, /control\.entityFilter = stateObj => String\(stateObj\?\.entity_id \|\| ""\)\.startsWith\("cover\."\)/);
  assert.match(source, /class="editor-control-host"[\s\S]*data-mounted-control="cover-entity"/);
  assert.match(source, /<ha-icon-picker[\s\S]*data-field="\$\{escapeHtml\(field\)\}"/);
  assert.match(source, /editor-section__actions/);
  assert.match(source, /ed\.vacuum\.haptic_style/);
  assert.match(source, /styles\.control\.accent_color/);
  assert.equal(editorLabels["ed.fan.style_slider_color"], "Slider color");
  assert.equal(editorLabels["ed.fan.style_slider_height"], "Slider thickness");
  assert.equal(editorLabels["ed.fan.style_slider_wrap_height"], "Slider container height");
});

test("cover card pointer controls avoid focus-driven dashboard scroll jumps", () => {
  const source = read("nodalia-cover-card.js");
  assert.match(source, /const actionControl = path\.find\(node => node instanceof HTMLElement && node\.dataset\?\.coverAction\)/);
  assert.match(source, /_isCardTapAction\(action\) \{\s*return action === "body" \|\| action === "icon";\s*\}/);
  assert.match(
    source,
    /const coverAction = button\.dataset\.coverAction;\s*if \(this\._isCardTapAction\(coverAction\)\) \{[\s\S]*this\._runAction\(coverAction\);[\s\S]*return;\s*\}\s*this\._triggerHaptic\(\)/,
  );
  assert.match(
    source,
    /if \(actionControl\) \{[\s\S]*if \(this\._isCardTapAction\(actionControl\.dataset\?\.coverAction\)\) \{[\s\S]*this\._preventNonTouchFocus\(event\);[\s\S]*return;[\s\S]*\}[\s\S]*this\._preventNonTouchFocus\(event\);/,
  );
  assert.match(source, /chipAction === "open" \|\| chipAction === "close" \|\| chipAction === "stop"/);
  assert.match(
    source,
    /Open \/ stop \/ close: blur only — scroll snapshot \+ rAF restore fights the browser's scroll-into-view/,
  );
  assert.match(source, /this\.shadowRoot\.addEventListener\("pointerdown", this\._onPointerDown, \{ capture: true \}\)/);
  assert.match(source, /this\.shadowRoot\.addEventListener\("mousedown", this\._onMouseDown, \{ capture: true \}\)/);
  assert.match(source, /this\.shadowRoot\.addEventListener\("touchstart", this\._onTouchStart, \{ passive: false, capture: true \}\)/);
  assert.match(source, /String\(event\.pointerType \|\| ""\)\.toLowerCase\(\) === "touch"/);
  assert.match(
    source,
    /_onTouchStart\(event\) \{[\s\S]*const slider = path\.find\(node => node instanceof HTMLInputElement && node\.dataset\?\.coverControl\);[\s\S]*return;\s*\}\s*\}/,
  );
  assert.match(source, /_scheduleInteractionScrollRestore\(\) \{[\s\S]*window\.requestAnimationFrame/);
  assert.doesNotMatch(source, /_restoreInteractionScroll\(\)/);
  assert.match(source, /_rememberInteractionScroll\(\)/);
  assert.match(source, /_restoreInteractionScrollSnapshot\(options = \{\}\)/);
  assert.match(source, /this\._restoreInteractionScrollSnapshot\(\{ preserve: true \}\)/);
  assert.doesNotMatch(source, /this\._lastRenderedIsActive = isActive;\s*\n\s*this\._restoreInteractionScrollSnapshot/);
  assert.match(source, /window\.addEventListener\("wheel", this\._cancelInteractionScrollRestore, \{ passive: true, capture: true \}\)/);
  assert.match(source, /window\.addEventListener\("touchmove", this\._cancelInteractionScrollRestore, \{ passive: true, capture: true \}\)/);
  assert.match(source, /_cancelInteractionScrollRestore\(\)/);
  assert.match(source, /overflow-anchor: none/);
  assert.match(source, /_startSliderDrag\(slider, event\.clientX, event, event\.pointerId\)/);
  assert.match(source, /this\._pendingRenderAfterDrag = true/);
  assert.match(source, /typeof button\.blur === "function"[\s\S]*button\.blur\(\)/);
  assert.match(source, /tabindex="-1"/);
  assert.doesNotMatch(source, /data-cover-action="body"[\s\S]{0,80}tabindex="-1"/);
  assert.match(source, /data-cover-action="icon"[^>]*tabindex="-1"/);
  assert.match(source, /opacity: 0;[\s\S]*outline: none;[\s\S]*touch-action: pan-y;/);
});

test("cover card combines sliders and a row toggle for open/stop/close", () => {
  const source = read("nodalia-cover-card.js");
  const controlsMarkupStart = source.indexOf("const controlsMarkup = hasSliders");
  assert.ok(controlsMarkupStart > 0);
  assert.match(source, /data-cover-action="toggle_controls_view"/);
  assert.match(source, /fan-card__slider-actions/);
  assert.match(source, /fan-card__cover-controls-pane/);
  assert.match(source, /fan-card--cover-ui-slider/);
  assert.match(source, /fan-card--cover-ui-arrows/);
  const posSlider = source.indexOf('this._renderSlider("position"', controlsMarkupStart);
  const toggleIdx = source.indexOf('data-cover-action="toggle_controls_view"', controlsMarkupStart);
  assert.ok(posSlider > controlsMarkupStart);
  assert.ok(toggleIdx > posSlider);
});

test("cover card switches open/close arrow orientation by device class and open_close_icons", () => {
  const source = read("nodalia-cover-card.js");
  assert.match(source, /open_close_icons:\s*"auto"/);
  assert.match(source, /function resolveOpenCloseControlIcons/);
  assert.match(source, /coverDeviceClassPrefersHorizontalOpenClose/);
  assert.match(source, /"ed\.cover\.open_close_icons"/);
  assert.match(source, /escapeHtml\(openCloseIcons\.open\)/);
});

test("entity card supports entity pictures in the main icon bubble", () => {
  const source = read("nodalia-entity-card.js");
  assert.match(source, /show_entity_picture: false/);
  assert.match(source, /entity_picture: ""/);
  assert.match(source, /_getEntityPicture\(state\)/);
  assert.match(source, /<img class="entity-card__picture"/);
  assert.match(source, /ed\.entity\.show_entity_picture/);
  assert.match(source, /ed\.entity\.entity_picture/);
});

test("device cards support entity pictures in the main icon bubble", () => {
  [
    ["nodalia-fan-card.js", "fan-card__picture"],
    ["nodalia-light-card.js", "light-card__picture"],
    ["nodalia-vacuum-card.js", "vacuum-card__picture"],
    ["nodalia-humidifier-card.js", "humidifier-card__picture"],
    ["nodalia-alarm-panel-card.js", "alarm-card__picture"],
    ["nodalia-climate-card.js", "climate-card__picture"],
  ].forEach(([file, pictureClass]) => {
    const source = read(file);
    assert.match(source, /show_entity_picture: false/);
    assert.match(source, /entity_picture: ""/);
    assert.match(source, /_getEntityPicture\(state\)/);
    assert.match(source, /attrs\.entity_picture_local \|\| attrs\.entity_picture/);
    assert.match(source, new RegExp(`<img class="${pictureClass}"`));
    assert.match(source, /ed\.entity\.show_entity_picture/);
    assert.match(source, /ed\.entity\.entity_picture/);
  });
});

test("alarm panel PIN input keeps masked text visible across themes", () => {
  const source = read("nodalia-alarm-panel-card.js");
  assert.match(source, /show_code_input: "auto"/);
  assert.match(source, /if \(this\._config\?\.show_code_input === true\) \{[\s\S]*return true;/);
  assert.match(source, /_getCodeInputEditorMode\(value = this\._config\?\.show_code_input\)/);
  assert.match(source, /ed\.media_player\.tristate_auto/);
  assert.match(source, /type="password"/);
  assert.match(source, /color: var\(--primary-text-color\);[\s\S]*-webkit-text-fill-color: var\(--primary-text-color\);/);
  assert.match(source, /caret-color: var\(--primary-text-color\);/);
  assert.match(source, /opacity: 1;/);
  assert.match(source, /_alarmPanelUi\("codePlaceholder"/);
  assert.match(source, /alarm-card__chip--pin-error/);
  assert.match(source, /_showNativePinErrorChip/);
  assert.match(source, /_nativePinErrorLabel/);
});

test("calendar card reuses date/time formatters during render", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /DATE_TIME_FORMATTER_CACHE_LIMIT/);
  assert.match(source, /function getDateTimeFormatter\(locale, options\)/);
  assert.equal((source.match(/new Intl\.DateTimeFormat/g) || []).length, 1);
  assert.match(source, /formatDateLabel\(date, locale\)[\s\S]*getDateTimeFormatter\(locale/);
  assert.match(source, /formatTimeLabel\(date, locale\)[\s\S]*getDateTimeFormatter\(locale/);
});

test("numeric display cards use Home Assistant locale instead of hardcoded Spanish", () => {
  [
    "nodalia-power-flow-card.js",
    "nodalia-circular-gauge-card.js",
    "nodalia-graph-card.js",
  ].forEach(file => {
    const source = read(file);
    assert.doesNotMatch(source, /toLocaleString\(["']es-ES["']/);
    assert.match(source, /getHassLocaleTag\(hass, language = "auto"\)/);
    assert.match(source, /window\.NodaliaI18n\?\.localeTag/);
  });
});

test("notifications entrance animation does not rearm on list refreshes", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(source, /const animateEntrance = animations\.enabled && this\._animateContentOnNextRender/);
  assert.doesNotMatch(source, /notificationSetChanged/);
  assert.doesNotMatch(source, /_renderIfChanged\(true\);\s*\n\s*\}, Math\.max\(180, animations\.contentDuration \+ 160\)\);/);
  assert.match(source, /_lastRouteKey = ""/);
  assert.match(source, /_getRouteKey\(\)/);
  assert.match(source, /if \(nextRouteKey && nextRouteKey !== this\._lastRouteKey\) \{/);
  assert.match(source, /this\._replayEntranceAnimation\(\{ force: true \}\)/);
  assert.match(
    source,
    /\/\/ Match entity\/weather cards: do not render \(or consume entrance\) before hass/,
  );
});
