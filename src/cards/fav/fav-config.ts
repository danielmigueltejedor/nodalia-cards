// @ts-nocheck -- merged Lovelace YAML is projected into the runtime fav config.
import { deepClone, isObject, mergeConfig } from "./fav-runtime";

export const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  use_entity_icon: true,
  entity_mode: "auto",
  tap_action: "auto",
  tap_service: "",
  tap_service_data: "",
  tap_service_target: "",
  tap_url: "",
  tap_new_tab: false,
  alarm_code: "",
  alarm_code_entity: "",
  alarm_show_code_input: true,
  alarm_show_disarm: true,
  alarm_show_arm_home: true,
  alarm_show_arm_away: true,
  alarm_show_arm_night: true,
  alarm_show_arm_vacation: false,
  alarm_show_custom_bypass: false,
  show_name: true,
  show_state: true,
  state_attribute: "",
  layout_mode: "auto",
  security: {
    strict_service_actions: true,
    allowed_services: [],
    allowed_service_domains: [],
  },
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "var(--nodalia-card-border-radius, 28px)",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "10px 12px",
      gap: "10px",
    },
    icon: {
      size: "38px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      on_color: "var(--info-color, #71c0ff)",
      off_color: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
    },
    chip_height: "22px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    title_size: "13px",
  },
};

export const STUB_CONFIG = {
  entity: "light.sofa",
  name: "Sofa",
  tap_action: "auto",
  show_state: false,
  layout_mode: "auto",
};

export function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  config.styles.icon.background = window.NodaliaBubbleContrast?.normalizeNeutralBubbleBackground?.(
    config.styles.icon.background,
    DEFAULT_CONFIG.styles.icon.background,
  ) || config.styles.icon.background;
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? { ...DEFAULT_CONFIG.security, ...(isObject(config.security) ? config.security : {}) };
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
  }
  const serializeActionObject = value => (
    isObject(value) ? JSON.stringify(value) : String(value ?? "").trim()
  );
  config.tap_action = String(config.tap_action ?? "auto").trim() || "auto";
  config.tap_service = String(config.tap_service ?? "").trim();
  config.tap_service_data = serializeActionObject(config.tap_service_data);
  config.tap_service_target = serializeActionObject(config.tap_service_target);
  config.tap_url = String(config.tap_url ?? "").trim();
  config.tap_new_tab = config.tap_new_tab === true;
  config.styles = window.NodaliaUtils?.sanitizeStyleTree?.(config.styles, DEFAULT_CONFIG.styles)
    ?? deepClone(DEFAULT_CONFIG.styles);
  return config;
}
