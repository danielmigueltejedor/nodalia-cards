import type { SceneNormalizationOptions, NormalizedScenesConfig } from "./scenes-types";
import { HOLD_ACTIONS, TAP_ACTIONS } from "./scenes-constants";
import { clamp, isObject, normalizeTextKey } from "./scenes-runtime";
import { mergeConfig, normalizeSceneRows } from "./scenes-helpers";

import { DEFAULT_CONFIG } from "./scenes-defaults";
export { DEFAULT_CONFIG } from "./scenes-defaults";

export const STUB_CONFIG = {
  name: "Scenes",
  layout: "grid",
  columns: 2,
  scenes: [],
};

export function normalizeConfig(rawConfig: unknown = {}, options: SceneNormalizationOptions = {}): NormalizedScenesConfig {
  const merged = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const config = isObject(merged) ? merged : { ...DEFAULT_CONFIG };
  const layout = normalizeTextKey(config.layout);
  const tap = normalizeTextKey(config.tap_action);
  const hold = normalizeTextKey(config.hold_action);
  return {
    ...config,
    layout: layout === "list" || layout === "single" ? layout : "grid",
    columns: clamp(Math.round(Number(config.columns) || DEFAULT_CONFIG.columns), 1, 6),
    tap_action: TAP_ACTIONS.has(tap) ? tap : "activate",
    hold_action: HOLD_ACTIONS.has(hold) ? hold : "more-info",
    scenes: normalizeSceneRows(config.scenes, options),
  };
}
