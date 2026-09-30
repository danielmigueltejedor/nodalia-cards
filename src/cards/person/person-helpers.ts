// @ts-nocheck -- color and stub helpers stay loosely typed until remaining unknowns are narrowed.
export { resolveEditorColorValue, formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import { clamp, normalizeTextKey } from "./person-runtime";

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











export function getEditorColorFallbackValue(field) {
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



export function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}
