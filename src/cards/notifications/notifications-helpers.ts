// @ts-nocheck -- notification template, forecast and editor color helpers stay loosely typed until remaining unknowns are narrowed.
import { CARD_TAG, CARD_VERSION, LEGACY_BACKGROUND_MOBILE_TOGGLE } from "./notifications-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./notifications-config";
import {
  BACKGROUND_MOBILE_MAX_CHUNKS,
  clamp,
  deepClone,
  isExplicitSmartEntityMobile,
  isObject,
  isUnsafeConfigPathKey,
  isWithinQuietHours,
  normalizeMobileContext,
  normalizeMobilePolicy,
  normalizeQuietHours,
  normalizeSmartEntityMobile,
  normalizeSmartEntityOverrideMobile,
} from "./notifications-runtime";

export function mergeDeep(base, override) {
  const out = deepClone(base);
  if (!isObject(override)) {
    return out;
  }
  Object.entries(override).forEach(([key, value]) => {
    if (isUnsafeConfigPathKey(key)) {
      return;
    }
    if (isObject(value) && isObject(out[key])) {
      out[key] = mergeDeep(out[key], value);
    } else if (value !== undefined) {
      out[key] = deepClone(value);
    }
  });
  return out;
}

export function compactConfig(value) {
  if (Array.isArray(value)) {
    const rows = value
      .map(item => compactConfig(item))
      .filter(item => {
        if (item === undefined || item === null || item === "") {
          return false;
        }
        return !(isObject(item) && !Object.keys(item).length);
      });
    return rows.length ? rows : undefined;
  }
  if (isObject(value)) {
    const out = {};
    Object.entries(value).forEach(([key, child]) => {
      if (isUnsafeConfigPathKey(key)) {
        return;
      }
      const next = compactConfig(child);
      if (next !== undefined && next !== "") {
        out[key] = next;
      }
    });
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

export function entityDomain(entityId) {
  const raw = String(entityId || "").trim();
  const dot = raw.indexOf(".");
  return dot > 0 ? raw.slice(0, dot) : "";
}

export function normalizeEntityList(value, domains = []) {
  const allowed = new Set(domains);
  const rows = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[\n,]/)
        .map(item => item.trim());
  const seen = new Set();
  return rows
    .map(item => {
      if (isObject(item)) {
        return String(item.entity || item.entity_id || "").trim();
      }
      return String(item || "").trim();
    })
    .filter(entityId => {
      if (!entityId || seen.has(entityId)) {
        return false;
      }
      if (allowed.size && !allowed.has(entityDomain(entityId))) {
        return false;
      }
      seen.add(entityId);
      return true;
    });
}

export function normalizeStringList(value) {
  const rows = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[\n,]/)
        .map(item => item.trim());
  const seen = new Set();
  return rows
    .map(item => String(item || "").trim().toLowerCase())
    .filter(item => {
      if (!item || seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
}

export function normalizeNotifyServices(value) {
  return normalizeStringList(value)
    .map(item => (item.includes(".") ? item : `notify.${item}`))
    .filter(item => item.startsWith("notify.") && item.length > "notify.".length);
}

export function normalizeBoolean(value) {
  if (value === true || value === false) {
    return value;
  }
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "on", "yes", "1"].includes(normalized)) {
    return true;
  }
  if (["false", "off", "no", "0"].includes(normalized)) {
    return false;
  }
  return false;
}

export function normalizeNotificationTapAction(value) {
  const row = isObject(value) ? value : {};
  let action = String(row.action || "none").trim().toLowerCase().replaceAll("_", "-");
  if (action === "more-info-dialog") {
    action = "more-info";
  }
  if (action === "open-url") {
    action = "url";
  }
  const allowed = new Set(["none", "more-info", "navigate", "url", "toggle"]);
  if (!allowed.has(action)) {
    action = "none";
  }
  const out = { action };
  const entity = String(row.entity || row.entity_id || "").trim();
  const navigationPath = String(row.navigation_path || row.path || "").trim();
  const urlPath = String(row.url_path || row.url || "").trim();
  if ((action === "more-info" || action === "toggle") && entity) {
    out.entity = entity;
  }
  if (action === "navigate" && navigationPath) {
    out.navigation_path = navigationPath;
  }
  if (action === "url" && urlPath) {
    out.url_path = urlPath;
  }
  if (action === "url" && row.new_tab !== undefined) {
    out.new_tab = normalizeBoolean(row.new_tab);
  }
  return out;
}

export function hasNotificationTapAction(value) {
  const action = normalizeNotificationTapAction(value);
  switch (action.action) {
    case "more-info":
    case "toggle":
      return true;
    case "navigate":
      return Boolean(action.navigation_path);
    case "url":
      return Boolean(action.url_path);
    default:
      return false;
  }
}

export function normalizeSmartNotificationOptions(value) {
  const row = isObject(value) ? value : {};
  return {
    title: String(row.title || "").trim(),
    message: String(row.message || "").trim(),
    tint_color: String(row.tint_color || "").trim(),
    url: String(row.url || "").trim(),
    action_label: String(row.action_label || "").trim(),
    tap_action: normalizeNotificationTapAction(row.tap_action),
    mobile: normalizeSmartEntityMobile(row.mobile ?? row.mobile_notifications ?? row.mobile_enabled),
  };
}

export function normalizeExternalAlerts(value, options = {}) {
  const rows = Array.isArray(value) ? value : [];
  const keepDrafts = options.keepDrafts === true;
  const seen = new Set();
  return rows
    .map(item => {
      const row = isObject(item) ? item : {};
      const id = String(row.id || "").trim();
      const type = String(row.type || "external_alert").trim().toLowerCase() || "external_alert";
      const mobileRaw = row.mobile ?? row.mobile_notifications ?? row.mobile_enabled;
      const normalized = {
        id,
        type,
        title: String(row.title || "").trim(),
        message: String(row.message || "").trim(),
        severity: normalizeSeverity(row.severity || "info"),
        entity: String(row.entity || "").trim(),
        source: String(row.source || "").trim(),
        icon: String(row.icon || "").trim(),
        tint_color: String(row.tint_color || "").trim(),
        mobile: normalizeMobilePolicy(mobileRaw),
        tap_action: normalizeNotificationTapAction(row.tap_action),
        url: String(row.url || "").trim(),
        action_label: String(row.action_label || "").trim(),
      };
      if (keepDrafts && row._draft === true) {
        normalized._draft = true;
      }
      return normalized;
    })
    .filter(item => {
      if (keepDrafts && item._draft === true) {
        return true;
      }
      if (!item.id || !item.title || seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
}
export function normalizeSmartEntityOverrides(value) {
  const rows = Array.isArray(value)
    ? value
    : isObject(value)
      ? Object.entries(value).map(([entity, row]) => ({ ...(isObject(row) ? row : {}), entity }))
      : [];
  const seen = new Set();
  return rows
    .map(item => {
      const row = isObject(item) ? item : {};
      return {
        entity: String(row.entity || row.entity_id || "").trim(),
        title: String(row.title || "").trim(),
        message: String(row.message || "").trim(),
        tint_color: String(row.tint_color || "").trim(),
        url: String(row.url || "").trim(),
        action_label: String(row.action_label || "").trim(),
        tap_action: normalizeNotificationTapAction(row.tap_action),
        mobile: normalizeSmartEntityOverrideMobile(row.mobile ?? row.mobile_notifications ?? row.mobile_enabled),
      };
    })
    .filter(item => {
      if (!item.entity || seen.has(item.entity)) {
        return false;
      }
      seen.add(item.entity);
      return Boolean(item.title || item.message || item.tint_color || item.url || item.action_label || hasNotificationTapAction(item.tap_action) || isExplicitSmartEntityMobile(item.mobile));
    });
}

export function normalizeSmartNotifications(value) {
  const rows = isObject(value) ? value : {};
  const out = {};
  Object.keys(DEFAULT_CONFIG.smart_notifications).forEach(key => {
    out[key] = normalizeSmartNotificationOptions(rows[key]);
  });
  return out;
}

export function normalizeCustomNotifications(value, options = {}) {
  const keepDrafts = options.keepDrafts === true;
  return (Array.isArray(value) ? value : [])
    .map(item => {
      const row = isObject(item) ? item : {};
      const normalized = {
        title: String(row.title || "").trim(),
        message: String(row.message || "").trim(),
        icon: String(row.icon || "mdi:bell-outline").trim(),
        tint_color: String(row.tint_color || "").trim(),
        severity: normalizeSeverity(row.severity || "info"),
        entity: String(row.entity || "").trim(),
        attribute: String(row.attribute || "").trim(),
        condition: String(row.condition || "always").trim(),
        value: String(row.value || "").trim(),
        action_label: String(row.action_label || "").trim(),
        action_type: String(row.action_type || "none").trim(),
        service: String(row.service || "").trim(),
        service_data: typeof row.service_data === "string"
          ? row.service_data
          : row.service_data
            ? JSON.stringify(row.service_data)
            : "",
        url: String(row.url || "").trim(),
        tap_action: normalizeNotificationTapAction(row.tap_action),
        mobile: normalizeSmartEntityMobile(row.mobile ?? row.mobile_notifications ?? row.mobile_enabled),
      };
      if (keepDrafts && row._draft === true) {
        normalized._draft = true;
      }
      return normalized;
    })
    .filter(item => {
      const hasContent = item.title || item.message || item.entity;
      const placeholderTitle = normalizeMatchText(item.title) === normalizeMatchText("New notification");
      const isPlaceholder = placeholderTitle && !item.message && !item.entity;
      return keepDrafts && item._draft === true ? true : hasContent && !isPlaceholder;
    });
}

export function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}


export function normalizeMatchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchTextIncludes(haystack, needle) {
  const normalizedHaystack = normalizeMatchText(haystack);
  const normalizedNeedle = normalizeMatchText(needle);
  return Boolean(normalizedHaystack && normalizedNeedle && normalizedHaystack.includes(normalizedNeedle));
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeSelectorValue(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }
  return String(value).replace(/["\\]/g, "\\$&");
}

export function sanitizeCssRuntimeValue(value, fallback) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallback;
  }
  if (
    /[<>{};"']/.test(raw)
    || raw.includes("/*")
    || raw.includes("*/")
    || /\burl\s*\(/i.test(raw)
    || /\b@import\b/i.test(raw)
  ) {
    return fallback;
  }
  return raw;
}

export function formatEditorHexChannel(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

export function formatEditorColorFromHex(hex, alpha = 1) {
  const normalizedHex = String(hex ?? "").trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(normalizedHex)) {
    return String(hex ?? "");
  }
  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  const safeAlpha = clamp(Number(alpha), 0, 1);
  if (safeAlpha >= 0.999) {
    return `#${normalizedHex}`;
  }
  return `rgba(${red}, ${green}, ${blue}, ${Number(safeAlpha.toFixed(2))})`;
}

export function parseEditorColorChannels(value) {
  const raw = String(value ?? "").trim();
  const hexMatch = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1].length === 3
      ? hexMatch[1].split("").map(channel => `${channel}${channel}`).join("")
      : hexMatch[1];
    return {
      alpha: 1,
      blue: Number.parseInt(hex.slice(4, 6), 16),
      green: Number.parseInt(hex.slice(2, 4), 16),
      red: Number.parseInt(hex.slice(0, 2), 16),
    };
  }
  const rgbMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbMatch) {
    return null;
  }
  const channels = rgbMatch[1]
    .split(",")
    .map(channel => Number(String(channel).trim().replace("%", "")));
  if (channels.length < 3 || channels.slice(0, 3).some(channel => !Number.isFinite(channel))) {
    return null;
  }
  return {
    alpha: channels.length > 3 && Number.isFinite(channels[3]) ? clamp(channels[3], 0, 1) : 1,
    blue: clamp(channels[2], 0, 255),
    green: clamp(channels[1], 0, 255),
    red: clamp(channels[0], 0, 255),
  };
}

export function resolveEditorColorValue(value) {
  const resolver = typeof window !== "undefined" ? window.NodaliaBubbleContrast?.resolveEditorColorValue : null;
  return typeof resolver === "function" ? resolver(value) : String(value ?? "").trim();
}

export function getEditorColorModel(value, fallbackValue = "#71c0ff") {
  const sourceValue = String(value ?? "").trim() || String(fallbackValue ?? "").trim() || "#71c0ff";
  const resolvedValue = resolveEditorColorValue(sourceValue) || resolveEditorColorValue(fallbackValue) || "rgb(113, 192, 255)";
  const parsed = parseEditorColorChannels(resolvedValue)
    || parseEditorColorChannels(sourceValue)
    || parseEditorColorChannels(resolveEditorColorValue(fallbackValue))
    || { alpha: 1, blue: 255, green: 192, red: 113 };
  const red = clamp(Math.round(parsed.red), 0, 255);
  const green = clamp(Math.round(parsed.green), 0, 255);
  const blue = clamp(Math.round(parsed.blue), 0, 255);
  const alpha = clamp(Number(parsed.alpha), 0, 1);
  const hex = `#${formatEditorHexChannel(red)}${formatEditorHexChannel(green)}${formatEditorHexChannel(blue)}`;
  return {
    alpha,
    hex,
    label: sourceValue,
    resolved: resolvedValue,
    source: sourceValue,
    value: formatEditorColorFromHex(hex, alpha),
  };
}

export function getEditorColorFallbackValue(field) {
  const normalizedField = String(field ?? "");
  if (normalizedField.endsWith("background")) {
    return normalizedField.includes(".card.") ? "var(--ha-card-background)" : "color-mix(in srgb, var(--primary-color) 18%, transparent)";
  }
  if (normalizedField.endsWith("icon.color") || normalizedField.endsWith("accent") || normalizedField.endsWith("tint_color")) {
    return "var(--primary-color)";
  }
  return "#71c0ff";
}

export function shouldDarkenNotificationIconGlyph(state, accentColor) {
  const contrast = typeof window !== "undefined" ? window.NodaliaBubbleContrast : null;
  if (contrast?.shouldDarkenBubbleIconGlyph?.(state, accentColor)) {
    return true;
  }
  const hue = contrast?.parseCssColorHue?.(accentColor);
  if (hue === null || hue === undefined || Number.isNaN(hue)) {
    return false;
  }
  return (hue >= 35 && hue <= 165) || (hue >= 300 || hue <= 20);
}

export function fireEvent(node, type, detail = {}, options = {}) {
  node.dispatchEvent(new CustomEvent(type, {
    bubbles: options.bubbles !== false,
    cancelable: Boolean(options.cancelable),
    composed: options.composed !== false,
    detail,
  }));
}


export function setByPath(target, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  if (parts.some(isUnsafeConfigPathKey)) {
    return;
  }
  let cursor = target;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      cursor[part] = value;
      return;
    }
    if (!isObject(cursor[part]) && !Array.isArray(cursor[part])) {
      cursor[part] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    }
    cursor = cursor[part];
  });
}

