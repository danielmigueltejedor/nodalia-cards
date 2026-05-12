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
    "warnStrictServiceDenied",
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
    }    ).then(
      res => res.ok,
      () => false,
    );
  }

  /**
   * Log once per blocked `domain.service` when `security.strict_service_actions` denylists user actions.
   */
  function warnStrictServiceDenied(cardLabel, serviceValue) {
    const service = String(serviceValue || "").trim();
    if (!service) {
      return;
    }
    if (typeof console === "undefined" || typeof console.warn !== "function") {
      return;
    }
    console.warn(
      `${String(cardLabel || "Nodalia card")}: service blocked by strict_service_actions — not listed under security.allowed_services or security.allowed_service_domains: ${service}`,
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
    warnStrictServiceDenied,
  };

  if (typeof window !== "undefined") {
    window.NodaliaUtils = api;
  }
})();

// </nodalia-standalone-utils>

const CARD_TAG = "nodalia-notifications-card";
const EDITOR_TAG = "nodalia-notifications-card-editor";
const CARD_VERSION = "1.0.2-alpha.11";
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
  title: "Notifications",
  language: "auto",
  icon: "mdi:bell-badge-outline",
  empty_title: "All quiet",
  empty_message: "You have no current alerts",
  max_visible: 1,
  refresh_interval: 300,
  storage_key: STORAGE_KEY,
  dismissed_entity: "",
  calendar_entities: [],
  vacuum_entities: [],
  vacuum_error_entities: [],
  fan_entities: [],
  climate_entities: [],
  humidifier_entities: [],
  media_player_entities: [],
  weather_entities: [],
  motion_entities: [],
  door_entities: [],
  window_entities: [],
  temperature_entities: [],
  humidity_entities: [],
  battery_entities: [],
  humidifier_fill_entities: [],
  ink_entities: [],
  custom_notifications: [],
  smart_entity_overrides: [],
  thresholds: {
    hot_temperature: 27,
    cold_temperature: 17,
    humidity_high: 70,
    humidity_low: 30,
    rain_probability: 50,
    rain_lookahead_hours: 6,
    media_absence_minutes: 10,
    battery_low: 20,
    humidifier_fill_low: 20,
    ink_low: 15,
  },
  smart_recommendations: true,
  smart_notifications: {
    hot: { title: "", message: "", tint_color: "", url: "", action_label: "" },
    cold: { title: "", message: "", tint_color: "", url: "", action_label: "" },
    humidity_high: { title: "", message: "", tint_color: "", url: "", action_label: "" },
    humidity_low: { title: "", message: "", tint_color: "", url: "", action_label: "" },
    rain: { title: "", message: "", tint_color: "", url: "", action_label: "" },
    media_left_on: { title: "", message: "", tint_color: "", url: "", action_label: "" },
    battery_low: { title: "", message: "", tint_color: "", url: "", action_label: "" },
    humidifier_fill_low: { title: "", message: "", tint_color: "", url: "", action_label: "" },
    ink_low: { title: "", message: "", tint_color: "", url: "", action_label: "" },
  },
  mobile_notifications: {
    enabled: false,
    entities: [],
    services: [],
    min_severity: "warning",
    critical_alerts: false,
  },
  security: {
    strict_service_actions: false,
    allowed_services: [],
    allowed_service_domains: [],
  },
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    content_duration: 420,
    button_bounce_duration: 320,
  },
  styles: {
    card: {
      background: "var(--ha-card-background, var(--card-background-color, rgba(32, 34, 42, 0.94)))",
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

function normalizeStringList(value) {
  const rows = Array.isArray(value)
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

function normalizeNotifyServices(value) {
  return normalizeStringList(value)
    .map(item => (item.includes(".") ? item : `notify.${item}`))
    .filter(item => item.startsWith("notify.") && item.length > "notify.".length);
}

function normalizeSmartNotificationOptions(value) {
  const row = isObject(value) ? value : {};
  return {
    title: String(row.title || "").trim(),
    message: String(row.message || "").trim(),
    tint_color: String(row.tint_color || "").trim(),
    url: String(row.url || "").trim(),
    action_label: String(row.action_label || "").trim(),
  };
}

function normalizeSmartEntityMobile(value) {
  const normalized = String(value ?? "inherit").trim().toLowerCase();
  if (["on", "true", "enabled", "yes", "1"].includes(normalized)) {
    return "on";
  }
  if (["off", "false", "disabled", "no", "0"].includes(normalized)) {
    return "off";
  }
  return "inherit";
}

function normalizeSmartEntityOverrides(value) {
  const rows = Array.isArray(value)
    ? value
    : isObject(value)
      ? Object.entries(value).map(([entity, row]) => ({ ...(isObject(row) ? row : {}), entity }))
      : [];
  const seen = new Set();
  return rows
    .map(item => {
      const row = isObject(item) ? item : {};
      return {
        entity: String(row.entity || row.entity_id || "").trim(),
        title: String(row.title || "").trim(),
        message: String(row.message || "").trim(),
        tint_color: String(row.tint_color || "").trim(),
        url: String(row.url || "").trim(),
        action_label: String(row.action_label || "").trim(),
        mobile: normalizeSmartEntityMobile(row.mobile ?? row.mobile_notifications ?? row.mobile_enabled),
      };
    })
    .filter(item => {
      if (!item.entity || seen.has(item.entity)) {
        return false;
      }
      seen.add(item.entity);
      return Boolean(item.title || item.message || item.tint_color || item.url || item.action_label || item.mobile !== "inherit");
    });
}

function normalizeSmartNotifications(value) {
  const rows = isObject(value) ? value : {};
  const out = {};
  Object.keys(DEFAULT_CONFIG.smart_notifications).forEach(key => {
    out[key] = normalizeSmartNotificationOptions(rows[key]);
  });
  return out;
}

function normalizeCustomNotifications(value, options = {}) {
  const keepDrafts = options.keepDrafts === true;
  return (Array.isArray(value) ? value : [])
    .map(item => {
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
      };
      if (keepDrafts && row._draft === true) {
        normalized._draft = true;
      }
      return normalized;
    })
    .filter(item => {
      const hasContent = item.title || item.message || item.entity;
      const placeholderTitle = normalizeMatchText(item.title) === normalizeMatchText("New notification");
      const isPlaceholder = placeholderTitle && !item.message && !item.entity;
      return keepDrafts && item._draft === true ? true : hasContent && !isPlaceholder;
    });
}

function normalizeConfig(rawConfig = {}, options = {}) {
  const config = mergeDeep(DEFAULT_CONFIG, rawConfig);
  config.calendar_entities = normalizeEntityList(config.calendar_entities, ["calendar"]);
  config.vacuum_entities = normalizeEntityList(config.vacuum_entities, ["vacuum"]);
  config.vacuum_error_entities = normalizeEntityList(config.vacuum_error_entities, ["sensor"]);
  config.fan_entities = normalizeEntityList(config.fan_entities, ["fan"]);
  config.climate_entities = normalizeEntityList(config.climate_entities, ["climate"]);
  config.humidifier_entities = normalizeEntityList(config.humidifier_entities, ["humidifier"]);
  config.media_player_entities = normalizeEntityList(config.media_player_entities, ["media_player"]);
  config.weather_entities = normalizeEntityList(config.weather_entities, ["weather"]);
  config.motion_entities = normalizeEntityList(config.motion_entities, ["binary_sensor"]);
  config.door_entities = normalizeEntityList(config.door_entities, ["binary_sensor"]);
  config.window_entities = normalizeEntityList(config.window_entities, ["binary_sensor"]);
  config.temperature_entities = normalizeEntityList(config.temperature_entities, ["sensor"]);
  config.humidity_entities = normalizeEntityList(config.humidity_entities, ["sensor"]);
  config.battery_entities = normalizeEntityList(config.battery_entities, ["sensor"]);
  config.humidifier_fill_entities = normalizeEntityList(config.humidifier_fill_entities, ["sensor"]);
  config.ink_entities = normalizeEntityList(config.ink_entities, ["sensor"]);
  config.custom_notifications = normalizeCustomNotifications(config.custom_notifications, {
    keepDrafts: options.keepDrafts === true,
  });
  config.max_visible = Math.max(1, Math.min(8, Number(config.max_visible) || 1));
  config.refresh_interval = Math.max(30, Math.min(3600, Number(config.refresh_interval) || 300));
  config.storage_key = String(config.storage_key || STORAGE_KEY).trim() || STORAGE_KEY;
  config.dismissed_entity = entityDomain(config.dismissed_entity) === "input_text" ? String(config.dismissed_entity).trim() : "";
  config.smart_recommendations = config.smart_recommendations !== false;
  config.language = String(config.language || "auto").trim() || "auto";
  config.thresholds = {
    hot_temperature: finiteNumber(config.thresholds?.hot_temperature, DEFAULT_CONFIG.thresholds.hot_temperature),
    cold_temperature: finiteNumber(config.thresholds?.cold_temperature, DEFAULT_CONFIG.thresholds.cold_temperature),
    humidity_high: finiteNumber(config.thresholds?.humidity_high, DEFAULT_CONFIG.thresholds.humidity_high),
    humidity_low: finiteNumber(config.thresholds?.humidity_low, DEFAULT_CONFIG.thresholds.humidity_low),
    rain_probability: Math.max(0, Math.min(100, finiteNumber(config.thresholds?.rain_probability, DEFAULT_CONFIG.thresholds.rain_probability))),
    rain_lookahead_hours: Math.max(1, Math.min(24, finiteNumber(config.thresholds?.rain_lookahead_hours, DEFAULT_CONFIG.thresholds.rain_lookahead_hours))),
    media_absence_minutes: Math.max(1, Math.min(240, finiteNumber(config.thresholds?.media_absence_minutes, DEFAULT_CONFIG.thresholds.media_absence_minutes))),
    battery_low: Math.max(0, Math.min(100, finiteNumber(config.thresholds?.battery_low, DEFAULT_CONFIG.thresholds.battery_low))),
    humidifier_fill_low: Math.max(0, Math.min(100, finiteNumber(config.thresholds?.humidifier_fill_low, DEFAULT_CONFIG.thresholds.humidifier_fill_low))),
    ink_low: Math.max(0, Math.min(100, finiteNumber(config.thresholds?.ink_low, DEFAULT_CONFIG.thresholds.ink_low))),
  };
  config.smart_notifications = normalizeSmartNotifications(config.smart_notifications);
  config.smart_entity_overrides = normalizeSmartEntityOverrides(config.smart_entity_overrides);
  config.mobile_notifications = mergeDeep(DEFAULT_CONFIG.mobile_notifications, config.mobile_notifications || {});
  config.mobile_notifications.enabled = config.mobile_notifications.enabled === true;
  config.mobile_notifications.entities = normalizeEntityList(config.mobile_notifications.entities, ["notify"]);
  config.mobile_notifications.services = normalizeNotifyServices(config.mobile_notifications.services);
  config.mobile_notifications.critical_alerts = config.mobile_notifications.critical_alerts === true;
  config.mobile_notifications.min_severity = ["info", "success", "warning", "critical"].includes(String(config.mobile_notifications.min_severity || "").toLowerCase())
    ? String(config.mobile_notifications.min_severity).toLowerCase()
    : DEFAULT_CONFIG.mobile_notifications.min_severity;
  config.security = mergeDeep(DEFAULT_CONFIG.security, config.security || {});
  config.security.strict_service_actions = config.security.strict_service_actions === true;
  config.security.allowed_services = normalizeStringList(config.security.allowed_services);
  config.security.allowed_service_domains = normalizeStringList(config.security.allowed_service_domains);
  config.haptics = mergeDeep(DEFAULT_CONFIG.haptics, config.haptics || {});
  config.animations = mergeDeep(DEFAULT_CONFIG.animations, config.animations || {});
  config.animations.enabled = config.animations.enabled !== false;
  config.animations.content_duration = Math.max(120, Math.min(1800, Number(config.animations.content_duration) || DEFAULT_CONFIG.animations.content_duration));
  config.animations.button_bounce_duration = Math.max(120, Math.min(1200, Number(config.animations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration));
  config.styles = mergeDeep(DEFAULT_CONFIG.styles, config.styles || {});
  return config;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeMatchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function matchTextIncludes(haystack, needle) {
  const normalizedHaystack = normalizeMatchText(haystack);
  const normalizedNeedle = normalizeMatchText(needle);
  return Boolean(normalizedHaystack && normalizedNeedle && normalizedHaystack.includes(normalizedNeedle));
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

function formatEditorHexChannel(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function formatEditorColorFromHex(hex, alpha = 1) {
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

function parseEditorColorChannels(value) {
  const raw = String(value ?? "").trim();
  const hexMatch = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1].length === 3
      ? hexMatch[1].split("").map(channel => `${channel}${channel}`).join("")
      : hexMatch[1];
    return {
      alpha: 1,
      blue: Number.parseInt(hex.slice(4, 6), 16),
      green: Number.parseInt(hex.slice(2, 4), 16),
      red: Number.parseInt(hex.slice(0, 2), 16),
    };
  }
  const rgbMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbMatch) {
    return null;
  }
  const channels = rgbMatch[1]
    .split(",")
    .map(channel => Number(String(channel).trim().replace("%", "")));
  if (channels.length < 3 || channels.slice(0, 3).some(channel => !Number.isFinite(channel))) {
    return null;
  }
  return {
    alpha: channels.length > 3 && Number.isFinite(channels[3]) ? clamp(channels[3], 0, 1) : 1,
    blue: clamp(channels[2], 0, 255),
    green: clamp(channels[1], 0, 255),
    red: clamp(channels[0], 0, 255),
  };
}

function resolveEditorColorValue(value) {
  const resolver = typeof window !== "undefined" ? window.NodaliaBubbleContrast?.resolveEditorColorValue : null;
  return typeof resolver === "function" ? resolver(value) : String(value ?? "").trim();
}

function getEditorColorModel(value, fallbackValue = "#71c0ff") {
  const sourceValue = String(value ?? "").trim() || String(fallbackValue ?? "").trim() || "#71c0ff";
  const resolvedValue = resolveEditorColorValue(sourceValue) || resolveEditorColorValue(fallbackValue) || "rgb(113, 192, 255)";
  const parsed = parseEditorColorChannels(resolvedValue)
    || parseEditorColorChannels(sourceValue)
    || parseEditorColorChannels(resolveEditorColorValue(fallbackValue))
    || { alpha: 1, blue: 255, green: 192, red: 113 };
  const red = clamp(Math.round(parsed.red), 0, 255);
  const green = clamp(Math.round(parsed.green), 0, 255);
  const blue = clamp(Math.round(parsed.blue), 0, 255);
  const alpha = clamp(Number(parsed.alpha), 0, 1);
  const hex = `#${formatEditorHexChannel(red)}${formatEditorHexChannel(green)}${formatEditorHexChannel(blue)}`;
  return {
    alpha,
    hex,
    label: sourceValue,
    resolved: resolvedValue,
    source: sourceValue,
    value: formatEditorColorFromHex(hex, alpha),
  };
}

function getEditorColorFallbackValue(field) {
  const normalizedField = String(field ?? "");
  if (normalizedField.endsWith("background")) {
    return normalizedField.includes(".card.") ? "var(--ha-card-background)" : "color-mix(in srgb, var(--primary-color) 18%, transparent)";
  }
  if (normalizedField.endsWith("icon.color") || normalizedField.endsWith("accent") || normalizedField.endsWith("tint_color")) {
    return "var(--primary-color)";
  }
  return "#71c0ff";
}

function shouldDarkenNotificationIconGlyph(state, accentColor) {
  const contrast = typeof window !== "undefined" ? window.NodaliaBubbleContrast : null;
  if (contrast?.shouldDarkenBubbleIconGlyph?.(state, accentColor)) {
    return true;
  }
  const hue = contrast?.parseCssColorHue?.(accentColor);
  if (hue === null || hue === undefined || Number.isNaN(hue)) {
    return false;
  }
  return (hue >= 35 && hue <= 165) || (hue >= 300 || hue <= 20);
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

function areaRecordName(hass, areaId) {
  const rawId = String(areaId || "").trim();
  if (!rawId) {
    return "";
  }
  const areas = hass?.areas;
  if (Array.isArray(areas)) {
    const area = areas.find(item => String(item?.area_id || item?.id || "") === rawId);
    return String(area?.name || rawId).trim();
  }
  const area = areas?.[rawId];
  return String(area?.name || rawId).trim();
}

function entityRegistryEntry(hass, entityId) {
  return hass?.entities?.[entityId] || hass?.entityRegistry?.[entityId] || hass?.entity_registry?.[entityId] || null;
}

function deviceRegistryEntry(hass, deviceId) {
  const rawId = String(deviceId || "").trim();
  if (!rawId) {
    return null;
  }
  const devices = hass?.devices;
  if (Array.isArray(devices)) {
    return devices.find(item => String(item?.id || item?.device_id || "") === rawId) || null;
  }
  return devices?.[rawId] || null;
}

function entityAreaName(hass, entityId) {
  const state = hass?.states?.[entityId];
  const entity = entityRegistryEntry(hass, entityId);
  const device = deviceRegistryEntry(hass, entity?.device_id || state?.attributes?.device_id);
  const areaId = entity?.area_id || device?.area_id || state?.attributes?.area_id;
  const areaName = areaRecordName(hass, areaId);
  if (areaName) {
    return areaName;
  }
  const attrArea = state?.attributes?.area || state?.attributes?.area_name || state?.attributes?.room || state?.attributes?.room_name;
  if (attrArea) {
    return String(attrArea).trim();
  }
  const searchable = normalizeMatchText(`${entityId} ${friendlyName(hass, entityId)}`);
  const areas = hass?.areas;
  const areaList = Array.isArray(areas) ? areas : Object.values(areas || {});
  const matched = areaList.find(area => {
    const name = normalizeMatchText(area?.name || area?.area_id || area?.id || "");
    return name && searchable.includes(name);
  });
  return String(matched?.name || matched?.area_id || matched?.id || "").trim();
}

function entityAreaKey(hass, entityId) {
  return normalizeMatchText(entityAreaName(hass, entityId));
}

function entityMatchTokens(hass, entityId) {
  const stopWords = new Set(["sensor", "temperatura", "temperature", "humidity", "humedad", "fan", "ventilador", "weather", "clima"]);
  return normalizeMatchText(`${entityId} ${friendlyName(hass, entityId)}`)
    .split(" ")
    .filter(token => token.length > 2 && !stopWords.has(token));
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

function stateLooksActive(stateObj) {
  const state = String(stateObj?.state || "").toLowerCase();
  return Boolean(state && !["off", "closed", "clear", "idle", "docked", "unavailable", "unknown"].includes(state));
}

function stateIsVacant(stateObj) {
  const state = String(stateObj?.state || "").toLowerCase();
  return ["off", "clear", "not_home", "closed", "0"].includes(state);
}

function minutesSinceChanged(stateObj) {
  const changed = Date.parse(stateObj?.last_changed || stateObj?.last_updated || "");
  return Number.isFinite(changed) ? (Date.now() - changed) / 60000 : 0;
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

function normalizeWeatherForecastResult(raw, entityId) {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (Array.isArray(raw?.forecast)) {
    return raw.forecast;
  }
  if (Array.isArray(raw?.[entityId]?.forecast)) {
    return raw[entityId].forecast;
  }
  return [];
}

function forecastDate(value) {
  return calendarEventDate(value?.datetime || value?.dateTime || value?.date || value?.time || value?.start);
}

function forecastNumber(value, fields) {
  for (const field of fields) {
    const raw = value?.[field];
    const number = Number(raw);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return null;
}

function forecastLooksRainy(row) {
  const condition = normalizeMatchText(row?.condition || row?.state || row?.weather || "");
  if (condition.includes("rain") || condition.includes("lluv") || condition.includes("pouring") || condition.includes("storm")) {
    return true;
  }
  const precipitation = forecastNumber(row, ["precipitation", "rain", "precipitation_amount", "native_precipitation"]);
  return precipitation !== null && precipitation > 0.2;
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
      title: "Notifications",
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
    this._weatherForecasts = {};
    this._weatherRefreshTimer = 0;
    this._weatherRefreshInFlight = false;
    this._lastWeatherRefresh = 0;
    this._lastDismissedHelperState = "";
    this._mobileSent = new Set();
    this._mobileNotifyTimer = 0;
    this._lastRenderSignature = "";
    this._lastNotificationIdsSignature = "";
    this._lastNotifications = [];
    this._animateContentOnNextRender = true;
    this._entranceAnimationTimer = 0;
    this._stackTransition = "";
    this._stackCollapseTimer = 0;
    this._collapsingStack = false;
    this._viewportResizeTimer = 0;
    this._viewVisibilityObserver = null;
    this._wasInViewport = false;
    this._wasHiddenByLayout = false;
    this._lastEntranceReplayAt = 0;
    this._lastRouteKey = "";
    this._onDocVisibility = this._onDocVisibility.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onViewportResize = this._onViewportResize.bind(this);
    this.shadowRoot.addEventListener("click", this._onClick);
  }

  connectedCallback() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this._onDocVisibility);
    }
    this._attachViewVisibilityObserver();
    this._loadDismissed();
    this._loadMobileSent();
    this._syncSharedDismissedFromHass(true);
    this._lastRouteKey = this._getRouteKey();
    // Match entity/weather cards: do not render (or consume entrance) before hass — Lovelace
    // typically attaches the element before the first set(hass), and a pre-hass render would
    // clear _animateContentOnNextRender so the real first paint never gets --enter.
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
    if (this._hass) {
      this._renderIfChanged(true);
    }
    this._refreshCalendarEventsSoon(0);
    this._refreshWeatherForecastsSoon(0);
    window.addEventListener("resize", this._onViewportResize, { passive: true });
    window.addEventListener("orientationchange", this._onViewportResize, { passive: true });
  }

  disconnectedCallback() {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this._onDocVisibility);
    }
    this._detachViewVisibilityObserver();
    window.removeEventListener("resize", this._onViewportResize);
    window.removeEventListener("orientationchange", this._onViewportResize);
    if (this._stackCollapseTimer) {
      window.clearTimeout(this._stackCollapseTimer);
      this._stackCollapseTimer = 0;
    }
    if (this._viewportResizeTimer) {
      window.clearTimeout(this._viewportResizeTimer);
      this._viewportResizeTimer = 0;
    }
    if (this._calendarRefreshTimer) {
      window.clearTimeout(this._calendarRefreshTimer);
      this._calendarRefreshTimer = 0;
    }
    if (this._weatherRefreshTimer) {
      window.clearTimeout(this._weatherRefreshTimer);
      this._weatherRefreshTimer = 0;
    }
    if (this._mobileNotifyTimer) {
      window.clearTimeout(this._mobileNotifyTimer);
      this._mobileNotifyTimer = 0;
    }
    if (this._entranceAnimationTimer) {
      window.clearTimeout(this._entranceAnimationTimer);
      this._entranceAnimationTimer = 0;
    }
  }

  _scheduleEntranceAnimationReset(delay) {
    if (this._entranceAnimationTimer) {
      window.clearTimeout(this._entranceAnimationTimer);
      this._entranceAnimationTimer = 0;
    }

    const safeDelay = clamp(Math.round(Number(delay) || 0), 0, 3000);
    if (!safeDelay || typeof window === "undefined") {
      this._animateContentOnNextRender = false;
      return;
    }

    this._entranceAnimationTimer = window.setTimeout(() => {
      this._entranceAnimationTimer = 0;
      this._animateContentOnNextRender = false;
    }, safeDelay);
  }

  _replayEntranceAnimation(options = {}) {
    const force = options?.force === true;
    const now = Date.now();
    if (!force && now - this._lastEntranceReplayAt < 260) {
      return;
    }
    this._lastEntranceReplayAt = now;
    if (this._entranceAnimationTimer) {
      window.clearTimeout(this._entranceAnimationTimer);
      this._entranceAnimationTimer = 0;
    }
    this._animateContentOnNextRender = true;
    this._lastNotificationIdsSignature = "";
    this._lastRenderSignature = "";
    if (this._hass) {
      this._renderIfChanged(true);
    }
  }

  _getRouteKey() {
    if (typeof window === "undefined" || !window.location) {
      return "";
    }
    const { pathname = "", search = "", hash = "" } = window.location;
    return `${pathname}${search}${hash}`;
  }

  _onDocVisibility() {
    if (typeof document === "undefined" || document.visibilityState !== "visible") {
      return;
    }
    this._replayEntranceAnimation();
  }

  _attachViewVisibilityObserver() {
    if (this._viewVisibilityObserver || typeof IntersectionObserver !== "function") {
      return;
    }
    this._viewVisibilityObserver = new IntersectionObserver(
      entries => {
        const visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0);
        if (visible === this._wasInViewport) {
          return;
        }
        this._wasInViewport = visible;
        if (!visible) {
          this._wasHiddenByLayout = entries.some(entry => {
            const rect = entry.boundingClientRect;
            return rect && rect.width === 0 && rect.height === 0;
          });
          return;
        }
        this._wasHiddenByLayout = false;
        this._replayEntranceAnimation();
      },
      { threshold: [0, 0.01] },
    );
    this._viewVisibilityObserver.observe(this);
  }

  _detachViewVisibilityObserver() {
    if (!this._viewVisibilityObserver) {
      return;
    }
    this._viewVisibilityObserver.disconnect();
    this._viewVisibilityObserver = null;
    this._wasInViewport = false;
    this._wasHiddenByLayout = false;
  }

  _onViewportResize() {
    if (this._viewportResizeTimer) {
      window.clearTimeout(this._viewportResizeTimer);
    }
    this._viewportResizeTimer = window.setTimeout(() => {
      this._viewportResizeTimer = 0;
      this._lastRenderSignature = "";
      this._renderIfChanged(true);
      fireEvent(this, "iron-resize", {});
    }, 160);
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._expanded = false;
    this._animateContentOnNextRender = true;
    this._loadDismissed();
    this._loadMobileSent();
    this._syncSharedDismissedFromHass(true);
    this._lastRenderSignature = "";
    if (this._hass) {
      this._renderIfChanged(true);
    }
    this._refreshCalendarEventsSoon(0);
    this._refreshWeatherForecastsSoon(0);
  }

  set hass(hass) {
    this._hass = hass;
    const nextRouteKey = this._getRouteKey();
    if (nextRouteKey && nextRouteKey !== this._lastRouteKey) {
      this._lastRouteKey = nextRouteKey;
      this._replayEntranceAnimation({ force: true });
    }
    this._syncSharedDismissedFromHass();
    this._refreshCalendarEventsSoon();
    this._refreshWeatherForecastsSoon();
    this._renderIfChanged();
  }

  getCardSize() {
    const count = this._getNotifications().length;
    const hiddenCount = Math.max(0, count - (this._config?.max_visible || 1));
    const collapsedStackDepth = this._expanded ? 0 : Math.min(4, hiddenCount);
    return Math.max(3, Math.min(10, 2 + Math.ceil(Math.min(count, this._expanded ? 5 : 2) * 1.2) + collapsedStackDepth));
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

  _getMobileStorageKey() {
    return `${this._getStorageKey()}:mobile_sent`;
  }

  _dismissKey(id) {
    return notificationHash(id);
  }

  _parseDismissedTokens(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item || "").trim()).filter(Boolean);
      }
    } catch (_error) {
      // Not JSON, continue with compact helper formats.
    }
    const body = raw.startsWith("v1:") ? raw.slice(3) : raw;
    return body
      .split(/[|,\n]/)
      .map(item => String(item || "").trim())
      .filter(Boolean);
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

  _loadMobileSent() {
    if (typeof localStorage === "undefined") {
      this._mobileSent = new Set();
      return;
    }
    try {
      const raw = JSON.parse(localStorage.getItem(this._getMobileStorageKey()) || "[]");
      this._mobileSent = new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch (_error) {
      this._mobileSent = new Set();
    }
  }

  _saveDismissed() {
    if (typeof localStorage === "undefined") {
      this._saveSharedDismissed();
      return;
    }
    try {
      localStorage.setItem(this._getStorageKey(), JSON.stringify([...this._dismissed].slice(-250)));
    } catch (_error) {
      // Ignore storage quota/private mode errors.
    }
    this._saveSharedDismissed();
  }

  _saveMobileSent() {
    if (typeof localStorage === "undefined") {
      return;
    }
    try {
      localStorage.setItem(this._getMobileStorageKey(), JSON.stringify([...this._mobileSent].slice(-180)));
    } catch (_error) {
      // Ignore storage quota/private mode errors.
    }
  }

  _syncSharedDismissedFromHass(force = false) {
    const entityId = this._config.dismissed_entity;
    if (!entityId || !this._hass) {
      return false;
    }
    const rawState = String(this._hass.states?.[entityId]?.state || "").trim();
    if (!force && rawState === this._lastDismissedHelperState) {
      return false;
    }
    this._lastDismissedHelperState = rawState;
    const tokens = this._parseDismissedTokens(rawState);
    if (!tokens.length) {
      return false;
    }
    let changed = false;
    tokens.forEach(token => {
      if (!this._dismissed.has(token)) {
        this._dismissed.add(token);
        changed = true;
      }
    });
    if (changed && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(this._getStorageKey(), JSON.stringify([...this._dismissed].slice(-250)));
      } catch (_error) {
        // Ignore storage quota/private mode errors.
      }
    }
    return changed;
  }

  _saveSharedDismissed() {
    const entityId = this._config.dismissed_entity;
    if (!entityId || !this._hass || typeof this._hass.callService !== "function") {
      return;
    }
    const hashes = [...new Set([...this._dismissed]
      .map(id => (String(id).includes(":") ? this._dismissKey(id) : String(id)))
      .filter(Boolean))]
      .slice(-30);
    const value = hashes.length ? `v1:${hashes.join("|")}` : "";
    if (value === this._lastDismissedHelperState) {
      return;
    }
    this._lastDismissedHelperState = value;
    Promise.resolve(this._hass.callService("input_text", "set_value", {
      entity_id: entityId,
      value,
    })).catch(() => {
      // Helper sync is best-effort; the local dismiss state still applies.
    });
  }

  _calendarDismissalsHydrated() {
    return !this._config.calendar_entities.length || this._lastCalendarRefresh > 0;
  }

  _weatherDismissalsHydrated() {
    return !this._config.weather_entities.length || this._lastWeatherRefresh > 0;
  }

  _canPruneDismissedToken(id) {
    const text = String(id || "");
    if (!text) {
      return true;
    }
    if (!text.includes(":")) {
      return this._calendarDismissalsHydrated() && this._weatherDismissalsHydrated();
    }
    if (text.startsWith("calendar:")) {
      return this._calendarDismissalsHydrated();
    }
    if (text.startsWith("weather:")) {
      return this._weatherDismissalsHydrated();
    }
    return true;
  }

  _pruneDismissed(currentIds) {
    const keep = new Set(currentIds);
    currentIds.forEach(id => keep.add(this._dismissKey(id)));
    let changed = false;
    this._dismissed.forEach(id => {
      if (!this._canPruneDismissedToken(id)) {
        return;
      }
      if (!keep.has(id)) {
        this._dismissed.delete(id);
        changed = true;
      }
    });
    if (changed) {
      this._saveDismissed();
    }
  }

  _isDismissed(item) {
    if (!item?.id) {
      return false;
    }
    return this._dismissed.has(item.id) || this._dismissed.has(this._dismissKey(item.id));
  }

  _refreshCalendarEventsSoon(delay = null) {
    if (!this.isConnected || !this._hass || !this._config.calendar_entities.length) {
      return;
    }
    if (this._calendarRefreshTimer && delay === null) {
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
      this._calendarEvents = [];
      this._calendarError = this._text("messages.calendarQueryFailed", "Could not query calendars.");
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
      this._calendarEvents = [];
      this._calendarError = this._text("messages.calendarTodayLoadFailed", "Could not load today's calendar events.");
    } finally {
      this._calendarLoading = false;
      this._calendarRefreshInFlight = false;
      this._renderIfChanged(true);
      this._refreshCalendarEventsSoon();
    }
  }

  _refreshWeatherForecastsSoon(delay = null) {
    if (!this.isConnected || !this._hass || !this._config.weather_entities.length) {
      return;
    }
    if (this._weatherRefreshTimer && delay === null) {
      return;
    }
    const intervalMs = Math.max(this._config.refresh_interval * 1000, 10 * 60 * 1000);
    const elapsed = Date.now() - this._lastWeatherRefresh;
    const nextDelay = delay === null ? Math.max(0, intervalMs - elapsed) : Math.max(0, delay);
    if (this._weatherRefreshTimer) {
      window.clearTimeout(this._weatherRefreshTimer);
    }
    this._weatherRefreshTimer = window.setTimeout(() => {
      this._weatherRefreshTimer = 0;
      this._refreshWeatherForecasts();
    }, nextDelay);
  }

  async _refreshWeatherForecasts() {
    if (!this._hass || !this._config.weather_entities.length || this._weatherRefreshInFlight) {
      return;
    }
    this._weatherRefreshInFlight = true;
    const next = {};
    const legacyForecasts = () => {
      this._config.weather_entities.forEach(entityId => {
        const rows = normalizeWeatherForecastResult(this._hass.states?.[entityId]?.attributes?.forecast, entityId);
        if (rows.length && !next[entityId]?.length) {
          next[entityId] = rows;
        }
      });
    };
    try {
      if (typeof this._hass.callWS === "function") {
        for (const forecastType of ["hourly", "daily"]) {
          try {
            const response = await this._hass.callWS({
              type: "weather/get_forecasts",
              entity_ids: this._config.weather_entities,
              forecast_type: forecastType,
            });
            this._config.weather_entities.forEach(entityId => {
              const rows = normalizeWeatherForecastResult(response, entityId);
              if (rows.length && !next[entityId]?.length) {
                next[entityId] = rows;
              }
            });
            if (this._config.weather_entities.every(entityId => next[entityId]?.length)) {
              break;
            }
          } catch (_error) {
            // Some weather integrations expose daily but not hourly forecasts.
          }
        }
      }
      legacyForecasts();
      this._weatherForecasts = next;
      this._lastWeatherRefresh = Date.now();
    } catch (_error) {
      legacyForecasts();
      this._weatherForecasts = next;
      this._lastWeatherRefresh = Date.now();
    } finally {
      this._weatherRefreshInFlight = false;
      this._renderIfChanged(true);
      this._refreshWeatherForecastsSoon();
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
      const summary = String(event.summary || event.title || this._text("fallbackEvent", "Event")).trim();
      const allDay = String(event.start?.date || "").length > 0 || (typeof event.start === "string" && event.start.length <= 10);
      const timeText = allDay ? this._text("allDay", "All day") : formatTime(start);
      const startsSoon = !allDay && start.getTime() - now.getTime() <= 90 * 60 * 1000 && start.getTime() >= now.getTime();
      const eventKey = `${event._entity || ""}|${event.uid || event.id || ""}|${start.toISOString()}|${summary}`;
      add({
        id: `calendar:${event._entity}:${notificationHash(`${summary}|${start.toISOString()}`)}`,
        title: startsSoon
          ? this._smartTitle("calendar", "titles.calendarSoon", "Event soon", { source: friendlyName(hass, event._entity), time: timeText, value: summary }, event._entity)
          : this._smartTitle("calendar", "titles.calendarToday", "Event due today", { source: friendlyName(hass, event._entity), time: timeText, value: summary }, event._entity),
        message: this._smartMessage("calendar", "", `${timeText} · ${summary}`, { source: friendlyName(hass, event._entity), time: timeText, value: summary }, event._entity),
        icon: "mdi:calendar-clock",
        severity: startsSoon ? "warning" : "info",
        source: friendlyName(hass, event._entity),
        entity: event._entity,
        tintColor: this._smartTint("calendar", event._entity),
        mobilePolicy: this._smartMobilePolicy(event._entity),
        createdAt: start.getTime(),
        action: this._smartAction("calendar", {
          label: this._text("actions.openCalendar", "Open calendar"),
          type: "calendar-popup",
          entity: event._entity,
          date: start.toISOString(),
          eventKey,
        }, "", event._entity),
      });
    });

    if (this._calendarError) {
      add({
        id: `calendar:error:${notificationHash(this._calendarError)}`,
        title: this._text("titles.calendarUnavailable", "Calendar unavailable"),
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
      const errorState = this._getVacuumErrorState(entityId);
      const errorValue = this._getVacuumErrorValue(errorState);
      const errorLabel = this._translateVacuumError(errorValue);
      if (errorLabel || ["error", "unavailable"].includes(value)) {
        const displayState = errorLabel || this._translateVacuumState(value, state.state);
        add({
          id: `vacuum:${entityId}:${errorValue || value}`,
          title: this._smartTitle("vacuum", "titles.vacuumAttention", "Robot needs attention", { source: name, name, state: displayState }, entityId),
          message: this._smartMessage("vacuum", "messages.vacuumAttention", "{name} is in state {state}.", { source: name, name, state: displayState }, entityId),
          icon: "mdi:robot-vacuum-alert",
          severity: "critical",
          source: name,
          entity: entityId,
          tintColor: this._smartTint("vacuum", entityId),
          mobilePolicy: this._smartMobilePolicy(entityId),
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: this._smartAction("vacuum", { label: this._text("actions.viewRobot", "View robot"), type: "more-info", entity: entityId }, "", entityId),
        });
      } else if (["paused", "idle"].includes(value)) {
        const stateLabel = this._translateVacuumState(value, state.state);
        add({
          id: `vacuum:${entityId}:${value}`,
          title: this._smartTitle("vacuum", "titles.vacuumPaused", "Robot paused", { source: name, name, state: stateLabel }, entityId),
          message: this._smartMessage("vacuum", "messages.vacuumPaused", "{name} is paused or waiting.", { source: name, name, state: stateLabel }, entityId),
          icon: "mdi:pause-circle-outline",
          severity: "warning",
          source: name,
          entity: entityId,
          tintColor: this._smartTint("vacuum", entityId),
          mobilePolicy: this._smartMobilePolicy(entityId),
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: this._smartAction("vacuum", { label: this._text("actions.continue", "Continue"), type: "service", service: "vacuum.start", entity: entityId, internal: true }, "", entityId),
        });
      } else if (["cleaning", "returning"].includes(value)) {
        const stateLabel = this._translateVacuumState(value, state.state);
        add({
          id: `vacuum:${entityId}:${value}`,
          title: value === "cleaning"
            ? this._smartTitle("vacuum", "titles.cleaningStarted", "Cleaning started", { source: name, name, state: stateLabel }, entityId)
            : this._smartTitle("vacuum", "titles.returningDock", "Robot returning to dock", { source: name, name, state: stateLabel }, entityId),
          message: this._smartMessage("vacuum", "messages.vacuumState", "{name}: {state}.", { source: name, name, state: stateLabel }, entityId),
          icon: value === "cleaning" ? "mdi:robot-vacuum" : "mdi:home-import-outline",
          severity: "info",
          source: name,
          entity: entityId,
          tintColor: this._smartTint("vacuum", entityId),
          mobilePolicy: this._smartMobilePolicy(entityId),
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: this._smartAction("vacuum", { label: this._text("actions.viewRobot", "View robot"), type: "more-info", entity: entityId }, "", entityId),
        });
      }
    });

    this._config.motion_entities.forEach(entityId => {
      const state = hass?.states?.[entityId];
      if (stateIsOn(state)) {
        const sourceName = friendlyName(hass, entityId);
        add({
          id: `motion:${entityId}:${state.state}`,
          title: this._smartTitle("motion", "titles.motionDetected", "Motion detected", { source: sourceName }, entityId),
          message: this._smartMessage("motion", "", sourceName, { source: sourceName }, entityId),
          icon: "mdi:motion-sensor",
          severity: "info",
          source: sourceName,
          entity: entityId,
          tintColor: this._smartTint("motion", entityId),
          mobilePolicy: this._smartMobilePolicy(entityId),
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: this._smartAction("motion", { label: this._text("actions.viewSensor", "View sensor"), type: "more-info", entity: entityId }, "", entityId),
        });
      }
    });

    [
      ["door", this._config.door_entities, "titles.doorOpen", "Door open", "mdi:door-open"],
      ["window", this._config.window_entities, "titles.windowOpen", "Window open", "mdi:window-open-variant"],
    ].forEach(([kind, entities, titleKey, fallbackTitle, icon]) => {
      entities.forEach(entityId => {
        const state = hass?.states?.[entityId];
        if (stateIsOn(state)) {
          const sourceName = friendlyName(hass, entityId);
          add({
            id: `${kind}:${entityId}:${state.state}`,
            title: this._smartTitle(kind, titleKey, fallbackTitle, { source: sourceName }, entityId),
            message: this._smartMessage(kind, "", sourceName, { source: sourceName }, entityId),
            icon,
            severity: "warning",
            source: sourceName,
            entity: entityId,
            tintColor: this._smartTint(kind, entityId),
            mobilePolicy: this._smartMobilePolicy(entityId),
            createdAt: Date.parse(state.last_changed || "") || Date.now(),
            action: this._smartAction(kind, { label: this._text("actions.viewSensor", "View sensor"), type: "more-info", entity: entityId }, "", entityId),
          });
        }
      });
    });

    this._buildComfortNotifications(add);
    this._buildMediaPlayerPresenceNotifications(add);
    this._buildWeatherNotifications(add);
    this._buildLevelNotifications(add);
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
    const hotCandidates = tempSources
      .filter(item => item.value >= this._config.thresholds.hot_temperature)
      .map(item => ({ ...item, fanTarget: this._getFanTargetForSource(item.entityId) }))
      .filter(item => item.fanTarget)
      .sort((left, right) => right.value - left.value);
    const hottest = hotCandidates[0] || [...tempSources].sort((left, right) => right.value - left.value)[0];
    const coolingClimateTarget = hottest?.value >= this._config.thresholds.hot_temperature
      ? this._getClimateTargetForSource(hottest.entityId, "cool")
      : null;
    const coldest = [...tempSources].sort((left, right) => left.value - right.value)[0];
    const heatingClimateTarget = coldest?.value <= this._config.thresholds.cold_temperature
      ? this._getClimateTargetForSource(coldest.entityId, "heat")
      : null;
    if (hottest && hottest.value >= this._config.thresholds.hot_temperature && hottest.fanTarget) {
      const sourceName = friendlyName(this._hass, hottest.entityId);
      const fanName = friendlyName(this._hass, hottest.fanTarget);
      add({
        id: `comfort:hot:${hottest.entityId}:${hottest.fanTarget}:${Math.floor(hottest.value)}`,
        title: this._smartTitle("hot", "titles.hot", "Hot inside", { source: sourceName, value: formatNumber(hottest.value, hottest.unit), fan: fanName }, hottest.entityId),
        message: this._smartMessage("hot", "messages.hot", "{source} reads {value}. You can turn on {fan}.", {
          source: sourceName,
          value: formatNumber(hottest.value, hottest.unit),
          fan: fanName,
        }, hottest.entityId),
        icon: "mdi:fan",
        severity: "warning",
        source: sourceName,
        entity: hottest.entityId,
        tintColor: this._smartTint("hot", hottest.entityId),
        mobilePolicy: this._smartMobilePolicy(hottest.entityId),
        createdAt: Date.parse(hottest.state.last_changed || "") || Date.now(),
        action: this._smartAction("hot", { label: this._text("actions.turnOnFan", "Turn on fan"), type: "service", service: "fan.turn_on", entity: hottest.fanTarget, internal: true }, "", hottest.entityId),
      });
    } else if (hottest && hottest.value >= this._config.thresholds.hot_temperature && coolingClimateTarget) {
      const sourceName = friendlyName(this._hass, hottest.entityId);
      const climateName = friendlyName(this._hass, coolingClimateTarget);
      add({
        id: `comfort:hot:climate:${hottest.entityId}:${coolingClimateTarget}:${Math.floor(hottest.value)}`,
        title: this._smartTitle("hot", "titles.hot", "Hot inside", { source: sourceName, value: formatNumber(hottest.value, hottest.unit), climate: climateName, fan: climateName }, hottest.entityId),
        message: this._smartMessage("hot", "messages.hotClimate", "{source} reads {value}. You can enable cooling on {climate}.", {
          source: sourceName,
          value: formatNumber(hottest.value, hottest.unit),
          climate: climateName,
          fan: climateName,
        }, hottest.entityId),
        icon: "mdi:snowflake",
        severity: "warning",
        source: sourceName,
        entity: hottest.entityId,
        tintColor: this._smartTint("hot", hottest.entityId),
        mobilePolicy: this._smartMobilePolicy(hottest.entityId),
        createdAt: Date.parse(hottest.state.last_changed || "") || Date.now(),
        action: this._smartAction("hot", { label: this._text("actions.turnOnCooling", "Enable cooling"), type: "service", service: "climate.set_hvac_mode", entity: coolingClimateTarget, serviceData: { hvac_mode: "cool" }, internal: true }, "", hottest.entityId),
      });
    } else if (coldest && coldest.value <= this._config.thresholds.cold_temperature) {
      const sourceName = friendlyName(this._hass, coldest.entityId);
      add({
        id: `comfort:cold:${coldest.entityId}:${Math.floor(coldest.value)}`,
        title: this._smartTitle("cold", "titles.cold", "Low temperature", { source: sourceName, value: formatNumber(coldest.value, coldest.unit) }, coldest.entityId),
        message: this._smartMessage("cold", "messages.sensorValue", "{source} reads {value}.", {
          source: sourceName,
          value: formatNumber(coldest.value, coldest.unit),
        }, coldest.entityId),
        icon: "mdi:thermometer-low",
        severity: "info",
        source: sourceName,
        entity: coldest.entityId,
        tintColor: this._smartTint("cold", coldest.entityId),
        mobilePolicy: this._smartMobilePolicy(coldest.entityId),
        createdAt: Date.parse(coldest.state.last_changed || "") || Date.now(),
        action: this._smartAction("cold", heatingClimateTarget ? { label: this._text("actions.turnOnHeat", "Enable heating"), type: "service", service: "climate.set_hvac_mode", entity: heatingClimateTarget, serviceData: { hvac_mode: "heat" }, internal: true } : null, "", coldest.entityId),
      });
    }

    this._config.humidity_entities.forEach(entityId => {
      const state = this._hass.states?.[entityId];
      const value = numericState(state);
      if (value === null) {
        return;
      }
      if (value >= this._config.thresholds.humidity_high || value <= this._config.thresholds.humidity_low) {
        const high = value >= this._config.thresholds.humidity_high;
        const sourceName = friendlyName(this._hass, entityId);
        const smartKind = high ? "humidity_high" : "humidity_low";
        const dehumidifierTarget = high ? this._getHumidifierTargetForSource(entityId, "dehumidifier") : null;
        add({
          id: `humidity:${entityId}:${high ? "high" : "low"}:${Math.round(value)}`,
          title: high
            ? this._smartTitle(smartKind, "titles.humidityHigh", "High humidity", { source: sourceName, value: formatNumber(value, state.attributes?.unit_of_measurement || "%") }, entityId)
            : this._smartTitle(smartKind, "titles.humidityLow", "Low humidity", { source: sourceName, value: formatNumber(value, state.attributes?.unit_of_measurement || "%") }, entityId),
          message: this._smartMessage(smartKind, "messages.sensorValue", "{source} reads {value}.", {
            source: sourceName,
            value: formatNumber(value, state.attributes?.unit_of_measurement || "%"),
          }, entityId),
          icon: high ? "mdi:water-percent-alert" : "mdi:water-percent",
          severity: high ? "warning" : "info",
          source: sourceName,
          entity: entityId,
          tintColor: this._smartTint(smartKind, entityId),
          mobilePolicy: this._smartMobilePolicy(entityId),
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: this._smartAction(
            smartKind,
            dehumidifierTarget
              ? { label: this._text("actions.turnOnDehumidifier", "Turn on dehumidifier"), type: "service", service: "humidifier.turn_on", entity: dehumidifierTarget, internal: true }
              : { label: this._text("actions.viewSensor", "View sensor"), type: "more-info", entity: entityId },
            "",
            entityId,
          ),
        });
      }
    });
  }

  _translateVacuumState(stateKey, fallback = "") {
    return window.NodaliaI18n?.translateAdvanceVacuumReportedState
      ? window.NodaliaI18n.translateAdvanceVacuumReportedState(this._hass, this._config?.language ?? "auto", stateKey, fallback)
      : fallback;
  }

  _translateVacuumError(errorValue) {
    return window.NodaliaI18n?.translateVacuumErrorState
      ? window.NodaliaI18n.translateVacuumErrorState(this._hass, this._config?.language ?? "auto", errorValue, "")
      : "";
  }

  _getVacuumErrorValue(stateObj) {
    const raw = String(stateObj?.state || "").trim();
    if (!raw || !window.NodaliaI18n?.isVacuumErrorState?.(raw)) {
      return "";
    }
    return raw;
  }

  _getVacuumErrorState(vacuumEntityId) {
    const explicit = this._config.vacuum_error_entities
      .map(entityId => this._hass?.states?.[entityId])
      .find(stateObj => this._getVacuumErrorValue(stateObj));
    if (explicit) {
      return explicit;
    }
    const vacuumObject = String(vacuumEntityId || "").split(".")[1] || "";
    if (!vacuumObject || !this._hass?.states) {
      return null;
    }
    const candidates = Object.keys(this._hass.states)
      .filter(entityId => entityId.startsWith("sensor."))
      .filter(entityId => entityId.includes(vacuumObject) || entityId.includes("roborock"))
      .filter(entityId => ["error", "fault", "fallo", "erro"].some(token => entityId.includes(token)))
      .sort((left, right) => left.localeCompare(right, "es"));
    return candidates.map(entityId => this._hass.states[entityId]).find(stateObj => this._getVacuumErrorValue(stateObj)) || null;
  }

  _getFanTargetForSource(sourceEntityId) {
    const offFans = this._config.fan_entities.filter(entityId => stateIsOff(this._hass?.states?.[entityId]));
    if (!offFans.length) {
      return null;
    }
    const sourceArea = entityAreaKey(this._hass, sourceEntityId);
    if (sourceArea) {
      const sameArea = offFans.find(entityId => entityAreaKey(this._hass, entityId) === sourceArea);
      return sameArea || null;
    }
    const sourceTokens = new Set(entityMatchTokens(this._hass, sourceEntityId));
    const tokenMatch = offFans.find(entityId => entityMatchTokens(this._hass, entityId).some(token => sourceTokens.has(token)));
    if (tokenMatch) {
      return tokenMatch;
    }
    return offFans.length === 1 ? offFans[0] : null;
  }

  _sameAreaTarget(sourceEntityId, entities, predicate = () => true) {
    const candidates = entities.filter(entityId => predicate(entityId, this._hass?.states?.[entityId]));
    if (!candidates.length) {
      return null;
    }
    const sourceArea = entityAreaKey(this._hass, sourceEntityId);
    if (sourceArea) {
      const sameArea = candidates.find(entityId => entityAreaKey(this._hass, entityId) === sourceArea);
      return sameArea || null;
    }
    const sourceTokens = new Set(entityMatchTokens(this._hass, sourceEntityId));
    const tokenMatch = candidates.find(entityId => entityMatchTokens(this._hass, entityId).some(token => sourceTokens.has(token)));
    return tokenMatch || (candidates.length === 1 ? candidates[0] : null);
  }

  _getClimateTargetForSource(sourceEntityId, mode) {
    return this._sameAreaTarget(sourceEntityId, this._config.climate_entities, (_entityId, stateObj) => {
      const modes = Array.isArray(stateObj?.attributes?.hvac_modes) ? stateObj.attributes.hvac_modes.map(item => String(item).toLowerCase()) : [];
      return modes.includes(mode) && ["off", "idle", "unknown", "unavailable"].includes(String(stateObj?.state || "").toLowerCase());
    });
  }

  _getHumidifierTargetForSource(sourceEntityId, deviceClass = "dehumidifier") {
    return this._sameAreaTarget(sourceEntityId, this._config.humidifier_entities, (_entityId, stateObj) => {
      const klass = normalizeMatchText(stateObj?.attributes?.device_class || "");
      return klass === deviceClass && stateIsOff(stateObj);
    });
  }

  _buildMediaPlayerPresenceNotifications(add) {
    if (!this._config.smart_recommendations || !this._hass || !this._config.media_player_entities.length || !this._config.motion_entities.length) {
      return;
    }
    const vacantSensors = this._config.motion_entities
      .map(entityId => ({ entityId, state: this._hass.states?.[entityId] }))
      .filter(item => stateIsVacant(item.state) && minutesSinceChanged(item.state) >= this._config.thresholds.media_absence_minutes);
    vacantSensors.forEach(sensor => {
      const mediaTarget = this._sameAreaTarget(sensor.entityId, this._config.media_player_entities, (_entityId, stateObj) => {
        const state = String(stateObj?.state || "").toLowerCase();
        return ["on", "playing", "paused", "idle", "standby"].includes(state);
      });
      if (!mediaTarget) {
        return;
      }
      const sourceName = friendlyName(this._hass, sensor.entityId);
      const mediaName = friendlyName(this._hass, mediaTarget);
      add({
        id: `media-left-on:${sensor.entityId}:${mediaTarget}:${String(this._hass.states?.[mediaTarget]?.state || "")}`,
        title: this._smartTitle("media_left_on", "titles.mediaLeftOn", "Media on with no presence", { source: sourceName, media: mediaName }, mediaTarget),
        message: this._smartMessage("media_left_on", "messages.mediaLeftOn", "{media} is still on and {source} shows no presence.", { source: sourceName, media: mediaName }, mediaTarget),
        icon: "mdi:television-off",
        severity: "warning",
        source: mediaName,
        entity: mediaTarget,
        tintColor: this._smartTint("media_left_on", mediaTarget),
        mobilePolicy: this._smartMobilePolicy(mediaTarget),
        createdAt: Date.now(),
        action: this._smartAction("media_left_on", { label: this._text("actions.turnOff", "Turn off"), type: "service", service: "media_player.turn_off", entity: mediaTarget, internal: true }, "", mediaTarget),
      });
    });
  }

  _formatTemplate(template, values = {}) {
    return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
      const value = values?.[key];
      return value === undefined || value === null ? "" : String(value);
    });
  }

  _smartEntityOverride(entityId) {
    const target = String(entityId || "").trim();
    if (!target) {
      return null;
    }
    return (this._config.smart_entity_overrides || []).find(item => item.entity === target) || null;
  }

  _smartConfig(kind, entityId = "") {
    const base = this._config.smart_notifications?.[kind] || {};
    const override = this._smartEntityOverride(entityId);
    if (!override) {
      return base;
    }
    return {
      ...base,
      ...Object.fromEntries(
        ["title", "message", "tint_color", "url", "action_label"]
          .map(key => [key, override[key]])
          .filter(([, value]) => String(value || "").trim()),
      ),
      mobile: override.mobile || "inherit",
    };
  }

  _smartTitle(kind, path, fallback, values = {}, entityId = "") {
    const configured = this._smartConfig(kind, entityId).title;
    return configured ? this._formatTemplate(configured, values) : this._text(path, fallback, values);
  }

  _smartMessage(kind, path, fallback, values = {}, entityId = "") {
    const configured = this._smartConfig(kind, entityId).message;
    return configured ? this._formatTemplate(configured, values) : this._text(path, fallback, values);
  }

  _smartTint(kind, entityId = "") {
    return this._smartConfig(kind, entityId).tint_color || "";
  }

  _smartAction(kind, fallbackAction = null, fallbackUrlLabel = "", entityId = "") {
    const config = this._smartConfig(kind, entityId);
    const url = window.NodaliaUtils?.sanitizeActionUrl?.(config.url, { allowRelative: true }) || "";
    if (url) {
      return {
        label: config.action_label || fallbackUrlLabel || this._text("actions.open", "Open"),
        type: "url",
        url,
      };
    }
    return fallbackAction;
  }

  _smartMobilePolicy(entityId) {
    const override = this._smartEntityOverride(entityId);
    return override?.mobile || "inherit";
  }

  _buildWeatherNotifications(add) {
    if (!this._config.smart_recommendations || !this._hass || !this._config.weather_entities.length) {
      return;
    }
    const now = Date.now();
    const lookaheadMs = this._config.thresholds.rain_lookahead_hours * 60 * 60 * 1000;
    this._config.weather_entities.forEach(entityId => {
      const rows = (this._weatherForecasts?.[entityId] || normalizeWeatherForecastResult(this._hass.states?.[entityId]?.attributes?.forecast, entityId))
        .map(row => ({ row, date: forecastDate(row) }))
        .filter(item => item.date && item.date.getTime() >= now && item.date.getTime() <= now + lookaheadMs)
        .sort((left, right) => left.date.getTime() - right.date.getTime());
      const rainy = rows.find(({ row }) => {
        const probability = forecastNumber(row, [
          "precipitation_probability",
          "precipitationProbability",
          "probability_of_precipitation",
          "rain_probability",
        ]);
        return forecastLooksRainy(row) || (probability !== null && probability >= this._config.thresholds.rain_probability);
      });
      if (!rainy) {
        return;
      }
      const sourceName = friendlyName(this._hass, entityId);
      add({
        id: `weather:rain:${entityId}:${rainy.date.toISOString().slice(0, 13)}`,
        title: this._smartTitle("rain", "titles.rainSoon", "Rain soon", { source: sourceName, time: formatTime(rainy.date) }, entityId),
        message: this._smartMessage("rain", "messages.rainSoon", "{source} expects rain around {time}. If laundry is outside, it is worth checking.", {
          source: sourceName,
          time: formatTime(rainy.date),
        }, entityId),
        icon: "mdi:weather-pouring",
        severity: "warning",
        source: sourceName,
        entity: entityId,
        tintColor: this._smartTint("rain", entityId),
        mobilePolicy: this._smartMobilePolicy(entityId),
        createdAt: rainy.date.getTime(),
        action: this._smartAction("rain", { label: this._text("actions.viewWeather", "View weather"), type: "more-info", entity: entityId }, "", entityId),
      });
    });
  }

  _buildLevelNotifications(add) {
    if (!this._config.smart_recommendations || !this._hass) {
      return;
    }
    const groups = [
      {
        entities: this._config.battery_entities,
        icon: "mdi:battery-alert-variant-outline",
        kind: "battery_low",
        titleKey: "titles.batteryLow",
        titleFallback: "Low battery",
        messageKey: "messages.lowLevel",
        messageFallback: "{source} is at {value}.",
        threshold: this._config.thresholds.battery_low,
        urlLabel: this._text("actions.buyBattery", "Buy batteries"),
      },
      {
        entities: this._config.humidifier_fill_entities,
        icon: "mdi:air-humidifier",
        kind: "humidifier_fill_low",
        titleKey: "titles.humidifierFillLow",
        titleFallback: "Low tank",
        messageKey: "messages.lowLevel",
        messageFallback: "{source} is at {value}.",
        threshold: this._config.thresholds.humidifier_fill_low,
        urlLabel: this._text("actions.open", "Open"),
      },
      {
        entities: this._config.ink_entities,
        icon: "mdi:printer-alert",
        kind: "ink_low",
        titleKey: "titles.inkLow",
        titleFallback: "Low ink",
        messageKey: "messages.lowLevel",
        messageFallback: "{source} is at {value}.",
        threshold: this._config.thresholds.ink_low,
        urlLabel: this._text("actions.buyInk", "Buy ink"),
      },
    ];
    groups.forEach(group => {
      group.entities.forEach(entityId => {
        const state = this._hass.states?.[entityId];
        const value = numericState(state);
        if (!state || value === null || value > group.threshold) {
          return;
        }
        const sourceName = friendlyName(this._hass, entityId);
        const unit = state.attributes?.unit_of_measurement || "%";
        const formattedValue = formatNumber(value, unit);
        add({
          id: `${group.kind}:${entityId}:${Math.round(value)}`,
          title: this._smartTitle(group.kind, group.titleKey, group.titleFallback, {
            source: sourceName,
            threshold: formatNumber(group.threshold, unit),
            value: formattedValue,
          }, entityId),
          message: this._smartMessage(group.kind, group.messageKey, group.messageFallback, {
            source: sourceName,
            threshold: formatNumber(group.threshold, unit),
            value: formattedValue,
          }, entityId),
          icon: group.icon,
          severity: "warning",
          source: sourceName,
          entity: entityId,
          tintColor: this._smartTint(group.kind, entityId),
          mobilePolicy: this._smartMobilePolicy(entityId),
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: this._smartAction(group.kind, { label: this._text("actions.viewSensor", "View sensor"), type: "more-info", entity: entityId }, group.urlLabel, entityId),
        });
      });
    });
  }

  _buildCustomNotifications(add) {
    this._config.custom_notifications.forEach(item => {
      if (!item.title && !item.message && !item.entity) {
        return;
      }
      if (!this._customNotificationMatches(item)) {
        return;
      }
      const entityName = item.entity ? friendlyName(this._hass, item.entity) : "";
      add({
        id: `custom:${notificationHash(`${item.title}|${item.message}|${item.entity}|${item.attribute}|${item.condition}|${item.value}|${item.url}`)}`,
        title: item.title || entityName || this._text("titles.customFallback", "Notification"),
        message: item.message || entityName,
        icon: item.icon || "mdi:bell-outline",
        tintColor: item.tint_color || "",
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
      label: item.action_label || (type === "service" ? this._text("actions.run", "Run") : type === "toggle" ? this._text("actions.toggle", "Toggle") : this._text("actions.open", "Open")),
      type,
      entity: item.entity,
      service: item.service,
      serviceData: parseServiceData(item.service_data),
      url: item.url,
    };
  }

  _severityScore(severity) {
    return { critical: 4, warning: 3, success: 2, info: 1 }[normalizeSeverity(severity)] || 1;
  }

  _shouldSendMobileNotification(item) {
    const config = this._config.mobile_notifications;
    const policy = String(item?.mobilePolicy || "inherit").toLowerCase();
    if (policy === "off") {
      return false;
    }
    const targets = [
      ...(Array.isArray(config?.entities) ? config.entities : []),
      ...(Array.isArray(config?.services) ? config.services : []),
    ];
    if ((!config?.enabled && policy !== "on") || !targets.length || !item?.id) {
      return false;
    }
    if (this._severityScore(item.severity) < this._severityScore(config.min_severity)) {
      return false;
    }
    return !this._mobileSent.has(this._dismissKey(item.id));
  }

  _queueMobileNotifications(items) {
    const pending = items.filter(item => this._shouldSendMobileNotification(item));
    if (!pending.length || this._mobileNotifyTimer) {
      return;
    }
    this._mobileNotifyTimer = window.setTimeout(() => {
      this._mobileNotifyTimer = 0;
      this._flushMobileNotifications(pending.slice(0, 4));
    }, 450);
  }

  _buildLegacyMobilePayload(item, hash) {
    const payload = {
      title: item.title,
      message: item.message || item.source || item.title,
      data: {
        group: "nodalia_notifications",
        tag: hash,
      },
    };
    if (this._config.mobile_notifications?.critical_alerts === true && item?.severity === "critical") {
      payload.data = {
        ...payload.data,
        ttl: 0,
        priority: "high",
        channel: "alarm_stream",
        push: {
          sound: {
            name: "default",
            critical: 1,
            volume: 1,
          },
        },
      };
    }
    return payload;
  }

  async _flushMobileNotifications(items) {
    if (!this._hass || typeof this._hass.callService !== "function") {
      return;
    }
    for (const item of items) {
      const hash = this._dismissKey(item.id);
      if (this._mobileSent.has(hash) || this._isDismissed(item)) {
        continue;
      }
      const legacyPayload = this._buildLegacyMobilePayload(item, hash);
      const notifyEntities = Array.isArray(this._config.mobile_notifications.entities)
        ? this._config.mobile_notifications.entities
        : [];
      const legacyServices = Array.isArray(this._config.mobile_notifications.services)
        ? this._config.mobile_notifications.services
        : [];
      const entityPayload = {
        entity_id: notifyEntities,
        title: legacyPayload.title,
        message: legacyPayload.message,
      };
      await Promise.all([
        notifyEntities.length
          ? Promise.resolve(this._hass.callService("notify", "send_message", entityPayload)).then(() => true, () => false)
          : Promise.resolve(false),
        ...legacyServices.map(service => (
          Promise.resolve(this._callNamedService(service, legacyPayload)).then(() => true, () => false)
        )),
      ]).then(results => {
        const delivered = results.some(Boolean);
        if (delivered) {
          this._mobileSent.add(hash);
        }
      });
    }
    this._saveMobileSent();
  }

  _getNotifications(options = {}) {
    const raw = this._getRawNotifications();
    this._pruneDismissed(raw.map(item => item.id));
    const visible = raw.filter(item => !this._isDismissed(item));
    this._lastNotifications = visible;
    if (options.notifyMobile === true) {
      this._queueMobileNotifications(visible);
    }
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
      Object.entries(this._weatherForecasts || {}).map(([entityId, rows]) => `${entityId}:${(rows || []).slice(0, 12).map(row => `${row?.datetime || row?.dateTime || row?.date || ""}:${row?.condition || ""}:${row?.precipitation_probability ?? row?.precipitationProbability ?? ""}`).join(",")}`).join("|"),
    ];
    const tracked = [
      ...this._config.vacuum_entities,
      ...this._config.vacuum_error_entities,
      ...this._config.fan_entities,
      ...this._config.climate_entities,
      ...this._config.humidifier_entities,
      ...this._config.media_player_entities,
      ...this._config.weather_entities,
      ...this._config.motion_entities,
      ...this._config.door_entities,
      ...this._config.window_entities,
      ...this._config.temperature_entities,
      ...this._config.humidity_entities,
      ...this._config.battery_entities,
      ...this._config.humidifier_fill_entities,
      ...this._config.ink_entities,
      ...this._config.custom_notifications.map(item => item.entity).filter(Boolean),
    ];
    parts.push(this._config.language || "auto");
    parts.push(
      (typeof window !== "undefined" && window.NodaliaI18n?.resolveLanguage?.(hass, this._config.language || "auto")) || "",
    );
    tracked.forEach(entityId => {
      const state = hass?.states?.[entityId];
      const attrs = state?.attributes || {};
      const attrSignature = [
        attrs.friendly_name || "",
        attrs.icon || "",
        attrs.device_class || "",
        attrs.unit_of_measurement || "",
        attrs.temperature ?? "",
        attrs.current_temperature ?? "",
        attrs.humidity ?? "",
        attrs.current_humidity ?? "",
        attrs.hvac_action || "",
        attrs.hvac_mode || "",
        attrs.fan_mode || "",
        attrs.preset_mode || "",
        attrs.percentage ?? "",
        attrs.battery_level ?? "",
        attrs.source || "",
        attrs.media_title || "",
        attrs.media_artist || "",
      ].join("~");
      parts.push(`${entityId}:${state?.state || ""}:${state?.last_changed || ""}:${attrSignature}`);
    });
    this._config.vacuum_entities.forEach(entityId => {
      const errorState = this._getVacuumErrorState(entityId);
      parts.push(`vacuum-error:${entityId}:${errorState?.entity_id || ""}:${errorState?.state || ""}:${errorState?.last_changed || ""}`);
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

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;
    return {
      enabled: configuredAnimations.enabled !== false,
      contentDuration: clamp(
        Number(configuredAnimations.content_duration) || DEFAULT_CONFIG.animations.content_duration,
        120,
        1800,
      ),
      buttonBounceDuration: clamp(
        Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration,
        120,
        1200,
      ),
    };
  }

  _triggerPressAnimation(element) {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    const animations = this._getAnimationSettings();
    if (!animations.enabled) {
      return;
    }
    element.classList.remove("is-pressing");
    element.getBoundingClientRect();
    element.classList.add("is-pressing");
    window.setTimeout(() => {
      element.classList.remove("is-pressing");
    }, animations.buttonBounceDuration + 40);
  }

  _text(path, fallback = "", values = {}) {
    const i18n = typeof window !== "undefined" ? window.NodaliaI18n : null;
    if (typeof i18n?.translateNotificationsUi === "function") {
      return i18n.translateNotificationsUi(this._hass, this._config?.language ?? "auto", path, fallback, values);
    }
    return String(fallback || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
      const value = values?.[key];
      return value === undefined || value === null ? "" : String(value);
    });
  }

  _onClick(event) {
    const button = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.action);
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this._triggerPressAnimation(button);
    const action = button.dataset.action;
    if (action === "toggle-stack") {
      if (this._stackCollapseTimer) {
        window.clearTimeout(this._stackCollapseTimer);
        this._stackCollapseTimer = 0;
      }
      const animations = this._getAnimationSettings();
      if (this._expanded && animations.enabled) {
        this._collapsingStack = true;
        this._stackTransition = "collapse";
        this._triggerHaptic("selection");
        this._renderIfChanged(true);
        const collapseMs = Math.max(140, Math.round(animations.contentDuration * 0.68));
        this._stackCollapseTimer = window.setTimeout(() => {
          this._stackCollapseTimer = 0;
          this._expanded = false;
          this._collapsingStack = false;
          this._stackTransition = "collapse-final";
          this._renderIfChanged(true);
        }, collapseMs);
        return;
      }
      this._collapsingStack = false;
      this._expanded = !this._expanded;
      this._stackTransition = this._expanded ? "expand" : "collapse-final";
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
    if (action.type === "calendar-popup") {
      const detail = {
        entity_id: action.entity || "",
        date: action.date || "",
        event_key: action.eventKey || "",
        source: CARD_TAG,
      };
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("nodalia-calendar-card-open", {
          bubbles: false,
          cancelable: true,
          composed: false,
          detail,
        }));
      }
      return;
    }
    if (action.type === "url" && action.url) {
      const url = window.NodaliaUtils?.sanitizeActionUrl?.(action.url, { allowRelative: true }) || "";
      if (url && typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return;
    }
    if (action.type === "toggle" && action.entity && typeof this._hass.callService === "function") {
      const data = { entity_id: action.entity };
      if (action.internal === true) {
        await this._callInternalService("homeassistant.toggle", data);
      } else {
        await this._callNamedService("homeassistant.toggle", data);
      }
      return;
    }
    if (action.type === "service" && action.service && typeof this._hass.callService === "function") {
      const data = {
        ...(action.serviceData || {}),
        ...(action.entity ? { entity_id: action.entity } : {}),
      };
      if (action.internal === true) {
        await this._callInternalService(action.service, data);
      } else {
        await this._callNamedService(action.service, data);
      }
    }
  }

  _isServiceAllowed(serviceValue) {
    const security = this._config?.security || {};
    if (security.strict_service_actions !== true) {
      return true;
    }
    const normalizedService = String(serviceValue || "").trim().toLowerCase();
    if (!normalizedService || !normalizedService.includes(".")) {
      return false;
    }
    const [domain] = normalizedService.split(".");
    const domains = security.allowed_service_domains || [];
    const services = security.allowed_services || [];
    if (!domains.length && !services.length) {
      return false;
    }
    return services.includes(normalizedService) || domains.includes(domain);
  }

  _callNamedService(serviceValue, data = {}, target = null) {
    if (!this._hass || typeof this._hass.callService !== "function") {
      return Promise.resolve();
    }
    if (!this._isServiceAllowed(serviceValue)) {
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Notifications Card", serviceValue);
      return Promise.resolve();
    }
    const [domain, service] = String(serviceValue || "").split(".");
    if (!domain || !service) {
      return Promise.resolve();
    }
    return this._hass.callService(domain, service, data, target || undefined);
  }

  _callInternalService(serviceValue, data = {}, target = null) {
    if (!this._hass || typeof this._hass.callService !== "function") {
      return Promise.resolve();
    }
    const [domain, service] = String(serviceValue || "").split(".");
    if (!domain || !service) {
      return Promise.resolve();
    }
    return this._hass.callService(domain, service, data, target || undefined);
  }

  _notificationChips(item) {
    const chips = [];
    if (item?.severity && item.severity !== "info") {
      chips.push({ kind: "state", label: this._severityLabel(item.severity) });
    }
    return chips;
  }

  _severityAccent(severity) {
    switch (severity) {
      case "critical":
        return "var(--error-color, #db4437)";
      case "warning":
        return "var(--warning-color, #f59e0b)";
      case "success":
        return "var(--success-color, #43a047)";
      default:
        return sanitizeCssRuntimeValue(this._config.styles.accent, DEFAULT_CONFIG.styles.accent);
    }
  }

  _renderNotification(item, options = {}) {
    const action = item.action;
    const primary = options.primary === true;
    const tint = item.tintColor ? sanitizeCssRuntimeValue(item.tintColor, "") : "";
    const chips = this._notificationChips(item);
    const accent = tint || this._severityAccent(item.severity);
    const stateForIcon = this._hass?.states?.[item.entity || action?.entity];
    const darkenIcon = shouldDarkenNotificationIconGlyph(stateForIcon, accent);
    const iconColor = darkenIcon ? `color-mix(in srgb, var(--primary-text-color) 60%, ${accent})` : "var(--notification-accent)";
    const index = Math.max(0, Number(options.index) || 0);
    const exiting = options.exiting === true;
    const exitIndex = Math.max(0, Number(options.exitIndex) || 0);
    return `
      <article class="notification-item notification-item--${escapeHtml(item.severity)} ${primary ? "notification-item--primary" : ""} ${exiting ? "notification-item--collapsing-tail" : ""}" style="${tint ? `--notification-accent:${escapeHtml(tint)};` : ""}--notification-icon-color:${escapeHtml(iconColor)}; --notification-index:${index}; --notification-exit-index:${exitIndex};">
        <div class="notification-item__icon">
          <ha-icon icon="${escapeHtml(item.icon)}"></ha-icon>
        </div>
        <div class="notification-item__body">
          <div class="notification-item__title-row">
            <div class="notification-item__title">${escapeHtml(item.title)}</div>
            ${chips.length ? `<div class="notification-item__chips notification-item__chips--top">
              ${chips.map(chip => `<span class="notification-item__chip notification-item__chip--${escapeHtml(chip.kind)}">${escapeHtml(chip.label)}</span>`).join("")}
            </div>` : ""}
            <button type="button" class="notification-item__dismiss" data-action="dismiss" data-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(this._text("aria.dismiss", "Borrar notificación"))}">
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          ${item.message ? `<div class="notification-item__message">${escapeHtml(item.message)}</div>` : ""}
          ${
            action
              ? `
                <div class="notification-item__actions">
                  <button type="button" class="notification-item__action" data-action="run-notification" data-id="${escapeHtml(item.id)}">
                    ${escapeHtml(action.label || this._text("actions.open", "Open"))}
                  </button>
                </div>
              `
              : ""
          }
        </div>
      </article>
    `;
  }

  _stackCardStyle(item, index) {
    const stackIndex = Math.max(1, Number(index) || 1);
    const accent = item?.tintColor
      ? sanitizeCssRuntimeValue(item.tintColor, "")
      : this._severityAccent(item?.severity);
    const clampedIndex = Math.min(4, stackIndex);
    const stackPeek = 9;
    const firstLayerPeekCorrection = clampedIndex === 1 ? 1 : 0;
    const inset = 5 + (clampedIndex - 1) * 5;
    const offset = clampedIndex * stackPeek + firstLayerPeekCorrection;
    const opacity = Math.max(0.38, 0.64 - (clampedIndex - 1) * 0.08);
    const zIndex = 4 - clampedIndex;
    return [
      `--stack-index:${clampedIndex}`,
      `--stack-accent:${escapeHtml(accent || "var(--primary-color)")}`,
      `--stack-inset:${inset}px`,
      `--stack-offset:${offset}px`,
      `--stack-opacity:${opacity}`,
      `--stack-z:${zIndex}`,
    ].join(";");
  }

  _renderCollapsedStackCards(notifications, startIndex) {
    return notifications
      .slice(startIndex, startIndex + 4)
      .map((item, index) => (
        `<div class="notification-stack-card" style="${this._stackCardStyle(item, index + 1)}" aria-hidden="true"></div>`
      ))
      .join("");
  }

  _severityLabel(severity) {
    switch (severity) {
      case "critical":
        return this._text("severity.critical", "Critical");
      case "warning":
        return this._text("severity.warning", "Warning");
      case "success":
        return this._text("severity.success", "OK");
      default:
        return this._text("severity.info", "Info");
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
    const notifications = this._getNotifications({ notifyMobile: true });
    const hiddenCount = Math.max(0, notifications.length - config.max_visible);
    const shouldStack = notifications.length > config.max_visible;
    const collapsedStackDepth = shouldStack && !this._expanded ? Math.min(4, hiddenCount) : 0;
    const collapsedStackReserve = collapsedStackDepth ? 4 + collapsedStackDepth * 5 : 0;
    const isCollapsingStack = this._collapsingStack && this._expanded;
    const visible = this._expanded || isCollapsingStack ? notifications : notifications.slice(0, config.max_visible);
    const hasNotifications = notifications.length > 0;
    const customEmptyMessage = String(config.empty_message ?? "").trim();
    const customEmptyTitle = String(config.empty_title ?? "").trim();
    const emptyText =
      customEmptyMessage ||
      customEmptyTitle ||
      this._text("empty.message", DEFAULT_CONFIG.empty_message);
    const animations = this._getAnimationSettings();
    const nextNotificationIdsSignature = notifications.map(item => item.id).join("|");
    const animateEntrance = animations.enabled && this._animateContentOnNextRender;
    const stackTransition = animations.enabled ? this._stackTransition : "";
    this._lastNotificationIdsSignature = nextNotificationIdsSignature;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --nodalia-surface: var(--card-background-color, rgba(32, 34, 42, 0.92));
          --nodalia-surface-soft: var(--ha-card-background, var(--card-background-color, rgba(32, 34, 42, 0.88)));
          --nodalia-border: var(--divider-color, rgba(255, 255, 255, 0.12));
          --nodalia-text: var(--primary-text-color, #f4f4f7);
          --nodalia-muted: var(--secondary-text-color, rgba(244, 244, 247, 0.62));
          --nodalia-user-card-bg: ${styles.card.background};
          display: block;
          overflow: visible;
        }
        * {
          box-sizing: border-box;
        }
        ha-card {
          color: var(--primary-text-color);
          display: block;
        }
        .notifications-card--list {
          background: transparent;
          border: 0;
          box-shadow: none;
          color: var(--primary-text-color);
          display: block;
          overflow: visible;
          padding: 0;
        }
        .notifications-card--empty {
          --notifications-accent: var(--success-color, #43a047);
          --notifications-surface-base: var(--nodalia-user-card-bg, var(--nodalia-surface-soft));
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
            linear-gradient(135deg, color-mix(in srgb, var(--notifications-accent) 18%, var(--notifications-surface-base)) 0%, color-mix(in srgb, var(--notifications-accent) 10%, var(--notifications-surface-base)) 52%, var(--notifications-surface-base) 100%),
            var(--notifications-surface-base);
          border: 1px solid color-mix(in srgb, var(--notifications-accent) 32%, var(--divider-color));
          border-radius: ${styles.card.border_radius};
          box-shadow:
            ${styles.card.box_shadow},
            0 16px 32px color-mix(in srgb, var(--notifications-accent) 18%, rgba(0, 0, 0, 0.18));
          isolation: isolate;
          overflow: hidden;
          position: relative;
          transform: translateZ(0);
        }
        .notifications-card--empty::before {
          background: linear-gradient(180deg, color-mix(in srgb, var(--notifications-accent) 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0));
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }
        .notifications-card--empty::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, var(--notifications-accent) 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, var(--notifications-accent) 14%, transparent) 0%, transparent 66%);
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }
        .notifications-empty-inline {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: auto minmax(0, 1fr);
          min-height: 64px;
          padding: 10px 14px;
          position: relative;
          z-index: 1;
        }
        .notifications-empty-inline__icon {
          align-items: center;
          background: color-mix(in srgb, var(--notifications-accent) 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: color-mix(in srgb, var(--notifications-accent) 78%, var(--primary-text-color));
          display: inline-flex;
          height: 44px;
          justify-content: center;
          width: 44px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.12);
        }
        .notifications-empty-inline__icon ha-icon {
          --mdc-icon-size: 20px;
        }
        .notifications-empty-inline__text {
          font-size: clamp(12px, 1.1vw, 14px);
          font-weight: 650;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }
        .notifications-stack {
          --notifications-stack-reserve: ${collapsedStackReserve}px;
          align-content: start;
          align-items: start;
          display: grid;
          isolation: isolate;
          padding-bottom: var(--notifications-stack-reserve, 0px);
          position: relative;
        }
        .notifications-stack-toggle,
        .notification-item__dismiss,
        .notification-item__action {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 10%, var(--nodalia-user-card-bg, var(--nodalia-surface-soft)));
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, var(--nodalia-border, rgba(255, 255, 255, 0.12)));
          border-radius: 999px;
          color: var(--nodalia-text, var(--primary-text-color));
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          justify-content: center;
          margin: 0;
          min-height: 24px;
          padding: 0 9px;
        }
        .notifications-list {
          align-content: start;
          align-items: start;
          display: grid;
          gap: 8px;
          isolation: isolate;
          position: relative;
          z-index: 6;
        }
        .notification-item {
          --notification-accent: ${styles.accent};
          --notification-surface-base: var(--nodalia-user-card-bg, var(--nodalia-surface-soft));
          align-items: start;
          align-self: start;
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
            linear-gradient(135deg, color-mix(in srgb, var(--notification-accent) 18%, var(--notification-surface-base)) 0%, color-mix(in srgb, var(--notification-accent) 10%, var(--notification-surface-base)) 52%, var(--notification-surface-base) 100%),
            var(--notification-surface-base);
          border: 1px solid color-mix(in srgb, var(--notification-accent) 32%, var(--divider-color));
          border-radius: ${styles.item_radius};
          box-shadow:
            ${styles.card.box_shadow},
            0 16px 32px color-mix(in srgb, var(--notification-accent) 18%, rgba(0, 0, 0, 0.18));
          display: grid;
          gap: 10px;
          grid-template-columns: auto minmax(0, 1fr);
          isolation: isolate;
          min-width: 0;
          min-height: 64px;
          overflow: hidden;
          padding: 10px 12px;
          position: relative;
          transform: translateZ(0);
          transform-origin: center top;
          z-index: 4;
        }
        .notification-item--collapsing-tail {
          pointer-events: none;
        }
        .notification-item::before {
          background: linear-gradient(180deg, color-mix(in srgb, var(--notification-accent) 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0));
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }
        .notification-item::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, var(--notification-accent) 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, var(--notification-accent) 14%, transparent) 0%, transparent 66%);
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
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
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.12);
          color: var(--notification-icon-color, var(--notification-accent));
          display: inline-flex;
          height: 44px;
          justify-content: center;
          position: relative;
          width: 44px;
          z-index: 1;
        }
        .notification-item__icon ha-icon {
          --mdc-icon-size: 20px;
          color: var(--notification-icon-color, var(--notification-accent));
        }
        .notification-item__body {
          display: grid;
          gap: 5px;
          min-width: 0;
          position: relative;
          z-index: 1;
        }
        .notification-item__title-row {
          align-items: start;
          display: grid;
          gap: 6px;
          grid-template-columns: minmax(0, 1fr) auto auto;
        }
        .notification-item__title {
          font-size: clamp(12px, 1.25vw, 14px);
          font-weight: 700;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }
        .notification-item__dismiss {
          height: 24px;
          min-height: 24px;
          padding: 0;
          width: 24px;
        }
        .notification-item__dismiss ha-icon {
          --mdc-icon-size: 14px;
        }
        .notification-item__message {
          color: var(--primary-text-color);
          font-size: 12px;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }
        .notification-item__chips {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          min-width: 0;
        }
        .notification-item__chips--top {
          align-self: start;
          flex-wrap: nowrap;
          justify-content: flex-end;
          max-width: min(42vw, 160px);
          overflow: hidden;
          padding-top: 1px;
        }
        .notification-item__chips--top .notification-item__chip {
          max-width: 100%;
        }
        .notification-item__chip {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 10%, var(--nodalia-user-card-bg, var(--nodalia-surface-soft)));
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 10%, var(--nodalia-border, rgba(255, 255, 255, 0.12)));
          border-radius: 999px;
          color: var(--nodalia-muted, var(--secondary-text-color));
          display: inline-flex;
          flex: 0 1 auto;
          font-size: 10.5px;
          font-weight: 600;
          line-height: 1;
          min-height: 22px;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding: 0 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .notification-item__chip--state {
          color: var(--nodalia-text, var(--primary-text-color));
        }
        .notification-item__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding-top: 1px;
        }
        .notification-item__action {
          background: color-mix(in srgb, var(--notification-accent) 14%, transparent);
          border-color: color-mix(in srgb, var(--notification-accent) 24%, transparent);
          color: var(--primary-text-color);
          font-size: 11px;
          font-weight: 700;
        }
        .notification-stack-card {
          --stack-surface: var(--nodalia-user-card-bg, var(--nodalia-surface-soft));
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.02)),
            linear-gradient(135deg, color-mix(in srgb, var(--stack-accent, var(--primary-color)) 12%, var(--stack-surface)) 0%, color-mix(in srgb, var(--stack-accent, var(--primary-color)) 6%, var(--stack-surface)) 58%, var(--stack-surface) 100%),
            var(--stack-surface);
          border: 1px solid color-mix(in srgb, var(--stack-accent, var(--primary-color)) 20%, color-mix(in srgb, var(--primary-text-color) 10%, var(--nodalia-border, rgba(255, 255, 255, 0.12))));
          border-radius: ${styles.item_radius};
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.08);
          height: calc(100% - 2px);
          left: var(--stack-inset, 4px);
          opacity: var(--stack-opacity, 0.72);
          overflow: hidden;
          pointer-events: none;
          position: absolute;
          right: var(--stack-inset, 4px);
          top: var(--stack-offset, 7px);
          z-index: calc(var(--stack-z, 2) - 8);
        }
        .notifications-footer {
          align-items: center;
          display: flex;
          justify-content: center;
          margin-top: -7px;
          position: relative;
          z-index: 8;
        }
        .notifications-stack-toggle {
          background: color-mix(in srgb, var(--primary-text-color) 12%, var(--nodalia-user-card-bg, var(--nodalia-surface-soft)));
          border-color: color-mix(in srgb, var(--primary-text-color) 14%, var(--nodalia-border, rgba(255, 255, 255, 0.12)));
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.16);
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          height: 28px;
          min-height: 28px;
          padding: 0 9px;
        }
        .notifications-stack-toggle ha-icon {
          --mdc-icon-size: 16px;
        }
        .notifications-card--animated.notifications-card--enter .notifications-empty-inline,
        .notifications-card--animated.notifications-card--enter .notification-item {
          animation: notifications-card-fade-up calc(var(--notifications-content-duration, 420ms) * 0.96) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: calc(70ms + (var(--notification-index, 0) * 40ms));
        }
        .notifications-card--animated.notifications-card--enter .notification-item__icon {
          animation: notifications-card-bubble-bloom calc(var(--notifications-content-duration, 420ms) * 0.92) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: calc(40ms + (var(--notification-index, 0) * 40ms));
        }
        .notifications-card--animated.notifications-card--enter .notification-item__title,
        .notifications-card--animated.notifications-card--enter .notification-item__message,
        .notifications-card--animated.notifications-card--enter .notification-item__actions {
          animation: notifications-card-fade-up calc(var(--notifications-content-duration, 420ms) * 0.72) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: calc(92ms + (var(--notification-index, 0) * 40ms));
        }
        .notifications-card--animated.notifications-card--enter .notification-item__chip {
          animation: notifications-card-chip-pop calc(var(--notifications-content-duration, 420ms) * 0.58) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
          animation-delay: calc(116ms + (var(--notification-index, 0) * 40ms));
        }
        .notifications-card--animated.notifications-card--stack-expand .notifications-list,
        .notifications-card--animated.notifications-card--stack-collapse-final .notifications-list {
          animation: notifications-stack-reflow calc(var(--notifications-content-duration, 420ms) * 0.72) cubic-bezier(0.18, 0.9, 0.22, 1.08) both;
        }
        .notifications-card--animated.notifications-card--stack-expand .notification-item {
          animation: notifications-card-item-rise calc(var(--notifications-content-duration, 420ms) * 0.74) cubic-bezier(0.18, 0.9, 0.22, 1.08) both;
          animation-delay: calc(var(--notification-index, 0) * 34ms);
        }
        .notifications-card--animated.notifications-card--stack-collapse .notification-item--collapsing-tail {
          animation: notifications-stack-tail-out calc(var(--notifications-content-duration, 420ms) * 0.62) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: calc(var(--notification-exit-index, 0) * 28ms);
          transform-origin: center top;
        }
        .notifications-card--animated.notifications-card--stack-collapse-final .notification-stack-card,
        .notifications-card--animated.notifications-card--stack-collapse-final .notifications-stack-toggle {
          animation: notifications-stack-collapse calc(var(--notifications-content-duration, 420ms) * 0.66) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }
        .notifications-card--animated .notifications-stack-toggle.is-pressing,
        .notifications-card--animated .notification-item__dismiss.is-pressing,
        .notifications-card--animated .notification-item__action.is-pressing {
          animation: notifications-button-bounce var(--notifications-button-bounce-duration, 320ms) cubic-bezier(0.2, 0.9, 0.25, 1.35) both;
        }
        @keyframes notifications-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes notifications-card-item-rise {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.94);
          }
          62% {
            opacity: 1;
            transform: translateY(0) scale(1.018);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes notifications-card-chip-pop {
          0% {
            opacity: 0;
            transform: translateY(-4px) scale(0.86);
          }
          70% {
            opacity: 1;
            transform: translateY(1px) scale(1.05);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes notifications-card-bubble-bloom {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          58% {
            opacity: 1;
            transform: scale(1.04);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes notifications-stack-reflow {
          0% {
            opacity: 0.7;
            transform: translateY(-6px) scaleY(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }
        @keyframes notifications-stack-collapse {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.94);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes notifications-stack-tail-out {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-10px) scale(0.965);
          }
        }
        @keyframes notifications-button-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(0.94);
          }
          100% {
            transform: scale(1);
          }
        }
      </style>
      <ha-card
        class="notifications-card ${hasNotifications ? "notifications-card--list" : "notifications-card--empty"} ${animations.enabled ? "notifications-card--animated" : ""} ${animateEntrance ? "notifications-card--enter" : ""} ${stackTransition ? `notifications-card--stack-${stackTransition}` : ""}"
        style="--notifications-content-duration:${animations.enabled ? animations.contentDuration : 0}ms; --notifications-button-bounce-duration:${animations.enabled ? animations.buttonBounceDuration : 0}ms;"
      >
          ${
            hasNotifications
              ? `
                <div class="notifications-stack">
                  <div class="notifications-list">
                    ${
                      shouldStack && !this._expanded
                        ? this._renderCollapsedStackCards(notifications, config.max_visible)
                        : ""
                    }
                    ${visible.map((item, index) => this._renderNotification(item, {
                      primary: index === 0,
                      index,
                      exiting: isCollapsingStack && index >= config.max_visible,
                      exitIndex: Math.max(0, index - config.max_visible),
                    })).join("")}
                  </div>
                  ${
                    shouldStack
                      ? `
                        <div class="notifications-footer">
                          <button type="button" class="notifications-stack-toggle" data-action="toggle-stack" aria-expanded="${this._expanded ? "true" : "false"}" aria-label="${escapeHtml(this._expanded ? this._text("aria.showLess", "Mostrar menos") : this._text("aria.showAll", "Mostrar todas las notificaciones"))}">
                            <ha-icon icon="${this._expanded ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                            <span>${this._expanded ? escapeHtml(this._text("actions.less", "Menos")) : hiddenCount}</span>
                          </button>
                        </div>
                      `
                      : ""
                  }
                </div>
              `
              : `
                <div class="notifications-empty-inline">
                  <div class="notifications-empty-inline__icon">
                    <ha-icon icon="mdi:check"></ha-icon>
                  </div>
                  <div class="notifications-empty-inline__text">${escapeHtml(emptyText)}</div>
                </div>
              `
          }
      </ha-card>
    `;
    if (animateEntrance) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 120);
    }
    this._stackTransition = "";
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
    this._showConnectionsSection = false;
    this._showSmartSection = false;
    this._showCustomSection = true;
    this._showAnimationSection = false;
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
          || id.startsWith("input_text.")
          || id.startsWith("notify.")
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
    const next = normalizeConfig(this._config, { keepDrafts: true });
    const emitted = normalizeConfig(next);
    this._config = next;
    this._render();
    this._restoreFocusState(focus);
    const stripped = window.NodaliaUtils?.stripEqualToDefaults
      ? window.NodaliaUtils.stripEqualToDefaults(emitted, DEFAULT_CONFIG)
      : emitted;
    fireEvent(this, "config-changed", { config: compactConfig(stripped) || {} });
  }

  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    return window.NodaliaI18n.editorStr(this._hass, this._config?.language ?? "auto", s);
  }

  _readFieldValue(input) {
    const type = input.dataset.valueType || "string";
    if (type === "boolean") {
      return Boolean(input.checked);
    }
    if (type === "number") {
      return input.value === "" ? "" : Number(input.value);
    }
    if (type === "color") {
      return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
    }
    if (type === "entity-list") {
      return normalizeEntityList(input.value);
    }
    if (type === "csv") {
      return normalizeStringList(input.value);
    }
    return input.value;
  }

  _entityDomainsForListField(field) {
    switch (String(field || "")) {
      case "calendar_entities":
        return ["calendar"];
      case "vacuum_entities":
        return ["vacuum"];
      case "vacuum_error_entities":
        return ["sensor"];
      case "fan_entities":
        return ["fan"];
      case "climate_entities":
        return ["climate"];
      case "humidifier_entities":
        return ["humidifier"];
      case "media_player_entities":
        return ["media_player"];
      case "weather_entities":
        return ["weather"];
      case "motion_entities":
      case "door_entities":
      case "window_entities":
        return ["binary_sensor"];
      case "temperature_entities":
      case "humidity_entities":
      case "battery_entities":
      case "humidifier_fill_entities":
      case "ink_entities":
        return ["sensor"];
      case "mobile_notifications.entities":
        return ["notify"];
      default:
        return [];
    }
  }

  _setFieldValue(path, value) {
    const smartEntityMatch = String(path || "").match(/^smart_entity_overrides\.(\d+)\./);
    if (smartEntityMatch) {
      const index = Number(smartEntityMatch[1]);
      const entity = this._smartEntityEditorEntities?.[index] || "";
      const key = String(path || "").split(".").pop();
      if (!entity || !key) {
        return;
      }
      if (!Array.isArray(this._config.smart_entity_overrides)) {
        this._config.smart_entity_overrides = [];
      }
      let overrideIndex = this._config.smart_entity_overrides.findIndex(item => item?.entity === entity);
      if (overrideIndex < 0) {
        overrideIndex = this._config.smart_entity_overrides.length;
        this._config.smart_entity_overrides.push({ entity });
      }
      if (value === "" || value === undefined || value === null) {
        delete this._config.smart_entity_overrides[overrideIndex][key];
      } else {
        this._config.smart_entity_overrides[overrideIndex][key] = value;
      }
      return;
    }
    if (value === "" || value === undefined || value === null || (Array.isArray(value) && !value.length)) {
      deleteByPath(this._config, path);
      return;
    }
    setByPath(this._config, path, value);
  }

  _setEntityListItem(field, index, value) {
    const key = String(field || "");
    if (!key) {
      return;
    }
    const current = normalizeEntityList(getByPath(this._config, key));
    const nextValue = String(value || "").trim();
    const safeIndex = Math.max(0, Number(index) || 0);
    if (nextValue) {
      current[safeIndex] = nextValue;
    } else {
      current.splice(safeIndex, 1);
    }
    const filtered = normalizeEntityList(current, this._entityDomainsForListField(key));
    this._setFieldValue(key, filtered);
  }

  _addEntityListItem(field) {
    const key = String(field || "");
    if (!key) {
      return;
    }
    const current = normalizeEntityList(getByPath(this._config, key), this._entityDomainsForListField(key));
    current.push("");
    setByPath(this._config, key, current);
    this._emitConfig();
  }

  _removeEntityListItem(field, index) {
    const key = String(field || "");
    if (!key) {
      return;
    }
    const current = normalizeEntityList(getByPath(this._config, key), this._entityDomainsForListField(key));
    const safeIndex = Number(index);
    if (Number.isInteger(safeIndex) && safeIndex >= 0) {
      current.splice(safeIndex, 1);
    }
    this._setFieldValue(key, current);
    this._emitConfig();
  }

  _onShadowInput(event) {
    const input = event.composedPath().find(node => (
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLSelectElement
    ));
    if (input?.dataset?.listField) {
      event.stopPropagation();
      this._setEntityListItem(input.dataset.listField, Number(input.dataset.index), input.value);
      if (event.type === "change") {
        this._emitConfig();
      }
      return;
    }
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
    if (control.dataset.listField) {
      this._setEntityListItem(control.dataset.listField, Number(control.dataset.index), nextValue);
      this._emitConfig();
      return;
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
      } else if (toggle.dataset.editorToggle === "connections") {
        this._showConnectionsSection = !this._showConnectionsSection;
      } else if (toggle.dataset.editorToggle === "smart") {
        this._showSmartSection = !this._showSmartSection;
      } else if (toggle.dataset.editorToggle === "custom") {
        this._showCustomSection = !this._showCustomSection;
      } else if (toggle.dataset.editorToggle === "animations") {
        this._showAnimationSection = !this._showAnimationSection;
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
      case "add-entity-list-item":
        this._addEntityListItem(button.dataset.field || "");
        break;
      case "remove-entity-list-item":
        this._removeEntityListItem(button.dataset.field || "", index);
        break;
      case "add-custom":
        this._config.custom_notifications.push({
          _draft: true,
          title: "",
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
    const tLabel = this._editorLabel(label);
    const tPlaceholder = options.placeholder ? this._editorLabel(options.placeholder) : "";
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          type="${escapeHtml(options.type || "text")}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          value="${escapeHtml(value ?? "")}"
          ${tPlaceholder ? `placeholder="${escapeHtml(tPlaceholder)}"` : ""}
        />
      </label>
    `;
  }

  _renderTextareaField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tPlaceholder = options.placeholder ? this._editorLabel(options.placeholder) : "";
    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <textarea
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          ${tPlaceholder ? `placeholder="${escapeHtml(tPlaceholder)}"` : ""}
        >${escapeHtml(value ?? "")}</textarea>
      </label>
    `;
  }

  _renderSelectField(label, field, value, options, renderOptions = {}) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field ${renderOptions.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options.map(option => `
            <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
              ${escapeHtml(this._editorLabel(option.label))}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-toggle">
        <input type="checkbox" data-field="${escapeHtml(field)}" data-value-type="boolean" ${checked ? "checked" : ""} />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span>${escapeHtml(tLabel)}</span>
      </label>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const fullWidth = options.fullWidth !== false;
    const tLabel = this._editorLabel(label);
    return `
      <div class="editor-field ${fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
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

  _renderColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("ed.notifications.custom_color");
    const fallbackValue = options.fallbackValue || getEditorColorFallbackValue(field);
    const currentValue = value === undefined || value === null || value === ""
      ? fallbackValue
      : String(value);
    const color = getEditorColorModel(currentValue, fallbackValue);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="${escapeHtml(tColorCustom)}">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="color"
              data-alpha="${escapeHtml(color.alpha)}"
              value="${escapeHtml(color.hex)}"
              aria-label="${escapeHtml(tLabel)}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(currentValue)};" aria-hidden="true"></span>
          </label>
        </div>
      </div>
    `;
  }

  _renderEntityPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tPlaceholder = options.placeholder ? this._editorLabel(options.placeholder) : "";
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(value || "")}"
          ${options.domains ? `data-domains="${escapeHtml(options.domains)}"` : ""}
          data-placeholder="${escapeHtml(tPlaceholder)}"
        ></div>
      </div>
    `;
  }

  _renderEntityListField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tPlaceholder = options.placeholder ? this._editorLabel(options.placeholder) : "";
    const domains = options.domains || this._entityDomainsForListField(field).join(",");
    const items = normalizeEntityList(value, this._entityDomainsForListField(field));
    const rows = [...items, ""];
    return `
      <div class="editor-field editor-field--full editor-field--entity-list">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-entity-list">
          ${rows.map((entityId, index) => {
            const isNewRow = index >= items.length;
            return `
              <div class="editor-entity-list__row">
                <div
                  class="editor-control-host"
                  data-mounted-control="entity"
                  data-field="${escapeHtml(`${field}.${index}`)}"
                  data-list-field="${escapeHtml(field)}"
                  data-index="${index}"
                  data-value="${escapeHtml(entityId)}"
                  data-domains="${escapeHtml(domains)}"
                  data-placeholder="${escapeHtml(tPlaceholder)}"
                ></div>
                ${
                  isNewRow
                    ? `<span class="editor-entity-list__spacer" aria-hidden="true"></span>`
                    : `<button type="button" class="editor-entity-list__remove" data-editor-action="remove-entity-list-item" data-field="${escapeHtml(field)}" data-index="${index}" aria-label="${escapeHtml(`${this._editorLabel("ed.notifications.remove_entity_row")} ${tLabel}`)}">
                        <ha-icon icon="mdi:close"></ha-icon>
                      </button>`
                }
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
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
    const control = host.firstElementChild;
    if (!(control instanceof HTMLElement)) {
      return;
    }
    const allowedDomains = String(host.dataset.domains || "")
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);
    if (!allowedDomains.length) {
      return;
    }
    if (control.tagName === "HA-ENTITY-PICKER") {
      control.includeDomains = allowedDomains;
      control.entityFilter = stateObj =>
        allowedDomains.some(domain => String(stateObj?.entity_id || "").startsWith(`${domain}.`));
      return;
    }
    if (control.tagName === "HA-SELECTOR") {
      control.selector = {
        entity: allowedDomains.length === 1 ? { domain: allowedDomains[0] } : { domain: allowedDomains },
      };
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

  _smartEntityEditorRows(config) {
    const labels = [
      ["calendar_entities", "ed.notifications.conn_label_calendar"],
      ["vacuum_entities", "ed.notifications.conn_label_vacuum"],
      ["vacuum_error_entities", "ed.notifications.conn_label_vacuum_error"],
      ["weather_entities", "ed.notifications.conn_label_weather"],
      ["media_player_entities", "ed.notifications.conn_label_media"],
      ["motion_entities", "ed.notifications.conn_label_motion"],
      ["door_entities", "ed.notifications.conn_label_door"],
      ["window_entities", "ed.notifications.conn_label_window"],
      ["temperature_entities", "ed.notifications.conn_label_temperature"],
      ["humidity_entities", "ed.notifications.conn_label_humidity"],
      ["climate_entities", "ed.notifications.conn_label_climate"],
      ["humidifier_entities", "ed.notifications.conn_label_humidifier"],
      ["battery_entities", "ed.notifications.conn_label_battery"],
      ["humidifier_fill_entities", "ed.notifications.conn_label_tank"],
      ["ink_entities", "ed.notifications.conn_label_ink"],
    ];
    const byEntity = new Map((config.smart_entity_overrides || []).map(item => [item.entity, item]));
    const seen = new Set();
    const rows = [];
    labels.forEach(([field, label]) => {
      (config[field] || []).forEach(entity => {
        if (!entity || seen.has(entity)) {
          return;
        }
        seen.add(entity);
        rows.push({
          entity,
          label,
          ...(byEntity.get(entity) || {}),
        });
      });
    });
    (config.smart_entity_overrides || []).forEach(item => {
      if (item.entity && !seen.has(item.entity)) {
        seen.add(item.entity);
        rows.push({ label: "ed.notifications.conn_label_manual", ...item });
      }
    });
    return rows.map(item => ({
      entity: item.entity,
      label: item.label || "ed.notifications.conn_label_entity",
      title: item.title || "",
      message: item.message || "",
      tint_color: item.tint_color || "",
      url: item.url || "",
      action_label: item.action_label || "",
      mobile: normalizeSmartEntityMobile(item.mobile),
    }));
  }

  _renderSmartNotificationOptions(config) {
    const rows = [
      ["hot", "ed.notifications.smart_hot", "ed.notifications.smart_ph_hot_title", "ed.notifications.smart_ph_hot_message"],
      ["cold", "ed.notifications.smart_cold", "ed.notifications.smart_ph_cold_title", "ed.notifications.smart_ph_cold_message"],
      ["humidity_high", "ed.notifications.smart_humidity_high", "ed.notifications.smart_ph_humidity_high_title", "ed.notifications.smart_ph_humidity_high_message"],
      ["humidity_low", "ed.notifications.smart_humidity_low", "ed.notifications.smart_ph_humidity_low_title", "ed.notifications.smart_ph_humidity_low_message"],
      ["rain", "ed.notifications.smart_rain", "ed.notifications.smart_ph_rain_title", "ed.notifications.smart_ph_rain_message"],
      ["media_left_on", "ed.notifications.smart_media_left_on", "ed.notifications.smart_ph_media_title", "ed.notifications.smart_ph_media_message"],
      ["battery_low", "ed.notifications.smart_battery_low", "ed.notifications.smart_ph_battery_title", "ed.notifications.smart_ph_battery_message"],
      ["humidifier_fill_low", "ed.notifications.smart_tank_low", "ed.notifications.smart_ph_tank_title", "ed.notifications.smart_ph_tank_message"],
      ["ink_low", "ed.notifications.smart_ink_low", "ed.notifications.smart_ph_ink_title", "ed.notifications.smart_ph_ink_message"],
    ];
    return rows.map(([key, label, titlePlaceholder, messagePlaceholder]) => {
      const item = config.smart_notifications?.[key] || {};
      return `
        <div class="editor-action">
          <div class="editor-action__header">
            <div class="editor-action__title">${escapeHtml(this._editorLabel(label))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.notifications.field_custom_title", `smart_notifications.${key}.title`, item.title, { placeholder: titlePlaceholder })}
            ${this._renderColorField("ed.notifications.field_tint_color", `smart_notifications.${key}.tint_color`, item.tint_color)}
            ${this._renderTextareaField("ed.notifications.field_custom_message", `smart_notifications.${key}.message`, item.message, { placeholder: messagePlaceholder })}
            ${this._renderTextField("ed.notifications.field_optional_url", `smart_notifications.${key}.url`, item.url, { placeholder: "https://...", fullWidth: true })}
            ${this._renderTextField("ed.notifications.field_url_label", `smart_notifications.${key}.action_label`, item.action_label, { placeholder: "ed.notifications.url_label_placeholder", fullWidth: true })}
          </div>
        </div>
      `;
    }).join("");
  }

  _renderSmartEntityOverrides(config) {
    const rows = this._smartEntityEditorRows(config);
    this._smartEntityEditorEntities = rows.map(item => item.entity);
    if (!rows.length) {
      return `<div class="editor-empty">${escapeHtml(this._editorLabel("ed.notifications.smart_empty_connections"))}</div>`;
    }
    return rows.map((item, index) => `
      <div class="editor-action">
        <div class="editor-action__header">
          <div>
            <div class="editor-action__title">${escapeHtml(this._editorLabel(item.label))} · ${escapeHtml(friendlyName(this._hass, item.entity) || item.entity)}</div>
            <div class="editor-action__subtitle">${escapeHtml(item.entity)}</div>
          </div>
        </div>
        <div class="editor-grid">
          ${this._renderTextField("ed.notifications.field_title_entity_only", `smart_entity_overrides.${index}.title`, item.title, { placeholder: "ed.notifications.placeholder_use_global_title" })}
          ${this._renderColorField("ed.notifications.field_color_entity_only", `smart_entity_overrides.${index}.tint_color`, item.tint_color)}
          ${this._renderTextareaField("ed.notifications.field_message_entity_only", `smart_entity_overrides.${index}.message`, item.message, { placeholder: "ed.notifications.placeholder_use_global_message" })}
          ${this._renderTextField("ed.notifications.field_url_entity_only", `smart_entity_overrides.${index}.url`, item.url, { placeholder: "https://...", fullWidth: true })}
          ${this._renderTextField("ed.notifications.field_url_label", `smart_entity_overrides.${index}.action_label`, item.action_label, { placeholder: "ed.notifications.url_label_placeholder" })}
          ${this._renderSelectField("ed.notifications.field_mobile", `smart_entity_overrides.${index}.mobile`, item.mobile, [
            { value: "inherit", label: "ed.notifications.mobile_inherit" },
            { value: "on", label: "ed.notifications.mobile_on" },
            { value: "off", label: "ed.notifications.mobile_off" },
          ])}
        </div>
      </div>
    `).join("");
  }

  _renderCustomNotifications(config) {
    if (!config.custom_notifications.length) {
      return `<div class="editor-empty">${escapeHtml(this._editorLabel("ed.notifications.custom_empty"))}</div>`;
    }
    return config.custom_notifications.map((item, index) => `
      <div class="editor-action">
        <div class="editor-action__header">
          <div class="editor-action__title">${escapeHtml(this._editorLabel("ed.notifications.custom_notification_n"))} ${index + 1}</div>
          <div class="editor-action__buttons">
            <button type="button" data-editor-action="move-custom-up" data-index="${index}">${escapeHtml(this._editorLabel("ed.notifications.move_up"))}</button>
            <button type="button" data-editor-action="move-custom-down" data-index="${index}">${escapeHtml(this._editorLabel("ed.notifications.move_down"))}</button>
            <button type="button" data-editor-action="remove-custom" data-index="${index}">${escapeHtml(this._editorLabel("ed.notifications.remove"))}</button>
          </div>
        </div>
        <div class="editor-grid">
          ${this._renderTextField("ed.notifications.field_title", `custom_notifications.${index}.title`, item.title, { placeholder: "ed.notifications.placeholder_notice" })}
          ${this._renderIconPickerField("ed.notifications.field_icon", `custom_notifications.${index}.icon`, item.icon)}
          ${this._renderTextareaField("ed.notifications.field_message", `custom_notifications.${index}.message`, item.message, { placeholder: "ed.notifications.placeholder_visible_text" })}
          ${this._renderSelectField("ed.notifications.field_severity", `custom_notifications.${index}.severity`, item.severity, [
            { value: "info", label: "ed.notifications.severity_info" },
            { value: "success", label: "ed.notifications.severity_ok" },
            { value: "warning", label: "ed.notifications.severity_warning" },
            { value: "critical", label: "ed.notifications.severity_critical" },
          ])}
          ${this._renderColorField("ed.notifications.field_custom_tint", `custom_notifications.${index}.tint_color`, item.tint_color, { fullWidth: true })}
          ${this._renderEntityPickerField("ed.notifications.field_optional_entity", `custom_notifications.${index}.entity`, item.entity, { fullWidth: true })}
          ${this._renderTextField("ed.notifications.field_optional_attribute", `custom_notifications.${index}.attribute`, item.attribute, { placeholder: "temperature" })}
          ${this._renderSelectField("ed.notifications.field_condition", `custom_notifications.${index}.condition`, item.condition, [
            { value: "always", label: "ed.notifications.cond_always" },
            { value: "on", label: "ed.notifications.cond_on" },
            { value: "off", label: "ed.notifications.cond_off" },
            { value: "unavailable", label: "ed.notifications.cond_unavailable" },
            { value: "equals", label: "ed.notifications.cond_equals" },
            { value: "not_equals", label: "ed.notifications.cond_not_equals" },
            { value: "above", label: "ed.notifications.cond_above" },
            { value: "below", label: "ed.notifications.cond_below" },
            { value: "missing", label: "ed.notifications.cond_missing" },
          ])}
          ${this._renderTextField("ed.notifications.field_condition_value", `custom_notifications.${index}.value`, item.value, { placeholder: "27" })}
          ${this._renderSelectField("ed.notifications.field_action", `custom_notifications.${index}.action_type`, item.action_type, [
            { value: "none", label: "ed.notifications.action_none" },
            { value: "more-info", label: "ed.notifications.action_more_info" },
            { value: "url", label: "ed.notifications.action_url" },
            { value: "toggle", label: "ed.notifications.action_toggle" },
            { value: "service", label: "ed.notifications.action_service" },
          ])}
          ${this._renderTextField("ed.notifications.field_action_label", `custom_notifications.${index}.action_label`, item.action_label, { placeholder: "ed.notifications.placeholder_run" })}
          ${
            item.action_type === "url"
              ? this._renderTextField("ed.notifications.field_url_plain", `custom_notifications.${index}.url`, item.url, {
                  placeholder: "https://...",
                  fullWidth: true,
                })
              : ""
          }
          ${
            item.action_type === "service"
              ? `
                ${this._renderTextField("ed.notifications.field_service", `custom_notifications.${index}.service`, item.service, {
                  placeholder: "light.turn_on",
                  fullWidth: true,
                })}
                ${this._renderTextareaField("ed.notifications.field_service_data_json", `custom_notifications.${index}.service_data`, item.service_data, {
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
        .editor-color-field {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          min-height: 40px;
        }
        .editor-color-picker {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: 40px;
          justify-content: center;
          position: relative;
          width: 40px;
        }
        .editor-color-picker input {
          cursor: pointer;
          inset: 0;
          opacity: 0;
          position: absolute;
        }
        .editor-color-picker:hover,
        .editor-color-picker:focus-within {
          border-color: color-mix(in srgb, var(--primary-text-color) 22%, transparent);
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }
        .editor-color-swatch {
          --editor-swatch: #71c0ff;
          background:
            linear-gradient(var(--editor-swatch), var(--editor-swatch)),
            conic-gradient(from 90deg, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 25%, rgba(0, 0, 0, 0.12) 0 50%, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 0 75%, rgba(0, 0, 0, 0.12) 0);
          background-position: center;
          background-size: cover, 10px 10px;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
          border-radius: 999px;
          display: block;
          height: 22px;
          width: 22px;
        }
        .editor-entity-list {
          display: grid;
          gap: 8px;
        }
        .editor-entity-list__row {
          align-items: center;
          display: grid;
          gap: 8px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }
        .editor-entity-list__remove {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent);
          border-radius: 999px;
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: 34px;
          justify-content: center;
          min-width: 34px;
          padding: 0;
          width: 34px;
        }
        .editor-entity-list__remove ha-icon {
          --mdc-icon-size: 16px;
        }
        .editor-entity-list__spacer {
          display: block;
          width: 34px;
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
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font: inherit;
          font-size: 12px;
          font-weight: 750;
          justify-content: center;
          min-height: 34px;
          padding: 0 12px;
        }
        .editor-section__toggle-button ha-icon {
          --mdc-icon-size: 16px;
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
        .editor-action__subtitle {
          color: var(--secondary-text-color);
          font-size: 11px;
          line-height: 1.35;
          margin-top: 2px;
          overflow-wrap: anywhere;
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.general_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.notifications.empty_message", "empty_message", config.empty_message, { fullWidth: true })}
            ${this._renderTextField("ed.notifications.max_visible_collapsed", "max_visible", config.max_visible, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.calendar_refresh_s", "refresh_interval", config.refresh_interval, { type: "number", valueType: "number" })}
            ${this._renderCheckboxField("ed.notifications.smart_recommendations", "smart_recommendations", config.smart_recommendations !== false)}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.connections_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.connections_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="connections"
                aria-expanded="${this._showConnectionsSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showConnectionsSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showConnectionsSection ? this._editorLabel("ed.notifications.hide") : this._editorLabel("ed.notifications.show"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showConnectionsSection
              ? `
                <div class="editor-grid">
                  ${this._renderEntityListField("ed.notifications.entity_calendars", "calendar_entities", config.calendar_entities, { placeholder: "calendar.casa" })}
                  ${this._renderEntityListField("ed.notifications.entity_vacuums", "vacuum_entities", config.vacuum_entities, { placeholder: "vacuum.robot" })}
                  ${this._renderEntityListField("ed.notifications.entity_vacuum_errors", "vacuum_error_entities", config.vacuum_error_entities, { placeholder: "sensor.robot_error" })}
                  ${this._renderEntityListField("ed.notifications.entity_fans", "fan_entities", config.fan_entities, { placeholder: "fan.salon" })}
                  ${this._renderEntityListField("ed.notifications.entity_climates", "climate_entities", config.climate_entities, { placeholder: "climate.salon" })}
                  ${this._renderEntityListField("ed.notifications.entity_humidifiers", "humidifier_entities", config.humidifier_entities, { placeholder: "humidifier.deshumidificador" })}
                  ${this._renderEntityListField("ed.notifications.entity_media_players", "media_player_entities", config.media_player_entities, { placeholder: "media_player.tv_salon" })}
                  ${this._renderEntityListField("ed.notifications.entity_weather", "weather_entities", config.weather_entities, { placeholder: "weather.casa" })}
                  ${this._renderEntityListField("ed.notifications.entity_motion", "motion_entities", config.motion_entities, { placeholder: "binary_sensor.movimiento" })}
                  ${this._renderEntityListField("ed.notifications.entity_doors", "door_entities", config.door_entities, { placeholder: "binary_sensor.puerta" })}
                  ${this._renderEntityListField("ed.notifications.entity_windows", "window_entities", config.window_entities, { placeholder: "binary_sensor.ventana" })}
                  ${this._renderEntityListField("ed.notifications.entity_temperature", "temperature_entities", config.temperature_entities, { placeholder: "sensor.temperatura" })}
                  ${this._renderEntityListField("ed.notifications.entity_humidity", "humidity_entities", config.humidity_entities, { placeholder: "sensor.humedad" })}
                  ${this._renderEntityListField("ed.notifications.entity_battery", "battery_entities", config.battery_entities, { placeholder: "sensor.pila_mando" })}
                  ${this._renderEntityListField("ed.notifications.entity_humidifier_tank", "humidifier_fill_entities", config.humidifier_fill_entities, { placeholder: "sensor.humidificador_deposito" })}
                  ${this._renderEntityListField("ed.notifications.entity_ink", "ink_entities", config.ink_entities, { placeholder: "sensor.impresora_tinta_negra" })}
                </div>
              `
              : ""
          }
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.thresholds_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.thresholds_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.notifications.thresh_hot", "thresholds.hot_temperature", config.thresholds.hot_temperature, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_cold", "thresholds.cold_temperature", config.thresholds.cold_temperature, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_humidity_high", "thresholds.humidity_high", config.thresholds.humidity_high, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_humidity_low", "thresholds.humidity_low", config.thresholds.humidity_low, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_rain_probability", "thresholds.rain_probability", config.thresholds.rain_probability, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_rain_hours", "thresholds.rain_lookahead_hours", config.thresholds.rain_lookahead_hours, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_media_absence_min", "thresholds.media_absence_minutes", config.thresholds.media_absence_minutes, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_battery_low", "thresholds.battery_low", config.thresholds.battery_low, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_tank_low", "thresholds.humidifier_fill_low", config.thresholds.humidifier_fill_low, { type: "number", valueType: "number" })}
            ${this._renderTextField("ed.notifications.thresh_ink_low", "thresholds.ink_low", config.thresholds.ink_low, { type: "number", valueType: "number" })}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.sync_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.sync_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderEntityPickerField("ed.notifications.dismissed_helper", "dismissed_entity", config.dismissed_entity, {
              domains: "input_text",
              fullWidth: true,
              placeholder: "input_text.nodalia_notifications_dismissed",
            })}
            ${this._renderCheckboxField("ed.notifications.mobile_send", "mobile_notifications.enabled", config.mobile_notifications?.enabled === true)}
            ${
              config.mobile_notifications?.enabled === true
                ? `
                  ${this._renderEntityListField(
                    "ed.notifications.mobile_notify_entities",
                    "mobile_notifications.entities",
                    config.mobile_notifications?.entities,
                    { placeholder: "notify.mobile_app_iphone" },
                  )}
                  ${this._renderTextField(
                    "ed.notifications.mobile_notify_legacy",
                    "mobile_notifications.services",
                    Array.isArray(config.mobile_notifications?.services) ? config.mobile_notifications.services.join(", ") : "",
                    { placeholder: "notify.mobile_app_iphone", valueType: "csv", fullWidth: true },
                  )}
                  ${this._renderCheckboxField(
                    "ed.notifications.mobile_critical_legacy",
                    "mobile_notifications.critical_alerts",
                    config.mobile_notifications?.critical_alerts === true,
                  )}
                  ${this._renderSelectField("ed.notifications.mobile_min_severity", "mobile_notifications.min_severity", config.mobile_notifications?.min_severity, [
                    { value: "info", label: "ed.notifications.severity_info" },
                    { value: "success", label: "ed.notifications.severity_ok" },
                    { value: "warning", label: "ed.notifications.severity_warning" },
                    { value: "critical", label: "ed.notifications.severity_critical" },
                  ])}
                `
                : ""
            }
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.smart_alerts_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.smart_alerts_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="smart"
                aria-expanded="${this._showSmartSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showSmartSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showSmartSection ? this._editorLabel("ed.notifications.hide") : this._editorLabel("ed.notifications.show"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showSmartSection
              ? `
                <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.smart_alerts_subhint"))}</div>
                ${this._renderSmartNotificationOptions(config)}
                <div class="editor-section__header">
                  <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.per_entity_section_title"))}</div>
                  <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.per_entity_section_hint"))}</div>
                </div>
                ${this._renderSmartEntityOverrides(config)}
              `
              : ""
          }
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.custom_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.custom_section_hint"))}</div>
            <div class="editor-section__actions">
              <button type="button" data-editor-action="add-custom">${escapeHtml(this._editorLabel("ed.notifications.add_notification"))}</button>
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="custom"
                aria-expanded="${this._showCustomSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showCustomSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showCustomSection ? this._editorLabel("ed.notifications.hide") : this._editorLabel("ed.notifications.show"))}</span>
              </button>
            </div>
          </div>
          ${this._showCustomSection ? this._renderCustomNotifications(config) : ""}
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.animations_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.animations_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showAnimationSection ? this._editorLabel("ed.notifications.hide") : this._editorLabel("ed.notifications.show"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("ed.notifications.enable_animations", "animations.enabled", config.animations?.enabled !== false)}
                  ${this._renderTextField("ed.notifications.content_entrance_ms", "animations.content_duration", config.animations?.content_duration, { type: "number", valueType: "number" })}
                  ${this._renderTextField("ed.notifications.button_bounce_ms", "animations.button_bounce_duration", config.animations?.button_bounce_duration, { type: "number", valueType: "number" })}
                </div>
              `
              : ""
          }
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.security_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.security_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField(
              "ed.notifications.security_strict",
              "security.strict_service_actions",
              config.security?.strict_service_actions === true,
            )}
            ${
              config.security?.strict_service_actions === true
                ? this._renderTextField(
                    "ed.notifications.security_allowed_services",
                    "security.allowed_services",
                    Array.isArray(config.security?.allowed_services) ? config.security.allowed_services.join(", ") : "",
                    { placeholder: "light.turn_on, script.turn_on", valueType: "csv", fullWidth: true },
                  )
                : ""
            }
            ${
              config.security?.strict_service_actions === true
                ? this._renderTextField(
                    "ed.notifications.security_allowed_domains",
                    "security.allowed_service_domains",
                    Array.isArray(config.security?.allowed_service_domains) ? config.security.allowed_service_domains.join(", ") : "",
                    { placeholder: "light, script", valueType: "csv", fullWidth: true },
                  )
                : ""
            }
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.notifications.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.notifications.styles_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showStyleSection ? this._editorLabel("ed.notifications.hide") : this._editorLabel("ed.notifications.show"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("ed.notifications.card_background", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("ed.notifications.card_border", "styles.card.border", config.styles.card.border)}
                  ${this._renderTextField("ed.notifications.card_radius", "styles.card.border_radius", config.styles.card.border_radius)}
                  ${this._renderTextField("ed.notifications.box_shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("ed.notifications.padding", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("ed.notifications.gap", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderColorField("ed.notifications.icon_background", "styles.icon.background", config.styles.icon.background)}
                  ${this._renderColorField("ed.notifications.icon_color", "styles.icon.color", config.styles.icon.color)}
                  ${this._renderTextField("ed.notifications.icon_size", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderTextField("ed.notifications.title_size", "styles.title_size", config.styles.title_size)}
                  ${this._renderTextField("ed.notifications.item_radius", "styles.item_radius", config.styles.item_radius)}
                  ${this._renderColorField("ed.notifications.visual_tint", "styles.accent", config.styles.accent, { fullWidth: true })}
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
