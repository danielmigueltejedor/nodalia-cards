const CARD_TAG = "nodalia-climate-card";
const EDITOR_TAG = "nodalia-climate-card-editor";
const CARD_VERSION = "0.10.0";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
const DIAL_START_ANGLE = 135;
const DIAL_END_ANGLE = 405;
const DIAL_SWEEP = DIAL_END_ANGLE - DIAL_START_ANGLE;
const DIAL_VIEWBOX_SIZE = 240;
const DIAL_CIRCLE_RADIUS = 86;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_CIRCLE_RADIUS;
const DIAL_VISIBLE_LENGTH = DIAL_CIRCUMFERENCE * (DIAL_SWEEP / 360);
const DIAL_HIDDEN_LENGTH = DIAL_CIRCUMFERENCE - DIAL_VISIBLE_LENGTH;

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  show_state_chip: true,
  show_current_temperature_chip: true,
  show_humidity_chip: true,
  show_mode_buttons: true,
  show_step_controls: true,
  show_unavailable_badge: true,
  haptics: {
    enabled: false,
    style: "selection",
    fallback_vibrate: false,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "30px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "16px",
      gap: "14px",
    },
    icon: {
      size: "58px",
      background: "rgba(255, 255, 255, 0.06)",
      color: "var(--primary-text-color)",
      on_color: "var(--primary-text-color)",
      off_color: "var(--state-inactive-color, rgba(255, 255, 255, 0.5))",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 10px",
    title_size: "16px",
    current_size: "16px",
    target_size: "50px",
    dial: {
      size: "280px",
      stroke: "18px",
      thumb_size: "24px",
      track_color: "rgba(255, 255, 255, 0.08)",
      background: "rgba(255, 255, 255, 0.02)",
      heat_color: "#f59f42",
      cool_color: "#71c0ff",
      dry_color: "#7fd0c8",
      auto_color: "#c5a66f",
      fan_color: "#83d39c",
      off_color: "rgba(255, 255, 255, 0.28)",
    },
    control: {
      size: "42px",
      accent_background: "rgba(113, 192, 255, 0.18)",
      accent_color: "var(--primary-text-color)",
    },
    step_control: {
      size: "50px",
    },
  },
};

const STUB_CONFIG = {
  entity: "climate.salon",
  name: "Salon",
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
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

function getStepPrecision(step) {
  const text = String(step ?? "");
  if (!text.includes(".")) {
    return 0;
  }

  return text.split(".")[1].length;
}

function formatTemperature(value, step = 0.5, withUnit = true) {
  if (!Number.isFinite(Number(value))) {
    return withUnit ? "-- °C" : "--";
  }

  const precision = Math.max(0, Math.min(getStepPrecision(step), 2));
  const formatted = Number(value).toLocaleString("es-ES", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });

  return withUnit ? `${formatted} °C` : formatted;
}

function getModeMeta(mode) {
  const normalized = normalizeTextKey(mode);

  switch (normalized) {
    case "off":
      return { label: "Apagado", icon: "mdi:power", accent: "off" };
    case "heat":
    case "heating":
      return { label: "Calor", icon: "mdi:fire", accent: "heat" };
    case "cool":
    case "cooling":
      return { label: "Frio", icon: "mdi:snowflake", accent: "cool" };
    case "heat_cool":
      return { label: "Auto", icon: "mdi:sun-snowflake-variant", accent: "auto" };
    case "auto":
      return { label: "Auto", icon: "mdi:autorenew", accent: "auto" };
    case "dry":
    case "drying":
      return { label: "Secado", icon: "mdi:water-percent", accent: "dry" };
    case "fan_only":
      return { label: "Ventilador", icon: "mdi:fan", accent: "fan" };
    default:
      return { label: String(mode ?? ""), icon: "mdi:thermostat", accent: "auto" };
  }
}

function getActionMeta(action) {
  const normalized = normalizeTextKey(action);

  switch (normalized) {
    case "heating":
      return { label: "Calentando", icon: "mdi:fire", accent: "heat" };
    case "cooling":
      return { label: "Enfriando", icon: "mdi:snowflake", accent: "cool" };
    case "drying":
      return { label: "Secando", icon: "mdi:water-percent", accent: "dry" };
    case "fan":
    case "fan_only":
      return { label: "Ventilando", icon: "mdi:fan", accent: "fan" };
    case "idle":
      return { label: "En espera", icon: "mdi:pause-circle-outline", accent: "off" };
    case "off":
      return { label: "Apagado", icon: "mdi:power", accent: "off" };
    default:
      return getModeMeta(action);
  }
}

function normalizeConfig(rawConfig) {
  return mergeConfig(DEFAULT_CONFIG, rawConfig || {});
}

function getDialValueFromPoint(dial, clientX, clientY, range, step) {
  const rect = dial.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return range.min;
  }

  const centerX = rect.left + (rect.width / 2);
  const centerY = rect.top + (rect.height / 2);
  const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
  let normalizedAngle = angle < 0 ? angle + 360 : angle;

  if (normalizedAngle < DIAL_START_ANGLE) {
    normalizedAngle += 360;
  }

  normalizedAngle = clamp(normalizedAngle, DIAL_START_ANGLE, DIAL_END_ANGLE);

  const ratio = (normalizedAngle - DIAL_START_ANGLE) / DIAL_SWEEP;
  const rawValue = range.min + ((range.max - range.min) * ratio);
  const safeStep = Number.isFinite(step) && step > 0 ? step : 0.5;
  const rounded = range.min + (Math.round((rawValue - range.min) / safeStep) * safeStep);

  return clamp(Number(rounded.toFixed(2)), range.min, range.max);
}

class NodaliaClimateCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig() {
    return deepClone(STUB_CONFIG);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._draftTemperature = new Map();
    this._draftResetTimer = 0;
    this._activeDialDrag = null;
    this._pendingRenderAfterDrag = false;
    this._lastRenderSignature = "";
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowPointerDown = this._onShadowPointerDown.bind(this);
    this._onShadowMouseDown = this._onShadowMouseDown.bind(this);
    this._onShadowTouchStart = this._onShadowTouchStart.bind(this);
    this._onWindowPointerMove = this._onWindowPointerMove.bind(this);
    this._onWindowPointerUp = this._onWindowPointerUp.bind(this);
    this._onWindowMouseMove = this._onWindowMouseMove.bind(this);
    this._onWindowMouseUp = this._onWindowMouseUp.bind(this);
    this._onWindowTouchStartCapture = this._onWindowTouchStartCapture.bind(this);
    this._onWindowTouchMove = this._onWindowTouchMove.bind(this);
    this._onWindowTouchEnd = this._onWindowTouchEnd.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown);
    this.shadowRoot.addEventListener("mousedown", this._onShadowMouseDown);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      this.shadowRoot.addEventListener("touchstart", this._onShadowTouchStart, { passive: false });
    }
  }

  connectedCallback() {
    window.addEventListener("pointermove", this._onWindowPointerMove);
    window.addEventListener("pointerup", this._onWindowPointerUp);
    window.addEventListener("pointercancel", this._onWindowPointerUp);
    window.addEventListener("mousemove", this._onWindowMouseMove);
    window.addEventListener("mouseup", this._onWindowMouseUp);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      window.addEventListener("touchstart", this._onWindowTouchStartCapture, { passive: true, capture: true });
      window.addEventListener("touchmove", this._onWindowTouchMove, { passive: false });
      window.addEventListener("touchend", this._onWindowTouchEnd, { passive: false });
      window.addEventListener("touchcancel", this._onWindowTouchEnd, { passive: false });
    }
  }

  disconnectedCallback() {
    window.removeEventListener("pointermove", this._onWindowPointerMove);
    window.removeEventListener("pointerup", this._onWindowPointerUp);
    window.removeEventListener("pointercancel", this._onWindowPointerUp);
    window.removeEventListener("mousemove", this._onWindowMouseMove);
    window.removeEventListener("mouseup", this._onWindowMouseUp);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      window.removeEventListener("touchstart", this._onWindowTouchStartCapture, true);
      window.removeEventListener("touchmove", this._onWindowTouchMove);
      window.removeEventListener("touchend", this._onWindowTouchEnd);
      window.removeEventListener("touchcancel", this._onWindowTouchEnd);
    }

    if (this._draftResetTimer) {
      window.clearTimeout(this._draftResetTimer);
      this._draftResetTimer = 0;
    }
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._lastRenderSignature = "";
    this._render();
  }

  set hass(hass) {
    const nextSignature = this._getRenderSignature(hass);
    this._hass = hass;
    this._syncDraftWithState();

    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }

    this._lastRenderSignature = nextSignature;

    if (this._activeDialDrag) {
      this._pendingRenderAfterDrag = true;
      return;
    }

    this._render();
  }

  getCardSize() {
    return 4;
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const attrs = state?.attributes || {};
    return JSON.stringify({
      entityId,
      state: String(state?.state || ""),
      friendlyName: String(attrs.friendly_name || ""),
      icon: String(attrs.icon || ""),
      temperature: Number(attrs.temperature ?? -1),
      currentTemperature: Number(attrs.current_temperature ?? -1),
      targetTempHigh: Number(attrs.target_temp_high ?? -1),
      targetTempLow: Number(attrs.target_temp_low ?? -1),
      humidity: Number(attrs.humidity ?? -1),
      currentHumidity: Number(attrs.current_humidity ?? -1),
      hvacMode: String(attrs.hvac_mode || ""),
      hvacAction: String(attrs.hvac_action || ""),
      presetMode: String(attrs.preset_mode || ""),
      fanMode: String(attrs.fan_mode || ""),
      swingMode: String(attrs.swing_mode || ""),
    });
  }

  getGridOptions() {
    return {
      rows: 5,
      columns: 8,
      min_rows: 5,
      min_columns: 7,
    };
  }

  _getConfiguredGridRows() {
    const numericRows = Number(this._config?.grid_options?.rows);
    return Number.isFinite(numericRows) ? numericRows : null;
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) ? numericColumns : null;
  }

  _getCompactLevel() {
    const configuredRows = this._getConfiguredGridRows();
    const configuredColumns = this._getConfiguredGridColumns();

    if (
      (configuredRows !== null && configuredRows <= 3)
      || (configuredColumns !== null && configuredColumns <= 4)
    ) {
      return "tight";
    }

    if (
      (configuredRows !== null && configuredRows <= 4)
      || (configuredColumns !== null && configuredColumns <= 6)
    ) {
      return "compact";
    }

    return "default";
  }

  _getState() {
    return this._config?.entity ? this._hass?.states?.[this._config.entity] || null : null;
  }

  _syncDraftWithState() {
    const state = this._getState();
    const entityId = this._config?.entity;
    if (!entityId || !state || !this._draftTemperature.has(entityId)) {
      return;
    }

    const actualTemperature = Number(state.attributes?.temperature);
    const draftTemperature = Number(this._draftTemperature.get(entityId));
    const step = this._getTemperatureStep(state);

    if (Number.isFinite(actualTemperature) && Math.abs(actualTemperature - draftTemperature) <= Math.max(step, 0.5)) {
      this._draftTemperature.delete(entityId);
    }
  }

  _getClimateName(state) {
    return this._config?.name
      || state?.attributes?.friendly_name
      || this._config?.entity
      || "Clima";
  }

  _getClimateIcon(state) {
    return this._config?.icon
      || state?.attributes?.icon
      || "mdi:thermostat";
  }

  _getTemperatureRange(state) {
    const min = Number(state?.attributes?.min_temp);
    const max = Number(state?.attributes?.max_temp);

    if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
      return {
        min,
        max,
      };
    }

    return {
      min: 10,
      max: 30,
    };
  }

  _getTemperatureStep(state) {
    const step = Number(state?.attributes?.target_temp_step);
    return Number.isFinite(step) && step > 0 ? step : 0.5;
  }

  _supportsTargetTemperature(state) {
    return (
      Number.isFinite(Number(state?.attributes?.temperature)) ||
      (
        Number.isFinite(Number(state?.attributes?.min_temp)) &&
        Number.isFinite(Number(state?.attributes?.max_temp))
      )
    );
  }

  _getTargetTemperature(state) {
    const entityId = this._config?.entity;
    if (entityId && this._draftTemperature.has(entityId)) {
      return Number(this._draftTemperature.get(entityId));
    }

    const direct = Number(state?.attributes?.temperature);
    if (Number.isFinite(direct)) {
      return direct;
    }

    const high = Number(state?.attributes?.target_temp_high);
    const low = Number(state?.attributes?.target_temp_low);
    if (Number.isFinite(high) && Number.isFinite(low)) {
      return Number(((high + low) / 2).toFixed(1));
    }

    const range = this._getTemperatureRange(state);
    return Number((((range.min + range.max) / 2)).toFixed(1));
  }

  _getCurrentTemperature(state) {
    const current = Number(state?.attributes?.current_temperature);
    return Number.isFinite(current) ? current : null;
  }

  _getCurrentHumidity(state) {
    const humidity = Number(state?.attributes?.current_humidity);
    return Number.isFinite(humidity) ? humidity : null;
  }

  _getCurrentMode(state) {
    return String(state?.state || state?.attributes?.hvac_mode || "").trim();
  }

  _getCurrentAction(state) {
    return String(state?.attributes?.hvac_action || "").trim();
  }

  _getOrderedModeOptions(state) {
    const rawModes = Array.isArray(state?.attributes?.hvac_modes)
      ? state.attributes.hvac_modes.map(item => String(item || "").trim()).filter(Boolean)
      : [];
    const uniqueModes = [...new Set(rawModes)];
    const preferredOrder = ["heat", "cool", "heat_cool", "auto", "dry", "fan_only"];

    return uniqueModes
      .filter(mode => normalizeTextKey(mode) !== "off")
      .sort((left, right) => {
        const leftIndex = preferredOrder.indexOf(normalizeTextKey(left));
        const rightIndex = preferredOrder.indexOf(normalizeTextKey(right));
        const safeLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
        const safeRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
        return safeLeft - safeRight || left.localeCompare(right, "es");
      });
  }

  _getPreferredOnMode(state) {
    const allModes = Array.isArray(state?.attributes?.hvac_modes)
      ? state.attributes.hvac_modes.map(item => String(item || "").trim()).filter(Boolean)
      : [];
    const modeSet = new Set(allModes.map(mode => normalizeTextKey(mode)));

    if (modeSet.has("heat_cool")) {
      return "heat_cool";
    }
    if (modeSet.has("heat")) {
      return "heat";
    }
    if (modeSet.has("cool")) {
      return "cool";
    }
    if (modeSet.has("auto")) {
      return "auto";
    }
    if (modeSet.has("dry")) {
      return "dry";
    }
    if (modeSet.has("fan_only")) {
      return "fan_only";
    }

    return allModes.find(mode => normalizeTextKey(mode) !== "off") || "heat";
  }

  _isOff(state) {
    return normalizeTextKey(this._getCurrentMode(state)) === "off";
  }

  _getStateLabel(state) {
    const action = this._getCurrentAction(state);
    if (action) {
      return getActionMeta(action).label;
    }

    return getModeMeta(this._getCurrentMode(state)).label;
  }

  _getAccentColor(state) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const dialStyles = styles.dial || DEFAULT_CONFIG.styles.dial;
    const action = this._getCurrentAction(state);
    const mode = action || this._getCurrentMode(state);
    const accentKey = getModeMeta(mode).accent;

    switch (accentKey) {
      case "heat":
        return dialStyles.heat_color;
      case "cool":
        return dialStyles.cool_color;
      case "dry":
        return dialStyles.dry_color;
      case "fan":
        return dialStyles.fan_color;
      case "auto":
        return dialStyles.auto_color;
      default:
        return dialStyles.off_color;
    }
  }

  _setClimateService(service, data = {}) {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    this._hass.callService("climate", service, {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _setHvacMode(mode) {
    if (!mode) {
      return;
    }

    this._setClimateService("set_hvac_mode", {
      hvac_mode: mode,
    });
  }

  _toggleClimate(state) {
    if (this._isOff(state) || isUnavailableState(state)) {
      this._setHvacMode(this._getPreferredOnMode(state));
      return;
    }

    this._setHvacMode("off");
  }

  _commitTemperature(value) {
    const state = this._getState();
    if (!state || !this._supportsTargetTemperature(state)) {
      return;
    }

    const range = this._getTemperatureRange(state);
    const step = this._getTemperatureStep(state);
    const nextValue = clamp(Number(value), range.min, range.max);
    const rounded = range.min + (Math.round((nextValue - range.min) / step) * step);
    this._setClimateService("set_temperature", {
      temperature: Number(rounded.toFixed(Math.max(1, getStepPrecision(step)))),
    });
    this._scheduleDraftReset();
  }

  _scheduleDraftReset() {
    if (this._draftResetTimer) {
      window.clearTimeout(this._draftResetTimer);
    }

    this._draftResetTimer = window.setTimeout(() => {
      if (this._config?.entity) {
        this._draftTemperature.delete(this._config.entity);
      }
      this._draftResetTimer = 0;
      this._render();
    }, 2200);
  }

  _changeTemperatureBy(delta) {
    const state = this._getState();
    if (!state || !this._supportsTargetTemperature(state)) {
      return;
    }

    const step = this._getTemperatureStep(state);
    const current = this._getTargetTemperature(state);
    const next = Number(current) + (Number(delta) * step);
    this._draftTemperature.set(this._config.entity, next);
    this._render();
    this._triggerHaptic("selection");
    this._commitTemperature(next);
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

  _updateDialPreview(value) {
    const state = this._getState();
    const dial = this.shadowRoot?.querySelector(".climate-card__dial");
    const targetValue = this.shadowRoot?.querySelector('[data-climate-readout="target"]');

    if (!state || !(dial instanceof HTMLElement)) {
      return;
    }

    const range = this._getTemperatureRange(state);
    const step = this._getTemperatureStep(state);
    const nextValue = clamp(Number(value), range.min, range.max);
    const ratio = (nextValue - range.min) / Math.max(range.max - range.min, step);
    const angle = DIAL_START_ANGLE + (ratio * DIAL_SWEEP);
    const progressLength = Number((DIAL_VISIBLE_LENGTH * clamp(ratio, 0, 1)).toFixed(3));

    dial.style.setProperty("--climate-angle", `${angle}deg`);
    dial.style.setProperty("--climate-progress-length", `${progressLength}`);

    if (targetValue instanceof HTMLElement) {
      targetValue.textContent = formatTemperature(nextValue, step, false);
    }
  }

  _applyDialValue(value, options = {}) {
    const state = this._getState();
    if (!state || !this._supportsTargetTemperature(state)) {
      return;
    }

    const range = this._getTemperatureRange(state);
    const step = this._getTemperatureStep(state);
    const nextValue = clamp(Number(value), range.min, range.max);
    const rounded = range.min + (Math.round((nextValue - range.min) / step) * step);
    this._draftTemperature.set(this._config.entity, Number(rounded.toFixed(Math.max(1, getStepPrecision(step)))));
    this._updateDialPreview(rounded);

    if (options.commit === true) {
      this._triggerHaptic("selection");
      this._commitTemperature(rounded);
    }
  }

  _startDialDrag(dial, clientX, clientY, event = null, pointerId = null) {
    if (!(dial instanceof HTMLElement)) {
      return;
    }

    this._activeDialDrag = {
      dial,
      pointerId,
    };

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const state = this._getState();
    if (!state) {
      return;
    }

    const nextValue = getDialValueFromPoint(
      dial,
      clientX,
      clientY,
      this._getTemperatureRange(state),
      this._getTemperatureStep(state),
    );
    this._applyDialValue(nextValue, { commit: false });
  }

  _moveDialDrag(clientX, clientY, event = null) {
    const drag = this._activeDialDrag;
    const state = this._getState();

    if (!drag || !state) {
      return;
    }

    if (event) {
      event.preventDefault();
    }

    const nextValue = getDialValueFromPoint(
      drag.dial,
      clientX,
      clientY,
      this._getTemperatureRange(state),
      this._getTemperatureStep(state),
    );
    this._applyDialValue(nextValue, { commit: false });
  }

  _commitDialDrag(clientX, clientY, event = null, pointerId = null) {
    const drag = this._activeDialDrag;
    const state = this._getState();

    if (!drag || !state) {
      return;
    }

    if (event) {
      event.preventDefault();
    }

    const nextValue = getDialValueFromPoint(
      drag.dial,
      clientX,
      clientY,
      this._getTemperatureRange(state),
      this._getTemperatureStep(state),
    );
    this._applyDialValue(nextValue, { commit: true });

    this._activeDialDrag = null;

    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _onShadowPointerDown(event) {
    const path = event.composedPath();
    const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.climateAction);
    if (actionButton) {
      return;
    }

    const dialHandle = path.find(
      node => node instanceof Element && node.dataset?.climateControl === "dial-hit",
    );
    const dial = dialHandle
      ? path.find(node => node instanceof HTMLElement && node.classList?.contains("climate-card__dial"))
      : null;

    if (
      this._activeDialDrag ||
      !dial ||
      (typeof event.button === "number" && event.button !== 0)
    ) {
      return;
    }

    this._startDialDrag(dial, event.clientX, event.clientY, event, event.pointerId);
  }

  _onShadowMouseDown(event) {
    const path = event.composedPath();
    const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.climateAction);
    if (actionButton) {
      return;
    }

    const dialHandle = path.find(
      node => node instanceof Element && node.dataset?.climateControl === "dial-hit",
    );
    const dial = dialHandle
      ? path.find(node => node instanceof HTMLElement && node.classList?.contains("climate-card__dial"))
      : null;

    if (this._activeDialDrag || !dial || event.button !== 0) {
      return;
    }

    this._startDialDrag(dial, event.clientX, event.clientY, event);
  }

  _onShadowTouchStart(event) {
    const path = event.composedPath();
    const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.climateAction);
    if (actionButton) {
      return;
    }

    const dialHandle = path.find(
      node => node instanceof Element && node.dataset?.climateControl === "dial-hit",
    );
    const dial = dialHandle
      ? path.find(node => node instanceof HTMLElement && node.classList?.contains("climate-card__dial"))
      : null;

    if (this._activeDialDrag || !dial || !event.touches?.length) {
      return;
    }

    this._startDialDrag(dial, event.touches[0].clientX, event.touches[0].clientY, event);
  }

  _onWindowPointerMove(event) {
    const drag = this._activeDialDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    this._moveDialDrag(event.clientX, event.clientY, event);
  }

  _onWindowPointerUp(event) {
    const drag = this._activeDialDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    this._commitDialDrag(event.clientX, event.clientY, event, event.pointerId);
  }

  _onWindowMouseMove(event) {
    if (!this._activeDialDrag || (typeof event.buttons === "number" && (event.buttons & 1) === 0)) {
      return;
    }

    this._moveDialDrag(event.clientX, event.clientY, event);
  }

  _onWindowMouseUp(event) {
    if (!this._activeDialDrag) {
      return;
    }

    this._commitDialDrag(event.clientX, event.clientY, event);
  }

  _onWindowTouchMove(event) {
    if (!this._activeDialDrag || !event.touches?.length) {
      return;
    }

    this._moveDialDrag(event.touches[0].clientX, event.touches[0].clientY, event);
  }

  _onWindowTouchStartCapture(event) {
    const drag = this._activeDialDrag;
    if (!drag) {
      return;
    }

    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (path.includes(drag.dial)) {
      return;
    }

    this._activeDialDrag = null;

    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _onWindowTouchEnd(event) {
    if (!this._activeDialDrag) {
      return;
    }

    const touch = event.changedTouches?.[0];
    if (!touch) {
      this._activeDialDrag = null;
      if (this._pendingRenderAfterDrag) {
        this._pendingRenderAfterDrag = false;
        this._render();
      }
      return;
    }

    this._commitDialDrag(touch.clientX, touch.clientY, event);
  }

  _onShadowClick(event) {
    const path = event.composedPath();
    const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.climateAction);
    if (!actionButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const state = this._getState();
    if (!state) {
      return;
    }

    switch (actionButton.dataset.climateAction) {
      case "toggle":
        this._triggerHaptic();
        this._toggleClimate(state);
        break;
      case "decrease":
        this._changeTemperatureBy(-1);
        break;
      case "increase":
        this._changeTemperatureBy(1);
        break;
      case "mode":
        if (actionButton.dataset.mode) {
          this._triggerHaptic();
          this._setHvacMode(actionButton.dataset.mode);
        }
        break;
      default:
        break;
    }
  }

  _renderEmptyState() {
    return `
      <ha-card class="climate-card climate-card--empty">
        <div class="climate-card__empty-title">Nodalia Climate Card</div>
        <div class="climate-card__empty-text">Configura \`entity\` con una entidad \`climate.*\` para mostrar la tarjeta.</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const state = this._getState();

    if (!state) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
          }

          * {
            box-sizing: border-box;
          }

          .climate-card--empty {
            background: ${styles.card.background};
            border: ${styles.card.border};
            border-radius: ${styles.card.border_radius};
            box-shadow: ${styles.card.box_shadow};
            display: grid;
            gap: 6px;
            padding: ${styles.card.padding};
          }

          .climate-card__empty-title {
            color: var(--primary-text-color);
            font-size: 15px;
            font-weight: 700;
          }

          .climate-card__empty-text {
            color: var(--secondary-text-color);
            font-size: 13px;
            line-height: 1.5;
          }
        </style>
        ${this._renderEmptyState()}
      `;
      return;
    }

    const title = this._getClimateName(state);
    const icon = this._getClimateIcon(state);
    const accentColor = this._getAccentColor(state);
    const currentMode = this._getCurrentMode(state);
    const currentTemperature = this._getCurrentTemperature(state);
    const currentHumidity = this._getCurrentHumidity(state);
    const targetTemperature = this._getTargetTemperature(state);
    const temperatureRange = this._getTemperatureRange(state);
    const temperatureStep = this._getTemperatureStep(state);
    const supportsTargetTemperature = this._supportsTargetTemperature(state);
    const compactLevel = this._getCompactLevel();
    const compactLayout = compactLevel !== "default";
    const tightLayout = compactLevel === "tight";
    const modeOptions = config.show_mode_buttons !== false ? this._getOrderedModeOptions(state) : [];
    const showUnavailableBadge = config.show_unavailable_badge !== false && isUnavailableState(state);
    const isOff = this._isOff(state) || isUnavailableState(state);
    const cardPaddingY = tightLayout ? 12 : compactLayout ? 14 : parseSizeToPixels(styles.card.padding, 16);
    const cardPaddingX = tightLayout ? 12 : compactLayout ? 14 : parseSizeToPixels(styles.card.padding, 16);
    const effectiveCardPadding = `${cardPaddingY}px ${cardPaddingX}px`;
    const effectiveCardGap = tightLayout ? "10px" : compactLayout ? "12px" : styles.card.gap;
    const effectiveIconSizePx = Math.max(
      48,
      Math.min(parseSizeToPixels(styles.icon.size, 58), tightLayout ? 50 : compactLayout ? 54 : 58),
    );
    const effectiveIconSize = `${effectiveIconSizePx}px`;
    const effectiveTitleSize = `${Math.max(
      14,
      Math.min(parseSizeToPixels(styles.title_size, 16), tightLayout ? 15 : compactLayout ? 15.5 : 16),
    )}px`;
    const effectiveCurrentSize = `${Math.max(
      14,
      Math.min(parseSizeToPixels(styles.current_size, 16), tightLayout ? 15 : compactLayout ? 15.5 : 16),
    )}px`;
    const effectiveTargetSize = `${Math.max(
      42,
      Math.min(parseSizeToPixels(styles.target_size, 50), tightLayout ? 44 : compactLayout ? 46 : 50),
    )}px`;
    const effectiveChipHeight = `${Math.max(
      21,
      Math.min(parseSizeToPixels(styles.chip_height, 24), tightLayout ? 22 : compactLayout ? 23 : 24),
    )}px`;
    const effectiveChipFontSize = `${Math.max(
      10,
      Math.min(parseSizeToPixels(styles.chip_font_size, 11), tightLayout ? 10 : compactLayout ? 10.5 : 11),
    )}px`;
    const effectiveChipPadding = tightLayout ? "0 9px" : compactLayout ? "0 10px" : styles.chip_padding;
    const dialSizePx = Math.max(
      220,
      Math.min(parseSizeToPixels(styles.dial.size, 280), tightLayout ? 236 : compactLayout ? 252 : 280),
    );
    const dialStrokePx = Math.max(
      15,
      Math.min(parseSizeToPixels(styles.dial.stroke, 18), tightLayout ? 16 : compactLayout ? 17 : 18),
    );
    const thumbSizePx = Math.max(
      20,
      Math.min(parseSizeToPixels(styles.dial.thumb_size, 24), tightLayout ? 21 : compactLayout ? 22 : 24),
    );
    const dialRadiusPx = Number(((DIAL_CIRCLE_RADIUS * dialSizePx) / DIAL_VIEWBOX_SIZE).toFixed(3));
    const stepControlSize = Math.max(
      40,
      Math.min(parseSizeToPixels(styles.step_control.size, 50), tightLayout ? 42 : compactLayout ? 46 : 50),
    );
    const modeControlSize = Math.max(
      32,
      Math.min(parseSizeToPixels(styles.control.size, 42) - 4, tightLayout ? 34 : compactLayout ? 36 : 38),
    );
    const ratio = supportsTargetTemperature
      ? (targetTemperature - temperatureRange.min) / Math.max(temperatureRange.max - temperatureRange.min, temperatureStep)
      : 0;
    const dialAngle = DIAL_START_ANGLE + (clamp(ratio, 0, 1) * DIAL_SWEEP);
    const progressLength = Number((DIAL_VISIBLE_LENGTH * clamp(ratio, 0, 1)).toFixed(3));
    const chips = [];
    const currentRatio = currentTemperature !== null
      ? clamp(
        (currentTemperature - temperatureRange.min) / Math.max(temperatureRange.max - temperatureRange.min, temperatureStep),
        0,
        1,
      )
      : null;
    const currentAngle = currentRatio === null
      ? null
      : DIAL_START_ANGLE + (currentRatio * DIAL_SWEEP);

    if (config.show_state_chip !== false) {
      chips.push(`<div class="climate-card__chip climate-card__chip--state">${escapeHtml(this._getStateLabel(state))}</div>`);
    }

    if (config.show_current_temperature_chip !== false && currentTemperature !== null) {
      chips.push(`<div class="climate-card__chip">${escapeHtml(formatTemperature(currentTemperature, temperatureStep, true))}</div>`);
    }

    if (config.show_humidity_chip !== false && currentHumidity !== null) {
      chips.push(`<div class="climate-card__chip">${escapeHtml(`${Math.round(currentHumidity)}%`)}</div>`);
    }

    const currentActionMeta = getActionMeta(this._getCurrentAction(state) || currentMode);
    const cardBackground = isOff
      ? styles.card.background
      : `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 11%, rgba(255, 255, 255, 0.02)) 0%, ${styles.card.background} 100%)`;
    const cardBorder = isOff
      ? styles.card.border
      : `1px solid color-mix(in srgb, ${accentColor} 26%, var(--divider-color))`;
    const cardShadow = isOff
      ? styles.card.box_shadow
      : `${styles.card.box_shadow}, 0 18px 36px color-mix(in srgb, ${accentColor} 10%, rgba(0, 0, 0, 0.16))`;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          min-height: 0;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }

        .climate-card {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${accentColor} 18%, transparent) 0%, transparent 48%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.018) 0%, rgba(0, 0, 0, 0.02) 100%),
            ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
        }

        .climate-card__content {
          display: flex;
          flex-direction: column;
          gap: ${effectiveCardGap};
          height: 100%;
          min-height: 0;
          padding: ${effectiveCardPadding};
        }

        .climate-card__hero {
          align-items: center;
          display: grid;
          gap: ${effectiveCardGap};
          grid-template-columns: ${effectiveIconSize} minmax(0, 1fr);
          min-height: 0;
          width: 100%;
        }

        .climate-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.06), transparent 60%),
            ${styles.icon.background};
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: calc(${styles.icon.size} * 0.5);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 10px 26px rgba(0, 0, 0, 0.16);
          color: ${isOff ? styles.icon.off_color : styles.icon.on_color};
          cursor: pointer;
          display: inline-flex;
          height: ${effectiveIconSize};
          justify-content: center;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          width: ${effectiveIconSize};
        }

        .climate-card__icon ha-icon {
          --mdc-icon-size: calc(${effectiveIconSize} * 0.44);
          display: inline-flex;
          height: calc(${effectiveIconSize} * 0.44);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${effectiveIconSize} * 0.44);
        }

        .climate-card__unavailable-badge {
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

        .climate-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .climate-card__copy {
          display: grid;
          gap: ${tightLayout ? "8px" : "10px"};
          min-width: 0;
        }

        .climate-card__headline {
          align-items: start;
          display: grid;
          gap: ${tightLayout ? "8px" : "10px"};
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .climate-card__title {
          color: var(--primary-text-color);
          font-size: ${effectiveTitleSize};
          font-weight: 700;
          line-height: 1.14;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .climate-card__chips {
          align-items: center;
          display: flex;
          flex: 0 0 auto;
          flex-wrap: wrap;
          gap: ${tightLayout ? "8px" : "10px"};
          justify-content: flex-end;
          min-width: 0;
          max-width: 100%;
        }

        .climate-card__chip {
          align-items: center;
          backdrop-filter: blur(18px);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: ${effectiveChipFontSize};
          font-weight: 700;
          height: ${effectiveChipHeight};
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding: ${effectiveChipPadding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .climate-card__chip--state {
          color: var(--primary-text-color);
        }

        .climate-card__dial-wrap {
          align-items: center;
          display: flex;
          flex: 1 1 auto;
          justify-content: center;
          min-height: 0;
          padding-top: ${tightLayout ? "0" : "2px"};
        }

        .climate-card__dial {
          --climate-angle: ${dialAngle}deg;
          --climate-progress-length: ${progressLength};
          --climate-dial-size: ${dialSizePx}px;
          --climate-dial-radius: ${dialRadiusPx}px;
          --climate-thumb-size: ${thumbSizePx}px;
          background: ${styles.dial.background};
          border-radius: 50%;
          cursor: ${supportsTargetTemperature ? "grab" : "default"};
          height: var(--climate-dial-size);
          position: relative;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          width: var(--climate-dial-size);
        }

        .climate-card__dial:active {
          cursor: ${supportsTargetTemperature ? "grabbing" : "default"};
        }

        .climate-card__dial-svg {
          display: block;
          height: 100%;
          overflow: visible;
          width: 100%;
        }

        .climate-card__dial-track,
        .climate-card__dial-hit,
        .climate-card__dial-progress {
          fill: none;
          stroke-dasharray: ${DIAL_VISIBLE_LENGTH} ${DIAL_HIDDEN_LENGTH};
          stroke-linecap: round;
          stroke-width: ${dialStrokePx};
          transform: rotate(${DIAL_START_ANGLE}deg);
          transform-origin: ${DIAL_VIEWBOX_SIZE / 2}px ${DIAL_VIEWBOX_SIZE / 2}px;
        }

        .climate-card__dial-track {
          stroke: ${styles.dial.track_color};
        }

        .climate-card__dial-hit {
          cursor: ${supportsTargetTemperature ? "grab" : "default"};
          pointer-events: stroke;
          stroke: transparent;
          stroke-width: ${dialStrokePx + 22};
        }

        .climate-card__dial-progress {
          stroke: ${accentColor};
          stroke-dasharray: var(--climate-progress-length) ${DIAL_CIRCUMFERENCE};
          transition: stroke-dasharray 140ms ease-out;
        }

        .climate-card__dial-thumb {
          background: #f5f7fb;
          border: 4px solid color-mix(in srgb, ${accentColor} 18%, rgba(255, 255, 255, 0.72));
          border-radius: 50%;
          box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.12);
          height: var(--climate-thumb-size);
          left: 50%;
          pointer-events: auto;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%) rotate(calc(var(--climate-angle) + 90deg)) translateY(calc(-1 * var(--climate-dial-radius)));
          width: var(--climate-thumb-size);
          z-index: 2;
        }

        .climate-card__dial-current-marker {
          background: rgba(255, 255, 255, 0.94);
          border: 3px solid rgba(255, 255, 255, 0.12);
          border-radius: 50%;
          box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.08);
          height: calc(var(--climate-thumb-size) * 0.58);
          left: 50%;
          opacity: ${currentAngle === null ? "0" : "1"};
          pointer-events: none;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%) rotate(calc(var(--climate-current-angle, 0deg) + 90deg)) translateY(calc(-1 * var(--climate-dial-radius)));
          width: calc(var(--climate-thumb-size) * 0.58);
          z-index: 1;
        }

        .climate-card__dial-center {
          align-content: center;
          display: grid;
          gap: ${tightLayout ? "10px" : compactLayout ? "11px" : "12px"};
          inset: ${tightLayout ? "23% 15% 17% 15%" : compactLayout ? "23% 15.5% 17.5% 15.5%" : "23% 16% 18% 16%"};
          justify-items: center;
          pointer-events: auto;
          position: absolute;
          text-align: center;
        }

        .climate-card__target {
          color: var(--primary-text-color);
          display: inline-block;
          font-size: ${effectiveTargetSize};
          font-weight: 500;
          letter-spacing: -0.06em;
          line-height: 0.94;
          min-height: calc(${effectiveTargetSize} * 0.94);
          min-width: 0;
          padding-right: calc(${effectiveTargetSize} * 0.34);
          pointer-events: none;
          position: relative;
          white-space: nowrap;
        }

        .climate-card__target-value {
          display: inline-block;
        }

        .climate-card__target-unit {
          color: var(--primary-text-color);
          font-size: calc(${effectiveTargetSize} * 0.24);
          font-weight: 500;
          line-height: 1;
          opacity: 0.92;
          position: absolute;
          right: 0;
          top: 0.16em;
        }

        .climate-card__divider {
          background: rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          height: 1px;
          pointer-events: none;
          width: 100%;
        }

        .climate-card__dial-meta {
          align-items: center;
          color: var(--secondary-text-color);
          display: flex;
          flex-wrap: wrap;
          font-size: ${effectiveCurrentSize};
          gap: ${tightLayout ? "10px" : "12px"};
          justify-content: center;
          line-height: 1;
          pointer-events: none;
        }

        .climate-card__dial-action {
          align-items: center;
          display: inline-flex;
          justify-content: center;
        }

        .climate-card__dial-action ha-icon {
          --mdc-icon-size: ${tightLayout ? "15px" : compactLayout ? "16px" : "17px"};
          color: ${accentColor};
          display: inline-flex;
          height: ${tightLayout ? "15px" : compactLayout ? "16px" : "17px"};
          width: ${tightLayout ? "15px" : compactLayout ? "16px" : "17px"};
        }

        .climate-card__dial-controls {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: ${tightLayout ? "8px" : "10px"};
          justify-content: center;
          margin-top: 2px;
          pointer-events: auto;
          width: 100%;
        }

        .climate-card__mode-button,
        .climate-card__step-button {
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
          justify-content: center;
          margin: 0;
          outline: none;
          padding: 0;
          pointer-events: auto;
          position: relative;
          transition:
            background 160ms ease,
            border-color 160ms ease,
            transform 160ms ease,
            box-shadow 160ms ease;
        }

        .climate-card__mode-button {
          backdrop-filter: blur(18px);
          background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.06), transparent 60%),
            rgba(255, 255, 255, 0.04);
          height: ${modeControlSize}px;
          width: ${modeControlSize}px;
        }

        .climate-card__mode-button:hover,
        .climate-card__step-button:hover {
          transform: translateY(-1px);
        }

        .climate-card__mode-button--power {
          border-color: color-mix(in srgb, ${accentColor} 32%, rgba(255, 255, 255, 0.1));
        }

        .climate-card__mode-button.is-active {
          background: color-mix(in srgb, ${accentColor} 18%, ${styles.control.accent_background});
          border-color: color-mix(in srgb, ${accentColor} 48%, rgba(255, 255, 255, 0.12));
          color: ${styles.control.accent_color};
        }

        .climate-card__mode-button ha-icon {
          --mdc-icon-size: calc(${modeControlSize}px * 0.46);
          display: inline-flex;
          height: calc(${modeControlSize}px * 0.46);
          width: calc(${modeControlSize}px * 0.46);
        }

        .climate-card__steps {
          display: flex;
          gap: ${tightLayout ? "10px" : compactLayout ? "12px" : "14px"};
          justify-content: center;
        }

        .climate-card__step-button {
          backdrop-filter: blur(18px);
          background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.05), transparent 60%),
            rgba(255, 255, 255, 0.04);
          color: var(--primary-text-color);
          font-size: calc(${stepControlSize}px * 0.8);
          height: ${stepControlSize}px;
          line-height: 1;
          width: ${stepControlSize}px;
        }

        .climate-card__step-button span {
          align-items: center;
          display: inline-flex;
          justify-content: center;
        }

        @media (max-width: 560px) {
          .climate-card__headline {
            grid-template-columns: minmax(0, 1fr);
          }

          .climate-card__chips {
            justify-content: flex-start;
          }

          .climate-card__dial {
            --climate-dial-size: min(${dialSizePx}px, 100%);
          }
        }
      </style>
      <ha-card class="climate-card climate-card--${escapeHtml(compactLevel)}" style="--accent-color:${escapeHtml(accentColor)};">
        <div class="climate-card__content">
          <div class="climate-card__hero">
            <button
              type="button"
              class="climate-card__icon"
              data-climate-action="toggle"
              aria-label="Encender o apagar"
            >
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
              ${showUnavailableBadge ? `<span class="climate-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            <div class="climate-card__copy">
              <div class="climate-card__headline">
                <div class="climate-card__title">${escapeHtml(title)}</div>
                ${chips.length ? `<div class="climate-card__chips">${chips.join("")}</div>` : ""}
              </div>
            </div>
          </div>

          <div class="climate-card__dial-wrap">
            <div
              class="climate-card__dial"
              data-climate-control="dial"
              role="slider"
              aria-label="Temperatura objetivo"
              aria-valuemin="${temperatureRange.min}"
              aria-valuemax="${temperatureRange.max}"
              aria-valuenow="${Number.isFinite(targetTemperature) ? targetTemperature : temperatureRange.min}"
              style="${currentAngle === null ? "" : `--climate-current-angle:${currentAngle}deg;`}"
            >
              <svg class="climate-card__dial-svg" viewBox="0 0 ${DIAL_VIEWBOX_SIZE} ${DIAL_VIEWBOX_SIZE}" aria-hidden="true">
                <circle
                  class="climate-card__dial-track"
                  cx="${DIAL_VIEWBOX_SIZE / 2}"
                  cy="${DIAL_VIEWBOX_SIZE / 2}"
                  r="${DIAL_CIRCLE_RADIUS}"
                ></circle>
                <circle
                  class="climate-card__dial-hit"
                  data-climate-control="dial-hit"
                  cx="${DIAL_VIEWBOX_SIZE / 2}"
                  cy="${DIAL_VIEWBOX_SIZE / 2}"
                  r="${DIAL_CIRCLE_RADIUS}"
                ></circle>
                <circle
                  class="climate-card__dial-progress"
                  cx="${DIAL_VIEWBOX_SIZE / 2}"
                  cy="${DIAL_VIEWBOX_SIZE / 2}"
                  r="${DIAL_CIRCLE_RADIUS}"
                ></circle>
              </svg>
              <span class="climate-card__dial-current-marker" aria-hidden="true"></span>
              <span class="climate-card__dial-thumb" data-climate-control="dial-hit" aria-hidden="true"></span>
              <div class="climate-card__dial-center">
                <div class="climate-card__target">
                  <span class="climate-card__target-value" data-climate-readout="target">${escapeHtml(formatTemperature(targetTemperature, temperatureStep, false))}</span>
                  <span class="climate-card__target-unit">°C</span>
                </div>
                <div class="climate-card__divider"></div>
                <div class="climate-card__dial-meta">
                  ${currentTemperature !== null ? `<span>${escapeHtml(formatTemperature(currentTemperature, temperatureStep, true))}</span>` : ""}
                  <span class="climate-card__dial-action">
                    <ha-icon icon="${escapeHtml(currentActionMeta.icon)}"></ha-icon>
                  </span>
                </div>
                <div class="climate-card__dial-controls">
                  <button
                    type="button"
                    class="climate-card__mode-button climate-card__mode-button--power ${!isOff ? "is-active" : ""}"
                    data-climate-action="toggle"
                    title="${escapeHtml(isOff ? "Encender" : "Apagar")}"
                    aria-label="${escapeHtml(isOff ? "Encender" : "Apagar")}"
                  >
                    <ha-icon icon="mdi:power"></ha-icon>
                  </button>
                  ${modeOptions
                    .map(mode => {
                      const meta = getModeMeta(mode);
                      const active = normalizeTextKey(mode) === normalizeTextKey(currentMode);
                      return `
                        <button
                          type="button"
                          class="climate-card__mode-button ${active ? "is-active" : ""}"
                          data-climate-action="mode"
                          data-mode="${escapeHtml(mode)}"
                          title="${escapeHtml(meta.label)}"
                          aria-label="${escapeHtml(meta.label)}"
                        >
                          <ha-icon icon="${escapeHtml(meta.icon)}"></ha-icon>
                        </button>
                      `;
                    })
                    .join("")}
                </div>
              </div>
            </div>
          </div>

          ${
            config.show_step_controls !== false && supportsTargetTemperature
              ? `
                <div class="climate-card__steps">
                  <button
                    type="button"
                    class="climate-card__step-button"
                    data-climate-action="decrease"
                    aria-label="Bajar temperatura"
                  >
                    <span>&minus;</span>
                  </button>
                  <button
                    type="button"
                    class="climate-card__step-button"
                    data-climate-action="increase"
                    aria-label="Subir temperatura"
                  >
                    <span>+</span>
                  </button>
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
  customElements.define(CARD_TAG, NodaliaClimateCard);
}

