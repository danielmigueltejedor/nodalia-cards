const CARD_TAG = "nodalia-fan-card";
const EDITOR_TAG = "nodalia-fan-card-editor";
const CARD_VERSION = "1.3.0-alpha.9";
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
const OPTIMISTIC_TOGGLE_TIMEOUT = 3200;
const OPTIMISTIC_VISUAL_SETTLE_MS = 420;
const FAN_MEMORY_STORAGE_KEY = "nodalia-fan-card:last-visual-state:v1";
const ALLOWED_DOUBLE_TAP_ACTIONS = new Set(["auto", "toggle", "more-info", "service", "url", "none"]);

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  entity_picture: "",
  show_entity_picture: false,
  show_state: false,
  show_percentage_chip: true,
  show_mode_chip: true,
  show_slider: true,
  show_oscillation: true,
  show_preset_modes: true,
  hidden_preset_modes: [],
  compact_layout_mode: "auto",
  tap_action: "toggle",
  tap_service: "",
  tap_service_data: "",
  tap_url: "",
  tap_new_tab: false,
  icon_tap_action: "",
  icon_tap_service: "",
  icon_tap_service_data: "",
  icon_tap_url: "",
  icon_tap_new_tab: false,
  hold_action: "more-info",
  hold_service: "",
  hold_service_data: "",
  hold_url: "",
  hold_new_tab: false,
  icon_hold_action: "",
  icon_hold_service: "",
  icon_hold_service_data: "",
  icon_hold_url: "",
  icon_hold_new_tab: false,
  double_tap_action: "none",
  icon_double_tap_action: "",
  double_tap_service: "",
  double_tap_service_data: "",
  double_tap_url: "",
  double_tap_new_tab: false,
  icon_double_tap_service: "",
  icon_double_tap_service_data: "",
  icon_double_tap_url: "",
  icon_double_tap_new_tab: false,
  security: {
    strict_service_actions: true,
    allowed_services: [],
    allowed_service_domains: [],
  },
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    icon_animation: true,
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
      size: "38px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      on_color: "var(--info-color, #71c0ff)",
      off_color: "var(--primary-text-color)",
    },
    control: {
      size: "36px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(113, 192, 255, 0.2)",
    },
    chip_height: "24px",
    chip_font_size: "9px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
    title_size: "12px",
    slider_wrap_height: "44px",
    slider_height: "22px",
    slider_thumb_size: "22px",
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

function getStubEntityId(hass, domains = []) {
  const states = hass?.states || {};
  const normalizedDomains = domains.map(domain => String(domain).trim()).filter(Boolean);
  return Object.keys(states).find(entityId => (
    !normalizedDomains.length || normalizedDomains.some(domain => entityId.startsWith(`${domain}.`))
  )) || "";
}

