const CARD_TAG = "nodalia-vacuum-card";
const EDITOR_TAG = "nodalia-vacuum-card-editor";
const CARD_VERSION = "0.1.0";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
const COMPACT_LAYOUT_THRESHOLD = 190;

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  compact_layout_mode: "auto",
  show_state_chip: true,
  show_battery_chip: true,
  show_fan_speed_chip: true,
  show_fan_presets: true,
  show_return_to_base: true,
  show_stop: true,
  show_locate: true,
  fan_presets: [],
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
      active_color: "var(--info-color, #6ec7ff)",
      returning_color: "#f6b73c",
      error_color: "var(--error-color, #ff6b6b)",
      docked_color: "var(--state-inactive-color, rgba(255, 255, 255, 0.55))",
    },
    control: {
      size: "40px",
      accent_color: "var(--primary-text-color)",
      accent_background: "rgba(var(--rgb-primary-color), 0.18)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    title_size: "15px",
  },
};

const STUB_CONFIG = {
  entity: "vacuum.salon",
  name: "Robot salon",
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
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});

  if (!Array.isArray(config.fan_presets)) {
    config.fan_presets = [];
  }

  config.fan_presets = config.fan_presets
    .map(item => String(item || "").trim())
    .filter(Boolean);

  return config;
}

class NodaliaVacuumCard extends HTMLElement {
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
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
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
      Math.round(iconSize + (cardPadding * 2) + (cardGap * 2) + 48),
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

  _getVacuumName(state) {
    if (this._config?.name) {
      return this._config.name;
    }

    if (state?.attributes?.friendly_name) {
      return state.attributes.friendly_name;
    }

    return this._config?.entity || "Vacuum";
  }

  _getVacuumIcon(state) {
    if (this._config?.icon) {
      return this._config.icon;
    }

    if (state?.attributes?.icon) {
      return state.attributes.icon;
    }

    switch (state?.state) {
      case "cleaning":
        return "mdi:robot-vacuum";
      case "returning":
        return "mdi:home-map-marker";
      case "paused":
        return "mdi:pause-circle-outline";
      case "error":
        return "mdi:alert-circle-outline";
      default:
        return "mdi:robot-vacuum";
    }
  }

  _getStateLabel(state) {
    switch (state?.state) {
      case "cleaning":
        return "Limpiando";
      case "paused":
        return "Pausado";
      case "returning":
        return "Volviendo";
      case "docked":
        return "En base";
      case "idle":
        return "En espera";
      case "error":
        return "Error";
      case "unavailable":
        return "No disponible";
      case "unknown":
        return "Desconocido";
      default:
        return state?.state ? String(state.state) : "Sin estado";
    }
  }

  _getBatteryLevel(state) {
    const value = Number(state?.attributes?.battery_level);
    return Number.isFinite(value) ? clamp(Math.round(value), 0, 100) : null;
  }

  _getCurrentFanSpeed(state) {
    const current = state?.attributes?.fan_speed;
    return current ? String(current) : "";
  }

  _getFanPresets(state) {
    const configuredPresets = Array.isArray(this._config?.fan_presets) ? this._config.fan_presets : [];
    if (configuredPresets.length) {
      return configuredPresets;
    }

    if (Array.isArray(state?.attributes?.fan_speed_list)) {
      return state.attributes.fan_speed_list
        .map(item => String(item || "").trim())
        .filter(Boolean);
    }

    return [];
  }

  _isCleaning(state) {
    return ["cleaning", "spot_cleaning"].includes(state?.state);
  }

  _isPaused(state) {
    return state?.state === "paused";
  }

  _isReturning(state) {
    return state?.state === "returning";
  }

  _isDocked(state) {
    return state?.state === "docked";
  }

  _isActive(state) {
    return this._isCleaning(state) || this._isPaused(state) || this._isReturning(state);
  }

  _getAccentColor(state) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;

    if (state?.state === "error") {
      return styles.icon.error_color;
    }

    if (this._isReturning(state)) {
      return styles.icon.returning_color;
    }

    if (this._isCleaning(state) || this._isPaused(state)) {
      return styles.icon.active_color;
    }

