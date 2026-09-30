import type { NotificationNormalizationOptions } from "./notifications-normalization";
import { STORAGE_KEY } from "./notifications-constants";
import { isObject, normalizeMobileContext, normalizeMobilePolicy } from "./notifications-runtime";
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
} from "./notifications-normalization";

import { DEFAULT_CONFIG } from "./notifications-defaults";
export { DEFAULT_CONFIG } from "./notifications-defaults";

export function normalizeConfig(rawConfig: unknown = {}, options: NotificationNormalizationOptions = {}) {
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
  const thresholds = isObject(config.thresholds) ? config.thresholds : {};
  config.thresholds = {
    hot_temperature: finiteNumber(thresholds.hot_temperature, DEFAULT_CONFIG.thresholds.hot_temperature),
    cold_temperature: finiteNumber(thresholds.cold_temperature, DEFAULT_CONFIG.thresholds.cold_temperature),
    humidity_high: finiteNumber(thresholds.humidity_high, DEFAULT_CONFIG.thresholds.humidity_high),
    humidity_low: finiteNumber(thresholds.humidity_low, DEFAULT_CONFIG.thresholds.humidity_low),
    rain_probability: Math.max(0, Math.min(100, finiteNumber(thresholds.rain_probability, DEFAULT_CONFIG.thresholds.rain_probability))),
    rain_lookahead_hours: Math.max(1, Math.min(24, finiteNumber(thresholds.rain_lookahead_hours, DEFAULT_CONFIG.thresholds.rain_lookahead_hours))),
    media_absence_minutes: Math.max(1, Math.min(240, finiteNumber(thresholds.media_absence_minutes, DEFAULT_CONFIG.thresholds.media_absence_minutes))),
    battery_low: Math.max(0, Math.min(100, finiteNumber(thresholds.battery_low, DEFAULT_CONFIG.thresholds.battery_low))),
    humidifier_fill_low: Math.max(0, Math.min(100, finiteNumber(thresholds.humidifier_fill_low, DEFAULT_CONFIG.thresholds.humidifier_fill_low))),
    humidifier_fill_full: Math.max(0, Math.min(100, finiteNumber(thresholds.humidifier_fill_full, DEFAULT_CONFIG.thresholds.humidifier_fill_full))),
    ink_low: Math.max(0, Math.min(100, finiteNumber(thresholds.ink_low, DEFAULT_CONFIG.thresholds.ink_low))),
  };
  config.smart_notifications = normalizeSmartNotifications(config.smart_notifications);
  config.smart_entity_overrides = normalizeSmartEntityOverrides(config.smart_entity_overrides);
  config.presence_entity = String(config.presence_entity || "").trim();
  config.mobile_context = normalizeMobileContext(config.mobile_context);
  config.external_alerts = normalizeExternalAlerts(config.external_alerts, {
    keepDrafts: options.keepDrafts === true,
  });
  const mobile_notifications = mergeDeep(DEFAULT_CONFIG.mobile_notifications, config.mobile_notifications || {});
  mobile_notifications.enabled = mobile_notifications.enabled === true;
  mobile_notifications.entities = normalizeEntityList(mobile_notifications.entities, ["notify"]);
  mobile_notifications.services = normalizeNotifyServices(mobile_notifications.services);
  mobile_notifications.critical_alerts = mobile_notifications.critical_alerts === true;
  mobile_notifications.default_policy = normalizeMobilePolicy(
    mobile_notifications.default_policy ?? "auto",
  );
  mobile_notifications.cooldown_minutes = Math.max(
    0,
    Math.min(1440, Number(mobile_notifications.cooldown_minutes) || DEFAULT_CONFIG.mobile_notifications.cooldown_minutes),
  );
  mobile_notifications.group_similar = mobile_notifications.group_similar !== false;
  mobile_notifications.min_severity = ["info", "success", "warning", "critical"].includes(String(mobile_notifications.min_severity || "").toLowerCase())
    ? String(mobile_notifications.min_severity).toLowerCase()
    : DEFAULT_CONFIG.mobile_notifications.min_severity;
  const background_mobile = mergeDeep(DEFAULT_CONFIG.background_mobile, config.background_mobile || {});
  background_mobile.enabled = background_mobile.enabled === true;
  background_mobile.profile_id = String(background_mobile.profile_id || "default").trim() || "default";
  background_mobile.webhook = String(background_mobile.webhook || "").trim();
  background_mobile.chunk_size = Math.max(
    120,
    Math.min(240, Number(background_mobile.chunk_size) || DEFAULT_CONFIG.background_mobile.chunk_size),
  );
  const security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? mergeDeep(DEFAULT_CONFIG.security, config.security || {});
  if (security.allow_webhooks_for_non_admin === undefined) {
    security.allow_webhooks_for_non_admin = DEFAULT_CONFIG.security.allow_webhooks_for_non_admin;
  }
  security.allow_webhooks_for_non_admin = security.allow_webhooks_for_non_admin === true;
  config.haptics = mergeDeep(DEFAULT_CONFIG.haptics, config.haptics || {});
  const animations = mergeDeep(DEFAULT_CONFIG.animations, config.animations || {});
  animations.enabled = animations.enabled !== false;
  animations.content_duration = Math.max(120, Math.min(1800, Number(animations.content_duration) || DEFAULT_CONFIG.animations.content_duration));
  animations.button_bounce_duration = Math.max(120, Math.min(1200, Number(animations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration));
  const styles = mergeDeep(DEFAULT_CONFIG.styles, config.styles || {});
  // Older defaults used a tighter notification chip radius (18px) and a bare 28px
  // card radius. Promote them to the shared Nodalia card radius token so list
  // items match the empty state and the rest of the suite.
  const cardStyles = isObject(styles.card) ? styles.card : {};
  const familyRadius = DEFAULT_CONFIG.styles.card.border_radius;
  if (String(cardStyles.border_radius ?? "").trim() === "28px") {
    cardStyles.border_radius = familyRadius;
    styles.card = cardStyles;
  }
  const itemRadius = String(styles?.item_radius ?? "").trim();
  if (itemRadius === "18px" || itemRadius === "28px") {
    styles.item_radius = familyRadius;
  }
  return { ...config, mobile_notifications, background_mobile, security, animations, styles };
}
