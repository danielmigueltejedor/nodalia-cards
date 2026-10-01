export const DEFAULT_CONFIG = {
  language: "auto",
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

