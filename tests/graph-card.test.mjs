import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadGraphApi() {
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
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-graph-card.js"), sandbox);
  const api = sandbox.window.__NODALIA_GRAPH__ || sandbox.__NODALIA_GRAPH__;
  assert.ok(api, "graph public API should be registered");
  return api;
}

test("graph card registers custom element and bundle entry", () => {
  const source = read("nodalia-graph-card.js");
  assert.match(source, /defineLazyCustomElement\(CARD_TAG, loadNodaliaGraphCard/);
  assert.match(source, /window\.__NODALIA_GRAPH__/);
  assert.match(read("scripts/build-bundle.mjs"), /src\/cards\/graph\/index\.ts/);
  assert.match(read("scripts/build-src-cards.mjs"), /src\/cards\/graph\/standalone\.ts/);
});

test("graph public API normalizes entity series", () => {
  const api = loadGraphApi();
  assert.equal(api.CARD_TAG, "nodalia-graph-card");
  const config = api.normalizeConfig({
    entity: "sensor.temperature",
    name: "Temp",
  });
  assert.equal(config.entities.length, 1);
  assert.equal(config.entities[0].entity, "sensor.temperature");
  assert.equal(config.hold_action, "more-info");
});
