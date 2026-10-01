import type { HomeAssistant, HassEntity } from "../../core/types/home-assistant";
import { parseFiniteNumericValue } from "../../shared/numeric-values";
import { setByPath as setArrayPath } from "../../shared/editor-array-paths";
export { formatEditorHexChannel, formatEditorColorFromHex, parseEditorColorChannels, resolveEditorColorValue, getEditorColorModel } from "../../shared/editor-color";
import { normalizeNotificationTapAction, normalizeMatchText, normalizeSeverity } from "./notifications-normalization";
export { mergeDeep, entityDomain, normalizeEntityList, normalizeStringList, normalizeNotifyServices, normalizeBoolean, normalizeNotificationTapAction, hasNotificationTapAction, normalizeSmartNotificationOptions, normalizeExternalAlerts, normalizeSmartEntityOverrides, normalizeSmartNotifications, normalizeCustomNotifications, finiteNumber, normalizeMatchText, normalizeSeverity } from "./notifications-normalization";
import { CARD_TAG, CARD_VERSION, LEGACY_BACKGROUND_MOBILE_TOGGLE } from "./notifications-constants";
import { normalizeConfig } from "./notifications-config";
import {
  BACKGROUND_MOBILE_MAX_CHUNKS,
  deepClone,
  isExplicitSmartEntityMobile,
  isObject,
  isUnsafeConfigPathKey,
  normalizeMobilePolicy,
  normalizeQuietHours,
} from "./notifications-runtime";


