// @ts-nocheck -- merged Lovelace YAML is projected into the runtime insignia config.
import { mergeConfig } from "./insignia-runtime";
import { getTintPresetColor, normalizeTintPreset } from "./insignia-helpers";

export const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  icon_active: "",
  icon_inactive: "",
  use_entity_icon: false,
  use_entity_picture: false,
  state_attribute: "",
  tap_action: "auto",
  tap_service: "",
  tap_service_data: "",
  tap_url: "",
  tap_new_tab: false,
  hold_action: "more-info",
  hold_service: "",
  hold_service_data: "",
  hold_url: "",
  hold_new_tab: false,
  show_name: true,
  show_value: true,
  security: {
    strict_service_actions: true,
    allowed_services: [],
    allowed_service_domains: [],
  },
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      border_radius: "999px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "4px 8px",
      gap: "8px",
    },
    icon: {
      size: "26px",
      background: "color-mix(in srgb, var(--primary-text-color) 5%, transparent)",
      on_color: "var(--info-color, #71c0ff)",
      off_color: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
      icon_only_offset_y: "0",
    },
    tint: {
      color: "var(--info-color, #71c0ff)",
    },
    title_size: "12px",
    value_size: "12px",
  },
  tint_auto: true,
};

export const STUB_CONFIG = {
  entity: "sensor.temperatura_salon",
  name: "Salon",
  show_name: true,
  show_value: true,
  tap_action: "more-info",
};

export function normalizeConfig(rawConfig) {
  const merged = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const legacyPreset = normalizeTintPreset(rawConfig?.tint_preset || rawConfig?.color);
  if (legacyPreset === "auto") {
    merged.tint_auto = true;
  } else if (legacyPreset) {
    merged.tint_auto = false;
    if (!rawConfig?.styles?.tint?.color) {
      merged.styles.tint.color = getTintPresetColor(legacyPreset);
    }
  }
  const HOLD_ACTIONS = new Set(["auto", "toggle", "more-info", "service", "navigate", "url", "none"]);
  const h = String(merged.hold_action ?? "none").trim().toLowerCase();
  merged.hold_action = HOLD_ACTIONS.has(h) ? h : "none";
  merged.hold_service = String(merged.hold_service ?? "").trim();
  merged.hold_service_data = String(merged.hold_service_data ?? "").trim();
  merged.hold_url = String(merged.hold_url ?? "").trim();
  merged.hold_new_tab = merged.hold_new_tab === true;
  return merged;
}
