import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";
function load(source = "graph-helpers") {
  const box = { Date }; box.window = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync("nodalia-utils.js", "utf8"), box);
  vm.runInContext(buildSync({ entryPoints: [`src/cards/graph/${source}.ts`], bundle: true, write: false, format: "iife", globalName: "api" }).outputFiles[0].text, box);
  return box.api;
}
const api = load();
const plain = value => JSON.parse(JSON.stringify(value));

test("Graph numeric/history boundaries keep absent readings distinct from real zero and comma decimals", () => {
  for (const value of [null, undefined, "", " ", false, [], {}, NaN, Infinity]) assert.equal(api.parseNumber(value), null);
  assert.equal(api.parseNumber(0), 0);
  assert.equal(api.parseNumber("2,5"), 2.5);
  assert.equal(api.formatNumberValue(null), "--");
  assert.equal(api.formatNumberValue(0, 1, "es"), "0,0");
  assert.equal(api.parseHistoryTimestamp(1_750_000_000), 1_750_000_000_000);
  assert.equal(api.parseHistoryTimestamp(1_750_000_000_000), 1_750_000_000_000);
  assert.equal(api.formatHoverTimestamp(null), "");
  assert.notEqual(api.formatHoverTimestamp(0), "");
});

test("Graph history buckets preserve averaging, carry-forward values and real-zero fallback", () => {
  const events = [{ ts: 0, value: 2 }, { ts: 5, value: 4 }, { ts: 50, value: 6 }, { ts: 100, value: 0 }];
  assert.deepEqual(plain(api.buildInterpolatedSamples(events, 0, 100, 3)), [{ ts: 0, value: 3 }, { ts: 50, value: 6 }, { ts: 100, value: 0 }]);
  assert.deepEqual(plain(api.buildInterpolatedSamples([{ ts: 50, value: 4 }], 0, 100, 3, 0)), [{ ts: 0, value: 0 }, { ts: 50, value: 4 }, { ts: 100, value: 4 }]);
  assert.deepEqual(plain(api.buildInterpolatedSamples([], 0, 100, 2, 0)), [{ ts: 0, value: 0 }, { ts: 100, value: 0 }]);
  assert.deepEqual(plain(api.buildInterpolatedSamples([null, { ts: 1, value: NaN }], 0, 100, 3)), []);
  assert.deepEqual(plain(api.buildInterpolatedSamples(events, 0, 100, Infinity)), []);
  assert.deepEqual(plain(api.buildInterpolatedSamples(events, 100, 0, 3)), []);
  assert.equal(api.buildInterpolatedSamples([], 0, 100, 100_000, 0).length, 10_000);
});

test("Graph SVG smoothing retains exact control points and never emits invalid geometry", () => {
  const points = [{ x: 0, y: 10 }, { x: 10, y: 20 }];
  assert.equal(api.buildSmoothPath(points), "M 0.00 10.00 C 1.67 11.67, 8.33 18.33, 10.00 20.00");
  assert.equal(api.buildAreaPath(points, 30), "M 0.00 10.00 C 1.67 11.67, 8.33 18.33, 10.00 20.00 L 10.00 30.00 L 0.00 30.00 Z");
  for (const invalid of [null, [null], [{ x: Infinity, y: 0 }], [{ x: 0, y: 0 }, , { x: 10, y: 10 }]]) {
    assert.equal(api.buildSmoothPath(invalid), "");
    assert.equal(api.buildAreaPath(invalid, 30), "");
  }
  assert.equal(api.graphChartXToPercent(50, { width: 100 }), 50);
  assert.equal(api.graphChartXToPercent(Infinity, { width: 100 }), 50);
});

test("Graph config keeps editor placeholders, YAML extensions and bounded integral history counts", () => {
  const configApi = load("graph-config");
  const input = { entities: ["sensor.one", { entity: "", name: "new" }, null], points: 50.8, extension: { marker: 1 }, styles: { card: false, line_width: "3px" } };
  const config = configApi.normalizeConfig(input);
  assert.equal(config.entities.length, 1);
  assert.equal(config.points, 50);
  assert.equal(config.styles.line_width, "3px");
  assert.equal(config.styles.card.padding, "14px");
  assert.deepEqual(plain(config.extension), { marker: 1 });
  assert.equal(configApi.normalizeEditorConfig(input).entities.length, 2);
  assert.equal(input.points, 50.8);
  assert.equal(configApi.normalizeConfig({ points: Infinity }).points, 100);
  assert.equal(configApi.normalizeConfig({ points: 100_000 }).points, 10_000);
  assert.equal(configApi.normalizeConfig({ points: 0 }).points, 100);
});

test("Graph padding retains CSS shorthand expansion and ignores nonnumeric size tokens", () => {
  assert.deepEqual(plain(api.parsePaddingEdges("10px 20px 30px")), { top: 10, right: 20, bottom: 30, left: 20 });
  assert.deepEqual(plain(api.parsePaddingEdges("10px 20px 30px 40px")), { top: 10, right: 20, bottom: 30, left: 40 });
  assert.deepEqual(plain(api.parsePaddingEdges("var(--space)", 8)), { top: 8, right: 8, bottom: 8, left: 8 });
});

test("Graph attribute paths read own object/array fields and reject unsafe/inherited branches", () => {
  assert.equal(api.getByPath({ rows: [{ value: 0 }] }, "rows.0.value"), 0);
  assert.equal(api.getByPath(Object.create({ hidden: 1 }), "hidden"), undefined);
  assert.equal(api.getByPath({}, "__proto__.toString"), undefined);
  assert.equal(api.getByPath(null, "a.b"), undefined);
});
