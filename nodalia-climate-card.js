const CARD_TAG = "nodalia-climate-card";
const EDITOR_TAG = "nodalia-climate-card-editor";
const CARD_VERSION = "1.2.0-alpha.51";
const SETPOINT_SCHEDULE_DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const SETPOINT_SCHEDULE_DAY_TO_JS = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};
const SETPOINT_SCHEDULE_MINUTES_PER_DAY = 24 * 60;
const SCHEDULE_TIMELINE_SNAP_MINUTES = 5;
const SCHEDULE_MIN_BLOCK_MINUTES = 15;
/** Pixels before a block press counts as drag (vs tap-to-select). */
const SCHEDULE_BLOCK_DRAG_THRESHOLD_PX = 6;
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
/** Pixels of pointer movement before a range-thumb interaction counts as a drag (vs tap-to-select). */
const RANGE_THUMB_DRAG_THRESHOLD_PX = 8;
const STEP_BUTTON_COMMIT_DEBOUNCE = 160;
const DRAFT_CONFIRMATION_TIMEOUT = 4200;
const DRAFT_CONFIRMATION_RETRY_LIMIT = 1;

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  entity_picture: "",
  show_entity_picture: false,
  show_state_chip: true,
  show_current_temperature_chip: true,
  show_humidity_chip: true,
  show_mode_buttons: true,
  show_step_controls: true,
  show_schedule_button: true,
  show_unavailable_badge: true,
  setpoint_schedule_webhook: "",
  setpoint_schedule_helper: "",
  /** `"monday"` (default) or `"sunday"` — first row in the schedule agenda. */
  setpoint_schedule_week_starts_on: "monday",
  security: {
    allow_webhooks_for_non_admin: true,
  },
  tap_action: "more-info",
  hold_action: "more-info",
  double_tap_action: "none",
  display: {
    /** `"target"` (default): large dial = setpoint; secondary = current when a target exists. `"current"`: swap. */
    main_temperature: "target",
  },
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    dial_duration: 220,
    button_bounce_duration: 340,
    content_duration: 420,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "30px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "16px",
      gap: "16px",
    },
    icon: {
      size: "58px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      on_color: "var(--primary-text-color)",
      off_color: "var(--primary-text-color)",
    },
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 10px",
    chip_border_radius: "999px",
    title_size: "16px",
    current_size: "16px",
    target_size: "50px",
    dial: {
      size: "280px",
      max_size: "480px",
      stroke: "18px",
      thumb_size: "24px",
      /** Inactive arc: must read on warm accent-tinted dial surfaces (not only flat `ha-card-background`). */
      track_color: "color-mix(in srgb, var(--primary-text-color) 32%, var(--divider-color))",
      background: "color-mix(in srgb, var(--primary-text-color) 5%, transparent)",
      heat_color: "#f59f42",
      cool_color: "#71c0ff",
      dry_color: "#7fd0c8",
      auto_color: "#c5a66f",
      fan_color: "#83d39c",
      off_color: "var(--primary-text-color)",
    },
    control: {
      size: "42px",
      accent_background: "rgba(113, 192, 255, 0.18)",
      accent_color: "var(--primary-text-color)",
    },
    step_control: {
      size: "50px",
    },
  },
};

