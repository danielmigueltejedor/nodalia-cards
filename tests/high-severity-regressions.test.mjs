import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadCardClass(fileName, tagName) {
  const registry = new Map();

  class FakeHTMLElement {
    constructor() {
      this.clientWidth = 360;
      this.isConnected = true;
      this.shadowRoot = null;
    }

    addEventListener() {}

    removeEventListener() {}

    attachShadow() {
      this.shadowRoot = {
        activeElement: null,
        addEventListener() {},
        innerHTML: "",
        querySelector() { return null; },
        querySelectorAll() { return []; },
      };
      return this.shadowRoot;
    }

    closest() {
      return null;
    }

    dispatchEvent(event) {
      this.lastDispatchedEvent = event;
      return true;
    }
  }

  class FakeHTMLInputElement extends FakeHTMLElement {
    focus() {}
  }

  class FakeHTMLButtonElement extends FakeHTMLElement {}

  const sandbox = {
    cancelAnimationFrame: clearTimeout,
    clearInterval,
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
    Event: class {
      constructor(type) {
        this.type = type;
      }
    },
    HTMLElement: FakeHTMLElement,
    HTMLButtonElement: FakeHTMLButtonElement,
    HTMLInputElement: FakeHTMLInputElement,
    localStorage: {
      getItem() { return null; },
      setItem() {},
    },
    location: { href: "", origin: "https://example.invalid" },
    navigator: { language: "en-US" },
    requestAnimationFrame(callback) {
      return setTimeout(() => callback(Date.now()), 0);
    },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    setInterval,
    setTimeout,
    window: null,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-i18n.js"), sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-render-signature.js"), sandbox);
  vm.runInContext(read(fileName), sandbox);
  return registry.get(tagName);
}

function createHass(states, calls = []) {
  return {
    states,
    callService(domain, service, data) {
      calls.push({ domain, service, data });
      return Promise.resolve(true);
    },
  };
}

test("fav card auto tap uses cover domain services instead of generic toggle", () => {
  const FavCard = loadCardClass("nodalia-fav-card.js", "nodalia-fav-card");
  const calls = [];
  const state = {
    entity_id: "cover.garage",
    state: "closed",
    attributes: { friendly_name: "Garage", supported_features: 0 },
  };
  const card = new FavCard();

  card.setConfig({ entity: "cover.garage", tap_action: "auto" });
  card.hass = createHass({ "cover.garage": state }, calls);
  card._performPrimaryAction(state);

  assert.deepEqual(calls, [
    { domain: "cover", service: "open_cover", data: { entity_id: "cover.garage" } },
  ]);
});

test("fav card coerces Lovelace tap_action objects before dispatching lock toggles", () => {
  const FavCard = loadCardClass("nodalia-fav-card.js", "nodalia-fav-card");
  const calls = [];
  const state = {
    entity_id: "lock.gate",
    state: "locked",
    attributes: { friendly_name: "Gate", supported_features: 1 },
  };
  const card = new FavCard();

  card.setConfig({ entity: "lock.gate", tap_action: { action: "toggle" } });
  card.hass = createHass({ "lock.gate": state }, calls);
  card._performPrimaryAction(state);

  assert.equal(card._config.tap_action, "toggle");
  assert.deepEqual(calls, [
    { domain: "lock", service: "open", data: { entity_id: "lock.gate" } },
  ]);
});

test("alarm panel keeps manual PIN watchdog after resolved no-op service calls", async () => {
  const AlarmCard = loadCardClass("nodalia-alarm-panel-card.js", "nodalia-alarm-panel-card");
  const calls = [];
  const initial = {
    entity_id: "alarm_control_panel.home",
    state: "disarmed",
    last_changed: "2026-06-14T10:00:00.000Z",
    attributes: { code_format: "number", supported_features: 3 },
  };
  const card = new AlarmCard();

  card.setConfig({
    entity: "alarm_control_panel.home",
    show_code_input: true,
    wrong_code_feedback_ms: 2000,
  });
  card.hass = createHass({ "alarm_control_panel.home": initial }, calls);
  card._codeInput = "1234";
  card._runAlarmAction("alarm_arm_away");

  await new Promise(resolve => setTimeout(resolve, 0));

  assert.deepEqual(calls, [
    {
      domain: "alarm_control_panel",
      service: "alarm_arm_away",
      data: { entity_id: "alarm_control_panel.home", code: "1234" },
    },
  ]);
  assert.ok(card._pinVerifyWatch, "watchdog should remain armed until the alarm state changes");

  card.hass = createHass({
    "alarm_control_panel.home": {
      ...initial,
      state: "arming",
      last_changed: "2026-06-14T10:00:01.000Z",
    },
  });
  assert.equal(card._pinVerifyWatch, null);
});
