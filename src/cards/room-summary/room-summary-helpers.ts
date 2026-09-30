export { formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import { DEFAULT_CONFIG } from "./room-summary-defaults";
import {
  deepClone,
  isObject,
  normalizeEntityField,
} from "./room-summary-runtime";

export function normalizeTextKey(v: unknown) { return String(v ?? "").trim().toLowerCase(); }
export function entityDomain(id: unknown) { const d = String(id || "").indexOf("."); return d > 0 ? String(id).slice(0, d) : ""; }

export function entityScalar(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value) && value[0]) return String(value[0]).trim();
    const s = String(value ?? "").trim();
    if (s) return s;
  }
  return "";
}

export function entityList(...values: unknown[]) {
  for (const value of values) {
    const list = normalizeEntityField(value);
    if (list.length) return list;
  }
  return [];
}

export function hubSecurityEntityIds(config: unknown) {
  const c = isObject(config) ? config : {};
  const fields = [c.doors, c.windows, c.locks, c.alerts];
  return fields.flatMap(field => Array.isArray(field) ? field : [])
    .map(id => String(id || "").trim())
    .filter(Boolean);
}

export function hubAlarmEntityIds(config: unknown) {
  const alarms = isObject(config) && Array.isArray(config.alarms) ? config.alarms : [];
  return alarms.map(id => String(id || "").trim()).filter(Boolean);
}

export function getEditorColorFallbackValue(field: unknown) {
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
export function stripEqualToDefaults(config: unknown, defaults: unknown = DEFAULT_CONFIG) {
  const result = deepClone(isObject(config) ? config : {});
  const walk = (cur: unknown, base: unknown): void => {
    if (!isObject(cur) || !isObject(base)) return;
    Object.keys(cur).forEach(key => {
      const child = cur[key];
      const fallback = base[key];
      if (isObject(child) && isObject(fallback)) {
        walk(child, fallback);
        if (!Object.keys(child).length) delete cur[key];
        return;
      }
      if (JSON.stringify(cur[key]) === JSON.stringify(base[key])) delete cur[key];
    });
  };
  walk(result, defaults);
  return result;
}

export function fireEvent(node: EventTarget, type: string, detail?: unknown, options?: { bubbles?: boolean; composed?: boolean; cancelable?: boolean }) {
  node.dispatchEvent(new CustomEvent(type, {
    bubbles: options?.bubbles !== false,
    composed: options?.composed !== false,
    cancelable: options?.cancelable === true,
    detail,
  }));
}

export function moveListItem<T>(list: T[], fromIndex: number, toIndex: number) {
  if (!Array.isArray(list) || fromIndex === toIndex || !Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return;
  }
  const items = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, ...items);
}

export { setByPath } from "../../shared/editor-array-paths";
