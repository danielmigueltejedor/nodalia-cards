import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadCameraHelpers() {
  const source = read("nodalia-camera-card.js").replace(/^import[^\n]+\n+/, "");
  const helperSource = `${source.split("class NodaliaCameraCard")[0]}
    globalThis.__cameraHelpers = {
      normalizeConfig,
      normalizeCameras,
      normalizeExpandedActions,
      normalizeCameraActions,
      normalizeCameraTapActions,
      normalizeCameraStreams,
      compactCameraTapActions,
      compactCameraStreams,
      buildGo2rtcViewerUrl,
      buildGo2rtcWebSocketEndpoint,
      buildFrigateGo2rtcPath,
      signHomeAssistantPath,
      resolveGo2rtcPlayerSource,
      isMixedContentUrl,
      parseServiceData,
      formatRelativeAge,
      stripEqualToDefaults,
      isUsableCameraAccessToken,
      parseCameraProxyAuth,
      appendQueryParam,
      DEFAULT_CONFIG,
      CAMERA_LAYOUT,
      CAMERA_PRESENTATION,
      MAX_CAMERAS,
    };
  `;
  const sandbox = {
    URL,
    location: { protocol: "https:", href: "https://home-assistant.example/lovelace/cameras" },
    window: null,
    customElements: { define() {}, get() {} },
    HTMLElement: class {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(read("nodalia-camera-stream-model.js"), sandbox);
  vm.runInContext(helperSource, sandbox);
  return sandbox.__cameraHelpers;
}

function loadGo2rtcPlayer() {
  const source = read("nodalia-go2rtc-player.js")
    .replace("export class NodaliaGo2RTCPlayer", "class NodaliaGo2RTCPlayer")
    + "\nglobalThis.__NodaliaGo2RTCPlayer = NodaliaGo2RTCPlayer;\n";
  class FakeHTMLElement {
    constructor() {
      this.events = [];
      this.isConnected = true;
    }

    dispatchEvent(event) {
      this.events.push(event);
      return true;
    }

    replaceChildren() {}
  }
  class FakeCustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }
  class FakeMediaStream {
    constructor(tracks = []) {
      this.tracks = [...tracks];
    }

    getTracks() {
      return this.tracks;
    }

    getVideoTracks() {
      return this.tracks.filter(track => track.kind === "video");
    }

    getAudioTracks() {
      return this.tracks.filter(track => track.kind === "audio");
    }

    addTrack(track) {
      this.tracks.push(track);
    }

    removeTrack(track) {
      this.tracks = this.tracks.filter(item => item !== track);
    }
  }
  const sandbox = {
    URL,
    Blob,
    CustomEvent: FakeCustomEvent,
    HTMLElement: FakeHTMLElement,
    MediaStream: FakeMediaStream,
    customElements: { define() {}, get() {} },
    location: { href: "https://home-assistant.example/lovelace/cameras" },
    setTimeout,
    clearTimeout,
    window: null,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  sandbox.__NodaliaGo2RTCPlayer.__testWindow = sandbox;
  return sandbox.__NodaliaGo2RTCPlayer;
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

test("camera normalizeConfig forces mosaic feed and accepts tap action objects", () => {
  const config = helpers.normalizeConfig({
    entity: "camera.entrada",
    layout: "security",
    presentation: "card",
    tap_action: {
      action: "perform-action",
      perform_action: "camera.turn_on",
      data: { entity_id: "camera.entrada" },
    },
    hold_action: "none",
  });

  assert.equal(config.entity, "camera.entrada");
  assert.equal(config.layout, "mosaic");
  assert.equal(config.presentation, "feed");
  assert.equal(config.tap_action, "service");
  assert.equal(config.tap_service, "camera.turn_on");
  const outgoing = helpers.stripEqualToDefaults(config);
  assert.equal(outgoing.layout, undefined);
  assert.equal(outgoing.presentation, undefined);
});

test("camera normalizeConfig preserves native YAML service data and targets", () => {
  const config = helpers.normalizeConfig({
    entity: "camera.entrada",
    tap_action: "service",
    tap_service: "light.turn_on",
    tap_service_data: { brightness_pct: 40 },
    tap_service_target: { entity_id: "light.entrada" },
  });

  assert.equal(config.tap_service_data, JSON.stringify({ brightness_pct: 40 }));
  assert.equal(config.tap_service_target, JSON.stringify({ entity_id: "light.entrada" }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(helpers.parseServiceData(config.tap_service_target))),
    { entity_id: "light.entrada" },
  );
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

test("camera tap actions stay scoped to each preview and keep native action objects", () => {
  const config = helpers.normalizeConfig({
    cameras: ["camera.entrada", "camera.jardin"],
    camera_tap_actions: [
      {
        camera: "camera.entrada",
        tap_action: "toggle",
      },
      {
        camera: "camera.jardin",
        tap_action: {
          action: "navigate",
          navigation_path: "/lovelace/jardin",
        },
      },
      {
        camera: "camera.inexistente",
        tap_action: "none",
      },
    ],
  });

  assert.equal(config.camera_tap_actions.length, 2);
  assert.equal(config.camera_tap_actions[0].tap_action, "toggle");
  assert.equal(config.camera_tap_actions[1].tap_action, "navigate");
  assert.equal(config.camera_tap_actions[1].navigation_path, "/lovelace/jardin");
  assert.deepEqual(
    JSON.parse(JSON.stringify(helpers.compactCameraTapActions(config.camera_tap_actions, "toggle"))),
    [{ camera: "camera.jardin", tap_action: "navigate", navigation_path: "/lovelace/jardin" }],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(helpers.compactCameraTapActions(config.camera_tap_actions, "navigate"))),
    [
      { camera: "camera.entrada", tap_action: "toggle" },
      { camera: "camera.jardin", tap_action: "navigate", navigation_path: "/lovelace/jardin" },
    ],
  );
});

test("camera tap action compaction keeps legacy global actions inherited", () => {
  const cameras = ["camera.entrada", "camera.jardin"];
  const inheritedNavigate = helpers.normalizeCameraTapActions(cameras.map(camera => ({
    camera,
    tap_action: "navigate",
    navigation_path: "/lovelace/cameras",
  })), cameras);

  assert.deepEqual(
    JSON.parse(JSON.stringify(helpers.compactCameraTapActions(inheritedNavigate, {
      tap_action: "navigate",
      navigation_path: "/lovelace/cameras",
    }))),
    [],
  );

  inheritedNavigate[1].navigation_path = "/lovelace/jardin";
  assert.deepEqual(
    JSON.parse(JSON.stringify(helpers.compactCameraTapActions(inheritedNavigate, {
      tap_action: "navigate",
      navigation_path: "/lovelace/cameras",
    }))),
    [{ camera: "camera.jardin", tap_action: "navigate", navigation_path: "/lovelace/jardin" }],
  );

  const inheritedService = helpers.normalizeCameraTapActions([{
    camera: "camera.entrada",
    tap_action: "service",
    tap_service: "script.open_camera",
    tap_service_data: { source: "legacy" },
    tap_service_target: { entity_id: "script.open_camera" },
  }], cameras);
  assert.deepEqual(
    JSON.parse(JSON.stringify(helpers.compactCameraTapActions(inheritedService, {
      tap_action: "service",
      tap_service: "script.open_camera",
      tap_service_data: JSON.stringify({ source: "legacy" }),
      tap_service_target: JSON.stringify({ entity_id: "script.open_camera" }),
    }))),
    [],
  );
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
  assert.equal(helpers.isMixedContentUrl(viewerUrl), true);
  assert.equal(helpers.isMixedContentUrl("https://frigate.example/stream.html?src=entrada"), false);
});

test("camera migrates the former Advanced Camera Card provider to native Frigate go2rtc", () => {
  const config = helpers.normalizeConfig({
    cameras: ["camera.entrada"],
    camera_streams: [
      {
        camera: "camera.entrada",
        provider: "advanced_camera_card",
        stream: "entrada_main",
      },
    ],
  });
  const compact = helpers.compactCameraStreams(config.camera_streams);

  assert.deepEqual(JSON.parse(JSON.stringify(compact)), [
    { camera: "camera.entrada", provider: "frigate_go2rtc", stream: "entrada_main" },
  ]);
  assert.equal(config.camera_streams[0].client_id, "frigate");
  assert.equal(
    helpers.buildFrigateGo2rtcPath("frigate", "entrada_main"),
    "/api/frigate/frigate/mse/api/ws?src=entrada_main",
  );
  assert.equal(
    helpers.buildGo2rtcWebSocketEndpoint("https://go2rtc.example", "entrada_main"),
    "https://go2rtc.example/api/ws?src=entrada_main",
  );
});

test("camera signs native Frigate go2rtc through Home Assistant", async () => {
  const requests = [];
  const hass = {
    callWS: async request => {
      requests.push(request);
      return { path: `${request.path}&authSig=signed` };
    },
    hassUrl: pathValue => `https://home-assistant.example${pathValue}`,
  };
  const source = await helpers.resolveGo2rtcPlayerSource(hass, {
    provider: "frigate_go2rtc",
    client_id: "frigate",
    stream: "entrada_main",
  });
  const cachedSource = await helpers.resolveGo2rtcPlayerSource(hass, {
    provider: "frigate_go2rtc",
    client_id: "frigate",
    stream: "entrada_main",
  });

  assert.equal(
    source,
    "https://home-assistant.example/api/frigate/frigate/mse/api/ws?src=entrada_main&authSig=signed",
  );
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0])), {
    type: "auth/sign_path",
    path: "/api/frigate/frigate/mse/api/ws?src=entrada_main",
    expires: 86400,
  });
  assert.equal(cachedSource, source);
  assert.equal(requests.length, 1);
});

