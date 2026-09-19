// @ts-nocheck -- chart, history and editor color helpers stay loosely typed until remaining unknowns are narrowed.
import { SERIES_COLORS } from "./graph-constants";
import { clamp, isObject, normalizeTextKey } from "./graph-runtime";

export function getStubEntityIds(hass, domains = [], limit = 1, entities = [], entitiesFallback = []) {
  return window.NodaliaUtils.findStubEntityIds(hass, entities, entitiesFallback, domains, limit);
}

export function getStubFriendlyName(hass, entityId) {
  return hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
}


export function compactConfig(value) {
  if (Array.isArray(value)) {
    return value.map(item => compactConfig(item)).filter(item => item !== undefined);
  }

  if (isObject(value)) {
    const compacted = {};

    Object.entries(value).forEach(([key, item]) => {
      if (window.NodaliaUtils?.isUnsafeConfigPathKey?.(key)) {
        return;
      }
      const cleaned = compactConfig(item);
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




export function getByPath(target, path) {
  return String(path || "")
    .split(".")
    .reduce((cursor, key) => (cursor === undefined || cursor === null ? undefined : cursor[key]), target);
}





export function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function parseNumber(value) {
  const numeric = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseHistoryTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }

  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function getHassLocaleTag(hass, language = "auto") {
  const lang = window.NodaliaI18n?.resolveLanguage?.(hass, language);
  return window.NodaliaI18n?.localeTag?.(lang) || hass?.locale?.language || undefined;
}

export function formatNumberValue(value, decimals = 0, locale = undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "--";
  }

  return numeric.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function inferDecimals(rawValue) {
  const text = String(rawValue ?? "").trim().replace(",", ".");
  if (!text.includes(".")) {
    return 0;
  }
  return Math.min(3, text.split(".")[1].length);
}

export function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

/** Parses CSS padding shorthand into edge pixel values (numbers only tokens). */
export function parsePaddingEdges(value, fallback = 16) {
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
    const v = parts[0];
    return { top: v, right: v, bottom: v, left: v };
  }
  if (parts.length === 2) {
    const [vertical, horizontal] = parts;
    return { top: vertical, right: horizontal, bottom: vertical, left: horizontal };
  }
  if (parts.length === 3) {
    const [top, horizontal, bottom] = parts;
    return { top, right: horizontal, bottom, left: horizontal };
  }
  const [top, right, bottom, left] = parts;
  return { top, right, bottom, left };
}


export function getRenderSignatureRuntime() {
  return window.NodaliaRenderSignature || {
    toKey(value) {
      if (value === null || value === undefined) {
        return "";
      }
      if (typeof value === "number") {
        return Number.isFinite(value) ? String(value) : "";
      }
      return String(value);
    },
    joinParts(parts, sectionSeparator = "||", valueSeparator = "::") {
      return (Array.isArray(parts) ? parts : [])
        .map(part => {
          if (!part || !Array.isArray(part.values)) {
            return "";
          }
          const prefix = String(part.prefix || "");
          const body = part.values.map(value => this.toKey(value)).join(valueSeparator);
          return `${prefix}${body}`;
        })
        .filter(Boolean)
        .join(sectionSeparator);
    },
  };
}

/** Map SVG viewBox X (0..chart.width) to overlay percentage. */
export function graphChartXToPercent(x, chart) {
  if (!chart || typeof chart.width !== "number") {
    return 50;
  }
  const width = chart.width;
  if (!Number.isFinite(width) || width <= 0) {
    return 50;
  }
  return (x / width) * 100;
}

export function escapeSelectorValue(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value).replaceAll('"', '\\"');
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

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  if (normalizedField.endsWith("icon.color")) {
    return "var(--primary-text-color)";
  }

  return "var(--info-color, #71c0ff)";
}

export function moveItem(array, fromIndex, toIndex) {
  if (!Array.isArray(array)) {
    return array;
  }

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= array.length ||
    toIndex >= array.length ||
    fromIndex === toIndex
  ) {
    return array;
  }

  const [item] = array.splice(fromIndex, 1);
  array.splice(toIndex, 0, item);
  return array;
}

export function formatHoverTimestamp(value, locale = undefined) {
  const date = new Date(value);
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

export function resolveEntityEntries(config, { preserveEmpty = false } = {}) {
  const source = Array.isArray(config?.entities) && config.entities.length
    ? config.entities
    : config?.entity
      ? [{ entity: config.entity, name: config.name || "" }]
      : [];

  return source
    .map((entry, index) => {
      if (typeof entry === "string") {
        return {
          entity: entry.trim(),
          name: "",
          color: SERIES_COLORS[index % SERIES_COLORS.length],
        };
      }

      if (!isObject(entry)) {
        return null;
      }

      return {
        entity: String(entry.entity || "").trim(),
        name: String(entry.name || "").trim(),
        color: String(entry.color || SERIES_COLORS[index % SERIES_COLORS.length]).trim(),
      };
    })
    .filter(entry => entry && (preserveEmpty || entry.entity));
}

export function buildSmoothPath(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] || points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] || p2;

    const cp1x = p1.x + ((p2.x - p0.x) / 6);
    const cp1y = p1.y + ((p2.y - p0.y) / 6);
    const cp2x = p2.x - ((p3.x - p1.x) / 6);
    const cp2y = p2.y - ((p3.y - p1.y) / 6);

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

export function buildAreaPath(points, bottomY) {
  if (!Array.isArray(points) || points.length === 0) {
    return "";
  }

  const linePath = buildSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x.toFixed(2)} ${bottomY.toFixed(2)} L ${first.x.toFixed(2)} ${bottomY.toFixed(2)} Z`;
}

export function buildInterpolatedSamples(events, startMs, endMs, pointsCount, fallbackValue = null) {
  if (!Array.isArray(events) || !events.length) {
    if (!Number.isFinite(fallbackValue)) {
      return [];
    }

    return Array.from({ length: pointsCount }, (_item, index) => ({
      ts: startMs + (((endMs - startMs) * index) / Math.max(pointsCount - 1, 1)),
      value: fallbackValue,
    }));
  }
  const spanMs = Math.max(endMs - startMs, 1);
  const bucketSize = spanMs / Math.max(pointsCount - 1, 1);
  const buckets = Array.from({ length: pointsCount }, () => []);

  events.forEach(event => {
    const clampedTs = clamp(event.ts, startMs, endMs);
    const rawIndex = Math.floor((clampedTs - startMs) / Math.max(bucketSize, 1));
    const bucketIndex = clamp(rawIndex, 0, pointsCount - 1);
    buckets[bucketIndex].push(event.value);
  });

  let lastValue = Number.isFinite(fallbackValue)
    ? fallbackValue
    : buckets.flat().find(Number.isFinite);

  return buckets.map((bucket, index) => {
    const sampleTs = startMs + (((endMs - startMs) * index) / Math.max(pointsCount - 1, 1));
    if (bucket.length) {
      lastValue = bucket.reduce((sum, value) => sum + value, 0) / bucket.length;
    }

    return {
      ts: sampleTs,
      value: Number.isFinite(lastValue) ? lastValue : 0,
    };
  });
}
