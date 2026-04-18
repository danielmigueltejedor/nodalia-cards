const CARD_TAG = "nodalia-humidifier-card";
const EDITOR_TAG = "nodalia-humidifier-card-editor";
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
  mode_entity: "",
  fan_mode_entity: "",
  show_state: false,
  show_target_humidity_chip: true,
  show_mode_chip: true,
  show_fan_mode_chip: true,
  show_slider: true,
  show_mode_button: true,
  show_fan_mode_button: true,
  hidden_modes: [],
  hidden_fan_modes: [],
  compact_layout_mode: "auto",
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    power_duration: 600,
    controls_duration: 600,
    panel_duration: 800,
    button_bounce_duration: 320,
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
    slider_wrap_height: "56px",
    slider_height: "16px",
    slider_thumb_size: "28px",
    slider_color: "var(--info-color, #71c0ff)",
  },
};

const STUB_CONFIG = {
  entity: "humidifier.deshumidificador",
  name: "Deshumidificador",
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
    return "rgba(113, 192, 255, 0.2)";
  }

  if (normalizedField.endsWith("progress_background")) {
    return "rgba(255, 255, 255, 0.12)";
  }

  if (normalizedField.endsWith("overlay_color")) {
    return "rgba(0, 0, 0, 0.32)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
}

function getRangeValueFromClientX(slider, clientX) {
  const rect = slider.getBoundingClientRect();
  if (!rect.width) {
    return Number(slider.value || 0);
  }

  const min = Number(slider.min || 0);
  const max = Number(slider.max || 100);
  const step = slider.step === "any" ? 0 : Number(slider.step || 1);
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
  let nextValue = min + ((max - min) * ratio);

  if (Number.isFinite(step) && step > 0) {
    nextValue = min + (Math.round((nextValue - min) / step) * step);
  }

  return clamp(nextValue, min, max);
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

function translateModeLabel(value) {
  const normalized = normalizeTextKey(value);

  switch (normalized) {
    case "auto":
    case "automatic":
      return "Auto";
    case "smart":
    case "smart_mode":
      return "Inteligente";
    case "sleep":
    case "night":
      return "Noche";
    case "eco":
      return "Eco";
    case "quiet":
    case "silent":
      return "Silencioso";
    case "low":
      return "Baja";
    case "medium":
    case "mid":
      return "Media";
    case "high":
      return "Alta";
    case "boost":
      return "Boost";
    case "turbo":
      return "Turbo";
    case "normal":
    case "balanced":
      return "Normal";
    case "dry":
    case "drying":
      return "Secado";
    case "continuous":
      return "Continuo";
    case "clothes_dry":
    case "laundry":
      return "Ropa";
    default:
      return String(value ?? "");
  }
}

function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const normalizeList = value => (
    Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",")
        : []
  )
    .map(item => String(item || "").trim())
    .filter(Boolean);

  config.hidden_modes = normalizeList(config.hidden_modes);
  config.hidden_fan_modes = normalizeList(config.hidden_fan_modes);

  return config;
}

class NodaliaHumidifierCard extends HTMLElement {
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
    this._draftHumidity = new Map();
    this._modePanelOpen = false;
    this._fanModePanelOpen = false;
    this._cardWidth = 0;
    this._isCompactLayout = false;
    this._activeSliderDrag = null;
    this._pendingRenderAfterDrag = false;
    this._skipNextSliderChange = null;
    this._dragFrame = 0;
    this._pendingDragUpdate = null;
    this._lastRenderSignature = "";
    this._lastRenderedIsOn = null;
    this._lastRenderedPanelKey = "";
    this._lastControlsMarkup = "";
    this._lastPanelMarkup = "";
    this._animationCleanupTimer = 0;
    this._powerTransition = null;
    this._controlsTransition = null;
    this._panelTransition = null;
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

      if (this._activeSliderDrag) {
        this._pendingRenderAfterDrag = true;
        return;
      }

