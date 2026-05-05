import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("graph tooltip keeps document hover watch guards", () => {
  const source = read("nodalia-graph-card.js");
  assert.match(source, /_onDocumentPointerMove\(/);
  assert.match(source, /_attachDocumentHoverWatch\(/);
  assert.match(source, /_detachDocumentHoverWatch\(/);
  assert.match(source, /document\.addEventListener\("pointermove", this\._onDocumentPointerMove, true\)/);
  assert.match(source, /document\.removeEventListener\("pointermove", this\._onDocumentPointerMove, true\)/);
  assert.match(source, /_scheduleHoverRender\(null\)/);
});

test("nav media/popup entrance animations are transition-driven", () => {
  const source = read("nodalia-navigation-bar.js");
  assert.match(source, /_lastMediaToggleVisible/);
  assert.match(source, /_playPopupEntrance/);
  assert.match(source, /media-player-toggle--entering/);
  assert.match(source, /popup-panel--entering/);
  assert.match(source, /playMediaToggleEntrance = .*?!this\._lastMediaToggleVisible/);
});

test("service-security controls are exposed in visual editors", () => {
  const files = [
    "nodalia-insignia-card.js",
    "nodalia-entity-card.js",
    "nodalia-fav-card.js",
    "nodalia-advance-vacuum-card.js",
  ];

  files.forEach(file => {
    const source = read(file);
    assert.match(source, /security\.strict_service_actions/);
    assert.match(source, /security\.allowed_services/);
    assert.match(source, /valueType:\s*"csv"|data-value-type="\$\{escapeHtml\(valueType\)\}"/);
  });
});
