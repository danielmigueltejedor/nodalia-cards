const CARD_TAG = "nodalia-entity-card";
const EDITOR_TAG = "nodalia-entity-card-editor";
const CARD_VERSION = "1.3.0";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
const COMPACT_LAYOUT_THRESHOLD = 150;
const OPTIMISTIC_TOGGLE_TIMEOUT = 3200;
const COVER_SET_POSITION = 4;
const LOCK_LOCK = 2;

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  icon_active: "",
  icon_inactive: "",
  use_entity_icon: false,
  entity_picture: "",
  show_entity_picture: false,
  number_decimals: 2,
  tap_action: "auto",
  tap_service: "",
  tap_service_data: "",
  tap_service_target: "",
  tap_url: "",
  navigation_path: "",
  tap_new_tab: false,
  icon_tap_action: "",
  icon_tap_service: "",
  icon_tap_service_data: "",
  icon_tap_service_target: "",
  icon_tap_url: "",
  icon_navigation_path: "",
  icon_tap_new_tab: false,
  hold_action: "more-info",
  hold_service: "",
  hold_service_data: "",
  hold_service_target: "",
  hold_url: "",
  hold_navigation_path: "",
  hold_new_tab: false,
  icon_hold_action: "",
  icon_hold_service: "",
  icon_hold_service_data: "",
  icon_hold_service_target: "",
  icon_hold_url: "",
  icon_hold_navigation_path: "",
  icon_hold_new_tab: false,
  double_tap_action: "none",
  icon_double_tap_action: "",
  double_tap_service: "",
  double_tap_service_data: "",
  double_tap_service_target: "",
  double_tap_url: "",
  double_tap_navigation_path: "",
  double_tap_new_tab: false,
  icon_double_tap_service: "",
  icon_double_tap_service_data: "",
  icon_double_tap_service_target: "",
  icon_double_tap_url: "",
  icon_double_tap_navigation_path: "",
  icon_double_tap_new_tab: false,
  show_state: true,
  state_chip_on_title_row: false,
  state_position: "below",
  primary_attribute: "",
  secondary_attribute: "",
  show_primary_chip: true,
  show_secondary_chip: true,
  compact_layout_mode: "auto",
  quick_actions: [],
  language: "auto",
  security: {
    strict_service_actions: false,
    allowed_services: [],
    allowed_service_domains: ["homeassistant"],
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
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "28px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "14px",
      gap: "12px",
    },
    icon: {
      size: "38px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      on_color: "var(--info-color, #71c0ff)",
      off_color: "var(--primary-text-color)",
    },
    control: {
      size: "40px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(113, 192, 255, 0.18)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    title_size: "12px",
  },
};

const STUB_CONFIG = {
  entity: "switch.lampara",
  name: "Lampara",
  number_decimals: 2,
  tap_action: "auto",
  show_state: true,
  state_chip_on_title_row: false,
  state_position: "below",
  quick_actions: [
    {
      icon: "mdi:power",
      type: "toggle",
      label: "Toggle",
    },
    {
      icon: "mdi:cog",
      type: "more-info",
      label: "Detalles",
    },
  ],
};

/** Older defaults / editor-saved YAML used `--state-inactive-color`, which stays merged over new defaults. */
const LEGACY_ICON_OFF_COLOR_VALUES = [
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
];

