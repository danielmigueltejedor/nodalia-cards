import { normalizeControlStyles } from "../../shared/control-config";
import { parseFiniteNumericValue } from "../../shared/numeric-values";
import { HAPTIC_PATTERNS, VALID_TIME_RANGES } from "./calendar-constants";
import { isObject } from "./calendar-runtime";
import {
  daysFromTimeRange,
  mergeConfig,
  normalizeCalendarEntries,
  sanitizeCssRuntimeValue,
} from "./calendar-helpers";

import { DEFAULT_CONFIG } from "./calendar-defaults";
export { DEFAULT_CONFIG } from "./calendar-defaults";

export function normalizeConfig(config: unknown = {}) {
  const defaults: Record<string, unknown> = DEFAULT_CONFIG;
  const normalized = mergeConfig(defaults, isObject(config) ? config : {});
  normalized.allow_delete = normalized.allow_delete !== false;
  let timeRange = String(normalized.time_range || "").trim();
  if (!VALID_TIME_RANGES.includes(timeRange)) {
    const legacyDays = parseFiniteNumericValue(normalized.days_to_show);
    if (legacyDays !== null) {
      if (legacyDays <= 3) {
        timeRange = "3d";
      } else if (legacyDays <= 7) {
        timeRange = "1w";
      } else if (legacyDays <= 14) {
        timeRange = "2w";
      } else {
        timeRange = "1m";
      }
    } else {
      timeRange = DEFAULT_CONFIG.time_range;
    }
  }
  normalized.time_range = timeRange;
  const daysToShow = Math.min(62, Math.max(1, daysFromTimeRange(timeRange)));
  normalized.days_to_show = daysToShow;
  delete normalized.quick_reminder_webhook;
  normalized.native_event_webhook = String(normalized.native_event_webhook ?? "").trim();
  const priorSecurity: Record<string, unknown> = isObject(normalized.security) ? normalized.security : {};
  const security: Record<string, unknown> = {
    ...DEFAULT_CONFIG.security,
    ...priorSecurity,
  };
  if (security.allow_webhooks_for_non_admin === undefined) {
    security.allow_webhooks_for_non_admin =
      priorSecurity.require_admin_for_webhooks === true
        ? false
        : DEFAULT_CONFIG.security.allow_webhooks_for_non_admin;
  }
  security.allow_webhooks_for_non_admin =
    security.allow_webhooks_for_non_admin === true;
  normalized.security = security;
  normalized.weather_entity = String(normalized.weather_entity ?? "").trim();
  normalized.max_visible_events = Math.min(
    12,
    Math.max(1, parseFiniteNumericValue(normalized.max_visible_events) || DEFAULT_CONFIG.max_visible_events),
  );
  const refreshInterval = Math.min(3600, Math.max(30, parseFiniteNumericValue(normalized.refresh_interval) || DEFAULT_CONFIG.refresh_interval));
  normalized.refresh_interval = refreshInterval;
  const rawStyles = isObject(normalized.styles) ? normalized.styles : {};
  if (!rawStyles.chip_font_size && rawStyles.chip_size) rawStyles.chip_font_size = rawStyles.chip_size;
  const card = isObject(rawStyles.card) ? rawStyles.card : {};
  const icon = isObject(rawStyles.icon) ? rawStyles.icon : {};
  const tint = isObject(rawStyles.tint) ? rawStyles.tint : {};
  const projected = normalizeControlStyles(rawStyles, DEFAULT_CONFIG.styles, (value, fallback) => sanitizeCssRuntimeValue(value) || fallback);
  const styles = { ...rawStyles, ...projected, card: { ...card, ...projected.card }, icon: { ...icon, ...projected.icon }, tint: { ...tint, ...projected.tint } };
  if (icon.color && !styles.icon.on_color) styles.icon.on_color = sanitizeCssRuntimeValue(icon.color) || DEFAULT_CONFIG.styles.icon.on_color;
  normalized.styles = styles;
  const haptics = mergeConfig<Record<string, unknown>>(DEFAULT_CONFIG.haptics, isObject(normalized.haptics) ? normalized.haptics : {});
  const hapticStyle = String(haptics.style ?? "");
  const rawAnimations = isObject(normalized.animations) ? normalized.animations : {};
  const animationDuration = parseFiniteNumericValue(rawAnimations.content_duration);
  const animations = { ...rawAnimations, enabled: rawAnimations.enabled !== false,
    content_duration: Math.max(120, animationDuration ?? DEFAULT_CONFIG.animations.content_duration) };
  const fields = { days_to_show: daysToShow, refresh_interval: refreshInterval, security: { ...security, allow_webhooks_for_non_admin: security.allow_webhooks_for_non_admin === true }, entity: typeof normalized.entity === "string" ? normalized.entity : "", language: typeof normalized.language === "string" ? normalized.language : "auto", weather_entity: String(normalized.weather_entity), styles, animations, calendars: normalizeCalendarEntries(normalized.calendars),
    haptics: { ...haptics, enabled: haptics.enabled === true, fallback_vibrate: haptics.fallback_vibrate === true,
      style: Object.prototype.hasOwnProperty.call(HAPTIC_PATTERNS, hapticStyle) ? hapticStyle : DEFAULT_CONFIG.haptics.style } };
  const configFields: typeof fields & Record<string, unknown> = { ...normalized, ...fields };
  return configFields;
}
