const CARD_TAG = "nodalia-room-summary-card";
const EDITOR_TAG = "nodalia-room-summary-card-editor";
const CARD_VERSION = "2.0.0-alpha.26";

const HUB_PANELS = new Set(["home", "lights", "covers", "climate", "vacuum", "fans", "humidifiers", "media", "others"]);
const COMFORT = { hot: 27, cold: 17, humid: 70, dry: 30 };
const CUSTOMIZABLE_EMBED_LISTS = new Set(["lights", "vacuums", "fans", "humidifiers", "others"]);

const DEFAULT_CONFIG = {
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
  haptics: { enabled: true, style: "medium", fallback_vibrate: false },
  animations: { enabled: true, content_duration: 420, button_bounce_duration: 320 },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "28px",
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
      context_action_size: "34px",
      context_action_icon_size: "18px",
      embed_title_size: "11px",
      embed_chip_font_size: "10px",
      embed_chip_height: "22px",
      embed_chip_padding: "0 7px",
      device_name_size: "12px",
      device_state_size: "10px",
    },
  },
};

const STUB_CONFIG = {
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

function isObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function deepClone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

function mergeConfig(base, override) {
  if (window.NodaliaUtils?.mergeDeep) return window.NodaliaUtils.mergeDeep(base, override || {});
  if (Array.isArray(base)) return Array.isArray(override) ? override.map(deepClone) : deepClone(base);
  if (!isObject(base)) return override === undefined ? base : override;
  const out = {};
  new Set([...Object.keys(base), ...Object.keys(override || {})]).forEach(key => {
    if (isObject(base[key]) && isObject(override?.[key]) && !Array.isArray(base[key])) {
      out[key] = mergeConfig(base[key], override[key]);
    } else {
      out[key] = override?.[key] === undefined ? deepClone(base[key]) : deepClone(override[key]);
    }
  });
  return out;
}

function normalizeTextKey(v) { return String(v ?? "").trim().toLowerCase(); }
function entityDomain(id) { const d = String(id || "").indexOf("."); return d > 0 ? String(id).slice(0, d) : ""; }

function normalizeEntityField(value) {
  if (Array.isArray(value)) {
    const seen = new Set();
    return value.map(item => String(item || "").trim()).filter(id => id && !seen.has(id) && seen.add(id));
  }
  const single = String(value ?? "").trim();
  return single ? [single] : [];
}

function entityScalar(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value[0]) return String(value[0]).trim();
    const s = String(value ?? "").trim();
    if (s) return s;
  }
  return "";
}

function entityList(...values) {
  for (const value of values) {
    const list = normalizeEntityField(value);
    if (list.length) return list;
  }
  return [];
}

function hubMediaPlayerIds(config) {
  const c = normalizeConfig(config || {});
  const ids = [];
  const seen = new Set();
  const push = id => {
    const normalized = String(id || "").trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    ids.push(normalized);
  };
  push(c.media_player);
  (c.media_players || []).forEach(push);
  (c.media_config?.players || []).forEach(player => push(player?.entity));
  return ids;
}

function escapeHtml(v) {
  return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function finiteNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function formatEditorHexChannel(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function formatEditorColorFromHex(hex, alpha = 1) {
  const normalizedHex = String(hex ?? "").trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(normalizedHex)) {
    return String(hex ?? "");
  }
  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  const safeAlpha = clamp(Number(alpha), 0, 1);
  if (safeAlpha >= 0.999) {
    return `#${normalizedHex}`;
  }
  return `rgba(${red}, ${green}, ${blue}, ${Number(safeAlpha.toFixed(2))})`;
}

function getEditorColorModel(value, fallbackValue = "#71c0ff") {
  const sourceValue = String(value ?? "").trim() || String(fallbackValue ?? "").trim() || "#71c0ff";
  const resolve = window.NodaliaBubbleContrast?.resolveEditorColorValue;
  const resolvedValue =
    (resolve ? resolve(sourceValue) : "") || (resolve ? resolve(fallbackValue) : "") || "rgb(113, 192, 255)";
  const channels = resolvedValue.match(/[\d.]+/g) || [];
  const red = clamp(Math.round(Number(channels[0] ?? 113)), 0, 255);
  const green = clamp(Math.round(Number(channels[1] ?? 192)), 0, 255);
  const blue = clamp(Math.round(Number(channels[2] ?? 255)), 0, 255);
  const alpha = channels.length > 3 ? clamp(Number(channels[3]), 0, 1) : 1;
  const hex = `#${formatEditorHexChannel(red)}${formatEditorHexChannel(green)}${formatEditorHexChannel(blue)}`;
  return {
    alpha,
    hex,
    resolved: resolvedValue,
    source: sourceValue,
    value: formatEditorColorFromHex(hex, alpha),
  };
}

function getEditorColorFallbackValue(field) {
  const normalizedField = String(field ?? "");
  if (normalizedField === "styles.accent" || normalizedField.endsWith(".accent")) {
    return "var(--primary-color)";
  }
  if (normalizedField.endsWith("embed_off_tint")) {
    return "color-mix(in srgb, var(--primary-text-color) 5%, transparent)";
  }
  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }
  return "var(--info-color, #71c0ff)";
}
function isUnavailable(state) { const k = normalizeTextKey(state?.state); return k === "unavailable" || k === "unknown"; }
function stateIsOn(state) {
  const k = normalizeTextKey(state?.state);
  return ["on", "open", "opening", "true", "home", "occupied", "present", "detected", "unlocked", "playing", "paused"].includes(k);
}
function stateIsOpen(state) { const k = normalizeTextKey(state?.state); return k === "on" || k === "open" || k === "opening"; }
function stateIsUnlocked(state) { const k = normalizeTextKey(state?.state); return k === "unlocked" || k === "open"; }

function formatMetric(state, unitFallback = "") {
  if (!state || isUnavailable(state)) return "—";
  const unit = String(state.attributes?.unit_of_measurement || unitFallback || "").trim();
  const num = finiteNumber(state.state);
  if (num !== null) return `${Number.isInteger(num) ? num : num.toFixed(1)}${unit}`;
  return String(state.state ?? "—");
}

function getState(hass, entityId) {
  const id = String(entityId || "").trim();
  return id && hass?.states?.[id] ? hass.states[id] : null;
}

function countMatching(hass, ids, predicate) {
  return (ids || []).filter(id => { const s = getState(hass, id); return s && !isUnavailable(s) && predicate(s); }).length;
}

function stripEqualToDefaults(config, defaults = DEFAULT_CONFIG) {
  const result = deepClone(config || {});
  const walk = (cur, base) => {
    if (!isObject(cur) || !isObject(base)) return;
    Object.keys(cur).forEach(key => {
      if (isObject(cur[key]) && isObject(base[key]) && !Array.isArray(cur[key])) {
        walk(cur[key], base[key]);
        if (!Object.keys(cur[key]).length) delete cur[key];
        return;
      }
      if (JSON.stringify(cur[key]) === JSON.stringify(base[key])) delete cur[key];
    });
  };
  walk(result, defaults);
  return result;
}

function normalizeConfig(rawConfig = {}) {
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
  config.camera = entityScalar(config.camera);
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
  config.styles = mergeConfig(DEFAULT_CONFIG.styles, config.styles || {});
  return config;
}

function hasRoomContent(config) {
  const c = config || {};
  return Boolean(
    String(c.name || "").trim()
    || c.temperature || c.humidity || c.presence || c.occupancy || c.climate
    || c.camera || c.media_player || c.power || c.air_quality
    || (c.media_players || []).length
    || (c.media_config?.players || []).length
    || (c.lights || []).length || (c.covers || []).length || (c.locks || []).length
    || (c.vacuums || []).length || (c.fans || []).length
    || (c.humidifiers || []).length || (c.others || []).length
    || (c.doors || []).length || (c.windows || []).length || (c.alerts || []).length,
  );
}

function buildRoomSummary(hass, config) {
  const c = normalizeConfig(config || {});
  const tempState = getState(hass, c.temperature);
  const humidityState = getState(hass, c.humidity);
  const presenceState = getState(hass, c.presence) || getState(hass, c.occupancy);
  const climateState = getState(hass, c.climate);
  const cameraState = getState(hass, c.camera);
  const mediaState = getState(hass, hubMediaPlayerIds(c)[0]);

  const tempNum = tempState ? finiteNumber(tempState.state) : null;
  const humidityNum = humidityState ? finiteNumber(humidityState.state) : null;

  const lightsOn = countMatching(hass, c.lights, stateIsOn);
  const lightsTotal = (c.lights || []).length;
  const coversOpen = countMatching(hass, c.covers, stateIsOpen);
  const doorsOpen = countMatching(hass, c.doors, stateIsOpen);
  const windowsOpen = countMatching(hass, c.windows, stateIsOpen);
  const locksUnlocked = countMatching(hass, c.locks, stateIsUnlocked);
  const alertsActive = countMatching(hass, c.alerts, stateIsOn);

  const occupied = presenceState && !isUnavailable(presenceState) ? stateIsOn(presenceState) : null;
  const mediaPlaying = mediaState && normalizeTextKey(mediaState.state) === "playing";
  const cameraAvailable = cameraState ? !isUnavailable(cameraState) : false;
  const cameraOffline = cameraState ? isUnavailable(cameraState) : false;

  const hot = tempNum !== null && tempNum >= COMFORT.hot;
  const cold = tempNum !== null && tempNum <= COMFORT.cold;
  const humid = humidityNum !== null && humidityNum >= COMFORT.humid;
  const dry = humidityNum !== null && humidityNum <= COMFORT.dry;
  const comfortable = tempNum !== null && !hot && !cold && !humid && !dry;

  const securityIssue = doorsOpen > 0 || windowsOpen > 0 || locksUnlocked > 0 || alertsActive > 0;

  let climateLabel = "";
  if (climateState && !isUnavailable(climateState)) {
    const mode = normalizeTextKey(climateState.attributes?.hvac_mode || climateState.state);
    const current = finiteNumber(climateState.attributes?.current_temperature);
    const target = finiteNumber(climateState.attributes?.temperature);
    const unit = String(climateState.attributes?.unit_of_measurement || "°").trim();
    climateLabel = mode;
    if (current !== null) {
      climateLabel = target !== null && target !== current ? `${current}${unit} → ${target}${unit}` : `${current}${unit}`;
    }
  }

  return {
    occupied: occupied === true,
    empty: occupied === false,
    comfortable,
    cold,
    hot,
    humid,
    dry,
    lights_on: lightsOn > 0,
    all_lights_off: lightsTotal > 0 && lightsOn === 0,
    lightsOn,
    lightsTotal,
    cover_open: coversOpen > 0,
    cover_closed: (c.covers || []).length > 0 && coversOpen === 0,
    coversOpen,
    media_playing: mediaPlaying,
    camera_available: cameraAvailable,
    camera_offline: cameraOffline,
    security_issue: securityIssue,
    alert: alertsActive > 0,
    unknown: !tempState && !humidityState && !presenceState && lightsTotal === 0,
    temperature: formatMetric(tempState),
    humidity: formatMetric(humidityState, "%"),
    climateLabel,
    doorsOpen,
    windowsOpen,
    locksUnlocked,
    alertsActive,
    mediaState: mediaState ? String(mediaState.state) : "",
  };
}

function fireEvent(node, type, detail, options) {
  node.dispatchEvent(new CustomEvent(type, {
    bubbles: options?.bubbles !== false,
    composed: options?.composed !== false,
    cancelable: options?.cancelable === true,
    detail,
  }));
}

function moveListItem(list, fromIndex, toIndex) {
  if (!Array.isArray(list) || fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return;
  }
  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item);
}