test("camera proxies insecure direct go2rtc when hass-web-proxy is available", async () => {
  const services = [];
  const hass = {
    config: { components: ["hass_web_proxy"] },
    callService: async (...args) => services.push(args),
    callWS: async request => ({ path: `${request.path}&authSig=signed` }),
    hassUrl: pathValue => `https://home-assistant.example${pathValue}`,
  };
  const streamConfig = {
    provider: "go2rtc",
    base_url: "http://frigate.local:1984",
    stream: "entrada_main",
  };
  const source = await helpers.resolveGo2rtcPlayerSource(hass, streamConfig);

  assert.match(source, /^https:\/\/home-assistant\.example\/api\/hass_web_proxy\/v0\/ws\?/);
  assert.equal(services[0][0], "hass_web_proxy");
  assert.equal(services[0][1], "create_proxied_url");
  assert.equal(services[0][2].url_pattern, "http://frigate.local:1984/api/ws?src=entrada_main");
  assert.equal(
    await helpers.resolveGo2rtcPlayerSource({ config: { components: [] } }, streamConfig),
    "",
  );
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
  const parsedObject = helpers.parseServiceData(yamlObject);
  assert.notEqual(parsedObject, yamlObject);
  assert.deepEqual(JSON.parse(JSON.stringify(parsedObject)), yamlObject);
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
  assert.match(source, /const CAMERA_LAYOUT = "mosaic"/);
  assert.match(source, /const CAMERA_PRESENTATION = "feed"/);
  assert.doesNotMatch(source, /\bLAYOUT_MODES\b/);
  assert.doesNotMatch(source, /\bPRESENTATION_MODES\b/);
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
  assert.match(source, /access_token/);
  assert.match(source, /isUsableCameraAccessToken/);
  assert.match(source, /_failedCameraTokens/);
  assert.match(source, /_failedImageUrls/);
  assert.match(source, /const src = node\.getAttribute\("src"\)/);
  assert.doesNotMatch(source, /_failedImageUrls\.add\(node\.src\)/);
  assert.doesNotMatch(source, /hassUrl\(`\/api\/camera_proxy\/\$\{entityId\}`\)/);
  assert.match(source, /camera-card__placeholder/);
});

