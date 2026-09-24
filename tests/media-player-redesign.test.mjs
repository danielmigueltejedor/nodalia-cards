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
  assert.equal(api.resolvePresentationMode("auto", { width: 180, height: 180 }), "compact");
  assert.equal(api.resolvePresentationMode("auto", { width: 400, height: 96 }), "square");
  assert.equal(api.resolvePresentationMode("auto", { width: 220, height: 160 }), "compact");
  assert.equal(api.resolvePresentationMode("auto", { width: 220, height: 160 }, "compact"), "compact");
  assert.equal(api.resolvePresentationMode("auto", { width: 320, height: 160 }, "compact"), "square");
  assert.equal(api.resolvePresentationMode("auto", { width: 210, height: 160 }, "square"), "compact");
  assert.equal(api.resolvePresentationMode("auto", { width: 1000, height: 96 }), "chip");
  // Wide / >6-column spans stay standard so the entity icon hero remains visible.
  assert.equal(api.resolvePresentationMode("auto", { width: 560, height: 200 }), "standard");
  assert.equal(
    api.resolvePresentationMode("auto", { width: 400, height: 200 }, "square", { gridColumns: 8 }),
    "standard",
  );
  assert.equal(
    api.resolvePresentationMode("auto", { width: 400, height: 200 }, "", { gridColumns: 12 }),
    "standard",
  );
  assert.equal(
    api.resolvePresentationMode("auto", { width: 220, height: 160 }, "", { preferSquareTiles: false }),
    "compact",
  );
  assert.equal(
    api.resolvePresentationMode("auto", { width: 340, height: 340 }, "square", { preferSquareTiles: false }),
    "standard",
  );
  assert.equal(
    api.resolvePresentationMode("auto", { width: 180, height: 180 }, "square", { preferSquareTiles: false }),
    "compact",
  );
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

