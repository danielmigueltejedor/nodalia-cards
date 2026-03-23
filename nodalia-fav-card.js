const CARD_TAG = "nodalia-fav-card";
const EDITOR_TAG = "nodalia-fav-card-editor";
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
const MINI_LAYOUT_THRESHOLD = 126;
const INLINE_LAYOUT_THRESHOLD = 340;

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  tap_action: "auto",
  tap_service: "",
  tap_service_data: "",
  tap_url: "",
  tap_new_tab: false,
  show_name: true,
  show_state: true,
  state_attribute: "",
  layout_mode: "auto",
  haptics: {
    enabled: false,
    style: "selection",
    fallback_vibrate: false,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid rgba(255, 255, 255, 0.06)",
      border_radius: "26px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "10px 12px",
      gap: "10px",
    },
    icon: {
      size: "52px",
      background: "rgba(255, 255, 255, 0.05)",
      on_color: "var(--info-color, #71c0ff)",
      off_color: "var(--state-inactive-color, rgba(255, 255, 255, 0.55))",
    },
    chip_height: "22px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    title_size: "13px",
  },
};

const STUB_CONFIG = {
  entity: "light.sofa",
  name: "Sofa",
  tap_action: "auto",
  show_state: false,
  layout_mode: "auto",
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

function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function miredToKelvin(mired) {
  const numeric = Number(mired);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.round(1000000 / numeric);
}

function normalizeTextKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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
  return mergeConfig(DEFAULT_CONFIG, rawConfig || {});
}

class NodaliaFavCard extends HTMLElement {
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
    this._layout = "inline";
    this._resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextWidth = Math.round(entry.contentRect?.width || this.clientWidth || 0);
      const nextLayout = this._getResolvedLayout(nextWidth);

      if (nextWidth === this._cardWidth && nextLayout === this._layout) {
        return;
      }