class NodaliaClimateCardEditor extends HTMLElement {
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
      .filter(entityId => entityId.startsWith("climate."))
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
    const climateIds = Object.keys(this._hass?.states || {})
      .filter(entityId => entityId.startsWith("climate."))
      .sort((left, right) => left.localeCompare(right, "es"));

    return `
      <datalist id="climate-card-entities">
        ${climateIds.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
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
        .editor-field select {
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
            <div class="editor-section__hint">Entidad principal y textos visibles.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Entidad", "entity", config.entity, {
              placeholder: "climate.salon",
            })}
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Salon",
            })}
            ${this._renderTextField("Icono", "icon", config.icon, {
              placeholder: "mdi:thermostat",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Visibilidad</div>
            <div class="editor-section__hint">Elige la informacion y los controles visibles.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Mostrar chip de estado", "show_state_chip", config.show_state_chip !== false)}
            ${this._renderCheckboxField("Mostrar chip de temperatura actual", "show_current_temperature_chip", config.show_current_temperature_chip !== false)}
            ${this._renderCheckboxField("Mostrar chip de humedad", "show_humidity_chip", config.show_humidity_chip !== false)}
            ${this._renderCheckboxField("Mostrar botones de modo", "show_mode_buttons", config.show_mode_buttons !== false)}
            ${this._renderCheckboxField("Mostrar botones +/-", "show_step_controls", config.show_step_controls !== false)}
            ${this._renderCheckboxField("Mostrar badge de no disponible", "show_unavailable_badge", config.show_unavailable_badge !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Haptics</div>
            <div class="editor-section__hint">Respuesta haptica opcional para dial y controles.</div>
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
            <div class="editor-section__hint">Ajustes visuales del look Nodalia y el dial circular.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Background", "styles.card.background", config.styles.card.background)}
            ${this._renderTextField("Border", "styles.card.border", config.styles.card.border)}
            ${this._renderTextField("Radius", "styles.card.border_radius", config.styles.card.border_radius)}
            ${this._renderTextField("Shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
            ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
            ${this._renderTextField("Separacion", "styles.card.gap", config.styles.card.gap)}
            ${this._renderTextField("Tamano burbuja entidad", "styles.icon.size", config.styles.icon.size)}
            ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
            ${this._renderTextField("Tamano temperatura actual", "styles.current_size", config.styles.current_size)}
            ${this._renderTextField("Tamano temperatura objetivo", "styles.target_size", config.styles.target_size)}
            ${this._renderTextField("Tamano dial", "styles.dial.size", config.styles.dial.size)}
            ${this._renderTextField("Grosor dial", "styles.dial.stroke", config.styles.dial.stroke)}
            ${this._renderTextField("Tamano thumb dial", "styles.dial.thumb_size", config.styles.dial.thumb_size)}
            ${this._renderTextField("Color calor", "styles.dial.heat_color", config.styles.dial.heat_color)}
            ${this._renderTextField("Color frio", "styles.dial.cool_color", config.styles.dial.cool_color)}
            ${this._renderTextField("Color secado", "styles.dial.dry_color", config.styles.dial.dry_color)}
            ${this._renderTextField("Color auto", "styles.dial.auto_color", config.styles.dial.auto_color)}
            ${this._renderTextField("Color ventilador", "styles.dial.fan_color", config.styles.dial.fan_color)}
            ${this._renderTextField("Track dial", "styles.dial.track_color", config.styles.dial.track_color)}
            ${this._renderTextField("Tamano chip", "styles.chip_height", config.styles.chip_height)}
            ${this._renderTextField("Texto chip", "styles.chip_font_size", config.styles.chip_font_size)}
            ${this._renderTextField("Padding chip", "styles.chip_padding", config.styles.chip_padding)}
            ${this._renderTextField("Tamano boton modo", "styles.control.size", config.styles.control.size)}
            ${this._renderTextField("Tamano boton +/-", "styles.step_control.size", config.styles.step_control.size)}
          </div>
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('input[data-field="entity"]')
      .forEach(input => input.setAttribute("list", "climate-card-entities"));
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaClimateCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Climate Card",
  description: "Tarjeta de clima con dial circular, modos HVAC y control rapido de temperatura.",
  preview: true,
});
