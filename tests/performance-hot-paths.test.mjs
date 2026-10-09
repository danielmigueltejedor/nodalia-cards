import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Compile one TypeScript module into a plain object so its exports can be exercised directly. */
function loadModule(file) {
  const code = buildSync({
    entryPoints: [path.join(root, file)],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "api",
    platform: "browser",
  }).outputFiles[0].text;
  const box = { Intl, Date, Map, Set, JSON, Object, Number, Math, String, Array, Boolean };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(code, box);
  return box.api;
}

test("catalog stamp advances only when discovery-relevant entity fields change", () => {
  const { EntityCatalogStamp } = loadModule("src/shared/entity-catalog-stamp.ts");
  const stamp = new EntityCatalogStamp();
  const make = (states, entities = {}) => ({ states, entities });
  const base = () => ({
    "vacuum.robot": { state: "docked", attributes: { friendly_name: "Robot" } },
    "sensor.robot_battery": { state: "80", attributes: { friendly_name: "Robot battery" } },
  });
  const first = stamp.update(make(base()));
  // New HA objects carrying the same catalog (state values differ) keep the version.
  const changedState = base();
  changedState["sensor.robot_battery"] = { state: "79", attributes: { friendly_name: "Robot battery" } };
  assert.equal(stamp.update(make(changedState)), first);
  const sameObject = make(base());
  assert.equal(stamp.update(sameObject), first);
  assert.equal(stamp.update(sameObject), first);

  const renamed = base();
  renamed["sensor.robot_battery"] = { state: "80", attributes: { friendly_name: "Other" } };
  const afterRename = stamp.update(make(renamed));
  assert.ok(afterRename > first);

  const added = { ...renamed, "sensor.new": { state: "1", attributes: {} } };
  const afterAdd = stamp.update(make(added));
  assert.ok(afterAdd > afterRename);
  const removed = { ...renamed };
  assert.ok(stamp.update(make(removed)) > afterAdd);

  const registryBase = make(removed, { "sensor.robot_battery": { device_id: "a" } });
  const afterRegistry = stamp.update(registryBase);
  assert.equal(stamp.update(make(removed, { "sensor.robot_battery": { device_id: "a" } })), afterRegistry);
  assert.ok(stamp.update(make(removed, { "sensor.robot_battery": { device_id: "b" } })) > afterRegistry);
});

test("catalog stamp notices a dictionary mutated in place, and trusts a pass that already compared it", () => {
  const { EntityCatalogStamp } = loadModule("src/shared/entity-catalog-stamp.ts");
  const stamp = new EntityCatalogStamp();
  const states = { "vacuum.robot": { state: "docked", attributes: { friendly_name: "Robot" } } };
  const entities = { "vacuum.robot": { device_id: "a" } };
  const hass = { states, entities };
  const before = stamp.update(hass);
  // Mutating the same HA object in place is only skipped when the caller vouches for it.
  entities["vacuum.robot"].device_id = "b";
  assert.equal(stamp.update(hass, true), before);
  const afterRegistry = stamp.update(hass);
  assert.ok(afterRegistry > before);
  states["sensor.robot_status"] = { state: "idle", attributes: { friendly_name: "Robot status" } };
  assert.ok(stamp.update({ states, entities }, true) > afterRegistry);
});

test("normalizeTextKey memoization matches the reference normalization", () => {
  const source = fs.readFileSync(path.join(root, "nodalia-utils.js"), "utf8");
  const box = { Date, Intl };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(source, box);
  const reference = value => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const samples = ["sensor.Robot_Status", "Cocina  Principal", "Habitación Niños", "  --x--  ", "", null, undefined, 0, 42, true, "ÁÉÍÓÚ ñ", "a".repeat(400), `${"é".repeat(170)}!`, "vacuum.roborock_s8_pro"];
  for (let round = 0; round < 3; round += 1) {
    for (const sample of samples) assert.equal(box.NodaliaUtils.normalizeTextKey(sample), reference(sample), JSON.stringify(sample));
  }
  // Far more distinct keys than the cache holds: results stay correct across evictions.
  for (let index = 0; index < 9000; index += 1) {
    const value = `Entity ${index} Ñandú`;
    assert.equal(box.NodaliaUtils.normalizeTextKey(value), reference(value));
  }
  for (const sample of samples) assert.equal(box.NodaliaUtils.normalizeTextKey(sample), reference(sample));
});

