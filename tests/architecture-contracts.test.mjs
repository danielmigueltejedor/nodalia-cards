import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const CARD_FILES = [
  "nodalia-navigation-bar.js",
  "nodalia-media-player.js",
  "nodalia-light-card.js",
  "nodalia-fan-card.js",
  "nodalia-humidifier-card.js",
  "nodalia-circular-gauge-card.js",
  "nodalia-graph-card.js",
  "nodalia-power-flow-card.js",
  "nodalia-cover-card.js",
  "nodalia-climate-card.js",
  "nodalia-alarm-panel-card.js",
  "nodalia-advance-vacuum-card.js",
  "nodalia-entity-card.js",
  "nodalia-fav-card.js",
  "nodalia-insignia-card.js",
  "nodalia-person-card.js",
  "nodalia-scenes-card.js",
  "nodalia-weather-card.js",
  "nodalia-calendar-card.js",
  "nodalia-notifications-card.js",
  "nodalia-vacuum-card.js",
  "nodalia-news-card.js",
  "nodalia-camera-card.js",
  "nodalia-room-summary-card.js",
];

const CARD_TAGS = CARD_FILES.map(file => file.replace(/\.js$/, ""));
const EDITOR_TAGS = CARD_TAGS.map(tag => `${tag}-editor`);

function loadUtils() {
  class FakeElement {
    constructor() {
      this.listeners = new Map();
    }

    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(listener);
    }

    removeEventListener(type, listener) {
      this.listeners.get(type)?.delete(listener);
    }

    listenerCount(type) {
      return this.listeners.get(type)?.size || 0;
    }
  }
  class FakeInput extends FakeElement {}
  class FakeTextArea extends FakeElement {}
  class FakeSelect extends FakeElement {}
  class FakeCustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      Object.assign(this, options);
    }
  }
  const sandbox = {
    CustomEvent: FakeCustomEvent,
    Element: FakeElement,
    HTMLElement: FakeElement,
    HTMLInputElement: FakeInput,
    HTMLTextAreaElement: FakeTextArea,
    HTMLSelectElement: FakeSelect,
    URL,
    addEventListener() {},
    clearTimeout,
    console,
    removeEventListener() {},
    setTimeout,
    window: null,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  return { ...sandbox, utils: sandbox.NodaliaUtils };
}

test("public custom-element and editor tags stay exact", () => {
  const actualCards = [];
  const actualEditors = [];
  for (const file of CARD_FILES) {
    const source = read(file);
    const cardTag = source.match(/(?:const|let|var) CARD_TAG = "([^"]+)"/)?.[1];
    const editorTag = source.match(/(?:const|let|var) EDITOR_TAG = "([^"]+)"/)?.[1];
    actualCards.push(cardTag);
    actualEditors.push(editorTag);
  }
  assert.deepEqual(actualCards, CARD_TAGS);
  assert.deepEqual(actualEditors, EDITOR_TAGS);
});

test("build and package expose the exact supported card source set", () => {
  const build = read("scripts/build-bundle.mjs");
  const listed = [...build.matchAll(/^\s+"(nodalia-(?:[^"/]+))",$/gm)]
    .map(match => match[1])
    .filter(file => CARD_FILES.includes(file));
  assert.deepEqual(listed, CARD_FILES);

  const pkg = JSON.parse(read("package.json"));
  CARD_FILES.forEach(file => assert.ok(pkg.files.includes(file), `${file} must remain published`));
  assert.match(pkg.version, /^2\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+b?)?$/);
  assert.ok(pkg.files.includes("nodalia-notifications-mobile-policy.js"));
  assert.ok(pkg.files.includes("nodalia-room-summary-model.js"));
  assert.ok(pkg.files.includes("nodalia-camera-stream-model.js"));
  assert.ok(pkg.files.includes("nodalia-backend.js"));
  assert.ok(!pkg.files.some(file => file.startsWith("custom_components/")));
});

