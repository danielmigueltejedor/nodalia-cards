// @ts-nocheck -- merged Lovelace YAML is projected into the runtime power-flow config.
import { NODE_DEFAULTS } from "./power-flow-constants";
import { deepClone, isObject, mergeConfig } from "./power-flow-runtime";
import { deepCloneNode, sanitizeIndividualEntries } from "./power-flow-helpers";

export const DEFAULT_CONFIG = {
  title: "",
  name: "",
  entities: {
    grid: deepCloneNode(NODE_DEFAULTS.grid),
    home: deepCloneNode(NODE_DEFAULTS.home),
    solar: deepCloneNode(NODE_DEFAULTS.solar),
    battery: deepCloneNode(NODE_DEFAULTS.battery),
    water: deepCloneNode(NODE_DEFAULTS.water),
    gas: deepCloneNode(NODE_DEFAULTS.gas),
    individual: [],
  },
  display_zero_lines: {
    mode: "show",
    transparency: 50,
    grey_color: [189, 189, 189],
  },
  dashboard_link: "",
  dashboard_link_label: "Energy",
  consumption_chips: {
    day_entity: "",
    month_entity: "",
    day_label: "",
    month_label: "",
  },
  show_home_device_popup: true,
  show_header: true,
  show_dashboard_link_button: true,
  show_labels: true,
  show_values: true,
  show_secondary_info: true,
  show_unavailable_badge: true,
  clickable_entities: true,
  tap_action: "none",
  min_flow_rate: 1.4,
  max_flow_rate: 5.8,
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    content_duration: 460,
    button_bounce_duration: 320,
  },
  grid_options: {
    rows: "auto",
    columns: "full",
    min_rows: 1,
    min_columns: 6,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "32px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "12px",
      gap: "10px",
    },
    icon: {
      node_size: "48px",
      home_size: "96px",
      individual_size: "40px",
      color: "var(--primary-text-color)",
    },
    title_size: "15px",
    chip_height: "21px",
    chip_font_size: "10px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    home_value_size: "22px",
    home_unit_size: "14px",
    node_value_size: "11px",
    secondary_size: "10px",
    flow_width: "1px",
  },
};

export const STUB_CONFIG = {
  title: "Energy",
  entities: {
    grid: {
      entity: "sensor.shelly_pro_3em_puerto_c_potencia",
    },
    home: {
      entity: "sensor.shelly_pro_3em_puerto_c_potencia",
    },
    solar: {
      entity: "",
    },
    battery: {
      entity: "",
    },
    individual: [],
  },
  dashboard_link: "/energy/overview",
};

export function normalizeConfig(rawConfig) {
  const merged = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  merged.entities = merged.entities || {};
  merged.entities.individual = sanitizeIndividualEntries(merged);
  merged.consumption_chips = {
    ...DEFAULT_CONFIG.consumption_chips,
    ...(isObject(merged.consumption_chips) ? merged.consumption_chips : {}),
  };
  merged.consumption_chips.day_entity = String(merged.consumption_chips.day_entity ?? "").trim();
  merged.consumption_chips.month_entity = String(merged.consumption_chips.month_entity ?? "").trim();
  merged.consumption_chips.day_label = String(merged.consumption_chips.day_label ?? "").trim();
  merged.consumption_chips.month_label = String(merged.consumption_chips.month_label ?? "").trim();
  merged.show_home_device_popup = merged.show_home_device_popup !== false;
  merged.styles = window.NodaliaUtils?.sanitizeStyleTree?.(merged.styles, DEFAULT_CONFIG.styles)
    ?? deepClone(DEFAULT_CONFIG.styles);
  return merged;
}
