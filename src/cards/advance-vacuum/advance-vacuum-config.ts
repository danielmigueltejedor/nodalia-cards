// @ts-nocheck -- merged Lovelace YAML is projected into the runtime advance-vacuum config.
import { isObject, mergeConfig } from "./advance-vacuum-runtime";
import { normalizeCustomMenuItems, normalizeRoutineItems } from "./advance-vacuum-helpers";

export const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  vacuum_platform: "auto",
  vacuum_mqtt_topic: "",
  room_tracking: {
    entity: "",
    attribute: "",
    activity_entity: "",
    auto_detect: true,
  },
  map_source: {
    camera: "",
    image: "",
  },
  calibration_source: {
    camera: true,
    entity: "",
    calibration_points: [],
  },
  map_locked: true,
  two_finger_pan: false,
  language: "auto",
  show_state_chip: true,
  show_battery_chip: true,
  show_room_labels: true,
  show_room_markers: true,
  show_header_icons: true,
  show_return_to_base: true,
  show_stop: true,
  show_locate: true,
  show_all_mode: true,
  allow_segment_mode: true,
  allow_zone_mode: true,
  allow_goto_mode: true,
  max_zone_selections: 5,
  max_repeats: 3,
  shared_cleaning_session_entity: "",
  shared_cleaning_session_webhook: "",
  suction_select_entity: "",
  mop_select_entity: "",
  mop_mode_select_entity: "",
  custom_menu: {
    label: "Base",
    icon: "mdi:home-import-outline",
    items: [],
  },
  routines: [],
  room_segments: [],
  goto_points: [],
  predefined_zones: [],
  icons: [],
  map_modes: [],
  security: {
    strict_service_actions: true,
    allow_webhooks_for_non_admin: false,
    allowed_services: [],
    allowed_service_domains: [],
  },
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    icon_animation: true,
    content_duration: 520,
    panel_duration: 420,
    button_bounce_duration: 320,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "32px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "16px",
      gap: "14px",
    },
    icon: {
      size: "64px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      active_color: "#61c97a",
      washing_color: "#5aa7ff",
      drying_color: "#f1c24c",
      emptying_color: "#9b6b4a",
      returning_color: "#f6b73c",
      error_color: "var(--error-color, #ff6b6b)",
      docked_color: "rgba(255, 255, 255, 0.56)",
    },
    chip_height: "26px",
    chip_font_size: "11px",
    chip_padding: "0 10px",
    title_size: "16px",
    map: {
      radius: "26px",
      marker_size: "34px",
      label_size: "12px",
      room_color: "rgba(97, 201, 122, 0.18)",
      room_border: "rgba(97, 201, 122, 0.55)",
      zone_color: "rgba(90, 167, 255, 0.18)",
      zone_border: "rgba(90, 167, 255, 0.72)",
      goto_color: "#f6b73c",
    },
    control: {
      size: "42px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(var(--rgb-primary-color), 0.18)",
    },
  },
};

export const STUB_CONFIG = {
  entity: "vacuum.roborock_qrevo_s",
  name: "Roborock Qrevo S",
  vacuum_platform: "auto",
};

export function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  config.custom_menu = mergeConfig(DEFAULT_CONFIG.custom_menu, config.custom_menu || {});
  config.room_tracking = mergeConfig(DEFAULT_CONFIG.room_tracking, config.room_tracking || {});
  config.room_tracking.entity = String(config.room_tracking.entity ?? "").trim();
  config.room_tracking.attribute = String(config.room_tracking.attribute ?? "").trim();
  config.room_tracking.activity_entity = String(config.room_tracking.activity_entity ?? "").trim();
  config.room_tracking.auto_detect = config.room_tracking.auto_detect !== false;
  config.vacuum_platform = String(config.vacuum_platform || "auto").trim() || "auto";
  config.vacuum_mqtt_topic = String(config.vacuum_mqtt_topic ?? "").trim().replace(/\/+$/, "");
  config.custom_menu.items = normalizeCustomMenuItems(config.custom_menu.items);
  config.routines = normalizeRoutineItems(config.routines);
  config.shared_cleaning_session_webhook = String(config.shared_cleaning_session_webhook ?? "").trim();
  config.security = {
    ...DEFAULT_CONFIG.security,
    ...(isObject(config.security) ? config.security : {}),
  };
  if (config.security.allow_webhooks_for_non_admin === undefined) {
    config.security.allow_webhooks_for_non_admin = DEFAULT_CONFIG.security.allow_webhooks_for_non_admin;
  }
  config.security.allow_webhooks_for_non_admin = config.security.allow_webhooks_for_non_admin === true;
  return config;
}
