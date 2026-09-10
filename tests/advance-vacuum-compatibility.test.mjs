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

function createDockedVacuumCard({ entity, states = {}, entities = {} } = {}) {
  const { card, calls } = createCard({
    states: {
      [entity]: {
        entity_id: entity,
        state: "docked",
        attributes: { friendly_name: entity },
      },
      ...states,
    },
    entities,
  });
  card._config.entity = entity;
  return { card, calls };
}

test("advanced vacuum dock controls stay on the configured vacuum when multiple robots exist", () => {
  const states = {
    "button.roborock_qrevo_start_emptying": { state: "unknown", attributes: {} },
    "button.roborock_s8_start_emptying": { state: "unknown", attributes: {} },
    "button.roborock_qrevo_start_wash_mop": { state: "unknown", attributes: {} },
    "button.roborock_s8_start_wash_mop": { state: "unknown", attributes: {} },
    "select.roborock_qrevo_empty_mode": {
      state: "smart",
      attributes: { options: ["smart", "fast", "max"] },
    },
    "select.roborock_s8_empty_mode": {
      state: "smart",
      attributes: { options: ["smart", "fast", "max"] },
    },
    "vacuum.roborock_qrevo": { state: "docked", attributes: {} },
    "vacuum.roborock_s8": { state: "docked", attributes: {} },
  };

  const s8 = createDockedVacuumCard({ entity: "vacuum.roborock_s8", states });
  s8.card._runDockControlAction("empty");
  s8.card._runDockControlAction("wash");
  s8.card._setDockSettingOption("empty_mode", "fast");

  assert.deepEqual(s8.calls.map(call => [call.domain, call.service, call.data.entity_id, call.data.option]), [
    ["button", "press", "button.roborock_s8_start_emptying", undefined],
    ["button", "press", "button.roborock_s8_start_wash_mop", undefined],
    ["select", "select_option", "select.roborock_s8_empty_mode", "fast"],
  ]);

  const qrevo = createDockedVacuumCard({ entity: "vacuum.roborock_qrevo", states });
  qrevo.card._runDockControlAction("empty");
  assert.equal(qrevo.calls[0]?.domain, "button");
  assert.equal(qrevo.calls[0]?.service, "press");
  assert.equal(qrevo.calls[0]?.data?.entity_id, "button.roborock_qrevo_start_emptying");
});

test("advanced vacuum dock discovery does not let a shorter vacuum id steal a longer sibling helper", () => {
  const states = {
    "button.roborock_s8_pro_start_emptying": { state: "unknown", attributes: {} },
    "button.roborock_s8_start_emptying": { state: "unknown", attributes: {} },
    "vacuum.roborock_s8": { state: "docked", attributes: {} },
    "vacuum.roborock_s8_pro": { state: "docked", attributes: {} },
  };

  const s8 = createDockedVacuumCard({ entity: "vacuum.roborock_s8", states });
  s8.card._runDockControlAction("empty");
  assert.equal(s8.calls[0]?.data?.entity_id, "button.roborock_s8_start_emptying");

  const s8Pro = createDockedVacuumCard({ entity: "vacuum.roborock_s8_pro", states });
  s8Pro.card._runDockControlAction("empty");
  assert.equal(s8Pro.calls[0]?.data?.entity_id, "button.roborock_s8_pro_start_emptying");
});

test("advanced vacuum dock discovery can use the vacuum device id when names do not include the object id", () => {
  const { card, calls } = createDockedVacuumCard({
    entity: "vacuum.roborock_s8",
    states: {
      "button.start_dust_collection": { state: "unknown", attributes: {} },
      "vacuum.roborock_s8": { state: "docked", attributes: {} },
      "vacuum.roborock_qrevo": { state: "docked", attributes: {} },
    },
    entities: {
      "vacuum.roborock_s8": { device_id: "s8-device" },
      "button.start_dust_collection": { device_id: "s8-device" },
      "vacuum.roborock_qrevo": { device_id: "qrevo-device" },
    },
  });

  card._runDockControlAction("empty");
  assert.equal(calls[0]?.data?.entity_id, "button.start_dust_collection");
});

test("advanced vacuum dock discovery keeps a unique unscoped helper on a single-vacuum home", () => {
  const { card, calls } = createDockedVacuumCard({
    entity: "vacuum.roborock_s8",
    states: {
      "button.start_dust_collection": { state: "unknown", attributes: {} },
      "vacuum.roborock_s8": { state: "docked", attributes: {} },
    },
  });

  card._runDockControlAction("empty");
  assert.equal(calls[0]?.data?.entity_id, "button.start_dust_collection");
});