function applyStubEntity(config, hass, domains) {
  const entityId = getStubEntityId(hass, domains);
  if (!entityId) {
    return config;
  }

  config.entity = entityId;
  config.name = hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
  return config;
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


function isUnsafeConfigPathKey(key) {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

function setByPath(target, path, value) {
  const parts = path.split(".");
  if (parts.some(isUnsafeConfigPathKey)) {
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

function deleteByPath(target, path) {
  const parts = path.split(".");
  if (parts.some(isUnsafeConfigPathKey)) {
    return;
  }
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

function sanitizeCssValue(value, fallback) {
  const raw = String(value ?? "").trim();
  const safeFallback = String(fallback ?? "").trim();
  if (!raw) {
    return safeFallback;
  }
  if (/[\u0000-\u001f\u007f<>;"'{}]/.test(raw) || raw.includes("/*") || raw.includes("*/")) {
    return safeFallback;
  }
  return raw;
}

function getSafeStyles(styles = DEFAULT_CONFIG.styles) {
  const walk = (candidate, fallback) => {
    if (isObject(fallback)) {
      const out = {};
      const source = isObject(candidate) ? candidate : {};
      Object.keys(fallback).forEach(key => {
        out[key] = walk(source[key], fallback[key]);
      });
      return out;
    }
    if (typeof fallback === "string") {
      return sanitizeCssValue(candidate, fallback);
    }
    return candidate === undefined ? fallback : candidate;
  };
  return walk(styles, DEFAULT_CONFIG.styles);
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

  if (normalizedField.endsWith("off_color")) {
    return "var(--primary-text-color)";
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

function getSliderDragGeometry(slider) {
  const rect = slider.getBoundingClientRect();
  return {
    left: rect.left,
    width: rect.width,
    min: Number(slider.min || 0),
    max: Number(slider.max || 100),
    step: slider.step === "any" ? 0 : Number(slider.step || 1),
  };
}

function getRangeValueFromGeometry(geometry, currentValue, clientX) {
  if (!geometry || !Number.isFinite(geometry.width) || geometry.width <= 0) {
    return Number(currentValue || 0);
  }
  const ratio = clamp((clientX - geometry.left) / geometry.width, 0, 1);
  let nextValue = geometry.min + ((geometry.max - geometry.min) * ratio);
  if (Number.isFinite(geometry.step) && geometry.step > 0) {
    nextValue = geometry.min + (Math.round((nextValue - geometry.min) / geometry.step) * geometry.step);
  }
  return clamp(nextValue, geometry.min, geometry.max);
}

function translatePresetLabel(value) {
  const normalized = normalizeTextKey(value);

  switch (normalized) {
    case "auto":
    case "automatic":
      return "Auto";
    case "smart":
    case "smart_mode":
      return "Smart";
    case "sleep":
    case "night":
      return "Night";
    case "breeze":
    case "natural":
    case "nature":
      return "Breeze";
    case "eco":
      return "Eco";
    case "turbo":
      return "Turbo";
    case "boost":
      return "Boost";
    case "low":
      return "Low";
    case "medium":
    case "mid":
      return "Medium";
    case "high":
      return "High";
    case "quiet":
    case "silent":
      return "Quiet";
    case "normal":
    case "balanced":
      return "Normal";
    default:
      return String(value ?? "");
    }
}

/** Older defaults / editor-saved YAML used `--state-inactive-color`, which stays merged over new defaults. */
const LEGACY_ICON_OFF_COLOR_VALUES = [
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
];

function migrateLegacyIconOffColor(iconStyles, canonicalOffColor) {
  if (!iconStyles) {
    return;
  }
  const raw = String(iconStyles.off_color ?? "").trim();
  if (!raw) {
    return;
  }
  if (LEGACY_ICON_OFF_COLOR_VALUES.includes(raw)) {
    iconStyles.off_color = canonicalOffColor;
    return;
  }
  if (/^var\(\s*--state-inactive-color/i.test(raw)) {
    iconStyles.off_color = canonicalOffColor;
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

  migrateLegacyIconOffColor(config.styles?.icon, DEFAULT_CONFIG.styles.icon.off_color);

  const TAP_ACTIONS = new Set(["auto", "toggle", "more-info", "service", "url", "none"]);
  const normHold = String(config.hold_action ?? "none").trim().toLowerCase();
  config.hold_action = TAP_ACTIONS.has(normHold) ? normHold : "none";
  const iconHoldStr = config.icon_hold_action === undefined || config.icon_hold_action === null
    ? ""
    : String(config.icon_hold_action).trim();
  if (!iconHoldStr) {
    config.icon_hold_action = "";
  } else {
    const n = iconHoldStr.toLowerCase();
    config.icon_hold_action = TAP_ACTIONS.has(n) ? n : "";
  }
  config.hold_service = String(config.hold_service ?? "").trim();
  config.hold_service_data = String(config.hold_service_data ?? "").trim();
  config.hold_url = String(config.hold_url ?? "").trim();
  config.hold_new_tab = config.hold_new_tab === true;
  config.icon_hold_service = String(config.icon_hold_service ?? "").trim();
  config.icon_hold_service_data = String(config.icon_hold_service_data ?? "").trim();
  config.icon_hold_url = String(config.icon_hold_url ?? "").trim();
  config.icon_hold_new_tab = config.icon_hold_new_tab === true;
  const normDouble = String(config.double_tap_action ?? "none").trim().toLowerCase();
  config.double_tap_action = TAP_ACTIONS.has(normDouble) ? normDouble : "none";
  const iconDoubleStr = config.icon_double_tap_action === undefined || config.icon_double_tap_action === null
    ? ""
    : String(config.icon_double_tap_action).trim();
  if (!iconDoubleStr) {
    config.icon_double_tap_action = "";
  } else {
    const n = iconDoubleStr.toLowerCase();
    config.icon_double_tap_action = TAP_ACTIONS.has(n) ? n : "";
  }
  config.double_tap_service = String(config.double_tap_service ?? "").trim();
  config.double_tap_service_data = String(config.double_tap_service_data ?? "").trim();
  config.double_tap_url = String(config.double_tap_url ?? "").trim();
  config.double_tap_new_tab = config.double_tap_new_tab === true;
  config.icon_double_tap_service = String(config.icon_double_tap_service ?? "").trim();
  config.icon_double_tap_service_data = String(config.icon_double_tap_service_data ?? "").trim();
  config.icon_double_tap_url = String(config.icon_double_tap_url ?? "").trim();
  config.icon_double_tap_new_tab = config.icon_double_tap_new_tab === true;
  config.entity_picture = String(config.entity_picture ?? "").trim();
  config.show_entity_picture = config.show_entity_picture === true;
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? { ...DEFAULT_CONFIG.security, ...(isObject(config.security) ? config.security : {}) };

  return config;
}

class NodaliaFanCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["fan"]);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._optimisticToggle = null;
    this._optimisticToggleTimer = 0;
    this._optimisticVisualSettle = null;
    this._optimisticVisualSettleTimer = 0;
    this._lastKnownOnState = new Map();
    this._draftPercentage = new Map();
    this._presetPanelOpen = false;
    this._cardWidth = 0;
    this._isCompactLayout = false;
    this._activeSliderDrag = null;
    this._pendingRenderAfterDrag = false;
    this._skipNextSliderChange = null;
    this._dragFrame = 0;
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._pendingDragUpdate = null;
    this._dragWindowListenersAttached = false;
    this._lastRenderSignature = "";
    this._lastEntityRevision = "";
    this._lastRenderedIsOn = null;
    this._lastRenderedPresetPanelVisible = false;
    this._lastControlsMarkup = "";
    this._lastPresetPanelMarkup = "";
    this._animationCleanupTimer = 0;
    this._powerTransition = null;
    this._controlsTransition = null;
    this._presetPanelTransition = null;
    this._suppressNextFanTap = false;
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

      const signature = this._getRenderSignature();
      if (signature === this._lastRenderSignature) {
        return;
      }

      this._lastRenderSignature = signature;
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
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const path = event.composedPath();
              if (path.some(node => node instanceof HTMLInputElement && node.dataset?.fanControl)) {
                return null;
              }
              if (window.NodaliaUtils?.isNodaliaSliderChromeHit?.(event)) {
                return null;
              }
              const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.fanAction);
              const zone = actionButton?.dataset?.fanAction;
              return zone === "body" || zone === "icon" ? zone : null;
            },
            shouldBeginHold: zone => this._resolveFanHoldEffect(zone) !== "none",
            onHold: zone => {
              const effect = this._resolveFanHoldEffect(zone);
              if (effect === "none") {
                return;
              }
              this._triggerHaptic();
              this._executeFanHoldEffect(zone, effect);
            },
            markHoldConsumedClick: () => {
              this._suppressNextFanTap = true;
              window.NodaliaUtils?.cancelCardZoneTap?.(this);
            },
          })
        : () => {};
  }

  connectedCallback() {
    this._resizeObserver?.observe(this);
    this._scheduleOptimisticToggleTimeout();
    this._scheduleOptimisticVisualSettleTimeout();
  }

  disconnectedCallback() {
    this._detachHostHold?.();
    this._resizeObserver?.disconnect();
    this._detachWindowDragListeners();
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
    this._clearOptimisticToggleTimer();
    this._clearOptimisticVisualSettleTimer();
    window.NodaliaUtils?.clearDeferTimers?.(this);
  }

  setConfig(config) {
    const previousEntity = this._config?.entity || "";
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    if (previousEntity && previousEntity !== this._config.entity) {
      this._draftPercentage.delete(previousEntity);
      this._lastKnownOnState.delete(previousEntity);
      this._clearOptimisticVisualSettle();
      this._clearOptimisticToggleState();
    }
    this._isCompactLayout = this._shouldUseCompactLayout(
      Math.round(this._cardWidth || this.clientWidth || 0),
    );
    this._lastRenderSignature = "";
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const actualState = this._getActualState();
    const entityId = this._config?.entity || "";
    const entityRevision = entityId && actualState
      ? `${entityId}:${actualState.state}:${actualState.last_updated || actualState.last_changed || ""}`
      : "";
    const revisionUnchanged = Boolean(entityRevision && entityRevision === this._lastEntityRevision);
    if (entityRevision) {
      this._lastEntityRevision = entityRevision;
    }
    const hasPendingOptimistic = Boolean(this._optimisticToggle || this._optimisticVisualSettle);
    let nextSignature = this._getRenderSignature();
    const signatureUnchanged = Boolean(
      this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature,
    );

    if (signatureUnchanged && !hasPendingOptimistic) {
      return;
    }

    let visualSettleChanged = false;
    if (!revisionUnchanged || hasPendingOptimistic) {
      visualSettleChanged = this._syncOptimisticVisualSettle(actualState);
    }

    const hadOptimisticToggle = Boolean(this._optimisticToggle);
    if (!revisionUnchanged || hasPendingOptimistic) {
      this._syncLastKnownOnState(actualState);
      this._syncOptimisticToggleState(actualState);
    }
    nextSignature = this._getRenderSignature();
    const optimisticJustConfirmed = hadOptimisticToggle && !this._optimisticToggle;

    if (
      signatureUnchanged
      && !optimisticJustConfirmed
      && !visualSettleChanged
      && this._shouldSkipRenderForUnchangedSignature()
    ) {
      return;
    }

    if (
      this.shadowRoot?.innerHTML
      && nextSignature === this._lastRenderSignature
      && !optimisticJustConfirmed
      && !this._optimisticToggle
      && !visualSettleChanged
    ) {
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
    const actualState = entityId ? hass?.states?.[entityId] || null : null;
    const state = hass === this._hass ? this._buildOptimisticToggleState(actualState) : actualState;
    const attrs = state?.attributes || {};
    const joinParts = window.NodaliaRenderSignature?.joinParts;
    const values = [
      entityId,
      String(state?.state || ""),
      String(attrs._nodalia_optimistic_toggle || ""),
      String(attrs.friendly_name || ""),
      String(attrs.icon || ""),
      this._config?.show_entity_picture === true,
      String(this._config?.entity_picture || attrs.entity_picture_local || attrs.entity_picture || ""),
      Number(attrs.percentage ?? -1),
      Number(attrs.percentage_step ?? -1),
      String(attrs.preset_mode || ""),
      Array.isArray(attrs.preset_modes) ? attrs.preset_modes.join("|") : "",
      String(attrs.oscillating ?? ""),
      String(attrs.direction || ""),
      Boolean(this._isCompactLayout),
      Boolean(this._presetPanelOpen),
      `${String(this._config?.tap_action || "")}|${String(this._config?.icon_tap_action ?? "")}|${String(this._config?.tap_service || "")}|${String(this._config?.icon_tap_service || "")}`,
      `${String(this._config?.hold_action || "")}|${String(this._config?.icon_hold_action ?? "")}|${String(this._config?.hold_service || "")}|${String(this._config?.icon_hold_service || "")}`,
      `${String(this._config?.double_tap_action || "")}|${String(this._config?.icon_double_tap_action ?? "")}|${String(this._config?.double_tap_service || "")}|${String(this._config?.icon_double_tap_service || "")}`,
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "fan:", values }]);
    }
    return values.join("::");
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) && numericColumns > 0 ? numericColumns : null;
  }

  _getCompactLayoutThreshold() {
    const styles = getSafeStyles(this._config?.styles);
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
    const actualState = this._getActualState();
    const optimisticState = this._buildOptimisticToggleState(actualState);
    if (this._shouldUseOptimisticVisualSettle(actualState)) {
      return this._buildOptimisticVisualSettleState(actualState);
    }
    return optimisticState;
  }

  _getActualState(hass = this._hass) {
    return this._config?.entity ? hass?.states?.[this._config.entity] || null : null;
  }

  _createStateSnapshot(state) {
    if (!state) {
      return null;
    }
    return {
      ...state,
      attributes: { ...(state.attributes || {}) },
    };
  }

  _getStoredFanMemory() {
    if (typeof window === "undefined" || !window.localStorage) {
      return {};
    }
    try {
      return JSON.parse(window.localStorage.getItem(FAN_MEMORY_STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  _storeFanMemory(entityId, snapshot) {
    if (!entityId || !snapshot || typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      const memory = this._getStoredFanMemory();
      memory[entityId] = {
        attributes: { ...(snapshot.attributes || {}) },
        last_changed: snapshot.last_changed || new Date().toISOString(),
      };
      window.localStorage.setItem(FAN_MEMORY_STORAGE_KEY, JSON.stringify(memory));
    } catch {
      // Ignore storage quota or privacy mode failures.
    }
  }

  _getStoredFanSnapshot(entityId) {
    const stored = this._getStoredFanMemory()[entityId];
    if (!stored?.attributes || typeof stored.attributes !== "object") {
      return null;
    }
    return {
      entity_id: entityId,
      state: "on",
      attributes: { ...(stored.attributes || {}) },
      last_changed: stored.last_changed || new Date().toISOString(),
      last_updated: stored.last_changed || new Date().toISOString(),
    };
  }

  _syncLastKnownOnState(actualState) {
    const entityId = this._config?.entity || "";
    if (!entityId || !actualState) {
      return;
    }

    const snapshot = this._createStateSnapshot(actualState);
    if (actualState.state === "on") {
      this._lastKnownOnState.set(entityId, snapshot);
      this._storeFanMemory(entityId, snapshot);
      return;
    }

    const rememberedPercentage = Number(actualState.attributes?.percentage);
    if (Number.isFinite(rememberedPercentage) && rememberedPercentage > 0) {
      this._lastKnownOnState.set(entityId, {
        ...snapshot,
        state: "on",
      });
      this._storeFanMemory(entityId, snapshot);
    }
  }

  _getLastKnownOnState(entityId = this._config?.entity || "") {
    if (!entityId) {
      return null;
    }

    const cached = this._lastKnownOnState.get(entityId);
    if (cached) {
      return cached;
    }

    const stored = this._getStoredFanSnapshot(entityId);
    if (stored) {
      this._lastKnownOnState.set(entityId, this._createStateSnapshot(stored));
    }

    return stored;
  }

  _startOptimisticVisualSettle(actualState, optimisticState) {
    const entityId = this._config?.entity || "";
    if (!entityId || !actualState || actualState.state !== "on" || !optimisticState) {
      this._clearOptimisticVisualSettle();
      return;
    }

    this._optimisticVisualSettle = {
      entityId,
      expiresAt: Date.now() + OPTIMISTIC_VISUAL_SETTLE_MS,
      stateSnapshot: this._createStateSnapshot(optimisticState),
    };
    this._scheduleOptimisticVisualSettleTimeout();
  }

  _hasPublishedPercentage(actualState) {
    const percentage = Number(actualState?.attributes?.percentage);
    return Number.isFinite(percentage) && percentage > 0;
  }

  _shouldUseOptimisticVisualSettle(actualState = this._getActualState()) {
    if (!this._optimisticVisualSettle) {
      return false;
    }

    if (this._optimisticVisualSettle.entityId !== (this._config?.entity || "")) {
      this._clearOptimisticVisualSettle();
      return false;
    }

    if (actualState?.state !== "on" || Date.now() >= this._optimisticVisualSettle.expiresAt) {
      this._clearOptimisticVisualSettle();
      return false;
    }

    if (this._hasPublishedPercentage(actualState)) {
      this._clearOptimisticVisualSettle();
      return false;
    }

    return true;
  }

  _buildOptimisticVisualSettleState(actualState = this._getActualState()) {
    const snapshot = this._optimisticVisualSettle?.stateSnapshot;
    if (!actualState || !snapshot) {
      return actualState;
    }

    const entityId = this._config?.entity || "";
    const attrs = {
      ...(actualState.attributes || {}),
      ...(snapshot.attributes || {}),
    };

    if (entityId && this._draftPercentage.has(entityId)) {
      attrs.percentage = clamp(Math.round(Number(this._draftPercentage.get(entityId))), 0, 100);
    }

    return {
      ...actualState,
      attributes: attrs,
    };
  }

  _clearOptimisticToggleTimer() {
    if (this._optimisticToggleTimer) {
      window.clearTimeout(this._optimisticToggleTimer);
      this._optimisticToggleTimer = 0;
    }
  }

  _clearOptimisticVisualSettleTimer() {
    if (this._optimisticVisualSettleTimer) {
      window.clearTimeout(this._optimisticVisualSettleTimer);
      this._optimisticVisualSettleTimer = 0;
    }
  }

  _clearOptimisticVisualSettle() {
    this._clearOptimisticVisualSettleTimer();
    this._optimisticVisualSettle = null;
  }

  _syncOptimisticVisualSettle(actualState = this._getActualState()) {
    const hadSettle = Boolean(this._optimisticVisualSettle);
    this._shouldUseOptimisticVisualSettle(actualState);
    const hasSettle = Boolean(this._optimisticVisualSettle);
    if (hasSettle) {
      this._scheduleOptimisticVisualSettleTimeout();
    } else {
      this._clearOptimisticVisualSettleTimer();
    }
    return hadSettle !== hasSettle;
  }

  _scheduleOptimisticVisualSettleTimeout() {
    this._clearOptimisticVisualSettleTimer();
    if (!this._optimisticVisualSettle || !this.isConnected || typeof window === "undefined") {
      return;
    }

    const remaining = Math.max(0, this._optimisticVisualSettle.expiresAt - Date.now());
    this._optimisticVisualSettleTimer = window.setTimeout(() => {
      this._optimisticVisualSettleTimer = 0;
      if (!this.isConnected) {
        return;
      }
      const nextActualState = this._getActualState();
      if (this._shouldUseOptimisticVisualSettle(nextActualState)) {
        this._scheduleOptimisticVisualSettleTimeout();
        return;
      }
      this._lastRenderSignature = "";
      if (this._activeSliderDrag) {
        this._pendingRenderAfterDrag = true;
        return;
      }
      this._render();
    }, remaining);
  }

  _clearOptimisticToggleState() {
    this._clearOptimisticToggleTimer();
    this._optimisticToggle = null;
  }

  _isOptimisticTogglePending(actualState = this._getActualState()) {
    const entityId = this._config?.entity || "";
    if (!entityId || !this._optimisticToggle || this._optimisticToggle.entityId !== entityId) {
      this._optimisticToggle = null;
      return false;
    }

    const actualKey = normalizeTextKey(actualState?.state);
    const expectedKey = normalizeTextKey(this._optimisticToggle.expectedState);
    if (!actualState || !this._isFanToggleableState(actualState) || actualKey === expectedKey) {
      this._optimisticToggle = null;
      return false;
    }

    if (Date.now() >= this._optimisticToggle.expiresAt) {
      this._optimisticToggle = null;
      return false;
    }

    return true;
  }

  _scheduleOptimisticToggleTimeout() {
    this._clearOptimisticToggleTimer();
    if (!this._optimisticToggle || !this.isConnected || typeof window === "undefined") {
      return;
    }

    const remaining = Math.max(0, this._optimisticToggle.expiresAt - Date.now());
    this._optimisticToggleTimer = window.setTimeout(() => {
      this._optimisticToggleTimer = 0;
      if (!this.isConnected) {
        return;
      }
      if (!this._isOptimisticTogglePending(this._getActualState())) {
        this._lastRenderSignature = "";
        this._render();
        return;
      }
      this._scheduleOptimisticToggleTimeout();
    }, remaining);
  }

  _startOptimisticToggle(expectedState, actualState = this._getActualState()) {
    const entityId = this._config?.entity || "";
    if (!entityId || !this._isFanToggleableState(actualState)) {
      return;
    }

    const turningOn = normalizeTextKey(expectedState) === "on";
    const snapshotSource = turningOn
      ? (this._getLastKnownOnState(entityId) || actualState)
      : actualState;

    this._clearOptimisticToggleState();
    this._clearOptimisticVisualSettle();
    this._optimisticToggle = {
      entityId,
      expectedState,
      expiresAt: Date.now() + OPTIMISTIC_TOGGLE_TIMEOUT,
      stateSnapshot: this._createStateSnapshot(snapshotSource),
    };
    this._scheduleOptimisticToggleTimeout();
  }

  _composeOptimisticToggleState(actualState, toggle = this._optimisticToggle) {
    if (!toggle) {
      return actualState;
    }

    const turningOn = normalizeTextKey(toggle.expectedState) === "on";
    const snapshot = (turningOn
      ? (this._getLastKnownOnState(toggle.entityId) || toggle.stateSnapshot)
      : toggle.stateSnapshot) || actualState;
    if (!snapshot) {
      return actualState;
    }

    const entityId = toggle.entityId || this._config?.entity || "";
    const attrs = turningOn
      ? { ...(actualState?.attributes || {}), ...(snapshot.attributes || {}) }
      : { ...(snapshot.attributes || {}), ...(actualState?.attributes || {}) };

    if (entityId && this._draftPercentage.has(entityId)) {
      attrs.percentage = clamp(Math.round(Number(this._draftPercentage.get(entityId))), 0, 100);
    }

    return {
      ...snapshot,
      entity_id: snapshot.entity_id || actualState?.entity_id || entityId,
      state: toggle.expectedState,
      attributes: {
        ...attrs,
        _nodalia_optimistic_toggle: toggle.expectedState,
      },
    };
  }

  _buildOptimisticToggleState(actualState = this._getActualState()) {
    if (!this._isOptimisticTogglePending(actualState)) {
      return actualState;
    }

    return this._composeOptimisticToggleState(actualState);
  }

  _syncOptimisticToggleState(actualState = this._getActualState()) {
    const toggle = this._optimisticToggle;
    if (!toggle) {
      return;
    }

    const optimisticDisplay = this._composeOptimisticToggleState(actualState, toggle);
    const stillPending = this._isOptimisticTogglePending(actualState);

    if (!stillPending) {
      if (actualState?.state === "on" && normalizeTextKey(toggle.expectedState) === "on") {
        this._startOptimisticVisualSettle(actualState, optimisticDisplay);
      }
      this._clearOptimisticToggleTimer();
      return;
    }

    this._scheduleOptimisticToggleTimeout();
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

    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    return this._config?.entity || window.NodaliaI18n?.strings?.(lang)?.fan?.fallbackName || "Fan";
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

  _getEntityPicture(state) {
    if (this._config?.show_entity_picture !== true) {
      return "";
    }
    return String(
      this._config?.entity_picture
      || state?.attributes?.entity_picture_local
      || state?.attributes?.entity_picture
      || "",
    ).trim();
  }

  _getStateLabel(state) {
    const stateValue = normalizeTextKey(state?.state);
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const fanStrings = window.NodaliaI18n?.strings?.(lang)?.fan;
    if (fanStrings?.[stateValue]) {
      return fanStrings[stateValue];
    }

    switch (stateValue) {
      case "off":
        return fanStrings?.off || "Off";
      case "on":
        return fanStrings?.on || "On";
      case "unavailable":
        return fanStrings?.unavailable || "Unavailable";
      case "unknown":
        return fanStrings?.unknown || "Unknown";
      default:
        return state?.state ? String(state.state) : (fanStrings?.noState || "No state");
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
    const styles = getSafeStyles(this._config?.styles);
    return this._isOn(state)
      ? styles?.icon?.on_color || DEFAULT_CONFIG.styles.icon.on_color
      : styles?.icon?.off_color || DEFAULT_CONFIG.styles.icon.off_color;
  }

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;
    return {
      enabled: configuredAnimations.enabled !== false,
      iconAnimation: configuredAnimations.icon_animation !== false,
      powerDuration: clamp(Number(configuredAnimations.power_duration) || DEFAULT_CONFIG.animations.power_duration, 120, 4000),
      controlsDuration: clamp(Number(configuredAnimations.controls_duration) || DEFAULT_CONFIG.animations.controls_duration, 120, 2400),
      presetDuration: clamp(Number(configuredAnimations.preset_duration) || DEFAULT_CONFIG.animations.preset_duration, 120, 2400),
      buttonBounceDuration: clamp(Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration, 120, 1200),
    };
  }

  _isTransitionAnimationActive(now = Date.now()) {
    return Boolean(
      (this._powerTransition?.endsAt > now)
      || (this._controlsTransition?.endsAt > now)
      || (this._presetPanelTransition?.endsAt > now),
    );
  }

  _shouldSkipRenderForUnchangedSignature() {
    if (!this.shadowRoot?.innerHTML) {
      return false;
    }

    if (this._activeSliderDrag) {
      this._pendingRenderAfterDrag = true;
      return true;
    }

    return Boolean(this._optimisticToggle && this._isTransitionAnimationActive());
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

    const schedule = window.NodaliaUtils?.scheduleDeferTimer;
    const done = () => {
      if (!button.isConnected) {
        return;
      }
      button.classList.remove("is-pressing");
    };
    if (typeof schedule === "function") {
      schedule(this, done, animations.buttonBounceDuration + 40);
    } else {
      window.setTimeout(done, animations.buttonBounceDuration + 40);
    }
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
    const actualState = this._getActualState();
    const effectiveState = state || this._getState();
    const turnOff = this._isOn(effectiveState);
    this._startOptimisticToggle(turnOff ? "off" : "on", actualState);

    if (turnOff) {
      this._setFanState("turn_off");
      this._render();
      return;
    }

    this._setFanState("turn_on");
    this._render();
  }

  _isFanToggleableState(state) {
    const key = String(state?.state || "").trim().toLowerCase();
    return key === "on" || key === "off";
  }

  _resolveFanTapEffect(zone) {
    const bodyRaw = this._config?.tap_action ?? "toggle";
    const iconRaw = this._config?.icon_tap_action;
    const raw =
      zone === "icon"
        ? (iconRaw === undefined || iconRaw === null || String(iconRaw).trim() === "" ? bodyRaw : iconRaw)
        : bodyRaw;
    let effect = String(raw || "toggle").trim().toLowerCase();
    const allowed = new Set(["auto", "toggle", "more-info", "service", "url", "none"]);
    if (!allowed.has(effect)) {
      effect = "toggle";
    }
    if (effect === "auto") {
      const state = this._getState();
      return this._isFanToggleableState(state) ? "toggle" : "more-info";
    }
    return effect;
  }

  _openMoreInfo(entityId = this._config?.entity) {
    const id = String(entityId || "").trim();
    if (!id) {
      return;
    }
    fireEvent(this, "hass-more-info", {
      entityId: id,
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

  _isServiceAllowed(serviceValue) {
    const security = this._config?.security || {};
    if (security.strict_service_actions === false) {
      return true;
    }
    const normalizedService = String(serviceValue || "").trim().toLowerCase();
    if (!normalizedService || !normalizedService.includes(".")) {
      return false;
    }
    const [domain] = normalizedService.split(".");
    const domains = Array.isArray(security.allowed_service_domains)
      ? security.allowed_service_domains.map(item => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    const services = Array.isArray(security.allowed_services)
      ? security.allowed_services.map(item => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    if (!domains.length && !services.length) {
      return false;
    }
    return services.includes(normalizedService) || domains.includes(domain);
  }

  _callConfiguredService(serviceValue, entityId = this._config?.entity, rawData = "") {
    if (!this._hass || !serviceValue) {
      return;
    }
    if (!this._isServiceAllowed(serviceValue)) {
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Fan Card", serviceValue);
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

  _openConfiguredUrl(urlValue, newTab = false) {
    const url = window.NodaliaUtils?.sanitizeActionUrl(urlValue, { allowRelative: true }) || "";
    if (!url) {
      return;
    }
    if (newTab) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.href = url;
  }

  _executeFanTapEffect(zone, effect) {
    const isIcon = zone === "icon";
    switch (effect) {
      case "toggle":
        this._toggleFan(this._getState());
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service": {
        const service = isIcon ? this._config?.icon_tap_service : this._config?.tap_service;
        const data = isIcon ? this._config?.icon_tap_service_data : this._config?.tap_service_data;
        this._callConfiguredService(service, this._config?.entity, data);
        break;
      }
      case "url":
        this._openConfiguredUrl(
          isIcon ? this._config?.icon_tap_url : this._config?.tap_url,
          isIcon ? this._config?.icon_tap_new_tab === true : this._config?.tap_new_tab === true,
        );
        break;
      case "none":
      default:
        break;
    }
  }

  _resolveFanHoldEffect(zone) {
    const bodyRaw = this._config?.hold_action ?? "none";
    const iconRaw = this._config?.icon_hold_action;
    const raw =
      zone === "icon"
        ? (iconRaw === undefined || iconRaw === null || String(iconRaw).trim() === "" ? bodyRaw : iconRaw)
        : bodyRaw;
    let effect = String(raw || "none").trim().toLowerCase();
    const allowed = new Set(["auto", "toggle", "more-info", "service", "url", "none"]);
    if (!allowed.has(effect)) {
      effect = "none";
    }
    if (effect === "auto") {
      const state = this._getState();
      return this._isFanToggleableState(state) ? "toggle" : "more-info";
    }
    return effect;
  }

  _executeFanHoldEffect(zone, effect) {
    const isIcon = zone === "icon";
    switch (effect) {
      case "toggle":
        this._toggleFan(this._getState());
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service": {
        let service = isIcon ? this._config?.icon_hold_service : this._config?.hold_service;
        let data = isIcon ? this._config?.icon_hold_service_data : this._config?.hold_service_data;
        if (isIcon && !String(service || "").trim()) {
          service = this._config?.hold_service;
          data = this._config?.hold_service_data;
        }
        this._callConfiguredService(service, this._config?.entity, data);
        break;
      }
      case "url": {
        let url = isIcon ? this._config?.icon_hold_url : this._config?.hold_url;
        let tab = isIcon ? this._config?.icon_hold_new_tab === true : this._config?.hold_new_tab === true;
        if (isIcon && !String(url || "").trim()) {
          url = this._config?.hold_url;
          tab = this._config?.hold_new_tab === true;
        }
        this._openConfiguredUrl(url, tab);
        break;
      }
      case "none":
      default:
        break;
    }
  }

  _resolveFanDoubleTapEffect(zone) {
    const bodyRaw = this._config?.double_tap_action ?? "none";
    const iconRaw = this._config?.icon_double_tap_action;
    const raw =
      zone === "icon"
        ? (iconRaw === undefined || iconRaw === null || String(iconRaw).trim() === "" ? bodyRaw : iconRaw)
        : bodyRaw;
    let effect = String(raw || "none").trim().toLowerCase();
    if (!ALLOWED_DOUBLE_TAP_ACTIONS.has(effect)) {
      effect = "none";
    }
    if (effect === "auto") {
      const state = this._getState();
      return this._isFanToggleableState(state) ? "toggle" : "more-info";
    }
    return effect;
  }

  _executeFanDoubleTapEffect(zone, effect) {
    const isIcon = zone === "icon";
    switch (effect) {
      case "toggle":
        this._toggleFan(this._getState());
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service": {
        let service = isIcon ? this._config?.icon_double_tap_service : this._config?.double_tap_service;
        let data = isIcon ? this._config?.icon_double_tap_service_data : this._config?.double_tap_service_data;
        if (isIcon && !String(service || "").trim()) {
          service = this._config?.double_tap_service;
          data = this._config?.double_tap_service_data;
        }
        this._callConfiguredService(service, this._config?.entity, data);
        break;
      }
      case "url": {
        let url = isIcon ? this._config?.icon_double_tap_url : this._config?.double_tap_url;
        let tab = isIcon ? this._config?.icon_double_tap_new_tab === true : this._config?.double_tap_new_tab === true;
        if (isIcon && !String(url || "").trim()) {
          url = this._config?.double_tap_url;
          tab = this._config?.double_tap_new_tab === true;
        }
        this._openConfiguredUrl(url, tab);
        break;
      }
      case "none":
      default:
        break;
    }
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
      const schedule = window.NodaliaUtils?.scheduleDeferTimer;
      if (typeof schedule === "function") {
        schedule(this, finalizeRemoval, animations.presetDuration + 80);
      } else {
        window.setTimeout(finalizeRemoval, animations.presetDuration + 80);
      }
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
      const schedule = window.NodaliaUtils?.scheduleDeferTimer;
      const finalizeEnter = () => {
        if (panelNode.isConnected) {
          panelNode.classList.remove("fan-card__preset-panel-shell--entering");
        }
      };
      if (typeof schedule === "function") {
        schedule(this, finalizeEnter, animations.presetDuration + 80);
      } else {
        window.setTimeout(finalizeEnter, animations.presetDuration + 80);
      }
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

    const chip = this.shadowRoot?.querySelector('[data-fan-chip="percentage"]');
    if (chip instanceof HTMLElement) {
      chip.textContent = `${Math.round(nextValue)}%`;
    }

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
    const nextValue = getRangeValueFromGeometry(this._activeSliderDrag?.geometry, slider.value, clientX);
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
      geometry: getSliderDragGeometry(slider),
    };
    this._attachWindowDragListeners();

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this._pendingDragUpdate = null;
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }

    const nextValue = getRangeValueFromGeometry(this._activeSliderDrag.geometry, slider.value, clientX);
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

    const nextValue = getRangeValueFromGeometry(drag.geometry, drag.slider.value, clientX);
    drag.slider.value = String(nextValue);
    this._skipNextSliderChange = drag.slider;
    this._applySliderValue(drag.slider, nextValue, { commit: true });

    this._activeSliderDrag = null;
    this._detachWindowDragListeners();
    this._suppressNextFanTap = true;

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
    this._detachWindowDragListeners();
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
      this._detachWindowDragListeners();
      if (this._pendingRenderAfterDrag) {
        this._pendingRenderAfterDrag = false;
        this._render();
      }
      return;
    }

    this._commitSliderDrag(clientX, event);
  }

  _attachWindowDragListeners() {
    if (this._dragWindowListenersAttached) {
      return;
    }
    this._dragWindowListenersAttached = true;
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

  _detachWindowDragListeners() {
    if (!this._dragWindowListenersAttached) {
      return;
    }
    this._dragWindowListenersAttached = false;
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
    const fanAction = actionButton.dataset.fanAction;

    if (fanAction === "body" || fanAction === "icon") {
      const zone = fanAction;
      if (window.NodaliaUtils?.isNodaliaSliderChromeHit?.(event)) {
        return;
      }
      if (this._suppressNextFanTap) {
        this._suppressNextFanTap = false;
        return;
      }
      const tapEffect = this._resolveFanTapEffect(zone);
      const doubleEffect = this._resolveFanDoubleTapEffect(zone);
      const runTap = () => {
        if (tapEffect === "none") {
          return;
        }
        this._triggerHaptic();
        this._executeFanTapEffect(zone, tapEffect);
      };
      const runDouble = () => {
        if (doubleEffect === "none") {
          return;
        }
        this._triggerHaptic();
        this._executeFanDoubleTapEffect(zone, doubleEffect);
      };
      if (doubleEffect !== "none" && typeof window.NodaliaUtils?.scheduleCardZoneTap === "function") {
        window.NodaliaUtils.scheduleCardZoneTap(this, { zone, onSingle: runTap, onDouble: runDouble });
        return;
      }
      runTap();
      return;
    }

    this._triggerHaptic();

    switch (fanAction) {
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

  _fanCardUi(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.fan;
    const enPack = window.NodaliaI18n?.strings?.("en")?.fan;
    const raw = pack?.[key] ?? enPack?.[key];
    return String(raw != null && raw !== "" ? raw : fallback);
  }

  _fanAria(key, fallback = "") {
    return window.NodaliaI18n?.translateFanAria?.(this._hass, this._config?.language ?? "auto", key, fallback) || fallback;
  }

  _renderEmptyState() {
    const title = escapeHtml(this._fanCardUi("emptyTitle", "Nodalia Fan Card"));
    const body = escapeHtml(
      this._fanCardUi("emptyBody", "Set `entity` to a `fan.*` entity to show this card."),
    );
    return `
      <ha-card class="fan-card fan-card--empty">
        <div class="fan-card__empty-title">${title}</div>
        <div class="fan-card__empty-text">${body}</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const styles = config.styles;

    const entityGuard = window.NodaliaUtils?.renderLovelaceEntityGuardCardHtml?.(
      this._hass,
      config.entity,
      { cardClass: "fan-card" },
    );
    if (entityGuard) {
      this.shadowRoot.innerHTML = entityGuard;
      return;
    }

    const state = this._getState();
    if (!state) {
      this.shadowRoot.innerHTML = window.NodaliaUtils?.renderCardEmptyStateDocument?.(
        this._renderEmptyState(),
        { card: (config || DEFAULT_CONFIG).styles?.card },
      ) ?? this._renderEmptyState();
      return;
    }

    const isOn = this._isOn(state);
    const title = this._getFanName(state);
    const icon = this._getFanIcon(state);
    const entityPicture = this._getEntityPicture(state);
    const accentColor = this._getAccentColor(state);
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const darkenBubbleIconGlyph =
      isOn && Boolean(window.NodaliaBubbleContrast?.shouldDarkenBubbleIconGlyph(state, accentColor));
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
      chips.push(`<span class="fan-card__chip" data-fan-chip="percentage">${escapeHtml(`${Math.round(currentPercentage)}%`)}</span>`);
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
        startedAt: now,
        state: powerAnimationState,
      };

      if (supportsPercentage || hasSecondaryControls || this._lastControlsMarkup) {
        controlsAnimationState = isOn ? "entering" : "leaving";
        this._controlsTransition = {
          endsAt: now + animations.controlsDuration,
          startedAt: now,
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
          startedAt: now,
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
    let percentageFillDelay = 0;
    if (shouldAnimatePercentageFill && this._powerTransition?.startedAt != null) {
      const fillElapsed = now - Number(this._powerTransition.startedAt);
      if (fillElapsed > 0) {
        percentageFillDelay = -clamp(fillElapsed, 0, percentageFillDuration);
      }
    }
    const percentageSliderShellClass = shouldAnimatePercentageFill ? " fan-card__slider-shell--percentage-fill" : "";
    const shouldAnimatePercentageEmpty = animations.enabled && controlsAnimationState === "leaving";
    const percentageEmptyDuration = shouldAnimatePercentageEmpty
      ? clamp(Math.round(animations.controlsDuration * 0.72), 180, 900)
      : 0;
    let percentageEmptyDelay = 0;
    if (shouldAnimatePercentageEmpty && this._controlsTransition?.startedAt != null) {
      percentageEmptyDelay = -clamp(now - Number(this._controlsTransition.startedAt), 0, percentageEmptyDuration);
    }

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
                aria-label="${escapeHtml(this._fanAria("speedSlider", "Speed"))}"
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
                          aria-label="${escapeHtml(this._fanAria(this._isOscillating(state) ? "oscillationOff" : "oscillationOn", this._isOscillating(state) ? "Turn oscillation off" : "Turn oscillation on"))}"
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
                          aria-label="${escapeHtml(this._fanAria("showModes", "Show modes"))}"
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
                    aria-label="${escapeHtml(this._fanAria(this._isOscillating(state) ? "oscillationOff" : "oscillationOn", this._isOscillating(state) ? "Turn oscillation off" : "Turn oscillation on"))}"
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
                    aria-label="${escapeHtml(this._fanAria("showModes", "Show modes"))}"
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
        <div class="fan-card__controls-shell ${controlsAnimationState ? `fan-card__controls-shell--${controlsAnimationState}` : ""}" data-nodalia-tap-shield="true">
          <div class="fan-card__controls-inner">
            ${controlsContentMarkup}
          </div>
        </div>
      `
      : "";
    const powerAnimationRemaining = powerAnimationState && this._powerTransition
      ? Math.max(0, this._powerTransition.endsAt - now)
      : 0;
    const powerAnimationDelay = powerAnimationState && this._powerTransition
      ? -clamp(now - Number(this._powerTransition.startedAt || now), 0, animations.powerDuration)
      : 0;
    const controlsAnimationRemaining = controlsAnimationState && this._controlsTransition
      ? Math.max(0, this._controlsTransition.endsAt - now)
      : 0;
    const controlsAnimationDelay = controlsAnimationState && this._controlsTransition
      ? -clamp(now - Number(this._controlsTransition.startedAt || now), 0, animations.controlsDuration)
      : 0;
    const presetAnimationRemaining = presetPanelAnimationState && this._presetPanelTransition
      ? Math.max(0, this._presetPanelTransition.endsAt - now)
      : 0;
    const presetAnimationDelay = presetPanelAnimationState && this._presetPanelTransition
      ? -clamp(now - Number(this._presetPanelTransition.startedAt || now), 0, animations.presetDuration)
      : 0;
    const percentageFillAnimationRemaining = shouldAnimatePercentageFill && this._powerTransition
      ? Math.max(0, Number(this._powerTransition.startedAt) + percentageFillDuration - now)
      : 0;
    const percentageEmptyAnimationRemaining = shouldAnimatePercentageEmpty && this._controlsTransition
      ? Math.max(0, Number(this._controlsTransition.startedAt) + percentageEmptyDuration - now)
      : 0;
    const shouldCleanupAfterAnimation = Boolean(
      powerAnimationRemaining ||
      controlsAnimationRemaining ||
      presetAnimationRemaining ||
      percentageFillAnimationRemaining ||
      percentageEmptyAnimationRemaining,
    );
    const cleanupDelay = shouldCleanupAfterAnimation
      ? Math.max(
        powerAnimationRemaining,
        controlsAnimationRemaining,
        presetAnimationRemaining,
        percentageFillAnimationRemaining,
        percentageEmptyAnimationRemaining,
      ) + 40
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
          --fan-card-controls-delay: ${controlsAnimationDelay}ms;
          --fan-card-panel-duration: ${animations.presetDuration}ms;
          --fan-card-panel-delay: ${presetAnimationDelay}ms;
          --fan-card-power-duration: ${animations.powerDuration}ms;
          --fan-card-power-delay: ${powerAnimationDelay}ms;
          --fan-card-percentage-fill-delay: ${percentageFillDelay}ms;
          --fan-card-percentage-fill-duration: ${percentageFillDuration}ms;
          --fan-card-percentage-empty-delay: ${percentageEmptyDelay}ms;
          --fan-card-percentage-empty-duration: ${percentageEmptyDuration}ms;
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
          animation: fan-card-power-up var(--fan-card-power-duration) cubic-bezier(0.24, 0.82, 0.25, 1) var(--fan-card-power-delay, 0ms) both;
        }

        .fan-card--powering-down {
          animation: fan-card-power-down var(--fan-card-power-duration) cubic-bezier(0.32, 0, 0.24, 1) var(--fan-card-power-delay, 0ms) both;
        }

        .fan-card--powering-up::after {
          animation: fan-card-power-glow-in var(--fan-card-power-duration) cubic-bezier(0.24, 0.82, 0.25, 1) var(--fan-card-power-delay, 0ms) both;
        }

        .fan-card--powering-down::after {
          animation: fan-card-power-glow-out var(--fan-card-power-duration) cubic-bezier(0.32, 0, 0.24, 1) var(--fan-card-power-delay, 0ms) both;
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
            ? `color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent))`
            : "color-mix(in srgb, var(--primary-text-color) 6%, transparent)"};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
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
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, color 180ms ease, transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1);
          width: ${styles.icon.size};
        }

        .fan-card__icon ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.46);
          color: ${
            darkenBubbleIconGlyph
              ? `color-mix(in srgb, var(--primary-text-color) 56%, ${accentColor})`
              : (isOn ? styles.icon.on_color : styles.icon.off_color)
          };
          display: inline-flex;
          height: calc(${styles.icon.size} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          backface-visibility: hidden;
          transform: translate3d(-50%, -50%, 0);
          transform-origin: 50% 50%;
          width: calc(${styles.icon.size} * 0.46);
          will-change: transform;
        }

        .fan-card__icon--active-motion ha-icon {
          animation: fan-card-icon-spin 1.35s linear infinite;
          transform: translate3d(-50%, -50%, 0);
        }

        .fan-card__picture {
          border-radius: inherit;
          height: 100%;
          inset: 0;
          object-fit: cover;
          pointer-events: none;
          position: absolute;
          width: 100%;
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
          border-radius: ${chipBorderRadius};
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
          animation: fan-card-controls-expand var(--fan-card-controls-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--fan-card-controls-delay, 0ms) both;
          overflow: visible;
          transform-origin: top;
        }

        .fan-card__controls-shell--entering .fan-card__controls-inner {
          animation: fan-card-controls-content-in var(--fan-card-controls-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--fan-card-controls-delay, 0ms) both;
          transform-origin: top;
        }

        .fan-card__controls-shell--leaving {
          animation: fan-card-controls-collapse var(--fan-card-controls-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--fan-card-controls-delay, 0ms) both;
          pointer-events: none;
          transform-origin: top;
        }

        .fan-card__controls-shell--leaving .fan-card__controls-inner {
          animation: fan-card-controls-content-out var(--fan-card-controls-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--fan-card-controls-delay, 0ms) both;
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
          transform: scaleX(0.01);
          animation: fan-card-percentage-fill var(--fan-card-percentage-fill-duration) cubic-bezier(0.2, 0.86, 0.18, 1) var(--fan-card-percentage-fill-delay, 0ms) both;
        }

        ${
          shouldAnimatePercentageEmpty
            ? `
        .fan-card__controls-shell--leaving .fan-card__slider-track::before {
          animation: fan-card-percentage-empty var(--fan-card-percentage-empty-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--fan-card-percentage-empty-delay, 0ms) both;
        }
        `
            : ""
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
          animation: fan-card-preset-panel-expand var(--fan-card-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--fan-card-panel-delay, 0ms) both;
          transform-origin: top;
        }

        .fan-card__preset-panel-shell--entering .fan-card__preset-panel-inner {
          animation: fan-card-preset-panel-content-in var(--fan-card-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--fan-card-panel-delay, 0ms) both;
          transform-origin: top;
        }

        .fan-card__preset-panel-shell--leaving {
          animation: fan-card-preset-panel-collapse var(--fan-card-panel-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--fan-card-panel-delay, 0ms) both;
          pointer-events: none;
          transform-origin: top;
        }

        .fan-card__preset-panel-shell--leaving .fan-card__preset-panel-inner {
          animation: fan-card-preset-panel-content-out var(--fan-card-panel-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--fan-card-panel-delay, 0ms) both;
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
          0% {
            transform: scaleX(calc(var(--percentage-target, var(--percentage, 0)) / 100));
          }
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
            transform: translateY(-4px) scaleY(0.98);
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

        @keyframes fan-card-icon-spin {
          from {
            transform: translate3d(-50%, -50%, 0) rotate(0deg);
          }
          to {
            transform: translate3d(-50%, -50%, 0) rotate(360deg);
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

          .fan-card__icon--active-motion ha-icon {
            animation: none !important;
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
        data-fan-action="body"
        style="--accent-color:${escapeHtml(accentColor)};"
      >
        <div class="fan-card__content">
          <div class="fan-card__hero">
            <button
              type="button"
              class="fan-card__icon ${animations.enabled && animations.iconAnimation && isOn ? "fan-card__icon--active-motion" : ""}"
              data-fan-action="icon"
              aria-label="${escapeHtml(window.NodaliaI18n?.translateCommonAria?.(this._hass, config.language ?? "auto", "togglePower", "Turn on or off") || "Turn on or off")}"
            >
              ${entityPicture
                ? `<img class="fan-card__picture" src="${escapeHtml(entityPicture)}" alt="" loading="lazy" />`
                : `<ha-icon icon="${escapeHtml(icon)}"></ha-icon>`}
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
    this._showTapActionsSection = false;
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
  }

  _attachEditorShadowListeners() {
    if (this._editorShadowListenersAttached || !this.shadowRoot) {
      return;
    }
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this._editorShadowListenersAttached = true;
  }

  _detachEditorShadowListeners() {
    if (!this._editorShadowListenersAttached || !this.shadowRoot) {
      return;
    }
    this.shadowRoot.removeEventListener("input", this._onShadowInput);
    this.shadowRoot.removeEventListener("change", this._onShadowInput);
    this.shadowRoot.removeEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.removeEventListener("click", this._onShadowClick);
    this._editorShadowListenersAttached = false;
  }

  connectedCallback() {
    this._attachEditorShadowListeners();
  }

  disconnectedCallback() {
    this._detachEditorShadowListeners();
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
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
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

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id => id.startsWith("fan."));
  }

  _getFanEntityOptions() {
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
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
        left.label.localeCompare(right.label, sortLoc, { sensitivity: "base" })
        || left.value.localeCompare(right.value, sortLoc, { sensitivity: "base" })
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
      config: compactConfig(window.NodaliaUtils.stripEqualToDefaults(nextConfig, DEFAULT_CONFIG) ?? {}),
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

    const field = control.dataset.field;
    const previousEntity = field === "entity" ? String(this._config?.entity || "").trim() : "";
    this._setFieldValue(field, nextValue);
    if (field === "entity") {
      window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass, { previousEntity });
    }
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
      return;
    }

    if (toggleButton.dataset.editorToggle === "tap_actions") {
      this._showTapActionsSection = !this._showTapActionsSection;
      this._render();
    }
  }

  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    const hass = this._hass ?? this.hass;
    return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", s);
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const min = options.min !== undefined ? `min="${escapeHtml(String(options.min))}"` : "";
    const max = options.max !== undefined ? `max="${escapeHtml(String(options.max))}"` : "";
    const step = options.step !== undefined ? `step="${escapeHtml(String(options.step))}"` : "";
    const valueType = options.valueType || "string";
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
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
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("ed.weather.custom_color");
    const fallbackValue = options.fallbackValue || getEditorColorFallbackValue(field);
    const currentValue = value === undefined || value === null || value === ""
      ? fallbackValue
      : String(value);
    const colorModel = getEditorColorModel(currentValue, fallbackValue);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="${escapeHtml(tColorCustom)}">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="color"
              data-alpha="${escapeHtml(String(colorModel.alpha))}"
              value="${escapeHtml(colorModel.hex)}"
              aria-label="${escapeHtml(tLabel)}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-field="${escapeHtml(field)}"
          data-value-type="boolean"
          ${checked ? "checked" : ""}
        />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(tLabel)}</span>
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
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options
            .map(option => `
              <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
                ${escapeHtml(this._editorLabel(option.label))}
              </option>
            `)
            .join("")}
        </select>
      </label>
    `;
  }

  _renderFanEntityField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
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
    const tLabel = this._editorLabel(label);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
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
    const phFanName = this._editorLabel("ed.light.name_placeholder");
    const tapAction = config.tap_action || "toggle";
    const iconTapActionRaw = String(config.icon_tap_action ?? "").trim();
    const iconTapSelectValue = iconTapActionRaw;
    const showIconTapService = iconTapSelectValue === "service";
    const showCardTapService = tapAction === "service";
    const holdAction = config.hold_action || "none";
    const iconHoldSelect = String(config.icon_hold_action ?? "").trim();
    const showCardHoldService = holdAction === "service";
    const showIconHoldService = iconHoldSelect === "service" || (iconHoldSelect === "" && holdAction === "service");
    const showTapServiceSecurity = showIconTapService || showCardTapService || showCardHoldService || showIconHoldService;

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

        .editor-chip-radius__options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .editor-chip-radius__option {
          align-items: center;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 12px;
          cursor: pointer;
          display: inline-flex;
          gap: 8px;
          padding: 8px 12px;
        }

        .editor-chip-radius__option:has(input:checked) {
          background: color-mix(in srgb, var(--primary-color) 10%, transparent);
          border-color: var(--primary-color);
        }

        .editor-chip-radius__option input[type="radio"] {
          accent-color: var(--primary-color);
          appearance: auto;
          margin: 0;
          min-height: auto;
          padding: 0;
          width: auto;
        }


        .editor-field:has(> .editor-control-host[data-mounted-control="entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="entity-picker"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="vacuum-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="select-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="sensor-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="light-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="fan-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="humidifier-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="icon-picker"]),
        .editor-field:has(> ha-icon-picker) {
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.light.general_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderFanEntityField("ed.fan.fan_entity", "entity", config.entity, {
              placeholder: "fan.salon",
              fullWidth: true,
            })}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, {
              placeholder: "mdi:fan",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.entity.name", "name", config.name, {
              placeholder: phFanName,
              fullWidth: true,
            })}
            ${this._renderCheckboxField("ed.entity.show_entity_picture", "show_entity_picture", config.show_entity_picture === true)}
            ${this._renderTextField("ed.entity.entity_picture", "entity_picture", config.entity_picture, {
              placeholder: "/local/fan.png",
              fullWidth: true,
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.light.tap_actions_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.light.tap_actions_section_hint"))}</div>
            <div class="editor-section__actions">
              ${window.NodaliaUtils.renderEditorCollapsibleToggleHtml({
                toggleId: "tap_actions",
                expanded: this._showTapActionsSection === true,
                showLabel: this._editorLabel("ed.shared.show_tap_action_settings"),
                hideLabel: this._editorLabel("ed.shared.hide_tap_action_settings"),
                escapeHtml,
              })}
            </div>
          </div>
          ${
            this._showTapActionsSection
              ? `
          <div class="editor-grid editor-grid--stacked">
            ${this._renderSelectField(
              "ed.light.icon_tap_action",
              "icon_tap_action",
              iconTapSelectValue,
              [
                { value: "", label: "ed.entity.icon_tap_inherit" },
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.light.card_tap_action",
              "tap_action",
              tapAction,
              [
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${
              showIconTapService
                ? `
                  ${this._renderTextField("ed.entity.tap_service_field", "icon_tap_service", config.icon_tap_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.tap_service_data_json", "icon_tap_service_data", config.icon_tap_service_data, {
                    placeholder: '{"brightness_pct": 50}',
                  })}
                `
                : ""
            }
            ${
              showCardTapService
                ? `
                  ${this._renderTextField("ed.entity.tap_service_field", "tap_service", config.tap_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.tap_service_data_json", "tap_service_data", config.tap_service_data, {
                    placeholder: '{"brightness_pct": 70}',
                  })}
                `
                : ""
            }
            ${
              showTapServiceSecurity
                ? `
                  ${this._renderCheckboxField(
                    "ed.entity.security_strict",
                    "security.strict_service_actions",
                    config.security?.strict_service_actions !== false,
                  )}
                  ${
                    config.security?.strict_service_actions !== false
                      ? this._renderTextField(
                          "ed.entity.allowed_services_csv",
                          "security.allowed_services",
                          Array.isArray(config.security?.allowed_services) ? config.security.allowed_services.join(", ") : "",
                          {
                            placeholder: "browser_mod.javascript, light.turn_on",
                            valueType: "csv",
                            fullWidth: true,
                          },
                        )
                      : ""
                  }
                `
                : ""
            }
            ${
              iconTapSelectValue === "url"
                ? `
                  ${this._renderTextField("ed.entity.tap_url_field", "icon_tap_url", config.icon_tap_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.tap_new_tab", "icon_tap_new_tab", config.icon_tap_new_tab === true)}
                `
                : ""
            }
            ${
              tapAction === "url"
                ? `
                  ${this._renderTextField("ed.entity.tap_url_field", "tap_url", config.tap_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.tap_new_tab", "tap_new_tab", config.tap_new_tab === true)}
                `
                : ""
            }
            <div class="editor-section__hint editor-field--full" style="margin-top: 8px;">${escapeHtml(this._editorLabel("ed.light.hold_actions_section_hint"))}</div>
            ${this._renderSelectField(
              "ed.light.icon_hold_action",
              "icon_hold_action",
              iconHoldSelect,
              [
                { value: "", label: "ed.entity.icon_hold_inherit" },
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.light.card_hold_action",
              "hold_action",
              holdAction,
              [
                { value: "auto", label: "ed.entity.tap_auto" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "none", label: "ed.entity.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${
              showIconHoldService
                ? `
                  ${this._renderTextField("ed.entity.hold_service_field", "icon_hold_service", config.icon_hold_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.hold_service_data_json", "icon_hold_service_data", config.icon_hold_service_data, {
                    placeholder: '{"brightness_pct": 50}',
                  })}
                `
                : ""
            }
            ${
              showCardHoldService
                ? `
                  ${this._renderTextField("ed.entity.hold_service_field", "hold_service", config.hold_service, {
                    placeholder: "light.turn_on",
                    fullWidth: true,
                  })}
                  ${this._renderTextareaField("ed.entity.hold_service_data_json", "hold_service_data", config.hold_service_data, {
                    placeholder: '{"brightness_pct": 70}',
                  })}
                `
                : ""
            }
            ${
              iconHoldSelect === "url" || (iconHoldSelect === "" && holdAction === "url")
                ? `
                  ${this._renderTextField("ed.entity.hold_url_field", "icon_hold_url", config.icon_hold_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.hold_new_tab", "icon_hold_new_tab", config.icon_hold_new_tab === true)}
                `
                : ""
            }
            ${
              holdAction === "url"
                ? `
                  ${this._renderTextField("ed.entity.hold_url_field", "hold_url", config.hold_url, {
                    placeholder: "https://example.com",
                    fullWidth: true,
                  })}
                  ${this._renderCheckboxField("ed.entity.hold_new_tab", "hold_new_tab", config.hold_new_tab === true)}
                `
                : ""
            }
          </div>

              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.visibility_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.light.visibility_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.vacuum.layout_narrow",
              "compact_layout_mode",
              config.compact_layout_mode || "auto",
              [
                { value: "auto", label: "ed.vacuum.layout_auto" },
                { value: "always", label: "ed.vacuum.layout_always" },
                { value: "never", label: "ed.vacuum.layout_never" },
              ],
            )}
            ${this._renderCheckboxField("ed.fan.show_state_bubble", "show_state", config.show_state === true)}
            ${this._renderCheckboxField("ed.fan.speed_chip", "show_percentage_chip", config.show_percentage_chip !== false)}
            ${this._renderCheckboxField("ed.fan.mode_chip", "show_mode_chip", config.show_mode_chip !== false)}
            ${this._renderCheckboxField("ed.fan.show_slider", "show_slider", config.show_slider !== false)}
            ${this._renderCheckboxField("ed.fan.oscillation_button", "show_oscillation", config.show_oscillation !== false)}
            ${this._renderCheckboxField("ed.fan.preset_modes_toggle", "show_preset_modes", config.show_preset_modes !== false)}
            ${
              presetModeVisibilityOptions.length
                ? `
                  <div class="editor-subsection editor-field--full">
                    <div class="editor-subsection__title">${escapeHtml(this._editorLabel("ed.fan.preset_modes_title"))}</div>
                    <div class="editor-subsection__hint">${escapeHtml(this._editorLabel("ed.fan.preset_modes_hint"))}</div>
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.haptics_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.vacuum.enable_haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("ed.vacuum.fallback_vibrate", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "ed.vacuum.haptic_style",
              "haptics.style",
              hapticStyle,
              [
                { value: "selection", label: "ed.weather.haptic_selection" },
                { value: "light", label: "ed.weather.haptic_light" },
                { value: "medium", label: "ed.weather.haptic_medium" },
                { value: "heavy", label: "ed.weather.haptic_heavy" },
                { value: "success", label: "ed.weather.haptic_success" },
                { value: "warning", label: "ed.weather.haptic_warning" },
                { value: "failure", label: "ed.weather.haptic_failure" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.animations_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.fan.animations_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showAnimationSection ? this._editorLabel("ed.weather.hide_animation_settings") : this._editorLabel("ed.weather.show_animation_settings"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("ed.vacuum.enable_animations", "animations.enabled", config.animations.enabled !== false)}
                  ${this._renderCheckboxField("ed.vacuum.icon_animation_active", "animations.icon_animation", config.animations.icon_animation !== false)}
                  ${this._renderTextField("ed.light.anim_power_ms", "animations.power_duration", config.animations.power_duration, {
                    type: "number",
                    valueType: "number",
                    min: 120,
                    max: 4000,
                    step: 10,
                  })}
                  ${this._renderTextField("ed.light.anim_controls_ms", "animations.controls_duration", config.animations.controls_duration, {
                    type: "number",
                    valueType: "number",
                    min: 120,
                    max: 2400,
                    step: 10,
                  })}
                  ${this._renderTextField("ed.fan.anim_preset_ms", "animations.preset_duration", config.animations.preset_duration, {
                    type: "number",
                    valueType: "number",
                    min: 120,
                    max: 2400,
                    step: 10,
                  })}
                  ${this._renderTextField("ed.vacuum.button_bounce_ms", "animations.button_bounce_duration", config.animations.button_bounce_duration, {
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.vacuum.styles_section_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showStyleSection ? this._editorLabel("ed.weather.hide_style_settings") : this._editorLabel("ed.weather.show_style_settings"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("ed.entity.style_card_bg", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("ed.entity.style_card_border", "styles.card.border", config.styles.card.border)}
                  ${window.NodaliaUtils.renderEditorCardBorderRadiusHtml({
                    escapeHtml,
                    field: "styles.card.border_radius",
                    value: config.styles?.card?.border_radius,
                    tHeading: this._editorLabel("ed.entity.style_card_radius_presets"),
                    labels: {
                      pill: this._editorLabel("ed.entity.chip_radius_pill"),
                      soft: this._editorLabel("ed.entity.chip_radius_soft"),
                      round: this._editorLabel("ed.entity.chip_radius_round"),
                      square: this._editorLabel("ed.entity.chip_radius_square"),
                    },
                  })}
                  <div class="editor-section__hint editor-field--full" style="margin-top: -6px;">${escapeHtml(this._editorLabel("ed.entity.style_card_radius_yaml_hint"))}</div>
                  ${this._renderTextField("ed.entity.style_card_shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("ed.entity.style_card_padding", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("ed.entity.style_card_gap", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderTextField("ed.entity.style_main_button_size", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderColorField("ed.entity.style_icon_on", "styles.icon.on_color", config.styles.icon.on_color)}
                  ${this._renderColorField("ed.entity.style_icon_off", "styles.icon.off_color", config.styles.icon.off_color)}
                  ${this._renderTextField("ed.vacuum.style_button_size", "styles.control.size", config.styles.control.size)}
                  ${this._renderColorField("ed.entity.style_accent_bg", "styles.control.accent_background", config.styles.control.accent_background)}
                  ${this._renderColorField("ed.entity.style_accent_color", "styles.control.accent_color", config.styles.control.accent_color)}
                  ${this._renderTextField("ed.entity.style_chip_height", "styles.chip_height", config.styles.chip_height)}
                  ${this._renderTextField("ed.entity.style_chip_font", "styles.chip_font_size", config.styles.chip_font_size)}
                  ${this._renderTextField("ed.entity.style_chip_padding", "styles.chip_padding", config.styles.chip_padding)}
                  ${window.NodaliaUtils.renderEditorChipBorderRadiusHtml({
                    escapeHtml,
                    field: "styles.chip_border_radius",
                    value: config.styles?.chip_border_radius,
                    tHeading: this._editorLabel("ed.entity.style_chip_radius"),
                    labels: {
                      pill: this._editorLabel("ed.entity.chip_radius_pill"),
                      soft: this._editorLabel("ed.entity.chip_radius_soft"),
                      round: this._editorLabel("ed.entity.chip_radius_round"),
                      square: this._editorLabel("ed.entity.chip_radius_square"),
                    },
                  })}
                  ${this._renderTextField("ed.entity.style_title_size", "styles.title_size", config.styles.title_size)}
                  ${this._renderTextField("ed.light.slider_wrap_height", "styles.slider_wrap_height", config.styles.slider_wrap_height)}
                  ${this._renderTextField("ed.light.slider_height", "styles.slider_height", config.styles.slider_height)}
                  ${this._renderColorField("ed.light.slider_color", "styles.slider_color", config.styles.slider_color)}
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

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Fan Card",
  description: "Tarjeta de ventilador con slider de velocidad, oscilacion y modos.",
  preview: true,
});
