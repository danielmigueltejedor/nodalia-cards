const CARD_TAG = "nodalia-power-flow-card";
const EDITOR_TAG = "nodalia-power-flow-card-editor";
const CARD_VERSION = "0.14.0";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};

const NODE_DEFAULTS = {
  grid: {
    name: "Red",
    icon: "mdi:transmission-tower",
    color: "#6da8ff",
    entity: "",
    secondary_info: {},
  },
  home: {
    name: "Casa",
    icon: "mdi:home",
    color: "#ffffff",
    entity: "",
    secondary_info: {},
  },
  solar: {
    name: "Solar",
    icon: "mdi:solar-power-variant",
    color: "#f6b73c",
    entity: "",
    secondary_info: {},
  },
  battery: {
    name: "Bateria",
    icon: "mdi:battery",
    color: "#61c97a",
    entity: "",
    secondary_info: {},
  },
  water: {
    name: "Agua",
    icon: "mdi:water",
    color: "#55b7ff",
    entity: "",
    secondary_info: {},
  },
  gas: {
    name: "Gas",
    icon: "mdi:fire",
    color: "#f28a5d",
    entity: "",
    secondary_info: {},
  },
};

const DEFAULT_CONFIG = {
  title: "",
  name: "",
  entities: {
    grid: deepCloneNode(NODE_DEFAULTS.grid),
    home: deepCloneNode(NODE_DEFAULTS.home),
    solar: deepCloneNode(NODE_DEFAULTS.solar),
    battery: deepCloneNode(NODE_DEFAULTS.battery),
    water: deepCloneNode(NODE_DEFAULTS.water),
    gas: deepCloneNode(NODE_DEFAULTS.gas),
    individual: [],
  },
  display_zero_lines: {
    mode: "show",
    transparency: 50,
    grey_color: [189, 189, 189],
  },
  dashboard_link: "",
  dashboard_link_label: "Energia",
  show_header: true,
  show_dashboard_link_button: true,
  show_labels: true,
  show_values: true,
  show_secondary_info: true,
  show_unavailable_badge: true,
  clickable_entities: true,
  tap_action: "none",
  min_flow_rate: 1.4,
  max_flow_rate: 5.8,
  haptics: {
    enabled: true,
    style: "medium",
    fallback_vibrate: false,
  },
  animations: {
    enabled: true,
    content_duration: 460,
    button_bounce_duration: 320,
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "32px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "12px",
      gap: "10px",
    },
    icon: {
      node_size: "48px",
      home_size: "96px",
      individual_size: "40px",
      color: "var(--primary-text-color)",
    },
    title_size: "15px",
    chip_height: "21px",
    chip_font_size: "10px",
    chip_padding: "0 9px",
    home_value_size: "22px",
    home_unit_size: "14px",
    node_value_size: "11px",
    secondary_size: "10px",
    flow_width: "3px",
  },
};

const STUB_CONFIG = {
  title: "Energia",
  entities: {
    grid: {
      entity: "sensor.shelly_pro_3em_puerto_c_potencia",
    },
    home: {
      entity: "sensor.shelly_pro_3em_puerto_c_potencia",
    },
    solar: {
      entity: "",
    },
    battery: {
      entity: "",
    },
    individual: [],
  },
  dashboard_link: "/energy/overview",
};

function deepCloneNode(value) {
  return JSON.parse(JSON.stringify(value));
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

function getStubEntityId(hass, domains = []) {
  const states = hass?.states || {};
  const normalizedDomains = domains.map(domain => String(domain).trim()).filter(Boolean);
  return Object.keys(states).find(entityId => (
    !normalizedDomains.length || normalizedDomains.some(domain => entityId.startsWith(`${domain}.`))
  )) || "";
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
  if (typeof probe.remove === "function") {
    probe.remove();
  } else if (probe.parentNode && typeof probe.parentNode.removeChild === "function") {
    probe.parentNode.removeChild(probe);
  }
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
  const nodeColorMatch = normalizedField.match(/entities\.(grid|home|solar|battery|water|gas)\.color$/);

  if (nodeColorMatch) {
    return NODE_DEFAULTS[nodeColorMatch[1]]?.color || "#71c0ff";
  }

  if (normalizedField.endsWith("display_zero_lines.grey_color")) {
    return rgbArrayToColor(DEFAULT_CONFIG.display_zero_lines.grey_color);
  }

  if (normalizedField.endsWith(".color")) {
    return "#71c0ff";
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

function parseNumber(value) {
  const numeric = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function isUnavailableState(state) {
  const key = normalizeTextKey(state?.state);
  return key === "unavailable" || key === "unknown";
}

function formatRawValue(value, decimals = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "--";
  }

  return numeric.toLocaleString("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDisplayValue(value, unit = "") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return { value: "--", unit: unit || "" };
  }

  const normalizedUnit = String(unit || "").trim();
  const key = normalizeTextKey(normalizedUnit);
  if (["w", "watt", "watts"].includes(key) && Math.abs(numeric) >= 1000) {
    return {
      value: formatRawValue(numeric / 1000, 2).replace(/,00$/, "").replace(/0$/, ""),
      unit: "kW",
    };
  }

  const decimals = Math.abs(numeric - Math.round(numeric)) < 0.01 ? 0 : Math.abs(numeric) >= 100 ? 0 : Math.abs(numeric) >= 10 ? 1 : 2;
  return {
    value: formatRawValue(numeric, decimals),
    unit: normalizedUnit,
  };
}

function rgbArrayToColor(value, fallback = [189, 189, 189]) {
  const source = Array.isArray(value) && value.length >= 3 ? value : fallback;
  const [r, g, b] = source.map(item => clamp(Number(item) || 0, 0, 255));
  return `rgb(${r}, ${g}, ${b})`;
}

function arrayFromMaybe(value) {
  return Array.isArray(value) ? value : [];
}

function resolveNodeConfig(kind, config) {
  return mergeConfig(NODE_DEFAULTS[kind] || {}, config?.entities?.[kind] || {});
}

function resolveIndividualConfigs(config) {
  return arrayFromMaybe(config?.entities?.individual)
    .filter(isObject)
    .map((item, index) => ({
      entity: String(item.entity || "").trim(),
      name: String(item.name || "").trim(),
      icon: String(item.icon || "mdi:flash").trim(),
      color: String(item.color || ["#f29f05", "#42a5f5", "#7fd0c8", "#f56aa0"][index % 4]).trim(),
      secondary_info: isObject(item.secondary_info) ? item.secondary_info : {},
    }))
    .filter(item => item.entity);
}

function normalizeConfig(rawConfig) {
  const merged = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  merged.entities = merged.entities || {};
  merged.entities.individual = resolveIndividualConfigs(merged);
  return merged;
}

function getNodePosition(kind, index = 0, total = 0, hasBottomUtilities = false) {
  return getNodePositionForLayout(kind, index, total, hasBottomUtilities, "full");
}

function getLayoutPreset(nodeCounts = {}) {
  const topCount = Number(nodeCounts.top || 0);
  const bottomCount = Number(nodeCounts.bottom || 0);
  const individualCount = Number(nodeCounts.individual || 0);
  const total = topCount + bottomCount + individualCount;

  if (total <= 1 && bottomCount === 0) {
    return "simple";
  }

  if (bottomCount === 0 && individualCount <= 1 && topCount <= 3) {
    return "compact";
  }

  return "full";
}

function getNodePositionForLayout(kind, index = 0, total = 0, hasBottomUtilities = false, layoutPreset = "full") {
  if (layoutPreset === "simple") {
    if (kind === "home") {
      return { x: 58, y: 42 };
    }
    if (kind === "solar") {
      return { x: 50, y: 18 };
    }
    if (kind === "grid") {
      return { x: 26, y: 42 };
    }
    if (kind === "battery") {
      return { x: 80, y: 42 };
    }
    if (kind === "water") {
      return { x: 39, y: 69 };
    }
    if (kind === "gas") {
      return { x: 61, y: 69 };
    }
    if (kind === "individual") {
      return total <= 1 ? { x: 80, y: 42 } : { x: 50, y: 69 };
    }
  }

  if (layoutPreset === "compact") {
    if (kind === "home") {
      return { x: 53, y: 54 };
    }
    if (kind === "solar") {
      return { x: 50, y: 20 };
    }
    if (kind === "grid") {
      return { x: 20, y: 54 };
    }
    if (kind === "battery") {
      return { x: 80, y: 54 };
    }
    if (kind === "water") {
      return total > 1 ? { x: 33, y: 80 } : { x: 41, y: 80 };
    }
    if (kind === "gas") {
      return total > 1 ? { x: 67, y: 80 } : { x: 59, y: 80 };
    }
    if (kind === "individual") {
      const y = hasBottomUtilities ? 88 : 80;
      if (total <= 1) {
        return { x: 79, y: 54 };
      }
      const start = 28;
      const end = 72;
      const step = (end - start) / Math.max(total - 1, 1);
      return {
        x: start + (step * index),
        y,
      };
    }
  }

  if (kind === "home") {
    return { x: 50, y: hasBottomUtilities ? 46 : 54 };
  }
  if (kind === "solar") {
    return { x: 50, y: 20 };
  }
  if (kind === "grid") {
    return { x: 21, y: hasBottomUtilities ? 48 : 54 };
  }
  if (kind === "battery") {
    return { x: 79, y: hasBottomUtilities ? 48 : 54 };
  }
  if (kind === "water") {
    return total > 1 ? { x: 32, y: 81 } : { x: 40, y: 81 };
  }
  if (kind === "gas") {
    return total > 1 ? { x: 68, y: 81 } : { x: 60, y: 81 };
  }
  if (kind === "individual") {
    const y = hasBottomUtilities ? 90 : 81;
    if (total <= 1) {
      return { x: 50, y };
    }
    const start = 26;
    const end = 74;
    const step = (end - start) / Math.max(total - 1, 1);
    return {
      x: start + (step * index),
      y,
    };
  }
  return { x: 50, y: 50 };
}

function offsetPoint(from, to, distance) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(Math.hypot(dx, dy), 0.0001);
  return {
    x: from.x + ((dx / len) * distance),
    y: from.y + ((dy / len) * distance),
  };
}

function buildFlowPath(from, to, fromRadius = 0, toRadius = 0) {
  const start = offsetPoint(from, to, fromRadius);
  const end = offsetPoint(to, from, toRadius);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const horizontalBias = Math.abs(dx) >= Math.abs(dy);
  const cp1 = horizontalBias
    ? { x: start.x + (dx * 0.42), y: start.y }
    : { x: start.x, y: start.y + (dy * 0.42) };
  const cp2 = horizontalBias
    ? { x: end.x - (dx * 0.42), y: end.y }
    : { x: end.x, y: end.y - (dy * 0.42) };

  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)}, ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)}, ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

class NodaliaPowerFlowCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    const config = deepClone(STUB_CONFIG);
    const entityId = getStubEntityId(hass, ["sensor"]);
    if (!entityId) {
      return config;
    }

    config.entities.grid.entity = entityId;
    config.entities.home.entity = entityId;
    return config;
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._onShadowClick = this._onShadowClick.bind(this);
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
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
    const individualCount = resolveIndividualConfigs(this._config).length;
    const topCount = [
      resolveNodeConfig("grid", this._config),
      resolveNodeConfig("solar", this._config),
      resolveNodeConfig("battery", this._config),
    ].filter(item => item.entity).length;
    const bottomCount = [
      resolveNodeConfig("water", this._config),
      resolveNodeConfig("gas", this._config),
    ].filter(item => item.entity).length;
    const layoutPreset = getLayoutPreset({
      top: topCount,
      bottom: bottomCount,
      individual: individualCount,
    });

    return layoutPreset === "simple" ? 4 : 4;
  }

  getGridOptions() {
    const individualCount = resolveIndividualConfigs(this._config).length;
    const topCount = [
      resolveNodeConfig("grid", this._config),
      resolveNodeConfig("solar", this._config),
      resolveNodeConfig("battery", this._config),
    ].filter(item => item.entity).length;
    const bottomCount = [
      resolveNodeConfig("water", this._config),
      resolveNodeConfig("gas", this._config),
    ].filter(item => item.entity).length;
    const layoutPreset = getLayoutPreset({
      top: topCount,
      bottom: bottomCount,
      individual: individualCount,
    });

    return {
      rows: "auto",
      columns: "full",
      min_rows: layoutPreset === "simple" ? 3 : 3,
      min_columns: 6,
    };
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
        160,
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

  _navigate(path) {
    if (!path) {
      return;
    }

    window.history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  _getNodeSourceState(source) {
    if (!this._hass?.states) {
      return null;
    }

    if (typeof source === "string") {
      return this._hass.states[source] || null;
    }

    if (isObject(source)) {
      const entityId = source.entity || source.consumption || source.production || "";
      return entityId ? this._hass.states[entityId] || null : null;
    }

    return null;
  }

  _resolveSourceValue(source) {
    if (!this._hass?.states || !source) {
      return { value: null, unit: "", state: null, entityId: "" };
    }

    if (typeof source === "string") {
      const state = this._hass.states[source] || null;
      return {
        value: parseNumber(state?.state),
        unit: String(state?.attributes?.unit_of_measurement || state?.attributes?.native_unit_of_measurement || "").trim(),
        state,
        entityId: source,
      };
    }

    if (isObject(source)) {
      const directEntity = String(source.entity || "").trim();
      if (directEntity) {
        const state = this._hass.states[directEntity] || null;
        return {
          value: parseNumber(state?.state),
          unit: String(state?.attributes?.unit_of_measurement || state?.attributes?.native_unit_of_measurement || "").trim(),
          state,
          entityId: directEntity,
        };
      }

      const consumptionEntity = String(source.consumption || "").trim();
      const productionEntity = String(source.production || "").trim();
      const consumptionState = consumptionEntity ? this._hass.states[consumptionEntity] || null : null;
      const productionState = productionEntity ? this._hass.states[productionEntity] || null : null;
      const consumptionValue = parseNumber(consumptionState?.state) || 0;
      const productionValue = parseNumber(productionState?.state) || 0;
      const unit = String(
        consumptionState?.attributes?.unit_of_measurement
        || productionState?.attributes?.unit_of_measurement
        || consumptionState?.attributes?.native_unit_of_measurement
        || productionState?.attributes?.native_unit_of_measurement
        || "",
      ).trim();

      return {
        value: consumptionValue - productionValue,
        unit,
        state: consumptionState || productionState,
        entityId: consumptionEntity || productionEntity,
      };
    }

    return { value: null, unit: "", state: null, entityId: "" };
  }

  _getSecondaryInfoText(nodeConfig, baseState) {
    if (this._config?.show_secondary_info === false || !isObject(nodeConfig?.secondary_info)) {
      return "";
    }

    const info = nodeConfig.secondary_info;
    const infoEntity = String(info.entity || "").trim();
    const infoAttribute = String(info.attribute || "").trim();
    const infoState = infoEntity ? this._hass?.states?.[infoEntity] || null : baseState;

    if (!infoState) {
      return "";
    }

    if (infoAttribute) {
      const rawAttribute = infoState.attributes?.[infoAttribute];
      if (rawAttribute === undefined || rawAttribute === null || rawAttribute === "") {
        return "";
      }
      return String(rawAttribute);
    }

    if (!infoEntity) {
      return "";
    }

    const rawValue = parseNumber(infoState.state);
    const unit = String(info.unit || infoState.attributes?.unit_of_measurement || infoState.attributes?.native_unit_of_measurement || "").trim();
    if (rawValue === null) {
      return String(infoState.state || "");
    }

    const decimals = Number.isFinite(Number(info.decimals)) ? Number(info.decimals) : 0;
    return `${formatRawValue(rawValue, decimals)}${unit ? ` ${unit}` : ""}`;
  }

  _resolveNodeDescriptor(kind, configOverride = null, index = 0, total = 0, hasBottomUtilities = false) {
    const nodeConfig = configOverride || resolveNodeConfig(kind, this._config);
    const sourceResult = this._resolveSourceValue(nodeConfig.entity);
    const state = sourceResult.state;
    const unavailable = Boolean(nodeConfig.entity) && (!state || isUnavailableState(state));
    const label = nodeConfig.name || state?.attributes?.friendly_name || NODE_DEFAULTS[kind]?.name || kind;
    const icon = nodeConfig.icon || state?.attributes?.icon || NODE_DEFAULTS[kind]?.icon || "mdi:flash";
    const color = nodeConfig.color || NODE_DEFAULTS[kind]?.color || "#ffffff";
    const secondary = this._getSecondaryInfoText(nodeConfig, state);
    const display = formatDisplayValue(sourceResult.value, sourceResult.unit);
    const nodeKind = kind === "individual" ? "individual" : kind;

    return {
      id: kind === "individual" ? `${kind}-${index}` : kind,
      kind: nodeKind,
      entityId: sourceResult.entityId || String(nodeConfig.entity || ""),
      label,
      icon,
      color,
      value: sourceResult.value,
      unit: sourceResult.unit,
      valueText: display.value,
      unitText: display.unit,
      state,
      secondary,
      unavailable,
      position: getNodePositionForLayout(nodeKind, index, total, hasBottomUtilities, this._layoutPreset || "full"),
      sourceConfig: nodeConfig,
    };
  }

  _getTrackedEntityIds() {
    const config = this._config || {};
    const entityIds = new Set();

    const registerNodeEntity = nodeConfig => {
      if (!nodeConfig) {
        return;
      }

      const source = nodeConfig.entity;
      if (typeof source === "string" && source.trim()) {
        entityIds.add(source.trim());
      } else if (isObject(source)) {
        if (String(source.entity || "").trim()) {
          entityIds.add(String(source.entity).trim());
        }
        if (String(source.consumption || "").trim()) {
          entityIds.add(String(source.consumption).trim());
        }
        if (String(source.production || "").trim()) {
          entityIds.add(String(source.production).trim());
        }
      }

      const secondaryEntity = String(nodeConfig.secondary_info?.entity || "").trim();
      if (secondaryEntity) {
        entityIds.add(secondaryEntity);
      }
    };

    ["grid", "home", "solar", "battery", "water", "gas"].forEach(kind => {
      registerNodeEntity(resolveNodeConfig(kind, config));
    });

    resolveIndividualConfigs(config).forEach(registerNodeEntity);

    return [...entityIds].sort((left, right) => left.localeCompare(right, "es"));
  }

  _getRenderSignature(hass = this._hass) {
    const trackedStates = this._getTrackedEntityIds().map(entityId => {
      const state = hass?.states?.[entityId] || null;
      return {
        entityId,
        state: String(state?.state || ""),
        friendly_name: String(state?.attributes?.friendly_name || ""),
        icon: String(state?.attributes?.icon || ""),
        unit: String(state?.attributes?.unit_of_measurement || state?.attributes?.native_unit_of_measurement || ""),
      };
    });

    return JSON.stringify({
      title: this._config?.title || this._config?.name || "",
      dashboard_link: this._config?.dashboard_link || "",
      show_header: this._config?.show_header !== false,
      show_values: this._config?.show_values !== false,
      show_labels: this._config?.show_labels !== false,
      trackedStates,
    });
  }

  _getNodes() {
    const bottomUtilities = [
      resolveNodeConfig("water", this._config),
      resolveNodeConfig("gas", this._config),
    ].filter(item => item.entity).length;
    const individualConfigs = resolveIndividualConfigs(this._config);
    const topCount = [
      resolveNodeConfig("grid", this._config),
      resolveNodeConfig("solar", this._config),
      resolveNodeConfig("battery", this._config),
    ].filter(item => item.entity).length;
    this._layoutPreset = getLayoutPreset({
      top: topCount,
      bottom: bottomUtilities,
      individual: individualConfigs.length,
    });

    const nodes = {
      home: this._resolveNodeDescriptor("home"),
      grid: this._resolveNodeDescriptor("grid"),
      solar: this._resolveNodeDescriptor("solar"),
      battery: this._resolveNodeDescriptor("battery"),
      water: this._resolveNodeDescriptor("water", null, 0, bottomUtilities, bottomUtilities > 0),
      gas: this._resolveNodeDescriptor("gas", null, 1, bottomUtilities, bottomUtilities > 0),
      individual: individualConfigs.map((config, index) => this._resolveNodeDescriptor("individual", config, index, individualConfigs.length, bottomUtilities > 0)),
    };

    if (!nodes.home.entityId) {
      nodes.home.entityId = nodes.grid.entityId || nodes.solar.entityId || nodes.battery.entityId || "";
    }

    nodes._layoutPreset = this._layoutPreset;

    return nodes;
  }

  _getLineNeutralStyle() {
    const grey = rgbArrayToColor(this._config?.display_zero_lines?.grey_color);
    const opacity = 1 - (clamp(Number(this._config?.display_zero_lines?.transparency ?? 50), 0, 100) / 100);
    return { color: grey, opacity };
  }

  _shouldShowZeroLines() {
    return normalizeTextKey(this._config?.display_zero_lines?.mode) !== "hide";
  }

  _toFlowMagnitude(value, unit) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const unitKey = normalizeTextKey(unit);
    if (unitKey === "kw") {
      return Math.abs(value) * 1000;
    }
    return Math.abs(value);
  }

  _flowDuration(magnitude, maxMagnitude) {
    const minFlowRate = Math.max(0.6, Number(this._config?.min_flow_rate) || DEFAULT_CONFIG.min_flow_rate);
    const maxFlowRate = Math.max(minFlowRate + 0.1, Number(this._config?.max_flow_rate) || DEFAULT_CONFIG.max_flow_rate);
    const safeMax = Math.max(maxMagnitude, 1);
    const ratio = clamp(magnitude / safeMax, 0, 1);
    return maxFlowRate - ((maxFlowRate - minFlowRate) * ratio);
  }

  _buildLines(nodes) {
    const home = nodes.home;
    const layoutPreset = nodes._layoutPreset || "full";
    const zeroLineVisible = this._shouldShowZeroLines();
    const neutralStyle = this._getLineNeutralStyle();
    const homeRadius = layoutPreset === "simple" ? 11.8 : layoutPreset === "compact" ? 13 : 14.5;
    const nodeRadius = layoutPreset === "simple" ? 5.1 : layoutPreset === "compact" ? 5.8 : 6.5;
    const individualRadius = layoutPreset === "simple" ? 4.6 : layoutPreset === "compact" ? 5.1 : 5.5;
    const lineCandidates = [];

    const pushLine = (id, sourceNode, targetNode, value, unit, color, bidirectional = true) => {
      const magnitude = this._toFlowMagnitude(value, unit);
      const active = magnitude > 0.001;
      if (!active && !zeroLineVisible) {
        return;
      }

      let fromNode = sourceNode;
      let toNode = targetNode;

      if (active && bidirectional && value < 0) {
        fromNode = targetNode;
        toNode = sourceNode;
      }

      const fromRadius = fromNode.kind === "home" ? homeRadius : fromNode.kind === "individual" ? individualRadius : nodeRadius;
      const toRadius = toNode.kind === "home" ? homeRadius : toNode.kind === "individual" ? individualRadius : nodeRadius;

      lineCandidates.push({
        id,
        fromNode,
        toNode,
        value,
        unit,
        magnitude,
        active,
        color: active ? color : neutralStyle.color,
        opacity: active ? 0.9 : neutralStyle.opacity,
        fromRadius,
        toRadius,
      });
    };

    if (nodes.grid.entityId) {
      pushLine("grid", nodes.grid, home, nodes.grid.value, nodes.grid.unit, nodes.grid.color, true);
    }
    if (nodes.solar.entityId) {
      pushLine("solar", nodes.solar, home, nodes.solar.value, nodes.solar.unit, nodes.solar.color, true);
    }
    if (nodes.battery.entityId) {
      pushLine("battery", nodes.battery, home, nodes.battery.value, nodes.battery.unit, nodes.battery.color, true);
    }
    if (nodes.water.entityId) {
      pushLine("water", nodes.water, home, nodes.water.value, nodes.water.unit, nodes.water.color, false);
    }
    if (nodes.gas.entityId) {
      pushLine("gas", nodes.gas, home, nodes.gas.value, nodes.gas.unit, nodes.gas.color, false);
    }

    nodes.individual.forEach(node => {
      pushLine(node.id, home, node, node.value, node.unit, node.color, true);
    });

    const maxMagnitude = Math.max(
      ...lineCandidates.filter(item => item.active).map(item => item.magnitude),
      1,
    );

    return lineCandidates.map(line => ({
      ...line,
      path: buildFlowPath(line.fromNode.position, line.toNode.position, line.fromRadius, line.toRadius),
      duration: this._flowDuration(line.magnitude, maxMagnitude),
    }));
  }

  _getDominantColor(lines) {
    const active = [...lines]
      .filter(line => line.active)
      .sort((left, right) => right.magnitude - left.magnitude);

    return active[0]?.color || "#f6b73c";
  }

  _renderFlowDots(line) {
    if (!line.active) {
      return "";
    }

    const bubbleDuration = 5.6;
    return `
      <g class="power-flow-card__dot-group" style="--dot-color:${escapeHtml(line.color)};">
        <circle class="power-flow-card__dot-glow" r="0.92">
          <animateMotion dur="${bubbleDuration.toFixed(2)}s" repeatCount="indefinite" calcMode="linear" path="${line.path}"></animateMotion>
        </circle>
        <circle class="power-flow-card__dot-core" r="0.52">
          <animateMotion dur="${bubbleDuration.toFixed(2)}s" repeatCount="indefinite" calcMode="linear" path="${line.path}"></animateMotion>
        </circle>
      </g>
    `;
  }

  _getNodeAnimationDelay(node, index = 0) {
    const delayByKind = {
      home: 110,
      grid: 150,
      solar: 185,
      battery: 215,
      water: 245,
      gas: 275,
      individual: 245,
    };

    const baseDelay = delayByKind[node?.kind] || 150;
    return node?.kind === "individual"
      ? baseDelay + (Math.max(0, Number(index) || 0) * 34)
      : baseDelay;
  }

  _renderNode(node, options = {}) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const iconSizes = styles.icon || DEFAULT_CONFIG.styles.icon;
    const layoutPreset = options.layoutPreset || "full";
    const animateEntrance = options.animateEntrance === true;
    const enterDelay = Math.max(0, Number(options.enterDelay) || 0);
    const nodeSize = node.kind === "home"
      ? Math.max(92, parseSizeToPixels(iconSizes.home_size, 96))
      : node.kind === "individual"
        ? Math.max(38, parseSizeToPixels(iconSizes.individual_size, 40))
        : Math.max(44, parseSizeToPixels(iconSizes.node_size, 48));
    const scaledNodeSize = Math.round(
      nodeSize * (
        layoutPreset === "simple"
          ? (node.kind === "home" ? 0.74 : 0.78)
        : layoutPreset === "compact"
            ? (node.kind === "home" ? 0.88 : 0.92)
            : 1
      )
    );
    const chipHeight = Math.max(22, parseSizeToPixels(styles.chip_height, 24));
    const chipFontSize = Math.max(11, parseSizeToPixels(styles.chip_font_size, 11));
    const chipPadding = styles.chip_padding || "0 10px";
    const secondarySize = Math.max(10, parseSizeToPixels(styles.secondary_size, 11));
    const isBottom = node.position.y >= 74;
    const infoClass = node.kind === "home" ? "power-flow-card__node-info--home" : isBottom ? "power-flow-card__node-info--above" : "power-flow-card__node-info--below";
    const color = node.color;
    const unavailableBadge = this._config?.show_unavailable_badge !== false && node.unavailable
      ? `<span class="power-flow-card__unavailable"><ha-icon icon="mdi:help"></ha-icon></span>`
      : "";
    const isClickable = this._config?.clickable_entities !== false && node.entityId;
    const nodeClassName = [
      "power-flow-card__node",
      `power-flow-card__node--${escapeHtml(node.kind)}`,
      animateEntrance ? "power-flow-card__node--entering" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const valueMarkup = this._config?.show_values === false
      ? ""
      : `
          <span class="power-flow-card__chip power-flow-card__chip--value" style="--chip-tint:${escapeHtml(color)};">
            <span>${escapeHtml(node.valueText)}</span>
            ${node.unitText ? `<span class="power-flow-card__chip-unit">${escapeHtml(node.unitText)}</span>` : ""}
          </span>
        `;

    const labelMarkup = this._config?.show_labels === false
      ? ""
      : `<span class="power-flow-card__chip power-flow-card__chip--label">${escapeHtml(node.label)}</span>`;

    const secondaryMarkup = node.secondary
      ? `<span class="power-flow-card__node-secondary">${escapeHtml(node.secondary)}</span>`
      : "";

    if (node.kind === "home") {
      return `
        <div class="${nodeClassName}" style="left:${node.position.x}%; top:${node.position.y}%; --node-enter-delay:${enterDelay}ms;">
          <button
            class="power-flow-card__bubble power-flow-card__bubble--home ${isClickable ? "is-clickable" : ""}"
            data-node-entity="${escapeHtml(node.entityId)}"
            data-node-action="${isClickable ? "more-info" : ""}"
            style="--node-size:${scaledNodeSize}px; --node-tint:${escapeHtml(color)};"
            title="${escapeHtml(node.label)}"
          >
            ${unavailableBadge}
            <span class="power-flow-card__home-icon-wrap">
              <ha-icon icon="${escapeHtml(node.icon)}"></ha-icon>
            </span>
            ${
              this._config?.show_values === false
                ? ""
                : `
                  <span class="power-flow-card__home-value">
                    <span class="power-flow-card__home-value-number">${escapeHtml(node.valueText)}</span>
                    ${node.unitText ? `<span class="power-flow-card__home-value-unit">${escapeHtml(node.unitText)}</span>` : ""}
                  </span>
                `
            }
          </button>
          <div class="power-flow-card__node-info ${infoClass}">
            ${labelMarkup}
            ${secondaryMarkup}
          </div>
        </div>
      `;
    }

    return `
      <div class="${nodeClassName}" style="left:${node.position.x}%; top:${node.position.y}%; --chip-height:${chipHeight}px; --chip-font-size:${chipFontSize}px; --chip-padding:${escapeHtml(chipPadding)}; --secondary-size:${secondarySize}px; --node-enter-delay:${enterDelay}ms;">
        <button
          class="power-flow-card__bubble ${node.kind === "individual" ? "power-flow-card__bubble--individual" : ""} ${isClickable ? "is-clickable" : ""}"
          data-node-entity="${escapeHtml(node.entityId)}"
          data-node-action="${isClickable ? "more-info" : ""}"
          style="--node-size:${scaledNodeSize}px; --node-tint:${escapeHtml(color)};"
          title="${escapeHtml(node.label)}"
        >
          ${unavailableBadge}
          <ha-icon icon="${escapeHtml(node.icon)}"></ha-icon>
        </button>
        <div class="power-flow-card__node-info ${infoClass}">
          ${labelMarkup}
          ${valueMarkup}
          ${secondaryMarkup}
        </div>
      </div>
    `;
  }

  _getSimpleSourceNode(nodes) {
    return [
      nodes.grid,
      nodes.solar,
      nodes.battery,
      ...nodes.individual,
    ].find(node => node?.entityId) || nodes.home;
  }

  _renderSimpleLabelChip(node) {
    if (this._config?.show_labels === false) {
      return "";
    }

    return `<span class="power-flow-card__chip power-flow-card__chip--label">${escapeHtml(node.label)}</span>`;
  }

  _renderSimpleValueChip(node) {
    if (this._config?.show_values === false) {
      return "";
    }

    return `
      <span class="power-flow-card__chip power-flow-card__chip--value" style="--chip-tint:${escapeHtml(node.color)};">
        <span>${escapeHtml(node.valueText)}</span>
        ${node.unitText ? `<span class="power-flow-card__chip-unit">${escapeHtml(node.unitText)}</span>` : ""}
      </span>
    `;
  }

  _renderSimpleLayout(nodes, lines, options = {}) {
    const animateEntrance = options.animateEntrance === true;
    const sourceNode = this._getSimpleSourceNode(nodes);
    const flowLine = lines.find(line => line.id === sourceNode.id || line.fromNode?.id === sourceNode.id || line.toNode?.id === sourceNode.id) || null;
    const lineColor = flowLine?.color || sourceNode.color || "#6da8ff";
    const lineOpacity = flowLine?.active ? 0.92 : (this._shouldShowZeroLines() ? this._getLineNeutralStyle().opacity : 0);
    const lineBackground = flowLine?.active
      ? `color-mix(in srgb, ${lineColor} 24%, rgba(255,255,255,0.12))`
      : this._getLineNeutralStyle().color;
    const bubbleDuration = Math.max(3.6, Number(flowLine?.duration || 4.8));
    const homeSize = Math.round(Math.max(92, parseSizeToPixels(this._config?.styles?.icon?.home_size, 96)) * 0.72);
    const nodeSize = Math.round(Math.max(44, parseSizeToPixels(this._config?.styles?.icon?.node_size, 48)) * 0.8);
    const lineStartOffset = Math.max(18, Math.round(nodeSize * 0.42));
    const lineEndOffset = Math.max(30, Math.round(homeSize * 0.38));
    const sourceClickable = this._config?.clickable_entities !== false && sourceNode.entityId;
    const homeClickable = this._config?.clickable_entities !== false && nodes.home.entityId;
    const sourceUnavailableBadge = this._config?.show_unavailable_badge !== false && sourceNode.unavailable
      ? `<span class="power-flow-card__unavailable"><ha-icon icon="mdi:help"></ha-icon></span>`
      : "";
    const homeUnavailableBadge = this._config?.show_unavailable_badge !== false && nodes.home.unavailable
      ? `<span class="power-flow-card__unavailable"><ha-icon icon="mdi:help"></ha-icon></span>`
      : "";
    const showDashboardButton = this._config?.show_dashboard_link_button !== false && Boolean(this._config?.dashboard_link);
    const dashboardLabel = this._config?.dashboard_link_label || "Energia";

    return `
      <div class="power-flow-card__simple-layout ${showDashboardButton ? "has-footer" : ""} ${animateEntrance ? "power-flow-card__simple-layout--entering" : ""}">
        <div
          class="power-flow-card__simple-top ${animateEntrance ? "power-flow-card__simple-top--entering" : ""}"
          style="--simple-source-column:${nodeSize}px; --simple-home-column:${homeSize}px;"
        >
          <div class="power-flow-card__simple-column power-flow-card__simple-column--source-top">
            ${this._renderSimpleLabelChip(sourceNode)}
          </div>
          <div></div>
          <div class="power-flow-card__simple-column power-flow-card__simple-column--home power-flow-card__simple-column--home-top">
            ${this._renderSimpleLabelChip(nodes.home)}
          </div>
        </div>

        <div
          class="power-flow-card__simple-rail ${animateEntrance ? "power-flow-card__simple-rail--entering" : ""}"
          style="--simple-rail-height:${Math.max(nodeSize, homeSize)}px; --simple-source-column:${nodeSize}px; --simple-home-column:${homeSize}px;"
        >
          <div
            class="power-flow-card__simple-line-wrap"
            style="--line-start-offset:${lineStartOffset}px; --line-end-offset:${lineEndOffset}px;"
          >
            <div
              class="power-flow-card__simple-line ${flowLine?.active ? "is-active" : ""}"
              style="--line-color:${escapeHtml(lineColor)}; --line-opacity:${lineOpacity}; --line-background:${escapeHtml(lineBackground)};"
            >
              ${flowLine?.active ? `
                <span class="power-flow-card__simple-dot" style="animation-duration:${bubbleDuration.toFixed(2)}s;"></span>
              ` : ""}
            </div>
          </div>

          <div class="power-flow-card__simple-rail-node power-flow-card__simple-rail-node--source" style="--simple-node-cover-size:${nodeSize}px;">
            <button
              class="power-flow-card__bubble ${sourceClickable ? "is-clickable" : ""}"
              data-node-entity="${escapeHtml(sourceNode.entityId)}"
              data-node-action="${sourceClickable ? "more-info" : ""}"
              style="--node-size:${nodeSize}px; --node-tint:${escapeHtml(sourceNode.color)};"
              title="${escapeHtml(sourceNode.label)}"
            >
              ${sourceUnavailableBadge}
              <ha-icon icon="${escapeHtml(sourceNode.icon)}"></ha-icon>
            </button>
          </div>

          <div class="power-flow-card__simple-rail-spacer"></div>

          <div class="power-flow-card__simple-rail-node power-flow-card__simple-rail-node--home" style="--simple-node-cover-size:${homeSize}px;">
            <button
              class="power-flow-card__bubble power-flow-card__bubble--home ${homeClickable ? "is-clickable" : ""}"
              data-node-entity="${escapeHtml(nodes.home.entityId)}"
              data-node-action="${homeClickable ? "more-info" : ""}"
              style="--node-size:${homeSize}px; --node-tint:${escapeHtml(nodes.home.color)};"
              title="${escapeHtml(nodes.home.label)}"
            >
              ${homeUnavailableBadge}
              <span class="power-flow-card__home-icon-wrap">
                <ha-icon icon="${escapeHtml(nodes.home.icon)}"></ha-icon>
              </span>
              ${
                this._config?.show_values === false
                  ? ""
                  : `
                    <span class="power-flow-card__home-value">
                      <span class="power-flow-card__home-value-number">${escapeHtml(nodes.home.valueText)}</span>
                      ${nodes.home.unitText ? `<span class="power-flow-card__home-value-unit">${escapeHtml(nodes.home.unitText)}</span>` : ""}
                    </span>
                  `
              }
            </button>
          </div>
        </div>

        <div
          class="power-flow-card__simple-bottom ${animateEntrance ? "power-flow-card__simple-bottom--entering" : ""}"
          style="--simple-source-column:${nodeSize}px; --simple-home-column:${homeSize}px;"
        >
          <div class="power-flow-card__simple-column power-flow-card__simple-column--source power-flow-card__simple-column--source-bottom">
            ${this._renderSimpleValueChip(sourceNode)}
            ${sourceNode.secondary ? `<span class="power-flow-card__node-secondary">${escapeHtml(sourceNode.secondary)}</span>` : ""}
          </div>
          <div></div>
          <div></div>
        </div>

        ${
          showDashboardButton
            ? `
              <div class="power-flow-card__simple-footer ${animateEntrance ? "power-flow-card__simple-footer--entering" : ""}">
                <button class="power-flow-card__dashboard-button power-flow-card__dashboard-button--footer" data-dashboard-action="navigate" title="${escapeHtml(dashboardLabel)}">
                  <ha-icon icon="mdi:lightning-bolt-circle"></ha-icon>
                  <span>${escapeHtml(dashboardLabel)}</span>
                </button>
              </div>
            `
            : ""
        }
      </div>
    `;
  }

  _onShadowClick(event) {
    const dashboardButton = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.dashboardAction === "navigate");
    if (dashboardButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerPressAnimation(dashboardButton);
      this._triggerHaptic("selection");
      this._navigate(this._config?.dashboard_link);
      return;
    }

    const nodeAction = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.nodeAction === "more-info");
    if (nodeAction && nodeAction.dataset?.nodeEntity) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerPressAnimation(nodeAction);
      this._triggerHaptic("selection");
      fireEvent(this, "hass-more-info", {
        entityId: nodeAction.dataset.nodeEntity,
      });
      return;
    }

    if ((this._config?.tap_action || "none") === "more-info" && this._config?.entities?.home?.entity) {
      const content = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.cardAction === "primary");
      if (content) {
        event.preventDefault();
        event.stopPropagation();
        this._triggerPressAnimation(this.shadowRoot.querySelector(".power-flow-card__content"));
        this._triggerHaptic("selection");
        fireEvent(this, "hass-more-info", {
          entityId: this._config.entities.home.entity,
        });
      }
    }
  }

  _getTitle() {
    return this._config?.title || this._config?.name || "Flujo";
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const nodes = this._getNodes();
    const lines = this._buildLines(nodes);
    const dominantColor = this._getDominantColor(lines);
    const flowWidth = Math.max(3, parseSizeToPixels(styles.flow_width, 4));
    const hasLowerNodes = Boolean(nodes.water.entityId || nodes.gas.entityId || nodes.individual.length);
    const layoutPreset = nodes._layoutPreset || "full";
    const showDashboardButton = this._config?.show_dashboard_link_button !== false && Boolean(this._config?.dashboard_link);
    const titleText = this._config?.title || this._config?.name || (layoutPreset === "simple" ? "" : "Flujo");
    const hasHeader = this._config?.show_header !== false && (Boolean(titleText) || (showDashboardButton && layoutPreset !== "simple"));
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const surfaceMinHeight = layoutPreset === "simple"
      ? 162
      : layoutPreset === "compact"
        ? (hasLowerNodes ? 296 : 228)
        : (hasLowerNodes ? 328 : 248);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --power-flow-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          --power-flow-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          display: block;
          height: 100%;
          min-height: 0;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          background-color: var(--ha-card-background, var(--card-background-color, #fff));
          border-radius: ${styles.card.border_radius};
          height: 100%;
          isolation: isolate;
          min-height: 0;
          overflow: hidden;
          position: relative;
        }

        ha-card::before {
          background: color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 95%, transparent);
          border-radius: inherit;
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .power-flow-card {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${dominantColor} 12%, transparent) 0%, transparent 42%),
            linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(0,0,0,0.03) 100%),
            ${styles.card.background};
          border: 1px solid color-mix(in srgb, ${dominantColor} 18%, var(--divider-color));
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow}, 0 14px 28px color-mix(in srgb, ${dominantColor} 7%, rgba(0,0,0,0.14));
          color: var(--primary-text-color);
          display: flex;
          flex-direction: column;
          gap: ${styles.card.gap};
          height: 100%;
          isolation: isolate;
          min-height: 0;
          overflow: hidden;
          padding: ${styles.card.padding};
          position: relative;
          transform-origin: center;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 160ms ease;
          will-change: transform;
        }

        .power-flow-card__header {
          align-items: center;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .power-flow-card__header--entering {
          animation: power-flow-card-fade-up calc(var(--power-flow-card-content-duration) * 0.82) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .power-flow-card__title {
          font-size: ${Math.max(14, parseSizeToPixels(styles.title_size, 16))}px;
          font-weight: 700;
          line-height: 1.1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .power-flow-card__dashboard-button {
          align-items: center;
          background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          gap: 8px;
          min-height: 34px;
          padding: 0 12px;
          transform-origin: center;
          transition: transform 160ms ease, border-color 160ms ease, box-shadow 180ms ease, background 180ms ease;
          will-change: transform;
        }

        .power-flow-card__dashboard-button ha-icon {
          --mdc-icon-size: 16px;
        }

        .power-flow-card__content {
          flex: 1;
          min-height: 0;
          position: relative;
          transform-origin: center;
          will-change: opacity, transform;
        }

        .power-flow-card__content--entering {
          animation: power-flow-card-fade-up var(--power-flow-card-content-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 34ms;
        }

        .power-flow-card--simple .power-flow-card__content {
          align-items: stretch;
          display: flex;
          justify-content: flex-start;
        }

        .power-flow-card__surface {
          background: linear-gradient(180deg, color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 18%, transparent) 0%, transparent 100%);
          border-radius: calc(${styles.card.border_radius} - 6px);
          min-height: ${surfaceMinHeight}px;
          position: relative;
          transform-origin: center;
          will-change: opacity, transform;
          width: 100%;
        }

        .power-flow-card__surface--entering {
          animation: power-flow-card-surface-in calc(var(--power-flow-card-content-duration) * 0.94) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 46ms;
        }

        .power-flow-card__svg {
          height: 100%;
          inset: 0;
          position: absolute;
          width: 100%;
          pointer-events: none;
        }

        .power-flow-card__svg--lines {
          z-index: 0;
        }

        .power-flow-card__surface--entering .power-flow-card__svg--lines {
          animation: power-flow-card-lines-in calc(var(--power-flow-card-content-duration) * 0.92) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 82ms;
          transform-origin: center;
        }

        .power-flow-card__svg--dots {
          z-index: 3;
        }

        .power-flow-card__surface--entering .power-flow-card__svg--dots {
          animation: power-flow-card-dots-in calc(var(--power-flow-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 124ms;
          transform-origin: center;
        }

        .power-flow-card__line {
          fill: none;
          filter: url(#power-flow-soften);
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: ${flowWidth}px;
        }

        .power-flow-card__line-glow {
          fill: none;
          filter: url(#power-flow-glow);
          opacity: 0.08;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: ${flowWidth * 1.5}px;
        }

        .power-flow-card__dot-glow {
          fill: color-mix(in srgb, var(--dot-color) 26%, rgba(255,255,255,0.14));
          opacity: 0.72;
        }

        .power-flow-card__dot-core {
          fill: rgba(255, 255, 255, 0.96);
          stroke: color-mix(in srgb, var(--dot-color) 30%, rgba(255,255,255,0.42));
          stroke-width: 0.16;
        }

        .power-flow-card__node {
          position: absolute;
          transform: translate(-50%, -50%);
          transform-origin: center;
          will-change: opacity, transform;
          z-index: 1;
        }

        .power-flow-card__node--entering {
          animation: power-flow-card-node-in calc(var(--power-flow-card-content-duration) * 0.86) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: var(--node-enter-delay, 0ms);
        }

        .power-flow-card__node-info {
          align-items: center;
          display: flex;
          flex-direction: column;
          gap: 5px;
          left: 50%;
          max-width: 180px;
          min-width: 0;
          position: absolute;
          transform: translateX(-50%);
        }

        .power-flow-card__node-info--below {
          top: calc(100% + 5px);
        }

        .power-flow-card__node-info--above {
          bottom: calc(100% + 5px);
        }

        .power-flow-card__node-info--home {
          bottom: calc(100% + 8px);
        }

        .power-flow-card--simple .power-flow-card__header {
          gap: 8px;
        }

        .power-flow-card--simple {
          gap: 8px;
          padding: 10px;
        }

        .power-flow-card--simple .power-flow-card__dashboard-button {
          min-height: 38px;
          padding: 0 15px;
        }

        .power-flow-card--simple .power-flow-card__surface {
          min-height: 148px;
        }

        .power-flow-card--simple .power-flow-card__node-info {
          gap: 4px;
        }

        .power-flow-card--simple .power-flow-card__chip {
          max-width: 120px;
        }

        .power-flow-card__simple-layout {
          align-content: space-between;
          display: grid;
          gap: 4px;
          grid-template-rows: auto 1fr auto;
          min-height: 100%;
          position: relative;
          width: 100%;
        }

        .power-flow-card__simple-layout.has-footer {
          padding-bottom: 42px;
        }

        .power-flow-card__simple-top--entering {
          animation: power-flow-card-fade-up calc(var(--power-flow-card-content-duration) * 0.74) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 46ms;
        }

        .power-flow-card__simple-rail--entering {
          animation: power-flow-card-surface-in calc(var(--power-flow-card-content-duration) * 0.88) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 92ms;
        }

        .power-flow-card__simple-bottom--entering {
          animation: power-flow-card-fade-up calc(var(--power-flow-card-content-duration) * 0.76) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 132ms;
        }

        .power-flow-card__simple-top,
        .power-flow-card__simple-bottom {
          align-items: center;
          display: grid;
          gap: 0;
          grid-template-columns: var(--simple-source-column, 48px) minmax(64px, 1fr) var(--simple-home-column, 96px);
          width: 100%;
        }

        .power-flow-card__simple-top {
          margin-bottom: 1px;
        }

        .power-flow-card__simple-bottom {
          margin-top: 2px;
        }

        .power-flow-card__simple-rail {
          align-items: center;
          display: grid;
          gap: 0;
          grid-template-columns: var(--simple-source-column, 48px) minmax(64px, 1fr) var(--simple-home-column, 96px);
          min-height: var(--simple-rail-height, 96px);
          position: relative;
          width: 100%;
        }

        .power-flow-card__simple-rail-node {
          align-items: center;
          display: flex;
          justify-content: center;
          min-width: 0;
          position: relative;
          z-index: 2;
        }

        .power-flow-card__simple-rail-node::before {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${dominantColor} 9%, transparent) 0%, transparent 58%),
            linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(0,0,0,0.03) 100%),
            ${styles.card.background};
          border-radius: 999px;
          content: "";
          height: calc(var(--simple-node-cover-size, 48px) + 12px);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(var(--simple-node-cover-size, 48px) + 12px);
          z-index: 0;
        }

        .power-flow-card__simple-rail-node--source {
          grid-column: 1;
        }

        .power-flow-card__simple-rail-node--home {
          grid-column: 3;
        }

        .power-flow-card__simple-rail-spacer {
          grid-column: 2;
          min-width: 64px;
        }

        .power-flow-card__simple-column {
          align-items: center;
          display: grid;
          gap: 4px;
          justify-items: center;
          min-width: 0;
          position: relative;
          z-index: 1;
        }

        .power-flow-card__simple-column--home {
          gap: 3px;
          justify-self: center;
          margin-bottom: 0;
          max-width: 100%;
          width: max-content;
        }

        .power-flow-card__simple-column--source {
          justify-self: center;
          margin-top: 0;
          max-width: 100%;
          width: max-content;
        }

        .power-flow-card__simple-column--source-top {
          justify-self: center;
          max-width: 100%;
          width: max-content;
        }

        .power-flow-card__simple-column--home-top {
          transform: translateY(-4px);
        }

        .power-flow-card__simple-column--source-top {
          gap: 3px;
          transform: translateY(4px);
        }

        .power-flow-card__simple-column--source-bottom {
          gap: 3px;
          transform: translateY(-6px);
        }

        .power-flow-card__simple-info {
          align-items: center;
          display: grid;
          gap: 4px;
          justify-items: center;
          min-width: 0;
        }

        .power-flow-card__simple-info .power-flow-card__chip,
        .power-flow-card__simple-info .power-flow-card__node-secondary {
          max-width: 150px;
        }

        .power-flow-card__simple-top .power-flow-card__chip,
        .power-flow-card__simple-bottom .power-flow-card__chip {
          justify-self: center;
          margin-left: auto;
          margin-right: auto;
        }

        .power-flow-card__simple-line-wrap {
          left: var(--line-start-offset, 18px);
          min-width: 64px;
          pointer-events: none;
          position: absolute;
          right: var(--line-end-offset, 28px);
          top: 50%;
          transform: translateY(-50%);
          width: auto;
          z-index: 1;
        }

        .power-flow-card__simple-line {
          background: linear-gradient(180deg, color-mix(in srgb, var(--line-background) 100%, transparent) 0%, color-mix(in srgb, var(--line-background) 78%, transparent) 100%);
          border-radius: 999px;
          height: ${Math.max(flowWidth, 4)}px;
          opacity: var(--line-opacity);
          position: relative;
          width: 100%;
        }

        .power-flow-card__simple-line.is-active {
          box-shadow: 0 0 14px color-mix(in srgb, var(--line-color) 18%, transparent);
        }

        .power-flow-card__simple-dot {
          background: radial-gradient(circle at 35% 35%, rgba(255,255,255,0.98) 0 35%, color-mix(in srgb, var(--line-color) 44%, rgba(255,255,255,0.92)) 36% 100%);
          border-radius: 999px;
          box-shadow:
            0 0 0 4px color-mix(in srgb, var(--line-color) 14%, transparent),
            0 0 12px color-mix(in srgb, var(--line-color) 22%, transparent);
          height: 9px;
          left: 0;
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 9px;
          will-change: left, opacity;
          animation: power-flow-card-simple-dot linear infinite;
        }

        @keyframes power-flow-card-simple-dot {
          0% {
            left: 0;
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          92% {
            opacity: 1;
          }
          100% {
            left: calc(100% - 9px);
            opacity: 0;
          }
        }

        .power-flow-card__bubble {
          align-items: center;
          appearance: none;
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--node-tint) 12%, transparent) 0%, transparent 48%),
            linear-gradient(180deg, color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 88%, rgba(255,255,255,0.07)) 0%, color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 72%, rgba(255,255,255,0.03)) 100%);
          border: 1px solid color-mix(in srgb, var(--node-tint) 24%, rgba(255,255,255,0.09));
          border-radius: 999px;
          box-shadow: 0 10px 20px color-mix(in srgb, var(--node-tint) 7%, rgba(0,0,0,0.14));
          color: ${styles.icon.color || "var(--primary-text-color)"};
          cursor: default;
          display: inline-flex;
          height: var(--node-size);
          justify-content: center;
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
          will-change: transform;
          z-index: 1;
          width: var(--node-size);
        }

        .power-flow-card__bubble.is-clickable {
          cursor: pointer;
        }

        .power-flow-card__bubble:hover.is-clickable {
          transform: translateY(-1px);
        }

        .power-flow-card__simple-footer {
          display: flex;
          inset: auto 0 0 0;
          justify-content: center;
          position: absolute;
          width: 100%;
        }

        .power-flow-card__simple-footer--entering {
          animation: power-flow-card-fade-up calc(var(--power-flow-card-content-duration) * 0.74) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 168ms;
        }

        .power-flow-card__dashboard-button--footer {
          min-width: 0;
          min-height: 40px;
          padding: 0 16px;
        }

        .power-flow-card__dashboard-button--footer ha-icon {
          --mdc-icon-size: 18px;
        }

        .power-flow-card__bubble ha-icon {
          --mdc-icon-size: calc(var(--node-size) * 0.44);
        }

        .power-flow-card__bubble--home {
          align-items: center;
          border-radius: 30px;
          display: grid;
          gap: 5px;
          grid-auto-rows: min-content;
          justify-items: center;
          padding: 10px 12px;
        }

        .power-flow-card--simple .power-flow-card__bubble--home {
          gap: 4px;
          padding: 9px 11px;
        }

        .power-flow-card__home-icon-wrap {
          align-items: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          display: inline-flex;
          height: 31px;
          justify-content: center;
          width: 31px;
        }

        .power-flow-card--simple .power-flow-card__home-icon-wrap {
          height: 29px;
          width: 29px;
        }

        .power-flow-card__home-icon-wrap ha-icon {
          --mdc-icon-size: 17px;
        }

        .power-flow-card__home-value {
          align-items: baseline;
          display: inline-flex;
          gap: 4px;
          justify-content: center;
          min-width: 0;
        }

        .power-flow-card--simple .power-flow-card__home-value {
          gap: 3px;
        }

        .power-flow-card__home-value-number {
          font-size: ${Math.max(19, parseSizeToPixels(styles.home_value_size, 22))}px;
          font-weight: 700;
          letter-spacing: -0.04em;
          line-height: 0.9;
        }

        .power-flow-card--simple .power-flow-card__home-value-number {
          font-size: ${Math.max(16, parseSizeToPixels(styles.home_value_size, 22) - 4)}px;
          letter-spacing: -0.035em;
        }

        .power-flow-card__home-value-unit {
          font-size: ${Math.max(12, parseSizeToPixels(styles.home_unit_size, 14))}px;
          font-weight: 600;
          opacity: 0.84;
        }

        .power-flow-card--simple .power-flow-card__home-value-unit {
          font-size: ${Math.max(10, parseSizeToPixels(styles.home_unit_size, 14) - 2)}px;
        }

        .power-flow-card__bubble--individual {
          border-radius: 18px;
        }

        .power-flow-card__chip {
          align-items: center;
          background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.03) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          color: var(--primary-text-color);
          display: inline-flex;
          font-size: var(--chip-font-size, 10px);
          font-weight: 600;
          gap: 4px;
          height: var(--chip-height, 22px);
          justify-content: center;
          max-width: 180px;
          min-width: 0;
          padding: var(--chip-padding, 0 9px);
          white-space: nowrap;
        }

        .power-flow-card__chip--label,
        .power-flow-card__chip--value {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .power-flow-card__chip--value {
          background: linear-gradient(180deg, color-mix(in srgb, var(--chip-tint) 14%, rgba(255,255,255,0.05)) 0%, rgba(255,255,255,0.035) 100%);
          border-color: color-mix(in srgb, var(--chip-tint) 26%, rgba(255,255,255,0.08));
        }

        .power-flow-card__chip-unit {
          opacity: 0.82;
        }

        .power-flow-card__node-secondary {
          color: var(--secondary-text-color);
          display: block;
          font-size: var(--secondary-size, 10px);
          font-weight: 500;
          max-width: 170px;
          overflow: hidden;
          text-align: center;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .power-flow-card__unavailable {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          color: #fff;
          display: inline-flex;
          height: 18px;
          justify-content: center;
          position: absolute;
          right: -3px;
          top: -3px;
          width: 18px;
          z-index: 2;
        }

        .power-flow-card__unavailable ha-icon {
          --mdc-icon-size: 11px;
        }

        .power-flow-card__content.is-pressing {
          animation: power-flow-card-content-bounce var(--power-flow-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        :is(.power-flow-card__bubble, .power-flow-card__dashboard-button).is-pressing {
          animation: power-flow-card-bubble-bounce var(--power-flow-card-button-bounce-duration) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
        }

        @keyframes power-flow-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes power-flow-card-surface-in {
          0% {
            opacity: 0;
            transform: scale(0.975);
          }
          60% {
            opacity: 1;
            transform: scale(1.015);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes power-flow-card-lines-in {
          0% {
            opacity: 0;
            transform: scale(0.985);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes power-flow-card-dots-in {
          0% {
            opacity: 0;
            transform: scale(0.94);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes power-flow-card-node-in {
          0% {
            opacity: 0;
            transform: translate(-50%, calc(-50% + 10px)) scale(0.9);
          }
          62% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.04);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes power-flow-card-content-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.015);
          }
          72% {
            transform: scale(1.006);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes power-flow-card-bubble-bounce {
          0% {
            transform: scale(1);
          }
          48% {
            transform: scale(1.1);
          }
          72% {
            transform: scale(1.03);
          }
          100% {
            transform: scale(1);
          }
        }

        @media (max-width: 640px) {
          .power-flow-card__surface {
            min-height: ${
              layoutPreset === "simple"
                ? 144
                : hasLowerNodes
                  ? 304
                  : 230
            }px;
          }

          .power-flow-card__dashboard-button {
            min-height: 34px;
            padding: 0 12px;
          }
        }

        ${animations.enabled ? "" : `
        .power-flow-card,
        .power-flow-card *,
        .power-flow-card *::before,
        .power-flow-card *::after {
          animation: none !important;
          transition: none !important;
        }
        `}
      </style>
      <ha-card class="power-flow-card power-flow-card--${layoutPreset}">
        ${
          hasHeader
            ? `
              <div class="power-flow-card__header ${shouldAnimateEntrance ? "power-flow-card__header--entering" : ""}">
                <div class="power-flow-card__title">${escapeHtml(titleText)}</div>
                ${
                  showDashboardButton && layoutPreset !== "simple"
                    ? `
                      <button class="power-flow-card__dashboard-button" data-dashboard-action="navigate" title="${escapeHtml(this._config?.dashboard_link_label || "Energia")}">
                        <ha-icon icon="mdi:lightning-bolt-circle"></ha-icon>
                        <span>${escapeHtml(this._config?.dashboard_link_label || "Energia")}</span>
                      </button>
                    `
                    : ""
                }
              </div>
            `
            : ""
        }
        <div class="power-flow-card__content ${shouldAnimateEntrance ? "power-flow-card__content--entering" : ""}" ${this._config?.tap_action === "more-info" ? 'data-card-action="primary"' : ""}>
          ${
            layoutPreset === "simple"
              ? this._renderSimpleLayout(nodes, lines, {
                animateEntrance: shouldAnimateEntrance,
              })
              : `
                <div class="power-flow-card__surface ${shouldAnimateEntrance ? "power-flow-card__surface--entering" : ""}">
                  <svg class="power-flow-card__svg power-flow-card__svg--lines" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <filter id="power-flow-glow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="1.2"></feGaussianBlur>
                      </filter>
                      <filter id="power-flow-soften" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="0.18"></feGaussianBlur>
                      </filter>
                    </defs>
                    ${lines.map(line => `
                      <path class="power-flow-card__line-glow" d="${line.path}" stroke="${escapeHtml(line.color)}" opacity="${line.opacity * (line.active ? 1 : 0.7)}"></path>
                      <path class="power-flow-card__line" d="${line.path}" stroke="${escapeHtml(line.color)}" opacity="${line.opacity}"></path>
                    `).join("")}
                  </svg>
                  ${this._renderNode(nodes.home, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.home),
                  })}
                  ${nodes.grid.entityId ? this._renderNode(nodes.grid, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.grid),
                  }) : ""}
                  ${nodes.solar.entityId ? this._renderNode(nodes.solar, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.solar),
                  }) : ""}
                  ${nodes.battery.entityId ? this._renderNode(nodes.battery, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.battery),
                  }) : ""}
                  ${nodes.water.entityId ? this._renderNode(nodes.water, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.water),
                  }) : ""}
                  ${nodes.gas.entityId ? this._renderNode(nodes.gas, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.gas),
                  }) : ""}
                  ${nodes.individual.map((node, index) => this._renderNode(node, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(node, index),
                  })).join("")}
                  <svg class="power-flow-card__svg power-flow-card__svg--dots" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                    ${lines.map(line => this._renderFlowDots(line)).join("")}
                  </svg>
                </div>
              `
          }
        </div>
      </ha-card>
    `;

    this._lastRenderSignature = this._getRenderSignature();

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 180);
    }
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaPowerFlowCard);
}

class NodaliaPowerFlowCardEditor extends HTMLElement {
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
      case "number": {
        const numeric = Number(input.value);
        return Number.isFinite(numeric) ? numeric : undefined;
      }
      case "rgb-array":
        return String(input.value || "")
          .split(",")
          .map(item => clamp(Number.parseInt(item.trim(), 10) || 0, 0, 255))
          .slice(0, 3);
      case "individuals":
        return String(input.value || "")
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const [entity, name = "", icon = "", color = ""] = line.split("|").map(part => part.trim());
            return { entity, name, icon, color };
          })
          .filter(item => item.entity);
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
          ${options.map(option => `
            <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
              ${escapeHtml(this._editorLabel(option.label))}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  _serializeIndividuals() {
    return resolveIndividualConfigs(this._config)
      .map(entry => [entry.entity || "", entry.name || "", entry.icon || "", entry.color || ""].join("|"))
      .join("\n");
  }

  _getEntityOptionsMarkup() {
    const allEntities = Object.keys(this._hass?.states || {})
      .filter(entityId => entityId.startsWith("sensor.") || entityId.startsWith("number.") || entityId.startsWith("input_number."))
      .sort((left, right) => left.localeCompare(right, "es"));

    return `
      <datalist id="power-flow-card-entity-options">
        ${allEntities.map(entityId => `<option value="${escapeHtml(entityId)}"></option>`).join("")}
      </datalist>
    `;
  }

  _renderNodeSection(title, hint, prefix, values) {
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div class="editor-section__title">${escapeHtml(title)}</div>
          <div class="editor-section__hint">${escapeHtml(hint)}</div>
        </div>
        <div class="editor-grid">
          ${this._renderTextField("Entidad", `${prefix}.entity`, values.entity, { placeholder: "sensor.mi_sensor" })}
          ${this._renderTextField("Nombre", `${prefix}.name`, values.name)}
          ${this._renderTextField("Icono", `${prefix}.icon`, values.icon, { placeholder: "mdi:flash" })}
          ${this._renderTextField("Color", `${prefix}.color`, values.color, { placeholder: "#f6b73c" })}
          ${this._renderTextField("Entidad secundaria", `${prefix}.secondary_info.entity`, values.secondary_info?.entity, { placeholder: "sensor.mi_secundaria" })}
          ${this._renderTextField("Atributo secundario", `${prefix}.secondary_info.attribute`, values.secondary_info?.attribute, { placeholder: "battery_level" })}
        </div>
      </section>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig(STUB_CONFIG);
    const hapticStyle = config.haptics?.style || "medium";
    const grid = resolveNodeConfig("grid", config);
    const home = resolveNodeConfig("home", config);
    const solar = resolveNodeConfig("solar", config);
    const battery = resolveNodeConfig("battery", config);
    const water = resolveNodeConfig("water", config);
    const gas = resolveNodeConfig("gas", config);

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
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Titulo, enlace al panel de energia y comportamiento general de la tarjeta."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Titulo", "title", config.title, { placeholder: "Energia" })}
            ${this._renderTextField("Enlace panel energia", "dashboard_link", config.dashboard_link, { placeholder: "/energy/overview" })}
            ${this._renderTextField("Etiqueta boton energia", "dashboard_link_label", config.dashboard_link_label, { placeholder: "Energia" })}
            ${this._renderSelectField("Tap card", "tap_action", config.tap_action || "none", [
              { value: "none", label: "Sin accion" },
              { value: "more-info", label: "More info casa" },
            ])}
            ${this._renderCheckboxField("Mostrar cabecera", "show_header", config.show_header !== false)}
            ${this._renderCheckboxField("Mostrar boton energia", "show_dashboard_link_button", config.show_dashboard_link_button !== false)}
            ${this._renderCheckboxField("Etiquetas", "show_labels", config.show_labels !== false)}
            ${this._renderCheckboxField("Valores", "show_values", config.show_values !== false)}
            ${this._renderCheckboxField("Info secundaria", "show_secondary_info", config.show_secondary_info !== false)}
            ${this._renderCheckboxField("Click entidades", "clickable_entities", config.clickable_entities !== false)}
            ${this._renderCheckboxField("Badge no disponible", "show_unavailable_badge", config.show_unavailable_badge !== false)}
          </div>
        </section>

        ${this._renderNodeSection("Red", "Sensor de red con potencia positiva de consumo y negativa de exportacion, o split de consumo/produccion.", "entities.grid", grid)}
        ${this._renderNodeSection("Casa", "Entidad central del hogar que se abrira en more-info si pulsas la burbuja central.", "entities.home", home)}
        ${this._renderNodeSection("Solar", "Produccion solar instantanea.", "entities.solar", solar)}
        ${this._renderNodeSection("Bateria", "Potencia de bateria. Positiva descarga hacia casa, negativa carga desde casa.", "entities.battery", battery)}
        ${this._renderNodeSection("Agua", "Caudal o consumo de agua hacia el hogar.", "entities.water", water)}
        ${this._renderNodeSection("Gas", "Caudal o consumo de gas hacia el hogar.", "entities.gas", gas)}

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Individuales"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Una linea por entidad: \\`entity|nombre|icono|color\\`."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextareaField("Entidades individuales", "entities.individual", this._serializeIndividuals(), {
              valueType: "individuals",
              rows: 5,
              placeholder: "sensor.cargador_coche|Cargador|mdi:car-electric|#42a5f5",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Flujo"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Controla la visualizacion de lineas sin consumo y la velocidad de animacion."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField("Lineas a cero", "display_zero_lines.mode", config.display_zero_lines?.mode || "show", [
              { value: "show", label: "Mostrar" },
              { value: "hide", label: "Ocultar" },
            ])}
            ${this._renderTextField("Transparencia lineas cero", "display_zero_lines.transparency", config.display_zero_lines?.transparency, {
              type: "number",
              valueType: "number",
              placeholder: "50",
            })}
            ${this._renderTextField("Color gris RGB", "display_zero_lines.grey_color", arrayFromMaybe(config.display_zero_lines?.grey_color).join(", "), {
              valueType: "rgb-array",
              placeholder: "189, 189, 189",
            })}
            ${this._renderTextField("Flujo minimo (s)", "min_flow_rate", config.min_flow_rate, {
              type: "number",
              valueType: "number",
              placeholder: "1.4",
            })}
            ${this._renderTextField("Flujo maximo (s)", "max_flow_rate", config.max_flow_rate, {
              type: "number",
              valueType: "number",
              placeholder: "5.8",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Estilo"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Ajustes visuales base de la tarjeta y las burbujas."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderTextField("Background", "styles.card.background", config.styles?.card?.background)}
            ${this._renderTextField("Border", "styles.card.border", config.styles?.card?.border)}
            ${this._renderTextField("Radius", "styles.card.border_radius", config.styles?.card?.border_radius)}
            ${this._renderTextField("Shadow", "styles.card.box_shadow", config.styles?.card?.box_shadow)}
            ${this._renderTextField("Padding", "styles.card.padding", config.styles?.card?.padding)}
            ${this._renderTextField("Gap", "styles.card.gap", config.styles?.card?.gap)}
            ${this._renderTextField("Tamano nodo", "styles.icon.node_size", config.styles?.icon?.node_size)}
            ${this._renderTextField("Tamano casa", "styles.icon.home_size", config.styles?.icon?.home_size)}
            ${this._renderTextField("Tamano individual", "styles.icon.individual_size", config.styles?.icon?.individual_size)}
            ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles?.title_size)}
            ${this._renderTextField("Tamano chip", "styles.chip_height", config.styles?.chip_height)}
            ${this._renderTextField("Texto chip", "styles.chip_font_size", config.styles?.chip_font_size)}
            ${this._renderTextField("Valor casa", "styles.home_value_size", config.styles?.home_value_size)}
            ${this._renderTextField("Unidad casa", "styles.home_unit_size", config.styles?.home_unit_size)}
            ${this._renderTextField("Valor nodo", "styles.node_value_size", config.styles?.node_value_size)}
            ${this._renderTextField("Grosor lineas", "styles.flow_width", config.styles?.flow_width)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Haptics"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Respuesta tactil opcional al pulsar nodos o botones."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Activar haptics", "haptics.enabled", config.haptics?.enabled === true)}
            ${this._renderCheckboxField("Fallback con vibracion", "haptics.fallback_vibrate", config.haptics?.fallback_vibrate === true)}
            ${this._renderSelectField("Estilo", "haptics.style", hapticStyle, [
              { value: "selection", label: "Selection" },
              { value: "light", label: "Light" },
              { value: "medium", label: "Medium" },
              { value: "heavy", label: "Heavy" },
              { value: "success", label: "Success" },
              { value: "warning", label: "Warning" },
              { value: "failure", label: "Failure" },
            ])}
          </div>
        </section>
        ${this._getEntityOptionsMarkup()}
      </div>
    `;

    this.shadowRoot.querySelectorAll('input[data-field$=".entity"]').forEach(input => {
      input.setAttribute("list", "power-flow-card-entity-options");
    });
  }
}

class NodaliaPowerFlowCardVisualEditor extends HTMLElement {
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

  disconnectedCallback() {
    this.shadowRoot.removeEventListener("input", this._onShadowInput);
    this.shadowRoot.removeEventListener("change", this._onShadowInput);
    this.shadowRoot.removeEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.removeEventListener("click", this._onShadowClick);
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
      .filter(([entityId]) => entityId.startsWith("sensor.") || entityId.startsWith("number.") || entityId.startsWith("input_number."))
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
    this._watchEditorControlTag("ha-icon-picker");
  }

  _getPowerEntityOptions(path = "entity") {
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => entityId.startsWith("sensor.") || entityId.startsWith("number.") || entityId.startsWith("input_number."))
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
      case "number": {
        const numeric = Number(input.value);
        return Number.isFinite(numeric) ? numeric : undefined;
      }
      case "rgb-array-color": {
        const normalizedHex = String(input.value || "").trim().replace(/^#/, "");
        if (!/^[0-9a-f]{6}$/i.test(normalizedHex)) {
          return undefined;
        }
        return [
          Number.parseInt(normalizedHex.slice(0, 2), 16),
          Number.parseInt(normalizedHex.slice(2, 4), 16),
          Number.parseInt(normalizedHex.slice(4, 6), 16),
        ];
      }
      case "individuals":
        return String(input.value || "")
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const [entity, name = "", icon = "", color = ""] = line.split("|").map(part => part.trim());
            return { entity, name, icon, color };
          })
          .filter(item => item.entity);
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

  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    const hass = this._hass ?? this.hass;
    return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", s);
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";

    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
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
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(currentValue)};"></span>
          </label>
        </div>
      </div>
    `;
  }

  _renderRgbArrayColorField(label, field, value, options = {}) {
    const fallbackValue = arrayFromMaybe(options.fallbackValue || DEFAULT_CONFIG.display_zero_lines.grey_color);
    const sourceValue = arrayFromMaybe(value);
    const rgbValue = sourceValue.length >= 3 ? sourceValue : fallbackValue;
    const hexValue = `#${rgbValue.slice(0, 3).map(channel => formatEditorHexChannel(channel)).join("")}`;
    const swatchValue = rgbArrayToColor(rgbValue, fallbackValue);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(label)}</span>
        <div class="editor-color-field">
          <label class="editor-color-picker" title="Color personalizado">
            <input
              type="color"
              data-field="${escapeHtml(field)}"
              data-value-type="rgb-array-color"
              value="${escapeHtml(hexValue)}"
              aria-label="${escapeHtml(label)}"
            />
            <span class="editor-color-swatch" style="--editor-swatch: ${escapeHtml(swatchValue)};"></span>
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

  _renderSelectField(label, field, value, options, renderOptions = {}) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field ${renderOptions.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options.map(option => `
            <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
              ${escapeHtml(this._editorLabel(option.label))}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  _renderEntityPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder || "";

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(placeholder)}"
        ></div>
      </div>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <ha-icon-picker
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          value="${escapeHtml(inputValue)}"
          ${placeholder}
        ></ha-icon-picker>
      </div>
    `;
  }

  _serializeIndividuals() {
    return resolveIndividualConfigs(this._config)
      .map(entry => [entry.entity || "", entry.name || "", entry.icon || "", entry.color || ""].join("|"))
      .join("\n");
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
      control.includeDomains = ["sensor", "number", "input_number"];
      control.allowCustomEntity = true;
      control.entityFilter = stateObj => {
        const entityId = String(stateObj?.entity_id || "");
        return entityId.startsWith("sensor.") || entityId.startsWith("number.") || entityId.startsWith("input_number.");
      };
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else {
      control = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder || this._editorLabel("Selecciona una entidad");
      control.appendChild(emptyOption);
      this._getPowerEntityOptions(field).forEach(option => {
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

  _renderNodeSection(title, hint, prefix, values) {
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div class="editor-section__title">${escapeHtml(title)}</div>
          <div class="editor-section__hint">${escapeHtml(hint)}</div>
        </div>
        <div class="editor-grid editor-grid--stacked">
          ${this._renderEntityPickerField("Entidad", `${prefix}.entity`, values.entity, {
            placeholder: "sensor.mi_sensor",
            fullWidth: true,
          })}
          ${this._renderTextField("Nombre", `${prefix}.name`, values.name)}
          ${this._renderIconPickerField("Icono", `${prefix}.icon`, values.icon, {
            placeholder: "mdi:flash",
          })}
          ${this._renderColorField("Color", `${prefix}.color`, values.color)}
          ${this._renderEntityPickerField("Entidad secundaria", `${prefix}.secondary_info.entity`, values.secondary_info?.entity, {
            placeholder: "sensor.mi_secundaria",
            fullWidth: true,
          })}
          ${this._renderTextField("Atributo secundario", `${prefix}.secondary_info.attribute`, values.secondary_info?.attribute, {
            placeholder: "battery_level",
          })}
          ${this._renderTextField("Unidad secundaria", `${prefix}.secondary_info.unit`, values.secondary_info?.unit, {
            placeholder: "kWh",
          })}
          ${this._renderTextField("Decimales secundarios", `${prefix}.secondary_info.decimals`, values.secondary_info?.decimals, {
            type: "number",
            valueType: "number",
            placeholder: "0",
          })}
        </div>
      </section>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig(STUB_CONFIG);
    const hapticStyle = config.haptics?.style || "medium";
    const tapAction = config.tap_action || "none";
    const animations = config.animations || DEFAULT_CONFIG.animations;
    const grid = resolveNodeConfig("grid", config);
    const home = resolveNodeConfig("home", config);
    const solar = resolveNodeConfig("solar", config);
    const battery = resolveNodeConfig("battery", config);
    const water = resolveNodeConfig("water", config);
    const gas = resolveNodeConfig("gas", config);

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

        .editor-field > span,
        .editor-toggle > span {
          font-size: 12px;
          font-weight: 600;
        }

        .editor-field input,
        .editor-field select,
        .editor-field textarea {
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

        .editor-field textarea {
          min-height: 120px;
          resize: vertical;
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
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
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

        @media (max-width: 720px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("General"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Titulo, enlace al panel de energia y comportamiento general de la tarjeta."))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderTextField("Titulo", "title", config.title, { placeholder: "Energia", fullWidth: true })}
            ${this._renderTextField("Enlace panel energia", "dashboard_link", config.dashboard_link, { placeholder: "/energy/overview", fullWidth: true })}
            ${this._renderTextField("Etiqueta boton energia", "dashboard_link_label", config.dashboard_link_label, { placeholder: "Energia", fullWidth: true })}
            ${this._renderSelectField("Tap card", "tap_action", tapAction, [
              { value: "none", label: "Sin accion" },
              { value: "more-info", label: "More info casa" },
            ], { fullWidth: true })}
            ${this._renderCheckboxField("Mostrar cabecera", "show_header", config.show_header !== false)}
            ${this._renderCheckboxField("Mostrar boton energia", "show_dashboard_link_button", config.show_dashboard_link_button !== false)}
            ${this._renderCheckboxField("Etiquetas", "show_labels", config.show_labels !== false)}
            ${this._renderCheckboxField("Valores", "show_values", config.show_values !== false)}
            ${this._renderCheckboxField("Info secundaria", "show_secondary_info", config.show_secondary_info !== false)}
            ${this._renderCheckboxField("Click entidades", "clickable_entities", config.clickable_entities !== false)}
            ${this._renderCheckboxField("Badge no disponible", "show_unavailable_badge", config.show_unavailable_badge !== false)}
          </div>
        </section>

        ${this._renderNodeSection("Red", "Sensor de red con potencia positiva de consumo y negativa de exportacion.", "entities.grid", grid)}
        ${this._renderNodeSection("Casa", "Entidad central del hogar y objetivo del more-info principal.", "entities.home", home)}
        ${this._renderNodeSection("Solar", "Produccion solar instantanea.", "entities.solar", solar)}
        ${this._renderNodeSection("Bateria", "Potencia de bateria. Positiva descarga, negativa carga.", "entities.battery", battery)}
        ${this._renderNodeSection("Agua", "Caudal o consumo de agua hacia el hogar.", "entities.water", water)}
        ${this._renderNodeSection("Gas", "Caudal o consumo de gas hacia el hogar.", "entities.gas", gas)}

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Individuales"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Una linea por entidad: \\`entity|nombre|icono|color\\`."))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderTextareaField("Entidades individuales", "entities.individual", this._serializeIndividuals(), {
              valueType: "individuals",
              rows: 5,
              placeholder: "sensor.cargador_coche|Cargador|mdi:car-electric|#42a5f5",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Flujo"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Controla las lineas a cero y la velocidad del flujo."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField("Lineas a cero", "display_zero_lines.mode", config.display_zero_lines?.mode || "show", [
              { value: "show", label: "Mostrar" },
              { value: "hide", label: "Ocultar" },
            ])}
            ${this._renderTextField("Transparencia lineas cero", "display_zero_lines.transparency", config.display_zero_lines?.transparency, {
              type: "number",
              valueType: "number",
              placeholder: "50",
            })}
            ${this._renderRgbArrayColorField("Color lineas cero", "display_zero_lines.grey_color", config.display_zero_lines?.grey_color)}
            ${this._renderTextField("Flujo minimo (s)", "min_flow_rate", config.min_flow_rate, {
              type: "number",
              valueType: "number",
              placeholder: "1.4",
            })}
            ${this._renderTextField("Flujo maximo (s)", "max_flow_rate", config.max_flow_rate, {
              type: "number",
              valueType: "number",
              placeholder: "5.8",
            })}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Haptics"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Respuesta tactil opcional al pulsar nodos o botones."))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("Activar haptics", "haptics.enabled", config.haptics?.enabled === true)}
            ${this._renderCheckboxField("Fallback con vibracion", "haptics.fallback_vibrate", config.haptics?.fallback_vibrate === true)}
            ${this._renderSelectField("Estilo", "haptics.style", hapticStyle, [
              { value: "selection", label: "Selection" },
              { value: "light", label: "Light" },
              { value: "medium", label: "Medium" },
              { value: "heavy", label: "Heavy" },
              { value: "success", label: "Success" },
              { value: "warning", label: "Warning" },
              { value: "failure", label: "Failure" },
            ])}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Animaciones"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Entrada suave del flujo y rebote al pulsar nodos o acciones."))}</div>
            <div class="editor-section__actions">
              <button
                type="button"
                class="editor-section__toggle-button"
                data-editor-toggle="animations"
                aria-expanded="${this._showAnimationSection ? "true" : "false"}"
              >
                <ha-icon icon="${this._showAnimationSection ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                <span>${escapeHtml(this._showAnimationSection ? this._editorLabel("Ocultar ajustes de animación") : this._editorLabel("Mostrar ajustes de animación"))}</span>
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
                    valueType: "number",
                  })}
                  ${this._renderTextField("Rebote pulsacion (ms)", "animations.button_bounce_duration", animations.button_bounce_duration, {
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("Estilo"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("Ajustes visuales base de la tarjeta y las burbujas."))}</div>
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
                  ${this._renderTextField("Background", "styles.card.background", config.styles?.card?.background)}
                  ${this._renderTextField("Border", "styles.card.border", config.styles?.card?.border)}
                  ${this._renderTextField("Radius", "styles.card.border_radius", config.styles?.card?.border_radius)}
                  ${this._renderTextField("Shadow", "styles.card.box_shadow", config.styles?.card?.box_shadow)}
                  ${this._renderTextField("Padding", "styles.card.padding", config.styles?.card?.padding)}
                  ${this._renderTextField("Gap", "styles.card.gap", config.styles?.card?.gap)}
                  ${this._renderTextField("Tamano nodo", "styles.icon.node_size", config.styles?.icon?.node_size)}
                  ${this._renderTextField("Tamano casa", "styles.icon.home_size", config.styles?.icon?.home_size)}
                  ${this._renderTextField("Tamano individual", "styles.icon.individual_size", config.styles?.icon?.individual_size)}
                  ${this._renderTextField("Color iconos", "styles.icon.color", config.styles?.icon?.color)}
                  ${this._renderTextField("Tamano titulo", "styles.title_size", config.styles?.title_size)}
                  ${this._renderTextField("Tamano chip", "styles.chip_height", config.styles?.chip_height)}
                  ${this._renderTextField("Texto chip", "styles.chip_font_size", config.styles?.chip_font_size)}
                  ${this._renderTextField("Padding chip", "styles.chip_padding", config.styles?.chip_padding)}
                  ${this._renderTextField("Valor casa", "styles.home_value_size", config.styles?.home_value_size)}
                  ${this._renderTextField("Unidad casa", "styles.home_unit_size", config.styles?.home_unit_size)}
                  ${this._renderTextField("Valor nodo", "styles.node_value_size", config.styles?.node_value_size)}
                  ${this._renderTextField("Texto secundario", "styles.secondary_size", config.styles?.secondary_size)}
                  ${this._renderTextField("Grosor lineas", "styles.flow_width", config.styles?.flow_width)}
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
  customElements.define(EDITOR_TAG, NodaliaPowerFlowCardVisualEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Nodalia Power Flow Card",
  description: "Tarjeta Nodalia de flujo energetico para red, solar, bateria, agua, gas y consumos individuales.",
  preview: true,
});