export function compactConfig(value: unknown): unknown {
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
    const out: Record<string, unknown> = {};
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

export function matchTextIncludes(haystack: unknown, needle: unknown) {
  const normalizedHaystack = normalizeMatchText(haystack);
  const normalizedNeedle = normalizeMatchText(needle);
  return Boolean(normalizedHaystack && normalizedNeedle && normalizedHaystack.includes(normalizedNeedle));
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeSelectorValue(value: unknown) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }
  return String(value).replace(/["\\]/g, "\\$&");
}

export function sanitizeCssRuntimeValue<T>(value: unknown, fallback: T): string | T {
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

export function getEditorColorFallbackValue(field: unknown) {
  const normalizedField = String(field ?? "");
  if (normalizedField.endsWith("background")) {
    return normalizedField.includes(".card.") ? "var(--ha-card-background)" : "color-mix(in srgb, var(--primary-color) 18%, transparent)";
  }
  if (normalizedField.endsWith("icon.color") || normalizedField.endsWith("accent") || normalizedField.endsWith("tint_color")) {
    return "var(--primary-color)";
  }
  return "#71c0ff";
}

export function shouldDarkenNotificationIconGlyph(state: HassEntity | null | undefined, accentColor: unknown) {
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

export function fireEvent(node: EventTarget, type: string, detail: unknown = {}, options: { bubbles?: boolean; cancelable?: boolean; composed?: boolean } = {}): void {
  node.dispatchEvent(new CustomEvent(type, {
    bubbles: options.bubbles !== false,
    cancelable: Boolean(options.cancelable),
    composed: options.composed !== false,
    detail,
  }));
}


export function setByPath(target: unknown, path: unknown, value: unknown): void {
  const parts = String(path || "").split(".").filter(Boolean);
  if (parts.length) setArrayPath(target, parts.join("."), value);
}

export function getByPath(target: unknown, path: unknown): unknown {
  const parts = String(path || "").split(".").filter(Boolean);
  if (parts.some(isUnsafeConfigPathKey)) return undefined;
  let cursor: unknown = target;
  for (const part of parts) {
    if (Array.isArray(cursor)) {
      cursor = /^\d+$/.test(part) && Object.prototype.hasOwnProperty.call(cursor, part) ? cursor[Number(part)] : undefined;
    } else if (isObject(cursor) && Object.prototype.hasOwnProperty.call(cursor, part)) {
      cursor = cursor[part];
    } else return undefined;
  }
  return cursor;
}

export function deleteByPath(target: unknown, path: unknown): void {
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length || parts.some(isUnsafeConfigPathKey)) return;
  const leaf = parts.pop();
  const cursor = parts.length ? getByPath(target, parts.join(".")) : target;
  if (leaf === undefined) return;
  if (Array.isArray(cursor)) {
    if (/^\d+$/.test(leaf)) delete cursor[Number(leaf)];
  } else if (isObject(cursor)) delete cursor[leaf];
}

export function parseServiceData(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (isObject(value)) {
    return deepClone(value);
  }
  try {
    const parsed: unknown = JSON.parse(String(value));
    return isObject(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}


export function friendlyName(hass: HomeAssistant | null | undefined, entityId: string) {
  const state = hass?.states?.[entityId];
  return String(state?.attributes?.friendly_name || entityId || "").trim();
}

export function areaRecordName(hass: HomeAssistant | null | undefined, areaId: unknown) {
  const rawId = String(areaId || "").trim();
  if (!rawId) {
    return "";
  }
  const areas = hass?.areas;
  if (Array.isArray(areas)) {
    const area = areas.filter(isObject).find(item => String(item.area_id || item.id || "") === rawId);
    return String(area?.name || rawId).trim();
  }
  const area = isObject(areas) && isObject(areas[rawId]) ? areas[rawId] : null;
  return String(area?.name || rawId).trim();
}

export function entityRegistryEntry(hass: HomeAssistant | null | undefined, entityId: string) {
  for (const registry of [hass?.entities, hass?.entityRegistry, hass?.entity_registry]) {
    const entry = isObject(registry) ? registry[entityId] : undefined;
    if (isObject(entry)) return entry;
  }
  return null;
}

export function deviceRegistryEntry(hass: HomeAssistant | null | undefined, deviceId: unknown) {
  const rawId = String(deviceId || "").trim();
  if (!rawId) {
    return null;
  }
  const devices = hass?.devices;
  if (Array.isArray(devices)) {
    return devices.filter(isObject).find(item => String(item.id || item.device_id || "") === rawId) || null;
  }
  return isObject(devices) && isObject(devices[rawId]) ? devices[rawId] : null;
}

export function entityAreaName(hass: HomeAssistant | null | undefined, entityId: string) {
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
  const areaList = (Array.isArray(areas) ? areas : isObject(areas) ? Object.values(areas) : []).filter(isObject);
  const matched = areaList.find(area => {
    const name = normalizeMatchText(area?.name || area?.area_id || area?.id || "");
    return name && searchable.includes(name);
  });
  return String(matched?.name || matched?.area_id || matched?.id || "").trim();
}

export function entityAreaKey(hass: HomeAssistant | null | undefined, entityId: string) {
  return normalizeMatchText(entityAreaName(hass, entityId));
}

export function entityMatchTokens(hass: HomeAssistant | null | undefined, entityId: string) {
  const stopWords = new Set(["sensor", "temperatura", "temperature", "humidity", "humedad", "fan", "ventilador", "weather", "clima"]);
  return normalizeMatchText(`${entityId} ${friendlyName(hass, entityId)}`)
    .split(" ")
    .filter(token => token.length > 2 && !stopWords.has(token));
}

export function stateValue(stateObj: HassEntity | null | undefined, attribute = ""): unknown {
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

export function stringifyNotificationTemplateValue(value: unknown): string {
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

export function notificationTemplateMeasurement(value: unknown, unit: unknown = "") {
  const text = stringifyNotificationTemplateValue(value);
  return text ? `${text}${unit || ""}` : "";
}

export function referencedNotificationTemplateEntities(template: unknown) {
  const entities = new Set<string>();
  for (const match of String(template || "").matchAll(NOTIFICATION_TEMPLATE_TOKEN_PATTERN)) {
    const entityMatch = String(match[1] || "").trim().match(NOTIFICATION_TEMPLATE_ENTITY_PATTERN);
    if (entityMatch?.[1]) {
      entities.add(entityMatch[1]);
    }
  }
  return [...entities];
}

export function entityNotificationTemplateValue(hass: HomeAssistant | null | undefined, token: unknown): unknown {
  const match = String(token || "").trim().match(NOTIFICATION_TEMPLATE_ENTITY_PATTERN);
  if (!match) {
    return undefined;
  }
  const [, entityId, attribute] = match;
  if (!entityId) return "";
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
  return parseFiniteNumericValue(rawValue) !== null ? notificationTemplateMeasurement(rawValue, unit) : rawValue;
}

export function formatNotificationTemplate(template: unknown, hass: HomeAssistant | null | undefined, values: Record<string, unknown> = {}) {
  return String(template || "").replace(NOTIFICATION_TEMPLATE_TOKEN_PATTERN, (_match, rawKey) => {
    const key = String(rawKey || "").trim();
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return stringifyNotificationTemplateValue(values[key]);
    }
    return stringifyNotificationTemplateValue(entityNotificationTemplateValue(hass, key));
  });
}

export function customNotificationTemplateValues(hass: HomeAssistant | null | undefined, rawItem: unknown = {}, fanEntityId = "") {
  const item = isObject(rawItem) ? rawItem : {};
  const entityId = String(item.entity || "").trim();
  const stateObj = hass?.states?.[entityId];
  const rawValue = stateValue(stateObj, String(item.attribute || ""));
  const unit = stateObj?.attributes?.unit_of_measurement || "";
  const value = parseFiniteNumericValue(rawValue) !== null
    ? notificationTemplateMeasurement(rawValue, unit)
    : stringifyNotificationTemplateValue(rawValue);
  const threshold = parseFiniteNumericValue(item?.value) !== null
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

export function numericState(stateObj: HassEntity | null | undefined, attribute = "") {
  const raw = stateValue(stateObj, attribute);
  return parseFiniteNumericValue(raw);
}

export function stateIsOn(stateObj: HassEntity | null | undefined) {
  const state = String(stateObj?.state || "").toLowerCase();
  return ["on", "open", "opening", "detected", "motion", "home"].includes(state);
}

export function stateIsOff(stateObj: HassEntity | null | undefined) {
  const state = String(stateObj?.state || "").toLowerCase();
  return ["off", "closed", "clear", "idle", "docked"].includes(state);
}

export function stateLooksActive(stateObj: HassEntity | null | undefined) {
  const state = String(stateObj?.state || "").toLowerCase();
  return Boolean(state && !["off", "closed", "clear", "idle", "docked", "unavailable", "unknown"].includes(state));
}

export function stateIsVacant(stateObj: HassEntity | null | undefined) {
  const state = String(stateObj?.state || "").toLowerCase();
  return ["off", "clear", "not_home", "closed", "0"].includes(state);
}

export function minutesSinceChanged(stateObj: HassEntity | null | undefined) {
  const changed = Date.parse(stateObj?.last_changed || stateObj?.last_updated || "");
  return Number.isFinite(changed) ? (Date.now() - changed) / 60000 : 0;
}

export function formatNumber(value: unknown, unit: unknown = "") {
  const number = parseFiniteNumericValue(value);
  if (number === null) {
    return "";
  }
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(number);
  return `${formatted}${unit || ""}`;
}

export function calendarEventDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
    if (Number.isNaN(date.getTime())) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) return null;
    }
    return date;
  }
  if (isObject(value)) {
    return calendarEventDate(value.dateTime || value.date || value.datetime);
  }
  return null;
}

export function isSameLocalDay(a: Date | null, b: Date | null) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatTime(date: unknown) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function normalizeCalendarFetchResult(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter(isObject);
  }
  if (!isObject(raw)) return [];
  if (Array.isArray(raw.events)) {
    return raw.events.filter(isObject);
  }
  if (Array.isArray(raw?.calendar_events)) {
    return raw.calendar_events.filter(isObject);
  }
  return [];
}

export function normalizeWeatherForecastResult(raw: unknown, entityId: string): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter(isObject);
  }
  if (!isObject(raw)) return [];
  if (Array.isArray(raw.forecast)) {
    return raw.forecast.filter(isObject);
  }
  const nested = raw[entityId];
  if (isObject(nested) && Array.isArray(nested.forecast)) {
    return nested.forecast.filter(isObject);
  }
  return [];
}

