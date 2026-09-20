// @ts-nocheck -- room entity lists and editor color helpers stay loosely typed until remaining unknowns are narrowed.
import { DEFAULT_CONFIG } from "./room-summary-config";
import {
  clamp,
  deepClone,
  isObject,
  isUnsafeConfigPathKey,
  normalizeEntityField,
} from "./room-summary-runtime";

export function normalizeTextKey(v) { return String(v ?? "").trim().toLowerCase(); }
export function entityDomain(id) { const d = String(id || "").indexOf("."); return d > 0 ? String(id).slice(0, d) : ""; }

export function entityScalar(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value[0]) return String(value[0]).trim();
    const s = String(value ?? "").trim();
    if (s) return s;
  }
  return "";
}

export function entityList(...values) {
  for (const value of values) {
    const list = normalizeEntityField(value);
    if (list.length) return list;
  }
  return [];
}

export function hubSecurityEntityIds(config) {
  const c = config || {};
  return [...(c.doors || []), ...(c.windows || []), ...(c.locks || []), ...(c.alerts || [])]
    .map(id => String(id || "").trim())
    .filter(Boolean);
}

export function hubAlarmEntityIds(config) {
  return (config?.alarms || []).map(id => String(id || "").trim()).filter(Boolean);
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
  const resolve = window.NodaliaBubbleContrast?.resolveEditorColorValue;
  const resolvedValue =
    (resolve ? resolve(sourceValue) : "") || (resolve ? resolve(fallbackValue) : "") || "rgb(113, 192, 255)";
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
  if (normalizedField === "styles.accent" || normalizedField.endsWith(".accent")) {
    return "var(--primary-color)";
  }
  if (normalizedField.endsWith("embed_off_tint")) {
    return "color-mix(in srgb, var(--primary-text-color) 5%, transparent)";
  }
  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }
  return "var(--info-color, #71c0ff)";
}
export function stripEqualToDefaults(config, defaults = DEFAULT_CONFIG) {
  const result = deepClone(config || {});
  const walk = (cur, base) => {
    if (!isObject(cur) || !isObject(base)) return;
    Object.keys(cur).forEach(key => {
      if (isObject(cur[key]) && isObject(base[key]) && !Array.isArray(cur[key])) {
        walk(cur[key], base[key]);
        if (!Object.keys(cur[key]).length) delete cur[key];
        return;
      }
      if (JSON.stringify(cur[key]) === JSON.stringify(base[key])) delete cur[key];
    });
  };
  walk(result, defaults);
  return result;
}

export function fireEvent(node, type, detail, options) {
  node.dispatchEvent(new CustomEvent(type, {
    bubbles: options?.bubbles !== false,
    composed: options?.composed !== false,
    cancelable: options?.cancelable === true,
    detail,
  }));
}

export function moveListItem(list, fromIndex, toIndex) {
  if (!Array.isArray(list) || fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return;
  }
  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item);
}



export function setByPath(target, path, value) {
  const parts = String(path || "").split(".");
  if (!parts.length || parts.some(isUnsafeConfigPathKey)) {
    return;
  }
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isObject(cursor[key]) && !Array.isArray(cursor[key])) {
      cursor[key] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}
