// @ts-nocheck -- merged Lovelace YAML is projected into the runtime scenes config.
import { HOLD_ACTIONS, TAP_ACTIONS } from "./scenes-constants";
import { clamp, normalizeTextKey } from "./scenes-runtime";
import { mergeConfig, normalizeSceneRows } from "./scenes-helpers";

import { DEFAULT_CONFIG } from "./scenes-defaults";
export { DEFAULT_CONFIG } from "./scenes-defaults";

export const STUB_CONFIG = {
  name: "Scenes",
  layout: "grid",
  columns: 2,
  scenes: [],
};

export function normalizeConfig(rawConfig, options = {}) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const layout = normalizeTextKey(config.layout);
  config.layout = ["grid", "list", "single"].includes(layout) ? layout : "grid";
  config.columns = clamp(Math.round(Number(config.columns) || DEFAULT_CONFIG.columns), 1, 6);
  const tap = normalizeTextKey(config.tap_action);
  config.tap_action = TAP_ACTIONS.has(tap) ? tap : "activate";
  const hold = normalizeTextKey(config.hold_action);
  config.hold_action = HOLD_ACTIONS.has(hold) ? hold : "more-info";
  config.scenes = normalizeSceneRows(config.scenes, options);
  return config;
}
