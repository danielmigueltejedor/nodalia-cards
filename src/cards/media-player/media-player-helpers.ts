// @ts-nocheck -- extracted media-player helpers retain runtime semantics.
import { INVALID_EDITOR_VALUE } from "./media-player-constants";
import {
  clamp,
  isObject,
} from "./media-player-runtime";

export function getStubEntityId(hass, domains = [], entities = [], entitiesFallback = []) {
  return window.NodaliaUtils.findStubEntityIds(hass, entities, entitiesFallback, domains, 1)[0] || "";
}

export function getStubFriendlyName(hass, entityId) {
  return hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
}


export function compactConfig(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => compactConfig(item))
      .filter(item => item !== undefined);
  }

  if (isObject(value)) {
    const compacted = {};

    Object.entries(value).forEach(([key, item]) => {
      if (window.NodaliaUtils?.isUnsafeConfigPathKey?.(key)) {
        return;
      }
      if (key === "entity" && item === "") {
        compacted.entity = "";
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

export function formatEditorJsonValue(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }

    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch (_error) {
      return value;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return String(value);
  }
}

export function parseEditorJsonObject(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return { valid: true, value: undefined };
  }

  try {
    const parsed = JSON.parse(trimmed);
    return isObject(parsed)
      ? { valid: true, value: parsed }
      : { valid: false, value: undefined };
  } catch (_error) {
    return { valid: false, value: undefined };
  }
}


export function normalizePowerActionConfig(action) {
  if (!isObject(action)) {
    return undefined;
  }

  const normalized = compactConfig(deepClone(action));

  if (!isObject(normalized)) {
    return undefined;
  }

  const actionType = String(normalized.action || "").trim();

  if (!actionType || actionType === "default") {
    return undefined;
  }

  // Older editor builds seeded "none" by default, which made power no-op.
  // Treat that exact minimal shape as "use default power behavior".
  if (actionType === "none" && Object.keys(normalized).length === 1) {
    return undefined;
  }

  normalized.action = actionType;
  return normalized;
}



export function getByPath(target, path) {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((cursor, key) => (cursor == null ? undefined : cursor[key]), target);
}


export function arrayFromCsv(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

export function escapeSelectorValue(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value).replaceAll('"', '\\"');
}

export function resolveEditorColorValue(value) {
  const resolver = window.NodaliaBubbleContrast?.resolveEditorColorValue;
  if (typeof resolver === "function") {
    return resolver(value);
  }
  return String(value ?? "").trim();
}

export function resolveColorInContext(contextNode, value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue || typeof document === "undefined") {
    return "";
  }

  const probe = document.createElement("span");
  probe.style.position = "fixed";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  probe.style.color = "";
  probe.style.color = rawValue;
  if (!probe.style.color) {
    return rawValue;
  }

  const root = contextNode?.shadowRoot instanceof ShadowRoot
    ? contextNode.shadowRoot
    : document.body || document.documentElement;
  root.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || rawValue;
}

export function parseRgbColor(value) {
  const source = String(value ?? "").trim();
  if (!source) {
    return null;
  }

  const rgbMatch = source.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const channels = rgbMatch[1]
      .split(",")
      .map(channel => Number.parseFloat(channel.trim()))
      .filter(channel => Number.isFinite(channel));

    if (channels.length >= 3) {
      return {
        red: clamp(channels[0], 0, 255),
        green: clamp(channels[1], 0, 255),
        blue: clamp(channels[2], 0, 255),
      };
    }
  }

  const hexMatch = source.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1].length === 3
      ? hexMatch[1].split("").map(channel => channel + channel).join("")
      : hexMatch[1];

    return {
      red: Number.parseInt(hex.slice(0, 2), 16),
      green: Number.parseInt(hex.slice(2, 4), 16),
      blue: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  return null;
}

