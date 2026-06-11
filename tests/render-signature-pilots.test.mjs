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
  assert.match(source, /strict_service_actions === true/);
  assert.match(source, /_scheduleDraftRevision/);
});
