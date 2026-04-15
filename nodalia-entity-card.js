const CARD_TAG = "nodalia-entity-card";
const EDITOR_TAG = "nodalia-entity-card-editor";
const CARD_VERSION = "0.6.0";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
const COMPACT_LAYOUT_THRESHOLD = 150;

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  use_entity_icon: false,
  number_decimals: 2,
  tap_action: "auto",
  tap_service: "",
  tap_service_data: "",
  tap_url: "",
  tap_new_tab: false,
  show_state: true,
  primary_attribute: "",
  secondary_attribute: "",
  show_primary_chip: true,
  show_secondary_chip: true,
  compact_layout_mode: "auto",
  quick_actions: [],
  haptics: {
    enabled: false,
    style: "selection",
    fallback_vibrate: false,
  },
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
      size: "58px",
      background: "rgba(255, 255, 255, 0.06)",
      color: "var(--primary-text-color)",
      on_color: "var(--info-color, #71c0ff)",
      off_color: "var(--state-inactive-color, rgba(255, 255, 255, 0.5))",
    },
    control: {
      size: "40px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(113, 192, 255, 0.18)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    title_size: "14px",
  },
};

const STUB_CONFIG = {
  entity: "switch.lampara",
  name: "Lampara",
  number_decimals: 2,
  tap_action: "auto",
  show_state: true,
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

function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseNumericValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const rawValue = String(value ?? "").trim();
  if (!rawValue || !/^-?\d+(?:[.,]\d+)?$/.test(rawValue)) {
    return null;
  }

  const numericValue = Number(rawValue.replace(",", "."));
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatNumericValue(value, maximumFractionDigits = 2) {
  const numericValue = parseNumericValue(value);
  if (!Number.isFinite(numericValue)) {
    return String(value ?? "");
  }

  const safeDigits = clamp(Math.round(Number(maximumFractionDigits)), 0, 6);
  return numericValue
    .toFixed(safeDigits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

function formatNumericValueWithUnit(value, unit = "", maximumFractionDigits = 2) {
  const formattedValue = formatNumericValue(value, maximumFractionDigits);
  const normalizedUnit = String(unit || "").trim();

  if (!normalizedUnit) {
    return formattedValue;
  }

  return `${formattedValue}${normalizedUnit.startsWith("°") ? "" : " "}${normalizedUnit}`;
}

function getValueSignature(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (Array.isArray(value) || isObject(value)) {
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }

  return String(value);
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

function resolveEditorColorValue(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue || typeof document === "undefined") {
    return "";
  }

  const probe = document.createElement("span");
  probe.style.position = "fixed";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  probe.style.color = "";
  probe.style.color = rawValue;
  if (!probe.style.color) {
    return rawValue;
  }

  (document.body || document.documentElement).appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || rawValue;
}

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
  const resolvedValue = resolveEditorColorValue(sourceValue) || resolveEditorColorValue(fallbackValue) || "rgb(113, 192, 255)";
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

  if (normalizedField.endsWith("off_color")) {
    return "var(--state-inactive-color, rgba(255, 255, 255, 0.5))";
  }

  if (normalizedField.endsWith("accent_background")) {
    return "rgba(113, 192, 255, 0.18)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
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

  return "";
}

function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});

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

  return config;
}

class NodaliaEntityCard extends HTMLElement {
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
    this._isCompactLayout = false;
    this._lastRenderSignature = "";
    this._resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextWidth = Math.round(entry.contentRect?.width || this.clientWidth || 0);
      const nextCompact = this._shouldUseCompactLayout(nextWidth);

      if (nextWidth === this._cardWidth && nextCompact === this._isCompactLayout) {
        return;
      }

