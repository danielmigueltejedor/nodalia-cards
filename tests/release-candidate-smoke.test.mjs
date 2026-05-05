import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("url openings keep noopener,noreferrer hardening", () => {
  const files = [
    "nodalia-insignia-card.js",
    "nodalia-entity-card.js",
    "nodalia-fav-card.js",
    "nodalia-navigation-bar.js",
    "nodalia-advance-vacuum-card.js",
  ];
  files.forEach(file => {
    const source = read(file);
    assert.match(source, /window\.open\([^)]*"noopener,noreferrer"\)/);
  });
});

test("action URL sinks use sanitizeActionUrl", () => {
  const files = [
    "nodalia-insignia-card.js",
    "nodalia-entity-card.js",
    "nodalia-fav-card.js",
    "nodalia-navigation-bar.js",
    "nodalia-media-player.js",
    "nodalia-advance-vacuum-card.js",
  ];
  files.forEach(file => {
    const source = read(file);
    assert.match(source, /sanitizeActionUrl\(/);
  });
});

test("high-frequency cards share render signature runtime", () => {
  const files = [
    "nodalia-navigation-bar.js",
    "nodalia-graph-card.js",
    "nodalia-media-player.js",
  ];
  files.forEach(file => {
    const source = read(file);
    assert.match(source, /getRenderSignatureRuntime\(/);
    assert.match(source, /window\.NodaliaRenderSignature/);
  });
});

test("drag listeners stay attach-on-drag only", () => {
  const files = [
    "nodalia-light-card.js",
    "nodalia-fan-card.js",
    "nodalia-humidifier-card.js",
  ];
  files.forEach(file => {
    const source = read(file);
    assert.match(source, /_dragWindowListenersAttached/);
    assert.match(source, /_attachWindowDragListeners\(/);
    assert.match(source, /_detachWindowDragListeners\(/);
  });
});
