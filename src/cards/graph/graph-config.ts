// @ts-nocheck -- merged Lovelace YAML is projected into the runtime graph config.
import { deepClone, mergeConfig } from "./graph-runtime";
import { resolveEntityEntries } from "./graph-helpers";

export const DEFAULT_CONFIG = {
  entity: "",
  entities: [],
  name: "Temperature",
  icon: "mdi:thermometer",
  min: 15,
  max: 25,
  hours_to_show: 24,
  points: 100,
  show_header: true,
  show_icon: true,
  show_value: true,
  show_legend: true,
  show_fill: true,
  show_unavailable_badge: true,
  tap_action: "more-info",
  hold_action: "more-info",
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    hover_duration: 180,
    button_bounce_duration: 280,
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
      color: "var(--primary-text-color)",
      size: "20px",
    },
    title_size: "12px",
    value_size: "40px",
    unit_size: "17px",
    legend_size: "11px",
    chip_border_radius: "999px",
    chart_height: "160px",
    line_width: "2.2px",
  },
};

export const STUB_CONFIG = {
  name: "Temperature",
  icon: "mdi:thermometer",
  min: 15,
  max: 25,
  entities: [
    {
      entity: "sensor.termostato_dormitorios_temperatura",
      name: "Bedroom",
      color: "#ffaa00",
    },
    {
      entity: "sensor.termostato_habitaciones_comunes_temperatura",
      name: "Hallway",
      color: "#ffc677",
    },
  ],
};

export function normalizeConfig(rawConfig, { preserveEmptyEntities = false } = {}) {
  const merged = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  merged.entities = resolveEntityEntries(merged, { preserveEmpty: preserveEmptyEntities });
  merged.styles = window.NodaliaUtils?.sanitizeStyleTree?.(merged.styles, DEFAULT_CONFIG.styles)
    ?? deepClone(DEFAULT_CONFIG.styles);
  return merged;
}

export function normalizeEditorConfig(rawConfig) {
  return normalizeConfig(rawConfig, { preserveEmptyEntities: true });
}
