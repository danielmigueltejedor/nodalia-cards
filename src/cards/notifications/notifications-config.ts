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
  const calendar_entities = normalizeEntityList(config.calendar_entities, ["calendar"]);
  const vacuum_entities = normalizeEntityList(config.vacuum_entities, ["vacuum"]);
  const vacuum_error_entities = normalizeEntityList(config.vacuum_error_entities, ["sensor"]);
  const fan_entities = normalizeEntityList(config.fan_entities, ["fan"]);
  const climate_entities = normalizeEntityList(config.climate_entities, ["climate"]);
  const humidifier_entities = normalizeEntityList(config.humidifier_entities, ["humidifier"]);
  const media_player_entities = normalizeEntityList(config.media_player_entities, ["media_player"]);
  const weather_entities = normalizeEntityList(config.weather_entities, ["weather"]);
  const motion_entities = normalizeEntityList(config.motion_entities, ["binary_sensor"]);
  const door_entities = normalizeEntityList(config.door_entities, ["binary_sensor"]);
  const window_entities = normalizeEntityList(config.window_entities, ["binary_sensor"]);
  const temperature_entities = normalizeEntityList(config.temperature_entities, ["sensor"]);
  const humidity_entities = normalizeEntityList(config.humidity_entities, ["sensor"]);
  const outdoor_temperature_entities = normalizeEntityList(config.outdoor_temperature_entities, ["sensor"]);
  const outdoor_humidity_entities = normalizeEntityList(config.outdoor_humidity_entities, ["sensor"]);
  const battery_entities = normalizeEntityList(config.battery_entities, ["sensor"]);
  const humidifier_fill_entities = normalizeEntityList(config.humidifier_fill_entities, ["sensor"]);
  const humidifier_full_entities = normalizeEntityList(config.humidifier_full_entities, ["sensor"]);
  const ink_entities = normalizeEntityList(config.ink_entities, ["sensor"]);
  const custom_notifications = normalizeCustomNotifications(config.custom_notifications, {
    keepDrafts: options.keepDrafts === true,
  });
  const max_visible = Math.max(1, Math.min(8, Number(config.max_visible) || 1));
  const refresh_interval = Math.max(30, Math.min(3600, Number(config.refresh_interval) || 300));
  const storage_key = String(config.storage_key || STORAGE_KEY).trim() || STORAGE_KEY;
  const dismissed_entity = entityDomain(config.dismissed_entity) === "input_text" ? String(config.dismissed_entity).trim() : "";
  const smart_recommendations = config.smart_recommendations !== false;
  const language = String(config.language || "auto").trim() || "auto";
  const rawThresholds = isObject(config.thresholds) ? config.thresholds : {};
  const thresholds = {
    hot_temperature: finiteNumber(rawThresholds.hot_temperature, DEFAULT_CONFIG.thresholds.hot_temperature),
    cold_temperature: finiteNumber(rawThresholds.cold_temperature, DEFAULT_CONFIG.thresholds.cold_temperature),
    humidity_high: finiteNumber(rawThresholds.humidity_high, DEFAULT_CONFIG.thresholds.humidity_high),
    humidity_low: finiteNumber(rawThresholds.humidity_low, DEFAULT_CONFIG.thresholds.humidity_low),
    rain_probability: Math.max(0, Math.min(100, finiteNumber(rawThresholds.rain_probability, DEFAULT_CONFIG.thresholds.rain_probability))),
    rain_lookahead_hours: Math.max(1, Math.min(24, finiteNumber(rawThresholds.rain_lookahead_hours, DEFAULT_CONFIG.thresholds.rain_lookahead_hours))),
    media_absence_minutes: Math.max(1, Math.min(240, finiteNumber(rawThresholds.media_absence_minutes, DEFAULT_CONFIG.thresholds.media_absence_minutes))),
    battery_low: Math.max(0, Math.min(100, finiteNumber(rawThresholds.battery_low, DEFAULT_CONFIG.thresholds.battery_low))),
    humidifier_fill_low: Math.max(0, Math.min(100, finiteNumber(rawThresholds.humidifier_fill_low, DEFAULT_CONFIG.thresholds.humidifier_fill_low))),
    humidifier_fill_full: Math.max(0, Math.min(100, finiteNumber(rawThresholds.humidifier_fill_full, DEFAULT_CONFIG.thresholds.humidifier_fill_full))),
    ink_low: Math.max(0, Math.min(100, finiteNumber(rawThresholds.ink_low, DEFAULT_CONFIG.thresholds.ink_low))),
  };
  const smart_notifications = normalizeSmartNotifications(config.smart_notifications);
  const smart_entity_overrides = normalizeSmartEntityOverrides(config.smart_entity_overrides);
  const presence_entity = String(config.presence_entity || "").trim();
  const mobile_context = normalizeMobileContext(config.mobile_context);
  const external_alerts = normalizeExternalAlerts(config.external_alerts, {
    keepDrafts: options.keepDrafts === true,
  });
  const rawMobile = mergeDeep(DEFAULT_CONFIG.mobile_notifications, config.mobile_notifications || {});
  const mobile_notifications = {
    ...rawMobile,
    enabled: rawMobile.enabled === true,
    entities: normalizeEntityList(rawMobile.entities, ["notify"]),
    services: normalizeNotifyServices(rawMobile.services),
    critical_alerts: rawMobile.critical_alerts === true,
    default_policy: normalizeMobilePolicy(rawMobile.default_policy ?? "auto"),
    cooldown_minutes: Math.max(0, Math.min(1440, finiteNumber(rawMobile.cooldown_minutes, DEFAULT_CONFIG.mobile_notifications.cooldown_minutes) || DEFAULT_CONFIG.mobile_notifications.cooldown_minutes)),
    group_similar: rawMobile.group_similar !== false,
    min_severity: ["info", "success", "warning", "critical"].includes(String(rawMobile.min_severity || "").toLowerCase())
      ? String(rawMobile.min_severity).toLowerCase() : DEFAULT_CONFIG.mobile_notifications.min_severity,
  };
  const rawBackground = mergeDeep(DEFAULT_CONFIG.background_mobile, config.background_mobile || {});
  const background_mobile = {
    ...rawBackground,
    enabled: rawBackground.enabled === true,
    profile_id: String(rawBackground.profile_id || "default").trim() || "default",
    webhook: String(rawBackground.webhook || "").trim(),
    chunk_size: Math.max(120, Math.min(240, finiteNumber(rawBackground.chunk_size, DEFAULT_CONFIG.background_mobile.chunk_size) || DEFAULT_CONFIG.background_mobile.chunk_size)),
  };
  const security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? mergeDeep(DEFAULT_CONFIG.security, config.security || {});
  if (security.allow_webhooks_for_non_admin === undefined) {
    security.allow_webhooks_for_non_admin = DEFAULT_CONFIG.security.allow_webhooks_for_non_admin;
  }
  security.allow_webhooks_for_non_admin = security.allow_webhooks_for_non_admin === true;
  const haptics = mergeDeep(DEFAULT_CONFIG.haptics, config.haptics || {});
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
  return {
    ...config,
    calendar_entities, vacuum_entities, vacuum_error_entities, fan_entities,
    climate_entities, humidifier_entities, media_player_entities, weather_entities,
    motion_entities, door_entities, window_entities, temperature_entities,
    humidity_entities, outdoor_temperature_entities, outdoor_humidity_entities,
    battery_entities, humidifier_fill_entities, humidifier_full_entities, ink_entities,
    custom_notifications, max_visible, refresh_interval, storage_key, dismissed_entity,
    smart_recommendations, language, thresholds, smart_notifications,
    smart_entity_overrides, presence_entity, mobile_context, external_alerts,
    haptics, mobile_notifications, background_mobile, security, animations, styles,
  };
}
