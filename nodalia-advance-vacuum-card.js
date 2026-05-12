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

const CARD_TAG = "nodalia-advance-vacuum-card";
const EDITOR_TAG = "nodalia-advance-vacuum-card-editor";
const CARD_VERSION = "0.13.11";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
const CLEANING_SESSION_PENDING_TIMEOUT_MS = 45000;
/** English seeds when i18n is not loaded yet (avoid stuck Spanish on first paint). */
const MODE_LABELS = {
  all: "All",
  rooms: "Rooms",
  zone: "Zone",
  routines: "Routines",
  goto: "Go to point",
};

const PANEL_MODE_PRESETS = [
  { id: "smart", label: "Smart", icon: "mdi:brain" },
  { id: "vacuum_mop", label: "Vacuum & mop", icon: "mdi:robot-vacuum-variant" },
  { id: "vacuum", label: "Vacuum", icon: "mdi:weather-windy" },
  { id: "mop", label: "Mop", icon: "mdi:water" },
  { id: "custom", label: "Custom", icon: "mdi:tune-variant" },
];

const DOCK_PANEL_SECTIONS = [
  { id: "control", label: "Control de base", icon: "mdi:home-import-outline" },
  { id: "settings", label: "Ajuste de base de carga", icon: "mdi:cog-outline" },
];

const DOCK_SETTING_DEFINITIONS = [
  {
    id: "mop_wash_frequency",
    label: "Frecuencia de lavado de la mopa",
    entity_ids: ["input_select.frecuencia_lavado_mopa"],
    patterns: ["mop_wash_frequency", "wash_frequency", "washing_frequency", "frecuencia_lavado", "mop_wash"],
  },
  {
    id: "mop_mode",
    label: "Modo de fregado",
    entity_ids: ["input_select.modo_de_fregado"],
    patterns: ["modo_de_fregado", "mop_mode", "wash_mode", "dock_mop_mode", "washing_mode"],
  },
  {
    id: "auto_empty_frequency",
    label: "Frecuencia de vaciado automático",
    patterns: ["auto_empty_frequency", "empty_frequency", "dust_collection_frequency", "frecuencia_vaciado", "frecuencia_vaciado_automatico"],
  },
  {
    id: "empty_mode",
    label: "Modo de vaciado",
    entity_ids: ["input_select.modo_de_vaciado"],
    patterns: ["empty_mode", "dock_dust_collection_mode", "dust_collection_mode", "modo_vaciado"],
  },
  {
    id: "drying_duration",
    label: "Duración de secado",
    entity_ids: ["input_select.duracion_del_secado_de_la_mopa"],
    patterns: ["drying_duration", "dry_duration", "mop_dry_duration", "duracion_secado", "drying_time", "duracion_del_secado_de_la_mopa"],
  },
];

const DOCK_CONTROL_DEFINITIONS = [
  {
    id: "empty",
    label: "Vaciar depósito",
    active_label: "Parar vaciado",
    icon: "mdi:delete-empty-outline",
    active_icon: "mdi:stop-circle-outline",
    entity_ids: ["input_boolean.vaciar_deposito"],
    start_patterns: [
      "start_emptying",
      "start_empty",
      "start_dust_collection",
      "dust_collection",
      "collect_dust",
      "dock_empty",
      "auto_empty",
      "empty_dock",
    ],
    stop_patterns: [
      "stop_emptying",
      "stop_empty",
      "stop_dust_collection",
      "stop_collect_dust",
      "end_emptying",
    ],
  },
  {
    id: "wash",
    label: "Lavar el paño",
    active_label: "Parar lavado de paño",
    icon: "mdi:water",
    active_icon: "mdi:stop-circle-outline",
    entity_ids: ["input_boolean.lavar_mopa"],
    start_patterns: [
      "start_wash",
      "start_washing",
      "start_wash_mop",
      "wash_mop",
      "mop_wash",
      "clean_mop",
      "clean_mopping_pad",
      "self_clean",
    ],
    stop_patterns: [
      "stop_wash",
      "stop_washing",
      "stop_wash_mop",
      "stop_mop_wash",
      "stop_clean_mop",
      "stop_self_clean",
    ],
  },
  {
    id: "dry",
    label: "Secar la mopa",
    active_label: "Detener el secado",
    icon: "mdi:white-balance-sunny",
    active_icon: "mdi:stop-circle-outline",
    entity_ids: ["input_boolean.secado_de_mopa"],
    start_patterns: [
      "start_dry",
      "start_drying",
      "start_dry_mop",
      "mop_dry",
      "dry_mop",
      "air_dry",
      "drying",
    ],
    stop_patterns: [
      "stop_dry",
      "stop_drying",
      "stop_dry_mop",
      "stop_mop_dry",
      "stop_air_dry",
    ],
  },
];

const SUCTION_MODE_PATTERNS = [
  "quiet",
  "silent",
  "balanced",
  "standard",
  "normal",
  "turbo",
  "max",
  "strong",
  "gentle",
  "suction",
  "vacuum",
  "carpet",
];

const MOP_MODE_PATTERNS = [
  "mop",
  "water",
  "scrub",
  "wet",
  "off",
  "deep",
  "soak",
  "rinse",
];

const SHARED_SMART_MODE_PATTERNS = [
  "smart",
  "intelligent",
  "inteligente",
];
const VACUUM_MOP_COMBO_PATTERNS = [
  "vacuum_mop",
  "vacuum_and_mop",
  "mop_and_vacuum",
  "vacuum_mopping",
  "sweep_and_mop",
  "aspirado_y_fregado",
  "aspirar_y_fregar",
  "aspirado_fregado",
  "aspirar_fregar",
];
const VACUUM_ONLY_COMBO_PATTERNS = [
  "vacuum_only",
  "only_vacuum",
  "solo_aspirado",
  "solo_aspirar",
  "solo_aspiracion",
  "aspirado_solo",
  "vacuum",
  "sweep_only",
  "sweep",
];
const MOP_ONLY_COMBO_PATTERNS = [
  "mop_only",
  "only_mop",
  "solo_fregado",
  "solo_fregar",
  "fregado_solo",
  "mop",
  "mopping",
  "fregado",
  "fregar",
  "scrub_only",
  "wash_only",
];

const VACUUM_MODE_LABELS = {
  quiet: "Silencioso",
  silent: "Silencioso",
  balanced: "Equilibrado",
  standard: "Estándar",
  normal: "Normal",
  turbo: "Turbo",
  max: "Max",
  maxplus: "Max+",
  max_plus: "Max+",
  gentle: "Suave",
  strong: "Fuerte",
  smart: "Inteligente",
  smartmode: "Inteligente",
  smart_mode: "Inteligente",
  intelligent: "Inteligente",
  custom: "Personalizado",
  custommode: "Personalizado",
  custom_mode: "Personalizado",
  custom_water_flow: "Caudal de agua personalizado",
  custom_watter_flow: "Caudal de agua personalizado",
  off: "Sin fregado",
  low: "Baja",
  medium: "Media",
  high: "Alta",
  intense: "Intenso",
  deep: "Profundo",
  deep_plus: "Profundo+",
  deepplus: "Profundo+",
  fast: "Rápido",
  rapido: "Rápido",
};

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  vacuum_platform: "Roborock",
  map_source: {
    camera: "",
    image: "",
  },
  calibration_source: {
    camera: true,
    entity: "",
    calibration_points: [],
  },
  map_locked: true,
  two_finger_pan: false,
  language: "auto",
  show_state_chip: true,
  show_battery_chip: true,
  show_room_labels: true,
  show_room_markers: true,
  show_header_icons: true,
  show_return_to_base: true,
  show_stop: true,
  show_locate: true,
  show_all_mode: true,
  allow_segment_mode: true,
  allow_zone_mode: true,
  allow_goto_mode: true,
  max_zone_selections: 5,
  max_repeats: 3,
  shared_cleaning_session_entity: "",
  shared_cleaning_session_webhook: "",
  suction_select_entity: "",
  mop_select_entity: "",
  mop_mode_select_entity: "",
  custom_menu: {
    label: "Base",
    icon: "mdi:home-import-outline",
    items: [],
  },
  routines: [],
  room_segments: [],
  goto_points: [],
  predefined_zones: [],
  icons: [],
  map_modes: [],
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
    icon_animation: true,
    content_duration: 520,
    panel_duration: 420,
    button_bounce_duration: 320,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "32px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "16px",
      gap: "14px",
    },
    icon: {
      size: "64px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      active_color: "#61c97a",
      washing_color: "#5aa7ff",
      drying_color: "#f1c24c",
      emptying_color: "#9b6b4a",
      returning_color: "#f6b73c",
      error_color: "var(--error-color, #ff6b6b)",
      docked_color: "rgba(255, 255, 255, 0.56)",
    },
    chip_height: "26px",
    chip_font_size: "11px",
    chip_padding: "0 10px",
    title_size: "16px",
    map: {
      radius: "26px",
      marker_size: "34px",
      label_size: "12px",
      room_color: "rgba(97, 201, 122, 0.18)",
      room_border: "rgba(97, 201, 122, 0.55)",
      zone_color: "rgba(90, 167, 255, 0.18)",
      zone_border: "rgba(90, 167, 255, 0.72)",
      goto_color: "#f6b73c",
    },
    control: {
      size: "42px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(var(--rgb-primary-color), 0.18)",
    },
  },
};

const STUB_CONFIG = {
  entity: "vacuum.roborock_qrevo_s",
  name: "Roborock Qrevo S",
  vacuum_platform: "Roborock",
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

function getStubEntityId(hass, domains = []) {
  const states = hass?.states || {};
  const normalizedDomains = domains.map(domain => String(domain).trim()).filter(Boolean);
  return Object.keys(states).find(entityId => (
    !normalizedDomains.length || normalizedDomains.some(domain => entityId.startsWith(`${domain}.`))
  )) || "";
}

function applyStubEntity(config, hass, domains) {
  const entityId = getStubEntityId(hass, domains);
  if (!entityId) {
    return config;
  }

  config.entity = entityId;
  config.name = hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
  return config;
}

function mergeConfig(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override.map(item => deepClone(item)) : deepClone(base);
  }

  if (!isObject(base)) {
    return override === undefined ? base : override;
  }

  const result = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(override || {})]);

  keys.forEach(key => {
    const baseValue = base[key];
    const overrideValue = override ? override[key] : undefined;

    if (overrideValue === undefined) {
      result[key] = deepClone(baseValue);
      return;
    }

    if (Array.isArray(overrideValue)) {
      result[key] = deepClone(overrideValue);
      return;
    }

    if (isObject(baseValue) && isObject(overrideValue)) {
      result[key] = mergeConfig(baseValue, overrideValue);
      return;
    }

    result[key] = overrideValue;
  });

  return result;
}

