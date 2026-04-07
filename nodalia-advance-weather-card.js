const CARD_TAG = "nodalia-advance-weather-card";
const EDITOR_TAG = "nodalia-advance-weather-card-editor";
const CARD_VERSION = "0.1.0";

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  num_segments: 12,
  show_hourly: true,
  show_daily: true,
  daily_segments: 6,
  show_wind: true,
  show_precipitation: true,
  show_precipitation_probability: false,
  show_pressure: true,
  show_humidity: true,
  show_date: true,
  haptics: {
    enabled: false,
    style: "selection",
    fallback_vibrate: false,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid rgba(255, 255, 255, 0.06)",
      border_radius: "28px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "16px",
      gap: "12px",
    },
    title_size: "14px",
    temp_size: "36px",
    condition_size: "13px",
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 10px",
  },
};

const STUB_CONFIG = {
  entity: "weather.openweathermap",
  name: "Tiempo",
  num_segments: 12,
  show_hourly: true,
  show_daily: true,
  daily_segments: 6,
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

function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  if (Math.abs(numeric - Math.round(numeric)) < 0.05) {
    return String(Math.round(numeric));
  }
  return numeric.toFixed(1);
}

function translateCondition(value) {
  switch (normalizeTextKey(value)) {
    case "clear_night":
      return "Despejado";
    case "cloudy":
      return "Nublado";
    case "exceptional":
      return "Excepcional";
    case "fog":
      return "Niebla";
    case "hail":
      return "Granizo";
    case "lightning":
      return "Tormenta";
    case "lightning_rainy":
      return "Tormenta";
    case "partlycloudy":
      return "Parcialmente nublado";
    case "pouring":
      return "Lluvia intensa";
    case "rainy":
      return "Lluvia";
    case "snowy":
      return "Nieve";
    case "snowy_rainy":
      return "Aguanieve";
    case "sunny":
      return "Soleado";
    case "windy":
      return "Viento";
    case "windy_variant":
      return "Viento";
    default:
      return value ? String(value) : "";
  }
}

function conditionIcon(value) {
  switch (normalizeTextKey(value)) {
    case "clear_night":
      return "mdi:weather-night";
    case "cloudy":
      return "mdi:weather-cloudy";
    case "exceptional":
      return "mdi:alert-circle";
    case "fog":
      return "mdi:weather-fog";
    case "hail":
      return "mdi:weather-hail";
    case "lightning":
    case "lightning_rainy":
      return "mdi:weather-lightning";
    case "partlycloudy":
      return "mdi:weather-partly-cloudy";
    case "pouring":
      return "mdi:weather-pouring";
    case "rainy":
      return "mdi:weather-rainy";
    case "snowy":
      return "mdi:weather-snowy";
    case "snowy_rainy":
      return "mdi:weather-snowy-rainy";
    case "sunny":
      return "mdi:weather-sunny";
    case "windy":
    case "windy_variant":
      return "mdi:weather-windy";
    default:
      return "mdi:weather-cloudy";
  }
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit" });
}

function buildDailyForecast(forecast = []) {
  const grouped = new Map();
  forecast.forEach(item => {
    const date = new Date(item.datetime || item.date);
    if (Number.isNaN(date.getTime())) return;
    const key = date.toISOString().split("T")[0];
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  });

  const days = [];
  grouped.forEach(items => {
    const temps = items
      .flatMap(item => [
        item.temperature,
        item.templow,
        item.temperature_low,
        item.temp_min,
        item.temp_max,
      ])
      .filter(value => Number.isFinite(Number(value)));
    const max = temps.length ? Math.max(...temps.map(Number)) : undefined;
    const min = temps.length ? Math.min(...temps.map(Number)) : undefined;
    const representative = items.find(item => item.condition) || items[0];
    days.push({
      datetime: representative?.datetime || representative?.date || items[0]?.datetime,
      condition: representative?.condition || "",
      max,
      min,
    });
  });

  return days;
}