test("advanced vacuum dock discovery does not press another robot's unscoped helper", () => {
  const { card, calls } = createDockedVacuumCard({
    entity: "vacuum.roborock_s8",
    states: {
      "button.start_dust_collection": { state: "unknown", attributes: {} },
      "vacuum.roborock_s8": { state: "docked", attributes: {} },
      "vacuum.roborock_qrevo": { state: "docked", attributes: {} },
    },
  });

  card._runDockControlAction("empty");
  assert.equal(calls.length, 0);
});

function createSiblingRoborockHome() {
  const states = {
    "vacuum.roborock_s8": { entity_id: "vacuum.roborock_s8", state: "docked", attributes: {} },
    "vacuum.roborock_s8_pro": { entity_id: "vacuum.roborock_s8_pro", state: "cleaning", attributes: {} },
    "camera.roborock_s8_map": { state: "idle", attributes: {} },
    "sensor.roborock_s8_cleaning_status": {
      state: "idle",
      attributes: { friendly_name: "S8 cleaning status" },
    },
    "sensor.roborock_s8_pro_cleaning_status": {
      state: "room_cleaning",
      attributes: { friendly_name: "S8 Pro cleaning status" },
    },
    "sensor.roborock_s8_pro_current_room": {
      state: "Kitchen",
      attributes: { room_id: 22, friendly_name: "S8 Pro current room" },
    },
  };
  const entities = {
    "vacuum.roborock_s8": { device_id: "s8-device", platform: "roborock" },
    "vacuum.roborock_s8_pro": { device_id: "s8-pro-device", platform: "roborock" },
    "sensor.roborock_s8_cleaning_status": { device_id: "s8-device", platform: "roborock" },
    "sensor.roborock_s8_pro_cleaning_status": { device_id: "s8-pro-device", platform: "roborock" },
    "sensor.roborock_s8_pro_current_room": { device_id: "s8-pro-device", platform: "roborock" },
  };
  const { card, calls } = createCard({
    platform: "Roborock",
    states,
    entities,
  });
  card._config.entity = "vacuum.roborock_s8";
  card._config.map_source = { camera: "camera.roborock_s8_map" };
  card._roomTrackingEntityCache = null;
  return { card, calls, states };
}

test("advanced vacuum ignores a longer sibling robot's activity when starting rooms", async () => {
  const { card, calls, states } = createSiblingRoborockHome();
  const related = card._getRelatedVacuumEntityIds();

  assert.deepEqual(JSON.parse(JSON.stringify(related.activityIds)), ["sensor.roborock_s8_cleaning_status"]);
  assert.equal(related.roomIds.includes("sensor.roborock_s8_pro_current_room"), false);
  assert.equal(card._isCleaning(states["vacuum.roborock_s8"]), false);
  assert.equal(card._isPaused(states["vacuum.roborock_s8"]), false);

  card._activeMode = "rooms";
  card._selectedRoomIds = ["living_room"];
  card._repeats = 1;
  await card._runMapAction();

  assert.equal(calls.length, 1, "docked S8 must not inherit S8 Pro cleaning and send pause");
  assert.equal(calls[0].service, "send_command");
  assert.equal(calls[0].data.command, "app_segment_clean");
  assert.equal(calls[0].data.entity_id, "vacuum.roborock_s8");
});

function siblingRoborockStates(extra = {}) {
  return {
    "vacuum.roborock_s8": {
      entity_id: "vacuum.roborock_s8",
      state: "docked",
      attributes: { friendly_name: "Roborock S8" },
    },
    "vacuum.roborock_s8_pro": {
      entity_id: "vacuum.roborock_s8_pro",
      state: "cleaning",
      attributes: { friendly_name: "Roborock S8 Pro" },
    },
    "select.roborock_s8_water_level": {
      entity_id: "select.roborock_s8_water_level",
      state: "medium",
      attributes: { options: ["off", "low", "medium", "high"] },
    },
    "select.roborock_s8_pro_water_level": {
      entity_id: "select.roborock_s8_pro_water_level",
      state: "low",
      attributes: { options: ["off", "low", "medium", "high"] },
    },
    "select.roborock_s8_fan_speed": {
      entity_id: "select.roborock_s8_fan_speed",
      state: "balanced",
      attributes: { options: ["quiet", "balanced", "turbo"] },
    },
    "select.roborock_s8_pro_fan_speed": {
      entity_id: "select.roborock_s8_pro_fan_speed",
      state: "turbo",
      attributes: { options: ["quiet", "balanced", "turbo"] },
    },
    ...extra,
  };
}

