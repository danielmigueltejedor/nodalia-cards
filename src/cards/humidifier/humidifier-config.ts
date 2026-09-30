import { isObject, mergeConfig, normalizeTextKey } from "./humidifier-runtime";
import { normalizeControlActions, normalizeControlList, normalizeControlStyles, migrateControlIconOffColor } from "../../shared/control-config";
export { migrateControlIconOffColor as migrateLegacyIconOffColor } from "../../shared/control-config";
export const sanitizeCssValue = window.NodaliaUtils.sanitizeCssValue.bind(window.NodaliaUtils);

export const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  layout: "compact",
  icon: "",
  entity_picture: "",
  show_entity_picture: false,
  mode_entity: "",
  fan_mode_entity: "",
  show_state: false,
  show_target_humidity_chip: true,
  show_mode_chip: true,
  show_fan_mode_chip: true,
  show_slider: true,
  show_mode_button: true,
  show_fan_mode_button: true,
  hidden_modes: [],
  hidden_fan_modes: [],
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
      humidity: true,
    },
  },
  animations: {
    enabled: true,
    icon_animation: true,
    power_duration: 600,
    controls_duration: 600,
    panel_duration: 800,
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
      accent_background: "rgba(113, 192, 255, 0.18)",
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
  entity: "humidifier.deshumidificador",
  name: "Deshumidificador",
};

export function getSafeStyles(styles: unknown = DEFAULT_CONFIG.styles) {
  return normalizeControlStyles(styles, DEFAULT_CONFIG.styles);
}

export function normalizeConfig(rawConfig: unknown = {}) {
  // Unknown YAML overrides must remain unknown until each field is normalized.
  const defaults: Record<string, unknown> = DEFAULT_CONFIG;
  const config = mergeConfig(defaults, rawConfig);
  const layout = normalizeTextKey(config.layout) === "circular" ? "circular" : "compact";
  const sourceStyles = isObject(config.styles) ? config.styles : {};
  migrateControlIconOffColor(sourceStyles.icon, DEFAULT_CONFIG.styles.icon.off_color);
  normalizeControlActions(config, rawConfig, false);
  const security = window.NodaliaUtils.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? { ...DEFAULT_CONFIG.security, ...(isObject(config.security) ? config.security : {}) };
  return {
    ...config,
    layout,
    hidden_modes: normalizeControlList(config.hidden_modes),
    hidden_fan_modes: normalizeControlList(config.hidden_fan_modes),
    entity_picture: String(config.entity_picture ?? "").trim(),
    show_entity_picture: config.show_entity_picture === true,
    security,
    styles: getSafeStyles(config.styles),
  };
}
