// @ts-nocheck -- merged Lovelace YAML is projected into the runtime fan config.
import { LEGACY_ICON_OFF_COLOR_VALUES } from "./fan-constants";
import { isObject, mergeConfig, normalizeTextKey } from "./fan-runtime";

export const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  layout: "compact",
  icon: "",
  entity_picture: "",
  show_entity_picture: false,
  show_state: false,
  show_percentage_chip: true,
  show_mode_chip: true,
  show_slider: true,
  show_oscillation: true,
  show_preset_modes: true,
  hidden_preset_modes: [],
  compact_layout_mode: "auto",
  tap_action: "toggle",
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
  security: {
    strict_service_actions: true,
    allowed_services: [],
    allowed_service_domains: [],
  },
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
    scrolls: {
      percentage: true,
    },
  },
  animations: {
    enabled: true,
    icon_animation: true,
    power_duration: 600,
    controls_duration: 600,
    preset_duration: 800,
    button_bounce_duration: 320,
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
      size: "38px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      on_color: "var(--info-color, #71c0ff)",
      off_color: "var(--primary-text-color)",
    },
    control: {
      size: "36px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(113, 192, 255, 0.2)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    title_size: "12px",
    slider_wrap_height: "44px",
    slider_height: "22px",
    slider_thumb_size: "22px",
    slider_color: "var(--info-color, #71c0ff)",
  },
};

export const STUB_CONFIG = {
  entity: "fan.salon",
  name: "Salon",
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

export function migrateLegacyIconOffColor(iconStyles, canonicalOffColor) {
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

export function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  config.layout = normalizeTextKey(config.layout) === "circular" ? "circular" : "compact";
  const normalizeList = value => (
    Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",")
        : []
  )
    .map(item => String(item || "").trim())
    .filter(Boolean);

  config.hidden_preset_modes = normalizeList(config.hidden_preset_modes);

  migrateLegacyIconOffColor(config.styles?.icon, DEFAULT_CONFIG.styles.icon.off_color);

  const actionFields = [
    { action: "tap_action", service: "tap_service", data: "tap_service_data", target: "tap_service_target", url: "tap_url", navigation: "navigation_path", newTab: "tap_new_tab", fallback: "toggle" },
    { action: "icon_tap_action", service: "icon_tap_service", data: "icon_tap_service_data", target: "icon_tap_service_target", url: "icon_tap_url", navigation: "icon_navigation_path", newTab: "icon_tap_new_tab", fallback: "" },
    { action: "hold_action", service: "hold_service", data: "hold_service_data", target: "hold_service_target", url: "hold_url", navigation: "hold_navigation_path", newTab: "hold_new_tab", fallback: "more-info" },
    { action: "icon_hold_action", service: "icon_hold_service", data: "icon_hold_service_data", target: "icon_hold_service_target", url: "icon_hold_url", navigation: "icon_hold_navigation_path", newTab: "icon_hold_new_tab", fallback: "" },
    { action: "double_tap_action", service: "double_tap_service", data: "double_tap_service_data", target: "double_tap_service_target", url: "double_tap_url", navigation: "double_tap_navigation_path", newTab: "double_tap_new_tab", fallback: "none" },
    { action: "icon_double_tap_action", service: "icon_double_tap_service", data: "icon_double_tap_service_data", target: "icon_double_tap_service_target", url: "icon_double_tap_url", navigation: "icon_double_tap_navigation_path", newTab: "icon_double_tap_new_tab", fallback: "" },
  ];
  const applyTap = window.NodaliaUtils?.applyCardTapActionField?.bind(window.NodaliaUtils);
  const allowedActions = new Set(["auto", "toggle", "more-info", "service", "navigate", "url", "none"]);
  const serializeActionObject = value => (
    isObject(value) ? JSON.stringify(value) : String(value ?? "").trim()
  );
  actionFields.forEach(fields => {
    if (typeof applyTap === "function") {
      applyTap(config, {
        actionKey: fields.action,
        serviceKey: fields.service,
        serviceDataKey: fields.data,
        serviceTargetKey: fields.target,
        urlKey: fields.url,
        navigationKey: fields.navigation,
        newTabKey: fields.newTab,
      }, rawConfig?.[fields.action] ?? config[fields.action], fields.fallback);
    }
    const rawAction = String(config[fields.action] ?? "").trim().toLowerCase();
    config[fields.action] = rawAction
      ? (allowedActions.has(rawAction) ? rawAction : fields.fallback)
      : fields.fallback;
    config[fields.service] = String(config[fields.service] ?? "").trim();
    config[fields.data] = serializeActionObject(config[fields.data]);
    config[fields.target] = serializeActionObject(config[fields.target]);
    config[fields.url] = String(config[fields.url] ?? "").trim();
    config[fields.navigation] = String(config[fields.navigation] ?? "").trim();
    config[fields.newTab] = config[fields.newTab] === true;
    if (config[fields.action] === "navigate" && !config[fields.navigation] && config[fields.url]) {
      config[fields.navigation] = config[fields.url];
    }
  });
  config.entity_picture = String(config.entity_picture ?? "").trim();
  config.show_entity_picture = config.show_entity_picture === true;
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? { ...DEFAULT_CONFIG.security, ...(isObject(config.security) ? config.security : {}) };
  config.styles = getSafeStyles(config.styles);

  return config;
}
