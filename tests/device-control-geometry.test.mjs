import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";

function loadHelpers(card) {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync("nodalia-utils.js", "utf8"), sandbox);
  const source = buildSync({ entryPoints: [`src/cards/${card}/${card}-helpers.ts`], bundle: true, write: false, format: "iife", globalName: "api" }).outputFiles[0].text;
  vm.runInContext(source, sandbox);
  return sandbox.api;
}
const plain = value => JSON.parse(JSON.stringify(value));
const rectangle = { left: 20, top: 30, width: 240, height: 240 };

for (const card of ["fan", "humidifier", "cover"]) {
  const api = loadHelpers(card);
  test(`${card} slider maps cached geometry, boundaries and fractional steps consistently`, () => {
    const input = { min: "10", max: "20", step: "0.5", value: "13", getBoundingClientRect: () => ({ left: 40, width: 100 }) };
    const geometry = api.getSliderDragGeometry(input);
    assert.deepEqual(plain(geometry), { left: 40, width: 100, min: 10, max: 20, step: 0.5 });
    for (const [x, value] of [[0, 10], [40, 10], [66, 12.5], [90, 15], [140, 20], [250, 20]]) {
      assert.equal(api.getRangeValueFromGeometry(geometry, 13, x), value);
      if (api.getRangeValueFromClientX) assert.equal(api.getRangeValueFromClientX(input, x), value);
    }
    assert.equal(api.getRangeValueFromGeometry({ ...geometry, width: 0 }, 13, 70), 13);
    assert.equal(api.getRangeValueFromGeometry(null, 13, 70), 13);
    assert.equal(api.getRangeValueFromGeometry({ ...geometry, step: 0 }, 13, 66), 12.6);
  });

  test(`${card} dial marker round trips through pointer coordinates and preserves center/gap fallback`, () => {
    for (const [min, max, values] of [[0, 100, [0, 25, 50, 75, 100]], [30, 70, [30, 40, 50, 60, 70]]]) {
      for (const value of values) {
        const model = api.getCircularLayoutDialModel(value, min, max);
        const x = rectangle.left + model.markerLeft * rectangle.width / 100;
        const y = rectangle.top + model.markerTop * rectangle.height / 100;
        assert.equal(api.getCircularLayoutDialValueFromPoint(null, x, y, { min, max }, 1, value, rectangle), value);
      }
    }
    assert.equal(api.getCircularLayoutDialValueFromPoint(null, 140, 150, { min: 0, max: 100 }, 1, 63, rectangle), 63);
    assert.equal(api.getCircularLayoutDialValueFromPoint(null, 140, 236, { min: 0, max: 100 }, 1, 63, rectangle), 63);
    assert.equal(api.getCircularLayoutDialValueFromPoint(null, 140, 64, { min: 30, max: 70 }, 5, 63, rectangle), 50);
    assert.equal(api.getCircularLayoutDialValueFromPoint(null, 0, 0, { min: 30, max: 70 }, 1, 44), 44);
  });

  test(`${card} malformed dial values never produce NaN markers or inverted fallback ranges`, () => {
    for (const raw of [undefined, "bad", Infinity, NaN, {}]) {
      const model = api.getCircularLayoutDialModel(raw, 150, "bad");
      assert.equal(model.progress, 0);
      assert.ok(Number.isFinite(model.markerLeft));
      assert.ok(Number.isFinite(model.markerTop));
    }
    assert.equal(api.getCircularLayoutDialModel(60, 60, 60).progress, 0);
    assert.equal(api.getCircularLayoutDialValueFromPoint(null, 140, 64, { min: 150, max: "bad" }, 0.5, 150, rectangle), 150.5);
    assert.equal(api.isUnavailableState({ state: "unavailable" }), true);
    assert.equal(api.isUnavailableState({ state: "unknown" }), card === "cover");
  });
}

test("Cover retains service-data cloning and domain icon policies", () => {
  const api = loadHelpers("cover");
  const raw = { target: { entity_id: "cover.window" } };
  const copy = api.parseServiceData(raw);
  copy.target.entity_id = "cover.other";
  assert.equal(raw.target.entity_id, "cover.window");
  assert.deepEqual(plain(api.parseServiceData('{"position":75}')), { position: 75 });
  for (const value of ["bad", "[]", "null", false]) assert.deepEqual(plain(api.parseServiceData(value)), {});
  assert.deepEqual(plain(api.resolveOpenCloseControlIcons("auto", "garage")), { open: "mdi:arrow-right", close: "mdi:arrow-left" });
  assert.deepEqual(plain(api.resolveOpenCloseControlIcons("vertical", "garage")), { open: "mdi:arrow-up", close: "mdi:arrow-down" });
  assert.equal(api.coverDeviceIcon({ state: "closed", attributes: { device_class: "curtain" } }), "mdi:curtains-closed");
});
