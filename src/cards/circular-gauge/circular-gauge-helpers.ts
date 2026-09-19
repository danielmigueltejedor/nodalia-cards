// @ts-nocheck -- color, dial and stub helpers stay loosely typed until remaining unknowns are narrowed.
import {
  DEFAULT_GAUGE_MAX_TINT_COLOR,
  DEFAULT_GAUGE_MIN_TINT_COLOR,
  DIAL_CIRCLE_RADIUS,
  DIAL_SWEEP,
  DIAL_VIEWBOX_SIZE,
  GAUGE_SVG_FALLBACK_TINT_SCALE,
} from "./circular-gauge-constants";
import { clamp, normalizeTextKey } from "./circular-gauge-runtime";
import { DEFAULT_CONFIG } from "./circular-gauge-config";

export function getStubEntityId(hass, domains = [], entities = [], entitiesFallback = []) {
  return window.NodaliaUtils.findStubEntityIds(hass, entities, entitiesFallback, domains, 1)[0] || "";
}

export function applyStubEntity(config, hass, domains, entities = [], entitiesFallback = []) {
  const entityId = getStubEntityId(hass, domains, entities, entitiesFallback);
  if (!entityId) {
    return config;
  }

  config.entity = entityId;
  const state = hass?.states?.[entityId];
  const unit = String(state?.attributes?.unit_of_measurement || "").trim();
  const numericState = Number(state?.state);
  config.name = state?.attributes?.friendly_name || entityId;

  if (unit === "%") {
    config.min = 0;
    config.max = 100;
  } else if (Number.isFinite(numericState) && numericState > Number(config.max || 0)) {
    config.min = 0;
    config.max = Math.ceil(numericState * 1.25);
  }

  return config;
}








export function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}


