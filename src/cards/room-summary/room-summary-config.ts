// @ts-nocheck -- merged Lovelace YAML is projected into the runtime room-summary config.
import { COMFORT, CUSTOMIZABLE_EMBED_LISTS, NORMALIZED_ROOM_CONFIG } from "./room-summary-constants";
import {
  buildNormalizedRoomSummary,
  collectHubMediaPlayerIds,
  deepClone,
  hasNormalizedRoomContent,
  isObject,
  mergeConfig,
} from "./room-summary-runtime";
import { entityList, entityScalar } from "./room-summary-helpers";

export const DEFAULT_CONFIG = {
  name: "",
  icon: "mdi:floor-plan",
  image: "",
  language: "auto",
  layout: "hub",
  collapsible: false,
  temperature: "",
  humidity: "",
  presence: "",
  occupancy: "",
  climate: "",
  camera: "",
  camera_config: {},
  media_player: "",
  media_players: [],
  media_config: {},
  vacuums: [],
  fans: [],
  humidifiers: [],
  others: [],
  embed_options: {
    lights: [],
    vacuums: [],
    fans: [],
    humidifiers: [],
    others: [],
  },
  power: "",
  air_quality: "",
  lights: [],
  covers: [],
  locks: [],
  doors: [],
  windows: [],
  alerts: [],
  alarms: [],
  show_temperature: true,
  show_humidity: true,
  show_presence: true,
  show_lights: true,
  show_covers: true,
  show_climate: true,
  show_camera: true,
  show_media: true,
  show_security: true,
  show_power: true,
  show_quick_actions: true,
  tap_action: "more-info",
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
  haptics: { enabled: true, style: "medium", fallback_vibrate: false },
  animations: { enabled: true, content_duration: 420, button_bounce_duration: 320 },
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
    },
    control: {
      size: "36px",
      accent_color: "var(--primary-text-color)",
      accent_background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    title_size: "16px",
    metric_size: "14px",
    accent: "var(--primary-color)",
    embed_off_tint: "color-mix(in srgb, var(--primary-text-color) 5%, transparent)",
    hub: {
      metric_chip_font_size: "10px",
      metric_chip_height: "24px",
      metric_chip_padding: "0 8px",
      metric_chip_icon_size: "13px",
      context_action_size: "42px",
      context_action_icon_size: "20px",
      embed_title_size: "11px",
      embed_chip_font_size: "10px",
      embed_chip_height: "22px",
      embed_chip_padding: "0 7px",
      device_name_size: "12px",
      device_state_size: "10px",
    },
  },
};

export const STUB_CONFIG = {
  name: "Living room",
  icon: "mdi:sofa",
  layout: "hub",
  temperature: "sensor.living_room_temperature",
  humidity: "sensor.living_room_humidity",
  presence: "binary_sensor.living_room_presence",
  lights: ["light.living_room"],
  covers: ["cover.living_room_blind"],
  climate: "climate.living_room",
  vacuums: ["vacuum.living_room"],
  media_player: "media_player.living_room",
};

export function hubMediaPlayerIds(config) {
  return collectHubMediaPlayerIds(normalizeConfig(config || {}));
}

