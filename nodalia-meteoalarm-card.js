const CARD_TAG = "nodalia-meteoalarm-card";
const EDITOR_TAG = "nodalia-meteoalarm-card-editor";
const CARD_VERSION = "0.1.0";

const DEFAULT_CONFIG = {
  entities: [
    { entity: "" },
  ],
  name: "Avisos",
  integration: "meteoalarm",
  scaling_mode: "headline_and_scale",
  show_scale: true,
  show_details: true,
  tap_action: "more-info",
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
      padding: "14px 16px",
      gap: "12px",
    },
    title_size: "14px",
    headline_size: "24px",
    body_size: "13px",
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 10px",
  },
};

const STUB_CONFIG = {
  entities: [{ entity: "binary_sensor.meteoalarm" }],
  name: "Avisos",
  integration: "meteoalarm",
  scaling_mode: "headline_and_scale",
};

const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
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

function getAlertLevel(alert = {}, fallback = "") {
  const level = alert.awareness_level || alert.level || alert.severity || fallback;
  const parsed = parseMeteoCode(level);
  if (parsed?.color) return parsed.color;
  return normalizeTextKey(level);
}

function getAlertColor(level) {
  const key = normalizeTextKey(level);
  if (key.includes("red")) return "#ff6b6b";
  if (key.includes("orange")) return "#f6b04d";
  if (key.includes("yellow")) return "#f2c94c";
  if (key.includes("green")) return "#83d39c";
  switch (key) {
    case "red":
    case "extreme":
    case "severe":
      return "#ff6b6b";
    case "orange":
    case "high":
      return "#f6b04d";
    case "yellow":
    case "moderate":
      return "#f2c94c";
    case "green":
    case "minor":
      return "#83d39c";
    default:
      return "var(--state-inactive-color, rgba(255, 255, 255, 0.55))";
  }
}

function getAlertIcon(alert = {}) {
  const key = normalizeTextKey(alert.event || alert.type || alert.awareness_type || "");
  if (key.includes("wind")) return "mdi:weather-windy";
  if (key.includes("rain")) return "mdi:weather-pouring";
  if (key.includes("snow")) return "mdi:weather-snowy";
  if (key.includes("storm") || key.includes("thunder")) return "mdi:weather-lightning";
  if (key.includes("fog")) return "mdi:weather-fog";
  if (key.includes("heat")) return "mdi:weather-sunny-alert";
  if (key.includes("cold")) return "mdi:snowflake-alert";
  return "mdi:alert-circle";
}

function parseMeteoCode(value) {
  const key = normalizeTextKey(value);
  if (!key) return null;
  const parts = key.split("_");
  const colors = ["green", "yellow", "orange", "red"];
  let color = parts.find(part => colors.includes(part));
  const severityMap = {
    minor: "leve",
    moderate: "moderado",
    severe: "severo",
    extreme: "extremo",
    high: "alto",
  };
  const severityKey = parts.find(part => Object.keys(severityMap).includes(part));
  const levelNum = parts.find(part => /^\d+$/.test(part));
  if (!color && levelNum) {
    const byNum = { "1": "green", "2": "yellow", "3": "orange", "4": "red" };
    color = byNum[levelNum] || "";
  }

  const colorLabelMap = {
    green: "verde",
    yellow: "amarillo",
    orange: "naranja",
    red: "rojo",
  };
  const colorLabel = colorLabelMap[color] || "";
  const severityLabel = severityKey ? severityMap[severityKey] : "";
  const label = colorLabel
    ? `Nivel ${colorLabel}${severityLabel ? ` · ${severityLabel}` : ""}`
    : "";

  return { color, colorLabel, severityKey, severityLabel, label };
}

