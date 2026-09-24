import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadPowerFlowApi() {
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
  vm.runInContext(read("nodalia-power-flow-card.js"), sandbox);
  const api = sandbox.window.__NODALIA_POWER_FLOW__ || sandbox.__NODALIA_POWER_FLOW__;
  assert.ok(api, "power flow public API should be registered");
  return api;
}

test("power flow card registers custom element and bundle entry", () => {
  const source = read("nodalia-power-flow-card.js");
  assert.match(source, /defineLazyCustomElement\(CARD_TAG, loadNodaliaPowerFlowCard/);
  assert.match(source, /defineLazyCustomElement\(EDITOR_TAG, loadNodaliaPowerFlowCardVisualEditor/);
  assert.match(source, /window\.__NODALIA_POWER_FLOW__/);
  assert.match(read("scripts/build-bundle.mjs"), /src\/cards\/power-flow\/index\.ts/);
  assert.match(read("scripts/build-src-cards.mjs"), /src\/cards\/power-flow\/standalone\.ts/);
});

test("power flow public API normalizes entities and consumption chips", () => {
  const api = loadPowerFlowApi();
  assert.equal(api.CARD_TAG, "nodalia-power-flow-card");
  const config = api.normalizeConfig({
    entities: {
      grid: { entity: "sensor.grid_power" },
    },
    consumption_chips: {
      day_entity: "sensor.energy_today",
    },
  });
  assert.equal(config.entities.grid.entity, "sensor.grid_power");
  assert.equal(config.consumption_chips.day_entity, "sensor.energy_today");
  assert.equal(config.show_home_device_popup, true);
});
