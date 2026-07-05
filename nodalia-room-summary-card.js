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
      size: "44px",
      background: "color-mix(in srgb, var(--primary-color) 16%, transparent)",
      color: "var(--primary-color)",
    },
    title_size: "15px",
    metric_size: "13px",
    chip_border_radius: "999px",
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
    const compact = layout === "compact";
    const security = layout === "security";
    const climateLayout = layout === "climate";

    const hero = image && !compact ? `
      <div class="room-summary-card__hero" style="background-image:url('${escapeHtml(image)}')">
        <div class="room-summary-card__hero-overlay"></div>
      </div>` : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; --room-summary-duration:${config.animations?.enabled ? config.animations.content_duration : 0}ms; }
        * { box-sizing:border-box; }
        ha-card { background:${styles.card.background}; border:${styles.card.border}; border-radius:${styles.card.border_radius}; box-shadow:${styles.card.box_shadow}; overflow:hidden; color:var(--primary-text-color); }
        .room-summary-card__content { display:grid; gap:${styles.card.gap}; padding:${styles.card.padding}; position:relative; }
        .room-summary-card__content--enter { animation:room-rise calc(var(--room-summary-duration)*0.9) cubic-bezier(.22,.84,.26,1) both; }
        .room-summary-card__hero { background:center/cover no-repeat; border-radius:18px; height:88px; overflow:hidden; position:relative; }
        .room-summary-card__hero-overlay { background:linear-gradient(180deg, transparent, color-mix(in srgb, var(--ha-card-background) 88%, black)); inset:0; position:absolute; }
        .room-summary-card__header { align-items:center; display:grid; gap:12px; grid-template-columns:auto minmax(0,1fr) auto; }
        .room-summary-card__icon { align-items:center; background:${styles.icon.background}; border-radius:16px; color:${styles.icon.color}; display:inline-flex; height:${styles.icon.size}; justify-content:center; width:${styles.icon.size}; }
        .room-summary-card__icon ha-icon { --mdc-icon-size:calc(${styles.icon.size} * 0.52); }
        .room-summary-card__title { font-size:${styles.title_size}; font-weight:700; line-height:1.2; overflow-wrap:anywhere; }
        .room-summary-card__metrics { display:grid; gap:8px; grid-template-columns:repeat(${compact ? Math.min(metrics.length || 1, 2) : Math.min(metrics.length || 1, 3)}, minmax(0,1fr)); }
        .room-summary-card__metric { background:color-mix(in srgb, var(--primary-text-color) 4%, transparent); border:1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent); border-radius:16px; display:grid; gap:4px; min-height:${climateLayout ? "72px" : "64px"}; padding:10px 12px; }
        .room-summary-card__metric-label { align-items:center; color:var(--secondary-text-color); display:inline-flex; font-size:11px; gap:6px; }
        .room-summary-card__metric-value { font-size:${climateLayout ? "16px" : styles.metric_size}; font-weight:700; line-height:1.2; overflow-wrap:anywhere; }
        .room-summary-card__chips, .room-summary-card__actions { display:flex; flex-wrap:wrap; gap:8px; }
        .room-summary-card__chip, .room-summary-card__action { align-items:center; border-radius:${chipRadius}; display:inline-flex; font-size:11px; font-weight:600; gap:6px; line-height:1; padding:7px 10px; }
        .room-summary-card__chip--active, .room-summary-card__action { background:color-mix(in srgb, var(--primary-color) 16%, transparent); color:var(--primary-color); border:0; cursor:pointer; }
        .room-summary-card__chip--warn { background:color-mix(in srgb, var(--warning-color,#f59e0b) 16%, transparent); color:var(--warning-color,#f59e0b); }
        .room-summary-card__chip--muted { background:color-mix(in srgb, var(--primary-text-color) 6%, transparent); color:var(--secondary-text-color); }
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
    this._config = normalizeConfig({});
    this._hass = null;
    this._onInput = this._onInput.bind(this);
    this._onClick = this._onClick.bind(this);
  }

  setConfig(config) { this._config = normalizeConfig(config || {}); this._render(); }
  set hass(hass) {
    this._hass = hass;
    this.shadowRoot?.querySelectorAll("[data-mount='entity']").forEach(h => this._mountPicker(h));
  }

  _label(k) { return window.NodaliaEditorUi?.label?.(k) ?? k; }

  _emit() {
    const next = normalizeConfig(this._config);
    this._config = next;
    this._render();
    fireEvent(this, "config-changed", { config: stripEqualToDefaults(next) || {} });
  }

  _onInput(e) {
    const input = e.composedPath().find(n => n instanceof HTMLInputElement || n instanceof HTMLSelectElement || n instanceof HTMLTextAreaElement);
    if (!input?.dataset?.field) return;
    e.stopPropagation();
    setByPath(this._config, input.dataset.field, input.type === "checkbox" ? input.checked : input.value);
    if (e.type === "change") this._emit();
  }

  _onClick(e) {
    const btn = e.composedPath().find(n => n instanceof HTMLElement && n.dataset?.act);
    if (!btn) return;
    e.preventDefault();
    const list = btn.dataset.list;
    const idx = Number(btn.dataset.index);
    if (btn.dataset.act === "add" && list) {
      if (!Array.isArray(this._config[list])) this._config[list] = [];
      this._config[list].push("");
      this._emit();
    }
    if (btn.dataset.act === "remove" && list && Number.isInteger(idx)) {
      this._config[list].splice(idx, 1);
      this._emit();
    }
  }

  _field(label, field, value, opts = {}) {
    return `<label class="f ${opts.full ? "f--full" : ""}"><span>${escapeHtml(this._label(label))}</span>
      <input data-field="${escapeHtml(field)}" value="${escapeHtml(value ?? "")}" placeholder="${escapeHtml(opts.ph ? this._label(opts.ph) : "")}" /></label>`;
  }

  _check(label, field, checked) {
    return `<label class="f"><input type="checkbox" data-field="${escapeHtml(field)}" ${checked ? "checked" : ""} /><span>${escapeHtml(this._label(label))}</span></label>`;
  }

  _select(label, field, value, options) {
    return `<label class="f"><span>${escapeHtml(this._label(label))}</span><select data-field="${escapeHtml(field)}">
      ${options.map(o => `<option value="${escapeHtml(o.v)}" ${String(value) === o.v ? "selected" : ""}>${escapeHtml(this._label(o.l))}</option>`).join("")}
    </select></label>`;
  }

  _entity(label, field, value, domains = []) {
    return `<label class="f f--full"><span>${escapeHtml(this._label(label))}</span>
      <div data-mount="entity" data-field="${escapeHtml(field)}" data-domains="${escapeHtml(domains.join(","))}"></div></label>`;
  }

  _listSection(title, hint, listKey, domains) {
    const rows = this._config[listKey] || [];
    return `<section class="sec"><div class="sec__head"><div><div class="sec__title">${escapeHtml(this._label(title))}</div><div class="sec__hint">${escapeHtml(this._label(hint))}</div></div>
      <button type="button" data-act="add" data-list="${escapeHtml(listKey)}">${escapeHtml(this._label("ed.room_summary.add_entity"))}</button></div>
      ${rows.length ? rows.map((id, i) => `<div class="sec"><div class="sec__head"><span>${i + 1}</span><button type="button" data-act="remove" data-list="${escapeHtml(listKey)}" data-index="${i}">${escapeHtml(this._label("ed.room_summary.remove_entity"))}</button></div>
        ${this._entity("ed.room_summary.entity", `${listKey}.${i}`, id, domains)}</div>`).join("") : `<div class="empty">${escapeHtml(this._label("ed.room_summary.list_empty"))}</div>`}
    </section>`;
  }

  _mountPicker(host) {
    if (!(host instanceof HTMLElement)) return;
    const field = host.dataset.field || "";
    const domains = String(host.dataset.domains || "").split(",").filter(Boolean);
    const picker = document.createElement("ha-entity-picker");
    picker.hass = this._hass;
    picker.value = getByPath(this._config, field) || "";
    if (domains.length) picker.includeDomains = domains;
    picker.allowCustomEntity = true;
    picker.addEventListener("value-changed", ev => { setByPath(this._config, field, ev.detail?.value || ""); this._emit(); });
    host.replaceChildren(picker);
  }

  _render() {
    const c = normalizeConfig(this._config || {});
    this.shadowRoot.innerHTML = `<style>
      :host{display:block}.editor{display:grid;gap:14px}.sec{background:color-mix(in srgb,var(--primary-text-color) 2%,transparent);border:1px solid color-mix(in srgb,var(--primary-text-color) 7%,transparent);border-radius:16px;display:grid;gap:10px;padding:14px}
      .sec__title{font-size:14px;font-weight:700}.sec__hint{font-size:12px;color:var(--secondary-text-color)}.sec__head{display:flex;justify-content:space-between;gap:10px;align-items:start}
      .grid{display:grid;gap:10px;grid-template-columns:repeat(2,minmax(0,1fr))}.f{display:grid;gap:6px;font-size:12px;font-weight:600}.f--full{grid-column:1/-1}
      .f input,.f select{width:100%;min-height:40px;border-radius:12px;border:1px solid color-mix(in srgb,var(--primary-text-color) 8%,transparent);padding:10px 12px;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent);color:var(--primary-text-color);font:inherit}
      .empty{color:var(--secondary-text-color);font-size:12px}@media(max-width:640px){.grid{grid-template-columns:1fr}}
    </style><div class="editor">
      <section class="sec"><div class="sec__title">${escapeHtml(this._label("ed.room_summary.general_section_title"))}</div><div class="grid">
        ${this._field("ed.room_summary.name", "name", c.name, { ph: "ed.room_summary.name_placeholder", full: true })}
        ${this._field("ed.room_summary.icon", "icon", c.icon)}
        ${this._select("ed.room_summary.layout", "layout", c.layout, [
          { v: "compact", l: "ed.room_summary.layout_compact" }, { v: "standard", l: "ed.room_summary.layout_standard" },
          { v: "detailed", l: "ed.room_summary.layout_detailed" }, { v: "security", l: "ed.room_summary.layout_security" },
          { v: "climate", l: "ed.room_summary.layout_climate" },
        ])}
        ${this._field("ed.room_summary.image", "image", c.image, { full: true })}
      </div></section>
      <section class="sec"><div class="sec__title">${escapeHtml(this._label("ed.room_summary.entities_section_title"))}</div><div class="grid">
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
      <section class="sec"><div class="sec__title">${escapeHtml(this._label("ed.room_summary.display_section_title"))}</div><div class="grid">
        ${this._check("ed.room_summary.show_temperature", "show_temperature", c.show_temperature)}
        ${this._check("ed.room_summary.show_humidity", "show_humidity", c.show_humidity)}
        ${this._check("ed.room_summary.show_presence", "show_presence", c.show_presence)}
        ${this._check("ed.room_summary.show_climate", "show_climate", c.show_climate)}
        ${this._check("ed.room_summary.show_lights", "show_lights", c.show_lights)}
        ${this._check("ed.room_summary.show_covers", "show_covers", c.show_covers)}
        ${this._check("ed.room_summary.show_quick_actions", "show_quick_actions", c.show_quick_actions)}
      </div></section>
    </div>`;
    this.shadowRoot.removeEventListener("input", this._onInput);
    this.shadowRoot.removeEventListener("change", this._onInput);
    this.shadowRoot.removeEventListener("click", this._onClick);
    this.shadowRoot.addEventListener("input", this._onInput);
    this.shadowRoot.addEventListener("change", this._onInput);
    this.shadowRoot.addEventListener("click", this._onClick);
    this.shadowRoot.querySelectorAll("[data-mount='entity']").forEach(h => this._mountPicker(h));
  }
}

if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, NodaliaRoomSummaryCardEditor);

(function registerRoomSummaryCard() {
  const lang = window.NodaliaI18n?.resolveLanguage?.(null, "auto") ?? "en";
  const pack = window.NodaliaI18n?.strings?.(lang)?.roomSummaryCard || window.NodaliaI18n?.strings?.("en")?.roomSummaryCard || {};
  window.NodaliaUtils?.registerCustomCard?.({
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
