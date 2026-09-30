export { getStubEntityId, applyStubEntity, parseSizeToPixels } from "../../shared/editor-entity-helpers";
export { formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import type { HassEntity } from "../../core/types/home-assistant";
export { getSliderDragGeometry, getRangeValueFromGeometry, getCircularLayoutDialModel, getCircularLayoutDialValueFromPoint, getRangeValueFromClientX } from "../../shared/device-control-geometry";
import { normalizeTextKey } from "./fan-runtime";

export function getEditorColorFallbackValue(field: unknown) {
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

export function isUnavailableState(state: Pick<HassEntity, "state"> | null | undefined) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function translatePresetLabel(value: unknown) {
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
