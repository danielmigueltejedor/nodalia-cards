import type { HassEntity, HomeAssistant } from "../../core/types/home-assistant";
import { renderSignature } from "../../shared/render-signature";
import { parseFiniteNumericValue } from "../../shared/numeric-values";
import { parseSizeToPixels } from "../../shared/editor-entity-helpers";
export { parseSizeToPixels } from "../../shared/editor-entity-helpers";
export { compactConfig } from "../../shared/config-values";
export { moveItem } from "../../shared/editor-lists";
export type { GraphPoint, HistorySample } from "../../shared/history-geometry";
export { buildSmoothPath, buildAreaPath, buildInterpolatedSamples, parseHistoryTimestamp } from "../../shared/history-geometry";
export { resolveEditorColorValue, formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import { SERIES_COLORS, DEFAULT_HISTORY_POINTS, MAX_HISTORY_POINTS } from "./graph-constants";
import { isObject, normalizeTextKey } from "./graph-runtime";

export function getStubEntityIds(hass: HomeAssistant | null | undefined, domains: string[] = [], limit = 1, entities: unknown = [], entitiesFallback: unknown = []) {
  return window.NodaliaUtils.findStubEntityIds(hass, entities, entitiesFallback, domains, limit);
}

export function getStubFriendlyName(hass: HomeAssistant | null | undefined, entityId: string) {
  return hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
}


export function getByPath(target: unknown, path: unknown): unknown {
  let cursor = target;
  for (const key of String(path || "").split(".")) {
    if (!key || key === "__proto__" || key === "constructor" || key === "prototype"
      || cursor === null || typeof cursor !== "object" || !Object.prototype.hasOwnProperty.call(cursor, key)) return undefined;
    cursor = Reflect.get(cursor, key);
  }
  return cursor;
}

export function isUnavailableState(state: HassEntity | null | undefined) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function parseNumber(value: unknown) {
  return parseFiniteNumericValue(typeof value === "string" ? value.replace(",", ".") : value);
}

export function normalizeGraphPointCount(value: unknown): number {
  const numeric = parseFiniteNumericValue(value) || DEFAULT_HISTORY_POINTS;
  return Math.min(MAX_HISTORY_POINTS, Math.max(20, Math.floor(numeric)));
}

export function getHassLocaleTag(hass: HomeAssistant | null | undefined, language = "auto") {
  const lang = window.NodaliaI18n?.resolveLanguage?.(hass, language);
  return (lang === undefined ? undefined : window.NodaliaI18n?.localeTag?.(lang)) || hass?.locale?.language || undefined;
}

export { formatFiniteNumericValue as formatNumberValue } from "../../shared/numeric-values";

export function inferDecimals(rawValue: unknown) {
  const text = String(rawValue ?? "").trim().replace(",", ".");
  if (!text.includes(".")) {
    return 0;
  }
  return Math.min(3, (text.split(".")[1]?.length ?? 0));
}

/** Parses CSS padding shorthand into edge pixel values (numbers only tokens). */
export function parsePaddingEdges(value: unknown, fallback = 16) {
  const fb = Number.isFinite(fallback) ? fallback : 16;
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { top: fb, right: fb, bottom: fb, left: fb };
  }
  const parts = raw.split(/\s+/).map(token => parseSizeToPixels(token, NaN)).filter(n => Number.isFinite(n));
  if (!parts.length) {
    return { top: fb, right: fb, bottom: fb, left: fb };
  }
  if (parts.length === 1) {
    const v = parts[0] ?? fb;
    return { top: v, right: v, bottom: v, left: v };
  }
  if (parts.length === 2) {
    const [vertical = fb, horizontal = fb] = parts;
    return { top: vertical, right: horizontal, bottom: vertical, left: horizontal };
  }
  if (parts.length === 3) {
    const [top = fb, horizontal = fb, bottom = fb] = parts;
    return { top, right: horizontal, bottom, left: horizontal };
  }
  const [top = fb, right = fb, bottom = fb, left = fb] = parts;
  return { top, right, bottom, left };
}


export function getRenderSignatureRuntime() {
  return window.NodaliaRenderSignature || renderSignature;
}

/** Map SVG viewBox X (0..chart.width) to overlay percentage. */
export function graphChartXToPercent(x: number, chart: unknown) {
  if (!isObject(chart) || typeof chart.width !== "number") {
    return 50;
  }
  const width = chart.width;
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(x)) {
    return 50;
  }
  return (x / width) * 100;
}

export function escapeSelectorValue(value: unknown) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value).replaceAll('"', '\\"');
}









export function getEditorColorFallbackValue(field: unknown) {
  const normalizedField = String(field ?? "");

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  if (normalizedField.endsWith("icon.color")) {
    return "var(--primary-text-color)";
  }

  return "var(--info-color, #71c0ff)";
}

export function formatHoverTimestamp(value: unknown, locale: string | undefined = undefined) {
  const date = value instanceof Date ? value : typeof value === "string" || typeof value === "number" ? new Date(value) : new Date(NaN);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function resolveEntityEntries(value: unknown, { preserveEmpty = false } = {}) {
  const config = isObject(value) ? value : {};
  const source = Array.isArray(config?.entities) && config.entities.length
    ? config.entities
    : config?.entity
      ? [{ entity: config.entity, name: config.name || "" }]
      : [];

  return source
    .map((entry: unknown, index: number) => {
      if (typeof entry === "string") {
        return {
          entity: entry.trim(),
          name: "",
          color: (SERIES_COLORS[index % SERIES_COLORS.length] ?? "#f29f05"),
        };
      }

      if (!isObject(entry)) {
        return null;
      }

      return {
        entity: String(entry.entity || "").trim(),
        name: String(entry.name || "").trim(),
        color: String(entry.color || (SERIES_COLORS[index % SERIES_COLORS.length] ?? "#f29f05")).trim(),
      };
    })
    .filter(entry => entry !== null).filter(entry => preserveEmpty || entry.entity);
}