export function escapeSelectorValue(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function sanitizeCssValue(value, fallback) {
  const raw = String(value ?? "").trim();
  const safeFallback = String(fallback ?? "").trim();
  if (!raw) {
    return safeFallback;
  }
  if (/[\u0000-\u001f\u007f<>;"'{}]/.test(raw) || raw.includes("/*") || raw.includes("*/")) {
    return safeFallback;
  }
  return raw;
}

export function getSafeStyles(styles = DEFAULT_CONFIG.styles) {
  const defaults = DEFAULT_CONFIG.styles;
  const card = styles?.card || {};
  const icon = styles?.icon || {};
  const gauge = styles?.gauge || {};
  return {
    card: {
      background: sanitizeCssValue(card.background, defaults.card.background),
      border: sanitizeCssValue(card.border, defaults.card.border),
      border_radius: sanitizeCssValue(card.border_radius, defaults.card.border_radius),
      box_shadow: sanitizeCssValue(card.box_shadow, defaults.card.box_shadow),
      padding: sanitizeCssValue(card.padding, defaults.card.padding),
      gap: sanitizeCssValue(card.gap, defaults.card.gap),
    },
    icon: {
      size: sanitizeCssValue(icon.size, defaults.icon.size),
      background: sanitizeCssValue(icon.background, defaults.icon.background),
      color: sanitizeCssValue(icon.color, defaults.icon.color),
    },
    chip_height: sanitizeCssValue(styles?.chip_height, defaults.chip_height),
    chip_font_size: sanitizeCssValue(styles?.chip_font_size, defaults.chip_font_size),
    chip_padding: sanitizeCssValue(styles?.chip_padding, defaults.chip_padding),
    chip_border_radius: sanitizeCssValue(styles?.chip_border_radius, defaults.chip_border_radius),
    title_size: sanitizeCssValue(styles?.title_size, defaults.title_size),
    value_size: sanitizeCssValue(styles?.value_size, defaults.value_size),
    range_size: sanitizeCssValue(styles?.range_size, defaults.range_size),
    name_chip_max_width: sanitizeCssValue(styles?.name_chip_max_width, defaults.name_chip_max_width),
    gauge: {
      size: sanitizeCssValue(gauge.size, defaults.gauge.size),
      stroke: sanitizeCssValue(gauge.stroke, defaults.gauge.stroke),
      thumb_size: sanitizeCssValue(gauge.thumb_size, defaults.gauge.thumb_size),
      track_color: sanitizeCssValue(gauge.track_color, defaults.gauge.track_color),
      background: sanitizeCssValue(gauge.background, defaults.gauge.background),
      min_tint_color: sanitizeCssValue(gauge.min_tint_color, defaults.gauge.min_tint_color),
      max_tint_color: sanitizeCssValue(gauge.max_tint_color, defaults.gauge.max_tint_color),
      foreground_color: sanitizeCssValue(gauge.foreground_color, defaults.gauge.foreground_color),
    },
  };
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

  if (normalizedField.endsWith("icon.background")) {
    return "color-mix(in srgb, var(--primary-text-color) 6%, transparent)";
  }

  if (normalizedField.endsWith("gauge.background")) {
    return "color-mix(in srgb, var(--primary-text-color) 2%, transparent)";
  }

  if (normalizedField.endsWith("track_color")) {
    return "color-mix(in srgb, var(--primary-text-color) 24%, var(--ha-card-background))";
  }

  if (normalizedField.endsWith("min_tint_color")) {
    return DEFAULT_GAUGE_MIN_TINT_COLOR;
  }

  if (normalizedField.endsWith("max_tint_color")) {
    return DEFAULT_GAUGE_MAX_TINT_COLOR;
  }

  if (normalizedField.endsWith("foreground_color")) {
    return DEFAULT_GAUGE_MAX_TINT_COLOR;
  }

  if (normalizedField.endsWith("icon.color")) {
    return "var(--primary-text-color)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
}


export function resolveColorInContext(contextNode, value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue || typeof document === "undefined") {
    return rawValue;
  }

  const probe = document.createElement("span");
  probe.style.position = "fixed";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  probe.style.color = "";
  probe.style.color = rawValue;
  (contextNode || document.body || document.documentElement).appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || rawValue;
}

export function getGaugeSvgFallbackColor(ratio) {
  const safeRatio = clamp(Number(ratio) || 0, 0, 1);
  const upperIndex = GAUGE_SVG_FALLBACK_TINT_SCALE.findIndex(stop => safeRatio <= stop.offset);
  if (upperIndex <= 0) {
    return `rgb(${GAUGE_SVG_FALLBACK_TINT_SCALE[0].channels.join(", ")})`;
  }

  const upper = GAUGE_SVG_FALLBACK_TINT_SCALE[upperIndex];
  const lower = GAUGE_SVG_FALLBACK_TINT_SCALE[upperIndex - 1];
  const localRatio = (safeRatio - lower.offset) / Math.max(upper.offset - lower.offset, 0.0001);
  const channels = lower.channels.map((channel, index) => (
    Math.round(channel + ((upper.channels[index] - channel) * localRatio))
  ));
  return `rgb(${channels.join(", ")})`;
}

export function resolveGaugeSvgStrokeColor(value, fallback) {
  const source = String(value || "").trim();
  if (
    !source
    || /(?:color-mix|var)\(/i.test(source)
    || !/^(?:#[\da-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-z]+)$/i.test(source)
  ) {
    return fallback;
  }
  return source;
}

export function parseRgbColor(value) {
  const source = String(value ?? "").trim();
  if (!source) {
    return null;
  }

  const rgbMatch = source.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const channels = rgbMatch[1]
      .split(",")
      .map(channel => Number.parseFloat(channel.trim()))
      .filter(channel => Number.isFinite(channel));

    if (channels.length >= 3) {
      return {
        red: clamp(channels[0], 0, 255),
        green: clamp(channels[1], 0, 255),
        blue: clamp(channels[2], 0, 255),
      };
    }
  }

  const hexMatch = source.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1].length === 3
      ? hexMatch[1].split("").map(channel => channel + channel).join("")
      : hexMatch[1];

    return {
      red: Number.parseInt(hex.slice(0, 2), 16),
      green: Number.parseInt(hex.slice(2, 4), 16),
      blue: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  return null;
}

export function getRelativeLuminance(color) {
  if (!color) {
    return null;
  }

  const toLinear = channel => {
    const normalized = clamp(Number(channel) / 255, 0, 1);
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  const red = toLinear(color.red);
  const green = toLinear(color.green);
  const blue = toLinear(color.blue);
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}


export function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function getStepPrecision(step) {
  const text = String(step ?? "");
  if (!text.includes(".")) {
    return 0;
  }

  return text.split(".")[1].length;
}

export function inferDecimals(rawValue) {
  const text = String(rawValue ?? "").trim();
  const normalized = text.replace(",", ".");
  if (!normalized.includes(".")) {
    return 0;
  }

  return Math.min(3, normalized.split(".")[1].length);
}

export function getHassLocaleTag(hass, language = "auto") {
  const lang = window.NodaliaI18n?.resolveLanguage?.(hass, language);
  return window.NodaliaI18n?.localeTag?.(lang) || hass?.locale?.language || undefined;
}

export function formatNumberValue(value, decimals = 0, locale = undefined) {
  if (!Number.isFinite(Number(value))) {
    return "--";
  }

  return Number(value).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function inferReasonableMax(currentValue, unit, state) {
  const normalizedUnit = normalizeTextKey(unit);
  const domainHint = `${state?.entity_id || ""} ${state?.attributes?.device_class || ""} ${state?.attributes?.friendly_name || ""}`.toLowerCase();

  if (normalizedUnit === "%" || domainHint.includes("battery") || domainHint.includes("humidity")) {
    return 100;
  }

  if (["w", "watt", "watts", "va"].includes(normalizedUnit) || domainHint.includes("power") || domainHint.includes("potencia")) {
    return 2500;
  }

  if (["kw"].includes(normalizedUnit)) {
    return 10;
  }

  if (["a", "ma"].includes(normalizedUnit) || domainHint.includes("current") || domainHint.includes("corriente")) {
    return normalizedUnit === "ma" ? 3000 : 32;
  }

  if (["v", "mv"].includes(normalizedUnit) || domainHint.includes("voltage") || domainHint.includes("tension")) {
    return normalizedUnit === "mv" ? 1000 : 260;
  }

  if (
    normalizedUnit.includes("l_s")
    || normalizedUnit.includes("l_min")
    || normalizedUnit.includes("m3_h")
    || domainHint.includes("water")
    || domainHint.includes("agua")
    || domainHint.includes("caudal")
    || domainHint.includes("flow")
  ) {
    if (normalizedUnit.includes("l_s")) {
      return 10;
    }
    if (normalizedUnit.includes("l_min")) {
      return 60;
    }
    if (normalizedUnit.includes("m3_h")) {
      return 10;
    }
    return 100;
  }

  if (["c", "f", "degc", "degf"].includes(normalizedUnit) || domainHint.includes("temperature") || domainHint.includes("temperatura")) {
    return 40;
  }

  if (["bar", "hpa", "pa"].includes(normalizedUnit) || domainHint.includes("pressure") || domainHint.includes("presion")) {
    return 1200;
  }

  if (Number.isFinite(currentValue)) {
    if (currentValue <= 10) return 10;
    if (currentValue <= 50) return 50;
    if (currentValue <= 100) return 100;
    if (currentValue <= 250) return 250;
    if (currentValue <= 500) return 500;
    if (currentValue <= 1000) return 1000;
    if (currentValue <= 2500) return 2500;
    if (currentValue <= 5000) return 5000;
    if (currentValue <= 10000) return 10000;
  }

  return 100;
}

export function getDialMarkerPosition(angle) {
  const markerRadiusPercent = (DIAL_CIRCLE_RADIUS / DIAL_VIEWBOX_SIZE) * 100;
  const radians = (angle * Math.PI) / 180;
  return {
    left: Number((50 + (Math.cos(radians) * markerRadiusPercent)).toFixed(3)),
    top: Number((50 + (Math.sin(radians) * markerRadiusPercent)).toFixed(3)),
  };
}

/** CSS rotate for thumb orbit: translateY(-orbit) starts at 12 o'clock; math angles use 3 o'clock = 0°. */
export function getDialThumbRotate(angle) {
  return Number((angle + 90).toFixed(3));
}

export function getContinuousThumbRotate(previousRotate, nextAngle) {
  if (!Number.isFinite(previousRotate)) {
    return getDialThumbRotate(nextAngle);
  }
  const nextRotate = getDialThumbRotate(nextAngle);
  let delta = nextRotate - previousRotate;
  if (delta > DIAL_SWEEP / 2) {
    delta -= 360;
  } else if (delta < -(DIAL_SWEEP / 2)) {
    delta += 360;
  }
  return Number((previousRotate + delta).toFixed(3));
}

export function getDialMarkerCoordinates(angle) {
  const center = DIAL_VIEWBOX_SIZE / 2;
  const radians = (angle * Math.PI) / 180;
  return {
    x: Number((center + (Math.cos(radians) * DIAL_CIRCLE_RADIUS)).toFixed(3)),
    y: Number((center + (Math.sin(radians) * DIAL_CIRCLE_RADIUS)).toFixed(3)),
  };
}

export function mixCssColors(leftColor, rightColor, ratio) {
  const safeRatio = clamp(Number(ratio) || 0, 0, 1);
  if (safeRatio <= 0) {
    return leftColor;
  }

  if (safeRatio >= 1) {
    return rightColor;
  }

  const rightPercent = Number((safeRatio * 100).toFixed(2));
  const leftPercent = Number((100 - rightPercent).toFixed(2));

  return `color-mix(in srgb, ${leftColor} ${leftPercent}%, ${rightColor} ${rightPercent}%)`;
}

export function buildGaugeTintScale(minTintColor, maxTintColor) {
  const safeMinTintColor = String(minTintColor || DEFAULT_GAUGE_MIN_TINT_COLOR).trim() || DEFAULT_GAUGE_MIN_TINT_COLOR;
  const safeMaxTintColor = String(maxTintColor || DEFAULT_GAUGE_MAX_TINT_COLOR).trim() || DEFAULT_GAUGE_MAX_TINT_COLOR;

  return [
    { offset: 0, color: safeMinTintColor },
    { offset: 0.28, color: mixCssColors("#71cf78", safeMaxTintColor, 0.08) },
    { offset: 0.52, color: mixCssColors("#d9c45a", safeMaxTintColor, 0.14) },
    { offset: 0.76, color: mixCssColors("#f5a03d", safeMaxTintColor, 0.22) },
    { offset: 1, color: safeMaxTintColor },
  ];
}

export function resolveGaugeTintColor(scale, ratio) {
  const safeRatio = clamp(Number(ratio) || 0, 0, 1);
  const tintScale = Array.isArray(scale) && scale.length ? scale : buildGaugeTintScale();

  if (safeRatio <= tintScale[0].offset) {
    return tintScale[0].color;
  }

  for (let index = 1; index < tintScale.length; index += 1) {
    const currentStop = tintScale[index];
    const previousStop = tintScale[index - 1];

    if (safeRatio <= currentStop.offset) {
      const span = Math.max(currentStop.offset - previousStop.offset, 0.0001);
      const localRatio = (safeRatio - previousStop.offset) / span;
      return mixCssColors(previousStop.color, currentStop.color, localRatio);
    }
  }

  return tintScale[tintScale.length - 1].color;
}
