const CARD_TAG = "nodalia-room-summary-card";
const EDITOR_TAG = "nodalia-room-summary-card-editor";
const CARD_VERSION = "2.0.0-alpha.3";

const LAYOUT_MODES = new Set(["compact", "standard", "detailed", "security", "climate"]);
const DENSITY_MODES = new Set(["comfortable", "compact"]);
const COMFORT = { hot: 27, cold: 17, humid: 70, dry: 30 };

const DEFAULT_CONFIG = {
  name: "",
  icon: "mdi:floor-plan",
  image: "",
  language: "auto",
  layout: "standard",
  density: "comfortable",
  temperature: "",
  humidity: "",
  presence: "",
  occupancy: "",
  climate: "",
  camera: "",
  media_player: "",
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
  },
};

const STUB_CONFIG = { name: "Living room", icon: "mdi:sofa", layout: "standard" };

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

function escapeHtml(v) {
  return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function finiteNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
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
  config.layout = LAYOUT_MODES.has(normalizeTextKey(config.layout)) ? normalizeTextKey(config.layout) : "standard";
  config.density = DENSITY_MODES.has(normalizeTextKey(config.density)) ? normalizeTextKey(config.density) : "comfortable";

  config.temperature = entityScalar(config.temperature, config.temperature_entity);
  config.humidity = entityScalar(config.humidity, config.humidity_entity);
  config.presence = entityScalar(config.presence, config.occupancy_entity, config.occupancy);
  config.occupancy = entityScalar(config.occupancy, config.presence);
  config.climate = entityScalar(config.climate, config.climate_entity);
  config.camera = entityScalar(config.camera);
  config.media_player = entityScalar(config.media_player);
  config.power = entityScalar(config.power);
  config.air_quality = entityScalar(config.air_quality);

  config.lights = entityList(config.lights, config.light_entities);
  config.covers = entityList(config.covers, config.cover_entities);
  config.locks = entityList(config.locks);
  config.doors = entityList(config.doors);
  config.windows = entityList(config.windows);
  config.alerts = entityList(config.alerts, config.motion_entities);

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
    || (c.lights || []).length || (c.covers || []).length || (c.locks || []).length
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
  const mediaState = getState(hass, c.media_player);

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
    this._onShadowClick = this._onShadowClick.bind(this);
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    this._animateContentOnNextRender = true;
    if (this._hass) { this._lastRenderSignature = ""; this._render(); }
  }

  disconnectedCallback() {
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
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

  getCardSize() { return this._config?.layout === "compact" ? 2 : 3; }
  getGridOptions() { return { rows: "auto", columns: "full", min_rows: this.getCardSize() }; }

  _t(key, fallback, values = {}) {
    const lang = window.NodaliaI18n?.resolveLanguage?.(this._hass, this._config?.language) ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.roomSummaryCard || window.NodaliaI18n?.strings?.("en")?.roomSummaryCard || {};
    const raw = key.split(".").reduce((cur, part) => (cur && cur[part] !== undefined ? cur[part] : undefined), pack);
    const text = raw ?? fallback;
    return window.NodaliaI18n?.format?.(text, values) ?? String(text).replace(/\{(\w+)\}/g, (_, t) => String(values[t] ?? ""));
  }

  _getRenderSignature(hass = this._hass) {
    return `${JSON.stringify(normalizeConfig(this._config))}|${buildRoomSummary(hass, this._config).lightsOn}`;
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

  _performCardAction(prefix) {
    const cfg = this._config || {};
    const action = String(cfg[`${prefix}_action`] || "none");
    if (action === "none") return;
    this._triggerHaptic();
    if (action === "more-info") {
      const entity = cfg.climate || cfg.temperature || cfg.camera || cfg.media_player || cfg.lights?.[0];
      if (entity) fireEvent(this, "hass-more-info", { entityId: entity });
      return;
    }
    if (action === "navigate") {
      const path = window.NodaliaUtils?.sanitizeActionUrl?.(cfg.navigation_path || cfg[`${prefix}_navigation_path`], { allowRelative: true });
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
    }
  }

  _onShadowClick(event) {
    const el = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.roomAction);
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    const action = el.dataset.roomAction;
    if (action === "primary") this._performCardAction("tap");
    else if (action === "hold") this._performCardAction("hold");
    else if (action?.startsWith("quick:")) this._runQuickAction(action.slice(6));
  }

  _chips(summary, config) {
    const chips = [];
    const add = (icon, label, kind = "muted") => chips.push({ icon, label, kind });

    if (config.show_presence && summary.occupied) add("mdi:account-check", this._t("occupied", "Occupied"), "active");
    else if (config.show_presence && summary.empty) add("mdi:account-off-outline", this._t("vacant", "Vacant"), "muted");

    if (config.show_lights && config.lights?.length) {
      add(summary.lights_on ? "mdi:lightbulb-on" : "mdi:lightbulb-outline",
        summary.lights_on ? this._t("lightsOn", "{count} on", { count: summary.lightsOn }) : this._t("lightsOff", "All off"),
        summary.lights_on ? "active" : "muted");
    }
    if (config.show_covers && config.covers?.length) {
      add(summary.cover_open ? "mdi:window-open" : "mdi:window-closed",
        summary.cover_open ? this._t("coversOpen", "{count} open", { count: summary.coversOpen }) : this._t("coversClosed", "All closed"),
        summary.cover_open ? "warn" : "muted");
    }
    if (config.show_security) {
      if (summary.doorsOpen) add("mdi:door-open", this._t("doorOpen", "Door open"), "warn");
      if (summary.windowsOpen) add("mdi:window-open", this._t("windowOpen", "Window open"), "warn");
      if (summary.locksUnlocked) add("mdi:lock-open-alert", this._t("lockUnlocked", "Unlocked"), "warn");
      if (summary.alert) add("mdi:alert", this._t("alert", "Alert"), "warn");
    }
    if (config.show_media && summary.media_playing) add("mdi:play-circle", this._t("mediaPlaying", "Playing"), "active");
    if (config.show_camera && summary.camera_offline) add("mdi:cctv-off", this._t("cameraOffline", "Camera offline"), "warn");
    if (summary.comfortable) add("mdi:emoticon-happy-outline", this._t("comfortable", "Comfortable"), "active");
    if (summary.hot) add("mdi:fire", this._t("hot", "Hot"), "warn");
    if (summary.cold) add("mdi:snowflake", this._t("cold", "Cold"), "warn");
    if (summary.humid) add("mdi:water-percent", this._t("humid", "Humid"), "warn");
    if (summary.dry) add("mdi:air-filter", this._t("dry", "Dry"), "warn");

    return chips;
  }

  _metrics(summary, config, layout) {
    const items = [];
    const push = (icon, label, value) => { if (value && value !== "—") items.push({ icon, label, value }); };
    if (config.show_temperature && config.temperature) push("mdi:thermometer", this._t("temperature", "Temperature"), summary.temperature);
    if (config.show_humidity && config.humidity) push("mdi:water-percent", this._t("humidity", "Humidity"), summary.humidity);
    if (config.show_climate && config.climate && summary.climateLabel) {
      push("mdi:home-thermometer-outline", this._t("climateLabel", "Climate"), summary.climateLabel);
    }
    if (layout === "detailed") {
      if (config.show_power && config.power) push("mdi:flash", this._t("power", "Power"), formatMetric(getState(this._hass, config.power)));
      if (config.show_power && config.air_quality) push("mdi:air-filter", this._t("airQuality", "Air quality"), formatMetric(getState(this._hass, config.air_quality)));
    }
    return items;
  }

  _quickActions(summary, config) {
    if (config.show_quick_actions === false) return [];
    const actions = [];
    if (config.lights?.length) {
      actions.push({
        id: summary.lights_on ? "lights_off" : "lights_on",
        icon: summary.lights_on ? "mdi:lightbulb-off" : "mdi:lightbulb-on",
        label: summary.lights_on ? this._t("turnOffLights", "Turn off lights") : this._t("turnOnLights", "Turn on lights"),
      });
    }
    if (config.covers?.length) {
      actions.push({
        id: summary.cover_open ? "covers_close" : "covers_open",
        icon: summary.cover_open ? "mdi:window-shutter" : "mdi:window-shutter-open",
        label: summary.cover_open ? this._t("closeCovers", "Close covers") : this._t("openCovers", "Open covers"),
      });
    }
    if (config.camera) actions.push({ id: "camera", icon: "mdi:cctv", label: this._t("openCamera", "Open camera") });
    if (config.climate) actions.push({ id: "climate", icon: "mdi:thermometer", label: this._t("climateDetails", "Climate details") });
    if (config.media_player) actions.push({ id: "media", icon: "mdi:play-circle", label: this._t("mediaPlayer", "Media player") });
    return actions;
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

    const summary = buildRoomSummary(this._hass, config);
    const layout = config.layout || "standard";
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const title = config.name || this._t("defaultName", "Room");
    const image = window.NodaliaUtils?.sanitizeActionUrl?.(config.image, { allowRelative: true }) || "";
    const metrics = this._metrics(summary, config, layout);
    const chips = this._chips(summary, config);
    const quickActions = this._quickActions(summary, config);
    const animate = config.animations?.enabled !== false && this._animateContentOnNextRender;
    const chipRadius = escapeHtml(styles.chip_border_radius || "999px");
    const chipHeight = escapeHtml(styles.chip_height || "24px");
    const chipFontSize = escapeHtml(styles.chip_font_size || "11px");
    const chipPadding = escapeHtml(styles.chip_padding || "0 9px");
    const accentColor = escapeHtml(styles.accent || "var(--primary-color)");
    const controlSize = escapeHtml(styles.control?.size || "36px");
    const controlAccentBg = escapeHtml(styles.control?.accent_background || "rgba(113, 192, 255, 0.18)");
    const controlAccentColor = escapeHtml(styles.control?.accent_color || "var(--primary-text-color)");
    const compact = layout === "compact";
    const security = layout === "security";
    const climateLayout = layout === "climate";
    const density = config.density === "compact" ? "compact" : "comfortable";
    const effectivePadding = density === "compact" ? "10px 12px" : styles.card.padding;
    const effectiveGap = density === "compact" ? "8px" : styles.card.gap;
    const isActive = Boolean(summary.lights_on || summary.media_playing || summary.occupied || summary.comfortable);
    const onCardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 52%, ${styles.card.background} 100%)`;
    const onCardBorder = `color-mix(in srgb, ${accentColor} 32%, var(--divider-color))`;
    const onCardShadow = `0 16px 32px color-mix(in srgb, ${accentColor} 18%, rgba(0, 0, 0, 0.18))`;
    const cardBackground = isActive ? onCardBackground : styles.card.background;
    const cardBorder = isActive ? `1px solid ${onCardBorder}` : styles.card.border;
    const cardShadow = isActive ? `${styles.card.box_shadow}, ${onCardShadow}` : styles.card.box_shadow;
    const iconBackground = isActive
      ? `color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent))`
      : styles.icon.background;
    const iconColor = isActive ? accentColor : styles.icon.color;

    const hero = image && !compact ? `
      <div class="room-summary-card__hero" style="background-image:url('${escapeHtml(image)}')">
        <div class="room-summary-card__hero-overlay"></div>
      </div>` : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; --room-summary-duration:${config.animations?.enabled ? config.animations.content_duration : 0}ms; }
        * { box-sizing:border-box; }
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
          background:${isActive
    ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`
    : "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0))"};
          border-radius:inherit;
          content:"";
          inset:0;
          pointer-events:none;
          position:absolute;
          z-index:0;
        }
        ha-card::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%);
          border-radius:inherit;
          content:"";
          inset:0;
          opacity:${isActive ? "1" : "0"};
          pointer-events:none;
          position:absolute;
          z-index:0;
        }
        .room-summary-card__content { display:grid; gap:${effectiveGap}; padding:${effectivePadding}; position:relative; z-index:1; }
        .room-summary-card__content--enter { animation:room-rise calc(var(--room-summary-duration)*0.9) cubic-bezier(.22,.84,.26,1) both; }
        .room-summary-card__hero { background:center/cover no-repeat; border-radius:18px; height:88px; overflow:hidden; position:relative; }
        .room-summary-card__hero-overlay { background:linear-gradient(180deg, transparent, color-mix(in srgb, var(--ha-card-background) 88%, black)); inset:0; position:absolute; }
        .room-summary-card__header { align-items:center; display:grid; gap:10px; grid-template-columns:auto minmax(0,1fr) auto; min-width:0; }
        .room-summary-card__icon {
          align-items:center;
          background:${iconBackground};
          border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius:999px;
          box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.16);
          color:${iconColor};
          display:inline-flex;
          flex:0 0 auto;
          height:${styles.icon.size};
          justify-content:center;
          width:${styles.icon.size};
        }
        .room-summary-card__icon ha-icon { --mdc-icon-size:calc(${styles.icon.size} * 0.48); }
        .room-summary-card__title { font-size:${styles.title_size}; font-weight:700; line-height:1.25; min-width:0; overflow-wrap:anywhere; }
        .room-summary-card__metrics { display:grid; gap:8px; grid-template-columns:repeat(${compact ? Math.min(metrics.length || 1, 2) : Math.min(metrics.length || 1, 3)}, minmax(0,1fr)); }
        .room-summary-card__metric {
          background:color-mix(in srgb, var(--primary-text-color) 3%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius:18px;
          display:grid;
          gap:4px;
          min-height:${climateLayout ? "72px" : "64px"};
          min-width:0;
          padding:10px 12px;
        }
        .room-summary-card__metric-label { align-items:center; color:var(--secondary-text-color); display:inline-flex; font-size:11px; font-weight:600; gap:6px; min-width:0; }
        .room-summary-card__metric-value { font-size:${climateLayout ? "16px" : styles.metric_size}; font-weight:700; line-height:1.2; overflow-wrap:anywhere; }
        .room-summary-card__chips, .room-summary-card__actions { display:flex; flex-wrap:wrap; gap:6px; min-width:0; }
        .room-summary-card__chip {
          align-items:center;
          background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius:${chipRadius};
          box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color:var(--secondary-text-color);
          display:inline-flex;
          flex:0 0 auto;
          font-size:${chipFontSize};
          font-weight:600;
          gap:6px;
          line-height:1;
          max-width:100%;
          min-height:${chipHeight};
          min-width:0;
          overflow:hidden;
          padding:${chipPadding};
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .room-summary-card__chip ha-icon { --mdc-icon-size:14px; flex:0 0 auto; }
        .room-summary-card__chip--active {
          background:color-mix(in srgb, ${accentColor} 16%, transparent);
          border-color:color-mix(in srgb, ${accentColor} 22%, transparent);
          color:${accentColor};
        }
        .room-summary-card__chip--warn {
          background:color-mix(in srgb, var(--warning-color,#f59e0b) 14%, transparent);
          border-color:color-mix(in srgb, var(--warning-color,#f59e0b) 22%, transparent);
          color:var(--warning-color,#f59e0b);
        }
        .room-summary-card__chip--muted { background:color-mix(in srgb, var(--primary-text-color) 6%, transparent); color:var(--secondary-text-color); }
        .room-summary-card__action {
          align-items:center;
          appearance:none;
          background:${controlAccentBg};
          border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius:999px;
          box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color:${controlAccentColor};
          cursor:pointer;
          display:inline-flex;
          font:inherit;
          font-size:11px;
          font-weight:600;
          gap:6px;
          line-height:1;
          min-height:${controlSize};
          padding:0 14px;
          transition:transform 150ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        .room-summary-card__action:hover { border-color:color-mix(in srgb, var(--primary-text-color) 16%, transparent); box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent), 0 8px 18px rgba(0, 0, 0, 0.12); }
        .room-summary-card__action:active { transform:scale(0.98); }
        .room-summary-card__action ha-icon { --mdc-icon-size:16px; }
        .room-summary-card__body { cursor:${config.tap_action !== "none" ? "pointer" : "default"}; }
        .room-summary-card--security { box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--warning-color,#f59e0b) 18%, transparent); }
        @keyframes room-rise { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @media (max-width:420px){ .room-summary-card__metrics{ grid-template-columns:1fr; } }
        @media (prefers-reduced-motion:reduce){ .room-summary-card__content--enter{ animation:none; } }
      </style>
      <ha-card class="room-summary-card room-summary-card--${escapeHtml(layout)} ${security && summary.security_issue ? "room-summary-card--security-alert" : ""}">
        <div class="room-summary-card__content ${animate ? "room-summary-card__content--enter" : ""} room-summary-card__body" data-room-action="${config.tap_action !== "none" ? "primary" : ""}">
          ${hero}
          <div class="room-summary-card__header">
            <div class="room-summary-card__icon"><ha-icon icon="${escapeHtml(config.icon)}"></ha-icon></div>
            <div class="room-summary-card__title">${escapeHtml(title)}</div>
            ${compact && summary.alert ? `<ha-icon icon="mdi:alert-circle" title="${escapeHtml(this._t("alert", "Alert"))}"></ha-icon>` : ""}
          </div>
          ${metrics.length ? `<div class="room-summary-card__metrics">${metrics.map(m => `
            <div class="room-summary-card__metric">
              <div class="room-summary-card__metric-label"><ha-icon icon="${escapeHtml(m.icon)}"></ha-icon><span>${escapeHtml(m.label)}</span></div>
              <div class="room-summary-card__metric-value">${escapeHtml(m.value)}</div>
            </div>`).join("")}</div>` : ""}
          ${chips.length ? `<div class="room-summary-card__chips">${chips.map(c => `
            <span class="room-summary-card__chip room-summary-card__chip--${escapeHtml(c.kind)}"><ha-icon icon="${escapeHtml(c.icon)}"></ha-icon><span>${escapeHtml(c.label)}</span></span>`).join("")}</div>` : ""}
          ${quickActions.length && !compact ? `<div class="room-summary-card__actions">${quickActions.map(a => `
            <button type="button" class="room-summary-card__action" data-room-action="quick:${escapeHtml(a.id)}"><ha-icon icon="${escapeHtml(a.icon)}"></ha-icon><span>${escapeHtml(a.label)}</span></button>`).join("")}</div>` : ""}
        </div>
      </ha-card>`;
    this._animateContentOnNextRender = false;
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
    this._editorShadowListenersAttached = false;
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
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
    this._config = mergeConfig(DEFAULT_CONFIG, config || {});
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
      return;
    }
    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils?.editorFilteredStatesSignature?.(hass, this._config?.language ?? "auto") || "";
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
    setByPath(this._config, input.dataset.field, input.type === "checkbox" ? input.checked : input.value);
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
      this._emitConfig(true);
      return;
    }
    if (btn.dataset.act === "remove" && list && Number.isInteger(idx)) {
      if (!Array.isArray(this._config[list])) this._config[list] = [];
      this._config[list].splice(idx, 1);
      this._emitConfig(true);
      return;
    }
    if (btn.dataset.act === "move-up" && list && Number.isInteger(idx)) {
      if (!Array.isArray(this._config[list])) this._config[list] = [];
      moveListItem(this._config[list], idx, idx - 1);
      this._emitConfig(true);
      return;
    }
    if (btn.dataset.act === "move-down" && list && Number.isInteger(idx)) {
      if (!Array.isArray(this._config[list])) this._config[list] = [];
      moveListItem(this._config[list], idx, idx + 1);
      this._emitConfig(true);
    }
  }

  _editorList(listKey) {
    return Array.isArray(this._config[listKey]) ? this._config[listKey] : [];
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

  _listSection(title, hint, listKey, domains) {
    const rows = this._editorList(listKey);
    const total = rows.length;
    const moveUp = this._editorLabel("ed.notifications.move_up");
    const moveDown = this._editorLabel("ed.notifications.move_down");
    return `<section class="editor-section editor-section--nested"><div class="editor-section__header">
      <div><div class="editor-section__title">${escapeHtml(this._editorLabel(title))}</div>
      <div class="editor-section__hint">${escapeHtml(this._editorLabel(hint))}</div></div>
      <button type="button" data-act="add" data-list="${escapeHtml(listKey)}">${escapeHtml(this._editorLabel("ed.room_summary.add_entity"))}</button></div>
      ${rows.length ? rows.map((id, i) => `<div class="item-card"><div class="item-card__header">
        <span class="item-card__title">${escapeHtml(this._entityLabel(id))}</span>
        <div class="item-card__actions">
          <button type="button" data-act="move-up" data-list="${escapeHtml(listKey)}" data-index="${i}" ${i === 0 ? "disabled" : ""} title="${escapeHtml(moveUp)}">↑</button>
          <button type="button" data-act="move-down" data-list="${escapeHtml(listKey)}" data-index="${i}" ${i >= total - 1 ? "disabled" : ""} title="${escapeHtml(moveDown)}">↓</button>
          <button type="button" class="danger" data-act="remove" data-list="${escapeHtml(listKey)}" data-index="${i}">${escapeHtml(this._editorLabel("ed.room_summary.remove_entity"))}</button>
        </div></div>
        ${this._entity("ed.room_summary.entity", `${listKey}.${i}`, id, domains)}</div>`).join("") : `<div class="empty">${escapeHtml(this._editorLabel("ed.room_summary.list_empty"))}</div>`}
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
        ${this._select("ed.room_summary.layout", "layout", c.layout, [
          { v: "compact", l: "ed.room_summary.layout_compact" }, { v: "standard", l: "ed.room_summary.layout_standard" },
          { v: "detailed", l: "ed.room_summary.layout_detailed" }, { v: "security", l: "ed.room_summary.layout_security" },
          { v: "climate", l: "ed.room_summary.layout_climate" },
        ])}
        ${this._select("ed.entity.density", "density", c.density, [
          { v: "comfortable", l: "ed.entity.density_comfortable" },
          { v: "compact", l: "ed.entity.density_compact" },
        ])}
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
        ${this._entity("ed.room_summary.media_player_entity", "media_player", c.media_player, ["media_player"])}
        ${this._entity("ed.room_summary.power_entity", "power", c.power, ["sensor"])}
        ${this._entity("ed.room_summary.air_quality_entity", "air_quality", c.air_quality, ["sensor"])}
      </div>
      ${this._listSection("ed.room_summary.lights_section_title", "ed.room_summary.lights_section_hint", "lights", ["light"])}
      ${this._listSection("ed.room_summary.covers_section_title", "ed.room_summary.covers_section_hint", "covers", ["cover"])}
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
    </div>`;
    this._detachEditorShadowListeners();
    this._attachEditorShadowListeners();
    this.shadowRoot.querySelectorAll('[data-mounted-control="entity"]').forEach(host => this._mountEntityPicker(host));
    this.shadowRoot.querySelectorAll('[data-mounted-control="icon-picker"]').forEach(host => this._mountIconPicker(host));
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
    LAYOUT_MODES,
    normalizeConfig,
    normalizeEntityField,
    buildRoomSummary,
    hasRoomContent,
    formatMetric,
    getState,
  };
}

function getByPath(target, path) {
  const parts = String(path || "").split(".");
  let cursor = target;
  for (const key of parts) {
    if (!key || (!isObject(cursor) && !Array.isArray(cursor))) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

function setByPath(target, path, value) {
  const parts = String(path || "").split(".");
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!isObject(cursor[key]) && !Array.isArray(cursor[key])) cursor[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}
