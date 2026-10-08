import type { HassEntity, HomeAssistant } from "../../core/types/home-assistant";
export { parseRgbColor, getRelativeLuminance } from "../../shared/color-luminance";
import { normalizeControlStyles } from "../../shared/control-config";
import { getStubEntityId } from "../../shared/editor-entity-helpers";
export { getStubEntityId, parseSizeToPixels } from "../../shared/editor-entity-helpers";
export { parseFiniteNumericValue } from "../../shared/numeric-values";
interface TintStop { offset: number; color: string }
// Explicit physical units take precedence over friendly-name/domain heuristics.
const GAUGE_MAX_BY_UNIT = new Map<string, number>([
  ["%", 100], ["w", 2500], ["watt", 2500], ["watts", 2500], ["va", 2500], ["kw", 10],
  ["l_s", 10], ["l_min", 60], ["m3_h", 10],
  ["a", 32], ["ma", 3000], ["v", 260], ["mv", 1000],
  ["c", 40], ["f", 40], ["degc", 40], ["degf", 40], ["bar", 1200], ["hpa", 1200], ["pa", 1200],
 ]);
export { resolveEditorColorValue, formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
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

export function applyStubEntity<T extends Record<string, unknown>>(config: T, hass: HomeAssistant | null | undefined, domains: string[] = [], entities: unknown = [], entitiesFallback: unknown = []) {
  const entityId = getStubEntityId(hass, domains, entities, entitiesFallback);
  if (!entityId) {
    return config;
  }

  Object.assign(config, { entity: entityId });
  const state = hass?.states?.[entityId];
  const unit = String(state?.attributes?.unit_of_measurement || "").trim();
  const numericState = Number(state?.state);
  Object.assign(config, { name: state?.attributes?.friendly_name || entityId });

  if (unit === "%") {
    Object.assign(config, { min: 0, max: 100 });
  } else if (Number.isFinite(numericState) && numericState > Number(config.max || 0)) {
    Object.assign(config, { min: 0, max: Math.ceil(numericState * 1.25) });
  }

  return config;
}








export function escapeSelectorValue(value: unknown) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function sanitizeCssValue(value: unknown, fallback: unknown) {
  // Multi-line YAML (> or |) yields line breaks; in CSS they are plain whitespace.
  const raw = String(value ?? "").replace(/[\t\n\f\r]+/g, " ").trim();
  const safeFallback = String(fallback ?? "").trim();
  if (!raw) {
    return safeFallback;
  }
  if (([...raw].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || /[<>;"'{}]/.test(raw)) || raw.includes("/*") || raw.includes("*/")) {
    return safeFallback;
  }
  return raw;
}

export function getSafeStyles(styles: unknown = DEFAULT_CONFIG.styles) {
  return normalizeControlStyles(styles, DEFAULT_CONFIG.styles);
}

export function getEditorColorFallbackValue(field: unknown) {
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


export function resolveColorInContext(contextNode: Node | null | undefined, value: unknown) {
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
  try {
    return getComputedStyle(probe).color || rawValue;
  } finally {
    probe.remove();
  }
}

export function getGaugeSvgFallbackColor(ratio: unknown) {
  const safeRatio = clamp(Number(ratio) || 0, 0, 1);
  const upperIndex = GAUGE_SVG_FALLBACK_TINT_SCALE.findIndex(stop => safeRatio <= stop.offset);
  if (upperIndex <= 0) {
    return `rgb(${GAUGE_SVG_FALLBACK_TINT_SCALE[0]?.channels.join(", ") || "126, 136, 146"})`;
  }

  const upper = GAUGE_SVG_FALLBACK_TINT_SCALE[upperIndex];
  const lower = GAUGE_SVG_FALLBACK_TINT_SCALE[upperIndex - 1];
  if (!upper || !lower) return "rgb(126, 136, 146)";
  const localRatio = (safeRatio - lower.offset) / Math.max(upper.offset - lower.offset, 0.0001);
  const channels = lower.channels.map((channel, index) => (
    Math.round(channel + (((upper.channels[index] ?? channel) - channel) * localRatio))
  ));
  return `rgb(${channels.join(", ")})`;
}

export function resolveGaugeSvgStrokeColor(value: unknown, fallback: string) {
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

export function isUnavailableState(state: HassEntity | null | undefined) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function getStepPrecision(step: unknown) {
  const text = String(step ?? "");
  if (!text.includes(".")) {
    return 0;
  }

  return (text.split(".")[1]?.length ?? 0);
}

export function inferDecimals(rawValue: unknown) {
  const text = String(rawValue ?? "").trim();
  const normalized = text.replace(",", ".");
  if (!normalized.includes(".")) {
    return 0;
  }

  return Math.min(3, (normalized.split(".")[1]?.length ?? 0));
}

export function getHassLocaleTag(hass: HomeAssistant | null | undefined, language = "auto") {
  const lang = window.NodaliaI18n?.resolveLanguage?.(hass, language);
  return (lang === undefined ? undefined : window.NodaliaI18n?.localeTag?.(lang)) || hass?.locale?.language || undefined;
}

export { formatFiniteNumericValue as formatNumberValue } from "../../shared/numeric-values";

export function inferReasonableMax(currentValue: number | null, unit: unknown, state: HassEntity | null | undefined) {
  const normalizedUnit = normalizeTextKey(unit);
  const knownUnitMax = GAUGE_MAX_BY_UNIT.get(String(unit ?? "").trim() === "%" ? "%" : normalizedUnit);
  if (knownUnitMax !== undefined) return knownUnitMax;
  const domainHint = `${state?.entity_id || ""} ${state?.attributes?.device_class || ""} ${state?.attributes?.friendly_name || ""}`.toLowerCase();

  if (domainHint.includes("battery") || domainHint.includes("humidity")) {
    return 100;
  }

  if (domainHint.includes("power") || domainHint.includes("potencia")) {
    return 2500;
  }

  if (domainHint.includes("current") || domainHint.includes("corriente")) {
    return 32;
  }

  if (domainHint.includes("voltage") || domainHint.includes("tension")) {
    return 260;
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

  if (domainHint.includes("temperature") || domainHint.includes("temperatura")) {
    return 40;
  }

  if (domainHint.includes("pressure") || domainHint.includes("presion")) {
    return 1200;
  }

  if (currentValue !== null && Number.isFinite(currentValue)) {
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

export function getDialMarkerPosition(angle: number) {
  const markerRadiusPercent = (DIAL_CIRCLE_RADIUS / DIAL_VIEWBOX_SIZE) * 100;
  const radians = (angle * Math.PI) / 180;
  return {
    left: Number((50 + (Math.cos(radians) * markerRadiusPercent)).toFixed(3)),
    top: Number((50 + (Math.sin(radians) * markerRadiusPercent)).toFixed(3)),
  };
}

/** CSS rotate for thumb orbit: translateY(-orbit) starts at 12 o'clock; math angles use 3 o'clock = 0°. */
export function getDialThumbRotate(angle: number) {
  return Number((angle + 90).toFixed(3));
}

export function getContinuousThumbRotate(previousRotate: number | null | undefined, nextAngle: number) {
  if (previousRotate == null || !Number.isFinite(previousRotate)) {
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

export function getDialMarkerCoordinates(angle: number) {
  const center = DIAL_VIEWBOX_SIZE / 2;
  const radians = (angle * Math.PI) / 180;
  return {
    x: Number((center + (Math.cos(radians) * DIAL_CIRCLE_RADIUS)).toFixed(3)),
    y: Number((center + (Math.sin(radians) * DIAL_CIRCLE_RADIUS)).toFixed(3)),
  };
}

export function mixCssColors(leftColor: string, rightColor: string, ratio: unknown) {
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

export function buildGaugeTintScale(minTintColor: unknown = undefined, maxTintColor: unknown = undefined) {
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

export function resolveGaugeTintColor(scale: unknown, ratio: unknown) {
  const safeRatio = clamp(Number(ratio) || 0, 0, 1);
  const validStops = Array.isArray(scale) ? scale.filter((stop: unknown): stop is TintStop => (
    stop !== null && typeof stop === "object" && "offset" in stop && typeof stop.offset === "number" && Number.isFinite(stop.offset)
    && "color" in stop && typeof stop.color === "string"
  )) : [];
  const tintScale = validStops.length ? validStops : buildGaugeTintScale();
  const first = tintScale[0];
  if (!first) return DEFAULT_GAUGE_MAX_TINT_COLOR;

  if (safeRatio <= first.offset) return first.color;

  for (let index = 1; index < tintScale.length; index += 1) {
    const currentStop = tintScale[index];
    const previousStop = tintScale[index - 1];
    if (!currentStop || !previousStop) continue;
    if (safeRatio <= currentStop.offset) {
      const span = Math.max(currentStop.offset - previousStop.offset, 0.0001);
      return mixCssColors(previousStop.color, currentStop.color, (safeRatio - previousStop.offset) / span);
    }
  }
  return tintScale[tintScale.length - 1]?.color || DEFAULT_GAUGE_MAX_TINT_COLOR;
}
