import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadLightCardClass() {
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
    navigator: { language: "en-US" },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    setTimeout,
    window: null,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-i18n.js"), sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-light-card.js"), sandbox);
  return registry.get("nodalia-light-card");
}

test("light card re-renders when optimistic turn-off is confirmed with unchanged signature", () => {
  const LightCard = loadLightCardClass();
  const card = new LightCard();
  card.setConfig({ entity: "light.living" });

  const onState = {
    entity_id: "light.living",
    state: "on",
    attributes: {
      friendly_name: "Living",
      brightness: 180,
      supported_color_modes: ["brightness"],
    },
  };

  const offState = {
    ...onState,
    state: "off",
  };

  card.hass = { states: { "light.living": onState } };

  card._startOptimisticTurnOff(onState);
  const signatureWhileOptimistic = card._getRenderSignature();
  card._lastRenderSignature = signatureWhileOptimistic;

  assert.equal(card._optimisticTurnOff?.entityId, "light.living");

  let renderCount = 0;
  const originalRender = card._render.bind(card);
  card._render = () => {
    renderCount += 1;
    return originalRender();
  };

  card.hass = { states: { "light.living": offState } };

  assert.equal(card._optimisticTurnOff, null);
  assert.equal(card._getRenderSignature(), signatureWhileOptimistic);
  assert.ok(renderCount >= 1, "expected a confirmation render after optimistic turn-off cleared");
});
