import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("navigation card uses modular render signature helpers", () => {
  const source = read("nodalia-navigation-bar.js");
  assert.match(source, /_getRouteBadgeSignatureRows\(/);
  assert.match(source, /_getMediaPlayerSignatureRows\(/);
  assert.match(source, /getRenderSignatureRuntime\(/);
});

test("graph card uses non-JSON render signature strategy", () => {
  const source = read("nodalia-graph-card.js");
  assert.match(source, /_getTrackedStateSignatureRows\(/);
  assert.match(source, /getRenderSignatureRuntime\(/);
  assert.doesNotMatch(source, /return JSON\.stringify\(\{\s*trackedStates/s);
});

test("cover climate vacuum fav and advance-vacuum use joinParts render signatures", () => {
  for (const file of [
    "nodalia-cover-card.js",
    "nodalia-climate-card.js",
    "nodalia-vacuum-card.js",
    "nodalia-fav-card.js",
    "nodalia-advance-vacuum-card.js",
  ]) {
    const source = read(file);
    assert.match(source, /joinParts/, `${file} should use joinParts`);
    assert.doesNotMatch(source, /return JSON\.stringify\(\{[\s\S]*_getRenderSignature/s, `${file} should not JSON.stringify full render signature`);
  }
});

test("graph card patches hover overlay without full render", () => {
  const source = read("nodalia-graph-card.js");
  assert.match(source, /_patchHoverOverlay\(\)/);
  assert.match(source, /if \(!this\._hoverEntering && this\._patchHoverOverlay\(\)\)/);
});

test("notifications card caches calendar and weather signature stamps", () => {
  const source = read("nodalia-notifications-card.js");
  assert.match(source, /_rebuildCalendarEventsSignature\(/);
  assert.match(source, /_calendarEventsSignature/);
  assert.match(source, /_weatherForecastsSignature/);
});

test("climate card gates external services when strict mode enabled", () => {
  const source = read("nodalia-climate-card.js");
  assert.match(source, /_isServiceAllowed\(fullService\)/);
  assert.match(source, /strict_service_actions !== true/);
  assert.match(source, /normalizeSecurityConfig/);
  assert.match(source, /_scheduleDraftRevision/);
});

test("alpha.4 cards use joinParts render signatures", () => {
  for (const [file, prefix] of [
    ["nodalia-insignia-card.js", "insignia:"],
    ["nodalia-person-card.js", "person:"],
    ["nodalia-fan-card.js", "fan:"],
    ["nodalia-humidifier-card.js", "humidifier:"],
    ["nodalia-weather-card.js", "weather:"],
    ["nodalia-alarm-panel-card.js", "alarm:"],
    ["nodalia-circular-gauge-card.js", "gauge:"],
  ]) {
    const source = read(file);
    assert.match(source, /joinParts/, `${file} should use joinParts`);
    assert.match(source, new RegExp(`prefix: "${prefix.replace(":", "\\:")}"`), `${file} should use ${prefix} prefix`);
  }
});

test("insignia render signature does not embed full config object", () => {
  const source = read("nodalia-insignia-card.js");
  assert.doesNotMatch(source, /config: this\._config/);
});

test("alpha.5 cards avoid JSON attribute signatures and use slim person stamp", () => {
  const entitySource = read("nodalia-entity-card.js");
  const getValueSignatureFn = entitySource.match(/function getValueSignature\(value\) \{[\s\S]*?\n\}/);
  assert.ok(getValueSignatureFn, "expected getValueSignature helper");
  assert.doesNotMatch(getValueSignatureFn[0], /JSON\.stringify/);
  assert.match(getValueSignatureFn[0], /`a:\$\{value\.length\}/);
  assert.match(read("nodalia-light-card.js"), /prefix: "light:"/);
  const personSource = read("nodalia-person-card.js");
  const personSignatureFn = personSource.match(/_getRenderSignature\(hass = this\._hass\) \{[\s\S]*?\n  \}/);
  assert.ok(personSignatureFn, "expected person _getRenderSignature");
  assert.doesNotMatch(personSignatureFn[0], /_getTitle\(/);
  assert.doesNotMatch(personSignatureFn[0], /_translateState\(/);
  assert.doesNotMatch(personSignatureFn[0], /_getBadgeDescriptor\(/);
});

test("alpha.7 cards adopt normalizeSecurityConfig in normalizeConfig", () => {
  for (const file of [
    "nodalia-light-card.js",
    "nodalia-entity-card.js",
    "nodalia-fav-card.js",
    "nodalia-fan-card.js",
    "nodalia-cover-card.js",
    "nodalia-climate-card.js",
    "nodalia-media-player.js",
    "nodalia-navigation-bar.js",
    "nodalia-humidifier-card.js",
  ]) {
    const source = read(file);
    assert.match(source, /normalizeSecurityConfig/, `${file} should normalize security config`);
  }
});

test("fav render signature includes tap and security fields", () => {
  const source = read("nodalia-fav-card.js");
  const signatureFn = source.match(/_getRenderSignature\(hass = this\._hass\) \{[\s\S]*?\n  \}/);
  assert.ok(signatureFn, "expected fav _getRenderSignature");
  assert.match(signatureFn[0], /tap_action/);
  assert.match(signatureFn[0], /strict_service_actions/);
});

test("circular gauge thumb uses continuous rotate along arc sweep", () => {
  const source = read("nodalia-circular-gauge-card.js");
  assert.match(source, /function getContinuousThumbRotate\(/);
  assert.match(source, /thumbRotate/);
});

test("normalizeSecurityConfig is exported from nodalia-utils", () => {
  const source = read("nodalia-utils.js");
  assert.match(source, /function normalizeSecurityConfig\(/);
  assert.match(source, /normalizeSecurityConfig,/);
});
