export { resolveEditorColorValue, formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import { clamp } from "./light-runtime";
import type { HassEntity } from "../../core/types/home-assistant";
export { getStubEntityId, applyStubEntity, parseSizeToPixels } from "../../shared/editor-entity-helpers";
export { getRangeValueFromClientX, getSliderDragGeometry, getRangeValueFromGeometry } from "../../shared/device-control-geometry";

export function isUnavailableState(state: Pick<HassEntity, "state"> | null | undefined) {
  return String(state?.state || "").toLowerCase() === "unavailable";
}

export function rgbToHs(rgb: unknown): [number, number] | null {
  if (!Array.isArray(rgb) || rgb.length !== 3) {
    return null;
  }

  const channels = [Number(rgb[0]), Number(rgb[1]), Number(rgb[2])];
  if (channels.some(value => !Number.isFinite(value))) return null;
  const rawRed = clamp(Number(rgb[0]) / 255, 0, 1);
  const rawGreen = clamp(Number(rgb[1]) / 255, 0, 1);
  const rawBlue = clamp(Number(rgb[2]) / 255, 0, 1);
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

export function hexToRgb(hex: unknown): [number, number, number] | null {
  const normalized = normalizeHexColorForLightPreset(hex);
  if (!normalized) {
    return null;
  }
  const n = Number.parseInt(normalized.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function normalizeHexColorForLightPreset(raw: unknown) {
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

export function arrayFromCsv(value: unknown) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

export function getEditorColorFallbackValue(field: unknown) {
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

export function miredToKelvin(value: unknown) {
  const numeric = Number(value);
  return numeric > 0 ? Math.round(1000000 / numeric) : 0;
}

export function kelvinToMired(value: unknown) {
  const numeric = Number(value);
  return numeric > 0 ? Math.round(1000000 / numeric) : 0;
}

/** Kelvin sliders increase left→right (warm→cool). Mired sliders increase left→right (cool→warm). */
export function getTemperatureSliderTrackGradient(unit = "kelvin") {
  if (unit === "mired") {
    return "linear-gradient(90deg, #8fd3ff 0%, #b8e4ff 24%, #fff1c1 56%, #ffd166 72%, #f4b55f 100%)";
  }
  return "linear-gradient(90deg, #f4b55f 0%, #ffd166 32%, #fff1c1 56%, #8fd3ff 100%)";
}
