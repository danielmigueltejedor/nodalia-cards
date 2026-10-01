import { normalizeControlStyles } from "../../shared/control-config";
import { isObject, mergeConfig } from "./fav-runtime";

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

export function normalizeConfig(rawConfig: unknown = {}) {
  const raw = isObject(rawConfig) ? rawConfig : {};
  const defaults: Record<string, unknown> = DEFAULT_CONFIG;
  const config = mergeConfig(defaults, raw);
  const styles = normalizeControlStyles(config.styles, DEFAULT_CONFIG.styles);
  styles.icon.background = window.NodaliaBubbleContrast?.normalizeNeutralBubbleBackground?.(
    styles.icon.background,
    DEFAULT_CONFIG.styles.icon.background,
  ) || styles.icon.background;
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
    }, raw.tap_action ?? config.tap_action, "auto");
  }
  const serializeActionObject = (value: unknown) => (
    isObject(value) ? JSON.stringify(value) : String(value ?? "").trim()
  );
  const fields = {
    entity: typeof config.entity === "string" ? config.entity : "",
    alarm_code_entity: typeof config.alarm_code_entity === "string" ? config.alarm_code_entity : "",
    state_attribute: typeof config.state_attribute === "string" ? config.state_attribute : "",
    security: isObject(config.security) ? config.security : {},
    styles,
    tap_action: String(config.tap_action ?? "auto").trim() || "auto",
    tap_service: String(config.tap_service ?? "").trim(),
    tap_service_data: serializeActionObject(config.tap_service_data),
    tap_service_target: serializeActionObject(config.tap_service_target),
    tap_url: String(config.tap_url ?? "").trim(),
    tap_new_tab: config.tap_new_tab === true,
  };
  const normalized: typeof fields & Record<string, unknown> = { ...config, ...fields };
  return normalized;
}
