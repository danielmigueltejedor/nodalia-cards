// @ts-nocheck -- color/dial helpers stay loosely typed until remaining unknowns are narrowed.
import {
  CIRCULAR_LAYOUT_DIAL_END_ANGLE,
  CIRCULAR_LAYOUT_DIAL_START_ANGLE,
  CIRCULAR_LAYOUT_DIAL_SWEEP,
} from "./fan-constants";
import { clamp, normalizeTextKey } from "./fan-runtime";

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
    return "rgba(113, 192, 255, 0.2)";
  }

  if (normalizedField.endsWith("progress_background")) {
    return "color-mix(in srgb, var(--primary-text-color) 12%, transparent)";
  }

  if (normalizedField.endsWith("overlay_color")) {
    return "rgba(0, 0, 0, 0.32)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
}



export function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function getRangeValueFromClientX(slider, clientX) {
  const rect = slider.getBoundingClientRect();
  if (!rect.width) {
    return Number(slider.value || 0);
  }

  const min = Number(slider.min || 0);
  const max = Number(slider.max || 100);
  const step = slider.step === "any" ? 0 : Number(slider.step || 1);
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
  let nextValue = min + ((max - min) * ratio);

  if (Number.isFinite(step) && step > 0) {
    nextValue = min + (Math.round((nextValue - min) / step) * step);
  }

  return clamp(nextValue, min, max);
}

export function getSliderDragGeometry(slider) {
  const rect = slider.getBoundingClientRect();
  return {
    left: rect.left,
    width: rect.width,
    min: Number(slider.min || 0),
    max: Number(slider.max || 100),
    step: slider.step === "any" ? 0 : Number(slider.step || 1),
  };
}

export function getRangeValueFromGeometry(geometry, currentValue, clientX) {
  if (!geometry || !Number.isFinite(geometry.width) || geometry.width <= 0) {
    return Number(currentValue || 0);
  }
  const ratio = clamp((clientX - geometry.left) / geometry.width, 0, 1);
  let nextValue = geometry.min + ((geometry.max - geometry.min) * ratio);
  if (Number.isFinite(geometry.step) && geometry.step > 0) {
    nextValue = geometry.min + (Math.round((nextValue - geometry.min) / geometry.step) * geometry.step);
  }
  return clamp(nextValue, geometry.min, geometry.max);
}


export function getCircularLayoutDialModel(value, min = 0, max = 100) {
  const safeMin = Number.isFinite(Number(min)) ? Number(min) : 0;
  const safeMax = Number.isFinite(Number(max)) && Number(max) > safeMin ? Number(max) : 100;
  const safeValue = clamp(Number(value), safeMin, safeMax);
  const ratio = clamp((safeValue - safeMin) / (safeMax - safeMin), 0, 1);
  const angle = CIRCULAR_LAYOUT_DIAL_START_ANGLE + (ratio * CIRCULAR_LAYOUT_DIAL_SWEEP);
  const radians = angle * (Math.PI / 180);
  const markerRadius = 86;
  return {
    progress: Number((ratio * 75).toFixed(3)),
    markerLeft: Number((((120 + (Math.cos(radians) * markerRadius)) / 240) * 100).toFixed(3)),
    markerTop: Number((((120 + (Math.sin(radians) * markerRadius)) / 240) * 100).toFixed(3)),
  };
}

export function getCircularLayoutDialValueFromPoint(dial, clientX, clientY, range, step, fallbackValue = null, geometry = null) {
  const rect = geometry || dial?.getBoundingClientRect?.();
  const safeMin = Number.isFinite(Number(range?.min)) ? Number(range.min) : 0;
  const safeMax = Number.isFinite(Number(range?.max)) && Number(range.max) > safeMin ? Number(range.max) : 100;
  if (!rect?.width || !rect?.height) {
    return Number.isFinite(Number(fallbackValue)) ? Number(fallbackValue) : safeMin;
  }

  const centerX = rect.left + (rect.width / 2);
  const centerY = rect.top + (rect.height / 2);
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const distance = Math.sqrt((dx ** 2) + (dy ** 2));
  const outerRadius = Math.min(rect.width, rect.height) / 2;
  const innerDeadZone = outerRadius * 0.42;

  if (distance < innerDeadZone && Number.isFinite(Number(fallbackValue))) {
    return Number(fallbackValue);
  }

  const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
  let normalizedAngle = angle < 0 ? angle + 360 : angle;
  const gapStart = CIRCULAR_LAYOUT_DIAL_END_ANGLE % 360;
  const gapEnd = CIRCULAR_LAYOUT_DIAL_START_ANGLE;
  if (
    normalizedAngle > gapStart
    && normalizedAngle < gapEnd
    && Number.isFinite(Number(fallbackValue))
  ) {
    return Number(fallbackValue);
  }
  if (normalizedAngle < CIRCULAR_LAYOUT_DIAL_START_ANGLE) {
    normalizedAngle += 360;
  }
  normalizedAngle = clamp(normalizedAngle, CIRCULAR_LAYOUT_DIAL_START_ANGLE, CIRCULAR_LAYOUT_DIAL_END_ANGLE);

  const ratio = (normalizedAngle - CIRCULAR_LAYOUT_DIAL_START_ANGLE) / CIRCULAR_LAYOUT_DIAL_SWEEP;
  const rawValue = safeMin + ((safeMax - safeMin) * ratio);
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const rounded = safeMin + (Math.round((rawValue - safeMin) / safeStep) * safeStep);
  return clamp(rounded, safeMin, safeMax);
}

export function translatePresetLabel(value) {
  const normalized = normalizeTextKey(value);

  switch (normalized) {
    case "auto":
    case "automatic":
      return "Auto";
    case "smart":
    case "smart_mode":
      return "Smart";
    case "sleep":
    case "night":
      return "Night";
    case "breeze":
    case "natural":
    case "nature":
      return "Breeze";
    case "eco":
      return "Eco";
    case "turbo":
      return "Turbo";
    case "boost":
      return "Boost";
    case "low":
      return "Low";
    case "medium":
    case "mid":
      return "Medium";
    case "high":
      return "High";
    case "quiet":
    case "silent":
      return "Quiet";
    case "normal":
    case "balanced":
      return "Normal";
    default:
      return String(value ?? "");
    }
}