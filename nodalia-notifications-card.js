// <nodalia-standalone-utils>
// Inlined for standalone Lovelace resources (single JS file). Stripped when building nodalia-cards.js.
// Source of truth: nodalia-utils.js — regenerate: node scripts/sync-standalone-embed.mjs
/**
 * Shared helpers for Nodalia cards (deep equality, config stripping, editor mounts).
 * Loaded early in nodalia-cards.js bundle; exposed as window.NodaliaUtils.
 */
(function initNodaliaUtils() {
  const REQUIRED_API_KEYS = [
    "isObject",
    "deepClone",
    "deepEqual",
    "stripEqualToDefaults",
    "editorStatesSignature",
    "editorFilteredStatesSignature",
    "sanitizeActionUrl",
    "mountEntityPickerHost",
    "mountIconPickerHost",
    "postHomeAssistantWebhook",
  ];
  const existing = typeof window !== "undefined" ? window.NodaliaUtils : null;
  if (
    existing &&
    REQUIRED_API_KEYS.every(key => typeof existing[key] === "function")
  ) {
    return;
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function deepClone(value) {
    if (value === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function deepEqual(a, b) {
    if (Object.is(a, b)) {
      return true;
    }
    if (a == null || b == null) {
      return a === b;
    }
    if (typeof a !== typeof b) {
      return false;
    }
    if (typeof a !== "object") {
      return false;
    }
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) {
        return false;
      }
      return a.every((value, index) => deepEqual(value, b[index]));
    }
    if (Array.isArray(b)) {
      return false;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) {
      return false;
    }
    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  function stripEqualToDefaults(config, defaults) {
    if (defaults === undefined || defaults === null) {
      return deepClone(config);
    }
    if (config === undefined || config === null) {
      return undefined;
    }
    if (Array.isArray(config)) {
      return deepEqual(config, defaults) ? undefined : deepClone(config);
    }
    if (isObject(config) && isObject(defaults)) {
      const out = {};
      for (const key of Object.keys(config)) {
        const cv = config[key];
        const dv = defaults[key];
        if (!(key in defaults)) {
          out[key] = deepClone(cv);
          continue;
        }
        if (deepEqual(cv, dv)) {
          continue;
        }
        if (isObject(cv) && !Array.isArray(cv) && isObject(dv) && !Array.isArray(dv)) {
          const stripped = stripEqualToDefaults(cv, dv);
          if (stripped !== undefined) {
            out[key] = stripped;
          }
        } else {
          out[key] = deepClone(cv);
        }
      }
      return Object.keys(out).length ? out : undefined;
    }
    return deepEqual(config, defaults) ? undefined : config;
  }

  /**
   * Signature for entities matching predicate(entityId): id + friendly_name + icon per row,
   * so picker labels update when attributes change. Same locale prefix as editorStatesSignature.
   */
  function editorFilteredStatesSignature(hass, language, predicate) {
    const states = hass?.states || {};
    const rows = [];
    for (const id of Object.keys(states)) {
      if (!predicate(id)) {
        continue;
      }
      const state = states[id];
      rows.push(
        `${id}:${String(state?.attributes?.friendly_name ?? "")}:${String(state?.attributes?.icon ?? "")}`,
      );
    }
    rows.sort((left, right) => {
      const idLeft = left.split(":")[0];
      const idRight = right.split(":")[0];
      return idLeft.localeCompare(idRight, undefined, { sensitivity: "base" });
    });
    const tag =
      typeof window !== "undefined" && window.NodaliaI18n && typeof hass !== "undefined"
        ? window.NodaliaI18n.localeTag(window.NodaliaI18n.resolveLanguage(hass, language))
        : "";
    return `${tag}|${rows.join("|")}`;
  }

  /**
   * Full hass.states signature: every entity as id + friendly_name + icon (sorted by id),
   * plus locale tag — same shape as editorFilteredStatesSignature. Editors that list entities
   * re-render when labels or icons change, not only when the entity count changes.
   */
  function editorStatesSignature(hass, language) {
    return editorFilteredStatesSignature(hass, language, () => true);
  }

  /**
   * Accepts either the webhook id (`my_hook`) or a pasted `/api/webhook/...` path / full URL.
   */
  function normalizeHomeAssistantWebhookId(webhookId) {
    const raw = String(webhookId ?? "").trim();
    if (!raw) {
      return "";
    }
    if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        const m = /\/api\/webhook\/([^/]+)/.exec(u.pathname);
        return m ? decodeURIComponent(m[1]) : "";
      } catch (_err) {
        return "";
      }
    }
    const pathSeg = raw.match(/(?:^|\/)api\/webhook\/([^/?#]+)/i);
    if (pathSeg) {
      return decodeURIComponent(pathSeg[1]);
    }
    return raw;
  }

  /**
   * POST JSON to the Home Assistant webhook endpoint `/api/webhook/<webhook_id>`.
   * Does not rely on the signed-in user's permission to call `input_text.set_value`;
   * an automation triggered by the webhook runs with normal HA privileges.
   * Typical body: `{ "value": "<payload>" }` with `{{ trigger.json.value }}` in actions.
   *
   * Pass **`hass`** (third argument) so **`hass.auth.fetchWithAuth`** is used — raw `fetch`
   * often returns **401** in the HA frontend because API routes expect the bearer/session
   * from `fetchWithAuth`, not cookies alone.
   */
  function postHomeAssistantWebhook(webhookId, body, hass) {
    const id = normalizeHomeAssistantWebhookId(webhookId);
    if (!id) {
      return Promise.resolve(false);
    }
    const payload = body && typeof body === "object" ? body : {};
    const path = `/api/webhook/${encodeURIComponent(id)}`;

    const authFetch = hass?.auth?.fetchWithAuth;
    if (typeof authFetch === "function") {
      return authFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(
        res => res.ok,
        () => false,
      );
    }

    if (typeof fetch !== "function") {
      return Promise.resolve(false);
    }
    const origin = typeof window !== "undefined" && window.location ? window.location.origin : "";
    if (!origin) {
      return Promise.resolve(false);
    }
    const url = `${origin}${path}`;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    }).then(
      res => res.ok,
      () => false,
    );
  }

  /**
   * Normalize and validate user-provided action URLs.
   * Allows http/https and same-origin relative paths by default.
   */
  function sanitizeActionUrl(value, options = {}) {
    const raw = String(value ?? "").trim();
    if (!raw) {
      return "";
    }
    const allowRelative = options.allowRelative !== false;
    const allowHash = options.allowHash === true;
    if (allowHash && raw.startsWith("#")) {
      return raw;
    }
    if (allowRelative && (/^\/(?!\/)/.test(raw) || raw.startsWith("./") || raw.startsWith("../"))) {
      return raw;
    }
    try {
      const base =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : "https://example.invalid";
      const parsed = new URL(raw, base);
      const protocol = String(parsed.protocol || "").toLowerCase();
      if (protocol !== "http:" && protocol !== "https:") {
        return "";
      }
      if (allowRelative && typeof window !== "undefined" && window.location && parsed.origin === window.location.origin) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return parsed.toString();
    } catch (_error) {
      return "";
    }
  }

  function copyDatasetExcept(control, host, skipKeys) {
    const skip = new Set(skipKeys || []);
    Object.entries(host.dataset || {}).forEach(([key, value]) => {
      if (skip.has(key)) {
        return;
      }
      control.dataset[key] = value;
    });
  }

  /** Latest callbacks for reused picker controls (listeners call into this). */
  const pickerCallbackState = new WeakMap();
  const pickerControlsWithListeners = new WeakSet();

  function dispatchPickerChange(ev) {
    const control = ev.currentTarget;
    const s = pickerCallbackState.get(control);
    if (s && typeof s.onShadowInput === "function") {
      s.onShadowInput(ev);
    }
  }

  function dispatchPickerValueChanged(ev) {
    const control = ev.currentTarget;
    const s = pickerCallbackState.get(control);
    if (!s) {
      return;
    }
    const fn = s.onShadowValueChanged || s.onShadowInput;
    if (typeof fn === "function") {
      fn(ev);
    }
  }

  /**
   * Mount or update ha-entity-picker / ha-selector / text input without recreating each render.
   */
  function mountEntityPickerHost(host, options) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const hass = options.hass;
    const field = options.field || host.dataset.field || "entity";
    const nextValue = options.value !== undefined ? String(options.value) : String(host.dataset.value || "");
    const placeholder =
      options.placeholder !== undefined ? String(options.placeholder) : String(host.dataset.placeholder || "");
    const onShadowInput = options.onShadowInput;
    const onShadowValueChanged = options.onShadowValueChanged;
    const copyDatasetFromHost = options.copyDatasetFromHost !== false;

    const usePicker = typeof customElements !== "undefined" && customElements.get("ha-entity-picker");
    const useSelector = typeof customElements !== "undefined" && customElements.get("ha-selector");

    let desired = "input";
    if (usePicker) {
      desired = "picker";
    } else if (useSelector) {
      desired = "selector";
    }

    let control = host.firstElementChild;
    const tag = control?.tagName || "";
    const matches =
      control &&
      ((desired === "picker" && tag === "HA-ENTITY-PICKER")
        || (desired === "selector" && tag === "HA-SELECTOR")
        || (desired === "input" && tag === "INPUT"));

    if (!matches) {
      host.replaceChildren();
      if (usePicker) {
        control = document.createElement("ha-entity-picker");
        control.allowCustomEntity = true;
      } else if (useSelector) {
        control = document.createElement("ha-selector");
        control.selector = { entity: {} };
      } else {
        control = document.createElement("input");
        control.type = "text";
      }

      control.dataset.field = field;
      if (copyDatasetFromHost) {
        copyDatasetExcept(control, host, ["mountedControl", "value", "placeholder", "field"]);
      }

      if ("hass" in control) {
        control.hass = hass;
      }
      if ("value" in control) {
        control.value = nextValue;
      }
      if (placeholder && "placeholder" in control) {
        control.placeholder = placeholder;
      }

      pickerCallbackState.set(control, { onShadowInput, onShadowValueChanged });
      if (!pickerControlsWithListeners.has(control)) {
        pickerControlsWithListeners.add(control);
        if (control.tagName === "INPUT") {
          control.addEventListener("change", dispatchPickerChange);
        } else {
          control.addEventListener("value-changed", dispatchPickerValueChanged);
        }
      }

      host.appendChild(control);
      return;
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;
    pickerCallbackState.set(control, { onShadowInput, onShadowValueChanged });
    if ("hass" in control) {
      control.hass = hass;
    }
    if (placeholder && "placeholder" in control) {
      control.placeholder = placeholder;
    }
    if ("value" in control && control.value !== nextValue) {
      control.value = nextValue;
    }
  }

  /**
   * Mount or update ha-icon-picker / text input without recreating each render.
   */
  function mountIconPickerHost(host, options) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const hass = options.hass;
    const nextValue = options.value !== undefined ? String(options.value) : String(host.dataset.value || "");
    const placeholder = options.placeholder !== undefined ? options.placeholder : host.dataset.placeholder || "";
    const onShadowInput = options.onShadowInput;
    const onShadowValueChanged = options.onShadowValueChanged;
    const copyDatasetFromHost = options.copyDatasetFromHost !== false;

    const useIconPicker = typeof customElements !== "undefined" && customElements.get("ha-icon-picker");

    let desired = useIconPicker ? "icon" : "input";
    let control = host.firstElementChild;
    const tag = control?.tagName || "";
    const matches =
      control && ((desired === "icon" && tag === "HA-ICON-PICKER") || (desired === "input" && tag === "INPUT"));

    if (!matches) {
      host.replaceChildren();
      if (useIconPicker) {
        control = document.createElement("ha-icon-picker");
      } else {
        control = document.createElement("input");
        control.type = "text";
      }

      if (copyDatasetFromHost) {
        copyDatasetExcept(control, host, ["mountedControl", "value", "placeholder", "field"]);
      }

      if ("hass" in control) {
        control.hass = hass;
      }
      if (placeholder && "placeholder" in control) {
        control.placeholder = placeholder;
      }
      if ("value" in control) {
        control.value = nextValue;
      }

      pickerCallbackState.set(control, { onShadowInput, onShadowValueChanged });
      if (!pickerControlsWithListeners.has(control)) {
        pickerControlsWithListeners.add(control);
        if (control.tagName === "INPUT") {
          control.addEventListener("change", dispatchPickerChange);
        } else {
          control.addEventListener("value-changed", dispatchPickerValueChanged);
        }
      }

      host.appendChild(control);
      return;
    }

    pickerCallbackState.set(control, { onShadowInput, onShadowValueChanged });
    if ("hass" in control) {
      control.hass = hass;
    }
    if (placeholder && "placeholder" in control) {
      control.placeholder = placeholder;
    }
    if ("value" in control && control.value !== nextValue) {
      control.value = nextValue;
    }
  }

  const api = {
    isObject,
    deepClone,
    deepEqual,
    stripEqualToDefaults,
    editorStatesSignature,
    editorFilteredStatesSignature,
    sanitizeActionUrl,
    mountEntityPickerHost,
    mountIconPickerHost,
    postHomeAssistantWebhook,
  };

  if (typeof window !== "undefined") {
    window.NodaliaUtils = api;
  }
})();

