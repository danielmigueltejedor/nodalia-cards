import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("url openings keep noopener,noreferrer hardening", () => {
  const files = [
    "nodalia-insignia-card.js",
    "nodalia-entity-card.js",
    "nodalia-fav-card.js",
    "nodalia-navigation-bar.js",
    "nodalia-advance-vacuum-card.js",
  ];
  files.forEach(file => {
    const source = read(file);
    assert.match(source, /window\.open\([^)]*"noopener,noreferrer"\)/);
  });
});

test("action URL sinks use sanitizeActionUrl", () => {
  const files = [
    "nodalia-insignia-card.js",
    "nodalia-entity-card.js",
    "nodalia-fav-card.js",
    "nodalia-navigation-bar.js",
    "nodalia-media-player.js",
    "nodalia-advance-vacuum-card.js",
  ];
  files.forEach(file => {
    const source = read(file);
    assert.match(source, /sanitizeActionUrl\(/);
  });
});

test("high-frequency cards share render signature runtime", () => {
  const files = [
    "nodalia-navigation-bar.js",
    "nodalia-graph-card.js",
    "nodalia-media-player.js",
  ];
  files.forEach(file => {
    const source = read(file);
    assert.match(source, /getRenderSignatureRuntime\(/);
    assert.match(source, /window\.NodaliaRenderSignature/);
  });
});

test("drag listeners stay attach-on-drag only", () => {
  const files = [
    "nodalia-light-card.js",
    "nodalia-fan-card.js",
    "nodalia-humidifier-card.js",
  ];
  files.forEach(file => {
    const source = read(file);
    assert.match(source, /_dragWindowListenersAttached/);
    assert.match(source, /_attachWindowDragListeners\(/);
    assert.match(source, /_detachWindowDragListeners\(/);
  });
});

test("navigation runtime css sanitizer guard is present in source", () => {
  const source = read("nodalia-navigation-bar.js");
  assert.match(source, /function sanitizeCssRuntimeValue\(value\)/);
  assert.match(source, /if \(\/\[<>\{\};"'\]\/\.test\(raw\) \|\| raw\.includes\("\/\*"\) \|\| raw\.includes\("\*\/"\)\)/);
});

test("calendar runtime css sanitizer and webhook admin guard are present", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /function sanitizeCssRuntimeValue\(value\)/);
  assert.match(source, /security\.allow_webhooks_for_non_admin/);
  assert.match(source, /webhook bloqueado para usuario no administrador/);
});

test("calendar weather forecast normalization keeps date-keyed and tabular daily rows", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /function withForecastDateFromKey\(key, value\)/);
  assert.match(source, /raw\.time \?\? raw\.datetime \?\? raw\.date \?\? raw\.dates/);
  assert.match(source, /this\._normalizeForecastRows\(withForecastDateFromKey\(key, value\)\)/);
  assert.match(source, /item\.temperatureLow/);
  assert.match(source, /item\.temperature_2m_min/);
});

test("calendar expanded popup reuses daily weather badges", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /_renderWeatherBadge\(dayDate, weatherByDay/);
  assert.match(source, /this\._renderExpandedBody\(groups, config, locale, weatherByDay\)/);
  assert.match(source, /calendar-expanded__month-weather/);
  assert.match(source, /calendar-expanded__day-detail-heading/);
  assert.match(source, /calendar-expanded__col-head/);
});
