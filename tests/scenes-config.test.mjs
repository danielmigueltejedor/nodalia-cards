import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";

const configSource = buildSync({ entryPoints: ["src/cards/scenes/scenes-config.ts"], bundle: true, write: false, format: "iife", globalName: "scenes" }).outputFiles[0].text;
const helpersSource = buildSync({ entryPoints: ["src/cards/scenes/scenes-helpers.ts"], bundle: true, write: false, format: "iife", globalName: "helpers" }).outputFiles[0].text;
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL("../nodalia-utils.js", import.meta.url), "utf8"), sandbox);
vm.runInContext(configSource, sandbox);
vm.runInContext(helpersSource, sandbox);
const plain = value => JSON.parse(JSON.stringify(value));

test("Scenes retains YAML extensions, normalizes rows and keeps editor placeholders on request", () => {
  const input = { columns: 99, layout: "LIST", extra: { future: true }, scenes: [" scene.evening ", { entity: "scene.day", name: " Day " }, null, 42, {}] };
  const normalized = sandbox.scenes.normalizeConfig(input);
  assert.equal(normalized.columns, 6);
  assert.equal(normalized.layout, "list");
  assert.deepEqual(plain(normalized.extra), { future: true });
  assert.deepEqual(plain(normalized.scenes), [
    { entity: "scene.evening", name: "", icon: "", color: "" },
    { entity: "scene.day", name: "Day", icon: "", color: "" },
  ]);
  assert.equal(sandbox.scenes.normalizeConfig(input, { keepEmpty: true }).scenes.length, 3);
  assert.equal(input.scenes[0], " scene.evening ");
});

test("Scenes handles malformed config and rejects CSS and prototype injection", () => {
  for (const value of [null, false, 3, "invalid", []]) {
    const result = sandbox.scenes.normalizeConfig(value);
    assert.equal(result.layout, "grid");
    assert.ok(Array.isArray(result.scenes));
  }
  const result = sandbox.scenes.normalizeConfig(JSON.parse('{"__proto__":{"polluted":true},"styles":{"icon":{"color":"red;display:none"}},"tap_action":"arbitrary","hold_action":"arbitrary"}'));
  assert.equal(result.tap_action, "activate");
  assert.equal(result.hold_action, "more-info");
  assert.equal(Object.hasOwn(result, "__proto__"), false);
  assert.equal(sandbox.helpers.getSafeStyles(result.styles).icon.color, sandbox.scenes.DEFAULT_CONFIG.styles.icon.color);
  assert.equal(sandbox.helpers.sanitizeCssValue("red\u0000", "fallback"), "fallback");
  assert.equal(sandbox.helpers.getSafeStyles({ card: null }).card.padding, sandbox.scenes.DEFAULT_CONFIG.styles.card.padding);
});

test("Scenes preserves all three public layouts and falls back for unknown values", () => {
  for (const layout of ["grid", "list", "single"]) assert.equal(sandbox.scenes.normalizeConfig({ layout }).layout, layout);
  assert.equal(sandbox.scenes.normalizeConfig({ layout: "unknown" }).layout, "grid");
});
