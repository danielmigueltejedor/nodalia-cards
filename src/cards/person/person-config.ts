// @ts-nocheck -- merged Lovelace YAML is projected into the runtime person config.
import { deepClone, isObject, mergeConfig } from "./person-runtime";

export const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  tap_action: "more-info",
  tap_service: "",
  tap_service_data: "",
  tap_service_target: "",
  tap_url: "",
  navigation_path: "",
  tap_new_tab: false,
  tap_action_entity: "",
  hold_action: "none",
  hold_service: "",
  hold_service_data: "",
  hold_service_target: "",
  hold_url: "",
  hold_navigation_path: "",
  hold_new_tab: false,
  hold_action_entity: "",
  double_tap_action: "none",
  double_tap_service: "",
  double_tap_service_data: "",
  double_tap_service_target: "",
  double_tap_url: "",
  double_tap_navigation_path: "",
  double_tap_new_tab: false,
  double_tap_action_entity: "",
  language: "auto",
  show_name: true,
  show_state: true,
  show_zone_badge: true,
  use_entity_picture: true,
  use_zone_icon: true,
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
  security: {
    strict_service_actions: true,
    allowed_services: [],
    allowed_service_domains: [],
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "var(--nodalia-card-border-radius, 28px)",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "12px",
      gap: "12px",
    },
    avatar: {
      size: "38px",
      background: "rgba(255, 255, 255, 0.06)",
      color: "var(--primary-text-color)",
    },
    badge: {
      size: "22px",
    },
    title_size: "12px",
    subtitle_size: "9px",
    chip_border_radius: "999px",
  },
};

export const STUB_CONFIG = {
  entity: "person.ana",
  name: "Ana",
};

export function normalizeConfig(rawConfig) {
  const raw = isObject(rawConfig) ? rawConfig : {};
  const config = mergeConfig(DEFAULT_CONFIG, raw);
  const actionDefinitions = [
    {
      prefix: "tap",
      rawValue: raw.tap_action ?? config.tap_action,
      fallback: "more-info",
      navigationKey: "navigation_path",
    },
    {
      prefix: "hold",
      rawValue: raw.hold_action ?? config.hold_action,
      fallback: "none",
      navigationKey: "hold_navigation_path",
    },
    {
      prefix: "double_tap",
      rawValue: raw.double_tap_action ?? config.double_tap_action,
      fallback: "none",
      navigationKey: "double_tap_navigation_path",
    },
  ];
  const applyAction = window.NodaliaUtils?.applyCardTapActionField?.bind(window.NodaliaUtils);
  if (typeof applyAction === "function") {
    actionDefinitions.forEach(({ prefix, rawValue, fallback, navigationKey }) => {
      applyAction(config, {
        actionKey: `${prefix}_action`,
        serviceKey: `${prefix}_service`,
        serviceDataKey: `${prefix}_service_data`,
        serviceTargetKey: `${prefix}_service_target`,
        urlKey: `${prefix}_url`,
        navigationKey,
        newTabKey: `${prefix}_new_tab`,
      }, rawValue, fallback);
    });
  }

  const allowedActions = new Set(["toggle", "more-info", "service", "navigate", "url", "none"]);
  const serializeActionObject = value => (
    isObject(value) ? JSON.stringify(value) : String(value ?? "").trim()
  );
  actionDefinitions.forEach(({ prefix, rawValue, fallback, navigationKey }) => {
    const actionKey = `${prefix}_action`;
    const normalizedAction = String(config[actionKey] ?? fallback).trim().toLowerCase();
    config[actionKey] = allowedActions.has(normalizedAction) ? normalizedAction : fallback;
    config[`${prefix}_service`] = String(config[`${prefix}_service`] ?? "").trim();
    config[`${prefix}_service_data`] = serializeActionObject(config[`${prefix}_service_data`]);
    config[`${prefix}_service_target`] = serializeActionObject(config[`${prefix}_service_target`]);
    config[`${prefix}_url`] = String(config[`${prefix}_url`] ?? "").trim();
    config[navigationKey] = String(config[navigationKey] ?? "").trim();
    config[`${prefix}_new_tab`] = config[`${prefix}_new_tab`] === true;
    const configuredEntity = isObject(rawValue) ? rawValue.entity : config[`${prefix}_action_entity`];
    config[`${prefix}_action_entity`] = String(configuredEntity ?? "").trim();
  });
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? mergeConfig(DEFAULT_CONFIG.security, config.security || {});
  config.styles = window.NodaliaUtils?.sanitizeStyleTree?.(config.styles, DEFAULT_CONFIG.styles)
    ?? deepClone(DEFAULT_CONFIG.styles);
  return config;
}