test("stacked media players drop leftover album art when the next player has none", async () => {
  const api = loadMediaPlayerApi();
  const classList = () => {
    const classes = new Set();
    return {
      add: name => classes.add(name),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      toggle(name, force) {
        if (force) {
          classes.add(name);
          return;
        }
        classes.delete(name);
      },
      contains: name => classes.has(name),
    };
  };
  const current = { style: { backgroundImage: 'url("cover-living.jpg")' }, classList: classList() };
  const incoming = { style: { backgroundImage: 'url("cover-living.jpg")' }, classList: classList() };
  const stage = { style: { removeProperty() {}, setProperty() {} } };
  const controller = new api.MediaPlayerArtworkController();
  controller.attach({ stage, current, incoming });
  controller.currentUrl = "cover-living.jpg";
  controller.remember("cover-living.jpg", 8, "media_player.living");

  const cleared = await controller.show("", { entityId: "media_player.kitchen" });

  assert.equal(cleared, false);
  assert.equal(controller.currentUrl, "");
  assert.equal(current.style.backgroundImage, "");
  assert.equal(incoming.style.backgroundImage, "");
  same(controller.recentFor("media_player.living"), ["cover-living.jpg"]);
  same(controller.recentFor("media_player.kitchen"), []);

  const media = read("src/cards/media-player/media-player-card.ts");
  assert.match(media, /this\._artworkController\.clear\(/);
  assert.match(media, /recentFor\(artworkEntityId\)/);
  assert.match(media, /Boolean\(this\._activeArtworkUrl \|\| keepIdleArtwork\)/);
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
  assert.equal(config.artwork.blur, 0);
  assert.ok(config.artwork.blur < 18);
});

test("media player controls follow the Nodalia bubble recipe and keep square layouts unclipped", () => {
  const api = loadMediaPlayerApi();
  const styles = api.normalizeConfig({}).styles.player;
  assert.equal(styles.control_size, "36px");
  assert.equal(styles.title_size, "15px");

  const source = read("src/cards/media-player/media-player-card.ts");
  assert.match(source, /0 10px 24px rgba\(0, 0, 0, 0\.28\)/);
  assert.match(source, /backdrop-filter: blur\(22px\) saturate\(1\.35\)/);
  assert.match(source, /--mdc-icon-size: calc\(\$\{playerStyles\.control_size\} \* 0\.46\)/);
  assert.doesNotMatch(source, /media-player__transport-addon/);
  assert.doesNotMatch(source, /padding-top: 28%/);
  assert.match(source, /:host\(\[data-presentation="square"\]\)/);
  assert.match(source, /aspect-ratio: 1 \/ 1/);
  assert.match(source, /align-content: stretch/);
  assert.match(source, /media-player-card--square \.media-player__volume-button--browse/);
  assert.match(source, /media-player-card--square \.media-player__progress/);
  assert.match(source, /position: static/);
  assert.match(source, /\.media-player-card--square \.media-player__album-bg[\s\S]*filter: none/);
  assert.match(source, /:not\(\.media-player-card--square\):not\(\.media-player-card--artwork\) \.media-player__hero/);
  const layout = read("src/cards/media-player/media-player-layout.ts");
  assert.match(layout, /min_rows: 2/);
});

test("media player idle compact keeps name and power on one row", () => {
  const source = read("src/cards/media-player/media-player-card.ts");
  assert.match(source, /media-player__idle-name/);
  assert.match(source, /media-player__idle-hero--tv-off/);
  assert.match(source, /\.media-player-card--idle \{[\s\S]*?min-height: 68px;/);
  assert.match(source, /\.media-player-card--tv\.media-player-card--idle \.media-player__idle-hero--tv-off \{[\s\S]*?grid-template-columns: 38px minmax\(0, 1fr\) auto;/);
  assert.match(source, /\.media-player-card--tv\.media-player-card--idle \.media-player__artwork--idle \{[\s\S]*?height: 38px;/);
  assert.match(source, /@media \(max-width: 420px\) \{[\s\S]*?\.media-player__artwork--idle[\s\S]*?height: 50px;/);
  assert.match(source, /\.media-player-card--compact\.media-player-card--idle \{[\s\S]*?align-items: stretch;/);
  assert.doesNotMatch(source, /idle-tv-off-bar/);
});

test("compact and square media player hide the device chip beside browse", () => {
  const source = read("src/cards/media-player/media-player-card.ts");
  assert.match(
    source,
    /\.media-player-card--compact \.media-player__info-rail,[\s\S]*?\.media-player-card--compact \.media-player__chip--device \{[\s\S]*?display: none;/,
  );
  assert.match(
    source,
    /\.media-player-card--square \.media-player__chip--device,[\s\S]*?\.media-player-card--artwork \.media-player__chip--device \{[\s\S]*?display: none;/,
  );
});

test("square media player overlay keeps the name chip off the transport row", () => {
  const source = read("src/cards/media-player/media-player-card.ts");
  assert.match(source, /container-type: inline-size;/);
  assert.match(source, /grid-template-rows: auto minmax\(0, 1fr\) auto;/);
  assert.match(source, /@container \(max-width: 260px\) \{[\s\S]*?\.media-player__info-rail \{[\s\S]*?display: none;/);
  assert.match(source, /\.media-player-card--square \.media-player__center-stack,[\s\S]*?grid-row: 3;/);
});

test("square media player overlay stays a tile instead of collapsing to a chip", () => {
  const source = read("src/cards/media-player/media-player-card.ts");
  assert.match(source, /:host\(\[data-presentation="square"\]\)/);
  assert.match(source, /preferSquareTiles = Boolean\(!isTvPlayer && !isIdleLayout && artworkUrl\)/);
  assert.doesNotMatch(source, /height: auto !important;/);
  const layout = read("src/cards/media-player/media-player-layout.ts");
  assert.match(layout, /CHIP_MIN_WIDTH = 960/);
  assert.match(layout, /SQUARE_MAX_WIDTH = 480/);
  assert.match(layout, /WIDE_GRID_COLUMNS = 6/);
  assert.match(layout, /canAutoSquare\(/);
  assert.match(source, /has-album-background \.media-player__artwork/);
});

test("media player artwork containers share one border radius", () => {
  const source = read("src/cards/media-player/media-player-card.ts");
  assert.match(source, /\.media-player__artwork \{[\s\S]*?border-radius: 22px;/);
  // Idle tiles mirror Fav/Light circular icons instead of the square artwork radius.
  assert.match(source, /\.media-player__artwork--idle \{[\s\S]*?border-radius: 999px;/);
  assert.doesNotMatch(source, /\.media-player-card--tv \.media-player__artwork \{[^}]*border-radius:/);
  assert.doesNotMatch(source, /\.media-player-card--chip \.media-player__artwork \{[^}]*border-radius:/);
  assert.doesNotMatch(source, /\.media-player-card--compact \.media-player__artwork \{[^}]*border-radius:/);
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
