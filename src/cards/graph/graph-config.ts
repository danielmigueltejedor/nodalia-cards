import { normalizeControlStyles } from "../../shared/control-config";
import { DEFAULT_HISTORY_POINTS } from "./graph-constants";
import { isObject, mergeConfig } from "./graph-runtime";
import { resolveEntityEntries, normalizeGraphPointCount } from "./graph-helpers";

export const DEFAULT_CONFIG = {
  entity: "",
  entities: [],
  name: "Temperature",
  icon: "mdi:thermometer",
  min: 15,
  max: 25,
  hours_to_show: 24,
  points: DEFAULT_HISTORY_POINTS,
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

export function normalizeConfig(rawConfig: unknown = {}, { preserveEmptyEntities = false } = {}) {
  const defaults: Record<string, unknown> = DEFAULT_CONFIG;
  const merged = mergeConfig(defaults, isObject(rawConfig) ? rawConfig : {});
  return { ...merged, entities: resolveEntityEntries(merged, { preserveEmpty: preserveEmptyEntities }),
    points: normalizeGraphPointCount(merged.points), styles: normalizeControlStyles(merged.styles, DEFAULT_CONFIG.styles) };

}

export function normalizeEditorConfig(rawConfig: unknown = {}) {
  return normalizeConfig(rawConfig, { preserveEmptyEntities: true });
}
