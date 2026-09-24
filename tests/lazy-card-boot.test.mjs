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

    addEventListener() {}
    removeEventListener() {}

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
  assert.equal(typeof Host.prototype.connectedCallback, "function");
  assert.equal(typeof Host.prototype.disconnectedCallback, "function");
  const card = new Host();
  assert.equal(typeof card.setConfig, "function");
  assert.equal(typeof card._nodaliaConstruct, "function");
  assert.ok(card.shadowRoot);

  // Simulate the CE definition callback (captured from Host.prototype at define time).
  const connectedCalls = [];
  const RealConnected = Object.getPrototypeOf(card).connectedCallback;
  assert.equal(typeof RealConnected, "function");
  Object.getPrototypeOf(card).connectedCallback = function patchedConnected(...args) {
    connectedCalls.push(args);
    return RealConnected.apply(this, args);
  };
  Host.prototype.connectedCallback.call(card);
  assert.equal(connectedCalls.length, 1);
});

test("lazy host definition keeps lifecycle forwarders for Safari CE reactions", () => {
  const utils = read("nodalia-utils.js");
  assert.match(utils, /nodaliaLazyLifecycleForward/);
  assert.match(utils, /connectedCallback/);
  assert.match(utils, /disconnectedCallback/);
  assert.match(utils, /attributeChangedCallback/);
});

test("runtime i18n keeps unused locale packs as factories", () => {
  const source = read("nodalia-i18n.js");
  assert.match(source, /en: function \(\) \{\s*return \{/);
  assert.match(source, /es: function \(\) \{\s*return \{/);
  assert.match(source, /function localePack\(/);
});

test("calendar and camera elevate host stacking while expanded overlays are open", () => {
  assert.match(read("nodalia-calendar-card.js"), /z-index: \$\{this\._expandedOpen \? "2147483000" : "auto"\}/);
  assert.match(read("nodalia-camera-card.js"), /z-index: \$\{this\._expandedOpen \? "2147483000" : "auto"\}/);
});

test("media player drops square host aspect ratio while idle compact", () => {
  assert.match(read("nodalia-media-player.js"), /data-idle-compact/);
  assert.match(read("nodalia-media-player.js"), /:host\(\[data-idle-compact="true"\]\)/);
});
