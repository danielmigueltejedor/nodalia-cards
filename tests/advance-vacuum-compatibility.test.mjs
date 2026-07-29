import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadAdvanceVacuumCard() {
  const registry = new Map();
  class FakeHTMLElement {
    attachShadow() {
      this.shadowRoot = {
        addEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        innerHTML: "",
      };
      return this.shadowRoot;
    }

    dispatchEvent() {
      return true;
    }
  }

  const storage = new Map();
  const sandbox = {
    clearTimeout,
    console,
    CustomEvent: class {},
    customElements: {
      define(name, klass) { registry.set(name, klass); },
      get(name) { return registry.get(name); },
      whenDefined() { return Promise.resolve(); },
    },
    document: {
      createElement() { return {}; },
      documentElement: { getAttribute() { return ""; } },
      querySelector() { return null; },
    },
    HTMLElement: FakeHTMLElement,
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); },
      removeItem(key) { storage.delete(key); },
    },
    navigator: {},
    queueMicrotask,
    setTimeout,
    window: null,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-advance-vacuum-card.js"), sandbox);
  return registry.get("nodalia-advance-vacuum-card");
}

function createCard({ platform = "auto", states = {}, entities = {}, areas = {}, services = {} } = {}) {
  const Card = loadAdvanceVacuumCard();
  const calls = [];
  const card = new Card();
  card._config = {
    entity: "vacuum.robot",
    vacuum_platform: platform,
    vacuum_mqtt_topic: "",
    room_segments: [],
    room_tracking: { entity: "", attribute: "", auto_detect: true },
    map_source: { camera: "camera.robot_map" },
  };
  card._hass = {
    states,
    entities,
    areas,
    services,
    callService(domain, service, data, target) {
      calls.push({ domain, service, data, target });
      return Promise.resolve();
    },
  };
  card._getRoomSegments = () => [
    { id: "12", label: "Salón" },
    { id: "15", label: "Baño" },
  ];
  return { card, calls };
}

test("advanced vacuum routes room cleaning through Dreame and Xiaomi profiles", async () => {
  const dreame = createCard({ platform: "Tasshack/dreame-vacuum" });
  await dreame.card._callRoomCleaningService(["12", "15"], 2);
  assert.deepEqual(JSON.parse(JSON.stringify(dreame.calls[0])), {
    domain: "dreame_vacuum",
    service: "vacuum_clean_segment",
    data: { entity_id: "vacuum.robot", segments: [12, 15], repeats: 2 },
  });

  const xiaomi = createCard({ platform: "Xiaomi Miio" });
  await xiaomi.card._callRoomCleaningService(["12", "15"], 2);
  assert.deepEqual(JSON.parse(JSON.stringify(xiaomi.calls[0].data.segments)), [12, 15, 12, 15]);
  assert.equal(xiaomi.calls[0].domain, "xiaomi_miio");
});

test("advanced vacuum preserves string room ids and never falls through to whole-house start", async () => {
  const { card, calls } = createCard({ platform: "Roborock" });
  card._activeMode = "rooms";
  card._selectedRoomIds = ["living_room", "bathroom-main"];
  card._repeats = 1;

  await card._runMapAction();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].domain, "vacuum");
  assert.equal(calls[0].service, "send_command");
  assert.equal(calls[0].data.command, "app_segment_clean");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].data.params)), [{
    segments: ["living_room", "bathroom-main"],
    repeat: 1,
  }]);
});

test("advanced vacuum rejects an invalid rooms selection instead of starting the whole house", async () => {
  const { card, calls } = createCard({ platform: "Roborock" });
  card._activeMode = "rooms";
  card._selectedRoomIds = ["", "   "];
  card._repeats = 1;

  await assert.rejects(
    card._runMapAction(),
    /Selecciona al menos una habitación válida/,
  );
  assert.deepEqual(calls, []);
});

