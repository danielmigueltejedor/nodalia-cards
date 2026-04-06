const CARD_TAG = "nodalia-insignia-card";
const EDITOR_TAG = "nodalia-insignia-card-editor";
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

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  use_entity_icon: false,
  use_entity_picture: false,
  state_attribute: "",
  tap_action: "auto",
  tap_service: "",
  tap_service_data: "",
  tap_url: "",
  tap_new_tab: false,
  show_name: true,
  show_value: true,
  haptics: {
    enabled: false,
    style: "selection",
    fallback_vibrate: false,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid rgba(255, 255, 255, 0.06)",
      border_radius: "999px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "4px 8px",
      gap: "8px",
    },
    icon: {
      size: "26px",
      background: "rgba(255, 255, 255, 0.05)",
      on_color: "var(--info-color, #71c0ff)",
      off_color: "var(--state-inactive-color, rgba(255, 255, 255, 0.55))",
      icon_only_offset_y: "2px",
    },
    title_size: "12px",
    value_size: "12px",
  },
  tint_preset: "auto",
};

const STUB_CONFIG = {
  entity: "sensor.temperatura_salon",
  name: "Salon",
  show_name: true,
  show_value: true,
  tap_action: "more-info",
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
    if (!isObject(cursor[key])) {
      cursor[key] = {};
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
    if (!isObject(cursor[key])) {
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

function normalizeTextKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeTintPreset(value) {
  const key = normalizeTextKey(value);
  if (!key) {
    return "";
  }

  const map = {
    grey: "gray",
    light_grey: "gray",
    light_gray: "gray",
    red: "red",
    orange: "orange",
    yellow: "yellow",
    green: "green",
    blue: "blue",
    purple: "purple",
    pink: "pink",
    teal: "teal",
    gray: "gray",
    auto: "auto",
  };

  return map[key] || key;
}

function extractTemplateBody(value) {
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("[[[") || !raw.endsWith("]]]")) {
    return "";
  }
  return raw.slice(3, -3);
}

function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

function getEntityDomain(state) {
  const entityId = String(state?.entity_id || "");
  return entityId.includes(".") ? entityId.split(".")[0] : "";
}

function getDynamicEntityIcon(state) {
  if (!state) {
    return "";
  }

  const domain = getEntityDomain(state);
  const stateKey = normalizeTextKey(state.state);
  const deviceClass = normalizeTextKey(state.attributes?.device_class);

  if (domain === "binary_sensor") {
    switch (deviceClass) {
      case "door":
      case "opening":
        return stateKey === "on" ? "mdi:door-open" : "mdi:door-closed";
      case "window":
        return stateKey === "on" ? "mdi:window-open-variant" : "mdi:window-closed-variant";
      case "motion":
        return stateKey === "on" ? "mdi:motion-sensor" : "mdi:motion-sensor-off";
      case "occupancy":
      case "presence":
      case "person":
        return stateKey === "on" ? "mdi:account" : "mdi:account-off-outline";
      case "smoke":
        return stateKey === "on" ? "mdi:smoke-detector-alert" : "mdi:smoke-detector-variant";
      default:
        break;
    }
  }

  if (domain === "light") {
    return stateKey === "on" ? "mdi:lightbulb" : "mdi:lightbulb-off";
  }

  if (domain === "switch") {
    return stateKey === "on" ? "mdi:toggle-switch-variant" : "mdi:toggle-switch-variant-off";
  }

  if (domain === "fan") {
    return stateKey === "on" ? "mdi:fan" : "mdi:fan-off";
  }

  if (domain === "humidifier") {
    return stateKey === "on" ? "mdi:air-humidifier" : "mdi:air-humidifier-off";
  }

  if (domain === "lock") {
    return stateKey === "unlocked" ? "mdi:lock-open-variant" : "mdi:lock";
  }

  if (domain === "person") {
    return "mdi:account";
  }

  return state.attributes?.icon || "";
}

function formatNumericString(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const numeric = Number(raw.replace(",", "."));
  if (!Number.isFinite(numeric)) {
    return raw;
  }

  if (Number.isInteger(numeric)) {
    return String(numeric);
  }

  return raw
    .replace(/(\.\d*?[1-9])0+$/g, "$1")
    .replace(/\.0+$/g, "");
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

function normalizeConfig(rawConfig) {
  const merged = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const legacyColor = normalizeTintPreset(rawConfig?.color);
  if (legacyColor && legacyColor !== "auto" && (!merged.tint_preset || merged.tint_preset === "auto")) {
    merged.tint_preset = legacyColor;
  }
  return merged;
}

class NodaliaInsigniaCard extends HTMLElement {
  static getConfigElement() {
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
    this._onClick = this._onClick.bind(this);
  }

  connectedCallback() {
    this.shadowRoot.addEventListener("click", this._onClick);
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener("click", this._onClick);
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

  _getState() {
    return this._config?.entity ? this._hass?.states?.[this._config.entity] || null : null;
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
      attrValue: this._config?.state_attribute ? String(attrs[this._config.state_attribute] ?? "") : "",
      config: this._config,
    });
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

  _getResolvedName(state) {
    return this._config.name
      || state?.attributes?.friendly_name
      || this._config.entity
      || "Insignia";
  }

  _getResolvedValue(state) {
    if (this._config.state_attribute) {
      const attrValue = state?.attributes?.[this._config.state_attribute];
      return attrValue === undefined || attrValue === null ? "" : formatNumericString(attrValue);
    }

    if (!state) {
      return "";
    }

    const unit = String(state.attributes?.unit_of_measurement || "").trim();
    const formatted = formatNumericString(state.state);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  _getResolvedIcon(state) {
    if (this._config.use_entity_icon) {
      return getDynamicEntityIcon(state) || this._config.icon || "mdi:star-four-points-circle";
    }

    return this._config.icon || state?.attributes?.icon || "mdi:star-four-points-circle";
  }

  _getResolvedPicture(state) {
    if (!this._config.use_entity_picture) {
      return "";
    }

    const picture = state?.attributes?.entity_picture;
    return picture ? String(picture) : "";
  }

  _evaluateVisibility() {
    const rules = Array.isArray(this._config?.visibility) ? this._config.visibility : [];
    if (!rules.length) {
      return true;
    }

    for (const rule of rules) {
      if (!rule || rule.condition !== "template") {
        continue;
      }
      const rawValue = String(rule.value ?? "").trim();
      const body = extractTemplateBody(rawValue);
      try {
        const hasWrapper = body.length > 0;
        const expression = hasWrapper ? body : rawValue;
        const fn = new Function("hass", "states", "user", `return (function(){${expression}})();`);
        const ok = Boolean(fn(this._hass, this._hass?.states || {}, this._hass?.user));
        if (!ok) {
          return false;
        }
      } catch (_error) {
        return false;
      }
    }

    return true;
  }

  _isActive(state) {
    const stateKey = normalizeTextKey(state?.state);
    if (!state) {
      return false;
    }

    return ["on", "home", "playing", "heat", "cool", "dry", "fan_only", "open", "unlocked"].includes(stateKey);
  }

  _shouldDimIcon(state) {
    if (!state) {
      return false;
    }

    const domain = getEntityDomain(state);
    if (["sensor", "input_number", "input_datetime", "input_text", "number"].includes(domain)) {
      return false;
    }

    return [
      "light",
      "switch",
      "fan",
      "humidifier",
      "binary_sensor",
      "alarm_control_panel",
      "lock",
      "cover",
      "media_player",
      "vacuum",
      "input_boolean",
      "device_tracker",
      "person",
    ].includes(domain);
  }

  _getTintColor(state) {
    const preset = normalizeTintPreset(this._config?.tint_preset || this._config?.color || "auto");
    if (preset && preset !== "auto") {
      const presets = {
        red: "#ff6b6b",
        orange: "#f6b04d",
        yellow: "#f2c94c",
        green: "#83d39c",
        blue: "#4da3ff",
        purple: "#b59dff",
        pink: "#ff8fd1",
        teal: "#7fd0c8",
        gray: "var(--state-inactive-color, rgba(255, 255, 255, 0.55))",
      };
      return presets[preset] || presets.blue;
    }

    const domain = getEntityDomain(state);
    const stateKey = normalizeTextKey(state?.state);
    const deviceClass = normalizeTextKey(state?.attributes?.device_class);
    const rawUnit = String(state?.attributes?.unit_of_measurement || "").trim().toLowerCase();
    const unit = normalizeTextKey(rawUnit);

    if (domain === "light") {
      return stateKey === "on" ? "var(--warning-color, #f6b04d)" : "var(--state-inactive-color, rgba(255, 255, 255, 0.5))";
    }
    if (domain === "fan") {
      return "var(--info-color, #71c0ff)";
    }
    if (domain === "humidifier") {
      return "#7fd0c8";
    }
    if (domain === "person") {
      return "#83d39c";
    }
    if (domain === "alarm_control_panel") {
      return "#b59dff";
    }
    if (domain === "weather") {
      return "#8fc9ff";
    }
    if (domain === "sensor") {
      if (deviceClass === "temperature" || unit === "c" || rawUnit.includes("°c") || rawUnit.includes("degc")) {
        return "#ff6b6b";
      }
      if (deviceClass === "humidity" || rawUnit.includes("%") || unit === "percent") {
        return "#4da3ff";
      }
    }

    return "var(--info-color, #71c0ff)";
  }

  _onClick(event) {
    const trigger = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.insigniaAction === "primary");

    if (!trigger) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._handlePrimaryAction();
  }

  _handlePrimaryAction() {
    const state = this._getState();
    const action = this._config.tap_action || "auto";

    if (action === "none") {
      return;
    }

    this._triggerHaptic();

    if (action === "more-info" || (action === "auto" && state)) {
      fireEvent(this, "hass-more-info", { entityId: this._config.entity });
      return;
    }

    if (action === "toggle") {
      this._hass?.callService("homeassistant", "toggle", { entity_id: this._config.entity });
      return;
    }

    if (action === "service" && this._config.tap_service) {
      const [domain, service] = this._config.tap_service.split(".");
      if (domain && service) {
        let serviceData = {};
        if (this._config.tap_service_data) {
          try {
            serviceData = JSON.parse(this._config.tap_service_data);
          } catch (_error) {
            serviceData = {};
          }
        }
        this._hass?.callService(domain, service, serviceData);
      }
      return;
    }

    if (action === "url" && this._config.tap_url) {
      if (this._config.tap_new_tab) {
        window.open(this._config.tap_url, "_blank", "noopener");
      } else {
        window.location.href = this._config.tap_url;
      }
    }
  }

  _renderEmptyState() {
    return `
      <ha-card class="insignia-card insignia-card--empty">
        <div class="insignia-card__empty-title">Nodalia Insignia Card</div>
        <div class="insignia-card__empty-text">Configura \`entity\` o un contenido básico para mostrar la insignia.</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const state = this._getState();

    if (!state && !config.name && !config.icon) {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; }
          * { box-sizing: border-box; }
          .insignia-card--empty {
            background: ${styles.card.background};
            border: ${styles.card.border};
            border-radius: ${styles.card.border_radius};
            box-shadow: ${styles.card.box_shadow};
            display: grid;
            gap: 6px;
            padding: ${styles.card.padding};
          }
          .insignia-card__empty-title {
            color: var(--primary-text-color);
            font-size: 14px;
            font-weight: 700;
          }
          .insignia-card__empty-text {
            color: var(--secondary-text-color);
            font-size: 12px;
            line-height: 1.45;
          }
        </style>
        ${this._renderEmptyState()}
      `;
      return;
    }

    const iconSizePx = Math.max(28, Math.min(parseSizeToPixels(styles.icon.size, 34), 40));
    const titleSize = `${Math.max(12, Math.min(parseSizeToPixels(styles.title_size, 13), 14))}px`;
    const valueSize = `${Math.max(12, Math.min(parseSizeToPixels(styles.value_size, 13), 14))}px`;
    const title = this._getResolvedName(state);
    const value = this._getResolvedValue(state);
    const icon = this._getResolvedIcon(state);
    const active = this._isActive(state);
    const dimIcon = this._shouldDimIcon(state);
    const tint = this._getTintColor(state);
    const unavailable = config.entity && isUnavailableState(state);
    const showName = config.show_name !== false;
    const showValue = config.show_value !== false && Boolean(value);
    const iconOnly = !showName && !showValue;
    const iconOnlySize = Math.max(36, Math.min(iconSizePx + 12, 46));
    const iconOnlyIconBase = parseSizeToPixels(styles.icon?.size, iconSizePx);
    const iconOnlyIconSize = Math.max(18, Math.min(Math.round(iconOnlyIconBase), iconOnlySize - 8));
    const iconOnlyOffsetY = String(styles.icon?.icon_only_offset_y ?? DEFAULT_CONFIG.styles.icon.icon_only_offset_y);
    const pictureUrl = this._getResolvedPicture(state);
    const showPicture = Boolean(pictureUrl);
    const isVisible = this._evaluateVisibility();

    this.toggleAttribute("data-icon-only", iconOnly);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          line-height: 1;
        }

        :host([data-icon-only]) {
          display: inline-flex;
          justify-content: center;
          width: auto;
        }

        * {
          box-sizing: border-box;
        }

        .insignia-card {
          background: ${styles.card.background};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          background-clip: padding-box;
          box-shadow: ${styles.card.box_shadow};
          color: var(--primary-text-color);
          display: inline-flex;
          height: auto;
          min-height: 0;
          isolation: isolate;
          position: relative;
          overflow: hidden;
          contain: paint;
        }

        .insignia-card--icon-only {
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          height: var(--icon-only-size);
          min-height: var(--icon-only-size);
          min-width: var(--icon-only-size);
          width: var(--icon-only-size);
        }

        .insignia-card::before {
          background:
            radial-gradient(circle at 8% 10%, color-mix(in srgb, ${tint} 22%, transparent) 0%, transparent 55%),
            linear-gradient(90deg, color-mix(in srgb, ${tint} 18%, transparent), transparent 70%);
          border-radius: inherit;
          content: "";
          inset: 0;
          opacity: ${active ? "0.5" : "0.28"};
          pointer-events: none;
          position: absolute;
        }

        .insignia-card__content {
          align-items: center;
          cursor: pointer;
          display: grid;
          gap: ${styles.card.gap};
          grid-template-columns: ${iconSizePx}px minmax(0, 1fr);
          padding: ${styles.card.padding};
          position: relative;
          z-index: 1;
        }

        .insignia-card--icon-only .insignia-card__content {
          align-items: center;
          display: grid;
          place-items: center;
          margin: 0;
          padding: 0;
          grid-template-columns: 1fr;
          width: 100%;
          height: 100%;
        }

        .insignia-card__icon {
          align-items: center;
          background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.06), transparent 60%),
            ${styles.icon.background};
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 8px 20px rgba(0, 0, 0, 0.14);
          color: ${active ? styles.icon.on_color : (dimIcon ? styles.icon.off_color : "var(--primary-text-color)")};
          display: inline-flex;
          height: ${iconSizePx}px;
          justify-content: center;
          position: relative;
          width: ${iconSizePx}px;
        }

        .insignia-card--icon-only .insignia-card__icon {
          align-self: center;
          justify-self: center;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 0;
          height: 100%;
          margin: 0;
          width: 100%;
        }

        .insignia-card--icon-only .insignia-card__icon {
          background: transparent;
          border: none;
          box-shadow: none;
        }

        .insignia-card__icon img {
          border-radius: 999px;
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .insignia-card__icon ha-icon {
          --mdc-icon-size: ${Math.round(iconSizePx * 0.5)}px;
          height: ${Math.round(iconSizePx * 0.5)}px;
          width: ${Math.round(iconSizePx * 0.5)}px;
        }

        .insignia-card--icon-only .insignia-card__icon ha-icon {
          --mdc-icon-size: var(--icon-only-icon-size);
          height: var(--icon-only-icon-size);
          width: var(--icon-only-icon-size);
          line-height: var(--icon-only-icon-size);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          top: var(--icon-only-offset-y);
          transform: translateY(0) !important;
        }

        .insignia-card__copy {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 4px 8px;
          min-width: 0;
        }

        .insignia-card__title,
        .insignia-card__value {
          line-height: 1.15;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .insignia-card__title {
          color: var(--primary-text-color);
          font-size: ${titleSize};
          font-weight: 700;
        }

        .insignia-card__value {
          color: var(--primary-text-color);
          font-size: ${valueSize};
          font-weight: 600;
        }

        .insignia-card__dot {
          background: color-mix(in srgb, ${tint} 82%, white 18%);
          border-radius: 999px;
          box-shadow: 0 0 0 4px color-mix(in srgb, ${tint} 16%, transparent);
          flex: 0 0 auto;
          height: 7px;
          width: 7px;
        }

        .insignia-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
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
      </style>
      <div class="insignia-card ${iconOnly ? "insignia-card--icon-only" : ""}" style="--icon-only-size: ${iconOnlySize}px; --icon-only-icon-size: ${iconOnlyIconSize}px; --icon-only-offset-y: ${iconOnlyOffsetY}; ${isVisible ? "" : "display:none;"}">
        <div class="insignia-card__content" data-insignia-action="primary">
          <div class="insignia-card__icon">
            ${showPicture
              ? `<img src="${escapeHtml(pictureUrl)}" alt="${escapeHtml(title)}" />`
              : `<ha-icon icon="${escapeHtml(icon)}"></ha-icon>`
            }
            ${unavailable ? '<span class="insignia-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>' : ""}
          </div>
          <div class="insignia-card__copy">
            ${showName ? `<div class="insignia-card__title">${escapeHtml(title)}</div>` : ""}
            ${showName && showValue ? '<span class="insignia-card__dot"></span>' : ""}
            ${showValue ? `<div class="insignia-card__value">${escapeHtml(value)}</div>` : ""}
          </div>
        </div>
      </div>
    `;
  }
}

class NodaliaInsigniaCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._hasActiveInput()) {
      return;
    }
    this._render();
  }

  _emitConfig(config) {
    fireEvent(this, "config-changed", { config });
  }

  _hasActiveInput() {
    const active = this.shadowRoot?.activeElement;
    if (!active) {
      return false;
    }
    return active instanceof HTMLInputElement
      || active instanceof HTMLTextAreaElement
      || active instanceof HTMLSelectElement;
  }

  _updateValue(path, value, options = {}) {
    const nextConfig = deepClone(this._config || {});
    if (options.removeIfEmpty && (value === "" || value === null || value === undefined)) {
      deleteByPath(nextConfig, path);
    } else {
      setByPath(nextConfig, path, value);
    }
    this._config = normalizeConfig(nextConfig);
    if (options.emit !== false) {
      this._emitConfig(compactConfig(this._config));
    }
    if (options.rerender !== false) {
      this._render();
    }
  }

  _handleInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const path = target.dataset?.path;
    if (!path) {
      return;
    }

    if (target instanceof HTMLSelectElement && event.type === "input") {
      return;
    }

    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      this._updateValue(path, target.checked, { rerender: true });
      return;
    }

    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      const isTextInput = (target instanceof HTMLInputElement && target.type === "text")
        || target instanceof HTMLTextAreaElement;
      const isLiveInput = isTextInput && event.type === "input";
      const rerender = !isLiveInput;

      this._updateValue(path, target.value, {
        removeIfEmpty: target.dataset?.removeIfEmpty === "true",
        rerender,
        emit: !isLiveInput,
      });
    }
  }

  _getEntityOptions() {
    if (!this._hass) {
      return [];
    }

    return Object.keys(this._hass.states || {})
      .sort((left, right) => left.localeCompare(right, "es"))
      .map(entityId => `<option value="${escapeHtml(entityId)}">${escapeHtml(entityId)}</option>`)
      .join("");
  }

  _renderTextField(label, path, value = "", options = {}) {
    return `
      <label class="editor-field">
        <span>${escapeHtml(label)}</span>
        <input
          type="text"
          data-path="${escapeHtml(path)}"
          data-remove-if-empty="${options.removeIfEmpty ? "true" : "false"}"
          value="${escapeHtml(value ?? "")}"
        />
      </label>
    `;
  }

  _renderCheckboxField(label, path, checked) {
    return `
      <label class="editor-checkbox">
        <input type="checkbox" data-path="${escapeHtml(path)}" ${checked ? "checked" : ""} />
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  _renderSelectField(label, path, value, options) {
    return `
      <label class="editor-field">
        <span>${escapeHtml(label)}</span>
        <select data-path="${escapeHtml(path)}">
          ${options.map(option => `<option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }

    const config = this._config || normalizeConfig({});

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        * {
          box-sizing: border-box;
        }
        .editor {
          display: grid;
          gap: 14px;
        }
        .editor-section {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 18px;
          display: grid;
          gap: 12px;
          padding: 14px;
        }
        .editor-section h3 {
          color: var(--primary-text-color);
          font-size: 13px;
          font-weight: 700;
          margin: 0;
        }
        .editor-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }
        .editor-field {
          display: grid;
          gap: 6px;
        }
        .editor-field span {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 600;
        }
        .editor-field input,
        .editor-field select,
        .editor-field textarea {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 40px;
          padding: 10px 12px;
        }
        .editor-checkbox {
          align-items: center;
          display: flex;
          gap: 10px;
        }
        .editor-checkbox span {
          color: var(--primary-text-color);
          font-size: 13px;
          font-weight: 600;
        }
      </style>
      <div class="editor">
        <div class="editor-section">
          <h3>Contenido</h3>
          <div class="editor-grid">
            <label class="editor-field">
              <span>Entidad</span>
              <input list="insignia-entities" data-path="entity" value="${escapeHtml(config.entity || "")}" />
              <datalist id="insignia-entities">${this._getEntityOptions()}</datalist>
            </label>
            ${this._renderTextField("Nombre", "name", config.name, { removeIfEmpty: true })}
            ${this._renderTextField("Icono", "icon", config.icon, { removeIfEmpty: true })}
            ${this._renderTextField("Atributo de estado", "state_attribute", config.state_attribute, { removeIfEmpty: true })}
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Usar icono de la entidad", "use_entity_icon", config.use_entity_icon === true)}
            ${this._renderCheckboxField("Usar foto de la entidad", "use_entity_picture", config.use_entity_picture === true)}
            ${this._renderCheckboxField("Mostrar nombre", "show_name", config.show_name !== false)}
            ${this._renderCheckboxField("Mostrar valor", "show_value", config.show_value !== false)}
          </div>
        </div>

        <div class="editor-section">
          <h3>Accion</h3>
          <div class="editor-grid">
            ${this._renderSelectField("Tap action", "tap_action", config.tap_action || "auto", [
              { value: "auto", label: "Auto" },
              { value: "more-info", label: "More info" },
              { value: "toggle", label: "Toggle" },
              { value: "service", label: "Servicio" },
              { value: "url", label: "Abrir URL" },
              { value: "none", label: "Sin accion" },
            ])}
            ${this._renderTextField("Servicio", "tap_service", config.tap_service, { removeIfEmpty: true })}
            ${this._renderTextField("Service data JSON", "tap_service_data", config.tap_service_data, { removeIfEmpty: true })}
            ${this._renderTextField("URL", "tap_url", config.tap_url, { removeIfEmpty: true })}
            ${this._renderCheckboxField("Abrir URL en nueva pestana", "tap_new_tab", config.tap_new_tab === true)}
          </div>
        </div>

        <div class="editor-section">
          <h3>Estilo</h3>
          <div class="editor-grid">
            ${this._renderTextField("Tamano icono", "styles.icon.size", config.styles?.icon?.size || DEFAULT_CONFIG.styles.icon.size)}
            ${this._renderTextField("Tamano nombre", "styles.title_size", config.styles?.title_size || DEFAULT_CONFIG.styles.title_size)}
            ${this._renderTextField("Tamano valor", "styles.value_size", config.styles?.value_size || DEFAULT_CONFIG.styles.value_size)}
            ${this._renderTextField("Padding tarjeta", "styles.card.padding", config.styles?.card?.padding || DEFAULT_CONFIG.styles.card.padding)}
            ${this._renderTextField("Ajuste icono (solo icono)", "styles.icon.icon_only_offset_y", config.styles?.icon?.icon_only_offset_y || DEFAULT_CONFIG.styles.icon.icon_only_offset_y)}
            ${this._renderSelectField("Tinte", "tint_preset", config.tint_preset || "auto", [
              { value: "auto", label: "Auto" },
              { value: "red", label: "Rojo" },
              { value: "orange", label: "Naranja" },
              { value: "yellow", label: "Amarillo" },
              { value: "green", label: "Verde" },
              { value: "blue", label: "Azul" },
              { value: "purple", label: "Morado" },
              { value: "pink", label: "Rosa" },
              { value: "teal", label: "Turquesa" },
              { value: "gray", label: "Gris" },
            ])}
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.querySelectorAll("input, select, textarea").forEach(field => {
      field.addEventListener("input", event => this._handleInput(event));
      field.addEventListener("change", event => this._handleInput(event));
    });
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaInsigniaCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaInsigniaCardEditor);
}

if (Array.isArray(window.customCards)) {
  for (let index = window.customCards.length - 1; index >= 0; index -= 1) {
    if (window.customCards[index]?.type === CARD_TAG) {
      window.customCards.splice(index, 1);
    }
  }
}

window.customBadges = window.customBadges || [];
if (!window.customBadges.some(item => item?.type === CARD_TAG)) {
  window.customBadges.push({
    type: CARD_TAG,
    name: "Nodalia Insignia",
    preview: true,
    description: "Insignia compacta estilo chip burbuja para usar en la zona de badges.",
    documentationURL: "https://developers.home-assistant.io/docs/frontend/custom-ui/custom-badge/",
  });
}
