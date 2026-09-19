// @ts-nocheck -- air-quality, icon and editor helpers stay loosely typed until remaining unknowns are narrowed.
import {
  AIR_QUALITY_ATTR_ALIASES,
  AIR_QUALITY_LEVEL_RANK,
  AIR_QUALITY_WHO_BANDS,
} from "./entity-constants";
import { clamp, isObject, normalizeTextKey } from "./entity-runtime";

export function resolveAirQualityLevelFromBands(value, bands) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !Array.isArray(bands) || !bands.length) {
    return "unknown";
  }
  for (const band of bands) {
    if (numeric <= Number(band.max)) {
      return band.level;
    }
  }
  return bands[bands.length - 1]?.level || "unknown";
}

export function resolveAirQualityLevelFromAqi(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "unknown";
  }
  if (numeric <= 50) return "good";
  if (numeric <= 100) return "moderate";
  if (numeric <= 150) return "unhealthy_sensitive";
  if (numeric <= 200) return "unhealthy";
  if (numeric <= 300) return "very_unhealthy";
  return "hazardous";
}

export function resolveMetricGuidelineBands(kind, unit = "") {
  const unitKey = String(unit || "").toLowerCase();
  if (kind === "tvoc") {
    if (unitKey.includes("ppb")) {
      return AIR_QUALITY_WHO_BANDS.tvoc_ppb;
    }
    return AIR_QUALITY_WHO_BANDS.tvoc_ugm3;
  }
  return AIR_QUALITY_WHO_BANDS[kind] || null;
}

export function worseAirQualityLevel(left, right) {
  const leftRank = AIR_QUALITY_LEVEL_RANK[left];
  const rightRank = AIR_QUALITY_LEVEL_RANK[right];
  if (!Number.isFinite(leftRank)) {
    return Number.isFinite(rightRank) ? right : "unknown";
  }
  if (!Number.isFinite(rightRank)) {
    return left;
  }
  return rightRank > leftRank ? right : left;
}

export function readAirQualityAttribute(state, kind) {
  const attrs = state?.attributes || {};
  for (const alias of AIR_QUALITY_ATTR_ALIASES[kind] || []) {
    if (attrs[alias] !== undefined && attrs[alias] !== null && attrs[alias] !== "") {
      return attrs[alias];
    }
  }
  return null;
}

export function parseAirQualityNumeric(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const match = String(value ?? "").trim().match(/-?\d+(?:[.,]\d+)?/);
  if (!match) {
    return NaN;
  }
  return Number(match[0].replace(",", "."));
}

export function parseAirQualityHistoryTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildAirQualitySmoothPath(points) {
  if (!Array.isArray(points) || !points.length) {
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

export function buildAirQualityAreaPath(points, bottomY) {
  if (!Array.isArray(points) || !points.length) {
    return "";
  }
  const linePath = buildAirQualitySmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x.toFixed(2)} ${bottomY.toFixed(2)} L ${first.x.toFixed(2)} ${bottomY.toFixed(2)} Z`;
}

export function buildAirQualityChartGeometry(seriesEntries = []) {
  const width = 100;
  const height = 42;
  const paddingX = 0;
  const paddingTop = 3;
  const paddingBottom = 3;
  const usable = seriesEntries.filter(entry => Array.isArray(entry?.samples) && entry.samples.length);
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
      linePath: buildAirQualitySmoothPath(points),
      fillPath: buildAirQualityAreaPath(points, height - paddingBottom),
    };
  });
  return { width, height, paddingX, paddingTop, paddingBottom, min, max, paths };
}

export function getAirQualityHoverPayload(geometry, hoverState) {
  if (!geometry?.paths?.length || !hoverState) {
    return null;
  }
  const path = geometry.paths.find(entry => entry.kind === hoverState.kind);
  if (!path?.points?.length) {
    return null;
  }
  const requestedPosition = Number(hoverState.position);
  const position = clamp(
    Number.isFinite(requestedPosition) ? requestedPosition : (Number(hoverState.index) || 0),
    0,
    path.points.length - 1,
  );
  const leftIndex = Math.floor(position);
  const rightIndex = Math.ceil(position);
  const fraction = position - leftIndex;
  const leftPoint = path.points[leftIndex];
  const rightPoint = path.points[rightIndex] || leftPoint;
  const interpolate = key => leftPoint[key] + ((rightPoint[key] - leftPoint[key]) * fraction);
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

export function buildAirQualityInterpolatedSamples(events, startMs, endMs, pointsCount, fallbackValue = null) {
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

export function getStubEntityId(hass, domains = [], entities = [], entitiesFallback = []) {
  return window.NodaliaUtils.findStubEntityIds(hass, entities, entitiesFallback, domains, 1)[0] || "";
}

export function applyStubEntity(config, hass, domains, entities = [], entitiesFallback = []) {
  const entityId = getStubEntityId(hass, domains, entities, entitiesFallback);
  if (!entityId) {
    return config;
  }

  config.entity = entityId;
  config.name = hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
  return config;
}








export function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}


export function parseNumericValue(value) {
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

export function formatNumericValue(value, maximumFractionDigits = 2) {
  const numericValue = parseNumericValue(value);
  if (!Number.isFinite(numericValue)) {
    return String(value ?? "");
  }

  const safeDigits = clamp(Math.round(Number(maximumFractionDigits)), 0, 6);
  return numericValue
    .toFixed(safeDigits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

export function formatNumericValueWithUnit(value, unit = "", maximumFractionDigits = 2) {
  const formattedValue = formatNumericValue(value, maximumFractionDigits);
  const normalizedUnit = String(unit || "").trim();

  if (!normalizedUnit) {
    return formattedValue;
  }

  return `${formattedValue}${normalizedUnit.startsWith("°") ? "" : " "}${normalizedUnit}`;
}

export function getValueSignature(value) {
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
  const resolve = window.NodaliaBubbleContrast?.resolveEditorColorValue;
  const resolvedValue =
    (resolve ? resolve(sourceValue) : "") || (resolve ? resolve(fallbackValue) : "") || "rgb(113, 192, 255)";
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



export function shouldDarkenEntityBubbleIconGlyph(state, accentColor) {
  return Boolean(window.NodaliaBubbleContrast?.shouldDarkenBubbleIconGlyph(state, accentColor));
}

export function resolveEntityBubbleIconGlyphColor(accentColor, state) {
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

export function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function getEntityDomain(state) {
  const entityId = String(state?.entity_id || "");
  return entityId.includes(".") ? entityId.split(".")[0] : "";
}

export function isSelectDomainEntity(state) {
  const domain = getEntityDomain(state);
  return domain === "select" || domain === "input_select";
}

export function getSelectEntityOptions(state) {
  if (!state?.attributes) {
    return [];
  }
  const options = state.attributes.options;
  if (!Array.isArray(options)) {
    return [];
  }
  return options.map(item => String(item ?? "").trim()).filter(Boolean);
}

export function getSelectEntityCurrentValue(state) {
  return String(state?.state ?? "").trim();
}

export function humanizeSelectOptionLabel(raw) {
  return String(raw ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, match => match.toUpperCase())
    .trim();
}

export function getHomeAssistantStateDisplayValue(state, hass = null) {
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

export function entitySupportedFeatures(state) {
  return Number(state?.attributes?.supported_features) || 0;
}

export function entitySupportsFeature(state, flag) {
  return (entitySupportedFeatures(state) & flag) !== 0;
}

export function coverEntityIsOpen(state) {
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

export function getDynamicEntityIcon(state) {
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
