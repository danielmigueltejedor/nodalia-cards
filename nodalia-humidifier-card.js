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
  compact_layout_mode: "auto",
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
  return mergeConfig(DEFAULT_CONFIG, rawConfig || {});
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
    this._onWindowTouchMove = this._onWindowTouchMove.bind(this);
    this._onWindowTouchEnd = this._onWindowTouchEnd.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowChange);
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown);
    this.shadowRoot.addEventListener("mousedown", this._onShadowMouseDown);
    this.shadowRoot.addEventListener("touchstart", this._onShadowTouchStart, { passive: false });
  }

  connectedCallback() {
    this._resizeObserver?.observe(this);
    window.addEventListener("pointermove", this._onWindowPointerMove);
    window.addEventListener("pointerup", this._onWindowPointerUp);
    window.addEventListener("pointercancel", this._onWindowPointerUp);
    window.addEventListener("mousemove", this._onWindowMouseMove);
    window.addEventListener("mouseup", this._onWindowMouseUp);
    window.addEventListener("touchmove", this._onWindowTouchMove, { passive: false });
    window.addEventListener("touchend", this._onWindowTouchEnd, { passive: false });
    window.addEventListener("touchcancel", this._onWindowTouchEnd, { passive: false });
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    window.removeEventListener("pointermove", this._onWindowPointerMove);
    window.removeEventListener("pointerup", this._onWindowPointerUp);
    window.removeEventListener("pointercancel", this._onWindowPointerUp);
    window.removeEventListener("mousemove", this._onWindowMouseMove);
    window.removeEventListener("mouseup", this._onWindowMouseUp);
    window.removeEventListener("touchmove", this._onWindowTouchMove);
    window.removeEventListener("touchend", this._onWindowTouchEnd);
    window.removeEventListener("touchcancel", this._onWindowTouchEnd);
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
      return modeEntity.attributes.options.map(item => String(item || "").trim()).filter(Boolean);
    }

    if (Array.isArray(state?.attributes?.available_modes)) {
      return state.attributes.available_modes.map(item => String(item || "").trim()).filter(Boolean);
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
      ? fanModeEntity.attributes.options.map(item => String(item || "").trim()).filter(Boolean)
      : [];
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

  _updateHumidityPreview(value) {
    const slider = this.shadowRoot?.querySelector('.humidifier-card__slider[data-humidifier-control="humidity"]');
    const state = this._getState();
    const range = this._getHumidityRange(state);
    const nextValue = clamp(Number(value), range.min, range.max);
    const progress = ((nextValue - range.min) / Math.max(range.max - range.min, 1)) * 100;

    if (slider instanceof HTMLInputElement) {
      slider.style.setProperty("--humidity", String(clamp(progress, 0, 100)));
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

    if (pointerId !== null) {
      try {
        slider.setPointerCapture(pointerId);
      } catch (_error) {
        // Ignore unsupported pointer capture.
      }
    }

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

    if (pointerId !== null) {
      try {
        drag.slider.releasePointerCapture(pointerId);
      } catch (_error) {
        // Ignore unsupported pointer capture.
      }
    }

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
        this._toggleHumidifier(state);
        break;
      case "toggle-mode-panel":
        this._modePanelOpen = !this._modePanelOpen;
        if (this._modePanelOpen) {
          this._fanModePanelOpen = false;
        }
        this._render();
        break;
      case "toggle-fan-mode-panel":
        this._fanModePanelOpen = !this._fanModePanelOpen;
        if (this._fanModePanelOpen) {
          this._modePanelOpen = false;
        }
        this._render();
        break;
      case "mode":
        if (actionButton.dataset.mode) {
          this._commitMode(actionButton.dataset.mode);
          this._render();
        }
        break;
      case "fan-mode":
        if (actionButton.dataset.mode) {
          this._commitFanMode(actionButton.dataset.mode);
          this._render();
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

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          overflow: hidden;
        }

        .humidifier-card {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--accent-color) 16%, transparent) 0%, transparent 52%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.018) 0%, rgba(0, 0, 0, 0.02) 100%),
            ${styles.card.background};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
        }

        .humidifier-card__content {
          display: grid;
          gap: ${styles.card.gap};
          padding: ${styles.card.padding};
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
          background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.06), transparent 60%),
            ${styles.icon.background};
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: calc(${styles.icon.size} * 0.5);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 10px 26px rgba(0, 0, 0, 0.16);
          color: ${isOn ? styles.icon.on_color : styles.icon.off_color};
          cursor: pointer;
          display: inline-flex;
          height: ${styles.icon.size};
          justify-content: center;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          width: ${styles.icon.size};
        }

        .humidifier-card__icon ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.44);
          display: inline-flex;
          height: calc(${styles.icon.size} * 0.44);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${styles.icon.size} * 0.44);
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

        .humidifier-card__slider-row {
          align-items: center;
          display: grid;
          gap: 14px;
          grid-template-columns: minmax(0, 1fr) auto;
          margin-top: 4px;
        }

        .humidifier-card__slider-row--solo {
          grid-template-columns: minmax(0, 1fr);
        }

        .humidifier-card__slider-wrap {
          align-items: center;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          display: flex;
          min-height: ${styles.slider_wrap_height};
          padding: 0 14px;
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
          cursor: pointer;
          flex: 1;
          height: max(44px, calc(${styles.slider_thumb_size} + 12px));
          margin: 0;
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
          width: 100%;
        }

        .humidifier-card__slider::-webkit-slider-runnable-track {
          background:
            linear-gradient(
              90deg,
              ${styles.slider_color} calc(var(--humidity, ${clamp(humidityProgress, 0, 100)}) * 1%),
              rgba(255, 255, 255, 0.08) calc(var(--humidity, ${clamp(humidityProgress, 0, 100)}) * 1%)
            );
          border-radius: 999px;
          height: ${styles.slider_height};
        }

        .humidifier-card__slider::-moz-range-track {
          background:
            linear-gradient(
              90deg,
              ${styles.slider_color} calc(var(--humidity, ${clamp(humidityProgress, 0, 100)}) * 1%),
              rgba(255, 255, 255, 0.08) calc(var(--humidity, ${clamp(humidityProgress, 0, 100)}) * 1%)
            );
          border-radius: 999px;
          height: ${styles.slider_height};
        }

        .humidifier-card__slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: #f5f7fb;
          background-clip: padding-box;
          border: 6px solid transparent;
          border-radius: 50%;
          box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.12);
          box-sizing: border-box;
          height: calc(${styles.slider_thumb_size} + 12px);
          margin-top: calc((${styles.slider_height} - (${styles.slider_thumb_size} + 12px)) / 2);
          width: calc(${styles.slider_thumb_size} + 12px);
        }

        .humidifier-card__slider::-moz-range-thumb {
          background: #f5f7fb;
          background-clip: padding-box;
          border: 6px solid transparent;
          border-radius: 50%;
          box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.12);
          box-sizing: border-box;
          height: calc(${styles.slider_thumb_size} + 12px);
          width: calc(${styles.slider_thumb_size} + 12px);
        }

        .humidifier-card__slider::-moz-range-track {
          border: 0;
        }

        .humidifier-card__controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
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
          white-space: nowrap;
        }

        .humidifier-card__option.is-active {
          background: ${styles.control.accent_background};
          border-color: color-mix(in srgb, ${accentColor} 48%, rgba(255, 255, 255, 0.12));
          color: ${styles.control.accent_color};
        }

        .humidifier-card--compact:not(.humidifier-card--with-copy) .humidifier-card__hero {
          justify-items: center;
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
        class="humidifier-card ${isOn ? "is-on" : "is-off"} ${isCompactLayout ? "humidifier-card--compact" : ""} ${showCopyBlock ? "humidifier-card--with-copy" : ""}"
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

          ${
            isOn && supportsHumidity
              ? `
                <div class="humidifier-card__slider-row ${hasSecondaryControls ? "" : "humidifier-card__slider-row--solo"}">
                  <div class="humidifier-card__slider-wrap">
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
              : ""
          }

          ${
            !supportsHumidity && hasSecondaryControls && isOn
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
              : ""
          }

          ${
            isOn && this._modePanelOpen && modeOptions.length
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
              : ""
          }

          ${
            isOn && this._fanModePanelOpen && fanModeOptions.length
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
              : ""
          }
        </div>
      </ha-card>
    `;
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
      .filter(entityId => entityId.startsWith("humidifier.") || entityId.startsWith("select.") || entityId.startsWith("input_select."))
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
    const humidifierIds = Object.keys(this._hass?.states || {})
      .filter(entityId => entityId.startsWith("humidifier."))
      .sort((left, right) => left.localeCompare(right, "es"));
    const optionEntityIds = Object.keys(this._hass?.states || {})
      .filter(entityId => entityId.startsWith("select.") || entityId.startsWith("input_select."))
      .sort((left, right) => left.localeCompare(right, "es"));

    return `
      <datalist id="humidifier-card-entities">
        ${humidifierIds.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
      <datalist id="humidifier-card-select-entities">
        ${optionEntityIds.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
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
            <div class="editor-section__hint">Entidad principal, textos visibles y selects auxiliares.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Entidad", "entity", config.entity, {
              placeholder: "humidifier.deshumidificador",
            })}
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Deshumidificador",
            })}
            ${this._renderTextField("Icono", "icon", config.icon, {
              placeholder: "mdi:air-humidifier",
            })}
            ${this._renderTextField("Select modo", "mode_entity", config.mode_entity, {
              placeholder: "select.deshumidificador_modo",
            })}
            ${this._renderTextField("Select ventilacion", "fan_mode_entity", config.fan_mode_entity, {
              placeholder: "select.deshumidificador_ventilador",
            })}
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
            ${this._renderCheckboxField("Mostrar chip de humedad", "show_target_humidity_chip", config.show_target_humidity_chip !== false)}
            ${this._renderCheckboxField("Mostrar chip de modo", "show_mode_chip", config.show_mode_chip !== false)}
            ${this._renderCheckboxField("Mostrar chip de ventilacion", "show_fan_mode_chip", config.show_fan_mode_chip !== false)}
            ${this._renderCheckboxField("Mostrar slider", "show_slider", config.show_slider !== false)}
            ${this._renderCheckboxField("Mostrar boton modo", "show_mode_button", config.show_mode_button !== false)}
            ${this._renderCheckboxField("Mostrar boton ventilacion", "show_fan_mode_button", config.show_fan_mode_button !== false)}
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
            ${this._renderTextField("Color icono encendido", "styles.icon.on_color", config.styles.icon.on_color)}
            ${this._renderTextField("Color icono apagado", "styles.icon.off_color", config.styles.icon.off_color)}
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
      .forEach(input => input.setAttribute("list", "humidifier-card-entities"));

    this.shadowRoot
      .querySelectorAll('input[data-field="mode_entity"], input[data-field="fan_mode_entity"]')
      .forEach(input => input.setAttribute("list", "humidifier-card-select-entities"));
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaHumidifierCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Humidifier Card",
  description: "Tarjeta de humidificador/deshumidificador con slider de humedad y modos.",
  preview: true,
});
