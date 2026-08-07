import { NodaliaGo2RTCPlayer } from "./nodalia-go2rtc-player.js";

const CARD_TAG = "nodalia-camera-card";
const EDITOR_TAG = "nodalia-camera-card-editor";
const CARD_VERSION = "2.1.2-alpha.5";
const CAMERA_LAYOUT = "mosaic";
const CAMERA_PRESENTATION = "feed";
const MAX_CAMERAS = 4;
const MAX_FAILED_IMAGE_URLS = 32;
const STREAM_PROVIDERS = new Set(["home_assistant", "frigate_go2rtc", "go2rtc", "iframe"]);
const STREAM_MODES = new Set(["auto", "webrtc", "mse", "hls", "mjpeg"]);
const TAP_ACTIONS = new Set(["auto", "more-info", "none", "navigate", "url", "service", "toggle"]);
const HOLD_ACTIONS = new Set(["auto", "more-info", "none", "navigate", "url", "service", "toggle"]);

const DEFAULT_CONFIG = {
  entity: "",
  cameras: [],
  name: "",
  layout: CAMERA_LAYOUT,
  presentation: CAMERA_PRESENTATION,
  language: "auto",
  show_name: false,
  show_state: false,
  show_status_chips: false,
  show_last_changed: false,
  show_preview_age: true,
  camera_streams: [],
  camera_tap_actions: [],
  camera_actions: [],
  expanded_actions: [],
  tap_action: "toggle",
  tap_service: "",
  tap_service_data: "",
  tap_service_target: "",
  tap_url: "",
  navigation_path: "",
  tap_new_tab: false,
  hold_action: "none",
  hold_service: "",
  hold_service_data: "",
  hold_service_target: "",
  hold_url: "",
  hold_navigation_path: "",
  hold_new_tab: false,
  security: {
    strict_service_actions: true,
    allowed_services: [],
    allowed_service_domains: [],
  },
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    content_duration: 420,
    button_bounce_duration: 320,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "var(--nodalia-card-border-radius, 28px)",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "14px",
      gap: "10px",
    },
    preview: {
      aspect_ratio: "16 / 9",
      border_radius: "18px",
      overlay_strength: 0.42,
      min_height: "220px",
      mosaic_gap: "0px",
    },
    title_size: "15px",
    subtitle_size: "12px",
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
  },
};

const STUB_CONFIG = {
  entity: "camera.entrada",
  name: "Entrada",
};

// Shared primitives are loaded by nodalia-cards core and inlined for standalone resources.
const {
  isObject,
  deepClone,
  getByPath,
  escapeHtml,
  clamp,
} = window.NodaliaUtils;

const {
  buildGo2rtcViewerUrl,
  sanitizeIframeUrl,
  buildGo2rtcWebSocketEndpoint,
  buildFrigateGo2rtcPath,
  isMixedContentUrl,
} = window.NodaliaCameraStreamModel;



function getStubEntityId(hass, domains = [], entities = [], entitiesFallback = []) {
  return window.NodaliaUtils.findStubEntityIds(hass, entities, entitiesFallback, domains, 1)[0] || "";
}

function applyStubEntity(config, hass, domains, entities = [], entitiesFallback = []) {
  const entityId = getStubEntityId(hass, domains, entities, entitiesFallback);
  if (!entityId) {
    return config;
  }
  config.entity = entityId;
  config.name = hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
  return config;
}

function mergeConfig(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override.map(item => deepClone(item)) : deepClone(base);
  }
  if (!isObject(base)) {
    return override === undefined ? base : override;
  }
  const result = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(override || {})]);
  keys.forEach(key => {
    if (window.NodaliaUtils?.isUnsafeConfigPathKey?.(key)) {
      return;
    }
    if (isObject(base[key]) && isObject(override?.[key]) && !Array.isArray(base[key])) {
      result[key] = mergeConfig(base[key], override[key]);
      return;
    }
    result[key] = override?.[key] === undefined ? deepClone(base[key]) : deepClone(override[key]);
  });
  return result;
}


function setByPath(target, path, value) {
  const parts = String(path || "").split(".");
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isObject(cursor[key]) && !Array.isArray(cursor[key])) {
      cursor[key] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}


function normalizeTextKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isUnavailableState(state) {
  const key = normalizeTextKey(state?.state);
  return key === "unavailable" || key === "unknown";
}

