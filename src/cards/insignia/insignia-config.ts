// @ts-nocheck -- merged Lovelace YAML is projected into the runtime insignia config.
import { mergeConfig } from "./insignia-runtime";
import { getTintPresetColor, normalizeTintPreset } from "./insignia-helpers";

import { DEFAULT_CONFIG } from "./insignia-defaults";
export { DEFAULT_CONFIG } from "./insignia-defaults";

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
