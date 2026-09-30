import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";

function load(entry) {
  const source = buildSync({ entryPoints: [entry], bundle: true, write: false, format: "iife", globalName: "model" }).outputFiles[0].text;
  const sandbox = { console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ["nodalia-utils.js", "nodalia-notifications-mobile-policy.js", "nodalia-room-summary-model.js"]) {
    vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), sandbox);
  }
  vm.runInContext(source, sandbox);
  return { api: sandbox.model, sandbox };
}
const { api, sandbox } = load("src/shared/editor-color.ts");
const plain = value => JSON.parse(JSON.stringify(value));

test("Editor colors parse RGB, CSS Color 4 sRGB, percentages and hex with alpha", () => {
  for (const css of ["rgba(255, 136, 0, 0.24)", "rgb(100% 53.333333% 0% / 24%)", "color(srgb 1 .533333333 0 / .24)", "color(srgb 100% 53.333333% 0% / 24%)"]) {
    const model = api.getEditorColorModel(css);
    assert.equal(model.hex, "#ff8800");
    assert.equal(model.alpha, 0.24);
    assert.equal(model.value, "rgba(255, 136, 0, 0.24)");
  }
  assert.deepEqual(plain(api.parseEditorColorChannels("#f804")), { red: 255, green: 136, blue: 0, alpha: 68 / 255 });
  assert.deepEqual(plain(api.parseEditorColorChannels("#ff88003d")), { red: 255, green: 136, blue: 0, alpha: 61 / 255 });
  assert.equal(api.getEditorColorModel("#abc").hex, "#aabbcc");
  assert.equal(api.getEditorColorModel("rgb(1e2 0 255 / 0)").value, "rgba(100, 0, 255, 0)");
});

test("Editor colors reject malformed components and retain fallback/transparent alpha", () => {
  for (const value of ["rgb(1 2)", "rgb(1 2 3 4 5)", "rgb(1 2 3 / nope)", "color(srgb NaN 0 0)", "rgba(1,2,3,)", "#12345", "#aabbgg", "invalid"]) {
    assert.equal(api.parseEditorColorChannels(value), null, value);
    assert.equal(api.getEditorColorModel(value, "#abcdef").hex, "#abcdef");
  }
  assert.equal(api.formatEditorColorFromHex("#aabbcc", 0), "rgba(170, 187, 204, 0)");
  assert.equal(api.formatEditorColorFromHex("#aabbcc", NaN), "#aabbcc");
  assert.equal(api.formatEditorColorFromHex("invalid", 0.2), "invalid");
  assert.equal(api.getEditorColorModel("color(srgb -1 2 0 / 120%)").hex, "#00ff00");
});

test("Editor colors use resolved theme colors without treating 0..1 channels as 8-bit RGB", () => {
  sandbox.NodaliaBubbleContrast = { resolveEditorColorValue: () => "color(srgb 1 0.533333 0 / 0.24)" };
  const model = api.getEditorColorModel("color-mix(in srgb, var(--accent) 24%, transparent)");
  assert.equal(model.hex, "#ff8800");
  assert.equal(model.alpha, 0.24);
  assert.equal(model.source, "color-mix(in srgb, var(--accent) 24%, transparent)");
});

const helpers = fs.readdirSync("src/cards", { withFileTypes: true }).filter(entry => entry.isDirectory())
  .flatMap(({ name }) => fs.readdirSync(`src/cards/${name}`).filter(file => file.endsWith("-helpers.ts") || file === "climate-model.ts").map(file => `src/cards/${name}/${file}`))
  .filter(path => fs.readFileSync(path, "utf8").includes('from "../../shared/editor-color"'));
for (const path of helpers) {
  test(`${path} keeps its editor color helper exports and alpha behavior`, () => {
    const { api, sandbox } = load(path);
    sandbox.NodaliaBubbleContrast = { resolveEditorColorValue: () => "color(srgb 1 0.533333 0 / 0.24)" };
    assert.equal(api.getEditorColorModel("var(--color)").hex, "#ff8800");
    assert.equal(api.getEditorColorModel("var(--color)").alpha, 0.24);
    assert.equal(api.formatEditorColorFromHex("#aabbcc", 0.24), "rgba(170, 187, 204, 0.24)");
  });
}
