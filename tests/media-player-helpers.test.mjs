import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";
function load(extra = {}) {
  const box = { URL, ...extra }; box.window = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync("nodalia-utils.js", "utf8"), box);
  vm.runInContext(buildSync({ entryPoints: ["src/cards/media-player/media-player-helpers.ts"], bundle: true, write: false, format: "iife", globalName: "api" }).outputFiles[0].text, box);
  return box.api;
}
const api = load();
const plain = value => JSON.parse(JSON.stringify(value));

test("Media compaction keeps empty entity placeholders at every level and retains false, zero and empty arrays", () => {
  const input = { entity: "", players: [{ entity: "", name: "", volume: 0, show: false, extra: {} }], empty: null, list: [] };
  assert.deepEqual(plain(api.compactConfig(input)), { entity: "", players: [{ entity: "", volume: 0, show: false }], list: [] });
  const unsafe = JSON.parse('{"players":[{"entity":"","__proto__":{"bad":true}}],"constructor":1}');
  assert.deepEqual(plain(api.compactConfig(unsafe)), { players: [{ entity: "" }] });
  assert.equal(input.players[0].name, "");
});

test("Media editor JSON accepts object/blank fields, retains invalid text, and always returns a string", () => {
  assert.equal(api.formatEditorJsonValue('{"volume":0}'), '{\n  "volume": 0\n}');
  assert.equal(api.formatEditorJsonValue("{invalid"), "{invalid");
  assert.equal(api.formatEditorJsonValue(Symbol("empty")), "");
  assert.equal(api.parseEditorJsonObject(" ").valid, true);
  assert.equal(api.parseEditorJsonObject("{}").valid, true);
  assert.equal(api.parseEditorJsonObject("[]").valid, false);
  assert.equal(api.parseEditorJsonObject("false").valid, false);
  assert.equal(api.parseEditorJsonObject("{invalid").valid, false);
});

test("Media theme contrast parses modern sRGB/percentage/alpha colors and rejects invalid channels", () => {
  assert.deepEqual(plain(api.parseRgbColor("rgb(100% 50% 0% / 24%)")), { red: 255, green: 127.5, blue: 0 });
  assert.deepEqual(plain(api.parseRgbColor("color(srgb 1 .5 0 / .24)")), { red: 255, green: 127.5, blue: 0 });
  assert.equal(api.getRelativeLuminance(api.parseRgbColor("rgba(0,0,0,.24)")), 0);
  assert.equal(api.getRelativeLuminance(api.parseRgbColor("#fff4")), 1);
  assert.equal(api.parseRgbColor("rgb(10,broken,20,30)"), null);
  assert.equal(api.getRelativeLuminance({ red: NaN, green: 0, blue: 0 }), null);
});

test("Media query keys are literal, fragments survive, and artwork URLs retain HA relative resolution", () => {
  assert.equal(api.appendQueryParam("/art?size=1#cover", "size", 2), "/art?size=2#cover");
  assert.equal(api.appendQueryParam("/art?aXb=1#cover", "a.b", 2), "/art?aXb=1&a.b=2#cover");
  assert.equal(api.sanitizeMediaArtworkUrl("/api/image#cover", { hassUrl: value => "https://ha.test" + value }), "https://ha.test/api/image#cover");
  assert.equal(api.sanitizeMediaArtworkUrl("javascript:alert(1)", null), "");
  assert.equal(api.formatDuration(Infinity), "0:00");
  assert.equal(api.formatDuration(3601.8), "1:00:01");
});

test("Media paths read own array/object values, skip empty path segments, and block inherited/prototype fields", () => {
  assert.equal(api.getByPath({ players: [{ volume: 0 }] }, ".players..0.volume."), 0);
  assert.equal(api.getByPath(Object.create({ hidden: 1 }), "hidden"), undefined);
  assert.equal(api.getByPath({}, "__proto__.toString"), undefined);
  const rows = [1, 2, 3];
  api.moveItem(rows, 0.5, 2); assert.deepEqual(rows, [1, 2, 3]);
  api.moveItem(rows, 0, 2); assert.deepEqual(rows, [2, 3, 1]);
});

test("Media uses cached slider geometry and removes color probes when resolution throws", () => {
  const slider = { min: "0", max: "1", step: ".05", value: ".3", getBoundingClientRect: () => ({ left: 20, width: 100 }) };
  const geometry = api.getSliderDragGeometry(slider);
  assert.equal(api.getRangeValueFromGeometry(geometry, .3, 72), .5);
  assert.equal(api.getRangeValueFromClientX(slider, 72), .5);
  assert.equal(api.getRangeValueFromGeometry({ ...geometry, width: 0 }, .3, 72), .3);
  let removed = 0, added = 0;
  const root = { appendChild() { added++; } };
  class ShadowRoot {}
  const shadow = new ShadowRoot(); shadow.appendChild = () => { added++; };
  const throwing = load({ ShadowRoot, document: { body: root, createElement: () => ({ style: {}, remove() { removed++; } }) }, getComputedStyle: () => { throw Error("style failed"); } });
  assert.throws(() => throwing.resolveColorInContext({ shadowRoot: shadow }, "#123456"), /style failed/);
  assert.equal(added, 1); assert.equal(removed, 1);
});
