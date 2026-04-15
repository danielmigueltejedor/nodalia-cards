const CARD_TAG = "nodalia-circular-gauge-card";
const EDITOR_TAG = "nodalia-circular-gauge-card-editor";
const CARD_VERSION = "0.11.0";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
const DIAL_START_ANGLE = 135;
const DIAL_END_ANGLE = 405;
const DIAL_SWEEP = DIAL_END_ANGLE - DIAL_START_ANGLE;
const DIAL_VIEWBOX_SIZE = 240;
const DIAL_CIRCLE_RADIUS = 86;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_CIRCLE_RADIUS;
const DIAL_VISIBLE_LENGTH = DIAL_CIRCUMFERENCE * (DIAL_SWEEP / 360);
const DIAL_HIDDEN_LENGTH = DIAL_CIRCUMFERENCE - DIAL_VISIBLE_LENGTH;

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  min: "",
  max: "",
  min_label: "",
  max_label: "",
  unit: "",
  decimals: "",
  start_from_zero: true,
  show_header: true,
  show_name: true,
  show_icon: true,
  show_name_chip: true,
  show_percentage_chip: false,
  show_range_labels: true,
  show_unavailable_badge: true,
  show_bottom_icon_bubble: false,
  tap_action: "more-info",
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "30px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "16px",
      gap: "14px",
    },
    icon: {
      size: "58px",
      background: "rgba(255, 255, 255, 0.06)",
      color: "var(--primary-text-color)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 10px",
    title_size: "16px",
    value_size: "52px",
    range_size: "14px",
    name_chip_max_width: "170px",
    gauge: {
      size: "280px",
      stroke: "18px",
      thumb_size: "22px",
      track_color: "rgba(255, 255, 255, 0.08)",
      background: "rgba(255, 255, 255, 0.02)",
      foreground_color: "",
    },
  },
};

