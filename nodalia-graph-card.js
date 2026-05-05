// <nodalia-standalone-utils>
// Inlined for standalone Lovelace resources (single JS file). Stripped when building nodalia-cards.js.
// Source of truth: nodalia-utils.js — regenerate: node scripts/sync-standalone-embed.mjs
/**
 * Shared helpers for Nodalia cards (deep equality, config stripping, editor mounts).
 * Loaded early in nodalia-cards.js bundle; exposed as window.NodaliaUtils.
 */
(function initNodaliaUtils() {
  const REQUIRED_API_KEYS = [
    "isObject",
    "deepClone",
    "deepEqual",
    "stripEqualToDefaults",
    "editorStatesSignature",
    "editorFilteredStatesSignature",
    "mountEntityPickerHost",
    "mountIconPickerHost",
  ];
  const existing = typeof window !== "undefined" ? window.NodaliaUtils : null;
  if (
    existing &&
    REQUIRED_API_KEYS.every(key => typeof existing[key] === "function")
  ) {
    return;
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function deepClone(value) {
    if (value === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function deepEqual(a, b) {
    if (Object.is(a, b)) {
      return true;
    }
    if (a == null || b == null) {
      return a === b;
    }
    if (typeof a !== typeof b) {
      return false;
    }
    if (typeof a !== "object") {
      return false;
    }
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) {
        return false;
      }
      return a.every((value, index) => deepEqual(value, b[index]));
    }
    if (Array.isArray(b)) {
      return false;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) {
      return false;
    }
    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  function stripEqualToDefaults(config, defaults) {
    if (defaults === undefined || defaults === null) {
      return deepClone(config);
    }
    if (config === undefined || config === null) {
      return undefined;
    }
    if (Array.isArray(config)) {
      return deepEqual(config, defaults) ? undefined : deepClone(config);
    }
    if (isObject(config) && isObject(defaults)) {
      const out = {};
      for (const key of Object.keys(config)) {
        const cv = config[key];
        const dv = defaults[key];
        if (!(key in defaults)) {
          out[key] = deepClone(cv);
          continue;
        }
        if (deepEqual(cv, dv)) {
          continue;
        }
        if (isObject(cv) && !Array.isArray(cv) && isObject(dv) && !Array.isArray(dv)) {
          const stripped = stripEqualToDefaults(cv, dv);
          if (stripped !== undefined) {
            out[key] = stripped;
          }
        } else {
          out[key] = deepClone(cv);
        }
      }
      return Object.keys(out).length ? out : undefined;
    }
    return deepEqual(config, defaults) ? undefined : config;
  }

  /**
   * Signature for entities matching predicate(entityId): id + friendly_name + icon per row,
   * so picker labels update when attributes change. Same locale prefix as editorStatesSignature.
   */
  function editorFilteredStatesSignature(hass, language, predicate) {
    const states = hass?.states || {};
    const rows = [];
    for (const id of Object.keys(states)) {
      if (!predicate(id)) {
        continue;
      }
      const state = states[id];
      rows.push(
        `${id}:${String(state?.attributes?.friendly_name ?? "")}:${String(state?.attributes?.icon ?? "")}`,
      );
    }
    rows.sort((left, right) => {
      const idLeft = left.split(":")[0];
      const idRight = right.split(":")[0];
      return idLeft.localeCompare(idRight, "es", { sensitivity: "base" });
    });
    const tag =
      typeof window !== "undefined" && window.NodaliaI18n && typeof hass !== "undefined"
        ? window.NodaliaI18n.localeTag(window.NodaliaI18n.resolveLanguage(hass, language))
        : "";
    return `${tag}|${rows.join("|")}`;
  }

  /**
   * Full hass.states signature: every entity as id + friendly_name + icon (sorted by id),
   * plus locale tag — same shape as editorFilteredStatesSignature. Editors that list entities
   * re-render when labels or icons change, not only when the entity count changes.
   */
  function editorStatesSignature(hass, language) {
    return editorFilteredStatesSignature(hass, language, () => true);
  }

  function copyDatasetExcept(control, host, skipKeys) {
    const skip = new Set(skipKeys || []);
    Object.entries(host.dataset || {}).forEach(([key, value]) => {
      if (skip.has(key)) {
        return;
      }
      control.dataset[key] = value;
    });
  }

  /** Latest callbacks for reused picker controls (listeners call into this). */
  const pickerCallbackState = new WeakMap();
  const pickerControlsWithListeners = new WeakSet();

  function dispatchPickerChange(ev) {
    const control = ev.currentTarget;
    const s = pickerCallbackState.get(control);
    if (s && typeof s.onShadowInput === "function") {
      s.onShadowInput(ev);
    }
  }

  function dispatchPickerValueChanged(ev) {
    const control = ev.currentTarget;
    const s = pickerCallbackState.get(control);
    if (!s) {
      return;
    }
    const fn = s.onShadowValueChanged || s.onShadowInput;
    if (typeof fn === "function") {
      fn(ev);
    }
  }

  /**
   * Mount or update ha-entity-picker / ha-selector / text input without recreating each render.
   */
  function mountEntityPickerHost(host, options) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const hass = options.hass;
    const field = options.field || host.dataset.field || "entity";
    const nextValue = options.value !== undefined ? String(options.value) : String(host.dataset.value || "");
    const placeholder =
      options.placeholder !== undefined ? String(options.placeholder) : String(host.dataset.placeholder || "");
    const onShadowInput = options.onShadowInput;
    const onShadowValueChanged = options.onShadowValueChanged;
    const copyDatasetFromHost = options.copyDatasetFromHost !== false;

    const usePicker = typeof customElements !== "undefined" && customElements.get("ha-entity-picker");
    const useSelector = typeof customElements !== "undefined" && customElements.get("ha-selector");

    let desired = "input";
    if (usePicker) {
      desired = "picker";
    } else if (useSelector) {
      desired = "selector";
    }

    let control = host.firstElementChild;
    const tag = control?.tagName || "";
    const matches =
      control &&
      ((desired === "picker" && tag === "HA-ENTITY-PICKER")
        || (desired === "selector" && tag === "HA-SELECTOR")
        || (desired === "input" && tag === "INPUT"));

    if (!matches) {
      host.replaceChildren();
      if (usePicker) {
        control = document.createElement("ha-entity-picker");
        control.allowCustomEntity = true;
      } else if (useSelector) {
        control = document.createElement("ha-selector");
        control.selector = { entity: {} };
      } else {
        control = document.createElement("input");
        control.type = "text";
      }

      control.dataset.field = field;
      if (copyDatasetFromHost) {
        copyDatasetExcept(control, host, ["mountedControl", "value", "placeholder", "field"]);
      }

      if ("hass" in control) {
        control.hass = hass;
      }
      if ("value" in control) {
        control.value = nextValue;
      }
      if (placeholder && "placeholder" in control) {
        control.placeholder = placeholder;
      }

      pickerCallbackState.set(control, { onShadowInput, onShadowValueChanged });
      if (!pickerControlsWithListeners.has(control)) {
        pickerControlsWithListeners.add(control);
        if (control.tagName === "INPUT") {
          control.addEventListener("change", dispatchPickerChange);
        } else {
          control.addEventListener("value-changed", dispatchPickerValueChanged);
        }
      }

      host.appendChild(control);
      return;
    }

    control.dataset.field = field;
    control.dataset.value = nextValue;
    pickerCallbackState.set(control, { onShadowInput, onShadowValueChanged });
    if ("hass" in control) {
      control.hass = hass;
    }
    if (placeholder && "placeholder" in control) {
      control.placeholder = placeholder;
    }
    if ("value" in control && control.value !== nextValue) {
      control.value = nextValue;
    }
  }

  /**
   * Mount or update ha-icon-picker / text input without recreating each render.
   */
  function mountIconPickerHost(host, options) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const hass = options.hass;
    const nextValue = options.value !== undefined ? String(options.value) : String(host.dataset.value || "");
    const placeholder = options.placeholder !== undefined ? options.placeholder : host.dataset.placeholder || "";
    const onShadowInput = options.onShadowInput;
    const onShadowValueChanged = options.onShadowValueChanged;
    const copyDatasetFromHost = options.copyDatasetFromHost !== false;

    const useIconPicker = typeof customElements !== "undefined" && customElements.get("ha-icon-picker");

    let desired = useIconPicker ? "icon" : "input";
    let control = host.firstElementChild;
    const tag = control?.tagName || "";
    const matches =
      control && ((desired === "icon" && tag === "HA-ICON-PICKER") || (desired === "input" && tag === "INPUT"));

    if (!matches) {
      host.replaceChildren();
      if (useIconPicker) {
        control = document.createElement("ha-icon-picker");
      } else {
        control = document.createElement("input");
        control.type = "text";
      }

      if (copyDatasetFromHost) {
        copyDatasetExcept(control, host, ["mountedControl", "value", "placeholder", "field"]);
      }

      if ("hass" in control) {
        control.hass = hass;
      }
      if (placeholder && "placeholder" in control) {
        control.placeholder = placeholder;
      }
      if ("value" in control) {
        control.value = nextValue;
      }

      pickerCallbackState.set(control, { onShadowInput, onShadowValueChanged });
      if (!pickerControlsWithListeners.has(control)) {
        pickerControlsWithListeners.add(control);
        if (control.tagName === "INPUT") {
          control.addEventListener("change", dispatchPickerChange);
        } else {
          control.addEventListener("value-changed", dispatchPickerValueChanged);
        }
      }

      host.appendChild(control);
      return;
    }

    pickerCallbackState.set(control, { onShadowInput, onShadowValueChanged });
    if ("hass" in control) {
      control.hass = hass;
    }
    if (placeholder && "placeholder" in control) {
      control.placeholder = placeholder;
    }
    if ("value" in control && control.value !== nextValue) {
      control.value = nextValue;
    }
  }

  const api = {
    isObject,
    deepClone,
    deepEqual,
    stripEqualToDefaults,
    editorStatesSignature,
    editorFilteredStatesSignature,
    mountEntityPickerHost,
    mountIconPickerHost,
  };

  if (typeof window !== "undefined") {
    window.NodaliaUtils = api;
  }
})();

// </nodalia-standalone-utils>

const CARD_TAG = "nodalia-graph-card";
const EDITOR_TAG = "nodalia-graph-card-editor";
const CARD_VERSION = "0.12.20";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};
const SERIES_COLORS = [
  "#f29f05",
  "#42a5f5",
  "#7fd0c8",
  "#f56aa0",
  "#b993ff",
  "#7ad66f",
];
const TOUCH_HOLD_DELAY = 240;
const TOUCH_MOVE_CANCEL_DISTANCE = 14;
const TOUCH_CLICK_SUPPRESSION_WINDOW = 350;

const DEFAULT_CONFIG = {
  entity: "",
  entities: [],
  name: "Temperatura",
  icon: "mdi:thermometer",
  min: 15,
  max: 25,
  hours_to_show: 24,
  points: 100,
  show_header: true,
  show_icon: true,
  show_value: true,
  show_legend: true,
  show_fill: true,
  show_unavailable_badge: true,
  tap_action: "more-info",
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    hover_duration: 180,
    button_bounce_duration: 280,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "30px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "18px",
      gap: "20px",
    },
    icon: {
      color: "var(--primary-text-color)",
      size: "20px",
    },
    title_size: "13px",
    value_size: "40px",
    unit_size: "17px",
    legend_size: "11px",
    chart_height: "178px",
    line_width: "1px",
  },
};

