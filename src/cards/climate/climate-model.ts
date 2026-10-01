import type { HassEntity, HomeAssistant } from "../../core/types/home-assistant";
import { parseFiniteNumericValue } from "../../shared/numeric-values";
export { parseSizeToPixels } from "../../shared/editor-entity-helpers";
export { parseRgbColor, getRelativeLuminance } from "../../shared/color-luminance";
export { resolveEditorColorValue, formatEditorHexChannel, formatEditorColorFromHex, getEditorColorModel } from "../../shared/editor-color";
import { normalizeTextKey } from "./climate-runtime";

export function escapeSelectorValue(value: unknown) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function getEditorColorFallbackValue(field: unknown) {
  const normalizedField = String(field ?? "");

  if (normalizedField.endsWith("icon.background")) {
    return "color-mix(in srgb, var(--primary-text-color) 6%, transparent)";
  }

  if (normalizedField.endsWith("dial.background")) {
    return "color-mix(in srgb, var(--primary-text-color) 5%, transparent)";
  }

  if (normalizedField.endsWith("track_color")) {
    return "color-mix(in srgb, var(--primary-text-color) 32%, var(--divider-color))";
  }

  if (normalizedField.endsWith("accent_background")) {
    return "rgba(113, 192, 255, 0.18)";
  }

  if (normalizedField.endsWith("accent_color")) {
    return "var(--primary-text-color)";
  }

  if (normalizedField.endsWith("on_color") || normalizedField.endsWith("icon.color")) {
    return "var(--primary-text-color)";
  }

  if (normalizedField.endsWith("off_color")) {
    return "var(--primary-text-color)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
}


export function resolveColorInContext(contextNode: ParentNode | null | undefined, value: unknown) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue || typeof document === "undefined") {
    return rawValue;
  }

  const probe = document.createElement("span");
  probe.style.position = "fixed";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  probe.style.color = "";
  probe.style.color = rawValue;
  const context = typeof Element !== "undefined" && contextNode instanceof Element
    ? contextNode.shadowRoot || contextNode : contextNode;
  try {
    (context || document.body || document.documentElement).appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    return resolved || rawValue;
  } finally {
    probe.remove();
  }
}

export function isUnavailableState(state: HassEntity | null | undefined) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function getStepPrecision(step: unknown) {
  const text = String(step ?? "");
  if (!text.includes(".")) {
    return 0;
  }

  return (text.split(".")[1]?.length ?? 0);
}

/** Avoids `Number(null) === 0` / `Number("") === 0` which mis-renders many climate entities (e.g. ecobee off). */
export function parseFiniteClimateNumber(value: unknown) {
  return parseFiniteNumericValue(value) ?? NaN;
}

export function getHassLocale(hass: HomeAssistant | null | undefined) {
  const raw =
    hass?.locale?.language
    || hass?.selectedLanguage
    || hass?.language
    || (typeof navigator !== "undefined" ? navigator.language : "");
  const s = String(raw || "").trim();
  if (!s) return "en";
  try {
    Intl.getCanonicalLocales(s);
    return s;
  } catch (_error) {
    return "en";
  }
}

