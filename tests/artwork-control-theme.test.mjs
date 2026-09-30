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
  const host = { getRootNode: () => ({ host: owner }), isConnected: true, style: { setProperty: (k, v) => properties.set(k, v), removeProperty: k => properties.delete(k) }, setAttribute: k => attributes.add(k), removeAttribute: k => attributes.delete(k) };
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
