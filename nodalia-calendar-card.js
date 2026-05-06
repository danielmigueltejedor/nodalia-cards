import {
  eventDate,
  completionKey,
  expandCompletionPayloadToKeys,
  pickShortestCompletionPayload,
  canonicalCompletionKeysJson,
  normalizeCompletionPayloadForCompare,
} from "./nodalia-calendar-completion-codec.js";

const CARD_TAG = "nodalia-calendar-card";
const EDITOR_TAG = "nodalia-calendar-card-editor";
const CARD_VERSION = "1.0.0-alpha.46";
const COMPLETION_STORAGE_KEY = "nodalia_calendar_completed_v1";
const NODALIA_EVENT_METADATA_RE = /<!--\s*nodalia:event(?:\s+color="([^"]+)")?\s*-->/gi;

const VALID_TIME_RANGES = ["3d", "1w", "2w", "1m"];

const DEFAULT_CONFIG = {
  title: "Calendario",
  icon: "mdi:calendar-month",
  calendars: [],
  time_range: "1w",
  days_to_show: 7,
  max_visible_events: 2,
  refresh_interval: 300,
  show_completed: false,
  allow_complete: true,
  weather_entity: "",
  shared_completed_events_entity: "",
  shared_completed_events_entity_2: "",
  shared_completed_events_entity_3: "",
  shared_completed_events_entity_4: "",
  shared_completed_events_entities: [],
  shared_completed_events_webhook: "",
  native_event_webhook: "",
  security: {
    allow_webhooks_for_non_admin: true,
  },
  tint_auto: true,
  animations: {
    enabled: true,
    content_duration: 260,
  },
  styles: {
    card: {
      background: "var(--ha-card-background, var(--card-background-color))",
      border: "1px solid var(--divider-color)",
      border_radius: "28px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "14px",
      gap: "12px",
    },
    icon: {
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      on_color:
        "color-mix(in srgb, var(--primary-color) 52%, var(--primary-text-color))",
      off_color:
        "color-mix(in srgb, var(--primary-text-color) 62%, var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 48%, transparent)))",
      size: "38px",
    },
    tint: {
      color: "var(--primary-color)",
    },
    title_size: "17px",
    event_size: "13px",
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_size: "11px",
  },
};

function normalizeSharedCompletedEntities(raw) {
  const src = Array.isArray(raw) ? raw : [];
  const ids = [];
  src.forEach(value => {
    const id = String(value ?? "").trim();
    if (id.startsWith("input_text.") && !ids.includes(id)) {
      ids.push(id);
    }
  });
  return ids.slice(0, 4);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeConfig(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? deepClone(override) : deepClone(base);
  }
  if (!isObject(base)) {
    return override === undefined ? base : override;
  }
  const out = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(override || {})]);
  keys.forEach(key => {
    const baseValue = base[key];
    const overrideValue = override ? override[key] : undefined;
    if (overrideValue === undefined) {
      out[key] = deepClone(baseValue);
      return;
    }
    if (isObject(baseValue) && isObject(overrideValue)) {
      out[key] = mergeConfig(baseValue, overrideValue);
      return;
    }
    out[key] = deepClone(overrideValue);
  });
  return out;
}

function compactCalendarConfig(value) {
  if (Array.isArray(value)) {
    return value.map(item => compactCalendarConfig(item)).filter(item => item !== undefined);
  }
  if (isObject(value)) {
    const compacted = {};
    Object.entries(value).forEach(([key, item]) => {
      const cleaned = compactCalendarConfig(item);
      const isEmptyObject = isObject(cleaned) && Object.keys(cleaned).length === 0;
      if (cleaned !== undefined && !isEmptyObject) {
        compacted[key] = cleaned;
      }
    });
    return compacted;
  }
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}

