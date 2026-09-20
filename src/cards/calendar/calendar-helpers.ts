// @ts-nocheck -- forecast, date and editor color helpers stay loosely typed until remaining unknowns are narrowed.
import {
  DATE_TIME_FORMATTER_CACHE_LIMIT,
  NODALIA_EVENT_METADATA_RE,
  dateTimeFormatterCache,
} from "./calendar-constants";
import { clamp, isObject } from "./calendar-runtime";

export function shouldDarkenCalendarBubbleIconGlyph(state, accentColor) {
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

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function mergeConfig(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? deepClone(override) : deepClone(base);
  }
  if (!isObject(base)) {
    return override === undefined ? base : override;
  }
  const out = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(override || {})]);
  keys.forEach(key => {
    if (window.NodaliaUtils?.isUnsafeConfigPathKey?.(key)) {
      return;
    }
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

export function compactCalendarConfig(value) {
  if (Array.isArray(value)) {
    return value.map(item => compactCalendarConfig(item)).filter(item => item !== undefined);
  }
  if (isObject(value)) {
    const compacted = {};
    Object.entries(value).forEach(([key, item]) => {
      if (window.NodaliaUtils?.isUnsafeConfigPathKey?.(key)) {
        return;
      }
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

export function sanitizeCalendarTint(value) {
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

export function extractNodaliaEventColor(description) {
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

export function stripNodaliaEventMetadata(description) {
  return String(description ?? "")
    .replace(NODALIA_EVENT_METADATA_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function appendNodaliaEventMetadata(description, { color = "" } = {}) {
  const cleanDescription = stripNodaliaEventMetadata(description);
  const safeColor = sanitizeCalendarTint(color);
  if (!safeColor) {
    return cleanDescription;
  }
  const metadata = `<!-- nodalia:event color="${safeColor}" -->`;
  return cleanDescription ? `${cleanDescription}\n\n${metadata}` : metadata;
}

export function sanitizeCssRuntimeValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  if (
    /[<>{};"']/.test(raw)
    || raw.includes("/*")
    || raw.includes("*/")
    || /<\/style/i.test(raw)
    || /\burl\s*\(/i.test(raw)
    || /\b@import\b/i.test(raw)
  ) {
    return "";
  }
  return raw;
}

export function daysFromTimeRange(tr) {
  const map = { "3d": 3, "1w": 7, "2w": 14, "1m": 31 };
  return map[tr] || 7;
}

export function normalizeCalendarEntries(calendars) {
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

export function parseCalendarDateOnlyLocal(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day, 12, 0, 0);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function eventDate(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    const dayLocal = parseCalendarDateOnlyLocal(value);
    if (dayLocal) {
      return dayLocal;
    }
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  if (typeof value === "object") {
    if (value.dateTime) {
      const parsed = new Date(value.dateTime);
      return Number.isFinite(parsed.getTime()) ? parsed : null;
    }
    if (value.date) {
      const dayLocal = parseCalendarDateOnlyLocal(value.date);
      if (dayLocal) {
        return dayLocal;
      }
      const parsed = new Date(value.date);
      return Number.isFinite(parsed.getTime()) ? parsed : null;
    }
  }
  return null;
}

export function calendarEventUid(event) {
  return String(event?.uid ?? event?.eventData?.uid ?? "").trim();
}

export function calendarEventRecurrenceId(event) {
  return String(event?.recurrence_id ?? event?.eventData?.recurrence_id ?? "").trim();
}

export function calendarEventKey(event) {
  const source = String(event?._entity || "");
  const uid = calendarEventUid(event) || String(event?.id || "");
  const recurrence = calendarEventRecurrenceId(event);
  const start = eventDate(event?.start)?.toISOString() || "";
  const summary = String(event?.summary || event?.message || "");
  return `${source}|${uid}|${recurrence}|${start}|${summary}`;
}




export function normalizeTextKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");
}

export function weatherConditionIcon(value) {
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

export function forecastDayKey(value) {
  const formatDateKey = date => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "";
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const parsedNum = new Date(ms);
    return formatDateKey(parsedNum);
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
      return formatDateKey(parsedNum);
    }
  }
  const datePrefixMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (datePrefixMatch) {
    const y = Number(datePrefixMatch[1]);
    const m = Number(datePrefixMatch[2]) - 1;
    const d = Number(datePrefixMatch[3]);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return formatDateKey(new Date(y, m, d));
    }
  }
  const parsed = new Date(raw);
  return formatDateKey(parsed);
}

export function withForecastDateFromKey(key, value) {
  if (!value || typeof value !== "object" || !forecastDayKey(key)) {
    return value;
  }
  if ("datetime" in value || "date" in value || "day" in value || "time" in value || "timestamp" in value) {
    return value;
  }
  return { date: key, ...value };
}

export function pickFirstFiniteNumber(...candidates) {
  for (const candidate of candidates) {
    const n = Number(candidate);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

export function weatherSupportedFeature(state, feature) {
  return Boolean((Number(state?.attributes?.supported_features) || 0) & feature);
}

export function supportedWeatherForecastTypes(state) {
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

export function resolveEditorColorValue(value) {
  const resolver = window.NodaliaBubbleContrast?.resolveEditorColorValue;
  if (typeof resolver === "function") {
    return resolver(value);
  }
  return String(value ?? "").trim();
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

export function getEditorColorModel(value, fallbackValue = "#71c0ff") {
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

export function getEditorColorFallbackValue(field) {
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

export function getDateTimeFormatter(locale, options) {
  const key = `${String(locale || "default")}|${JSON.stringify(options)}`;
  let formatter = dateTimeFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateTimeFormatterCache.set(key, formatter);
    if (dateTimeFormatterCache.size > DATE_TIME_FORMATTER_CACHE_LIMIT) {
      dateTimeFormatterCache.delete(dateTimeFormatterCache.keys().next().value);
    }
  }
  return formatter;
}

export function formatDateLabel(date, locale) {
  return getDateTimeFormatter(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function formatTimeLabel(date, locale) {
  return getDateTimeFormatter(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function normalizeCalendarFetchResult(raw) {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw && typeof raw === "object" && Array.isArray(raw.events)) {
    return raw.events;
  }
  return [];
}

export function eventIsAllDay(event) {
  return Boolean(event?.start?.date && !event?.start?.dateTime);
}

export function parseDateInputAsLocalDate(value) {
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

export function dateInputIsBeforeToday(value) {
  const parsed = parseDateInputAsLocalDate(value);
  if (!parsed) {
    return false;
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parsed.getTime() < today.getTime();
}
