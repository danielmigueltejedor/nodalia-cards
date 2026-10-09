import type { HassEntity } from "../../core/types/home-assistant";
import { parseFiniteNumericValue } from "../../shared/numeric-values";
export { compactConfig as compactCalendarConfig } from "../../shared/config-values";
export { weatherConditionIcon } from "../../shared/weather-condition-icons";
import { DEFAULT_CONFIG } from "./calendar-defaults";
export { deepClone, mergeConfig } from "./calendar-runtime";
export { resolveEditorColorValue, formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import {
  NODALIA_EVENT_METADATA_RE,
} from "./calendar-constants";
import { isObject } from "./calendar-runtime";

export function shouldDarkenCalendarBubbleIconGlyph(state: HassEntity | null | undefined, accentColor: unknown) {
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

export function sanitizeCalendarTint(value: unknown) {
  const s = sanitizeCssRuntimeValue(value);
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

export function extractNodaliaEventColor(description: unknown) {
  const text = String(description ?? "");
  let color = "";
  text.replace(NODALIA_EVENT_METADATA_RE, (_match: string, rawColor: string | undefined) => {
    const safeColor = sanitizeCalendarTint(rawColor);
    if (safeColor) {
      color = safeColor;
    }
    return "";
  });
  return color;
}

export function stripNodaliaEventMetadata(description: unknown) {
  return String(description ?? "")
    .replace(NODALIA_EVENT_METADATA_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function appendNodaliaEventMetadata(description: unknown, { color = "" }: { color?: unknown } = {}) {
  const cleanDescription = stripNodaliaEventMetadata(description);
  const safeColor = sanitizeCalendarTint(color);
  if (!safeColor) {
    return cleanDescription;
  }
  const metadata = `<!-- nodalia:event color="${safeColor}" -->`;
  return cleanDescription ? `${cleanDescription}\n\n${metadata}` : metadata;
}

export function sanitizeCssRuntimeValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  if (
    [...raw].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    || /[<>{};"']/.test(raw)
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

export function daysFromTimeRange(tr: unknown) {
  return new Map([["3d", 3], ["1w", 7], ["2w", 14], ["1m", 31]]).get(String(tr)) || 7;
}

export function normalizeCalendarEntries(calendars: unknown) {
  if (!Array.isArray(calendars)) {
    return [];
  }
  const out: { entity: string; label: string; tint: string }[] = [];
  calendars.forEach((raw: unknown) => {
    if (typeof raw === "string") {
      out.push({
        entity: String(raw ?? "").trim(),
        label: "",
        tint: "",
      });
      return;
    }
    if (isObject(raw)) {
      out.push({
        entity: String(raw.entity ?? "").trim(),
        label: String(raw.label ?? "").trim(),
        tint: sanitizeCalendarTint(raw.tint),
      });
    }
  });
  return out;
}

function localDateFromInput(value: unknown, hour: number): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]) - 1, day = Number(match[3]);
  const parsed = new Date(0);
  parsed.setHours(hour, 0, 0, 0);
  parsed.setFullYear(year, month, day);
  return Number.isFinite(parsed.getTime()) && parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day ? parsed : null;
}

export function parseCalendarDateOnlyLocal(value: unknown): Date | null {
  return localDateFromInput(value, 12);
}

export function eventDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : null;
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return parseCalendarDateOnlyLocal(value);
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  if (isObject(value)) {
    if (value.dateTime) return eventDate(String(value.dateTime));
    if (value.date) return eventDate(String(value.date));
  }
  return null;
}

export function calendarEventUid(value: unknown) {
  const event = isObject(value) ? value : {};
  const data = isObject(event.eventData) ? event.eventData : {};
  return String(event.uid ?? data.uid ?? "").trim();
}

export function calendarEventRecurrenceId(value: unknown) {
  const event = isObject(value) ? value : {};
  const data = isObject(event.eventData) ? event.eventData : {};
  return String(event.recurrence_id ?? data.recurrence_id ?? "").trim();
}

export function calendarEventKey(value: unknown) {
  const event = isObject(value) ? value : {};
  const source = String(event?._entity || "");
  const uid = calendarEventUid(event) || String(event?.id || "");
  const recurrence = calendarEventRecurrenceId(event);
  const start = eventDate(event?.start)?.toISOString() || "";
  const summary = String(event?.summary || event?.message || "");
  return `${source}|${uid}|${recurrence}|${start}|${summary}`;
}

export function normalizeTextKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");
}

export function forecastDayKey(value: unknown) {
  const formatDateKey = (date: Date | null) => {
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
  if (datePrefixMatch) return formatDateKey(parseCalendarDateOnlyLocal(datePrefixMatch[0]));
  const parsed = new Date(raw);
  return formatDateKey(parsed);
}

export function withForecastDateFromKey(key: unknown, value: unknown) {
  if (!isObject(value) || !forecastDayKey(key)) {
    return value;
  }
  if ("datetime" in value || "date" in value || "day" in value || "time" in value || "timestamp" in value) {
    return value;
  }
  return { date: key, ...value };
}

export function pickFirstFiniteNumber(...candidates: unknown[]) {
  for (const candidate of candidates) {
    const n = parseFiniteNumericValue(candidate);
    if (n !== null) {
      return n;
    }
  }
  return null;
}

export function weatherSupportedFeature(state: HassEntity | null | undefined, feature: number) {
  return Boolean((Number(state?.attributes?.supported_features) || 0) & feature);
}

export function supportedWeatherForecastTypes(state: HassEntity | null | undefined) {
  const types: ("daily" | "twice_daily" | "hourly")[] = [];
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

export function getEditorColorFallbackValue(field: unknown) {
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

export { getDateTimeFormatter } from "../../shared/date-time-format";
import { getDateTimeFormatter } from "../../shared/date-time-format";

export function formatDateLabel(date: Date, locale: string | undefined) {
  return getDateTimeFormatter(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function formatTimeLabel(date: Date, locale: string | undefined) {
  return getDateTimeFormatter(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function normalizeCalendarFetchResult(raw: unknown): Record<string, unknown>[] {
  const rows = Array.isArray(raw) ? raw : isObject(raw) && Array.isArray(raw.events) ? raw.events : [];
  return rows.filter(isObject);
}

export function eventIsAllDay(value: unknown) {
  const event = isObject(value) ? value : {};
  const start = isObject(event.start) ? event.start : {};
  return Boolean(start.date && !start.dateTime);
}

export function parseDateInputAsLocalDate(value: unknown): Date | null {
  return localDateFromInput(value, 0);
}

export function dateInputIsBeforeToday(value: unknown) {
  const parsed = parseDateInputAsLocalDate(value);
  if (!parsed) {
    return false;
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parsed.getTime() < today.getTime();
}
