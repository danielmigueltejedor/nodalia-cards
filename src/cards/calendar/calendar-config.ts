// @ts-nocheck -- merged Lovelace YAML is projected into the runtime calendar config.
import { HAPTIC_PATTERNS, VALID_TIME_RANGES } from "./calendar-constants";
import { isObject } from "./calendar-runtime";
import {
  daysFromTimeRange,
  mergeConfig,
  normalizeCalendarEntries,
  sanitizeCssRuntimeValue,
} from "./calendar-helpers";

export const DEFAULT_CONFIG = {
  title: "Calendar",
  icon: "mdi:calendar-month",
  calendars: [],
  time_range: "1w",
  days_to_show: 7,
  max_visible_events: 2,
  refresh_interval: 300,
  allow_delete: true,
  weather_entity: "",
  native_event_webhook: "",
  security: {
    allow_webhooks_for_non_admin: false,
  },
  tint_auto: true,
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    content_duration: 260,
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
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      on_color:
        "color-mix(in srgb, var(--primary-color) 52%, var(--primary-text-color))",
      off_color:
        "color-mix(in srgb, var(--primary-text-color) 62%, var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 48%, transparent)))",
      size: "38px",
    },
    tint: {
      color: "var(--primary-color)",
    },
    title_size: "17px",
    event_size: "13px",
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    chip_size: "11px",
  },
};

export function normalizeConfig(config) {
  const normalized = mergeConfig(DEFAULT_CONFIG, config || {});
  normalized.calendars = normalizeCalendarEntries(normalized.calendars);
  normalized.allow_delete = normalized.allow_delete !== false;
  let timeRange = String(normalized.time_range || "").trim();
  if (!VALID_TIME_RANGES.includes(timeRange)) {
    const legacyDays = Number(normalized.days_to_show);
    if (Number.isFinite(legacyDays)) {
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
  normalized.days_to_show = Math.min(62, Math.max(1, daysFromTimeRange(timeRange)));
  delete normalized.quick_reminder_webhook;
  normalized.native_event_webhook = String(normalized.native_event_webhook ?? "").trim();
  const priorSecurity = isObject(normalized.security) ? normalized.security : {};
  normalized.security = {
    ...DEFAULT_CONFIG.security,
    ...priorSecurity,
  };
  if (normalized.security.allow_webhooks_for_non_admin === undefined) {
    normalized.security.allow_webhooks_for_non_admin =
      priorSecurity.require_admin_for_webhooks === true
        ? false
        : DEFAULT_CONFIG.security.allow_webhooks_for_non_admin;
  }
  normalized.security.allow_webhooks_for_non_admin =
    normalized.security.allow_webhooks_for_non_admin === true;
  normalized.weather_entity = String(normalized.weather_entity ?? "").trim();
  normalized.max_visible_events = Math.min(
    12,
    Math.max(1, Number(normalized.max_visible_events) || DEFAULT_CONFIG.max_visible_events),
  );
  normalized.refresh_interval = Math.min(3600, Math.max(30, Number(normalized.refresh_interval) || DEFAULT_CONFIG.refresh_interval));
  if (!normalized.styles.chip_font_size && normalized.styles.chip_size) {
    normalized.styles.chip_font_size = normalized.styles.chip_size;
  }
  normalized.styles.card.background =
    sanitizeCssRuntimeValue(normalized.styles.card.background) || DEFAULT_CONFIG.styles.card.background;
  normalized.styles.card.border =
    sanitizeCssRuntimeValue(normalized.styles.card.border) || DEFAULT_CONFIG.styles.card.border;
  normalized.styles.card.border_radius =
    sanitizeCssRuntimeValue(normalized.styles.card.border_radius) || DEFAULT_CONFIG.styles.card.border_radius;
  normalized.styles.card.box_shadow =
    sanitizeCssRuntimeValue(normalized.styles.card.box_shadow) || DEFAULT_CONFIG.styles.card.box_shadow;
  normalized.styles.card.padding =
    sanitizeCssRuntimeValue(normalized.styles.card.padding) || DEFAULT_CONFIG.styles.card.padding;
  normalized.styles.card.gap =
    sanitizeCssRuntimeValue(normalized.styles.card.gap) || DEFAULT_CONFIG.styles.card.gap;
  normalized.styles.title_size =
    sanitizeCssRuntimeValue(normalized.styles.title_size) || DEFAULT_CONFIG.styles.title_size;
  normalized.styles.event_size =
    sanitizeCssRuntimeValue(normalized.styles.event_size) || DEFAULT_CONFIG.styles.event_size;
  normalized.styles.chip_height =
    sanitizeCssRuntimeValue(normalized.styles.chip_height) || DEFAULT_CONFIG.styles.chip_height;
  normalized.styles.chip_font_size =
    sanitizeCssRuntimeValue(normalized.styles.chip_font_size) || DEFAULT_CONFIG.styles.chip_font_size;
  normalized.styles.chip_padding =
    sanitizeCssRuntimeValue(normalized.styles.chip_padding) || DEFAULT_CONFIG.styles.chip_padding;
  normalized.styles.chip_border_radius =
    sanitizeCssRuntimeValue(normalized.styles.chip_border_radius) || DEFAULT_CONFIG.styles.chip_border_radius;
  normalized.styles.icon.background =
    sanitizeCssRuntimeValue(normalized.styles.icon.background) || DEFAULT_CONFIG.styles.icon.background;
  normalized.styles.icon.on_color =
    sanitizeCssRuntimeValue(normalized.styles.icon.on_color) || DEFAULT_CONFIG.styles.icon.on_color;
  normalized.styles.icon.off_color =
    sanitizeCssRuntimeValue(normalized.styles.icon.off_color) || DEFAULT_CONFIG.styles.icon.off_color;
  normalized.styles.icon.size =
    sanitizeCssRuntimeValue(normalized.styles.icon.size) || DEFAULT_CONFIG.styles.icon.size;
  normalized.styles.tint.color =
    sanitizeCssRuntimeValue(normalized.styles.tint.color) || DEFAULT_CONFIG.styles.tint.color;
  const iconStyle = normalized.styles?.icon;
  if (iconStyle && iconStyle.color && !iconStyle.on_color) {
    iconStyle.on_color = iconStyle.color;
  }
  normalized.haptics = mergeConfig(DEFAULT_CONFIG.haptics, normalized.haptics || {});
  normalized.haptics.enabled = normalized.haptics.enabled === true;
  normalized.haptics.fallback_vibrate = normalized.haptics.fallback_vibrate === true;
  normalized.haptics.style = Object.prototype.hasOwnProperty.call(HAPTIC_PATTERNS, normalized.haptics.style)
    ? normalized.haptics.style
    : DEFAULT_CONFIG.haptics.style;
  return normalized;
}