export function getRelativeLuminance(color) {
  if (!color) {
    return null;
  }

  const toLinear = channel => {
    const normalized = clamp(Number(channel) / 255, 0, 1);
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  const red = toLinear(color.red);
  const green = toLinear(color.green);
  const blue = toLinear(color.blue);
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
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

  if (normalizedField.endsWith("off_color")) {
    return "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))";
  }

  if (normalizedField.endsWith("accent_background")) {
    return "rgba(113, 192, 255, 0.2)";
  }

  if (normalizedField.endsWith("active_tint_color")) {
    return "var(--info-color, #71c0ff)";
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

export function moveItem(array, fromIndex, toIndex) {
  if (!Array.isArray(array)) {
    return array;
  }

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= array.length ||
    toIndex >= array.length ||
    fromIndex === toIndex
  ) {
    return array;
  }

  const [item] = array.splice(fromIndex, 1);
  array.splice(toIndex, 0, item);
  return array;
}




export function getRangeValueFromClientX(slider, clientX) {
  const rect = slider.getBoundingClientRect();
  if (!rect.width) {
    return Number(slider.value || 0);
  }

  const min = Number(slider.min || 0);
  const max = Number(slider.max || 100);
  const step = slider.step === "any" ? 0 : Number(slider.step || 1);
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
  let nextValue = min + ((max - min) * ratio);

  if (Number.isFinite(step) && step > 0) {
    nextValue = min + (Math.round((nextValue - min) / step) * step);
  }

  return clamp(nextValue, min, max);
}

export function getSliderDragGeometry(slider) {
  const rect = slider.getBoundingClientRect();
  return {
    left: rect.left,
    width: rect.width,
    min: Number(slider.min || 0),
    max: Number(slider.max || 100),
    step: slider.step === "any" ? 0 : Number(slider.step || 1),
  };
}

export function getRangeValueFromGeometry(geometry, currentValue, clientX) {
  if (!geometry || !Number.isFinite(geometry.width) || geometry.width <= 0) {
    return Number(currentValue || 0);
  }
  const ratio = clamp((clientX - geometry.left) / geometry.width, 0, 1);
  let nextValue = geometry.min + ((geometry.max - geometry.min) * ratio);
  if (Number.isFinite(geometry.step) && geometry.step > 0) {
    nextValue = geometry.min + (Math.round((nextValue - geometry.min) / geometry.step) * geometry.step);
  }
  return clamp(nextValue, geometry.min, geometry.max);
}

export function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function normalizeTextKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function getRenderSignatureRuntime() {
  return window.NodaliaRenderSignature || {
    toKey(value) {
      if (value === null || value === undefined) {
        return "";
      }
      if (typeof value === "number") {
        return Number.isFinite(value) ? String(value) : "";
      }
      return String(value);
    },
    joinParts(parts, sectionSeparator = "||", valueSeparator = "::") {
      return (Array.isArray(parts) ? parts : [])
        .map(part => {
          if (!part || !Array.isArray(part.values)) {
            return "";
          }
          const prefix = String(part.prefix || "");
          const body = part.values.map(value => this.toKey(value)).join(valueSeparator);
          return `${prefix}${body}`;
        })
        .filter(Boolean)
        .join(sectionSeparator);
    },
  };
}

export function sanitizeMediaArtworkUrl(value, hass) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const safe = window.NodaliaUtils?.sanitizeActionUrl?.(raw, { allowRelative: true }) || "";
  if (!safe) {
    return "";
  }
  if (/^(?:https?:)?\/\//i.test(safe)) {
    return safe;
  }
  if (typeof hass?.hassUrl === "function" && safe.startsWith("/")) {
    return hass.hassUrl(safe);
  }
  return safe;
}

export function appendQueryParam(url, key, value) {
  const rawUrl = String(url || "").trim();
  if (!rawUrl || value === null || value === undefined || value === "") {
    return rawUrl;
  }

  const encodedKey = encodeURIComponent(String(key));
  const encodedValue = encodeURIComponent(String(value));
  const existingPattern = new RegExp(`([?&])${encodedKey}=[^&]*`);
  if (existingPattern.test(rawUrl)) {
    return rawUrl.replace(existingPattern, `$1${encodedKey}=${encodedValue}`);
  }

  return `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}${encodedKey}=${encodedValue}`;
}

export function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

