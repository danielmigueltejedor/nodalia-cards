const CARD_TAG = "nodalia-calendar-card";
const EDITOR_TAG = "nodalia-calendar-card-editor";
const CARD_VERSION = "0.16.0";
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
  show_status_chip: true,
  show_date_chip: true,
  show_time_chip: true,
  show_location_chip: true,
  show_description: true,
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
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    title_size: "14px",
    event_size: "25px",
    meta_size: "13px",
    description_size: "12px",
  },
};

const STUB_CONFIG = {
  entity: "calendar.casa",
  name: "Calendario",
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

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function isSameDay(left, right) {
  if (!(left instanceof Date) || !(right instanceof Date)) {
    return false;
  }

  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatShortDate(date) {
  if (!(date instanceof Date)) {
    return null;
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  }).format(date).replace(/\./g, "");
}

function formatLongDate(date) {
  if (!(date instanceof Date)) {
    return null;
  }

  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date).replace(/\./g, "");
}

function formatTime(date) {
  if (!(date instanceof Date)) {
    return null;
  }

  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getRelativeDateLabel(date) {
  if (!(date instanceof Date)) {
    return null;
  }

  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diff === 0) {
    return "Hoy";
  }

  if (diff === 1) {
    return "Mañana";
  }

  if (diff === -1) {
    return "Ayer";
  }

  return formatShortDate(date);
}

function getCalendarAccent(state) {
  if (isUnavailableState(state)) {
    return "#ff9b4a";
  }

  if (normalizeTextKey(state?.state) === "on") {
    return "#8f7dff";
  }

  return "#f4ad4a";
}

function getCalendarStatusLabel(state, startDate) {
  if (isUnavailableState(state)) {
    return "No disponible";
  }

  if (normalizeTextKey(state?.state) === "on") {
    return "En curso";
  }

  if (startDate) {
    return "Próximo";
  }

  return "Sin eventos";
}

function getCalendarDefaultIcon() {
  return "mdi:calendar-month-outline";
}

function normalizeConfig(rawConfig) {
  return mergeConfig(DEFAULT_CONFIG, rawConfig || {});
}

