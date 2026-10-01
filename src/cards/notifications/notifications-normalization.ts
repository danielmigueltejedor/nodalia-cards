import { parseFiniteNumericValue } from "../../shared/numeric-values";
import { DEFAULT_CONFIG } from "./notifications-defaults";
import {
  deepClone, isObject, isUnsafeConfigPathKey, normalizeMobilePolicy,
  normalizeSmartEntityMobile, normalizeSmartEntityOverrideMobile, isExplicitSmartEntityMobile,
} from "./notifications-runtime";

export interface NotificationTapAction {
  action: string;
  entity?: string;
  navigation_path?: string;
  url_path?: string;
  new_tab?: boolean;
}
export interface NotificationNormalizationOptions { keepDrafts?: boolean; }

export function mergeDeep(base: Record<string, unknown>, override: unknown): Record<string, unknown> {
  const out = deepClone(base);
  if (!isObject(override)) {
    return out;
  }
  Object.entries(override).forEach(([key, value]) => {
    if (isUnsafeConfigPathKey(key)) {
      return;
    }
    const previous = out[key];
    if (isObject(value) && isObject(previous)) {
      out[key] = mergeDeep(previous, value);
    } else if (value !== undefined) {
      out[key] = deepClone(value);
    }
  });
  return out;
}

export function entityDomain(entityId: unknown) {
  const raw = String(entityId || "").trim();
  const dot = raw.indexOf(".");
  return dot > 0 ? raw.slice(0, dot) : "";
}

export function normalizeEntityList(value: unknown, domains: string[] = []) {
  const allowed = new Set(domains);
  const rows: unknown[] = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[\n,]/)
        .map(item => item.trim());
  const seen = new Set();
  return rows
    .map((item: unknown) => {
      if (isObject(item)) {
        return String(item.entity || item.entity_id || "").trim();
      }
      return String(item || "").trim();
    })
    .filter(entityId => {
      if (!entityId || seen.has(entityId)) {
        return false;
      }
      if (allowed.size && !allowed.has(entityDomain(entityId))) {
        return false;
      }
      seen.add(entityId);
      return true;
    });
}

export function normalizeStringList(value: unknown) {
  const rows: unknown[] = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[\n,]/)
        .map(item => item.trim());
  const seen = new Set();
  return rows
    .map(item => String(item || "").trim().toLowerCase())
    .filter(item => {
      if (!item || seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
}

export function normalizeNotifyServices(value: unknown) {
  return normalizeStringList(value)
    .map(item => (item.includes(".") ? item : `notify.${item}`))
    .filter(item => item.startsWith("notify.") && item.length > "notify.".length);
}

export function normalizeBoolean(value: unknown) {
  if (value === true || value === false) {
    return value;
  }
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "on", "yes", "1"].includes(normalized)) {
    return true;
  }
  if (["false", "off", "no", "0"].includes(normalized)) {
    return false;
  }
  return false;
}

export function normalizeNotificationTapAction(value: unknown) {
  const row = isObject(value) ? value : {};
  let action = String(row.action || "none").trim().toLowerCase().replaceAll("_", "-");
  if (action === "more-info-dialog") {
    action = "more-info";
  }
  if (action === "open-url") {
    action = "url";
  }
  const allowed = new Set(["none", "more-info", "navigate", "url", "toggle"]);
  if (!allowed.has(action)) {
    action = "none";
  }
  const out: NotificationTapAction = { action };
  const entity = String(row.entity || row.entity_id || "").trim();
  const navigationPath = String(row.navigation_path || row.path || "").trim();
  const urlPath = String(row.url_path || row.url || "").trim();
  if ((action === "more-info" || action === "toggle") && entity) {
    out.entity = entity;
  }
  if (action === "navigate" && navigationPath) {
    out.navigation_path = navigationPath;
  }
  if (action === "url" && urlPath) {
    out.url_path = urlPath;
  }
  if (action === "url" && row.new_tab !== undefined) {
    out.new_tab = normalizeBoolean(row.new_tab);
  }
  return out;
}

export function hasNotificationTapAction(value: unknown) {
  const action = normalizeNotificationTapAction(value);
  switch (action.action) {
    case "more-info":
    case "toggle":
      return true;
    case "navigate":
      return Boolean(action.navigation_path);
    case "url":
      return Boolean(action.url_path);
    default:
      return false;
  }
}

export function normalizeSmartNotificationOptions(value: unknown) {
  const row = isObject(value) ? value : {};
  return {
    title: String(row.title || "").trim(),
    message: String(row.message || "").trim(),
    tint_color: String(row.tint_color || "").trim(),
    url: String(row.url || "").trim(),
    action_label: String(row.action_label || "").trim(),
    tap_action: normalizeNotificationTapAction(row.tap_action),
    mobile: normalizeSmartEntityMobile(row.mobile ?? row.mobile_notifications ?? row.mobile_enabled),
  };
}

