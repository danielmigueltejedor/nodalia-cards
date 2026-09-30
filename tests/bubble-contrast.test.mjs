import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";

const source = buildSync({ entryPoints: ["src/shared/bubble-contrast.ts"], bundle: true, write: false, format: "iife", globalName: "model" }).outputFiles[0].text;
function load(overrides = {}) {
  const sandbox = { ...overrides };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.model.bubbleContrast;
}
const state = { entity_id: "light.room", state: "on", attributes: {} };

test("Bubble hue parsing handles modern sRGB, alpha, percentage RGB and gray without a DOM", () => {
  const api = load();
  for (const value of ["#00f", "#0000ff80", "rgb(0 0 255 / .24)", "rgb(0% 0% 100%)", "color(srgb 0 0 1 / .24)"]) {
    assert.equal(api.parseCssColorHue(value), 240);
    assert.equal(api.shouldDarkenBubbleIconGlyph(state, value), true);
  }
  assert.equal(api.parseCssColorHue("rgba(255, 128, 0, .24)"), 128 / 255 * 60);
  assert.equal(api.shouldDarkenBubbleIconGlyph(state, "#ff8800"), false);
  for (const value of ["#888", "rgb(1 1 1)", "invalid", ""]) assert.equal(api.parseCssColorHue(value), null);
});

test("Bubble contrast retains semantic inference and all neutral-background migration aliases", () => {
  const api = load();
  assert.equal(api.shouldDarkenBubbleIconGlyph({ entity_id: "sensor.room", state: "23", attributes: { device_class: "temperature" } }, "var(--unknown)"), true);
  assert.equal(api.shouldDarkenBubbleIconGlyph(state, "var(--unknown)"), false);
  for (const value of ["#fff", "RGB(255, 255, 255)", "rgba(255,255,255,.06)", "var(--ha-card-background)"]) assert.equal(api.normalizeNeutralBubbleBackground(value, "fallback"), "fallback");
  assert.equal(api.normalizeNeutralBubbleBackground("rgba(50,60,70,.24)", "fallback"), "rgba(50,60,70,.24)");
  assert.equal(api.resolveBubbleIconGlyphColor(state, "#ff8800"), "color-mix(in srgb, #ff8800 72%, var(--primary-text-color))");
});

function probeEnvironment() {
  const probes = [];
  let resolved = "rgb(255, 136, 0)";
  let fail = false;
  const document = { createElement() { const probe = { style: {}, remove() { this.removed = true; } }; probes.push(probe); return probe; }, body: { appendChild(probe) { probe.appended = true; } } };
  return { probes, setResolved: value => { resolved = value; }, setFail: () => { fail = true; }, overrides: { document, getComputedStyle() { if (fail) throw new Error("probe failed"); return { color: resolved }; } } };
}

test("Bubble cache keeps fixed colors but resolves theme variables synchronously after updates", () => {
  const env = probeEnvironment();
  const api = load(env.overrides);
  assert.equal(api.resolveEditorColorValue("orange"), "rgb(255, 136, 0)");
  env.setResolved("rgb(0, 0, 255)");
  assert.equal(api.resolveEditorColorValue("orange"), "rgb(255, 136, 0)");
  assert.equal(env.probes.length, 1);
  assert.equal(api.resolveEditorColorValue("var(--tint)"), "rgb(0, 0, 255)");
  env.setResolved("rgb(255, 136, 0)");
  assert.equal(api.resolveEditorColorValue("var(--tint)"), "rgb(255, 136, 0)");
  assert.equal(env.probes.length, 3);
  assert.ok(env.probes.every(probe => probe.removed));
});

test("Bubble cache stays bounded and removes its DOM probe when style resolution throws", () => {
  const env = probeEnvironment();
  const api = load(env.overrides);
  for (let index = 0; index < 257; index += 1) api.resolveEditorColorValue(`#${index.toString(16).padStart(6, "0")}`);
  assert.equal(env.probes.length, 257);
  api.resolveEditorColorValue("#000000");
  assert.equal(env.probes.length, 258, "the first cache entry must have been evicted");
  env.setFail();
  assert.throws(() => api.resolveEditorColorValue("var(--tint)"), /probe failed/);
  assert.equal(env.probes.at(-1).removed, true);
});

test("Bubble generated adapter keeps a complete preexisting API and upgrades a partial API", () => {
  const artifact = fs.readFileSync("nodalia-bubble-contrast.js", "utf8");
  const complete = { shouldDarkenBubbleIconGlyph() {}, resolveBubbleIconGlyphColor() {}, normalizeNeutralBubbleBackground() {} };
  const sandbox = { window: { NodaliaBubbleContrast: complete } };
  vm.createContext(sandbox);
  vm.runInContext(artifact, sandbox);
  assert.equal(sandbox.window.NodaliaBubbleContrast, complete);
  sandbox.window.NodaliaBubbleContrast = {};
  vm.runInContext(artifact, sandbox);
  assert.deepEqual(Object.keys(sandbox.window.NodaliaBubbleContrast).sort(), ["resolveEditorColorValue", "parseCssColorHue", "shouldDarkenBubbleIconGlyph", "resolveBubbleIconGlyphColor", "normalizeNeutralBubbleBackground"].sort());
});
