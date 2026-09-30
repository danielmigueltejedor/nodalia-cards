// @ts-nocheck -- color, helper matching and mode labels stay loosely typed until remaining unknowns are narrowed.
export { resolveEditorColorValue, formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import { MODE_LABELS } from "./vacuum-constants";
import { clamp, normalizeTextKey } from "./vacuum-runtime";

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

export function arrayFromCsv(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}









export function getEditorColorFallbackValue(field) {
  const normalizedField = String(field ?? "");

  if (normalizedField.endsWith("off_color") || normalizedField.endsWith("docked_color")) {
    return "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))";
  }

  if (normalizedField.endsWith("accent_background")) {
    return "rgba(var(--rgb-primary-color), 0.18)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  if (normalizedField.endsWith("error_color")) {
    return "var(--error-color, #ff6b6b)";
  }

  return "var(--info-color, #71c0ff)";
}

export function listVacuumObjectIds(states = {}) {
  return Object.keys(states || {})
    .filter(id => id.startsWith("vacuum."))
    .map(id => normalizeTextKey(id.split(".").slice(1).join("_")))
    .filter(Boolean);
}

/**
 * Helpers whose ids contain `vacuum.roborock_s8` also match `vacuum.roborock_s8_pro`.
 * Same `device_id` always wins; otherwise the longest matching vacuum object id owns the helper.
 * Unscoped `roborock` guesses are allowed only when the home has a single `vacuum.*`.
 */
export function isHelperRelatedToConfiguredVacuum({
  candidateId,
  searchable = "",
  isSameDevice = false,
  objectId,
  vacuumObjectIds,
}) {
  if (isSameDevice) {
    return true;
  }
  if (!objectId) {
    return false;
  }
  const haystack = `${normalizeTextKey(candidateId)} ${normalizeTextKey(searchable)}`;
  if (!haystack.includes(objectId)) {
    return false;
  }
  const claimedByLongerSibling = (vacuumObjectIds || []).some(siblingId => (
    siblingId
    && siblingId !== objectId
    && siblingId.length > objectId.length
    && siblingId.includes(objectId)
    && haystack.includes(siblingId)
  ));
  return !claimedByLongerSibling;
}

export function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function humanizeModeLabel(value, kind = "generic", hass = null, configLang = null) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const key = normalizeTextKey(raw);
  const h = hass ?? (typeof window !== "undefined" ? window.NodaliaI18n?.resolveHass?.(null) : null);
  if (window.NodaliaI18n?.translateAdvanceVacuumVacuumMode) {
    return window.NodaliaI18n.translateAdvanceVacuumVacuumMode(h, configLang ?? "auto", raw, kind);
  }
  if (key === "off" && kind === "suction") {
    return "Off";
  }

  if (MODE_LABELS[key]) {
    return MODE_LABELS[key];
  }

  return raw
    .replaceAll("_", " ")
    .replace(/\b\w/g, match => match.toUpperCase());
}
