// @ts-nocheck -- merged Lovelace YAML is projected into the runtime entity config.
import {
  AIR_QUALITY_GRAPH_SERIES_COLORS,
  AIR_QUALITY_METRIC_KEYS,
  LEGACY_ICON_OFF_COLOR_VALUES,
  NETWORK_ROLES,
  OVERVIEW_LAYOUTS,
} from "./entity-constants";
import { clamp, deepClone, isObject, mergeConfig, sanitizeCssValue } from "./entity-runtime";

export const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  icon_active: "",
  icon_inactive: "",
  use_entity_icon: true,
  entity_picture: "",
  show_entity_picture: false,
  number_decimals: 2,
  tap_action: "auto",
  tap_service: "",
  tap_service_data: "",
  tap_service_target: "",
  tap_url: "",
  navigation_path: "",
  tap_new_tab: false,
  icon_tap_action: "",
  icon_tap_service: "",
  icon_tap_service_data: "",
  icon_tap_service_target: "",
  icon_tap_url: "",
  icon_navigation_path: "",
  icon_tap_new_tab: false,
  hold_action: "more-info",
  hold_service: "",
  hold_service_data: "",
  hold_service_target: "",
  hold_url: "",
  hold_navigation_path: "",
  hold_new_tab: false,
  icon_hold_action: "",
  icon_hold_service: "",
  icon_hold_service_data: "",
  icon_hold_service_target: "",
  icon_hold_url: "",
  icon_hold_navigation_path: "",
  icon_hold_new_tab: false,
  double_tap_action: "none",
  icon_double_tap_action: "",
  double_tap_service: "",
  double_tap_service_data: "",
  double_tap_service_target: "",
  double_tap_url: "",
  double_tap_navigation_path: "",
  double_tap_new_tab: false,
  icon_double_tap_service: "",
  icon_double_tap_service_data: "",
  icon_double_tap_service_target: "",
  icon_double_tap_url: "",
  icon_double_tap_navigation_path: "",
  icon_double_tap_new_tab: false,
  show_state: true,
  state_chip_on_title_row: false,
  state_position: "below",
  primary_attribute: "",
  secondary_attribute: "",
  show_primary_chip: true,
  show_secondary_chip: true,
  compact_layout_mode: "auto",
  layout: "default",
  air_quality: {
    pm1: "",
    pm25: "",
    pm4: "",
    pm10: "",
    tvoc: "",
    temperature: "",
    humidity: "",
    co2: "",
    guidelines: "who",
    show_graphs: false,
    graph_hours: 24,
    graph_points: 96,
    graph_series: {
      pm1: true,
      pm25: true,
      pm4: true,
      pm10: true,
      tvoc: true,
      co2: true,
      temperature: true,
      humidity: true,
    },
    graph_colors: {
      pm1: "#f29f05",
      pm25: "#42a5f5",
      pm4: "#7fd0c8",
      pm10: "#f56aa0",
      tvoc: "#b993ff",
      co2: "#7ad66f",
      temperature: "#d4783a",
      humidity: "#3f9d7a",
    },
  },
  battery: {
    entities: [],
  },
  network: {
    entities: [],
  },
  quick_actions: [],
  language: "auto",
  security: {
    strict_service_actions: true,
    allowed_services: [],
    allowed_service_domains: ["homeassistant"],
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
      gap: "12px",
    },
    icon: {
      size: "38px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      on_color: "var(--info-color, #71c0ff)",
      off_color: "var(--primary-text-color)",
    },
    control: {
      size: "36px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(113, 192, 255, 0.18)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    title_size: "12px",
  },
};

export const STUB_CONFIG = {
  entity: "switch.lampara",
  name: "Lampara",
  number_decimals: 2,
  tap_action: "auto",
  show_state: true,
  state_chip_on_title_row: false,
  state_position: "below",
  quick_actions: [
    {
      icon: "mdi:power",
      type: "toggle",
      label: "Toggle",
    },
    {
      icon: "mdi:cog",
      type: "more-info",
      label: "Detalles",
    },
  ],
};


