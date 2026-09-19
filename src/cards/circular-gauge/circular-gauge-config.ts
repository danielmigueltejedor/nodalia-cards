// @ts-nocheck -- merged Lovelace YAML is projected into the runtime circular-gauge config.
import { DEFAULT_GAUGE_MAX_TINT_COLOR, DEFAULT_GAUGE_MIN_TINT_COLOR } from "./circular-gauge-constants";
import { mergeConfig } from "./circular-gauge-runtime";

export const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  min: "",
  max: "",
  min_label: "",
  max_label: "",
  unit: "",
  decimals: "",
  start_from_zero: true,
  show_header: true,
  show_name: true,
  show_icon: true,
  show_name_chip: true,
  show_percentage_chip: false,
  show_range_labels: true,
  show_unavailable_badge: true,
  show_bottom_icon_bubble: false,
  tap_action: "more-info",
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    dial_duration: 220,
    button_bounce_duration: 320,
    content_duration: 420,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "30px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "16px",
      gap: "14px",
    },
    icon: {
      size: "58px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 10px",
    chip_border_radius: "999px",
    title_size: "16px",
    value_size: "52px",
    range_size: "14px",
    name_chip_max_width: "170px",
    gauge: {
      size: "280px",
      stroke: "18px",
      thumb_size: "22px",
      track_color: "color-mix(in srgb, var(--primary-text-color) 24%, var(--ha-card-background))",
      background: "color-mix(in srgb, var(--primary-text-color) 2%, transparent)",
      min_tint_color: DEFAULT_GAUGE_MIN_TINT_COLOR,
      max_tint_color: DEFAULT_GAUGE_MAX_TINT_COLOR,
      foreground_color: "",
    },
  },
};

export const STUB_CONFIG = {
  entity: "sensor.enchufe_inteligente_potencia",
  name: "Potencia",
  min: 0,
  max: 2500,
};

export function normalizeConfig(rawConfig) {
  return mergeConfig(DEFAULT_CONFIG, rawConfig || {});
}