function sanitizeCalendarTint(value) {
  const s = String(value ?? "").trim();
  if (!s) {
    return "";
  }
  if (/^#[0-9a-f]{3,8}$/i.test(s)) {
    return s;
  }
  if (/^rgba?\(/i.test(s) && s.length < 140) {
    return s;
  }
  if (/^color-mix\(/i.test(s) && s.length < 240) {
    return s;
  }
  if (/^var\(--[a-zA-Z0-9_-]+\)$/i.test(s)) {
    return s;
  }
  return "";
}

function extractNodaliaEventColor(description) {
  const text = String(description ?? "");
  let color = "";
  text.replace(NODALIA_EVENT_METADATA_RE, (_match, rawColor) => {
    const safeColor = sanitizeCalendarTint(rawColor);
    if (safeColor) {
      color = safeColor;
    }
    return "";
  });
  return color;
}

function stripNodaliaEventMetadata(description) {
  return String(description ?? "")
    .replace(NODALIA_EVENT_METADATA_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function appendNodaliaEventMetadata(description, { color = "" } = {}) {
  const cleanDescription = stripNodaliaEventMetadata(description);
  const safeColor = sanitizeCalendarTint(color);
  if (!safeColor) {
    return cleanDescription;
  }
  const metadata = `<!-- nodalia:event color="${safeColor}" -->`;
  return cleanDescription ? `${cleanDescription}\n\n${metadata}` : metadata;
}

function sanitizeCssRuntimeValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  if (/[<>{};"']/.test(raw) || raw.includes("/*") || raw.includes("*/") || /<\/style/i.test(raw)) {
    return "";
  }
  return raw;
}

function daysFromTimeRange(tr) {
  const map = { "3d": 3, "1w": 7, "2w": 14, "1m": 31 };
  return map[tr] || 7;
}

function normalizeCalendarEntries(calendars) {
  if (!Array.isArray(calendars)) {
    return [];
  }
  const out = [];
  calendars.forEach(raw => {
    if (typeof raw === "string") {
      out.push({
        entity: String(raw ?? "").trim(),
        label: "",
        tint: "",
      });
      return;
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      out.push({
        entity: String(raw.entity ?? "").trim(),
        label: String(raw.label ?? "").trim(),
        tint: sanitizeCalendarTint(raw.tint),
      });
    }
  });
  return out;
}

function normalizeConfig(config) {
  const normalized = mergeConfig(DEFAULT_CONFIG, config || {});
  normalized.calendars = normalizeCalendarEntries(normalized.calendars);
  let timeRange = String(normalized.time_range || "").trim();
  if (!VALID_TIME_RANGES.includes(timeRange)) {
    const legacyDays = Number(normalized.days_to_show);
    if (Number.isFinite(legacyDays)) {
      if (legacyDays <= 3) {
        timeRange = "3d";
      } else if (legacyDays <= 7) {
        timeRange = "1w";
      } else if (legacyDays <= 14) {
        timeRange = "2w";
      } else {
        timeRange = "1m";
      }
    } else {
      timeRange = DEFAULT_CONFIG.time_range;
    }
  }
  normalized.time_range = timeRange;
  normalized.days_to_show = Math.min(62, Math.max(1, daysFromTimeRange(timeRange)));
  normalized.shared_completed_events_entity = String(normalized.shared_completed_events_entity ?? "").trim();
  normalized.shared_completed_events_entity_2 = String(normalized.shared_completed_events_entity_2 ?? "").trim();
  normalized.shared_completed_events_entity_3 = String(normalized.shared_completed_events_entity_3 ?? "").trim();
  normalized.shared_completed_events_entity_4 = String(normalized.shared_completed_events_entity_4 ?? "").trim();
  const sharedEntities = normalizeSharedCompletedEntities([
    normalized.shared_completed_events_entity,
    normalized.shared_completed_events_entity_2,
    normalized.shared_completed_events_entity_3,
    normalized.shared_completed_events_entity_4,
    ...(Array.isArray(normalized.shared_completed_events_entities)
      ? normalized.shared_completed_events_entities
      : []),
  ]);
  normalized.shared_completed_events_entities = sharedEntities;
  normalized.shared_completed_events_entity = sharedEntities[0] || "";
  normalized.shared_completed_events_entity_2 = sharedEntities[1] || "";
  normalized.shared_completed_events_entity_3 = sharedEntities[2] || "";
  normalized.shared_completed_events_entity_4 = sharedEntities[3] || "";
  normalized.shared_completed_events_webhook = String(normalized.shared_completed_events_webhook ?? "").trim();
  delete normalized.quick_reminder_webhook;
  normalized.native_event_webhook = String(normalized.native_event_webhook ?? "").trim();
  normalized.security = normalized.security || {};
  const legacyRequireAdmin = normalized.security.require_admin_for_webhooks === true;
  if (normalized.security.allow_webhooks_for_non_admin === undefined) {
    normalized.security.allow_webhooks_for_non_admin = !legacyRequireAdmin;
  }
  normalized.security.allow_webhooks_for_non_admin =
    normalized.security.allow_webhooks_for_non_admin !== false;
  normalized.weather_entity = String(normalized.weather_entity ?? "").trim();
  normalized.max_visible_events = Math.min(
    12,
    Math.max(1, Number(normalized.max_visible_events) || DEFAULT_CONFIG.max_visible_events),
  );
  normalized.refresh_interval = Math.min(3600, Math.max(30, Number(normalized.refresh_interval) || DEFAULT_CONFIG.refresh_interval));
  if (!normalized.styles.chip_font_size && normalized.styles.chip_size) {
    normalized.styles.chip_font_size = normalized.styles.chip_size;
  }
  normalized.styles.card.background =
    sanitizeCssRuntimeValue(normalized.styles.card.background) || DEFAULT_CONFIG.styles.card.background;
  normalized.styles.card.border =
    sanitizeCssRuntimeValue(normalized.styles.card.border) || DEFAULT_CONFIG.styles.card.border;
  normalized.styles.card.border_radius =
    sanitizeCssRuntimeValue(normalized.styles.card.border_radius) || DEFAULT_CONFIG.styles.card.border_radius;
  normalized.styles.card.box_shadow =
    sanitizeCssRuntimeValue(normalized.styles.card.box_shadow) || DEFAULT_CONFIG.styles.card.box_shadow;
  normalized.styles.card.padding =
    sanitizeCssRuntimeValue(normalized.styles.card.padding) || DEFAULT_CONFIG.styles.card.padding;
  normalized.styles.card.gap =
    sanitizeCssRuntimeValue(normalized.styles.card.gap) || DEFAULT_CONFIG.styles.card.gap;
  normalized.styles.title_size =
    sanitizeCssRuntimeValue(normalized.styles.title_size) || DEFAULT_CONFIG.styles.title_size;
  normalized.styles.event_size =
    sanitizeCssRuntimeValue(normalized.styles.event_size) || DEFAULT_CONFIG.styles.event_size;
  normalized.styles.chip_height =
    sanitizeCssRuntimeValue(normalized.styles.chip_height) || DEFAULT_CONFIG.styles.chip_height;
  normalized.styles.chip_font_size =
    sanitizeCssRuntimeValue(normalized.styles.chip_font_size) || DEFAULT_CONFIG.styles.chip_font_size;
  normalized.styles.chip_padding =
    sanitizeCssRuntimeValue(normalized.styles.chip_padding) || DEFAULT_CONFIG.styles.chip_padding;
  normalized.styles.icon.background =
    sanitizeCssRuntimeValue(normalized.styles.icon.background) || DEFAULT_CONFIG.styles.icon.background;
  normalized.styles.icon.on_color =
    sanitizeCssRuntimeValue(normalized.styles.icon.on_color) || DEFAULT_CONFIG.styles.icon.on_color;
  normalized.styles.icon.off_color =
    sanitizeCssRuntimeValue(normalized.styles.icon.off_color) || DEFAULT_CONFIG.styles.icon.off_color;
  normalized.styles.icon.size =
    sanitizeCssRuntimeValue(normalized.styles.icon.size) || DEFAULT_CONFIG.styles.icon.size;
  normalized.styles.tint.color =
    sanitizeCssRuntimeValue(normalized.styles.tint.color) || DEFAULT_CONFIG.styles.tint.color;
  const iconStyle = normalized.styles?.icon;
  if (iconStyle && iconStyle.color && !iconStyle.on_color) {
    iconStyle.on_color = iconStyle.color;
  }
  return normalized;
}

function calendarExitDurationMs(contentDuration) {
  const base = Math.min(1600, Math.max(120, Number(contentDuration) || DEFAULT_CONFIG.animations.content_duration));
  return Math.min(640, Math.max(320, Math.round(base * 0.62)));
}

function timeRangeChipLabel(tr) {
  const labels = {
    "3d": "3 dias",
    "1w": "1 semana",
    "2w": "2 semanas",
    "1m": "1 mes",
  };
  return labels[tr] || labels["1w"];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeSelectorValue(value) {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeTextKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");
}

function weatherConditionIcon(value) {
  switch (normalizeTextKey(value)) {
    case "clear_night":
      return "mdi:weather-night";
    case "cloudy":
      return "mdi:weather-cloudy";
    case "exceptional":
      return "mdi:alert-circle-outline";
    case "fog":
      return "mdi:weather-fog";
    case "hail":
      return "mdi:weather-hail";
    case "lightning":
      return "mdi:weather-lightning";
    case "lightning_rainy":
      return "mdi:weather-lightning-rainy";
    case "partlycloudy":
      return "mdi:weather-partly-cloudy";
    case "pouring":
      return "mdi:weather-pouring";
    case "rainy":
      return "mdi:weather-rainy";
    case "snowy":
      return "mdi:weather-snowy";
    case "snowy_rainy":
      return "mdi:weather-snowy-rainy";
    case "sunny":
      return "mdi:weather-sunny";
    case "windy":
    case "windy_variant":
      return "mdi:weather-windy";
    default:
      return "mdi:weather-partly-cloudy";
  }
}

function forecastDayKey(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const parsedNum = new Date(ms);
    if (!Number.isNaN(parsedNum.getTime())) {
      return `${parsedNum.getFullYear()}-${parsedNum.getMonth()}-${parsedNum.getDate()}`;
    }
  }
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  if (/^\d{10,13}$/.test(raw)) {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      const ms = raw.length >= 13 ? numeric : numeric * 1000;
      const parsedNum = new Date(ms);
      if (!Number.isNaN(parsedNum.getTime())) {
        return `${parsedNum.getFullYear()}-${parsedNum.getMonth()}-${parsedNum.getDate()}`;
      }
    }
  }
  const datePrefixMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (datePrefixMatch) {
    const y = Number(datePrefixMatch[1]);
    const m = Number(datePrefixMatch[2]) - 1;
    const d = Number(datePrefixMatch[3]);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return `${y}-${m}-${d}`;
    }
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return `${parsed.getFullYear()}-${parsed.getMonth()}-${parsed.getDate()}`;
}

function withForecastDateFromKey(key, value) {
  if (!value || typeof value !== "object" || !forecastDayKey(key)) {
    return value;
  }
  if ("datetime" in value || "date" in value || "day" in value || "time" in value || "timestamp" in value) {
    return value;
  }
  return { date: key, ...value };
}

function pickFirstFiniteNumber(...candidates) {
  for (const candidate of candidates) {
    const n = Number(candidate);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

function weatherSupportedFeature(state, feature) {
  return Boolean((Number(state?.attributes?.supported_features) || 0) & feature);
}

function supportedWeatherForecastTypes(state) {
  const types = [];
  if (weatherSupportedFeature(state, 1)) {
    types.push("daily");
  }
  if (weatherSupportedFeature(state, 4)) {
    types.push("twice_daily");
  }
  if (weatherSupportedFeature(state, 2)) {
    types.push("hourly");
  }
  return types.length ? types : ["daily", "twice_daily", "hourly"];
}

function resolveEditorColorValue(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue || typeof document === "undefined") {
    return "";
  }

  const probe = document.createElement("span");
  probe.style.position = "fixed";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  probe.style.color = "";
  probe.style.color = rawValue;
  if (!probe.style.color) {
    return rawValue;
  }

  (document.body || document.documentElement).appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || rawValue;
}

function formatEditorHexChannel(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function formatEditorColorFromHex(hex, alpha = 1) {
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

function getEditorColorModel(value, fallbackValue = "#71c0ff") {
  const sourceValue = String(value ?? "").trim() || String(fallbackValue ?? "").trim() || "#71c0ff";
  const resolvedValue = resolveEditorColorValue(sourceValue) || resolveEditorColorValue(fallbackValue) || "rgb(113, 192, 255)";
  const channels = resolvedValue.match(/[\d.]+/g) || [];
  const red = clamp(Math.round(Number(channels[0] ?? 113)), 0, 255);
  const green = clamp(Math.round(Number(channels[1] ?? 192)), 0, 255);
  const blue = clamp(Math.round(Number(channels[2] ?? 255)), 0, 255);
  const alpha = channels.length > 3 ? clamp(Number(channels[3]), 0, 1) : 1;
  const hex = `#${formatEditorHexChannel(red)}${formatEditorHexChannel(green)}${formatEditorHexChannel(blue)}`;

  return {
    alpha,
    hex,
    resolved: resolvedValue,
    source: sourceValue,
    value: formatEditorColorFromHex(hex, alpha),
  };
}

function getEditorColorFallbackValue(field) {
  const normalizedField = String(field ?? "");
  if (normalizedField.endsWith("styles.card.background")) {
    return DEFAULT_CONFIG.styles.card.background;
  }
  if (normalizedField.endsWith("styles.icon.background")) {
    return DEFAULT_CONFIG.styles.icon.background;
  }
  if (normalizedField.endsWith("styles.icon.on_color")) {
    return DEFAULT_CONFIG.styles.icon.on_color;
  }
  if (normalizedField.endsWith("styles.icon.off_color")) {
    return DEFAULT_CONFIG.styles.icon.off_color;
  }
  if (normalizedField.endsWith("styles.tint.color")) {
    return DEFAULT_CONFIG.styles.tint.color;
  }
  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }
  return "var(--info-color, #71c0ff)";
}

function formatDateLabel(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatTimeLabel(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeCalendarFetchResult(raw) {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw && typeof raw === "object" && Array.isArray(raw.events)) {
    return raw.events;
  }
  return [];
}

function eventIsAllDay(event) {
  return Boolean(event?.start?.date && !event?.start?.dateTime);
}

function completionPayloadNeedsEvents(raw) {
  const value = String(raw ?? "").trim();
  return (
    value.startsWith("v2:") ||
    value.startsWith("v3:") ||
    value.startsWith("v4:") ||
    value.startsWith("v5:") ||
    value.startsWith("v6:")
  );
}

function parseDateInputAsLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function dateInputIsBeforeToday(value) {
  const parsed = parseDateInputAsLocalDate(value);
  if (!parsed) {
    return false;
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parsed.getTime() < today.getTime();
}

class NodaliaCalendarCard extends HTMLElement {
  static getStubConfig() {
    return deepClone(DEFAULT_CONFIG);
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(DEFAULT_CONFIG);
    this._hass = null;
    this._events = [];
    this._loading = false;
    this._error = "";
    this._refreshTimer = 0;
    this._completed = new Set();
    this._hadHass = false;
    this._lastRenderSignature = "";
    this._calendarEntrancePlayed = false;
    /** Evita repetir la animación del panel expandido en cada re-render (p. ej. al marcar hecho). */
    this._expandedOverlayEntrancePlayed = false;
    this._expandedOpen = false;
    this._nativeEventComposerOpen = false;
    this._nativeComposerError = "";
    this._nativeComposerCalendarValue = "";
    /** Month popup: `Y-M-D` (M 0–11) when a single-day view is open; empty string = full month grid */
    this._expandedMonthDayKey = "";
    this._expandedEventDetailKey = "";
    this._completeExitKeys = new Set();
    this._completeExitTimers = new Map();
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowKeydown = this._onShadowKeydown.bind(this);
    this._onDocVisibility = this._onDocVisibility.bind(this);
    this._lastSubmittedSharedCompletedValue = "";
    /** Evita que un push de hass con estado antiguo pise _completed mientras set_value aún no refleja en el helper. */
    this._pendingSharedCompletedPayload = null;
    this._lastSyncedSharedCompletedRaw = undefined;
    this._completedMergedOnce = false;
    /** `localStorage` tiene `v2:` pero aún no hay `_events`; solo sin helper HA se re-expande al refrescar. */
    this._localV2PendingDecode = false;
    this._viewVisibilityObserver = null;
    this._wasInViewport = false;
    this._weatherForecastByDay = new Map();
    this._weatherForecastEvents = {};
    this._weatherForecastSubscription = null;
    this._weatherForecastSubscriptionKey = "";
    this._refreshInFlight = false;
    this._refreshQueued = false;
    this._renderVisibleEventsCache = null;
  }

  _onDocVisibility() {
    if (typeof document === "undefined" || document.visibilityState !== "visible") {
      return;
    }
    if (!this._hass || !(this._config.calendars || []).some(c => c && c.entity)) {
      return;
    }
    this._refreshEvents();
  }

  async _fetchCalendarEventsViaRest(entityId, start, end) {
    const hass = this._hass;
    if (!hass?.auth?.fetchWithAuth || typeof hass.auth.fetchWithAuth !== "function") {
      return [];
    }
    const qs = `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
    try {
      const response = await hass.auth.fetchWithAuth(
        `/api/calendars/${encodeURIComponent(entityId)}?${qs}`,
      );
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return normalizeCalendarFetchResult(data);
    } catch (_error) {
      return [];
    }
  }

  _shouldShowEventInList(event) {
    const config = this._config;
    const key = completionKey(event);
    const done = this._completed.has(key);
    return config.show_completed || !done || this._completeExitKeys.has(key);
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    this.shadowRoot?.addEventListener("keydown", this._onShadowKeydown);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this._onDocVisibility);
    }
    this._attachViewVisibilityObserver();
    // Replay entrance animation whenever the card is re-attached to the dashboard view.
    this._calendarEntrancePlayed = false;
    if (this._hadHass) {
      this._renderIfChanged(true);
    }
    this._loadCompleted();
    this._ensureWeatherForecastSubscription();
    this._refreshEvents();
  }

  disconnectedCallback() {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this._onDocVisibility);
    }
    this._detachViewVisibilityObserver();
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
    this.shadowRoot?.removeEventListener("keydown", this._onShadowKeydown);
    if (this._refreshTimer) {
      window.clearTimeout(this._refreshTimer);
      this._refreshTimer = 0;
    }
    this._completeExitTimers.forEach(tid => window.clearTimeout(tid));
    this._completeExitTimers.clear();
    this._completeExitKeys.clear();
    this._calendarEntrancePlayed = false;
    this._wasInViewport = false;
    this._unsubscribeWeatherForecast();
  }

  _attachViewVisibilityObserver() {
    if (this._viewVisibilityObserver || typeof IntersectionObserver !== "function") {
      return;
    }
    this._viewVisibilityObserver = new IntersectionObserver(
      entries => {
        const visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0);
        if (visible === this._wasInViewport) {
          return;
        }
        this._wasInViewport = visible;
        if (!visible) {
          return;
        }
        // When HA keeps the card mounted but hidden between view switches, replay entrance on return.
        this._calendarEntrancePlayed = false;
        this._renderIfChanged(true);
      },
      { threshold: [0, 0.01] },
    );
    this._viewVisibilityObserver.observe(this);
  }

  _detachViewVisibilityObserver() {
    if (!this._viewVisibilityObserver) {
      return;
    }
    this._viewVisibilityObserver.disconnect();
    this._viewVisibilityObserver = null;
  }

  setConfig(config) {
    const prevHelper = this._getSharedCompletedEntityIds(String(this._config?.shared_completed_events_entity || "").trim()).join("|");
    const prevWebhook = String(this._config?.shared_completed_events_webhook || "").trim();
    const prevWeatherEntity = this._getWeatherEntityId();
    this._config = normalizeConfig(config);
    const nextWeatherEntity = this._getWeatherEntityId();
    if (prevWeatherEntity !== nextWeatherEntity) {
      this._unsubscribeWeatherForecast();
      this._weatherForecastByDay = new Map();
      this._weatherForecastEvents = {};
    }
    const nextHelper = this._getSharedCompletedEntityIds(String(this._config.shared_completed_events_entity || "").trim()).join("|");
    const nextWebhook = String(this._config.shared_completed_events_webhook || "").trim();
    if (prevHelper !== nextHelper || prevWebhook !== nextWebhook) {
      this._completedMergedOnce = false;
      this._lastSyncedSharedCompletedRaw = undefined;
      this._lastSubmittedSharedCompletedValue = "";
      this._pendingSharedCompletedPayload = null;
    }
    this._loadCompleted();
    if (this._hass && this._getSharedCompletedEntityId()) {
      this._syncCompletedPersistenceFromHass();
    }
    this._ensureWeatherForecastSubscription();
    this._refreshEvents();
  }

  _getSharedCompletedEntityIds(fallbackSingle) {
    const explicit = normalizeSharedCompletedEntities(this._config?.shared_completed_events_entities);
    if (explicit.length) {
      return explicit;
    }
    const legacy = normalizeSharedCompletedEntities([
      this._config?.shared_completed_events_entity,
      this._config?.shared_completed_events_entity_2,
      this._config?.shared_completed_events_entity_3,
      this._config?.shared_completed_events_entity_4,
      fallbackSingle,
    ]);
    return legacy;
  }

  _getSharedCompletedEntityId() {
    return this._getSharedCompletedEntityIds()[0] || "";
  }

  _getSharedCompletedPersistenceSignature() {
    const ids = this._getSharedCompletedEntityIds();
    if (!ids.length || !this._hass?.states) {
      return "";
    }
    return ids
      .map(id => {
        const st = this._hass.states[id];
        const maxLen = Number(st?.attributes?.max);
        return `${id}\u001f${String(st?.state ?? "")}\u001f${Number.isFinite(maxLen) ? maxLen : 0}`;
      })
      .join("\u001e");
  }

  _getSharedCompletedMaxLength() {
    const ids = this._getSharedCompletedEntityIds();
    if (!ids.length) {
      return 255;
    }
    return ids.reduce((acc, id) => {
      const max = Number(this._hass?.states?.[id]?.attributes?.max);
      return acc + (Number.isFinite(max) && max > 0 ? max : 255);
    }, 0);
  }

  _readLocalCompletionRaw() {
    if (typeof window === "undefined" || !window.localStorage) {
      return "";
    }
    try {
      return window.localStorage.getItem(COMPLETION_STORAGE_KEY) || "";
    } catch (_error) {
      return "";
    }
  }

  _packSharedCompletedPayloadForEntities(payload, entityIds) {
    const ids = Array.isArray(entityIds) ? entityIds : [];
    const cleanPayload = String(payload ?? "").trim();
    if (!cleanPayload || !ids.length) {
      return [];
    }
    if (ids.length === 1) {
      return [cleanPayload];
    }
    let offset = 0;
    const chunks = [];
    ids.forEach((id, index) => {
      const maxLen = Number(this._hass?.states?.[id]?.attributes?.max);
      const limit = Number.isFinite(maxLen) && maxLen > 0 ? maxLen : 255;
      const prefix = `v6p:${index + 1}/${ids.length}:`;
      const available = Math.max(0, limit - prefix.length);
      const part = available > 0 ? cleanPayload.slice(offset, offset + available) : "";
      offset += part.length;
      chunks.push(`${prefix}${part}`);
    });
    return offset >= cleanPayload.length ? chunks : [];
  }

  _readSharedCompletedPayloadFromHass() {
    const ids = this._getSharedCompletedEntityIds();
    if (!ids.length || !this._hass?.states) {
      return "";
    }
    if (ids.length === 1) {
      return String(this._hass.states[ids[0]]?.state ?? "");
    }
    const parts = [];
    let totalExpected = ids.length;
    ids.forEach(id => {
      const raw = String(this._hass.states[id]?.state ?? "").trim();
      const m = /^v6p:(\d+)\/(\d+):(.*)$/s.exec(raw);
      if (m) {
        const idx = Number(m[1]);
        const total = Number(m[2]);
        if (Number.isFinite(total) && total > 0) {
          totalExpected = total;
        }
        if (Number.isFinite(idx) && idx > 0) {
          parts[idx - 1] = m[3] || "";
        }
        return;
      }
      if (!parts.length && raw) {
        parts[0] = raw;
      }
    });
    if (parts.length && parts.filter(part => part !== undefined).length >= totalExpected) {
      return parts.slice(0, totalExpected).join("");
    }
    return parts[0] || "";
  }

  _syncCompletedPersistenceFromHass() {
    const ids = this._getSharedCompletedEntityIds();
    if (!ids.length || !this._hass?.states) {
      return;
    }
    const raw = String(this._readSharedCompletedPayloadFromHass() ?? "");
    if (["unknown", "unavailable"].includes(raw)) {
      return;
    }

    if (raw === this._lastSyncedSharedCompletedRaw) {
      return;
    }

    const events = this._events || [];
    const localRaw = this._readLocalCompletionRaw();
    const rawT = raw.trim();
    const localT = localRaw.trim();
    if (!events.length && (completionPayloadNeedsEvents(rawT) || completionPayloadNeedsEvents(localT))) {
      return;
    }

    const incomingKeys = expandCompletionPayloadToKeys(raw, events);
    const incomingCanonical = canonicalCompletionKeysJson(incomingKeys);

    const localKeys = expandCompletionPayloadToKeys(localRaw, events);
    const localCanonical = canonicalCompletionKeysJson(localKeys);

    const memoryCanonical = canonicalCompletionKeysJson([...this._completed]);

    if (
      this._pendingSharedCompletedPayload &&
      incomingCanonical !== this._pendingSharedCompletedPayload &&
      incomingCanonical !== memoryCanonical &&
      incomingCanonical !== localCanonical
    ) {
      return;
    }
    if (
      this._pendingSharedCompletedPayload &&
      incomingCanonical === this._pendingSharedCompletedPayload
    ) {
      this._pendingSharedCompletedPayload = null;
    }

    this._lastSyncedSharedCompletedRaw = raw;
    this._localV2PendingDecode = false;

    if (!this._completedMergedOnce) {
      this._completed = new Set([...localKeys, ...incomingKeys]);
      this._completedMergedOnce = true;
      this._saveCompleted();
      return;
    }

    this._completed = new Set(incomingKeys);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const payloadLs =
          pickShortestCompletionPayload(this._completed, events, 262144) ||
          canonicalCompletionKeysJson([...this._completed]);
        window.localStorage.setItem(COMPLETION_STORAGE_KEY, payloadLs);
      }
    } catch (_error) {
      // Ignore storage errors.
    }
  }

  _syncCompletedAfterEventsLoaded() {
    const events = this._events || [];
    if (this._localV2PendingDecode && events.length && !this._getSharedCompletedEntityId()) {
      const raw = this._readLocalCompletionRaw();
      this._completed = new Set(expandCompletionPayloadToKeys(raw, events));
      this._localV2PendingDecode = false;
    }
    if (this._getSharedCompletedEntityId()) {
      this._syncCompletedPersistenceFromHass();
    }
  }

  set hass(hass) {
    const hadHass = this._hadHass;
    const prevLocale = this._hass?.locale?.language;
    const prevLabelSig = hadHass ? this._getCalendarEntityLabelsSignature() : "";
    const prevSharedSig = hadHass ? this._getSharedCompletedPersistenceSignature() : "";
    this._hass = hass;
    if (!hass) {
      this._unsubscribeWeatherForecast();
      return;
    }
    this._ensureWeatherForecastSubscription();
    if (!hadHass) {
      this._hadHass = true;
      this._syncCompletedPersistenceFromHass();
      this._refreshEvents();
      return;
    }
    const nextSharedSig = this._getSharedCompletedPersistenceSignature();
    if (prevSharedSig !== nextSharedSig) {
      this._syncCompletedPersistenceFromHass();
      this._renderIfChanged(true);
    }
    const nextLabelSig = this._getCalendarEntityLabelsSignature();
    if (prevLocale !== hass.locale?.language || prevLabelSig !== nextLabelSig) {
      this._renderIfChanged(true);
    }
  }

  _getLocale() {
    return this._hass?.locale?.language || "es-ES";
  }

  _getCalendarEntityLabel(entityId) {
    const id = String(entityId ?? "").trim();
    if (!id) {
      return "";
    }
    const friendly = String(this._hass?.states?.[id]?.attributes?.friendly_name ?? "").trim();
    if (friendly) {
      return friendly;
    }
    const short = id.includes(".") ? id.slice(id.indexOf(".") + 1) : id;
    const humanized = short.replace(/_/g, " ").trim();
    return humanized || id;
  }

  _getCalendarEntityLabelsSignature() {
    const hass = this._hass;
    if (!hass?.states) {
      return "";
    }
    const ids = new Set([
      ...(this._config?.calendars || []).map(c => c?.entity).filter(Boolean),
      ...this._events.map(event => event._entity).filter(Boolean),
    ]);
    const meta = (this._config?.calendars || [])
      .map(c => `${c?.entity || ""}\u001f${c?.label || ""}\u001f${c?.tint || ""}`)
      .join("\u001e");
    return [
      [...ids]
        .sort()
        .map(id => {
          const friendly = String(hass.states[id]?.attributes?.friendly_name ?? "").trim();
          return `${id}\u001f${friendly}`;
        })
        .join("\u001e"),
      meta,
    ].join("\u001f\u001f");
  }

  _getAvailableNativeCalendarIds() {
    const configured = (this._config?.calendars || [])
      .map(c => String(c?.entity || "").trim())
      .filter(Boolean);
    if (configured.length) {
      return configured;
    }
    return Object.keys(this._hass?.states || {})
      .filter(id => id.startsWith("calendar."))
      .sort();
  }

  _getCalendarEntry(entityId) {
    const id = String(entityId ?? "").trim();
    const list = Array.isArray(this._config?.calendars) ? this._config.calendars : [];
    return list.find(c => c.entity === id) || { entity: id, label: "", tint: "" };
  }

  _getEventSubtitleForDisplay(entityId) {
    const entry = this._getCalendarEntry(entityId);
    if (entry.label) {
      return entry.label;
    }
    return this._getCalendarEntityLabel(entityId);
  }

  _getCalendarTintDotCss(entityId) {
    const tint = sanitizeCalendarTint(this._getCalendarEntry(entityId).tint);
    return tint || "var(--primary-color)";
  }

  _getEventTint(event) {
    const colorOverride = extractNodaliaEventColor(event?.description);
    if (colorOverride) {
      return colorOverride;
    }
    return sanitizeCalendarTint(this._getCalendarEntry(event?._entity).tint);
  }

  _capitalizeFirst(text) {
    const s = String(text ?? "").trim();
    if (!s) {
      return "";
    }
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  _renderWeatherBadge(dayDate, weatherByDay, className = "calendar-day__weather") {
    const w = this._getWeatherForDay(dayDate, weatherByDay);
    if (!w) {
      return "";
    }
    const icon = weatherConditionIcon(w?.condition);
    const minRaw = Number.isFinite(w?.tempMin) ? Math.round(w.tempMin) : null;
    const maxRaw = Number.isFinite(w?.tempMax) ? Math.round(w.tempMax) : null;
    const hasCondition = Boolean(String(w?.condition || "").trim());
    if (minRaw === null && maxRaw === null && !hasCondition) {
      return "";
    }
    const minText = minRaw === null ? "—" : `${minRaw}°`;
    const maxText = maxRaw === null ? "—" : `${maxRaw}°`;
    return `<div class="${escapeHtml(className)}"><ha-icon icon="${escapeHtml(icon)}"></ha-icon><span>${escapeHtml(minText)} / ${escapeHtml(maxText)}</span></div>`;
  }

  _renderExpandedMonthDayDetail(events, focusDate, config, locale, weatherByDay) {
    const sorted = [...events].sort((left, right) => {
      const a = eventDate(left?.start)?.getTime() || 0;
      const b = eventDate(right?.start)?.getTime() || 0;
      return a - b;
    });
    const longTitle = this._capitalizeFirst(
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(focusDate),
    );

    if (!sorted.length) {
      return `
        <div class="calendar-expanded__day-detail">
          <div class="calendar-expanded__day-detail-toolbar">
            <button type="button" class="calendar-expanded__day-back" data-action="month-day-back">
              <ha-icon icon="mdi:chevron-left"></ha-icon>
              <span>Mes</span>
            </button>
          </div>
          <div class="calendar-expanded__day-detail-heading">
            <div class="calendar-expanded__day-detail-title">${escapeHtml(longTitle)}</div>
            ${this._renderWeatherBadge(focusDate, weatherByDay, "calendar-expanded__weather")}
          </div>
          <div class="calendar-expanded__day-empty">Sin eventos este día.</div>
        </div>
      `;
    }

    const eventsHtml = sorted.map(ev => this._renderSingleEventHtml(ev, config, locale, { detailAction: true })).join("");

    return `
      <div class="calendar-expanded__day-detail">
        <div class="calendar-expanded__day-detail-toolbar">
          <button type="button" class="calendar-expanded__day-back" data-action="month-day-back">
            <ha-icon icon="mdi:chevron-left"></ha-icon>
            <span>Mes</span>
          </button>
        </div>
        <div class="calendar-expanded__day-detail-heading">
          <div class="calendar-expanded__day-detail-title">${escapeHtml(longTitle)}</div>
          ${this._renderWeatherBadge(focusDate, weatherByDay, "calendar-expanded__weather")}
        </div>
        <div class="calendar-expanded__day-detail-scroll">${eventsHtml}</div>
      </div>
    `;
  }

  _renderExpandedEventDetail(event, config, locale) {
    const start = eventDate(event?.start);
    const end = eventDate(event?.end);
    const summary = String(event?.summary || event?.message || "Evento sin titulo").trim();
    const subtitle = this._getEventSubtitleForDisplay(event?._entity);
    const timeLabel = eventIsAllDay(event)
      ? "Todo el dia"
      : start && end
        ? `${formatTimeLabel(start, locale)} - ${formatTimeLabel(end, locale)}`
        : start
          ? formatTimeLabel(start, locale)
          : "";
    const dayLabel = start
      ? this._capitalizeFirst(
        new Intl.DateTimeFormat(locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(start),
      )
      : "";
    const description = stripNodaliaEventMetadata(event?.description);
    const location = String(event?.location || "").trim();
    const rrule = String(event?.rrule || "").trim();
    const tint = this._getEventTint(event) || "var(--primary-color)";
    return `
      <div class="calendar-expanded__event-detail" style="--cal-detail-tint:${escapeHtml(tint)}">
        <div class="calendar-expanded__day-detail-toolbar">
          <button type="button" class="calendar-expanded__day-back" data-action="event-detail-back">
            <ha-icon icon="mdi:chevron-left"></ha-icon>
            <span>Volver</span>
          </button>
        </div>
        <div class="calendar-expanded__event-hero">
          <div class="calendar-expanded__event-title">${escapeHtml(summary)}</div>
          <div class="calendar-expanded__event-meta">
            ${dayLabel ? `<span><ha-icon icon="mdi:calendar"></ha-icon>${escapeHtml(dayLabel)}</span>` : ""}
            ${timeLabel ? `<span><ha-icon icon="mdi:clock-outline"></ha-icon>${escapeHtml(timeLabel)}</span>` : ""}
            ${subtitle ? `<span><ha-icon icon="mdi:calendar-blank"></ha-icon>${escapeHtml(subtitle)}</span>` : ""}
          </div>
        </div>
        <div class="calendar-expanded__event-sections">
          ${
            description
              ? `<section class="calendar-expanded__event-section">
                  <div class="calendar-expanded__event-section-title">Descripcion</div>
                  <div class="calendar-expanded__event-section-body">${escapeHtml(description).replace(/\n/g, "<br>")}</div>
                </section>`
              : ""
          }
          ${
            location
              ? `<section class="calendar-expanded__event-section">
                  <div class="calendar-expanded__event-section-title">Ubicacion</div>
                  <div class="calendar-expanded__event-section-body">${escapeHtml(location)}</div>
                </section>`
              : ""
          }
          ${
            rrule
              ? `<section class="calendar-expanded__event-section">
                  <div class="calendar-expanded__event-section-title">Repeticion</div>
                  <div class="calendar-expanded__event-section-body">${escapeHtml(rrule)}</div>
                </section>`
              : ""
          }
          ${
            !description && !location && !rrule
              ? `<div class="calendar-expanded__day-empty">Este evento no tiene descripcion ni ubicacion.</div>`
              : ""
          }
        </div>
      </div>
    `;
  }

  _expandedLayoutKind(timeRange) {
    const tr = timeRange || DEFAULT_CONFIG.time_range;
    if (tr === "3d") {
      return "column";
    }
    if (tr === "1m") {
      return "month";
    }
    return "horizontal";
  }

  _groupsByDayKey(groups) {
    const map = new Map();
    groups.forEach(group => {
      const ev = group.events[0];
      const d = ev ? eventDate(ev.start) : null;
      if (d) {
        map.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, group);
      }
    });
    return map;
  }

  _weekdayHeadersMondayFirst(locale) {
    const refMonday = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(refMonday.getTime() + i * 86400000);
      return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
    });
  }

  _renderSingleEventHtml(event, config, locale, options = {}) {
    const compact = options.compact === true;
    const detailAction = options.detailAction === true;
    const doneKey = completionKey(event);
    const done = this._completed.has(doneKey);
    const start = eventDate(event.start);
    const timeLabel = eventIsAllDay(event)
      ? "Todo el dia"
      : start
        ? formatTimeLabel(start, locale)
        : "--:--";
    const summary = String(event.summary || event.message || "Evento sin titulo");
    const subtitle = this._getEventSubtitleForDisplay(event._entity);
    const tintRaw = this._getEventTint(event);
    const tintClass = tintRaw ? " calendar-event--tinted" : "";
    const tintStyle = tintRaw ? ` style="--cal-tint:${escapeHtml(tintRaw)}"` : "";
    const compactClass = compact ? " calendar-event--compact" : "";
    const detailClass = detailAction ? " calendar-event--detail-link" : "";
    const detailAttrs = detailAction
      ? ` data-action="open-event-detail" data-key="${escapeHtml(doneKey)}" role="button" tabindex="0"`
      : "";
    const exiting = this._completeExitKeys.has(doneKey);
    const exitClass = exiting ? " calendar-event--exit" : "";
    return `
      <div class="calendar-event ${done ? "is-completed" : ""}${tintClass}${compactClass}${detailClass}${exitClass}"${detailAttrs}${tintStyle}>
        <div class="calendar-event__time">${escapeHtml(timeLabel)}</div>
        <div class="calendar-event__summary">
          ${escapeHtml(summary)}
          ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}
        </div>
        ${
          config.allow_complete
            ? `<button type="button" class="calendar-event__done" data-action="toggle-complete" data-key="${escapeHtml(doneKey)}">${done ? "Hecho" : "Marcar"}</button>`
            : ""
        }
      </div>
    `;
  }

  _renderExpandedBody(groups, config, locale, weatherByDay) {
    const tr = config.time_range || DEFAULT_CONFIG.time_range;
    const mode = this._expandedLayoutKind(tr);
    if (this._expandedEventDetailKey) {
      const detailEvent = groups
        .flatMap(group => Array.isArray(group?.events) ? group.events : [])
        .find(event => completionKey(event) === this._expandedEventDetailKey);
      if (detailEvent) {
        return this._renderExpandedEventDetail(detailEvent, config, locale);
      }
      this._expandedEventDetailKey = "";
    }
    if (mode === "month") {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      const daysInMonth = last.getDate();
      const leading = (first.getDay() + 6) % 7;
      const map = this._groupsByDayKey(groups);
      const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(first);
      const headers = this._weekdayHeadersMondayFirst(locale);
      const cells = [];
      for (let i = 0; i < leading; i += 1) {
        cells.push({ kind: "pad" });
      }
      for (let d = 1; d <= daysInMonth; d += 1) {
        cells.push({ kind: "day", day: d, date: new Date(y, m, d) });
      }
      while (cells.length % 7 !== 0) {
        cells.push({ kind: "pad" });
      }

      if (this._expandedMonthDayKey) {
        const group = map.get(this._expandedMonthDayKey);
        const rawParts = String(this._expandedMonthDayKey).split("-");
        const py = Number(rawParts[0]);
        const pm = Number(rawParts[1]);
        const pd = Number(rawParts[2]);
        if (
          Number.isFinite(py) &&
          Number.isFinite(pm) &&
          Number.isFinite(pd) &&
          py === y &&
          pm === m &&
          rawParts.length === 3
        ) {
          const focusDate = new Date(py, pm, pd);
          const dayEvents = Array.isArray(group?.events) ? group.events : [];
          return this._renderExpandedMonthDayDetail(dayEvents, focusDate, config, locale, weatherByDay);
        }
        this._expandedMonthDayKey = "";
      }

      return `
        <div class="calendar-expanded__month">
          <div class="calendar-expanded__month-banner">${escapeHtml(title)}</div>
          <div class="calendar-expanded__month-matrix-wrap">
            <div class="calendar-expanded__month-matrix">
              <div class="calendar-expanded__month-weekdays">
                ${headers.map(h => `<div class="calendar-expanded__month-weekday">${escapeHtml(h)}</div>`).join("")}
              </div>
              <div class="calendar-expanded__month-grid">
                ${cells
                  .map(cell => {
                    if (cell.kind === "pad") {
                      return `<div class="calendar-expanded__month-cell calendar-expanded__month-cell--pad"></div>`;
                    }
                    const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
                    const group = map.get(key);
                    let monthPeekInner = "";
                    if (group?.events?.length) {
                      const sortedDay = [...group.events].sort((a, b) => {
                        const ta = eventDate(a?.start)?.getTime() || 0;
                        const tb = eventDate(b?.start)?.getTime() || 0;
                        return ta - tb;
                      });
                      const headEv = sortedDay[0];
                      const tail = sortedDay.slice(1);
                      monthPeekInner += this._renderSingleEventHtml(headEv, config, locale, { compact: true });
                      if (tail.length) {
                        monthPeekInner += `<div class="calendar-expanded__month-cell-dots">${tail
                          .map(ev => {
                            const tint = this._getEventTint(ev) || this._getCalendarTintDotCss(ev._entity);
                            const summary = String(ev.summary || ev.message || "").trim();
                            const hint = summary || this._getEventSubtitleForDisplay(ev._entity);
                            return `<span class="calendar-expanded__month-cell-dot" style="--cal-dot:${escapeHtml(tint)}" title="${escapeHtml(hint)}"></span>`;
                          })
                          .join("")}</div>`;
                      }
                    }
                    return `
                      <div
                        class="calendar-expanded__month-cell calendar-expanded__month-cell--day"
                        data-action="open-month-day"
                        data-day-key="${escapeHtml(key)}"
                        role="button"
                        tabindex="0"
                      >
                        <div class="calendar-expanded__month-cell-head">
                          <div class="calendar-expanded__month-daynum">${cell.day}</div>
                          ${this._renderWeatherBadge(cell.date, weatherByDay, "calendar-expanded__month-weather")}
                        </div>
                        <div class="calendar-expanded__month-events calendar-expanded__month-events--month-grid">
                          ${monthPeekInner}
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          </div>
        </div>
      `;
    }
    const rowClass = mode === "column" ? "calendar-expanded__column" : "calendar-expanded__horizontal";
    return `
      <div class="${rowClass}">
        ${groups
          .map(
            group => `
          <div class="calendar-expanded__col">
            <div class="calendar-expanded__col-head">
              <div class="calendar-expanded__col-label">${escapeHtml(group.label)}</div>
              ${this._renderWeatherBadge(group.dayDate, weatherByDay, "calendar-expanded__weather")}
            </div>
            <div class="calendar-expanded__col-events">
              ${group.events.map(ev => this._renderSingleEventHtml(ev, config, locale, { detailAction: true })).join("")}
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  _loadCompleted() {
    const raw = this._readLocalCompletionRaw();
    try {
      const v = JSON.parse(raw);
      if (Array.isArray(v)) {
        this._completed = new Set(v.map(k => String(k)));
        this._localV2PendingDecode = false;
        return;
      }
    } catch (_error) {
      // Legacy JSON or compact v2.
    }
    if (completionPayloadNeedsEvents(raw)) {
      this._completed = new Set();
      this._localV2PendingDecode = true;
      return;
    }
    this._completed = new Set();
    this._localV2PendingDecode = false;
  }

  _saveCompleted() {
    const events = this._events || [];
    const canonicalExpanded = canonicalCompletionKeysJson([...this._completed]);

    const payloadLs =
      pickShortestCompletionPayload(this._completed, events, 262144) || canonicalExpanded;

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(COMPLETION_STORAGE_KEY, payloadLs);
      } catch (_error) {
        // Ignore storage errors.
      }
    }

    const webhookId = String(this._config?.shared_completed_events_webhook ?? "").trim();
    const entityIds = this._getSharedCompletedEntityIds();

    if (!webhookId && (!entityIds.length || !this._hass?.callService)) {
      return;
    }

    const maxLen = this._getSharedCompletedMaxLength();
    const payloadHa = pickShortestCompletionPayload(this._completed, events, maxLen);
    if (!payloadHa) {
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn(
          "Nodalia Calendar Card: la lista de eventos completados no cabe en los input_text configurados ni en formatos compactos v6/v5/v4/v3/v2.",
        );
      }
      return;
    }

    const currentState = this._readSharedCompletedPayloadFromHass().trim();
    const canonicalCurrent = normalizeCompletionPayloadForCompare(currentState, events);
    const canonicalLastSubmit = normalizeCompletionPayloadForCompare(this._lastSubmittedSharedCompletedValue, events);
    if (canonicalCurrent !== null && canonicalExpanded === canonicalCurrent) {
      return;
    }
    if (canonicalLastSubmit !== null && canonicalExpanded === canonicalLastSubmit) {
      return;
    }

    if (webhookId) {
      const post =
        typeof window !== "undefined" && window.NodaliaUtils && typeof window.NodaliaUtils.postHomeAssistantWebhook === "function"
          ? window.NodaliaUtils.postHomeAssistantWebhook
          : null;
      if (!post) {
        if (typeof console !== "undefined" && typeof console.warn === "function") {
          console.warn(
            "Nodalia Calendar Card: falta NodaliaUtils.postHomeAssistantWebhook (actualiza nodalia-cards / nodalia-utils).",
          );
        }
        return;
      }
      this._lastSubmittedSharedCompletedValue = payloadHa;
      this._pendingSharedCompletedPayload = canonicalExpanded;
      void post(webhookId, { value: payloadHa }, this._hass).then(ok => {
        if (!ok) {
          this._lastSubmittedSharedCompletedValue = null;
          this._pendingSharedCompletedPayload = null;
          if (typeof console !== "undefined" && typeof console.warn === "function") {
            console.warn(
              "Nodalia Calendar Card: webhook de persistencia rechazado o fallido; revisa el webhook_id y la automatización en HA.",
            );
          }
        }
      });
      return;
    }

    const packedForEntities = this._packSharedCompletedPayloadForEntities(payloadHa, entityIds);
    if (entityIds.length && !packedForEntities.length) {
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn(
          "Nodalia Calendar Card: payload no cabe en el reparto multi-helper; revisa max en input_text o reduce completados.",
        );
      }
      return;
    }
    this._lastSubmittedSharedCompletedValue = payloadHa;
    this._pendingSharedCompletedPayload = canonicalExpanded;

    try {
      const writes = (entityIds.length ? entityIds : [])
        .map((id, idx) => ({ id, value: packedForEntities[idx] || "" }))
        .filter(item => item.id && item.value);
      Promise.all(
        writes.map(item =>
          this._hass.callService("input_text", "set_value", {
            entity_id: item.id,
            value: item.value,
          }),
        ),
      ).catch(err => {
        this._lastSubmittedSharedCompletedValue = null;
        this._pendingSharedCompletedPayload = null;
        if (typeof console !== "undefined" && typeof console.warn === "function") {
          console.warn("Nodalia Calendar Card: input_text.set_value failed", err);
          console.warn(
            "Nodalia Calendar Card: concede permiso de control sobre los input_text o usa shared_completed_events_webhook.",
          );
        }
      });
    } catch (err) {
      this._lastSubmittedSharedCompletedValue = null;
      this._pendingSharedCompletedPayload = null;
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn("Nodalia Calendar Card: input_text.set_value failed", err);
        console.warn(
          "Nodalia Calendar Card: si usas un usuario no administrador, concede permiso de control sobre la entidad input_text del helper o usa shared_completed_events_webhook.",
        );
      }
    }
  }

  _scheduleRefresh() {
    if (this._refreshTimer) {
      window.clearTimeout(this._refreshTimer);
      this._refreshTimer = 0;
    }
    this._refreshTimer = window.setTimeout(() => {
      this._refreshTimer = 0;
      this._refreshEvents();
    }, this._config.refresh_interval * 1000);
  }

  _getRenderSignature() {
    const config = this._config;
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const visibleEvents = this._events.filter(event => this._shouldShowEventInList(event));
    this._renderVisibleEventsCache = visibleEvents;
    let hash = 2166136261;
    const mix = value => {
      const text = value === null || value === undefined ? "" : String(value);
      for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
      }
      hash = Math.imul(hash ^ 0x9e3779b9, 16777619) >>> 0;
    };
    (config.calendars || []).forEach(c => {
      mix(c?.entity || "");
      mix(c?.label || "");
      mix(c?.tint || "");
    });
    mix(config.title);
    mix(config.icon);
    mix(config.time_range || DEFAULT_CONFIG.time_range);
    mix(config.days_to_show);
    mix(config.max_visible_events);
    mix(config.show_completed ? 1 : 0);
    mix(config.allow_complete ? 1 : 0);
    mix(config.weather_entity || "");
    mix(config.shared_completed_events_entity || "");
    mix(config.shared_completed_events_entity_2 || "");
    mix(config.shared_completed_events_entity_3 || "");
    mix(config.shared_completed_events_entity_4 || "");
    mix((config.shared_completed_events_entities || []).join(","));
    mix(config.shared_completed_events_webhook || "");
    mix(config.native_event_webhook || "");
    mix(config.security?.allow_webhooks_for_non_admin ? 1 : 0);
    mix(config.tint_auto ? 1 : 0);
    mix(config.animations?.enabled ? 1 : 0);
    mix(config.animations?.content_duration);
    mix(styles.card?.background);
    mix(styles.card?.border);
    mix(styles.card?.border_radius);
    mix(styles.card?.box_shadow);
    mix(styles.card?.padding);
    mix(styles.card?.gap);
    mix(styles.title_size);
    mix(styles.event_size);
    mix(styles.chip_height);
    mix(styles.chip_font_size);
    mix(styles.chip_padding);
    mix(styles.chip_size);
    mix(styles.icon?.background);
    mix(styles.icon?.on_color);
    mix(styles.icon?.off_color);
    mix(styles.icon?.size);
    mix(styles.tint?.color);
    mix(this._getLocale());
    mix(this._loading ? 1 : 0);
    mix(this._error);
    mix(this._getWeatherForecastSignature());
    visibleEvents.forEach(event => {
      mix(completionKey(event));
      mix(eventDate(event?.start)?.getTime() || 0);
      mix(event?.description || "");
      mix(event?.location || "");
      mix(event?.rrule || "");
    });
    this._completed.forEach(key => mix(key));
    mix(this._expandedOpen ? 1 : 0);
    mix(this._expandedMonthDayKey || "");
    mix(this._expandedEventDetailKey || "");
    mix(this._nativeComposerError || "");
    this._completeExitKeys.forEach(key => mix(key));
    return `r:${hash.toString(36)}`;
  }

  _renderIfChanged(force = false) {
    const next = this._getRenderSignature();
    if (!force && next === this._lastRenderSignature) {
      return;
    }
    this._lastRenderSignature = next;
    this._render();
  }

  async _refreshEvents() {
    if (this._refreshInFlight) {
      this._refreshQueued = true;
      return;
    }
    this._refreshInFlight = true;
    this._refreshQueued = false;
    const calendarIds = (this._config.calendars || []).map(c => c.entity).filter(Boolean);
    try {
      if (!this._hass) {
        this._events = [];
        this._weatherForecastByDay = new Map();
        this._loading = false;
        this._error = "";
        this._renderIfChanged(true);
        return;
      }
      if (!calendarIds.length) {
        this._events = [];
        await this._refreshWeatherForecastByDay();
        this._loading = false;
        this._error = "";
        this._syncCompletedAfterEventsLoaded();
        this._renderIfChanged(true);
        return;
      }
      this._loading = true;
      this._error = "";
      this._renderIfChanged(true);
      const hass = this._hass;
      try {
        const start = new Date();
        const end = new Date(start.getTime() + this._config.days_to_show * 24 * 60 * 60 * 1000);
        const all = [];
        for (const entityId of calendarIds) {
          const path = `calendars/${encodeURIComponent(entityId)}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
          let rows = [];
          try {
            const raw = await hass.callApi("GET", path);
            rows = normalizeCalendarFetchResult(raw);
            // Solo REST fallback si sigue vacío *y* la respuesta no era ya un array JSON (p. ej. `{ events: [...] }`
            // normaliza bien pero no es array → el viejo `!Array.isArray(raw)` disparaba fetch duplicado).
            if (!rows.length && (raw === undefined || raw === null)) {
              const fallback = await this._fetchCalendarEventsViaRest(entityId, start, end);
              if (fallback.length) {
                rows = fallback;
              }
            }
          } catch (_apiError) {
            rows = await this._fetchCalendarEventsViaRest(entityId, start, end);
          }
          rows.forEach(item => all.push({ ...item, _entity: entityId }));
        }
        all.sort((left, right) => {
          const a = eventDate(left?.start)?.getTime() || 0;
          const b = eventDate(right?.start)?.getTime() || 0;
          return a - b;
        });
        this._events = all;
        await this._refreshWeatherForecastByDay();
      } catch (_error) {
        this._error = "No se pudieron cargar eventos del calendario.";
      } finally {
        this._loading = false;
        this._syncCompletedAfterEventsLoaded();
        this._renderIfChanged(true);
        this._scheduleRefresh();
      }
    } finally {
      this._refreshInFlight = false;
      if (this._refreshQueued) {
        this._refreshQueued = false;
        this._refreshEvents();
      }
    }
  }

  _toggleCompleted(key) {
    if (!key) {
      return;
    }
    const config = this._config;
    const exitMs = calendarExitDurationMs(config.animations?.content_duration);
    if (this._completed.has(key)) {
      const pending = this._completeExitTimers.get(key);
      if (pending) {
        window.clearTimeout(pending);
        this._completeExitTimers.delete(key);
      }
      this._completeExitKeys.delete(key);
      this._completed.delete(key);
      this._saveCompleted();
      this._renderIfChanged(true);
      return;
    }
    this._completed.add(key);
    this._saveCompleted();
    const shouldExitAnimate =
      config.animations?.enabled !== false && !config.show_completed && !this._completeExitKeys.has(key);
    if (!shouldExitAnimate) {
      this._renderIfChanged(true);
      return;
    }
    this._completeExitKeys.add(key);
    this._renderIfChanged(true);
    const tid = window.setTimeout(() => {
      this._completeExitTimers.delete(key);
      this._completeExitKeys.delete(key);
      this._renderIfChanged(true);
    }, exitMs);
    this._completeExitTimers.set(key, tid);
  }

  _groupEvents(events) {
    const locale = this._getLocale();
    const groups = new Map();
    events.forEach(event => {
      const date = eventDate(event.start);
      if (!date) {
        return;
      }
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          label: formatDateLabel(date, locale),
          dayKey: key,
          dayDate: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          events: [],
        });
      }
      groups.get(key).events.push(event);
    });
    return [...groups.values()];
  }

  _getWeatherEntityId() {
    const id = String(this._config?.weather_entity || "").trim();
    return id.startsWith("weather.") ? id : "";
  }

  _buildForecastDayMap(forecastRows) {
    const map = new Map();
    (Array.isArray(forecastRows) ? forecastRows : []).forEach(item => {
      if (!item || typeof item !== "object") {
        return;
      }
      const dayKey = forecastDayKey(item.datetime ?? item.date ?? item.day ?? item.time ?? item.timestamp ?? item.dt ?? "");
      if (!dayKey) {
        return;
      }
      const maxCandidate = pickFirstFiniteNumber(
        item.temperature,
        item.temperature_max,
        item.temp_max,
        item.temperatureHigh,
        item.temperature_high,
        item.tempHigh,
        item.temp_high,
        item.high,
        item.high_temp,
        item.maxtemp,
        item.max_temperature,
        item.max,
        item.max_temp,
        item.day_temp,
        item.native_temperature,
        item.native_temp,
        item.native_temperature_max,
        item.native_temp_max,
        item.temperature_2m_max,
        item.apparent_temperature_max,
      );
      const minCandidate = pickFirstFiniteNumber(
        item.templow,
        item.temperature_low,
        item.temp_low,
        item.temperatureLow,
        item.temperatureMin,
        item.temperature_min,
        item.tempMin,
        item.temp_min,
        item.low,
        item.low_temp,
        item.mintemp,
        item.min_temperature,
        item.min,
        item.min_temp,
        item.night_temp,
        item.native_templow,
        item.native_temp_low,
        item.native_temperature_low,
        item.native_temperature_min,
        item.native_temp_min,
        item.temperature_2m_min,
        item.apparent_temperature_min,
      );
      const condition = String(
        item.condition ??
          item.weather ??
          item.main ??
          item.state ??
          item.symbol ??
          "",
      ).trim();
      const existing = map.get(dayKey) || { condition: "", tempMax: null, tempMin: null };
      const temperatureCandidate = pickFirstFiniteNumber(item.temperature, item.native_temperature, item.native_temp);
      const canUsePointTemperatureAsLow =
        item._nodaliaForecastType === "hourly" || item._nodaliaForecastType === "twice_daily";
      const numericForHigh = Number.isFinite(maxCandidate) ? maxCandidate : temperatureCandidate;
      const numericForLow = Number.isFinite(minCandidate)
        ? minCandidate
        : (canUsePointTemperatureAsLow ? temperatureCandidate : null);
      const nextMax = Number.isFinite(numericForHigh)
        ? (Number.isFinite(existing.tempMax) ? Math.max(existing.tempMax, numericForHigh) : numericForHigh)
        : existing.tempMax;
      const nextMin = Number.isFinite(numericForLow)
        ? (Number.isFinite(existing.tempMin) ? Math.min(existing.tempMin, numericForLow) : numericForLow)
        : existing.tempMin;
      map.set(dayKey, {
        condition: existing.condition || condition,
        tempMax: nextMax,
        tempMin: nextMin,
      });
    });
    return map;
  }

  _tagForecastRows(rows, forecastType = "") {
    const normalized = this._normalizeForecastRows(rows);
    const type = String(forecastType || "").trim();
    if (!type) {
      return normalized;
    }
    return normalized.map(item => (
      item && typeof item === "object" ? { ...item, _nodaliaForecastType: type } : item
    ));
  }

  _scoreForecastMap(forecastMap) {
    if (!(forecastMap instanceof Map) || !forecastMap.size) {
      return 0;
    }
    const now = new Date();
    const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let currentOrFutureDays = 0;
    let minDays = 0;
    let maxDays = 0;
    let conditionDays = 0;
    forecastMap.forEach((item, key) => {
      const parsed = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(key));
      if (parsed) {
        const y = Number(parsed[1]);
        const m = Number(parsed[2]);
        const d = Number(parsed[3]);
        const dayMs = new Date(y, m, d).getTime();
        if (Number.isFinite(dayMs) && dayMs >= todayMs) {
          currentOrFutureDays += 1;
        }
      }
      if (Number.isFinite(item?.tempMin)) {
        minDays += 1;
      }
      if (Number.isFinite(item?.tempMax)) {
        maxDays += 1;
      }
      if (String(item?.condition || "").trim()) {
        conditionDays += 1;
      }
    });
    return (currentOrFutureDays * 10000) + (forecastMap.size * 1000) + (minDays * 100) + (maxDays * 20) + conditionDays;
  }

  _isRicherForecastMap(candidateMap, currentMap) {
    const candidateScore = this._scoreForecastMap(candidateMap);
    const currentScore = this._scoreForecastMap(currentMap);
    if (!candidateScore) {
      return false;
    }
    return candidateScore >= currentScore;
  }

  _selectBestForecastRows(candidateSets) {
    let bestRows = [];
    let bestMap = new Map();
    const normalizedSets = (Array.isArray(candidateSets) ? candidateSets : [])
      .map(rows => this._normalizeForecastRows(rows))
      .filter(rows => rows.length);
    const combinedRows = normalizedSets.flat();
    const setsToCompare = combinedRows.length ? [...normalizedSets, combinedRows] : normalizedSets;
    setsToCompare.forEach(rows => {
      const candidateMap = this._buildForecastDayMap(rows);
      if (this._isRicherForecastMap(candidateMap, bestMap)) {
        bestRows = rows;
        bestMap = candidateMap;
      }
    });
    return bestRows;
  }

  _normalizeForecastRows(raw) {
    if (Array.isArray(raw)) {
      return raw.flatMap(item => this._normalizeForecastRows(item));
    }
    if (!raw || typeof raw !== "object") {
      return [];
    }
    const dateSeries = raw.time ?? raw.datetime ?? raw.date ?? raw.dates;
    if (Array.isArray(dateSeries)) {
      return dateSeries
        .map((dateValue, index) => {
          const row = { date: dateValue };
          Object.entries(raw).forEach(([key, value]) => {
            if (Array.isArray(value) && index < value.length) {
              row[key] = value[index];
            }
          });
          return row;
        })
        .filter(item => item && typeof item === "object");
    }
    if (Array.isArray(raw.forecast)) {
      return raw.forecast.flatMap(item => this._normalizeForecastRows(item));
    }
    if (Array.isArray(raw.daily)) {
      return raw.daily.flatMap(item => this._normalizeForecastRows(item));
    }
    if (Array.isArray(raw.hourly)) {
      return raw.hourly.flatMap(item => this._normalizeForecastRows(item));
    }
    const objectEntries = Object.entries(raw).filter(([, value]) => value && typeof value === "object");
    const nestedArrays = objectEntries.flatMap(([key, value]) =>
      this._normalizeForecastRows(withForecastDateFromKey(key, value)).map(item => withForecastDateFromKey(key, item)),
    );
    if (nestedArrays.length) {
      return nestedArrays;
    }
    const looksLikeForecastPoint =
      "datetime" in raw ||
      "date" in raw ||
      "day" in raw ||
      "time" in raw ||
      "timestamp" in raw ||
      "temperature" in raw ||
      "temperature_2m_max" in raw ||
      "templow" in raw ||
      "temperatureLow" in raw ||
      "temperature_2m_min" in raw ||
      "condition" in raw ||
      "weather" in raw;
    return looksLikeForecastPoint ? [raw] : [];
  }

  _applyWeatherForecastRows(forecastRows, { allowFallback = true, preserveRicherExisting = false } = {}) {
    const forecastMap = this._buildForecastDayMap(forecastRows);
    if (!forecastMap.size && allowFallback) {
      const entityId = this._getWeatherEntityId();
      const stateObj = entityId ? this._hass?.states?.[entityId] : null;
      if (stateObj) {
        const now = new Date();
        const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
        const currentTemp = Number(
          stateObj.attributes?.temperature ?? stateObj.attributes?.native_temperature,
        );
        const lowTemp = Number(
          stateObj.attributes?.templow ??
            stateObj.attributes?.temperature_low ??
            stateObj.attributes?.native_templow,
        );
        const condition = String(
          stateObj.attributes?.condition ?? stateObj.state ?? "",
        ).trim();
        if (condition || Number.isFinite(currentTemp) || Number.isFinite(lowTemp)) {
          forecastMap.set(todayKey, {
            condition,
            tempMax: Number.isFinite(currentTemp) ? currentTemp : null,
            tempMin: Number.isFinite(lowTemp) ? lowTemp : null,
          });
        }
      }
    }
    if (
      preserveRicherExisting &&
      this._weatherForecastByDay instanceof Map &&
      this._weatherForecastByDay.size &&
      !this._isRicherForecastMap(forecastMap, this._weatherForecastByDay)
    ) {
      return this._weatherForecastByDay;
    }
    this._weatherForecastByDay = forecastMap;
    return forecastMap;
  }

  _unsubscribeWeatherForecast() {
    if (!this._weatherForecastSubscription) {
      this._weatherForecastSubscriptionKey = "";
      return;
    }
    this._weatherForecastSubscription
      .then(unsubscribe => {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      })
      .catch(() => {});
    this._weatherForecastSubscription = null;
    this._weatherForecastSubscriptionKey = "";
  }

  _ensureWeatherForecastSubscription() {
    const entityId = this._getWeatherEntityId();
    const stateObj = entityId ? this._hass?.states?.[entityId] : null;
    if (!this.isConnected || !this._hass || !entityId || !stateObj) {
      this._unsubscribeWeatherForecast();
      return;
    }
    const subscribeMessage = this._hass.connection?.subscribeMessage;
    if (typeof subscribeMessage !== "function") {
      this._unsubscribeWeatherForecast();
      return;
    }
    const forecastType = supportedWeatherForecastTypes(stateObj)[0] || "daily";
    const subscriptionKey = `${entityId}:${forecastType}`;
    if (subscriptionKey === this._weatherForecastSubscriptionKey && this._weatherForecastSubscription) {
      return;
    }
    this._unsubscribeWeatherForecast();
    this._weatherForecastSubscriptionKey = subscriptionKey;
    this._weatherForecastSubscription = subscribeMessage(event => {
      this._weatherForecastEvents = {
        ...this._weatherForecastEvents,
        [forecastType]: event,
      };
      const rows = this._tagForecastRows(event?.forecast ?? event, forecastType);
      const forecastMap = this._applyWeatherForecastRows(rows, {
        allowFallback: rows.length === 0,
        preserveRicherExisting: true,
      });
      if (forecastMap.size) {
        this._lastRenderSignature = "";
        this._renderIfChanged(true);
      }
    }, {
      type: "weather/subscribe_forecast",
      entity_id: entityId,
      forecast_type: forecastType,
    }).catch(() => {
      this._weatherForecastSubscription = null;
      this._weatherForecastSubscriptionKey = "";
    });
  }

  _extractForecastRowsFromResponse(response, entityId) {
    const candidates = [
      response?.[entityId],
      response?.response?.[entityId],
      response?.service_response?.[entityId],
      response?.result?.[entityId],
      response,
      response?.response,
      response?.service_response,
      response?.result,
    ];
    for (const candidate of candidates) {
      const normalized = this._normalizeForecastRows(candidate);
      if (normalized.length) {
        return normalized;
      }
    }
    return [];
  }

  async _fetchForecastViaWebSocket(entityId, forecastType) {
    if (typeof this._hass?.callWS !== "function") {
      return [];
    }
    const response = await this._hass.callWS({
      type: "weather/get_forecasts",
      entity_ids: [entityId],
      forecast_type: forecastType,
    });
    return this._tagForecastRows(this._extractForecastRowsFromResponse(response, entityId), forecastType);
  }

  async _fetchForecastViaService(entityId, forecastType) {
    if (typeof this._hass?.callService !== "function") {
      return [];
    }
    const response = await this._hass.callService(
      "weather",
      "get_forecasts",
      { type: forecastType },
      { entity_id: entityId },
      false,
      true,
    );
    return this._tagForecastRows(this._extractForecastRowsFromResponse(response, entityId), forecastType);
  }

  _getCachedForecastRows(forecastTypes) {
    return (Array.isArray(forecastTypes) ? forecastTypes : [])
      .flatMap(forecastType => this._tagForecastRows(this._weatherForecastEvents?.[forecastType]?.forecast, forecastType));
  }

  async _refreshWeatherForecastByDay() {
    const entityId = this._getWeatherEntityId();
    if (!entityId || !this._hass?.states?.[entityId]) {
      this._weatherForecastByDay = new Map();
      return;
    }
    const stateObj = this._hass.states[entityId];
    const forecastTypes = supportedWeatherForecastTypes(stateObj);
    const forecastCandidates = [];
    const addForecastCandidate = rows => {
      const normalized = this._normalizeForecastRows(rows);
      if (normalized.length) {
        forecastCandidates.push(normalized);
      }
    };
    addForecastCandidate(this._getCachedForecastRows(forecastTypes));
    for (const forecastType of forecastTypes) {
      try {
        addForecastCandidate(await this._fetchForecastViaWebSocket(entityId, forecastType));
      } catch (_error) {
        // fallback below
      }
      try {
        addForecastCandidate(await this._fetchForecastViaService(entityId, forecastType));
      } catch (_error) {
        // fallback below
      }
    }
    addForecastCandidate(this._tagForecastRows(stateObj.attributes?.forecast, "daily"));
    addForecastCandidate(this._tagForecastRows(stateObj.attributes?.forecast_daily, "daily"));
    addForecastCandidate(this._tagForecastRows(stateObj.attributes?.daily_forecast, "daily"));
    if (typeof this._hass?.callApi === "function") {
      try {
        const restDaily = await this._hass.callApi(
          "GET",
          `weather/forecast/${encodeURIComponent(entityId)}?type=daily`,
        );
        addForecastCandidate(this._tagForecastRows(restDaily, "daily"));
      } catch (_error) {
        // Keep silent, not all HA versions expose this endpoint.
      }
    }
    const forecastRows = this._selectBestForecastRows(forecastCandidates);
    this._applyWeatherForecastRows(forecastRows);
  }

  _buildWeatherForecastByDay() {
    return this._weatherForecastByDay instanceof Map ? this._weatherForecastByDay : new Map();
  }

  _getWeatherForDay(dayDate, weatherByDay) {
    if (!(weatherByDay instanceof Map) || !(dayDate instanceof Date) || Number.isNaN(dayDate.getTime())) {
      return null;
    }
    const y = dayDate.getFullYear();
    const m = dayDate.getMonth();
    const d = dayDate.getDate();
    const keyLocal = `${y}-${m}-${d}`;
    if (weatherByDay.has(keyLocal)) {
      return weatherByDay.get(keyLocal);
    }
    // Fallback for integrations that expose zero-padded date-like keys.
    const keyPadded = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (weatherByDay.has(keyPadded)) {
      return weatherByDay.get(keyPadded);
    }
    // Last-resort fallback: nearest forecast day (within +/- 1 day).
    let nearest = null;
    let nearestDiff = Number.POSITIVE_INFINITY;
    const targetTs = new Date(y, m, d).getTime();
    for (const [k, value] of weatherByDay.entries()) {
      const parsed = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(k));
      if (!parsed) {
        continue;
      }
      const ky = Number(parsed[1]);
      const km = Number(parsed[2]);
      const kd = Number(parsed[3]);
      if (!Number.isFinite(ky) || !Number.isFinite(km) || !Number.isFinite(kd)) {
        continue;
      }
      const rowTs = new Date(ky, Math.max(0, km - 1), kd).getTime();
      const diff = Math.abs(rowTs - targetTs);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearest = value;
      }
    }
    return nearestDiff <= 86400000 ? nearest : null;
  }

  _getWeatherForecastSignature() {
    const entityId = this._getWeatherEntityId();
    if (!entityId || !this._hass?.states?.[entityId]) {
      return "";
    }
    const stateObj = this._hass.states[entityId];
    let hash = 2166136261;
    const mix = value => {
      const text = value === null || value === undefined ? "" : String(value);
      for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
      }
      hash = Math.imul(hash ^ 0x9e3779b9, 16777619) >>> 0;
    };
    mix(entityId);
    mix(String(stateObj.state || ""));
    [...this._buildWeatherForecastByDay().entries()]
      .sort((left, right) => String(left[0]).localeCompare(String(right[0])))
      .forEach(([key, item]) => {
        mix(key);
        mix(item?.condition || "");
        mix(item?.tempMax ?? "");
        mix(item?.tempMin ?? "");
      });
    return `w:${hash.toString(36)}`;
  }

  _openNativeEventComposer() {
    this._nativeComposerError = "";
    if (!this._nativeComposerCalendarValue) {
      this._nativeComposerCalendarValue = this._getAvailableNativeCalendarIds()[0] || "";
    }
    this._nativeEventComposerOpen = true;
    this._renderIfChanged(true);
  }

  _closeNativeEventComposer() {
    if (!this._nativeEventComposerOpen) {
      return;
    }
    this._nativeEventComposerOpen = false;
    this._nativeComposerError = "";
    this._renderIfChanged(true);
  }

  _setComposerError(kind, message) {
    const text = String(message || "").trim();
    const isNative = kind === "native";
    if (isNative) {
      this._nativeComposerError = text;
    }
    const selector = isNative ? "[data-native-error]" : "";
    if (!selector) {
      return;
    }
    const node = this.shadowRoot?.querySelector(selector);
    if (!(node instanceof HTMLElement)) {
      return;
    }
    node.hidden = !text;
    const label = node.querySelector("[data-error-text]");
    if (label) {
      label.textContent = text;
    } else {
      node.textContent = text;
    }
  }

  _renderComposerError(kind) {
    const isNative = kind === "native";
    const message = isNative ? this._nativeComposerError : "";
    const marker = isNative ? "data-native-error" : "";
    return `
      <div class="calendar-composer__error" ${marker} role="alert" aria-live="polite" ${message ? "" : "hidden"}>
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
        <span data-error-text>${escapeHtml(message)}</span>
      </div>
    `;
  }

  async _postWebhookPayload(webhookId, body) {
    const id = String(webhookId ?? "").trim();
    if (!id) {
      return false;
    }
    if (
      this._config?.security?.allow_webhooks_for_non_admin === false &&
      !this._hass?.user?.is_admin
    ) {
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn(
          "Nodalia Calendar Card: webhook bloqueado para usuario no administrador (security.allow_webhooks_for_non_admin=false).",
        );
      }
      return false;
    }
    const post =
      typeof window !== "undefined" &&
      window.NodaliaUtils &&
      typeof window.NodaliaUtils.postHomeAssistantWebhook === "function"
        ? window.NodaliaUtils.postHomeAssistantWebhook
        : null;
    if (!post) {
      return false;
    }
    try {
      return Boolean(await post(id, body, this._hass));
    } catch (_error) {
      return false;
    }
  }

  _buildNativeCalendarCreateEventWebhookBody(servicePayload, eventKind, calendarEvent = null) {
    const calendarId = String(servicePayload?.entity_id || "").trim();
    const serviceData = Object.fromEntries(
      Object.entries(servicePayload || {}).filter(([, value]) => value !== "" && value !== null && value !== undefined),
    );
    const eventData = calendarEvent && typeof calendarEvent === "object" ? Object.fromEntries(
      Object.entries(calendarEvent).filter(([, value]) => value !== "" && value !== null && value !== undefined),
    ) : null;
    return {
      type: "calendar_create_event",
      event_kind: eventKind,
      service: "calendar.create_event",
      target: calendarId ? { entity_id: [calendarId] } : {},
      data: serviceData,
      service_data: serviceData,
      calendar_event: eventData,
      ws_message: eventData ? {
        type: "calendar/event/create",
        entity_id: calendarId,
        event: eventData,
      } : null,
      ha_action: {
        action: "calendar.create_event",
        target: calendarId ? { entity_id: [calendarId] } : {},
        data: serviceData,
      },
    };
  }

  async _submitNativeEventComposer() {
    if (!this._hass || !this.shadowRoot) {
      return;
    }
    this._setComposerError("native", "");
    const pickerValue = this.shadowRoot.querySelector('[data-native-field="calendar"]')?.value;
    const calendarId = String(this._nativeComposerCalendarValue || pickerValue || "").trim();
    const title = String(
      this.shadowRoot.querySelector('[data-native-field="title"]')?.value || "",
    ).trim();
    const dateRaw = String(
      this.shadowRoot.querySelector('[data-native-field="date"]')?.value || "",
    ).trim();
    const allDay = Boolean(
      this.shadowRoot.querySelector('[data-native-field="allDay"]')?.checked,
    );
    const startRaw = String(
      this.shadowRoot.querySelector('[data-native-field="start"]')?.value || "",
    ).trim();
    const endRaw = String(
      this.shadowRoot.querySelector('[data-native-field="end"]')?.value || "",
    ).trim();
    const descriptionRaw = String(
      this.shadowRoot.querySelector('[data-native-field="description"]')?.value || "",
    ).trim();
    const locationRaw = String(
      this.shadowRoot.querySelector('[data-native-field="location"]')?.value || "",
    ).trim();
    const colorEnabled = Boolean(
      this.shadowRoot.querySelector('[data-native-field="colorEnabled"]')?.checked,
    );
    const colorRaw = String(
      this.shadowRoot.querySelector('[data-native-field="color"]')?.value || "",
    ).trim();
    const repeatKind = String(
      this.shadowRoot.querySelector('[data-native-field="repeatKind"]')?.value || "none",
    ).trim().toLowerCase();
    if (!calendarId || !title || !dateRaw || (!allDay && (!startRaw || !endRaw))) {
      return;
    }
    if (dateInputIsBeforeToday(dateRaw)) {
      this._setComposerError("native", "La fecha no puede ser anterior a hoy.");
      return;
    }
    const rruleByKind = {
      yearly: "FREQ=YEARLY",
      monthly: "FREQ=MONTHLY",
      weekly: "FREQ=WEEKLY",
      daily: "FREQ=DAILY",
    };
    const rrule = rruleByKind[repeatKind] || "";
    const colorOverride = colorEnabled ? (sanitizeCalendarTint(colorRaw) || "#ff7ab6") : "";
    const description = appendNodaliaEventMetadata(descriptionRaw, { color: colorOverride });
    const addOptionalEventFields = payload => {
      if (description) {
        payload.description = description;
      }
      if (locationRaw) {
        payload.location = locationRaw;
      }
      return payload;
    };
    const addOptionalWsEventFields = eventPayload => {
      if (description) {
        eventPayload.description = description;
      }
      if (locationRaw) {
        eventPayload.location = locationRaw;
      }
      if (rrule) {
        eventPayload.rrule = String(rrule).trim();
      }
      return eventPayload;
    };
    const createCalendarEventViaWs = async eventPayload => {
      if (typeof this._hass?.callWS !== "function") {
        throw new Error("calendar/event/create unavailable");
      }
      await this._hass.callWS({
        type: "calendar/event/create",
        entity_id: calendarId,
        event: eventPayload,
      });
    };
    try {
      const nativeWebhookId = String(this._config?.native_event_webhook || "").trim();
      if (allDay) {
        const startDay = new Date(`${dateRaw}T00:00:00`);
        const nextDay = Number.isNaN(startDay.getTime()) ? null : new Date(startDay.getTime() + 86400000);
        const endDate =
          nextDay
            ? `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`
            : dateRaw;
        const payload = {
          entity_id: calendarId,
          summary: title,
          start_date: dateRaw,
          end_date: endDate,
        };
        addOptionalEventFields(payload);
        const calendarEventPayload = addOptionalWsEventFields({
          summary: title,
          start: dateRaw,
          end: endDate,
        });
        if (rrule) {
          await createCalendarEventViaWs(calendarEventPayload);
          this._nativeComposerError = "";
          this._nativeEventComposerOpen = false;
          this._refreshEvents();
          return;
        }
        if (nativeWebhookId) {
          const ok = await this._postWebhookPayload(
            nativeWebhookId,
            this._buildNativeCalendarCreateEventWebhookBody(payload, "all_day", calendarEventPayload),
          );
          if (!ok) {
            return;
          }
        } else {
          await this._hass.callService("calendar", "create_event", payload);
        }
      } else {
        const formatLocalDateTime = value => {
          const yy = value.getFullYear();
          const mm = String(value.getMonth() + 1).padStart(2, "0");
          const dd = String(value.getDate()).padStart(2, "0");
          const hh = String(value.getHours()).padStart(2, "0");
          const mi = String(value.getMinutes()).padStart(2, "0");
          const ss = String(value.getSeconds()).padStart(2, "0");
          return `${yy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
        };
        const startDateTime = new Date(`${dateRaw}T${startRaw}:00`);
        let endDateTime = new Date(`${dateRaw}T${endRaw}:00`);
        if (!Number.isNaN(startDateTime.getTime()) && !Number.isNaN(endDateTime.getTime()) && endDateTime <= startDateTime) {
          endDateTime = new Date(endDateTime.getTime() + 86400000);
        }
        const payload = {
          entity_id: calendarId,
          summary: title,
          start_date_time: Number.isNaN(startDateTime.getTime()) ? `${dateRaw}T${startRaw}:00` : formatLocalDateTime(startDateTime),
          end_date_time: Number.isNaN(endDateTime.getTime()) ? `${dateRaw}T${endRaw}:00` : formatLocalDateTime(endDateTime),
        };
        addOptionalEventFields(payload);
        const calendarEventPayload = addOptionalWsEventFields({
          summary: title,
          start: payload.start_date_time,
          end: payload.end_date_time,
        });
        if (rrule) {
          await createCalendarEventViaWs(calendarEventPayload);
          this._nativeComposerError = "";
          this._nativeEventComposerOpen = false;
          this._refreshEvents();
          return;
        }
        if (nativeWebhookId) {
          const ok = await this._postWebhookPayload(
            nativeWebhookId,
            this._buildNativeCalendarCreateEventWebhookBody(payload, "timed", calendarEventPayload),
          );
          if (!ok) {
            return;
          }
        } else {
          await this._hass.callService("calendar", "create_event", payload);
        }
      }
      this._nativeComposerError = "";
      this._nativeEventComposerOpen = false;
      this._refreshEvents();
    } catch (error) {
      const message = String(error?.message || "").trim();
      this._setComposerError(
        "native",
        message && message !== "calendar/event/create unavailable"
          ? `No se pudo crear el evento: ${message}`
          : "No se pudo crear el evento.",
      );
    }
  }

  _nativeEventComposerMarkup() {
    if (!this._nativeEventComposerOpen) {
      return "";
    }
    const calendarIds = this._getAvailableNativeCalendarIds();
    if (!calendarIds.length) {
      return "";
    }
    const now = new Date();
    const pad = value => String(value).padStart(2, "0");
    const defaultDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const defaultStart = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const defaultEnd = `${pad((now.getHours() + 1) % 24)}:${pad(now.getMinutes())}`;
    return `
      <div class="calendar-composer ${this._nativeEventComposerOpen ? "is-open" : ""}">
        <div class="calendar-composer__backdrop" data-action="close-native-composer"></div>
        <div class="calendar-composer__panel" role="dialog" aria-modal="true" aria-label="Nuevo evento de calendario">
          <div class="calendar-composer__title">Nuevo evento</div>
          <label class="calendar-composer__field">
            <span>Calendario</span>
            <div data-native-calendar-host></div>
          </label>
          <label class="calendar-composer__field">
            <span>Titulo</span>
            <input data-native-field="title" type="text" placeholder="Ej. Cita medica" />
          </label>
          <label class="calendar-composer__field">
            <span>Descripcion</span>
            <textarea data-native-field="description" rows="3" placeholder="Opcional"></textarea>
          </label>
          <label class="calendar-composer__field">
            <span>Ubicacion</span>
            <input data-native-field="location" type="text" placeholder="Opcional" />
          </label>
          <div class="calendar-composer__row">
            <label class="calendar-composer__field">
              <span>Fecha</span>
              <input data-native-field="date" type="date" value="${escapeHtml(defaultDate)}" />
            </label>
            <label class="calendar-composer__check">
              <input data-native-field="allDay" type="checkbox" />
              <span>Todo el dia</span>
            </label>
          </div>
          <div class="calendar-composer__row">
            <label class="calendar-composer__field">
              <span>Inicio</span>
              <input data-native-field="start" type="time" value="${escapeHtml(defaultStart)}" />
            </label>
            <label class="calendar-composer__field">
              <span>Fin</span>
              <input data-native-field="end" type="time" value="${escapeHtml(defaultEnd)}" />
            </label>
          </div>
          <label class="calendar-composer__field">
            <span>Repeticion</span>
            <select data-native-field="repeatKind">
              <option value="none">No se repite</option>
              <option value="yearly">Anualmente</option>
              <option value="monthly">Mensualmente</option>
              <option value="weekly">Semanalmente</option>
              <option value="daily">Diariamente</option>
            </select>
          </label>
          <div class="calendar-composer__row calendar-composer__row--middle">
            <label class="calendar-composer__check">
              <input data-native-field="colorEnabled" type="checkbox" />
              <span>Color propio</span>
            </label>
            <label class="calendar-composer__field calendar-composer__field--color">
              <span>Color</span>
              <input data-native-field="color" type="color" value="#ff7ab6" />
            </label>
          </div>
          <div class="calendar-composer__actions">
            <button type="button" class="calendar-composer__btn" data-action="close-native-composer">Cancelar</button>
            <button type="button" class="calendar-composer__btn calendar-composer__btn--primary" data-action="save-native-composer">Crear</button>
          </div>
          ${this._renderComposerError("native")}
        </div>
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    const config = this._config;
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const locale = this._getLocale();
    const useAutoPrimaryTint = config.tint_auto !== false;
    const accentColor = useAutoPrimaryTint
      ? "var(--primary-color)"
      : String(styles.tint?.color || DEFAULT_CONFIG.styles.tint.color).trim() || "var(--primary-color)";
    const baseCardBg = styles.card.background;
    const onCardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${baseCardBg}) 0%, color-mix(in srgb, ${accentColor} 10%, ${baseCardBg}) 52%, ${baseCardBg} 100%)`;
    const onCardBorder = `color-mix(in srgb, ${accentColor} 32%, var(--divider-color))`;
    const onCardShadow = `0 16px 32px color-mix(in srgb, ${accentColor} 18%, rgba(0, 0, 0, 0.18))`;
    const cardBackground = onCardBackground;
    const cardBorder = `1px solid ${onCardBorder}`;
    const cardShadow = `${styles.card.box_shadow}, ${onCardShadow}`;
    const iconBubbleBg = `color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent))`;
    const iconBubbleGlyph = String(styles.icon?.on_color || DEFAULT_CONFIG.styles.icon.on_color);
    const iconSize = styles.icon?.size || DEFAULT_CONFIG.styles.icon.size;
    const chipHeight = styles.chip_height || DEFAULT_CONFIG.styles.chip_height;
    const chipFontSize = styles.chip_font_size || styles.chip_size || DEFAULT_CONFIG.styles.chip_font_size;
    const chipPadding = styles.chip_padding || DEFAULT_CONFIG.styles.chip_padding;
    const animationDuration = Math.min(
      1600,
      Math.max(120, Number(config.animations?.content_duration) || DEFAULT_CONFIG.animations.content_duration),
    );
    const exitDurationMs = calendarExitDurationMs(config.animations?.content_duration);
    const maxVisibleEvents = Math.max(1, Number(config.max_visible_events) || DEFAULT_CONFIG.max_visible_events);
    const visibleEvents = Array.isArray(this._renderVisibleEventsCache)
      ? this._renderVisibleEventsCache
      : this._events.filter(event => this._shouldShowEventInList(event));
    this._renderVisibleEventsCache = null;
    const groups = this._groupEvents(visibleEvents);
    const weatherByDay = this._buildWeatherForecastByDay();
    const hasEvents = visibleEvents.length > 0;
    const playEntrance =
      config.animations?.enabled !== false && !this._calendarEntrancePlayed && !this._loading;
    if (playEntrance) {
      this._calendarEntrancePlayed = true;
    }
    const playExpandedPanelEntrance =
      config.animations?.enabled !== false &&
      this._expandedOpen &&
      !this._expandedOverlayEntrancePlayed;
    if (playExpandedPanelEntrance) {
      this._expandedOverlayEntrancePlayed = true;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display:block;
          --calendar-exit-duration: ${exitDurationMs}ms;
        }
        * { box-sizing:border-box; }
        ha-card {
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          display: block;
          isolation: isolate;
          overflow: hidden;
          overscroll-behavior-y: contain;
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        ha-card::before {
          background: linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0));
          content: "";
          border-radius: inherit;
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }
        ha-card::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%);
          content: "";
          border-radius: inherit;
          inset: 0;
          opacity: 1;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }
        .calendar-card {
          cursor: pointer;
          display:grid;
          gap:${styles.card.gap};
          padding:${styles.card.padding};
          position: relative;
          z-index: 1;
        }
        .calendar-header--entering {
          animation: calendar-card-fade-up calc(${animationDuration}ms * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }
        .calendar-icon-bubble--entering {
          animation: calendar-card-bubble-bloom calc(${animationDuration}ms * 0.92) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 40ms;
        }
        .calendar-title--entering {
          animation: calendar-card-fade-up calc(${animationDuration}ms * 0.92) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 70ms;
        }
        .calendar-chip--entering {
          animation: calendar-card-fade-up calc(${animationDuration}ms * 0.94) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 110ms;
        }
        .calendar-chip--entering .calendar-chip__text {
          animation: calendar-card-chip-pop calc(${animationDuration}ms * 0.58) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
          animation-delay: 130ms;
        }
        .calendar-events-scroll--entering {
          animation: calendar-card-fade-up calc(${animationDuration}ms * 0.96) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 130ms;
        }
        .calendar-events-scroll--entering .calendar-day {
          animation: calendar-card-item-rise calc(${animationDuration}ms * 0.74) cubic-bezier(0.18, 0.9, 0.22, 1.08) both;
          animation-delay: calc(70ms + (var(--calendar-day-index, 0) * 40ms));
        }
        .calendar-events-scroll--entering .calendar-day__label {
          animation: calendar-card-fade-up calc(${animationDuration}ms * 0.6) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: calc(84ms + (var(--calendar-day-index, 0) * 40ms));
        }
        .calendar-header {
          align-items:center;
          display:flex;
          justify-content:flex-start;
          gap:10px;
        }
        .calendar-icon-bubble {
          -webkit-tap-highlight-color: transparent;
          align-items:center;
          background:${iconBubbleBg};
          border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius:999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color:${iconBubbleGlyph};
          display:inline-flex;
          flex:0 0 auto;
          height:${iconSize};
          justify-content:center;
          line-height:0;
          position:relative;
          width:${iconSize};
        }
        .calendar-icon-bubble ha-icon {
          --mdc-icon-size: calc(0.44 * ${iconSize});
          color:${iconBubbleGlyph};
          display:inline-flex;
          height:calc(0.44 * ${iconSize});
          left:50%;
          position:absolute;
          top:50%;
          transform:translate(-50%, -50%);
          width:calc(0.44 * ${iconSize});
        }
        .calendar-title {
          font-size:${styles.title_size};
          font-weight:700;
          letter-spacing:-0.02em;
          line-height:1.15;
          min-width:0;
        }
        .calendar-chip {
          align-items:center;
          background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius:999px;
          color:var(--secondary-text-color);
          display:inline-flex;
          flex:0 0 auto;
          font-size:${chipFontSize};
          font-weight:600;
          line-height:1;
          max-width:100%;
          min-height:${chipHeight};
          min-width:0;
          overflow:hidden;
          padding:${chipPadding};
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .calendar-header__spacer {
          flex:1 1 auto;
        }
        .calendar-empty,
        .calendar-loading,
        .calendar-error {
          color:var(--secondary-text-color);
          font-size:${styles.event_size};
          line-height:1.45;
          padding:8px 2px;
        }
        .calendar-error { color: var(--error-color); }
        .calendar-day {
          display:grid;
          gap:8px;
        }
        .calendar-day__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
          min-width: 0;
        }
        .calendar-events-scroll {
          display:grid;
          gap:10px;
          max-height: calc(${maxVisibleEvents} * 64px + 28px);
          overflow-y:auto;
          overscroll-behavior-y: contain;
          padding-right: 2px;
          touch-action: pan-y;
          -webkit-overflow-scrolling: touch;
        }
        .calendar-day__label {
          color:var(--secondary-text-color);
          font-size:11px;
          font-weight:700;
          letter-spacing:0.08em;
          min-width: 0;
          text-transform:uppercase;
        }
        .calendar-day__weather {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--secondary-text-color);
          display: inline-flex;
          flex: 0 0 auto;
          font-size: 10px;
          font-weight: 700;
          gap: 4px;
          min-height: 22px;
          padding: 0 8px;
          white-space: nowrap;
        }
        .calendar-day__weather ha-icon {
          --mdc-icon-size: 14px;
          color: var(--primary-color);
        }
        .calendar-event {
          align-items:center;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 14px;
          display:grid;
          gap:8px;
          grid-template-columns:auto 1fr auto;
          min-height:46px;
          padding:8px 10px;
        }
        .calendar-event--tinted {
          background: color-mix(in srgb, var(--cal-tint) 10%, color-mix(in srgb, var(--primary-text-color) 6%, transparent));
          border-color: color-mix(in srgb, var(--cal-tint) 32%, var(--divider-color));
        }
        .calendar-event--compact {
          gap:4px;
          grid-template-columns: 1fr;
          min-height: 0;
          padding:6px 8px;
        }
        .calendar-event--compact .calendar-event__time {
          font-size:10px;
          min-width: 0;
        }
        .calendar-event--compact .calendar-event__summary {
          white-space: normal;
          font-size:11px;
        }
        .calendar-event--compact .calendar-event__done {
          display:none;
        }
        .calendar-event--detail-link {
          cursor: pointer;
        }
        .calendar-event--detail-link:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--primary-color) 55%, transparent);
          outline-offset: 2px;
        }
        .calendar-event.is-completed {
          opacity:0.62;
        }
        .calendar-event.is-completed.calendar-event--exit {
          opacity: 1;
        }
        .calendar-event--exit {
          animation: calendar-event-complete-out var(--calendar-exit-duration, 420ms) cubic-bezier(0.22, 0.82, 0.28, 1) forwards;
          pointer-events: none;
          transform-origin: center center;
          will-change: transform, opacity;
        }
        .calendar-event--exit .calendar-event__done {
          opacity: 0.25;
          transition: opacity 180ms ease;
        }
        @keyframes calendar-event-complete-out {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          18% {
            opacity: 1;
            transform: translateY(-2px) scale(1.008);
          }
          100% {
            opacity: 0;
            transform: translateY(-14px) scale(0.94);
          }
        }
        .calendar-event__time {
          color:var(--secondary-text-color);
          font-size:11px;
          font-weight:700;
          min-width:52px;
        }
        .calendar-event__summary {
          font-size:${styles.event_size};
          line-height:1.35;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .calendar-event__summary small {
          color:var(--secondary-text-color);
          display:block;
          font-size:11px;
          margin-top:2px;
        }
        .calendar-event__done {
          align-items:center;
          appearance:none;
          background:transparent;
          border:1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
          border-radius:999px;
          color:var(--secondary-text-color);
          cursor:pointer;
          display:inline-flex;
          font-size:11px;
          font-weight:700;
          min-height:28px;
          padding:0 9px;
        }
        @keyframes calendar-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes calendar-card-item-rise {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.94);
          }
          62% {
            opacity: 1;
            transform: translateY(0) scale(1.018);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes calendar-card-chip-pop {
          0% {
            opacity: 0;
            transform: translateY(-4px) scale(0.86);
          }
          70% {
            opacity: 1;
            transform: translateY(1px) scale(1.05);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes calendar-card-bubble-bloom {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          58% {
            opacity: 1;
            transform: scale(1.04);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .calendar-expanded {
          --calendar-expanded-accent: var(--primary-color);
          inset: 0;
          opacity: 0;
          pointer-events: none;
          position: fixed;
          transition: opacity 220ms cubic-bezier(0.16, 0.84, 0.22, 1);
          z-index: 120;
        }
        .calendar-expanded.is-open {
          opacity: 1;
          pointer-events: auto;
        }
        .calendar-expanded__backdrop {
          -webkit-backdrop-filter: blur(12px);
          backdrop-filter: blur(12px);
          background: rgba(0, 0, 0, 0.32);
          inset: 0;
          position: absolute;
        }
        .calendar-expanded__panel {
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--calendar-expanded-accent) 18%, rgba(255, 255, 255, 0.08)), rgba(255, 255, 255, 0.02)),
            color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 94%, rgba(255, 255, 255, 0.02));
          border: 1px solid color-mix(in srgb, var(--calendar-expanded-accent) 34%, color-mix(in srgb, var(--primary-text-color) 9%, transparent));
          border-radius: 16px;
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28);
          color: var(--primary-text-color);
          display: grid;
          gap: 10px;
          isolation: isolate;
          left: 50%;
          max-height: min(88vh, 920px);
          max-width: min(96vw, 1100px);
          overflow: hidden;
          padding: 11px 12px 13px;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: min(96vw, 1100px);
        }
        .calendar-expanded__panel--composer-open {
          height: min(92vh, 940px);
          max-height: min(92vh, 940px);
          min-height: min(82vh, 640px);
        }
        .calendar-expanded__panel--entrance {
          animation: calendar-expanded-panel-in calc(${animationDuration}ms * 0.55) cubic-bezier(0.16, 0.84, 0.22, 1) both;
        }
        .calendar-expanded__toolbar {
          align-items: flex-start;
          display: flex;
          gap: 10px;
          justify-content: space-between;
          min-height: 28px;
          padding-right: 2px;
          position: relative;
        }
        .calendar-expanded__toolbar-title {
          flex: 1 1 auto;
          font-size: ${styles.title_size};
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.2;
          min-width: 0;
          padding-right: 6px;
        }
        .calendar-expanded__toolbar-actions {
          align-items: center;
          display: inline-flex;
          flex: 0 0 auto;
          gap: 6px;
        }
        .calendar-expanded__close {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: 24px;
          justify-content: center;
          line-height: 0;
          margin: 0;
          padding: 0;
          width: 24px;
        }
        .calendar-expanded__close ha-icon {
          --mdc-icon-size: 14px;
        }
        .calendar-expanded__body {
          max-height: min(76vh, 820px);
          overflow: auto;
          overscroll-behavior: contain;
          padding-right: 2px;
          touch-action: pan-y;
        }
        .calendar-expanded__panel--composer-open .calendar-expanded__body {
          max-height: none;
          min-height: 0;
          overflow: hidden;
        }
        .calendar-composer {
          display: grid;
          inset: 0;
          opacity: 0;
          overflow: auto;
          overscroll-behavior: contain;
          padding: 12px;
          pointer-events: none;
          place-items: center;
          position: absolute;
          touch-action: pan-y;
          transition: opacity 180ms ease;
          -webkit-overflow-scrolling: touch;
          z-index: 3;
        }
        .calendar-composer.is-open {
          opacity: 1;
          pointer-events: auto;
        }
        .calendar-composer__backdrop {
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
          background: rgba(0, 0, 0, 0.28);
          inset: 0;
          position: absolute;
        }
        .calendar-composer__panel {
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--calendar-expanded-accent) 14%, rgba(255, 255, 255, 0.06)), rgba(255, 255, 255, 0.02)),
            color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 94%, rgba(255, 255, 255, 0.03));
          border: 1px solid color-mix(in srgb, var(--calendar-expanded-accent) 30%, color-mix(in srgb, var(--primary-text-color) 9%, transparent));
          border-radius: 16px;
          box-shadow: 0 18px 38px rgba(0, 0, 0, 0.28);
          display: grid;
          gap: 10px;
          max-height: calc(100% - 24px);
          max-width: min(100%, 640px);
          overflow: auto;
          padding: 14px;
          position: relative;
          width: min(100%, 640px);
          z-index: 1;
        }
        .calendar-composer__title {
          font-size: ${styles.title_size};
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .calendar-composer__row {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .calendar-composer__row--middle {
          align-items: center;
        }
        .calendar-composer__field {
          display: grid;
          gap: 6px;
        }
        .calendar-composer__field--color {
          align-items: start;
          justify-items: start;
        }
        .calendar-composer__field > span,
        .calendar-composer__check > span {
          font-size: 12px;
          font-weight: 700;
        }
        .calendar-composer__field input,
        .calendar-composer__field textarea {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 38px;
          padding: 8px 10px;
          width: 100%;
        }
        .calendar-composer__field textarea {
          line-height: 1.35;
          min-height: 76px;
          resize: vertical;
        }
        .calendar-composer__field select {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 38px;
          padding: 8px 10px;
          width: 100%;
        }
        .calendar-composer__field input[type="color"] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border-radius: 999px;
          cursor: pointer;
          height: 40px;
          min-height: 40px;
          padding: 0;
          width: 40px;
        }
        .calendar-composer__field input[type="color"]::-webkit-color-swatch-wrapper {
          padding: 0;
        }
        .calendar-composer__field input[type="color"]::-webkit-color-swatch {
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
          border-radius: 999px;
        }
        .calendar-composer__field input[type="color"]::-moz-color-swatch {
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
          border-radius: 999px;
        }
        .calendar-composer__check {
          align-items: center;
          display: inline-grid;
          gap: 8px;
          grid-template-columns: auto minmax(0, 1fr);
          margin-top: 22px;
        }
        .calendar-composer__check input {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          cursor: pointer;
          height: 22px;
          margin: 0;
          position: relative;
          transition: background 160ms ease, border-color 160ms ease;
          width: 40px;
        }
        .calendar-composer__check input::before {
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
        .calendar-composer__check input:checked {
          background: var(--calendar-expanded-accent);
          border-color: var(--calendar-expanded-accent);
        }
        .calendar-composer__check input:checked::before {
          transform: translateX(18px);
        }
        .calendar-composer__error {
          align-items: center;
          background: color-mix(in srgb, var(--error-color, #db4437) 13%, transparent);
          border: 1px solid color-mix(in srgb, var(--error-color, #db4437) 34%, transparent);
          border-radius: 12px;
          color: var(--error-color, #db4437);
          display: flex;
          font-size: 12px;
          font-weight: 800;
          gap: 8px;
          line-height: 1.35;
          padding: 9px 10px;
        }
        .calendar-composer__error[hidden] {
          display: none;
        }
        .calendar-composer__error ha-icon {
          flex: 0 0 auto;
          height: 18px;
          width: 18px;
        }
        .calendar-composer__actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .calendar-composer__btn {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
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
        .calendar-composer__btn--primary {
          background: color-mix(in srgb, var(--calendar-expanded-accent) 22%, transparent);
          border-color: color-mix(in srgb, var(--calendar-expanded-accent) 38%, var(--divider-color));
        }
        @keyframes calendar-expanded-panel-in {
          0% {
            clip-path: inset(0 42% 58% 42% round 16px);
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.97);
          }
          68% {
            clip-path: inset(0 4% 2% 4% round 16px);
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            clip-path: inset(0 0 0 0 round 16px);
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        .calendar-expanded__horizontal {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding-bottom: 8px;
          scroll-snap-type: x proximity;
        }
        .calendar-expanded__horizontal .calendar-expanded__col {
          flex: 0 0 min(240px, 78vw);
          max-width: min(260px, 85vw);
          scroll-snap-align: start;
        }
        .calendar-expanded__column {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .calendar-expanded__column .calendar-expanded__col {
          width: 100%;
        }
        .calendar-expanded__col-head {
          align-items: center;
          display: flex;
          gap: 8px;
          justify-content: space-between;
          margin-bottom: 8px;
          min-width: 0;
        }
        .calendar-expanded__col-label {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          min-width: 0;
          text-transform: uppercase;
        }
        .calendar-expanded__weather,
        .calendar-expanded__month-weather {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--secondary-text-color);
          display: inline-flex;
          flex: 0 0 auto;
          font-size: 10px;
          font-weight: 700;
          gap: 4px;
          min-height: 22px;
          padding: 0 8px;
          white-space: nowrap;
        }
        .calendar-expanded__weather ha-icon,
        .calendar-expanded__month-weather ha-icon {
          --mdc-icon-size: 14px;
          color: var(--primary-color);
        }
        .calendar-expanded__col-events {
          display: grid;
          gap: 10px;
        }
        .calendar-expanded__month-banner {
          font-size: ${styles.title_size};
          font-weight: 700;
          margin-bottom: 8px;
          text-transform: capitalize;
        }
        .calendar-expanded__month {
          --cal-month-cell-min: 88px;
          --cal-month-cell-h: 122px;
          --cal-month-gap: 6px;
        }
        .calendar-expanded__month-matrix-wrap {
          margin-left: -2px;
          margin-right: -2px;
          overflow-x: auto;
          overscroll-behavior-x: contain;
          padding-bottom: 6px;
          touch-action: pan-x pan-y;
          -webkit-overflow-scrolling: touch;
        }
        .calendar-expanded__month-matrix {
          display: flex;
          flex-direction: column;
          gap: var(--cal-month-gap);
          min-width: max(100%, calc(7 * var(--cal-month-cell-min) + 6 * var(--cal-month-gap)));
          width: 100%;
        }
        .calendar-expanded__month-weekdays {
          color: var(--secondary-text-color);
          display: grid;
          font-size: 10px;
          font-weight: 700;
          gap: var(--cal-month-gap);
          grid-template-columns: repeat(7, minmax(var(--cal-month-cell-min), 1fr));
          letter-spacing: 0.06em;
          margin-bottom: 0;
          text-align: center;
          text-transform: uppercase;
        }
        .calendar-expanded__month-grid {
          display: grid;
          gap: var(--cal-month-gap);
          grid-auto-rows: var(--cal-month-cell-h, 122px);
          grid-template-columns: repeat(7, minmax(var(--cal-month-cell-min), 1fr));
        }
        .calendar-expanded__month-cell {
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 14px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 4px;
          height: 100%;
          max-height: var(--cal-month-cell-h, 122px);
          min-height: 0;
          min-width: 0;
          overflow: hidden;
          padding: 6px;
        }
        .calendar-expanded__month-cell--pad {
          background: transparent;
          border-color: transparent;
          height: auto;
          max-height: none;
          min-height: 0;
          padding: 0;
        }
        .calendar-expanded__month-cell-head {
          align-items: center;
          display: flex;
          flex: 0 0 auto;
          gap: 4px;
          justify-content: space-between;
          min-width: 0;
        }
        .calendar-expanded__month-daynum {
          color: var(--secondary-text-color);
          flex: 0 0 auto;
          font-size: 11px;
          font-weight: 800;
          line-height: 1.2;
        }
        .calendar-expanded__month-weather {
          font-size: 9px;
          gap: 2px;
          min-height: 18px;
          overflow: hidden;
          padding: 0 5px;
        }
        .calendar-expanded__month-weather ha-icon {
          --mdc-icon-size: 12px;
        }
        .calendar-expanded__month-events {
          display: flex;
          flex: 1 1 0;
          flex-direction: column;
          gap: 4px;
          min-height: 0;
          overflow: hidden;
        }
        .calendar-expanded__month-events--month-grid {
          justify-content: flex-start;
        }
        .calendar-expanded__month-events > .calendar-event {
          flex-shrink: 0;
        }
        .calendar-expanded__month-cell-dots {
          display: flex;
          flex-shrink: 0;
          flex-wrap: wrap;
          gap: 4px;
          justify-content: center;
          padding-top: 2px;
        }
        .calendar-expanded__month-cell-dot {
          background: var(--cal-dot, var(--primary-color));
          border-radius: 999px;
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--primary-text-color) 14%, transparent),
            0 1px 3px rgba(0, 0, 0, 0.1);
          flex: 0 0 auto;
          height: 6px;
          width: 6px;
        }
        .calendar-expanded__month-events .calendar-event--compact {
          min-height: unset;
        }
        .calendar-expanded__month-events .calendar-event--compact .calendar-event__summary {
          line-height: 1.25;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .calendar-expanded__month-events .calendar-event--compact .calendar-event__summary small {
          display: block;
          line-height: 1.2;
          margin-top: 2px;
          opacity: 0.85;
        }
        .calendar-expanded__month-cell--day {
          -webkit-tap-highlight-color: transparent;
          cursor: pointer;
        }
        .calendar-expanded__month-cell--day:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--primary-color) 55%, transparent);
          outline-offset: 2px;
        }
        .calendar-expanded__day-detail {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 0;
        }
        .calendar-expanded__day-detail-toolbar {
          display: flex;
          justify-content: flex-start;
        }
        .calendar-expanded__day-back {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          gap: 4px;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          min-height: 36px;
          padding: 0 12px 0 8px;
        }
        .calendar-expanded__day-back ha-icon {
          --mdc-icon-size: 20px;
          margin-left: -2px;
        }
        .calendar-expanded__day-detail-heading {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
          min-width: 0;
        }
        .calendar-expanded__day-detail-title {
          font-size: ${styles.title_size};
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.2;
          min-width: 0;
          text-transform: capitalize;
        }
        .calendar-expanded__day-detail-scroll {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: min(46vh, 420px);
          min-height: 0;
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior-y: contain;
          padding-right: 2px;
          touch-action: pan-y;
          -webkit-overflow-scrolling: touch;
        }
        .calendar-expanded__day-detail-scroll > .calendar-event {
          grid-template-columns: auto 1fr auto;
          min-height: 46px;
        }
        .calendar-expanded__day-empty {
          color: var(--secondary-text-color);
          font-size: ${styles.event_size};
          line-height: 1.45;
          padding: 12px 4px;
        }
        .calendar-expanded__event-detail {
          display: grid;
          gap: 12px;
          min-height: 0;
        }
        .calendar-expanded__event-hero {
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--cal-detail-tint) 18%, transparent), transparent 70%),
            color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--cal-detail-tint) 34%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 16px;
          display: grid;
          gap: 10px;
          padding: 14px;
        }
        .calendar-expanded__event-title {
          font-size: 22px;
          font-weight: 850;
          line-height: 1.12;
          overflow-wrap: anywhere;
        }
        .calendar-expanded__event-meta {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .calendar-expanded__event-meta span {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: 12px;
          font-weight: 700;
          gap: 5px;
          min-height: 28px;
          padding: 0 10px;
        }
        .calendar-expanded__event-meta ha-icon {
          --mdc-icon-size: 15px;
        }
        .calendar-expanded__event-sections {
          display: grid;
          gap: 10px;
          max-height: min(48vh, 460px);
          overflow-y: auto;
          padding-right: 2px;
        }
        .calendar-expanded__event-section {
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border-radius: 14px;
          display: grid;
          gap: 6px;
          padding: 12px;
        }
        .calendar-expanded__event-section-title {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .calendar-expanded__event-section-body {
          font-size: ${styles.event_size};
          line-height: 1.45;
          overflow-wrap: anywhere;
          white-space: normal;
        }
        @media (max-width: 520px) {
          .calendar-expanded__month {
            --cal-month-cell-min: 92px;
          }
          .calendar-composer__row {
            grid-template-columns: 1fr;
          }
          .calendar-composer__check {
            margin-top: 0;
          }
        }
      </style>
      <ha-card>
        <div class="calendar-card">
          <div class="calendar-header ${playEntrance ? "calendar-header--entering" : ""}">
            <span class="calendar-icon-bubble ${playEntrance ? "calendar-icon-bubble--entering" : ""}"><ha-icon icon="${escapeHtml(config.icon || DEFAULT_CONFIG.icon)}"></ha-icon></span>
            <div class="calendar-title ${playEntrance ? "calendar-title--entering" : ""}">${escapeHtml(config.title)}</div>
            <span class="calendar-header__spacer"></span>
            <div class="calendar-chip ${playEntrance ? "calendar-chip--entering" : ""}"><span class="calendar-chip__text">${escapeHtml(timeRangeChipLabel(config.time_range || DEFAULT_CONFIG.time_range))}</span></div>
          </div>
          ${
            this._loading
              ? `<div class="calendar-loading">Cargando eventos...</div>`
              : this._error
                ? `<div class="calendar-error">${escapeHtml(this._error)}</div>`
                : !hasEvents
                  ? `<div class="calendar-empty">No hay eventos en este rango.</div>`
                  : `<div class="calendar-events-scroll ${playEntrance ? "calendar-events-scroll--entering" : ""}">
                      ${groups.map((group, groupIndex) => `
                        <div class="calendar-day" style="--calendar-day-index:${groupIndex};">
                          <div class="calendar-day__header">
                            <div class="calendar-day__label">${escapeHtml(group.label)}</div>
                            ${(() => {
                              return this._renderWeatherBadge(group.dayDate, weatherByDay);
                            })()}
                          </div>
                          ${group.events.map(event => this._renderSingleEventHtml(event, config, locale)).join("")}
                        </div>
                      `).join("")}
                    </div>`
          }
        </div>
      </ha-card>
      <div class="calendar-expanded ${this._expandedOpen ? "is-open" : ""}" style="--calendar-expanded-accent:${accentColor};" aria-hidden="${this._expandedOpen ? "false" : "true"}">
        <div class="calendar-expanded__backdrop" data-action="expanded-backdrop"></div>
        <div class="calendar-expanded__panel ${playExpandedPanelEntrance ? "calendar-expanded__panel--entrance" : ""} ${this._nativeEventComposerOpen ? "calendar-expanded__panel--composer-open" : ""}" role="dialog" aria-modal="true" aria-label="${escapeHtml(config.title)}">
          <div class="calendar-expanded__toolbar">
            <div class="calendar-expanded__toolbar-title">${escapeHtml(config.title)}</div>
            <div class="calendar-expanded__toolbar-actions">
              <button type="button" class="calendar-expanded__close" data-action="add-native-event" aria-label="Crear evento HA">
                <ha-icon icon="mdi:calendar-plus"></ha-icon>
              </button>
              <button type="button" class="calendar-expanded__close" data-action="close-expanded" aria-label="Cerrar">
                <ha-icon icon="mdi:close"></ha-icon>
              </button>
            </div>
          </div>
          <div class="calendar-expanded__body">
            ${
              this._loading
                ? `<div class="calendar-loading">Cargando eventos...</div>`
                : this._error
                  ? `<div class="calendar-error">${escapeHtml(this._error)}</div>`
                  : !hasEvents
                    ? `<div class="calendar-empty">No hay eventos en este rango.</div>`
                    : this._renderExpandedBody(groups, config, locale, weatherByDay)
            }
          </div>
          ${this._nativeEventComposerMarkup()}
        </div>
      </div>
    `;
    this._mountNativeCalendarControl();
  }

  _mountNativeCalendarControl() {
    if (!this._nativeEventComposerOpen || !this.shadowRoot) {
      return;
    }
    const host = this.shadowRoot.querySelector("[data-native-calendar-host]");
    if (!(host instanceof HTMLElement)) {
      return;
    }
    const nextValue = this._nativeComposerCalendarValue || "";
    let control = null;
    if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = { entity: { domain: "calendar" } };
      control.addEventListener("value-changed", event => {
        this._nativeComposerCalendarValue = String(event?.detail?.value || "").trim();
      });
    } else if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.includeDomains = ["calendar"];
      control.allowCustomEntity = false;
      control.entityFilter = stateObj =>
        String(stateObj?.entity_id || "").startsWith("calendar.");
      control.addEventListener("value-changed", event => {
        this._nativeComposerCalendarValue = String(event?.detail?.value || "").trim();
      });
    } else {
      control = document.createElement("input");
      control.type = "text";
      control.placeholder = "calendar.ejemplo";
      control.addEventListener("change", () => {
        this._nativeComposerCalendarValue = String(control.value || "").trim();
      });
    }
    control.dataset.nativeField = "calendar";
    if ("hass" in control) {
      control.hass = this._hass;
    }
    if ("value" in control) {
      control.value = nextValue;
    }
    host.replaceChildren(control);
  }

  _onShadowKeydown(event) {
    if (!this._expandedOpen) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (this._nativeEventComposerOpen) {
        this._nativeEventComposerOpen = false;
        this._nativeComposerError = "";
        this._renderIfChanged(true);
        return;
      }
      if (this._expandedEventDetailKey) {
        this._expandedEventDetailKey = "";
        this._renderIfChanged(true);
        return;
      }
      if (this._expandedMonthDayKey) {
        this._expandedMonthDayKey = "";
        this._renderIfChanged(true);
        return;
      }
      this._expandedOpen = false;
      this._expandedOverlayEntrancePlayed = false;
      this._renderIfChanged(true);
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const path = event.composedPath();
    const interactive = path.find(
      node =>
        node instanceof HTMLElement &&
        (node.matches?.("button,input,select,textarea") ||
          ["HA-SELECTOR", "HA-ENTITY-PICKER"].includes(node.tagName)),
    );
    if (interactive) {
      return;
    }
    const monthDayCell = path.find(
      node =>
        node instanceof HTMLElement &&
        node.dataset?.action === "open-month-day" &&
        node.classList?.contains("calendar-expanded__month-cell--day"),
    );
    if (monthDayCell instanceof HTMLElement) {
      event.preventDefault();
      event.stopPropagation();
      this._expandedMonthDayKey = monthDayCell.dataset.dayKey || "";
      this._expandedEventDetailKey = "";
      this._renderIfChanged(true);
      return;
    }
    const eventDetail = path.find(
      node => node instanceof HTMLElement && node.dataset?.action === "open-event-detail",
    );
    if (eventDetail instanceof HTMLElement) {
      event.preventDefault();
      event.stopPropagation();
      this._expandedEventDetailKey = eventDetail.dataset.key || "";
      this._renderIfChanged(true);
    }
  }

  _onShadowClick(event) {
    const path = event.composedPath();
    const toggleBtn = path.find(
      node => node instanceof HTMLElement && node.dataset?.action === "toggle-complete",
    );
    if (toggleBtn instanceof HTMLElement) {
      event.preventDefault();
      event.stopPropagation();
      this._toggleCompleted(toggleBtn.dataset.key || "");
      return;
    }
    const closeAction = path.find(
      node =>
        node instanceof HTMLElement &&
        (node.dataset?.action === "close-expanded" || node.dataset?.action === "expanded-backdrop"),
    );
    if (closeAction) {
      event.preventDefault();
      event.stopPropagation();
      this._expandedMonthDayKey = "";
      this._nativeEventComposerOpen = false;
      this._nativeComposerError = "";
      this._expandedEventDetailKey = "";
      this._expandedOpen = false;
      this._expandedOverlayEntrancePlayed = false;
      this._renderIfChanged(true);
      return;
    }
    const monthDayBack = path.find(
      node => node instanceof HTMLElement && node.dataset?.action === "month-day-back",
    );
    if (monthDayBack && this._expandedOpen) {
      event.preventDefault();
      event.stopPropagation();
      this._expandedMonthDayKey = "";
      this._expandedEventDetailKey = "";
      this._renderIfChanged(true);
      return;
    }
    const eventDetailBack = path.find(
      node => node instanceof HTMLElement && node.dataset?.action === "event-detail-back",
    );
    if (eventDetailBack && this._expandedOpen) {
      event.preventDefault();
      event.stopPropagation();
      this._expandedEventDetailKey = "";
      this._renderIfChanged(true);
      return;
    }
    const addNativeEvent = path.find(
      node => node instanceof HTMLElement && node.dataset?.action === "add-native-event",
    );
    if (addNativeEvent && this._expandedOpen) {
      event.preventDefault();
      event.stopPropagation();
      this._openNativeEventComposer();
      return;
    }
    const closeNativeComposer = path.find(
      node => node instanceof HTMLElement && node.dataset?.action === "close-native-composer",
    );
    if (closeNativeComposer && this._expandedOpen) {
      event.preventDefault();
      event.stopPropagation();
      this._closeNativeEventComposer();
      return;
    }
    const saveNativeComposer = path.find(
      node => node instanceof HTMLElement && node.dataset?.action === "save-native-composer",
    );
    if (saveNativeComposer && this._expandedOpen) {
      event.preventDefault();
      event.stopPropagation();
      void this._submitNativeEventComposer();
      return;
    }
    const monthDayOpen = path.find(
      node =>
        node instanceof HTMLElement &&
        node.dataset?.action === "open-month-day" &&
        node.classList?.contains("calendar-expanded__month-cell--day"),
    );
    if (monthDayOpen instanceof HTMLElement && this._expandedOpen) {
      event.preventDefault();
      event.stopPropagation();
      this._expandedMonthDayKey = monthDayOpen.dataset.dayKey || "";
      this._expandedEventDetailKey = "";
      this._renderIfChanged(true);
      return;
    }
    const eventDetailOpen = path.find(
      node => node instanceof HTMLElement && node.dataset?.action === "open-event-detail",
    );
    if (eventDetailOpen instanceof HTMLElement && this._expandedOpen) {
      event.preventDefault();
      event.stopPropagation();
      this._expandedEventDetailKey = eventDetailOpen.dataset.key || "";
      this._renderIfChanged(true);
      return;
    }
    if (this._expandedOpen) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest?.("button")) {
      return;
    }
    if (!target?.closest?.(".calendar-card")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this._expandedMonthDayKey = "";
    this._expandedEventDetailKey = "";
    this._nativeComposerError = "";
    this._expandedOpen = true;
    this._renderIfChanged(true);
  }
}

class NodaliaCalendarCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(DEFAULT_CONFIG);
    this._hass = null;
    this._showAnimationSection = false;
    this._showStyleSection = false;
    this._entityOptionsSignature = "";
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
  }

  set hass(hass) {
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender =
      !this._hass ||
      nextSignature !== this._entityOptionsSignature ||
      !this.shadowRoot?.innerHTML;

    this._hass = hass;
    this._entityOptionsSignature = nextSignature;

    if (shouldRender) {
      const focusState = this._captureFocusState();
      this._render();
      this._restoreFocusState(focusState);
      return;
    }

    this.shadowRoot?.querySelectorAll("ha-entity-picker, ha-selector, ha-icon-picker").forEach(el => {
      if ("hass" in el) {
        el.hass = hass;
      }
    });
  }

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    this._render();
    this._restoreFocusState(focusState);
  }

  _getEntityOptionsSignature(hass = this._hass) {
    if (window.NodaliaUtils?.editorFilteredStatesSignature) {
      return window.NodaliaUtils.editorFilteredStatesSignature(
        hass,
        this._config?.language,
        id => id.startsWith("calendar.") || id.startsWith("input_text.") || id.startsWith("weather."),
      );
    }
    return Object.keys(hass?.states || {})
      .filter(id => id.startsWith("calendar.") || id.startsWith("input_text.") || id.startsWith("weather."))
      .join("|");
  }

  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    return window.NodaliaI18n.editorStr(this._hass, this._config?.language ?? "auto", s);
  }

  _emitConfig() {
    const raw = deepClone(this._config || DEFAULT_CONFIG);
    const stripped =
      typeof window !== "undefined" && window.NodaliaUtils?.stripEqualToDefaults
        ? window.NodaliaUtils.stripEqualToDefaults(raw, DEFAULT_CONFIG)
        : raw;
    const payload = compactCalendarConfig(
      stripped !== undefined && stripped !== null ? stripped : {},
    );
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        bubbles: true,
        composed: true,
        detail: { config: payload },
      }),
    );
  }

  _captureFocusState() {
    const activeElement = this.shadowRoot?.activeElement;
    if (
      !(
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement
      )
    ) {
      return null;
    }
    const dataset = activeElement.dataset || {};
    const selector = dataset.field ? `[data-field="${escapeSelectorValue(dataset.field)}"]` : null;
    if (!selector) {
      return null;
    }
    const supportsSelection =
      typeof activeElement.selectionStart === "number" &&
      typeof activeElement.selectionEnd === "number";
    return {
      selector,
      selectionEnd: supportsSelection ? activeElement.selectionEnd : null,
      selectionStart: supportsSelection ? activeElement.selectionStart : null,
      type: activeElement.type,
    };
  }

  _restoreFocusState(focusState) {
    if (!focusState?.selector || !this.shadowRoot) {
      return;
    }
    const target = this.shadowRoot.querySelector(focusState.selector);
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
    ) {
      return;
    }
    try {
      target.focus({ preventScroll: true });
    } catch (_error) {
      target.focus();
    }
    const canRestoreSelection =
      focusState.type !== "checkbox" &&
      typeof focusState.selectionStart === "number" &&
      typeof focusState.selectionEnd === "number" &&
      typeof target.setSelectionRange === "function";
    if (!canRestoreSelection) {
      return;
    }
    try {
      target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
    } catch (_error) {
      /* ignore */
    }
  }

  _watchEditorControlTag(tagName) {
    if (!tagName || this._pendingEditorControlTags.has(tagName)) {
      return;
    }
    if (typeof customElements?.whenDefined !== "function" || customElements.get(tagName)) {
      return;
    }
    this._pendingEditorControlTags.add(tagName);
    customElements.whenDefined(tagName)
      .then(() => {
        this._pendingEditorControlTags.delete(tagName);
        if (!this._hass || !this.shadowRoot) {
          return;
        }
        const focusState = this._captureFocusState();
        this._render();
        this._restoreFocusState(focusState);
      })
      .catch(() => {
        this._pendingEditorControlTags.delete(tagName);
      });
  }

  _ensureEditorControlsReady() {
    this._watchEditorControlTag("ha-entity-picker");
    this._watchEditorControlTag("ha-selector");
    this._watchEditorControlTag("ha-icon-picker");
  }

  _setFieldValue(targetConfig, field, value) {
    if (!field) {
      return;
    }
    if (field.startsWith("calendars.")) {
      const parts = field.split(".");
      const index = Number(parts[1]);
      if (!Number.isFinite(index) || index < 0) {
        return;
      }
      if (!Array.isArray(targetConfig.calendars)) {
        targetConfig.calendars = [];
      }
      while (targetConfig.calendars.length <= index) {
        targetConfig.calendars.push({ entity: "", label: "", tint: "" });
      }
      if (parts.length >= 3) {
        const key = parts[2];
        let entry = targetConfig.calendars[index];
        if (typeof entry === "string") {
          entry = { entity: String(entry).trim(), label: "", tint: "" };
        } else if (!entry || typeof entry !== "object") {
          entry = { entity: "", label: "", tint: "" };
        }
        if (key === "entity") {
          entry.entity = String(value ?? "").trim();
        } else if (key === "label") {
          entry.label = String(value ?? "").trim();
        } else if (key === "tint") {
          entry.tint = sanitizeCalendarTint(value);
        }
        targetConfig.calendars[index] = entry;
        return;
      }
      targetConfig.calendars[index] = {
        entity: String(value ?? "").trim(),
        label: "",
        tint: "",
      };
      return;
    }
    if (field.startsWith("styles.")) {
      const parts = field.split(".");
      let cursor = targetConfig;
      for (let index = 0; index < parts.length - 1; index += 1) {
        const key = parts[index];
        if (!isObject(cursor[key])) {
          cursor[key] = {};
        }
        cursor = cursor[key];
      }
      cursor[parts[parts.length - 1]] = value;
      return;
    }
    if (field.startsWith("animations.")) {
      const key = field.split(".")[1];
      if (!isObject(targetConfig.animations)) {
        targetConfig.animations = {};
      }
      targetConfig.animations[key] = value;
      return;
    }
    targetConfig[field] = value;
  }

  _readFieldValue(input) {
    const valueType = input.dataset.valueType || "string";
    if (valueType === "boolean") {
      return Boolean(input.checked);
    }
    if (valueType === "number") {
      return Number(input.value || 0);
    }
    if (valueType === "color") {
      return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
    }
    return input.value;
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(
        node =>
          node instanceof HTMLInputElement ||
          node instanceof HTMLSelectElement ||
          node instanceof HTMLTextAreaElement,
      );
    if (!input?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    if (event.type === "input" && input.type !== "checkbox") {
      return;
    }
    if (input.type === "checkbox" && event.type === "input") {
      return;
    }
    const next = deepClone(this._config || DEFAULT_CONFIG);
    const field = input.dataset.field || "";
    const value = this._readFieldValue(input);
    this._setFieldValue(next, field, value);
    this._config = normalizeConfig(next);
    if (event.type === "change") {
      this._emitConfig();
      const focusState = this._captureFocusState();
      this._render();
      this._restoreFocusState(focusState);
    }
  }

  _onShadowValueChanged(event) {
    const control = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.field);
    if (!control?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    const field = control.dataset.field;
    const next = deepClone(this._config || DEFAULT_CONFIG);
    const raw = event.detail?.value;
    const value = typeof raw === "string" ? raw : control.value;
    this._setFieldValue(next, field, value);
    this._config = normalizeConfig(next);
    this._emitConfig();
    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  _moveCalendar(index, delta) {
    const next = deepClone(this._config || DEFAULT_CONFIG);
    const list = Array.isArray(next.calendars) ? [...next.calendars] : [];
    const j = index + delta;
    if (!Number.isFinite(index) || index < 0 || !Number.isFinite(j) || j < 0 || j >= list.length) {
      return;
    }
    [list[index], list[j]] = [list[j], list[index]];
    next.calendars = list;
    this._config = normalizeConfig(next);
    this._emitConfig();
    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  _onShadowClick(event) {
    const rootTarget = event.target instanceof Element ? event.target : null;
    const toggleButton = rootTarget?.closest?.("[data-editor-toggle]");
    if (toggleButton) {
      event.preventDefault();
      event.stopPropagation();
      if (toggleButton.dataset.editorToggle === "styles") {
        this._showStyleSection = !this._showStyleSection;
      } else if (toggleButton.dataset.editorToggle === "animations") {
        this._showAnimationSection = !this._showAnimationSection;
      }
      const focusState = this._captureFocusState();
      this._render();
      this._restoreFocusState(focusState);
      return;
    }

    const button = rootTarget?.closest?.("[data-editor-action]");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.editorAction;
    if (action === "move-calendar-up") {
      this._moveCalendar(Number(button.dataset.index || -1), -1);
      return;
    }
    if (action === "move-calendar-down") {
      this._moveCalendar(Number(button.dataset.index || -1), 1);
      return;
    }
    const next = deepClone(this._config || DEFAULT_CONFIG);
    if (!Array.isArray(next.calendars)) {
      next.calendars = [];
    }
    if (action === "add-calendar") {
      next.calendars.push({ entity: "", label: "", tint: "" });
    } else if (action === "remove-calendar") {
      const index = Number(button.dataset.index || -1);
      if (Number.isFinite(index) && index >= 0 && index < next.calendars.length) {
        next.calendars.splice(index, 1);
      }
    } else {
      return;
    }
    this._config = normalizeConfig(next);
    this._emitConfig();
    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  _mountCalendarEntityHost(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }
    const field = host.dataset.field || "calendars.0";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    const allowedDomains = String(host.dataset.domains || "")
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      if (allowedDomains.length) {
        control.includeDomains = allowedDomains;
        control.entityFilter = stateObj =>
          allowedDomains.some(domain => String(stateObj?.entity_id || "").startsWith(`${domain}.`));
      }
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
      control.allowCustomEntity = true;
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      const entitySelector =
        allowedDomains.length === 1
          ? { domain: allowedDomains[0] }
          : allowedDomains.length > 1
            ? { domain: allowedDomains }
            : {};
      control.selector = { entity: entitySelector };
    } else {
      control = document.createElement("input");
      control.type = "text";
      control.placeholder = placeholder || "calendar.ejemplo";
      control.addEventListener("change", this._onShadowInput);
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;

    if ("hass" in control) {
      control.hass = this._hass;
    }
    if ("value" in control) {
      control.value = nextValue;
    }

    if (control.tagName !== "INPUT") {
      control.addEventListener("value-changed", this._onShadowValueChanged);
    }

    host.replaceChildren(control);
  }

  _renderCheckboxField(label, field, checked) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-field="${escapeHtml(field)}"
          data-value-type="boolean"
          ${checked ? "checked" : ""}
        />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(tLabel)}</span>
      </label>
    `;
  }

  _renderTintAutoToggle(checked) {
    const tTitle = this._editorLabel("Tintado automatico");
    const tHint = this._editorLabel(
      "Usa el color primario del tema en la tarjeta. Desactiva para definir un color de acento en Estilos.",
    );
    const aria = escapeHtml(`${tTitle}. ${tHint}`);
    return `
      <div class="editor-tint-block">
        <div class="editor-tint-block__text">
          <div class="editor-tint-block__title">${escapeHtml(tTitle)}</div>
          <div class="editor-tint-block__hint">${escapeHtml(tHint)}</div>
        </div>
        <label class="editor-toggle">
          <input
            type="checkbox"
            data-field="tint_auto"
            data-value-type="boolean"
            aria-label="${aria}"
            ${checked ? "checked" : ""}
          />
          <span class="editor-toggle__switch" aria-hidden="true"></span>
          <span class="editor-toggle__label"></span>
        </label>
      </div>
    `;
  }

  _renderSelectField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const opts = options.options || [];
    const current = String(value ?? "");
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${opts
            .map(
              o =>
                `<option value="${escapeHtml(String(o.value))}" ${String(o.value) === current ? "selected" : ""}>${escapeHtml(
                  String(o.label),
                )}</option>`,
            )
            .join("")}
        </select>
      </label>
    `;
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || (inputType === "number" ? "number" : "string");
    const inputValue = value === undefined || value === null ? "" : String(value);
    const hintRaw = options.hint ? String(options.hint) : "";
    const hintHtml = hintRaw
      ? `<span class="editor-field__hint">${escapeHtml(this._editorLabel(hintRaw))}</span>`
      : "";
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          type="${escapeHtml(inputType)}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(valueType)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        />
        ${hintHtml}
      </label>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <ha-icon-picker
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        ></ha-icon-picker>
      </div>
    `;
  }

  _renderColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("Color personalizado");
    const fallbackValue = options.fallbackValue || getEditorColorFallbackValue(field);
    const currentValue = value === undefined || value === null || value === ""
      ? fallbackValue
      : String(value);
    const colorModel = getEditorColorModel(currentValue, fallbackValue);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="${escapeHtml(tColorCustom)}">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="color"
              data-alpha="${escapeHtml(String(colorModel.alpha))}"
              value="${escapeHtml(colorModel.hex)}"
              aria-label="${escapeHtml(tLabel)}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>
    `;
  }

  _renderCalendarCard(entry, index, total) {
    const ent =
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? entry
        : { entity: String(entry ?? "").trim(), label: "", tint: "" };
    const entityId = String(ent.entity ?? "").trim();
    const label = String(ent.label ?? "").trim();
    const tint = String(ent.tint ?? "").trim();
    return `
      <div class="series-editor-card">
        <div class="series-editor-card__header">
          <div class="series-editor-card__title">${escapeHtml(this._editorLabel("Calendario"))} ${index + 1}</div>
          <div class="series-editor-card__actions">
            <button type="button" data-editor-action="move-calendar-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>${escapeHtml(this._editorLabel("Subir"))}</button>
            <button type="button" data-editor-action="move-calendar-down" data-index="${index}" ${index === total - 1 ? "disabled" : ""}>${escapeHtml(this._editorLabel("Bajar"))}</button>
            <button type="button" data-editor-action="remove-calendar" data-index="${index}" class="danger">${escapeHtml(this._editorLabel("Eliminar"))}</button>
          </div>
        </div>
        <div class="series-editor-subgroup">
          <div class="series-editor-subgroup__title">${escapeHtml(this._editorLabel("Entidad"))}</div>
          <div class="editor-grid editor-grid--stacked">
            <div class="editor-field editor-field--full">
              <span>${escapeHtml(this._editorLabel("Calendario de Home Assistant"))}</span>
              <div
                class="editor-control-host"
                data-mounted-control="calendar-entity"
                data-field="calendars.${index}.entity"
                data-value="${escapeHtml(entityId)}"
                data-domains="calendar"
                data-placeholder="calendar.cumpleanos"
              ></div>
            </div>
            ${this._renderTextField("Etiqueta visible", `calendars.${index}.label`, label, {
              fullWidth: true,
              placeholder: this._editorLabel("Ej. Familia"),
            })}
            ${this._renderColorField("Tintado en la tarjeta", `calendars.${index}.tint`, tint, {
              fullWidth: true,
              fallbackValue: "#71c0ff",
            })}
          </div>
        </div>
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    this._ensureEditorControlsReady();
    const config = normalizeConfig(this._config || DEFAULT_CONFIG);
    const calendars =
      Array.isArray(config.calendars) && config.calendars.length
        ? config.calendars
        : [{ entity: "", label: "", tint: "" }];
    const animations = config.animations || DEFAULT_CONFIG.animations;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        .editor {
          color: var(--primary-text-color);
          display: grid;
          gap: 16px;
        }

        .editor-section {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 18px;
          display: grid;
          gap: 14px;
          padding: 16px;
        }

        .editor-section__header {
          display: grid;
          gap: 4px;
        }

        .editor-section__title {
          font-size: 15px;
          font-weight: 700;
        }

        .editor-section__hint {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
        }

        .editor-section__actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 2px;
        }

        .editor-section__toggle-button {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          gap: 8px;
          min-height: 34px;
          padding: 0 12px;
        }

        .editor-section__toggle-button ha-icon {
          --mdc-icon-size: 16px;
        }

        .editor-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .editor-grid--stacked {
          grid-template-columns: 1fr;
        }

        .editor-field,
        .editor-toggle {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .editor-field--full {
          grid-column: 1 / -1;
        }

        .editor-tint-block {
          align-items: center;
          background: color-mix(in srgb, var(--primary-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
          border-radius: 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px 18px;
          grid-column: 1 / -1;
          justify-content: space-between;
          padding: 14px 16px;
        }

        .editor-tint-block__text {
          display: grid;
          flex: 1 1 220px;
          gap: 5px;
          min-width: 0;
        }

        .editor-tint-block__title {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .editor-tint-block__hint {
          color: var(--secondary-text-color);
          font-size: 11px;
          line-height: 1.45;
          max-width: 44em;
        }

        .editor-tint-block .editor-toggle {
          align-self: center;
          flex: 0 0 auto;
          margin: 0;
          min-height: 0;
          padding-top: 0;
        }

        .editor-tint-block .editor-toggle__label:empty {
          display: none;
        }

        .editor-field:has(> .editor-control-host[data-mounted-control="entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="calendar-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="input-text-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="input-text-entity-2"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="input-text-entity-3"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="input-text-entity-4"]),
        .editor-field:has(> ha-icon-picker) {
          grid-column: 1 / -1;
        }

        .editor-field > span,
        .editor-toggle > span {
          font-size: 12px;
          font-weight: 600;
        }

        .editor-field__hint {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 500;
          line-height: 1.45;
        }

        .editor-field input,
        .editor-field select,
        .editor-field textarea,
        .editor-control-host input,
        .editor-control-host select,
        .editor-control-host textarea {
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

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }

        .editor-color-field {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          min-height: 40px;
        }

        .editor-color-picker {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: 40px;
          justify-content: center;
          position: relative;
          width: 40px;
        }

        .editor-color-picker input {
          cursor: pointer;
          inset: 0;
          opacity: 0;
          position: absolute;
        }

        .editor-color-picker:hover,
        .editor-color-picker:focus-within {
          border-color: color-mix(in srgb, var(--primary-text-color) 22%, transparent);
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }

        .editor-color-swatch {
          --editor-swatch: #71c0ff;
          background:
            linear-gradient(var(--editor-swatch), var(--editor-swatch)),
            conic-gradient(from 90deg, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 25%, rgba(0, 0, 0, 0.12) 0 50%, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 0 75%, rgba(0, 0, 0, 0.12) 0);
          background-position: center;
          background-size: cover, 10px 10px;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
          border-radius: 999px;
          display: block;
          height: 22px;
          width: 22px;
        }

        .editor-color-picker .editor-color-swatch {
          height: 22px;
          width: 22px;
        }

        .editor-actions {
          display: flex;
          justify-content: flex-start;
        }

        button {
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

        button.danger {
          color: var(--error-color);
        }

        button:disabled {
          cursor: default;
          opacity: 0.45;
        }

        .series-editor-list {
          display: grid;
          gap: 12px;
        }

        .series-editor-card {
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 16px;
          display: grid;
          gap: 12px;
          padding: 14px;
        }

        .series-editor-subgroup {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border-radius: 14px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }

        .series-editor-subgroup__title {
          font-size: 12px;
          font-weight: 700;
        }

        .series-editor-card__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        .series-editor-card__title {
          font-size: 13px;
          font-weight: 700;
        }

        .series-editor-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .empty-note {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }

          .series-editor-card__header {
            align-items: start;
            flex-direction: column;
          }

          .series-editor-card__actions {
            justify-content: flex-start;
          }
        }

        :is(.editor-toggle, .editor-checkbox) {
          align-items: center;
          column-gap: 10px;
          cursor: pointer;
          grid-auto-flow: row;
          grid-template-columns: auto minmax(0, 1fr);
          justify-content: stretch;
          min-height: 40px;
          padding-top: 0;
          position: relative;
        }

        :is(.editor-toggle, .editor-checkbox) input {
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
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          display: inline-flex;
          font-size: 0;
          height: 22px;
          line-height: 0;
          position: relative;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
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

        .editor-toggle__label {
          min-width: 0;
        }

        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }

        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch::before {
          transform: translateX(18px);
        }

        :is(.editor-toggle, .editor-checkbox) input:focus-visible + .editor-toggle__switch {
          box-shadow:
            0 0 0 3px color-mix(in srgb, var(--primary-text-color) 14%, transparent),
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("General"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Titulo visible, icono, rango temporal, refresco de datos y opciones de eventos completados."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Titulo", "title", config.title, { fullWidth: true, placeholder: "Calendario" })}
            ${this._renderIconPickerField("Icono", "icon", config.icon || DEFAULT_CONFIG.icon, {
              fullWidth: true,
              placeholder: "mdi:calendar-month",
            })}
            ${this._renderSelectField("Rango visible", "time_range", config.time_range || DEFAULT_CONFIG.time_range, {
              fullWidth: true,
              options: [
                { value: "3d", label: this._editorLabel("3 dias") },
                { value: "1w", label: this._editorLabel("1 semana") },
                { value: "2w", label: this._editorLabel("2 semanas") },
                { value: "1m", label: this._editorLabel("1 mes") },
              ],
            })}
            ${this._renderTextField("Eventos visibles antes de scroll", "max_visible_events", config.max_visible_events, { type: "number" })}
            ${this._renderTextField("Refresco (segundos)", "refresh_interval", config.refresh_interval, { type: "number" })}
            <div class="editor-field editor-field--full">
              <span>${escapeHtml(this._editorLabel("Entidad weather (prevision diaria, opcional)"))}</span>
              <div
                class="editor-control-host"
                data-mounted-control="weather-entity"
                data-field="weather_entity"
                data-value="${escapeHtml(String(config.weather_entity ?? ""))}"
                data-domains="weather"
                data-placeholder="weather.casa"
              ></div>
              <span class="editor-field__hint">${escapeHtml(
                this._editorLabel(
                  "Si se define, en la fila de cada dia se muestra icono + minima/maxima cuando haya forecast para esa fecha.",
                ),
              )}</span>
            </div>
            ${this._renderTintAutoToggle(config.tint_auto !== false)}
            ${this._renderCheckboxField("Permitir marcar eventos como completados", "allow_complete", config.allow_complete === true)}
            ${this._renderCheckboxField("Mostrar eventos completados", "show_completed", config.show_completed === true)}
            <div class="editor-field editor-field--full">
              <span>${escapeHtml(this._editorLabel("Helper input_text (completados compartidos)"))}</span>
              <div
                class="editor-control-host"
                data-mounted-control="input-text-entity"
                data-field="shared_completed_events_entity"
                data-value="${escapeHtml(String(config.shared_completed_events_entity ?? ""))}"
                data-domains="input_text"
                data-placeholder="input_text.nodalia_calendar_hechos"
              ></div>
              <span class="editor-field__hint">${escapeHtml(
                this._editorLabel(
                  "Opcional: misma lista en movil y PC. Puedes usar hasta 4 helpers (v6 multi-helper) para ampliar capacidad total.",
                ),
              )}</span>
            </div>
            <div class="editor-field editor-field--full">
              <span>${escapeHtml(this._editorLabel("Helper input_text #2 (opcional)"))}</span>
              <div
                class="editor-control-host"
                data-mounted-control="input-text-entity-2"
                data-field="shared_completed_events_entity_2"
                data-value="${escapeHtml(String(config.shared_completed_events_entity_2 ?? ""))}"
                data-domains="input_text"
                data-placeholder="input_text.nodalia_calendar_hechos_2"
              ></div>
            </div>
            <div class="editor-field editor-field--full">
              <span>${escapeHtml(this._editorLabel("Helper input_text #3 (opcional)"))}</span>
              <div
                class="editor-control-host"
                data-mounted-control="input-text-entity-3"
                data-field="shared_completed_events_entity_3"
                data-value="${escapeHtml(String(config.shared_completed_events_entity_3 ?? ""))}"
                data-domains="input_text"
                data-placeholder="input_text.nodalia_calendar_hechos_3"
              ></div>
            </div>
            <div class="editor-field editor-field--full">
              <span>${escapeHtml(this._editorLabel("Helper input_text #4 (opcional)"))}</span>
              <div
                class="editor-control-host"
                data-mounted-control="input-text-entity-4"
                data-field="shared_completed_events_entity_4"
                data-value="${escapeHtml(String(config.shared_completed_events_entity_4 ?? ""))}"
                data-domains="input_text"
                data-placeholder="input_text.nodalia_calendar_hechos_4"
              ></div>
            </div>
            ${this._renderTextField("Webhook persistencia (ID, opcional)", "shared_completed_events_webhook", config.shared_completed_events_webhook || "", {
              fullWidth: true,
              placeholder: "nodalia_calendar_completed",
              hint:
                "Si los usuarios no pueden llamar a input_text.set_value, pon aqui el webhook_id de una automatización que escriba el mismo helper. La tarjeta hace POST a /api/webhook/<id> con JSON {\"value\": \"...\"}.",
            })}
            ${this._renderTextField("Webhook evento nativo (ID, opcional)", "native_event_webhook", config.native_event_webhook || "", {
              fullWidth: true,
              placeholder: "nodalia_calendar_create_event",
              hint:
                "Si se define, crear evento nativo no recurrente usa webhook en lugar de calendar.create_event directo. En la automatizacion usa trigger.json.service_data o ramas por event_kind; no rellenes campos vacios.",
            })}
            ${this._renderCheckboxField(
              "Permitir webhooks para cualquier usuario",
              "security.allow_webhooks_for_non_admin",
              config.security?.allow_webhooks_for_non_admin !== false,
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Calendarios"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Anade una o varias entidades calendar y reordena el orden en que se combinan los eventos."))}</div>
          </div>
          <div class="series-editor-list">
            ${
              calendars.length
                ? calendars.map((entityId, index) => this._renderCalendarCard(entityId, index, calendars.length)).join("")
                : `<div class="empty-note">${escapeHtml(this._editorLabel("Todavia no hay calendarios configurados."))}</div>`
            }
          </div>
          <div class="editor-actions">
            <button type="button" class="editor-section__toggle-button" data-editor-action="add-calendar">
              <ha-icon icon="mdi:plus"></ha-icon>
              <span>${escapeHtml(this._editorLabel("Anadir calendario"))}</span>
            </button>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Animaciones"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Entrada suave del contenido de la tarjeta al cargar."))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showAnimationSection ? this._editorLabel("Ocultar ajustes de animacion") : this._editorLabel("Mostrar ajustes de animacion"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("Activar animaciones", "animations.enabled", animations.enabled !== false)}
                  ${this._renderTextField("Entrada contenido (ms)", "animations.content_duration", animations.content_duration, {
                    type: "number",
                  })}
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Estilos"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Ajustes visuales de la tarjeta, tipografia y burbuja de icono."))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showStyleSection ? this._editorLabel("Ocultar ajustes de estilo") : this._editorLabel("Mostrar ajustes de estilo"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("Fondo tarjeta", "styles.card.background", config.styles?.card?.background, {
                    fullWidth: true,
                    fallbackValue: DEFAULT_CONFIG.styles.card.background,
                  })}
                  ${this._renderTextField("Borde tarjeta", "styles.card.border", config.styles?.card?.border)}
                  ${this._renderTextField("Radio tarjeta", "styles.card.border_radius", config.styles?.card?.border_radius)}
                  ${this._renderTextField("Sombra tarjeta", "styles.card.box_shadow", config.styles?.card?.box_shadow, { fullWidth: true })}
                  ${this._renderTextField("Padding", "styles.card.padding", config.styles?.card?.padding)}
                  ${this._renderTextField("Separacion", "styles.card.gap", config.styles?.card?.gap)}
                  ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles?.title_size)}
                  ${this._renderTextField("Tamano evento", "styles.event_size", config.styles?.event_size)}
                  ${this._renderTextField("Alto chips", "styles.chip_height", config.styles?.chip_height)}
                  ${this._renderTextField("Texto chips", "styles.chip_font_size", config.styles?.chip_font_size)}
                  ${this._renderTextField("Relleno chips", "styles.chip_padding", config.styles?.chip_padding)}
                  ${this._renderColorField("Icono burbuja fondo", "styles.icon.background", config.styles?.icon?.background, {
                    fullWidth: true,
                    fallbackValue: DEFAULT_CONFIG.styles.icon.background,
                  })}
                  ${this._renderColorField("Color icono activo", "styles.icon.on_color", config.styles?.icon?.on_color, {
                    fullWidth: true,
                    fallbackValue: DEFAULT_CONFIG.styles.icon.on_color,
                  })}
                  ${this._renderColorField("Color icono inactivo", "styles.icon.off_color", config.styles?.icon?.off_color, {
                    fullWidth: true,
                    fallbackValue: DEFAULT_CONFIG.styles.icon.off_color,
                  })}
                  ${this._renderTextField("Icono burbuja tamano", "styles.icon.size", config.styles?.icon?.size)}
                  ${this._renderColorField("Color de acento (si el tintado automático está desactivado)", "styles.tint.color", config.styles?.tint?.color, {
                    fullWidth: true,
                    fallbackValue: DEFAULT_CONFIG.styles.tint.color,
                  })}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll(
        '[data-mounted-control="calendar-entity"], [data-mounted-control="input-text-entity"], [data-mounted-control="input-text-entity-2"], [data-mounted-control="input-text-entity-3"], [data-mounted-control="input-text-entity-4"], [data-mounted-control="weather-entity"]',
      )
      .forEach(host => {
        this._mountCalendarEntityHost(host);
      });
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCalendarCard);
}
if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCalendarCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Calendar Card",
  description: "Tarjeta de calendario elegante estilo Nodalia con eventos y marcado de completados.",
  preview: true,
});
