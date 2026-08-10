import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadI18nRuntime({ rootHass = null, docLang = "", navigatorLanguage = "es-ES", localStorageSelectedLanguage = null, includeEditor = false } = {}) {
  const storage = new Map();
  if (localStorageSelectedLanguage != null) {
    storage.set("selectedLanguage", JSON.stringify(localStorageSelectedLanguage));
  }
  const sandbox = {
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
    },
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

function loadNodaliaUtils(sandbox) {
  vm.runInContext(read("nodalia-utils.js"), sandbox);
}

function loadCardNormalizeConfig(file, className) {
  const source = read(file);
  const classStart = source.indexOf(`class ${className}`);
  assert.ok(classStart > 0, `${file} should define ${className}`);
  const sandbox = {
    URL,
    window: null,
    customElements: { define() {}, get() { return null; } },
    HTMLElement: class {},
    globalThis: null,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  loadNodaliaUtils(sandbox);
  vm.runInContext(`${source.slice(0, classStart)}\nglobalThis.__normalizeConfig = normalizeConfig;`, sandbox);
  return sandbox.__normalizeConfig;
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
  loadNodaliaUtils(sandbox);
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
  loadNodaliaUtils(sandbox);
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

test("cards default empty name field to entity friendly name", () => {
  const utils = read("nodalia-utils.js");
  assert.match(utils, /function applyDefaultConfigNameFromEntity\(config, hass, options = \{\}\)/);
  const fan = read("nodalia-fan-card.js");
  assert.match(fan, /applyDefaultConfigNameFromEntity\?\.\(this\._config, this\._hass, \{ previousEntity \}\)/);
  assert.match(fan, /applyDefaultConfigNameFromEntity\?\.\(this\._config, this\._hass\)/);
});

test("light card temperature slider gradient follows mired vs kelvin control direction", () => {
  const source = read("nodalia-light-card.js");
  assert.match(source, /function getTemperatureSliderTrackGradient\(unit = "kelvin"\)/);
  assert.match(source, /unit === "mired"[\s\S]*#8fd3ff 0%/);
  assert.match(source, /getTemperatureSliderTrackGradient\(temperatureControlDomain\.unit\)/);
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

test("navigation volume changes patch controls without rebuilding the card", () => {
  const source = read("nodalia-navigation-bar.js");
  assert.match(source, /_patchMediaVolumeControls\(/);
  assert.match(source, /nextSignature === this\._lastRenderSignature\) \{[\s\S]*?_patchMediaVolumeControls\(\);[\s\S]*?return;/);
  assert.match(source, /typeof attrs\.volume_level === "number" \? 1 : 0/);
  assert.match(source, /const nextVolume = clamp\(currentVolume [+-] 0\.08, 0, 1\);[\s\S]*?_patchMediaVolumeControls\(entityId, nextVolume\)/);
  assert.match(source, /this\._lastRenderSignature = this\._getRenderSignature\(this\._hass\);/);
  assert.doesNotMatch(source, /Number\(attrs\.volume_level \?\? -1\)/);
});

test("visual editors reattach shadow listeners on reconnect", () => {
  const editorFiles = [
    ["nodalia-light-card.js", "NodaliaLightCardEditor"],
    ["nodalia-fan-card.js", "NodaliaFanCardEditor"],
    ["nodalia-humidifier-card.js", "NodaliaHumidifierCardEditor"],
    ["nodalia-cover-card.js", "NodaliaCoverCardEditor"],
    ["nodalia-climate-card.js", "NodaliaClimateCardEditor"],
  ];

  editorFiles.forEach(([file, editorClass]) => {
    const source = read(file);
    const editorStart = source.indexOf(`class ${editorClass}`);
    assert.ok(editorStart >= 0, `${file} should define ${editorClass}`);
    const attachStart = source.indexOf("_attachEditorShadowListeners", editorStart);
    const editorCtorBlock = source.slice(editorStart, attachStart);

    assert.match(source, /_attachEditorShadowListeners\(/);
    assert.match(source, /connectedCallback\(\) \{\s*\n\s*this\._attachEditorShadowListeners\(\)/);
    assert.doesNotMatch(editorCtorBlock, /shadowRoot\.addEventListener/);
  });
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

test("media player editor keeps player row when entity is cleared", () => {
  const source = read("nodalia-media-player.js");
  assert.doesNotMatch(source, /config\.players = Array\.isArray\(config\.players\) \? config\.players\.filter\(player => player\?\.entity\)/);
  assert.match(source, /if \(key === "entity" && item === ""\)/);
  assert.match(source, /isEntityField && \(value === undefined \|\| value === null \|\| value === ""\)/);
  assert.match(source, /return this\._getConfiguredPlayers\(\)\.filter\(player => \{[\s\S]*!player\?\.entity/);
});

test("media player editor preserves nested service data drafts until change commit", () => {
  const source = read("nodalia-media-player.js");
  const inputStart = source.lastIndexOf("  _onShadowInput(event)");
  const inputBlock = source.slice(inputStart, source.indexOf("\n  _onShadowValueChanged(event)", inputStart));
  const valueStart = source.indexOf("  _onShadowValueChanged(event)", inputStart);
  const valueBlock = source.slice(valueStart, source.indexOf("\n  _onShadowClick(event)", valueStart));

  assert.match(inputBlock, /this\._setFieldValue\(input\.dataset\.field, nextValue\)/);
  assert.match(inputBlock, /if \(event\.type === "change"\) \{[\s\S]*this\._emitConfig\(\)/);
  assert.doesNotMatch(inputBlock, /normalizeConfig|_setEditorConfig/);
  assert.doesNotMatch(valueBlock, /normalizeConfig|_setEditorConfig/);
  assert.doesNotMatch(source, /_setEditorConfig\(\)/);
});

test("media player editor round-trips service data as a JSON object", () => {
  const sandbox = {
    URL,
    window: null,
    customElements: { define() {}, get() { return null; } },
    HTMLElement: class {},
    globalThis: {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-media-player.js"), sandbox);

  const helpers = sandbox.__NODALIA_MEDIA_PLAYER__;
  assert.equal(
    helpers.formatEditorJsonValue({ entity_id: "input_boolean.media_power" }),
    '{\n  "entity_id": "input_boolean.media_power"\n}',
  );
  assert.equal(
    helpers.formatEditorJsonValue('{"entity_id":"switch.projector"}'),
    '{\n  "entity_id": "switch.projector"\n}',
  );

  const parsed = helpers.parseEditorJsonObject('{"entity_id":"switch.projector"}');
  assert.equal(parsed.valid, true);
  assert.equal(JSON.stringify(parsed.value), '{"entity_id":"switch.projector"}');
  assert.equal(helpers.parseEditorJsonObject('{"entity_id":').valid, false);
  assert.equal(helpers.parseEditorJsonObject('["switch.projector"]').valid, false);
});

test("media player editor rejects invalid service data without emitting it", () => {
  const source = read("nodalia-media-player.js");
  const inputStart = source.lastIndexOf("  _onShadowInput(event)");
  const inputBlock = source.slice(inputStart, source.indexOf("\n  _onShadowValueChanged(event)", inputStart));

  assert.match(source, /valueType: "json"/);
  assert.match(source, /action\?\.service_data \?\? action\?\.data/);
  assert.match(source, /textarea\[aria-invalid="true"\]/);
  assert.match(inputBlock, /if \(nextValue === INVALID_EDITOR_VALUE\) \{\s*return;/);
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

test("person card translates location state with runtime i18n", () => {
  const source = read("nodalia-person-card.js");
  assert.match(source, /_personStrings\(\)/);
  assert.match(source, /person\.notHome/);
  assert.doesNotMatch(source, /return "En casa";/);
  assert.doesNotMatch(source, /return "Fuera";/);
});

test("person card normalizes native Lovelace tap hold and double-tap actions", () => {
  const normalizeConfig = loadCardNormalizeConfig("nodalia-person-card.js", "NodaliaPersonCard");
  const config = normalizeConfig({
    entity: "person.john",
    tap_action: { action: "navigate", navigation_path: "#bubblecard_john" },
    hold_action: {
      action: "perform-action",
      perform_action: "script.person_hold",
      data: { source: "person-card" },
      target: { entity_id: "script.person_hold" },
    },
    double_tap_action: { action: "url", url_path: "https://example.com/person", new_tab: true },
  });

  assert.equal(config.tap_action, "navigate");
  assert.equal(config.navigation_path, "#bubblecard_john");
  assert.equal(config.hold_action, "service");
  assert.equal(config.hold_service, "script.person_hold");
  assert.equal(config.hold_service_data, JSON.stringify({ source: "person-card" }));
  assert.equal(config.hold_service_target, JSON.stringify({ entity_id: "script.person_hold" }));
  assert.equal(config.double_tap_action, "url");
  assert.equal(config.double_tap_url, "https://example.com/person");
  assert.equal(config.double_tap_new_tab, true);
});

test("person card actions use safe navigation services and gesture arbitration", () => {
  const source = read("nodalia-person-card.js");
  assert.match(source, /bindHostPointerHoldGesture/);
  assert.match(source, /scheduleCardZoneTap/);
  assert.match(source, /cancelCardZoneTap/);
  assert.match(source, /sanitizeActionUrl\?\.\(value, \{ allowRelative: true, allowHash: true \}\)/);
  assert.match(source, /window\.history\.pushState\(null, "", path\)/);
  assert.match(source, /window\.dispatchEvent\(new CustomEvent\("location-changed"/);
  assert.match(source, /_isConfiguredPersonServiceAllowed/);
  assert.match(source, /invokeHomeAssistantService/);
  assert.match(source, /double_tap_service_target/);
  assert.match(source, /"double_tap_action",\s*doubleTapAction/);
});

test("person defaults to the family card proportions and keeps compact mode explicit", () => {
  const source = read("nodalia-person-card.js");
  assert.match(source, /getCardSize\(\) \{\s*return 3;/);
  assert.match(source, /getGridOptions\(\) \{[\s\S]*min_rows: 2/);
  assert.match(source, /const singleRowLayout = Number\.isFinite\(configuredRows\) && configuredRows <= 1;/);
  assert.match(source, /avatar:\s*\{\s*size: "38px",\s*background: "rgba\(255, 255, 255, 0\.06\)"/);
  assert.match(source, /title_size: "12px",\s*subtitle_size: "9px"/);
});

test("fav active state tints both the card surface and icon bubble", () => {
  const source = read("nodalia-fav-card.js");
  assert.match(source, /const cardBackground = isActive[\s\S]*linear-gradient/);
  assert.match(source, /\.fav-card__icon \{[\s\S]*background: \$\{isActive[\s\S]*radial-gradient/);
  assert.match(source, /class="fav-card \$\{isActive \? "is-on" : "is-off"\}/);
});

test("scenes supports a dedicated single-scene surface and visual-editor option", () => {
  const source = read("nodalia-scenes-card.js");
  const labels = JSON.parse(read("i18n/editor/en.json"));
  assert.match(source, /\["grid", "list", "single"\]\.includes\(layout\)/);
  assert.match(source, /layout: "single",\s*scenes: \[\{ entity: selectedEntityId \}\]/);
  assert.match(source, /scenes-card--single/);
  assert.match(source, /const renderedEntries = isSingle \? entries\.slice\(0, 1\) : entries;/);
  assert.equal(labels["ed.scenes.layout_single"], "Single scene");
});

test("i18n person home aliases translate with active language", () => {
  const i18n = loadI18nRuntime({ localStorageSelectedLanguage: "en" });
  const state = { entity_id: "person.example", state: "en_casa", attributes: {} };
  assert.equal(
    i18n.translateEntityState("en", state, 2, (v, u, d) => `${v}${u}`, (v) => String(v), () => null),
    "Home",
  );
  assert.equal(
    i18n.translateEntityState("es", { ...state, state: "casa" }, 2, (v, u, d) => `${v}${u}`, (v) => String(v), () => null),
    "En casa",
  );
  assert.equal(
    i18n.translateEntityState("en", { ...state, state: "home" }, 2, (v, u, d) => `${v}${u}`, (v) => String(v), () => null),
    "Home",
  );
});

test("i18n automatic language prefers document lang over stale hass.language inside HA", () => {
  const i18n = loadI18nRuntime({
    rootHass: { language: "es", states: {} },
    docLang: "en",
    navigatorLanguage: "es-ES",
  });

  assert.equal(i18n.resolveLanguage({ language: "es" }, "auto"), "en");
});

test("NodaliaUtils coerces Lovelace tap_action objects to card action strings", () => {
  const sandbox = { window: null };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  loadNodaliaUtils(sandbox);
  const { coerceCardTapAction, applyCardTapActionField } = sandbox.window.NodaliaUtils;

  assert.equal(coerceCardTapAction({ action: "toggle" }), "toggle");
  assert.equal(coerceCardTapAction({ action: "more-info" }), "more-info");
  assert.equal(coerceCardTapAction({ perform_action: "homeassistant.toggle" }), "toggle");
  assert.equal(coerceCardTapAction("[object Object]", "auto"), "auto");

  const config = {};
  applyCardTapActionField(config, {
    actionKey: "tap_action",
    serviceKey: "tap_service",
    serviceDataKey: "tap_service_data",
    serviceTargetKey: "tap_service_target",
  }, {
    action: "perform-action",
    perform_action: "lock.unlock",
    data: { code: "1234" },
    target: { entity_id: "lock.front_door" },
  }, "auto");
  assert.equal(config.tap_action, "service");
  assert.equal(config.tap_service, "lock.unlock");
  assert.equal(config.tap_service_data, JSON.stringify({ code: "1234" }));
  assert.equal(config.tap_service_target, JSON.stringify({ entity_id: "lock.front_door" }));
});

test("NodaliaUtils rejects CSS and markup injection in style values", () => {
  const sandbox = { window: null };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  loadNodaliaUtils(sandbox);
  const { sanitizeCssValue, sanitizeStyleTree, renderCardEmptyStateDocument } = sandbox.window.NodaliaUtils;

  assert.equal(sanitizeCssValue("28px", "12px"), "28px");
  assert.equal(sanitizeCssValue("red;} </style><img src=x>", "var(--primary-color)"), "var(--primary-color)");
  const safe = sanitizeStyleTree({ card: { padding: "12px; color:red", opacity: "not-a-number" } }, {
    card: { padding: "16px", opacity: 0.5 },
  });
  assert.equal(safe.card.padding, "16px");
  assert.equal(safe.card.opacity, 0.5);

  const document = renderCardEmptyStateDocument("<div class=\"test--empty\">Empty</div>", {
    card: { background: "red;} </style><script>alert(1)</script>" },
  });
  assert.doesNotMatch(document, /<script>/);
  assert.match(document, /background: var\(--ha-card-background\)/);
});

test("light, fan, and humidifier normalize native Lovelace service action objects", () => {
  const cards = [
    ["nodalia-light-card.js", "NodaliaLightCard"],
    ["nodalia-fan-card.js", "NodaliaFanCard"],
    ["nodalia-humidifier-card.js", "NodaliaHumidifierCard"],
  ];
  cards.forEach(([file, className]) => {
    const normalizeConfig = loadCardNormalizeConfig(file, className);
    const config = normalizeConfig({
      entity: "switch.example",
      tap_action: {
        action: "perform-action",
        perform_action: "switch.turn_on",
        data: { transition: 2 },
        target: { entity_id: "switch.target" },
      },
    });
    assert.equal(config.tap_action, "service", file);
    assert.equal(config.tap_service, "switch.turn_on", file);
    assert.equal(config.tap_service_data, JSON.stringify({ transition: 2 }), file);
    assert.equal(config.tap_service_target, JSON.stringify({ entity_id: "switch.target" }), file);
  });
});

test("graph card refreshes history and restores host listeners after reconnect", () => {
  const source = read("nodalia-graph-card.js");
  assert.match(source, /const HISTORY_REFRESH_INTERVAL = 180000/);
  assert.match(source, /_scheduleHistoryRefresh\(\)/);
  assert.match(source, /this\._requestHistory\(\);[\s\S]*this\._scheduleHistoryRefresh\(\)/);
  const connectedStart = source.indexOf("  connectedCallback() {");
  const connectedEnd = source.indexOf("\n  _attachViewVisibilityObserver()", connectedStart);
  const connected = source.slice(connectedStart, connectedEnd);
  assert.match(connected, /this\.addEventListener\("pointerleave"/);
  assert.match(connected, /this\._hoverMediaQuery\.addEventListener\("change"/);
});

test("advanced vacuum calibration signature includes direct point values", () => {
  const source = read("nodalia-advance-vacuum-card.js");
  assert.match(source, /fingerprint: JSON\.stringify\(directPoints\)/);
  assert.match(source, /this\._calibrationSignatureStamp = "";[\s\S]*this\._syncCalibrationIfNeeded\(\)/);
  assert.match(source, /Promise\.resolve\(\)\.then\(\(\) => this\._callRoomCleaningService/);
});

test("i18n automatic language prefers localStorage selectedLanguage over stale hass.language", () => {
  const i18n = loadI18nRuntime({
    rootHass: { language: "es" },
    localStorageSelectedLanguage: "en",
  });

  assert.equal(i18n.resolveLanguage(null, "auto"), "en");
  assert.equal(i18n.resolveLanguage({ language: "es" }, "auto"), "en");
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
  card._commitAborted = false;
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

  const buildIndividualPopupCard = () => {
    const card = new PowerFlowCard();
    card._config = {
      show_home_device_popup: true,
      entities: {
        home: { entity: "sensor.home", color: "#ffffff" },
        grid: { entity: "sensor.grid", color: "#6da8ff", export_color: "#44d07b" },
        solar: { entity: "sensor.solar", color: "#f6b73c" },
        battery: { entity: "sensor.battery", color: "#61c97a" },
        water: {},
        gas: {},
        individual: [{ entity: "sensor.plug", name: "Plug", icon: "mdi:power-plug", color: "#f29f05" }],
      },
      display_zero_lines: { mode: "hide", transparency: 50, grey_color: [189, 189, 189] },
      show_secondary_info: true,
      show_values: true,
      show_labels: true,
    };
    card._hass = {
      states: {
        "sensor.home": { state: "500", attributes: { unit_of_measurement: "W", friendly_name: "Home" } },
        "sensor.grid": { state: "200", attributes: { unit_of_measurement: "W", friendly_name: "Grid" } },
        "sensor.solar": { state: "300", attributes: { unit_of_measurement: "W", friendly_name: "Solar" } },
        "sensor.battery": { state: "-50", attributes: { unit_of_measurement: "W", friendly_name: "Battery" } },
        "sensor.plug": { state: "100", attributes: { unit_of_measurement: "W", friendly_name: "Plug" } },
      },
    };
    return card;
  };

  const popupCard = buildIndividualPopupCard();
  const popupNodes = popupCard._getNodes();
  assert.equal(popupNodes.individual.length, 0, "individual devices stay off the main diagram when home popup is enabled");
  assert.equal(popupNodes._layoutPreset, "compact");
  assert.equal(popupNodes.grid.entityId, "sensor.grid");
  assert.equal(popupNodes.solar.entityId, "sensor.solar");
  assert.equal(popupNodes.battery.entityId, "sensor.battery");
  assert.equal(popupCard._shouldUseHomeDevicePopup(), true);
  assert.equal(popupCard._shouldShowIndividualsOnDiagram(), false);
  assert.equal(popupCard._shouldRenderDiagramNode("grid", popupNodes.grid), true);
  assert.equal(popupCard._shouldRenderDiagramNode("solar", popupNodes.solar), true);
  assert.equal(popupCard._shouldRenderDiagramNode("battery", popupNodes.battery), true);
  assert.ok(popupCard._buildLines(popupNodes).some(line => line.id === "grid" || line.id === "solar" || line.id === "battery"));

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

test("scenes card scene buttons avoid focus-driven dashboard scroll jumps", () => {
  const source = read("nodalia-scenes-card.js");
  assert.match(source, /this\.shadowRoot\.addEventListener\("pointerdown", this\._onShadowPointerDown, true\)/);
  assert.match(source, /this\.shadowRoot\.addEventListener\("mousedown", this\._onShadowMouseDown, true\)/);
  assert.match(source, /this\.shadowRoot\.addEventListener\("touchstart", this\._onShadowTouchStart, \{ passive: false, capture: true \}\)/);
  assert.match(source, /role="button"/);
  assert.match(source, /tabindex="-1"/);
  assert.match(source, /_triggerLaunchAnimation/);
  assert.match(source, /collectDashboardScrollSnapshot/);
  assert.match(source, /scheduleDashboardScrollRestore/);
  assert.match(source, /overflow-anchor: none/);
  assert.match(source, /scenes-card__tile--launching/);
  assert.match(source, /scenes-card__tile-burst/);
  assert.match(source, /scenes-card__tile-icon--launching/);
  assert.doesNotMatch(source, /show_active/);
  assert.doesNotMatch(source, /_syncActiveSceneUi/);
});

test("light card flushes optimistic turn-on queue before timeout clear", () => {
  const source = read("nodalia-light-card.js");
  assert.match(
    source,
    /this\._optimisticTurnOnTimer = window\.setTimeout\(\(\) => \{[\s\S]*this\._flushOptimisticTurnOnQueue\(\);[\s\S]*this\._clearOptimisticTurnOnState\(\{ clearDrafts: true \}\)/,
  );
});

test("light card allows confirmation render when optimistic toggle clears with unchanged signature", () => {
  const source = read("nodalia-light-card.js");
  assert.match(source, /const hadPendingOptimistic = hasPendingOptimistic/);
  assert.match(source, /const optimisticJustConfirmed = hadPendingOptimistic/);
  assert.match(source, /&& !optimisticJustConfirmed/);
});

test("calendar native composer validates configured calendars and defaults webhooks to admin-only", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /allow_webhooks_for_non_admin: false/);
  assert.match(source, /allowedCalendarIds\.includes\(calendarId\)/);
  assert.match(source, /allowed_calendar_ids: allowedCalendarIds/);
  assert.match(source, /if \(configuredIds\.length\) \{[\s\S]*document\.createElement\("select"\)/);
});

test("power flow card supports home device popup and consumption chips", () => {
  const source = read("nodalia-power-flow-card.js");
  assert.match(source, /consumption_chips:/);
  assert.match(source, /_renderHomeDevicePopup/);
  assert.match(source, /_getNodeInteractionAction/);
  assert.match(source, /home-popup/);
  assert.match(source, /power-flow-card__home-popup-list/);
  assert.match(source, /power-flow-card__home-popup-node/);
  assert.match(source, /power-flow-card__home-popup-body/);
  assert.match(source, /position:\s*fixed/);
  assert.match(source, /transform:\s*translate\(-50%, -50%\)/);
  assert.match(source, /max-height:\s*min\(88vh/);
  assert.match(source, /getDiagramIndividualCount/);
  assert.match(source, /showIndividualsOnDiagram/);
  assert.match(source, /editor-actions/);
  assert.match(source, /_renderConsumptionChips/);
  assert.match(source, /customElements\.get\("ha-selector"\)/);
  assert.match(source, /_renderIndividualEditorCard/);
  assert.match(source, /data-action="add-individual"/);
});

test("power flow visual editor individual actions keep energy branch entities", () => {
  const source = read("nodalia-power-flow-card.js");
  const editorStart = source.indexOf("class NodaliaPowerFlowCardVisualEditor");
  assert.ok(editorStart >= 0, "visual editor class should exist");
  const clickStart = source.indexOf("_onShadowClick(event)", editorStart);
  assert.ok(clickStart > editorStart, "visual editor click handler should exist");
  const clickBlock = source.slice(clickStart, clickStart + 2200);
  assert.match(clickBlock, /if \(!isObject\(this\._config\.entities\)\)/);
  assert.doesNotMatch(clickBlock, /if \(!Array\.isArray\(this\._config\.entities\)\)/);
});

test("power flow editor catalog includes consumption chip translations", () => {
  const en = JSON.parse(read("i18n/editor/en.json"));
  assert.ok(en["ed.power_flow.consumption_chips_title"]);
  assert.ok(en["ed.power_flow.add_individual"]);
  const editorUi = read("nodalia-editor-ui.js");
  assert.match(editorUi, /ed\.power_flow\.consumption_chips_title/);
});

test("alarm panel requires manual PIN when code input is visible", () => {
  const source = read("nodalia-alarm-panel-card.js");
  assert.match(source, /const manualPin = String\(this\._codeInput \|\| ""\)\.trim\(\);/);
  assert.match(source, /if \(requiresManualPin && !manualPin\) \{[\s\S]*return;/);
  assert.match(source, /const code = requiresManualPin \? manualPin : this\._getCodeValue\(state\);/);
  assert.match(source, /if \(manualPin\) \{[\s\S]*return manualPin;[\s\S]*\}[\s\S]*const helperEntityId/);
  assert.match(source, /invokeHomeAssistantService/);
});

test("entity card preserves Lovelace action data and target for configured services", () => {
  const utilsSource = read("nodalia-utils.js");
  assert.match(utilsSource, /rawValue\.data \?\? rawValue\.service_data/);
  assert.match(utilsSource, /rawValue\.target/);
  assert.match(utilsSource, /serviceTargetKey/);

  const entitySource = read("nodalia-entity-card.js");
  assert.match(entitySource, /tap_service_target/);
  assert.match(entitySource, /hasExplicitTarget/);
  assert.match(entitySource, /invoke\(this, this\._hass, domain, service, payload, hasExplicitTarget \? target : null\)/);
});

test("cover card respects navigate and service tap actions from Lovelace objects", () => {
  const source = read("nodalia-cover-card.js");
  assert.match(source, /navigationKey: "navigation_path"/);
  assert.match(source, /"navigate"/);
  assert.match(source, /if \(action === "navigate"\)/);
  assert.match(source, /serviceTargetKey/);
  assert.match(source, /hasExplicitTarget/);
});

test("media player avoids restarting progress ticker while disconnected", () => {
  const source = read("nodalia-media-player.js");
  assert.match(source, /set hass\(hass\) \{[\s\S]*if \(!this\.isConnected\) \{[\s\S]*return;/);
  assert.match(source, /_syncTicker\(players\) \{[\s\S]*if \(!this\.isConnected\) \{[\s\S]*clearInterval\(this\._mediaTicker\)/);
});

test("cover card pointer controls avoid focus-driven dashboard scroll jumps", () => {
  const source = read("nodalia-cover-card.js");
  assert.match(source, /_isCardTapAction\(action\) \{\s*return action === "body" \|\| action === "icon";\s*\}/);
  assert.match(
    source,
    /const coverAction = button\.dataset\.coverAction;\s*if \(this\._isCardTapAction\(coverAction\)\) \{[\s\S]*this\._runAction\(coverAction\);[\s\S]*return;\s*\}\s*this\._triggerHaptic\(\)/,
  );
  assert.match(
    source,
    /_onPointerDown\(event\) \{[\s\S]*node\.type === "range"[\s\S]*node\.dataset\?\.coverControl[\s\S]*this\._startSliderDrag\(slider, event\.clientX, event, event\.pointerId\)/,
  );
  assert.match(source, /case "toggle_controls_view":[\s\S]*_syncCoverControlsViewDom\(\)/);
  assert.doesNotMatch(source, /case "toggle_controls_view":[\s\S]{0,280}this\._render\(\)/);
  assert.doesNotMatch(source, /_toggleCoverControlsView/);
  assert.match(source, /this\.shadowRoot\.addEventListener\("pointerdown", this\._onPointerDown\)/);
  assert.match(source, /this\.shadowRoot\.addEventListener\("mousedown", this\._onMouseDown\)/);
  assert.match(source, /this\.shadowRoot\.addEventListener\("touchstart", this\._onTouchStart, \{ passive: false \}\)/);
  assert.doesNotMatch(source, /addEventListener\("focusin"/);
  assert.doesNotMatch(source, /_preventCoverPointerFocus/);
  assert.doesNotMatch(source, /button\.blur\(\)/);
  assert.match(source, /overflow-anchor: none/);
  assert.match(source, /touch-action: manipulation/);
  assert.match(
    source,
    /_onPointerDown\(event\) \{[\s\S]*node\.type === "range"[\s\S]*this\._startSliderDrag\(slider, event\.clientX, event, event\.pointerId\);[\s\S]*\}/,
  );
  assert.match(
    source,
    /if \(!\(typeof window !== "undefined" && "PointerEvent" in window\)\) \{[\s\S]*this\.shadowRoot\.addEventListener\("touchstart", this\._onTouchStart, \{ passive: false \}\)/,
  );
  assert.match(
    source,
    /if \(!\(typeof window !== "undefined" && "PointerEvent" in window\)\) \{[\s\S]*window\.addEventListener\("touchstart", this\._onWindowTouchStartCapture, \{ passive: true, capture: true \}\)/,
  );
  assert.doesNotMatch(source, /_captureCoverInteractionScrollSnapshot/);
  assert.doesNotMatch(source, /_rememberCoverInteractionScroll/);
  assert.doesNotMatch(source, /_scheduleCoverInteractionScrollRestore/);
  assert.match(source, /_startSliderDrag\(slider, event\.clientX, event, event\.pointerId\)/);
  assert.match(source, /this\._pendingRenderAfterDrag = true/);
  assert.doesNotMatch(source, /tabindex="-1"/);
  assert.match(source, /opacity: 0;[\s\S]*outline: none;[\s\S]*touch-action: pan-y;/);
});

test("fan humidifier and entity cards use light-style optimistic toggle state", () => {
  const files = [
    "nodalia-fan-card.js",
    "nodalia-humidifier-card.js",
    "nodalia-entity-card.js",
  ];

  files.forEach(file => {
    const source = read(file);
    assert.match(source, /const OPTIMISTIC_TOGGLE_TIMEOUT = 3200;/);
    assert.match(source, /this\._optimisticToggle = null;/);
    assert.match(source, /this\._optimisticToggleTimer = 0;/);
    assert.match(source, /_getActualState\(hass = this\._hass\)/);
    assert.match(source, /_buildOptimisticToggleState\(actualState = this\._getActualState\(\)\)/);
    assert.match(source, /_syncOptimisticToggleState/);
    assert.match(source, /_nodalia_optimistic_toggle/);
    assert.match(source, /_scheduleOptimisticToggleTimeout\(\)/);
  });

  assert.match(read("nodalia-fan-card.js"), /_syncOptimisticToggleState\(actualState\)/);
  assert.match(read("nodalia-humidifier-card.js"), /_syncOptimisticToggleState\(actualState\)/);

  assert.match(read("nodalia-fan-card.js"), /this\._startOptimisticToggle\(turnOff \? "off" : "on", actualState\)/);
  assert.match(read("nodalia-humidifier-card.js"), /this\._startOptimisticToggle\(turnOff \? "off" : "on", actualState\)/);

  for (const file of ["nodalia-fan-card.js", "nodalia-humidifier-card.js"]) {
    const source = read(file);
    assert.match(
      source,
      /const attrs = turningOn\s*\?\s*\{ \.\.\.\(actualState\?\.attributes \|\| \{\}\), \.\.\.\(snapshot\.attributes \|\| \{\}\) \}/,
    );
  }
  assert.match(read("nodalia-entity-card.js"), /const isPrimaryEntity = entityId && entityId === this\._config\?\.entity;/);
});

test("fan and humidifier cards use optimistic visual settle and slider fill during power-on", () => {
  for (const file of ["nodalia-fan-card.js", "nodalia-humidifier-card.js"]) {
    const source = read(file);
    assert.match(source, /OPTIMISTIC_VISUAL_SETTLE_MS/);
    assert.match(source, /_optimisticVisualSettleTimer = 0/);
    assert.match(source, /_syncOptimisticVisualSettle/);
    assert.match(source, /_scheduleOptimisticVisualSettleTimeout/);
    assert.match(source, /_clearOptimisticVisualSettle/);
    assert.match(source, /visualSettleChanged/);
    assert.match(source, /_lastKnownOnState = new Map\(\)/);
    assert.match(source, /_shouldUseOptimisticVisualSettle/);
    assert.match(source, /_startOptimisticVisualSettle/);
    assert.match(source, /powerAnimationState === "powering-up"/);
    assert.match(source, /const fillElapsed = now - Number\(this\._powerTransition\.startedAt\)/);
    assert.match(source, /percentageFillDelay = -clamp\(fillElapsed|humidityFillDelay = -clamp\(fillElapsed/);
    assert.doesNotMatch(source, /FillDelayBase/);
  }
});

test("fan and humidifier skip redundant renders during active power transitions", () => {
  for (const file of ["nodalia-fan-card.js", "nodalia-humidifier-card.js"]) {
    const source = read(file);
    assert.match(source, /_isTransitionAnimationActive/);
    assert.match(source, /_shouldSkipRenderForUnchangedSignature/);
    assert.match(source, /this\._optimisticToggle && this\._isTransitionAnimationActive\(\)/);
  }
});

test("device cards skip redundant set hass work when render signature is unchanged", () => {
  for (const file of ["nodalia-fan-card.js", "nodalia-humidifier-card.js", "nodalia-light-card.js"]) {
    const source = read(file);
    assert.match(
      source,
      /let nextSignature = this\._getRenderSignature\(\);[\s\S]*!this\._optimisticToggle|!hasPendingOptimistic/,
    );
    assert.match(source, /nextSignature = this\._getRenderSignature\(\);/);
  }

  const entity = read("nodalia-entity-card.js");
  assert.match(
    entity,
    /let nextSignature = this\._getRenderSignature\(\);[\s\S]*!this\._optimisticToggle/,
  );
});

test("resize observers skip full render when signature is unchanged", () => {
  for (const file of ["nodalia-fan-card.js", "nodalia-humidifier-card.js", "nodalia-light-card.js", "nodalia-entity-card.js"]) {
    const source = read(file);
    assert.match(source, /const signature = this\._getRenderSignature\(\);/);
    assert.match(source, /if \(signature === this\._lastRenderSignature\) \{\s*return;\s*\}/);
  }
});

test("fan and humidifier slider empty animation stays in sync while controls leave", () => {
  for (const file of ["nodalia-fan-card.js", "nodalia-humidifier-card.js"]) {
    const source = read(file);
    assert.match(source, /controlsAnimationState === "leaving"/);
    assert.match(source, /EmptyDuration = shouldAnimate.*Empty/);
    assert.match(source, /EmptyDelay = -clamp\(now - Number\(this\._controlsTransition\.startedAt\)/);
    assert.match(source, /@keyframes (fan-card-percentage-empty|humidifier-card-humidity-empty)/);
    assert.match(source, /transform: scaleX\(calc\(var\(--(percentage|humidity)-target/);
    assert.match(source, /var\(--(fan|humidifier)-card-(percentage|humidity)-empty-delay/);
  }
});

test("fan humidifier and cover slider action shadows are not clipped while open", () => {
  const expectations = [
    {
      file: "nodalia-fan-card.js",
      shell: "fan-card__controls-shell",
      leaving: "fan-card__controls-shell--leaving",
      row: "fan-card__slider-row",
      actions: "fan-card__slider-actions",
    },
    {
      file: "nodalia-humidifier-card.js",
      shell: "humidifier-card__controls-shell",
      leaving: "humidifier-card__controls-shell--leaving",
      row: "humidifier-card__slider-row",
      actions: "humidifier-card__slider-actions",
    },
    {
      file: "nodalia-cover-card.js",
      shell: "fan-card__controls-shell",
      leaving: null,
      row: "fan-card__slider-row",
      actions: "fan-card__slider-actions",
    },
  ];
  for (const item of expectations) {
    const source = read(item.file);
    assert.match(source, new RegExp(`\\.${item.shell} \\{[\\s\\S]*overflow: visible;`));
    if (item.leaving) {
      assert.match(source, new RegExp(`\\.${item.leaving} \\{[\\s\\S]*overflow: hidden;`));
    }
    assert.match(source, new RegExp(`\\.${item.row} \\{[\\s\\S]*overflow: visible;`));
    assert.match(source, new RegExp(`\\.${item.actions} \\{[\\s\\S]*padding-block: 10px;`));
  }
});

test("fan and humidifier animations keep progress across fast state confirmations", () => {
  const fan = read("nodalia-fan-card.js");
  const humidifier = read("nodalia-humidifier-card.js");

  for (const source of [fan, humidifier]) {
    assert.match(source, /startedAt: now/);
    assert.match(source, /const controlsAnimationDelay = controlsAnimationState && this\._controlsTransition/);
    assert.match(source, /-clamp\(now - Number\(this\._controlsTransition\.startedAt \|\| now\)/);
  }

  assert.match(fan, /--fan-card-controls-delay: \$\{controlsAnimationDelay\}ms;/);
  assert.match(fan, /var\(--fan-card-controls-delay, 0ms\) both/);
  assert.match(humidifier, /--humidifier-card-controls-delay: \$\{controlsAnimationDelay\}ms;/);
  assert.match(humidifier, /var\(--humidifier-card-controls-delay, 0ms\) both/);
});

test("cover card enforces six-column minimum and reserves toggle lane on narrow grids", () => {
  const source = read("nodalia-cover-card.js");
  assert.match(source, /min_columns: 6/);
  assert.match(source, /COVER_CONTROLS_TOGGLE_LANE_MAX_COLUMNS = 6/);
  assert.match(source, /_shouldReserveCoverToggleLane\(/);
  assert.match(source, /fan-card--cover-ui-toggle-lane/);
  assert.match(source, /@container cover-card \(max-width:/);
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

test("climate schedule save posts webhook without requiring live climate state", () => {
  const source = read("nodalia-climate-card.js");
  assert.match(source, /climateAction === "schedule-save"[\s\S]*void this\._submitScheduleComposer\(\)/);
  assert.match(source, /climateAction === "schedule-save"[\s\S]*return;/);
  assert.doesNotMatch(
    source,
    /climateAction === "schedule-save"[\s\S]{0,120}const state = this\._getState\(\)/,
  );
  assert.match(source, /_flushScheduleComposerFocusedField\(\)/);
  assert.match(source, /domPatchById\.get\(slot\.id\)/);
  assert.match(source, /window\.NodaliaUtils\.postHomeAssistantWebhook/);
});

test("climate card defaults webhook access to admin-only", () => {
  const source = read("nodalia-climate-card.js");
  assert.match(source, /allow_webhooks_for_non_admin: false/);
  assert.match(source, /allow_webhooks_for_non_admin === true/);
  assert.match(source, /isUnsafeConfigPathKey/);
});

test("advance vacuum card defaults shared session webhook access to admin-only", () => {
  const source = read("nodalia-advance-vacuum-card.js");
  assert.match(source, /allow_webhooks_for_non_admin: false/);
  assert.match(source, /_postSharedCleaningSessionWebhook/);
  assert.match(source, /webhook blocked for non-admin user/);
  assert.match(source, /async _runMapAction\(\)[\s\S]*if \(!this\.isConnected\) \{\s*return;\s*\}/);
  assert.match(source, /strict_service_actions === true/);
});

test("NodaliaUtils schedules and clears deferred timers on disconnect", () => {
  const utils = read("nodalia-utils.js");
  assert.match(utils, /function scheduleDeferTimer\(/);
  assert.match(utils, /function clearDeferTimers\(/);
  assert.match(read("nodalia-fan-card.js"), /NodaliaUtils\?\.scheduleDeferTimer/);
  assert.match(read("nodalia-fan-card.js"), /NodaliaUtils\?\.clearDeferTimers\?\.\(this\)/);
});

test("card hold gestures reconnect after dashboard view reattachment", () => {
  const files = [
    "nodalia-light-card.js",
    "nodalia-fan-card.js",
    "nodalia-humidifier-card.js",
    "nodalia-cover-card.js",
    "nodalia-vacuum-card.js",
    "nodalia-scenes-card.js",
    "nodalia-entity-card.js",
  ];
  files.forEach(file => {
    const source = read(file);
    const connectedStart = source.indexOf("  connectedCallback() {");
    const disconnectedStart = source.indexOf("  disconnectedCallback() {", connectedStart);
    assert.ok(connectedStart >= 0 && disconnectedStart > connectedStart, `${file} should expose lifecycle callbacks`);
    assert.match(
      source.slice(connectedStart, disconnectedStart),
      /this\._detachHostHold\?\.reconnect\?\.\(\)/,
      `${file} should restore its host hold binding on reconnect`,
    );
  });
});

test("scenes card empty state uses unified render signature", () => {
  const source = read("nodalia-scenes-card.js");
  assert.doesNotMatch(source, /_lastRenderSignature = `empty:\$\{JSON\.stringify/);
  assert.match(source, /const sceneStamp = /);
  assert.match(source, /if \(!entries\.length\) \{\s*this\.shadowRoot\.innerHTML = this\._renderEmptyState\(\)/);
});

test("power flow applies per-node bubble icon contrast", () => {
  const source = read("nodalia-power-flow-card.js");
  assert.match(source, /_getNodeIconGlyphColor\(node\)/);
  assert.match(source, /--node-icon-glyph:/);
  assert.match(source, /shouldDarkenBubbleIconGlyph/);
});

test("notifications async refresh guards disconnected lifecycle in finally", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(source, /_calendarRefreshInFlight = false;[\s\S]*if \(!this\.isConnected\) \{\s*return;\s*\}[\s\S]*_renderIfChanged\(true\)/);
  assert.match(source, /_weatherRefreshInFlight = false;[\s\S]*if \(!this\.isConnected\) \{\s*return;\s*\}[\s\S]*_renderIfChanged\(true\)/);
});

test("climate schedule composer keeps agenda scroll position across re-renders", () => {
  const source = read("nodalia-climate-card.js");
  assert.match(source, /_captureScheduleAgendaScrollState\(\)/);
  assert.match(source, /_restoreScheduleAgendaScrollState\(savedScheduleAgendaScrollTop\)/);
  assert.match(source, /_syncRenderSignature\(\)/);
  assert.match(source, /this\._patchScheduleBlockDom\(slotId\);[\s\S]*this\._syncRenderSignature\(\)/);
});

test("visual editors avoid empty scroll past form in Lovelace dialog", () => {
  const utils = read("nodalia-utils.js");
  assert.match(utils, /function bindEditorDialogLayoutFix\(/);
  assert.match(utils, /function clampEditorDialogScroll\(/);
  assert.match(utils, /"bindEditorDialogLayoutFix"/);
  assert.match(utils, /"releaseEditorDialogLayoutFix"/);
  assert.match(utils, /"clampEditorDialogScroll"/);
  assert.match(utils, /element-editor/);
  assert.match(utils, /function getComposedParentElement\(/);
  assert.match(utils, /root instanceof ShadowRoot \? root\.host : null/);
  assert.match(utils, /function findParentNodaliaEditorHost\(/);
  assert.match(utils, /tagName\.startsWith\("nodalia-"\) && tagName\.endsWith\("-editor"\)/);
  assert.match(utils, /if \(findParentNodaliaEditorHost\(editorHost\)\) \{\s*releaseEditorDialogLayoutFix\(editorHost\);\s*return;/);
  assert.match(utils, /\|\| findParentNodaliaEditorHost\(editorHost\)/);
  assert.match(utils, /function getEditorDialogScrollAncestors\(/);
  assert.match(utils, /function getEditorDialogPreviewPanes\(/);
  assert.match(utils, /marker\.includes\("preview"\)/);
  assert.match(utils, /alignSelf = "flex-start"/);
  assert.match(utils, /minHeight = "0"/);
  assert.match(utils, /node\.style\.overscrollBehaviorY = "contain"/);
  assert.match(utils, /node\.style\.overflowY = "auto"/);
  assert.match(utils, /function canPreviewPaneScroll\(/);
  assert.match(utils, /canPreviewPaneScroll\(node, deltaY\)/);
  assert.match(utils, /event\.stopPropagation\(\)/);
  assert.match(utils, /node\.addEventListener\("wheel", onPreviewWheel, \{ passive: false \}\)/);
  assert.match(utils, /EDITOR_DIALOG_EMPTY_GAP_CLAMP_PX = 96/);
  assert.match(utils, /const contentRect = editorContent instanceof HTMLElement/);
  assert.match(utils, /const emptyBottomGap = scrollportRect\.bottom - contentRect\.bottom/);
  assert.match(utils, /emptyBottomGap > EDITOR_DIALOG_EMPTY_GAP_CLAMP_PX/);
  assert.match(utils, /Math\.ceil\(emptyBottomGap - EDITOR_DIALOG_EMPTY_GAP_CLAMP_PX\)/);
  assert.match(utils, /getEditorDialogPreviewPanes\(editorHost\)\.forEach\(node =>/);
  assert.match(utils, /window\.addEventListener\("scroll", onScroll, true\)/);
  assert.match(utils, /scrollAncestors\.forEach\(node => node\.addEventListener\("scroll", onScroll/);
  assert.match(utils, /runEditorDialogScrollClamp\(editorHost\)/);
  assert.match(utils, /window\.removeEventListener\("scroll", onScroll, true\)/);
  assert.match(utils, /scrollAncestors\.forEach\(node => node\.removeEventListener\("scroll", onScroll\)\)/);
  assert.match(utils, /previewPanes\.forEach\(node => node\.removeEventListener\("wheel", onPreviewWheel\)\)/);
  assert.doesNotMatch(utils, /editorHost\.style\.height = `\$\{Math\.ceil\(editorContent\.getBoundingClientRect\(\)\.height\)\}px`/);
  assert.doesNotMatch(utils, /editorHost\.style\.overflow = "hidden"/);
  for (const card of ["nodalia-news-card.js", "nodalia-entity-card.js", "nodalia-scenes-card.js", "nodalia-notifications-card.js", "nodalia-alarm-panel-card.js"]) {
    const source = read(card);
    assert.match(source, /bindEditorDialogLayoutFix\?\.\(this\)/);
    assert.match(source, /releaseEditorDialogLayoutFix\?\.\(this\)/);
    assert.match(source, /clampEditorDialogScroll\?\.\(this\)/);
  }
  const notifications = read("nodalia-notifications-card.js");
  assert.match(notifications, /overflow-anchor: none/);
  assert.match(notifications, /\.editor-section:last-child\s*\{[\s\S]*margin-bottom: 0/);
});

test("slider bubble chrome does not trigger card body tap", () => {
  const utils = read("nodalia-utils.js");
  assert.match(utils, /function isNodaliaSliderChromeHit\(/);
  assert.match(utils, /nodaliaTapShield/);
  assert.match(utils, /__controls-shell/);
  for (const card of ["nodalia-light-card.js", "nodalia-fan-card.js", "nodalia-humidifier-card.js", "nodalia-cover-card.js"]) {
    const source = read(card);
    assert.match(source, /isNodaliaSliderChromeHit\?\.\(event\)/);
    assert.match(source, /data-nodalia-tap-shield="true"/);
    assert.match(source, /<ha-card[\s\S]{0,320}data-(?:light|fan|humidifier|cover)-action="body"/);
    assert.doesNotMatch(source, /__hero" data-(?:light|fan|humidifier|cover)-action="body"/);
    assert.match(
      source,
      /(?:body|icon)[\s\S]{0,220}isNodaliaSliderChromeHit\?\.\(event\)/,
      `${card} should ignore slider chrome only for body/icon taps`,
    );
  }
});

test("fav card matches entity cover lock toggle and tap action parsing", () => {
  const source = read("nodalia-fav-card.js");
  assert.match(source, /applyCardTapActionField/);
  assert.match(source, /_toggleCoverEntity\(/);
  assert.match(source, /_toggleLockEntity\(/);
  assert.match(source, /_usesDomainToggleService\(state\)/);
  assert.match(source, /stateKey === "locked"[\s\S]*lock", "unlock", entityId/);
  assert.match(source, /invokeHomeAssistantService/);
  assert.match(source, /_isBinaryOnOff\(state\) \|\| this\._usesDomainToggleService\(state\)/);
  assert.doesNotMatch(source, /disarm: "Disarm"/);
});

test("cover card coerces Lovelace tap_action objects in normalizeConfig", () => {
  const source = read("nodalia-cover-card.js");
  assert.match(source, /applyCardTapActionField/);
});

test("graph card patches hover tooltip without full innerHTML rebuild", () => {
  const source = read("nodalia-graph-card.js");
  assert.match(source, /_syncTooltipContent\(/);
  assert.doesNotMatch(source, /_patchHoverOverlay\(\) \{[\s\S]*tooltip\.innerHTML =/);
});

test("calendar card re-renders on hass updates when render signature changes", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /set hass\(hass\) \{[\s\S]*this\._renderIfChanged\(false\)/);
});

test("entity card configured services use invokeHomeAssistantService", () => {
  const source = read("nodalia-entity-card.js");
  assert.match(source, /_callConfiguredService[\s\S]*invokeHomeAssistantService/);
});

test("entity card toggle uses domain services for cover and lock entities", () => {
  const source = read("nodalia-entity-card.js");
  assert.match(source, /_toggleCoverEntity\(/);
  assert.match(source, /_toggleLockEntity\(/);
  assert.match(source, /cover", "open_cover"/);
  assert.match(source, /cover", "close_cover"/);
  assert.match(source, /set_cover_position", entityId, \{ position: 100 \}/);
  assert.match(source, /stateKey === "locked"[\s\S]*lock", "unlock", entityId/);
  assert.doesNotMatch(
    source,
    /if \(stateKey === "locked"\) \{[\s\S]*?lock", "open"/,
    "entity card should not call lock.open for generic locked toggle",
  );
  assert.match(source, /lock", "lock", entityId/);
  assert.match(source, /_usesDomainToggleService\(state\)/);
  assert.match(source, /applyCardTapActionField/);
});

test("entity card opens inline select picker for select and input_select entities", () => {
  const source = read("nodalia-entity-card.js");
  assert.match(source, /isSelectDomainEntity/);
  assert.match(source, /_setSelectPickerVisibility\(/);
  assert.match(source, /entity-card__select-picker-shell--entering/);
  assert.match(source, /entity-card__select-picker-shell--leaving/);
  assert.match(source, /select_option/);
  assert.match(source, /_shouldOpenSelectPickerOnTap/);
  assert.match(source, /data-entity-action="select-option"/);
  assert.match(source, /_onShadowPointerDown/);
  assert.match(source, /_triggerEntityPressFeedback/);
  assert.match(source, /_clearSelectPickerAnimationTimer\(timerKey\)/);
  assert.match(source, /this\._nodaliaDeferTimers\?\.delete\?\.\(timer\)/);
  assert.match(source, /_selectPickerAnimationToken/);
  assert.match(source, /animationToken !== this\._selectPickerAnimationToken/);
  assert.match(source, /finalizeRemoval[\s\S]*_clearSelectPickerAnimationTimer\("_selectPickerCloseTimer"\)/);
  assert.match(source, /finalizeEnter[\s\S]*_clearSelectPickerAnimationTimer\("_selectPickerEnterTimer"\)/);
  const feedbackStart = source.indexOf("_triggerEntityPressFeedback(action, actionTarget)");
  const feedbackEnd = source.indexOf("_onShadowPointerDown(event)", feedbackStart);
  const feedbackSource = source.slice(feedbackStart, feedbackEnd);
  assert.match(feedbackSource, /querySelector\("\.entity-card__content"\)/);
  assert.match(feedbackSource, /querySelector\("\.entity-card__icon"\)/);
  assert.match(feedbackSource, /const opensSelectPicker = this\._shouldOpenSelectPickerOnTap\(this\._getState\(\), action\)/);
  assert.match(feedbackSource, /if \(!opensSelectPicker\) \{[\s\S]*querySelector\("\.entity-card__content"\)/);
  assert.match(source, /_triggerPressAnimation\(element[\s\S]*element\.classList\.remove\(className\);[\s\S]*element\.classList\.add\(className\)/);
  assert.doesNotMatch(source, /_clearEntranceAnimationClasses/);
  assert.match(source, /@keyframes entity-card-bubble-bounce[\s\S]*transform: scale\(1\.12\);[\s\S]*transform: scale\(1\);/);
  assert.doesNotMatch(source, /@keyframes entity-card-bubble-bounce[\s\S]{0,500}scale:\s*1\.12/);
  assert.match(source, /"entity-card__icon--entering"/);
  assert.match(source, /\.entity-card:not\(\.entity-card--select-open\) \.entity-card__select-picker-shell-host \{[\s\S]*display: none;/);
  assert.match(source, /\.entity-card__select-picker-shell \{[\s\S]*?overflow: hidden;/);
  assert.match(source, /\.entity-card__select-picker \{[\s\S]*?border-radius: calc\(\$\{styles\.card\.border_radius\} - 8px\);[\s\S]*?overflow: hidden;/);
  assert.doesNotMatch(source, /\.entity-card__select-picker-shell \{[^}]*border-radius:\s*inherit/);
  assert.doesNotMatch(source, /\.entity-card__select-picker-inner \{[^}]*border-radius:\s*inherit/);
  assert.doesNotMatch(source, /\.entity-card__select-picker-inner \{[^}]*overflow:\s*hidden/);
  assert.doesNotMatch(source, /ha-card\.entity-card--select-open \{[^}]*overflow:\s*visible/);
  assert.doesNotMatch(source, /entity-card__select-picker-head/);
  assert.doesNotMatch(source, /entity-card__select-picker-kicker/);
  assert.doesNotMatch(source, /entity-card__select-picker-close/);
  assert.doesNotMatch(source, /`sp:\$\{this\._selectPickerOpen \? 1 : 0\}`/);
  assert.doesNotMatch(source, /entity-card-select-option-in/);
});

test("entity card prefers Home Assistant translated display state", () => {
  const source = read("nodalia-entity-card.js");
  assert.match(source, /function getHomeAssistantStateDisplayValue\(state, hass = null\)/);
  assert.match(source, /hass\?\.formatEntityState/);
  assert.match(source, /attrs\.state_translated/);
  assert.match(source, /attrs\.translated_state/);
  assert.match(source, /attrs\.state_display/);
  assert.match(source, /attrs\.display_state/);
  assert.match(source, /const displayValue = getHomeAssistantStateDisplayValue\(state, this\._hass\);[\s\S]*if \(displayValue\) \{[\s\S]*return displayValue;/);
  assert.match(source, /`sd:\$\{getHomeAssistantStateDisplayValue\(state, hass\)\}`/);
});

test("entity card supports in-app navigate tap action with navigation_path", () => {
  const source = read("nodalia-entity-card.js");
  assert.match(source, /navigation_path: ""/);
  assert.match(source, /"navigate", label: "ed\.entity\.tap_navigate"/);
  assert.match(source, /_navigateToPath\(path\)/);
  assert.match(source, /this\._hass\.navigate\(navigationPath\)/);
  assert.match(source, /!navigationPath\.includes\(":\/\/"\)/);
  assert.match(source, /fireEvent\(this, "location-changed", \{ replace: false \}\)/);
  assert.match(source, /fireEvent\(this, "hass-navigate", \{ path: navigationPath \}\)/);
  assert.match(source, /case "navigate":[\s\S]*_navigationPathForZone\(zone, "tap"\)/);
  assert.match(source, /tap_action === "navigate" && !config\.navigation_path && config\.tap_url/);
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

test("entity card inherits the associated entity icon by default", () => {
  const source = read("nodalia-entity-card.js");
  assert.match(source, /use_entity_icon: true/);
  assert.match(source, /const configuredIcon = trimIcon\(this\._config\?\.icon\);/);
  assert.match(source, /if \(configuredIcon\) \{\s*return configuredIcon;/);
  assert.match(source, /trimIcon\(state\?\.attributes\?\.icon\) \|\| getDynamicEntityIcon\(state\)/);
});

test("fav card inherits the associated entity icon instead of defaulting to a star", () => {
  const source = read("nodalia-fav-card.js");
  assert.match(source, /use_entity_icon: true/);
  assert.match(source, /const configuredIcon = String\(this\._config\?\.icon \|\| ""\)\.trim\(\);/);
  assert.match(source, /if \(configuredIcon\) \{\s*return configuredIcon;/);
  assert.match(source, /String\(state\?\.attributes\?\.icon \|\| ""\)\.trim\(\) \|\| getDynamicEntityIcon\(state\)/);
  assert.match(source, /\|\| "mdi:star-four-points";/);
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

test("power flow flow dots avoid origin flash before motion starts", () => {
  const source = read("nodalia-power-flow-card.js");
  assert.match(source, /function getSvgPathMotionStart\(pathD\)/);
  assert.match(source, /const SVG_PATH_TOKEN_RE = \/\[AaCcHhLlMmQqSsTtVvZz\]/);
  assert.match(source, /function tokenizeSvgPath\(pathD\)/);
  assert.match(source, /readFlag\(\)/);
  assert.match(source, /function getSvgRelativeMotionPath\(pathD\)/);
  assert.match(source, /const motionPath = getSvgRelativeMotionPath\(line\.path\)/);
  assert.match(source, /upper === "C"/);
  assert.match(source, /upper === "S" \|\| upper === "Q"/);
  assert.match(source, /upper === "H"/);
  assert.match(source, /upper === "V"/);
  assert.match(source, /cx="\$\{cx\}" cy="\$\{cy\}"/);
  assert.match(source, /const path = escapeHtml\(motionPath\.path\)/);
  assert.match(source, /<animateMotion[^>]*path="\$\{path\}"/);
  assert.doesNotMatch(source, /<animateMotion[^>]*path="\$\{line\.path\}"/);
  assert.doesNotMatch(source, /offsetWidth/);
  assert.match(source, /\.power-flow-card__dot-group \{[\s\S]*opacity: 0;/);
  assert.match(source, /\.power-flow-card:not\(\.power-flow-card--motion-paused\) \.power-flow-card__dot-group/);
  assert.match(source, /\.power-flow-card__simple-dot \{[\s\S]*opacity: 0;/);
  assert.match(source, /animation: power-flow-card-simple-dot linear infinite both;/);
  assert.match(source, /\.power-flow-card__simple-rail--entering \.power-flow-card__simple-dot/);
});

test("circular gauge thumb follows dial arc via rotate orbit transform", () => {
  const source = read("nodalia-circular-gauge-card.js");
  assert.match(source, /function getDialThumbRotate\(/);
  assert.match(source, /rotate\(var\(--gauge-thumb-rotate/);
  assert.match(source, /translateY\(calc\(-1 \* var\(--gauge-thumb-orbit/);
  assert.match(source, /setProperty\("--gauge-thumb-rotate"/);
  assert.doesNotMatch(source, /--gauge-thumb-left/);
});

test("circular gauge entrance animates a single smooth progress arc", () => {
  const source = read("nodalia-circular-gauge-card.js");
  assert.match(source, /gauge-card__dial--entrance-progress/);
  assert.match(source, /data-progress-smooth/);
  assert.match(source, /_finalizeGaugeEntranceProgress/);
  assert.match(
    source,
    /if \(shouldAnimateEntrance\) \{[\s\S]*?return;[\s\S]*?\}/,
    "entrance animation should not tween segmented dash stripes",
  );
});

test("circular gauge keeps WebKit-safe literal colors in segmented SVG strokes", () => {
  const source = read("nodalia-circular-gauge-card.js");
  assert.match(source, /const GAUGE_TINT_SEGMENT_COUNT = 16;/);
  assert.match(source, /function resolveGaugeSvgStrokeColor\(/);
  assert.match(source, /\(\?:color-mix\|var\)\\\(/);
  assert.match(source, /getGaugeSvgFallbackColor\(sampleRatio\)/);
  assert.doesNotMatch(source, /\.gauge-card__dial-progress-segment \{[\s\S]*?filter: drop-shadow/);
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

test("climate render signature tracks temperature drafts via revision counter", () => {
  const source = read("nodalia-climate-card.js");
  assert.match(source, /this\._draftTemperature\.has\(entityId\) \|\| this\._draftTempRange\.has\(entityId\)/);
  assert.match(source, /_scheduleDraftRevision/);
  assert.match(source, /joinParts\(\[\{ prefix: "climate:", values \}\]\)/);
  assert.doesNotMatch(source, /JSON\.stringify\(this\._scheduleComposerDraft\)/);
});

test("fan and humidifier re-render when optimistic toggle is confirmed during animation", () => {
  for (const file of ["nodalia-fan-card.js", "nodalia-humidifier-card.js"]) {
    const source = read(file);
    assert.match(source, /const optimisticJustConfirmed = hadOptimisticToggle && !this\._optimisticToggle/);
    assert.match(source, /&& !optimisticJustConfirmed/);
  }
});

test("fan and humidifier visual settle waits for non-zero published values", () => {
  const fan = read("nodalia-fan-card.js");
  const humidifier = read("nodalia-humidifier-card.js");
  assert.match(fan, /_hasPublishedPercentage\(actualState\)[\s\S]*percentage > 0/);
  assert.match(humidifier, /_hasPublishedHumidity\(actualState\)[\s\S]*humidity > 0/);
  assert.match(humidifier, /targetHumidity > 0/);
});

test("humidifier render signature includes mode_entity helper state", () => {
  const source = read("nodalia-humidifier-card.js");
  assert.match(source, /modeEntityId/);
  assert.match(source, /modeEntityState/);
  assert.match(source, /joinParts\(\[\{ prefix: "humidifier:"/);
});

test("fav and vacuum resize observers skip render when signature is unchanged", () => {
  const fav = read("nodalia-fav-card.js");
  const vacuum = read("nodalia-vacuum-card.js");
  assert.match(fav, /const signature = this\._getRenderSignature\(\);\s*if \(signature === this\._lastRenderSignature\)/);
  assert.match(vacuum, /const signature = this\._getRenderSignature\(\);\s*if \(signature === this\._lastRenderSignature\)/);
});

test("power flow refreshes its tracked entity stamp before render gating", () => {
  const source = read("nodalia-power-flow-card.js");
  assert.match(source, /set hass\(hass\) \{\s*this\._hass = hass;\s*this\._syncTrackedEntitiesStamp\(hass\);\s*const nextSignature/);
  assert.match(source, /NodaliaRenderSignature\?\.joinParts/);
  assert.match(source, /prefix: "states:", values: \[this\._trackedEntitiesStamp\]/);

  const PowerFlowCard = loadPowerFlowCardClass();
  const card = new PowerFlowCard();
  card._config.entities.grid.entity = "sensor.grid";
  card._config.entities.home.entity = "sensor.home";
  card._invalidateTrackedEntityStampCache();
  let renders = 0;
  card._render = () => {
    renders += 1;
    card.shadowRoot.innerHTML = "<ha-card></ha-card>";
  };

  card.hass = {
    states: {
      "sensor.grid": { state: "100", last_updated: "2026-07-28T10:00:00Z", attributes: {} },
      "sensor.home": { state: "100", last_updated: "2026-07-28T10:00:00Z", attributes: {} },
    },
  };
  card.hass = {
    states: {
      "sensor.grid": { state: "140", last_updated: "2026-07-28T10:00:01Z", attributes: {} },
      "sensor.home": { state: "140", last_updated: "2026-07-28T10:00:01Z", attributes: {} },
    },
  };
  card.hass = card._hass;

  assert.equal(renders, 2, "tracked power changes should render once while identical hass updates stay gated");
});

test("advance vacuum map display follows cleaning session mode", () => {
  const source = read("nodalia-advance-vacuum-card.js");
  assert.match(source, /_getDisplayCleaningModeId\(\)/);
  assert.match(source, /_resolveDisplayMode\(/);
  assert.match(source, /const currentMode = this\._resolveDisplayMode\(modes, advanceVacuumStrings\)/);
  assert.match(source, /\$\{currentMode\.id === "rooms" \? rooms\.map/);
  assert.match(source, /advance-vacuum-card__mode-button \$\{mode\.id === this\._activeMode/);
});

test("fan off-state memory ignores zero percentage", () => {
  const source = read("nodalia-fan-card.js");
  assert.match(source, /rememberedPercentage > 0/);
});

test("humidifier off-state memory ignores zero humidity", () => {
  const source = read("nodalia-humidifier-card.js");
  assert.match(source, /rememberedHumidity > 0/);
});

test("calendar card invalidates refresh run id on disconnect", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /this\._refreshRunId \+= 1/);
  assert.match(source, /this\._refreshInFlight = false/);
  assert.match(source, /this\._refreshQueued = false/);
});

test("weather forecast subscription guards disconnected lifecycle", () => {
  const source = read("nodalia-weather-card.js");
  assert.match(source, /subscribeMessage\(event => \{[\s\S]*if \(!this\.isConnected\)/);
});

test("vacuum built-in controls bypass the configurable service allowlist", () => {
  const source = read("nodalia-vacuum-card.js");
  assert.doesNotMatch(source, /_callUserVacuumService\(/);
  assert.doesNotMatch(source, /_isServiceAllowed\(/);
  assert.match(source, /_callSelectOption\(/);
  for (const service of ["start", "pause", "stop", "return_to_base", "locate", "set_fan_speed", "clean_area"]) {
    assert.match(source, new RegExp(`_callService\\("${service}"`));
  }
  const selectBody = source.match(/_callSelectOption\(entityId, option\) \{[\s\S]*?\n  \}/);
  assert.ok(selectBody, "expected _callSelectOption implementation");
  assert.doesNotMatch(selectBody[0], /_isServiceAllowed/);
});

test("notifications defers side effects until render signature changes", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(source, /const nextSignature = this\._getRenderSignature\(hass\)/);
  assert.match(source, /nextSignature === this\._lastRenderSignature\)[\s\S]*return;/);
});

test("alpha.7 lifecycle defer cleanup and viewport observer guards", () => {
  assert.match(read("nodalia-person-card.js"), /disconnectedCallback\(\) \{[\s\S]*clearDeferTimers/);
  assert.match(read("nodalia-circular-gauge-card.js"), /disconnectedCallback\(\) \{[\s\S]*clearDeferTimers/);
  assert.match(read("nodalia-vacuum-card.js"), /scheduleDeferTimer/);
  assert.match(read("nodalia-calendar-card.js"), /IntersectionObserver\([\s\S]*if \(!this\.isConnected\)/);
  assert.match(read("nodalia-notifications-card.js"), /IntersectionObserver\([\s\S]*if \(!this\.isConnected\)/);
  assert.match(read("nodalia-power-flow-card.js"), /_onFlowViewport\(entries\) \{[\s\S]*if \(!this\.isConnected\)/);
  assert.match(read("nodalia-media-player.js"), /_callInternalMediaService\(/);
  assert.match(read("nodalia-light-card.js"), /_lastEntityRevision/);
});

test("alpha.5 lifecycle guards on notifications media climate scenes calendar graph nav and alarm", () => {
  assert.match(read("nodalia-notifications-card.js"), /_renderIfChanged\(force = false\) \{[\s\S]*if \(!this\.isConnected\)/);
  assert.match(read("nodalia-notifications-card.js"), /this\._calendarRefreshInFlight = false/);
  assert.match(read("nodalia-media-player.js"), /scheduleDeferTimer/);
  assert.match(read("nodalia-climate-card.js"), /scheduleDeferTimer/);
  assert.match(read("nodalia-scenes-card.js"), /scheduleDeferTimer/);
  assert.match(read("nodalia-calendar-card.js"), /subscribeMessage\(event => \{[\s\S]*if \(!this\.isConnected\)/);
  assert.match(read("nodalia-graph-card.js"), /requestAnimationFrame\(\(\) => \{[\s\S]*if \(!this\.isConnected\)/);
  assert.match(read("nodalia-navigation-bar.js"), /_dockEntranceResetFrame/);
  assert.match(read("nodalia-calendar-card.js"), /_calendarEntrancePlayFrame/);
  assert.match(read("nodalia-calendar-card.js"), /_cancelCalendarEntrancePlayFrames/);
  assert.match(read("nodalia-alarm-panel-card.js"), /_countdownInterval = window\.setInterval\(\(\) => \{[\s\S]*if \(!this\.isConnected\)/);
});

test("entity person weather and alarm use deferred press timers", () => {
  for (const file of [
    "nodalia-entity-card.js",
    "nodalia-person-card.js",
    "nodalia-weather-card.js",
    "nodalia-alarm-panel-card.js",
  ]) {
    const source = read(file);
    assert.match(source, /scheduleDeferTimer/, `${file} should schedule defer timers`);
    assert.match(source, /clearDeferTimers/, `${file} should clear defer timers on disconnect`);
  }
});

test("notifications tracked entity stamp is cached between hass updates", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(source, /_syncTrackedEntitiesStamp\(hass\)/);
  assert.match(source, /_trackedEntitiesStamp/);
  assert.match(source, /parts\.push\(this\._trackedEntitiesStamp\)/);
  assert.doesNotMatch(source, /tracked\.forEach\(entityId =>/);
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

test("NodaliaUtils renders card empty state shell for missing entity state", () => {
  const utils = read("nodalia-utils.js");
  assert.match(utils, /function renderCardEmptyStateDocument\(/);
  assert.match(utils, /\[class\$="--empty"\]/);
  for (const file of [
    "nodalia-entity-card.js",
    "nodalia-fav-card.js",
    "nodalia-person-card.js",
    "nodalia-alarm-panel-card.js",
    "nodalia-cover-card.js",
    "nodalia-light-card.js",
    "nodalia-fan-card.js",
  ]) {
    const source = read(file);
    assert.match(
      source,
      /if \(!state\) \{[\s\S]*renderCardEmptyStateDocument/,
      `${file} should render empty state when entity state is missing`,
    );
  }
});

test("cover card compact auto mode uses width and grid heuristics", () => {
  const source = read("nodalia-cover-card.js");
  assert.match(source, /COMPACT_LAYOUT_THRESHOLD/);
  assert.match(source, /configuredColumns < 4/);
  assert.doesNotMatch(source, /if \(mode === "auto"\)[\s\S]*return false;/);
});

test("fav card aligns service security with entity and cleans up alarm host span", () => {
  const source = read("nodalia-fav-card.js");
  assert.match(source, /strict_service_actions: true/);
  const internalService = source.slice(source.indexOf("_invokeEntityService("), source.indexOf("_toggleCoverEntity("));
  assert.doesNotMatch(internalService, /_isServiceAllowed/);
  assert.match(source, /_callConfiguredService\([\s\S]*_isServiceAllowed\(serviceValue\)/);
  assert.match(source, /disconnectedCallback\(\) \{[\s\S]*_applyHostGridSpan\(false\)/);
  assert.match(source, /clearDeferTimers/);
});

test("alarm supported_features distinguishes missing attribute from explicit zero", () => {
  for (const file of ["nodalia-alarm-panel-card.js", "nodalia-fav-card.js"]) {
    const source = read(file);
    assert.match(source, /hasOwnProperty\.call\(attrs, "supported_features"\)/, file);
    assert.match(source, /if \(features === null\) \{[\s\S]*return true;/, file);
  }
});

test("graph card always renders on hass while history loads", () => {
  const source = read("nodalia-graph-card.js");
  assert.match(source, /set hass\(hass\) \{[\s\S]*this\._requestHistory\(\);[\s\S]*this\._render\(\);/);
  assert.doesNotMatch(source, /if \(!hasEntities \|\| hadHistory\)/);
});

test("invokeHomeAssistantService logs callService failures", () => {
  const utils = read("nodalia-utils.js");
  assert.match(utils, /callService failed/);
});

test("fav card requires manual alarm PIN when code input is visible", () => {
  const source = read("nodalia-fav-card.js");
  assert.match(source, /const requiresManualPin = this\._shouldShowAlarmCodeInput\(state\)/);
  assert.match(source, /if \(requiresManualPin && !manualPin\) \{[\s\S]*return;/);
  assert.match(source, /const code = requiresManualPin \? manualPin : this\._getAlarmCodeValue\(state\)/);
  assert.match(source, /if \(this\._shouldShowAlarmCodeInput\(state\)\) \{[\s\S]*return "";/);
});

test("fav card preserves Lovelace service target for configured tap actions", () => {
  const source = read("nodalia-fav-card.js");
  assert.match(source, /serviceTargetKey: "tap_service_target"/);
  assert.match(source, /tap_service_target/);
  assert.match(source, /hasExplicitTarget/);
  assert.match(source, /invoke\(this, this\._hass, domain, service, payload, hasExplicitTarget \? target : null\)/);
});

test("entity card keeps built-in controls usable while gating configured services", () => {
  const source = read("nodalia-entity-card.js");
  const internalService = source.slice(source.indexOf("_invokeEntityService("), source.indexOf("_toggleCoverEntity("));
  assert.doesNotMatch(internalService, /_isServiceAllowed/);
  assert.match(source, /_callConfiguredService\([\s\S]*_isServiceAllowed\(serviceValue\)/);
  assert.match(source, /select_option/);
});

test("notifications card drains pending foreground mobile queue in batches", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(source, /_mobileNotifyQueue/);
  assert.match(source, /_enqueueMobileNotifications/);
  assert.match(source, /_scheduleMobileNotifyDrain/);
  assert.match(source, /this\._mobileNotifyQueue\.splice\(0, 4\)/);
  assert.match(source, /Promise\.resolve\(\)[\s\S]*\.then\(\(\) => this\._flushMobileNotifications\(batch\)\)[\s\S]*\.catch\(error =>/);
  assert.match(source, /if \(this\._mobileNotifyQueue\.length\) \{[\s\S]*_scheduleMobileNotifyDrain/);
});

test("visual family tokens stay aligned without changing notifications", () => {
  for (const file of [
    "nodalia-entity-card.js",
    "nodalia-light-card.js",
    "nodalia-fan-card.js",
    "nodalia-humidifier-card.js",
    "nodalia-cover-card.js",
    "nodalia-vacuum-card.js",
  ]) {
    assert.match(read(file), /chip_font_size: "11px"/, `${file} should use the device chip type scale`);
  }

  assert.match(read("nodalia-entity-card.js"), /control:\s*\{[\s\S]*?size: "36px"/);
  assert.match(
    read("nodalia-cover-card.js"),
    /on_color: "var\(--warning-color, #fec700\)"[\s\S]*slider_color: "var\(--warning-color, #fec700\)"/,
  );
  assert.match(
    read("nodalia-fav-card.js"),
    /card:\s*\{[\s\S]*?border: "1px solid var\(--divider-color\)"[\s\S]*?border_radius: "var\(--nodalia-card-border-radius, 28px\)"/,
  );
  assert.match(
    read("nodalia-navigation-bar.js"),
    /media_player:\s*\{[\s\S]*?title_size: "12px"[\s\S]*?subtitle_size: "10px"/,
  );
  assert.match(read("nodalia-news-card.js"), /border: "1px solid var\(--divider-color\)"/);

  for (const file of [
    "nodalia-cover-card.js",
    "nodalia-vacuum-card.js",
    "nodalia-alarm-panel-card.js",
    "nodalia-person-card.js",
    "nodalia-fav-card.js",
  ]) {
    assert.match(read(file), /ha-card::after \{[\s\S]*radial-gradient\(circle at 18% 20%/);
  }

  const reducedMotionCards = [
    "nodalia-entity-card.js",
    "nodalia-cover-card.js",
    "nodalia-climate-card.js",
    "nodalia-circular-gauge-card.js",
    "nodalia-alarm-panel-card.js",
    "nodalia-calendar-card.js",
    "nodalia-camera-card.js",
    "nodalia-fav-card.js",
    "nodalia-graph-card.js",
    "nodalia-insignia-card.js",
    "nodalia-media-player.js",
    "nodalia-navigation-bar.js",
    "nodalia-person-card.js",
    "nodalia-power-flow-card.js",
    "nodalia-scenes-card.js",
  ];
  reducedMotionCards.forEach(file => {
    assert.match(read(file), /renderReducedMotionStyles/);
  });
  assert.match(read("nodalia-utils.js"), /function renderReducedMotionStyles\(\)[\s\S]*prefers-reduced-motion: reduce/);
  assert.doesNotMatch(read("nodalia-notifications-card.js"), /renderReducedMotionStyles/);
  assert.match(
    read("nodalia-notifications-card.js"),
    /border_radius: "var\(--nodalia-card-border-radius, 28px\)"[\s\S]*item_radius: "var\(--nodalia-card-border-radius, 28px\)"/,
  );
  assert.match(read("nodalia-notifications-card.js"), /itemRadius === "18px" \|\| itemRadius === "28px"/);
  assert.match(read("nodalia-notifications-card.js"), /renderEditorCardBorderRadiusHtml/);
  assert.match(read("nodalia-notifications-card.js"), /styles\.item_radius/);
  assert.match(read("nodalia-utils.js"), /FAMILY_RADIUS/);
});

test("climate humidifier fan and light fire selection haptics on scroll step changes", () => {
  for (const file of ["nodalia-humidifier-card.js", "nodalia-fan-card.js", "nodalia-light-card.js"]) {
    const source = read(file);
    assert.match(source, /_hapticOnSliderStep\(/, `${file} should expose slider step haptics`);
    assert.match(source, /lastHapticValue/, `${file} should track the last stepped haptic value while dragging`);
    assert.match(
      source,
      /_hapticOnSliderStep\([\s\S]*\{ commit \}\)/,
      `${file} should haptic during apply, not only on bare commit`,
    );
  }

  const climate = read("nodalia-climate-card.js");
  assert.match(climate, /_hapticOnDialStep\(/);
  assert.match(climate, /_hapticOnDialStep\(stepped, \{ commit: options\.commit === true \}\)/);
  assert.match(climate, /_hapticOnDialStep\(drag\.handle === "low" \? low : high, \{ commit: false \}\)/);

  const light = read("nodalia-light-card.js");
  assert.match(light, /_lightSliderHapticStep\(/);
  assert.match(light, /kind === "color"[\s\S]*Math\.round\(numeric \/ 5\) \* 5/);
});
