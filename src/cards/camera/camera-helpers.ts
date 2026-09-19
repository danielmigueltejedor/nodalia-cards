// @ts-nocheck -- camera stream, proxy and config helpers stay loosely typed until remaining unknowns are narrowed.
import {
  HOLD_ACTIONS,
  MAX_CAMERAS,
  STREAM_MODES,
  STREAM_PROVIDERS,
  TAP_ACTIONS,
} from "./camera-constants";
import {
  buildFrigateGo2rtcPath,
  buildGo2rtcWebSocketEndpoint,
  deepClone,
  isMixedContentUrl,
  isObject,
} from "./camera-runtime";
import { DEFAULT_CONFIG } from "./camera-config";

export function getStubEntityId(hass, domains = [], entities = [], entitiesFallback = []) {
  return window.NodaliaUtils.findStubEntityIds(hass, entities, entitiesFallback, domains, 1)[0] || "";
}

export function applyStubEntity(config, hass, domains, entities = [], entitiesFallback = []) {
  const entityId = getStubEntityId(hass, domains, entities, entitiesFallback);
  if (!entityId) {
    return config;
  }
  config.entity = entityId;
  config.name = hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
  return config;
}

export function mergeConfig(base, override) {
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


export function setByPath(target, path, value) {
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


export function normalizeTextKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function isUnavailableState(state) {
  const key = normalizeTextKey(state?.state);
  return key === "unavailable" || key === "unknown";
}

export function appendQueryParam(url, key, value) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl || value === undefined || value === null || value === "") {
    return safeUrl;
  }
  const separator = safeUrl.includes("?") ? "&" : "?";
  return `${safeUrl}${separator}${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
}

export function isUsableCameraAccessToken(token) {
  const value = String(token ?? "").trim();
  return Boolean(value) && value !== "undefined" && value !== "null";
}

export function parseCameraProxyAuth(url) {
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

export function formatRelativeAge(timestamp, locale = "en", now = Date.now()) {
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

export function parseServiceData(rawValue) {
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

export function fireEvent(node, type, detail, options) {
  node.dispatchEvent(new CustomEvent(type, {
    bubbles: options?.bubbles !== false,
    composed: options?.composed !== false,
    cancelable: options?.cancelable === true,
    detail,
  }));
}

export function stripEqualToDefaults(config, defaults = DEFAULT_CONFIG) {
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

export function normalizeCameraEntityId(value) {
  if (isObject(value)) {
    return String(value.entity ?? value.entity_id ?? "").trim();
  }
  return String(value ?? "").trim();
}

export function normalizeCameras(config = {}) {
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

export function normalizeExpandedActions(rawActions = []) {
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

export function normalizeCameraActions(rawActions = [], cameraIds = []) {
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

export function normalizeCameraTapActions(rawActions = [], cameraIds = []) {
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

export function compactCameraTapAction(rawAction = {}, fallbackAction = "toggle") {
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

export function compactCameraTapActions(rawActions = [], globalTapConfig = "toggle") {
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

export function cameraStreamName(entityId) {
  return String(entityId || "").trim().replace(/^camera\./, "");
}

export function normalizeCameraStreams(rawStreams = [], cameraIds = []) {
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

export function compactCameraStreams(rawStreams = []) {
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

export const SIGNED_PATH_CACHE = new WeakMap();

export function signedPathCacheForHass(hass) {
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

export async function signHomeAssistantPath(hass, path, expires = 24 * 60 * 60) {
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

export async function resolveGo2rtcPlayerSource(hass, streamConfig) {
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
