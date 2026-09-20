// @ts-nocheck -- merged Lovelace YAML is projected into the runtime notifications config.
import { STORAGE_KEY } from "./notifications-constants";
import { normalizeMobileContext, normalizeMobilePolicy } from "./notifications-runtime";
import {
  entityDomain,
  finiteNumber,
  mergeDeep,
  normalizeCustomNotifications,
  normalizeEntityList,
  normalizeExternalAlerts,
  normalizeNotifyServices,
  normalizeSmartEntityOverrides,
  normalizeSmartNotifications,
} from "./notifications-helpers";

export const DEFAULT_CONFIG = {
  title: "Notifications",
  language: "auto",
  icon: "mdi:bell-badge-outline",
  empty_title: "All quiet",
  empty_message: "You have no current alerts",
  max_visible: 1,
  refresh_interval: 300,
  storage_key: STORAGE_KEY,
  dismissed_entity: "",
  calendar_entities: [],
  vacuum_entities: [],
  vacuum_error_entities: [],
  fan_entities: [],
  climate_entities: [],
  humidifier_entities: [],
  media_player_entities: [],
  weather_entities: [],
  motion_entities: [],
  door_entities: [],
  window_entities: [],
  temperature_entities: [],
  humidity_entities: [],
  outdoor_temperature_entities: [],
  outdoor_humidity_entities: [],
  battery_entities: [],
  humidifier_fill_entities: [],
  humidifier_full_entities: [],
  ink_entities: [],
  custom_notifications: [],
  smart_entity_overrides: [],
  presence_entity: "",
  mobile_context: {
    only_when_away: false,
    only_when_home: false,
    quiet_hours: {
      enabled: false,
      start: "23:00",
      end: "08:00",
      allow_critical: true,
    },
  },
  external_alerts: [],
  thresholds: {
    hot_temperature: 27,
    cold_temperature: 17,
    humidity_high: 70,
    humidity_low: 30,
    rain_probability: 50,
    rain_lookahead_hours: 6,
    media_absence_minutes: 10,
    battery_low: 20,
    humidifier_fill_low: 20,
    humidifier_fill_full: 90,
    ink_low: 15,
  },
  smart_recommendations: true,
  smart_notifications: {
    hot: { title: "", message: "", tint_color: "", url: "", action_label: "", tap_action: { action: "none" } },
    cold: { title: "", message: "", tint_color: "", url: "", action_label: "", tap_action: { action: "none" } },
    humidity_high: { title: "", message: "", tint_color: "", url: "", action_label: "", tap_action: { action: "none" } },
    humidity_low: { title: "", message: "", tint_color: "", url: "", action_label: "", tap_action: { action: "none" } },
    rain: { title: "", message: "", tint_color: "", url: "", action_label: "", tap_action: { action: "none" } },
    media_left_on: { title: "", message: "", tint_color: "", url: "", action_label: "", tap_action: { action: "none" } },
    battery_low: { title: "", message: "", tint_color: "", url: "", action_label: "", tap_action: { action: "none" } },
    humidifier_fill_low: { title: "", message: "", tint_color: "", url: "", action_label: "", tap_action: { action: "none" } },
    humidifier_fill_full: { title: "", message: "", tint_color: "", url: "", action_label: "", tap_action: { action: "none" } },
    ink_low: { title: "", message: "", tint_color: "", url: "", action_label: "", tap_action: { action: "none" } },
  },
  mobile_notifications: {
    enabled: false,
    entities: [],
    services: [],
    min_severity: "warning",
    critical_alerts: false,
    default_policy: "auto",
    cooldown_minutes: 30,
    group_similar: true,
  },
  background_mobile: {
    enabled: false,
    profile_id: "default",
    webhook: "",
    chunk_size: 240,
  },
  security: {
    strict_service_actions: true,
    allowed_services: [],
    allowed_service_domains: [],
    allow_webhooks_for_non_admin: false,
  },
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
      background: "var(--ha-card-background, var(--card-background-color, rgba(32, 34, 42, 0.94)))",
      border: "1px solid var(--divider-color)",
      border_radius: "var(--nodalia-card-border-radius, 28px)",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "18px",
      gap: "14px",
    },
    icon: {
      background: "color-mix(in srgb, var(--primary-color) 18%, transparent)",
      color: "var(--primary-color)",
      size: "54px",
    },
    title_size: "22px",
    item_radius: "var(--nodalia-card-border-radius, 28px)",
    accent: "var(--primary-color)",
  },
};

