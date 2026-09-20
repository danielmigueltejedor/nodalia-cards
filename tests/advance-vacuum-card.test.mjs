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
  assert.match(read("scripts/build-bundle.mjs"), /src\/cards\/advance-vacuum\/index\.ts/);
  assert.match(read("scripts/build-src-cards.mjs"), /src\/cards\/advance-vacuum\/standalone\.ts/);
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
