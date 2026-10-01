import type { HassEntity, HomeAssistant } from "../../core/types/home-assistant";
import { parseFiniteNumericValue } from "../../shared/numeric-values";
import { buildSmoothPath, buildAreaPath } from "../../shared/history-geometry";
import type { HistorySample, GraphPoint } from "../../shared/history-geometry";
export { buildSmoothPath as buildAirQualitySmoothPath, buildAreaPath as buildAirQualityAreaPath, buildInterpolatedSamples as buildAirQualityInterpolatedSamples, parseHistoryTimestamp as parseAirQualityHistoryTimestamp } from "../../shared/history-geometry";
export { getStubEntityId, applyStubEntity, parseSizeToPixels } from "../../shared/editor-entity-helpers";
export { formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import {
  AIR_QUALITY_ATTR_ALIASES,
  AIR_QUALITY_LEVEL_RANK,
  AIR_QUALITY_WHO_BANDS,
} from "./entity-constants";
import { clamp, isObject, normalizeTextKey } from "./entity-runtime";

export function resolveAirQualityLevelFromBands(value: unknown, bands: unknown) {
  const numeric = parseFiniteNumericValue(value);
  if (numeric === null || !Array.isArray(bands) || !bands.length) {
    return "unknown";
  }
  const validBands: { max: number; level: string }[] = [];
  for (const band of bands) {
    if (!isObject(band) || typeof band.level !== "string") continue;
    const max = band.max === Infinity ? Infinity : parseFiniteNumericValue(band.max);
    if (max !== null) validBands.push({ max, level: band.level });
  }
  for (const band of validBands) {
    if (numeric <= band.max) return band.level;
  }
  return validBands[validBands.length - 1]?.level || "unknown";
}

export function resolveAirQualityLevelFromAqi(value: unknown) {
  const numeric = parseFiniteNumericValue(value);
  if (numeric === null) {
    return "unknown";
  }
  if (numeric <= 50) return "good";
  if (numeric <= 100) return "moderate";
  if (numeric <= 150) return "unhealthy_sensitive";
  if (numeric <= 200) return "unhealthy";
  if (numeric <= 300) return "very_unhealthy";
  return "hazardous";
}

export function resolveMetricGuidelineBands(kind: unknown, unit: unknown = "") {
  const unitKey = String(unit || "").toLowerCase();
  if (kind === "tvoc") {
    if (unitKey.includes("ppb")) {
      return AIR_QUALITY_WHO_BANDS.tvoc_ppb;
    }
    return AIR_QUALITY_WHO_BANDS.tvoc_ugm3;
  }
  return typeof kind === "string" && isGuidelineKey(kind) ? AIR_QUALITY_WHO_BANDS[kind] : null;
}

function isGuidelineKey(key: string): key is keyof typeof AIR_QUALITY_WHO_BANDS { return Object.prototype.hasOwnProperty.call(AIR_QUALITY_WHO_BANDS, key); }
function isLevel(key: unknown): key is keyof typeof AIR_QUALITY_LEVEL_RANK { return typeof key === "string" && Object.prototype.hasOwnProperty.call(AIR_QUALITY_LEVEL_RANK, key); }
function isMetric(key: unknown): key is keyof typeof AIR_QUALITY_ATTR_ALIASES { return typeof key === "string" && Object.prototype.hasOwnProperty.call(AIR_QUALITY_ATTR_ALIASES, key); }

export function worseAirQualityLevel(left: unknown, right: unknown) {
  const leftRank = isLevel(left) ? AIR_QUALITY_LEVEL_RANK[left] : undefined;
  const rightRank = isLevel(right) ? AIR_QUALITY_LEVEL_RANK[right] : undefined;
  if (leftRank === undefined) {
    return rightRank !== undefined && isLevel(right) ? right : "unknown";
  }
  if (rightRank === undefined && isLevel(left)) {
    return left;
  }
  return rightRank !== undefined && rightRank > leftRank && isLevel(right) ? right : isLevel(left) ? left : "unknown";
}

export function readAirQualityAttribute(state: HassEntity | null | undefined, kind: unknown) {
  const attrs = state?.attributes || {};
  for (const alias of (isMetric(kind) ? AIR_QUALITY_ATTR_ALIASES[kind] : [])) {
    if (attrs[alias] !== undefined && attrs[alias] !== null && attrs[alias] !== "") {
      return attrs[alias];
    }
  }
  return null;
}

export function parseAirQualityNumeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const match = String(value ?? "").trim().match(/-?\d+(?:[.,]\d+)?/);
  if (!match) {
    return NaN;
  }
  return Number(match[0].replace(",", "."));
}

