import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";

const box = { URL, location: { origin: "https://ha.example" } };
box.window = box;
vm.createContext(box);
vm.runInContext(fs.readFileSync("nodalia-utils.js", "utf8"), box);
vm.runInContext(buildSync({ entryPoints: ["src/cards/navigation/navigation-helpers.ts"], bundle: true, write: false, format: "iife", globalName: "api" }).outputFiles[0].text, box);
const api = box.api;
const plain = value => JSON.parse(JSON.stringify(value));

test("Navigation artwork query parameters retain fragments and match literal parameter names", () => {
  assert.equal(api.appendQueryParam("/cover.jpg#art", "nodalia_ts", 12), "/cover.jpg?nodalia_ts=12#art");
  assert.equal(api.appendQueryParam("/cover.jpg?a=1&nodalia_ts=9#art", "nodalia_ts", 12), "/cover.jpg?a=1&nodalia_ts=12#art");
  assert.equal(api.appendQueryParam("/cover?aXb=1&a.b=2", "a.b", "x y"), "/cover?aXb=1&a.b=x%20y");
  assert.equal(api.appendQueryParam("/cover?x=1#frag?nodalia_ts=7", "nodalia_ts", 0), "/cover?x=1&nodalia_ts=0#frag?nodalia_ts=7");
  assert.equal(api.appendQueryParam(" /cover#art ", "x", null), "/cover#art");
});

test("Shared object-only editor paths retain numeric object keys and protect prototypes", () => {
  const target = {};
  api.setByPath(target, "media_player.artwork.mode", "blur");
  api.setByPath(target, "items.0.name", "one");
  assert.deepEqual(plain(target), { media_player: { artwork: { mode: "blur" } }, items: { 0: { name: "one" } } });
  api.deleteByPath(target, "media_player.artwork.mode");
  assert.deepEqual(plain(target.media_player), { artwork: {} });
  for (const path of ["__proto__.polluted", "nested.constructor.polluted", "nested.prototype.polluted"]) api.setByPath(target, path, true);
  assert.equal(Object.prototype.polluted, undefined);
  const inherited = { branch: { name: "original" } };
  const child = Object.create(inherited);
  api.deleteByPath(child, "branch.name");
  assert.equal(inherited.branch.name, "original");
  api.setByPath(child, "branch.name", "own");
  assert.equal(inherited.branch.name, "original");
  assert.equal(child.branch.name, "own");
  for (const malformed of [null, false, [], "bad"]) {
    api.setByPath(malformed, "a.b", 1);
    api.deleteByPath(malformed, "a.b");
  }
});

test("Navigation list reordering mutates the existing list and ignores malformed indices", () => {
  const items = ["a", "b", "c"];
  assert.equal(api.moveItem(items, 0, 2), items);
  assert.deepEqual(items, ["b", "c", "a"]);
  for (const indices of [[-1, 1], [0, 3], [0.5, 1], [0, NaN], [Infinity, 0]]) api.moveItem(items, ...indices);
  assert.deepEqual(items, ["b", "c", "a"]);
  assert.equal(api.moveItem(null, 0, 1), null);
});

test("Navigation route matching respects segment boundaries and normalized query-free paths", () => {
  assert.equal(api.normalizePath("/lovelace/home/?x=1#tab"), "/lovelace/home");
  assert.equal(api.normalizePath("/"), "/");
  assert.equal(api.normalizePath("https://other.example/home"), null);
  assert.equal(api.normalizePath({}), null);
  assert.equal(api.matchPath("/lovelace/home/sub", "/lovelace/home", "prefix"), true);
  assert.equal(api.matchPath("/lovelace/home-other", "/lovelace/home", "prefix"), false);
  assert.equal(api.matchPath("/lovelace/home/sub", "/lovelace/home", "exact"), false);
  assert.equal(api.matchPath(null, "/lovelace/home", "prefix"), false);
});

test("Navigation artwork URLs preserve HA expansion and reject executable schemes", () => {
  const hass = { hassUrl: path => "https://ha.example" + path };
  assert.equal(api.sanitizeMediaArtworkUrl("/api/artwork?id=1", hass), "https://ha.example/api/artwork?id=1");
  assert.equal(api.sanitizeMediaArtworkUrl("https://cdn.example/art.jpg", hass), "https://cdn.example/art.jpg");
  assert.equal(api.sanitizeMediaArtworkUrl("javascript:alert(1)", hass), "");
  assert.equal(api.sanitizeMediaArtworkUrl("data:text/html,x", hass), "");
});

test("Navigation retains shared signature fallback and optional existing runtime identity", () => {
  const fallback = api.getRenderSignatureRuntime();
  assert.equal(fallback.joinParts([{ prefix: "x:", values: [null, 0, Infinity, "yes"] }, { values: [] }, null]), "x:::0::::yes");
  const existing = { toKey: String, joinParts: () => "existing" };
  box.NodaliaRenderSignature = existing;
  assert.equal(api.getRenderSignatureRuntime(), existing);
});

test("Navigation duration and primitive helpers preserve valid values and reject malformed runtime styles", () => {
  assert.equal(api.formatDuration(3661.9), "1:01:01");
  assert.equal(api.formatDuration("61"), "1:01");
  for (const value of [null, undefined, NaN, Infinity, -5, Symbol("bad"), {}]) assert.equal(api.formatDuration(value), "0:00");
  assert.equal(api.parsePrimitiveValue("true"), true);
  assert.equal(api.parsePrimitiveValue("-2.5"), -2.5);
  assert.equal(api.parsePrimitiveValue("1e3"), "1e3");
  assert.equal(api.sanitizeCssRuntimeValue("color-mix(in srgb, red 25%, transparent)"), "color-mix(in srgb, red 25%, transparent)");
  for (const value of ["url(/bad)", "red; width:100px", "red\u0001blue", "/*bad*/red"]) assert.equal(api.sanitizeCssRuntimeValue(value), "");
});
