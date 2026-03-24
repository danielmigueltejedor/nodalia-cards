const CARD_TAG = "nodalia-light-card";
const EDITOR_TAG = "nodalia-light-card-editor";
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
const COLOR_PRESETS = [
  { color: "#ffd166", hs: [42, 60], label: "Calida" },
  { color: "#fff1c1", hs: [48, 18], label: "Suave" },
  { color: "#ff7f50", hs: [16, 72], label: "Atardecer" },
  { color: "#ff4d6d", hs: [348, 70], label: "Rosa" },
  { color: "#4dabf7", hs: [210, 70], label: "Azul" },
  { color: "#38d9a9", hs: [160, 68], label: "Menta" },
];

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  show_state: false,
  compact_layout_mode: "auto",
  show_brightness: true,
  show_slider_mode_buttons: true,
  show_quick_brightness: true,
  show_color_controls: true,
  show_temperature_controls: true,
  quick_brightness: [10, 35, 65, 100],
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
      on_color: "var(--warning-color, #f6b73c)",
      off_color: "var(--state-inactive-color, rgba(255, 255, 255, 0.5))",
    },
    control: {
      size: "40px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(var(--rgb-primary-color), 0.18)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    title_size: "14px",
    slider_wrap_height: "56px",
    slider_height: "16px",
    slider_thumb_size: "28px",
    slider_color: "var(--primary-color)",
  },
};

const STUB_CONFIG = {
  entity: "light.salon",
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

function isUnavailableState(state) {
  return String(state?.state || "").toLowerCase() === "unavailable";
}

function rgbToHs(rgb) {
  if (!Array.isArray(rgb) || rgb.length !== 3) {
    return null;
  }

  const [rawRed, rawGreen, rawBlue] = rgb.map(value => clamp(Number(value) / 255, 0, 1));
  const max = Math.max(rawRed, rawGreen, rawBlue);
  const min = Math.min(rawRed, rawGreen, rawBlue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === rawRed) {
      hue = ((rawGreen - rawBlue) / delta) % 6;
    } else if (max === rawGreen) {
      hue = (rawBlue - rawRed) / delta + 2;
    } else {
      hue = (rawRed - rawGreen) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
  }

  const saturation = max === 0 ? 0 : (delta / max) * 100;
  return [Math.round(hue), Math.round(saturation)];
}

function arrayFromCsv(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
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

function miredToKelvin(value) {
  return value > 0 ? Math.round(1000000 / value) : 0;
}

function kelvinToMired(value) {
  return value > 0 ? Math.round(1000000 / value) : 0;
}

function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});

  if (!Array.isArray(config.quick_brightness) || !config.quick_brightness.length) {
    config.quick_brightness = deepClone(DEFAULT_CONFIG.quick_brightness);
  }

  config.quick_brightness = config.quick_brightness
    .map(value => Number(value))
    .filter(value => Number.isFinite(value))
    .map(value => clamp(Math.round(value), 1, 100));

  if (!config.quick_brightness.length) {
    config.quick_brightness = deepClone(DEFAULT_CONFIG.quick_brightness);
  }

  return config;
}

