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
    SETPOINT_SCHEDULE_STORAGE_VERSION_PACKED: 2,
    SETPOINT_SCHEDULE_STORAGE_VERSION_BINARY: 3,
    SETPOINT_SCHEDULE_INPUT_TEXT_MAX: 255,
    SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM: 5,
    SCHEDULE_TIMELINE_SNAP_MINUTES: 5,
    SCHEDULE_MIN_BLOCK_MINUTES: 15,
    clamp: (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0)),
    isObject: value => value !== null && typeof value === "object" && !Array.isArray(value),
    createSetpointScheduleSlotId: () => "slot_generated",
    btoa: value => Buffer.from(value, "binary").toString("base64"),
    atob: value => Buffer.from(value, "base64").toString("binary"),
    Buffer,
  };

  vm.createContext(sandbox);
  vm.runInContext(source.slice(start, end), sandbox);
  return sandbox;
}

function buildWeeklySlots(blocksPerDay = 2) {
  const slots = [];
  for (let day = 0; day < 7; day += 1) {
    for (let block = 0; block < blocksPerDay; block += 1) {
      slots.push({
        id: `slot_${day}_${block}`,
        day: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][day],
        start: block === 0 ? "08:00" : "18:00",
        end: block === 0 ? "12:00" : "22:00",
        temperature: block === 0 ? 20 : 22,
        enabled: true,
      });
    }
  }
  return slots;
}

test("schedule storage prefers v3 binary and round-trips", () => {
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
  const parsed = JSON.parse(compact);
  assert.ok(parsed.v === 2 || parsed.v === 3, `expected v2 or v3, got v${parsed.v}`);
  assert.ok(compact.length <= 255);

  const restored = api.decodeSetpointScheduleStorageState(compact);
  assert.equal(restored.enabled, true);
  assert.equal(restored.slots.length, 1);
  assert.equal(restored.slots[0].day, "mon");
  assert.equal(restored.slots[0].start, "02:20");
  assert.equal(restored.slots[0].end, "16:05");
  assert.equal(restored.slots[0].temperature, 21);
});

test("schedule storage still reads legacy verbose JSON and v1 arrays", () => {
  const api = loadScheduleStorageApi();
  const legacy = '{"enabled":true,"slots":[{"id":"slot_x","day":"mon","start":"08:00","end":"22:00","temperature":21,"enabled":true}]}';
  const v1 = '{"v":1,"s":[[0,480,1320,21]]}';
  assert.equal(api.decodeSetpointScheduleStorageState(legacy).slots[0].start, "08:00");
  assert.equal(api.decodeSetpointScheduleStorageState(v1).slots[0].temperature, 21);
});

test("fourteen weekly blocks fit within input_text 255 character limit", () => {
  const api = loadScheduleStorageApi();
  const compact = api.encodeSetpointScheduleStorageState({ enabled: true, slots: buildWeeklySlots(2) });
  assert.ok(compact.length <= 255, `expected <=255 chars, got ${compact.length}: ${compact}`);
  assert.equal(JSON.parse(compact).v, 3, "fourteen blocks should use v3 binary");
});

test("forty weekly blocks fit within input_text 255 character limit", () => {
  const api = loadScheduleStorageApi();
  const slots = [];
  for (let day = 0; day < 7; day += 1) {
    for (let block = 0; block < 40 / 7 | 0; block += 1) {
      const start = (6 + block * 3) % 24;
      slots.push({
        id: `slot_${day}_${block}`,
        day: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][day],
        start: `${String(start).padStart(2, "0")}:00`,
        end: `${String(Math.min(start + 2, 23)).padStart(2, "0")}:30`,
        temperature: 19 + (block % 4),
        enabled: true,
      });
    }
  }
  while (slots.length < 40) {
    slots.push({
      id: `slot_extra_${slots.length}`,
      day: "sun",
      start: "20:00",
      end: "22:00",
      temperature: 21,
      enabled: true,
    });
  }

  const compact = api.encodeSetpointScheduleStorageState({ enabled: true, slots: slots.slice(0, 40) });
  assert.ok(compact.length <= 255, `expected <=255 chars for 40 slots, got ${compact.length}: ${compact}`);
  const restored = api.decodeSetpointScheduleStorageState(compact);
  assert.equal(restored.slots.length, 40);
});

test("forty-five weekly blocks exceed input_text limit and are detectable", () => {
  const api = loadScheduleStorageApi();
  const slots = buildWeeklySlots(7);
  assert.equal(slots.length, 49);
  const compact = api.encodeSetpointScheduleStorageState({ enabled: true, slots: slots.slice(0, 45) });
  assert.ok(compact.length > 255, `expected >255 chars for 45 slots, got ${compact.length}`);
  assert.equal(api.isSetpointScheduleStorageStateWithinLimit(compact), false);
});