function migrateLegacyIconOffColor(iconStyles, canonicalOffColor) {
  if (!iconStyles) {
    return;
  }
  const raw = String(iconStyles.off_color ?? "").trim();
  if (!raw) {
    return;
  }
  if (LEGACY_ICON_OFF_COLOR_VALUES.includes(raw)) {
    iconStyles.off_color = canonicalOffColor;
    return;
  }
  if (/^var\(\s*--state-inactive-color/i.test(raw)) {
    iconStyles.off_color = canonicalOffColor;
  }
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
    return value
      .map(item => compactConfig(item))
      .filter(item => item !== undefined);
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


function isUnsafeConfigPathKey(key) {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

function setByPath(target, path, value) {
  const parts = path.split(".");
  if (parts.some(isUnsafeConfigPathKey)) {
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

function deleteByPath(target, path) {
  const parts = path.split(".");
  if (parts.some(isUnsafeConfigPathKey)) {
    return;
  }
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
  const parts = String(path || "").split(".");
  let cursor = target;

  for (const key of parts) {
    if (!key) {
      return undefined;
    }

    if (!isObject(cursor) && !Array.isArray(cursor)) {
      return undefined;
    }

    cursor = cursor[key];
  }

  return cursor;
}

function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseNumericValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const rawValue = String(value ?? "").trim();
  if (!rawValue || !/^-?\d+(?:[.,]\d+)?$/.test(rawValue)) {
    return null;
  }

  const numericValue = Number(rawValue.replace(",", "."));
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatNumericValue(value, maximumFractionDigits = 2) {
  const numericValue = parseNumericValue(value);
  if (!Number.isFinite(numericValue)) {
    return String(value ?? "");
  }

  const safeDigits = clamp(Math.round(Number(maximumFractionDigits)), 0, 6);
  return numericValue
    .toFixed(safeDigits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

function formatNumericValueWithUnit(value, unit = "", maximumFractionDigits = 2) {
  const formattedValue = formatNumericValue(value, maximumFractionDigits);
  const normalizedUnit = String(unit || "").trim();

  if (!normalizedUnit) {
    return formattedValue;
  }

  return `${formattedValue}${normalizedUnit.startsWith("°") ? "" : " "}${normalizedUnit}`;
}

function getValueSignature(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    return `a:${value.length}|${value.map(item => String(item ?? "")).join(",")}`;
  }

  if (isObject(value)) {
    const keys = Object.keys(value).sort();
    return `o:${keys.length}|${keys.map(key => `${key}=${String(value[key] ?? "")}`).join(",")}`;
  }

  return String(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeSelectorValue(value) {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
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

function getEditorColorModel(value, fallbackValue = "#71c0ff") {
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

function getEditorColorFallbackValue(field) {
  const normalizedField = String(field ?? "");

  if (normalizedField.endsWith("off_color")) {
    return "var(--primary-text-color)";
  }

  if (normalizedField.endsWith("accent_background")) {
    return "rgba(113, 192, 255, 0.18)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
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

function normalizeTextKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function shouldDarkenEntityBubbleIconGlyph(state, accentColor) {
  return Boolean(window.NodaliaBubbleContrast?.shouldDarkenBubbleIconGlyph(state, accentColor));
}

function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

function getEntityDomain(state) {
  const entityId = String(state?.entity_id || "");
  return entityId.includes(".") ? entityId.split(".")[0] : "";
}

function isSelectDomainEntity(state) {
  const domain = getEntityDomain(state);
  return domain === "select" || domain === "input_select";
}

function getSelectEntityOptions(state) {
  if (!state?.attributes) {
    return [];
  }
  const options = state.attributes.options;
  if (!Array.isArray(options)) {
    return [];
  }
  return options.map(item => String(item ?? "").trim()).filter(Boolean);
}

function getSelectEntityCurrentValue(state) {
  return String(state?.state ?? "").trim();
}

function humanizeSelectOptionLabel(raw) {
  return String(raw ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, match => match.toUpperCase())
    .trim();
}

function entitySupportedFeatures(state) {
  return Number(state?.attributes?.supported_features) || 0;
}

function entitySupportsFeature(state, flag) {
  return (entitySupportedFeatures(state) & flag) !== 0;
}

function coverEntityIsOpen(state) {
  const stateKey = normalizeTextKey(state?.state);
  if (["open", "opening"].includes(stateKey)) {
    return true;
  }
  if (["closed", "closing"].includes(stateKey)) {
    return false;
  }
  const position = parseNumericValue(state?.attributes?.current_position);
  return position !== null && position > 0;
}

function getDynamicEntityIcon(state) {
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
      case "garage_door":
        return stateKey === "on" ? "mdi:garage-open" : "mdi:garage";
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
      case "moisture":
        return stateKey === "on" ? "mdi:water-alert" : "mdi:water-check";
      case "gas":
        return stateKey === "on" ? "mdi:gas-cylinder" : "mdi:check-circle-outline";
      case "tamper":
      case "safety":
      case "problem":
        return stateKey === "on" ? "mdi:alert-circle" : "mdi:check-circle-outline";
      case "plug":
      case "power":
        return stateKey === "on" ? "mdi:power-plug" : "mdi:power-plug-off";
      case "sound":
        return stateKey === "on" ? "mdi:volume-high" : "mdi:volume-mute";
      case "vibration":
        return stateKey === "on" ? "mdi:vibrate" : "mdi:vibrate-off";
      case "heat":
        return stateKey === "on" ? "mdi:fire" : "mdi:fire-off";
      case "cold":
        return stateKey === "on" ? "mdi:snowflake-alert" : "mdi:snowflake";
      case "light":
        return stateKey === "on" ? "mdi:brightness-7" : "mdi:brightness-5";
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

  if (domain === "select" || domain === "input_select") {
    return "mdi:format-list-bulleted";
  }

  if (domain === "lock") {
    switch (stateKey) {
      case "unlocked":
      case "open":
        return "mdi:lock-open-variant";
      case "jammed":
        return "mdi:lock-alert";
      case "locking":
      case "unlocking":
        return "mdi:lock-clock";
      default:
        return "mdi:lock";
    }
  }

  if (domain === "cover") {
    if (deviceClass === "garage") {
      return stateKey === "open" ? "mdi:garage-open" : "mdi:garage";
    }

    if (deviceClass === "door") {
      return stateKey === "open" ? "mdi:door-open" : "mdi:door-closed";
    }

    if (deviceClass === "window") {
      return stateKey === "open" ? "mdi:window-open-variant" : "mdi:window-closed-variant";
    }
  }

  if (domain === "person") {
    switch (stateKey) {
      case "home":
      case "casa":
      case "en_casa":
        return "mdi:home-account";
      case "not_home":
      case "away":
      case "fuera":
        return "mdi:account-arrow-right";
      default:
        return "mdi:account";
    }
  }

  return "";
}

function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const normalizedStatePosition = String(config.state_position || "").toLowerCase();
  if (normalizedStatePosition === "right" || normalizedStatePosition === "below") {
    config.state_position = normalizedStatePosition;
  } else {
    config.state_position = config.state_chip_on_title_row === true ? "right" : "below";
  }

  config.quick_actions = Array.isArray(config.quick_actions)
    ? config.quick_actions
      .filter(action => isObject(action))
      .map(action => ({
        icon: action.icon || "mdi:flash",
        type: action.type || "toggle",
        label: action.label || "",
        entity: action.entity || "",
        service: action.service || "",
        service_data: action.service_data || "",
      }))
    : [];

  migrateLegacyIconOffColor(config.styles?.icon, DEFAULT_CONFIG.styles.icon.off_color);

  const applyTap = window.NodaliaUtils?.applyCardTapActionField?.bind(window.NodaliaUtils);
  if (typeof applyTap === "function") {
    applyTap(config, {
      actionKey: "tap_action",
      serviceKey: "tap_service",
      serviceDataKey: "tap_service_data",
      serviceTargetKey: "tap_service_target",
      urlKey: "tap_url",
      navigationKey: "navigation_path",
      newTabKey: "tap_new_tab",
    }, rawConfig?.tap_action ?? config.tap_action, "auto");
    applyTap(config, {
      actionKey: "hold_action",
      serviceKey: "hold_service",
      serviceDataKey: "hold_service_data",
      serviceTargetKey: "hold_service_target",
      urlKey: "hold_url",
      navigationKey: "hold_navigation_path",
      newTabKey: "hold_new_tab",
    }, rawConfig?.hold_action ?? config.hold_action, "none");
    applyTap(config, {
      actionKey: "icon_tap_action",
      serviceKey: "icon_tap_service",
      serviceDataKey: "icon_tap_service_data",
      serviceTargetKey: "icon_tap_service_target",
      urlKey: "icon_tap_url",
      navigationKey: "icon_navigation_path",
      newTabKey: "icon_tap_new_tab",
    }, rawConfig?.icon_tap_action ?? config.icon_tap_action, "");
    applyTap(config, {
      actionKey: "icon_hold_action",
      serviceKey: "icon_hold_service",
      serviceDataKey: "icon_hold_service_data",
      serviceTargetKey: "icon_hold_service_target",
      urlKey: "icon_hold_url",
      navigationKey: "icon_hold_navigation_path",
      newTabKey: "icon_hold_new_tab",
    }, rawConfig?.icon_hold_action ?? config.icon_hold_action, "");
    applyTap(config, {
      actionKey: "double_tap_action",
      serviceKey: "double_tap_service",
      serviceDataKey: "double_tap_service_data",
      serviceTargetKey: "double_tap_service_target",
      urlKey: "double_tap_url",
      navigationKey: "double_tap_navigation_path",
      newTabKey: "double_tap_new_tab",
    }, rawConfig?.double_tap_action ?? config.double_tap_action, "none");
    applyTap(config, {
      actionKey: "icon_double_tap_action",
      serviceKey: "icon_double_tap_service",
      serviceDataKey: "icon_double_tap_service_data",
      serviceTargetKey: "icon_double_tap_service_target",
      urlKey: "icon_double_tap_url",
      navigationKey: "icon_double_tap_navigation_path",
      newTabKey: "icon_double_tap_new_tab",
    }, rawConfig?.icon_double_tap_action ?? config.icon_double_tap_action, "");
  }
  if (String(config.icon_tap_action || "").trim() === "") {
    config.icon_tap_action = "";
  }
  if (String(config.icon_hold_action || "").trim() === "") {
    config.icon_hold_action = "";
  }
  if (String(config.icon_double_tap_action || "").trim() === "") {
    config.icon_double_tap_action = "";
  }
  config.tap_service = String(config.tap_service ?? "").trim();
  config.tap_service_data = String(config.tap_service_data ?? "").trim();
  config.tap_service_target = String(config.tap_service_target ?? "").trim();
  config.tap_url = String(config.tap_url ?? "").trim();
  config.navigation_path = String(config.navigation_path ?? "").trim();
  config.tap_new_tab = config.tap_new_tab === true;
  config.icon_tap_service = String(config.icon_tap_service ?? "").trim();
  config.icon_tap_service_data = String(config.icon_tap_service_data ?? "").trim();
  config.icon_tap_service_target = String(config.icon_tap_service_target ?? "").trim();
  config.icon_tap_url = String(config.icon_tap_url ?? "").trim();
  config.icon_navigation_path = String(config.icon_navigation_path ?? "").trim();
  config.icon_tap_new_tab = config.icon_tap_new_tab === true;
  config.hold_service = String(config.hold_service ?? "").trim();
  config.hold_service_data = String(config.hold_service_data ?? "").trim();
  config.hold_service_target = String(config.hold_service_target ?? "").trim();
  config.hold_url = String(config.hold_url ?? "").trim();
  config.hold_navigation_path = String(config.hold_navigation_path ?? "").trim();
  config.hold_new_tab = config.hold_new_tab === true;
  config.icon_hold_service = String(config.icon_hold_service ?? "").trim();
  config.icon_hold_service_data = String(config.icon_hold_service_data ?? "").trim();
  config.icon_hold_service_target = String(config.icon_hold_service_target ?? "").trim();
  config.icon_hold_url = String(config.icon_hold_url ?? "").trim();
  config.icon_hold_navigation_path = String(config.icon_hold_navigation_path ?? "").trim();
  config.icon_hold_new_tab = config.icon_hold_new_tab === true;
  if (config.tap_action === "navigate" && !config.navigation_path && config.tap_url) {
    config.navigation_path = config.tap_url;
  }
  if (config.hold_action === "navigate" && !config.hold_navigation_path && config.hold_url) {
    config.hold_navigation_path = config.hold_url;
  }
  config.language = String(config.language ?? "auto").trim() || "auto";
  config.double_tap_service = String(config.double_tap_service ?? "").trim();
  config.double_tap_service_data = String(config.double_tap_service_data ?? "").trim();
  config.double_tap_service_target = String(config.double_tap_service_target ?? "").trim();
  config.double_tap_url = String(config.double_tap_url ?? "").trim();
  config.double_tap_navigation_path = String(config.double_tap_navigation_path ?? "").trim();
  config.double_tap_new_tab = config.double_tap_new_tab === true;
  config.icon_double_tap_service = String(config.icon_double_tap_service ?? "").trim();
  config.icon_double_tap_service_data = String(config.icon_double_tap_service_data ?? "").trim();
  config.icon_double_tap_service_target = String(config.icon_double_tap_service_target ?? "").trim();
  config.icon_double_tap_url = String(config.icon_double_tap_url ?? "").trim();
  config.icon_double_tap_navigation_path = String(config.icon_double_tap_navigation_path ?? "").trim();
  config.icon_double_tap_new_tab = config.icon_double_tap_new_tab === true;
  if (config.double_tap_action === "navigate" && !config.double_tap_navigation_path && config.double_tap_url) {
    config.double_tap_navigation_path = config.double_tap_url;
  }
  config.entity_picture = String(config.entity_picture ?? "").trim();
  config.show_entity_picture = config.show_entity_picture === true;
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? { ...DEFAULT_CONFIG.security, ...(isObject(config.security) ? config.security : {}) };

  return config;
}

class NodaliaEntityCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, []);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._optimisticToggle = null;
    this._optimisticToggleTimer = 0;
    this._cardWidth = 0;
    this._isCompactLayout = false;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._suppressNextEntityTap = false;
    this._selectPickerOpen = false;
    this._selectPickerAnimating = false;
    this._selectPickerCloseTimer = 0;
    this._selectPickerEnterTimer = 0;
    this._resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextWidth = Math.round(entry.contentRect?.width || this.clientWidth || 0);
      const nextCompact = this._shouldUseCompactLayout(nextWidth);

      if (nextWidth === this._cardWidth && nextCompact === this._isCompactLayout) {
        return;
      }

      this._cardWidth = nextWidth;
      this._isCompactLayout = nextCompact;

      const signature = this._getRenderSignature();
      if (signature === this._lastRenderSignature) {
        return;
      }

      this._lastRenderSignature = signature;
      this._render();
    });
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowPointerDown = this._onShadowPointerDown.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown);
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const path = event.composedPath();
              const actionTarget = path.find(
                node => node instanceof HTMLElement && node.dataset?.entityAction,
              );
              const action = actionTarget?.dataset?.entityAction;
              return action === "body" || action === "icon" ? action : null;
            },
            shouldBeginHold: zone => {
              const state = this._getState();
              return Boolean(state && this._canRunHoldAction(state, zone));
            },
            onHold: zone => {
              const state = this._getState();
              if (!state) {
                return;
              }
              this._triggerPressAnimation(this.shadowRoot.querySelector(".entity-card__content"));
              this._triggerPressAnimation(this.shadowRoot.querySelector(".entity-card__icon"));
              this._performHoldAction(state, zone);
            },
            markHoldConsumedClick: () => {
              this._suppressNextEntityTap = true;
              window.NodaliaUtils?.cancelCardZoneTap?.(this);
            },
          })
        : () => {};
  }

  connectedCallback() {
    this._resizeObserver?.observe(this);
    this._scheduleOptimisticToggleTimeout();
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    this._detachHostHold?.();
    this._resizeObserver?.disconnect();
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    this._animateContentOnNextRender = true;
    this._selectPickerOpen = false;
    this._selectPickerAnimating = false;
    this._clearSelectPickerAnimationTimer("_selectPickerCloseTimer");
    this._clearSelectPickerAnimationTimer("_selectPickerEnterTimer");
    this.classList.remove("entity-card-host--select-open");
    this._lastRenderSignature = "";
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._clearOptimisticToggleTimer();
  }

  setConfig(config) {
    const previousEntity = this._config?.entity || "";
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    if (previousEntity && previousEntity !== this._config.entity) {
      this._clearOptimisticToggleState();
    }
    this._isCompactLayout = this._shouldUseCompactLayout(
      Math.round(this._cardWidth || this.clientWidth || 0),
    );
    this._lastRenderSignature = "";
    this._selectPickerOpen = false;
    this._clearSelectPickerAnimationTimer("_selectPickerCloseTimer");
    this._clearSelectPickerAnimationTimer("_selectPickerEnterTimer");
    this._animateContentOnNextRender = true;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    let nextSignature = this._getRenderSignature();
    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature && !this._optimisticToggle) {
      return;
    }

    this._syncOptimisticToggleState(this._getActualState());
    nextSignature = this._getRenderSignature();

    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }

    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 2,
      min_columns: 2,
    };
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const actualState = entityId ? hass?.states?.[entityId] || null : null;
    const state = hass === this._hass ? this._buildOptimisticToggleState(actualState) : actualState;
    const attrs = state?.attributes || {};
    const configuredStateAttribute = String(this._config?.state_attribute || "").trim();
    const configuredPrimaryAttribute = String(this._config?.primary_attribute || "").trim();
    const configuredSecondaryAttribute = String(this._config?.secondary_attribute || "").trim();
    return [
      `l:${window.NodaliaI18n.resolveLanguage(hass, this._config?.language)}`,
      `e:${entityId}`,
      `s:${String(state?.state || "")}`,
      `o:${String(attrs._nodalia_optimistic_toggle || "")}`,
      `lu:${String(state?.last_updated || state?.last_changed || "")}`,
      `sa:${configuredStateAttribute}`,
      `sv:${configuredStateAttribute ? String(attrs[configuredStateAttribute] ?? "") : ""}`,
      `pa:${configuredPrimaryAttribute}`,
      `pv:${configuredPrimaryAttribute ? getValueSignature(attrs[configuredPrimaryAttribute]) : ""}`,
      `xa:${configuredSecondaryAttribute}`,
      `xv:${configuredSecondaryAttribute ? getValueSignature(attrs[configuredSecondaryAttribute]) : ""}`,
      `uei:${this._config?.use_entity_icon ? 1 : 0}`,
      `sep:${this._config?.show_entity_picture ? 1 : 0}`,
      `ep:${String(this._config?.entity_picture || attrs.entity_picture_local || attrs.entity_picture || "")}`,
      `ci:${String(this._config?.icon || "")}`,
      `ia:${String(this._config?.icon_active || "")}`,
      `ii:${String(this._config?.icon_inactive || "")}`,
      `c:${this._isCompactLayout ? 1 : 0}`,
      `qa:${Array.isArray(this._config?.quick_actions) ? this._config.quick_actions.length : 0}`,
      `tap:${String(this._config?.tap_action || "")}`,
      `itap:${String(this._config?.icon_tap_action ?? "")}`,
      `ts:${String(this._config?.tap_service || "")}`,
      `its:${String(this._config?.icon_tap_service || "")}`,
      `tu:${String(this._config?.tap_url || "")}`,
      `itu:${String(this._config?.icon_tap_url || "")}`,
      `hold:${String(this._config?.hold_action || "")}`,
      `ihold:${String(this._config?.icon_hold_action ?? "")}`,
      `hs:${String(this._config?.hold_service || "")}`,
      `ihs:${String(this._config?.icon_hold_service || "")}`,
      `hu:${String(this._config?.hold_url || "")}`,
      `ihu:${String(this._config?.icon_hold_url || "")}`,
      `sn:${this._config?.show_name !== false ? 1 : 0}`,
      `ss:${this._config?.show_state !== false ? 1 : 0}`,
      `nm:${String(this._config?.name || "")}`,
      `sp:${this._selectPickerOpen ? 1 : 0}`,
      `sel:${isSelectDomainEntity(state) ? getSelectEntityOptions(state).join("\u001f") : ""}`,
    ].join("|");
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) ? numericColumns : null;
  }

  _getConfiguredGridRows() {
    const numericRows = Number(this._config?.grid_options?.rows);
    return Number.isFinite(numericRows) ? numericRows : null;
  }

  _shouldUseCompactLayout(width) {
    const mode = this._config?.compact_layout_mode || "auto";

    if (mode === "always") {
      return true;
    }

    if (mode === "never") {
      return false;
    }

    const configuredColumns = this._getConfiguredGridColumns();
    if (configuredColumns !== null) {
      return configuredColumns < 4;
    }

    return width > 0 && width <= COMPACT_LAYOUT_THRESHOLD;
  }

  _getState() {
    return this._buildOptimisticToggleState(this._getActualState());
  }

  _getActualState(hass = this._hass) {
    return this._config?.entity ? hass?.states?.[this._config.entity] || null : null;
  }

  _createStateSnapshot(state) {
    if (!state) {
      return null;
    }
    return {
      ...state,
      attributes: { ...(state.attributes || {}) },
    };
  }

  _clearOptimisticToggleTimer() {
    if (this._optimisticToggleTimer) {
      window.clearTimeout(this._optimisticToggleTimer);
      this._optimisticToggleTimer = 0;
    }
  }

  _clearOptimisticToggleState() {
    this._clearOptimisticToggleTimer();
    this._optimisticToggle = null;
  }

  _isOptimisticTogglePending(actualState = this._getActualState()) {
    const entityId = this._config?.entity || "";
    if (!entityId || !this._optimisticToggle || this._optimisticToggle.entityId !== entityId) {
      this._optimisticToggle = null;
      return false;
    }

    const actualKey = normalizeTextKey(actualState?.state);
    const expectedKey = normalizeTextKey(this._optimisticToggle.expectedState);
    if (!actualState || !this._isBinaryOnOff(actualState) || actualKey === expectedKey) {
      this._optimisticToggle = null;
      return false;
    }

    if (Date.now() >= this._optimisticToggle.expiresAt) {
      this._optimisticToggle = null;
      return false;
    }

    return true;
  }

  _scheduleOptimisticToggleTimeout() {
    this._clearOptimisticToggleTimer();
    if (!this._optimisticToggle || !this.isConnected || typeof window === "undefined") {
      return;
    }

    const remaining = Math.max(0, this._optimisticToggle.expiresAt - Date.now());
    this._optimisticToggleTimer = window.setTimeout(() => {
      this._optimisticToggleTimer = 0;
      if (!this.isConnected) {
        return;
      }
      if (!this._isOptimisticTogglePending(this._getActualState())) {
        this._lastRenderSignature = "";
        this._render();
        return;
      }
      this._scheduleOptimisticToggleTimeout();
    }, remaining);
  }

  _startOptimisticToggle(expectedState, actualState = this._getActualState()) {
    const entityId = this._config?.entity || "";
    if (!entityId || !this._isBinaryOnOff(actualState)) {
      return;
    }

    this._clearOptimisticToggleState();
    this._optimisticToggle = {
      entityId,
      expectedState,
      expiresAt: Date.now() + OPTIMISTIC_TOGGLE_TIMEOUT,
      stateSnapshot: this._createStateSnapshot(actualState),
    };
    this._scheduleOptimisticToggleTimeout();
  }

  _buildOptimisticToggleState(actualState = this._getActualState()) {
    if (!this._isOptimisticTogglePending(actualState)) {
      return actualState;
    }

    const snapshot = this._optimisticToggle?.stateSnapshot || actualState;
    if (!snapshot) {
      return actualState;
    }

    return {
      ...snapshot,
      entity_id: snapshot.entity_id || actualState?.entity_id || this._config?.entity,
      state: this._optimisticToggle.expectedState,
      attributes: {
        ...(snapshot.attributes || {}),
        ...(actualState?.attributes || {}),
        _nodalia_optimistic_toggle: this._optimisticToggle.expectedState,
      },
    };
  }

  _syncOptimisticToggleState(actualState = this._getActualState()) {
    if (!this._optimisticToggle) {
      return;
    }
    if (!this._isOptimisticTogglePending(actualState)) {
      this._clearOptimisticToggleTimer();
      return;
    }
    this._scheduleOptimisticToggleTimeout();
  }

  _getDomain(entityId = this._config?.entity) {
    return String(entityId || "").split(".")[0] || "";
  }

  _isHomeAssistantToggleable(state) {
    if (!state?.entity_id) {
      return false;
    }

    const stateKey = normalizeTextKey(state.state);
    if (!stateKey || stateKey === "unavailable") {
      return false;
    }

    const domain = this._getDomain(state.entity_id);
    return [
      "switch",
      "light",
      "fan",
      "cover",
      "lock",
      "input_boolean",
      "automation",
      "script",
      "valve",
      "siren",
      "remote",
      "water_heater",
      "humidifier",
      "media_player",
    ].includes(domain);
  }

  _canToggleEntity(state = this._getActualState()) {
    return this._isBinaryOnOff(state) || this._isHomeAssistantToggleable(state);
  }

  _usesDomainToggleService(state = this._getActualState()) {
    const domain = this._getDomain(state?.entity_id);
    return domain === "cover" || domain === "lock";
  }

  _isSelectEntity(state = this._getActualState()) {
    return isSelectDomainEntity(state) && getSelectEntityOptions(state).length > 0;
  }

  _getSelectOptions(state = this._getActualState()) {
    return getSelectEntityOptions(state);
  }

  _getSelectCurrentValue(state = this._getActualState()) {
    return getSelectEntityCurrentValue(state);
  }

  _formatSelectOptionLabel(option) {
    const chipLabel = window.NodaliaI18n?.translateEntityStateChip?.(
      this._hass,
      this._config?.language ?? "auto",
      option,
    );
    if (chipLabel) {
      return chipLabel;
    }
    return humanizeSelectOptionLabel(option);
  }

  _shouldOpenSelectPickerOnTap(state, zone = "body") {
    const tapAction = String(this._effectiveTapAction(zone) || "auto").trim().toLowerCase();
    if (tapAction !== "auto") {
      return false;
    }
    if (isUnavailableState(state)) {
      return false;
    }
    return this._isSelectEntity(state);
  }

  _getSelectPanelDuration(animations = this._getAnimationSettings()) {
    return animations.enabled
      ? Math.max(220, Math.round((animations.contentDuration || 420) * 0.72))
      : 0;
  }

  _createMarkupNode(markup) {
    if (!markup || typeof document === "undefined") {
      return null;
    }
    const template = document.createElement("template");
    template.innerHTML = String(markup).trim();
    const node = template.content.firstElementChild;
    return node instanceof HTMLElement ? node : null;
  }

  _syncSelectPickerHostState(isOpen) {
    this.classList.toggle("entity-card-host--select-open", isOpen === true);
    const card = this.shadowRoot?.querySelector(".entity-card");
    if (card instanceof HTMLElement) {
      card.classList.toggle("entity-card--select-open", isOpen === true);
    }
  }

  _getSelectPickerShellHost() {
    return this.shadowRoot?.querySelector("[data-select-picker-shell]") || null;
  }

  _buildSelectPickerShellMarkup(state, accentColor, animationClass = "") {
    const panelMarkup = this._renderSelectPickerPanel(state, accentColor);
    if (!panelMarkup) {
      return "";
    }
    const shellClass = animationClass
      ? `entity-card__select-picker-shell ${animationClass}`.trim()
      : "entity-card__select-picker-shell";
    return `
      <div class="${shellClass}">
        <div class="entity-card__select-picker-inner">
          ${panelMarkup}
        </div>
      </div>
    `;
  }

  _refreshSelectPickerContent(state, accentColor, options = {}) {
    const shellHost = this._getSelectPickerShellHost();
    if (!(shellHost instanceof HTMLElement) || !this._isSelectEntity(state)) {
      return;
    }
    const markup = this._buildSelectPickerShellMarkup(state, accentColor);
    if (!markup) {
      shellHost.replaceChildren();
      return;
    }
    const shellNode = this._createMarkupNode(markup);
    if (shellNode instanceof HTMLElement) {
      shellHost.replaceChildren(shellNode);
      return;
    }
    shellHost.innerHTML = markup;
  }

  _setSelectPickerVisibility(isOpen, state = this._getState()) {
    const nextOpen = isOpen === true;
    if (nextOpen === this._selectPickerOpen) {
      if (!nextOpen) {
        return;
      }
      if (!this._selectPickerAnimating) {
        this._refreshSelectPickerContent(state, this._getAccentColor(state));
      }
      return;
    }

    this._selectPickerOpen = nextOpen;
    this._syncSelectPickerHostState(nextOpen);

    const shellHost = this._getSelectPickerShellHost();
    if (!(shellHost instanceof HTMLElement) || !state || !this._isSelectEntity(state)) {
      this._lastRenderSignature = "";
      this._render();
      return;
    }

    const animations = this._getAnimationSettings();
    const accentColor = this._getAccentColor(state);
    const panelDuration = this._getSelectPanelDuration(animations);
    const existingShell = shellHost.querySelector(".entity-card__select-picker-shell");

    this._clearSelectPickerAnimationTimer("_selectPickerCloseTimer");
    this._clearSelectPickerAnimationTimer("_selectPickerEnterTimer");

    const clearShellHost = () => {
      shellHost.replaceChildren();
    };

    const mountStaticShell = () => {
      this._refreshSelectPickerContent(state, accentColor);
    };

    const removeShell = shell => {
      if (!(shell instanceof HTMLElement)) {
        clearShellHost();
        this._selectPickerAnimating = false;
        return;
      }

      this._selectPickerAnimating = true;
      shell.classList.remove("entity-card__select-picker-shell--entering");
      shell.classList.add("entity-card__select-picker-shell--leaving");

      const finalizeRemoval = () => {
        this._clearSelectPickerAnimationTimer("_selectPickerCloseTimer");
        if (shell.isConnected) {
          shell.remove();
        }
        if (!shellHost.querySelector(".entity-card__select-picker-shell")) {
          clearShellHost();
        }
        this._selectPickerAnimating = false;
      };

      shell.addEventListener("animationend", finalizeRemoval, { once: true });
      this._selectPickerCloseTimer = window.NodaliaUtils?.scheduleDeferTimer?.(
        this,
        finalizeRemoval,
        panelDuration + 80,
      ) || 0;
    };

    const appendShell = () => {
      const markup = this._buildSelectPickerShellMarkup(
        state,
        accentColor,
        animations.enabled ? "entity-card__select-picker-shell--entering" : "",
      );
      const shellNode = this._createMarkupNode(markup);
      if (!(shellNode instanceof HTMLElement)) {
        this._lastRenderSignature = "";
        this._render();
        return;
      }

      clearShellHost();
      shellHost.appendChild(shellNode);
      this._selectPickerAnimating = animations.enabled;

      if (!animations.enabled) {
        this._selectPickerAnimating = false;
        return;
      }

      const finalizeEnter = () => {
        this._clearSelectPickerAnimationTimer("_selectPickerEnterTimer");
        if (shellNode.isConnected) {
          shellNode.classList.remove("entity-card__select-picker-shell--entering");
        }
        this._selectPickerAnimating = false;
      };

      shellNode.addEventListener("animationend", finalizeEnter, { once: true });
      this._selectPickerEnterTimer = window.NodaliaUtils?.scheduleDeferTimer?.(
        this,
        finalizeEnter,
        panelDuration + 80,
      ) || 0;
    };

    if (!animations.enabled) {
      if (existingShell instanceof HTMLElement) {
        existingShell.remove();
      }
      if (nextOpen) {
        mountStaticShell();
      } else {
        clearShellHost();
      }
      this._selectPickerAnimating = false;
      return;
    }

    if (!nextOpen) {
      if (existingShell instanceof HTMLElement) {
        removeShell(existingShell);
      } else {
        clearShellHost();
        this._selectPickerAnimating = false;
      }
      return;
    }

    if (existingShell instanceof HTMLElement) {
      existingShell.classList.remove("entity-card__select-picker-shell--leaving");
      mountStaticShell();
      this._selectPickerAnimating = false;
      return;
    }

    appendShell();
  }

  _openSelectPicker() {
    if (this._selectPickerOpen) {
      return;
    }
    this._setSelectPickerVisibility(true);
  }

  _closeSelectPicker() {
    if (!this._selectPickerOpen) {
      return;
    }
    this._setSelectPickerVisibility(false);
  }

  _toggleSelectPicker() {
    if (this._selectPickerOpen) {
      this._closeSelectPicker();
      return;
    }
    this._openSelectPicker();
  }

  _clearSelectPickerAnimationTimer(timerKey) {
    const timer = this[timerKey];
    if (!timer || typeof window === "undefined") {
      this[timerKey] = 0;
      return;
    }
    window.clearTimeout(timer);
    this._nodaliaDeferTimers?.delete?.(timer);
    this[timerKey] = 0;
  }

  _selectEntityOption(optionValue) {
    const entityId = this._config?.entity;
    const state = this._getActualState();
    if (!entityId || !state || isUnavailableState(state)) {
      return;
    }
    const value = String(optionValue ?? "").trim();
    if (!value) {
      return;
    }
    const domain = this._getDomain(entityId);
    const serviceDomain = domain === "input_select" ? "input_select" : "select";
    this._invokeEntityService(serviceDomain, "select_option", entityId, { option: value });
    this._closeSelectPicker();
  }

  _invokeEntityService(domain, service, entityId, serviceData = {}) {
    const invoke = window.NodaliaUtils?.invokeHomeAssistantService?.bind(window.NodaliaUtils)
      || ((host, hass, svcDomain, svc, data) => Promise.resolve(hass?.callService?.(svcDomain, svc, data)));
    return invoke(this, this._hass, domain, service, {
      entity_id: entityId,
      ...serviceData,
    });
  }

  _toggleCoverEntity(state, entityId) {
    if (coverEntityIsOpen(state)) {
      if (entitySupportsFeature(state, COVER_SET_POSITION)) {
        this._invokeEntityService("cover", "set_cover_position", entityId, { position: 0 });
      } else {
        this._invokeEntityService("cover", "close_cover", entityId);
      }
      return;
    }

    if (entitySupportsFeature(state, COVER_SET_POSITION)) {
      this._invokeEntityService("cover", "set_cover_position", entityId, { position: 100 });
    } else {
      this._invokeEntityService("cover", "open_cover", entityId);
    }
  }

  _toggleLockEntity(state, entityId) {
    const stateKey = normalizeTextKey(state?.state);
    if (["locking", "unlocking", "jammed", "unavailable", "unknown"].includes(stateKey)) {
      return;
    }

    const features = entitySupportedFeatures(state);
    if (stateKey === "locked") {
      this._invokeEntityService("lock", "unlock", entityId);
      return;
    }

    if (features & LOCK_LOCK) {
      this._invokeEntityService("lock", "lock", entityId);
    } else {
      this._invokeEntityService("lock", "lock", entityId);
    }
  }

  _isBinaryOnOff(state) {
    const stateKey = normalizeTextKey(state?.state);
    return stateKey === "on" || stateKey === "off";
  }

  _isActiveState(state) {
    const stateKey = normalizeTextKey(state?.state);

    if (!stateKey || ["off", "closed", "locked", "unavailable", "unknown", "none", "idle", "standby"].includes(stateKey)) {
      return false;
    }

    return true;
  }

  _getAccentColor(state) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    return this._isActiveState(state)
      ? styles?.icon?.on_color || DEFAULT_CONFIG.styles.icon.on_color
      : styles?.icon?.off_color || DEFAULT_CONFIG.styles.icon.off_color;
  }

  _getNumberDecimals() {
    const configuredValue = Number(this._config?.number_decimals);
    return Number.isFinite(configuredValue) ? clamp(Math.round(configuredValue), 0, 6) : 2;
  }

  _translateStateValue(state) {
    const hass = window.NodaliaI18n?.resolveHass?.(this._hass) ?? this._hass;
    const lang = window.NodaliaI18n.resolveLanguage(hass, this._config?.language ?? "auto");
    return window.NodaliaI18n.translateEntityState(
      lang,
      state,
      this._getNumberDecimals(),
      formatNumericValueWithUnit,
      formatNumericValue,
      parseNumericValue,
    );
  }

  _formatAttributeValue(state, attributeName) {
    if (!state || !attributeName) {
      return null;
    }

    const value = state.attributes?.[attributeName];

    if (value === undefined || value === null || value === "") {
      return null;
    }

    const key = normalizeTextKey(attributeName);
    const numberDecimals = this._getNumberDecimals();

    if (typeof value === "boolean") {
      const hass = window.NodaliaI18n?.resolveHass?.(this._hass) ?? this._hass;
      const lang = window.NodaliaI18n.resolveLanguage(hass, this._config?.language ?? "auto");
      const labels = window.NodaliaI18n.strings(lang).entityCard.boolean;
      return value ? labels.yes : labels.no;
    }

    if (Array.isArray(value)) {
      return value
        .map(item => {
          if (isObject(item) && item.name) {
            return item.name;
          }
          return String(item ?? "").trim();
        })
        .filter(Boolean)
        .join(", ");
    }

    if (isObject(value)) {
      if (value.name) {
        return String(value.name);
      }

      const keys = Object.keys(value).sort();
      return keys.map(key => `${key}:${String(value[key] ?? "")}`).join(", ");
    }

    const numericValue = parseNumericValue(value);
    if (numericValue !== null) {
      if (["battery", "battery_level", "humidity", "current_humidity"].includes(key)) {
        return `${Math.round(numericValue)}%`;
      }

      if (key === "brightness") {
        return `${Math.round((numericValue / 255) * 100)}%`;
      }

      if (key === "volume_level") {
        return `${Math.round(numericValue * 100)}%`;
      }

      if (key.includes("temperature")) {
        const unit = state.attributes?.temperature_unit || "°C";
        return formatNumericValueWithUnit(numericValue, unit, numberDecimals);
      }

      return formatNumericValue(numericValue, numberDecimals);
    }

    return String(value);
  }

  _getTitle(state) {
    return this._config?.name || state?.attributes?.friendly_name || this._config?.entity || "Entity";
  }

  _getIcon(state) {
    const trimIcon = value => (typeof value === "string" ? value.trim() : "");
    const iconActive = trimIcon(this._config?.icon_active);
    const iconInactive = trimIcon(this._config?.icon_inactive);
    const hasStateIcons = Boolean(iconActive || iconInactive);

    if (hasStateIcons) {
      const chosen = this._isActiveState(state) ? iconActive : iconInactive;
      if (chosen) {
        return chosen;
      }
    }

    if (this._config?.use_entity_icon === true) {
      const resolvedEntityIcon = state?.attributes?.icon || getDynamicEntityIcon(state);
      if (resolvedEntityIcon) {
        return resolvedEntityIcon;
      }
    }

    return trimIcon(this._config?.icon) || state?.attributes?.icon || "mdi:tune";
  }

  _getEntityPicture(state) {
    if (this._config?.show_entity_picture !== true) {
      return "";
    }
    return String(
      this._config?.entity_picture
      || state?.attributes?.entity_picture_local
      || state?.attributes?.entity_picture
      || "",
    ).trim();
  }

  _effectiveTapAction(zone) {
    if (zone === "icon") {
      const raw = this._config?.icon_tap_action;
      if (raw === undefined || raw === null || String(raw).trim() === "") {
        return this._config?.tap_action || "auto";
      }
      return String(raw).trim() || "auto";
    }
    return String(this._config?.tap_action || "auto").trim() || "auto";
  }

  _effectiveHoldAction(zone) {
    if (zone === "icon") {
      const raw = this._config?.icon_hold_action;
      if (raw === undefined || raw === null || String(raw).trim() === "") {
        return this._config?.hold_action || "none";
      }
      return String(raw).trim() || "none";
    }
    return String(this._config?.hold_action || "none").trim() || "none";
  }

  _canRunTapAction(state, zone = "body") {
    const tapAction = String(this._effectiveTapAction(zone) || "auto").trim().toLowerCase();
    if (tapAction === "none") {
      return false;
    }

    if (tapAction === "service") {
      const service = zone === "icon" ? this._config?.icon_tap_service : this._config?.tap_service;
      return Boolean(service && String(service).trim());
    }

    if (tapAction === "url") {
      const url = zone === "icon" ? this._config?.icon_tap_url : this._config?.tap_url;
      return Boolean(url && String(url).trim());
    }

    if (tapAction === "navigate") {
      return Boolean(this._navigationPathForZone(zone, "tap"));
    }

    if (tapAction === "toggle") {
      return this._canToggleEntity(this._getActualState());
    }

    if (tapAction === "more-info") {
      return Boolean(this._config?.entity);
    }

    if (tapAction === "auto") {
      return Boolean(this._config?.entity);
    }

    return false;
  }

  _canRunHoldAction(state, zone = "body") {
    const holdAction = String(this._effectiveHoldAction(zone) || "none").trim().toLowerCase();
    if (holdAction === "none") {
      return false;
    }

    if (holdAction === "service") {
      let service = zone === "icon" ? this._config?.icon_hold_service : this._config?.hold_service;
      if (zone === "icon" && !String(service || "").trim()) {
        service = this._config?.hold_service;
      }
      return Boolean(service && String(service).trim());
    }

    if (holdAction === "url") {
      let url = zone === "icon" ? this._config?.icon_hold_url : this._config?.hold_url;
      if (zone === "icon" && !String(url || "").trim()) {
        url = this._config?.hold_url;
      }
      return Boolean(url && String(url).trim());
    }

    if (holdAction === "navigate") {
      return Boolean(this._navigationPathForZone(zone, "hold"));
    }

    if (holdAction === "toggle") {
      return this._canToggleEntity(this._getActualState());
    }

    if (holdAction === "more-info") {
      return Boolean(this._config?.entity);
    }

    if (holdAction === "auto") {
      return Boolean(this._config?.entity);
    }

    return false;
  }

  _effectiveDoubleTapAction(zone) {
    if (zone === "icon") {
      const raw = this._config?.icon_double_tap_action;
      if (raw === undefined || raw === null || String(raw).trim() === "") {
        return this._config?.double_tap_action || "none";
      }
      return String(raw).trim() || "none";
    }
    return String(this._config?.double_tap_action || "none").trim() || "none";
  }

  _canRunDoubleTapAction(state, zone = "body") {
    const doubleAction = String(this._effectiveDoubleTapAction(zone) || "none").trim().toLowerCase();
    if (doubleAction === "none") {
      return false;
    }

    if (doubleAction === "service") {
      let service = zone === "icon" ? this._config?.icon_double_tap_service : this._config?.double_tap_service;
      if (zone === "icon" && !String(service || "").trim()) {
        service = this._config?.double_tap_service;
      }
      return Boolean(service && String(service).trim());
    }

    if (doubleAction === "url") {
      let url = zone === "icon" ? this._config?.icon_double_tap_url : this._config?.double_tap_url;
      if (zone === "icon" && !String(url || "").trim()) {
        url = this._config?.double_tap_url;
      }
      return Boolean(url && String(url).trim());
    }

    if (doubleAction === "navigate") {
      return Boolean(this._navigationPathForZone(zone, "double"));
    }

    if (doubleAction === "toggle") {
      return this._canToggleEntity(this._getActualState());
    }

    if (doubleAction === "more-info" || doubleAction === "auto") {
      return Boolean(this._config?.entity);
    }

    return false;
  }

  _toggleEntity(entityId = this._config?.entity) {
    const state = this._hass?.states?.[entityId];
    const isPrimaryEntity = entityId && entityId === this._config?.entity;
    const actualState = isPrimaryEntity ? this._getActualState() : state;
    const effectiveState = isPrimaryEntity ? this._getState() : state;
    if (!this._hass || !entityId || !actualState) {
      return;
    }

    if (this._isBinaryOnOff(actualState)) {
      const service = normalizeTextKey(effectiveState.state) === "on" ? "turn_off" : "turn_on";
      if (isPrimaryEntity) {
        this._startOptimisticToggle(service === "turn_on" ? "on" : "off", actualState);
      }
      this._invokeEntityService("homeassistant", service, entityId);
      if (isPrimaryEntity) {
        this._render();
      }
      return;
    }

    const domain = this._getDomain(entityId);
    if (domain === "cover") {
      this._toggleCoverEntity(actualState, entityId);
      if (isPrimaryEntity) {
        this._render();
      }
      return;
    }

    if (domain === "lock") {
      this._toggleLockEntity(actualState, entityId);
      if (isPrimaryEntity) {
        this._render();
      }
      return;
    }

    if (!this._isHomeAssistantToggleable(actualState)) {
      return;
    }

    this._invokeEntityService("homeassistant", "toggle", entityId);
    if (isPrimaryEntity) {
      this._render();
    }
  }

  _openMoreInfo(entityId = this._config?.entity) {
    if (!entityId) {
      return;
    }

    fireEvent(this, "hass-more-info", {
      entityId,
    });
  }

  _navigationPathForZone(zone = "body", actionKind = "tap") {
    const kind = actionKind === "hold" ? "hold" : actionKind === "double" ? "double" : "tap";
    const pathKey = kind === "tap"
      ? "navigation_path"
      : kind === "hold"
        ? "hold_navigation_path"
        : "double_tap_navigation_path";
    const iconPathKey = kind === "tap"
      ? "icon_navigation_path"
      : kind === "hold"
        ? "icon_hold_navigation_path"
        : "icon_double_tap_navigation_path";
    const urlKey = kind === "tap" ? "tap_url" : kind === "hold" ? "hold_url" : "double_tap_url";
    const iconUrlKey = kind === "tap" ? "icon_tap_url" : kind === "hold" ? "icon_hold_url" : "icon_double_tap_url";
    if (zone === "icon") {
      const iconPath = String(this._config?.[iconPathKey] ?? "").trim();
      if (iconPath) {
        return iconPath;
      }
      const inheritedBodyPath = String(this._config?.[pathKey] ?? "").trim();
      if (inheritedBodyPath) {
        return inheritedBodyPath;
      }
      return String(this._config?.[iconUrlKey] ?? "").trim() || String(this._config?.[urlKey] ?? "").trim();
    }

    const bodyPath = String(this._config?.[pathKey] ?? "").trim();
    if (bodyPath) {
      return bodyPath;
    }

    return String(this._config?.[urlKey] ?? "").trim();
  }

  _navigateToPath(path) {
    const navigationPath = String(path || "").trim();
    if (!navigationPath) {
      return;
    }

    if (this._hass?.navigate) {
      this._hass.navigate(navigationPath);
      return;
    }

    if (window?.history?.pushState && !navigationPath.includes("://")) {
      window.history.pushState(null, "", navigationPath);
      fireEvent(this, "location-changed", { replace: false });
      return;
    }

    fireEvent(this, "hass-navigate", { path: navigationPath });
  }

  _parseServiceData(rawValue) {
    if (!rawValue) {
      return {};
    }

    try {
      const parsed = JSON.parse(rawValue);
      return isObject(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
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
      return normalizedService === "homeassistant.toggle"
        || normalizedService === "homeassistant.turn_on"
        || normalizedService === "homeassistant.turn_off";
    }
    return services.includes(normalizedService) || domains.includes(domain);
  }

  _callConfiguredService(serviceValue, entityId = this._config?.entity, rawData = "", rawTarget = "") {
    if (!this._hass || !serviceValue) {
      return;
    }

    if (!this._isServiceAllowed(serviceValue)) {
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Entity Card", serviceValue);
      return;
    }

    const [domain, service] = String(serviceValue).split(".");
    if (!domain || !service) {
      return;
    }

    const payload = this._parseServiceData(rawData);
    const target = this._parseServiceData(rawTarget);
    const hasExplicitTarget = Object.keys(target).length > 0;
    if (entityId && payload.entity_id === undefined && !hasExplicitTarget) {
      payload.entity_id = entityId;
    }

    const invoke = window.NodaliaUtils?.invokeHomeAssistantService?.bind(window.NodaliaUtils)
      || ((host, hass, svcDomain, svc, data, svcTarget) => Promise.resolve(
        svcTarget != null
          ? hass?.callService?.(svcDomain, svc, data, svcTarget)
          : hass?.callService?.(svcDomain, svc, data),
      ));
    invoke(this, this._hass, domain, service, payload, hasExplicitTarget ? target : null);
  }

  _openConfiguredUrl(urlValue = this._config?.tap_url, newTab = this._config?.tap_new_tab === true) {
    const url = window.NodaliaUtils?.sanitizeActionUrl(urlValue, { allowRelative: true }) || "";
    if (!url) {
      return;
    }

    if (newTab) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.href = url;
  }

  _performTapAction(state, zone = "body") {
    const tapAction = String(this._effectiveTapAction(zone) || "auto").trim().toLowerCase();
    const tapService = zone === "icon" ? this._config?.icon_tap_service : this._config?.tap_service;
    const tapServiceData = zone === "icon" ? this._config?.icon_tap_service_data : this._config?.tap_service_data;
    const tapServiceTarget = zone === "icon" ? this._config?.icon_tap_service_target : this._config?.tap_service_target;
    const tapUrl = zone === "icon" ? this._config?.icon_tap_url : this._config?.tap_url;
    const tapNewTab = zone === "icon" ? this._config?.icon_tap_new_tab === true : this._config?.tap_new_tab === true;

    switch (tapAction) {
      case "toggle":
        this._toggleEntity(this._config?.entity);
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service":
        this._callConfiguredService(tapService, this._config?.entity, tapServiceData, tapServiceTarget);
        break;
      case "url":
        this._openConfiguredUrl(tapUrl, tapNewTab);
        break;
      case "navigate":
        this._navigateToPath(this._navigationPathForZone(zone, "tap"));
        break;
      case "auto":
      default:
        if (this._shouldOpenSelectPickerOnTap(state, zone)) {
          this._toggleSelectPicker();
          return;
        }
        if (this._isBinaryOnOff(state) || this._usesDomainToggleService(state)) {
          this._toggleEntity(this._config?.entity);
          return;
        }

        this._openMoreInfo(this._config?.entity);
        break;
    }
  }

  _performHoldAction(state, zone = "body") {
    const holdAction = String(this._effectiveHoldAction(zone) || "none").trim().toLowerCase();
    let holdService = zone === "icon" ? this._config?.icon_hold_service : this._config?.hold_service;
    let holdServiceData = zone === "icon" ? this._config?.icon_hold_service_data : this._config?.hold_service_data;
    let holdServiceTarget = zone === "icon" ? this._config?.icon_hold_service_target : this._config?.hold_service_target;
    let holdUrl = zone === "icon" ? this._config?.icon_hold_url : this._config?.hold_url;
    let holdNewTab = zone === "icon" ? this._config?.icon_hold_new_tab === true : this._config?.hold_new_tab === true;
    if (zone === "icon") {
      if (!String(holdService || "").trim()) {
        holdService = this._config?.hold_service;
        holdServiceData = this._config?.hold_service_data;
        holdServiceTarget = this._config?.hold_service_target;
      }
      if (!String(holdUrl || "").trim()) {
        holdUrl = this._config?.hold_url;
        holdNewTab = this._config?.hold_new_tab === true;
      }
    }

    switch (holdAction) {
      case "toggle":
        this._toggleEntity(this._config?.entity);
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service":
        this._callConfiguredService(holdService, this._config?.entity, holdServiceData, holdServiceTarget);
        break;
      case "url":
        this._openConfiguredUrl(holdUrl, holdNewTab);
        break;
      case "navigate":
        this._navigateToPath(this._navigationPathForZone(zone, "hold"));
        break;
      case "auto":
      default:
        if (this._isBinaryOnOff(state) || this._usesDomainToggleService(state)) {
          this._toggleEntity(this._config?.entity);
          return;
        }

        this._openMoreInfo(this._config?.entity);
        break;
    }
  }

  _performDoubleTapAction(state, zone = "body") {
    const doubleAction = String(this._effectiveDoubleTapAction(zone) || "none").trim().toLowerCase();
    let doubleService = zone === "icon" ? this._config?.icon_double_tap_service : this._config?.double_tap_service;
    let doubleServiceData = zone === "icon" ? this._config?.icon_double_tap_service_data : this._config?.double_tap_service_data;
    let doubleServiceTarget = zone === "icon" ? this._config?.icon_double_tap_service_target : this._config?.double_tap_service_target;
    let doubleUrl = zone === "icon" ? this._config?.icon_double_tap_url : this._config?.double_tap_url;
    let doubleNewTab = zone === "icon" ? this._config?.icon_double_tap_new_tab === true : this._config?.double_tap_new_tab === true;
    if (zone === "icon") {
      if (!String(doubleService || "").trim()) {
        doubleService = this._config?.double_tap_service;
        doubleServiceData = this._config?.double_tap_service_data;
        doubleServiceTarget = this._config?.double_tap_service_target;
      }
      if (!String(doubleUrl || "").trim()) {
        doubleUrl = this._config?.double_tap_url;
        doubleNewTab = this._config?.double_tap_new_tab === true;
      }
    }

    switch (doubleAction) {
      case "toggle":
        this._toggleEntity(this._config?.entity);
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service":
        this._callConfiguredService(doubleService, this._config?.entity, doubleServiceData, doubleServiceTarget);
        break;
      case "url":
        this._openConfiguredUrl(doubleUrl, doubleNewTab);
        break;
      case "navigate":
        this._navigateToPath(this._navigationPathForZone(zone, "double"));
        break;
      case "auto":
      default:
        if (this._isBinaryOnOff(state) || this._usesDomainToggleService(state)) {
          this._toggleEntity(this._config?.entity);
          return;
        }

        this._openMoreInfo(this._config?.entity);
        break;
    }
  }

  _performQuickAction(action) {
    const targetEntity = action?.entity || this._config?.entity;

    switch (action?.type) {
      case "toggle":
        this._toggleEntity(targetEntity);
        break;
      case "more-info":
        this._openMoreInfo(targetEntity);
        break;
      case "service":
        this._callConfiguredService(action?.service, targetEntity, action?.service_data);
        break;
      default:
        break;
    }
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
      buttonBounceDuration: clamp(
        Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration,
        120,
        1200,
      ),
      contentDuration: clamp(
        Number(configuredAnimations.content_duration) || DEFAULT_CONFIG.animations.content_duration,
        140,
        1800,
      ),
    };
  }

  _triggerPressAnimation(element, className = "is-pressing") {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    const animations = this._getAnimationSettings();
    if (!animations.enabled) {
      return;
    }

    element.classList.remove(className);
    element.getBoundingClientRect();
    element.classList.add(className);

    const schedule = window.NodaliaUtils?.scheduleDeferTimer;
    const done = () => {
      if (!element.isConnected) {
        return;
      }
      element.classList.remove(className);
    };
    if (typeof schedule === "function") {
      schedule(this, done, animations.buttonBounceDuration + 40);
    } else {
      window.setTimeout(done, animations.buttonBounceDuration + 40);
    }
  }

  _scheduleEntranceAnimationReset(delay) {
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }

    const safeDelay = clamp(Math.round(Number(delay) || 0), 0, 3000);
    if (!safeDelay || typeof window === "undefined") {
      this._animateContentOnNextRender = false;
      return;
    }

    this._entranceAnimationResetTimer = window.setTimeout(() => {
      this._entranceAnimationResetTimer = 0;
      if (!this.isConnected) {
        return;
      }
      this._animateContentOnNextRender = false;
    }, safeDelay);
  }

  _triggerEntityPressFeedback(action, actionTarget) {
    const hapticStyle = action === "select-option" ? "selection" : null;
    this._triggerHaptic(hapticStyle);

    if (action === "body" || action === "icon") {
      this._triggerPressAnimation(this.shadowRoot.querySelector(".entity-card__content"));
      this._triggerPressAnimation(this.shadowRoot.querySelector(".entity-card__icon"));
      return;
    }

    if (actionTarget instanceof HTMLElement) {
      this._triggerPressAnimation(actionTarget);
    }
  }

  _onShadowPointerDown(event) {
    if (typeof event.button === "number" && event.button !== 0) {
      return;
    }

    const actionTarget = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.entityAction);

    if (!actionTarget) {
      return;
    }

    const action = actionTarget.dataset.entityAction;
    if (action === "body" || action === "icon") {
      if (this._suppressNextEntityTap) {
        return;
      }
      this._triggerEntityPressFeedback(action, actionTarget);
      return;
    }

    if (action === "select-close" || action === "select-option" || action === "quick") {
      this._triggerEntityPressFeedback(action, actionTarget);
    }
  }

  _onShadowClick(event) {
    const actionTarget = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.entityAction);

    if (!actionTarget) {
      return;
    }

    const state = this._getState();
    const action = actionTarget.dataset.entityAction;

    event.preventDefault();
    event.stopPropagation();

    if (action === "select-close") {
      this._closeSelectPicker();
      return;
    }

    if (action === "select-option") {
      const value = actionTarget.dataset.selectValue || "";
      this._selectEntityOption(value);
      return;
    }

    if (action === "body" || action === "icon") {
      if (this._suppressNextEntityTap) {
        this._suppressNextEntityTap = false;
        return;
      }
      const zone = action;
      const runTap = () => {
        if (!this._canRunTapAction(state, zone)) {
          return;
        }
        this._performTapAction(state, zone);
      };
      const runDouble = () => {
        if (!this._canRunDoubleTapAction(state, zone)) {
          return;
        }
        this._performDoubleTapAction(state, zone);
      };
      if (this._canRunDoubleTapAction(state, zone) && typeof window.NodaliaUtils?.scheduleCardZoneTap === "function") {
        window.NodaliaUtils.scheduleCardZoneTap(this, { zone, onSingle: runTap, onDouble: runDouble });
        return;
      }
      runTap();
      return;
    }

    if (action === "quick") {
      const index = Number(actionTarget.dataset.index);
      const quickAction = this._config?.quick_actions?.[index];

      if (!quickAction) {
        return;
      }

      this._performQuickAction(quickAction);
    }
  }

  _renderChip(label, tone = "default") {
    if (!label) {
      return "";
    }

    return `<div class="entity-card__chip entity-card__chip--${tone}">${escapeHtml(label)}</div>`;
  }

  _entityCardUi(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.entityCard;
    const enPack = window.NodaliaI18n?.strings?.("en")?.entityCard;
    const raw = pack?.[key] ?? enPack?.[key];
    return String(raw != null && raw !== "" ? raw : fallback);
  }

  _renderSelectPickerPanel(state, accentColor) {
    const options = this._getSelectOptions(state);
    if (!options.length) {
      return "";
    }
    const current = this._getSelectCurrentValue(state);
    const pickerTitle = this._entityCardUi("selectPickerTitle", "Choose option");
    const closeLabel = this._entityCardUi("selectPickerClose", "Close");

    return `
      <div
        class="entity-card__select-picker"
        role="listbox"
        aria-label="${escapeHtml(pickerTitle)}"
      >
        <div class="entity-card__select-picker-head">
          <span class="entity-card__select-picker-kicker">${escapeHtml(pickerTitle)}</span>
          <button
            type="button"
            class="entity-card__select-picker-close"
            data-entity-action="select-close"
            aria-label="${escapeHtml(closeLabel)}"
          >
            <ha-icon icon="mdi:chevron-up"></ha-icon>
          </button>
        </div>
        <div class="entity-card__select-options">
          ${options.map(option => {
            const isActive = normalizeTextKey(option) === normalizeTextKey(current);
            const label = this._formatSelectOptionLabel(option);
            return `
              <button
                type="button"
                class="entity-card__select-option${isActive ? " is-active" : ""}"
                data-entity-action="select-option"
                data-select-value="${escapeHtml(option)}"
                role="option"
                aria-selected="${isActive ? "true" : "false"}"
                style="--select-option-accent:${escapeHtml(accentColor)};"
              >
                <span class="entity-card__select-option-indicator" aria-hidden="true"></span>
                <span class="entity-card__select-option-label">${escapeHtml(label)}</span>
                ${isActive ? '<ha-icon class="entity-card__select-option-check" icon="mdi:check"></ha-icon>' : ""}
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  _renderEmptyState() {
    const title = escapeHtml(this._entityCardUi("emptyTitle", "Nodalia Entity Card"));
    const body = escapeHtml(this._entityCardUi("emptyBody", "Set `entity` to show this card."));
    return `
      <ha-card class="entity-card entity-card--empty">
        <div class="entity-card__empty-title">${title}</div>
        <div class="entity-card__empty-text">${body}</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const entityGuard = window.NodaliaUtils?.renderLovelaceEntityGuardCardHtml?.(
      this._hass,
      this._config?.entity,
      { cardClass: "entity-card" },
    );
    if (entityGuard) {
      this.shadowRoot.innerHTML = entityGuard;
      return;
    }

    const state = this._getState();
    if (!state) {
      this.shadowRoot.innerHTML = window.NodaliaUtils?.renderCardEmptyStateDocument?.(
        this._renderEmptyState(),
        { card: (this._config || DEFAULT_CONFIG).styles?.card },
      ) ?? this._renderEmptyState();
      return;
    }

    const config = this._config;
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const quickActions = Array.isArray(config.quick_actions) ? config.quick_actions.filter(action => action?.icon) : [];
    const configuredColumns = this._getConfiguredGridColumns();
    const configuredRows = this._getConfiguredGridRows();
    const singleRowLayout = configuredRows !== null ? configuredRows <= 1 : false;
    const narrowCard = configuredColumns !== null ? configuredColumns < 4 : (this._cardWidth || this.clientWidth || 0) <= 300;
    const compactMetrics = narrowCard || singleRowLayout;
    const singleRowPaddingY = singleRowLayout ? 4 : 0;
    const singleRowPaddingX = singleRowLayout ? 9 : 0;
    const effectivePadding = singleRowLayout ? `${singleRowPaddingY}px ${singleRowPaddingX}px` : compactMetrics ? "10px 12px" : styles.card.padding;
    const effectiveGap = singleRowLayout ? "2px" : compactMetrics ? "8px" : styles.card.gap;
    const effectiveIconSizePx = Math.max(30, Math.min(parseSizeToPixels(styles.icon.size, 58), singleRowLayout ? 32 : compactMetrics ? 46 : 58));
    const effectiveIconSize = `${effectiveIconSizePx}px`;
    const effectiveIconTrackSize = `${effectiveIconSizePx + (singleRowLayout ? 7 : 10)}px`;
    const effectiveControlSize = `${Math.max(34, Math.min(parseSizeToPixels(styles.control.size, 40), compactMetrics ? 36 : 40))}px`;
    const effectiveTitleSize = `${Math.max(9.5, Math.min(parseSizeToPixels(styles.title_size, 14), singleRowLayout ? 10 : compactMetrics ? 12 : 14))}px`;
    const effectiveChipHeight = `${Math.max(15, Math.min(parseSizeToPixels(styles.chip_height, 24), singleRowLayout ? 16 : compactMetrics ? 22 : 24))}px`;
    const effectiveChipFontSize = `${Math.max(8, Math.min(parseSizeToPixels(styles.chip_font_size, 11), singleRowLayout ? 8.5 : compactMetrics ? 10 : 11))}px`;
    const effectiveChipPadding = singleRowLayout ? "0 6px" : compactMetrics ? "0 8px" : styles.chip_padding;
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const effectiveCardHeightPx = singleRowLayout ? Math.max(54, effectiveIconSizePx + (singleRowPaddingY * 2)) : 0;
    const effectiveCardMinHeight = singleRowLayout ? `${effectiveCardHeightPx}px` : "0px";
    const effectiveContentMinHeight = singleRowLayout ? `${Math.max(effectiveIconSizePx, effectiveCardHeightPx - (singleRowPaddingY * 2))}px` : "0px";
    const title = this._getTitle(state);
    const icon = this._getIcon(state);
    const entityPicture = this._getEntityPicture(state);
    const isCompactLayout = this._isCompactLayout;
    const accentColor = this._getAccentColor(state);
    const showUnavailableBadge = isUnavailableState(state);
    const stateLabel = config.show_state ? this._translateStateValue(state) : null;
    const stateChip = this._renderChip(stateLabel, "state");
    const statePosition = config.state_position === "right" ? "right" : "below";
    const primaryValue = config.show_primary_chip !== false
      ? this._formatAttributeValue(state, config.primary_attribute)
      : null;
    const secondaryValue = config.show_secondary_chip !== false
      ? this._formatAttributeValue(state, config.secondary_attribute)
      : null;
    const showTitle = !isCompactLayout;
    const placeStateChipOnTitleRow = statePosition === "right" && Boolean(stateChip);
    const chips = [
      placeStateChipOnTitleRow ? "" : stateChip,
      this._renderChip(primaryValue, "value"),
      this._renderChip(secondaryValue, "value"),
    ].filter(Boolean);
    const showCopyHeader = showTitle || placeStateChipOnTitleRow;
    const showCopyBlock = showCopyHeader || chips.length > 0;
    const canRunBodyTap = this._canRunTapAction(state, "body");
    const canRunIconTap = this._canRunTapAction(state, "icon");
    const isSelectEntity = this._isSelectEntity(state);
    const isActive = this._isActiveState(state);
    const darkenBubbleIconGlyph = isActive && shouldDarkenEntityBubbleIconGlyph(state, accentColor);
    const onCardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 52%, ${styles.card.background} 100%)`;
    const onCardBorder = `color-mix(in srgb, ${accentColor} 32%, var(--divider-color))`;
    const onCardShadow = `0 16px 32px color-mix(in srgb, ${accentColor} 18%, rgba(0, 0, 0, 0.18))`;
    const cardBackground = isActive ? onCardBackground : styles.card.background;
    const cardBorder = isActive ? `1px solid ${onCardBorder}` : styles.card.border;
    const cardShadow = isActive ? `${styles.card.box_shadow}, ${onCardShadow}` : styles.card.box_shadow;
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --entity-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --entity-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          --entity-card-select-panel-duration: ${animations.enabled ? Math.max(220, Math.round(animations.contentDuration * 0.72)) : 0}ms;
          display: block;
          position: relative;
        }

        :host(.entity-card-host--select-open) {
          z-index: 2;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          display: block;
          isolation: isolate;
          overflow: hidden;
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .entity-card--single-row {
          min-height: ${effectiveCardMinHeight};
        }

        ha-card::before {
          background: ${isActive
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`
            : "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0))"};
          border-radius: inherit;
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        ha-card::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%);
          border-radius: inherit;
          content: "";
          inset: 0;
          opacity: ${isActive ? "1" : "0"};
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .entity-card--clickable {
          cursor: pointer;
        }

        .entity-card__icon.entity-card__icon--clickable {
          cursor: pointer;
        }

        .entity-card__content {
          display: grid;
          gap: ${effectiveGap};
          min-width: 0;
          padding: ${effectivePadding};
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease;
          will-change: transform;
          z-index: 1;
        }

        .entity-card__content--entering {
          animation: entity-card-fade-up calc(var(--entity-card-content-duration) * 0.88) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .entity-card__content.is-pressing {
          animation: entity-card-content-bounce var(--entity-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .entity-card--single-row .entity-card__content {
          align-content: center;
          min-height: ${effectiveContentMinHeight};
        }

        .entity-card__hero {
          align-items: center;
          display: grid;
          gap: ${singleRowLayout ? "6px" : narrowCard ? "10px" : "12px"};
          grid-template-columns: ${effectiveIconTrackSize} minmax(0, 1fr);
          min-height: ${singleRowLayout ? effectiveContentMinHeight : "0px"};
          min-width: 0;
        }

        .entity-card__hero--entering {
          animation: entity-card-fade-up calc(var(--entity-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .entity-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${isActive
            ? `color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent))`
            : styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${isActive ? styles.icon.on_color : styles.icon.off_color};
          cursor: ${canRunIconTap || canRunBodyTap ? "pointer" : "default"};
          display: inline-flex;
          flex: 0 0 auto;
          height: ${effectiveIconSize};
          justify-content: center;
          line-height: 0;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          justify-self: start;
          transform-origin: center;
          transition: transform 160ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease, color 180ms ease;
          will-change: transform;
          width: ${effectiveIconSize};
        }

        .entity-card__icon--entering {
          animation: entity-card-bubble-bloom calc(var(--entity-card-content-duration) * 0.92) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 40ms;
        }

        .entity-card__icon.is-pressing,
        .entity-card__control.is-pressing {
          animation: entity-card-bubble-bounce var(--entity-card-button-bounce-duration) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
        }

        .entity-card__icon ha-icon {
          --mdc-icon-size: calc(${effectiveIconSize} * 0.44);
          color: ${
            !isActive
              ? styles.icon.off_color
              : darkenBubbleIconGlyph
                ? `color-mix(in srgb, var(--primary-text-color) 56%, ${accentColor})`
                : styles.icon.on_color
          };
          display: inline-flex;
          height: calc(${effectiveIconSize} * 0.44);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${effectiveIconSize} * 0.44);
        }

        .entity-card__picture {
          border-radius: inherit;
          height: 100%;
          inset: 0;
          object-fit: cover;
          position: absolute;
          width: 100%;
        }

        .entity-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          color: #ffffff;
          display: inline-flex;
          height: 18px;
          justify-content: center;
          position: absolute;
          right: 0;
          top: 0;
          transform: translate(28%, -28%);
          width: 18px;
          z-index: 2;
        }

        .entity-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .entity-card__copy {
          display: grid;
          gap: ${singleRowLayout ? "0" : narrowCard ? "6px" : "10px"};
          min-width: 0;
        }

        .entity-card__copy--entering {
          animation: entity-card-fade-up calc(var(--entity-card-content-duration) * 0.92) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 70ms;
        }

        .entity-card--single-row .entity-card__copy {
          align-content: center;
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .entity-card--compact:not(.entity-card--with-copy) .entity-card__hero {
          justify-items: center;
          grid-template-columns: 1fr;
        }

        .entity-card__copy-header {
          align-items: center;
          display: flex;
          gap: ${singleRowLayout ? "4px" : narrowCard ? "6px" : "8px"};
          min-width: 0;
        }

        .entity-card__title {
          flex: 1 1 auto;
          font-size: ${effectiveTitleSize};
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: ${singleRowLayout ? "1.02" : narrowCard ? "1.1" : "1.15"};
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .entity-card__copy-header-chip {
          display: flex;
          flex: 0 1 auto;
          justify-content: flex-end;
          margin-left: auto;
          max-width: 100%;
          min-width: 0;
        }

        .entity-card__copy-header-chip .entity-card__chip {
          max-width: 100%;
        }

        .entity-card__chips {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: ${singleRowLayout ? "0" : narrowCard ? "6px" : "8px"};
          min-width: 0;
        }

        .entity-card--single-row .entity-card__chips {
          flex-wrap: nowrap;
          gap: 3px;
          justify-content: flex-start;
          margin-left: 0;
        }

        .entity-card__chip {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: ${chipBorderRadius};
          color: var(--secondary-text-color);
          display: inline-flex;
          flex: 0 0 auto;
          font-size: ${effectiveChipFontSize};
          font-weight: 600;
          line-height: 1;
          min-height: ${effectiveChipHeight};
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding: ${effectiveChipPadding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .entity-card--single-row .entity-card__title {
          min-width: 0;
        }

        .entity-card__chip--state {
          color: var(--primary-text-color);
        }

        ha-card.entity-card--select-open {
          overflow: visible;
        }

        .entity-card__select-picker-shell-host {
          min-width: 0;
          width: 100%;
        }

        .entity-card__select-picker-shell {
          backface-visibility: hidden;
          overflow: hidden;
          will-change: max-height, opacity;
        }

        .entity-card__select-picker-inner {
          backface-visibility: hidden;
          display: grid;
          will-change: opacity, transform;
        }

        .entity-card__select-picker-shell--entering {
          animation: entity-card-select-shell-expand var(--entity-card-select-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          transform-origin: top center;
        }

        .entity-card__select-picker-shell--entering .entity-card__select-picker-inner {
          animation: entity-card-select-panel-content-in var(--entity-card-select-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          transform-origin: top center;
        }

        .entity-card__select-picker-shell--leaving {
          animation: entity-card-select-shell-collapse var(--entity-card-select-panel-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
          pointer-events: none;
          transform-origin: top center;
        }

        .entity-card__select-picker-shell--leaving .entity-card__select-picker-inner {
          animation: entity-card-select-panel-content-out var(--entity-card-select-panel-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
          transform-origin: top center;
        }

        .entity-card__select-picker {
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--accent-color, var(--primary-color)) 8%, color-mix(in srgb, var(--primary-text-color) 3%, transparent)) 0%, color-mix(in srgb, var(--primary-text-color) 2%, transparent) 100%);
          border: 1px solid color-mix(in srgb, var(--accent-color, var(--primary-color)) 18%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: calc(${styles.card.border_radius} - 8px);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent),
            0 14px 28px color-mix(in srgb, var(--accent-color, var(--primary-color)) 12%, rgba(0, 0, 0, 0.18));
          display: grid;
          gap: 10px;
          margin-top: 2px;
          overflow: hidden;
          padding: 10px;
          transform-origin: top center;
        }

        .entity-card__select-picker-head {
          align-items: center;
          display: flex;
          gap: 8px;
          justify-content: space-between;
          min-width: 0;
        }

        .entity-card__select-picker-kicker {
          color: var(--secondary-text-color);
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .entity-card__select-picker-close {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: 28px;
          justify-content: center;
          margin: 0;
          padding: 0;
          width: 28px;
        }

        .entity-card__select-picker-close ha-icon {
          --mdc-icon-size: 18px;
        }

        .entity-card__select-options {
          display: grid;
          gap: 8px;
          max-height: min(240px, 42vh);
          overflow: auto;
          overscroll-behavior: contain;
          padding-right: 2px;
        }

        .entity-card__select-option {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border-radius: 14px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: grid;
          font: inherit;
          gap: 10px;
          grid-template-columns: auto minmax(0, 1fr) auto;
          min-height: 42px;
          padding: 10px 12px;
          text-align: left;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
          width: 100%;
        }

        .entity-card__select-option:hover,
        .entity-card__select-option:focus-visible {
          background: color-mix(in srgb, var(--select-option-accent, var(--primary-color)) 10%, color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border-color: color-mix(in srgb, var(--select-option-accent, var(--primary-color)) 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          outline: none;
        }

        .entity-card__select-option.is-active {
          background: color-mix(in srgb, var(--select-option-accent, var(--primary-color)) 14%, color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border-color: color-mix(in srgb, var(--select-option-accent, var(--primary-color)) 34%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          box-shadow: 0 8px 18px color-mix(in srgb, var(--select-option-accent, var(--primary-color)) 14%, rgba(0, 0, 0, 0.12));
        }

        .entity-card__select-option-indicator {
          background: color-mix(in srgb, var(--primary-text-color) 16%, transparent);
          border-radius: 999px;
          height: 8px;
          width: 8px;
        }

        .entity-card__select-option.is-active .entity-card__select-option-indicator {
          background: var(--select-option-accent, var(--primary-color));
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--select-option-accent, var(--primary-color)) 18%, transparent);
        }

        .entity-card__select-option-label {
          font-size: 0.88rem;
          font-weight: 600;
          line-height: 1.25;
          min-width: 0;
        }

        .entity-card__select-option-check {
          --mdc-icon-size: 18px;
          color: var(--select-option-accent, var(--primary-color));
        }

        @keyframes entity-card-select-shell-expand {
          from {
            max-height: 0;
            opacity: 0;
          }
          to {
            max-height: 320px;
            opacity: 1;
          }
        }

        @keyframes entity-card-select-shell-collapse {
          from {
            max-height: 320px;
            opacity: 1;
          }
          to {
            max-height: 0;
            opacity: 0;
          }
        }

        @keyframes entity-card-select-panel-content-in {
          from {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes entity-card-select-panel-content-out {
          from {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          to {
            opacity: 0;
            transform: translateY(-6px) scaleY(0.98);
          }
        }

        .entity-card__select-picker-shell--entering .entity-card__select-option {
          animation: entity-card-select-option-in calc(var(--entity-card-select-panel-duration) * 0.82) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .entity-card__select-picker-shell--entering .entity-card__select-option:nth-child(1) { animation-delay: 70ms; }
        .entity-card__select-picker-shell--entering .entity-card__select-option:nth-child(2) { animation-delay: 95ms; }
        .entity-card__select-picker-shell--entering .entity-card__select-option:nth-child(3) { animation-delay: 120ms; }
        .entity-card__select-picker-shell--entering .entity-card__select-option:nth-child(4) { animation-delay: 145ms; }
        .entity-card__select-picker-shell--entering .entity-card__select-option:nth-child(5) { animation-delay: 170ms; }
        .entity-card__select-picker-shell--entering .entity-card__select-option:nth-child(n+6) { animation-delay: 195ms; }

        @keyframes entity-card-select-option-in {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .entity-card--select-open .entity-card__content {
          align-content: start;
        }

        .entity-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: ${narrowCard ? "8px" : "10px"};
          justify-content: center;
        }

        .entity-card__actions--entering {
          animation: entity-card-fade-up calc(var(--entity-card-content-duration) * 0.94) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 110ms;
        }

        .entity-card__control {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: ${effectiveControlSize};
          justify-content: center;
          line-height: 0;
          margin: 0;
          min-width: ${effectiveControlSize};
          outline: none;
          padding: 0;
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease, color 180ms ease;
          will-change: transform;
          width: ${effectiveControlSize};
        }

        @keyframes entity-card-content-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.02);
          }
          72% {
            transform: scale(1.008);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes entity-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes entity-card-bubble-bloom {
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

        @keyframes entity-card-bubble-bounce {
          0% {
            transform: scale(1);
          }
          48% {
            transform: scale(1.12);
          }
          72% {
            transform: scale(1.04);
          }
          100% {
            transform: scale(1);
          }
        }

        .entity-card__control ha-icon {
          --mdc-icon-size: calc(${effectiveControlSize} * 0.46);
          display: inline-flex;
          height: calc(${effectiveControlSize} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${effectiveControlSize} * 0.46);
        }

        .entity-card__empty-title {
          font-size: 15px;
          font-weight: 700;
        }

        .entity-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }

        .entity-card--empty {
          display: grid;
          gap: 8px;
          padding: 16px;
        }

        @media (max-width: 420px) {
          .entity-card__hero {
            gap: 10px;
            grid-template-columns: min(${effectiveIconSize}, 52px) minmax(0, 1fr);
          }

          .entity-card__icon {
            height: min(${effectiveIconSize}, 52px);
            width: min(${effectiveIconSize}, 52px);
          }
        }

        ${animations.enabled ? "" : `
        ha-card,
        .entity-card,
        .entity-card * {
          animation: none !important;
          transition: none !important;
        }
        `}
      </style>
      <ha-card
        class="entity-card ${isActive ? "is-on" : "is-off"} ${isCompactLayout ? "entity-card--compact" : ""} ${showCopyBlock ? "entity-card--with-copy" : ""} ${singleRowLayout ? "entity-card--single-row" : ""} ${isSelectEntity ? "entity-card--select" : ""} ${canRunBodyTap ? "entity-card--clickable" : ""}"
        style="--accent-color:${escapeHtml(accentColor)};"
        ${canRunBodyTap ? 'data-entity-action="body"' : ""}
      >
        <div class="entity-card__content ${shouldAnimateEntrance ? "entity-card__content--entering" : ""}">
          <div class="entity-card__hero ${shouldAnimateEntrance ? "entity-card__hero--entering" : ""}">
            <button
              type="button"
              class="entity-card__icon ${shouldAnimateEntrance ? "entity-card__icon--entering" : ""} ${canRunIconTap ? "entity-card__icon--clickable" : ""}"
              ${canRunIconTap ? 'data-entity-action="icon"' : ""}
              aria-label="${escapeHtml(canRunIconTap || canRunBodyTap ? "Accion principal" : title)}"
            >
              ${entityPicture
                ? `<img class="entity-card__picture" src="${escapeHtml(entityPicture)}" alt="" loading="lazy" />`
                : `<ha-icon icon="${escapeHtml(icon)}"></ha-icon>`}
              ${showUnavailableBadge ? `<span class="entity-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${showCopyBlock
              ? `
                <div class="entity-card__copy ${shouldAnimateEntrance ? "entity-card__copy--entering" : ""}">
                  ${showCopyHeader
                    ? `
                      <div class="entity-card__copy-header">
                        ${showTitle ? `<div class="entity-card__title">${escapeHtml(title)}</div>` : ""}
                        ${placeStateChipOnTitleRow ? `
                          <div class="entity-card__copy-header-chip">
                            ${stateChip}
                          </div>
                        ` : ""}
                      </div>
                    `
                    : ""}
                  ${chips.length ? `<div class="entity-card__chips">${chips.join("")}</div>` : ""}
                </div>
              `
              : ""}
          </div>

          ${isSelectEntity ? '<div class="entity-card__select-picker-shell-host" data-select-picker-shell></div>' : ""}

          ${
            quickActions.length
              ? `
                <div class="entity-card__actions ${shouldAnimateEntrance ? "entity-card__actions--entering" : ""}">
                  ${quickActions
                    .map((action, index) => `
                      <button
                        type="button"
                        class="entity-card__control"
                        data-entity-action="quick"
                        data-index="${index}"
                        aria-label="${escapeHtml(action.label || action.type || "Accion")}"
                        title="${escapeHtml(action.label || action.type || "Accion")}"
                      >
                        <ha-icon icon="${escapeHtml(action.icon || "mdi:flash")}"></ha-icon>
                      </button>
                    `)
                    .join("")}
                </div>
              `
              : ""
          }
        </div>
      </ha-card>
    `;

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 120);
    }

    if (isSelectEntity) {
      this._syncSelectPickerHostState(this._selectPickerOpen);
      if (this._selectPickerOpen && !this._selectPickerAnimating) {
        this._refreshSelectPickerContent(state, accentColor);
      }
    }
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaEntityCard);
}

class NodaliaEntityCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showAnimationSection = false;
    this._showTapActionsSection = false;
    this._showStyleSection = false;
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
  }

  _attachEditorShadowListeners() {
    if (this._editorShadowListenersAttached || !this.shadowRoot) {
      return;
    }
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this._editorShadowListenersAttached = true;
  }

  _detachEditorShadowListeners() {
    if (!this._editorShadowListenersAttached || !this.shadowRoot) {
      return;
    }
    this.shadowRoot.removeEventListener("input", this._onShadowInput);
    this.shadowRoot.removeEventListener("change", this._onShadowInput);
    this.shadowRoot.removeEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.removeEventListener("click", this._onShadowClick);
    this._editorShadowListenersAttached = false;
  }

  connectedCallback() {
    this._attachEditorShadowListeners();
    window.NodaliaUtils?.bindEditorDialogLayoutFix?.(this);
  }

  disconnectedCallback() {
    this._detachEditorShadowListeners();
    window.NodaliaUtils?.releaseEditorDialogLayoutFix?.(this);
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

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._render();
    this._restoreFocusState(focusState);
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorStatesSignature(hass, this._config?.language);
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

        if (!this.isConnected || !this._hass || !this.shadowRoot) {
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
    this._watchEditorControlTag("ha-entity-picker");
    this._watchEditorControlTag("ha-selector");
    this._watchEditorControlTag("ha-icon-picker");
  }

  _getEntityOptions(path = "entity") {
    const sortTag = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const options = Object.entries(this._hass?.states || {})
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
        left.label.localeCompare(right.label, sortTag, { sensitivity: "base" })
        || left.value.localeCompare(right.value, sortTag, { sensitivity: "base" })
      ));

    const currentValue = String(getByPath(this._config, path) || "").trim();
    if (currentValue && !options.some(option => option.value === currentValue)) {
      options.unshift({
        value: currentValue,
        label: currentValue,
        displayLabel: currentValue,
      });
    }

    return options;
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
      ? `[data-field="${escapeSelectorValue(dataset.field)}"]`
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

  _emitConfig() {
    const focusState = this._captureFocusState();
    const nextConfig = deepClone(this._config);
    this._config = normalizeConfig(compactConfig(nextConfig));
    this._render();
    this._restoreFocusState(focusState);
    fireEvent(this, "config-changed", {
      config: compactConfig(window.NodaliaUtils.stripEqualToDefaults(nextConfig, DEFAULT_CONFIG) ?? {}),
    });
  }

  _setEditorConfig() {
    this._config = normalizeConfig(compactConfig(this._config));
  }

  _setFieldValue(path, value) {
    if (value === undefined || value === null || value === "") {
      deleteByPath(this._config, path);
      return;
    }

    setByPath(this._config, path, value);
  }

  _readFieldValue(input) {
    const valueType = input.dataset.valueType || "string";

    switch (valueType) {
      case "boolean":
        return Boolean(input.checked);
      case "color":
        return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
      case "csv": {
        const values = String(input.value || "")
          .split(",")
          .map(item => item.trim().toLowerCase())
          .filter(Boolean);
        return values.length ? values : "";
      }
      default:
        return input.value;
    }
  }

  _moveAction(index, direction) {
    const nextIndex = index + direction;
    if (
      !Array.isArray(this._config.quick_actions) ||
      nextIndex < 0 ||
      nextIndex >= this._config.quick_actions.length
    ) {
      return;
    }

    const [action] = this._config.quick_actions.splice(index, 1);
    this._config.quick_actions.splice(nextIndex, 0, action);
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement);

    if (!input?.dataset?.field) {
      return;
    }

    event.stopPropagation();

    const nextValue = this._readFieldValue(input);
    this._setFieldValue(input.dataset.field, nextValue);
    this._setEditorConfig();

    if (event.type === "change") {
      this._emitConfig();
    }
  }

  _onShadowValueChanged(event) {
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
    if (typeof control.dataset?.value === "string") {
      control.dataset.value = String(nextValue || "");
    }

    const field = control.dataset.field;
    const previousEntity = field === "entity" ? String(this._config?.entity || "").trim() : "";
    this._setFieldValue(field, nextValue);
    if (field === "entity") {
      window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass, { previousEntity });
    }
    this._setEditorConfig();
    this._emitConfig();
  }

  _onShadowClick(event) {
    const toggleButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorToggle);

    if (toggleButton) {
      event.preventDefault();
      event.stopPropagation();

      if (toggleButton.dataset.editorToggle === "styles") {
        this._showStyleSection = !this._showStyleSection;
        this._render();
      } else if (toggleButton.dataset.editorToggle === "animations") {
        this._showAnimationSection = !this._showAnimationSection;
        this._render();
      } else if (toggleButton.dataset.editorToggle === "tap_actions") {
        this._showTapActionsSection = !this._showTapActionsSection;
        this._render();
      }
      return;
    }

    const button = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorAction);

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const action = button.dataset.editorAction;
    const index = Number(button.dataset.index);

    if (!Array.isArray(this._config.quick_actions)) {
      this._config.quick_actions = [];
    }

    switch (action) {
      case "add-action":
        this._config.quick_actions.push({
          icon: "mdi:flash",
          type: "toggle",
          label: "",
          entity: "",
          service: "",
          service_data: "",
        });
        this._emitConfig();
        break;
      case "remove-action":
        if (Number.isInteger(index)) {
          this._config.quick_actions.splice(index, 1);
          this._emitConfig();
        }
        break;
      case "move-action-up":
        if (Number.isInteger(index)) {
          this._moveAction(index, -1);
          this._emitConfig();
        }
        break;
      case "move-action-down":
        if (Number.isInteger(index)) {
          this._moveAction(index, 1);
          this._emitConfig();
        }
        break;
      default:
        break;
    }
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
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          type="${escapeHtml(inputType)}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(valueType)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        />
      </label>
    `;
  }

  _renderTextareaField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <textarea data-field="${escapeHtml(field)}" ${placeholder}>${escapeHtml(inputValue)}</textarea>
      </label>
    `;
  }

  _renderColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("ed.entity.custom_color");
    const fallbackValue = options.fallbackValue || getEditorColorFallbackValue(field);
    const currentValue = value === undefined || value === null || value === ""
      ? fallbackValue
      : String(value);
    const colorModel = getEditorColorModel(currentValue, fallbackValue);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="${escapeHtml(tColorCustom)}">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="color"
              data-alpha="${escapeHtml(String(colorModel.alpha))}"
              value="${escapeHtml(colorModel.hex)}"
              aria-label="${escapeHtml(tLabel)}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-field="${escapeHtml(field)}"
          data-value-type="boolean"
          ${checked ? "checked" : ""}
        />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(tLabel)}</span>
      </label>
    `;
  }

  _renderSelectField(label, field, value, options, renderOptions = {}) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field ${renderOptions.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options
            .map(option => `
              <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
                ${escapeHtml(this._editorLabel(option.label))}
              </option>
            `)
            .join("")}
        </select>
      </label>
    `;
  }

  _renderEntityPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
        ></div>
      </div>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <ha-icon-picker
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        ></ha-icon-picker>
      </div>
    `;
  }

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    if (customElements.get("ha-entity-picker") || customElements.get("ha-selector")) {
      window.NodaliaUtils.mountEntityPickerHost(host, {
        hass: this._hass,
        field: host.dataset.field || "entity",
        value: host.dataset.value || "",
        onShadowInput: this._onShadowInput,
        onShadowValueChanged: this._onShadowValueChanged,
        copyDatasetFromHost: true,
      });
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    const control = document.createElement("select");
    this._getEntityOptions(field).forEach(option => {
      const optionElement = document.createElement("option");
      optionElement.value = option.value;
      optionElement.textContent = option.displayLabel;
      control.appendChild(optionElement);
    });
    control.addEventListener("change", this._onShadowInput);

    control.dataset.field = field;
    control.dataset.value = nextValue;

    if ("hass" in control) {
      control.hass = this._hass;
    }

    if ("value" in control) {
      control.value = nextValue;
    }

    host.replaceChildren(control);
  }

  _renderQuickActions(config) {
    if (!Array.isArray(config.quick_actions) || !config.quick_actions.length) {
      return `
        <div class="editor-empty">${escapeHtml(this._editorLabel("ed.entity.quick_actions_empty"))}</div>
      `;
    }

    return config.quick_actions
      .map((action, index) => {
        const actionType = action.type || "toggle";

        return `
          <div class="editor-action">
            <div class="editor-action__header">
              <div class="editor-action__title">${escapeHtml(this._editorLabel("ed.entity.action_block_title"))} ${index + 1}</div>
              <div class="editor-action__buttons">
                <button type="button" data-editor-action="move-action-up" data-index="${index}" aria-label="${escapeHtml(this._editorLabel("ed.notifications.move_up"))}">${escapeHtml(this._editorLabel("ed.notifications.move_up"))}</button>
                <button type="button" data-editor-action="move-action-down" data-index="${index}" aria-label="${escapeHtml(this._editorLabel("ed.notifications.move_down"))}">${escapeHtml(this._editorLabel("ed.notifications.move_down"))}</button>
                <button type="button" data-editor-action="remove-action" data-index="${index}" aria-label="${escapeHtml(this._editorLabel("ed.notifications.remove"))}">${escapeHtml(this._editorLabel("ed.notifications.remove"))}</button>
              </div>
            </div>
            <div class="editor-grid">
              ${this._renderIconPickerField("ed.entity.icon", `quick_actions.${index}.icon`, action.icon, {
                placeholder: "mdi:flash",
              })}
              ${this._renderTextField("ed.entity.quick_label", `quick_actions.${index}.label`, action.label, {
                placeholder: this._editorLabel("ed.entity.quick_label_placeholder"),
              })}
              ${this._renderSelectField(
                "ed.entity.action_type",
                `quick_actions.${index}.type`,
                actionType,
                [
                  { value: "toggle", label: "ed.entity.action_type_toggle" },
                  { value: "more-info", label: "ed.entity.action_type_more_info" },
                  { value: "service", label: "ed.entity.action_type_service" },
                ],
              )}
              ${this._renderEntityPickerField("ed.entity.quick_entity", `quick_actions.${index}.entity`, action.entity, {
                fullWidth: true,
              })}
              ${
                actionType === "service"
                  ? `
                    ${this._renderTextField("ed.entity.tap_service_field", `quick_actions.${index}.service`, action.service, {
                      placeholder: "light.turn_on",
                      fullWidth: true,
                    })}
                    ${this._renderTextareaField("ed.entity.tap_service_data_json", `quick_actions.${index}.service_data`, action.service_data, {
                      placeholder: '{"brightness_pct": 50}',
                    })}
                  `
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";
    const tapAction = config.tap_action || "auto";
    const iconTapActionRaw = String(config.icon_tap_action ?? "").trim();
    const iconTapSelectValue = iconTapActionRaw;
    const showIconTapService = iconTapSelectValue === "service";
    const showCardTapService = tapAction === "service";
    const showIconTapNavigate = iconTapSelectValue === "navigate";
    const showCardTapNavigate = tapAction === "navigate";
    const holdAction = config.hold_action || "none";
    const iconHoldSelect = String(config.icon_hold_action ?? "").trim();
    const showIconHoldNavigate = iconHoldSelect === "navigate";
    const showCardHoldNavigate = holdAction === "navigate";
    const showCardHoldService = holdAction === "service";
    const showIconHoldService = iconHoldSelect === "service" || (iconHoldSelect === "" && holdAction === "service");
    const doubleTapAction = config.double_tap_action || "none";
    const iconDoubleTapSelect = String(config.icon_double_tap_action ?? "").trim();
    const showIconDoubleTapNavigate = iconDoubleTapSelect === "navigate";
    const showCardDoubleTapNavigate = doubleTapAction === "navigate";
    const showCardDoubleTapService = doubleTapAction === "service";
    const showIconDoubleTapService = iconDoubleTapSelect === "service" || (iconDoubleTapSelect === "" && doubleTapAction === "service");
    const showTapServiceSecurity = showIconTapService || showCardTapService || showCardHoldService || showIconHoldService || showCardDoubleTapService || showIconDoubleTapService;
    const animations = config.animations || DEFAULT_CONFIG.animations;

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

        .editor-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .editor-grid--stacked {
          grid-template-columns: 1fr;
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

        .editor-chip-radius__options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .editor-chip-radius__option {
          align-items: center;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 12px;
          cursor: pointer;
          display: inline-flex;
          gap: 8px;
          padding: 8px 12px;
        }

        .editor-chip-radius__option:has(input:checked) {
          background: color-mix(in srgb, var(--primary-color) 10%, transparent);
          border-color: var(--primary-color);
        }

        .editor-chip-radius__option input[type="radio"] {
          accent-color: var(--primary-color);
          appearance: auto;
          margin: 0;
          min-height: auto;
          padding: 0;
          width: auto;
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

        .editor-field textarea {
          min-height: 86px;
          resize: vertical;
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

        .editor-section__actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 2px;
        }

        .editor-section__toggle-button {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          gap: 8px;
          min-height: 34px;
          padding: 0 12px;
        }

        .editor-section__toggle-button ha-icon {
          --mdc-icon-size: 16px;
        }

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }

        .editor-actions-toolbar {
          display: flex;
          justify-content: flex-start;
        }

        .editor-actions-toolbar button,
        .editor-action__buttons button {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 10px;
          color: var(--primary-text-color);
          cursor: pointer;
          font: inherit;
          min-height: 34px;
          padding: 6px 10px;
        }

        .editor-action {
          background: color-mix(in srgb, var(--primary-text-color) 3%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
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
          font-weight: 700;
        }

        .editor-action__buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .editor-empty {
          color: var(--secondary-text-color);
          font-size: 13px;
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.general_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityPickerField("ed.entity.entity_main", "entity", config.entity, {
              fullWidth: true,
            })}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, {
              placeholder: "mdi:tune",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.entity.name", "name", config.name, {
              placeholder: this._editorLabel("ed.entity.name_placeholder"),
              fullWidth: true,
            })}
            ${this._renderCheckboxField("ed.entity.use_entity_icon", "use_entity_icon", config.use_entity_icon === true)}
            ${this._renderCheckboxField("ed.entity.show_entity_picture", "show_entity_picture", config.show_entity_picture === true)}
            ${this._renderTextField("ed.entity.entity_picture", "entity_picture", config.entity_picture, {
              placeholder: "/local/ikea_gu10_bulb.png",
              fullWidth: true,
            })}
            ${this._renderIconPickerField("ed.entity.icon_active", "icon_active", config.icon_active, {
              placeholder: "mdi:door-open",
              fullWidth: true,
            })}
            ${this._renderIconPickerField("ed.entity.icon_inactive", "icon_inactive", config.icon_inactive, {
              placeholder: "mdi:door-closed",
              fullWidth: true,
            })}
            <div class="editor-section__hint editor-field--full" style="grid-column: 1 / -1; margin-top: -4px;">
              ${escapeHtml(this._editorLabel("ed.entity.icons_state_hint"))}
            </div>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.light.tap_actions_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.light.tap_actions_section_hint"))}</div>
            <div class="editor-section__actions">
              ${window.NodaliaUtils.renderEditorCollapsibleToggleHtml({
                toggleId: "tap_actions",
                expanded: this._showTapActionsSection === true,
                showLabel: this._editorLabel("ed.shared.show_tap_action_settings"),
                hideLabel: this._editorLabel("ed.shared.hide_tap_action_settings"),
                escapeHtml,
              })}
            </div>
          </div>
          ${
            this._showTapActionsSection
              ? `
          <div class="editor-grid editor-grid--stacked">
            ${this._renderSelectField(
              "ed.light.icon_tap_action",
              "icon_tap_action",
              iconTapSelectValue,
              [
                { value: "", label: "ed.entity.icon_tap_inherit" },
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "navigate", label: "ed.entity.tap_navigate" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.light.card_tap_action",
              "tap_action",
              tapAction,
              [
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "navigate", label: "ed.entity.tap_navigate" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${
              showIconTapService
                ? `
                  ${this._renderTextField("ed.entity.tap_service_field", "icon_tap_service", config.icon_tap_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.tap_service_data_json", "icon_tap_service_data", config.icon_tap_service_data, {
                    placeholder: '{"brightness_pct": 50}',
                  })}
                `
                : ""
            }
            ${
              showCardTapService
                ? `
                  ${this._renderTextField("ed.entity.tap_service_field", "tap_service", config.tap_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.tap_service_data_json", "tap_service_data", config.tap_service_data, {
                    placeholder: '{"brightness_pct": 70}',
                  })}
                `
                : ""
            }
            ${
              showTapServiceSecurity
                ? `
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
                            placeholder: "browser_mod.javascript, light.turn_on",
                            valueType: "csv",
                            fullWidth: true,
                          },
                        )
                      : ""
                  }
                `
                : ""
            }
            ${
              showIconTapNavigate
                ? this._renderTextField("ed.entity.navigation_path", "icon_navigation_path", config.icon_navigation_path, {
                    placeholder: "/home-page/details",
                    fullWidth: true,
                  })
                : ""
            }
            ${
              showCardTapNavigate
                ? this._renderTextField("ed.entity.navigation_path", "navigation_path", config.navigation_path, {
                    placeholder: "/home-page/matt-details",
                    fullWidth: true,
                  })
                : ""
            }
            ${
              iconTapSelectValue === "url"
                ? `
                  ${this._renderTextField("ed.entity.tap_url_field", "icon_tap_url", config.icon_tap_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.tap_new_tab", "icon_tap_new_tab", config.icon_tap_new_tab === true)}
                `
                : ""
            }
            ${
              tapAction === "url"
                ? `
                  ${this._renderTextField("ed.entity.tap_url_field", "tap_url", config.tap_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.tap_new_tab", "tap_new_tab", config.tap_new_tab === true)}
                `
                : ""
            }
            <div class="editor-section__hint editor-field--full" style="margin-top: 8px;">${escapeHtml(this._editorLabel("ed.light.hold_actions_section_hint"))}</div>
            ${this._renderSelectField(
              "ed.light.icon_hold_action",
              "icon_hold_action",
              iconHoldSelect,
              [
                { value: "", label: "ed.entity.icon_hold_inherit" },
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "navigate", label: "ed.entity.tap_navigate" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.light.card_hold_action",
              "hold_action",
              holdAction,
              [
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "navigate", label: "ed.entity.tap_navigate" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${
              showIconHoldService
                ? `
                  ${this._renderTextField("ed.entity.hold_service_field", "icon_hold_service", config.icon_hold_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.hold_service_data_json", "icon_hold_service_data", config.icon_hold_service_data, {
                    placeholder: '{"brightness_pct": 50}',
                  })}
                `
                : ""
            }
            ${
              showCardHoldService
                ? `
                  ${this._renderTextField("ed.entity.hold_service_field", "hold_service", config.hold_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.hold_service_data_json", "hold_service_data", config.hold_service_data, {
                    placeholder: '{"brightness_pct": 70}',
                  })}
                `
                : ""
            }
            ${
              showIconHoldNavigate || (iconHoldSelect === "" && showCardHoldNavigate)
                ? this._renderTextField("ed.entity.hold_navigation_path", "icon_hold_navigation_path", config.icon_hold_navigation_path, {
                    placeholder: "/home-page/details",
                    fullWidth: true,
                  })
                : ""
            }
            ${
              showCardHoldNavigate
                ? this._renderTextField("ed.entity.hold_navigation_path", "hold_navigation_path", config.hold_navigation_path, {
                    placeholder: "/home-page/matt-details",
                    fullWidth: true,
                  })
                : ""
            }
            ${
              iconHoldSelect === "url" || (iconHoldSelect === "" && holdAction === "url")
                ? `
                  ${this._renderTextField("ed.entity.hold_url_field", "icon_hold_url", config.icon_hold_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.hold_new_tab", "icon_hold_new_tab", config.icon_hold_new_tab === true)}
                `
                : ""
            }
            ${
              holdAction === "url"
                ? `
                  ${this._renderTextField("ed.entity.hold_url_field", "hold_url", config.hold_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.hold_new_tab", "hold_new_tab", config.hold_new_tab === true)}
                `
                : ""
            }
            <div class="editor-section__hint editor-field--full" style="margin-top: 8px;">${escapeHtml(this._editorLabel("ed.light.double_tap_actions_section_hint"))}</div>
            ${this._renderSelectField(
              "ed.light.card_double_tap_action",
              "double_tap_action",
              doubleTapAction,
              [
                { value: "none", label: "ed.entity.tap_none" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "navigate", label: "ed.entity.tap_navigate" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
              ],
              { fullWidth: true },
            )}
          </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.entity.content_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.content_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.entity.compact_mode",
              "compact_layout_mode",
              config.compact_layout_mode || "auto",
              [
                { value: "auto", label: "ed.entity.compact_auto" },
                { value: "always", label: "ed.entity.compact_always" },
                { value: "never", label: "ed.entity.compact_never" },
              ],
            )}
            ${this._renderCheckboxField("ed.entity.show_state", "show_state", config.show_state !== false)}
            ${this._renderSelectField(
              "ed.entity.state_position",
              "state_position",
              config.state_position || (config.state_chip_on_title_row === true ? "right" : "below"),
              [
                { value: "below", label: "ed.entity.state_below" },
                { value: "right", label: "ed.entity.state_right" },
              ],
            )}
            ${this._renderTextField("ed.entity.number_decimals", "number_decimals", config.number_decimals, {
              placeholder: "2",
              type: "number",
            })}
            ${this._renderTextField("ed.entity.primary_attribute", "primary_attribute", config.primary_attribute, {
              placeholder: "battery_level",
            })}
            ${this._renderTextField("ed.entity.secondary_attribute", "secondary_attribute", config.secondary_attribute, {
              placeholder: "temperature",
            })}
            ${this._renderCheckboxField("ed.entity.show_primary_chip", "show_primary_chip", config.show_primary_chip !== false)}
            ${this._renderCheckboxField("ed.entity.show_secondary_chip", "show_secondary_chip", config.show_secondary_chip !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.entity.quick_actions_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.quick_actions_hint"))}</div>
            <div class="editor-section__actions">
              <button type="button" class="editor-section__toggle-button" data-editor-action="add-action">
                <ha-icon icon="mdi:plus"></ha-icon>
                <span>${escapeHtml(this._editorLabel("ed.entity.add_action"))}</span>
              </button>
            </div>
          </div>
          ${this._renderQuickActions(config)}
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.animations_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.animations_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showAnimationSection ? this._editorLabel("ed.weather.hide_animation_settings") : this._editorLabel("ed.weather.show_animation_settings"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("ed.weather.enable_animations", "animations.enabled", animations.enabled !== false)}
                  ${this._renderTextField("ed.weather.content_entrance_ms", "animations.content_duration", animations.content_duration, {
                    type: "number",
                  })}
                  ${this._renderTextField("ed.weather.button_bounce_ms", "animations.button_bounce_duration", animations.button_bounce_duration, {
                    type: "number",
                  })}
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.haptics_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.entity.enable_haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("ed.entity.fallback_vibrate", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "ed.weather.haptic_style",
              "haptics.style",
              hapticStyle,
              [
                { value: "selection", label: "ed.weather.haptic_selection" },
                { value: "light", label: "ed.weather.haptic_light" },
                { value: "medium", label: "ed.weather.haptic_medium" },
                { value: "heavy", label: "ed.weather.haptic_heavy" },
                { value: "success", label: "ed.weather.haptic_success" },
                { value: "warning", label: "ed.weather.haptic_warning" },
                { value: "failure", label: "ed.weather.haptic_failure" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.styles_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showStyleSection ? this._editorLabel("ed.weather.hide_style_settings") : this._editorLabel("ed.weather.show_style_settings"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("ed.entity.style_card_bg", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("ed.entity.style_card_border", "styles.card.border", config.styles.card.border)}
                  ${window.NodaliaUtils.renderEditorCardBorderRadiusHtml({
                    escapeHtml,
                    field: "styles.card.border_radius",
                    value: config.styles?.card?.border_radius,
                    tHeading: this._editorLabel("ed.entity.style_card_radius_presets"),
                    labels: {
                      pill: this._editorLabel("ed.entity.chip_radius_pill"),
                      soft: this._editorLabel("ed.entity.chip_radius_soft"),
                      round: this._editorLabel("ed.entity.chip_radius_round"),
                      square: this._editorLabel("ed.entity.chip_radius_square"),
                    },
                  })}
                  <div class="editor-section__hint editor-field--full" style="margin-top: -6px;">${escapeHtml(this._editorLabel("ed.entity.style_card_radius_yaml_hint"))}</div>
                  ${this._renderTextField("ed.entity.style_card_shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("ed.entity.style_card_padding", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("ed.entity.style_card_gap", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderTextField("ed.entity.style_main_button_size", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderColorField("ed.entity.style_main_bubble_bg", "styles.icon.background", config.styles.icon.background, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
                  })}
                  ${this._renderColorField("ed.entity.style_icon_on", "styles.icon.on_color", config.styles.icon.on_color, {
                    fallbackValue: "var(--info-color, #71c0ff)",
                  })}
                  ${this._renderColorField("ed.entity.style_icon_off", "styles.icon.off_color", config.styles.icon.off_color, {
                    fallbackValue: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
                  })}
                  ${this._renderTextField("ed.entity.style_aux_button_size", "styles.control.size", config.styles.control.size)}
                  ${this._renderColorField("ed.entity.style_accent_bg", "styles.control.accent_background", config.styles.control.accent_background, {
                    fallbackValue: "rgba(113, 192, 255, 0.18)",
                  })}
                  ${this._renderColorField("ed.entity.style_accent_color", "styles.control.accent_color", config.styles.control.accent_color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderTextField("ed.entity.style_chip_height", "styles.chip_height", config.styles.chip_height)}
                  ${this._renderTextField("ed.entity.style_chip_font", "styles.chip_font_size", config.styles.chip_font_size)}
                  ${this._renderTextField("ed.entity.style_chip_padding", "styles.chip_padding", config.styles.chip_padding)}
                  ${window.NodaliaUtils.renderEditorChipBorderRadiusHtml({
                    escapeHtml,
                    field: "styles.chip_border_radius",
                    value: config.styles?.chip_border_radius,
                    tHeading: this._editorLabel("ed.entity.style_chip_radius"),
                    labels: {
                      pill: this._editorLabel("ed.entity.chip_radius_pill"),
                      soft: this._editorLabel("ed.entity.chip_radius_soft"),
                      round: this._editorLabel("ed.entity.chip_radius_round"),
                      square: this._editorLabel("ed.entity.chip_radius_square"),
                    },
                  })}
                  ${this._renderTextField("ed.entity.style_title_size", "styles.title_size", config.styles.title_size)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="entity"]')
      .forEach(host => this._mountEntityPicker(host));

    this.shadowRoot
      .querySelectorAll("ha-icon-picker[data-field]")
      .forEach(control => {
        control.hass = this._hass;
        control.value = control.dataset.value || "";
        control.addEventListener("value-changed", this._onShadowValueChanged);
      });

    this._ensureEditorControlsReady();
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaEntityCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Entity Card",
  description: "Flexible entity card for state, details, and quick actions.",
  preview: true,
});