const STUB_CONFIG = {
  name: "Temperatura",
  icon: "mdi:thermometer",
  min: 15,
  max: 25,
  entities: [
    {
      entity: "sensor.termostato_dormitorios_temperatura",
      name: "Dormitorio de Rocío",
      color: "#ffaa00",
    },
    {
      entity: "sensor.termostato_habitaciones_comunes_temperatura",
      name: "Pasillo",
      color: "#ffc677",
    },
  ],
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

function getStubEntityIds(hass, domains = [], limit = 1) {
  const states = hass?.states || {};
  const normalizedDomains = domains.map(domain => String(domain).trim()).filter(Boolean);
  return Object.keys(states)
    .filter(entityId => (
      !normalizedDomains.length || normalizedDomains.some(domain => entityId.startsWith(`${domain}.`))
    ))
    .slice(0, limit);
}

function getStubFriendlyName(hass, entityId) {
  return hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
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

function getByPath(target, path) {
  return String(path || "")
    .split(".")
    .reduce((cursor, key) => (cursor === undefined || cursor === null ? undefined : cursor[key]), target);
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

function parseNumber(value) {
  const numeric = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseHistoryTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }

  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumberValue(value, decimals = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "--";
  }

  return numeric.toLocaleString("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function inferDecimals(rawValue) {
  const text = String(rawValue ?? "").trim().replace(",", ".");
  if (!text.includes(".")) {
    return 0;
  }
  return Math.min(3, text.split(".")[1].length);
}

function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

/** Parses CSS padding shorthand into edge pixel values (numbers only tokens). */
function parsePaddingEdges(value, fallback = 16) {
  const fb = Number.isFinite(fallback) ? fallback : 16;
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { top: fb, right: fb, bottom: fb, left: fb };
  }
  const parts = raw.split(/\s+/).map(token => parseSizeToPixels(token, NaN)).filter(n => Number.isFinite(n));
  if (!parts.length) {
    return { top: fb, right: fb, bottom: fb, left: fb };
  }
  if (parts.length === 1) {
    const v = parts[0];
    return { top: v, right: v, bottom: v, left: v };
  }
  if (parts.length === 2) {
    const [vertical, horizontal] = parts;
    return { top: vertical, right: horizontal, bottom: vertical, left: horizontal };
  }
  if (parts.length === 3) {
    const [top, horizontal, bottom] = parts;
    return { top, right: horizontal, bottom, left: horizontal };
  }
  const [top, right, bottom, left] = parts;
  return { top, right, bottom, left };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Map SVG viewBox X (0..chart.width) to overlay percentage. */
function graphChartXToPercent(x, chart) {
  if (!chart || typeof chart.width !== "number") {
    return 50;
  }
  const width = chart.width;
  if (!Number.isFinite(width) || width <= 0) {
    return 50;
  }
  return (x / width) * 100;
}

function escapeSelectorValue(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value).replaceAll('"', '\\"');
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

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  if (normalizedField.endsWith("icon.color")) {
    return "var(--primary-text-color)";
  }

  return "var(--info-color, #71c0ff)";
}

function moveItem(array, fromIndex, toIndex) {
  if (!Array.isArray(array)) {
    return array;
  }

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= array.length ||
    toIndex >= array.length ||
    fromIndex === toIndex
  ) {
    return array;
  }

  const [item] = array.splice(fromIndex, 1);
  array.splice(toIndex, 0, item);
  return array;
}

function formatHoverTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveEntityEntries(config) {
  const source = Array.isArray(config?.entities) && config.entities.length
    ? config.entities
    : config?.entity
      ? [{ entity: config.entity, name: config.name || "" }]
      : [];

  return source
    .map((entry, index) => {
      if (typeof entry === "string") {
        return {
          entity: entry.trim(),
          name: "",
          color: SERIES_COLORS[index % SERIES_COLORS.length],
        };
      }

      if (!isObject(entry) || !entry.entity) {
        return null;
      }

      return {
        entity: String(entry.entity).trim(),
        name: String(entry.name || "").trim(),
        color: String(entry.color || SERIES_COLORS[index % SERIES_COLORS.length]).trim(),
      };
    })
    .filter(entry => entry?.entity);
}

function normalizeConfig(rawConfig) {
  const merged = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  merged.entities = resolveEntityEntries(merged);
  return merged;
}

function buildSmoothPath(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] || points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] || p2;

    const cp1x = p1.x + ((p2.x - p0.x) / 6);
    const cp1y = p1.y + ((p2.y - p0.y) / 6);
    const cp2x = p2.x - ((p3.x - p1.x) / 6);
    const cp2y = p2.y - ((p3.y - p1.y) / 6);

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

