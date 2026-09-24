// @ts-nocheck -- color, icon and path helpers stay loosely typed until remaining unknowns are narrowed.
import { isObject, isUnsafeConfigPathKey, normalizeTextKey } from "./insignia-runtime";
import { DEFAULT_CONFIG } from "./insignia-config";

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


export function compactConfig(value) {
  if (Array.isArray(value)) {
    return value.map(item => compactConfig(item)).filter(item => item !== undefined);
  }

  if (isObject(value)) {
    const compacted = {};

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



export function setByPath(target, path, value) {
  const parts = path.split(".");
  if (parts.some(isUnsafeConfigPathKey)) {
    return;
  }
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return;
    }
    const current = Object.hasOwn(cursor, key) ? cursor[key] : undefined;
    if (!isObject(current)) {
      Object.defineProperty(cursor, key, {
        configurable: true,
        enumerable: true,
        value: {},
        writable: true,
      });
    }
    cursor = cursor[key];
  }
  const finalKey = parts[parts.length - 1];
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

export function deleteByPath(target, path) {
  const parts = path.split(".");
  if (parts.some(isUnsafeConfigPathKey)) {
    return;
  }
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isObject(cursor[key])) {
      return;
    }
    cursor = cursor[key];
  }
  delete cursor[parts[parts.length - 1]];
}

export function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}


export function normalizeTintPreset(value) {
  const key = normalizeTextKey(value);
  if (!key) {
    return "";
  }

  const map = {
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

export function getTintPresetColor(preset) {
  const presets = {
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
  return presets[preset] || presets.blue;
}

export function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function getEntityDomain(state) {
  const entityId = String(state?.entity_id || "");
  return entityId.includes(".") ? entityId.split(".")[0] : "";
}

export function getDynamicEntityIcon(state) {
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

export function formatNumericString(value) {
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



export function sanitizeCssValue(value, fallback) {
  const raw = String(value ?? "").trim();
  const safeFallback = String(fallback ?? "").trim();
  if (!raw) {
    return safeFallback;
  }
  if (/[\u0000-\u001f\u007f<>;"'{}]/.test(raw) || raw.includes("/*") || raw.includes("*/")) {
    return safeFallback;
  }
  return raw;
}

export function getSafeStyles(styles = DEFAULT_CONFIG.styles) {
  const defaults = DEFAULT_CONFIG.styles;
  const card = styles?.card || {};
  const icon = styles?.icon || {};
  const tint = styles?.tint || {};

  return {
    card: {
      background: sanitizeCssValue(card.background, defaults.card.background),
      border: sanitizeCssValue(card.border, defaults.card.border),
      border_radius: sanitizeCssValue(card.border_radius, defaults.card.border_radius),
      box_shadow: sanitizeCssValue(card.box_shadow, defaults.card.box_shadow),
      gap: sanitizeCssValue(card.gap, defaults.card.gap),
      padding: sanitizeCssValue(card.padding, defaults.card.padding),
    },
    icon: {
      background: sanitizeCssValue(icon.background, defaults.icon.background),
      icon_only_offset_y: sanitizeCssValue(icon.icon_only_offset_y, defaults.icon.icon_only_offset_y),
      off_color: sanitizeCssValue(icon.off_color, defaults.icon.off_color),
      on_color: sanitizeCssValue(icon.on_color, defaults.icon.on_color),
      size: sanitizeCssValue(icon.size, defaults.icon.size),
    },
    tint: {
      color: sanitizeCssValue(tint.color, defaults.tint.color),
    },
    title_size: sanitizeCssValue(styles?.title_size, defaults.title_size),
    value_size: sanitizeCssValue(styles?.value_size, defaults.value_size),
  };
}

export function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function formatEditorHexChannel(value) {
  return clampNumber(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

export function resolveEditorColorValue(value) {
  const resolver = window.NodaliaBubbleContrast?.resolveEditorColorValue;
  if (typeof resolver === "function") {
    return resolver(value);
  }
  return String(value ?? "").trim();
}

export function formatEditorColorFromHex(hex, alpha = 1) {
  const normalizedHex = String(hex ?? "").trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(normalizedHex)) {
    return String(hex ?? "");
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  const safeAlpha = clampNumber(Number(alpha), 0, 1);
  if (safeAlpha >= 0.999) {
    return `#${normalizedHex}`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${Number(safeAlpha.toFixed(2))})`;
}

export function getEditorColorModel(value, fallbackValue = "#71c0ff") {
  const sourceValue = String(value ?? "").trim() || String(fallbackValue ?? "").trim() || "#71c0ff";
  const resolvedValue = resolveEditorColorValue(sourceValue) || resolveEditorColorValue(fallbackValue) || "rgb(113, 192, 255)";
  const channels = resolvedValue.match(/[\d.]+/g) || [];
  const red = clampNumber(Math.round(Number(channels[0] ?? 113)), 0, 255);
  const green = clampNumber(Math.round(Number(channels[1] ?? 192)), 0, 255);
  const blue = clampNumber(Math.round(Number(channels[2] ?? 255)), 0, 255);
  const alpha = channels.length > 3 ? clampNumber(Number(channels[3]), 0, 1) : 1;
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
