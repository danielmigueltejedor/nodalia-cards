import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadCalendarApi() {
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
  vm.runInContext(read("nodalia-calendar-card.js"), sandbox);
  const api = sandbox.window.__NODALIA_CALENDAR__ || sandbox.__NODALIA_CALENDAR__;
  assert.ok(api, "calendar public API should be registered");
  return api;
}

test("calendar card registers custom element and bundle entry", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /defineLazyCustomElement\(CARD_TAG, loadNodaliaCalendarCard/);
  assert.match(source, /window\.__NODALIA_CALENDAR__/);
  assert.match(read("scripts/build-bundle.mjs"), /src\/cards\/calendar\/index\.ts/);
  assert.match(read("scripts/build-src-cards.mjs"), /src\/cards\/calendar\/standalone\.ts/);
});

test("calendar public API normalizes calendars and time range", () => {
  const api = loadCalendarApi();
  assert.equal(api.CARD_TAG, "nodalia-calendar-card");
  const config = api.normalizeConfig({
    calendars: ["calendar.family"],
    time_range: "2w",
  });
  assert.equal(config.calendars.length, 1);
  assert.equal(config.calendars[0].entity, "calendar.family");
  assert.equal(config.time_range, "2w");
  assert.equal(config.days_to_show, 14);
});
