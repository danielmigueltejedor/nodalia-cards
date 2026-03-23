const CARD_TAG = "nodalia-person-card";
const EDITOR_TAG = "nodalia-person-card-editor";
const CARD_VERSION = "0.9.0";
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
  tap_action: "more-info",
  show_state: true,
  show_zone_badge: true,
  use_entity_picture: true,
  use_zone_icon: true,
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
      padding: "12px",
      gap: "12px",
    },
    avatar: {
      size: "58px",
      background: "rgba(255, 255, 255, 0.06)",
      color: "var(--primary-text-color)",
    },
    badge: {
      size: "20px",
    },
    title_size: "14px",
    subtitle_size: "13px",
  },
};

const STUB_CONFIG = {
  entity: "person.ana",
  name: "Ana",
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

function normalizeConfig(rawConfig) {
  return mergeConfig(DEFAULT_CONFIG, rawConfig || {});
}

class NodaliaPersonCard extends HTMLElement {
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
    this._renderSignature = "";
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
    this._render();
  }

  set hass(hass) {
    this._hass = hass;

    const nextSignature = this._getRenderSignature();
    if (nextSignature && nextSignature === this._renderSignature && this.shadowRoot?.innerHTML) {
      return;
    }

    this._render();
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return {
      rows: 1,
      columns: 6,
      min_rows: 1,
      min_columns: 2,
    };
  }

  _getState() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _getTitle(state) {
    return this._config?.name || state?.attributes?.friendly_name || this._config?.entity || "Persona";
  }

  _getPersonPicture(state) {
    if (this._config?.use_entity_picture === false) {
      return "";
    }

    return String(
      state?.attributes?.entity_picture_local
      || state?.attributes?.entity_picture
      || "",
    ).trim();
  }

  _getFallbackIcon(state) {
    return this._config?.icon || state?.attributes?.icon || "mdi:account";
  }

  _translateState(state) {
    const raw = String(state?.state || "").trim();
    const key = normalizeTextKey(raw);

    switch (key) {
      case "home":
      case "casa":
      case "en_casa":
        return "En casa";
      case "not_home":
      case "away":
      case "fuera":
        return "Fuera";
      case "work":
      case "trabajo":
      case "office":
      case "oficina":
        return "Trabajo";
      case "school":
      case "colegio":
      case "escuela":
        return "Colegio";
      case "unavailable":
        return "No disponible";
      case "unknown":
        return "Desconocido";
      default:
        return raw || "Ubicacion desconocida";
    }
  }

  _getMatchingZoneState(state) {
    const target = normalizeTextKey(state?.state);
    if (!target || !this._hass?.states) {
      return null;
    }

    const zoneEntry = Object.entries(this._hass.states).find(([entityId, entityState]) => {
      if (!entityId.startsWith("zone.")) {
        return false;
      }

      const objectId = entityId.split(".")[1] || "";
      const friendlyName = String(entityState?.attributes?.friendly_name || "").trim();

      return normalizeTextKey(objectId) === target || normalizeTextKey(friendlyName) === target;
    });

    return zoneEntry?.[1] || null;
  }

  _getBadgeDescriptor(state) {
    if (this._config?.show_zone_badge === false) {
      return null;
    }

    if (isUnavailableState(state)) {
      return {
        icon: "mdi:help",
        color: "#ff9b4a",
      };
    }

    const key = normalizeTextKey(state?.state);

    switch (key) {
      case "home":
      case "casa":
      case "en_casa":
        return { icon: "mdi:home", color: "#67d26f" };
      case "not_home":
      case "away":
      case "fuera":
        return { icon: "mdi:home-export-outline", color: "#ff6b6b" };
      case "work":
      case "trabajo":
      case "office":
      case "oficina":
        return { icon: "mdi:briefcase", color: "#4dabf7" };
      case "school":
      case "colegio":
      case "escuela":
        return { icon: "mdi:school", color: "#8c7bff" };
      default:
        break;
    }

    const zoneState = this._getMatchingZoneState(state);
    if (this._config?.use_zone_icon !== false && zoneState?.attributes?.icon) {
      return {
        icon: zoneState.attributes.icon,
        color: "var(--info-color, #71c0ff)",
      };
    }

    if (String(state?.state || "").trim()) {
      return {
        icon: "mdi:map-marker",
        color: "var(--info-color, #71c0ff)",
      };
    }

    return null;
  }

  _getAccentColor(state) {
    return this._getBadgeDescriptor(state)?.color || "var(--info-color, #71c0ff)";
  }

  _getRenderSignature() {
    const state = this._getState();
    if (!this._config?.entity || !state) {
      return `empty:${this._config?.entity || ""}`;
    }

    const title = this._getTitle(state);
    const subtitle = this._config.show_state !== false ? this._translateState(state) : "";
    const picture = this._getPersonPicture(state);
    const fallbackIcon = this._getFallbackIcon(state);
    const badge = this._getBadgeDescriptor(state);
    const zoneState = this._getMatchingZoneState(state);

    return JSON.stringify({
      entity: this._config.entity,
      state: state.state,
      title,
      subtitle,
      picture,
      fallbackIcon,
      badgeIcon: badge?.icon || "",
      badgeColor: badge?.color || "",
      zoneEntity: zoneState?.entity_id || "",
      zoneIcon: zoneState?.attributes?.icon || "",
      showState: this._config.show_state !== false,
      showZoneBadge: this._config.show_zone_badge !== false,
      useEntityPicture: this._config.use_entity_picture !== false,
      useZoneIcon: this._config.use_zone_icon !== false,
      name: this._config.name || "",
      icon: this._config.icon || "",
    });
  }

  _canRunTapAction() {
    const action = String(this._config?.tap_action || "more-info");
    if (action === "none") {
      return false;
    }

    return Boolean(this._config?.entity);
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

  _performTapAction() {
    const action = String(this._config?.tap_action || "more-info");
    if (action === "none") {
      return;
    }

    this._triggerHaptic();

    if (action === "more-info") {
      fireEvent(this, "hass-more-info", {
        entityId: this._config.entity,
      });
    }
  }

  _onShadowClick(event) {
    const card = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.personAction === "primary");

    if (!card) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._performTapAction();
  }

  _renderEmptyState() {
    return `
      <ha-card class="person-card person-card--empty">
        <div class="person-card__empty-title">Nodalia Person Card</div>
        <div class="person-card__empty-text">Configura \`entity\` para mostrar la tarjeta.</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const state = this._getState();
    if (!this._config?.entity || !state) {
      this._renderSignature = `empty:${this._config?.entity || ""}`;
      this.shadowRoot.innerHTML = this._renderEmptyState();
      return;
    }

    const config = this._config;
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const configuredRows = Number(this._config?.grid_options?.rows);
    const singleRowLayout = Number.isFinite(configuredRows) ? configuredRows <= 1 : true;
    const title = this._getTitle(state);
    const subtitle = config.show_state !== false ? this._translateState(state) : "";
    const picture = this._getPersonPicture(state);
    const fallbackIcon = this._getFallbackIcon(state);
    const badge = this._getBadgeDescriptor(state);
    const accentColor = this._getAccentColor(state);
    const canRunPrimaryAction = this._canRunTapAction();
    const singleRowPaddingY = singleRowLayout ? 4 : 12;
    const singleRowPaddingX = singleRowLayout ? 9 : 12;
    const avatarSizePx = Math.max(34, Math.min(parseSizeToPixels(styles.avatar.size, 58), singleRowLayout ? 38 : 68));
    const avatarSize = `${avatarSizePx}px`;
    const avatarTrackSize = `${avatarSizePx + (singleRowLayout ? 7 : 12)}px`;
    const badgeSize = `${Math.max(15, Math.min(parseSizeToPixels(styles.badge.size, 20), singleRowLayout ? 16 : 24))}px`;
    const effectiveTitleSize = `${Math.max(10, Math.min(parseSizeToPixels(styles.title_size, 14), singleRowLayout ? 10.5 : 14))}px`;
    const effectiveSubtitleSize = `${Math.max(9, Math.min(parseSizeToPixels(styles.subtitle_size, 13), singleRowLayout ? 9.5 : 13))}px`;
    const effectiveStateChipHeight = `${singleRowLayout ? 18 : 22}px`;
    const effectiveStateChipPadding = singleRowLayout ? "0 8px" : "0 10px";
    const effectiveGap = singleRowLayout ? "6px" : styles.card.gap;
    const effectivePadding = singleRowLayout ? `${singleRowPaddingY}px ${singleRowPaddingX}px` : styles.card.padding;
    const effectiveCardHeightPx = singleRowLayout ? Math.max(54, avatarSizePx + (singleRowPaddingY * 2)) : avatarSizePx + (singleRowPaddingY * 2);
    const effectiveContentMinHeight = `${Math.max(avatarSizePx, effectiveCardHeightPx - (singleRowPaddingY * 2))}px`;
    const isUnavailable = isUnavailableState(state);
    const cardBackground = isUnavailable
      ? styles.card.background
      : `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 7%, ${styles.card.background}) 56%, ${styles.card.background} 100%)`;
    const cardBorder = isUnavailable
      ? styles.card.border
      : `1px solid color-mix(in srgb, ${accentColor} 22%, var(--divider-color))`;
    const cardShadow = isUnavailable
      ? styles.card.box_shadow
      : `${styles.card.box_shadow}, 0 12px 28px color-mix(in srgb, ${accentColor} 10%, rgba(0, 0, 0, 0.16))`;

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
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0));
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .person-card__content {
          align-items: center;
          cursor: ${canRunPrimaryAction ? "pointer" : "default"};
          display: grid;
          gap: ${effectiveGap};
          grid-template-columns: ${avatarTrackSize} minmax(0, 1fr);
          min-height: ${effectiveContentMinHeight};
          min-width: 0;
          padding: ${effectivePadding};
          position: relative;
          z-index: 1;
        }

        .person-card--single-row {
          min-height: ${effectiveCardHeightPx}px;
        }

        .person-card__avatar {
          align-items: center;
          background: ${styles.avatar.background};
          border: 1px solid color-mix(in srgb, ${accentColor} 16%, rgba(255, 255, 255, 0.08));
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${styles.avatar.color};
          display: inline-flex;
          height: ${avatarSize};
          justify-content: center;
          overflow: visible;
          position: relative;
          width: ${avatarSize};
        }

        .person-card__avatar img {
          border-radius: inherit;
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .person-card__avatar ha-icon {
          --mdc-icon-size: calc(${avatarSize} * 0.5);
        }

        .person-card__badge {
          align-items: center;
          background: var(--badge-color);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          box-shadow:
            0 6px 14px rgba(0, 0, 0, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.14);
          color: #ffffff;
          display: inline-flex;
          height: ${badgeSize};
          justify-content: center;
          position: absolute;
          right: 0;
          top: 0;
          transform: translate(28%, -28%);
          width: ${badgeSize};
          z-index: 2;
        }

        .person-card__badge ha-icon {
          --mdc-icon-size: calc(${badgeSize} * 0.56);
          align-items: center;
          display: inline-flex;
          height: calc(${badgeSize} * 0.56);
          justify-content: center;
          width: calc(${badgeSize} * 0.56);
        }

        .person-card__copy {
          display: grid;
          gap: ${singleRowLayout ? "4px" : "6px"};
          min-width: 0;
        }

        .person-card__title {
          font-size: ${effectiveTitleSize};
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: ${singleRowLayout ? "1.02" : "1.12"};
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .person-card__chips {
          align-items: center;
          display: flex;
          flex-wrap: nowrap;
          gap: 4px;
          min-width: 0;
        }

        .person-card__state-chip {
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: ${effectiveSubtitleSize};
          font-weight: 700;
          height: ${effectiveStateChipHeight};
          line-height: 1;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding: ${effectiveStateChipPadding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .person-card--empty {
          display: grid;
          gap: 8px;
          padding: 16px;
        }

        .person-card__empty-title {
          font-size: 15px;
          font-weight: 700;
        }

        .person-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }
      </style>
      <ha-card class="person-card ${singleRowLayout ? "person-card--single-row" : ""}">
        <div class="person-card__content" ${canRunPrimaryAction ? 'data-person-action="primary"' : ""}>
          <div class="person-card__avatar">
            ${
              picture
                ? `<img src="${escapeHtml(picture)}" alt="${escapeHtml(title)}" />`
                : `<ha-icon icon="${escapeHtml(fallbackIcon)}"></ha-icon>`
            }
            ${
              badge
                ? `<span class="person-card__badge" style="--badge-color:${escapeHtml(badge.color)};"><ha-icon icon="${escapeHtml(badge.icon)}"></ha-icon></span>`
                : ""
            }
          </div>
          <div class="person-card__copy">
            <div class="person-card__title">${escapeHtml(title)}</div>
            ${subtitle ? `<div class="person-card__chips"><div class="person-card__state-chip">${escapeHtml(subtitle)}</div></div>` : ""}
          </div>
        </div>
      </ha-card>
    `;
    this._renderSignature = this._getRenderSignature();
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaPersonCard);
}