export function deleteByPath(target, path) {
  const parts = String(path || "").split(".").filter(Boolean);
  if (parts.some(isUnsafeConfigPathKey)) {
    return;
  }
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    cursor = cursor?.[parts[i]];
    if (!cursor) {
      return;
    }
  }
  if (cursor) {
    delete cursor[parts[parts.length - 1]];
  }
}

export function getByPath(target, path) {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((cursor, part) => cursor?.[part], target);
}

export function parseServiceData(value) {
  if (!value) {
    return {};
  }
  if (isObject(value)) {
    return deepClone(value);
  }
  try {
    const parsed = JSON.parse(String(value));
    return isObject(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

export function normalizeSeverity(value) {
  const key = String(value || "info").trim().toLowerCase();
  return ["info", "success", "warning", "critical"].includes(key) ? key : "info";
}

export function friendlyName(hass, entityId) {
  const state = hass?.states?.[entityId];
  return String(state?.attributes?.friendly_name || entityId || "").trim();
}

export function areaRecordName(hass, areaId) {
  const rawId = String(areaId || "").trim();
  if (!rawId) {
    return "";
  }
  const areas = hass?.areas;
  if (Array.isArray(areas)) {
    const area = areas.find(item => String(item?.area_id || item?.id || "") === rawId);
    return String(area?.name || rawId).trim();
  }
  const area = areas?.[rawId];
  return String(area?.name || rawId).trim();
}

export function entityRegistryEntry(hass, entityId) {
  return hass?.entities?.[entityId] || hass?.entityRegistry?.[entityId] || hass?.entity_registry?.[entityId] || null;
}

export function deviceRegistryEntry(hass, deviceId) {
  const rawId = String(deviceId || "").trim();
  if (!rawId) {
    return null;
  }
  const devices = hass?.devices;
  if (Array.isArray(devices)) {
    return devices.find(item => String(item?.id || item?.device_id || "") === rawId) || null;
  }
  return devices?.[rawId] || null;
}

export function entityAreaName(hass, entityId) {
  const state = hass?.states?.[entityId];
  const entity = entityRegistryEntry(hass, entityId);
  const device = deviceRegistryEntry(hass, entity?.device_id || state?.attributes?.device_id);
  const areaId = entity?.area_id || device?.area_id || state?.attributes?.area_id;
  const areaName = areaRecordName(hass, areaId);
  if (areaName) {
    return areaName;
  }
  const attrArea = state?.attributes?.area || state?.attributes?.area_name || state?.attributes?.room || state?.attributes?.room_name;
  if (attrArea) {
    return String(attrArea).trim();
  }
  const searchable = normalizeMatchText(`${entityId} ${friendlyName(hass, entityId)}`);
  const areas = hass?.areas;
  const areaList = Array.isArray(areas) ? areas : Object.values(areas || {});
  const matched = areaList.find(area => {
    const name = normalizeMatchText(area?.name || area?.area_id || area?.id || "");
    return name && searchable.includes(name);
  });
  return String(matched?.name || matched?.area_id || matched?.id || "").trim();
}

export function entityAreaKey(hass, entityId) {
  return normalizeMatchText(entityAreaName(hass, entityId));
}

export function entityMatchTokens(hass, entityId) {
  const stopWords = new Set(["sensor", "temperatura", "temperature", "humidity", "humedad", "fan", "ventilador", "weather", "clima"]);
  return normalizeMatchText(`${entityId} ${friendlyName(hass, entityId)}`)
    .split(" ")
    .filter(token => token.length > 2 && !stopWords.has(token));
}

export function stateValue(stateObj, attribute = "") {
  if (!stateObj) {
    return "";
  }
  if (attribute) {
    return stateObj.attributes?.[attribute];
  }
  return stateObj.state;
}

export const NOTIFICATION_TEMPLATE_TOKEN_PATTERN = /\{([^{}]+)\}/g;
export const NOTIFICATION_TEMPLATE_ENTITY_PATTERN = /^([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)(?:\.([a-zA-Z0-9_]+))?$/;

export function stringifyNotificationTemplateValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map(item => stringifyNotificationTemplateValue(item)).filter(Boolean).join(", ");
  }
  if (isObject(value)) {
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }
  return String(value);
}

export function notificationTemplateMeasurement(value, unit = "") {
  const text = stringifyNotificationTemplateValue(value);
  return text ? `${text}${unit || ""}` : "";
}

export function referencedNotificationTemplateEntities(template) {
  const entities = new Set();
  for (const match of String(template || "").matchAll(NOTIFICATION_TEMPLATE_TOKEN_PATTERN)) {
    const entityMatch = String(match[1] || "").trim().match(NOTIFICATION_TEMPLATE_ENTITY_PATTERN);
    if (entityMatch) {
      entities.add(entityMatch[1]);
    }
  }
  return [...entities];
}

export function entityNotificationTemplateValue(hass, token) {
  const match = String(token || "").trim().match(NOTIFICATION_TEMPLATE_ENTITY_PATTERN);
  if (!match) {
    return undefined;
  }
  const [, entityId, attribute] = match;
  const stateObj = hass?.states?.[entityId];
  if (!stateObj) {
    return "";
  }
  if (attribute === "state") {
    return stateObj.state;
  }
  if (attribute) {
    return stateObj.attributes?.[attribute];
  }
  const domain = entityId.split(".")[0];
  if (domain === "media_player") {
    return stateObj.attributes?.friendly_name || entityId;
  }
  if (domain === "calendar") {
    return stateObj.attributes?.message
      || stateObj.attributes?.summary
      || stateObj.attributes?.friendly_name
      || stateObj.state;
  }
  const rawValue = stateObj.state;
  const unit = stateObj.attributes?.unit_of_measurement || "";
  return Number.isFinite(Number(rawValue)) ? notificationTemplateMeasurement(rawValue, unit) : rawValue;
}

export function formatNotificationTemplate(template, hass, values = {}) {
  return String(template || "").replace(NOTIFICATION_TEMPLATE_TOKEN_PATTERN, (_match, rawKey) => {
    const key = String(rawKey || "").trim();
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return stringifyNotificationTemplateValue(values[key]);
    }
    return stringifyNotificationTemplateValue(entityNotificationTemplateValue(hass, key));
  });
}

export function customNotificationTemplateValues(hass, item = {}, fanEntityId = "") {
  const entityId = String(item?.entity || "").trim();
  const stateObj = hass?.states?.[entityId];
  const rawValue = stateValue(stateObj, item?.attribute);
  const unit = stateObj?.attributes?.unit_of_measurement || "";
  const value = Number.isFinite(Number(rawValue))
    ? notificationTemplateMeasurement(rawValue, unit)
    : stringifyNotificationTemplateValue(rawValue);
  const threshold = Number.isFinite(Number(item?.value))
    ? notificationTemplateMeasurement(item.value, unit)
    : String(item?.value || "");
  const changedAt = new Date(stateObj?.last_changed || stateObj?.last_updated || "");
  return {
    ...(stateObj?.attributes || {}),
    source: entityId ? friendlyName(hass, entityId) : "",
    entity: entityId,
    state: stateObj?.state || "",
    value,
    threshold,
    fan: fanEntityId ? friendlyName(hass, fanEntityId) : "",
    time: formatTime(changedAt),
  };
}

export function numericState(stateObj, attribute = "") {
  const raw = stateValue(stateObj, attribute);
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

export function stateIsOn(stateObj) {
  const state = String(stateObj?.state || "").toLowerCase();
  return ["on", "open", "opening", "detected", "motion", "home"].includes(state);
}

export function stateIsOff(stateObj) {
  const state = String(stateObj?.state || "").toLowerCase();
  return ["off", "closed", "clear", "idle", "docked"].includes(state);
}

export function stateLooksActive(stateObj) {
  const state = String(stateObj?.state || "").toLowerCase();
  return Boolean(state && !["off", "closed", "clear", "idle", "docked", "unavailable", "unknown"].includes(state));
}

export function stateIsVacant(stateObj) {
  const state = String(stateObj?.state || "").toLowerCase();
  return ["off", "clear", "not_home", "closed", "0"].includes(state);
}

export function minutesSinceChanged(stateObj) {
  const changed = Date.parse(stateObj?.last_changed || stateObj?.last_updated || "");
  return Number.isFinite(changed) ? (Date.now() - changed) / 60000 : 0;
}

export function formatNumber(value, unit = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "";
  }
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(number);
  return `${formatted}${unit || ""}`;
}

export function calendarEventDate(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (isObject(value)) {
    return calendarEventDate(value.dateTime || value.date || value.datetime);
  }
  return null;
}

export function isSameLocalDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function normalizeCalendarFetchResult(raw) {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (Array.isArray(raw?.events)) {
    return raw.events;
  }
  if (Array.isArray(raw?.calendar_events)) {
    return raw.calendar_events;
  }
  return [];
}

export function normalizeWeatherForecastResult(raw, entityId) {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (Array.isArray(raw?.forecast)) {
    return raw.forecast;
  }
  if (Array.isArray(raw?.[entityId]?.forecast)) {
    return raw[entityId].forecast;
  }
  return [];
}

export function forecastDate(value) {
  return calendarEventDate(value?.datetime || value?.dateTime || value?.date || value?.time || value?.start);
}

export function forecastNumber(value, fields) {
  for (const field of fields) {
    const raw = value?.[field];
    const number = Number(raw);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return null;
}

export function forecastLooksRainy(row) {
  const condition = normalizeMatchText(row?.condition || row?.state || row?.weather || "");
  if (condition.includes("rain") || condition.includes("lluv") || condition.includes("pouring") || condition.includes("storm")) {
    return true;
  }
  const precipitation = forecastNumber(row, ["precipitation", "rain", "precipitation_amount", "native_precipitation"]);
  return precipitation !== null && precipitation > 0.2;
}

export function notificationHash(value) {
  const input = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function resolveBackgroundMobileLanguage(config, hass = null) {
  const configured = String(config?.language || "auto").trim();
  const translated = typeof window !== "undefined"
    ? window.NodaliaI18n?.resolveLanguage?.(hass, configured)
    : "";
  const candidates = [
    translated,
    configured.toLowerCase() !== "auto" ? configured : "",
    hass?.locale?.language,
    hass?.language,
    hass?.config?.language,
  ];
  for (const candidate of candidates) {
    const language = String(candidate || "")
      .trim()
      .toLowerCase()
      .replace("_", "-")
      .split("-", 1)[0];
    if (language) {
      return language;
    }
  }
  return "en";
}

export function getBackgroundMobileConfigPayload(rawConfig, hass = null) {
  const config = normalizeConfig(rawConfig || {});
  const overrides = {};
  (config.smart_entity_overrides || []).forEach(item => {
    const entity = String(item?.entity || "").trim();
    if (!entity) {
      return;
    }
    overrides[entity] = {
      title: String(item.title || ""),
      message: String(item.message || ""),
      tint_color: String(item.tint_color || ""),
      url: String(item.url || ""),
      action_label: String(item.action_label || ""),
      tap_action: normalizeNotificationTapAction(item.tap_action),
      ...(isExplicitSmartEntityMobile(item.mobile) ? { mobile: normalizeMobilePolicy(item.mobile) } : {}),
    };
  });
  return {
    version: 2,
    card_version: CARD_VERSION,
    source: CARD_TAG,
    language: resolveBackgroundMobileLanguage(config, hass),
    enabled: config.background_mobile?.enabled === true,
    smart_recommendations: config.smart_recommendations !== false,
    notify: {
      enabled: config.mobile_notifications?.enabled === true,
      entities: config.mobile_notifications?.entities || [],
      services: config.mobile_notifications?.services || [],
      min_severity: config.mobile_notifications?.min_severity || "warning",
      critical_alerts: config.mobile_notifications?.critical_alerts === true,
      default_policy: normalizeMobilePolicy(config.mobile_notifications?.default_policy ?? "auto"),
      cooldown_minutes: config.mobile_notifications?.cooldown_minutes ?? 30,
      group_similar: config.mobile_notifications?.group_similar !== false,
    },
    context: {
      presence_entity: config.presence_entity || "",
      only_when_away: config.mobile_context?.only_when_away === true,
      only_when_home: config.mobile_context?.only_when_home === true,
      quiet_hours: normalizeQuietHours(config.mobile_context?.quiet_hours),
    },
    smart: Object.fromEntries(
      Object.entries(config.smart_notifications || {}).map(([key, item]) => [
        key,
        {
          title: String(item?.title || ""),
          message: String(item?.message || ""),
          mobile: normalizeMobilePolicy(item?.mobile),
          url: String(item?.url || ""),
          action_label: String(item?.action_label || ""),
          tap_action: normalizeNotificationTapAction(item?.tap_action),
        },
      ]),
    ),
    custom: (config.custom_notifications || []).map(item => ({
      id: notificationHash(`${item.title}|${item.message}|${item.entity}|${item.attribute}|${item.condition}|${item.value}|${item.url}|${JSON.stringify(item.tap_action || {})}`),
      title: String(item.title || ""),
      message: String(item.message || ""),
      severity: normalizeSeverity(item.severity || "info"),
      entity: String(item.entity || ""),
      attribute: String(item.attribute || ""),
      condition: String(item.condition || "always"),
      value: String(item.value || ""),
      mobile: normalizeMobilePolicy(item.mobile),
      url: String(item.url || ""),
      action_label: String(item.action_label || ""),
      tap_action: normalizeNotificationTapAction(item.tap_action),
    })),
    external_alerts: (config.external_alerts || []).map(item => ({
      id: item.id,
      type: item.type,
      title: item.title,
      message: item.message,
      severity: item.severity,
      entity: item.entity,
      source: item.source,
      mobile: normalizeMobilePolicy(item.mobile),
      url: String(item.url || ""),
      action_label: String(item.action_label || ""),
      tap_action: normalizeNotificationTapAction(item.tap_action),
    })),
    thresholds: {
      hot_temperature: config.thresholds?.hot_temperature,
      cold_temperature: config.thresholds?.cold_temperature,
      humidity_high: config.thresholds?.humidity_high,
      humidity_low: config.thresholds?.humidity_low,
      battery_low: config.thresholds?.battery_low,
      humidifier_fill_low: config.thresholds?.humidifier_fill_low,
      humidifier_fill_full: config.thresholds?.humidifier_fill_full,
      ink_low: config.thresholds?.ink_low,
      rain_probability: config.thresholds?.rain_probability,
      rain_lookahead_hours: config.thresholds?.rain_lookahead_hours,
      media_absence_minutes: config.thresholds?.media_absence_minutes,
    },
    entities: {
      calendar: config.calendar_entities || [],
      vacuum: config.vacuum_entities || [],
      vacuum_error: config.vacuum_error_entities || [],
      door: config.door_entities || [],
      window: config.window_entities || [],
      motion: config.motion_entities || [],
      fan: config.fan_entities || [],
      climate: config.climate_entities || [],
      humidifier: config.humidifier_entities || [],
      media_player: config.media_player_entities || [],
      weather: config.weather_entities || [],
      temperature: config.temperature_entities || [],
      humidity: config.humidity_entities || [],
      outdoor_temperature: config.outdoor_temperature_entities || [],
      outdoor_humidity: config.outdoor_humidity_entities || [],
      battery: config.battery_entities || [],
      humidifier_fill: config.humidifier_fill_entities || [],
      humidifier_full: config.humidifier_full_entities || [],
      ink: config.ink_entities || [],
    },
    overrides,
  };
}

export function buildBackgroundMobileWebhookPayload(rawConfig, hass = null, options = {}) {
  const config = normalizeConfig(rawConfig || {});
  const background = config.background_mobile || {};
  const chunkSize = Math.max(120, Math.min(240, Number(background.chunk_size) || 240));
  const profile = getBackgroundMobileConfigPayload(config, hass);
  if (typeof options.enabled === "boolean") {
    profile.enabled = options.enabled;
  }
  const json = JSON.stringify(profile);
  const chunks = [];
  for (let index = 0; index < json.length; index += chunkSize) {
    chunks.push(json.slice(index, index + chunkSize));
  }
  return {
    version: 2,
    card_version: CARD_VERSION,
    source: CARD_TAG,
    chunk_count: chunks.length,
    max_chunks: BACKGROUND_MOBILE_MAX_CHUNKS,
    over_limit: chunks.length > BACKGROUND_MOBILE_MAX_CHUNKS,
    config_hash: notificationHash(json),
    chunks,
  };
}

export function getBackgroundMobileNativeSignature(rawConfig, hass = null) {
  const config = normalizeConfig(rawConfig || {});
  const profileId = String(config.background_mobile?.profile_id || "default").trim() || "default";
  const profile = getBackgroundMobileConfigPayload(config, hass);
  return {
    profile,
    profileId,
    signature: `${profileId}:${notificationHash(JSON.stringify(profile))}`,
  };
}

export async function syncBackgroundMobileNative(hass, rawConfig) {
  const backend = typeof window !== "undefined" ? window.NodaliaBackend : null;
  if (!backend || !hass) {
    return { available: false, synced: false, signature: "", transient: false };
  }
  const status = await backend.status(hass, { silent: true });
  if (!status?.available || !status.capabilities?.includes("notifications_background")) {
    return {
      available: false,
      synced: false,
      signature: "",
      transient: status?.transient === true,
    };
  }
  const { profile, profileId, signature } = getBackgroundMobileNativeSignature(rawConfig, hass);
  try {
    if (hass.user?.is_admin) {
      const current = await backend.setNotificationProfile(hass, profile, profileId);
      return {
        available: true,
        synced: true,
        signature,
        dismissed: Array.isArray(current?.dismissed) ? current.dismissed : [],
      };
    }
    const current = await backend.getNotificationProfile(hass, profileId);
    const active = current?.profile?.enabled === true && current?.profile?.notify?.enabled === true;
    return {
      available: true,
      synced: active,
      signature: active ? `active:${profileId}` : "",
      dismissed: Array.isArray(current?.dismissed) ? current.dismissed : [],
    };
  } catch (error) {
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn("Nodalia Notifications Card: native background synchronization failed; keeping Engine ownership.", error);
    }
    // Engine is loaded; a profile read/write failure is not proof that its
    // server-side notification delivery stopped.
    return { available: true, synced: false, signature: "", transient: true };
  }
}

export async function setLegacyBackgroundMobileFallback(hass, enabled) {
  const state = hass?.states?.[LEGACY_BACKGROUND_MOBILE_TOGGLE];
  if (!state) {
    return true;
  }
  if (typeof hass?.callService !== "function") {
    return false;
  }
  const desiredState = enabled ? "on" : "off";
  if (String(state.state || "").toLowerCase() === desiredState) {
    return true;
  }
  try {
    await hass.callService(
      "input_boolean",
      enabled ? "turn_on" : "turn_off",
      { entity_id: LEGACY_BACKGROUND_MOBILE_TOGGLE },
    );
    return true;
  } catch (error) {
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn(
        `Nodalia Notifications Card: could not ${enabled ? "activate" : "pause"} the legacy background package.`,
        error,
      );
    }
    return false;
  }
}
