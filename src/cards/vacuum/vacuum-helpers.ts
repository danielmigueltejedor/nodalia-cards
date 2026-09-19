// @ts-nocheck -- color, helper matching and mode labels stay loosely typed until remaining unknowns are narrowed.
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
