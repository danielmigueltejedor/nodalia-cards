import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadTemplateHelpers() {
  const sandbox = {
    URL,
    window: { NodaliaUtils: {} },
    customElements: { define() {}, get() { return null; } },
    HTMLElement: class {},
    globalThis: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-notifications-mobile-policy.js"), sandbox);
  vm.runInContext(read("nodalia-notifications-card.js"), sandbox);
  return sandbox.__NODALIA_NOTIFICATIONS_TEMPLATES__;
}

const templates = loadTemplateHelpers();
const hass = {
  states: {
    "media_player.nest_audio": {
      state: "playing",
      last_changed: "2026-07-21T17:25:00Z",
      attributes: {
        friendly_name: "Nest Audio",
        media_title: "One More Time",
        media_artist: "Daft Punk",
      },
    },
    "calendar.mealie_diner": {
      state: "on",
      attributes: {
        friendly_name: "Mealie dinner",
        message: "Vegetable lasagne",
      },
    },
    "sensor.energy_price": {
      state: "0.18",
      attributes: {
        friendly_name: "Energy price",
        unit_of_measurement: " EUR/kWh",
      },
    },
    "fan.living_room": {
      state: "off",
      attributes: { friendly_name: "Living room fan" },
    },
  },
};

test("custom notification context exposes standard variables and entity attributes", () => {
  const values = templates.customNotificationTemplateValues(hass, {
    entity: "media_player.nest_audio",
    attribute: "media_title",
    value: "playing",
  }, "fan.living_room");

  assert.equal(values.source, "Nest Audio");
  assert.equal(values.value, "One More Time");
  assert.equal(values.threshold, "playing");
  assert.equal(values.fan, "Living room fan");
  assert.equal(values.media_title, "One More Time");
  assert.equal(values.media_artist, "Daft Punk");
  assert.ok(values.time);
  assert.equal(
    templates.formatNotificationTemplate(
      "{source} is playing {media_title} by {media_artist}.",
      hass,
      values,
    ),
    "Nest Audio is playing One More Time by Daft Punk.",
  );
});

test("custom templates resolve additional Home Assistant entity references", () => {
  assert.equal(
    templates.formatNotificationTemplate(
      "{media_player.nest_audio}: {media_player.nest_audio.media_title}",
      hass,
    ),
    "Nest Audio: One More Time",
  );
  assert.equal(
    templates.formatNotificationTemplate("Today's dinner is {calendar.mealie_diner}.", hass),
    "Today's dinner is Vegetable lasagne.",
  );
  assert.equal(
    templates.formatNotificationTemplate(
      "Price {sensor.energy_price}; raw {sensor.energy_price.state}",
      hass,
    ),
    "Price 0.18 EUR/kWh; raw 0.18",
  );
});

test("template entity references are extracted for render tracking", () => {
  assert.deepEqual(
    Array.from(templates.referencedNotificationTemplateEntities(
      "{source} {sensor.energy_price} {media_player.nest_audio.media_title} {sensor.energy_price.state}",
    )),
    ["sensor.energy_price", "media_player.nest_audio"],
  );
});