const STUB_CONFIG = {
  entity: "climate.salon",
  name: "Salon",
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

function escapeSelectorValue(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

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

function resolveColorInContext(contextNode, value) {
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

function parseRgbColor(value) {
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

function getRelativeLuminance(color) {
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

function normalizeTextKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Row slices for stacked mode buttons, keeping denser lower rows narrow inside the dial. */
function buildClimateDialModeButtonRows(fragments) {
  const n = fragments.length;
  if (n === 0) {
    return [];
  }

  if (n < 3) {
    return [fragments];
  }

  if (n === 5 || n === 6) {
    return [fragments.slice(0, 3), fragments.slice(3)];
  }

  const rows = [fragments.slice(0, 2)];
  const rest = fragments.slice(2);
  let i = 0;
  while (i < rest.length) {
    const left = rest.length - i;
    if (left === 4) {
      rows.push(rest.slice(i, i + 2));
      rows.push(rest.slice(i + 2, i + 4));
      i += 4;
    } else if (left <= 3) {
      rows.push(rest.slice(i));
      i = rest.length;
    } else {
      rows.push(rest.slice(i, i + 2));
      i += 2;
    }
  }

  return rows;
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

/** Avoids `Number(null) === 0` / `Number("") === 0` which mis-renders many climate entities (e.g. ecobee off). */
function parseFiniteClimateNumber(value) {
  if (value === null || value === undefined) {
    return NaN;
  }
  if (typeof value === "string" && value.trim() === "") {
    return NaN;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function getHassLocale(hass) {
  const raw =
    hass?.locale?.language
    || hass?.selectedLanguage
    || hass?.language
    || (typeof navigator !== "undefined" ? navigator.language : "");
  const s = String(raw || "").trim();
  return s || "en";
}

function getClimateTemperatureUnit(hass) {
  const raw = String(hass?.config?.unit_system?.temperature ?? "").trim();
  if (raw.toUpperCase().includes("F")) {
    return "°F";
  }
  if (raw.toUpperCase().includes("C")) {
    return "°C";
  }
  return "°C";
}

function getClimateTemperatureScaleLetter(hass) {
  return getClimateTemperatureUnit(hass).toUpperCase().includes("F") ? "F" : "C";
}

function formatTemperature(value, step = 0.5, withUnit = true, hass = null) {
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
function formatTemperatureRangeSummary(low, high, step, hass) {
  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    const u = getClimateTemperatureUnit(hass);
    return `-- ${u}`;
  }
  const a = formatTemperature(low, step, false, hass);
  const b = formatTemperature(high, step, false, hass);
  const u = getClimateTemperatureUnit(hass);
  return `${a} – ${b} ${u}`;
}

function getModeMeta(mode) {
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

function getActionMeta(action) {
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
function climateDialActionMeta(actionRaw, modeRaw) {
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

/**
 * CSS `inset` for the dial center stack (mode buttons + readout), tuned by mode count and layout width.
 * @param {number} modeDialButtonCount
 * @param {boolean} tightLayout
 * @param {boolean} compactLayout
 * @returns {string}
 */
function getClimateDialCenterInsetCss(modeDialButtonCount, tightLayout, compactLayout) {
  const pick = (tightStr, compactStr, regularStr) => (
    tightLayout ? tightStr : compactLayout ? compactStr : regularStr
  );

  if (modeDialButtonCount === 5 || modeDialButtonCount === 6) {
    return pick("22% 12.5% 16.5% 12.5%", "23% 14% 17% 14%", "24% 14% 17.5% 14%");
  }
  if (modeDialButtonCount >= 7) {
    return pick("24% 12% 12% 12%", "25% 13.5% 13% 13.5%", "26% 14% 13.5% 14%");
  }
  if (modeDialButtonCount === 4) {
    return pick("24% 13.5% 15.5% 13.5%", "25% 15% 16.5% 15%", "26% 14.5% 17% 14.5%");
  }
  if (modeDialButtonCount === 3) {
    return pick("24% 14% 16% 14%", "25% 15% 17% 15%", "26% 15% 17.5% 15%");
  }
  return pick("22% 14% 16% 14%", "22% 15.5% 17% 15.5%", "21% 15% 18% 15%");
}

const LEGACY_CLIMATE_ICON_OFF_COLORS = [
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
  "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
];
const LEGACY_CLIMATE_DIAL_OFF_COLOR = "rgba(255, 255, 255, 0.28)";
/** Older default: arc matched flat card bg and disappeared on accent-tinted dial. */
const LEGACY_CLIMATE_DIAL_TRACK_COLOR = "color-mix(in srgb, var(--primary-text-color) 24%, var(--ha-card-background))";
const LEGACY_CLIMATE_DIAL_BACKGROUND = "color-mix(in srgb, var(--primary-text-color) 2%, transparent)";

function createSetpointScheduleSlotId() {
  return `slot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function parseScheduleClockMinutes(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) {
    return null;
  }

  return (hours * 60) + minutes;
}

function formatScheduleClockMinutes(totalMinutes) {
  const safe = clamp(Math.round(Number(totalMinutes) || 0), 0, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeSetpointScheduleDay(value) {
  const key = String(value ?? "").trim().toLowerCase();
  if (SETPOINT_SCHEDULE_DAY_ORDER.includes(key)) {
    return key;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const byIndex = SETPOINT_SCHEDULE_DAY_ORDER[numeric];
    if (byIndex) {
      return byIndex;
    }
    const jsMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    if (numeric >= 0 && numeric <= 6 && jsMap[numeric]) {
      return jsMap[numeric];
    }
  }

  return "mon";
}

function normalizeSetpointScheduleSlot(rawSlot, index = 0) {
  const source = isObject(rawSlot) ? rawSlot : {};
  const startMinutes = parseScheduleClockMinutes(source.start) ?? (7 * 60);
  let endMinutes = parseScheduleClockMinutes(source.end) ?? (22 * 60);
  if (endMinutes <= startMinutes) {
    endMinutes = Math.min(startMinutes + 60, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1);
  }

  const temperature = Number(source.temperature);
  return {
    id: String(source.id || "").trim() || createSetpointScheduleSlotId(),
    day: normalizeSetpointScheduleDay(source.day ?? SETPOINT_SCHEDULE_DAY_ORDER[index % 7]),
    start: formatScheduleClockMinutes(startMinutes),
    end: formatScheduleClockMinutes(endMinutes),
    temperature: Number.isFinite(temperature) ? temperature : 21,
    enabled: source.enabled !== false,
  };
}

function normalizeSetpointScheduleConfig(rawSchedule) {
  const schedule = isObject(rawSchedule) ? rawSchedule : {};
  const slots = Array.isArray(schedule.slots)
    ? schedule.slots.map((slot, index) => normalizeSetpointScheduleSlot(slot, index))
    : [];

  return {
    enabled: schedule.enabled !== false,
    slots,
  };
}

const SETPOINT_SCHEDULE_STORAGE_VERSION = 1;
const SETPOINT_SCHEDULE_STORAGE_VERSION_PACKED = 2;
const SETPOINT_SCHEDULE_STORAGE_VERSION_BINARY = 3;
const SETPOINT_SCHEDULE_INPUT_TEXT_MAX = 255;
/** Times in storage are quantized to this many minutes (matches agenda snap). */
const SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM = SCHEDULE_TIMELINE_SNAP_MINUTES;

function buildCompactSetpointScheduleSlotId(dayIdx, startMins, endMins) {
  return `c${dayIdx}_${startMins}_${endMins}`;
}

function quantizeSetpointScheduleStorageMinutes(minutes) {
  return clamp(
    Math.round(Number(minutes) / SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM) * SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM,
    0,
    SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1,
  );
}

function packSetpointScheduleSlot(dayIdx, startMins, endMins, temperature, enabled = true) {
  const startQ = clamp(Math.floor(quantizeSetpointScheduleStorageMinutes(startMins) / SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM), 0, 287);
  let endQ = clamp(Math.floor(quantizeSetpointScheduleStorageMinutes(endMins) / SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM), 0, 287);
  if (endQ <= startQ) {
    endQ = Math.min(startQ + Math.ceil(SCHEDULE_MIN_BLOCK_MINUTES / SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM), 287);
  }

  const day = clamp(Number(dayIdx), 0, 6);
  const temp = clamp(Math.round(Number(temperature)) - 5, 0, 255);
  const disabled = enabled === false ? 1 : 0;

  return (
    startQ |
    (endQ << 9) |
    (day << 18) |
    (disabled << 21) |
    (temp << 22)
  ) >>> 0;
}

function unpackSetpointSchedulePacked(packedValue) {
  const packed = Number(packedValue) >>> 0;
  const startQ = packed & 0x1FF;
  const endQ = (packed >> 9) & 0x1FF;
  const dayIdx = (packed >> 18) & 7;
  const disabled = (packed >> 21) & 1;
  const temperature = ((packed >> 22) & 0xFF) + 5;
  const startMins = startQ * SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM;
  let endMins = endQ * SETPOINT_SCHEDULE_STORAGE_TIME_QUANTUM;
  if (endMins <= startMins) {
    endMins = Math.min(startMins + SCHEDULE_MIN_BLOCK_MINUTES, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1);
  }

  return {
    id: buildCompactSetpointScheduleSlotId(dayIdx, startMins, endMins),
    day: SETPOINT_SCHEDULE_DAY_ORDER[dayIdx] || "mon",
    start: formatScheduleClockMinutes(startMins),
    end: formatScheduleClockMinutes(endMins),
    temperature,
    enabled: disabled !== 1,
  };
}

function encodeSetpointScheduleBinaryBase64(slots) {
  const bytes = new Uint8Array(slots.length * 4);
  slots.forEach((slot, index) => {
    const dayIdx = Math.max(0, SETPOINT_SCHEDULE_DAY_ORDER.indexOf(slot.day));
    const startMins = parseScheduleClockMinutes(slot.start) ?? 0;
    const endMins = parseScheduleClockMinutes(slot.end) ?? startMins + 60;
    const packed = packSetpointScheduleSlot(dayIdx, startMins, endMins, slot.temperature, slot.enabled);
    const offset = index * 4;
    bytes[offset] = (packed >>> 24) & 0xFF;
    bytes[offset + 1] = (packed >>> 16) & 0xFF;
    bytes[offset + 2] = (packed >>> 8) & 0xFF;
    bytes[offset + 3] = packed & 0xFF;
  });

  if (typeof btoa === "function") {
    let binary = "";
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  return "";
}

function decodeSetpointScheduleBinaryBase64(base64Value, slotCountHint = null) {
  const raw = String(base64Value ?? "").trim();
  if (!raw) {
    return [];
  }

  let bytes;
  if (typeof atob === "function") {
    const binary = atob(raw);
    bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  } else {
    return [];
  }

  const slotCount = Number.isFinite(Number(slotCountHint)) && Number(slotCountHint) > 0
    ? Number(slotCountHint)
    : Math.floor(bytes.length / 4);

  const slots = [];
  for (let index = 0; index < slotCount; index += 1) {
    const offset = index * 4;
    if (offset + 3 >= bytes.length) {
      break;
    }
    const packed = (
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]
    ) >>> 0;
    slots.push(unpackSetpointSchedulePacked(packed));
  }

  return slots;
}

function decodeSetpointScheduleStorageState(rawState) {
  const trimmed = String(rawState ?? "").trim();
  if (!trimmed || trimmed === "unknown" || trimmed === "unavailable") {
    return normalizeSetpointScheduleConfig({ enabled: true, slots: [] });
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!isObject(parsed)) {
      return normalizeSetpointScheduleConfig({ enabled: true, slots: [] });
    }

    if (Number(parsed.v) === SETPOINT_SCHEDULE_STORAGE_VERSION_BINARY && typeof parsed.b === "string") {
      const enabled = parsed.e !== 0;
      const slots = decodeSetpointScheduleBinaryBase64(parsed.b, parsed.n);
      return normalizeSetpointScheduleConfig({ enabled, slots });
    }

    if (Number(parsed.v) === SETPOINT_SCHEDULE_STORAGE_VERSION_PACKED && Array.isArray(parsed.s)) {
      const enabled = parsed.e !== 0;
      const slots = parsed.s
        .map(value => unpackSetpointSchedulePacked(value))
        .filter(Boolean);
      return normalizeSetpointScheduleConfig({ enabled, slots });
    }

    if (Number(parsed.v) === SETPOINT_SCHEDULE_STORAGE_VERSION && Array.isArray(parsed.s)) {
      const enabled = parsed.e !== 0;
      const slots = parsed.s
        .map((row, index) => {
          if (!Array.isArray(row) || row.length < 4) {
            return null;
          }

          const dayIdx = clamp(Number(row[0]), 0, SETPOINT_SCHEDULE_DAY_ORDER.length - 1);
          const startMins = clamp(Number(row[1]), 0, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1);
          let endMins = clamp(Number(row[2]), 0, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1);
          const temperature = Number(row[3]);
          const slotEnabled = row[4] === undefined || Number(row[4]) !== 0;

          if (endMins <= startMins) {
            endMins = Math.min(startMins + 60, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1);
          }

          return {
            id: buildCompactSetpointScheduleSlotId(dayIdx, startMins, endMins),
            day: SETPOINT_SCHEDULE_DAY_ORDER[dayIdx] || SETPOINT_SCHEDULE_DAY_ORDER[index % 7],
            start: formatScheduleClockMinutes(startMins),
            end: formatScheduleClockMinutes(endMins),
            temperature: Number.isFinite(temperature) ? temperature : 21,
            enabled: slotEnabled,
          };
        })
        .filter(Boolean);

      return normalizeSetpointScheduleConfig({ enabled, slots });
    }

    return normalizeSetpointScheduleConfig(parsed);
  } catch (_error) {
    return normalizeSetpointScheduleConfig({ enabled: true, slots: [] });
  }
}

function encodeSetpointScheduleStorageState(schedule) {
  const normalized = normalizeSetpointScheduleConfig(schedule);
  const candidates = [];

  if (normalized.slots.length > 0) {
    const packed = normalized.slots.map(slot => {
      const dayIdx = Math.max(0, SETPOINT_SCHEDULE_DAY_ORDER.indexOf(slot.day));
      const startMins = parseScheduleClockMinutes(slot.start) ?? 0;
      const endMins = parseScheduleClockMinutes(slot.end) ?? startMins + 60;
      return packSetpointScheduleSlot(dayIdx, startMins, endMins, slot.temperature, slot.enabled);
    });

    const binaryPayload = {
      v: SETPOINT_SCHEDULE_STORAGE_VERSION_BINARY,
      b: encodeSetpointScheduleBinaryBase64(normalized.slots),
      n: normalized.slots.length,
    };
    if (normalized.enabled === false) {
      binaryPayload.e = 0;
    }
    candidates.push(JSON.stringify(binaryPayload));

    const packedPayload = {
      v: SETPOINT_SCHEDULE_STORAGE_VERSION_PACKED,
      s: packed,
    };
    if (normalized.enabled === false) {
      packedPayload.e = 0;
    }
    candidates.push(JSON.stringify(packedPayload));
  }

  const rows = normalized.slots.map(slot => {
    const dayIdx = Math.max(0, SETPOINT_SCHEDULE_DAY_ORDER.indexOf(slot.day));
    const startMins = parseScheduleClockMinutes(slot.start) ?? 0;
    const endMins = parseScheduleClockMinutes(slot.end) ?? startMins + 60;
    const row = [dayIdx, startMins, endMins, slot.temperature];
    if (slot.enabled === false) {
      row.push(0);
    }
    return row;
  });

  const legacyCompactPayload = {
    v: SETPOINT_SCHEDULE_STORAGE_VERSION,
    s: rows,
  };
  if (normalized.enabled === false) {
    legacyCompactPayload.e = 0;
  }
  candidates.push(JSON.stringify(legacyCompactPayload));

  if (!normalized.slots.length) {
    const emptyPayload = { v: SETPOINT_SCHEDULE_STORAGE_VERSION_BINARY, b: "", n: 0 };
    if (normalized.enabled === false) {
      emptyPayload.e = 0;
    }
    candidates.push(JSON.stringify(emptyPayload));
  }

  const withinLimit = candidates.filter(candidate => candidate.length <= SETPOINT_SCHEDULE_INPUT_TEXT_MAX);
  if (withinLimit.length) {
    return withinLimit.sort((left, right) => left.length - right.length)[0];
  }

  return candidates.sort((left, right) => left.length - right.length)[0];
}

function normalizeSetpointScheduleWeekStartsOn(value) {
  const key = String(value ?? "monday").trim().toLowerCase();
  return key === "sunday" ? "sunday" : "monday";
}

function getSetpointScheduleDayOrder(weekStartsOn) {
  if (normalizeSetpointScheduleWeekStartsOn(weekStartsOn) === "sunday") {
    return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  }
  return [...SETPOINT_SCHEDULE_DAY_ORDER];
}

function snapScheduleTimelineMinutes(minutes) {
  return clamp(
    Math.round(Number(minutes) / SCHEDULE_TIMELINE_SNAP_MINUTES) * SCHEDULE_TIMELINE_SNAP_MINUTES,
    0,
    SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1,
  );
}

function getSetpointScheduleBlockLayout(slot) {
  const start = parseScheduleClockMinutes(slot.start) ?? 0;
  let end = parseScheduleClockMinutes(slot.end) ?? start + 60;
  if (end <= start) {
    end = Math.min(start + SCHEDULE_MIN_BLOCK_MINUTES, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1);
  }
  const span = Math.max(end - start, SCHEDULE_MIN_BLOCK_MINUTES);
  const left = (start / SETPOINT_SCHEDULE_MINUTES_PER_DAY) * 100;
  const width = (span / SETPOINT_SCHEDULE_MINUTES_PER_DAY) * 100;
  return { start, end, left, width };
}

function findScheduleGapForDay(slots, day) {
  const daySlots = (Array.isArray(slots) ? slots : [])
    .filter(slot => slot.day === day && slot.enabled !== false)
    .map(slot => {
      const start = parseScheduleClockMinutes(slot.start) ?? 0;
      const end = parseScheduleClockMinutes(slot.end) ?? start + 60;
      return { start, end: Math.max(end, start + SCHEDULE_MIN_BLOCK_MINUTES) };
    })
    .sort((left, right) => left.start - right.start);

  if (!daySlots.length) {
    return {
      start: 0,
      end: SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1,
    };
  }

  let best = { start: 0, end: 0, size: 0 };
  let cursor = 0;
  daySlots.forEach(slot => {
    const gapSize = slot.start - cursor;
    if (gapSize > best.size) {
      best = { start: cursor, end: slot.start, size: gapSize };
    }
    cursor = Math.max(cursor, slot.end);
  });

  const tailSize = SETPOINT_SCHEDULE_MINUTES_PER_DAY - cursor;
  if (tailSize > best.size) {
    best = { start: cursor, end: SETPOINT_SCHEDULE_MINUTES_PER_DAY, size: tailSize };
  }

  if (best.size >= SCHEDULE_MIN_BLOCK_MINUTES) {
    return {
      start: best.start,
      end: Math.max(best.start + SCHEDULE_MIN_BLOCK_MINUTES, best.end - 1),
    };
  }

  const last = daySlots[daySlots.length - 1];
  const start = clamp(last.end, 0, SETPOINT_SCHEDULE_MINUTES_PER_DAY - SCHEDULE_MIN_BLOCK_MINUTES);
  return {
    start,
    end: Math.min(start + 60, SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1),
  };
}

function scheduleMinutesFromTrackClientX(track, clientX) {
  const rect = track.getBoundingClientRect();
  if (!rect.width) {
    return 0;
  }
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
  return snapScheduleTimelineMinutes(ratio * SETPOINT_SCHEDULE_MINUTES_PER_DAY);
}

function getActiveSetpointScheduleSlot(slots, date = new Date()) {
  if (!Array.isArray(slots) || !slots.length) {
    return null;
  }

  const jsDay = date.getDay();
  const minutesNow = (date.getHours() * 60) + date.getMinutes();

  let winner = null;
  let winnerStart = -1;

  slots.forEach(slot => {
    if (slot?.enabled === false) {
      return;
    }
    if (SETPOINT_SCHEDULE_DAY_TO_JS[slot.day] !== jsDay) {
      return;
    }

    const start = parseScheduleClockMinutes(slot.start);
    const end = parseScheduleClockMinutes(slot.end);
    if (start === null || end === null) {
      return;
    }

    const inRange = end > start
      ? minutesNow >= start && minutesNow < end
      : minutesNow >= start || minutesNow < end;
    if (!inRange) {
      return;
    }

    if (start > winnerStart) {
      winner = slot;
      winnerStart = start;
    }
  });

  return winner;
}

const SETPOINT_SCHEDULE_HA_WEEKDAY = {
  mon: ["mon"],
  tue: ["tue"],
  wed: ["wed"],
  thu: ["thu"],
  fri: ["fri"],
  sat: ["sat"],
  sun: ["sun"],
};

function getClimateScheduleStorageEntityId(entityId, configuredHelper = "") {
  const custom = String(configuredHelper ?? "").trim();
  if (custom) {
    return custom;
  }

  const slug = String(entityId ?? "")
    .trim()
    .replace(/^climate\./, "")
    .replace(/[^a-z0-9_]+/gi, "_")
    .replace(/^_+|_+$/g, "");
  return slug ? `input_text.nodalia_climate_schedule_${slug}` : "";
}

function buildClimateSetpointScheduleAutomationId(entityId, slotId) {
  const base = `nodalia_climate_${String(entityId ?? "").replace(".", "_")}_${String(slotId ?? "")}`;
  return base.replace(/[^a-z0-9_]/gi, "_").slice(0, 120);
}

function buildClimateSetpointScheduleAutomationSpecs(entityId, schedule, friendlyName = "") {
  if (!String(entityId ?? "").trim() || schedule?.enabled === false) {
    return [];
  }

  const label = String(friendlyName || entityId).trim();
  return (Array.isArray(schedule?.slots) ? schedule.slots : [])
    .filter(slot => slot?.enabled !== false)
    .map(slot => {
      const start = String(slot.start || "08:00").trim();
      const at = /^\d{2}:\d{2}:\d{2}$/.test(start) ? start : `${start}:00`;
      const weekday = SETPOINT_SCHEDULE_HA_WEEKDAY[slot.day] || [slot.day];
      return {
        id: buildClimateSetpointScheduleAutomationId(entityId, slot.id),
        alias: `Nodalia | ${label} | ${slot.day} ${slot.start}-${slot.end}`,
        description: "Managed by Nodalia Climate Card setpoint schedule webhook.",
        mode: "single",
        trigger: [{ platform: "time", at }],
        condition: [{ condition: "time", weekday }],
        action: [{
          action: "climate.set_temperature",
          target: { entity_id: entityId },
          data: { temperature: slot.temperature },
        }],
      };
    });
}

function yamlQuote(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function buildClimateSetpointScheduleAutomationsYaml(entityId, schedule, friendlyName = "") {
  const specs = buildClimateSetpointScheduleAutomationSpecs(entityId, schedule, friendlyName);
  if (!specs.length) {
    return "";
  }

  return specs
    .map(spec => {
      const triggerAt = spec.trigger?.[0]?.at || "08:00:00";
      const weekday = spec.condition?.[0]?.weekday || ["mon"];
      const temperature = spec.action?.[0]?.data?.temperature ?? 21;
      const weekdayYaml = weekday.map(day => `        - ${day}`).join("\n");
      return `- id: ${yamlQuote(spec.id)}
  alias: ${yamlQuote(spec.alias)}
  description: ${yamlQuote(spec.description)}
  mode: single
  trigger:
    - platform: time
      at: ${yamlQuote(triggerAt)}
  condition:
    - condition: time
      weekday:
${weekdayYaml}
  action:
    - action: climate.set_temperature
      target:
        entity_id: ${yamlQuote(entityId)}
      data:
        temperature: ${temperature}`;
    })
    .join("\n\n");
}

function buildClimateSetpointScheduleWebhookBody(options = {}) {
  const entityId = String(options.entityId ?? "").trim();
  const schedule = normalizeSetpointScheduleConfig(options.schedule);
  const storageEntityId = String(options.storageEntityId ?? "").trim();
  const friendlyName = String(options.friendlyName ?? "").trim();
  const automationSpecs = buildClimateSetpointScheduleAutomationSpecs(entityId, schedule, friendlyName);
  const storageState = encodeSetpointScheduleStorageState(schedule);
  const automationYamlBundle = buildClimateSetpointScheduleAutomationsYaml(entityId, schedule, friendlyName);

  return {
    type: "climate_setpoint_schedule",
    card: CARD_TAG,
    card_version: options.cardVersion || CARD_VERSION,
    entity_id: entityId,
    friendly_name: friendlyName,
    schedule,
    storage_entity_id: storageEntityId,
    storage_state: storageState,
    automation_specs: automationSpecs,
    automation_yaml_bundle: automationYamlBundle,
    automation_id_prefix: entityId ? `nodalia_climate_${entityId.replace(".", "_")}_` : "nodalia_climate_",
    ha_action: storageEntityId
      ? {
        action: "input_text.set_value",
        target: { entity_id: storageEntityId },
        data: { value: storageState },
      }
      : null,
  };
}

function migrateLegacyClimateOffColors(styles) {
  if (!styles?.icon) {
    return;
  }
  const iconOff = String(styles.icon.off_color ?? "").trim();
  if (iconOff && (LEGACY_CLIMATE_ICON_OFF_COLORS.includes(iconOff) || /^var\(\s*--state-inactive-color/i.test(iconOff))) {
    styles.icon.off_color = DEFAULT_CONFIG.styles.icon.off_color;
  }
  if (styles.dial) {
    const dialOff = String(styles.dial.off_color ?? "").trim();
    if (dialOff === LEGACY_CLIMATE_DIAL_OFF_COLOR) {
      styles.dial.off_color = DEFAULT_CONFIG.styles.dial.off_color;
    }
    const track = String(styles.dial.track_color ?? "").trim().replace(/\s+/g, " ");
    if (track === LEGACY_CLIMATE_DIAL_TRACK_COLOR.replace(/\s+/g, " ")) {
      styles.dial.track_color = DEFAULT_CONFIG.styles.dial.track_color;
    }
    const dialBg = String(styles.dial.background ?? "").trim().replace(/\s+/g, " ");
    if (dialBg === LEGACY_CLIMATE_DIAL_BACKGROUND.replace(/\s+/g, " ")) {
      styles.dial.background = DEFAULT_CONFIG.styles.dial.background;
    }
  }
}

function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const CLIMATE_ACTIONS = new Set(["more-info", "none"]);
  const norm = (value, fallback) => {
    const key = String(value ?? fallback).trim().toLowerCase();
    return CLIMATE_ACTIONS.has(key) ? key : fallback;
  };
  config.tap_action = norm(config.tap_action, "more-info");
  config.hold_action = norm(config.hold_action, "more-info");
  config.double_tap_action = norm(config.double_tap_action, "none");
  config.entity_picture = String(config.entity_picture ?? "").trim();
  config.show_entity_picture = config.show_entity_picture === true;
  migrateLegacyClimateOffColors(config.styles);
  config.setpoint_schedule_webhook = String(config.setpoint_schedule_webhook ?? "").trim();
  config.setpoint_schedule_helper = String(config.setpoint_schedule_helper ?? "").trim();
  config.setpoint_schedule_week_starts_on = normalizeSetpointScheduleWeekStartsOn(
    config.setpoint_schedule_week_starts_on,
  );
  config.show_schedule_button = config.show_schedule_button !== false;
  config.security = config.security || {};
  const legacyRequireAdmin = config.security.require_admin_for_webhooks === true;
  if (config.security.allow_webhooks_for_non_admin === undefined) {
    config.security.allow_webhooks_for_non_admin = !legacyRequireAdmin;
  }
  config.security.allow_webhooks_for_non_admin = config.security.allow_webhooks_for_non_admin !== false;
  return config;
}

function getDialValueFromPoint(dial, clientX, clientY, range, step, fallbackValue = null, geometry = null) {
  const rect = geometry || dial.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return Number.isFinite(Number(fallbackValue)) ? Number(fallbackValue) : range.min;
  }

  const centerX = rect.left + (rect.width / 2);
  const centerY = rect.top + (rect.height / 2);
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const distance = Math.sqrt((dx ** 2) + (dy ** 2));
  const outerRadius = Math.min(rect.width, rect.height) / 2;
  const innerDeadZone = outerRadius * 0.42;

  if (distance < innerDeadZone && Number.isFinite(Number(fallbackValue))) {
    return Number(fallbackValue);
  }

  const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
  let normalizedAngle = angle < 0 ? angle + 360 : angle;

  if (normalizedAngle < DIAL_START_ANGLE) {
    normalizedAngle += 360;
  }

  normalizedAngle = clamp(normalizedAngle, DIAL_START_ANGLE, DIAL_END_ANGLE);

  const ratio = (normalizedAngle - DIAL_START_ANGLE) / DIAL_SWEEP;
  const rawValue = range.min + ((range.max - range.min) * ratio);
  const safeStep = Number.isFinite(step) && step > 0 ? step : 0.5;
  const rounded = range.min + (Math.round((rawValue - range.min) / safeStep) * safeStep);

  return clamp(Number(rounded.toFixed(2)), range.min, range.max);
}

function getDialMarkerPosition(angle) {
  const markerRadiusPercent = (DIAL_CIRCLE_RADIUS / DIAL_VIEWBOX_SIZE) * 100;
  const radians = (angle * Math.PI) / 180;
  return {
    left: Number((50 + (Math.cos(radians) * markerRadiusPercent)).toFixed(3)),
    top: Number((50 + (Math.sin(radians) * markerRadiusPercent)).toFixed(3)),
  };
}

class NodaliaClimateCard extends HTMLElement {
  static async getConfigElement() {
    if (!customElements.get(EDITOR_TAG) && typeof customElements?.whenDefined === "function") {
      await customElements.whenDefined(EDITOR_TAG);
    }

    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["climate"]);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._draftTemperature = new Map();
    this._draftTempRange = new Map();
    this._draftResetTimer = 0;
    this._temperatureCommitDebounceTimer = 0;
    this._temperatureCommitQueuedValue = null;
    this._temperatureCommitInFlight = false;
    this._temperatureCommitRequiresHvacWake = false;
    this._temperatureCommitRetryCount = 0;
    this._rangeCommitDebounceTimer = 0;
    this._rangeCommitQueuedValue = null;
    this._rangeCommitInFlight = false;
    this._rangeCommitRetryCount = 0;
    this._activeDialDrag = null;
    this._dragWindowListenersAttached = false;
    this._dialDragFrame = 0;
    this._pendingDialDragPoint = null;
    this._pendingRenderAfterDrag = false;
    /** `null` | `"low"` | `"high"` — dual-range (`heat_cool`) thumb focus for step buttons; not persisted. */
    this._selectedRangeThumb = null;
    this._lastDualRangeModeKey = null;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowPointerDown = this._onShadowPointerDown.bind(this);
    this._onShadowMouseDown = this._onShadowMouseDown.bind(this);
    this._onShadowTouchStart = this._onShadowTouchStart.bind(this);
    this._onWindowPointerMove = this._onWindowPointerMove.bind(this);
    this._onWindowPointerUp = this._onWindowPointerUp.bind(this);
    this._onWindowMouseMove = this._onWindowMouseMove.bind(this);
    this._onWindowMouseUp = this._onWindowMouseUp.bind(this);
    this._onWindowTouchStartCapture = this._onWindowTouchStartCapture.bind(this);
    this._onWindowTouchMove = this._onWindowTouchMove.bind(this);
    this._onWindowTouchEnd = this._onWindowTouchEnd.bind(this);
    this._detachHostHold = () => {};
    this._suppressNextClimateTap = false;
    this._scheduleComposerOpen = false;
    this._scheduleComposerDraft = normalizeSetpointScheduleConfig({ enabled: true, slots: [] });
    this._scheduleComposerError = "";
    this._scheduleComposerSaving = false;
    this._scheduleComposerSelectedSlotId = "";
    this._activeScheduleDrag = null;
    this._scheduleBlockDragPending = null;
    this._onWindowSchedulePointerMove = this._onWindowSchedulePointerMove.bind(this);
    this._onWindowSchedulePointerUp = this._onWindowSchedulePointerUp.bind(this);
    this._onWindowScheduleBlockDragMove = this._onWindowScheduleBlockDragMove.bind(this);
    this._onWindowScheduleBlockDragUp = this._onWindowScheduleBlockDragUp.bind(this);
    this._onShadowKeyDown = this._onShadowKeyDown.bind(this);
    this._onShadowInput = this._onShadowInput.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("keydown", this._onShadowKeyDown);
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown);
    this.shadowRoot.addEventListener("mousedown", this._onShadowMouseDown);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      this.shadowRoot.addEventListener("touchstart", this._onShadowTouchStart, { passive: false });
    }
  }

  connectedCallback() {
    this._detachHostHold?.();
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const path = event.composedPath();
              if (path.some(node => node instanceof HTMLElement && node.dataset?.climateAction)) {
                return null;
              }
              if (path.some(node => node instanceof HTMLElement && node.dataset?.climateControl)) {
                return null;
              }
              if (
                path.some(
                  node =>
                    node instanceof HTMLElement &&
                    (node.classList?.contains("climate-schedule-expanded") ||
                      node.classList?.contains("climate-schedule-agenda__track") ||
                      node.dataset?.scheduleBlockId ||
                      node.dataset?.scheduleResize ||
                      node.dataset?.climateScheduleField ||
                      node.dataset?.climateScheduleBackdrop === "true"),
                )
              ) {
                return null;
              }
              return path.some(node => node instanceof HTMLElement && node.dataset?.climateCard === "root")
                ? "body"
                : null;
            },
            shouldBeginHold: () => {
              const action = String(this._config?.hold_action || "more-info");
              return action !== "none" && Boolean(this._getState());
            },
            onHold: () => {
              this._triggerHaptic();
              this._triggerPressAnimation(this.shadowRoot?.querySelector(".climate-card__content"));
              this._performHoldAction();
            },
            markHoldConsumedClick: () => {
              this._suppressNextClimateTap = true;
              window.NodaliaUtils?.cancelCardZoneTap?.(this);
            },
          })
        : () => {};
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    this._detachHostHold?.();
    this._detachHostHold = () => {};
    window.NodaliaUtils?.cancelCardZoneTap?.(this);
    this._setDragWindowListeners(false);
    this._setScheduleDragWindowListeners(false);
    this._setScheduleBlockDragPendingListeners(false);
    this._activeScheduleDrag = null;
    this._scheduleBlockDragPending = null;

    if (this._draftResetTimer) {
      window.clearTimeout(this._draftResetTimer);
      this._draftResetTimer = 0;
    }

    if (this._temperatureCommitDebounceTimer) {
      window.clearTimeout(this._temperatureCommitDebounceTimer);
      this._temperatureCommitDebounceTimer = 0;
    }
    if (this._rangeCommitDebounceTimer) {
      window.clearTimeout(this._rangeCommitDebounceTimer);
      this._rangeCommitDebounceTimer = 0;
    }
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    if (this._dialDragFrame) {
      window.cancelAnimationFrame(this._dialDragFrame);
      this._dialDragFrame = 0;
    }
    this._pendingDialDragPoint = null;
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    const prevEntity = this._config?.entity;
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    if (prevEntity && prevEntity !== this._config.entity) {
      this._draftTemperature.clear();
      this._draftTempRange.clear();
      this._temperatureCommitQueuedValue = null;
      this._rangeCommitQueuedValue = null;
      if (this._temperatureCommitDebounceTimer) {
        window.clearTimeout(this._temperatureCommitDebounceTimer);
        this._temperatureCommitDebounceTimer = 0;
      }
      if (this._rangeCommitDebounceTimer) {
        window.clearTimeout(this._rangeCommitDebounceTimer);
        this._rangeCommitDebounceTimer = 0;
      }
      this._selectedRangeThumb = null;
      this._lastDualRangeModeKey = null;
      this._temperatureCommitRequiresHvacWake = false;
    }
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const entityId = this._config?.entity || "";
    if (
      entityId
      && (this._draftTemperature.has(entityId) || this._draftTempRange.has(entityId))
    ) {
      this._syncDraftWithState();
    }

    const nextSignature = this._getRenderSignature(hass);
    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      if (this._activeDialDrag) {
        this._pendingRenderAfterDrag = true;
      }
      return;
    }

    this._lastRenderSignature = nextSignature;

    if (this._activeDialDrag) {
      this._pendingRenderAfterDrag = true;
      return;
    }

    this._render();
  }

  getCardSize() {
    return 4;
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
      showEntityPicture: this._config?.show_entity_picture === true,
      entityPicture: String(this._config?.entity_picture || attrs.entity_picture_local || attrs.entity_picture || ""),
      temperature: parseFiniteClimateNumber(attrs.temperature),
      currentTemperature: parseFiniteClimateNumber(attrs.current_temperature),
      targetTempHigh: parseFiniteClimateNumber(attrs.target_temp_high),
      targetTempLow: parseFiniteClimateNumber(attrs.target_temp_low),
      humidity: Number(attrs.humidity ?? -1),
      currentHumidity: Number(attrs.current_humidity ?? -1),
      hvacMode: String(attrs.hvac_mode || ""),
      hvacAction: String(attrs.hvac_action || ""),
      presetMode: String(attrs.preset_mode || ""),
      fanMode: String(attrs.fan_mode || ""),
      swingMode: String(attrs.swing_mode || ""),
      actions: `${String(this._config?.tap_action || "")}|${String(this._config?.hold_action || "")}|${String(this._config?.double_tap_action || "")}`,
      hasTemperatureDraft: Boolean(
        entityId && (this._draftTemperature.has(entityId) || this._draftTempRange.has(entityId)),
      ),
      scheduleComposerOpen: this._scheduleComposerOpen === true,
      scheduleDraft: this._scheduleComposerDraft,
      scheduleComposerError: this._scheduleComposerError,
      scheduleComposerSaving: this._scheduleComposerSaving === true,
      showScheduleButton: this._config?.show_schedule_button !== false,
    });
  }

  _climateScheduleText(key, fallback = "") {
    if (typeof window.NodaliaI18n?.translateClimateSchedule === "function") {
      return window.NodaliaI18n.translateClimateSchedule(
        this._hass,
        this._config?.language ?? "auto",
        key,
        fallback,
      );
    }
    return fallback;
  }

  _getScheduleComposerDraft() {
    return normalizeSetpointScheduleConfig(this._scheduleComposerDraft);
  }

  _setScheduleComposerDraft(schedule, options = {}) {
    this._scheduleComposerDraft = normalizeSetpointScheduleConfig(schedule);
    if (options.render !== false) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  _loadScheduleDraftFromStorage() {
    const storageEntityId = getClimateScheduleStorageEntityId(
      this._config?.entity,
      this._config?.setpoint_schedule_helper,
    );
    const rawState = storageEntityId ? String(this._hass?.states?.[storageEntityId]?.state ?? "").trim() : "";
    if (rawState && rawState !== "unknown" && rawState !== "unavailable") {
      return decodeSetpointScheduleStorageState(rawState);
    }

    const legacy = this._config?.setpoint_schedule;
    if (legacy && (Array.isArray(legacy.slots) ? legacy.slots.length : 0) > 0) {
      return normalizeSetpointScheduleConfig(legacy);
    }

    return normalizeSetpointScheduleConfig({ enabled: true, slots: [] });
  }

  _openScheduleComposer() {
    this._scheduleComposerError = "";
    this._scheduleComposerSaving = false;
    this._scheduleComposerDraft = this._loadScheduleDraftFromStorage();
    this._scheduleComposerOpen = true;
    this._lastRenderSignature = "";
    this._render();
  }

  _closeScheduleComposer() {
    this._scheduleComposerOpen = false;
    this._scheduleComposerError = "";
    this._scheduleComposerSaving = false;
    this._scheduleComposerSelectedSlotId = "";
    this._activeScheduleDrag = null;
    this._scheduleBlockDragPending = null;
    this._setScheduleDragWindowListeners(false);
    this._setScheduleBlockDragPendingListeners(false);
    this._lastRenderSignature = "";
    this._render();
  }

  _setScheduleComposerError(message = "") {
    this._scheduleComposerError = String(message ?? "").trim();
    this._lastRenderSignature = "";
    this._render();
  }

  _renderScheduleComposerErrorHtml() {
    const message = String(this._scheduleComposerError || "").trim();
    if (!message) {
      return "";
    }

    return `
      <div class="climate-schedule-expanded__error" role="alert" aria-live="polite">
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
  }

  async _postScheduleWebhookPayload(webhookId, body) {
    const id = String(webhookId ?? "").trim();
    if (!id) {
      return false;
    }

    if (
      this._config?.security?.allow_webhooks_for_non_admin === false &&
      !this._hass?.user?.is_admin
    ) {
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn(
          "Nodalia Climate Card: webhook blocked for non-admin user (security.allow_webhooks_for_non_admin=false).",
        );
      }
      return false;
    }

    const post =
      typeof window !== "undefined" &&
      window.NodaliaUtils &&
      typeof window.NodaliaUtils.postHomeAssistantWebhook === "function"
        ? window.NodaliaUtils.postHomeAssistantWebhook
        : null;
    if (!post) {
      return false;
    }

    try {
      return Boolean(await post(id, body, this._hass));
    } catch (_error) {
      return false;
    }
  }

  _syncScheduleComposerDraftFromDom() {
    if (!this.shadowRoot) {
      return this._getScheduleComposerDraft();
    }

    const schedule = this._getScheduleComposerDraft();
    schedule.enabled = Boolean(
      this.shadowRoot.querySelector('[data-climate-schedule-field="enabled"]')?.checked,
    );

    const slots = [];
    const seenSlotIds = new Set();
    this.shadowRoot.querySelectorAll("[data-schedule-slot-editor]").forEach(editor => {
      const slotId = String(editor.getAttribute("data-schedule-slot-editor") || "").trim();
      if (!slotId || seenSlotIds.has(slotId)) {
        return;
      }
      seenSlotIds.add(slotId);

      const start = String(editor.querySelector('[data-climate-schedule-field="start"]')?.value || "").trim();
      const end = String(editor.querySelector('[data-climate-schedule-field="end"]')?.value || "").trim();
      const temperatureRaw = Number(editor.querySelector('[data-climate-schedule-field="temperature"]')?.value);
      const existing = schedule.slots.find(slot => slot.id === slotId);
      slots.push(
        normalizeSetpointScheduleSlot({
          ...(existing || {}),
          id: slotId,
          start,
          end,
          temperature: temperatureRaw,
        }),
      );
    });

    schedule.slots = slots;
    this._scheduleComposerDraft = schedule;
    return schedule;
  }

  async _submitScheduleComposer() {
    if (!this.isConnected || !this._hass || !this.shadowRoot) {
      return;
    }

    const webhookId = String(this._config?.setpoint_schedule_webhook || "").trim();
    if (!webhookId) {
      this._setScheduleComposerError(
        this._climateScheduleText("errors.webhookMissing", "Configure a setpoint schedule webhook in the card editor."),
      );
      return;
    }

    const entityId = String(this._config?.entity || "").trim();
    if (!entityId) {
      this._setScheduleComposerError(
        this._climateScheduleText("errors.entityMissing", "Select a climate entity first."),
      );
      return;
    }

    const state = this._getState();
    if (state && this._isDualSetpointRange(state)) {
      this._setScheduleComposerError(
        this._climateScheduleText(
          "errors.dualRangeUnsupported",
          "Weekly schedules are not supported while the thermostat uses a dual heat/cool range.",
        ),
      );
      return;
    }

    const schedule = this._syncScheduleComposerDraftFromDom();
    const storageEntityId = getClimateScheduleStorageEntityId(
      entityId,
      this._config?.setpoint_schedule_helper,
    );
    const body = buildClimateSetpointScheduleWebhookBody({
      entityId,
      schedule,
      storageEntityId,
      friendlyName: this._getClimateName(state),
      cardVersion: CARD_VERSION,
    });

    this._scheduleComposerSaving = true;
    this._scheduleComposerError = "";
    this._lastRenderSignature = "";
    this._render();

    const ok = await this._postScheduleWebhookPayload(webhookId, body);
    this._scheduleComposerSaving = false;

    if (!ok) {
      this._setScheduleComposerError(
        this._climateScheduleText("errors.webhookFailed", "Could not sync the schedule. Check the webhook and Home Assistant logs."),
      );
      return;
    }

    if (storageEntityId && typeof this._hass?.callService === "function") {
      try {
        await Promise.resolve(
          this._hass.callService("input_text", "set_value", {
            entity_id: storageEntityId,
            value: body.storage_state,
          }),
        );
      } catch (_error) {
        // Webhook may already persist; ignore optimistic helper write failures.
      }
    }

    this._scheduleComposerDraft = schedule;
    this._triggerHaptic("success");
    this._closeScheduleComposer();
  }

  _updateScheduleComposerSlot(slotId, patch = {}, options = {}) {
    const schedule = this._getScheduleComposerDraft();
    const index = schedule.slots.findIndex(slot => slot.id === slotId);
    if (index === -1) {
      return;
    }

    schedule.slots[index] = normalizeSetpointScheduleSlot({
      ...schedule.slots[index],
      ...patch,
    });
    this._scheduleComposerDraft = normalizeSetpointScheduleConfig(schedule);
    if (options.render !== false) {
      this._lastRenderSignature = "";
      this._render();
      return;
    }

    this._patchScheduleBlockDom(slotId);
  }

  _getScheduleDayTrackElement(day) {
    const dayKey = String(day ?? "").trim();
    if (!dayKey || !this.shadowRoot) {
      return null;
    }

    const track = this.shadowRoot.querySelector(`[data-schedule-day-track="${escapeSelectorValue(dayKey)}"]`);
    return track instanceof HTMLElement ? track : null;
  }

  _patchScheduleBlockDom(slotId) {
    if (!this.shadowRoot || !slotId) {
      return;
    }

    const schedule = this._getScheduleComposerDraft();
    const slot = schedule.slots.find(item => item.id === slotId);
    if (!slot) {
      return;
    }

    const layout = getSetpointScheduleBlockLayout(slot);
    const block = this.shadowRoot.querySelector(
      `[data-schedule-block-id="${escapeSelectorValue(slotId)}"]`,
    );
    if (block instanceof HTMLElement) {
      block.style.setProperty("--block-left", `${layout.left.toFixed(3)}%`);
      block.style.setProperty("--block-width", `${layout.width.toFixed(3)}%`);
      const timeEl = block.querySelector(".climate-schedule-agenda__block-time");
      const tempEl = block.querySelector(".climate-schedule-agenda__block-temp");
      const tempLabel = formatTemperature(
        slot.temperature,
        this._getTemperatureStep(this._getState()),
        true,
        this._hass,
      );
      const rangeLabel = `${slot.start}–${slot.end}`;
      if (timeEl) {
        timeEl.textContent = rangeLabel;
      }
      if (tempEl) {
        tempEl.textContent = tempLabel;
      }
      block.title = `${rangeLabel} · ${tempLabel}`;
      block.setAttribute("aria-label", `${rangeLabel}, ${tempLabel}`);
    }

    const editor = this.shadowRoot.querySelector(
      `[data-schedule-slot-editor="${escapeSelectorValue(slotId)}"]`,
    );
    if (editor instanceof HTMLElement) {
      const startInput = editor.querySelector('[data-climate-schedule-field="start"]');
      const endInput = editor.querySelector('[data-climate-schedule-field="end"]');
      const tempInput = editor.querySelector('[data-climate-schedule-field="temperature"]');
      const activeEl = this.shadowRoot?.activeElement;
      if (startInput instanceof HTMLInputElement && activeEl !== startInput) {
        startInput.value = slot.start;
      }
      if (endInput instanceof HTMLInputElement && activeEl !== endInput) {
        endInput.value = slot.end;
      }
      if (tempInput instanceof HTMLInputElement && activeEl !== tempInput) {
        tempInput.value = String(slot.temperature);
      }
    }
  }

  _syncScheduleComposerSelectionDom() {
    if (!this.shadowRoot) {
      return;
    }

    const selectedId = this._scheduleComposerSelectedSlotId;
    this.shadowRoot.querySelectorAll("[data-schedule-block-id]").forEach(node => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      node.classList.toggle("is-selected", node.dataset.scheduleBlockId === selectedId);
    });
    this.shadowRoot.querySelectorAll("[data-schedule-slot-editor]").forEach(node => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      node.classList.toggle("is-visible", node.getAttribute("data-schedule-slot-editor") === selectedId);
    });
  }

  _addScheduleComposerSlot(day = "mon") {
    const schedule = this._getScheduleComposerDraft();
    const gap = findScheduleGapForDay(schedule.slots, day);
    const daySlots = schedule.slots.filter(slot => slot.day === day);
    const fallbackTemp = daySlots.length ? daySlots[daySlots.length - 1].temperature : 21;
    const slot = normalizeSetpointScheduleSlot({
      day,
      start: formatScheduleClockMinutes(gap.start),
      end: formatScheduleClockMinutes(gap.end),
      temperature: fallbackTemp,
    });
    schedule.slots.push(slot);
    this._scheduleComposerSelectedSlotId = slot.id;
    this._setScheduleComposerDraft(schedule);
  }

  _getScheduleComposerDayOrder() {
    return getSetpointScheduleDayOrder(this._config?.setpoint_schedule_week_starts_on);
  }

  _setScheduleComposerSelectedSlot(slotId) {
    this._scheduleComposerSelectedSlotId = String(slotId ?? "").trim();
    if (this._scheduleComposerOpen && this.shadowRoot?.querySelector("[data-schedule-day-track]")) {
      this._syncScheduleComposerSelectionDom();
      return;
    }

    this._lastRenderSignature = "";
    this._render();
  }

  _setScheduleBlockDragPendingListeners(active) {
    if (typeof window === "undefined") {
      return;
    }

    if (active) {
      if (this._scheduleBlockDragPendingListenersActive) {
        return;
      }
      window.addEventListener("pointermove", this._onWindowScheduleBlockDragMove);
      window.addEventListener("pointerup", this._onWindowScheduleBlockDragUp);
      window.addEventListener("pointercancel", this._onWindowScheduleBlockDragUp);
      this._scheduleBlockDragPendingListenersActive = true;
      return;
    }

    if (!this._scheduleBlockDragPendingListenersActive) {
      return;
    }
    window.removeEventListener("pointermove", this._onWindowScheduleBlockDragMove);
    window.removeEventListener("pointerup", this._onWindowScheduleBlockDragUp);
    window.removeEventListener("pointercancel", this._onWindowScheduleBlockDragUp);
    this._scheduleBlockDragPendingListenersActive = false;
  }

  _onWindowScheduleBlockDragMove(event) {
    const pending = this._scheduleBlockDragPending;
    if (!pending) {
      return;
    }
    if (pending.pointerId != null && event.pointerId != null && pending.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = Math.abs(event.clientX - pending.startClientX);
    const deltaY = Math.abs(event.clientY - pending.startClientY);
    if (Math.max(deltaX, deltaY) < SCHEDULE_BLOCK_DRAG_THRESHOLD_PX) {
      return;
    }

    this._scheduleBlockDragPending = null;
    this._setScheduleBlockDragPendingListeners(false);
    event.preventDefault();
    this._startScheduleDrag({
      slotId: pending.slotId,
      mode: "move",
      day: pending.day,
      track: pending.track,
      clientX: pending.startClientX,
      pointerId: pending.pointerId,
      event,
    });
    this._applyScheduleDragAtClientX(event.clientX);
  }

  _onWindowScheduleBlockDragUp(event) {
    const pending = this._scheduleBlockDragPending;
    if (!pending) {
      return;
    }
    if (pending.pointerId != null && event.pointerId != null && pending.pointerId !== event.pointerId) {
      return;
    }

    this._scheduleBlockDragPending = null;
    this._setScheduleBlockDragPendingListeners(false);
  }

  _setScheduleDragWindowListeners(active) {
    if (typeof window === "undefined") {
      return;
    }

    if (active) {
      if (this._scheduleDragListenersActive) {
        return;
      }
      window.addEventListener("pointermove", this._onWindowSchedulePointerMove);
      window.addEventListener("pointerup", this._onWindowSchedulePointerUp);
      window.addEventListener("pointercancel", this._onWindowSchedulePointerUp);
      this._scheduleDragListenersActive = true;
      return;
    }

    if (!this._scheduleDragListenersActive) {
      return;
    }
    window.removeEventListener("pointermove", this._onWindowSchedulePointerMove);
    window.removeEventListener("pointerup", this._onWindowSchedulePointerUp);
    window.removeEventListener("pointercancel", this._onWindowSchedulePointerUp);
    this._scheduleDragListenersActive = false;
  }

  _applyScheduleDragAtClientX(clientX) {
    const drag = this._activeScheduleDrag;
    if (!drag?.slotId) {
      return;
    }

    const track = this._getScheduleDayTrackElement(drag.day);
    if (!track) {
      return;
    }

    drag.track = track;

    const schedule = this._getScheduleComposerDraft();
    const slot = schedule.slots.find(item => item.id === drag.slotId);
    if (!slot) {
      return;
    }

    const pointerMinutes = scheduleMinutesFromTrackClientX(track, clientX);
    const initialStart = drag.initialStart;
    const initialEnd = drag.initialEnd;
    const duration = Math.max(initialEnd - initialStart, SCHEDULE_MIN_BLOCK_MINUTES);
    const dragPatch = {};

    if (drag.mode === "move") {
      let start = snapScheduleTimelineMinutes(pointerMinutes - drag.pointerOffsetMinutes);
      let end = start + duration;
      if (end > SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1) {
        end = SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1;
        start = Math.max(0, end - duration);
      }
      dragPatch.start = formatScheduleClockMinutes(start);
      dragPatch.end = formatScheduleClockMinutes(end);
    } else if (drag.mode === "resize-start") {
      let start = snapScheduleTimelineMinutes(pointerMinutes);
      const end = initialEnd;
      if (end - start < SCHEDULE_MIN_BLOCK_MINUTES) {
        start = Math.max(0, end - SCHEDULE_MIN_BLOCK_MINUTES);
      }
      dragPatch.start = formatScheduleClockMinutes(start);
      dragPatch.end = formatScheduleClockMinutes(end);
    } else if (drag.mode === "resize-end") {
      const start = initialStart;
      let end = snapScheduleTimelineMinutes(pointerMinutes);
      if (end - start < SCHEDULE_MIN_BLOCK_MINUTES) {
        end = Math.min(SETPOINT_SCHEDULE_MINUTES_PER_DAY - 1, start + SCHEDULE_MIN_BLOCK_MINUTES);
      }
      dragPatch.start = formatScheduleClockMinutes(start);
      dragPatch.end = formatScheduleClockMinutes(end);
    }

    if (!Object.keys(dragPatch).length) {
      return;
    }

    this._updateScheduleComposerSlot(drag.slotId, dragPatch, { render: false });
  }

  _startScheduleDrag(options = {}) {
    const {
      slotId,
      mode,
      day,
      track,
      clientX,
      pointerId = null,
      event = null,
    } = options;
    const schedule = this._getScheduleComposerDraft();
    const slot = schedule.slots.find(item => item.id === slotId);
    const resolvedTrack = track instanceof HTMLElement ? track : this._getScheduleDayTrackElement(day || slot?.day);
    if (!slot || !resolvedTrack) {
      return false;
    }

    const layout = getSetpointScheduleBlockLayout(slot);
    const pointerMinutes = scheduleMinutesFromTrackClientX(resolvedTrack, clientX);
    this._activeScheduleDrag = {
      slotId,
      mode,
      day: slot.day,
      track: resolvedTrack,
      pointerId,
      initialStart: layout.start,
      initialEnd: layout.end,
      pointerOffsetMinutes: mode === "move" ? pointerMinutes - layout.start : 0,
    };
    this._scheduleComposerSelectedSlotId = slotId;
    this._syncScheduleComposerSelectionDom();
    this._setScheduleDragWindowListeners(true);

    if (event && typeof resolvedTrack.setPointerCapture === "function" && event.pointerId != null) {
      try {
        resolvedTrack.setPointerCapture(event.pointerId);
      } catch (_error) {
        // Ignore capture failures on synthetic pointers.
      }
    }

    return true;
  }

  _finishScheduleDrag(event = null) {
    const drag = this._activeScheduleDrag;
    if (!drag) {
      return;
    }

    const track = drag.track instanceof HTMLElement ? drag.track : this._getScheduleDayTrackElement(drag.day);
    if (
      track instanceof HTMLElement &&
      event?.pointerId != null &&
      typeof track.releasePointerCapture === "function"
    ) {
      try {
        if (track.hasPointerCapture?.(event.pointerId)) {
          track.releasePointerCapture(event.pointerId);
        }
      } catch (_error) {
        // Ignore release failures.
      }
    }

    this._activeScheduleDrag = null;
    this._setScheduleDragWindowListeners(false);
    this._lastRenderSignature = "";
    this._render();
  }

  _onWindowSchedulePointerMove(event) {
    const drag = this._activeScheduleDrag;
    if (!drag) {
      return;
    }
    if (drag.pointerId != null && event.pointerId != null && drag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    this._applyScheduleDragAtClientX(event.clientX);
  }

  _onWindowSchedulePointerUp(event) {
    const drag = this._activeScheduleDrag;
    if (!drag) {
      return;
    }
    if (drag.pointerId != null && event.pointerId != null && drag.pointerId !== event.pointerId) {
      return;
    }
    this._applyScheduleDragAtClientX(event.clientX);
    this._finishScheduleDrag(event);
  }

  _handleScheduleComposerPointerDown(event, path) {
    if (!this._scheduleComposerOpen || event.button !== 0) {
      return false;
    }

    if (
      path.some(
        node =>
          node instanceof HTMLInputElement ||
          node instanceof HTMLTextAreaElement ||
          node instanceof HTMLSelectElement ||
          node instanceof HTMLButtonElement,
      )
    ) {
      return false;
    }

    const resizeHandle = path.find(
      node => node instanceof HTMLElement && node.dataset?.scheduleResize,
    );
    if (resizeHandle) {
      const slotId = String(resizeHandle.dataset.scheduleSlotId || "").trim();
      const mode = String(resizeHandle.dataset.scheduleResize || "").trim();
      const track = path.find(
        node => node instanceof HTMLElement && node.dataset?.scheduleDayTrack,
      );
      const day = String(track?.dataset?.scheduleDayTrack || "").trim();
      if (slotId && track && day && (mode === "start" || mode === "end")) {
        event.preventDefault();
        event.stopPropagation();
        this._scheduleBlockDragPending = null;
        this._setScheduleBlockDragPendingListeners(false);
        this._startScheduleDrag({
          slotId,
          mode: mode === "start" ? "resize-start" : "resize-end",
          day,
          track,
          clientX: event.clientX,
          pointerId: event.pointerId,
          event,
        });
        return true;
      }
    }

    const block = path.find(
      node => node instanceof HTMLElement && node.dataset?.scheduleBlockId,
    );
    if (block) {
      const slotId = String(block.dataset.scheduleBlockId || "").trim();
      const track = path.find(
        node => node instanceof HTMLElement && node.dataset?.scheduleDayTrack,
      );
      const day = String(track?.dataset?.scheduleDayTrack || "").trim();
      if (slotId && track && day) {
        event.preventDefault();
        event.stopPropagation();
        this._setScheduleComposerSelectedSlot(slotId);
        this._scheduleBlockDragPending = {
          slotId,
          day,
          track,
          startClientX: event.clientX,
          startClientY: event.clientY,
          pointerId: event.pointerId,
        };
        this._setScheduleBlockDragPendingListeners(true);
        return true;
      }
    }

    return false;
  }

  _removeScheduleComposerSlot(slotId) {
    const schedule = this._getScheduleComposerDraft();
    schedule.slots = schedule.slots.filter(slot => slot.id !== slotId);
    if (this._scheduleComposerSelectedSlotId === slotId) {
      this._scheduleComposerSelectedSlotId = "";
    }
    this._setScheduleComposerDraft(schedule);
  }

  _setScheduleComposerEnabled(enabled) {
    const schedule = this._getScheduleComposerDraft();
    schedule.enabled = enabled === true;
    this._setScheduleComposerDraft(schedule);
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 5,
      min_columns: 7,
    };
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
      || (configuredColumns !== null && configuredColumns <= 4)
    ) {
      return "tight";
    }

    if (
      (configuredRows !== null && configuredRows <= 4)
      || (configuredColumns !== null && configuredColumns <= 6)
    ) {
      return "compact";
    }

    return "default";
  }

  _getState() {
    return this._config?.entity ? this._hass?.states?.[this._config.entity] || null : null;
  }

  _syncDraftWithState() {
    const state = this._getState();
    const entityId = this._config?.entity;
    if (!entityId || !state) {
      return;
    }

    if (this._isDualSetpointRange(state)) {
      if (!this._draftTempRange.has(entityId)) {
        this._draftTemperature.delete(entityId);
        return;
      }
      const step = this._getTemperatureStep(state);
      const tol = Math.max(0.05, Math.min(step / 2, 0.25));
      const draft = this._draftTempRange.get(entityId);
      const al = parseFiniteClimateNumber(state.attributes?.target_temp_low);
      const ah = parseFiniteClimateNumber(state.attributes?.target_temp_high);
      if (
        Number.isFinite(al) && Number.isFinite(ah) &&
        Number.isFinite(draft?.low) && Number.isFinite(draft?.high) &&
        Math.abs(al - draft.low) <= tol &&
        Math.abs(ah - draft.high) <= tol
      ) {
        this._clearTemperatureDraft(entityId);
      }
      this._draftTemperature.delete(entityId);
      return;
    }

    this._draftTempRange.delete(entityId);

    if (!this._draftTemperature.has(entityId)) {
      return;
    }

    const actualTemperature = parseFiniteClimateNumber(state.attributes?.temperature);
    const draftTemperature = Number(this._draftTemperature.get(entityId));
    const tolerance = this._getTemperatureSyncTolerance(state);

    if (Number.isFinite(actualTemperature) && Math.abs(actualTemperature - draftTemperature) <= tolerance) {
      this._clearTemperatureDraft(entityId);
    }
  }

  _clearTemperatureDraft(entityId = this._config?.entity) {
    if (entityId) {
      this._draftTemperature.delete(entityId);
      this._draftTempRange.delete(entityId);
    }

    this._temperatureCommitQueuedValue = null;
    this._rangeCommitQueuedValue = null;
    this._temperatureCommitRetryCount = 0;
    this._rangeCommitRetryCount = 0;
    this._temperatureCommitRequiresHvacWake = false;

    if (this._draftResetTimer) {
      window.clearTimeout(this._draftResetTimer);
      this._draftResetTimer = 0;
    }

    if (this._temperatureCommitDebounceTimer) {
      window.clearTimeout(this._temperatureCommitDebounceTimer);
      this._temperatureCommitDebounceTimer = 0;
    }
    if (this._rangeCommitDebounceTimer) {
      window.clearTimeout(this._rangeCommitDebounceTimer);
      this._rangeCommitDebounceTimer = 0;
    }
  }

  _getClimateName(state) {
    return this._config?.name
      || state?.attributes?.friendly_name
      || this._config?.entity
      || "Climate";
  }

  _getClimateIcon(state) {
    return this._config?.icon
      || state?.attributes?.icon
      || "mdi:thermostat";
  }

  _getEntityPicture(state) {
    if (this._config?.show_entity_picture !== true) {
      return "";
    }
    return String(
      this._config?.entity_picture
      || state?.attributes?.entity_picture_local
      || state?.attributes?.entity_picture
      || "",
    ).trim();
  }

  _getTemperatureRange(state) {
    const min = parseFiniteClimateNumber(state?.attributes?.min_temp);
    const max = parseFiniteClimateNumber(state?.attributes?.max_temp);

    if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
      return {
        min,
        max,
      };
    }

    return {
      min: 10,
      max: 30,
    };
  }

  _getTemperatureStep(state) {
    const step = Number(state?.attributes?.target_temp_step);
    return Number.isFinite(step) && step > 0 ? step : 0.5;
  }

  /**
   * `heat_cool` with both range bounds and no single `temperature` (Ecobee-style): dual-handle dial.
   * If only one of low/high is finite, falls back to single-setpoint behaviour (`_isDualSetpointRange` false).
   * Inverted low/high from an integration is still detected here; `_normalizeLowHighPair` swaps before commit.
   */
  _isDualSetpointRange(state) {
    if (!state?.attributes) {
      return false;
    }
    const attrs = state.attributes;
    if (Number.isFinite(parseFiniteClimateNumber(attrs.temperature))) {
      return false;
    }
    if (normalizeTextKey(this._getCurrentMode(state)) !== "heat_cool") {
      return false;
    }
    const low = parseFiniteClimateNumber(attrs.target_temp_low);
    const high = parseFiniteClimateNumber(attrs.target_temp_high);
    return Number.isFinite(low) && Number.isFinite(high);
  }

  /** Minimum span between low and high (at least 1° in entity units, never below `target_temp_step`). */
  _getHeatCoolMinGap(state) {
    const step = this._getTemperatureStep(state);
    return Math.max(1, step);
  }

  _clampRangeLowCandidate(rawValue, high, state) {
    if (!state || !Number.isFinite(high)) {
      return null;
    }
    const range = this._getTemperatureRange(state);
    const gap = this._getHeatCoolMinGap(state);
    const maxLow = high - gap;
    if (!Number.isFinite(maxLow) || maxLow < range.min) {
      return null;
    }
    const n = this._normalizeTemperatureValue(rawValue, state);
    return clamp(n, range.min, maxLow);
  }

  _clampRangeHighCandidate(rawValue, low, state) {
    if (!state || !Number.isFinite(low)) {
      return null;
    }
    const range = this._getTemperatureRange(state);
    const gap = this._getHeatCoolMinGap(state);
    const minHigh = low + gap;
    if (!Number.isFinite(minHigh) || minHigh > range.max) {
      return null;
    }
    const n = this._normalizeTemperatureValue(rawValue, state);
    return clamp(n, minHigh, range.max);
  }

  _getEffectiveTargetLowHigh(state) {
    const entityId = this._config?.entity;
    if (entityId && this._draftTempRange.has(entityId)) {
      return { ...this._draftTempRange.get(entityId) };
    }
    const attrs = state?.attributes || {};
    return {
      low: parseFiniteClimateNumber(attrs.target_temp_low),
      high: parseFiniteClimateNumber(attrs.target_temp_high),
    };
  }

  _normalizeLowHighPair(low, high, state) {
    const lo = this._normalizeTemperatureValue(low, state);
    const hi = this._normalizeTemperatureValue(high, state);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      return null;
    }
    let a = lo;
    let b = hi;
    if (b < a) {
      [a, b] = [b, a];
    }
    const range = this._getTemperatureRange(state);
    const gap = this._getHeatCoolMinGap(state);
    if (b - a < gap) {
      b = Math.min(range.max, a + gap);
      b = this._normalizeTemperatureValue(b, state);
      if (b - a < gap) {
        a = Math.max(range.min, b - gap);
        a = this._normalizeTemperatureValue(a, state);
      }
    }
    return { low: a, high: b };
  }

  _getTemperatureSyncTolerance(state) {
    const step = this._getTemperatureStep(state);
    return Math.max(0.05, Math.min(step / 2, 0.2));
  }

  _normalizeTemperatureValue(value, state = this._getState()) {
    if (!state) {
      return Number(value);
    }

    const range = this._getTemperatureRange(state);
    const step = this._getTemperatureStep(state);
    const nextValue = clamp(Number(value), range.min, range.max);
    const rounded = range.min + (Math.round((nextValue - range.min) / step) * step);
    return Number(rounded.toFixed(Math.max(1, getStepPrecision(step))));
  }

  _supportsTargetTemperature(state) {
    const attrs = state?.attributes || {};
    if (Number.isFinite(parseFiniteClimateNumber(attrs.temperature))) {
      return true;
    }
    if (this._isDualSetpointRange(state)) {
      return true;
    }
    return (
      Number.isFinite(parseFiniteClimateNumber(attrs.min_temp)) &&
      Number.isFinite(parseFiniteClimateNumber(attrs.max_temp))
    );
  }

  _supportsTargetTemperatureControl(state) {
    const features = Number(state?.attributes?.supported_features);
    if (Number.isFinite(features)) {
      return Boolean((features & 1) || (features & 2));
    }
    return this._supportsTargetTemperature(state);
  }

  /**
   * Reported target temperature for single-setpoint modes, or mid-point while dragging dual range.
   * Returns `null` when the integration exposes no active setpoint (e.g. Ecobee `heat_cool` with
   * `temperature` / `target_temp_low` / `target_temp_high` all unset) — callers must not invent a fallback.
   */
  _getTargetTemperature(state) {
    const entityId = this._config?.entity;
    if (entityId && this._draftTemperature.has(entityId)) {
      return Number(this._draftTemperature.get(entityId));
    }

    if (entityId && this._isDualSetpointRange(state) && this._draftTempRange.has(entityId)) {
      const pair = this._draftTempRange.get(entityId);
      if (Number.isFinite(pair?.low) && Number.isFinite(pair?.high)) {
        return Number((((pair.high + pair.low) / 2)).toFixed(2));
      }
    }

    const attrs = state?.attributes || {};
    const direct = parseFiniteClimateNumber(attrs.temperature);
    if (Number.isFinite(direct)) {
      return direct;
    }

    const high = parseFiniteClimateNumber(attrs.target_temp_high);
    const low = parseFiniteClimateNumber(attrs.target_temp_low);
    if (Number.isFinite(high) && Number.isFinite(low)) {
      return Number(((high + low) / 2).toFixed(1));
    }

    return null;
  }

  _getCurrentTemperature(state) {
    const current = parseFiniteClimateNumber(state?.attributes?.current_temperature);
    return Number.isFinite(current) ? current : null;
  }

  _getCurrentHumidity(state) {
    const humidity = Number(state?.attributes?.current_humidity);
    return Number.isFinite(humidity) ? humidity : null;
  }

  _getCurrentMode(state) {
    return String(state?.attributes?.hvac_mode || state?.state || "").trim();
  }

  _getCurrentAction(state) {
    return String(state?.attributes?.hvac_action || "").trim();
  }

  _getOrderedModeOptions(state) {
    const rawModes = Array.isArray(state?.attributes?.hvac_modes)
      ? state.attributes.hvac_modes.map(item => String(item || "").trim()).filter(Boolean)
      : [];
    const uniqueModes = [...new Set(rawModes)];
    const preferredOrder = ["heat", "cool", "heat_cool", "auto", "dry", "fan_only"];
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";

    return uniqueModes
      .filter(mode => normalizeTextKey(mode) !== "off")
      .sort((left, right) => {
        const leftIndex = preferredOrder.indexOf(normalizeTextKey(left));
        const rightIndex = preferredOrder.indexOf(normalizeTextKey(right));
        const safeLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
        const safeRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
        return safeLeft - safeRight || left.localeCompare(right, sortLoc);
      });
  }

  _getPreferredOnMode(state) {
    const allModes = Array.isArray(state?.attributes?.hvac_modes)
      ? state.attributes.hvac_modes.map(item => String(item || "").trim()).filter(Boolean)
      : [];
    const modeSet = new Set(allModes.map(mode => normalizeTextKey(mode)));

    if (modeSet.has("heat_cool")) {
      return "heat_cool";
    }
    if (modeSet.has("heat")) {
      return "heat";
    }
    if (modeSet.has("cool")) {
      return "cool";
    }
    if (modeSet.has("auto")) {
      return "auto";
    }
    if (modeSet.has("dry")) {
      return "dry";
    }
    if (modeSet.has("fan_only")) {
      return "fan_only";
    }

    return allModes.find(mode => normalizeTextKey(mode) !== "off") || "heat";
  }

  _isOff(state) {
    return normalizeTextKey(this._getCurrentMode(state)) === "off";
  }

  /**
   * Some integrations leave `attributes.hvac_mode` non-off while `state` is already `off`.
   * Off-null setpoint wake and similar paths must still treat the entity as shut off.
   */
  _isEffectiveClimateOff(state) {
    if (!state) {
      return false;
    }
    if (normalizeTextKey(String(state.state ?? "").trim()) === "off") {
      return true;
    }
    return this._isOff(state);
  }

  /**
   * Ecobee-style: indoor temp known, but no published single or dual setpoints yet.
   * Used by step buttons without treating `current_temperature` as a visible target.
   */
  _isNullSetpointFromCurrentState(state) {
    if (!state?.attributes || isUnavailableState(state)) {
      return false;
    }
    const attrs = state.attributes;
    if (Number.isFinite(parseFiniteClimateNumber(attrs.temperature))) {
      return false;
    }
    const low = parseFiniteClimateNumber(attrs.target_temp_low);
    const high = parseFiniteClimateNumber(attrs.target_temp_high);
    if (Number.isFinite(low) || Number.isFinite(high)) {
      return false;
    }
    return Number.isFinite(parseFiniteClimateNumber(attrs.current_temperature));
  }

  _isOffNullSetpointState(state) {
    return this._isEffectiveClimateOff(state) && this._isNullSetpointFromCurrentState(state);
  }

  /**
   * HVAC mode to enable before `set_temperature` when creating a setpoint from current temperature.
   * Order: heat → cool → heat_cool (Better Thermostat / Ecobee-friendly; differs from `_getPreferredOnMode` toggle order).
   */
  _getSetpointWakeHvacMode(state) {
    const modeSet = new Set(
      (Array.isArray(state?.attributes?.hvac_modes) ? state.attributes.hvac_modes : [])
        .map(item => normalizeTextKey(String(item || "").trim()))
        .filter(Boolean),
    );
    for (const candidate of ["heat", "cool", "heat_cool"]) {
      if (modeSet.has(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  _supportsNullSetpointCreation(state) {
    if (!this._isNullSetpointFromCurrentState(state)) {
      return false;
    }
    if (!this._supportsTargetTemperatureControl(state)) {
      return false;
    }
    const { min, max } = this._getTemperatureRange(state);
    return Number.isFinite(min) && Number.isFinite(max) && min < max;
  }

  _supportsOffNullSetpointWake(state) {
    return this._isOffNullSetpointState(state) && this._supportsNullSetpointCreation(state);
  }

  _getStateLabel(state) {
    const action = this._getCurrentAction(state);
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const langCfg = this._config?.language ?? "auto";
    if (window.NodaliaI18n?.translateClimateHvacLabel) {
      const raw = action || this._getCurrentMode(state);
      return window.NodaliaI18n.translateClimateHvacLabel(hass, langCfg, raw, Boolean(action));
    }
    if (action) {
      return getActionMeta(action).label;
    }
    return getModeMeta(this._getCurrentMode(state)).label;
  }

  _getAccentColor(state) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const dialStyles = styles.dial || DEFAULT_CONFIG.styles.dial;
    const { accent } = climateDialActionMeta(this._getCurrentAction(state), this._getCurrentMode(state));

    switch (accent) {
      case "heat":
        return dialStyles.heat_color;
      case "cool":
        return dialStyles.cool_color;
      case "dry":
        return dialStyles.dry_color;
      case "fan":
        return dialStyles.fan_color;
      case "auto":
        return dialStyles.auto_color;
      default:
        return dialStyles.off_color;
    }
  }

  _setClimateService(service, data = {}) {
    if (!this._hass || !this._config?.entity) {
      return Promise.resolve();
    }

    return this._hass.callService("climate", service, {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _setHvacMode(mode) {
    if (!mode) {
      return;
    }

    this._setClimateService("set_hvac_mode", {
      hvac_mode: mode,
    });
  }

  _toggleClimate(state) {
    if (this._isOff(state) || isUnavailableState(state)) {
      this._setHvacMode(this._getPreferredOnMode(state));
      return;
    }

    this._setHvacMode("off");
  }

  _queueTemperatureCommit(value, options = {}) {
    const state = this._getState();
    if (!state || this._isDualSetpointRange(state)) {
      return null;
    }

    const offNullWake =
      options.hvacWake === true &&
      this._isOffNullSetpointState(state) &&
      this._supportsOffNullSetpointWake(state);

    if (!this._supportsTargetTemperature(state) && !offNullWake) {
      return null;
    }

    this._temperatureCommitRequiresHvacWake = Boolean(offNullWake);

    const normalized = this._normalizeTemperatureValue(value, state);
    const entityId = this._config?.entity;

    if (!entityId || !Number.isFinite(normalized)) {
      return null;
    }

    if (this._rangeCommitDebounceTimer) {
      window.clearTimeout(this._rangeCommitDebounceTimer);
      this._rangeCommitDebounceTimer = 0;
    }

    this._draftTemperature.set(entityId, normalized);
    this._temperatureCommitQueuedValue = normalized;
    this._temperatureCommitRetryCount = 0;

    if (options.render !== false) {
      this._render();
    }

    if (options.immediate === true) {
      this._flushQueuedTemperatureCommit();
      return normalized;
    }

    if (this._temperatureCommitDebounceTimer) {
      window.clearTimeout(this._temperatureCommitDebounceTimer);
    }

    this._temperatureCommitDebounceTimer = window.setTimeout(() => {
      this._temperatureCommitDebounceTimer = 0;
      this._flushQueuedTemperatureCommit();
    }, STEP_BUTTON_COMMIT_DEBOUNCE);

    this._scheduleDraftReset();
    return normalized;
  }

  async _flushQueuedTemperatureCommit() {
    const entityId = this._config?.entity;
    if (!entityId) {
      return;
    }

    const state = this._getState();
    if (!state || this._isDualSetpointRange(state)) {
      return;
    }

    if (this._temperatureCommitDebounceTimer) {
      window.clearTimeout(this._temperatureCommitDebounceTimer);
      this._temperatureCommitDebounceTimer = 0;
    }

    if (this._temperatureCommitInFlight) {
      return;
    }

    const target = Number(
      this._temperatureCommitQueuedValue ?? this._draftTemperature.get(entityId),
    );
    if (!Number.isFinite(target)) {
      return;
    }

    this._temperatureCommitQueuedValue = null;
    this._temperatureCommitInFlight = true;
    let serviceFailed = false;

    const hvacWake = this._temperatureCommitRequiresHvacWake;
    this._temperatureCommitRequiresHvacWake = false;
    let wakeMode = null;

    try {
      if (hvacWake) {
        wakeMode = this._getSetpointWakeHvacMode(state);
        if (wakeMode) {
          await Promise.resolve(this._setClimateService("set_hvac_mode", {
            hvac_mode: wakeMode,
          }));
        } else if (typeof console !== "undefined" && typeof console.debug === "function") {
          console.debug("Nodalia Climate Card: committing setpoint without HVAC wake mode.");
        }
      }
      if (!serviceFailed) {
        await Promise.resolve(this._setClimateService("set_temperature", {
          temperature: target,
          ...(wakeMode ? { hvac_mode: wakeMode } : {}),
        }));
      }
    } catch (_error) {
      serviceFailed = true;
      this._temperatureCommitQueuedValue = target;
    } finally {
      this._temperatureCommitInFlight = false;

      if (serviceFailed) {
        this._temperatureCommitRequiresHvacWake = Boolean(hvacWake);
        this._scheduleDraftReset();
        return;
      }

      const queuedRaw = this._temperatureCommitQueuedValue;
      const queuedValue = queuedRaw === null || queuedRaw === undefined ? NaN : Number(queuedRaw);
      if (Number.isFinite(queuedValue) && Math.abs(queuedValue - target) > 0.001) {
        this._flushQueuedTemperatureCommit();
        return;
      }

      if (Number.isFinite(queuedValue) && Math.abs(queuedValue - target) <= 0.001) {
        this._temperatureCommitQueuedValue = null;
      }

      if (this._draftTemperature.has(entityId)) {
        this._scheduleDraftReset();
      }
    }
  }

  _queueRangeCommit(pair, options = {}) {
    const state = this._getState();
    if (!state || !this._isDualSetpointRange(state)) {
      return null;
    }

    const normalized = this._normalizeLowHighPair(pair.low, pair.high, state);
    if (!normalized) {
      return null;
    }

    const entityId = this._config?.entity;
    if (!entityId) {
      return null;
    }

    if (this._temperatureCommitDebounceTimer) {
      window.clearTimeout(this._temperatureCommitDebounceTimer);
      this._temperatureCommitDebounceTimer = 0;
    }

    this._draftTempRange.set(entityId, normalized);
    this._rangeCommitQueuedValue = normalized;
    this._rangeCommitRetryCount = 0;

    if (options.render !== false) {
      this._render();
    }

    if (options.immediate === true) {
      this._flushQueuedRangeCommit();
      return normalized;
    }

    if (this._rangeCommitDebounceTimer) {
      window.clearTimeout(this._rangeCommitDebounceTimer);
    }

    this._rangeCommitDebounceTimer = window.setTimeout(() => {
      this._rangeCommitDebounceTimer = 0;
      this._flushQueuedRangeCommit();
    }, STEP_BUTTON_COMMIT_DEBOUNCE);

    this._scheduleDraftReset();
    return normalized;
  }

  async _flushQueuedRangeCommit() {
    const entityId = this._config?.entity;
    if (!entityId) {
      return;
    }

    const state = this._getState();
    if (!state || !this._isDualSetpointRange(state)) {
      return;
    }

    if (this._rangeCommitDebounceTimer) {
      window.clearTimeout(this._rangeCommitDebounceTimer);
      this._rangeCommitDebounceTimer = 0;
    }

    if (this._rangeCommitInFlight) {
      return;
    }

    const pending = this._rangeCommitQueuedValue ?? this._draftTempRange.get(entityId);
    if (!pending || !Number.isFinite(pending.low) || !Number.isFinite(pending.high)) {
      return;
    }

    this._rangeCommitQueuedValue = null;
    this._rangeCommitInFlight = true;
    let serviceFailed = false;

    try {
      await Promise.resolve(this._setClimateService("set_temperature", {
        target_temp_low: pending.low,
        target_temp_high: pending.high,
      }));
    } catch (_error) {
      serviceFailed = true;
      this._rangeCommitQueuedValue = pending;
    } finally {
      this._rangeCommitInFlight = false;

      if (serviceFailed) {
        this._scheduleDraftReset();
        return;
      }

      const queued = this._rangeCommitQueuedValue;
      if (
        queued &&
        Number.isFinite(queued.low) &&
        Number.isFinite(queued.high) &&
        (Math.abs(queued.low - pending.low) > 0.001 || Math.abs(queued.high - pending.high) > 0.001)
      ) {
        this._flushQueuedRangeCommit();
        return;
      }

      if (
        queued &&
        Number.isFinite(queued.low) &&
        Number.isFinite(queued.high) &&
        Math.abs(queued.low - pending.low) <= 0.001 &&
        Math.abs(queued.high - pending.high) <= 0.001
      ) {
        this._rangeCommitQueuedValue = null;
      }

      if (this._draftTempRange.has(entityId)) {
        this._scheduleDraftReset();
      }
    }
  }

  _commitTemperature(value, options = {}) {
    const normalized = this._queueTemperatureCommit(value, {
      immediate: options.immediate !== false,
      render: options.render,
    });

    if (!Number.isFinite(normalized)) {
      return null;
    }

    this._scheduleDraftReset();
    return normalized;
  }

  async _createSetpointFromCurrentBy(delta) {
    const state = this._getState();
    if (!state || !this._supportsNullSetpointCreation(state)) {
      return false;
    }

    const baseline = this._getCurrentTemperature(state);
    if (!Number.isFinite(baseline)) {
      return false;
    }

    const step = this._getTemperatureStep(state);
    const next = this._normalizeTemperatureValue(Number(baseline) + (Number(delta) * step), state);
    if (!Number.isFinite(next)) {
      return false;
    }

    this._triggerHaptic("selection");

    const wakeMode = this._getSetpointWakeHvacMode(state);
    try {
      if (wakeMode) {
        await Promise.resolve(this._setClimateService("set_hvac_mode", {
          hvac_mode: wakeMode,
        }));
      } else if (typeof console !== "undefined" && typeof console.debug === "function") {
        console.debug("Nodalia Climate Card: creating setpoint without HVAC wake mode.");
      }

      await Promise.resolve(this._setClimateService("set_temperature", {
        temperature: next,
        ...(wakeMode ? { hvac_mode: wakeMode } : {}),
      }));
    } catch (error) {
      if (typeof console !== "undefined" && typeof console.debug === "function") {
        console.debug("Nodalia Climate Card: failed to create setpoint from current temperature.", error);
      }
    }

    return true;
  }

  _scheduleDraftReset() {
    if (this._draftResetTimer) {
      window.clearTimeout(this._draftResetTimer);
    }

    this._draftResetTimer = window.setTimeout(() => {
      this._draftResetTimer = 0;

      const entityId = this._config?.entity;
      const state = this._getState();
      if (!entityId || !state) {
        return;
      }

      if (this._isDualSetpointRange(state)) {
        if (!this._draftTempRange.has(entityId)) {
          return;
        }
        if (this._rangeCommitDebounceTimer || this._rangeCommitInFlight) {
          this._scheduleDraftReset();
          return;
        }
        const step = this._getTemperatureStep(state);
        const tol = Math.max(0.05, Math.min(step / 2, 0.25));
        const draft = this._draftTempRange.get(entityId);
        const al = parseFiniteClimateNumber(state.attributes?.target_temp_low);
        const ah = parseFiniteClimateNumber(state.attributes?.target_temp_high);
        if (
          Number.isFinite(al) && Number.isFinite(ah) &&
          Number.isFinite(draft?.low) && Number.isFinite(draft?.high) &&
          Math.abs(al - draft.low) <= tol &&
          Math.abs(ah - draft.high) <= tol
        ) {
          this._clearTemperatureDraft(entityId);
          this._render();
          return;
        }

        if (this._rangeCommitRetryCount < DRAFT_CONFIRMATION_RETRY_LIMIT && draft) {
          this._rangeCommitRetryCount += 1;
          this._rangeCommitQueuedValue = draft;
          this._flushQueuedRangeCommit();
          return;
        }

        this._clearTemperatureDraft(entityId);
        this._render();
        return;
      }

      if (!this._draftTemperature.has(entityId)) {
        return;
      }

      if (this._temperatureCommitDebounceTimer || this._temperatureCommitInFlight) {
        this._scheduleDraftReset();
        return;
      }

      const actualTemperature = parseFiniteClimateNumber(state.attributes?.temperature);
      const draftTemperature = Number(this._draftTemperature.get(entityId));
      const tolerance = this._getTemperatureSyncTolerance(state);

      if (Number.isFinite(actualTemperature) && Math.abs(actualTemperature - draftTemperature) <= tolerance) {
        this._clearTemperatureDraft(entityId);
        this._render();
        return;
      }

      if (this._temperatureCommitRetryCount < DRAFT_CONFIRMATION_RETRY_LIMIT && Number.isFinite(draftTemperature)) {
        this._temperatureCommitRetryCount += 1;
        this._temperatureCommitQueuedValue = draftTemperature;
        this._flushQueuedTemperatureCommit();
        return;
      }

      this._clearTemperatureDraft(entityId);
      this._render();
    }, DRAFT_CONFIRMATION_TIMEOUT);
  }

  _changeTemperatureBy(delta) {
    const state = this._getState();
    if (!state) {
      return;
    }

    if (this._supportsNullSetpointCreation(state)) {
      this._createSetpointFromCurrentBy(delta);
      return;
    }

    const step = this._getTemperatureStep(state);

    if (this._isDualSetpointRange(state)) {
      if (!this._supportsTargetTemperature(state)) {
        return;
      }
      const { low, high } = this._getEffectiveTargetLowHigh(state);
      if (!Number.isFinite(low) || !Number.isFinite(high)) {
        return;
      }
      const range = this._getTemperatureRange(state);
      const deltaTemp = Number(delta) * step;
      const sel = this._selectedRangeThumb;

      let pair = null;
      if (sel === "low") {
        const newLowRaw = low + deltaTemp;
        const newLow = this._clampRangeLowCandidate(newLowRaw, high, state);
        if (newLow === null) {
          return;
        }
        pair = this._normalizeLowHighPair(newLow, high, state);
      } else if (sel === "high") {
        const newHighRaw = high + deltaTemp;
        const newHigh = this._clampRangeHighCandidate(newHighRaw, low, state);
        if (newHigh === null) {
          return;
        }
        pair = this._normalizeLowHighPair(low, newHigh, state);
      } else {
        let newLow = low + deltaTemp;
        let newHigh = high + deltaTemp;
        if (newLow < range.min) {
          const d = range.min - newLow;
          newLow = range.min;
          newHigh = newHigh + d;
        } else if (newHigh > range.max) {
          const d = newHigh - range.max;
          newHigh = range.max;
          newLow = newLow - d;
        }
        pair = this._normalizeLowHighPair(newLow, newHigh, state);
      }

      if (!pair) {
        return;
      }
      this._triggerHaptic("selection");
      this._queueRangeCommit(pair, {
        immediate: false,
        render: true,
      });
      return;
    }

    if (!this._supportsTargetTemperature(state)) {
      return;
    }

    const current = parseFiniteClimateNumber(this._getTargetTemperature(state));
    if (!Number.isFinite(current)) {
      return;
    }
    const next = this._normalizeTemperatureValue(current + (Number(delta) * step), state);
    this._triggerHaptic("selection");
    this._queueTemperatureCommit(next, {
      immediate: false,
      render: true,
    });
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

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;

    return {
      enabled: configuredAnimations.enabled !== false,
      dialDuration: clamp(
        Number(configuredAnimations.dial_duration) || DEFAULT_CONFIG.animations.dial_duration,
        80,
        2000,
      ),
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

  _isLightThemeSurface() {
    const textColor = parseRgbColor(resolveColorInContext(this, "var(--primary-text-color)"));
    const backgroundColor = parseRgbColor(resolveColorInContext(this, "var(--ha-card-background, var(--card-background-color, #ffffff))"));

    const textLuminance = getRelativeLuminance(textColor);
    if (textLuminance !== null) {
      return textLuminance < 0.36;
    }

    const backgroundLuminance = getRelativeLuminance(backgroundColor);
    if (backgroundLuminance !== null) {
      return backgroundLuminance > 0.62;
    }

    return false;
  }

  _triggerButtonBounce(button) {
    if (!(button instanceof HTMLElement)) {
      return;
    }

    const animations = this._getAnimationSettings();
    if (!animations.enabled) {
      return;
    }

    button.classList.remove("is-pressing");
    button.getBoundingClientRect();
    button.classList.add("is-pressing");

    window.setTimeout(() => {
      button.classList.remove("is-pressing");
    }, animations.buttonBounceDuration + 40);
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
      if (!this.isConnected) {
        return;
      }
      this._animateContentOnNextRender = false;
    }, safeDelay);
  }

  _setDialDraggingState(isDragging, dial = this._activeDialDrag?.dial || null) {
    if (!(dial instanceof HTMLElement)) {
      return;
    }

    dial.classList.toggle("is-dragging", Boolean(isDragging));
  }

  _setDragWindowListeners(enabled) {
    if (typeof window === "undefined") {
      return;
    }
    const shouldAttach = Boolean(enabled);
    if (shouldAttach === this._dragWindowListenersAttached) {
      return;
    }
    this._dragWindowListenersAttached = shouldAttach;
    if (shouldAttach) {
      window.addEventListener("pointermove", this._onWindowPointerMove);
      window.addEventListener("pointerup", this._onWindowPointerUp);
      window.addEventListener("pointercancel", this._onWindowPointerUp);
      window.addEventListener("mousemove", this._onWindowMouseMove);
      window.addEventListener("mouseup", this._onWindowMouseUp);
      if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
        window.addEventListener("touchstart", this._onWindowTouchStartCapture, { passive: true, capture: true });
        window.addEventListener("touchmove", this._onWindowTouchMove, { passive: false });
        window.addEventListener("touchend", this._onWindowTouchEnd, { passive: false });
        window.addEventListener("touchcancel", this._onWindowTouchEnd, { passive: false });
      }
      return;
    }
    window.removeEventListener("pointermove", this._onWindowPointerMove);
    window.removeEventListener("pointerup", this._onWindowPointerUp);
    window.removeEventListener("pointercancel", this._onWindowPointerUp);
    window.removeEventListener("mousemove", this._onWindowMouseMove);
    window.removeEventListener("mouseup", this._onWindowMouseUp);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      window.removeEventListener("touchstart", this._onWindowTouchStartCapture, true);
      window.removeEventListener("touchmove", this._onWindowTouchMove);
      window.removeEventListener("touchend", this._onWindowTouchEnd);
      window.removeEventListener("touchcancel", this._onWindowTouchEnd);
    }
  }

  _updateDialRangePreview(low, high) {
    const dial = this.shadowRoot?.querySelector(".climate-card__dial");
    const state = this._getState();
    if (!(dial instanceof HTMLElement) || !state || !this._isDualSetpointRange(state)) {
      return;
    }
    if (!Number.isFinite(low) || !Number.isFinite(high)) {
      return;
    }
    const temperatureRange = this._getTemperatureRange(state);
    const temperatureStep = this._getTemperatureStep(state);
    const tempSpan = Math.max(temperatureRange.max - temperatureRange.min, temperatureStep);
    const ratioL = clamp((low - temperatureRange.min) / tempSpan, 0, 1);
    const ratioH = clamp((high - temperatureRange.min) / tempSpan, 0, 1);
    const heatLen = Number((ratioL * DIAL_VISIBLE_LENGTH).toFixed(3));
    const coolLen = Number(((1 - ratioH) * DIAL_VISIBLE_LENGTH).toFixed(3));
    const coolOff = Number((-ratioH * DIAL_VISIBLE_LENGTH).toFixed(3));
    const posH = getDialMarkerPosition(DIAL_START_ANGLE + (ratioH * DIAL_SWEEP));
    const posL = getDialMarkerPosition(DIAL_START_ANGLE + (ratioL * DIAL_SWEEP));
    dial.style.setProperty("--climate-heat-progress", String(heatLen));
    dial.style.setProperty("--climate-cool-progress", String(coolLen));
    dial.style.setProperty("--climate-cool-dashoffset", `${coolOff}px`);
    dial.style.setProperty("--climate-thumb-heat-left", `${posL.left}%`);
    dial.style.setProperty("--climate-thumb-heat-top", `${posL.top}%`);
    dial.style.setProperty("--climate-thumb-cool-left", `${posH.left}%`);
    dial.style.setProperty("--climate-thumb-cool-top", `${posH.top}%`);
  }

  _updateDialPreview(value) {
    const state = this._getState();
    if (!state || !this._supportsTargetTemperature(state) || this._isDualSetpointRange(state)) {
      return;
    }
    const dial = this.shadowRoot?.querySelector(".climate-card__dial");
    const targetValue = this.shadowRoot?.querySelector('[data-climate-readout="target"]');

    if (!state || !(dial instanceof HTMLElement)) {
      return;
    }

    const range = this._getTemperatureRange(state);
    const step = this._getTemperatureStep(state);
    const nextValue = clamp(Number(value), range.min, range.max);
    const ratio = (nextValue - range.min) / Math.max(range.max - range.min, step);
    const angle = DIAL_START_ANGLE + (ratio * DIAL_SWEEP);
    const progressLength = Number((DIAL_VISIBLE_LENGTH * clamp(ratio, 0, 1)).toFixed(3));
    const thumbPosition = getDialMarkerPosition(angle);

    dial.style.setProperty("--climate-angle", `${angle}deg`);
    dial.style.setProperty("--climate-progress-length", `${progressLength}`);
    dial.style.setProperty("--climate-thumb-left", `${thumbPosition.left}%`);
    dial.style.setProperty("--climate-thumb-top", `${thumbPosition.top}%`);
    dial.setAttribute("aria-valuenow", String(Number(nextValue)));

    if (targetValue instanceof HTMLElement) {
      targetValue.textContent = formatTemperature(nextValue, step, false, this._hass);
    }
  }

  _applyDialValue(value, options = {}) {
    const state = this._getState();
    if (!state || !this._supportsTargetTemperature(state) || this._isDualSetpointRange(state)) {
      return;
    }

    const range = this._getTemperatureRange(state);
    const step = this._getTemperatureStep(state);
    const nextValue = clamp(Number(value), range.min, range.max);
    const rounded = range.min + (Math.round((nextValue - range.min) / step) * step);
    this._draftTemperature.set(this._config.entity, Number(rounded.toFixed(Math.max(1, getStepPrecision(step)))));
    this._updateDialPreview(rounded);

    if (options.commit === true) {
      this._triggerHaptic("selection");
      this._commitTemperature(rounded);
    }
  }

  _startDialDrag(dial, clientX, clientY, event = null, pointerId = null) {
    if (!(dial instanceof HTMLElement)) {
      return;
    }

    this._activeDialDrag = {
      kind: "single",
      dial,
      geometry: dial.getBoundingClientRect(),
      pointerId,
      lastValue: null,
    };
    this._setDragWindowListeners(true);
    this._setDialDraggingState(true, dial);

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const state = this._getState();
    if (!state) {
      this._setDialDraggingState(false, dial);
      this._activeDialDrag = null;
      this._setDragWindowListeners(false);
      return;
    }

    if (!this._supportsTargetTemperature(state) || this._isDualSetpointRange(state)) {
      this._setDialDraggingState(false, dial);
      this._activeDialDrag = null;
      this._setDragWindowListeners(false);
      return;
    }

    const nextValue = getDialValueFromPoint(
      dial,
      clientX,
      clientY,
      this._getTemperatureRange(state),
      this._getTemperatureStep(state),
      null,
      this._activeDialDrag.geometry,
    );
    this._activeDialDrag.lastValue = nextValue;
    this._applyDialValue(nextValue, { commit: false });
  }

  _moveDialDrag(clientX, clientY, event = null) {
    const drag = this._activeDialDrag;
    const state = this._getState();

    if (!drag || !state) {
      return;
    }

    if (drag.kind === "range") {
      this._moveRangeDialDrag(clientX, clientY, event);
      return;
    }

    if (event) {
      event.preventDefault();
    }

    const nextValue = getDialValueFromPoint(
      drag.dial,
      clientX,
      clientY,
      this._getTemperatureRange(state),
      this._getTemperatureStep(state),
      drag.lastValue,
      drag.geometry,
    );
    drag.lastValue = nextValue;
    this._applyDialValue(nextValue, { commit: false });
  }

  _queueDialDragMove(clientX, clientY, event = null) {
    this._pendingDialDragPoint = { clientX, clientY, event };
    if (this._dialDragFrame) {
      return;
    }
    this._dialDragFrame = window.requestAnimationFrame(() => {
      this._dialDragFrame = 0;
      const pending = this._pendingDialDragPoint;
      this._pendingDialDragPoint = null;
      if (!pending) {
        return;
      }
      this._moveDialDrag(pending.clientX, pending.clientY, pending.event);
    });
  }

  _commitDialDrag(clientX, clientY, event = null, pointerId = null) {
    const drag = this._activeDialDrag;
    const state = this._getState();

    if (!drag || !state) {
      return;
    }

    if (drag.kind === "range") {
      this._commitRangeDialDrag(clientX, clientY, event, pointerId);
      return;
    }

    if (event) {
      event.preventDefault();
    }
    if (this._dialDragFrame) {
      window.cancelAnimationFrame(this._dialDragFrame);
      this._dialDragFrame = 0;
    }
    this._pendingDialDragPoint = null;

    const nextValue = getDialValueFromPoint(
      drag.dial,
      clientX,
      clientY,
      this._getTemperatureRange(state),
      this._getTemperatureStep(state),
      drag.lastValue,
      drag.geometry,
    );
    drag.lastValue = nextValue;
    this._applyDialValue(nextValue, { commit: true });

    this._setDialDraggingState(false, drag.dial);
    this._activeDialDrag = null;
    this._setDragWindowListeners(false);

    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _startRangeDialDrag(dial, handle, clientX, clientY, event = null, pointerId = null) {
    if (!(dial instanceof HTMLElement) || (handle !== "low" && handle !== "high")) {
      return;
    }
    const state = this._getState();
    if (!state || !this._isDualSetpointRange(state)) {
      return;
    }

    this._activeDialDrag = {
      kind: "range",
      handle,
      dial,
      geometry: dial.getBoundingClientRect(),
      pointerId,
      lastLow: NaN,
      lastHigh: NaN,
      startClientX: clientX,
      startClientY: clientY,
      rangeThumbDragStarted: false,
    };
    this._setDragWindowListeners(true);
    this._setDialDraggingState(true, dial);

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const pair = this._getEffectiveTargetLowHigh(state);
    if (!Number.isFinite(pair.low) || !Number.isFinite(pair.high)) {
      this._setDialDraggingState(false, dial);
      this._activeDialDrag = null;
      this._setDragWindowListeners(false);
      return;
    }

    this._activeDialDrag.lastLow = pair.low;
    this._activeDialDrag.lastHigh = pair.high;

    const entityId = this._config.entity;
    if (entityId) {
      this._draftTempRange.set(entityId, { low: pair.low, high: pair.high });
    }
    this._updateDialRangePreview(pair.low, pair.high);

    if (event?.target?.setPointerCapture && pointerId != null && event.target instanceof Element) {
      try {
        event.target.setPointerCapture(pointerId);
      } catch (_e) {
        /* ignore */
      }
    }
  }

  _moveRangeDialDrag(clientX, clientY, event = null) {
    const drag = this._activeDialDrag;
    const state = this._getState();
    if (!drag || drag.kind !== "range" || !state) {
      return;
    }
    if (event) {
      event.preventDefault();
    }

    const dx = clientX - drag.startClientX;
    const dy = clientY - drag.startClientY;
    if (!drag.rangeThumbDragStarted) {
      if (Math.hypot(dx, dy) < RANGE_THUMB_DRAG_THRESHOLD_PX) {
        return;
      }
      drag.rangeThumbDragStarted = true;
      this._selectedRangeThumb = drag.handle;
    }

    const range = this._getTemperatureRange(state);
    const step = this._getTemperatureStep(state);
    const fallback = drag.handle === "low" ? drag.lastLow : drag.lastHigh;
    const raw = getDialValueFromPoint(drag.dial, clientX, clientY, range, step, fallback, drag.geometry);
    let low = drag.lastLow;
    let high = drag.lastHigh;
    if (drag.handle === "low") {
      const v = this._clampRangeLowCandidate(raw, high, state);
      if (v !== null) {
        low = v;
      }
    } else {
      const v = this._clampRangeHighCandidate(raw, low, state);
      if (v !== null) {
        high = v;
      }
    }
    drag.lastLow = low;
    drag.lastHigh = high;

    const entityId = this._config.entity;
    if (entityId) {
      this._draftTempRange.set(entityId, { low, high });
    }
    this._updateDialRangePreview(low, high);
  }

  _commitRangeDialDrag(clientX, clientY, event = null, _pointerId = null) {
    const drag = this._activeDialDrag;
    const state = this._getState();
    if (!drag || drag.kind !== "range" || !state) {
      return;
    }
    if (event) {
      event.preventDefault();
    }
    if (this._dialDragFrame) {
      window.cancelAnimationFrame(this._dialDragFrame);
      this._dialDragFrame = 0;
    }
    this._pendingDialDragPoint = null;

    if (!drag.rangeThumbDragStarted) {
      const h = drag.handle;
      this._selectedRangeThumb = this._selectedRangeThumb === h ? null : h;
      this._setDialDraggingState(false, drag.dial);
      this._activeDialDrag = null;
      this._setDragWindowListeners(false);
      const entityId = this._config.entity;
      const pairEff = this._getEffectiveTargetLowHigh(state);
      if (entityId && Number.isFinite(pairEff.low) && Number.isFinite(pairEff.high)) {
        this._draftTempRange.set(entityId, { low: pairEff.low, high: pairEff.high });
      }
      if (Number.isFinite(pairEff.low) && Number.isFinite(pairEff.high)) {
        this._updateDialRangePreview(pairEff.low, pairEff.high);
      }
      if (this._pendingRenderAfterDrag) {
        this._pendingRenderAfterDrag = false;
      }
      this._render();
      return;
    }

    const range = this._getTemperatureRange(state);
    const step = this._getTemperatureStep(state);
    const fallback = drag.handle === "low" ? drag.lastLow : drag.lastHigh;
    const raw = getDialValueFromPoint(drag.dial, clientX, clientY, range, step, fallback, drag.geometry);
    let low = drag.lastLow;
    let high = drag.lastHigh;
    if (drag.handle === "low") {
      const v = this._clampRangeLowCandidate(raw, high, state);
      if (v !== null) {
        low = v;
      }
    } else {
      const v = this._clampRangeHighCandidate(raw, low, state);
      if (v !== null) {
        high = v;
      }
    }
    const normalized = this._normalizeLowHighPair(low, high, state);

    this._setDialDraggingState(false, drag.dial);
    this._activeDialDrag = null;
    this._setDragWindowListeners(false);

    this._selectedRangeThumb = drag.handle;

    if (normalized) {
      this._triggerHaptic("selection");
      this._queueRangeCommit(normalized, { immediate: true, render: true });
    }

    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _onShadowPointerDown(event) {
    const path = event.composedPath();

    if (this._handleScheduleComposerPointerDown(event, path)) {
      return;
    }
    const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.climateAction);
    if (actionButton) {
      return;
    }

    const stateEarly = this._getState();
    if (
      !this._activeDialDrag &&
      stateEarly &&
      this._isDualSetpointRange(stateEarly) &&
      this._selectedRangeThumb
    ) {
      const onRangeThumb = path.some(
        n =>
          n instanceof Element &&
          (n.dataset?.climateControl === "dial-range-low" || n.dataset?.climateControl === "dial-range-high"),
      );
      if (!onRangeThumb) {
        const dialDual = path.find(
          n =>
            n instanceof HTMLElement &&
            n.classList?.contains("climate-card__dial") &&
            n.classList?.contains("climate-card__dial--dual-range"),
        );
        if (dialDual) {
          this._selectedRangeThumb = null;
          this._render();
        }
      }
    }

    const rangeLow = path.find(node => node instanceof Element && node.dataset?.climateControl === "dial-range-low");
    const rangeHigh = path.find(node => node instanceof Element && node.dataset?.climateControl === "dial-range-high");
    if ((rangeLow || rangeHigh) && this._isDualSetpointRange(this._getState())) {
      const dial = path.find(node => node instanceof HTMLElement && node.classList?.contains("climate-card__dial"));
      if (
        !this._activeDialDrag &&
        dial &&
        (typeof event.button !== "number" || event.button === 0)
      ) {
        this._startRangeDialDrag(
          dial,
          rangeLow ? "low" : "high",
          event.clientX,
          event.clientY,
          event,
          event.pointerId,
        );
      }
      return;
    }

    const dialHandle = path.find(
      node => node instanceof Element && node.dataset?.climateControl === "dial-hit",
    );
    const dial = dialHandle
      ? path.find(node => node instanceof HTMLElement && node.classList?.contains("climate-card__dial"))
      : null;

    if (
      this._activeDialDrag ||
      !dial ||
      (typeof event.button === "number" && event.button !== 0)
    ) {
      return;
    }

    this._startDialDrag(dial, event.clientX, event.clientY, event, event.pointerId);
  }

  _onShadowMouseDown(event) {
    const path = event.composedPath();
    const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.climateAction);
    if (actionButton) {
      return;
    }

    const stateEarly = this._getState();
    if (
      !this._activeDialDrag &&
      stateEarly &&
      this._isDualSetpointRange(stateEarly) &&
      this._selectedRangeThumb
    ) {
      const onRangeThumb = path.some(
        n =>
          n instanceof Element &&
          (n.dataset?.climateControl === "dial-range-low" || n.dataset?.climateControl === "dial-range-high"),
      );
      if (!onRangeThumb) {
        const dialDual = path.find(
          n =>
            n instanceof HTMLElement &&
            n.classList?.contains("climate-card__dial") &&
            n.classList?.contains("climate-card__dial--dual-range"),
        );
        if (dialDual) {
          this._selectedRangeThumb = null;
          this._render();
        }
      }
    }

    const rangeLow = path.find(node => node instanceof Element && node.dataset?.climateControl === "dial-range-low");
    const rangeHigh = path.find(node => node instanceof Element && node.dataset?.climateControl === "dial-range-high");
    if ((rangeLow || rangeHigh) && this._isDualSetpointRange(this._getState())) {
      const dial = path.find(node => node instanceof HTMLElement && node.classList?.contains("climate-card__dial"));
      if (!this._activeDialDrag && dial && event.button === 0) {
        this._startRangeDialDrag(dial, rangeLow ? "low" : "high", event.clientX, event.clientY, event, null);
      }
      return;
    }

    const dialHandle = path.find(
      node => node instanceof Element && node.dataset?.climateControl === "dial-hit",
    );
    const dial = dialHandle
      ? path.find(node => node instanceof HTMLElement && node.classList?.contains("climate-card__dial"))
      : null;

    if (this._activeDialDrag || !dial || event.button !== 0) {
      return;
    }

    this._startDialDrag(dial, event.clientX, event.clientY, event);
  }

  _onShadowTouchStart(event) {
    const path = event.composedPath();
    const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.climateAction);
    if (actionButton) {
      return;
    }

    const stateEarly = this._getState();
    if (
      !this._activeDialDrag &&
      stateEarly &&
      this._isDualSetpointRange(stateEarly) &&
      this._selectedRangeThumb
    ) {
      const onRangeThumb = path.some(
        n =>
          n instanceof Element &&
          (n.dataset?.climateControl === "dial-range-low" || n.dataset?.climateControl === "dial-range-high"),
      );
      if (!onRangeThumb) {
        const dialDual = path.find(
          n =>
            n instanceof HTMLElement &&
            n.classList?.contains("climate-card__dial") &&
            n.classList?.contains("climate-card__dial--dual-range"),
        );
        if (dialDual) {
          this._selectedRangeThumb = null;
          this._render();
        }
      }
    }

    const rangeLow = path.find(node => node instanceof Element && node.dataset?.climateControl === "dial-range-low");
    const rangeHigh = path.find(node => node instanceof Element && node.dataset?.climateControl === "dial-range-high");
    if ((rangeLow || rangeHigh) && this._isDualSetpointRange(this._getState()) && event.touches?.length) {
      const dial = path.find(node => node instanceof HTMLElement && node.classList?.contains("climate-card__dial"));
      if (!this._activeDialDrag && dial) {
        const t = event.touches[0];
        this._startRangeDialDrag(dial, rangeLow ? "low" : "high", t.clientX, t.clientY, event, null);
      }
      return;
    }

    const dialHandle = path.find(
      node => node instanceof Element && node.dataset?.climateControl === "dial-hit",
    );
    const dial = dialHandle
      ? path.find(node => node instanceof HTMLElement && node.classList?.contains("climate-card__dial"))
      : null;

    if (this._activeDialDrag || !dial || !event.touches?.length) {
      return;
    }

    this._startDialDrag(dial, event.touches[0].clientX, event.touches[0].clientY, event);
  }

  _onWindowPointerMove(event) {
    const drag = this._activeDialDrag;
    if (!drag) {
      return;
    }
    if (
      drag.pointerId != null &&
      event.pointerId != null &&
      drag.pointerId !== event.pointerId
    ) {
      return;
    }

    this._queueDialDragMove(event.clientX, event.clientY, event);
  }

  _onWindowPointerUp(event) {
    const drag = this._activeDialDrag;
    if (!drag) {
      return;
    }
    if (
      drag.pointerId != null &&
      event.pointerId != null &&
      drag.pointerId !== event.pointerId
    ) {
      return;
    }

    this._commitDialDrag(event.clientX, event.clientY, event, event.pointerId);
  }

  _onWindowMouseMove(event) {
    if (!this._activeDialDrag || (typeof event.buttons === "number" && (event.buttons & 1) === 0)) {
      return;
    }

    this._queueDialDragMove(event.clientX, event.clientY, event);
  }

  _onWindowMouseUp(event) {
    if (!this._activeDialDrag) {
      return;
    }

    this._commitDialDrag(event.clientX, event.clientY, event);
  }

  _onWindowTouchMove(event) {
    if (!this._activeDialDrag || !event.touches?.length) {
      return;
    }

    this._queueDialDragMove(event.touches[0].clientX, event.touches[0].clientY, event);
  }

  _onWindowTouchStartCapture(event) {
    const drag = this._activeDialDrag;
    if (!drag) {
      return;
    }

    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (path.includes(drag.dial)) {
      return;
    }

    this._setDialDraggingState(false, drag.dial);
    this._activeDialDrag = null;
    this._setDragWindowListeners(false);

    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _onWindowTouchEnd(event) {
    if (!this._activeDialDrag) {
      return;
    }

    const touch = event.changedTouches?.[0];
    if (!touch) {
      this._setDialDraggingState(false, this._activeDialDrag.dial);
      this._activeDialDrag = null;
      this._setDragWindowListeners(false);
      if (this._pendingRenderAfterDrag) {
        this._pendingRenderAfterDrag = false;
        this._render();
      }
      return;
    }

    this._commitDialDrag(touch.clientX, touch.clientY, event);
  }

  _performClimateCardAction(actionKind) {
    const key = actionKind === "hold"
      ? "hold_action"
      : actionKind === "double_tap"
        ? "double_tap_action"
        : "tap_action";
    const action = String(this._config?.[key] || "more-info");
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

  _performTapAction() {
    this._performClimateCardAction("tap");
  }

  _performHoldAction() {
    this._performClimateCardAction("hold");
  }

  _performDoubleTapAction() {
    this._performClimateCardAction("double_tap");
  }

  _triggerPressAnimation(element, className = "is-pressing") {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    const animations = this._config?.animations || DEFAULT_CONFIG.animations;
    if (animations.enabled === false) {
      return;
    }

    const duration = clamp(
      Number(animations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration,
      120,
      1200,
    );
    element.classList.remove(className);
    element.getBoundingClientRect();
    element.classList.add(className);
    window.setTimeout(() => {
      element.classList.remove(className);
    }, duration + 40);
  }

  _onShadowClick(event) {
    const path = event.composedPath();
    const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.climateAction);
    if (actionButton) {
      event.preventDefault();
      event.stopPropagation();

      const climateAction = actionButton.dataset.climateAction;
      if (climateAction === "schedule-open" || climateAction === "schedule-close") {
        event.preventDefault();
        event.stopPropagation();
        if (climateAction === "schedule-open") {
          this._triggerHaptic("selection");
          if (event.detail === 0) {
            this._triggerButtonBounce(actionButton);
          }
          this._openScheduleComposer();
        } else {
          this._closeScheduleComposer();
        }
        return;
      }

      const state = this._getState();
      if (!state) {
        return;
      }

      if (event.detail === 0) {
        this._triggerButtonBounce(actionButton);
      }

      switch (climateAction) {
      case "toggle":
        this._selectedRangeThumb = null;
        this._triggerHaptic();
        this._toggleClimate(state);
        break;
      case "decrease":
        this._changeTemperatureBy(-1);
        break;
      case "increase":
        this._changeTemperatureBy(1);
        break;
      case "mode":
        if (actionButton.dataset.mode) {
          this._selectedRangeThumb = null;
          this._triggerHaptic();
          this._setHvacMode(actionButton.dataset.mode);
        }
        break;
      case "schedule-save":
        this._triggerHaptic("selection");
        this._submitScheduleComposer();
        break;
      case "schedule-add":
        this._triggerHaptic("selection");
        this._addScheduleComposerSlot(actionButton.dataset.scheduleDay || "mon");
        break;
      case "schedule-remove":
        if (actionButton.dataset.scheduleSlotId) {
          this._triggerHaptic("selection");
          this._removeScheduleComposerSlot(actionButton.dataset.scheduleSlotId);
        }
        break;
      default:
        break;
      }
      return;
    }

    const scheduleBackdrop = path.find(
      node => node instanceof HTMLElement && node.dataset?.climateScheduleBackdrop === "true",
    );
    if (scheduleBackdrop) {
      event.preventDefault();
      event.stopPropagation();
      this._closeScheduleComposer();
      return;
    }

    if (
      path.some(
        node => node instanceof HTMLElement && node.classList?.contains("climate-schedule-expanded"),
      )
    ) {
      return;
    }

    const cardRoot = path.find(node => node instanceof HTMLElement && node.dataset?.climateCard === "root");
    if (!cardRoot) {
      return;
    }

    if (this._scheduleComposerOpen) {
      return;
    }

    if (path.some(node => node instanceof HTMLElement && node.dataset?.climateControl)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!this._getState()) {
      return;
    }

    if (this._suppressNextClimateTap) {
      this._suppressNextClimateTap = false;
      return;
    }

    const tapAction = String(this._config?.tap_action || "more-info");
    const doubleAction = String(this._config?.double_tap_action || "none");
    const runTap = () => {
      if (tapAction === "none") {
        return;
      }
      this._triggerPressAnimation(this.shadowRoot?.querySelector(".climate-card__content"));
      this._performTapAction();
    };
    const runDouble = () => {
      if (doubleAction === "none") {
        return;
      }
      this._triggerPressAnimation(this.shadowRoot?.querySelector(".climate-card__content"));
      this._performDoubleTapAction();
    };

    if (doubleAction !== "none" && typeof window.NodaliaUtils?.scheduleCardZoneTap === "function") {
      window.NodaliaUtils.scheduleCardZoneTap(this, {
        zone: "body",
        onSingle: runTap,
        onDouble: runDouble,
      });
      return;
    }

    runTap();
  }

  _onShadowKeyDown(event) {
    if (!this._scheduleComposerOpen) {
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    const target = event.composedPath()[0];
    if (
      target instanceof HTMLInputElement &&
      (target.type === "time" || target.type === "number" || target.type === "text")
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => (
        node instanceof HTMLInputElement
        || node instanceof HTMLSelectElement
      ) && node.dataset?.climateScheduleField);

    if (!input) {
      return;
    }

    event.stopPropagation();

    if (input.dataset?.climateScheduleField === "enabled") {
      if (event.type === "input") {
        return;
      }
      this._setScheduleComposerEnabled(Boolean(input.checked));
      return;
    }

    const slotId = String(input.dataset.scheduleSlotId || "").trim();
    const field = String(input.dataset.climateScheduleField || "").trim();
    if (!slotId || !field) {
      return;
    }

    if ((input.type === "time" || input.type === "number") && event.type === "input") {
      return;
    }

    let value = input.value;
    if (field === "temperature") {
      value = Number(value);
      if (!Number.isFinite(value)) {
        return;
      }
    }

    this._updateScheduleComposerSlot(slotId, { [field]: value }, { render: false });
  }

  _renderSetpointScheduleButtonHtml(options = {}) {
    const scheduleLabel = this._climateScheduleText(
      "openButton",
      "Weekly setpoint schedule",
    );
    const placement = options.placement === "dial" ? "dial" : "steps";

    return `
      <button
        type="button"
        class="climate-card__schedule-button climate-card__schedule-button--${placement}"
        data-climate-action="schedule-open"
        aria-label="${escapeHtml(scheduleLabel)}"
        title="${escapeHtml(scheduleLabel)}"
      >
        <ha-icon icon="mdi:calendar-clock"></ha-icon>
      </button>
    `;
  }

  _renderSetpointScheduleSlotEditorHtml(slot, options = {}) {
    const {
      startLabel,
      endLabel,
      tempLabel,
      removeLabel,
      minTemp,
      maxTemp,
      stepAttr,
    } = options;
    const selected = this._scheduleComposerSelectedSlotId === slot.id;

    return `
      <div class="climate-schedule-agenda__editor ${selected ? "is-visible" : ""}" data-schedule-slot-editor="${escapeHtml(slot.id)}">
        <label class="climate-schedule-agenda__editor-field">
          <span>${escapeHtml(startLabel)}</span>
          <input
            type="time"
            value="${escapeHtml(slot.start)}"
            data-climate-schedule-field="start"
            data-schedule-slot-id="${escapeHtml(slot.id)}"
          />
        </label>
        <label class="climate-schedule-agenda__editor-field">
          <span>${escapeHtml(endLabel)}</span>
          <input
            type="time"
            value="${escapeHtml(slot.end)}"
            data-climate-schedule-field="end"
            data-schedule-slot-id="${escapeHtml(slot.id)}"
          />
        </label>
        <label class="climate-schedule-agenda__editor-field climate-schedule-agenda__editor-field--temp">
          <span>${escapeHtml(tempLabel)}</span>
          <input
            type="number"
            min="${minTemp}"
            max="${maxTemp}"
            step="${stepAttr}"
            value="${escapeHtml(String(slot.temperature))}"
            data-climate-schedule-field="temperature"
            data-schedule-slot-id="${escapeHtml(slot.id)}"
          />
        </label>
        <button
          type="button"
          class="climate-schedule-agenda__editor-remove"
          data-climate-action="schedule-remove"
          data-schedule-slot-id="${escapeHtml(slot.id)}"
          aria-label="${escapeHtml(removeLabel)}"
          title="${escapeHtml(removeLabel)}"
        >
          <ha-icon icon="mdi:delete-outline"></ha-icon>
        </button>
      </div>
    `;
  }

  _renderSetpointScheduleDayAgendaRowHtml(day, slots, options = {}) {
    const {
      dayLabel,
      addLabel,
      emptyLabel,
      accentColor,
      temperatureStep,
      hass,
      startLabel,
      endLabel,
      tempLabel,
      removeLabel,
      minTemp,
      maxTemp,
      stepAttr,
    } = options;
    const daySlots = slots
      .filter(slot => slot.day === day && slot.enabled !== false)
      .sort((left, right) => {
        const a = parseScheduleClockMinutes(left.start) ?? 0;
        const b = parseScheduleClockMinutes(right.start) ?? 0;
        return a - b;
      });

    const blocks = daySlots
      .map(slot => {
        const layout = getSetpointScheduleBlockLayout(slot);
        const selected = this._scheduleComposerSelectedSlotId === slot.id;
        const tempLabelShort = formatTemperature(slot.temperature, temperatureStep, true, hass);
        return `
          <div
            class="climate-schedule-agenda__block ${selected ? "is-selected" : ""}"
            data-schedule-block-id="${escapeHtml(slot.id)}"
            style="--block-left:${layout.left.toFixed(3)}%;--block-width:${layout.width.toFixed(3)}%;"
            title="${escapeHtml(`${slot.start}–${slot.end} · ${tempLabelShort}`)}"
            aria-label="${escapeHtml(`${slot.start}–${slot.end}, ${tempLabelShort}`)}"
          >
            <span class="climate-schedule-agenda__block-grip climate-schedule-agenda__block-grip--start" data-schedule-resize="start" data-schedule-slot-id="${escapeHtml(slot.id)}" aria-hidden="true"></span>
            <span class="climate-schedule-agenda__block-body">
              <span class="climate-schedule-agenda__block-time">${escapeHtml(`${slot.start}–${slot.end}`)}</span>
              <span class="climate-schedule-agenda__block-temp">${escapeHtml(tempLabelShort)}</span>
            </span>
            <span class="climate-schedule-agenda__block-grip climate-schedule-agenda__block-grip--end" data-schedule-resize="end" data-schedule-slot-id="${escapeHtml(slot.id)}" aria-hidden="true"></span>
          </div>
        `;
      })
      .join("");

    const editors = daySlots
      .map(slot => this._renderSetpointScheduleSlotEditorHtml(slot, {
        startLabel,
        endLabel,
        tempLabel,
        removeLabel,
        minTemp,
        maxTemp,
        stepAttr,
      }))
      .join("");

    return `
      <div class="climate-schedule-agenda__row">
        <div class="climate-schedule-agenda__row-head">
          <span class="climate-schedule-agenda__day-label">${escapeHtml(dayLabel)}</span>
          <button
            type="button"
            class="climate-schedule-agenda__day-add"
            data-climate-action="schedule-add"
            data-schedule-day="${escapeHtml(day)}"
            aria-label="${escapeHtml(addLabel)}"
            title="${escapeHtml(addLabel)}"
          >
            <ha-icon icon="mdi:plus"></ha-icon>
          </button>
        </div>
        <div class="climate-schedule-agenda__timeline-wrap">
          <div
            class="climate-schedule-agenda__track"
            data-schedule-day-track="${escapeHtml(day)}"
            style="--schedule-accent:${escapeHtml(accentColor)};"
          >
            <div class="climate-schedule-agenda__track-grid" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="climate-schedule-agenda__blocks">
              ${blocks || `<span class="climate-schedule-agenda__track-empty">${escapeHtml(emptyLabel)}</span>`}
            </div>
          </div>
          <div class="climate-schedule-agenda__axis" aria-hidden="true">
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>24</span>
          </div>
        </div>
        ${editors}
      </div>
    `;
  }

  _renderScheduleComposerHtml(options = {}) {
    const {
      accentColor,
      temperatureStep,
      temperatureRange,
      hass,
    } = options;
    const schedule = this._getScheduleComposerDraft();
    const title = this._climateScheduleText("popupTitle", "Weekly schedule");
    const hint = this._climateScheduleText(
      "popupHint",
      "Define time blocks and target temperatures, then save to sync Home Assistant automations through your webhook.",
    );
    const enabledLabel = this._climateScheduleText("enabledLabel", "Enable schedule");
    const addLabel = this._climateScheduleText("addSlot", "Add block");
    const emptyLabel = this._climateScheduleText("emptyDay", "No blocks");
    const cancelLabel = this._climateScheduleText("cancel", "Cancel");
    const saveLabel = this._climateScheduleText("save", "Save schedule");
    const savingLabel = this._climateScheduleText("saving", "Saving…");
    const startLabel = this._climateScheduleText("start", "Start");
    const endLabel = this._climateScheduleText("end", "End");
    const tempLabel = this._climateScheduleText("temperature", "Setpoint");
    const removeLabel = this._climateScheduleText("remove", "Remove");
    const minTemp = temperatureRange.min;
    const maxTemp = temperatureRange.max;
    const stepAttr = temperatureStep > 0 ? temperatureStep : 0.5;
    const isSaving = this._scheduleComposerSaving === true;

    const closeLabel = this._climateScheduleText("close", "Close");
    const dayOrder = this._getScheduleComposerDayOrder();
    const agendaRows = dayOrder
      .map(day =>
        this._renderSetpointScheduleDayAgendaRowHtml(day, schedule.slots, {
          dayLabel: this._climateScheduleText(`day.${day}`, day),
          addLabel,
          emptyLabel,
          accentColor,
          temperatureStep,
          hass,
          startLabel,
          endLabel,
          tempLabel,
          removeLabel,
          minTemp,
          maxTemp,
          stepAttr,
        }),
      )
      .join("");

    return `
      <div
        class="climate-schedule-expanded ${this._scheduleComposerOpen ? "is-open" : ""}"
        style="--climate-schedule-accent:${escapeHtml(accentColor)};"
        aria-hidden="${this._scheduleComposerOpen ? "false" : "true"}"
      >
        <div class="climate-schedule-expanded__backdrop" data-climate-schedule-backdrop="true"></div>
        <div
          class="climate-schedule-expanded__panel"
          role="dialog"
          aria-modal="true"
          aria-label="${escapeHtml(title)}"
        >
          <div class="climate-schedule-expanded__toolbar">
            <div class="climate-schedule-expanded__toolbar-copy">
              <div class="climate-schedule-expanded__title">${escapeHtml(title)}</div>
              <div class="climate-schedule-expanded__hint">${escapeHtml(hint)}</div>
            </div>
            <button
              type="button"
              class="climate-schedule-expanded__close"
              data-climate-action="schedule-close"
              aria-label="${escapeHtml(closeLabel)}"
              ${isSaving ? "disabled" : ""}
            >
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          ${this._renderScheduleComposerErrorHtml()}
          <label class="climate-schedule-expanded__enabled">
            <input
              type="checkbox"
              ${schedule.enabled ? "checked" : ""}
              data-climate-schedule-field="enabled"
            />
            <span class="climate-schedule-expanded__enabled-switch" aria-hidden="true"></span>
            <span>${escapeHtml(enabledLabel)}</span>
          </label>
          <div class="climate-schedule-agenda">
            ${agendaRows}
          </div>
          <div class="climate-schedule-expanded__actions">
            <button
              type="button"
              class="climate-schedule-expanded__btn"
              data-climate-action="schedule-close"
              ${isSaving ? "disabled" : ""}
            >
              ${escapeHtml(cancelLabel)}
            </button>
            <button
              type="button"
              class="climate-schedule-expanded__btn climate-schedule-expanded__btn--primary"
              data-climate-action="schedule-save"
              ${isSaving ? "disabled" : ""}
            >
              ${escapeHtml(isSaving ? savingLabel : saveLabel)}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderEmptyState() {
    return `
      <ha-card class="climate-card climate-card--empty">
        <div class="climate-card__empty-title">Nodalia Climate Card</div>
        <div class="climate-card__empty-text">Configura \`entity\` con una entidad \`climate.*\` para mostrar la tarjeta.</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const styles = config.styles || DEFAULT_CONFIG.styles;

    const entityGuard = window.NodaliaUtils?.renderLovelaceEntityGuardCardHtml?.(
      this._hass,
      config.entity,
      { cardClass: "climate-card" },
    );
    if (entityGuard) {
      this.shadowRoot.innerHTML = entityGuard;
      return;
    }

    const state = this._getState();
    if (!state) {
      return;
    }

    const title = this._getClimateName(state);
    const icon = this._getClimateIcon(state);
    const entityPicture = this._getEntityPicture(state);
    const accentColor = this._getAccentColor(state);
    const currentMode = this._getCurrentMode(state);
    const currentTemperature = this._getCurrentTemperature(state);
    const currentHumidity = this._getCurrentHumidity(state);
    const targetTemperature = this._getTargetTemperature(state);
    const temperatureRange = this._getTemperatureRange(state);
    const temperatureStep = this._getTemperatureStep(state);
    const normalizedCurrentMode = normalizeTextKey(currentMode);
    const supportsTargetTemperature = this._supportsTargetTemperature(state);
    const compactLevel = this._getCompactLevel();
    const compactLayout = compactLevel !== "default";
    const tightLayout = compactLevel === "tight";
    const modeOptions = config.show_mode_buttons !== false ? this._getOrderedModeOptions(state) : [];
    const visibleModeOptions = modeOptions.filter(mode => normalizeTextKey(mode) !== normalizedCurrentMode);
    const showUnavailableBadge = config.show_unavailable_badge !== false && isUnavailableState(state);
    const isOff = this._isEffectiveClimateOff(state) || isUnavailableState(state);
    const modeDialButtonCount = (isOff ? 0 : 1) + visibleModeOptions.length;
    const isRangeMode = !isOff && this._isDualSetpointRange(state);
    if (!isRangeMode) {
      this._selectedRangeThumb = null;
      this._lastDualRangeModeKey = null;
    } else {
      const modeKey = normalizedCurrentMode;
      if (this._lastDualRangeModeKey != null && this._lastDualRangeModeKey !== modeKey) {
        this._selectedRangeThumb = null;
      }
      this._lastDualRangeModeKey = modeKey;
    }
    const rangeBand = isRangeMode ? this._getEffectiveTargetLowHigh(state) : { low: NaN, high: NaN };
    const hasNumericTarget =
      targetTemperature !== null && targetTemperature !== undefined && Number.isFinite(Number(targetTemperature));
    const hasPublishedSingleTarget = !isRangeMode && supportsTargetTemperature && hasNumericTarget;
    const mainTemperaturePref =
      normalizeTextKey(String(config.display?.main_temperature ?? "").trim()) === "current" ? "current" : "target";
    const currentFin =
      currentTemperature !== null && Number.isFinite(Number(currentTemperature))
        ? Number(currentTemperature)
        : NaN;
    const targetFin = hasPublishedSingleTarget ? Number(targetTemperature) : NaN;
    const dialThumbValue = isRangeMode ? NaN : (supportsTargetTemperature && hasNumericTarget ? Number(targetTemperature) : NaN);
    let dialPrimaryReadoutValue;
    if (isRangeMode) {
      dialPrimaryReadoutValue = currentTemperature !== null ? currentTemperature : NaN;
    } else if (mainTemperaturePref === "current") {
      dialPrimaryReadoutValue = Number.isFinite(currentFin)
        ? currentFin
        : (Number.isFinite(targetFin) ? targetFin : NaN);
    } else if (Number.isFinite(targetFin)) {
      dialPrimaryReadoutValue = targetFin;
    } else if (Number.isFinite(currentFin)) {
      dialPrimaryReadoutValue = currentFin;
    } else {
      dialPrimaryReadoutValue = NaN;
    }
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const i18nLang = config.language ?? "auto";
    const toggleAriaLabel = window.NodaliaI18n?.translateClimateAria
      ? window.NodaliaI18n.translateClimateAria(hass, i18nLang, "togglePower", "Turn on or off")
      : "Turn on or off";
    const noSetpointDial = !isRangeMode && !(supportsTargetTemperature && hasNumericTarget);
    const tempScale = getClimateTemperatureScaleLetter(hass);
    const translateClimateMode = mode => (
      window.NodaliaI18n?.translateClimateHvacLabel
        ? window.NodaliaI18n.translateClimateHvacLabel(hass, i18nLang, mode, false)
        : getModeMeta(mode).label
    );
    const climateOffModeLabel = escapeHtml(translateClimateMode("off"));
    const cardPaddingY = tightLayout ? 12 : compactLayout ? 14 : parseSizeToPixels(styles.card.padding, 16);
    const cardPaddingX = tightLayout ? 12 : compactLayout ? 14 : parseSizeToPixels(styles.card.padding, 16);
    const effectiveCardPadding = `${cardPaddingY}px ${cardPaddingX}px`;
    const effectiveCardGap = tightLayout ? "10px" : compactLayout ? "12px" : styles.card.gap;
    const supportsNullSetpointCreation = this._supportsNullSetpointCreation(state);
    const showStepControls =
      config.show_step_controls !== false &&
      (supportsTargetTemperature || supportsNullSetpointCreation);
    const contentColumnGap = showStepControls
      ? (tightLayout ? "8px" : compactLayout ? "9px" : "10px")
      : effectiveCardGap;
    const effectiveIconSizePx = Math.max(
      48,
      Math.min(parseSizeToPixels(styles.icon.size, 58), tightLayout ? 50 : compactLayout ? 54 : 58),
    );
    const effectiveIconSize = `${effectiveIconSizePx}px`;
    const effectiveTitleSize = `${Math.max(
      14,
      Math.min(parseSizeToPixels(styles.title_size, 16), tightLayout ? 15 : compactLayout ? 15.5 : 16),
    )}px`;
    const effectiveCurrentSize = `${Math.max(
      14,
      Math.min(parseSizeToPixels(styles.current_size, 16), tightLayout ? 15 : compactLayout ? 15.5 : 16),
    )}px`;
    const effectiveTargetSize = `${Math.max(
      42,
      Math.min(parseSizeToPixels(styles.target_size, 50), tightLayout ? 44 : compactLayout ? 46 : 50),
    )}px`;
    const effectiveChipHeight = `${Math.max(
      21,
      Math.min(parseSizeToPixels(styles.chip_height, 24), tightLayout ? 22 : compactLayout ? 23 : 24),
    )}px`;
    const effectiveChipFontSize = `${Math.max(
      10,
      Math.min(parseSizeToPixels(styles.chip_font_size, 11), tightLayout ? 10 : compactLayout ? 10.5 : 11),
    )}px`;
    const effectiveChipPadding = tightLayout ? "0 9px" : compactLayout ? "0 10px" : styles.chip_padding;
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const dialMaxCapPx = Math.max(
      220,
      parseSizeToPixels(styles.dial?.max_size ?? DEFAULT_CONFIG.styles.dial.max_size, 480),
    );
    const dialSizePx = Math.max(
      220,
      Math.min(
        parseSizeToPixels(styles.dial.size, 280),
        tightLayout ? Math.min(dialMaxCapPx, 236) : compactLayout ? Math.min(dialMaxCapPx, 252) : dialMaxCapPx,
      ),
    );
    const dialStrokePx = Math.max(
      15,
      Math.min(parseSizeToPixels(styles.dial.stroke, 18), tightLayout ? 16 : compactLayout ? 17 : 18),
    );
    const thumbSizePx = Math.max(
      20,
      Math.min(parseSizeToPixels(styles.dial.thumb_size, 24), tightLayout ? 21 : compactLayout ? 22 : 24),
    );
    const stepControlSize = Math.max(
      40,
      Math.min(parseSizeToPixels(styles.step_control.size, 50), tightLayout ? 42 : compactLayout ? 46 : 50),
    );
    const modeControlSize = Math.max(
      32,
      Math.min(parseSizeToPixels(styles.control.size, 42) - 4, tightLayout ? 34 : compactLayout ? 36 : 38),
    );
    const modeControlRenderPx =
      modeDialButtonCount >= 8
        ? Math.max(24, Math.round(modeControlSize - 9))
        : modeDialButtonCount >= 5
          ? Math.max(28, Math.round(modeControlSize - 6))
          : modeControlSize;
    const modeDialButtonGap =
      modeDialButtonCount >= 8
        ? "3px"
        : modeDialButtonCount >= 7
          ? "4px"
          : modeDialButtonCount >= 5
            ? (tightLayout ? "4px" : "5px")
            : (tightLayout ? "8px" : "10px");
    const interBlockGapPx = showStepControls
      ? (tightLayout ? 16 : compactLayout ? 18 : 20)
      : (tightLayout ? 10 : compactLayout ? 12 : 14);
    const climateCardMinHeightPx = Math.max(
      220,
      Math.round(
        cardPaddingY * 2 +
          effectiveIconSizePx +
          dialSizePx +
          (showStepControls ? stepControlSize : 0) +
          interBlockGapPx,
      ),
    );
    const dialCenterGridGap =
      modeDialButtonCount >= 5
        ? (tightLayout ? "6px" : compactLayout ? "7px" : "8px")
        : modeDialButtonCount >= 3
          ? (tightLayout ? "8px" : compactLayout ? "9px" : "11px")
          : (tightLayout ? "10px" : compactLayout ? "12px" : "15px");
    const dialCenterInsetCss = getClimateDialCenterInsetCss(modeDialButtonCount, tightLayout, compactLayout);
    const dialCenterAlignContent = modeDialButtonCount >= 3 ? "start" : "center";
    const stackedModeControlsGap =
      modeDialButtonCount >= 5 ? (tightLayout ? "6px" : compactLayout ? "6px" : "7px") : (tightLayout ? "7px" : "9px");
    const targetUnitTopEm = modeDialButtonCount >= 3 ? "0.44em" : "0.14em";
    const targetBlockPaddingTop = modeDialButtonCount >= 3 ? "0.12em" : "0";
    const tempSpan = Math.max(temperatureRange.max - temperatureRange.min, temperatureStep);
    const chips = [];
    let ratio = 0;
    let dialAngle = DIAL_START_ANGLE;
    let progressLength = 0;
    let thumbPosition = { left: 50, top: 50 };
    let heatArcLen = 0;
    let coolArcLen = 0;
    let coolDashOffsetPx = 0;
    let thumbHeatPosition = { left: 50, top: 50 };
    let thumbCoolPosition = { left: 50, top: 50 };
    if (isRangeMode && Number.isFinite(rangeBand.low) && Number.isFinite(rangeBand.high)) {
      const ratioL = clamp((rangeBand.low - temperatureRange.min) / tempSpan, 0, 1);
      const ratioH = clamp((rangeBand.high - temperatureRange.min) / tempSpan, 0, 1);
      heatArcLen = Number((ratioL * DIAL_VISIBLE_LENGTH).toFixed(3));
      coolArcLen = Number(((1 - ratioH) * DIAL_VISIBLE_LENGTH).toFixed(3));
      coolDashOffsetPx = Number((-ratioH * DIAL_VISIBLE_LENGTH).toFixed(3));
      const angleL = DIAL_START_ANGLE + (ratioL * DIAL_SWEEP);
      const angleH = DIAL_START_ANGLE + (ratioH * DIAL_SWEEP);
      thumbHeatPosition = getDialMarkerPosition(angleL);
      thumbCoolPosition = getDialMarkerPosition(angleH);
    } else if (supportsTargetTemperature && Number.isFinite(dialThumbValue)) {
      ratio = (dialThumbValue - temperatureRange.min) / tempSpan;
      dialAngle = DIAL_START_ANGLE + (clamp(ratio, 0, 1) * DIAL_SWEEP);
      progressLength = Number((DIAL_VISIBLE_LENGTH * clamp(ratio, 0, 1)).toFixed(3));
      thumbPosition = getDialMarkerPosition(dialAngle);
    }
    const currentRatio = currentTemperature !== null
      ? clamp(
        (currentTemperature - temperatureRange.min) / Math.max(temperatureRange.max - temperatureRange.min, temperatureStep),
        0,
        1,
      )
      : null;
    const currentAngle = currentRatio === null
      ? null
      : DIAL_START_ANGLE + (currentRatio * DIAL_SWEEP);
    const currentMarkerPosition = currentAngle === null ? null : getDialMarkerPosition(currentAngle);
    const showDialCurrentMarker = !isRangeMode && currentMarkerPosition !== null;
    const dialSvgInner = isRangeMode
      ? `
                <circle
                  class="climate-card__dial-track"
                  cx="${DIAL_VIEWBOX_SIZE / 2}"
                  cy="${DIAL_VIEWBOX_SIZE / 2}"
                  r="${DIAL_CIRCLE_RADIUS}"
                ></circle>
                <circle
                  class="climate-card__dial-progress-heat"
                  cx="${DIAL_VIEWBOX_SIZE / 2}"
                  cy="${DIAL_VIEWBOX_SIZE / 2}"
                  r="${DIAL_CIRCLE_RADIUS}"
                ></circle>
                <circle
                  class="climate-card__dial-progress-cool"
                  cx="${DIAL_VIEWBOX_SIZE / 2}"
                  cy="${DIAL_VIEWBOX_SIZE / 2}"
                  r="${DIAL_CIRCLE_RADIUS}"
                ></circle>`
      : `
                <circle
                  class="climate-card__dial-track"
                  cx="${DIAL_VIEWBOX_SIZE / 2}"
                  cy="${DIAL_VIEWBOX_SIZE / 2}"
                  r="${DIAL_CIRCLE_RADIUS}"
                ></circle>
                <circle
                  class="climate-card__dial-hit"
                  data-climate-control="dial-hit"
                  cx="${DIAL_VIEWBOX_SIZE / 2}"
                  cy="${DIAL_VIEWBOX_SIZE / 2}"
                  r="${DIAL_CIRCLE_RADIUS}"
                ></circle>
                <circle
                  class="climate-card__dial-progress"
                  cx="${DIAL_VIEWBOX_SIZE / 2}"
                  cy="${DIAL_VIEWBOX_SIZE / 2}"
                  r="${DIAL_CIRCLE_RADIUS}"
                ></circle>`;
    const dialThumbsInner = isRangeMode
      ? `
              <span class="climate-card__dial-thumb climate-card__dial-thumb--heat${this._selectedRangeThumb === "low" ? " climate-card__dial-thumb--range-selected" : ""}" data-climate-control="dial-range-low" aria-hidden="true"></span>
              <span class="climate-card__dial-thumb climate-card__dial-thumb--cool${this._selectedRangeThumb === "high" ? " climate-card__dial-thumb--range-selected" : ""}" data-climate-control="dial-range-high" aria-hidden="true"></span>`
      : `
              <span class="climate-card__dial-current-marker" aria-hidden="true"></span>
              <span class="climate-card__dial-thumb" data-climate-control="dial-hit" aria-hidden="true"></span>`;
    const dialInlineVars = isRangeMode
      ? `--climate-thumb-heat-left:${thumbHeatPosition.left}%;--climate-thumb-heat-top:${thumbHeatPosition.top}%;--climate-thumb-cool-left:${thumbCoolPosition.left}%;--climate-thumb-cool-top:${thumbCoolPosition.top}%;--climate-heat-progress:${heatArcLen};--climate-cool-progress:${coolArcLen};--climate-cool-dashoffset:${coolDashOffsetPx}px;`
      : `--climate-thumb-left:${thumbPosition.left}%;--climate-thumb-top:${thumbPosition.top}%;${showDialCurrentMarker ? `--climate-current-left:${currentMarkerPosition.left}%;--climate-current-top:${currentMarkerPosition.top}%;` : ""}`;

    if (config.show_state_chip !== false) {
      chips.push(`<div class="climate-card__chip climate-card__chip--state">${escapeHtml(this._getStateLabel(state))}</div>`);
    }

    if (config.show_current_temperature_chip !== false && currentTemperature !== null) {
      chips.push(`<div class="climate-card__chip">${escapeHtml(formatTemperature(currentTemperature, temperatureStep, true, hass))}</div>`);
    }

    if (config.show_humidity_chip !== false && currentHumidity !== null) {
      chips.push(`<div class="climate-card__chip">${escapeHtml(`${Math.round(currentHumidity)}%`)}</div>`);
    }

    const currentActionMeta = climateDialActionMeta(this._getCurrentAction(state), currentMode);
    const dialPrimaryReadoutHtml = isRangeMode
      ? escapeHtml(
        currentTemperature !== null
          ? formatTemperature(currentTemperature, temperatureStep, false, hass)
          : formatTemperature(null, temperatureStep, false, hass),
      )
      : escapeHtml(formatTemperature(dialPrimaryReadoutValue, temperatureStep, false, hass));
    const dialNoSetpointHint =
      window.NodaliaI18n?.translateClimateDialNoSetpointHint != null
        ? window.NodaliaI18n.translateClimateDialNoSetpointHint(hass, i18nLang)
        : "No active setpoint";
    const dialMetaHtml = isRangeMode
      ? `<span class="climate-card__dial-range">${escapeHtml(formatTemperatureRangeSummary(rangeBand.low, rangeBand.high, temperatureStep, hass))}</span>`
      : noSetpointDial
        ? `<span class="climate-card__dial-no-setpoint">${escapeHtml(dialNoSetpointHint)}</span>`
        : mainTemperaturePref === "current" && hasPublishedSingleTarget && Number.isFinite(targetFin)
          ? `<span>${escapeHtml(formatTemperature(targetFin, temperatureStep, true, hass))}</span>`
          : (currentTemperature !== null
            ? `<span>${escapeHtml(formatTemperature(currentTemperature, temperatureStep, true, hass))}</span>`
            : "");
    const dialActionHtml =
      noSetpointDial && isOff
        ? ""
        : `<span class="climate-card__dial-action">
                    <ha-icon icon="${escapeHtml(currentActionMeta.icon)}"></ha-icon>
                  </span>`;
    const dialAriaLabelVariant = isRangeMode ? "rangeGroup" : noSetpointDial ? "noSetpoint" : "targetSlider";
    const dialAriaFallback =
      dialAriaLabelVariant === "rangeGroup"
        ? "Comfort range and indoor temperature"
        : dialAriaLabelVariant === "noSetpoint"
          ? "Indoor temperature; thermostat has no active target yet"
          : "Target temperature";
    const dialAriaLabel =
      window.NodaliaI18n?.translateClimateDialAria != null
        ? window.NodaliaI18n.translateClimateDialAria(hass, i18nLang, dialAriaLabelVariant)
        : dialAriaFallback;
    const ariaDialSemanticValue = Number.isFinite(targetFin) ? targetFin : dialPrimaryReadoutValue;
    const ariaDialValue =
      !isRangeMode && !noSetpointDial && Number.isFinite(ariaDialSemanticValue)
        ? ariaDialSemanticValue
        : null;
    const cardBackground = isOff
      ? styles.card.background
      : `
        linear-gradient(135deg, color-mix(in srgb, ${accentColor} 22%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 12%, ${styles.card.background}) 56%, ${styles.card.background} 100%)
      `.trim();
    const cardBorder = isOff
      ? styles.card.border
      : `1px solid color-mix(in srgb, ${accentColor} 34%, var(--divider-color))`;
    const cardShadow = isOff
      ? styles.card.box_shadow
      : `${styles.card.box_shadow}, 0 18px 36px color-mix(in srgb, ${accentColor} 14%, rgba(0, 0, 0, 0.16))`;
    const dialSurfaceBackground = `
      radial-gradient(circle at 24% 18%, color-mix(in srgb, ${accentColor} 20%, transparent), transparent 30%),
      linear-gradient(180deg, color-mix(in srgb, ${accentColor} 14%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)) 0%, rgba(255, 255, 255, 0) 42%),
      linear-gradient(135deg, color-mix(in srgb, ${accentColor} 16%, ${styles.dial.background}) 0%, color-mix(in srgb, ${accentColor} 8%, ${styles.dial.background}) 60%, ${styles.dial.background} 100%)
    `.trim();
    const dialTrackColor = `color-mix(in srgb, ${styles.dial.track_color} 52%, var(--primary-text-color) 48%)`;
    const dialHeatStroke = String(styles.dial.heat_color || "#f59f42").trim();
    const dialCoolStroke = String(styles.dial.cool_color || "#71c0ff").trim();
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const showScheduleButton = config.show_schedule_button !== false;
    const showScheduleInSteps = showScheduleButton && showStepControls;
    const showScheduleOnDial = showScheduleButton && !showStepControls;
    const scheduleButtonDialMarkup = showScheduleOnDial
      ? this._renderSetpointScheduleButtonHtml({ placement: "dial" })
      : "";
    const scheduleButtonStepsMarkup = showScheduleInSteps
      ? this._renderSetpointScheduleButtonHtml({ placement: "steps" })
      : "";
    const scheduleComposerMarkup = this._renderScheduleComposerHtml({
      accentColor,
      temperatureStep,
      temperatureRange,
      hass,
    });
    const dialControlsStacked = modeDialButtonCount >= 3;
    const dialModeButtonFragments = [];
    if (!isOff) {
      dialModeButtonFragments.push(`
                  <button
                    type="button"
                    class="climate-card__mode-button climate-card__mode-button--power is-active"
                    data-climate-action="toggle"
                    title="${climateOffModeLabel}"
                    aria-label="${climateOffModeLabel}"
                  >
                    <ha-icon icon="mdi:power"></ha-icon>
                  </button>`);
    }
    for (const mode of visibleModeOptions) {
      const meta = getModeMeta(mode);
      const modeLabel = translateClimateMode(mode);
      dialModeButtonFragments.push(`
                        <button
                          type="button"
                          class="climate-card__mode-button"
                          data-climate-action="mode"
                          data-mode="${escapeHtml(mode)}"
                          title="${escapeHtml(modeLabel)}"
                          aria-label="${escapeHtml(modeLabel)}"
                        >
                          <ha-icon icon="${escapeHtml(meta.icon)}"></ha-icon>
                        </button>`);
    }
    const dialControlsMarkup =
      dialModeButtonFragments.length === 0
        ? `<div class="climate-card__dial-controls"></div>`
        : dialControlsStacked
          ? (() => {
              const rows = buildClimateDialModeButtonRows(dialModeButtonFragments);
              const rowsHtml = rows
                .map(
                  (frags, idx) =>
                    `<div class="climate-card__dial-controls-row${idx > 0 ? " climate-card__dial-controls-row--secondary" : ""}">${frags.join("")}</div>`,
                )
                .join("");

              return `
                <div class="climate-card__dial-controls climate-card__dial-controls--stacked">
                  ${rowsHtml}
                </div>`;
            })()
          : `
                <div class="climate-card__dial-controls">
                  ${dialModeButtonFragments.join("")}
                </div>`;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --climate-card-dial-duration: ${animations.enabled ? animations.dialDuration : 0}ms;
          --climate-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --climate-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          --climate-mode-gap: ${modeDialButtonGap};
          align-self: start;
          display: block;
          height: auto;
          max-width: 100%;
          min-height: ${climateCardMinHeightPx}px;
          width: 100%;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          height: auto;
          min-height: ${climateCardMinHeightPx}px;
          overflow: hidden;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .climate-card {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${accentColor} 34%, transparent) 0%, transparent 60%),
            radial-gradient(circle at 50% 38%, color-mix(in srgb, ${accentColor} 16%, transparent) 0%, transparent 64%),
            linear-gradient(180deg, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)) 0%, rgba(255, 255, 255, 0) 44%),
            ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          container-name: nodalia-climate;
          container-type: size;
          isolation: isolate;
          overflow: hidden;
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .climate-card::before {
          background: ${isOff
            ? "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0))"
            : `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 28%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .climate-card::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 28%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 54%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, transparent) 0%, transparent 68%);
          content: "";
          inset: 0;
          opacity: ${isOff ? "0" : "1"};
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .climate-card__content {
          display: flex;
          flex-direction: column;
          gap: ${contentColumnGap};
          height: auto;
          justify-content: flex-start;
          min-height: 0;
          padding: ${effectiveCardPadding};
          position: relative;
          z-index: 1;
        }

        .climate-card__hero {
          align-items: center;
          display: grid;
          flex: 0 0 auto;
          gap: ${effectiveCardGap};
          grid-template-columns: ${effectiveIconSize} minmax(0, 1fr);
          min-height: 0;
          width: 100%;
        }

        .climate-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--primary-text-color) 6%, transparent), transparent 60%),
            ${styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: calc(${styles.icon.size} * 0.5);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent),
            0 10px 26px rgba(0, 0, 0, 0.16);
          color: ${isOff ? styles.icon.off_color : styles.icon.on_color};
          cursor: pointer;
          display: inline-flex;
          height: ${effectiveIconSize};
          justify-content: center;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          transform: translateZ(0);
          transform-origin: center;
          transition:
            background 180ms ease,
            border-color 180ms ease,
            box-shadow 180ms ease,
            color 180ms ease,
            transform 160ms ease;
          will-change: transform;
          width: ${effectiveIconSize};
        }

        .climate-card__icon ha-icon {
          --mdc-icon-size: calc(${effectiveIconSize} * 0.44);
          display: inline-flex;
          height: calc(${effectiveIconSize} * 0.44);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${effectiveIconSize} * 0.44);
        }

        .climate-card__picture {
          border-radius: inherit;
          height: 100%;
          inset: 0;
          object-fit: cover;
          position: absolute;
          width: 100%;
        }

        .climate-card__unavailable-badge {
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

        .climate-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .climate-card__copy {
          display: grid;
          gap: ${tightLayout ? "8px" : "10px"};
          min-width: 0;
        }

        .climate-card__headline {
          align-items: start;
          display: grid;
          gap: ${tightLayout ? "8px" : "10px"};
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .climate-card__title {
          color: var(--primary-text-color);
          font-size: ${effectiveTitleSize};
          font-weight: 700;
          line-height: 1.14;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .climate-card__chips {
          align-items: center;
          display: flex;
          flex: 0 0 auto;
          flex-wrap: wrap;
          gap: ${tightLayout ? "8px" : "10px"};
          justify-content: flex-end;
          min-width: 0;
          max-width: 100%;
        }

        .climate-card__chip {
          align-items: center;
          backdrop-filter: blur(18px);
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
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
          transition: background 180ms ease, border-color 180ms ease, color 180ms ease, box-shadow 180ms ease;
          white-space: nowrap;
        }

        .climate-card__dial-wrap {
          align-items: center;
          display: flex;
          flex: 0 0 auto;
          justify-content: center;
          min-height: 0;
          padding-top: ${showStepControls ? "0" : (tightLayout ? "0" : "2px")};
          position: relative;
        }

        .climate-card__schedule-button {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          backdrop-filter: blur(18px);
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--primary-text-color) 5%, transparent), transparent 60%),
            color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${isOff ? styles.icon.off_color : styles.icon.on_color};
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: ${stepControlSize}px;
          justify-content: center;
          margin: 0;
          outline: none;
          padding: 0;
          transform: translateZ(0);
          transition:
            background 160ms ease,
            border-color 160ms ease,
            box-shadow 160ms ease,
            color 160ms ease,
            transform 160ms ease;
          width: ${stepControlSize}px;
          will-change: transform;
        }

        .climate-card__schedule-button--dial {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--primary-text-color) 6%, transparent), transparent 60%),
            ${styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          bottom: ${tightLayout ? "2px" : compactLayout ? "4px" : "6px"};
          left: ${tightLayout ? "2px" : compactLayout ? "4px" : "6px"};
          position: absolute;
          z-index: 4;
        }

        .climate-card__schedule-button--steps {
          position: relative;
        }

        .climate-card__schedule-button:hover {
          transform: translateY(-1px);
        }

        .climate-card__schedule-button ha-icon {
          --mdc-icon-size: calc(${stepControlSize}px * 0.42);
          display: inline-flex;
          height: calc(${stepControlSize}px * 0.42);
          width: calc(${stepControlSize}px * 0.42);
        }

        .climate-schedule-expanded {
          --climate-schedule-accent: var(--primary-color);
          inset: 0;
          opacity: 0;
          pointer-events: none;
          position: fixed;
          transition: opacity 220ms cubic-bezier(0.16, 0.84, 0.22, 1);
          z-index: 120;
        }

        .climate-schedule-expanded.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        .climate-schedule-expanded__backdrop {
          -webkit-backdrop-filter: blur(12px);
          backdrop-filter: blur(12px);
          background: rgba(0, 0, 0, 0.32);
          inset: 0;
          position: absolute;
        }

        .climate-schedule-expanded__panel {
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--climate-schedule-accent) 18%, rgba(255, 255, 255, 0.08)), rgba(255, 255, 255, 0.02)),
            color-mix(in srgb, var(--ha-card-background, var(--card-background-color)) 94%, rgba(255, 255, 255, 0.02));
          border: 1px solid color-mix(in srgb, var(--climate-schedule-accent) 34%, color-mix(in srgb, var(--primary-text-color) 9%, transparent));
          border-radius: 16px;
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28);
          color: var(--primary-text-color);
          display: grid;
          gap: 12px;
          isolation: isolate;
          left: 50%;
          max-height: min(92vh, 920px);
          max-width: min(100vw - 24px, 920px);
          overflow: hidden;
          padding: 14px;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: min(calc(100vw - 24px), 920px);
          z-index: 1;
        }

        .climate-schedule-expanded__toolbar {
          align-items: flex-start;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        .climate-schedule-expanded__toolbar-copy {
          display: grid;
          flex: 1 1 auto;
          gap: 4px;
          min-width: 0;
        }

        .climate-schedule-expanded__title {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .climate-schedule-expanded__hint {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
        }

        .climate-schedule-expanded__close {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: 32px;
          justify-content: center;
          margin: 0;
          padding: 0;
          width: 32px;
        }

        .climate-schedule-expanded__close ha-icon {
          --mdc-icon-size: 18px;
        }

        .climate-schedule-expanded__error {
          align-items: flex-start;
          background: color-mix(in srgb, var(--error-color, #db4437) 12%, transparent);
          border: 1px solid color-mix(in srgb, var(--error-color, #db4437) 35%, transparent);
          border-radius: 10px;
          color: var(--error-color, #db4437);
          display: flex;
          font-size: 12px;
          gap: 8px;
          line-height: 1.4;
          padding: 8px 10px;
        }

        .climate-schedule-expanded__error ha-icon {
          --mdc-icon-size: 16px;
          flex: 0 0 auto;
          margin-top: 1px;
        }

        .climate-schedule-expanded__enabled {
          align-items: center;
          cursor: pointer;
          display: inline-flex;
          gap: 10px;
          min-height: 34px;
        }

        .climate-schedule-expanded__enabled input {
          block-size: 1px;
          inline-size: 1px;
          margin: 0;
          opacity: 0;
          pointer-events: none;
          position: absolute;
        }

        .climate-schedule-expanded__enabled-switch {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          display: inline-flex;
          height: 22px;
          position: relative;
          width: 40px;
        }

        .climate-schedule-expanded__enabled-switch::before {
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

        .climate-schedule-expanded__enabled input:checked + .climate-schedule-expanded__enabled-switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }

        .climate-schedule-expanded__enabled input:checked + .climate-schedule-expanded__enabled-switch::before {
          transform: translateX(18px);
        }

        .climate-schedule-agenda {
          display: grid;
          gap: 12px;
          max-height: min(58vh, 560px);
          overflow: auto;
          overscroll-behavior: contain;
          padding-right: 2px;
          touch-action: pan-y;
          -webkit-overflow-scrolling: touch;
        }

        .climate-schedule-agenda__row {
          display: grid;
          gap: 8px;
        }

        .climate-schedule-agenda__row-head {
          align-items: center;
          display: grid;
          gap: 8px;
          grid-template-columns: minmax(72px, 92px) minmax(0, 1fr);
        }

        .climate-schedule-agenda__day-label {
          font-size: 13px;
          font-weight: 800;
          text-transform: capitalize;
        }

        .climate-schedule-agenda__day-add {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: 30px;
          justify-content: center;
          justify-self: end;
          margin: 0;
          padding: 0;
          width: 30px;
        }

        .climate-schedule-agenda__day-add ha-icon {
          --mdc-icon-size: 18px;
        }

        .climate-schedule-agenda__timeline-wrap {
          display: grid;
          gap: 4px;
          grid-column: 1 / -1;
        }

        .climate-schedule-agenda__track {
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 12px;
          height: 56px;
          overflow: hidden;
          position: relative;
          touch-action: none;
          user-select: none;
        }

        .climate-schedule-agenda__track-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          height: 100%;
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .climate-schedule-agenda__track-grid span {
          border-right: 1px dashed color-mix(in srgb, var(--primary-text-color) 10%, transparent);
        }

        .climate-schedule-agenda__track-grid span:last-child {
          border-right: 0;
        }

        .climate-schedule-agenda__blocks {
          height: 100%;
          inset: 0;
          position: absolute;
          z-index: 1;
        }

        .climate-schedule-agenda__track-empty {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 600;
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          white-space: nowrap;
        }

        .climate-schedule-agenda__axis {
          color: var(--secondary-text-color);
          display: grid;
          font-size: 10px;
          font-weight: 700;
          grid-template-columns: repeat(5, 1fr);
          letter-spacing: 0.02em;
          text-align: center;
        }

        .climate-schedule-agenda__block {
          align-items: stretch;
          background: color-mix(in srgb, var(--schedule-accent, var(--climate-schedule-accent)) 78%, transparent);
          border: 1px solid color-mix(in srgb, var(--schedule-accent, var(--climate-schedule-accent)) 42%, transparent);
          border-radius: 10px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
          cursor: pointer;
          display: grid;
          grid-template-columns: 8px minmax(0, 1fr) 8px;
          height: calc(100% - 8px);
          left: var(--block-left, 0%);
          min-width: 44px;
          overflow: hidden;
          position: absolute;
          top: 4px;
          touch-action: none;
          width: var(--block-width, 20%);
          z-index: 1;
        }

        .climate-schedule-agenda__block.is-selected {
          border-color: color-mix(in srgb, var(--primary-text-color) 28%, var(--schedule-accent, var(--climate-schedule-accent)));
          box-shadow:
            0 0 0 2px color-mix(in srgb, var(--schedule-accent, var(--climate-schedule-accent)) 35%, transparent),
            inset 0 1px 0 rgba(255, 255, 255, 0.24);
          z-index: 2;
        }

        .climate-schedule-agenda__block:active {
          cursor: grabbing;
        }

        .climate-schedule-agenda__block-grip {
          cursor: ew-resize;
          display: block;
          flex: 0 0 10px;
          min-height: 100%;
          touch-action: none;
          z-index: 2;
        }

        .climate-schedule-agenda__block-body {
          align-items: center;
          display: flex;
          flex-direction: column;
          gap: 1px;
          justify-content: center;
          min-width: 0;
          overflow: hidden;
          padding: 0 2px;
          pointer-events: none;
        }

        .climate-schedule-agenda__block-time {
          font-size: 9px;
          font-weight: 800;
          line-height: 1.1;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .climate-schedule-agenda__block-temp {
          font-size: 10px;
          font-weight: 700;
          line-height: 1.1;
          opacity: 0.92;
        }

        .climate-schedule-agenda__editor {
          display: none;
          gap: 8px;
          grid-column: 1 / -1;
          grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
        }

        .climate-schedule-agenda__editor.is-visible {
          display: grid;
        }

        .climate-schedule-agenda__editor-field {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .climate-schedule-agenda__editor-field--temp {
          grid-column: 1 / -1;
        }

        .climate-schedule-agenda__editor-field > span {
          color: var(--secondary-text-color);
          font-size: 10px;
          font-weight: 700;
        }

        .climate-schedule-agenda__editor-field input {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 10px;
          color: var(--primary-text-color);
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          min-height: 36px;
          padding: 6px 8px;
          width: 100%;
        }

        .climate-schedule-agenda__editor-remove {
          align-items: center;
          appearance: none;
          align-self: end;
          background: color-mix(in srgb, var(--error-color, #db4437) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--error-color, #db4437) 28%, transparent);
          border-radius: 999px;
          color: var(--error-color, #db4437);
          cursor: pointer;
          display: inline-flex;
          height: 36px;
          justify-content: center;
          margin: 0;
          padding: 0;
          width: 36px;
        }

        .climate-schedule-agenda__editor-remove ha-icon {
          --mdc-icon-size: 18px;
        }

        .climate-schedule-expanded__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .climate-schedule-expanded__btn {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          min-height: 36px;
          padding: 0 14px;
        }

        .climate-schedule-expanded__btn:disabled {
          cursor: default;
          opacity: 0.5;
        }

        .climate-schedule-expanded__btn--primary {
          background: color-mix(in srgb, var(--climate-schedule-accent) 22%, transparent);
          border-color: color-mix(in srgb, var(--climate-schedule-accent) 38%, var(--divider-color));
        }

        @media (max-width: 640px) {
          .climate-schedule-expanded__panel {
            border-radius: 14px;
            max-height: 94vh;
            max-width: min(100vw - 16px, 920px);
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: min(calc(100vw - 16px), 920px);
          }

          .climate-schedule-agenda__row-head {
            grid-template-columns: minmax(64px, 80px) minmax(0, 1fr);
          }
        }

        .climate-card__dial {
          --climate-angle: ${dialAngle}deg;
          --climate-progress-length: ${progressLength};
          --climate-dial-size: ${dialSizePx}px;
          --climate-thumb-size: ${thumbSizePx}px;
          align-self: center;
          aspect-ratio: 1;
          -webkit-backdrop-filter: blur(18px);
          backdrop-filter: blur(18px);
          background: ${dialSurfaceBackground};
          border: 1px solid color-mix(in srgb, ${accentColor} 10%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 50%;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent),
            0 18px 38px rgba(0, 0, 0, 0.16);
          box-sizing: border-box;
          cursor: ${supportsTargetTemperature && !isRangeMode ? "grab" : "default"};
          flex-shrink: 0;
          height: auto;
          max-width: 100%;
          position: relative;
          touch-action: none;
          transform: translateZ(0) scale(1);
          transform-origin: center;
          transition:
            background 220ms cubic-bezier(0.22, 0.84, 0.26, 1),
            border-color 220ms cubic-bezier(0.22, 0.84, 0.26, 1),
            box-shadow 220ms cubic-bezier(0.22, 0.84, 0.26, 1),
            transform 220ms cubic-bezier(0.22, 0.84, 0.26, 1);
          user-select: none;
          -webkit-user-select: none;
          will-change: transform, box-shadow;
          width: min(var(--climate-dial-size), 100%);
        }

        @supports (width: 1cqw) {
          .climate-card__dial {
            width: min(var(--climate-dial-size), 100%, 94cqw);
          }
        }

        .climate-card__dial:active {
          cursor: ${supportsTargetTemperature && !isRangeMode ? "grabbing" : "default"};
        }

        .climate-card__dial--dual-range {
          cursor: default;
        }

        .climate-card__dial--no-setpoint {
          cursor: default;
        }

        .climate-card__dial--no-setpoint .climate-card__dial-hit {
          opacity: 0;
          pointer-events: none;
        }

        .climate-card__dial--no-setpoint .climate-card__dial-thumb:not(.climate-card__dial-current-marker) {
          opacity: 0;
          pointer-events: none;
        }

        .climate-card__dial--no-setpoint .climate-card__dial-progress {
          opacity: 0.2;
        }

        .climate-card__dial-no-setpoint {
          color: var(--secondary-text-color);
          font-size: 0.9em;
          font-weight: 600;
          letter-spacing: 0.01em;
          line-height: 1.25;
          text-align: center;
        }

        .climate-card__dial--dual-range .climate-card__dial-thumb--heat,
        .climate-card__dial--dual-range .climate-card__dial-thumb--cool {
          cursor: grab;
          pointer-events: auto;
        }

        .climate-card__dial--dual-range .climate-card__dial-thumb--heat {
          left: var(--climate-thumb-heat-left, 50%);
          top: var(--climate-thumb-heat-top, 50%);
          z-index: 3;
        }

        .climate-card__dial--dual-range .climate-card__dial-thumb--cool {
          left: var(--climate-thumb-cool-left, 50%);
          top: var(--climate-thumb-cool-top, 50%);
          z-index: 4;
        }

        .climate-card__dial--dual-range .climate-card__dial-thumb--cool::after {
          background: color-mix(in srgb, ${dialCoolStroke} 22%, rgba(255, 255, 255, 0.96));
        }

        .climate-card__dial--dual-range .climate-card__dial-thumb--heat::after {
          background: color-mix(in srgb, ${dialHeatStroke} 18%, rgba(255, 255, 255, 0.96));
        }

        .climate-card__dial--dual-range .climate-card__dial-thumb--range-selected {
          box-shadow:
            0 0 0 2px color-mix(in srgb, ${accentColor} 50%, transparent),
            0 0 0 9px color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 0 26px color-mix(in srgb, ${accentColor} 38%, transparent),
            0 10px 26px rgba(0, 0, 0, 0.22);
          transform: translate(-50%, -50%) scale(1.1);
          z-index: 6;
        }

        .climate-card__dial--dual-range .climate-card__dial-thumb--heat.climate-card__dial-thumb--range-selected::after {
          box-shadow: 0 0 0 2px color-mix(in srgb, ${dialHeatStroke} 55%, transparent);
        }

        .climate-card__dial--dual-range .climate-card__dial-thumb--cool.climate-card__dial-thumb--range-selected::after {
          box-shadow: 0 0 0 2px color-mix(in srgb, ${dialCoolStroke} 55%, transparent);
        }

        .climate-card__dial-progress-heat,
        .climate-card__dial-progress-cool {
          fill: none;
          stroke-linecap: round;
          stroke-width: ${dialStrokePx};
          transform: rotate(${DIAL_START_ANGLE}deg);
          transform-origin: ${DIAL_VIEWBOX_SIZE / 2}px ${DIAL_VIEWBOX_SIZE / 2}px;
        }

        .climate-card__dial-progress-heat {
          stroke: ${dialHeatStroke};
          stroke-dasharray: var(--climate-heat-progress, 0) ${DIAL_CIRCUMFERENCE};
          opacity: 0.94;
          transition:
            stroke-dasharray var(--climate-card-dial-duration) ease-out,
            opacity 180ms ease;
        }

        .climate-card__dial-progress-cool {
          stroke: ${dialCoolStroke};
          stroke-dasharray: var(--climate-cool-progress, 0) ${DIAL_CIRCUMFERENCE};
          stroke-dashoffset: var(--climate-cool-dashoffset, 0px);
          opacity: 0.94;
          transition:
            stroke-dasharray var(--climate-card-dial-duration) ease-out,
            stroke-dashoffset var(--climate-card-dial-duration) ease-out,
            opacity 180ms ease;
        }

        .climate-card__dial-svg {
          display: block;
          height: 100%;
          overflow: visible;
          width: 100%;
        }

        .climate-card__dial-track,
        .climate-card__dial-hit,
        .climate-card__dial-progress {
          fill: none;
          stroke-dasharray: ${DIAL_VISIBLE_LENGTH} ${DIAL_HIDDEN_LENGTH};
          stroke-linecap: round;
          stroke-width: ${dialStrokePx};
          transform: rotate(${DIAL_START_ANGLE}deg);
          transform-origin: ${DIAL_VIEWBOX_SIZE / 2}px ${DIAL_VIEWBOX_SIZE / 2}px;
        }

        .climate-card__dial-track {
          stroke: ${dialTrackColor};
        }

        .climate-card__dial-hit {
          cursor: ${supportsTargetTemperature ? "grab" : "default"};
          pointer-events: stroke;
          stroke: transparent;
          stroke-width: ${dialStrokePx + 22};
        }

        .climate-card__dial-progress {
          filter: drop-shadow(0 0 0 transparent);
          opacity: 0.94;
          stroke: ${accentColor};
          stroke-dasharray: var(--climate-progress-length) ${DIAL_CIRCUMFERENCE};
          transition:
            stroke var(--climate-card-dial-duration) ease,
            stroke-dasharray var(--climate-card-dial-duration) ease-out,
            filter 180ms ease,
            opacity 180ms ease;
        }

        .climate-card__dial-thumb {
          background: transparent;
          border-radius: 50%;
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--primary-text-color) 4%, transparent),
            0 0 0 6px color-mix(in srgb, var(--primary-text-color) 5%, transparent),
            0 0 18px color-mix(in srgb, ${accentColor} 12%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.18);
          height: var(--climate-thumb-size);
          left: var(--climate-thumb-left, 50%);
          pointer-events: auto;
          position: absolute;
          top: var(--climate-thumb-top, 50%);
          transform: translate(-50%, -50%) scale(1);
          transition:
            left var(--climate-card-dial-duration) ease-out,
            top var(--climate-card-dial-duration) ease-out,
            transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1),
            border-color var(--climate-card-dial-duration) ease,
            box-shadow var(--climate-card-dial-duration) ease,
            background var(--climate-card-dial-duration) ease;
          width: var(--climate-thumb-size);
          z-index: 2;
        }

        .climate-card__dial-thumb::before {
          -webkit-backdrop-filter: blur(16px);
          backdrop-filter: blur(16px);
          background: radial-gradient(circle, color-mix(in srgb, var(--primary-text-color) 14%, transparent) 0%, color-mix(in srgb, var(--primary-text-color) 8%, transparent) 38%, color-mix(in srgb, var(--primary-text-color) 3%, transparent) 58%, transparent 76%);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 50%;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          content: "";
          inset: 0;
          position: absolute;
        }

        .climate-card__dial-thumb::after {
          content: "";
          height: 82%;
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 82%;
          background: rgba(255, 255, 255, 0.96);
          border-radius: 50%;
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary-text-color) 6%, transparent);
        }

        .climate-card__dial-current-marker {
          background: rgba(255, 255, 255, 0.94);
          border: 2px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          border-radius: 50%;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          height: calc(var(--climate-thumb-size) * 0.5);
          left: var(--climate-current-left, 50%);
          opacity: ${currentAngle === null ? "0" : "1"};
          pointer-events: none;
          position: absolute;
          top: var(--climate-current-top, 50%);
          transform: translate(-50%, -50%);
          transition:
            left var(--climate-card-dial-duration) ease-out,
            top var(--climate-card-dial-duration) ease-out,
            opacity var(--climate-card-dial-duration) ease;
          width: calc(var(--climate-thumb-size) * 0.5);
          z-index: 1;
        }

        .climate-card__dial.is-dragging .climate-card__dial-progress,
        .climate-card__dial.is-dragging .climate-card__dial-progress-heat,
        .climate-card__dial.is-dragging .climate-card__dial-progress-cool,
        .climate-card__dial.is-dragging .climate-card__dial-thumb,
        .climate-card__dial.is-dragging .climate-card__dial-thumb--heat,
        .climate-card__dial.is-dragging .climate-card__dial-thumb--cool,
        .climate-card__dial.is-dragging .climate-card__dial-current-marker {
          transition: none !important;
        }

        .climate-card__dial.is-dragging {
          background:
            radial-gradient(circle at 24% 18%, color-mix(in srgb, var(--primary-text-color) 10%, transparent), transparent 30%),
            linear-gradient(
              180deg,
              color-mix(in srgb, ${styles.dial.background} 90%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)) 0%,
              color-mix(in srgb, ${styles.dial.background} 94%, rgba(0, 0, 0, 0.14)) 100%
            );
          border-color: color-mix(in srgb, ${accentColor} 18%, color-mix(in srgb, var(--primary-text-color) 10%, transparent));
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 24px 44px rgba(0, 0, 0, 0.2);
          transform: translateZ(0) scale(1.03);
        }

        .climate-card__dial.is-dragging .climate-card__dial-progress {
          filter: drop-shadow(0 0 10px color-mix(in srgb, ${accentColor} 24%, transparent));
          opacity: 1;
        }

        .climate-card__dial.is-dragging .climate-card__dial-progress-heat {
          filter: drop-shadow(0 0 10px color-mix(in srgb, ${dialHeatStroke} 38%, transparent));
          opacity: 1;
        }

        .climate-card__dial.is-dragging .climate-card__dial-progress-cool {
          filter: drop-shadow(0 0 10px color-mix(in srgb, ${dialCoolStroke} 38%, transparent));
          opacity: 1;
        }

        .climate-card__dial.is-dragging .climate-card__dial-thumb,
        .climate-card__dial.is-dragging .climate-card__dial-thumb--heat,
        .climate-card__dial.is-dragging .climate-card__dial-thumb--cool {
          animation: climate-card-dial-thumb-pop 260ms cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
          background: transparent;
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 0 0 7px color-mix(in srgb, ${accentColor} 12%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)),
            0 0 22px color-mix(in srgb, ${accentColor} 18%, transparent),
            0 18px 34px rgba(0, 0, 0, 0.24);
          transform: translate(-50%, -50%) scale(1.15);
        }

        .climate-card__dial-center {
          align-content: ${dialCenterAlignContent};
          display: grid;
          gap: ${dialCenterGridGap};
          inset: ${dialCenterInsetCss};
          justify-items: center;
          pointer-events: auto;
          position: absolute;
          text-align: center;
          transform: scale(1);
          transition:
            opacity 220ms cubic-bezier(0.22, 0.84, 0.26, 1),
            transform 220ms cubic-bezier(0.22, 0.84, 0.26, 1);
          z-index: 1;
        }

        .climate-card__target {
          color: var(--primary-text-color);
          display: inline-block;
          font-size: ${effectiveTargetSize};
          font-weight: 500;
          letter-spacing: -0.06em;
          line-height: 0.94;
          min-height: calc(${effectiveTargetSize} * 0.94);
          min-width: 0;
          padding-right: calc(${effectiveTargetSize} * 0.34);
          padding-top: ${targetBlockPaddingTop};
          pointer-events: none;
          position: relative;
          transition: color var(--climate-card-dial-duration) ease;
          white-space: nowrap;
        }

        .climate-card__dial.is-dragging .climate-card__dial-center {
          transform: scale(1.02);
        }

        .climate-card__target-value {
          display: inline-block;
          transition: opacity 140ms ease;
        }

        .climate-card__target-unit {
          align-items: flex-start;
          color: var(--primary-text-color);
          display: inline-flex;
          font-size: calc(${effectiveTargetSize} * 0.24);
          font-weight: 500;
          gap: 0.04em;
          letter-spacing: 0;
          line-height: 1;
          opacity: 0.92;
          position: absolute;
          right: 0;
          top: ${targetUnitTopEm};
        }

        .climate-card__target-degree,
        .climate-card__target-scale {
          display: inline-block;
          line-height: 1;
        }

        .climate-card__target-degree {
          transform: translateY(-0.06em);
        }

        .climate-card__divider {
          background: color-mix(in srgb, var(--primary-text-color) 18%, transparent);
          border-radius: 999px;
          height: 1px;
          pointer-events: none;
          width: clamp(84px, 72%, 148px);
        }

        .climate-card__dial-meta {
          align-items: center;
          color: var(--primary-text-color);
          display: flex;
          flex-wrap: wrap;
          font-size: ${effectiveCurrentSize};
          gap: ${tightLayout ? "10px" : "12px"};
          justify-content: center;
          line-height: 1;
          pointer-events: none;
        }

        .climate-card__dial-range {
          font-size: calc(${effectiveCurrentSize} * 0.92);
          font-weight: 500;
          letter-spacing: -0.02em;
          max-width: 100%;
          text-align: center;
        }

        .climate-card__dial-action {
          align-items: center;
          display: inline-flex;
          justify-content: center;
        }

        .climate-card__dial-action ha-icon {
          --mdc-icon-size: ${tightLayout ? "15px" : compactLayout ? "16px" : "17px"};
          color: ${accentColor};
          display: inline-flex;
          height: ${tightLayout ? "15px" : compactLayout ? "16px" : "17px"};
          transition: color var(--climate-card-dial-duration) ease;
          width: ${tightLayout ? "15px" : compactLayout ? "16px" : "17px"};
        }

        .climate-card__dial-controls {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: var(--climate-mode-gap, ${tightLayout ? "8px" : "10px"});
          justify-content: center;
          margin-top: 2px;
          pointer-events: auto;
          width: 100%;
        }

        .climate-card__dial-controls--stacked {
          flex-direction: column;
          flex-wrap: nowrap;
          gap: ${stackedModeControlsGap};
        }

        .climate-card__dial-controls-row {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: var(--climate-mode-gap, ${tightLayout ? "8px" : "10px"});
          justify-content: center;
          width: 100%;
        }

        .climate-card__dial-controls-row--secondary {
          justify-content: center;
        }

        .climate-card__mode-button,
        .climate-card__step-button {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          justify-content: center;
          margin: 0;
          outline: none;
          padding: 0;
          pointer-events: auto;
          position: relative;
          transform: translateZ(0);
          transform-origin: center;
          transition:
            background 160ms ease,
            border-color 160ms ease,
            transform 160ms ease,
            box-shadow 160ms ease,
            color 160ms ease;
          will-change: transform;
        }

        .climate-card__mode-button {
          backdrop-filter: blur(18px);
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--primary-text-color) 6%, transparent), transparent 60%),
            color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          height: ${modeControlRenderPx}px;
          width: ${modeControlRenderPx}px;
        }

        .climate-card__mode-button:hover,
        .climate-card__step-button:hover {
          transform: translateY(-1px);
        }

        :is(.climate-card__icon, .climate-card__schedule-button, .climate-card__mode-button, .climate-card__step-button):active:not(:disabled),
        :is(.climate-card__icon, .climate-card__schedule-button, .climate-card__mode-button, .climate-card__step-button).is-pressing:not(:disabled) {
          animation: climate-card-button-bounce var(--climate-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .climate-card__mode-button--power {
          border-color: color-mix(in srgb, ${accentColor} 32%, color-mix(in srgb, var(--primary-text-color) 10%, transparent));
        }

        .climate-card__mode-button.is-active {
          background: color-mix(in srgb, ${accentColor} 18%, ${styles.control.accent_background});
          border-color: color-mix(in srgb, ${accentColor} 48%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: ${styles.control.accent_color};
        }

        .climate-card__mode-button ha-icon {
          --mdc-icon-size: calc(${modeControlRenderPx}px * 0.46);
          display: inline-flex;
          height: calc(${modeControlRenderPx}px * 0.46);
          width: calc(${modeControlRenderPx}px * 0.46);
        }

        .climate-card__steps {
          display: flex;
          flex: 0 0 auto;
          gap: ${tightLayout ? "10px" : compactLayout ? "12px" : "14px"};
          justify-content: center;
        }

        .climate-card__hero--entering {
          animation: climate-card-fade-up calc(var(--climate-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .climate-card__dial-wrap--entering {
          animation: climate-card-fade-up var(--climate-card-content-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 40ms;
        }

        .climate-card__dial-wrap--entering .climate-card__dial {
          animation: climate-card-dial-bloom calc(var(--climate-card-content-duration) * 1.02) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .climate-card__dial-wrap--entering .climate-card__dial-center {
          animation: climate-card-dial-center-bloom calc(var(--climate-card-content-duration) * 0.92) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 70ms;
        }

        .climate-card__steps--entering {
          animation: climate-card-fade-up calc(var(--climate-card-content-duration) * 0.88) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 90ms;
        }

        .climate-card__step-button {
          backdrop-filter: blur(18px);
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--primary-text-color) 5%, transparent), transparent 60%),
            color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          color: var(--primary-text-color);
          font-size: calc(${stepControlSize}px * 0.8);
          height: ${stepControlSize}px;
          line-height: 1;
          width: ${stepControlSize}px;
        }

        .climate-card__step-button span {
          align-items: center;
          display: inline-flex;
          font-size: calc(${stepControlSize}px * 0.72);
          height: 100%;
          justify-content: center;
          line-height: 1;
          transform: translateY(-0.04em);
          width: 100%;
        }

        @keyframes climate-card-button-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.1);
          }
          72% {
            transform: scale(1.03);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes climate-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.965);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes climate-card-dial-bloom {
          0% {
            opacity: 0;
            transform: translateZ(0) scale(0.95);
            box-shadow:
              inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 2%, transparent),
              0 10px 24px rgba(0, 0, 0, 0.08);
          }
          55% {
            opacity: 1;
            transform: translateZ(0) scale(1.015);
            box-shadow:
              inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
              0 22px 42px rgba(0, 0, 0, 0.16);
          }
          100% {
            opacity: 1;
            transform: translateZ(0) scale(1);
            box-shadow:
              inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent),
              0 18px 38px rgba(0, 0, 0, 0.16);
          }
        }

        @keyframes climate-card-dial-center-bloom {
          0% {
            opacity: 0;
            transform: scale(0.96);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes climate-card-dial-thumb-pop {
          0% {
            transform: translate(-50%, -50%) scale(1);
          }
          48% {
            transform: translate(-50%, -50%) scale(1.24);
          }
          72% {
            transform: translate(-50%, -50%) scale(1.09);
          }
          100% {
            transform: translate(-50%, -50%) scale(1.15);
          }
        }

        ${animations.enabled ? "" : `
        ha-card,
        .climate-card,
        .climate-card * {
          animation: none !important;
          transition: none !important;
        }
        `}

        @media (max-width: 560px) {
          .climate-card__headline {
            grid-template-columns: minmax(0, 1fr);
          }

          .climate-card__chips {
            justify-content: flex-start;
          }
        }
      </style>
      <ha-card class="climate-card climate-card--${escapeHtml(compactLevel)}" style="--accent-color:${escapeHtml(accentColor)};">
        <div class="climate-card__content" data-climate-card="root">
          <div class="climate-card__hero ${shouldAnimateEntrance ? "climate-card__hero--entering" : ""}">
            <button
              type="button"
              class="climate-card__icon"
              data-climate-action="toggle"
              aria-label="${escapeHtml(toggleAriaLabel)}"
            >
              ${entityPicture
                ? `<img class="climate-card__picture" src="${escapeHtml(entityPicture)}" alt="" loading="lazy" />`
                : `<ha-icon icon="${escapeHtml(icon)}"></ha-icon>`}
              ${showUnavailableBadge ? `<span class="climate-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            <div class="climate-card__copy">
              <div class="climate-card__headline">
                <div class="climate-card__title">${escapeHtml(title)}</div>
                ${chips.length ? `<div class="climate-card__chips">${chips.join("")}</div>` : ""}
              </div>
            </div>
          </div>

          <div class="climate-card__dial-wrap ${shouldAnimateEntrance ? "climate-card__dial-wrap--entering" : ""}">
            ${scheduleButtonDialMarkup}
            <div
              class="climate-card__dial${isRangeMode ? " climate-card__dial--dual-range" : ""}${noSetpointDial ? " climate-card__dial--no-setpoint" : ""}"
              data-climate-control="dial"
              role="${isRangeMode || noSetpointDial ? "group" : "slider"}"
              aria-label="${escapeHtml(dialAriaLabel)}"
              ${!isRangeMode && !noSetpointDial && ariaDialValue !== null ? `aria-valuemin="${temperatureRange.min}" aria-valuemax="${temperatureRange.max}" aria-valuenow="${ariaDialValue}"` : ""}
              ${noSetpointDial ? "aria-disabled=\"true\"" : ""}
              style="${dialInlineVars}"
            >
              <svg class="climate-card__dial-svg" viewBox="0 0 ${DIAL_VIEWBOX_SIZE} ${DIAL_VIEWBOX_SIZE}" aria-hidden="true">
                ${dialSvgInner}
              </svg>
              ${dialThumbsInner}
              <div class="climate-card__dial-center">
                <div class="climate-card__target">
                  <span class="climate-card__target-value" data-climate-readout="target">${dialPrimaryReadoutHtml}</span>
                  <span class="climate-card__target-unit"><span class="climate-card__target-degree">°</span><span class="climate-card__target-scale">${escapeHtml(tempScale)}</span></span>
                </div>
                <div class="climate-card__divider"></div>
                <div class="climate-card__dial-meta">
                  ${dialMetaHtml}
                  ${dialActionHtml}
                </div>
                ${dialControlsMarkup}
              </div>
            </div>
          </div>

          ${
            showStepControls
              ? `
                <div class="climate-card__steps ${shouldAnimateEntrance ? "climate-card__steps--entering" : ""}">
                  <button
                    type="button"
                    class="climate-card__step-button"
                    data-climate-action="decrease"
                    aria-label="Decrease temperature"
                  >
                    <span>&minus;</span>
                  </button>
                  ${scheduleButtonStepsMarkup}
                  <button
                    type="button"
                    class="climate-card__step-button"
                    data-climate-action="increase"
                    aria-label="Increase temperature"
                  >
                    <span>+</span>
                  </button>
                </div>
              `
              : ""
          }
        </div>
      </ha-card>
      ${scheduleComposerMarkup}
    `;

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 120);
    }
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaClimateCard);
}

class NodaliaClimateCardEditorLegacy extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showTapActionsSection = false;
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
  }

  _attachEditorShadowListeners() {
    if (this._editorShadowListenersAttached || !this.shadowRoot) {
      return;
    }
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this._editorShadowListenersAttached = true;
  }

  _detachEditorShadowListeners() {
    if (!this._editorShadowListenersAttached || !this.shadowRoot) {
      return;
    }
    this.shadowRoot.removeEventListener("input", this._onShadowInput);
    this.shadowRoot.removeEventListener("change", this._onShadowInput);
    this.shadowRoot.removeEventListener("click", this._onShadowClick);
    this._editorShadowListenersAttached = false;
  }

  connectedCallback() {
    this._attachEditorShadowListeners();
  }

  disconnectedCallback() {
    this._detachEditorShadowListeners();
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
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._render();
    this._restoreFocusState(focusState);
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id => id.startsWith("climate."));
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
      config: compactConfig(window.NodaliaUtils.stripEqualToDefaults(nextConfig, DEFAULT_CONFIG) ?? {}),
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

  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    const hass = this._hass ?? this.hass;
    return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", s);
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
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
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-field="${escapeHtml(field)}"
          data-value-type="boolean"
          ${checked ? "checked" : ""}
        />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(tLabel)}</span>
      </label>
    `;
  }

  _renderSelectField(label, field, value, options) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options
            .map(option => `
              <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
                ${escapeHtml(this._editorLabel(option.label))}
              </option>
            `)
            .join("")}
        </select>
      </label>
    `;
  }

  _onShadowClick(event) {
    const toggleButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.editorToggle);
    if (!toggleButton) return;
    event.preventDefault();
    event.stopPropagation();
    if (toggleButton.dataset.editorToggle === "tap_actions") {
      this._showTapActionsSection = !this._showTapActionsSection;
      this._render();
    }
  }

  _getEntityOptionsMarkup() {
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const climateIds = Object.keys(this._hass?.states || {})
      .filter(entityId => entityId.startsWith("climate."))
      .sort((left, right) => left.localeCompare(right, sortLoc));

    return `
      <datalist id="climate-card-entities">
        ${climateIds.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";
    const tapAction = config.tap_action || "more-info";
    const holdAction = config.hold_action || "more-info";
    const doubleTapAction = config.double_tap_action || "none";

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

        .editor-chip-radius__options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .editor-chip-radius__option {
          align-items: center;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 12px;
          cursor: pointer;
          display: inline-flex;
          gap: 8px;
          padding: 8px 12px;
        }

        .editor-chip-radius__option:has(input:checked) {
          background: color-mix(in srgb, var(--primary-color) 10%, transparent);
          border-color: var(--primary-color);
        }

        .editor-chip-radius__option input[type="radio"] {
          accent-color: var(--primary-color);
          appearance: auto;
          margin: 0;
          min-height: auto;
          padding: 0;
          width: auto;
        }


        .editor-field:has(> .editor-control-host[data-mounted-control="entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="entity-picker"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="vacuum-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="select-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="sensor-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="light-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="fan-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="humidifier-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="icon-picker"]),
        .editor-field:has(> ha-icon-picker) {
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
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.entity.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.legacy_general_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.entity.entity_main", "entity", config.entity, {
              placeholder: "climate.salon",
            })}
            ${this._renderTextField("ed.entity.name", "name", config.name, {
              placeholder: "Salon",
            })}
            ${this._renderTextField("ed.entity.icon", "icon", config.icon, {
              placeholder: "mdi:thermostat",
            })}
            ${this._renderCheckboxField("ed.entity.show_entity_picture", "show_entity_picture", config.show_entity_picture === true)}
            ${this._renderTextField("ed.entity.entity_picture", "entity_picture", config.entity_picture, {
              placeholder: "/local/climate.png",
            })}
          </div>
        </section>

        <section class="editor-section">
          ${window.NodaliaUtils.renderEditorCollapsibleSectionHeaderHtml({
            escapeHtml,
            editorLabel: key => this._editorLabel(key),
            titleKey: "ed.light.tap_actions_section_title",
            hintKey: "ed.light.tap_actions_section_hint",
            toggleId: "tap_actions",
            expanded: this._showTapActionsSection === true,
          })}
          ${
            this._showTapActionsSection
              ? `
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.climate.tap_action",
              "tap_action",
              tapAction,
              [
                { value: "more-info", label: "ed.climate.tap_more_info" },
                { value: "none", label: "ed.climate.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.climate.hold_action",
              "hold_action",
              holdAction,
              [
                { value: "more-info", label: "ed.climate.tap_more_info" },
                { value: "none", label: "ed.climate.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.climate.double_tap_action",
              "double_tap_action",
              doubleTapAction,
              [
                { value: "none", label: "ed.climate.tap_none" },
                { value: "more-info", label: "ed.climate.tap_more_info" },
              ],
              { fullWidth: true },
            )}
          </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.climate.display_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.display_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.climate.main_temperature",
              "display.main_temperature",
              config.display?.main_temperature === "current" ? "current" : "target",
              [
                { value: "target", label: "ed.climate.main_temperature_target" },
                { value: "current", label: "ed.climate.main_temperature_current" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.visibility_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.visibility_hint_legacy"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.climate.legacy_show_state_chip", "show_state_chip", config.show_state_chip !== false)}
            ${this._renderCheckboxField("ed.climate.legacy_show_current_temp_chip", "show_current_temperature_chip", config.show_current_temperature_chip !== false)}
            ${this._renderCheckboxField("ed.climate.legacy_show_humidity_chip", "show_humidity_chip", config.show_humidity_chip !== false)}
            ${this._renderCheckboxField("ed.climate.legacy_show_mode_buttons", "show_mode_buttons", config.show_mode_buttons !== false)}
            ${this._renderCheckboxField("ed.climate.legacy_show_step_controls", "show_step_controls", config.show_step_controls !== false)}
            ${this._renderCheckboxField("ed.climate.schedule_button", "show_schedule_button", config.show_schedule_button !== false)}
            ${this._renderCheckboxField("ed.media_player.show_unavailable_badge", "show_unavailable_badge", config.show_unavailable_badge !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.climate.schedule_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.schedule_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderTextField("ed.climate.schedule_webhook", "setpoint_schedule_webhook", config.setpoint_schedule_webhook || "", {
              placeholder: "nodalia_climate_setpoint_schedule",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.climate.schedule_helper", "setpoint_schedule_helper", config.setpoint_schedule_helper || "", {
              placeholder: "input_text.nodalia_climate_schedule_salon",
              fullWidth: true,
            })}
            ${this._renderSelectField(
              "ed.climate.schedule_week_starts_on",
              "setpoint_schedule_week_starts_on",
              config.setpoint_schedule_week_starts_on === "sunday" ? "sunday" : "monday",
              [
                { value: "monday", label: "ed.climate.schedule_week_starts_monday" },
                { value: "sunday", label: "ed.climate.schedule_week_starts_sunday" },
              ],
            )}
            ${this._renderCheckboxField(
              "ed.calendar.allow_webhooks_non_admin",
              "security.allow_webhooks_for_non_admin",
              config.security?.allow_webhooks_for_non_admin !== false,
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.haptics_hint_legacy"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.entity.enable_haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("ed.entity.fallback_vibrate", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "ed.entity.haptic_style",
              "haptics.style",
              hapticStyle,
              [
                { value: "selection", label: "ed.person.haptic_selection" },
                { value: "light", label: "ed.person.haptic_light" },
                { value: "medium", label: "ed.person.haptic_medium" },
                { value: "heavy", label: "ed.person.haptic_heavy" },
                { value: "success", label: "ed.person.haptic_success" },
                { value: "warning", label: "ed.person.haptic_warning" },
                { value: "failure", label: "ed.person.haptic_failure" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.climate.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.styles_hint_legacy"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("ed.person.style_card_bg", "styles.card.background", config.styles.card.background)}
            ${this._renderTextField("ed.person.style_card_border", "styles.card.border", config.styles.card.border)}
            ${window.NodaliaUtils.renderEditorCardBorderRadiusHtml({
              escapeHtml,
              field: "styles.card.border_radius",
              value: config.styles?.card?.border_radius,
              tHeading: this._editorLabel("ed.entity.style_card_radius_presets"),
              labels: {
                pill: this._editorLabel("ed.entity.chip_radius_pill"),
                soft: this._editorLabel("ed.entity.chip_radius_soft"),
                round: this._editorLabel("ed.entity.chip_radius_round"),
                square: this._editorLabel("ed.entity.chip_radius_square"),
              },
            })}
            <div class="editor-section__hint editor-field--full" style="margin-top: -6px;">${escapeHtml(this._editorLabel("ed.entity.style_card_radius_yaml_hint"))}</div>
            ${this._renderTextField("ed.person.style_card_shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
            ${this._renderTextField("ed.person.style_card_padding", "styles.card.padding", config.styles.card.padding)}
            ${this._renderTextField("ed.person.style_card_gap", "styles.card.gap", config.styles.card.gap)}
            ${this._renderTextField("ed.circular_gauge.entity_bubble_size", "styles.icon.size", config.styles.icon.size)}
            ${this._renderTextField("ed.person.style_title_size", "styles.title_size", config.styles.title_size)}
            ${this._renderTextField("ed.climate.current_temp_size", "styles.current_size", config.styles.current_size)}
            ${this._renderTextField("ed.climate.target_size", "styles.target_size", config.styles.target_size)}
            ${this._renderTextField("ed.climate.dial_size", "styles.dial.size", config.styles.dial.size)}
            ${this._renderTextField("ed.climate.dial_max_size", "styles.dial.max_size", config.styles.dial.max_size)}
            ${this._renderTextField("ed.climate.dial_stroke", "styles.dial.stroke", config.styles.dial.stroke)}
            ${this._renderTextField("ed.climate.thumb_size", "styles.dial.thumb_size", config.styles.dial.thumb_size)}
            ${this._renderTextField("ed.climate.color_heat", "styles.dial.heat_color", config.styles.dial.heat_color)}
            ${this._renderTextField("ed.climate.color_cool", "styles.dial.cool_color", config.styles.dial.cool_color)}
            ${this._renderTextField("ed.climate.color_dry", "styles.dial.dry_color", config.styles.dial.dry_color)}
            ${this._renderTextField("ed.climate.color_auto", "styles.dial.auto_color", config.styles.dial.auto_color)}
            ${this._renderTextField("ed.climate.color_fan", "styles.dial.fan_color", config.styles.dial.fan_color)}
            ${this._renderTextField("ed.climate.track_dial", "styles.dial.track_color", config.styles.dial.track_color)}
            ${this._renderTextField("ed.climate.chip_height", "styles.chip_height", config.styles.chip_height)}
            ${this._renderTextField("ed.climate.chip_text", "styles.chip_font_size", config.styles.chip_font_size)}
            ${this._renderTextField("ed.climate.chip_padding", "styles.chip_padding", config.styles.chip_padding)}
            ${window.NodaliaUtils.renderEditorChipBorderRadiusHtml({
              escapeHtml,
              field: "styles.chip_border_radius",
              value: config.styles?.chip_border_radius,
              tHeading: this._editorLabel("ed.entity.style_chip_radius"),
              labels: {
                pill: this._editorLabel("ed.entity.chip_radius_pill"),
                soft: this._editorLabel("ed.entity.chip_radius_soft"),
                round: this._editorLabel("ed.entity.chip_radius_round"),
                square: this._editorLabel("ed.entity.chip_radius_square"),
              },
            })}
            ${this._renderTextField("ed.climate.mode_button_size", "styles.control.size", config.styles.control.size)}
            ${this._renderTextField("ed.climate.step_button_size", "styles.step_control.size", config.styles.step_control.size)}
          </div>
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('input[data-field="entity"]')
      .forEach(input => input.setAttribute("list", "climate-card-entities"));
  }
}

class NodaliaClimateCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showStyleSection = false;
    this._showAnimationSection = false;
    this._showTapActionsSection = false;
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
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._render();
    this._restoreFocusState(focusState);
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

        if (!this.isConnected || !this._hass || !this.shadowRoot) {
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

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id => id.startsWith("climate."));
  }

  _getClimateEntityOptions() {
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => entityId.startsWith("climate."))
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
        left.label.localeCompare(right.label, sortLoc, { sensitivity: "base" })
        || left.value.localeCompare(right.value, sortLoc, { sensitivity: "base" })
      ));

    const currentValue = String(this._config?.entity || "").trim();
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
      config: compactConfig(window.NodaliaUtils.stripEqualToDefaults(nextConfig, DEFAULT_CONFIG) ?? {}),
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
      case "number": {
        const trimmed = String(input.value || "").trim();
        if (!trimmed) {
          return undefined;
        }

        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : trimmed;
      }
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

    const field = control.dataset.field;
    const previousEntity = field === "entity" ? String(this._config?.entity || "").trim() : "";
    this._setFieldValue(field, nextValue);
    if (field === "entity") {
      window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass, { previousEntity });
    }
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
      return;
    }

    if (toggleButton.dataset.editorToggle === "animations") {
      this._showAnimationSection = !this._showAnimationSection;
      this._render();
      return;
    }

    if (toggleButton.dataset.editorToggle === "tap_actions") {
      this._showTapActionsSection = !this._showTapActionsSection;
      this._render();
    }
  }

  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    const hass = this._hass ?? this.hass;
    return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", s);
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tag = options.multiline ? "textarea" : "input";
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";
    const inputValue = value === undefined || value === null ? "" : String(value);

    if (tag === "textarea") {
      return `
        <label class="editor-field ${options.fullWidth !== false ? "editor-field--full" : ""}">
          <span>${escapeHtml(tLabel)}</span>
          <textarea data-field="${escapeHtml(field)}" data-value-type="${escapeHtml(valueType)}" rows="${options.rows || 2}" ${placeholder}>${escapeHtml(inputValue)}</textarea>
        </label>
      `;
    }

    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
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

  _renderColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("ed.entity.custom_color");
    const fallbackValue = options.fallbackValue || getEditorColorFallbackValue(field);
    const currentValue = value === undefined || value === null || value === ""
      ? fallbackValue
      : String(value);
    const colorModel = getEditorColorModel(currentValue, fallbackValue);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="${escapeHtml(tColorCustom)}">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="color"
              data-alpha="${escapeHtml(String(colorModel.alpha))}"
              value="${escapeHtml(colorModel.hex)}"
              aria-label="${escapeHtml(tLabel)}"
            />
            <span class="editor-color-swatch" style="--editor-swatch:${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-toggle">
        <input
          type="checkbox"
          data-field="${escapeHtml(field)}"
          data-value-type="boolean"
          ${checked ? "checked" : ""}
        />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(tLabel)}</span>
      </label>
    `;
  }

  _renderSelectField(label, field, value, options) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options
            .map(option => `
              <option value="${escapeHtml(String(option.value))}" ${String(value) === String(option.value) ? "selected" : ""}>
                ${escapeHtml(this._editorLabel(option.label))}
              </option>
            `)
            .join("")}
        </select>
      </label>
    `;
  }

  _renderEntityField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(options.placeholder || "")}"
        ></div>
      </div>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="icon-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(options.placeholder || "")}"
        ></div>
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
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.includeDomains = ["climate"];
      control.allowCustomEntity = true;
      control.entityFilter = stateObj => String(stateObj?.entity_id || "").startsWith("climate.");
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: {
          domain: "climate",
        },
      };
    } else {
      control = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder || this._editorLabel("ed.person.select_entity");
      control.appendChild(emptyOption);
      this._getClimateEntityOptions().forEach(option => {
        const optionElement = document.createElement("option");
        optionElement.value = option.value;
        optionElement.textContent = option.displayLabel;
        control.appendChild(optionElement);
      });
      control.addEventListener("change", this._onShadowInput);
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;

    if ("hass" in control) {
      control.hass = this._hass;
    }

    if ("value" in control) {
      control.value = nextValue;
    }

    if (control.tagName !== "SELECT") {
      control.addEventListener("value-changed", this._onShadowValueChanged);
    }

    host.replaceChildren(control);
  }

  _mountIconPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "icon";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    let control = null;

    if (customElements.get("ha-icon-picker")) {
      control = document.createElement("ha-icon-picker");
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        icon: {},
      };
    } else {
      control = document.createElement("input");
      control.type = "text";
      control.placeholder = placeholder;
      control.addEventListener("input", this._onShadowInput);
      control.addEventListener("change", this._onShadowInput);
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;

    if ("hass" in control) {
      control.hass = this._hass;
    }

    if ("value" in control) {
      control.value = nextValue;
    }

    if (control.tagName !== "INPUT") {
      control.addEventListener("value-changed", this._onShadowValueChanged);
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
    const holdAction = config.hold_action || "more-info";
    const doubleTapAction = config.double_tap_action || "none";

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
          line-height: 1.45;
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

        .editor-chip-radius__options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .editor-chip-radius__option {
          align-items: center;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 12px;
          cursor: pointer;
          display: inline-flex;
          gap: 8px;
          padding: 8px 12px;
        }

        .editor-chip-radius__option:has(input:checked) {
          background: color-mix(in srgb, var(--primary-color) 10%, transparent);
          border-color: var(--primary-color);
        }

        .editor-chip-radius__option input[type="radio"] {
          accent-color: var(--primary-color);
          appearance: auto;
          margin: 0;
          min-height: auto;
          padding: 0;
          width: auto;
        }


        .editor-field:has(> .editor-control-host[data-mounted-control="entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="entity-picker"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="vacuum-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="select-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="sensor-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="light-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="fan-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="humidifier-entity"]),
        .editor-field:has(> .editor-control-host[data-mounted-control="icon-picker"]),
        .editor-field:has(> ha-icon-picker) {
          grid-column: 1 / -1;
        }

        .editor-field > span,
        .editor-toggle > span {
          font-size: 12px;
          font-weight: 600;
        }

        .editor-field input,
        .editor-field select,
        .editor-field textarea,
        .editor-control-host input,
        .editor-control-host select,
        .editor-control-host textarea {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 40px;
          padding: 10px 12px;
          width: 100%;
        }

        .editor-field ha-icon-picker,
        .editor-field ha-entity-picker,
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }

        .editor-color-field {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          min-height: 40px;
        }

        .editor-color-picker {
          align-items: center;
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
          height: 18px;
          width: 18px;
        }

        .editor-color-picker .editor-color-swatch {
          height: 22px;
          width: 22px;
        }

        @media (max-width: 640px) {
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.entity.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.general_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderEntityField("ed.climate.climate_entity", "entity", config.entity, {
              placeholder: "climate.salon",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.entity.name", "name", config.name, {
              placeholder: "Salon",
              fullWidth: true,
            })}
            ${this._renderIconPickerField("ed.entity.icon", "icon", config.icon, {
              placeholder: "mdi:thermostat",
              fullWidth: true,
            })}
            ${this._renderCheckboxField("ed.entity.show_entity_picture", "show_entity_picture", config.show_entity_picture === true)}
            ${this._renderTextField("ed.entity.entity_picture", "entity_picture", config.entity_picture, {
              placeholder: "/local/climate.png",
              fullWidth: true,
            })}
          </div>
        </section>

        <section class="editor-section">
          ${window.NodaliaUtils.renderEditorCollapsibleSectionHeaderHtml({
            escapeHtml,
            editorLabel: key => this._editorLabel(key),
            titleKey: "ed.light.tap_actions_section_title",
            hintKey: "ed.light.tap_actions_section_hint",
            toggleId: "tap_actions",
            expanded: this._showTapActionsSection === true,
          })}
          ${
            this._showTapActionsSection
              ? `
          <div class="editor-grid editor-grid--stacked">
            ${this._renderSelectField(
              "ed.climate.tap_action",
              "tap_action",
              tapAction,
              [
                { value: "more-info", label: "ed.climate.tap_more_info" },
                { value: "none", label: "ed.climate.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.climate.hold_action",
              "hold_action",
              holdAction,
              [
                { value: "more-info", label: "ed.climate.tap_more_info" },
                { value: "none", label: "ed.climate.tap_none" },
              ],
              { fullWidth: true },
            )}
            ${this._renderSelectField(
              "ed.climate.double_tap_action",
              "double_tap_action",
              doubleTapAction,
              [
                { value: "none", label: "ed.climate.tap_none" },
                { value: "more-info", label: "ed.climate.tap_more_info" },
              ],
              { fullWidth: true },
            )}
          </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.climate.display_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.display_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField(
              "ed.climate.main_temperature",
              "display.main_temperature",
              config.display?.main_temperature === "current" ? "current" : "target",
              [
                { value: "target", label: "ed.climate.main_temperature_target" },
                { value: "current", label: "ed.climate.main_temperature_current" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.visibility_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.visibility_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.climate.chip_state", "show_state_chip", config.show_state_chip !== false)}
            ${this._renderCheckboxField("ed.climate.chip_current_temp", "show_current_temperature_chip", config.show_current_temperature_chip !== false)}
            ${this._renderCheckboxField("ed.climate.chip_humidity", "show_humidity_chip", config.show_humidity_chip !== false)}
            ${this._renderCheckboxField("ed.climate.mode_buttons", "show_mode_buttons", config.show_mode_buttons !== false)}
            ${this._renderCheckboxField("ed.climate.step_controls", "show_step_controls", config.show_step_controls !== false)}
            ${this._renderCheckboxField("ed.climate.schedule_button", "show_schedule_button", config.show_schedule_button !== false)}
            ${this._renderCheckboxField("ed.media_player.show_unavailable_badge", "show_unavailable_badge", config.show_unavailable_badge !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.climate.schedule_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.schedule_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderTextField("ed.climate.schedule_webhook", "setpoint_schedule_webhook", config.setpoint_schedule_webhook || "", {
              placeholder: "nodalia_climate_setpoint_schedule",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.climate.schedule_helper", "setpoint_schedule_helper", config.setpoint_schedule_helper || "", {
              placeholder: "input_text.nodalia_climate_schedule_salon",
              fullWidth: true,
            })}
            ${this._renderSelectField(
              "ed.climate.schedule_week_starts_on",
              "setpoint_schedule_week_starts_on",
              config.setpoint_schedule_week_starts_on === "sunday" ? "sunday" : "monday",
              [
                { value: "monday", label: "ed.climate.schedule_week_starts_monday" },
                { value: "sunday", label: "ed.climate.schedule_week_starts_sunday" },
              ],
            )}
            ${this._renderCheckboxField(
              "ed.calendar.allow_webhooks_non_admin",
              "security.allow_webhooks_for_non_admin",
              config.security?.allow_webhooks_for_non_admin !== false,
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.vacuum.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.haptics_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.entity.enable_haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("ed.entity.fallback_vibrate", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "ed.entity.haptic_style",
              "haptics.style",
              hapticStyle,
              [
                { value: "selection", label: "ed.person.haptic_selection" },
                { value: "light", label: "ed.person.haptic_light" },
                { value: "medium", label: "ed.person.haptic_medium" },
                { value: "heavy", label: "ed.person.haptic_heavy" },
                { value: "success", label: "ed.person.haptic_success" },
                { value: "warning", label: "ed.person.haptic_warning" },
                { value: "failure", label: "ed.person.haptic_failure" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.climate.animations_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.animations_hint"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showAnimationSection ? this._editorLabel("ed.weather.hide_animation_settings") : this._editorLabel("ed.weather.show_animation_settings"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("ed.vacuum.enable_animations", "animations.enabled", config.animations.enabled !== false)}
                  ${this._renderTextField("ed.climate.dial_ms", "animations.dial_duration", config.animations.dial_duration, {
                    type: "number",
                    valueType: "number",
                  })}
                  ${this._renderTextField("ed.climate.button_bounce_ms", "animations.button_bounce_duration", config.animations.button_bounce_duration, {
                    type: "number",
                    valueType: "number",
                  })}
                  ${this._renderTextField("ed.climate.content_entrance_ms", "animations.content_duration", config.animations.content_duration, {
                    type: "number",
                    valueType: "number",
                  })}
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.climate.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.climate.styles_hint_main"))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showStyleSection ? this._editorLabel("ed.weather.hide_style_settings") : this._editorLabel("ed.weather.show_style_settings"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("ed.person.style_card_bg", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("ed.person.style_card_border", "styles.card.border", config.styles.card.border)}
                  ${window.NodaliaUtils.renderEditorCardBorderRadiusHtml({
                    escapeHtml,
                    field: "styles.card.border_radius",
                    value: config.styles?.card?.border_radius,
                    tHeading: this._editorLabel("ed.entity.style_card_radius_presets"),
                    labels: {
                      pill: this._editorLabel("ed.entity.chip_radius_pill"),
                      soft: this._editorLabel("ed.entity.chip_radius_soft"),
                      round: this._editorLabel("ed.entity.chip_radius_round"),
                      square: this._editorLabel("ed.entity.chip_radius_square"),
                    },
                  })}
                  <div class="editor-section__hint editor-field--full" style="margin-top: -6px;">${escapeHtml(this._editorLabel("ed.entity.style_card_radius_yaml_hint"))}</div>
                  ${this._renderTextField("ed.person.style_card_shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("ed.person.style_card_padding", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("ed.person.style_card_gap", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderTextField("ed.climate.bubble_size", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderColorField("ed.climate.bubble_bg", "styles.icon.background", config.styles.icon.background, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
                  })}
                  ${this._renderColorField("ed.climate.icon_on", "styles.icon.on_color", config.styles.icon.on_color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderColorField("ed.climate.icon_off", "styles.icon.off_color", config.styles.icon.off_color, {
                    fallbackValue: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))",
                  })}
                  ${this._renderTextField("ed.climate.title_size", "styles.title_size", config.styles.title_size)}
                  ${this._renderTextField("ed.climate.current_temp_size", "styles.current_size", config.styles.current_size)}
                  ${this._renderTextField("ed.climate.target_size", "styles.target_size", config.styles.target_size)}
                  ${this._renderTextField("ed.climate.chip_height", "styles.chip_height", config.styles.chip_height)}
                  ${this._renderTextField("ed.climate.chip_text", "styles.chip_font_size", config.styles.chip_font_size)}
                  ${this._renderTextField("ed.climate.chip_padding", "styles.chip_padding", config.styles.chip_padding)}
                  ${window.NodaliaUtils.renderEditorChipBorderRadiusHtml({
                    escapeHtml,
                    field: "styles.chip_border_radius",
                    value: config.styles?.chip_border_radius,
                    tHeading: this._editorLabel("ed.entity.style_chip_radius"),
                    labels: {
                      pill: this._editorLabel("ed.entity.chip_radius_pill"),
                      soft: this._editorLabel("ed.entity.chip_radius_soft"),
                      round: this._editorLabel("ed.entity.chip_radius_round"),
                      square: this._editorLabel("ed.entity.chip_radius_square"),
                    },
                  })}
                  ${this._renderTextField("ed.climate.dial_size", "styles.dial.size", config.styles.dial.size)}
                  ${this._renderTextField("ed.climate.dial_max_size", "styles.dial.max_size", config.styles.dial.max_size)}
                  ${this._renderTextField("ed.climate.dial_stroke", "styles.dial.stroke", config.styles.dial.stroke)}
                  ${this._renderTextField("ed.climate.thumb_size", "styles.dial.thumb_size", config.styles.dial.thumb_size)}
                  ${this._renderColorField("ed.climate.dial_background", "styles.dial.background", config.styles.dial.background, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 2%, transparent)",
                  })}
                  ${this._renderColorField("ed.climate.track_dial", "styles.dial.track_color", config.styles.dial.track_color, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 24%, var(--ha-card-background))",
                  })}
                  ${this._renderColorField("ed.climate.color_heat", "styles.dial.heat_color", config.styles.dial.heat_color, {
                    fallbackValue: "#f59f42",
                  })}
                  ${this._renderColorField("ed.climate.color_cool", "styles.dial.cool_color", config.styles.dial.cool_color, {
                    fallbackValue: "#71c0ff",
                  })}
                  ${this._renderColorField("ed.climate.color_dry", "styles.dial.dry_color", config.styles.dial.dry_color, {
                    fallbackValue: "#7fd0c8",
                  })}
                  ${this._renderColorField("ed.climate.color_auto", "styles.dial.auto_color", config.styles.dial.auto_color, {
                    fallbackValue: "#c5a66f",
                  })}
                  ${this._renderColorField("ed.climate.color_fan", "styles.dial.fan_color", config.styles.dial.fan_color, {
                    fallbackValue: "#83d39c",
                  })}
                  ${this._renderColorField("ed.climate.color_off", "styles.dial.off_color", config.styles.dial.off_color, {
                    fallbackValue: "rgba(255, 255, 255, 0.28)",
                  })}
                  ${this._renderTextField("ed.climate.mode_button_size", "styles.control.size", config.styles.control.size)}
                  ${this._renderColorField("ed.entity.style_accent_bg", "styles.control.accent_background", config.styles.control.accent_background, {
                    fallbackValue: "rgba(113, 192, 255, 0.18)",
                  })}
                  ${this._renderColorField("ed.entity.style_accent_color", "styles.control.accent_color", config.styles.control.accent_color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderTextField("ed.climate.step_button_size", "styles.step_control.size", config.styles.step_control.size)}
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="entity-picker"]')
      .forEach(host => this._mountEntityPicker(host));

    this.shadowRoot
      .querySelectorAll('[data-mounted-control="icon-picker"]')
      .forEach(host => this._mountIconPicker(host));

    this._ensureEditorControlsReady();
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaClimateCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Climate Card",
  description: "Tarjeta de clima con dial circular, modos HVAC y control rapido de temperatura.",
  preview: true,
});
