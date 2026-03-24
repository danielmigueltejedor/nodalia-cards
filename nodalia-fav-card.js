const CARD_TAG = "nodalia-fav-card";
const EDITOR_TAG = "nodalia-fav-card-editor";
const CARD_VERSION = "0.8.0";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
const MINI_LAYOUT_THRESHOLD = 126;
const INLINE_LAYOUT_THRESHOLD = 340;
const FEATURE_ARM_HOME = 1;
const FEATURE_ARM_AWAY = 2;
const FEATURE_ARM_NIGHT = 4;
const FEATURE_ARM_CUSTOM_BYPASS = 16;
const FEATURE_ARM_VACATION = 32;

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  use_entity_icon: false,
  entity_mode: "auto",
  tap_action: "auto",
  tap_service: "",
  tap_service_data: "",
  tap_url: "",
  tap_new_tab: false,
  alarm_code: "",
  alarm_code_entity: "",
  alarm_show_code_input: true,
  alarm_show_disarm: true,
  alarm_show_arm_home: true,
  alarm_show_arm_away: true,
  alarm_show_arm_night: true,
  alarm_show_arm_vacation: false,
  alarm_show_custom_bypass: false,
  show_name: true,
  show_state: true,
  state_attribute: "",
  layout_mode: "auto",
  haptics: {
    enabled: false,
    style: "selection",
    fallback_vibrate: false,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid rgba(255, 255, 255, 0.06)",
      border_radius: "26px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "10px 12px",
      gap: "10px",
    },
    icon: {
      size: "52px",
      background: "rgba(255, 255, 255, 0.05)",
      on_color: "var(--info-color, #71c0ff)",
      off_color: "var(--state-inactive-color, rgba(255, 255, 255, 0.55))",
    },
    chip_height: "22px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    title_size: "13px",
  },
};

const STUB_CONFIG = {
  entity: "light.sofa",
  name: "Sofa",
  tap_action: "auto",
  show_state: false,
  layout_mode: "auto",
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
}

function mergeConfig(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override.map(item => deepClone(item)) : deepClone(base);
  }

  if (!isObject(base)) {
    return override === undefined ? base : override;
  }

  const result = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(override || {})]);

  keys.forEach(key => {
    const baseValue = base[key];
    const overrideValue = override ? override[key] : undefined;

    if (overrideValue === undefined) {
      result[key] = deepClone(baseValue);
      return;
    }

    if (Array.isArray(overrideValue)) {
      result[key] = deepClone(overrideValue);
      return;
    }

    if (isObject(baseValue) && isObject(overrideValue)) {
      result[key] = mergeConfig(baseValue, overrideValue);
      return;
    }

    result[key] = overrideValue;
  });

  return result;
}

function compactConfig(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => compactConfig(item))
      .filter(item => item !== undefined);
  }

  if (isObject(value)) {
    const compacted = {};

    Object.entries(value).forEach(([key, item]) => {
      const cleaned = compactConfig(item);
      const isEmptyObject = isObject(cleaned) && Object.keys(cleaned).length === 0;

      if (cleaned !== undefined && !isEmptyObject) {
        compacted[key] = cleaned;
      }
    });

    return compacted;
  }

  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  return value;
}

function setByPath(target, path, value) {
  const parts = path.split(".");
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

function deleteByPath(target, path) {
  const parts = path.split(".");
  let cursor = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isObject(cursor[key]) && !Array.isArray(cursor[key])) {
      return;
    }
    cursor = cursor[key];
  }

  delete cursor[parts[parts.length - 1]];
}

function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function miredToKelvin(mired) {
  const numeric = Number(mired);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.round(1000000 / numeric);
}

function normalizeTextKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

function getEntityDomain(state) {
  const entityId = String(state?.entity_id || "");
  return entityId.includes(".") ? entityId.split(".")[0] : "";
}

function getDynamicEntityIcon(state) {
  if (!state) {
    return "";
  }

  const domain = getEntityDomain(state);
  const stateKey = normalizeTextKey(state.state);
  const deviceClass = normalizeTextKey(state.attributes?.device_class);

  if (domain === "binary_sensor") {
    switch (deviceClass) {
      case "door":
      case "opening":
        return stateKey === "on" ? "mdi:door-open" : "mdi:door-closed";
      case "garage_door":
        return stateKey === "on" ? "mdi:garage-open" : "mdi:garage";
      case "window":
        return stateKey === "on" ? "mdi:window-open-variant" : "mdi:window-closed-variant";
      case "motion":
        return stateKey === "on" ? "mdi:motion-sensor" : "mdi:motion-sensor-off";
      case "occupancy":
      case "presence":
      case "person":
        return stateKey === "on" ? "mdi:account" : "mdi:account-off-outline";
      case "smoke":
        return stateKey === "on" ? "mdi:smoke-detector-alert" : "mdi:smoke-detector-variant";
      case "moisture":
        return stateKey === "on" ? "mdi:water-alert" : "mdi:water-check";
      case "gas":
        return stateKey === "on" ? "mdi:gas-cylinder" : "mdi:check-circle-outline";
      case "tamper":
      case "safety":
      case "problem":
        return stateKey === "on" ? "mdi:alert-circle" : "mdi:check-circle-outline";
      case "plug":
      case "power":
        return stateKey === "on" ? "mdi:power-plug" : "mdi:power-plug-off";
      case "sound":
        return stateKey === "on" ? "mdi:volume-high" : "mdi:volume-mute";
      case "vibration":
        return stateKey === "on" ? "mdi:vibrate" : "mdi:vibrate-off";
      case "heat":
        return stateKey === "on" ? "mdi:fire" : "mdi:fire-off";
      case "cold":
        return stateKey === "on" ? "mdi:snowflake-alert" : "mdi:snowflake";
      case "light":
        return stateKey === "on" ? "mdi:brightness-7" : "mdi:brightness-5";
      default:
        break;
    }
  }

  if (domain === "light") {
    return stateKey === "on" ? "mdi:lightbulb" : "mdi:lightbulb-off";
  }

  if (domain === "switch") {
    return stateKey === "on" ? "mdi:toggle-switch-variant" : "mdi:toggle-switch-variant-off";
  }

  if (domain === "fan") {
    return stateKey === "on" ? "mdi:fan" : "mdi:fan-off";
  }

  if (domain === "lock") {
    switch (stateKey) {
      case "unlocked":
      case "open":
        return "mdi:lock-open-variant";
      case "jammed":
        return "mdi:lock-alert";
      case "locking":
      case "unlocking":
        return "mdi:lock-clock";
      default:
        return "mdi:lock";
    }
  }

  if (domain === "cover") {
    if (deviceClass === "garage") {
      return stateKey === "open" ? "mdi:garage-open" : "mdi:garage";
    }

    if (deviceClass === "door") {
      return stateKey === "open" ? "mdi:door-open" : "mdi:door-closed";
    }

    if (deviceClass === "window") {
      return stateKey === "open" ? "mdi:window-open-variant" : "mdi:window-closed-variant";
    }
  }

  if (domain === "person") {
    switch (stateKey) {
      case "home":
      case "casa":
      case "en_casa":
        return "mdi:home-account";
      case "not_home":
      case "away":
      case "fuera":
        return "mdi:account-arrow-right";
      default:
        return "mdi:account";
    }
  }

  if (domain === "camera") {
    return "mdi:video";
  }

  if (domain === "climate") {
    if (stateKey === "off") {
      return "mdi:thermostat-off";
    }
    return "mdi:thermostat";
  }

  if (domain === "media_player") {
    if (["off", "idle", "standby"].includes(stateKey)) {
      return "mdi:speaker-off";
    }
    return "mdi:speaker";
  }

  if (domain === "humidifier") {
    return stateKey === "on" ? "mdi:air-humidifier" : "mdi:air-humidifier-off";
  }

  if (domain === "vacuum") {
    return "mdi:robot-vacuum";
  }

  if (domain === "alarm_control_panel") {
    switch (stateKey) {
      case "disarmed":
        return "mdi:shield-off-outline";
      case "armed_home":
        return "mdi:home-lock";
      case "armed_away":
        return "mdi:shield-lock";
      case "armed_night":
        return "mdi:weather-night";
      case "armed_vacation":
        return "mdi:palm-tree";
      case "armed_custom_bypass":
        return "mdi:tune-variant";
      case "triggered":
        return "mdi:alarm-light";
      default:
        return "mdi:shield-outline";
    }
  }

  if (domain === "automation") {
    return stateKey === "on" ? "mdi:robot" : "mdi:robot-off";
  }

  if (domain === "script") {
    return "mdi:script-text-outline";
  }

  if (domain === "scene") {
    return "mdi:palette-outline";
  }

  if (domain === "input_boolean") {
    return stateKey === "on" ? "mdi:check-circle" : "mdi:circle-off-outline";
  }

  if (domain === "sensor") {
    switch (deviceClass) {
      case "temperature":
        return "mdi:thermometer";
      case "humidity":
        return "mdi:water-percent";
      case "power":
        return "mdi:flash";
      case "current":
        return "mdi:current-ac";
      case "voltage":
        return "mdi:sine-wave";
      case "energy":
        return "mdi:lightning-bolt";
      case "battery":
        return "mdi:battery";
      case "signal_strength":
        return "mdi:wifi";
      case "pressure":
        return "mdi:gauge";
      case "illuminance":
        return "mdi:brightness-6";
      case "moisture":
        return "mdi:water";
      case "aqi":
        return "mdi:air-filter";
      case "speed":
        return "mdi:speedometer";
      case "distance":
        return "mdi:map-marker-distance";
      case "gas":
        return "mdi:meter-gas";
      case "water":
        return "mdi:water";
      default:
        return "";
    }
  }

  return "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeSelectorValue(value) {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function fireEvent(node, type, detail, options) {
  const event = new CustomEvent(type, {
    bubbles: options?.bubbles ?? true,
    cancelable: Boolean(options?.cancelable),
    composed: options?.composed ?? true,
    detail,
  });
  node.dispatchEvent(event);
  return event;
}