test("camera proxy URLs require a live access token and quarantine failed tokens", () => {
  const helpers = loadCameraHelpers();
  assert.equal(helpers.isUsableCameraAccessToken(""), false);
  assert.equal(helpers.isUsableCameraAccessToken("undefined"), false);
  assert.equal(helpers.isUsableCameraAccessToken("null"), false);
  assert.equal(helpers.isUsableCameraAccessToken("abc123"), true);

  const parsed = helpers.parseCameraProxyAuth(
    "/api/camera_proxy/camera.aqara_g5_pro?token=deadbeef&nodalia_ts=2026-08-04T02%3A17%3A08.536Z",
  );
  assert.equal(parsed.entityId, "camera.aqara_g5_pro");
  assert.equal(parsed.accessToken, "deadbeef");

  const source = read("nodalia-camera-card.js");
  assert.match(source, /_failedCameraTokens = new Map\(\)/);
  assert.match(source, /_failedCameraTokens\.get\(entityId\) === accessToken/);
  assert.match(source, /_failedCameraTokens\.set\(parsed\.entityId, parsed\.accessToken\)/);
  assert.doesNotMatch(source, /_failedCameraTokens\.size > MAX_FAILED_IMAGE_URLS/);
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
  assert.match(source, /NodaliaGo2RTCPlayer/);
  assert.match(source, /resolveGo2rtcPlayerSource/);
  assert.match(source, /auth\/sign_path/);
  assert.match(source, /isMixedContentUrl/);
  assert.match(source, /data-camera-expanded-stream/);
  assert.match(source, /entityId === primaryEntity \? configuredName : ""/);
  assert.match(source, /compact_layout_mode: domain === "lock"/);
  assert.match(source, /rows: 1/);
  assert.match(source, /camera-card__stream-spinner/);
  assert.match(source, /conic-gradient/);
  assert.doesNotMatch(source, /data-camera-audio-unlock/);
  assert.match(source, /this\._expandedOpen && this\.shadowRoot\?\.innerHTML[\s\S]*_updateExpandedStreamState\(\)/);
});

