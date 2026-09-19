// @ts-nocheck -- merged Lovelace YAML is projected into the runtime weather config.
import { deepClone, mergeConfig } from "./weather-runtime";

export const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  language: "auto",
  unit_system: "auto",
  temperature_unit: "auto",
  wind_speed_unit: "auto",
  tap_action: "more-info",
  hold_action: "more-info",
  double_tap_action: "none",
  show_condition: true,
  show_humidity_chip: true,
  show_wind_chip: true,
  show_pressure_chip: false,
  show_meteoalarm_chip: false,
  meteoalarm_entity: "binary_sensor.meteoalarm",
  show_forecast_details: false,
  show_forecast_toggle: true,
  forecast_view: "cards",
  forecast_type: "hourly",
  forecast_chart_labels: false,
  forecast_chart_color_enabled: false,
  forecast_chart_color_mode: "temperature",
  forecast_slots_hourly: 8,
  forecast_slots_daily: 5,
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    icon_animation: true,
    content_duration: 420,
    button_bounce_duration: 320,
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
      size: "58px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    title_size: "14px",
    temperature_size: "28px",
    condition_size: "13px",
  },
};

export const STUB_CONFIG = {
  entity: "weather.casa",
  name: "Weather",
};

export function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const WEATHER_ACTIONS = new Set(["more-info", "none"]);
  const norm = (value, fallback) => {
    const key = String(value ?? fallback).trim().toLowerCase();
    return WEATHER_ACTIONS.has(key) ? key : fallback;
  };
  config.tap_action = norm(config.tap_action, "more-info");
  config.hold_action = norm(config.hold_action, "more-info");
  config.double_tap_action = norm(config.double_tap_action, "none");
  config.styles = window.NodaliaUtils?.sanitizeStyleTree?.(config.styles, DEFAULT_CONFIG.styles)
    ?? deepClone(DEFAULT_CONFIG.styles);
  return config;
}