class NodaliaAdvanceWeatherCard extends HTMLElement {
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
    const entityId = this._config?.entity;
    const state = entityId ? hass?.states?.[entityId] : null;
    const signature = JSON.stringify({
      entityId,
      state: String(state?.state || ""),
      attrs: state?.attributes?.forecast?.length || 0,
      config: this._config,
    });
    this._hass = hass;
    if (this.shadowRoot?.innerHTML && signature === this._lastRenderSignature) return;
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
    const entityId = this._config?.entity;
    if (!entityId) return;
    this._triggerHaptic();
    fireEvent(this, "hass-more-info", { entityId });
  }

  _renderChip(label, value) {
    if (!value && value !== 0) return "";
    return `
      <span class="weather__chip">
        <span class="weather__chip-label">${escapeHtml(label)}</span>
        <span class="weather__chip-value">${escapeHtml(String(value))}</span>
      </span>
    `;
  }

  _render() {
    if (!this.shadowRoot) return;

    const config = this._config || mergeConfig(DEFAULT_CONFIG, {});
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const entityId = config.entity;
    const state = entityId ? this._hass?.states?.[entityId] : null;

    if (!state) {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display:block; }
          .weather-empty {
            background: ${styles.card.background};
            border: ${styles.card.border};
            border-radius: ${styles.card.border_radius};
            box-shadow: ${styles.card.box_shadow};
            padding: ${styles.card.padding};
            color: var(--secondary-text-color);
          }
        </style>
        <div class="weather-empty">Selecciona una entidad de tiempo.</div>
      `;
      return;
    }

    const attrs = state.attributes || {};
    const title = config.name || attrs.friendly_name || "Tiempo";
    const temp = formatNumber(attrs.temperature ?? attrs.temp ?? state.state);
    const condition = translateCondition(state.state);
    const icon = conditionIcon(state.state);
    const humidity = attrs.humidity;
    const pressure = attrs.pressure;
    const windSpeed = attrs.wind_speed;
    const windBearing = attrs.wind_bearing;
    const precip = attrs.precipitation || attrs.precipitation_intensity;
    const precipProb = attrs.forecast?.[0]?.precipitation_probability;
    const rawForecast = Array.isArray(attrs.forecast) ? attrs.forecast : [];
    const forecast = rawForecast.slice(0, Number(config.num_segments || 12));
    const dailyForecast = buildDailyForecast(rawForecast).slice(0, Number(config.daily_segments || 6));

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        * { box-sizing: border-box; }
        .weather {
          background: ${styles.card.background};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          padding: ${styles.card.padding};
          display: grid;
          gap: ${styles.card.gap};
          position: relative;
          overflow: hidden;
        }
        .weather::before {
          content:"";
          position:absolute;
          inset:0;
          background: radial-gradient(circle at 12% 0%, rgba(255,255,255,0.12), transparent 55%);
          pointer-events:none;
        }
        .weather__header {
          display:flex;
          align-items:center;
          justify-content: space-between;
          gap: 12px;
          position: relative;
          z-index:1;
        }
        .weather__title {
          font-size: ${styles.title_size};
          font-weight: 700;
        }
        .weather__temp {
          font-size: ${styles.temp_size};
          font-weight: 700;
        }
        .weather__condition {
          font-size: ${styles.condition_size};
          color: var(--secondary-text-color);
        }
        .weather__icon {
          width: 52px;
          height: 52px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .weather__icon ha-icon { --mdc-icon-size: 26px; }
        .weather__chips {
          display:flex;
          flex-wrap: wrap;
          gap: 8px;
          position: relative;
          z-index:1;
        }
        .weather__chip {
          height: ${styles.chip_height};
          padding: ${styles.chip_padding};
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: ${styles.chip_font_size};
        }
        .weather__chip-label {
          color: var(--secondary-text-color);
          font-weight: 600;
        }
        .weather__chip-value {
          color: var(--primary-text-color);
          font-weight: 700;
        }
        .weather__forecast {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: minmax(44px, 1fr);
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
          position: relative;
          z-index:1;
        }
        .weather__daily {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: minmax(70px, 1fr);
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 4px;
          position: relative;
          z-index: 1;
        }
        .forecast__item {
          display: grid;
          gap: 6px;
          justify-items: center;
          font-size: 11px;
          color: var(--secondary-text-color);
        }
        .forecast__temp {
          font-weight: 700;
          color: var(--primary-text-color);
          font-size: 12px;
        }
        .daily__temps {
          display: flex;
          gap: 6px;
          font-size: 11px;
          color: var(--secondary-text-color);
        }
        .daily__max {
          font-weight: 700;
          color: var(--primary-text-color);
        }
      </style>
      <div class="weather">
        <div class="weather__header">
          <div>
            <div class="weather__title">${escapeHtml(title)}</div>
            <div class="weather__temp">${escapeHtml(temp)}°</div>
            <div class="weather__condition">${escapeHtml(condition)}</div>
          </div>
          <div class="weather__icon">
            <ha-icon icon="${icon}"></ha-icon>
          </div>
        </div>
        <div class="weather__chips">
          ${config.show_humidity ? this._renderChip("Humedad", humidity != null ? `${humidity}%` : "") : ""}
          ${config.show_pressure ? this._renderChip("Presión", pressure != null ? `${pressure} hPa` : "") : ""}
          ${config.show_wind ? this._renderChip("Viento", windSpeed != null ? `${windSpeed} km/h` : "") : ""}
          ${config.show_wind && windBearing != null ? this._renderChip("Dirección", `${windBearing}°`) : ""}
          ${config.show_precipitation && precip != null ? this._renderChip("Lluvia", `${precip} mm`) : ""}
          ${config.show_precipitation_probability && precipProb != null ? this._renderChip("Prob.", `${precipProb}%`) : ""}
        </div>
        ${config.show_hourly !== false && forecast.length
          ? `<div class="weather__forecast">
              ${forecast.map(item => `
                <div class="forecast__item">
                  <div>${escapeHtml(formatTime(item.datetime))}</div>
                  <ha-icon icon="${conditionIcon(item.condition)}"></ha-icon>
                  <div class="forecast__temp">${escapeHtml(formatNumber(item.temperature))}°</div>
                </div>
              `).join("")}
            </div>`
          : ""
        }
        ${config.show_daily !== false && dailyForecast.length
          ? `<div class="weather__daily">
              ${dailyForecast.map(item => `
                <div class="forecast__item">
                  <div>${escapeHtml(formatDay(item.datetime))}</div>
                  <ha-icon icon="${conditionIcon(item.condition)}"></ha-icon>
                  <div class="daily__temps">
                    ${item.max != null ? `<span class="daily__max">${escapeHtml(formatNumber(item.max))}°</span>` : ""}
                    ${item.min != null ? `<span>${escapeHtml(formatNumber(item.min))}°</span>` : ""}
                  </div>
                </div>
              `).join("")}
            </div>`
          : ""
        }
      </div>
    `;
  }
}