test("compact layout reads the parent width only when the decision needs it", () => {
  const source = fs.readFileSync(path.join(root, "nodalia-utils.js"), "utf8");
  const box = { Date, Intl };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(source, box);
  const { shouldUseCompactCardLayout } = box.NodaliaUtils;
  let reads = 0;
  const parentWidth = value => () => { reads += 1; return value; };
  assert.equal(shouldUseCompactCardLayout({ mode: "always", width: 800, parentWidth: parentWidth(1100) }), true);
  assert.equal(shouldUseCompactCardLayout({ mode: "never", width: 300, parentWidth: parentWidth(1100) }), false);
  assert.equal(shouldUseCompactCardLayout({ mode: "auto", width: 300, parentWidth: parentWidth(1100) }), true);
  assert.equal(shouldUseCompactCardLayout({ mode: "auto", width: 800, gridColumns: 4, parentWidth: parentWidth(1100) }), true);
  assert.equal(shouldUseCompactCardLayout({ mode: "auto", width: 1000, parentWidth: parentWidth(1400) }), false);
  assert.equal(shouldUseCompactCardLayout({ mode: "auto", width: 0, parentWidth: parentWidth(1400) }), false);
  assert.equal(reads, 0);
  // Only a measured width between the tile threshold and 900px depends on the parent.
  assert.equal(shouldUseCompactCardLayout({ mode: "auto", width: 700, parentWidth: parentWidth(1400) }), true);
  assert.equal(shouldUseCompactCardLayout({ mode: "auto", width: 700, parentWidth: parentWidth(800) }), false);
  assert.equal(reads, 2);
  // Plain numbers keep working for existing callers.
  assert.equal(shouldUseCompactCardLayout({ mode: "auto", width: 700, parentWidth: 1400 }), true);
});

test("formatted numbers and dates are served from shared formatter caches", () => {
  const numbers = loadModule("src/shared/numeric-values.ts");
  const dates = loadModule("src/shared/date-time-format.ts");
  for (const [value, digits, locale] of [[1234.5678, 2, "en"], [1234.5678, 0, "de"], [0.5, 1, undefined], [-0, 1, "en"], [0, 1, "en"], [1e21, 0, "en"], [-1234.5, 1, "es"]]) {
    for (let round = 0; round < 3; round += 1) {
      assert.equal(numbers.formatFiniteNumericValue(value, digits, locale), new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value));
    }
  }
  assert.equal(numbers.formatFiniteNumericValue("n/a", 1, "en"), "--");
  for (let index = 0; index < 600; index += 1) assert.equal(numbers.formatFiniteNumericValue(index / 7, 2, "en"), new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(index / 7));

  const stamp = new Date("2026-10-09T08:05:00Z");
  const options = { hour: "2-digit", minute: "2-digit", timeZone: "UTC" };
  assert.equal(dates.getDateTimeFormatter("en", options), dates.getDateTimeFormatter("en", options));
  assert.equal(dates.getDateTimeFormatter("en", options).format(stamp), stamp.toLocaleTimeString("en", options));
  assert.equal(dates.getDateTimeFormatter("es", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(stamp), stamp.toLocaleDateString("es", { weekday: "short", day: "numeric", timeZone: "UTC" }));
});

test("cards never serialize their whole shadow tree to learn whether they rendered", () => {
  const offenders = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith("runtime-i18n-data.ts")) {
        fs.readFileSync(full, "utf8").split("\n").forEach((line, index) => {
          // Reading innerHTML serializes every node on each HA update; assignments are fine.
          if (/shadowRoot\??\.innerHTML(?!\s*(=[^=]|\+=))/.test(line)) offenders.push(`${path.relative(root, full)}:${index + 1}`);
        });
      }
    }
  };
  visit(path.join(root, "src"));
  assert.deepEqual(offenders, []);
});
