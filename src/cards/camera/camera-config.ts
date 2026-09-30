import { CAMERA_LAYOUT, CAMERA_PRESENTATION, HOLD_ACTIONS, TAP_ACTIONS } from "./camera-constants";
import { deepClone, isObject } from "./camera-runtime";
import {
  mergeConfig,
  normalizeCameraActions,
  normalizeCameras,
  normalizeCameraStreams,
  normalizeCameraTapActions,
  normalizeExpandedActions,
  normalizeTextKey,
} from "./camera-helpers";

import { DEFAULT_CONFIG } from "./camera-defaults";
export { DEFAULT_CONFIG } from "./camera-defaults";

export const STUB_CONFIG = {
  entity: "camera.entrada",
  name: "Entrada",
};

export function normalizeConfig(rawConfig: unknown = {}) {
  const raw = isObject(rawConfig) ? rawConfig : {};
  const config = mergeConfig(DEFAULT_CONFIG, raw);
  const cameraIds = normalizeCameras(config);
  config.cameras = cameraIds;
  config.entity = cameraIds[0] || String(config.entity ?? "").trim();
  config.layout = CAMERA_LAYOUT;
  config.presentation = CAMERA_PRESENTATION;
  config.camera_streams = normalizeCameraStreams(config.camera_streams, cameraIds);
  config.camera_tap_actions = normalizeCameraTapActions(config.camera_tap_actions, cameraIds);
  config.camera_actions = normalizeCameraActions(config.camera_actions, cameraIds);
  config.expanded_actions = normalizeExpandedActions(config.expanded_actions);
  config.language = String(config.language ?? "auto").trim() || "auto";
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? { ...DEFAULT_CONFIG.security, ...(isObject(config.security) ? config.security : {}) };

  const applyTap = window.NodaliaUtils?.applyCardTapActionField?.bind(window.NodaliaUtils);
  if (typeof applyTap === "function") {
    applyTap(config, {
      actionKey: "tap_action",
      serviceKey: "tap_service",
      serviceDataKey: "tap_service_data",
      serviceTargetKey: "tap_service_target",
      urlKey: "tap_url",
      navigationKey: "navigation_path",
      newTabKey: "tap_new_tab",
    }, raw.tap_action ?? config.tap_action, "more-info");
    applyTap(config, {
      actionKey: "hold_action",
      serviceKey: "hold_service",
      serviceDataKey: "hold_service_data",
      serviceTargetKey: "hold_service_target",
      urlKey: "hold_url",
      navigationKey: "hold_navigation_path",
      newTabKey: "hold_new_tab",
    }, raw.hold_action ?? config.hold_action, "none");
  }

  config.tap_action = TAP_ACTIONS.has(normalizeTextKey(config.tap_action))
    ? normalizeTextKey(config.tap_action)
    : DEFAULT_CONFIG.tap_action;
  config.hold_action = HOLD_ACTIONS.has(normalizeTextKey(config.hold_action))
    ? normalizeTextKey(config.hold_action)
    : DEFAULT_CONFIG.hold_action;
  const serializeActionObject = (value: unknown) => (
    isObject(value) ? JSON.stringify(value) : String(value ?? "").trim()
  );
  config.tap_service = String(config.tap_service ?? "").trim();
  config.tap_service_data = serializeActionObject(config.tap_service_data);
  config.tap_service_target = serializeActionObject(config.tap_service_target);
  config.tap_url = String(config.tap_url ?? "").trim();
  config.navigation_path = String(config.navigation_path ?? "").trim();
  config.hold_service = String(config.hold_service ?? "").trim();
  config.hold_service_data = serializeActionObject(config.hold_service_data);
  config.hold_service_target = serializeActionObject(config.hold_service_target);
  config.hold_url = String(config.hold_url ?? "").trim();
  config.hold_navigation_path = String(config.hold_navigation_path ?? "").trim();
  if (config.tap_action === "navigate" && !config.navigation_path && config.tap_url) {
    config.navigation_path = config.tap_url;
  }
  if (config.hold_action === "navigate" && !config.hold_navigation_path && config.hold_url) {
    config.hold_navigation_path = config.hold_url;
  }
  config.styles = window.NodaliaUtils?.sanitizeStyleTree?.(config.styles, DEFAULT_CONFIG.styles)
    ?? deepClone(DEFAULT_CONFIG.styles);
  return config;
}
