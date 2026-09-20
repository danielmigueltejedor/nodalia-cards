import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadNavigationApi() {
  const sandbox = {
    URL,
    window: null,
    customElements: { define() {}, get() { return null; } },
    HTMLElement: class {},
    location: { origin: "http://localhost:8123", pathname: "/lovelace/home" },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-navigation-bar.js"), sandbox);
  const api = sandbox.window.__NODALIA_NAVIGATION__ || sandbox.__NODALIA_NAVIGATION__;
  assert.ok(api, "navigation public API should be registered");
  return api;
}

test("navigation card registers custom element and bundle entry", () => {
  const source = read("nodalia-navigation-bar.js");
  assert.match(source, /defineLazyCustomElement\(CARD_TAG, loadNodaliaNavigationBarCard/);
  assert.match(source, /window\.__NODALIA_NAVIGATION__/);
  assert.match(read("scripts/build-bundle.mjs"), /src\/cards\/navigation\/index\.ts/);
  assert.match(read("scripts/build-src-cards.mjs"), /src\/cards\/navigation\/standalone\.ts/);
});

test("navigation public API requires routes and keeps media player defaults", () => {
  const api = loadNavigationApi();
  assert.equal(api.CARD_TAG, "nodalia-navigation-bar");
  assert.throws(() => api.normalizeConfig({}), /"routes" is required/);
  const config = api.normalizeConfig({
    routes: [{ icon: "mdi:home", label: "Home", path: "/lovelace/home" }],
  });
  assert.equal(config.routes.length, 1);
  assert.equal(config.media_player.show_desktop, false);
  assert.equal(config.haptics.enabled, true);
});