export function migrateLegacyIconOffColor(iconStyles, canonicalOffColor) {
  if (!iconStyles) {
    return;
  }
  const raw = String(iconStyles.off_color ?? "").trim();
  if (!raw) {
    return;
  }
  if (LEGACY_ICON_OFF_COLOR_VALUES.includes(raw)) {
    iconStyles.off_color = canonicalOffColor;
    return;
  }
  if (/^var\(\s*--state-inactive-color/i.test(raw)) {
    iconStyles.off_color = canonicalOffColor;
  }
}

export function entityScalar(value) {
  return String(value ?? "").trim();
}

export function normalizeAirQualityBlock(raw) {
  const source = isObject(raw) ? raw : {};
  const hours = Number(source.graph_hours);
  const points = Number(source.graph_points);
  const graphSeries = isObject(source.graph_series) ? source.graph_series : {};
  const graphColors = isObject(source.graph_colors) ? source.graph_colors : {};
  return {
    pm1: entityScalar(source.pm1),
    pm25: entityScalar(source.pm25 ?? source.pm2_5 ?? source["pm2.5"]),
    pm4: entityScalar(source.pm4),
    pm10: entityScalar(source.pm10),
    tvoc: entityScalar(source.tvoc),
    temperature: entityScalar(source.temperature),
    humidity: entityScalar(source.humidity),
    co2: entityScalar(source.co2),
    guidelines: String(source.guidelines ?? "who").trim().toLowerCase() === "none" ? "none" : "who",
    show_graphs: source.show_graphs === true,
    graph_hours: Number.isFinite(hours) ? clamp(Math.round(hours), 1, 168) : 24,
    graph_points: Number.isFinite(points) ? clamp(Math.round(points), 8, 96) : 96,
    graph_series: Object.fromEntries(AIR_QUALITY_METRIC_KEYS.map(kind => [
      kind,
      graphSeries[kind] !== false,
    ])),
    graph_colors: Object.fromEntries(AIR_QUALITY_METRIC_KEYS.map(kind => [
      kind,
      sanitizeCssValue(graphColors[kind], AIR_QUALITY_GRAPH_SERIES_COLORS[kind]),
    ])),
  };
}

export const AIR_QUALITY_COMFORT_KEYS = new Set(["temperature", "humidity"]);
export const AIR_QUALITY_HISTORY_REFRESH_MS = 180000;
export const OVERVIEW_LAYOUTS = new Set(["battery", "network"]);
export const NETWORK_ROLES = new Set(["auto", "status", "download", "upload", "latency", "signal", "traffic"]);

export function normalizeOverviewEntities(raw, options = {}) {
  const entries = Array.isArray(raw) ? raw : [];
  return entries
    .filter(item => typeof item === "string" || isObject(item))
    .map(item => {
      const source = typeof item === "string" ? { entity: item } : item;
      const normalized = {
        entity: entityScalar(source.entity),
        name: String(source.name ?? "").trim(),
        icon: String(source.icon ?? "").trim(),
      };
      if (options.network === true) {
        const role = String(source.role ?? "auto").trim().toLowerCase();
        normalized.role = NETWORK_ROLES.has(role) ? role : "auto";
      }
      return normalized;
    })
    .filter(item => item.entity || item.name || item.icon)
    .slice(0, 16);
}

export function normalizeBatteryBlock(raw) {
  const source = isObject(raw) ? raw : {};
  return { entities: normalizeOverviewEntities(source.entities) };
}

export function normalizeNetworkBlock(raw) {
  const source = isObject(raw) ? raw : {};
  return { entities: normalizeOverviewEntities(source.entities, { network: true }) };
}

export function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  config.styles.icon.background = window.NodaliaBubbleContrast?.normalizeNeutralBubbleBackground?.(
    config.styles.icon.background,
    DEFAULT_CONFIG.styles.icon.background,
  ) || config.styles.icon.background;
  const normalizedStatePosition = String(config.state_position || "").toLowerCase();
  if (normalizedStatePosition === "right" || normalizedStatePosition === "below") {
    config.state_position = normalizedStatePosition;
  } else {
    config.state_position = config.state_chip_on_title_row === true ? "right" : "below";
  }

  config.quick_actions = Array.isArray(config.quick_actions)
    ? config.quick_actions
      .filter(action => isObject(action))
      .map(action => ({
        icon: action.icon || "mdi:flash",
        type: action.type || "toggle",
        label: action.label || "",
        entity: action.entity || "",
        service: action.service || "",
        service_data: action.service_data || "",
      }))
    : [];

  migrateLegacyIconOffColor(config.styles?.icon, DEFAULT_CONFIG.styles.icon.off_color);

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
    }, rawConfig?.tap_action ?? config.tap_action, "auto");
    applyTap(config, {
      actionKey: "hold_action",
      serviceKey: "hold_service",
      serviceDataKey: "hold_service_data",
      serviceTargetKey: "hold_service_target",
      urlKey: "hold_url",
      navigationKey: "hold_navigation_path",
      newTabKey: "hold_new_tab",
    }, rawConfig?.hold_action ?? config.hold_action, "none");
    applyTap(config, {
      actionKey: "icon_tap_action",
      serviceKey: "icon_tap_service",
      serviceDataKey: "icon_tap_service_data",
      serviceTargetKey: "icon_tap_service_target",
      urlKey: "icon_tap_url",
      navigationKey: "icon_navigation_path",
      newTabKey: "icon_tap_new_tab",
    }, rawConfig?.icon_tap_action ?? config.icon_tap_action, "");
    applyTap(config, {
      actionKey: "icon_hold_action",
      serviceKey: "icon_hold_service",
      serviceDataKey: "icon_hold_service_data",
      serviceTargetKey: "icon_hold_service_target",
      urlKey: "icon_hold_url",
      navigationKey: "icon_hold_navigation_path",
      newTabKey: "icon_hold_new_tab",
    }, rawConfig?.icon_hold_action ?? config.icon_hold_action, "");
    applyTap(config, {
      actionKey: "double_tap_action",
      serviceKey: "double_tap_service",
      serviceDataKey: "double_tap_service_data",
      serviceTargetKey: "double_tap_service_target",
      urlKey: "double_tap_url",
      navigationKey: "double_tap_navigation_path",
      newTabKey: "double_tap_new_tab",
    }, rawConfig?.double_tap_action ?? config.double_tap_action, "none");
    applyTap(config, {
      actionKey: "icon_double_tap_action",
      serviceKey: "icon_double_tap_service",
      serviceDataKey: "icon_double_tap_service_data",
      serviceTargetKey: "icon_double_tap_service_target",
      urlKey: "icon_double_tap_url",
      navigationKey: "icon_double_tap_navigation_path",
      newTabKey: "icon_double_tap_new_tab",
    }, rawConfig?.icon_double_tap_action ?? config.icon_double_tap_action, "");
  }
  if (String(config.icon_tap_action || "").trim() === "") {
    config.icon_tap_action = "";
  }
  if (String(config.icon_hold_action || "").trim() === "") {
    config.icon_hold_action = "";
  }
  if (String(config.icon_double_tap_action || "").trim() === "") {
    config.icon_double_tap_action = "";
  }
  const serializeActionObject = value => (
    isObject(value) ? JSON.stringify(value) : String(value ?? "").trim()
  );
  config.tap_service = String(config.tap_service ?? "").trim();
  config.tap_service_data = serializeActionObject(config.tap_service_data);
  config.tap_service_target = serializeActionObject(config.tap_service_target);
  config.tap_url = String(config.tap_url ?? "").trim();
  config.navigation_path = String(config.navigation_path ?? "").trim();
  config.tap_new_tab = config.tap_new_tab === true;
  config.icon_tap_service = String(config.icon_tap_service ?? "").trim();
  config.icon_tap_service_data = serializeActionObject(config.icon_tap_service_data);
  config.icon_tap_service_target = serializeActionObject(config.icon_tap_service_target);
  config.icon_tap_url = String(config.icon_tap_url ?? "").trim();
  config.icon_navigation_path = String(config.icon_navigation_path ?? "").trim();
  config.icon_tap_new_tab = config.icon_tap_new_tab === true;
  config.hold_service = String(config.hold_service ?? "").trim();
  config.hold_service_data = serializeActionObject(config.hold_service_data);
  config.hold_service_target = serializeActionObject(config.hold_service_target);
  config.hold_url = String(config.hold_url ?? "").trim();
  config.hold_navigation_path = String(config.hold_navigation_path ?? "").trim();
  config.hold_new_tab = config.hold_new_tab === true;
  config.icon_hold_service = String(config.icon_hold_service ?? "").trim();
  config.icon_hold_service_data = serializeActionObject(config.icon_hold_service_data);
  config.icon_hold_service_target = serializeActionObject(config.icon_hold_service_target);
  config.icon_hold_url = String(config.icon_hold_url ?? "").trim();
  config.icon_hold_navigation_path = String(config.icon_hold_navigation_path ?? "").trim();
  config.icon_hold_new_tab = config.icon_hold_new_tab === true;
  if (config.tap_action === "navigate" && !config.navigation_path && config.tap_url) {
    config.navigation_path = config.tap_url;
  }
  if (config.hold_action === "navigate" && !config.hold_navigation_path && config.hold_url) {
    config.hold_navigation_path = config.hold_url;
  }
  config.language = String(config.language ?? "auto").trim() || "auto";
  config.double_tap_service = String(config.double_tap_service ?? "").trim();
  config.double_tap_service_data = serializeActionObject(config.double_tap_service_data);
  config.double_tap_service_target = serializeActionObject(config.double_tap_service_target);
  config.double_tap_url = String(config.double_tap_url ?? "").trim();
  config.double_tap_navigation_path = String(config.double_tap_navigation_path ?? "").trim();
  config.double_tap_new_tab = config.double_tap_new_tab === true;
  config.icon_double_tap_service = String(config.icon_double_tap_service ?? "").trim();
  config.icon_double_tap_service_data = serializeActionObject(config.icon_double_tap_service_data);
  config.icon_double_tap_service_target = serializeActionObject(config.icon_double_tap_service_target);
  config.icon_double_tap_url = String(config.icon_double_tap_url ?? "").trim();
  config.icon_double_tap_navigation_path = String(config.icon_double_tap_navigation_path ?? "").trim();
  config.icon_double_tap_new_tab = config.icon_double_tap_new_tab === true;
  if (config.double_tap_action === "navigate" && !config.double_tap_navigation_path && config.double_tap_url) {
    config.double_tap_navigation_path = config.double_tap_url;
  }
  config.entity_picture = String(config.entity_picture ?? "").trim();
  config.show_entity_picture = config.show_entity_picture === true;
  const layoutKey = String(config.layout ?? "default").trim().toLowerCase();
  config.layout = layoutKey === "air_quality" || OVERVIEW_LAYOUTS.has(layoutKey) ? layoutKey : "default";
  config.air_quality = normalizeAirQualityBlock(config.air_quality);
  config.battery = normalizeBatteryBlock(config.battery);
  config.network = normalizeNetworkBlock(config.network);
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? { ...DEFAULT_CONFIG.security, ...(isObject(config.security) ? config.security : {}) };
  config.styles = window.NodaliaUtils?.sanitizeStyleTree?.(config.styles, DEFAULT_CONFIG.styles)
    ?? deepClone(DEFAULT_CONFIG.styles);

  return config;
}
