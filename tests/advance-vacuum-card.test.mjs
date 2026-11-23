import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadAdvanceVacuumApi() {
  const sandbox = {
    URL,
    window: null,
    customElements: { define() {}, get() { return null; } },
    HTMLElement: class {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-advance-vacuum-card.js"), sandbox);
  const api = sandbox.window.__NODALIA_ADVANCE_VACUUM__ || sandbox.__NODALIA_ADVANCE_VACUUM__;
  assert.ok(api, "advance vacuum public API should be registered");
  return api;
}

test("advance vacuum card registers custom element and bundle entry", () => {
  const source = read("nodalia-advance-vacuum-card.js");
  assert.match(source, /(?:const|let|var) CARD_TAG = "nodalia-advance-vacuum-card"/);
  assert.match(source, /defineLazyCustomElement\(CARD_TAG, loadNodaliaAdvanceVacuumCard/);
  assert.match(source, /window\.__NODALIA_ADVANCE_VACUUM__/);
  assert.match(read("src/cards/registry.json"), /src\/cards\/advance-vacuum\/index\.ts/);
  assert.match(read("src/cards/registry.json"), /src\/cards\/advance-vacuum\/standalone\.ts/);
});

test("advance vacuum public API keeps map defaults and admin-only webhooks", () => {
  const api = loadAdvanceVacuumApi();
  assert.equal(api.CARD_TAG, "nodalia-advance-vacuum-card");
  const config = api.normalizeConfig({});
  assert.equal(config.vacuum_platform, "auto");
  assert.equal(config.room_tracking.auto_detect, true);
  assert.equal(config.security.allow_webhooks_for_non_admin, false);
  assert.equal(config.custom_menu.items.length, 0);
  assert.equal(config.routines.length, 0);
});

test("advance vacuum setConfig renders without missing helper imports", () => {
  const registry = new Map();
  class FakeHTMLElement {
    constructor() { this.isConnected = true; }
    attachShadow() {
      this.shadowRoot = {
        addEventListener() {}, removeEventListener() {}, innerHTML: "", get firstChild() { return this.innerHTML ? {} : null; }, replaceChildren() {this.innerHTML="";},
        querySelector() { return null; }, querySelectorAll() { return []; },
      };
      return this.shadowRoot;
    }
    dispatchEvent() { return true; }
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
    queueMicrotask,requestAnimationFrame(){return 0;},cancelAnimationFrame(){},setTimeout(){return 0;},clearTimeout(){},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-advance-vacuum-card.js"), sandbox);
  const Host = registry.get("nodalia-advance-vacuum-card");
  assert.ok(Host, "advance vacuum host should register");
  const card = new Host();
  card._commitPersistentVacuumShadow=markup=>{card.shadowRoot.innerHTML=markup;};
  assert.doesNotThrow(() => card.setConfig({ entity: "vacuum.test" }));
  card.hass = {
    language: "es",
    states: {
      "vacuum.test": {
        entity_id: "vacuum.test",
        state: "docked",
        attributes: { friendly_name: "Vac", battery_level: 80 },
      },
    },
    callService: async () => {},
    themes: {},
    config: {},
  };
  assert.ok(card.shadowRoot?.innerHTML?.length > 0);
});

test("advance vacuum calibrates goto coordinates from map_source.image", () => {
  const registry = new Map();
  class FakeHTMLElement {
    constructor() { this.isConnected = true; }
    attachShadow() {
      this.shadowRoot = {
        addEventListener() {}, removeEventListener() {}, innerHTML: "", get firstChild() { return this.innerHTML ? {} : null; }, replaceChildren() {this.innerHTML="";},
        querySelector() { return null; }, querySelectorAll() { return []; },
      };
      return this.shadowRoot;
    }
    dispatchEvent() { return true; }
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
    queueMicrotask,requestAnimationFrame(){return 0;},cancelAnimationFrame(){},setTimeout(){return 0;},clearTimeout(){},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-advance-vacuum-card.js"), sandbox);
  const Host = registry.get("nodalia-advance-vacuum-card");
  const card = new Host();
  card._commitPersistentVacuumShadow=markup=>{card.shadowRoot.innerHTML=markup;};
  const points = [
    { vacuum: [0, 0], map: [0, 0] },
    { vacuum: [2000, 0], map: [1000, 0] },
    { vacuum: [0, 2000], map: [0, 1000] },
  ];
  card.setConfig({
    entity: "vacuum.test",
    map_source: { image: "image.roborock_map" },
    calibration_source: { camera: true },
  });
  card.hass = {
    states: {
      "vacuum.test": { state: "docked", attributes: { friendly_name: "Vac" } },
      "image.roborock_map": { state: "ready", attributes: { entity_picture: "/map.png", calibration_points: points } },
    },
  };
  assert.equal(card._converter.calibrated, true);
  const mapped = card._converter.vacuumToMap(2000, 0);
  const command = card._converter.mapToVacuum(1000, 0);
  assert.ok(Math.abs(mapped.x - 1000) < 1e-6 && Math.abs(mapped.y) < 1e-6);
  assert.ok(Math.abs(command.x - 2000) < 1e-6 && Math.abs(command.y) < 1e-6);
  card.hass = {
    states: {
      "vacuum.test": { state: "docked", attributes: { friendly_name: "Vac" } },
      "image.roborock_map": {
        state: "ready",
        attributes: {
          entity_picture: "/map.png",
          calibration_points: [
            { vacuum: [0, 0], map: [0, 0] },
            { vacuum: [4000, 0], map: [1000, 0] },
            { vacuum: [0, 4000], map: [0, 1000] },
          ],
        },
      },
    },
  };
  const updated = card._converter.mapToVacuum(1000, 0);
  assert.ok(Math.abs(updated.x - 4000) < 1e-6 && Math.abs(updated.y) < 1e-6);
});