export function normalizeConfig(rawConfig = {}, options = {}) {
  const config = mergeDeep(DEFAULT_CONFIG, rawConfig);
  config.calendar_entities = normalizeEntityList(config.calendar_entities, ["calendar"]);
  config.vacuum_entities = normalizeEntityList(config.vacuum_entities, ["vacuum"]);
  config.vacuum_error_entities = normalizeEntityList(config.vacuum_error_entities, ["sensor"]);
  config.fan_entities = normalizeEntityList(config.fan_entities, ["fan"]);
  config.climate_entities = normalizeEntityList(config.climate_entities, ["climate"]);
  config.humidifier_entities = normalizeEntityList(config.humidifier_entities, ["humidifier"]);
  config.media_player_entities = normalizeEntityList(config.media_player_entities, ["media_player"]);
  config.weather_entities = normalizeEntityList(config.weather_entities, ["weather"]);
  config.motion_entities = normalizeEntityList(config.motion_entities, ["binary_sensor"]);
  config.door_entities = normalizeEntityList(config.door_entities, ["binary_sensor"]);
  config.window_entities = normalizeEntityList(config.window_entities, ["binary_sensor"]);
  config.temperature_entities = normalizeEntityList(config.temperature_entities, ["sensor"]);
  config.humidity_entities = normalizeEntityList(config.humidity_entities, ["sensor"]);
  config.outdoor_temperature_entities = normalizeEntityList(config.outdoor_temperature_entities, ["sensor"]);
  config.outdoor_humidity_entities = normalizeEntityList(config.outdoor_humidity_entities, ["sensor"]);
  config.battery_entities = normalizeEntityList(config.battery_entities, ["sensor"]);
  config.humidifier_fill_entities = normalizeEntityList(config.humidifier_fill_entities, ["sensor"]);
  config.humidifier_full_entities = normalizeEntityList(config.humidifier_full_entities, ["sensor"]);
  config.ink_entities = normalizeEntityList(config.ink_entities, ["sensor"]);
  config.custom_notifications = normalizeCustomNotifications(config.custom_notifications, {
    keepDrafts: options.keepDrafts === true,
  });
  config.max_visible = Math.max(1, Math.min(8, Number(config.max_visible) || 1));
  config.refresh_interval = Math.max(30, Math.min(3600, Number(config.refresh_interval) || 300));
  config.storage_key = String(config.storage_key || STORAGE_KEY).trim() || STORAGE_KEY;
  config.dismissed_entity = entityDomain(config.dismissed_entity) === "input_text" ? String(config.dismissed_entity).trim() : "";
  config.smart_recommendations = config.smart_recommendations !== false;
  config.language = String(config.language || "auto").trim() || "auto";
  config.thresholds = {
    hot_temperature: finiteNumber(config.thresholds?.hot_temperature, DEFAULT_CONFIG.thresholds.hot_temperature),
    cold_temperature: finiteNumber(config.thresholds?.cold_temperature, DEFAULT_CONFIG.thresholds.cold_temperature),
    humidity_high: finiteNumber(config.thresholds?.humidity_high, DEFAULT_CONFIG.thresholds.humidity_high),
    humidity_low: finiteNumber(config.thresholds?.humidity_low, DEFAULT_CONFIG.thresholds.humidity_low),
    rain_probability: Math.max(0, Math.min(100, finiteNumber(config.thresholds?.rain_probability, DEFAULT_CONFIG.thresholds.rain_probability))),
    rain_lookahead_hours: Math.max(1, Math.min(24, finiteNumber(config.thresholds?.rain_lookahead_hours, DEFAULT_CONFIG.thresholds.rain_lookahead_hours))),
    media_absence_minutes: Math.max(1, Math.min(240, finiteNumber(config.thresholds?.media_absence_minutes, DEFAULT_CONFIG.thresholds.media_absence_minutes))),
    battery_low: Math.max(0, Math.min(100, finiteNumber(config.thresholds?.battery_low, DEFAULT_CONFIG.thresholds.battery_low))),
    humidifier_fill_low: Math.max(0, Math.min(100, finiteNumber(config.thresholds?.humidifier_fill_low, DEFAULT_CONFIG.thresholds.humidifier_fill_low))),
    humidifier_fill_full: Math.max(0, Math.min(100, finiteNumber(config.thresholds?.humidifier_fill_full, DEFAULT_CONFIG.thresholds.humidifier_fill_full))),
    ink_low: Math.max(0, Math.min(100, finiteNumber(config.thresholds?.ink_low, DEFAULT_CONFIG.thresholds.ink_low))),
  };
  config.smart_notifications = normalizeSmartNotifications(config.smart_notifications);
  config.smart_entity_overrides = normalizeSmartEntityOverrides(config.smart_entity_overrides);
  config.presence_entity = String(config.presence_entity || "").trim();
  config.mobile_context = normalizeMobileContext(config.mobile_context);
  config.external_alerts = normalizeExternalAlerts(config.external_alerts, {
    keepDrafts: options.keepDrafts === true,
  });
  config.mobile_notifications = mergeDeep(DEFAULT_CONFIG.mobile_notifications, config.mobile_notifications || {});
  config.mobile_notifications.enabled = config.mobile_notifications.enabled === true;
  config.mobile_notifications.entities = normalizeEntityList(config.mobile_notifications.entities, ["notify"]);
  config.mobile_notifications.services = normalizeNotifyServices(config.mobile_notifications.services);
  config.mobile_notifications.critical_alerts = config.mobile_notifications.critical_alerts === true;
  config.mobile_notifications.default_policy = normalizeMobilePolicy(
    config.mobile_notifications.default_policy ?? "auto",
  );
  config.mobile_notifications.cooldown_minutes = Math.max(
    0,
    Math.min(1440, Number(config.mobile_notifications.cooldown_minutes) || DEFAULT_CONFIG.mobile_notifications.cooldown_minutes),
  );
  config.mobile_notifications.group_similar = config.mobile_notifications.group_similar !== false;
  config.mobile_notifications.min_severity = ["info", "success", "warning", "critical"].includes(String(config.mobile_notifications.min_severity || "").toLowerCase())
    ? String(config.mobile_notifications.min_severity).toLowerCase()
    : DEFAULT_CONFIG.mobile_notifications.min_severity;
  config.background_mobile = mergeDeep(DEFAULT_CONFIG.background_mobile, config.background_mobile || {});
  config.background_mobile.enabled = config.background_mobile.enabled === true;
  config.background_mobile.profile_id = String(config.background_mobile.profile_id || "default").trim() || "default";
  config.background_mobile.webhook = String(config.background_mobile.webhook || "").trim();
  config.background_mobile.chunk_size = Math.max(
    120,
    Math.min(240, Number(config.background_mobile.chunk_size) || DEFAULT_CONFIG.background_mobile.chunk_size),
  );
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? mergeDeep(DEFAULT_CONFIG.security, config.security || {});
  if (config.security.allow_webhooks_for_non_admin === undefined) {
    config.security.allow_webhooks_for_non_admin = DEFAULT_CONFIG.security.allow_webhooks_for_non_admin;
  }
  config.security.allow_webhooks_for_non_admin = config.security.allow_webhooks_for_non_admin === true;
  config.haptics = mergeDeep(DEFAULT_CONFIG.haptics, config.haptics || {});
  config.animations = mergeDeep(DEFAULT_CONFIG.animations, config.animations || {});
  config.animations.enabled = config.animations.enabled !== false;
  config.animations.content_duration = Math.max(120, Math.min(1800, Number(config.animations.content_duration) || DEFAULT_CONFIG.animations.content_duration));
  config.animations.button_bounce_duration = Math.max(120, Math.min(1200, Number(config.animations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration));
  config.styles = mergeDeep(DEFAULT_CONFIG.styles, config.styles || {});
  // Older defaults used a tighter notification chip radius (18px) and a bare 28px
  // card radius. Promote them to the shared Nodalia card radius token so list
  // items match the empty state and the rest of the suite.
  const familyRadius = DEFAULT_CONFIG.styles.card.border_radius;
  if (String(config.styles?.card?.border_radius ?? "").trim() === "28px") {
    config.styles.card.border_radius = familyRadius;
  }
  const itemRadius = String(config.styles?.item_radius ?? "").trim();
  if (itemRadius === "18px" || itemRadius === "28px") {
    config.styles.item_radius = familyRadius;
  }
  return config;
}
