import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const renderSignature = file => {
  const source = read(file);
  const match = source.match(/_getRenderSignature\(hass = this\._hass\) \{[\s\S]*?\n  \}/);
  assert.ok(match, `expected ${file} render signature`);
  return match[0];
};

test("news history observes the current hass snapshot before signature side effects", () => {
  const source = read("nodalia-news-card.js");
  assert.match(source, /set hass\(hass\) \{\n\s*this\._hass = hass;\n\s*const nextSignature = this\._getRenderSignature\(hass\);/);
});

test("gauge signature follows native values, inferred ranges and locale", () => {
  const signature = renderSignature("nodalia-circular-gauge-card.js");
  for (const token of ["native_value", "device_class", "attrs.min", "attrs.max", "getHassLocaleTag"]) {
    assert.match(signature, new RegExp(token.replace(".", "\\.")), `gauge signature should include ${token}`);
  }
});

test("alarm and person signatures follow translated and customized labels", () => {
  const alarm = renderSignature("nodalia-alarm-panel-card.js");
  assert.match(alarm, /attrs\.friendly_name/);
  assert.match(alarm, /resolveLanguage/);

  const person = renderSignature("nodalia-person-card.js");
  assert.match(person, /entity_picture_local/);
  assert.match(person, /zoneState\?\.attributes\?\.friendly_name/);
  assert.match(person, /resolveLanguage/);
});

test("person retries unresolved zone matches instead of caching misses forever", () => {
  const source = read("nodalia-person-card.js");
  const matcher = source.match(/_getMatchingZoneState\(state\) \{[\s\S]*?\n  \}/);
  assert.ok(matcher, "expected person zone matcher");
  assert.doesNotMatch(matcher[0], /if \(!this\._cachedZoneEntityId\) \{\s*return null;/);
});

test("vacuum signature follows auxiliary state, battery, mapping and mode selects", () => {
  const source = read("nodalia-vacuum-card.js");
  assert.match(source, /set hass\(hass\) \{\n\s*this\._hass = hass;\n\s*this\._relatedEntityCacheGeneration \+= 1;\n\s*const nextSignature = this\._getRenderSignature\(hass\);/);
  const signature = renderSignature("nodalia-vacuum-card.js");
  for (const token of [
    "auxiliaryState",
    "batteryState",
    "mappingState",
    "suctionSelectState",
    "mopSelectState",
    "resolveLanguage",
  ]) {
    assert.match(signature, new RegExp(token), `vacuum signature should include ${token}`);
  }
  assert.match(source, /_getRelatedEntityCache\(\)/);
  assert.match(source, /this\._relatedEntityCacheGeneration \+= 1/);
  assert.match(source, /this\._relatedEntityCache\?\.objectId === objectId/);
  assert.match(source, /this\._relatedEntityCache\?\.generation === this\._relatedEntityCacheGeneration/);
});

test("camera serializes static action configuration only when config changes", () => {
  const source = read("nodalia-camera-card.js");
  const signature = renderSignature("nodalia-camera-card.js");
  assert.match(source, /setConfig\(config\) \{[\s\S]*this\._staticRenderSignature = JSON\.stringify/);
  assert.match(signature, /this\._staticRenderSignature/);
  assert.doesNotMatch(signature, /JSON\.stringify/);
});