function normalizeConfig(rawConfig) {
  return mergeConfig(DEFAULT_CONFIG, rawConfig || {});
}

class NodaliaFavCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig() {
    return deepClone(STUB_CONFIG);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._cardWidth = 0;
    this._layout = "inline";
    this._alarmMenuOpen = false;
    this._alarmCodeInput = "";
    this._ignoreNextPrimaryClickUntil = 0;
    this._resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextWidth = Math.round(entry.contentRect?.width || this.clientWidth || 0);
      const nextLayout = this._getResolvedLayout(nextWidth);

      if (nextWidth === this._cardWidth && nextLayout === this._layout) {
        return;
      }

      this._cardWidth = nextWidth;
      this._layout = nextLayout;
      this._render();
    });
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowPointerUp = this._onShadowPointerUp.bind(this);
    this._onShadowTouchEnd = this._onShadowTouchEnd.bind(this);
    this._onShadowInput = this._onShadowInput.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("pointerup", this._onShadowPointerUp);
    this.shadowRoot.addEventListener("touchend", this._onShadowTouchEnd, { passive: false });
    this.shadowRoot.addEventListener("input", this._onShadowInput);
  }

  connectedCallback() {
    this._resizeObserver?.observe(this);
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._layout = this._getResolvedLayout(Math.round(this._cardWidth || this.clientWidth || 0));
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return this._alarmMenuOpen && this._isAlarmPanelMode(this._getState()) ? 4 : 1;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: 2,
      min_rows: 1,
      min_columns: 1,
    };
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) ? numericColumns : null;
  }

  _getConfiguredGridRows() {
    const numericRows = Number(this._config?.grid_options?.rows);
    return Number.isFinite(numericRows) ? numericRows : null;
  }

  _getResolvedLayout(width) {
    const mode = this._config?.layout_mode || "auto";

    if (mode === "mini") {
      return "mini";
    }

    if (mode === "inline") {
      return "inline";
    }

    const columns = this._getConfiguredGridColumns();
    const rows = this._getConfiguredGridRows();

    if (columns !== null) {
      if (columns <= 2) {
        return "mini";
      }

      if (columns <= 6 || rows === 1) {
        return "inline";
      }
    }

    if (width > 0 && width <= MINI_LAYOUT_THRESHOLD) {
      return "mini";
    }

    if (width > 0 && width <= INLINE_LAYOUT_THRESHOLD) {
      return "inline";
    }

    return "inline";
  }

  _getState() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _getDomain(entityId = this._config?.entity) {
    return String(entityId || "").split(".")[0] || "";
  }

  _isAlarmPanelMode(state = this._getState()) {
    const mode = normalizeTextKey(this._config?.entity_mode || "auto");

    if (mode === "alarm_control_panel") {
      return true;
    }

    if (mode === "standard") {
      return false;
    }

    return this._getDomain(state?.entity_id || this._config?.entity) === "alarm_control_panel";
  }

  _isBinaryOnOff(state) {
    const stateKey = normalizeTextKey(state?.state);
    return stateKey === "on" || stateKey === "off";
  }

  _isActiveState(state) {
    const stateKey = normalizeTextKey(state?.state);

    if (!stateKey || ["off", "closed", "locked", "unavailable", "unknown", "none", "idle", "standby", "disarmed"].includes(stateKey)) {
      return false;
    }

    return true;
  }

  _isDomainOn(state) {
    const stateKey = normalizeTextKey(state?.state);
    const domain = this._getDomain();

    switch (domain) {
      case "light":
      case "fan":
      case "humidifier":
        return stateKey === "on";
      default:
        return this._isActiveState(state);
    }
  }

  _usesCustomOnColor() {
    const configuredColor = this._config?.styles?.icon?.on_color;
    return Boolean(configuredColor) && configuredColor !== DEFAULT_CONFIG.styles.icon.on_color;
  }

  _usesCustomOffColor() {
    const configuredColor = this._config?.styles?.icon?.off_color;
    return Boolean(configuredColor) && configuredColor !== DEFAULT_CONFIG.styles.icon.off_color;
  }

  _getLightAccentColor(state) {
    const rgbColor = Array.isArray(state?.attributes?.rgb_color) ? state.attributes.rgb_color : null;
    if (this._isActiveState(state) && rgbColor?.length === 3) {
      return `rgb(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]})`;
    }

    if (this._isActiveState(state)) {
      const kelvin = typeof state?.attributes?.color_temp_kelvin === "number"
        ? Math.round(state.attributes.color_temp_kelvin)
        : (typeof state?.attributes?.color_temp === "number" ? miredToKelvin(state.attributes.color_temp) : 0);

      if (kelvin >= 5200) {
        return "#8fd3ff";
      }

      if (kelvin > 0 && kelvin <= 3000) {
        return "#f4b55f";
      }

      if (kelvin > 0) {
        return "#ffe29a";
      }
    }

    return "var(--warning-color, #f6b73c)";
  }

  _getDomainDefaultOnColor(state) {
    switch (this._getDomain()) {
      case "light":
        return this._getLightAccentColor(state);
      case "fan":
        return "var(--info-color, #71c0ff)";
      case "humidifier":
        return "var(--info-color, #71c0ff)";
      case "alarm_control_panel":
        return this._getAlarmAccentColor(state);
      case "switch":
        return "var(--primary-color)";
      case "media_player":
        return "var(--info-color, #71c0ff)";
      case "vacuum":
        return "#82d18a";
      default:
        return DEFAULT_CONFIG.styles.icon.on_color;
    }
  }

  _getAccentColor(state) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    if (!this._isDomainOn(state)) {
      return this._usesCustomOffColor()
        ? styles?.icon?.off_color || DEFAULT_CONFIG.styles.icon.off_color
        : "var(--state-inactive-color, rgba(255, 255, 255, 0.5))";
    }

    if (this._usesCustomOnColor()) {
      return styles?.icon?.on_color || DEFAULT_CONFIG.styles.icon.on_color;
    }

    return this._getDomainDefaultOnColor(state);
  }

  _getAlarmAccentColor(state) {
    const key = normalizeTextKey(state?.state);

    switch (key) {
      case "armed_home":
        return "#74c0ff";
      case "armed_away":
        return "#8aa7ff";
      case "armed_night":
        return "#9488ff";
      case "armed_vacation":
        return "#5fd7cf";
      case "armed_custom_bypass":
        return "#64d4a6";
      case "arming":
        return "#71c0ff";
      case "pending":
        return "#f2c46d";
      case "triggered":
        return "#ff7474";
      default:
        return "var(--info-color, #71c0ff)";
    }
  }

  _translateStateValue(state) {
    if (!state) {
      return null;
    }

    const rawState = String(state.state ?? "").trim();
    const unit = String(state.attributes?.unit_of_measurement || "").trim();
    const key = normalizeTextKey(rawState);

    if (rawState && unit && /^-?\d+([.,]\d+)?$/.test(rawState)) {
      return `${rawState} ${unit}`;
    }

    switch (key) {
      case "on":
        return "Encendido";
      case "off":
        return "Apagado";
      case "open":
        return "Abierto";
      case "closed":
        return "Cerrado";
      case "playing":
        return "Reproduciendo";
      case "paused":
        return "En pausa";
      case "idle":
        return "En espera";
      case "standby":
        return "Standby";
      case "home":
        return "En casa";
      case "not_home":
        return "Fuera";
      case "disarmed":
        return "Desarmada";
      case "armed_home":
        return "En casa";
      case "armed_away":
        return "Ausente";
      case "armed_night":
        return "Noche";
      case "armed_vacation":
        return "Vacaciones";
      case "armed_custom_bypass":
        return "Personalizada";
      case "arming":
        return "Armando";
      case "disarming":
        return "Desarmando";
      case "pending":
        return "Retardo";
      case "triggered":
        return "Disparada";
      case "detected":
        return "Detectado";
      case "clear":
        return "Libre";
      case "locked":
        return "Bloqueado";
      case "unlocked":
        return "Desbloqueado";
      case "unavailable":
        return "No disponible";
      case "unknown":
        return "Desconocido";
      default:
        return rawState || null;
    }
  }

  _formatAttributeValue(state, attributeName) {
    if (!state || !attributeName) {
      return null;
    }

    const value = state.attributes?.[attributeName];
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const key = normalizeTextKey(attributeName);

    if (typeof value === "boolean") {
      return value ? "Si" : "No";
    }

    if (typeof value === "number") {
      if (["battery", "battery_level", "humidity", "current_humidity"].includes(key)) {
        return `${Math.round(value)}%`;
      }

      if (key === "brightness") {
        return `${Math.round((value / 255) * 100)}%`;
      }

      if (key === "volume_level") {
        return `${Math.round(value * 100)}%`;
      }
    }

    return String(value);
  }

  _getTitle(state) {
    return this._config?.name || state?.attributes?.friendly_name || this._config?.entity || "Favorito";
  }

  _getIcon(state) {
    if (this._config?.use_entity_icon === true) {
      const resolvedEntityIcon = state?.attributes?.icon || getDynamicEntityIcon(state);
      if (resolvedEntityIcon) {
        return resolvedEntityIcon;
      }
    }

    return this._config?.icon || state?.attributes?.icon || "mdi:star-four-points";
  }

  _canRunTapAction(state) {
    if (this._isAlarmPanelMode(state)) {
      return Boolean(this._config?.entity);
    }

    const tapAction = this._config?.tap_action || "auto";

    if (tapAction === "none") {
      return false;
    }

    if (tapAction === "service") {
      return Boolean(this._config?.tap_service);
    }

    if (tapAction === "url") {
      return Boolean(this._config?.tap_url);
    }

    if (tapAction === "toggle") {
      return this._isBinaryOnOff(state);
    }

    if (tapAction === "more-info") {
      return Boolean(this._config?.entity);
    }

    return Boolean(this._config?.entity);
  }

  _getAlarmSupportedFeatures(state) {
    const value = Number(state?.attributes?.supported_features);
    return Number.isFinite(value) ? value : 0;
  }

  _supportsAlarmMode(state, mode) {
    const features = this._getAlarmSupportedFeatures(state);

    if (!features) {
      return true;
    }

    switch (mode) {
      case "home":
        return Boolean(features & FEATURE_ARM_HOME);
      case "away":
        return Boolean(features & FEATURE_ARM_AWAY);
      case "night":
        return Boolean(features & FEATURE_ARM_NIGHT);
      case "vacation":
        return Boolean(features & FEATURE_ARM_VACATION);
      case "custom_bypass":
        return Boolean(features & FEATURE_ARM_CUSTOM_BYPASS);
      default:
        return true;
    }
  }

  _getAlarmStateCandidates(state) {
    return [
      state?.state,
      state?.attributes?.next_state,
      state?.attributes?.post_pending_state,
      state?.attributes?.post_delay_state,
      state?.attributes?.arm_mode,
      state?.attributes?.arming_mode,
    ]
      .map(value => normalizeTextKey(value))
      .filter(Boolean);
  }

  _matchesAlarmMode(state, ...keys) {
    const candidates = this._getAlarmStateCandidates(state);
    return keys.some(key => candidates.includes(normalizeTextKey(key)));
  }

  _getAlarmModeDefinitions(state) {
    const modes = [
      {
        key: "disarm",
        label: "Desarmar",
        icon: "mdi:shield-off-outline",
        service: "alarm_disarm",
        enabled: this._config?.alarm_show_disarm !== false && !this._matchesAlarmMode(state, "disarmed"),
      },
      {
        key: "home",
        label: "Casa",
        icon: "mdi:home-lock",
        service: "alarm_arm_home",
        enabled: this._config?.alarm_show_arm_home !== false
          && this._supportsAlarmMode(state, "home")
          && !this._matchesAlarmMode(state, "armed_home"),
      },
      {
        key: "away",
        label: "Ausente",
        icon: "mdi:shield-lock",
        service: "alarm_arm_away",
        enabled: this._config?.alarm_show_arm_away !== false
          && this._supportsAlarmMode(state, "away")
          && !this._matchesAlarmMode(state, "armed_away"),
      },
      {
        key: "night",
        label: "Noche",
        icon: "mdi:weather-night",
        service: "alarm_arm_night",
        enabled: this._config?.alarm_show_arm_night !== false
          && this._supportsAlarmMode(state, "night")
          && !this._matchesAlarmMode(state, "armed_night"),
      },
      {
        key: "vacation",
        label: "Vacaciones",
        icon: "mdi:palm-tree",
        service: "alarm_arm_vacation",
        enabled: this._config?.alarm_show_arm_vacation === true
          && this._supportsAlarmMode(state, "vacation")
          && !this._matchesAlarmMode(state, "armed_vacation"),
      },
      {
        key: "custom_bypass",
        label: "Personalizada",
        icon: "mdi:tune-variant",
        service: "alarm_arm_custom_bypass",
        enabled: this._config?.alarm_show_custom_bypass === true
          && this._supportsAlarmMode(state, "custom_bypass")
          && !this._matchesAlarmMode(state, "armed_custom_bypass"),
      },
    ];

    return modes.filter(mode => mode.enabled);
  }

  _getAlarmRenderedModes(state) {
    const detectedModes = this._getAlarmModeDefinitions(state);
    if (detectedModes.length) {
      return detectedModes;
    }

    const fallbackModes = [
      {
        key: "disarm",
        label: "Desarmar",
        icon: "mdi:shield-off-outline",
        service: "alarm_disarm",
        enabled: this._config?.alarm_show_disarm !== false && !this._matchesAlarmMode(state, "disarmed"),
      },
      {
        key: "home",
        label: "Casa",
        icon: "mdi:home-lock",
        service: "alarm_arm_home",
        enabled: this._config?.alarm_show_arm_home !== false && !this._matchesAlarmMode(state, "armed_home"),
      },
      {
        key: "away",
        label: "Ausente",
        icon: "mdi:shield-lock",
        service: "alarm_arm_away",
        enabled: this._config?.alarm_show_arm_away !== false && !this._matchesAlarmMode(state, "armed_away"),
      },
      {
        key: "night",
        label: "Noche",
        icon: "mdi:weather-night",
        service: "alarm_arm_night",
        enabled: this._config?.alarm_show_arm_night !== false && !this._matchesAlarmMode(state, "armed_night"),
      },
    ];

    return fallbackModes.filter(mode => mode.enabled);
  }

  _shouldShowAlarmCodeInput(state) {
    if (this._config?.alarm_show_code_input === false) {
      return false;
    }

    return Boolean(String(state?.attributes?.code_format || "").trim());
  }

  _getAlarmCodeValue(state) {
    if (this._shouldShowAlarmCodeInput(state)) {
      const manualCode = String(this._alarmCodeInput || "").trim();
      if (manualCode) {
        return manualCode;
      }
    }

    const helperEntityId = String(this._config?.alarm_code_entity || "").trim();
    if (helperEntityId) {
      const helperState = this._hass?.states?.[helperEntityId];
      const helperValue = String(helperState?.state || "").trim();
      if (helperValue && !["unknown", "unavailable"].includes(normalizeTextKey(helperValue))) {
        return helperValue;
      }
    }

    const configuredCode = String(this._config?.alarm_code || "").trim();
    if (configuredCode) {
      return configuredCode;
    }

    return "";
  }

  _runAlarmAction(service) {
    const state = this._getState();
    if (!this._hass || !this._config?.entity || !service || !state) {
      return;
    }

    const payload = {
      entity_id: this._config.entity,
    };
    const code = this._getAlarmCodeValue(state);
    if (code) {
      payload.code = code;
    }

    this._triggerHaptic();
    this._hass.callService("alarm_control_panel", service, payload);
    this._alarmMenuOpen = false;
    this._applyHostGridSpan(false);
    this._render();
    this._notifyLayoutChange();
  }

  _toggleEntity(entityId = this._config?.entity) {
    const state = this._hass?.states?.[entityId];
    if (!this._hass || !entityId || !state || !this._isBinaryOnOff(state)) {
      return;
    }

    const service = normalizeTextKey(state.state) === "on" ? "turn_off" : "turn_on";
    this._hass.callService("homeassistant", service, {
      entity_id: entityId,
    });
  }

  _openMoreInfo(entityId = this._config?.entity) {
    if (!entityId) {
      return;
    }

    fireEvent(this, "hass-more-info", {
      entityId,
    });
  }

  _parseServiceData(rawValue) {
    if (!rawValue) {
      return {};
    }

    try {
      const parsed = JSON.parse(rawValue);
      return isObject(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  _callConfiguredService(serviceValue, entityId = this._config?.entity, rawData = "") {
    if (!this._hass || !serviceValue) {
      return;
    }

    const [domain, service] = String(serviceValue).split(".");
    if (!domain || !service) {
      return;
    }

    const payload = this._parseServiceData(rawData);
    if (entityId && payload.entity_id === undefined) {
      payload.entity_id = entityId;
    }

    this._hass.callService(domain, service, payload);
  }

  _openConfiguredUrl(urlValue = this._config?.tap_url, newTab = this._config?.tap_new_tab === true) {
    const url = String(urlValue || "").trim();
    if (!url) {
      return;
    }

    if (newTab) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.href = url;
  }

  _notifyLayoutChange() {
    const emit = () => {
      fireEvent(this, "iron-resize", {});
      fireEvent(this, "ll-rebuild", {});

      if (typeof document !== "undefined") {
        fireEvent(document, "iron-resize", {});
        fireEvent(document, "ll-rebuild", {});
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("resize"));
      }
    };

    emit();

    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        emit();
        window.setTimeout(() => emit(), 48);
      });
    }
  }

  _getAlarmGridSpan() {
    const state = this._getState();
    const showCodeInput = this._shouldShowAlarmCodeInput(state);
    return showCodeInput ? 4 : 3;
  }

  _applyHostGridSpan(showAlarmPanel = false) {
    const targets = [
      this,
      this.parentElement,
      this.closest("hui-card"),
      this.closest("hui-card-options"),
      this.closest("hui-section-card"),
    ].filter(Boolean);

    targets.forEach(target => {
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (showAlarmPanel) {
        target.setAttribute("data-fav-alarm-open", "true");
        const span = this._getAlarmGridSpan();
        target.style.setProperty("grid-row-end", `span ${span}`);
        target.style.setProperty("grid-row", `span ${span} / auto`);
      } else {
        target.removeAttribute("data-fav-alarm-open");
        target.style.removeProperty("grid-row-end");
        target.style.removeProperty("grid-row");
      }

      target.style.removeProperty("min-height");
      target.style.removeProperty("height");
      target.style.removeProperty("overflow");
    });
  }

  _getPrimaryActionTarget(event) {
    const path = event.composedPath();
    const alarmInput = path.find(node => node instanceof HTMLElement && node.dataset?.favAlarmIgnore === "true");
    if (alarmInput) {
      return null;
    }

    const alarmButton = path.find(node => node instanceof HTMLButtonElement && node.dataset?.favAlarmAction);
    if (alarmButton) {
      return null;
    }

    const actionTarget = path.find(node => node instanceof HTMLElement && node.dataset?.favAction === "primary");
    return actionTarget || null;
  }

  _activatePrimaryFromEvent(event) {
    const actionTarget = this._getPrimaryActionTarget(event);
    if (!actionTarget) {
      return false;
    }

    const state = this._getState();
    if (!this._canRunTapAction(state)) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();
    this._performPrimaryAction(state);
    return true;
  }

  _performPrimaryAction(state) {
    if (this._isAlarmPanelMode(state)) {
      this._alarmMenuOpen = !this._alarmMenuOpen;
      this._applyHostGridSpan(this._alarmMenuOpen);
      this._render();
      this._notifyLayoutChange();
      return;
    }

    const tapAction = this._config?.tap_action || "auto";

    switch (tapAction) {
      case "toggle":
        this._toggleEntity(this._config?.entity);
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service":
        this._callConfiguredService(this._config?.tap_service, this._config?.entity, this._config?.tap_service_data);
        break;
      case "url":
        this._openConfiguredUrl(this._config?.tap_url, this._config?.tap_new_tab);
        break;
      case "auto":
      default:
        if (this._isBinaryOnOff(state)) {
          this._toggleEntity(this._config?.entity);
          return;
        }

        this._openMoreInfo(this._config?.entity);
        break;
    }
  }

  _triggerHaptic(styleOverride = null) {
    const haptics = this._config?.haptics || {};
    if (haptics.enabled !== true) {
      return;
    }

    const style = styleOverride || haptics.style || "selection";
    fireEvent(this, "haptic", style, {
      bubbles: true,
      cancelable: false,
      composed: true,
    });

    if (haptics.fallback_vibrate === true && typeof navigator?.vibrate === "function") {
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection);
    }
  }

  _onShadowClick(event) {
    if (Date.now() < this._ignoreNextPrimaryClickUntil) {
      const actionTarget = this._getPrimaryActionTarget(event);
      if (actionTarget) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }

    const alarmInput = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.favAlarmIgnore === "true");

    if (alarmInput) {
      return;
    }

    const alarmButton = event
      .composedPath()
      .find(node => node instanceof HTMLButtonElement && node.dataset?.favAlarmAction);

    if (alarmButton) {
      event.preventDefault();
      event.stopPropagation();
      this._runAlarmAction(alarmButton.dataset.favAlarmAction);
      return;
    }

    this._activatePrimaryFromEvent(event);
  }

  _onShadowPointerUp(event) {
    if (event.pointerType !== "touch") {
      return;
    }

    if (this._activatePrimaryFromEvent(event)) {
      this._ignoreNextPrimaryClickUntil = Date.now() + 500;
    }
  }

  _onShadowTouchEnd(event) {
    if (typeof window !== "undefined" && "PointerEvent" in window) {
      return;
    }

    if (this._activatePrimaryFromEvent(event)) {
      this._ignoreNextPrimaryClickUntil = Date.now() + 500;
    }
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.favAlarmField === "alarm-code");

    if (!input) {
      return;
    }

    event.stopPropagation();
    this._alarmCodeInput = input.value;
  }

  _renderChip(label) {
    if (!label) {
      return "";
    }

    return `<div class="fav-card__chip">${escapeHtml(label)}</div>`;
  }

  _isSingleRowLayout() {
    return this._getConfiguredGridRows() === 1;
  }

  _renderEmptyState() {
    return `
      <ha-card class="fav-card fav-card--empty">
        <div class="fav-card__empty-title">Nodalia Fav Card</div>
        <div class="fav-card__empty-text">Configura \`entity\` para mostrar el favorito.</div>
      </ha-card>
    `;
  }

  _renderAlarmActionButton(mode, accentColor) {
    return `
      <button
        type="button"
        class="fav-card__alarm-button"
        data-fav-alarm-action="${escapeHtml(mode.service)}"
        style="
          --fav-alarm-accent:${escapeHtml(accentColor)};
        "
        aria-label="${escapeHtml(mode.label)}"
      >
        <ha-icon icon="${escapeHtml(mode.icon)}"></ha-icon>
        <span>${escapeHtml(mode.label)}</span>
      </button>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    if (!this._config?.entity) {
      this.shadowRoot.innerHTML = this._renderEmptyState();
      return;
    }

    const state = this._getState();
    if (!state) {
      this.shadowRoot.innerHTML = this._renderEmptyState();
      return;
    }

    const config = this._config;
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const layout = this._layout || "inline";
    const isMini = layout === "mini";
    const configuredColumns = this._getConfiguredGridColumns();
    const configuredRows = this._getConfiguredGridRows();
    const isSingleRow = this._isSingleRowLayout();
    const usesCompactRowMetrics =
      isMini ||
      isSingleRow ||
      (configuredRows !== null && configuredRows <= 1) ||
      (configuredColumns !== null && configuredColumns <= 6);
    const isCompactInline = !isMini && usesCompactRowMetrics;
    const isCompactMini = isMini && usesCompactRowMetrics;
    const isTightInline = isCompactInline && (configuredColumns === null || configuredColumns >= 4);
    const singleRowHeightPx = usesCompactRowMetrics ? 68 : 0;
    const icon = this._getIcon(state);
    const title = this._getTitle(state);
    const accentColor = this._getAccentColor(state);
    const showUnavailableBadge = isUnavailableState(state);
    const displayValue = config.show_state !== false
      ? (config.state_attribute ? this._formatAttributeValue(state, config.state_attribute) : this._translateStateValue(state))
      : null;
    const isAlarmPanel = this._isAlarmPanelMode(state);
    const alarmModes = isAlarmPanel ? this._getAlarmRenderedModes(state) : [];
    const showAlarmPanel = isAlarmPanel && this._alarmMenuOpen;
    const showAlarmCodeInput = showAlarmPanel && this._shouldShowAlarmCodeInput(state);
    const canRunPrimaryAction = this._canRunTapAction(state);
    const isActive = this._isDomainOn(state);
    const iconSizePx = Math.max(32, Math.min(parseSizeToPixels(styles.icon.size, 52), isMini ? (isCompactMini ? 34 : 40) : (isCompactInline ? 36 : 56)));
    const titleSizePx = Math.max(10, Math.min(parseSizeToPixels(styles.title_size, 13), isMini ? 0 : (isCompactInline ? 11 : 14)));
    const chipHeightPx = Math.max(16, Math.min(parseSizeToPixels(styles.chip_height, 22), isCompactInline ? 18 : 24));
    const chipFontSizePx = Math.max(8.5, Math.min(parseSizeToPixels(styles.chip_font_size, 11), isCompactInline ? 9.5 : 12));
    const iconColor = isActive
      ? accentColor
      : (this._usesCustomOffColor()
        ? styles.icon.off_color
        : "var(--state-inactive-color, rgba(255, 255, 255, 0.55))");
    const cardBackground = isActive
      ? `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 56%, ${styles.card.background} 100%)`
      : styles.card.background;
    const cardBorder = isActive
      ? `1px solid color-mix(in srgb, ${accentColor} 32%, rgba(255, 255, 255, 0.08))`
      : styles.card.border;
    const cardShadow = isActive
      ? `${styles.card.box_shadow}, 0 16px 30px color-mix(in srgb, ${accentColor} 16%, rgba(0, 0, 0, 0.18))`
      : styles.card.box_shadow;
    const showTitle = config.show_name !== false && !isMini && !showAlarmPanel;
    const showValue = Boolean(displayValue) && !isMini;
    const showCopy = showTitle || showValue || showAlarmPanel;

    this._applyHostGridSpan(showAlarmPanel);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          height: ${showAlarmPanel ? "auto" : (usesCompactRowMetrics ? `${singleRowHeightPx}px` : "100%")};
          min-height: ${showAlarmPanel ? "0" : (usesCompactRowMetrics ? `${singleRowHeightPx}px` : "0")};
          overflow: hidden;
          position: relative;
        }

        ha-card::before {
          background: ${isActive
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, rgba(255, 255, 255, 0.04)), rgba(255, 255, 255, 0))`
            : "linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0))"};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .fav-card {
          cursor: ${canRunPrimaryAction ? "pointer" : "default"};
          min-width: 0;
          touch-action: manipulation;
        }

        .fav-card__content {
          align-content: ${showAlarmPanel ? "start" : "center"};
          display: grid;
          gap: ${showAlarmPanel ? "10px" : (isCompactInline ? "6px" : (isMini ? "0" : styles.card.gap))};
          height: ${showAlarmPanel ? "auto" : (usesCompactRowMetrics ? "100%" : "auto")};
          min-width: 0;
          padding: ${isCompactInline ? "6px 10px" : (isMini ? "6px" : styles.card.padding)};
          position: relative;
          z-index: 1;
        }

        .fav-card--mini .fav-card__content {
          justify-items: center;
        }

        .fav-card--single-row .fav-card__content {
          align-content: center;
        }

        .fav-card--alarm-open .fav-card__content {
          align-items: start;
          min-height: 0;
        }

        .fav-card--alarm-open .fav-card__hero {
          align-items: start;
        }

        .fav-card__hero {
          align-items: center;
          display: grid;
          gap: ${isMini ? "0" : (isCompactInline ? "10px" : "12px")};
          grid-template-columns: ${isMini ? "1fr" : `${iconSizePx}px minmax(0, 1fr)`};
          height: ${showAlarmPanel ? "auto" : (usesCompactRowMetrics ? "100%" : "auto")};
          min-width: 0;
          width: ${(isCompactInline || isMini) ? "100%" : "auto"};
        }

        .fav-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${styles.icon.background};
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: ${isSingleRow ? "18px" : (isMini ? "22px" : "24px")};
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 12px 30px rgba(0, 0, 0, 0.18);
          color: ${iconColor};
          cursor: ${canRunPrimaryAction ? "pointer" : "default"};
          display: inline-flex;
          height: ${iconSizePx}px;
          justify-content: center;
          line-height: 0;
          margin: 0;
          min-width: ${iconSizePx}px;
          outline: none;
          padding: 0;
          position: relative;
          width: ${iconSizePx}px;
          touch-action: manipulation;
        }

        .fav-card--mini .fav-card__hero {
          align-content: center;
          justify-items: center;
        }

        .fav-card__icon ha-icon {
          --mdc-icon-size: calc(${iconSizePx}px * 0.45);
          display: inline-flex;
          height: calc(${iconSizePx}px * 0.45);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${iconSizePx}px * 0.45);
        }

        .fav-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          color: #ffffff;
          display: inline-flex;
          height: 18px;
          justify-content: center;
          position: absolute;
          right: -2px;
          top: -2px;
          width: 18px;
          z-index: 2;
        }

        .fav-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .fav-card__copy {
          align-content: center;
          display: grid;
          gap: ${isCompactInline ? "4px" : "6px"};
          min-width: 0;
        }

        .fav-card__alarm-panel {
          display: grid;
          gap: 10px;
          margin-top: 2px;
          min-width: 0;
        }

        .fav-card__alarm-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          min-width: 0;
        }

        .fav-card__alarm-button {
          align-items: center;
          appearance: none;
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--fav-alarm-accent) 14%, rgba(255, 255, 255, 0.05)),
              rgba(255, 255, 255, 0.05)
            );
          border: 1px solid color-mix(in srgb, var(--fav-alarm-accent) 28%, rgba(255, 255, 255, 0.08));
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.07),
            0 10px 24px rgba(0, 0, 0, 0.14);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: ${Math.max(11, chipFontSizePx)}px;
          font-weight: 700;
          gap: 6px;
          min-height: ${Math.max(28, chipHeightPx + 6)}px;
          padding: 0 11px;
          touch-action: manipulation;
        }

        .fav-card__alarm-button ha-icon {
          --mdc-icon-size: 14px;
          height: 14px;
          width: 14px;
        }

        .fav-card__alarm-code {
          min-width: 0;
        }

        .fav-card__alarm-code input {
          appearance: none;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 38px;
          padding: 0 12px;
          width: 100%;
        }

        .fav-card__title {
          font-size: ${titleSizePx}px;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: ${isCompactInline ? "1.08" : "1.12"};
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .fav-card__chips {
          align-items: center;
          display: flex;
          gap: ${isCompactInline ? "6px" : "8px"};
          min-width: 0;
        }

        .fav-card__chip {
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
          color: var(--primary-text-color);
          display: inline-flex;
          font-size: ${chipFontSizePx}px;
          font-weight: 700;
          height: ${chipHeightPx}px;
          line-height: 1;
          max-width: 100%;
          min-width: 0;
          padding: ${styles.chip_padding};
          white-space: nowrap;
        }

        .fav-card__empty-title {
          font-size: 14px;
          font-weight: 700;
        }

        .fav-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
        }

        .fav-card--single-row .fav-card__chip {
          max-width: 100%;
        }

        .fav-card--tight-inline:not(.fav-card--alarm-open) .fav-card__copy {
          align-items: center;
          display: flex;
          gap: 6px;
          min-width: 0;
        }

        .fav-card--tight-inline:not(.fav-card--alarm-open) .fav-card__title {
          flex: 1 1 auto;
          min-width: 0;
        }

        .fav-card--tight-inline:not(.fav-card--alarm-open) .fav-card__chips {
          flex: 0 0 auto;
          gap: 4px;
        }

        .fav-card--empty {
          display: grid;
          gap: 8px;
          padding: 14px;
        }
      </style>
      <ha-card
        class="fav-card ${isMini ? "fav-card--mini" : "fav-card--inline"} ${isCompactInline ? "fav-card--single-row" : ""} ${isTightInline ? "fav-card--tight-inline" : ""} ${showAlarmPanel ? "fav-card--alarm-open" : ""} ${canRunPrimaryAction ? "fav-card--clickable" : ""}"
        ${canRunPrimaryAction ? 'data-fav-action="primary"' : ""}
      >
        <div class="fav-card__content" ${canRunPrimaryAction ? 'data-fav-action="primary"' : ""}>
          <div class="fav-card__hero" ${canRunPrimaryAction ? 'data-fav-action="primary"' : ""}>
            <button
              type="button"
              class="fav-card__icon"
              ${canRunPrimaryAction ? 'data-fav-action="primary"' : ""}
              aria-label="${escapeHtml(canRunPrimaryAction ? "Accion principal" : title)}"
            >
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
              ${showUnavailableBadge ? `<span class="fav-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${showCopy
              ? `
                <div class="fav-card__copy">
                  ${showTitle ? `<div class="fav-card__title">${escapeHtml(title)}</div>` : ""}
                  ${showValue ? `<div class="fav-card__chips">${this._renderChip(displayValue)}</div>` : ""}
                </div>
              `
              : ""}
          </div>
          ${showAlarmPanel
            ? `
              <div class="fav-card__alarm-panel">
                <div class="fav-card__alarm-actions">
                  ${alarmModes.map(mode => this._renderAlarmActionButton(mode, accentColor)).join("")}
                </div>
                ${showAlarmCodeInput
                  ? `
                    <label class="fav-card__alarm-code" data-fav-alarm-ignore="true">
                      <input
                        type="password"
                        inputmode="numeric"
                        autocomplete="one-time-code"
                        data-fav-alarm-ignore="true"
                        data-fav-alarm-field="alarm-code"
                        placeholder="PIN"
                        value="${escapeHtml(this._alarmCodeInput)}"
                      />
                    </label>
                  `
                  : ""}
              </div>
            `
            : ""}
        </div>
      </ha-card>
    `;

    if (isAlarmPanel) {
      requestAnimationFrame(() => {
        this._applyHostGridSpan(showAlarmPanel);
        this._notifyLayoutChange();
      });
    }
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaFavCard);
}

class NodaliaFavCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._onShadowInput = this._onShadowInput.bind(this);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
  }

  set hass(hass) {
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender =
      !this._hass ||
      nextSignature !== this._entityOptionsSignature ||
      !this.shadowRoot?.innerHTML;

    this._hass = hass;
    this._entityOptionsSignature = nextSignature;

    if (!shouldRender) {
      return;
    }

    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    this._render();
    this._restoreFocusState(focusState);
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return Object.keys(hass?.states || {})
      .sort((left, right) => left.localeCompare(right, "es"))
      .join("|");
  }

  _captureFocusState() {
    const activeElement = this.shadowRoot?.activeElement;

    if (
      !(
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement
      )
    ) {
      return null;
    }

    const dataset = activeElement.dataset || {};
    const selector = dataset.field
      ? `[data-field="${escapeSelectorValue(dataset.field)}"]`
      : null;

    if (!selector) {
      return null;
    }

    const supportsSelection =
      typeof activeElement.selectionStart === "number" &&
      typeof activeElement.selectionEnd === "number";

    return {
      selector,
      selectionEnd: supportsSelection ? activeElement.selectionEnd : null,
      selectionStart: supportsSelection ? activeElement.selectionStart : null,
      type: activeElement.type,
    };
  }

  _restoreFocusState(focusState) {
    if (!focusState?.selector || !this.shadowRoot) {
      return;
    }

    const target = this.shadowRoot.querySelector(focusState.selector);
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
    ) {
      return;
    }

    try {
      target.focus({ preventScroll: true });
    } catch (_error) {
      target.focus();
    }

    const canRestoreSelection =
      focusState.type !== "checkbox" &&
      typeof focusState.selectionStart === "number" &&
      typeof focusState.selectionEnd === "number" &&
      typeof target.setSelectionRange === "function";

    if (!canRestoreSelection) {
      return;
    }

    try {
      target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
    } catch (_error) {
      // Ignore unsupported inputs.
    }
  }

  _emitConfig() {
    const focusState = this._captureFocusState();
    const nextConfig = deepClone(this._config);
    this._config = normalizeConfig(compactConfig(nextConfig));
    this._render();
    this._restoreFocusState(focusState);
    fireEvent(this, "config-changed", {
      config: compactConfig(nextConfig),
    });
  }

  _setEditorConfig() {
    this._config = normalizeConfig(compactConfig(this._config));
  }

  _setFieldValue(path, value) {
    if (value === undefined || value === null || value === "") {
      deleteByPath(this._config, path);
      return;
    }

    setByPath(this._config, path, value);
  }

  _readFieldValue(input) {
    const valueType = input.dataset.valueType || "string";

    switch (valueType) {
      case "boolean":
        return Boolean(input.checked);
      default:
        return input.value;
    }
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement);

    if (!input?.dataset?.field) {
      return;
    }

    event.stopPropagation();

    if (input.dataset.field === "__info_only") {
      const isInfoOnly = this._readFieldValue(input) === true;

      if (isInfoOnly) {
        this._config.tap_action = "none";
      } else if ((this._config.tap_action || "auto") === "none") {
        this._config.tap_action = "auto";
      }

      this._setEditorConfig();

      if (event.type === "change") {
        this._emitConfig();
      }
      return;
    }

    const nextValue = this._readFieldValue(input);
    this._setFieldValue(input.dataset.field, nextValue);
    this._setEditorConfig();

    if (event.type === "change") {
      this._emitConfig();
    }
  }

  _renderTextField(label, field, value, options = {}) {
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <input
          type="${escapeHtml(inputType)}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(valueType)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        />
      </label>
    `;
  }

  _renderTextareaField(label, field, value, options = {}) {
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(label)}</span>
        <textarea data-field="${escapeHtml(field)}" ${placeholder}>${escapeHtml(inputValue)}</textarea>
      </label>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-field="${escapeHtml(field)}"
          data-value-type="boolean"
          ${checked ? "checked" : ""}
        />
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  _renderSelectField(label, field, value, options) {
    return `
      <label class="editor-field">
        <span>${escapeHtml(label)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options
            .map(option => `
              <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
                ${escapeHtml(option.label)}
              </option>
            `)
            .join("")}
        </select>
      </label>
    `;
  }

  _getEntityOptionsMarkup() {
    const entityIds = Object.keys(this._hass?.states || {})
      .sort((left, right) => left.localeCompare(right, "es"));

    if (!entityIds.length) {
      return "";
    }

    return `
      <datalist id="fav-card-entities">
        ${entityIds.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "selection";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        .editor {
          color: var(--primary-text-color);
          display: grid;
          gap: 16px;
        }

        .editor-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 18px;
          display: grid;
          gap: 14px;
          padding: 16px;
        }

        .editor-section__header {
          display: grid;
          gap: 4px;
        }

        .editor-section__title {
          font-size: 15px;
          font-weight: 700;
        }

        .editor-section__hint {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
        }

        .editor-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .editor-field,
        .editor-toggle {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .editor-field--full {
          grid-column: 1 / -1;
        }

        .editor-field > span,
        .editor-toggle > span {
          font-size: 12px;
          font-weight: 600;
        }

        .editor-field input,
        .editor-field select,
        .editor-field textarea {
          appearance: none;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 40px;
          padding: 10px 12px;
          width: 100%;
        }

        .editor-field textarea {
          min-height: 86px;
          resize: vertical;
        }

        .editor-toggle {
          align-items: center;
          grid-template-columns: auto 1fr;
          padding-top: 20px;
        }

        .editor-toggle input {
          accent-color: var(--primary-color);
          height: 18px;
          margin: 0;
          width: 18px;
        }

        @media (max-width: 640px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }

          .editor-toggle {
            padding-top: 0;
          }
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">General</div>
            <div class="editor-section__hint">Entidad favorita, icono y accion principal.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Entidad", "entity", config.entity, {
              placeholder: "light.sofa",
            })}
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Sofa",
            })}
            ${this._renderTextField("Icono", "icon", config.icon, {
              placeholder: "mdi:lightbulb",
            })}
            ${this._renderCheckboxField("Usar icono de la entidad", "use_entity_icon", config.use_entity_icon === true)}
            ${this._renderSelectField(
              "Modo de tarjeta",
              "entity_mode",
              config.entity_mode || "auto",
              [
                { value: "auto", label: "Automatico" },
                { value: "standard", label: "Normal" },
                { value: "alarm_control_panel", label: "Alarm control panel" },
              ],
            )}
            ${this._renderSelectField(
              "Accion principal",
              "tap_action",
              config.tap_action || "auto",
              [
                { value: "auto", label: "Auto (toggle o info)" },
                { value: "toggle", label: "Toggle" },
                { value: "more-info", label: "More info" },
                { value: "url", label: "Abrir URL" },
                { value: "service", label: "Servicio" },
                { value: "none", label: "Solo informacion" },
              ],
            )}
            ${this._renderCheckboxField(
              "Sin accion al tocar",
              "__info_only",
              (config.tap_action || "auto") === "none",
            )}
            ${this._renderTextField("Servicio al tocar", "tap_service", config.tap_service, {
              placeholder: "light.turn_on",
            })}
            ${this._renderTextareaField("Datos del servicio (JSON)", "tap_service_data", config.tap_service_data, {
              placeholder: '{"brightness_pct": 70}',
            })}
            ${this._renderTextField("URL al tocar", "tap_url", config.tap_url, {
              placeholder: "https://example.com",
            })}
            ${this._renderCheckboxField("Abrir URL en pestana nueva", "tap_new_tab", config.tap_new_tab === true)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Layout</div>
            <div class="editor-section__hint">Version mini para 1x1 o inline para favoritos alargados.</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "Layout",
              "layout_mode",
              config.layout_mode || "auto",
              [
                { value: "auto", label: "Automatico" },
                { value: "mini", label: "Mini" },
                { value: "inline", label: "Inline" },
              ],
            )}
            ${this._renderCheckboxField("Mostrar nombre", "show_name", config.show_name !== false)}
            ${this._renderCheckboxField("Mostrar estado", "show_state", config.show_state !== false)}
            ${this._renderTextField("Atributo a mostrar", "state_attribute", config.state_attribute, {
              placeholder: "battery_level",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Alarma</div>
            <div class="editor-section__hint">Si la entidad es una alarma, al tocar la tarjeta puede desplegar los modos de armado y usar PIN fijo o helper.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("PIN fijo", "alarm_code", config.alarm_code, {
              placeholder: "1234",
            })}
            ${this._renderTextField("Helper codigo", "alarm_code_entity", config.alarm_code_entity, {
              placeholder: "input_text.alarm_pin",
            })}
            ${this._renderCheckboxField("Mostrar cuadro de texto del PIN", "alarm_show_code_input", config.alarm_show_code_input !== false)}
            ${this._renderCheckboxField("Mostrar desarmar", "alarm_show_disarm", config.alarm_show_disarm !== false)}
            ${this._renderCheckboxField("Mostrar en casa", "alarm_show_arm_home", config.alarm_show_arm_home !== false)}
            ${this._renderCheckboxField("Mostrar ausente", "alarm_show_arm_away", config.alarm_show_arm_away !== false)}
            ${this._renderCheckboxField("Mostrar noche", "alarm_show_arm_night", config.alarm_show_arm_night !== false)}
            ${this._renderCheckboxField("Mostrar vacaciones", "alarm_show_arm_vacation", config.alarm_show_arm_vacation === true)}
            ${this._renderCheckboxField("Mostrar personalizado", "alarm_show_custom_bypass", config.alarm_show_custom_bypass === true)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Haptics</div>
            <div class="editor-section__hint">Respuesta haptica opcional al tocar la tarjeta.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Activar haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("Fallback con vibracion", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "Estilo",
              "haptics.style",
              hapticStyle,
              [
                { value: "selection", label: "Selection" },
                { value: "light", label: "Light" },
                { value: "medium", label: "Medium" },
                { value: "heavy", label: "Heavy" },
                { value: "success", label: "Success" },
                { value: "warning", label: "Warning" },
                { value: "failure", label: "Failure" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Estilos</div>
            <div class="editor-section__hint">Ajustes visuales base de la tarjeta favorita.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Background", "styles.card.background", config.styles.card.background)}
            ${this._renderTextField("Border", "styles.card.border", config.styles.card.border)}
            ${this._renderTextField("Radius", "styles.card.border_radius", config.styles.card.border_radius)}
            ${this._renderTextField("Shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
            ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
            ${this._renderTextField("Separacion", "styles.card.gap", config.styles.card.gap)}
            ${this._renderTextField("Tamano burbuja", "styles.icon.size", config.styles.icon.size)}
            ${this._renderTextField("Color activo", "styles.icon.on_color", config.styles.icon.on_color)}
            ${this._renderTextField("Color inactivo", "styles.icon.off_color", config.styles.icon.off_color)}
            ${this._renderTextField("Alto chips", "styles.chip_height", config.styles.chip_height)}
            ${this._renderTextField("Texto chips", "styles.chip_font_size", config.styles.chip_font_size)}
            ${this._renderTextField("Padding chips", "styles.chip_padding", config.styles.chip_padding)}
            ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
          </div>
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('input[data-field="entity"]')
      .forEach(input => input.setAttribute("list", "fav-card-entities"));

    this.shadowRoot
      .querySelectorAll('input[data-field="alarm_code_entity"]')
      .forEach(input => input.setAttribute("list", "fav-card-entities"));
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaFavCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Fav Card",
  description: "Tarjeta mini y elegante para favoritos y controles rapidos en movil.",
  preview: true,
});
