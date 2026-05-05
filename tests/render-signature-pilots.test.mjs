import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("navigation card uses modular render signature helpers", () => {
  const source = read("nodalia-navigation-bar.js");
  assert.match(source, /_getRouteBadgeSignatureRows\(/);
  assert.match(source, /_getMediaPlayerSignatureRows\(/);
  assert.match(source, /getRenderSignatureRuntime\(/);
});

test("graph card uses non-JSON render signature strategy", () => {
  const source = read("nodalia-graph-card.js");
  assert.match(source, /_getTrackedStateSignatureRows\(/);
  assert.match(source, /getRenderSignatureRuntime\(/);
  assert.doesNotMatch(source, /return JSON\.stringify\(\{\s*trackedStates/s);
});

test("media player render signature uses shared runtime helper", () => {
  const source = read("nodalia-media-player.js");
  assert.match(source, /getRenderSignatureRuntime\(/);
  assert.match(source, /runtime\.joinParts\(/);
});
