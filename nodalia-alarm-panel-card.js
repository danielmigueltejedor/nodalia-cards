const CARD_TAG = "nodalia-alarm-panel-card";
const EDITOR_TAG = "nodalia-alarm-panel-card-editor";
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
const FEATURE_ARM_HOME = 1;
const FEATURE_ARM_AWAY = 2;
const FEATURE_ARM_NIGHT = 4;
const FEATURE_TRIGGER = 8;
const FEATURE_ARM_CUSTOM_BYPASS = 16;
const FEATURE_ARM_VACATION = 32;

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
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
      on_color: "var(--primary-text-color)",
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

function normalizeConfig(rawConfig) {
  return mergeConfig(DEFAULT_CONFIG, rawConfig || {});
}

class NodaliaAlarmPanelCard extends HTMLElement {
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
    this._cardWidth = 0;
    this._isCompactLayout = false;
    this._codeInput = "";
    this._isCodeInputFocused = false;
    this._pendingRenderWhileCodeFocused = false;
    this._countdownInterval = null;
    this._resizeObserver = null;
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
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener("click", this._onShadowClick);
    this.shadowRoot.removeEventListener("input", this._onShadowInput);
    this.shadowRoot.removeEventListener("focusin", this._onShadowFocusIn);
    this.shadowRoot.removeEventListener("focusout", this._onShadowFocusOut);
    this._resizeObserver?.disconnect();
    this._clearCountdownTimer();
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._syncCountdownTimer();
    this._requestRender();
  }

  set hass(hass) {
    this._hass = hass;
    this._syncCountdownTimer();
    this._requestRender();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: 6,
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

  _getTitle(state) {
    return this._config?.name || state?.attributes?.friendly_name || this._config?.entity || "Alarma";
  }

  _getIcon() {
    return this._config?.icon || "mdi:shield-home";
  }

  _translateState(state) {
    const key = normalizeTextKey(state?.state);

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
        return state?.state ? String(state.state) : "Sin estado";
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

    switch (key) {
      case "disarmed":
        return "#82d18a";
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
      case "disarming":
        return "#8de4ff";
      case "pending":
        return "#f2c46d";
      case "triggered":
        return "#ff7474";
      default:
        return "var(--info-color, #71c0ff)";
    }
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

  _getModeDefinitions(state) {
    const modes = [
      {
        key: "disarm",
        label: "Desarmar",
        icon: "mdi:shield-off-outline",
        service: "alarm_disarm",
        enabled: this._config?.show_disarm !== false && normalizeTextKey(state?.state) !== "disarmed",
        active: normalizeTextKey(state?.state) === "disarmed",
      },
      {
        key: "home",
        label: "Casa",
        icon: "mdi:home-lock",
        service: "alarm_arm_home",
        enabled: this._config?.show_arm_home !== false
          && this._supportsMode(state, "home")
          && normalizeTextKey(state?.state) !== "armed_home",
        active: normalizeTextKey(state?.state) === "armed_home",
      },
      {
        key: "away",
        label: "Ausente",
        icon: "mdi:shield-lock",
        service: "alarm_arm_away",
        enabled: this._config?.show_arm_away !== false
          && this._supportsMode(state, "away")
          && normalizeTextKey(state?.state) !== "armed_away",
        active: normalizeTextKey(state?.state) === "armed_away",
      },
      {
        key: "night",
        label: "Noche",
        icon: "mdi:weather-night",
        service: "alarm_arm_night",
        enabled: this._config?.show_arm_night !== false
          && this._supportsMode(state, "night")
          && normalizeTextKey(state?.state) !== "armed_night",
        active: normalizeTextKey(state?.state) === "armed_night",
      },
      {
        key: "vacation",
        label: "Vacaciones",
        icon: "mdi:palm-tree",
        service: "alarm_arm_vacation",
        enabled: this._config?.show_arm_vacation === true
          && this._supportsMode(state, "vacation")
          && normalizeTextKey(state?.state) !== "armed_vacation",
        active: normalizeTextKey(state?.state) === "armed_vacation",
      },
      {
        key: "custom_bypass",
        label: "Personalizado",
        icon: "mdi:tune-variant",
        service: "alarm_arm_custom_bypass",
        enabled: this._config?.show_custom_bypass === true
          && this._supportsMode(state, "custom_bypass")
          && normalizeTextKey(state?.state) !== "armed_custom_bypass",
        active: normalizeTextKey(state?.state) === "armed_custom_bypass",
      },
    ];

    return modes.filter(mode => mode.enabled);
  }

  _getCodeValue(state) {
    const helperEntityId = String(this._config?.code_entity || "").trim();

    if (helperEntityId) {
      const helperState = this._hass?.states?.[helperEntityId];
      const helperValue = String(helperState?.state || "").trim();
      if (helperValue && !["unknown", "unavailable"].includes(normalizeTextKey(helperValue))) {
        return helperValue;
      }
    }

    if (this._shouldShowCodeInput(state)) {
      return String(this._codeInput || "").trim();
    }

    return "";
  }

  _shouldShowCodeInput(state) {
    if (this._config?.show_code_input === false) {
      return false;
    }

    if (this._config?.code_entity) {
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

    const style = styleOverride || haptics.style || "selection";
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
      this._openMoreInfo();
      return;
    }

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

        .alarm-card__content {
          display: grid;
          gap: ${styles.card.gap};
          min-width: 0;
          padding: ${styles.card.padding};
          position: relative;
          z-index: 1;
        }

        .alarm-card__hero {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: ${styles.icon.size} minmax(0, 1fr);
          min-width: 0;
        }

        .alarm-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${styles.icon.background};
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
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
          width: ${styles.icon.size};
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

        .alarm-card__copy {
          display: grid;
          gap: 8px;
          min-width: 0;
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
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
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
          background: color-mix(in srgb, var(--chip-accent) 16%, rgba(255, 255, 255, 0.04));
          border-color: color-mix(in srgb, var(--chip-accent) 40%, rgba(255, 255, 255, 0.08));
          color: color-mix(in srgb, var(--chip-accent) 72%, white);
        }

        .alarm-card__code {
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          min-width: 0;
          padding: 0 14px;
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

        .alarm-card__action {
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
          border-color: color-mix(in srgb, ${accentColor} 36%, rgba(255, 255, 255, 0.1));
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
        <div class="alarm-card__content">
          <div class="alarm-card__hero">
            <button
              type="button"
              class="alarm-card__icon"
              data-alarm-action="more-info"
              aria-label="${escapeHtml(title)}"
            >
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
            </button>
            <div class="alarm-card__copy">
              ${isCompactLayout ? "" : `<div class="alarm-card__title">${escapeHtml(title)}</div>`}
              ${chips.length ? `<div class="alarm-card__chips">${chips.join("")}</div>` : ""}
            </div>
          </div>

          ${
            showCodeInput
              ? `
                <label class="alarm-card__code">
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
                <div class="alarm-card__actions">
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

    if (shouldRender) {
      this._render();
    }
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._render();
  }

  _getEntityOptionsSignature(hass) {
    if (!hass?.states) {
      return "";
    }

    return Object.keys(hass.states)
      .filter(entityId => entityId.startsWith("alarm_control_panel.") || entityId.startsWith("input_text."))
      .sort((left, right) => left.localeCompare(right, "es"))
      .join("|");
  }

  _emitConfig() {
    const nextConfig = deepClone(this._config);
    this._config = normalizeConfig(compactConfig(nextConfig));
    this._render();
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
    const alarmIds = Object.keys(this._hass?.states || {})
      .filter(entityId => entityId.startsWith("alarm_control_panel."))
      .sort((left, right) => left.localeCompare(right, "es"));
    const helperIds = Object.keys(this._hass?.states || {})
      .filter(entityId => entityId.startsWith("input_text."))
      .sort((left, right) => left.localeCompare(right, "es"));

    return `
      <datalist id="alarm-card-entities">
        ${alarmIds.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
      <datalist id="alarm-card-code-entities">
        ${helperIds.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
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
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          color: var(--primary-text-color);
          font: inherit;
          min-width: 0;
          outline: none;
          padding: 10px 12px;
          width: 100%;
        }

        .editor-toggle {
          align-items: center;
          grid-auto-flow: column;
          justify-content: start;
        }

        .editor-toggle input {
          accent-color: var(--primary-color);
        }

        @media (max-width: 720px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">General</div>
            <div class="editor-section__hint">Entidad principal, helper opcional de codigo y apariencia base.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Entidad", "entity", config.entity, {
              placeholder: "alarm_control_panel.casa",
            })}
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Alarma",
            })}
            ${this._renderTextField("Icono", "icon", config.icon, {
              placeholder: "mdi:shield-home",
            })}
            ${this._renderTextField("Helper codigo", "code_entity", config.code_entity, {
              placeholder: "input_text.codigo_alarma",
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
            )}
            ${this._renderCheckboxField("Mostrar estado en burbuja", "show_state", config.show_state !== false)}
            ${this._renderCheckboxField("Mostrar input de codigo", "show_code_input", config.show_code_input !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Modos</div>
            <div class="editor-section__hint">Botones de armado y desarmado visibles en la tarjeta.</div>
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
            <div class="editor-section__title">Haptics</div>
            <div class="editor-section__hint">Respuesta haptica al pulsar acciones.</div>
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
            <div class="editor-section__title">Estilos</div>
            <div class="editor-section__hint">Ajustes visuales base de la tarjeta.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Background", "styles.card.background", config.styles.card.background)}
            ${this._renderTextField("Border", "styles.card.border", config.styles.card.border)}
            ${this._renderTextField("Radius", "styles.card.border_radius", config.styles.card.border_radius)}
            ${this._renderTextField("Shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
            ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
            ${this._renderTextField("Separacion", "styles.card.gap", config.styles.card.gap)}
            ${this._renderTextField("Tamano boton principal", "styles.icon.size", config.styles.icon.size)}
            ${this._renderTextField("Color icono activo", "styles.icon.on_color", config.styles.icon.on_color)}
            ${this._renderTextField("Color icono inactivo", "styles.icon.off_color", config.styles.icon.off_color)}
            ${this._renderTextField("Tamano boton", "styles.control.size", config.styles.control.size)}
            ${this._renderTextField("Fondo acento", "styles.control.accent_background", config.styles.control.accent_background)}
            ${this._renderTextField("Color acento", "styles.control.accent_color", config.styles.control.accent_color)}
            ${this._renderTextField("Alto burbuja info", "styles.chip_height", config.styles.chip_height)}
            ${this._renderTextField("Texto burbuja info", "styles.chip_font_size", config.styles.chip_font_size)}
            ${this._renderTextField("Padding burbuja info", "styles.chip_padding", config.styles.chip_padding)}
            ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
            ${this._renderTextField("Alto input codigo", "styles.input_height", config.styles.input_height)}
          </div>
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot.querySelectorAll('input[data-field="entity"]').forEach(input => {
      input.setAttribute("list", "alarm-card-entities");
    });
    this.shadowRoot.querySelectorAll('input[data-field="code_entity"]').forEach(input => {
      input.setAttribute("list", "alarm-card-code-entities");
    });
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
