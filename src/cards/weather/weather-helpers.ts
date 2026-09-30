import type { HassEntity } from "../../core/types/home-assistant";
export { compactConfig } from "../../shared/config-values";
export { getStubEntityId, applyStubEntity, parseSizeToPixels } from "../../shared/editor-entity-helpers";
export { resolveEditorColorValue, formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import { clamp, isObject, normalizeTextKey } from "./weather-runtime";

import { parseFiniteNumericValue as parseWeatherNumericValue } from "../../shared/numeric-values";
export { parseFiniteNumericValue as parseWeatherNumericValue } from "../../shared/numeric-values";

function dateFromUnknown(value: unknown): Date {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date(NaN);
}

export function getEditorColorFallbackValue(field: unknown) {
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



export function isUnavailableState(state: HassEntity | null | undefined) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function formatNumber(value: unknown) {
  const numeric = parseWeatherNumericValue(value);
  if (numeric === null) {
    return null;
  }

  if (Math.abs(numeric - Math.round(numeric)) < 0.05) {
    return String(Math.round(numeric));
  }

  return numeric.toFixed(1);
}

export function formatCompactTemperature(value: unknown, unitLabel = "°") {
  const numeric = parseWeatherNumericValue(value);
  if (numeric === null) {
    return "";
  }

  return `${Math.round(numeric)}${unitLabel}`;
}

export function normalizeForecastType(value: unknown) {
  return value === "daily" ? "daily" : "hourly";
}

export function normalizeForecastView(value: unknown) {
  return String(value || "cards").toLowerCase() === "chart" ? "chart" : "cards";
}

export function normalizeForecastChartColorMode(value: unknown) {
  return String(value || "").toLowerCase() === "condition" ? "condition" : "temperature";
}

export function getTemperatureScaleColor(value: unknown) {
  const numeric = parseWeatherNumericValue(value);
  if (numeric === null) {
    return "var(--info-color, #71c0ff)";
  }

  const stops: { value: number; color: [number, number, number] }[] = [
    { value: -5, color: [22, 58, 143] },
    { value: 2, color: [43, 128, 211] },
    { value: 10, color: [74, 177, 126] },
    { value: 18, color: [238, 206, 76] },
    { value: 26, color: [231, 87, 53] },
    { value: 36, color: [140, 28, 28] },
  ];

  let lower = stops[0];
  let upper = stops[stops.length - 1];
  if (!lower || !upper) return "var(--info-color, #71c0ff)";
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
  const channels = lower.color.map((channel, index) => Math.round(channel + (((upper.color[index] ?? channel) - channel) * progress)));
  return `rgb(${channels.join(", ")})`;
}

export function getForecastChartPointColor(value: unknown, mode: unknown, fallbackCondition: unknown) {
  const point = isObject(value) ? value : {};
  const item = isObject(point.item) ? point.item : {};
  if (mode === "condition") {
    return getConditionAccent(item.condition || fallbackCondition);
  }

  return getTemperatureScaleColor(point?.value);
}

export function getWeatherSupportedFeature(state: HassEntity | null | undefined, feature: number) {
  return Boolean((Number(state?.attributes?.supported_features) || 0) & feature);
}

export function getSupportedForecastTypes(state: HassEntity | null | undefined): ("hourly" | "daily")[] {
  const types: ("hourly" | "daily")[] = [];
  if (getWeatherSupportedFeature(state, 2)) {
    types.push("hourly");
  }
  if (getWeatherSupportedFeature(state, 1)) {
    types.push("daily");
  }
  return types.length ? types : ["hourly", "daily"];
}

export function formatForecastDateTime(value: unknown, type: unknown, locale: string | undefined) {
  const date = dateFromUnknown(value);
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

export function getForecastTemperatureValue(value: unknown, type: unknown) {
  const item = isObject(value) ? value : {};
  const temperature = parseWeatherNumericValue(item.temperature);
  if (temperature !== null) {
    return temperature;
  }

  if (type === "daily") {
    const low = parseWeatherNumericValue(item.templow);
    if (low !== null) {
      return low;
    }
  }

  return null;
}

export function getForecastTemperatureSeriesValue(input: unknown, series: unknown) {
  const item = isObject(input) ? input : {};
  return parseWeatherNumericValue(series === "low" ? item.templow : item.temperature);
}

export function getForecastPrecipitationLabel(value: unknown, unit = "") {
  const item = isObject(value) ? value : {};
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

export function getMeteoalarmAwarenessParts(state: HassEntity | null | undefined) {
  const rawLevel = String(state?.attributes?.awareness_level || "").trim();
  const parts = rawLevel.split(";").map(part => part.trim()).filter(Boolean);
  return {
    color: parts[1] || "",
    label: parts[2] || parts[0] || "",
    level: parts[0] || "",
  };
}

export function getMeteoalarmAccentColor(state: HassEntity | null | undefined) {
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

export function formatMeteoalarmDate(value: unknown, hass: unknown, configLang: string | null | undefined) {
  const date = dateFromUnknown(value);
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

export function translateMeteoalarmValue(value: unknown, hass: unknown, configLang: string | null | undefined) {
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

export function translateCondition(value: unknown, hass: unknown = null, configLang: string | null = null) {
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

export function getConditionIcon(value: unknown) {
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

export function getConditionIconMotionClass(value: unknown) {
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

export function getConditionAccent(value: unknown) {
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

export function getConditionReadableIconColor(value: unknown, accentColor = getConditionAccent(value)) {
  const key = normalizeTextKey(value || "");
  const accentWeight = key === "sunny"
    ? 66
    : key === "lightning" || key === "exceptional"
      ? 70
      : 76;
  return `color-mix(in srgb, ${accentColor} ${accentWeight}%, var(--primary-text-color))`;
}

export function getForecastIconColor(accentColor: string, conditionValue = "") {
  return getConditionReadableIconColor(conditionValue, accentColor);
}

export function getMetricReadableIconColor(accentColor: string) {
  return `color-mix(in srgb, ${accentColor} 72%, var(--primary-text-color))`;
}

export function normalizeUnitSystem(value: unknown) {
  const normalized = normalizeTextKey(value);
  if (["metric", "eu", "europe", "european"].includes(normalized)) {
    return "metric";
  }
  if (["imperial", "us", "usa", "american"].includes(normalized)) {
    return "imperial";
  }
  return "auto";
}

export function normalizeTemperatureUnitPreference(value: unknown) {
  const normalized = normalizeTextKey(value);
  if (["c", "celsius", "centigrade"].includes(normalized)) {
    return "c";
  }
  if (["f", "fahrenheit"].includes(normalized)) {
    return "f";
  }
  return "auto";
}

export function normalizeWindUnitPreference(value: unknown) {
  const normalized = normalizeTextKey(value);
  if (["km_h", "kmh", "kph", "kilometers_per_hour", "kilometres_per_hour"].includes(normalized)) {
    return "kmh";
  }
  if (["mph", "miles_per_hour"].includes(normalized)) {
    return "mph";
  }
  return "auto";
}

export function normalizeTemperatureUnitFromState(value: unknown) {
  const normalized = normalizeTextKey(value);
  if (normalized.includes("f")) {
    return "f";
  }
  return "c";
}

export function normalizeWindUnitFromState(value: unknown) {
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