const STUB_CONFIG = {
  entity: "sensor.enchufe_inteligente_potencia",
  name: "Potencia",
  min: 0,
  max: 2500,
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

function getStepPrecision(step) {
  const text = String(step ?? "");
  if (!text.includes(".")) {
    return 0;
  }

  return text.split(".")[1].length;
}

function inferDecimals(rawValue) {
  const text = String(rawValue ?? "").trim();
  const normalized = text.replace(",", ".");
  if (!normalized.includes(".")) {
    return 0;
  }

  return Math.min(3, normalized.split(".")[1].length);
}

function formatNumberValue(value, decimals = 0) {
  if (!Number.isFinite(Number(value))) {
    return "--";
  }

  return Number(value).toLocaleString("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function normalizeConfig(rawConfig) {
  return mergeConfig(DEFAULT_CONFIG, rawConfig || {});
}

function inferReasonableMax(currentValue, unit, state) {
  const normalizedUnit = normalizeTextKey(unit);
  const domainHint = `${state?.entity_id || ""} ${state?.attributes?.device_class || ""} ${state?.attributes?.friendly_name || ""}`.toLowerCase();

  if (normalizedUnit === "%" || domainHint.includes("battery") || domainHint.includes("humidity")) {
    return 100;
  }

  if (["w", "watt", "watts", "va"].includes(normalizedUnit) || domainHint.includes("power") || domainHint.includes("potencia")) {
    return 2500;
  }

  if (["kw"].includes(normalizedUnit)) {
    return 10;
  }

  if (["a", "ma"].includes(normalizedUnit) || domainHint.includes("current") || domainHint.includes("corriente")) {
    return normalizedUnit === "ma" ? 3000 : 32;
  }

  if (["v", "mv"].includes(normalizedUnit) || domainHint.includes("voltage") || domainHint.includes("tension")) {
    return normalizedUnit === "mv" ? 1000 : 260;
  }

  if (
    normalizedUnit.includes("l_s")
    || normalizedUnit.includes("l_min")
    || normalizedUnit.includes("m3_h")
    || domainHint.includes("water")
    || domainHint.includes("agua")
    || domainHint.includes("caudal")
    || domainHint.includes("flow")
  ) {
    if (normalizedUnit.includes("l_s")) {
      return 10;
    }
    if (normalizedUnit.includes("l_min")) {
      return 60;
    }
    if (normalizedUnit.includes("m3_h")) {
      return 10;
    }
    return 100;
  }

  if (["c", "f", "degc", "degf"].includes(normalizedUnit) || domainHint.includes("temperature") || domainHint.includes("temperatura")) {
    return 40;
  }

  if (["bar", "hpa", "pa"].includes(normalizedUnit) || domainHint.includes("pressure") || domainHint.includes("presion")) {
    return 1200;
  }

  if (Number.isFinite(currentValue)) {
    if (currentValue <= 10) return 10;
    if (currentValue <= 50) return 50;
    if (currentValue <= 100) return 100;
    if (currentValue <= 250) return 250;
    if (currentValue <= 500) return 500;
    if (currentValue <= 1000) return 1000;
    if (currentValue <= 2500) return 2500;
    if (currentValue <= 5000) return 5000;
    if (currentValue <= 10000) return 10000;
  }

  return 100;
}

class NodaliaCircularGaugeCard extends HTMLElement {
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
    this.shadowRoot.addEventListener("click", this._onShadowClick);
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
    return 3;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 5,
      min_columns: 6,
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
      state: String(state?.state || ""),
      friendlyName: String(attrs.friendly_name || ""),
      icon: String(attrs.icon || ""),
      unit: String(attrs.unit_of_measurement || attrs.native_unit_of_measurement || ""),
      rows: Number(this._config?.grid_options?.rows || 0),
      columns: Number(this._config?.grid_options?.columns || 0),
    });
  }

  _getConfiguredGridRows() {
    const numericRows = Number(this._config?.grid_options?.rows);
    return Number.isFinite(numericRows) ? numericRows : null;
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) ? numericColumns : null;
  }

  _getCompactLevel() {
    const configuredRows = this._getConfiguredGridRows();
    const configuredColumns = this._getConfiguredGridColumns();

    if (
      (configuredRows !== null && configuredRows <= 3)
      || (configuredColumns !== null && configuredColumns <= 6)
    ) {
      return "compact";
    }

    return "default";
  }

  _getTitle(state) {
    return this._config?.name
      || state?.attributes?.friendly_name
      || this._config?.entity
      || "Gauge";
  }

  _getIcon(state) {
    return this._config?.icon
      || state?.attributes?.icon
      || "mdi:gauge";
  }

  _getUnit(state) {
    return String(
      this._config?.unit
      || state?.attributes?.unit_of_measurement
      || state?.attributes?.native_unit_of_measurement
      || "",
    ).trim();
  }

  _getNumericValue(state) {
    const direct = Number(String(state?.state ?? "").replace(",", "."));
    if (Number.isFinite(direct)) {
      return direct;
    }

    const nativeValue = Number(state?.attributes?.native_value);
    return Number.isFinite(nativeValue) ? nativeValue : null;
  }

  _getDecimals(state) {
    const configured = Number(this._config?.decimals);
    if (Number.isFinite(configured) && configured >= 0) {
      return Math.min(3, configured);
    }

    const rawState = String(state?.state ?? "").trim();
    return inferDecimals(rawState);
  }

  _getRange(state, currentValue) {
    const configuredMin = Number(this._config?.min);
    const configuredMax = Number(this._config?.max);
    const attrMin = Number(state?.attributes?.min);
    const attrMax = Number(state?.attributes?.max);
    const unit = this._getUnit(state);

    const min = Number.isFinite(configuredMin)
      ? configuredMin
      : Number.isFinite(attrMin)
        ? attrMin
        : this._config?.start_from_zero === false && Number.isFinite(currentValue) && currentValue < 0
          ? Math.floor(currentValue)
          : 0;

    let max = Number.isFinite(configuredMax)
      ? configuredMax
      : Number.isFinite(attrMax)
        ? attrMax
        : inferReasonableMax(currentValue, unit, state);

    if (!Number.isFinite(max) || max <= min) {
      max = min + 100;
    }

    return { min, max };
  }

  _getRangeLabel(boundary, range, state) {
    const configuredLabel = String(
      boundary === "min" ? this._config?.min_label ?? "" : this._config?.max_label ?? "",
    ).trim();

    if (configuredLabel) {
      return configuredLabel;
    }

    return formatNumberValue(boundary === "min" ? range.min : range.max, this._getDecimals(state));
  }

  _getAccentColor(state, ratio) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const configuredColor = String(styles?.gauge?.foreground_color || "").trim();
    if (configuredColor) {
      return configuredColor;
    }

    const unit = normalizeTextKey(this._getUnit(state));
    const entityHint = `${this._config?.entity || ""} ${state?.attributes?.device_class || ""} ${state?.attributes?.friendly_name || ""}`.toLowerCase();

    if (
      unit.includes("l_s")
      || unit.includes("l_min")
      || unit.includes("m3_h")
      || entityHint.includes("water")
      || entityHint.includes("agua")
      || entityHint.includes("caudal")
      || entityHint.includes("flow")
    ) {
      return "#62b9ff";
    }

    if (unit === "%" || entityHint.includes("humid")) {
      return "#7fd0c8";
    }

    if (
      ["w", "kw", "va"].includes(unit)
      || entityHint.includes("power")
      || entityHint.includes("potencia")
      || entityHint.includes("consumo")
    ) {
      return ratio >= 0.85 ? "#ff7d57" : ratio >= 0.55 ? "#f5a03d" : "#d9c45a";
    }

    if (["a", "ma", "v", "mv"].includes(unit) || entityHint.includes("corriente") || entityHint.includes("tension")) {
      return "#71c0ff";
    }

    if (unit.includes("c") || unit.includes("f") || entityHint.includes("temperatura")) {
      return "#f59f42";
    }

    if (entityHint.includes("pressure") || entityHint.includes("presion")) {
      return "#b993ff";
    }

    return "var(--primary-color)";
  }

  _formatValue(value, state, withUnit = false) {
    const decimals = this._getDecimals(state);
    const formatted = formatNumberValue(value, decimals);
    if (!withUnit) {
      return formatted;
    }

    const unit = this._getUnit(state);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  _canRunTapAction() {
    return (this._config?.tap_action || "more-info") !== "none" && Boolean(this._config?.entity);
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

    if (haptics.fallback_vibrate === true && typeof navigator?.vibrate === "function") {
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection);
    }
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
    const target = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.gaugeAction === "primary");

    if (!target || !this._canRunTapAction()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();
    this._openMoreInfo();
  }

  _renderEmptyState() {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    return `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        .gauge-card--empty {
          background: ${styles.card.background};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          display: grid;
          gap: 6px;
          padding: ${styles.card.padding};
        }

        .gauge-card__empty-title {
          color: var(--primary-text-color);
          font-size: 15px;
          font-weight: 700;
        }

        .gauge-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }
      </style>
      <ha-card class="gauge-card gauge-card--empty">
        <div class="gauge-card__empty-title">Nodalia Circular Gauge Card</div>
        <div class="gauge-card__empty-text">Configura \`entity\` con una entidad numerica para mostrar el dial.</div>
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

    if (!state) {
      this.shadowRoot.innerHTML = this._renderEmptyState();
      return;
    }

    const compactLayout = this._getCompactLevel() === "compact";
    const title = this._getTitle(state);
    const icon = this._getIcon(state);
    const value = this._getNumericValue(state);
    const unit = this._getUnit(state);
    const range = this._getRange(state, value);
    const ratio = value === null ? 0 : clamp((value - range.min) / Math.max(range.max - range.min, 1), 0, 1);
    const accentColor = this._getAccentColor(state, ratio);
    const progressLength = Number((DIAL_VISIBLE_LENGTH * ratio).toFixed(3));
    const dialAngle = DIAL_START_ANGLE + (ratio * DIAL_SWEEP);
    const showUnavailableBadge = config.show_unavailable_badge !== false && isUnavailableState(state);
    const showHeader = config.show_header !== false;
    const showName = config.show_name !== false;
    const showIcon = config.show_icon !== false;
    const dialSizePx = Math.max(
      220,
      Math.min(parseSizeToPixels(styles.gauge.size, 280), compactLayout ? 248 : 280),
    );
    const dialStrokePx = Math.max(
      15,
      Math.min(parseSizeToPixels(styles.gauge.stroke, 18), compactLayout ? 17 : 18),
    );
    const thumbSizePx = Math.max(
      18,
      Math.min(parseSizeToPixels(styles.gauge.thumb_size, 22), compactLayout ? 20 : 22),
    );
    const dialRadiusPx = Number(((DIAL_CIRCLE_RADIUS * dialSizePx) / DIAL_VIEWBOX_SIZE).toFixed(3));
    const effectiveCardPadding = compactLayout ? "14px" : styles.card.padding;
    const effectiveGap = compactLayout ? "12px" : styles.card.gap;
    const effectiveIconSize = `${Math.max(50, Math.min(parseSizeToPixels(styles.icon.size, 58), compactLayout ? 54 : 58))}px`;
    const effectiveTitleSize = `${Math.max(14, Math.min(parseSizeToPixels(styles.title_size, 16), compactLayout ? 15 : 16))}px`;
    const effectiveValueSize = `${Math.max(42, Math.min(parseSizeToPixels(styles.value_size, 52), compactLayout ? 46 : 52))}px`;
    const effectiveRangeSize = `${Math.max(12, Math.min(parseSizeToPixels(styles.range_size, 14), compactLayout ? 13 : 14))}px`;
    const effectiveChipHeight = `${Math.max(22, Math.min(parseSizeToPixels(styles.chip_height, 24), compactLayout ? 23 : 24))}px`;
    const effectiveChipFontSize = `${Math.max(10, Math.min(parseSizeToPixels(styles.chip_font_size, 11), compactLayout ? 10.5 : 11))}px`;
    const effectiveChipPadding = compactLayout ? "0 9px" : styles.chip_padding;
    const effectiveNameChipMaxWidth = `${Math.max(120, Math.min(parseSizeToPixels(styles.name_chip_max_width, 170), compactLayout ? 148 : 170))}px`;
    const cardBackground = value === null
      ? styles.card.background
      : `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 11%, rgba(255, 255, 255, 0.02)) 0%, ${styles.card.background} 100%)`;
    const cardBorder = value === null
      ? styles.card.border
      : `1px solid color-mix(in srgb, ${accentColor} 26%, var(--divider-color))`;
    const cardShadow = value === null
      ? styles.card.box_shadow
      : `${styles.card.box_shadow}, 0 18px 36px color-mix(in srgb, ${accentColor} 10%, rgba(0, 0, 0, 0.16))`;
    const chips = [];

    if (config.show_percentage_chip === true && value !== null) {
      chips.push(`<div class="gauge-card__chip">${escapeHtml(`${Math.round(ratio * 100)}%`)}</div>`);
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          min-height: 0;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }

        .gauge-card {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${accentColor} 18%, transparent) 0%, transparent 48%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.018) 0%, rgba(0, 0, 0, 0.02) 100%),
            ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          position: relative;
        }

        .gauge-card__content {
          cursor: ${this._canRunTapAction() ? "pointer" : "default"};
          display: flex;
          flex-direction: column;
          gap: ${effectiveGap};
          height: 100%;
          min-height: 0;
          padding: ${effectiveCardPadding};
          position: relative;
          z-index: 1;
        }

        .gauge-card__hero {
          align-items: center;
          display: grid;
          gap: ${effectiveGap};
          grid-template-columns: ${showIcon ? `${effectiveIconSize} minmax(0, 1fr)` : "minmax(0, 1fr)"};
          min-height: 0;
          width: 100%;
        }

        .gauge-card__icon {
          align-items: center;
          appearance: none;
          background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.06), transparent 60%),
            ${styles.icon.background};
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: calc(${effectiveIconSize} * 0.5);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 10px 26px rgba(0, 0, 0, 0.16);
          color: ${styles.icon.color};
          display: inline-flex;
          height: ${effectiveIconSize};
          justify-content: center;
          margin: 0;
          padding: 0;
          position: relative;
          width: ${effectiveIconSize};
        }

        .gauge-card__icon ha-icon {
          --mdc-icon-size: calc(${effectiveIconSize} * 0.44);
          display: inline-flex;
          height: calc(${effectiveIconSize} * 0.44);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${effectiveIconSize} * 0.44);
        }

        .gauge-card__unavailable-badge {
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

        .gauge-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          width: 11px;
        }

        .gauge-card__copy {
          display: grid;
          gap: 10px;
          min-width: 0;
        }

        .gauge-card__headline {
          align-items: start;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .gauge-card__title {
          color: var(--primary-text-color);
          font-size: ${effectiveTitleSize};
          font-weight: 700;
          line-height: 1.14;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .gauge-card__chips {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          min-width: 0;
        }

        .gauge-card__chip {
          align-items: center;
          backdrop-filter: blur(18px);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          color: var(--primary-text-color);
          display: inline-flex;
          font-size: ${effectiveChipFontSize};
          font-weight: 700;
          height: ${effectiveChipHeight};
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding: ${effectiveChipPadding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .gauge-card__dial-wrap {
          align-items: center;
          display: flex;
          flex: 1 1 auto;
          justify-content: center;
          min-height: 0;
        }

        .gauge-card__dial {
          --gauge-angle: ${dialAngle}deg;
          --gauge-progress-length: ${progressLength};
          --gauge-dial-size: ${dialSizePx}px;
          --gauge-dial-radius: ${dialRadiusPx}px;
          --gauge-thumb-size: ${thumbSizePx}px;
          background: ${styles.gauge.background};
          border-radius: 50%;
          height: var(--gauge-dial-size);
          position: relative;
          width: var(--gauge-dial-size);
        }

        .gauge-card__dial-svg {
          display: block;
          height: 100%;
          overflow: visible;
          width: 100%;
        }

        .gauge-card__dial-track,
        .gauge-card__dial-progress {
          fill: none;
          stroke-dasharray: ${DIAL_VISIBLE_LENGTH} ${DIAL_HIDDEN_LENGTH};
          stroke-linecap: round;
          stroke-width: ${dialStrokePx};
          transform: rotate(${DIAL_START_ANGLE}deg);
          transform-origin: ${DIAL_VIEWBOX_SIZE / 2}px ${DIAL_VIEWBOX_SIZE / 2}px;
        }

        .gauge-card__dial-track {
          stroke: ${styles.gauge.track_color};
        }

        .gauge-card__dial-progress {
          stroke: ${accentColor};
          stroke-dasharray: var(--gauge-progress-length) ${DIAL_CIRCUMFERENCE};
          transition: stroke-dasharray 180ms ease-out;
        }

        .gauge-card__dial-thumb {
          background: #f5f7fb;
          border: 4px solid color-mix(in srgb, ${accentColor} 18%, rgba(255, 255, 255, 0.72));
          border-radius: 50%;
          box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.12);
          height: var(--gauge-thumb-size);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%) rotate(calc(var(--gauge-angle) + 90deg)) translateY(calc(-1 * var(--gauge-dial-radius)));
          width: var(--gauge-thumb-size);
          z-index: 2;
        }

        .gauge-card__dial-center {
          align-content: center;
          display: grid;
          gap: ${compactLayout ? "8px" : "10px"};
          inset: ${compactLayout ? "28% 16% 24% 16%" : "26% 16% 24% 16%"};
          justify-items: center;
          position: absolute;
          text-align: center;
        }

        .gauge-card__name-chip {
          left: ${compactLayout ? "14px" : "16px"};
          max-width: ${effectiveNameChipMaxWidth};
          position: absolute;
          top: ${compactLayout ? "14px" : "16px"};
          z-index: 3;
        }

        .gauge-card__value {
          color: var(--primary-text-color);
          display: inline-block;
          font-size: ${effectiveValueSize};
          font-weight: 500;
          letter-spacing: -0.06em;
          line-height: 0.94;
          min-height: calc(${effectiveValueSize} * 0.94);
          min-width: 0;
          padding-right: ${unit ? `calc(${effectiveValueSize} * 0.34)` : "0"};
          position: relative;
          white-space: nowrap;
        }

        .gauge-card__value-unit {
          color: var(--primary-text-color);
          font-size: calc(${effectiveValueSize} * 0.24);
          font-weight: 500;
          line-height: 1;
          opacity: 0.92;
          position: absolute;
          right: 0;
          top: 0.16em;
        }

        .gauge-card__range-label {
          color: var(--secondary-text-color);
          font-size: ${effectiveRangeSize};
          font-weight: 600;
          line-height: 1;
          position: absolute;
          z-index: 2;
        }

        .gauge-card__range-label--min {
          bottom: ${compactLayout ? "-6px" : "-8px"};
          left: ${compactLayout ? "10px" : "14px"};
        }

        .gauge-card__range-label--max {
          bottom: ${compactLayout ? "-6px" : "-8px"};
          right: ${compactLayout ? "10px" : "14px"};
        }

        .gauge-card__bottom-icon {
          align-items: center;
          background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.08), transparent 60%),
            ${styles.icon.background};
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 10px 26px rgba(0, 0, 0, 0.16);
          color: ${styles.icon.color};
          display: inline-flex;
          height: ${compactLayout ? "42px" : "46px"};
          justify-content: center;
          left: 50%;
          bottom: ${compactLayout ? "36px" : "40px"};
          position: absolute;
          transform: translateX(-50%);
          width: ${compactLayout ? "42px" : "46px"};
          z-index: 3;
        }

        .gauge-card__bottom-icon ha-icon {
          --mdc-icon-size: ${compactLayout ? "20px" : "22px"};
          height: ${compactLayout ? "20px" : "22px"};
          width: ${compactLayout ? "20px" : "22px"};
        }

        @media (max-width: 560px) {
          .gauge-card__headline {
            grid-template-columns: minmax(0, 1fr);
          }

          .gauge-card__chips {
            justify-content: flex-start;
          }

          .gauge-card__dial {
            --gauge-dial-size: min(${dialSizePx}px, 100%);
          }
        }
      </style>
      <ha-card class="gauge-card">
        <div class="gauge-card__content" ${this._canRunTapAction() ? 'data-gauge-action="primary"' : ""}>
          ${
            showHeader
              ? `
                <div class="gauge-card__hero">
                  ${
                    showIcon
                      ? `
                        <div class="gauge-card__icon">
                          <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
                          ${showUnavailableBadge ? `<span class="gauge-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
                        </div>
                      `
                      : ""
                  }
                  <div class="gauge-card__copy">
                    <div class="gauge-card__headline">
                      ${showName ? `<div class="gauge-card__title">${escapeHtml(title)}</div>` : `<div></div>`}
                      ${chips.length ? `<div class="gauge-card__chips">${chips.join("")}</div>` : ""}
                    </div>
                  </div>
                </div>
              `
              : ""
          }

          ${
            !showHeader && showName && config.show_name_chip !== false
              ? `<div class="gauge-card__chip gauge-card__name-chip">${escapeHtml(title)}</div>`
              : ""
          }
          <div class="gauge-card__dial-wrap">
            <div class="gauge-card__dial" aria-hidden="true">
              <svg class="gauge-card__dial-svg" viewBox="0 0 ${DIAL_VIEWBOX_SIZE} ${DIAL_VIEWBOX_SIZE}">
                <circle
                  class="gauge-card__dial-track"
                  cx="${DIAL_VIEWBOX_SIZE / 2}"
                  cy="${DIAL_VIEWBOX_SIZE / 2}"
                  r="${DIAL_CIRCLE_RADIUS}"
                ></circle>
                <circle
                  class="gauge-card__dial-progress"
                  cx="${DIAL_VIEWBOX_SIZE / 2}"
                  cy="${DIAL_VIEWBOX_SIZE / 2}"
                  r="${DIAL_CIRCLE_RADIUS}"
                ></circle>
              </svg>
              <span class="gauge-card__dial-thumb" aria-hidden="true"></span>
              ${
                config.show_range_labels !== false
                  ? `
                    <span class="gauge-card__range-label gauge-card__range-label--min">
                      ${escapeHtml(this._getRangeLabel("min", range, state))}
                    </span>
                    <span class="gauge-card__range-label gauge-card__range-label--max">
                      ${escapeHtml(this._getRangeLabel("max", range, state))}
                    </span>
                  `
                  : ""
              }
              ${
                config.show_bottom_icon_bubble === true && showIcon
                  ? `
                    <div class="gauge-card__bottom-icon">
                      <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
                    </div>
                  `
                  : ""
              }
              <div class="gauge-card__dial-center">
                <div class="gauge-card__value">
                  ${escapeHtml(this._formatValue(value, state, false))}
                  ${unit ? `<span class="gauge-card__value-unit">${escapeHtml(unit)}</span>` : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCircularGaugeCard);
}

