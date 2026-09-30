import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";

const pure = { Date };
vm.createContext(pure);
vm.runInContext(buildSync({ entryPoints: ["src/cards/notifications/notifications-mobile-policy.ts"], bundle: true, write: false, format: "iife", globalName: "source" }).outputFiles[0].text, pure);
const api = pure.source.notificationsMobilePolicy;
const plain = value => JSON.parse(JSON.stringify(value));
const keys = ["MOBILE_POLICY_VALUES", "BACKGROUND_MOBILE_MAX_CHUNKS", "MOBILE_DELIVERY_STATES", "MOBILE_COOLDOWN_STORAGE_KEY", "normalizeMobilePolicy", "resolveSmartEntityMobilePolicy", "backgroundMobilePayloadOverLimit", "normalizeSmartEntityMobile", "normalizeSmartEntityOverrideMobile", "isExplicitSmartEntityMobile", "isWithinQuietHours", "getNextQuietHoursBoundaryDelay", "normalizeQuietHours", "normalizeMobileContext", "resolvePresenceOccupancy", "passesPresenceContext", "buildMobileAlertIdentity", "buildMobileGroupIdentity", "resolveMobileDeliveryState", "legacyMobilePolicyLabel"].sort();

test("Notifications policy source needs no DOM/HA globals and publishes the existing frozen API", () => {
  assert.equal(pure.window, undefined);
  assert.deepEqual(Object.keys(api).sort(), keys);
  assert.equal(Object.isFrozen(api), true);
  const ctx = { window: {}, Date };
  vm.createContext(ctx);
  const artifact = fs.readFileSync("nodalia-notifications-mobile-policy.js", "utf8");
  vm.runInContext(artifact, ctx);
  const first = ctx.window.NodaliaNotificationsMobilePolicy;
  assert.deepEqual(Object.keys(first).sort(), keys);
  assert.equal(Object.isFrozen(first), true);
  vm.runInContext(artifact, ctx);
  assert.equal(ctx.window.NodaliaNotificationsMobilePolicy, first);
});

test("Notifications policy narrows malformed public payloads and keeps empty defaults", () => {
  for (const value of [null, false, 42, [], "bad"]) {
    assert.equal(api.buildMobileAlertIdentity(value), "");
    assert.equal(api.buildMobileGroupIdentity(value), "");
    assert.equal(api.backgroundMobilePayloadOverLimit(value), false);
    assert.deepEqual(plain(api.normalizeQuietHours(value)), { enabled: false, start: "23:00", end: "08:00", allow_critical: true });
    assert.equal(api.resolveMobileDeliveryState(value), "blocked_by_severity");
    assert.equal(api.resolvePresenceOccupancy(value, "person.one"), null);
  }
  assert.equal(api.backgroundMobilePayloadOverLimit({ chunk_count: "41" }), true);
  assert.equal(api.backgroundMobilePayloadOverLimit({ chunk_count: 40 }), false);
  assert.equal(api.normalizeMobilePolicy({ policy: { policy: true } }), "push");
});

test("Notifications quiet-hour scheduling keeps exact boundaries and skips disabled/invalid windows", () => {
  const quiet = { enabled: true, start: "23:00", end: "08:00", allow_critical: true };
  assert.equal(api.getNextQuietHoursBoundaryDelay(quiet, new Date(2026, 0, 15, 22, 59, 30)), 30_000);
  assert.equal(api.getNextQuietHoursBoundaryDelay(quiet, new Date(2026, 0, 15, 23, 0)), 9 * 60 * 60 * 1000);
  assert.equal(api.isWithinQuietHours(quiet, new Date(2026, 0, 15, 23, 0)), true);
  assert.equal(api.isWithinQuietHours(quiet, new Date(2026, 0, 16, 8, 0)), false);
  for (const value of [null, { enabled: false }, { enabled: true, start: "25:00", end: "08:00" }, { enabled: true, start: "08:00", end: "08:00" }]) assert.equal(api.getNextQuietHoursBoundaryDelay(value), null);
  assert.equal(api.getNextQuietHoursBoundaryDelay(quiet, "invalid date"), null);
});

test("Notifications presence handles known HA aliases, unknown states and absent/malformed entities", () => {
  for (const value of ["home", "on", "occupied", "present"]) assert.equal(api.resolvePresenceOccupancy({ states: { "person.one": { state: value } } }, "person.one"), "home");
  for (const value of ["not_home", "off", "absent", "away"]) assert.equal(api.resolvePresenceOccupancy({ states: { "person.one": { state: value } } }, "person.one"), "away");
  assert.equal(api.resolvePresenceOccupancy({ states: { "person.one": { state: "unknown" } } }, "person.one"), "unknown");
  assert.equal(api.resolvePresenceOccupancy({ states: { "person.one": true } }, "person.one"), null);
});
