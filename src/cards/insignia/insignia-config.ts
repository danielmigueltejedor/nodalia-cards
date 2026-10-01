import { deepClone, isObject, mergeConfig } from "./insignia-runtime";
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

export function normalizeConfig(rawConfig: unknown = {}) {
  const raw = isObject(rawConfig) ? rawConfig : {};
  const defaults: Record<string, unknown> = DEFAULT_CONFIG;
  const merged = mergeConfig(defaults, raw);
  const styles = isObject(merged.styles) ? merged.styles : deepClone(DEFAULT_CONFIG.styles);
  const tint = isObject(styles.tint) ? styles.tint : deepClone(DEFAULT_CONFIG.styles.tint);
  const rawStyles = isObject(raw.styles) ? raw.styles : {};
  const rawTint = isObject(rawStyles.tint) ? rawStyles.tint : {};
  const legacyPreset = normalizeTintPreset(raw.tint_preset || raw.color);
  if (legacyPreset === "auto") {
    merged.tint_auto = true;
  } else if (legacyPreset) {
    merged.tint_auto = false;
    if (!rawTint.color) {
      tint.color = getTintPresetColor(legacyPreset);
    }
  }
  const HOLD_ACTIONS = new Set(["auto", "toggle", "more-info", "service", "navigate", "url", "none"]);
  const h = String(merged.hold_action ?? "none").trim().toLowerCase();
  const fields = {
    entity: typeof merged.entity === "string" ? merged.entity : "",
    state_attribute: typeof merged.state_attribute === "string" ? merged.state_attribute : "",
    tap_service: typeof merged.tap_service === "string" ? merged.tap_service : "",
    tap_service_data: typeof merged.tap_service_data === "string" ? merged.tap_service_data : "",
    tap_url: typeof merged.tap_url === "string" ? merged.tap_url : "",
    styles: { ...styles, tint },
    hold_action: HOLD_ACTIONS.has(h) ? h : "none",
    hold_service: String(merged.hold_service ?? "").trim(),
    hold_service_data: String(merged.hold_service_data ?? "").trim(),
    hold_url: String(merged.hold_url ?? "").trim(),
    hold_new_tab: merged.hold_new_tab === true,
  };
  const normalized: typeof fields & Record<string, unknown> = { ...merged, ...fields };
  return normalized;
}
