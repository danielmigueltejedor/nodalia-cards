import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadNotificationsApi() {
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
  vm.runInContext(read("nodalia-notifications-mobile-policy.js"), sandbox);
  vm.runInContext(read("nodalia-notifications-card.js"), sandbox);
  const api = sandbox.window.__NODALIA_NOTIFICATIONS__ || sandbox.__NODALIA_NOTIFICATIONS__;
  assert.ok(api, "notifications public API should be registered");
  return api;
}

test("notifications card registers custom element and bundle entry", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(source, /defineLazyCustomElement\(CARD_TAG, loadNodaliaNotificationsCard/);
  assert.match(source, /window\.__NODALIA_NOTIFICATIONS__/);
  assert.match(source, /__NODALIA_NOTIFICATIONS_TEMPLATES__/);
  assert.match(source, /__NODALIA_NOTIFICATIONS_MOBILE__/);
  assert.match(read("scripts/build-bundle.mjs"), /src\/cards\/notifications\/index\.ts/);
  assert.match(read("scripts/build-src-cards.mjs"), /src\/cards\/notifications\/standalone\.ts/);
});

test("notifications public API normalizes entity lists and mobile defaults", () => {
  const api = loadNotificationsApi();
  assert.equal(api.CARD_TAG, "nodalia-notifications-card");
  const config = api.normalizeConfig({
    calendar_entities: "calendar.family",
    mobile_notifications: { enabled: true },
  });
  assert.equal(config.calendar_entities.length, 1);
  assert.equal(config.calendar_entities[0], "calendar.family");
  assert.equal(config.mobile_notifications.enabled, true);
  assert.equal(config.mobile_notifications.default_policy, "auto");
});
