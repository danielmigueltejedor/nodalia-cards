import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadScheduleStorageApi() {
  const source = fs.readFileSync(path.join(root, "nodalia-climate-card.js"), "utf8");
  const start = source.indexOf("function parseScheduleClockMinutes");
  const end = source.indexOf("function normalizeSetpointScheduleWeekStartsOn(value)");
  assert.ok(start >= 0 && end > start, "schedule storage helpers should exist in climate card source");

  const sandbox = {
    SETPOINT_SCHEDULE_DAY_ORDER: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    SETPOINT_SCHEDULE_MINUTES_PER_DAY: 24 * 60,
    SETPOINT_SCHEDULE_STORAGE_VERSION: 1,
    SCHEDULE_MIN_BLOCK_MINUTES: 15,
    clamp: (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0)),
    isObject: value => value !== null && typeof value === "object" && !Array.isArray(value),
    createSetpointScheduleSlotId: () => "slot_generated",
  };

  vm.createContext(sandbox);
  vm.runInContext(source.slice(start, end), sandbox);
  return sandbox;
}

test("compact schedule storage shrinks input_text payload and round-trips", () => {
  const api = loadScheduleStorageApi();
  const schedule = {
    enabled: true,
    slots: [{
      id: "slot_mpockdj6_mj9u7",
      day: "mon",
      start: "02:20",
      end: "16:05",
      temperature: 21,
      enabled: true,
    }],
  };

  const legacy = JSON.stringify(schedule);
  const compact = api.encodeSetpointScheduleStorageState(schedule);
  assert.ok(compact.length < legacy.length, "compact storage should be shorter than legacy JSON");
  assert.equal(compact, '{"v":1,"s":[[0,140,965,21]]}');
  assert.ok(compact.length <= 255);

  const restored = api.decodeSetpointScheduleStorageState(compact);
  assert.equal(restored.enabled, true);
  assert.equal(restored.slots.length, 1);
  assert.equal(restored.slots[0].day, "mon");
  assert.equal(restored.slots[0].start, "02:20");
  assert.equal(restored.slots[0].end, "16:05");
  assert.equal(restored.slots[0].temperature, 21);
});

test("compact schedule storage still reads legacy JSON in input_text", () => {
  const api = loadScheduleStorageApi();
  const legacy = '{"enabled":true,"slots":[{"id":"slot_x","day":"mon","start":"08:00","end":"22:00","temperature":21,"enabled":true}]}';
  const restored = api.decodeSetpointScheduleStorageState(legacy);
  assert.equal(restored.slots[0].start, "08:00");
  assert.equal(restored.slots[0].temperature, 21);
});

test("many weekly slots fit within input_text 255 character limit", () => {
  const api = loadScheduleStorageApi();
  const slots = [];
  for (let day = 0; day < 7; day += 1) {
    slots.push({
      id: `slot_${day}_am`,
      day: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][day],
      start: "08:00",
      end: "12:00",
      temperature: 20,
      enabled: true,
    });
    slots.push({
      id: `slot_${day}_pm`,
      day: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][day],
      start: "18:00",
      end: "22:00",
      temperature: 22,
      enabled: true,
    });
  }

  const compact = api.encodeSetpointScheduleStorageState({ enabled: true, slots });
  assert.ok(compact.length <= 255, `expected <=255 chars, got ${compact.length}: ${compact}`);
});
