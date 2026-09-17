// @ts-nocheck -- extracted climate model; typed incrementally with climate-dial/config
import { clamp, normalizeTextKey } from "./climate-runtime";

export function parseSizeToPixels(value: unknown, fallback: number = 0): number {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}



export function escapeSelectorValue(value: unknown) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}


export function resolveEditorColorValue(value: unknown) {
  const resolver = window.NodaliaBubbleContrast?.resolveEditorColorValue;
  if (typeof resolver === "function") {
    return resolver(value);
  }
  return String(value ?? "").trim();
}

export function formatEditorHexChannel(value: unknown) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

export function formatEditorColorFromHex(hex: unknown, alpha: unknown =  1) {
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

export function getEditorColorModel(value: unknown, fallbackValue: unknown =  "#71c0ff") {
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


export function resolveColorInContext(contextNode: unknown, value: unknown) {
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
  (contextNode || document.body || document.documentElement).appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || rawValue;
}

export function parseRgbColor(value: unknown) {
  const source = String(value ?? "").trim();
  if (!source) {
    return null;
  }

  const rgbMatch = source.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const channels = rgbMatch[1]
      .split(",")
      .map(channel => Number.parseFloat(channel.trim()))
      .filter(channel => Number.isFinite(channel));

    if (channels.length >= 3) {
      return {
        red: clamp(channels[0], 0, 255),
        green: clamp(channels[1], 0, 255),
        blue: clamp(channels[2], 0, 255),
      };
    }
  }

  const hexMatch = source.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1].length === 3
      ? hexMatch[1].split("").map(channel => channel + channel).join("")
      : hexMatch[1];

    return {
      red: Number.parseInt(hex.slice(0, 2), 16),
      green: Number.parseInt(hex.slice(2, 4), 16),
      blue: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  return null;
}

export function getRelativeLuminance(color: unknown) {
  if (!color) {
    return null;
  }

  const toLinear = channel => {
    const normalized = clamp(Number(channel) / 255, 0, 1);
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  const red = toLinear(color.red);
  const green = toLinear(color.green);
  const blue = toLinear(color.blue);
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}


export function isUnavailableState(state: unknown) {
  return normalizeTextKey(state?.state) === "unavailable";
}

export function getStepPrecision(step: unknown) {
  const text = String(step ?? "");
  if (!text.includes(".")) {
    return 0;
  }

  return text.split(".")[1].length;
}

/** Avoids `Number(null) === 0` / `Number("") === 0` which mis-renders many climate entities (e.g. ecobee off). */
export function parseFiniteClimateNumber(value: unknown) {
  if (value === null || value === undefined) {
    return NaN;
  }
  if (typeof value === "string" && value.trim() === "") {
    return NaN;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export function getHassLocale(hass: unknown) {
  const raw =
    hass?.locale?.language
    || hass?.selectedLanguage
    || hass?.language
    || (typeof navigator !== "undefined" ? navigator.language : "");
  const s = String(raw || "").trim();
  return s || "en";
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

export function formatEngineOverrideTime(value: unknown, hass: unknown) {
  const parsed = parseEngineOverrideUntil(value);
  if (!parsed) {
    return "";
  }
  return parsed.toLocaleTimeString(getHassLocale(hass), { hour: "2-digit", minute: "2-digit" });
}

export function getClimateTemperatureUnit(hass: unknown) {
  const raw = String(hass?.config?.unit_system?.temperature ?? "").trim();
  if (raw.toUpperCase().includes("F")) {
    return "°F";
  }
  if (raw.toUpperCase().includes("C")) {
    return "°C";
  }
  return "°C";
}

export function getClimateTemperatureScaleLetter(hass: unknown) {
  return getClimateTemperatureUnit(hass).toUpperCase().includes("F") ? "F" : "C";
}

export function formatTemperature(value: unknown, step: unknown =  0.5, withUnit: unknown =  true, hass: unknown =  null) {
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
export function formatTemperatureRangeSummary(low: unknown, high: unknown, step: unknown, hass: unknown) {
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
