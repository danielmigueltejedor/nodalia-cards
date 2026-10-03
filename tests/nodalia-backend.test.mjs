import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "nodalia-backend.js"), "utf8");

function loadBackend(overrides = {}) {
  const sandbox = { console, window: null, ...overrides };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.NodaliaBackend;
}

test("backend bridge prefers API v3", () => {
  assert.equal(loadBackend().API_VERSION, 3);
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

test("backend bridge retries transient websocket timeouts instead of caching Engine-missing", async () => {
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

test("backend bridge keeps command-name timeouts transient", async () => {
  const backend = loadBackend();
  const calls = [];
  const hass = {
    async callWS() {
      calls.push(true);
      throw Object.assign(new Error("Timeout while calling nodalia/status"), { code: "timeout" });
    },
  };
  const first = await backend.status(hass, { silent: true });
  const second = await backend.status(hass, { silent: true });
  assert.equal(first.available, false);
  assert.equal(first.transient, true);
  assert.equal(second.transient, true);
  assert.equal(calls.length, 2, "mentioning nodalia/status must not make a timeout look like unknown_command");
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
  const first = await backend.status(hass, { silent: true });
  const second = await backend.status(hass, { silent: true });
  assert.equal(first.transient, false);
  assert.equal(second.transient, false);
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

test("backend bridge preserves transport receiver and prefers hass.callWS over connection fallback", async () => {
  const backend = loadBackend();
  const calls = [];
  const connection = { sendMessagePromise(message) { assert.equal(this, connection); calls.push(message.type); return Promise.resolve({}); } };
  await backend.listClimateSchedules({ connection });
  const hass = { connection, callWS(message) { assert.equal(this, hass); calls.push(message.type); return Promise.resolve({}); } };
  await backend.listNotificationProfiles(hass);
  assert.deepEqual(calls, ["nodalia/climate/schedule/list", "nodalia/notifications/list"]);
  await assert.rejects(backend.callWS(null, { type: "test" }), /WebSocket API is unavailable/);
});

test("backend bridge expires status at 30 seconds, honors force/reset and isolates connection identity", async () => {
  let now = 0;
  let calls = 0;
  const backend = loadBackend({ Date: { now: () => now } });
  const connection = {};
  const callWS = async () => { calls += 1; return { available: true, api_version: 2 }; };
  const hass = { connection, callWS };
  await backend.status(hass);
  now = 29_999;
  await backend.status(hass);
  assert.equal(calls, 1);
  now = 30_000;
  await backend.status(hass);
  assert.equal(calls, 2);
  await backend.status(hass, { force: true });
  assert.equal(calls, 3);
  backend.clearStatusCache();
  await backend.status(hass);
  assert.equal(calls, 4);
  await backend.status({ connection: {}, callWS });
  assert.equal(calls, 5);
});

test("backend bridge narrows malformed handshake branches without declaring unsupported capabilities", async () => {
  for (const response of [null, false, 7, [], "bad"]) {
    const value = await loadBackend().status({ callWS: async () => response });
    assert.equal(value.available, false);
    assert.equal(value.api_version, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(value.capabilities)), []);
  }
  const value = await loadBackend().status({ callWS: async () => ({ available: true, api_version: 2, capabilities: ["climate_schedules", 7, null], limits: [], health: false }) });
  assert.deepEqual(JSON.parse(JSON.stringify(value.capabilities)), ["climate_schedules"]);
  assert.deepEqual(JSON.parse(JSON.stringify(value.limits)), {});
  assert.deepEqual(JSON.parse(JSON.stringify(value.health)), {});
  assert.equal(loadBackend().hasCapability(value, "climate_schedules"), true);
});

test("generated backend adapter remains idempotent and does not require a DOM", () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  const first = sandbox.window.NodaliaBackend;
  assert.equal(Object.isFrozen(first), true);
  vm.runInContext(source, sandbox);
  assert.equal(sandbox.window.NodaliaBackend, first);
  assert.doesNotThrow(() => vm.runInNewContext(source, { console }));
});

test('backend negotiates v3 while older Engine connections retain v2 commands', async () => {
  const backend = loadBackend(), commands=[];
  const modern={connection:{}, callWS:async msg=>{commands.push(msg);return msg.type==='nodalia/status'?{available:true,api_version:3,api_min_version:1,api_max_version:3,capabilities:['notifications_preview','notifications_snooze','climate_schedule_preview','vacuum_sessions']}:{ok:true};}};
  const value=await backend.status(modern); assert.equal(value.negotiated_api_version,3);
  await backend.setNotificationProfile(modern,{enabled:false},'home');
  await backend.previewNotificationProfile(modern,{enabled:true},'home');
  await backend.snoozeNotification(modern,'rain:weather.home','2026-10-04T10:00:00Z','home');
  await backend.previewClimateSchedule(modern,'climate.room',{enabled:false,slots:[]},'2026-10-04T10:00:00Z');
  await backend.getVacuumSession(modern,'vacuum.robot');
  await backend.setVacuumSession(modern,'vacuum.robot',{repeats:1},0);
  assert.equal(commands[0].api_version,2); assert.ok(commands.slice(1).every(msg=>msg.api_version===3));
  assert.equal(commands.at(-1).expected_revision,0); assert.equal(commands[1].profile.enabled,false);
  const legacy={connection:{},callWS:async msg=>{commands.push(msg);return {available:true,api_version:2,capabilities:['notifications_background']};}};
  assert.equal((await backend.status(legacy)).negotiated_api_version,2);
  await backend.setNotificationProfile(legacy,{enabled:true},'home');assert.equal(commands.at(-1).api_version,2);
  const before=commands.length;await assert.rejects(backend.snoozeNotification(legacy,'rain','2026-10-04T10:00:00Z'),{code:'unsupported_capability'});assert.equal(commands.length,before);
});
test('backend declines a future-only Engine and never sends unavailable v3 commands',async()=>{
  const backend=loadBackend(),commands=[];const hass={callWS:async msg=>{commands.push(msg);return {available:true,api_version:4,api_min_version:4,api_max_version:4,capabilities:['vacuum_sessions']};}};
  assert.equal((await backend.status(hass)).available,false);
  await assert.rejects(backend.getVacuumSession(hass,'vacuum.robot'),{code:'unsupported_capability'});
  assert.equal(commands.length,1);
});