// </nodalia-standalone-utils>

const CARD_TAG = "nodalia-notifications-card";
const EDITOR_TAG = "nodalia-notifications-card-editor";
const CARD_VERSION = "1.0.0-alpha.48";
const STORAGE_KEY = "nodalia_notifications_dismissed_v1";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};

const DEFAULT_CONFIG = {
  title: "Notificaciones",
  icon: "mdi:bell-badge-outline",
  empty_title: "Todo tranquilo",
  empty_message: "No tienes ninguna alerta actualmente",
  max_visible: 1,
  refresh_interval: 300,
  storage_key: STORAGE_KEY,
  calendar_entities: [],
  vacuum_entities: [],
  fan_entities: [],
  weather_entities: [],
  motion_entities: [],
  door_entities: [],
  window_entities: [],
  temperature_entities: [],
  humidity_entities: [],
  custom_notifications: [],
  thresholds: {
    hot_temperature: 27,
    cold_temperature: 17,
    humidity_high: 70,
    humidity_low: 30,
  },
  smart_recommendations: true,
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "28px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "18px",
      gap: "14px",
    },
    icon: {
      background: "color-mix(in srgb, var(--primary-color) 18%, transparent)",
      color: "var(--primary-color)",
      size: "54px",
    },
    title_size: "22px",
    item_radius: "18px",
    accent: "var(--primary-color)",
  },
};