test("Nodalia Cards remains a HACS plugin with an optional Engine bridge", () => {
  const hacs = JSON.parse(read("hacs.json"));
  const workflow = read(".github/workflows/hacs.yml");
  const build = read("scripts/build-bundle.mjs");
  const backend = read("nodalia-backend.js");

  assert.equal(hacs.filename, "nodalia-cards.js");
  assert.equal(hacs.content_in_root, true);
  assert.match(workflow, /category: plugin/);
  assert.doesNotMatch(build, /custom_components/);
  assert.match(backend, /nodalia\/status/);
  assert.match(backend, /nodalia\/notifications\/set/);
  assert.match(backend, /nodalia\/climate\/schedule\/set/);
  assert.equal(fs.existsSync(path.join(root, "custom_components")), false);
});

test("card runtime metadata stays synchronized with package version", () => {
  const pkg = JSON.parse(read("package.json"));
  CARD_FILES.forEach(file => {
    const source = read(file);
    assert.match(
      source,
      new RegExp(`(?:const|let|var) CARD_VERSION = ${JSON.stringify(pkg.version).replaceAll(".", "\\.")}`),
      `${file} must report package version ${pkg.version}`,
    );
  });
});

test("Scenes and Calendar integrate with Sections and entity suggestions", () => {
  const scenes = read("nodalia-scenes-card.js");
  const calendar = read("nodalia-calendar-card.js");
  for (const [source, domain] of [[scenes, "scene"], [calendar, "calendar"]]) {
    assert.match(source, /getGridOptions\(\)/);
    assert.match(source, /rows: "auto"/);
    assert.match(source, /static getEntitySuggestion\(/);
    assert.match(source, /createEntitySuggestion\(CARD_TAG, hass, entityId/);
    assert.match(source, new RegExp(`domains: \\["${domain}"\\]`));
  }
});

test("entity-first suggestions cover every entity-centric Nodalia card", () => {
  const expectedDomains = new Map([
    ["nodalia-light-card.js", "light"],
    ["nodalia-fan-card.js", "fan"],
    ["nodalia-humidifier-card.js", "humidifier"],
    ["nodalia-cover-card.js", "cover"],
    ["nodalia-climate-card.js", "climate"],
    ["nodalia-alarm-panel-card.js", "alarm_control_panel"],
    ["nodalia-vacuum-card.js", "vacuum"],
    ["nodalia-advance-vacuum-card.js", "vacuum"],
    ["nodalia-person-card.js", "person"],
    ["nodalia-weather-card.js", "weather"],
    ["nodalia-camera-card.js", "camera"],
    ["nodalia-media-player.js", "media_player"],
    ["nodalia-scenes-card.js", "scene"],
    ["nodalia-calendar-card.js", "calendar"],
  ]);
  for (const [file, domain] of expectedDomains) {
    const source = read(file);
    assert.match(source, /static getEntitySuggestion\(hass, entityId\)/, file);
    assert.match(source, /createEntitySuggestion\(CARD_TAG, hass, entityId/, file);
    assert.match(source, new RegExp(`"${domain}"`), file);
  }

  const entity = read("nodalia-entity-card.js");
  assert.match(entity, /createEntitySuggestion\(CARD_TAG, hass, entityId/);
  for (const file of ["nodalia-circular-gauge-card.js", "nodalia-graph-card.js"]) {
    const source = read(file);
    assert.match(source, /"sensor", "number", "input_number"/, file);
  }
  assert.match(read("nodalia-news-card.js"), /attributes\?\.items/);
});

test("complex cards keep policy and state projection outside view components", () => {
  const build = read("scripts/build-bundle.mjs");
  const notifications = read("nodalia-notifications-card.js");
  const room = read("nodalia-room-summary-card.js");
  assert.match(build, /const CARD_SUPPORT_PARTS = \[[\s\S]*nodalia-notifications-mobile-policy\.js[\s\S]*nodalia-room-summary-model\.js[\s\S]*nodalia-camera-stream-model\.js/);
  assert.match(notifications, /window\.NodaliaNotificationsMobilePolicy/);
  assert.doesNotMatch(notifications, /function resolveMobileDeliveryState\(/);
  assert.match(room, /window\.NodaliaRoomSummaryModel/);
  assert.doesNotMatch(room, /function countMatching\(/);
  const camera = read("nodalia-camera-card.js");
  assert.match(camera, /window\.NodaliaCameraStreamModel/);
  assert.doesNotMatch(camera, /function buildGo2rtcWebSocketEndpoint\(/);
});

test("shared compact layout helper treats 4/6-col tiles and phone widths as compact", () => {
  const { utils } = loadUtils();
  assert.equal(utils.shouldUseCompactCardLayout({ mode: "always", width: 900, gridColumns: 12 }), true);
  assert.equal(utils.shouldUseCompactCardLayout({ mode: "never", width: 120, gridColumns: 2 }), false);
  assert.equal(utils.shouldUseCompactCardLayout({ mode: "auto", width: 390, gridColumns: 12 }), true);
  assert.equal(utils.shouldUseCompactCardLayout({ mode: "auto", width: 520, gridColumns: 6 }), true);
  assert.equal(utils.shouldUseCompactCardLayout({ mode: "auto", width: 520, gridColumns: 4 }), true);
  assert.equal(utils.shouldUseCompactCardLayout({ mode: "auto", width: 600, gridColumns: 12 }), true);
  assert.equal(utils.shouldUseCompactCardLayout({ mode: "auto", width: 720, gridColumns: 12 }), false);
  assert.equal(utils.shouldUseCompactCardLayout({ mode: "auto", width: 520, parentWidth: 1100 }), true);
  assert.equal(utils.shouldUseCompactCardLayout({ mode: "auto", width: 900, parentWidth: 1100 }), false);
  assert.equal(utils.resolveCompactLayoutParentWidth(null), 0);
  assert.equal(utils.shouldShowCompactCardTitle({ width: 220 }), true);
  assert.equal(utils.shouldShowCompactCardTitle({ width: 148 }), true);
  assert.equal(utils.shouldShowCompactCardTitle({ width: 147 }), true);
  assert.equal(utils.shouldShowCompactCardTitle({ width: 80 }), true);
  assert.equal(utils.shouldShowCompactCardTitle({}), true);
});

test("shared merge and compaction preserve configuration semantics", () => {
  const { utils } = loadUtils();
  const defaults = { nested: { enabled: true, count: 2 }, rows: [{ id: "base" }], keep: "yes" };
  const override = { nested: { count: 0 }, rows: [{ id: "custom" }], empty: "" };
  const merged = utils.mergeDeep(defaults, override);
  assert.deepEqual(JSON.parse(JSON.stringify(merged)), {
    nested: { enabled: true, count: 0 },
    rows: [{ id: "custom" }],
    keep: "yes",
    empty: "",
  });
  assert.deepEqual(defaults.rows, [{ id: "base" }], "merge must not mutate defaults");
  assert.deepEqual(
    JSON.parse(JSON.stringify(utils.compactConfig(merged))),
    { nested: { enabled: true, count: 0 }, rows: [{ id: "custom" }], keep: "yes" },
  );
});

test("shared configuration helpers reject prototype-manipulation keys", () => {
  const { utils } = loadUtils();
  const malicious = JSON.parse('{"safe":{"value":1},"__proto__":{"injected":"yes"},"constructor":{"prototype":{"polluted":true}}}');
  const merged = utils.mergeDeep({}, malicious);
  const compacted = utils.compactConfig(malicious);
  for (const result of [merged, compacted]) {
    assert.equal(Object.getPrototypeOf(result).injected, undefined);
    assert.equal(Object.getPrototypeOf(Object.getPrototypeOf(result)), null);
    assert.equal(Object.hasOwn(result, "__proto__"), false);
    assert.equal(Object.hasOwn(result, "constructor"), false);
    assert.deepEqual(JSON.parse(JSON.stringify(result.safe)), { value: 1 });
  }
  assert.equal({}.injected, undefined);
  assert.equal({}.polluted, undefined);

  const target = {};
  utils.setByPath(target, "safe.nested", 42);
  utils.setByPath(target, "__proto__.injected", "yes");
  utils.setByPath(target, "constructor.prototype.polluted", true);
  assert.deepEqual(JSON.parse(JSON.stringify(target)), { safe: { nested: 42 } });
  utils.deleteByPath(target, "constructor.prototype.toString");
  utils.deleteByPath(target, "safe.nested");
  assert.deepEqual(JSON.parse(JSON.stringify(target)), { safe: {} });
  assert.equal({}.injected, undefined);
  assert.equal({}.polluted, undefined);
  assert.equal(typeof {}.toString, "function");
});

test("service actions use the hardened strict default", () => {
  const { utils } = loadUtils();
  assert.equal(utils.normalizeSecurityConfig({}).strict_service_actions, true);
  assert.equal(utils.normalizeSecurityConfig({ strict_service_actions: false }).strict_service_actions, false);
});

test("normalizeSecurityConfig preserves allow_webhooks_for_non_admin opt-in", () => {
  const { utils } = loadUtils();
  const defaults = {
    strict_service_actions: true,
    allowed_services: [],
    allowed_service_domains: [],
    allow_webhooks_for_non_admin: false,
  };
  assert.equal(
    utils.normalizeSecurityConfig({ allow_webhooks_for_non_admin: true }, defaults).allow_webhooks_for_non_admin,
    true,
    "explicit opt-in must survive normalization against a false default",
  );
  assert.equal(
    utils.normalizeSecurityConfig({}, defaults).allow_webhooks_for_non_admin,
    false,
    "omitted values should keep the card default",
  );
  assert.equal(
    utils.normalizeSecurityConfig({ allow_webhooks_for_non_admin: false }, defaults).allow_webhooks_for_non_admin,
    false,
  );
  assert.equal(
    utils.normalizeSecurityConfig({ allow_webhooks_for_non_admin: true }).allow_webhooks_for_non_admin,
    true,
    "opt-in without defaults must still be preserved",
  );
});

test("host hold gesture bindings can reconnect without duplicate listeners", () => {
  const { utils, HTMLElement } = loadUtils();
  const host = new HTMLElement();
  const disconnect = utils.bindHostPointerHoldGesture(host, {
    resolveZone: () => "body",
    onHold() {},
  });

  assert.equal(host.listenerCount("pointerdown"), 1);
  disconnect();
  assert.equal(host.listenerCount("pointerdown"), 0);
  disconnect.reconnect();
  disconnect.reconnect();
  assert.equal(host.listenerCount("pointerdown"), 1);
  disconnect();
  assert.equal(host.listenerCount("pointerdown"), 0);
});

test("Lovelace action objects retain service data and targets", () => {
  const { utils } = loadUtils();
  const config = {};
  utils.applyCardTapActionField(config, {}, {
    action: "perform-action",
    perform_action: "light.turn_on",
    data: { brightness_pct: 42 },
    target: { entity_id: "light.salon" },
  }, "auto");
  assert.deepEqual(JSON.parse(JSON.stringify(config)), {
    tap_action: "service",
    tap_service: "light.turn_on",
    tap_service_data: "{\"brightness_pct\":42}",
    tap_service_target: "{\"entity_id\":\"light.salon\"}",
  });
});

test("editor focus and listener lifecycle primitives are idempotent", () => {
  const { utils, HTMLInputElement } = loadUtils();
  const active = new HTMLInputElement();
  active.dataset = { field: "styles.card.background" };
  active.selectionStart = 2;
  active.selectionEnd = 5;
  active.type = "text";
  let focusOptions = null;
  active.focus = options => { focusOptions = options; };
  active.setSelectionRange = (start, end) => {
    active.selectionStart = start;
    active.selectionEnd = end;
  };
  const calls = [];
  const rootNode = {
    activeElement: active,
    querySelector: selector => selector === '[data-field="styles.card.background"]' ? active : null,
    addEventListener: (...args) => calls.push(["add", ...args]),
    removeEventListener: (...args) => calls.push(["remove", ...args]),
  };
  const host = { shadowRoot: rootNode };
  const state = utils.captureEditorFocusState(host);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), {
    selector: '[data-field="styles.card.background"]',
    selectionEnd: 5,
    selectionStart: 2,
    type: "text",
  });
  utils.restoreEditorFocusState(host, state);
  assert.equal(focusOptions?.preventScroll, true);

  const listener = () => {};
  assert.equal(utils.bindShadowListeners(host, [{ type: "input", listener }]), true);
  assert.equal(utils.bindShadowListeners(host, [{ type: "input", listener }]), false);
  assert.equal(utils.releaseShadowListeners(host), true);
  assert.deepEqual(calls.map(call => call[0]), ["add", "remove"]);
});

test("TypeScript climate, media player, light, fan and humidifier sources are canonical and still ship HACS JS artifacts", () => {
  const climateFiles = [
    "src/cards/climate/index.ts",
    "src/cards/climate/climate-card.ts",
    "src/cards/climate/climate-config.ts",
    "src/cards/climate/climate-types.ts",
    "src/cards/climate/climate-model.ts",
    "src/cards/climate/climate-dial.ts",
    "src/cards/climate/climate-schedule.ts",
    "src/cards/climate/climate-editor.ts",
  ];
  climateFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const mediaFiles = [
    "src/cards/media-player/index.ts",
    "src/cards/media-player/media-player-card.ts",
    "src/cards/media-player/media-player-config.ts",
    "src/cards/media-player/media-player-types.ts",
    "src/cards/media-player/media-player-artwork.ts",
    "src/cards/media-player/media-player-progress.ts",
    "src/cards/media-player/media-player-layout.ts",
    "src/cards/media-player/media-player-editor.ts",
  ];
  mediaFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const lightFiles = [
    "src/cards/light/index.ts",
    "src/cards/light/light-card.ts",
    "src/cards/light/light-config.ts",
    "src/cards/light/light-types.ts",
    "src/cards/light/light-helpers.ts",
    "src/cards/light/light-editor.ts",
  ];
  lightFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const fanFiles = [
    "src/cards/fan/index.ts",
    "src/cards/fan/fan-card.ts",
    "src/cards/fan/fan-config.ts",
    "src/cards/fan/fan-types.ts",
    "src/cards/fan/fan-helpers.ts",
    "src/cards/fan/fan-editor.ts",
  ];
  fanFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const humidifierFiles = [
    "src/cards/humidifier/index.ts",
    "src/cards/humidifier/humidifier-card.ts",
    "src/cards/humidifier/humidifier-config.ts",
    "src/cards/humidifier/humidifier-types.ts",
    "src/cards/humidifier/humidifier-helpers.ts",
    "src/cards/humidifier/humidifier-editor.ts",
  ];
  humidifierFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const coverFiles = [
    "src/cards/cover/index.ts",
    "src/cards/cover/cover-card.ts",
    "src/cards/cover/cover-config.ts",
    "src/cards/cover/cover-types.ts",
    "src/cards/cover/cover-helpers.ts",
    "src/cards/cover/cover-editor.ts",
  ];
  coverFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const alarmFiles = [
    "src/cards/alarm-panel/index.ts",
    "src/cards/alarm-panel/alarm-panel-card.ts",
    "src/cards/alarm-panel/alarm-panel-config.ts",
    "src/cards/alarm-panel/alarm-panel-types.ts",
    "src/cards/alarm-panel/alarm-panel-helpers.ts",
    "src/cards/alarm-panel/alarm-panel-editor.ts",
  ];
  alarmFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const vacuumFiles = [
    "src/cards/vacuum/index.ts",
    "src/cards/vacuum/vacuum-card.ts",
    "src/cards/vacuum/vacuum-config.ts",
    "src/cards/vacuum/vacuum-types.ts",
    "src/cards/vacuum/vacuum-helpers.ts",
    "src/cards/vacuum/vacuum-editor.ts",
  ];
  vacuumFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const entityFiles = [
    "src/cards/entity/index.ts",
    "src/cards/entity/entity-card.ts",
    "src/cards/entity/entity-config.ts",
    "src/cards/entity/entity-types.ts",
    "src/cards/entity/entity-helpers.ts",
    "src/cards/entity/entity-editor.ts",
  ];
  entityFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const favFiles = [
    "src/cards/fav/index.ts",
    "src/cards/fav/fav-card.ts",
    "src/cards/fav/fav-config.ts",
    "src/cards/fav/fav-types.ts",
    "src/cards/fav/fav-helpers.ts",
    "src/cards/fav/fav-editor.ts",
  ];
  favFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const personFiles = [
    "src/cards/person/index.ts",
    "src/cards/person/person-card.ts",
    "src/cards/person/person-config.ts",
    "src/cards/person/person-types.ts",
    "src/cards/person/person-helpers.ts",
    "src/cards/person/person-editor.ts",
  ];
  personFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const cameraFiles = [
    "src/cards/camera/index.ts",
    "src/cards/camera/camera-card.ts",
    "src/cards/camera/camera-config.ts",
    "src/cards/camera/camera-types.ts",
    "src/cards/camera/camera-helpers.ts",
    "src/cards/camera/camera-editor.ts",
  ];
  cameraFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const circularGaugeFiles = [
    "src/cards/circular-gauge/index.ts",
    "src/cards/circular-gauge/circular-gauge-card.ts",
    "src/cards/circular-gauge/circular-gauge-config.ts",
    "src/cards/circular-gauge/circular-gauge-types.ts",
    "src/cards/circular-gauge/circular-gauge-helpers.ts",
    "src/cards/circular-gauge/circular-gauge-editor.ts",
  ];
  circularGaugeFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const insigniaFiles = [
    "src/cards/insignia/index.ts",
    "src/cards/insignia/insignia-card.ts",
    "src/cards/insignia/insignia-config.ts",
    "src/cards/insignia/insignia-types.ts",
    "src/cards/insignia/insignia-helpers.ts",
    "src/cards/insignia/insignia-editor.ts",
  ];
  insigniaFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const scenesFiles = [
    "src/cards/scenes/index.ts",
    "src/cards/scenes/scenes-card.ts",
    "src/cards/scenes/scenes-config.ts",
    "src/cards/scenes/scenes-types.ts",
    "src/cards/scenes/scenes-helpers.ts",
    "src/cards/scenes/scenes-editor.ts",
  ];
  scenesFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const newsFiles = [
    "src/cards/news/index.ts",
    "src/cards/news/news-card.ts",
    "src/cards/news/news-config.ts",
    "src/cards/news/news-types.ts",
    "src/cards/news/news-helpers.ts",
    "src/cards/news/news-editor.ts",
  ];
  newsFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const weatherFiles = [
    "src/cards/weather/index.ts",
    "src/cards/weather/weather-card.ts",
    "src/cards/weather/weather-config.ts",
    "src/cards/weather/weather-types.ts",
    "src/cards/weather/weather-helpers.ts",
    "src/cards/weather/weather-editor.ts",
  ];
  weatherFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const graphFiles = [
    "src/cards/graph/index.ts",
    "src/cards/graph/graph-card.ts",
    "src/cards/graph/graph-config.ts",
    "src/cards/graph/graph-types.ts",
    "src/cards/graph/graph-helpers.ts",
    "src/cards/graph/graph-editor.ts",
  ];
  graphFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const calendarFiles = [
    "src/cards/calendar/index.ts",
    "src/cards/calendar/calendar-card.ts",
    "src/cards/calendar/calendar-config.ts",
    "src/cards/calendar/calendar-types.ts",
    "src/cards/calendar/calendar-helpers.ts",
    "src/cards/calendar/calendar-editor.ts",
  ];
  calendarFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const powerFlowFiles = [
    "src/cards/power-flow/index.ts",
    "src/cards/power-flow/power-flow-card.ts",
    "src/cards/power-flow/power-flow-config.ts",
    "src/cards/power-flow/power-flow-types.ts",
    "src/cards/power-flow/power-flow-helpers.ts",
    "src/cards/power-flow/power-flow-editor.ts",
  ];
  powerFlowFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const notificationsFiles = [
    "src/cards/notifications/index.ts",
    "src/cards/notifications/notifications-card.ts",
    "src/cards/notifications/notifications-config.ts",
    "src/cards/notifications/notifications-types.ts",
    "src/cards/notifications/notifications-helpers.ts",
    "src/cards/notifications/notifications-editor.ts",
  ];
  notificationsFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const navigationFiles = [
    "src/cards/navigation/index.ts",
    "src/cards/navigation/navigation-card.ts",
    "src/cards/navigation/navigation-config.ts",
    "src/cards/navigation/navigation-types.ts",
    "src/cards/navigation/navigation-helpers.ts",
    "src/cards/navigation/navigation-editor.ts",
  ];
  navigationFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const roomSummaryFiles = [
    "src/cards/room-summary/index.ts",
    "src/cards/room-summary/room-summary-card.ts",
    "src/cards/room-summary/room-summary-config.ts",
    "src/cards/room-summary/room-summary-types.ts",
    "src/cards/room-summary/room-summary-helpers.ts",
    "src/cards/room-summary/room-summary-editor.ts",
  ];
  roomSummaryFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const advanceVacuumFiles = [
    "src/cards/advance-vacuum/index.ts",
    "src/cards/advance-vacuum/advance-vacuum-card.ts",
    "src/cards/advance-vacuum/advance-vacuum-config.ts",
    "src/cards/advance-vacuum/advance-vacuum-types.ts",
    "src/cards/advance-vacuum/advance-vacuum-helpers.ts",
    "src/cards/advance-vacuum/advance-vacuum-editor.ts",
  ];
  advanceVacuumFiles.forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  });
  const generatedClimate = read("nodalia-climate-card.js");
  assert.match(generatedClimate, /window\.__NODALIA_CLIMATE__/);
  assert.match(generatedClimate, /defineLazyCustomElement\(CARD_TAG, loadNodaliaClimateCard/);
  const generatedMedia = read("nodalia-media-player.js");
  assert.match(generatedMedia, /window\.__NODALIA_MEDIA_PLAYER__/);
  assert.match(generatedMedia, /defineLazyCustomElement\(CARD_TAG, loadNodaliaMediaPlayer/);
  const generatedLight = read("nodalia-light-card.js");
  assert.match(generatedLight, /window\.__NODALIA_LIGHT__/);
  assert.match(generatedLight, /defineLazyCustomElement\(CARD_TAG, loadNodaliaLightCard/);
  const generatedFan = read("nodalia-fan-card.js");
  assert.match(generatedFan, /window\.__NODALIA_FAN__/);
  assert.match(generatedFan, /defineLazyCustomElement\(CARD_TAG, loadNodaliaFanCard/);
  const generatedHumidifier = read("nodalia-humidifier-card.js");
  assert.match(generatedHumidifier, /window\.__NODALIA_HUMIDIFIER__/);
  assert.match(generatedHumidifier, /defineLazyCustomElement\(CARD_TAG, loadNodaliaHumidifierCard/);
  const generatedCover = read("nodalia-cover-card.js");
  assert.match(generatedCover, /window\.__NODALIA_COVER__/);
  assert.match(generatedCover, /defineLazyCustomElement\(CARD_TAG, loadNodaliaCoverCard/);
  const generatedAlarm = read("nodalia-alarm-panel-card.js");
  assert.match(generatedAlarm, /window\.__NODALIA_ALARM_PANEL__/);
  assert.match(generatedAlarm, /defineLazyCustomElement\(CARD_TAG, loadNodaliaAlarmPanelCard/);
  const generatedVacuum = read("nodalia-vacuum-card.js");
  assert.match(generatedVacuum, /window\.__NODALIA_VACUUM__/);
  assert.match(generatedVacuum, /defineLazyCustomElement\(CARD_TAG, loadNodaliaVacuumCard/);
  const generatedEntity = read("nodalia-entity-card.js");
  assert.match(generatedEntity, /window\.__NODALIA_ENTITY__/);
  assert.match(generatedEntity, /window\.__NODALIA_ENTITY_AIR_QUALITY__/);
  assert.match(generatedEntity, /defineLazyCustomElement\(CARD_TAG, loadNodaliaEntityCard/);
  const generatedFav = read("nodalia-fav-card.js");
  assert.match(generatedFav, /window\.__NODALIA_FAV__/);
  assert.match(generatedFav, /defineLazyCustomElement\(CARD_TAG, loadNodaliaFavCard/);
  const generatedPerson = read("nodalia-person-card.js");
  assert.match(generatedPerson, /window\.__NODALIA_PERSON__/);
  assert.match(generatedPerson, /defineLazyCustomElement\(CARD_TAG, loadNodaliaPersonCard/);
  const generatedCamera = read("nodalia-camera-card.js");
  assert.match(generatedCamera, /window\.__NODALIA_CAMERA__/);
  assert.match(generatedCamera, /defineLazyCustomElement\(CARD_TAG, loadNodaliaCameraCard/);
  const generatedGauge = read("nodalia-circular-gauge-card.js");
  assert.match(generatedGauge, /window\.__NODALIA_CIRCULAR_GAUGE__/);
  assert.match(generatedGauge, /defineLazyCustomElement\(CARD_TAG, loadNodaliaCircularGaugeCard/);
  const generatedInsignia = read("nodalia-insignia-card.js");
  assert.match(generatedInsignia, /window\.__NODALIA_INSIGNIA__/);
  assert.match(generatedInsignia, /defineLazyCustomElement\(CARD_TAG, loadNodaliaInsigniaCard/);
  const generatedScenes = read("nodalia-scenes-card.js");
  assert.match(generatedScenes, /window\.__NODALIA_SCENES__/);
  assert.match(generatedScenes, /defineLazyCustomElement\(CARD_TAG, loadNodaliaScenesCard/);
  const generatedNews = read("nodalia-news-card.js");
  assert.match(generatedNews, /window\.__NODALIA_NEWS__/);
  assert.match(generatedNews, /defineLazyCustomElement\(CARD_TAG, loadNodaliaNewsCard/);
  const generatedWeather = read("nodalia-weather-card.js");
  assert.match(generatedWeather, /window\.__NODALIA_WEATHER__/);
  assert.match(generatedWeather, /defineLazyCustomElement\(CARD_TAG, loadNodaliaWeatherCard/);
  const generatedGraph = read("nodalia-graph-card.js");
  assert.match(generatedGraph, /window\.__NODALIA_GRAPH__/);
  assert.match(generatedGraph, /defineLazyCustomElement\(CARD_TAG, loadNodaliaGraphCard/);
  const generatedCalendar = read("nodalia-calendar-card.js");
  assert.match(generatedCalendar, /window\.__NODALIA_CALENDAR__/);
  assert.match(generatedCalendar, /defineLazyCustomElement\(CARD_TAG, loadNodaliaCalendarCard/);
  const generatedPowerFlow = read("nodalia-power-flow-card.js");
  assert.match(generatedPowerFlow, /window\.__NODALIA_POWER_FLOW__/);
  assert.match(generatedPowerFlow, /defineLazyCustomElement\(CARD_TAG, loadNodaliaPowerFlowCard/);
  const generatedNotifications = read("nodalia-notifications-card.js");
  assert.match(generatedNotifications, /window\.__NODALIA_NOTIFICATIONS__/);
  assert.match(generatedNotifications, /defineLazyCustomElement\(CARD_TAG, loadNodaliaNotificationsCard/);
  const generatedNavigation = read("nodalia-navigation-bar.js");
  assert.match(generatedNavigation, /window\.__NODALIA_NAVIGATION__/);
  assert.match(generatedNavigation, /defineLazyCustomElement\(CARD_TAG, loadNodaliaNavigationBarCard/);
  const generatedRoomSummary = read("nodalia-room-summary-card.js");
  assert.match(generatedRoomSummary, /window\.__NODALIA_ROOM_SUMMARY__/);
  assert.match(generatedRoomSummary, /defineLazyCustomElement\(CARD_TAG, loadNodaliaRoomSummaryCard/);
  const generatedAdvanceVacuum = read("nodalia-advance-vacuum-card.js");
  assert.match(generatedAdvanceVacuum, /window\.__NODALIA_ADVANCE_VACUUM__/);
  assert.match(generatedAdvanceVacuum, /defineLazyCustomElement\(CARD_TAG, loadNodaliaAdvanceVacuumCard/);
  const standaloneBuild = read("scripts/build-src-cards.mjs");
  const hacsBuild = read("scripts/build-bundle.mjs");
  assert.match(standaloneBuild, /src\/cards\/climate\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/media-player\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/light\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/fan\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/humidifier\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/cover\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/alarm-panel\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/vacuum\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/entity\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/fav\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/person\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/camera\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/circular-gauge\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/insignia\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/scenes\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/news\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/weather\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/graph\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/calendar\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/power-flow\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/notifications\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/navigation\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/room-summary\/standalone\.ts/);
  assert.match(standaloneBuild, /src\/cards\/advance-vacuum\/standalone\.ts/);
  assert.match(hacsBuild, /src\/cards\/climate\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/media-player\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/light\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/fan\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/humidifier\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/cover\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/alarm-panel\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/vacuum\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/entity\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/fav\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/person\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/camera\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/circular-gauge\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/insignia\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/scenes\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/news\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/weather\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/graph\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/calendar\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/power-flow\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/notifications\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/navigation\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/room-summary\/index\.ts/);
  assert.match(hacsBuild, /src\/cards\/advance-vacuum\/index\.ts/);
});