      this._cardWidth = nextWidth;
      this._layout = nextLayout;
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
    this._layout = this._getResolvedLayout(Math.round(this._cardWidth || this.clientWidth || 0));
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: 2,
      min_rows: 1,
      min_columns: 1,
    };
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) ? numericColumns : null;
  }

  _getConfiguredGridRows() {
    const numericRows = Number(this._config?.grid_options?.rows);
    return Number.isFinite(numericRows) ? numericRows : null;
  }

  _getResolvedLayout(width) {
    const mode = this._config?.layout_mode || "auto";

    if (mode === "mini") {
      return "mini";
    }

    if (mode === "inline") {
      return "inline";
    }

    const columns = this._getConfiguredGridColumns();
    const rows = this._getConfiguredGridRows();

    if (columns !== null) {
      if (columns <= 2) {
        return "mini";
      }

      if (columns <= 6 || rows === 1) {
        return "inline";
      }
    }

    if (width > 0 && width <= MINI_LAYOUT_THRESHOLD) {
      return "mini";
    }

    if (width > 0 && width <= INLINE_LAYOUT_THRESHOLD) {
      return "inline";
    }

    return "inline";
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

  _isDomainOn(state) {
    const stateKey = normalizeTextKey(state?.state);
    const domain = this._getDomain();

    switch (domain) {
      case "light":
      case "fan":
      case "humidifier":
        return stateKey === "on";
      default:
        return this._isActiveState(state);
    }
  }

  _usesCustomOnColor() {
    const configuredColor = this._config?.styles?.icon?.on_color;
    return Boolean(configuredColor) && configuredColor !== DEFAULT_CONFIG.styles.icon.on_color;
  }

  _usesCustomOffColor() {
    const configuredColor = this._config?.styles?.icon?.off_color;
    return Boolean(configuredColor) && configuredColor !== DEFAULT_CONFIG.styles.icon.off_color;
  }

  _getLightAccentColor(state) {
    const rgbColor = Array.isArray(state?.attributes?.rgb_color) ? state.attributes.rgb_color : null;
    if (this._isActiveState(state) && rgbColor?.length === 3) {
      return `rgb(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]})`;
    }

    if (this._isActiveState(state)) {
      const kelvin = typeof state?.attributes?.color_temp_kelvin === "number"
        ? Math.round(state.attributes.color_temp_kelvin)
        : (typeof state?.attributes?.color_temp === "number" ? miredToKelvin(state.attributes.color_temp) : 0);

      if (kelvin >= 5200) {
        return "#8fd3ff";
      }

      if (kelvin > 0 && kelvin <= 3000) {
        return "#f4b55f";
      }

      if (kelvin > 0) {
        return "#ffe29a";
      }
    }

    return "var(--warning-color, #f6b73c)";
  }

  _getDomainDefaultOnColor(state) {
    switch (this._getDomain()) {
      case "light":
        return this._getLightAccentColor(state);
      case "fan":
        return "var(--info-color, #71c0ff)";
      case "humidifier":
        return "var(--info-color, #71c0ff)";
      case "switch":
        return "var(--primary-color)";
      case "media_player":
        return "var(--info-color, #71c0ff)";
      case "vacuum":
        return "#82d18a";
      default:
        return DEFAULT_CONFIG.styles.icon.on_color;
    }
  }

  _getAccentColor(state) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    if (!this._isDomainOn(state)) {
      return this._usesCustomOffColor()
        ? styles?.icon?.off_color || DEFAULT_CONFIG.styles.icon.off_color
        : "var(--state-inactive-color, rgba(255, 255, 255, 0.5))";
    }

    if (this._usesCustomOnColor()) {
      return styles?.icon?.on_color || DEFAULT_CONFIG.styles.icon.on_color;
    }

    return this._getDomainDefaultOnColor(state);
  }

  _translateStateValue(state) {
    if (!state) {
      return null;
    }

    const rawState = String(state.state ?? "").trim();
    const unit = String(state.attributes?.unit_of_measurement || "").trim();
    const key = normalizeTextKey(rawState);

    if (rawState && unit && /^-?\d+([.,]\d+)?$/.test(rawState)) {
      return `${rawState} ${unit}`;
    }

    switch (key) {
      case "on":
        return "Encendido";
      case "off":
        return "Apagado";
      case "open":
        return "Abierto";
      case "closed":
        return "Cerrado";
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
      case "locked":
        return "Bloqueado";
      case "unlocked":
        return "Desbloqueado";
      case "unavailable":
        return "No disponible";
      case "unknown":
        return "Desconocido";
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

    if (typeof value === "boolean") {
      return value ? "Si" : "No";
    }

    if (typeof value === "number") {
      if (["battery", "battery_level", "humidity", "current_humidity"].includes(key)) {
        return `${Math.round(value)}%`;
      }

      if (key === "brightness") {
        return `${Math.round((value / 255) * 100)}%`;
      }

      if (key === "volume_level") {
        return `${Math.round(value * 100)}%`;
      }
    }

    return String(value);
  }

  _getTitle(state) {
    return this._config?.name || state?.attributes?.friendly_name || this._config?.entity || "Favorito";
  }

  _getIcon(state) {
    return this._config?.icon || state?.attributes?.icon || "mdi:star-four-points";
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

    return Boolean(this._config?.entity);
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
      .find(node => node instanceof HTMLElement && node.dataset?.favAction);

    if (!actionTarget || actionTarget.dataset.favAction !== "primary") {
      return;
    }

    const state = this._getState();
    if (!this._canRunTapAction(state)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();
    this._performPrimaryAction(state);
  }

  _renderChip(label) {
    if (!label) {
      return "";
    }

    return `<div class="fav-card__chip">${escapeHtml(label)}</div>`;
  }

  _renderEmptyState() {
    return `
      <ha-card class="fav-card fav-card--empty">
        <div class="fav-card__empty-title">Nodalia Fav Card</div>
        <div class="fav-card__empty-text">Configura \`entity\` para mostrar el favorito.</div>
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
    const layout = this._layout || "inline";
    const isMini = layout === "mini";
    const icon = this._getIcon(state);
    const title = this._getTitle(state);
    const accentColor = this._getAccentColor(state);
    const displayValue = config.show_state !== false
      ? (config.state_attribute ? this._formatAttributeValue(state, config.state_attribute) : this._translateStateValue(state))
      : null;
    const canRunPrimaryAction = this._canRunTapAction(state);
    const isActive = this._isDomainOn(state);
    const iconSizePx = Math.max(40, Math.min(parseSizeToPixels(styles.icon.size, 52), isMini ? 54 : 56));
    const titleSizePx = Math.max(11, Math.min(parseSizeToPixels(styles.title_size, 13), isMini ? 0 : 14));
    const chipHeightPx = Math.max(18, Math.min(parseSizeToPixels(styles.chip_height, 22), 24));
    const chipFontSizePx = Math.max(9, Math.min(parseSizeToPixels(styles.chip_font_size, 11), 12));
    const iconColor = isActive
      ? accentColor
      : (this._usesCustomOffColor()
        ? styles.icon.off_color
        : "var(--state-inactive-color, rgba(255, 255, 255, 0.55))");
    const cardBackground = isActive
      ? `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 56%, ${styles.card.background} 100%)`
      : styles.card.background;
    const cardBorder = isActive
      ? `1px solid color-mix(in srgb, ${accentColor} 32%, rgba(255, 255, 255, 0.08))`
      : styles.card.border;
    const cardShadow = isActive
      ? `${styles.card.box_shadow}, 0 16px 30px color-mix(in srgb, ${accentColor} 16%, rgba(0, 0, 0, 0.18))`
      : styles.card.box_shadow;
    const showTitle = config.show_name !== false && !isMini;
    const showValue = Boolean(displayValue) && !isMini;
    const showCopy = showTitle || showValue;

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
          height: 100%;
          overflow: hidden;
          position: relative;
        }

        ha-card::before {
          background: ${isActive
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, rgba(255, 255, 255, 0.04)), rgba(255, 255, 255, 0))`
            : "linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0))"};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .fav-card {
          cursor: ${canRunPrimaryAction ? "pointer" : "default"};
        }

        .fav-card__content {
          align-items: center;
          display: grid;
          gap: ${isMini ? "0" : styles.card.gap};
          height: 100%;
          min-width: 0;
          padding: ${isMini ? "8px" : styles.card.padding};
          position: relative;
          z-index: 1;
        }

        .fav-card--mini .fav-card__content {
          justify-items: center;
          place-items: center;
        }

        .fav-card__hero {
          align-items: center;
          display: grid;
          gap: ${isMini ? "0" : "12px"};
          grid-template-columns: ${isMini ? "1fr" : `${iconSizePx}px minmax(0, 1fr)`};
          min-width: 0;
        }

        .fav-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${styles.icon.background};
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: ${isMini ? "22px" : "24px"};
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 12px 30px rgba(0, 0, 0, 0.18);
          color: ${iconColor};
          cursor: ${canRunPrimaryAction ? "pointer" : "default"};
          display: inline-flex;
          height: ${iconSizePx}px;
          justify-content: center;
          line-height: 0;
          margin: 0;
          min-width: ${iconSizePx}px;
          outline: none;
          padding: 0;
          position: relative;
          width: ${iconSizePx}px;
        }

        .fav-card__icon ha-icon {
          --mdc-icon-size: calc(${iconSizePx}px * 0.45);
          display: inline-flex;
          height: calc(${iconSizePx}px * 0.45);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${iconSizePx}px * 0.45);
        }

        .fav-card__copy {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .fav-card__title {
          font-size: ${titleSizePx}px;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.12;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .fav-card__chips {
          align-items: center;
          display: flex;
          gap: 8px;
          min-width: 0;
        }

        .fav-card__chip {
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
          color: var(--primary-text-color);
          display: inline-flex;
          font-size: ${chipFontSizePx}px;
          font-weight: 700;
          height: ${chipHeightPx}px;
          line-height: 1;
          max-width: 100%;
          min-width: 0;
          padding: ${styles.chip_padding};
          white-space: nowrap;
        }

        .fav-card__empty-title {
          font-size: 14px;
          font-weight: 700;
        }

        .fav-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
        }

        .fav-card--empty {
          display: grid;
          gap: 8px;
          padding: 14px;
        }
      </style>
      <ha-card
        class="fav-card ${isMini ? "fav-card--mini" : "fav-card--inline"} ${canRunPrimaryAction ? "fav-card--clickable" : ""}"
        ${canRunPrimaryAction ? 'data-fav-action="primary"' : ""}
      >
        <div class="fav-card__content">
          <div class="fav-card__hero">
            <button
              type="button"
              class="fav-card__icon"
              ${canRunPrimaryAction ? 'data-fav-action="primary"' : ""}
              aria-label="${escapeHtml(canRunPrimaryAction ? "Accion principal" : title)}"
            >
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
            </button>
            ${showCopy
              ? `
                <div class="fav-card__copy">
                  ${showTitle ? `<div class="fav-card__title">${escapeHtml(title)}</div>` : ""}
                  ${showValue ? `<div class="fav-card__chips">${this._renderChip(displayValue)}</div>` : ""}
                </div>
              `
              : ""}
          </div>
        </div>
      </ha-card>
    `;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaFavCard);
}

class NodaliaFavCardEditor extends HTMLElement {
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

    if (input.dataset.field === "__info_only") {
      const isInfoOnly = this._readFieldValue(input) === true;

      if (isInfoOnly) {
        this._config.tap_action = "none";
      } else if ((this._config.tap_action || "auto") === "none") {
        this._config.tap_action = "auto";
      }

      this._setEditorConfig();

      if (event.type === "change") {
        this._emitConfig();
      }
      return;
    }

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
      .sort((left, right) => left.localeCompare(right, "es"));

    if (!entityIds.length) {
      return "";
    }

    return `
      <datalist id="fav-card-entities">
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
            <div class="editor-section__hint">Entidad favorita, icono y accion principal.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Entidad", "entity", config.entity, {
              placeholder: "light.sofa",
            })}
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Sofa",
            })}
            ${this._renderTextField("Icono", "icon", config.icon, {
              placeholder: "mdi:lightbulb",
            })}
            ${this._renderSelectField(
              "Accion principal",
              "tap_action",
              config.tap_action || "auto",
              [
                { value: "auto", label: "Auto (toggle o info)" },
                { value: "toggle", label: "Toggle" },
                { value: "more-info", label: "More info" },
                { value: "url", label: "Abrir URL" },
                { value: "service", label: "Servicio" },
                { value: "none", label: "Solo informacion" },
              ],
            )}
            ${this._renderCheckboxField(
              "Sin accion al tocar",
              "__info_only",
              (config.tap_action || "auto") === "none",
            )}
            ${this._renderTextField("Servicio al tocar", "tap_service", config.tap_service, {
              placeholder: "light.turn_on",
            })}
            ${this._renderTextareaField("Datos del servicio (JSON)", "tap_service_data", config.tap_service_data, {
              placeholder: '{"brightness_pct": 70}',
            })}
            ${this._renderTextField("URL al tocar", "tap_url", config.tap_url, {
              placeholder: "https://example.com",
            })}
            ${this._renderCheckboxField("Abrir URL en pestana nueva", "tap_new_tab", config.tap_new_tab === true)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Layout</div>
            <div class="editor-section__hint">Version mini para 1x1 o inline para favoritos alargados.</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "Layout",
              "layout_mode",
              config.layout_mode || "auto",
              [
                { value: "auto", label: "Automatico" },
                { value: "mini", label: "Mini" },
                { value: "inline", label: "Inline" },
              ],
            )}
            ${this._renderCheckboxField("Mostrar nombre", "show_name", config.show_name !== false)}
            ${this._renderCheckboxField("Mostrar estado", "show_state", config.show_state !== false)}
            ${this._renderTextField("Atributo a mostrar", "state_attribute", config.state_attribute, {
              placeholder: "battery_level",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Haptics</div>
            <div class="editor-section__hint">Respuesta haptica opcional al tocar la tarjeta.</div>
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
            <div class="editor-section__hint">Ajustes visuales base de la tarjeta favorita.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Background", "styles.card.background", config.styles.card.background)}
            ${this._renderTextField("Border", "styles.card.border", config.styles.card.border)}
            ${this._renderTextField("Radius", "styles.card.border_radius", config.styles.card.border_radius)}
            ${this._renderTextField("Shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
            ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
            ${this._renderTextField("Separacion", "styles.card.gap", config.styles.card.gap)}
            ${this._renderTextField("Tamano burbuja", "styles.icon.size", config.styles.icon.size)}
            ${this._renderTextField("Color activo", "styles.icon.on_color", config.styles.icon.on_color)}
            ${this._renderTextField("Color inactivo", "styles.icon.off_color", config.styles.icon.off_color)}
            ${this._renderTextField("Alto chips", "styles.chip_height", config.styles.chip_height)}
            ${this._renderTextField("Texto chips", "styles.chip_font_size", config.styles.chip_font_size)}
            ${this._renderTextField("Padding chips", "styles.chip_padding", config.styles.chip_padding)}
            ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
          </div>
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('input[data-field="entity"]')
      .forEach(input => input.setAttribute("list", "fav-card-entities"));
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaFavCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Fav Card",
  description: "Tarjeta mini y elegante para favoritos y controles rapidos en movil.",
  preview: true,
});