    return styles.icon.docked_color;
  }

  _callService(service, data = {}) {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    this._hass.callService("vacuum", service, {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _runPrimaryAction(state) {
    if (this._isCleaning(state)) {
      this._callService("pause");
      return;
    }

    this._callService("start");
  }

  _getControls(state) {
    const controls = [];

    controls.push({
      action: this._isCleaning(state) ? "pause" : "start",
      icon: this._isCleaning(state) ? "mdi:pause" : "mdi:play",
      label: this._isCleaning(state) ? "Pausar" : "Iniciar",
      active: true,
    });

    if (this._config?.show_return_to_base !== false && !this._isDocked(state) && state?.state !== "unavailable") {
      controls.push({
        action: "return_to_base",
        icon: "mdi:home-map-marker",
        label: "Base",
        active: this._isReturning(state),
      });
    }

    if (this._config?.show_stop !== false && (this._isCleaning(state) || this._isPaused(state) || this._isReturning(state))) {
      controls.push({
        action: "stop",
        icon: "mdi:stop",
        label: "Parar",
        active: false,
      });
    }

    if (this._config?.show_locate !== false && state?.state !== "unavailable") {
      controls.push({
        action: "locate",
        icon: "mdi:radar",
        label: "Buscar",
        active: false,
      });
    }

    return controls.slice(0, 4);
  }

  _renderEmptyState() {
    return `
      <ha-card class="vacuum-card vacuum-card--empty">
        <div class="vacuum-card__empty-title">Nodalia Vacuum Card</div>
        <div class="vacuum-card__empty-text">Configura \`entity\` con una entidad \`vacuum.*\` para mostrar la tarjeta.</div>
      </ha-card>
    `;
  }

  _onShadowClick(event) {
    const button = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.vacuumAction);

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();

    const state = this._getState();

    switch (button.dataset.vacuumAction) {
      case "primary":
        this._runPrimaryAction(state);
        break;
      case "start":
        this._callService("start");
        break;
      case "pause":
        this._callService("pause");
        break;
      case "stop":
        this._callService("stop");
        break;
      case "return_to_base":
        this._callService("return_to_base");
        break;
      case "locate":
        this._callService("locate");
        break;
      case "fan":
        if (button.dataset.value) {
          this._callService("set_fan_speed", {
            fan_speed: button.dataset.value,
          });
        }
        break;
      default:
        break;
    }
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    if (!this._config) {
      this.shadowRoot.innerHTML = "";
      return;
    }

    const config = this._config;
    const styles = config.styles;
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

          .vacuum-card--empty {
            background: ${styles.card.background};
            border: ${styles.card.border};
            border-radius: ${styles.card.border_radius};
            box-shadow: ${styles.card.box_shadow};
            display: grid;
            gap: 6px;
            padding: ${styles.card.padding};
          }

          .vacuum-card__empty-title {
            color: var(--primary-text-color);
            font-size: 15px;
            font-weight: 700;
          }

          .vacuum-card__empty-text {
            color: var(--secondary-text-color);
            font-size: 13px;
            line-height: 1.5;
          }
        </style>
        ${this._renderEmptyState()}
      `;
      return;
    }

    const title = this._getVacuumName(state);
    const icon = this._getVacuumIcon(state);
    const stateLabel = this._getStateLabel(state);
    const batteryLevel = this._getBatteryLevel(state);
    const fanSpeed = this._getCurrentFanSpeed(state);
    const fanPresets = config.show_fan_presets !== false ? this._getFanPresets(state) : [];
    const isCompactLayout = this._isCompactLayout;
    const accentColor = this._getAccentColor(state);
    const controls = this._getControls(state);
    const isActive = this._isActive(state);
    const chips = [];
    const cardBackground = isActive
      ? `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 52%, ${styles.card.background} 100%)`
      : styles.card.background;
    const cardBorder = isActive
      ? `color-mix(in srgb, ${accentColor} 34%, var(--divider-color))`
      : styles.card.border;
    const cardShadow = isActive
      ? `0 16px 32px color-mix(in srgb, ${accentColor} 18%, rgba(0, 0, 0, 0.18))`
      : styles.card.box_shadow;

    if (config.show_state_chip !== false) {
      chips.push(`<span class="vacuum-card__chip vacuum-card__chip--state">${escapeHtml(stateLabel)}</span>`);
    }

    if (config.show_battery_chip !== false && batteryLevel !== null) {
      chips.push(`<span class="vacuum-card__chip">${batteryLevel}%</span>`);
    }

    if (config.show_fan_speed_chip !== false && fanSpeed) {
      chips.push(`<span class="vacuum-card__chip">${escapeHtml(fanSpeed)}</span>`);
    }

    const showCopyBlock = !isCompactLayout || chips.length > 0;
    const iconButtonLabel = this._isCleaning(state) ? "Pausar limpieza" : "Iniciar limpieza";

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
          display: grid;
          gap: ${styles.card.gap};
          min-width: 0;
          overflow: hidden;
          padding: ${styles.card.padding};
          position: relative;
        }

        .vacuum-card {
          color: var(--primary-text-color);
          display: grid;
          gap: ${styles.card.gap};
          min-width: 0;
        }

        .vacuum-card__header {
          align-items: center;
          display: grid;
          gap: ${styles.card.gap};
          grid-template-columns: auto minmax(0, 1fr);
          min-width: 0;
        }

        .vacuum-card--compact .vacuum-card__header {
          grid-template-columns: 1fr;
          justify-items: center;
          text-align: center;
        }

        .vacuum-card--compact .vacuum-card__copy {
          justify-items: center;
        }

        .vacuum-card--compact .vacuum-card__chips {
          justify-content: center;
        }

        .vacuum-card__icon-button {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, ${accentColor} 16%, ${styles.icon.background});
          border: 1px solid color-mix(in srgb, ${accentColor} 22%, rgba(255, 255, 255, 0.08));
          border-radius: 999px;
          color: ${isActive ? accentColor : styles.icon.color};
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

        .vacuum-card__icon-button ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.46);
          display: inline-flex;
          height: calc(${styles.icon.size} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${styles.icon.size} * 0.46);
        }

        .vacuum-card__copy {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .vacuum-card__title {
          font-size: ${styles.title_size};
          font-weight: 700;
          letter-spacing: -0.01em;
          line-height: 1.15;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .vacuum-card__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          min-width: 0;
        }

        .vacuum-card__chip {
          align-items: center;
          backdrop-filter: blur(18px);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
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

        .vacuum-card__chip--state {
          color: var(--primary-text-color);
        }

        .vacuum-card__controls {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(${Math.max(controls.length, 1)}, minmax(0, 1fr));
        }

        .vacuum-card__control {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: ${styles.control.size};
          justify-content: center;
          line-height: 0;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          width: 100%;
        }

        .vacuum-card__control--active {
          background: color-mix(in srgb, ${accentColor} 18%, ${styles.control.accent_background});
          border-color: color-mix(in srgb, ${accentColor} 48%, rgba(255, 255, 255, 0.12));
          color: ${styles.control.accent_color};
        }

        .vacuum-card__control ha-icon {
          --mdc-icon-size: calc(${styles.control.size} * 0.46);
          display: inline-flex;
          height: calc(${styles.control.size} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${styles.control.size} * 0.46);
        }

        .vacuum-card__presets {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          min-width: 0;
        }

        .vacuum-card__preset {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          height: ${styles.chip_height};
          justify-content: center;
          margin: 0;
          max-width: 100%;
          min-width: 0;
          padding: ${styles.chip_padding};
          white-space: nowrap;
        }

        .vacuum-card__preset--active {
          background: color-mix(in srgb, ${accentColor} 18%, rgba(255, 255, 255, 0.04));
          border-color: color-mix(in srgb, ${accentColor} 42%, rgba(255, 255, 255, 0.12));
          color: var(--primary-text-color);
        }

        .vacuum-card--compact .vacuum-card__presets {
          justify-content: center;
        }

        @media (max-width: 480px) {
          .vacuum-card__controls {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      </style>

      <ha-card>
        <div class="vacuum-card ${isCompactLayout ? "vacuum-card--compact" : ""}">
          <div class="vacuum-card__header">
            <button
              class="vacuum-card__icon-button"
              type="button"
              data-vacuum-action="primary"
              aria-label="${escapeHtml(iconButtonLabel)}"
            >
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
            </button>
            ${
              showCopyBlock
                ? `
                  <div class="vacuum-card__copy">
                    <div class="vacuum-card__title">${escapeHtml(title)}</div>
                    ${chips.length ? `<div class="vacuum-card__chips">${chips.join("")}</div>` : ""}
                  </div>
                `
                : ""
            }
          </div>

          ${
            controls.length
              ? `
                <div class="vacuum-card__controls">
                  ${controls
                    .map(control => `
                      <button
                        class="vacuum-card__control ${control.active ? "vacuum-card__control--active" : ""}"
                        type="button"
                        data-vacuum-action="${escapeHtml(control.action)}"
                        aria-label="${escapeHtml(control.label)}"
                      >
                        <ha-icon icon="${escapeHtml(control.icon)}"></ha-icon>
                      </button>
                    `)
                    .join("")}
                </div>
              `
              : ""
          }

          ${
            fanPresets.length > 1
              ? `
                <div class="vacuum-card__presets">
                  ${fanPresets
                    .map(preset => `
                      <button
                        class="vacuum-card__preset ${preset === fanSpeed ? "vacuum-card__preset--active" : ""}"
                        type="button"
                        data-vacuum-action="fan"
                        data-value="${escapeHtml(preset)}"
                      >
                        ${escapeHtml(preset)}
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
  customElements.define(CARD_TAG, NodaliaVacuumCard);
}

class NodaliaVacuumCardEditor extends HTMLElement {
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
      .filter(entityId => entityId.startsWith("vacuum."))
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
      case "csv":
        return arrayFromCsv(input.value);
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
      .filter(entityId => entityId.startsWith("vacuum."))
      .sort((left, right) => left.localeCompare(right, "es"));

    if (!entityIds.length) {
      return "";
    }

    return `
      <datalist id="vacuum-card-entities">
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
              placeholder: "vacuum.salon",
            })}
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Robot salon",
            })}
            ${this._renderTextField("Icono", "icon", config.icon, {
              placeholder: "mdi:robot-vacuum",
            })}
            ${this._renderTextField(
              "Presets de potencia",
              "fan_presets",
              Array.isArray(config.fan_presets) ? config.fan_presets.join(", ") : "",
              {
                valueType: "csv",
                placeholder: "Quiet, Balanced, Turbo, Max",
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
            ${this._renderCheckboxField("Chip de estado", "show_state_chip", config.show_state_chip !== false)}
            ${this._renderCheckboxField("Chip de bateria", "show_battery_chip", config.show_battery_chip !== false)}
            ${this._renderCheckboxField("Chip de potencia", "show_fan_speed_chip", config.show_fan_speed_chip !== false)}
            ${this._renderCheckboxField("Presets de potencia", "show_fan_presets", config.show_fan_presets !== false)}
            ${this._renderCheckboxField("Boton volver a base", "show_return_to_base", config.show_return_to_base !== false)}
            ${this._renderCheckboxField("Boton parar", "show_stop", config.show_stop !== false)}
            ${this._renderCheckboxField("Boton localizar", "show_locate", config.show_locate !== false)}
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
            ${this._renderTextField("Tamano burbuja principal", "styles.icon.size", config.styles.icon.size)}
            ${this._renderTextField("Color activa", "styles.icon.active_color", config.styles.icon.active_color)}
            ${this._renderTextField("Color volviendo", "styles.icon.returning_color", config.styles.icon.returning_color)}
            ${this._renderTextField("Color error", "styles.icon.error_color", config.styles.icon.error_color)}
            ${this._renderTextField("Tamano botones", "styles.control.size", config.styles.control.size)}
            ${this._renderTextField("Fondo acento", "styles.control.accent_background", config.styles.control.accent_background)}
            ${this._renderTextField("Color acento", "styles.control.accent_color", config.styles.control.accent_color)}
            ${this._renderTextField("Alto chip", "styles.chip_height", config.styles.chip_height)}
            ${this._renderTextField("Texto chip", "styles.chip_font_size", config.styles.chip_font_size)}
            ${this._renderTextField("Padding chip", "styles.chip_padding", config.styles.chip_padding)}
            ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
          </div>
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('input[data-field="entity"]')
      .forEach(input => {
        input.setAttribute("list", "vacuum-card-entities");
      });
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaVacuumCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Vacuum Card",
  description: "Tarjeta de aspirador con look Nodalia, acciones rapidas y editor visual.",
  preview: true,
});