class NodaliaLightCard extends HTMLElement {
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
    this._draftBrightness = new Map();
    this._draftTemperature = new Map();
    this._draftHue = new Map();
    this._activeControlMode = "brightness";
    this._cardWidth = 0;
    this._isCompactLayout = false;
    this._activeSliderDrag = null;
    this._pendingRenderAfterDrag = false;
    this._skipNextSliderChange = null;
    this._dragFrame = 0;
    this._pendingDragUpdate = null;
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
    this._pendingDragUpdate = null;
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._isCompactLayout = this._shouldUseCompactLayout(
      Math.round(this._cardWidth || this.clientWidth || 0),
    );
    this._render();
  }

  set hass(hass) {
    this._hass = hass;

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
      columns: 4,
      rows: 3,
      min_columns: 2,
      min_rows: 2,
    };
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

  _getMiniLayoutThreshold() {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const iconSize = parseSizeToPixels(styles?.icon?.size, 58);
    const cardPadding = parseSizeToPixels(styles?.card?.padding, 14);

    return Math.max(
      116,
      Math.round(iconSize + (cardPadding * 2) + 12),
    );
  }

  _shouldUseMiniLayout(width = Math.round(this._cardWidth || this.clientWidth || 0)) {
    const gridColumns = this._getConfiguredGridColumns();
    if (gridColumns !== null) {
      return gridColumns <= 2;
    }

    return width > 0 && width < this._getMiniLayoutThreshold();
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

  _triggerHaptic(style = this._config?.haptics?.style) {
    if (!this._config?.haptics?.enabled) {
      return;
    }

    const hapticStyle = String(style || "selection");

    try {
      fireEvent(this, "haptic", hapticStyle);
    } catch (_error) {
      // Ignore event dispatch issues and try vibration fallback below.
    }

    if (
      !this._config.haptics.fallback_vibrate ||
      typeof navigator === "undefined" ||
      typeof navigator.vibrate !== "function"
    ) {
      return;
    }

    navigator.vibrate(HAPTIC_PATTERNS[hapticStyle] || HAPTIC_PATTERNS.selection);
  }

  _getState() {
    if (!this._config?.entity || !this._hass?.states) {
      return null;
    }

    return this._hass.states[this._config.entity] || null;
  }

  _supportsBrightness(state) {
    if (typeof state?.attributes?.brightness === "number") {
      return true;
    }

    const supportedColorModes = Array.isArray(state?.attributes?.supported_color_modes)
      ? state.attributes.supported_color_modes
      : [];

    return supportedColorModes.some(mode =>
      ["brightness", "color_temp", "hs", "rgb", "rgbw", "rgbww", "xy", "white"].includes(mode),
    );
  }

  _supportsColor(state) {
    const supportedColorModes = Array.isArray(state?.attributes?.supported_color_modes)
      ? state.attributes.supported_color_modes
      : [];

    return supportedColorModes.some(mode =>
      ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(mode),
    );
  }

  _supportsColorTemperature(state) {
    const supportedColorModes = Array.isArray(state?.attributes?.supported_color_modes)
      ? state.attributes.supported_color_modes
      : [];

    return (
      supportedColorModes.includes("color_temp") ||
      typeof state?.attributes?.color_temp_kelvin === "number" ||
      typeof state?.attributes?.color_temp === "number"
    );
  }

  _getBrightnessPercent(state) {
    const entityId = this._config?.entity;
    if (entityId && this._draftBrightness.has(entityId)) {
      return clamp(Number(this._draftBrightness.get(entityId)), 1, 100);
    }

    if (typeof state?.attributes?.brightness === "number") {
      return clamp(Math.round((state.attributes.brightness / 255) * 100), 1, 100);
    }

    return state?.state === "on" ? 100 : 50;
  }

  _getTemperatureRange(state) {
    const minKelvin = Number(state?.attributes?.min_color_temp_kelvin);
    const maxKelvin = Number(state?.attributes?.max_color_temp_kelvin);

    if (Number.isFinite(minKelvin) && Number.isFinite(maxKelvin) && minKelvin > 0 && maxKelvin > 0) {
      return {
        min: Math.min(minKelvin, maxKelvin),
        max: Math.max(minKelvin, maxKelvin),
      };
    }

    const minMireds = Number(state?.attributes?.min_mireds);
    const maxMireds = Number(state?.attributes?.max_mireds);

    if (Number.isFinite(minMireds) && Number.isFinite(maxMireds) && minMireds > 0 && maxMireds > 0) {
      const min = miredToKelvin(Math.max(minMireds, maxMireds));
      const max = miredToKelvin(Math.min(minMireds, maxMireds));
      return {
        min: Math.min(min, max),
        max: Math.max(min, max),
      };
    }

    return {
      min: 2200,
      max: 6500,
    };
  }

  _getTemperatureControlDomain(state) {
    const minMireds = Number(state?.attributes?.min_mireds);
    const maxMireds = Number(state?.attributes?.max_mireds);

    if (Number.isFinite(minMireds) && Number.isFinite(maxMireds) && minMireds > 0 && maxMireds > 0) {
      return {
        unit: "mired",
        min: Math.min(minMireds, maxMireds),
        max: Math.max(minMireds, maxMireds),
        step: 1,
      };
    }

    const range = this._getTemperatureRange(state);
    return {
      unit: "kelvin",
      min: range.min,
      max: range.max,
      step: 25,
    };
  }

  _temperatureSliderValueToKelvin(value, state) {
    const domain = this._getTemperatureControlDomain(state);
    const boundedValue = clamp(Math.round(Number(value)), domain.min, domain.max);
    return domain.unit === "mired" ? miredToKelvin(boundedValue) : boundedValue;
  }

  _kelvinToTemperatureSliderValue(kelvin, state) {
    const domain = this._getTemperatureControlDomain(state);
    const numericKelvin = clamp(Math.round(Number(kelvin)), 1, 100000);
    const nextValue = domain.unit === "mired" ? kelvinToMired(numericKelvin) : numericKelvin;
    return clamp(Math.round(nextValue), domain.min, domain.max);
  }

  _getCurrentKelvin(state) {
    const entityId = this._config?.entity;
    if (entityId && this._draftTemperature.has(entityId)) {
      return this._draftTemperature.get(entityId);
    }

    if (typeof state?.attributes?.color_temp_kelvin === "number") {
      return Math.round(state.attributes.color_temp_kelvin);
    }

    if (typeof state?.attributes?.color_temp === "number") {
      return miredToKelvin(state.attributes.color_temp);
    }

    const range = this._getTemperatureRange(state);
    return Math.round((range.min + range.max) / 2);
  }

  _getCurrentHue(state) {
    const entityId = this._config?.entity;
    if (entityId && this._draftHue.has(entityId)) {
      return this._draftHue.get(entityId);
    }

    const hsColor = Array.isArray(state?.attributes?.hs_color) ? state.attributes.hs_color : null;
    if (hsColor?.length === 2 && hsColor.every(value => Number.isFinite(Number(value)))) {
      return clamp(Math.round(Number(hsColor[0])), 0, 360);
    }

    const rgbColor = Array.isArray(state?.attributes?.rgb_color) ? state.attributes.rgb_color : null;
    const derivedHs = rgbToHs(rgbColor);
    if (derivedHs) {
      return clamp(derivedHs[0], 0, 360);
    }

    return 42;
  }

  _getCurrentSaturation(state) {
    const hsColor = Array.isArray(state?.attributes?.hs_color) ? state.attributes.hs_color : null;
    if (hsColor?.length === 2 && hsColor.every(value => Number.isFinite(Number(value)))) {
      return clamp(Math.round(Number(hsColor[1])), 0, 100);
    }

    const rgbColor = Array.isArray(state?.attributes?.rgb_color) ? state.attributes.rgb_color : null;
    const derivedHs = rgbToHs(rgbColor);
    if (derivedHs) {
      return clamp(derivedHs[1], 0, 100);
    }

    return 75;
  }

  _getTemperaturePresets(state) {
    const range = this._getTemperatureRange(state);
    const middle = Math.round((range.min + range.max) / 2);

    return [
      { label: "Calida", kelvin: range.min },
      { label: "Neutra", kelvin: middle },
      { label: "Fria", kelvin: range.max },
    ];
  }

  _getStateLabel(state) {
    switch (state?.state) {
      case "on":
        return "Encendida";
      case "off":
        return "Apagada";
      case "unavailable":
        return "No disponible";
      case "unknown":
        return "Desconocida";
      default:
        return state?.state ? String(state.state) : "Sin estado";
    }
  }

  _getLightName(state) {
    if (this._config?.name) {
      return this._config.name;
    }

    if (state?.attributes?.friendly_name) {
      return state.attributes.friendly_name;
    }

    return this._config?.entity || "Luz";
  }

  _getLightIcon(state) {
    return this._config?.icon || state?.attributes?.icon || "mdi:lightbulb";
  }

  _getAccentColor(state) {
    const rgbColor = Array.isArray(state?.attributes?.rgb_color) ? state.attributes.rgb_color : null;
    if (state?.state === "on" && rgbColor?.length === 3) {
      return `rgb(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]})`;
    }

    if (state?.state === "on") {
      const kelvin = this._getCurrentKelvin(state);
      if (kelvin >= 5200) {
        return "#8fd3ff";
      }

      if (kelvin <= 3000) {
        return "#f4b55f";
      }

      return "#ffd166";
    }

    return this._config?.styles?.icon?.off_color || "var(--state-inactive-color, rgba(255, 255, 255, 0.45))";
  }

  _setLightState(data = {}) {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    this._hass.callService("light", "turn_on", {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _toggleLight() {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    this._hass.callService("light", "toggle", {
      entity_id: this._config.entity,
    });
  }

  _commitBrightness(percent) {
    if (!Number.isFinite(percent)) {
      return;
    }

    this._setLightState({
      brightness_pct: clamp(Math.round(percent), 1, 100),
    });
  }

  _commitColorPreset(hs) {
    this._setLightState({
      hs_color: hs,
    });
  }

  _commitColorHue(hue, state) {
    const numericHue = clamp(Math.round(Number(hue)), 0, 360);
    if (!Number.isFinite(numericHue)) {
      return;
    }

    const saturation = Math.max(this._getCurrentSaturation(state), 50);
    this._setLightState({
      hs_color: [numericHue, saturation],
    });
  }

  _commitTemperaturePreset(kelvin) {
    const range = this._getTemperatureRange(this._getState());
    const numericKelvin = clamp(Math.round(Number(kelvin)), range.min, range.max);
    if (!Number.isFinite(numericKelvin) || numericKelvin <= 0) {
      return;
    }

    this._setLightState({
      color_temp_kelvin: numericKelvin,
    });
  }

  _updateBrightnessPreview(value) {
    const slider = this.shadowRoot?.querySelector('.light-card__slider[data-light-control="brightness"]');
    const nextValue = clamp(Number(value), 1, 100);

    if (slider instanceof HTMLInputElement) {
      slider.style.setProperty("--brightness", String(nextValue));
    }
  }

  _updateTemperaturePreview(value, state) {
    const slider = this.shadowRoot?.querySelector('.light-card__slider[data-light-control="temperature"]');
    const domain = this._getTemperatureControlDomain(state);
    const boundedValue = clamp(Number(value), domain.min, domain.max);
    const percent = domain.max === domain.min
      ? 0
      : ((boundedValue - domain.min) / (domain.max - domain.min)) * 100;

    if (slider instanceof HTMLInputElement) {
      slider.style.setProperty("--temperature-progress", String(clamp(percent, 0, 100)));
    }
  }

  _updateColorPreview(value) {
    const slider = this.shadowRoot?.querySelector('.light-card__slider[data-light-control="color"]');
    const nextValue = clamp(Math.round(Number(value)), 0, 360);
    const percent = (nextValue / 360) * 100;

    if (slider instanceof HTMLInputElement) {
      slider.style.setProperty("--color-progress", String(clamp(percent, 0, 100)));
    }
  }

  _applySliderValue(slider, value, options = {}) {
    const commit = options.commit === true;

    switch (slider.dataset.lightControl) {
      case "brightness": {
        const nextValue = clamp(Number(value), 1, 100);
        this._draftBrightness.set(this._config.entity, nextValue);
        this._updateBrightnessPreview(nextValue);
        if (commit) {
          this._triggerHaptic("selection");
          this._commitBrightness(nextValue);
        }
        break;
      }
      case "temperature": {
        const state = this._getState();
        const domain = this._getTemperatureControlDomain(state);
        const nextValue = clamp(Number(value), domain.min, domain.max);
        const nextKelvin = this._temperatureSliderValueToKelvin(nextValue, state);
        this._draftTemperature.set(this._config.entity, nextKelvin);
        this._updateTemperaturePreview(nextValue, state);
        if (commit) {
          this._triggerHaptic("selection");
          this._commitTemperaturePreset(nextKelvin);
        }
        break;
      }
      case "color": {
        const state = this._getState();
        const nextValue = clamp(Math.round(Number(value)), 0, 360);
        this._draftHue.set(this._config.entity, nextValue);
        this._updateColorPreview(nextValue);
        if (commit) {
          this._triggerHaptic("selection");
          this._commitColorHue(nextValue, state);
        }
        break;
      }
      default:
        break;
    }
  }

  _onShadowPointerDown(event) {
    const slider = event
      .composedPath()
      .find(node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.lightControl,
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
        node.dataset?.lightControl,
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
        node.dataset?.lightControl,
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

  _getAvailableControlModes(state) {
    const modes = [];

    if (this._config?.show_brightness !== false && this._supportsBrightness(state)) {
      modes.push("brightness");
    }

    if (this._config?.show_temperature_controls !== false && this._supportsColorTemperature(state)) {
      modes.push("temperature");
    }

    if (this._config?.show_color_controls !== false && this._supportsColor(state)) {
      modes.push("color");
    }

    return modes;
  }

  _getActiveControlMode(state) {
    const availableModes = this._getAvailableControlModes(state);
    if (!availableModes.length) {
      return null;
    }

    if (availableModes.includes(this._activeControlMode)) {
      return this._activeControlMode;
    }

    this._activeControlMode = availableModes[0];
    return this._activeControlMode;
  }

  _getControlModeIcon(mode) {
    switch (mode) {
      case "temperature":
        return "mdi:thermometer";
      case "color":
        return "mdi:palette";
      case "brightness":
      default:
        return "mdi:brightness-6";
    }
  }

  _onShadowInput(event) {
    const slider = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.lightControl);

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
      .find(node => node instanceof HTMLInputElement && node.dataset?.lightControl);

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
      node => node instanceof HTMLInputElement && node.dataset?.lightControl,
    );

    if (slider) {
      return;
    }

    const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.lightAction);

    if (!actionButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();

    switch (actionButton.dataset.lightAction) {
      case "toggle":
        this._toggleLight();
        break;
      case "mode":
        this._activeControlMode = actionButton.dataset.mode || "brightness";
        this._render();
        break;
      case "brightness": {
        const value = Number(actionButton.dataset.value);
        this._draftBrightness.set(this._config.entity, clamp(Math.round(value), 1, 100));
        this._commitBrightness(value);
        this._render();
        break;
      }
      case "color": {
        const hs = String(actionButton.dataset.hs || "")
          .split(",")
          .map(value => Number(value));
        if (hs.length === 2 && hs.every(value => Number.isFinite(value))) {
          this._commitColorPreset(hs);
        }
        break;
      }
      case "temperature":
        this._commitTemperaturePreset(Number(actionButton.dataset.kelvin));
        break;
      default:
        break;
    }
  }

  _renderEmptyState() {
    return `
      <ha-card class="light-card light-card--empty">
        <div class="light-card__empty-title">Nodalia Light Card</div>
        <div class="light-card__empty-text">Configura \`entity\` con una entidad \`light.*\` para mostrar la tarjeta.</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    if (!this._config) {
      this.shadowRoot.innerHTML = "";
      return;
    }

    const state = this._getState();
    const config = this._config;
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

          .light-card--empty {
            background: ${styles.card.background};
            border: ${styles.card.border};
            border-radius: ${styles.card.border_radius};
            box-shadow: ${styles.card.box_shadow};
            display: grid;
            gap: 6px;
            padding: ${styles.card.padding};
          }

          .light-card__empty-title {
            color: var(--primary-text-color);
            font-size: 15px;
            font-weight: 700;
          }

          .light-card__empty-text {
            color: var(--secondary-text-color);
            font-size: 13px;
            line-height: 1.5;
          }
        </style>
        ${this._renderEmptyState()}
      `;
      return;
    }

    const isOn = state.state === "on";
    const supportsBrightness = this._supportsBrightness(state);
    const supportsColor = this._supportsColor(state);
    const supportsColorTemperature = this._supportsColorTemperature(state);
    const brightnessPercent = this._getBrightnessPercent(state);
    const currentKelvin = this._getCurrentKelvin(state);
    const accentColor = this._getAccentColor(state);
    const title = this._getLightName(state);
    const icon = this._getLightIcon(state);
    const showUnavailableBadge = isUnavailableState(state);
    const stateLabel = this._getStateLabel(state);
    const isCompactLayout = this._isCompactLayout;
    const isMiniLayout = this._shouldUseMiniLayout();
    const quickBrightness = Array.isArray(config.quick_brightness) ? config.quick_brightness : [];
    const temperaturePresets = this._getTemperaturePresets(state);
    const availableControlModes = isOn ? this._getAvailableControlModes(state) : [];
    const useSliderModeButtons = config.show_slider_mode_buttons !== false && availableControlModes.length > 1;
    const activeControlMode = isOn ? this._getActiveControlMode(state) : "brightness";
    const currentHue = this._getCurrentHue(state);
    const temperatureRange = this._getTemperatureRange(state);
    const temperatureControlDomain = this._getTemperatureControlDomain(state);
    const currentTemperatureSliderValue = this._kelvinToTemperatureSliderValue(currentKelvin, state);
    const temperatureProgress = temperatureControlDomain.max === temperatureControlDomain.min
      ? 0
      : ((currentTemperatureSliderValue - temperatureControlDomain.min) / (temperatureControlDomain.max - temperatureControlDomain.min)) * 100;
    const colorProgress = (currentHue / 360) * 100;
    const chips = [];
    const onCardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 52%, ${styles.card.background} 100%)`;
    const onCardBorder = `color-mix(in srgb, ${accentColor} 32%, var(--divider-color))`;
    const onCardShadow = `0 16px 32px color-mix(in srgb, ${accentColor} 18%, rgba(0, 0, 0, 0.18))`;

    if (!isMiniLayout && config.show_state === true) {
      chips.push(`<span class="light-card__chip light-card__chip--state">${escapeHtml(stateLabel)}</span>`);
    }

    if (isOn && !isMiniLayout) {
      let activeValueChip = null;

      if (activeControlMode === "temperature" && config.show_temperature_controls !== false && supportsColorTemperature) {
        activeValueChip = `${currentKelvin}K`;
      } else if (activeControlMode === "color" && config.show_color_controls !== false && supportsColor) {
        activeValueChip = `${currentHue}°`;
      } else if (config.show_brightness !== false && supportsBrightness) {
        activeValueChip = `${Math.round(brightnessPercent)}%`;
      }

      if (activeValueChip) {
        chips.push(`<span class="light-card__chip">${escapeHtml(activeValueChip)}</span>`);
      }
    }

    const showCopyBlock = !isMiniLayout && (!isCompactLayout || chips.length > 0);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }

        * {
          box-sizing: border-box;
        }

        ha-card.light-card {
          background: ${isOn ? onCardBackground : styles.card.background};
          border: ${isOn ? `1px solid ${onCardBorder}` : styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${isOn ? `${styles.card.box_shadow}, ${onCardShadow}` : styles.card.box_shadow};
          display: block;
          isolation: isolate;
          overflow: hidden;
          padding: ${styles.card.padding};
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .light-card.is-off {
          cursor: pointer;
        }

        .light-card--compact.is-off {
          align-items: center;
          display: flex;
          min-height: 100%;
        }

        .light-card--mini {
          align-items: center;
          display: flex;
          justify-content: center;
          min-height: 100%;
        }

        .light-card::before {
          background: ${isOn
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, rgba(255, 255, 255, 0.06)), rgba(255, 255, 255, 0))`
            : "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0))"};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .light-card__content {
          display: grid;
          gap: calc(${styles.card.gap} + 4px);
          position: relative;
          z-index: 1;
        }

        .light-card--mini .light-card__content {
          align-content: center;
          justify-items: center;
          min-height: 100%;
          width: 100%;
        }

        .light-card--compact.is-off .light-card__content {
          align-content: center;
          min-height: 100%;
          width: 100%;
        }

        .light-card__hero {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: ${styles.icon.size} minmax(0, 1fr);
          min-width: 0;
        }

        .light-card--mini .light-card__hero {
          gap: 0;
          grid-template-columns: 1fr;
          justify-items: center;
        }

        .light-card--compact .light-card__hero {
          gap: 10px;
          grid-template-columns: 1fr;
          justify-items: center;
        }

        .light-card--compact.is-off .light-card__hero {
          align-content: center;
        }

        .light-card--compact.is-off:not(.light-card--with-copy) .light-card__hero {
          gap: 0;
        }

        .light-card__icon,
        .light-card__brightness-preset,
        .light-card__temperature-preset,
        .light-card__color-preset {
          align-items: center;
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          justify-content: center;
          line-height: 0;
          padding: 0;
          position: relative;
        }

        .light-card__icon {
          background: ${isOn
            ? `color-mix(in srgb, ${accentColor} 24%, rgba(255, 255, 255, 0.08))`
            : "rgba(255, 255, 255, 0.06)"};
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${isOn ? styles.icon.on_color : styles.icon.off_color};
          cursor: pointer;
          height: ${styles.icon.size};
          width: ${styles.icon.size};
        }

        .light-card--mini .light-card__icon {
          height: min(${styles.icon.size}, calc(100vw - 48px));
          width: min(${styles.icon.size}, calc(100vw - 48px));
        }

        .light-card__icon ha-icon {
          align-items: center;
          display: inline-flex;
          height: 22px;
          justify-content: center;
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 22px;
          z-index: 1;
        }

        .light-card__icon ha-icon {
          color: ${isOn ? styles.icon.color : styles.icon.off_color};
          font-size: 26px;
        }

        .light-card__unavailable-badge {
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

        .light-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          color: inherit;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .light-card__copy {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .light-card--compact .light-card__copy {
          justify-items: center;
          text-align: center;
          width: 100%;
        }

        .light-card__title {
          color: var(--primary-text-color);
          font-size: ${styles.title_size};
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .light-card__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .light-card--compact .light-card__chips {
          justify-content: center;
        }

        .light-card__chip {
          align-items: center;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: ${styles.chip_font_size};
          font-weight: 600;
          line-height: 1;
          min-height: ${styles.chip_height};
          padding: ${styles.chip_padding};
        }

        .light-card__chip--state {
          color: var(--primary-text-color);
        }

        .light-card__section {
          display: grid;
          gap: 10px;
        }

        .light-card__section-header {
          align-items: center;
          color: var(--secondary-text-color);
          display: flex;
          font-size: 12px;
          font-weight: 600;
          justify-content: space-between;
          min-width: 0;
        }

        .light-card__section-value {
          color: var(--primary-text-color);
          font-variant-numeric: tabular-nums;
        }

        .light-card__slider-wrap {
          align-items: center;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          display: grid;
          min-height: ${styles.slider_wrap_height};
          padding: 0 16px;
        }

        .light-card__slider-row {
          align-items: center;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .light-card__mode-actions {
          display: flex;
          gap: 10px;
        }

        .light-card__mode-button {
          align-items: center;
          appearance: none;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: ${styles.control.size};
          justify-content: center;
          line-height: 0;
          min-width: ${styles.control.size};
          padding: 0;
          position: relative;
          width: ${styles.control.size};
        }

        .light-card__mode-button ha-icon {
          --mdc-icon-size: 20px;
          align-items: center;
          display: inline-flex;
          justify-content: center;
        }

        .light-card__slider {
          -webkit-appearance: none;
          appearance: none;
          border-radius: 999px;
          cursor: pointer;
          display: block;
          height: max(44px, calc(${styles.slider_height} + 18px));
          outline: none;
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
          width: 100%;
        }

        .light-card__slider[data-light-control="brightness"] {
          background:
            linear-gradient(
              90deg,
              ${styles.slider_color} 0%,
              ${styles.slider_color} calc(var(--brightness, ${brightnessPercent}) * 1%),
              rgba(255, 255, 255, 0.08) calc(var(--brightness, ${brightnessPercent}) * 1%),
              rgba(255, 255, 255, 0.08) 100%
            );
        }

        .light-card__slider[data-light-control="temperature"] {
          background: linear-gradient(
            90deg,
            #f4b55f 0%,
            #ffd166 32%,
            #fff1c1 56%,
            #8fd3ff 100%
          );
        }

        .light-card__slider[data-light-control="color"] {
          background: linear-gradient(
            90deg,
            #ff4d6d 0%,
            #ff9f1c 17%,
            #ffe66d 33%,
            #4cd964 50%,
            #4dabf7 67%,
            #845ef7 83%,
            #ff4d6d 100%
          );
        }

        .light-card__slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: var(--primary-text-color);
          background-clip: padding-box;
          border: 6px solid transparent;
          border-radius: 50%;
          box-shadow: 0 0 0 calc(${styles.slider_thumb_size} * 0.22) rgba(255, 255, 255, 0.12);
          box-sizing: border-box;
          cursor: pointer;
          height: calc(${styles.slider_thumb_size} + 12px);
          width: calc(${styles.slider_thumb_size} + 12px);
        }

        .light-card__slider::-moz-range-thumb {
          background: var(--primary-text-color);
          background-clip: padding-box;
          border: 6px solid transparent;
          border-radius: 50%;
          box-shadow: 0 0 0 calc(${styles.slider_thumb_size} * 0.22) rgba(255, 255, 255, 0.12);
          box-sizing: border-box;
          cursor: pointer;
          height: calc(${styles.slider_thumb_size} + 12px);
          width: calc(${styles.slider_thumb_size} + 12px);
        }

        .light-card__slider::-moz-range-track {
          background: transparent;
          border: 0;
        }

        .light-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .light-card__brightness-preset,
        .light-card__temperature-preset {
          background: rgba(255, 255, 255, 0.05);
          color: var(--primary-text-color);
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          height: 34px;
          min-width: 46px;
          padding: 0 12px;
        }

        .light-card__brightness-preset.is-active,
        .light-card__temperature-preset.is-active {
          background: ${styles.control.accent_background};
          color: ${styles.control.accent_color};
        }

        .light-card__color-preset {
          background: rgba(255, 255, 255, 0.05);
          height: 32px;
          width: 32px;
        }

        .light-card__color-preset::after {
          background: var(--swatch-color);
          border-radius: inherit;
          content: "";
          inset: 5px;
          position: absolute;
        }

        @media (max-width: 420px) {
          .light-card__hero {
            grid-template-columns: 50px minmax(0, 1fr);
          }

          .light-card__icon {
            height: 50px;
            width: 50px;
          }
        }
      </style>
      <ha-card
        class="light-card ${isOn ? "is-on" : "is-off"} ${isCompactLayout ? "light-card--compact" : ""} ${isMiniLayout ? "light-card--mini" : ""} ${showCopyBlock ? "light-card--with-copy" : ""}"
        style="--accent-color:${escapeHtml(accentColor)};"
        data-light-action="toggle"
      >
        <div class="light-card__content">
          <div class="light-card__hero">
            <button
              type="button"
              class="light-card__icon"
              data-light-action="toggle"
              aria-label="Encender o apagar"
            >
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
              ${showUnavailableBadge ? `<span class="light-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${showCopyBlock
              ? `
                <div class="light-card__copy">
                  ${isCompactLayout ? "" : `<div class="light-card__title">${escapeHtml(title)}</div>`}
                  ${chips.length ? `<div class="light-card__chips">${chips.join("")}</div>` : ""}
                </div>
              `
              : ""}
          </div>

          ${
            isOn && !isMiniLayout && availableControlModes.length > 0
              ? `
                <div class="light-card__section">
                  <div class="light-card__slider-row">
                    <div class="light-card__slider-wrap">
                      ${
                        activeControlMode === "temperature"
                          ? `
                            <input
                              type="range"
                              class="light-card__slider"
                              data-light-control="temperature"
                              min="${temperatureControlDomain.min}"
                              max="${temperatureControlDomain.max}"
                              step="any"
                              value="${currentTemperatureSliderValue}"
                              style="--temperature-progress:${clamp(temperatureProgress, 0, 100)};"
                              aria-label="Temperatura"
                            />
                          `
                          : activeControlMode === "color"
                            ? `
                              <input
                                type="range"
                                class="light-card__slider"
                                data-light-control="color"
                                min="0"
                                max="360"
                                step="any"
                                value="${currentHue}"
                                style="--color-progress:${clamp(colorProgress, 0, 100)};"
                                aria-label="Color"
                              />
                            `
                            : `
                              <input
                                type="range"
                                class="light-card__slider"
                                data-light-control="brightness"
                                min="1"
                                max="100"
                                step="any"
                                value="${brightnessPercent}"
                                style="--brightness:${brightnessPercent};"
                                aria-label="Brillo"
                              />
                            `
                      }
                    </div>
                    ${
                      useSliderModeButtons
                        ? `
                          <div class="light-card__mode-actions">
                            ${availableControlModes
                              .filter(mode => mode !== activeControlMode)
                              .map(mode => `
                                <button
                                  type="button"
                                  class="light-card__mode-button"
                                  data-light-action="mode"
                                  data-mode="${mode}"
                                  aria-label="${mode === "brightness" ? "Mostrar brillo" : mode === "temperature" ? "Mostrar temperatura" : "Mostrar color"}"
                                >
                                  <ha-icon icon="${this._getControlModeIcon(mode)}"></ha-icon>
                                </button>
                              `)
                              .join("")}
                          </div>
                        `
                        : ""
                    }
                  </div>
                </div>
              `
              : ""
          }

          ${
            isOn &&
            !isMiniLayout &&
            activeControlMode === "brightness" &&
            config.show_quick_brightness !== false &&
            supportsBrightness &&
            quickBrightness.length
              ? `
                <div class="light-card__actions">
                  ${quickBrightness
                    .map(value => `
                      <button
                        type="button"
                        class="light-card__brightness-preset ${value === brightnessPercent ? "is-active" : ""}"
                        data-light-action="brightness"
                        data-value="${value}"
                      >
                        ${escapeHtml(`${value}%`)}
                      </button>
                    `)
                    .join("")}
                </div>
              `
              : ""
          }

          ${
            isOn &&
            !isMiniLayout &&
            !useSliderModeButtons &&
            config.show_temperature_controls !== false &&
            supportsColorTemperature
              ? `
                <div class="light-card__section">
                  <div class="light-card__section-header">
                    <span>Temperatura</span>
                    <span class="light-card__section-value">${escapeHtml(`${currentKelvin}K`)}</span>
                  </div>
                  <div class="light-card__actions">
                    ${temperaturePresets
                      .map(item => `
                        <button
                          type="button"
                          class="light-card__temperature-preset ${Math.abs(item.kelvin - currentKelvin) <= 250 ? "is-active" : ""}"
                          data-light-action="temperature"
                          data-kelvin="${item.kelvin}"
                        >
                          ${escapeHtml(item.label)}
                        </button>
                      `)
                      .join("")}
                  </div>
                </div>
              `
              : ""
          }

          ${
            isOn &&
            !isMiniLayout &&
            !useSliderModeButtons &&
            config.show_color_controls !== false &&
            supportsColor
              ? `
                <div class="light-card__section">
                  <div class="light-card__section-header">
                    <span>Color</span>
                    <span class="light-card__section-value">Presets</span>
                  </div>
                  <div class="light-card__actions">
                    ${COLOR_PRESETS
                      .map(item => `
                        <button
                          type="button"
                          class="light-card__color-preset"
                          style="--swatch-color:${escapeHtml(item.color)};"
                          data-light-action="color"
                          data-hs="${escapeHtml(item.hs.join(","))}"
                          aria-label="${escapeHtml(item.label)}"
                          title="${escapeHtml(item.label)}"
                        ></button>
                      `)
                      .join("")}
                  </div>
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
  customElements.define(CARD_TAG, NodaliaLightCard);
}

class NodaliaLightCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
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
    return Object.keys(hass?.states || {})
      .filter(entityId => entityId.startsWith("light."))
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
      case "csv": {
        const values = arrayFromCsv(input.value)
          .map(value => Number(value))
          .filter(value => Number.isFinite(value))
          .map(value => clamp(Math.round(value), 1, 100));
        return values.length ? values : undefined;
      }
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

  _onShadowClick() {}

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
    const entityIds = Object.keys(this._hass?.states || {})
      .filter(entityId => entityId.startsWith("light."))
      .sort((left, right) => left.localeCompare(right, "es"));

    if (!entityIds.length) {
      return "";
    }

    return `
      <datalist id="light-card-entities">
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
            <div class="editor-section__hint">Entidad principal y textos visibles de la tarjeta.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Entidad", "entity", config.entity, {
              placeholder: "light.salon",
            })}
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Salon",
            })}
            ${this._renderTextField("Icono", "icon", config.icon, {
              placeholder: "mdi:lightbulb",
            })}
            ${this._renderTextField(
              "Presets de brillo",
              "quick_brightness",
              Array.isArray(config.quick_brightness) ? config.quick_brightness.join(", ") : "",
              {
                valueType: "csv",
                placeholder: "10, 35, 65, 100",
              },
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Visibilidad</div>
            <div class="editor-section__hint">Que bloques quieres mostrar dentro de la tarjeta.</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "Layout estrecho",
              "compact_layout_mode",
              config.compact_layout_mode || "auto",
              [
                { value: "auto", label: "Automatico (<4 columnas)" },
                { value: "always", label: "Centrado siempre" },
                { value: "never", label: "Nunca centrar" },
              ],
            )}
            ${this._renderCheckboxField("Mostrar estado en burbuja", "show_state", config.show_state === true)}
            ${this._renderCheckboxField("Mostrar brillo", "show_brightness", config.show_brightness !== false)}
            ${this._renderCheckboxField("Botones de modo junto al slider", "show_slider_mode_buttons", config.show_slider_mode_buttons !== false)}
            ${this._renderCheckboxField("Presets de brillo", "show_quick_brightness", config.show_quick_brightness !== false)}
            ${this._renderCheckboxField("Controles de color", "show_color_controls", config.show_color_controls !== false)}
            ${this._renderCheckboxField("Controles de temperatura", "show_temperature_controls", config.show_temperature_controls !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Haptics</div>
            <div class="editor-section__hint">Respuesta haptica opcional para los controles.</div>
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
            <div class="editor-section__hint">Ajustes visuales basicos del look Nodalia.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Background", "styles.card.background", config.styles.card.background)}
            ${this._renderTextField("Border", "styles.card.border", config.styles.card.border)}
            ${this._renderTextField("Radius", "styles.card.border_radius", config.styles.card.border_radius)}
            ${this._renderTextField("Shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
            ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
            ${this._renderTextField("Separacion", "styles.card.gap", config.styles.card.gap)}
            ${this._renderTextField("Tamano boton principal", "styles.icon.size", config.styles.icon.size)}
            ${this._renderTextField("Color icono encendida", "styles.icon.on_color", config.styles.icon.on_color)}
            ${this._renderTextField("Color icono apagada", "styles.icon.off_color", config.styles.icon.off_color)}
            ${this._renderTextField("Tamano boton", "styles.control.size", config.styles.control.size)}
            ${this._renderTextField("Fondo acento", "styles.control.accent_background", config.styles.control.accent_background)}
            ${this._renderTextField("Color acento", "styles.control.accent_color", config.styles.control.accent_color)}
            ${this._renderTextField("Alto burbuja info", "styles.chip_height", config.styles.chip_height)}
            ${this._renderTextField("Texto burbuja info", "styles.chip_font_size", config.styles.chip_font_size)}
            ${this._renderTextField("Padding burbuja info", "styles.chip_padding", config.styles.chip_padding)}
            ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
            ${this._renderTextField("Alto contenedor slider", "styles.slider_wrap_height", config.styles.slider_wrap_height)}
            ${this._renderTextField("Grosor slider", "styles.slider_height", config.styles.slider_height)}
            ${this._renderTextField("Tamano thumb slider", "styles.slider_thumb_size", config.styles.slider_thumb_size)}
            ${this._renderTextField("Color slider", "styles.slider_color", config.styles.slider_color)}
          </div>
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('input[data-field="entity"]')
      .forEach(input => {
        input.setAttribute("list", "light-card-entities");
      });
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaLightCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Light Card",
  description: "Tarjeta de luz con estilo Nodalia, presets y editor visual.",
  preview: true,
});
