const CARD_TAG = "nodalia-alarm-panel-card";
const EDITOR_TAG = "nodalia-alarm-panel-card-editor";
const CARD_VERSION = "0.7.0";
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
const FEATURE_ARM_HOME = 1;
const FEATURE_ARM_AWAY = 2;
const FEATURE_ARM_NIGHT = 4;
const FEATURE_TRIGGER = 8;
const FEATURE_ARM_CUSTOM_BYPASS = 16;
const FEATURE_ARM_VACATION = 32;
const ALARM_STATE_TINT_FALLBACKS = Object.freeze({
  disarmed: "#82d18a",
  armed_home: "#74c0ff",
  armed_away: "#8aa7ff",
  armed_night: "#9488ff",
  armed_vacation: "#5fd7cf",
  armed_custom_bypass: "#64d4a6",
  armed: "#8aa7ff",
  arming: "#71c0ff",
  disarming: "#8de4ff",
  pending: "#f2c46d",
  triggered: "#ff7474",
});

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  code: "",
  code_entity: "",
  show_state: true,
  show_code_input: true,
  show_disarm: true,
  show_arm_home: true,
  show_arm_away: true,
  show_arm_night: true,
  show_arm_vacation: false,
  show_custom_bypass: false,
  compact_layout_mode: "auto",
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    content_duration: 420,
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
      on_color: "var(--primary-text-color)",
      off_color: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
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
    input_height: "42px",
  },
};