export function normalizeExternalAlerts(value: unknown, options: NotificationNormalizationOptions = {}) {
  const rows: unknown[] = Array.isArray(value) ? value : [];
  const keepDrafts = options.keepDrafts === true;
  const seen = new Set();
  return rows
    .map((item: unknown) => {
      const row = isObject(item) ? item : {};
      const id = String(row.id || "").trim();
      const type = String(row.type || "external_alert").trim().toLowerCase() || "external_alert";
      const mobileRaw = row.mobile ?? row.mobile_notifications ?? row.mobile_enabled;
      const normalized = {
        id,
        type,
        title: String(row.title || "").trim(),
        message: String(row.message || "").trim(),
        severity: normalizeSeverity(row.severity || "info"),
        entity: String(row.entity || "").trim(),
        source: String(row.source || "").trim(),
        icon: String(row.icon || "").trim(),
        tint_color: String(row.tint_color || "").trim(),
        mobile: normalizeMobilePolicy(mobileRaw),
        tap_action: normalizeNotificationTapAction(row.tap_action),
        url: String(row.url || "").trim(),
        action_label: String(row.action_label || "").trim(),
        ...(keepDrafts && row._draft === true ? { _draft: true } : {}),
      };
      return normalized;
    })
    .filter(item => {
      if (keepDrafts && item._draft === true) {
        return true;
      }
      if (!item.id || !item.title || seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
}

export function normalizeSmartEntityOverrides(value: unknown) {
  const rows: unknown[] = Array.isArray(value)
    ? value
    : isObject(value)
      ? Object.entries(value).map(([entity, row]) => ({ ...(isObject(row) ? row : {}), entity }))
      : [];
  const seen = new Set();
  return rows
    .map((item: unknown) => {
      const row = isObject(item) ? item : {};
      return {
        entity: String(row.entity || row.entity_id || "").trim(),
        title: String(row.title || "").trim(),
        message: String(row.message || "").trim(),
        tint_color: String(row.tint_color || "").trim(),
        url: String(row.url || "").trim(),
        action_label: String(row.action_label || "").trim(),
        tap_action: normalizeNotificationTapAction(row.tap_action),
        mobile: normalizeSmartEntityOverrideMobile(row.mobile ?? row.mobile_notifications ?? row.mobile_enabled),
      };
    })
    .filter(item => {
      if (!item.entity || seen.has(item.entity)) {
        return false;
      }
      seen.add(item.entity);
      return Boolean(item.title || item.message || item.tint_color || item.url || item.action_label || hasNotificationTapAction(item.tap_action) || isExplicitSmartEntityMobile(item.mobile));
    });
}

export function normalizeSmartNotifications(value: unknown) {
  const rows = isObject(value) ? value : {};
  const out: Record<string, ReturnType<typeof normalizeSmartNotificationOptions>> = {};
  Object.keys(DEFAULT_CONFIG.smart_notifications).forEach(key => {
    out[key] = normalizeSmartNotificationOptions(rows[key]);
  });
  return out;
}

export function normalizeCustomNotifications(value: unknown, options: NotificationNormalizationOptions = {}) {
  const keepDrafts = options.keepDrafts === true;
  return (Array.isArray(value) ? value : [])
    .map((item: unknown) => {
      const row = isObject(item) ? item : {};
      const normalized = {
        title: String(row.title || "").trim(),
        message: String(row.message || "").trim(),
        icon: String(row.icon || "mdi:bell-outline").trim(),
        tint_color: String(row.tint_color || "").trim(),
        severity: normalizeSeverity(row.severity || "info"),
        entity: String(row.entity || "").trim(),
        attribute: String(row.attribute || "").trim(),
        condition: String(row.condition || "always").trim(),
        value: String(row.value || "").trim(),
        action_label: String(row.action_label || "").trim(),
        action_type: String(row.action_type || "none").trim(),
        service: String(row.service || "").trim(),
        service_data: typeof row.service_data === "string"
          ? row.service_data
          : row.service_data
            ? JSON.stringify(row.service_data)
            : "",
        url: String(row.url || "").trim(),
        tap_action: normalizeNotificationTapAction(row.tap_action),
        mobile: normalizeSmartEntityMobile(row.mobile ?? row.mobile_notifications ?? row.mobile_enabled),
        ...(keepDrafts && row._draft === true ? { _draft: true } : {}),
      };
      return normalized;
    })
    .filter(item => {
      const hasContent = item.title || item.message || item.entity;
      const placeholderTitle = normalizeMatchText(item.title) === normalizeMatchText("New notification");
      const isPlaceholder = placeholderTitle && !item.message && !item.entity;
      return keepDrafts && item._draft === true ? true : hasContent && !isPlaceholder;
    });
}

export function finiteNumber<T>(value: unknown, fallback: T): number | T {
  return parseFiniteNumericValue(value) ?? fallback;
}

export function normalizeMatchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeSeverity(value: unknown) {
  const key = String(value || "info").trim().toLowerCase();
  return ["info", "success", "warning", "critical"].includes(key) ? key : "info";
}