export interface AirQualitySeries extends Record<string, unknown> { samples: HistorySample[] }
export interface AirQualityPoint extends GraphPoint, HistorySample {}
export interface AirQualityPath extends AirQualitySeries { points: AirQualityPoint[]; linePath: string; fillPath: string }
export interface AirQualityGeometry { width: number; height: number; paddingX: number; paddingTop: number; paddingBottom: number; min: number | null; max: number | null; paths: AirQualityPath[] }
function finiteSample(value: unknown): value is HistorySample { return isObject(value) && typeof value.ts === "number" && Number.isFinite(value.ts) && typeof value.value === "number" && Number.isFinite(value.value); }

export function buildAirQualityChartGeometry(seriesEntries: unknown = []): AirQualityGeometry {
  const width = 100;
  const height = 42;
  const paddingX = 0;
  const paddingTop = 3;
  const paddingBottom = 3;
  const usable: AirQualitySeries[] = [];
  for (const entry of Array.isArray(seriesEntries) ? seriesEntries : []) {
    if (!isObject(entry) || !Array.isArray(entry.samples)) continue;
    const samples = entry.samples.filter(finiteSample);
    if (samples.length) usable.push({ ...entry, samples });
  }
  let min = Infinity;
  let max = -Infinity;
  usable.forEach(entry => {
    entry.samples.forEach(sample => {
      if (Number.isFinite(sample?.value)) {
        min = Math.min(min, sample.value);
        max = Math.max(max, sample.value);
      }
    });
  });
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { width, height, paddingX, paddingTop, paddingBottom, min: null, max: null, paths: [] };
  }
  if (max <= min) {
    max = min + 1;
  }
  if (!Number.isFinite(max - min) || max <= min) {
    return { width, height, paddingX, paddingTop, paddingBottom, min: null, max: null, paths: [] };
  }
  const spanX = width - (paddingX * 2);
  const paths = usable.map(entry => {
    const points = entry.samples.map((sample, index) => {
      const x = paddingX + (spanX * index) / Math.max(entry.samples.length - 1, 1);
      const normalized = clamp((sample.value - min) / (max - min), 0, 1);
      const y = paddingTop + ((height - paddingTop - paddingBottom) * (1 - normalized));
      return {
        x,
        y,
        ts: sample.ts,
        value: sample.value,
      };
    });
    return {
      ...entry,
      points,
      linePath: buildSmoothPath(points),
      fillPath: buildAreaPath(points, height - paddingBottom),
    };
  });
  return { width, height, paddingX, paddingTop, paddingBottom, min, max, paths };
}

export function getAirQualityHoverPayload(geometry: AirQualityGeometry | null | undefined, hoverState: unknown) {
  if (!geometry?.paths?.length || !isObject(hoverState)) {
    return null;
  }
  const path = geometry.paths.find(entry => entry.kind === hoverState.kind);
  if (!path?.points?.length) {
    return null;
  }
  const requestedPosition = parseFiniteNumericValue(hoverState.position);
  const position = clamp(
    requestedPosition !== null ? requestedPosition : (parseFiniteNumericValue(hoverState.index) || 0),
    0,
    path.points.length - 1,
  );
  const leftIndex = Math.floor(position);
  const rightIndex = Math.ceil(position);
  const fraction = position - leftIndex;
  const leftPoint = path.points[leftIndex];
  const rightPoint = path.points[rightIndex] || leftPoint;
  if (!leftPoint || !rightPoint) return null;
  const interpolate = (key: keyof AirQualityPoint) => leftPoint[key] + ((rightPoint[key] - leftPoint[key]) * fraction);
  const point = {
    x: interpolate("x"),
    y: interpolate("y"),
    ts: interpolate("ts"),
    value: interpolate("value"),
  };
  const index = clamp(Math.round(position), 0, path.points.length - 1);
  return {
    kind: path.kind,
    index,
    position,
    label: path.label,
    unit: path.unit,
    color: path.color,
    ts: point.ts,
    value: point.value,
    x: point.x,
    y: point.y,
    xPercent: clamp((point.x / geometry.width) * 100, 0, 100),
    yPercent: clamp((point.y / geometry.height) * 100, 0, 100),
  };
}