function translateAlertType(alert = {}) {
  const key = normalizeTextKey(alert.event || alert.type || alert.awareness_type || "");
  if (!key) return "";
  if (key.includes("storm") || key.includes("thunder")) return "tormentas";
  if (key.includes("wind")) return "viento";
  if (key.includes("rain")) return "lluvias";
  if (key.includes("snow")) return "nieve";
  if (key.includes("fog")) return "niebla";
  if (key.includes("heat")) return "calor";
  if (key.includes("cold")) return "frio";
  if (key.includes("coastal")) return "fenomeno costero";
  if (key.includes("fire")) return "incendios";
  return "";
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function extractAlerts(state) {
  if (!state) return [];
  const attrs = state.attributes || {};
  if (Array.isArray(attrs.alerts)) return attrs.alerts;
  if (Array.isArray(attrs.warning)) return attrs.warning;
  if (Array.isArray(attrs.alert)) return attrs.alert;
  if (isObject(attrs.alert)) return [attrs.alert];
  if (Array.isArray(attrs.warnings)) return attrs.warnings;
  return [];
}

class NodaliaMeteoalarmCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig() {
    return deepClone(STUB_CONFIG);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = mergeConfig(DEFAULT_CONFIG, STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._onClick = this._onClick.bind(this);
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onClick);
  }

  disconnectedCallback() {
    this.shadowRoot?.removeEventListener("click", this._onClick);
  }

  setConfig(config) {
    this._config = mergeConfig(DEFAULT_CONFIG, config || {});
    this._lastRenderSignature = "";
    this._render();
  }

  set hass(hass) {
    const signature = JSON.stringify({
      entities: (this._config?.entities || []).map(item => item?.entity || ""),
      states: (this._config?.entities || []).map(item => hass?.states?.[item?.entity]?.state || ""),
      attrs: (this._config?.entities || []).map(item => hass?.states?.[item?.entity]?.attributes?.alerts?.length || 0),
      config: this._config,
    });
    this._hass = hass;
    if (this.shadowRoot?.innerHTML && signature === this._lastRenderSignature) {
      return;
    }
    this._lastRenderSignature = signature;
    this._render();
  }

  _triggerHaptic() {
    const haptics = this._config?.haptics || {};
    if (haptics.enabled !== true) return;
    const style = haptics.style || "selection";
    fireEvent(this, "haptic", style, { bubbles: true, cancelable: false, composed: true });
    if (haptics.fallback_vibrate === true && typeof navigator?.vibrate === "function") {
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection);
    }
  }

  _onClick() {
    const action = this._config?.tap_action || "more-info";
    const entityId = this._config?.entities?.[0]?.entity;
    if (action === "none") return;
    this._triggerHaptic();
    if (action === "more-info" && entityId) {
      fireEvent(this, "hass-more-info", { entityId });
    }
  }

  _renderScale(level, accent) {
    const steps = ["green", "yellow", "orange", "red"];
    const index = Math.max(0, steps.indexOf(level));
    return `
      <div class="meteoalarm__scale">
        ${steps.map((step, i) => {
          const active = i <= index && level;
          const color = active ? accent : "rgba(255,255,255,0.12)";
          return `<span class="meteoalarm__scale-dot" style="background:${color};"></span>`;
        }).join("")}
      </div>
    `;
  }

  _renderAlert(alert, level, accent, styles) {
    const levelCode = alert.awareness_level || alert.level || alert.severity || alert.event || "";
    const parsed = parseMeteoCode(levelCode);
    const typeLabel = translateAlertType(alert);
    const rawHeadline = alert.headline || alert.event || "Aviso";
    const normalizedHeadline = normalizeTextKey(rawHeadline);
    const normalizedCode = normalizeTextKey(levelCode);
    const headline = (parsed?.colorLabel && typeLabel && (normalizedHeadline === "aviso" || normalizedHeadline === normalizedCode))
      ? `Aviso de ${typeLabel} de nivel ${parsed.colorLabel}`
      : rawHeadline;
    const description = alert.description || alert.detail || "";
    const icon = getAlertIcon(alert);
    const effective = formatDateTime(alert.onset || alert.effective || alert.start);
    const expires = formatDateTime(alert.expires || alert.end);
    const timeframe = effective && expires ? `${effective} · ${expires}` : effective || expires;
    const levelLabel = parsed?.label || (level ? `Nivel ${level}` : "sin nivel");

    return `
      <div class="meteoalarm__alert">
        <div class="meteoalarm__alert-header">
          <div class="meteoalarm__icon" style="background: color-mix(in srgb, ${accent} 22%, transparent);">
            <ha-icon icon="${icon}"></ha-icon>
          </div>
          <div class="meteoalarm__headline">
            ${escapeHtml(headline)}
          </div>
        </div>
        ${description && this._config.show_details ? `<div class="meteoalarm__body">${escapeHtml(description)}</div>` : ""}
        <div class="meteoalarm__chips">
          <span class="meteoalarm__chip" style="background: color-mix(in srgb, ${accent} 22%, transparent);">
            ${escapeHtml(levelLabel)}
          </span>
          ${timeframe ? `<span class="meteoalarm__chip">${escapeHtml(timeframe)}</span>` : ""}
        </div>
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) return;
    const styles = this._config.styles || DEFAULT_CONFIG.styles;
    const entityId = this._config?.entities?.[0]?.entity;
    const state = entityId ? this._hass?.states?.[entityId] : null;
    const alerts = extractAlerts(state);
    const level = getAlertLevel(alerts[0] || {}, state?.attributes?.awareness_level || state?.state);
    const accent = getAlertColor(level);
    const hasAlerts = alerts.length > 0 || normalizeTextKey(state?.state) === "on";
    const title = this._config?.name || "Avisos";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        * { box-sizing: border-box; }
        .meteoalarm {
          background: ${styles.card.background};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          color: var(--primary-text-color);
          display: grid;
          gap: ${styles.card.gap};
          padding: ${styles.card.padding};
          position: relative;
          overflow: hidden;
        }
        .meteoalarm::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 10% 0%, color-mix(in srgb, ${accent} 18%, transparent), transparent 55%);
          opacity: 0.5;
          pointer-events: none;
        }
        .meteoalarm__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          position: relative;
          z-index: 1;
        }
        .meteoalarm__title {
          font-size: ${styles.title_size};
          font-weight: 700;
        }
        .meteoalarm__scale {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .meteoalarm__scale-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          box-shadow: 0 0 0 4px color-mix(in srgb, ${accent} 14%, transparent);
        }
        .meteoalarm__alert {
          display: grid;
          gap: 10px;
          position: relative;
          z-index: 1;
        }
        .meteoalarm__alert-header {
          display: grid;
          grid-template-columns: 38px 1fr;
          gap: 10px;
          align-items: center;
        }
        .meteoalarm__icon {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .meteoalarm__icon ha-icon {
          --mdc-icon-size: 20px;
        }
        .meteoalarm__headline {
          font-size: ${styles.headline_size};
          font-weight: 700;
          line-height: 1.1;
        }
        .meteoalarm__body {
          font-size: ${styles.body_size};
          color: var(--secondary-text-color);
          line-height: 1.4;
        }
        .meteoalarm__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .meteoalarm__chip {
          height: ${styles.chip_height};
          padding: ${styles.chip_padding};
          border-radius: 999px;
          font-size: ${styles.chip_font_size};
          display: inline-flex;
          align-items: center;
          color: var(--primary-text-color);
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .meteoalarm__empty {
          color: var(--secondary-text-color);
          font-size: ${styles.body_size};
        }
      </style>
      <div class="meteoalarm" data-action="primary">
        <div class="meteoalarm__header">
          <div class="meteoalarm__title">${escapeHtml(title)}</div>
          ${this._config.show_scale && this._config.scaling_mode !== "headline" ? this._renderScale(level, accent) : ""}
        </div>
        ${hasAlerts
          ? this._renderAlert(alerts[0] || {}, level, accent, styles)
          : `<div class="meteoalarm__empty">Sin avisos activos</div>`
        }
      </div>
    `;
  }
}

class NodaliaMeteoalarmCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = mergeConfig(DEFAULT_CONFIG, config || {});
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _emitConfig(config) {
    fireEvent(this, "config-changed", { config });
  }

  _updateValue(path, value, options = {}) {
    const nextConfig = deepClone(this._config || {});
    if (options.removeIfEmpty && (value === "" || value === null || value === undefined)) {
      deleteByPath(nextConfig, path);
    } else {
      setByPath(nextConfig, path, value);
    }
    this._config = mergeConfig(DEFAULT_CONFIG, nextConfig);
    this._emitConfig(compactConfig(this._config));
    this._render();
  }

  _handleInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const path = target.dataset?.path;
    if (!path) return;
    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      this._updateValue(path, target.checked);
      return;
    }
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
      this._updateValue(path, target.value, { removeIfEmpty: target.dataset?.removeIfEmpty === "true" });
    }
  }

  _getEntityOptions() {
    if (!this._hass) return "";
    return Object.keys(this._hass.states || {})
      .filter(entityId => entityId.startsWith("binary_sensor."))
      .sort((left, right) => left.localeCompare(right, "es"))
      .map(entityId => `<option value="${escapeHtml(entityId)}">${escapeHtml(entityId)}</option>`)
      .join("");
  }

  _renderTextField(label, path, value = "", options = {}) {
    return `
      <label class="editor-field">
        <span>${escapeHtml(label)}</span>
        <input type="text" data-path="${escapeHtml(path)}" data-remove-if-empty="${options.removeIfEmpty ? "true" : "false"}" value="${escapeHtml(value ?? "")}" />
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

    const config = this._config || mergeConfig(DEFAULT_CONFIG, {});

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        * { box-sizing: border-box; }
        .editor { display:grid; gap: 14px; }
        .editor-section {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 18px;
          padding: 14px;
          display:grid;
          gap: 12px;
        }
        .editor-section h3 { margin: 0; font-size: 13px; color: var(--primary-text-color); }
        .editor-grid { display:grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
        .editor-field { display:grid; gap:6px; }
        .editor-field span { font-size:12px; color: var(--secondary-text-color); font-weight: 600; }
        .editor-field input, .editor-field select {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 40px;
          padding: 10px 12px;
        }
        .editor-checkbox { display:flex; gap:10px; align-items:center; }
        .editor-checkbox span { font-size:13px; color: var(--primary-text-color); font-weight: 600; }
      </style>
      <div class="editor">
        <div class="editor-section">
          <h3>Contenido</h3>
          <div class="editor-grid">
            <label class="editor-field">
              <span>Entidad</span>
              <input list="meteoalarm-entities" data-path="entities.0.entity" value="${escapeHtml(config.entities?.[0]?.entity || "")}" />
              <datalist id="meteoalarm-entities">${this._getEntityOptions()}</datalist>
            </label>
            ${this._renderTextField("Nombre", "name", config.name, { removeIfEmpty: true })}
          </div>
          <div class="editor-grid">
            ${this._renderSelectField("Modo escala", "scaling_mode", config.scaling_mode || "headline_and_scale", [
              { value: "headline", label: "Solo titular" },
              { value: "headline_and_scale", label: "Titular y escala" },
            ])}
            ${this._renderCheckboxField("Mostrar escala", "show_scale", config.show_scale !== false)}
            ${this._renderCheckboxField("Mostrar detalles", "show_details", config.show_details !== false)}
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.querySelectorAll("input, select").forEach(field => {
      field.addEventListener("input", event => this._handleInput(event));
      field.addEventListener("change", event => this._handleInput(event));
    });
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaMeteoalarmCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaMeteoalarmCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some(item => item.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "Nodalia Meteoalarm",
    description: "Avisos de tiempo estilo Nodalia con escala de nivel.",
  });
}
