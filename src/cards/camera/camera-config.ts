// @ts-nocheck -- merged Lovelace YAML is projected into the runtime camera config.
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

export const DEFAULT_CONFIG = {
  entity: "",
  cameras: [],
  name: "",
  layout: CAMERA_LAYOUT,
  presentation: CAMERA_PRESENTATION,
  language: "auto",
  show_name: false,
  show_state: false,
  show_status_chips: false,
  show_last_changed: false,
  show_preview_age: true,
  camera_streams: [],
  camera_tap_actions: [],
  camera_actions: [],
  expanded_actions: [],
  tap_action: "toggle",
  tap_service: "",
  tap_service_data: "",
  tap_service_target: "",
  tap_url: "",
  navigation_path: "",
  tap_new_tab: false,
  hold_action: "none",
  hold_service: "",
  hold_service_data: "",
  hold_service_target: "",
  hold_url: "",
  hold_navigation_path: "",
  hold_new_tab: false,
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
  animations: {
    enabled: true,
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
      gap: "10px",
    },
    preview: {
      aspect_ratio: "16 / 9",
      border_radius: "18px",
      overlay_strength: 0.42,
      min_height: "220px",
      mosaic_gap: "0px",
    },
    title_size: "15px",
    subtitle_size: "12px",
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
  },
};

export const STUB_CONFIG = {
  entity: "camera.entrada",
  name: "Entrada",
};

export function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
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
    }, rawConfig?.tap_action ?? config.tap_action, "more-info");
    applyTap(config, {
      actionKey: "hold_action",
      serviceKey: "hold_service",
      serviceDataKey: "hold_service_data",
      serviceTargetKey: "hold_service_target",
      urlKey: "hold_url",
      navigationKey: "hold_navigation_path",
      newTabKey: "hold_new_tab",
    }, rawConfig?.hold_action ?? config.hold_action, "none");
  }

  config.tap_action = TAP_ACTIONS.has(normalizeTextKey(config.tap_action))
    ? normalizeTextKey(config.tap_action)
    : DEFAULT_CONFIG.tap_action;
  config.hold_action = HOLD_ACTIONS.has(normalizeTextKey(config.hold_action))
    ? normalizeTextKey(config.hold_action)
    : DEFAULT_CONFIG.hold_action;
  const serializeActionObject = value => (
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