function appendQueryParam(url, key, value) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl || value === undefined || value === null || value === "") {
    return safeUrl;
  }
  const separator = safeUrl.includes("?") ? "&" : "?";
  return `${safeUrl}${separator}${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
}

function isUsableCameraAccessToken(token) {
  const value = String(token ?? "").trim();
  return Boolean(value) && value !== "undefined" && value !== "null";
}

function parseCameraProxyAuth(url) {
  try {
    const parsed = new URL(String(url || "").trim(), "http://localhost");
    const match = parsed.pathname.match(/\/api\/camera_proxy\/([^/?]+)/i);
    return {
      entityId: match ? decodeURIComponent(match[1]) : "",
      accessToken: String(parsed.searchParams.get("token") || "").trim(),
    };
  } catch (_error) {
    return { entityId: "", accessToken: "" };
  }
}

function formatRelativeAge(timestamp, locale = "en", now = Date.now()) {
  const value = new Date(timestamp || "").getTime();
  if (!Number.isFinite(value)) {
    return "";
  }
  const elapsedSeconds = Math.max(0, Math.floor((Number(now) - value) / 1000));
  let amount = elapsedSeconds;
  let unit = "second";
  if (elapsedSeconds >= 86400) {
    amount = Math.max(1, Math.floor(elapsedSeconds / 86400));
    unit = "day";
  } else if (elapsedSeconds >= 3600) {
    amount = Math.max(1, Math.floor(elapsedSeconds / 3600));
    unit = "hour";
  } else if (elapsedSeconds >= 60) {
    amount = Math.max(1, Math.floor(elapsedSeconds / 60));
    unit = "minute";
  }
  try {
    return new Intl.RelativeTimeFormat(locale || "en", {
      numeric: unit === "second" ? "always" : "auto",
      style: "short",
    }).format(-amount, unit);
  } catch (_error) {
    if (amount === 0) return "now";
    const suffix = amount === 1 ? unit : `${unit}s`;
    return `${amount} ${suffix} ago`;
  }
}

function parseServiceData(rawValue) {
  if (!rawValue) {
    return {};
  }
  if (isObject(rawValue)) {
    return deepClone(rawValue);
  }
  try {
    const parsed = JSON.parse(rawValue);
    return isObject(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function fireEvent(node, type, detail, options) {
  node.dispatchEvent(new CustomEvent(type, {
    bubbles: options?.bubbles !== false,
    composed: options?.composed !== false,
    cancelable: options?.cancelable === true,
    detail,
  }));
}

function stripEqualToDefaults(config, defaults = DEFAULT_CONFIG) {
  const result = deepClone(config || {});
  const walk = (current, base, path = "") => {
    if (!isObject(current) || !isObject(base)) {
      return;
    }
    Object.keys(current).forEach(key => {
      const nextPath = path ? `${path}.${key}` : key;
      if (isObject(current[key]) && isObject(base[key]) && !Array.isArray(current[key])) {
        walk(current[key], base[key], nextPath);
        if (!Object.keys(current[key]).length) {
          delete current[key];
        }
        return;
      }
      if (JSON.stringify(current[key]) === JSON.stringify(base[key])) {
        delete current[key];
      }
    });
  };
  walk(result, defaults);
  return result;
}

function normalizeCameraEntityId(value) {
  if (isObject(value)) {
    return String(value.entity ?? value.entity_id ?? "").trim();
  }
  return String(value ?? "").trim();
}

function normalizeCameras(config = {}) {
  const seen = new Set();
  const ids = [];
  const pushId = value => {
    const id = normalizeCameraEntityId(value);
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    ids.push(id);
  };
  if (Array.isArray(config.cameras)) {
    config.cameras.forEach(pushId);
  }
  pushId(config.entity);
  return ids.slice(0, MAX_CAMERAS);
}

function normalizeExpandedActions(rawActions = []) {
  if (!Array.isArray(rawActions)) {
    return [];
  }
  return rawActions.map(item => {
    if (!isObject(item)) {
      return null;
    }
    const entity = String(item.entity ?? "").trim();
    if (!entity) {
      return null;
    }
    const action = normalizeTextKey(item.tap_action || "toggle");
    return {
      entity,
      name: String(item.name ?? "").trim(),
      icon: String(item.icon ?? "").trim(),
      icon_color: String(item.icon_color ?? item.iconColor ?? "").trim(),
      tap_action: TAP_ACTIONS.has(action) ? action : "toggle",
      tap_service: String(item.tap_service ?? "").trim(),
      tap_service_data: isObject(item.tap_service_data)
        ? deepClone(item.tap_service_data)
        : String(item.tap_service_data ?? "").trim(),
      tap_service_target: isObject(item.tap_service_target)
        ? deepClone(item.tap_service_target)
        : String(item.tap_service_target ?? "").trim(),
      tap_url: String(item.tap_url ?? "").trim(),
      navigation_path: String(item.navigation_path ?? "").trim(),
      tap_new_tab: item.tap_new_tab === true,
    };
  }).filter(Boolean).slice(0, 8);
}

function normalizeCameraActions(rawActions = [], cameraIds = []) {
  if (!Array.isArray(rawActions)) {
    return [];
  }
  const validCameras = new Set(cameraIds);
  return rawActions.map(item => {
    if (!isObject(item)) {
      return null;
    }
    const camera = normalizeCameraEntityId(item.camera ?? item.camera_entity ?? item.camera_id) || cameraIds[0] || "";
    const action = normalizeExpandedActions([item])[0];
    if (!camera || !action || (validCameras.size && !validCameras.has(camera))) {
      return null;
    }
    return { camera, ...action };
  }).filter(Boolean).slice(0, MAX_CAMERAS * 8);
}

function normalizeCameraTapActions(rawActions = [], cameraIds = []) {
  if (!Array.isArray(rawActions)) {
    return [];
  }
  const validCameras = new Set(cameraIds);
  const seen = new Set();
  const applyTap = window.NodaliaUtils?.applyCardTapActionField?.bind(window.NodaliaUtils);
  const serializeActionObject = value => (
    isObject(value) ? JSON.stringify(value) : String(value ?? "").trim()
  );
  return rawActions.map(item => {
    if (!isObject(item)) {
      return null;
    }
    const camera = normalizeCameraEntityId(item.camera ?? item.camera_entity ?? item.camera_id) || cameraIds[0] || "";
    if (!camera || seen.has(camera) || (validCameras.size && !validCameras.has(camera))) {
      return null;
    }
    seen.add(camera);
    const normalized = {
      camera,
      tap_action: item.tap_action ?? "toggle",
      tap_service: item.tap_service ?? "",
      tap_service_data: item.tap_service_data ?? "",
      tap_service_target: item.tap_service_target ?? "",
      tap_url: item.tap_url ?? "",
      navigation_path: item.navigation_path ?? "",
      tap_new_tab: item.tap_new_tab === true,
    };
    if (typeof applyTap === "function") {
      applyTap(normalized, {
        actionKey: "tap_action",
        serviceKey: "tap_service",
        serviceDataKey: "tap_service_data",
        serviceTargetKey: "tap_service_target",
        urlKey: "tap_url",
        navigationKey: "navigation_path",
        newTabKey: "tap_new_tab",
      }, item.tap_action ?? "toggle", "toggle");
    }
    const action = normalizeTextKey(normalized.tap_action || "toggle");
    normalized.tap_action = TAP_ACTIONS.has(action) ? action : "toggle";
    normalized.tap_service = String(normalized.tap_service ?? "").trim();
    normalized.tap_service_data = serializeActionObject(normalized.tap_service_data);
    normalized.tap_service_target = serializeActionObject(normalized.tap_service_target);
    normalized.tap_url = String(normalized.tap_url ?? "").trim();
    normalized.navigation_path = String(normalized.navigation_path ?? "").trim();
    normalized.tap_new_tab = normalized.tap_new_tab === true;
    if (normalized.tap_action === "navigate" && !normalized.navigation_path && normalized.tap_url) {
      normalized.navigation_path = normalized.tap_url;
    }
    return normalized;
  }).filter(Boolean).slice(0, MAX_CAMERAS);
}

function compactCameraTapAction(rawAction = {}, fallbackAction = "toggle") {
  const source = isObject(rawAction) ? rawAction : { tap_action: rawAction };
  const action = TAP_ACTIONS.has(normalizeTextKey(source.tap_action))
    ? normalizeTextKey(source.tap_action)
    : fallbackAction;
  const compact = { tap_action: action };
  if (action === "service") {
    compact.tap_service = String(source.tap_service || "").trim();
    if (String(source.tap_service_data || "").trim()) compact.tap_service_data = source.tap_service_data;
    if (String(source.tap_service_target || "").trim()) compact.tap_service_target = source.tap_service_target;
  } else if (action === "url") {
    compact.tap_url = String(source.tap_url || "").trim();
    if (source.tap_new_tab === true) compact.tap_new_tab = true;
  } else if (action === "navigate") {
    compact.navigation_path = String(source.navigation_path || source.tap_url || "").trim();
  }
  return compact;
}

function compactCameraTapActions(rawActions = [], globalTapConfig = "toggle") {
  const fallback = compactCameraTapAction(globalTapConfig, "toggle");
  return rawActions.map(item => {
    if (!item?.camera) {
      return null;
    }
    const actionConfig = compactCameraTapAction(item, "toggle");
    if (JSON.stringify(actionConfig) === JSON.stringify(fallback)) {
      return null;
    }
    return { camera: item.camera, ...actionConfig };
  }).filter(Boolean);
}

function cameraStreamName(entityId) {
  return String(entityId || "").trim().replace(/^camera\./, "");
}

function normalizeCameraStreams(rawStreams = [], cameraIds = []) {
  if (!Array.isArray(rawStreams)) {
    return [];
  }
  const validCameras = new Set(cameraIds);
  const seen = new Set();
  return rawStreams.map(item => {
    if (!isObject(item)) {
      return null;
    }
    const camera = normalizeCameraEntityId(item.camera ?? item.camera_entity ?? item.camera_id) || cameraIds[0] || "";
    if (!camera || seen.has(camera) || (validCameras.size && !validCameras.has(camera))) {
      return null;
    }
    seen.add(camera);
    const configuredProvider = normalizeTextKey(item.provider || "home_assistant").replaceAll("-", "_");
    const rawProvider = configuredProvider === "advanced_camera_card" ? "frigate_go2rtc" : configuredProvider;
    const provider = STREAM_PROVIDERS.has(rawProvider) ? rawProvider : "home_assistant";
    const rawMode = normalizeTextKey(item.mode || "auto");
    return {
      camera,
      provider,
      client_id: String(item.client_id ?? item.frigate_client_id ?? "frigate").trim() || "frigate",
      base_url: String(item.base_url ?? item.baseUrl ?? "").trim(),
      stream: String(item.stream ?? item.stream_name ?? "").trim(),
      mode: STREAM_MODES.has(rawMode) ? rawMode : "auto",
      url: String(item.url ?? "").trim(),
      muted: item.muted !== false,
      controls: item.controls === true,
    };
  }).filter(Boolean).slice(0, MAX_CAMERAS);
}

function compactCameraStreams(rawStreams = []) {
  return rawStreams.map(item => {
    if (item.provider === "frigate_go2rtc") {
      return {
        camera: item.camera,
        provider: "frigate_go2rtc",
        stream: item.stream,
        ...(item.client_id && item.client_id !== "frigate" ? { client_id: item.client_id } : {}),
        ...(item.mode && item.mode !== "auto" ? { mode: item.mode } : {}),
        ...(item.muted === false ? { muted: false } : {}),
        ...(item.controls === true ? { controls: true } : {}),
      };
    }
    if (item.provider === "go2rtc") {
      return {
        camera: item.camera,
        provider: "go2rtc",
        base_url: item.base_url,
        stream: item.stream,
        ...(item.mode && item.mode !== "auto" ? { mode: item.mode } : {}),
      };
    }
    if (item.provider === "iframe") {
      return {
        camera: item.camera,
        provider: "iframe",
        url: item.url,
      };
    }
    if (item.muted !== false && item.controls !== true) {
      return null;
    }
    return {
      camera: item.camera,
      provider: "home_assistant",
      ...(item.muted === false ? { muted: false } : {}),
      ...(item.controls === true ? { controls: true } : {}),
    };
  }).filter(Boolean);
}

const SIGNED_PATH_CACHE = new WeakMap();

function signedPathCacheForHass(hass) {
  const owner = hass?.connection || hass?.auth || hass;
  if (!owner || (typeof owner !== "object" && typeof owner !== "function")) {
    return null;
  }
  let cache = SIGNED_PATH_CACHE.get(owner);
  if (!cache) {
    cache = new Map();
    SIGNED_PATH_CACHE.set(owner, cache);
  }
  return cache;
}

async function signHomeAssistantPath(hass, path, expires = 24 * 60 * 60) {
  if (!path || typeof hass?.callWS !== "function") {
    return "";
  }
  const cache = signedPathCacheForHass(hass);
  const cacheKey = `${path}|${expires}`;
  const cached = cache?.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise;
  }
  const promise = Promise.resolve(hass.callWS({
    type: "auth/sign_path",
    path,
    expires,
  })).then(response => {
    const signedPath = String(response?.path || "").trim();
    if (!signedPath) {
      throw new Error("Home Assistant returned an empty signed go2rtc path");
    }
    return typeof hass?.hassUrl === "function"
      ? hass.hassUrl(signedPath)
      : new URL(signedPath, window.location.origin).toString();
  });
  cache?.set(cacheKey, {
    expiresAt: Date.now() + Math.max(60, expires - 300) * 1000,
    promise,
  });
  try {
    return await promise;
  } catch (error) {
    if (cache?.get(cacheKey)?.promise === promise) {
      cache.delete(cacheKey);
    }
    throw error;
  }
}

async function resolveGo2rtcPlayerSource(hass, streamConfig) {
  const stream = String(streamConfig?.stream || "").trim();
  if (streamConfig?.provider === "frigate_go2rtc") {
    return signHomeAssistantPath(
      hass,
      buildFrigateGo2rtcPath(streamConfig.client_id, stream),
    );
  }
  if (streamConfig?.provider !== "go2rtc") {
    return "";
  }
  const endpoint = buildGo2rtcWebSocketEndpoint(streamConfig.base_url, stream);
  if (!endpoint || !isMixedContentUrl(endpoint)) {
    return endpoint;
  }
  const components = Array.isArray(hass?.config?.components) ? hass.config.components : [];
  if (!components.includes("hass_web_proxy") || typeof hass?.callService !== "function") {
    return "";
  }
  await hass.callService("hass_web_proxy", "create_proxied_url", {
    url_pattern: endpoint,
    open_limit: 0,
    ttl: 24 * 60 * 60,
  });
  const proxyPath = `/api/hass_web_proxy/v0/ws?url=${encodeURIComponent(endpoint)}`;
  return signHomeAssistantPath(hass, proxyPath);
}

function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const cameraIds = normalizeCameras(config);
  config.cameras = cameraIds;
  config.entity = cameraIds[0] || String(config.entity ?? "").trim();
  config.layout = CAMERA_LAYOUT;
  config.presentation = CAMERA_PRESENTATION;
  config.camera_streams = normalizeCameraStreams(config.camera_streams, cameraIds);
  config.camera_tap_actions = normalizeCameraTapActions(config.camera_tap_actions, cameraIds);
  config.camera_actions = normalizeCameraActions(config.camera_actions, cameraIds);
  config.expanded_actions = normalizeExpandedActions(config.expanded_actions);
  config.language = String(config.language ?? "auto").trim() || "auto";
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? { ...DEFAULT_CONFIG.security, ...(isObject(config.security) ? config.security : {}) };

  const applyTap = window.NodaliaUtils?.applyCardTapActionField?.bind(window.NodaliaUtils);
  if (typeof applyTap === "function") {
    applyTap(config, {
      actionKey: "tap_action",
      serviceKey: "tap_service",
      serviceDataKey: "tap_service_data",
      serviceTargetKey: "tap_service_target",
      urlKey: "tap_url",
      navigationKey: "navigation_path",
      newTabKey: "tap_new_tab",
    }, rawConfig?.tap_action ?? config.tap_action, "more-info");
    applyTap(config, {
      actionKey: "hold_action",
      serviceKey: "hold_service",
      serviceDataKey: "hold_service_data",
      serviceTargetKey: "hold_service_target",
      urlKey: "hold_url",
      navigationKey: "hold_navigation_path",
      newTabKey: "hold_new_tab",
    }, rawConfig?.hold_action ?? config.hold_action, "none");
  }

  config.tap_action = TAP_ACTIONS.has(normalizeTextKey(config.tap_action))
    ? normalizeTextKey(config.tap_action)
    : DEFAULT_CONFIG.tap_action;
  config.hold_action = HOLD_ACTIONS.has(normalizeTextKey(config.hold_action))
    ? normalizeTextKey(config.hold_action)
    : DEFAULT_CONFIG.hold_action;
  const serializeActionObject = value => (
    isObject(value) ? JSON.stringify(value) : String(value ?? "").trim()
  );
  config.tap_service = String(config.tap_service ?? "").trim();
  config.tap_service_data = serializeActionObject(config.tap_service_data);
  config.tap_service_target = serializeActionObject(config.tap_service_target);
  config.tap_url = String(config.tap_url ?? "").trim();
  config.navigation_path = String(config.navigation_path ?? "").trim();
  config.hold_service = String(config.hold_service ?? "").trim();
  config.hold_service_data = serializeActionObject(config.hold_service_data);
  config.hold_service_target = serializeActionObject(config.hold_service_target);
  config.hold_url = String(config.hold_url ?? "").trim();
  config.hold_navigation_path = String(config.hold_navigation_path ?? "").trim();
  if (config.tap_action === "navigate" && !config.navigation_path && config.tap_url) {
    config.navigation_path = config.tap_url;
  }
  if (config.hold_action === "navigate" && !config.hold_navigation_path && config.hold_url) {
    config.hold_navigation_path = config.hold_url;
  }
  config.styles = window.NodaliaUtils?.sanitizeStyleTree?.(config.styles, DEFAULT_CONFIG.styles)
    ?? deepClone(DEFAULT_CONFIG.styles);
  return config;
}

class NodaliaCameraCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["camera"], entities, entitiesFallback);
  }

  static getEntitySuggestion(hass, entityId) {
    return window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, { domains: ["camera"] });
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._expandedOpen = false;
    this._expandedEntityId = "";
    this._expandedReturnFocus = null;
    this._failedImageUrls = new Set();
    // entityId -> access_token that already 401'd. Map (not FIFO Set) so a live
    // bad token cannot leave quarantine when unrelated failures accumulate.
    this._failedCameraTokens = new Map();
    this._previewAgeTimer = 0;
    this._expandedCardCache = new Map();
    this._expandedCardConfigSignatures = new WeakMap();
    this._expandedStreamMountId = 0;
    this._expandedStreamNode = null;
    this._go2rtcPrefetchOwner = null;
    this._go2rtcPrefetchSignature = "";
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowKeyDown = this._onShadowKeyDown.bind(this);
    this._onWindowKeyDown = this._onWindowKeyDown.bind(this);
    window.NodaliaUtils?.clearDeferTimers?.(this);
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    this.shadowRoot?.addEventListener("keydown", this._onShadowKeyDown);
    window.addEventListener("keydown", this._onWindowKeyDown);
    this._animateContentOnNextRender = true;
    this._prefetchGo2rtcSources();
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    window.NodaliaUtils?.releaseModalFocus?.(this);
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
    this.shadowRoot?.removeEventListener("keydown", this._onShadowKeyDown);
    window.removeEventListener("keydown", this._onWindowKeyDown);
    this._expandedOpen = false;
    this._expandedEntityId = "";
    this._expandedReturnFocus = null;
    this._expandedStreamMountId += 1;
    this._disposeExpandedStream();
    this._expandedCardCache.clear();
    this._clearPreviewAgeTimer();
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._lastRenderSignature = "";
    this._go2rtcPrefetchSignature = "";
    this._animateContentOnNextRender = true;
    this._prefetchGo2rtcSources();
    if (!this.isConnected) {
      return;
    }
    this._render();
  }

  set hass(hass) {
    const previousHass = this._hass;
    this._hass = hass;
    const prefetchOwner = hass?.connection || hass?.auth || hass || null;
    if (prefetchOwner !== this._go2rtcPrefetchOwner) {
      this._go2rtcPrefetchOwner = prefetchOwner;
      this._go2rtcPrefetchSignature = "";
    }
    this._prefetchGo2rtcSources();
    if (!this.isConnected) {
      return;
    }
    const nextSignature = this._getRenderSignature(hass);
    if (previousHass && this._expandedOpen && this.shadowRoot?.innerHTML) {
      this._lastRenderSignature = nextSignature;
      this._updateExpandedCardsHass();
      this._updateExpandedStreamState();
      return;
    }
    if (previousHass && nextSignature === this._lastRenderSignature && this.shadowRoot?.innerHTML) {
      this._updateExpandedCardsHass();
      return;
    }
    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 3,
      min_columns: 3,
    };
  }

  _getCameraIds() {
    return normalizeCameras(this._config || {});
  }

  _getState(entityId = this._expandedEntityId || this._config?.entity) {
    const id = String(entityId || "").trim();
    return id && this._hass?.states?.[id] ? this._hass.states[id] : null;
  }

  _isFeedPresentation() {
    return true;
  }

  _isMosaicLayout() {
    return true;
  }

  _resolveLanguage() {
    return window.NodaliaI18n?.resolveLanguage?.(this._hass, this._config?.language ?? "auto") ?? "en";
  }

  _cameraUi(path, fallback = "", values = {}) {
    const lang = this._resolveLanguage();
    const pack = window.NodaliaI18n?.strings?.(lang)?.cameraCard
      || window.NodaliaI18n?.strings?.("en")?.cameraCard
      || {};
    const value = path.split(".").reduce((cursor, key) => (cursor && cursor[key] !== undefined ? cursor[key] : undefined), pack);
    if (value === undefined || value === null) {
      return fallback;
    }
    return String(value).replace(/\{(\w+)\}/g, (_, key) => (
      values[key] !== undefined && values[key] !== null ? String(values[key]) : `{${key}}`
    ));
  }

  _getRenderSignature(hass = this._hass) {
    const cameraIds = this._getCameraIds();
    const cameraStates = cameraIds.map(entityId => {
      const state = hass?.states?.[entityId];
      return [
        entityId,
        state?.state || "",
        state?.last_updated || "",
        state?.attributes?.entity_picture || "",
        state?.attributes?.access_token || "",
        state?.attributes?.frontend_stream_type || "",
      ].join(":");
    });
    const joinParts = window.NodaliaRenderSignature?.joinParts;
    const values = [
      cameraIds.join(","),
      this._config?.layout || "",
      this._config?.presentation || "",
      this._config?.name || "",
      String(this._config?.show_name),
      String(this._config?.show_state),
      String(this._config?.show_status_chips),
      String(this._config?.show_last_changed),
      String(this._config?.show_preview_age),
      JSON.stringify(this._config?.camera_streams || []),
      JSON.stringify(this._config?.camera_tap_actions || []),
      JSON.stringify(this._config?.camera_actions || []),
      JSON.stringify(this._config?.expanded_actions || []),
      this._config?.tap_action || "",
      this._config?.hold_action || "",
      String(this._expandedOpen),
      this._expandedEntityId || "",
      ...cameraStates,
      this._resolveLanguage(),
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "camera:", values }]);
    }
    return values.join("|");
  }

  _getTitle(state, entityId = this._config?.entity) {
    const configuredName = String(this._config?.name ?? "").trim();
    const primaryEntity = this._getCameraIds()[0] || this._config?.entity;
    return (entityId === primaryEntity ? configuredName : "")
      || state?.attributes?.friendly_name
      || entityId
      || this._config?.entity
      || this._cameraUi("defaultName", "Camera");
  }

  _translateState(state) {
    const key = normalizeTextKey(state?.state);
    if (key === "streaming") {
      return this._cameraUi("live", "Live");
    }
    if (key === "recording") {
      return this._cameraUi("recording", "Recording");
    }
    if (key === "idle") {
      return this._cameraUi("snapshot", "Snapshot");
    }
    if (key === "unavailable") {
      return this._cameraUi("unavailable", "Unavailable");
    }
    if (key === "unknown") {
      return this._cameraUi("unknown", "Unknown");
    }
    return String(state?.state || this._cameraUi("unknown", "Unknown"));
  }

  _isRecording(state) {
    return normalizeTextKey(state?.state) === "recording"
      || state?.attributes?.recording === true
      || state?.attributes?.is_recording === true;
  }

  _isStreaming(state) {
    const key = normalizeTextKey(state?.state);
    return key === "streaming" || key === "recording" || this._isRecording(state);
  }

  _getCameraImageUrl(state = this._getState(), entityId = this._config?.entity) {
    if (!state || !this._hass || !entityId || isUnavailableState(state)) {
      return "";
    }

    // Always build from the live access_token. Reusing a stale entity_picture token
    // (or requesting camera_proxy without one) returns 401 on HA 2026.6+ and counts
    // toward http IP bans when snapshots refresh.
    const accessToken = String(state.attributes?.access_token || "").trim();
    if (!isUsableCameraAccessToken(accessToken)) {
      return "";
    }
    if (this._failedCameraTokens.get(entityId) === accessToken) {
      return "";
    }

    const path = `/api/camera_proxy/${entityId}?token=${encodeURIComponent(accessToken)}`;
    const resolved = typeof this._hass.hassUrl === "function"
      ? this._hass.hassUrl(path)
      : path;
    const refreshToken = String(state.last_updated || state.last_changed || accessToken);
    return appendQueryParam(resolved, "nodalia_ts", refreshToken);
  }

  _rememberFailedImageUrl(url) {
    const value = String(url || "").trim();
    if (!value) {
      return;
    }
    this._failedImageUrls.delete(value);
    this._failedImageUrls.add(value);
    while (this._failedImageUrls.size > MAX_FAILED_IMAGE_URLS) {
      this._failedImageUrls.delete(this._failedImageUrls.values().next().value);
    }

    const parsed = parseCameraProxyAuth(value);
    if (!parsed.entityId || !isUsableCameraAccessToken(parsed.accessToken)) {
      return;
    }
    this._failedCameraTokens.set(parsed.entityId, parsed.accessToken);
  }

  _clearFailedCameraToken(entityId, accessToken) {
    const id = String(entityId || "").trim();
    if (!id || !isUsableCameraAccessToken(accessToken)) {
      return;
    }
    if (this._failedCameraTokens.get(id) === accessToken) {
      this._failedCameraTokens.delete(id);
    }
  }

  _getStreamProviderHint(state = this._getState()) {
    return String(
      state?.attributes?.frontend_stream_type
      || state?.attributes?.stream_type
      || state?.attributes?.model_name
      || "",
    ).trim();
  }

  _formatLastChanged(state) {
    if (!state?.last_changed) {
      return "";
    }
    try {
      const locale = this._resolveLanguage();
      const date = new Date(state.last_changed);
      if (Number.isNaN(date.getTime())) {
        return "";
      }
      return new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date);
    } catch (_error) {
      return "";
    }
  }

  _formatPreviewAge(state) {
    return formatRelativeAge(
      state?.last_updated || state?.last_changed,
      this._resolveLanguage(),
    );
  }

  _clearPreviewAgeTimer() {
    if (!this._previewAgeTimer) {
      return;
    }
    window.clearTimeout(this._previewAgeTimer);
    this._previewAgeTimer = 0;
  }

  _updatePreviewAgeBubbles() {
    if (!this.shadowRoot || this._config?.show_preview_age === false) {
      return;
    }
    this.shadowRoot.querySelectorAll("[data-camera-preview-age]").forEach(node => {
      const entityId = String(node.dataset?.cameraEntity || "").trim();
      const label = this._formatPreviewAge(this._getState(entityId));
      if (!label) {
        node.hidden = true;
        return;
      }
      node.hidden = false;
      node.textContent = label;
      node.setAttribute("aria-label", this._cameraUi("lastUpdated", "Last updated {time}", { time: label }));
    });
  }

  _previewAgeRefreshDelay() {
    const now = Date.now();
    const hasSubMinutePreview = Array.from(this.shadowRoot?.querySelectorAll("[data-camera-preview-age]") || [])
      .some(node => {
        const state = this._getState(String(node.dataset?.cameraEntity || "").trim());
        const updatedAt = new Date(state?.last_updated || state?.last_changed || "").getTime();
        return Number.isFinite(updatedAt) && Math.max(0, now - updatedAt) < 60000;
      });
    return hasSubMinutePreview ? 1000 : 15000;
  }

  _schedulePreviewAgeRefresh() {
    this._clearPreviewAgeTimer();
    if (
      !this.isConnected
      || this._config?.show_preview_age === false
      || !this.shadowRoot?.querySelector("[data-camera-preview-age]")
    ) {
      return;
    }
    this._previewAgeTimer = window.setTimeout(() => {
      this._previewAgeTimer = 0;
      this._updatePreviewAgeBubbles();
      this._schedulePreviewAgeRefresh();
    }, this._previewAgeRefreshDelay());
  }

  _getStatusChips(state) {
    if (this._config?.show_status_chips === false || !state) {
      return [];
    }

    const chips = [];
    if (isUnavailableState(state)) {
      chips.push({ label: this._cameraUi("offline", "Offline"), tone: "offline" });
      return chips;
    }

    const layout = normalizeTextKey(this._config?.layout);
    if (this._isRecording(state)) {
      chips.push({ label: this._cameraUi("recording", "Recording"), tone: "recording" });
    } else if (this._isStreaming(state) || layout === "live") {
      chips.push({ label: this._cameraUi("live", "Live"), tone: "live" });
    } else {
      chips.push({ label: this._cameraUi("snapshot", "Snapshot"), tone: "snapshot" });
    }

    if (this._config?.show_last_changed !== false) {
      const lastChanged = this._formatLastChanged(state);
      if (lastChanged) {
        chips.push({
          label: this._cameraUi("lastUpdated", "Last updated {time}", { time: lastChanged }),
          tone: "meta",
        });
      }
    }

    return chips;
  }

  _triggerHaptic(styleOverride = null) {
    const haptics = this._config?.haptics || {};
    if (haptics.enabled !== true) {
      return;
    }
    const style = styleOverride || haptics.style || "medium";
    fireEvent(this, "haptic", style, { bubbles: true, composed: true });
  }

  _openMoreInfo(entityId = this._config?.entity) {
    if (entityId) {
      fireEvent(this, "hass-more-info", { entityId });
    }
  }

  _navigateToPath(pathValue) {
    const navigationPath = window.NodaliaUtils?.sanitizeActionUrl?.(pathValue, {
      allowRelative: true,
      allowHash: true,
    }) || "";
    if (!navigationPath || navigationPath.includes("://")) {
      return;
    }

    if (this._hass?.navigate) {
      this._hass.navigate(navigationPath);
      return;
    }

    if (window?.history?.pushState) {
      window.history.pushState(null, "", navigationPath);
      window.dispatchEvent(new CustomEvent("location-changed", {
        detail: { replace: false },
      }));
      return;
    }

    fireEvent(this, "hass-navigate", { path: navigationPath });
  }

  _openConfiguredUrl(urlValue, newTab = false) {
    const url = window.NodaliaUtils?.sanitizeActionUrl?.(urlValue, { allowRelative: true }) || "";
    if (!url) {
      return;
    }
    if (newTab) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (/^(?:https?:)?\/\//i.test(url)) {
      window.open(url, "_self", "noopener,noreferrer");
      return;
    }
    window.history.pushState(null, "", url);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  _isServiceAllowed(serviceValue) {
    const security = this._config?.security || {};
    if (security.strict_service_actions === false) {
      return true;
    }
    const normalizedService = String(serviceValue || "").trim().toLowerCase();
    if (!normalizedService || !normalizedService.includes(".")) {
      return false;
    }
    const [domain] = normalizedService.split(".");
    const domains = Array.isArray(security.allowed_service_domains)
      ? security.allowed_service_domains.map(item => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    const services = Array.isArray(security.allowed_services)
      ? security.allowed_services.map(item => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    if (!domains.length && !services.length) {
      return false;
    }
    return services.includes(normalizedService) || domains.includes(domain);
  }

  _callConfiguredService(serviceValue, rawData = "", rawTarget = "", fallbackEntityId = "") {
    if (!this._hass || !serviceValue) {
      return;
    }
    if (!this._isServiceAllowed(serviceValue)) {
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Camera Card", serviceValue);
      return;
    }
    const [domain, service] = String(serviceValue).split(".");
    if (!domain || !service) {
      return;
    }
    const payload = parseServiceData(rawData);
    const target = parseServiceData(rawTarget);
    const hasExplicitTarget = Object.keys(target).length > 0;
    const entityId = fallbackEntityId || this._config?.entity;
    if (entityId && payload.entity_id === undefined && !hasExplicitTarget) {
      payload.entity_id = entityId;
    }
    const invoke = window.NodaliaUtils?.invokeHomeAssistantService?.bind(window.NodaliaUtils)
      || ((host, hass, svcDomain, svc, data, svcTarget) => Promise.resolve(
        svcTarget != null
          ? hass?.callService?.(svcDomain, svc, data, svcTarget)
          : hass?.callService?.(svcDomain, svc, data),
      ));
    invoke(this, this._hass, domain, service, payload, hasExplicitTarget ? target : null);
  }

  _getCameraTapAction(entityId = this._config?.entity) {
    const camera = String(entityId || this._config?.entity || "").trim();
    const configured = (this._config?.camera_tap_actions || []).find(item => item?.camera === camera);
    if (configured) {
      return configured;
    }
    return {
      camera,
      tap_action: this._config?.tap_action || "toggle",
      tap_service: this._config?.tap_service || "",
      tap_service_data: this._config?.tap_service_data || "",
      tap_service_target: this._config?.tap_service_target || "",
      tap_url: this._config?.tap_url || "",
      navigation_path: this._config?.navigation_path || "",
      tap_new_tab: this._config?.tap_new_tab === true,
    };
  }

  _performCameraTapAction(entityId = this._config?.entity, returnTarget = null) {
    const camera = String(entityId || this._config?.entity || "").trim();
    const actionConfig = this._getCameraTapAction(camera);
    const action = normalizeTextKey(actionConfig.tap_action || "toggle");
    switch (action) {
      case "none":
        return;
      case "toggle":
        this._openExpanded(camera, returnTarget);
        return;
      case "more-info":
        this._openMoreInfo(camera);
        return;
      case "service":
        this._callConfiguredService(
          actionConfig.tap_service,
          actionConfig.tap_service_data,
          actionConfig.tap_service_target,
          camera,
        );
        return;
      case "url":
        this._openConfiguredUrl(actionConfig.tap_url, actionConfig.tap_new_tab === true);
        return;
      case "navigate":
        this._navigateToPath(actionConfig.navigation_path || actionConfig.tap_url);
        return;
      case "auto":
        this._openMoreInfo(camera);
        return;
      default:
        this._openExpanded(camera, returnTarget);
    }
  }

  _performTapAction(returnTarget = null) {
    this._performCameraTapAction(this._config?.entity, returnTarget);
  }

  _performHoldAction() {
    const action = normalizeTextKey(this._config?.hold_action || "none");
    switch (action) {
      case "toggle":
        this._openExpanded();
        return;
      case "more-info":
        this._openMoreInfo();
        return;
      case "service":
        this._callConfiguredService(
          this._config?.hold_service,
          this._config?.hold_service_data,
          this._config?.hold_service_target,
        );
        return;
      case "url":
        this._openConfiguredUrl(this._config?.hold_url, this._config?.hold_new_tab === true);
        return;
      case "navigate":
        this._navigateToPath(this._config?.hold_navigation_path || this._config?.hold_url);
        return;
      case "auto":
      case "none":
      default:
        return;
    }
  }

  _openExpanded(entityId = this._config?.entity, returnTarget = null) {
    if (this._expandedOpen) {
      return;
    }
    const active = returnTarget instanceof HTMLElement ? returnTarget : this.shadowRoot?.activeElement;
    const returnAction = active instanceof HTMLElement ? String(active.dataset?.cameraAction || "") : "";
    const returnEntity = active instanceof HTMLElement ? String(active.dataset?.cameraEntity || "") : "";
    this._expandedReturnFocus = () => {
      const candidates = returnAction === "camera-tap"
        ? Array.from(this.shadowRoot?.querySelectorAll('[data-camera-action="camera-tap"]') || [])
        : Array.from(this.shadowRoot?.querySelectorAll('[data-camera-action="body"]') || []);
      const target = returnEntity
        ? candidates.find(element => element.dataset?.cameraEntity === returnEntity)
        : candidates[0];
      target?.focus?.({ preventScroll: true });
    };
    this._expandedEntityId = String(entityId || this._config?.entity || "").trim();
    this._expandedOpen = true;
    this._lastRenderSignature = "";
    this._render();
  }

  _closeExpanded() {
    if (!this._expandedOpen) {
      return;
    }
    this._expandedOpen = false;
    this._expandedEntityId = "";
    this._expandedStreamMountId += 1;
    this._disposeExpandedStream();
    this._lastRenderSignature = "";
    this._render();
  }

  _performExpandedAction(actionConfig) {
    if (!actionConfig) {
      return;
    }
    const action = normalizeTextKey(actionConfig.tap_action || "toggle");
    const entityId = actionConfig.entity;
    switch (action) {
      case "none":
        return;
      case "toggle":
        if (entityId && this._hass?.states?.[entityId]) {
          const domain = entityId.split(".")[0];
          this._callConfiguredService(`${domain}.toggle`, "", "", entityId);
        }
        return;
      case "more-info":
        this._openMoreInfo(entityId);
        return;
      case "service":
        this._callConfiguredService(
          actionConfig.tap_service,
          actionConfig.tap_service_data,
          actionConfig.tap_service_target,
          entityId,
        );
        return;
      case "url":
        this._openConfiguredUrl(actionConfig.tap_url, actionConfig.tap_new_tab === true);
        return;
      case "navigate":
        this._navigateToPath(actionConfig.navigation_path || actionConfig.tap_url);
        return;
      default:
        this._openMoreInfo(entityId);
    }
  }

  _onWindowKeyDown(event) {
    if (!this.isConnected || !this._expandedOpen) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this._closeExpanded();
    }
  }

  _onShadowClick(event) {
    const path = event.composedPath();
    const button = path.find(node => node instanceof HTMLElement && node.dataset?.cameraAction);
    if (!button) {
      return;
    }

    const action = button.dataset.cameraAction;
    if (action === "camera-tap") {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._performCameraTapAction(button.dataset.cameraEntity || this._config?.entity, button);
      return;
    }
    if (action === "close-expanded") {
      event.preventDefault();
      event.stopPropagation();
      this._closeExpanded();
      return;
    }
    if (action === "body") {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._performTapAction(button);
    }
  }

  _onShadowKeyDown(event) {
    if (window.NodaliaUtils?.isKeyboardActivationEvent?.(event) !== true) {
      return;
    }
    this._onShadowClick(event);
  }

  _renderEmptyState() {
    return `
      <ha-card class="camera-card camera-card--empty">
        <div class="camera-card__empty-title">${escapeHtml(this._cameraUi("emptyTitle", "Nodalia Camera Card"))}</div>
        <div class="camera-card__empty-text">${escapeHtml(this._cameraUi("emptyBody", "Set `entity` to show this card."))}</div>
      </ha-card>
    `;
  }

  _renderPreviewMarkup(state, imageUrl, layout, entityId = this._config?.entity) {
    const unavailable = isUnavailableState(state);
    const imageFailed = imageUrl && this._failedImageUrls.has(imageUrl);
    const showImage = Boolean(imageUrl) && !unavailable && !imageFailed;
    const placeholderLabel = unavailable
      ? this._cameraUi("cameraUnavailable", "Camera unavailable")
      : this._cameraUi("openCamera", "Open camera");
    const title = this._getTitle(state, entityId);
    const previewAge = this._config?.show_preview_age === false ? "" : this._formatPreviewAge(state);
    const previewTapAction = normalizeTextKey(this._getCameraTapAction(entityId).tap_action || "toggle");
    const previewActionLabel = previewTapAction === "toggle"
      ? this._cameraUi("openCamera", "Open camera")
      : title;

    return `
      <div class="camera-card__preview ${layout === "compact" ? "camera-card__preview--compact" : ""} ${layout === "security" ? "camera-card__preview--security" : ""}">
        ${showImage
          ? `<img class="camera-card__image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" data-camera-image="true" data-camera-entity="${escapeHtml(entityId)}" />`
          : `<div class="camera-card__placeholder" aria-hidden="true">
              <ha-icon icon="mdi:cctv"></ha-icon>
              <span>${escapeHtml(placeholderLabel)}</span>
            </div>`}
        <div class="camera-card__overlay"></div>
        ${showImage && previewAge ? `<span
          class="camera-card__preview-age"
          data-camera-preview-age
          data-camera-entity="${escapeHtml(entityId)}"
          aria-label="${escapeHtml(this._cameraUi("lastUpdated", "Last updated {time}", { time: previewAge }))}"
        >${escapeHtml(previewAge)}</span>` : ""}
        <button
          type="button"
          class="camera-card__preview-open"
          data-camera-action="camera-tap"
          data-camera-entity="${escapeHtml(entityId)}"
          aria-label="${escapeHtml(previewActionLabel)}"
        ></button>
      </div>
    `;
  }

  _renderMosaicMarkup(cameraIds, layout) {
    const count = cameraIds.length;
    const mosaicClass = count === 2 ? "camera-card__mosaic--two"
      : count === 3 ? "camera-card__mosaic--three"
        : count >= 4 ? "camera-card__mosaic--four" : "camera-card__mosaic--one";
    const cells = cameraIds.map((entityId, index) => {
      const state = this._getState(entityId);
      const imageUrl = this._getCameraImageUrl(state, entityId);
      const area = count === 3
        ? (index === 0 ? "main" : index === 1 ? "top" : "bottom")
        : count === 4
          ? (index === 0 ? "a" : index === 1 ? "b" : index === 2 ? "c" : "d")
          : "";
      return `
        <div class="camera-card__mosaic-cell ${area ? `camera-card__mosaic-cell--${area}` : ""}" data-camera-entity="${escapeHtml(entityId)}">
          ${this._renderPreviewMarkup(state, imageUrl, layout, entityId)}
        </div>
      `;
    }).join("");
    return `<div class="camera-card__mosaic ${mosaicClass}">${cells}</div>`;
  }

  _getExpandedActionsForCamera(entityId = this._expandedEntityId || this._config?.entity) {
    const cameraActions = Array.isArray(this._config?.camera_actions) ? this._config.camera_actions : [];
    const actions = cameraActions.filter(action => action.camera === entityId);
    if (actions.length || entityId !== this._getCameraIds()[0]) {
      return actions;
    }
    return Array.isArray(this._config?.expanded_actions) ? this._config.expanded_actions : [];
  }

  _getCameraStreamConfig(entityId = this._expandedEntityId || this._config?.entity) {
    const configured = (this._config?.camera_streams || []).find(item => item?.camera === entityId);
    return configured || {
      camera: entityId,
      provider: "home_assistant",
      client_id: "frigate",
      base_url: "",
      stream: cameraStreamName(entityId),
      mode: "auto",
      url: "",
      muted: true,
      controls: false,
    };
  }

  _prefetchGo2rtcSources() {
    if (!this._hass || !this._config) {
      return;
    }
    const streamConfigs = (this._config.camera_streams || [])
      .filter(streamConfig => streamConfig?.provider === "frigate_go2rtc");
    const signature = JSON.stringify(streamConfigs.map(streamConfig => [
      streamConfig.client_id,
      streamConfig.stream,
    ]));
    if (!streamConfigs.length || signature === this._go2rtcPrefetchSignature) {
      return;
    }
    this._go2rtcPrefetchSignature = signature;
    void Promise.allSettled(streamConfigs.map(streamConfig => (
      resolveGo2rtcPlayerSource(this._hass, streamConfig)
    ))).then(results => {
      if (
        this._go2rtcPrefetchSignature === signature
        && results.some(result => result.status === "rejected" || !result.value)
      ) {
        this._go2rtcPrefetchSignature = "";
      }
    });
  }

  _updateExpandedStreamState() {
    const node = this._expandedStreamNode;
    if (!node || !this._hass) {
      return;
    }
    if (node.localName === "ha-camera-stream") {
      node.hass = this._hass;
      node.stateObj = this._getState(this._expandedEntityId);
    } else if (node.localName !== "nodalia-go2rtc-player") {
      node.hass = this._hass;
    }
  }

  _disposeExpandedStream() {
    if (typeof this._expandedStreamNode?.disconnect === "function") {
      this._expandedStreamNode.disconnect();
    }
    this._expandedStreamNode = null;
  }

  _setExpandedStreamStatus(state, detail = "") {
    if (!this.shadowRoot) {
      return;
    }
    const status = this.shadowRoot.querySelector("[data-camera-stream-status]");
    const host = this.shadowRoot.querySelector("[data-camera-expanded-stream]");
    if (!(status instanceof HTMLElement) || !(host instanceof HTMLElement)) {
      return;
    }
    const errorIcon = status.querySelector("[data-camera-stream-error-icon]");
    const label = status.querySelector("[data-camera-stream-status-label]");
    const loaded = state === "loaded";
    status.hidden = loaded;
    host.classList.toggle("is-loaded", loaded);
    status.classList.toggle("is-error", state === "error");
    if (errorIcon instanceof HTMLElement) {
      errorIcon.hidden = state !== "error";
    }
    if (label) {
      label.textContent = state === "error"
        ? this._cameraUi("liveUnavailable", "Live stream unavailable")
        : this._cameraUi("connectingLive", "Connecting live stream");
    }
    status.title = detail;
  }

  async _mountExpandedStream() {
    if (!this.shadowRoot || !this._expandedOpen) {
      return;
    }
    const host = this.shadowRoot.querySelector("[data-camera-expanded-stream]");
    if (!(host instanceof HTMLElement)) {
      return;
    }
    const entityId = this._expandedEntityId || this._config?.entity;
    const streamConfig = this._getCameraStreamConfig(entityId);
    const nativeGo2rtc = streamConfig.provider === "frigate_go2rtc" || streamConfig.provider === "go2rtc";
    if (streamConfig.provider !== "home_assistant" && !nativeGo2rtc) {
      return;
    }
    const mountId = ++this._expandedStreamMountId;
    if (nativeGo2rtc) {
      this._setExpandedStreamStatus("loading");
      const player = document.createElement("nodalia-go2rtc-player");
      try {
        if (typeof player.configure !== "function") {
          throw new Error("The native go2rtc player is not registered");
        }
        player.classList.add("camera-card__expanded-go2rtc");
        const playbackMode = streamConfig.provider === "frigate_go2rtc" && streamConfig.mode === "auto"
          ? "auto-mse"
          : streamConfig.mode;
        player.configure({
          source: "",
          mode: playbackMode,
          muted: streamConfig.muted,
          controls: streamConfig.controls,
        });
        host.replaceChildren(player);
        this._expandedStreamNode = player;
        if (streamConfig.muted === false) {
          player.primeAudioFromUserGesture?.();
        }
        const sourceConfig = {
          ...streamConfig,
          stream: streamConfig.stream || cameraStreamName(entityId),
        };
        let source;
        try {
          source = await resolveGo2rtcPlayerSource(this._hass, sourceConfig);
        } catch (_firstError) {
          await new Promise(resolve => window.setTimeout(resolve, 350));
          if (mountId !== this._expandedStreamMountId || !this._expandedOpen || !host.isConnected) {
            player.disconnect?.();
            return;
          }
          source = await resolveGo2rtcPlayerSource(this._hass, sourceConfig);
        }
        if (
          mountId !== this._expandedStreamMountId
          || !this._expandedOpen
          || !host.isConnected
        ) {
          player.disconnect?.();
          return;
        }
        if (!source) {
          throw new Error("No usable go2rtc WebSocket endpoint was resolved");
        }
        player.addEventListener("nodalia-go2rtc-loaded", () => {
          if (mountId !== this._expandedStreamMountId) {
            return;
          }
          this._setExpandedStreamStatus("loaded");
          const poster = this.shadowRoot?.querySelector('[data-camera-poster="true"]');
          if (poster instanceof HTMLElement) {
            poster.hidden = true;
          }
        }, { once: true });
        player.addEventListener("nodalia-go2rtc-state", event => {
          if (
            mountId === this._expandedStreamMountId
            && (event.detail?.state === "connecting" || event.detail?.state === "retrying")
          ) {
            this._setExpandedStreamStatus("loading", event.detail?.message || "");
          }
        });
        player.addEventListener("nodalia-go2rtc-error", event => {
          if (mountId !== this._expandedStreamMountId) {
            return;
          }
          this._setExpandedStreamStatus("error", event.detail?.message || "go2rtc error");
        });
        player.configure({
          source,
          mode: playbackMode,
          muted: streamConfig.muted,
          controls: streamConfig.controls,
        });
      } catch (error) {
        player.disconnect?.();
        this._setExpandedStreamStatus("error", error?.message || String(error));
        console.warn("[nodalia-camera-card] Unable to start the go2rtc stream", error);
      }
      return;
    }
    const mountNativeStream = () => {
      if (mountId !== this._expandedStreamMountId || !this._expandedOpen || !host.isConnected) {
        return false;
      }
      const stream = document.createElement("ha-camera-stream");
      stream.hass = this._hass;
      stream.stateObj = this._getState(entityId);
      stream.controls = streamConfig.controls === true;
      stream.muted = streamConfig.muted !== false;
      stream.fitMode = "contain";
      stream.aspectRatio = "16:9";
      host.replaceChildren(stream);
      this._expandedStreamNode = stream;
      return true;
    };

    if (customElements.get("ha-camera-stream")) {
      mountNativeStream();
      return;
    }
    try {
      const helpers = await window.loadCardHelpers?.();
      if (mountId !== this._expandedStreamMountId || !this._expandedOpen || !host.isConnected) {
        return;
      }
      if (customElements.get("ha-camera-stream") && mountNativeStream()) {
        return;
      }
      if (typeof helpers?.createCardElement !== "function") {
        return;
      }
      const fallback = await helpers.createCardElement({
        type: "picture-entity",
        entity: entityId,
        camera_view: "live",
        show_name: false,
        show_state: false,
        fit_mode: "contain",
      });
      if (mountId !== this._expandedStreamMountId || !this._expandedOpen || !host.isConnected) {
        return;
      }
      fallback.hass = this._hass;
      fallback.classList.add("camera-card__expanded-native-fallback");
      host.replaceChildren(fallback);
      this._expandedStreamNode = fallback;
    } catch (_error) {
      // The preview poster remains visible if Home Assistant cannot create a live player.
    }
  }

  _expandedCardTag(entityId) {
    const domain = String(entityId || "").split(".")[0];
    return {
      light: "nodalia-light-card",
      fan: "nodalia-fan-card",
      humidifier: "nodalia-humidifier-card",
      vacuum: "nodalia-vacuum-card",
      cover: "nodalia-cover-card",
      climate: "nodalia-climate-card",
    }[domain] || "nodalia-entity-card";
  }

  _expandedCardConfig(action) {
    const domain = String(action.entity || "").split(".")[0];
    const security = deepClone(this._config?.security || DEFAULT_CONFIG.security);
    if (action.tap_action === "service" && action.tap_service) {
      security.allowed_services = Array.from(new Set([
        ...(Array.isArray(security.allowed_services) ? security.allowed_services : []),
        action.tap_service,
      ]));
    }
    const config = {
      entity: action.entity,
      tap_action: action.tap_action || "toggle",
      tap_new_tab: action.tap_new_tab === true,
      security,
      haptics: deepClone(this._config?.haptics || DEFAULT_CONFIG.haptics),
      animations: {
        ...deepClone(this._config?.animations || DEFAULT_CONFIG.animations),
        content_duration: 0,
        panel_duration: 0,
      },
      compact_layout_mode: domain === "lock" || domain === "switch" || domain === "input_boolean" ? "always" : "never",
    };
    ["name", "icon", "tap_service", "tap_service_data", "tap_service_target", "tap_url", "navigation_path"].forEach(key => {
      if (action[key]) {
        config[key] = (key === "tap_service_data" || key === "tap_service_target") && isObject(action[key])
          ? JSON.stringify(action[key])
          : deepClone(action[key]);
      }
    });
    if (action.icon_color) {
      config.styles = {
        icon: {
          color: action.icon_color,
          on_color: action.icon_color,
          off_color: action.icon_color,
        },
      };
    }
    if (domain === "light") {
      Object.assign(config, {
        auto_expand: true,
        show_brightness: true,
        show_slider_mode_buttons: true,
        show_color_controls: true,
        show_temperature_controls: true,
        show_quick_brightness: false,
        show_quick_color_presets: false,
        show_quick_temperature_presets: false,
        icon_tap_action: action.tap_action || "toggle",
      });
    } else if (domain === "fan") {
      Object.assign(config, {
        show_slider: true,
        show_preset_modes: true,
        show_oscillation: true,
        icon_tap_action: action.tap_action || "toggle",
      });
    } else if (domain === "humidifier") {
      Object.assign(config, {
        show_slider: true,
        show_mode_button: true,
        show_fan_mode_button: true,
        icon_tap_action: action.tap_action || "toggle",
      });
    } else if (domain === "vacuum") {
      Object.assign(config, {
        show_mode_controls: true,
        show_fan_presets: true,
        show_return_to_base: true,
        show_stop: true,
        show_locate: true,
      });
    } else if (domain === "lock" || domain === "switch" || domain === "input_boolean") {
      config.grid_options = {
        columns: 3,
        rows: 1,
      };
    }
    return config;
  }

  _updateExpandedCardsHass() {
    for (const card of this._expandedCardCache.values()) {
      if (this._hass) {
        card.hass = this._hass;
      }
    }
  }

  _mountExpandedCards() {
    if (!this.shadowRoot || !this._expandedOpen) {
      return;
    }
    const entityId = this._expandedEntityId || this._config?.entity;
    const actions = this._getExpandedActionsForCamera(entityId);
    const validKeys = new Set();
    this.shadowRoot.querySelectorAll("[data-camera-expanded-card]").forEach(host => {
      if (!(host instanceof HTMLElement)) {
        return;
      }
      const index = Number(host.dataset.actionIndex);
      const action = actions[index];
      if (!action?.entity) {
        return;
      }
      const tagName = this._expandedCardTag(action.entity);
      const cacheKey = `${entityId}:${index}:${tagName}:${action.entity}`;
      validKeys.add(cacheKey);
      let card = this._expandedCardCache.get(cacheKey);
      if (!card) {
        card = document.createElement(tagName);
        this._expandedCardCache.set(cacheKey, card);
      }
      if (card.parentElement !== host) {
        host.replaceChildren(card);
      }
      const cardConfig = this._expandedCardConfig(action);
      const signature = JSON.stringify(cardConfig);
      if (this._expandedCardConfigSignatures.get(card) !== signature) {
        card.setConfig(cardConfig);
        this._expandedCardConfigSignatures.set(card, signature);
      }
      if (this._hass) {
        card.hass = this._hass;
      }
    });
    for (const [key, card] of this._expandedCardCache) {
      if (!validKeys.has(key)) {
        card.remove();
        this._expandedCardCache.delete(key);
      }
    }
  }

  _renderExpandedActionsMarkup(entityId) {
    const actions = this._getExpandedActionsForCamera(entityId);
    if (!actions.length) {
      return "";
    }
    return `
      <div class="camera-card__expanded-actions">
        ${actions.map((action, index) => `
          <div
            class="camera-card__expanded-card-host"
            data-camera-expanded-card
            data-action-index="${index}"
            data-entity="${escapeHtml(action.entity)}"
          ></div>
        `).join("")}
      </div>
    `;
  }

  _renderExpandedOverlay(state, imageUrl, entityId = this._expandedEntityId || this._config?.entity) {
    if (!this._expandedOpen) {
      return "";
    }

    const unavailable = isUnavailableState(state);
    const imageFailed = imageUrl && this._failedImageUrls.has(imageUrl);
    const showImage = Boolean(imageUrl) && !unavailable && !imageFailed;
    const title = this._getTitle(state, entityId);
    const streamConfig = this._getCameraStreamConfig(entityId);
    const nativeGo2rtc = streamConfig.provider === "frigate_go2rtc" || streamConfig.provider === "go2rtc";
    const iframeUrl = streamConfig.provider === "iframe" ? sanitizeIframeUrl(streamConfig.url) : "";
    const embeddableStreamUrl = isMixedContentUrl(iframeUrl) ? "" : iframeUrl;

    return `
      <div class="camera-card__expanded is-open" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <button type="button" class="camera-card__expanded-backdrop" data-camera-action="close-expanded" aria-label="${escapeHtml(this._cameraUi("close", "Close"))}"></button>
        <div class="camera-card__expanded-panel">
          <div class="camera-card__expanded-toolbar">
            <div class="camera-card__expanded-title">${escapeHtml(title)}</div>
            <button type="button" class="camera-card__expanded-close" data-camera-action="close-expanded" aria-label="${escapeHtml(this._cameraUi("close", "Close"))}">
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          <div class="camera-card__expanded-stage">
            ${showImage
              ? `<img class="camera-card__expanded-poster" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" data-camera-poster="true" />`
              : `<div class="camera-card__expanded-placeholder">
                  <ha-icon icon="mdi:cctv"></ha-icon>
                  <span>${escapeHtml(this._cameraUi("cameraUnavailable", "Camera unavailable"))}</span>
                </div>`}
            ${streamConfig.provider === "home_assistant" || streamConfig.provider === "frigate_go2rtc" || streamConfig.provider === "go2rtc"
              ? `<div class="camera-card__expanded-stream" data-camera-expanded-stream></div>`
              : embeddableStreamUrl
                ? `<iframe class="camera-card__expanded-stream-frame" src="${escapeHtml(embeddableStreamUrl)}" title="${escapeHtml(title)}" allow="autoplay; fullscreen" sandbox="allow-scripts allow-forms allow-presentation allow-popups" loading="eager" referrerpolicy="no-referrer"></iframe>`
                : ""}
            ${nativeGo2rtc ? `
              <div class="camera-card__stream-status" data-camera-stream-status>
                <span class="camera-card__stream-indicator" aria-hidden="true">
                  <span class="camera-card__stream-spinner"></span>
                  <ha-icon icon="mdi:alert-circle-outline" data-camera-stream-error-icon hidden></ha-icon>
                </span>
                <span data-camera-stream-status-label>${escapeHtml(this._cameraUi("connectingLive", "Connecting live stream"))}</span>
              </div>
            ` : ""}
          </div>
          ${this._renderExpandedActionsMarkup(entityId)}
        </div>
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    this._clearPreviewAgeTimer();

    const config = this._config || {};
    const cameraIds = this._getCameraIds();
    if (!cameraIds.length) {
      this.shadowRoot.innerHTML = window.NodaliaUtils?.renderCardEmptyStateDocument?.(
        this._renderEmptyState(),
        { card: (config || DEFAULT_CONFIG).styles?.card },
      ) ?? this._renderEmptyState();
      return;
    }

    const entityGuard = window.NodaliaUtils?.renderLovelaceEntityGuardCardHtml?.(
      this._hass,
      cameraIds[0],
      { cardClass: "camera-card" },
    );
    if (entityGuard) {
      this.shadowRoot.innerHTML = entityGuard;
      return;
    }

    const primaryEntity = cameraIds[0];
    const state = this._getState(primaryEntity);
    if (!state && !this._isMosaicLayout()) {
      this.shadowRoot.innerHTML = window.NodaliaUtils?.renderCardEmptyStateDocument?.(
        this._renderEmptyState(),
        { card: (config || DEFAULT_CONFIG).styles?.card },
      ) ?? this._renderEmptyState();
      return;
    }

    const styles = config.styles || DEFAULT_CONFIG.styles;
    const layout = normalizeTextKey(config.layout) || "live";
    const mosaicLayout = this._isMosaicLayout();
    const feedLayout = this._isFeedPresentation();
    const title = this._getTitle(state, primaryEntity);
    const stateLabel = config.show_state !== false ? this._translateState(state) : "";
    const imageUrl = this._getCameraImageUrl(state, primaryEntity);
    const chips = mosaicLayout ? [] : this._getStatusChips(state);
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const unavailable = state ? isUnavailableState(state) : false;
    const securityLayout = layout === "security";
    const animations = {
      enabled: config.animations?.enabled !== false,
      contentDuration: Number(config.animations?.content_duration) || DEFAULT_CONFIG.animations.content_duration,
      buttonBounceDuration: Number(config.animations?.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration,
    };
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const overlayStrength = clamp(Number(styles.preview?.overlay_strength) || DEFAULT_CONFIG.styles.preview.overlay_strength, 0.1, 0.8);
    const previewAspect = String(styles.preview?.aspect_ratio || DEFAULT_CONFIG.styles.preview.aspect_ratio);
    const previewMinHeight = String(styles.preview?.min_height || DEFAULT_CONFIG.styles.preview.min_height || "220px");
    const mosaicGap = String(styles.preview?.mosaic_gap ?? DEFAULT_CONFIG.styles.preview.mosaic_gap ?? "0px");
    const chipHeight = escapeHtml(String(styles.chip_height || DEFAULT_CONFIG.styles.chip_height || "24px"));
    const chipFontSize = escapeHtml(String(styles.chip_font_size || DEFAULT_CONFIG.styles.chip_font_size || "11px"));
    const chipPadding = escapeHtml(String(styles.chip_padding || DEFAULT_CONFIG.styles.chip_padding || "0 9px"));
    const effectivePadding = feedLayout ? "0" : (styles.card.padding || DEFAULT_CONFIG.styles.card.padding);
    const effectiveGap = feedLayout ? "0" : (styles.card.gap || DEFAULT_CONFIG.styles.card.gap);
    const previewRadius = feedLayout
      ? "0"
      : escapeHtml(String(styles.preview?.border_radius || DEFAULT_CONFIG.styles.preview.border_radius || "18px"));
    const cardBackground = unavailable
      ? styles.card.background
      : securityLayout
        ? `linear-gradient(180deg, color-mix(in srgb, #ff4d6d 10%, ${styles.card.background}) 0%, ${styles.card.background} 100%)`
        : styles.card.background;
    const cardBorder = securityLayout && !unavailable
      ? "1px solid color-mix(in srgb, #ff4d6d 28%, var(--divider-color))"
      : styles.card.border;
    const showHeader = config.show_name !== false || stateLabel;
    const expandedEntity = this._expandedEntityId || primaryEntity;
    const expandedState = this._getState(expandedEntity);
    const expandedImageUrl = this._getCameraImageUrl(expandedState, expandedEntity);
    const previewMarkup = mosaicLayout
      ? this._renderMosaicMarkup(cameraIds, layout)
      : this._renderPreviewMarkup(state, imageUrl, layout, primaryEntity);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --camera-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          display: block;
        }

        * { box-sizing: border-box; }

        [data-camera-action="camera-tap"]:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: -3px;
        }

        ha-card {
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          color: var(--primary-text-color);
          isolation: isolate;
          overflow: hidden;
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        ha-card::before {
          background: linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0));
          border-radius: inherit;
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .camera-card__content {
          display: grid;
          gap: ${effectiveGap};
          padding: ${effectivePadding};
          position: relative;
          z-index: 1;
        }

        .camera-card__content--entering {
          animation: camera-card-fade-up calc(var(--camera-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .camera-card__preview {
          aspect-ratio: ${previewAspect};
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: ${previewRadius};
          min-height: ${previewMinHeight};
          overflow: hidden;
          position: relative;
        }

        .camera-card--feed .camera-card__preview {
          border-radius: 0;
        }

        .camera-card--feed ha-card::before {
          display: none;
        }

        .camera-card--feed .camera-card__overlay {
          opacity: 0.55;
        }

        .camera-card__mosaic {
          display: grid;
          gap: ${mosaicGap};
          min-height: ${previewMinHeight};
          width: 100%;
        }

        .camera-card__mosaic--one {
          grid-template-columns: 1fr;
        }

        .camera-card__mosaic--two {
          grid-template-columns: 1fr 1fr;
        }

        .camera-card__mosaic--three {
          grid-template-areas:
            "main top"
            "main bottom";
          grid-template-columns: 2fr 1fr;
          grid-template-rows: 1fr 1fr;
        }

        .camera-card__mosaic--four {
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
        }

        .camera-card__mosaic-cell {
          min-height: 0;
          position: relative;
        }

        .camera-card__mosaic-cell .camera-card__preview {
          aspect-ratio: auto;
          height: 100%;
          min-height: ${mosaicLayout && cameraIds.length > 1 ? "106px" : previewMinHeight};
        }

        .camera-card__mosaic-cell--main { grid-area: main; }
        .camera-card__mosaic-cell--top { grid-area: top; }
        .camera-card__mosaic-cell--bottom { grid-area: bottom; }

        .camera-card__preview--compact {
          aspect-ratio: 4 / 3;
        }

        .camera-card__preview--security {
          box-shadow: inset 0 0 0 1px color-mix(in srgb, #ff4d6d 18%, transparent);
        }

        .camera-card__image,
        .camera-card__placeholder,
        .camera-card__overlay,
        .camera-card__preview-open {
          inset: 0;
          position: absolute;
        }

        .camera-card__image {
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .camera-card__placeholder,
        .camera-card__expanded-placeholder {
          align-items: center;
          color: color-mix(in srgb, var(--primary-text-color) 72%, transparent);
          display: flex;
          flex-direction: column;
          gap: 8px;
          justify-content: center;
          text-align: center;
        }

        .camera-card__placeholder ha-icon,
        .camera-card__expanded-placeholder ha-icon {
          --mdc-icon-size: 42px;
          opacity: 0.82;
        }

        .camera-card__overlay {
          background: linear-gradient(180deg, rgba(0, 0, 0, ${overlayStrength * 0.35}) 0%, rgba(0, 0, 0, ${overlayStrength}) 100%);
          pointer-events: none;
        }

        .camera-card__preview-age {
          backdrop-filter: blur(10px) saturate(1.08);
          -webkit-backdrop-filter: blur(10px) saturate(1.08);
          background: rgba(0, 0, 0, 0.34);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          bottom: 12px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 8px 20px rgba(0, 0, 0, 0.2);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          left: 12px;
          line-height: 1;
          max-width: calc(100% - 24px);
          overflow: hidden;
          padding: 5px 9px;
          pointer-events: none;
          position: absolute;
          text-overflow: ellipsis;
          white-space: nowrap;
          z-index: 2;
        }

        .camera-card__preview-open {
          appearance: none;
          background: transparent;
          border: 0;
          cursor: pointer;
          margin: 0;
          padding: 0;
          width: 100%;
          z-index: 1;
        }

        .camera-card__preview-open:focus-visible {
          box-shadow: inset 0 0 0 3px var(--primary-color);
          outline: 0;
        }

        .camera-card__header {
          cursor: pointer;
          display: grid;
          gap: 4px;
          min-width: 0;
          padding: ${feedLayout ? "12px 14px 0" : "0"};
        }

        .camera-card__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: ${feedLayout ? "0 14px 12px" : "0"};
        }

        .camera-card__chip {
          align-items: center;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          display: inline-flex;
          font-size: ${chipFontSize};
          font-weight: 600;
          line-height: 1;
          min-height: ${chipHeight};
          padding: ${chipPadding};
        }

        .camera-card__title {
          font-size: ${styles.title_size};
          font-weight: 700;
          line-height: 1.2;
        }

        .camera-card__state {
          color: var(--secondary-text-color);
          font-size: ${styles.subtitle_size};
        }

        .camera-card__chip--live {
          background: color-mix(in srgb, var(--info-color, #71c0ff) 18%, transparent);
          color: var(--info-color, #71c0ff);
        }

        .camera-card__chip--snapshot {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          color: var(--primary-text-color);
        }

        .camera-card__chip--recording {
          background: color-mix(in srgb, #ff4d6d 18%, transparent);
          color: #ff4d6d;
        }

        .camera-card__chip--offline {
          background: color-mix(in srgb, var(--disabled-text-color, #808080) 16%, transparent);
          color: var(--disabled-text-color, #808080);
        }

        .camera-card__chip--meta {
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          color: var(--secondary-text-color);
          text-transform: none;
        }

        .camera-card__expanded {
          display: none;
          inset: 0;
          position: fixed;
          z-index: 30;
        }

        .camera-card__expanded.is-open {
          display: block;
        }

        .camera-card__expanded-backdrop {
          background: rgba(0, 0, 0, 0.62);
          border: 0;
          cursor: pointer;
          height: 100%;
          inset: 0;
          margin: 0;
          padding: 0;
          position: absolute;
          width: 100%;
        }

        .camera-card__expanded-panel {
          background: var(--ha-card-background, #1c1c1c);
          border: 1px solid var(--divider-color);
          border-radius: 24px;
          box-shadow: var(--ha-card-box-shadow, 0 18px 48px rgba(0, 0, 0, 0.35));
          display: grid;
          gap: 12px;
          inset: auto;
          left: 50%;
          max-height: min(88vh, 920px);
          max-width: min(96vw, 1080px);
          overflow: auto;
          padding: 14px;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: min(96vw, 1080px);
        }

        .camera-card__expanded-toolbar {
          align-items: center;
          display: flex;
          gap: 12px;
          justify-content: space-between;
        }

        .camera-card__expanded-title {
          font-size: 16px;
          font-weight: 700;
          min-width: 0;
        }

        .camera-card__expanded-close {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 0;
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: 36px;
          justify-content: center;
          width: 36px;
        }

        .camera-card__expanded-stage {
          aspect-ratio: 16 / 9;
          background: #000;
          border-radius: 18px;
          overflow: hidden;
          position: relative;
        }

        .camera-card__expanded-poster,
        .camera-card__expanded-stream,
        .camera-card__expanded-stream-frame {
          inset: 0;
          position: absolute;
        }

        .camera-card__expanded-poster {
          height: 100%;
          object-fit: contain;
          width: 100%;
        }

        .camera-card__expanded-stream,
        .camera-card__expanded-stream > *,
        .camera-card__expanded-stream-frame {
          border: 0;
          display: block;
          height: 100%;
          width: 100%;
        }

        .camera-card__expanded-stream ha-camera-stream {
          background: #000;
          object-fit: contain;
        }

        .camera-card__stream-status {
          align-items: center;
          backdrop-filter: blur(12px);
          background: color-mix(in srgb, #111 76%, transparent);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          bottom: 14px;
          color: #fff;
          display: inline-flex;
          font-size: 12px;
          font-weight: 650;
          gap: 7px;
          left: 14px;
          max-width: calc(100% - 28px);
          padding: 7px 10px;
          position: absolute;
          z-index: 2;
        }

        .camera-card__stream-status[hidden] {
          display: none;
        }

        .camera-card__stream-indicator {
          display: grid;
          flex: 0 0 auto;
          height: 17px;
          place-items: center;
          width: 17px;
        }

        .camera-card__stream-spinner {
          animation: camera-card-stream-spin 760ms linear infinite;
          background: conic-gradient(from 0deg, transparent 0 62%, currentColor 84% 100%);
          border-radius: 50%;
          height: 16px;
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0);
          mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0);
          transform-origin: 50% 50%;
          width: 16px;
        }

        .camera-card__stream-indicator ha-icon {
          height: 17px;
          width: 17px;
        }

        .camera-card__stream-indicator ha-icon[hidden],
        .camera-card__stream-status.is-error .camera-card__stream-spinner {
          display: none;
        }

        .camera-card__stream-status.is-error .camera-card__stream-indicator ha-icon {
          color: var(--error-color, #db4437);
        }

        .camera-card__stream-status [data-camera-stream-status-label] {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .camera-card__expanded-actions {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
        }

        .camera-card__expanded-card-host,
        .camera-card__expanded-card-host > * {
          display: block;
          min-width: 0;
          width: 100%;
        }

        @keyframes camera-card-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes camera-card-stream-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 720px) {
          .camera-card__expanded-panel {
            border-radius: 18px 18px 0 0;
            bottom: 0;
            max-height: 92vh;
            max-height: 92dvh;
            top: auto;
            transform: translateX(-50%);
            width: 100%;
          }
        }
        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <ha-card class="camera-card camera-card--${escapeHtml(layout)} ${feedLayout ? "camera-card--feed" : ""}">
        <div class="camera-card__content ${shouldAnimateEntrance ? "camera-card__content--entering" : ""}">
          ${previewMarkup}
          ${showHeader ? `
            <div class="camera-card__header">
              ${config.show_name !== false ? `<div class="camera-card__title">${escapeHtml(title)}</div>` : ""}
              ${stateLabel ? `<div class="camera-card__state">${escapeHtml(stateLabel)}</div>` : ""}
            </div>
          ` : ""}
          ${chips.length ? `
            <div class="camera-card__chips">
              ${chips.map(chip => `
                <span class="camera-card__chip camera-card__chip--${escapeHtml(chip.tone)}">${escapeHtml(chip.label)}</span>
              `).join("")}
            </div>
          ` : ""}
        </div>
      </ha-card>
      ${this._renderExpandedOverlay(expandedState, expandedImageUrl, expandedEntity)}
    `;

    this.shadowRoot.querySelectorAll('img[data-camera-image="true"]').forEach(node => {
      if (!(node instanceof HTMLImageElement)) {
        return;
      }
      node.addEventListener("error", () => {
        const src = node.getAttribute("src");
        if (src) {
          this._rememberFailedImageUrl(src);
          this._lastRenderSignature = "";
          this._render();
        }
      }, { once: true });
      node.addEventListener("load", () => {
        const src = node.getAttribute("src");
        if (!src) {
          return;
        }
        this._failedImageUrls.delete(src);
        const parsed = parseCameraProxyAuth(src);
        this._clearFailedCameraToken(parsed.entityId, parsed.accessToken);
      }, { once: true });
    });

    this.shadowRoot.querySelectorAll('img[data-camera-poster="true"]').forEach(node => {
      node.addEventListener("error", () => {
        const src = node.getAttribute("src");
        if (src) {
          this._rememberFailedImageUrl(src);
        }
        node.hidden = true;
      }, { once: true });
    });

    this._mountExpandedCards();
    this._mountExpandedStream();
    const expandedDialog = this.shadowRoot.querySelector('.camera-card__expanded[role="dialog"]');
    if (expandedDialog instanceof HTMLElement) {
      window.NodaliaUtils?.bindModalFocus?.(this, expandedDialog, {
        initialFocusSelector: ".camera-card__expanded-close",
        restoreFocus: () => {
          const restore = this._expandedReturnFocus;
          this._expandedReturnFocus = null;
          restore?.();
        },
      });
    } else {
      window.NodaliaUtils?.releaseModalFocus?.(this);
    }

    if (shouldAnimateEntrance) {
      this._animateContentOnNextRender = false;
      window.NodaliaUtils?.scheduleDeferTimer?.(this, () => {}, animations.contentDuration + 80);
    }
    this._schedulePreviewAgeRefresh();
  }
}


if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCameraCard);
}

class NodaliaCameraCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showTapActionsSection = false;
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
  }

  _attachEditorShadowListeners() {
    window.NodaliaUtils.bindShadowListeners(this, [
      ["input", this._onShadowInput],
      ["change", this._onShadowInput],
      ["value-changed", this._onShadowValueChanged],
      ["click", this._onShadowClick],
    ], "editor");
  }

  _detachEditorShadowListeners() {
    window.NodaliaUtils.releaseShadowListeners(this, "editor");
  }

  connectedCallback() {
    this._attachEditorShadowListeners();
    window.NodaliaUtils?.bindEditorDialogLayoutFix?.(this);
  }

  disconnectedCallback() {
    this._detachEditorShadowListeners();
    window.NodaliaUtils?.releaseEditorDialogLayoutFix?.(this);
  }

  set hass(hass) {
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender = !this._hass || nextSignature !== this._entityOptionsSignature || !this.shadowRoot?.innerHTML;
    this._hass = hass;
    this._entityOptionsSignature = nextSignature;
    if (!shouldRender) {
      return;
    }
    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = mergeConfig(DEFAULT_CONFIG, config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._render();
    this._restoreFocusState(focusState);
  }

  _editorLabel(key) {
    return window.NodaliaI18n?.editorStr?.(this._hass, this._config?.language ?? "auto", key) || key;
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(
      hass,
      this._config?.language,
      id => /^(camera|light|fan|humidifier|vacuum|cover|climate|lock|switch|input_boolean)\./.test(id),
    );
  }

  _captureFocusState() {
    return window.NodaliaUtils.captureEditorFocusState(this);
  }

  _restoreFocusState(focusState) {
    window.NodaliaUtils.restoreEditorFocusState(this, focusState);
  }

  _emitConfig(reRender = false) {
    const normalized = normalizeConfig(this._config);
    normalized.camera_streams = compactCameraStreams(normalized.camera_streams);
    normalized.camera_tap_actions = compactCameraTapActions(
      normalized.camera_tap_actions,
      normalized,
    );
    const outgoing = stripEqualToDefaults(normalized);
    fireEvent(this, "config-changed", {
      config: outgoing,
    });
    if (reRender) {
      this._render();
    }
  }

  _editorCameras() {
    if (Array.isArray(this._config?.cameras) && this._config.cameras.length) {
      return this._config.cameras.map(normalizeCameraEntityId);
    }
    const entity = String(this._config?.entity ?? "").trim();
    return entity ? [entity] : [];
  }

  _syncEditorCameraStreams() {
    const cameras = this._editorCameras().filter(Boolean).slice(0, MAX_CAMERAS);
    const existing = Array.isArray(this._config?.camera_streams) ? this._config.camera_streams : [];
    this._config.camera_streams = cameras.map(camera => {
      const configured = existing.find(item => item?.camera === camera);
      return {
        provider: "home_assistant",
        client_id: "frigate",
        base_url: "",
        stream: cameraStreamName(camera),
        mode: "auto",
        url: "",
        muted: true,
        controls: false,
        ...(isObject(configured) ? configured : {}),
        camera,
      };
    });
  }

  _syncEditorCameraTapActions() {
    const cameras = this._editorCameras().filter(Boolean).slice(0, MAX_CAMERAS);
    const existing = Array.isArray(this._config?.camera_tap_actions) ? this._config.camera_tap_actions : [];
    const legacy = {
      tap_action: this._config?.tap_action || "toggle",
      tap_service: this._config?.tap_service || "",
      tap_service_data: this._config?.tap_service_data || "",
      tap_service_target: this._config?.tap_service_target || "",
      tap_url: this._config?.tap_url || "",
      navigation_path: this._config?.navigation_path || "",
      tap_new_tab: this._config?.tap_new_tab === true,
    };
    this._config.camera_tap_actions = cameras.map(camera => {
      const configured = existing.find(item => normalizeCameraEntityId(item?.camera) === camera);
      const source = isObject(configured) ? { camera, ...configured } : { camera, ...legacy };
      return normalizeCameraTapActions([source], [camera])[0];
    }).filter(Boolean);
  }

  _migrateCameraReferences(previousCamera, nextCamera) {
    const previous = String(previousCamera || "").trim();
    const next = String(nextCamera || "").trim();
    if (!previous || previous === next) {
      return;
    }
    if (Array.isArray(this._config.camera_actions)) {
      this._config.camera_actions.forEach(action => {
        if (action?.camera === previous) {
          action.camera = next;
        }
      });
    }
    if (Array.isArray(this._config.camera_tap_actions)) {
      this._config.camera_tap_actions.forEach(action => {
        if (action?.camera === previous) {
          action.camera = next;
        }
      });
    }
    if (Array.isArray(this._config.camera_streams)) {
      this._config.camera_streams.forEach(stream => {
        if (stream?.camera !== previous) {
          return;
        }
        stream.camera = next;
        if (!stream.stream || stream.stream === cameraStreamName(previous)) {
          stream.stream = cameraStreamName(next);
        }
      });
    }
  }

  _onShadowInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.dataset?.field) {
      return;
    }
    const field = target.dataset.field;
    const cameraField = field.match(/^cameras\.(\d+)$/);
    const previousCamera = cameraField
      ? String(getByPath(this._config, field) || "").trim()
      : field === "entity" ? String(this._config.entity || "").trim() : "";
    const value = target instanceof HTMLInputElement && target.type === "checkbox"
      ? target.checked
      : target.value;
    setByPath(this._config, field, value);
    if (cameraField || field === "entity") {
      this._migrateCameraReferences(previousCamera, value);
    }
    if (field === "entity" && value) {
      if (!Array.isArray(this._config.cameras) || !this._config.cameras.length) {
        this._config.cameras = [value];
      } else {
        this._config.cameras[0] = value;
      }
    } else if (cameraField?.[1] === "0") {
      this._config.entity = String(value || "").trim();
    }
    this._emitConfig(
      field === "tap_action"
      || field === "hold_action"
      || field.includes("tap_action")
      || field.endsWith(".provider")
      || Boolean(cameraField)
      || field === "entity",
    );
  }

  _onShadowValueChanged(event) {
    const host = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.field);
    if (!host?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    const detailValue = event.detail?.value ?? "";
    const field = host.dataset.field;
    const cameraField = field.match(/^cameras\.(\d+)$/);
    const previousCamera = cameraField
      ? String(getByPath(this._config, field) || "").trim()
      : field === "entity" ? String(this._config.entity || "").trim() : "";
    const nextValue = String(detailValue || "").trim();
    setByPath(this._config, field, nextValue);
    if (cameraField || field === "entity") {
      this._migrateCameraReferences(previousCamera, nextValue);
    }
    if (field === "entity" && detailValue) {
      if (!Array.isArray(this._config.cameras) || !this._config.cameras.length) {
        this._config.cameras = [detailValue];
      } else {
        this._config.cameras[0] = detailValue;
      }
    } else if (cameraField?.[1] === "0") {
      this._config.entity = nextValue;
    }
    this._emitConfig(Boolean(cameraField) || field === "entity");
  }

  _onShadowClick(event) {
    const button = event.composedPath().find(node => node instanceof HTMLButtonElement && node.dataset?.editorAction);
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.editorAction;
      const index = Number(button.dataset.index);
      if (action === "add-camera") {
        if (!Array.isArray(this._config.cameras)) {
          this._config.cameras = this._editorCameras();
        }
        if (this._config.cameras.length < MAX_CAMERAS) {
          this._config.cameras.push("");
          this._render();
        }
        return;
      }
      if (action === "remove-camera" && Number.isInteger(index)) {
        if (!Array.isArray(this._config.cameras)) {
          this._config.cameras = this._editorCameras();
        }
        const removedCamera = String(this._config.cameras[index] || "").trim();
        this._config.cameras.splice(index, 1);
        if (removedCamera && Array.isArray(this._config.camera_actions)) {
          this._config.camera_actions = this._config.camera_actions.filter(item => item?.camera !== removedCamera);
        }
        if (removedCamera && Array.isArray(this._config.camera_tap_actions)) {
          this._config.camera_tap_actions = this._config.camera_tap_actions.filter(item => item?.camera !== removedCamera);
        }
        if (removedCamera && Array.isArray(this._config.camera_streams)) {
          this._config.camera_streams = this._config.camera_streams.filter(item => item?.camera !== removedCamera);
        }
        this._config.entity = this._config.cameras[0] || "";
        this._emitConfig(true);
        return;
      }
      if (action === "add-camera-action") {
        const cameraId = String(button.dataset.camera || "").trim();
        if (!cameraId) {
          return;
        }
        if (!Array.isArray(this._config.camera_actions)) {
          this._config.camera_actions = [];
        }
        if (this._config.camera_actions.filter(item => item?.camera === cameraId).length < 8) {
          this._config.camera_actions.push({
            camera: cameraId,
            entity: "",
            name: "",
            icon: "",
            tap_action: "toggle",
          });
          this._render();
        }
        return;
      }
      if (action === "remove-camera-action" && Number.isInteger(index)) {
        if (!Array.isArray(this._config.camera_actions)) {
          this._config.camera_actions = [];
        }
        this._config.camera_actions.splice(index, 1);
        this._emitConfig(true);
        return;
      }
      if (action === "add-expanded-action") {
        if (!Array.isArray(this._config.expanded_actions)) {
          this._config.expanded_actions = [];
        }
        this._config.expanded_actions.push({
          entity: "",
          name: "",
          icon: "",
          tap_action: "toggle",
        });
        this._render();
        return;
      }
      if (action === "remove-expanded-action" && Number.isInteger(index)) {
        if (!Array.isArray(this._config.expanded_actions)) {
          this._config.expanded_actions = [];
        }
        this._config.expanded_actions.splice(index, 1);
        this._emitConfig(true);
      }
      return;
    }

    const toggleButton = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.editorToggle);
    if (!toggleButton) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (toggleButton.dataset.editorToggle === "tap_actions") {
      this._showTapActionsSection = !this._showTapActionsSection;
      this._render();
    }
  }

  _renderTextareaField(label, field, value, options = {}) {
    const textValue = isObject(value) ? JSON.stringify(value, null, 2) : value ?? "";
    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(this._editorLabel(label))}</span>
        <textarea data-field="${escapeHtml(field)}">${escapeHtml(textValue)}</textarea>
      </label>
    `;
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input data-field="${escapeHtml(field)}" value="${escapeHtml(value ?? "")}" placeholder="${escapeHtml(options.placeholder || "")}" />
      </label>
    `;
  }

  _renderSelectField(label, field, value, options) {
    return `
      <label class="editor-field">
        <span>${escapeHtml(this._editorLabel(label))}</span>
        <select data-field="${escapeHtml(field)}">
          ${(options || []).map(option => `
            <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
              ${escapeHtml(this._editorLabel(option.label))}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    return `
      <label class="editor-toggle">
        <input type="checkbox" data-field="${escapeHtml(field)}" ${checked ? "checked" : ""} />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(this._editorLabel(label))}</span>
      </label>
    `;
  }

  _renderCameraEntityField(label, field, value, domains = "camera") {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-control-host" data-mounted-control="camera-entity" data-field="${escapeHtml(field)}" data-domains="${escapeHtml(domains)}" data-value="${escapeHtml(value || "")}"></div>
      </label>
    `;
  }

  _renderIconField(label, field, value) {
    return `
      <label class="editor-field">
        <span>${escapeHtml(this._editorLabel(label))}</span>
        <div
          class="editor-control-host"
          data-mounted-control="camera-icon"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(value || "")}"
        ></div>
      </label>
    `;
  }

  _mountCameraEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }
    if (host.querySelector("ha-entity-picker")) {
      return;
    }
    const field = host.dataset.field || "entity";
    const value = getByPath(this._config, field) || "";
    const domains = String(host.dataset.domains || "camera").split(",").filter(Boolean);
    const picker = document.createElement("ha-entity-picker");
    picker.dataset.field = field;
    picker.hass = this._hass;
    picker.value = value;
    picker.includeDomains = domains.length ? domains : ["camera"];
    picker.allowCustomEntity = true;
    host.replaceChildren(picker);
  }

  _mountIconPicker(host) {
    if (!(host instanceof HTMLElement) || host.querySelector("ha-icon-picker")) {
      return;
    }
    const picker = document.createElement("ha-icon-picker");
    picker.dataset.field = host.dataset.field || "icon";
    picker.hass = this._hass;
    picker.value = host.dataset.value || "";
    host.replaceChildren(picker);
  }

  _renderCameraListSection(config) {
    const cameras = this._editorCameras();
    const rows = cameras.length ? cameras : [String(config.entity || "")];
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div>
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.camera.cameras_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.cameras_section_hint"))}</div>
          </div>
          <button type="button" data-editor-action="add-camera" ${rows.length >= MAX_CAMERAS ? "disabled" : ""}>
            ${escapeHtml(this._editorLabel("ed.camera.add_camera"))}
          </button>
        </div>
        <div class="editor-list">
          ${rows.map((cameraId, index) => `
            <div class="editor-card">
              <div class="editor-card__header">
                <span>${escapeHtml(this._editorLabel("ed.camera.camera_item"))} ${index + 1}</span>
                <button type="button" class="danger" data-editor-action="remove-camera" data-index="${index}">
                  ${escapeHtml(this._editorLabel("ed.camera.remove_camera"))}
                </button>
              </div>
              ${this._renderCameraEntityField("ed.camera.select_entity", `cameras.${index}`, cameraId)}
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  _renderExpandedActionsSection(config) {
    const cameras = this._editorCameras().filter(Boolean);
    const cameraActions = Array.isArray(config.camera_actions) ? config.camera_actions : [];
    const legacyActions = Array.isArray(config.expanded_actions) ? config.expanded_actions : [];
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div>
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.camera.expanded_actions_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.expanded_actions_section_hint"))}</div>
          </div>
        </div>
        <div class="editor-list">
          ${cameras.length ? cameras.map((cameraId, cameraIndex) => {
    const actions = cameraActions
      .map((action, sourceIndex) => ({ action, sourceIndex }))
      .filter(item => item.action?.camera === cameraId);
    const legacy = cameraIndex === 0 && !actions.length
      ? legacyActions.map((action, sourceIndex) => ({ action, sourceIndex, legacy: true }))
      : [];
    const rows = actions.length ? actions : legacy;
    const cameraName = this._hass?.states?.[cameraId]?.attributes?.friendly_name || cameraId;
    return `
            <div class="editor-camera-group">
              <div class="editor-card__header">
                <strong>${escapeHtml(cameraName)}</strong>
                <button type="button" data-editor-action="add-camera-action" data-camera="${escapeHtml(cameraId)}" ${actions.length >= 8 ? "disabled" : ""}>
                  ${escapeHtml(this._editorLabel("ed.camera.add_expanded_action"))}
                </button>
              </div>
              ${rows.length ? rows.map(({ action, sourceIndex, legacy }) => {
    const prefix = legacy ? `expanded_actions.${sourceIndex}` : `camera_actions.${sourceIndex}`;
    const removeAction = legacy ? "remove-expanded-action" : "remove-camera-action";
    return `
              <div class="editor-card">
                <div class="editor-card__header">
                  <span>${escapeHtml(this._editorLabel("ed.camera.expanded_action_item"))} ${sourceIndex + 1}</span>
                  <button type="button" class="danger" data-editor-action="${removeAction}" data-index="${sourceIndex}">
                    ${escapeHtml(this._editorLabel("ed.camera.remove_expanded_action"))}
                  </button>
                </div>
                <div class="editor-grid editor-grid--stacked">
                  ${this._renderCameraEntityField("ed.camera.expanded_action_entity", `${prefix}.entity`, action.entity, "light,fan,humidifier,vacuum,cover,climate,lock,switch,input_boolean")}
                  ${this._renderTextField("ed.camera.expanded_action_name", `${prefix}.name`, action.name, { fullWidth: true })}
                  ${this._renderIconField("ed.camera.expanded_action_icon", `${prefix}.icon`, action.icon)}
                  ${this._renderTextField("ed.notifications.icon_color", `${prefix}.icon_color`, action.icon_color, { placeholder: "var(--primary-color)" })}
                  ${this._renderSelectField("ed.camera.expanded_action_tap", `${prefix}.tap_action`, action.tap_action || "toggle", [
    { value: "toggle", label: "ed.entity.tap_toggle" },
    { value: "more-info", label: "ed.entity.tap_more_info" },
    { value: "service", label: "ed.entity.tap_service" },
  ])}
                  ${String(action.tap_action) === "service"
    ? this._renderTextField("ed.entity.tap_service_field", `${prefix}.tap_service`, action.tap_service, { placeholder: "lock.open", fullWidth: true })
      + this._renderTextareaField("ed.entity.tap_service_data_json", `${prefix}.tap_service_data`, action.tap_service_data, { placeholder: "{}" })
    : ""}
                </div>
              </div>
              `;
  }).join("") : `<div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.expanded_actions_empty"))}</div>`}
            </div>
          `;
  }).join("") : `<div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.expanded_actions_empty"))}</div>`}
        </div>
      </section>
    `;
  }

  _renderCameraTapActionsSection(config) {
    const cameras = this._editorCameras().filter(Boolean);
    const actions = Array.isArray(config.camera_tap_actions) ? config.camera_tap_actions : [];
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div>
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.camera.tap_actions_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.tap_actions_section_hint"))}</div>
          </div>
        </div>
        <div class="editor-list">
          ${cameras.map((cameraId, index) => {
    const action = actions.find(item => item?.camera === cameraId) || { camera: cameraId, tap_action: "toggle" };
    const tapAction = String(action.tap_action || "toggle") === "auto"
      ? "more-info"
      : String(action.tap_action || "toggle");
    const cameraName = this._hass?.states?.[cameraId]?.attributes?.friendly_name || cameraId;
    const prefix = `camera_tap_actions.${index}`;
    return `
            <div class="editor-camera-group">
              <div class="editor-card__header"><strong>${escapeHtml(cameraName)}</strong></div>
              <div class="editor-grid editor-grid--stacked">
                ${this._renderSelectField("ed.camera.tap_action", `${prefix}.tap_action`, tapAction, [
    { value: "toggle", label: "ed.camera.tap_open_live" },
    { value: "more-info", label: "ed.entity.tap_more_info" },
    { value: "navigate", label: "ed.entity.tap_navigate" },
    { value: "url", label: "ed.entity.tap_open_url" },
    { value: "service", label: "ed.entity.tap_service" },
    { value: "none", label: "ed.entity.tap_none" },
  ])}
                ${tapAction === "service"
    ? this._renderTextField("ed.entity.tap_service_field", `${prefix}.tap_service`, action.tap_service, { placeholder: "camera.turn_on", fullWidth: true })
      + this._renderTextareaField("ed.entity.tap_service_data_json", `${prefix}.tap_service_data`, action.tap_service_data, { placeholder: `{\"entity_id\":\"${cameraId}\"}` })
    : ""}
                ${tapAction === "url"
    ? this._renderTextField("ed.entity.tap_url_field", `${prefix}.tap_url`, action.tap_url, { placeholder: "https://example.com", fullWidth: true })
      + this._renderCheckboxField("ed.entity.tap_new_tab", `${prefix}.tap_new_tab`, action.tap_new_tab === true)
    : ""}
                ${tapAction === "navigate"
    ? this._renderTextField("ed.entity.navigation_path", `${prefix}.navigation_path`, action.navigation_path, { placeholder: "/lovelace/cameras", fullWidth: true })
    : ""}
              </div>
            </div>
          `;
  }).join("")}
        </div>
      </section>
    `;
  }

  _renderCameraStreamsSection(config) {
    const cameras = this._editorCameras().filter(Boolean);
    const streams = Array.isArray(config.camera_streams) ? config.camera_streams : [];
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div>
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.camera.live_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.live_section_hint"))}</div>
          </div>
        </div>
        <div class="editor-list">
          ${cameras.map((cameraId, index) => {
    const stream = streams[index] || {};
    const provider = stream.provider || "home_assistant";
    const cameraName = this._hass?.states?.[cameraId]?.attributes?.friendly_name || cameraId;
    const prefix = `camera_streams.${index}`;
    return `
            <div class="editor-camera-group">
              <div class="editor-card__header"><strong>${escapeHtml(cameraName)}</strong></div>
              <div class="editor-grid editor-grid--stacked">
                ${this._renderSelectField("ed.camera.live_provider", `${prefix}.provider`, provider, [
    { value: "home_assistant", label: "ed.camera.live_provider_home_assistant" },
    { value: "frigate_go2rtc", label: "ed.camera.live_provider_frigate_go2rtc" },
    { value: "go2rtc", label: "ed.camera.live_provider_go2rtc" },
    { value: "iframe", label: "ed.camera.live_provider_iframe" },
  ])}
                ${provider === "home_assistant" ? `
                  ${this._renderCheckboxField("ed.camera.live_muted", `${prefix}.muted`, stream.muted !== false)}
                  ${this._renderCheckboxField("ed.camera.live_controls", `${prefix}.controls`, stream.controls === true)}
                ` : ""}
                ${provider === "frigate_go2rtc" ? `
                  ${this._renderTextField("ed.camera.live_stream_name", `${prefix}.stream`, stream.stream || cameraStreamName(cameraId), { placeholder: cameraStreamName(cameraId), fullWidth: true })}
                  ${this._renderTextField("ed.camera.live_frigate_client_id", `${prefix}.client_id`, stream.client_id || "frigate", { placeholder: "frigate", fullWidth: true })}
                  ${this._renderSelectField("ed.camera.live_mode", `${prefix}.mode`, stream.mode || "auto", [
    { value: "auto", label: "ed.camera.live_mode_auto" },
    { value: "webrtc", label: "ed.camera.live_mode_webrtc" },
    { value: "mse", label: "ed.camera.live_mode_mse" },
    { value: "hls", label: "ed.camera.live_mode_hls" },
    { value: "mjpeg", label: "ed.camera.live_mode_mjpeg" },
  ])}
                  ${this._renderCheckboxField("ed.camera.live_muted", `${prefix}.muted`, stream.muted !== false)}
                  ${this._renderCheckboxField("ed.camera.live_controls", `${prefix}.controls`, stream.controls === true)}
                ` : ""}
                ${provider === "go2rtc" ? `
                  ${this._renderTextField("ed.camera.live_base_url", `${prefix}.base_url`, stream.base_url, { placeholder: "http://frigate.local:1984", fullWidth: true })}
                  ${this._renderTextField("ed.camera.live_stream_name", `${prefix}.stream`, stream.stream || cameraStreamName(cameraId), { placeholder: cameraStreamName(cameraId), fullWidth: true })}
                  ${this._renderSelectField("ed.camera.live_mode", `${prefix}.mode`, stream.mode || "auto", [
    { value: "auto", label: "ed.camera.live_mode_auto" },
    { value: "webrtc", label: "ed.camera.live_mode_webrtc" },
    { value: "mse", label: "ed.camera.live_mode_mse" },
    { value: "hls", label: "ed.camera.live_mode_hls" },
    { value: "mjpeg", label: "ed.camera.live_mode_mjpeg" },
  ])}
                  ${this._renderCheckboxField("ed.camera.live_muted", `${prefix}.muted`, stream.muted !== false)}
                  ${this._renderCheckboxField("ed.camera.live_controls", `${prefix}.controls`, stream.controls === true)}
                ` : ""}
                ${provider === "iframe"
    ? this._renderTextField("ed.camera.live_url", `${prefix}.url`, stream.url, { placeholder: "https://camera.example/player", fullWidth: true })
    : ""}
              </div>
            </div>
          `;
  }).join("")}
        </div>
      </section>
    `;
  }

  _render() {
    this._syncEditorCameraStreams();
    this._syncEditorCameraTapActions();
    const config = this._config || mergeConfig(DEFAULT_CONFIG, {});

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        * { box-sizing: border-box; }
        .editor { color: var(--primary-text-color); display: grid; gap: 16px; }
        .editor-section {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 18px;
          display: grid;
          gap: 14px;
          padding: 16px;
        }
        .editor-section:last-child { margin-bottom: 0; }
        .editor-section__header { align-items: start; display: flex; gap: 12px; justify-content: space-between; }
        .editor-section__title { font-size: 15px; font-weight: 700; }
        .editor-section__hint { color: var(--secondary-text-color); font-size: 12px; line-height: 1.45; }
        .editor-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .editor-grid--stacked, .editor-field--full { grid-column: 1 / -1; }
        .editor-field, .editor-toggle { display: grid; gap: 6px; min-width: 0; }
        .editor-field > span, .editor-toggle > span:not(.editor-toggle__switch) {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 600;
        }
        .editor-field input, .editor-field select, .editor-field textarea {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 40px;
          padding: 10px 12px;
          width: 100%;
        }
        .editor-field textarea { min-height: 76px; resize: vertical; }
        .editor-control-host, .editor-control-host > * { display: block; width: 100%; }
        .editor-toggle {
          align-items: center;
          column-gap: 10px;
          cursor: pointer;
          grid-template-columns: auto minmax(0, 1fr);
          min-height: 40px;
          position: relative;
        }
        .editor-toggle input {
          block-size: 1px;
          inline-size: 1px;
          margin: 0;
          opacity: 0;
          pointer-events: none;
          position: absolute;
        }
        .editor-toggle__switch {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          display: inline-flex;
          height: 22px;
          position: relative;
          transition: background 160ms ease, border-color 160ms ease;
          width: 40px;
        }
        .editor-toggle__switch::before {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 999px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.24);
          content: "";
          height: 18px;
          left: 1px;
          position: absolute;
          top: 1px;
          transition: transform 160ms ease;
          width: 18px;
        }
        .editor-toggle input:checked + .editor-toggle__switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }
        .editor-toggle input:checked + .editor-toggle__switch::before {
          transform: translateX(18px);
        }
        .editor-section__actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .editor-section__header button,
        .editor-card__header button {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          min-height: 34px;
          padding: 0 12px;
        }
        .editor-section__header button.danger,
        .editor-card__header button.danger { color: var(--error-color); }
        .editor-section__header button:disabled { cursor: default; opacity: 0.45; }
        .editor-list { display: grid; gap: 12px; }
        .editor-camera-group { display: grid; gap: 10px; padding-block: 4px 12px; }
        .editor-camera-group + .editor-camera-group { border-top: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); padding-top: 16px; }
        .editor-card {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 14px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }
        .editor-card__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }
        @media (max-width: 640px) { .editor-grid { grid-template-columns: 1fr; } }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div>
              <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.camera.general_section_title"))}</div>
              <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.general_section_hint"))}</div>
            </div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderCameraEntityField("ed.camera.select_entity", "entity", config.entity)}
            ${this._renderTextField("ed.camera.name_placeholder", "name", config.name, { placeholder: "Entrada", fullWidth: true })}
            ${this._renderCheckboxField("ed.camera.show_name", "show_name", config.show_name !== false)}
            ${this._renderCheckboxField("ed.camera.show_state", "show_state", config.show_state !== false)}
            ${this._renderCheckboxField("ed.camera.show_status_chips", "show_status_chips", config.show_status_chips !== false)}
            ${this._renderCheckboxField("ed.camera.show_last_changed", "show_last_changed", config.show_last_changed !== false)}
            ${this._renderCheckboxField("ed.camera.show_preview_age", "show_preview_age", config.show_preview_age !== false)}
          </div>
        </section>
        ${this._renderCameraListSection(config)}
        ${this._renderCameraTapActionsSection(config)}
        ${this._renderCameraStreamsSection(config)}
        ${this._renderExpandedActionsSection(config)}
      </div>
    `;

    this.shadowRoot.querySelectorAll('[data-mounted-control="camera-entity"]').forEach(node => {
      this._mountCameraEntityPicker(node);
    });
    this.shadowRoot.querySelectorAll('[data-mounted-control="camera-icon"]').forEach(node => {
      this._mountIconPicker(node);
    });
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCameraCardEditor);
}

(function registerNodaliaCameraCardPicker() {
  const hass = window.NodaliaI18n?.resolveHass?.(null);
  const lang = window.NodaliaI18n?.resolveLanguage?.(hass, "auto") ?? "en";
  const pack = window.NodaliaI18n?.strings?.(lang)?.cameraCard
    || window.NodaliaI18n?.strings?.("en")?.cameraCard
    || {};
  const description = String(pack.cardDescription || "Nodalia-style camera preview with status chips and expanded view.");
  window.NodaliaUtils.registerCustomCard({
    type: CARD_TAG,
    name: "Nodalia Camera Card",
    description,
    preview: true,
  });
})();

if (typeof globalThis !== "undefined") {
  globalThis.__NODALIA_CAMERA__ = {
    normalizeConfig,
    normalizeCameras,
    normalizeExpandedActions,
    normalizeCameraActions,
    normalizeCameraStreams,
    compactCameraStreams,
    buildGo2rtcViewerUrl,
    buildGo2rtcWebSocketEndpoint,
    buildFrigateGo2rtcPath,
    signHomeAssistantPath,
    resolveGo2rtcPlayerSource,
    isMixedContentUrl,
    formatRelativeAge,
    DEFAULT_CONFIG,
    CAMERA_LAYOUT,
    CAMERA_PRESENTATION,
    MAX_CAMERAS,
  };
}