class NodaliaAdvanceWeatherCardEditor extends HTMLElement {
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
      .filter(entityId => entityId.startsWith("weather."))
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
              <input list="advance-weather-entities" data-path="entity" value="${escapeHtml(config.entity || "")}" />
              <datalist id="advance-weather-entities">${this._getEntityOptions()}</datalist>
            </label>
            ${this._renderTextField("Nombre", "name", config.name, { removeIfEmpty: true })}
            ${this._renderTextField("Segmentos horario", "num_segments", config.num_segments)}
            ${this._renderTextField("Dias pronostico", "daily_segments", config.daily_segments)}
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Mostrar humedad", "show_humidity", config.show_humidity !== false)}
            ${this._renderCheckboxField("Mostrar presion", "show_pressure", config.show_pressure !== false)}
            ${this._renderCheckboxField("Mostrar viento", "show_wind", config.show_wind !== false)}
            ${this._renderCheckboxField("Mostrar lluvia", "show_precipitation", config.show_precipitation !== false)}
            ${this._renderCheckboxField("Mostrar prob. lluvia", "show_precipitation_probability", config.show_precipitation_probability === true)}
            ${this._renderCheckboxField("Mostrar pronostico horario", "show_hourly", config.show_hourly !== false)}
            ${this._renderCheckboxField("Mostrar pronostico dias", "show_daily", config.show_daily !== false)}
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
  customElements.define(CARD_TAG, NodaliaAdvanceWeatherCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaAdvanceWeatherCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some(item => item.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "Nodalia Advance Weather",
    description: "Tiempo avanzado con pronostico horario estilo Nodalia.",
  });
}
