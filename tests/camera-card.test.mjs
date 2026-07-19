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
      normalizeCameras,
      normalizeExpandedActions,
      normalizeCameraActions,
      normalizeCameraStreams,
      compactCameraStreams,
      buildGo2rtcViewerUrl,
      parseServiceData,
      formatRelativeAge,
      DEFAULT_CONFIG,
      LAYOUT_MODES,
      MAX_CAMERAS,
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

test("camera normalizeCameras supports up to four entities and mosaic layout", () => {
  const config = helpers.normalizeConfig({
    cameras: [
      "camera.aqara_g410",
      "camera.aqara_g5_pro",
      "camera.aqara_g100",
    ],
    layout: "live",
  });
  assert.equal(config.cameras.length, 3);
  assert.equal(config.cameras[0], "camera.aqara_g410");
  assert.equal(config.cameras[1], "camera.aqara_g5_pro");
  assert.equal(config.cameras[2], "camera.aqara_g100");
  assert.equal(config.layout, "mosaic");
  assert.equal(config.presentation, "feed");

  const capped = helpers.normalizeConfig({
    cameras: ["camera.one", "camera.two", "camera.three", "camera.four", "camera.five"],
  });
  assert.deepEqual(Array.from(capped.cameras), ["camera.one", "camera.two", "camera.three", "camera.four"]);
});

test("camera normalizeExpandedActions keeps action entities", () => {
  const config = helpers.normalizeConfig({
    entity: "camera.entrada",
    expanded_actions: [
      {
        entity: "light.foco_jardin",
        name: "Jardín",
        icon: "mdi:outdoor-lamp",
        tap_action: "toggle",
      },
      {
        entity: "lock.puerta",
        name: "Abrir",
        tap_action: "service",
        tap_service: "lock.open",
        tap_service_data: "{\"entity_id\":\"lock.puerta\"}",
      },
    ],
  });
  assert.equal(config.expanded_actions.length, 2);
  assert.equal(config.expanded_actions[0].entity, "light.foco_jardin");
  assert.equal(config.expanded_actions[1].tap_service, "lock.open");
});

test("camera actions stay scoped to their camera and preserve YAML service data", () => {
  const config = helpers.normalizeConfig({
    cameras: ["camera.entrada", "camera.jardin"],
    camera_actions: [
      {
        camera: "camera.jardin",
        entity: "light.foco_jardin",
        name: "Jardín",
        tap_action: "toggle",
      },
      {
        camera: "camera.entrada",
        entity: "lock.puerta",
        name: "Abrir",
        tap_action: "service",
        tap_service: "lock.open",
        tap_service_data: { entity_id: "lock.puerta" },
      },
      {
        camera: "camera.inexistente",
        entity: "switch.ignorado",
      },
    ],
  });

  assert.equal(config.camera_actions.length, 2);
  assert.equal(config.camera_actions[0].camera, "camera.jardin");
  assert.equal(config.camera_actions[0].entity, "light.foco_jardin");
  assert.equal(config.camera_actions[1].tap_service_data.entity_id, "lock.puerta");
});

test("camera live providers stay scoped and build go2rtc viewer URLs", () => {
  const config = helpers.normalizeConfig({
    cameras: ["camera.entrada", "camera.jardin"],
    camera_streams: [
      {
        camera: "camera.entrada",
        provider: "go2rtc",
        base_url: "http://frigate.local:1984",
        stream: "entrada_main",
        mode: "webrtc",
      },
      {
        camera: "camera.jardin",
        provider: "iframe",
        url: "https://cameras.example/player/jardin",
      },
      { camera: "camera.ignored", provider: "home_assistant" },
    ],
  });

  assert.equal(config.camera_streams.length, 2);
  assert.equal(config.camera_streams[0].provider, "go2rtc");
  assert.equal(config.camera_streams[1].url, "https://cameras.example/player/jardin");
  const viewerUrl = helpers.buildGo2rtcViewerUrl(
    config.camera_streams[0].base_url,
    config.camera_streams[0].stream,
    config.camera_streams[0].mode,
  );
  assert.match(viewerUrl, /^http:\/\/frigate\.local:1984\/stream\.html\?/);
  assert.match(viewerUrl, /src=entrada_main/);
  assert.match(viewerUrl, /mode=webrtc%2Cwebrtc%2Ftcp/);
  assert.equal(helpers.buildGo2rtcViewerUrl("javascript:alert(1)", "entrada", "auto"), "");
});