      this._cardWidth = nextWidth;
      this._isCompactLayout = nextCompact;
      this._render();
    });
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
  }

  connectedCallback() {
    this._resizeObserver?.observe(this);
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._isCompactLayout = this._shouldUseCompactLayout(
      Math.round(this._cardWidth || this.clientWidth || 0),
    );
    this._lastRenderSignature = "";
    this._render();
  }

  set hass(hass) {
    const nextSignature = this._getRenderSignature(hass);
    this._hass = hass;

    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }

    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return {
      rows: Array.isArray(this._config?.quick_actions) && this._config.quick_actions.length ? 3 : 2,
      columns: 4,
      min_rows: 2,
      min_columns: 2,
    };
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const attrs = state?.attributes || {};
    const configuredStateAttribute = String(this._config?.state_attribute || "").trim();
    const configuredPrimaryAttribute = String(this._config?.primary_attribute || "").trim();
    const configuredSecondaryAttribute = String(this._config?.secondary_attribute || "").trim();
    return JSON.stringify({
      entityId,
      state: String(state?.state || ""),
      friendlyName: String(attrs.friendly_name || ""),
      icon: String(attrs.icon || ""),
      deviceClass: String(attrs.device_class || ""),
      unit: String(attrs.unit_of_measurement || attrs.native_unit_of_measurement || ""),
      configuredStateAttribute,
      configuredStateValue: configuredStateAttribute ? String(attrs[configuredStateAttribute] ?? "") : "",
      configuredPrimaryAttribute,
      configuredPrimaryValue: configuredPrimaryAttribute ? getValueSignature(attrs[configuredPrimaryAttribute]) : "",
      configuredSecondaryAttribute,
      configuredSecondaryValue: configuredSecondaryAttribute ? getValueSignature(attrs[configuredSecondaryAttribute]) : "",
      useEntityIcon: Boolean(this._config?.use_entity_icon),
      compact: Boolean(this._isCompactLayout),
      quickActions: Array.isArray(this._config?.quick_actions) ? this._config.quick_actions.length : 0,
    });
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) ? numericColumns : null;
  }

  _getConfiguredGridRows() {
    const numericRows = Number(this._config?.grid_options?.rows);
    return Number.isFinite(numericRows) ? numericRows : null;
  }

  _shouldUseCompactLayout(width) {
    const mode = this._config?.compact_layout_mode || "auto";

    if (mode === "always") {
      return true;
    }

    if (mode === "never") {
      return false;
    }

    const configuredColumns = this._getConfiguredGridColumns();
    if (configuredColumns !== null) {
      return configuredColumns < 4;
    }

    return width > 0 && width <= COMPACT_LAYOUT_THRESHOLD;
  }

  _getState() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _getDomain(entityId = this._config?.entity) {
    return String(entityId || "").split(".")[0] || "";
  }

  _isBinaryOnOff(state) {
    const stateKey = normalizeTextKey(state?.state);
    return stateKey === "on" || stateKey === "off";
  }

  _isActiveState(state) {
    const stateKey = normalizeTextKey(state?.state);

    if (!stateKey || ["off", "closed", "locked", "unavailable", "unknown", "none", "idle", "standby"].includes(stateKey)) {
      return false;
    }

    return true;
  }

  _getAccentColor(state) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    return this._isActiveState(state)
      ? styles?.icon?.on_color || DEFAULT_CONFIG.styles.icon.on_color
      : styles?.icon?.off_color || DEFAULT_CONFIG.styles.icon.off_color;
  }

  _getNumberDecimals() {
    const configuredValue = Number(this._config?.number_decimals);
    return Number.isFinite(configuredValue) ? clamp(Math.round(configuredValue), 0, 6) : 2;
  }

  _translateStateValue(state) {
    if (!state) {
      return null;
    }

    const rawState = String(state.state ?? "").trim();
    const unit = String(state.attributes?.unit_of_measurement || state.attributes?.native_unit_of_measurement || "").trim();
    const key = normalizeTextKey(rawState);
    const domain = getEntityDomain(state);
    const deviceClass = normalizeTextKey(state.attributes?.device_class);
    const numberDecimals = this._getNumberDecimals();

    if (parseNumericValue(rawState) !== null) {
      return unit
        ? formatNumericValueWithUnit(rawState, unit, numberDecimals)
        : formatNumericValue(rawState, numberDecimals);
    }

    if (domain === "binary_sensor") {
      const isOpenState = ["on", "open", "opening"].includes(key);
      const isClosedState = ["off", "closed", "closing"].includes(key);

      if (["door", "opening", "window", "garage_door"].includes(deviceClass)) {
        if (isOpenState) {
          return "Abierta";
        }
        if (isClosedState) {
          return "Cerrada";
        }
      }

      if (["motion", "occupancy", "presence", "moving"].includes(deviceClass)) {
        if (isOpenState) {
          return "Detectado";
        }
        if (isClosedState) {
          return "No detectado";
        }
      }
    }

    if (domain === "lock") {
      if (key === "locking") {
        return "Bloqueando";
      }
      if (key === "unlocking") {
        return "Desbloqueando";
      }
    }

    switch (key) {
      case "on":
        return "Encendido";
      case "off":
        return "Apagado";
      case "open":
        return "Abierto";
      case "opening":
        return "Abriendo";
      case "closed":
        return "Cerrado";
      case "closing":
        return "Cerrando";
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
      case "detected":
        return "Detectado";
      case "clear":
        return "Libre";
      case "unavailable":
        return "No disponible";
      case "unknown":
        return "Desconocido";
      case "locked":
        return "Bloqueado";
      case "unlocked":
        return "Desbloqueado";
      case "locking":
        return "Bloqueando";
      case "unlocking":
        return "Desbloqueando";
      case "locking_failed":
        return "Bloqueo fallido";
      case "unlocking_failed":
        return "Desbloqueo fallido";
      case "jammed":
        return "Atascado";
      case "pending":
        return "Pendiente";
      case "opening":
        return "Abriendo";
      case "closing":
        return "Cerrando";
      case "stopped":
        return "Detenido";
      case "paused":
        return "En pausa";
      case "unavailable":
        return "No disponible";
      case "armed_away":
        return "Armado fuera";
      case "armed_home":
        return "Armado en casa";
      case "disarmed":
        return "Desarmado";
      case "triggered":
        return "Disparado";
      case "comfortable":
        return "Comodo";
      case "very_comfortable":
        return "Muy comodo";
      case "slightly_uncomfortable":
        return "Ligeramente incomodo";
      case "somewhat_uncomfortable":
        return "Algo incomodo";
      case "quite_uncomfortable":
        return "Bastante incomodo";
      case "extremely_uncomfortable":
        return "Muy incomodo";
      case "ok_but_humid":
        return "Bien, pero humedo";
      case "little_or_no_discomfort":
        return "Poco o ningun malestar";
      case "some_discomfort":
        return "Algo de malestar";
      case "great_discomfort_avoid_exertion":
        return "Gran malestar";
      case "dangerous_discomfort":
        return "Malestar peligroso";
      case "heat_stroke_imminent":
        return "Golpe de calor inminente";
      case "dry":
        return "Seco";
      case "very_dry":
        return "Muy seco";
      case "too_dry":
        return "Demasiado seco";
      case "humid":
        return "Humedo";
      case "very_humid":
        return "Muy humedo";
      case "too_humid":
        return "Demasiado humedo";
      case "wet":
        return "Mojado";
      case "low":
        return "Bajo";
      case "medium":
        return "Medio";
      case "moderate":
        return "Moderado";
      case "high":
        return "Alto";
      case "very_high":
        return "Muy alto";
      case "severely_high":
        return "Extremadamente alto";
      case "critical":
        return "Critico";
      case "excellent":
        return "Excelente";
      case "good":
        return "Bueno";
      case "fair":
        return "Aceptable";
      case "poor":
        return "Malo";
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
    const numberDecimals = this._getNumberDecimals();

    if (typeof value === "boolean") {
      return value ? "Si" : "No";
    }

    if (Array.isArray(value)) {
      return value
        .map(item => {
          if (isObject(item) && item.name) {
            return item.name;
          }
          return String(item ?? "").trim();
        })
        .filter(Boolean)
        .join(", ");
    }

    if (isObject(value)) {
      if (value.name) {
        return String(value.name);
      }

      try {
        return JSON.stringify(value);
      } catch (_error) {
        return String(value);
      }
    }

    const numericValue = parseNumericValue(value);
    if (numericValue !== null) {
      if (["battery", "battery_level", "humidity", "current_humidity"].includes(key)) {
        return `${Math.round(numericValue)}%`;
      }

      if (key === "brightness") {
        return `${Math.round((numericValue / 255) * 100)}%`;
      }

      if (key === "volume_level") {
        return `${Math.round(numericValue * 100)}%`;
      }

      if (key.includes("temperature")) {
        const unit = state.attributes?.temperature_unit || "°C";
        return formatNumericValueWithUnit(numericValue, unit, numberDecimals);
      }

      return formatNumericValue(numericValue, numberDecimals);
    }

    return String(value);
  }

  _getTitle(state) {
    return this._config?.name || state?.attributes?.friendly_name || this._config?.entity || "Entidad";
  }

  _getIcon(state) {
    if (this._config?.use_entity_icon === true) {
      const resolvedEntityIcon = state?.attributes?.icon || getDynamicEntityIcon(state);
      if (resolvedEntityIcon) {
        return resolvedEntityIcon;
      }
    }

    return this._config?.icon || state?.attributes?.icon || "mdi:tune";
  }

  _canRunTapAction(state) {
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

    if (tapAction === "auto") {
      return Boolean(this._config?.entity);
    }

    return false;
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

  _performPrimaryAction(state) {
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

  _performQuickAction(action) {
    const targetEntity = action?.entity || this._config?.entity;

    switch (action?.type) {
      case "toggle":
        this._toggleEntity(targetEntity);
        break;
      case "more-info":
        this._openMoreInfo(targetEntity);
        break;
      case "service":
        this._callConfiguredService(action?.service, targetEntity, action?.service_data);
        break;
      default:
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
    const actionTarget = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.entityAction);

    if (!actionTarget) {
      return;
    }

    const state = this._getState();
    const action = actionTarget.dataset.entityAction;

    event.preventDefault();
    event.stopPropagation();

    if (action === "primary") {
      if (!this._canRunTapAction(state)) {
        return;
      }

      this._triggerHaptic();
      this._performPrimaryAction(state);
      return;
    }

    if (action === "quick") {
      const index = Number(actionTarget.dataset.index);
      const quickAction = this._config?.quick_actions?.[index];

      if (!quickAction) {
        return;
      }

      this._triggerHaptic();
      this._performQuickAction(quickAction);
    }
  }

  _renderChip(label, tone = "default") {
    if (!label) {
      return "";
    }

    return `<div class="entity-card__chip entity-card__chip--${tone}">${escapeHtml(label)}</div>`;
  }

  _renderEmptyState() {
    return `
      <ha-card class="entity-card entity-card--empty">
        <div class="entity-card__empty-title">Nodalia Entity Card</div>
        <div class="entity-card__empty-text">Configura \`entity\` para mostrar la tarjeta.</div>
      </ha-card>
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
    const quickActions = Array.isArray(config.quick_actions) ? config.quick_actions.filter(action => action?.icon) : [];
    const configuredColumns = this._getConfiguredGridColumns();
    const configuredRows = this._getConfiguredGridRows();
    const singleRowLayout = configuredRows !== null ? configuredRows <= 1 : false;
    const narrowCard = configuredColumns !== null ? configuredColumns < 4 : (this._cardWidth || this.clientWidth || 0) <= 300;
    const compactMetrics = narrowCard || singleRowLayout;
    const singleRowPaddingY = singleRowLayout ? 4 : 0;
    const singleRowPaddingX = singleRowLayout ? 9 : 0;
    const effectivePadding = singleRowLayout ? `${singleRowPaddingY}px ${singleRowPaddingX}px` : compactMetrics ? "10px 12px" : styles.card.padding;
    const effectiveGap = singleRowLayout ? "2px" : compactMetrics ? "8px" : styles.card.gap;
    const effectiveIconSizePx = Math.max(30, Math.min(parseSizeToPixels(styles.icon.size, 58), singleRowLayout ? 32 : compactMetrics ? 46 : 58));
    const effectiveIconSize = `${effectiveIconSizePx}px`;
    const effectiveIconTrackSize = `${effectiveIconSizePx + (singleRowLayout ? 7 : 10)}px`;
    const effectiveControlSize = `${Math.max(34, Math.min(parseSizeToPixels(styles.control.size, 40), compactMetrics ? 36 : 40))}px`;
    const effectiveTitleSize = `${Math.max(9.5, Math.min(parseSizeToPixels(styles.title_size, 14), singleRowLayout ? 10 : compactMetrics ? 12 : 14))}px`;
    const effectiveChipHeight = `${Math.max(15, Math.min(parseSizeToPixels(styles.chip_height, 24), singleRowLayout ? 16 : compactMetrics ? 22 : 24))}px`;
    const effectiveChipFontSize = `${Math.max(8, Math.min(parseSizeToPixels(styles.chip_font_size, 11), singleRowLayout ? 8.5 : compactMetrics ? 10 : 11))}px`;
    const effectiveChipPadding = singleRowLayout ? "0 6px" : compactMetrics ? "0 8px" : styles.chip_padding;
    const effectiveCardHeightPx = singleRowLayout ? Math.max(54, effectiveIconSizePx + (singleRowPaddingY * 2)) : 0;
    const effectiveCardMinHeight = singleRowLayout ? `${effectiveCardHeightPx}px` : "0px";
    const effectiveContentMinHeight = singleRowLayout ? `${Math.max(effectiveIconSizePx, effectiveCardHeightPx - (singleRowPaddingY * 2))}px` : "0px";
    const title = this._getTitle(state);
    const icon = this._getIcon(state);
    const isCompactLayout = this._isCompactLayout;
    const accentColor = this._getAccentColor(state);
    const showUnavailableBadge = isUnavailableState(state);
    const stateLabel = config.show_state ? this._translateStateValue(state) : null;
    const primaryValue = config.show_primary_chip !== false
      ? this._formatAttributeValue(state, config.primary_attribute)
      : null;
    const secondaryValue = config.show_secondary_chip !== false
      ? this._formatAttributeValue(state, config.secondary_attribute)
      : null;
    const chips = [
      this._renderChip(stateLabel, "state"),
      this._renderChip(primaryValue, "value"),
      this._renderChip(secondaryValue, "value"),
    ].filter(Boolean);
    const showTitle = !isCompactLayout;
    const showCopyBlock = showTitle || chips.length > 0;
    const canRunPrimaryAction = this._canRunTapAction(state);
    const isActive = this._isActiveState(state);
    const cardBackground = isActive
      ? `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 7%, ${styles.card.background}) 56%, ${styles.card.background} 100%)`
      : styles.card.background;
    const cardBorder = isActive
      ? `1px solid color-mix(in srgb, ${accentColor} 24%, var(--divider-color))`
      : "1px solid rgba(255, 255, 255, 0.06)";
    const cardShadow = isActive
      ? `${styles.card.box_shadow}, 0 16px 32px color-mix(in srgb, ${accentColor} 10%, rgba(0, 0, 0, 0.18))`
      : styles.card.box_shadow;

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
          overflow: hidden;
          position: relative;
        }

        .entity-card--single-row {
          min-height: ${effectiveCardMinHeight};
        }

        ha-card::before {
          background: ${isActive
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 14%, rgba(255, 255, 255, 0.05)), rgba(255, 255, 255, 0))`
            : "linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0))"};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .entity-card--clickable {
          cursor: pointer;
        }

        .entity-card__content {
          display: grid;
          gap: ${effectiveGap};
          min-width: 0;
          padding: ${effectivePadding};
          position: relative;
          z-index: 1;
        }

        .entity-card--single-row .entity-card__content {
          align-content: center;
          min-height: ${effectiveContentMinHeight};
        }

        .entity-card__hero {
          align-items: center;
          display: grid;
          gap: ${singleRowLayout ? "6px" : narrowCard ? "10px" : "12px"};
          grid-template-columns: ${effectiveIconTrackSize} minmax(0, 1fr);
          min-height: ${singleRowLayout ? effectiveContentMinHeight : "0px"};
          min-width: 0;
        }

        .entity-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${styles.icon.background};
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: ${singleRowLayout ? "18px" : "24px"};
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 12px 30px rgba(0, 0, 0, 0.18);
          color: ${isActive ? styles.icon.on_color : styles.icon.off_color};
          cursor: ${canRunPrimaryAction ? "pointer" : "default"};
          display: inline-flex;
          flex: 0 0 auto;
          height: ${effectiveIconSize};
          justify-content: center;
          line-height: 0;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          justify-self: start;
          width: ${effectiveIconSize};
        }

        .entity-card__icon ha-icon {
          --mdc-icon-size: calc(${effectiveIconSize} * 0.44);
          display: inline-flex;
          height: calc(${effectiveIconSize} * 0.44);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${effectiveIconSize} * 0.44);
        }

        .entity-card__unavailable-badge {
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
          right: 0;
          top: 0;
          transform: translate(28%, -28%);
          width: 18px;
          z-index: 2;
        }

        .entity-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .entity-card__copy {
          display: grid;
          gap: ${singleRowLayout ? "0" : narrowCard ? "6px" : "10px"};
          min-width: 0;
        }

        .entity-card--single-row .entity-card__copy {
          align-content: center;
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .entity-card--compact:not(.entity-card--with-copy) .entity-card__hero {
          justify-items: center;
          grid-template-columns: 1fr;
        }

        .entity-card__title {
          font-size: ${effectiveTitleSize};
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: ${singleRowLayout ? "1.02" : narrowCard ? "1.1" : "1.15"};
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .entity-card__chips {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: ${singleRowLayout ? "0" : narrowCard ? "6px" : "8px"};
          min-width: 0;
        }

        .entity-card--single-row .entity-card__chips {
          flex-wrap: nowrap;
          gap: 3px;
          justify-content: flex-start;
          margin-left: 0;
        }

        .entity-card__chip {
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
          color: var(--secondary-text-color);
          display: inline-flex;
          flex: 0 0 auto;
          font-size: ${effectiveChipFontSize};
          font-weight: 700;
          height: ${effectiveChipHeight};
          line-height: 1;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding: ${effectiveChipPadding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .entity-card--single-row .entity-card__title {
          min-width: 0;
        }

        .entity-card__chip--state {
          color: var(--primary-text-color);
        }

        .entity-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: ${narrowCard ? "8px" : "10px"};
          justify-content: center;
        }

        .entity-card__control {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: ${effectiveControlSize};
          justify-content: center;
          line-height: 0;
          margin: 0;
          min-width: ${effectiveControlSize};
          outline: none;
          padding: 0;
          position: relative;
          width: ${effectiveControlSize};
        }

        .entity-card__control ha-icon {
          --mdc-icon-size: calc(${effectiveControlSize} * 0.46);
          display: inline-flex;
          height: calc(${effectiveControlSize} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${effectiveControlSize} * 0.46);
        }

        .entity-card__empty-title {
          font-size: 15px;
          font-weight: 700;
        }

        .entity-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }

        .entity-card--empty {
          display: grid;
          gap: 8px;
          padding: 16px;
        }

        @media (max-width: 420px) {
          .entity-card__hero {
            gap: 10px;
            grid-template-columns: min(${effectiveIconSize}, 52px) minmax(0, 1fr);
          }

          .entity-card__icon {
            height: min(${effectiveIconSize}, 52px);
            width: min(${effectiveIconSize}, 52px);
          }
        }
      </style>
      <ha-card
        class="entity-card ${isActive ? "is-on" : "is-off"} ${isCompactLayout ? "entity-card--compact" : ""} ${showCopyBlock ? "entity-card--with-copy" : ""} ${singleRowLayout ? "entity-card--single-row" : ""} ${canRunPrimaryAction ? "entity-card--clickable" : ""}"
        style="--accent-color:${escapeHtml(accentColor)};"
        ${canRunPrimaryAction ? 'data-entity-action="primary"' : ""}
      >
        <div class="entity-card__content">
          <div class="entity-card__hero">
            <button
              type="button"
              class="entity-card__icon"
              ${canRunPrimaryAction ? 'data-entity-action="primary"' : ""}
              aria-label="${escapeHtml(canRunPrimaryAction ? "Accion principal" : title)}"
            >
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
              ${showUnavailableBadge ? `<span class="entity-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${showCopyBlock
              ? `
                <div class="entity-card__copy">
                  ${showTitle ? `<div class="entity-card__title">${escapeHtml(title)}</div>` : ""}
                  ${chips.length ? `<div class="entity-card__chips">${chips.join("")}</div>` : ""}
                </div>
              `
              : ""}
          </div>

          ${
            quickActions.length
              ? `
                <div class="entity-card__actions">
                  ${quickActions
                    .map((action, index) => `
                      <button
                        type="button"
                        class="entity-card__control"
                        data-entity-action="quick"
                        data-index="${index}"
                        aria-label="${escapeHtml(action.label || action.type || "Accion")}"
                        title="${escapeHtml(action.label || action.type || "Accion")}"
                      >
                        <ha-icon icon="${escapeHtml(action.icon || "mdi:flash")}"></ha-icon>
                      </button>
                    `)
                    .join("")}
                </div>
              `
              : ""
          }
        </div>
      </ha-card>
    `;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaEntityCard);
}

class NodaliaEntityCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showStyleSection = false;
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
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
    return Object.entries(hass?.states || {})
      .map(([entityId, state]) => `${entityId}:${String(state?.attributes?.friendly_name || "")}:${String(state?.attributes?.icon || "")}`)
      .sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }))
      .join("|");
  }

  _watchEditorControlTag(tagName) {
    if (!tagName || this._pendingEditorControlTags.has(tagName)) {
      return;
    }

    if (typeof customElements?.whenDefined !== "function" || customElements.get(tagName)) {
      return;
    }

    this._pendingEditorControlTags.add(tagName);
    customElements.whenDefined(tagName)
      .then(() => {
        this._pendingEditorControlTags.delete(tagName);

        if (!this._hass || !this.shadowRoot) {
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

  _getEntityOptions(path = "entity") {
    const options = Object.entries(this._hass?.states || {})
      .map(([entityId, state]) => {
        const friendlyName = String(state?.attributes?.friendly_name || "").trim();
        return {
          value: entityId,
          label: friendlyName || entityId,
          displayLabel: friendlyName && friendlyName !== entityId
            ? `${friendlyName} (${entityId})`
            : entityId,
        };
      })
      .sort((left, right) => (
        left.label.localeCompare(right.label, "es", { sensitivity: "base" })
        || left.value.localeCompare(right.value, "es", { sensitivity: "base" })
      ));

    const currentValue = String(getByPath(this._config, path) || "").trim();
    if (currentValue && !options.some(option => option.value === currentValue)) {
      options.unshift({
        value: currentValue,
        label: currentValue,
        displayLabel: currentValue,
      });
    }

    return options;
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
      case "color":
        return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
      default:
        return input.value;
    }
  }

  _moveAction(index, direction) {
    const nextIndex = index + direction;
    if (
      !Array.isArray(this._config.quick_actions) ||
      nextIndex < 0 ||
      nextIndex >= this._config.quick_actions.length
    ) {
      return;
    }

    const [action] = this._config.quick_actions.splice(index, 1);
    this._config.quick_actions.splice(nextIndex, 0, action);
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement);

    if (!input?.dataset?.field) {
      return;
    }

    event.stopPropagation();

    const nextValue = this._readFieldValue(input);
    this._setFieldValue(input.dataset.field, nextValue);
    this._setEditorConfig();

    if (event.type === "change") {
      this._emitConfig();
    }
  }

  _onShadowValueChanged(event) {
    const control = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.field);

    if (!control?.dataset?.field) {
      return;
    }

    event.stopPropagation();

    const nextValue = typeof event.detail?.value === "string"
      ? event.detail.value
      : control.value;
    if (typeof control.dataset?.value === "string") {
      control.dataset.value = String(nextValue || "");
    }

    this._setFieldValue(control.dataset.field, nextValue);
    this._setEditorConfig();
    this._emitConfig();
  }

  _onShadowClick(event) {
    const toggleButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorToggle);

    if (toggleButton) {
      event.preventDefault();
      event.stopPropagation();

      if (toggleButton.dataset.editorToggle === "styles") {
        this._showStyleSection = !this._showStyleSection;
        this._render();
      }
      return;
    }

    const button = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorAction);

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const action = button.dataset.editorAction;
    const index = Number(button.dataset.index);

    if (!Array.isArray(this._config.quick_actions)) {
      this._config.quick_actions = [];
    }

    switch (action) {
      case "add-action":
        this._config.quick_actions.push({
          icon: "mdi:flash",
          type: "toggle",
          label: "",
          entity: "",
          service: "",
          service_data: "",
        });
        this._emitConfig();
        break;
      case "remove-action":
        if (Number.isInteger(index)) {
          this._config.quick_actions.splice(index, 1);
          this._emitConfig();
        }
        break;
      case "move-action-up":
        if (Number.isInteger(index)) {
          this._moveAction(index, -1);
          this._emitConfig();
        }
        break;
      case "move-action-down":
        if (Number.isInteger(index)) {
          this._moveAction(index, 1);
          this._emitConfig();
        }
        break;
      default:
        break;
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

  _renderColorField(label, field, value, options = {}) {
    const fallbackValue = options.fallbackValue || getEditorColorFallbackValue(field);
    const currentValue = value === undefined || value === null || value === ""
      ? fallbackValue
      : String(value);
    const colorModel = getEditorColorModel(currentValue, fallbackValue);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="Color personalizado">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="color"
              data-alpha="${escapeHtml(String(colorModel.alpha))}"
              value="${escapeHtml(colorModel.hex)}"
              aria-label="${escapeHtml(label)}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>
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
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(label)}</span>
      </label>
    `;
  }

  _renderSelectField(label, field, value, options, renderOptions = {}) {
    return `
      <label class="editor-field ${renderOptions.fullWidth ? "editor-field--full" : ""}">
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

  _renderEntityPickerField(label, field, value, options = {}) {
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
        ></div>
      </div>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <ha-icon-picker
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        ></ha-icon-picker>
      </div>
    `;
  }

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.allowCustomEntity = true;
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: {},
      };
    } else {
      control = document.createElement("select");
      this._getEntityOptions(field).forEach(option => {
        const optionElement = document.createElement("option");
        optionElement.value = option.value;
        optionElement.textContent = option.displayLabel;
        control.appendChild(optionElement);
      });
      control.addEventListener("change", this._onShadowInput);
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;

    if ("hass" in control) {
      control.hass = this._hass;
    }

    if ("value" in control) {
      control.value = nextValue;
    }

    if (control.tagName !== "SELECT") {
      control.addEventListener("value-changed", this._onShadowValueChanged);
    }

    host.replaceChildren(control);
  }

  _renderQuickActions(config) {
    if (!Array.isArray(config.quick_actions) || !config.quick_actions.length) {
      return `
        <div class="editor-empty">Todavía no hay acciones rápidas.</div>
      `;
    }

    return config.quick_actions
      .map((action, index) => {
        const actionType = action.type || "toggle";

        return `
          <div class="editor-action">
            <div class="editor-action__header">
              <div class="editor-action__title">Acción ${index + 1}</div>
              <div class="editor-action__buttons">
                <button type="button" data-editor-action="move-action-up" data-index="${index}" aria-label="Subir">Subir</button>
                <button type="button" data-editor-action="move-action-down" data-index="${index}" aria-label="Bajar">Bajar</button>
                <button type="button" data-editor-action="remove-action" data-index="${index}" aria-label="Eliminar">Eliminar</button>
              </div>
            </div>
            <div class="editor-grid">
              ${this._renderIconPickerField("Icono", `quick_actions.${index}.icon`, action.icon, {
                placeholder: "mdi:flash",
              })}
              ${this._renderTextField("Etiqueta", `quick_actions.${index}.label`, action.label, {
                placeholder: "Acción",
              })}
              ${this._renderSelectField(
                "Tipo de acción",
                `quick_actions.${index}.type`,
                actionType,
                [
                  { value: "toggle", label: "Alternar" },
                  { value: "more-info", label: "Más información" },
                  { value: "service", label: "Llamar servicio" },
                ],
              )}
              ${this._renderEntityPickerField("Entidad", `quick_actions.${index}.entity`, action.entity, {
                fullWidth: true,
              })}
              ${
                actionType === "service"
                  ? `
                    ${this._renderTextField("Servicio", `quick_actions.${index}.service`, action.service, {
                      placeholder: "light.turn_on",
                      fullWidth: true,
                    })}
                    ${this._renderTextareaField("Datos del servicio (JSON)", `quick_actions.${index}.service_data`, action.service_data, {
                      placeholder: '{"brightness_pct": 50}',
                    })}
                  `
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "selection";
    const tapAction = config.tap_action || "auto";

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

        .editor-grid--stacked {
          grid-template-columns: 1fr;
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

        .editor-color-field {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          min-height: 40px;
        }

        .editor-color-picker {
          align-items: center;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
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
        }

        .editor-color-picker:hover,
        .editor-color-picker:focus-within {
          border-color: rgba(255, 255, 255, 0.22);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .editor-color-swatch {
          --editor-swatch: #71c0ff;
          background:
            linear-gradient(var(--editor-swatch), var(--editor-swatch)),
            conic-gradient(from 90deg, rgba(255, 255, 255, 0.06) 25%, rgba(0, 0, 0, 0.12) 0 50%, rgba(255, 255, 255, 0.06) 0 75%, rgba(0, 0, 0, 0.12) 0);
          background-position: center;
          background-size: cover, 10px 10px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          display: block;
          height: 22px;
          width: 22px;
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

        .editor-section__actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 2px;
        }

        .editor-section__toggle-button {
          align-items: center;
          appearance: none;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          gap: 8px;
          min-height: 34px;
          padding: 0 12px;
        }

        .editor-section__toggle-button ha-icon {
          --mdc-icon-size: 16px;
        }

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }

        .editor-actions-toolbar {
          display: flex;
          justify-content: flex-start;
        }

        .editor-actions-toolbar button,
        .editor-action__buttons button {
          appearance: none;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          color: var(--primary-text-color);
          cursor: pointer;
          font: inherit;
          min-height: 34px;
          padding: 6px 10px;
        }

        .editor-action {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }

        .editor-action__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        .editor-action__title {
          font-size: 13px;
          font-weight: 700;
        }

        .editor-action__buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .editor-empty {
          color: var(--secondary-text-color);
          font-size: 13px;
        }

        @media (max-width: 640px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }

          .editor-toggle {
            padding-top: 0;
          }
        }
      
        :is(.editor-toggle, .editor-checkbox) {
          align-items: center;
          column-gap: 10px;
          cursor: pointer;
          grid-auto-flow: row;
          grid-template-columns: auto minmax(0, 1fr);
          justify-content: stretch;
          min-height: 40px;
          padding-top: 0;
          position: relative;
        }

        :is(.editor-toggle, .editor-checkbox) input {
          block-size: 1px;
          inline-size: 1px;
          margin: 0;
          opacity: 0;
          pointer-events: none;
          position: absolute;
        }

        .editor-toggle__switch {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
          display: inline-flex;
          font-size: 0;
          height: 22px;
          line-height: 0;
          position: relative;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
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

        .editor-toggle__label {
          min-width: 0;
        }

        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }

        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch::before {
          transform: translateX(18px);
        }

        :is(.editor-toggle, .editor-checkbox) input:focus-visible + .editor-toggle__switch {
          box-shadow:
            0 0 0 3px rgba(255, 255, 255, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
</style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">General</div>
            <div class="editor-section__hint">Entidad principal, nombre visible e icono base de la tarjeta.</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityPickerField("Entidad principal", "entity", config.entity, {
              fullWidth: true,
            })}
            ${this._renderIconPickerField("Icono", "icon", config.icon, {
              placeholder: "mdi:tune",
              fullWidth: true,
            })}
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Lámpara",
              fullWidth: true,
            })}
            ${this._renderCheckboxField("Usar el icono de la entidad", "use_entity_icon", config.use_entity_icon === true)}
            ${this._renderSelectField(
              "Acción al tocar",
              "tap_action",
              tapAction,
              [
                { value: "auto", label: "Automática (toggle o info)" },
                { value: "toggle", label: "Alternar" },
                { value: "more-info", label: "Más información" },
                { value: "url", label: "Abrir URL" },
                { value: "service", label: "Llamar servicio" },
                { value: "none", label: "Sin acción" },
              ],
              { fullWidth: true },
            )}
            ${
              tapAction === "service"
                ? `
                  ${this._renderTextField("Servicio", "tap_service", config.tap_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("Datos del servicio (JSON)", "tap_service_data", config.tap_service_data, {
                    placeholder: '{"brightness_pct": 70}',
                  })}
                `
                : ""
            }
            ${
              tapAction === "url"
                ? `
                  ${this._renderTextField("URL", "tap_url", config.tap_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("Abrir en pestaña nueva", "tap_new_tab", config.tap_new_tab === true)}
                `
                : ""
            }
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Contenido</div>
            <div class="editor-section__hint">Estado visible, chips adicionales, decimales de los valores y comportamiento en modo compacto.</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "Modo compacto",
              "compact_layout_mode",
              config.compact_layout_mode || "auto",
              [
                { value: "auto", label: "Automático (<4 columnas)" },
                { value: "always", label: "Compacto siempre" },
                { value: "never", label: "Nunca compacto" },
              ],
            )}
            ${this._renderCheckboxField("Mostrar estado", "show_state", config.show_state !== false)}
            ${this._renderTextField("Decimales en estado y chips", "number_decimals", config.number_decimals, {
              placeholder: "2",
              type: "number",
            })}
            ${this._renderTextField("Atributo chip principal", "primary_attribute", config.primary_attribute, {
              placeholder: "battery_level",
            })}
            ${this._renderTextField("Atributo chip secundario", "secondary_attribute", config.secondary_attribute, {
              placeholder: "temperature",
            })}
            ${this._renderCheckboxField("Mostrar chip principal", "show_primary_chip", config.show_primary_chip !== false)}
            ${this._renderCheckboxField("Mostrar chip secundario", "show_secondary_chip", config.show_secondary_chip !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Acciones rápidas</div>
            <div class="editor-section__hint">Botones secundarios con icono para alternar, abrir más información o llamar un servicio.</div>
            <div class="editor-section__actions">
              <button type="button" class="editor-section__toggle-button" data-editor-action="add-action">
                <ha-icon icon="mdi:plus"></ha-icon>
                <span>Añadir acción</span>
              </button>
            </div>
          </div>
          ${this._renderQuickActions(config)}
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Respuesta háptica</div>
            <div class="editor-section__hint">Respuesta táctil opcional al usar la tarjeta y sus acciones.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Activar respuesta háptica", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("Usar vibración si no hay háptica", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "Estilo",
              "haptics.style",
              hapticStyle,
              [
                { value: "selection", label: "Selección" },
                { value: "light", label: "Ligero" },
                { value: "medium", label: "Medio" },
                { value: "heavy", label: "Intenso" },
                { value: "success", label: "Éxito" },
                { value: "warning", label: "Aviso" },
                { value: "failure", label: "Fallo" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Estilos</div>
            <div class="editor-section__hint">Ajustes visuales principales de la tarjeta.</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${this._showStyleSection ? "Ocultar ajustes de estilo" : "Mostrar ajustes de estilo"}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("Fondo de la tarjeta", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("Borde de la tarjeta", "styles.card.border", config.styles.card.border)}
                  ${this._renderTextField("Radio del borde", "styles.card.border_radius", config.styles.card.border_radius)}
                  ${this._renderTextField("Sombra", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("Relleno interior", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("Separación interna", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderTextField("Tamaño botón principal", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderColorField("Fondo burbuja principal", "styles.icon.background", config.styles.icon.background, {
                    fallbackValue: "rgba(255, 255, 255, 0.06)",
                  })}
                  ${this._renderColorField("Color icono activo", "styles.icon.on_color", config.styles.icon.on_color, {
                    fallbackValue: "var(--info-color, #71c0ff)",
                  })}
                  ${this._renderColorField("Color icono inactivo", "styles.icon.off_color", config.styles.icon.off_color, {
                    fallbackValue: "var(--state-inactive-color, rgba(255, 255, 255, 0.5))",
                  })}
                  ${this._renderTextField("Tamaño botones auxiliares", "styles.control.size", config.styles.control.size)}
                  ${this._renderColorField("Fondo de acento", "styles.control.accent_background", config.styles.control.accent_background, {
                    fallbackValue: "rgba(113, 192, 255, 0.18)",
                  })}
                  ${this._renderColorField("Color de acento", "styles.control.accent_color", config.styles.control.accent_color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderTextField("Alto chips", "styles.chip_height", config.styles.chip_height)}
                  ${this._renderTextField("Texto chips", "styles.chip_font_size", config.styles.chip_font_size)}
                  ${this._renderTextField("Relleno chips", "styles.chip_padding", config.styles.chip_padding)}
                  ${this._renderTextField("Tamaño del título", "styles.title_size", config.styles.title_size)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="entity"]')
      .forEach(host => this._mountEntityPicker(host));

    this.shadowRoot
      .querySelectorAll("ha-icon-picker[data-field]")
      .forEach(control => {
        control.hass = this._hass;
        control.value = control.dataset.value || "";
        control.addEventListener("value-changed", this._onShadowValueChanged);
      });

    this._ensureEditorControlsReady();
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaEntityCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Entity Card",
  description: "Tarjeta todoterreno para entidades, información y botones rápidos.",
  preview: true,
});
