// @ts-nocheck -- merged Lovelace YAML is projected into the runtime light config.
import { LEGACY_ICON_OFF_COLOR_VALUES } from "./light-constants";
import { clamp, deepClone, isObject, mergeConfig } from "./light-runtime";
import { normalizeHexColorForLightPreset } from "./light-helpers";

export const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  entity_picture: "",
  show_entity_picture: false,
  show_state: false,
  state_position: "right",
  compact_layout_mode: "auto",
  auto_expand: true,
  show_brightness: true,
  show_slider_mode_buttons: true,
  show_quick_brightness: true,
  show_quick_temperature_presets: false,
  show_quick_color_presets: false,
  show_color_controls: true,
  show_temperature_controls: true,
  quick_brightness: [10, 35, 65, 100],
  color_presets: [
    { color: "#ffd166", label: "Warm" },
    { color: "#fff1c1", label: "Soft" },
    { color: "#4dabf7", label: "Blue" },
    { color: "#ff4d6d", label: "Pink" },
  ],
  tap_action: "toggle",
  tap_service: "",
  tap_service_data: "",
  tap_service_target: "",
  tap_url: "",
  navigation_path: "",
  tap_new_tab: false,
  icon_tap_action: "toggle",
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
      brightness: true,
      temperature: true,
      color: true,
    },
  },
  animations: {
    enabled: true,
    power_duration: 600,
    controls_duration: 600,
    mode_switch_duration: 600,
    button_bounce_duration: 320,
    mode_switch_horizontal: true,
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
      on_color: "var(--warning-color, #f6b73c)",
      off_color: "var(--primary-text-color)",
    },
    control: {
      size: "36px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(var(--rgb-primary-color), 0.18)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    title_size: "12px",
    slider_wrap_height: "56px",
    slider_height: "16px",
    slider_thumb_size: "28px",
    slider_color: "var(--primary-color)",
  },
};