class NodaliaCalendarCard extends HTMLElement {
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
    return 2;
  }

  _getState() {
    return this._hass?.states?.[this._config?.entity] || null;
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
      message: String(attrs.message || ""),
      startTime: String(attrs.start_time || ""),
      endTime: String(attrs.end_time || ""),
      location: String(attrs.location || ""),
      description: String(attrs.description || ""),
      allDay: Boolean(attrs.all_day),
    });
  }

  _getTitle(state) {
    const customName = String(this._config?.name || "").trim();
    if (customName) {
      return customName;
    }

    const friendlyName = String(state?.attributes?.friendly_name || "").trim();
    return friendlyName || "Calendario";
  }

  _getEventTitle(state) {
    const message = String(state?.attributes?.message || "").trim();
    if (message) {
      return message;
    }

    return "Sin próximos eventos";
  }

  _getDescription(state) {
    const description = String(state?.attributes?.description || "").trim();
    return description || "";
  }

  _getLocation(state) {
    const location = String(state?.attributes?.location || "").trim();
    return location || "";
  }

  _getIcon(state) {
    const customIcon = String(this._config?.icon || "").trim();
    if (customIcon) {
      return customIcon;
    }

    const entityIcon = String(state?.attributes?.icon || "").trim();
    return entityIcon || getCalendarDefaultIcon();
  }

  _getStartDate(state) {
    return parseDateValue(state?.attributes?.start_time);
  }

  _getEndDate(state) {
    return parseDateValue(state?.attributes?.end_time);
  }

  _isAllDay(state) {
    return state?.attributes?.all_day === true;
  }

  _getStatusLabel(state, startDate) {
    return getCalendarStatusLabel(state, startDate);
  }

  _getAccentColor(state) {
    return getCalendarAccent(state);
  }

  _formatDateChip(startDate) {
    return getRelativeDateLabel(startDate);
  }

  _formatTimeChip(startDate, endDate, allDay) {
    if (!startDate) {
      return null;
    }

    if (allDay) {
      return "Todo el día";
    }

    const startLabel = formatTime(startDate);
    const endLabel = formatTime(endDate);

    if (startLabel && endLabel) {
      return `${startLabel} · ${endLabel}`;
    }

    return startLabel;
  }

  _formatMetaLine(startDate, endDate, allDay) {
    if (!startDate) {
      return "No hay eventos próximos.";
    }

    const dateLabel = getRelativeDateLabel(startDate) || formatLongDate(startDate);

    if (allDay) {
      return dateLabel ? `${dateLabel} · Todo el día` : "Todo el día";
    }

    const startLabel = formatTime(startDate);
    if (!startLabel) {
      return dateLabel || "";
    }

    const sameDay = isSameDay(startDate, endDate);
    const endLabel = formatTime(endDate);

    if (endLabel && sameDay) {
      return `${dateLabel} · ${startLabel} - ${endLabel}`;
    }

    if (endDate && !sameDay) {
      return `${dateLabel} · ${startLabel} - ${formatShortDate(endDate)} ${endLabel || ""}`.trim();
    }

    return dateLabel ? `${dateLabel} · ${startLabel}` : startLabel;
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
    const card = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.calendarCard === "root");
    if (!card) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._performTapAction();
  }

  _renderChip(icon, label, accentColor) {
    if (!label) {
      return "";
    }

    return `
      <div class="calendar-card__chip" style="--chip-accent:${escapeHtml(accentColor)};">
        <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
        <span>${escapeHtml(label)}</span>
      </div>
    `;
  }

  _renderEmptyState() {
    return `
      <ha-card class="calendar-card calendar-card--empty">
        <div class="calendar-card__empty-title">Nodalia Calendar Card</div>
        <div class="calendar-card__empty-text">Configura \`entity\` para mostrar un calendario.</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const state = this._getState();
    if (!this._config?.entity || !state) {
      this.shadowRoot.innerHTML = this._renderEmptyState();
      return;
    }

    const config = this._config;
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const title = this._getTitle(state);
    const eventTitle = this._getEventTitle(state);
    const description = this._getDescription(state);
    const location = this._getLocation(state);
    const startDate = this._getStartDate(state);
    const endDate = this._getEndDate(state);
    const allDay = this._isAllDay(state);
    const icon = this._getIcon(state);
    const accentColor = this._getAccentColor(state);
    const statusLabel = this._getStatusLabel(state, startDate);
    const metaLabel = this._formatMetaLine(startDate, endDate, allDay);
    const isLightTheme = this._hass?.themes?.darkMode === false;
    const showUnavailableBadge = isUnavailableState(state);
    const chips = [
      config.show_status_chip !== false
        ? this._renderChip("mdi:calendar-check-outline", statusLabel, accentColor)
        : "",
      config.show_date_chip !== false
        ? this._renderChip("mdi:calendar", this._formatDateChip(startDate), accentColor)
        : "",
      config.show_time_chip !== false
        ? this._renderChip("mdi:clock-outline", this._formatTimeChip(startDate, endDate, allDay), accentColor)
        : "",
      config.show_location_chip !== false
        ? this._renderChip("mdi:map-marker-outline", location, accentColor)
        : "",
    ].filter(Boolean);
    const tapEnabled = String(config.tap_action || "more-info") !== "none";
    const cardBackground = isLightTheme
      ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 4%, rgba(255, 255, 255, 0.98)) 0%, color-mix(in srgb, ${accentColor} 2%, rgba(255, 255, 255, 0.95)) 100%)`
      : `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 11%, rgba(255, 255, 255, 0.04)), rgba(255, 255, 255, 0) 44%), linear-gradient(135deg, color-mix(in srgb, ${accentColor} 16%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 8%, ${styles.card.background}) 56%, ${styles.card.background} 100%)`;
    const cardBorder = isLightTheme
      ? `1px solid color-mix(in srgb, ${accentColor} 16%, rgba(15, 23, 42, 0.1))`
      : `1px solid color-mix(in srgb, ${accentColor} 28%, var(--divider-color))`;
    const cardShadow = isLightTheme
      ? `${styles.card.box_shadow}, 0 12px 24px color-mix(in srgb, ${accentColor} 2%, rgba(15, 23, 42, 0.12)), 0 2px 6px rgba(15, 23, 42, 0.06)`
      : `${styles.card.box_shadow}, 0 16px 32px color-mix(in srgb, ${accentColor} 10%, rgba(0, 0, 0, 0.18))`;
    const surfaceBackground = isLightTheme
      ? "linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 255, 255, 0.9) 100%)"
      : "rgba(255, 255, 255, 0.06)";
    const surfaceBorder = isLightTheme ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)";
    const surfaceInset = isLightTheme ? "rgba(255, 255, 255, 0.92)" : "rgba(255, 255, 255, 0.05)";
    const surfaceShadow = isLightTheme
      ? "0 8px 18px rgba(15, 23, 42, 0.08), 0 2px 5px rgba(15, 23, 42, 0.05)"
      : "0 14px 28px rgba(0, 0, 0, 0.14)";

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

        .calendar-card__content {
          cursor: ${tapEnabled ? "pointer" : "default"};
          display: grid;
          gap: ${styles.card.gap};
          min-width: 0;
          padding: ${styles.card.padding};
          position: relative;
          z-index: 1;
        }

        .calendar-card__hero {
          align-items: start;
          display: grid;
          gap: 12px;
          grid-template-columns: ${styles.icon.size} minmax(0, 1fr);
          min-width: 0;
        }

        .calendar-card__icon {
          align-items: center;
          background: ${surfaceBackground};
          border: 1px solid ${surfaceBorder};
          border-radius: 22px;
          box-shadow:
            inset 0 1px 0 ${surfaceInset},
            ${surfaceShadow};
          color: ${styles.icon.color};
          display: inline-flex;
          height: ${styles.icon.size};
          justify-content: center;
          position: relative;
          width: ${styles.icon.size};
        }

        .calendar-card__icon ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.5);
        }

        .calendar-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${isLightTheme ? "rgba(255, 255, 255, 0.94)" : styles.card.background};
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

        .calendar-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          width: 11px;
        }

        .calendar-card__copy {
          display: grid;
          gap: 10px;
          min-width: 0;
        }

        .calendar-card__header {
          align-items: start;
          display: flex;
          gap: 10px;
          justify-content: space-between;
          min-width: 0;
        }

        .calendar-card__title {
          font-size: ${styles.title_size};
          font-weight: 700;
          line-height: 1.2;
          min-width: 0;
        }

        .calendar-card__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .calendar-card__chip {
          align-items: center;
          background: ${surfaceBackground};
          border: 1px solid color-mix(in srgb, var(--chip-accent) 14%, ${surfaceBorder});
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 ${surfaceInset},
            ${isLightTheme ? "0 8px 20px rgba(15, 23, 42, 0.06)" : "none"};
          color: var(--primary-text-color);
          display: inline-flex;
          gap: 6px;
          height: ${styles.chip_height};
          line-height: 1;
          max-width: 100%;
          overflow: hidden;
          padding: ${styles.chip_padding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .calendar-card__chip ha-icon {
          --mdc-icon-size: 13px;
          color: var(--chip-accent);
          flex: 0 0 auto;
        }

        .calendar-card__chip span {
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .calendar-card__body {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .calendar-card__event {
          font-size: ${styles.event_size};
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.05;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .calendar-card__meta {
          color: var(--secondary-text-color);
          font-size: ${styles.meta_size};
          font-weight: 600;
          line-height: 1.35;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .calendar-card__description {
          color: var(--secondary-text-color);
          font-size: ${styles.description_size};
          line-height: 1.5;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .calendar-card--empty {
          display: grid;
          gap: 8px;
          padding: 16px;
        }

        .calendar-card__empty-title {
          font-size: 15px;
          font-weight: 700;
        }

        .calendar-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }

        @media (max-width: 520px) {
          .calendar-card__header {
            align-items: start;
            flex-direction: column;
          }

          .calendar-card__chips {
            justify-content: flex-start;
          }
        }
      </style>
      <ha-card class="calendar-card">
        <div class="calendar-card__content" data-calendar-card="root">
          <div class="calendar-card__hero">
            <div class="calendar-card__icon">
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
              ${showUnavailableBadge ? `<span class="calendar-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </div>
            <div class="calendar-card__copy">
              <div class="calendar-card__header">
                <div class="calendar-card__title">${escapeHtml(title)}</div>
                ${chips.length ? `<div class="calendar-card__chips">${chips.join("")}</div>` : ""}
              </div>
              <div class="calendar-card__body">
                <div class="calendar-card__event">${escapeHtml(eventTitle)}</div>
                <div class="calendar-card__meta">${escapeHtml(metaLabel)}</div>
                ${config.show_description !== false && description ? `<div class="calendar-card__description">${escapeHtml(description)}</div>` : ""}
              </div>
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCalendarCard);
}

class NodaliaCalendarCardEditor extends HTMLElement {
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
      .filter(entityId => entityId.startsWith("calendar."))
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
      .filter(entityId => entityId.startsWith("calendar."))
      .sort((left, right) => left.localeCompare(right, "es"));

    return `
      <datalist id="calendar-card-entities">
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
            <div class="editor-section__hint">Entidad de calendario principal y contenido visible.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Entidad", "entity", config.entity, {
              placeholder: "calendar.casa",
            })}
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Calendario",
            })}
            ${this._renderTextField("Icono", "icon", config.icon, {
              placeholder: "mdi:calendar-month-outline",
            })}
            ${this._renderSelectField(
              "Acción al tocar",
              "tap_action",
              config.tap_action || "more-info",
              [
                { value: "more-info", label: "More info" },
                { value: "none", label: "Sin acción" },
              ],
            )}
            ${this._renderCheckboxField("Mostrar chip estado", "show_status_chip", config.show_status_chip !== false)}
            ${this._renderCheckboxField("Mostrar chip fecha", "show_date_chip", config.show_date_chip !== false)}
            ${this._renderCheckboxField("Mostrar chip hora", "show_time_chip", config.show_time_chip !== false)}
            ${this._renderCheckboxField("Mostrar chip ubicación", "show_location_chip", config.show_location_chip !== false)}
            ${this._renderCheckboxField("Mostrar descripción", "show_description", config.show_description !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Haptics</div>
            <div class="editor-section__hint">Respuesta háptica al tocar la tarjeta.</div>
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
            <div class="editor-section__hint">Ajustes visuales base de la tarjeta.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Background", "styles.card.background", config.styles.card.background)}
            ${this._renderTextField("Border", "styles.card.border", config.styles.card.border)}
            ${this._renderTextField("Radius", "styles.card.border_radius", config.styles.card.border_radius)}
            ${this._renderTextField("Shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
            ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
            ${this._renderTextField("Separación", "styles.card.gap", config.styles.card.gap)}
            ${this._renderTextField("Tamaño icono", "styles.icon.size", config.styles.icon.size)}
            ${this._renderTextField("Tamaño título", "styles.title_size", config.styles.title_size)}
            ${this._renderTextField("Tamaño evento", "styles.event_size", config.styles.event_size)}
            ${this._renderTextField("Tamaño meta", "styles.meta_size", config.styles.meta_size)}
            ${this._renderTextField("Tamaño descripción", "styles.description_size", config.styles.description_size)}
            ${this._renderTextField("Alto burbuja info", "styles.chip_height", config.styles.chip_height)}
            ${this._renderTextField("Texto burbuja info", "styles.chip_font_size", config.styles.chip_font_size)}
            ${this._renderTextField("Padding burbuja info", "styles.chip_padding", config.styles.chip_padding)}
          </div>
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot.querySelectorAll('input[data-field="entity"]').forEach(input => {
      input.setAttribute("list", "calendar-card-entities");
    });
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCalendarCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Calendar Card",
  description: "Tarjeta elegante de calendario para Home Assistant",
  preview: true,
});
