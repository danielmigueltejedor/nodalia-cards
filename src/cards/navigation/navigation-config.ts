// @ts-nocheck -- merged Lovelace YAML is projected into the runtime navigation config.
import { isObject, mergeConfig } from "./navigation-runtime";

export const DEFAULT_CONFIG = {
  title: "",
  show_labels: false,
  animations: {
    enabled: true,
    bar_duration: 160,
    popup_duration: 220,
    media_duration: 240,
    button_bounce_duration: 220,
    dock_entrance_duration: 420,
  },
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  security: {
    strict_service_actions: true,
    allowed_services: [],
    allowed_service_domains: [],
  },
  layout: {
    fixed: true,
    reserve_space: true,
    reserve_height: "calc(90px + env(safe-area-inset-bottom, 0px))",
    position: "bottom",
    stack_gap: "12px",
    show_desktop: false,
    mobile_breakpoint: 1279,
    z_index: 2,
    side_margin: "0px",
    offset: "0px",
    full_width: false,
  },
  styles: {
    bar: {
      background: "var(--ha-card-background, var(--card-background-color, rgba(32, 34, 42, 0.94)))",
      border: "1px solid var(--divider-color)",
      border_radius: "var(--nodalia-card-border-radius, 28px)",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px)) 16px",
      min_height: "90px",
      gap: "20px",
      justify_content: "space-evenly",
      max_width: "100%",
      backdrop_filter: "none",
    },
    button: {
      size: "54px",
      border_radius: "999px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      active_color: "var(--primary-text-color)",
      active_background: "color-mix(in srgb, var(--primary-text-color) 8%, transparent)",
      icon_size: "28px",
      icon_offset_x: "0px",
      icon_offset_y: "-1px",
      label_color: "var(--secondary-text-color)",
      active_label_color: "var(--primary-text-color)",
      label_size: "12px",
      label_gap: "6px",
    },
    badge: {
      background: "var(--error-color)",
      color: "var(--text-primary-color, #fff)",
      min_size: "18px",
      font_size: "11px",
    },
    popup: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "24px",
      box_shadow: "0 18px 40px rgba(0, 0, 0, 0.22)",
      layout: "auto",
      label_size: "13px",
      padding: "12px",
      min_width: "220px",
      max_width: "380px",
      item_gap: "12px",
      item_size: "48px",
      backdrop: "rgba(0, 0, 0, 0.18)",
    },
    media_player: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "var(--nodalia-card-border-radius, 28px)",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "14px",
      min_height: "104px",
      artwork_size: "64px",
      control_size: "40px",
      title_size: "12px",
      subtitle_size: "10px",
      progress_color: "var(--primary-color)",
      progress_background: "rgba(var(--rgb-primary-color), 0.14)",
      overlay_color: "rgba(0, 0, 0, 0.32)",
      dot_size: "8px",
    },
  },
  media_player: {
    show: undefined,
    show_desktop: false,
    album_cover_background: true,
    gap: "0px",
    reserve_height: "116px",
    players: [],
  },
  routes: [],
};

export const STUB_CONFIG = {
  show_labels: false,
  layout: {
    show_desktop: true,
  },
  styles: {
    bar: {
      border_radius: "32px",
      padding: "12px 16px",
    },
    button: {
      size: "60px",
      label_size: "8px",
    },
    popup: {
      max_width: "320px",
      item_size: "32px",
    },
    media_player: {
      border_radius: "24px",
      padding: "10px",
      artwork_size: "92px",
    },
  },
  routes: [
    { icon: "mdi:view-dashboard", label: "Home", path: "/lovelace/home" },
    { icon: "mdi:devices", label: "Devices", path: "/config/devices/dashboard" },
    { icon: "mdi:creation", label: "Automations", path: "/config/automation/dashboard" },
    { icon: "mdi:cog", label: "Settings", path: "/config/dashboard" },
    { icon: "mdi:account", label: "Profile", path: "/profile" },
    { icon: "mdi:dots-horizontal", label: "More", path: "/config/dashboard" },
  ],
};

export function normalizeConfig(config) {
  const baseConfig = { ...config };

  if (!Array.isArray(baseConfig.routes) && Array.isArray(baseConfig.items)) {
    baseConfig.routes = baseConfig.items;
    delete baseConfig.items;
  }

  if (!Array.isArray(baseConfig.routes)) {
    throw new Error('"routes" is required and must be an array');
  }

  const mergedConfig = mergeConfig(DEFAULT_CONFIG, baseConfig);
  mergedConfig.security = window.NodaliaUtils?.normalizeSecurityConfig?.(mergedConfig.security, DEFAULT_CONFIG.security)
    ?? {
      ...DEFAULT_CONFIG.security,
      ...(isObject(mergedConfig.security) ? mergedConfig.security : {}),
    };
  return mergedConfig;
}