test("advanced vacuum honors compatible map_modes service schemas", async () => {
  const { card, calls } = createCard({ platform: "Dreame" });
  card._config.map_modes = [{
    template: "vacuum_clean_segment",
    service_call_schema: {
      service: "dreame_vacuum.vacuum_clean_segment",
      service_data: {
        entity_id: "[[entity_id]]",
        segments: "[[selection]]",
        repeats: "[[repeats]]",
      },
    },
  }];

  await card._callRoomCleaningService(["12", "15"], 2);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].data)), {
    entity_id: "vacuum.robot",
    segments: [12, 15],
    repeats: 2,
  });
});

test("advanced vacuum does not treat another platform's map service as a built-in action", async () => {
  const { card, calls } = createCard({ platform: "Roborock" });
  card._config.map_modes = [{
    template: "vacuum_clean_segment",
    service_call_schema: {
      service: "dreame_vacuum.vacuum_clean_segment",
      service_data: {
        entity_id: "[[entity_id]]",
        segments: "[[selection]]",
      },
    },
  }];

  await assert.rejects(card._callRoomCleaningService(["12"], 1), /blocked by security policy/);
  assert.equal(calls.length, 0);
});

test("advanced vacuum reads Dreame active_segments and auto-detected current room", () => {
  const states = {
    "vacuum.robot": { state: "cleaning", attributes: {} },
    "camera.robot_map": { state: "idle", attributes: { active_segments: [12, 15] } },
    "sensor.robot_current_room": {
      state: "Baño",
      last_updated: "2026-07-29T10:00:00Z",
      attributes: { room_id: 15, friendly_name: "Robot current room" },
    },
  };
  const entities = {
    "vacuum.robot": { device_id: "device-1", platform: "dreame_vacuum" },
    "sensor.robot_current_room": { device_id: "device-1", platform: "dreame_vacuum" },
  };
  const { card } = createCard({ states, entities });

  assert.deepEqual([...card._getReportedCleaningRoomIds()].sort(), ["12", "15"]);
  assert.equal(card._getCurrentVacuumRoomId(), "15");
});

test("advanced vacuum keeps a live room session during a mop-wash interlude", () => {
  const states = {
    "vacuum.robot": { state: "docked", attributes: {} },
    "camera.robot_map": { state: "idle", attributes: { active_segments: [12, 15] } },
    "sensor.robot_self_wash_base_status": {
      state: "washing",
      last_updated: "2026-07-29T10:00:00Z",
      attributes: {},
    },
  };
  const entities = {
    "vacuum.robot": { device_id: "device-1", platform: "dreame_vacuum" },
    "sensor.robot_self_wash_base_status": { device_id: "device-1", platform: "dreame_vacuum" },
  };
  const { card } = createCard({ states, entities });

  assert.equal(card._isWashingMops(states["vacuum.robot"]), true);
  assert.equal(card._isCleaningSessionActive(states["vacuum.robot"], null), true);
});

test("advanced vacuum does not treat an idle current-room sensor as an active task", () => {
  const states = {
    "vacuum.robot": { state: "docked", attributes: {} },
    "camera.robot_map": { state: "idle", attributes: {} },
    "sensor.robot_current_room": {
      state: "Salón",
      attributes: { room_id: 12 },
    },
  };
  const entities = {
    "vacuum.robot": { device_id: "device-1", platform: "dreame_vacuum" },
    "sensor.robot_current_room": { device_id: "device-1", platform: "dreame_vacuum" },
  };
  const { card } = createCard({ states, entities });
  card._activeCleaningRoomIds = ["12"];
  card._syncActiveCleaningSession(states["vacuum.robot"]);

  assert.deepEqual(JSON.parse(JSON.stringify(card._activeCleaningRoomIds)), []);
});

test("Matter/Home Assistant room actions resolve room names to HA cleaning areas", async () => {
  const { card, calls } = createCard({
    platform: "Matter",
    areas: {
      living_room: { area_id: "living_room", name: "Salón" },
      bathroom: { area_id: "bathroom", name: "Baño" },
    },
  });
  await card._callRoomCleaningService(["12", "15"], 1);

  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), {
    domain: "vacuum",
    service: "clean_area",
    data: { cleaning_area_id: ["living_room", "bathroom"] },
    target: { entity_id: "vacuum.robot" },
  });
});

