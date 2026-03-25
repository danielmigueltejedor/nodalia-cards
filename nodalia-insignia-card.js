const CARD_TAG = "nodalia-insignia-card";
const EDITOR_TAG = "nodalia-insignia-card-editor";
const CARD_VERSION = "0.17.0";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  value: "",
  icon: "",
  image: "",
  use_entity_icon: false,
  state_attribute: "",
  tap_action: "auto",
  tap_url: "",
  tap_new_tab: false,
  service: "",
  service_data: "",
  show_name: true,
  show_value: true,
  tint_color: "",
  haptics: {
    enabled: false,
    style: "selection",
    fallback_vibrate: false,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "999px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "8px 12px",
      gap: "10px",
    },
    icon: {
      size: "42px",
      background: "rgba(255, 255, 255, 0.06)",
      on_color: "var(--primary-text-color)",
      off_color: "var(--state-inactive-color, rgba(255, 255, 255, 0.55))",
    },
    title_size: "13px",
    value_size: "13px",
  },
};

const STUB_CONFIG = {
  name: "Bienvenido",
  value: "21,4 °C",
  icon: "mdi:home-thermometer-outline",
  tint_color: "#ff6d7a",
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
    return value.map(item => compactConfig(item)).filter(item => item !== undefined);
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function parseSizeToPixels(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = String(value || "").trim();
  if (!normalized) {
    return fallback;
  }

  if (normalized.endsWith("px")) {
    const numeric = Number.parseFloat(normalized);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (Math.abs(numeric - Math.round(numeric)) < 0.01) {
    return String(Math.round(numeric));
  }

  return numeric.toFixed(1).replace(".", ",");
}

function parseServiceData(value) {
  const text = String(value || "").trim();
  if (!text) {
    return {};
  }

  try {
    const parsed = JSON.parse(text);
    return isObject(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function normalizeConfig(rawConfig) {
  return mergeConfig(DEFAULT_CONFIG, rawConfig || {});
}

function translateStateValue(state) {
  const raw = normalizeTextKey(state?.state);
  switch (raw) {
    case "on":
      return "Encendido";
    case "off":
      return "Apagado";
    case "home":
      return "En casa";
    case "not_home":
      return "Fuera";
    case "playing":
      return "Reproduciendo";
    case "paused":
      return "Pausado";
    case "idle":
      return "En espera";
    case "locked":
      return "Cerrado";
    case "unlocked":
      return "Abierto";
    case "unavailable":
      return "No disponible";
    case "unknown":
      return "Desconocido";
    default:
      return String(state?.state || "").trim() || "";
  }
}

function getDomain(entityId) {
  return String(entityId || "").split(".")[0] || "";
}

function getAccentColorForState(state, config) {
  const customTint = String(config?.tint_color || "").trim();
  if (customTint) {
    return customTint;
  }

  if (isUnavailableState(state)) {
    return "#ff9b4a";
  }

  const domain = getDomain(state?.entity_id);
  const attrs = state?.attributes || {};
  const normalizedState = normalizeTextKey(state?.state);

  if (domain === "light") {
    const rgbColor = Array.isArray(attrs.rgb_color) ? attrs.rgb_color : null;
    if (rgbColor && rgbColor.length >= 3) {
      return `rgb(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]})`;
    }
    return normalizedState === "on" ? "#ffbe55" : "#94a3b8";
  }

  if (domain === "fan") {
    return normalizedState === "on" ? "#6ac8ff" : "#94a3b8";
  }

  if (domain === "humidifier") {
    return normalizedState === "on" ? "#78d5ff" : "#94a3b8";
  }

  if (domain === "alarm_control_panel") {
    if (rawStartsWith(normalizedState, "armed")) {
      return "#8f7dff";
    }
    return "#71c0ff";
  }

  if (domain === "person") {
    return normalizedState === "home" ? "#74d572" : "#ff7b7b";
  }

  if (domain === "weather") {
    return "#71c0ff";
  }

  if (domain === "climate") {
    return "#ffb14a";
  }

  if (domain === "calendar") {
    return "#8f7dff";
  }

  const deviceClass = normalizeTextKey(attrs.device_class);
  if (deviceClass === "humidity" || String(attrs.unit_of_measurement || "").trim() === "%") {
    return "#4faeff";
  }

  if (deviceClass === "temperature" || String(attrs.unit_of_measurement || "").includes("°")) {
    return "#ffb14a";
  }

  if (deviceClass === "power" || String(attrs.unit_of_measurement || "").trim().toLowerCase() === "w") {
    return "#ffd85a";
  }

  if (normalizedState === "on" || normalizedState === "open" || normalizedState === "unlocked") {
    return "#71c0ff";
  }

  return "#8ea3c0";
}

function rawStartsWith(value, prefix) {
  return String(value || "").startsWith(prefix);
}

class NodaliaInsigniaCard extends HTMLElement {
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
    this._lastRenderSignature = "";
    this._onShadowClick = this._onShadowClick.bind(this);
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
  }

  disconnectedCallback() {
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
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
    this._render();
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return {
      rows: 1,
      columns: 3,
      min_rows: 1,
      min_columns: 2,
    };
  }

  _getState() {
    return this._config?.entity ? this._hass?.states?.[this._config.entity] || null : null;
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const attrs = state?.attributes || {};

    return JSON.stringify({
      entityId,
      name: this._config?.name || "",
      value: this._config?.value || "",
      icon: this._config?.icon || "",
      image: this._config?.image || "",
      useEntityIcon: this._config?.use_entity_icon === true,
      stateAttribute: this._config?.state_attribute || "",
      showName: this._config?.show_name !== false,
      showValue: this._config?.show_value !== false,
      tintColor: this._config?.tint_color || "",
      state: String(state?.state || ""),
      iconAttr: String(attrs.icon || ""),
      imageAttr: String(attrs.entity_picture || ""),
      friendlyName: String(attrs.friendly_name || ""),
      attrValue: this._config?.state_attribute ? attrs[this._config.state_attribute] : "",
    });
  }

  _getTitle(state) {
    const customName = String(this._config?.name || "").trim();
    if (customName) {
      return customName;
    }

    const friendlyName = String(state?.attributes?.friendly_name || "").trim();
    return friendlyName || "";
  }

  _getValue(state) {
    const staticValue = String(this._config?.value || "").trim();
    if (staticValue) {
      return staticValue;
    }

    const attrName = String(this._config?.state_attribute || "").trim();
    if (attrName && state?.attributes && state.attributes[attrName] !== undefined && state.attributes[attrName] !== null) {
      const attributeValue = state.attributes[attrName];
      return typeof attributeValue === "number"
        ? formatNumber(attributeValue) || String(attributeValue)
        : String(attributeValue);
    }

    return state ? translateStateValue(state) : "";
  }

  _getImage(state) {
    const customImage = String(this._config?.image || "").trim();
    if (customImage) {
      return customImage;
    }

    const entityPicture = String(state?.attributes?.entity_picture || "").trim();
    return entityPicture || "";
  }

  _getIcon(state) {
    const customIcon = String(this._config?.icon || "").trim();
    if (customIcon) {
      return customIcon;
    }

    if (this._config?.use_entity_icon === true) {
      const entityIcon = String(state?.attributes?.icon || "").trim();
      if (entityIcon) {
        return entityIcon;
      }
    }

    const domain = getDomain(state?.entity_id);
    switch (domain) {
      case "light":
        return normalizeTextKey(state?.state) === "on" ? "mdi:lightbulb-on-outline" : "mdi:lightbulb-outline";
      case "fan":
        return "mdi:fan";
      case "humidifier":
        return "mdi:air-humidifier";
      case "climate":
        return "mdi:home-thermometer-outline";
      case "person":
        return "mdi:account";
      case "alarm_control_panel":
        return "mdi:shield-home-outline";
      case "weather":
        return "mdi:weather-partly-cloudy";
      case "calendar":
        return "mdi:calendar-month-outline";
      default:
        return "mdi:star-four-points-circle-outline";
    }
  }

  _canRunPrimaryAction(state) {
    const action = String(this._config?.tap_action || "auto");

    if (action === "none") {
      return false;
    }

    if (action === "auto") {
      return Boolean(state?.entity_id);
    }

    return true;
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
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection);
    }
  }

  _toggleEntity(entityId) {
    if (!entityId || !this._hass?.callService) {
      return;
    }

    const domain = getDomain(entityId);
    const toggleDomains = new Set(["light", "switch", "fan", "humidifier", "input_boolean"]);

    if (!toggleDomains.has(domain)) {
      fireEvent(this, "hass-more-info", { entityId });
      return;
    }

    this._hass.callService(domain, "toggle", { entity_id: entityId });
  }

  _performPrimaryAction(state) {
    const action = String(this._config?.tap_action || "auto");
    const entityId = state?.entity_id || this._config?.entity || "";

    switch (action) {
      case "none":
        return;
      case "more-info":
        if (entityId) {
          fireEvent(this, "hass-more-info", { entityId });
        }
        return;
      case "toggle":
        this._toggleEntity(entityId);
        return;
      case "service":
        if (this._config?.service) {
          this._hass?.callService?.(
            this._config.service.split(".")[0],
            this._config.service.split(".").slice(1).join("."),
            parseServiceData(this._config.service_data),
          );
        }
        return;
      case "url": {
        const url = String(this._config?.tap_url || "").trim();
        if (!url) {
          return;
        }
        if (this._config?.tap_new_tab === true) {
          window.open(url, "_blank", "noopener");
        } else {
          window.location.assign(url);
        }
        return;
      }
      case "auto":
      default:
        if (!entityId) {
          return;
        }
        fireEvent(this, "hass-more-info", { entityId });
    }
  }

  _onShadowClick(event) {
    const root = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.insigniaAction === "primary");
    if (!root) {
      return;
    }

    const state = this._getState();
    if (!this._canRunPrimaryAction(state)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();
    this._performPrimaryAction(state);
  }

  _renderEmptyState() {
    return `
      <ha-card class="insignia-card insignia-card--empty">
        <div class="insignia-card__empty-title">Nodalia Insignia Card</div>
        <div class="insignia-card__empty-text">Configura \`entity\` o contenido estático para mostrar la insignia.</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const state = this._getState();
    const hasStaticContent = Boolean(
      String(this._config?.name || "").trim()
      || String(this._config?.value || "").trim()
      || String(this._config?.icon || "").trim()
      || String(this._config?.image || "").trim(),
    );

    if (!state && !hasStaticContent) {
      this.shadowRoot.innerHTML = this._renderEmptyState();
      return;
    }

    const config = this._config;
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const title = this._getTitle(state);
    const value = this._getValue(state);
    const icon = this._getIcon(state);
    const image = this._getImage(state);
    const showName = config.show_name !== false && Boolean(title);
    const showValue = config.show_value !== false && Boolean(value);
    const showUnavailableBadge = isUnavailableState(state);
    const accentColor = getAccentColorForState(state, config);
    const isLightTheme = this._hass?.themes?.darkMode === false;
    const iconSizePx = Math.max(30, Math.min(parseSizeToPixels(styles.icon.size, 42), 48));
    const cardBackground = isLightTheme
      ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 5%, rgba(255, 255, 255, 0.98)) 0%, rgba(255, 255, 255, 0.95) 100%)`
      : `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 8%, ${styles.card.background}) 56%, ${styles.card.background} 100%)`;
    const cardBorder = isLightTheme
      ? `1px solid color-mix(in srgb, ${accentColor} 16%, rgba(15, 23, 42, 0.1))`
      : `1px solid color-mix(in srgb, ${accentColor} 24%, rgba(255, 255, 255, 0.08))`;
    const cardShadow = isLightTheme
      ? `${styles.card.box_shadow}, 0 10px 22px color-mix(in srgb, ${accentColor} 2%, rgba(15, 23, 42, 0.12)), 0 2px 5px rgba(15, 23, 42, 0.05)`
      : `${styles.card.box_shadow}, 0 12px 26px color-mix(in srgb, ${accentColor} 12%, rgba(0, 0, 0, 0.18))`;
    const surfaceBackground = isLightTheme
      ? "linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 255, 255, 0.9) 100%)"
      : "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)";
    const surfaceBorder = isLightTheme ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)";
    const surfaceInset = isLightTheme ? "rgba(255, 255, 255, 0.92)" : "rgba(255, 255, 255, 0.06)";
    const surfaceShadow = isLightTheme
      ? "0 8px 18px rgba(15, 23, 42, 0.08), 0 2px 5px rgba(15, 23, 42, 0.05)"
      : "0 10px 22px rgba(0, 0, 0, 0.18)";

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

        .insignia-card::before {
          background: linear-gradient(180deg, ${isLightTheme ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.04)"}, rgba(255, 255, 255, 0));
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .insignia-card__content {
          align-items: center;
          cursor: ${this._canRunPrimaryAction(state) ? "pointer" : "default"};
          display: grid;
          gap: ${styles.card.gap};
          grid-template-columns: ${iconSizePx}px minmax(0, 1fr);
          min-height: 58px;
          min-width: 0;
          padding: ${styles.card.padding};
          position: relative;
          z-index: 1;
        }

        .insignia-card__icon {
          align-items: center;
          background: ${surfaceBackground};
          border: 1px solid ${surfaceBorder};
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 ${surfaceInset},
            ${surfaceShadow};
          color: ${accentColor};
          display: inline-flex;
          height: ${iconSizePx}px;
          justify-content: center;
          position: relative;
          width: ${iconSizePx}px;
        }

        .insignia-card__icon ha-icon {
          --mdc-icon-size: calc(${iconSizePx}px * 0.46);
        }

        .insignia-card__icon img {
          border-radius: inherit;
          display: block;
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .insignia-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${isLightTheme ? "rgba(255, 255, 255, 0.94)" : styles.card.background};
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          color: #ffffff;
          display: inline-flex;
          height: 16px;
          justify-content: center;
          position: absolute;
          right: -2px;
          top: -2px;
          width: 16px;
        }

        .insignia-card__unavailable-badge ha-icon {
          --mdc-icon-size: 10px;
          height: 10px;
          width: 10px;
        }

        .insignia-card__copy {
          align-items: center;
          display: flex;
          gap: 8px;
          min-width: 0;
        }

        .insignia-card__title,
        .insignia-card__value {
          line-height: 1.1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .insignia-card__title {
          color: var(--primary-text-color);
          font-size: ${styles.title_size};
          font-weight: 700;
        }

        .insignia-card__value {
          color: var(--secondary-text-color);
          font-size: ${styles.value_size};
          font-weight: 700;
        }

        .insignia-card__empty-title {
          font-size: 15px;
          font-weight: 700;
        }

        .insignia-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }

        .insignia-card--empty {
          display: grid;
          gap: 8px;
          padding: 16px;
        }
      </style>
      <ha-card class="insignia-card">
        <div class="insignia-card__content" data-insignia-action="primary">
          <div class="insignia-card__icon">
            ${image
              ? `<img src="${escapeHtml(image)}" alt="">`
              : `<ha-icon icon="${escapeHtml(icon)}"></ha-icon>`}
            ${showUnavailableBadge ? `<span class="insignia-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
          </div>
          <div class="insignia-card__copy">
            ${showName ? `<div class="insignia-card__title">${escapeHtml(title)}</div>` : ""}
            ${showValue ? `<div class="insignia-card__value">${escapeHtml(value)}</div>` : ""}
          </div>
        </div>
      </ha-card>
    `;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaInsigniaCard);
}

class NodaliaInsigniaCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._onShadowInput = this._onShadowInput.bind(this);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._render();
  }

  _emitConfig() {
    const nextConfig = deepClone(this._config);
    this._config = normalizeConfig(compactConfig(nextConfig));
    this._render();
    fireEvent(this, "config-changed", {
      config: compactConfig(nextConfig),
    });
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
    if (valueType === "boolean") {
      return Boolean(input.checked);
    }
    return input.value;
  }

  _onShadowInput(event) {
    const input = event.composedPath().find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement);
    if (!input?.dataset?.field) {
      return;
    }

    event.stopPropagation();
    this._setFieldValue(input.dataset.field, this._readFieldValue(input));
    this._config = normalizeConfig(compactConfig(this._config));

    if (event.type === "change") {
      this._emitConfig();
    }
  }

  _renderTextField(label, field, value, options = {}) {
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";

    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <input
          type="${escapeHtml(options.type || "text")}"
          data-field="${escapeHtml(field)}"
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
          ${options.map(option => `
            <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
              ${escapeHtml(option.label)}
            </option>
          `).join("")}
        </select>
      </label>
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
            <div class="editor-section__hint">Insignia compacta con icono o imagen, valor y tinte Nodalia.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Entidad", "entity", config.entity, { placeholder: "sensor.temperatura_salon" })}
            ${this._renderTextField("Nombre", "name", config.name, { placeholder: "Temperatura" })}
            ${this._renderTextField("Valor fijo", "value", config.value, { placeholder: "21,4 °C" })}
            ${this._renderTextField("Atributo de estado", "state_attribute", config.state_attribute, { placeholder: "temperature" })}
            ${this._renderTextField("Icono", "icon", config.icon, { placeholder: "mdi:home-thermometer-outline" })}
            ${this._renderTextField("Imagen", "image", config.image, { placeholder: "/local/avatar.png" })}
            ${this._renderTextField("Tinte", "tint_color", config.tint_color, { placeholder: "#ff6d7a" })}
            ${this._renderSelectField(
              "Acción al tocar",
              "tap_action",
              config.tap_action || "auto",
              [
                { value: "auto", label: "Auto" },
                { value: "more-info", label: "More info" },
                { value: "toggle", label: "Toggle" },
                { value: "service", label: "Servicio" },
                { value: "url", label: "Abrir URL" },
                { value: "none", label: "Sin acción" },
              ],
            )}
            ${this._renderCheckboxField("Usar icono de la entidad", "use_entity_icon", config.use_entity_icon === true)}
            ${this._renderCheckboxField("Mostrar nombre", "show_name", config.show_name !== false)}
            ${this._renderCheckboxField("Mostrar valor", "show_value", config.show_value !== false)}
            ${this._renderCheckboxField("Abrir URL en pestaña nueva", "tap_new_tab", config.tap_new_tab === true)}
            ${this._renderTextField("URL", "tap_url", config.tap_url, { fullWidth: true, placeholder: "https://..." })}
            ${this._renderTextField("Servicio", "service", config.service, { placeholder: "light.toggle" })}
            ${this._renderTextField("Datos servicio (JSON)", "service_data", config.service_data, { fullWidth: true, placeholder: "{\"entity_id\":\"light.salon\"}" })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Haptics</div>
            <div class="editor-section__hint">Respuesta háptica al tocar la insignia.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Activar haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("Fallback con vibración", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "Estilo háptico",
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
            <div class="editor-section__hint">Ajustes visuales de la insignia.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Background", "styles.card.background", config.styles.card.background)}
            ${this._renderTextField("Border", "styles.card.border", config.styles.card.border)}
            ${this._renderTextField("Radius", "styles.card.border_radius", config.styles.card.border_radius)}
            ${this._renderTextField("Shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
            ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
            ${this._renderTextField("Separación", "styles.card.gap", config.styles.card.gap)}
            ${this._renderTextField("Tamaño icono", "styles.icon.size", config.styles.icon.size)}
            ${this._renderTextField("Color icono activo", "styles.icon.on_color", config.styles.icon.on_color)}
            ${this._renderTextField("Color icono inactivo", "styles.icon.off_color", config.styles.icon.off_color)}
            ${this._renderTextField("Tamaño nombre", "styles.title_size", config.styles.title_size)}
            ${this._renderTextField("Tamaño valor", "styles.value_size", config.styles.value_size)}
          </div>
        </section>
      </div>
    `;
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaInsigniaCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Insignia Card",
  description: "Insignia compacta estilo chip burbuja para Home Assistant",
  preview: true,
});
