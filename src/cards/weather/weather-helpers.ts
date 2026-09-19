// @ts-nocheck -- forecast, unit and editor color helpers stay loosely typed until remaining unknowns are narrowed.
import { clamp, isObject, normalizeTextKey } from "./weather-runtime";

export function getStubEntityId(hass, domains = [], entities = [], entitiesFallback = []) {
  return window.NodaliaUtils.findStubEntityIds(hass, entities, entitiesFallback, domains, 1)[0] || "";
}

export function applyStubEntity(config, hass, domains, entities = [], entitiesFallback = []) {
  const entityId = getStubEntityId(hass, domains, entities, entitiesFallback);
  if (!entityId) {
    return config;
  }

  config.entity = entityId;
  config.name = hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
  return config;
}


export function compactConfig(value) {
  if (Array.isArray(value)) {
    return value.map(item => compactConfig(item)).filter(item => item !== undefined);
  }

  if (isObject(value)) {
    const compacted = {};

    Object.entries(value).forEach(([key, item]) => {
      if (window.NodaliaUtils?.isUnsafeConfigPathKey?.(key)) {
        return;
      }
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






export function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}




export function resolveEditorColorValue(value) {
  const resolver = window.NodaliaBubbleContrast?.resolveEditorColorValue;
  if (typeof resolver === "function") {
    return resolver(value);
  }
  return String(value ?? "").trim();
}

export function formatEditorHexChannel(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

export function formatEditorColorFromHex(hex, alpha = 1) {
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

export function getEditorColorModel(value, fallbackValue = "#71c0ff") {
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

export function getEditorColorFallbackValue(field) {
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



export function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (Math.abs(numeric - Math.round(numeric)) < 0.05) {
    return String(Math.round(numeric));
  }

  return numeric.toFixed(1);
}

export function formatCompactTemperature(value, unitLabel = "°") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }

  return `${Math.round(numeric)}${unitLabel}`;
}

export function normalizeForecastType(value) {
  return ["hourly", "daily"].includes(value) ? value : "hourly";
}

export function normalizeForecastView(value) {
  return String(value || "cards").toLowerCase() === "chart" ? "chart" : "cards";
}

export function normalizeForecastChartColorMode(value) {
  return String(value || "").toLowerCase() === "condition" ? "condition" : "temperature";
}

export function getTemperatureScaleColor(value) {
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

export function getForecastChartPointColor(point, mode, fallbackCondition) {
  if (mode === "condition") {
    return getConditionAccent(point?.item?.condition || fallbackCondition);
  }

  return getTemperatureScaleColor(point?.value);
}

export function getWeatherSupportedFeature(state, feature) {
  return Boolean((Number(state?.attributes?.supported_features) || 0) & feature);
}

export function getSupportedForecastTypes(state) {
  const types = [];
  if (getWeatherSupportedFeature(state, 2)) {
    types.push("hourly");
  }
  if (getWeatherSupportedFeature(state, 1)) {
    types.push("daily");
  }
  return types.length ? types : ["hourly", "daily"];
}

export function formatForecastDateTime(value, type, locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const localeArg = locale && locale !== "auto" ? locale : undefined;

  if (type === "hourly") {
    return date.toLocaleTimeString(localeArg, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(localeArg, {
    weekday: "short",
    day: "numeric",
  });
}

export function getForecastTemperatureValue(item, type) {
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

export function getForecastTemperatureSeriesValue(item, series) {
  const value = Number(series === "low" ? item?.templow : item?.temperature);
  return Number.isFinite(value) ? value : null;
}

export function getForecastPrecipitationLabel(item, unit = "") {
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

export function getMeteoalarmAwarenessParts(state) {
  const rawLevel = String(state?.attributes?.awareness_level || "").trim();
  const parts = rawLevel.split(";").map(part => part.trim()).filter(Boolean);
  return {
    color: parts[1] || "",
    label: parts[2] || parts[0] || "",
    level: parts[0] || "",
  };
}

export function getMeteoalarmAccentColor(state) {
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

export function formatMeteoalarmDate(value, hass, configLang) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || "").trim();
  }

  const lang = window.NodaliaI18n?.resolveLanguage?.(hass, configLang ?? "auto") ?? "en";
  const tag = window.NodaliaI18n?.localeTag?.(lang) || lang;
  return date.toLocaleString(tag, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

export function translateMeteoalarmValue(value, hass, configLang) {
  if (window.NodaliaI18n?.translateMeteoalarmTerm) {
    return window.NodaliaI18n.translateMeteoalarmTerm(hass, configLang ?? "auto", value);
  }
  const text = String(value || "").trim();
  switch (normalizeTextKey(text)) {
    case "moderate":
      return "Moderate";
    case "severe":
      return "Severe";
    case "high":
      return "High";
    case "extreme":
      return "Extreme";
    case "minor":
      return "Minor";
    case "yellow":
      return "Yellow";
    case "orange":
      return "Orange";
    case "red":
      return "Red";
    case "green":
      return "Green";
    case "future":
      return "Future";
    case "immediate":
      return "Immediate";
    case "expected":
      return "Expected";
    case "past":
      return "Past";
    case "likely":
      return "Likely";
    case "observed":
      return "Observed";
    case "possible":
      return "Possible";
    case "unlikely":
      return "Unlikely";
    case "unknown":
      return "Unknown";
    case "met":
      return "Meteorological";
    case "monitor":
      return "Monitor";
    default:
      return text;
  }
}

export function translateCondition(value, hass = null, configLang = null) {
  const h = hass ?? (typeof window !== "undefined" ? window.NodaliaI18n?.resolveHass?.(null) : null);
  if (window.NodaliaI18n?.translateWeatherCondition) {
    return window.NodaliaI18n.translateWeatherCondition(h, configLang ?? "auto", value);
  }
  switch (normalizeTextKey(value)) {
    case "clear_night":
      return "Clear";
    case "cloudy":
      return "Cloudy";
    case "exceptional":
      return "Exceptional";
    case "fog":
      return "Fog";
    case "hail":
      return "Hail";
    case "lightning":
      return "Thunderstorm";
    case "lightning_rainy":
      return "Thunderstorm with rain";
    case "partlycloudy":
      return "Partly cloudy";
    case "pouring":
      return "Pouring";
    case "rainy":
      return "Rainy";
    case "snowy":
      return "Snowy";
    case "snowy_rainy":
      return "Snowy rainy";
    case "sunny":
      return "Sunny";
    case "windy":
      return "Windy";
    case "windy_variant":
      return "Windy";
    default:
      return String(value || "").trim() || "Weather";
  }
}

export function getConditionIcon(value) {
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

export function getConditionIconMotionClass(value) {
  switch (normalizeTextKey(value)) {
    case "rainy":
    case "pouring":
    case "lightning_rainy":
    case "snowy_rainy":
      return "weather-card__icon--rain-motion";
    case "snowy":
    case "hail":
      return "weather-card__icon--snow-motion";
    case "sunny":
      return "weather-card__icon--sun-motion";
    case "windy":
    case "windy_variant":
      return "weather-card__icon--wind-motion";
    case "cloudy":
    case "partlycloudy":
    case "fog":
      return "weather-card__icon--cloud-motion";
    case "lightning":
      return "weather-card__icon--storm-motion";
    default:
      return "";
  }
}

export function getConditionAccent(value) {
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

export function getConditionReadableIconColor(value, accentColor = getConditionAccent(value)) {
  const key = normalizeTextKey(value || "");
  const accentWeight = key === "sunny"
    ? 66
    : key === "lightning" || key === "exceptional"
      ? 70
      : 76;
  return `color-mix(in srgb, ${accentColor} ${accentWeight}%, var(--primary-text-color))`;
}

export function getForecastIconColor(accentColor, conditionValue = "") {
  return getConditionReadableIconColor(conditionValue, accentColor);
}

export function getMetricReadableIconColor(accentColor) {
  return `color-mix(in srgb, ${accentColor} 72%, var(--primary-text-color))`;
}

export function normalizeUnitSystem(value) {
  const normalized = normalizeTextKey(value);
  if (["metric", "eu", "europe", "european"].includes(normalized)) {
    return "metric";
  }
  if (["imperial", "us", "usa", "american"].includes(normalized)) {
    return "imperial";
  }
  return "auto";
}

export function normalizeTemperatureUnitPreference(value) {
  const normalized = normalizeTextKey(value);
  if (["c", "celsius", "centigrade"].includes(normalized)) {
    return "c";
  }
  if (["f", "fahrenheit"].includes(normalized)) {
    return "f";
  }
  return "auto";
}

export function normalizeWindUnitPreference(value) {
  const normalized = normalizeTextKey(value);
  if (["km_h", "kmh", "kph", "kilometers_per_hour", "kilometres_per_hour"].includes(normalized)) {
    return "kmh";
  }
  if (["mph", "miles_per_hour"].includes(normalized)) {
    return "mph";
  }
  return "auto";
}

export function normalizeTemperatureUnitFromState(value) {
  const normalized = normalizeTextKey(value);
  if (normalized.includes("f")) {
    return "f";
  }
  return "c";
}

export function normalizeWindUnitFromState(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return "kmh";
  }
  if (raw.includes("mph")) {
    return "mph";
  }
  if (raw.includes("km")) {
    return "kmh";
  }
  if (raw.includes("m/s") || raw.includes("mps")) {
    return "ms";
  }
  return "kmh";
}
