const CARD_TAG = "nodalia-fan-card";
const EDITOR_TAG = "nodalia-fan-card-editor";
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
  show_state: false,
  show_percentage_chip: true,
  show_mode_chip: true,
  show_slider: true,
  show_oscillation: true,
  show_preset_modes: true,
  hidden_preset_modes: [],
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
    preset_duration: 800,
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
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      on_color: "var(--info-color, #71c0ff)",
      off_color: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
    },
    control: {
      size: "40px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(113, 192, 255, 0.2)",
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
  entity: "fan.salon",
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
    return "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))";
  }

  if (normalizedField.endsWith("accent_background")) {
    return "rgba(113, 192, 255, 0.2)";
  }

  if (normalizedField.endsWith("progress_background")) {
    return "color-mix(in srgb, var(--primary-text-color) 12%, transparent)";
  }

  if (normalizedField.endsWith("overlay_color")) {
    return "rgba(0, 0, 0, 0.32)";
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

function translatePresetLabel(value) {
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
    case "breeze":
    case "natural":
    case "nature":
      return "Brisa";
    case "eco":
      return "Eco";
    case "turbo":
      return "Turbo";
    case "boost":
      return "Boost";
    case "low":
      return "Baja";
    case "medium":
    case "mid":
      return "Media";
    case "high":
      return "Alta";
    case "quiet":
    case "silent":
      return "Silencioso";
    case "normal":
    case "balanced":
      return "Normal";
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

  config.hidden_preset_modes = normalizeList(config.hidden_preset_modes);

  return config;
}

class NodaliaFanCard extends HTMLElement {
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
    this._draftPercentage = new Map();
    this._presetPanelOpen = false;
    this._cardWidth = 0;
    this._isCompactLayout = false;
    this._activeSliderDrag = null;
    this._pendingRenderAfterDrag = false;
    this._skipNextSliderChange = null;
    this._dragFrame = 0;
    this._pendingDragUpdate = null;
    this._lastRenderSignature = "";
    this._lastRenderedIsOn = null;
    this._lastRenderedPresetPanelVisible = false;
    this._lastControlsMarkup = "";
    this._lastPresetPanelMarkup = "";
    this._animationCleanupTimer = 0;
    this._powerTransition = null;
    this._controlsTransition = null;
    this._presetPanelTransition = null;
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
    this._presetPanelTransition = null;
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
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const attrs = state?.attributes || {};
    return JSON.stringify({
      entityId,
      state: String(state?.state || ""),
      friendlyName: String(attrs.friendly_name || ""),
      icon: String(attrs.icon || ""),
      percentage: Number(attrs.percentage ?? -1),
      percentageStep: Number(attrs.percentage_step ?? -1),
      presetMode: String(attrs.preset_mode || ""),
      presetModes: Array.isArray(attrs.preset_modes) ? attrs.preset_modes.join("|") : "",
      oscillating: String(attrs.oscillating ?? ""),
      direction: String(attrs.direction || ""),
      compact: Boolean(this._isCompactLayout),
      presetPanelOpen: Boolean(this._presetPanelOpen),
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

  _triggerHaptic(style = this._config?.haptics?.style) {
    if (!this._config?.haptics?.enabled) {
      return;
    }

    this.dispatchEvent(new CustomEvent("haptic", {
      bubbles: true,
      composed: true,
      detail: style || "medium",
    }));

    if (!this._config?.haptics?.fallback_vibrate || !navigator?.vibrate) {
      return;
    }

    const vibration = HAPTIC_PATTERNS[style || "medium"];
    if (vibration) {
      navigator.vibrate(vibration);
    }
  }

  _getState() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _isOn(state = this._getState()) {
    const stateValue = String(state?.state || "").toLowerCase();
    return Boolean(state) && !["off", "unavailable", "unknown"].includes(stateValue);
  }

  _getFanName(state) {
    if (this._config?.name) {
      return this._config.name;
    }

    if (state?.attributes?.friendly_name) {
      return state.attributes.friendly_name;
    }

    return this._config?.entity || "Fan";
  }

  _getFanIcon(state) {
    if (this._config?.icon) {
      return this._config.icon;
    }

    if (state?.attributes?.icon) {
      return state.attributes.icon;
    }

    return "mdi:fan";
  }

  _getStateLabel(state) {
    const stateValue = normalizeTextKey(state?.state);

    switch (stateValue) {
      case "off":
        return "Apagado";
      case "on":
        return "Encendido";
      case "unavailable":
        return "No disponible";
      case "unknown":
        return "Desconocido";
      default:
        return state?.state ? String(state.state) : "Sin estado";
    }
  }

  _supportsPercentage(state) {
    return Number.isFinite(Number(state?.attributes?.percentage)) || Number.isFinite(Number(state?.attributes?.percentage_step));
  }

  _getPercentage(state) {
    const draft = this._draftPercentage.get(this._config?.entity);
    if (Number.isFinite(draft)) {
      return clamp(Number(draft), 0, 100);
    }

    const rawPercentage = Number(state?.attributes?.percentage);
    if (Number.isFinite(rawPercentage)) {
      return clamp(Math.round(rawPercentage), 0, 100);
    }

    return this._isOn(state) ? 100 : 0;
  }

  _supportsOscillation(state) {
    return typeof state?.attributes?.oscillating === "boolean";
  }

  _isOscillating(state) {
    return state?.attributes?.oscillating === true;
  }

  _getPresetModes(state) {
    return Array.isArray(state?.attributes?.preset_modes)
      ? state.attributes.preset_modes
        .map(item => String(item || "").trim())
        .filter(Boolean)
        .filter(mode => !this._isPresetModeHidden(mode))
      : [];
  }

  _isPresetModeHidden(value) {
    const hiddenModes = Array.isArray(this._config?.hidden_preset_modes) ? this._config.hidden_preset_modes : [];
    const expectedKey = normalizeTextKey(value);
    return hiddenModes.some(item => normalizeTextKey(item) === expectedKey);
  }

  _getCurrentPresetMode(state) {
    return state?.attributes?.preset_mode ? String(state.attributes.preset_mode) : "";
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
      presetDuration: clamp(Number(configuredAnimations.preset_duration) || DEFAULT_CONFIG.animations.preset_duration, 120, 2400),
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
      this._presetPanelTransition = null;
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

  _setFanState(service, data = {}) {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    this._hass.callService("fan", service, {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _toggleFan(state) {
    if (this._isOn(state)) {
      this._setFanState("turn_off");
      return;
    }

    this._setFanState("turn_on");
  }

  _commitPercentage(percent) {
    const nextValue = clamp(Math.round(Number(percent)), 0, 100);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    this._setFanState("set_percentage", {
      percentage: nextValue,
    });
  }

  _toggleOscillation(state) {
    if (!this._supportsOscillation(state)) {
      return;
    }

    this._setFanState("oscillate", {
      oscillating: !this._isOscillating(state),
    });
  }

  _commitPresetMode(mode) {
    if (!mode) {
      return;
    }

    this._setFanState("set_preset_mode", {
      preset_mode: mode,
    });
  }

  _getPresetPanelMarkup(state = this._getState()) {
    const presetModes = this._config?.show_preset_modes !== false ? this._getPresetModes(state) : [];
    const currentPresetMode = this._getCurrentPresetMode(state);

    if (!presetModes.length) {
      return "";
    }

    return `
      <div class="fan-card__preset-panel">
        ${presetModes
          .map(mode => `
            <button
              type="button"
              class="fan-card__preset ${normalizeTextKey(mode) === normalizeTextKey(currentPresetMode) ? "is-active" : ""}"
              data-fan-action="preset"
              data-mode="${escapeHtml(mode)}"
            >
              ${escapeHtml(translatePresetLabel(mode))}
            </button>
          `)
          .join("")}
      </div>
    `;
  }

  _setPresetToggleButtonsState(isOpen) {
    this.shadowRoot
      ?.querySelectorAll('[data-fan-action="toggle-preset-panel"]')
      .forEach(button => {
        if (button instanceof HTMLElement) {
          button.classList.toggle("fan-card__control--active", isOpen === true);
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

  _setPresetPanelVisibility(isOpen, state = this._getState()) {
    this._presetPanelOpen = isOpen === true;
    this._lastRenderedPresetPanelVisible = this._presetPanelOpen;
    this._setPresetToggleButtonsState(this._presetPanelOpen);

    const controlsInner = this.shadowRoot?.querySelector(".fan-card__controls-inner");
    const animations = this._getAnimationSettings();
    const panelMarkup = this._presetPanelOpen ? this._getPresetPanelMarkup(state) : "";

    if (panelMarkup) {
      this._lastPresetPanelMarkup = panelMarkup;
    }

    if (!controlsInner || !(controlsInner instanceof HTMLElement) || !state || !this._isOn(state)) {
      this._render();
      return;
    }

    const existingPanel = controlsInner.querySelector(".fan-card__preset-panel-shell");
    if (!animations.enabled) {
      if (existingPanel instanceof HTMLElement) {
        existingPanel.remove();
      }

      if (panelMarkup) {
        const panelNode = this._createMarkupNode(`
          <div class="fan-card__preset-panel-shell" data-panel-key="preset">
            <div class="fan-card__preset-panel-inner">
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

    const removePanel = panel => {
      if (!(panel instanceof HTMLElement)) {
        return;
      }

      panel.classList.remove("fan-card__preset-panel-shell--entering");
      panel.classList.add("fan-card__preset-panel-shell--leaving");

      const finalizeRemoval = () => {
        if (panel.isConnected) {
          panel.remove();
        }
      };

      panel.addEventListener("animationend", finalizeRemoval, { once: true });
      window.setTimeout(finalizeRemoval, animations.presetDuration + 80);
    };
    const appendPanel = () => {
      if (!panelMarkup) {
        return;
      }

      const panelNode = this._createMarkupNode(`
        <div class="fan-card__preset-panel-shell fan-card__preset-panel-shell--entering" data-panel-key="preset">
          <div class="fan-card__preset-panel-inner">
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
          panelNode.classList.remove("fan-card__preset-panel-shell--entering");
        }
      }, animations.presetDuration + 80);
    };

    if (!this._presetPanelOpen) {
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

    if (existingPanel instanceof HTMLElement) {
      existingPanel.remove();
    }

    appendPanel();
  }

  _updatePercentagePreview(value) {
    const slider = this.shadowRoot?.querySelector('.fan-card__slider[data-fan-control="percentage"]');
    const nextValue = clamp(Number(value), 0, 100);

    if (slider instanceof HTMLInputElement) {
      slider.style.setProperty("--percentage", String(nextValue));
      slider.closest(".fan-card__slider-shell")?.style.setProperty("--percentage", String(nextValue));
    }
  }

  _applySliderValue(slider, value, options = {}) {
    const commit = options.commit === true;
    const nextValue = clamp(Number(value), 0, 100);

    this._draftPercentage.set(this._config.entity, nextValue);
    this._updatePercentagePreview(nextValue);

    if (commit) {
      this._triggerHaptic("selection");
      this._commitPercentage(nextValue);
    }
  }

  _onShadowPointerDown(event) {
    const slider = event
      .composedPath()
      .find(node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.fanControl,
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
        node.dataset?.fanControl,
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
        node.dataset?.fanControl,
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
      .find(node => node instanceof HTMLInputElement && node.dataset?.fanControl);

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
      .find(node => node instanceof HTMLInputElement && node.dataset?.fanControl);

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
      node => node instanceof HTMLInputElement && node.dataset?.fanControl,
    );

    if (slider) {
      return;
    }

    const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.fanAction);

    if (!actionButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const state = this._getState();
    this._triggerHaptic();

    switch (actionButton.dataset.fanAction) {
      case "toggle":
        this._triggerButtonBounce(actionButton);
        this._toggleFan(state);
        break;
      case "oscillate":
        this._triggerButtonBounce(actionButton);
        this._toggleOscillation(state);
        break;
      case "toggle-preset-panel":
        this._triggerButtonBounce(actionButton);
        this._setPresetPanelVisibility(!this._presetPanelOpen, state);
        break;
      case "preset":
        this._triggerButtonBounce(actionButton);
        if (actionButton.dataset.mode) {
          this._commitPresetMode(actionButton.dataset.mode);
        }
        break;
      default:
        break;
    }
  }

  _renderEmptyState() {
    return `
      <ha-card class="fan-card fan-card--empty">
        <div class="fan-card__empty-title">Nodalia Fan Card</div>
        <div class="fan-card__empty-text">Configura \`entity\` con una entidad \`fan.*\` para mostrar la tarjeta.</div>
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

          .fan-card--empty {
            background: ${styles.card.background};
            border: ${styles.card.border};
            border-radius: ${styles.card.border_radius};
            box-shadow: ${styles.card.box_shadow};
            display: grid;
            gap: 6px;
            padding: ${styles.card.padding};
          }

          .fan-card__empty-title {
            color: var(--primary-text-color);
            font-size: 15px;
            font-weight: 700;
          }

          .fan-card__empty-text {
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
    const title = this._getFanName(state);
    const icon = this._getFanIcon(state);
    const accentColor = this._getAccentColor(state);
    const showUnavailableBadge = isUnavailableState(state);
    const currentPercentage = this._getPercentage(state);
    const supportsPercentage = config.show_slider !== false && this._supportsPercentage(state);
    const supportsOscillation = config.show_oscillation !== false && this._supportsOscillation(state);
    const presetModes = config.show_preset_modes !== false ? this._getPresetModes(state) : [];
    const currentPresetMode = this._getCurrentPresetMode(state);
    const translatedPresetMode = currentPresetMode ? translatePresetLabel(currentPresetMode) : "";
    const isCompactLayout = this._isCompactLayout;
    const hasSecondaryControls = isOn && (supportsOscillation || presetModes.length);
    const chips = [];
    const showCopyBlock = !isCompactLayout || config.show_state === true || (isOn && ((config.show_percentage_chip !== false && supportsPercentage) || (config.show_mode_chip !== false && translatedPresetMode)));

    if (config.show_state === true) {
      chips.push(`<span class="fan-card__chip fan-card__chip--state">${escapeHtml(this._getStateLabel(state))}</span>`);
    }

    if (isOn && config.show_percentage_chip !== false && supportsPercentage) {
      chips.push(`<span class="fan-card__chip">${escapeHtml(`${Math.round(currentPercentage)}%`)}</span>`);
    }

    if (isOn && config.show_mode_chip !== false && translatedPresetMode) {
      chips.push(`<span class="fan-card__chip">${escapeHtml(translatedPresetMode)}</span>`);
    }

    if (!presetModes.length) {
      this._presetPanelOpen = false;
    }

    const onCardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 54%, ${styles.card.background} 100%)`;
    const onCardBorder = `color-mix(in srgb, ${accentColor} 34%, var(--divider-color))`;
    const onCardShadow = `0 16px 32px color-mix(in srgb, ${accentColor} 14%, rgba(0, 0, 0, 0.18))`;
    const animations = this._getAnimationSettings();
    const now = Date.now();
    const wasOn = this._lastRenderedIsOn;
    const isPresetPanelVisible = Boolean(isOn && this._presetPanelOpen && presetModes.length);
    let powerAnimationState = "";
    let controlsAnimationState = "";
    let presetPanelAnimationState = "";

    if (!animations.enabled) {
      this._powerTransition = null;
      this._controlsTransition = null;
      this._presetPanelTransition = null;
    } else if (wasOn !== null && wasOn !== isOn) {
      powerAnimationState = isOn ? "powering-up" : "powering-down";
      this._powerTransition = {
        endsAt: now + animations.powerDuration,
        state: powerAnimationState,
      };

      if (supportsPercentage || hasSecondaryControls || this._lastControlsMarkup) {
        controlsAnimationState = isOn ? "entering" : "leaving";
        this._controlsTransition = {
          endsAt: now + animations.controlsDuration,
          state: controlsAnimationState,
        };
      } else {
        this._controlsTransition = null;
      }

      this._presetPanelTransition = null;
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

      if (isOn && wasOn === isOn && this._lastRenderedPresetPanelVisible !== isPresetPanelVisible) {
        presetPanelAnimationState = isPresetPanelVisible ? "entering" : "leaving";
        this._presetPanelTransition = {
          endsAt: now + animations.presetDuration,
          state: presetPanelAnimationState,
        };
      } else if (this._presetPanelTransition?.endsAt > now) {
        presetPanelAnimationState = this._presetPanelTransition.state;
      } else {
        this._presetPanelTransition = null;
      }

      if (!isOn) {
        this._presetPanelTransition = null;
      }
    }

    const shouldAnimatePercentageFill = animations.enabled &&
      powerAnimationState === "powering-up" &&
      isOn &&
      supportsPercentage;
    const percentageFillDuration = shouldAnimatePercentageFill
      ? clamp(Math.round(animations.controlsDuration * 0.82), 220, 1100)
      : 0;
    const percentageSliderShellClass = shouldAnimatePercentageFill ? " fan-card__slider-shell--percentage-fill" : "";

    const mainControlsMarkup = isOn && supportsPercentage
      ? `
        <div class="fan-card__slider-row ${hasSecondaryControls ? "" : "fan-card__slider-row--solo"}">
          <div class="fan-card__slider-wrap">
            <div class="fan-card__slider-shell${percentageSliderShellClass}" style="--percentage:${currentPercentage}; --percentage-target:${currentPercentage};">
              <div class="fan-card__slider-track"></div>
              <input
                type="range"
                class="fan-card__slider"
                data-fan-control="percentage"
                min="0"
                max="100"
                step="any"
                value="${currentPercentage}"
                style="--percentage:${currentPercentage};"
                aria-label="Velocidad"
              />
            </div>
          </div>
          ${
            hasSecondaryControls
              ? `
                <div class="fan-card__slider-actions">
                  ${
                    supportsOscillation
                      ? `
                        <button
                          type="button"
                          class="fan-card__control ${this._isOscillating(state) ? "fan-card__control--active" : ""}"
                          data-fan-action="oscillate"
                          aria-label="${this._isOscillating(state) ? "Desactivar oscilacion" : "Activar oscilacion"}"
                        >
                          <ha-icon icon="mdi:rotate-360"></ha-icon>
                        </button>
                      `
                      : ""
                  }
                  ${
                    presetModes.length
                      ? `
                        <button
                          type="button"
                          class="fan-card__control ${this._presetPanelOpen ? "fan-card__control--active" : ""}"
                          data-fan-action="toggle-preset-panel"
                          aria-label="Mostrar modos"
                        >
                          <ha-icon icon="mdi:tune-variant"></ha-icon>
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
      : !supportsPercentage && hasSecondaryControls
        ? `
          <div class="fan-card__controls">
            ${
              supportsOscillation
                ? `
                  <button
                    type="button"
                    class="fan-card__control ${this._isOscillating(state) ? "fan-card__control--active" : ""}"
                    data-fan-action="oscillate"
                    aria-label="${this._isOscillating(state) ? "Desactivar oscilacion" : "Activar oscilacion"}"
                  >
                    <ha-icon icon="mdi:rotate-360"></ha-icon>
                  </button>
                `
                : ""
            }
            ${
              presetModes.length
                ? `
                  <button
                    type="button"
                    class="fan-card__control ${this._presetPanelOpen ? "fan-card__control--active" : ""}"
                    data-fan-action="toggle-preset-panel"
                    aria-label="Mostrar modos"
                  >
                    <ha-icon icon="mdi:tune-variant"></ha-icon>
                  </button>
                `
                : ""
            }
          </div>
        `
        : "";

    const currentPresetPanelMarkup = isPresetPanelVisible
      ? `
        <div class="fan-card__preset-panel">
          ${presetModes
            .map(mode => `
              <button
                type="button"
                class="fan-card__preset ${normalizeTextKey(mode) === normalizeTextKey(currentPresetMode) ? "is-active" : ""}"
                data-fan-action="preset"
                data-mode="${escapeHtml(mode)}"
              >
                ${escapeHtml(translatePresetLabel(mode))}
              </button>
            `)
            .join("")}
        </div>
      `
      : "";
    const presetPanelContentMarkup = currentPresetPanelMarkup
      || (presetPanelAnimationState === "leaving" ? this._lastPresetPanelMarkup : "");
    const presetPanelShellMarkup = presetPanelContentMarkup
      ? `
        <div class="fan-card__preset-panel-shell ${presetPanelAnimationState ? `fan-card__preset-panel-shell--${presetPanelAnimationState}` : ""}" data-panel-key="preset">
          <div class="fan-card__preset-panel-inner">
            ${presetPanelContentMarkup}
          </div>
        </div>
      `
      : "";
    const currentControlsAnimatedMarkup = [
      mainControlsMarkup,
      presetPanelShellMarkup,
    ].filter(Boolean).join("");
    const currentControlsStaticMarkup = [
      mainControlsMarkup,
      currentPresetPanelMarkup
        ? `
          <div class="fan-card__preset-panel-shell" data-panel-key="preset">
            <div class="fan-card__preset-panel-inner">
              ${currentPresetPanelMarkup}
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
        <div class="fan-card__controls-shell ${controlsAnimationState ? `fan-card__controls-shell--${controlsAnimationState}` : ""}">
          <div class="fan-card__controls-inner">
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
    const presetAnimationRemaining = presetPanelAnimationState && this._presetPanelTransition
      ? Math.max(0, this._presetPanelTransition.endsAt - now)
      : 0;
    const percentageFillAnimationRemaining = shouldAnimatePercentageFill
      ? percentageFillDuration
      : 0;
    const shouldCleanupAfterAnimation = Boolean(powerAnimationRemaining || controlsAnimationRemaining || presetAnimationRemaining || percentageFillAnimationRemaining);
    const cleanupDelay = shouldCleanupAfterAnimation
      ? Math.max(powerAnimationRemaining, controlsAnimationRemaining, presetAnimationRemaining, percentageFillAnimationRemaining) + 40
      : 0;

    if (currentPresetPanelMarkup) {
      this._lastPresetPanelMarkup = currentPresetPanelMarkup;
    }

    if (isOn && currentControlsStaticMarkup && presetPanelAnimationState !== "leaving") {
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

        ha-card.fan-card {
          --fan-card-controls-max-height: 360px;
          --fan-card-controls-gap: calc(${styles.card.gap} + 4px);
          --fan-card-controls-duration: ${animations.controlsDuration}ms;
          --fan-card-panel-duration: ${animations.presetDuration}ms;
          --fan-card-power-duration: ${animations.powerDuration}ms;
          --fan-card-percentage-fill-duration: ${percentageFillDuration}ms;
          --fan-card-percentage-empty-duration: ${animations.controlsDuration}ms;
          --fan-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
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

        .fan-card.is-off {
          cursor: pointer;
        }

        ha-card::before {
          background: ${isOn
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 18%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`
            : "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0))"};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        ha-card::after {
          background:
            radial-gradient(circle at 18% 18%, color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 50%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%);
          content: "";
          inset: 0;
          opacity: ${isOn ? "1" : "0"};
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .fan-card--powering-up {
          animation: fan-card-power-up var(--fan-card-power-duration) cubic-bezier(0.24, 0.82, 0.25, 1) both;
        }

        .fan-card--powering-down {
          animation: fan-card-power-down var(--fan-card-power-duration) cubic-bezier(0.32, 0, 0.24, 1) both;
        }

        .fan-card--powering-up::after {
          animation: fan-card-power-glow-in var(--fan-card-power-duration) cubic-bezier(0.24, 0.82, 0.25, 1) both;
        }

        .fan-card--powering-down::after {
          animation: fan-card-power-glow-out var(--fan-card-power-duration) cubic-bezier(0.32, 0, 0.24, 1) both;
        }

        .fan-card {
          color: var(--primary-text-color);
          display: grid;
          min-width: 0;
          position: relative;
          z-index: 1;
        }

        .fan-card__content {
          display: grid;
          gap: 0;
        }

        .fan-card__hero {
          align-items: center;
          display: grid;
          gap: ${styles.card.gap};
          grid-template-columns: auto minmax(0, 1fr);
          min-width: 0;
        }

        .fan-card--compact .fan-card__hero {
          justify-items: center;
          text-align: center;
        }

        .fan-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${isOn
            ? `color-mix(in srgb, ${accentColor} 24%, ${styles.icon.background})`
            : styles.icon.background};
          border: 1px solid color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.16);
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

        .fan-card__icon ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.46);
          display: inline-flex;
          height: calc(${styles.icon.size} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${styles.icon.size} * 0.46);
        }

        .fan-card__unavailable-badge {
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

        .fan-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .fan-card__copy {
          display: grid;
          gap: 10px;
          min-width: 0;
        }

        .fan-card__headline {
          align-items: start;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .fan-card--compact .fan-card__copy {
          justify-items: center;
        }

        .fan-card--compact .fan-card__headline {
          grid-template-columns: minmax(0, 1fr);
          justify-items: center;
        }

        .fan-card__title {
          font-size: ${styles.title_size};
          font-weight: 700;
          letter-spacing: -0.01em;
          line-height: 1.15;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .fan-card__chips {
          display: flex;
          flex: 0 0 auto;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          min-width: 0;
          max-width: 100%;
        }

        .fan-card--compact .fan-card__chips {
          justify-content: center;
        }

        .fan-card__chip {
          align-items: center;
          backdrop-filter: blur(18px);
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
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

        .fan-card__chip--state {
          color: var(--primary-text-color);
        }

        .fan-card__controls-shell {
          backface-visibility: hidden;
          margin-top: var(--fan-card-controls-gap);
          overflow: hidden;
          will-change: margin-top, max-height, opacity;
        }

        .fan-card__controls-inner {
          backface-visibility: hidden;
          display: grid;
          gap: 10px;
          will-change: opacity, transform;
        }

        .fan-card__controls-shell--entering {
          animation: fan-card-controls-expand var(--fan-card-controls-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          overflow: visible;
          transform-origin: top;
        }

        .fan-card__controls-shell--entering .fan-card__controls-inner {
          animation: fan-card-controls-content-in var(--fan-card-controls-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          transform-origin: top;
        }

        .fan-card__controls-shell--leaving {
          animation: fan-card-controls-collapse var(--fan-card-controls-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
          pointer-events: none;
          transform-origin: top;
        }

        .fan-card__controls-shell--leaving .fan-card__controls-inner {
          animation: fan-card-controls-content-out var(--fan-card-controls-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
          transform-origin: top;
        }

        .fan-card__controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          padding-inline: 4px;
        }

        .fan-card__slider-actions {
          display: inline-flex;
          flex: 0 0 auto;
          gap: 12px;
          justify-content: flex-end;
        }

        .fan-card__control {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.16);
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

        .fan-card__control--active {
          background: color-mix(in srgb, ${accentColor} 18%, ${styles.control.accent_background});
          border-color: color-mix(in srgb, ${accentColor} 48%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: ${styles.control.accent_color};
        }

        .fan-card__control ha-icon {
          --mdc-icon-size: calc(${styles.control.size} * 0.46);
          display: inline-flex;
          height: calc(${styles.control.size} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${styles.control.size} * 0.46);
        }

        .fan-card__slider-row {
          align-items: center;
          display: grid;
          gap: 14px;
          grid-template-columns: minmax(0, 1fr) auto;
          padding-inline: 4px;
        }

        .fan-card__slider-wrap {
          --fan-card-slider-input-height: max(44px, var(--fan-card-slider-thumb-size));
          --fan-card-slider-thumb-size: calc(${styles.slider_thumb_size} + 12px);
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          display: flex;
          min-height: ${styles.slider_wrap_height};
          padding: 0 14px;
        }

        .fan-card__slider-shell {
          flex: 1;
          min-width: 0;
          position: relative;
        }

        .fan-card__slider-track {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          height: ${styles.slider_height};
          left: 0;
          overflow: hidden;
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
        }

        .fan-card__slider-track::before {
          background: ${styles.slider_color};
          border-radius: inherit;
          content: "";
          inset: 0;
          position: absolute;
          transform: scaleX(calc(var(--percentage, ${currentPercentage}) / 100));
          transform-origin: left center;
        }

        .fan-card__slider-shell--percentage-fill .fan-card__slider-track::before {
          animation: fan-card-percentage-fill var(--fan-card-percentage-fill-duration) cubic-bezier(0.2, 0.86, 0.18, 1) both;
        }

        .fan-card__controls-shell--leaving .fan-card__slider-track::before {
          animation: fan-card-percentage-empty var(--fan-card-percentage-empty-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
        }

        .fan-card__slider-row--solo {
          grid-template-columns: minmax(0, 1fr);
        }

        .fan-card__slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          box-sizing: border-box;
          cursor: pointer;
          flex: 1;
          height: var(--fan-card-slider-input-height);
          margin: 0;
          padding: 0;
          position: relative;
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
          width: 100%;
          z-index: 1;
        }

        .fan-card__slider::-webkit-slider-runnable-track {
          background: transparent;
          border-radius: 999px;
          height: ${styles.slider_height};
        }

        .fan-card__slider::-moz-range-progress {
          background: transparent;
          border: 0;
          height: ${styles.slider_height};
        }

        .fan-card__slider::-moz-range-track {
          background: transparent;
          border-radius: 999px;
          border: 0;
          height: ${styles.slider_height};
        }

        .fan-card__slider::-webkit-slider-thumb {
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

        .fan-card__slider::-moz-range-thumb {
          background: transparent;
          border: 0;
          border-radius: 50%;
          box-shadow: none;
          box-sizing: border-box;
          height: ${styles.slider_thumb_size};
          width: ${styles.slider_thumb_size};
        }

        .fan-card__preset-panel {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          margin-top: 8px;
          min-width: 0;
        }

        .fan-card__preset-panel-shell {
          backface-visibility: hidden;
          overflow: hidden;
          will-change: max-height, opacity;
        }

        .fan-card__preset-panel-inner {
          backface-visibility: hidden;
          display: grid;
          padding: 4px;
          will-change: opacity, transform;
        }

        .fan-card__preset-panel-shell--entering {
          animation: fan-card-preset-panel-expand var(--fan-card-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          transform-origin: top;
        }

        .fan-card__preset-panel-shell--entering .fan-card__preset-panel-inner {
          animation: fan-card-preset-panel-content-in var(--fan-card-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          transform-origin: top;
        }

        .fan-card__preset-panel-shell--leaving {
          animation: fan-card-preset-panel-collapse var(--fan-card-panel-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
          pointer-events: none;
          transform-origin: top;
        }

        .fan-card__preset-panel-shell--leaving .fan-card__preset-panel-inner {
          animation: fan-card-preset-panel-content-out var(--fan-card-panel-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
          transform-origin: top;
        }

        .fan-card__preset {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
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

        .fan-card__preset.is-active {
          background: ${styles.control.accent_background};
          border-color: color-mix(in srgb, ${accentColor} 48%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: ${styles.control.accent_color};
        }

        :is(.fan-card__icon, .fan-card__control, .fan-card__preset):active:not(:disabled),
        :is(.fan-card__icon, .fan-card__control, .fan-card__preset).is-pressing:not(:disabled) {
          animation: fan-card-button-bounce var(--fan-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        @keyframes fan-card-power-up {
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

        @keyframes fan-card-power-down {
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

        @keyframes fan-card-power-glow-in {
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

        @keyframes fan-card-power-glow-out {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes fan-card-controls-expand {
          0% {
            margin-top: 0;
            max-height: 0;
            opacity: 0;
          }
          100% {
            margin-top: var(--fan-card-controls-gap);
            max-height: var(--fan-card-controls-max-height);
            opacity: 1;
          }
        }

        @keyframes fan-card-percentage-fill {
          0% {
            transform: scaleX(0.01);
          }
          100% {
            transform: scaleX(calc(var(--percentage-target, var(--percentage, ${currentPercentage})) / 100));
          }
        }

        @keyframes fan-card-percentage-empty {
          100% {
            transform: scaleX(0.01);
          }
        }

        @keyframes fan-card-controls-collapse {
          0% {
            margin-top: var(--fan-card-controls-gap);
            max-height: var(--fan-card-controls-max-height);
            opacity: 1;
          }
          100% {
            margin-top: 0;
            max-height: 0;
            opacity: 0;
          }
        }

        @keyframes fan-card-controls-content-in {
          0% {
            opacity: 0;
            transform: translateY(-10px) scaleY(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes fan-card-controls-content-out {
          0% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.94);
          }
        }

        @keyframes fan-card-preset-panel-expand {
          0% {
            max-height: 0;
            opacity: 0;
          }
          100% {
            max-height: 180px;
            opacity: 1;
          }
        }

        @keyframes fan-card-preset-panel-collapse {
          0% {
            max-height: 180px;
            opacity: 1;
          }
          100% {
            max-height: 0;
            opacity: 0;
          }
        }

        @keyframes fan-card-preset-panel-content-in {
          0% {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes fan-card-preset-panel-content-out {
          0% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-6px) scaleY(0.96);
          }
        }

        @keyframes fan-card-button-bounce {
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
        .fan-card,
        .fan-card::after,
        .fan-card__controls-shell,
        .fan-card__controls-inner,
        .fan-card__preset-panel-shell,
        .fan-card__preset-panel-inner,
        .fan-card__icon,
        .fan-card__slider-mode-button,
        .fan-card__preset,
        .fan-card__control,
        .fan-card * {
          animation: none !important;
          transition: none !important;
        }
        `}

        .fan-card--compact:not(.fan-card--with-copy) .fan-card__hero {
          justify-items: center;
        }

        @media (prefers-reduced-motion: reduce) {
          .fan-card,
          .fan-card::after,
          .fan-card__controls-shell,
          .fan-card__controls-inner,
          .fan-card__preset-panel-shell,
          .fan-card__preset-panel-inner,
          .fan-card__icon,
          .fan-card__control,
          .fan-card__preset {
            animation: none !important;
            transition: none !important;
          }
        }

        @media (max-width: 420px) {
          .fan-card__hero {
            grid-template-columns: 50px minmax(0, 1fr);
          }

          .fan-card__icon {
            height: 50px;
            width: 50px;
          }

          .fan-card__slider-row {
            gap: 10px;
            grid-template-columns: minmax(0, 1fr) auto;
          }

          .fan-card__slider-actions {
            gap: 10px;
            justify-content: flex-end;
          }
        }
      </style>
      <ha-card
        class="fan-card ${isOn ? "is-on" : "is-off"} ${isCompactLayout ? "fan-card--compact" : ""} ${showCopyBlock ? "fan-card--with-copy" : ""} ${powerAnimationState ? `fan-card--${powerAnimationState}` : ""}"
        style="--accent-color:${escapeHtml(accentColor)};"
        data-fan-action="toggle"
      >
        <div class="fan-card__content">
          <div class="fan-card__hero">
            <button
              type="button"
              class="fan-card__icon"
              data-fan-action="toggle"
              aria-label="Encender o apagar"
            >
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
              ${showUnavailableBadge ? `<span class="fan-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${showCopyBlock
              ? `
                <div class="fan-card__copy">
                  <div class="fan-card__headline">
                    ${isCompactLayout ? "" : `<div class="fan-card__title">${escapeHtml(title)}</div>`}
                    ${chips.length ? `<div class="fan-card__chips">${chips.join("")}</div>` : ""}
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
    this._lastRenderedPresetPanelVisible = isPresetPanelVisible;

    if (shouldCleanupAfterAnimation) {
      this._scheduleAnimationCleanup(cleanupDelay);
    } else if (this._animationCleanupTimer) {
      window.clearTimeout(this._animationCleanupTimer);
      this._animationCleanupTimer = 0;
    }
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaFanCard);
}

class NodaliaFanCardEditor extends HTMLElement {
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
      .filter(([entityId]) => entityId.startsWith("fan."))
      .map(([entityId, state]) => `${entityId}:${String(state?.attributes?.friendly_name || "")}:${String(state?.attributes?.icon || "")}`)
      .sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }))
      .join("|");
  }

  _getFanEntityOptions() {
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => entityId.startsWith("fan."))
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
        this._setPresetModeVisibility(input.dataset.modeValue, input.checked);
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

  _getFanState() {
    return this._config?.entity ? this._hass?.states?.[this._config.entity] || null : null;
  }

  _getPresetModeVisibilityOptions() {
    const fanState = this._getFanState();
    return Array.isArray(fanState?.attributes?.preset_modes)
      ? fanState.attributes.preset_modes.map(item => String(item || "").trim()).filter(Boolean)
      : [];
  }

  _getHiddenPresetModes() {
    return Array.isArray(this._config?.hidden_preset_modes)
      ? this._config.hidden_preset_modes.map(item => String(item || "").trim()).filter(Boolean)
      : [];
  }

  _isPresetModeVisible(value) {
    const expectedKey = normalizeTextKey(value);
    return !this._getHiddenPresetModes().some(item => normalizeTextKey(item) === expectedKey);
  }

  _setPresetModeVisibility(value, visible) {
    const rawValue = String(value || "").trim();
    if (!rawValue) {
      return;
    }

    const nextValues = this._getHiddenPresetModes().filter(item => normalizeTextKey(item) !== normalizeTextKey(rawValue));
    if (!visible) {
      nextValues.push(rawValue);
    }

    if (nextValues.length) {
      setByPath(this._config, "hidden_preset_modes", nextValues);
      return;
    }

    deleteByPath(this._config, "hidden_preset_modes");
  }

  _renderPresetModeVisibilityField(modeValue) {
    const translatedLabel = translatePresetLabel(modeValue);
    const showRawValue = normalizeTextKey(translatedLabel) !== normalizeTextKey(modeValue);
    const label = showRawValue ? `${translatedLabel} (${modeValue})` : translatedLabel;

    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-mode-list-field="hidden_preset_modes"
          data-mode-value="${escapeHtml(modeValue)}"
          ${this._isPresetModeVisible(modeValue) ? "checked" : ""}
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

  _renderFanEntityField(label, field, value, options = {}) {
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="fan-entity"
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

  _mountFanEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.includeDomains = ["fan"];
      control.allowCustomEntity = true;
      control.entityFilter = stateObj => String(stateObj?.entity_id || "").startsWith("fan.");
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: {
          domain: "fan",
        },
      };
    } else {
      control = document.createElement("select");
      this._getFanEntityOptions().forEach(option => {
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
    const presetModeVisibilityOptions = this._getPresetModeVisibilityOptions();

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
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
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
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
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
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 40px;
          padding: 10px 12px;
          width: 100%;
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
        }

        .editor-color-picker:hover,
        .editor-color-picker:focus-within {
          border-color: color-mix(in srgb, var(--primary-text-color) 22%, transparent);
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }

        .editor-color-swatch {
          --editor-swatch: #71c0ff;
          background:
            linear-gradient(var(--editor-swatch), var(--editor-swatch)),
            conic-gradient(from 90deg, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 25%, rgba(0, 0, 0, 0.12) 0 50%, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 0 75%, rgba(0, 0, 0, 0.12) 0);
          background-position: center;
          background-size: cover, 10px 10px;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
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
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 5%, transparent);
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
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent);
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
            0 0 0 3px color-mix(in srgb, var(--primary-text-color) 14%, transparent),
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }
</style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">General</div>
            <div class="editor-section__hint">Entidad principal, nombre visible e icono de la tarjeta.</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderFanEntityField("Entidad de ventilador", "entity", config.entity, {
              placeholder: "fan.salon",
              fullWidth: true,
            })}
            ${this._renderIconPickerField("Icono", "icon", config.icon, {
              placeholder: "mdi:fan",
              fullWidth: true,
            })}
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Salón",
              fullWidth: true,
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Visibilidad</div>
            <div class="editor-section__hint">Qué bloques quieres mostrar dentro de la tarjeta.</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "Layout estrecho",
              "compact_layout_mode",
              config.compact_layout_mode || "auto",
              [
                { value: "auto", label: "Automático (<4 columnas)" },
                { value: "always", label: "Centrado siempre" },
                { value: "never", label: "Nunca centrar" },
              ],
            )}
            ${this._renderCheckboxField("Mostrar estado en burbuja", "show_state", config.show_state === true)}
            ${this._renderCheckboxField("Mostrar chip de velocidad", "show_percentage_chip", config.show_percentage_chip !== false)}
            ${this._renderCheckboxField("Mostrar chip de modo", "show_mode_chip", config.show_mode_chip !== false)}
            ${this._renderCheckboxField("Mostrar slider", "show_slider", config.show_slider !== false)}
            ${this._renderCheckboxField("Mostrar botón de oscilación", "show_oscillation", config.show_oscillation !== false)}
            ${this._renderCheckboxField("Mostrar presets de modo", "show_preset_modes", config.show_preset_modes !== false)}
            ${
              presetModeVisibilityOptions.length
                ? `
                  <div class="editor-subsection editor-field--full">
                    <div class="editor-subsection__title">Modos visibles</div>
                    <div class="editor-subsection__hint">Oculta los modos que expone el ventilador pero no quieres mostrar en la tarjeta.</div>
                    <div class="editor-grid editor-grid--stacked">
                      ${presetModeVisibilityOptions.map(mode => this._renderPresetModeVisibilityField(mode)).join("")}
                    </div>
                  </div>
                `
                : ""
            }
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Haptics</div>
            <div class="editor-section__hint">Respuesta háptica opcional para los controles.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Activar haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("Fallback con vibración", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
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
            <div class="editor-section__hint">Transiciones suaves al encender, apagar, desplegar controles, abrir modos y dar respuesta visual a los botones.</div>
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
                  ${this._renderTextField("Panel de modos (ms)", "animations.preset_duration", config.animations.preset_duration, {
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
            <div class="editor-section__hint">Ajustes visuales básicos del look Nodalia.</div>
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
                  ${this._renderColorField("Background", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("Border", "styles.card.border", config.styles.card.border)}
                  ${this._renderTextField("Radius", "styles.card.border_radius", config.styles.card.border_radius)}
                  ${this._renderTextField("Shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("Separación", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderTextField("Tamaño botón principal", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderColorField("Color icono encendido", "styles.icon.on_color", config.styles.icon.on_color)}
                  ${this._renderColorField("Color icono apagado", "styles.icon.off_color", config.styles.icon.off_color)}
                  ${this._renderTextField("Tamaño botón", "styles.control.size", config.styles.control.size)}
                  ${this._renderColorField("Fondo acento", "styles.control.accent_background", config.styles.control.accent_background)}
                  ${this._renderColorField("Color acento", "styles.control.accent_color", config.styles.control.accent_color)}
                  ${this._renderTextField("Alto burbuja info", "styles.chip_height", config.styles.chip_height)}
                  ${this._renderTextField("Texto burbuja info", "styles.chip_font_size", config.styles.chip_font_size)}
                  ${this._renderTextField("Padding burbuja info", "styles.chip_padding", config.styles.chip_padding)}
                  ${this._renderTextField("Tamaño título", "styles.title_size", config.styles.title_size)}
                  ${this._renderTextField("Alto contenedor slider", "styles.slider_wrap_height", config.styles.slider_wrap_height)}
                  ${this._renderTextField("Grosor slider", "styles.slider_height", config.styles.slider_height)}
                  ${this._renderColorField("Color slider", "styles.slider_color", config.styles.slider_color)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="fan-entity"]')
      .forEach(host => this._mountFanEntityPicker(host));

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
  customElements.define(EDITOR_TAG, NodaliaFanCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Fan Card",
  description: "Tarjeta de ventilador con slider de velocidad, oscilacion y modos.",
  preview: true,
});
