/* Generated from src/cards/graph. Do not edit. */
"use strict";
(() => {
  // src/version.ts
  var CARD_VERSION = "3.0.0-alpha.5";

  // src/cards/graph/graph-constants.ts
  var CARD_TAG = "nodalia-graph-card";
  var EDITOR_TAG = "nodalia-graph-card-editor";
  var HAPTIC_PATTERNS = {
    selection: 8,
    light: 10,
    medium: 16,
    heavy: 24,
    success: [10, 40, 10],
    warning: [20, 50, 12],
    failure: [12, 40, 12, 40, 18]
  };
  var SERIES_COLORS = [
    "#f29f05",
    "#42a5f5",
    "#7fd0c8",
    "#f56aa0",
    "#b993ff",
    "#7ad66f"
  ];
  var TOUCH_CHART_HOLD_MS = 500;
  var TOUCH_MOVE_CANCEL_DISTANCE = 14;
  var CHART_TAP_MAX_MOVE = 14;
  var TOUCH_CLICK_SUPPRESSION_WINDOW = 350;
  var HISTORY_REFRESH_INTERVAL = 18e4;
  var DEFAULT_HISTORY_POINTS = 100;
  var MAX_HISTORY_POINTS = 1e4;

  // src/shared/control-config.ts
  function normalizeControlStyles(candidate, defaults, sanitize = window.NodaliaUtils.sanitizeCssValue) {
    const utils2 = window.NodaliaUtils;
    const source = utils2.isObject(candidate) ? candidate : {};
    const result = {};
    for (const [key, fallback] of Object.entries(defaults)) {
      if (utils2.isUnsafeConfigPathKey(key)) continue;
      result[key] = typeof fallback === "string" ? sanitize(source[key], fallback) : normalizeControlStyles(source[key], fallback, sanitize);
    }
    return result;
  }
  var actionFields = (prefix, fallback, navigationKey = `${prefix}_navigation_path`) => ({
    actionKey: `${prefix}_action`,
    serviceKey: `${prefix}_service`,
    serviceDataKey: `${prefix}_service_data`,
    serviceTargetKey: `${prefix}_service_target`,
    urlKey: `${prefix}_url`,
    navigationKey,
    newTabKey: `${prefix}_new_tab`,
    fallback
  });
  var FIELDS = [
    actionFields("tap", "toggle", "navigation_path"),
    actionFields("icon_tap", "", "icon_navigation_path"),
    actionFields("hold", "more-info", "hold_navigation_path"),
    actionFields("icon_hold", ""),
    actionFields("double_tap", "none"),
    actionFields("icon_double_tap", "")
  ];

  // src/shared/config-values.ts
  var isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  var unsafeKeys = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  function compactConfig(value, preserveEmptyKeys = []) {
    if (Array.isArray(value)) return value.map((item) => compactConfig(item, preserveEmptyKeys)).filter((item) => item !== void 0);
    if (isRecord(value)) {
      const result = {};
      for (const [key, item] of Object.entries(value)) {
        if (unsafeKeys.has(key)) continue;
        if (item === "" && preserveEmptyKeys.includes(key)) {
          result[key] = "";
          continue;
        }
        const cleaned = compactConfig(item, preserveEmptyKeys);
        if (cleaned !== void 0 && !(isRecord(cleaned) && Object.keys(cleaned).length === 0)) result[key] = cleaned;
      }
      return result;
    }
    return value === "" || value === null || value === void 0 ? void 0 : value;
  }
  function cloneConfigValue(value) {
    const cloned = window.NodaliaUtils.deepClone(value);
    if (Array.isArray(value)) return Array.isArray(cloned) ? cloned : [];
    if (isRecord(value)) return isRecord(cloned) ? cloned : {};
    return cloned;
  }

  // src/cards/graph/graph-runtime.ts
  var utils = window.NodaliaUtils;
  var isObject = utils.isObject.bind(utils);
  var mergeConfig = utils.mergeDeep.bind(utils);
  var isUnsafeConfigPathKey = utils.isUnsafeConfigPathKey.bind(utils);
  var setByPath = utils.setByPath.bind(utils);
  var deleteByPath = utils.deleteByPath.bind(utils);
  var clamp = utils.clamp.bind(utils);
  var escapeHtml = utils.escapeHtml.bind(utils);
  var fireEvent = utils.fireEvent.bind(utils);
  var normalizeTextKey = utils.normalizeTextKey.bind(utils);

  // src/shared/render-signature.ts
  function toKey(value) {
    if (value === null || value === void 0) return "";
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
    return String(value);
  }
  function joinParts(parts, sectionSeparator = "||", valueSeparator = "::") {
    return (Array.isArray(parts) ? parts : []).map((part) => {
      if (!part || typeof part !== "object" || !("values" in part) || !Array.isArray(part.values)) return "";
      const prefix = "prefix" in part ? String(part.prefix || "") : "";
      return `${prefix}${part.values.map((value) => toKey(value)).join(valueSeparator)}`;
    }).filter(Boolean).join(sectionSeparator);
  }
  var renderSignature = { joinParts, toKey };

  // src/shared/numeric-values.ts
  function parseFiniteNumericValue(value) {
    if (typeof value !== "number" && typeof value !== "string" || typeof value === "string" && !value.trim()) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  function formatFiniteNumericValue(value, decimals = 0, locale = void 0) {
    const numeric = parseFiniteNumericValue(value);
    if (numeric === null) {
      return "--";
    }
    const digits = Number.isFinite(decimals) ? Math.min(20, Math.max(0, Math.floor(decimals))) : 0;
    return numeric.toLocaleString(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  // src/shared/editor-entity-helpers.ts
  function parseSizeToPixels(value, fallback = 0) {
    const numeric = Number.parseFloat(String(value ?? ""));
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  // src/shared/editor-lists.ts
  var isUnknownArray = (value) => Array.isArray(value);
  function moveItem(array, fromIndex, toIndex) {
    if (!isUnknownArray(array)) {
      return array;
    }
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || toIndex < 0 || fromIndex >= array.length || toIndex >= array.length || fromIndex === toIndex) {
      return array;
    }
    const removed = array.splice(fromIndex, 1);
    array.splice(toIndex, 0, ...removed);
    return array;
  }

  // src/shared/history-geometry.ts
  var MAX_SAMPLES = 1e4;
  var clamp2 = (value, min, max) => Math.min(max, Math.max(min, value));
  var isObject2 = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  function parseHistoryTimestamp(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value > 1e12 ? value : value * 1e3;
    const parsed = Date.parse(String(value ?? ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  function validPoints(value) {
    if (!Array.isArray(value)) return [];
    const points = Array.from(value);
    return points.every((point) => isObject2(point) && typeof point.x === "number" && Number.isFinite(point.x) && typeof point.y === "number" && Number.isFinite(point.y)) ? points : [];
  }
  function buildSmoothPath(value) {
    const points = validPoints(value);
    const first = points[0];
    if (!first) return "";
    if (points.length === 1) {
      return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
    }
    let path = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
    for (let index = 0; index < points.length - 1; index += 1) {
      const p0 = points[index - 1] || points[index];
      const p1 = points[index];
      const p2 = points[index + 1];
      const p3 = points[index + 2] || p2;
      if (!p0 || !p1 || !p2 || !p3) return "";
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return path;
  }
  function buildAreaPath(value, bottomY) {
    const points = validPoints(value);
    if (!Array.isArray(points) || points.length === 0) {
      return "";
    }
    const linePath = buildSmoothPath(points);
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last || !Number.isFinite(bottomY)) return "";
    return `${linePath} L ${last.x.toFixed(2)} ${bottomY.toFixed(2)} L ${first.x.toFixed(2)} ${bottomY.toFixed(2)} Z`;
  }
  function buildInterpolatedSamples(value, startMs, endMs, pointsCount, fallbackValue = null) {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs || !Number.isFinite(pointsCount) || pointsCount < 1) return [];
    pointsCount = Math.min(MAX_SAMPLES, Math.floor(pointsCount));
    const events = Array.isArray(value) ? value.filter((event) => isObject2(event) && typeof event.ts === "number" && Number.isFinite(event.ts) && typeof event.value === "number" && Number.isFinite(event.value)) : [];
    if (!events.length) {
      if (fallbackValue === null || !Number.isFinite(fallbackValue)) {
        return [];
      }
      return Array.from({ length: pointsCount }, (_item, index) => ({
        ts: startMs + (endMs - startMs) * index / Math.max(pointsCount - 1, 1),
        value: fallbackValue
      }));
    }
    const spanMs = Math.max(endMs - startMs, 1);
    const bucketSize = spanMs / Math.max(pointsCount - 1, 1);
    const buckets = Array.from({ length: pointsCount }, () => []);
    events.forEach((event) => {
      const clampedTs = clamp2(event.ts, startMs, endMs);
      const rawIndex = Math.floor((clampedTs - startMs) / Math.max(bucketSize, 1));
      const bucketIndex = clamp2(rawIndex, 0, pointsCount - 1);
      buckets[bucketIndex]?.push(event.value);
    });
    let lastValue = fallbackValue !== null && Number.isFinite(fallbackValue) ? fallbackValue : buckets.flat().find(Number.isFinite);
    return buckets.map((bucket, index) => {
      const sampleTs = startMs + (endMs - startMs) * index / Math.max(pointsCount - 1, 1);
      if (bucket.length) {
        lastValue = bucket.reduce((sum, value2) => sum + value2, 0) / bucket.length;
      }
      return {
        ts: sampleTs,
        value: lastValue !== void 0 && Number.isFinite(lastValue) ? lastValue : 0
      };
    });
  }

  // src/shared/editor-color.ts
  var clamp3 = (value, max) => Math.max(0, Math.min(max, value));
  var component = (value, scale) => {
    if (!value || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/i.test(value)) return null;
    const numeric = Number(value.replace(/%$/, ""));
    return Number.isFinite(numeric) ? clamp3(value.endsWith("%") ? numeric * scale / 100 : numeric, scale) : null;
  };
  function parseEditorColorChannels(value) {
    const raw = String(value ?? "").trim();
    const hexMatch = raw.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hexMatch?.[1]) {
      const hex = hexMatch[1].length < 5 ? hexMatch[1].split("").map((channel) => channel + channel).join("") : hexMatch[1];
      return { red: parseInt(hex.slice(0, 2), 16), green: parseInt(hex.slice(2, 4), 16), blue: parseInt(hex.slice(4, 6), 16), alpha: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1 };
    }
    const rgb = raw.match(/^rgba?\(([^)]+)\)$/i);
    const srgb = raw.match(/^color\(\s*srgb\s+([^)]+)\)$/i);
    const body = rgb?.[1] ?? srgb?.[1];
    if (!body) return null;
    const sections = body.trim().split(/\s*\/\s*/);
    if (sections.length > 2) return null;
    const parts = sections[0]?.split(/[\s,]+/) ?? [];
    if (sections.length === 2 && parts.length !== 3 || parts.length < 3 || parts.length > 4) return null;
    const scale = srgb ? 1 : 255;
    const red = component(parts[0], scale), green = component(parts[1], scale), blue = component(parts[2], scale);
    const alphaPart = sections[1] ?? parts[3];
    const alpha = alphaPart === void 0 ? 1 : component(alphaPart, 1);
    if (red === null || green === null || blue === null || alpha === null) return null;
    return { red: red * 255 / scale, green: green * 255 / scale, blue: blue * 255 / scale, alpha };
  }
  function formatEditorHexChannel(value) {
    const numeric = Number(value);
    return clamp3(Math.round(Number.isFinite(numeric) ? numeric : 0), 255).toString(16).padStart(2, "0");
  }
  function formatEditorColorFromHex(hex, alpha = 1) {
    const normalized = String(hex ?? "").trim().replace(/^#/, "").toLowerCase();
    if (!/^[0-9a-f]{6}$/.test(normalized)) return String(hex ?? "");
    const numeric = Number(alpha);
    const safeAlpha = clamp3(Number.isFinite(numeric) ? numeric : 1, 1);
    if (safeAlpha >= 0.999) return `#${normalized}`;
    const red = parseInt(normalized.slice(0, 2), 16), green = parseInt(normalized.slice(2, 4), 16), blue = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${Number(safeAlpha.toFixed(2))})`;
  }
  function resolveEditorColorValue(value) {
    const resolve = typeof window !== "undefined" ? window.NodaliaBubbleContrast?.resolveEditorColorValue : void 0;
    return resolve?.(value) || String(value ?? "").trim();
  }
  function browserColorChannels(value) {
    if (typeof document === "undefined" || !/^(?:color|oklab|oklch|lab|lch)\(/i.test(value)) return null;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.fillStyle = "#000001";
    context.fillStyle = value;
    if (context.fillStyle === "#000001") {
      context.fillStyle = "#000002";
      context.fillStyle = value;
      if (context.fillStyle === "#000002") return null;
    }
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
    if (red === void 0 || green === void 0 || blue === void 0 || alpha === void 0) return null;
    return { red, green, blue, alpha: alpha / 255 };
  }
  function getEditorColorModel(value, fallbackValue = "#71c0ff") {
    const source = String(value ?? "").trim() || String(fallbackValue ?? "").trim() || "#71c0ff";
    const resolved = resolveEditorColorValue(source);
    const channels = parseEditorColorChannels(resolved) || parseEditorColorChannels(source) || browserColorChannels(resolved) || parseEditorColorChannels(resolveEditorColorValue(fallbackValue)) || parseEditorColorChannels(fallbackValue) || { red: 113, green: 192, blue: 255, alpha: 1 };
    const hex = `#${formatEditorHexChannel(channels.red)}${formatEditorHexChannel(channels.green)}${formatEditorHexChannel(channels.blue)}`;
    return { alpha: channels.alpha, hex, label: source, resolved, source, value: formatEditorColorFromHex(hex, channels.alpha) };
  }

  // src/cards/graph/graph-helpers.ts
  function getStubEntityIds(hass, domains = [], limit = 1, entities = [], entitiesFallback = []) {
    return window.NodaliaUtils.findStubEntityIds(hass, entities, entitiesFallback, domains, limit);
  }
  function getStubFriendlyName(hass, entityId) {
    return hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
  }
  function getByPath(target, path) {
    let cursor = target;
    for (const key of String(path || "").split(".")) {
      if (!key || key === "__proto__" || key === "constructor" || key === "prototype" || cursor === null || typeof cursor !== "object" || !Object.prototype.hasOwnProperty.call(cursor, key)) return void 0;
      cursor = Reflect.get(cursor, key);
    }
    return cursor;
  }
  function isUnavailableState(state) {
    return normalizeTextKey(state?.state) === "unavailable";
  }
  function parseNumber(value) {
    return parseFiniteNumericValue(typeof value === "string" ? value.replace(",", ".") : value);
  }
  function normalizeGraphPointCount(value) {
    const numeric = parseFiniteNumericValue(value) || DEFAULT_HISTORY_POINTS;
    return Math.min(MAX_HISTORY_POINTS, Math.max(20, Math.floor(numeric)));
  }
  function getHassLocaleTag(hass, language = "auto") {
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, language);
    return (lang === void 0 ? void 0 : window.NodaliaI18n?.localeTag?.(lang)) || hass?.locale?.language || void 0;
  }
  function inferDecimals(rawValue) {
    const text = String(rawValue ?? "").trim().replace(",", ".");
    if (!text.includes(".")) {
      return 0;
    }
    return Math.min(3, text.split(".")[1]?.length ?? 0);
  }
  function parsePaddingEdges(value, fallback = 16) {
    const fb = Number.isFinite(fallback) ? fallback : 16;
    const raw = String(value ?? "").trim();
    if (!raw) {
      return { top: fb, right: fb, bottom: fb, left: fb };
    }
    const parts = raw.split(/\s+/).map((token) => parseSizeToPixels(token, NaN)).filter((n) => Number.isFinite(n));
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
      const [top2 = fb, horizontal = fb, bottom2 = fb] = parts;
      return { top: top2, right: horizontal, bottom: bottom2, left: horizontal };
    }
    const [top = fb, right = fb, bottom = fb, left = fb] = parts;
    return { top, right, bottom, left };
  }
  function getRenderSignatureRuntime() {
    return window.NodaliaRenderSignature || renderSignature;
  }
  function graphChartXToPercent(x, chart) {
    if (!isObject(chart) || typeof chart.width !== "number") {
      return 50;
    }
    const width = chart.width;
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(x)) {
      return 50;
    }
    return x / width * 100;
  }
  function escapeSelectorValue(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(String(value));
    }
    return String(value).replaceAll('"', '\\"');
  }
  function getEditorColorFallbackValue(field) {
    const normalizedField = String(field ?? "");
    if (normalizedField.endsWith("background")) {
      return "var(--ha-card-background)";
    }
    if (normalizedField.endsWith("icon.color")) {
      return "var(--primary-text-color)";
    }
    return "var(--info-color, #71c0ff)";
  }
  function formatHoverTimestamp(value, locale = void 0) {
    const date = value instanceof Date ? value : typeof value === "string" || typeof value === "number" ? new Date(value) : /* @__PURE__ */ new Date(NaN);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleString(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  function resolveEntityEntries(value, { preserveEmpty = false } = {}) {
    const config = isObject(value) ? value : {};
    const source = Array.isArray(config?.entities) && config.entities.length ? config.entities : config?.entity ? [{ entity: config.entity, name: config.name || "" }] : [];
    return source.map((entry, index) => {
      if (typeof entry === "string") {
        return {
          entity: entry.trim(),
          name: "",
          color: SERIES_COLORS[index % SERIES_COLORS.length] ?? "#f29f05"
        };
      }
      if (!isObject(entry)) {
        return null;
      }
      return {
        entity: String(entry.entity || "").trim(),
        name: String(entry.name || "").trim(),
        color: String(entry.color || (SERIES_COLORS[index % SERIES_COLORS.length] ?? "#f29f05")).trim()
      };
    }).filter((entry) => entry !== null).filter((entry) => preserveEmpty || entry.entity);
  }

  // src/cards/graph/graph-config.ts
  var DEFAULT_CONFIG = {
    entity: "",
    language: "auto",
    entities: [],
    name: "Temperature",
    icon: "mdi:thermometer",
    min: 15,
    max: 25,
    hours_to_show: 24,
    points: DEFAULT_HISTORY_POINTS,
    show_header: true,
    show_icon: true,
    show_value: true,
    show_legend: true,
    show_fill: true,
    show_unavailable_badge: true,
    tap_action: "more-info",
    hold_action: "more-info",
    haptics: {
      enabled: true,
      style: "medium",
      fallback_vibrate: false
    },
    animations: {
      enabled: true,
      hover_duration: 180,
      button_bounce_duration: 280
    },
    styles: {
      card: {
        background: "var(--ha-card-background)",
        border: "1px solid var(--divider-color)",
        border_radius: "var(--nodalia-card-border-radius, 28px)",
        box_shadow: "var(--ha-card-box-shadow)",
        padding: "14px",
        gap: "12px"
      },
      icon: {
        color: "var(--primary-text-color)",
        size: "20px"
      },
      title_size: "12px",
      value_size: "40px",
      unit_size: "17px",
      legend_size: "11px",
      chip_border_radius: "999px",
      chart_height: "160px",
      line_width: "2.2px"
    }
  };
  var STUB_CONFIG = {
    name: "Temperature",
    icon: "mdi:thermometer",
    min: 15,
    max: 25,
    entities: [
      {
        entity: "sensor.termostato_dormitorios_temperatura",
        name: "Bedroom",
        color: "#ffaa00"
      },
      {
        entity: "sensor.termostato_habitaciones_comunes_temperatura",
        name: "Hallway",
        color: "#ffc677"
      }
    ]
  };
  function normalizeConfig(rawConfig = {}, { preserveEmptyEntities = false } = {}) {
    const defaults = DEFAULT_CONFIG;
    const merged = mergeConfig(defaults, isObject(rawConfig) ? rawConfig : {});
    const fields = {
      entity: typeof merged.entity === "string" ? merged.entity : "",
      language: typeof merged.language === "string" ? merged.language : "auto",
      entities: resolveEntityEntries(merged, { preserveEmpty: preserveEmptyEntities }),
      points: normalizeGraphPointCount(merged.points),
      styles: normalizeControlStyles(merged.styles, DEFAULT_CONFIG.styles)
    };
    const normalized = { ...merged, ...fields };
    return normalized;
  }
  function normalizeEditorConfig(rawConfig = {}) {
    return normalizeConfig(rawConfig, { preserveEmptyEntities: true });
  }

  // src/cards/graph/graph-hover.css
  var graph_hover_default = '.graph-card__hover-points-layer{bottom:0;left:0;overflow:hidden;pointer-events:none;position:absolute;right:0;top:0;z-index:2}.graph-card__chart{display:block;height:100%;position:relative;width:100%;z-index:1}.graph-card__hover-line{stroke:color-mix(in srgb,var(--primary-text-color) 16%,transparent);stroke-dasharray:2 4;stroke-width:0.7}.graph-card__hover-point{align-items:center;display:inline-flex;height:14px;justify-content:center;left:0;pointer-events:none;position:absolute;top:0;transform:translate(-50%,-50%);width:14px;z-index:3}.graph-card__hover-dot{background:radial-gradient(circle at 35% 35%,rgba(255,255,255,0.98) 0 35%,color-mix(in srgb,var(--dot-color) 44%,rgba(255,255,255,0.92)) 36% 100%);border-radius:999px;box-shadow:0 0 0 3px color-mix(in srgb,var(--dot-color) 14%,transparent),0 0 10px color-mix(in srgb,var(--dot-color) 20%,transparent);display:block;flex-shrink:0;height:8px;width:8px;animation:graph-card-hover-dot-pulse calc(var(--graph-card-hover-duration, 180ms) * 2.35) ease-in-out infinite alternate;transform-origin:center;will-change:transform}.graph-card__tooltip{-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);background:linear-gradient(180deg,color-mix(in srgb,var(--tooltip-tint) 20%,rgba(255,255,255,0.1)),rgba(255,255,255,0.02)),color-mix(in srgb,var(--ha-card-background, var(--card-background-color, #fff)) 94%,rgba(255,255,255,0.02));border:1px solid color-mix(in srgb,var(--tooltip-tint) 22%,color-mix(in srgb,var(--primary-text-color) 10%,transparent));border-radius:16px;box-shadow:0 10px 24px rgba(0,0,0,0.24),0 2px 6px color-mix(in srgb,var(--tooltip-tint) 14%,transparent);color:var(--primary-text-color);display:grid;gap:8px;max-width:min(260px,calc(100% - 20px));min-width:186px;padding:10px 12px 11px;pointer-events:none;position:fixed;transform:var(--graph-tooltip-transform, translate(-50%, -100%));will-change:left,top,transform;z-index:2147483001}.graph-card__tooltip::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(180deg,color-mix(in srgb,var(--tooltip-tint) 18%,rgba(255,255,255,0.09)),rgba(255,255,255,0.025)),color-mix(in srgb,var(--ha-card-background, var(--card-background-color, #fff)) 90%,transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--primary-text-color) 16%,transparent),inset 0 -1px 0 rgba(0,0,0,0.06);z-index:-1}.graph-card__tooltip--entering{animation:graph-card-tooltip-in var(--graph-card-hover-duration) cubic-bezier(0.22,0.84,0.26,1) both}.graph-card__tooltip-time{color:var(--secondary-text-color);font-size:10px;font-weight:800;text-transform:uppercase}.graph-card__tooltip-values{display:grid;gap:5px}.graph-card__tooltip-row{align-items:center;display:grid;gap:7px;grid-template-columns:auto minmax(0,1fr) auto;min-width:0}.graph-card__tooltip-dot{border-radius:999px;display:inline-flex;height:8px;width:8px}.graph-card__tooltip-name{color:var(--secondary-text-color);font-size:10px;font-weight:750;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.graph-card__tooltip-value{font-size:12px;font-weight:850;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.graph-card__chart-empty{align-items:center;color:var(--secondary-text-color);display:flex;font-size:13px;inset:0;justify-content:center;opacity:0.8;position:absolute}';

  // src/shared/view-animation-work.ts
  function createViewAnimationWork() {
    return { generation: 0, timers: /* @__PURE__ */ new Set(), cancels: /* @__PURE__ */ new Set() };
  }
  function scheduleViewFallback(work, callback, delay) {
    const timer = window.setTimeout(() => {
      work.timers.delete(timer);
      callback();
    }, delay);
    work.timers.add(timer);
    return timer;
  }
  function cancelViewPanelAnimations(work) {
    ++work.generation;
    work.cancels.forEach((cancel) => cancel());
    work.cancels.clear();
  }
  function releaseViewAnimationWork(work) {
    cancelViewPanelAnimations(work);
    work.timers.forEach((timer) => window.clearTimeout(timer));
    work.timers.clear();
  }

  // src/cards/graph/graph-card.ts
  var graphRows = (value) => Array.isArray(value) ? value.filter(isObject) : [];
  var finiteSample = (item) => item.ts !== null && item.value !== null && Number.isFinite(item.ts) && Number.isFinite(item.value);
  var graphSeriesElement = (node) => node instanceof HTMLElement && Boolean(node.dataset.graphSeries);
  var graphSurfaceElement = (node) => node instanceof HTMLElement && node.dataset.graphSurface === "chart";
  var graphPrimaryElement = (node) => node instanceof HTMLElement && node.dataset.graphAction === "primary";
  var _lazyNodaliaGraphCard;
  function loadNodaliaGraphCard() {
    if (_lazyNodaliaGraphCard) {
      return _lazyNodaliaGraphCard;
    }
    class NodaliaGraphCard extends HTMLElement {
      static async getConfigElement() {
        if (!customElements.get(EDITOR_TAG) && typeof customElements?.whenDefined === "function") {
          await customElements.whenDefined(EDITOR_TAG);
        }
        return document.createElement(EDITOR_TAG);
      }
      static getStubConfig(hass, entities = [], entitiesFallback = []) {
        const config = { ...STUB_CONFIG, entities: STUB_CONFIG.entities.map((entry) => ({ ...entry })) };
        const entityIds = getStubEntityIds(
          hass,
          ["sensor", "number", "input_number"],
          2,
          entities,
          entitiesFallback
        );
        if (!entityIds.length) {
          return config;
        }
        config.entities = entityIds.map((entityId, index) => ({
          ...config.entities?.[index] || {},
          entity: entityId,
          name: getStubFriendlyName(hass, entityId)
        }));
        return config;
      }
      static getEntitySuggestion(hass, entityId) {
        return window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, {
          domains: ["sensor", "number", "input_number"],
          buildConfig: (_hass, selectedEntityId) => ({
            entities: [{
              entity: selectedEntityId,
              name: getStubFriendlyName(hass, selectedEntityId)
            }]
          })
        });
      }
      constructor() {
        super();
        this._nodaliaConstruct();
      }
      _nodaliaConstruct() {
        this.attachShadow({ mode: "open" });
        this._config = normalizeConfig(STUB_CONFIG);
        this._historyRequestKeyStamp = "";
        this._pendingHistoryKey = "";
        this._animationWork = createViewAnimationWork();
        this._hass = null;
        this._historyConnection = void 0;
        this._historyUserKey = "";
        this._hasHass = false;
        this._historySeries = [];
        this._historyKey = "";
        this._historyLoadedAt = 0;
        this._historyAbortController = null;
        this._historyRefreshTimer = 0;
        this._activeSeriesEntityId = null;
        this._hoverIndex = null;
        this._hoverChart = null;
        this._hoverFrame = 0;
        this._pendingHoverIndex = null;
        this._hoverEntering = false;
        this._animateContentOnNextRender = true;
        this._animateChartOnNextRender = false;
        this._lastRenderSignature = "";
        this._tooltipSyncFrame = 0;
        this._lastTooltipViewportPosition = null;
        this._documentHoverWatchAttached = false;
        this._chartHoldTimer = 0;
        this._touchPressState = null;
        this._touchChartHoldFired = false;
        this._chartPointerSession = null;
        this._suppressClickUntil = 0;
        this._viewVisibilityObserver = null;
        this._wasInViewport = false;
        this._onShadowClick = this._onShadowClick.bind(this);
        this._onShadowPointerMove = this._onShadowPointerMove.bind(this);
        this._onShadowPointerLeave = this._onShadowPointerLeave.bind(this);
        this._onHostPointerOut = this._onHostPointerOut.bind(this);
        this._onDocumentPointerMove = this._onDocumentPointerMove.bind(this);
        this._onHoverMediaChange = this._onHoverMediaChange.bind(this);
        this._onShadowTouchStart = this._onShadowTouchStart.bind(this);
        this._onShadowTouchMove = this._onShadowTouchMove.bind(this);
        this._onShadowTouchEnd = this._onShadowTouchEnd.bind(this);
        this._onShadowTouchCancel = this._onShadowTouchCancel.bind(this);
        this._onShadowPointerDown = this._onShadowPointerDown.bind(this);
        this._onShadowPointerUp = this._onShadowPointerUp.bind(this);
        this.shadowRoot?.addEventListener("click", this._onShadowClick);
        this.shadowRoot?.addEventListener("keydown", (event) => this._onShadowKeyDown(event));
        this.shadowRoot?.addEventListener("pointerdown", this._onShadowPointerDown);
        this.shadowRoot?.addEventListener("pointerup", this._onShadowPointerUp);
        this.shadowRoot?.addEventListener("pointercancel", this._onShadowPointerUp);
        this.shadowRoot?.addEventListener("pointermove", this._onShadowPointerMove);
        this.shadowRoot?.addEventListener("pointerleave", this._onShadowPointerLeave);
        this.shadowRoot?.addEventListener("touchstart", this._onShadowTouchStart, { passive: true });
        this.shadowRoot?.addEventListener("touchmove", this._onShadowTouchMove, { passive: false });
        this.shadowRoot?.addEventListener("touchend", this._onShadowTouchEnd);
        this.shadowRoot?.addEventListener("touchcancel", this._onShadowTouchCancel);
        this.addEventListener("pointerleave", this._onShadowPointerLeave);
        this.addEventListener("mouseleave", this._onShadowPointerLeave);
        this.addEventListener("pointerout", this._onHostPointerOut);
        this.addEventListener("mouseout", this._onHostPointerOut);
        this._hoverMediaQuery = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(hover: hover)") : null;
        this._hoverSupported = this._hoverMediaQuery ? this._hoverMediaQuery.matches : true;
        if (this._hoverMediaQuery && typeof this._hoverMediaQuery.addEventListener === "function") {
          this._hoverMediaQuery.addEventListener("change", this._onHoverMediaChange);
        }
      }
      _resetViewContext() {
        this._historyAbortController?.abort();
        this._historyAbortController = null;
        this._pendingHistoryKey = "";
        this._resetChartInteraction();
      }
      _resetChartInteraction() {
        this._clearChartPointerSession();
        this._resetChartTouchTracking();
        if (this._hoverFrame) window.cancelAnimationFrame(this._hoverFrame);
        if (this._tooltipSyncFrame) window.cancelAnimationFrame(this._tooltipSyncFrame);
        this._hoverFrame = this._tooltipSyncFrame = 0;
        this._hoverIndex = this._pendingHoverIndex = null;
        this._hoverChart = null;
        this._hoverEntering = false;
        this._lastTooltipViewportPosition = null;
        this._detachDocumentHoverWatch();
        releaseViewAnimationWork(this._animationWork);
      }
      disconnectedCallback() {
        this._resetViewContext();
        window.clearTimeout(this._historyRefreshTimer);
        this._historyRefreshTimer = 0;
        this._detachViewVisibilityObserver();
        this.removeEventListener("pointerleave", this._onShadowPointerLeave);
        this.removeEventListener("mouseleave", this._onShadowPointerLeave);
        this.removeEventListener("pointerout", this._onHostPointerOut);
        this.removeEventListener("mouseout", this._onHostPointerOut);
        if (this._hoverMediaQuery && typeof this._hoverMediaQuery.removeEventListener === "function") {
          this._hoverMediaQuery.removeEventListener("change", this._onHoverMediaChange);
        }
        this._wasInViewport = false;
        window.NodaliaUtils?.clearDeferTimers?.(this);
      }
      _onHoverMediaChange(event) {
        this._hoverSupported = Boolean(event?.matches);
        if (!this._hoverSupported) {
          this._scheduleHoverRender(null);
        }
      }
      connectedCallback() {
        this.addEventListener("pointerleave", this._onShadowPointerLeave);
        this.addEventListener("mouseleave", this._onShadowPointerLeave);
        this.addEventListener("pointerout", this._onHostPointerOut);
        this.addEventListener("mouseout", this._onHostPointerOut);
        if (this._hoverMediaQuery && typeof this._hoverMediaQuery.addEventListener === "function") {
          this._hoverMediaQuery.addEventListener("change", this._onHoverMediaChange);
        }
        this._animateContentOnNextRender = true;
        this._animateChartOnNextRender = true;
        this._lastRenderSignature = "";
        this._attachViewVisibilityObserver();
        this._scheduleHistoryRefresh();
        void this._requestHistory();
        if (this._hass && this._config) {
          this._render();
        }
      }
      _attachViewVisibilityObserver() {
        if (this._viewVisibilityObserver || typeof IntersectionObserver !== "function") {
          return;
        }
        this._viewVisibilityObserver = new IntersectionObserver(
          (entries) => {
            if (!this.isConnected) {
              return;
            }
            const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0);
            if (visible === this._wasInViewport) {
              return;
            }
            this._wasInViewport = visible;
            if (!visible) {
              return;
            }
            this._animateContentOnNextRender = true;
            this._animateChartOnNextRender = true;
            this._lastRenderSignature = "";
            if (this._hass && this._config) {
              void this._requestHistory();
              this._render();
            }
          },
          { threshold: [0, 0.01] }
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
      _scheduleHistoryRefresh() {
        window.clearTimeout(this._historyRefreshTimer);
        this._historyRefreshTimer = 0;
        if (!this.isConnected) {
          return;
        }
        this._historyRefreshTimer = window.setTimeout(() => {
          this._historyRefreshTimer = 0;
          if (!this.isConnected) {
            return;
          }
          if (!this._viewVisibilityObserver || this._wasInViewport) {
            void this._requestHistory();
          }
          this._scheduleHistoryRefresh();
        }, HISTORY_REFRESH_INTERVAL);
      }
      setConfig(config) {
        this._resetViewContext();
        this._config = normalizeConfig(config || {});
        window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
        this._historySeries = [];
        this._historyKey = "";
        this._historyLoadedAt = 0;
        this._historyRequestKeyStamp = "";
        this._scheduleHistoryRefresh();
        this._hoverIndex = null;
        this._animateContentOnNextRender = true;
        this._animateChartOnNextRender = true;
        this._lastRenderSignature = "";
        void this._requestHistory();
        this._render();
      }
      set hass(hass) {
        const userKey = `${hass?.user?.id || ""}:${hass?.user?.is_admin === true}`;
        const changedContext = this._hasHass !== Boolean(hass) || this._historyConnection !== hass?.connection || this._historyUserKey !== userKey;
        this._hasHass = Boolean(hass);
        this._historyConnection = hass?.connection;
        this._historyUserKey = userKey;
        if (changedContext) {
          this._resetViewContext();
          this._historySeries = [];
          this._historyKey = "";
          this._historyLoadedAt = 0;
          this._lastRenderSignature = "";
        }
        const nextSignature = this._getRenderSignature(hass);
        this._hass = hass;
        if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
          return;
        }
        this._lastRenderSignature = nextSignature;
        void this._requestHistory();
        this._render();
      }
      getCardSize() {
        return 4;
      }
      getGridOptions() {
        return {
          rows: "auto",
          columns: "full",
          min_rows: 3,
          min_columns: 6
        };
      }
      _getEntityEntries() {
        return resolveEntityEntries(this._config);
      }
      _getLocaleTag() {
        return getHassLocaleTag(this._hass, this._config?.language ?? "auto");
      }
      _getRenderSignature(hass = this._hass) {
        const runtime = getRenderSignatureRuntime();
        const trackedStates = this._getTrackedStateSignatureRows(hass, runtime);
        return runtime.joinParts([
          { prefix: "ts:", values: [trackedStates.join("|")] },
          { prefix: "a:", values: [this._activeSeriesEntityId || ""] },
          { prefix: "lang:", values: [getHassLocaleTag(hass, this._config.language)] },
          { prefix: "cfg:", values: [
            String(this._config?.name || ""),
            Number(this._config?.hours_to_show ?? 24),
            this._getEntityEntries().length
          ] }
        ]);
      }
      _getTrackedStateSignatureRows(hass, runtime) {
        return this._getEntityEntries().map((entry) => {
          const state = entry?.entity ? hass?.states?.[entry.entity] || null : null;
          return runtime.joinParts([
            {
              values: [
                entry?.entity || "",
                state?.state || "",
                state?.attributes?.friendly_name || "",
                state?.attributes?.unit_of_measurement || state?.attributes?.native_unit_of_measurement || "",
                state?.attributes?.icon,
                state?.attributes?.device_class,
                state?.attributes?.state_class
              ]
            }
          ], "", "::");
        });
      }
      _getPrimaryEntityId() {
        return this._getEntityEntries()[0]?.entity || "";
      }
      _getPrimaryState() {
        const primaryEntityId = this._getPrimaryEntityId();
        return primaryEntityId ? this._hass?.states?.[primaryEntityId] || null : null;
      }
      _getSelectedEntityId() {
        const entityIds = this._getEntityEntries().map((entry) => entry.entity);
        return this._activeSeriesEntityId !== null && entityIds.includes(this._activeSeriesEntityId) ? this._activeSeriesEntityId : "";
      }
      _getTitle() {
        return this._config?.name || this._graphCardUi("defaultTitle", "Graph");
      }
      _getIcon() {
        return this._config?.icon || this._getPrimaryState()?.attributes?.icon || "mdi:chart-line";
      }
      _getUnit() {
        const entries = this._getEntityEntries();
        const units = entries.map((entry) => {
          const state = this._hass?.states?.[entry.entity];
          return String(
            state?.attributes?.unit_of_measurement || state?.attributes?.native_unit_of_measurement || ""
          ).trim();
        }).filter((item) => item !== null);
        return units.length && units.every((unit) => unit === units[0]) ? units[0] || "" : "";
      }
      _getDecimals() {
        const entry = this._getEntityEntries()[0];
        if (!entry) {
          return 0;
        }
        const state = this._hass?.states?.[entry.entity];
        return inferDecimals(state?.state);
      }
      _getCurrentValuesText() {
        const selectedEntityId = this._getSelectedEntityId();
        const entries = this._getEntityEntries();
        const selectedEntry = entries.find((entry) => entry.entity === selectedEntityId) || null;
        const resolvedEntries = selectedEntry ? [selectedEntry] : entries;
        const currentSeries = resolvedEntries.map((entry) => {
          const state = this._hass?.states?.[entry.entity];
          const value = parseNumber(state?.state);
          if (value === null || !Number.isFinite(value)) {
            return null;
          }
          return {
            decimals: inferDecimals(state?.state),
            unit: String(
              state?.attributes?.unit_of_measurement || state?.attributes?.native_unit_of_measurement || ""
            ).trim(),
            value
          };
        }).filter((item) => item !== null);
        if (!currentSeries.length) {
          return { value: "--", unit: this._getUnit() };
        }
        const locale = this._getLocaleTag();
        if (!selectedEntry && currentSeries.length > 1) {
          const unit = currentSeries[0]?.unit || "";
          const sameUnit = currentSeries.every((item) => item.unit === unit);
          if (sameUnit) {
            const avg = currentSeries.reduce((sum, item) => sum + item.value, 0) / currentSeries.length;
            const decimals = clamp(
              Math.max(...currentSeries.map((item) => item.decimals), 1),
              0,
              3
            );
            return {
              value: formatFiniteNumericValue(avg, decimals, locale),
              unit
            };
          }
        }
        const primary = currentSeries[0];
        if (!primary) return { value: "--", unit: this._getUnit() };
        return {
          value: formatFiniteNumericValue(primary.value, primary.decimals, locale),
          unit: primary.unit || this._getUnit()
        };
      }
      _getLegendEntries() {
        const selectedEntityId = this._getSelectedEntityId();
        return this._getEntityEntries().map((entry, index) => {
          const state = this._hass?.states?.[entry.entity];
          return {
            entity: entry.entity,
            name: entry.name || state?.attributes?.friendly_name || entry.entity,
            color: entry.color || SERIES_COLORS[index % SERIES_COLORS.length] || "var(--primary-color)",
            active: !selectedEntityId || selectedEntityId === entry.entity,
            muted: Boolean(selectedEntityId) && selectedEntityId !== entry.entity
          };
        });
      }
      _canRunTapAction() {
        return (this._config?.tap_action || "more-info") !== "none" && Boolean(this._getPrimaryEntityId());
      }
      _canRunHoldAction() {
        return (this._config?.hold_action || "more-info") !== "none" && Boolean(this._getPrimaryEntityId());
      }
      _triggerHaptic(styleOverride = null) {
        const haptics = isObject(this._config.haptics) ? this._config.haptics : {};
        if (haptics.enabled !== true) {
          return;
        }
        const style = styleOverride || (typeof haptics.style === "string" ? haptics.style : "medium");
        fireEvent(this, "haptic", style, {
          bubbles: true,
          cancelable: false,
          composed: true
        });
        if (haptics.fallback_vibrate === true && typeof navigator?.vibrate === "function") {
          navigator.vibrate(Object.entries(HAPTIC_PATTERNS).find(([key]) => key === style)?.[1] || HAPTIC_PATTERNS.selection);
        }
      }
      _openMoreInfo() {
        const entityId = this._getPrimaryEntityId();
        if (!entityId) {
          return;
        }
        fireEvent(this, "hass-more-info", {
          entityId
        });
      }
      _fireChartHoldAction() {
        if (!this._canRunHoldAction()) {
          return;
        }
        this._scheduleHoverRender(null);
        this._triggerHaptic();
        this._openMoreInfo();
        this._suppressClickUntil = Date.now() + TOUCH_CLICK_SUPPRESSION_WINDOW;
      }
      _clearChartHoldTimer() {
        if (!this._chartHoldTimer) {
          return;
        }
        window.clearTimeout(this._chartHoldTimer);
        this._chartHoldTimer = 0;
      }
      _clearChartPointerSession() {
        this._clearChartHoldTimer();
        if (this._chartPointerSession?.surface instanceof HTMLElement && typeof this._chartPointerSession.pointerId === "number") {
          try {
            this._chartPointerSession.surface.releasePointerCapture(this._chartPointerSession.pointerId);
          } catch (_error) {
          }
        }
        this._chartPointerSession = null;
      }
      _onShadowClick(event) {
        if (!(event instanceof MouseEvent)) return;
        const seriesChip = event.composedPath().find(graphSeriesElement);
        if (seriesChip) {
          event.preventDefault();
          event.stopPropagation();
          const entityId = seriesChip.dataset.graphSeries;
          this._activeSeriesEntityId = this._activeSeriesEntityId === entityId ? null : entityId || null;
          this._hoverIndex = null;
          this._animateChartOnNextRender = true;
          this._triggerHaptic("selection");
          this._triggerButtonBounce(seriesChip);
          this._render();
          return;
        }
        if (Date.now() < this._suppressClickUntil) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        const chartSurface = event.composedPath().find(graphSurfaceElement);
        if (chartSurface && this._hoverChart?.entries?.length && this._getHoverSampleCount() > 1) {
          event.preventDefault();
          event.stopPropagation();
          this._updateHoverFromClientX(chartSurface, event.clientX);
          this._triggerHaptic("selection");
          return;
        }
        const target = event.composedPath().find(graphPrimaryElement);
        if (!target || !this._canRunTapAction()) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        this._triggerHaptic();
        this._triggerButtonBounce(target);
        this._openMoreInfo();
      }
      _onShadowKeyDown(event) {
        if (!(event instanceof KeyboardEvent) || event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.composedPath().find((node) => graphSeriesElement(node) || graphPrimaryElement(node) || graphSurfaceElement(node));
        if (!(target instanceof HTMLElement)) return;
        if (target.dataset.graphSurface === "chart") {
          const count = this._getHoverSampleCount();
          if (event.key === "Escape") {
            event.preventDefault();
            this._scheduleHoverRender(null);
            return;
          }
          if (count < 2 || !["ArrowLeft", "ArrowRight", "Home", "End", "Enter", " "].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          let index = this._hoverIndex ?? 0;
          if (event.key === "ArrowLeft") index--;
          if (event.key === "ArrowRight") index++;
          if (event.key === "Home") index = 0;
          if (event.key === "End") index = count - 1;
          this._scheduleHoverRender(clamp(index, 0, count - 1));
          return;
        }
        if (!event.repeat && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          event.stopPropagation();
          target.click();
        }
      }
      _getAnimationSettings() {
        const configuredAnimations = isObject(this._config.animations) ? this._config.animations : DEFAULT_CONFIG.animations;
        return {
          enabled: configuredAnimations.enabled !== false,
          hoverDuration: clamp(
            Number(configuredAnimations.hover_duration) || DEFAULT_CONFIG.animations.hover_duration,
            80,
            1200
          ),
          buttonBounceDuration: clamp(
            Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration,
            120,
            1200
          )
        };
      }
      _triggerButtonBounce(element) {
        const animations = this._getAnimationSettings();
        if (!animations.enabled || !(element instanceof HTMLElement)) {
          return;
        }
        element.classList.remove("is-pressing");
        void element.offsetWidth;
        element.classList.add("is-pressing");
        const done = () => {
          if (!element.isConnected) {
            return;
          }
          element.classList.remove("is-pressing");
        };
        scheduleViewFallback(this._animationWork, done, animations.buttonBounceDuration + 40);
      }
      _getVisibleSeries(series) {
        const selectedEntityId = this._getSelectedEntityId();
        if (!selectedEntityId) {
          return series;
        }
        return series.filter((entry) => entry.entity === selectedEntityId);
      }
      _getChartSurfaceFromEvent(event) {
        return event.composedPath().find(graphSurfaceElement);
      }
      _getHoverSampleCount() {
        return this._hoverChart?.entries?.[0]?.samples?.length || 0;
      }
      _getHoverIndexFromClientX(surface, clientX) {
        const sampleCount = this._getHoverSampleCount();
        if (!(surface instanceof HTMLElement) || sampleCount <= 1) {
          return null;
        }
        const rect = surface.getBoundingClientRect();
        if (rect.width <= 0) {
          return null;
        }
        const relativeX = clamp(clientX - rect.left, 0, rect.width);
        return Math.round(relativeX / rect.width * (sampleCount - 1));
      }
      _updateHoverFromClientX(surface, clientX) {
        const nextIndex = this._getHoverIndexFromClientX(surface, clientX);
        if (nextIndex === null) {
          return;
        }
        this._scheduleHoverRender(nextIndex);
      }
      _onShadowPointerMove(event) {
        if (!(event instanceof PointerEvent)) return;
        const session = this._chartPointerSession;
        if (session && session.pointerId === event.pointerId && Math.hypot(event.clientX - session.startX, event.clientY - session.startY) > TOUCH_MOVE_CANCEL_DISTANCE) this._clearChartHoldTimer();
        if (typeof event.pointerType === "string" && event.pointerType === "touch" || this._hoverSupported === false) {
          return;
        }
        const surface = this._getChartSurfaceFromEvent(event);
        if (!surface || !this._hoverChart?.entries?.length) {
          this._scheduleHoverRender(null);
          return;
        }
        this._updateHoverFromClientX(surface, event.clientX);
      }
      _onShadowPointerLeave() {
        this._scheduleHoverRender(null);
        this._lastTooltipViewportPosition = null;
      }
      _onHostPointerOut(event) {
        if (this._hoverIndex === null) {
          return;
        }
        const clientX = Number(event?.clientX);
        const clientY = Number(event?.clientY);
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
          return;
        }
        const rect = this.getBoundingClientRect();
        const isOutside = clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;
        if (!isOutside) {
          return;
        }
        this._scheduleHoverRender(null);
        this._lastTooltipViewportPosition = null;
      }
      _onDocumentPointerMove(event) {
        if (this._hoverIndex === null) {
          return;
        }
        const clientX = Number(event?.clientX);
        const clientY = Number(event?.clientY);
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
          return;
        }
        const rect = this.getBoundingClientRect();
        const isOutside = clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;
        if (!isOutside) {
          return;
        }
        this._scheduleHoverRender(null);
        this._lastTooltipViewportPosition = null;
      }
      _attachDocumentHoverWatch() {
        if (this._documentHoverWatchAttached || typeof document === "undefined") {
          return;
        }
        this._documentHoverWatchAttached = true;
        document.addEventListener("pointermove", this._onDocumentPointerMove, true);
        document.addEventListener("mousemove", this._onDocumentPointerMove, true);
      }
      _detachDocumentHoverWatch() {
        if (!this._documentHoverWatchAttached || typeof document === "undefined") {
          return;
        }
        this._documentHoverWatchAttached = false;
        document.removeEventListener("pointermove", this._onDocumentPointerMove, true);
        document.removeEventListener("mousemove", this._onDocumentPointerMove, true);
      }
      _findTrackedTouch(touches) {
        if (!this._touchPressState || !touches) {
          return null;
        }
        return Array.from(touches).find((item) => item.identifier === this._touchPressState?.identifier) || null;
      }
      _resetChartTouchTracking(options = {}) {
        const clearTooltip = options.clearTooltip === true;
        this._clearChartHoldTimer();
        this._touchPressState = null;
        this._touchChartHoldFired = false;
        if (clearTooltip && this._hoverIndex !== null) {
          this._scheduleHoverRender(null);
          this._lastTooltipViewportPosition = null;
        }
      }
      _onShadowPointerDown(event) {
        if (!(event instanceof PointerEvent)) return;
        if (event.pointerType === "touch") {
          return;
        }
        const surface = this._getChartSurfaceFromEvent(event);
        if (!surface || !this._hoverChart?.entries?.length || this._getHoverSampleCount() <= 1) {
          return;
        }
        this._clearChartPointerSession();
        this._resetChartTouchTracking({ clearTooltip: false });
        this._chartPointerSession = {
          pointerId: event.pointerId,
          surface,
          startX: event.clientX,
          startY: event.clientY,
          startTime: Date.now(),
          holdFired: false
        };
        try {
          surface.setPointerCapture(event.pointerId);
        } catch (_error) {
        }
        if (!this._canRunHoldAction()) {
          return;
        }
        const pointerId = event.pointerId;
        this._chartHoldTimer = window.setTimeout(() => {
          this._chartHoldTimer = 0;
          if (!this._chartPointerSession || this._chartPointerSession.pointerId !== pointerId) {
            return;
          }
          this._chartPointerSession.holdFired = true;
          this._fireChartHoldAction();
        }, TOUCH_CHART_HOLD_MS);
      }
      _onShadowPointerUp(event) {
        if (!(event instanceof PointerEvent)) return;
        if (event.pointerType === "touch") {
          return;
        }
        const session = this._chartPointerSession;
        if (!session || session.pointerId !== event.pointerId) {
          return;
        }
        this._clearChartHoldTimer();
        try {
          session.surface.releasePointerCapture(event.pointerId);
        } catch (_error) {
        }
        this._chartPointerSession = null;
        if (event.type === "pointercancel") this._scheduleHoverRender(null);
        if (session.holdFired) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
      _onShadowTouchStart(event) {
        if (!(event instanceof TouchEvent)) return;
        if (event.touches.length !== 1) {
          this._resetChartTouchTracking({ clearTooltip: false });
          return;
        }
        const surface = this._getChartSurfaceFromEvent(event);
        if (!surface || !this._hoverChart?.entries?.length || this._getHoverSampleCount() <= 1) {
          this._resetChartTouchTracking({ clearTooltip: false });
          return;
        }
        const touch = event.touches[0];
        if (!touch) return;
        this._clearChartPointerSession();
        this._clearChartHoldTimer();
        this._touchChartHoldFired = false;
        this._touchPressState = {
          identifier: touch.identifier,
          lastX: touch.clientX,
          startX: touch.clientX,
          startY: touch.clientY,
          startTime: Date.now(),
          surface
        };
        if (!this._canRunHoldAction()) {
          return;
        }
        const touchId = touch.identifier;
        this._chartHoldTimer = window.setTimeout(() => {
          this._chartHoldTimer = 0;
          if (!this._touchPressState || this._touchPressState.identifier !== touchId) {
            return;
          }
          this._touchChartHoldFired = true;
          this._touchPressState = null;
          this._fireChartHoldAction();
        }, TOUCH_CHART_HOLD_MS);
      }
      _onShadowTouchMove(event) {
        if (!(event instanceof TouchEvent)) return;
        if (!this._touchPressState) {
          return;
        }
        const touch = this._findTrackedTouch(event.touches);
        if (!touch) {
          return;
        }
        this._touchPressState.lastX = touch.clientX;
        if (!this._touchChartHoldFired) {
          const deltaX = touch.clientX - this._touchPressState.startX;
          const deltaY = touch.clientY - this._touchPressState.startY;
          if (Math.hypot(deltaX, deltaY) > TOUCH_MOVE_CANCEL_DISTANCE) this._clearChartHoldTimer();
          const isVerticalScroll = Math.abs(deltaY) > TOUCH_MOVE_CANCEL_DISTANCE && Math.abs(deltaY) > Math.abs(deltaX) * 1.2;
          if (isVerticalScroll) {
            this._resetChartTouchTracking({ clearTooltip: false });
            return;
          }
        }
        this._updateHoverFromClientX(this._touchPressState.surface, touch.clientX);
      }
      _onShadowTouchEnd(event) {
        if (!(event instanceof TouchEvent)) return;
        this._clearChartHoldTimer();
        if (this._touchChartHoldFired) {
          this._touchChartHoldFired = false;
          this._touchPressState = null;
          event.preventDefault();
          return;
        }
        const touch = this._findTrackedTouch(event.changedTouches);
        const state = this._touchPressState;
        this._touchPressState = null;
        if (!state) {
          return;
        }
        if (!touch || touch.identifier !== state.identifier) {
          return;
        }
        const elapsed = Date.now() - state.startTime;
        const deltaX = touch.clientX - state.startX;
        const deltaY = touch.clientY - state.startY;
        const isTap = elapsed < TOUCH_CHART_HOLD_MS && Math.abs(deltaX) <= CHART_TAP_MAX_MOVE && Math.abs(deltaY) <= CHART_TAP_MAX_MOVE;
        if (isTap) {
          this._updateHoverFromClientX(state.surface, touch.clientX);
          this._triggerHaptic("selection");
          this._suppressClickUntil = Date.now() + TOUCH_CLICK_SUPPRESSION_WINDOW;
          event.preventDefault();
        }
      }
      _onShadowTouchCancel() {
        this._resetChartTouchTracking({ clearTooltip: true });
      }
      _scheduleHoverRender(nextIndex) {
        if (nextIndex === this._hoverIndex && this._pendingHoverIndex === null) {
          return;
        }
        this._pendingHoverIndex = nextIndex;
        if (this._hoverFrame) {
          return;
        }
        this._hoverFrame = window.requestAnimationFrame(() => {
          this._hoverFrame = 0;
          if (!this.isConnected) {
            this._pendingHoverIndex = null;
            return;
          }
          const resolvedIndex = this._pendingHoverIndex;
          this._pendingHoverIndex = null;
          if (resolvedIndex === this._hoverIndex) {
            return;
          }
          this._hoverEntering = resolvedIndex !== null && this._hoverIndex === null;
          if (resolvedIndex === null) {
            this._detachDocumentHoverWatch();
            this._lastTooltipViewportPosition = null;
          } else {
            this._attachDocumentHoverWatch();
          }
          this._hoverIndex = resolvedIndex;
          if (!this._hoverEntering && this._patchHoverOverlay()) {
            return;
          }
          this._render();
        });
      }
      _syncTooltipContent(tooltip, hover) {
        if (!(tooltip instanceof HTMLElement) || !hover) {
          return;
        }
        let timeEl = tooltip.querySelector(".graph-card__tooltip-time");
        if (!(timeEl instanceof HTMLElement)) {
          timeEl = document.createElement("div");
          timeEl.className = "graph-card__tooltip-time";
          tooltip.appendChild(timeEl);
        }
        timeEl.textContent = hover.label || "";
        let valuesEl = tooltip.querySelector(".graph-card__tooltip-values");
        if (!(valuesEl instanceof HTMLElement)) {
          valuesEl = document.createElement("div");
          valuesEl.className = "graph-card__tooltip-values";
          tooltip.appendChild(valuesEl);
        }
        const rows = hover.values || [];
        while (valuesEl.children.length > rows.length) {
          valuesEl.lastElementChild?.remove();
        }
        rows.forEach((item, index) => {
          let row = valuesEl.children[index];
          if (!(row instanceof HTMLElement)) {
            row = document.createElement("div");
            row.className = "graph-card__tooltip-row";
            row.innerHTML = `
          <span class="graph-card__tooltip-dot"></span>
          <span class="graph-card__tooltip-name"></span>
          <span class="graph-card__tooltip-value"></span>
        `;
            valuesEl.appendChild(row);
          }
          const dot = row.querySelector(".graph-card__tooltip-dot");
          const nameEl = row.querySelector(".graph-card__tooltip-name");
          const valueEl = row.querySelector(".graph-card__tooltip-value");
          if (dot instanceof HTMLElement) {
            dot.style.background = item.color || "var(--primary-color)";
          }
          if (nameEl instanceof HTMLElement) {
            nameEl.textContent = item.name || "";
          }
          if (valueEl instanceof HTMLElement) {
            valueEl.textContent = item.unit ? `${item.value} ${item.unit}` : String(item.value ?? "");
          }
        });
      }
      _patchHoverOverlay() {
        if (!this.shadowRoot || !this._hoverChart) {
          return false;
        }
        const chart = this._hoverChart;
        const hover = this._getHoverPayload(chart);
        const svg = this.shadowRoot.querySelector(".graph-card__chart");
        if (hover === null) {
          this.shadowRoot.querySelector(".graph-card__hover-line")?.remove();
          this.shadowRoot.querySelector(".graph-card__hover-points-layer")?.remove();
          const tooltip2 = this.shadowRoot.querySelector(".graph-card__tooltip");
          if (this._tooltipSyncFrame) window.cancelAnimationFrame(this._tooltipSyncFrame);
          this._tooltipSyncFrame = 0;
          tooltip2?.remove();
          return true;
        }
        if (!(svg instanceof SVGSVGElement)) {
          return false;
        }
        const hoverLineX = clamp(hover.x, 0, chart.width);
        const hoverLine = svg.querySelector(".graph-card__hover-line");
        if (hoverLine) {
          hoverLine.setAttribute("x1", hoverLineX.toFixed(2));
          hoverLine.setAttribute("x2", hoverLineX.toFixed(2));
        } else {
          return false;
        }
        const tooltip = this.shadowRoot.querySelector(".graph-card__tooltip");
        if (!(tooltip instanceof HTMLElement)) {
          return false;
        }
        const anchorXPct = graphChartXToPercent(hover.x, chart);
        const tooltipTint = hover.values?.[0]?.color || "var(--primary-color)";
        tooltip.dataset.anchorXPct = anchorXPct.toFixed(4);
        tooltip.style.setProperty("--tooltip-tint", tooltipTint);
        tooltip.style.opacity = "1";
        this._syncTooltipContent(tooltip, hover);
        this.shadowRoot.querySelectorAll("[data-graph-hover-entity]").forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          const point = hover.values.find((item) => item.entity === node.dataset.graphHoverEntity)?.point;
          if (!point) {
            node.style.display = "none";
            return;
          }
          node.style.display = "";
          node.style.left = `${clamp(graphChartXToPercent(point.x, chart), 0.3, 99.7)}%`;
          node.style.top = `${clamp(point.y / chart.height * 100, 0.3, 99.7)}%`;
        });
        this._scheduleTooltipPositionSync();
        return true;
      }
      _getHistoryRequestKey() {
        if (this._historyRequestKeyStamp) {
          return this._historyRequestKeyStamp;
        }
        const entries = this._getEntityEntries();
        this._historyRequestKeyStamp = JSON.stringify({
          entities: entries.map((entry) => entry.entity),
          hours: Number(this._config?.hours_to_show) || DEFAULT_CONFIG.hours_to_show,
          points: Number(this._config?.points) || DEFAULT_CONFIG.points
        });
        return this._historyRequestKeyStamp;
      }
      _getStatisticsPeriod() {
        const hoursToShow = Math.max(1, Number(this._config?.hours_to_show) || DEFAULT_CONFIG.hours_to_show);
        if (hoursToShow <= 48) {
          return "5minute";
        }
        if (hoursToShow <= 24 * 14) {
          return "hour";
        }
        return "day";
      }
      async _fetchStatistics(start, end, entityIds, signal, hass, period) {
        if (!hass.callWS || signal.aborted) return null;
        try {
          const groups = await Promise.all(entityIds.map(async (entityId) => {
            if (signal.aborted || !hass.callWS) return [entityId, []];
            const result = await hass.callWS({
              type: "recorder/statistics_during_period",
              start_time: start.toISOString(),
              end_time: end.toISOString(),
              statistic_ids: [entityId],
              period,
              types: ["mean", "min", "max", "state", "sum"]
            });
            return [entityId, graphRows(isObject(result) ? result[entityId] : void 0)];
          }));
          return Object.fromEntries(groups);
        } catch (_error) {
          return null;
        }
      }
      async _fetchHistory(start, end, entityIds, signal, hass) {
        const groups = await Promise.all(entityIds.map(async (entityId) => {
          if (signal.aborted) return [entityId, []];
          if (hass.callWS) {
            try {
              const result = await hass.callWS({
                type: "history/history_during_period",
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                entity_ids: [entityId],
                significant_changes_only: false
              });
              return [entityId, graphRows(Array.isArray(result) ? result[0] : isObject(result) ? result[entityId] : void 0)];
            } catch (_error) {
              if (signal.aborted) return [entityId, []];
            }
          }
          if (!signal.aborted && hass.auth?.fetchWithAuth) {
            const query = `filter_entity_id=${encodeURIComponent(entityId)}&end_time=${encodeURIComponent(end.toISOString())}`;
            const response = await hass.auth.fetchWithAuth(
              `/api/history/period/${encodeURIComponent(start.toISOString())}?${query}`,
              { signal }
            );
            if (!response.ok) throw new Error(`History request failed with ${response.status}`);
            const result = await response.json();
            return [entityId, graphRows(Array.isArray(result) ? result[0] : void 0)];
          }
          return [entityId, []];
        }));
        return Object.fromEntries(groups);
      }
      _normalizeStatisticsSeries(raw) {
        const entries = this._getLegendEntries();
        return entries.map((entry) => {
          const state = this._hass?.states?.[entry.entity];
          const rows = graphRows(isObject(raw) ? raw[entry.entity] : void 0);
          const samples = rows.filter(isObject).map((item) => {
            const ts = parseHistoryTimestamp(item.start ?? item.end);
            const value = parseNumber(item.mean ?? item.state ?? item.max ?? item.min ?? item.sum);
            return { ts, value };
          }).filter(finiteSample).sort((left, right) => left.ts - right.ts);
          const currentValue = parseNumber(state?.state);
          return {
            ...entry,
            unit: String(
              state?.attributes?.unit_of_measurement || state?.attributes?.native_unit_of_measurement || ""
            ).trim(),
            currentValue: currentValue !== null && Number.isFinite(currentValue) ? currentValue : samples[samples.length - 1]?.value ?? null,
            rawEventCount: samples.length,
            samples
          };
        });
      }
      _normalizeHistorySeries(raw, start, end) {
        const entries = this._getLegendEntries();
        const historyByEntity = /* @__PURE__ */ new Map();
        const pointsCount = normalizeGraphPointCount(this._config?.points);
        const startMs = start.getTime();
        const endMs = end.getTime();
        if (Array.isArray(raw)) {
          raw.forEach((group, index) => {
            if (!Array.isArray(group)) {
              return;
            }
            const first = group[0];
            const resolvedEntityId = (isObject(first) && typeof first.entity_id === "string" ? first.entity_id : "") || entries[index]?.entity;
            if (resolvedEntityId) {
              historyByEntity.set(resolvedEntityId, graphRows(group));
            }
          });
        } else if (isObject(raw)) {
          Object.entries(raw).forEach(([entityId, group]) => {
            if (Array.isArray(group)) {
              historyByEntity.set(entityId, graphRows(group));
            }
          });
        }
        return entries.map((entry) => {
          const state = this._hass?.states?.[entry.entity];
          const rawGroup = historyByEntity.get(entry.entity) || [];
          const events = rawGroup.filter(isObject).map((item) => ({
            ts: parseHistoryTimestamp(
              item.last_changed ?? item.last_updated ?? item.lc ?? item.lu ?? item.last_changed_ts ?? item.last_updated_ts
            ),
            value: parseNumber(item.state ?? item.s ?? item.value ?? item.v)
          })).filter(finiteSample).sort((left, right) => left.ts - right.ts);
          const currentValue = parseNumber(state?.state);
          if (currentValue !== null && Number.isFinite(currentValue)) {
            const nowTs = end.getTime();
            if (!events.length || Math.abs((events[events.length - 1]?.ts ?? 0) - nowTs) > 1e3) {
              events.push({ ts: nowTs, value: currentValue });
            }
          }
          const samples = buildInterpolatedSamples(events, startMs, endMs, pointsCount, currentValue);
          return {
            ...entry,
            unit: String(
              state?.attributes?.unit_of_measurement || state?.attributes?.native_unit_of_measurement || ""
            ).trim(),
            currentValue: currentValue !== null && Number.isFinite(currentValue) ? currentValue : samples[samples.length - 1]?.value ?? null,
            rawEventCount: events.length,
            samples
          };
        });
      }
      async _requestHistory() {
        if (!this.isConnected || !this._hass || !this._getEntityEntries().length) {
          return;
        }
        const requestKey = this._getHistoryRequestKey();
        if (requestKey === this._historyKey && Date.now() - this._historyLoadedAt < HISTORY_REFRESH_INTERVAL) {
          return;
        }
        if (this._historyAbortController && this._pendingHistoryKey === requestKey) return;
        this._historyAbortController?.abort();
        const hass = this._hass;
        const period = this._getStatisticsPeriod();
        const controller = new AbortController();
        this._historyAbortController = controller;
        this._pendingHistoryKey = requestKey;
        const end = /* @__PURE__ */ new Date();
        const hoursToShow = Math.max(1, Number(this._config?.hours_to_show) || DEFAULT_CONFIG.hours_to_show);
        const start = new Date(end.getTime() - hoursToShow * 60 * 60 * 1e3);
        try {
          const entityIds = this._getEntityEntries().map((entry) => entry.entity);
          const raw = await this._fetchHistory(start, end, entityIds, controller.signal, hass);
          if (!this.isConnected || controller.signal.aborted) {
            return;
          }
          const normalized = this._normalizeHistorySeries(raw || {}, start, end);
          const hasMeaningfulHistory = normalized.some((entry) => entry.rawEventCount > 1 && entry.samples.length > 1);
          if (hasMeaningfulHistory) {
            this._historySeries = normalized;
            this._historyKey = requestKey;
            this._historyLoadedAt = Date.now();
            this._animateChartOnNextRender = true;
            this._render();
            return;
          }
          const statisticsRaw = await this._fetchStatistics(start, end, entityIds, controller.signal, hass, period);
          if (!this.isConnected || controller.signal.aborted) {
            return;
          }
          const statisticsSeries = this._normalizeStatisticsSeries(statisticsRaw || {});
          const hasMeaningfulStatistics = statisticsSeries.some((entry) => entry.rawEventCount > 1 && entry.samples.length > 1);
          this._historySeries = hasMeaningfulStatistics ? statisticsSeries : normalized;
          this._historyKey = requestKey;
          this._historyLoadedAt = Date.now();
          this._animateChartOnNextRender = true;
          this._render();
        } catch (_error) {
          if (!this.isConnected || controller.signal.aborted) {
            return;
          }
          this._historySeries = [];
          this._historyKey = "";
          this._historyLoadedAt = 0;
          this._animateChartOnNextRender = true;
          this._render();
        } finally {
          if (this._historyAbortController === controller) {
            this._historyAbortController = null;
            this._pendingHistoryKey = "";
          }
        }
      }
      _normalizeMetricUnit(unit) {
        return normalizeTextKey(
          String(unit || "").replace("°", "").replaceAll("/", "_").replaceAll("-", "_")
        );
      }
      _getPrimaryMetricProfile() {
        const selectedEntityId = this._getSelectedEntityId();
        const entry = this._getEntityEntries().find((item) => item.entity === selectedEntityId) || this._getEntityEntries()[0];
        const state = entry?.entity ? this._hass?.states?.[entry.entity] || null : null;
        const unit = String(
          state?.attributes?.unit_of_measurement || state?.attributes?.native_unit_of_measurement || ""
        ).trim();
        const deviceClass = normalizeTextKey(state?.attributes?.device_class || "");
        const stateClass = normalizeTextKey(state?.attributes?.state_class || "");
        const entityId = String(entry?.entity || "");
        const domain = entityId.includes(".") ? entityId.split(".")[0] : "";
        const entityKey = normalizeTextKey(entityId);
        return {
          deviceClass,
          domain,
          entityKey,
          stateClass,
          unit,
          unitKey: this._normalizeMetricUnit(unit)
        };
      }
      _getSmartRangeSuggestion(_dataMin, dataMax) {
        const profile = this._getPrimaryMetricProfile();
        const unitKey = profile.unitKey;
        const isPercent = profile.unit === "%" || unitKey === "percent";
        const isHumidity = profile.deviceClass === "humidity" || profile.deviceClass === "moisture" || /humidity|humedad|moisture|humitat|umidade/.test(profile.entityKey);
        if (isPercent && isHumidity) {
          return { min: 20, max: 80 };
        }
        const isBattery = profile.deviceClass === "battery" || /battery|bateria/.test(profile.entityKey);
        if (isPercent && isBattery) {
          return { min: 0, max: 100 };
        }
        const isTemperature = profile.deviceClass === "temperature" || unitKey === "c" || unitKey === "f";
        if (isTemperature) {
          if (unitKey === "f") {
            return { min: 60, max: 86 };
          }
          return { min: 16, max: 30 };
        }
        const isPower = /(kw|w|mw|kva|va)\b/.test(unitKey) || /power|potencia|consumo/.test(profile.entityKey);
        if (isPower) {
          const upper = dataMax !== null ? Math.max(1, dataMax ?? 1) : 1;
          return { min: 0, max: upper * 1.12 };
        }
        const isEnergy = /(kwh|wh|mwh)\b/.test(unitKey) || profile.deviceClass === "energy";
        if (isEnergy) {
          const upper = dataMax !== null ? Math.max(1, dataMax ?? 1) : 1;
          return { min: 0, max: upper * 1.08 };
        }
        const isCo2 = profile.deviceClass === "carbon_dioxide" || unitKey === "ppm" || /co2|carbon_dioxide/.test(profile.entityKey);
        if (isCo2) {
          return { min: 350, max: 2e3 };
        }
        const isPressure = profile.deviceClass === "atmospheric_pressure" || /(hpa|mbar|bar|kpa|pa)\b/.test(unitKey);
        if (isPressure) {
          if (/(hpa|mbar)\b/.test(unitKey)) {
            return { min: 980, max: 1040 };
          }
          if (unitKey === "bar") {
            return { min: 0.98, max: 1.04 };
          }
        }
        return null;
      }
      _getGraphBounds(series) {
        const configuredMin = parseNumber(this._config.min);
        const configuredMax = parseNumber(this._config.max);
        const values = series.flatMap((entry) => entry.samples.map((sample) => sample.value)).filter(Number.isFinite);
        const dataMin = values.length ? Math.min(...values) : null;
        const dataMax = values.length ? Math.max(...values) : null;
        const suggestion = this._getSmartRangeSuggestion(dataMin, dataMax);
        let min = configuredMin !== null ? configuredMin : dataMin !== null ? dataMin : null;
        let max = configuredMax !== null ? configuredMax : dataMax !== null ? dataMax : null;
        if (configuredMin === null && suggestion?.min !== void 0) {
          min = Number(suggestion.min);
        }
        if (configuredMax === null && suggestion?.max !== void 0) {
          max = Number(suggestion.max);
        }
        if (suggestion && dataMin !== null && dataMax !== null) {
          if (configuredMin === null && (min === null || dataMin < min)) {
            min = dataMin;
          }
          if (configuredMax === null && (max === null || dataMax > max)) {
            max = dataMax;
          }
        }
        if (min === null || max === null || !Number.isFinite(min) || !Number.isFinite(max)) {
          min = 0;
          max = 100;
        }
        if (configuredMin === null && !suggestion) {
          const spread = Math.max(max - min, 1);
          min -= spread * 0.14;
        }
        if (configuredMax === null && !suggestion) {
          const spread = Math.max(max - min, 1);
          max += spread * 0.08;
        }
        if (max <= min) {
          max = min + 1;
        }
        return { min, max };
      }
      _buildChartSeries(series) {
        const width = 100;
        const height = 56;
        const paddingX = -5.5;
        const paddingTop = 4;
        const paddingBottom = 14;
        const spanX = width - paddingX * 2;
        const xMin = paddingX;
        const xMax = paddingX + spanX;
        const bounds = this._getGraphBounds(series);
        const range = Math.max(bounds.max - bounds.min, 1);
        return {
          width,
          height,
          paddingX,
          paddingTop,
          paddingBottom,
          xMin,
          xMax,
          entries: series.map((entry) => {
            if (!entry.samples.length) {
              return {
                ...entry,
                points: [],
                linePath: "",
                fillPath: ""
              };
            }
            const points = entry.samples.map((sample, index) => {
              const x = paddingX + spanX * index / Math.max(entry.samples.length - 1, 1);
              const normalized = clamp((sample.value - bounds.min) / range, 0, 1);
              const y = paddingTop + (height - paddingTop - paddingBottom) * (1 - normalized);
              return { x, y };
            });
            return {
              ...entry,
              points,
              linePath: buildSmoothPath(points),
              fillPath: buildAreaPath(points, height - paddingBottom)
            };
          })
        };
      }
      _getHoverPayload(chart) {
        if (!this._hoverChart || !chart?.entries?.length || this._hoverIndex === null) {
          return null;
        }
        const boundedIndex = clamp(this._hoverIndex, 0, Math.max((chart.entries[0]?.samples?.length || 1) - 1, 0));
        const primaryEntry = chart.entries[0];
        const primarySample = primaryEntry?.samples?.[boundedIndex];
        const anchorPoint = primaryEntry?.points?.[boundedIndex];
        if (!primarySample || !anchorPoint) {
          return null;
        }
        const decimals = this._getDecimals();
        const locale = this._getLocaleTag();
        return {
          index: boundedIndex,
          label: formatHoverTimestamp(primarySample.ts, locale),
          x: anchorPoint.x,
          values: chart.entries.map((entry) => {
            const sample = entry.samples?.[boundedIndex];
            if (!sample) {
              return null;
            }
            return {
              entity: entry.entity,
              color: entry.color,
              name: entry.name,
              value: formatFiniteNumericValue(sample.value, decimals, locale),
              unit: entry.unit || this._getUnit(),
              point: entry.points?.[boundedIndex] || null
            };
          }).filter((item) => item !== null)
        };
      }
      _scheduleTooltipPositionSync(retries = 3) {
        if (!this.isConnected || this._hoverIndex === null) return;
        if (this._tooltipSyncFrame) {
          window.cancelAnimationFrame(this._tooltipSyncFrame);
          this._tooltipSyncFrame = 0;
        }
        if (typeof window?.requestAnimationFrame !== "function") {
          this._syncTooltipPosition(retries);
          return;
        }
        this._tooltipSyncFrame = window.requestAnimationFrame(() => {
          this._tooltipSyncFrame = 0;
          this._syncTooltipPosition(retries);
        });
      }
      _syncTooltipPosition(retries = 0) {
        if (!this.isConnected || this._hoverIndex === null || !this.shadowRoot) {
          return;
        }
        const tooltip = this.shadowRoot.querySelector(".graph-card__tooltip");
        const chartWrap = this.shadowRoot.querySelector(".graph-card__chart-wrap");
        if (!(tooltip instanceof HTMLElement) || !(chartWrap instanceof HTMLElement)) {
          return;
        }
        const anchorXPct = Number(tooltip.dataset.anchorXPct);
        if (!Number.isFinite(anchorXPct)) {
          return;
        }
        const wrapWidth = Math.round(
          chartWrap.getBoundingClientRect().width || chartWrap.clientWidth || chartWrap.offsetWidth || 0
        );
        if (!wrapWidth) {
          if (retries > 0) {
            this._scheduleTooltipPositionSync(retries - 1);
          }
          return;
        }
        const viewport = typeof window === "undefined" ? null : window.visualViewport;
        const viewportLeft = viewport?.offsetLeft ?? 0;
        const viewportTop = viewport?.offsetTop ?? 0;
        const viewportWidth = viewport?.width || (typeof document !== "undefined" ? document.documentElement?.clientWidth : 0) || (typeof window !== "undefined" ? window.innerWidth : 0) || 360;
        const viewportHeight = viewport?.height || (typeof document !== "undefined" ? document.documentElement?.clientHeight : 0) || (typeof window !== "undefined" ? window.innerHeight : 0) || 640;
        const chartRect = chartWrap.getBoundingClientRect();
        const anchorPx = clamp(anchorXPct / 100 * chartRect.width, 0, chartRect.width);
        const anchorViewportX = chartRect.left + anchorPx;
        const anchorViewportY = chartRect.top + Math.max(22, chartRect.height * 0.28);
        const maxTooltipWidth = Math.min(260, viewportWidth - 24);
        tooltip.style.maxWidth = `${maxTooltipWidth}px`;
        const tooltipBox = tooltip.getBoundingClientRect();
        const tooltipWidth = Math.min(Math.round(tooltipBox.width || tooltip.offsetWidth || 0) || maxTooltipWidth, maxTooltipWidth);
        const tooltipHeight = Math.round(tooltipBox.height || tooltip.offsetHeight || 0) || 112;
        if (!tooltipWidth || !tooltipHeight) {
          if (retries > 0) {
            this._scheduleTooltipPositionSync(retries - 1);
          }
          return;
        }
        const resolvedCenter = clamp(
          anchorViewportX,
          viewportLeft + tooltipWidth / 2 + 12,
          viewportLeft + viewportWidth - tooltipWidth / 2 - 12
        );
        const shouldShowBelow = anchorViewportY - tooltipHeight - 14 < viewportTop + 12;
        const resolvedTop = shouldShowBelow ? clamp(anchorViewportY + 14, viewportTop + 12, viewportTop + viewportHeight - tooltipHeight - 12) : clamp(anchorViewportY - 14, viewportTop + tooltipHeight + 12, viewportTop + viewportHeight - 12);
        tooltip.style.left = `${resolvedCenter}px`;
        tooltip.style.top = `${resolvedTop}px`;
        tooltip.style.setProperty(
          "--graph-tooltip-transform",
          shouldShowBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)"
        );
        tooltip.style.opacity = "1";
        this._lastTooltipViewportPosition = {
          left: resolvedCenter,
          top: resolvedTop,
          transform: shouldShowBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)"
        };
      }
      _getSeriesData() {
        if (this._historySeries.some((entry) => entry.samples?.length > 1)) {
          const legends = new Map(this._getLegendEntries().map((entry) => [entry.entity, entry]));
          return this._historySeries.map((entry) => {
            const state = this._hass?.states[entry.entity];
            return { ...entry, ...legends.get(entry.entity), unit: String(state?.attributes.unit_of_measurement || state?.attributes.native_unit_of_measurement || "").trim() };
          });
        }
        return [];
      }
      _graphCardUi(key, fallback = "") {
        const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
        const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
        const pack = window.NodaliaI18n?.strings?.(lang)?.graphCard;
        const enPack = window.NodaliaI18n?.strings?.("en")?.graphCard;
        const raw = (isObject(pack) ? pack[key] : void 0) ?? (isObject(enPack) ? enPack[key] : void 0);
        return String(raw != null && raw !== "" ? raw : fallback);
      }
      _renderLegendEntries(legendEntries) {
        return legendEntries.map((entry, index) => `
                      <div
                        class="graph-card__legend-item ${entry.active ? "graph-card__legend-item--active" : ""} ${entry.muted ? "graph-card__legend-item--muted" : ""}"
                        data-graph-series="${escapeHtml(entry.entity)}" role="button" tabindex="0" aria-pressed="${entry.active}"
                        style="--legend-color:${escapeHtml(entry.color)}; --legend-delay:${Math.min(index, 8) * 34}ms;"
                      >
                        <span class="graph-card__legend-dot" style="background:${escapeHtml(entry.color)};"></span>
                        <span class="graph-card__legend-text">${escapeHtml(entry.name)}</span>
                      </div>
                    `).join("");
      }
      _render() {
        if (!this.shadowRoot) {
          return;
        }
        const activeElement = this.shadowRoot.activeElement;
        const focusKey = activeElement instanceof HTMLElement ? activeElement.dataset.graphSeries ? `[data-graph-series="${escapeSelectorValue(activeElement.dataset.graphSeries)}"]` : activeElement.dataset.graphSurface ? '[data-graph-surface="chart"]' : activeElement.dataset.graphAction ? `.graph-card__${activeElement.classList.contains("graph-card__header") ? "header" : "value"}[data-graph-action]` : "" : "";
        const entries = this._getEntityEntries();
        const graphGuard = window.NodaliaUtils?.renderLovelaceEntityGuardForEntities?.(
          this._hass,
          entries.length ? entries.map((entry) => entry.entity) : [""],
          { cardClass: "graph-card" }
        );
        if (graphGuard) {
          this._resetChartInteraction();
          this.shadowRoot.innerHTML = graphGuard;
          return;
        }
        const config = this._config || normalizeConfig({});
        const styles = config.styles || DEFAULT_CONFIG.styles;
        const legendEntries = this._getLegendEntries();
        const showUnavailableBadge = config.show_unavailable_badge !== false && entries.some((entry) => isUnavailableState(this._hass?.states?.[entry.entity]));
        const compactLayout = Number(isObject(config.grid_options) ? config.grid_options.rows : void 0) > 0 && Number(isObject(config.grid_options) ? config.grid_options.rows : void 0) <= 3;
        const currentValue = this._getCurrentValuesText();
        const allSeries = this._getSeriesData();
        const chart = this._buildChartSeries(this._getVisibleSeries(allSeries));
        this._hoverChart = chart;
        const hasGraphData = chart.entries.some((entry) => entry.linePath);
        const hover = hasGraphData ? this._getHoverPayload(chart) : null;
        const hoverLineX = hover ? clamp(hover.x, 0, chart.width) : 0;
        const icon = this._getIcon();
        const title = this._getTitle();
        const accentColor = chart.entries[0]?.color || legendEntries[0]?.color || "var(--primary-color)";
        const contrastState = entries.map((entry) => this._hass?.states?.[entry.entity]).find(Boolean) || null;
        const darkenBubbleIconGlyph = Boolean(
          contrastState && window.NodaliaBubbleContrast?.shouldDarkenBubbleIconGlyph?.(contrastState, accentColor)
        );
        const iconGlyphColor = darkenBubbleIconGlyph ? `color-mix(in srgb, var(--primary-text-color) 56%, ${accentColor})` : `color-mix(in srgb, ${accentColor} 72%, var(--primary-text-color))`;
        const chartHeight = `${Math.max(136, Math.min(parseSizeToPixels(styles.chart_height, 150), compactLayout ? 148 : 172))}px`;
        const valueSize = `${Math.max(26, Math.min(parseSizeToPixels(styles.value_size, 52), compactLayout ? 32 : 38))}px`;
        const unitSize = `${Math.max(12, Math.min(parseSizeToPixels(styles.unit_size, 18), compactLayout ? 14 : 16))}px`;
        const titleSize = `${Math.max(11, Math.min(parseSizeToPixels(styles.title_size, 14), compactLayout ? 11.5 : 12.5))}px`;
        const legendSize = `${Math.max(10, Math.min(parseSizeToPixels(styles.legend_size, 12), compactLayout ? 10 : 11))}px`;
        const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
        const lineWidth = `${Math.max(1.6, Math.min(parseSizeToPixels(styles.line_width, 2.2), compactLayout ? 1.9 : 2.2))}`;
        const padEdges = parsePaddingEdges(styles.card.padding, 14);
        const chartBleed = Math.round(Math.max(padEdges.left, padEdges.right) * 0.98);
        const chartBleedLeft = Math.round(padEdges.left);
        const chartBleedRight = Math.round(padEdges.right);
        const chartBleedBottom = Math.round(padEdges.bottom);
        const cardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 52%, ${styles.card.background} 100%)`;
        const computedCardBorder = `1px solid color-mix(in srgb, ${accentColor} 32%, var(--divider-color))`;
        const cardBorder = String(styles.card.border || "").trim() && styles.card.border !== DEFAULT_CONFIG.styles.card.border ? styles.card.border : computedCardBorder;
        const cardShadow = `${styles.card.box_shadow}, 0 16px 32px color-mix(in srgb, ${accentColor} 18%, rgba(0, 0, 0, 0.18))`;
        const tooltipTint = hover?.values?.[0]?.color || accentColor;
        const animations = this._getAnimationSettings();
        const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
        const shouldAnimateChart = animations.enabled && (shouldAnimateEntrance || this._animateChartOnNextRender);
        const primaryHeaderAttr = this._canRunTapAction() && config.show_header !== false ? ' data-graph-action="primary" role="button" tabindex="0"' : "";
        const primaryValueAttr = this._canRunTapAction() && config.show_value !== false ? ' data-graph-action="primary" role="button" tabindex="0"' : "";
        const anchorXPct = hover ? graphChartXToPercent(hover.x, chart) : 0;
        const initialTooltipStyle = this._lastTooltipViewportPosition ? `left:${this._lastTooltipViewportPosition.left}px; top:${this._lastTooltipViewportPosition.top}px; opacity:1; --graph-tooltip-transform:${this._lastTooltipViewportPosition.transform}; --tooltip-tint:${escapeHtml(tooltipTint)};` : `left:-9999px; top:-9999px; opacity:0; --tooltip-tint:${escapeHtml(tooltipTint)};`;
        const tooltipMarkup = hover ? `
        <div
          class="graph-card__tooltip ${this._hoverEntering && animations.enabled ? "graph-card__tooltip--entering" : ""}"
          data-anchor-x-pct="${anchorXPct.toFixed(4)}"
          style="${initialTooltipStyle}"
        >
          <div class="graph-card__tooltip-time">${escapeHtml(hover.label)}</div>
          <div class="graph-card__tooltip-values">
            ${hover.values.map((item) => `
              <div class="graph-card__tooltip-row">
                <span class="graph-card__tooltip-dot" style="background:${escapeHtml(item.color)};"></span>
                <span class="graph-card__tooltip-name">${escapeHtml(item.name)}</span>
                <span class="graph-card__tooltip-value">${escapeHtml(item.value)}${item.unit ? ` ${escapeHtml(item.unit)}` : ""}</span>
              </div>
            `).join("")}
          </div>
        </div>
      ` : "";
        this.shadowRoot.innerHTML = `
      <style>
        :host {
          --graph-card-hover-duration: ${animations.enabled ? animations.hoverDuration : 0}ms;
          --graph-card-line-draw-duration: ${animations.enabled ? Math.max(560, Math.round(animations.hoverDuration * 2.7)) : 0}ms;
          --graph-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          display: block;
          height: 100%;
          min-height: 0;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }

        .graph-card {
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          display: block;
          position: relative;
        }

        .graph-card::before {
          background: linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0));
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .graph-card::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%);
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .graph-card__content {
          cursor: ${this._canRunTapAction() ? "pointer" : "default"};
          display: flex;
          flex-direction: column;
          gap: ${styles.card.gap};
          height: 100%;
          min-height: 0;
          padding: ${styles.card.padding};
          position: relative;
          z-index: 1;
        }

        .graph-card__content--entering {
          animation: graph-card-fade-up calc(var(--graph-card-hover-duration) * 2.25) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .graph-card__header {
          align-items: center;
          display: flex;
          gap: 8px;
          justify-content: flex-start;
          min-width: 0;
        }

        .graph-card__content--entering .graph-card__header {
          animation: graph-card-fade-up calc(var(--graph-card-hover-duration) * 2.1) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 35ms;
        }

        .graph-card__icon--entering {
          animation: graph-card-bubble-bloom calc(var(--graph-card-hover-duration) * 2.1) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 40ms;
        }

        .graph-card__primary-row {
          align-items: center;
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          gap: 10px 14px;
          justify-content: space-between;
          min-height: 0;
          min-width: 0;
        }

        .graph-card__header + .graph-card__primary-row {
          margin-top: 6px;
        }

        .graph-card__primary-row .graph-card__value {
          flex: 0 1 auto;
          min-width: 0;
        }

        .graph-card__primary-row .graph-card__legend {
          flex: 1 1 0;
          justify-content: flex-end;
          margin-bottom: 0;
          min-width: 0;
        }

        .graph-card__legend--solo {
          margin-bottom: 4px;
          width: 100%;
        }

        .graph-card__title {
          color: var(--primary-text-color);
          font-size: ${titleSize};
          font-weight: 700;
          line-height: 1.15;
          min-width: 0;
          opacity: 0.95;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .graph-card__icon {
          -webkit-backdrop-filter: blur(14px);
          align-items: center;
          backdrop-filter: blur(14px);
          background: color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${iconGlyphColor};
          display: inline-flex;
          height: 38px;
          justify-content: center;
          padding: 0;
          position: relative;
          width: 38px;
        }

        .graph-card__icon > ha-icon {
          --mdc-icon-size: ${Math.max(22, parseSizeToPixels(styles.icon.size, 28))}px;
          color: ${iconGlyphColor};
          height: ${Math.max(22, parseSizeToPixels(styles.icon.size, 28))}px;
          width: ${Math.max(22, parseSizeToPixels(styles.icon.size, 28))}px;
        }

        .graph-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          display: inline-flex;
          height: 18px;
          justify-content: center;
          line-height: 0;
          overflow: hidden;
          position: absolute;
          right: 0;
          top: 0;
          transform: translate(28%, -28%);
          width: 18px;
          z-index: 2;
        }

        .graph-card__icon .graph-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          align-items: center;
          color:#fff;
          display: flex;
          height: 11px;
          justify-content: center;
          left: auto;
          line-height: 0;
          margin-top: -1px;
          overflow: visible;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .graph-card__value {
          align-items: baseline;
          display: flex;
          flex-wrap: nowrap;
          gap: 4px;
          line-height: 0.9;
          min-width: 0;
        }

        .graph-card__content--entering > .graph-card__value,
        .graph-card__content--entering .graph-card__primary-row .graph-card__value {
          animation: graph-card-fade-up calc(var(--graph-card-hover-duration) * 2.2) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 75ms;
        }

        .graph-card__value-number {
          font-size: ${valueSize};
          font-weight: 520;
          letter-spacing: -0.042em;
          line-height: 0.86;
          min-width: 0;
        }

        .graph-card__value-unit {
          font-size: ${unitSize};
          font-weight: 560;
          line-height: 0.92;
          opacity: 0.9;
          padding-top: 1px;
        }

        .graph-card__legend {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 5px 6px;
          justify-content: flex-start;
          margin-bottom: 0;
          min-height: 0;
          padding-top: 0;
        }

        .graph-card__content--entering > .graph-card__legend,
        .graph-card__content--entering .graph-card__primary-row .graph-card__legend {
          animation: graph-card-fade-up calc(var(--graph-card-hover-duration) * 2.1) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 105ms;
        }

        .graph-card__legend-item {
          -webkit-backdrop-filter: blur(12px);
          align-items: center;
          backdrop-filter: blur(12px);
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--legend-color) 10%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border: 1px solid color-mix(in srgb, var(--legend-color) 20%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: ${chipBorderRadius};
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 8px 18px rgba(0, 0, 0, 0.1);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font-size: max(10px, calc(${legendSize} - 1px));
          gap: 6px;
          max-width: min(100%, 184px);
          min-width: 0;
          opacity: 0.9;
          padding: 4px 8px;
          transform: translateZ(0);
          transform-origin: center;
          transition: opacity 160ms ease, transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
          will-change: transform;
        }

        .graph-card__content--entering .graph-card__legend-item {
          animation: graph-card-legend-in calc(var(--graph-card-hover-duration) * 1.8) cubic-bezier(0.18, 0.9, 0.22, 1.12) both;
          animation-delay: calc(135ms + var(--legend-delay, 0ms));
        }

        .graph-card__legend-item:hover {
          opacity: 1;
          transform: translateY(-1px);
        }

        .graph-card__legend-item--active {
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--legend-color) 18%, color-mix(in srgb, var(--primary-text-color) 7%, transparent)), color-mix(in srgb, var(--primary-text-color) 5%, transparent));
          border-color: color-mix(in srgb, var(--legend-color) 34%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent),
            0 10px 24px color-mix(in srgb, var(--legend-color) 12%, rgba(0, 0, 0, 0.14));
        }

        .graph-card__legend-item--muted {
          opacity: 0.48;
        }

        .graph-card__legend-dot {
          border-radius: 999px;
          display: inline-flex;
          flex: 0 0 auto;
          height: 8px;
          width: 8px;
        }

        .graph-card__legend-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .graph-card__chart-wrap {
          -webkit-backdrop-filter: none;
          backdrop-filter: none;
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          flex: 1 1 auto;
          margin: 4px -${chartBleedRight}px -${chartBleedBottom}px -${chartBleedLeft}px;
          max-width: none;
          min-height: ${chartHeight};
          min-width: 0;
          overflow: hidden;
          padding: 0;
          position: relative;
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
          width: calc(100% + ${chartBleedLeft + chartBleedRight}px);
        }

        .graph-card__chart-wrap--entering {
          animation: graph-card-item-rise calc(var(--graph-card-hover-duration) * 2.25) cubic-bezier(0.18, 0.9, 0.22, 1.08) both;
        }

        ${graph_hover_default}

        .graph-card__chart-series-fill {
          opacity: 1;
          transform-origin: center bottom;
        }

        .graph-card__chart-series-fill--entering {
          animation: graph-card-area-in var(--graph-card-line-draw-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: calc(40ms + var(--series-delay, 0ms));
        }

        .graph-card__chart-series-glow {
          display: block;
          fill: none;
          filter: url(#graph-glow);
          opacity: 0.12;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: calc(${lineWidth} * 1.8);
        }

        .graph-card__chart-series-line {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-opacity: 0.96;
          stroke-width: ${lineWidth};
        }

        .graph-card__chart-series-glow--entering {
          animation: graph-card-glow-draw var(--graph-card-line-draw-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: calc(70ms + var(--series-delay, 0ms));
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
        }

        .graph-card__chart-series-line--entering {
          animation: graph-card-line-draw var(--graph-card-line-draw-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: calc(70ms + var(--series-delay, 0ms));
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
        }

        .graph-card__hover-points-layer--entering .graph-card__hover-point {
          animation: graph-card-hover-point-in var(--graph-card-hover-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .graph-card__hover-line--entering {
          animation: graph-card-hover-line-in var(--graph-card-hover-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .graph-card__legend-item.is-pressing,
        .graph-card__content.is-pressing {
          animation: graph-card-button-bounce var(--graph-card-button-bounce-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        @keyframes graph-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes graph-card-item-rise {
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

        @keyframes graph-card-legend-in {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.94);
          }
          68% {
            opacity: 1;
            transform: translateY(0) scale(1.018);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes graph-card-bubble-bloom {
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

        @keyframes graph-card-area-in {
          0% {
            opacity: 0;
            transform: scaleY(0.74);
          }
          100% {
            opacity: 1;
            transform: scaleY(1);
          }
        }

        @keyframes graph-card-line-draw {
          0% {
            opacity: 0;
            stroke-dashoffset: 1;
          }
          36% {
            opacity: 1;
          }
          100% {
            opacity: 1;
            stroke-dashoffset: 0;
          }
        }

        @keyframes graph-card-glow-draw {
          0% {
            opacity: 0;
            stroke-dashoffset: 1;
          }
          36% {
            opacity: 0.14;
          }
          100% {
            opacity: 0.14;
            stroke-dashoffset: 0;
          }
        }

        @keyframes graph-card-tooltip-in {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes graph-card-hover-point-in {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.72);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes graph-card-hover-dot-pulse {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0.94;
            transform: scale(1.14);
          }
        }

        @keyframes graph-card-hover-line-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }

        @keyframes graph-card-button-bounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }

        ${animations.enabled ? "" : `
        .graph-card__legend-item,
        .graph-card__tooltip,
        .graph-card__hover-line,
        .graph-card__hover-point,
        .graph-card__hover-dot,
        .graph-card__content,
        .graph-card__header,
        .graph-card__primary-row,
        .graph-card__value,
        .graph-card__legend,
        .graph-card__chart-wrap,
        .graph-card__chart-series-fill,
        .graph-card__chart-series-glow,
        .graph-card__chart-series-line {
          animation: none !important;
          transition: none !important;
        }
        `}

        @media (max-width: 640px) {
          .graph-card__header {
            gap: 8px;
          }

          /* Keep value + legend chips on one row; scroll chips horizontally if needed
             (wrapping pushed the chart up and overlapped the plot). */
          .graph-card__primary-row {
            flex-wrap: nowrap;
            gap: 8px 10px;
          }

          .graph-card__primary-row .graph-card__value {
            flex: 0 1 auto;
            min-width: 0;
          }

          .graph-card__primary-row .graph-card__legend {
            flex: 1 1 0;
            flex-wrap: nowrap;
            justify-content: flex-end;
            margin-bottom: 0;
            min-width: 0;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            padding-block: 6px;
            scrollbar-width: thin;
            -webkit-overflow-scrolling: touch;
          }

          .graph-card__primary-row .graph-card__legend-item {
            flex-shrink: 0;
            max-width: min(52vw, 160px);
          }

          .graph-card__primary-row .graph-card__legend-item--active {
            box-shadow:
              inset 0 1px 0 color-mix(in srgb, var(--legend-color) 18%, rgba(255, 255, 255, 0.18)),
              inset 0 -1px 0 color-mix(in srgb, var(--legend-color) 12%, rgba(0, 0, 0, 0.08)),
              0 0 0 1px color-mix(in srgb, var(--legend-color) 10%, transparent);
          }
        }
        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <ha-card class="graph-card">
        <div class="graph-card__content ${shouldAnimateEntrance ? "graph-card__content--entering" : ""}">
          ${config.show_header !== false ? `
                <div class="graph-card__header"${primaryHeaderAttr}>
                  ${config.show_icon !== false ? `
                        <div class="graph-card__icon ${shouldAnimateEntrance ? "graph-card__icon--entering" : ""}">
                          <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
                          ${showUnavailableBadge ? `<span class="graph-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
                        </div>
                      ` : ""}
                  <div class="graph-card__title">${escapeHtml(title)}</div>
                </div>
              ` : ""}

          ${config.show_value !== false && config.show_legend !== false ? `
                <div class="graph-card__primary-row">
                  <div class="graph-card__value"${primaryValueAttr}>
                    <div class="graph-card__value-number">${escapeHtml(currentValue.value)}</div>
                    ${currentValue.unit ? `<div class="graph-card__value-unit">${escapeHtml(currentValue.unit)}</div>` : ""}
                  </div>
                  <div class="graph-card__legend">
                    ${this._renderLegendEntries(legendEntries)}
                  </div>
                </div>
              ` : ""}
          ${config.show_value !== false && config.show_legend === false ? `
                <div class="graph-card__value"${primaryValueAttr}>
                  <div class="graph-card__value-number">${escapeHtml(currentValue.value)}</div>
                  ${currentValue.unit ? `<div class="graph-card__value-unit">${escapeHtml(currentValue.unit)}</div>` : ""}
                </div>
              ` : ""}
          ${config.show_value === false && config.show_legend !== false ? `
                <div class="graph-card__legend graph-card__legend--solo">
                  ${this._renderLegendEntries(legendEntries)}
                </div>
              ` : ""}

          <div class="graph-card__chart-wrap ${shouldAnimateChart ? "graph-card__chart-wrap--entering" : ""}" data-graph-surface="chart" tabindex="0" role="group" aria-label="${escapeHtml(title)}" data-visible-inset="${chartBleed}">
            <svg class="graph-card__chart" viewBox="0 0 ${chart.width} ${chart.height}" preserveAspectRatio="none">
              <defs>
                <filter id="graph-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="1.5" />
                </filter>
                ${chart.entries.map((entry, index) => `
                  <linearGradient id="graph-fill-${index}" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="${escapeHtml(entry.color)}" stop-opacity="0.3"></stop>
                    <stop offset="52%" stop-color="${escapeHtml(entry.color)}" stop-opacity="0.12"></stop>
                    <stop offset="100%" stop-color="${escapeHtml(entry.color)}" stop-opacity="0"></stop>
                  </linearGradient>
                `).join("")}
              </defs>
              ${hover ? `<line class="graph-card__hover-line ${this._hoverEntering && animations.enabled ? "graph-card__hover-line--entering" : ""}" x1="${hoverLineX.toFixed(2)}" y1="0" x2="${hoverLineX.toFixed(2)}" y2="${chart.height}"></line>` : ""}
              ${chart.entries.map((entry, index) => `
                ${config.show_fill !== false ? `<path class="graph-card__chart-series-fill ${shouldAnimateChart ? "graph-card__chart-series-fill--entering" : ""}" style="--series-delay:${Math.min(index, 8) * 42}ms;" d="${entry.fillPath}" fill="url(#graph-fill-${index})"></path>` : ""}
                <path class="graph-card__chart-series-glow ${shouldAnimateChart ? "graph-card__chart-series-glow--entering" : ""}" style="--series-delay:${Math.min(index, 8) * 42}ms;" pathLength="1" d="${entry.linePath}" stroke="${escapeHtml(entry.color)}"></path>
                <path class="graph-card__chart-series-line ${shouldAnimateChart ? "graph-card__chart-series-line--entering" : ""}" style="--series-delay:${Math.min(index, 8) * 42}ms;" pathLength="1" d="${entry.linePath}" stroke="${escapeHtml(entry.color)}"></path>
              `).join("")}
            </svg>
            ${hover ? `
                  <div class="graph-card__hover-points-layer ${this._hoverEntering && animations.enabled ? "graph-card__hover-points-layer--entering" : ""}">
                    ${chart.entries.map((entry) => {
          const point = hover.values.find((item) => item.entity === entry.entity)?.point;
          if (!point) {
            return "";
          }
          const left = clamp(graphChartXToPercent(point.x, chart), 0.3, 99.7);
          const top = clamp(point.y / chart.height * 100, 0.3, 99.7);
          return `
                        <span class="graph-card__hover-point" data-graph-hover-entity="${escapeHtml(entry.entity)}" style="left:${left}%; top:${top}%; --dot-color:${escapeHtml(entry.color)};">
                          <span class="graph-card__hover-dot"></span>
                        </span>
                      `;
        }).join("")}
                  </div>
                ` : ""}
            ${hasGraphData ? "" : `<div class="graph-card__chart-empty">${escapeHtml(window.NodaliaI18n?.translateGraphEmptyHistory?.(this._hass, this._config?.language ?? "auto") || "No history available")}</div>`}
          </div>
        </div>
      </ha-card>
      ${tooltipMarkup}
    `;
        if (focusKey) {
          const nextFocus = this.shadowRoot.querySelector(focusKey);
          if (nextFocus instanceof HTMLElement) nextFocus.focus({ preventScroll: true });
        }
        this._scheduleTooltipPositionSync(4);
        this._hoverEntering = false;
        if (shouldAnimateEntrance) {
          this._animateContentOnNextRender = false;
        }
        if (shouldAnimateChart) {
          this._animateChartOnNextRender = false;
        }
      }
    }
    _lazyNodaliaGraphCard = NodaliaGraphCard;
    return NodaliaGraphCard;
  }

  // src/shared/editor-toggle.css
  var editor_toggle_default = ':is(.editor-toggle,.editor-checkbox){align-items:center;column-gap:10px;cursor:pointer;grid-auto-flow:row;grid-template-columns:auto minmax(0,1fr);justify-content:stretch;min-height:40px;padding-top:0;position:relative}:is(.editor-toggle,.editor-checkbox) input{block-size:1px;inline-size:1px;margin:0;opacity:0;pointer-events:none;position:absolute}.editor-toggle__switch{background:color-mix(in srgb,var(--primary-text-color) 8%,transparent);border:1px solid color-mix(in srgb,var(--primary-text-color) 12%,transparent);border-radius:999px;box-shadow:inset 0 1px 0 color-mix(in srgb,var(--primary-text-color) 6%,transparent);display:inline-flex;font-size:0;height:22px;line-height:0;position:relative;transition:background 160ms ease,border-color 160ms ease,box-shadow 160ms ease;width:40px}.editor-toggle__switch::before{background:rgba(255,255,255,0.92);border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,0.24);content:"";height:18px;left:1px;position:absolute;top:1px;transition:transform 160ms ease;width:18px}.editor-toggle__label{min-width:0}:is(.editor-toggle,.editor-checkbox) input:checked+.editor-toggle__switch{background:var(--primary-color);border-color:var(--primary-color)}:is(.editor-toggle,.editor-checkbox) input:checked+.editor-toggle__switch::before{transform:translateX(18px)}:is(.editor-toggle,.editor-checkbox) input:focus-visible+.editor-toggle__switch{box-shadow:0 0 0 3px color-mix(in srgb,var(--primary-text-color) 14%,transparent),inset 0 1px 0 color-mix(in srgb,var(--primary-text-color) 8%,transparent)}';

  // src/shared/editor-radius.css
  var editor_radius_default = ".editor-chip-radius__options{display:flex;flex-wrap:wrap;gap:8px}.editor-chip-radius__option{align-items:center;border:1px solid color-mix(in srgb,var(--primary-text-color) 12%,transparent);border-radius:12px;cursor:pointer;display:inline-flex;gap:8px;padding:8px 12px}.editor-chip-radius__option:has(input:checked){background:color-mix(in srgb,var(--primary-color) 10%,transparent);border-color:var(--primary-color)}.editor-chip-radius__option input[type=radio]{accent-color:var(--primary-color);appearance:auto;margin:0;min-height:auto;padding:0;width:auto}";

  // src/shared/editor-section-action.css
  var editor_section_action_default = ".editor-section__actions{align-items:center;display:flex;flex-wrap:wrap;gap:8px;margin-top:2px}.editor-section__toggle-button{align-items:center;appearance:none;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent);border:1px solid color-mix(in srgb,var(--primary-text-color) 8%,transparent);border-radius:999px;color:var(--primary-text-color);cursor:pointer;display:inline-flex;font:inherit;font-size:12px;font-weight:600;gap:8px;min-height:34px;padding:0 12px}.editor-section__toggle-button ha-icon{--mdc-icon-size: 16px}";

  // src/shared/editor-controls.ts
  function isNativeEditorInput(node) {
    return node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement;
  }
  function editorControlValue(event, control) {
    const detail = event instanceof CustomEvent ? event.detail : void 0;
    if (detail && typeof detail === "object" && "value" in detail && typeof detail.value === "string") return detail.value;
    return "value" in control ? control.value : void 0;
  }

  // src/cards/graph/graph-editor.ts
  var _lazyNodaliaGraphCardEditor;
  function loadNodaliaGraphCardEditor() {
    if (_lazyNodaliaGraphCardEditor) {
      return _lazyNodaliaGraphCardEditor;
    }
    class NodaliaGraphCardEditor extends HTMLElement {
      constructor() {
        super();
        this._nodaliaConstruct();
      }
      _nodaliaConstruct() {
        this.attachShadow({ mode: "open" });
        this._config = normalizeEditorConfig(STUB_CONFIG);
        this._hass = null;
        this._entityOptionsSignature = "";
        this._showStyleSection = false;
        this._showAnimationSection = false;
        this._showTapActionsSection = false;
        this._pendingEditorControlTags = /* @__PURE__ */ new Set();
        this._onShadowInput = this._onShadowInput.bind(this);
        this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
        this._onShadowClick = this._onShadowClick.bind(this);
      }
      _attachEditorShadowListeners() {
        window.NodaliaUtils.bindShadowListeners(this, [
          ["input", this._onShadowInput],
          ["change", this._onShadowInput],
          ["value-changed", this._onShadowValueChanged],
          ["click", this._onShadowClick]
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
        this._config = normalizeEditorConfig(config || {});
        window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
        this._render();
        this._restoreFocusState(focusState);
      }
      _watchEditorControlTag(tagName) {
        if (!tagName || this._pendingEditorControlTags.has(tagName)) {
          return;
        }
        if (typeof customElements?.whenDefined !== "function" || customElements.get(tagName)) {
          return;
        }
        this._pendingEditorControlTags.add(tagName);
        customElements.whenDefined(tagName).then(() => {
          this._pendingEditorControlTags.delete(tagName);
          if (!this.isConnected || !this._hass || !this.shadowRoot) {
            return;
          }
          const focusState = this._captureFocusState();
          this._render();
          this._restoreFocusState(focusState);
        }).catch(() => {
          this._pendingEditorControlTags.delete(tagName);
        });
      }
      _ensureEditorControlsReady() {
        this._watchEditorControlTag("ha-entity-picker");
        this._watchEditorControlTag("ha-selector");
        this._watchEditorControlTag("ha-icon-picker");
      }
      _getEntityOptionsSignature(hass = this._hass) {
        return window.NodaliaUtils.editorFilteredStatesSignature?.(
          hass,
          this._config?.language,
          (id) => id.startsWith("sensor.") || id.startsWith("number.") || id.startsWith("input_number.")
        ) ?? "";
      }
      _getEntityOptions(field = "entities.0.entity", domains = []) {
        const normalizedDomains = Array.isArray(domains) ? domains.map((domain) => String(domain || "").trim()).filter(Boolean) : [];
        const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
        const options = Object.entries(this._hass?.states || {}).filter(([entityId]) => !normalizedDomains.length || normalizedDomains.some((domain) => entityId.startsWith(`${domain}.`))).map(([entityId, state]) => {
          const friendlyName = String(state?.attributes?.friendly_name || "").trim();
          return {
            value: entityId,
            label: friendlyName || entityId,
            displayLabel: friendlyName && friendlyName !== entityId ? `${friendlyName} (${entityId})` : entityId
          };
        }).sort((left, right) => left.label.localeCompare(right.label, sortLoc, { sensitivity: "base" }) || left.value.localeCompare(right.value, sortLoc, { sensitivity: "base" }));
        const currentValue = String(getByPath(this._config, field) || "").trim();
        if (currentValue && !options.some((option) => option.value === currentValue)) {
          options.unshift({
            value: currentValue,
            label: currentValue,
            displayLabel: currentValue
          });
        }
        return options;
      }
      _captureFocusState() {
        return window.NodaliaUtils.captureEditorFocusState(this);
      }
      _restoreFocusState(focusState) {
        window.NodaliaUtils.restoreEditorFocusState(this, focusState);
      }
      _emitConfig() {
        const focusState = this._captureFocusState();
        const nextConfig = cloneConfigValue(this._config);
        if (!Array.isArray(nextConfig.entities)) {
          nextConfig.entities = [];
        }
        delete nextConfig.entity;
        this._config = normalizeEditorConfig(compactConfig(nextConfig));
        this._render();
        this._restoreFocusState(focusState);
        fireEvent(this, "config-changed", {
          config: compactConfig(window.NodaliaUtils.stripEqualToDefaults?.(nextConfig, DEFAULT_CONFIG) ?? {})
        });
      }
      _setEditorConfig() {
        this._config = normalizeEditorConfig(compactConfig(this._config));
      }
      _setFieldValue(path, value) {
        const parts = path.split(".");
        if (parts[0] === "entities" && parts.length > 1) {
          const index = parseFiniteNumericValue(parts[1]);
          if (index === null || !Number.isInteger(index) || index < 0 || index >= this._config.entities.length || parts.length !== 3 || !["entity", "name", "color"].includes(parts[2] || "")) return;
        }
        if (value === void 0 || value === null || value === "") {
          deleteByPath(this._config, path);
          return;
        }
        setByPath(this._config, path, value);
      }
      _readFieldValue(input) {
        const valueType = input.dataset.valueType || "string";
        switch (valueType) {
          case "boolean":
            return input instanceof HTMLInputElement && input.checked;
          case "number": {
            const trimmed = String(input.value || "").trim();
            if (!trimmed) {
              return void 0;
            }
            const parsed = Number(trimmed);
            return Number.isFinite(parsed) ? parsed : trimmed;
          }
          case "color":
            return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
          case "tristate":
            if (input.value === "true") {
              return true;
            }
            if (input.value === "false") {
              return false;
            }
            return void 0;
          default:
            return input.value;
        }
      }
      _onShadowInput(event) {
        const input = event.composedPath().find(isNativeEditorInput);
        if (!input?.dataset?.field) {
          return;
        }
        event.stopPropagation();
        const nextValue = this._readFieldValue(input);
        this._setFieldValue(input.dataset.field, nextValue);
        this._setEditorConfig();
        if (event.type === "change") {
          this._emitConfig();
        }
      }
      _onShadowValueChanged(event) {
        const control = event.composedPath().find((node) => node instanceof HTMLElement && Boolean(node.dataset.field));
        if (!control?.dataset?.field) {
          return;
        }
        event.stopPropagation();
        const nextValue = editorControlValue(event, control);
        if (typeof control.dataset?.value === "string") {
          control.dataset.value = String(nextValue || "");
        }
        const field = control.dataset.field;
        const previousEntity = field === "entity" ? String(this._config?.entity || "").trim() : "";
        this._setFieldValue(field, nextValue);
        if (field === "entity") {
          window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass, { previousEntity });
        }
        this._setEditorConfig();
        this._emitConfig();
      }
      _onShadowClick(event) {
        const toggleButton = event.composedPath().find((node) => node instanceof HTMLElement && Boolean(node.dataset.editorToggle));
        if (toggleButton) {
          event.preventDefault();
          event.stopPropagation();
          if (toggleButton.dataset.editorToggle === "styles") {
            this._showStyleSection = !this._showStyleSection;
            this._render();
            return;
          }
          if (toggleButton.dataset.editorToggle === "animations") {
            this._showAnimationSection = !this._showAnimationSection;
            this._render();
            return;
          }
          if (toggleButton.dataset.editorToggle === "tap_actions") {
            this._showTapActionsSection = !this._showTapActionsSection;
            this._render();
          }
          return;
        }
        const button = event.composedPath().find((node) => node instanceof HTMLButtonElement && Boolean(node.dataset.action));
        if (!button) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const action = button.dataset.action;
        const index = parseFiniteNumericValue(button.dataset.index) ?? -1;
        this._config.entities = Array.isArray(this._config.entities) ? this._config.entities : [];
        if (action === "add-series") {
          this._config.entities.push({
            entity: "",
            name: "",
            color: SERIES_COLORS[this._config.entities.length % SERIES_COLORS.length] ?? "#f29f05"
          });
          this._emitConfig();
          return;
        }
        if (!Number.isInteger(index) || index < 0 || index >= this._config.entities.length) {
          return;
        }
        if (action === "remove-series") {
          this._config.entities.splice(index, 1);
          this._emitConfig();
          return;
        }
        if (action === "move-series-up") {
          moveItem(this._config.entities, index, index - 1);
          this._emitConfig();
          return;
        }
        if (action === "move-series-down") {
          moveItem(this._config.entities, index, index + 1);
          this._emitConfig();
        }
      }
      _editorLabel(s) {
        if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
          return s;
        }
        const hass = this._hass;
        return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", s);
      }
      _renderTextField(label, field, value, options = {}) {
        const tLabel = this._editorLabel(label);
        const tag = options.multiline ? "textarea" : "input";
        const inputType = options.type || "text";
        const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
        const valueType = options.valueType || "string";
        const inputValue = value === void 0 || value === null ? "" : String(value);
        if (tag === "textarea") {
          return `
        <label class="editor-field ${options.fullWidth !== false ? "editor-field--full" : ""}">
          <span>${escapeHtml(tLabel)}</span>
          <textarea data-field="${escapeHtml(field)}" data-value-type="${escapeHtml(valueType)}" rows="${options.rows || 2}" ${placeholder}>${escapeHtml(inputValue)}</textarea>
        </label>
      `;
        }
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
      </label>
    `;
      }
      _renderColorField(label, field, value, options = {}) {
        const tLabel = this._editorLabel(label);
        const tColorCustom = this._editorLabel("Color personalizado");
        const fallbackValue = options.fallbackValue || getEditorColorFallbackValue(field);
        const currentValue = value === void 0 || value === null || value === "" ? fallbackValue : String(value);
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
            <span class="editor-color-swatch" style="--editor-swatch:${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>
    `;
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
      _renderSelectField(label, field, value, options, valueType = "string") {
        const tLabel = this._editorLabel(label);
        return `
      <label class="editor-field">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}" data-value-type="${escapeHtml(valueType)}">
          ${options.map((option) => {
          const optionValue = option.value === void 0 ? "auto" : String(option.value);
          const isSelected = value === option.value || option.value === void 0 && value === void 0;
          return `
                <option value="${escapeHtml(optionValue)}" ${isSelected ? "selected" : ""}>
                  ${escapeHtml(this._editorLabel(option.label))}
                </option>
              `;
        }).join("")}
        </select>
      </label>
    `;
      }
      _renderEntityField(label, field, value, options = {}) {
        const tLabel = this._editorLabel(label);
        const inputValue = value === void 0 || value === null ? "" : String(value);
        const domains = Array.isArray(options.domains) ? options.domains.map((domain) => String(domain || "").trim()).filter(Boolean).join(",") : "";
        return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(options.placeholder || "")}"
          data-domains="${escapeHtml(domains)}"
        ></div>
      </div>
    `;
      }
      _renderIconPickerField(label, field, value, options = {}) {
        const tLabel = this._editorLabel(label);
        const inputValue = value === void 0 || value === null ? "" : String(value);
        return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="icon-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(options.placeholder || "")}"
        ></div>
      </div>
    `;
      }
      _renderSeriesCard(series, index, total) {
        const fallbackColor = SERIES_COLORS[index % SERIES_COLORS.length] ?? "#f29f05";
        return `
      <div class="series-editor-card">
        <div class="series-editor-card__header">
          <div class="series-editor-card__title">${escapeHtml(this._editorLabel("Serie"))} ${index + 1}</div>
          <div class="series-editor-card__actions">
            <button type="button" data-action="move-series-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>${escapeHtml(this._editorLabel("Subir"))}</button>
            <button type="button" data-action="move-series-down" data-index="${index}" ${index === total - 1 ? "disabled" : ""}>${escapeHtml(this._editorLabel("Bajar"))}</button>
            <button type="button" data-action="remove-series" data-index="${index}" class="danger">${escapeHtml(this._editorLabel("Eliminar"))}</button>
          </div>
        </div>
        <div class="series-editor-subgroup">
          <div class="series-editor-subgroup__title">${escapeHtml(this._editorLabel("Datos"))}</div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityField("Entidad", `entities.${index}.entity`, series.entity, {
          domains: ["sensor", "number", "input_number"],
          placeholder: "sensor.humedad_dormitorio",
          fullWidth: true
        })}
            ${this._renderTextField("Nombre visible", `entities.${index}.name`, series.name, {
          placeholder: "Bedroom",
          fullWidth: true
        })}
            ${this._renderColorField("Color de la linea", `entities.${index}.color`, series.color, {
          fallbackValue: fallbackColor
        })}
          </div>
        </div>
      </div>
    `;
      }
      _mountEntityPicker(host) {
        if (!(host instanceof HTMLElement)) {
          return;
        }
        const field = host.dataset.field || "entities.0.entity";
        const nextValue = host.dataset.value || "";
        const placeholder = host.dataset.placeholder || "";
        const allowedDomains = String(host.dataset.domains || "").split(",").map((domain) => domain.trim()).filter(Boolean);
        let control;
        if (customElements.get("ha-entity-picker")) {
          control = document.createElement("ha-entity-picker");
          if (allowedDomains.length) {
            Object.assign(control, { includeDomains: allowedDomains });
            Object.assign(control, { entityFilter: (stateObj) => allowedDomains.some((domain) => String(stateObj?.entity_id || "").startsWith(`${domain}.`)) });
          }
          if (placeholder) {
            control.setAttribute("placeholder", placeholder);
          }
          Object.assign(control, { allowCustomEntity: true });
        } else if (customElements.get("ha-selector")) {
          control = document.createElement("ha-selector");
          Object.assign(control, { selector: {
            entity: allowedDomains.length === 1 ? { domain: allowedDomains[0] } : {}
          } });
        } else {
          control = document.createElement("select");
          const emptyOption = document.createElement("option");
          emptyOption.value = "";
          emptyOption.textContent = placeholder || this._editorLabel("Selecciona una entidad");
          control.appendChild(emptyOption);
          this._getEntityOptions(field, allowedDomains).forEach((option) => {
            const optionElement = document.createElement("option");
            optionElement.value = option.value;
            optionElement.textContent = option.displayLabel;
            control.appendChild(optionElement);
          });
          control.addEventListener("change", this._onShadowInput);
        }
        control.dataset.field = field;
        control.dataset.value = nextValue;
        if ("hass" in control) Object.assign(control, { hass: this._hass });
        if ("value" in control) Object.assign(control, { value: nextValue });
        if (control.tagName !== "SELECT") {
          control.addEventListener("value-changed", this._onShadowValueChanged);
        }
        host.replaceChildren(control);
      }
      _mountIconPicker(host) {
        if (!(host instanceof HTMLElement)) {
          return;
        }
        const field = host.dataset.field || "icon";
        const nextValue = host.dataset.value || "";
        const placeholder = host.dataset.placeholder || "";
        let control;
        if (customElements.get("ha-icon-picker")) {
          control = document.createElement("ha-icon-picker");
          if (placeholder) {
            control.setAttribute("placeholder", placeholder);
          }
        } else if (customElements.get("ha-selector")) {
          control = document.createElement("ha-selector");
          Object.assign(control, { selector: {
            icon: {}
          } });
        } else {
          const input = document.createElement("input");
          input.type = "text";
          input.placeholder = placeholder;
          control = input;
          control.addEventListener("input", this._onShadowInput);
          control.addEventListener("change", this._onShadowInput);
        }
        control.dataset.field = field;
        control.dataset.value = nextValue;
        if ("hass" in control) Object.assign(control, { hass: this._hass });
        if ("value" in control) Object.assign(control, { value: nextValue });
        if (control.tagName !== "INPUT") {
          control.addEventListener("value-changed", this._onShadowValueChanged);
        }
        host.replaceChildren(control);
      }
      _render() {
        if (!this.shadowRoot) {
          return;
        }
        const config = this._config || normalizeConfig({});
        const haptics = isObject(config.haptics) ? config.haptics : {};
        const animations = isObject(config.animations) ? config.animations : DEFAULT_CONFIG.animations;
        const hapticStyle = haptics.style || "medium";
        const entities = Array.isArray(config.entities) ? config.entities : [];
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

        ${editor_section_action_default}

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

        ${editor_radius_default}


        .editor-field:has(> .editor-control-host[data-mounted-control="entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="entity-picker"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="vacuum-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="select-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="sensor-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="light-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="fan-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="humidifier-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="icon-picker"]),
        .editor-field:has(> ha-icon-picker) {
          grid-column: 1 / -1;
        }

        .editor-field > span,
        .editor-toggle > span {
          font-size: 12px;
          font-weight: 600;
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

        .editor-field textarea {
          min-height: 72px;
          resize: vertical;
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
          height: 18px;
          width: 18px;
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

        ${editor_toggle_default}
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("General"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Nombre, icono, rango visible y comportamiento basico de la grafica."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Nombre", "name", config.name, {
          placeholder: "Statistics"
        })}
            ${this._renderIconPickerField("Icono", "icon", config.icon, {
          placeholder: "mdi:chart-line"
        })}
            ${this._renderTextField("Horas a mostrar", "hours_to_show", config.hours_to_show, {
          type: "number",
          valueType: "number"
        })}
            ${this._renderTextField("Puntos", "points", config.points, {
          type: "number",
          valueType: "number"
        })}
            ${this._renderTextField("Minimo", "min", config.min, {
          type: "number",
          valueType: "number"
        })}
            ${this._renderTextField("Maximo", "max", config.max, {
          type: "number",
          valueType: "number"
        })}
          </div>
        </section>

        <section class="editor-section">
          ${window.NodaliaUtils.renderEditorCollapsibleSectionHeaderHtml({
          escapeHtml,
          editorLabel: (key) => this._editorLabel(key),
          titleKey: "ed.light.tap_actions_section_title",
          hintKey: "ed.light.tap_actions_section_hint",
          toggleId: "tap_actions",
          expanded: this._showTapActionsSection === true
        })}
          ${this._showTapActionsSection ? `
          <div class="editor-grid">
            ${this._renderSelectField(
          "ed.entity.tap_action",
          "tap_action",
          config.tap_action || "more-info",
          [
            { value: "more-info", label: "ed.entity.tap_more_info" },
            { value: "none", label: "ed.entity.tap_none" }
          ]
        )}
            ${this._renderSelectField(
          "ed.light.card_hold_action",
          "hold_action",
          config.hold_action || "more-info",
          [
            { value: "more-info", label: "ed.entity.tap_more_info" },
            { value: "none", label: "ed.entity.tap_none" }
          ]
        )}
          </div>
              ` : ""}
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Series"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Anade, reordena y personaliza cada entidad mostrada en la grafica."))}</div>
          </div>
          <div class="series-editor-list">
            ${entities.length ? entities.map((series, index) => this._renderSeriesCard(series, index, entities.length)).join("") : `<div class="empty-note">${escapeHtml(this._editorLabel("Todavia no has anadido ninguna serie."))}</div>`}
          </div>
          <div class="editor-actions">
            <button type="button" data-action="add-series">${escapeHtml(this._editorLabel("Anadir serie"))}</button>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Visibilidad"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Activa o desactiva cabecera, valor grande, leyenda y relleno."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Mostrar cabecera", "show_header", config.show_header !== false)}
            ${this._renderCheckboxField("Mostrar icono", "show_icon", config.show_icon !== false)}
            ${this._renderCheckboxField("Mostrar valor grande", "show_value", config.show_value !== false)}
            ${this._renderCheckboxField("Mostrar leyenda", "show_legend", config.show_legend !== false)}
            ${this._renderCheckboxField("Mostrar relleno", "show_fill", config.show_fill !== false)}
            ${this._renderCheckboxField("Mostrar badge de no disponible", "show_unavailable_badge", config.show_unavailable_badge !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Haptics"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Respuesta tactil opcional para taps, hover y cambios de serie."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.entity.enable_haptics", "haptics.enabled", haptics.enabled === true)}
            ${this._renderCheckboxField("ed.entity.fallback_vibrate", "haptics.fallback_vibrate", haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
          "ed.entity.haptic_style",
          "haptics.style",
          hapticStyle,
          [
            { value: "selection", label: "ed.person.haptic_selection" },
            { value: "light", label: "ed.person.haptic_light" },
            { value: "medium", label: "ed.person.haptic_medium" },
            { value: "heavy", label: "ed.person.haptic_heavy" },
            { value: "success", label: "ed.person.haptic_success" },
            { value: "warning", label: "ed.person.haptic_warning" },
            { value: "failure", label: "ed.person.haptic_failure" }
          ]
        )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Animaciones"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Controla la entrada del tooltip y el rebote visual de los chips."))}</div>
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
          ${this._showAnimationSection ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("Activar animaciones", "animations.enabled", animations.enabled !== false)}
                  ${this._renderTextField("Tooltip y hover (ms)", "animations.hover_duration", animations.hover_duration, {
          type: "number",
          valueType: "number"
        })}
                  ${this._renderTextField("Rebote de chips (ms)", "animations.button_bounce_duration", animations.button_bounce_duration, {
          type: "number",
          valueType: "number"
        })}
                </div>
              ` : ""}
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Estilos"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Ajustes visuales de la card, el icono y el grafico."))}</div>
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
          ${this._showStyleSection ? `
                <div class="editor-grid">
                  ${this._renderColorField("Fondo tarjeta", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("Borde", "styles.card.border", config.styles.card.border)}
                  ${window.NodaliaUtils.renderEditorCardBorderRadiusHtml({
          escapeHtml,
          field: "styles.card.border_radius",
          value: config.styles?.card?.border_radius,
          tHeading: this._editorLabel("ed.entity.style_card_radius_presets"),
          labels: {
            pill: this._editorLabel("ed.entity.chip_radius_pill"),
            soft: this._editorLabel("ed.entity.chip_radius_soft"),
            round: this._editorLabel("ed.entity.chip_radius_round"),
            square: this._editorLabel("ed.entity.chip_radius_square")
          }
        })}
                  <div class="editor-section__hint editor-field--full" style="margin-top: -6px;">${escapeHtml(this._editorLabel("ed.entity.style_card_radius_yaml_hint"))}</div>
                  ${this._renderTextField("Sombra", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("Separacion", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderColorField("Color icono", "styles.icon.color", config.styles.icon.color, {
          fallbackValue: "var(--primary-text-color)"
        })}
                  ${this._renderTextField("Tamano icono", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
                  ${this._renderTextField("Tamano valor", "styles.value_size", config.styles.value_size)}
                  ${this._renderTextField("Tamano unidad", "styles.unit_size", config.styles.unit_size)}
                  ${this._renderTextField("Tamano leyenda", "styles.legend_size", config.styles.legend_size)}
            ${window.NodaliaUtils.renderEditorChipBorderRadiusHtml({
          escapeHtml,
          field: "styles.chip_border_radius",
          value: config.styles?.chip_border_radius,
          tHeading: this._editorLabel("ed.entity.style_chip_radius"),
          labels: {
            pill: this._editorLabel("ed.entity.chip_radius_pill"),
            soft: this._editorLabel("ed.entity.chip_radius_soft"),
            round: this._editorLabel("ed.entity.chip_radius_round"),
            square: this._editorLabel("ed.entity.chip_radius_square")
          }
        })}
                  ${this._renderTextField("Alto grafica", "styles.chart_height", config.styles.chart_height)}
                  ${this._renderTextField("Grosor linea", "styles.line_width", config.styles.line_width)}
                </div>
              ` : ""}
        </section>
      </div>
    `;
        this.shadowRoot.querySelectorAll('[data-mounted-control="entity-picker"]').forEach((host) => this._mountEntityPicker(host));
        this.shadowRoot.querySelectorAll('[data-mounted-control="icon-picker"]').forEach((host) => this._mountIconPicker(host));
        this._ensureEditorControlsReady();
        window.NodaliaUtils?.clampEditorDialogScroll?.(this);
      }
    }
    _lazyNodaliaGraphCardEditor = NodaliaGraphCardEditor;
    return NodaliaGraphCardEditor;
  }

  // src/cards/graph/index.ts
  window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaGraphCard, { editorTag: EDITOR_TAG });
  window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaGraphCardEditor);
  try {
    window.NodaliaUtils?.registerCustomCard?.({
      type: CARD_TAG,
      name: "Nodalia Graph Card",
      description: "Tarjeta de grafica elegante para una o varias entidades numericas con estilo Nodalia.",
      preview: true
    });
  } catch {
  }
  var publicApi = {
    CARD_TAG,
    EDITOR_TAG,
    CARD_VERSION,
    DEFAULT_CONFIG,
    normalizeConfig,
    normalizeEditorConfig
  };
  window.__NODALIA_GRAPH__ = publicApi;
})();
