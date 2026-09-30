export { getStubEntityId, applyStubEntity, parseSizeToPixels } from "../../shared/editor-entity-helpers";
export { resolveEditorColorValue, formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import type { HassEntity } from "../../core/types/home-assistant";
import { normalizeTextKey } from "./alarm-panel-runtime";

export function getEditorColorFallbackValue(field: unknown) {
  const normalizedField = String(field ?? "");

  if (normalizedField.endsWith("off_color")) {
    return "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))";
  }

  if (normalizedField.endsWith("on_color") || normalizedField.endsWith("accent_color") || normalizedField.endsWith("icon.color")) {
    return "var(--primary-text-color)";
  }

  if (normalizedField.endsWith("accent_background")) {
    return "rgba(113, 192, 255, 0.18)";
  }

  if (normalizedField.endsWith("icon.background")) {
    return "color-mix(in srgb, var(--primary-text-color) 6%, transparent)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
}

export function isUnavailableState(state: Pick<HassEntity, "state"> | null | undefined) {
  return normalizeTextKey(state?.state) === "unavailable";
}
