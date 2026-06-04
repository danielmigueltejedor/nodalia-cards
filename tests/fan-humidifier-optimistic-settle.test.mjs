import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadDeviceCardClass(fileName, tagName) {
  const registry = new Map();

  class FakeHTMLElement {
    constructor() {
      this.isConnected = true;
    }

    addEventListener() {}

    removeEventListener() {}

    attachShadow() {
      this.shadowRoot = {
        addEventListener() {},
        innerHTML: "<div></div>",
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
    localStorage: {
      _data: new Map(),
      getItem(key) { return this._data.get(key) ?? null; },
      setItem(key, value) { this._data.set(key, String(value)); },
    },
    navigator: {},
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    setTimeout,
    window: null,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read(fileName), sandbox);
  return registry.get(tagName);
}

test("fan card re-renders when optimistic visual settle expires with zero percentage", async () => {
  const FanCard = loadDeviceCardClass("nodalia-fan-card.js", "nodalia-fan-card");
  const card = new FanCard();
  card.setConfig({ entity: "fan.living" });

  const hass = {
    states: {
      "fan.living": {
        entity_id: "fan.living",
        state: "on",
        attributes: { percentage: 0 },
      },
    },
  };

  card.hass = hass;
  card._optimisticVisualSettle = {
    entityId: "fan.living",
    expiresAt: Date.now() + 80,
    stateSnapshot: {
      entity_id: "fan.living",
      state: "on",
      attributes: { percentage: 42 },
    },
  };
  card._scheduleOptimisticVisualSettleTimeout();
  card._lastRenderSignature = card._getRenderSignature();

  assert.equal(Number(card._getState()?.attributes?.percentage), 42);

  let renderCount = 0;
  const originalRender = card._render.bind(card);
  card._render = () => {
    renderCount += 1;
    return originalRender();
  };

  await new Promise(resolve => setTimeout(resolve, 120));

  assert.ok(renderCount >= 1, "expected a forced render after visual settle expiry");
  assert.equal(card._optimisticVisualSettle, null);
  assert.equal(Number(card._getState()?.attributes?.percentage), 0);
});

test("humidifier card re-renders when optimistic visual settle expires with zero humidity", async () => {
  const HumidifierCard = loadDeviceCardClass("nodalia-humidifier-card.js", "nodalia-humidifier-card");
  const card = new HumidifierCard();
  card.setConfig({ entity: "humidifier.bedroom" });

  const hass = {
    states: {
      "humidifier.bedroom": {
        entity_id: "humidifier.bedroom",
        state: "on",
        attributes: { humidity: 0, target_humidity: 0 },
      },
    },
  };

  card.hass = hass;
  card._optimisticVisualSettle = {
    entityId: "humidifier.bedroom",
    expiresAt: Date.now() + 80,
    stateSnapshot: {
      entity_id: "humidifier.bedroom",
      state: "on",
      attributes: { humidity: 55, target_humidity: 55 },
    },
  };
  card._scheduleOptimisticVisualSettleTimeout();
  card._lastRenderSignature = card._getRenderSignature();

  assert.equal(Number(card._getState()?.attributes?.target_humidity), 55);

  let renderCount = 0;
  const originalRender = card._render.bind(card);
  card._render = () => {
    renderCount += 1;
    return originalRender();
  };

  await new Promise(resolve => setTimeout(resolve, 120));

  assert.ok(renderCount >= 1, "expected a forced render after visual settle expiry");
  assert.equal(card._optimisticVisualSettle, null);
  assert.equal(Number(card._getState()?.attributes?.target_humidity), 0);
});

test("humidifier render signature tracks mode_entity helper state", () => {
  const HumidifierCard = loadDeviceCardClass("nodalia-humidifier-card.js", "nodalia-humidifier-card");
  const card = new HumidifierCard();
  card.setConfig({
    entity: "humidifier.bedroom",
    mode_entity: "input_select.humidifier_mode",
  });

  const baseHass = {
    states: {
      "humidifier.bedroom": {
        entity_id: "humidifier.bedroom",
        state: "on",
        attributes: { humidity: 40, target_humidity: 45, mode: "normal" },
      },
      "input_select.humidifier_mode": {
        entity_id: "input_select.humidifier_mode",
        state: "auto",
        attributes: { options: ["auto", "away", "boost"] },
      },
    },
  };

  const signatureAuto = card._getRenderSignature(baseHass);
  const signatureAway = card._getRenderSignature({
    states: {
      ...baseHass.states,
      "input_select.humidifier_mode": {
        ...baseHass.states["input_select.humidifier_mode"],
        state: "away",
      },
    },
  });

  assert.notEqual(signatureAuto, signatureAway);
  assert.match(signatureAuto, /"modeEntityState":"auto"/);
  assert.match(signatureAway, /"modeEntityState":"away"/);
});
