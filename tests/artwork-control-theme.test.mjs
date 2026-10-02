import test from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import vm from "node:vm";

const source = buildSync({ entryPoints: ["src/cards/media-player/media-player-artwork.ts"], bundle: true, write: false, format: "iife", globalName: "artwork" }).outputFiles[0].text;
function palette(pixels, throwOnRead = false) {
  const sandbox = { document: { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData() {
    if (throwOnRead) throw new Error("Tainted canvas");
    return { data: new Uint8ClampedArray(pixels) };
  } }) }) } };
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  return sandbox.artwork.extractArtworkPalette({});
}
test("artwork control foreground meets 4.5:1 across the RGB cube including extremes", () => {
  const linear = value => value / 255 <= 0.04045 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4;
  for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51) {
    const result = palette([r, g, b, 255]);
    const luminance = linear(r) * 0.2126 + linear(g) * 0.7152 + linear(b) * 0.0722;
    const contrast = result.foreground === "dark" ? (luminance + 0.05) / 0.05 : 1.05 / (luminance + 0.05);
    assert.ok(contrast >= 4.5, `${r},${g},${b}: ${contrast}`);
  }
});
test("transparent, empty and unreadable artwork use the theme fallback", () => {
  assert.equal(palette([255, 0, 0, 0]), null);
  assert.equal(palette([]), null);
  assert.equal(palette([255, 0, 0, 255], true), null);
});

const themeSource = buildSync({ entryPoints: ["src/cards/media-player/media-player-control-theme.ts"], bundle: true, write: false, format: "iife", globalName: "theme" }).outputFiles[0].text;
test("late artwork responses cannot overwrite a newer palette or a reset", async () => {
  const images = [];
  const sandbox = {
    setTimeout, clearTimeout,
    ShadowRoot: class { constructor(host) { this.host = host; } },
    Image: class { constructor() { images.push(this); } },
    document: { createElement: () => {
      let image;
      return { getContext: () => ({ drawImage(value) { image = value; }, getImageData() {
        return { data: new Uint8ClampedArray(image.src === "new" ? [0, 255, 0, 255] : [0, 0, 255, 255]) };
      } }) };
    } },
  };
  vm.createContext(sandbox); vm.runInContext(themeSource, sandbox);
  const properties = new Map(), attributes = new Set();
  const owner = {};
  const host = { getRootNode: () => new sandbox.ShadowRoot(owner), isConnected: true, style: { setProperty: (k, v) => properties.set(k, v), removeProperty: k => properties.delete(k) }, setAttribute: k => attributes.add(k), removeAttribute: k => attributes.delete(k) };
  const old = sandbox.theme.applyArtworkControlTheme(host, "old");
  const fresh = sandbox.theme.applyArtworkControlTheme(host, "new");
  images[1].onload(); await fresh;
  images[0].onload(); await old;
  assert.equal(properties.get("--media-control-tint"), "rgb(0, 255, 0)");
  const replacementProperties = new Map();
  const replacement = { ...host, style: { setProperty: (k, v) => replacementProperties.set(k, v), removeProperty: k => replacementProperties.delete(k) } };
  const restored = sandbox.theme.applyArtworkControlTheme(replacement, "new");
  assert.equal(replacementProperties.get("--media-control-tint"), "rgb(0, 255, 0)", "cache is applied before any await");
  await restored;
  assert.equal(replacementProperties.get("--media-control-tint"), "rgb(0, 255, 0)", "restore the tint synchronously when an inner card is recreated");
  const late = sandbox.theme.applyArtworkControlTheme(host, "late");
  assert.equal(properties.get("--media-control-tint"), "rgb(0, 255, 0)", "keep the last tint while the next image is pending");
  await sandbox.theme.applyArtworkControlTheme(host, "");
  images[2].onload(); await late;
  assert.equal(attributes.has("data-artwork-controls"), false);
  assert.equal(properties.size, 0);
});

test("replacement artwork waits for its palette, ignores stale requests and recovers from stalled images", async () => {
  const images = [], timers = new Map();
  let timerId = 0;
  const sandbox = {
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    Image: class { constructor() { images.push(this); } },
    document: { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData() {
      return { data: new Uint8ClampedArray([255, 0, 0, 255]) };
    } }) }) },
  };
  vm.createContext(sandbox); vm.runInContext(themeSource, sandbox);
  const owner = { isConnected: true };
  let renders = 0;
  const prepare = url => sandbox.theme.prepareArtworkTheme(owner, url, true, () => { renders++; });
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  assert.equal(prepare("old"), false);
  assert.equal(prepare("old"), false);
  assert.equal(images.length, 1, "coalesce requests for the same cover");
  assert.equal(prepare("new"), false);
  images[0].onload(); await flush();
  assert.equal(renders, 0, "the previous track must not commit");
  images[1].onload(); await flush();
  assert.equal(renders, 1);
  assert.equal(prepare("new"), true, "known covers never wait");
  assert.equal(prepare("stalled"), false);
  for (const callback of [...timers.values()]) callback();
  await flush();
  assert.equal(renders, 2);
  assert.equal(prepare("stalled"), true, "network failure cannot freeze the player");
  assert.equal(images[2].onload, null, "late image handlers are detached");
  assert.equal(prepare("removed"), false);
  owner.isConnected = false;
  images[3].onerror(); await flush();
  assert.equal(renders, 2, "disconnected cards are not rerendered");
  owner.isConnected = true;
  assert.equal(prepare("prior-context"), false);
  sandbox.theme.releaseArtworkTheme(owner);
  images[4].onload(); await flush();
  assert.equal(renders, 2, "a released context cannot commit a deferred cover on the reconnected owner");
  assert.equal(prepare("prior-context"), true, "the shared sampled palette remains reusable by the new context");
});

test("artwork identity survives volume and progress updates but changes with the track", () => {
  const sandbox = {};
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  const state = { entity_id: "media_player.test", state: "playing", last_updated: "old", attributes: {
    entity_picture: "/api/media_player_proxy/test", media_content_id: "track-1", media_title: "Song", volume_level: 0.2,
  } };
  const token = sandbox.artwork.artworkCacheToken(state);
  const changedVolume = { ...state, last_updated: "new", attributes: { ...state.attributes, volume_level: 0.8, media_position: 30 } };
  assert.equal(sandbox.artwork.artworkCacheToken(changedVolume), token);
  assert.notEqual(sandbox.artwork.artworkCacheToken({ ...state, attributes: { ...state.attributes, media_content_id: "track-2" } }), token);
  assert.notEqual(sandbox.artwork.artworkCacheToken({ ...state, attributes: { ...state.attributes, entity_picture: "/new-cover" } }), token);
});
