const CARD_TAG = "nodalia-weather-card";
const EDITOR_TAG = "nodalia-weather-card-editor";
const CARD_VERSION = "0.12.3";
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
  show_condition: true,
  show_humidity_chip: true,
  show_wind_chip: true,
  show_pressure_chip: false,
  show_meteoalarm_chip: false,
  meteoalarm_entity: "binary_sensor.meteoalarm",
  show_forecast_details: false,
  show_forecast_toggle: true,
  forecast_view: "cards",
  forecast_type: "hourly",
  forecast_chart_labels: false,
  forecast_chart_color_enabled: false,
  forecast_chart_color_mode: "temperature",
  forecast_slots_hourly: 8,
  forecast_slots_daily: 5,
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    content_duration: 420,
    button_bounce_duration: 320,
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
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    title_size: "14px",
    temperature_size: "28px",
    condition_size: "13px",
  },
};

const STUB_CONFIG = {
  entity: "weather.casa",
  name: "Tiempo",
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

function getStubEntityId(hass, domains = []) {
  const states = hass?.states || {};
  const normalizedDomains = domains.map(domain => String(domain).trim()).filter(Boolean);
  return Object.keys(states).find(entityId => (
    !normalizedDomains.length || normalizedDomains.some(domain => entityId.startsWith(`${domain}.`))
  )) || "";
}

function applyStubEntity(config, hass, domains) {
  const entityId = getStubEntityId(hass, domains);
  if (!entityId) {
    return config;
  }

  config.entity = entityId;
  config.name = hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
  return config;
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

function getByPath(target, path) {
  const parts = String(path || "").split(".");
  let cursor = target;

  for (const key of parts) {
    if (!key) {
      return undefined;
    }

    if (!isObject(cursor) && !Array.isArray(cursor)) {
      return undefined;
    }

    cursor = cursor[key];
  }

  return cursor;
}

function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

function resolveEditorColorValue(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue || typeof document === "undefined") {
    return "";
  }

  const probe = document.createElement("span");
  probe.style.position = "fixed";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  probe.style.color = "";
  probe.style.color = rawValue;
  if (!probe.style.color) {
    return rawValue;
  }

  (document.body || document.documentElement).appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || rawValue;
}

function formatEditorHexChannel(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function formatEditorColorFromHex(hex, alpha = 1) {
  const normalizedHex = String(hex ?? "").trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(normalizedHex)) {
    return String(hex ?? "");
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  const safeAlpha = clamp(Number(alpha), 0, 1);
  if (safeAlpha >= 0.999) {
    return `#${normalizedHex}`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${Number(safeAlpha.toFixed(2))})`;
}

function getEditorColorModel(value, fallbackValue = "#71c0ff") {
  const sourceValue = String(value ?? "").trim() || String(fallbackValue ?? "").trim() || "#71c0ff";
  const resolvedValue = resolveEditorColorValue(sourceValue) || resolveEditorColorValue(fallbackValue) || "rgb(113, 192, 255)";
  const channels = resolvedValue.match(/[\d.]+/g) || [];
  const red = clamp(Math.round(Number(channels[0] ?? 113)), 0, 255);
  const green = clamp(Math.round(Number(channels[1] ?? 192)), 0, 255);
  const blue = clamp(Math.round(Number(channels[2] ?? 255)), 0, 255);
  const alpha = channels.length > 3 ? clamp(Number(channels[3]), 0, 1) : 1;
  const hex = `#${formatEditorHexChannel(red)}${formatEditorHexChannel(green)}${formatEditorHexChannel(blue)}`;

  return {
    alpha,
    hex,
    resolved: resolvedValue,
    source: sourceValue,
    value: formatEditorColorFromHex(hex, alpha),
  };
}

function getEditorColorFallbackValue(field) {
  const normalizedField = String(field ?? "");

  if (normalizedField.endsWith("icon.background")) {
    return "color-mix(in srgb, var(--primary-text-color) 6%, transparent)";
  }

  if (normalizedField.endsWith("icon.color")) {
    return "var(--primary-text-color)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
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

function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (Math.abs(numeric - Math.round(numeric)) < 0.05) {
    return String(Math.round(numeric));
  }

  return numeric.toFixed(1);
}

function formatCompactTemperature(value, unitLabel = "°") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }

  return `${Math.round(numeric)}${unitLabel}`;
}

function normalizeForecastType(value) {
  return ["hourly", "daily"].includes(value) ? value : "hourly";
}

function normalizeForecastView(value) {
  return String(value || "cards").toLowerCase() === "chart" ? "chart" : "cards";
}

function normalizeForecastChartColorMode(value) {
  return String(value || "").toLowerCase() === "condition" ? "condition" : "temperature";
}

function getTemperatureScaleColor(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "var(--info-color, #71c0ff)";
  }

  const stops = [
    { value: -5, color: [22, 58, 143] },
    { value: 2, color: [43, 128, 211] },
    { value: 10, color: [74, 177, 126] },
    { value: 18, color: [238, 206, 76] },
    { value: 26, color: [231, 87, 53] },
    { value: 36, color: [140, 28, 28] },
  ];

  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (const stop of stops) {
    if (numeric >= stop.value) {
      lower = stop;
    }
    if (numeric <= stop.value) {
      upper = stop;
      break;
    }
  }
  if (lower === upper) {
    return `rgb(${lower.color.join(", ")})`;
  }

  const progress = clamp((numeric - lower.value) / Math.max(upper.value - lower.value, 1), 0, 1);
  const channels = lower.color.map((channel, index) => Math.round(channel + ((upper.color[index] - channel) * progress)));
  return `rgb(${channels.join(", ")})`;
}

function getForecastChartPointColor(point, mode, fallbackCondition) {
  if (mode === "condition") {
    return getConditionAccent(point?.item?.condition || fallbackCondition);
  }

  return getTemperatureScaleColor(point?.value);
}

function getWeatherSupportedFeature(state, feature) {
  return Boolean((Number(state?.attributes?.supported_features) || 0) & feature);
}

function getSupportedForecastTypes(state) {
  const types = [];
  if (getWeatherSupportedFeature(state, 2)) {
    types.push("hourly");
  }
  if (getWeatherSupportedFeature(state, 1)) {
    types.push("daily");
  }
  return types.length ? types : ["hourly", "daily"];
}

function formatForecastDateTime(value, type) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  if (type === "hourly") {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
  });
}

function formatForecastTemperature(item, type) {
  const temperature = formatNumber(item?.temperature);
  const low = formatNumber(item?.templow);

  if (!temperature) {
    return "--";
  }

  if (type === "daily" && low) {
    return `${temperature}° / ${low}°`;
  }

  return `${temperature}°`;
}

function getForecastTemperatureValue(item, type) {
  const temperature = Number(item?.temperature);
  if (Number.isFinite(temperature)) {
    return temperature;
  }

  if (type === "daily") {
    const low = Number(item?.templow);
    if (Number.isFinite(low)) {
      return low;
    }
  }

  return null;
}

function getForecastTemperatureSeriesValue(item, series) {
  const value = Number(series === "low" ? item?.templow : item?.temperature);
  return Number.isFinite(value) ? value : null;
}

function getForecastPrecipitationLabel(item, unit = "") {
  const probability = formatNumber(item?.precipitation_probability);
  if (probability) {
    return `${probability}%`;
  }

  const precipitation = formatNumber(item?.precipitation);
  if (precipitation) {
    return unit ? `${precipitation} ${unit}` : precipitation;
  }

  return "";
}

function getMeteoalarmAwarenessParts(state) {
  const rawLevel = String(state?.attributes?.awareness_level || "").trim();
  const parts = rawLevel.split(";").map(part => part.trim()).filter(Boolean);
  return {
    color: parts[1] || "",
    label: parts[2] || parts[0] || "",
    level: parts[0] || "",
  };
}

function getMeteoalarmAccentColor(state) {
  if (!state) {
    return "var(--secondary-text-color)";
  }

  if (state.state !== "on") {
    return state.state === "off" ? "#61c97a" : "var(--secondary-text-color)";
  }

  const { color, level } = getMeteoalarmAwarenessParts(state);
  switch (normalizeTextKey(color || level)) {
    case "2":
    case "yellow":
    case "moderate":
      return "#f1c24c";
    case "3":
    case "orange":
    case "severe":
      return "#ff9b4a";
    case "4":
    case "red":
    case "high":
      return "#ff5f6d";
    default:
      return "var(--warning-color, #ff9b4a)";
  }
}

function formatMeteoalarmDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || "").trim();
  }

  return date.toLocaleString([], {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

function translateMeteoalarmValue(value) {
  const text = String(value || "").trim();
  switch (normalizeTextKey(text)) {
    case "moderate":
      return "Moderado";
    case "severe":
      return "Severo";
    case "high":
      return "Alto";
    case "extreme":
      return "Extremo";
    case "minor":
      return "Menor";
    case "yellow":
      return "Amarillo";
    case "orange":
      return "Naranja";
    case "red":
      return "Rojo";
    case "green":
      return "Verde";
    case "future":
      return "Futuro";
    case "immediate":
      return "Inmediato";
    case "expected":
      return "Esperado";
    case "past":
      return "Pasado";
    case "likely":
      return "Probable";
    case "observed":
      return "Observado";
    case "possible":
      return "Posible";
    case "unlikely":
      return "Improbable";
    case "unknown":
      return "Desconocido";
    case "met":
      return "Meteorologico";
    case "monitor":
      return "Monitorizar";
    default:
      return text;
  }
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
      return "Tormenta con lluvia";
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
      return "Ventoso";
    case "windy_variant":
      return "Viento variable";
    default:
      return String(value || "").trim() || "Tiempo";
  }
}

function getConditionIcon(value) {
  switch (normalizeTextKey(value)) {
    case "clear_night":
      return "mdi:weather-night";
    case "cloudy":
      return "mdi:weather-cloudy";
    case "exceptional":
      return "mdi:alert-circle-outline";
    case "fog":
      return "mdi:weather-fog";
    case "hail":
      return "mdi:weather-hail";
    case "lightning":
      return "mdi:weather-lightning";
    case "lightning_rainy":
      return "mdi:weather-lightning-rainy";
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
      return "mdi:weather-partly-cloudy";
  }
}

function getConditionAccent(value) {
  switch (normalizeTextKey(value)) {
    case "sunny":
      return "#ffd65b";
    case "clear_night":
      return "#7ea7ff";
    case "partlycloudy":
      return "#9fd1ff";
    case "cloudy":
      return "#8fa4b8";
    case "rainy":
    case "pouring":
    case "lightning_rainy":
      return "#59aef9";
    case "snowy":
    case "snowy_rainy":
    case "hail":
      return "#a9d8ff";
    case "fog":
      return "#9ca8b7";
    case "windy":
    case "windy_variant":
      return "#7dd7d0";
    case "lightning":
      return "#ffce6b";
    case "exceptional":
      return "#ff7a7a";
    default:
      return "var(--info-color, #71c0ff)";
  }
}

function normalizeConfig(rawConfig) {
  return mergeConfig(DEFAULT_CONFIG, rawConfig || {});
}

class NodaliaWeatherCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["weather"]);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._forecastExpanded = false;
    this._activeForecastView = DEFAULT_CONFIG.forecast_view;
    this._activeForecastType = DEFAULT_CONFIG.forecast_type;
    this._forecastEvents = {};
    this._forecastSubscription = null;
    this._forecastSubscriptionKey = "";
    this._animateForecastOnNextRender = false;
    this._meteoalarmPopupOpen = false;
    this._forecastPopup = null;
    this._forecastHoverPreview = null;
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowPointerMove = this._onShadowPointerMove.bind(this);
    this._onShadowPointerLeave = this._onShadowPointerLeave.bind(this);
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    this.shadowRoot?.addEventListener("pointermove", this._onShadowPointerMove);
    this.shadowRoot?.addEventListener("pointerleave", this._onShadowPointerLeave);
    this._animateContentOnNextRender = true;
    this._ensureForecastSubscription();
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
    this.shadowRoot?.removeEventListener("pointermove", this._onShadowPointerMove);
    this.shadowRoot?.removeEventListener("pointerleave", this._onShadowPointerLeave);
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    this._unsubscribeForecast();
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._activeForecastType = normalizeForecastType(this._config.forecast_type);
    this._activeForecastView = normalizeForecastView(this._config.forecast_view);
    this._forecastExpanded = this._config.show_forecast_details === true;
    this._forecastEvents = {};
    this._forecastPopup = null;
    this._forecastHoverPreview = null;
    this._unsubscribeForecast();
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._render();
  }

  set hass(hass) {
    const nextSignature = this._getRenderSignature(hass);
    this._hass = hass;
    this._ensureForecastSubscription();

    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }

    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    return this._config?.show_forecast_details === true ? 4 : 2;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 2,
      min_columns: 2,
    };
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
      temperature: Number(attrs.temperature ?? -1),
      humidity: Number(attrs.humidity ?? -1),
      pressure: Number(attrs.pressure ?? -1),
      windSpeed: Number(attrs.wind_speed ?? -1),
      windBearing: Number(attrs.wind_bearing ?? -1),
      visibility: Number(attrs.visibility ?? -1),
      precipitation: Number(attrs.precipitation ?? -1),
      showForecastDetails: this._config?.show_forecast_details === true,
      forecastExpanded: this._forecastExpanded,
      activeForecastView: this._activeForecastView,
      activeForecastType: this._activeForecastType,
      forecastPopup: this._forecastPopup?.key || "",
      forecastHoverPreview: this._forecastHoverPreview?.key || "",
      forecastUpdated: String(this._forecastEvents?.[this._activeForecastType]?.forecast?.[0]?.datetime || ""),
      meteoalarm: this._getMeteoalarmSignature(hass),
      meteoalarmPopupOpen: this._meteoalarmPopupOpen,
    });
  }

  _getMeteoalarmState(hass = this._hass) {
    const entityId = String(this._config?.meteoalarm_entity || "").trim();
    return entityId ? hass?.states?.[entityId] || null : null;
  }

  _getMeteoalarmSignature(hass = this._hass) {
    if (this._config?.show_meteoalarm_chip !== true) {
      return "";
    }

    const state = this._getMeteoalarmState(hass);
    const attrs = state?.attributes || {};
    return JSON.stringify({
      entityId: String(this._config?.meteoalarm_entity || ""),
      state: String(state?.state || ""),
      awarenessLevel: String(attrs.awareness_level || ""),
      awarenessType: String(attrs.awareness_type || ""),
      event: String(attrs.event || ""),
      expires: String(attrs.expires || ""),
      headline: String(attrs.headline || ""),
      severity: String(attrs.severity || ""),
    });
  }

  _unsubscribeForecast() {
    if (!this._forecastSubscription) {
      return;
    }

    this._forecastSubscription.then(unsubscribe => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    }).catch(() => {});
    this._forecastSubscription = null;
    this._forecastSubscriptionKey = "";
  }

  _ensureForecastSubscription() {
    if (!this.isConnected || !this._hass || !this._config?.entity || this._config.show_forecast_details !== true) {
      this._unsubscribeForecast();
      return;
    }

    const state = this._hass.states?.[this._config.entity];
    if (!state) {
      this._unsubscribeForecast();
      return;
    }

    const supportedTypes = getSupportedForecastTypes(state);
    const forecastType = supportedTypes.includes(this._activeForecastType)
      ? this._activeForecastType
      : supportedTypes[0] || "daily";
    if (forecastType !== this._activeForecastType) {
      this._activeForecastType = forecastType;
    }

    const subscriptionKey = `${this._config.entity}:${forecastType}`;
    if (subscriptionKey === this._forecastSubscriptionKey && this._forecastSubscription) {
      return;
    }

    this._unsubscribeForecast();
    if (!this._hass.connection?.subscribeMessage) {
      return;
    }

    this._forecastSubscriptionKey = subscriptionKey;
    this._forecastSubscription = this._hass.connection.subscribeMessage(event => {
      this._forecastEvents = {
        ...this._forecastEvents,
        [forecastType]: event,
      };
      this._animateForecastOnNextRender = true;
      this._lastRenderSignature = "";
      this._render();
    }, {
      type: "weather/subscribe_forecast",
      entity_id: this._config.entity,
      forecast_type: forecastType,
    }).catch(() => {
      this._forecastSubscription = null;
      this._forecastSubscriptionKey = "";
    });
  }

  _getTitle(state) {
    const customName = String(this._config?.name || "").trim();
    if (customName) {
      return customName;
    }

    const friendlyName = String(state?.attributes?.friendly_name || "").trim();
    return friendlyName || "Tiempo";
  }

  _getIcon(state) {
    const customIcon = String(this._config?.icon || "").trim();
    if (customIcon) {
      return customIcon;
    }

    return getConditionIcon(state?.state);
  }

  _getAccentColor(state) {
    return getConditionAccent(state?.state);
  }

  _formatTemperature(state) {
    const value = formatNumber(state?.attributes?.temperature);
    const unit = String(state?.attributes?.temperature_unit || "°C").trim();

    if (!value) {
      return "--";
    }

    return `${value}${unit.startsWith("°") ? unit : ` ${unit}`}`;
  }

  _formatHumidity(state) {
    const value = formatNumber(state?.attributes?.humidity);
    return value ? `${value}%` : null;
  }

  _formatWind(state) {
    const value = formatNumber(state?.attributes?.wind_speed);
    const unit = String(state?.attributes?.wind_speed_unit || "").trim();

    if (!value) {
      return null;
    }

    return unit ? `${value} ${unit}` : value;
  }

  _formatPressure(state) {
    const value = formatNumber(state?.attributes?.pressure);
    const unit = String(state?.attributes?.pressure_unit || "").trim();

    if (!value) {
      return null;
    }

    return unit ? `${value} ${unit}` : value;
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

    if (haptics.fallback_vibrate && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection);
    }
  }

  _scheduleEntranceAnimationReset(delay) {
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }

    const safeDelay = clamp(Math.round(Number(delay) || 0), 0, 3000);
    if (!safeDelay || typeof window === "undefined") {
      this._animateContentOnNextRender = false;
      return;
    }

    this._entranceAnimationResetTimer = window.setTimeout(() => {
      this._entranceAnimationResetTimer = 0;
      this._animateContentOnNextRender = false;
    }, safeDelay);
  }

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;

    return {
      enabled: configuredAnimations.enabled !== false,
      buttonBounceDuration: clamp(
        Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration,
        120,
        1200,
      ),
      contentDuration: clamp(
        Number(configuredAnimations.content_duration) || DEFAULT_CONFIG.animations.content_duration,
        140,
        1800,
      ),
    };
  }

  _triggerPressAnimation(element, className = "is-pressing") {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    const animations = this._getAnimationSettings();
    if (!animations.enabled) {
      return;
    }

    element.classList.remove(className);
    element.getBoundingClientRect();
    element.classList.add(className);

    window.setTimeout(() => {
      element.classList.remove(className);
    }, animations.buttonBounceDuration + 40);
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

  _getForecastPointOverlayPosition(actionButton, width, height) {
    const chartElement = actionButton.closest?.(".weather-card__forecast-chart");
    const pointElement = actionButton.querySelector?.(".weather-card__forecast-chart-point");
    const bounds = (pointElement instanceof Element ? pointElement : actionButton).getBoundingClientRect();
    const chartBounds = chartElement instanceof Element
      ? chartElement.getBoundingClientRect()
      : { left: 0, top: 0, width: width + 24, height: height + 24 };
    const pointerX = bounds.left + (bounds.width / 2) - chartBounds.left;
    const pointerY = bounds.top + (bounds.height / 2) - chartBounds.top;
    const safeHalfWidth = Math.min(width / 2, Math.max(chartBounds.width / 2 - 10, 0));
    const left = clamp(pointerX, safeHalfWidth + 10, Math.max(safeHalfWidth + 10, chartBounds.width - safeHalfWidth - 10));
    const vertical = pointerY < Math.min(height + 12, 58) ? "below" : "above";
    const top = vertical === "below"
      ? pointerY + 14
      : pointerY - 14;

    return {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      vertical,
    };
  }

  _setForecastPopupFromPoint(actionButton, options = {}) {
    if (!(actionButton instanceof Element)) {
      return;
    }

    const forecastType = normalizeForecastType(actionButton.dataset.forecastType);
    const series = String(actionButton.dataset.forecastSeries || "high");
    const index = Number(actionButton.dataset.forecastIndex);
    const key = `${forecastType}:${series}:${index}`;
    const shouldToggle = options.toggle === true;

    if (!shouldToggle && this._forecastPopup?.key === key) {
      return;
    }

    if (shouldToggle && this._forecastPopup?.key === key) {
      this._forecastPopup = null;
      this._forecastHoverPreview = null;
      this._lastRenderSignature = "";
      this._render();
      return;
    }

    const popupWidth = 206;
    const popupHeight = forecastType === "daily" ? 194 : 166;
    const position = this._getForecastPointOverlayPosition(actionButton, popupWidth, popupHeight);

    this._forecastPopup = {
      key,
      forecastType,
      index,
      left: position.left,
      series,
      top: position.top,
      vertical: position.vertical,
    };
    this._forecastHoverPreview = null;
    this._lastRenderSignature = "";
    this._render();
  }

  _setForecastHoverPreviewFromPoint(actionButton) {
    if (!(actionButton instanceof Element) || this._forecastPopup) {
      return;
    }

    const forecastType = normalizeForecastType(actionButton.dataset.forecastType);
    const series = String(actionButton.dataset.forecastSeries || "high");
    const index = Number(actionButton.dataset.forecastIndex);
    const key = `${forecastType}:${series}:${index}`;
    if (this._forecastHoverPreview?.key === key) {
      return;
    }

    const previewWidth = forecastType === "daily" ? 190 : 168;
    const position = this._getForecastPointOverlayPosition(actionButton, previewWidth, 48);
    this._forecastHoverPreview = {
      key,
      forecastType,
      index,
      left: position.left,
      series,
      top: position.top,
      vertical: position.vertical,
    };
    this._lastRenderSignature = "";
    this._render();
  }

  _clearForecastHoverPreview() {
    if (!this._forecastHoverPreview) {
      return;
    }

    this._forecastHoverPreview = null;
    this._lastRenderSignature = "";
    this._render();
  }

  _onShadowPointerMove(event) {
    if (event.pointerType && event.pointerType !== "mouse") {
      return;
    }

    const actionButton = event.composedPath().find(node => (
      node instanceof Element && node.dataset?.weatherAction === "open-forecast-point"
    ));
    if (!actionButton) {
      this._clearForecastHoverPreview();
      return;
    }

    this._setForecastHoverPreviewFromPoint(actionButton);
  }

  _onShadowPointerLeave() {
    this._clearForecastHoverPreview();
  }

  _onShadowClick(event) {
    const actionButton = event.composedPath().find(node => node instanceof Element && node.dataset?.weatherAction);
    if (actionButton) {
      event.preventDefault();
      event.stopPropagation();

      if (actionButton.dataset.weatherAction === "noop") {
        return;
      }

      this._triggerHaptic("selection");

      if (actionButton.dataset.weatherAction === "toggle-forecast") {
        this._forecastExpanded = !this._forecastExpanded;
        this._forecastHoverPreview = null;
        this._ensureForecastSubscription();
        this._lastRenderSignature = "";
        this._render();
      } else if (actionButton.dataset.weatherAction === "set-forecast-type") {
        this._activeForecastType = normalizeForecastType(actionButton.dataset.forecastType);
        this._animateForecastOnNextRender = true;
        this._forecastPopup = null;
        this._forecastHoverPreview = null;
        this._ensureForecastSubscription();
        this._lastRenderSignature = "";
        this._render();
      } else if (actionButton.dataset.weatherAction === "set-forecast-view") {
        this._activeForecastView = normalizeForecastView(actionButton.dataset.forecastView);
        this._animateForecastOnNextRender = true;
        this._forecastPopup = null;
        this._forecastHoverPreview = null;
        this._lastRenderSignature = "";
        this._render();
      } else if (actionButton.dataset.weatherAction === "open-forecast-point") {
        this._setForecastPopupFromPoint(actionButton, { toggle: true });
      } else if (actionButton.dataset.weatherAction === "close-forecast-popup") {
        this._forecastPopup = null;
        this._forecastHoverPreview = null;
        this._lastRenderSignature = "";
        this._render();
      } else if (actionButton.dataset.weatherAction === "open-meteoalarm") {
        this._meteoalarmPopupOpen = true;
        this._lastRenderSignature = "";
        this._render();
      } else if (actionButton.dataset.weatherAction === "close-meteoalarm") {
        this._meteoalarmPopupOpen = false;
        this._lastRenderSignature = "";
        this._render();
      }
      return;
    }

    const card = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.weatherCard === "root");
    if (!card || String(this._config?.tap_action || "more-info") === "none") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerPressAnimation(this.shadowRoot.querySelector(".weather-card__content"));
    this._triggerPressAnimation(this.shadowRoot.querySelector(".weather-card__icon"));
    this._performTapAction();
  }

  _renderChip(icon, label, accentColor) {
    if (!label) {
      return "";
    }

    return `
      <div class="weather-card__chip" style="--chip-accent:${escapeHtml(accentColor)};">
        <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
        <span>${escapeHtml(label)}</span>
      </div>
    `;
  }

  _renderMeteoalarmChip() {
    if (this._config?.show_meteoalarm_chip !== true) {
      return "";
    }

    const state = this._getMeteoalarmState();
    const attrs = state?.attributes || {};
    const accentColor = getMeteoalarmAccentColor(state);
    const isActive = state?.state === "on";
    const awareness = getMeteoalarmAwarenessParts(state);
    const label = isActive
      ? String(attrs.event || attrs.headline || awareness.label || "Alerta").trim()
      : state?.state === "off"
        ? "Sin alertas"
        : "Meteoalarm";

    return `
      <button
        type="button"
        class="weather-card__chip weather-card__chip--button weather-card__chip--meteoalarm ${isActive ? "weather-card__chip--alert-active" : ""}"
        style="--chip-accent:${escapeHtml(accentColor)};"
        data-weather-action="open-meteoalarm"
        title="${escapeHtml(label)}"
      >
        <ha-icon icon="${isActive ? "mdi:alert" : "mdi:shield-check"}"></ha-icon>
        <span>${escapeHtml(label)}</span>
      </button>
    `;
  }

  _renderMeteoalarmChipRow(shouldAnimateEntrance) {
    const chipMarkup = this._renderMeteoalarmChip();
    if (!chipMarkup) {
      return "";
    }

    return `<div class="weather-card__alert-row ${shouldAnimateEntrance ? "weather-card__alert-row--entering" : ""}">${chipMarkup}</div>`;
  }

  _renderMeteoalarmPopup() {
    if (!this._meteoalarmPopupOpen || this._config?.show_meteoalarm_chip !== true) {
      return "";
    }

    const state = this._getMeteoalarmState();
    const attrs = state?.attributes || {};
    const accentColor = getMeteoalarmAccentColor(state);
    const awareness = getMeteoalarmAwarenessParts(state);
    const title = state?.state === "on"
      ? String(attrs.headline || attrs.event || "Alerta meteorologica").trim()
      : state?.state === "off"
        ? "Sin alertas meteorologicas"
        : "Meteoalarm";
    const rows = [
      ["Nivel", translateMeteoalarmValue(awareness.label || attrs.severity || "")],
      ["Tipo", attrs.event || attrs.awareness_type || ""],
      ["Inicio", formatMeteoalarmDate(attrs.onset || attrs.effective)],
      ["Fin", formatMeteoalarmDate(attrs.expires)],
      ["Severidad", translateMeteoalarmValue(attrs.severity || "")],
      ["Urgencia", translateMeteoalarmValue(attrs.urgency || "")],
      ["Certeza", translateMeteoalarmValue(attrs.certainty || "")],
    ].filter(([, value]) => String(value || "").trim());
    const description = String(attrs.description || "").trim();
    const instruction = String(attrs.instruction || "").trim();

    return `
      <div class="weather-alert-backdrop" data-weather-action="close-meteoalarm">
        <section class="weather-alert-panel" style="--alert-accent:${escapeHtml(accentColor)};" data-weather-action="noop" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
          <div class="weather-alert-panel__header">
            <div class="weather-alert-panel__icon">
              <ha-icon icon="${state?.state === "on" ? "mdi:alert" : "mdi:shield-check"}"></ha-icon>
            </div>
            <div class="weather-alert-panel__copy">
              <div class="weather-alert-panel__eyebrow">Meteoalarm</div>
              <div class="weather-alert-panel__title">${escapeHtml(title)}</div>
            </div>
            <button type="button" class="weather-alert-panel__close" data-weather-action="close-meteoalarm" aria-label="Cerrar">
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          ${
            rows.length
              ? `<div class="weather-alert-panel__rows">${rows.map(([label, value]) => `
                <div class="weather-alert-panel__row">
                  <span>${escapeHtml(label)}</span>
                  <strong>${escapeHtml(value)}</strong>
                </div>
              `).join("")}</div>`
              : ""
          }
          ${description ? `<div class="weather-alert-panel__section"><h3>Descripcion</h3><p>${escapeHtml(description)}</p></div>` : ""}
          ${instruction ? `<div class="weather-alert-panel__section"><h3>Instrucciones</h3><p>${escapeHtml(instruction)}</p></div>` : ""}
        </section>
      </div>
    `;
  }

  _getForecastItems(type, state) {
    const eventForecast = this._forecastEvents?.[type]?.forecast;
    if (Array.isArray(eventForecast) && eventForecast.length) {
      return eventForecast;
    }

    const legacyForecast = state?.attributes?.forecast;
    return Array.isArray(legacyForecast) ? legacyForecast : [];
  }

  _renderForecastChart(items, type, state) {
    const sourcePoints = items
      .map((item, index) => ({ index, item }))
      .filter(point => Number.isFinite(getForecastTemperatureValue(point.item, type)));

    if (sourcePoints.length < 2) {
      return `<div class="weather-card__forecast-empty">No hay suficientes datos para mostrar el gráfico.</div>`;
    }

    const hasDailyLow = type === "daily" && sourcePoints.some(point => Number.isFinite(Number(point.item?.templow)));
    const rawHighPoints = sourcePoints.map(point => ({
      ...point,
      value: getForecastTemperatureSeriesValue(point.item, "high"),
    })).filter(point => Number.isFinite(point.value));
    const rawLowPoints = hasDailyLow
      ? sourcePoints.map(point => ({
        ...point,
        value: getForecastTemperatureSeriesValue(point.item, "low"),
      })).filter(point => Number.isFinite(point.value))
      : [];
    const highPoints = rawHighPoints.length >= 2 ? rawHighPoints : rawLowPoints;
    const lowPoints = rawHighPoints.length >= 2 ? rawLowPoints : [];

    if (highPoints.length < 2) {
      return `<div class="weather-card__forecast-empty">No hay suficientes datos para mostrar el gráfico.</div>`;
    }

    const showChartLabels = this._config?.forecast_chart_labels === true;
    const values = [...highPoints, ...lowPoints].map(point => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = Math.max(maxValue - minValue, 1);
    const width = showChartLabels ? 640 : 820;
    const height = showChartLabels ? 150 : 102;
    const padding = showChartLabels
      ? { top: 24, right: 16, bottom: 56, left: 16 }
      : { top: 12, right: 5, bottom: 12, left: 5 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const dateLabelY = height - 10;
    const lowLabelY = dateLabelY - 18;

    const getCoordinates = points => points.map((point, pointIndex) => {
      const x = padding.left + (points.length === 1 ? plotWidth / 2 : (plotWidth * pointIndex) / (points.length - 1));
      const y = padding.top + plotHeight - ((point.value - minValue) / valueRange) * plotHeight;
      return {
        ...point,
        x,
        y,
      };
    });

    const highCoordinates = getCoordinates(highPoints);
    const lowCoordinates = getCoordinates(lowPoints);
    const pathFromCoordinates = coordinates => coordinates
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(" ");
    const smoothPathFromCoordinates = coordinates => {
      if (coordinates.length < 3) {
        return pathFromCoordinates(coordinates);
      }

      return coordinates.reduce((path, point, index) => {
        if (index === 0) {
          return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
        }

        const previous = coordinates[index - 1];
        const controlOffset = Math.max(18, Math.min(54, (point.x - previous.x) * 0.42));
        return `${path} C ${(previous.x + controlOffset).toFixed(1)} ${previous.y.toFixed(1)} ${(point.x - controlOffset).toFixed(1)} ${point.y.toFixed(1)} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      }, "");
    };
    const highPath = smoothPathFromCoordinates(highCoordinates);
    const lowPath = smoothPathFromCoordinates(lowCoordinates);
    const areaPath = `${highPath} L ${highCoordinates[highCoordinates.length - 1].x.toFixed(1)} ${height - padding.bottom} L ${highCoordinates[0].x.toFixed(1)} ${height - padding.bottom} Z`;
    const lowAreaPath = lowPath
      ? `${lowPath} L ${lowCoordinates[lowCoordinates.length - 1].x.toFixed(1)} ${height - padding.bottom} L ${lowCoordinates[0].x.toFixed(1)} ${height - padding.bottom} Z`
      : "";
    const chartAccent = getConditionAccent(state?.state);
    const chartFillId = `weather-chart-fill-${type}`;
    const colorChartEnabled = this._config?.forecast_chart_color_enabled === true;
    const colorChartMode = normalizeForecastChartColorMode(this._config?.forecast_chart_color_mode);
    const highGradientId = `weather-chart-line-${type}-high`;
    const lowGradientId = `weather-chart-line-${type}-low`;
    const lowFillId = `weather-chart-fill-${type}-low`;
    const highFillMaskId = `weather-chart-fill-mask-${type}-high`;
    const lowFillMaskId = `weather-chart-fill-mask-${type}-low`;
    const unit = String(state?.attributes?.temperature_unit || "°").trim() || "°";
    const unitLabel = unit.startsWith("°") ? unit : ` ${unit}`;
    const precipitationUnit = String(state?.attributes?.precipitation_unit || "").trim();
    const allCoordinates = [
      ...highCoordinates.map(point => ({ ...point, series: "high" })),
      ...lowCoordinates.map(point => ({ ...point, series: "low" })),
    ];
    const renderGradientStops = (coordinates, opacity = "") => coordinates.map((point, index) => {
      const offset = coordinates.length <= 1 ? 0 : (index / (coordinates.length - 1)) * 100;
      const color = getForecastChartPointColor(point, colorChartMode, state?.state);
      return `<stop offset="${offset.toFixed(2)}%" stop-color="${escapeHtml(color)}"${opacity ? ` stop-opacity="${opacity}"` : ""}></stop>`;
    }).join("");
    const popupPoint = allCoordinates.find(point => (
      this._forecastPopup?.forecastType === type
      && this._forecastPopup?.series === point.series
      && this._forecastPopup?.index === point.index
    ));
    const hoverPreviewPoint = allCoordinates.find(point => (
      this._forecastHoverPreview?.forecastType === type
      && this._forecastHoverPreview?.series === point.series
      && this._forecastHoverPreview?.index === point.index
    ));
    const popupMarkup = popupPoint ? (() => {
      const item = popupPoint.item || {};
      const accent = getConditionAccent(item?.condition || state?.state);
      const precipitationLabel = getForecastPrecipitationLabel(item, precipitationUnit);
      const highLabel = formatNumber(getForecastTemperatureSeriesValue(item, "high"));
      const lowLabel = formatNumber(getForecastTemperatureSeriesValue(item, "low"));
      const humidityLabel = formatNumber(item?.humidity);
      const windLabel = formatNumber(item?.wind_speed);
      const windUnit = String(state?.attributes?.wind_speed_unit || item?.wind_speed_unit || "").trim();
      const popupRows = [
        type === "daily" && highLabel ? ["Máxima", `${highLabel}${unitLabel}`] : null,
        type === "daily" && lowLabel ? ["Mínima", `${lowLabel}${unitLabel}`] : null,
        type !== "daily" ? ["Temperatura", `${formatNumber(popupPoint.value)}${unitLabel}`] : null,
        precipitationLabel ? ["Lluvia", precipitationLabel] : null,
        humidityLabel ? ["Humedad", `${humidityLabel}%`] : null,
        windLabel ? ["Viento", windUnit ? `${windLabel} ${windUnit}` : windLabel] : null,
      ].filter(Boolean);
      const vertical = this._forecastPopup?.vertical === "below" ? "below" : "above";
      const popupLeft = this._forecastPopup?.left || "50%";
      const popupTop = this._forecastPopup?.top || "50%";

      return `
        <div
          class="weather-card__forecast-popup weather-card__forecast-popup--${vertical}"
          style="--forecast-accent:${escapeHtml(accent)}; --forecast-popup-left:${escapeHtml(popupLeft)}; --forecast-popup-top:${escapeHtml(popupTop)};"
          data-weather-action="noop"
        >
          <button type="button" class="weather-card__forecast-popup-close" data-weather-action="close-forecast-popup" aria-label="Cerrar detalle">
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
          <div class="weather-card__forecast-popup-time">${escapeHtml(formatForecastDateTime(item?.datetime, type))}</div>
          <div class="weather-card__forecast-popup-main">
            <ha-icon icon="${escapeHtml(getConditionIcon(item?.condition || state?.state))}"></ha-icon>
            <span>${escapeHtml(translateCondition(item?.condition || ""))}</span>
          </div>
          <div class="weather-card__forecast-popup-rows">
            ${popupRows.map(([label, value]) => `
              <div>
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    })() : "";
    const hoverPreviewMarkup = hoverPreviewPoint ? (() => {
      const item = hoverPreviewPoint.item || {};
      const accent = getConditionAccent(item?.condition || state?.state);
      const vertical = this._forecastHoverPreview?.vertical === "below" ? "below" : "above";
      const left = this._forecastHoverPreview?.left || "50%";
      const top = this._forecastHoverPreview?.top || "50%";
      const highValue = getForecastTemperatureSeriesValue(item, "high");
      const lowValue = getForecastTemperatureSeriesValue(item, "low");
      const temperatureLabel = type === "daily" && Number.isFinite(highValue) && Number.isFinite(lowValue)
        ? `${formatCompactTemperature(highValue, unitLabel)} / ${formatCompactTemperature(lowValue, unitLabel)}`
        : formatCompactTemperature(hoverPreviewPoint.value, unitLabel);

      return `
        <div
          class="weather-card__forecast-hover-preview weather-card__forecast-hover-preview--${vertical}"
          style="--forecast-accent:${escapeHtml(accent)}; --forecast-preview-left:${escapeHtml(left)}; --forecast-preview-top:${escapeHtml(top)};"
          data-weather-action="noop"
        >
          <ha-icon icon="${escapeHtml(getConditionIcon(item?.condition || state?.state))}"></ha-icon>
          <span>${escapeHtml(formatForecastDateTime(item?.datetime, type))}</span>
          ${temperatureLabel ? `<strong>${escapeHtml(temperatureLabel)}</strong>` : ""}
        </div>
      `;
    })() : "";

    return `
      <div class="weather-card__forecast-chart" style="--forecast-chart-height:${height + 8}px; --forecast-chart-svg-height:${height}px;" role="img" aria-label="Gráfico de previsión ${type === "hourly" ? "por horas" : "semanal"}">
        <svg viewBox="0 0 ${width} ${height}">
          <defs>
            ${
              colorChartEnabled
                ? `<linearGradient id="${chartFillId}" x1="0" x2="1" y1="0" y2="0">
                    ${renderGradientStops(highCoordinates, "0.2")}
                  </linearGradient>`
                : `<linearGradient id="${chartFillId}" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="${escapeHtml(chartAccent)}" stop-opacity="0.26"></stop>
                    <stop offset="58%" stop-color="${escapeHtml(chartAccent)}" stop-opacity="0.11"></stop>
                    <stop offset="100%" stop-color="${escapeHtml(chartAccent)}" stop-opacity="0"></stop>
                  </linearGradient>`
            }
            ${colorChartEnabled ? `
              <linearGradient id="${highFillMaskId}-fade" gradientUnits="userSpaceOnUse" x1="0" y1="${padding.top}" x2="0" y2="${height - padding.bottom}">
                <stop offset="0%" stop-color="#fff" stop-opacity="0.86"></stop>
                <stop offset="34%" stop-color="#fff" stop-opacity="0.34"></stop>
                <stop offset="70%" stop-color="#fff" stop-opacity="0.08"></stop>
                <stop offset="100%" stop-color="#fff" stop-opacity="0"></stop>
              </linearGradient>
              <mask id="${highFillMaskId}" x="0" y="0" width="${width}" height="${height}" maskUnits="userSpaceOnUse">
                <rect x="0" y="0" width="${width}" height="${height}" fill="url(#${highFillMaskId}-fade)"></rect>
              </mask>
              <linearGradient id="${highGradientId}" x1="0" x2="1" y1="0" y2="0">
                ${renderGradientStops(highCoordinates)}
              </linearGradient>
              ${lowCoordinates.length ? `
                <linearGradient id="${lowFillMaskId}-fade" gradientUnits="userSpaceOnUse" x1="0" y1="${padding.top}" x2="0" y2="${height - padding.bottom}">
                  <stop offset="0%" stop-color="#fff" stop-opacity="0.86"></stop>
                  <stop offset="34%" stop-color="#fff" stop-opacity="0.34"></stop>
                  <stop offset="70%" stop-color="#fff" stop-opacity="0.08"></stop>
                  <stop offset="100%" stop-color="#fff" stop-opacity="0"></stop>
                </linearGradient>
                <mask id="${lowFillMaskId}" x="0" y="0" width="${width}" height="${height}" maskUnits="userSpaceOnUse">
                  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#${lowFillMaskId}-fade)"></rect>
                </mask>
                <linearGradient id="${lowGradientId}" x1="0" x2="1" y1="0" y2="0">
                  ${renderGradientStops(lowCoordinates)}
                </linearGradient>
                <linearGradient id="${lowFillId}" x1="0" x2="1" y1="0" y2="0">
                  ${renderGradientStops(lowCoordinates, "0.2")}
                </linearGradient>
              ` : ""}
            ` : ""}
          </defs>
          <path class="weather-card__forecast-chart-area" style="fill:url(#${chartFillId});" ${colorChartEnabled ? `mask="url(#${highFillMaskId})"` : ""} d="${areaPath}"></path>
          ${colorChartEnabled && lowAreaPath ? `<path class="weather-card__forecast-chart-area weather-card__forecast-chart-area--low" style="fill:url(#${lowFillId});" mask="url(#${lowFillMaskId})" d="${lowAreaPath}"></path>` : ""}
          ${lowPath ? `<path class="weather-card__forecast-chart-line weather-card__forecast-chart-line--low" style="${colorChartEnabled ? `stroke:url(#${lowGradientId});` : ""}" pathLength="1" d="${lowPath}"></path>` : ""}
          <path class="weather-card__forecast-chart-line weather-card__forecast-chart-line--high" style="${colorChartEnabled ? `stroke:url(#${highGradientId});` : ""}" pathLength="1" d="${highPath}"></path>
          ${highCoordinates.map((point, coordinateIndex) => `
            <g class="weather-card__forecast-chart-hit" data-weather-action="open-forecast-point" data-forecast-type="${escapeHtml(type)}" data-forecast-series="high" data-forecast-index="${point.index}" role="button" tabindex="0" aria-label="${escapeHtml(formatForecastDateTime(point.item?.datetime, type))}: ${escapeHtml(formatNumber(point.value))}${escapeHtml(unitLabel)}">
              <circle class="weather-card__forecast-chart-touch" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="22"></circle>
              <circle class="weather-card__forecast-chart-point weather-card__forecast-chart-point--high" style="--forecast-delay:${Math.min(point.index, 8) * 34}ms; ${colorChartEnabled ? `--forecast-point-color:${escapeHtml(getForecastChartPointColor(point, colorChartMode, state?.state))};` : ""}" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="5.7"></circle>
              ${showChartLabels ? `<text class="weather-card__forecast-chart-value" x="${point.x.toFixed(1)}" y="${Math.max(13, point.y - 14).toFixed(1)}">${escapeHtml(formatNumber(point.value))}${escapeHtml(unitLabel)}</text>` : ""}
              ${showChartLabels && (coordinateIndex === 0 || coordinateIndex === highCoordinates.length - 1)
                ? `<text class="weather-card__forecast-chart-label" x="${point.x.toFixed(1)}" y="${dateLabelY}">${escapeHtml(formatForecastDateTime(point.item?.datetime, type))}</text>`
                : ""}
            </g>
          `).join("")}
          ${lowCoordinates.map(point => `
            <g class="weather-card__forecast-chart-hit" data-weather-action="open-forecast-point" data-forecast-type="${escapeHtml(type)}" data-forecast-series="low" data-forecast-index="${point.index}" role="button" tabindex="0" aria-label="${escapeHtml(formatForecastDateTime(point.item?.datetime, type))}: ${escapeHtml(formatNumber(point.value))}${escapeHtml(unitLabel)}">
              <circle class="weather-card__forecast-chart-touch" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="21"></circle>
              <circle class="weather-card__forecast-chart-point weather-card__forecast-chart-point--low" style="--forecast-delay:${Math.min(point.index, 8) * 34}ms; ${colorChartEnabled ? `--forecast-point-color:${escapeHtml(getForecastChartPointColor(point, colorChartMode, state?.state))};` : ""}" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="5"></circle>
              ${showChartLabels ? `<text class="weather-card__forecast-chart-value weather-card__forecast-chart-value--low" x="${point.x.toFixed(1)}" y="${Math.min(lowLabelY, point.y + 31).toFixed(1)}">${escapeHtml(formatNumber(point.value))}${escapeHtml(unitLabel)}</text>` : ""}
            </g>
          `).join("")}
        </svg>
        ${popupMarkup}
        ${hoverPreviewMarkup}
      </div>
    `;
  }

  _renderForecastDetails(state, accentColor, shouldAnimateEntrance, shouldAnimateForecast = false) {
    if (this._config?.show_forecast_details !== true) {
      return "";
    }

    const supportedTypes = getSupportedForecastTypes(state);
    const activeType = supportedTypes.includes(this._activeForecastType)
      ? this._activeForecastType
      : supportedTypes[0] || "daily";
    const forecastItems = this._getForecastItems(activeType, state);
    const slotCount = activeType === "hourly"
      ? clamp(Number(this._config?.forecast_slots_hourly) || DEFAULT_CONFIG.forecast_slots_hourly, 3, 24)
      : clamp(Number(this._config?.forecast_slots_daily) || DEFAULT_CONFIG.forecast_slots_daily, 3, 14);
    const visibleItems = forecastItems.slice(0, slotCount);
    const precipitationUnit = String(state?.attributes?.precipitation_unit || "").trim();
    const activeView = normalizeForecastView(this._activeForecastView);

    return `
      <section class="weather-card__forecast ${shouldAnimateEntrance ? "weather-card__forecast--entering" : ""} ${shouldAnimateForecast ? "weather-card__forecast--switching" : ""}">
        <div class="weather-card__forecast-header ${this._config.show_forecast_toggle === false ? "weather-card__forecast-header--tabs-only" : ""}">
          ${
            this._config.show_forecast_toggle === false
              ? ""
              : `
                <div class="weather-card__forecast-tabs" role="tablist" aria-label="Vista de la previsión">
                  <button type="button" class="weather-card__forecast-tab ${activeView === "cards" ? "weather-card__forecast-tab--active" : ""}" data-weather-action="set-forecast-view" data-forecast-view="cards" role="tab" aria-selected="${activeView === "cards" ? "true" : "false"}">
                    <ha-icon icon="mdi:view-grid-outline"></ha-icon>
                    <span>Tarjetas</span>
                  </button>
                  <button type="button" class="weather-card__forecast-tab ${activeView === "chart" ? "weather-card__forecast-tab--active" : ""}" data-weather-action="set-forecast-view" data-forecast-view="chart" role="tab" aria-selected="${activeView === "chart" ? "true" : "false"}">
                    <ha-icon icon="mdi:chart-line"></ha-icon>
                    <span>Gráfico</span>
                  </button>
                </div>
              `
          }
          ${
            this._forecastExpanded
              ? `
                <div class="weather-card__forecast-tabs" role="tablist">
                  ${supportedTypes.includes("hourly") ? `
                    <button type="button" class="weather-card__forecast-tab ${activeType === "hourly" ? "weather-card__forecast-tab--active" : ""}" data-weather-action="set-forecast-type" data-forecast-type="hourly" role="tab" aria-selected="${activeType === "hourly" ? "true" : "false"}">Horas</button>
                  ` : ""}
                  ${supportedTypes.includes("daily") ? `
                    <button type="button" class="weather-card__forecast-tab ${activeType === "daily" ? "weather-card__forecast-tab--active" : ""}" data-weather-action="set-forecast-type" data-forecast-type="daily" role="tab" aria-selected="${activeType === "daily" ? "true" : "false"}">Semana</button>
                  ` : ""}
                </div>
              `
              : ""
          }
        </div>
        ${
          this._forecastExpanded
            ? `
              ${
                activeView === "chart"
                  ? this._renderForecastChart(visibleItems, activeType, state)
                  : `
                    <div class="weather-card__forecast-strip">
                      ${
                        visibleItems.length
                          ? visibleItems.map((item, index) => {
                            const precipitationLabel = getForecastPrecipitationLabel(item, precipitationUnit);
                            return `
                              <article class="weather-card__forecast-item" style="--forecast-accent:${escapeHtml(getConditionAccent(item?.condition || state?.state))}; --forecast-delay:${Math.min(index, 8) * 28}ms;">
                                <div class="weather-card__forecast-time">${escapeHtml(formatForecastDateTime(item?.datetime, activeType))}</div>
                                <ha-icon icon="${escapeHtml(getConditionIcon(item?.condition || state?.state))}"></ha-icon>
                                <div class="weather-card__forecast-temp">${escapeHtml(formatForecastTemperature(item, activeType))}</div>
                                <div class="weather-card__forecast-condition">${escapeHtml(translateCondition(item?.condition || ""))}</div>
                                ${precipitationLabel ? `<div class="weather-card__forecast-rain"><ha-icon icon="mdi:weather-rainy"></ha-icon><span>${escapeHtml(precipitationLabel)}</span></div>` : ""}
                              </article>
                            `;
                          }).join("")
                          : `<div class="weather-card__forecast-empty">Sin previsión ${activeType === "hourly" ? "por horas" : "semanal"} disponible.</div>`
                      }
                    </div>
                  `
              }
            `
            : ""
        }
      </section>
    `;
  }

  _renderEmptyState() {
    return `
      <ha-card class="weather-card weather-card--empty">
        <div class="weather-card__empty-title">Nodalia Weather Card</div>
        <div class="weather-card__empty-text">Configura \`entity\` para mostrar el tiempo.</div>
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
    const icon = this._getIcon(state);
    const accentColor = this._getAccentColor(state);
    const showUnavailableBadge = isUnavailableState(state);
    const conditionLabel = translateCondition(state?.state);
    const temperatureLabel = this._formatTemperature(state);
    const chips = [
      config.show_humidity_chip !== false
        ? this._renderChip("mdi:water-percent", this._formatHumidity(state), accentColor)
        : "",
      config.show_wind_chip !== false
        ? this._renderChip("mdi:weather-windy", this._formatWind(state), accentColor)
        : "",
      config.show_pressure_chip === true
        ? this._renderChip("mdi:gauge", this._formatPressure(state), accentColor)
        : "",
    ].filter(Boolean);
    const tapEnabled = String(config.tap_action || "more-info") !== "none";
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const shouldAnimateForecast = animations.enabled && this._animateForecastOnNextRender;
    const configuredBorder = String(styles.card.border || "").trim();
    const defaultBorder = String(DEFAULT_CONFIG.styles.card.border || "").trim();
    const cardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 9%, ${styles.card.background}) 56%, ${styles.card.background} 100%)`;
    const cardBorder = !configuredBorder || configuredBorder === defaultBorder
      ? `1px solid color-mix(in srgb, ${accentColor} 28%, var(--divider-color))`
      : configuredBorder;
    const cardShadow = `${styles.card.box_shadow}, 0 16px 32px color-mix(in srgb, ${accentColor} 10%, rgba(0, 0, 0, 0.18))`;
    const forecastMarkup = this._renderForecastDetails(state, accentColor, shouldAnimateEntrance, shouldAnimateForecast);
    const meteoalarmChipRowMarkup = this._renderMeteoalarmChipRow(shouldAnimateEntrance);
    const meteoalarmPopupMarkup = this._renderMeteoalarmPopup();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --weather-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --weather-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          background:
            linear-gradient(180deg, color-mix(in srgb, ${accentColor} 15%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)), rgba(255, 255, 255, 0) 44%),
            ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          overflow: ${this._forecastPopup || this._forecastHoverPreview ? "visible" : "hidden"};
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        ha-card::before {
          background: linear-gradient(180deg, color-mix(in srgb, ${accentColor} 16%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)), rgba(255, 255, 255, 0));
          border-radius: inherit;
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .weather-card--clickable {
          cursor: pointer;
        }

        .weather-card__content {
          cursor: ${tapEnabled ? "pointer" : "default"};
          display: grid;
          gap: ${styles.card.gap};
          min-width: 0;
          padding: ${styles.card.padding};
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease;
          will-change: transform;
          z-index: 1;
        }

        .weather-card__content.is-pressing {
          animation: weather-card-content-bounce var(--weather-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .weather-card__hero {
          display: grid;
          gap: 12px;
          min-width: 0;
        }

        .weather-card__hero--no-alert {
          gap: 6px;
        }

        .weather-card__topline {
          align-items: flex-start;
          display: flex;
          gap: 12px;
          justify-content: space-between;
          min-width: 0;
        }

        .weather-card__main {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: ${styles.icon.size} minmax(0, 1fr);
          min-width: 0;
        }

        .weather-card__hero--entering {
          animation: weather-card-fade-up calc(var(--weather-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .weather-card__icon {
          align-items: center;
          background: ${styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 22px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent),
            0 14px 28px rgba(0, 0, 0, 0.14);
          color: ${styles.icon.color};
          display: inline-flex;
          height: ${styles.icon.size};
          justify-content: center;
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease, color 180ms ease;
          will-change: transform;
          width: ${styles.icon.size};
        }

        .weather-card__icon--entering {
          animation: weather-card-bubble-bloom calc(var(--weather-card-content-duration) * 0.92) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 40ms;
        }

        .weather-card__icon.is-pressing {
          animation: weather-card-bubble-bounce var(--weather-card-button-bounce-duration) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
        }

        .weather-card__icon ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.5);
        }

        .weather-card__unavailable-badge {
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

        .weather-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          width: 11px;
        }

        .weather-card__copy {
          display: grid;
          gap: 10px;
          min-width: 0;
        }

        .weather-card__copy--entering {
          animation: weather-card-fade-up calc(var(--weather-card-content-duration) * 0.92) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 70ms;
        }

        .weather-card__title {
          flex: 1 1 auto;
          font-size: ${styles.title_size};
          font-weight: 700;
          line-height: 1.2;
          min-width: 0;
        }

        .weather-card__chips {
          display: flex;
          flex: 0 1 auto;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
          margin-left: auto;
          min-width: 0;
        }

        .weather-card__chips--entering {
          animation: weather-card-fade-up calc(var(--weather-card-content-duration) * 0.94) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 110ms;
        }

        .weather-card__chips--entering .weather-card__chip {
          animation: weather-card-chip-pop calc(var(--weather-card-content-duration) * 0.58) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
        }

        .weather-card__chips--entering .weather-card__chip:nth-child(2) {
          animation-delay: 35ms;
        }

        .weather-card__chips--entering .weather-card__chip:nth-child(3) {
          animation-delay: 70ms;
        }

        .weather-card__alert-row {
          display: flex;
          justify-content: flex-start;
          min-width: 0;
        }

        .weather-card__alert-row--entering {
          animation: weather-card-fade-up calc(var(--weather-card-content-duration) * 0.94) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 88ms;
        }

        .weather-card__chip {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--chip-accent) 18%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color: var(--primary-text-color);
          display: inline-flex;
          gap: 6px;
          height: ${styles.chip_height};
          line-height: 1;
          margin: 0;
          padding: ${styles.chip_padding};
          transition: background 160ms ease, border-color 160ms ease, box-shadow 180ms ease, transform 180ms cubic-bezier(0.2, 0.9, 0.24, 1);
          white-space: nowrap;
        }

        .weather-card__chip:hover {
          transform: translateY(-1px);
        }

        .weather-card__chip--button {
          cursor: pointer;
          font: inherit;
          max-width: min(100%, 320px);
          min-width: 0;
          overflow: visible;
          transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
        }

        .weather-card__chip--button:hover {
          background: color-mix(in srgb, var(--chip-accent) 14%, color-mix(in srgb, var(--primary-text-color) 6%, transparent));
        }

        .weather-card__chip--button:active {
          transform: scale(0.97);
        }

        .weather-card__chip--alert-active {
          background: color-mix(in srgb, var(--chip-accent) 18%, color-mix(in srgb, var(--primary-text-color) 5%, transparent));
          border-color: color-mix(in srgb, var(--chip-accent) 45%, transparent);
        }

        .weather-card__chip--meteoalarm {
          max-width: 100%;
        }

        .weather-card__chip ha-icon {
          --mdc-icon-size: 13px;
          color: var(--chip-accent);
        }

        .weather-card__chip span {
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          min-width: 0;
          overflow: visible;
          text-overflow: ellipsis;
        }

        .weather-alert-backdrop {
          align-items: center;
          background: rgba(0, 0, 0, 0.46);
          display: flex;
          inset: 0;
          justify-content: center;
          padding: 16px;
          position: fixed;
          z-index: 2147483000;
        }

        .weather-alert-panel {
          animation: weather-card-alert-panel calc(var(--weather-card-content-duration) * 0.68) cubic-bezier(0.16, 0.84, 0.22, 1) both;
          background: color-mix(in srgb, var(--alert-accent) 10%, var(--ha-card-background, #1f1f24));
          border: 1px solid color-mix(in srgb, var(--alert-accent) 35%, var(--divider-color));
          border-radius: 24px;
          box-shadow: 0 24px 56px rgba(0, 0, 0, 0.34);
          color: var(--primary-text-color);
          display: grid;
          gap: 14px;
          max-height: min(680px, calc(100vh - 32px));
          max-width: 520px;
          overflow: auto;
          padding: 16px;
          width: min(520px, calc(100vw - 32px));
          transform-origin: 50% 0%;
        }

        .weather-alert-panel__header {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: 42px minmax(0, 1fr) 36px;
        }

        .weather-alert-panel__icon,
        .weather-alert-panel__close {
          align-items: center;
          border-radius: 999px;
          display: inline-flex;
          height: 36px;
          justify-content: center;
          width: 36px;
        }

        .weather-alert-panel__icon {
          background: color-mix(in srgb, var(--alert-accent) 24%, transparent);
          color: var(--alert-accent);
        }

        .weather-alert-panel__close {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          color: var(--primary-text-color);
          cursor: pointer;
          margin: 0;
          padding: 0;
        }

        .weather-alert-panel__icon ha-icon,
        .weather-alert-panel__close ha-icon {
          --mdc-icon-size: 18px;
        }

        .weather-alert-panel__copy {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .weather-alert-panel__eyebrow {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .weather-alert-panel__title {
          font-size: 16px;
          font-weight: 800;
          line-height: 1.25;
        }

        .weather-alert-panel__rows {
          display: grid;
          gap: 8px;
        }

        .weather-alert-panel__row {
          align-items: baseline;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        .weather-alert-panel__row span {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 700;
        }

        .weather-alert-panel__row strong {
          font-size: 12px;
          line-height: 1.25;
          text-align: right;
        }

        .weather-alert-panel__section {
          display: grid;
          gap: 5px;
        }

        .weather-alert-panel__section h3 {
          font-size: 12px;
          margin: 0;
        }

        .weather-alert-panel__section p {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.45;
          margin: 0;
          white-space: pre-line;
        }

        .weather-card__metrics {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .weather-card__metrics--entering {
          animation: weather-card-fade-up calc(var(--weather-card-content-duration) * 0.94) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 95ms;
        }

        .weather-card__temperature {
          font-size: ${styles.temperature_size};
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1;
        }

        .weather-card__condition {
          color: var(--secondary-text-color);
          font-size: ${styles.condition_size};
          font-weight: 600;
          line-height: 1.3;
        }

        .weather-card__forecast {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .weather-card__forecast--entering {
          animation: weather-card-fade-up calc(var(--weather-card-content-duration) * 0.96) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 130ms;
        }

        .weather-card__forecast--switching .weather-card__forecast-strip,
        .weather-card__forecast--switching .weather-card__forecast-chart {
          animation: weather-card-panel-swap calc(var(--weather-card-content-duration) * 0.86) cubic-bezier(0.18, 0.9, 0.22, 1.08) both;
        }

        .weather-card__forecast-header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
          min-width: 0;
        }

        .weather-card__forecast-header--tabs-only {
          justify-content: flex-end;
        }

        .weather-card__forecast-toggle,
        .weather-card__forecast-tab {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, ${accentColor} 16%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 11px;
          font-weight: 800;
          gap: 5px;
          height: 28px;
          justify-content: center;
          line-height: 1;
          padding: 0 10px;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 180ms ease, transform 180ms cubic-bezier(0.2, 0.9, 0.24, 1);
          white-space: nowrap;
        }

        .weather-card__forecast-toggle:hover,
        .weather-card__forecast-tab:hover {
          background: color-mix(in srgb, ${accentColor} 14%, color-mix(in srgb, var(--primary-text-color) 6%, transparent));
          box-shadow: 0 8px 18px color-mix(in srgb, ${accentColor} 12%, transparent);
          transform: translateY(-1px);
        }

        .weather-card__forecast-toggle:active,
        .weather-card__forecast-tab:active {
          transform: scale(0.97);
        }

        .weather-card__forecast-toggle ha-icon {
          --mdc-icon-size: 16px;
        }

        .weather-card__forecast-tab ha-icon {
          --mdc-icon-size: 14px;
        }

        .weather-card__forecast-tabs {
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border-radius: 999px;
          display: inline-flex;
          gap: 3px;
          padding: 3px;
        }

        .weather-card__forecast-tab {
          background: transparent;
          border-color: transparent;
          height: 24px;
          padding: 0 9px;
        }

        .weather-card__forecast-tab--active {
          background: color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 7%, transparent));
          border-color: color-mix(in srgb, ${accentColor} 35%, transparent);
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 10%, transparent);
        }

        .weather-card__forecast-strip {
          display: grid;
          gap: 8px;
          grid-auto-columns: minmax(74px, 1fr);
          grid-auto-flow: column;
          min-width: 0;
          overflow-x: auto;
          padding: 5px 0 3px;
          scrollbar-width: thin;
        }

        .weather-card__forecast-item {
          align-content: start;
          background: color-mix(in srgb, var(--forecast-accent) 9%, color-mix(in srgb, var(--primary-text-color) 5%, transparent));
          border: 1px solid color-mix(in srgb, var(--forecast-accent) 18%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 18px;
          display: grid;
          gap: 5px;
          justify-items: center;
          min-height: 114px;
          min-width: 74px;
          padding: 9px 7px;
          text-align: center;
          transform-origin: center;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms cubic-bezier(0.2, 0.9, 0.24, 1);
        }

        .weather-card__forecast-item:hover {
          box-shadow: 0 10px 22px color-mix(in srgb, var(--forecast-accent) 12%, transparent);
          transform: translateY(-2px) scale(1.015);
        }

        .weather-card__forecast--entering .weather-card__forecast-item,
        .weather-card__forecast--switching .weather-card__forecast-item {
          animation: weather-card-item-rise calc(var(--weather-card-content-duration) * 0.74) cubic-bezier(0.18, 0.9, 0.22, 1.08) both;
          animation-delay: calc(70ms + var(--forecast-delay, 0ms));
        }

        .weather-card__forecast-time {
          color: var(--secondary-text-color);
          font-size: 10px;
          font-weight: 800;
          line-height: 1.2;
          min-height: 24px;
          text-transform: capitalize;
        }

        .weather-card__forecast-item > ha-icon {
          --mdc-icon-size: 22px;
          color: var(--forecast-accent);
        }

        .weather-card__forecast-temp {
          font-size: 14px;
          font-weight: 900;
          line-height: 1.1;
        }

        .weather-card__forecast-condition {
          color: var(--secondary-text-color);
          font-size: 9px;
          font-weight: 700;
          line-height: 1.15;
          max-width: 100%;
          min-height: 20px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .weather-card__forecast-rain {
          align-items: center;
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: 9px;
          font-weight: 800;
          gap: 3px;
          line-height: 1;
        }

        .weather-card__forecast-rain ha-icon {
          --mdc-icon-size: 11px;
          color: var(--forecast-accent);
        }

        .weather-card__forecast-chart {
          background:
            linear-gradient(180deg, color-mix(in srgb, ${accentColor} 8%, rgba(255,255,255,0.04)), rgba(255,255,255,0)),
            color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, ${accentColor} 18%, color-mix(in srgb, var(--primary-text-color) 7%, transparent));
          border-radius: 17px;
          align-self: start;
          height: var(--forecast-chart-height, 160px);
          min-height: 0;
          overflow: visible;
          padding: 4px 2px;
          position: relative;
        }

        .weather-card__forecast-chart svg {
          display: block;
          height: var(--forecast-chart-svg-height, 150px);
          overflow: visible;
          width: 100%;
        }

        .weather-card__forecast-chart-grid {
          stroke: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          stroke-width: 1;
        }

        .weather-card__forecast-chart-area {
          fill: color-mix(in srgb, ${accentColor} 16%, transparent);
        }

        .weather-card__forecast-chart-line {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 4.2;
        }

        .weather-card__forecast--entering .weather-card__forecast-chart-line,
        .weather-card__forecast--switching .weather-card__forecast-chart-line {
          animation: weather-card-line-draw calc(var(--weather-card-content-duration) * 0.95) cubic-bezier(0.25, 0.85, 0.25, 1) both;
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
        }

        .weather-card__forecast-chart-line--high {
          stroke: ${accentColor};
        }

        .weather-card__forecast-chart-line--low {
          stroke: color-mix(in srgb, ${accentColor} 48%, var(--secondary-text-color));
          stroke-dasharray: 6 5;
          stroke-width: 2.5;
        }

        .weather-card__forecast-chart-point {
          fill: color-mix(in srgb, var(--ha-card-background, #1f1f24) 82%, var(--forecast-point-color, ${accentColor}));
          transform-box: fill-box;
          transform-origin: center;
          stroke-width: 2.6;
        }

        .weather-card__forecast-chart-hit {
          cursor: pointer;
          outline: none;
        }

        .weather-card__forecast-chart-hit:hover .weather-card__forecast-chart-point,
        .weather-card__forecast-chart-hit:focus .weather-card__forecast-chart-point {
          filter: drop-shadow(0 0 7px color-mix(in srgb, ${accentColor} 42%, transparent));
          transform: scale(1.22);
        }

        .weather-card__forecast-chart-touch {
          fill: transparent;
          pointer-events: all;
        }

        .weather-card__forecast--entering .weather-card__forecast-chart-point,
        .weather-card__forecast--switching .weather-card__forecast-chart-point {
          animation: weather-card-point-pop calc(var(--weather-card-content-duration) * 0.58) cubic-bezier(0.18, 0.9, 0.22, 1.2) both;
          animation-delay: calc(90ms + var(--forecast-delay, 0ms));
        }

        .weather-card__forecast-chart-point--high {
          stroke: var(--forecast-point-color, ${accentColor});
        }

        .weather-card__forecast-chart-point--low {
          stroke: color-mix(in srgb, var(--forecast-point-color, ${accentColor}) 58%, var(--secondary-text-color));
        }

        .weather-card__forecast-chart-value,
        .weather-card__forecast-chart-label {
          fill: var(--primary-text-color);
          font-size: 15.8px;
          font-weight: 800;
          paint-order: stroke;
          stroke: color-mix(in srgb, var(--ha-card-background) 88%, transparent);
          stroke-linejoin: round;
          stroke-width: 4px;
          text-anchor: middle;
        }

        .weather-card__forecast-chart-label {
          fill: var(--secondary-text-color);
          font-size: 13.5px;
          font-weight: 850;
          text-transform: capitalize;
        }

        .weather-card__forecast-chart-value--low {
          fill: var(--secondary-text-color);
          font-size: 13.8px;
        }

        .weather-card__forecast-popup {
          --weather-popup-transform: translate(-50%, calc(-100% - 16px));
          animation: weather-card-popup-in calc(var(--weather-card-content-duration) * 0.58) cubic-bezier(0.16, 0.84, 0.22, 1) both;
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--forecast-accent) 18%, rgba(255,255,255,0.08)), rgba(255,255,255,0.02)),
            color-mix(in srgb, var(--ha-card-background, #1f1f24) 90%, rgba(0,0,0,0.12));
          border: 1px solid color-mix(in srgb, var(--forecast-accent) 36%, color-mix(in srgb, var(--primary-text-color) 9%, transparent));
          border-radius: 16px;
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28);
          color: var(--primary-text-color);
          display: grid;
          gap: 8px;
          left: var(--forecast-popup-left);
          min-width: 150px;
          max-width: min(206px, calc(100% - 20px));
          padding: 10px 12px 11px;
          position: absolute;
          top: var(--forecast-popup-top);
          transform: var(--weather-popup-transform);
          transform-origin: 50% 100%;
          width: min(206px, calc(100% - 20px));
          z-index: 2147483001;
        }

        .weather-card__forecast-popup--below {
          --weather-popup-transform: translate(-50%, 16px);
          transform-origin: 50% 0%;
        }

        .weather-card__forecast-hover-preview {
          -webkit-backdrop-filter: blur(14px);
          align-items: center;
          animation: weather-card-hover-preview-in calc(var(--weather-card-content-duration) * 0.34) cubic-bezier(0.16, 0.84, 0.22, 1) both;
          backdrop-filter: blur(14px);
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--forecast-accent) 18%, rgba(255,255,255,0.09)), rgba(255,255,255,0.025)),
            color-mix(in srgb, var(--ha-card-background, #1f1f24) 72%, transparent);
          border: 1px solid color-mix(in srgb, var(--forecast-accent) 34%, color-mix(in srgb, var(--primary-text-color) 9%, transparent));
          border-radius: 999px;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
          color: var(--primary-text-color);
          display: inline-flex;
          gap: 7px;
          left: var(--forecast-preview-left);
          max-width: min(190px, calc(100% - 20px));
          min-height: 34px;
          padding: 7px 11px;
          pointer-events: none;
          position: absolute;
          top: var(--forecast-preview-top);
          transform: translate(-50%, calc(-100% - 12px));
          white-space: nowrap;
          z-index: 2147483000;
        }

        .weather-card__forecast-hover-preview--below {
          transform: translate(-50%, 12px);
        }

        .weather-card__forecast-hover-preview ha-icon {
          --mdc-icon-size: 17px;
          color: var(--forecast-accent);
          flex: 0 0 auto;
        }

        .weather-card__forecast-hover-preview span {
          font-size: 11px;
          font-weight: 850;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .weather-card__forecast-hover-preview strong {
          color: var(--primary-text-color);
          flex: 0 0 auto;
          font-size: 12px;
          font-weight: 900;
          line-height: 1;
        }

        .weather-card__forecast-popup-close {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: 24px;
          justify-content: center;
          margin: 0;
          padding: 0;
          position: absolute;
          right: 7px;
          top: 7px;
          width: 24px;
        }

        .weather-card__forecast-popup-close ha-icon {
          --mdc-icon-size: 14px;
        }

        .weather-card__forecast-popup-time {
          color: var(--secondary-text-color);
          font-size: 10px;
          font-weight: 800;
          padding-right: 26px;
          text-transform: capitalize;
        }

        .weather-card__forecast-popup-main {
          align-items: center;
          display: flex;
          gap: 7px;
          padding-right: 18px;
        }

        .weather-card__forecast-popup-main ha-icon {
          --mdc-icon-size: 20px;
          color: var(--forecast-accent);
        }

        .weather-card__forecast-popup-main span {
          font-size: 13px;
          font-weight: 850;
          line-height: 1.15;
        }

        .weather-card__forecast-popup-rows {
          display: grid;
          gap: 5px;
        }

        .weather-card__forecast-popup-rows div {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
          min-width: 0;
        }

        .weather-card__forecast-popup-rows span {
          color: var(--secondary-text-color);
          font-size: 10px;
          font-weight: 750;
        }

        .weather-card__forecast-popup-rows strong {
          font-size: 12px;
          font-weight: 850;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .weather-card__forecast-chart-meta {
          display: grid;
          gap: 6px;
          grid-auto-columns: minmax(88px, 1fr);
          grid-auto-flow: column;
          min-width: 0;
          overflow-x: auto;
          padding: 0 2px 2px;
          scrollbar-width: thin;
        }

        .weather-card__forecast-chart-chip {
          align-items: center;
          background: color-mix(in srgb, var(--forecast-accent) 10%, color-mix(in srgb, var(--primary-text-color) 5%, transparent));
          border: 1px solid color-mix(in srgb, var(--forecast-accent) 20%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 14px;
          color: var(--secondary-text-color);
          display: grid;
          font-size: 9px;
          font-weight: 800;
          gap: 3px;
          justify-items: center;
          min-height: 56px;
          padding: 6px;
          text-align: center;
          transform-origin: center bottom;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms cubic-bezier(0.2, 0.9, 0.24, 1);
        }

        .weather-card__forecast-chart-chip:hover {
          box-shadow: 0 8px 18px color-mix(in srgb, var(--forecast-accent) 12%, transparent);
          transform: translateY(-2px);
        }

        .weather-card__forecast--entering .weather-card__forecast-chart-chip,
        .weather-card__forecast--switching .weather-card__forecast-chart-chip {
          animation: weather-card-item-rise calc(var(--weather-card-content-duration) * 0.74) cubic-bezier(0.18, 0.9, 0.22, 1.08) both;
          animation-delay: calc(110ms + var(--forecast-delay, 0ms));
        }

        .weather-card__forecast-chart-chip > ha-icon {
          --mdc-icon-size: 18px;
          color: var(--forecast-accent);
        }

        .weather-card__forecast-chart-chip small {
          align-items: center;
          display: inline-flex;
          font-size: 9px;
          gap: 3px;
          line-height: 1;
        }

        .weather-card__forecast-chart-chip small ha-icon {
          --mdc-icon-size: 10px;
        }

        .weather-card__forecast-empty {
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px dashed color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 16px;
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 700;
          padding: 12px;
        }

        .weather-card--empty {
          display: grid;
          gap: 8px;
          padding: 16px;
        }

        .weather-card__empty-title {
          font-size: 15px;
          font-weight: 700;
        }

        .weather-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }

        @keyframes weather-card-content-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.02);
          }
          72% {
            transform: scale(1.008);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes weather-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes weather-card-panel-swap {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.975);
          }
          64% {
            opacity: 1;
            transform: translateY(0) scale(1.012);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes weather-card-item-rise {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.94);
          }
          62% {
            opacity: 1;
            transform: translateY(0) scale(1.018);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes weather-card-line-draw {
          0% {
            opacity: 0;
            stroke-dashoffset: 1;
          }
          35% {
            opacity: 1;
          }
          100% {
            opacity: 1;
            stroke-dashoffset: 0;
          }
        }

        @keyframes weather-card-popup-in {
          0% {
            clip-path: inset(0 48% 86% 48% round 16px);
            opacity: 0;
            transform: var(--weather-popup-transform);
          }
          62% {
            clip-path: inset(0 5% 0 5% round 16px);
            opacity: 1;
            transform: var(--weather-popup-transform);
          }
          100% {
            clip-path: inset(0 0 0 0 round 16px);
            opacity: 1;
            transform: var(--weather-popup-transform);
          }
        }

        @keyframes weather-card-hover-preview-in {
          0% {
            clip-path: inset(0 42% 0 42% round 999px);
            opacity: 0;
          }
          100% {
            clip-path: inset(0 0 0 0 round 999px);
            opacity: 1;
          }
        }

        @keyframes weather-card-point-pop {
          0% {
            opacity: 0;
            transform: scale(0.2);
          }
          65% {
            opacity: 1;
            transform: scale(1.25);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes weather-card-chip-pop {
          0% {
            opacity: 0;
            transform: translateY(-4px) scale(0.86);
          }
          70% {
            opacity: 1;
            transform: translateY(1px) scale(1.05);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes weather-card-alert-panel {
          0% {
            clip-path: inset(0 44% 88% 44% round 24px);
            opacity: 0;
            transform: translateY(0);
          }
          64% {
            clip-path: inset(0 5% 0 5% round 24px);
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            clip-path: inset(0 0 0 0 round 24px);
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes weather-card-bubble-bloom {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          58% {
            opacity: 1;
            transform: scale(1.04);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes weather-card-bubble-bounce {
          0% {
            transform: scale(1);
          }
          48% {
            transform: scale(1.12);
          }
          72% {
            transform: scale(1.04);
          }
          100% {
            transform: scale(1);
          }
        }

        @media (max-width: 520px) {
          .weather-card__topline {
            align-items: flex-start;
            flex-wrap: nowrap;
          }

          .weather-card__chips {
            flex: 0 1 auto;
            justify-content: flex-end;
            max-width: 58%;
          }
        }

        ${animations.enabled ? "" : `
        ha-card,
        .weather-card,
        .weather-card * {
          animation: none !important;
          transition: none !important;
        }
        `}
      </style>
      <ha-card class="weather-card ${tapEnabled ? "weather-card--clickable" : ""}" style="--accent-color:${escapeHtml(accentColor)};">
        <div class="weather-card__content" data-weather-card="root">
          <div class="weather-card__hero ${meteoalarmChipRowMarkup ? "" : "weather-card__hero--no-alert"} ${shouldAnimateEntrance ? "weather-card__hero--entering" : ""}">
            <div class="weather-card__topline">
              <div class="weather-card__title">${escapeHtml(title)}</div>
              ${chips.length ? `<div class="weather-card__chips ${shouldAnimateEntrance ? "weather-card__chips--entering" : ""}">${chips.join("")}</div>` : ""}
            </div>
            <div class="weather-card__main">
              <div class="weather-card__icon ${shouldAnimateEntrance ? "weather-card__icon--entering" : ""}">
                <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
                ${showUnavailableBadge ? `<span class="weather-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
              </div>
              <div class="weather-card__copy ${shouldAnimateEntrance ? "weather-card__copy--entering" : ""}">
                ${meteoalarmChipRowMarkup}
                <div class="weather-card__metrics ${shouldAnimateEntrance ? "weather-card__metrics--entering" : ""}">
                  <div class="weather-card__temperature">${escapeHtml(temperatureLabel)}</div>
                  ${config.show_condition !== false ? `<div class="weather-card__condition">${escapeHtml(conditionLabel)}</div>` : ""}
                </div>
              </div>
            </div>
          </div>
          ${forecastMarkup}
        </div>
      </ha-card>
      ${meteoalarmPopupMarkup}
    `;

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 120);
    }

    if (shouldAnimateForecast) {
      this._animateForecastOnNextRender = false;
    }

    this._lastRenderSignature = this._getRenderSignature();
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaWeatherCard);
}

class NodaliaWeatherCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showAnimationSection = false;
    this._showStyleSection = false;
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("value-changed", this._onShadowValueChanged);
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
    return Object.entries(hass?.states || {})
      .filter(([entityId]) => entityId.startsWith("weather.") || entityId.startsWith("binary_sensor."))
      .map(([entityId, state]) => `${entityId}:${String(state?.attributes?.friendly_name || "")}:${String(state?.attributes?.icon || "")}`)
      .sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }))
      .join("|");
  }

  _watchEditorControlTag(tagName) {
    if (!tagName || this._pendingEditorControlTags.has(tagName)) {
      return;
    }

    if (typeof customElements?.whenDefined !== "function" || customElements.get(tagName)) {
      return;
    }

    this._pendingEditorControlTags.add(tagName);
    customElements.whenDefined(tagName)
      .then(() => {
        this._pendingEditorControlTags.delete(tagName);

        if (!this._hass || !this.shadowRoot) {
          return;
        }

        const focusState = this._captureFocusState();
        this._render();
        this._restoreFocusState(focusState);
      })
      .catch(() => {
        this._pendingEditorControlTags.delete(tagName);
      });
  }

  _ensureEditorControlsReady() {
    this._watchEditorControlTag("ha-entity-picker");
    this._watchEditorControlTag("ha-selector");
    this._watchEditorControlTag("ha-icon-picker");
  }

  _getEntityOptions(path = "entity", domains = ["weather"]) {
    const normalizedDomains = domains.map(domain => String(domain).trim()).filter(Boolean);
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => normalizedDomains.some(domain => entityId.startsWith(`${domain}.`)))
      .map(([entityId, state]) => {
        const friendlyName = String(state?.attributes?.friendly_name || "").trim();
        return {
          value: entityId,
          label: friendlyName || entityId,
          displayLabel: friendlyName && friendlyName !== entityId
            ? `${friendlyName} (${entityId})`
            : entityId,
        };
      })
      .sort((left, right) => (
        left.label.localeCompare(right.label, "es", { sensitivity: "base" })
        || left.value.localeCompare(right.value, "es", { sensitivity: "base" })
      ));

    const currentValue = String(getByPath(this._config, path) || "").trim();
    if (currentValue && !options.some(option => option.value === currentValue)) {
      options.unshift({
        value: currentValue,
        label: currentValue,
        displayLabel: currentValue,
      });
    }

    return options;
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
      case "color":
        return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
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

  _onShadowValueChanged(event) {
    const control = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.field);

    if (!control?.dataset?.field) {
      return;
    }

    event.stopPropagation();

    const nextValue = typeof event.detail?.value === "string"
      ? event.detail.value
      : control.value;
    if (typeof control.dataset?.value === "string") {
      control.dataset.value = String(nextValue || "");
    }

    this._setFieldValue(control.dataset.field, nextValue);
    this._setEditorConfig();
    this._emitConfig();
  }

  _onShadowClick(event) {
    const toggleButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorToggle);

    if (!toggleButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (toggleButton.dataset.editorToggle === "styles") {
      this._showStyleSection = !this._showStyleSection;
      this._render();
    } else if (toggleButton.dataset.editorToggle === "animations") {
      this._showAnimationSection = !this._showAnimationSection;
      this._render();
    }
  }

  _renderTextField(label, field, value, options = {}) {
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";

    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <input
          type="${escapeHtml(options.type || "text")}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(valueType)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        />
      </label>
    `;
  }

  _renderColorField(label, field, value, options = {}) {
    const fallbackValue = options.fallbackValue || getEditorColorFallbackValue(field);
    const currentValue = value === undefined || value === null || value === ""
      ? fallbackValue
      : String(value);
    const colorModel = getEditorColorModel(currentValue, fallbackValue);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="Color personalizado">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="color"
              data-alpha="${escapeHtml(String(colorModel.alpha))}"
              value="${escapeHtml(colorModel.hex)}"
              aria-label="${escapeHtml(label)}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>
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

  _renderSelectField(label, field, value, options, renderOptions = {}) {
    return `
      <label class="editor-field ${renderOptions.fullWidth ? "editor-field--full" : ""}">
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

  _renderEntityPickerField(label, field, value, options = {}) {
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder || "";
    const domains = Array.isArray(options.domains) && options.domains.length ? options.domains : ["weather"];
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-domains="${escapeHtml(domains.join(","))}"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(placeholder)}"
        ></div>
      </div>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <ha-icon-picker
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        ></ha-icon-picker>
      </div>
    `;
  }

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    const domains = String(host.dataset.domains || "weather")
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.includeDomains = domains;
      control.allowCustomEntity = true;
      control.entityFilter = stateObj => domains.some(domain => String(stateObj?.entity_id || "").startsWith(`${domain}.`));
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: {
          domain: domains.length === 1 ? domains[0] : domains,
        },
      };
    } else {
      control = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder || "Selecciona una entidad";
      control.appendChild(emptyOption);
      this._getEntityOptions(field, domains).forEach(option => {
        const optionElement = document.createElement("option");
        optionElement.value = option.value;
        optionElement.textContent = option.displayLabel;
        control.appendChild(optionElement);
      });
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;

    if ("hass" in control) {
      control.hass = this._hass;
    }

    if ("value" in control) {
      control.value = nextValue;
    }

    host.replaceChildren(control);
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";
    const tapAction = config.tap_action || "more-info";
    const animations = config.animations || DEFAULT_CONFIG.animations;

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
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
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

        .editor-grid--stacked {
          grid-template-columns: 1fr;
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
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 14px;
          color: var(--primary-text-color);
          font: inherit;
          min-width: 0;
          outline: none;
          padding: 10px 12px;
          width: 100%;
        }

        .editor-color-field {
          align-items: center;
          display: flex;
          gap: 10px;
          min-height: 46px;
        }

        .editor-color-picker {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: 40px;
          justify-content: center;
          position: relative;
          width: 40px;
        }

        .editor-color-picker input {
          cursor: pointer;
          inset: 0;
          opacity: 0;
          position: absolute;
        }

        .editor-color-picker:hover,
        .editor-color-picker:focus-within {
          border-color: color-mix(in srgb, var(--primary-text-color) 22%, transparent);
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }

        .editor-color-swatch {
          --editor-swatch: #71c0ff;
          background:
            linear-gradient(var(--editor-swatch), var(--editor-swatch)),
            conic-gradient(from 90deg, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 25%, rgba(0, 0, 0, 0.12) 0 50%, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 0 75%, rgba(0, 0, 0, 0.12) 0);
          background-position: center;
          background-size: cover, 10px 10px;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
          border-radius: 999px;
          display: block;
          height: 22px;
          width: 22px;
        }

        .editor-toggle {
          align-items: center;
          grid-template-columns: auto 1fr;
          padding-top: 20px;
        }

        .editor-section__actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 2px;
        }

        .editor-section__toggle-button {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          gap: 8px;
          min-height: 34px;
          padding: 0 12px;
        }

        .editor-section__toggle-button ha-icon {
          --mdc-icon-size: 16px;
        }

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }

        @media (max-width: 720px) {
          .editor-grid {
            grid-template-columns: 1fr;
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
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent);
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
            0 0 0 3px color-mix(in srgb, var(--primary-text-color) 14%, transparent),
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }
</style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">General</div>
            <div class="editor-section__hint">Entidad meteorologica principal, nombre visible, icono y contenido mostrado.</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityPickerField("Entidad principal", "entity", config.entity, {
              placeholder: "weather.casa",
              fullWidth: true,
            })}
            ${this._renderIconPickerField("Icono", "icon", config.icon, {
              placeholder: "mdi:weather-partly-cloudy",
              fullWidth: true,
            })}
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Tiempo",
              fullWidth: true,
            })}
            ${this._renderSelectField(
              "Accion al tocar",
              "tap_action",
              tapAction,
              [
                { value: "more-info", label: "Mas informacion" },
                { value: "none", label: "Sin accion" },
              ],
              { fullWidth: true },
            )}
            ${this._renderCheckboxField("Mostrar condicion", "show_condition", config.show_condition !== false)}
            ${this._renderCheckboxField("Mostrar chip humedad", "show_humidity_chip", config.show_humidity_chip !== false)}
            ${this._renderCheckboxField("Mostrar chip viento", "show_wind_chip", config.show_wind_chip !== false)}
            ${this._renderCheckboxField("Mostrar chip presion", "show_pressure_chip", config.show_pressure_chip === true)}
            ${this._renderCheckboxField("Mostrar chip Meteoalarm", "show_meteoalarm_chip", config.show_meteoalarm_chip === true)}
            ${config.show_meteoalarm_chip === true ? this._renderEntityPickerField("Entidad Meteoalarm", "meteoalarm_entity", config.meteoalarm_entity, {
              domains: ["binary_sensor"],
              placeholder: "binary_sensor.meteoalarm",
              fullWidth: true,
            }) : ""}
            ${this._renderCheckboxField("Mostrar prediccion ampliada", "show_forecast_details", config.show_forecast_details === true)}
            ${config.show_forecast_details === true ? `
              ${this._renderCheckboxField("Mostrar selector de vista", "show_forecast_toggle", config.show_forecast_toggle !== false)}
              ${this._renderSelectField(
                "Vista visual inicial",
                "forecast_view",
                normalizeForecastView(config.forecast_view),
                [
                  { value: "cards", label: "Tarjetas" },
                  { value: "chart", label: "Grafico" },
                ],
              )}
              ${this._renderSelectField(
                "Vista inicial",
                "forecast_type",
                normalizeForecastType(config.forecast_type),
                [
                  { value: "hourly", label: "Por horas" },
                  { value: "daily", label: "Semanal" },
                ],
              )}
              ${this._renderCheckboxField("Mostrar etiquetas del grafico", "forecast_chart_labels", config.forecast_chart_labels === true)}
              ${this._renderCheckboxField("Grafico en color", "forecast_chart_color_enabled", config.forecast_chart_color_enabled === true)}
              ${config.forecast_chart_color_enabled === true ? this._renderSelectField(
                "Color del grafico",
                "forecast_chart_color_mode",
                normalizeForecastChartColorMode(config.forecast_chart_color_mode),
                [
                  { value: "temperature", label: "Por temperatura" },
                  { value: "condition", label: "Por condicion" },
                ],
              ) : ""}
              ${this._renderTextField("Horas visibles", "forecast_slots_hourly", config.forecast_slots_hourly, {
                type: "number",
              })}
              ${this._renderTextField("Dias visibles", "forecast_slots_daily", config.forecast_slots_daily, {
                type: "number",
              })}
            ` : ""}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Animaciones</div>
            <div class="editor-section__hint">Entrada suave del contenido y pequeno rebote al pulsar la tarjeta.</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${this._showAnimationSection ? "Ocultar ajustes de animacion" : "Mostrar ajustes de animacion"}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("Activar animaciones", "animations.enabled", animations.enabled !== false)}
                  ${this._renderTextField("Entrada contenido (ms)", "animations.content_duration", animations.content_duration, {
                    type: "number",
                  })}
                  ${this._renderTextField("Rebote pulsacion (ms)", "animations.button_bounce_duration", animations.button_bounce_duration, {
                    type: "number",
                  })}
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Respuesta haptica</div>
            <div class="editor-section__hint">Respuesta tactil opcional al tocar la tarjeta.</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Activar haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("Usar vibracion de respaldo", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "Estilo",
              "haptics.style",
              hapticStyle,
              [
                { value: "selection", label: "Seleccion" },
                { value: "light", label: "Ligero" },
                { value: "medium", label: "Medio" },
                { value: "heavy", label: "Intenso" },
                { value: "success", label: "Exito" },
                { value: "warning", label: "Aviso" },
                { value: "failure", label: "Fallo" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">Estilos</div>
            <div class="editor-section__hint">Ajustes visuales base de la tarjeta.</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${this._showStyleSection ? "Ocultar ajustes de estilo" : "Mostrar ajustes de estilo"}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("Fondo tarjeta", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("Borde tarjeta", "styles.card.border", config.styles.card.border)}
                  ${this._renderTextField("Radio borde", "styles.card.border_radius", config.styles.card.border_radius)}
                  ${this._renderTextField("Sombra", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("Padding interior", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("Separacion interna", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderTextField("Tamano icono", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderColorField("Fondo burbuja icono", "styles.icon.background", config.styles.icon.background, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
                  })}
                  ${this._renderColorField("Color icono", "styles.icon.color", config.styles.icon.color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderTextField("Alto chips", "styles.chip_height", config.styles.chip_height)}
                  ${this._renderTextField("Texto chips", "styles.chip_font_size", config.styles.chip_font_size)}
                  ${this._renderTextField("Padding chips", "styles.chip_padding", config.styles.chip_padding)}
                  ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
                  ${this._renderTextField("Tamano temperatura", "styles.temperature_size", config.styles.temperature_size)}
                  ${this._renderTextField("Tamano condicion", "styles.condition_size", config.styles.condition_size)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="entity"]')
      .forEach(host => this._mountEntityPicker(host));

    this.shadowRoot
      .querySelectorAll("ha-icon-picker[data-field]")
      .forEach(control => {
        control.hass = this._hass;
        control.value = control.dataset.value || "";
      });

    this._ensureEditorControlsReady();
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaWeatherCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Weather Card",
  description: "Tarjeta de tiempo elegante para Home Assistant",
  preview: true,
});