const STUB_CONFIG = {
  entity: "alarm_control_panel.casa",
  name: "Alarma",
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
    return "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))";
  }

  if (normalizedField.endsWith("on_color") || normalizedField.endsWith("accent_color") || normalizedField.endsWith("icon.color")) {
    return "var(--primary-text-color)";
  }

  if (normalizedField.endsWith("accent_background")) {
    return "rgba(113, 192, 255, 0.18)";
  }

  if (normalizedField.endsWith("icon.background")) {
    return "color-mix(in srgb, var(--primary-text-color) 6%, transparent)";
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

function normalizeConfig(rawConfig) {
  return mergeConfig(DEFAULT_CONFIG, rawConfig || {});
}

class NodaliaAlarmPanelCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["alarm_control_panel"]);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._cardWidth = 0;
    this._isCompactLayout = false;
    this._codeInput = "";
    this._isCodeInputFocused = false;
    this._pendingRenderWhileCodeFocused = false;
    this._countdownInterval = null;
    this._resizeObserver = null;
    this._lastRenderSignature = "";
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowFocusIn = this._onShadowFocusIn.bind(this);
    this._onShadowFocusOut = this._onShadowFocusOut.bind(this);
  }

  _captureCodeFocusState() {
    const activeElement = this.shadowRoot?.activeElement;
    if (!(activeElement instanceof HTMLInputElement) || activeElement.dataset?.alarmField !== "code") {
      return null;
    }

    const supportsSelection =
      typeof activeElement.selectionStart === "number" &&
      typeof activeElement.selectionEnd === "number";

    return {
      selectionEnd: supportsSelection ? activeElement.selectionEnd : null,
      selectionStart: supportsSelection ? activeElement.selectionStart : null,
      value: activeElement.value,
    };
  }

  _restoreCodeFocusState(focusState) {
    if (!focusState || !(this.shadowRoot instanceof ShadowRoot)) {
      return;
    }

    const target = this.shadowRoot.querySelector('input[data-alarm-field="code"]');
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (typeof focusState.value === "string" && target.value !== focusState.value) {
      target.value = focusState.value;
    }

    try {
      target.focus({ preventScroll: true });
    } catch (_error) {
      target.focus();
    }

    if (
      typeof focusState.selectionStart === "number" &&
      typeof focusState.selectionEnd === "number" &&
      typeof target.setSelectionRange === "function"
    ) {
      try {
        target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
      } catch (_error) {
        // Ignore unsupported input selection issues.
      }
    }
  }

  _renderWithFocusPreserved() {
    const focusState = this._captureCodeFocusState();
    this._render();
    this._restoreCodeFocusState(focusState);
  }

  _shouldDeferRenderForCodeInput() {
    if (!this._isCodeInputFocused) {
      return false;
    }

    const activeElement = this.shadowRoot?.activeElement;
    return activeElement instanceof HTMLInputElement && activeElement.dataset?.alarmField === "code";
  }

  _requestRender() {
    this._syncCountdownTimer();

    if (this._shouldDeferRenderForCodeInput()) {
      this._pendingRenderWhileCodeFocused = true;
      return;
    }

    this._pendingRenderWhileCodeFocused = false;
    this._renderWithFocusPreserved();
  }

  connectedCallback() {
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("focusin", this._onShadowFocusIn);
    this.shadowRoot.addEventListener("focusout", this._onShadowFocusOut);

    if (!this._resizeObserver) {
      this._resizeObserver = new ResizeObserver(entries => {
        const entry = entries[0];
        if (!entry) {
          return;
        }

        this._cardWidth = entry.contentRect.width;
        this._isCompactLayout = this._shouldUseCompactLayout(this._cardWidth);
        this._requestRender();
      });
    }

    this._resizeObserver.observe(this);
    this._syncCountdownTimer();
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
    this._requestRender();
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener("click", this._onShadowClick);
    this.shadowRoot.removeEventListener("input", this._onShadowInput);
    this.shadowRoot.removeEventListener("focusin", this._onShadowFocusIn);
    this.shadowRoot.removeEventListener("focusout", this._onShadowFocusOut);
    this._resizeObserver?.disconnect();
    this._clearCountdownTimer();
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
    this._syncCountdownTimer();
    this._requestRender();
  }

  set hass(hass) {
    const nextSignature = this._getRenderSignature(hass);
    this._hass = hass;
    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      this._syncCountdownTimer();
      return;
    }
    this._lastRenderSignature = nextSignature;
    this._syncCountdownTimer();
    this._requestRender();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 2,
      min_columns: 3,
    };
  }

  _shouldUseCompactLayout(width) {
    const mode = this._config?.compact_layout_mode || "auto";

    if (mode === "always") {
      return true;
    }

    if (mode === "never") {
      return false;
    }

    const configuredColumns = Number(this._config?.grid_options?.columns);
    if (Number.isFinite(configuredColumns)) {
      return configuredColumns < 4;
    }

    return width > 0 && width <= COMPACT_LAYOUT_THRESHOLD;
  }

  _getState() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const helperEntityId = this._config?.code_entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const helperState = helperEntityId ? hass?.states?.[helperEntityId] || null : null;
    const attrs = state?.attributes || {};
    return JSON.stringify({
      entityId,
      state: String(state?.state || ""),
      supportedFeatures: Number(attrs.supported_features ?? 0),
      codeFormat: String(attrs.code_format || ""),
      delay: Number(attrs.delay ?? -1),
      nextState: String(attrs.next_state || ""),
      postPendingState: String(attrs.post_pending_state || ""),
      postDelayState: String(attrs.post_delay_state || ""),
      helperEntityId,
      helperState: String(helperState?.state || ""),
      compact: Boolean(this._isCompactLayout),
    });
  }

  _getTitle(state) {
    if (this._config?.name) {
      return this._config.name;
    }
    if (state?.attributes?.friendly_name) {
      return state.attributes.friendly_name;
    }
    if (this._config?.entity) {
      return this._config.entity;
    }
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "es";
    return window.NodaliaI18n?.strings?.(lang)?.alarmPanel?.defaultTitle || "Alarma";
  }

  _getIcon() {
    return this._config?.icon || "mdi:shield-home";
  }

  _translateState(state) {
    const key = normalizeTextKey(state?.state);
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "es";
    const alarmStrings = window.NodaliaI18n?.strings?.(lang)?.alarmPanel;
    const translated = alarmStrings?.states?.[key];
    if (translated) {
      return translated;
    }

    switch (key) {
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
      case "armed":
        return "Armada";
      case "arming":
        return "Armando";
      case "disarming":
        return "Desarmando";
      case "pending":
        return "Pendiente";
      case "triggered":
        return "Disparada";
      case "unavailable":
        return "No disponible";
      case "unknown":
        return "Desconocida";
      default:
        return state?.state ? String(state.state) : (alarmStrings?.noState || "Sin estado");
    }
  }

  _getCountdownSecondsRemaining(state) {
    const status = normalizeTextKey(state?.state);
    if (!["arming", "pending"].includes(status)) {
      return null;
    }

    const delay = Number(state?.attributes?.delay);
    if (!Number.isFinite(delay) || delay <= 0) {
      return null;
    }

    const changedAt = Date.parse(state?.last_changed || "");
    if (!Number.isFinite(changedAt)) {
      return Math.ceil(delay);
    }

    const elapsedSeconds = Math.max(0, (Date.now() - changedAt) / 1000);
    return Math.max(0, Math.ceil(delay - elapsedSeconds));
  }

  _formatCountdownLabel(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return null;
    }

    const total = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(total / 60);
    const remainingSeconds = total % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  _clearCountdownTimer() {
    if (this._countdownInterval !== null) {
      window.clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
  }

  _syncCountdownTimer() {
    const state = this._getState();
    const remaining = this._getCountdownSecondsRemaining(state);

    if (!Number.isFinite(remaining)) {
      this._clearCountdownTimer();
      return;
    }

    if (this._countdownInterval !== null) {
      return;
    }

    this._countdownInterval = window.setInterval(() => {
      const nextState = this._getState();
      const nextRemaining = this._getCountdownSecondsRemaining(nextState);

      if (!Number.isFinite(nextRemaining)) {
        this._clearCountdownTimer();
      }

      this._requestRender();
    }, 1000);
  }

  _getAccentColor(state) {
    const key = normalizeTextKey(state?.state);
    const configuredTint = this._config?.styles?.state_tints?.[key];
    if (typeof configuredTint === "string" && configuredTint.trim()) {
      return configuredTint.trim();
    }

    return ALARM_STATE_TINT_FALLBACKS[key] || "var(--info-color, #71c0ff)";
  }

  _isActiveState(state) {
    const key = normalizeTextKey(state?.state);
    return !["", "disarmed", "unknown", "unavailable"].includes(key);
  }

  _getSupportedFeatures(state) {
    const value = Number(state?.attributes?.supported_features);
    return Number.isFinite(value) ? value : 0;
  }

  _supportsMode(state, mode) {
    const features = this._getSupportedFeatures(state);

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

  _getModeDefinitions(state) {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "es";
    const actionLabels = window.NodaliaI18n?.strings?.(lang)?.alarmPanel?.actions || {};
    const modes = [
      {
        key: "disarm",
        label: actionLabels.disarm || this._translateState({ state: "disarmed" }),
        icon: "mdi:shield-off-outline",
        service: "alarm_disarm",
        enabled: this._config?.show_disarm !== false && !this._matchesAlarmMode(state, "disarmed"),
        active: this._matchesAlarmMode(state, "disarmed"),
      },
      {
        key: "home",
        label: actionLabels.arm_home || this._translateState({ state: "armed_home" }),
        icon: "mdi:home-lock",
        service: "alarm_arm_home",
        enabled: this._config?.show_arm_home !== false
          && this._supportsMode(state, "home")
          && !this._matchesAlarmMode(state, "armed_home"),
        active: this._matchesAlarmMode(state, "armed_home"),
      },
      {
        key: "away",
        label: actionLabels.arm_away || this._translateState({ state: "armed_away" }),
        icon: "mdi:shield-lock",
        service: "alarm_arm_away",
        enabled: this._config?.show_arm_away !== false
          && this._supportsMode(state, "away")
          && !this._matchesAlarmMode(state, "armed_away"),
        active: this._matchesAlarmMode(state, "armed_away"),
      },
      {
        key: "night",
        label: actionLabels.arm_night || this._translateState({ state: "armed_night" }),
        icon: "mdi:weather-night",
        service: "alarm_arm_night",
        enabled: this._config?.show_arm_night !== false
          && this._supportsMode(state, "night")
          && !this._matchesAlarmMode(state, "armed_night"),
        active: this._matchesAlarmMode(state, "armed_night"),
      },
      {
        key: "vacation",
        label: actionLabels.arm_vacation || this._translateState({ state: "armed_vacation" }),
        icon: "mdi:palm-tree",
        service: "alarm_arm_vacation",
        enabled: this._config?.show_arm_vacation === true
          && this._supportsMode(state, "vacation")
          && !this._matchesAlarmMode(state, "armed_vacation"),
        active: this._matchesAlarmMode(state, "armed_vacation"),
      },
      {
        key: "custom_bypass",
        label: actionLabels.arm_custom_bypass || this._translateState({ state: "armed_custom_bypass" }),
        icon: "mdi:tune-variant",
        service: "alarm_arm_custom_bypass",
        enabled: this._config?.show_custom_bypass === true
          && this._supportsMode(state, "custom_bypass")
          && !this._matchesAlarmMode(state, "armed_custom_bypass"),
        active: this._matchesAlarmMode(state, "armed_custom_bypass"),
      },
    ];

    return modes.filter(mode => mode.enabled);
  }

  _getCodeValue(state) {
    if (this._shouldShowCodeInput(state)) {
      const manualCode = String(this._codeInput || "").trim();
      if (manualCode) {
        return manualCode;
      }
    }

    const helperEntityId = String(this._config?.code_entity || "").trim();

    if (helperEntityId) {
      const helperState = this._hass?.states?.[helperEntityId];
      const helperValue = String(helperState?.state || "").trim();
      if (helperValue && !["unknown", "unavailable"].includes(normalizeTextKey(helperValue))) {
        return helperValue;
      }
    }

    const configuredCode = String(this._config?.code || "").trim();
    if (configuredCode) {
      return configuredCode;
    }

    return "";
  }

  _shouldShowCodeInput(state) {
    if (this._config?.show_code_input === false) {
      return false;
    }

    const codeFormat = String(state?.attributes?.code_format || "").trim();
    return Boolean(codeFormat);
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

    if (haptics.fallback_vibrate && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      const pattern = HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection;
      navigator.vibrate(pattern);
    }
  }

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;

    return {
      enabled: configuredAnimations.enabled !== false,
      buttonBounceDuration: clamp(
        Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration,
        120,
        1200,
      ),
      contentDuration: clamp(
        Number(configuredAnimations.content_duration) || DEFAULT_CONFIG.animations.content_duration,
        140,
        1800,
      ),
    };
  }

  _triggerPressAnimation(element, className = "is-pressing") {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    const animations = this._getAnimationSettings();
    if (!animations.enabled) {
      return;
    }

    element.classList.remove(className);
    element.getBoundingClientRect();
    element.classList.add(className);

    window.setTimeout(() => {
      element.classList.remove(className);
    }, animations.buttonBounceDuration + 40);
  }

  _scheduleEntranceAnimationReset(delay) {
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }

    const safeDelay = clamp(Math.round(Number(delay) || 0), 0, 3000);
    if (!safeDelay || typeof window === "undefined") {
      this._animateContentOnNextRender = false;
      return;
    }

    this._entranceAnimationResetTimer = window.setTimeout(() => {
      this._entranceAnimationResetTimer = 0;
      this._animateContentOnNextRender = false;
    }, safeDelay);
  }

  _runAlarmAction(service) {
    const state = this._getState();
    if (!this._hass || !this._config?.entity || !service || !state) {
      return;
    }

    const payload = {
      entity_id: this._config.entity,
    };

    const code = this._getCodeValue(state);
    if (code) {
      payload.code = code;
    }

    this._triggerHaptic();
    this._hass.callService("alarm_control_panel", service, payload);
  }

  _openMoreInfo() {
    if (!this._config?.entity) {
      return;
    }

    fireEvent(this, "hass-more-info", {
      entityId: this._config.entity,
    });
  }

  _onShadowClick(event) {
    const button = event
      .composedPath()
      .find(node => node instanceof HTMLButtonElement && node.dataset?.alarmAction);

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const action = button.dataset.alarmAction;

    if (action === "more-info") {
      this._triggerHaptic();
      this._triggerPressAnimation(this.shadowRoot.querySelector(".alarm-card__content"));
      this._triggerPressAnimation(this.shadowRoot.querySelector(".alarm-card__icon"));
      this._openMoreInfo();
      return;
    }

    this._triggerPressAnimation(this.shadowRoot.querySelector(".alarm-card__content"));
    this._triggerPressAnimation(button);
    this._runAlarmAction(action);
  }

  _onShadowInput(event) {
    const input = event.composedPath().find(node => node instanceof HTMLInputElement && node.dataset?.alarmField === "code");
    if (!input) {
      return;
    }

    this._codeInput = input.value;
  }

  _onShadowFocusIn(event) {
    const input = event.composedPath().find(node => node instanceof HTMLInputElement && node.dataset?.alarmField === "code");
    if (!input) {
      return;
    }

    this._isCodeInputFocused = true;
  }

  _onShadowFocusOut(event) {
    const input = event.composedPath().find(node => node instanceof HTMLInputElement && node.dataset?.alarmField === "code");
    if (!input) {
      return;
    }

    window.setTimeout(() => {
      const activeElement = this.shadowRoot?.activeElement;
      const stillFocused = activeElement instanceof HTMLInputElement && activeElement.dataset?.alarmField === "code";

      this._isCodeInputFocused = stillFocused;

      if (!stillFocused && this._pendingRenderWhileCodeFocused) {
        this._pendingRenderWhileCodeFocused = false;
        this._renderWithFocusPreserved();
      }
    }, 0);
  }

  _renderChip(label, tone = "default", accentColor = "var(--accent-color)") {
    if (!label) {
      return "";
    }

    return `
      <div class="alarm-card__chip alarm-card__chip--${tone}" ${tone === "state" ? `style="--chip-accent:${escapeHtml(accentColor)};"` : ""}>
        ${escapeHtml(label)}
      </div>
    `;
  }

  _renderEmptyState() {
    return `
      <ha-card class="alarm-card alarm-card--empty">
        <div class="alarm-card__empty-title">Nodalia Alarm Panel Card</div>
        <div class="alarm-card__empty-text">Configura \`entity\` para mostrar la tarjeta.</div>
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
    const title = this._getTitle(state);
    const icon = this._getIcon();
    const accentColor = this._getAccentColor(state);
    const showUnavailableBadge = isUnavailableState(state);
    const isCompactLayout = this._isCompactLayout;
    const isActive = this._isActiveState(state);
    const stateLabel = config.show_state !== false ? this._translateState(state) : null;
    const countdownLabel = this._formatCountdownLabel(this._getCountdownSecondsRemaining(state));
    const chips = [
      this._renderChip(stateLabel, "state", accentColor),
      this._renderChip(countdownLabel, "countdown", accentColor),
    ].filter(Boolean);
    const actions = this._getModeDefinitions(state);
    const showCodeInput = this._shouldShowCodeInput(state);
    const cardBackground = isActive
      ? `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 7%, ${styles.card.background}) 56%, ${styles.card.background} 100%)`
      : styles.card.background;
    const cardBorder = isActive
      ? `1px solid color-mix(in srgb, ${accentColor} 24%, var(--divider-color))`
      : styles.card.border;
    const cardShadow = isActive
      ? `${styles.card.box_shadow}, 0 16px 32px color-mix(in srgb, ${accentColor} 10%, rgba(0, 0, 0, 0.18))`
      : styles.card.box_shadow;
    const titleSize = isCompactLayout
      ? `${Math.max(12, Math.min(parseSizeToPixels(styles.title_size, 14), 13))}px`
      : styles.title_size;
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --alarm-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --alarm-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
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

        ha-card::before {
          background: ${isActive
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 14%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)), rgba(255, 255, 255, 0))`
            : "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 4%, transparent), rgba(255, 255, 255, 0))"};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .alarm-card__content {
          display: grid;
          gap: ${styles.card.gap};
          min-width: 0;
          padding: ${styles.card.padding};
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease;
          will-change: transform;
          z-index: 1;
        }

        .alarm-card__content--entering {
          animation: alarm-card-fade-up calc(var(--alarm-card-content-duration) * 0.88) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .alarm-card__content.is-pressing {
          animation: alarm-card-content-bounce var(--alarm-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .alarm-card__hero {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: ${styles.icon.size} minmax(0, 1fr);
          min-width: 0;
        }

        .alarm-card__hero--entering {
          animation: alarm-card-fade-up calc(var(--alarm-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .alarm-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 24px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent),
            0 12px 30px rgba(0, 0, 0, 0.18);
          color: ${isActive ? styles.icon.on_color : styles.icon.off_color};
          cursor: pointer;
          display: inline-flex;
          height: ${styles.icon.size};
          justify-content: center;
          line-height: 0;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease, color 180ms ease;
          will-change: transform;
          width: ${styles.icon.size};
        }

        .alarm-card__icon--entering {
          animation: alarm-card-bubble-bloom calc(var(--alarm-card-content-duration) * 0.92) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 40ms;
        }

        .alarm-card__icon.is-pressing,
        .alarm-card__action.is-pressing {
          animation: alarm-card-bubble-bounce var(--alarm-card-button-bounce-duration) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
        }

        .alarm-card__icon ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.44);
          display: inline-flex;
          height: calc(${styles.icon.size} * 0.44);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${styles.icon.size} * 0.44);
        }

        .alarm-card__unavailable-badge {
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

        .alarm-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .alarm-card__copy {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .alarm-card__copy--entering {
          animation: alarm-card-fade-up calc(var(--alarm-card-content-duration) * 0.92) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 70ms;
        }

        .alarm-card__title {
          font-size: ${titleSize};
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.15;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .alarm-card__chips {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          min-width: 0;
        }

        .alarm-card__chip {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color: var(--secondary-text-color);
          display: inline-flex;
          flex: 0 0 auto;
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          height: max(24px, ${styles.chip_height});
          line-height: 1;
          max-width: 100%;
          min-width: 0;
          padding: ${styles.chip_padding};
          white-space: nowrap;
        }

        .alarm-card__chip--state {
          background: color-mix(in srgb, var(--chip-accent) 16%, color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border-color: color-mix(in srgb, var(--chip-accent) 40%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          color: color-mix(in srgb, var(--chip-accent) 72%, white);
        }

        .alarm-card__code {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          min-width: 0;
          padding: 0 14px;
        }

        .alarm-card__code--entering {
          animation: alarm-card-fade-up calc(var(--alarm-card-content-duration) * 0.94) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 95ms;
        }

        .alarm-card__code-input {
          appearance: none;
          background: transparent;
          border: 0;
          color: var(--primary-text-color);
          font: inherit;
          height: ${styles.input_height};
          letter-spacing: 0.18em;
          outline: none;
          width: 100%;
        }

        .alarm-card__code-input::placeholder {
          color: var(--secondary-text-color);
          letter-spacing: normal;
        }

        .alarm-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }

        .alarm-card__actions--entering {
          animation: alarm-card-fade-up calc(var(--alarm-card-content-duration) * 0.96) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 115ms;
        }

        .alarm-card__action {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          gap: 8px;
          height: max(${styles.control.size}, 40px);
          justify-content: center;
          line-height: 1;
          margin: 0;
          min-width: max(${styles.control.size}, 40px);
          outline: none;
          padding: 0 14px;
          position: relative;
        }

        .alarm-card__action--active {
          background: ${styles.control.accent_background};
          border-color: color-mix(in srgb, ${accentColor} 36%, color-mix(in srgb, var(--primary-text-color) 10%, transparent));
          color: ${styles.control.accent_color};
        }

        .alarm-card__action ha-icon {
          --mdc-icon-size: calc(${styles.control.size} * 0.46);
          display: inline-flex;
          height: calc(${styles.control.size} * 0.46);
          width: calc(${styles.control.size} * 0.46);
        }

        .alarm-card__action-label {
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }

        .alarm-card__empty-title {
          font-size: 15px;
          font-weight: 700;
        }

        .alarm-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }

        .alarm-card--empty {
          display: grid;
          gap: 8px;
          padding: 16px;
        }

        @keyframes alarm-card-fade-up {
          0% {
            opacity: 0;
            transform: translate3d(0, 18px, 0) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes alarm-card-bubble-bloom {
          0% {
            opacity: 0;
            transform: scale(0.78);
            filter: blur(8px);
          }
          60% {
            opacity: 1;
            transform: scale(1.04);
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0);
          }
        }

        @keyframes alarm-card-content-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(0.985);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes alarm-card-bubble-bounce {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(0.92);
          }
          100% {
            transform: scale(1);
          }
        }

        ${animations.enabled ? "" : `
          .alarm-card__content,
          .alarm-card__icon,
          .alarm-card__action {
            transition: none !important;
          }

          .alarm-card__content--entering,
          .alarm-card__hero--entering,
          .alarm-card__icon--entering,
          .alarm-card__copy--entering,
          .alarm-card__code--entering,
          .alarm-card__actions--entering,
          .alarm-card__content.is-pressing,
          .alarm-card__icon.is-pressing,
          .alarm-card__action.is-pressing {
            animation: none !important;
          }
        `}

        @media (max-width: 420px) {
          .alarm-card__hero {
            gap: 10px;
            grid-template-columns: min(${styles.icon.size}, 52px) minmax(0, 1fr);
          }

          .alarm-card__icon {
            height: min(${styles.icon.size}, 52px);
            width: min(${styles.icon.size}, 52px);
          }

          .alarm-card__actions {
            gap: 8px;
          }

          .alarm-card__action {
            padding: 0 12px;
          }

          .alarm-card__action-label {
            font-size: 12px;
          }
        }
      </style>
      <ha-card class="alarm-card ${isActive ? "is-on" : "is-off"}">
        <div class="alarm-card__content ${shouldAnimateEntrance ? "alarm-card__content--entering" : ""}">
          <div class="alarm-card__hero ${shouldAnimateEntrance ? "alarm-card__hero--entering" : ""}">
            <button
              type="button"
              class="alarm-card__icon ${shouldAnimateEntrance ? "alarm-card__icon--entering" : ""}"
              data-alarm-action="more-info"
              aria-label="${escapeHtml(title)}"
            >
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
              ${showUnavailableBadge ? `<span class="alarm-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            <div class="alarm-card__copy ${shouldAnimateEntrance ? "alarm-card__copy--entering" : ""}">
              ${isCompactLayout ? "" : `<div class="alarm-card__title">${escapeHtml(title)}</div>`}
              ${chips.length ? `<div class="alarm-card__chips">${chips.join("")}</div>` : ""}
            </div>
          </div>

          ${
            showCodeInput
              ? `
                <label class="alarm-card__code ${shouldAnimateEntrance ? "alarm-card__code--entering" : ""}">
                  <input
                    class="alarm-card__code-input"
                    type="password"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    placeholder="Codigo"
                    data-alarm-field="code"
                    value="${escapeHtml(this._codeInput)}"
                  />
                </label>
              `
              : ""
          }

          ${
            actions.length
              ? `
                <div class="alarm-card__actions ${shouldAnimateEntrance ? "alarm-card__actions--entering" : ""}">
                  ${actions.map(action => `
                    <button
                      type="button"
                      class="alarm-card__action ${action.active ? "alarm-card__action--active" : ""}"
                      data-alarm-action="${escapeHtml(action.service)}"
                      aria-label="${escapeHtml(action.label)}"
                    >
                      <ha-icon icon="${escapeHtml(action.icon)}"></ha-icon>
                      ${isCompactLayout ? "" : `<span class="alarm-card__action-label">${escapeHtml(action.label)}</span>`}
                    </button>
                  `).join("")}
                </div>
              `
              : ""
          }
        </div>
      </ha-card>
    `;

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 120);
    }
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaAlarmPanelCard);
}

class NodaliaAlarmPanelCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showAnimationSection = false;
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

  disconnectedCallback() {
    this.shadowRoot.removeEventListener("input", this._onShadowInput);
    this.shadowRoot.removeEventListener("change", this._onShadowInput);
    this.shadowRoot.removeEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.removeEventListener("click", this._onShadowClick);
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
      .filter(([entityId]) => entityId.startsWith("alarm_control_panel.") || entityId.startsWith("input_text."))
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

  _getDomainEntityOptions(domains = [], path = "entity") {
    const normalizedDomains = Array.isArray(domains)
      ? domains.filter(Boolean)
      : String(domains || "").split(",").map(domain => domain.trim()).filter(Boolean);

    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => normalizedDomains.some(domain => entityId.startsWith(`${domain}.`)))
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

    if (!toggleButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const focusState = this._captureFocusState();

    if (toggleButton.dataset.editorToggle === "styles") {
      this._showStyleSection = !this._showStyleSection;
    } else if (toggleButton.dataset.editorToggle === "animations") {
      this._showAnimationSection = !this._showAnimationSection;
    }

    this._render();
    this._restoreFocusState(focusState);
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
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";

    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          type="${escapeHtml(options.type || "text")}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(valueType)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        />
      </label>
    `;
  }

  _renderColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("Color personalizado");
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

  _renderSelectField(label, field, value, options, renderOptions = {}) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field ${renderOptions.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options.map(option => `
            <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
              ${escapeHtml(this._editorLabel(option.label))}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  _renderEntityPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder || "";
    const domains = Array.isArray(options.domains)
      ? options.domains.join(",")
      : String(options.domains || "");

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-domains="${escapeHtml(domains)}"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(placeholder)}"
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

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    const domains = String(host.dataset.domains || "")
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.includeDomains = domains;
      control.allowCustomEntity = true;
      control.entityFilter = stateObj => domains.some(domain => String(stateObj?.entity_id || "").startsWith(`${domain}.`));
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: domains.length === 1
          ? { domain: domains[0] }
          : {},
      };
    } else {
      control = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder || this._editorLabel("Selecciona una entidad");
      control.appendChild(emptyOption);
      this._getDomainEntityOptions(domains, field).forEach(option => {
        const optionElement = document.createElement("option");
        optionElement.value = option.value;
        optionElement.textContent = option.displayLabel;
        control.appendChild(optionElement);
      });
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;

    if ("hass" in control) {
      control.hass = this._hass;
    }

    if ("value" in control) {
      control.value = nextValue;
    }

    host.replaceChildren(control);
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";
    const animations = config.animations || DEFAULT_CONFIG.animations;

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
        }

        .editor-field--full {
          grid-column: 1 / -1;
        }

        .editor-field span,
        .editor-toggle span {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 600;
        }

        .editor-field input,
        .editor-field select {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 14px;
          color: var(--primary-text-color);
          font: inherit;
          min-width: 0;
          outline: none;
          padding: 10px 12px;
          width: 100%;
        }

        .editor-color-field {
          align-items: center;
          display: flex;
          gap: 10px;
          min-height: 46px;
        }

        .editor-color-picker {
          align-items: center;
          appearance: none;
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
          height: 22px;
          width: 22px;
        }

        .editor-toggle {
          align-items: center;
          grid-template-columns: auto 1fr;
          padding-top: 20px;
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

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }

        @media (max-width: 720px) {
          .editor-grid {
            grid-template-columns: 1fr;
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("General"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Entidad principal, helper opcional del codigo, icono y comportamiento base de la tarjeta."))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityPickerField("Entidad principal", "entity", config.entity, {
              domains: ["alarm_control_panel"],
              placeholder: "alarm_control_panel.casa",
              fullWidth: true,
            })}
            ${this._renderIconPickerField("Icono", "icon", config.icon, {
              placeholder: "mdi:shield-home",
              fullWidth: true,
            })}
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Alarma",
              fullWidth: true,
            })}
            ${this._renderTextField("PIN fijo", "code", config.code, {
              placeholder: "1234",
            })}
            ${this._renderEntityPickerField("Helper codigo", "code_entity", config.code_entity, {
              domains: ["input_text"],
              placeholder: "input_text.codigo_alarma",
              fullWidth: true,
            })}
            ${this._renderSelectField(
              "Layout estrecho",
              "compact_layout_mode",
              config.compact_layout_mode || "auto",
              [
                { value: "auto", label: "Automatico (<4 columnas)" },
                { value: "always", label: "Compacto siempre" },
                { value: "never", label: "Nunca compactar" },
              ],
              { fullWidth: true },
            )}
            ${this._renderCheckboxField("Mostrar estado en burbuja", "show_state", config.show_state !== false)}
            ${this._renderCheckboxField("Mostrar cuadro de texto del PIN", "show_code_input", config.show_code_input !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Modos"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Botones de armado y desarmado visibles en la tarjeta."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Mostrar desarmar", "show_disarm", config.show_disarm !== false)}
            ${this._renderCheckboxField("Mostrar en casa", "show_arm_home", config.show_arm_home !== false)}
            ${this._renderCheckboxField("Mostrar ausente", "show_arm_away", config.show_arm_away !== false)}
            ${this._renderCheckboxField("Mostrar noche", "show_arm_night", config.show_arm_night !== false)}
            ${this._renderCheckboxField("Mostrar vacaciones", "show_arm_vacation", config.show_arm_vacation === true)}
            ${this._renderCheckboxField("Mostrar personalizado", "show_custom_bypass", config.show_custom_bypass === true)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Animaciones"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Entrada suave del contenido y pequeno rebote al pulsar acciones e icono."))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showAnimationSection ? this._editorLabel("Ocultar ajustes de animación") : this._editorLabel("Mostrar ajustes de animación"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("Activar animaciones", "animations.enabled", animations.enabled !== false)}
                  ${this._renderTextField("Entrada contenido (ms)", "animations.content_duration", animations.content_duration, {
                    type: "number",
                  })}
                  ${this._renderTextField("Rebote pulsacion (ms)", "animations.button_bounce_duration", animations.button_bounce_duration, {
                    type: "number",
                  })}
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Respuesta haptica"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Respuesta tactil opcional al pulsar acciones."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Activar haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("Fallback con vibracion", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "Estilo haptico",
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Estilos"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Ajustes visuales base de la tarjeta."))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showStyleSection ? this._editorLabel("Ocultar ajustes de estilo") : this._editorLabel("Mostrar ajustes de estilo"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("Fondo tarjeta", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("Borde tarjeta", "styles.card.border", config.styles.card.border)}
                  ${this._renderTextField("Radio borde", "styles.card.border_radius", config.styles.card.border_radius)}
                  ${this._renderTextField("Sombra", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("Padding interior", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("Separacion interna", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderTextField("Tamano icono", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderColorField("Fondo burbuja icono", "styles.icon.background", config.styles.icon.background, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
                  })}
                  ${this._renderColorField("Color icono activo", "styles.icon.on_color", config.styles.icon.on_color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderColorField("Color icono inactivo", "styles.icon.off_color", config.styles.icon.off_color, {
                    fallbackValue: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
                  })}
                  ${this._renderTextField("Tamano botones", "styles.control.size", config.styles.control.size)}
                  ${this._renderColorField("Fondo acento", "styles.control.accent_background", config.styles.control.accent_background, {
                    fallbackValue: "rgba(113, 192, 255, 0.18)",
                  })}
                  ${this._renderColorField("Color acento", "styles.control.accent_color", config.styles.control.accent_color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderColorField("Tinte desarmada", "styles.state_tints.disarmed", config.styles.state_tints?.disarmed, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.disarmed,
                  })}
                  ${this._renderColorField("Tinte en casa", "styles.state_tints.armed_home", config.styles.state_tints?.armed_home, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.armed_home,
                  })}
                  ${this._renderColorField("Tinte ausente", "styles.state_tints.armed_away", config.styles.state_tints?.armed_away, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.armed_away,
                  })}
                  ${this._renderColorField("Tinte noche", "styles.state_tints.armed_night", config.styles.state_tints?.armed_night, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.armed_night,
                  })}
                  ${this._renderColorField("Tinte vacaciones", "styles.state_tints.armed_vacation", config.styles.state_tints?.armed_vacation, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.armed_vacation,
                  })}
                  ${this._renderColorField("Tinte personalizado", "styles.state_tints.armed_custom_bypass", config.styles.state_tints?.armed_custom_bypass, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.armed_custom_bypass,
                  })}
                  ${this._renderColorField("Tinte armando", "styles.state_tints.arming", config.styles.state_tints?.arming, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.arming,
                  })}
                  ${this._renderColorField("Tinte pendiente", "styles.state_tints.pending", config.styles.state_tints?.pending, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.pending,
                  })}
                  ${this._renderColorField("Tinte disparada", "styles.state_tints.triggered", config.styles.state_tints?.triggered, {
                    fallbackValue: ALARM_STATE_TINT_FALLBACKS.triggered,
                  })}
                  ${this._renderTextField("Alto chips", "styles.chip_height", config.styles.chip_height)}
                  ${this._renderTextField("Texto chips", "styles.chip_font_size", config.styles.chip_font_size)}
                  ${this._renderTextField("Padding chips", "styles.chip_padding", config.styles.chip_padding)}
                  ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
                  ${this._renderTextField("Alto input codigo", "styles.input_height", config.styles.input_height)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('.editor-control-host[data-mounted-control="entity"]')
      .forEach(host => this._mountEntityPicker(host));

    this._ensureEditorControlsReady();
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaAlarmPanelCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Alarm Panel Card",
  description: "Tarjeta elegante para paneles de alarma",
  preview: true,
});
