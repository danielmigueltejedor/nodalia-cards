// @ts-nocheck -- color/slider helpers stay loosely typed until remaining unknowns are narrowed.
import { clamp } from "./light-runtime";

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

export function isUnavailableState(state) {
  return String(state?.state || "").toLowerCase() === "unavailable";
}

export function rgbToHs(rgb) {
  if (!Array.isArray(rgb) || rgb.length !== 3) {
    return null;
  }

  const [rawRed, rawGreen, rawBlue] = rgb.map(value => clamp(Number(value) / 255, 0, 1));
  const max = Math.max(rawRed, rawGreen, rawBlue);
  const min = Math.min(rawRed, rawGreen, rawBlue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === rawRed) {
      hue = ((rawGreen - rawBlue) / delta) % 6;
    } else if (max === rawGreen) {
      hue = (rawBlue - rawRed) / delta + 2;
    } else {
      hue = (rawRed - rawGreen) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
  }

  const saturation = max === 0 ? 0 : (delta / max) * 100;
  return [Math.round(hue), Math.round(saturation)];
}

export function hexToRgb(hex) {
  const normalized = normalizeHexColorForLightPreset(hex);
  if (!normalized) {
    return null;
  }
  const n = Number.parseInt(normalized.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function normalizeHexColorForLightPreset(raw) {
  let s = String(raw ?? "").trim();
  if (!s) {
    return "";
  }
  if (!s.startsWith("#")) {
    s = `#${s}`;
  }
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    const x = s.slice(1).toLowerCase();
    s = `#${x[0]}${x[0]}${x[1]}${x[1]}${x[2]}${x[2]}`;
  }
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : "";
}

export function arrayFromCsv(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
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

  if (normalizedField.endsWith("off_color")) {
    return "var(--primary-text-color)";
  }

  if (normalizedField.endsWith("accent_background")) {
    return "rgba(113, 192, 255, 0.2)";
  }

  const colorPresetSlot = /^color_presets\.(\d+)\.color$/.exec(normalizedField);
  if (colorPresetSlot) {
    const slot = Number(colorPresetSlot[1]);
    const defaults = ["#ffd166", "#fff1c1", "#4dabf7", "#ff4d6d"];
    return defaults[slot] || "#71c0ff";
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


export function miredToKelvin(value) {
  return value > 0 ? Math.round(1000000 / value) : 0;
}

export function kelvinToMired(value) {
  return value > 0 ? Math.round(1000000 / value) : 0;
}

/** Kelvin sliders increase left→right (warm→cool). Mired sliders increase left→right (cool→warm). */
export function getTemperatureSliderTrackGradient(unit = "kelvin") {
  if (unit === "mired") {
    return "linear-gradient(90deg, #8fd3ff 0%, #b8e4ff 24%, #fff1c1 56%, #ffd166 72%, #f4b55f 100%)";
  }
  return "linear-gradient(90deg, #f4b55f 0%, #ffd166 32%, #fff1c1 56%, #8fd3ff 100%)";
}