test("advance vacuum mop and suction selects stay on the configured robot when a sibling prefix exists", () => {
  const { card, calls } = createCard({ states: siblingRoborockStates() });
  card._config.entity = "vacuum.roborock_s8";

  assert.equal(card._guessRelatedSelectEntity("mop"), "select.roborock_s8_water_level");
  assert.equal(card._guessRelatedSelectEntity("suction"), "select.roborock_s8_fan_speed");

  card._setModeOption("mop", "high");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].domain, "select");
  assert.equal(calls[0].service, "select_option");
  assert.equal(calls[0].data.entity_id, "select.roborock_s8_water_level");
  assert.equal(calls[0].data.option, "high");
});

test("advance vacuum mop-mode select stays on the configured robot when a sibling prefix exists", () => {
  const { card, calls } = createCard({
    states: siblingRoborockStates({
      "select.roborock_s8_mop_intensity": {
        entity_id: "select.roborock_s8_mop_intensity",
        state: "medium",
        attributes: { options: ["off", "low", "medium", "high"] },
      },
      "select.roborock_s8_mop_mode": {
        entity_id: "select.roborock_s8_mop_mode",
        state: "standard",
        attributes: { options: ["standard", "deep"] },
      },
      "select.roborock_s8_pro_mop_mode": {
        entity_id: "select.roborock_s8_pro_mop_mode",
        state: "deep",
        attributes: { options: ["standard", "deep"] },
      },
    }),
  });
  card._config.entity = "vacuum.roborock_s8";

  assert.equal(
    card._guessRelatedSelectEntityByPatterns(card._getMopModeEntityPatterns()),
    "select.roborock_s8_mop_mode",
  );

  card._setModeOption("mop_mode", "deep");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.entity_id, "select.roborock_s8_mop_mode");
  assert.equal(calls[0].data.option, "deep");
});

test("advance vacuum does not prefer a sibling's higher-scoring mop helper", () => {
  const states = siblingRoborockStates();
  delete states["select.roborock_s8_pro_water_level"];
  states["select.roborock_s8_pro_mop_intensity"] = {
    entity_id: "select.roborock_s8_pro_mop_intensity",
    state: "high",
    attributes: { options: ["off", "low", "medium", "high"] },
  };
  const { card, calls } = createCard({ states });
  card._config.entity = "vacuum.roborock_s8";

  assert.equal(card._guessRelatedSelectEntity("mop"), "select.roborock_s8_water_level");
  card._setModeOption("mop", "low");
  assert.equal(calls[0]?.data?.entity_id, "select.roborock_s8_water_level");
});

test("advance vacuum still binds mop helpers that share the vacuum device_id", () => {
  const states = siblingRoborockStates();
  const entities = {
    "vacuum.roborock_s8": { device_id: "s8-device" },
    "vacuum.roborock_s8_pro": { device_id: "pro-device" },
    "select.roborock_s8_water_level": { device_id: "s8-device" },
    "select.roborock_s8_pro_water_level": { device_id: "pro-device" },
  };
  const { card } = createCard({ states, entities });
  card._config.entity = "vacuum.roborock_s8";
  assert.equal(card._guessRelatedSelectEntity("mop"), "select.roborock_s8_water_level");

  card._config.entity = "vacuum.roborock_s8_pro";
  assert.equal(card._guessRelatedSelectEntity("mop"), "select.roborock_s8_pro_water_level");
});

test("advanced vacuum editor keeps platform selection compact and Valetudo-specific", () => {
  const source = read("nodalia-advance-vacuum-card.js");
  assert.match(source, /\.editor-grid \{\n\s+align-items: start;/);
  assert.match(source, /\.editor-field select \{[\s\S]*height: 40px;[\s\S]*padding-inline-end: 36px;/);
  assert.match(source, /"send_command", label: "Generic send_command" \},\n\s+\], \{ fullWidth: true \}\)/);
  assert.match(source, /normalizeTextKey\(config\.vacuum_platform \|\| "auto"\)\.includes\("valetudo"\)/);
});
