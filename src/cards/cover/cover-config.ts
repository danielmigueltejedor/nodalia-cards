// @ts-nocheck -- merged Lovelace YAML is projected into the runtime cover config.
import { deepClone, isObject, mergeConfig, normalizeTextKey } from "./cover-runtime";

export const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  layout: "compact",
  icon: "",
  show_state: false,
  show_position_chip: true,
  show_tilt_chip: true,
  show_position_slider: true,
  show_tilt_slider: true,
  show_stop: true,
  compact_layout_mode: "auto",
  open_close_icons: "auto",
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
      position: true,
      tilt: true,
    },
  },
  animations: {
    enabled: true,
    icon_animation: true,
    power_duration: 600,
    controls_duration: 600,
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
      on_color: "var(--warning-color, #fec700)",
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
    slider_color: "var(--warning-color, #fec700)",
  },
};

export const STUB_CONFIG = {
  entity: "cover.salon",
  name: "Salon",
};

export function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  return String(value || "").split(",").map(item => item.trim()).filter(Boolean);
}

export function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  config.layout = normalizeTextKey(config.layout) === "circular" ? "circular" : "compact";
  config.compact_layout_mode = ["auto", "always", "never"].includes(config.compact_layout_mode)
    ? config.compact_layout_mode
    : "auto";
  const openCloseIcons = normalizeTextKey(config.open_close_icons) || "auto";
  config.open_close_icons = ["auto", "vertical", "horizontal"].includes(openCloseIcons) ? openCloseIcons : "auto";
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? { ...DEFAULT_CONFIG.security, ...(isObject(config.security) ? config.security : {}) };
  config.security.allowed_services = normalizeList(config.security?.allowed_services);
  config.security.allowed_service_domains = normalizeList(config.security?.allowed_service_domains);
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
    }, rawConfig?.tap_action ?? config.tap_action, "toggle");
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
      actionKey: "hold_action",
      serviceKey: "hold_service",
      serviceDataKey: "hold_service_data",
      serviceTargetKey: "hold_service_target",
      urlKey: "hold_url",
      navigationKey: "hold_navigation_path",
      newTabKey: "hold_new_tab",
    }, rawConfig?.hold_action ?? config.hold_action, "more-info");
    applyTap(config, {
      actionKey: "icon_hold_action",
      serviceKey: "icon_hold_service",
      serviceDataKey: "icon_hold_service_data",
      serviceTargetKey: "icon_hold_service_target",
      urlKey: "icon_hold_url",
      navigationKey: "icon_hold_navigation_path",
      newTabKey: "icon_hold_new_tab",
    }, rawConfig?.icon_hold_action ?? config.icon_hold_action, "");
  }
  if (String(config.icon_tap_action || "").trim() === "") {
    config.icon_tap_action = "";
  }
  if (String(config.icon_hold_action || "").trim() === "") {
    config.icon_hold_action = "";
  }
  config.navigation_path = String(config.navigation_path ?? "").trim();
  config.hold_navigation_path = String(config.hold_navigation_path ?? "").trim();
  config.icon_navigation_path = String(config.icon_navigation_path ?? "").trim();
  config.icon_hold_navigation_path = String(config.icon_hold_navigation_path ?? "").trim();
  if (config.tap_action === "navigate" && !config.navigation_path && config.tap_url) {
    config.navigation_path = config.tap_url;
  }
  if (config.hold_action === "navigate" && !config.hold_navigation_path && config.hold_url) {
    config.hold_navigation_path = config.hold_url;
  }
  config.styles = window.NodaliaUtils?.sanitizeStyleTree?.(config.styles, DEFAULT_CONFIG.styles)
    ?? deepClone(DEFAULT_CONFIG.styles);
  return config;
}