export const STUB_CONFIG = {
  entity: "light.salon",
  name: "Salon",
};

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
  if (config.keep_collapsed === true) {
    config.auto_expand = false;
  }
  delete config.keep_collapsed;
  const normalizedStatePosition = String(config.state_position || "").toLowerCase();
  config.state_position = normalizedStatePosition === "below" ? "below" : "right";

  if (!Array.isArray(config.quick_brightness) || !config.quick_brightness.length) {
    config.quick_brightness = deepClone(DEFAULT_CONFIG.quick_brightness);
  }

  config.quick_brightness = config.quick_brightness
    .map(value => Number(value))
    .filter(value => Number.isFinite(value))
    .map(value => clamp(Math.round(value), 1, 100));

  if (!config.quick_brightness.length) {
    config.quick_brightness = deepClone(DEFAULT_CONFIG.quick_brightness);
  }

  const rawPresets = Array.isArray(config.color_presets) ? config.color_presets : [];
  const normalizedPresets = [];
  for (let index = 0; index < Math.min(rawPresets.length, 4); index += 1) {
    const entry = rawPresets[index];
    if (!isObject(entry)) {
      continue;
    }
    const color = normalizeHexColorForLightPreset(entry.color);
    if (!color) {
      continue;
    }
    normalizedPresets.push({
      color,
      label: String(entry.label ?? "").trim(),
    });
  }
  config.color_presets = normalizedPresets.length ? normalizedPresets : deepClone(DEFAULT_CONFIG.color_presets);

  const numericPowerDuration = Number(config.animations?.power_duration);
  const numericControlsDuration = Number(config.animations?.controls_duration);
  const numericModeSwitchDuration = Number(config.animations?.mode_switch_duration);
  const numericButtonBounceDuration = Number(config.animations?.button_bounce_duration);
  config.animations = {
    enabled: config.animations?.enabled !== false,
    power_duration: Number.isFinite(numericPowerDuration)
      ? clamp(Math.round(numericPowerDuration), 120, 4000)
      : DEFAULT_CONFIG.animations.power_duration,
    controls_duration: Number.isFinite(numericControlsDuration)
      ? clamp(Math.round(numericControlsDuration), 120, 2400)
      : DEFAULT_CONFIG.animations.controls_duration,
    mode_switch_duration: Number.isFinite(numericModeSwitchDuration)
      ? clamp(Math.round(numericModeSwitchDuration), 120, 2400)
      : DEFAULT_CONFIG.animations.mode_switch_duration,
    button_bounce_duration: Number.isFinite(numericButtonBounceDuration)
      ? clamp(Math.round(numericButtonBounceDuration), 120, 1200)
      : DEFAULT_CONFIG.animations.button_bounce_duration,
    mode_switch_horizontal: config.animations?.mode_switch_horizontal !== false,
  };

  migrateLegacyIconOffColor(config.styles?.icon, DEFAULT_CONFIG.styles.icon.off_color);

  const applyTap = window.NodaliaUtils?.applyCardTapActionField?.bind(window.NodaliaUtils);
  if (typeof applyTap === "function") {
    applyTap(config, {
      actionKey: "tap_action", serviceKey: "tap_service", serviceDataKey: "tap_service_data",
      serviceTargetKey: "tap_service_target", urlKey: "tap_url", navigationKey: "navigation_path",
      newTabKey: "tap_new_tab",
    }, rawConfig?.tap_action ?? config.tap_action, "toggle");
    applyTap(config, {
      actionKey: "icon_tap_action", serviceKey: "icon_tap_service", serviceDataKey: "icon_tap_service_data",
      serviceTargetKey: "icon_tap_service_target", urlKey: "icon_tap_url", navigationKey: "icon_navigation_path",
      newTabKey: "icon_tap_new_tab",
    }, rawConfig?.icon_tap_action ?? config.icon_tap_action, "toggle");
    applyTap(config, {
      actionKey: "hold_action", serviceKey: "hold_service", serviceDataKey: "hold_service_data",
      serviceTargetKey: "hold_service_target", urlKey: "hold_url", navigationKey: "hold_navigation_path",
      newTabKey: "hold_new_tab",
    }, rawConfig?.hold_action ?? config.hold_action, "more-info");
    applyTap(config, {
      actionKey: "icon_hold_action", serviceKey: "icon_hold_service", serviceDataKey: "icon_hold_service_data",
      serviceTargetKey: "icon_hold_service_target", urlKey: "icon_hold_url", navigationKey: "icon_hold_navigation_path",
      newTabKey: "icon_hold_new_tab",
    }, rawConfig?.icon_hold_action ?? config.icon_hold_action, "");
  }

  const serializeActionObject = value => (
    isObject(value) ? JSON.stringify(value) : String(value ?? "").trim()
  );
  const TAP_ACTIONS = new Set(["auto", "toggle", "more-info", "service", "navigate", "url", "none"]);
  const normTap = String(config.tap_action ?? "toggle").trim().toLowerCase();
  config.tap_action = TAP_ACTIONS.has(normTap) ? normTap : "toggle";
  const normIconTap = String(config.icon_tap_action ?? "toggle").trim().toLowerCase();
  config.icon_tap_action = TAP_ACTIONS.has(normIconTap) ? normIconTap : "toggle";
  config.tap_service = String(config.tap_service ?? "").trim();
  config.tap_service_data = serializeActionObject(config.tap_service_data);
  config.tap_service_target = serializeActionObject(config.tap_service_target);
  config.tap_url = String(config.tap_url ?? "").trim();
  config.navigation_path = String(config.navigation_path ?? "").trim();
  config.tap_new_tab = config.tap_new_tab === true;
  config.icon_tap_service = String(config.icon_tap_service ?? "").trim();
  config.icon_tap_service_data = serializeActionObject(config.icon_tap_service_data);
  config.icon_tap_service_target = serializeActionObject(config.icon_tap_service_target);
  config.icon_tap_url = String(config.icon_tap_url ?? "").trim();
  config.icon_navigation_path = String(config.icon_navigation_path ?? "").trim();
  config.icon_tap_new_tab = config.icon_tap_new_tab === true;

  const normHold = String(config.hold_action ?? "none").trim().toLowerCase();
  config.hold_action = TAP_ACTIONS.has(normHold) ? normHold : "none";
  const iconHoldRaw = config.icon_hold_action;
  const iconHoldStr = iconHoldRaw === undefined || iconHoldRaw === null ? "" : String(iconHoldRaw).trim();
  if (!iconHoldStr) {
    config.icon_hold_action = "";
  } else {
    const normIconHold = iconHoldStr.toLowerCase();
    config.icon_hold_action = TAP_ACTIONS.has(normIconHold) ? normIconHold : "";
  }
  config.hold_service = String(config.hold_service ?? "").trim();
  config.hold_service_data = serializeActionObject(config.hold_service_data);
  config.hold_service_target = serializeActionObject(config.hold_service_target);
  config.hold_url = String(config.hold_url ?? "").trim();
  config.hold_navigation_path = String(config.hold_navigation_path ?? "").trim();
  config.hold_new_tab = config.hold_new_tab === true;
  config.icon_hold_service = String(config.icon_hold_service ?? "").trim();
  config.icon_hold_service_data = serializeActionObject(config.icon_hold_service_data);
  config.icon_hold_service_target = serializeActionObject(config.icon_hold_service_target);
  config.icon_hold_url = String(config.icon_hold_url ?? "").trim();
  config.icon_hold_navigation_path = String(config.icon_hold_navigation_path ?? "").trim();
  config.icon_hold_new_tab = config.icon_hold_new_tab === true;
  config.entity_picture = String(config.entity_picture ?? "").trim();
  config.show_entity_picture = config.show_entity_picture === true;
  if (config.tap_action === "navigate" && !config.navigation_path && config.tap_url) {
    config.navigation_path = config.tap_url;
  }
  if (config.hold_action === "navigate" && !config.hold_navigation_path && config.hold_url) {
    config.hold_navigation_path = config.hold_url;
  }
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? { ...DEFAULT_CONFIG.security, ...(isObject(config.security) ? config.security : {}) };
  config.styles = window.NodaliaUtils?.sanitizeStyleTree?.(config.styles, DEFAULT_CONFIG.styles)
    ?? deepClone(DEFAULT_CONFIG.styles);

  return config;
}