function isUnsafeConfigPathKey(key) {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

function getByPath(target, path) {
  const parts = String(path || "").split(".");
  let cursor = target;
  for (const key of parts) {
    if (!key) {
      return undefined;
    }
    if (!isObject(cursor) && !Array.isArray(cursor)) {
      return undefined;
    }
    cursor = cursor[key];
  }
  return cursor;
}

function setByPath(target, path, value) {
  const parts = String(path || "").split(".");
  if (!parts.length || parts.some(isUnsafeConfigPathKey)) {
    return;
  }
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isObject(cursor[key]) && !Array.isArray(cursor[key])) {
      cursor[key] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

class NodaliaRoomSummaryCard extends HTMLElement {
  static async getConfigElement() { return document.createElement(EDITOR_TAG); }
  static getStubConfig() { return deepClone(STUB_CONFIG); }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._activePanel = "home";
    this._hubExpanded = false;
    this._hubEmbedCache = new Map();
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowInput = this._onShadowInput.bind(this);
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    this.shadowRoot?.addEventListener("input", this._onShadowInput);
    this._animateContentOnNextRender = true;
    if (this._hass) { this._lastRenderSignature = ""; this._render(); }
  }

  disconnectedCallback() {
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
    this.shadowRoot?.removeEventListener("input", this._onShadowInput);
    this._lastRenderSignature = "";
    this._hubEmbedCache?.clear();
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    if (this._config.collapsible !== true) this._hubExpanded = false;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._hubEmbedCache?.clear();
    if (this.isConnected) this._render();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this.isConnected) return;
    const sig = this._getRenderSignature(hass);
    if (prev && sig === this._lastRenderSignature && this.shadowRoot?.innerHTML) return;
    this._lastRenderSignature = sig;
    this._render();
  }

  getCardSize() {
    return this._config?.collapsible === true && this._hubExpanded !== true ? 2 : 4;
  }
  getGridOptions() { return { rows: "auto", columns: "full", min_rows: this.getCardSize() }; }

  _t(key, fallback, values = {}) {
    const lang = window.NodaliaI18n?.resolveLanguage?.(this._hass, this._config?.language) ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.roomSummaryCard || window.NodaliaI18n?.strings?.("en")?.roomSummaryCard || {};
    const raw = key.split(".").reduce((cur, part) => (cur && cur[part] !== undefined ? cur[part] : undefined), pack);
    const text = raw ?? fallback;
    return window.NodaliaI18n?.format?.(text, values) ?? String(text).replace(/\{(\w+)\}/g, (_, t) => String(values[t] ?? ""));
  }

  _getRenderSignature(hass = this._hass) {
    const config = normalizeConfig(this._config);
    const ids = [
      config.temperature, config.humidity, config.presence, config.climate,
      ...hubMediaPlayerIds(config), ...(config.lights || []), ...(config.covers || []),
      ...(config.vacuums || []), ...(config.fans || []),
      ...(config.humidifiers || []), ...(config.others || []),
    ].filter(Boolean);
    const states = ids.map(id => {
      const state = hass?.states?.[id];
      return state ? `${id}:${state.state}:${state.last_changed}` : `${id}:missing`;
    }).join("|");
    return `${this._activePanel}|${this._hubExpanded ? 1 : 0}|${states}|${JSON.stringify(config)}`;
  }

  _entityLabel(entityId) {
    const state = getState(this._hass, entityId);
    return String(state?.attributes?.friendly_name || entityId || "").trim() || entityId;
  }

  _entityIcon(entityId, fallback = "mdi:help-circle-outline") {
    const state = getState(this._hass, entityId);
    return String(state?.attributes?.icon || fallback).trim() || fallback;
  }

  _lightBrightnessPct(state) {
    if (!state || typeof state.attributes?.brightness !== "number") return 0;
    return Math.max(1, Math.min(100, Math.round((state.attributes.brightness / 255) * 100)));
  }

  _supportsLightBrightness(state) {
    return Boolean(state && typeof state.attributes?.brightness === "number");
  }

  _getHubNavItems(config, summary) {
    const items = [];
    if (config.lights?.length) {
      items.push({
        id: "lights",
        icon: "mdi:lightbulb",
        label: this._t("lights", "Lights"),
        active: summary?.lights_on === true,
      });
    }
    if (config.covers?.length) {
      items.push({
        id: "covers",
        icon: "mdi:window-shutter",
        label: this._t("covers", "Covers"),
        active: summary?.cover_open === true,
      });
    }
    if (config.climate) {
      const climateKey = normalizeTextKey(getState(this._hass, config.climate)?.state);
      items.push({
        id: "climate",
        icon: "mdi:home-thermometer-outline",
        label: this._t("climateLabel", "Climate"),
        active: Boolean(climateKey && !["off", "unavailable", "unknown"].includes(climateKey)),
      });
    }
    if (config.vacuums?.length) {
      const anyVacuumActive = config.vacuums.some(id => {
        const key = normalizeTextKey(getState(this._hass, id)?.state);
        return Boolean(key && !["off", "idle", "docked", "paused", "unavailable", "unknown", "error"].includes(key));
      });
      items.push({ id: "vacuum", icon: "mdi:robot-vacuum", label: this._t("vacuum", "Vacuum"), active: anyVacuumActive });
    }
    if (config.fans?.length) {
      const anyFanOn = config.fans.some(id => {
        const state = getState(this._hass, id);
        return state && stateIsOn(state);
      });
      items.push({
        id: "fans",
        icon: "mdi:fan",
        label: this._t("fans", "Fans"),
        active: anyFanOn,
      });
    }
    if (config.humidifiers?.length) {
      const anyHumidifierOn = config.humidifiers.some(id => {
        const state = getState(this._hass, id);
        return state && stateIsOn(state);
      });
      items.push({
        id: "humidifiers",
        icon: "mdi:air-humidifier",
        label: this._t("humidifiers", "Humidifiers"),
        active: anyHumidifierOn,
      });
    }
    if (hubMediaPlayerIds(config).length) {
      const anyMediaOn = hubMediaPlayerIds(config).some(id => stateIsOn(getState(this._hass, id)));
      items.push({
        id: "media",
        icon: "mdi:play-circle",
        label: this._t("mediaPlayer", "Media player"),
        active: anyMediaOn,
      });
    }
    if (config.others?.length) {
      items.push({
        id: "others",
        icon: "mdi:shape-outline",
        label: this._t("others", "Others"),
        active: config.others.some(id => stateIsOn(getState(this._hass, id))),
      });
    }
    return items;
  }

  _getContextualActions(summary, config) {
    if (config.show_quick_actions === false) return [];
    const actions = [];
    if (config.lights?.length) {
      actions.push({
        id: summary.lights_on ? "lights_off" : "lights_on",
        icon: "mdi:lightbulb",
        label: summary.lights_on ? this._t("turnOffLights", "Turn off lights") : this._t("turnOnLights", "Turn on lights"),
        active: summary.lights_on === true,
      });
    }
    if (config.covers?.length) {
      actions.push({
        id: summary.cover_open ? "covers_close" : "covers_open",
        icon: "mdi:window-shutter",
        label: summary.cover_open ? this._t("closeCovers", "Close covers") : this._t("openCovers", "Open covers"),
        active: summary.cover_open === true,
      });
    }
    if (config.fans?.length) {
      const anyFanOn = config.fans.some(id => {
        const state = getState(this._hass, id);
        return state && stateIsOn(state);
      });
      actions.push({
        id: anyFanOn ? "fans_off" : "fans_on",
        icon: "mdi:fan",
        label: anyFanOn ? this._t("turnOffFans", "Turn off fans") : this._t("turnOnFans", "Turn on fans"),
        active: anyFanOn,
      });
    }
    if (config.climate) {
      actions.push({
        id: "climate_up",
        icon: "mdi:chevron-up",
        label: this._t("raiseTemperature", "Raise temperature"),
      });
      actions.push({
        id: "climate_down",
        icon: "mdi:chevron-down",
        label: this._t("lowerTemperature", "Lower temperature"),
      });
    }
    if (config.media_player) {
      const mediaState = getState(this._hass, config.media_player);
      const mediaKey = normalizeTextKey(mediaState?.state);
      if (mediaKey === "playing") {
        actions.push({
          id: "media_play_pause",
          icon: "mdi:play-pause",
          label: this._t("mediaPause", "Pause"),
          active: true,
        });
      } else if (mediaKey === "paused") {
        actions.push({
          id: "media_play_pause",
          icon: "mdi:play-pause",
          label: this._t("mediaPlay", "Play"),
        });
      }
      if (mediaState && stateIsOn(mediaState)) {
        actions.push({
          id: "media_off",
          icon: "mdi:power",
          label: this._t("turnOffMedia", "Turn off media"),
          active: true,
        });
      } else if (mediaState && !isUnavailable(mediaState)) {
        actions.push({
          id: "media_on",
          icon: "mdi:power",
          label: this._t("turnOnMedia", "Turn on media"),
        });
      }
    }
    if (summary.security_issue) {
      actions.push({ id: "security", icon: "mdi:shield-alert", label: this._t("securityIssue", "Security issue"), warn: true });
    }
    return actions;
  }

  _setHubPanel(panel) {
    const next = HUB_PANELS.has(panel) ? panel : "home";
    if (next === this._activePanel) return;
    this._activePanel = next;
    this._triggerHaptic();
    if (!this._activateHubPanel(next)) this._render();
  }

  _activateHubPanel(panel) {
    if (!this.shadowRoot) return false;
    const views = Array.from(this.shadowRoot.querySelectorAll("[data-hub-panel]"));
    const target = views.find(view => view.dataset.hubPanel === panel);
    if (!target) return false;
    views.forEach(view => {
      const active = view === target;
      view.hidden = !active;
      view.setAttribute("aria-hidden", String(!active));
    });
    const config = normalizeConfig(this._config || {});
    const summary = buildRoomSummary(this._hass, config);
    const navItems = this._getHubNavItems(config, summary);
    const rail = this.shadowRoot.querySelector(".room-hub__rail");
    if (rail) rail.outerHTML = this._renderHubRail(navItems, panel);
    this._lastRenderSignature = this._getRenderSignature(this._hass);
    return true;
  }

  _toggleEntity(entityId) {
    const state = getState(this._hass, entityId);
    const domain = entityDomain(entityId);
    if (!state || !domain) return;
    this._triggerHaptic();
    if (domain === "light") {
      void this._invoke("light", stateIsOn(state) ? "turn_off" : "turn_on", { entity_id: entityId });
      return;
    }
    if (domain === "fan") {
      void this._invoke("fan", stateIsOn(state) ? "turn_off" : "turn_on", { entity_id: entityId });
      return;
    }
    if (domain === "cover") {
      void this._invoke("cover", stateIsOpen(state) ? "close_cover" : "open_cover", { entity_id: entityId });
      return;
    }
    if (domain === "switch") {
      void this._invoke("switch", stateIsOn(state) ? "turn_off" : "turn_on", { entity_id: entityId });
    }
  }

  _runVacuumService(entityId, service) {
    if (!entityId) return;
    this._triggerHaptic();
    void this._invoke("vacuum", service, { entity_id: entityId });
  }

  _runClimateDelta(entityId, delta) {
    const state = getState(this._hass, entityId);
    if (!state) return;
    const current = finiteNumber(state.attributes?.temperature);
    if (current === null) return;
    this._triggerHaptic();
    void this._invoke("climate", "set_temperature", { entity_id: entityId, temperature: current + delta });
  }

  _runMediaControl(control) {
    const entityId = this._config?.media_player;
    if (!entityId) return;
    this._triggerHaptic();
    if (control === "play_pause") {
      const state = getState(this._hass, entityId);
      const playing = normalizeTextKey(state?.state) === "playing";
      void this._invoke("media_player", playing ? "media_pause" : "media_play", { entity_id: entityId });
      return;
    }
    if (control === "next") void this._invoke("media_player", "media_next_track", { entity_id: entityId });
    if (control === "prev") void this._invoke("media_player", "media_previous_track", { entity_id: entityId });
  }

  _onShadowInput(event) {
    const el = event.target;
    if (!(el instanceof HTMLInputElement) || el.type !== "range") return;
    const entityId = String(el.dataset.entityId || "").trim();
    if (!entityId) return;
    const pct = Number(el.value);
    if (!Number.isFinite(pct)) return;
    void this._invoke("light", "turn_on", {
      entity_id: entityId,
      brightness: Math.max(1, Math.min(255, Math.round((pct / 100) * 255))),
    });
  }

  _triggerHaptic() {
    if (this._config?.haptics?.enabled !== true) return;
    fireEvent(this, "haptic", this._config.haptics.style || "medium", { bubbles: true, composed: true });
  }

  _invoke(domain, service, data = {}, target = null) {
    const fn = window.NodaliaUtils?.invokeHomeAssistantService?.bind(window.NodaliaUtils);
    if (typeof fn === "function") return fn(this, this._hass, domain, service, data, target);
    return Promise.resolve(this._hass?.callService?.(domain, service, data, target || undefined));
  }

  _parseActionObject(value) {
    if (isObject(value)) return deepClone(value);
    const source = String(value || "").trim();
    if (!source) return {};
    try {
      const parsed = JSON.parse(source);
      return isObject(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  _runConfiguredService(prefix) {
    const serviceValue = String(this._config?.[`${prefix}_service`] || "").trim();
    const separator = serviceValue.indexOf(".");
    if (separator <= 0 || separator >= serviceValue.length - 1) return;
    const domain = serviceValue.slice(0, separator);
    const service = serviceValue.slice(separator + 1);
    const data = this._parseActionObject(this._config?.[`${prefix}_service_data`]);
    const target = this._parseActionObject(this._config?.[`${prefix}_service_target`]);
    void this._invoke(domain, service, data, Object.keys(target).length ? target : null);
  }

  _primaryActionEntity() {
    const cfg = this._config || {};
    return cfg.climate || cfg.temperature || cfg.camera || cfg.media_player || cfg.lights?.[0] || "";
  }

  _performCardAction(prefix) {
    const cfg = this._config || {};
    const action = String(cfg[`${prefix}_action`] || "none");
    if (action === "none") return;
    this._triggerHaptic();
    if (action === "more-info") {
      const entity = this._primaryActionEntity();
      if (entity) fireEvent(this, "hass-more-info", { entityId: entity });
      return;
    }
    if (action === "toggle") {
      this._toggleEntity(this._primaryActionEntity());
      return;
    }
    if (action === "service") {
      this._runConfiguredService(prefix);
      return;
    }
    if (action === "navigate") {
      const pathValue = prefix === "tap" ? cfg.navigation_path : cfg[`${prefix}_navigation_path`];
      const path = window.NodaliaUtils?.sanitizeActionUrl?.(pathValue, { allowRelative: true });
      if (path) fireEvent(this, "hass-navigate", { path });
      return;
    }
    if (action === "url") {
      const url = window.NodaliaUtils?.sanitizeActionUrl?.(cfg[`${prefix}_url`], { allowRelative: true });
      if (url) window.open(url, cfg[`${prefix}_new_tab`] ? "_blank" : "_self", "noopener,noreferrer");
    }
  }

  _runQuickAction(action) {
    const cfg = this._config || {};
    const summary = buildRoomSummary(this._hass, cfg);
    this._triggerHaptic();
    if (action === "lights_on" && cfg.lights?.length) {
      void this._invoke("light", "turn_on", { entity_id: cfg.lights });
      return;
    }
    if (action === "lights_off" && cfg.lights?.length) {
      void this._invoke("light", "turn_off", { entity_id: cfg.lights });
      return;
    }
    if (action === "covers_close" && cfg.covers?.length) {
      void this._invoke("cover", "close_cover", { entity_id: cfg.covers });
      return;
    }
    if (action === "covers_open" && cfg.covers?.length) {
      void this._invoke("cover", "open_cover", { entity_id: cfg.covers });
      return;
    }
    if (action === "camera" && cfg.camera) {
      fireEvent(this, "hass-more-info", { entityId: cfg.camera });
      return;
    }
    if (action === "climate" && cfg.climate) {
      fireEvent(this, "hass-more-info", { entityId: cfg.climate });
      return;
    }
    if (action === "media" && cfg.media_player) {
      fireEvent(this, "hass-more-info", { entityId: cfg.media_player });
      return;
    }
    if (action === "fans_on" && cfg.fans?.length) {
      void this._invoke("fan", "turn_on", { entity_id: cfg.fans });
      return;
    }
    if (action === "fans_off" && cfg.fans?.length) {
      void this._invoke("fan", "turn_off", { entity_id: cfg.fans });
      return;
    }
    if (action === "climate_up" && cfg.climate) {
      this._runClimateDelta(cfg.climate, 1);
      return;
    }
    if (action === "climate_down" && cfg.climate) {
      this._runClimateDelta(cfg.climate, -1);
      return;
    }
    if (action === "media_play_pause" && cfg.media_player) {
      this._runMediaControl("play_pause");
      return;
    }
    if (action === "media_on" && cfg.media_player) {
      void this._invoke("media_player", "turn_on", { entity_id: cfg.media_player });
      return;
    }
    if (action === "media_off" && cfg.media_player) {
      void this._invoke("media_player", "turn_off", { entity_id: cfg.media_player });
    }
  }

  _onShadowClick(event) {
    const el = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.roomAction);
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    const action = el.dataset.roomAction;
    if (action === "primary") {
      this._performCardAction("tap");
      return;
    }
    if (action === "hold") {
      this._performCardAction("hold");
      return;
    }
    if (action?.startsWith("nav:")) {
      this._setHubPanel(action.slice(4));
      return;
    }
    if (action === "toggle-hub-expand") {
      this._hubExpanded = !this._hubExpanded;
      this._activePanel = "home";
      this._lastRenderSignature = "";
      this._triggerHaptic();
      this._render();
      return;
    }
    if (action?.startsWith("toggle:")) {
      this._toggleEntity(action.slice(7));
      return;
    }
    if (action?.startsWith("vacuum:")) {
      const [, service, entityId] = action.split(":");
      this._runVacuumService(entityId, service);
      return;
    }
    if (action?.startsWith("cover:")) {
      const [, service, entityId] = action.split(":");
      if (!entityId) return;
      this._triggerHaptic();
      void this._invoke("cover", service, { entity_id: entityId });
      return;
    }
    if (action?.startsWith("climate:")) {
      const [, delta, entityId] = action.split(":");
      this._runClimateDelta(entityId, Number(delta));
      return;
    }
    if (action?.startsWith("media:")) {
      this._runMediaControl(action.slice(6));
      return;
    }
    if (action?.startsWith("more-info:")) {
      const entityId = action.slice(10);
      if (entityId) {
        this._triggerHaptic();
        fireEvent(this, "hass-more-info", { entityId });
      }
      return;
    }
    if (action?.startsWith("quick:")) this._runQuickAction(action.slice(6));
  }

  _renderHubBubble(icon, action, { active = false, large = false, label = "" } = {}) {
    const classes = [
      "room-hub__bubble",
      active ? "room-hub__bubble--active" : "",
      large ? "room-hub__bubble--large" : "",
    ].filter(Boolean).join(" ");
    return `<button type="button" class="${classes}" data-room-action="${escapeHtml(action)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label || icon)}">
      <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
    </button>`;
  }

  _renderHubRail(navItems, activePanel) {
    const bubbles = [];
    if (activePanel !== "home") {
      bubbles.push(this._renderHubBubble("mdi:home", "nav:home", {
        active: false,
        label: this._t("hubHome", "Home"),
      }));
    }
    navItems
      .filter(item => activePanel === "home" || item.id !== activePanel)
      .forEach(item => {
        bubbles.push(this._renderHubBubble(item.icon, `nav:${item.id}`, {
          active: activePanel === item.id || item.active === true,
          label: item.label,
        }));
      });
    return `<aside class="room-hub__rail" aria-label="${escapeHtml(this._t("hubNavigation", "Room navigation"))}">
      ${bubbles.join("")}
    </aside>`;
  }

  _renderHubHomeMedia(config) {
    if (!config.media_player || config.show_media === false) return "";
    const state = getState(this._hass, config.media_player);
    if (!state || isUnavailable(state)) return "";
    return `<div class="room-hub__embed-host room-hub__embed-host--media" data-hub-embed="media" data-hub-slot="home" data-entity="${escapeHtml(config.media_player)}"></div>`;
  }

  _hubEmbedStylePack(config) {
    const base = normalizeConfig(config);
    return {
      language: base.language,
      animations: { ...deepClone(base.animations), content_duration: 0 },
      haptics: deepClone(base.haptics),
    };
  }

  _hubEmbeddedAccentPack(config) {
    const parent = deepClone(normalizeConfig(config).styles);
    const hub = parent.hub || {};
    const hubDefaults = DEFAULT_CONFIG.styles.hub;
    const accent = parent.accent || "var(--primary-color)";
    return {
      ...parent,
      title_size: hub.embed_title_size || hubDefaults.embed_title_size,
      chip_font_size: hub.embed_chip_font_size || hubDefaults.embed_chip_font_size,
      chip_height: hub.embed_chip_height || hubDefaults.embed_chip_height,
      chip_padding: hub.embed_chip_padding || hubDefaults.embed_chip_padding,
      accent,
      control: {
        ...parent.control,
        accent_background: parent.control?.accent_background || `color-mix(in srgb, ${accent} 14%, transparent)`,
      },
    };
  }

  _hubMediaPlayerStylePack(config) {
    const accent = normalizeConfig(config).styles?.accent || "var(--primary-color)";
    return {
      player: {
        progress_color: accent,
        active_tint_color: accent,
      },
    };
  }

  _hubEmbedCustomization(config, host) {
    const listKeyByType = {
      light: "lights",
      vacuum: "vacuums",
      fan: "fans",
      humidifier: "humidifiers",
      entity: "others",
    };
    const listKey = listKeyByType[String(host?.dataset?.hubEmbed || "")];
    if (!listKey) return {};
    const entityId = String(host?.dataset?.entity || "").trim();
    const index = Number(host?.dataset?.hubIndex);
    const options = config.embed_options?.[listKey] || [];
    const option = options.find(item => String(item?.entity || "").trim() === entityId)
      || (Number.isInteger(index) ? options[index] : null)
      || {};
    return {
      ...(option.name ? { name: option.name } : {}),
      ...(option.icon ? { icon: option.icon } : {}),
    };
  }

  _hubMediaEmbedConfig(config, host) {
    const native = isObject(config.media_config) ? deepClone(config.media_config) : {};
    const entityId = String(host?.dataset?.entity || "").trim();
    const scope = String(host?.dataset?.hubMedia || "single");
    const nativePlayers = Array.isArray(native.players) ? native.players.filter(player => player?.entity) : [];
    const matchingPlayer = nativePlayers.find(player => String(player.entity || "").trim() === entityId);
    const players = scope === "group"
      ? nativePlayers
      : [matchingPlayer || { entity: entityId }];
    const nativeAnimations = isObject(native.animations) ? native.animations : config.animations;
    return {
      ...native,
      show_state: native.show_state ?? false,
      show_device_chip: native.show_device_chip ?? false,
      album_cover_background: native.album_cover_background ?? true,
      players,
      animations: { ...deepClone(nativeAnimations), content_duration: 0, panel_duration: 0 },
      layout: {
        ...(isObject(native.layout) ? native.layout : {}),
        fixed: false,
        reserve_space: false,
      },
      styles: mergeConfig(this._hubMediaPlayerStylePack(config), native.styles || {}),
    };
  }

  _mountHubEmbeddedCards() {
    if (!this.shadowRoot) return;
    const config = normalizeConfig(this._config || {});
    const pack = this._hubEmbedStylePack(config);
    const embeddedStyles = this._hubEmbeddedAccentPack(config);
    const cacheKeyForHost = host => {
      const entityId = String(host?.dataset?.entity || "").trim();
      const embedType = String(host?.dataset?.hubEmbed || "").trim();
      const slot = String(host?.dataset?.hubSlot || "panel").trim();
      return entityId && embedType ? `${embedType}:${entityId}:${slot}` : "";
    };
    const validKeys = new Set(Array.from(this.shadowRoot.querySelectorAll("[data-hub-embed]"))
      .map(cacheKeyForHost)
      .filter(Boolean));

    const mount = (host, tagName, extra = {}) => {
      if (!(host instanceof HTMLElement)) return;
      const entityId = String(host.dataset.entity || "").trim();
      if (!entityId) return;
      const cacheKey = cacheKeyForHost(host);
      let card = this._hubEmbedCache?.get(cacheKey);
      if (!card) {
        card = document.createElement(tagName);
        this._hubEmbedCache?.set(cacheKey, card);
      }
      if (card.parentElement !== host) {
        host.replaceChildren(card);
      }
      if (this._hass) card.hass = this._hass;
      card.setConfig({ entity: entityId, ...pack, ...extra, ...this._hubEmbedCustomization(config, host) });
    };

    this.shadowRoot.querySelectorAll('[data-hub-embed="light"]').forEach(host => {
      mount(host, "nodalia-light-card", {
        auto_expand: true,
        compact_layout_mode: "never",
        show_brightness: true,
        show_slider_mode_buttons: true,
        show_color_controls: true,
        show_temperature_controls: true,
        show_quick_brightness: false,
        show_quick_color_presets: false,
        show_quick_temperature_presets: false,
        tap_action: "toggle",
        icon_tap_action: "toggle",
        styles: embeddedStyles,
      });
    });
    this.shadowRoot.querySelectorAll('[data-hub-embed="vacuum"]').forEach(host => {
      mount(host, "nodalia-vacuum-card", {
        show_mode_controls: true,
        show_fan_presets: true,
        show_return_to_base: true,
        show_stop: true,
        show_locate: true,
        show_state_chip: true,
        show_battery_chip: true,
        styles: embeddedStyles,
      });
    });
    this.shadowRoot.querySelectorAll('[data-hub-embed="fan"]').forEach(host => {
      mount(host, "nodalia-fan-card", {
        show_slider: true,
        show_preset_modes: true,
        show_oscillation: true,
        compact_layout_mode: "never",
        tap_action: "toggle",
        icon_tap_action: "toggle",
        styles: embeddedStyles,
      });
    });
    this.shadowRoot.querySelectorAll('[data-hub-embed="humidifier"]').forEach(host => {
      mount(host, "nodalia-humidifier-card", {
        show_slider: true,
        show_mode_button: true,
        show_fan_mode_button: true,
        compact_layout_mode: "never",
        tap_action: "toggle",
        icon_tap_action: "toggle",
        styles: embeddedStyles,
      });
    });
    this.shadowRoot.querySelectorAll('[data-hub-embed="entity"]').forEach(host => {
      mount(host, "nodalia-entity-card", {
        compact_layout_mode: "never",
        styles: embeddedStyles,
      });
    });
    this.shadowRoot.querySelectorAll('[data-hub-embed="media"]').forEach(host => {
      mount(host, "nodalia-media-player", this._hubMediaEmbedConfig(config, host));
    });
    for (const [key, card] of this._hubEmbedCache || []) {
      if (!validKeys.has(key)) {
        card.remove();
        this._hubEmbedCache.delete(key);
      }
    }
  }

  _renderHubEmbedHosts(entityIds, embedType, slot = "panel") {
    return `<div class="room-hub__embed-list">${(entityIds || []).map((entityId, index) => `
      <div class="room-hub__embed-host" data-hub-embed="${escapeHtml(embedType)}" data-hub-slot="${escapeHtml(slot)}" data-hub-index="${index}" data-entity="${escapeHtml(entityId)}"></div>
    `).join("")}</div>`;
  }

  _renderHubRoomIcon(icon, title, styles) {
    return `<button type="button" class="room-hub__room-icon" data-room-action="primary" aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}">
      <ha-icon icon="${escapeHtml(icon || "mdi:floor-plan")}"></ha-icon>
    </button>`;
  }

  _renderHubHeader(config, summary, styles, collapsed = false) {
    const title = config.name || this._t("defaultName", "Room");
    const statusChips = this._renderHubStatusChips(config, summary);
    const collapsible = config.collapsible === true;
    const headerClasses = [
      "room-hub__header",
      "room-hub__home-header",
      collapsible ? "room-hub__header--with-toggle" : "",
      collapsed ? "room-hub__header--collapsed" : "",
    ].filter(Boolean).join(" ");
    const toggleLabel = collapsed
      ? this._t("expandDetails", "Expand room details")
      : this._t("collapseDetails", "Collapse room details");
    return `<header class="${headerClasses}">
      ${this._renderHubRoomIcon(config.icon, title, styles)}
      <div class="room-hub__room-copy">
        <div class="room-hub__room-title">${escapeHtml(title)}</div>
        ${statusChips ? `<div class="room-hub__status-chips">${statusChips}</div>` : ""}
      </div>
      ${collapsible ? `<button type="button" class="room-hub__expand-toggle" data-room-action="toggle-hub-expand" aria-expanded="${collapsed ? "false" : "true"}" aria-label="${escapeHtml(toggleLabel)}" title="${escapeHtml(toggleLabel)}">
        <ha-icon icon="${collapsed ? "mdi:chevron-down" : "mdi:chevron-up"}"></ha-icon>
      </button>` : ""}
    </header>`;
  }

  _renderHubStatusChips(config, summary) {
    const chips = [];
    const pushChip = (className, icon, label, entityId) => {
      if (!entityId) return;
      chips.push(`<button type="button" class="room-hub__metric-bubble ${className}" data-room-action="more-info:${escapeHtml(entityId)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
        <ha-icon icon="${escapeHtml(icon)}"></ha-icon><span>${escapeHtml(label)}</span>
      </button>`);
    };
    const pushIconChip = (className, icon, label, entityId) => {
      if (!entityId) return;
      chips.push(`<button type="button" class="room-hub__metric-bubble room-hub__metric-bubble--icon-only ${className}" data-room-action="more-info:${escapeHtml(entityId)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
        <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
      </button>`);
    };
    if (config.show_temperature && config.temperature && summary.temperature !== "—") {
      pushChip(
        "room-hub__metric-bubble--temperature",
        "mdi:thermometer",
        summary.temperature,
        config.temperature,
      );
    }
    if (config.show_humidity && config.humidity && summary.humidity !== "—") {
      pushChip(
        "room-hub__metric-bubble--humidity",
        "mdi:water-percent",
        summary.humidity,
        config.humidity,
      );
    }
    if (config.show_presence && (config.presence || config.occupancy)) {
      const presenceEntity = config.presence || config.occupancy;
      if (summary.occupied) {
        pushIconChip(
          "room-hub__metric-bubble--presence room-hub__metric-bubble--presence-occupied",
          "mdi:account-check",
          this._t("occupied", "Occupied"),
          presenceEntity,
        );
      } else if (summary.empty) {
        pushIconChip(
          "room-hub__metric-bubble--presence room-hub__metric-bubble--presence-vacant",
          "mdi:account-off-outline",
          this._t("vacant", "Vacant"),
          presenceEntity,
        );
      }
    }
    return chips.join("");
  }

  _renderHubHome(config, summary, styles, accentColor, collapsed = false) {
    const image = collapsed ? "" : window.NodaliaUtils?.sanitizeActionUrl?.(config.image, { allowRelative: true }) || "";
    const contextual = this._getContextualActions(summary, config);
    const homeClass = image ? "room-hub__home room-hub__home--image" : "room-hub__home";
    const homeStyle = image ? ` style="--room-hub-bg-image:url('${escapeHtml(image)}')"` : "";
    return `<div class="${homeClass}"${homeStyle}>
      ${contextual.length ? `<div class="room-hub__context-actions">${contextual.map(action => `
        <button type="button" class="room-hub__context-action ${action.active ? "room-hub__context-action--active" : ""} ${action.warn ? "room-hub__context-action--warn" : ""}"
          data-room-action="quick:${escapeHtml(action.id)}"
          aria-label="${escapeHtml(action.label)}" title="${escapeHtml(action.label)}">
          <ha-icon icon="${escapeHtml(action.icon)}"></ha-icon>
        </button>`).join("")}</div>` : ""}
      ${collapsed ? "" : this._renderHubHomeMedia(config)}
    </div>`;
  }

  _renderHubLightPanel(config) {
    return `<div class="room-hub__panel room-hub__panel--embed">${this._renderHubEmbedHosts(config.lights, "light")}</div>`;
  }

  _renderHubFanPanel(config) {
    return `<div class="room-hub__panel room-hub__panel--embed">${this._renderHubEmbedHosts(config.fans, "fan")}</div>`;
  }

  _renderHubHumidifierPanel(config) {
    return `<div class="room-hub__panel room-hub__panel--embed">${this._renderHubEmbedHosts(config.humidifiers, "humidifier")}</div>`;
  }

  _renderHubOthersPanel(config) {
    return `<div class="room-hub__panel room-hub__panel--embed">${this._renderHubEmbedHosts(config.others, "entity")}</div>`;
  }

  _renderHubCoverPanel(config) {
    return `<div class="room-hub__panel room-hub__panel--covers">
      <div class="room-hub__device-list">${(config.covers || []).map(entityId => {
    const state = getState(this._hass, entityId);
    const position = finiteNumber(state?.attributes?.current_position);
    const open = state && stateIsOpen(state);
    return `<article class="room-hub__device-row ${open ? "is-on" : ""}">
      <button type="button" class="room-hub__device-icon" data-room-action="toggle:${escapeHtml(entityId)}">
        <ha-icon icon="${escapeHtml(this._entityIcon(entityId, "mdi:window-shutter"))}"></ha-icon>
      </button>
      <div class="room-hub__device-body">
        <div class="room-hub__device-name">${escapeHtml(this._entityLabel(entityId))}</div>
        <div class="room-hub__device-state">${escapeHtml(position !== null ? `${position}%` : String(state?.state || "—"))}</div>
        <div class="room-hub__device-controls">
          <button type="button" class="room-hub__mini-control" data-room-action="cover:open_cover:${escapeHtml(entityId)}"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
          <button type="button" class="room-hub__mini-control" data-room-action="cover:stop_cover:${escapeHtml(entityId)}"><ha-icon icon="mdi:stop"></ha-icon></button>
          <button type="button" class="room-hub__mini-control" data-room-action="cover:close_cover:${escapeHtml(entityId)}"><ha-icon icon="mdi:arrow-down"></ha-icon></button>
        </div>
      </div>
    </article>`;
  }).join("")}</div>
    </div>`;
  }

  _renderHubClimatePanel(config) {
    const entityId = config.climate;
    const state = getState(this._hass, entityId);
    const current = finiteNumber(state?.attributes?.current_temperature);
    const target = finiteNumber(state?.attributes?.temperature);
    const unit = String(state?.attributes?.unit_of_measurement || "°C").trim();
    const mode = String(state?.attributes?.hvac_mode || state?.state || "—");
    return `<div class="room-hub__panel room-hub__panel--climate">
      <div class="room-hub__climate-dial">
        <div class="room-hub__climate-value">${escapeHtml(current !== null ? `${current}${unit}` : "—")}</div>
        <div class="room-hub__climate-target">${escapeHtml(target !== null ? `${this._t("target", "Target")} ${target}${unit}` : mode)}</div>
        <div class="room-hub__device-controls">
          <button type="button" class="room-hub__mini-control" data-room-action="climate:-1:${escapeHtml(entityId)}"><ha-icon icon="mdi:minus"></ha-icon></button>
          <button type="button" class="room-hub__mini-control" data-room-action="climate:1:${escapeHtml(entityId)}"><ha-icon icon="mdi:plus"></ha-icon></button>
        </div>
      </div>
    </div>`;
  }

  _renderHubVacuumPanel(config) {
    return `<div class="room-hub__panel room-hub__panel--embed">${this._renderHubEmbedHosts(config.vacuums, "vacuum")}</div>`;
  }

  _renderHubMediaPanel(config) {
    const ids = hubMediaPlayerIds(config);
    if (!ids.length) return "";
    if (config.media_config?.players?.length) {
      return `<div class="room-hub__panel room-hub__panel--embed"><div class="room-hub__embed-list">
        <div class="room-hub__embed-host" data-hub-embed="media" data-hub-slot="group" data-hub-media="group" data-entity="${escapeHtml(ids[0])}"></div>
      </div></div>`;
    }
    return `<div class="room-hub__panel room-hub__panel--embed">${this._renderHubEmbedHosts(ids, "media")}</div>`;
  }

  _renderHubPanelContent(panel, config, summary, styles, accentColor) {
    if (panel === "lights") return this._renderHubLightPanel(config);
    if (panel === "covers") return this._renderHubCoverPanel(config);
    if (panel === "climate") return this._renderHubClimatePanel(config);
    if (panel === "vacuum") return this._renderHubVacuumPanel(config);
    if (panel === "fans") return this._renderHubFanPanel(config);
    if (panel === "humidifiers") return this._renderHubHumidifierPanel(config);
    if (panel === "media") return this._renderHubMediaPanel(config);
    if (panel === "others") return this._renderHubOthersPanel(config);
    return this._renderHubHome(config, summary, styles, accentColor);
  }

  _renderHub() {
    const config = normalizeConfig(this._config || {});
    const summary = buildRoomSummary(this._hass, config);
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const hubStyles = styles.hub || DEFAULT_CONFIG.styles.hub;
    const accentColor = escapeHtml(styles.accent || "var(--primary-color)");
    const hubMetricFont = escapeHtml(hubStyles.metric_chip_font_size || DEFAULT_CONFIG.styles.hub.metric_chip_font_size);
    const hubMetricHeight = escapeHtml(hubStyles.metric_chip_height || DEFAULT_CONFIG.styles.hub.metric_chip_height);
    const hubMetricPadding = escapeHtml(hubStyles.metric_chip_padding || DEFAULT_CONFIG.styles.hub.metric_chip_padding);
    const hubMetricIcon = escapeHtml(hubStyles.metric_chip_icon_size || DEFAULT_CONFIG.styles.hub.metric_chip_icon_size);
    const hubActionSize = escapeHtml(hubStyles.context_action_size || DEFAULT_CONFIG.styles.hub.context_action_size);
    const hubActionIcon = escapeHtml(hubStyles.context_action_icon_size || DEFAULT_CONFIG.styles.hub.context_action_icon_size);
    const hubDeviceName = escapeHtml(hubStyles.device_name_size || DEFAULT_CONFIG.styles.hub.device_name_size);
    const hubDeviceState = escapeHtml(hubStyles.device_state_size || DEFAULT_CONFIG.styles.hub.device_state_size);
    const collapsible = config.collapsible === true;
    const collapsed = collapsible && this._hubExpanded !== true;
    const activePanel = collapsed ? "home" : HUB_PANELS.has(this._activePanel) ? this._activePanel : "home";
    const navItems = this._getHubNavItems(config, summary);
    const renderedPanels = collapsed ? ["home"] : ["home", ...navItems.map(item => item.id)];
    const animate = config.animations?.enabled !== false && this._animateContentOnNextRender;
    const cardBackground = styles.card.background;
    const cardBorder = styles.card.border;
    const cardShadow = styles.card.box_shadow;
    const embedOffTint = escapeHtml(styles.embed_off_tint || DEFAULT_CONFIG.styles.embed_off_tint);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; --room-hub-duration:${config.animations?.enabled ? config.animations.content_duration : 0}ms; }
        * { box-sizing:border-box; }
        ha-card.room-summary-card--hub {
          overflow: visible;
        }
        ha-card {
          background:${cardBackground};
          border:${cardBorder};
          border-radius:${styles.card.border_radius};
          box-shadow:${cardShadow};
          color:var(--primary-text-color);
          display:block;
          isolation:isolate;
          overflow:hidden;
          position:relative;
          transition:background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        ha-card::before {
          background:linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0));
          border-radius:inherit; content:""; inset:0; pointer-events:none; position:absolute; z-index:0;
        }
        ha-card::after {
          background:radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%);
          border-radius:inherit; content:""; inset:0; opacity:0; pointer-events:none; position:absolute; z-index:0;
        }
        .room-hub { align-items:start; display:grid; gap:12px; grid-template-columns:minmax(0,1fr) auto; min-height:${collapsed ? "0" : "220px"}; overflow:visible; padding:${styles.card.padding}; position:relative; z-index:1; }
        .room-hub__stage { align-content:start; display:grid; gap:12px; grid-template-rows:auto auto; min-width:0; overflow:visible; }
        .room-hub__body { align-self:start; min-width:0; overflow:visible; }
        .room-hub__body--enter { animation:room-hub-slide calc(var(--room-hub-duration) * 0.9) cubic-bezier(.22,.84,.26,1) both; }
        .room-hub__view { align-content:start; display:grid; min-width:0; overflow:visible; }
        .room-hub__view[hidden] { display:none !important; }
        .room-hub__rail { align-items:center; display:flex; flex-direction:column; gap:8px; justify-content:flex-start; }
        .room-hub__bubble {
          align-items:center; appearance:none; background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); border-radius:999px;
          box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0,0,0,0.14);
          color:var(--primary-text-color); cursor:pointer; display:inline-flex; height:42px; justify-content:center; padding:0; width:42px;
          transition:transform 150ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        .room-hub__bubble--large { height:72px; width:72px; }
        .room-hub__bubble--active, .room-hub__device-row.is-on .room-hub__device-icon {
          background:color-mix(in srgb, ${accentColor} 20%, transparent);
          border-color:color-mix(in srgb, ${accentColor} 28%, transparent);
          color:${accentColor};
        }
        .room-hub__bubble ha-icon, .room-hub__device-icon ha-icon { --mdc-icon-size:20px; }
        .room-hub__bubble--large ha-icon { --mdc-icon-size:34px; }
        .room-hub__bubble:active, .room-hub__mini-control:active, .room-hub__room-icon:active, .room-hub__device-icon:active { transform:scale(0.96); }
        .room-hub__home { display:grid; gap:12px; }
        .room-hub__home--image {
          background:center/cover no-repeat var(--room-hub-bg-image); border-radius:22px; isolation:isolate; overflow:hidden;
          padding:12px; position:relative;
        }
        .room-hub__home--image::before {
          background:linear-gradient(135deg, color-mix(in srgb, var(--ha-card-background) 72%, transparent), color-mix(in srgb, var(--ha-card-background) 90%, transparent));
          border-radius:inherit; content:""; inset:0; pointer-events:none; position:absolute; z-index:0;
        }
        .room-hub__header, .room-hub__context-actions, .room-hub__device-list, .room-hub__embed-list { position:relative; z-index:1; }
        .room-hub__header { align-items:flex-start; display:grid; gap:12px; grid-template-columns:auto minmax(0,1fr); }
        .room-hub__header--with-toggle { grid-template-columns:auto minmax(0,1fr) auto; }
        .room-hub__header--collapsed { grid-template-columns:auto minmax(0,1fr) auto; }
        .room-hub__room-icon {
          align-items:center; appearance:none; background:color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent); border-radius:999px; color:var(--primary-text-color);
          cursor:pointer; display:inline-flex; height:52px; justify-content:center; width:52px;
          box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0,0,0,0.12);
        }
        .room-hub__room-icon ha-icon { --mdc-icon-size:28px; }
        .room-hub__header--collapsed .room-hub__room-icon { height:42px; width:42px; }
        .room-hub__header--collapsed .room-hub__room-icon ha-icon { --mdc-icon-size:22px; }
        .room-hub__expand-toggle {
          align-items:center; appearance:none; background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent); border-radius:999px; color:var(--primary-text-color);
          cursor:pointer; display:inline-flex; height:36px; justify-content:center; padding:0; width:36px;
          transition:transform 150ms ease, background 180ms ease, border-color 180ms ease;
        }
        .room-hub__expand-toggle ha-icon { --mdc-icon-size:20px; }
        .room-hub__expand-toggle:active { transform:scale(0.96); }
        .room-hub__room-copy { align-content:start; display:grid; gap:8px; min-width:0; padding-top:2px; width:100%; }
        .room-hub__room-title { font-size:${styles.title_size}; font-weight:700; line-height:1.2; min-width:0; overflow-wrap:anywhere; width:100%; }
        .room-hub__status-chips { align-items:center; display:flex; flex-wrap:wrap; gap:4px; justify-content:flex-start; min-width:0; width:100%; }
        .room-hub__metric-bubble {
          align-items:center; appearance:none; border:1px solid transparent; border-radius:999px; cursor:pointer;
          display:inline-flex; font:inherit; font-size:${hubMetricFont}; font-weight:700; gap:4px; line-height:1; min-height:${hubMetricHeight}; padding:${hubMetricPadding};
          transition:transform 150ms ease, background 180ms ease, border-color 180ms ease;
        }
        .room-hub__metric-bubble ha-icon { --mdc-icon-size:${hubMetricIcon}; flex:0 0 auto; }
        .room-hub__metric-bubble--icon-only { justify-content:center; min-width:${hubMetricHeight}; padding:0; width:${hubMetricHeight}; }
        .room-hub__metric-bubble:active { transform:scale(0.97); }
        .room-hub__metric-bubble--temperature {
          background:color-mix(in srgb, var(--warning-color, #f6b73c) 18%, var(--ha-card-background));
          border-color:color-mix(in srgb, var(--warning-color, #f6b73c) 28%, transparent);
          color:color-mix(in srgb, var(--warning-color, #f6b73c) 88%, var(--primary-text-color));
        }
        .room-hub__metric-bubble--humidity {
          background:color-mix(in srgb, #5aa7ff 18%, var(--ha-card-background));
          border-color:color-mix(in srgb, #5aa7ff 28%, transparent);
          color:color-mix(in srgb, #5aa7ff 88%, var(--primary-text-color));
        }
        .room-hub__metric-bubble--presence-occupied {
          background:color-mix(in srgb, var(--success-color, #4caf50) 18%, var(--ha-card-background));
          border-color:color-mix(in srgb, var(--success-color, #4caf50) 28%, transparent);
          color:color-mix(in srgb, var(--success-color, #4caf50) 88%, var(--primary-text-color));
        }
        .room-hub__metric-bubble--presence-vacant {
          background:color-mix(in srgb, var(--primary-text-color) 8%, var(--ha-card-background));
          border-color:color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          color:var(--secondary-text-color);
        }
        .room-hub__context-actions { display:flex; flex-wrap:wrap; gap:6px; }
        .room-hub__context-action {
          align-items:center; appearance:none; background:color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); border-radius:999px; color:var(--primary-text-color);
          cursor:pointer; display:inline-flex; font:inherit; height:${hubActionSize}; justify-content:center; padding:0; width:${hubActionSize};
          transition:transform 150ms ease, background 180ms ease, border-color 180ms ease;
        }
        .room-hub__context-action ha-icon { --mdc-icon-size:${hubActionIcon}; }
        .room-hub__context-action:active { transform:scale(0.96); }
        .room-hub__context-action--active {
          background:color-mix(in srgb, ${accentColor} 20%, transparent);
          border-color:color-mix(in srgb, ${accentColor} 28%, transparent);
          color:${accentColor};
        }
        .room-hub__context-action--warn { border-color:color-mix(in srgb, var(--warning-color,#f59e0b) 24%, transparent); color:var(--warning-color,#f59e0b); }
        .room-hub__device-list { display:grid; gap:10px; }
        .room-hub__device-row {
          align-items:center; background:var(--ha-card-background); border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius:28px; box-shadow:var(--ha-card-box-shadow); display:grid; gap:12px; grid-template-columns:auto minmax(0,1fr);
          min-height:72px; padding:12px 14px;
        }
        .room-hub__device-row.is-on {
          background:linear-gradient(135deg, color-mix(in srgb, ${accentColor} 16%, var(--ha-card-background)) 0%, var(--ha-card-background) 72%);
          border-color:color-mix(in srgb, ${accentColor} 24%, var(--divider-color));
        }
        .room-hub__device-icon {
          align-items:center; appearance:none; background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); border-radius:999px; color:var(--primary-text-color);
          cursor:pointer; display:inline-flex; height:46px; justify-content:center; width:46px;
        }
        .room-hub__device-body { display:grid; gap:8px; min-width:0; }
        .room-hub__embed-list { align-content:start; display:grid; gap:10px; overflow:visible; }
        .room-hub__panel { align-content:start; display:grid; }
        .room-hub__panel--embed { overflow:visible; }
        .room-hub__embed-host { display:block; min-width:0; overflow:visible; width:100%; }
        .room-hub__embed-host--media { margin-top:8px; }
        .room-hub__embed-host > nodalia-light-card,
        .room-hub__embed-host > nodalia-vacuum-card,
        .room-hub__embed-host > nodalia-fan-card,
        .room-hub__embed-host > nodalia-humidifier-card,
        .room-hub__embed-host > nodalia-entity-card,
        .room-hub__embed-host > nodalia-media-player { display:block; max-width:100%; overflow:visible; width:100%; }
        .room-hub__embed-host > nodalia-light-card .light-card.is-off,
        .room-hub__embed-host > nodalia-fan-card .fan-card.is-off,
        .room-hub__embed-host > nodalia-humidifier-card .humidifier-card.is-off,
        .room-hub__embed-host > nodalia-entity-card .entity-card.is-off {
          background: ${embedOffTint};
          border-color: color-mix(in srgb, ${embedOffTint} 55%, var(--divider-color));
          box-shadow: none;
        }
        .room-hub__device-name { font-size:${hubDeviceName}; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .room-hub__device-state { color:var(--secondary-text-color); font-size:${hubDeviceState}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .room-hub__device-controls { align-items:center; display:flex; flex-wrap:wrap; gap:6px; }
        .room-hub__mini-control {
          align-items:center; appearance:none; background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); border-radius:999px; color:var(--primary-text-color);
          cursor:pointer; display:inline-flex; height:34px; justify-content:center; width:34px;
        }
        .room-hub__mini-control--primary { background:color-mix(in srgb, ${accentColor} 18%, transparent); border-color:color-mix(in srgb, ${accentColor} 24%, transparent); color:${accentColor}; height:40px; width:40px; }
        .room-hub__climate-dial { display:grid; gap:10px; justify-items:center; padding:8px 0; text-align:center; }
        .room-hub__climate-value { font-size:28px; font-weight:700; line-height:1; }
        .room-hub__climate-target { color:var(--secondary-text-color); font-size:12px; }
        @keyframes room-hub-slide { from { opacity:0.94; transform:translateX(-4px); } to { opacity:1; transform:translateX(0); } }
        @media (max-width:420px) { .room-hub { grid-template-columns:minmax(0,1fr) auto; } .room-hub__bubble { height:38px; width:38px; } }
        @media (prefers-reduced-motion:reduce) { .room-hub__body--enter { animation:none; } }
      </style>
      <ha-card class="room-summary-card room-summary-card--hub">
        <div class="room-hub">
          <div class="room-hub__stage">
            ${this._renderHubHeader(config, summary, styles, collapsed)}
            <div class="room-hub__body ${animate ? "room-hub__body--enter" : ""}">
              ${renderedPanels.map(panel => `
                <section class="room-hub__view" data-hub-panel="${escapeHtml(panel)}" aria-hidden="${panel !== activePanel}"${panel === activePanel ? "" : " hidden"}>
                  ${panel === "home"
    ? this._renderHubHome(config, summary, styles, accentColor, collapsed)
    : this._renderHubPanelContent(panel, config, summary, styles, accentColor)}
                </section>`).join("")}
            </div>
          </div>
          ${!collapsed && navItems.length ? this._renderHubRail(navItems, activePanel) : ""}
        </div>
      </ha-card>`;
    this._animateContentOnNextRender = false;
    this._mountHubEmbeddedCards();
  }

  _renderEmpty() {
    return `<ha-card class="room-summary-card room-summary-card--empty">
      <div class="room-summary-card__empty-title">${escapeHtml(this._t("emptyTitle", "Nodalia Room Summary Card"))}</div>
      <div class="room-summary-card__empty-text">${escapeHtml(this._t("emptyBody", "Set a room name and connect room entities."))}</div>
    </ha-card>`;
  }

  _render() {
    if (!this.shadowRoot) return;
    const config = normalizeConfig(this._config || {});
    if (!hasRoomContent(config)) {
      this.shadowRoot.innerHTML = window.NodaliaUtils?.renderCardEmptyStateDocument?.(this._renderEmpty(), { card: config.styles?.card }) ?? this._renderEmpty();
      return;
    }
    this._renderHub();
    return;
  }
}

if (!customElements.get(CARD_TAG)) customElements.define(CARD_TAG, NodaliaRoomSummaryCard);

class NodaliaRoomSummaryCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = mergeConfig(DEFAULT_CONFIG, {});
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showStyleSection = false;
    this._editorShadowListenersAttached = false;
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onMediaConfigChanged = this._onMediaConfigChanged.bind(this);
  }

  connectedCallback() {
    this._attachEditorShadowListeners();
    window.NodaliaUtils?.bindEditorDialogLayoutFix?.(this);
  }

  disconnectedCallback() {
    this._detachEditorShadowListeners();
    window.NodaliaUtils?.releaseEditorDialogLayoutFix?.(this);
  }

  _attachEditorShadowListeners() {
    if (this._editorShadowListenersAttached || !this.shadowRoot) {
      return;
    }
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("value-changed", this._onShadowValueChanged);
    this._editorShadowListenersAttached = true;
  }

  _detachEditorShadowListeners() {
    if (!this._editorShadowListenersAttached || !this.shadowRoot) {
      return;
    }
    this.shadowRoot.removeEventListener("input", this._onShadowInput);
    this.shadowRoot.removeEventListener("change", this._onShadowInput);
    this.shadowRoot.removeEventListener("click", this._onShadowClick);
    this.shadowRoot.removeEventListener("value-changed", this._onShadowValueChanged);
    this._editorShadowListenersAttached = false;
  }

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    this._render();
    this._restoreFocusState(focusState);
  }

  set hass(hass) {
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender = !this._hass || nextSignature !== this._entityOptionsSignature || !this.shadowRoot?.innerHTML;
    this._hass = hass;
    this._entityOptionsSignature = nextSignature;
    if (!shouldRender) {
      this.shadowRoot?.querySelectorAll('[data-mounted-control="entity"]').forEach(host => this._mountEntityPicker(host));
      this.shadowRoot?.querySelectorAll("nodalia-media-player-editor").forEach(editor => { editor.hass = hass; });
      return;
    }
    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils?.editorStatesSignature?.(hass, this._config?.language ?? "auto") || "";
  }

  _captureFocusState() {
    const active = this.shadowRoot?.activeElement;
    if (
      !(
        active instanceof HTMLInputElement
        || active instanceof HTMLTextAreaElement
        || active instanceof HTMLSelectElement
      )
    ) {
      return null;
    }
    return {
      field: active.dataset?.field || "",
      start: typeof active.selectionStart === "number" ? active.selectionStart : null,
      end: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
    };
  }

  _restoreFocusState(focusState) {
    if (!focusState?.field) {
      return;
    }
    const next = this.shadowRoot?.querySelector(`[data-field="${CSS.escape(focusState.field)}"]`);
    if (
      !(
        next instanceof HTMLInputElement
        || next instanceof HTMLTextAreaElement
        || next instanceof HTMLSelectElement
      )
    ) {
      return;
    }
    next.focus();
    if (typeof focusState.start === "number" && typeof focusState.end === "number" && typeof next.setSelectionRange === "function") {
      next.setSelectionRange(focusState.start, focusState.end);
    }
  }

  _watchEditorControlTag(tagName) {
    if (!tagName || this._pendingEditorControlTags.has(tagName)) {
      return;
    }
    if (typeof customElements?.whenDefined !== "function" || customElements.get(tagName)) {
      return;
    }
    this._pendingEditorControlTags.add(tagName);
    customElements
      .whenDefined(tagName)
      .then(() => {
        this._pendingEditorControlTags.delete(tagName);
        if (!this.isConnected || !this._hass || !this.shadowRoot) {
          return;
        }
        const focusState = this._captureFocusState();
        this._render();
        this._restoreFocusState(focusState);
      })
      .catch(() => {
        this._pendingEditorControlTags.delete(tagName);
      });
  }

  _ensureEditorControlsReady() {
    this._watchEditorControlTag("ha-entity-picker");
    this._watchEditorControlTag("ha-selector");
    this._watchEditorControlTag("ha-icon-picker");
    this._watchEditorControlTag("nodalia-media-player-editor");
  }

  _editorLabel(key) {
    return window.NodaliaI18n?.editorStr?.(this._hass, this._config?.language ?? "auto", key) || key;
  }

  _emitConfig(reRender = false) {
    const outgoing = stripEqualToDefaults(normalizeConfig(this._config), DEFAULT_CONFIG);
    fireEvent(this, "config-changed", { config: outgoing || {} });
    if (reRender) {
      this._render();
    }
  }

  _onShadowInput(e) {
    const input = e.composedPath().find(n => n instanceof HTMLInputElement || n instanceof HTMLSelectElement || n instanceof HTMLTextAreaElement);
    if (!input?.dataset?.field) return;
    e.stopPropagation();
    let value = input.type === "checkbox" ? input.checked : input.value;
    if (input.dataset.valueType === "color" && input instanceof HTMLInputElement) {
      value = formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
    }
    setByPath(this._config, input.dataset.field, value);
    if (e.type === "change") this._emitConfig(false);
  }

  _onShadowValueChanged(e) {
    const host = e.composedPath().find(node => node instanceof HTMLElement && node.dataset?.field);
    if (!host?.dataset?.field) {
      return;
    }
    e.stopPropagation();
    setByPath(this._config, host.dataset.field, String(e.detail?.value || "").trim());
    this._emitConfig(false);
  }

  _onShadowClick(e) {
    const btn = e.composedPath().find(n => n instanceof HTMLElement && n.dataset?.act);
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const list = btn.dataset.list;
    const idx = Number(btn.dataset.index);
    if (btn.dataset.act === "add" && list) {
      if (!Array.isArray(this._config[list])) this._config[list] = [];
      this._config[list].push("");
      if (CUSTOMIZABLE_EMBED_LISTS.has(list)) {
        if (!Array.isArray(this._config.embed_options?.[list])) this._config.embed_options[list] = [];
        this._config.embed_options[list].push({ entity: "", name: "", icon: "" });
      }
      this._emitConfig(true);
      return;
    }
    if (btn.dataset.act === "remove" && list && Number.isInteger(idx)) {
      if (!Array.isArray(this._config[list])) this._config[list] = [];
      this._config[list].splice(idx, 1);
      if (CUSTOMIZABLE_EMBED_LISTS.has(list) && Array.isArray(this._config.embed_options?.[list])) {
        this._config.embed_options[list].splice(idx, 1);
      }
      this._emitConfig(true);
      return;
    }
    if (btn.dataset.act === "move-up" && list && Number.isInteger(idx)) {
      if (!Array.isArray(this._config[list])) this._config[list] = [];
      moveListItem(this._config[list], idx, idx - 1);
      if (CUSTOMIZABLE_EMBED_LISTS.has(list) && Array.isArray(this._config.embed_options?.[list])) {
        moveListItem(this._config.embed_options[list], idx, idx - 1);
      }
      this._emitConfig(true);
      return;
    }
    if (btn.dataset.act === "move-down" && list && Number.isInteger(idx)) {
      if (!Array.isArray(this._config[list])) this._config[list] = [];
      moveListItem(this._config[list], idx, idx + 1);
      if (CUSTOMIZABLE_EMBED_LISTS.has(list) && Array.isArray(this._config.embed_options?.[list])) {
        moveListItem(this._config.embed_options[list], idx, idx + 1);
      }
      this._emitConfig(true);
      return;
    }
    if (btn.dataset.act === "toggle-styles") {
      this._showStyleSection = !this._showStyleSection;
      this._emitConfig(true);
    }
  }

  _editorList(listKey) {
    return Array.isArray(this._config[listKey]) ? this._config[listKey] : [];
  }

  _mediaEditorConfig() {
    const native = isObject(this._config?.media_config) ? deepClone(this._config.media_config) : {};
    if (!Array.isArray(native.players) || !native.players.length) {
      native.players = hubMediaPlayerIds(this._config).map(entity => ({ entity }));
    }
    return native;
  }

  _onMediaConfigChanged(event) {
    event.stopPropagation();
    const mediaConfig = isObject(event.detail?.config) ? deepClone(event.detail.config) : {};
    const ids = (mediaConfig.players || []).map(player => String(player?.entity || "").trim()).filter(Boolean);
    this._config.media_config = mediaConfig;
    this._config.media_player = ids[0] || "";
    this._config.media_players = ids.slice(1);
    this._emitConfig(false);
  }

  _entityLabel(entityId) {
    const id = String(entityId || "").trim();
    if (!id) {
      return this._editorLabel("ed.room_summary.entity");
    }
    const friendly = String(this._hass?.states?.[id]?.attributes?.friendly_name || "").trim();
    return friendly && friendly !== id ? `${friendly} (${id})` : id;
  }

  _field(label, field, value, opts = {}) {
    return `<label class="editor-field ${opts.full ? "editor-field--full" : ""}"><span>${escapeHtml(this._editorLabel(label))}</span>
      <input data-field="${escapeHtml(field)}" value="${escapeHtml(value ?? "")}" placeholder="${escapeHtml(opts.ph ? this._editorLabel(opts.ph) : "")}" /></label>`;
  }

  _check(label, field, checked) {
    return `<label class="editor-toggle">
      <input type="checkbox" data-field="${escapeHtml(field)}" ${checked ? "checked" : ""} />
      <span class="editor-toggle__switch" aria-hidden="true"></span>
      <span>${escapeHtml(this._editorLabel(label))}</span>
    </label>`;
  }

  _select(label, field, value, options) {
    return `<label class="editor-field"><span>${escapeHtml(this._editorLabel(label))}</span><select data-field="${escapeHtml(field)}">
      ${options.map(o => `<option value="${escapeHtml(o.v)}" ${String(value) === o.v ? "selected" : ""}>${escapeHtml(this._editorLabel(o.l))}</option>`).join("")}
    </select></label>`;
  }

  _entity(label, field, value, domains = []) {
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `<label class="editor-field editor-field--full"><span>${escapeHtml(this._editorLabel(label))}</span>
      <div
        class="editor-control-host"
        data-mounted-control="entity"
        data-field="${escapeHtml(field)}"
        data-value="${escapeHtml(inputValue)}"
        data-include-domains="${escapeHtml(domains.join(","))}"
      ></div></label>`;
  }

  _iconField(label, field, value) {
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `<div class="editor-field">
      <span>${escapeHtml(this._editorLabel(label))}</span>
      <div
        class="editor-control-host"
        data-mounted-control="icon-picker"
        data-field="${escapeHtml(field)}"
        data-value="${escapeHtml(inputValue)}"
      ></div>
    </div>`;
  }

  _renderColorField(label, field, value, options = {}) {
    const fallbackValue = options.fallbackValue || getEditorColorFallbackValue(field);
    const currentValue = value === undefined || value === null || value === ""
      ? fallbackValue
      : String(value);
    const colorModel = getEditorColorModel(currentValue, fallbackValue);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(this._editorLabel(label))}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="${escapeHtml(this._editorLabel("ed.entity.custom_color"))}">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="color"
              data-alpha="${escapeHtml(String(colorModel.alpha))}"
              value="${escapeHtml(colorModel.hex)}"
              aria-label="${escapeHtml(this._editorLabel(label))}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>`;
  }

  _listSection(title, hint, listKey, domains, customizable = false) {
    const rows = this._editorList(listKey);
    const total = rows.length;
    const moveUp = this._editorLabel("ed.notifications.move_up");
    const moveDown = this._editorLabel("ed.notifications.move_down");
    return `<section class="editor-section editor-section--nested"><div class="editor-section__header">
      <div><div class="editor-section__title">${escapeHtml(this._editorLabel(title))}</div>
      <div class="editor-section__hint">${escapeHtml(this._editorLabel(hint))}</div></div>
      <button type="button" data-act="add" data-list="${escapeHtml(listKey)}">${escapeHtml(this._editorLabel("ed.room_summary.add_entity"))}</button></div>
      ${rows.length ? rows.map((id, i) => {
    const option = this._config.embed_options?.[listKey]?.[i] || {};
    return `<div class="item-card"><div class="item-card__header">
        <span class="item-card__title">${escapeHtml(this._entityLabel(id))}</span>
        <div class="item-card__actions">
          <button type="button" data-act="move-up" data-list="${escapeHtml(listKey)}" data-index="${i}" ${i === 0 ? "disabled" : ""} title="${escapeHtml(moveUp)}">↑</button>
          <button type="button" data-act="move-down" data-list="${escapeHtml(listKey)}" data-index="${i}" ${i >= total - 1 ? "disabled" : ""} title="${escapeHtml(moveDown)}">↓</button>
          <button type="button" class="danger" data-act="remove" data-list="${escapeHtml(listKey)}" data-index="${i}">${escapeHtml(this._editorLabel("ed.room_summary.remove_entity"))}</button>
        </div></div>
        ${this._entity("ed.room_summary.entity", `${listKey}.${i}`, id, domains)}
        ${customizable ? `<div class="editor-grid item-card__customization">
          ${this._field("ed.entity.name", `embed_options.${listKey}.${i}.name`, option.name, { full: true })}
          ${this._iconField("ed.entity.icon", `embed_options.${listKey}.${i}.icon`, option.icon)}
        </div>` : ""}</div>`;
  }).join("") : `<div class="empty">${escapeHtml(this._editorLabel("ed.room_summary.list_empty"))}</div>`}
    </section>`;
  }

  _mediaConfigSection() {
    return `<section class="editor-section editor-section--nested">
      <div class="editor-section__header"><div>
        <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.room_summary.media_players_section_title"))}</div>
        <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.room_summary.media_players_section_hint"))}</div>
      </div></div>
      <div class="native-editor-host" data-mounted-control="media-config-editor"></div>
    </section>`;
  }

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) return;
    window.NodaliaUtils?.mountEntityPickerHost?.(host, {
      hass: this._hass,
      field: host.dataset.field || "entity",
      value: host.dataset.value || getByPath(this._config, host.dataset.field || "") || "",
      onShadowInput: this._onShadowInput,
      onShadowValueChanged: this._onShadowValueChanged,
      copyDatasetFromHost: true,
    });
    const domains = String(host.dataset.includeDomains || "").split(",").map(item => item.trim()).filter(Boolean);
    const picker = host.querySelector("ha-entity-picker");
    if (picker && domains.length) {
      picker.includeDomains = domains;
    }
  }

  _mountIconPicker(host) {
    window.NodaliaUtils?.mountIconPickerHost?.(host, {
      hass: this._hass,
      value: host.dataset.value || getByPath(this._config, host.dataset.field || "") || "",
      onShadowInput: this._onShadowInput,
      onShadowValueChanged: this._onShadowValueChanged,
      copyDatasetFromHost: true,
    });
  }

  _mountMediaConfigEditor(host) {
    if (!(host instanceof HTMLElement)) return;
    if (!customElements.get("nodalia-media-player-editor")) {
      this._watchEditorControlTag("nodalia-media-player-editor");
      return;
    }
    const editor = document.createElement("nodalia-media-player-editor");
    editor.addEventListener("config-changed", this._onMediaConfigChanged);
    editor.hass = this._hass;
    editor.setConfig(this._mediaEditorConfig());
    host.replaceChildren(editor);
  }

  _render() {
    const c = this._config || {};
    this.shadowRoot.innerHTML = `<style>
      :host { display: block; overflow-anchor: none; }
      * { box-sizing: border-box; }
      .editor { color: var(--primary-text-color); display: grid; gap: 16px; }
      .editor-section {
        background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
        border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
        border-radius: 18px;
        display: grid;
        gap: 14px;
        padding: 16px;
      }
      .editor-section:last-child { margin-bottom: 0; }
      .editor-section--nested {
        background: color-mix(in srgb, var(--primary-text-color) 1.5%, transparent);
        border-radius: 14px;
        padding: 12px;
      }
      .editor-section__header { align-items: start; display: flex; gap: 10px; justify-content: space-between; }
      .editor-section__title { font-size: 15px; font-weight: 700; }
      .editor-section__hint { color: var(--secondary-text-color); font-size: 12px; line-height: 1.45; }
      .editor-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .editor-field, .editor-toggle { display: grid; gap: 6px; min-width: 0; }
      .editor-field--full { grid-column: 1 / -1; }
      .editor-field > span, .editor-toggle > span:not(.editor-toggle__switch) {
        color: var(--secondary-text-color);
        font-size: 12px;
        font-weight: 600;
      }
      .editor-field input, .editor-field select {
        appearance: none;
        background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
        border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        border-radius: 12px;
        color: var(--primary-text-color);
        font: inherit;
        min-height: 40px;
        padding: 10px 12px;
        width: 100%;
      }
      .editor-control-host, .editor-control-host > * { display: block; width: 100%; }
      .native-editor-host, .native-editor-host > * { display: block; min-width: 0; width: 100%; }
      .editor-toggle {
        align-items: center;
        column-gap: 10px;
        cursor: pointer;
        grid-template-columns: auto minmax(0, 1fr);
        min-height: 40px;
        position: relative;
      }
      .editor-toggle input {
        block-size: 1px;
        inline-size: 1px;
        margin: 0;
        opacity: 0;
        pointer-events: none;
        position: absolute;
      }
      .editor-toggle__switch {
        background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
        border-radius: 999px;
        display: inline-flex;
        height: 22px;
        position: relative;
        transition: background 160ms ease, border-color 160ms ease;
        width: 40px;
      }
      .editor-toggle__switch::before {
        background: rgba(255, 255, 255, 0.92);
        border-radius: 999px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.24);
        content: "";
        height: 18px;
        left: 1px;
        position: absolute;
        top: 1px;
        transition: transform 160ms ease;
        width: 18px;
      }
      .editor-toggle input:checked + .editor-toggle__switch {
        background: var(--primary-color);
        border-color: var(--primary-color);
      }
      .editor-toggle input:checked + .editor-toggle__switch::before {
        transform: translateX(18px);
      }
      button {
        appearance: none;
        background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
        border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        border-radius: 999px;
        color: var(--primary-text-color);
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        min-height: 34px;
        padding: 0 12px;
      }
      button.danger { color: var(--error-color); }
      button:disabled { cursor: default; opacity: 0.45; }
      .item-card__actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .item-card {
        background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
        border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
        border-radius: 14px;
        display: grid;
        gap: 10px;
        padding: 12px;
      }
      .item-card__header { align-items: center; display: flex; gap: 10px; justify-content: space-between; }
      .item-card__title { font-size: 13px; font-weight: 700; }
      .empty { color: var(--secondary-text-color); font-size: 12px; line-height: 1.45; }
      .editor-color-field {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        min-height: 40px;
      }
      .editor-color-picker {
        align-items: center;
        background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
        border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        border-radius: 999px;
        cursor: pointer;
        display: inline-flex;
        flex: 0 0 auto;
        height: 40px;
        justify-content: center;
        position: relative;
        width: 40px;
      }
      .editor-color-picker input {
        cursor: pointer;
        inset: 0;
        opacity: 0;
        position: absolute;
        width: 100%;
      }
      .editor-color-swatch {
        background: var(--editor-swatch, var(--primary-color));
        border: 1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent);
        border-radius: 999px;
        display: block;
        height: 28px;
        width: 28px;
      }
      @media (max-width: 640px) { .editor-grid { grid-template-columns: 1fr; } }
    </style><div class="editor">
      <section class="editor-section">
        <div class="editor-section__header">
          <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.room_summary.general_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.room_summary.general_section_hint"))}</div>
        </div>
        <div class="editor-grid">
        ${this._field("ed.room_summary.name", "name", c.name, { ph: "ed.room_summary.name_placeholder", full: true })}
        ${this._iconField("ed.room_summary.icon", "icon", c.icon)}
        ${this._field("ed.room_summary.image", "image", c.image, { full: true })}
      </div></section>
      <section class="editor-section">
        <div class="editor-section__header">
          <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.room_summary.entities_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.room_summary.entities_section_hint"))}</div>
        </div>
        <div class="editor-grid">
        ${this._entity("ed.room_summary.temperature_entity", "temperature", c.temperature, ["sensor"])}
        ${this._entity("ed.room_summary.humidity_entity", "humidity", c.humidity, ["sensor"])}
        ${this._entity("ed.room_summary.presence_entity", "presence", c.presence, ["binary_sensor", "device_tracker", "person"])}
        ${this._entity("ed.room_summary.climate_entity", "climate", c.climate, ["climate"])}
        ${this._entity("ed.room_summary.camera_entity", "camera", c.camera, ["camera"])}
        ${this._entity("ed.room_summary.power_entity", "power", c.power, ["sensor"])}
        ${this._entity("ed.room_summary.air_quality_entity", "air_quality", c.air_quality, ["sensor"])}
      </div>
      ${this._mediaConfigSection()}
      ${this._listSection("ed.room_summary.lights_section_title", "ed.room_summary.lights_section_hint", "lights", ["light"], true)}
      ${this._listSection("ed.room_summary.covers_section_title", "ed.room_summary.covers_section_hint", "covers", ["cover"])}
      ${this._listSection("ed.room_summary.vacuums_section_title", "ed.room_summary.vacuums_section_hint", "vacuums", ["vacuum"], true)}
      ${this._listSection("ed.room_summary.fans_section_title", "ed.room_summary.fans_section_hint", "fans", ["fan"], true)}
      ${this._listSection("ed.room_summary.humidifiers_section_title", "ed.room_summary.humidifiers_section_hint", "humidifiers", ["humidifier"], true)}
      ${this._listSection("ed.room_summary.others_section_title", "ed.room_summary.others_section_hint", "others", [], true)}
      ${this._listSection("ed.room_summary.doors_section_title", "ed.room_summary.doors_section_hint", "doors", ["binary_sensor"])}
      ${this._listSection("ed.room_summary.windows_section_title", "ed.room_summary.windows_section_hint", "windows", ["binary_sensor"])}
      ${this._listSection("ed.room_summary.locks_section_title", "ed.room_summary.locks_section_hint", "locks", ["lock"])}
      ${this._listSection("ed.room_summary.alerts_section_title", "ed.room_summary.alerts_section_hint", "alerts", ["binary_sensor"])}
      </section>
      <section class="editor-section">
        <div class="editor-section__header">
          <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.room_summary.display_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.room_summary.display_section_hint"))}</div>
        </div>
        <div class="editor-grid">
        ${this._check("ed.room_summary.show_temperature", "show_temperature", c.show_temperature)}
        ${this._check("ed.room_summary.show_humidity", "show_humidity", c.show_humidity)}
        ${this._check("ed.room_summary.show_presence", "show_presence", c.show_presence)}
        ${this._check("ed.room_summary.show_climate", "show_climate", c.show_climate)}
        ${this._check("ed.room_summary.show_lights", "show_lights", c.show_lights)}
        ${this._check("ed.room_summary.show_covers", "show_covers", c.show_covers)}
        ${this._check("ed.room_summary.show_camera", "show_camera", c.show_camera)}
        ${this._check("ed.room_summary.show_media", "show_media", c.show_media)}
        ${this._check("ed.room_summary.show_security", "show_security", c.show_security)}
        ${this._check("ed.room_summary.show_power", "show_power", c.show_power)}
        ${this._check("ed.room_summary.show_quick_actions", "show_quick_actions", c.show_quick_actions)}
        ${this._check("ed.room_summary.collapsible", "collapsible", c.collapsible)}
      </div></section>
      <section class="editor-section">
        <div class="editor-section__header">
          <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.room_summary.actions_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.room_summary.actions_section_hint"))}</div>
        </div>
        <div class="editor-grid">
        ${this._select("ed.room_summary.tap_action", "tap_action", c.tap_action, [
          { v: "none", l: "ed.room_summary.tap_none" },
          { v: "more-info", l: "ed.room_summary.tap_more_info" },
          { v: "navigate", l: "ed.room_summary.tap_navigate" },
        ])}
        ${this._field("ed.room_summary.navigation_path", "navigation_path", c.navigation_path, { full: true, ph: "ed.room_summary.navigation_path" })}
      </div></section>
      <section class="editor-section">
        <div class="editor-section__header">
          <div>
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.entity.styles_section_hint"))}</div>
          </div>
          <button type="button" data-act="toggle-styles">
            ${escapeHtml(this._showStyleSection ? this._editorLabel("ed.weather.hide_style_settings") : this._editorLabel("ed.weather.show_style_settings"))}
          </button>
        </div>
        ${this._showStyleSection ? `<div class="editor-grid">
          ${this._renderColorField("ed.entity.style_accent_color", "styles.accent", c.styles?.accent)}
          ${this._renderColorField("ed.entity.style_card_bg", "styles.card.background", c.styles?.card?.background)}
          ${this._renderColorField("ed.room_summary.style_embed_off_tint", "styles.embed_off_tint", c.styles?.embed_off_tint)}
          ${this._field("ed.room_summary.style_title_size", "styles.title_size", c.styles?.title_size)}
          <div class="editor-section__hint editor-field--full">${escapeHtml(this._editorLabel("ed.room_summary.hub_styles_section_hint"))}</div>
          ${this._field("ed.room_summary.style_hub_metric_chip_font", "styles.hub.metric_chip_font_size", c.styles?.hub?.metric_chip_font_size)}
          ${this._field("ed.room_summary.style_hub_metric_chip_height", "styles.hub.metric_chip_height", c.styles?.hub?.metric_chip_height)}
          ${this._field("ed.room_summary.style_hub_metric_chip_padding", "styles.hub.metric_chip_padding", c.styles?.hub?.metric_chip_padding)}
          ${this._field("ed.room_summary.style_hub_metric_chip_icon", "styles.hub.metric_chip_icon_size", c.styles?.hub?.metric_chip_icon_size)}
          ${this._field("ed.room_summary.style_hub_context_action_size", "styles.hub.context_action_size", c.styles?.hub?.context_action_size)}
          ${this._field("ed.room_summary.style_hub_context_action_icon", "styles.hub.context_action_icon_size", c.styles?.hub?.context_action_icon_size)}
          ${this._field("ed.room_summary.style_hub_embed_title_size", "styles.hub.embed_title_size", c.styles?.hub?.embed_title_size)}
          ${this._field("ed.room_summary.style_hub_embed_chip_font", "styles.hub.embed_chip_font_size", c.styles?.hub?.embed_chip_font_size)}
          ${this._field("ed.room_summary.style_hub_embed_chip_height", "styles.hub.embed_chip_height", c.styles?.hub?.embed_chip_height)}
          ${this._field("ed.room_summary.style_hub_embed_chip_padding", "styles.hub.embed_chip_padding", c.styles?.hub?.embed_chip_padding)}
          ${this._field("ed.room_summary.style_hub_device_name_size", "styles.hub.device_name_size", c.styles?.hub?.device_name_size)}
          ${this._field("ed.room_summary.style_hub_device_state_size", "styles.hub.device_state_size", c.styles?.hub?.device_state_size)}
        </div>` : ""}
      </section>
    </div>`;
    this._detachEditorShadowListeners();
    this._attachEditorShadowListeners();
    this.shadowRoot.querySelectorAll('[data-mounted-control="entity"]').forEach(host => this._mountEntityPicker(host));
    this.shadowRoot.querySelectorAll('[data-mounted-control="icon-picker"]').forEach(host => this._mountIconPicker(host));
    this.shadowRoot.querySelectorAll('[data-mounted-control="media-config-editor"]').forEach(host => this._mountMediaConfigEditor(host));
    this._ensureEditorControlsReady();
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}

if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, NodaliaRoomSummaryCardEditor);

(function registerRoomSummaryCard() {
  const lang = window.NodaliaI18n?.resolveLanguage?.(null, "auto") ?? "en";
  const pack = window.NodaliaI18n?.strings?.(lang)?.roomSummaryCard || window.NodaliaI18n?.strings?.("en")?.roomSummaryCard || {};
  window.NodaliaUtils.registerCustomCard({
    type: CARD_TAG,
    name: "Nodalia Room Summary Card",
    description: String(pack.cardDescription || "Room overview for Nodalia dashboards."),
    preview: true,
  });
})();

if (typeof globalThis !== "undefined") {
  globalThis.__NODALIA_ROOM_SUMMARY__ = {
    normalizeConfig,
    normalizeEntityField,
    hubMediaPlayerIds,
    buildRoomSummary,
    hasRoomContent,
    formatMetric,
    getState,
  };
}