test("live area identifiers map back to configured room highlights", () => {
  const { card } = createCard({ platform: "Matter" });
  card._config.room_segments = [
    { id: "12", label: "Salón", area_id: "living_room" },
    { id: "15", label: "Baño", area_id: "bathroom" },
  ];
  card._getRoomSegments = () => [
    { id: "12", label: "Salón" },
    { id: "15", label: "Baño" },
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(card._normalizeReportedRoomIds(["bathroom"]))), ["15"]);
});

test("Roborock prefers native clean_area when HA mappings are available", async () => {
  const { card, calls } = createCard({
    platform: "Roborock",
    states: {
      "vacuum.robot": { state: "idle", attributes: { supported_features: 16384 } },
    },
    areas: {
      living_room: { area_id: "living_room", name: "Salón" },
      bathroom: { area_id: "bathroom", name: "Baño" },
    },
    services: { vacuum: { clean_area: {} } },
  });
  await card._callRoomCleaningService(["12", "15"], 1);
  assert.equal(calls[0].service, "clean_area");
});

test("Roborock does not infer clean_area support from another vacuum's global service", async () => {
  const { card, calls } = createCard({
    platform: "Roborock",
    states: {
      "vacuum.robot": { state: "idle", attributes: { supported_features: 8192 } },
    },
    areas: {
      living_room: { area_id: "living_room", name: "Salón" },
      bathroom: { area_id: "bathroom", name: "Baño" },
    },
    services: { vacuum: { clean_area: {} } },
  });
  await card._callRoomCleaningService(["12", "15"], 1);
  assert.equal(calls[0].service, "send_command");
  assert.equal(calls[0].data.command, "app_segment_clean");
});

test("current Ecovacs integration uses the standard Home Assistant clean-area profile", () => {
  const { card } = createCard({
    platform: "auto",
    entities: { "vacuum.robot": { platform: "ecovacs", device_id: "device-1" } },
  });
  assert.equal(card._getVacuumPlatformProfile(), "home_assistant");
  assert.equal(card._supportsMapActionKind("zone"), false);
  assert.equal(card._supportsMapActionKind("goto"), false);
});

test("go-to mode is exposed only when the selected platform supports it", () => {
  const roborock = createCard({ platform: "Roborock" }).card;
  roborock._config.show_all_mode = true;
  roborock._config.allow_goto_mode = true;
  roborock._getRoutineItems = () => [];
  assert.equal(roborock._getAvailableModes().some(mode => mode.id === "goto"), true);

  const matter = createCard({ platform: "Matter" }).card;
  matter._config.show_all_mode = true;
  matter._config.allow_goto_mode = true;
  matter._getRoutineItems = () => [];
  assert.equal(matter._getAvailableModes().some(mode => mode.id === "goto"), false);
});

test("advanced vacuum render signature tracks auxiliary live room entities", () => {
  const source = read("nodalia-advance-vacuum-card.js");
  assert.match(source, /prefix: "room-track:"/);
  assert.match(source, /mapState\?\.attributes\?\.active_segments/);
  assert.match(source, /_callRoomCleaningService\(roomIds, this\._repeats\)/);
  assert.match(source, /_callZoneCleaningService\(selectedZones, this\._repeats\)/);
  assert.match(source, /_callGotoService\(this\._gotoPoint\)/);
});

test("advanced vacuum editor keeps platform selection compact and Valetudo-specific", () => {
  const source = read("nodalia-advance-vacuum-card.js");
  assert.match(source, /\.editor-grid \{\n\s+align-items: start;/);
  assert.match(source, /\.editor-field select \{[\s\S]*height: 40px;[\s\S]*padding-inline-end: 36px;/);
  assert.match(source, /"send_command", label: "Generic send_command" \},\n\s+\], \{ fullWidth: true \}\)/);
  assert.match(source, /normalizeTextKey\(config\.vacuum_platform \|\| "auto"\)\.includes\("valetudo"\)/);
});
