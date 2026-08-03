import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "nodalia-backend.js"), "utf8");

function loadBackend() {
  const sandbox = { console, window: null };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.NodaliaBackend;
}

test("backend bridge detects the matching native API and caches status", async () => {
  const backend = loadBackend();
  const calls = [];
  const hass = {
    async callWS(message) {
      calls.push(message);
      return {
        available: true,
        api_version: 1,
        version: "2.0.0-alpha.56",
        capabilities: ["notifications_background", "climate_schedules"],
      };
    },
  };
  const first = await backend.status(hass);
  const second = await backend.status(hass);
  assert.equal(first.available, true);
  assert.deepEqual(first.capabilities, ["notifications_background", "climate_schedules"]);
  assert.equal(second.available, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].api_version, 1);
});

test("backend bridge treats missing commands as an optional unavailable backend", async () => {
  const backend = loadBackend();
  const status = await backend.status({
    callWS() {
      return Promise.reject(Object.assign(new Error("Unknown command nodalia/status"), { code: "unknown_command" }));
    },
  });
  assert.equal(status.available, false);
});

test("backend bridge sends versioned profile and schedule mutations", async () => {
  const backend = loadBackend();
  const calls = [];
  const hass = { callWS: message => { calls.push(message); return Promise.resolve({}); } };
  await backend.setNotificationProfile(hass, { enabled: true }, "kitchen");
  await backend.setClimateSchedule(hass, "climate.kitchen", { enabled: true, slots: [] });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    {
      type: "nodalia/notifications/set",
      api_version: 1,
      profile_id: "kitchen",
      profile: { enabled: true },
    },
    {
      type: "nodalia/climate/schedule/set",
      api_version: 1,
      entity_id: "climate.kitchen",
      schedule: { enabled: true, slots: [] },
    },
  ]);
});

test("backend bridge accepts a server range that still supports client API v1", async () => {
  const backend = loadBackend();
  const status = await backend.status({
    async callWS() {
      return {
        available: true,
        api_version: 2,
        api_min_version: 1,
        api_max_version: 2,
        capabilities: ["climate_schedule_apply"],
        limits: { climate_schedules: 128 },
      };
    },
  });
  assert.equal(status.available, true);
  assert.equal(backend.hasCapability(status, "climate_schedule_apply"), true);
  assert.equal(status.limits.climate_schedules, 128);
});

test("backend bridge exposes external alerts and immediate schedule application", async () => {
  const backend = loadBackend();
  const calls = [];
  const hass = { callWS: message => { calls.push(message); return Promise.resolve({}); } };
  await backend.sendExternalNotification(hass, "camera-door", "security");
  await backend.applyClimateSchedule(hass, "climate.kitchen");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    {
      type: "nodalia/notifications/send_external",
      api_version: 1,
      profile_id: "security",
      alert_id: "camera-door",
    },
    {
      type: "nodalia/climate/schedule/apply",
      api_version: 1,
      entity_id: "climate.kitchen",
    },
  ]);
});
