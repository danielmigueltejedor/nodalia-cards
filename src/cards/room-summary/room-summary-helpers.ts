// @ts-nocheck -- room entity lists and editor color helpers stay loosely typed until remaining unknowns are narrowed.
export { formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import { DEFAULT_CONFIG } from "./room-summary-defaults";
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