export function forecastDate(raw: unknown) {
  const value = isObject(raw) ? raw : {};
  return calendarEventDate(value?.datetime || value?.dateTime || value?.date || value?.time || value?.start);
}

export function forecastNumber(rawValue: unknown, fields: readonly string[]) {
  const value = isObject(rawValue) ? rawValue : {};
  for (const field of fields) {
    const raw = value?.[field];
    const number = parseFiniteNumericValue(raw);
    if (number !== null) {
      return number;
    }
  }
  return null;
}

export function forecastLooksRainy(raw: unknown) {
  const row = isObject(raw) ? raw : {};
  const condition = normalizeMatchText(row?.condition || row?.state || row?.weather || "");
  if (condition.includes("rain") || condition.includes("lluv") || condition.includes("pouring") || condition.includes("storm")) {
    return true;
  }
  const precipitation = forecastNumber(row, ["precipitation", "rain", "precipitation_amount", "native_precipitation"]);
  return precipitation !== null && precipitation > 0.2;
}

export function notificationHash(value: unknown) {
  const input = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function resolveBackgroundMobileLanguage(rawConfig: unknown, hass: HomeAssistant | null = null) {
  const config = isObject(rawConfig) ? rawConfig : {};
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

export function getBackgroundMobileConfigPayload(rawConfig: unknown, hass: HomeAssistant | null = null) {
  const config = normalizeConfig(rawConfig || {});
  const overrides: Record<string, { title: string; message: string; tint_color: string; url: string; action_label: string; tap_action: ReturnType<typeof normalizeNotificationTapAction>; mobile?: ReturnType<typeof normalizeMobilePolicy> }> = {};
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

export function buildBackgroundMobileWebhookPayload(rawConfig: unknown, hass: HomeAssistant | null = null, options: { enabled?: boolean } = {}) {
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

export function getBackgroundMobileNativeSignature(rawConfig: unknown, hass: HomeAssistant | null = null) {
  const config = normalizeConfig(rawConfig || {});
  const profileId = String(config.background_mobile?.profile_id || "default").trim() || "default";
  const profile = getBackgroundMobileConfigPayload(config, hass);
  return {
    profile,
    profileId,
    signature: `${profileId}:${notificationHash(JSON.stringify(profile))}`,
  };
}

export async function syncBackgroundMobileNative(hass: HomeAssistant | null, rawConfig: unknown) {
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
        dismissed: isObject(current) && Array.isArray(current.dismissed) ? current.dismissed : [],
      };
    }
    const current = await backend.getNotificationProfile(hass, profileId);
    const currentRecord = isObject(current) ? current : {};
    const activeProfile = isObject(currentRecord.profile) ? currentRecord.profile : {};
    const notify = isObject(activeProfile.notify) ? activeProfile.notify : {};
    const active = activeProfile.enabled === true && notify.enabled === true;
    return {
      available: true,
      synced: active,
      signature: active ? `active:${profileId}` : "",
      dismissed: isObject(current) && Array.isArray(current.dismissed) ? current.dismissed : [],
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

export async function setLegacyBackgroundMobileFallback(hass: HomeAssistant | null | undefined, enabled: boolean) {
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

/** External callers can inject alerts only into a Notifications-compatible target. */
export function pushExternalAlerts(target: unknown, alerts: unknown = []): boolean {
  if ((target === null || typeof target !== "object") && typeof target !== "function") return false;
  if (!("_ingestRuntimeExternalAlerts" in target) || typeof target._ingestRuntimeExternalAlerts !== "function") return false;
  target._ingestRuntimeExternalAlerts(alerts);
  return true;
}
