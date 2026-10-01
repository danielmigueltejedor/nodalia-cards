import {
  LEGACY_CLIMATE_DIAL_BACKGROUND,
  LEGACY_CLIMATE_DIAL_OFF_COLOR,
  LEGACY_CLIMATE_DIAL_TRACK_COLOR,
  LEGACY_CLIMATE_ICON_OFF_COLORS,
} from "./climate-constants";
import { isObject, mergeConfig, normalizeTextKey } from "./climate-runtime";
import { normalizeSetpointScheduleWeekStartsOn } from "./climate-schedule";
import type { ClimateConfig } from "./climate-types";
import { normalizeControlStyles } from "../../shared/control-config";
import { parseFiniteNumericValue } from "../../shared/numeric-values";
export { getStubEntityId, applyStubEntity } from "../../shared/editor-entity-helpers";

export const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  layout: "circular",
  icon: "",
  entity_picture: "",
  show_entity_picture: false,
  show_state_chip: true,
  show_current_temperature_chip: true,
  show_humidity_chip: true,
  show_mode_buttons: true,
  show_step_controls: true,
  show_schedule_button: true,
  show_unavailable_badge: true,
  setpoint_schedule_webhook: "",
  setpoint_schedule_helper: "",
  /** `"monday"` (default) or `"sunday"` — first row in the schedule agenda. */
  setpoint_schedule_week_starts_on: "monday",
  security: {
    allow_webhooks_for_non_admin: false,
    strict_service_actions: true,
    allowed_services: [],
    allowed_service_domains: ["climate"],
  },
  tap_action: "more-info",
  hold_action: "more-info",
  double_tap_action: "none",
  display: {
    /** `"target"` (default): large dial = setpoint; secondary = current when a target exists. `"current"`: swap. */
    main_temperature: "target",
  },
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
    scrolls: {
      temperature_dial: true,
    },
  },
  animations: {
    enabled: true,
    dial_duration: 220,
    button_bounce_duration: 340,
    content_duration: 420,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "30px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "16px",
      gap: "16px",
    },
    icon: {
      size: "58px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      on_color: "var(--primary-text-color)",
      off_color: "var(--primary-text-color)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 10px",
    chip_border_radius: "999px",
    title_size: "16px",
    current_size: "16px",
    target_size: "50px",
    dial: {
      size: "280px",
      max_size: "480px",
      stroke: "18px",
      thumb_size: "24px",
      /** Inactive arc: must read on warm accent-tinted dial surfaces (not only flat `ha-card-background`). */
      track_color: "color-mix(in srgb, var(--primary-text-color) 32%, var(--divider-color))",
      background: "color-mix(in srgb, var(--primary-text-color) 5%, transparent)",
      heat_color: "#f59f42",
      cool_color: "#71c0ff",
      dry_color: "#7fd0c8",
      auto_color: "#c5a66f",
      fan_color: "#83d39c",
      off_color: "var(--primary-text-color)",
    },
    control: {
      size: "42px",
      accent_background: "rgba(113, 192, 255, 0.18)",
      accent_color: "var(--primary-text-color)",
    },
    step_control: {
      size: "50px",
    },
  },
} satisfies ClimateConfig;

export const STUB_CONFIG = {
  entity: "climate.salon",
  name: "Salon",
};

