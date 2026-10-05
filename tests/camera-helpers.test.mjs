import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";
function load(extra = {}, source = "camera-helpers") {
  const box = { URL, location: { origin: "https://ha.example", protocol: "https:" }, ...extra };
  box.window = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync("nodalia-utils.js", "utf8"), box);
  vm.runInContext(fs.readFileSync("nodalia-camera-stream-model.js", "utf8"), box);
  vm.runInContext(source === "camera-helpers" && process.env.NODALIA_AUDIT_CAMERA_SOURCE ? fs.readFileSync(process.env.NODALIA_AUDIT_CAMERA_SOURCE, "utf8") : buildSync({ entryPoints: [`src/cards/camera/${source}.ts`], bundle: true, write: false, format: "iife", globalName: "api" }).outputFiles[0].text, box);
  return box.api;
}
const api = load();
const plain = value => JSON.parse(JSON.stringify(value));

test("Camera array-aware editor paths preserve list rows and protect inherited/prototype branches", () => {
  const target = {};
  api.setByPath(target, "camera_streams.0.mode", "mse");
  assert.deepEqual(plain(target), { camera_streams: [{ mode: "mse" }] });
  for (const path of ["__proto__.polluted", "rows.constructor.polluted", "rows.0.__proto__.polluted"]) api.setByPath(target, path, true);
  assert.equal(Object.prototype.polluted, undefined);
  const parent = { branch: { old: true } }, child = Object.create(parent);
  api.setByPath(child, "branch.new", true);
  assert.deepEqual(parent.branch, { old: true });
  assert.deepEqual(plain(child.branch), { new: true });
  api.setByPath(target, "camera_streams.bad.value", true);
  assert.deepEqual(plain(target.camera_streams), [{ mode: "mse" }]);
});

test("Camera normalizers preserve scoped actions, provider aliases and malformed-list fallbacks", () => {
  assert.deepEqual(plain(api.normalizeCameras({ cameras: ["camera.one", { entity_id: "camera.two" }, "camera.one"], entity: "camera.three" })), ["camera.one", "camera.two", "camera.three"]);
  const actions = api.normalizeCameraTapActions([{ camera: "camera.one", tap_action: { action: "navigate", navigation_path: "/lovelace/one" } }, { camera: "camera.other", tap_action: "none" }], ["camera.one"]);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].tap_action, "navigate");
  assert.equal(actions[0].navigation_path, "/lovelace/one");
  assert.deepEqual(plain(api.normalizeCameraStreams([], {})), []);
  assert.deepEqual(plain(api.normalizeCameraTapActions([], false)), []);
  assert.equal(api.normalizeCameraStreams([{ camera: "camera.one", provider: "advanced_camera_card" }], ["camera.one"])[0].provider, "frigate_go2rtc");
  for (const input of [null, false, {}, "bad"]) for (const name of ["compactCameraStreams", "compactCameraTapActions", "normalizeCameraStreams", "normalizeCameraTapActions"]) assert.deepEqual(plain(api[name](input)), []);
});

test("Camera checked configuration preserves YAML extensions and sanitized styles/actions", () => {
  const configApi = load({}, "camera-config");
  for (const input of [null, false, [], "bad"]) assert.equal(configApi.normalizeConfig(input).layout, "mosaic");
  const input = { entity: "camera.one", extension: { marker: 1 }, styles: { preview: { overlay_strength: 0.2 }, card: false }, tap_action: { action: "call-service", service: "camera.turn_on", data: { mode: "auto" } } };
  const config = configApi.normalizeConfig(input);
  assert.equal(config.tap_action, "service");
  assert.equal(config.tap_service, "camera.turn_on");
  assert.equal(config.tap_service_data, '{"mode":"auto"}');
  assert.equal(config.styles.preview.overlay_strength, 0.2);
  assert.deepEqual(plain(config.extension), { marker: 1 });
  assert.equal(input.tap_action.action, "call-service");
});

test("Camera signed-path cache coalesces requests, respects short expiry and connection ownership", async () => {
  let now = 0, calls = 0;
  class Clock extends Date { static now() { return now; } }
  const checked = load({ Date: Clock });
  const connection = {};
  const hass = { connection, hassUrl: path => "https://ha.example" + path, callWS: async request => { calls++; assert.equal(request.type, "auth/sign_path"); return { path: "/signed?token=" + calls }; } };
  const first = await Promise.all([checked.signHomeAssistantPath(hass, "/stream", 10), checked.signHomeAssistantPath(hass, "/stream", 10)]);
  assert.equal(calls, 1);
  assert.equal(first[0], first[1]);
  now = 9_999;
  assert.equal(await checked.signHomeAssistantPath({ ...hass }, "/stream", 10), first[0]);
  now = 10_000;
  assert.notEqual(await checked.signHomeAssistantPath(hass, "/stream", 10), first[0]);
  assert.equal(calls, 2);
  await checked.signHomeAssistantPath({ ...hass, connection: {} }, "/stream", 10);
  assert.equal(calls, 3);
});

test("Camera signed paths reject malformed wire responses and retry without caching rejection", async () => {
  let calls = 0;
  const hass = { connection: {}, callWS: async () => { calls++; return calls === 1 ? { path: 123 } : { path: "/signed?token=valid" }; } };
  await assert.rejects(api.signHomeAssistantPath(hass, "/stream"), /empty signed/);
  assert.equal(await api.signHomeAssistantPath(hass, "/stream"), "https://ha.example/signed?token=valid");
  assert.equal(calls, 2);
  assert.equal(await api.signHomeAssistantPath(null, "/stream"), "");
});

test("Camera preview age and service-data helpers guard malformed input while preserving actual epoch", () => {
  assert.equal(api.formatRelativeAge(null, "en", 1000), "");
  assert.equal(api.formatRelativeAge(0, "en", 1000), "1 sec. ago");
  assert.equal(api.formatRelativeAge("2026-10-01", "en", Infinity), "");
  assert.deepEqual(plain(api.parseServiceData('{"mode":"auto"}')), { mode: "auto" });
  assert.deepEqual(plain(api.parseServiceData("[]")), {});
  assert.deepEqual(plain(api.parseCameraProxyAuth("/api/camera_proxy/camera.one?token=abc")), { entityId: "camera.one", accessToken: "abc" });
});

test("Camera appends rather than replaces query keys while preserving URL fragments", () => {
  assert.equal(api.appendQueryParam("/preview?token=one#frame", "token", "two"), "/preview?token=one&token=two#frame");
  assert.equal(api.appendQueryParam("/preview#frame", "cache", 0), "/preview?cache=0#frame");
});

for(const change of ['user','auth'])test(`Camera signed paths never reuse a rotated ${change} context`, async () => {
 const checked=load();let calls=0;
 const hass={connection:{},auth:{},user:{id:'first',is_admin:true},callWS:async()=>({path:'/signed/'+(++calls)})};
 const first=await checked.signHomeAssistantPath(hass,'/one');if(change==='user')hass.user.id='second';else hass.auth={};
 assert.notEqual(await checked.signHomeAssistantPath(hass,'/one'),first);assert.equal(calls,2);
});
test('Camera signed paths keep a bounded per-owner cache',async()=>{
 const checked=load(),hass={connection:{},callWS:async()=>({path:'/signed'})};
 for(let n=0;n<150;n++)await checked.signHomeAssistantPath(hass,'/stream/'+n);
 assert.ok(checked.signedPathCacheForHass(hass).size<=64);
});