      this._render();
    });
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowChange = this._onShadowChange.bind(this);
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
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowChange);
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown);
    this.shadowRoot.addEventListener("mousedown", this._onShadowMouseDown);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      this.shadowRoot.addEventListener("touchstart", this._onShadowTouchStart, { passive: false });
    }
  }

  connectedCallback() {
    this._resizeObserver?.observe(this);
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
    this._resizeObserver?.disconnect();
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
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }
    if (this._animationCleanupTimer) {
      window.clearTimeout(this._animationCleanupTimer);
      this._animationCleanupTimer = 0;
    }
    this._powerTransition = null;
    this._controlsTransition = null;
    this._panelTransition = null;
    this._pendingDragUpdate = null;
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

    if (this._activeSliderDrag) {
      this._pendingRenderAfterDrag = true;
      return;
    }

    this._render();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 2,
      min_columns: 2,
    };
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const helperEntityId = this._config?.fan_mode_entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const helperState = helperEntityId ? hass?.states?.[helperEntityId] || null : null;
    const attrs = state?.attributes || {};
    return JSON.stringify({
      entityId,
      state: String(state?.state || ""),
      friendlyName: String(attrs.friendly_name || ""),
      icon: String(attrs.icon || ""),
      humidity: Number(attrs.humidity ?? -1),
      targetHumidity: Number(attrs.target_humidity ?? -1),
      minHumidity: Number(attrs.min_humidity ?? -1),
      maxHumidity: Number(attrs.max_humidity ?? -1),
      mode: String(attrs.mode || ""),
      availableModes: Array.isArray(attrs.available_modes) ? attrs.available_modes.join("|") : "",
      helperEntityId,
      helperState: String(helperState?.state || ""),
      compact: Boolean(this._isCompactLayout),
      modePanelOpen: Boolean(this._modePanelOpen),
      fanModePanelOpen: Boolean(this._fanModePanelOpen),
    });
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) && numericColumns > 0 ? numericColumns : null;
  }

  _getCompactLayoutThreshold() {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const iconSize = parseSizeToPixels(styles?.icon?.size, 58);
    const cardPadding = parseSizeToPixels(styles?.card?.padding, 14);
    const cardGap = parseSizeToPixels(styles?.card?.gap, 12);

    return Math.max(
      COMPACT_LAYOUT_THRESHOLD,
      Math.round(iconSize + (cardPadding * 2) + cardGap + 24),
    );
  }

  _shouldUseCompactLayout(width = Math.round(this._cardWidth || this.clientWidth || 0)) {
    const mode = this._config?.compact_layout_mode || "auto";

    if (mode === "always") {
      return true;
    }

    if (mode === "never") {
      return false;
    }

    const gridColumns = this._getConfiguredGridColumns();
    if (gridColumns !== null) {
      return gridColumns < 4;
    }

    return width > 0 && width < this._getCompactLayoutThreshold();
  }

  _getState() {
    return this._config?.entity ? this._hass?.states?.[this._config.entity] || null : null;
  }

  _getExternalEntityState(entityId) {
    return entityId ? this._hass?.states?.[entityId] || null : null;
  }

  _isOn(state) {
    return String(state?.state || "") === "on";
  }

  _supportsTargetHumidity(state) {
    return (
      Number.isFinite(Number(state?.attributes?.humidity)) ||
      Number.isFinite(Number(state?.attributes?.target_humidity)) ||
      (
        Number.isFinite(Number(state?.attributes?.min_humidity)) &&
        Number.isFinite(Number(state?.attributes?.max_humidity))
      )
    );
  }

  _getHumidityRange(state) {
    const min = Number(state?.attributes?.min_humidity);
    const max = Number(state?.attributes?.max_humidity);

    if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
      return {
        min,
        max,
      };
    }

    return {
      min: 30,
      max: 80,
    };
  }

  _getTargetHumidity(state) {
    const entityId = this._config?.entity;
    if (entityId && this._draftHumidity.has(entityId)) {
      return clamp(Number(this._draftHumidity.get(entityId)), this._getHumidityRange(state).min, this._getHumidityRange(state).max);
    }

    const rawHumidity = Number(state?.attributes?.humidity);
    if (Number.isFinite(rawHumidity)) {
      const range = this._getHumidityRange(state);
      return clamp(rawHumidity, range.min, range.max);
    }

    const rawTargetHumidity = Number(state?.attributes?.target_humidity);
    if (Number.isFinite(rawTargetHumidity)) {
      const range = this._getHumidityRange(state);
      return clamp(rawTargetHumidity, range.min, range.max);
    }

    const range = this._getHumidityRange(state);
    return clamp(Math.round((range.min + range.max) / 2), range.min, range.max);
  }

  _getHumidifierName(state) {
    return this._config?.name
      || state?.attributes?.friendly_name
      || this._config?.entity
      || "Humidificador";
  }

  _getHumidifierIcon(state) {
    if (this._config?.icon) {
      return this._config.icon;
    }

    const deviceClass = normalizeTextKey(state?.attributes?.device_class);
    if (deviceClass === "dehumidifier") {
      return "mdi:air-humidifier-off";
    }

    return String(state?.attributes?.icon || "mdi:air-humidifier");
  }

  _getStateLabel(state) {
    const normalized = normalizeTextKey(state?.state);

    switch (normalized) {
      case "on":
        return "Encendido";
      case "off":
        return "Apagado";
      case "humidifying":
        return "Humidificando";
      case "dehumidifying":
        return "Deshumidificando";
      case "drying":
        return "Secando";
      case "idle":
        return "En espera";
      default:
        return state?.state ? String(state.state) : "";
    }
  }

  _getModeOptions(state) {
    const modeEntity = this._getExternalEntityState(this._config?.mode_entity);

    if (Array.isArray(modeEntity?.attributes?.options)) {
      return modeEntity.attributes.options
        .map(item => String(item || "").trim())
        .filter(Boolean)
        .filter(option => !this._isModeHidden("hidden_modes", option));
    }

    if (Array.isArray(state?.attributes?.available_modes)) {
      return state.attributes.available_modes
        .map(item => String(item || "").trim())
        .filter(Boolean)
        .filter(option => !this._isModeHidden("hidden_modes", option));
    }

    return [];
  }

  _getCurrentMode(state) {
    const modeEntity = this._getExternalEntityState(this._config?.mode_entity);
    if (modeEntity?.state && !["unknown", "unavailable"].includes(modeEntity.state)) {
      return String(modeEntity.state);
    }

    if (state?.attributes?.mode) {
      return String(state.attributes.mode);
    }

    return "";
  }

  _getFanModeOptions() {
    const fanModeEntity = this._getExternalEntityState(this._config?.fan_mode_entity);
    return Array.isArray(fanModeEntity?.attributes?.options)
      ? fanModeEntity.attributes.options
        .map(item => String(item || "").trim())
        .filter(Boolean)
        .filter(option => !this._isModeHidden("hidden_fan_modes", option))
      : [];
  }

  _isModeHidden(field, value) {
    const hiddenModes = Array.isArray(this._config?.[field]) ? this._config[field] : [];
    const expectedKey = normalizeTextKey(value);
    return hiddenModes.some(item => normalizeTextKey(item) === expectedKey);
  }

  _getCurrentFanMode() {
    const fanModeEntity = this._getExternalEntityState(this._config?.fan_mode_entity);
    if (fanModeEntity?.state && !["unknown", "unavailable"].includes(fanModeEntity.state)) {
      return String(fanModeEntity.state);
    }

    return "";
  }

  _getAccentColor(state) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    return this._isOn(state)
      ? styles?.icon?.on_color || DEFAULT_CONFIG.styles.icon.on_color
      : styles?.icon?.off_color || DEFAULT_CONFIG.styles.icon.off_color;
  }

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;
    return {
      enabled: configuredAnimations.enabled !== false,
      powerDuration: clamp(Number(configuredAnimations.power_duration) || DEFAULT_CONFIG.animations.power_duration, 120, 4000),
      controlsDuration: clamp(Number(configuredAnimations.controls_duration) || DEFAULT_CONFIG.animations.controls_duration, 120, 2400),
      panelDuration: clamp(Number(configuredAnimations.panel_duration) || DEFAULT_CONFIG.animations.panel_duration, 120, 2400),
      buttonBounceDuration: clamp(Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration, 120, 1200),
    };
  }

  _scheduleAnimationCleanup(delay) {
    if (this._animationCleanupTimer) {
      window.clearTimeout(this._animationCleanupTimer);
      this._animationCleanupTimer = 0;
    }

    const safeDelay = clamp(Math.round(Number(delay) || 0), 0, 5000);
    if (!safeDelay || typeof window === "undefined") {
      return;
    }

    this._animationCleanupTimer = window.setTimeout(() => {
      this._animationCleanupTimer = 0;
      this._powerTransition = null;
      this._controlsTransition = null;
      this._panelTransition = null;
    }, safeDelay);
  }

  _triggerButtonBounce(button) {
    if (!(button instanceof HTMLElement)) {
      return;
    }

    const animations = this._getAnimationSettings();
    if (!animations.enabled) {
      return;
    }

    button.classList.remove("is-pressing");
    button.getBoundingClientRect();
    button.classList.add("is-pressing");

    window.setTimeout(() => {
      button.classList.remove("is-pressing");
    }, animations.buttonBounceDuration + 40);
  }

  _triggerRenderedButtonBounce(selector) {
    if (!selector || !this.shadowRoot || typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      const button = this.shadowRoot?.querySelector(selector);
      if (!(button instanceof HTMLElement)) {
        return;
      }

      this._triggerButtonBounce(button);
    });
  }

  _setHumidifierService(service, data = {}) {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    this._hass.callService("humidifier", service, {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _callOptionService(entityId, option) {
    if (!this._hass || !entityId || !option) {
      return;
    }

    const [domain] = entityId.split(".");
    if (domain === "select") {
      this._hass.callService("select", "select_option", {
        entity_id: entityId,
        option,
      });
      return;
    }

    if (domain === "input_select") {
      this._hass.callService("input_select", "select_option", {
        entity_id: entityId,
        option,
      });
    }
  }

  _toggleHumidifier(state) {
    if (this._isOn(state)) {
      this._setHumidifierService("turn_off");
      return;
    }

    this._setHumidifierService("turn_on");
  }

  _commitHumidity(value) {
    const state = this._getState();
    const range = this._getHumidityRange(state);
    const nextValue = clamp(Math.round(Number(value)), range.min, range.max);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    this._setHumidifierService("set_humidity", {
      humidity: nextValue,
    });
  }

  _commitMode(mode) {
    if (!mode) {
      return;
    }

    if (this._config?.mode_entity) {
      this._callOptionService(this._config.mode_entity, mode);
      return;
    }

    this._setHumidifierService("set_mode", {
      mode,
    });
  }

  _commitFanMode(mode) {
    if (!mode || !this._config?.fan_mode_entity) {
      return;
    }

    this._callOptionService(this._config.fan_mode_entity, mode);
  }

  _getPanelMarkup(panelKey, state = this._getState()) {
    if (panelKey === "mode") {
      const modeOptions = this._config?.show_mode_button !== false ? this._getModeOptions(state) : [];
      const currentMode = this._getCurrentMode(state);

      if (!modeOptions.length) {
        return "";
      }

      return `
        <div class="humidifier-card__panel">
          ${modeOptions
            .map(mode => `
              <button
                type="button"
                class="humidifier-card__option ${normalizeTextKey(mode) === normalizeTextKey(currentMode) ? "is-active" : ""}"
                data-humidifier-action="mode"
                data-mode="${escapeHtml(mode)}"
              >
                ${escapeHtml(translateModeLabel(mode))}
              </button>
            `)
            .join("")}
        </div>
      `;
    }

    if (panelKey === "fan") {
      const fanModeOptions = this._config?.show_fan_mode_button !== false ? this._getFanModeOptions() : [];
      const currentFanMode = this._getCurrentFanMode();

      if (!fanModeOptions.length) {
        return "";
      }

      return `
        <div class="humidifier-card__panel">
          ${fanModeOptions
            .map(mode => `
              <button
                type="button"
                class="humidifier-card__option ${normalizeTextKey(mode) === normalizeTextKey(currentFanMode) ? "is-active" : ""}"
                data-humidifier-action="fan-mode"
                data-mode="${escapeHtml(mode)}"
              >
                ${escapeHtml(translateModeLabel(mode))}
              </button>
            `)
            .join("")}
        </div>
      `;
    }

    return "";
  }

  _setPanelToggleButtonsState(panelKey) {
    this.shadowRoot
      ?.querySelectorAll('[data-humidifier-action="toggle-mode-panel"]')
      .forEach(button => {
        if (button instanceof HTMLElement) {
          button.classList.toggle("humidifier-card__control--active", panelKey === "mode");
        }
      });

    this.shadowRoot
      ?.querySelectorAll('[data-humidifier-action="toggle-fan-mode-panel"]')
      .forEach(button => {
        if (button instanceof HTMLElement) {
          button.classList.toggle("humidifier-card__control--active", panelKey === "fan");
        }
      });
  }

  _createMarkupNode(markup) {
    if (!markup || typeof document === "undefined") {
      return null;
    }

    const template = document.createElement("template");
    template.innerHTML = String(markup).trim();
    const node = template.content.firstElementChild;
    return node instanceof HTMLElement ? node : null;
  }

  _setVisiblePanelKey(panelKey, state = this._getState()) {
    const nextPanelKey = panelKey === "mode" || panelKey === "fan" ? panelKey : "";
    this._modePanelOpen = nextPanelKey === "mode";
    this._fanModePanelOpen = nextPanelKey === "fan";
    this._lastRenderedPanelKey = nextPanelKey;
    this._setPanelToggleButtonsState(nextPanelKey);

    const controlsInner = this.shadowRoot?.querySelector(".humidifier-card__controls-inner");
    const animations = this._getAnimationSettings();
    const panelMarkup = nextPanelKey ? this._getPanelMarkup(nextPanelKey, state) : "";

    if (panelMarkup) {
      this._lastPanelMarkup = panelMarkup;
    }

    if (!controlsInner || !(controlsInner instanceof HTMLElement) || !state || !this._isOn(state)) {
      this._render();
      return;
    }

    const existingPanel = controlsInner.querySelector(".humidifier-card__panel-shell");
    if (!animations.enabled) {
      if (existingPanel instanceof HTMLElement) {
        existingPanel.remove();
      }

      if (panelMarkup) {
        const panelNode = this._createMarkupNode(`
          <div class="humidifier-card__panel-shell" data-panel-key="${nextPanelKey}">
            <div class="humidifier-card__panel-inner">
              ${panelMarkup}
            </div>
          </div>
        `);

        if (panelNode instanceof HTMLElement) {
          controlsInner.appendChild(panelNode);
          return;
        }
      }

      this._render();
      return;
    }

    const removePanel = (panel, onDone = null) => {
      if (!(panel instanceof HTMLElement)) {
        if (typeof onDone === "function") {
          onDone();
        }
        return;
      }

      panel.classList.remove("humidifier-card__panel-shell--entering");
      panel.classList.add("humidifier-card__panel-shell--leaving");

      const finalizeRemoval = () => {
        if (panel.isConnected) {
          panel.remove();
        }
        if (typeof onDone === "function") {
          onDone();
        }
      };

      panel.addEventListener("animationend", finalizeRemoval, { once: true });
      window.setTimeout(finalizeRemoval, animations.panelDuration + 80);
    };
    const appendPanel = () => {
      if (!panelMarkup) {
        return;
      }

      const panelNode = this._createMarkupNode(`
        <div class="humidifier-card__panel-shell humidifier-card__panel-shell--entering" data-panel-key="${nextPanelKey}">
          <div class="humidifier-card__panel-inner">
            ${panelMarkup}
          </div>
        </div>
      `);

      if (!(panelNode instanceof HTMLElement)) {
        this._render();
        return;
      }

      controlsInner.appendChild(panelNode);
      window.setTimeout(() => {
        if (panelNode.isConnected) {
          panelNode.classList.remove("humidifier-card__panel-shell--entering");
        }
      }, animations.panelDuration + 80);
    };

    if (!nextPanelKey) {
      if (existingPanel instanceof HTMLElement) {
        removePanel(existingPanel);
      }
      return;
    }

    if (!panelMarkup) {
      if (existingPanel instanceof HTMLElement) {
        removePanel(existingPanel);
      }
      return;
    }

    const existingPanelKey = existingPanel instanceof HTMLElement ? existingPanel.dataset.panelKey || "" : "";
    if (existingPanel instanceof HTMLElement && existingPanelKey === nextPanelKey) {
      if (existingPanel.classList.contains("humidifier-card__panel-shell--leaving")) {
        existingPanel.remove();
      } else {
        const panelInner = existingPanel.querySelector(".humidifier-card__panel-inner");
        if (panelInner instanceof HTMLElement) {
          panelInner.innerHTML = panelMarkup;
        }
        return;
      }
    }

    if (existingPanel instanceof HTMLElement) {
      removePanel(existingPanel, appendPanel);
      return;
    }

    appendPanel();
  }

  _triggerHaptic(styleOverride = null) {
    const haptics = this._config?.haptics || {};
    if (haptics.enabled !== true) {
      return;
    }

    const style = styleOverride || haptics.style || "medium";
    fireEvent(this, "haptic", style, {
      bubbles: true,
      cancelable: false,
      composed: true,
    });

    if (haptics.fallback_vibrate === true && typeof navigator?.vibrate === "function") {
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection);
    }
  }

  _updateHumidityPreview(value) {
    const slider = this.shadowRoot?.querySelector('.humidifier-card__slider[data-humidifier-control="humidity"]');
    const state = this._getState();
    const range = this._getHumidityRange(state);
    const nextValue = clamp(Number(value), range.min, range.max);
    const progress = ((nextValue - range.min) / Math.max(range.max - range.min, 1)) * 100;

    if (slider instanceof HTMLInputElement) {
      slider.style.setProperty("--humidity", String(clamp(progress, 0, 100)));
      slider.closest(".humidifier-card__slider-shell")?.style.setProperty("--humidity", String(clamp(progress, 0, 100)));
    }
  }

  _applySliderValue(slider, value, options = {}) {
    const commit = options.commit === true;
    const state = this._getState();
    const range = this._getHumidityRange(state);
    const nextValue = clamp(Number(value), range.min, range.max);

    this._draftHumidity.set(this._config.entity, nextValue);
    this._updateHumidityPreview(nextValue);

    if (commit) {
      this._triggerHaptic("selection");
      this._commitHumidity(nextValue);
    }
  }

  _onShadowPointerDown(event) {
    const slider = event
      .composedPath()
      .find(node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.humidifierControl,
      );

    if (this._activeSliderDrag || !slider || (typeof event.button === "number" && event.button !== 0)) {
      return;
    }

    this._startSliderDrag(slider, event.clientX, event, event.pointerId);
  }

  _queueSliderDragUpdate(slider, clientX) {
    const nextValue = getRangeValueFromClientX(slider, clientX);
    slider.value = String(nextValue);
    this._applySliderValue(slider, nextValue, { commit: false });
  }

  _startSliderDrag(slider, clientX, event = null, pointerId = null) {
    if (!slider) {
      return;
    }

    this._activeSliderDrag = {
      pointerId,
      slider,
    };

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this._pendingDragUpdate = null;
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }

    const nextValue = getRangeValueFromClientX(slider, clientX);
    slider.value = String(nextValue);
    this._applySliderValue(slider, nextValue, { commit: false });
  }

  _commitSliderDrag(clientX, event = null, pointerId = null) {
    const drag = this._activeSliderDrag;
    if (!drag) {
      return;
    }

    if (event) {
      event.preventDefault();
    }

    this._pendingDragUpdate = null;
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }

    const nextValue = getRangeValueFromClientX(drag.slider, clientX);
    drag.slider.value = String(nextValue);
    this._skipNextSliderChange = drag.slider;
    this._applySliderValue(drag.slider, nextValue, { commit: true });

    this._activeSliderDrag = null;

    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _onShadowMouseDown(event) {
    const slider = event
      .composedPath()
      .find(node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.humidifierControl,
      );

    if (this._activeSliderDrag || !slider || event.button !== 0) {
      return;
    }

    this._startSliderDrag(slider, event.clientX, event);
  }

  _onShadowTouchStart(event) {
    const slider = event
      .composedPath()
      .find(node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.humidifierControl,
      );

    if (this._activeSliderDrag || !slider || !event.touches?.length) {
      return;
    }

    this._startSliderDrag(slider, event.touches[0].clientX, event);
  }

  _onWindowPointerMove(event) {
    const drag = this._activeSliderDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(drag.slider, event.clientX);
  }

  _onWindowPointerUp(event) {
    const drag = this._activeSliderDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    this._commitSliderDrag(event.clientX, event, event.pointerId);
  }

  _onWindowMouseMove(event) {
    if (!this._activeSliderDrag || (typeof event.buttons === "number" && (event.buttons & 1) === 0)) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(this._activeSliderDrag.slider, event.clientX);
  }

  _onWindowMouseUp(event) {
    if (!this._activeSliderDrag) {
      return;
    }

    this._commitSliderDrag(event.clientX, event);
  }

  _onWindowTouchMove(event) {
    if (!this._activeSliderDrag || !event.touches?.length) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(this._activeSliderDrag.slider, event.touches[0].clientX);
  }

  _onWindowTouchStartCapture(event) {
    const drag = this._activeSliderDrag;
    if (!drag) {
      return;
    }

    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (path.includes(drag.slider)) {
      return;
    }

    this._activeSliderDrag = null;
    this._pendingDragUpdate = null;
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }

    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _onWindowTouchEnd(event) {
    if (!this._activeSliderDrag) {
      return;
    }

    const clientX = event.changedTouches?.[0]?.clientX;
    if (!Number.isFinite(clientX)) {
      this._activeSliderDrag = null;
      if (this._pendingRenderAfterDrag) {
        this._pendingRenderAfterDrag = false;
        this._render();
      }
      return;
    }

    this._commitSliderDrag(clientX, event);
  }

  _onShadowInput(event) {
    const slider = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.humidifierControl);

    if (!slider) {
      return;
    }

    event.stopPropagation();

    if (this._activeSliderDrag?.slider === slider) {
      return;
    }

    this._applySliderValue(slider, slider.value, { commit: false });
  }

  _onShadowChange(event) {
    const slider = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.humidifierControl);

    if (!slider) {
      return;
    }

    event.stopPropagation();

    if (this._skipNextSliderChange === slider) {
      this._skipNextSliderChange = null;
      return;
    }

    this._applySliderValue(slider, slider.value, { commit: true });
  }

  _onShadowClick(event) {
    const path = event.composedPath();
    const slider = path.find(
      node => node instanceof HTMLInputElement && node.dataset?.humidifierControl,
    );

    if (slider) {
      return;
    }

    const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.humidifierAction);

    if (!actionButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const state = this._getState();
    this._triggerHaptic();

    switch (actionButton.dataset.humidifierAction) {
      case "toggle":
        this._triggerButtonBounce(actionButton);
        this._toggleHumidifier(state);
        break;
      case "toggle-mode-panel":
        this._triggerButtonBounce(actionButton);
        this._setVisiblePanelKey(this._modePanelOpen ? "" : "mode", state);
        break;
      case "toggle-fan-mode-panel":
        this._triggerButtonBounce(actionButton);
        this._setVisiblePanelKey(this._fanModePanelOpen ? "" : "fan", state);
        break;
      case "mode":
        this._triggerButtonBounce(actionButton);
        if (actionButton.dataset.mode) {
          this._commitMode(actionButton.dataset.mode);
        }
        break;
      case "fan-mode":
        this._triggerButtonBounce(actionButton);
        if (actionButton.dataset.mode) {
          this._commitFanMode(actionButton.dataset.mode);
        }
        break;
      default:
        break;
    }
  }

  _renderEmptyState() {
    return `
      <ha-card class="humidifier-card humidifier-card--empty">
        <div class="humidifier-card__empty-title">Nodalia Humidifier Card</div>
        <div class="humidifier-card__empty-text">Configura \`entity\` con una entidad \`humidifier.*\` para mostrar la tarjeta.</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const state = this._getState();
    const styles = config.styles;

    if (!state) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
          }

          * {
            box-sizing: border-box;
          }

          .humidifier-card--empty {
            background: ${styles.card.background};
            border: ${styles.card.border};
            border-radius: ${styles.card.border_radius};
            box-shadow: ${styles.card.box_shadow};
            display: grid;
            gap: 6px;
            padding: ${styles.card.padding};
          }

          .humidifier-card__empty-title {
            color: var(--primary-text-color);
            font-size: 15px;
            font-weight: 700;
          }

          .humidifier-card__empty-text {
            color: var(--secondary-text-color);
            font-size: 13px;
            line-height: 1.5;
          }
        </style>
        ${this._renderEmptyState()}
      `;
      return;
    }

    const isOn = this._isOn(state);
    const title = this._getHumidifierName(state);
    const icon = this._getHumidifierIcon(state);
    const accentColor = this._getAccentColor(state);
    const showUnavailableBadge = isUnavailableState(state);
    const supportsHumidity = config.show_slider !== false && this._supportsTargetHumidity(state);
    const humidityRange = this._getHumidityRange(state);
    const currentHumidity = this._getTargetHumidity(state);
    const humidityProgress = ((currentHumidity - humidityRange.min) / Math.max(humidityRange.max - humidityRange.min, 1)) * 100;
    const modeOptions = config.show_mode_button !== false ? this._getModeOptions(state) : [];
    const currentMode = this._getCurrentMode(state);
    const fanModeOptions = config.show_fan_mode_button !== false ? this._getFanModeOptions() : [];
    const currentFanMode = this._getCurrentFanMode();
    const isCompactLayout = this._isCompactLayout;
    const chips = [];

    if (config.show_state === true) {
      chips.push(`<div class="humidifier-card__chip humidifier-card__chip--state">${escapeHtml(this._getStateLabel(state))}</div>`);
    }

    if (config.show_target_humidity_chip !== false && supportsHumidity) {
      chips.push(`<div class="humidifier-card__chip">${escapeHtml(`${Math.round(currentHumidity)}%`)}</div>`);
    }

    if (config.show_mode_chip !== false && currentMode) {
      chips.push(`<div class="humidifier-card__chip">${escapeHtml(translateModeLabel(currentMode))}</div>`);
    }

    if (config.show_fan_mode_chip !== false && currentFanMode) {
      chips.push(`<div class="humidifier-card__chip">${escapeHtml(translateModeLabel(currentFanMode))}</div>`);
    }

    const showCopyBlock = !isCompactLayout || chips.length > 0;
    const hasSecondaryControls = (modeOptions.length > 0) || (fanModeOptions.length > 0);
    const onCardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 54%, ${styles.card.background} 100%)`;
    const onCardBorder = `color-mix(in srgb, ${accentColor} 34%, var(--divider-color))`;
    const onCardShadow = `0 16px 32px color-mix(in srgb, ${accentColor} 14%, rgba(0, 0, 0, 0.18))`;
    const animations = this._getAnimationSettings();
    const now = Date.now();
    const wasOn = this._lastRenderedIsOn;
    const currentPanelKey = isOn
      ? (this._modePanelOpen && modeOptions.length
          ? "mode"
          : this._fanModePanelOpen && fanModeOptions.length
            ? "fan"
            : "")
      : "";
    let powerAnimationState = "";
    let controlsAnimationState = "";
    let panelAnimationState = "";

    if (!animations.enabled) {
      this._powerTransition = null;
      this._controlsTransition = null;
      this._panelTransition = null;
    } else if (wasOn !== null && wasOn !== isOn) {
      powerAnimationState = isOn ? "powering-up" : "powering-down";
      this._powerTransition = {
        endsAt: now + animations.powerDuration,
        state: powerAnimationState,
      };

      if (supportsHumidity || hasSecondaryControls || this._lastControlsMarkup) {
        controlsAnimationState = isOn ? "entering" : "leaving";
        this._controlsTransition = {
          endsAt: now + animations.controlsDuration,
          state: controlsAnimationState,
        };
      } else {
        this._controlsTransition = null;
      }

      this._panelTransition = null;
    } else {
      if (this._powerTransition?.endsAt > now) {
        powerAnimationState = this._powerTransition.state;
      } else {
        this._powerTransition = null;
      }

      if (this._controlsTransition?.endsAt > now) {
        controlsAnimationState = this._controlsTransition.state;
      } else {
        this._controlsTransition = null;
      }

      if (isOn && this._lastRenderedPanelKey !== currentPanelKey) {
        panelAnimationState = currentPanelKey ? "entering" : "leaving";
        this._panelTransition = {
          endsAt: now + animations.panelDuration,
          state: panelAnimationState,
        };
      } else if (this._panelTransition?.endsAt > now) {
        panelAnimationState = this._panelTransition.state;
      } else {
        this._panelTransition = null;
      }

      if (!isOn) {
        this._panelTransition = null;
      }
    }

    const mainControlsMarkup = isOn && supportsHumidity
      ? `
        <div class="humidifier-card__slider-row ${hasSecondaryControls ? "" : "humidifier-card__slider-row--solo"}">
          <div class="humidifier-card__slider-wrap">
            <div class="humidifier-card__slider-shell" style="--humidity:${clamp(humidityProgress, 0, 100)};">
              <div class="humidifier-card__slider-track"></div>
              <input
                type="range"
                class="humidifier-card__slider"
                data-humidifier-control="humidity"
                min="${humidityRange.min}"
                max="${humidityRange.max}"
                step="any"
                value="${currentHumidity}"
                style="--humidity:${clamp(humidityProgress, 0, 100)};"
                aria-label="Humedad objetivo"
              />
            </div>
          </div>
          ${
            hasSecondaryControls
              ? `
                <div class="humidifier-card__slider-actions">
                  ${
                    modeOptions.length
                      ? `
                        <button
                          type="button"
                          class="humidifier-card__control ${this._modePanelOpen ? "humidifier-card__control--active" : ""}"
                          data-humidifier-action="toggle-mode-panel"
                          aria-label="Mostrar modos"
                        >
                          <ha-icon icon="mdi:tune-variant"></ha-icon>
                        </button>
                      `
                      : ""
                  }
                  ${
                    fanModeOptions.length
                      ? `
                        <button
                          type="button"
                          class="humidifier-card__control ${this._fanModePanelOpen ? "humidifier-card__control--active" : ""}"
                          data-humidifier-action="toggle-fan-mode-panel"
                          aria-label="Mostrar velocidades"
                        >
                          <ha-icon icon="mdi:fan"></ha-icon>
                        </button>
                      `
                      : ""
                  }
                </div>
              `
              : ""
          }
        </div>
      `
      : !supportsHumidity && hasSecondaryControls && isOn
        ? `
          <div class="humidifier-card__controls">
            ${
              modeOptions.length
                ? `
                  <button
                    type="button"
                    class="humidifier-card__control ${this._modePanelOpen ? "humidifier-card__control--active" : ""}"
                    data-humidifier-action="toggle-mode-panel"
                    aria-label="Mostrar modos"
                  >
                    <ha-icon icon="mdi:tune-variant"></ha-icon>
                  </button>
                `
                : ""
            }
            ${
              fanModeOptions.length
                ? `
                  <button
                    type="button"
                    class="humidifier-card__control ${this._fanModePanelOpen ? "humidifier-card__control--active" : ""}"
                    data-humidifier-action="toggle-fan-mode-panel"
                    aria-label="Mostrar velocidades"
                  >
                    <ha-icon icon="mdi:fan"></ha-icon>
                  </button>
                `
                : ""
            }
          </div>
        `
        : "";

    const currentPanelMarkup = currentPanelKey === "mode"
      ? `
        <div class="humidifier-card__panel">
          ${modeOptions
            .map(mode => `
              <button
                type="button"
                class="humidifier-card__option ${normalizeTextKey(mode) === normalizeTextKey(currentMode) ? "is-active" : ""}"
                data-humidifier-action="mode"
                data-mode="${escapeHtml(mode)}"
              >
                ${escapeHtml(translateModeLabel(mode))}
              </button>
            `)
            .join("")}
        </div>
      `
      : currentPanelKey === "fan"
        ? `
          <div class="humidifier-card__panel">
            ${fanModeOptions
              .map(mode => `
                <button
                  type="button"
                  class="humidifier-card__option ${normalizeTextKey(mode) === normalizeTextKey(currentFanMode) ? "is-active" : ""}"
                  data-humidifier-action="fan-mode"
                  data-mode="${escapeHtml(mode)}"
                >
                  ${escapeHtml(translateModeLabel(mode))}
                </button>
              `)
              .join("")}
          </div>
        `
        : "";
    const panelContentMarkup = currentPanelMarkup
      || (panelAnimationState === "leaving" ? this._lastPanelMarkup : "");
    const panelShellMarkup = panelContentMarkup
      ? `
        <div class="humidifier-card__panel-shell ${panelAnimationState ? `humidifier-card__panel-shell--${panelAnimationState}` : ""}" data-panel-key="${currentPanelKey || "hidden"}">
          <div class="humidifier-card__panel-inner">
            ${panelContentMarkup}
          </div>
        </div>
      `
      : "";
    const currentControlsAnimatedMarkup = [
      mainControlsMarkup,
      panelShellMarkup,
    ].filter(Boolean).join("");
    const currentControlsStaticMarkup = [
      mainControlsMarkup,
      currentPanelMarkup
        ? `
          <div class="humidifier-card__panel-shell" data-panel-key="${currentPanelKey || "hidden"}">
            <div class="humidifier-card__panel-inner">
              ${currentPanelMarkup}
            </div>
          </div>
        `
        : "",
    ].filter(Boolean).join("");
    const controlsContentMarkup = isOn
      ? currentControlsAnimatedMarkup
      : controlsAnimationState === "leaving"
        ? this._lastControlsMarkup
        : "";
    const controlsShellMarkup = controlsContentMarkup
      ? `
        <div class="humidifier-card__controls-shell ${controlsAnimationState ? `humidifier-card__controls-shell--${controlsAnimationState}` : ""}">
          <div class="humidifier-card__controls-inner">
            ${controlsContentMarkup}
          </div>
        </div>
      `
      : "";
    const powerAnimationRemaining = powerAnimationState && this._powerTransition
      ? Math.max(0, this._powerTransition.endsAt - now)
      : 0;
    const controlsAnimationRemaining = controlsAnimationState && this._controlsTransition
      ? Math.max(0, this._controlsTransition.endsAt - now)
      : 0;
    const panelAnimationRemaining = panelAnimationState && this._panelTransition
      ? Math.max(0, this._panelTransition.endsAt - now)
      : 0;
    const shouldCleanupAfterAnimation = Boolean(powerAnimationRemaining || controlsAnimationRemaining || panelAnimationRemaining);
    const cleanupDelay = shouldCleanupAfterAnimation
      ? Math.max(powerAnimationRemaining, controlsAnimationRemaining, panelAnimationRemaining) + 40
      : 0;

    if (currentPanelMarkup) {
      this._lastPanelMarkup = currentPanelMarkup;
    }

    if (isOn && currentControlsStaticMarkup && panelAnimationState !== "leaving") {
      this._lastControlsMarkup = currentControlsStaticMarkup;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        ha-card.humidifier-card {
          --humidifier-card-controls-max-height: 360px;
          --humidifier-card-controls-gap: calc(${styles.card.gap} + 4px);
          --humidifier-card-controls-duration: ${animations.controlsDuration}ms;
          --humidifier-card-panel-duration: ${animations.panelDuration}ms;
          --humidifier-card-power-duration: ${animations.powerDuration}ms;
          --humidifier-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          background: ${isOn ? onCardBackground : styles.card.background};
          border: ${isOn ? `1px solid ${onCardBorder}` : styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${isOn ? `${styles.card.box_shadow}, ${onCardShadow}` : styles.card.box_shadow};
          min-width: 0;
          overflow: hidden;
          padding: ${styles.card.padding};
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .humidifier-card.is-off {
          cursor: pointer;
        }

        ha-card::before {
          background: ${isOn
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 18%, rgba(255, 255, 255, 0.06)), rgba(255, 255, 255, 0))`
            : "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0))"};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        ha-card::after {
          background:
            radial-gradient(circle at 18% 18%, color-mix(in srgb, ${accentColor} 22%, rgba(255, 255, 255, 0.12)) 0%, transparent 50%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%);
          content: "";
          inset: 0;
          opacity: ${isOn ? "1" : "0"};
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .humidifier-card--powering-up {
          animation: humidifier-card-power-up var(--humidifier-card-power-duration) cubic-bezier(0.24, 0.82, 0.25, 1) both;
        }

        .humidifier-card--powering-down {
          animation: humidifier-card-power-down var(--humidifier-card-power-duration) cubic-bezier(0.32, 0, 0.24, 1) both;
        }

        .humidifier-card--powering-up::after {
          animation: humidifier-card-power-glow-in var(--humidifier-card-power-duration) cubic-bezier(0.24, 0.82, 0.25, 1) both;
        }

        .humidifier-card--powering-down::after {
          animation: humidifier-card-power-glow-out var(--humidifier-card-power-duration) cubic-bezier(0.32, 0, 0.24, 1) both;
        }

        .humidifier-card {
          color: var(--primary-text-color);
          display: grid;
          min-width: 0;
          position: relative;
          z-index: 1;
        }

        .humidifier-card__content {
          display: grid;
          gap: 0;
        }

        .humidifier-card__hero {
          align-items: center;
          display: grid;
          gap: ${styles.card.gap};
          grid-template-columns: ${styles.icon.size} minmax(0, 1fr);
        }

        .humidifier-card--compact .humidifier-card__hero {
          grid-template-columns: ${styles.icon.size};
          justify-content: center;
        }

        .humidifier-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${isOn
            ? `color-mix(in srgb, ${accentColor} 24%, ${styles.icon.background})`
            : styles.icon.background};
          border: 1px solid color-mix(in srgb, ${accentColor} 22%, rgba(255, 255, 255, 0.08));
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${isOn ? styles.icon.on_color : styles.icon.off_color};
          cursor: pointer;
          display: inline-flex;
          height: ${styles.icon.size};
          justify-content: center;
          line-height: 0;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          transform: scale(1);
          transform-origin: center;
          transition: transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1);
          width: ${styles.icon.size};
        }

        .humidifier-card__icon ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.46);
          display: inline-flex;
          height: calc(${styles.icon.size} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${styles.icon.size} * 0.46);
        }

        .humidifier-card__unavailable-badge {
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

        .humidifier-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .humidifier-card__copy {
          display: grid;
          gap: 10px;
          min-width: 0;
        }

        .humidifier-card__headline {
          align-items: start;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .humidifier-card--compact .humidifier-card__copy {
          justify-items: center;
          text-align: center;
        }

        .humidifier-card--compact .humidifier-card__headline {
          grid-template-columns: minmax(0, 1fr);
          justify-items: center;
        }

        .humidifier-card__title {
          color: var(--primary-text-color);
          font-size: ${styles.title_size};
          font-weight: 700;
          line-height: 1.2;
          min-width: 0;
        }

        .humidifier-card__chips {
          align-items: center;
          display: flex;
          flex: 0 0 auto;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          min-width: 0;
          max-width: 100%;
        }

        .humidifier-card--compact .humidifier-card__chips {
          justify-content: center;
        }

        .humidifier-card__chip {
          align-items: center;
          backdrop-filter: blur(18px);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          height: ${styles.chip_height};
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding: ${styles.chip_padding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .humidifier-card__chip--state {
          color: var(--primary-text-color);
        }

        .humidifier-card__controls-shell {
          backface-visibility: hidden;
          margin-top: var(--humidifier-card-controls-gap);
          overflow: hidden;
          will-change: margin-top, max-height, opacity;
        }

        .humidifier-card__controls-inner {
          backface-visibility: hidden;
          display: grid;
          gap: 10px;
          will-change: opacity, transform;
        }

        .humidifier-card__controls-shell--entering {
          animation: humidifier-card-controls-expand var(--humidifier-card-controls-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          transform-origin: top;
        }

        .humidifier-card__controls-shell--entering .humidifier-card__controls-inner {
          animation: humidifier-card-controls-content-in var(--humidifier-card-controls-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          transform-origin: top;
        }

        .humidifier-card__controls-shell--leaving {
          animation: humidifier-card-controls-collapse var(--humidifier-card-controls-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
          pointer-events: none;
          transform-origin: top;
        }

        .humidifier-card__controls-shell--leaving .humidifier-card__controls-inner {
          animation: humidifier-card-controls-content-out var(--humidifier-card-controls-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
          transform-origin: top;
        }

        .humidifier-card__slider-row {
          align-items: center;
          display: grid;
          gap: 14px;
          grid-template-columns: minmax(0, 1fr) auto;
          padding-inline: 4px;
        }

        .humidifier-card__slider-row--solo {
          grid-template-columns: minmax(0, 1fr);
        }

        .humidifier-card__slider-wrap {
          --humidifier-card-slider-input-height: max(44px, var(--humidifier-card-slider-thumb-size));
          --humidifier-card-slider-thumb-size: calc(${styles.slider_thumb_size} + 12px);
          align-items: center;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          display: flex;
          min-height: ${styles.slider_wrap_height};
          padding: 0 14px;
        }

        .humidifier-card__slider-shell {
          flex: 1;
          min-width: 0;
          position: relative;
        }

        .humidifier-card__slider-track {
          background:
            linear-gradient(
              90deg,
              ${styles.slider_color} calc(var(--humidity, ${clamp(humidityProgress, 0, 100)}) * 1%),
              rgba(255, 255, 255, 0.08) calc(var(--humidity, ${clamp(humidityProgress, 0, 100)}) * 1%)
            );
          border-radius: 999px;
          height: ${styles.slider_height};
          left: 0;
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
        }

        .humidifier-card__slider-actions {
          display: inline-flex;
          flex: 0 0 auto;
          gap: 12px;
          justify-content: flex-end;
        }

        .humidifier-card__slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          box-sizing: border-box;
          cursor: pointer;
          flex: 1;
          height: var(--humidifier-card-slider-input-height);
          margin: 0;
          padding: 0;
          position: relative;
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
          width: 100%;
          z-index: 1;
        }

        .humidifier-card__slider::-webkit-slider-runnable-track {
          background: transparent;
          border-radius: 999px;
          height: ${styles.slider_height};
        }

        .humidifier-card__slider::-moz-range-progress {
          background: transparent;
          border: 0;
          height: ${styles.slider_height};
        }

        .humidifier-card__slider::-moz-range-track {
          background: transparent;
          border-radius: 999px;
          border: 0;
          height: ${styles.slider_height};
        }

        .humidifier-card__slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          border-radius: 50%;
          box-shadow: none;
          box-sizing: border-box;
          height: ${styles.slider_thumb_size};
          margin-top: calc((${styles.slider_height} - ${styles.slider_thumb_size}) / 2);
          width: ${styles.slider_thumb_size};
        }

        .humidifier-card__slider::-moz-range-thumb {
          background: transparent;
          border: 0;
          border-radius: 50%;
          box-shadow: none;
          box-sizing: border-box;
          height: ${styles.slider_thumb_size};
          width: ${styles.slider_thumb_size};
        }

        .humidifier-card__controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          padding-inline: 4px;
        }

        .humidifier-card__control {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 10px 24px rgba(0, 0, 0, 0.16);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: ${styles.control.size};
          justify-content: center;
          line-height: 0;
          min-width: ${styles.control.size};
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          transform: scale(1);
          transform-origin: center;
          transition: transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1);
          width: ${styles.control.size};
        }

        .humidifier-card__control--active {
          background: color-mix(in srgb, ${accentColor} 18%, ${styles.control.accent_background});
          border-color: color-mix(in srgb, ${accentColor} 48%, rgba(255, 255, 255, 0.12));
          color: ${styles.control.accent_color};
        }

        .humidifier-card__control ha-icon {
          --mdc-icon-size: calc(${styles.control.size} * 0.46);
          display: inline-flex;
          height: calc(${styles.control.size} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${styles.control.size} * 0.46);
        }

        .humidifier-card__panel {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          min-width: 0;
        }

        .humidifier-card__panel-shell {
          backface-visibility: hidden;
          overflow: hidden;
          will-change: max-height, opacity;
        }

        .humidifier-card__panel-inner {
          backface-visibility: hidden;
          display: grid;
          padding: 4px;
          will-change: opacity, transform;
        }

        .humidifier-card__panel-shell--entering {
          animation: humidifier-card-panel-expand var(--humidifier-card-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          transform-origin: top;
        }

        .humidifier-card__panel-shell--entering .humidifier-card__panel-inner {
          animation: humidifier-card-panel-content-in var(--humidifier-card-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          transform-origin: top;
        }

        .humidifier-card__panel-shell--leaving {
          animation: humidifier-card-panel-collapse var(--humidifier-card-panel-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
          pointer-events: none;
          transform-origin: top;
        }

        .humidifier-card__panel-shell--leaving .humidifier-card__panel-inner {
          animation: humidifier-card-panel-content-out var(--humidifier-card-panel-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
          transform-origin: top;
        }

        .humidifier-card__option {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          height: max(32px, ${styles.chip_height});
          justify-content: center;
          margin: 0;
          max-width: 100%;
          min-width: 0;
          padding: 0 14px;
          transform: scale(1);
          transform-origin: center;
          transition: transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1);
          white-space: nowrap;
        }

        .humidifier-card__option.is-active {
          background: ${styles.control.accent_background};
          border-color: color-mix(in srgb, ${accentColor} 48%, rgba(255, 255, 255, 0.12));
          color: ${styles.control.accent_color};
        }

        :is(.humidifier-card__icon, .humidifier-card__control, .humidifier-card__option):active:not(:disabled),
        :is(.humidifier-card__icon, .humidifier-card__control, .humidifier-card__option).is-pressing:not(:disabled) {
          animation: humidifier-card-button-bounce var(--humidifier-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        @keyframes humidifier-card-power-up {
          0% {
            background: ${styles.card.background};
            box-shadow: ${styles.card.box_shadow};
            transform: scale(0.994);
          }
          55% {
            background: linear-gradient(135deg, color-mix(in srgb, ${accentColor} 26%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 14%, ${styles.card.background}) 54%, ${styles.card.background} 100%);
            box-shadow: ${styles.card.box_shadow}, 0 12px 26px color-mix(in srgb, ${accentColor} 12%, rgba(0, 0, 0, 0.16));
            transform: scale(1);
          }
          100% {
            background: ${onCardBackground};
            box-shadow: ${styles.card.box_shadow}, ${onCardShadow};
            transform: scale(1);
          }
        }

        @keyframes humidifier-card-power-down {
          0% {
            background: ${onCardBackground};
            box-shadow: ${styles.card.box_shadow}, ${onCardShadow};
            transform: scale(1);
          }
          100% {
            background: ${styles.card.background};
            box-shadow: ${styles.card.box_shadow};
            transform: scale(1);
          }
        }

        @keyframes humidifier-card-power-glow-in {
          0% {
            opacity: 0;
          }
          45% {
            opacity: 1;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes humidifier-card-power-glow-out {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes humidifier-card-controls-expand {
          0% {
            margin-top: 0;
            max-height: 0;
            opacity: 0;
          }
          100% {
            margin-top: var(--humidifier-card-controls-gap);
            max-height: var(--humidifier-card-controls-max-height);
            opacity: 1;
          }
        }

        @keyframes humidifier-card-controls-collapse {
          0% {
            margin-top: var(--humidifier-card-controls-gap);
            max-height: var(--humidifier-card-controls-max-height);
            opacity: 1;
          }
          100% {
            margin-top: 0;
            max-height: 0;
            opacity: 0;
          }
        }

        @keyframes humidifier-card-controls-content-in {
          0% {
            opacity: 0;
            transform: translateY(-10px) scaleY(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes humidifier-card-controls-content-out {
          0% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.94);
          }
        }

        @keyframes humidifier-card-panel-expand {
          0% {
            max-height: 0;
            opacity: 0;
          }
          100% {
            max-height: 180px;
            opacity: 1;
          }
        }

        @keyframes humidifier-card-panel-collapse {
          0% {
            max-height: 180px;
            opacity: 1;
          }
          100% {
            max-height: 0;
            opacity: 0;
          }
        }

        @keyframes humidifier-card-panel-content-in {
          0% {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes humidifier-card-panel-content-out {
          0% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-6px) scaleY(0.96);
          }
        }

        @keyframes humidifier-card-button-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.08);
          }
          72% {
            transform: scale(1.03);
          }
          100% {
            transform: scale(1);
          }
        }

        ${animations.enabled ? "" : `
        .humidifier-card,
        .humidifier-card::after,
        .humidifier-card__controls-shell,
        .humidifier-card__controls-inner,
        .humidifier-card__panel-shell,
        .humidifier-card__panel-inner,
        .humidifier-card__icon,
        .humidifier-card__option,
        .humidifier-card__control,
        .humidifier-card * {
          animation: none !important;
          transition: none !important;
        }
        `}

        .humidifier-card--compact:not(.humidifier-card--with-copy) .humidifier-card__hero {
          justify-items: center;
        }

        @media (prefers-reduced-motion: reduce) {
          .humidifier-card,
          .humidifier-card::after,
          .humidifier-card__controls-shell,
          .humidifier-card__controls-inner,
          .humidifier-card__panel-shell,
          .humidifier-card__panel-inner,
          .humidifier-card__icon,
          .humidifier-card__control,
          .humidifier-card__option {
            animation: none !important;
            transition: none !important;
          }
        }

        @media (max-width: 420px) {
          .humidifier-card__hero {
            grid-template-columns: 50px minmax(0, 1fr);
          }

          .humidifier-card__icon {
            height: 50px;
            width: 50px;
          }

          .humidifier-card__slider-row {
            gap: 10px;
            grid-template-columns: minmax(0, 1fr) auto;
          }

          .humidifier-card__slider-actions {
            gap: 10px;
            justify-content: flex-end;
          }
        }
      </style>
      <ha-card
        class="humidifier-card ${isOn ? "is-on" : "is-off"} ${isCompactLayout ? "humidifier-card--compact" : ""} ${showCopyBlock ? "humidifier-card--with-copy" : ""} ${powerAnimationState ? `humidifier-card--${powerAnimationState}` : ""}"
        data-humidifier-action="toggle"
        style="--accent-color:${escapeHtml(accentColor)};"
      >
        <div class="humidifier-card__content">
          <div class="humidifier-card__hero">
            <button
              type="button"
              class="humidifier-card__icon"
              data-humidifier-action="toggle"
              aria-label="Encender o apagar"
            >
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
              ${showUnavailableBadge ? `<span class="humidifier-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${showCopyBlock
              ? `
                <div class="humidifier-card__copy">
                  <div class="humidifier-card__headline">
                    ${isCompactLayout ? "" : `<div class="humidifier-card__title">${escapeHtml(title)}</div>`}
                    ${chips.length ? `<div class="humidifier-card__chips">${chips.join("")}</div>` : ""}
                  </div>
                </div>
              `
              : ""}
          </div>
          ${controlsShellMarkup}
        </div>
      </ha-card>
    `;

    this._lastRenderedIsOn = isOn;
    this._lastRenderedPanelKey = currentPanelKey;

    if (shouldCleanupAfterAnimation) {
      this._scheduleAnimationCleanup(cleanupDelay);
    } else if (this._animationCleanupTimer) {
      window.clearTimeout(this._animationCleanupTimer);
      this._animationCleanupTimer = 0;
    }
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaHumidifierCard);
}

class NodaliaHumidifierCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showStyleSection = false;
    this._showAnimationSection = false;
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

  _getEntityOptionsSignature(hass = this._hass) {
    return Object.entries(hass?.states || {})
      .filter(([entityId]) => entityId.startsWith("humidifier.") || entityId.startsWith("select.") || entityId.startsWith("input_select."))
      .map(([entityId, state]) => `${entityId}:${String(state?.attributes?.friendly_name || "")}:${String(state?.attributes?.icon || "")}`)
      .sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }))
      .join("|");
  }

  _getHumidifierEntityOptions() {
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => entityId.startsWith("humidifier."))
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

    const currentValue = String(this._config?.entity || "").trim();
    if (currentValue && !options.some(option => option.value === currentValue)) {
      options.unshift({
        value: currentValue,
        label: currentValue,
        displayLabel: currentValue,
      });
    }

    return options;
  }

  _getSelectEntityOptions(path) {
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => entityId.startsWith("select.") || entityId.startsWith("input_select."))
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
      case "number": {
        if (input.value === "") {
          return "";
        }

        const numericValue = Number(input.value);
        return Number.isFinite(numericValue) ? numericValue : "";
      }
      case "color":
        return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
      default:
        return input.value;
    }
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement);

    if (!input?.dataset?.field) {
      if (input?.dataset?.modeListField && input.dataset.modeValue !== undefined) {
        event.stopPropagation();
        this._setModeVisibility(input.dataset.modeListField, input.dataset.modeValue, input.checked);
        this._setEditorConfig();

        if (event.type === "change") {
          this._emitConfig();
        }
      }
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

    if (!toggleButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (toggleButton.dataset.editorToggle === "styles") {
      this._showStyleSection = !this._showStyleSection;
      this._render();
      return;
    }

    if (toggleButton.dataset.editorToggle === "animations") {
      this._showAnimationSection = !this._showAnimationSection;
      this._render();
    }
  }

  _renderTextField(label, field, value, options = {}) {
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const min = options.min !== undefined ? `min="${escapeHtml(String(options.min))}"` : "";
    const max = options.max !== undefined ? `max="${escapeHtml(String(options.max))}"` : "";
    const step = options.step !== undefined ? `step="${escapeHtml(String(options.step))}"` : "";
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
          ${min}
          ${max}
          ${step}
        />
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

  _getHumidifierState() {
    return this._config?.entity ? this._hass?.states?.[this._config.entity] || null : null;
  }

  _getModeEntityState() {
    return this._config?.mode_entity ? this._hass?.states?.[this._config.mode_entity] || null : null;
  }

  _getFanModeEntityState() {
    return this._config?.fan_mode_entity ? this._hass?.states?.[this._config.fan_mode_entity] || null : null;
  }

  _getModeVisibilityOptions() {
    const modeEntity = this._getModeEntityState();
    const humidifierState = this._getHumidifierState();

    if (Array.isArray(modeEntity?.attributes?.options)) {
      return modeEntity.attributes.options.map(item => String(item || "").trim()).filter(Boolean);
    }

    if (Array.isArray(humidifierState?.attributes?.available_modes)) {
      return humidifierState.attributes.available_modes.map(item => String(item || "").trim()).filter(Boolean);
    }

    return [];
  }

  _getFanModeVisibilityOptions() {
    const fanModeEntity = this._getFanModeEntityState();
    return Array.isArray(fanModeEntity?.attributes?.options)
      ? fanModeEntity.attributes.options.map(item => String(item || "").trim()).filter(Boolean)
      : [];
  }

  _getHiddenModeList(field) {
    return Array.isArray(this._config?.[field])
      ? this._config[field].map(item => String(item || "").trim()).filter(Boolean)
      : [];
  }

  _isModeVisible(field, value) {
    const expectedKey = normalizeTextKey(value);
    return !this._getHiddenModeList(field).some(item => normalizeTextKey(item) === expectedKey);
  }

  _setModeVisibility(field, value, visible) {
    const rawValue = String(value || "").trim();
    if (!rawValue) {
      return;
    }

    const nextValues = this._getHiddenModeList(field).filter(item => normalizeTextKey(item) !== normalizeTextKey(rawValue));
    if (!visible) {
      nextValues.push(rawValue);
    }

    if (nextValues.length) {
      setByPath(this._config, field, nextValues);
      return;
    }

    deleteByPath(this._config, field);
  }

  _renderModeVisibilityField(field, modeValue) {
    const translatedLabel = translateModeLabel(modeValue);
    const showRawValue = normalizeTextKey(translatedLabel) !== normalizeTextKey(modeValue);
    const label = showRawValue ? `${translatedLabel} (${modeValue})` : translatedLabel;

    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-mode-list-field="${escapeHtml(field)}"
          data-mode-value="${escapeHtml(modeValue)}"
          ${this._isModeVisible(field, modeValue) ? "checked" : ""}
        />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(label)}</span>
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

  _renderHumidifierEntityField(label, field, value, options = {}) {
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="humidifier-entity"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
        ></div>
      </div>
    `;
  }

  _renderSelectEntityField(label, field, value, options = {}) {
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="select-entity"
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

  _mountHumidifierEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.includeDomains = ["humidifier"];
      control.allowCustomEntity = true;
      control.entityFilter = stateObj => String(stateObj?.entity_id || "").startsWith("humidifier.");
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: {
          domain: "humidifier",
        },
      };
    } else {
      control = document.createElement("select");
      this._getHumidifierEntityOptions().forEach(option => {
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

  _mountSelectEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "mode_entity";
    const nextValue = host.dataset.value || "";
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.includeDomains = ["select", "input_select"];
      control.allowCustomEntity = true;
      control.entityFilter = stateObj => {
        const entityId = String(stateObj?.entity_id || "");
        return entityId.startsWith("select.") || entityId.startsWith("input_select.");
      };
    } else {
      control = document.createElement("select");
      this._getSelectEntityOptions(field).forEach(option => {
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

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";
    const modeVisibilityOptions = this._getModeVisibilityOptions();
    const fanModeVisibilityOptions = this._getFanModeVisibilityOptions();

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
          height: 18px;
          width: 18px;
        }

        .editor-color-picker .editor-color-swatch {
          height: 22px;
          width: 22px;
        }

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }

        .editor-subsection {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px;
          display: grid;
          gap: 10px;
          padding: 12px;
        }

        .editor-subsection__title {
          font-size: 12px;
          font-weight: 700;
        }

        .editor-subsection__hint {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
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
            <div class="editor-section__hint">Entidad principal, nombre visible e icono de la tarjeta.</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderHumidifierEntityField("Entidad principal", "entity", config.entity, {
              placeholder: "humidifier.deshumidificador",
              fullWidth: true,
            })}
            ${this._renderIconPickerField("Icono", "icon", config.icon, {
              placeholder: "mdi:air-humidifier",
              fullWidth: true,
            })}
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Deshumidificador",
              fullWidth: true,
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Entidades auxiliares</div>
            <div class="editor-section__hint">Selectores opcionales para el modo principal y la ventilación.</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderSelectEntityField("Selector de modo", "mode_entity", config.mode_entity, {
              placeholder: "select.deshumidificador_modo",
              fullWidth: true,
            })}
            ${this._renderSelectEntityField("Selector de ventilación", "fan_mode_entity", config.fan_mode_entity, {
              placeholder: "select.deshumidificador_ventilador",
              fullWidth: true,
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Visibilidad</div>
            <div class="editor-section__hint">Activa u oculta cada bloque de la tarjeta.</div>
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
            ${this._renderCheckboxField("Mostrar estado actual", "show_state", config.show_state === true)}
            ${this._renderCheckboxField("Mostrar chip de humedad objetivo", "show_target_humidity_chip", config.show_target_humidity_chip !== false)}
            ${this._renderCheckboxField("Mostrar chip de modo", "show_mode_chip", config.show_mode_chip !== false)}
            ${this._renderCheckboxField("Mostrar chip de ventilación", "show_fan_mode_chip", config.show_fan_mode_chip !== false)}
            ${this._renderCheckboxField("Mostrar control deslizante", "show_slider", config.show_slider !== false)}
            ${this._renderCheckboxField("Mostrar botón de modo", "show_mode_button", config.show_mode_button !== false)}
            ${this._renderCheckboxField("Mostrar botón de ventilación", "show_fan_mode_button", config.show_fan_mode_button !== false)}
            ${
              modeVisibilityOptions.length
                ? `
                  <div class="editor-subsection editor-field--full">
                    <div class="editor-subsection__title">Modos visibles</div>
                    <div class="editor-subsection__hint">Oculta los modos que expone la integración pero no quieres mostrar en la tarjeta.</div>
                    <div class="editor-grid editor-grid--stacked">
                      ${modeVisibilityOptions.map(mode => this._renderModeVisibilityField("hidden_modes", mode)).join("")}
                    </div>
                  </div>
                `
                : ""
            }
            ${
              fanModeVisibilityOptions.length
                ? `
                  <div class="editor-subsection editor-field--full">
                    <div class="editor-subsection__title">Velocidades visibles</div>
                    <div class="editor-subsection__hint">Elige qué opciones de ventilación quieres dejar disponibles.</div>
                    <div class="editor-grid editor-grid--stacked">
                      ${fanModeVisibilityOptions.map(mode => this._renderModeVisibilityField("hidden_fan_modes", mode)).join("")}
                    </div>
                  </div>
                `
                : ""
            }
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Respuesta háptica</div>
            <div class="editor-section__hint">Respuesta táctil opcional al usar los controles.</div>
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
            <div class="editor-section__title">Animaciones</div>
            <div class="editor-section__hint">Transiciones suaves al encender, apagar, desplegar controles, cambiar paneles y dar respuesta visual a los botones.</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${this._showAnimationSection ? "Ocultar ajustes de animación" : "Mostrar ajustes de animación"}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("Activar animaciones", "animations.enabled", config.animations.enabled !== false)}
                  ${this._renderTextField("Encendido y apagado (ms)", "animations.power_duration", config.animations.power_duration, {
                    type: "number",
                    valueType: "number",
                    min: 120,
                    max: 4000,
                    step: 10,
                  })}
                  ${this._renderTextField("Expansión de controles (ms)", "animations.controls_duration", config.animations.controls_duration, {
                    type: "number",
                    valueType: "number",
                    min: 120,
                    max: 2400,
                    step: 10,
                  })}
                  ${this._renderTextField("Paneles (ms)", "animations.panel_duration", config.animations.panel_duration, {
                    type: "number",
                    valueType: "number",
                    min: 120,
                    max: 2400,
                    step: 10,
                  })}
                  ${this._renderTextField("Rebote de botones (ms)", "animations.button_bounce_duration", config.animations.button_bounce_duration, {
                    type: "number",
                    valueType: "number",
                    min: 120,
                    max: 1200,
                    step: 10,
                  })}
                </div>
              `
              : ""
          }
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
                  ${this._renderColorField("Color icono activo", "styles.icon.on_color", config.styles.icon.on_color)}
                  ${this._renderColorField("Color icono inactivo", "styles.icon.off_color", config.styles.icon.off_color)}
                  ${this._renderTextField("Tamaño botones auxiliares", "styles.control.size", config.styles.control.size)}
                  ${this._renderColorField("Fondo de acento", "styles.control.accent_background", config.styles.control.accent_background)}
                  ${this._renderColorField("Color de acento", "styles.control.accent_color", config.styles.control.accent_color)}
                  ${this._renderTextField("Alto burbuja informativa", "styles.chip_height", config.styles.chip_height)}
                  ${this._renderTextField("Texto burbuja informativa", "styles.chip_font_size", config.styles.chip_font_size)}
                  ${this._renderTextField("Relleno burbuja informativa", "styles.chip_padding", config.styles.chip_padding)}
                  ${this._renderTextField("Tamaño del título", "styles.title_size", config.styles.title_size)}
                  ${this._renderTextField("Alto del contenedor del slider", "styles.slider_wrap_height", config.styles.slider_wrap_height)}
                  ${this._renderTextField("Grosor del slider", "styles.slider_height", config.styles.slider_height)}
                  ${this._renderColorField("Color del slider", "styles.slider_color", config.styles.slider_color)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="humidifier-entity"]')
      .forEach(host => this._mountHumidifierEntityPicker(host));

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="select-entity"]')
      .forEach(host => this._mountSelectEntityPicker(host));

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
  customElements.define(EDITOR_TAG, NodaliaHumidifierCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Humidifier Card",
  description: "Tarjeta de humidificador o deshumidificador con control visual de humedad y modos.",
  preview: true,
});
