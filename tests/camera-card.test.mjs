import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadCameraHelpers() {
  const source = read("nodalia-camera-card.js");
  const helperSource = `${source.split("class NodaliaCameraCard")[0]}
    globalThis.__cameraHelpers = {
      normalizeConfig,
      DEFAULT_CONFIG,
      LAYOUT_MODES,
    };
  `;
  const sandbox = {
    URL,
    window: null,
    customElements: { define() {}, get() {} },
    HTMLElement: class {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(helperSource, sandbox);
  return sandbox.__cameraHelpers;
}

const helpers = loadCameraHelpers();

test("camera card registers custom element and bundle entry", () => {
  const source = read("nodalia-camera-card.js");
  const build = read("scripts/build-bundle.mjs");
  const pkg = JSON.parse(read("package.json"));

  assert.match(source, /const CARD_TAG = "nodalia-camera-card"/);
  assert.match(source, /customElements\.define\(CARD_TAG, NodaliaCameraCard\)/);
  assert.match(source, /registerCustomCard/);
  assert.match(build, /nodalia-camera-card\.js/);
  assert.ok(pkg.files.includes("nodalia-camera-card.js"));
});

test("camera normalizeConfig accepts layout and tap action objects", () => {
  const config = helpers.normalizeConfig({
    entity: "camera.entrada",
    layout: "security",
    tap_action: {
      action: "perform-action",
      perform_action: "camera.turn_on",
      data: { entity_id: "camera.entrada" },
    },
    hold_action: "none",
  });

  assert.equal(config.entity, "camera.entrada");
  assert.equal(config.layout, "security");
  assert.equal(config.tap_action, "service");
  assert.equal(config.tap_service, "camera.turn_on");
});

test("camera card renders empty state without throwing when entity is missing", () => {
  const source = read("nodalia-camera-card.js");
  assert.match(source, /renderCardEmptyStateDocument/);
  assert.match(source, /if \(!state\) \{[\s\S]*renderCardEmptyStateDocument/);
  assert.match(source, /const config = this\._config \|\| \{\}/);
});

test("camera card handles unavailable state and snapshot fallback", () => {
  const source = read("nodalia-camera-card.js");
  assert.match(source, /isUnavailableState\(state\)/);
  assert.match(source, /camera_proxy/);
  assert.match(source, /entity_picture/);
  assert.match(source, /_failedImageUrls/);
  assert.match(source, /camera-card__placeholder/);
});

test("camera card expanded overlay opens, closes, and cleans up listeners", () => {
  const source = read("nodalia-camera-card.js");
  assert.match(source, /_expandedOpen/);
  assert.match(source, /_openExpanded\(/);
  assert.match(source, /_closeExpanded\(/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /disconnectedCallback\(\) \{[\s\S]*removeEventListener\("keydown", this\._onWindowKeyDown\)/);
  assert.match(source, /disconnectedCallback\(\) \{[\s\S]*_expandedOpen = false/);
  assert.match(source, /camera-card__expanded/);
});

test("camera configured services respect strict security and explicit targets", () => {
  const source = read("nodalia-camera-card.js");
  assert.match(source, /_isServiceAllowed/);
  assert.match(source, /invokeHomeAssistantService/);
  assert.match(source, /hasExplicitTarget/);
  assert.doesNotMatch(source, /lock\.open/);
});

test("camera visual editor normalizes config and mounts camera entity picker", () => {
  const source = read("nodalia-camera-card.js");
  assert.match(source, /class NodaliaCameraCardEditor/);
  assert.match(source, /includeDomains = \["camera"\]/);
  assert.match(source, /stripEqualToDefaults/);
  assert.match(source, /bindEditorDialogLayoutFix/);
  assert.match(source, /ed\.camera\.layout_live/);
});

test("camera card uses runtime i18n pack for states and expanded controls", () => {
  const source = read("nodalia-camera-card.js");
  const i18n = read("nodalia-i18n.js");
  assert.match(source, /_cameraUi\(/);
  assert.match(source, /cameraCard/);
  assert.match(i18n, /cameraCard:\s*\{[\s\S]*?live:\s*"Live"/);
  assert.match(i18n, /cameraCard:\s*\{[\s\S]*?expand:\s*"Expandir"/);
});
