import type { HassEntity } from "../../core/types/home-assistant";
import { normalizeControlStyles } from "../../shared/control-config";
export { getStubEntityId, applyStubEntity, parseSizeToPixels } from "../../shared/editor-entity-helpers";
export { formatEditorHexChannel, resolveEditorColorValue, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import { isObject, isUnsafeConfigPathKey, normalizeTextKey } from "./insignia-runtime";
import { DEFAULT_CONFIG } from "./insignia-defaults";

export function compactConfig(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => compactConfig(item)).filter(item => item !== undefined);
  }

  if (isObject(value)) {
    const compacted: Record<string, unknown> = {};

    Object.entries(value).forEach(([key, item]) => {
      if (window.NodaliaUtils?.isUnsafeConfigPathKey?.(key)) {
        return;
      }
      const cleaned = compactConfig(item);
      const isEmptyObject = isObject(cleaned) && Object.keys(cleaned).length === 0;
      if (cleaned !== undefined && !isEmptyObject) {
        compacted[key] = cleaned;
      }
    });

    return compacted;
  }

  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  return value;
}



export function setByPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  if (parts.some(isUnsafeConfigPathKey)) {
    return;
  }
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (key === undefined) return;
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return;
    }
    const current = Object.prototype.hasOwnProperty.call(cursor, key) ? cursor[key] : undefined;
    if (!isObject(current)) {
      Object.defineProperty(cursor, key, {
        configurable: true,
        enumerable: true,
        value: {},
        writable: true,
      });
    }
    const child = cursor[key];
    if (!isObject(child)) return;
    cursor = child;
  }
  const finalKey = parts[parts.length - 1];
  if (finalKey === undefined) return;
  if (finalKey === "__proto__" || finalKey === "constructor" || finalKey === "prototype") {
    return;
  }
  Object.defineProperty(cursor, finalKey, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

export function deleteByPath(target: Record<string, unknown>, path: string) {
  const parts = path.split(".");
  if (parts.some(isUnsafeConfigPathKey)) {
    return;
  }
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (key === undefined) return;
    if (!isObject(cursor[key])) {
      return;
    }
    const child = cursor[key];
    if (!isObject(child)) return;
    cursor = child;
  }
  const finalKey = parts[parts.length - 1];
  if (finalKey !== undefined) delete cursor[finalKey];
}

export function normalizeTintPreset(value: unknown) {
  const key = normalizeTextKey(value);
  if (!key) {
    return "";
  }

  const map: Record<string, string> = {
    grey: "gray",
    light_grey: "gray",
    light_gray: "gray",
    red: "red",
    orange: "orange",
    yellow: "yellow",
    green: "green",
    blue: "blue",
    purple: "purple",
    pink: "pink",
    teal: "teal",
    gray: "gray",
    auto: "auto",
  };

  return map[key] || key;
}

export function getTintPresetColor(preset: string) {
  const presets: Record<string, string> = {
    red: "#ff6b6b",
    orange: "#f6b04d",
    yellow: "#f2c94c",
    green: "#83d39c",
    blue: "#4da3ff",
    purple: "#b59dff",
    pink: "#ff8fd1",
    teal: "#7fd0c8",
    gray: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
  };
  return presets[preset] || "#4da3ff";
}

export function isUnavailableState(state: HassEntity | null | undefined) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function getEntityDomain(state: HassEntity | null | undefined) {
  const entityId = String(state?.entity_id || "");
  return entityId.includes(".") ? entityId.split(".")[0] : "";
}

export function getDynamicEntityIcon(state: HassEntity | null | undefined) {
  if (!state) {
    return "";
  }

  const domain = getEntityDomain(state);
  const stateKey = normalizeTextKey(state.state);
  const deviceClass = normalizeTextKey(state.attributes?.device_class);

  if (domain === "binary_sensor") {
    switch (deviceClass) {
      case "door":
      case "opening":
        return stateKey === "on" ? "mdi:door-open" : "mdi:door-closed";
      case "window":
        return stateKey === "on" ? "mdi:window-open-variant" : "mdi:window-closed-variant";
      case "motion":
        return stateKey === "on" ? "mdi:motion-sensor" : "mdi:motion-sensor-off";
      case "occupancy":
      case "presence":
      case "person":
        return stateKey === "on" ? "mdi:account" : "mdi:account-off-outline";
      case "smoke":
        return stateKey === "on" ? "mdi:smoke-detector-alert" : "mdi:smoke-detector-variant";
      default:
        break;
    }
  }

  if (domain === "light") {
    return stateKey === "on" ? "mdi:lightbulb" : "mdi:lightbulb-off";
  }

  if (domain === "switch") {
    return stateKey === "on" ? "mdi:toggle-switch-variant" : "mdi:toggle-switch-variant-off";
  }

  if (domain === "fan") {
    return stateKey === "on" ? "mdi:fan" : "mdi:fan-off";
  }

  if (domain === "humidifier") {
    return stateKey === "on" ? "mdi:air-humidifier" : "mdi:air-humidifier-off";
  }

  if (domain === "lock") {
    return stateKey === "unlocked" ? "mdi:lock-open-variant" : "mdi:lock";
  }

  if (domain === "person") {
    return "mdi:account";
  }

  return state.attributes?.icon || "";
}

export function formatNumericString(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const numeric = Number(raw.replace(",", "."));
  if (!Number.isFinite(numeric)) {
    return raw;
  }

  if (Number.isInteger(numeric)) {
    return String(numeric);
  }

  return raw
    .replace(/(\.\d*?[1-9])0+$/g, "$1")
    .replace(/\.0+$/g, "");
}



export function sanitizeCssValue(value: unknown, fallback: unknown) {
  return window.NodaliaUtils.sanitizeCssValue(value, fallback);
}

export function getSafeStyles(styles: unknown = DEFAULT_CONFIG.styles) {
  return normalizeControlStyles(styles, DEFAULT_CONFIG.styles);
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}









export function getEditorColorFallbackValue(field: unknown) {
  const normalizedField = String(field ?? "");

  if (normalizedField.endsWith("tint.color")) {
    return "var(--info-color, #71c0ff)";
  }

  if (normalizedField.endsWith("off_color")) {
    return "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))";
  }

  if (normalizedField.endsWith("background")) {
    return "color-mix(in srgb, var(--primary-text-color) 6%, transparent)";
  }

  return "var(--info-color, #71c0ff)";
}
