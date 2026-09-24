// @ts-nocheck -- merged Lovelace YAML is projected into the runtime alarm panel config.
import { clamp, deepClone, mergeConfig, normalizeTextKey } from "./alarm-panel-runtime";

export const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  entity_picture: "",
  show_entity_picture: false,
  code: "",
  code_entity: "",
  show_state: true,
  show_code_input: "auto",
  /** After arming/disarming with a manual code, wait this long (ms) before showing “wrong code” if state is unchanged. */
  wrong_code_feedback_ms: 5000,
  show_disarm: true,
  show_arm_home: true,
  show_arm_away: true,
  show_arm_night: true,
  show_arm_vacation: false,
  show_custom_bypass: false,
  compact_layout_mode: "auto",
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
      border_radius: "var(--nodalia-card-border-radius, 28px)",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "14px",
      gap: "12px",
    },
    icon: {
      size: "58px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      on_color: "var(--primary-text-color)",
      off_color: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
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
    title_size: "14px",
    input_height: "42px",
  },
};

export const STUB_CONFIG = {
  entity: "alarm_control_panel.casa",
  name: "Alarm",
};

export function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  config.entity_picture = String(config.entity_picture ?? "").trim();
  config.show_entity_picture = config.show_entity_picture === true;
  const rawShowCodeInput = rawConfig && Object.prototype.hasOwnProperty.call(rawConfig, "show_code_input")
    ? rawConfig.show_code_input
    : config.show_code_input;
  if (rawShowCodeInput === true || normalizeTextKey(rawShowCodeInput) === "true" || normalizeTextKey(rawShowCodeInput) === "always") {
    config.show_code_input = true;
  } else if (rawShowCodeInput === false || normalizeTextKey(rawShowCodeInput) === "false" || normalizeTextKey(rawShowCodeInput) === "never") {
    config.show_code_input = false;
  } else {
    config.show_code_input = "auto";
  }
  const wcfb = Number(config.wrong_code_feedback_ms);
  config.wrong_code_feedback_ms = Number.isFinite(wcfb)
    ? clamp(Math.round(wcfb), 2000, 30000)
    : DEFAULT_CONFIG.wrong_code_feedback_ms;
  config.styles = window.NodaliaUtils?.sanitizeStyleTree?.(config.styles, DEFAULT_CONFIG.styles)
    ?? deepClone(DEFAULT_CONFIG.styles);
  return config;
}
