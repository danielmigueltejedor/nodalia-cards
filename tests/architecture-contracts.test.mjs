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
  class FakeElement {}
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
    console,
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
    const cardTag = source.match(/const CARD_TAG = "([^"]+)"/)?.[1];
    const editorTag = source.match(/const EDITOR_TAG = "([^"]+)"/)?.[1];
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
  assert.match(pkg.version, /^2\.0\.0-alpha\.\d+$/);
  assert.ok(pkg.files.includes("nodalia-notifications-mobile-policy.js"));
  assert.ok(pkg.files.includes("nodalia-room-summary-model.js"));
  assert.ok(pkg.files.includes("nodalia-camera-stream-model.js"));
});

test("card runtime metadata stays synchronized with package version", () => {
  const pkg = JSON.parse(read("package.json"));
  CARD_FILES.forEach(file => {
    const source = read(file);
    assert.match(
      source,
      new RegExp(`const CARD_VERSION = ${JSON.stringify(pkg.version).replaceAll(".", "\\.")}`),
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
    assert.match(source, new RegExp(`startsWith\\("${domain}\\."\\)`));
  }
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
});

test("service actions use the hardened strict default", () => {
  const { utils } = loadUtils();
  assert.equal(utils.normalizeSecurityConfig({}).strict_service_actions, true);
  assert.equal(utils.normalizeSecurityConfig({ strict_service_actions: false }).strict_service_actions, false);
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