export function parseNumericValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const rawValue = String(value ?? "").trim();
  if (!rawValue || !/^-?\d+(?:[.,]\d+)?$/.test(rawValue)) {
    return null;
  }

  const numericValue = Number(rawValue.replace(",", "."));
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function formatNumericValue(value: unknown, maximumFractionDigits = 2) {
  const numericValue = parseNumericValue(value);
  if (numericValue === null) {
    return String(value ?? "");
  }

  const safeDigits = clamp(Math.round(parseFiniteNumericValue(maximumFractionDigits) ?? 2), 0, 6);
  return numericValue
    .toFixed(safeDigits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

export function formatNumericValueWithUnit(value: unknown, unit: unknown = "", maximumFractionDigits = 2) {
  const formattedValue = formatNumericValue(value, maximumFractionDigits);
  const normalizedUnit = String(unit || "").trim();

  if (!normalizedUnit) {
    return formattedValue;
  }

  return `${formattedValue}${normalizedUnit.startsWith("°") ? "" : " "}${normalizedUnit}`;
}

export function getValueSignature(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    return `a:${value.length}|${value.map(item => String(item ?? "")).join(",")}`;
  }

  if (isObject(value)) {
    const keys = Object.keys(value).sort();
    return `o:${keys.length}|${keys.map(key => `${key}=${String(value[key] ?? "")}`).join(",")}`;
  }

  return String(value);
}

export function getEditorColorFallbackValue(field: unknown) {
  const normalizedField = String(field ?? "");

  if (normalizedField.endsWith("off_color")) {
    return "var(--primary-text-color)";
  }

  if (normalizedField.endsWith("accent_background")) {
    return "rgba(113, 192, 255, 0.18)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
}

export function shouldDarkenEntityBubbleIconGlyph(state: HassEntity | null | undefined, accentColor: unknown) {
  return Boolean(window.NodaliaBubbleContrast?.shouldDarkenBubbleIconGlyph?.(state, accentColor));
}

export function resolveEntityBubbleIconGlyphColor(accentColor: unknown, state: HassEntity | null | undefined) {
  const accent = String(accentColor || "").trim() || "var(--primary-color)";
  let accentWeight = 72;
  try {
    const resolver = window.NodaliaBubbleContrast?.resolveBubbleIconGlyphColor;
    if (typeof resolver === "function") {
      return resolver(state, accent);
    }
    accentWeight = shouldDarkenEntityBubbleIconGlyph(state, accent) ? 42 : 72;
  } catch (_error) {
    // resolveEditorColorValue may need a DOM probe; use the Light Card mix below.
  }
  return `color-mix(in srgb, ${accent} ${accentWeight}%, var(--primary-text-color))`;
}

export function isUnavailableState(state: HassEntity | null | undefined) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function getEntityDomain(state: HassEntity | null | undefined) {
  const entityId = String(state?.entity_id || "");
  return entityId.includes(".") ? (entityId.split(".")[0] ?? "") : "";
}

export function isSelectDomainEntity(state: HassEntity | null | undefined) {
  const domain = getEntityDomain(state);
  return domain === "select" || domain === "input_select";
}

export function getSelectEntityOptions(state: HassEntity | null | undefined) {
  if (!state?.attributes) {
    return [];
  }
  const options = state.attributes.options;
  if (!Array.isArray(options)) {
    return [];
  }
  return options.map(item => String(item ?? "").trim()).filter(Boolean);
}

export function getSelectEntityCurrentValue(state: HassEntity | null | undefined) {
  return String(state?.state ?? "").trim();
}

export function humanizeSelectOptionLabel(raw: unknown) {
  return String(raw ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, match => match.toUpperCase())
    .trim();
}

export function getHomeAssistantStateDisplayValue(state: HassEntity | null | undefined, hass: HomeAssistant | null = null) {
  const attrs = state?.attributes || {};
  const rawState = String(state?.state ?? "").trim();
  const formatters = [
    hass?.formatEntityState,
    typeof window !== "undefined" ? window.hass?.formatEntityState : null,
  ];
  for (const formatter of formatters) {
    if (typeof formatter !== "function") {
      continue;
    }
    if (!state) continue;
    try {
      const formatted = String(formatter.call(hass || window.hass, state) ?? "").trim();
      if (formatted && formatted !== rawState) {
        return formatted;
      }
    } catch (_error) {
      // Some HA builds expose formatter helpers with different call signatures.
    }
  }
  const candidates = [
    attrs.state_translated,
    attrs.translated_state,
    attrs.state_display,
    attrs.display_state,
    attrs.friendly_state,
  ];
  return candidates
    .map(value => String(value ?? "").trim())
    .find(value => value && value !== rawState) || "";
}

export function entitySupportedFeatures(state: HassEntity | null | undefined) {
  return Number(state?.attributes?.supported_features) || 0;
}

export function entitySupportsFeature(state: HassEntity | null | undefined, flag: number) {
  return (entitySupportedFeatures(state) & flag) !== 0;
}

export function coverEntityIsOpen(state: HassEntity | null | undefined) {
  const stateKey = normalizeTextKey(state?.state);
  if (["open", "opening"].includes(stateKey)) {
    return true;
  }
  if (["closed", "closing"].includes(stateKey)) {
    return false;
  }
  const position = parseNumericValue(state?.attributes?.current_position);
  return position !== null && position > 0;
}

export function getDynamicEntityIcon(state: HassEntity | null | undefined) {
  if (!state) {
    return "";
  }

  const domain = getEntityDomain(state);
  const stateKey = normalizeTextKey(state.state);
  const deviceClass = normalizeTextKey(state.attributes?.device_class);

  if (domain === "binary_sensor") {
    switch (deviceClass) {
      case "door":
      case "opening":
        return stateKey === "on" ? "mdi:door-open" : "mdi:door-closed";
      case "garage_door":
        return stateKey === "on" ? "mdi:garage-open" : "mdi:garage";
      case "window":
        return stateKey === "on" ? "mdi:window-open-variant" : "mdi:window-closed-variant";
      case "motion":
        return stateKey === "on" ? "mdi:motion-sensor" : "mdi:motion-sensor-off";
      case "occupancy":
      case "presence":
      case "person":
        return stateKey === "on" ? "mdi:account" : "mdi:account-off-outline";
      case "smoke":
        return stateKey === "on" ? "mdi:smoke-detector-alert" : "mdi:smoke-detector-variant";
      case "moisture":
        return stateKey === "on" ? "mdi:water-alert" : "mdi:water-check";
      case "gas":
        return stateKey === "on" ? "mdi:gas-cylinder" : "mdi:check-circle-outline";
      case "tamper":
      case "safety":
      case "problem":
        return stateKey === "on" ? "mdi:alert-circle" : "mdi:check-circle-outline";
      case "plug":
      case "power":
        return stateKey === "on" ? "mdi:power-plug" : "mdi:power-plug-off";
      case "sound":
        return stateKey === "on" ? "mdi:volume-high" : "mdi:volume-mute";
      case "vibration":
        return stateKey === "on" ? "mdi:vibrate" : "mdi:vibrate-off";
      case "heat":
        return stateKey === "on" ? "mdi:fire" : "mdi:fire-off";
      case "cold":
        return stateKey === "on" ? "mdi:snowflake-alert" : "mdi:snowflake";
      case "light":
        return stateKey === "on" ? "mdi:brightness-7" : "mdi:brightness-5";
      default:
        break;
    }
  }

  if (domain === "light") {
    return stateKey === "on" ? "mdi:lightbulb" : "mdi:lightbulb-off";
  }

  if (domain === "switch") {
    return stateKey === "on" ? "mdi:toggle-switch-variant" : "mdi:toggle-switch-variant-off";
  }

  if (domain === "fan") {
    return stateKey === "on" ? "mdi:fan" : "mdi:fan-off";
  }

  if (domain === "select" || domain === "input_select") {
    return "mdi:format-list-bulleted";
  }

  if (domain === "lock") {
    switch (stateKey) {
      case "unlocked":
      case "open":
        return "mdi:lock-open-variant";
      case "jammed":
        return "mdi:lock-alert";
      case "locking":
      case "unlocking":
        return "mdi:lock-clock";
      default:
        return "mdi:lock";
    }
  }

  if (domain === "cover") {
    if (deviceClass === "garage") {
      return stateKey === "open" ? "mdi:garage-open" : "mdi:garage";
    }

    if (deviceClass === "door") {
      return stateKey === "open" ? "mdi:door-open" : "mdi:door-closed";
    }

    if (deviceClass === "window") {
      return stateKey === "open" ? "mdi:window-open-variant" : "mdi:window-closed-variant";
    }
  }

  if (domain === "person") {
    switch (stateKey) {
      case "home":
      case "casa":
      case "en_casa":
        return "mdi:home-account";
      case "not_home":
      case "away":
      case "fuera":
        return "mdi:account-arrow-right";
      default:
        return "mdi:account";
    }
  }

  return "";
}