/** Engine overrides carry an ISO 8601 `until`; values without an offset are local time. */
export function parseEngineOverrideUntil(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatEngineOverrideTime(value: unknown, hass: HomeAssistant | null | undefined) {
  const parsed = parseEngineOverrideUntil(value);
  if (!parsed) {
    return "";
  }
  return parsed.toLocaleTimeString(getHassLocale(hass), { hour: "2-digit", minute: "2-digit" });
}

export function getClimateTemperatureUnit(hass: HomeAssistant | null | undefined) {
  const raw = String(hass?.config?.unit_system?.temperature ?? "").trim();
  if (raw.toUpperCase().includes("F")) {
    return "°F";
  }
  if (raw.toUpperCase().includes("C")) {
    return "°C";
  }
  return "°C";
}

export function getClimateTemperatureScaleLetter(hass: HomeAssistant | null | undefined) {
  return getClimateTemperatureUnit(hass).toUpperCase().includes("F") ? "F" : "C";
}

export function formatTemperature(value: unknown, step: unknown =  0.5, withUnit: unknown =  true, hass: HomeAssistant | null | undefined =  null) {
  const n = parseFiniteClimateNumber(value);
  if (!Number.isFinite(n)) {
    const u = getClimateTemperatureUnit(hass);
    return withUnit ? `-- ${u}` : "--";
  }

  const precision = Math.max(0, Math.min(getStepPrecision(step), 2));
  const formatted = n.toLocaleString(getHassLocale(hass), {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
  const u = getClimateTemperatureUnit(hass);
  return withUnit ? `${formatted} ${u}` : formatted;
}

/** Human-readable band for dual-setpoint (Ecobee-style) climate: numbers without degree, unit once at end (e.g. `20 – 22 °C`). */
export function formatTemperatureRangeSummary(low: unknown, high: unknown, step: unknown, hass: HomeAssistant | null | undefined) {
  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    const u = getClimateTemperatureUnit(hass);
    return `-- ${u}`;
  }
  const a = formatTemperature(low, step, false, hass);
  const b = formatTemperature(high, step, false, hass);
  const u = getClimateTemperatureUnit(hass);
  return `${a} – ${b} ${u}`;
}

export function getModeMeta(mode: unknown) {
  const normalized = normalizeTextKey(mode);

  switch (normalized) {
    case "off":
      return { label: "Off", icon: "mdi:power", accent: "off" };
    case "heat":
    case "heating":
      return { label: "Heat", icon: "mdi:fire", accent: "heat" };
    case "cool":
    case "cooling":
      return { label: "Cool", icon: "mdi:snowflake", accent: "cool" };
    case "heat_cool":
    case "auto":
      return { label: "Auto", icon: "mdi:thermostat-auto", accent: "auto" };
    case "dry":
    case "drying":
      return { label: "Dry", icon: "mdi:water-percent", accent: "dry" };
    case "fan_only":
      return { label: "Fan", icon: "mdi:fan", accent: "fan" };
    default:
      return { label: String(mode ?? ""), icon: "mdi:thermostat", accent: "auto" };
  }
}

export function getActionMeta(action: unknown) {
  const normalized = normalizeTextKey(action);

  switch (normalized) {
    case "heating":
      return { label: "Heating", icon: "mdi:fire", accent: "heat" };
    case "cooling":
      return { label: "Cooling", icon: "mdi:snowflake", accent: "cool" };
    case "drying":
      return { label: "Drying", icon: "mdi:water-percent", accent: "dry" };
    case "fan":
    case "fan_only":
      return { label: "Fan", icon: "mdi:fan", accent: "fan" };
    case "idle":
      return { label: "Idle", icon: "mdi:pause-circle-outline", accent: "off" };
    case "off":
      return { label: "Off", icon: "mdi:power", accent: "off" };
    default:
      return getModeMeta(action);
  }
}

/** Dial icon/label: prefer `hvac_action` unless HVAC is off (`hvac_action` is often `idle` while mode is `off`). */
export function climateDialActionMeta(actionRaw: unknown, modeRaw: unknown) {
  const modeKey = normalizeTextKey(String(modeRaw || "").trim());
  if (modeKey === "off") {
    const m = getModeMeta("off");
    return { icon: m.icon, label: m.label, accent: m.accent };
  }
  const action = String(actionRaw || "").trim();
  if (action) {
    const m = getActionMeta(action);
    const accent = m.accent != null ? m.accent : getModeMeta(action).accent;
    return { icon: m.icon || "mdi:thermostat", label: m.label, accent };
  }
  const mode = String(modeRaw || "").trim();
  const m = getModeMeta(mode);
  return { icon: m.icon || "mdi:thermostat", label: m.label, accent: m.accent };
}