function buildAreaPath(points, bottomY) {
  if (!Array.isArray(points) || points.length === 0) {
    return "";
  }

  const linePath = buildSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x.toFixed(2)} ${bottomY.toFixed(2)} L ${first.x.toFixed(2)} ${bottomY.toFixed(2)} Z`;
}

function buildInterpolatedSamples(events, startMs, endMs, pointsCount, fallbackValue = null) {
  if (!Array.isArray(events) || !events.length) {
    if (!Number.isFinite(fallbackValue)) {
      return [];
    }

    return Array.from({ length: pointsCount }, (_item, index) => ({
      ts: startMs + (((endMs - startMs) * index) / Math.max(pointsCount - 1, 1)),
      value: fallbackValue,
    }));
  }
  const spanMs = Math.max(endMs - startMs, 1);
  const bucketSize = spanMs / Math.max(pointsCount - 1, 1);
  const buckets = Array.from({ length: pointsCount }, () => []);

  events.forEach(event => {
    const clampedTs = clamp(event.ts, startMs, endMs);
    const rawIndex = Math.floor((clampedTs - startMs) / Math.max(bucketSize, 1));
    const bucketIndex = clamp(rawIndex, 0, pointsCount - 1);
    buckets[bucketIndex].push(event.value);
  });

  let lastValue = Number.isFinite(fallbackValue)
    ? fallbackValue
    : buckets.flat().find(Number.isFinite);

  return buckets.map((bucket, index) => {
    const sampleTs = startMs + (((endMs - startMs) * index) / Math.max(pointsCount - 1, 1));
    if (bucket.length) {
      lastValue = bucket.reduce((sum, value) => sum + value, 0) / bucket.length;
    }

    return {
      ts: sampleTs,
      value: Number.isFinite(lastValue) ? lastValue : 0,
    };
  });
}

class NodaliaGraphCard extends HTMLElement {
  static async getConfigElement() {
    if (!customElements.get(EDITOR_TAG) && typeof customElements?.whenDefined === "function") {
      await customElements.whenDefined(EDITOR_TAG);
    }

    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    const config = deepClone(STUB_CONFIG);
    const entityIds = getStubEntityIds(hass, ["sensor", "number", "input_number"], 2);
    if (!entityIds.length) {
      return config;
    }

    config.entities = entityIds.map((entityId, index) => ({
      ...(config.entities?.[index] || {}),
      entity: entityId,
      name: getStubFriendlyName(hass, entityId),
    }));
    return config;
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._historySeries = [];
    this._historyKey = "";
    this._historyLoadedAt = 0;
    this._historyAbortController = null;
    this._activeSeriesEntityId = null;
    this._hoverIndex = null;
    this._hoverChart = null;
    this._hoverFrame = 0;
    this._pendingHoverIndex = null;
    this._hoverEntering = false;
    this._animateContentOnNextRender = true;
    this._animateChartOnNextRender = false;
    this._lastRenderSignature = "";
    this._tooltipSyncFrame = 0;
    this._touchPressTimer = 0;
    this._touchPressState = null;
    this._touchHoverActive = false;
    this._suppressClickUntil = 0;
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowPointerMove = this._onShadowPointerMove.bind(this);
    this._onShadowPointerLeave = this._onShadowPointerLeave.bind(this);
    this._onShadowTouchStart = this._onShadowTouchStart.bind(this);
    this._onShadowTouchMove = this._onShadowTouchMove.bind(this);
    this._onShadowTouchEnd = this._onShadowTouchEnd.bind(this);
    this._onShadowTouchCancel = this._onShadowTouchCancel.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("pointermove", this._onShadowPointerMove);
    this.shadowRoot.addEventListener("pointerleave", this._onShadowPointerLeave);
    this.shadowRoot.addEventListener("touchstart", this._onShadowTouchStart, { passive: true });
    this.shadowRoot.addEventListener("touchmove", this._onShadowTouchMove, { passive: false });
    this.shadowRoot.addEventListener("touchend", this._onShadowTouchEnd);
    this.shadowRoot.addEventListener("touchcancel", this._onShadowTouchCancel);
  }

  disconnectedCallback() {
    this._historyAbortController?.abort();
    this._historyAbortController = null;
    if (this._hoverFrame) {
      window.cancelAnimationFrame(this._hoverFrame);
      this._hoverFrame = 0;
    }
    if (this._tooltipSyncFrame) {
      window.cancelAnimationFrame(this._tooltipSyncFrame);
      this._tooltipSyncFrame = 0;
    }
    this._pendingHoverIndex = null;
    this._clearTouchPressTimer();
    this._touchPressState = null;
    this._touchHoverActive = false;
  }

  connectedCallback() {
    this._animateContentOnNextRender = true;
    this._animateChartOnNextRender = true;
    this._lastRenderSignature = "";
    if (this._hass && this._config) {
      this._render();
    }
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._historySeries = [];
    this._historyKey = "";
    this._historyLoadedAt = 0;
    this._hoverIndex = null;
    this._animateContentOnNextRender = true;
    this._animateChartOnNextRender = true;
    this._lastRenderSignature = "";
    this._requestHistory();
    this._render();
  }

  set hass(hass) {
    const nextSignature = this._getRenderSignature(hass);
    this._hass = hass;
    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }
    this._lastRenderSignature = nextSignature;
    this._requestHistory();
    this._render();
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 3,
      min_columns: 6,
    };
  }

  _getEntityEntries() {
    return resolveEntityEntries(this._config);
  }

  _getRenderSignature(hass = this._hass) {
    const trackedStates = this._getEntityEntries().map(entry => {
      const state = entry?.entity ? hass?.states?.[entry.entity] || null : null;
      return {
        entity: String(entry?.entity || ""),
        state: String(state?.state || ""),
        friendlyName: String(state?.attributes?.friendly_name || ""),
        unit: String(state?.attributes?.unit_of_measurement || state?.attributes?.native_unit_of_measurement || ""),
      };
    });

    return JSON.stringify({
      trackedStates,
      activeSeries: String(this._activeSeriesEntityId || ""),
      selectedSeries: String(this._selectedSeriesEntityId || ""),
    });
  }

  _getPrimaryEntityId() {
    return this._getEntityEntries()[0]?.entity || "";
  }

  _getPrimaryState() {
    const primaryEntityId = this._getPrimaryEntityId();
    return primaryEntityId ? this._hass?.states?.[primaryEntityId] || null : null;
  }

  _getSelectedEntityId() {
    const entityIds = this._getEntityEntries().map(entry => entry.entity);
    return entityIds.includes(this._activeSeriesEntityId) ? this._activeSeriesEntityId : "";
  }

  _getTitle() {
    return this._config?.name || "Grafica";
  }

  _getIcon() {
    return this._config?.icon || this._getPrimaryState()?.attributes?.icon || "mdi:chart-line";
  }

  _getUnit() {
    const entries = this._getEntityEntries();
    const units = entries
      .map(entry => {
        const state = this._hass?.states?.[entry.entity];
        return String(
          state?.attributes?.unit_of_measurement
          || state?.attributes?.native_unit_of_measurement
          || "",
        ).trim();
      })
      .filter(Boolean);

    return units.length && units.every(unit => unit === units[0]) ? units[0] : "";
  }

  _getDecimals() {
    const entry = this._getEntityEntries()[0];
    if (!entry) {
      return 0;
    }

    const state = this._hass?.states?.[entry.entity];
    return inferDecimals(state?.state);
  }

  _getCurrentValuesText() {
    const selectedEntityId = this._getSelectedEntityId();
    const entries = this._getEntityEntries();
    const selectedEntry = entries.find(entry => entry.entity === selectedEntityId) || null;
    const resolvedEntries = selectedEntry ? [selectedEntry] : entries;
    const currentSeries = resolvedEntries
      .map(entry => {
        const state = this._hass?.states?.[entry.entity];
        const value = parseNumber(state?.state);
        if (!Number.isFinite(value)) {
          return null;
        }
        return {
          decimals: inferDecimals(state?.state),
          unit: String(
            state?.attributes?.unit_of_measurement
            || state?.attributes?.native_unit_of_measurement
            || "",
          ).trim(),
          value,
        };
      })
      .filter(Boolean);

    if (!currentSeries.length) {
      return { value: "--", unit: this._getUnit() };
    }

    // When multiple active series share the same unit, show the mean value.
    if (!selectedEntry && currentSeries.length > 1) {
      const unit = currentSeries[0].unit;
      const sameUnit = currentSeries.every(item => item.unit === unit);
      if (sameUnit) {
        const avg = currentSeries.reduce((sum, item) => sum + item.value, 0) / currentSeries.length;
        const decimals = clamp(
          Math.max(...currentSeries.map(item => item.decimals), 1),
          0,
          3,
        );
        return {
          value: formatNumberValue(avg, decimals),
          unit,
        };
      }
    }

    const primary = currentSeries[0];
    return {
      value: formatNumberValue(primary.value, primary.decimals),
      unit: primary.unit || this._getUnit(),
    };
  }

  _getLegendEntries() {
    const selectedEntityId = this._getSelectedEntityId();
    return this._getEntityEntries().map((entry, index) => {
      const state = this._hass?.states?.[entry.entity];
      return {
        entity: entry.entity,
        name: entry.name || state?.attributes?.friendly_name || entry.entity,
        color: entry.color || SERIES_COLORS[index % SERIES_COLORS.length],
        active: !selectedEntityId || selectedEntityId === entry.entity,
        muted: Boolean(selectedEntityId) && selectedEntityId !== entry.entity,
      };
    });
  }

  _canRunTapAction() {
    return (this._config?.tap_action || "more-info") !== "none" && Boolean(this._getPrimaryEntityId());
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
    const entityId = this._getPrimaryEntityId();
    if (!entityId) {
      return;
    }

    fireEvent(this, "hass-more-info", {
      entityId,
    });
  }

  _onShadowClick(event) {
    if (Date.now() < this._suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const seriesChip = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.graphSeries);

    if (seriesChip) {
      event.preventDefault();
      event.stopPropagation();
      const entityId = seriesChip.dataset.graphSeries;
      this._activeSeriesEntityId = this._activeSeriesEntityId === entityId ? null : entityId;
      this._hoverIndex = null;
      this._animateChartOnNextRender = true;
      this._triggerHaptic("selection");
      this._triggerButtonBounce(seriesChip);
      this._render();
      return;
    }

    const target = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.graphAction === "primary");

    if (!target || !this._canRunTapAction()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();
    this._triggerButtonBounce(target);
    this._openMoreInfo();
  }

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;

    return {
      enabled: configuredAnimations.enabled !== false,
      hoverDuration: clamp(
        Number(configuredAnimations.hover_duration) || DEFAULT_CONFIG.animations.hover_duration,
        80,
        1200,
      ),
      buttonBounceDuration: clamp(
        Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration,
        120,
        1200,
      ),
    };
  }

  _triggerButtonBounce(element) {
    const animations = this._getAnimationSettings();
    if (!animations.enabled || !(element instanceof HTMLElement)) {
      return;
    }

    element.classList.remove("is-pressing");
    void element.offsetWidth;
    element.classList.add("is-pressing");

    window.setTimeout(() => {
      element.classList.remove("is-pressing");
    }, animations.buttonBounceDuration + 40);
  }

  _getVisibleSeries(series) {
    const selectedEntityId = this._getSelectedEntityId();
    if (!selectedEntityId) {
      return series;
    }

    return series.filter(entry => entry.entity === selectedEntityId);
  }

  _getChartSurfaceFromEvent(event) {
    return event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.graphSurface === "chart");
  }

  _getHoverSampleCount() {
    return this._hoverChart?.entries?.[0]?.samples?.length || 0;
  }

  _getHoverIndexFromClientX(surface, clientX) {
    const sampleCount = this._getHoverSampleCount();
    if (!(surface instanceof HTMLElement) || sampleCount <= 1) {
      return null;
    }

    const rect = surface.getBoundingClientRect();
    if (rect.width <= 0) {
      return null;
    }

    const relativeX = clamp(clientX - rect.left, 0, rect.width);
    return Math.round((relativeX / rect.width) * (sampleCount - 1));
  }

  _updateHoverFromClientX(surface, clientX) {
    const nextIndex = this._getHoverIndexFromClientX(surface, clientX);
    if (nextIndex === null) {
      return;
    }

    this._scheduleHoverRender(nextIndex);
  }

  _onShadowPointerMove(event) {
    if (
      (typeof event.pointerType === "string" && event.pointerType === "touch")
      || (typeof window !== "undefined" && typeof window.matchMedia === "function" && !window.matchMedia("(hover: hover)").matches)
    ) {
      return;
    }

    const surface = this._getChartSurfaceFromEvent(event);

    if (!surface || !this._hoverChart?.entries?.length) {
      this._scheduleHoverRender(null);
      return;
    }

    this._updateHoverFromClientX(surface, event.clientX);
  }

  _onShadowPointerLeave() {
    if (this._touchHoverActive) {
      return;
    }

    this._scheduleHoverRender(null);
  }

  _clearTouchPressTimer() {
    if (!this._touchPressTimer) {
      return;
    }

    window.clearTimeout(this._touchPressTimer);
    this._touchPressTimer = 0;
  }

  _findTrackedTouch(touches) {
    if (!this._touchPressState || !touches) {
      return null;
    }

    return Array.from(touches).find(touch => touch.identifier === this._touchPressState.identifier) || null;
  }

  _clearTouchHover(options = {}) {
    const shouldRender = options.shouldRender !== false;
    const suppressClick = options.suppressClick === true;
    const shouldClearHover = options.clearHover !== false;

    this._clearTouchPressTimer();
    this._touchPressState = null;

    if (suppressClick) {
      this._suppressClickUntil = Date.now() + TOUCH_CLICK_SUPPRESSION_WINDOW;
    }

    const wasActive = this._touchHoverActive;
    this._touchHoverActive = false;
    if (!wasActive || !shouldClearHover) {
      return;
    }

    if (shouldRender) {
      this._scheduleHoverRender(null);
      return;
    }

    this._hoverIndex = null;
  }

  _onShadowTouchStart(event) {
    if (event.touches.length !== 1) {
      this._clearTouchHover({ shouldRender: false, clearHover: false });
      return;
    }

    const surface = this._getChartSurfaceFromEvent(event);
    if (!surface || !this._hoverChart?.entries?.length) {
      this._clearTouchHover({ shouldRender: false, clearHover: false });
      return;
    }

    const touch = event.touches[0];
    this._clearTouchPressTimer();
    this._touchPressState = {
      identifier: touch.identifier,
      lastX: touch.clientX,
      startX: touch.clientX,
      startY: touch.clientY,
      surface,
    };

    this._touchPressTimer = window.setTimeout(() => {
      if (!this._touchPressState) {
        return;
      }

      this._touchPressTimer = 0;
      this._touchHoverActive = true;
      this._updateHoverFromClientX(this._touchPressState.surface, this._touchPressState.lastX);
      this._triggerHaptic("selection");
    }, TOUCH_HOLD_DELAY);
  }

  _onShadowTouchMove(event) {
    if (!this._touchPressState) {
      return;
    }

    const touch = this._findTrackedTouch(event.touches);
    if (!touch) {
      return;
    }

    this._touchPressState.lastX = touch.clientX;

    if (!this._touchHoverActive) {
      const deltaX = touch.clientX - this._touchPressState.startX;
      const deltaY = touch.clientY - this._touchPressState.startY;
      const isVerticalScroll = Math.abs(deltaY) > TOUCH_MOVE_CANCEL_DISTANCE && Math.abs(deltaY) > Math.abs(deltaX) * 1.2;
      if (isVerticalScroll) {
        this._clearTouchHover({ shouldRender: false, clearHover: false });
      }
      return;
    }

    event.preventDefault();
    this._updateHoverFromClientX(this._touchPressState.surface, touch.clientX);
  }

  _onShadowTouchEnd(event) {
    const touch = this._findTrackedTouch(event.changedTouches);
    if (!touch && !this._touchHoverActive && !this._touchPressTimer) {
      return;
    }

    if (this._touchHoverActive) {
      event.preventDefault();
    }

    this._clearTouchHover({
      suppressClick: this._touchHoverActive,
    });
  }

  _onShadowTouchCancel() {
    this._clearTouchHover();
  }

  _scheduleHoverRender(nextIndex) {
    if (nextIndex === this._hoverIndex) {
      return;
    }

    if (this._hoverFrame) {
      window.cancelAnimationFrame(this._hoverFrame);
      this._hoverFrame = 0;
    }

    this._pendingHoverIndex = null;
    this._hoverEntering = nextIndex !== null && this._hoverIndex === null;
    this._hoverIndex = nextIndex;
    this._render();
  }

  _getHistoryRequestKey() {
    const entries = this._getEntityEntries();
    return JSON.stringify({
      entities: entries.map(entry => entry.entity),
      hours: Number(this._config?.hours_to_show) || DEFAULT_CONFIG.hours_to_show,
      points: Number(this._config?.points) || DEFAULT_CONFIG.points,
    });
  }

  _getStatisticsPeriod() {
    const hoursToShow = Math.max(1, Number(this._config?.hours_to_show) || DEFAULT_CONFIG.hours_to_show);

    if (hoursToShow <= 48) {
      return "5minute";
    }

    if (hoursToShow <= 24 * 14) {
      return "hour";
    }

    return "day";
  }

  async _fetchStatistics(start, end, entityIds) {
    if (typeof this._hass?.callWS !== "function") {
      return null;
    }

    try {
      const groups = await Promise.all(entityIds.map(async entityId => {
        const result = await this._hass.callWS({
          type: "recorder/statistics_during_period",
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          statistic_ids: [entityId],
          period: this._getStatisticsPeriod(),
          types: ["mean", "min", "max", "state", "sum"],
        });

        return [entityId, Array.isArray(result?.[entityId]) ? result[entityId] : []];
      }));

      return Object.fromEntries(groups);
    } catch (_error) {
      return null;
    }
  }

  async _fetchHistory(start, end, entityIds, signal) {
    const groups = await Promise.all(entityIds.map(async entityId => {
      if (typeof this._hass?.callWS === "function") {
        try {
          const result = await this._hass.callWS({
            type: "history/history_during_period",
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            entity_ids: [entityId],
            significant_changes_only: false,
          });

          const rows = Array.isArray(result?.[0]) ? result[0] : Array.isArray(result?.[entityId]) ? result[entityId] : [];
          return [entityId, rows];
        } catch (_error) {
          // Fall through to REST.
        }
      }

      if (typeof this._hass?.auth?.fetchWithAuth === "function") {
        const query = [
          `filter_entity_id=${encodeURIComponent(entityId)}`,
          `end_time=${encodeURIComponent(end.toISOString())}`,
        ].join("&");

        const response = await this._hass.auth.fetchWithAuth(
          `/api/history/period/${encodeURIComponent(start.toISOString())}?${query}`,
          { signal },
        );

        if (!response.ok) {
          throw new Error(`History request failed with ${response.status}`);
        }

        const result = await response.json();
        return [entityId, Array.isArray(result?.[0]) ? result[0] : []];
      }

      return [entityId, []];
    }));

    return Object.fromEntries(groups);
  }

  _normalizeStatisticsSeries(raw) {
    const entries = this._getLegendEntries();

    return entries.map(entry => {
      const state = this._hass?.states?.[entry.entity];
      const rows = Array.isArray(raw?.[entry.entity]) ? raw[entry.entity] : [];
      const samples = rows
        .map(item => {
          const ts = parseHistoryTimestamp(item.start ?? item.end);
          const value = parseNumber(item.mean ?? item.state ?? item.max ?? item.min ?? item.sum);
          return { ts, value };
        })
        .filter(item => Number.isFinite(item.ts) && Number.isFinite(item.value))
        .sort((left, right) => left.ts - right.ts);

      const currentValue = parseNumber(state?.state);

      return {
        ...entry,
        unit: String(
          state?.attributes?.unit_of_measurement
          || state?.attributes?.native_unit_of_measurement
          || "",
        ).trim(),
        currentValue: Number.isFinite(currentValue) ? currentValue : samples[samples.length - 1]?.value ?? 0,
        rawEventCount: samples.length,
        samples,
      };
    });
  }

  _normalizeHistorySeries(raw, start, end) {
    const entries = this._getLegendEntries();
    const historyByEntity = new Map();
    const pointsCount = Math.max(20, Number(this._config?.points) || DEFAULT_CONFIG.points);
    const startMs = start.getTime();
    const endMs = end.getTime();

    if (Array.isArray(raw)) {
      raw.forEach((group, index) => {
        if (!Array.isArray(group)) {
          return;
        }

        const resolvedEntityId = group[0]?.entity_id || entries[index]?.entity;
        if (resolvedEntityId) {
          historyByEntity.set(resolvedEntityId, group);
        }
      });
    } else if (isObject(raw)) {
      Object.entries(raw).forEach(([entityId, group]) => {
        if (Array.isArray(group)) {
          historyByEntity.set(entityId, group);
        }
      });
    }

    return entries.map(entry => {
      const state = this._hass?.states?.[entry.entity];
      const rawGroup = historyByEntity.get(entry.entity) || [];
      const events = rawGroup
        .map(item => ({
          ts: parseHistoryTimestamp(
            item.last_changed
            || item.last_updated
            || item.lc
            || item.lu
            || item.last_changed_ts
            || item.last_updated_ts,
          ),
          value: parseNumber(item.state ?? item.s ?? item.value ?? item.v),
        }))
        .filter(item => Number.isFinite(item.ts) && Number.isFinite(item.value))
        .sort((left, right) => left.ts - right.ts);

      const currentValue = parseNumber(state?.state);
      if (Number.isFinite(currentValue)) {
        const nowTs = end.getTime();
        if (!events.length || Math.abs(events[events.length - 1].ts - nowTs) > 1000) {
          events.push({ ts: nowTs, value: currentValue });
        }
      }
      const samples = buildInterpolatedSamples(events, startMs, endMs, pointsCount, currentValue);

      return {
        ...entry,
        unit: String(
          state?.attributes?.unit_of_measurement
          || state?.attributes?.native_unit_of_measurement
          || "",
        ).trim(),
        currentValue: Number.isFinite(currentValue) ? currentValue : samples[samples.length - 1]?.value ?? 0,
        rawEventCount: events.length,
        samples,
      };
    });
  }

  async _requestHistory() {
    if (!this._hass || !this._getEntityEntries().length) {
      return;
    }

    const requestKey = this._getHistoryRequestKey();
    if (
      requestKey === this._historyKey &&
      this._historySeries.length &&
      Date.now() - this._historyLoadedAt < 180000
    ) {
      return;
    }

    this._historyAbortController?.abort();
    const controller = new AbortController();
    this._historyAbortController = controller;

    const end = new Date();
    const hoursToShow = Math.max(1, Number(this._config?.hours_to_show) || DEFAULT_CONFIG.hours_to_show);
    const start = new Date(end.getTime() - (hoursToShow * 60 * 60 * 1000));

    try {
      const entityIds = this._getEntityEntries().map(entry => entry.entity);
      const raw = await this._fetchHistory(start, end, entityIds, controller.signal);
      if (controller.signal.aborted) {
        return;
      }

      const normalized = this._normalizeHistorySeries(raw || {}, start, end);
      const hasMeaningfulHistory = normalized.some(entry => entry.rawEventCount > 1 && entry.samples.length > 1);

      if (hasMeaningfulHistory) {
        this._historySeries = normalized;
        this._historyKey = requestKey;
        this._historyLoadedAt = Date.now();
        this._animateChartOnNextRender = true;
        this._render();
        return;
      }

      const statisticsRaw = await this._fetchStatistics(start, end, entityIds);
      if (controller.signal.aborted) {
        return;
      }

      const statisticsSeries = this._normalizeStatisticsSeries(statisticsRaw || {});
      const hasMeaningfulStatistics = statisticsSeries.some(entry => entry.rawEventCount > 1 && entry.samples.length > 1);
      this._historySeries = statisticsSeries;
      this._historyKey = hasMeaningfulStatistics ? requestKey : "";
      this._historyLoadedAt = hasMeaningfulStatistics ? Date.now() : 0;
      this._animateChartOnNextRender = true;
      this._render();
    } catch (_error) {
      if (controller.signal.aborted) {
        return;
      }

      this._historySeries = [];
      this._historyKey = "";
      this._historyLoadedAt = 0;
      this._animateChartOnNextRender = true;
      this._render();
    } finally {
      if (this._historyAbortController === controller) {
        this._historyAbortController = null;
      }
    }
  }

  _normalizeMetricUnit(unit) {
    return normalizeTextKey(
      String(unit || "")
        .replace("°", "")
        .replaceAll("/", "_")
        .replaceAll("-", "_"),
    );
  }

  _getPrimaryMetricProfile() {
    const selectedEntityId = this._getSelectedEntityId();
    const entry = this._getEntityEntries().find(item => item.entity === selectedEntityId) || this._getEntityEntries()[0];
    const state = entry?.entity ? this._hass?.states?.[entry.entity] || null : null;
    const unit = String(
      state?.attributes?.unit_of_measurement
      || state?.attributes?.native_unit_of_measurement
      || "",
    ).trim();
    const deviceClass = normalizeTextKey(state?.attributes?.device_class || "");
    const stateClass = normalizeTextKey(state?.attributes?.state_class || "");
    const entityId = String(entry?.entity || "");
    const domain = entityId.includes(".") ? entityId.split(".")[0] : "";
    const entityKey = normalizeTextKey(entityId);

    return {
      deviceClass,
      domain,
      entityKey,
      stateClass,
      unit,
      unitKey: this._normalizeMetricUnit(unit),
    };
  }

  _getSmartRangeSuggestion(dataMin, dataMax) {
    const profile = this._getPrimaryMetricProfile();
    const unitKey = profile.unitKey;
    const isPercent = profile.unit === "%" || unitKey === "percent";
    const isHumidity = profile.deviceClass === "humidity"
      || profile.deviceClass === "moisture"
      || /humidity|humedad|moisture|humitat|umidade/.test(profile.entityKey);
    if (isPercent && isHumidity) {
      return { min: 20, max: 80 };
    }

    const isBattery = profile.deviceClass === "battery" || /battery|bateria/.test(profile.entityKey);
    if (isPercent && isBattery) {
      return { min: 0, max: 100 };
    }

    const isTemperature = profile.deviceClass === "temperature"
      || unitKey === "c"
      || unitKey === "f";
    if (isTemperature) {
      if (unitKey === "f") {
        return { min: 60, max: 86 };
      }
      return { min: 16, max: 30 };
    }

    const isPower = /(kw|w|mw|kva|va)\b/.test(unitKey)
      || /power|potencia|consumo/.test(profile.entityKey);
    if (isPower) {
      const upper = Number.isFinite(dataMax) ? Math.max(1, dataMax) : 1;
      return { min: 0, max: upper * 1.12 };
    }

    const isEnergy = /(kwh|wh|mwh)\b/.test(unitKey)
      || profile.deviceClass === "energy";
    if (isEnergy) {
      const upper = Number.isFinite(dataMax) ? Math.max(1, dataMax) : 1;
      return { min: 0, max: upper * 1.08 };
    }

    const isCo2 = profile.deviceClass === "carbon_dioxide"
      || unitKey === "ppm"
      || /co2|carbon_dioxide/.test(profile.entityKey);
    if (isCo2) {
      return { min: 350, max: 2000 };
    }

    const isPressure = profile.deviceClass === "atmospheric_pressure"
      || /(hpa|mbar|bar|kpa|pa)\b/.test(unitKey);
    if (isPressure) {
      if (/(hpa|mbar)\b/.test(unitKey)) {
        return { min: 980, max: 1040 };
      }
      if (unitKey === "bar") {
        return { min: 0.98, max: 1.04 };
      }
    }

    return null;
  }

  _getGraphBounds(series) {
    const configuredMin = Number(this._config?.min);
    const configuredMax = Number(this._config?.max);
    const values = series.flatMap(entry => entry.samples.map(sample => sample.value)).filter(Number.isFinite);
    const dataMin = values.length ? Math.min(...values) : null;
    const dataMax = values.length ? Math.max(...values) : null;
    const suggestion = this._getSmartRangeSuggestion(dataMin, dataMax);

    let min = Number.isFinite(configuredMin)
      ? configuredMin
      : Number.isFinite(dataMin)
        ? dataMin
        : null;
    let max = Number.isFinite(configuredMax)
      ? configuredMax
      : Number.isFinite(dataMax)
        ? dataMax
        : null;

    if (!Number.isFinite(configuredMin) && suggestion?.min !== undefined) {
      min = Number(suggestion.min);
    }
    if (!Number.isFinite(configuredMax) && suggestion?.max !== undefined) {
      max = Number(suggestion.max);
    }

    // Keep suggested ranges stable (e.g. humidity 20-80) but never crop real data.
    if (suggestion && Number.isFinite(dataMin) && Number.isFinite(dataMax)) {
      if (!Number.isFinite(configuredMin) && dataMin < min) {
        min = dataMin;
      }
      if (!Number.isFinite(configuredMax) && dataMax > max) {
        max = dataMax;
      }
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = 0;
      max = 100;
    }

    if (!Number.isFinite(configuredMin) && !suggestion) {
      const spread = Math.max(max - min, 1);
      min -= spread * 0.14;
    }

    if (!Number.isFinite(configuredMax) && !suggestion) {
      const spread = Math.max(max - min, 1);
      max += spread * 0.08;
    }

    if (max <= min) {
      max = min + 1;
    }

    return { min, max };
  }

  _buildChartSeries(series) {
    const width = 100;
    const height = 56;
    const paddingX = -5.5;
    const paddingTop = 4;
    // Reserve extra bottom headroom so min values and stroke/glow
    // never get clipped by the rounded chart container.
    const paddingBottom = 14;
    const spanX = width - (paddingX * 2);
    const xMin = paddingX;
    const xMax = paddingX + spanX;
    const bounds = this._getGraphBounds(series);
    const range = Math.max(bounds.max - bounds.min, 1);

    return {
      width,
      height,
      paddingX,
      paddingTop,
      paddingBottom,
      xMin,
      xMax,
      entries: series.map(entry => {
        if (!entry.samples.length) {
          return {
            ...entry,
            points: [],
            linePath: "",
            fillPath: "",
          };
        }

        const points = entry.samples.map((sample, index) => {
          const x = paddingX + (spanX * index) / Math.max(entry.samples.length - 1, 1);
          const normalized = clamp((sample.value - bounds.min) / range, 0, 1);
          const y = paddingTop + ((height - paddingTop - paddingBottom) * (1 - normalized));
          return { x, y };
        });

        return {
          ...entry,
          points,
          linePath: buildSmoothPath(points),
          fillPath: buildAreaPath(points, height - paddingBottom),
        };
      }),
    };
  }

  _getHoverPayload(chart) {
    if (!this._hoverChart || !chart?.entries?.length || this._hoverIndex === null) {
      return null;
    }

    const boundedIndex = clamp(this._hoverIndex, 0, Math.max((chart.entries[0]?.samples?.length || 1) - 1, 0));
    const primaryEntry = chart.entries[0];
    const primarySample = primaryEntry?.samples?.[boundedIndex];
    const anchorPoint = primaryEntry?.points?.[boundedIndex];

    if (!primarySample || !anchorPoint) {
      return null;
    }

    const decimals = this._getDecimals();
    return {
      index: boundedIndex,
      label: formatHoverTimestamp(primarySample.ts),
      x: anchorPoint.x,
      values: chart.entries
        .map(entry => {
          const sample = entry.samples?.[boundedIndex];
          if (!sample) {
            return null;
          }

          return {
            color: entry.color,
            name: entry.name,
            value: formatNumberValue(sample.value, decimals),
            unit: entry.unit || this._getUnit(),
            point: entry.points?.[boundedIndex] || null,
          };
        })
        .filter(Boolean),
    };
  }

  _scheduleTooltipPositionSync(retries = 3) {
    if (this._tooltipSyncFrame) {
      window.cancelAnimationFrame(this._tooltipSyncFrame);
      this._tooltipSyncFrame = 0;
    }

    if (typeof window?.requestAnimationFrame !== "function") {
      this._syncTooltipPosition(retries);
      return;
    }

    this._tooltipSyncFrame = window.requestAnimationFrame(() => {
      this._tooltipSyncFrame = 0;
      this._syncTooltipPosition(retries);
    });
  }

  _syncTooltipPosition(retries = 0) {
    if (!this.shadowRoot) {
      return;
    }

    const tooltip = this.shadowRoot.querySelector(".graph-card__tooltip");
    const chartWrap = this.shadowRoot.querySelector(".graph-card__chart-wrap");
    if (!(tooltip instanceof HTMLElement) || !(chartWrap instanceof HTMLElement)) {
      return;
    }

    const anchorXPct = Number(tooltip.dataset.anchorXPct);
    if (!Number.isFinite(anchorXPct)) {
      return;
    }

    const wrapWidth = Math.round(
      chartWrap.getBoundingClientRect().width
      || chartWrap.clientWidth
      || chartWrap.offsetWidth
      || 0,
    );
    if (!wrapWidth) {
      if (retries > 0) {
        this._scheduleTooltipPositionSync(retries - 1);
      }
      return;
    }

    const viewport = typeof window === "undefined" ? null : window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width
      || (typeof document !== "undefined" ? document.documentElement?.clientWidth : 0)
      || (typeof window !== "undefined" ? window.innerWidth : 0)
      || 360;
    const viewportHeight = viewport?.height
      || (typeof document !== "undefined" ? document.documentElement?.clientHeight : 0)
      || (typeof window !== "undefined" ? window.innerHeight : 0)
      || 640;
    const chartRect = chartWrap.getBoundingClientRect();
    const anchorPx = clamp((anchorXPct / 100) * chartRect.width, 0, chartRect.width);
    const anchorViewportX = chartRect.left + anchorPx;
    const anchorViewportY = chartRect.top + Math.max(22, chartRect.height * 0.28);
    const maxTooltipWidth = Math.min(260, viewportWidth - 24);

    tooltip.style.maxWidth = `${maxTooltipWidth}px`;

    const tooltipBox = tooltip.getBoundingClientRect();
    const tooltipWidth = Math.min(Math.round(tooltipBox.width || tooltip.offsetWidth || 0) || maxTooltipWidth, maxTooltipWidth);
    const tooltipHeight = Math.round(tooltipBox.height || tooltip.offsetHeight || 0) || 112;
    if (!tooltipWidth || !tooltipHeight) {
      if (retries > 0) {
        this._scheduleTooltipPositionSync(retries - 1);
      }
      return;
    }

    const resolvedCenter = clamp(
      anchorViewportX,
      viewportLeft + (tooltipWidth / 2) + 12,
      viewportLeft + viewportWidth - (tooltipWidth / 2) - 12,
    );
    const shouldShowBelow = anchorViewportY - tooltipHeight - 14 < viewportTop + 12;
    const resolvedTop = shouldShowBelow
      ? clamp(anchorViewportY + 14, viewportTop + 12, viewportTop + viewportHeight - tooltipHeight - 12)
      : clamp(anchorViewportY - 14, viewportTop + tooltipHeight + 12, viewportTop + viewportHeight - 12);

    tooltip.style.left = `${resolvedCenter}px`;
    tooltip.style.top = `${resolvedTop}px`;
    tooltip.style.setProperty("--graph-tooltip-transform", shouldShowBelow
      ? "translate(-50%, 0)"
      : "translate(-50%, -100%)");
  }

  _getSeriesData() {
    if (this._historySeries.some(entry => entry.samples?.length > 1)) {
      return this._historySeries;
    }
    return [];
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

        .graph-card--empty {
          background: ${styles.card.background};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          display: grid;
          gap: 6px;
          padding: ${styles.card.padding};
        }

        .graph-card__empty-title {
          color: var(--primary-text-color);
          font-size: 15px;
          font-weight: 700;
        }

        .graph-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }
      </style>
      <ha-card class="graph-card graph-card--empty">
        <div class="graph-card__empty-title">Nodalia Graph Card</div>
        <div class="graph-card__empty-text">Configura \`entities\` con una o varias entidades numericas para mostrar la grafica.</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const entries = this._getEntityEntries();
    if (!entries.length) {
      this.shadowRoot.innerHTML = this._renderEmptyState();
      return;
    }

    const config = this._config || normalizeConfig({});
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const legendEntries = this._getLegendEntries();
    const showUnavailableBadge = config.show_unavailable_badge !== false && entries.some(entry => isUnavailableState(this._hass?.states?.[entry.entity]));
    const compactLayout = Number(config?.grid_options?.rows) > 0 && Number(config?.grid_options?.rows) <= 3;
    const currentValue = this._getCurrentValuesText();
    const allSeries = this._getSeriesData();
    const chart = this._buildChartSeries(this._getVisibleSeries(allSeries));
    this._hoverChart = chart;
    const hasGraphData = chart.entries.some(entry => entry.linePath);
    const hover = hasGraphData ? this._getHoverPayload(chart) : null;
    const hoverLineX = hover ? clamp(hover.x, 0, chart.width) : 0;
    const icon = this._getIcon();
    const title = this._getTitle();
    const accentColor = chart.entries[0]?.color || legendEntries[0]?.color || "var(--primary-color)";
    const chartHeight = `${Math.max(136, Math.min(parseSizeToPixels(styles.chart_height, 150), compactLayout ? 148 : 172))}px`;
    const valueSize = `${Math.max(26, Math.min(parseSizeToPixels(styles.value_size, 52), compactLayout ? 32 : 38))}px`;
    const unitSize = `${Math.max(12, Math.min(parseSizeToPixels(styles.unit_size, 18), compactLayout ? 14 : 16))}px`;
    const titleSize = `${Math.max(11, Math.min(parseSizeToPixels(styles.title_size, 14), compactLayout ? 11.5 : 12.5))}px`;
    const legendSize = `${Math.max(10, Math.min(parseSizeToPixels(styles.legend_size, 12), compactLayout ? 10 : 11))}px`;
    const lineWidth = `${Math.max(1.6, Math.min(parseSizeToPixels(styles.line_width, 2.2), compactLayout ? 1.9 : 2.2))}`;
    const padEdges = parsePaddingEdges(styles.card.padding, 16);
    const cardPaddingPx = Math.max(12, Math.round((padEdges.left + padEdges.right) / 2));
    const chartBleed = Math.round(Math.max(padEdges.left, padEdges.right, cardPaddingPx) * 0.98);
    const chartBleedLeft = Math.round(padEdges.left);
    const chartBleedRight = Math.round(padEdges.right);
    const chartBleedBottom = Math.round(padEdges.bottom);
    const cardBackground = `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 8%, color-mix(in srgb, var(--primary-text-color) 2%, transparent)) 0%, ${styles.card.background} 100%)`;
    const computedCardBorder = `1px solid color-mix(in srgb, ${accentColor} 20%, var(--divider-color))`;
    const cardBorder = String(styles.card.border || "").trim() && styles.card.border !== DEFAULT_CONFIG.styles.card.border
      ? styles.card.border
      : computedCardBorder;
    const cardShadow = `${styles.card.box_shadow}, 0 18px 36px color-mix(in srgb, ${accentColor} 8%, rgba(0, 0, 0, 0.16))`;
    const tooltipTint = hover?.values?.[0]?.color || accentColor;
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const shouldAnimateChart = animations.enabled && (shouldAnimateEntrance || this._animateChartOnNextRender);
    const anchorXPct = hover ? graphChartXToPercent(hover.x, chart) : 0;
    const tooltipMarkup = hover
      ? `
        <div
          class="graph-card__tooltip ${this._hoverEntering && animations.enabled ? "graph-card__tooltip--entering" : ""}"
          data-anchor-x-pct="${anchorXPct.toFixed(4)}"
          style="left:${anchorXPct.toFixed(3)}%; --tooltip-tint:${escapeHtml(tooltipTint)};"
        >
          <div class="graph-card__tooltip-time">${escapeHtml(hover.label)}</div>
          <div class="graph-card__tooltip-values">
            ${hover.values.map(item => `
              <div class="graph-card__tooltip-row">
                <span class="graph-card__tooltip-dot" style="background:${escapeHtml(item.color)};"></span>
                <span class="graph-card__tooltip-name">${escapeHtml(item.name)}</span>
                <span class="graph-card__tooltip-value">${escapeHtml(item.value)}${item.unit ? ` ${escapeHtml(item.unit)}` : ""}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `
      : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --graph-card-hover-duration: ${animations.enabled ? animations.hoverDuration : 0}ms;
          --graph-card-line-draw-duration: ${animations.enabled ? Math.max(560, Math.round(animations.hoverDuration * 2.7)) : 0}ms;
          --graph-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
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

        .graph-card {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${accentColor} 12%, transparent) 0%, transparent 44%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.018) 0%, rgba(0, 0, 0, 0.02) 100%),
            ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          position: relative;
        }

        .graph-card__content {
          cursor: ${this._canRunTapAction() ? "pointer" : "default"};
          display: flex;
          flex-direction: column;
          gap: ${styles.card.gap};
          height: 100%;
          min-height: 0;
          padding: ${styles.card.padding};
          position: relative;
          z-index: 1;
        }

        .graph-card__content--entering {
          animation: graph-card-content-in calc(var(--graph-card-hover-duration) * 2.25) cubic-bezier(0.18, 0.9, 0.22, 1) both;
        }

        .graph-card__header {
          align-items: center;
          display: flex;
          gap: 8px;
          justify-content: flex-start;
          min-width: 0;
        }

        .graph-card__content--entering .graph-card__header {
          animation: graph-card-section-in calc(var(--graph-card-hover-duration) * 2.1) cubic-bezier(0.18, 0.9, 0.22, 1) both;
          animation-delay: 35ms;
        }

        .graph-card__primary-row {
          align-items: center;
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          gap: 10px 14px;
          justify-content: space-between;
          min-height: 0;
          min-width: 0;
        }

        .graph-card__primary-row .graph-card__value {
          flex: 0 1 auto;
          min-width: 0;
        }

        .graph-card__primary-row .graph-card__legend {
          flex: 1 1 0;
          justify-content: flex-end;
          margin-bottom: 0;
          min-width: 0;
        }

        .graph-card__legend--solo {
          margin-bottom: 4px;
          width: 100%;
        }

        .graph-card__title {
          color: var(--primary-text-color);
          font-size: ${titleSize};
          font-weight: 500;
          line-height: 1.15;
          min-width: 0;
          opacity: 0.95;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .graph-card__icon {
          align-items: center;
          background: linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 6%, transparent) 0%, color-mix(in srgb, var(--primary-text-color) 3%, transparent) 100%);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 18px;
          color: ${styles.icon.color};
          display: inline-flex;
          height: 38px;
          justify-content: center;
          opacity: 0.9;
          padding: 0 10px;
          position: relative;
        }

        .graph-card__icon ha-icon {
          --mdc-icon-size: ${Math.max(22, parseSizeToPixels(styles.icon.size, 28))}px;
          height: ${Math.max(22, parseSizeToPixels(styles.icon.size, 28))}px;
          width: ${Math.max(22, parseSizeToPixels(styles.icon.size, 28))}px;
        }

        .graph-card__unavailable-badge {
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
          right: -4px;
          top: -3px;
          width: 18px;
          z-index: 2;
        }

        .graph-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          height: 11px;
          width: 11px;
        }

        .graph-card__value {
          align-items: baseline;
          display: flex;
          flex-wrap: nowrap;
          gap: 4px;
          line-height: 0.9;
          min-width: 0;
        }

        .graph-card__content--entering > .graph-card__value,
        .graph-card__content--entering .graph-card__primary-row .graph-card__value {
          animation: graph-card-section-in calc(var(--graph-card-hover-duration) * 2.2) cubic-bezier(0.18, 0.9, 0.22, 1) both;
          animation-delay: 75ms;
        }

        .graph-card__value-number {
          font-size: ${valueSize};
          font-weight: 520;
          letter-spacing: -0.042em;
          line-height: 0.86;
          min-width: 0;
        }

        .graph-card__value-unit {
          font-size: ${unitSize};
          font-weight: 560;
          line-height: 0.92;
          opacity: 0.9;
          padding-top: 1px;
        }

        .graph-card__legend {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 5px 6px;
          justify-content: flex-start;
          margin-bottom: 0;
          min-height: 0;
          padding-top: 0;
        }

        .graph-card__content--entering > .graph-card__legend,
        .graph-card__content--entering .graph-card__primary-row .graph-card__legend {
          animation: graph-card-section-in calc(var(--graph-card-hover-duration) * 2.1) cubic-bezier(0.18, 0.9, 0.22, 1) both;
          animation-delay: 105ms;
        }

        .graph-card__legend-item {
          align-items: center;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.045) 0%, color-mix(in srgb, var(--primary-text-color) 3%, transparent) 100%);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font-size: max(10px, calc(${legendSize} - 1px));
          gap: 6px;
          max-width: min(100%, 184px);
          min-width: 0;
          opacity: 0.9;
          padding: 4px 8px;
          transform: translateZ(0);
          transform-origin: center;
          transition: opacity 160ms ease, transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
          will-change: transform;
        }

        .graph-card__content--entering .graph-card__legend-item {
          animation: graph-card-legend-in calc(var(--graph-card-hover-duration) * 1.8) cubic-bezier(0.18, 0.9, 0.22, 1.12) both;
          animation-delay: calc(135ms + var(--legend-delay, 0ms));
        }

        .graph-card__legend-item:hover {
          opacity: 1;
          transform: translateY(-1px);
        }

        .graph-card__legend-item--active {
          background: linear-gradient(180deg, color-mix(in srgb, var(--legend-color) 14%, rgba(255,255,255,0.05)) 0%, rgba(255,255,255,0.035) 100%);
          border-color: color-mix(in srgb, var(--legend-color) 34%, rgba(255,255,255,0.08));
          box-shadow: 0 12px 24px color-mix(in srgb, var(--legend-color) 10%, rgba(0, 0, 0, 0.14));
        }

        .graph-card__legend-item--muted {
          opacity: 0.48;
        }

        .graph-card__legend-dot {
          border-radius: 999px;
          display: inline-flex;
          flex: 0 0 auto;
          height: 8px;
          width: 8px;
        }

        .graph-card__legend-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .graph-card__chart-wrap {
          background:
            linear-gradient(180deg, color-mix(in srgb, ${accentColor} 8%, transparent) 0%, transparent 62%),
            color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border-radius: ${styles.card.border_radius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          flex: 1 1 auto;
          margin: 14px -${chartBleedRight}px -${chartBleedBottom}px -${chartBleedLeft}px;
          max-width: none;
          min-height: ${chartHeight};
          min-width: 0;
          overflow: hidden;
          padding: 4px 0 12px;
          position: relative;
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
          width: calc(100% + ${chartBleedLeft + chartBleedRight}px);
        }

        .graph-card__chart-wrap--entering {
          animation: graph-card-chart-panel-in calc(var(--graph-card-hover-duration) * 2.25) cubic-bezier(0.18, 0.9, 0.22, 1.02) both;
        }

        .graph-card__hover-points-layer {
          bottom: 12px;
          left: 0;
          overflow: hidden;
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 4px;
          z-index: 2;
        }

        .graph-card__chart {
          display: block;
          height: 100%;
          position: relative;
          width: 100%;
          z-index: 1;
        }

        .graph-card__hover-line {
          stroke: color-mix(in srgb, var(--primary-text-color) 16%, transparent);
          stroke-dasharray: 2 4;
          stroke-width: 0.7;
        }

        .graph-card__hover-point {
          align-items: center;
          display: inline-flex;
          height: 14px;
          justify-content: center;
          left: 0;
          pointer-events: none;
          position: absolute;
          top: 0;
          transform: translate(-50%, -50%);
          width: 14px;
          z-index: 3;
        }

        .graph-card__hover-dot {
          background: radial-gradient(
            circle at 35% 35%,
            rgba(255, 255, 255, 0.98) 0 35%,
            color-mix(in srgb, var(--dot-color) 44%, rgba(255, 255, 255, 0.92)) 36% 100%
          );
          border-radius: 999px;
          box-shadow:
            0 0 0 3px color-mix(in srgb, var(--dot-color) 14%, transparent),
            0 0 10px color-mix(in srgb, var(--dot-color) 20%, transparent);
          display: block;
          flex-shrink: 0;
          height: 8px;
          width: 8px;
          animation: graph-card-hover-dot-pulse calc(var(--graph-card-hover-duration, 180ms) * 2.35) ease-in-out infinite alternate;
          transform-origin: center;
          will-change: transform;
        }

        .graph-card__tooltip {
          -webkit-backdrop-filter: blur(14px);
          backdrop-filter: blur(14px);
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--tooltip-tint) 20%, rgba(255,255,255,0.1)), rgba(255,255,255,0.02)),
            color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 94%, rgba(255,255,255,0.02));
          border: 1px solid color-mix(in srgb, var(--tooltip-tint) 22%, color-mix(in srgb, var(--primary-text-color) 10%, transparent));
          border-radius: 16px;
          box-shadow:
            0 10px 24px rgba(0, 0, 0, 0.24),
            0 2px 6px color-mix(in srgb, var(--tooltip-tint) 14%, transparent);
          color: var(--primary-text-color);
          display: grid;
          gap: 8px;
          max-width: min(260px, calc(100% - 20px));
          min-width: 186px;
          padding: 10px 12px 11px;
          pointer-events: none;
          position: fixed;
          transform: var(--graph-tooltip-transform, translate(-50%, -100%));
          will-change: left, top, transform;
          z-index: 2147483001;
        }

        .graph-card__tooltip::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--tooltip-tint) 18%, rgba(255,255,255,0.09)), rgba(255,255,255,0.025)),
            color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 90%, transparent);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 16%, transparent),
            inset 0 -1px 0 rgba(0, 0, 0, 0.06);
          z-index: -1;
        }

        .graph-card__tooltip--entering {
          animation: graph-card-tooltip-in var(--graph-card-hover-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .graph-card__tooltip-time {
          color: var(--secondary-text-color);
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .graph-card__tooltip-values {
          display: grid;
          gap: 5px;
        }

        .graph-card__tooltip-row {
          align-items: center;
          display: grid;
          gap: 7px;
          grid-template-columns: auto minmax(0, 1fr) auto;
          min-width: 0;
        }

        .graph-card__tooltip-dot {
          border-radius: 999px;
          display: inline-flex;
          height: 8px;
          width: 8px;
        }

        .graph-card__tooltip-name {
          color: var(--secondary-text-color);
          font-size: 10px;
          font-weight: 750;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .graph-card__tooltip-value {
          font-size: 12px;
          font-weight: 850;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .graph-card__chart-empty {
          align-items: center;
          color: var(--secondary-text-color);
          display: flex;
          font-size: 13px;
          inset: 0;
          justify-content: center;
          opacity: 0.8;
          position: absolute;
        }

        .graph-card__chart-series-fill {
          opacity: 0;
          transform-origin: center bottom;
        }

        .graph-card__chart-series-glow {
          display: block;
          fill: none;
          filter: url(#graph-glow);
          opacity: 0.12;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: calc(${lineWidth} * 1.8);
        }

        .graph-card__chart-series-line {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-opacity: 0.96;
          stroke-width: ${lineWidth};
        }

        .graph-card__chart-series-glow--entering {
          animation: graph-card-glow-draw var(--graph-card-line-draw-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: calc(70ms + var(--series-delay, 0ms));
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
        }

        .graph-card__chart-series-line--entering {
          animation: graph-card-line-draw var(--graph-card-line-draw-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: calc(70ms + var(--series-delay, 0ms));
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
        }

        .graph-card__hover-points-layer--entering .graph-card__hover-point {
          animation: graph-card-hover-point-in var(--graph-card-hover-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .graph-card__hover-line--entering {
          animation: graph-card-hover-line-in var(--graph-card-hover-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .graph-card__legend-item.is-pressing,
        .graph-card__content.is-pressing {
          animation: graph-card-button-bounce var(--graph-card-button-bounce-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        @keyframes graph-card-content-in {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes graph-card-section-in {
          0% {
            opacity: 0;
            transform: translateY(9px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes graph-card-legend-in {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.94);
          }
          68% {
            opacity: 1;
            transform: translateY(0) scale(1.018);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes graph-card-chart-panel-in {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes graph-card-area-in {
          0% {
            opacity: 0;
            transform: scaleY(0.74);
          }
          100% {
            opacity: 0;
            transform: scaleY(1);
          }
        }

        @keyframes graph-card-line-draw {
          0% {
            opacity: 0;
            stroke-dashoffset: 1;
          }
          36% {
            opacity: 1;
          }
          100% {
            opacity: 1;
            stroke-dashoffset: 0;
          }
        }

        @keyframes graph-card-glow-draw {
          0% {
            opacity: 0;
            stroke-dashoffset: 1;
          }
          36% {
            opacity: 0.14;
          }
          100% {
            opacity: 0.14;
            stroke-dashoffset: 0;
          }
        }

        @keyframes graph-card-tooltip-in {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes graph-card-hover-point-in {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.72);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes graph-card-hover-dot-pulse {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0.94;
            transform: scale(1.14);
          }
        }

        @keyframes graph-card-hover-line-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }

        @keyframes graph-card-button-bounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }

        ${animations.enabled ? "" : `
        .graph-card__legend-item,
        .graph-card__tooltip,
        .graph-card__hover-line,
        .graph-card__hover-point,
        .graph-card__hover-dot,
        .graph-card__content,
        .graph-card__header,
        .graph-card__primary-row,
        .graph-card__value,
        .graph-card__legend,
        .graph-card__chart-wrap,
        .graph-card__chart-series-fill,
        .graph-card__chart-series-glow,
        .graph-card__chart-series-line {
          animation: none !important;
          transition: none !important;
        }
        `}

        @media (max-width: 640px) {
          .graph-card__header {
            gap: 8px;
          }

          /* Keep value + legend chips on one row; scroll chips horizontally if needed
             (wrapping pushed the chart up and overlapped the plot). */
          .graph-card__primary-row {
            flex-wrap: nowrap;
            gap: 8px 10px;
          }

          .graph-card__primary-row .graph-card__value {
            flex: 0 1 auto;
            min-width: 0;
          }

          .graph-card__primary-row .graph-card__legend {
            flex: 1 1 0;
            flex-wrap: nowrap;
            justify-content: flex-end;
            margin-bottom: 0;
            min-width: 0;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            scrollbar-width: thin;
            -webkit-overflow-scrolling: touch;
          }

          .graph-card__primary-row .graph-card__legend-item {
            flex-shrink: 0;
            max-width: min(52vw, 160px);
          }
        }
      </style>
      <ha-card class="graph-card">
        <div class="graph-card__content ${shouldAnimateEntrance ? "graph-card__content--entering" : ""}" ${this._canRunTapAction() ? 'data-graph-action="primary"' : ""}>
          ${
            config.show_header !== false
              ? `
                <div class="graph-card__header">
                  ${
                    config.show_icon !== false
                      ? `
                        <div class="graph-card__icon">
                          <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
                          ${showUnavailableBadge ? `<span class="graph-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
                        </div>
                      `
                      : ""
                  }
                  <div class="graph-card__title">${escapeHtml(title)}</div>
                </div>
              `
              : ""
          }

          ${
            config.show_value !== false && config.show_legend !== false
              ? `
                <div class="graph-card__primary-row">
                  <div class="graph-card__value">
                    <div class="graph-card__value-number">${escapeHtml(currentValue.value)}</div>
                    ${currentValue.unit ? `<div class="graph-card__value-unit">${escapeHtml(currentValue.unit)}</div>` : ""}
                  </div>
                  <div class="graph-card__legend">
                    ${legendEntries.map((entry, index) => `
                      <div
                        class="graph-card__legend-item ${entry.active ? "graph-card__legend-item--active" : ""} ${entry.muted ? "graph-card__legend-item--muted" : ""}"
                        data-graph-series="${escapeHtml(entry.entity)}"
                        style="--legend-color:${escapeHtml(entry.color)}; --legend-delay:${Math.min(index, 8) * 34}ms;"
                      >
                        <span class="graph-card__legend-dot" style="background:${escapeHtml(entry.color)};"></span>
                        <span class="graph-card__legend-text">${escapeHtml(entry.name)}</span>
                      </div>
                    `).join("")}
                  </div>
                </div>
              `
              : ""
          }
          ${
            config.show_value !== false && config.show_legend === false
              ? `
                <div class="graph-card__value">
                  <div class="graph-card__value-number">${escapeHtml(currentValue.value)}</div>
                  ${currentValue.unit ? `<div class="graph-card__value-unit">${escapeHtml(currentValue.unit)}</div>` : ""}
                </div>
              `
              : ""
          }
          ${
            config.show_value === false && config.show_legend !== false
              ? `
                <div class="graph-card__legend graph-card__legend--solo">
                  ${legendEntries.map((entry, index) => `
                    <div
                      class="graph-card__legend-item ${entry.active ? "graph-card__legend-item--active" : ""} ${entry.muted ? "graph-card__legend-item--muted" : ""}"
                      data-graph-series="${escapeHtml(entry.entity)}"
                      style="--legend-color:${escapeHtml(entry.color)}; --legend-delay:${Math.min(index, 8) * 34}ms;"
                    >
                      <span class="graph-card__legend-dot" style="background:${escapeHtml(entry.color)};"></span>
                      <span class="graph-card__legend-text">${escapeHtml(entry.name)}</span>
                    </div>
                  `).join("")}
                </div>
              `
              : ""
          }

          <div class="graph-card__chart-wrap ${shouldAnimateChart ? "graph-card__chart-wrap--entering" : ""}" data-graph-surface="chart" data-visible-inset="${chartBleed}">
            <svg class="graph-card__chart" viewBox="0 0 ${chart.width} ${chart.height}" preserveAspectRatio="none">
              <defs>
                <filter id="graph-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="1.5" />
                </filter>
                ${chart.entries.map((entry, index) => `
                  <linearGradient id="graph-fill-${index}" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="${escapeHtml(entry.color)}" stop-opacity="0.22"></stop>
                    <stop offset="54%" stop-color="${escapeHtml(entry.color)}" stop-opacity="0.07"></stop>
                    <stop offset="100%" stop-color="${escapeHtml(entry.color)}" stop-opacity="0"></stop>
                  </linearGradient>
                `).join("")}
              </defs>
              ${
                hover
                  ? `<line class="graph-card__hover-line ${this._hoverEntering && animations.enabled ? "graph-card__hover-line--entering" : ""}" x1="${hoverLineX.toFixed(2)}" y1="0" x2="${hoverLineX.toFixed(2)}" y2="${chart.height}"></line>`
                  : ""
              }
              ${chart.entries.map((entry, index) => `
                ${
                  config.show_fill !== false
                    ? `<path class="graph-card__chart-series-fill" style="--series-delay:${Math.min(index, 8) * 42}ms;" d="${entry.fillPath}" fill="url(#graph-fill-${index})"></path>`
                    : ""
                }
                <path class="graph-card__chart-series-glow ${shouldAnimateChart ? "graph-card__chart-series-glow--entering" : ""}" style="--series-delay:${Math.min(index, 8) * 42}ms;" pathLength="1" d="${entry.linePath}" stroke="${escapeHtml(entry.color)}"></path>
                <path class="graph-card__chart-series-line ${shouldAnimateChart ? "graph-card__chart-series-line--entering" : ""}" style="--series-delay:${Math.min(index, 8) * 42}ms;" pathLength="1" d="${entry.linePath}" stroke="${escapeHtml(entry.color)}"></path>
              `).join("")}
            </svg>
            ${
              hover
                ? `
                  <div class="graph-card__hover-points-layer ${this._hoverEntering && animations.enabled ? "graph-card__hover-points-layer--entering" : ""}">
                    ${chart.entries.map(entry => {
                      const point = hover.values.find(item => item.name === entry.name)?.point;
                      if (!point) {
                        return "";
                      }
                      const left = clamp(graphChartXToPercent(point.x, chart), 0.3, 99.7);
                      const top = clamp((point.y / chart.height) * 100, 0.3, 99.7);
                      return `
                        <span class="graph-card__hover-point" style="left:${left}%; top:${top}%; --dot-color:${escapeHtml(entry.color)};">
                          <span class="graph-card__hover-dot"></span>
                        </span>
                      `;
                    }).join("")}
                  </div>
                `
                : ""
            }
            ${hasGraphData ? "" : `<div class="graph-card__chart-empty">${escapeHtml(window.NodaliaI18n?.translateGraphEmptyHistory?.(this._hass, this._config?.language ?? "auto") || "Sin historial disponible")}</div>`}
          </div>
        </div>
      </ha-card>
      ${tooltipMarkup}
    `;

    this._scheduleTooltipPositionSync(4);
    this._hoverEntering = false;
    if (shouldAnimateEntrance) {
      this._animateContentOnNextRender = false;
    }
    if (shouldAnimateChart) {
      this._animateChartOnNextRender = false;
    }
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaGraphCard);
}

class NodaliaGraphCardEditorLegacy extends HTMLElement {
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
    const shouldRender = !this._hass || nextSignature !== this._entityOptionsSignature || !this.shadowRoot?.innerHTML;
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
    return window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id =>
      id.startsWith("sensor.") || id.startsWith("number.") || id.startsWith("input_number."),
    );
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
      (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) &&
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
      case "entities":
        return String(input.value || "")
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean)
          .map((line, index) => {
            const [entity, name = "", color = ""] = line.split("|").map(part => part.trim());
            return {
              entity,
              name,
              color: color || SERIES_COLORS[index % SERIES_COLORS.length],
            };
          })
          .filter(entry => entry.entity);
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

  _renderTextareaField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";

    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <textarea
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
          rows="${escapeHtml(String(options.rows || 4))}"
          ${placeholder}
        >${escapeHtml(inputValue)}</textarea>
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

  _serializeEntities() {
    return this._config.entities
      .map(entry => [entry.entity || "", entry.name || "", entry.color || ""].join("|"))
      .join("\n");
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
        .editor-field textarea {
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

        .editor-field textarea {
          min-height: 110px;
          resize: vertical;
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("General"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Configura titulo, entidades y rango visible de la grafica."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Temperatura",
            })}
            ${this._renderTextField("Icono", "icon", config.icon, {
              placeholder: "mdi:water-percent",
            })}
            ${this._renderTextField("Minimo", "min", config.min, {
              type: "number",
              placeholder: "0",
            })}
            ${this._renderTextField("Maximo", "max", config.max, {
              type: "number",
              placeholder: "100",
            })}
            ${this._renderTextField("Horas a mostrar", "hours_to_show", config.hours_to_show, {
              type: "number",
              placeholder: "24",
            })}
            ${this._renderTextField("Puntos", "points", config.points, {
              type: "number",
              placeholder: "48",
            })}
            ${this._renderTextareaField("Entidades", "entities", this._serializeEntities(), {
              valueType: "entities",
              rows: 5,
              placeholder: "sensor.humedad_dormitorio|Dormitorio de Rocio|#f29f05\nsensor.humedad_pasillo|Pasillo|#42a5f5",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Visibilidad"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Activa o desactiva cabecera, valor, leyenda y relleno."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Mostrar cabecera", "show_header", config.show_header !== false)}
            ${this._renderCheckboxField("Mostrar icono", "show_icon", config.show_icon !== false)}
            ${this._renderCheckboxField("Mostrar valor grande", "show_value", config.show_value !== false)}
            ${this._renderCheckboxField("Mostrar leyenda", "show_legend", config.show_legend !== false)}
            ${this._renderCheckboxField("Mostrar relleno", "show_fill", config.show_fill !== false)}
            ${this._renderCheckboxField("Mostrar badge de no disponible", "show_unavailable_badge", config.show_unavailable_badge !== false)}
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Haptics"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Respuesta haptica opcional al tocar la tarjeta."))}</div>
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Estilos"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Ajustes visuales del grafico y el look Nodalia."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Background", "styles.card.background", config.styles.card.background)}
            ${this._renderTextField("Border", "styles.card.border", config.styles.card.border)}
            ${this._renderTextField("Radius", "styles.card.border_radius", config.styles.card.border_radius)}
            ${this._renderTextField("Shadow", "styles.card.box_shadow", config.styles.card.box_shadow)}
            ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
            ${this._renderTextField("Separacion", "styles.card.gap", config.styles.card.gap)}
            ${this._renderTextField("Tamano icono", "styles.icon.size", config.styles.icon.size)}
            ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
            ${this._renderTextField("Tamano valor", "styles.value_size", config.styles.value_size)}
            ${this._renderTextField("Tamano unidad", "styles.unit_size", config.styles.unit_size)}
            ${this._renderTextField("Tamano leyenda", "styles.legend_size", config.styles.legend_size)}
            ${this._renderTextField("Alto grafico", "styles.chart_height", config.styles.chart_height)}
            ${this._renderTextField("Grosor linea", "styles.line_width", config.styles.line_width)}
          </div>
        </section>
      </div>
    `;
  }
}

class NodaliaGraphCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showStyleSection = false;
    this._showAnimationSection = false;
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

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(hass, this._config?.language, id =>
      id.startsWith("sensor.") || id.startsWith("number.") || id.startsWith("input_number."),
    );
  }

  _getEntityOptions(field = "entities.0.entity", domains = []) {
    const normalizedDomains = Array.isArray(domains)
      ? domains.map(domain => String(domain || "").trim()).filter(Boolean)
      : [];
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => (
        !normalizedDomains.length
        || normalizedDomains.some(domain => entityId.startsWith(`${domain}.`))
      ))
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

    const currentValue = String(getByPath(this._config, field) || "").trim();
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
      // Ignore inputs that do not support selection ranges.
    }
  }

  _emitConfig() {
    const focusState = this._captureFocusState();
    const nextConfig = deepClone(this._config);

    if (!Array.isArray(nextConfig.entities)) {
      nextConfig.entities = [];
    }

    delete nextConfig.entity;
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
      case "tristate":
        if (input.value === "true") {
          return true;
        }

        if (input.value === "false") {
          return false;
        }

        return undefined;
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

    if (toggleButton) {
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
      }

      return;
    }

    const button = event
      .composedPath()
      .find(node => node instanceof HTMLButtonElement && node.dataset?.action);

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const action = button.dataset.action;
    const index = Number(button.dataset.index);
    this._config.entities = Array.isArray(this._config.entities) ? this._config.entities : [];

    if (action === "add-series") {
      this._config.entities.push({
        entity: "",
        name: "",
        color: SERIES_COLORS[this._config.entities.length % SERIES_COLORS.length],
      });
      this._emitConfig();
      return;
    }

    if (!Number.isInteger(index) || index < 0 || index >= this._config.entities.length) {
      return;
    }

    if (action === "remove-series") {
      this._config.entities.splice(index, 1);
      this._emitConfig();
      return;
    }

    if (action === "move-series-up") {
      moveItem(this._config.entities, index, index - 1);
      this._emitConfig();
      return;
    }

    if (action === "move-series-down") {
      moveItem(this._config.entities, index, index + 1);
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
    const tColorCustom = this._editorLabel("Color personalizado");
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

  _renderSelectField(label, field, value, options, valueType = "string") {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}" data-value-type="${escapeHtml(valueType)}">
          ${options
            .map(option => {
              const optionValue = option.value === undefined ? "auto" : String(option.value);
              const isSelected =
                value === option.value ||
                (option.value === undefined && value === undefined);

              return `
                <option value="${escapeHtml(optionValue)}" ${isSelected ? "selected" : ""}>
                  ${escapeHtml(this._editorLabel(option.label))}
                </option>
              `;
            })
            .join("")}
        </select>
      </label>
    `;
  }

  _renderEntityField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const domains = Array.isArray(options.domains)
      ? options.domains.map(domain => String(domain || "").trim()).filter(Boolean).join(",")
      : "";

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(options.placeholder || "")}"
          data-domains="${escapeHtml(domains)}"
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

  _renderSeriesCard(series, index, total) {
    const fallbackColor = SERIES_COLORS[index % SERIES_COLORS.length];

    return `
      <div class="series-editor-card">
        <div class="series-editor-card__header">
          <div class="series-editor-card__title">${escapeHtml(this._editorLabel("Serie"))} ${index + 1}</div>
          <div class="series-editor-card__actions">
            <button type="button" data-action="move-series-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>${escapeHtml(this._editorLabel("Subir"))}</button>
            <button type="button" data-action="move-series-down" data-index="${index}" ${index === total - 1 ? "disabled" : ""}>${escapeHtml(this._editorLabel("Bajar"))}</button>
            <button type="button" data-action="remove-series" data-index="${index}" class="danger">${escapeHtml(this._editorLabel("Eliminar"))}</button>
          </div>
        </div>
        <div class="series-editor-subgroup">
          <div class="series-editor-subgroup__title">${escapeHtml(this._editorLabel("Datos"))}</div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityField("Entidad", `entities.${index}.entity`, series.entity, {
              domains: ["sensor", "number", "input_number"],
              placeholder: "sensor.humedad_dormitorio",
              fullWidth: true,
            })}
            ${this._renderTextField("Nombre visible", `entities.${index}.name`, series.name, {
              placeholder: "Dormitorio",
              fullWidth: true,
            })}
            ${this._renderColorField("Color de la linea", `entities.${index}.color`, series.color, {
              fallbackValue: fallbackColor,
            })}
          </div>
        </div>
      </div>
    `;
  }

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entities.0.entity";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    const allowedDomains = String(host.dataset.domains || "")
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      if (allowedDomains.length) {
        control.includeDomains = allowedDomains;
        control.entityFilter = stateObj => allowedDomains.some(domain => String(stateObj?.entity_id || "").startsWith(`${domain}.`));
      }
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
      control.allowCustomEntity = true;
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: allowedDomains.length === 1
          ? { domain: allowedDomains[0] }
          : {},
      };
    } else {
      control = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder || this._editorLabel("Selecciona una entidad");
      control.appendChild(emptyOption);
      this._getEntityOptions(field, allowedDomains).forEach(option => {
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
    const entities = Array.isArray(config.entities) ? config.entities : [];

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

        .editor-grid--stacked {
          grid-template-columns: 1fr;
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

        .editor-field textarea {
          min-height: 72px;
          resize: vertical;
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

        .editor-actions {
          display: flex;
          justify-content: flex-start;
        }

        button {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          min-height: 34px;
          padding: 0 12px;
        }

        button.danger {
          color: var(--error-color);
        }

        button:disabled {
          cursor: default;
          opacity: 0.45;
        }

        .series-editor-list {
          display: grid;
          gap: 12px;
        }

        .series-editor-card {
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 16px;
          display: grid;
          gap: 12px;
          padding: 14px;
        }

        .series-editor-subgroup {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border-radius: 14px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }

        .series-editor-subgroup__title {
          font-size: 12px;
          font-weight: 700;
        }

        .series-editor-card__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        .series-editor-card__title {
          font-size: 13px;
          font-weight: 700;
        }

        .series-editor-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .empty-note {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }

          .series-editor-card__header {
            align-items: start;
            flex-direction: column;
          }

          .series-editor-card__actions {
            justify-content: flex-start;
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("General"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Nombre, icono, rango visible y comportamiento basico de la grafica."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Nombre", "name", config.name, {
              placeholder: "Estadisticas",
            })}
            ${this._renderIconPickerField("Icono", "icon", config.icon, {
              placeholder: "mdi:chart-line",
            })}
            ${this._renderSelectField(
              "Acción al tocar",
              "tap_action",
              config.tap_action || "more-info",
              [
                { value: "more-info", label: "Más información" },
                { value: "none", label: "Sin accion" },
              ],
            )}
            ${this._renderTextField("Horas a mostrar", "hours_to_show", config.hours_to_show, {
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("Puntos", "points", config.points, {
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("Minimo", "min", config.min, {
              type: "number",
              valueType: "number",
            })}
            ${this._renderTextField("Maximo", "max", config.max, {
              type: "number",
              valueType: "number",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Series"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Anade, reordena y personaliza cada entidad mostrada en la grafica."))}</div>
          </div>
          <div class="series-editor-list">
            ${
              entities.length
                ? entities.map((series, index) => this._renderSeriesCard(series, index, entities.length)).join("")
                : `<div class="empty-note">${escapeHtml(this._editorLabel("Todavia no has anadido ninguna serie."))}</div>`
            }
          </div>
          <div class="editor-actions">
            <button type="button" data-action="add-series">${escapeHtml(this._editorLabel("Anadir serie"))}</button>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Visibilidad"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Activa o desactiva cabecera, valor grande, leyenda y relleno."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Mostrar cabecera", "show_header", config.show_header !== false)}
            ${this._renderCheckboxField("Mostrar icono", "show_icon", config.show_icon !== false)}
            ${this._renderCheckboxField("Mostrar valor grande", "show_value", config.show_value !== false)}
            ${this._renderCheckboxField("Mostrar leyenda", "show_legend", config.show_legend !== false)}
            ${this._renderCheckboxField("Mostrar relleno", "show_fill", config.show_fill !== false)}
            ${this._renderCheckboxField("Mostrar badge de no disponible", "show_unavailable_badge", config.show_unavailable_badge !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Haptics"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Respuesta tactil opcional para taps, hover y cambios de serie."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Activar haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("Fallback con vibracion", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "Estilo",
              "haptics.style",
              hapticStyle,
              [
                { value: "selection", label: "Selección" },
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Animaciones"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Controla la entrada del tooltip y el rebote visual de los chips."))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showAnimationSection ? this._editorLabel("Ocultar ajustes de animacion") : this._editorLabel("Mostrar ajustes de animacion"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showAnimationSection
              ? `
                <div class="editor-grid">
                  ${this._renderCheckboxField("Activar animaciones", "animations.enabled", config.animations.enabled !== false)}
                  ${this._renderTextField("Tooltip y hover (ms)", "animations.hover_duration", config.animations.hover_duration, {
                    type: "number",
                    valueType: "number",
                  })}
                  ${this._renderTextField("Rebote de chips (ms)", "animations.button_bounce_duration", config.animations.button_bounce_duration, {
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Estilos"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Ajustes visuales de la card, el icono y el grafico."))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="styles"
                aria-expanded="${this._showStyleSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showStyleSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showStyleSection ? this._editorLabel("Ocultar ajustes de estilo") : this._editorLabel("Mostrar ajustes de estilo"))}</span>
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
                <div class="editor-grid">
                  ${this._renderColorField("Fondo tarjeta", "styles.card.background", config.styles.card.background)}
                  ${this._renderTextField("Borde", "styles.card.border", config.styles.card.border)}
                  ${this._renderTextField("Radio del borde", "styles.card.border_radius", config.styles.card.border_radius)}
                  ${this._renderTextField("Sombra", "styles.card.box_shadow", config.styles.card.box_shadow)}
                  ${this._renderTextField("Padding", "styles.card.padding", config.styles.card.padding)}
                  ${this._renderTextField("Separacion", "styles.card.gap", config.styles.card.gap)}
                  ${this._renderColorField("Color icono", "styles.icon.color", config.styles.icon.color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderTextField("Tamano icono", "styles.icon.size", config.styles.icon.size)}
                  ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles.title_size)}
                  ${this._renderTextField("Tamano valor", "styles.value_size", config.styles.value_size)}
                  ${this._renderTextField("Tamano unidad", "styles.unit_size", config.styles.unit_size)}
                  ${this._renderTextField("Tamano leyenda", "styles.legend_size", config.styles.legend_size)}
                  ${this._renderTextField("Alto grafica", "styles.chart_height", config.styles.chart_height)}
                  ${this._renderTextField("Grosor linea", "styles.line_width", config.styles.line_width)}
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
  customElements.define(EDITOR_TAG, NodaliaGraphCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Graph Card",
  description: "Tarjeta de grafica elegante para una o varias entidades numericas con estilo Nodalia.",
  preview: true,
});