test("camera stream serialization omits native defaults", () => {
  const normalized = helpers.normalizeConfig({
    cameras: ["camera.entrada", "camera.jardin"],
    camera_streams: [
      { camera: "camera.entrada", provider: "home_assistant" },
      { camera: "camera.jardin", provider: "home_assistant", controls: true, muted: false },
    ],
  });
  const compact = helpers.compactCameraStreams(normalized.camera_streams);
  assert.equal(compact.length, 1);
  assert.equal(compact[0].camera, "camera.jardin");
  assert.equal(compact[0].controls, true);
  assert.equal(compact[0].muted, false);
  assert.equal(helpers.DEFAULT_CONFIG.styles.preview.mosaic_gap, "0px");
});

test("camera service data accepts YAML objects and JSON strings", () => {
  const yamlObject = { entity_id: "switch.proyector_2" };
  assert.equal(helpers.parseServiceData(yamlObject), yamlObject);
  assert.equal(
    helpers.parseServiceData('{"entity_id":"input_boolean.media_power"}').entity_id,
    "input_boolean.media_power",
  );
  assert.deepEqual(Object.keys(helpers.parseServiceData("{invalid")), []);
});

test("camera preview age formats the native image timestamp relatively", () => {
  const now = Date.UTC(2026, 6, 16, 12, 0, 0);
  const twoMinutesAgo = new Date(now - 120000).toISOString();
  const label = helpers.formatRelativeAge(twoMinutesAgo, "en", now);

  assert.match(label, /2/);
  assert.match(label, /min/i);
  const secondsLabel = helpers.formatRelativeAge(new Date(now - 37000).toISOString(), "en", now);
  assert.match(secondsLabel, /37/);
  assert.match(secondsLabel, /sec/i);
  assert.ok(helpers.formatRelativeAge(new Date(now).toISOString(), "es", now));
  assert.equal(helpers.formatRelativeAge("invalid", "en", now), "");
  assert.equal(helpers.normalizeConfig({ entity: "camera.entrada" }).show_preview_age, true);
  assert.equal(helpers.normalizeConfig({ entity: "camera.entrada", show_preview_age: false }).show_preview_age, false);
});

test("camera card renders mosaic markup for multiple cameras", () => {
  const source = read("nodalia-camera-card.js");
  assert.match(source, /camera-card__mosaic--three/);
  assert.match(source, /camera-card__mosaic--four/);
  assert.match(source, /camera-card__expanded-actions/);
  assert.match(source, /grid-template-columns: 2fr 1fr/);
  assert.match(source, /presentation/);
  assert.match(source, /data-camera-preview-age/);
  assert.match(source, /data-camera-entity="\$\{escapeHtml\(entityId\)\}"/);
});

test("camera card renders empty state without throwing when entity is missing", () => {
  const source = read("nodalia-camera-card.js");
  assert.match(source, /renderCardEmptyStateDocument/);
  assert.match(source, /if \(!cameraIds\.length\)/);
  assert.match(source, /const config = this\._config \|\| \{\}/);
});

