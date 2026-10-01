import { normalizeControlStyles } from "../../shared/control-config";
import type { HomeAssistant } from "../../core/types/home-assistant";
import type { RoomProjectionConfig } from "./room-summary-model";
const normalizedRoomConfigs = new WeakMap<object, ReturnType<typeof buildRoomConfig>>();
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

import { DEFAULT_CONFIG } from "./room-summary-defaults";
export { DEFAULT_CONFIG } from "./room-summary-defaults";

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

export function hubMediaPlayerIds(config: unknown = {}) {
  return collectHubMediaPlayerIds(normalizeConfig(config || {}));
}

export function normalizeConfig(rawConfig: unknown = {}) {
  if (isObject(rawConfig) && Reflect.get(rawConfig, NORMALIZED_ROOM_CONFIG) === true) {
    const cached = normalizedRoomConfigs.get(rawConfig);
    if (cached) return cached;
  }
  const normalized = buildRoomConfig(rawConfig);
  Object.defineProperty(normalized, NORMALIZED_ROOM_CONFIG, { configurable: false, enumerable: false, value: true });
  normalizedRoomConfigs.set(normalized, normalized);
  return normalized;
}

function buildRoomConfig(rawConfig: unknown = {}) {
  const raw = isObject(rawConfig) ? rawConfig : {};
  const config = mergeConfig<Record<string, unknown>>(DEFAULT_CONFIG, raw);

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
  const cameraConfig: Record<string, unknown> = isObject(config.camera_config) ? deepClone(config.camera_config) : {};
  const camera = entityScalar(
    config.camera,
    cameraConfig.entity,
    Array.isArray(cameraConfig.cameras) ? cameraConfig.cameras[0] : "",
  );
  config.camera = camera;
  if (camera) {
    cameraConfig.entity = camera;
    const cameras = Array.isArray(cameraConfig.cameras)
      ? cameraConfig.cameras.map(id => String(id || "").trim()).filter(Boolean)
      : [];
    if (!cameras.includes(camera)) {
      cameraConfig.cameras = [camera, ...cameras];
    }
  }
  const mediaSource = isObject(config.media_config) ? deepClone(config.media_config) : {};
  const players = Array.isArray(mediaSource.players) ? mediaSource.players.filter(isObject).map(player => deepClone(player)) : [];
  const mediaConfig = { ...mediaSource, players };
  const nativeMediaIds = players.map(player => String(player.entity || "").trim()).filter(Boolean);
  const mediaPlayer = entityScalar(config.media_player, nativeMediaIds[0]);
  const mediaPlayers = entityList(config.media_players, config.media_player_entities).filter(id => !mediaPlayer || id !== mediaPlayer);
  const lists = {
    vacuums: entityList(config.vacuums, config.vacuum, config.vacuum_entities),
    fans: entityList(config.fans, config.fan_entities),
    humidifiers: entityList(config.humidifiers, config.humidifier_entities),
    others: entityList(config.others, config.other_entities, config.entities),
    lights: entityList(config.lights, config.light_entities), covers: entityList(config.covers, config.cover_entities),
    locks: entityList(config.locks), doors: entityList(config.doors), windows: entityList(config.windows),
    alerts: entityList(config.alerts, config.motion_entities), alarms: entityList(config.alarms, config.alarm, config.alarm_entities),
  };
  Object.assign(config, lists);
  const rawEmbedOptions = isObject(config.embed_options) ? config.embed_options : {};
  const embedOptions: Record<string, (Record<string, unknown> & { entity: string; name: string; icon: string })[]> = {};
  CUSTOMIZABLE_EMBED_LISTS.forEach(listKey => {
    const options = Array.isArray(rawEmbedOptions[listKey]) ? rawEmbedOptions[listKey].filter(isObject) : [];
    embedOptions[listKey] = lists[listKey].map((entity, index) => {
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
  const fields = { ...lists,
    language: String(config.language || "auto"),
    icon: String(config.icon), image: String(config.image), navigation_path: String(config.navigation_path),
    show_temperature: config.show_temperature === true, show_humidity: config.show_humidity === true,
    show_presence: config.show_presence === true, show_lights: config.show_lights === true,
    show_covers: config.show_covers === true, show_climate: config.show_climate === true,
    show_camera: config.show_camera === true, show_media: config.show_media === true,
    show_security: config.show_security === true, show_power: config.show_power === true,
    show_quick_actions: config.show_quick_actions === true,
    styles: normalizeControlStyles(config.styles, DEFAULT_CONFIG.styles),
    name: String(config.name ?? "").trim(), temperature: entityScalar(config.temperature), humidity: entityScalar(config.humidity),
    presence: entityScalar(config.presence), occupancy: entityScalar(config.occupancy), climate: entityScalar(config.climate),
    camera: entityScalar(config.camera), power: entityScalar(config.power), air_quality: entityScalar(config.air_quality),
    camera_config: cameraConfig, media_player: mediaPlayer, media_players: mediaPlayers, media_config: mediaConfig, embed_options: embedOptions,
  } satisfies RoomProjectionConfig & Record<string, unknown>;
  const normalized: typeof fields & Record<string, unknown> = { ...config, ...fields };
  return normalized;
}

export function hasRoomContent(config: unknown = {}) {
  const normalized = normalizeConfig(config || {});
  return Boolean(String(normalized.name || "").trim()) || hasNormalizedRoomContent(normalized);
}

export function buildRoomSummary(hass?: Pick<HomeAssistant, "states"> | null, config: unknown = {}) {
  const c = normalizeConfig(config || {});
  return buildNormalizedRoomSummary(hass, c, COMFORT);
}
