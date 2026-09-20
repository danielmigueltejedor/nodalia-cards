import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("lazy custom elements keep unused card classes nested until first instance", () => {
  const utils = read("nodalia-utils.js");
  const climate = read("nodalia-climate-card.js");
  const bundle = read("nodalia-cards.js");

  assert.match(utils, /function defineLazyCustomElement\(/);
  assert.match(climate, /function loadNodaliaClimateCard\(/);
  assert.match(climate, /function loadNodaliaClimateCardEditor\(/);
  assert.match(climate, /_nodaliaConstruct\(\)/);
  assert.match(climate, /defineLazyCustomElement\(CARD_TAG, loadNodaliaClimateCard/);
  assert.match(bundle, /defineLazyCustomElement/);
});

test("lazy host upgrades on first instance without compiling sibling cards", () => {
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
    CustomEvent: class {},
    customElements: {
      define(name, klass) { registry.set(name, klass); },
      get(name) { return registry.get(name); },
    },
    HTMLElement: FakeHTMLElement,
    document: {
      createElement() { return {}; },
      documentElement: { getAttribute() { return ""; } },
      querySelector() { return null; },
    },
    window: null,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-climate-card.js"), sandbox);

  const Host = registry.get("nodalia-climate-card");
  assert.equal(Host.name, "NodaliaLazyHost");
  const card = new Host();
  assert.equal(typeof card.setConfig, "function");
  assert.equal(typeof card._nodaliaConstruct, "function");
  assert.ok(card.shadowRoot);
});

test("runtime i18n keeps unused locale packs as factories", () => {
  const source = read("nodalia-i18n.js");
  assert.match(source, /en: function \(\) \{\s*return \{/);
  assert.match(source, /es: function \(\) \{\s*return \{/);
  assert.match(source, /function localePack\(/);
});