test("camera card handles unavailable state and snapshot fallback", () => {
  const source = read("nodalia-camera-card.js");
  assert.match(source, /isUnavailableState\(state\)/);
  assert.match(source, /camera_proxy/);
  assert.match(source, /entity_picture/);
  assert.match(source, /_failedImageUrls/);
  assert.match(source, /const src = node\.getAttribute\("src"\)/);
  assert.doesNotMatch(source, /_failedImageUrls\.add\(node\.src\)/);
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
  assert.match(source, /nodalia-light-card/);
  assert.match(source, /nodalia-fan-card/);
  assert.match(source, /nodalia-humidifier-card/);
  assert.match(source, /nodalia-entity-card/);
  assert.match(source, /_getExpandedActionsForCamera/);
  assert.match(source, /ha-camera-stream/);
  assert.match(source, /camera_view: "live"/);
  assert.match(source, /buildGo2rtcViewerUrl/);
  assert.match(source, /data-camera-expanded-stream/);
  assert.match(source, /this\._expandedOpen && this\.shadowRoot\?\.innerHTML[\s\S]*_updateExpandedStreamState\(\)/);
});

test("camera preview opens directly without a visible expand control", () => {
  const source = read("nodalia-camera-card.js");
  assert.match(source, /class="camera-card__preview-open"/);
  assert.match(source, /\.camera-card__preview-open \{[\s\S]*background: transparent/);
  assert.match(source, /tap_action: "toggle"/);
  assert.match(source, /case "toggle":[\s\S]*this\._openExpanded\(\)/);
  assert.doesNotMatch(source, /class="camera-card__expand"/);
  assert.doesNotMatch(source, /mdi:arrow-expand/);
});

test("camera configured services respect strict security and explicit targets", () => {
  const source = read("nodalia-camera-card.js");
  assert.match(source, /_isServiceAllowed/);
  assert.match(source, /invokeHomeAssistantService/);
  assert.match(source, /hasExplicitTarget/);
  assert.match(source, /_performExpandedAction/);
});

test("camera visual editor normalizes config and mounts camera entity picker", () => {
  const source = read("nodalia-camera-card.js");
  assert.match(source, /class NodaliaCameraCardEditor/);
  assert.match(source, /picker\.includeDomains = domains\.length \? domains : \["camera"\]/);
  assert.match(source, /stripEqualToDefaults/);
  assert.match(source, /bindEditorDialogLayoutFix/);
  assert.match(source, /ed\.camera\.layout_live/);
  assert.match(source, /ed\.camera\.show_preview_age/);
  assert.match(source, /data-editor-action="add-camera-action"/);
  assert.match(source, /camera_actions\.\$\{sourceIndex\}/);
  assert.match(source, /camera_streams\.\$\{index\}/);
  assert.match(source, /ed\.camera\.live_provider_go2rtc/);
});

test("camera preview age bubble updates without re-rendering the image", () => {
  const source = read("nodalia-camera-card.js");
  const updateStart = source.indexOf("\n  _updatePreviewAgeBubbles() {");
  const updateEnd = source.indexOf("\n  _schedulePreviewAgeRefresh() {", updateStart);
  const updateBlock = source.slice(updateStart, updateEnd);

  assert.match(source, /\.camera-card__preview-age \{[\s\S]*background: rgba\(0, 0, 0, 0\.34\)/);
  assert.match(source, /\.camera-card__preview-age \{[\s\S]*bottom: 12px;[\s\S]*left: 12px;/);
  assert.match(source, /this\._previewAgeTimer = window\.setTimeout/);
  assert.match(source, /return hasSubMinutePreview \? 1000 : 15000/);
  assert.match(source, /}, this\._previewAgeRefreshDelay\(\)\)/);
  assert.match(updateBlock, /node\.textContent = label/);
  assert.doesNotMatch(updateBlock, /this\._render\(\)/);
  assert.match(source, /disconnectedCallback\(\) \{[\s\S]*this\._clearPreviewAgeTimer\(\)/);
});

test("camera card uses runtime i18n pack for states and expanded controls", () => {
  const source = read("nodalia-camera-card.js");
  const i18n = read("nodalia-i18n.js");
  assert.match(source, /_cameraUi\(/);
  assert.match(source, /cameraCard/);
  assert.match(i18n, /cameraCard:\s*\{[\s\S]*?live:\s*"Live"/);
  assert.match(i18n, /cameraCard:\s*\{[\s\S]*?expand:\s*"Expandir"/);
});