class NodaliaPersonCardEditor extends HTMLElement {
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
      .filter(entityId => entityId.startsWith("person.") || entityId.startsWith("device_tracker."))
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
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement);

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

  _getEntityOptionsMarkup() {
    const entityIds = Object.keys(this._hass?.states || {})
      .filter(entityId => entityId.startsWith("person.") || entityId.startsWith("device_tracker."))
      .sort((left, right) => left.localeCompare(right, "es"));

    return `
      <datalist id="person-card-entities">
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
            <div class="editor-section__hint">Entidad persona, foto, badge de zona y accion principal.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Entidad", "entity", config.entity, {
              placeholder: "person.rocio",
            })}
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Rocio",
            })}
            ${this._renderTextField("Icono fallback", "icon", config.icon, {
              placeholder: "mdi:account",
            })}
            ${this._renderSelectField(
              "Accion al tocar",
              "tap_action",
              config.tap_action || "more-info",
              [
                { value: "more-info", label: "More info" },
                { value: "none", label: "Sin accion" },
              ],
            )}
            ${this._renderCheckboxField("Mostrar ubicacion", "show_state", config.show_state !== false)}
            ${this._renderCheckboxField("Mostrar badge de zona", "show_zone_badge", config.show_zone_badge !== false)}
            ${this._renderCheckboxField("Usar foto de entidad", "use_entity_picture", config.use_entity_picture !== false)}
            ${this._renderCheckboxField("Usar icono de zona", "use_zone_icon", config.use_zone_icon !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Haptics</div>
            <div class="editor-section__hint">Respuesta haptica al tocar la tarjeta.</div>
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
            ${this._renderTextField("Tamano avatar", "styles.avatar.size", config.styles.avatar.size)}
            ${this._renderTextField("Tamano badge", "styles.badge.size", config.styles.badge.size)}
            ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
            ${this._renderTextField("Tamano subtitulo", "styles.subtitle_size", config.styles.subtitle_size)}
          </div>
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot.querySelectorAll('input[data-field="entity"]').forEach(input => {
      input.setAttribute("list", "person-card-entities");
    });
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaPersonCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Person Card",
  description: "Tarjeta compacta de persona con foto y zona",
  preview: true,
});
