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

test("backend bridge targets API v2", () => {
  assert.equal(loadBackend().API_VERSION, 2);
});

test("backend bridge detects the matching native API and caches status", async () => {
  const backend = loadBackend();
  const calls = [];
  const hass = {
    async callWS(message) {
      calls.push(message);
      return {
        available: true,
        api_version: 2,
        api_min_version: 1,
        api_max_version: 2,
        version: "2.1.0",
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
  assert.equal(calls[0].api_version, 2);
});

test("backend bridge treats a v1-only server as unavailable for the v2 client", async () => {
  const backend = loadBackend();
  const status = await backend.status({
    async callWS() {
      return { available: true, api_version: 1, api_min_version: 1, api_max_version: 1, capabilities: [] };
    },
  });
  assert.equal(status.available, false);
});

test("backend bridge treats missing commands as an optional unavailable backend", async () => {
  const backend = loadBackend();
  const status = await backend.status({
    callWS() {
      return Promise.reject(Object.assign(new Error("Unknown command nodalia/status"), { code: "unknown_command" }));
    },
  });
  assert.equal(status.available, false);
  assert.equal(status.transient, false);
  assert.deepEqual(JSON.parse(JSON.stringify(status.health)), {});
});

test("backend bridge does not cache transient websocket errors as Engine-missing", async () => {
  const backend = loadBackend();
  const calls = [];
  const hass = {
    async callWS() {
      calls.push(true);
      throw Object.assign(new Error("WebSocket timeout"), { code: "timeout" });
    },
  };
  const first = await backend.status(hass, { silent: true });
  const second = await backend.status(hass, { silent: true });
  assert.equal(first.available, false);
  assert.equal(first.transient, true);
  assert.equal(second.transient, true);
  assert.equal(calls.length, 2, "transient failures must be retried instead of cached as unavailable");
});

test("backend bridge does not treat command-name timeouts as Engine-missing", async () => {
  const backend = loadBackend();
  const status = await backend.status({
    async callWS() {
      throw Object.assign(new Error("Timeout waiting for nodalia/status"), { code: "timeout" });
    },
  }, { silent: true });
  assert.equal(status.available, false);
  assert.equal(status.transient, true);
});

test("backend bridge caches a confirmed missing Engine", async () => {
  const backend = loadBackend();
  const calls = [];
  const hass = {
    callWS() {
      calls.push(true);
      return Promise.reject(Object.assign(new Error("Unknown command nodalia/status"), { code: "unknown_command" }));
    },
  };
  await backend.status(hass, { silent: true });
  await backend.status(hass, { silent: true });
  assert.equal(calls.length, 1);
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
      api_version: 2,
      profile_id: "kitchen",
      profile: { enabled: true },
    },
    {
      type: "nodalia/climate/schedule/set",
      api_version: 2,
      entity_id: "climate.kitchen",
      schedule: { enabled: true, slots: [] },
    },
  ]);
});

test("backend bridge accepts a server range that still supports client API v2", async () => {
  const backend = loadBackend();
  const status = await backend.status({
    async callWS() {
      return {
        available: true,
        api_version: 2,
        api_min_version: 1,
        api_max_version: 3,
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
      api_version: 2,
      profile_id: "security",
      alert_id: "camera-door",
    },
    {
      type: "nodalia/climate/schedule/apply",
      api_version: 2,
      entity_id: "climate.kitchen",
    },
  ]);
});

test("backend bridge exposes the v2 discovery, inbox and override commands", async () => {
  const backend = loadBackend();
  for (const name of [
    "getEditorEngineStatus",
    "listNotificationProfiles",
    "listNotificationInbox",
    "clearNotificationInbox",
    "listClimateSchedules",
    "setClimateOverride",
    "clearClimateOverride",
  ]) {
    assert.equal(typeof backend[name], "function", `missing backend.${name}`);
  }

  const calls = [];
  const hass = { callWS: message => { calls.push(message); return Promise.resolve({}); } };
  await backend.listNotificationProfiles(hass);
  await backend.listNotificationInbox(hass, "security");
  await backend.clearNotificationInbox(hass, "security");
  await backend.listClimateSchedules(hass);
  await backend.setClimateOverride(hass, "climate.kitchen", { until: "2026-01-01T10:00:00+00:00", temperature: 21 });
  await backend.clearClimateOverride(hass, "climate.kitchen");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { type: "nodalia/notifications/list", api_version: 2 },
    { type: "nodalia/notifications/inbox/list", api_version: 2, profile_id: "security" },
    { type: "nodalia/notifications/inbox/clear", api_version: 2, profile_id: "security" },
    { type: "nodalia/climate/schedule/list", api_version: 2 },
    {
      type: "nodalia/climate/override/set",
      api_version: 2,
      entity_id: "climate.kitchen",
      override: { until: "2026-01-01T10:00:00+00:00", temperature: 21 },
    },
    { type: "nodalia/climate/override/clear", api_version: 2, entity_id: "climate.kitchen" },
  ]);
});

test("backend bridge summarizes engine health and capabilities for card editors", async () => {
  const backend = loadBackend();
  const engine = await backend.getEditorEngineStatus({
    async callWS() {
      return {
        available: true,
        api_version: 2,
        api_min_version: 1,
        api_max_version: 2,
        version: "2.1.0",
        capabilities: [
          "notifications_background",
          "notifications_inbox",
          "climate_schedules",
          "climate_overrides",
        ],
        health: { profile_count: 2, schedule_count: 3, inbox_count: 7, override_count: 1 },
      };
    },
  });
  assert.equal(engine.available, true);
  assert.equal(engine.version, "2.1.0");
  assert.deepEqual(JSON.parse(JSON.stringify(engine.caps)), {
    notificationsBackground: true,
    climateSchedules: true,
    notificationsInbox: true,
    climateOverrides: true,
  });
  assert.equal(engine.health.profile_count, 2);
  assert.equal(engine.health.inbox_count, 7);
});

test("backend bridge reports no engine capabilities when the integration is missing", async () => {
  const backend = loadBackend();
  const engine = await backend.getEditorEngineStatus({
    callWS() {
      return Promise.reject(Object.assign(new Error("Unknown command nodalia/status"), { code: "unknown_command" }));
    },
  });
  assert.equal(engine.available, false);
  assert.deepEqual(JSON.parse(JSON.stringify(engine.caps)), {
    notificationsBackground: false,
    climateSchedules: false,
    notificationsInbox: false,
    climateOverrides: false,
  });
});
