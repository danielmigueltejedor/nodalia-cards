import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadMediaPlayerApi() {
  const sandbox = {
    URL,
    window: null,
    customElements: { define() {}, get() { return null; } },
    HTMLElement: class { attachShadow() { this.shadowRoot = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } }; } },
    globalThis: {},
    document: { createElement() { return {}; }, addEventListener() {}, removeEventListener() {} },
    matchMedia: () => ({ matches: false }),
    Image: class { set src(_) {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: cb => { cb(); return 1; },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-media-player.js"), sandbox);
  return sandbox.__NODALIA_MEDIA_PLAYER__ || sandbox.window.__NODALIA_MEDIA_PLAYER__;
}

function same(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
}

test("media player layouts stay stable across nearby size changes", () => {
  const api = loadMediaPlayerApi();
  assert.equal(api.resolvePresentationMode("square"), "square");
  assert.equal(api.resolvePresentationMode("horizontal"), "chip");
  assert.equal(api.resolvePresentationMode("auto", { width: 180, height: 180 }), "square");
  assert.equal(api.resolvePresentationMode("auto", { width: 520, height: 96 }), "chip");
  assert.equal(api.resolvePresentationMode("auto", { width: 220, height: 160 }), "compact");
  assert.equal(api.resolvePresentationMode("auto", { width: 210, height: 160 }, "square"), "square");
});

test("recent artwork history skips consecutive duplicates and respects the cap", () => {
  const api = loadMediaPlayerApi();
  same(api.rememberRecentArtwork([], "a.jpg", 3), ["a.jpg"]);
  same(api.rememberRecentArtwork(["a.jpg"], "a.jpg", 3), ["a.jpg"]);
  same(api.rememberRecentArtwork(["a.jpg"], "b.jpg", 3), ["b.jpg", "a.jpg"]);
  same(
    api.rememberRecentArtwork(["c.jpg", "b.jpg", "a.jpg"], "d.jpg", 3),
    ["d.jpg", "c.jpg", "b.jpg"],
  );
});

test("palette extraction failure returns null instead of throwing", () => {
  const api = loadMediaPlayerApi();
  assert.equal(api.extractArtworkPalette({}), null);
});

test("playback progress interpolates while playing and stops when paused", () => {
  const api = loadMediaPlayerApi();
  const now = Date.parse("2026-09-17T10:00:10.000Z");
  const playing = api.interpolatePlaybackProgress({
    state: "playing",
    attributes: {
      media_duration: 100,
      media_position: 20,
      media_position_updated_at: "2026-09-17T10:00:00.000Z",
    },
  }, now);
  assert.equal(playing?.position, 30);
  assert.equal(playing?.percent, 30);

  const paused = api.interpolatePlaybackProgress({
    state: "paused",
    attributes: {
      media_duration: 100,
      media_position: 20,
      media_position_updated_at: "2026-09-17T10:00:00.000Z",
    },
  }, now);
  assert.equal(paused?.position, 20);
});

test("seek is detected from supported_features and string layout becomes layout.mode", () => {
  const api = loadMediaPlayerApi();
  assert.equal(api.supportsMediaSeek({ attributes: { supported_features: 0 } }), false);
  assert.equal(api.supportsMediaSeek({ attributes: { supported_features: 2 } }), true);
  const config = api.normalizeConfig({
    entity: "media_player.kitchen",
    layout: "square",
  });
  assert.equal(config.layout.mode, "square");
  assert.equal(config.layout.fixed, false);
  assert.equal(config.artwork.mode, "immersive");
  assert.ok(config.artwork.blur < 18);
});

test("media player keeps a persistent artwork stage and vacuum keeps a persistent surface", () => {
  const media = read("src/cards/media-player/media-player-card.ts");
  assert.match(media, /_commitPersistentMediaShadow\(/);
  assert.match(media, /data-media-art-stage/);
  assert.match(media, /data-media-progress/);
  assert.doesNotMatch(media, /this\.shadowRoot\.innerHTML = `\s*<style>/);
  const vacuum = read("nodalia-advance-vacuum-card.js");
  assert.match(vacuum, /_commitPersistentVacuumShadow\(/);
  assert.match(vacuum, /data-vacuum-surface/);
});