function compactConfig(value) {
  if (Array.isArray(value)) {
    return value.map(item => compactConfig(item)).filter(item => item !== undefined);
  }

  if (isObject(value)) {
    const compacted = {};
    Object.entries(value).forEach(([key, item]) => {
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


function setByPath(target, path, value) {
  const parts = path.split(".");
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

function deleteByPath(target, path) {
  const parts = path.split(".");
  let cursor = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isObject(cursor[key]) && !Array.isArray(cursor[key])) {
      return;
    }
    cursor = cursor[key];
  }

  delete cursor[parts[parts.length - 1]];
}

function getByPath(target, path) {
  return path.split(".").reduce((cursor, key) => (
    cursor === undefined || cursor === null ? undefined : cursor[key]
  ), target);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeTextKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fireEvent(node, type, detail, options) {
  const event = new CustomEvent(type, {
    bubbles: options?.bubbles ?? true,
    cancelable: Boolean(options?.cancelable),
    composed: options?.composed ?? true,
    detail,
  });
  node.dispatchEvent(event);
  return event;
}

function isUnavailableState(state) {
  const key = normalizeTextKey(state?.state);
  return ["unavailable", "unknown", "none"].includes(key);
}

function parseNumber(value) {
  const numeric = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function sanitizeCssValue(value, fallback) {
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

function sanitizeStyleTree(candidate, fallback) {
  if (Array.isArray(fallback)) {
    return deepClone(fallback);
  }
  if (isObject(fallback)) {
    const out = {};
    Object.keys(fallback).forEach(key => {
      const nextCandidate = isObject(candidate) ? candidate[key] : undefined;
      out[key] = sanitizeStyleTree(nextCandidate, fallback[key]);
    });
    return out;
  }
  if (typeof fallback === "string") {
    return sanitizeCssValue(candidate, fallback);
  }
  if (typeof fallback === "number") {
    return Number.isFinite(Number(candidate)) ? Number(candidate) : fallback;
  }
  if (typeof fallback === "boolean") {
    return typeof candidate === "boolean" ? candidate : fallback;
  }
  return candidate === undefined ? deepClone(fallback) : candidate;
}

function getSafeStyles(styles = DEFAULT_CONFIG.styles) {
  return sanitizeStyleTree(styles, DEFAULT_CONFIG.styles);
}

function parseInteger(value, fallback = null) {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parsePoint(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  if (isObject(value)) {
    const x = Number(value.x);
    const y = Number(value.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  return null;
}

function parseZoneRect(value) {
  if (Array.isArray(value)) {
    if (value.length >= 4 && value.slice(0, 4).every(isFiniteScalar)) {
      const [rawX1, rawY1, rawX2, rawY2] = value.slice(0, 4).map(Number);
      if (rawX1 === rawX2 || rawY1 === rawY2) {
        return null;
      }
      return {
        x1: Math.min(rawX1, rawX2),
        y1: Math.min(rawY1, rawY2),
        x2: Math.max(rawX1, rawX2),
        y2: Math.max(rawY1, rawY2),
      };
    }

    if (value.length === 2 && value.every(isPointLike)) {
      const first = parsePoint(value[0]);
      const second = parsePoint(value[1]);
      if (first && second) {
        return {
          x1: Math.min(first.x, second.x),
          y1: Math.min(first.y, second.y),
          x2: Math.max(first.x, second.x),
          y2: Math.max(first.y, second.y),
        };
      }
    }

    return null;
  }

  if (!isObject(value)) {
    return null;
  }

  if (Array.isArray(value.zone)) {
    return parseZoneRect(value.zone);
  }

  if (Array.isArray(value.points)) {
    return parseZoneRect(value.points);
  }

  if (Array.isArray(value.coordinates)) {
    return parseZoneRect(value.coordinates);
  }

  const x1Candidate = value.x1 ?? value.left ?? value.min_x ?? value.start_x ?? value.x0 ?? value.x;
  const y1Candidate = value.y1 ?? value.top ?? value.min_y ?? value.start_y ?? value.y0 ?? value.y;
  let x2Candidate = value.x2 ?? value.right ?? value.max_x ?? value.end_x;
  let y2Candidate = value.y2 ?? value.bottom ?? value.max_y ?? value.end_y;
  const width = parseNumber(value.width ?? value.w);
  const height = parseNumber(value.height ?? value.h);

  if ((x2Candidate === undefined || y2Candidate === undefined) && Number.isFinite(width) && Number.isFinite(height)) {
    x2Candidate = Number(x1Candidate) + width;
    y2Candidate = Number(y1Candidate) + height;
  }

  const rawX1 = Number(x1Candidate);
  const rawY1 = Number(y1Candidate);
  const rawX2 = Number(x2Candidate);
  const rawY2 = Number(y2Candidate);
  if (![rawX1, rawY1, rawX2, rawY2].every(Number.isFinite)) {
    return null;
  }

  if (rawX1 === rawX2 || rawY1 === rawY2) {
    return null;
  }

  return {
    x1: Math.min(rawX1, rawX2),
    y1: Math.min(rawY1, rawY2),
    x2: Math.max(rawX1, rawX2),
    y2: Math.max(rawY1, rawY2),
  };
}

function appendQueryParam(url, key, value) {
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

function parseRectangleLike(value) {
  if (!isObject(value)) {
    return [];
  }

  const hasLegacyBounds = [value.x0, value.y0, value.x1, value.y1].every(item => Number.isFinite(Number(item)));
  const x1 = Number(hasLegacyBounds ? value.x0 : (value.x1 ?? value.left ?? value.min_x ?? value.start_x));
  const y1 = Number(hasLegacyBounds ? value.y0 : (value.y1 ?? value.top ?? value.min_y ?? value.start_y));
  const x2 = Number(hasLegacyBounds ? value.x1 : (value.x2 ?? value.right ?? value.max_x ?? value.end_x));
  const y2 = Number(hasLegacyBounds ? value.y1 : (value.y2 ?? value.bottom ?? value.max_y ?? value.end_y));
  if (![x1, y1, x2, y2].every(Number.isFinite)) {
    return [];
  }

  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

function parseOutline(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(point => parsePoint(point))
    .filter(Boolean);
}

function isFiniteScalar(value) {
  return Number.isFinite(Number(value));
}

function isPointLike(value) {
  return Boolean(parsePoint(value));
}

function isRectangleOutline(value) {
  return Array.isArray(value) && value.length === 4 && value.every(isFiniteScalar);
}

function parsePolygon(value) {
  if (isObject(value)) {
    if (Array.isArray(value.points)) {
      return parsePolygon(value.points);
    }
    if (Array.isArray(value.outline)) {
      return parsePolygon(value.outline);
    }
    return parseRectangleLike(value);
  }

  if (!Array.isArray(value)) {
    return [];
  }

  if (isRectangleOutline(value)) {
    const [x1, y1, x2, y2] = value.map(Number);
    return [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ];
  }

  const scalarPolygon = value.every(isFiniteScalar);
  if (scalarPolygon && value.length >= 6 && value.length % 2 === 0) {
    const points = [];
    for (let index = 0; index < value.length; index += 2) {
      points.push({
        x: Number(value[index]),
        y: Number(value[index + 1]),
      });
    }
    return points;
  }

  return value
    .map(point => parsePoint(point))
    .filter(Boolean);
}

function parseOutlines(value) {
  if (!Array.isArray(value) || !value.length) {
    return [];
  }

  const isSinglePolygon =
    value.every(isPointLike)
    || isRectangleOutline(value)
    || (value.every(isFiniteScalar) && value.length >= 6 && value.length % 2 === 0);

  if (isSinglePolygon) {
    const polygon = parsePolygon(value);
    return polygon.length >= 3 ? [polygon] : [];
  }

  const looksNestedCollection = value.every(item => Array.isArray(item) || isObject(item));

  if (looksNestedCollection) {
    return value
      .map(polygon => parsePolygon(polygon))
      .filter(polygon => polygon.length >= 3);
  }

  const polygon = parsePolygon(value);
  return polygon.length >= 3 ? [polygon] : [];
}

function flattenPolygons(polygons) {
  return arrayFromMaybe(polygons).flatMap(polygon => arrayFromMaybe(polygon));
}

function pickShapeSource(...sources) {
  return sources.find(source => {
    if (Array.isArray(source)) {
      return source.length > 0;
    }
    return isObject(source);
  });
}

function centroid(points) {
  if (!Array.isArray(points) || !points.length) {
    return { x: 0, y: 0 };
  }

  const sum = points.reduce((acc, point) => ({
    x: acc.x + point.x,
    y: acc.y + point.y,
  }), { x: 0, y: 0 });

  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}

function polygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += (current.x * next.y) - (next.x * current.y);
  }

  return Math.abs(area) / 2;
}

function polygonBounds(points) {
  if (!Array.isArray(points) || !points.length) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      width: 0,
      height: 0,
    };
  }

  const bounds = points.reduce((acc, point) => ({
    minX: Math.min(acc.minX, point.x),
    maxX: Math.max(acc.maxX, point.x),
    minY: Math.min(acc.minY, point.y),
    maxY: Math.max(acc.maxY, point.y),
  }), {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });

  return {
    ...bounds,
    width: Math.max(0, bounds.maxX - bounds.minX),
    height: Math.max(0, bounds.maxY - bounds.minY),
  };
}

function pointInPolygon(point, polygon) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) {
    return false;
  }

  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const minX = Math.min(currentPoint.x, previousPoint.x);
    const maxX = Math.max(currentPoint.x, previousPoint.x);
    const minY = Math.min(currentPoint.y, previousPoint.y);
    const maxY = Math.max(currentPoint.y, previousPoint.y);
    const crossProduct = ((point.y - currentPoint.y) * (previousPoint.x - currentPoint.x))
      - ((point.x - currentPoint.x) * (previousPoint.y - currentPoint.y));

    if (Math.abs(crossProduct) < 0.001 && point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
      return true;
    }

    const intersects = ((currentPoint.y > point.y) !== (previousPoint.y > point.y))
      && (point.x < (((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / ((previousPoint.y - currentPoint.y) || 1e-9)) + currentPoint.x);

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function rectIntersectionArea(firstRect, secondRect) {
  if (!firstRect || !secondRect) {
    return 0;
  }

  const width = Math.max(0, Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left));
  const height = Math.max(0, Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top));
  return width * height;
}

function arrayFromMaybe(value) {
  return Array.isArray(value) ? value : [];
}

function encodeSharedSessionList(values = []) {
  return arrayFromMaybe(values)
    .map(item => String(item || "").trim())
    .filter(Boolean)
    .map(item => encodeURIComponent(item))
    .join(",");
}

function decodeSharedSessionList(value = "") {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      try {
        return decodeURIComponent(item);
      } catch (_error) {
        return item;
      }
    })
    .filter(Boolean);
}

function encodeSharedSessionZones(zones = []) {
  return arrayFromMaybe(zones)
    .map(zone => parseZoneRect(zone))
    .filter(Boolean)
    .map(zone => `${Math.round(zone.x1)}:${Math.round(zone.y1)}:${Math.round(zone.x2)}:${Math.round(zone.y2)}`)
    .join(";");
}

function decodeSharedSessionZones(value = "") {
  return String(value || "")
    .split(";")
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => parseZoneRect(item.split(":").map(part => Number(part))))
    .filter(Boolean);
}

function sortByOrder(items) {
  return [...items].sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
}

function humanizeModeLabel(value, kind = "generic", hass = null, configLang = null) {
  if (window.NodaliaI18n?.translateAdvanceVacuumVacuumMode) {
    const h = hass ?? window.NodaliaI18n?.resolveHass?.(null);
    return window.NodaliaI18n.translateAdvanceVacuumVacuumMode(h, configLang ?? "auto", value, kind);
  }

  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const key = normalizeTextKey(raw);
  if (key === "off" && kind === "suction") {
    return "Off";
  }

  if (VACUUM_MODE_LABELS[key]) {
    return VACUUM_MODE_LABELS[key];
  }

  return raw
    .replaceAll("_", " ")
    .replace(/\bplus\b/gi, "+")
    .replace(/\b\w/g, match => match.toUpperCase());
}

function humanizeSelectOptionLabel(value, kind = "generic", hass = null, configLang = null) {
  const baseLabel = humanizeModeLabel(value, kind, hass, configLang);
  if (!baseLabel) {
    return "";
  }

  const normalized = baseLabel
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function normalizeCustomMenuItems(items) {
  return arrayFromMaybe(items)
    .filter(isObject)
    .map(item => ({
      label: String(item.label || item.name || "").trim(),
      icon: String(item.icon || "mdi:flash").trim(),
      visible_when: String(item.visible_when || "always").trim(),
      tap_action: isObject(item.tap_action) ? deepClone(item.tap_action) : null,
      builtin_action: String(item.builtin_action || "").trim(),
    }))
    .filter(item => item.label && (item.tap_action || item.builtin_action));
}

function normalizeRoutineItems(items) {
  return sortByOrder(
    arrayFromMaybe(items)
      .map(item => (typeof item === "string" ? { entity: item } : item))
      .filter(item => typeof item === "string" || isObject(item))
      .map(item => ({
        order: Number(item.order || 0),
        label: String(item.label || item.name || "").trim(),
        icon: String(item.icon || "").trim(),
        entity: String(item.entity || item.entity_id || "").trim(),
        service: String(item.service || item.perform_action || "").trim(),
        service_data: isObject(item.service_data) ? deepClone(item.service_data) : {},
        target: isObject(item.target) ? deepClone(item.target) : null,
        visible_when: String(item.visible_when || "always").trim(),
        tap_action: isObject(item.tap_action) ? deepClone(item.tap_action) : null,
      }))
      .filter(item => item.entity || item.service || item.tap_action)
  );
}

function solveLinearSystem(matrix, vector) {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    let pivotValue = Math.abs(augmented[column][column]);

    for (let row = column + 1; row < size; row += 1) {
      const candidate = Math.abs(augmented[row][column]);
      if (candidate > pivotValue) {
        pivotValue = candidate;
        pivotRow = row;
      }
    }

    if (pivotValue < 1e-10) {
      return null;
    }

    if (pivotRow !== column) {
      const tmp = augmented[column];
      augmented[column] = augmented[pivotRow];
      augmented[pivotRow] = tmp;
    }

    const divisor = augmented[column][column];
    for (let k = column; k <= size; k += 1) {
      augmented[column][k] /= divisor;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }

      const factor = augmented[row][column];
      for (let k = column; k <= size; k += 1) {
        augmented[row][k] -= factor * augmented[column][k];
      }
    }
  }

  return augmented.map(row => row[size]);
}

function invert3x3(matrix) {
  const [
    a, b, c,
    d, e, f,
    g, h, i,
  ] = matrix;

  const det = (
    a * (e * i - f * h) -
    b * (d * i - f * g) +
    c * (d * h - e * g)
  );

  if (Math.abs(det) < 1e-10) {
    return null;
  }

  const invDet = 1 / det;
  return [
    (e * i - f * h) * invDet,
    (c * h - b * i) * invDet,
    (b * f - c * e) * invDet,
    (f * g - d * i) * invDet,
    (a * i - c * g) * invDet,
    (c * d - a * f) * invDet,
    (d * h - e * g) * invDet,
    (b * g - a * h) * invDet,
    (a * e - b * d) * invDet,
  ];
}

function applyHomography(matrix, x, y) {
  const denominator = (matrix[6] * x) + (matrix[7] * y) + matrix[8];
  if (Math.abs(denominator) < 1e-10) {
    return { x, y };
  }

  return {
    x: ((matrix[0] * x) + (matrix[1] * y) + matrix[2]) / denominator,
    y: ((matrix[3] * x) + (matrix[4] * y) + matrix[5]) / denominator,
  };
}

function createAffineMatrix(fromPoints, toPoints) {
  const matrix = [];
  const vector = [];

  for (let index = 0; index < 3; index += 1) {
    const from = fromPoints[index];
    const to = toPoints[index];
    matrix.push([from.x, from.y, 1, 0, 0, 0]);
    matrix.push([0, 0, 0, from.x, from.y, 1]);
    vector.push(to.x);
    vector.push(to.y);
  }

  return solveLinearSystem(matrix, vector);
}

function applyAffineMatrix(matrix, x, y) {
  return {
    x: (matrix[0] * x) + (matrix[1] * y) + matrix[2],
    y: (matrix[3] * x) + (matrix[4] * y) + matrix[5],
  };
}

function createHomographyMatrix(fromPoints, toPoints) {
  const matrix = [];
  const vector = [];

  for (let index = 0; index < 4; index += 1) {
    const from = fromPoints[index];
    const to = toPoints[index];
    matrix.push([from.x, from.y, 1, 0, 0, 0, -(to.x * from.x), -(to.x * from.y)]);
    matrix.push([0, 0, 0, from.x, from.y, 1, -(to.y * from.x), -(to.y * from.y)]);
    vector.push(to.x);
    vector.push(to.y);
  }

  const solved = solveLinearSystem(matrix, vector);
  return solved ? [...solved, 1] : null;
}

class CoordinatesConverter {
  constructor(calibrationPoints) {
    this.calibrated = false;
    this.mode = "";
    this.vacuumToMapMatrix = null;
    this.mapToVacuumMatrix = null;

    const points = arrayFromMaybe(calibrationPoints)
      .map(point => ({
        map: parsePoint(point?.map),
        vacuum: parsePoint(point?.vacuum),
      }))
      .filter(point => point.map && point.vacuum);

    if (points.length === 3) {
      const vacuumPoints = points.map(point => point.vacuum);
      const mapPoints = points.map(point => point.map);
      const forward = createAffineMatrix(vacuumPoints, mapPoints);
      const reverse = createAffineMatrix(mapPoints, vacuumPoints);

      if (forward && reverse) {
        this.calibrated = true;
        this.mode = "affine";
        this.vacuumToMapMatrix = forward;
        this.mapToVacuumMatrix = reverse;
      }
      return;
    }

    if (points.length >= 4) {
      const vacuumPoints = points.slice(0, 4).map(point => point.vacuum);
      const mapPoints = points.slice(0, 4).map(point => point.map);
      const forward = createHomographyMatrix(vacuumPoints, mapPoints);
      const reverse = createHomographyMatrix(mapPoints, vacuumPoints);

      if (forward && reverse) {
        this.calibrated = true;
        this.mode = "projective";
        this.vacuumToMapMatrix = forward;
        this.mapToVacuumMatrix = reverse;
      }
    }
  }

  vacuumToMap(x, y) {
    if (!this.calibrated) {
      return { x, y };
    }

    if (this.mode === "affine") {
      return applyAffineMatrix(this.vacuumToMapMatrix, x, y);
    }

    return applyHomography(this.vacuumToMapMatrix, x, y);
  }

  mapToVacuum(x, y) {
    if (!this.calibrated) {
      return { x, y };
    }

    if (this.mode === "affine") {
      return applyAffineMatrix(this.mapToVacuumMatrix, x, y);
    }

    return applyHomography(this.mapToVacuumMatrix, x, y);
  }
}

function parseCalibrationPoints(config, hass) {
  const directPoints = arrayFromMaybe(config?.calibration_source?.calibration_points);
  if (directPoints.length) {
    return directPoints;
  }

  const calibrationEntityId = config?.calibration_source?.entity;
  if (calibrationEntityId && hass?.states?.[calibrationEntityId]?.attributes?.calibration_points) {
    return hass.states[calibrationEntityId].attributes.calibration_points;
  }

  if (config?.calibration_source?.camera === true) {
    const mapEntityId = config?.map_source?.camera || config?.map_camera || "";
    return hass?.states?.[mapEntityId]?.attributes?.calibration_points || [];
  }

  return [];
}

function resolveLegacyMode(config, templateName) {
  return arrayFromMaybe(config?.map_modes).find(mode => normalizeTextKey(mode?.template) === normalizeTextKey(templateName));
}

function resolveRoomsFromVacuumState(hass, entityId) {
  const vacuumState = entityId ? hass?.states?.[entityId] || null : null;
  const maps = arrayFromMaybe(vacuumState?.attributes?.maps);
  const mapWithRooms = maps.find(map => isObject(map?.rooms) && Object.keys(map.rooms).length > 0);
  if (!mapWithRooms) {
    return [];
  }

  return Object.entries(mapWithRooms.rooms).map(([id, label]) => ({
    id: String(id ?? ""),
    label: String(label || id || "").trim(),
    icon: "mdi:broom",
    outlines: [],
    outline: [],
    iconPoint: null,
    labelPoint: null,
    labelOffsetY: 0,
  })).filter(room => room.id);
}

function resolveRoomsFromMapState(hass, entityId) {
  const mapState = entityId ? hass?.states?.[entityId] || null : null;
  const rooms = mapState?.attributes?.rooms;
  if (!isObject(rooms) || !Object.keys(rooms).length) {
    return [];
  }

  return Object.entries(rooms).map(([id, room]) => {
    const shapeSource = pickShapeSource(
      room?.outlines,
      room?.outline,
      room?.zones,
      room?.rectangles,
      room?.segments,
      room?.areas,
      room?.polygons,
      room,
    );
    const outlines = Array.isArray(shapeSource)
      ? parseOutlines(shapeSource)
      : (() => {
          const polygon = parsePolygon(shapeSource);
          return polygon.length >= 3 ? [polygon] : [];
        })();
    const outline = flattenPolygons(outlines);
    const centerX = parseNumber(room?.pos_x);
    const centerY = parseNumber(room?.pos_y);
    const fallbackCenter = outline.length ? centroid(outline) : null;

    return {
      id: String(room?.number ?? id ?? ""),
      label: String(room?.name || room?.label || id || "").trim(),
      icon: "mdi:broom",
      outlines,
      outline,
      iconPoint: Number.isFinite(centerX) && Number.isFinite(centerY)
        ? { x: centerX, y: centerY }
        : fallbackCenter,
      labelPoint: Number.isFinite(centerX) && Number.isFinite(centerY)
        ? { x: centerX, y: centerY }
        : fallbackCenter,
      labelOffsetY: 0,
    };
  }).filter(room => room.id);
}

function resolveRoomSegments(config, hass = null, entityId = "", mapEntityId = "") {
  const directRooms = arrayFromMaybe(config?.room_segments);
  if (directRooms.length) {
    return directRooms.map(room => {
      const outlines = parseOutlines(pickShapeSource(
        room.outlines,
        room.outline,
        room.zones,
        room.rectangles,
        room.segments,
        room.areas,
        room.polygons,
      ));
      return {
        id: String(room.id ?? ""),
        label: room.label || room.name || room?.label?.text || "",
        icon: room.icon || room?.icon?.name || "mdi:broom",
        outlines,
        outline: flattenPolygons(outlines),
        iconPoint: parsePoint(room.iconPoint || room.icon || room.position),
        labelPoint: parsePoint(room.labelPoint || room.label || room.position),
        labelOffsetY: Number(room.labelOffsetY ?? room?.label?.offset_y ?? 0) || 0,
      };
    }).filter(room => room.id && room.outlines.length);
  }

  const segmentMode = resolveLegacyMode(config, "vacuum_clean_segment");
  const legacyRooms = arrayFromMaybe(segmentMode?.predefined_selections).map(selection => {
    const outlines = parseOutlines(pickShapeSource(
      selection?.outlines,
      selection?.outline,
      selection?.zones,
      selection?.rectangles,
      selection?.segments,
      selection?.areas,
      selection?.polygons,
    ));
    return {
      id: String(selection.id ?? ""),
      label: String(selection?.label?.text || selection?.label || selection?.text || selection.id || "").trim(),
      icon: String(selection?.icon?.name || selection?.icon || "mdi:broom").trim(),
      outlines,
      outline: flattenPolygons(outlines),
      iconPoint: parsePoint(selection?.icon),
      labelPoint: parsePoint(selection?.label),
      labelOffsetY: Number(selection?.label?.offset_y ?? 0) || 0,
    };
  }).filter(room => room.id && room.outlines.length);

  if (legacyRooms.length) {
    return legacyRooms;
  }

  const mapRooms = resolveRoomsFromMapState(hass, mapEntityId);
  if (mapRooms.length) {
    return mapRooms;
  }

  return resolveRoomsFromVacuumState(hass, entityId);
}

function resolveGotoPoints(config) {
  const directPoints = arrayFromMaybe(config?.goto_points);
  if (directPoints.length) {
    return directPoints.map(point => ({
      id: String(point.id || point.label || point.name || ""),
      label: point.label || point.name || point?.label?.text || "",
      icon: point.icon || point?.icon?.name || "mdi:map-marker",
      position: parsePoint(point.position),
    })).filter(point => point.position);
  }

  const gotoMode = resolveLegacyMode(config, "vacuum_goto_predefined");
  return arrayFromMaybe(gotoMode?.predefined_selections).map(point => ({
    id: String(point.id || point?.label?.text || point?.icon?.name || "goto"),
    label: String(point?.label?.text || point?.label || "").trim(),
    icon: String(point?.icon?.name || point?.icon || "mdi:map-marker").trim(),
    position: parsePoint(point.position),
  })).filter(point => point.position);
}

function resolvePredefinedZones(config) {
  const directZones = arrayFromMaybe(config?.predefined_zones);
  if (directZones.length) {
    return directZones.map(zone => ({
      id: String(zone.id || zone.label || zone.name || ""),
      label: zone.label || zone.name || zone?.label?.text || "",
      icon: zone.icon || zone?.icon?.name || "mdi:vector-rectangle",
      zones: arrayFromMaybe(zone.zones).map(item => arrayFromMaybe(item).map(Number)).filter(item => item.length >= 4),
      position: parsePoint(zone.position || zone.icon || zone.label),
    })).filter(zone => zone.zones.length);
  }

  const zoneMode = resolveLegacyMode(config, "vacuum_clean_zone_predefined");
  return arrayFromMaybe(zoneMode?.predefined_selections).map(zone => ({
    id: String(zone.id || zone?.label?.text || zone?.icon?.name || "zone"),
    label: String(zone?.label?.text || zone?.label || "").trim(),
    icon: String(zone?.icon?.name || zone?.icon || "mdi:vector-rectangle").trim(),
    zones: arrayFromMaybe(zone.zones).map(item => arrayFromMaybe(item).map(Number)).filter(item => item.length >= 4),
    position: parsePoint(zone?.icon || zone?.label),
  })).filter(zone => zone.zones.length);
}

function resolveHeaderIcons(config) {
  return sortByOrder(arrayFromMaybe(config?.icons)).map((item, index) => ({
    id: String(item.id || item.icon_id || index),
    icon: String(item.icon || "mdi:gesture-tap-button").trim(),
    tooltip: String(item.tooltip || item.label || "").trim(),
    order: Number(item.order || index),
    tap_action: isObject(item.tap_action) ? item.tap_action : {},
  }));
}

function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  config.custom_menu = mergeConfig(DEFAULT_CONFIG.custom_menu, config.custom_menu || {});
  config.custom_menu.items = normalizeCustomMenuItems(config.custom_menu.items);
  config.routines = normalizeRoutineItems(config.routines);
  config.shared_cleaning_session_webhook = String(config.shared_cleaning_session_webhook ?? "").trim();
  return config;
}

class NodaliaAdvanceVacuumCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["vacuum"]);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(DEFAULT_CONFIG);
    this._hass = null;
    this._mapImageWidth = 1024;
    this._mapImageHeight = 1024;
    this._activeMode = "all";
    this._activeUtilityPanel = null;
    this._selectedRoomIds = [];
    this._activeCleaningRoomIds = [];
    this._activeCleaningZones = [];
    this._activeCleaningSessionMode = "";
    this._selectedPredefinedZoneIds = [];
    this._manualZones = [];
    this._selectedManualZoneIndex = -1;
    this._transientZoneReturnMode = "";
    this._draftZone = null;
    this._gotoPoint = null;
    this._repeats = 1;
    this._activeSeries = "";
    this._activeModePanelPreset = "";
    this._activeDockPanelSection = DOCK_PANEL_SECTIONS[0]?.id || "control";
    this._lastNonSmartModeSelection = {
      suction: "",
      mop: "",
    };
    this._pendingRoomCleaningResumeRoomIds = [];
    this._pendingRoomCleaningResumeRepeats = 1;
    this._roomCleaningResumeInFlight = false;
    this._lastResolvedModePanelPreset = "";
    this._dockedModePanelPreset = "";
    this._hasLoadedPersistedCleaningSessionState = false;
    this._pendingCleaningSessionStartAt = 0;
    this._converter = new CoordinatesConverter([]);
    this._mapScale = 1;
    this._mapOffset = { x: 0, y: 0 };
    this._activeMapPointers = new Map();
    this._pinchGesture = null;
    this._touchPinchGesture = null;
    this._zoneHandleDrag = null;
    this._pendingTouchZoneStart = null;
    this._pendingRoomSelectionTap = null;
    this._pointerStart = null;
    this._pointerSurfaceRect = null;
    this._suppressedRoomSelectionClick = null;
    this._lastSubmittedSharedCleaningSessionValue = null;
    this._selectionUpdatedAt = 0;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._mapActionInFlight = false;

    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowChange = this._onShadowChange.bind(this);
    this._onShadowPointerDown = this._onShadowPointerDown.bind(this);
    this._onShadowPointerMove = this._onShadowPointerMove.bind(this);
    this._onShadowPointerUp = this._onShadowPointerUp.bind(this);
    this._onShadowTouchStart = this._onShadowTouchStart.bind(this);
    this._onShadowTouchMove = this._onShadowTouchMove.bind(this);
    this._onShadowTouchEnd = this._onShadowTouchEnd.bind(this);
    this._onMapImageLoad = this._onMapImageLoad.bind(this);
    this._onMapBackClick = this._onMapBackClick.bind(this);
    this._onNodaliaI18nReady = this._onNodaliaI18nReady.bind(this);

    this._localeReconciliationTimeouts = null;

    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("change", this._onShadowChange);
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown);
    this.shadowRoot.addEventListener("pointermove", this._onShadowPointerMove);
    this.shadowRoot.addEventListener("pointerup", this._onShadowPointerUp);
    this.shadowRoot.addEventListener("pointercancel", this._onShadowPointerUp);
    this.shadowRoot.addEventListener("pointerleave", this._onShadowPointerUp);
    this.shadowRoot.addEventListener("touchstart", this._onShadowTouchStart, { passive: false });
    this.shadowRoot.addEventListener("touchmove", this._onShadowTouchMove, { passive: false });
    this.shadowRoot.addEventListener("touchend", this._onShadowTouchEnd, { passive: false });
    this.shadowRoot.addEventListener("touchcancel", this._onShadowTouchEnd, { passive: false });
  }

  connectedCallback() {
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
    this._render();
    if (typeof window !== "undefined") {
      window.addEventListener("nodalia-i18n-ready", this._onNodaliaI18nReady);
    }
    this._scheduleLocaleReconciliation();
  }

  disconnectedCallback() {
    if (typeof window !== "undefined") {
      window.removeEventListener("nodalia-i18n-ready", this._onNodaliaI18nReady);
    }
    this._clearLocaleReconciliation();
    const image = this.shadowRoot?.querySelector("[data-map-image]");
    if (image) {
      image.removeEventListener("load", this._onMapImageLoad);
    }
    if (this._entranceAnimationResetTimer) {
      clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
  }

  _onNodaliaI18nReady() {
    this._reconcileI18nOrLocaleIfNeeded();
  }

  _reconcileI18nOrLocaleIfNeeded() {
    if (!this.isConnected || !this.shadowRoot) {
      return;
    }
    try {
      const nextSignature = this._getRenderSignature(this._hass);
      if (nextSignature === this._lastRenderSignature && this.shadowRoot.innerHTML) {
        return;
      }
      this._updateCalibration();
      this._render();
    } catch (_err) {
      // ignore
    }
  }

  _clearLocaleReconciliation() {
    if (this._localeReconciliationTimeouts?.length) {
      this._localeReconciliationTimeouts.forEach(id => {
        window.clearTimeout(id);
      });
      this._localeReconciliationTimeouts = null;
    }
  }

  /**
   * Re-render when `nodalia-i18n` loads after the first paint or when HA exposes UI language / locale
   * slightly later (signature includes `ui.resolvedLang` + `ui.i18nLoaded`; without this, `set hass`
   * may not run again and strings stay on fallbacks).
   */
  _scheduleLocaleReconciliation() {
    if (typeof window === "undefined") {
      return;
    }
    this._clearLocaleReconciliation();
    const run = () => {
      if (!this.isConnected) {
        return;
      }
      this._reconcileI18nOrLocaleIfNeeded();
    };
    queueMicrotask(run);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(run);
    });
    const delaysMs = [0, 200, 600, 1600, 4000];
    this._localeReconciliationTimeouts = delaysMs.map(ms => window.setTimeout(run, ms));
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._lastRenderSignature = "";
    this._repeats = clamp(Number(this._config.max_repeats || 1), 1, 9);
    this._selectedRoomIds = [];
    this._activeCleaningRoomIds = [];
    this._activeCleaningZones = [];
    this._activeCleaningSessionMode = "";
    this._selectedPredefinedZoneIds = [];
    this._manualZones = [];
    this._selectedManualZoneIndex = -1;
    this._transientZoneReturnMode = "";
    this._draftZone = null;
    this._gotoPoint = null;
    this._activeUtilityPanel = null;
    this._activeModePanelPreset = "";
    this._activeDockPanelSection = DOCK_PANEL_SECTIONS[0]?.id || "control";
    this._pendingRoomCleaningResumeRoomIds = [];
    this._pendingRoomCleaningResumeRepeats = this._repeats;
    this._roomCleaningResumeInFlight = false;
    this._lastResolvedModePanelPreset = "";
    this._dockedModePanelPreset = "";
    this._hasLoadedPersistedCleaningSessionState = false;
    this._pendingCleaningSessionStartAt = 0;
    this._mapScale = 1;
    this._mapOffset = { x: 0, y: 0 };
    this._activeMapPointers = new Map();
    this._pinchGesture = null;
    this._touchPinchGesture = null;
    this._zoneHandleDrag = null;
    this._pendingTouchZoneStart = null;
    this._pendingRoomSelectionTap = null;
    this._suppressedRoomSelectionClick = null;
    this._lastSubmittedSharedCleaningSessionValue = null;
    this._selectionUpdatedAt = 0;
    this._animateContentOnNextRender = true;
    this._activeMode = this._getAvailableModes()[0]?.id || "all";
    this._ensurePersistedCleaningSessionStateLoaded();
    this._updateCalibration();
    this._render();
  }

  set hass(hass) {
    try {
      this._hass = hass;
      this._ensurePersistedCleaningSessionStateLoaded();
      const nextSignature = this._getRenderSignature(hass);
      if (nextSignature === this._lastRenderSignature && this.shadowRoot?.innerHTML) {
        return;
      }
      this._updateCalibration();
      this._render();
    } catch (error) {
      this._handleCardError(error, "set hass");
    }
  }

  getCardSize() {
    return 8;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 5,
      min_columns: 6,
    };
  }

  _triggerHaptic(styleOverride = null) {
    const haptics = this._config?.haptics || {};
    if (haptics.enabled !== true) {
      return;
    }

    const style = styleOverride || haptics.style || "medium";
    fireEvent(this, "haptic", style, {
      bubbles: true,
      cancelable: false,
      composed: true,
    });

    if (haptics.fallback_vibrate === true && typeof navigator?.vibrate === "function") {
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection);
    }
  }

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;

    return {
      enabled: configuredAnimations.enabled !== false,
      iconAnimation: configuredAnimations.icon_animation !== false,
      contentDuration: clamp(Number(configuredAnimations.content_duration) || DEFAULT_CONFIG.animations.content_duration, 120, 2400),
      panelDuration: clamp(Number(configuredAnimations.panel_duration) || DEFAULT_CONFIG.animations.panel_duration, 120, 2000),
      buttonBounceDuration: clamp(Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration, 120, 1200),
    };
  }

  _scheduleEntranceAnimationReset(delay = 0) {
    if (this._entranceAnimationResetTimer) {
      clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }

    const safeDelay = clamp(Math.round(Number(delay) || 0), 0, 3000);
    if (!safeDelay || typeof window === "undefined") {
      this._animateContentOnNextRender = false;
      return;
    }

    this._entranceAnimationResetTimer = window.setTimeout(() => {
      this._entranceAnimationResetTimer = 0;
      this._animateContentOnNextRender = false;
    }, safeDelay);
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

  _getPressTargetFromEvent(event) {
    return event.composedPath().find(node => (
      node instanceof HTMLElement
      && (
        node.dataset?.zoneHandleIndex
        || node.dataset?.roomId
        || node.dataset?.zoneId
        || node.dataset?.gotoId
        || node.dataset?.modeId
        || node.dataset?.headerActionIndex
        || node.dataset?.manualZoneIndex
        || node.dataset?.controlAction
        || node.dataset?.modePresetId
        || node.dataset?.modeOptionKind
        || node.dataset?.dockSectionId
        || node.dataset?.dockActionId
        || node.dataset?.routineIndex
        || node.dataset?.customMenuIndex
      )
    ));
  }

  _getVacuumState() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _getName() {
    const state = this._getVacuumState();
    return this._config?.name || state?.attributes?.friendly_name || this._config?.entity || "Robot";
  }

  _getIcon() {
    const state = this._getVacuumState();
    return this._config?.icon || state?.attributes?.icon || "mdi:robot-vacuum";
  }

  _getReportedStateKey(state) {
    return normalizeTextKey(state?.state);
  }

  _matchesActivity(state, values) {
    const key = this._getReportedStateKey(state);
    return values.map(item => normalizeTextKey(item)).includes(key);
  }

  _isCleaning(state) {
    return this._matchesActivity(state, [
      "cleaning",
      "spot_cleaning",
      "segment_cleaning",
      "room_cleaning",
      "zone_cleaning",
      "clean_area",
      "vacuuming",
      "limpiando",
    ]);
  }

  _isPaused(state) {
    return this._matchesActivity(state, ["paused", "pause", "pausado"]);
  }

  _isWashingMops(state) {
    return this._matchesActivity(state, [
      "washing",
      "wash_mop",
      "mop_wash",
      "washing_mop",
      "washing_pads",
      "lavando_mopas",
      "lavando_mopa",
    ]);
  }

  _isDryingMops(state) {
    return this._matchesActivity(state, ["drying", "drying_mop", "secando", "secando_mopas"]);
  }

  _isAutoEmptying(state) {
    return this._matchesActivity(state, ["emptying", "self_emptying", "autovaciando", "vaciando"]);
  }

  _isReturning(state) {
    return this._matchesActivity(state, ["returning", "return_to_base", "returning_home", "volviendo"]);
  }

  _isDocked(state) {
    return this._matchesActivity(state, ["docked", "charging", "charging_completed", "en_base", "base"]);
  }

  _isActive(state) {
    return (
      this._isCleaning(state) ||
      this._isPaused(state) ||
      this._isReturning(state) ||
      this._isWashingMops(state) ||
      this._isDryingMops(state) ||
      this._isAutoEmptying(state)
    );
  }

  _getStateLabel(state) {
    const key = this._getReportedStateKey(state);
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const langCfg = this._config?.language ?? "auto";
    if (window.NodaliaI18n?.translateAdvanceVacuumReportedState) {
      return window.NodaliaI18n.translateAdvanceVacuumReportedState(hass, langCfg, key, state?.state);
    }

    const labels = {
      docked: "En base",
      charging: "Cargando",
      charging_completed: "Cargando",
      cleaning: "Limpiando",
      spot_cleaning: "Limpiando",
      segment_cleaning: "Limpiando",
      room_cleaning: "Limpiando",
      zone_cleaning: "Limpiando",
      clean_area: "Limpiando",
      paused: "Pausado",
      returning: "Volviendo a la base",
      return_to_base: "Volviendo a la base",
      returning_home: "Volviendo a la base",
      washing: "Lavando mopas",
      wash_mop: "Lavando mopas",
      washing_mop: "Lavando mopas",
      washing_pads: "Lavando mopas",
      drying: "Secando",
      drying_mop: "Secando",
      emptying: "Autovaciando",
      self_emptying: "Autovaciando",
      unavailable: "No disponible",
      unknown: "Desconocido",
      error: "Error",
    };

    return labels[key] || (state?.state ? String(state.state) : "Desconocido");
  }

  _descriptorLabel(kind) {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "es";
    if (!window.NodaliaI18n?.strings) {
      if (kind === "mop_mode") {
        return "Modo de mopa";
      }
      return kind === "mop" ? "Fregado" : "Aspirado";
    }
    const d = window.NodaliaI18n.strings(lang).advanceVacuum.descriptorLabels;
    if (kind === "mop_mode") {
      return d.mop_mode;
    }
    return kind === "mop" ? d.mop : d.suction;
  }

  _advanceVacuumStrings() {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "es";
    return window.NodaliaI18n?.strings?.(lang)?.advanceVacuum || null;
  }

  _getAccentColor(state) {
    const styles = getSafeStyles(this._config?.styles);

    if (this._getReportedStateKey(state) === "error") {
      return styles.icon.error_color || "#ff6b6b";
    }
    if (this._isWashingMops(state)) {
      return styles.icon.washing_color || "#5aa7ff";
    }
    if (this._isDryingMops(state)) {
      return styles.icon.drying_color || "#f1c24c";
    }
    if (this._isAutoEmptying(state)) {
      return styles.icon.emptying_color || "#9b6b4a";
    }
    if (this._isReturning(state)) {
      return styles.icon.returning_color || "#f6b73c";
    }
    if (this._isCleaning(state) || this._isPaused(state)) {
      return styles.icon.active_color || "#61c97a";
    }
    return styles.icon.docked_color || "rgba(255, 255, 255, 0.56)";
  }

  _getBatteryLevel(state) {
    const direct = Number(state?.attributes?.battery_level);
    if (Number.isFinite(direct)) {
      return clamp(Math.round(direct), 0, 100);
    }
    return null;
  }

  _getBatteryColor(level) {
    if (!Number.isFinite(level)) {
      return "rgba(255,255,255,0.62)";
    }
    if (level >= 70) {
      return "#61c97a";
    }
    if (level >= 35) {
      return "#f1c24c";
    }
    return "#ff8c69";
  }

  _getMapStatusIndicator(state = this._getVacuumState()) {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "es";
    const ms = window.NodaliaI18n?.strings?.(lang)?.advanceVacuum?.mapStatus;
    const activeDockControlIds = DOCK_CONTROL_DEFINITIONS
      .map(definition => this._getDockControlDescriptor(definition, state))
      .filter(descriptor => descriptor?.active)
      .map(descriptor => descriptor.id);

    if (activeDockControlIds.includes("wash") || this._isWashingMops(state)) {
      return {
        icon: "mdi:water",
        title: ms?.washing_mop ?? "Lavando la mopa",
        tone: "wash",
      };
    }

    if (activeDockControlIds.includes("dry") || this._isDryingMops(state)) {
      return {
        icon: "mdi:white-balance-sunny",
        title: ms?.drying_mop ?? "Secando la mopa",
        tone: "dry",
      };
    }

    if (activeDockControlIds.includes("empty") || this._isAutoEmptying(state)) {
      return {
        icon: "mdi:delete-empty-outline",
        title: ms?.emptying_dust ?? "Vaciando el polvo",
        tone: "empty",
      };
    }

    const batteryLevel = this._getBatteryLevel(state);
    if (this._isDocked(state) && Number.isFinite(batteryLevel) && batteryLevel < 100) {
      return {
        icon: "mdi:lightning-bolt",
        title: ms?.charging ?? "Cargando",
        tone: "charging",
      };
    }

    return null;
  }

  _getMapEntityId() {
    return this._config?.map_source?.camera || this._config?.map_source?.image || this._config?.map_camera || "";
  }

  _getMapState() {
    const entityId = this._getMapEntityId();
    return entityId ? this._hass?.states?.[entityId] || null : null;
  }

  _getCleaningSessionStorageKey() {
    const entityId = String(this._config?.entity || "").trim();
    return entityId ? `nodalia-advance-vacuum-card:cleaning-session:${entityId}` : "";
  }

  _getSharedCleaningSessionEntityId() {
    const entityId = String(this._config?.shared_cleaning_session_entity || "").trim();
    return entityId.startsWith("input_text.") ? entityId : "";
  }

  _getSharedCleaningSessionState() {
    return this._getEntityState(this._getSharedCleaningSessionEntityId());
  }

  _getSharedCleaningSessionMaxLength() {
    const maxLength = Number(this._getSharedCleaningSessionState()?.attributes?.max);
    return Number.isFinite(maxLength) && maxLength > 0 ? maxLength : 255;
  }

  _buildSharedCleaningSessionSnapshot(session, { minimal = false } = {}) {
    const normalizedSession = this._normalizeCleaningSession(session);
    if (!normalizedSession) {
      return null;
    }

    if (!minimal) {
      return normalizedSession;
    }

    const essentialRoomIds = normalizedSession.activeRoomIds.length
      ? normalizedSession.activeRoomIds
      : normalizedSession.selectedRoomIds;
    const essentialZones = normalizedSession.activeZones.length
      ? normalizedSession.activeZones
      : normalizedSession.manualZones;

    return this._normalizeCleaningSession({
      mode: normalizedSession.mode,
      activeMode: normalizedSession.activeMode,
      activeRoomIds: essentialRoomIds,
      activeZones: essentialZones,
      selectedRoomIds: essentialRoomIds,
      selectedPredefinedZoneIds: [],
      manualZones: [],
      repeats: normalizedSession.repeats,
      selectionUpdatedAt: normalizedSession.selectionUpdatedAt,
      pendingStartAt: normalizedSession.pendingStartAt,
      resumeRoomIdsAfterZone: normalizedSession.resumeRoomIdsAfterZone,
      resumeRepeatsAfterZone: normalizedSession.resumeRepeatsAfterZone,
      modePanelPreset: normalizedSession.modePanelPreset,
      utilityPanel: normalizedSession.utilityPanel,
    });
  }

  _serializeSharedCleaningSession(session, options = {}) {
    const snapshot = this._buildSharedCleaningSessionSnapshot(session, options);
    if (!snapshot) {
      return "";
    }

    const parts = ["v=1"];

    if (snapshot.mode) {
      parts.push(`m=${encodeURIComponent(snapshot.mode)}`);
    }
    if (snapshot.activeMode) {
      parts.push(`a=${encodeURIComponent(snapshot.activeMode)}`);
    }
    if (snapshot.activeRoomIds.length) {
      parts.push(`ar=${encodeSharedSessionList(snapshot.activeRoomIds)}`);
    }
    if (snapshot.activeZones.length) {
      parts.push(`az=${encodeSharedSessionZones(snapshot.activeZones)}`);
    }
    if (snapshot.selectedRoomIds.length) {
      parts.push(`sr=${encodeSharedSessionList(snapshot.selectedRoomIds)}`);
    }
    if (snapshot.selectedPredefinedZoneIds.length) {
      parts.push(`sz=${encodeSharedSessionList(snapshot.selectedPredefinedZoneIds)}`);
    }
    if (snapshot.manualZones.length) {
      parts.push(`mz=${encodeSharedSessionZones(snapshot.manualZones)}`);
    }
    if (snapshot.repeats) {
      parts.push(`r=${snapshot.repeats}`);
    }
    if (snapshot.selectionUpdatedAt) {
      parts.push(`su=${Math.round(snapshot.selectionUpdatedAt)}`);
    }
    if (snapshot.pendingStartAt) {
      parts.push(`p=${Math.round(snapshot.pendingStartAt)}`);
    }
    if (snapshot.resumeRoomIdsAfterZone?.length) {
      parts.push(`rr=${encodeSharedSessionList(snapshot.resumeRoomIdsAfterZone)}`);
    }
    if (snapshot.resumeRepeatsAfterZone) {
      parts.push(`rq=${snapshot.resumeRepeatsAfterZone}`);
    }
    if (snapshot.modePanelPreset) {
      parts.push(`pp=${encodeURIComponent(snapshot.modePanelPreset)}`);
    }
    if (snapshot.utilityPanel) {
      parts.push(`xu=${encodeURIComponent(snapshot.utilityPanel)}`);
    }

    return parts.join("&");
  }

  _deserializeSharedCleaningSession(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value) {
      return null;
    }

    if (value.startsWith("{")) {
      try {
        return this._normalizeCleaningSession(JSON.parse(value));
      } catch (_error) {
        return null;
      }
    }

    const params = new URLSearchParams(value);
    if ((params.get("v") || "") !== "1") {
      return null;
    }

    return this._normalizeCleaningSession({
      mode: params.get("m") || "",
      activeMode: params.get("a") || "",
      activeRoomIds: decodeSharedSessionList(params.get("ar")),
      activeZones: decodeSharedSessionZones(params.get("az")),
      selectedRoomIds: decodeSharedSessionList(params.get("sr")),
      selectedPredefinedZoneIds: decodeSharedSessionList(params.get("sz")),
      manualZones: decodeSharedSessionZones(params.get("mz")),
      repeats: Number(params.get("r") || 1),
      selectionUpdatedAt: Number(params.get("su") || 0),
      pendingStartAt: Number(params.get("p") || 0),
      resumeRoomIdsAfterZone: decodeSharedSessionList(params.get("rr")),
      resumeRepeatsAfterZone: Number(params.get("rq") || 1),
      modePanelPreset: params.get("pp") || "",
      utilityPanel: params.get("xu") || "",
    });
  }

  _readSharedCleaningSession() {
    const helperState = this._getSharedCleaningSessionState();
    const rawValue = String(helperState?.state || "").trim();
    if (!rawValue || isUnavailableState(helperState)) {
      return null;
    }

    this._lastSubmittedSharedCleaningSessionValue = rawValue;
    return this._deserializeSharedCleaningSession(rawValue);
  }

  _persistSharedCleaningSession(session) {
    const webhookId = String(this._config?.shared_cleaning_session_webhook ?? "").trim();
    const entityId = this._getSharedCleaningSessionEntityId();
    if (!webhookId && !entityId) {
      return;
    }

    const maxLength = entityId ? this._getSharedCleaningSessionMaxLength() : 255;
    let serialized = this._serializeSharedCleaningSession(session);

    if (serialized.length > maxLength) {
      serialized = this._serializeSharedCleaningSession(session, { minimal: true });
    }

    if (serialized.length > maxLength) {
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn("Nodalia Advance Vacuum Card shared cleaning session exceeds helper length limit");
      }
      return;
    }

    const serializedTrim = serialized.trim();
    const currentValue = entityId ? String(this._getSharedCleaningSessionState()?.state ?? "").trim() : "";
    const hasEntityTarget = Boolean(entityId);
    const hasWebhookTarget = Boolean(webhookId);
    if (hasEntityTarget && serializedTrim === currentValue) {
      return;
    }
    if (hasEntityTarget && serializedTrim === this._lastSubmittedSharedCleaningSessionValue) {
      return;
    }
    if (
      !hasEntityTarget &&
      hasWebhookTarget &&
      serializedTrim === this._lastSubmittedSharedCleaningSessionValue
    ) {
      return;
    }

    this._lastSubmittedSharedCleaningSessionValue = serializedTrim;

    if (webhookId) {
      const post =
        typeof window !== "undefined" && window.NodaliaUtils && typeof window.NodaliaUtils.postHomeAssistantWebhook === "function"
          ? window.NodaliaUtils.postHomeAssistantWebhook
          : null;
      if (!post) {
        this._lastSubmittedSharedCleaningSessionValue = null;
        if (typeof console !== "undefined" && typeof console.warn === "function") {
          console.warn(
            "Nodalia Advance Vacuum Card: Missing NodaliaUtils.postHomeAssistantWebhook (update nodalia-cards / nodalia-utils).",
          );
        }
        return;
      }
      void post(webhookId, { value: serializedTrim }, this._hass).then(ok => {
        if (!ok) {
          this._lastSubmittedSharedCleaningSessionValue = null;
          if (typeof console !== "undefined" && typeof console.warn === "function") {
            console.warn(
              "Nodalia Advance Vacuum Card: Persistence webhook rejected or failed; check webhook_id and your Home Assistant automation.",
            );
          }
        }
      });
      return;
    }

    const pending = this._callInternalService("input_text.set_value", {
      entity_id: entityId,
      value: serializedTrim,
    });
    if (pending && typeof pending.then === "function") {
      pending.catch(err => {
        this._lastSubmittedSharedCleaningSessionValue = null;
        if (typeof console !== "undefined" && typeof console.warn === "function") {
          console.warn("Nodalia Advance Vacuum Card: input_text.set_value failed", err);
          console.warn(
            "Nodalia Advance Vacuum Card: Non-admin users need control permission on the shared cleaning session input_text helper, or set shared_cleaning_session_webhook.",
          );
        }
      });
    }
  }

  _clearSharedCleaningSession() {
    const webhookId = String(this._config?.shared_cleaning_session_webhook ?? "").trim();
    const entityId = this._getSharedCleaningSessionEntityId();
    if (!webhookId && !entityId) {
      return;
    }

    if (webhookId) {
      const post =
        typeof window !== "undefined" && window.NodaliaUtils && typeof window.NodaliaUtils.postHomeAssistantWebhook === "function"
          ? window.NodaliaUtils.postHomeAssistantWebhook
          : null;
      if (post) {
        this._lastSubmittedSharedCleaningSessionValue = "";
        void post(webhookId, { value: "" }, this._hass).then(ok => {
          if (!ok && typeof console !== "undefined" && typeof console.warn === "function") {
            console.warn("Nodalia Advance Vacuum Card: Webhook clear for shared cleaning session failed.");
          }
        });
      } else if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn(
          "Nodalia Advance Vacuum Card: Missing NodaliaUtils.postHomeAssistantWebhook (update nodalia-cards / nodalia-utils).",
        );
      }
      return;
    }

    const currentValue = String(this._getSharedCleaningSessionState()?.state || "");
    if (
      (!currentValue || ["unknown", "unavailable"].includes(normalizeTextKey(currentValue)))
      && this._lastSubmittedSharedCleaningSessionValue === ""
    ) {
      return;
    }

    this._lastSubmittedSharedCleaningSessionValue = "";
    this._callInternalService("input_text.set_value", {
      entity_id: entityId,
      value: "",
    });
  }

  _normalizeCleaningSession(session) {
    if (!isObject(session)) {
      return null;
    }

    const mode = ["rooms", "zone"].includes(session.mode) ? session.mode : "";
    const activeMode = ["all", "rooms", "zone", "goto", "routines"].includes(session.activeMode)
      ? session.activeMode
      : "";
    const activeRoomIds = arrayFromMaybe(session.activeRoomIds)
      .map(item => String(item || "").trim())
      .filter(Boolean);
    const activeZones = arrayFromMaybe(session.activeZones)
      .map(zone => parseZoneRect(zone))
      .filter(Boolean);
    const selectedRoomIds = arrayFromMaybe(session.selectedRoomIds)
      .map(item => String(item || "").trim())
      .filter(Boolean);
    const selectedPredefinedZoneIds = arrayFromMaybe(session.selectedPredefinedZoneIds)
      .map(item => String(item || "").trim())
      .filter(Boolean);
    const manualZones = arrayFromMaybe(session.manualZones)
      .map(zone => parseZoneRect(zone))
      .filter(Boolean);
    const repeats = clamp(Number(session.repeats || 1), 1, 9);
    const selectionUpdatedAt = Number(session.selectionUpdatedAt || 0);
    const pendingStartAt = Number(session.pendingStartAt || 0);
    const resumeRoomIdsAfterZone = arrayFromMaybe(session.resumeRoomIdsAfterZone)
      .map(item => String(item || "").trim())
      .filter(Boolean);
    const resumeRepeatsAfterZone = clamp(Number(session.resumeRepeatsAfterZone || repeats || 1), 1, 9);
    const modePanelPreset = String(session.modePanelPreset ?? "").trim().slice(0, 64);
    const utilityPanel = String(session.utilityPanel ?? "").trim().slice(0, 64);

    if (
      !mode &&
      !activeMode &&
      !activeRoomIds.length &&
      !activeZones.length &&
      !selectedRoomIds.length &&
      !selectedPredefinedZoneIds.length &&
      !manualZones.length &&
      !selectionUpdatedAt &&
      !pendingStartAt &&
      !resumeRoomIdsAfterZone.length &&
      !modePanelPreset &&
      !utilityPanel
    ) {
      return null;
    }

    return {
      mode,
      activeMode,
      activeRoomIds,
      activeZones,
      selectedRoomIds,
      selectedPredefinedZoneIds,
      manualZones,
      repeats,
      selectionUpdatedAt,
      pendingStartAt,
      resumeRoomIdsAfterZone,
      resumeRepeatsAfterZone,
      modePanelPreset,
      utilityPanel,
    };
  }

  _restorePersistedCleaningSessionState() {
    const persistedSession = this._readStoredCleaningSession();
    if (!persistedSession) {
      return false;
    }

    this._selectedRoomIds = [...arrayFromMaybe(persistedSession.selectedRoomIds)];
    this._selectedPredefinedZoneIds = [...arrayFromMaybe(persistedSession.selectedPredefinedZoneIds)];
    this._manualZones = arrayFromMaybe(persistedSession.manualZones).map(zone => ({ ...zone }));
    this._selectedManualZoneIndex = this._manualZones.length > 0
      ? clamp(this._selectedManualZoneIndex, 0, this._manualZones.length - 1)
      : -1;
    this._activeCleaningRoomIds = [...arrayFromMaybe(persistedSession.activeRoomIds)];
    this._activeCleaningZones = arrayFromMaybe(persistedSession.activeZones).map(zone => ({ ...zone }));
    this._activeCleaningSessionMode = String(persistedSession.mode || "");
    this._selectionUpdatedAt = Number(persistedSession.selectionUpdatedAt || this._selectionUpdatedAt || 0);
    this._pendingCleaningSessionStartAt = Number(persistedSession.pendingStartAt || 0);
    this._pendingRoomCleaningResumeRoomIds = [...arrayFromMaybe(persistedSession.resumeRoomIdsAfterZone)];
    this._pendingRoomCleaningResumeRepeats = clamp(Number(persistedSession.resumeRepeatsAfterZone || this._repeats || 1), 1, 9);
    this._roomCleaningResumeInFlight = false;
    if (persistedSession.activeMode) {
      this._activeMode = persistedSession.activeMode;
    }
    this._repeats = clamp(Number(persistedSession.repeats || this._repeats || 1), 1, 9);
    const presetPersist = String(persistedSession.modePanelPreset ?? "").trim().slice(0, 64);
    if (presetPersist) {
      this._activeModePanelPreset = presetPersist;
      this._lastResolvedModePanelPreset = presetPersist;
    }
    const utilPersist = String(persistedSession.utilityPanel ?? "").trim().slice(0, 64);
    if (utilPersist) {
      this._activeUtilityPanel = utilPersist;
    }
    return true;
  }

  _ensurePersistedCleaningSessionStateLoaded() {
    if (this._hasLoadedPersistedCleaningSessionState) {
      return false;
    }

    const hasConfigEntity = Boolean(String(this._config?.entity || "").trim());
    if (!hasConfigEntity) {
      return false;
    }

    this._hasLoadedPersistedCleaningSessionState = true;
    return this._restorePersistedCleaningSessionState();
  }

  _markSelectionInteraction(timestamp = Date.now()) {
    const nextTimestamp = Math.max(0, Math.round(Number(timestamp) || Date.now()));
    this._selectionUpdatedAt = Math.max(this._selectionUpdatedAt || 0, nextTimestamp);
    return this._selectionUpdatedAt;
  }

  _syncRemoteInteractiveSelectionState(persistedSession = this._readStoredCleaningSession()) {
    if (this._zoneHandleDrag || this._draftZone || this._pendingTouchZoneStart) {
      return false;
    }

    const remoteSelectionUpdatedAt = Number(persistedSession?.selectionUpdatedAt || 0);
    if (!persistedSession || !remoteSelectionUpdatedAt || remoteSelectionUpdatedAt <= Number(this._selectionUpdatedAt || 0)) {
      return false;
    }

    this._selectedRoomIds = [...arrayFromMaybe(persistedSession.selectedRoomIds)];
    this._selectedPredefinedZoneIds = [...arrayFromMaybe(persistedSession.selectedPredefinedZoneIds)];
    this._manualZones = arrayFromMaybe(persistedSession.manualZones).map(zone => ({ ...zone }));
    this._selectedManualZoneIndex = this._manualZones.length > 0
      ? clamp(this._selectedManualZoneIndex, 0, this._manualZones.length - 1)
      : -1;
    this._repeats = clamp(Number(persistedSession.repeats || this._repeats || 1), 1, 9);

    if (persistedSession.activeMode) {
      this._activeMode = persistedSession.activeMode;
    }

    this._selectionUpdatedAt = remoteSelectionUpdatedAt;
    return true;
  }

  _persistCurrentCleaningSessionState(activeMode = this._activeMode, { markSelectionChange = false, selectionUpdatedAt = null } = {}) {
    const nextSelectionUpdatedAt = markSelectionChange
      ? this._markSelectionInteraction(selectionUpdatedAt || Date.now())
      : Number(this._selectionUpdatedAt || 0);

    this._persistCleaningSession({
      mode: this._activeCleaningSessionMode || "",
      activeMode,
      activeRoomIds: this._activeCleaningRoomIds,
      activeZones: this._activeCleaningZones,
      selectedRoomIds: this._selectedRoomIds,
      selectedPredefinedZoneIds: this._selectedPredefinedZoneIds,
      manualZones: this._manualZones,
      repeats: this._repeats,
      selectionUpdatedAt: nextSelectionUpdatedAt,
      pendingStartAt: this._pendingCleaningSessionStartAt,
      resumeRoomIdsAfterZone: this._pendingRoomCleaningResumeRoomIds,
      resumeRepeatsAfterZone: this._pendingRoomCleaningResumeRepeats,
      modePanelPreset: String(this._activeModePanelPreset || "").trim().slice(0, 64),
      utilityPanel: this._activeUtilityPanel ? String(this._activeUtilityPanel).trim().slice(0, 64) : "",
    });
  }

  _setPendingRoomCleaningResume(roomIds = [], repeats = this._repeats) {
    this._pendingRoomCleaningResumeRoomIds = [...new Set(arrayFromMaybe(roomIds)
      .map(item => String(item || "").trim())
      .filter(Boolean))];
    this._pendingRoomCleaningResumeRepeats = clamp(Number(repeats || this._repeats || 1), 1, 9);
  }

  _clearPendingRoomCleaningResume() {
    this._pendingRoomCleaningResumeRoomIds = [];
    this._pendingRoomCleaningResumeRepeats = clamp(Number(this._repeats || 1), 1, 9);
  }

  _getPendingRoomCleaningResumeState(persistedSession = this._readStoredCleaningSession()) {
    const hasInMemoryPendingResume = this._pendingRoomCleaningResumeRoomIds.length > 0;
    const roomIds = [...new Set([
      ...this._pendingRoomCleaningResumeRoomIds,
      ...arrayFromMaybe(persistedSession?.resumeRoomIdsAfterZone),
    ].map(item => String(item || "").trim()).filter(Boolean))];

    return {
      roomIds,
      repeats: clamp(
        Number(
          (hasInMemoryPendingResume ? this._pendingRoomCleaningResumeRepeats : 0)
          || persistedSession?.resumeRepeatsAfterZone
          || this._repeats
          || 1
        ),
        1,
        9,
      ),
    };
  }

  _getRoomCleaningResumeIds(state = this._getVacuumState(), persistedSession = this._readStoredCleaningSession()) {
    const orderedRoomIds = [...new Set([
      ...this._selectedRoomIds,
      ...arrayFromMaybe(persistedSession?.selectedRoomIds),
      ...this._getTrackedActiveCleaningRoomIds(persistedSession),
    ].map(item => String(item || "").trim()).filter(Boolean))];

    if (!orderedRoomIds.length) {
      return [];
    }

    const currentRoomId = this._getCurrentVacuumRoomId(state);
    if (currentRoomId && orderedRoomIds.includes(currentRoomId)) {
      return orderedRoomIds.slice(orderedRoomIds.indexOf(currentRoomId));
    }

    return orderedRoomIds;
  }

  _isCleaningSessionPendingStart(session = this._readStoredCleaningSession()) {
    const pendingStartAt = Number(session?.pendingStartAt || this._pendingCleaningSessionStartAt || 0);
    const timeoutMs = typeof CLEANING_SESSION_PENDING_TIMEOUT_MS === "number"
      ? CLEANING_SESSION_PENDING_TIMEOUT_MS
      : 45000;
    return pendingStartAt > 0 && (Date.now() - pendingStartAt) < timeoutMs;
  }

  _markCleaningSessionPendingStart() {
    this._pendingCleaningSessionStartAt = Date.now();
  }

  _clearCleaningSessionPendingStart() {
    this._pendingCleaningSessionStartAt = 0;
  }

  _readStoredCleaningSession() {
    const sharedSession = this._readSharedCleaningSession();
    if (sharedSession) {
      return sharedSession;
    }

    const key = this._getCleaningSessionStorageKey();
    if (!key || typeof window === "undefined" || !window.localStorage) {
      return null;
    }

    try {
      const rawValue = window.localStorage.getItem(key);
      if (!rawValue) {
        return null;
      }

      return this._normalizeCleaningSession(JSON.parse(rawValue));
    } catch (_error) {
      return null;
    }
  }

  _persistCleaningSession(session) {
    this._persistSharedCleaningSession(session);

    const key = this._getCleaningSessionStorageKey();
    if (!key || typeof window === "undefined" || !window.localStorage) {
      return;
    }

    const normalizedSession = this._normalizeCleaningSession(session);

    try {
      if (!normalizedSession) {
        window.localStorage.removeItem(key);
        return;
      }

      window.localStorage.setItem(key, JSON.stringify(normalizedSession));
    } catch (_error) {
      // Ignore storage quota/security errors and keep the in-memory state.
    }
  }

  _clearPersistedCleaningSession() {
    this._clearSharedCleaningSession();

    const key = this._getCleaningSessionStorageKey();
    if (!key || typeof window === "undefined" || !window.localStorage) {
      return;
    }

    try {
      window.localStorage.removeItem(key);
    } catch (_error) {
      // Ignore storage quota/security errors.
    }
  }

  _extractRoomIdsFromValue(value) {
    return arrayFromMaybe(value)
      .flatMap(item => {
        if (item === null || item === undefined) {
          return [];
        }

        if (typeof item === "object") {
          const candidate = item.id ?? item.room_id ?? item.segment_id ?? item.number;
          return candidate === null || candidate === undefined ? [] : [String(candidate)];
        }

        return [String(item)];
      })
      .map(item => item.trim())
      .filter(Boolean);
  }

  _getReportedCleaningRoomIds(state = this._getVacuumState()) {
    const mapState = this._getMapState();
    const candidates = [
      state?.attributes?.segments,
      state?.attributes?.segment_ids,
      state?.attributes?.selected_segments,
      state?.attributes?.selected_rooms,
      state?.attributes?.room_ids,
      state?.attributes?.rooms_to_clean,
      state?.attributes?.cleaning_segments,
      state?.attributes?.current_segments,
      mapState?.attributes?.selected_rooms,
      mapState?.attributes?.room_ids,
      mapState?.attributes?.segments,
    ];

    return [...new Set(candidates.flatMap(value => this._extractRoomIdsFromValue(value)))];
  }

  _getCurrentVacuumRoomId(state = this._getVacuumState()) {
    const mapState = this._getMapState();
    const candidate = (
      mapState?.attributes?.vacuum_room ??
      state?.attributes?.vacuum_room ??
      state?.attributes?.room_id ??
      state?.attributes?.current_room_id
    );

    if (candidate === null || candidate === undefined || candidate === "") {
      return "";
    }

    return String(candidate).trim();
  }

  _extractZoneRectsFromValue(value) {
    if (value === null || value === undefined) {
      return [];
    }

    if (Array.isArray(value)) {
      const directZone = parseZoneRect(value);
      if (directZone) {
        return [directZone];
      }

      return value.flatMap(item => this._extractZoneRectsFromValue(item));
    }

    if (!isObject(value)) {
      return [];
    }

    const directZone = parseZoneRect(value);
    if (directZone) {
      return [directZone];
    }

    return [
      value.zone,
      value.zones,
      value.rect,
      value.rects,
      value.rectangle,
      value.rectangles,
      value.area,
      value.areas,
      value.coordinates,
      value.points,
    ].flatMap(item => this._extractZoneRectsFromValue(item));
  }

  _getReportedCleaningZones(state = this._getVacuumState()) {
    const mapState = this._getMapState();
    const candidates = [
      state?.attributes?.zone,
      state?.attributes?.zones,
      state?.attributes?.selected_zones,
      state?.attributes?.cleaning_zone,
      state?.attributes?.cleaning_zones,
      state?.attributes?.current_zone,
      state?.attributes?.current_zones,
      state?.attributes?.active_zone,
      state?.attributes?.active_zones,
      state?.attributes?.zones_to_clean,
      mapState?.attributes?.zone,
      mapState?.attributes?.zones,
      mapState?.attributes?.selected_zones,
      mapState?.attributes?.cleaning_zone,
      mapState?.attributes?.cleaning_zones,
      mapState?.attributes?.current_zone,
      mapState?.attributes?.current_zones,
      mapState?.attributes?.active_zone,
      mapState?.attributes?.active_zones,
    ];

    const seen = new Set();
    return candidates
      .flatMap(value => this._extractZoneRectsFromValue(value))
      .filter(zone => {
        const key = `${zone.x1}:${zone.y1}:${zone.x2}:${zone.y2}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }

  _isCleaningSessionActive(state = this._getVacuumState(), persistedSession = this._readStoredCleaningSession()) {
    return this._isCleaning(state) || this._isPaused(state) || this._isReturning(state) || this._isCleaningSessionPendingStart(persistedSession);
  }

  _isRoomCleaningSessionActive(state = this._getVacuumState()) {
    const persistedSession = this._readStoredCleaningSession();
    return this._matchesActivity(state, ["segment_cleaning", "room_cleaning"]) || (
      this._isCleaningSessionActive(state, persistedSession) && (
        this._activeCleaningSessionMode === "rooms" ||
        persistedSession?.mode === "rooms" ||
        this._activeCleaningRoomIds.length > 0
      )
    );
  }

  _getTrackedActiveCleaningRoomIds(persistedSession = this._readStoredCleaningSession()) {
    return [...new Set([
      ...this._activeCleaningRoomIds,
      ...arrayFromMaybe(persistedSession?.activeRoomIds),
      ...this._selectedRoomIds,
      ...arrayFromMaybe(persistedSession?.selectedRoomIds),
    ].map(item => String(item || "").trim()).filter(Boolean))];
  }

  _hasMixedRoomZoneCleaningSession(persistedSession = this._readStoredCleaningSession(), reportedZones = []) {
    const sessionMode = String(this._activeCleaningSessionMode || persistedSession?.mode || "");
    if (sessionMode !== "rooms") {
      return false;
    }

    return Boolean(
      (Array.isArray(reportedZones) ? reportedZones.length : 0) ||
      this._activeCleaningZones.length ||
      arrayFromMaybe(persistedSession?.activeZones).length
    );
  }

  _attemptPendingRoomCleaningResume(state = this._getVacuumState(), persistedSession = this._readStoredCleaningSession()) {
    const pendingResume = this._getPendingRoomCleaningResumeState(persistedSession);
    if (!pendingResume.roomIds.length || this._roomCleaningResumeInFlight) {
      return false;
    }

    if (!state || isUnavailableState(state) || this._isCleaningSessionPendingStart(persistedSession)) {
      return false;
    }

    if (this._isCleaning(state) || this._isPaused(state)) {
      return false;
    }

    if (
      !this._isReturning(state) &&
      !this._isDocked(state) &&
      !this._matchesActivity(state, ["idle", "stopped", "ready"])
    ) {
      return false;
    }

    const segments = pendingResume.roomIds
      .map(id => parseInteger(id))
      .filter(Number.isFinite);
    if (!segments.length) {
      this._clearPendingRoomCleaningResume();
      this._persistCurrentCleaningSessionState(this._activeMode);
      return false;
    }

    this._roomCleaningResumeInFlight = true;
    this._clearPendingRoomCleaningResume();
    this._activeCleaningRoomIds = pendingResume.roomIds;
    this._activeCleaningZones = [];
    this._activeCleaningSessionMode = "rooms";
    this._markCleaningSessionPendingStart();
    this._persistCurrentCleaningSessionState("rooms");

    Promise.resolve(this._callInternalService("vacuum.send_command", {
      entity_id: this._config.entity,
      command: "app_segment_clean",
      params: [{
        segments,
        repeat: pendingResume.repeats,
      }],
    }))
      .then(() => {
        this._persistCurrentCleaningSessionState("rooms");
      })
      .catch(error => {
        this._clearCleaningSessionPendingStart();
        this._setPendingRoomCleaningResume(pendingResume.roomIds, pendingResume.repeats);
        this._persistCurrentCleaningSessionState("rooms");
        if (typeof console !== "undefined" && typeof console.error === "function") {
          console.error("Nodalia Advance Vacuum Card room resume error", error);
        }
      })
      .finally(() => {
        this._roomCleaningResumeInFlight = false;
        this._render();
      });

    return true;
  }

  _resolveActiveCleaningSessionMode(state = this._getVacuumState(), persistedSession = this._readStoredCleaningSession()) {
    if (!state || !this._isCleaningSessionActive(state, persistedSession)) {
      return "";
    }

    if (this._matchesActivity(state, ["segment_cleaning", "room_cleaning"])) {
      return "rooms";
    }

    if (this._activeCleaningRoomIds.length || persistedSession?.mode === "rooms") {
      return "rooms";
    }

    if (this._matchesActivity(state, ["zone_cleaning"])) {
      return "zone";
    }

    if (this._activeCleaningZones.length) {
      return persistedSession?.mode === "rooms" ? "rooms" : "zone";
    }

    return persistedSession?.mode || "";
  }

  _syncActiveCleaningSession(state = this._getVacuumState()) {
    const persistedSession = this._readStoredCleaningSession();
    this._syncRemoteInteractiveSelectionState(persistedSession);
    if ((!state || isUnavailableState(state)) && persistedSession) {
      if (!this._selectedRoomIds.length && persistedSession.selectedRoomIds?.length) {
        this._selectedRoomIds = [...persistedSession.selectedRoomIds];
      }
      if (!this._selectedPredefinedZoneIds.length && persistedSession.selectedPredefinedZoneIds?.length) {
        this._selectedPredefinedZoneIds = [...persistedSession.selectedPredefinedZoneIds];
      }
      if (!this._manualZones.length && persistedSession.manualZones?.length) {
        this._manualZones = persistedSession.manualZones.map(zone => ({ ...zone }));
      }
      if (!this._activeCleaningRoomIds.length && persistedSession.activeRoomIds?.length) {
        this._activeCleaningRoomIds = [...persistedSession.activeRoomIds];
      }
      if (!this._activeCleaningZones.length && persistedSession.activeZones?.length) {
        this._activeCleaningZones = persistedSession.activeZones.map(zone => ({ ...zone }));
      }
      if (!this._activeCleaningSessionMode && persistedSession.mode) {
        this._activeCleaningSessionMode = String(persistedSession.mode);
      }
      if (!this._pendingRoomCleaningResumeRoomIds.length && persistedSession.resumeRoomIdsAfterZone?.length) {
        this._pendingRoomCleaningResumeRoomIds = [...persistedSession.resumeRoomIdsAfterZone];
        this._pendingRoomCleaningResumeRepeats = clamp(Number(persistedSession.resumeRepeatsAfterZone || 1), 1, 9);
      }
      if (persistedSession.activeMode) {
        this._activeMode = persistedSession.activeMode;
      }
      return;
    }

    const reportedRoomIds = this._getReportedCleaningRoomIds(state);
    const reportedZones = this._getReportedCleaningZones(state);
    const trackedRoomIds = this._getTrackedActiveCleaningRoomIds(persistedSession);
    const hasMixedRoomZoneCleaningSession = this._hasMixedRoomZoneCleaningSession(persistedSession, reportedZones);
    const currentRoomId = this._getCurrentVacuumRoomId(state);
    const isRoomCleaning = this._matchesActivity(state, ["segment_cleaning", "room_cleaning"]);
    const isReportedCleaningSessionActive = this._isCleaning(state) || this._isPaused(state) || this._isReturning(state);
    const isCleaningSessionActive = this._isCleaningSessionActive(state, persistedSession);
    const hadTrackedCleaningSession = Boolean(
      this._activeCleaningSessionMode ||
      persistedSession?.mode ||
      this._activeCleaningRoomIds.length ||
      this._activeCleaningZones.length ||
      persistedSession?.activeRoomIds?.length ||
      persistedSession?.activeZones?.length ||
      this._pendingCleaningSessionStartAt ||
      persistedSession?.pendingStartAt ||
      this._getPendingRoomCleaningResumeState(persistedSession).roomIds.length
    );

    if (this._attemptPendingRoomCleaningResume(state, persistedSession)) {
      return;
    }

    if (reportedRoomIds.length) {
      this._activeCleaningRoomIds = hasMixedRoomZoneCleaningSession && trackedRoomIds.length
        ? trackedRoomIds
        : reportedRoomIds;
    } else if (isRoomCleaning && currentRoomId && !hasMixedRoomZoneCleaningSession) {
      this._activeCleaningRoomIds = [...new Set([currentRoomId, ...trackedRoomIds])];
    } else if (isCleaningSessionActive && persistedSession?.activeRoomIds?.length) {
      this._activeCleaningRoomIds = [...persistedSession.activeRoomIds];
    } else if (!isCleaningSessionActive) {
      this._activeCleaningRoomIds = [];
    }

    if (reportedZones.length) {
      this._activeCleaningZones = reportedZones;
    } else if (isCleaningSessionActive && persistedSession?.activeZones?.length) {
      this._activeCleaningZones = [...persistedSession.activeZones];
    } else if (!isCleaningSessionActive) {
      this._activeCleaningZones = [];
    }

    this._activeCleaningSessionMode = this._resolveActiveCleaningSessionMode(state, persistedSession);

    if (isReportedCleaningSessionActive && this._pendingCleaningSessionStartAt) {
      this._clearCleaningSessionPendingStart();
    }

    if (!isCleaningSessionActive) {
      this._activeCleaningSessionMode = "";
      this._clearCleaningSessionPendingStart();
      this._clearPendingRoomCleaningResume();
      this._roomCleaningResumeInFlight = false;
      if (hadTrackedCleaningSession) {
        this._selectedRoomIds = [];
        this._selectedPredefinedZoneIds = [];
        this._manualZones = [];
        this._selectedManualZoneIndex = -1;
        this._draftZone = null;
      }
      if (
        !this._selectedRoomIds.length &&
        !this._selectedPredefinedZoneIds.length &&
        !this._manualZones.length
      ) {
        this._clearPersistedCleaningSession();
      }
      return;
    }

    this._persistCurrentCleaningSessionState(this._activeCleaningSessionMode || this._activeMode);

    if (!this._transientZoneReturnMode && !["rooms", "zone", "goto"].includes(this._activeMode) && this._activeCleaningSessionMode) {
      this._activeMode = this._activeCleaningSessionMode;
    }
  }

  _getHighlightedRoomIds(state = this._getVacuumState()) {
    const highlighted = new Set(this._selectedRoomIds.map(id => String(id)));
    const hasMixedRoomZoneCleaningSession = this._hasMixedRoomZoneCleaningSession();

    if (this._isRoomCleaningSessionActive(state)) {
      this._activeCleaningRoomIds.forEach(id => highlighted.add(String(id)));
      const currentRoomId = this._getCurrentVacuumRoomId(state);
      if (currentRoomId && !hasMixedRoomZoneCleaningSession) {
        highlighted.add(currentRoomId);
      }
    }

    return [...highlighted];
  }

  _getMapImageUrl(state = this._getVacuumState()) {
    const mapState = this._getMapState();
    const entityId = this._getMapEntityId();
    if (!mapState || !this._hass) {
      return "";
    }

    const refreshToken = [
      String(mapState?.last_updated || mapState?.last_changed || ""),
      this._isCleaning(state) || this._isPaused(state) || this._isReturning(state)
        ? String(state?.last_updated || state?.last_changed || "")
        : "",
      String(this._getCurrentVacuumRoomId(state) || ""),
    ].filter(Boolean).join("|");

    const fromPicture = mapState.attributes?.entity_picture;
    if (fromPicture) {
      return appendQueryParam(this._hass.hassUrl(fromPicture), "nodalia_ts", refreshToken);
    }

    if (normalizeTextKey(entityId.split(".")[0]) === "image") {
      return appendQueryParam(this._hass.hassUrl(`/api/image_proxy/${entityId}`), "nodalia_ts", refreshToken);
    }

    return "";
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const mapEntityId = this._getMapEntityId();
    const mapState = mapEntityId ? hass?.states?.[mapEntityId] || null : null;
    const sharedSessionEntityId = this._getSharedCleaningSessionEntityId();
    const sharedSessionState = sharedSessionEntityId ? hass?.states?.[sharedSessionEntityId] || null : null;
    const mapPicture = String(mapState?.attributes?.entity_picture || "");
    const currentRoomId = this._getCurrentVacuumRoomId(state);
    const suctionDescriptor = this._getModeDescriptor("suction", state);
    const mopDescriptor = this._getModeDescriptor("mop", state);
    const mopModeDescriptor = this._getMopModeDescriptor(state);
    const dockControlDescriptors = this._getDockControlDescriptors(state);
    const dockSettingDescriptors = this._getDockSettingDescriptors(state);
    const routineSignature = this._getRoutineItems(state)
      .map(item => {
        const routineState = item.entity ? hass?.states?.[item.entity] || null : null;
        return `${item.entity || item.service || item.label}:${String(routineState?.state || "")}:${String(routineState?.last_updated || "")}`;
      })
      .join("|");

    return JSON.stringify({
      vacuum: {
        state: String(state?.state || ""),
        lastUpdated: String(state?.last_updated || ""),
        battery: Number(state?.attributes?.battery_level ?? -1),
        fanSpeed: String(state?.attributes?.fan_speed || ""),
        icon: String(this._getIcon() || ""),
        name: String(this._getName() || ""),
      },
      map: {
        entity: String(mapEntityId || ""),
        state: String(mapState?.state || ""),
        lastUpdated: String(mapState?.last_updated || ""),
        picture: mapPicture,
      },
      sharedSession: {
        entity: String(sharedSessionEntityId || ""),
        webhook: String(this._config?.shared_cleaning_session_webhook || "").trim(),
        state: String(sharedSessionState?.state || ""),
        lastUpdated: String(sharedSessionState?.last_updated || ""),
      },
      calibration: {
        camera: this._config?.calibration_source?.camera === true,
        entity: String(this._config?.calibration_source?.entity || ""),
        points: parseCalibrationPoints(this._config, this._hass).length,
      },
      activeMode: String(this._activeMode || ""),
      activeCleaningSessionMode: String(this._activeCleaningSessionMode || ""),
      transientZoneReturnMode: String(this._transientZoneReturnMode || ""),
      activeUtilityPanel: String(this._activeUtilityPanel || ""),
      activeModePanelPreset: String(this._activeModePanelPreset || ""),
      activeDockPanelSection: String(this._activeDockPanelSection || ""),
      selectedRooms: this._selectedRoomIds.join("|"),
      activeCleaningRooms: this._activeCleaningRoomIds.join("|"),
      activeCleaningZones: this._activeCleaningZones.map(zone => `${zone.x1}:${zone.y1}:${zone.x2}:${zone.y2}`).join("|"),
      currentRoom: currentRoomId,
      selectedZones: this._selectedPredefinedZoneIds.join("|"),
      manualZones: this._manualZones.length,
      goto: this._gotoPoint ? `${Math.round(this._gotoPoint.x)}:${Math.round(this._gotoPoint.y)}` : "",
      repeats: Number(this._repeats || 1),
      dimensions: `${this._mapImageWidth}x${this._mapImageHeight}`,
      modes: {
        suction: suctionDescriptor
          ? `${suctionDescriptor.service}:${suctionDescriptor.target}:${suctionDescriptor.current}:${suctionDescriptor.options.join("|")}`
          : "",
        mop: mopDescriptor
          ? `${mopDescriptor.service}:${mopDescriptor.target}:${mopDescriptor.current}:${mopDescriptor.options.join("|")}`
          : "",
        mopMode: mopModeDescriptor
          ? `${mopModeDescriptor.service}:${mopModeDescriptor.target}:${mopModeDescriptor.current}:${mopModeDescriptor.options.join("|")}`
          : "",
      },
      dock: {
        controls: dockControlDescriptors.map(descriptor => `${descriptor.id}:${descriptor.target}:${descriptor.active ? "1" : "0"}`).join("|"),
        settings: dockSettingDescriptors.map(descriptor => `${descriptor.id}:${descriptor.target}:${descriptor.current}:${descriptor.options.join("|")}`).join("|"),
      },
      routines: routineSignature,
      ui: {
        cfgLang: String(this._config?.language ?? "auto"),
        resolvedLang: String(
          typeof window !== "undefined"
            ? window.NodaliaI18n?.resolveLanguage?.(
                hass ?? window.NodaliaI18n?.resolveHass?.(null),
                this._config?.language ?? "auto",
              ) ?? ""
            : "",
        ),
        i18nLoaded: Boolean(typeof window !== "undefined" && window.NodaliaI18n?.strings),
      },
    });
  }

  _updateCalibration() {
    this._converter = new CoordinatesConverter(parseCalibrationPoints(this._config, this._hass));
  }

  _getRoomSegments() {
    return resolveRoomSegments(this._config, this._hass, this._config?.entity, this._getMapEntityId());
  }

  _getPredefinedZones() {
    return resolvePredefinedZones(this._config);
  }

  _getGotoPoints() {
    return resolveGotoPoints(this._config);
  }

  _getHeaderIcons() {
    return resolveHeaderIcons(this._config);
  }

  _getRoutineItems(state = this._getVacuumState()) {
    return normalizeRoutineItems(this._config?.routines)
      .filter(item => this._isMenuItemVisible(item, state));
  }

  _getAvailableModes() {
    const modeLabels = this._advanceVacuumStrings()?.modeLabels || MODE_LABELS;
    const modes = [];
    const showAllMode = this._config?.show_all_mode !== false;
    const hasRooms = this._getRoomSegments().length > 0;
    const hasZones = this._config?.allow_zone_mode !== false || this._getPredefinedZones().length > 0 || Boolean(resolveLegacyMode(this._config, "vacuum_clean_zone"));
    const hasRoutines = this._getRoutineItems().length > 0;

    if (showAllMode) {
      modes.push({ id: "all", label: modeLabels.all || MODE_LABELS.all, icon: "mdi:home" });
    }
    if (hasRooms && this._config?.allow_segment_mode !== false) {
      modes.push({ id: "rooms", label: modeLabels.rooms || MODE_LABELS.rooms, icon: "mdi:floor-plan" });
    }
    if (hasZones) {
      modes.push({ id: "zone", label: modeLabels.zone || MODE_LABELS.zone, icon: "mdi:vector-rectangle" });
    }
    if (hasRoutines) {
      modes.push({ id: "routines", label: modeLabels.routines || MODE_LABELS.routines, icon: "mdi:play-box-multiple-outline" });
    }

    return modes;
  }

  _getSelectOptions(entityId) {
    const selectState = entityId ? this._hass?.states?.[entityId] || null : null;
    const options = Array.isArray(selectState?.attributes?.options)
      ? selectState.attributes.options.map(item => String(item || "").trim()).filter(Boolean)
      : [];

    return {
      entityId,
      options,
      state: selectState,
      value: selectState?.state ? String(selectState.state) : "",
    };
  }

  _getModeEntityPatterns(kind) {
    return kind === "mop"
      ? [
        "mop_intensity",
        "intensidad_mopa",
        "mop_level",
        "mop",
        "water_level",
        "water_volume",
        "water_flow",
        "water_box_mode",
        "water_grade",
        "nivel_agua",
        "caudal_agua",
        "water",
      ]
      : [
        "vacuum_cleaner_mode",
        "vacuum_mode",
        "modo_aspirado",
        "suction_level",
        "suction_mode",
        "intensidad_aspirado",
        "fan_speed",
        "fan_power",
        "suction",
        "clean_mode",
        "cleaning_mode",
      ];
  }

  _getMopModeEntityPatterns() {
    return [
      "modo_mopa",
      "mop_mode",
      "scrub_mode",
      "scrub",
      "mop_route",
      "patron_mopa",
      "trayectoria_mopa",
    ];
  }

  _getEntityMatchScore(entityId, patterns) {
    const normalizedEntityId = normalizeTextKey(entityId);
    return patterns.reduce((bestScore, pattern, index) => {
      const normalizedPattern = normalizeTextKey(pattern);
      if (!normalizedPattern || !normalizedEntityId.includes(normalizedPattern)) {
        return bestScore;
      }

      return Math.max(bestScore, patterns.length - index);
    }, 0);
  }

  _guessRelatedEntityByPatterns(domain, patterns, excludedEntities = []) {
    if (!this._hass?.states || !this._config?.entity) {
      return "";
    }

    const objectId = String(this._config.entity).split(".")[1] || "";
    if (!objectId) {
      return "";
    }

    const candidates = Object.keys(this._hass.states)
      .filter(entityId => entityId.startsWith(`${domain}.`))
      .filter(entityId => entityId.includes(objectId))
      .filter(entityId => !excludedEntities.includes(entityId))
      .map(entityId => ({
        entityId,
        score: this._getEntityMatchScore(entityId, patterns),
      }))
      .filter(candidate => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.entityId.localeCompare(right.entityId, "es"));

    return candidates[0]?.entityId || "";
  }

  _guessRelatedSelectEntityByPatterns(patterns, excludedEntities = []) {
    return this._guessRelatedEntityByPatterns("select", patterns, excludedEntities);
  }

  _guessRelatedButtonEntityByPatterns(patterns, excludedEntities = []) {
    return this._guessRelatedEntityByPatterns("button", patterns, excludedEntities);
  }

  _guessGlobalEntityByPatterns(domains, patterns, excludedEntities = []) {
    if (!this._hass?.states || !Array.isArray(patterns) || !patterns.length) {
      return "";
    }

    const domainList = arrayFromMaybe(domains).map(domain => String(domain || "").trim()).filter(Boolean);
    if (!domainList.length) {
      return "";
    }

    const candidates = Object.keys(this._hass.states)
      .filter(entityId => domainList.some(domain => entityId.startsWith(`${domain}.`)))
      .filter(entityId => !excludedEntities.includes(entityId))
      .map(entityId => ({
        entityId,
        score: this._getEntityMatchScore(entityId, patterns),
      }))
      .filter(candidate => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.entityId.localeCompare(right.entityId, "es"));

    return candidates[0]?.entityId || "";
  }

  _getEntityState(entityId) {
    return entityId ? this._hass?.states?.[entityId] || null : null;
  }

  _getEntityDomain(entityId) {
    return String(entityId || "").split(".")[0] || "";
  }

  _findFirstAvailableEntity(entityIds = [], excludedEntities = []) {
    if (!this._hass?.states) {
      return "";
    }

    return arrayFromMaybe(entityIds)
      .map(entityId => String(entityId || "").trim())
      .find(entityId => entityId && !excludedEntities.includes(entityId) && this._hass.states[entityId]) || "";
  }

  _isBooleanEntityOn(entityId) {
    return normalizeTextKey(this._getEntityState(entityId)?.state) === "on";
  }

  _toggleBooleanEntity(entityId) {
    if (!this._hass || !entityId) {
      return;
    }

    this._hass.callService("homeassistant", this._isBooleanEntityOn(entityId) ? "turn_off" : "turn_on", {
      entity_id: entityId,
    });
  }

  _setEntityOption(entityId, value) {
    if (!this._hass || !entityId || !value) {
      return;
    }

    const domain = this._getEntityDomain(entityId);
    const serviceName = domain === "input_select" ? "input_select.select_option" : "select.select_option";
    this._callInternalService(serviceName, {
      entity_id: entityId,
      option: value,
    });
  }

  _guessRelatedSelectEntity(kind) {
    return this._guessRelatedSelectEntityByPatterns(this._getModeEntityPatterns(kind));
  }

  _categorizeModeOption(value) {
    const key = normalizeTextKey(value);

    if (MOP_MODE_PATTERNS.some(pattern => key.includes(pattern))) {
      return "mop";
    }

    if (SUCTION_MODE_PATTERNS.some(pattern => key.includes(pattern))) {
      return "suction";
    }

    return "unknown";
  }

  _isSharedSmartMode(value) {
    const key = normalizeTextKey(value);
    return SHARED_SMART_MODE_PATTERNS.some(pattern => key.includes(pattern));
  }

  _isOffModeValue(value) {
    return ["off", "apagado", "disabled", "none", "sin_fregado"].includes(normalizeTextKey(value));
  }

  _isCustomModeValue(value) {
    const key = normalizeTextKey(value);
    return key === "custom" || key.startsWith("custom_");
  }

  _getCleaningComboModeFromValue(value) {
    const key = normalizeTextKey(value);
    if (!key) {
      return "";
    }

    if (VACUUM_MOP_COMBO_PATTERNS.some(pattern => key === pattern || key.includes(pattern))) {
      return "vacuum_mop";
    }

    if (VACUUM_ONLY_COMBO_PATTERNS.some(pattern => key === pattern || key.includes(pattern)) || this._isOffModeValue(value)) {
      return "vacuum";
    }

    if (MOP_ONLY_COMBO_PATTERNS.some(pattern => key === pattern || key.includes(pattern))) {
      return "mop";
    }

    return "";
  }

  _descriptorSupportsCleaningCombo(descriptor) {
    return Boolean(descriptor?.options?.some(option => this._getCleaningComboModeFromValue(option)));
  }

  _getCleaningComboOptionForPreset(descriptor, presetId) {
    if (!this._descriptorSupportsCleaningCombo(descriptor)) {
      return "";
    }

    const targetMode = ["vacuum_mop", "vacuum", "mop"].includes(presetId) ? presetId : "";
    if (!targetMode) {
      return "";
    }

    return descriptor.options.find(option => this._getCleaningComboModeFromValue(option) === targetMode) || "";
  }

  _isMopIntensityDescriptor(descriptor) {
    if (!descriptor?.options?.length) {
      return false;
    }

    return descriptor.options.some(option => {
      const key = normalizeTextKey(option);
      return [
        "off",
        "apagado",
        "sin_fregado",
        "low",
        "medium",
        "media",
        "high",
        "alta",
        "intense",
        "deep",
      ].includes(key);
    });
  }

  _getFanPresets(state) {
    if (Array.isArray(state?.attributes?.fan_speed_list)) {
      return state.attributes.fan_speed_list
        .map(item => String(item || "").trim())
        .filter(Boolean);
    }

    return [];
  }

  _getCurrentFanSpeed(state) {
    const current = state?.attributes?.fan_speed;
    return current ? String(current) : "";
  }

  _getModeDescriptor(kind, state = this._getVacuumState()) {
    const explicitEntity = kind === "mop"
      ? this._config?.mop_select_entity
      : this._config?.suction_select_entity;
    const explicitDescriptor = explicitEntity ? this._getSelectOptions(explicitEntity) : null;
    const shouldUseExplicitDescriptor = kind !== "mop" || this._isMopIntensityDescriptor(explicitDescriptor);
    const selectEntity = shouldUseExplicitDescriptor && explicitDescriptor?.entityId
      ? explicitDescriptor.entityId
      : this._guessRelatedSelectEntity(kind);
    const descriptor = explicitDescriptor?.entityId === selectEntity
      ? explicitDescriptor
      : this._getSelectOptions(selectEntity);

    if (descriptor.entityId && descriptor.options.length) {
      return {
        kind,
        label: this._descriptorLabel(kind),
        target: descriptor.entityId,
        options: descriptor.options,
        current: descriptor.value,
        service: "select",
      };
    }

    const rawPresets = this._getFanPresets(state);
    if (!rawPresets.length) {
      return null;
    }

    const options = rawPresets.filter(option => {
      const optionKind = this._categorizeModeOption(option);
      const isSharedSmartMode = this._isSharedSmartMode(option);
      const isOffOption = normalizeTextKey(option) === "off";

      if (kind === "mop") {
        return optionKind === "mop" || isSharedSmartMode;
      }

      return optionKind !== "mop" || isSharedSmartMode || isOffOption;
    });

    if (!options.length) {
      return null;
    }

    return {
      kind,
      label: this._descriptorLabel(kind),
      target: this._config?.entity,
      options,
      current: this._getCurrentFanSpeed(state),
      service: "fan",
    };
  }

  _getModeDescriptors(state = this._getVacuumState()) {
    return ["suction", "mop", "mop_mode"]
      .map(kind => this._getModeDescriptorById(kind, state))
      .filter(Boolean);
  }

  _getMopModeDescriptor(state = this._getVacuumState()) {
    const explicitEntity = this._config?.mop_mode_select_entity || (
      this._config?.mop_select_entity && !this._isMopIntensityDescriptor(this._getSelectOptions(this._config?.mop_select_entity))
        ? this._config.mop_select_entity
        : ""
    );
    const explicitDescriptor = explicitEntity ? this._getSelectOptions(explicitEntity) : null;
    const excludedEntities = [this._getModeDescriptor("mop", state)?.target].filter(Boolean);
    const guessedEntity = explicitDescriptor?.entityId
      ? explicitDescriptor.entityId
      : this._guessRelatedSelectEntityByPatterns(this._getMopModeEntityPatterns(), excludedEntities);
    const descriptor = explicitDescriptor?.entityId === guessedEntity
      ? explicitDescriptor
      : this._getSelectOptions(guessedEntity);

    if (!descriptor?.entityId || !descriptor.options?.length) {
      return null;
    }

    return {
      kind: "mop_mode",
      label: this._descriptorLabel("mop_mode"),
      target: descriptor.entityId,
      options: descriptor.options,
      current: descriptor.value,
      service: "select",
    };
  }

  _getModeDescriptorById(descriptorId, state = this._getVacuumState()) {
    if (descriptorId === "mop_mode") {
      return this._getMopModeDescriptor(state);
    }

    return this._getModeDescriptor(descriptorId, state);
  }

  _getDockPanelSectionConfig(sectionId = this._activeDockPanelSection) {
    return DOCK_PANEL_SECTIONS.find(section => section.id === sectionId) || DOCK_PANEL_SECTIONS[0];
  }

  _setActiveDockPanelSection(sectionId) {
    if (!sectionId || sectionId === this._activeDockPanelSection) {
      return;
    }

    this._activeDockPanelSection = sectionId;
    this._triggerHaptic("selection");
    this._render();
  }

  _getDockControlState(definition, state) {
    switch (definition?.id) {
      case "empty":
        return this._isAutoEmptying(state);
      case "wash":
        return this._isWashingMops(state);
      case "dry":
        return this._isDryingMops(state);
      default:
        return false;
    }
  }

  _getDockControlDescriptor(definition, state = this._getVacuumState()) {
    if (!definition) {
      return null;
    }

    const dockControlLabels = this._advanceVacuumStrings()?.dockControls?.[definition.id];
    const inactiveLabel = dockControlLabels?.label || definition.label;
    const activeLabel = dockControlLabels?.active || definition.active_label || definition.label;

    const toggleEntity = this._findFirstAvailableEntity(definition.entity_ids || []);
    if (toggleEntity) {
      const isActive = this._isBooleanEntityOn(toggleEntity);
      return {
        id: definition.id,
        label: isActive ? activeLabel : inactiveLabel,
        icon: isActive ? definition.active_icon || definition.icon : definition.icon,
        target: toggleEntity,
        active: isActive,
        type: "toggle",
      };
    }

    const startEntity = this._guessGlobalEntityByPatterns(["button"], definition.start_patterns || []);
    const stopEntity = this._guessGlobalEntityByPatterns(["button"], definition.stop_patterns || [], [startEntity].filter(Boolean));
    const isActive = this._getDockControlState(definition, state);
    const target = isActive ? stopEntity || startEntity : startEntity || stopEntity;

    if (!target) {
      return null;
    }

    return {
      id: definition.id,
      label: isActive ? activeLabel : inactiveLabel,
      icon: isActive ? definition.active_icon || definition.icon : definition.icon,
      target,
      active: isActive,
      type: "button",
    };
  }

  _getDockControlDescriptors(state = this._getVacuumState()) {
    const actions = this._advanceVacuumStrings()?.actions;
    const isCleaningSessionActive = this._isCleaningSessionActive(state);
    if (isCleaningSessionActive) {
      const descriptors = [];

      if (this._config?.show_return_to_base !== false && !this._isDocked(state)) {
        descriptors.push({
          id: "return_to_base",
          label: actions?.returnToBase || "Volver a base",
          icon: "mdi:home-import-outline",
          builtin_action: "return_to_base",
        });
      }

      if (this._config?.show_locate !== false) {
        descriptors.push({
          id: "locate",
          label: actions?.locate || "Localizar",
          icon: "mdi:crosshairs-gps",
          builtin_action: "locate",
        });
      }

      return descriptors;
    }

    return DOCK_CONTROL_DEFINITIONS
      .map(definition => this._getDockControlDescriptor(definition, state))
      .filter(Boolean);
  }

  _getDockSettingDescriptor(definition, state = this._getVacuumState()) {
    if (!definition) {
      return null;
    }

    const dockSettingLabel = this._advanceVacuumStrings()?.dockSettings?.[definition.id] || definition.label;
    const explicitEntity = this._findFirstAvailableEntity(definition.entity_ids || []);
    const entityId = explicitEntity || this._guessGlobalEntityByPatterns(["input_select", "select"], definition.patterns || []);
    const descriptor = this._getSelectOptions(entityId);
    if (descriptor?.entityId && descriptor.options?.length) {
      return {
        id: definition.id,
        label: dockSettingLabel,
        target: descriptor.entityId,
        options: descriptor.options,
        current: descriptor.value,
      };
    }

    if (definition.id === "mop_mode") {
      const mopModeDescriptor = this._getMopModeDescriptor(state);
      return mopModeDescriptor
        ? {
            id: definition.id,
            label: dockSettingLabel,
            target: mopModeDescriptor.target,
            options: mopModeDescriptor.options,
            current: mopModeDescriptor.current,
          }
        : null;
    }

    return null;
  }

  _getDockSettingDescriptors(state = this._getVacuumState()) {
    return DOCK_SETTING_DEFINITIONS
      .map(definition => this._getDockSettingDescriptor(definition, state))
      .filter(Boolean);
  }

  _getRoutineEntityState(item) {
    const entityId = String(item?.entity || "").trim();
    return entityId ? this._hass?.states?.[entityId] || null : null;
  }

  _getRoutineLabel(item, entityState = this._getRoutineEntityState(item)) {
    const explicitLabel = String(item?.label || "").trim();
    if (explicitLabel) {
      return explicitLabel;
    }

    const friendlyName = String(entityState?.attributes?.friendly_name || "").trim();
    if (friendlyName) {
      return friendlyName;
    }

    const entityId = String(item?.entity || "").trim();
    const objectId = entityId.includes(".") ? entityId.split(".").slice(1).join(".") : entityId;
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const langCfg = this._config?.language ?? "auto";
    if (!String(objectId || "").trim()) {
      const lang = window.NodaliaI18n?.resolveLanguage?.(hass, langCfg) ?? "es";
      return window.NodaliaI18n?.strings?.(lang)?.advanceVacuum?.utility?.routineDefault || "Rutina";
    }
    return humanizeModeLabel(objectId, "generic", hass, langCfg);
  }

  _getRoutineIcon(item, entityState = this._getRoutineEntityState(item)) {
    const explicitIcon = String(item?.icon || "").trim();
    if (explicitIcon) {
      return explicitIcon;
    }

    const entityIcon = String(entityState?.attributes?.icon || "").trim();
    if (entityIcon) {
      return entityIcon;
    }

    const routineKey = normalizeTextKey([
      this._getRoutineLabel(item, entityState),
      String(item?.entity || ""),
    ].filter(Boolean).join(" "));

    if (routineKey.includes("comeder") || routineKey.includes("food")) {
      return "mdi:food-variant";
    }
    if (routineKey.includes("profund") || routineKey.includes("deep")) {
      return "mdi:layers-triple";
    }
    if (routineKey.includes("intensiv") || routineKey.includes("turbo")) {
      return "mdi:weather-windy";
    }
    if (routineKey.includes("fregar") || routineKey.includes("mopa") || routineKey.includes("mop") || routineKey.includes("wash")) {
      return "mdi:water";
    }
    if (routineKey.includes("completa") || routineKey.includes("complete") || routineKey.includes("full")) {
      return "mdi:broom";
    }
    if (routineKey.includes("comida") || routineKey.includes("meal")) {
      return "mdi:silverware-fork-knife";
    }

    return "mdi:play-box-outline";
  }

  _pressButtonEntity(entityId) {
    if (!this._hass || !entityId) {
      return;
    }

    this._hass.callService("button", "press", {
      entity_id: entityId,
    });
  }

  _runDockControlAction(actionId, state = this._getVacuumState()) {
    if (actionId === "return_to_base" || actionId === "locate") {
      this._handleControlAction(actionId);
      return;
    }

    const descriptor = this._getDockControlDescriptors(state).find(item => item.id === actionId);
    if (!descriptor?.target) {
      return;
    }

    if (descriptor.type === "toggle") {
      this._toggleBooleanEntity(descriptor.target);
    } else {
      this._pressButtonEntity(descriptor.target);
    }
    this._triggerHaptic("selection");
  }

  _runRoutineItem(item) {
    if (!item) {
      return;
    }

    const entityId = String(item.entity || "").trim();
    const entityState = this._getRoutineEntityState(item);
    if (entityId && isUnavailableState(entityState)) {
      return;
    }

    if (item.tap_action) {
      this._triggerHaptic("selection");
      this._runExternalAction(item.tap_action);
      return;
    }

    if (item.service) {
      const serviceData = isObject(item.service_data) ? deepClone(item.service_data) : {};
      if (entityId && !serviceData.entity_id) {
        serviceData.entity_id = entityId;
      }
      this._callNamedService(item.service, serviceData, item.target || null);
      this._triggerHaptic("selection");
      return;
    }

    const domain = entityId.split(".")[0] || "";
    if (domain === "button") {
      this._pressButtonEntity(entityId);
    } else if (domain === "input_button") {
      this._callNamedService("input_button.press", {
        entity_id: entityId,
      });
    } else if (domain === "script") {
      this._callNamedService("script.turn_on", {
        entity_id: entityId,
      });
    } else if (domain === "scene") {
      this._callNamedService("scene.turn_on", {
        entity_id: entityId,
      });
    } else if (domain === "automation") {
      this._callNamedService("automation.trigger", {
        entity_id: entityId,
      });
    } else if (entityId) {
      this._runExternalAction({
        action: "more_info",
        entity: entityId,
      });
      this._triggerHaptic("selection");
      return;
    } else {
      return;
    }

    this._triggerHaptic("selection");
  }

  _setDockSettingOption(settingId, value, state = this._getVacuumState()) {
    if (!this._hass || !settingId || !value) {
      return;
    }

    const descriptor = this._getDockSettingDescriptors(state).find(item => item.id === settingId);
    if (!descriptor?.target) {
      return;
    }

    this._setEntityOption(descriptor.target, value);
    this._triggerHaptic("selection");
  }

  _findMatchingModeOption(options, value) {
    const expectedKey = normalizeTextKey(value);
    if (!expectedKey || !Array.isArray(options)) {
      return "";
    }

    return options.find(option => normalizeTextKey(option) === expectedKey) || "";
  }

  _findSharedSmartOption(options) {
    return Array.isArray(options)
      ? options.find(option => this._isSharedSmartMode(option)) || ""
      : "";
  }

  _getModeFallbackCandidates(kind) {
    return kind === "mop"
      ? ["off", "low", "medium", "high", "deep", "standard", "normal", "custom"]
      : ["balanced", "standard", "normal", "quiet", "silent", "gentle", "turbo", "max", "strong", "custom"];
  }

  _getModeFallbackOption(kind, descriptor) {
    if (!descriptor?.options?.length) {
      return "";
    }

    const remembered = this._findMatchingModeOption(
      descriptor.options,
      this._lastNonSmartModeSelection[kind],
    );
    if (remembered && !this._isSharedSmartMode(remembered)) {
      return remembered;
    }

    const normalizedOptions = descriptor.options.map(option => ({
      key: normalizeTextKey(option),
      value: option,
    }));

    for (const candidate of this._getModeFallbackCandidates(kind)) {
      const exactMatch = normalizedOptions.find(option => option.key === candidate);
      if (exactMatch && !this._isSharedSmartMode(exactMatch.value)) {
        return exactMatch.value;
      }
    }

    const firstNonSmart = descriptor.options.find(option => !this._isSharedSmartMode(option));
    return firstNonSmart || "";
  }

  _rememberNonSmartModeSelection(kind, value) {
    if (!kind || !value || this._isSharedSmartMode(value)) {
      return;
    }

    this._lastNonSmartModeSelection[kind] = value;
  }

  _syncRememberedModeSelections(state) {
    if (this._isDocked(state) || this._isReturning(state)) {
      return;
    }

    ["suction", "mop"].forEach(kind => {
      const descriptor = this._getModeDescriptor(kind, state);
      if (descriptor?.current && !this._isSharedSmartMode(descriptor.current)) {
        this._rememberNonSmartModeSelection(kind, descriptor.current);
      }
    });
  }

  _applyLinkedSmartModeSelection(kind, value, state) {
    const descriptor = this._getModeDescriptor(kind, state);
    const otherKind = kind === "mop" ? "suction" : "mop";
    const otherDescriptor = this._getModeDescriptor(otherKind, state);

    if (descriptor?.service === "select" && descriptor.target && value) {
      this._hass.callService("select", "select_option", {
        entity_id: descriptor.target,
        option: value,
      });
    } else if (descriptor?.service === "fan" && value) {
      this._callVacuumService("set_fan_speed", {
        fan_speed: value,
      });
      return;
    }

    if (!descriptor || !otherDescriptor || otherDescriptor.service !== "select" || !otherDescriptor.target) {
      return;
    }

    if (otherDescriptor.target === descriptor.target) {
      return;
    }

    if (this._isSharedSmartMode(value)) {
      const sharedSmartOption = this._findSharedSmartOption(otherDescriptor.options);
      if (
        sharedSmartOption &&
        normalizeTextKey(sharedSmartOption) !== normalizeTextKey(otherDescriptor.current)
      ) {
        this._hass.callService("select", "select_option", {
          entity_id: otherDescriptor.target,
          option: sharedSmartOption,
        });
      }
      return;
    }

    if (!this._isSharedSmartMode(otherDescriptor.current)) {
      return;
    }

    const fallbackOption = this._getModeFallbackOption(otherKind, otherDescriptor);
    if (
      fallbackOption &&
      normalizeTextKey(fallbackOption) !== normalizeTextKey(otherDescriptor.current)
    ) {
      this._hass.callService("select", "select_option", {
        entity_id: otherDescriptor.target,
        option: fallbackOption,
      });
    }
  }

  _setModeOption(kind, value, state = this._getVacuumState(), options = {}) {
    const triggerHaptic = options.triggerHaptic !== false;
    if (!this._hass || !value) {
      return;
    }

    if (kind === "mop_mode") {
      const descriptor = this._getMopModeDescriptor(state);
      if (!descriptor?.target) {
        return;
      }

      this._hass.callService("select", "select_option", {
        entity_id: descriptor.target,
        option: value,
      });

      if (triggerHaptic) {
        this._triggerHaptic("selection");
      }
      return;
    }

    const descriptor = this._getModeDescriptor(kind, state);
    if (!descriptor?.target) {
      return;
    }

    this._rememberNonSmartModeSelection(kind, value);
    this._applyLinkedSmartModeSelection(kind, value, state);
    if (triggerHaptic) {
      this._triggerHaptic("selection");
    }
  }

  _findOptionByCandidates(options, candidates) {
    if (!Array.isArray(options) || !options.length || !Array.isArray(candidates) || !candidates.length) {
      return "";
    }

    const normalizedOptions = options.map(option => ({
      key: normalizeTextKey(option),
      value: option,
    }));

    for (const candidate of candidates) {
      const key = normalizeTextKey(candidate);
      const exactMatch = normalizedOptions.find(option => option.key === key);
      if (exactMatch) {
        return exactMatch.value;
      }
    }

    for (const candidate of candidates) {
      const key = normalizeTextKey(candidate);
      const partialMatch = normalizedOptions.find(option => option.key.includes(key) || key.includes(option.key));
      if (partialMatch) {
        return partialMatch.value;
      }
    }

    return "";
  }

  _getPresetDefaultOption(descriptor, candidates, { excludeOff = false } = {}) {
    if (!descriptor?.options?.length) {
      return "";
    }

    const preferred = this._findOptionByCandidates(descriptor.options, candidates);
    if (preferred) {
      return preferred;
    }

    return descriptor.options.find(option => {
      if (this._isSharedSmartMode(option) || this._isCustomModeValue(option)) {
        return false;
      }

      if (excludeOff && this._isOffModeValue(option)) {
        return false;
      }

      return true;
    }) || "";
  }

  _getModePanelPresetSelection(presetId, state = this._getVacuumState()) {
    const suctionDescriptor = this._getModeDescriptor("suction", state);
    const mopDescriptor = this._getModeDescriptor("mop", state);
    const mopModeDescriptor = this._getMopModeDescriptor(state);

    switch (presetId) {
      case "smart":
        return {
          suction: this._findSharedSmartOption(suctionDescriptor?.options),
          mop: this._findSharedSmartOption(mopDescriptor?.options),
          mopMode: this._findSharedSmartOption(mopModeDescriptor?.options),
        };
      case "vacuum_mop":
        return {
          suction: this._getPresetDefaultOption(suctionDescriptor, ["balanced", "equilibrado", "standard", "normal"], {
            excludeOff: true,
          }),
          mop: this._getPresetDefaultOption(mopDescriptor, ["medium", "media", "normal", "standard"], {
            excludeOff: true,
          }),
          mopMode: this._getCleaningComboOptionForPreset(mopModeDescriptor, "vacuum_mop")
            || this._getPresetDefaultOption(mopModeDescriptor, ["standard", "estandar", "normal", "default"]),
        };
      case "vacuum":
        return {
          suction: this._getPresetDefaultOption(suctionDescriptor, ["balanced", "equilibrado", "standard", "normal"], {
            excludeOff: true,
          }),
          mop: this._findOptionByCandidates(mopDescriptor?.options, ["off", "sin_fregado", "apagado", "none"]),
          mopMode: this._getCleaningComboOptionForPreset(mopModeDescriptor, "vacuum")
            || this._getPresetDefaultOption(mopModeDescriptor, ["standard", "estandar", "normal", "default"]),
        };
      case "mop":
        return {
          suction: this._findOptionByCandidates(suctionDescriptor?.options, ["off", "apagado", "none"]),
          mop: this._getPresetDefaultOption(mopDescriptor, ["medium", "media", "normal", "standard"], {
            excludeOff: true,
          }),
          mopMode: this._getCleaningComboOptionForPreset(mopModeDescriptor, "mop")
            || this._getPresetDefaultOption(mopModeDescriptor, ["standard", "estandar", "normal", "default"]),
        };
      case "custom":
        return {
          suction: this._findOptionByCandidates(suctionDescriptor?.options, ["custom", "custom_mode", "custommode", "personalizado"]),
          mop: this._findOptionByCandidates(mopDescriptor?.options, ["custom", "custom_mode", "custommode", "custom_water_flow", "personalizado"]),
          mopMode: this._findOptionByCandidates(mopModeDescriptor?.options, ["custom", "custom_mode", "custommode", "personalizado"]),
        };
      default:
        return null;
    }
  }

  _detectModePanelPreset(state = this._getVacuumState()) {
    const suctionDescriptor = this._getModeDescriptor("suction", state);
    const mopDescriptor = this._getModeDescriptor("mop", state);
    const mopModeDescriptor = this._getMopModeDescriptor(state);
    const suctionCurrent = suctionDescriptor?.current || "";
    const mopCurrent = mopDescriptor?.current || "";
    const mopModeCurrent = mopModeDescriptor?.current || "";
    const cleaningComboMode = this._getCleaningComboModeFromValue(
      this._descriptorSupportsCleaningCombo(mopModeDescriptor)
        ? mopModeCurrent
        : this._descriptorSupportsCleaningCombo(mopDescriptor)
          ? mopCurrent
          : "",
    );

    if (
      this._isSharedSmartMode(suctionCurrent) &&
      this._isSharedSmartMode(mopCurrent) &&
      (!mopModeCurrent || this._isSharedSmartMode(mopModeCurrent))
    ) {
      return "smart";
    }

    if (
      this._isCustomModeValue(suctionCurrent) ||
      this._isCustomModeValue(mopCurrent) ||
      this._isCustomModeValue(mopModeCurrent)
    ) {
      return "custom";
    }

    if (cleaningComboMode) {
      return cleaningComboMode;
    }

    let suctionEnabled = Boolean(suctionCurrent) && !this._isOffModeValue(suctionCurrent) && !this._isSharedSmartMode(suctionCurrent);
    let mopEnabled = Boolean(mopCurrent) && !this._isOffModeValue(mopCurrent) && !this._isSharedSmartMode(mopCurrent);

    if (this._descriptorSupportsCleaningCombo(mopDescriptor)) {
      const mopDescriptorComboMode = this._getCleaningComboModeFromValue(mopCurrent);
      if (mopDescriptorComboMode === "vacuum") {
        mopEnabled = false;
      } else if (mopDescriptorComboMode === "mop") {
        suctionEnabled = false;
        mopEnabled = true;
      } else if (mopDescriptorComboMode === "vacuum_mop") {
        suctionEnabled = true;
        mopEnabled = true;
      }
    }

    if (suctionEnabled && mopEnabled) {
      return "vacuum_mop";
    }

    if (suctionEnabled) {
      return "vacuum";
    }

    if (mopEnabled) {
      return "mop";
    }

    return "custom";
  }

  _isAmbiguousVacuumMopPreset(detectedPreset, state = this._getVacuumState()) {
    if (detectedPreset !== "vacuum_mop") {
      return false;
    }

    const mopDescriptor = this._getModeDescriptor("mop", state);
    const mopModeDescriptor = this._getMopModeDescriptor(state);
    if (this._descriptorSupportsCleaningCombo(mopDescriptor) || this._descriptorSupportsCleaningCombo(mopModeDescriptor)) {
      return false;
    }

    return (
      !mopDescriptor?.current ||
      this._isSharedSmartMode(mopDescriptor.current) ||
      this._isCustomModeValue(mopDescriptor.current) ||
      this._isMopIntensityDescriptor(mopDescriptor)
    );
  }

  _getActiveModePanelPreset(state = this._getVacuumState()) {
    const detectedPreset = this._detectModePanelPreset(state);
    const manualPreset = this._activeModePanelPreset;
    const isDockContext = this._isDocked(state) || this._isReturning(state);
    const isCleaningContext = this._isCleaning(state) || this._isPaused(state);
    const isFrozenPresetContext = isCleaningContext || isDockContext;
    const fallbackPreset = manualPreset || this._dockedModePanelPreset || this._lastResolvedModePanelPreset || "";
    const isAmbiguousVacuumMopPreset = this._isAmbiguousVacuumMopPreset(detectedPreset, state);
    const stableDetectedPreset = isAmbiguousVacuumMopPreset && fallbackPreset
      ? fallbackPreset
      : detectedPreset;

    if (
      stableDetectedPreset &&
      stableDetectedPreset !== "custom" &&
      !isFrozenPresetContext
    ) {
      this._lastResolvedModePanelPreset = stableDetectedPreset;
    }

    const shouldKeepFrozenPreset = Boolean(this._dockedModePanelPreset) && (
      isFrozenPresetContext ||
      isAmbiguousVacuumMopPreset ||
      !stableDetectedPreset ||
      stableDetectedPreset === "custom" ||
      stableDetectedPreset === this._dockedModePanelPreset
    );

    if (!shouldKeepFrozenPreset && this._dockedModePanelPreset) {
      this._dockedModePanelPreset = "";
    }

    if (isFrozenPresetContext || this._dockedModePanelPreset) {
      return manualPreset || this._dockedModePanelPreset || this._lastResolvedModePanelPreset || stableDetectedPreset || "vacuum_mop";
    }

    return manualPreset || stableDetectedPreset || this._lastResolvedModePanelPreset || "vacuum_mop";
  }

  _freezeCurrentModePanelPreset(state = this._getVacuumState()) {
    const preset = this._getActiveModePanelPreset(state) || this._activeModePanelPreset || this._lastResolvedModePanelPreset || this._detectModePanelPreset(state) || "";
    if (!preset || preset === "custom") {
      return;
    }

    this._dockedModePanelPreset = preset;
    this._lastResolvedModePanelPreset = preset;
  }

  _getActiveModePanelPresetConfig(state = this._getVacuumState()) {
    const activePreset = this._getActiveModePanelPreset(state);
    return PANEL_MODE_PRESETS.find(preset => preset.id === activePreset) || PANEL_MODE_PRESETS[0];
  }

  _selectModePanelPreset(presetId, state = this._getVacuumState()) {
    this._activeModePanelPreset = presetId;
    this._lastResolvedModePanelPreset = presetId;

    const selection = this._getModePanelPresetSelection(presetId, state);
    if (!selection) {
      this._persistCurrentCleaningSessionState(this._activeMode, {
        markSelectionChange: true,
      });
      this._triggerHaptic("selection");
      this._render();
      return;
    }

    if (
      selection.suction &&
      normalizeTextKey(selection.suction) !== normalizeTextKey(this._getModeDescriptor("suction", state)?.current)
    ) {
      this._setModeOption("suction", selection.suction, state, { triggerHaptic: false });
    }

    if (
      selection.mop &&
      normalizeTextKey(selection.mop) !== normalizeTextKey(this._getModeDescriptor("mop", state)?.current)
    ) {
      this._setModeOption("mop", selection.mop, state, { triggerHaptic: false });
    }

    if (
      selection.mopMode &&
      normalizeTextKey(selection.mopMode) !== normalizeTextKey(this._getMopModeDescriptor(state)?.current)
    ) {
      this._setModeOption("mop_mode", selection.mopMode, state, { triggerHaptic: false });
    }

    this._persistCurrentCleaningSessionState(this._activeMode, {
      markSelectionChange: true,
    });
    this._triggerHaptic("selection");
    this._render();
  }

  _filterModePanelOptions(descriptor, presetId) {
    if (!descriptor?.options?.length) {
      return [];
    }

    return descriptor.options.filter(option => {
      const isSmart = this._isSharedSmartMode(option);
      const isOff = this._isOffModeValue(option);
      const isCustom = this._isCustomModeValue(option);

      switch (presetId) {
        case "smart":
          return false;
        case "vacuum_mop":
          if (descriptor.kind === "suction" || descriptor.kind === "mop") {
            return !isSmart && !isOff && !isCustom;
          }
          return !isSmart;
        case "vacuum":
          if (descriptor.kind === "suction") {
            return !isSmart && !isOff && !isCustom;
          }
          return false;
        case "mop":
          if (descriptor.kind === "mop") {
            return !isSmart && !isOff && !isCustom;
          }
          if (descriptor.kind === "mop_mode") {
            return !isSmart;
          }
          return false;
        case "custom":
          return false;
        default:
          return !isSmart;
      }
    });
  }

  _getVisibleModePanelDescriptors(state = this._getVacuumState(), presetId = this._getActiveModePanelPreset(state)) {
    return [
      this._getModeDescriptor("suction", state),
      this._getModeDescriptor("mop", state),
      this._getMopModeDescriptor(state),
    ]
      .filter(Boolean)
      .map(descriptor => ({
        ...descriptor,
        options: this._filterModePanelOptions(descriptor, presetId),
      }))
      .filter(descriptor => descriptor.options.length > 0);
  }

  _getDefaultCustomMenuItems(state) {
    const actions = this._advanceVacuumStrings()?.actions;
    const items = [];

    if (this._config?.show_return_to_base !== false && !this._isDocked(state)) {
      items.push({
        label: actions?.returnToBase || "Volver a base",
        icon: "mdi:home-import-outline",
        builtin_action: "return_to_base",
      });
    }

    if (this._config?.show_stop !== false && this._isActive(state)) {
      items.push({
        label: actions?.stop || "Parar",
        icon: "mdi:stop",
        builtin_action: "stop",
      });
    }

    if (this._config?.show_locate !== false) {
      items.push({
        label: actions?.locate || "Localizar",
        icon: "mdi:crosshairs-gps",
        builtin_action: "locate",
      });
    }

    return items;
  }

  _isMenuItemVisible(item, state) {
    const condition = normalizeTextKey(item?.visible_when || "always");

    if (condition === "active") {
      return this._isActive(state) || this._isPaused(state);
    }

    if (condition === "docked" || condition === "base") {
      return this._isDocked(state);
    }

    if (condition === "undocked" || condition === "idle_away") {
      return !this._isDocked(state);
    }

    return true;
  }

  _getVisibleCustomMenuItems(state) {
    const configuredItems = normalizeCustomMenuItems(this._config?.custom_menu?.items);
    const sourceItems = configuredItems.length ? configuredItems : this._getDefaultCustomMenuItems(state);
    return sourceItems.filter(item => this._isMenuItemVisible(item, state));
  }

  _getMapSurfaceRect() {
    return this.shadowRoot?.querySelector("[data-map-surface]")?.getBoundingClientRect() || null;
  }

  _getMapViewportPoint(event, rect = this._getMapSurfaceRect()) {
    if (!rect) {
      return null;
    }

    return {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height),
    };
  }

  _clampMapTransform(scale = this._mapScale, offset = this._mapOffset, rect = this._getMapSurfaceRect()) {
    const safeScale = clamp(Number(scale || 1), 1, 3);
    if (!rect || safeScale <= 1) {
      return {
        scale: 1,
        offset: { x: 0, y: 0 },
      };
    }

    const minOffsetX = rect.width * (1 - safeScale);
    const minOffsetY = rect.height * (1 - safeScale);

    return {
      scale: safeScale,
      offset: {
        x: clamp(Number(offset?.x || 0), minOffsetX, 0),
        y: clamp(Number(offset?.y || 0), minOffsetY, 0),
      },
    };
  }

  _setMapTransform(scale = this._mapScale, offset = this._mapOffset) {
    const nextTransform = this._clampMapTransform(scale, offset);
    this._mapScale = nextTransform.scale;
    this._mapOffset = nextTransform.offset;
  }

  _resetMapTransform() {
    this._mapScale = 1;
    this._mapOffset = { x: 0, y: 0 };
    this._pinchGesture = null;
    this._touchPinchGesture = null;
    this._activeMapPointers.clear();
  }

  _eventToMapPoint(event) {
    const rect = this._getMapSurfaceRect();
    if (!rect) {
      return null;
    }

    const viewportPoint = this._getMapViewportPoint(event, rect);
    if (!viewportPoint) {
      return null;
    }

    const localX = clamp((viewportPoint.x - this._mapOffset.x) / this._mapScale, 0, rect.width);
    const localY = clamp((viewportPoint.y - this._mapOffset.y) / this._mapScale, 0, rect.height);
    const x = clamp((localX / rect.width) * this._mapImageWidth, 0, this._mapImageWidth);
    const y = clamp((localY / rect.height) * this._mapImageHeight, 0, this._mapImageHeight);
    return { x, y };
  }

  _eventToVacuumPoint(event) {
    const mapPoint = this._eventToMapPoint(event);
    return mapPoint ? this._converter.mapToVacuum(mapPoint.x, mapPoint.y) : null;
  }

  _vacuumToPercent(point) {
    const mapped = this._converter.vacuumToMap(point.x, point.y);
    return {
      left: clamp((mapped.x / this._mapImageWidth) * 100, 0, 100),
      top: clamp((mapped.y / this._mapImageHeight) * 100, 0, 100),
    };
  }

  _mapToViewportPercent(point) {
    if (!point) {
      return {
        left: 50,
        top: 50,
      };
    }

    const rect = this._getMapSurfaceRect();
    const width = rect?.width || this._mapImageWidth || 1;
    const height = rect?.height || this._mapImageHeight || 1;
    const offsetX = rect ? this._mapOffset.x : 0;
    const offsetY = rect ? this._mapOffset.y : 0;
    const x = ((point.x / this._mapImageWidth) * width * this._mapScale) + offsetX;
    const y = ((point.y / this._mapImageHeight) * height * this._mapScale) + offsetY;
    return {
      left: clamp((x / width) * 100, 0, 100),
      top: clamp((y / height) * 100, 0, 100),
    };
  }

  _vacuumToViewportPercent(point) {
    const mapped = this._converter.vacuumToMap(point.x, point.y);
    return this._mapToViewportPercent(mapped);
  }

  _vacuumOutlineToSvgPoints(points) {
    return points
      .map(point => this._converter.vacuumToMap(point.x, point.y))
      .map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(" ");
  }

  _vacuumOutlineToCssPolygon(points) {
    return points
      .map(point => this._converter.vacuumToMap(point.x, point.y))
      .map(point => {
        const left = clamp((point.x / this._mapImageWidth) * 100, 0, 100);
        const top = clamp((point.y / this._mapImageHeight) * 100, 0, 100);
        return `${left.toFixed(3)}% ${top.toFixed(3)}%`;
      })
      .join(", ");
  }

  _vacuumZoneToCssPolygon(zone) {
    if (!zone) {
      return "";
    }

    return this._vacuumOutlineToCssPolygon([
      { x: zone.x1, y: zone.y1 },
      { x: zone.x2, y: zone.y1 },
      { x: zone.x2, y: zone.y2 },
      { x: zone.x1, y: zone.y2 },
    ]);
  }

  _zoneToSvgRect(zone) {
    const first = this._converter.vacuumToMap(zone.x1, zone.y1);
    const second = this._converter.vacuumToMap(zone.x2, zone.y2);
    return {
      x: Math.min(first.x, second.x),
      y: Math.min(first.y, second.y),
      width: Math.abs(second.x - first.x),
      height: Math.abs(second.y - first.y),
    };
  }

  _mapRectToVacuumZone(rect) {
    if (!rect) {
      return null;
    }

    const first = this._converter.mapToVacuum(rect.x1, rect.y1);
    const second = this._converter.mapToVacuum(rect.x2, rect.y2);
    return {
      x1: Math.round(Math.min(first.x, second.x)),
      y1: Math.round(Math.min(first.y, second.y)),
      x2: Math.round(Math.max(first.x, second.x)),
      y2: Math.round(Math.max(first.y, second.y)),
    };
  }

  _getManualZoneCountLimit() {
    return clamp(Number(this._config?.max_zone_selections || 5), 1, 10);
  }

  _sanitizeSelectedManualZoneIndex() {
    if (this._selectedManualZoneIndex >= this._manualZones.length) {
      this._selectedManualZoneIndex = this._manualZones.length - 1;
    }

    if (this._manualZones.length <= 0) {
      this._selectedManualZoneIndex = -1;
    }
  }

  _selectManualZone(index, { triggerHaptic = false } = {}) {
    const normalizedIndex = Number(index);
    if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= this._manualZones.length) {
      return;
    }

    this._selectedManualZoneIndex = normalizedIndex;
    if (triggerHaptic) {
      this._triggerHaptic("selection");
    }
    this._render();
  }

  _updateManualZone(index, nextZone) {
    if (!Number.isInteger(index) || index < 0 || index >= this._manualZones.length || !nextZone) {
      return;
    }

    this._manualZones = this._manualZones.map((zone, zoneIndex) => (zoneIndex === index ? nextZone : zone));
    this._selectedManualZoneIndex = index;
  }

  _getVisibleMapCenter() {
    const rect = this._getMapSurfaceRect();
    if (!rect) {
      return {
        x: this._mapImageWidth / 2,
        y: this._mapImageHeight / 2,
      };
    }

    return {
      x: clamp(((rect.width / 2) - this._mapOffset.x) / this._mapScale / rect.width * this._mapImageWidth, 0, this._mapImageWidth),
      y: clamp(((rect.height / 2) - this._mapOffset.y) / this._mapScale / rect.height * this._mapImageHeight, 0, this._mapImageHeight),
    };
  }

  _createDefaultManualZone() {
    const center = this._getVisibleMapCenter();
    const size = Math.max(120, Math.round(Math.min(this._mapImageWidth, this._mapImageHeight) * 0.18));
    const halfSize = size / 2;
    const rect = {
      x1: clamp(center.x - halfSize, 0, this._mapImageWidth),
      y1: clamp(center.y - halfSize, 0, this._mapImageHeight),
      x2: clamp(center.x + halfSize, 0, this._mapImageWidth),
      y2: clamp(center.y + halfSize, 0, this._mapImageHeight),
    };

    return this._mapRectToVacuumZone(rect);
  }

  _addManualZone() {
    if (this._manualZones.length >= this._getManualZoneCountLimit()) {
      return;
    }

    const zone = this._createDefaultManualZone();
    if (!zone) {
      return;
    }

    this._manualZones = [...this._manualZones, zone];
    this._selectedManualZoneIndex = this._manualZones.length - 1;
    this._draftZone = null;
    this._persistCurrentCleaningSessionState(this._activeMode, {
      markSelectionChange: true,
    });
    this._triggerHaptic("selection");
    this._render();
  }

  _deleteManualZone(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this._manualZones.length) {
      return;
    }

    this._manualZones = this._manualZones.filter((_zone, zoneIndex) => zoneIndex !== index);

    if (this._selectedManualZoneIndex > index) {
      this._selectedManualZoneIndex -= 1;
    } else if (this._selectedManualZoneIndex === index) {
      this._selectedManualZoneIndex = Math.min(index, this._manualZones.length - 1);
    }

    this._sanitizeSelectedManualZoneIndex();
    this._zoneHandleDrag = null;
    this._persistCurrentCleaningSessionState(this._activeMode, {
      markSelectionChange: true,
    });
    this._triggerHaptic("selection");
    this._render();
  }

  _getMinimumManualZoneSize() {
    return Math.max(72, Math.round(Math.min(this._mapImageWidth, this._mapImageHeight) * 0.06));
  }

  _getZoneHandlePoints(zone) {
    const rect = this._zoneToSvgRect(zone);
    const handlesText = this._advanceVacuumStrings()?.handles;
    return {
      rect,
      handles: [
        { id: "move", icon: "mdi:arrow-all", x: rect.x, y: rect.y, title: handlesText?.moveZone || "Mover zona" },
        { id: "delete", icon: "mdi:trash-can-outline", x: rect.x, y: rect.y + rect.height, title: handlesText?.deleteZone || "Eliminar zona" },
        { id: "resize", icon: "mdi:arrow-bottom-right", x: rect.x + rect.width, y: rect.y + rect.height, title: handlesText?.resizeZone || "Redimensionar zona" },
      ],
    };
  }

  _updateManualZoneFromHandleDrag(event) {
    if (!this._zoneHandleDrag || event.pointerId !== this._zoneHandleDrag.pointerId) {
      return false;
    }

    const mapPoint = this._eventToMapPoint(event);
    if (!mapPoint) {
      return false;
    }

    let nextZone = null;
    if (this._zoneHandleDrag.action === "move") {
      const deltaX = mapPoint.x - this._zoneHandleDrag.startPoint.x;
      const deltaY = mapPoint.y - this._zoneHandleDrag.startPoint.y;
      const width = this._zoneHandleDrag.startRect.width;
      const height = this._zoneHandleDrag.startRect.height;
      const nextX = clamp(this._zoneHandleDrag.startRect.x + deltaX, 0, this._mapImageWidth - width);
      const nextY = clamp(this._zoneHandleDrag.startRect.y + deltaY, 0, this._mapImageHeight - height);

      nextZone = this._mapRectToVacuumZone({
        x1: nextX,
        y1: nextY,
        x2: nextX + width,
        y2: nextY + height,
      });
    } else if (this._zoneHandleDrag.action === "resize") {
      const minSize = this._getMinimumManualZoneSize();
      nextZone = this._mapRectToVacuumZone({
        x1: this._zoneHandleDrag.fixedPoint.x,
        y1: this._zoneHandleDrag.fixedPoint.y,
        x2: clamp(mapPoint.x, this._zoneHandleDrag.fixedPoint.x + minSize, this._mapImageWidth),
        y2: clamp(mapPoint.y, this._zoneHandleDrag.fixedPoint.y + minSize, this._mapImageHeight),
      });
    }

    if (!nextZone) {
      return false;
    }

    this._updateManualZone(this._zoneHandleDrag.index, nextZone);
    this._render();
    return true;
  }

  _startPinchGesture() {
    if (this._activeMapPointers.size < 2) {
      return;
    }

    const rect = this._getMapSurfaceRect();
    if (!rect) {
      return;
    }

    const [first, second] = [...this._activeMapPointers.values()];
    const midpoint = {
      x: ((first.clientX + second.clientX) / 2) - rect.left,
      y: ((first.clientY + second.clientY) / 2) - rect.top,
    };
    const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);

    this._pinchGesture = {
      startDistance: Math.max(distance, 1),
      startScale: this._mapScale,
      anchor: {
        x: (midpoint.x - this._mapOffset.x) / this._mapScale,
        y: (midpoint.y - this._mapOffset.y) / this._mapScale,
      },
    };
    this._draftZone = null;
    this._zoneHandleDrag = null;
  }

  _updatePinchGesture() {
    if (!this._pinchGesture || this._activeMapPointers.size < 2) {
      return false;
    }

    const rect = this._getMapSurfaceRect();
    if (!rect) {
      return false;
    }

    const [first, second] = [...this._activeMapPointers.values()];
    const midpoint = {
      x: ((first.clientX + second.clientX) / 2) - rect.left,
      y: ((first.clientY + second.clientY) / 2) - rect.top,
    };
    const distance = Math.max(Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY), 1);
    const scale = this._pinchGesture.startScale * (distance / this._pinchGesture.startDistance);
    const offset = {
      x: midpoint.x - (this._pinchGesture.anchor.x * scale),
      y: midpoint.y - (this._pinchGesture.anchor.y * scale),
    };

    this._setMapTransform(scale, offset);
    this._render();
    return true;
  }

  _getTouchDistance(touches) {
    if (!touches || touches.length < 2) {
      return 0;
    }

    const [first, second] = Array.from(touches);
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  }

  _getTouchMidpoint(touches, rect = this._getMapSurfaceRect()) {
    if (!rect || !touches || touches.length < 2) {
      return null;
    }

    const [first, second] = Array.from(touches);
    return {
      x: clamp(((first.clientX + second.clientX) / 2) - rect.left, 0, rect.width),
      y: clamp(((first.clientY + second.clientY) / 2) - rect.top, 0, rect.height),
    };
  }

  _beginTouchPinchGesture(touches) {
    const rect = this._getMapSurfaceRect();
    if (!rect || !touches || touches.length < 2) {
      this._touchPinchGesture = null;
      return false;
    }

    const midpoint = this._getTouchMidpoint(touches, rect);
    const distance = this._getTouchDistance(touches);
    if (!midpoint || distance <= 0) {
      this._touchPinchGesture = null;
      return false;
    }

    this._activeMapPointers.clear();
    this._pinchGesture = null;
    this._draftZone = null;
    this._zoneHandleDrag = null;
    this._pointerStart = null;
    this._touchPinchGesture = {
      startDistance: Math.max(distance, 1),
      startScale: this._mapScale,
      anchor: {
        x: (midpoint.x - this._mapOffset.x) / this._mapScale,
        y: (midpoint.y - this._mapOffset.y) / this._mapScale,
      },
    };
    return true;
  }

  _onShadowTouchStart(event) {
    const zoneHandleTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.zoneHandleIndex && node.dataset?.zoneHandleAction === "delete");
    if (zoneHandleTarget && event.touches.length === 1) {
      event.preventDefault();
      event.stopPropagation();
      this._deleteManualZone(Number(zoneHandleTarget.dataset.zoneHandleIndex));
      return;
    }

    const surface = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.mapSurface === "main");
    if (!surface || event.touches.length < 2) {
      return;
    }

    this._clearPendingRoomSelectionTap();
    if (this._beginTouchPinchGesture(event.touches)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  _onShadowTouchMove(event) {
    if (!this._touchPinchGesture) {
      return;
    }

    if (event.touches.length < 2) {
      this._touchPinchGesture = null;
      return;
    }

    const rect = this._getMapSurfaceRect();
    const midpoint = this._getTouchMidpoint(event.touches, rect);
    if (!rect || !midpoint) {
      return;
    }

    const distance = Math.max(this._getTouchDistance(event.touches), 1);
    const scale = this._touchPinchGesture.startScale * (distance / this._touchPinchGesture.startDistance);
    const offset = {
      x: midpoint.x - (this._touchPinchGesture.anchor.x * scale),
      y: midpoint.y - (this._touchPinchGesture.anchor.y * scale),
    };

    this._setMapTransform(scale, offset);
    this._render();
    event.preventDefault();
    event.stopPropagation();
  }

  _onShadowTouchEnd(event) {
    if (!this._touchPinchGesture) {
      return;
    }

    if (event.touches.length < 2) {
      this._touchPinchGesture = null;
      return;
    }

    if (this._beginTouchPinchGesture(event.touches)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  _navigate(path) {
    if (!path) {
      return;
    }
    if (this._hass?.navigate) {
      this._hass.navigate(path);
      return;
    }
    if (window?.history?.pushState) {
      window.history.pushState(null, "", path);
      fireEvent(this, "location-changed", { replace: false });
      return;
    }
    fireEvent(this, "hass-navigate", { path });
  }

  _runExternalAction(actionConfig = {}) {
    const action = normalizeTextKey(actionConfig.action);

    if (!action || action === "none") {
      return;
    }

    if (action === "navigate") {
      this._navigate(actionConfig.navigation_path);
      return;
    }

    if (action === "url") {
      const target = actionConfig.new_tab === true ? "_blank" : "_self";
      const safeUrl = window.NodaliaUtils?.sanitizeActionUrl(actionConfig.url_path || actionConfig.url, { allowRelative: true }) || "";
      if (!safeUrl) {
        return;
      }
      if (target === "_blank") {
        window.open(safeUrl, "_blank", "noopener,noreferrer");
      } else {
        window.location.assign(safeUrl);
      }
      return;
    }

    if (action === "more_info") {
      fireEvent(this, "hass-more-info", {
        entityId: actionConfig.entity || this._config?.entity,
      });
      return;
    }

    if (["call_service", "call-service", "perform_action", "perform-action"].includes(action)) {
      const service = actionConfig.service || actionConfig.perform_action;
      if (!service || !this._hass || !this._isServiceAllowed(service)) {
        return;
      }
      const [domain, serviceName] = String(service).split(".");
      if (!domain || !serviceName) {
        return;
      }
      this._hass.callService(domain, serviceName, actionConfig.service_data || {}, actionConfig.target);
    }
  }

  _callVacuumService(service, data = {}) {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    return this._hass.callService("vacuum", service, {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _isServiceAllowed(serviceValue) {
    const security = this._config?.security || {};
    if (security.strict_service_actions === false) {
      return true;
    }
    const normalizedService = String(serviceValue || "").trim().toLowerCase();
    if (!normalizedService || !normalizedService.includes(".")) {
      return false;
    }
    const [domain] = normalizedService.split(".");
    const domains = Array.isArray(security.allowed_service_domains)
      ? security.allowed_service_domains.map(item => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    const services = Array.isArray(security.allowed_services)
      ? security.allowed_services.map(item => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    if (!domains.length && !services.length) {
      return false;
    }
    return services.includes(normalizedService) || domains.includes(domain);
  }

  _callNamedService(service, data = {}, target = null) {
    if (!this._hass || !service) {
      return;
    }
    if (!this._isServiceAllowed(service)) {
      return;
    }

    const [domain, serviceName] = String(service).split(".");
    if (!domain || !serviceName) {
      return;
    }

    return this._hass.callService(domain, serviceName, data, target || undefined);
  }

  /**
   * Fixed, card-owned service calls that must not be blocked by strict allowlists.
   * External/user-provided service actions still go through _callNamedService.
   */
  _callInternalService(service, data = {}, target = null) {
    if (!this._hass || !service) {
      return;
    }
    const [domain, serviceName] = String(service).split(".");
    if (!domain || !serviceName) {
      return;
    }
    return this._hass.callService(domain, serviceName, data, target || undefined);
  }

  _toggleRoomSelection(roomId) {
    roomId = String(roomId || "").trim();
    if (!roomId) {
      return;
    }

    if (this._isRoomSelectionLocked()) {
      return;
    }

    this._selectedRoomIds = this._selectedRoomIds.includes(roomId)
      ? this._selectedRoomIds.filter(id => id !== roomId)
      : [...this._selectedRoomIds, roomId];
    this._persistCurrentCleaningSessionState(this._activeMode === "rooms" ? "rooms" : this._activeMode, {
      markSelectionChange: true,
    });
    this._triggerHaptic("selection");
    this._render();
  }

  _isRoomSelectionLocked(state = this._getVacuumState()) {
    const persistedSession = this._readStoredCleaningSession();
    return this._isCleaningSessionActive(state) && (
      this._activeMode === "rooms" ||
      this._activeCleaningSessionMode === "rooms" ||
      persistedSession?.mode === "rooms"
    );
  }

  _togglePredefinedZone(zoneId) {
    this._selectedPredefinedZoneIds = this._selectedPredefinedZoneIds.includes(zoneId)
      ? this._selectedPredefinedZoneIds.filter(id => id !== zoneId)
      : [...this._selectedPredefinedZoneIds, zoneId];
    this._selectedManualZoneIndex = -1;
    this._persistCurrentCleaningSessionState(this._activeMode, {
      markSelectionChange: true,
    });
    this._triggerHaptic("selection");
    this._render();
  }

  _restoreTransientZoneMode() {
    if (!this._transientZoneReturnMode) {
      return false;
    }

    this._selectedPredefinedZoneIds = [];
    this._manualZones = [];
    this._selectedManualZoneIndex = -1;
    this._draftZone = null;
    this._gotoPoint = null;
    this._zoneHandleDrag = null;
    this._activeUtilityPanel = null;
    this._activeMode = this._transientZoneReturnMode;
    this._transientZoneReturnMode = "";
    return true;
  }

  _openTransientZoneMode() {
    const hasZoneMode = this._getAvailableModes().some(mode => mode.id === "zone");
    if (!hasZoneMode) {
      return;
    }

    if (this._activeMode !== "zone") {
      this._transientZoneReturnMode = this._activeMode || "all";
      this._activeMode = "zone";
      this._activeUtilityPanel = null;
      this._selectedPredefinedZoneIds = [];
      this._manualZones = [];
      this._selectedManualZoneIndex = -1;
      this._draftZone = null;
      this._gotoPoint = null;
    }

    this._addManualZone();
  }

  _setActiveMode(modeId) {
    if (!modeId || modeId === this._activeMode) {
      return;
    }
    this._activeMode = modeId;
    this._transientZoneReturnMode = "";
    this._activeUtilityPanel = null;
    this._manualZones = [];
    this._selectedManualZoneIndex = -1;
    this._draftZone = null;
    this._gotoPoint = null;
    this._selectedPredefinedZoneIds = [];
    this._persistCurrentCleaningSessionState(modeId, {
      markSelectionChange: true,
    });
    this._triggerHaptic("selection");
    this._render();
  }

  _toggleUtilityPanel(panelId) {
    this._activeUtilityPanel = this._activeUtilityPanel === panelId ? null : panelId;
    this._persistCurrentCleaningSessionState(this._activeMode, {
      markSelectionChange: true,
    });
    this._triggerHaptic("selection");
    this._render();
  }

  _cycleRepeats() {
    const maxRepeats = clamp(Number(this._config?.max_repeats || 1), 1, 9);
    this._repeats = this._repeats >= maxRepeats ? 1 : this._repeats + 1;
    this._persistCurrentCleaningSessionState(this._activeMode, {
      markSelectionChange: true,
    });
    this._triggerHaptic("selection");
    this._render();
  }

  _clearSelection() {
    this._selectedRoomIds = [];
    this._selectedPredefinedZoneIds = [];
    this._manualZones = [];
    this._selectedManualZoneIndex = -1;
    this._draftZone = null;
    this._gotoPoint = null;
    this._persistCurrentCleaningSessionState(this._activeMode, {
      markSelectionChange: true,
    });
    this._triggerHaptic("selection");
    this._render();
  }

  _goBack() {
    if (this._restoreTransientZoneMode()) {
      this._persistCurrentCleaningSessionState(this._activeMode, {
        markSelectionChange: true,
      });
      this._triggerHaptic("selection");
      this._render();
      return;
    }

    const shouldReturnToAll = this._activeMode !== "all";
    this._selectedRoomIds = [];
    this._selectedPredefinedZoneIds = [];
    this._manualZones = [];
    this._selectedManualZoneIndex = -1;
    this._draftZone = null;
    this._gotoPoint = null;
    this._zoneHandleDrag = null;
    this._activeUtilityPanel = null;

    if (shouldReturnToAll) {
      this._activeMode = "all";
    }

    this._persistCurrentCleaningSessionState(this._activeMode, {
      markSelectionChange: true,
    });
    this._triggerHaptic("selection");
    this._render();
  }

  async _runMapAction() {
    if (this._mapActionInFlight) {
      return;
    }
    this._mapActionInFlight = true;
    try {
      const state = this._getVacuumState();
      const selectedPredefinedZones = this._getPredefinedZones()
        .filter(zone => this._selectedPredefinedZoneIds.includes(zone.id))
        .flatMap(zone => zone.zones.map(item => [...item, this._repeats]));
      const manualZones = this._manualZones.map(zone => [zone.x1, zone.y1, zone.x2, zone.y2, this._repeats]);
      const selectedZones = [...selectedPredefinedZones, ...manualZones].slice(0, clamp(Number(this._config?.max_zone_selections || 5), 1, 10));
      const canRunZoneAction = this._activeMode === "zone" && selectedZones.length > 0;

      if ((this._isCleaning(state) || this._isPaused(state)) && !canRunZoneAction) {
        await this._callVacuumService(this._isCleaning(state) ? "pause" : "start");
        this._triggerHaptic("selection");
        return;
      }

      if (this._activeMode === "rooms" && this._selectedRoomIds.length) {
        const segments = this._selectedRoomIds
          .map(id => parseInteger(id))
          .filter(Number.isFinite);

        if (segments.length) {
          this._freezeCurrentModePanelPreset(state);
          this._clearPendingRoomCleaningResume();
          this._activeCleaningRoomIds = segments.map(item => String(item));
          this._activeCleaningZones = [];
          this._activeCleaningSessionMode = "rooms";
          this._markCleaningSessionPendingStart();
          this._persistCurrentCleaningSessionState("rooms", {
            markSelectionChange: true,
          });
          await this._callInternalService("vacuum.send_command", {
            entity_id: this._config.entity,
            command: "app_segment_clean",
            params: [{
              segments,
              repeat: this._repeats,
            }],
          });
          this._persistCurrentCleaningSessionState("rooms");
          this._triggerHaptic("success");
          this._render();
          return;
        }
      }

      if (this._activeMode === "zone" && selectedZones.length) {
        const isTransientZoneAddition = Boolean(this._transientZoneReturnMode) && (
          this._isCleaning(state)
          || this._isPaused(state)
          || this._isReturning(state)
          || this._isRoomCleaningSessionActive(state)
        );
        this._freezeCurrentModePanelPreset(state);
        if (isTransientZoneAddition && this._isRoomCleaningSessionActive(state)) {
          this._setPendingRoomCleaningResume(this._getRoomCleaningResumeIds(state), this._repeats);
        } else {
          this._clearPendingRoomCleaningResume();
        }
        if (!this._isRoomCleaningSessionActive(state)) {
          this._activeCleaningRoomIds = [];
        }
        this._activeCleaningZones = selectedZones.map(zone => ({
          x1: Number(zone[0]),
          y1: Number(zone[1]),
          x2: Number(zone[2]),
          y2: Number(zone[3]),
        }));
        this._activeCleaningSessionMode = this._isRoomCleaningSessionActive(state) ? "rooms" : "zone";
        this._markCleaningSessionPendingStart();
        this._persistCurrentCleaningSessionState(this._activeCleaningSessionMode || "zone", {
          markSelectionChange: true,
        });

        if (isTransientZoneAddition && this._isCleaning(state)) {
          await this._callVacuumService("pause");
          await new Promise(resolve => window.setTimeout(resolve, 450));
        }

        await this._callInternalService("vacuum.send_command", {
          entity_id: this._config.entity,
          command: "app_zoned_clean",
          params: selectedZones,
        });
        const latestState = this._getVacuumState();
        const activeCleaningSessionMode = this._isRoomCleaningSessionActive(latestState) ? "rooms" : "zone";
        if (!this._restoreTransientZoneMode()) {
          this._selectedManualZoneIndex = -1;
          this._draftZone = null;
        }
        this._activeCleaningSessionMode = activeCleaningSessionMode;
        this._persistCurrentCleaningSessionState(activeCleaningSessionMode);
        this._triggerHaptic("success");
        this._render();
        return;
      }

      if (this._activeMode === "goto" && this._gotoPoint) {
        this._freezeCurrentModePanelPreset(state);
        this._clearPendingRoomCleaningResume();
        this._activeCleaningRoomIds = [];
        this._activeCleaningZones = [];
        this._activeCleaningSessionMode = "";
        this._clearCleaningSessionPendingStart();
        this._clearPersistedCleaningSession();
        await this._callInternalService("roborock.set_vacuum_goto_position", {
          entity_id: this._config.entity,
          x: Math.round(this._gotoPoint.x),
          y: Math.round(this._gotoPoint.y),
        });
        this._triggerHaptic("success");
        return;
      }

      this._freezeCurrentModePanelPreset(state);
      this._clearPendingRoomCleaningResume();
      this._activeCleaningRoomIds = [];
      this._activeCleaningZones = [];
      this._activeCleaningSessionMode = "";
      this._clearCleaningSessionPendingStart();
      this._clearPersistedCleaningSession();
      await this._callVacuumService("start");
      this._triggerHaptic("selection");
    } finally {
      this._mapActionInFlight = false;
    }
  }

  _runCustomMenuItem(item) {
    if (!item) {
      return;
    }

    if (item.builtin_action) {
      this._handleControlAction(item.builtin_action);
    } else {
      this._triggerHaptic("selection");
      this._runExternalAction(item.tap_action || {});
    }

    this._activeUtilityPanel = null;
    this._render();
  }

  _handleMapActionError(error) {
    this._clearCleaningSessionPendingStart();
    this._clearPendingRoomCleaningResume();
    this._roomCleaningResumeInFlight = false;
    this._syncActiveCleaningSession(this._getVacuumState());
    this._render();
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error("Nodalia Advance Vacuum Card map action error", error);
    }
  }

  _handleCardError(error, context = "render") {
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error(`Nodalia Advance Vacuum Card ${context} error`, error);
    }

    this._lastRenderSignature = "";

    if (!this.shadowRoot || this.shadowRoot.innerHTML) {
      return;
    }

    const message = error?.message ? escapeHtml(error.message) : "No se ha podido actualizar la tarjeta.";
    this.shadowRoot.innerHTML = `
      <ha-card style="padding:16px;border-radius:20px;">
        <div style="color:var(--error-color);font-weight:700;margin-bottom:8px;">Nodalia Advance Vacuum Card</div>
        <div style="color:var(--secondary-text-color);font-size:13px;line-height:1.4;">${message}</div>
      </ha-card>
    `;
  }

  _handleMapBackAction() {
    if (this._restoreTransientZoneMode()) {
      this._persistCurrentCleaningSessionState(this._activeMode, {
        markSelectionChange: true,
      });
      this._triggerHaptic("selection");
      this._render();
      return;
    }

    this._triggerHaptic("selection");
    this._navigate("/lovelace/principal");
  }

  _onMapBackClick(event) {
    event.preventDefault();
    event.stopPropagation();
    this._handleMapBackAction();
  }

  _handleControlAction(action) {
    switch (action) {
      case "primary":
        this._triggerHaptic("selection");
        this._runMapAction().catch(error => this._handleMapActionError(error));
        break;
      case "toggle_modes":
        this._toggleUtilityPanel("modes");
        break;
      case "toggle_dock_panel":
        if (this._activeUtilityPanel !== "dock") {
          this._activeDockPanelSection = DOCK_PANEL_SECTIONS[0]?.id || "control";
        }
        this._toggleUtilityPanel("dock");
        break;
      case "return_to_base":
        this._freezeCurrentModePanelPreset(this._getVacuumState());
        this._clearPendingRoomCleaningResume();
        this._persistCurrentCleaningSessionState(this._activeMode);
        this._callVacuumService("return_to_base");
        this._triggerHaptic("selection");
        break;
      case "stop":
        this._freezeCurrentModePanelPreset(this._getVacuumState());
        this._selectedRoomIds = [];
        this._selectedPredefinedZoneIds = [];
        this._manualZones = [];
        this._selectedManualZoneIndex = -1;
        this._draftZone = null;
        this._gotoPoint = null;
        this._activeCleaningRoomIds = [];
        this._activeCleaningZones = [];
        this._activeCleaningSessionMode = "";
        this._clearCleaningSessionPendingStart();
        this._clearPendingRoomCleaningResume();
        this._roomCleaningResumeInFlight = false;
        this._clearPersistedCleaningSession();
        this._callVacuumService("stop");
        this._triggerHaptic("selection");
        this._render();
        break;
      case "locate":
        this._callVacuumService("locate");
        this._triggerHaptic("selection");
        break;
      case "clear":
        this._handleMapBackAction();
        break;
      case "add_zone":
        if ((this._isCleaning(this._getVacuumState()) || this._isPaused(this._getVacuumState()) || this._isReturning(this._getVacuumState())) && this._activeMode !== "zone") {
          this._openTransientZoneMode();
        } else {
          this._addManualZone();
        }
        break;
      case "repeats":
        this._cycleRepeats();
        break;
      default:
        break;
    }
  }

  _getRoomSelectionTarget(event) {
    return event?.composedPath?.().find(node => node instanceof Element && typeof node.getAttribute === "function" && node.getAttribute("data-room-id")) || null;
  }

  _clearPendingRoomSelectionTap(pointerId = null) {
    if (
      pointerId === null
      || pointerId === undefined
      || this._pendingRoomSelectionTap?.pointerId === pointerId
    ) {
      this._pendingRoomSelectionTap = null;
    }
  }

  _markSuppressedRoomSelectionClick(roomId) {
    const normalizedRoomId = String(roomId || "").trim();
    if (!normalizedRoomId) {
      return;
    }

    this._suppressedRoomSelectionClick = {
      roomId: normalizedRoomId,
      expiresAt: Date.now() + 450,
    };
  }

  _shouldSuppressRoomSelectionClick(roomId) {
    const normalizedRoomId = String(roomId || "").trim();
    const suppression = this._suppressedRoomSelectionClick;
    if (!suppression || !normalizedRoomId) {
      return false;
    }

    const isActive = suppression.roomId === normalizedRoomId && suppression.expiresAt > Date.now();
    if (!isActive || suppression.roomId === normalizedRoomId) {
      this._suppressedRoomSelectionClick = null;
    }
    return isActive;
  }

  _onShadowClick(event) {
    this._triggerPressAnimation(this._getPressTargetFromEvent(event));

    const zoneHandleTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.zoneHandleIndex && node.dataset?.zoneHandleAction);
    if (zoneHandleTarget) {
      event.preventDefault();
      event.stopPropagation();

      const index = Number(zoneHandleTarget.dataset.zoneHandleIndex);
      const action = zoneHandleTarget.dataset.zoneHandleAction;
      if (action === "delete") {
        this._deleteManualZone(index);
      } else {
        this._selectManualZone(index, { triggerHaptic: true });
      }
      return;
    }

    const roomTarget = this._getRoomSelectionTarget(event);
    if (roomTarget) {
      const roomId = String(roomTarget.getAttribute("data-room-id") || "").trim();
      event.preventDefault();
      event.stopPropagation();
      if (this._shouldSuppressRoomSelectionClick(roomId)) {
        return;
      }
      if (this._isRoomSelectionLocked()) {
        return;
      }
      this._toggleRoomSelection(roomId);
      return;
    }

    const zoneTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.zoneId);
    if (zoneTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._togglePredefinedZone(zoneTarget.dataset.zoneId);
      return;
    }

    const gotoTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.gotoId);
    if (gotoTarget) {
      const gotoPoint = this._getGotoPoints().find(point => point.id === gotoTarget.dataset.gotoId);
      if (gotoPoint?.position) {
        event.preventDefault();
        event.stopPropagation();
        this._gotoPoint = gotoPoint.position;
        this._triggerHaptic("selection");
        this._render();
      }
      return;
    }

    const modeTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.modeId);
    if (modeTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._setActiveMode(modeTarget.dataset.modeId);
      return;
    }

    const headerAction = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.headerActionIndex);
    if (headerAction) {
      const action = this._getHeaderIcons()[Number(headerAction.dataset.headerActionIndex)];
      if (action) {
        event.preventDefault();
        event.stopPropagation();
        this._triggerHaptic("selection");
        this._runExternalAction(action.tap_action);
      }
      return;
    }

    const manualZoneTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.manualZoneIndex);
    if (manualZoneTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._selectManualZone(Number(manualZoneTarget.dataset.manualZoneIndex), { triggerHaptic: true });
      return;
    }

    const controlTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.controlAction);
    if (controlTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._handleControlAction(controlTarget.dataset.controlAction);
      return;
    }

    const modePresetTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.modePresetId);
    if (modePresetTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._selectModePanelPreset(modePresetTarget.dataset.modePresetId, this._getVacuumState());
      return;
    }

    const modeOptionTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.modeOptionKind && node.dataset?.modeOptionValue);
    if (modeOptionTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._setModeOption(
        modeOptionTarget.dataset.modeOptionKind,
        modeOptionTarget.dataset.modeOptionValue,
        this._getVacuumState(),
      );
      return;
    }

    const dockSectionTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.dockSectionId);
    if (dockSectionTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._setActiveDockPanelSection(dockSectionTarget.dataset.dockSectionId);
      return;
    }

    const dockActionTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.dockActionId);
    if (dockActionTarget) {
      event.preventDefault();
      event.stopPropagation();
      this._runDockControlAction(dockActionTarget.dataset.dockActionId, this._getVacuumState());
      return;
    }

    const routineTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.routineIndex);
    if (routineTarget) {
      const items = this._getRoutineItems(this._getVacuumState());
      const item = items[Number(routineTarget.dataset.routineIndex)];
      if (item) {
        event.preventDefault();
        event.stopPropagation();
        this._runRoutineItem(item);
      }
      return;
    }

    const customMenuItemTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.customMenuIndex);
    if (customMenuItemTarget) {
      const items = this._getVisibleCustomMenuItems(this._getVacuumState());
      const item = items[Number(customMenuItemTarget.dataset.customMenuIndex)];
      if (item) {
        event.preventDefault();
        event.stopPropagation();
        this._runCustomMenuItem(item);
      }
    }
  }

  _onShadowChange(event) {
    const selectTarget = event.composedPath().find(node => node instanceof HTMLSelectElement && node.dataset?.dockSettingId);
    if (!selectTarget) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._setDockSettingOption(selectTarget.dataset.dockSettingId, selectTarget.value, this._getVacuumState());
  }

  _onShadowPointerDown(event) {
    this._triggerPressAnimation(this._getPressTargetFromEvent(event));

    if (this._touchPinchGesture && event.pointerType === "touch") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const roomTarget = this._getRoomSelectionTarget(event);
    if (roomTarget) {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }

      if (this._isRoomSelectionLocked()) {
        this._clearPendingRoomSelectionTap();
        return;
      }

      const roomId = String(roomTarget.getAttribute("data-room-id") || "").trim();
      if (!roomId) {
        this._clearPendingRoomSelectionTap();
        return;
      }

      this._pendingRoomSelectionTap = {
        pointerId: event.pointerId,
        roomId,
        clientX: Number(event.clientX || 0),
        clientY: Number(event.clientY || 0),
      };
      return;
    }

    const surface = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.mapSurface === "main");
    if (!surface) {
      return;
    }

    const interactiveTarget = event.composedPath().find(node => node instanceof Element && typeof node.getAttribute === "function" && (
      node.getAttribute("data-room-id") ||
      node.getAttribute("data-zone-id") ||
      node.getAttribute("data-goto-id") ||
      node.getAttribute("data-control-action") ||
      node.getAttribute("data-mode-id") ||
      node.getAttribute("data-header-action-index") ||
      node.getAttribute("data-mode-option-kind") ||
      node.getAttribute("data-custom-menu-index") ||
      node.getAttribute("data-dock-section-id") ||
      node.getAttribute("data-dock-action-id") ||
      node.getAttribute("data-dock-setting-id") ||
      node.getAttribute("data-manual-zone-index")
    ));

    if (interactiveTarget) {
      return;
    }

    if (this._activeMode !== "zone") {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const zoneHandleTarget = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.zoneHandleIndex && node.dataset?.zoneHandleAction);
    if (zoneHandleTarget) {
      const index = Number(zoneHandleTarget.dataset.zoneHandleIndex);
      const zone = this._manualZones[index];
      const handlePoints = zone ? this._getZoneHandlePoints(zone) : null;
      const selectedHandle = handlePoints?.handles?.find(handle => handle.id === zoneHandleTarget.dataset.zoneHandleAction);

      if (!zone || !selectedHandle) {
        return;
      }

      this._selectedManualZoneIndex = index;
      event.preventDefault();
      event.stopPropagation();

      if (event.pointerId !== undefined) {
        try {
          surface.setPointerCapture(event.pointerId);
        } catch (_error) {
          // Ignore unsupported pointer capture.
        }
      }

      if (selectedHandle.id === "delete") {
        this._deleteManualZone(index);
        return;
      }

      const rect = handlePoints.rect;
      const mapPoint = this._eventToMapPoint(event);
      this._zoneHandleDrag = selectedHandle.id === "move"
        ? {
            pointerId: event.pointerId,
            index,
            action: "move",
            startPoint: mapPoint || { x: rect.x, y: rect.y },
            startRect: rect,
          }
        : {
            pointerId: event.pointerId,
            index,
            action: "resize",
            fixedPoint: {
              x: rect.x,
              y: rect.y,
            },
          };

      this._render();
      return;
    }

    if (event.pointerId !== undefined) {
      this._activeMapPointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      if (event.pointerType !== "touch") {
        try {
          surface.setPointerCapture(event.pointerId);
        } catch (_error) {
          // Ignore unsupported pointer capture.
        }
      }
    }

    if (this._activeMapPointers.size >= 2) {
      this._startPinchGesture();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const skip = event.composedPath().find(node => node instanceof HTMLElement && (
      node.dataset?.roomId ||
      node.dataset?.zoneId ||
      node.dataset?.gotoId ||
      node.dataset?.controlAction ||
      node.dataset?.modeId ||
      node.dataset?.headerActionIndex ||
      node.dataset?.modeOptionKind ||
      node.dataset?.customMenuIndex ||
      node.dataset?.dockSectionId ||
      node.dataset?.dockActionId ||
      node.dataset?.dockSettingId ||
      node.dataset?.manualZoneIndex
    ));

    if (skip) {
      return;
    }

    const vacuumPoint = this._eventToVacuumPoint(event);
    if (!vacuumPoint) {
      return;
    }

    if (this._manualZones.length >= this._getManualZoneCountLimit()) {
      return;
    }

    this._pointerStart = vacuumPoint;
    this._pointerSurfaceRect = this._getMapSurfaceRect();

    if (event.pointerType === "touch") {
      this._pendingTouchZoneStart = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        vacuumPoint: {
          x: Math.round(vacuumPoint.x),
          y: Math.round(vacuumPoint.y),
        },
      };
      return;
    }

    this._draftZone = {
      x1: Math.round(vacuumPoint.x),
      y1: Math.round(vacuumPoint.y),
      x2: Math.round(vacuumPoint.x),
      y2: Math.round(vacuumPoint.y),
    };

    event.preventDefault();
    event.stopPropagation();
    this._render();
  }

  _onShadowPointerMove(event) {
    if (this._touchPinchGesture && event.pointerType === "touch") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this._pendingRoomSelectionTap?.pointerId === event.pointerId) {
      const deltaX = Number(event.clientX || 0) - this._pendingRoomSelectionTap.clientX;
      const deltaY = Number(event.clientY || 0) - this._pendingRoomSelectionTap.clientY;
      if (Math.hypot(deltaX, deltaY) > 10) {
        this._pendingRoomSelectionTap = null;
      }
    }

    if (this._activeMapPointers.has(event.pointerId)) {
      this._activeMapPointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    if (this._updatePinchGesture()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this._updateManualZoneFromHandleDrag(event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (
      this._pendingTouchZoneStart &&
      event.pointerType === "touch" &&
      event.pointerId === this._pendingTouchZoneStart.pointerId
    ) {
      const deltaX = event.clientX - this._pendingTouchZoneStart.clientX;
      const deltaY = event.clientY - this._pendingTouchZoneStart.clientY;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance < 12) {
        return;
      }

      if (Math.abs(deltaY) > Math.abs(deltaX) * 1.1) {
        this._pendingTouchZoneStart = null;
        this._pointerStart = null;
        this._pointerSurfaceRect = null;
        return;
      }

      this._pointerStart = this._pendingTouchZoneStart.vacuumPoint;
      this._pointerSurfaceRect = this._getMapSurfaceRect();
      this._draftZone = {
        x1: Math.round(this._pointerStart.x),
        y1: Math.round(this._pointerStart.y),
        x2: Math.round(this._pointerStart.x),
        y2: Math.round(this._pointerStart.y),
      };
      this._pendingTouchZoneStart = null;
    }

    if (!this._draftZone || this._activeMode !== "zone") {
      return;
    }

    const vacuumPoint = this._eventToVacuumPoint(event);
    if (!vacuumPoint) {
      return;
    }

    this._draftZone = {
      x1: Math.round(this._pointerStart.x),
      y1: Math.round(this._pointerStart.y),
      x2: Math.round(vacuumPoint.x),
      y2: Math.round(vacuumPoint.y),
    };
    this._render();
    event.preventDefault();
    event.stopPropagation();
  }

  _onShadowPointerUp(event) {
    if (this._touchPinchGesture && event.pointerType === "touch") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this._pendingRoomSelectionTap?.pointerId === event.pointerId) {
      const pendingTap = this._pendingRoomSelectionTap;
      this._pendingRoomSelectionTap = null;

      if (!this._isRoomSelectionLocked()) {
        const deltaX = Number(event.clientX || 0) - pendingTap.clientX;
        const deltaY = Number(event.clientY || 0) - pendingTap.clientY;
        if (Math.hypot(deltaX, deltaY) <= 10) {
          event.preventDefault();
          event.stopPropagation();
          this._markSuppressedRoomSelectionClick(pendingTap.roomId);
          this._toggleRoomSelection(pendingTap.roomId);
          return;
        }
      }
    }

    const surface = this.shadowRoot?.querySelector("[data-map-surface='main']");
    if (surface && event.pointerId !== undefined) {
      try {
        surface.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // Ignore unsupported pointer capture release.
      }
    }

    const wasPinching = Boolean(this._pinchGesture);
    if (this._activeMapPointers.has(event.pointerId)) {
      this._activeMapPointers.delete(event.pointerId);
    }

    if (wasPinching) {
      if (this._activeMapPointers.size < 2) {
        this._pinchGesture = null;
      }
      return;
    }

    if (this._zoneHandleDrag?.pointerId === event.pointerId) {
      this._zoneHandleDrag = null;
      this._persistCurrentCleaningSessionState(this._activeMode, {
        markSelectionChange: true,
      });
      this._triggerHaptic("selection");
      this._render();
      return;
    }

    if (this._pendingTouchZoneStart?.pointerId === event.pointerId) {
      this._pendingTouchZoneStart = null;
      this._pointerStart = null;
      this._pointerSurfaceRect = null;
      return;
    }

    if (this._activeMode === "goto") {
      const skip = event.composedPath().find(node => node instanceof HTMLElement && (
        node.dataset?.roomId ||
        node.dataset?.zoneId ||
        node.dataset?.gotoId ||
        node.dataset?.controlAction ||
        node.dataset?.modeId ||
        node.dataset?.headerActionIndex ||
        node.dataset?.modeOptionKind ||
        node.dataset?.customMenuIndex ||
        node.dataset?.dockSectionId ||
        node.dataset?.dockActionId ||
        node.dataset?.dockSettingId ||
        node.dataset?.manualZoneIndex ||
        node.dataset?.zoneHandleIndex
      ));

      const surface = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.mapSurface === "main");
      if (!skip && surface) {
        const point = this._eventToVacuumPoint(event);
        if (point) {
          this._gotoPoint = {
            x: Math.round(point.x),
            y: Math.round(point.y),
          };
          this._triggerHaptic("selection");
          this._render();
        }
      }
      return;
    }

    if (!this._draftZone || this._activeMode !== "zone") {
      return;
    }

    const zone = this._draftZone;
    this._draftZone = null;
    this._pointerStart = null;
    this._pointerSurfaceRect = null;

    const width = Math.abs(zone.x2 - zone.x1);
    const height = Math.abs(zone.y2 - zone.y1);
    if (width > 200 && height > 200) {
      this._manualZones = [...this._manualZones, {
        x1: Math.min(zone.x1, zone.x2),
        y1: Math.min(zone.y1, zone.y2),
        x2: Math.max(zone.x1, zone.x2),
        y2: Math.max(zone.y1, zone.y2),
      }];
      this._selectedManualZoneIndex = this._manualZones.length - 1;
      this._persistCurrentCleaningSessionState(this._activeMode, {
        markSelectionChange: true,
      });
      this._triggerHaptic("selection");
    }

    this._render();
  }

  _onMapImageLoad(event) {
    const image = event.currentTarget;
    const width = Number(image?.naturalWidth || image?.width || 0);
    const height = Number(image?.naturalHeight || image?.height || 0);
    const staleImages = this.shadowRoot?.querySelectorAll("[data-map-image-previous='true']") || [];

    image?.classList?.remove("is-pending");
    image?.classList?.add("is-loaded");

    staleImages.forEach(staleImage => {
      staleImage.classList.add("is-fading-out");
      window.setTimeout(() => {
        staleImage.remove();
      }, 260);
    });

    if (width > 0 && height > 0) {
      const dimensionsChanged = width !== this._mapImageWidth || height !== this._mapImageHeight;
      this._mapImageWidth = width;
      this._mapImageHeight = height;
      if (dimensionsChanged) {
        this._render();
      }
    }
  }

  _estimateRoomMarkerFootprint(room, markerSize, labelSize, iconSize) {
    if (this._config?.show_room_labels === false) {
      return {
        width: markerSize,
        height: markerSize,
      };
    }

    const label = String(room?.label || room?.id || "").trim();
    const estimatedTextWidth = Math.max(labelSize * 2.6, label.length * labelSize * 0.57);
    return {
      width: Math.max(markerSize, estimatedTextWidth + iconSize + 24),
      height: markerSize,
    };
  }

  _isPointInsideRoom(point, room) {
    return arrayFromMaybe(room?.outlines).some(outline => pointInPolygon(point, outline));
  }

  _getPrimaryRoomOutline(room) {
    const outlines = arrayFromMaybe(room?.outlines)
      .filter(outline => Array.isArray(outline) && outline.length >= 3)
      .sort((left, right) => polygonArea(right) - polygonArea(left));

    if (outlines.length) {
      return outlines[0];
    }

    const legacyOutline = arrayFromMaybe(room?.outline);
    return legacyOutline.length >= 3 ? legacyOutline : [];
  }

  _getRoomMarkerCandidatePoints(room) {
    const primaryOutline = this._getPrimaryRoomOutline(room);
    if (primaryOutline.length < 3) {
      return [];
    }

    const bounds = polygonBounds(primaryOutline);
    const overallCenter = centroid(primaryOutline);
    const lowerCenter = {
      x: bounds.minX + (bounds.width * 0.5),
      y: bounds.minY + (bounds.height * 0.72),
    };
    const lowerDeepCenter = {
      x: bounds.minX + (bounds.width * 0.5),
      y: bounds.minY + (bounds.height * 0.84),
    };
    const upperCenter = {
      x: bounds.minX + (bounds.width * 0.5),
      y: bounds.minY + (bounds.height * 0.36),
    };
    const leftCenter = {
      x: bounds.minX + (bounds.width * 0.34),
      y: bounds.minY + (bounds.height * 0.56),
    };
    const rightCenter = {
      x: bounds.minX + (bounds.width * 0.66),
      y: bounds.minY + (bounds.height * 0.56),
    };

    const candidates = [
      room?.labelPoint,
      lowerCenter,
      centroid(primaryOutline),
      lowerDeepCenter,
      upperCenter,
      leftCenter,
      rightCenter,
      room?.iconPoint,
      overallCenter,
    ]
      .filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))
      .filter((point, index, items) => items.findIndex(item => Math.abs(item.x - point.x) < 1 && Math.abs(item.y - point.y) < 1) === index);

    return candidates.filter(point => this._isPointInsideRoom(point, room));
  }

  _getRoomMarkerPlacements(rooms, markerSize, labelSize, iconSize) {
    const mapRect = this._getMapSurfaceRect();
    const viewportWidth = mapRect?.width || this._mapImageWidth || 1;
    const viewportHeight = mapRect?.height || this._mapImageHeight || 1;
    const placements = new Map();
    const placedRects = [];

    const orderedRooms = rooms
      .filter(room => this._getPrimaryRoomOutline(room).length >= 3)
      .map(room => {
        const primaryOutline = this._getPrimaryRoomOutline(room);
        return {
          room,
          area: polygonArea(primaryOutline),
          preferredAnchor: room.labelPoint || room.iconPoint || centroid(primaryOutline),
        };
      })
      .filter(item => item.area > 0)
      .sort((left, right) => left.area - right.area);

    orderedRooms.forEach(({ room, preferredAnchor }) => {
      const footprint = this._estimateRoomMarkerFootprint(room, markerSize, labelSize, iconSize);
      const candidates = this._getRoomMarkerCandidatePoints(room);
      const fallbackAnchor = preferredAnchor && Number.isFinite(preferredAnchor.x) && Number.isFinite(preferredAnchor.y)
        ? preferredAnchor
        : this._getPrimaryRoomOutline(room).length >= 3
          ? centroid(this._getPrimaryRoomOutline(room))
          : null;

      if (!candidates.length && fallbackAnchor) {
        candidates.push(fallbackAnchor);
      }

      let bestPlacement = null;
      let bestScore = Number.POSITIVE_INFINITY;

      candidates.forEach((candidate, index) => {
        const percent = this._vacuumToViewportPercent(candidate);
        const centerX = (percent.left / 100) * viewportWidth;
        const centerY = ((percent.top / 100) * viewportHeight) + Number(room.labelOffsetY || 0);
        const rect = {
          left: centerX - (footprint.width / 2),
          top: centerY - (footprint.height / 2),
          right: centerX + (footprint.width / 2),
          bottom: centerY + (footprint.height / 2),
        };
        const overflow = (
          Math.max(0, 8 - rect.left) +
          Math.max(0, 8 - rect.top) +
          Math.max(0, rect.right - (viewportWidth - 8)) +
          Math.max(0, rect.bottom - (viewportHeight - 8))
        );
        const overlap = placedRects.reduce((acc, placedRect) => acc + rectIntersectionArea(rect, placedRect), 0);
        const distancePenalty = preferredAnchor
          ? Math.hypot(candidate.x - preferredAnchor.x, candidate.y - preferredAnchor.y) * 0.01
          : 0;
        const score = (overlap * 1000) + (overflow * 100) + (index * 4) + distancePenalty;

        if (score < bestScore) {
          bestScore = score;
          bestPlacement = {
            left: clamp((centerX / viewportWidth) * 100, 0, 100),
            top: clamp((centerY / viewportHeight) * 100, 0, 100),
            rect,
          };
        }

        if (overlap === 0 && overflow === 0 && index > 0) {
          bestScore = score;
          bestPlacement = {
            left: clamp((centerX / viewportWidth) * 100, 0, 100),
            top: clamp((centerY / viewportHeight) * 100, 0, 100),
            rect,
          };
        }
      });

      if (bestPlacement) {
        placements.set(String(room.id), bestPlacement);
        placedRects.push(bestPlacement.rect);
      }
    });

    return placements;
  }

  _renderRoomMarkers(rooms) {
    if (this._config?.show_room_markers === false) {
      return "";
    }

    const isRoomSelectionLocked = this._isRoomSelectionLocked();
    const highlightedRoomIds = new Set(this._getHighlightedRoomIds());
    const safeStyles = getSafeStyles(this._config?.styles);
    const markerSize = Math.max(22, Math.round(parseSizeToPixels(safeStyles?.map?.marker_size, 34) * 0.76));
    const labelSize = Math.max(9, Math.round(parseSizeToPixels(safeStyles?.map?.label_size, 12) * 0.84));
    const iconSize = Math.max(12, Math.round(markerSize * 0.42));
    const placements = this._getRoomMarkerPlacements(rooms, markerSize, labelSize, iconSize);

    return rooms
      .filter(room => this._getPrimaryRoomOutline(room).length >= 3)
      .map(room => {
      const placement = placements.get(String(room.id));
      const primaryOutline = this._getPrimaryRoomOutline(room);
      const anchor = room.iconPoint || room.labelPoint || centroid(primaryOutline);
      const percent = placement || this._vacuumToViewportPercent(anchor);
      const selected = highlightedRoomIds.has(String(room.id));
      return `
        <button
          class="advance-vacuum-card__room-marker ${selected ? "is-selected" : ""} ${this._config?.show_room_labels === false ? "is-icon-only" : ""} ${isRoomSelectionLocked ? "is-readonly" : ""}"
          style="left:${percent.left}%; top:${percent.top}%; --marker-size:${markerSize}px; --room-label-size:${labelSize}px; --room-icon-size:${iconSize}px; --room-marker-gap:5px; --room-marker-padding:0 9px;"
          data-room-id="${escapeHtml(room.id)}"
          title="${escapeHtml(room.label || room.id)}"
          ${isRoomSelectionLocked ? "disabled" : ""}
        >
          <ha-icon icon="${escapeHtml(room.icon || "mdi:broom")}"></ha-icon>
          ${
            this._config?.show_room_labels === false
              ? ""
              : `<span>${escapeHtml(room.label || room.id)}</span>`
          }
        </button>
      `;
    }).join("");
  }

  _renderRoomSelectionHighlights(rooms, highlightedRoomIds, mapImageUrl, modeId = this._activeMode) {
    if (
      modeId !== "rooms" ||
      !mapImageUrl
    ) {
      return "";
    }

    const highlights = rooms
      .filter(room => highlightedRoomIds.has(String(room.id)))
      .flatMap(room => room.outlines.map((outline, index) => ({
        clipPath: this._vacuumOutlineToCssPolygon(outline),
        key: `${room.id}-${index}`,
      })))
      .filter(item => item.clipPath);

    if (!highlights.length) {
      return "";
    }

    return `
      <div class="advance-vacuum-card__room-highlight-layer" aria-hidden="true">
        ${highlights.map(highlight => `
          <img
            class="advance-vacuum-card__room-highlight-image"
            src="${escapeHtml(mapImageUrl)}"
            alt=""
            draggable="false"
            style="clip-path: polygon(${escapeHtml(highlight.clipPath)});"
            data-room-highlight-id="${escapeHtml(highlight.key)}"
          />
        `).join("")}
      </div>
    `;
  }

  _renderZoneSelectionHighlights(zones, mapImageUrl, modeId = this._activeMode) {
    if (
      modeId !== "rooms" ||
      !Array.isArray(zones) ||
      !zones.length ||
      !mapImageUrl
    ) {
      return "";
    }

    const highlights = zones
      .map((zone, index) => ({
        clipPath: this._vacuumZoneToCssPolygon(zone),
        key: `zone-${index}`,
      }))
      .filter(item => item.clipPath);

    if (!highlights.length) {
      return "";
    }

    return `
      <div class="advance-vacuum-card__room-highlight-layer advance-vacuum-card__room-highlight-layer--zones" aria-hidden="true">
        ${highlights.map(highlight => `
          <img
            class="advance-vacuum-card__room-highlight-image"
            src="${escapeHtml(mapImageUrl)}"
            alt=""
            draggable="false"
            style="clip-path: polygon(${escapeHtml(highlight.clipPath)});"
            data-zone-highlight-id="${escapeHtml(highlight.key)}"
          />
        `).join("")}
      </div>
    `;
  }

  _renderRoomFallbackList(rooms, modeId = this._activeMode) {
    if (modeId !== "rooms" || !rooms.length) {
      return "";
    }

    const state = this._getVacuumState();
    const isRoomSelectionLocked = this._isRoomSelectionLocked(state);
    const highlightedRoomIds = new Set(this._getHighlightedRoomIds(state));
    const fallbackRooms = rooms.filter(room => room.outlines.length === 0);
    if (!fallbackRooms.length) {
      return "";
    }

    return `
      <div class="advance-vacuum-card__room-list">
        ${fallbackRooms.map(room => `
          <button
            class="advance-vacuum-card__room-chip ${highlightedRoomIds.has(String(room.id)) ? "is-selected" : ""} ${isRoomSelectionLocked ? "is-readonly" : ""}"
            data-room-id="${escapeHtml(room.id)}"
            title="${escapeHtml(room.label || room.id)}"
            ${isRoomSelectionLocked ? "disabled" : ""}
          >
            <ha-icon icon="${escapeHtml(room.icon || "mdi:broom")}"></ha-icon>
            <span>${escapeHtml(room.label || room.id)}</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  _renderGotoMarkers(points) {
    if (this._activeMode !== "goto") {
      return "";
    }

    return points.map(point => {
      const percent = this._vacuumToViewportPercent(point.position);
      const selected = this._gotoPoint && Math.round(this._gotoPoint.x) === Math.round(point.position.x) && Math.round(this._gotoPoint.y) === Math.round(point.position.y);
      return `
        <button
          class="advance-vacuum-card__goto-marker ${selected ? "is-selected" : ""}"
          style="left:${percent.left}%; top:${percent.top}%;"
          data-goto-id="${escapeHtml(point.id)}"
          title="${escapeHtml(point.label || "Punto")}"
        >
          <ha-icon icon="${escapeHtml(point.icon || "mdi:map-marker")}"></ha-icon>
        </button>
      `;
    }).join("");
  }

  _renderManualZoneEditors() {
    if (this._activeMode !== "zone" || !this._manualZones.length) {
      return "";
    }

    this._sanitizeSelectedManualZoneIndex();

    return this._manualZones.map((zone, index) => {
      const { rect, handles } = this._getZoneHandlePoints(zone);
      const selected = index === this._selectedManualZoneIndex;
      const topLeft = this._mapToViewportPercent({ x: rect.x, y: rect.y });
      const bottomRight = this._mapToViewportPercent({ x: rect.x + rect.width, y: rect.y + rect.height });
      const left = Math.min(topLeft.left, bottomRight.left);
      const top = Math.min(topLeft.top, bottomRight.top);
      const width = Math.abs(bottomRight.left - topLeft.left);
      const height = Math.abs(bottomRight.top - topLeft.top);
      const handleMarkup = selected
        ? handles.map(handle => {
            const percent = this._mapToViewportPercent({ x: handle.x, y: handle.y });
            return `
              <button
                class="advance-vacuum-card__zone-handle"
                style="left:${percent.left}%; top:${percent.top}%;"
                data-zone-handle-index="${index}"
                data-zone-handle-action="${escapeHtml(handle.id)}"
                title="${escapeHtml(handle.title)}"
              >
                <ha-icon icon="${escapeHtml(handle.icon)}"></ha-icon>
              </button>
            `;
          }).join("")
        : "";

      return `
        <button
          class="advance-vacuum-card__zone-hitbox ${selected ? "is-selected" : ""}"
          style="left:${left}%; top:${top}%; width:${width}%; height:${height}%;"
          data-manual-zone-index="${index}"
          title="Editar zona ${index + 1}"
        ></button>
        ${handleMarkup}
      `;
    }).join("");
  }

  _renderMapTools() {
    const state = this._getVacuumState();
    const hasZoneMode = this._getAvailableModes().some(mode => mode.id === "zone");
    const isCleaningSessionActive = this._isCleaningSessionActive(state);
    const mapStatusIndicator = this._getMapStatusIndicator(state);
    const showAddZoneButton = hasZoneMode && (this._activeMode === "zone" || isCleaningSessionActive);
    const canAddZone = this._manualZones.length < this._getManualZoneCountLimit();
    return `
      <div class="advance-vacuum-card__map-tools">
        <div class="advance-vacuum-card__map-tools-group advance-vacuum-card__map-tools-group--left">
          <button
            type="button"
            class="advance-vacuum-card__map-tool advance-vacuum-card__map-tool--back"
            data-map-back="true"
            data-control-action="clear"
            title="Volver al panel principal"
          >
            <ha-icon icon="mdi:arrow-left"></ha-icon>
          </button>
        </div>
        ${
          mapStatusIndicator
            ? `
              <div class="advance-vacuum-card__map-tools-group advance-vacuum-card__map-tools-group--center" aria-hidden="true">
                <div
                  class="advance-vacuum-card__map-tool advance-vacuum-card__map-tool--status advance-vacuum-card__map-tool--status-${escapeHtml(mapStatusIndicator.tone)}"
                  title="${escapeHtml(mapStatusIndicator.title)}"
                  aria-label="${escapeHtml(mapStatusIndicator.title)}"
                >
                  <ha-icon icon="${escapeHtml(mapStatusIndicator.icon)}"></ha-icon>
                </div>
              </div>
            `
            : ""
        }
        <div class="advance-vacuum-card__map-tools-group advance-vacuum-card__map-tools-group--right">
          ${
            showAddZoneButton
              ? `
                <button
                  class="advance-vacuum-card__map-tool advance-vacuum-card__map-tool--add ${!canAddZone ? "is-disabled" : ""}"
                  data-control-action="add_zone"
                  title="Añadir zona"
                  ${!canAddZone ? "disabled" : ""}
                >
                  <ha-icon icon="mdi:plus"></ha-icon>
                  <span class="advance-vacuum-card__map-tool-label">Zona</span>
                </button>
              `
              : ""
          }
        </div>
      </div>
    `;
  }

  _renderStateChip(state) {
    if (this._config?.show_state_chip === false) {
      return "";
    }
    return `
      <span class="advance-vacuum-card__chip">
        ${escapeHtml(this._getStateLabel(state))}
      </span>
    `;
  }

  _renderBatteryChip(state) {
    const level = this._getBatteryLevel(state);
    if (this._config?.show_battery_chip === false || level === null) {
      return "";
    }
    return `
      <span class="advance-vacuum-card__chip advance-vacuum-card__chip--battery" style="--battery-color:${escapeHtml(this._getBatteryColor(level))};">
        <ha-icon icon="mdi:battery"></ha-icon>
        <span>${level}%</span>
      </span>
    `;
  }

  _renderModePanel(state) {
    const activePreset = this._getActiveModePanelPreset(state);
    const descriptors = this._getVisibleModePanelDescriptors(state, activePreset);
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const langCfg = this._config?.language ?? "auto";
    const u = window.NodaliaI18n?.strings?.(window.NodaliaI18n?.resolveLanguage?.(hass, langCfg))?.advanceVacuum?.utility;
    const utilityMetaContent = [
      ["smart", "custom"].includes(activePreset)
        ? ""
        : `
          <div class="advance-vacuum-card__utility-chip-group">
            <div class="advance-vacuum-card__utility-label">${escapeHtml(u?.cleaningCounter ?? "Contador de limpiezas")}</div>
            <button class="advance-vacuum-card__selection-chip" data-control-action="repeats">
              <ha-icon icon="mdi:repeat"></ha-icon>
              <strong>x${this._repeats}</strong>
            </button>
          </div>
        `,
      this._activeMode === "zone"
        ? `<div class="advance-vacuum-card__selection-chip"><strong>${this._manualZones.length + this._selectedPredefinedZoneIds.length}</strong><span>${escapeHtml(u?.zonesWord ?? "zonas")}</span></div>`
        : this._activeMode === "goto"
          ? `<div class="advance-vacuum-card__selection-chip"><strong>${this._gotoPoint ? "1" : "0"}</strong><span>${escapeHtml(u?.pointWord ?? "punto")}</span></div>`
          : "",
    ].filter(Boolean).join("");
    if (!PANEL_MODE_PRESETS.length && !descriptors.length && this._activeMode === "all") {
      return "";
    }

    return `
      <div class="advance-vacuum-card__utility-panel">
        <div class="advance-vacuum-card__utility-group">
          <div class="advance-vacuum-card__utility-label">${escapeHtml(u?.cleaningMode ?? "Modo de limpieza")}</div>
          <div class="advance-vacuum-card__utility-options advance-vacuum-card__utility-options--presets">
            ${PANEL_MODE_PRESETS.map(preset => `
              <button
                class="advance-vacuum-card__utility-option ${preset.id === activePreset ? "is-active" : ""}"
                data-mode-preset-id="${escapeHtml(preset.id)}"
              >
                ${escapeHtml(this._advanceVacuumStrings()?.panelModes?.[preset.id] || preset.label)}
              </button>
            `).join("")}
          </div>
        </div>
        ${descriptors.map(descriptor => `
          <div class="advance-vacuum-card__utility-group">
            <div class="advance-vacuum-card__utility-label">${escapeHtml(descriptor.label)}</div>
            <div class="advance-vacuum-card__utility-options">
              ${descriptor.options.map(option => `
                <button
                  class="advance-vacuum-card__utility-option ${descriptor.current === option ? "is-active" : ""}"
                  data-mode-option-kind="${escapeHtml(descriptor.kind)}"
                  data-mode-option-value="${escapeHtml(option)}"
                >
                  ${escapeHtml(humanizeModeLabel(option, descriptor.kind, hass, langCfg))}
                </button>
              `).join("")}
            </div>
          </div>
        `).join("")}
        ${utilityMetaContent ? `<div class="advance-vacuum-card__utility-meta">${utilityMetaContent}</div>` : ""}
      </div>
    `;
  }

  _renderDockControlSection(state) {
    const descriptors = this._getDockControlDescriptors(state);
    if (!descriptors.length) {
      return "";
    }

    return `
      <div class="advance-vacuum-card__utility-group">
        <div class="advance-vacuum-card__utility-label">${escapeHtml(window.NodaliaI18n?.strings?.(window.NodaliaI18n?.resolveLanguage?.(this._hass ?? window.NodaliaI18n?.resolveHass?.(null), this._config?.language ?? "auto"))?.advanceVacuum?.utility?.dockActions ?? "Acciones de base")}</div>
        <div class="advance-vacuum-card__utility-options advance-vacuum-card__utility-options--menu">
          ${descriptors.map(descriptor => `
            <button
              class="advance-vacuum-card__utility-option advance-vacuum-card__utility-option--menu ${descriptor.active ? "is-active" : ""}"
              data-dock-action-id="${escapeHtml(descriptor.id)}"
            >
              <ha-icon icon="${escapeHtml(descriptor.icon || "mdi:flash")}"></ha-icon>
              <span>${escapeHtml(descriptor.label)}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  _renderDockSettingsSection(state) {
    const descriptors = this._getDockSettingDescriptors(state);
    if (!descriptors.length) {
      return "";
    }

    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const langCfg = this._config?.language ?? "auto";

    return descriptors.map(descriptor => `
      <label class="advance-vacuum-card__utility-field">
        <span class="advance-vacuum-card__utility-label">${escapeHtml(descriptor.label)}</span>
        <select class="advance-vacuum-card__utility-select" data-dock-setting-id="${escapeHtml(descriptor.id)}">
          ${descriptor.options.map(option => `
            <option value="${escapeHtml(option)}" ${normalizeTextKey(descriptor.current) === normalizeTextKey(option) ? "selected" : ""}>
              ${escapeHtml(humanizeSelectOptionLabel(option, descriptor.id === "mop_mode" ? "mop_mode" : "generic", hass, langCfg))}
            </option>
          `).join("")}
        </select>
      </label>
    `).join("");
  }

  _renderDockPanel(state) {
    const controlDescriptors = this._getDockControlDescriptors(state);
    const settingDescriptors = this._getDockSettingDescriptors(state);
    const availableSections = DOCK_PANEL_SECTIONS.filter(section => (
      section.id === "control" ? controlDescriptors.length > 0 : settingDescriptors.length > 0
    ));

    if (!availableSections.length) {
      return "";
    }

    const activeSection = availableSections.find(section => section.id === this._activeDockPanelSection) || availableSections[0];
    if (activeSection.id !== this._activeDockPanelSection) {
      this._activeDockPanelSection = activeSection.id;
    }

    return `
      <div class="advance-vacuum-card__utility-panel">
        <div class="advance-vacuum-card__utility-group">
          <div class="advance-vacuum-card__utility-label">${escapeHtml(this._advanceVacuumStrings()?.utility?.chargingStation || "Base de carga")}</div>
          <div class="advance-vacuum-card__utility-options advance-vacuum-card__utility-options--presets">
            ${availableSections.map(section => `
              <button
                class="advance-vacuum-card__utility-option ${section.id === activeSection.id ? "is-active" : ""}"
                data-dock-section-id="${escapeHtml(section.id)}"
              >
                ${escapeHtml(this._advanceVacuumStrings()?.dockSections?.[section.id] || section.label)}
              </button>
            `).join("")}
          </div>
        </div>
        ${activeSection.id === "control" ? this._renderDockControlSection(state) : this._renderDockSettingsSection(state)}
      </div>
    `;
  }

  _renderCustomMenuPanel(state) {
    const items = this._getVisibleCustomMenuItems(state);
    if (!items.length) {
      return "";
    }

    return `
      <div class="advance-vacuum-card__utility-panel">
        <div class="advance-vacuum-card__utility-options advance-vacuum-card__utility-options--menu">
          ${items.map((item, index) => `
            <button class="advance-vacuum-card__utility-option advance-vacuum-card__utility-option--menu" data-custom-menu-index="${index}">
              <ha-icon icon="${escapeHtml(item.icon || "mdi:flash")}"></ha-icon>
              <span>${escapeHtml(item.label)}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  _renderRoutinesPanel(state = this._getVacuumState()) {
    const routines = this._getRoutineItems(state);
    if (!routines.length || this._isCleaningSessionActive(state) || this._activeMode !== "routines") {
      return "";
    }

    return `
      <div class="advance-vacuum-card__routines">
        ${routines.map((item, index) => {
          const entityState = this._getRoutineEntityState(item);
          const isDisabled = Boolean(item.entity) && isUnavailableState(entityState);
          const label = this._getRoutineLabel(item, entityState);
          const icon = this._getRoutineIcon(item, entityState);
          return `
            <button
              type="button"
              class="advance-vacuum-card__routine-button ${isDisabled ? "is-disabled" : ""}"
              data-routine-index="${index}"
              title="${escapeHtml(label)}"
              ${isDisabled ? "disabled" : ""}
            >
              <span class="advance-vacuum-card__routine-icon">
                <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
              </span>
              <span class="advance-vacuum-card__routine-label">${escapeHtml(label)}</span>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    try {
      this._ensurePersistedCleaningSessionStateLoaded();

      const previousImage = this.shadowRoot.querySelector("[data-map-image]");
      const previousImageSrc = previousImage?.getAttribute("src") || "";

      const config = this._config || normalizeConfig({});
      const state = this._getVacuumState();
      const accentColor = this._getAccentColor(state);
      const advanceVacuumStrings = this._advanceVacuumStrings();
      const styles = getSafeStyles(config.styles);
      const animations = this._getAnimationSettings();
      const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
      this._syncActiveCleaningSession(state);
      const rooms = this._getRoomSegments();
      const gotoPoints = this._getGotoPoints();
      const predefinedZones = this._getPredefinedZones();
      const highlightedRoomIds = new Set(this._getHighlightedRoomIds(state));
      const modes = this._getAvailableModes();
      const preferredModeId = ["rooms", "zone", "goto"].includes(this._activeMode)
        ? this._activeMode
        : (this._activeCleaningSessionMode || this._activeMode || "all");
      const currentMode = modes.find(mode => mode.id === preferredModeId)
        || (["rooms", "zone", "goto"].includes(preferredModeId)
          ? {
              id: preferredModeId,
              label: advanceVacuumStrings?.modeLabels?.[preferredModeId] || MODE_LABELS[preferredModeId],
              icon: preferredModeId === "rooms"
                ? "mdi:floor-plan"
                : preferredModeId === "zone"
                  ? "mdi:vector-rectangle"
                  : "mdi:map-marker",
            }
          : null)
        || modes[0]
        || { id: "all", label: advanceVacuumStrings?.modeLabels?.all || MODE_LABELS.all, icon: "mdi:home" };
      const iconSize = Math.max(54, parseSizeToPixels(styles.icon.size, 64));
      const controlSize = Math.max(38, parseSizeToPixels(styles.control.size, 42));
      const titleSize = Math.max(15, parseSizeToPixels(styles.title_size, 16));
      const mapRadius = Math.max(22, parseSizeToPixels(styles.map.radius, 26));
      const cardRadius = Math.max(mapRadius, parseSizeToPixels(styles.card.border_radius, 32));
      const cardPaddingPx = Math.max(0, parseSizeToPixels(styles.card.padding, 16));
      const mapHorizontalBleed = Math.max(0, Math.round(cardPaddingPx));
      const mapTopBleed = Math.max(0, Math.round(cardPaddingPx));
      const mapMinHeight = Math.max(320, Math.round(controlSize * 7.4));
      const chipHeight = Math.max(24, parseSizeToPixels(styles.chip_height, 26));
      const chipPadding = styles.chip_padding || "0 10px";
      const chipFontSize = Math.max(11, parseSizeToPixels(styles.chip_font_size, 11));
      const mapImageUrl = this._getMapImageUrl(state);
      const unavailable = isUnavailableState(state) || !mapImageUrl;
      this._syncRememberedModeSelections(state);
      this._sanitizeSelectedManualZoneIndex();
      const roomColor = styles.map.room_color || "rgba(97, 201, 122, 0.18)";
      const roomBorder = styles.map.room_border || "rgba(97, 201, 122, 0.55)";
      const zoneColor = styles.map.zone_color || "rgba(90, 167, 255, 0.18)";
      const zoneBorder = styles.map.zone_border || "rgba(90, 167, 255, 0.72)";
      const gotoColor = styles.map.goto_color || "#f6b73c";
      const isCleaningSessionActive = this._isCleaningSessionActive(state);
      const isRoomSelectionMode = currentMode.id === "rooms";
      const isRoomSelectionLocked = this._isRoomSelectionLocked(state);
      const roomModeCleaningZones = isRoomSelectionMode ? this._activeCleaningZones : [];
      const zoneModeCleaningZones = currentMode.id === "zone" ? this._activeCleaningZones : [];
      const showRoomSelectionDim = isRoomSelectionMode;
      const showRealRoomSelectionColors = isRoomSelectionMode && (highlightedRoomIds.size > 0 || roomModeCleaningZones.length > 0);
      const hasPendingZoneSelection = currentMode.id === "zone" && (
        this._selectedPredefinedZoneIds.length > 0 ||
        this._manualZones.length > 0
      );
      const primaryButtonIcon = hasPendingZoneSelection
        ? "mdi:check"
        : this._isCleaning(state)
          ? "mdi:pause"
          : "mdi:play";
      const primaryButtonTitle = hasPendingZoneSelection
        ? (isCleaningSessionActive
          ? (advanceVacuumStrings?.actions?.addZoneToClean || "Añadir zona a la limpieza")
          : (advanceVacuumStrings?.actions?.cleanZone || "Limpiar zona"))
        : (advanceVacuumStrings?.actions?.run || "Ejecutar");
      const modeDescriptors = this._getModeDescriptors(state);
      const dockControlDescriptors = this._getDockControlDescriptors(state);
      const dockSettingDescriptors = this._getDockSettingDescriptors(state);
      const activeModePanelPresetConfig = this._getActiveModePanelPresetConfig(state);
      const activeDockPanelSectionConfig = this._getDockPanelSectionConfig();
      const isRoutinesMode = currentMode.id === "routines";
      const showPrimaryActionButton = !isRoutinesMode;
      const showModeMenuButton = !isRoutinesMode && (modeDescriptors.length > 0 || currentMode.id !== "all");
      const showDockMenuButton = !isRoutinesMode && (dockControlDescriptors.length > 0 || dockSettingDescriptors.length > 0);
      const utilityPanelMarkup = isRoutinesMode
        ? ""
        : this._activeUtilityPanel === "modes"
          ? this._renderModePanel(state)
          : this._activeUtilityPanel === "dock"
            ? this._renderDockPanel(state)
            : "";
      const mapTransformStyle = `transform: translate(${this._mapOffset.x.toFixed(1)}px, ${this._mapOffset.y.toFixed(1)}px) scale(${this._mapScale.toFixed(3)});`;

      const selectedPredefinedZones = predefinedZones.filter(zone => this._selectedPredefinedZoneIds.includes(zone.id));
      const allZoneRects = [
      ...zoneModeCleaningZones.map(zone => ({ ...zone, predefined: false, active: true })),
      ...selectedPredefinedZones.flatMap(zone => zone.zones.map(item => ({
        x1: Number(item[0]),
        y1: Number(item[1]),
        x2: Number(item[2]),
        y2: Number(item[3]),
        predefined: true,
      }))),
      ...this._manualZones.map(zone => ({ ...zone, predefined: false })),
      ...(this._draftZone ? [{ ...this._draftZone, predefined: false, draft: true }] : []),
      ];

      this.shadowRoot.innerHTML = `
      <style>
        :host {
          --advance-vacuum-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --advance-vacuum-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          --advance-vacuum-card-panel-duration: ${animations.enabled ? animations.panelDuration : 0}ms;
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          overflow: hidden;
        }

        .advance-vacuum-card {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${accentColor} 12%, transparent) 0%, transparent 42%),
            linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.03) 100%),
            ${styles.card.background};
          border: 1px solid color-mix(in srgb, ${accentColor} 20%, var(--divider-color));
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow}, 0 18px 34px color-mix(in srgb, ${accentColor} 8%, rgba(0,0,0,0.14));
          color: var(--primary-text-color);
          display: grid;
          gap: ${styles.card.gap};
          overflow: hidden;
          padding: ${styles.card.padding};
          position: relative;
        }

        .advance-vacuum-card--entering {
          animation: advance-vacuum-card-enter var(--advance-vacuum-card-content-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .advance-vacuum-card--entering .advance-vacuum-card__map {
          animation: advance-vacuum-map-enter var(--advance-vacuum-card-content-duration) cubic-bezier(0.2, 0.85, 0.25, 1) 60ms both;
        }

        .advance-vacuum-card--entering .advance-vacuum-card__footer {
          animation: advance-vacuum-footer-enter var(--advance-vacuum-card-content-duration) cubic-bezier(0.22, 0.84, 0.26, 1) 100ms both;
        }

        .advance-vacuum-card__footer {
          align-items: center;
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
        }

        .advance-vacuum-card__header,
        .advance-vacuum-card__icon,
        .advance-vacuum-card__unavailable,
        .advance-vacuum-card__header-main,
        .advance-vacuum-card__title,
        .advance-vacuum-card__chips,
        .advance-vacuum-card__chip,
        .advance-vacuum-card__header-actions,
        .advance-vacuum-card__header-action {
          display: none !important;
        }

        .advance-vacuum-card__control,
        .advance-vacuum-card__mode-button,
        .advance-vacuum-card__goto-marker,
        .advance-vacuum-card__room-marker {
          appearance: none;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font: inherit;
          margin: 0;
          padding: 0;
        }

        .advance-vacuum-card__control {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.12);
          display: inline-flex;
          height: ${controlSize}px;
          justify-content: center;
          transition: transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1), box-shadow 180ms ease, border-color 180ms ease, background 180ms ease;
          width: ${controlSize}px;
        }

        .advance-vacuum-card__control:hover {
          transform: translateY(-1px);
        }

        .advance-vacuum-card__mode-button:hover {
          transform: translateY(-1px);
        }

        :is(
          .advance-vacuum-card__control,
          .advance-vacuum-card__mode-button,
          .advance-vacuum-card__map-tool,
          .advance-vacuum-card__room-marker,
          .advance-vacuum-card__goto-marker,
          .advance-vacuum-card__routine-button,
          .advance-vacuum-card__utility-option,
          .advance-vacuum-card__selection-chip,
          .advance-vacuum-card__zone-handle
        ).is-pressing:not(.is-disabled):not(:disabled) {
          animation: advance-vacuum-button-bounce var(--advance-vacuum-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .advance-vacuum-card__control ha-icon {
          --mdc-icon-size: ${Math.round(controlSize * 0.48)}px;
        }

        .advance-vacuum-card__control--active-motion ha-icon {
          animation: advance-vacuum-icon-sweep 1.45s ease-in-out infinite;
          transform-origin: 50% 70%;
        }

        .advance-vacuum-card__modes {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .advance-vacuum-card__modes-bubble {
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border-radius: 999px;
          display: inline-flex;
          flex-wrap: wrap;
          gap: 3px;
          justify-content: center;
          max-width: 100%;
          padding: 3px;
        }

        .advance-vacuum-card__mode-button {
          align-items: center;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 999px;
          box-shadow: none;
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: 12px;
          font-weight: 600;
          gap: 8px;
          min-height: 30px;
          padding: 0 11px;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 180ms ease, color 160ms ease, transform 180ms cubic-bezier(0.2, 0.9, 0.24, 1);
        }

        .advance-vacuum-card__mode-button:hover {
          background: color-mix(in srgb, ${accentColor} 12%, color-mix(in srgb, var(--primary-text-color) 6%, transparent));
          box-shadow: 0 6px 14px color-mix(in srgb, ${accentColor} 10%, transparent);
        }

        .advance-vacuum-card__mode-button.is-active {
          background: color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 7%, transparent));
          border-color: color-mix(in srgb, ${accentColor} 35%, transparent);
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          color: var(--primary-text-color);
          font-weight: 700;
        }

        .advance-vacuum-card__mode-button ha-icon {
          --mdc-icon-size: 15px;
        }

        .advance-vacuum-card__utility-panel {
          animation: advance-vacuum-utility-panel-in var(--advance-vacuum-card-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) forwards;
          display: grid;
          gap: 10px;
          justify-items: center;
          opacity: 0;
          transform: translateY(-6px);
          transform-origin: top center;
          width: 100%;
        }

        .advance-vacuum-card__utility-panel-slot {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .advance-vacuum-card__utility-group {
          display: grid;
          gap: 8px;
          justify-items: center;
          width: 100%;
        }

        .advance-vacuum-card__utility-label {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .advance-vacuum-card__utility-options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          width: 100%;
        }

        .advance-vacuum-card__utility-options--menu {
          max-width: 100%;
        }

        .advance-vacuum-card__utility-options--presets {
          justify-content: center;
        }

        .advance-vacuum-card__utility-option {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          gap: 8px;
          justify-content: center;
          margin: 0;
          min-height: 34px;
          padding: 0 12px;
        }

        .advance-vacuum-card__utility-option.is-active {
          background: color-mix(in srgb, var(--primary-color) 22%, color-mix(in srgb, ${accentColor} 18%, color-mix(in srgb, var(--primary-text-color) 8%, transparent)));
          border-color: color-mix(in srgb, var(--primary-color) 52%, color-mix(in srgb, ${accentColor} 36%, var(--primary-text-color)));
          color: var(--primary-text-color);
          font-weight: 700;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-color) 18%, transparent),
            0 0 0 2px color-mix(in srgb, var(--primary-color) 38%, transparent),
            0 10px 22px color-mix(in srgb, ${accentColor} 16%, rgba(0, 0, 0, 0.14));
        }

        .advance-vacuum-card__utility-option--menu ha-icon {
          --mdc-icon-size: 16px;
        }

        .advance-vacuum-card__utility-field {
          display: grid;
          gap: 8px;
          justify-items: center;
          max-width: 340px;
          width: min(100%, 340px);
        }

        .advance-vacuum-card__utility-select {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 16px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color: var(--primary-text-color);
          cursor: pointer;
          font: inherit;
          min-height: 42px;
          padding: 0 14px;
          text-align: center;
          width: 100%;
        }

        .advance-vacuum-card__utility-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          width: 100%;
        }

        .advance-vacuum-card__utility-chip-group {
          display: grid;
          gap: 6px;
          justify-items: center;
        }

        .advance-vacuum-card__map {
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent) 0%, color-mix(in srgb, var(--primary-text-color) 2%, transparent) 100%),
            color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: ${cardRadius}px;
          margin: -${mapTopBleed}px -${mapHorizontalBleed}px 0;
          overflow: hidden;
          position: relative;
        }

        .advance-vacuum-card__map-surface {
          aspect-ratio: ${this._mapImageWidth} / ${this._mapImageHeight};
          min-height: ${mapMinHeight}px;
          overflow: hidden;
          position: relative;
          touch-action: pan-y;
          user-select: none;
        }

        .advance-vacuum-card__map-viewport {
          inset: 0;
          overflow: hidden;
          position: absolute;
        }

        .advance-vacuum-card__map-canvas {
          height: 100%;
          inset: 0;
          position: absolute;
          transform-origin: top left;
          width: 100%;
        }

        .advance-vacuum-card__map-image {
          display: block;
          height: 100%;
          inset: 0;
          object-fit: cover;
          opacity: 1;
          position: absolute;
          transition: opacity 220ms ease-out;
          will-change: opacity;
          width: 100%;
        }

        .advance-vacuum-card__map-image.is-pending,
        .advance-vacuum-card__map-image.is-fading-out {
          opacity: 0;
        }

        .advance-vacuum-card__map-room-dim,
        .advance-vacuum-card__room-highlight-layer,
        .advance-vacuum-card__map-svg,
        .advance-vacuum-card__map-markers,
        .advance-vacuum-card__map-overlays {
          inset: 0;
          position: absolute;
        }

        .advance-vacuum-card__map-room-dim {
          background: rgba(8, 12, 20, 0.5);
          pointer-events: none;
          z-index: 1;
        }

        .advance-vacuum-card__room-highlight-layer {
          pointer-events: none;
          z-index: 2;
        }

        .advance-vacuum-card__room-highlight-image {
          display: block;
          height: 100%;
          inset: 0;
          object-fit: cover;
          pointer-events: none;
          position: absolute;
          width: 100%;
        }

        .advance-vacuum-card__map-svg {
          height: 100%;
          pointer-events: none;
          width: 100%;
          z-index: 3;
        }

        .advance-vacuum-card__map-markers {
          pointer-events: none;
        }

        .advance-vacuum-card__map-overlays {
          pointer-events: none;
          z-index: 4;
        }

        .advance-vacuum-card__room-polygon {
          cursor: pointer;
          fill: rgba(255, 255, 255, 0.01);
          pointer-events: all;
          stroke: rgba(255,255,255,0.16);
          stroke-dasharray: 10 10;
          stroke-width: 10;
          touch-action: manipulation;
          transition: fill 160ms ease, stroke 160ms ease;
        }

        .advance-vacuum-card__room-polygon.is-selected {
          fill: ${roomColor};
          stroke: ${roomBorder};
        }

        .advance-vacuum-card__room-polygon.is-revealed {
          fill: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          stroke: rgba(255, 255, 255, 0.42);
        }

        .advance-vacuum-card__room-polygon.is-readonly {
          cursor: default;
          pointer-events: none;
        }

        .advance-vacuum-card__zone-rect {
          fill: ${zoneColor};
          stroke: ${zoneBorder};
          stroke-dasharray: 16 12;
          stroke-linecap: round;
          stroke-width: 10;
        }

        .advance-vacuum-card__zone-rect.is-draft {
          opacity: 0.72;
        }

        .advance-vacuum-card__zone-rect--room-overlay {
          fill: ${roomColor};
          stroke: ${roomBorder};
        }

        .advance-vacuum-card__goto-line {
          stroke: color-mix(in srgb, ${gotoColor} 72%, rgba(255,255,255,0.8));
          stroke-dasharray: 10 10;
          stroke-width: 8;
        }

        .advance-vacuum-card__zone-hitbox,
        .advance-vacuum-card__zone-handle,
        .advance-vacuum-card__map-tool {
          appearance: none;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font: inherit;
          margin: 0;
          padding: 0;
        }

        .advance-vacuum-card__zone-hitbox {
          background: rgba(255,255,255,0.01);
          border: 2px dashed transparent;
          border-radius: 16px;
          pointer-events: auto;
          position: absolute;
          touch-action: none;
          z-index: 2;
        }

        .advance-vacuum-card__zone-hitbox.is-selected {
          border-color: color-mix(in srgb, ${accentColor} 46%, rgba(255,255,255,0.18));
        }

        .advance-vacuum-card__zone-handle {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 16%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 22px rgba(0, 0, 0, 0.12);
          color: var(--primary-text-color);
          display: inline-flex;
          height: 34px;
          justify-content: center;
          pointer-events: auto;
          position: absolute;
          touch-action: none;
          transform: translate(-50%, -50%);
          width: 34px;
          z-index: 3;
        }

        .advance-vacuum-card__zone-handle[data-zone-handle-action="move"] {
          border-color: color-mix(in srgb, ${accentColor} 40%, color-mix(in srgb, var(--primary-text-color) 14%, transparent));
          color: color-mix(in srgb, ${accentColor} 75%, var(--primary-text-color));
        }

        .advance-vacuum-card__zone-handle[data-zone-handle-action="delete"] {
          border-color: rgba(255, 130, 130, 0.32);
          color: #ffb3b3;
        }

        .advance-vacuum-card__zone-handle ha-icon,
        .advance-vacuum-card__map-tool ha-icon {
          --mdc-icon-size: 16px;
        }

        .advance-vacuum-card__map-tools {
          align-items: flex-start;
          display: flex;
          gap: 8px;
          justify-content: space-between;
          left: 12px;
          pointer-events: none;
          position: absolute;
          right: 12px;
          top: 12px;
          z-index: 4;
        }

        .advance-vacuum-card__map-tools-group {
          display: flex;
          gap: 8px;
        }

        .advance-vacuum-card__map-tools-group--center {
          left: 50%;
          pointer-events: none;
          position: absolute;
          top: 0;
          transform: translateX(-50%);
        }

        .advance-vacuum-card__map-tools-group--right {
          justify-content: flex-end;
        }

        .advance-vacuum-card__map-tool--back {
          padding: 0;
          width: 44px;
        }

        .advance-vacuum-card__map-tool--status {
          padding: 0;
          pointer-events: none;
          width: 44px;
        }

        .advance-vacuum-card__map-tool--status-charging {
          color: #f6b73c;
        }

        .advance-vacuum-card__map-tool--status-wash {
          color: ${styles.icon.washing_color || "#5aa7ff"};
        }

        .advance-vacuum-card__map-tool--status-dry {
          color: ${styles.icon.drying_color || "#f1c24c"};
        }

        .advance-vacuum-card__map-tool--status-empty {
          color: ${styles.icon.emptying_color || "#9b6b4a"};
        }

        .advance-vacuum-card__map-tool {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.12);
          color: var(--primary-text-color);
          display: inline-flex;
          gap: 6px;
          justify-content: center;
          min-height: 44px;
          min-width: 44px;
          padding: 0 14px;
          pointer-events: auto;
        }

        .advance-vacuum-card__map-tool--add {
          background: color-mix(in srgb, ${accentColor} 16%, color-mix(in srgb, var(--primary-text-color) 6%, transparent));
          border-color: color-mix(in srgb, ${accentColor} 36%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          font-size: 12px;
          font-weight: 700;
        }

        .advance-vacuum-card__map-tool-label {
          line-height: 1;
        }

        .advance-vacuum-card__map-tool.is-disabled {
          opacity: 0.45;
        }

        .advance-vacuum-card__room-marker,
        .advance-vacuum-card__goto-marker {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.12);
          color: var(--primary-text-color);
          display: inline-flex;
          gap: var(--room-marker-gap, 8px);
          justify-content: center;
          left: 0;
          min-height: var(--marker-size, 34px);
          min-width: var(--marker-size, 34px);
          padding: var(--room-marker-padding, 0 12px);
          pointer-events: auto;
          position: absolute;
          top: 0;
          touch-action: manipulation;
          transform: translate(-50%, -50%);
          white-space: nowrap;
          z-index: 2;
        }

        .advance-vacuum-card__room-marker.is-icon-only {
          border-radius: 999px;
          padding: 0;
          width: var(--marker-size, 34px);
        }

        .advance-vacuum-card__room-marker.is-readonly,
        .advance-vacuum-card__room-chip.is-readonly {
          cursor: default;
          opacity: 0.96;
        }

        .advance-vacuum-card__room-marker.is-selected,
        .advance-vacuum-card__goto-marker.is-selected {
          background: color-mix(in srgb, ${accentColor} 16%, color-mix(in srgb, var(--primary-text-color) 6%, transparent));
          border-color: color-mix(in srgb, ${accentColor} 42%, color-mix(in srgb, var(--primary-text-color) 14%, transparent));
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, ${accentColor} 22%, transparent),
            0 14px 28px color-mix(in srgb, ${accentColor} 14%, rgba(0, 0, 0, 0.12));
        }

        .advance-vacuum-card__room-marker ha-icon,
        .advance-vacuum-card__goto-marker ha-icon {
          --mdc-icon-size: var(--room-icon-size, 16px);
        }

        .advance-vacuum-card__room-marker span {
          font-size: var(--room-label-size, ${Math.max(11, parseSizeToPixels(styles.map.label_size, 12))}px);
          font-weight: 600;
        }

        .advance-vacuum-card__goto-marker {
          height: 38px;
          width: 38px;
        }

        .advance-vacuum-card__room-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          width: 100%;
        }

        .advance-vacuum-card__room-chip {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          gap: 8px;
          min-height: 36px;
          padding: 0 14px;
          touch-action: manipulation;
        }

        .advance-vacuum-card__room-chip.is-selected {
          background: color-mix(in srgb, ${accentColor} 16%, color-mix(in srgb, var(--primary-text-color) 6%, transparent));
          border-color: color-mix(in srgb, ${accentColor} 42%, color-mix(in srgb, var(--primary-text-color) 14%, transparent));
          color: var(--primary-text-color);
        }

        .advance-vacuum-card__room-chip ha-icon {
          --mdc-icon-size: 16px;
        }

        .advance-vacuum-card__room-chip span {
          font-size: 12px;
          font-weight: 600;
        }

        .advance-vacuum-card__controls {
          align-items: center;
          display: grid;
          gap: 10px;
          justify-items: center;
          width: 100%;
        }

        .advance-vacuum-card__controls-row {
          align-items: center;
          column-gap: 10px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          width: 100%;
        }

        .advance-vacuum-card__controls-main,
        .advance-vacuum-card__controls-side {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .advance-vacuum-card__controls-main {
          align-items: center;
          grid-column: 2;
          justify-content: center;
        }

        .advance-vacuum-card__controls-side {
          align-items: center;
          grid-column: 3;
          justify-content: flex-start;
        }

        .advance-vacuum-card__control.is-primary {
          background: color-mix(in srgb, ${accentColor} 18%, color-mix(in srgb, var(--primary-text-color) 6%, transparent));
          border-color: color-mix(in srgb, ${accentColor} 48%, color-mix(in srgb, var(--primary-text-color) 14%, transparent));
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, ${accentColor} 28%, transparent),
            0 12px 28px color-mix(in srgb, ${accentColor} 16%, rgba(0, 0, 0, 0.12));
          color: ${styles.control.accent_color};
          height: ${Math.round(controlSize * 1.16)}px;
          width: ${Math.round(controlSize * 1.16)}px;
        }

        .advance-vacuum-card__selection-chip {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: 12px;
          font-weight: 600;
          gap: 8px;
          min-height: 34px;
          padding: 0 12px;
        }

        .advance-vacuum-card__selection-chip strong {
          color: var(--primary-text-color);
        }

        .advance-vacuum-card__routines {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          width: 100%;
        }

        .advance-vacuum-card__routine-button {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 18px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 12px 26px rgba(0, 0, 0, 0.1);
          color: var(--primary-text-color);
          cursor: pointer;
          display: grid;
          gap: 10px;
          justify-items: center;
          min-height: 118px;
          padding: 16px 14px;
          text-align: center;
          transition: transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1), box-shadow 180ms ease, border-color 180ms ease;
          width: 100%;
        }

        .advance-vacuum-card__routine-button:hover {
          transform: translateY(-1px);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 16px 30px rgba(0, 0, 0, 0.14);
        }

        .advance-vacuum-card__routine-button.is-disabled {
          cursor: default;
          opacity: 0.5;
        }

        .advance-vacuum-card__routine-icon {
          align-items: center;
          background: color-mix(in srgb, ${accentColor} 14%, color-mix(in srgb, var(--primary-text-color) 6%, transparent));
          border: 1px solid color-mix(in srgb, ${accentColor} 32%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, ${accentColor} 22%, transparent);
          display: inline-flex;
          height: 46px;
          justify-content: center;
          width: 46px;
        }

        .advance-vacuum-card__routine-icon ha-icon {
          --mdc-icon-size: 22px;
        }

        .advance-vacuum-card__routine-label {
          font-size: 12px;
          font-weight: 700;
          line-height: 1.35;
          text-wrap: balance;
        }

        @keyframes advance-vacuum-utility-panel-in {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes advance-vacuum-card-enter {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.992);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes advance-vacuum-map-enter {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.988);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes advance-vacuum-footer-enter {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes advance-vacuum-button-bounce {
          0% { transform: scale(1); }
          38% { transform: scale(0.935); }
          72% { transform: scale(1.035); }
          100% { transform: scale(1); }
        }

        @keyframes advance-vacuum-icon-sweep {
          0%, 100% { transform: translateX(-3px) rotate(-10deg); }
          50% { transform: translateX(4px) rotate(12deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .advance-vacuum-card,
          .advance-vacuum-card *,
          .advance-vacuum-card__control--active-motion ha-icon {
            animation: none !important;
            transition: none !important;
          }
        }
      </style>
      <ha-card class="advance-vacuum-card ${shouldAnimateEntrance ? "advance-vacuum-card--entering" : ""}">
        <div class="advance-vacuum-card__map">
          <div class="advance-vacuum-card__map-surface" data-map-surface="main">
            <div class="advance-vacuum-card__map-viewport">
              <div class="advance-vacuum-card__map-canvas" style="${mapTransformStyle}">
                ${
                  mapImageUrl
                    ? `<img class="advance-vacuum-card__map-image" data-map-image src="${escapeHtml(mapImageUrl)}" alt="Mapa del robot" />`
                    : `<div class="advance-vacuum-card__map-image" style="display:flex;align-items:center;justify-content:center;color:var(--secondary-text-color);">Mapa no disponible</div>`
                }
                ${showRoomSelectionDim ? `<div class="advance-vacuum-card__map-room-dim"></div>` : ""}
                ${showRealRoomSelectionColors ? this._renderRoomSelectionHighlights(rooms, highlightedRoomIds, mapImageUrl, currentMode.id) : ""}
                ${showRealRoomSelectionColors ? this._renderZoneSelectionHighlights(roomModeCleaningZones, mapImageUrl, currentMode.id) : ""}
                <svg class="advance-vacuum-card__map-svg" viewBox="0 0 ${this._mapImageWidth} ${this._mapImageHeight}" preserveAspectRatio="none">
                  ${currentMode.id === "rooms" ? rooms.map(room => room.outlines.map(outline => `
                    <polygon
                      class="advance-vacuum-card__room-polygon ${highlightedRoomIds.has(String(room.id)) ? (showRealRoomSelectionColors ? "is-revealed" : "is-selected") : ""} ${isRoomSelectionLocked ? "is-readonly" : ""}"
                      data-room-id="${escapeHtml(room.id)}"
                      points="${escapeHtml(this._vacuumOutlineToSvgPoints(outline))}"
                    ></polygon>
                  `).join("")).join("") : ""}

                  ${currentMode.id === "rooms" ? roomModeCleaningZones.map(zone => {
                    const rect = this._zoneToSvgRect(zone);
                    return `
                      <rect
                        class="advance-vacuum-card__zone-rect advance-vacuum-card__zone-rect--room-overlay"
                        x="${rect.x.toFixed(1)}"
                        y="${rect.y.toFixed(1)}"
                        width="${rect.width.toFixed(1)}"
                        height="${rect.height.toFixed(1)}"
                        rx="18"
                        ry="18"
                      ></rect>
                    `;
                  }).join("") : ""}

                  ${currentMode.id === "zone" ? allZoneRects.map(zone => {
                    const rect = this._zoneToSvgRect(zone);
                    return `
                      <rect
                        class="advance-vacuum-card__zone-rect ${zone.draft ? "is-draft" : ""}"
                        x="${rect.x.toFixed(1)}"
                        y="${rect.y.toFixed(1)}"
                        width="${rect.width.toFixed(1)}"
                        height="${rect.height.toFixed(1)}"
                        rx="18"
                        ry="18"
                      ></rect>
                    `;
                  }).join("") : ""}

                  ${
                    currentMode.id === "goto" && this._gotoPoint
                      ? (() => {
                          const mapped = this._converter.vacuumToMap(this._gotoPoint.x, this._gotoPoint.y);
                          return `
                            <circle cx="${mapped.x.toFixed(1)}" cy="${mapped.y.toFixed(1)}" r="22" fill="color-mix(in srgb, ${gotoColor} 22%, rgba(255,255,255,0.08))"></circle>
                            <circle cx="${mapped.x.toFixed(1)}" cy="${mapped.y.toFixed(1)}" r="10" fill="${gotoColor}" stroke="rgba(255,255,255,0.94)" stroke-width="5"></circle>
                          `;
                        })()
                      : ""
                  }
                </svg>
              </div>
            </div>
            <div class="advance-vacuum-card__map-overlays">
              ${this._renderManualZoneEditors()}
              ${currentMode.id === "rooms" ? this._renderRoomMarkers(rooms) : ""}
              ${currentMode.id === "goto" ? this._renderGotoMarkers(gotoPoints) : ""}
              ${
                currentMode.id === "zone" ? predefinedZones.map(zone => {
                  const position = zone.position || centroid(zone.zones.map(item => ({ x: Number(item[0]), y: Number(item[1]) })));
                  const percent = this._vacuumToViewportPercent(position);
                  const selected = this._selectedPredefinedZoneIds.includes(zone.id);
                  return `
                    <button
                      class="advance-vacuum-card__room-marker ${selected ? "is-selected" : ""}"
                      style="left:${percent.left}%; top:${percent.top}%;"
                      data-zone-id="${escapeHtml(zone.id)}"
                      title="${escapeHtml(zone.label || zone.id)}"
                    >
                      <ha-icon icon="${escapeHtml(zone.icon || "mdi:vector-rectangle")}"></ha-icon>
                      <span>${escapeHtml(zone.label || zone.id)}</span>
                    </button>
                  `;
                }).join("") : ""
              }
            </div>
            ${this._renderMapTools()}
          </div>
        </div>

        ${this._renderRoomFallbackList(rooms, currentMode.id)}

        <div class="advance-vacuum-card__footer">

        ${
          !isCleaningSessionActive
            ? `
              <div class="advance-vacuum-card__modes">
                <div class="advance-vacuum-card__modes-bubble" role="tablist" aria-label="${escapeHtml(advanceVacuumStrings?.aria?.modeTablist || "Modo de limpieza")}">
                ${modes.map(mode => `
                  <button type="button" class="advance-vacuum-card__mode-button ${mode.id === currentMode.id ? "is-active" : ""}" data-mode-id="${escapeHtml(mode.id)}" role="tab" aria-selected="${mode.id === currentMode.id ? "true" : "false"}">
                    ${["all", "rooms", "zone", "routines"].includes(mode.id) ? "" : `<ha-icon icon="${escapeHtml(mode.icon)}"></ha-icon>`}
                    <span>${escapeHtml(mode.label)}</span>
                  </button>
                `).join("")}
                </div>
              </div>
            `
            : ""
        }

        ${this._renderRoutinesPanel(state)}

        <div class="advance-vacuum-card__controls">
          <div class="advance-vacuum-card__controls-row">
            <div class="advance-vacuum-card__controls-main">
              ${
                showModeMenuButton
                  ? `
                    <button class="advance-vacuum-card__control ${this._activeUtilityPanel === "modes" ? "is-primary" : ""}" data-control-action="toggle_modes" title="${escapeHtml((activeModePanelPresetConfig?.id ? advanceVacuumStrings?.panelModes?.[activeModePanelPresetConfig.id] : "") || advanceVacuumStrings?.utility?.modesFallbackTitle || "Modos de aspirado y fregado")}">
                      <ha-icon icon="${escapeHtml(activeModePanelPresetConfig?.icon || "mdi:tune-variant")}"></ha-icon>
                    </button>
                  `
                  : ""
              }
              ${
                showPrimaryActionButton
                  ? `
                    <button class="advance-vacuum-card__control is-primary" data-control-action="primary" title="${escapeHtml(primaryButtonTitle)}">
                      <ha-icon icon="${primaryButtonIcon}"></ha-icon>
                    </button>
                  `
                  : ""
              }
              ${
                showDockMenuButton
                  ? `
                    <button class="advance-vacuum-card__control ${this._activeUtilityPanel === "dock" ? "is-primary" : ""}" data-control-action="toggle_dock_panel" title="${escapeHtml((activeDockPanelSectionConfig?.id ? advanceVacuumStrings?.dockSections?.[activeDockPanelSectionConfig.id] : "") || advanceVacuumStrings?.utility?.chargingStation || "Base de carga")}">
                      <ha-icon icon="${escapeHtml(activeDockPanelSectionConfig?.icon || "mdi:home-import-outline")}"></ha-icon>
                    </button>
                `
                  : ""
              }
            </div>
          </div>
        </div>

        ${
          utilityPanelMarkup
            ? `<div class="advance-vacuum-card__utility-panel-slot">${utilityPanelMarkup}</div>`
            : ""
        }
        </div>
      </ha-card>
    `;

      let image = this.shadowRoot.querySelector("[data-map-image]");
      const imageSrc = image?.getAttribute("src") || "";
      const canvas = this.shadowRoot.querySelector(".advance-vacuum-card__map-canvas");
      if (previousImage && image && previousImageSrc && previousImageSrc === imageSrc) {
        image.replaceWith(previousImage);
        image = previousImage;
        image.classList.remove("is-pending", "is-fading-out");
        image.classList.add("is-loaded");
      } else if (previousImage && image && previousImageSrc && imageSrc && canvas) {
        previousImage.removeEventListener("load", this._onMapImageLoad);
        previousImage.removeAttribute("data-map-image");
        previousImage.setAttribute("data-map-image-previous", "true");
        previousImage.classList.remove("is-pending", "is-fading-out");
        previousImage.classList.add("is-loaded");
        image.classList.add("is-pending");
        canvas.insertBefore(previousImage, image);
      } else if (image) {
        image.classList.remove("is-pending", "is-fading-out");
        image.classList.add("is-loaded");
      }

      if (image) {
        image.removeEventListener("load", this._onMapImageLoad);
        image.addEventListener("load", this._onMapImageLoad);
        if (image.complete && Number(image.naturalWidth || 0) > 0) {
          this._onMapImageLoad({ currentTarget: image });
        }
      }

      const backButton = this.shadowRoot.querySelector("[data-map-back='true']");
      if (backButton) {
        backButton.removeEventListener("click", this._onMapBackClick);
        backButton.addEventListener("click", this._onMapBackClick);
      }

      if (shouldAnimateEntrance) {
        this._scheduleEntranceAnimationReset(animations.contentDuration + 160);
      }

      this._lastRenderSignature = this._getRenderSignature();
    } catch (error) {
      this._handleCardError(error, "_render");
    }
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaAdvanceVacuumCard);
}

class NodaliaAdvanceVacuumCardEditor extends HTMLElement {
  static get properties() {
    return {
      hass: {},
      _config: {},
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig({});
    this._entityOptionsSignature = "";
    this._pendingEditorControlTags = new Set();
    this._showStyleSection = false;
    this._onInputChange = this._onInputChange.bind(this);
    this._onValueChanged = this._onValueChanged.bind(this);
    this._onEditorClick = this._onEditorClick.bind(this);
    this.shadowRoot.addEventListener("value-changed", this._onValueChanged);
    this.shadowRoot.addEventListener("click", this._onEditorClick);
  }

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    this._render();
    this._restoreFocusState(focusState);
  }

  set hass(hass) {
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender =
      !this._hass ||
      nextSignature !== this._entityOptionsSignature ||
      !this.shadowRoot?.innerHTML;

    this._hass = hass;
    this._entityOptionsSignature = nextSignature;

    if (!shouldRender) {
      return;
    }

    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorStatesSignature(hass, this._config?.language);
  }

  _captureFocusState() {
    const activeElement = this.shadowRoot?.activeElement;

    if (
      !(
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement
      )
    ) {
      return null;
    }

    const dataset = activeElement.dataset || {};
    const selector = dataset.field
      ? `[data-field="${String(dataset.field).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`
      : null;

    if (!selector) {
      return null;
    }

    const supportsSelection =
      typeof activeElement.selectionStart === "number" &&
      typeof activeElement.selectionEnd === "number";

    return {
      selector,
      selectionEnd: supportsSelection ? activeElement.selectionEnd : null,
      selectionStart: supportsSelection ? activeElement.selectionStart : null,
      type: activeElement.type,
    };
  }

  _restoreFocusState(focusState) {
    if (!focusState?.selector || !this.shadowRoot) {
      return;
    }

    const target = this.shadowRoot.querySelector(focusState.selector);
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
    ) {
      return;
    }

    try {
      target.focus({ preventScroll: true });
    } catch (_error) {
      target.focus();
    }

    const canRestoreSelection =
      focusState.type !== "checkbox" &&
      typeof focusState.selectionStart === "number" &&
      typeof focusState.selectionEnd === "number" &&
      typeof target.setSelectionRange === "function";

    if (!canRestoreSelection) {
      return;
    }

    try {
      target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
    } catch (_error) {
      // Ignore unsupported inputs.
    }
  }

  _notifyConfigChange(nextConfig) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(nextConfig);
    this._render();
    this._restoreFocusState(focusState);
    fireEvent(this, "config-changed", {
      config: compactConfig(window.NodaliaUtils.stripEqualToDefaults(deepClone(this._config), DEFAULT_CONFIG) ?? {}),
    });
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

        if (!this._hass || !this.shadowRoot) {
          return;
        }

        const focusState = this._captureFocusState();
        this._render();
        this._restoreFocusState(focusState);
      })
      .catch(() => {
        this._pendingEditorControlTags.delete(tagName);
      });
  }

  _ensureEditorControlsReady() {
    this._watchEditorControlTag("ha-selector");
    this._watchEditorControlTag("ha-entity-picker");
    this._watchEditorControlTag("ha-icon-picker");
  }

  _onValueChanged(event) {
    const control = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.field);

    if (!control?.dataset?.field) {
      return;
    }

    event.stopPropagation();

    const nextValue = typeof event.detail?.value === "string"
      ? event.detail.value
      : control.value;
    const nextConfig = deepClone(this._config);

    if (nextValue === "" || nextValue === null || nextValue === undefined) {
      deleteByPath(nextConfig, control.dataset.field);
    } else {
      setByPath(nextConfig, control.dataset.field, nextValue);
    }

    this._notifyConfigChange(nextConfig);
  }

  _onEditorClick(event) {
    const toggleButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorToggle);

    if (!toggleButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (toggleButton.dataset.editorToggle === "styles") {
      this._showStyleSection = !this._showStyleSection;
      this._render();
    }
  }

  _onInputChange(event) {
    const target = event.currentTarget;
    const field = target.dataset.field;
    const valueType = target.dataset.valueType || "string";
    const checked = target.type === "checkbox" ? target.checked : undefined;

    // Keep typing stable in Home Assistant's editor by only committing
    // free-text fields on change/blur, not on every keystroke.
    if (
      event.type === "input" &&
      target.type !== "checkbox" &&
      target.tagName !== "SELECT"
    ) {
      return;
    }

    const nextConfig = deepClone(this._config);
    let nextValue = target.value;

    if (target.type === "checkbox") {
      nextValue = checked;
    } else if (valueType === "number") {
      nextValue = target.value === "" ? "" : Number(target.value);
    } else if (valueType === "csv") {
      const values = String(target.value || "")
        .split(",")
        .map(item => item.trim().toLowerCase())
        .filter(Boolean);
      nextValue = values.length ? values : "";
    } else if (valueType === "json") {
      if (target.value.trim() === "") {
        nextValue = "";
      } else {
        try {
          nextValue = JSON.parse(target.value);
        } catch (_error) {
          return;
        }
      }
    }

    if (nextValue === "" || nextValue === null || nextValue === undefined) {
      deleteByPath(nextConfig, field);
    } else {
      setByPath(nextConfig, field, nextValue);
    }

    this._notifyConfigChange(nextConfig);
  }

  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    const hass = this._hass ?? this.hass;
    return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", s);
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const hintRaw = options.hint ? String(options.hint) : "";
    const hintHtml = hintRaw
      ? `<span class="editor-field__hint">${escapeHtml(this._editorLabel(hintRaw))}</span>`
      : "";
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          type="${escapeHtml(options.type || "text")}"
          value="${escapeHtml(value ?? "")}"
          placeholder="${escapeHtml(options.placeholder || "")}"
        />
        ${hintHtml}
      </label>
    `;
  }

  _renderTextareaField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <textarea
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          rows="${escapeHtml(String(options.rows || 6))}"
          placeholder="${escapeHtml(options.placeholder || "")}"
        >${escapeHtml(value ?? "")}</textarea>
      </label>
    `;
  }

  _renderEntityPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder || "";
    const domains = arrayFromMaybe(options.domains).map(domain => String(domain).trim()).filter(Boolean);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-field="${escapeHtml(field)}"
          data-domains="${escapeHtml(domains.join(","))}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(placeholder)}"
        ></div>
      </div>
    `;
  }

  _getEntityOptions(field = "entity", domains = []) {
    const normalizedDomains = domains.map(domain => String(domain).trim()).filter(Boolean);
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => !normalizedDomains.length || normalizedDomains.some(domain => entityId.startsWith(`${domain}.`)))
      .map(([entityId, state]) => {
        const friendlyName = String(state?.attributes?.friendly_name || "").trim();
        return {
          value: entityId,
          label: friendlyName || entityId,
          displayLabel: friendlyName && friendlyName !== entityId
            ? `${friendlyName} (${entityId})`
            : entityId,
        };
      })
      .sort((left, right) => (
        left.label.localeCompare(right.label, "es", { sensitivity: "base" })
        || left.value.localeCompare(right.value, "es", { sensitivity: "base" })
      ));

    const currentValue = String(getByPath(this._config, field) || "").trim();
    if (currentValue && !options.some(option => option.value === currentValue)) {
      options.unshift({
        value: currentValue,
        label: currentValue,
        displayLabel: currentValue,
      });
    }

    return options;
  }

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    const domains = String(host.dataset.domains || "")
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      if (domains.length) {
        control.includeDomains = domains;
        control.entityFilter = stateObj =>
          domains.some(domain => String(stateObj?.entity_id || "").startsWith(`${domain}.`));
      }
      control.allowCustomEntity = true;
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      const entitySelector =
        domains.length === 1
          ? { domain: domains[0] }
          : domains.length > 1
            ? { domain: domains }
            : {};
      control.selector = { entity: entitySelector };
      if (placeholder) {
        control.setAttribute("label", placeholder);
      }
    } else {
      control = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder || this._editorLabel("ed.vacuum.select_entity");
      control.appendChild(emptyOption);
      this._getEntityOptions(field, domains).forEach(option => {
        const optionElement = document.createElement("option");
        optionElement.value = option.value;
        optionElement.textContent = option.displayLabel;
        control.appendChild(optionElement);
      });
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;
    if ("hass" in control) {
      control.hass = this._hass;
    }

    if ("value" in control) {
      control.value = nextValue;
    }

    if (control instanceof HTMLSelectElement) {
      control.addEventListener("change", this._onInputChange);
    }

    host.replaceChildren(control);
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <ha-icon-picker
          class="editor-control-host"
          data-field="${escapeHtml(field)}"
          value="${escapeHtml(value || "")}"
          placeholder="${escapeHtml(options.placeholder || "mdi:robot-vacuum")}"
        ></ha-icon-picker>
      </div>
    `;
  }

  _renderSelectField(label, field, value, items, options = {}) {
    const tLabel = typeof label === "string" ? this._editorLabel(label) : label;
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${items.map(item => {
            const optLabel = item.labelKey ? this._editorLabel(item.labelKey) : item.label;
            return `
            <option value="${escapeHtml(item.value)}" ${String(value ?? "") === String(item.value) ? "selected" : ""}>
              ${escapeHtml(optLabel)}
            </option>
          `;
          }).join("")}
        </select>
      </label>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-toggle">
        <input data-field="${escapeHtml(field)}" type="checkbox" ${checked ? "checked" : ""} />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(tLabel)}</span>
      </label>
    `;
  }

  _getEntityOptionsMarkup() {
    const states = this._hass?.states || {};
    const allEntities = Object.keys(states).sort();
    const vacuumEntities = allEntities.filter(entityId => entityId.startsWith("vacuum."));
    const mapEntities = allEntities.filter(entityId => entityId.startsWith("camera.") || entityId.startsWith("image."));
    const helperEntities = allEntities.filter(entityId => entityId.startsWith("sensor.") || entityId.startsWith("image.") || entityId.startsWith("camera."));
    const selectEntities = allEntities.filter(entityId => entityId.startsWith("select."));
    const inputTextEntities = allEntities.filter(entityId => entityId.startsWith("input_text."));

    return `
      <datalist id="advance-vacuum-card-vacuum-entities">
        ${vacuumEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
      <datalist id="advance-vacuum-card-map-entities">
        ${mapEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
      <datalist id="advance-vacuum-card-helper-entities">
        ${helperEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
      <datalist id="advance-vacuum-card-select-entities">
        ${selectEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
      <datalist id="advance-vacuum-card-input-text-entities">
        ${inputTextEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";
    const animations = config.animations || DEFAULT_CONFIG.animations;
    this._ensureEditorControlsReady();

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
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 18px;
          display: grid;
          gap: 14px;
          padding: 16px;
        }

        .editor-section__header {
          display: grid;
          gap: 4px;
        }

        .editor-section__title {
          font-size: 15px;
          font-weight: 700;
        }

        .editor-section__hint {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
        }

        .editor-section__actions {
          display: flex;
          justify-content: flex-end;
        }

        .editor-section__toggle-button {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          gap: 6px;
          min-height: 30px;
          padding: 0 10px;
        }

        .editor-section__toggle-button ha-icon {
          --mdc-icon-size: 15px;
        }

        .editor-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .editor-field,
        .editor-toggle {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .editor-field--full {
          grid-column: 1 / -1;
        }


        .editor-field:has(> .editor-control-host[data-mounted-control="entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="entity-picker"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="vacuum-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="select-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="sensor-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="light-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="fan-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="humidifier-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="icon-picker"]),
        .editor-field:has(> ha-icon-picker) {
          grid-column: 1 / -1;
        }

        .editor-field > span,
        .editor-toggle > span {
          font-size: 12px;
          font-weight: 600;
        }

        .editor-field__hint {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 500;
          line-height: 1.45;
        }

        .editor-field input,
        .editor-field select,
        .editor-field textarea {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 40px;
          padding: 10px 12px;
          width: 100%;
        }

        .editor-field ha-icon-picker,
        .editor-field ha-selector,
        .editor-field ha-entity-picker,
        .editor-control-host {
          display: block;
          min-height: 40px;
          width: 100%;
        }

        .editor-field textarea {
          min-height: 120px;
          resize: vertical;
        }

        .editor-toggle {
          align-items: center;
          grid-template-columns: auto 1fr;
          padding-top: 20px;
        }

        .editor-toggle input {
          accent-color: var(--primary-color);
          height: 18px;
          margin: 0;
          width: 18px;
        }

        @media (max-width: 640px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }

          .editor-toggle {
            padding-top: 0;
          }
        }
      
        :is(.editor-toggle, .editor-checkbox) {
          align-items: center;
          column-gap: 10px;
          cursor: pointer;
          grid-auto-flow: row;
          grid-template-columns: auto minmax(0, 1fr);
          justify-content: stretch;
          min-height: 40px;
          padding-top: 0;
          position: relative;
        }

        :is(.editor-toggle, .editor-checkbox) input {
          block-size: 1px;
          inline-size: 1px;
          margin: 0;
          opacity: 0;
          pointer-events: none;
          position: absolute;
        }

        .editor-toggle__switch {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          display: inline-flex;
          font-size: 0;
          height: 22px;
          line-height: 0;
          position: relative;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
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

        .editor-toggle__label {
          min-width: 0;
        }

        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }

        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch::before {
          transform: translateX(18px);
        }

        :is(.editor-toggle, .editor-checkbox) input:focus-visible + .editor-toggle__switch {
          box-shadow:
            0 0 0 3px color-mix(in srgb, var(--primary-text-color) 14%, transparent),
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }
</style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.entity.general_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.advance_vacuum.general_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField("ed.advance_vacuum.card_language", "language", config.language ?? "auto", [
              { value: "auto", labelKey: "ed.advance_vacuum.lang_auto_ha_profile" },
              { value: "es", label: "Español" },
              { value: "en", label: "English" },
              { value: "de", label: "Deutsch" },
              { value: "fr", label: "Français" },
              { value: "it", label: "Italiano" },
              { value: "nl", label: "Nederlands" },
            ], { fullWidth: true })}
            ${this._renderEntityPickerField("ed.vacuum.robot_entity", "entity", config.entity, { domains: ["vacuum"] })}
            ${this._renderTextField("ed.entity.name", "name", config.name, { placeholder: "Roborock Qrevo S" })}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, { placeholder: "mdi:robot-vacuum" })}
            ${this._renderEntityPickerField("ed.advance_vacuum.map_source_entity", "map_source.camera", config.map_source?.camera, { domains: ["camera", "image"] })}
            ${this._renderSelectField("ed.advance_vacuum.platform", "vacuum_platform", config.vacuum_platform || "Roborock", [
              { value: "Roborock", label: "Roborock" },
              { value: "send_command", label: "Send command" },
            ])}
            ${this._renderEntityPickerField("ed.advance_vacuum.calibration_entity", "calibration_source.entity", config.calibration_source?.entity, { domains: ["camera", "image", "sensor"] })}
            <div class="editor-field editor-field--full">
              <span>${escapeHtml(this._editorLabel("ed.advance_vacuum.shared_session_helper_label"))}</span>
              <div
                class="editor-control-host"
                data-mounted-control="entity"
                data-field="shared_cleaning_session_entity"
                data-domains="input_text"
                data-value="${escapeHtml(String(config.shared_cleaning_session_entity ?? ""))}"
                data-placeholder="${escapeHtml("input_text.roborock_session")}"
              ></div>
              <span class="editor-field__hint">${escapeHtml(
                this._editorLabel(
                  "ed.advance_vacuum.shared_session_helper_hint",
                ),
              )}</span>
            </div>
            ${this._renderTextField("ed.advance_vacuum.shared_session_webhook", "shared_cleaning_session_webhook", config.shared_cleaning_session_webhook || "", {
              fullWidth: true,
              placeholder: "nodalia_advance_vacuum_session",
              hint: "ed.advance_vacuum.shared_session_webhook_hint",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.advance_vacuum.map_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.advance_vacuum.map_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.advance_vacuum.calibration_from_camera", "calibration_source.camera", config.calibration_source?.camera !== false)}
            ${this._renderCheckboxField("ed.advance_vacuum.map_locked", "map_locked", config.map_locked !== false)}
            ${this._renderCheckboxField("ed.advance_vacuum.show_room_labels", "show_room_labels", config.show_room_labels !== false)}
            ${this._renderCheckboxField("ed.advance_vacuum.show_room_markers", "show_room_markers", config.show_room_markers !== false)}
            ${this._renderCheckboxField("ed.advance_vacuum.segment_mode", "allow_segment_mode", config.allow_segment_mode !== false)}
            ${this._renderCheckboxField("ed.advance_vacuum.zone_mode", "allow_zone_mode", config.allow_zone_mode !== false)}
            ${this._renderCheckboxField("ed.advance_vacuum.goto_mode", "allow_goto_mode", config.allow_goto_mode !== false)}
            ${this._renderTextField("ed.advance_vacuum.max_zones", "max_zone_selections", config.max_zone_selections, { type: "number", valueType: "number", placeholder: "5" })}
            ${this._renderTextField("ed.advance_vacuum.max_repeats", "max_repeats", config.max_repeats, { type: "number", valueType: "number", placeholder: "3" })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.advance_vacuum.advanced_controls_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.advance_vacuum.advanced_controls_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.advance_vacuum.show_all_mode", "show_all_mode", config.show_all_mode !== false)}
            ${this._renderEntityPickerField("ed.vacuum.suction_select", "suction_select_entity", config.suction_select_entity, { domains: ["select"] })}
            ${this._renderEntityPickerField("ed.vacuum.mop_select", "mop_select_entity", config.mop_select_entity, { domains: ["select"] })}
            ${this._renderEntityPickerField("ed.advance_vacuum.mop_mode_select", "mop_mode_select_entity", config.mop_mode_select_entity, { domains: ["select"] })}
            ${this._renderTextField("ed.advance_vacuum.custom_menu_label", "custom_menu.label", config.custom_menu?.label, {
              placeholder: "Base",
            })}
            ${this._renderIconPickerField("ed.advance_vacuum.custom_menu_icon", "custom_menu.icon", config.custom_menu?.icon, {
              placeholder: "mdi:home-import-outline",
            })}
            ${this._renderTextareaField("ed.advance_vacuum.custom_menu_items_json", "custom_menu.items", JSON.stringify(config.custom_menu?.items || [], null, 2), {
              fullWidth: true,
              rows: 10,
              valueType: "json",
              placeholder: '[\n  {\n    "label": "Vaciar deposito",\n    "icon": "mdi:delete-empty",\n    "visible_when": "docked",\n    "tap_action": {\n      "action": "perform-action",\n      "perform_action": "vacuum.send_command",\n      "service_data": {\n        "entity_id": "vacuum.roborock_qrevo_s",\n        "command": "app_start_emptying"\n      }\n    }\n  },\n  {\n    "label": "Volver a base",\n    "icon": "mdi:home-import-outline",\n    "visible_when": "active",\n    "builtin_action": "return_to_base"\n  }\n]',
            })}
            ${this._renderTextareaField("ed.advance_vacuum.routines_json", "routines", JSON.stringify(config.routines || [], null, 2), {
              fullWidth: true,
              rows: 12,
              valueType: "json",
              placeholder: '[\n  {\n    "entity": "button.roborock_qrevo_s_barrido_intensivo",\n    "label": "Barrido intensivo",\n    "icon": "mdi:weather-windy"\n  },\n  {\n    "entity": "button.roborock_qrevo_s_fregar_tras_aspirar",\n    "label": "Fregar tras aspirar",\n    "icon": "mdi:water"\n  },\n  {\n    "entity": "script.limpieza_rapida_cocina",\n    "label": "Cocina rapida",\n    "icon": "mdi:script-text-play"\n  }\n]',
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.visibility_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.advance_vacuum.visibility_always_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.vacuum.show_state_chip", "show_state_chip", config.show_state_chip !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_battery_chip", "show_battery_chip", config.show_battery_chip !== false)}
            ${this._renderCheckboxField("ed.advance_vacuum.show_header_icons", "show_header_icons", config.show_header_icons !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_return_base", "show_return_to_base", config.show_return_to_base !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_stop", "show_stop", config.show_stop !== false)}
            ${this._renderCheckboxField("ed.vacuum.show_locate", "show_locate", config.show_locate !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.entity.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.haptics_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.vacuum.enable_haptics", "haptics.enabled", config.haptics?.enabled === true)}
            ${this._renderCheckboxField("ed.vacuum.fallback_vibrate", "haptics.fallback_vibrate", config.haptics?.fallback_vibrate === true)}
            ${this._renderSelectField("ed.entity.haptic_style", "haptics.style", hapticStyle, [
              { value: "selection", label: "Selection" },
              { value: "light", label: "Light" },
              { value: "medium", label: "Medium" },
              { value: "heavy", label: "Heavy" },
              { value: "success", label: "Success" },
              { value: "warning", label: "Warning" },
              { value: "failure", label: "Failure" },
            ])}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.advance_vacuum.security_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.advance_vacuum.security_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField(
              "ed.entity.security_strict",
              "security.strict_service_actions",
              config.security?.strict_service_actions !== false,
            )}
            ${
              config.security?.strict_service_actions !== false
                ? this._renderTextField(
                    "ed.entity.allowed_services_csv",
                    "security.allowed_services",
                    Array.isArray(config.security?.allowed_services) ? config.security.allowed_services.join(", ") : "",
                    {
                      placeholder: "vacuum.send_command, script.run",
                      valueType: "csv",
                      fullWidth: true,
                    },
                  )
                : ""
            }
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.advance_vacuum.animations_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.advance_vacuum.animations_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.vacuum.enable_animations", "animations.enabled", animations.enabled !== false)}
            ${this._renderCheckboxField("ed.vacuum.icon_animation_active", "animations.icon_animation", animations.icon_animation !== false)}
            ${this._renderTextField("ed.advance_vacuum.content_duration_ms", "animations.content_duration", animations.content_duration, {
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("ed.vacuum.panel_duration_ms", "animations.panel_duration", animations.panel_duration, {
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("ed.vacuum.button_bounce_ms", "animations.button_bounce_duration", animations.button_bounce_duration, {
              type: "number",
              valueType: "number",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.advance_vacuum.style_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.advance_vacuum.style_section_hint_map"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._editorLabel(this._showStyleSection ? "ed.weather.hide_style_settings" : "ed.weather.show_style_settings"))}</span>
              </button>
            </div>
          </div>
          ${this._showStyleSection ? `
            <div class="editor-grid">
              ${this._renderTextField("ed.entity.style_card_bg", "styles.card.background", config.styles?.card?.background)}
              ${this._renderTextField("ed.entity.style_card_border", "styles.card.border", config.styles?.card?.border)}
              ${this._renderTextField("ed.entity.style_card_radius", "styles.card.border_radius", config.styles?.card?.border_radius)}
              ${this._renderTextField("ed.entity.style_card_shadow", "styles.card.box_shadow", config.styles?.card?.box_shadow)}
              ${this._renderTextField("ed.entity.style_card_padding", "styles.card.padding", config.styles?.card?.padding)}
              ${this._renderTextField("ed.entity.style_card_gap", "styles.card.gap", config.styles?.card?.gap)}
              ${this._renderTextField("ed.vacuum.style_main_bubble_size", "styles.icon.size", config.styles?.icon?.size)}
              ${this._renderTextField("ed.vacuum.style_chip_height", "styles.chip_height", config.styles?.chip_height)}
              ${this._renderTextField("ed.vacuum.style_chip_font", "styles.chip_font_size", config.styles?.chip_font_size)}
              ${this._renderTextField("ed.vacuum.style_title_size", "styles.title_size", config.styles?.title_size)}
              ${this._renderTextField("ed.vacuum.style_button_size", "styles.control.size", config.styles?.control?.size)}
              ${this._renderTextField("ed.advance_vacuum.map_radius", "styles.map.radius", config.styles?.map?.radius)}
              ${this._renderTextField("ed.advance_vacuum.map_marker_size", "styles.map.marker_size", config.styles?.map?.marker_size)}
              ${this._renderTextField("ed.advance_vacuum.map_label_size", "styles.map.label_size", config.styles?.map?.label_size)}
            </div>
          ` : ""}
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot.querySelectorAll("input, select, textarea").forEach(input => {
      input.addEventListener("change", this._onInputChange);
      if (
        (input.tagName === "INPUT" && input.type !== "checkbox") ||
        input.tagName === "TEXTAREA"
      ) {
        input.addEventListener("input", this._onInputChange);
      }
    });

    this.shadowRoot.querySelectorAll('[data-mounted-control="entity"]').forEach(host => this._mountEntityPicker(host));

    this.shadowRoot.querySelectorAll("ha-icon-picker").forEach(control => {
      control.hass = this._hass;
    });

    this.shadowRoot.querySelectorAll('input[data-field="entity"]').forEach(input => input.setAttribute("list", "advance-vacuum-card-vacuum-entities"));
    this.shadowRoot.querySelectorAll('input[data-field="map_source.camera"]').forEach(input => input.setAttribute("list", "advance-vacuum-card-map-entities"));
    this.shadowRoot.querySelectorAll('input[data-field="calibration_source.entity"]').forEach(input => input.setAttribute("list", "advance-vacuum-card-helper-entities"));
    this.shadowRoot.querySelectorAll('input[data-field="shared_cleaning_session_entity"]').forEach(input => input.setAttribute("list", "advance-vacuum-card-input-text-entities"));
    this.shadowRoot.querySelectorAll('input[data-field="suction_select_entity"], input[data-field="mop_select_entity"], input[data-field="mop_mode_select_entity"]').forEach(input => input.setAttribute("list", "advance-vacuum-card-select-entities"));
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaAdvanceVacuumCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Advance Vacuum Card",
  description: "Advanced map card for vacuum robots in Nodalia style with room, zone, and point selection.",
  preview: true,
});