export function normalizeConfig(rawConfig = {}) {
  if (rawConfig?.[NORMALIZED_ROOM_CONFIG] === true) {
    return rawConfig;
  }
  const raw = isObject(rawConfig) ? rawConfig : {};
  const config = mergeConfig(DEFAULT_CONFIG, raw);

  config.name = String(config.name ?? "").trim();
  config.icon = String(config.icon ?? DEFAULT_CONFIG.icon).trim() || DEFAULT_CONFIG.icon;
  config.image = String(config.image ?? "").trim();
  config.language = String(config.language ?? "auto").trim() || "auto";
  config.layout = "hub";
  delete config.density;

  config.temperature = entityScalar(config.temperature, config.temperature_entity);
  config.humidity = entityScalar(config.humidity, config.humidity_entity);
  config.presence = entityScalar(config.presence, config.occupancy_entity, config.occupancy);
  config.occupancy = entityScalar(config.occupancy, config.presence);
  config.climate = entityScalar(config.climate, config.climate_entity);
  config.camera_config = isObject(config.camera_config) ? deepClone(config.camera_config) : {};
  config.camera = entityScalar(
    config.camera,
    config.camera_config.entity,
    Array.isArray(config.camera_config.cameras) ? config.camera_config.cameras[0] : "",
  );
  if (config.camera) {
    config.camera_config.entity = config.camera;
    const cameras = Array.isArray(config.camera_config.cameras)
      ? config.camera_config.cameras.map(id => String(id || "").trim()).filter(Boolean)
      : [];
    if (!cameras.includes(config.camera)) {
      config.camera_config.cameras = [config.camera, ...cameras];
    }
  }
  config.media_config = isObject(config.media_config) ? deepClone(config.media_config) : {};
  config.media_config.players = Array.isArray(config.media_config.players)
    ? config.media_config.players.filter(isObject).map(player => deepClone(player))
    : [];
  const nativeMediaIds = config.media_config.players.map(player => String(player.entity || "").trim()).filter(Boolean);
  config.media_player = entityScalar(config.media_player, nativeMediaIds[0]);
  config.media_players = entityList(config.media_players, config.media_player_entities);
  if (config.media_player) {
    config.media_players = config.media_players.filter(id => id !== config.media_player);
  }
  config.vacuums = entityList(config.vacuums, config.vacuum, config.vacuum_entities);
  config.fans = entityList(config.fans, config.fan_entities);
  config.humidifiers = entityList(config.humidifiers, config.humidifier_entities);
  config.others = entityList(config.others, config.other_entities, config.entities);
  config.power = entityScalar(config.power);
  config.air_quality = entityScalar(config.air_quality);

  config.lights = entityList(config.lights, config.light_entities);
  config.covers = entityList(config.covers, config.cover_entities);
  config.locks = entityList(config.locks);
  config.doors = entityList(config.doors);
  config.windows = entityList(config.windows);
  config.alerts = entityList(config.alerts, config.motion_entities);
  config.alarms = entityList(config.alarms, config.alarm, config.alarm_entities);
  const rawEmbedOptions = isObject(config.embed_options) ? config.embed_options : {};
  config.embed_options = {};
  CUSTOMIZABLE_EMBED_LISTS.forEach(listKey => {
    const options = Array.isArray(rawEmbedOptions[listKey]) ? rawEmbedOptions[listKey].filter(isObject) : [];
    config.embed_options[listKey] = config[listKey].map((entity, index) => {
      const byEntity = options.find(option => String(option.entity || "").trim() === entity);
      const source = byEntity || options[index] || {};
      return {
        ...deepClone(source),
        entity,
        name: String(source.name || "").trim(),
        icon: String(source.icon || "").trim(),
      };
    });
  });

  config.navigation_path = String(config.navigation_path ?? "").trim();
  config.show_temperature = config.show_temperature !== false;
  config.show_humidity = config.show_humidity !== false;
  config.show_presence = config.show_presence !== false && config.show_occupancy !== false;
  config.show_lights = config.show_lights !== false && config.show_lights_summary !== false;
  config.show_covers = config.show_covers !== false && config.show_covers_summary !== false;
  config.show_climate = config.show_climate !== false;
  config.show_camera = config.show_camera !== false;
  config.show_media = config.show_media !== false;
  config.show_security = config.show_security !== false;
  config.show_power = config.show_power !== false;
  config.show_quick_actions = config.show_quick_actions !== false;

  const applyTap = window.NodaliaUtils?.applyCardTapActionField?.bind(window.NodaliaUtils);
  if (typeof applyTap === "function") {
    applyTap(config, {
      actionKey: "tap_action", serviceKey: "tap_service", serviceDataKey: "tap_service_data",
      serviceTargetKey: "tap_service_target", urlKey: "tap_url", navigationKey: "navigation_path", newTabKey: "tap_new_tab",
    }, raw.tap_action ?? config.tap_action, "more-info");
    applyTap(config, {
      actionKey: "hold_action", serviceKey: "hold_service", serviceDataKey: "hold_service_data",
      serviceTargetKey: "hold_service_target", urlKey: "hold_url", navigationKey: "hold_navigation_path", newTabKey: "hold_new_tab",
    }, raw.hold_action ?? config.hold_action, "none");
  }

  config.haptics = mergeConfig(DEFAULT_CONFIG.haptics, config.haptics || {});
  config.animations = mergeConfig(DEFAULT_CONFIG.animations, config.animations || {});
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? mergeConfig(DEFAULT_CONFIG.security, config.security || {});
  config.styles = window.NodaliaUtils?.sanitizeStyleTree?.(config.styles, DEFAULT_CONFIG.styles)
    ?? deepClone(DEFAULT_CONFIG.styles);
  Object.defineProperty(config, NORMALIZED_ROOM_CONFIG, {
    configurable: false,
    enumerable: false,
    value: true,
  });
  return config;
}

export function hasRoomContent(config) {
  const normalized = normalizeConfig(config || {});
  return Boolean(String(normalized.name || "").trim()) || hasNormalizedRoomContent(normalized);
}

export function buildRoomSummary(hass, config) {
  const c = normalizeConfig(config || {});
  return buildNormalizedRoomSummary(hass, c, COMFORT);
}
