// @ts-nocheck -- merged Lovelace YAML is projected into the runtime vacuum config.
import { isObject, mergeConfig, normalizeTextKey } from "./vacuum-runtime";

export const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  entity_picture: "",
  show_entity_picture: false,
  tap_action: "default",
  tap_navigation_path: "",
  icon_tap_action: "",
  hold_action: "more-info",
  icon_hold_action: "",
  hold_navigation_path: "",
  icon_hold_navigation_path: "",
  compact_layout_mode: "auto",
  show_state_chip: true,
  show_battery_chip: true,
  show_fan_speed_chip: true,
  show_mode_controls: true,
  show_fan_presets: true,
  show_return_to_base: true,
  show_stop: true,
  show_locate: true,
  fan_presets: [],
  hidden_suction_modes: [],
  hidden_mop_modes: [],
  state_entity: "",
  error_entity: "",
  battery_entity: "",
  room_mapping_entity: "",
  suction_select_entity: "",
  mop_select_entity: "",
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    icon_animation: true,
    panel_duration: 800,
    button_bounce_duration: 320,
  },
  security: {
    strict_service_actions: true,
    allowed_services: [],
    allowed_service_domains: [],
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "var(--nodalia-card-border-radius, 28px)",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "14px",
      gap: "12px",
    },
    icon: {
      size: "50px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      active_color: "#61c97a",
      washing_color: "#5aa7ff",
      drying_color: "#f1c24c",
      emptying_color: "#9b6b4a",
      returning_color: "#f6b73c",
      error_color: "var(--error-color, #ff6b6b)",
      docked_color: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
    },
    control: {
      size: "40px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(var(--rgb-primary-color), 0.18)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    title_size: "12px",
  },
};

export const STUB_CONFIG = {
  entity: "vacuum.salon",
  name: "Robot salon",
};

export function sanitizeCssValue(value, fallback) {
  const raw = String(value ?? "").trim();
  const safeFallback = String(fallback ?? "").trim();
  if (!raw) {
    return safeFallback;
  }
  if (/[\u0000-\u001f\u007f<>;"'{}]/.test(raw) || raw.includes("/*") || raw.includes("*/")) { // eslint-disable-line no-control-regex
    return safeFallback;
  }
  return raw;
}

export function getSafeStyles(styles = DEFAULT_CONFIG.styles) {
  const walk = (candidate, fallback) => {
    if (isObject(fallback)) {
      const out = {};
      const source = isObject(candidate) ? candidate : {};
      Object.keys(fallback).forEach(key => {
        out[key] = walk(source[key], fallback[key]);
      });
      return out;
    }
    if (typeof fallback === "string") {
      return sanitizeCssValue(candidate, fallback);
    }
    return candidate === undefined ? fallback : candidate;
  };
  return walk(styles, DEFAULT_CONFIG.styles);
}

export function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const normalizeList = value => (
    Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",")
        : []
  )
    .map(item => String(item || "").trim())
    .filter(Boolean);

  if (!Array.isArray(config.fan_presets)) {
    config.fan_presets = [];
  }

  config.fan_presets = config.fan_presets
    .map(item => String(item || "").trim())
    .filter(Boolean);
  config.hidden_suction_modes = normalizeList(config.hidden_suction_modes);
  config.hidden_mop_modes = normalizeList(config.hidden_mop_modes);

  const VACUUM_CARD_ACTION_KEYS = new Set(["default", "more_info", "navigate", "none"]);
  const normVacuumCardActionKey = raw => {
    const key = normalizeTextKey(String(raw ?? "").trim());
    return VACUUM_CARD_ACTION_KEYS.has(key) ? key : null;
  };
  const holdKey = normVacuumCardActionKey(config.hold_action);
  config.hold_action = holdKey || "none";
  const iconHoldRaw = String(config.icon_hold_action ?? "").trim();
  if (!iconHoldRaw) {
    config.icon_hold_action = "";
  } else {
    const iconHoldKey = normVacuumCardActionKey(iconHoldRaw);
    config.icon_hold_action = iconHoldKey || "";
  }
  config.hold_navigation_path = String(config.hold_navigation_path ?? "").trim();
  config.icon_hold_navigation_path = String(config.icon_hold_navigation_path ?? "").trim();
  config.entity_picture = String(config.entity_picture ?? "").trim();
  config.show_entity_picture = config.show_entity_picture === true;
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? { ...DEFAULT_CONFIG.security, ...(isObject(config.security) ? config.security : {}) };
  config.security.strict_service_actions = config.security.strict_service_actions === true;

  return config;
}
