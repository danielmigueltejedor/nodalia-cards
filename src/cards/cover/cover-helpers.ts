export { getStubEntityId, applyStubEntity } from "../../shared/editor-entity-helpers";
export { resolveEditorColorValue, formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import type { HassEntity } from "../../core/types/home-assistant";
export { getSliderDragGeometry, getRangeValueFromGeometry, getCircularLayoutDialModel, getCircularLayoutDialValueFromPoint } from "../../shared/device-control-geometry";
import { DEFAULT_CONFIG } from "./cover-config";
import { deepClone, isObject, normalizeTextKey } from "./cover-runtime";

export function coverDeviceClassPrefersHorizontalOpenClose(deviceClass: unknown) {
  const key = normalizeTextKey(deviceClass);
  return key === "door" || key === "gate" || key === "garage";
}

export function resolveOpenCloseControlIcons(mode: unknown, deviceClass: unknown) {
  const vertical = { open: "mdi:arrow-up", close: "mdi:arrow-down" };
  const horizontal = { open: "mdi:arrow-right", close: "mdi:arrow-left" };
  const layout = normalizeTextKey(mode) || "auto";
  if (layout === "vertical") {
    return vertical;
  }
  if (layout === "horizontal") {
    return horizontal;
  }
  return coverDeviceClassPrefersHorizontalOpenClose(deviceClass) ? horizontal : vertical;
}

export function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(String(value).replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

export function isUnavailableState(state: Pick<HassEntity, "state"> | null | undefined) {
  const key = normalizeTextKey(state?.state);
  return key === "unavailable" || key === "unknown";
}

export function parseServiceData(value: unknown): Record<string, unknown> {
  if (isObject(value)) {
    return deepClone(value);
  }
  const raw = String(value || "").trim();
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isObject(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

export function shouldOpenNewTab(value: unknown) {
  return value === true;
}

export function getEditorColorFallbackValue(field: unknown) {
  const normalized = String(field || "");
  if (normalized.endsWith("icon.on_color") || normalized.endsWith("slider_color")) {
    return DEFAULT_CONFIG.styles.icon.on_color;
  }
  if (normalized.endsWith("icon.off_color") || normalized.endsWith("control.accent_color") || normalized.endsWith("icon.color")) {
    return DEFAULT_CONFIG.styles.icon.off_color;
  }
  if (normalized.endsWith("control.accent_background")) {
    return DEFAULT_CONFIG.styles.control.accent_background;
  }
  if (normalized.endsWith("background")) {
    return DEFAULT_CONFIG.styles.card.background;
  }
  return DEFAULT_CONFIG.styles.icon.on_color;
}

export function coverDeviceIcon(state: HassEntity | null | undefined) {
  const deviceClass = normalizeTextKey(state?.attributes?.device_class || "");
  const isOpen = ["open", "opening"].includes(normalizeTextKey(state?.state || ""));
  switch (deviceClass) {
    case "awning": return isOpen ? "mdi:awning" : "mdi:awning-outline";
    case "blind":
    case "shade": return isOpen ? "mdi:blinds-open" : "mdi:blinds";
    case "curtain": return isOpen ? "mdi:curtains" : "mdi:curtains-closed";
    case "door": return isOpen ? "mdi:door-open" : "mdi:door-closed";
    case "garage": return isOpen ? "mdi:garage-open-variant" : "mdi:garage-variant";
    case "gate": return isOpen ? "mdi:gate-open" : "mdi:gate";
    case "shutter": return isOpen ? "mdi:window-shutter-open" : "mdi:window-shutter";
    case "window": return isOpen ? "mdi:window-open-variant" : "mdi:window-closed-variant";
    default: return isOpen ? "mdi:window-open" : "mdi:window-closed";
  }
}