export function migrateLegacyClimateOffColors(styles: unknown): void {
  if (!isObject(styles) || !isObject(styles.icon)) return;
  const iconOff = String(styles.icon.off_color ?? "").trim();
  if (iconOff && (LEGACY_CLIMATE_ICON_OFF_COLORS.includes(iconOff) || /^var\(\s*--state-inactive-color/i.test(iconOff))) {
    styles.icon.off_color = DEFAULT_CONFIG.styles.icon.off_color;
  }
  if (isObject(styles.dial)) {
    const dialOff = String(styles.dial.off_color ?? "").trim();
    if (dialOff === LEGACY_CLIMATE_DIAL_OFF_COLOR) styles.dial.off_color = DEFAULT_CONFIG.styles.dial.off_color;
    const track = String(styles.dial.track_color ?? "").trim().replace(/\s+/g, " ");
    if (track === LEGACY_CLIMATE_DIAL_TRACK_COLOR.replace(/\s+/g, " ")) styles.dial.track_color = DEFAULT_CONFIG.styles.dial.track_color;
    const dialBg = String(styles.dial.background ?? "").trim().replace(/\s+/g, " ");
    if (dialBg === LEGACY_CLIMATE_DIAL_BACKGROUND.replace(/\s+/g, " ")) styles.dial.background = DEFAULT_CONFIG.styles.dial.background;
  }
}

export function normalizeConfig(rawConfig: unknown = {}): ClimateConfig {
  const raw = isObject(rawConfig) ? rawConfig : {};
  const defaults: Record<string, unknown> = DEFAULT_CONFIG;
  const config = mergeConfig(defaults, raw);
  const norm = (value: unknown, fallback: "more-info" | "none"): "more-info" | "none" => {
    const key = String(value ?? fallback).trim().toLowerCase();
    return key === "more-info" || key === "none" ? key : fallback;
  };
  migrateLegacyClimateOffColors(config.styles);
  const rawSecurity = isObject(config.security) ? config.security : {};
  const security = window.NodaliaUtils.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? { ...DEFAULT_CONFIG.security, ...rawSecurity };
  const list = (value: unknown, fallback: readonly string[]): string[] => Array.isArray(value)
    ? value.map((item: unknown) => String(item || "").trim().toLowerCase()).filter(Boolean) : [...fallback];
  const display = isObject(config.display) ? config.display : {};
  const haptics = isObject(config.haptics) ? config.haptics : {};
  const scrolls = isObject(haptics.scrolls) ? haptics.scrolls : {};
  const animations = isObject(config.animations) ? config.animations : {};
  return {
    ...config,
    entity: String(config.entity ?? ""),
    name: String(config.name ?? ""),
    icon: String(config.icon ?? ""),
    tap_action: norm(config.tap_action, "more-info"),
    hold_action: norm(config.hold_action, "more-info"),
    double_tap_action: norm(config.double_tap_action, "none"),
    layout: normalizeTextKey(config.layout) === "compact" ? "compact" : "circular",
    entity_picture: String(config.entity_picture ?? "").trim(),
    show_entity_picture: config.show_entity_picture === true,
    show_state_chip: config.show_state_chip !== false,
    show_current_temperature_chip: config.show_current_temperature_chip !== false,
    show_humidity_chip: config.show_humidity_chip !== false,
    show_mode_buttons: config.show_mode_buttons !== false,
    show_step_controls: config.show_step_controls !== false,
    show_schedule_button: config.show_schedule_button !== false,
    show_unavailable_badge: config.show_unavailable_badge !== false,
    setpoint_schedule_webhook: String(config.setpoint_schedule_webhook ?? "").trim(),
    setpoint_schedule_helper: String(config.setpoint_schedule_helper ?? "").trim(),
    setpoint_schedule_week_starts_on: normalizeSetpointScheduleWeekStartsOn(config.setpoint_schedule_week_starts_on),
    security: {
      ...security,
      allow_webhooks_for_non_admin: rawSecurity.allow_webhooks_for_non_admin === true,
      strict_service_actions: security.strict_service_actions === true,
      allowed_services: list(security.allowed_services, DEFAULT_CONFIG.security.allowed_services),
      allowed_service_domains: list(security.allowed_service_domains, DEFAULT_CONFIG.security.allowed_service_domains),
    },
    display: { ...display, main_temperature: normalizeTextKey(display.main_temperature) === "current" ? "current" : "target" },
    haptics: {
      ...haptics,
      enabled: haptics.enabled === true,
      style: String(haptics.style ?? DEFAULT_CONFIG.haptics.style),
      fallback_vibrate: haptics.fallback_vibrate === true,
      scrolls: { ...scrolls, temperature_dial: scrolls.temperature_dial !== false },
    },
    animations: {
      ...animations,
      enabled: animations.enabled !== false,
      dial_duration: parseFiniteNumericValue(animations.dial_duration) ?? DEFAULT_CONFIG.animations.dial_duration,
      button_bounce_duration: parseFiniteNumericValue(animations.button_bounce_duration) ?? DEFAULT_CONFIG.animations.button_bounce_duration,
      content_duration: parseFiniteNumericValue(animations.content_duration) ?? DEFAULT_CONFIG.animations.content_duration,
    },
    styles: normalizeControlStyles(config.styles, DEFAULT_CONFIG.styles),
  };
}