function deepClone(value) {
  if (window.NodaliaUtils?.deepClone) {
    return window.NodaliaUtils.deepClone(value);
  }
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeDeep(base, override) {
  const out = deepClone(base);
  if (!isObject(override)) {
    return out;
  }
  Object.entries(override).forEach(([key, value]) => {
    if (isObject(value) && isObject(out[key])) {
      out[key] = mergeDeep(out[key], value);
    } else if (value !== undefined) {
      out[key] = deepClone(value);
    }
  });
  return out;
}

function compactConfig(value) {
  if (Array.isArray(value)) {
    const rows = value
      .map(item => compactConfig(item))
      .filter(item => {
        if (item === undefined || item === null || item === "") {
          return false;
        }
        return !(isObject(item) && !Object.keys(item).length);
      });
    return rows.length ? rows : undefined;
  }
  if (isObject(value)) {
    const out = {};
    Object.entries(value).forEach(([key, child]) => {
      const next = compactConfig(child);
      if (next !== undefined && next !== "") {
        out[key] = next;
      }
    });
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

function entityDomain(entityId) {
  const raw = String(entityId || "").trim();
  const dot = raw.indexOf(".");
  return dot > 0 ? raw.slice(0, dot) : "";
}

function normalizeEntityList(value, domains = []) {
  const allowed = new Set(domains);
  const rows = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[\n,]/)
        .map(item => item.trim());
  const seen = new Set();
  return rows
    .map(item => {
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

function normalizeCustomNotifications(value) {
  return (Array.isArray(value) ? value : [])
    .map(item => {
      const row = isObject(item) ? item : {};
      return {
        title: String(row.title || "").trim(),
        message: String(row.message || "").trim(),
        icon: String(row.icon || "mdi:bell-outline").trim(),
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
      };
    })
    .filter(item => item.title || item.message || item.entity);
}

function normalizeConfig(rawConfig = {}) {
  const config = mergeDeep(DEFAULT_CONFIG, rawConfig);
  config.calendar_entities = normalizeEntityList(config.calendar_entities, ["calendar"]);
  config.vacuum_entities = normalizeEntityList(config.vacuum_entities, ["vacuum"]);
  config.fan_entities = normalizeEntityList(config.fan_entities, ["fan"]);
  config.weather_entities = normalizeEntityList(config.weather_entities, ["weather"]);
  config.motion_entities = normalizeEntityList(config.motion_entities, ["binary_sensor"]);
  config.door_entities = normalizeEntityList(config.door_entities, ["binary_sensor"]);
  config.window_entities = normalizeEntityList(config.window_entities, ["binary_sensor"]);
  config.temperature_entities = normalizeEntityList(config.temperature_entities, ["sensor"]);
  config.humidity_entities = normalizeEntityList(config.humidity_entities, ["sensor"]);
  config.custom_notifications = normalizeCustomNotifications(config.custom_notifications);
  config.max_visible = Math.max(1, Math.min(8, Number(config.max_visible) || 1));
  config.refresh_interval = Math.max(30, Math.min(3600, Number(config.refresh_interval) || 300));
  config.storage_key = String(config.storage_key || STORAGE_KEY).trim() || STORAGE_KEY;
  config.smart_recommendations = config.smart_recommendations !== false;
  config.thresholds = {
    hot_temperature: finiteNumber(config.thresholds?.hot_temperature, DEFAULT_CONFIG.thresholds.hot_temperature),
    cold_temperature: finiteNumber(config.thresholds?.cold_temperature, DEFAULT_CONFIG.thresholds.cold_temperature),
    humidity_high: finiteNumber(config.thresholds?.humidity_high, DEFAULT_CONFIG.thresholds.humidity_high),
    humidity_low: finiteNumber(config.thresholds?.humidity_low, DEFAULT_CONFIG.thresholds.humidity_low),
  };
  config.haptics = mergeDeep(DEFAULT_CONFIG.haptics, config.haptics || {});
  config.styles = mergeDeep(DEFAULT_CONFIG.styles, config.styles || {});
  return config;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeSelectorValue(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }
  return String(value).replace(/["\\]/g, "\\$&");
}

function sanitizeCssRuntimeValue(value, fallback) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallback;
  }
  if (/[<>{};"']/.test(raw) || raw.includes("/*") || raw.includes("*/") || /\burl\s*\(/i.test(raw)) {
    return fallback;
  }
  return raw;
}

function fireEvent(node, type, detail = {}, options = {}) {
  node.dispatchEvent(new CustomEvent(type, {
    bubbles: options.bubbles !== false,
    cancelable: Boolean(options.cancelable),
    composed: options.composed !== false,
    detail,
  }));
}

function setByPath(target, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  let cursor = target;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      cursor[part] = value;
      return;
    }
    if (!isObject(cursor[part]) && !Array.isArray(cursor[part])) {
      cursor[part] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    }
    cursor = cursor[part];
  });
}

function deleteByPath(target, path) {
  const parts = String(path || "").split(".").filter(Boolean);
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    cursor = cursor?.[parts[i]];
    if (!cursor) {
      return;
    }
  }
  if (cursor) {
    delete cursor[parts[parts.length - 1]];
  }
}

function getByPath(target, path) {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((cursor, part) => cursor?.[part], target);
}

function parseServiceData(value) {
  if (!value) {
    return {};
  }
  if (isObject(value)) {
    return deepClone(value);
  }
  try {
    const parsed = JSON.parse(String(value));
    return isObject(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function normalizeSeverity(value) {
  const key = String(value || "info").trim().toLowerCase();
  return ["info", "success", "warning", "critical"].includes(key) ? key : "info";
}

function friendlyName(hass, entityId) {
  const state = hass?.states?.[entityId];
  return String(state?.attributes?.friendly_name || entityId || "").trim();
}

function stateValue(stateObj, attribute = "") {
  if (!stateObj) {
    return "";
  }
  if (attribute) {
    return stateObj.attributes?.[attribute];
  }
  return stateObj.state;
}

function numericState(stateObj, attribute = "") {
  const raw = stateValue(stateObj, attribute);
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function stateIsOn(stateObj) {
  const state = String(stateObj?.state || "").toLowerCase();
  return ["on", "open", "opening", "detected", "motion", "home"].includes(state);
}

function stateIsOff(stateObj) {
  const state = String(stateObj?.state || "").toLowerCase();
  return ["off", "closed", "clear", "idle", "docked"].includes(state);
}

function formatNumber(value, unit = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "";
  }
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(number);
  return `${formatted}${unit || ""}`;
}

function calendarEventDate(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (isObject(value)) {
    return calendarEventDate(value.dateTime || value.date || value.datetime);
  }
  return null;
}

function isSameLocalDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeCalendarFetchResult(raw) {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (Array.isArray(raw?.events)) {
    return raw.events;
  }
  if (Array.isArray(raw?.calendar_events)) {
    return raw.calendar_events;
  }
  return [];
}

function notificationHash(value) {
  const input = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

class NodaliaNotificationsCard extends HTMLElement {
  static getStubConfig(hass) {
    const first = prefix => Object.keys(hass?.states || {}).find(entityId => entityId.startsWith(`${prefix}.`)) || "";
    return {
      title: "Notificaciones",
      calendar_entities: normalizeEntityList([first("calendar")], ["calendar"]),
      weather_entities: normalizeEntityList([first("weather")], ["weather"]),
      fan_entities: normalizeEntityList([first("fan")], ["fan"]),
      vacuum_entities: normalizeEntityList([first("vacuum")], ["vacuum"]),
    };
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig({});
    this._hass = null;
    this._expanded = false;
    this._dismissed = new Set();
    this._calendarEvents = [];
    this._calendarLoading = false;
    this._calendarError = "";
    this._calendarRefreshTimer = 0;
    this._calendarRefreshInFlight = false;
    this._lastCalendarRefresh = 0;
    this._lastRenderSignature = "";
    this._lastNotifications = [];
    this._onClick = this._onClick.bind(this);
    this.shadowRoot.addEventListener("click", this._onClick);
  }

  connectedCallback() {
    this._loadDismissed();
    this._renderIfChanged(true);
    this._refreshCalendarEventsSoon(0);
  }

  disconnectedCallback() {
    if (this._calendarRefreshTimer) {
      window.clearTimeout(this._calendarRefreshTimer);
      this._calendarRefreshTimer = 0;
    }
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._expanded = false;
    this._loadDismissed();
    this._lastRenderSignature = "";
    this._renderIfChanged(true);
    this._refreshCalendarEventsSoon(0);
  }

  set hass(hass) {
    this._hass = hass;
    this._refreshCalendarEventsSoon();
    this._renderIfChanged();
  }

  getCardSize() {
    const count = this._getNotifications().length;
    return Math.max(3, Math.min(8, 2 + Math.ceil(Math.min(count, this._expanded ? 5 : 2) * 1.2)));
  }

  getGridOptions() {
    return {
      columns: "full",
      min_columns: 2,
      min_rows: 2,
      rows: "auto",
    };
  }

  _getStorageKey() {
    return this._config.storage_key || STORAGE_KEY;
  }

  _loadDismissed() {
    if (typeof localStorage === "undefined") {
      this._dismissed = new Set();
      return;
    }
    try {
      const raw = JSON.parse(localStorage.getItem(this._getStorageKey()) || "[]");
      this._dismissed = new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch (_error) {
      this._dismissed = new Set();
    }
  }

  _saveDismissed() {
    if (typeof localStorage === "undefined") {
      return;
    }
    try {
      localStorage.setItem(this._getStorageKey(), JSON.stringify([...this._dismissed].slice(-250)));
    } catch (_error) {
      // Ignore storage quota/private mode errors.
    }
  }

  _pruneDismissed(currentIds) {
    const keep = new Set(currentIds);
    let changed = false;
    this._dismissed.forEach(id => {
      if (!keep.has(id)) {
        this._dismissed.delete(id);
        changed = true;
      }
    });
    if (changed) {
      this._saveDismissed();
    }
  }

  _refreshCalendarEventsSoon(delay = null) {
    if (!this.isConnected || !this._hass || !this._config.calendar_entities.length) {
      return;
    }
    const intervalMs = this._config.refresh_interval * 1000;
    const elapsed = Date.now() - this._lastCalendarRefresh;
    const nextDelay = delay === null ? Math.max(0, intervalMs - elapsed) : Math.max(0, delay);
    if (this._calendarRefreshTimer) {
      window.clearTimeout(this._calendarRefreshTimer);
    }
    this._calendarRefreshTimer = window.setTimeout(() => {
      this._calendarRefreshTimer = 0;
      this._refreshCalendarEvents();
    }, nextDelay);
  }

  async _refreshCalendarEvents() {
    if (!this._hass || !this._config.calendar_entities.length || this._calendarRefreshInFlight) {
      return;
    }
    if (typeof this._hass.callApi !== "function") {
      this._calendarError = "No se pudieron consultar calendarios.";
      this._renderIfChanged(true);
      return;
    }
    this._calendarRefreshInFlight = true;
    this._calendarLoading = true;
    this._renderIfChanged(true);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const events = [];
    try {
      for (const entityId of this._config.calendar_entities) {
        const path = `calendars/${encodeURIComponent(entityId)}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
        const raw = await this._hass.callApi("GET", path);
        normalizeCalendarFetchResult(raw).forEach(event => {
          events.push({ ...event, _entity: entityId });
        });
      }
      events.sort((left, right) => {
        const a = calendarEventDate(left.start)?.getTime() || 0;
        const b = calendarEventDate(right.start)?.getTime() || 0;
        return a - b;
      });
      this._calendarEvents = events;
      this._calendarError = "";
      this._lastCalendarRefresh = Date.now();
    } catch (_error) {
      this._calendarError = "No se pudieron cargar eventos de hoy.";
    } finally {
      this._calendarLoading = false;
      this._calendarRefreshInFlight = false;
      this._renderIfChanged(true);
      this._refreshCalendarEventsSoon();
    }
  }

  _getRawNotifications() {
    const items = [];
    const hass = this._hass;
    const now = new Date();
    const add = item => {
      if (!item?.id || !item.title) {
        return;
      }
      const severity = normalizeSeverity(item.severity || "info");
      items.push({
        action: null,
        createdAt: Date.now(),
        icon: "mdi:bell-outline",
        message: "",
        source: "",
        ...item,
        severity,
      });
    };

    this._calendarEvents.forEach(event => {
      const start = calendarEventDate(event.start);
      const end = calendarEventDate(event.end) || start;
      if (!start || !isSameLocalDay(start, now) || (end && end.getTime() < now.getTime())) {
        return;
      }
      const summary = String(event.summary || event.title || "Evento").trim();
      const allDay = String(event.start?.date || "").length > 0 || (typeof event.start === "string" && event.start.length <= 10);
      const timeText = allDay ? "Todo el dia" : formatTime(start);
      const startsSoon = !allDay && start.getTime() - now.getTime() <= 90 * 60 * 1000 && start.getTime() >= now.getTime();
      add({
        id: `calendar:${event._entity}:${notificationHash(`${summary}|${start.toISOString()}`)}`,
        title: startsSoon ? "Evento pronto" : "Evento pendiente hoy",
        message: `${timeText} · ${summary}`,
        icon: "mdi:calendar-clock",
        severity: startsSoon ? "warning" : "info",
        source: friendlyName(hass, event._entity),
        createdAt: start.getTime(),
        action: {
          label: "Abrir calendario",
          type: "more-info",
          entity: event._entity,
        },
      });
    });

    if (this._calendarError) {
      add({
        id: `calendar:error:${notificationHash(this._calendarError)}`,
        title: "Calendario no disponible",
        message: this._calendarError,
        icon: "mdi:calendar-alert",
        severity: "warning",
        createdAt: Date.now(),
      });
    }

    this._config.vacuum_entities.forEach(entityId => {
      const state = hass?.states?.[entityId];
      const value = String(state?.state || "").toLowerCase();
      if (!state) {
        return;
      }
      const name = friendlyName(hass, entityId);
      if (["error", "unavailable"].includes(value)) {
        add({
          id: `vacuum:${entityId}:${value}`,
          title: "Robot necesita atencion",
          message: `${name} esta en estado ${state.state}.`,
          icon: "mdi:robot-vacuum-alert",
          severity: "critical",
          source: name,
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: { label: "Ver robot", type: "more-info", entity: entityId },
        });
      } else if (["paused", "idle"].includes(value)) {
        add({
          id: `vacuum:${entityId}:${value}`,
          title: "Robot pausado",
          message: `${name} esta pausado o esperando.`,
          icon: "mdi:pause-circle-outline",
          severity: "warning",
          source: name,
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: { label: "Continuar", type: "service", service: "vacuum.start", entity: entityId },
        });
      } else if (["cleaning", "returning"].includes(value)) {
        add({
          id: `vacuum:${entityId}:${value}`,
          title: value === "cleaning" ? "Limpieza iniciada" : "Robot volviendo a base",
          message: `${name}: ${state.state}.`,
          icon: value === "cleaning" ? "mdi:robot-vacuum" : "mdi:home-import-outline",
          severity: "info",
          source: name,
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: { label: "Ver robot", type: "more-info", entity: entityId },
        });
      }
    });

    this._config.motion_entities.forEach(entityId => {
      const state = hass?.states?.[entityId];
      if (stateIsOn(state)) {
        add({
          id: `motion:${entityId}:${state.state}`,
          title: "Movimiento detectado",
          message: friendlyName(hass, entityId),
          icon: "mdi:motion-sensor",
          severity: "info",
          source: friendlyName(hass, entityId),
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: { label: "Ver sensor", type: "more-info", entity: entityId },
        });
      }
    });

    [
      ["door", this._config.door_entities, "Puerta abierta", "mdi:door-open"],
      ["window", this._config.window_entities, "Ventana abierta", "mdi:window-open-variant"],
    ].forEach(([kind, entities, title, icon]) => {
      entities.forEach(entityId => {
        const state = hass?.states?.[entityId];
        if (stateIsOn(state)) {
          add({
            id: `${kind}:${entityId}:${state.state}`,
            title,
            message: friendlyName(hass, entityId),
            icon,
            severity: "warning",
            source: friendlyName(hass, entityId),
            createdAt: Date.parse(state.last_changed || "") || Date.now(),
            action: { label: "Ver sensor", type: "more-info", entity: entityId },
          });
        }
      });
    });

    this._buildComfortNotifications(add);
    this._buildCustomNotifications(add);

    return items.sort((left, right) => {
      const severityScore = { critical: 4, warning: 3, success: 2, info: 1 };
      return (
        (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0) ||
        (severityScore[right.severity] || 0) - (severityScore[left.severity] || 0) ||
        String(right.id).localeCompare(String(left.id))
      );
    });
  }

  _buildComfortNotifications(add) {
    if (!this._config.smart_recommendations || !this._hass) {
      return;
    }
    const fanTarget = this._config.fan_entities.find(entityId => stateIsOff(this._hass.states?.[entityId]));
    const tempSources = [
      ...this._config.weather_entities.map(entityId => ({
        entityId,
        state: this._hass.states?.[entityId],
        value: numericState(this._hass.states?.[entityId], "temperature"),
        unit: this._hass.states?.[entityId]?.attributes?.temperature_unit || "°",
      })),
      ...this._config.temperature_entities.map(entityId => ({
        entityId,
        state: this._hass.states?.[entityId],
        value: numericState(this._hass.states?.[entityId]),
        unit: this._hass.states?.[entityId]?.attributes?.unit_of_measurement || "°",
      })),
    ].filter(item => item.state && item.value !== null);
    const hottest = tempSources.sort((left, right) => right.value - left.value)[0];
    if (hottest && hottest.value >= this._config.thresholds.hot_temperature && fanTarget) {
      add({
        id: `comfort:hot:${hottest.entityId}:${fanTarget}:${Math.floor(hottest.value)}`,
        title: "Hace calor",
        message: `${friendlyName(this._hass, hottest.entityId)} marca ${formatNumber(hottest.value, hottest.unit)}. Puedes encender ${friendlyName(this._hass, fanTarget)}.`,
        icon: "mdi:fan",
        severity: "warning",
        source: friendlyName(this._hass, hottest.entityId),
        createdAt: Date.parse(hottest.state.last_changed || "") || Date.now(),
        action: { label: "Encender ventilador", type: "service", service: "fan.turn_on", entity: fanTarget },
      });
    } else if (hottest && hottest.value <= this._config.thresholds.cold_temperature) {
      add({
        id: `comfort:cold:${hottest.entityId}:${Math.floor(hottest.value)}`,
        title: "Temperatura baja",
        message: `${friendlyName(this._hass, hottest.entityId)} marca ${formatNumber(hottest.value, hottest.unit)}.`,
        icon: "mdi:thermometer-low",
        severity: "info",
        source: friendlyName(this._hass, hottest.entityId),
        createdAt: Date.parse(hottest.state.last_changed || "") || Date.now(),
      });
    }

    this._config.humidity_entities.forEach(entityId => {
      const state = this._hass.states?.[entityId];
      const value = numericState(state);
      if (value === null) {
        return;
      }
      if (value >= this._config.thresholds.humidity_high || value <= this._config.thresholds.humidity_low) {
        add({
          id: `humidity:${entityId}:${value >= this._config.thresholds.humidity_high ? "high" : "low"}:${Math.round(value)}`,
          title: value >= this._config.thresholds.humidity_high ? "Humedad alta" : "Humedad baja",
          message: `${friendlyName(this._hass, entityId)} marca ${formatNumber(value, state.attributes?.unit_of_measurement || "%")}.`,
          icon: value >= this._config.thresholds.humidity_high ? "mdi:water-percent-alert" : "mdi:water-percent",
          severity: value >= this._config.thresholds.humidity_high ? "warning" : "info",
          source: friendlyName(this._hass, entityId),
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: { label: "Ver sensor", type: "more-info", entity: entityId },
        });
      }
    });
  }

  _buildCustomNotifications(add) {
    this._config.custom_notifications.forEach((item, index) => {
      if (!this._customNotificationMatches(item)) {
        return;
      }
      const entityName = item.entity ? friendlyName(this._hass, item.entity) : "";
      add({
        id: `custom:${index}:${notificationHash(`${item.title}|${item.message}|${item.entity}|${item.condition}|${item.value}`)}`,
        title: item.title || entityName || "Notificacion",
        message: item.message || entityName,
        icon: item.icon || "mdi:bell-outline",
        severity: item.severity || "info",
        source: entityName,
        createdAt: item.entity ? Date.parse(this._hass?.states?.[item.entity]?.last_changed || "") || Date.now() : Date.now(),
        action: this._buildCustomAction(item),
      });
    });
  }

  _customNotificationMatches(item) {
    const condition = String(item.condition || "always").toLowerCase();
    if (condition === "always") {
      return true;
    }
    const state = this._hass?.states?.[item.entity];
    if (!state) {
      return condition === "missing";
    }
    const raw = stateValue(state, item.attribute);
    const text = String(raw ?? "").trim().toLowerCase();
    const expected = String(item.value || "").trim().toLowerCase();
    const num = Number(raw);
    const expectedNum = Number(item.value);
    switch (condition) {
      case "on":
        return stateIsOn(state);
      case "off":
        return stateIsOff(state);
      case "unavailable":
        return ["unavailable", "unknown"].includes(String(state.state).toLowerCase());
      case "equals":
        return text === expected;
      case "not_equals":
        return text !== expected;
      case "above":
        return Number.isFinite(num) && Number.isFinite(expectedNum) && num > expectedNum;
      case "below":
        return Number.isFinite(num) && Number.isFinite(expectedNum) && num < expectedNum;
      default:
        return false;
    }
  }

  _buildCustomAction(item) {
    const type = String(item.action_type || "none").trim();
    if (type === "none") {
      return null;
    }
    return {
      label: item.action_label || (type === "service" ? "Ejecutar" : type === "toggle" ? "Alternar" : "Abrir"),
      type,
      entity: item.entity,
      service: item.service,
      serviceData: parseServiceData(item.service_data),
    };
  }

  _getNotifications() {
    const raw = this._getRawNotifications();
    this._pruneDismissed(raw.map(item => item.id));
    const visible = raw.filter(item => !this._dismissed.has(item.id));
    this._lastNotifications = visible;
    return visible;
  }

  _getRenderSignature(hass = this._hass) {
    const parts = [
      CARD_VERSION,
      this._expanded ? "expanded" : "collapsed",
      [...this._dismissed].join(","),
      this._calendarLoading ? "loading" : "",
      this._calendarError,
      this._calendarEvents.map(event => `${event._entity}:${event.summary || event.title}:${JSON.stringify(event.start)}`).join("|"),
    ];
    const tracked = [
      ...this._config.vacuum_entities,
      ...this._config.fan_entities,
      ...this._config.weather_entities,
      ...this._config.motion_entities,
      ...this._config.door_entities,
      ...this._config.window_entities,
      ...this._config.temperature_entities,
      ...this._config.humidity_entities,
      ...this._config.custom_notifications.map(item => item.entity).filter(Boolean),
    ];
    tracked.forEach(entityId => {
      const state = hass?.states?.[entityId];
      parts.push(`${entityId}:${state?.state || ""}:${state?.last_changed || ""}:${JSON.stringify(state?.attributes || {})}`);
    });
    return parts.join("||");
  }

  _renderIfChanged(force = false) {
    const next = this._getRenderSignature();
    if (!force && next === this._lastRenderSignature) {
      return;
    }
    this._lastRenderSignature = next;
    this._render();
  }

  _triggerHaptic(kind = this._config.haptics?.style) {
    if (!this._config.haptics?.enabled) {
      return;
    }
    const style = String(kind || "medium");
    try {
      fireEvent(this, "haptic", style);
    } catch (_error) {
      // Ignore unsupported HA haptic event.
    }
    if (this._config.haptics?.fallback_vibrate && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.medium);
    }
  }

  _onClick(event) {
    const button = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.action);
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.action;
    if (action === "toggle-stack") {
      this._expanded = !this._expanded;
      this._triggerHaptic("selection");
      this._renderIfChanged(true);
      return;
    }
    if (action === "dismiss") {
      const id = button.dataset.id;
      if (id) {
        this._dismissed.add(id);
        this._saveDismissed();
        this._triggerHaptic("light");
        this._renderIfChanged(true);
      }
      return;
    }
    if (action === "clear-all") {
      this._getRawNotifications().forEach(item => this._dismissed.add(item.id));
      this._saveDismissed();
      this._triggerHaptic("success");
      this._renderIfChanged(true);
      return;
    }
    if (action === "run-notification") {
      const notification = this._lastNotifications.find(item => item.id === button.dataset.id);
      this._runNotificationAction(notification);
    }
  }

  async _runNotificationAction(notification) {
    const action = notification?.action;
    if (!action || !this._hass) {
      return;
    }
    this._triggerHaptic("medium");
    if (action.type === "more-info" && action.entity) {
      fireEvent(this, "hass-more-info", { entityId: action.entity });
      return;
    }
    if (action.type === "toggle" && action.entity && typeof this._hass.callService === "function") {
      await this._hass.callService("homeassistant", "toggle", { entity_id: action.entity });
      return;
    }
    if (action.type === "service" && action.service && typeof this._hass.callService === "function") {
      const [domain, service] = String(action.service).split(".");
      if (!domain || !service) {
        return;
      }
      await this._hass.callService(domain, service, {
        ...(action.serviceData || {}),
        ...(action.entity ? { entity_id: action.entity } : {}),
      });
    }
  }

  _renderNotification(item, options = {}) {
    const action = item.action;
    const primary = options.primary === true;
    return `
      <article class="notification-item notification-item--${escapeHtml(item.severity)} ${primary ? "notification-item--primary" : ""}">
        <div class="notification-item__icon">
          <ha-icon icon="${escapeHtml(item.icon)}"></ha-icon>
        </div>
        <div class="notification-item__body">
          <div class="notification-item__title-row">
            <div class="notification-item__title">${escapeHtml(item.title)}</div>
            <button type="button" class="notification-item__dismiss" data-action="dismiss" data-id="${escapeHtml(item.id)}" aria-label="Borrar notificacion">
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          ${item.message ? `<div class="notification-item__message">${escapeHtml(item.message)}</div>` : ""}
          <div class="notification-item__meta">
            ${item.source ? `<span>${escapeHtml(item.source)}</span>` : ""}
            <span>${escapeHtml(this._severityLabel(item.severity))}</span>
          </div>
          ${
            action
              ? `
                <div class="notification-item__actions">
                  <button type="button" class="notification-item__action" data-action="run-notification" data-id="${escapeHtml(item.id)}">
                    ${escapeHtml(action.label || "Abrir")}
                  </button>
                </div>
              `
              : ""
          }
        </div>
      </article>
    `;
  }

  _severityLabel(severity) {
    switch (severity) {
      case "critical":
        return "Critica";
      case "warning":
        return "Aviso";
      case "success":
        return "OK";
      default:
        return "Info";
    }
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    const config = this._config;
    const styles = {
      card: {
        background: sanitizeCssRuntimeValue(config.styles.card.background, DEFAULT_CONFIG.styles.card.background),
        border: sanitizeCssRuntimeValue(config.styles.card.border, DEFAULT_CONFIG.styles.card.border),
        border_radius: sanitizeCssRuntimeValue(config.styles.card.border_radius, DEFAULT_CONFIG.styles.card.border_radius),
        box_shadow: sanitizeCssRuntimeValue(config.styles.card.box_shadow, DEFAULT_CONFIG.styles.card.box_shadow),
        padding: sanitizeCssRuntimeValue(config.styles.card.padding, DEFAULT_CONFIG.styles.card.padding),
        gap: sanitizeCssRuntimeValue(config.styles.card.gap, DEFAULT_CONFIG.styles.card.gap),
      },
      icon: {
        background: sanitizeCssRuntimeValue(config.styles.icon.background, DEFAULT_CONFIG.styles.icon.background),
        color: sanitizeCssRuntimeValue(config.styles.icon.color, DEFAULT_CONFIG.styles.icon.color),
        size: sanitizeCssRuntimeValue(config.styles.icon.size, DEFAULT_CONFIG.styles.icon.size),
      },
      title_size: sanitizeCssRuntimeValue(config.styles.title_size, DEFAULT_CONFIG.styles.title_size),
      item_radius: sanitizeCssRuntimeValue(config.styles.item_radius, DEFAULT_CONFIG.styles.item_radius),
      accent: sanitizeCssRuntimeValue(config.styles.accent, DEFAULT_CONFIG.styles.accent),
    };
    const notifications = this._getNotifications();
    const hiddenCount = Math.max(0, notifications.length - config.max_visible);
    const shouldStack = notifications.length > config.max_visible;
    const visible = this._expanded ? notifications : notifications.slice(0, config.max_visible);
    const hasNotifications = notifications.length > 0;
    const emptyText = String(config.empty_message || config.empty_title || DEFAULT_CONFIG.empty_message).trim();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        * {
          box-sizing: border-box;
        }
        ha-card {
          background: transparent;
          border: 0;
          box-shadow: none;
          color: var(--primary-text-color);
          display: block;
          overflow: hidden;
          padding: 0;
        }
        .notifications-surface {
          background: ${styles.card.background};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          overflow: hidden;
          position: relative;
        }
        .notifications-surface--empty {
          background:
            linear-gradient(90deg, rgba(168, 235, 176, 0.78), rgba(238, 255, 239, 0.96) 58%, rgba(255, 255, 255, 0.98)),
            color-mix(in srgb, var(--success-color, #43a047) 8%, var(--ha-card-background, #fff));
          border: 1px solid color-mix(in srgb, var(--success-color, #43a047) 28%, rgba(255, 255, 255, 0.58));
          box-shadow:
            0 10px 24px rgba(67, 160, 71, 0.13),
            var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.12));
        }
        .notifications-empty-inline {
          align-items: center;
          display: grid;
          gap: 18px;
          grid-template-columns: auto minmax(0, 1fr);
          min-height: 84px;
          padding: 16px 26px;
        }
        .notifications-empty-inline__icon {
          align-items: center;
          background: color-mix(in srgb, var(--success-color, #43a047) 15%, rgba(255, 255, 255, 0.58));
          border: 1px solid color-mix(in srgb, var(--success-color, #43a047) 24%, transparent);
          border-radius: 999px;
          color: color-mix(in srgb, var(--success-color, #43a047) 78%, var(--primary-text-color));
          display: inline-flex;
          height: 52px;
          justify-content: center;
          width: 52px;
        }
        .notifications-empty-inline__icon ha-icon {
          --mdc-icon-size: 26px;
        }
        .notifications-empty-inline__text {
          font-size: clamp(17px, 2vw, 22px);
          font-weight: 800;
          line-height: 1.22;
          overflow-wrap: anywhere;
        }
        .notifications-stack {
          display: grid;
          isolation: isolate;
          padding-bottom: ${shouldStack && !this._expanded ? "22px" : "0"};
          position: relative;
        }
        .notifications-stack-toggle,
        .notification-item__dismiss,
        .notification-item__action {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          justify-content: center;
          margin: 0;
          min-height: 34px;
          padding: 0 12px;
        }
        .notifications-list {
          display: grid;
          gap: 9px;
          position: relative;
          z-index: 3;
        }
        .notification-item {
          --notification-accent: ${styles.accent};
          align-items: start;
          background:
            linear-gradient(90deg, color-mix(in srgb, var(--notification-accent) 18%, rgba(255, 255, 255, 0.18)), rgba(255, 255, 255, 0.02) 72%),
            color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 94%, var(--notification-accent));
          border: 1px solid color-mix(in srgb, var(--notification-accent) 26%, color-mix(in srgb, var(--primary-text-color) 9%, transparent));
          border-radius: ${styles.item_radius};
          box-shadow:
            0 12px 26px color-mix(in srgb, var(--notification-accent) 12%, transparent),
            var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.12));
          display: grid;
          gap: 14px;
          grid-template-columns: auto minmax(0, 1fr);
          min-width: 0;
          min-height: 88px;
          padding: 16px 18px;
          position: relative;
          z-index: 4;
        }
        .notification-item--success {
          --notification-accent: var(--success-color, #43a047);
        }
        .notification-item--warning {
          --notification-accent: var(--warning-color, #f59e0b);
        }
        .notification-item--critical {
          --notification-accent: var(--error-color, #db4437);
        }
        .notification-item__icon {
          align-items: center;
          background: color-mix(in srgb, var(--notification-accent) 16%, transparent);
          border: 1px solid color-mix(in srgb, var(--notification-accent) 22%, transparent);
          border-radius: 999px;
          color: var(--notification-accent);
          display: inline-flex;
          height: 48px;
          justify-content: center;
          width: 48px;
        }
        .notification-item__icon ha-icon {
          --mdc-icon-size: 24px;
        }
        .notification-item__body {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .notification-item__title-row {
          align-items: center;
          display: grid;
          gap: 8px;
          grid-template-columns: minmax(0, 1fr) auto;
        }
        .notification-item__title {
          font-size: clamp(16px, 1.7vw, 20px);
          font-weight: 800;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }
        .notification-item__dismiss {
          height: 26px;
          min-height: 26px;
          padding: 0;
          width: 26px;
        }
        .notification-item__dismiss ha-icon {
          --mdc-icon-size: 14px;
        }
        .notification-item__message {
          color: var(--primary-text-color);
          font-size: 13px;
          line-height: 1.32;
          overflow-wrap: anywhere;
        }
        .notification-item__meta {
          color: var(--secondary-text-color);
          display: flex;
          flex-wrap: wrap;
          font-size: 11px;
          font-weight: 700;
          gap: 6px;
          text-transform: uppercase;
        }
        .notification-item__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding-top: 3px;
        }
        .notification-item__action {
          background: color-mix(in srgb, var(--notification-accent) 18%, transparent);
          border-color: color-mix(in srgb, var(--notification-accent) 32%, transparent);
          color: var(--primary-text-color);
          font-size: 12px;
          font-weight: 800;
        }
        .notification-stack-card {
          background: color-mix(in srgb, var(--ha-card-background, #fff) 88%, var(--primary-text-color));
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent);
          border-radius: ${styles.item_radius};
          bottom: calc(var(--stack-index) * 8px);
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
          height: 54px;
          left: calc(10px + var(--stack-index) * 8px);
          opacity: calc(0.78 - var(--stack-index) * 0.14);
          position: absolute;
          right: calc(10px + var(--stack-index) * 8px);
          z-index: calc(3 - var(--stack-index));
        }
        .notifications-footer {
          align-items: center;
          display: flex;
          justify-content: center;
          margin-top: -8px;
          position: relative;
          z-index: 8;
        }
        .notifications-stack-toggle {
          background: color-mix(in srgb, var(--primary-text-color) 8%, var(--ha-card-background, #fff));
          border-color: color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
          gap: 4px;
          font-size: 12px;
          font-weight: 800;
          height: 32px;
          min-height: 32px;
          padding: 0 10px;
        }
        .notifications-stack-toggle ha-icon {
          --mdc-icon-size: 18px;
        }
      </style>
      <ha-card>
          ${
            hasNotifications
              ? `
                <div class="notifications-stack">
                  ${
                    shouldStack && !this._expanded
                      ? `
                        <div class="notification-stack-card" style="--stack-index: 1;" aria-hidden="true"></div>
                        ${notifications.length > 2 ? `<div class="notification-stack-card" style="--stack-index: 2;" aria-hidden="true"></div>` : ""}
                      `
                      : ""
                  }
                  <div class="notifications-list">
                    ${visible.map((item, index) => this._renderNotification(item, { primary: index === 0 })).join("")}
                  </div>
                  ${
                    shouldStack
                      ? `
                        <div class="notifications-footer">
                          <button type="button" class="notifications-stack-toggle" data-action="toggle-stack" aria-expanded="${this._expanded ? "true" : "false"}" aria-label="${this._expanded ? "Mostrar menos" : "Mostrar todas las notificaciones"}">
                            <ha-icon icon="${this._expanded ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                            <span>${this._expanded ? "Menos" : hiddenCount}</span>
                          </button>
                        </div>
                      `
                      : ""
                  }
                </div>
              `
              : `
                <div class="notifications-surface notifications-surface--empty">
                  <div class="notifications-empty-inline">
                    <div class="notifications-empty-inline__icon">
                      <ha-icon icon="mdi:check"></ha-icon>
                    </div>
                    <div class="notifications-empty-inline__text">${escapeHtml(emptyText)}</div>
                  </div>
                </div>
              `
          }
      </ha-card>
    `;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaNotificationsCard);
}

class NodaliaNotificationsCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig({});
    this._hass = null;
    this._showStyleSection = false;
    this._showCustomSection = true;
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
  }

  set hass(hass) {
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender = !this._hass || nextSignature !== this._entityOptionsSignature || !this.shadowRoot?.innerHTML;
    this._hass = hass;
    this._entityOptionsSignature = nextSignature;
    if (shouldRender) {
      const focus = this._captureFocusState();
      this._render();
      this._restoreFocusState(focus);
    }
  }

  setConfig(config) {
    const focus = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    this._render();
    this._restoreFocusState(focus);
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils?.editorFilteredStatesSignature
      ? window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id => (
          id.startsWith("calendar.")
          || id.startsWith("vacuum.")
          || id.startsWith("fan.")
          || id.startsWith("weather.")
          || id.startsWith("binary_sensor.")
          || id.startsWith("sensor.")
        ))
      : Object.keys(hass?.states || {}).join("|");
  }

  _watchEditorControlTag(tagName) {
    if (!tagName || this._pendingEditorControlTags.has(tagName)) {
      return;
    }
    if (typeof customElements?.whenDefined !== "function" || customElements.get(tagName)) {
      return;
    }
    this._pendingEditorControlTags.add(tagName);
    customElements.whenDefined(tagName)
      .then(() => {
        this._pendingEditorControlTags.delete(tagName);
        if (this._hass && this.shadowRoot) {
          const focus = this._captureFocusState();
          this._render();
          this._restoreFocusState(focus);
        }
      })
      .catch(() => this._pendingEditorControlTags.delete(tagName));
  }

  _ensureEditorControlsReady() {
    this._watchEditorControlTag("ha-entity-picker");
    this._watchEditorControlTag("ha-selector");
    this._watchEditorControlTag("ha-icon-picker");
  }

  _captureFocusState() {
    const active = this.shadowRoot?.activeElement;
    if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement)) {
      return null;
    }
    const selector = active.dataset?.field ? `[data-field="${escapeSelectorValue(active.dataset.field)}"]` : null;
    if (!selector) {
      return null;
    }
    return {
      selector,
      type: active.type,
      selectionStart: typeof active.selectionStart === "number" ? active.selectionStart : null,
      selectionEnd: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
    };
  }

  _restoreFocusState(focus) {
    if (!focus?.selector) {
      return;
    }
    const target = this.shadowRoot?.querySelector(focus.selector);
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return;
    }
    try {
      target.focus({ preventScroll: true });
      if (focus.type !== "checkbox" && typeof target.setSelectionRange === "function") {
        target.setSelectionRange(focus.selectionStart, focus.selectionEnd);
      }
    } catch (_error) {
      target.focus();
    }
  }

  _emitConfig() {
    const focus = this._captureFocusState();
    const next = normalizeConfig(this._config);
    this._config = next;
    this._render();
    this._restoreFocusState(focus);
    const stripped = window.NodaliaUtils?.stripEqualToDefaults
      ? window.NodaliaUtils.stripEqualToDefaults(next, DEFAULT_CONFIG)
      : next;
    fireEvent(this, "config-changed", { config: compactConfig(stripped) || {} });
  }

  _readFieldValue(input) {
    const type = input.dataset.valueType || "string";
    if (type === "boolean") {
      return Boolean(input.checked);
    }
    if (type === "number") {
      return input.value === "" ? "" : Number(input.value);
    }
    if (type === "entity-list") {
      return normalizeEntityList(input.value);
    }
    return input.value;
  }

  _setFieldValue(path, value) {
    if (value === "" || value === undefined || value === null || (Array.isArray(value) && !value.length)) {
      deleteByPath(this._config, path);
      return;
    }
    setByPath(this._config, path, value);
  }

  _onShadowInput(event) {
    const input = event.composedPath().find(node => (
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLSelectElement
    ));
    if (!input?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    this._setFieldValue(input.dataset.field, this._readFieldValue(input));
    if (event.type === "change") {
      this._emitConfig();
    }
  }

  _onShadowValueChanged(event) {
    const control = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.field);
    if (!control?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    const nextValue = typeof event.detail?.value === "string" ? event.detail.value : control.value;
    if (typeof control.dataset.value === "string") {
      control.dataset.value = String(nextValue || "");
    }
    this._setFieldValue(control.dataset.field, nextValue);
    this._emitConfig();
  }

  _onShadowClick(event) {
    const toggle = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.editorToggle);
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      if (toggle.dataset.editorToggle === "styles") {
        this._showStyleSection = !this._showStyleSection;
      } else if (toggle.dataset.editorToggle === "custom") {
        this._showCustomSection = !this._showCustomSection;
      }
      this._render();
      return;
    }
    const button = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.editorAction);
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const index = Number(button.dataset.index);
    if (!Array.isArray(this._config.custom_notifications)) {
      this._config.custom_notifications = [];
    }
    switch (button.dataset.editorAction) {
      case "add-custom":
        this._config.custom_notifications.push({
          title: "Nueva notificacion",
          message: "",
          icon: "mdi:bell-outline",
          severity: "info",
          condition: "always",
          action_type: "none",
        });
        this._emitConfig();
        break;
      case "remove-custom":
        if (Number.isInteger(index)) {
          this._config.custom_notifications.splice(index, 1);
          this._emitConfig();
        }
        break;
      case "move-custom-up":
        if (Number.isInteger(index) && index > 0) {
          const [item] = this._config.custom_notifications.splice(index, 1);
          this._config.custom_notifications.splice(index - 1, 0, item);
          this._emitConfig();
        }
        break;
      case "move-custom-down":
        if (Number.isInteger(index) && index < this._config.custom_notifications.length - 1) {
          const [item] = this._config.custom_notifications.splice(index, 1);
          this._config.custom_notifications.splice(index + 1, 0, item);
          this._emitConfig();
        }
        break;
      default:
        break;
    }
  }

  _renderTextField(label, field, value, options = {}) {
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <input
          type="${escapeHtml(options.type || "text")}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          value="${escapeHtml(value ?? "")}"
          ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ""}
        />
      </label>
    `;
  }

  _renderTextareaField(label, field, value, options = {}) {
    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(label)}</span>
        <textarea
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ""}
        >${escapeHtml(value ?? "")}</textarea>
      </label>
    `;
  }

  _renderSelectField(label, field, value, options, renderOptions = {}) {
    return `
      <label class="editor-field ${renderOptions.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options.map(option => `
            <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
              ${escapeHtml(option.label)}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    return `
      <label class="editor-toggle">
        <input type="checkbox" data-field="${escapeHtml(field)}" data-value-type="boolean" ${checked ? "checked" : ""} />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="icon"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(value || "")}"
          data-placeholder="${escapeHtml(options.placeholder || "mdi:bell-outline")}"
        ></div>
      </div>
    `;
  }

  _renderEntityPickerField(label, field, value, options = {}) {
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(value || "")}"
          data-placeholder="${escapeHtml(options.placeholder || "")}"
        ></div>
      </div>
    `;
  }

  _renderEntityListField(label, field, value, placeholder) {
    return this._renderTextareaField(label, field, normalizeEntityList(value).join(", "), {
      valueType: "entity-list",
      placeholder,
    });
  }

  _mountEntityPicker(host) {
    if (window.NodaliaUtils?.mountEntityPickerHost) {
      window.NodaliaUtils.mountEntityPickerHost(host, {
        hass: this._hass,
        field: host.dataset.field,
        value: host.dataset.value || "",
        placeholder: host.dataset.placeholder || "",
        onShadowInput: this._onShadowInput,
        onShadowValueChanged: this._onShadowValueChanged,
        copyDatasetFromHost: true,
      });
    }
  }

  _mountIconPicker(host) {
    if (window.NodaliaUtils?.mountIconPickerHost) {
      window.NodaliaUtils.mountIconPickerHost(host, {
        hass: this._hass,
        value: host.dataset.value || "",
        placeholder: host.dataset.placeholder || "mdi:bell-outline",
        onShadowInput: this._onShadowInput,
        onShadowValueChanged: this._onShadowValueChanged,
        copyDatasetFromHost: true,
      });
      const control = host.firstElementChild;
      if (control instanceof HTMLElement) {
        control.dataset.field = host.dataset.field || "";
      }
    }
  }

  _renderCustomNotifications(config) {
    if (!config.custom_notifications.length) {
      return `<div class="editor-empty">Todavia no hay notificaciones personalizadas.</div>`;
    }
    return config.custom_notifications.map((item, index) => `
      <div class="editor-action">
        <div class="editor-action__header">
          <div class="editor-action__title">Notificacion ${index + 1}</div>
          <div class="editor-action__buttons">
            <button type="button" data-editor-action="move-custom-up" data-index="${index}">Subir</button>
            <button type="button" data-editor-action="move-custom-down" data-index="${index}">Bajar</button>
            <button type="button" data-editor-action="remove-custom" data-index="${index}">Eliminar</button>
          </div>
        </div>
        <div class="editor-grid">
          ${this._renderTextField("Titulo", `custom_notifications.${index}.title`, item.title, { placeholder: "Aviso" })}
          ${this._renderIconPickerField("Icono", `custom_notifications.${index}.icon`, item.icon)}
          ${this._renderTextareaField("Mensaje", `custom_notifications.${index}.message`, item.message, { placeholder: "Texto visible" })}
          ${this._renderSelectField("Severidad", `custom_notifications.${index}.severity`, item.severity, [
            { value: "info", label: "Info" },
            { value: "success", label: "OK" },
            { value: "warning", label: "Aviso" },
            { value: "critical", label: "Critica" },
          ])}
          ${this._renderEntityPickerField("Entidad opcional", `custom_notifications.${index}.entity`, item.entity, { fullWidth: true })}
          ${this._renderTextField("Atributo opcional", `custom_notifications.${index}.attribute`, item.attribute, { placeholder: "temperature" })}
          ${this._renderSelectField("Condicion", `custom_notifications.${index}.condition`, item.condition, [
            { value: "always", label: "Siempre" },
            { value: "on", label: "Activa / abierta" },
            { value: "off", label: "Inactiva / cerrada" },
            { value: "unavailable", label: "No disponible" },
            { value: "equals", label: "Igual a" },
            { value: "not_equals", label: "Distinto de" },
            { value: "above", label: "Mayor que" },
            { value: "below", label: "Menor que" },
            { value: "missing", label: "Entidad ausente" },
          ])}
          ${this._renderTextField("Valor condicion", `custom_notifications.${index}.value`, item.value, { placeholder: "27" })}
          ${this._renderSelectField("Accion", `custom_notifications.${index}.action_type`, item.action_type, [
            { value: "none", label: "Sin accion" },
            { value: "more-info", label: "Mas informacion" },
            { value: "toggle", label: "Alternar entidad" },
            { value: "service", label: "Llamar servicio" },
          ])}
          ${this._renderTextField("Etiqueta accion", `custom_notifications.${index}.action_label`, item.action_label, { placeholder: "Ejecutar" })}
          ${
            item.action_type === "service"
              ? `
                ${this._renderTextField("Servicio", `custom_notifications.${index}.service`, item.service, {
                  placeholder: "light.turn_on",
                  fullWidth: true,
                })}
                ${this._renderTextareaField("Datos servicio JSON", `custom_notifications.${index}.service_data`, item.service_data, {
                  placeholder: '{"brightness_pct": 80}',
                })}
              `
              : ""
          }
        </div>
      </div>
    `).join("");
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    const config = this._config || normalizeConfig({});
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        * {
          box-sizing: border-box;
        }
        .editor {
          color: var(--primary-text-color);
          display: grid;
          gap: 16px;
        }
        .editor-section {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border-radius: 16px;
          display: grid;
          gap: 14px;
          padding: 14px;
        }
        .editor-section__header {
          display: grid;
          gap: 5px;
        }
        .editor-section__title {
          font-size: 15px;
          font-weight: 800;
        }
        .editor-section__hint,
        .editor-empty {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.35;
        }
        .editor-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .editor-field {
          display: grid;
          gap: 6px;
        }
        .editor-field--full,
        .editor-grid--stacked {
          grid-column: 1 / -1;
        }
        .editor-grid--stacked {
          grid-template-columns: 1fr;
        }
        .editor-field > span,
        .editor-toggle > span:last-child {
          font-size: 12px;
          font-weight: 700;
        }
        .editor-field input,
        .editor-field textarea,
        .editor-field select {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 38px;
          padding: 8px 10px;
          width: 100%;
        }
        .editor-field textarea {
          min-height: 76px;
          resize: vertical;
        }
        .editor-toggle {
          align-items: center;
          cursor: pointer;
          display: grid;
          gap: 10px;
          grid-template-columns: auto minmax(0, 1fr);
          min-height: 40px;
        }
        .editor-toggle input {
          height: 1px;
          margin: 0;
          opacity: 0;
          position: absolute;
          width: 1px;
        }
        .editor-toggle__switch {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          height: 22px;
          position: relative;
          width: 40px;
        }
        .editor-toggle__switch::before {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 999px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.24);
          content: "";
          height: 18px;
          left: 1px;
          position: absolute;
          top: 1px;
          transition: transform 160ms ease;
          width: 18px;
        }
        .editor-toggle input:checked + .editor-toggle__switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }
        .editor-toggle input:checked + .editor-toggle__switch::before {
          transform: translateX(18px);
        }
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }
        .editor-section__actions,
        .editor-action__buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .editor-section__toggle-button,
        .editor-section__actions button,
        .editor-action__buttons button {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 750;
          min-height: 34px;
          padding: 0 12px;
        }
        .editor-action {
          background: color-mix(in srgb, var(--primary-text-color) 3%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border-radius: 16px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }
        .editor-action__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }
        .editor-action__title {
          font-size: 13px;
          font-weight: 800;
        }
        @media (max-width: 640px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">General</div>
            <div class="editor-section__hint">Titulo, icono y mensaje cuando no hay nada pendiente.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Titulo", "title", config.title)}
            ${this._renderIconPickerField("Icono", "icon", config.icon)}
            ${this._renderTextField("Titulo sin notificaciones", "empty_title", config.empty_title)}
            ${this._renderTextField("Mensaje sin notificaciones", "empty_message", config.empty_message, { fullWidth: true })}
            ${this._renderTextField("Maximo visible plegado", "max_visible", config.max_visible, { type: "number", valueType: "number" })}
            ${this._renderTextField("Refresco calendario (s)", "refresh_interval", config.refresh_interval, { type: "number", valueType: "number" })}
            ${this._renderCheckboxField("Recomendaciones inteligentes", "smart_recommendations", config.smart_recommendations !== false)}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Conexiones inteligentes</div>
            <div class="editor-section__hint">Entidades separadas por coma o por linea. Usa las mismas entidades que ya tienes en Calendar, Weather, Fan o Vacuum.</div>
          </div>
          <div class="editor-grid">
            ${this._renderEntityListField("Calendarios", "calendar_entities", config.calendar_entities, "calendar.casa, calendar.trabajo")}
            ${this._renderEntityListField("Robots aspirador", "vacuum_entities", config.vacuum_entities, "vacuum.robot")}
            ${this._renderEntityListField("Ventiladores", "fan_entities", config.fan_entities, "fan.salon")}
            ${this._renderEntityListField("Weather", "weather_entities", config.weather_entities, "weather.casa")}
            ${this._renderEntityListField("Movimiento", "motion_entities", config.motion_entities, "binary_sensor.movimiento")}
            ${this._renderEntityListField("Puertas", "door_entities", config.door_entities, "binary_sensor.puerta")}
            ${this._renderEntityListField("Ventanas", "window_entities", config.window_entities, "binary_sensor.ventana")}
            ${this._renderEntityListField("Temperatura", "temperature_entities", config.temperature_entities, "sensor.temperatura")}
            ${this._renderEntityListField("Humedad", "humidity_entities", config.humidity_entities, "sensor.humedad")}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Umbrales</div>
            <div class="editor-section__hint">Se usan para recomendaciones de clima, ventilador, temperatura y humedad.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Calor", "thresholds.hot_temperature", config.thresholds.hot_temperature, { type: "number", valueType: "number" })}
            ${this._renderTextField("Frio", "thresholds.cold_temperature", config.thresholds.cold_temperature, { type: "number", valueType: "number" })}
            ${this._renderTextField("Humedad alta", "thresholds.humidity_high", config.thresholds.humidity_high, { type: "number", valueType: "number" })}
            ${this._renderTextField("Humedad baja", "thresholds.humidity_low", config.thresholds.humidity_low, { type: "number", valueType: "number" })}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Notificaciones personalizadas</div>
            <div class="editor-section__hint">Crea avisos propios con condiciones por entidad, atributo y accion opcional.</div>
            <div class="editor-section__actions">
              <button type="button" data-editor-action="add-custom">Anadir notificacion</button>
              <button type="button" data-editor-toggle="custom">${this._showCustomSection ? "Ocultar" : "Mostrar"}</button>
            </div>
          </div>
          ${this._showCustomSection ? this._renderCustomNotifications(config) : ""}
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Estilos</div>
            <div class="editor-section__actions">
              <button type="button" data-editor-toggle="styles">${this._showStyleSection ? "Ocultar" : "Mostrar"}</button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderTextField("Fondo tarjeta", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("Borde tarjeta", "styles.card.border", config.styles.card.border)}
                  ${this._renderTextField("Radio tarjeta", "styles.card.border_radius", config.styles.card.border_radius)}
                  ${this._renderTextField("Sombra", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("Gap", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderTextField("Fondo icono", "styles.icon.background", config.styles.icon.background)}
                  ${this._renderTextField("Color icono", "styles.icon.color", config.styles.icon.color)}
                  ${this._renderTextField("Tamano icono", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
                  ${this._renderTextField("Radio notificacion", "styles.item_radius", config.styles.item_radius)}
                  ${this._renderTextField("Acento", "styles.accent", config.styles.accent)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot.querySelectorAll('[data-mounted-control="entity"]').forEach(host => this._mountEntityPicker(host));
    this.shadowRoot.querySelectorAll('[data-mounted-control="icon"]').forEach(host => this._mountIconPicker(host));
    this._ensureEditorControlsReady();
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaNotificationsCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Notifications Card",
  description: "Centro inteligente de notificaciones, recomendaciones y acciones.",
  preview: true,
});