class NodaliaCircularGaugeCardEditor extends HTMLElement {
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
      .filter(entityId => entityId.startsWith("sensor.") || entityId.startsWith("number.") || entityId.startsWith("input_number."))
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
      ) ||
      !activeElement.dataset?.field
    ) {
      return null;
    }

    const selector = `[data-field="${CSS.escape(activeElement.dataset.field)}"]`;
    const supportsSelection =
      activeElement instanceof HTMLInputElement &&
      activeElement.type !== "checkbox" &&
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
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(label)}</span>
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
      .filter(entityId => entityId.startsWith("sensor.") || entityId.startsWith("number.") || entityId.startsWith("input_number."))
      .sort((left, right) => left.localeCompare(right, "es"));

    return `
      <datalist id="circular-gauge-card-entities">
        ${entityIds.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";

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
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
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
            0 0 0 3px rgba(255, 255, 255, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
</style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">General</div>
            <div class="editor-section__hint">Entidad principal, rango y textos visibles.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Entidad", "entity", config.entity, {
              placeholder: "sensor.enchufe_inteligente_potencia",
            })}
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Potencia",
            })}
            ${this._renderTextField("Icono", "icon", config.icon, {
              placeholder: "mdi:flash",
            })}
            ${this._renderTextField("Unidad", "unit", config.unit, {
              placeholder: "W",
            })}
            ${this._renderTextField("Minimo", "min", config.min, {
              placeholder: "0",
              type: "number",
            })}
            ${this._renderTextField("Maximo", "max", config.max, {
              placeholder: "2500",
              type: "number",
            })}
            ${this._renderTextField("Etiqueta minimo", "min_label", config.min_label, {
              placeholder: "0",
            })}
            ${this._renderTextField("Etiqueta maximo", "max_label", config.max_label, {
              placeholder: "∞",
            })}
            ${this._renderTextField("Decimales", "decimals", config.decimals, {
              placeholder: "0",
              type: "number",
            })}
            ${this._renderSelectField(
              "Tap action",
              "tap_action",
              config.tap_action || "more-info",
              [
                { value: "more-info", label: "More info" },
                { value: "none", label: "Sin accion" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Visibilidad</div>
            <div class="editor-section__hint">Ajustes de cabecera, chips y rango visible.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Empezar desde cero", "start_from_zero", config.start_from_zero !== false)}
            ${this._renderCheckboxField("Mostrar cabecera", "show_header", config.show_header !== false)}
            ${this._renderCheckboxField("Mostrar nombre", "show_name", config.show_name !== false)}
            ${this._renderCheckboxField("Mostrar nombre en chip", "show_name_chip", config.show_name_chip !== false)}
            ${this._renderCheckboxField("Mostrar icono", "show_icon", config.show_icon !== false)}
            ${this._renderCheckboxField("Mostrar chip de porcentaje", "show_percentage_chip", config.show_percentage_chip === true)}
            ${this._renderCheckboxField("Mostrar rango min/max", "show_range_labels", config.show_range_labels !== false)}
            ${this._renderCheckboxField("Mostrar icono inferior", "show_bottom_icon_bubble", config.show_bottom_icon_bubble === true)}
            ${this._renderCheckboxField("Mostrar badge de no disponible", "show_unavailable_badge", config.show_unavailable_badge !== false)}
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
            <div class="editor-section__hint">Ajustes visuales del dial circular y el look Nodalia.</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Background", "styles.card.background", config.styles.card.background)}
            ${this._renderTextField("Border", "styles.card.border", config.styles.card.border)}
            ${this._renderTextField("Radius", "styles.card.border_radius", config.styles.card.border_radius)}
            ${this._renderTextField("Shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
            ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
            ${this._renderTextField("Separacion", "styles.card.gap", config.styles.card.gap)}
            ${this._renderTextField("Tamano burbuja entidad", "styles.icon.size", config.styles.icon.size)}
            ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
            ${this._renderTextField("Tamano valor", "styles.value_size", config.styles.value_size)}
            ${this._renderTextField("Tamano rango", "styles.range_size", config.styles.range_size)}
            ${this._renderTextField("Max ancho chip nombre", "styles.name_chip_max_width", config.styles.name_chip_max_width)}
            ${this._renderTextField("Tamano dial", "styles.gauge.size", config.styles.gauge.size)}
            ${this._renderTextField("Grosor dial", "styles.gauge.stroke", config.styles.gauge.stroke)}
            ${this._renderTextField("Tamano thumb", "styles.gauge.thumb_size", config.styles.gauge.thumb_size)}
            ${this._renderTextField("Color gauge", "styles.gauge.foreground_color", config.styles.gauge.foreground_color)}
            ${this._renderTextField("Track gauge", "styles.gauge.track_color", config.styles.gauge.track_color)}
            ${this._renderTextField("Tamano chip", "styles.chip_height", config.styles.chip_height)}
            ${this._renderTextField("Texto chip", "styles.chip_font_size", config.styles.chip_font_size)}
            ${this._renderTextField("Padding chip", "styles.chip_padding", config.styles.chip_padding)}
          </div>
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('input[data-field="entity"]')
      .forEach(input => input.setAttribute("list", "circular-gauge-card-entities"));
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCircularGaugeCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Circular Gauge Card",
  description: "Tarjeta circular para sensores y valores numericos con estetica Nodalia.",
  preview: true,
});