test("camera preview opens directly without a visible expand control", () => {
  const source = read("nodalia-camera-card.js");
  assert.match(source, /class="camera-card__preview-open"/);
  assert.match(source, /\.camera-card__preview-open \{[\s\S]*background: transparent/);
  assert.match(source, /tap_action: "toggle"/);
  assert.match(source, /_performCameraTapAction[\s\S]*case "toggle":[\s\S]*this\._openExpanded\(camera, returnTarget\)/);
  assert.match(source, /data-camera-action="camera-tap"/);
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
  assert.doesNotMatch(source, /_renderSelectField\("ed\.camera\.presentation"/);
  assert.doesNotMatch(source, /_renderSelectField\("ed\.camera\.layout"/);
  assert.match(source, /ed\.camera\.show_preview_age/);
  assert.match(source, /data-editor-action="add-camera-action"/);
  assert.match(source, /camera_actions\.\$\{sourceIndex\}/);
  assert.match(source, /camera_tap_actions\.\$\{index\}/);
  assert.match(source, /ed\.camera\.tap_open_live/);
  assert.doesNotMatch(source, /_renderSelectField\("ed\.light\.card_tap_action", "tap_action"/);
  assert.match(source, /camera_streams\.\$\{index\}/);
  assert.match(source, /ed\.camera\.live_provider_go2rtc/);
  assert.match(source, /ed\.camera\.live_provider_frigate_go2rtc/);
  assert.match(source, /ed\.camera\.live_frigate_client_id/);
  assert.match(source, /document\.createElement\("ha-icon-picker"\)/);
  assert.match(source, /data-mounted-control="camera-icon"/);
});

test("camera bundles the native go2rtc player protocol", () => {
  const source = read("nodalia-go2rtc-player.js");
  const build = read("scripts/build-bundle.mjs");
  const pkg = JSON.parse(read("package.json"));
  assert.match(source, /class NodaliaGo2RTCPlayer/);
  assert.match(source, /new RTCPeerConnection/);
  assert.match(source, /webrtc\/offer/);
  assert.match(source, /ManagedMediaSource/);
  assert.match(source, /nodalia-go2rtc-loaded/);
  assert.match(source, /primeAudioFromUserGesture\(\)/);
  assert.match(source, /createMediaElementSource\(this\._video\)/);
  assert.match(source, /createMediaStreamSource\(stream\)/);
  assert.match(source, /GO2RTC_STARTUP_ERROR_DELAY/);
  assert.match(source, /GO2RTC_MAX_MSE_QUEUE_BYTES/);
  assert.match(source, /nodalia-go2rtc-state/);
  assert.match(source, /GO2RTC_MODE_TIMEOUTS/);
  assert.match(source, /GO2RTC_SOCKET_OPEN_TIMEOUT/);
  assert.match(source, /this\._mode === "auto-mse"/);
  assert.match(source, /orientationchange/);
  assert.match(source, /webkitbeginfullscreen/);
  assert.match(source, /requestVideoFrameCallback/);
  assert.match(source, /_restartTransportForDisplayRecovery/);
  assert.match(source, /go2rtc websocket open timed out/);
  assert.doesNotMatch(source, /nodalia-go2rtc-audio-blocked/);
  assert.match(source, /Adapted from go2rtc VideoRTC/);
  assert.match(source, /customElements\.define\(GO2RTC_PLAYER_TAG, NodaliaGo2RTCPlayer\)/);
  assert.match(read("nodalia-camera-card.js"), /document\.createElement\("nodalia-go2rtc-player"\)/);
  assert.match(read("nodalia-camera-card.js"), /streamConfig\.provider === "frigate_go2rtc" && streamConfig\.mode === "auto"[\s\S]*?"auto-mse"/);
  assert.match(read("nodalia-camera-card.js"), /data-camera-stream-status/);
  assert.match(build, /legalComments: "inline"/);
  assert.ok(pkg.files.includes("nodalia-go2rtc-player.js"));
  assert.ok(pkg.files.includes("THIRD_PARTY_NOTICES.md"));
});

test("Frigate auto mode negotiates MSE first while retaining fallbacks", () => {
  const Player = loadGo2rtcPlayer();
  Player.__testWindow.MediaSource = class {};
  Player.__testWindow.RTCPeerConnection = class {};
  const player = new Player();
  player._mode = "auto-mse";
  player._video = { canPlayType: () => "probably" };

  assert.equal(player._availableModes().join(","), "mse,webrtc,hls,mjpeg");
});

test("go2rtc display recovery preserves the video element and reattaches WebRTC", () => {
  const Player = loadGo2rtcPlayer();
  const player = new Player();
  const stream = new Player.__testWindow.MediaStream([
    { kind: "video", readyState: "live" },
  ]);
  let playCalls = 0;
  const video = {
    style: { transform: "", willChange: "" },
    srcObject: stream,
    readyState: 3,
    videoWidth: 1280,
    videoHeight: 720,
    getBoundingClientRect() { return { width: 320, height: 180 }; },
    play() { playCalls += 1; return Promise.resolve(); },
  };
  player._video = video;
  player._activeMode = "webrtc";
  player._playbackStream = stream;

  assert.equal(player._recoverVideoDisplay("orientationchange"), true);
  assert.equal(player.video, video);
  assert.equal(video.srcObject, stream);
  assert.equal(playCalls, 1);
  clearTimeout(player._displayHealthTimer);
});

test("go2rtc display recovery does not restart transport before the first decoded frame", () => {
  const Player = loadGo2rtcPlayer();
  const player = new Player();
  const video = {
    readyState: 0,
    videoWidth: 0,
    videoHeight: 0,
  };
  let restartCalls = 0;
  player._video = video;
  player._socket = {};
  player._restartTransportForDisplayRecovery = () => { restartCalls += 1; };
  Player.__testWindow.setTimeout = callback => {
    callback();
    return 1;
  };

  player._verifyVideoDisplayRecovery(video);
  assert.equal(restartCalls, 0);

  player._hasDecodedFrameOnce = true;
  player._verifyVideoDisplayRecovery(video);
  assert.equal(restartCalls, 1);
});

test("go2rtc display recovery preserves the active startup error budget", () => {
  const Player = loadGo2rtcPlayer();
  const player = new Player();
  const startupStartedAt = Date.now() - 5000;
  let connectCalls = 0;
  player._startupStartedAt = startupStartedAt;
  player._socket = { close() {} };
  player._resetModeTransport = () => {};
  player._connect = () => { connectCalls += 1; };

  player._restartTransportForDisplayRecovery();

  assert.equal(player._startupStartedAt, startupStartedAt);
  assert.equal(connectCalls, 1);
});

test("camera iframe provider is sandboxed", () => {
  const source = read("nodalia-camera-card.js");
  assert.match(source, /sandbox="allow-scripts allow-forms allow-presentation allow-popups"/);
  assert.match(source, /referrerpolicy="no-referrer"/);
});

test("go2rtc full disconnect releases audio and recreates its video element", async () => {
  const Player = loadGo2rtcPlayer();
  const player = new Player();
  let removed = false;
  let contextClosed = false;
  player._video = {
    src: "",
    srcObject: null,
    pause() {},
    removeAttribute() {},
    load() {},
    remove() { removed = true; },
  };
  player._audioContext = {
    close() {
      contextClosed = true;
      return Promise.resolve();
    },
  };

  player.disconnect();
  await Promise.resolve();

  assert.equal(player.video, null);
  assert.equal(removed, true);
  assert.equal(contextClosed, true);
});

test("go2rtc attaches one complete WebRTC stream after the peer connects", () => {
  const Player = loadGo2rtcPlayer();
  const player = new Player();
  const audioTrack = {
    id: "audio-1",
    kind: "audio",
    muted: false,
    readyState: "live",
    addEventListener() {},
    removeEventListener() {},
  };
  const videoTrack = { id: "video-1", kind: "video", muted: false, readyState: "live" };
  let oscillatorStopped = false;
  player._audioPrimeOscillator = { stop() { oscillatorStopped = true; } };
  player._audioPrimeGain = { disconnect() {} };
  player._video = { muted: false, srcObject: null, play: () => Promise.resolve() };
  const peer = {
    getTransceivers: () => [
      { currentDirection: "recvonly", receiver: { track: videoTrack } },
      { currentDirection: "recvonly", receiver: { track: audioTrack } },
    ],
  };
  player._peer = peer;

  assert.equal(player._attachConnectedWebRtcStream(peer), true);
  assert.deepEqual(player._video.srcObject.getTracks(), [videoTrack, audioTrack]);
  assert.equal(player._video.srcObject.getAudioTracks()[0], audioTrack);
  assert.equal(oscillatorStopped, true);
  assert.equal(player.events.at(-1).type, "nodalia-go2rtc-audio-state");
  assert.equal(player.events.at(-1).detail.state, "available");
});

test("go2rtc routes WebRTC audio through an unlocked output without duplicating it", () => {
  const Player = loadGo2rtcPlayer();
  const player = new Player();
  const audioTrack = {
    id: "audio-1",
    kind: "audio",
    muted: false,
    readyState: "live",
    addEventListener() {},
    removeEventListener() {},
  };
  const videoTrack = { id: "video-1", kind: "video", muted: false, readyState: "live" };
  let routedStream = null;
  const trackSource = { connect() {}, disconnect() {} };
  player._muted = false;
  player._audioContext = {
    state: "running",
    createMediaStreamSource(stream) {
      routedStream = stream;
      return trackSource;
    },
  };
  player._audioOutputGain = { gain: { value: 0 } };
  player._audioElementSource = { connect() {}, disconnect() {} };
  player._video = { muted: false, volume: 0.65, srcObject: null, play: () => Promise.resolve() };
  const peer = {
    getTransceivers: () => [
      { currentDirection: "recvonly", receiver: { track: videoTrack } },
      { currentDirection: "recvonly", receiver: { track: audioTrack } },
    ],
  };
  player._peer = peer;

  assert.equal(player._attachConnectedWebRtcStream(peer), true);
  assert.deepEqual(player._video.srcObject.getTracks(), [videoTrack]);
  assert.equal(routedStream.getAudioTracks()[0], audioTrack);
  assert.equal(player._audioOutputGain.gain.value, 0.65);
});

test("go2rtc excludes falsely supported Opus from Safari MSE negotiation", () => {
  const Player = loadGo2rtcPlayer();
  Player.__testWindow.navigator = {
    userAgent: "Mozilla/5.0 Version/18.5 Safari/605.1.15",
  };
  const player = new Player();
  const codecs = player._supportedCodecs(() => true);

  assert.match(codecs, /mp4a\.40\.2/);
  assert.doesNotMatch(codecs, /opus/);
});

test("go2rtc keeps native manual unmute as the effective player state", () => {
  const Player = loadGo2rtcPlayer();
  const player = new Player();
  player._muted = true;
  player._video = { muted: false, play: () => Promise.resolve() };

  player._handleVideoVolumeChange();

  assert.equal(player._muted, false);
});

test("go2rtc attempts unmuted playback inside the opening gesture", () => {
  const Player = loadGo2rtcPlayer();
  const player = new Player();
  let playCalls = 0;
  let mediaElementSourceCreated = false;
  let contextResumed = false;
  class FakeAudioContext {
    constructor() {
      this.state = "suspended";
      this.destination = {};
    }

    createMediaElementSource() {
      mediaElementSourceCreated = true;
      return { connect() {}, disconnect() {} };
    }

    createGain() {
      return { gain: { value: 1 }, connect() {}, disconnect() {} };
    }

    createOscillator() {
      return { connect() {}, start() {}, stop() {} };
    }

    resume() {
      contextResumed = true;
      this.state = "running";
      return Promise.resolve();
    }

    close() {
      return Promise.resolve();
    }
  }
  Player.__testWindow.AudioContext = FakeAudioContext;
  player._muted = false;
  player._video = {
    muted: true,
    volume: 1,
    play() {
      playCalls += 1;
      return Promise.resolve();
    },
  };

  assert.equal(player.primeAudioFromUserGesture(), true);
  assert.equal(player._video.muted, false);
  assert.equal(playCalls, 1);
  assert.equal(mediaElementSourceCreated, true);
  assert.equal(contextResumed, true);
});

test("go2rtc preserves requested audio while recovering from autoplay rejection", async () => {
  const Player = loadGo2rtcPlayer();
  const player = new Player();
  let playCalls = 0;
  player._muted = false;
  player._audioContext = { state: "running" };
  player._audioOutputGain = { gain: { value: 0 } };
  player._video = {
    muted: false,
    volume: 1,
    play() {
      playCalls += 1;
      return playCalls === 1 ? Promise.reject(new Error("blocked")) : Promise.resolve();
    },
  };

  assert.equal(await player._play(), true);
  assert.equal(player._muted, false);
  assert.equal(player._video.muted, false);
  assert.equal(player._autoplayMuted, false);
  assert.equal(playCalls, 3);
});

test("go2rtc keeps retrying during startup and reports only after the grace period", () => {
  const Player = loadGo2rtcPlayer();
  const retrying = new Player();
  let reconnects = 0;
  retrying._startupStartedAt = Date.now();
  retrying._resetModeTransport = () => {};
  retrying._scheduleReconnect = () => { reconnects += 1; };
  retrying._retryOrReport(new Error("temporary"));

  assert.equal(reconnects, 1);
  assert.equal(retrying.events.at(-1).type, "nodalia-go2rtc-state");
  assert.equal(retrying.events.at(-1).detail.state, "retrying");

  const terminal = new Player();
  terminal._startupStartedAt = Date.now() - 31000;
  terminal._resetModeTransport = () => {};
  terminal._scheduleReconnect = () => { reconnects += 1; };
  terminal._retryOrReport(new Error("terminal"));

  assert.equal(reconnects, 1);
  assert.equal(terminal.events.at(-1).type, "nodalia-go2rtc-error");
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
  assert.match(i18n, /cameraCard:\s*\{[\s\S]*?connectingLive:\s*"Conectando al directo"/);
});
