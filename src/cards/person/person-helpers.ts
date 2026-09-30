export { getStubEntityId, applyStubEntity, parseSizeToPixels } from "../../shared/editor-entity-helpers";
export { resolveEditorColorValue, formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import type { HassEntity } from "../../core/types/home-assistant";
import { normalizeTextKey } from "./person-runtime";

export function getEditorColorFallbackValue(field: unknown) {
  const normalizedField = String(field ?? "");

  if (normalizedField.endsWith("avatar.background")) {
    return "color-mix(in srgb, var(--primary-text-color) 6%, transparent)";
  }

  if (normalizedField.endsWith("avatar.color")) {
    return "var(--primary-text-color)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
}

export function isUnavailableState(state: Pick<HassEntity, "state"> | null | undefined) {
  return normalizeTextKey(state?.state) === "unavailable";
}
