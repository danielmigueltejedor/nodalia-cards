const CARD_TAG = "nodalia-scenes-card";
const EDITOR_TAG = "nodalia-scenes-card-editor";
const CARD_VERSION = "1.2.0-alpha.39";
const DEFAULT_SCENE_ACCENT = "#c9a86c";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};

const TAP_ACTIONS = new Set(["activate", "more-info", "none"]);
const HOLD_ACTIONS = new Set(["activate", "more-info", "none"]);

const DEFAULT_CONFIG = {
  name: "",
  language: "auto",
  scenes: [],
  layout: "grid",
  columns: 3,
  show_title: true,
  show_active: true,
  use_entity_icon: true,
  use_entity_picture: false,
  tap_action: "activate",
  hold_action: "more-info",
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
    accent: DEFAULT_SCENE_ACCENT,
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "28px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "14px",
      gap: "12px",
    },
    button: {
      min_height: "68px",
      border_radius: "20px",
      gap: "8px",
      icon_size: "24px",
      label_size: "12px",
      background: "",
      border: "",
    },
    icon: {
      size: "44px",
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      on_color: DEFAULT_SCENE_ACCENT,
    },
    active: {
      border_color: "",
      background: "",
      glow: "",
    },
    chip_border_radius: "999px",
    title_size: "15px",
  },
};

const STUB_CONFIG = {
  name: "Scenes",
  layout: "grid",
  columns: 2,
  scenes: [],
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
  if (window.NodaliaUtils?.deepClone) {
    return window.NodaliaUtils.deepClone(value);
  }
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

function mergeConfig(base, override) {
  if (window.NodaliaUtils?.mergeDeep) {
    return window.NodaliaUtils.mergeDeep(base, override || {});
  }
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
  if (window.NodaliaUtils?.compactConfig) {
    return window.NodaliaUtils.compactConfig(value);
  }
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

function moveItem(list, fromIndex, toIndex) {
  if (!Array.isArray(list) || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return;
  }
  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatEditorHexChannel(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
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
  const normalized = String(field || "");
  if (normalized.endsWith("icon.on_color") || normalized.endsWith("styles.accent") || normalized.endsWith(".color")) {
    return DEFAULT_SCENE_ACCENT;
  }
  if (normalized.endsWith("icon.color")) {
    return DEFAULT_CONFIG.styles.icon.color;
  }
  if (normalized.endsWith("icon.background")) {
    return DEFAULT_CONFIG.styles.icon.background;
  }
  if (normalized.endsWith("active.border_color")) {
    return DEFAULT_SCENE_ACCENT;
  }
  if (normalized.endsWith("active.background")) {
    return DEFAULT_SCENE_ACCENT;
  }
  if (normalized.endsWith("button.background")) {
    return "color-mix(in srgb, var(--primary-text-color) 5%, transparent)";
  }
  if (normalized.endsWith("card.background")) {
    return DEFAULT_CONFIG.styles.card.background;
  }
  return DEFAULT_CONFIG.styles.icon.on_color;
}

function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
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

function collectDashboardScrollSnapshot(anchor) {
  const containers = [];
  const seen = new Set();
  const remember = el => {
    if (!(el instanceof HTMLElement) || seen.has(el)) {
      return;
    }
    seen.add(el);
    containers.push({
      el,
      left: el.scrollLeft,
      top: el.scrollTop,
    });
  };

  let node = anchor instanceof HTMLElement ? anchor : null;
  while (node) {
    const style = getComputedStyle(node);
    if (
      (/(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) ||
      (/(auto|scroll|overlay)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1)
    ) {
      remember(node);
    }
    node = node.parentElement;
  }

  if (typeof document !== "undefined") {
    remember(document.scrollingElement || document.documentElement);
    try {
      const homeAssistant = document.querySelector("home-assistant");
      const huiRoot = homeAssistant?.shadowRoot?.querySelector("hui-root");
      remember(huiRoot?.shadowRoot?.querySelector("#view"));
      remember(
        homeAssistant
          ?.shadowRoot
          ?.querySelector("partial-panel-resolver")
          ?.shadowRoot
          ?.querySelector("ha-panel-lovelace")
          ?.shadowRoot
          ?.querySelector("hui-view"),
      );
    } catch (_error) {
      // Ignore closed shadow roots.
    }
  }

  return {
    containers,
    winX: typeof window !== "undefined" ? window.scrollX : 0,
    winY: typeof window !== "undefined" ? window.scrollY : 0,
  };
}

function restoreDashboardScrollSnapshot(snapshot) {
  if (!snapshot?.containers?.length) {
    return;
  }
  snapshot.containers.forEach(({ el, left, top }) => {
    if (!(el instanceof HTMLElement) || !el.isConnected) {
      return;
    }
    if (el.scrollTop !== top) {
      el.scrollTop = top;
    }
    if (el.scrollLeft !== left) {
      el.scrollLeft = left;
    }
  });
  if (typeof window !== "undefined") {
    window.scrollTo(snapshot.winX, snapshot.winY);
  }
}

function scheduleDashboardScrollRestore(snapshot) {
  if (!snapshot?.containers?.length || typeof window === "undefined") {
    return;
  }
  const restore = () => restoreDashboardScrollSnapshot(snapshot);
  restore();
  window.requestAnimationFrame(() => {
    restore();
    window.requestAnimationFrame(restore);
  });
  window.setTimeout(restore, 0);
  window.setTimeout(restore, 48);
}

function sanitizeCssValue(value, fallback) {
  const raw = String(value ?? "").trim();
  const safeFallback = String(fallback ?? "").trim();
  if (!raw) {
    return safeFallback;
  }
  if (/[\u0000-\u001f\u007f<>;"'{}]/.test(raw) || raw.includes("/*") || raw.includes("*/")) {
    return safeFallback;
  }
  return raw;
}

function getDefaultSceneAccent(styles = DEFAULT_CONFIG.styles) {
  return sanitizeCssValue(styles?.accent, DEFAULT_SCENE_ACCENT) || DEFAULT_SCENE_ACCENT;
}

function resolveSceneAccent(value, fallback = DEFAULT_SCENE_ACCENT) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallback;
  }
  return sanitizeCssValue(raw, fallback) || fallback;
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

function getSafeStyles(styles = DEFAULT_CONFIG.styles) {
  const defaults = DEFAULT_CONFIG.styles;
  const card = styles?.card || {};
  const button = styles?.button || {};
  const icon = styles?.icon || {};
  const active = styles?.active || {};
  return {
    accent: getDefaultSceneAccent(styles),
    card: {
      background: sanitizeCssValue(card.background, defaults.card.background),
      border: sanitizeCssValue(card.border, defaults.card.border),
      border_radius: sanitizeCssValue(card.border_radius, defaults.card.border_radius),
      box_shadow: sanitizeCssValue(card.box_shadow, defaults.card.box_shadow),
      gap: sanitizeCssValue(card.gap, defaults.card.gap),
      padding: sanitizeCssValue(card.padding, defaults.card.padding),
    },
    button: {
      background: sanitizeCssValue(button.background, defaults.button.background),
      border: sanitizeCssValue(button.border, defaults.button.border),
      border_radius: sanitizeCssValue(button.border_radius, defaults.button.border_radius),
      gap: sanitizeCssValue(button.gap, defaults.button.gap),
      icon_size: sanitizeCssValue(button.icon_size, defaults.button.icon_size),
      label_size: sanitizeCssValue(button.label_size, defaults.button.label_size),
      min_height: sanitizeCssValue(button.min_height, defaults.button.min_height),
    },
    icon: {
      background: sanitizeCssValue(icon.background, defaults.icon.background),
      color: sanitizeCssValue(icon.color, defaults.icon.color),
      on_color: sanitizeCssValue(icon.on_color, defaults.icon.on_color),
      size: sanitizeCssValue(icon.size, defaults.icon.size),
    },
    active: {
      background: sanitizeCssValue(active.background, defaults.active.background),
      border_color: sanitizeCssValue(active.border_color, defaults.active.border_color),
      glow: sanitizeCssValue(active.glow, defaults.active.glow),
    },
    chip_border_radius: sanitizeCssValue(styles?.chip_border_radius, defaults.chip_border_radius),
    title_size: sanitizeCssValue(styles?.title_size, defaults.title_size),
  };
}

function normalizeSceneRows(rawScenes, options = {}) {
  const keepEmpty = options.keepEmpty === true;
  if (!Array.isArray(rawScenes)) {
    return [];
  }

  const rows = rawScenes
    .map(item => {
      if (typeof item === "string") {
        return { entity: String(item).trim(), name: "", icon: "", color: "" };
      }
      if (!isObject(item)) {
        return null;
      }
      return {
        entity: String(item.entity || "").trim(),
        name: String(item.name || "").trim(),
        icon: String(item.icon || "").trim(),
        color: String(item.color || "").trim(),
      };
    })
    .filter(item => item !== null);

  return keepEmpty ? rows : rows.filter(item => item.entity);
}

function normalizeConfig(rawConfig, options = {}) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const layout = normalizeTextKey(config.layout);
  config.layout = layout === "list" ? "list" : "grid";
  config.columns = clamp(Math.round(Number(config.columns) || DEFAULT_CONFIG.columns), 1, 6);
  const tap = normalizeTextKey(config.tap_action);
  config.tap_action = TAP_ACTIONS.has(tap) ? tap : "activate";
  const hold = normalizeTextKey(config.hold_action);
  config.hold_action = HOLD_ACTIONS.has(hold) ? hold : "more-info";
  config.scenes = normalizeSceneRows(config.scenes, options);
  return config;
}

function getStubSceneEntities(hass, limit = 4) {
  const states = hass?.states || {};
  return Object.keys(states)
    .filter(entityId => entityId.startsWith("scene."))
    .slice(0, limit)
    .map(entity => ({ entity }));
}

function applyStubConfig(config, hass) {
  const next = deepClone(config);
  const scenes = getStubSceneEntities(hass);
  if (scenes.length) {
    next.scenes = scenes;
  }
  if (!String(next.name || "").trim()) {
    next.name = "Scenes";
  }
  return next;
}

function resolveSceneEntries(config, hass) {
  const rows = Array.isArray(config?.scenes) ? config.scenes : [];
  const defaultAccent = getDefaultSceneAccent(config?.styles);
  return rows
    .map((item, index) => {
      const entity = String(item?.entity || "").trim();
      if (!entity.startsWith("scene.")) {
        return null;
      }
      const state = hass?.states?.[entity];
      const friendly =
        window.NodaliaUtils?.getEntityFriendlyName?.(hass, entity)
        || state?.attributes?.friendly_name
        || entity.split(".")[1]?.replace(/_/g, " ")
        || entity;
      const label = String(item?.name || "").trim() || friendly;
      let icon = String(item?.icon || "").trim();
      if (!icon && config.use_entity_icon !== false) {
        icon = String(state?.attributes?.icon || "").trim() || "mdi:palette-outline";
      }
      if (!icon) {
        icon = "mdi:palette-outline";
      }
      const picture =
        config.use_entity_picture === true
          ? String(state?.attributes?.entity_picture || "").trim()
          : "";
      const accent = resolveSceneAccent(item?.color, defaultAccent);
      return {
        entity,
        label,
        icon,
        picture,
        accent,
        index,
        unavailable: !state || isUnavailableState(state),
        lastChanged: state?.last_changed ? Date.parse(state.last_changed) : 0,
      };
    })
    .filter(Boolean);
}

class NodaliaScenesCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return applyStubConfig(deepClone(STUB_CONFIG), hass);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._optimisticActiveEntity = "";
    this._suppressNextSceneTap = false;
    this._interactionScrollSnapshot = null;
    this._sceneInteractionScrollUntil = 0;
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowPointerDown = this._onShadowPointerDown.bind(this);
    this._onShadowMouseDown = this._onShadowMouseDown.bind(this);
    this._onShadowTouchStart = this._onShadowTouchStart.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown, true);
    this.shadowRoot.addEventListener("mousedown", this._onShadowMouseDown, true);
    this.shadowRoot.addEventListener("touchstart", this._onShadowTouchStart, { passive: false, capture: true });
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const button = event
                .composedPath()
                .find(node => node instanceof HTMLElement && node.dataset?.sceneEntity);
              return button?.dataset?.sceneEntity || null;
            },
            shouldBeginHold: entityId => this._canRunHoldAction(entityId),
            onHold: entityId => {
              this._triggerHaptic();
              this._performHoldAction(entityId);
            },
            markHoldConsumedClick: () => {
              this._suppressNextSceneTap = true;
            },
          })
        : () => {};
  }

  connectedCallback() {
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    this._detachHostHold?.();
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
    this._hass = hass;
    const nextSignature = this._getRenderSignature();
    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }
    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    const layout = this._config?.layout === "list" ? "list" : "grid";
    const count = Math.max(1, resolveSceneEntries(this._config, this._hass).length || 1);
    if (layout === "list") {
      return Math.min(6, count + 1);
    }
    const columns = clamp(Math.round(Number(this._config?.columns) || 3), 1, 6);
    return Math.min(6, Math.ceil(count / columns) + 1);
  }

  _getAnimationSettings() {
    const animations = this._config?.animations || DEFAULT_CONFIG.animations;
    return {
      enabled: animations.enabled !== false,
      contentDuration: clamp(Math.round(Number(animations.content_duration) || 420), 0, 2000),
      buttonBounceDuration: clamp(Math.round(Number(animations.button_bounce_duration) || 320), 0, 1200),
    };
  }

  _scenesUiCopy() {
    const NI = window.NodaliaI18n;
    if (!NI?.strings || !NI.resolveLanguage) {
      return {
        emptyTitle: "Nodalia Scenes Card",
        emptyBody: "Add scene entities in the card editor.",
        defaultName: "Scenes",
        unavailable: "Unavailable",
        active: "Active",
      };
    }
    const lang = NI.resolveLanguage(this._hass, this._config?.language);
    const scenes = NI.strings(lang).scenes || {};
    return {
      emptyTitle: scenes.emptyTitle || "Nodalia Scenes Card",
      emptyBody: scenes.emptyBody || "Add scene entities in the card editor.",
      defaultName: scenes.defaultName || "Scenes",
      unavailable: scenes.unavailable || "Unavailable",
      active: scenes.active || "Active",
    };
  }

  _getRenderSignature() {
    const entries = resolveSceneEntries(this._config, this._hass);
    const active = this._getActiveSceneEntity(entries);
    return [
      CARD_VERSION,
      JSON.stringify(this._config),
      entries.map(entry => `${entry.entity}:${entry.unavailable}:${entry.lastChanged}:${entry.accent}`).join("|"),
      active,
      this._optimisticActiveEntity,
    ].join("::");
  }

  _getActiveSceneEntity(entries) {
    if (this._config?.show_active === false) {
      return "";
    }
    const optimistic = String(this._optimisticActiveEntity || "").trim();
    if (optimistic && entries.some(entry => entry.entity === optimistic)) {
      return optimistic;
    }
    let bestEntity = "";
    let bestTs = 0;
    let tieCount = 0;
    entries.forEach(entry => {
      const ts = Number.isFinite(entry.lastChanged) ? entry.lastChanged : 0;
      if (ts <= 0) {
        return;
      }
      if (ts > bestTs) {
        bestTs = ts;
        bestEntity = entry.entity;
        tieCount = 1;
        return;
      }
      if (ts === bestTs) {
        tieCount += 1;
      }
    });
    if (!bestEntity || tieCount > 1) {
      return "";
    }
    return bestEntity;
  }

  _canRunHoldAction(entityId) {
    const action = normalizeTextKey(this._config?.hold_action);
    return Boolean(entityId) && action !== "none";
  }

  _triggerHaptic(styleOverride) {
    const haptics = this._config?.haptics || DEFAULT_CONFIG.haptics;
    if (haptics.enabled === false) {
      return;
    }
    const style = styleOverride || haptics.style || "medium";
    fireEvent(this, "haptic", style, { bubbles: true, composed: true });
    if (haptics.fallback_vibrate && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      const pattern = HAPTIC_PATTERNS[style] ?? HAPTIC_PATTERNS.medium;
      try {
        navigator.vibrate(pattern);
      } catch (_error) {
        // Ignore unsupported vibrate.
      }
    }
  }

  _triggerPressAnimation(button) {
    if (!(button instanceof HTMLElement)) {
      return;
    }
    button.classList.remove("is-pressing");
    void button.offsetWidth;
    button.classList.add("is-pressing");
    window.setTimeout(() => button.classList.remove("is-pressing"), this._getAnimationSettings().buttonBounceDuration);
  }

  _openMoreInfo(entityId) {
    if (!entityId) {
      return;
    }
    fireEvent(this, "hass-more-info", { entityId });
  }

  _captureDashboardScrollSnapshot() {
    return collectDashboardScrollSnapshot(this);
  }

  _scheduleDashboardScrollRestore(snapshot = this._interactionScrollSnapshot) {
    scheduleDashboardScrollRestore(snapshot);
  }

  _rememberSceneInteractionScroll(button) {
    this._interactionScrollSnapshot = collectDashboardScrollSnapshot(button || this);
    this._sceneInteractionScrollUntil = Date.now() + 1200;
  }

  _blurSceneInteractionFocus() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && this.shadowRoot?.contains(active)) {
      active.blur();
    }
  }

  _syncActiveSceneUi() {
    const root = this.shadowRoot;
    if (!root) {
      return false;
    }

    const config = this._config || {};
    const entries = resolveSceneEntries(config, this._hass);
    const ui = this._scenesUiCopy();
    const showActive = config.show_active !== false;
    const activeEntity = this._getActiveSceneEntity(entries);
    const hasActiveScene = Boolean(activeEntity);
    const isList = config.layout === "list";
    const card = root.querySelector("ha-card.scenes-card");

    if (!card) {
      return false;
    }

    card.classList.toggle("scenes-card--has-active", hasActiveScene);

    const activeNode = root.querySelector(".scenes-card__button--active");
    const cardAccent = activeNode?.style.getPropertyValue("--scene-accent")?.trim()
      || getDefaultSceneAccent(getSafeStyles(config));
    this.style.setProperty("--scenes-accent", cardAccent);

    root.querySelectorAll("[data-scene-entity]").forEach(node => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      const entityId = String(node.dataset.sceneEntity || "");
      const entry = entries.find(item => item.entity === entityId);
      if (!entry) {
        return;
      }

      const isActive = showActive && entityId === activeEntity;
      node.classList.toggle("scenes-card__button--active", isActive);
      node.setAttribute("aria-pressed", isActive ? "true" : "false");
      node.setAttribute(
        "aria-label",
        isActive ? `${entry.label} (${ui.active})` : entry.label,
      );

      node.querySelector(".scenes-card__button-icon")
        ?.classList.toggle("scenes-card__button-icon--active", isActive);

      const wrap = node.querySelector(".scenes-card__button-icon-wrap");
      let dot = node.querySelector(".scenes-card__button-icon-dot");
      if (isActive && wrap && !dot) {
        wrap.insertAdjacentHTML("beforeend", '<span class="scenes-card__button-icon-dot" aria-hidden="true"></span>');
      } else if (!isActive && dot) {
        dot.remove();
      }

      const badge = node.querySelector(".scenes-card__button-active-badge");
      if (badge && showActive) {
        badge.classList.toggle("scenes-card__button-active-badge--hidden", !isActive);
        if (isActive) {
          badge.removeAttribute("aria-hidden");
        } else {
          badge.setAttribute("aria-hidden", "true");
        }
      }
    });

    this._lastRenderSignature = this._getRenderSignature();
    return true;
  }

  _activateScene(entityId) {
    if (!this._hass || !entityId) {
      return;
    }
    this._optimisticActiveEntity = entityId;
    this._triggerHaptic("success");
    this._hass.callService("scene", "turn_on", { entity_id: entityId });
    const scrollSnapshot = this._interactionScrollSnapshot || this._captureDashboardScrollSnapshot();
    if (!this._syncActiveSceneUi()) {
      this._lastRenderSignature = "";
      this._render();
    }
    this._scheduleDashboardScrollRestore(scrollSnapshot);
  }

  _performTapAction(entityId) {
    const action = normalizeTextKey(this._config?.tap_action);
    if (action === "none") {
      return;
    }
    if (action === "more-info") {
      this._triggerHaptic("selection");
      this._openMoreInfo(entityId);
      return;
    }
    this._activateScene(entityId);
  }

  _performHoldAction(entityId) {
    const action = normalizeTextKey(this._config?.hold_action);
    if (action === "none") {
      return;
    }
    const button = this.shadowRoot?.querySelector(`[data-scene-entity="${escapeSelectorValue(entityId)}"]`);
    this._triggerPressAnimation(button);
    if (action === "more-info") {
      this._openMoreInfo(entityId);
      return;
    }
    this._activateScene(entityId);
  }

  _findSceneButtonFromEvent(event) {
    const button = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.sceneEntity);
    if (!button || button.dataset.unavailable === "true" || button.getAttribute("aria-disabled") === "true") {
      return null;
    }
    return button;
  }

  _prepareSceneInteraction(event, button) {
    this._rememberSceneInteractionScroll(button);
    event.preventDefault();
    this._blurSceneInteractionFocus();
  }

  _onShadowPointerDown(event) {
    const button = this._findSceneButtonFromEvent(event);
    if (!button) {
      return;
    }
    if (typeof event.button === "number" && event.button !== 0) {
      return;
    }
    if (event.pointerType === "touch") {
      this._rememberSceneInteractionScroll(button);
      return;
    }
    this._prepareSceneInteraction(event, button);
  }

  _onShadowMouseDown(event) {
    const button = this._findSceneButtonFromEvent(event);
    if (!button || event.button !== 0) {
      return;
    }
    this._prepareSceneInteraction(event, button);
  }

  _onShadowTouchStart(event) {
    const button = this._findSceneButtonFromEvent(event);
    if (!button) {
      return;
    }
    this._rememberSceneInteractionScroll(button);
  }

  _onShadowClick(event) {
    if (this._suppressNextSceneTap) {
      this._suppressNextSceneTap = false;
      return;
    }
    const button = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.sceneEntity);
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const entityId = button.dataset.sceneEntity;
    if (!entityId || button.dataset.unavailable === "true" || button.getAttribute("aria-disabled") === "true") {
      return;
    }
    this._rememberSceneInteractionScroll(button);
    this._blurSceneInteractionFocus();
    this._triggerPressAnimation(button);
    this._performTapAction(entityId);
    this._scheduleDashboardScrollRestore();
  }

  _renderEmptyState() {
    const ui = this._scenesUiCopy();
    const styles = getSafeStyles(this._config?.styles);
    return `
      <style>
        :host { display: block; }
        * { box-sizing: border-box; }
        ha-card {
          background: ${styles.card.background};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          color: var(--primary-text-color);
          display: grid;
          gap: 8px;
          padding: 16px;
        }
        .scenes-card__empty-title { font-size: 15px; font-weight: 700; letter-spacing: -0.02em; }
        .scenes-card__empty-text { color: var(--secondary-text-color); font-size: 13px; line-height: 1.5; }
      </style>
      <ha-card class="scenes-card scenes-card--empty">
        <div class="scenes-card__empty-title">${escapeHtml(ui.emptyTitle)}</div>
        <div class="scenes-card__empty-text">${escapeHtml(ui.emptyBody)}</div>
      </ha-card>
    `;
  }

  _renderSceneButton(entry, activeEntity, styles, ui) {
    const showActive = this._config?.show_active !== false;
    const isActive = showActive && entry.entity === activeEntity;
    const isList = this._config?.layout === "list";
    const iconSize = parseSizeToPixels(styles.icon.size, 44);
    const listIconSize = Math.max(38, iconSize - 4);
    const bubbleSize = isList ? listIconSize : iconSize;
    const activeBadge = showActive
      ? `<span class="scenes-card__button-active-badge ${isList ? "scenes-card__button-active-badge--trail" : ""} ${isActive ? "" : "scenes-card__button-active-badge--hidden"}" ${isActive ? "" : 'aria-hidden="true"'}">${escapeHtml(ui.active)}</span>`
      : "";
    return `
      <div
        role="button"
        tabindex="-1"
        class="scenes-card__button ${isActive ? "scenes-card__button--active" : ""} ${isList ? "scenes-card__button--list" : ""}"
        data-scene-entity="${escapeHtml(entry.entity)}"
        data-unavailable="${entry.unavailable ? "true" : "false"}"
        ${entry.unavailable ? 'aria-disabled="true"' : ""}
        aria-pressed="${isActive ? "true" : "false"}"
        aria-label="${escapeHtml(isActive ? `${entry.label} (${ui.active})` : entry.label)}"
        style="--scene-accent: ${escapeHtml(entry.accent)}; --scene-bubble-size: ${bubbleSize}px;"
      >
        <span class="scenes-card__button-icon-wrap">
          <span class="scenes-card__button-icon ${isActive ? "scenes-card__button-icon--active" : ""}">
            ${
              entry.picture
                ? `<img src="${escapeHtml(entry.picture)}" alt="" loading="lazy" />`
                : `<ha-icon icon="${escapeHtml(entry.icon)}"></ha-icon>`
            }
          </span>
          ${isActive ? `<span class="scenes-card__button-icon-dot" aria-hidden="true"></span>` : ""}
        </span>
        <span class="scenes-card__button-copy">
          <span class="scenes-card__button-label">${escapeHtml(entry.label)}</span>
          ${entry.unavailable ? `<span class="scenes-card__button-state">${escapeHtml(ui.unavailable)}</span>` : ""}
          ${!isList ? activeBadge : ""}
        </span>
        ${isList ? activeBadge : ""}
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || {};
    const entries = resolveSceneEntries(config, this._hass);
    if (!entries.length) {
      this._lastRenderSignature = `empty:${JSON.stringify(config.scenes || [])}`;
      this.shadowRoot.innerHTML = this._renderEmptyState();
      return;
    }

    const ui = this._scenesUiCopy();
    const styles = getSafeStyles(config.styles);
    const animations = this._getAnimationSettings();
    const activeEntity = this._getActiveSceneEntity(entries);
    const showTitle = config.show_title !== false;
    const title = String(config.name || "").trim() || ui.defaultName;
    const isGrid = config.layout !== "list";
    const columns = clamp(Math.round(Number(config.columns) || 3), 1, 6);
    const shouldAnimate = animations.enabled && this._animateContentOnNextRender;
    const activeEntry = entries.find(entry => entry.entity === activeEntity);
    const accentColor = activeEntry?.accent || styles.accent;
    const hasActiveScene = Boolean(activeEntity);
    const chipBorderRadius = escapeHtml(styles.chip_border_radius);
    const configuredBorder = String(styles.card.border || "").trim();
    const defaultBorder = String(DEFAULT_CONFIG.styles.card.border || "").trim();
    const buttonBackground = String(styles.button.background || "").trim()
      || "linear-gradient(135deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), color-mix(in srgb, var(--primary-text-color) 2%, transparent))";
    const buttonBorder = String(styles.button.border || "").trim()
      || "1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent)";
    const buttonHoverBackground = String(styles.button.background || "").trim()
      ? buttonBackground
      : "linear-gradient(135deg, color-mix(in srgb, var(--primary-text-color) 8%, transparent), color-mix(in srgb, var(--primary-text-color) 4%, transparent))";
    const activeButtonBackground = String(styles.active.background || "").trim()
      || "linear-gradient(135deg, color-mix(in srgb, var(--scene-accent) 18%, transparent) 0%, color-mix(in srgb, var(--scene-accent) 8%, transparent) 100%)";
    const activeButtonBorder = String(styles.active.border_color || "").trim()
      || "color-mix(in srgb, var(--scene-accent) 34%, var(--divider-color))";
    const activeButtonGlow = String(styles.active.glow || "").trim()
      || "inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 10%, transparent), 0 14px 30px color-mix(in srgb, var(--scene-accent) 18%, rgba(0, 0, 0, 0.16))";
    const cardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} ${hasActiveScene ? "16" : "10"}%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} ${hasActiveScene ? "8" : "4"}%, ${styles.card.background}) 56%, ${styles.card.background} 100%)`;
    const cardBorder = !configuredBorder || configuredBorder === defaultBorder
      ? `1px solid color-mix(in srgb, ${accentColor} ${hasActiveScene ? "28" : "14"}%, var(--divider-color))`
      : configuredBorder;
    const cardShadow = `${styles.card.box_shadow}, 0 16px 32px color-mix(in srgb, ${accentColor} ${hasActiveScene ? "12" : "6"}%, rgba(0, 0, 0, 0.16))`;
    if (shouldAnimate) {
      this._animateContentOnNextRender = false;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --scenes-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --scenes-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          --scenes-accent: ${accentColor};
          display: block;
          overflow-anchor: none;
        }

        * { box-sizing: border-box; }

        ha-card {
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--scenes-accent) 12%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)), rgba(255, 255, 255, 0) 42%),
            ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          display: grid;
          gap: ${styles.card.gap};
          overflow: hidden;
          overflow-anchor: none;
          padding: ${styles.card.padding};
          position: relative;
          touch-action: manipulation;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        ha-card::before {
          background: linear-gradient(180deg, color-mix(in srgb, var(--scenes-accent) 14%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)), rgba(255, 255, 255, 0));
          border-radius: inherit;
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .scenes-card__header,
        .scenes-card__grid {
          position: relative;
          z-index: 1;
        }

        .scenes-card__header {
          align-items: center;
          display: flex;
          gap: 10px;
          min-width: 0;
        }

        .scenes-card__header--entering {
          animation: scenes-card-fade-up calc(var(--scenes-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .scenes-card__brand {
          align-items: center;
          display: flex;
          gap: 10px;
          min-width: 0;
        }

        .scenes-card__brand-icon {
          align-items: center;
          background: color-mix(in srgb, var(--scenes-accent) 14%, ${styles.icon.background});
          border: 1px solid color-mix(in srgb, var(--scenes-accent) 22%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent),
            0 8px 18px color-mix(in srgb, var(--scenes-accent) 10%, rgba(0, 0, 0, 0.12));
          color: ${styles.icon.on_color};
          display: inline-flex;
          flex: 0 0 auto;
          height: 34px;
          justify-content: center;
          width: 34px;
        }

        .scenes-card__brand-icon ha-icon {
          --mdc-icon-size: 18px;
        }

        .scenes-card__title {
          font-size: ${styles.title_size};
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.15;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scenes-card__count-chip {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color: var(--secondary-text-color);
          display: inline-flex;
          flex: 0 0 auto;
          font-size: 11px;
          font-weight: 700;
          height: 22px;
          margin-inline-start: auto;
          padding: 0 9px;
        }

        .scenes-card__grid {
          display: grid;
          gap: ${styles.button.gap};
          grid-template-columns: ${isGrid ? `repeat(${columns}, minmax(0, 1fr))` : "minmax(0, 1fr)"};
        }

        .scenes-card__grid--entering {
          animation: scenes-card-fade-up calc(var(--scenes-card-content-duration) * 0.95) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 40ms;
        }

        .scenes-card__button {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${buttonBackground};
          border: ${buttonBorder};
          border-radius: ${styles.button.border_radius};
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.08);
          color: var(--primary-text-color);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 8px;
          justify-content: center;
          min-height: ${styles.button.min_height};
          min-width: 0;
          padding: 12px 10px;
          position: relative;
          text-align: center;
          touch-action: manipulation;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
          width: 100%;
        }

        .scenes-card__button--list {
          align-items: center;
          flex-direction: row;
          gap: 12px;
          justify-content: flex-start;
          min-height: 58px;
          padding: 10px 14px;
          text-align: left;
        }

        .scenes-card__button:hover:not([aria-disabled="true"]) {
          background: ${buttonHoverBackground};
          border-color: color-mix(in srgb, var(--primary-text-color) 12%, transparent);
        }

        .scenes-card__button--active {
          background: ${activeButtonBackground};
          border-color: ${activeButtonBorder};
          box-shadow: ${activeButtonGlow};
        }

        .scenes-card--has-active .scenes-card__button:not(.scenes-card__button--active):not([aria-disabled="true"]) {
          filter: saturate(0.9);
          opacity: 0.78;
        }

        .scenes-card--has-active .scenes-card__button:not(.scenes-card__button--active):not([aria-disabled="true"]):hover {
          filter: none;
          opacity: 1;
        }

        .scenes-card__button--active .scenes-card__button-label {
          color: var(--scene-accent);
        }

        .scenes-card__button-icon-wrap {
          display: inline-flex;
          flex: 0 0 auto;
          position: relative;
        }

        .scenes-card__button-icon-dot {
          background: var(--scene-accent);
          border: 2px solid color-mix(in srgb, var(--scene-accent) 18%, var(--ha-card-background, var(--card-background-color, #fff)));
          border-radius: 999px;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--scene-accent) 24%, transparent);
          height: 11px;
          position: absolute;
          right: -1px;
          top: -1px;
          width: 11px;
        }

        .scenes-card__button-active-badge {
          background: color-mix(in srgb, var(--scene-accent) 14%, transparent);
          border: 1px solid color-mix(in srgb, var(--scene-accent) 28%, transparent);
          border-radius: 999px;
          color: var(--scene-accent);
          display: inline-flex;
          font-size: 9px;
          font-weight: 800;
          justify-content: center;
          letter-spacing: 0.06em;
          line-height: 1;
          padding: 4px 8px;
          text-transform: uppercase;
          width: fit-content;
        }

        .scenes-card__button-active-badge--trail {
          flex: 0 0 auto;
          margin-left: auto;
        }

        .scenes-card__button-active-badge--hidden {
          opacity: 0;
          pointer-events: none;
          user-select: none;
        }

        .scenes-card__button.is-pressing {
          animation: scenes-card-button-bounce var(--scenes-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .scenes-card__button[aria-disabled="true"] {
          cursor: default;
          opacity: 0.55;
          pointer-events: none;
        }

        .scenes-card__button-icon {
          align-items: center;
          background: color-mix(in srgb, var(--scene-accent) 14%, ${styles.icon.background});
          border: 1px solid color-mix(in srgb, var(--scene-accent) 18%, color-mix(in srgb, var(--primary-text-color) 10%, transparent));
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent),
            0 8px 18px color-mix(in srgb, var(--scene-accent) 10%, rgba(0, 0, 0, 0.1));
          color: color-mix(in srgb, var(--scene-accent) 68%, ${styles.icon.color});
          display: inline-flex;
          flex: 0 0 auto;
          height: var(--scene-bubble-size);
          justify-content: center;
          overflow: hidden;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease;
          width: var(--scene-bubble-size);
        }

        .scenes-card__button-icon--active {
          background: color-mix(in srgb, var(--scene-accent) 24%, ${styles.icon.background});
          border-color: color-mix(in srgb, var(--scene-accent) 36%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 10%, transparent),
            0 10px 22px color-mix(in srgb, var(--scene-accent) 22%, rgba(0, 0, 0, 0.14));
          color: var(--scene-accent);
        }

        .scenes-card__button-icon ha-icon {
          --mdc-icon-size: ${styles.button.icon_size};
        }

        .scenes-card__button-icon img {
          border-radius: inherit;
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .scenes-card__button-copy {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .scenes-card__button--list .scenes-card__button-copy {
          flex: 1 1 auto;
        }

        .scenes-card__button-label {
          font-size: ${styles.button.label_size};
          font-weight: 700;
          letter-spacing: -0.01em;
          line-height: 1.25;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scenes-card__button--list .scenes-card__button-label {
          white-space: normal;
        }

        .scenes-card__button-state {
          color: var(--secondary-text-color);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        @keyframes scenes-card-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes scenes-card-button-bounce {
          0% { transform: scale(1); }
          40% { transform: scale(0.96); }
          100% { transform: scale(1); }
        }
      </style>
      <ha-card class="scenes-card ${hasActiveScene ? "scenes-card--has-active" : ""}">
        ${
          showTitle
            ? `<div class="scenes-card__header ${shouldAnimate ? "scenes-card__header--entering" : ""}">
                <div class="scenes-card__brand">
                  <span class="scenes-card__brand-icon" aria-hidden="true">
                    <ha-icon icon="mdi:palette-outline"></ha-icon>
                  </span>
                  <div class="scenes-card__title">${escapeHtml(title)}</div>
                </div>
                <span class="scenes-card__count-chip">${entries.length}</span>
              </div>`
            : ""
        }
        <div class="scenes-card__grid ${shouldAnimate ? "scenes-card__grid--entering" : ""}">
          ${entries.map(entry => this._renderSceneButton(entry, activeEntity, styles, ui)).join("")}
        </div>
      </ha-card>
    `;

    if (Date.now() < (this._sceneInteractionScrollUntil || 0)) {
      this._scheduleDashboardScrollRestore(this._interactionScrollSnapshot);
    }

    this.style.setProperty("--scenes-accent", accentColor);
  }
}

class NodaliaScenesCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG, { keepEmpty: true });
    this._hass = null;
    this._entityOptionsSignature = "";
    this._pendingEditorControlTags = new Set();
    this._showStyleSection = false;
    this._showActionsSection = false;
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
      this._syncMountedPickerHass();
      return;
    }

    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {}, { keepEmpty: true });
    this._render();
    this._restoreFocusState(focusState);
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils?.editorFilteredStatesSignature?.(
      hass,
      this._config?.language,
      id => id.startsWith("scene."),
    ) ?? "";
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

  _syncMountedPickerHass() {
    if (!this._hass || !this.shadowRoot) {
      return;
    }

    this.shadowRoot.querySelectorAll("ha-entity-picker[data-field], ha-icon-picker[data-field]").forEach(control => {
      if ("hass" in control) {
        control.hass = this._hass;
      }
    });
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

  _editorLabel(s) {
    if (typeof s !== "string" || !window.NodaliaI18n?.editorStr) {
      return s;
    }
    const hass = this._hass ?? this.hass;
    return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", s);
  }

  _emitConfig() {
    const focusState = this._captureFocusState();
    const nextConfig = deepClone(this._config);
    this._config = normalizeConfig(nextConfig, { keepEmpty: true });
    this._render();
    this._restoreFocusState(focusState);
    const base = window.NodaliaUtils?.stripEqualToDefaults?.(nextConfig, DEFAULT_CONFIG) ?? nextConfig;
    const exportConfig = {
      ...base,
      scenes: normalizeSceneRows(nextConfig.scenes, { keepEmpty: false }),
    };
    fireEvent(this, "config-changed", {
      config: compactConfig(exportConfig),
    });
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
    if (valueType === "boolean") {
      return Boolean(input.checked);
    }
    if (valueType === "number") {
      const numeric = Number(input.value);
      return Number.isFinite(numeric) ? numeric : input.value;
    }
    if (valueType === "color") {
      return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
    }
    return input.value;
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement);
    if (!input?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    this._setFieldValue(input.dataset.field, this._readFieldValue(input));
    this._config = normalizeConfig(this._config, { keepEmpty: true });
    if (event.type === "change") {
      this._emitConfig();
    }
  }

  _onShadowValueChanged(event) {
    const control = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.field);
    if (!control?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    const field = control.dataset.field;
    const nextValue = typeof event.detail?.value === "string" ? event.detail.value : control.value;
    const previousValue = getByPath(this._config, field);
    if (String(nextValue ?? "") === String(previousValue ?? "")) {
      return;
    }
    if (typeof control.dataset?.value === "string") {
      control.dataset.value = String(nextValue || "");
    }
    this._setFieldValue(field, nextValue);
    this._config = normalizeConfig(this._config, { keepEmpty: true });
    this._emitConfig();
  }

  _onShadowClick(event) {
    const toggleButton = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.editorToggle);
    if (toggleButton) {
      event.preventDefault();
      event.stopPropagation();
      const focusState = this._captureFocusState();
      if (toggleButton.dataset.editorToggle === "styles") {
        this._showStyleSection = !this._showStyleSection;
      } else if (toggleButton.dataset.editorToggle === "actions") {
        this._showActionsSection = !this._showActionsSection;
      }
      this._render();
      this._restoreFocusState(focusState);
      return;
    }

    const button = event.composedPath().find(node => node instanceof HTMLButtonElement && node.dataset?.action);
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.action;
    const index = Number(button.dataset.index);
    this._config.scenes = Array.isArray(this._config.scenes) ? this._config.scenes : [];

    if (action === "add-scene") {
      this._config.scenes.push({ entity: "", name: "", icon: "", color: "" });
      this._emitConfig();
      return;
    }

    if (!Number.isInteger(index) || index < 0 || index >= this._config.scenes.length) {
      return;
    }

    if (action === "remove-scene") {
      this._config.scenes.splice(index, 1);
      this._emitConfig();
      return;
    }

    if (action === "move-scene-up") {
      moveItem(this._config.scenes, index, index - 1);
      this._emitConfig();
      return;
    }

    if (action === "move-scene-down") {
      moveItem(this._config.scenes, index, index + 1);
      this._emitConfig();
    }
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          type="${escapeHtml(options.type || "text")}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(options.valueType || "string")}"
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
        <input type="checkbox" data-field="${escapeHtml(field)}" data-value-type="boolean" ${checked ? "checked" : ""} />
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

  _renderColorField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const tColorCustom = this._editorLabel("ed.person.custom_color");
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

  _renderEntityPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="scene-entity"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
          data-placeholder="${escapeHtml(options.placeholder || "")}"
        ></div>
      </label>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    return `
      <div class="editor-field editor-field--full">
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

  _mountSceneEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.includeDomains = ["scene"];
      control.allowCustomEntity = true;
      control.entityFilter = stateObj => String(stateObj?.entity_id || "").startsWith("scene.");
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: {
          domain: "scene",
        },
      };
    } else {
      control = document.createElement("input");
      control.type = "text";
      if (placeholder) {
        control.placeholder = placeholder;
      }
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
    } else {
      control.addEventListener("change", this._onShadowInput);
    }

    host.replaceChildren(control);
  }

  _renderSceneEditorCard(item, index, total) {
    return `
      <div class="scene-editor-card">
        <div class="scene-editor-card__header">
          <div class="scene-editor-card__title">${escapeHtml(this._editorLabel("ed.scenes.scenes_section_title"))} ${index + 1}</div>
          <div class="scene-editor-card__actions">
            <button type="button" data-action="move-scene-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" data-action="move-scene-down" data-index="${index}" ${index >= total - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="danger" data-action="remove-scene" data-index="${index}">${escapeHtml(this._editorLabel("ed.scenes.remove_scene"))}</button>
          </div>
        </div>
        ${this._renderEntityPickerField("ed.scenes.scene_entity", `scenes.${index}.entity`, item.entity, { placeholder: "scene.living_room_relax" })}
        ${this._renderTextField("ed.scenes.scene_name", `scenes.${index}.name`, item.name, { fullWidth: true, placeholder: this._editorLabel("ed.scenes.scene_name") })}
        ${this._renderIconPickerField("ed.scenes.scene_icon", `scenes.${index}.icon`, item.icon, { placeholder: "mdi:palette-outline" })}
        ${this._renderColorField("ed.scenes.scene_color", `scenes.${index}.color`, item.color, { fullWidth: true })}
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || {};
    const scenes = Array.isArray(config.scenes) ? config.scenes : [];

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        * { box-sizing: border-box; }
        .editor { display: grid; gap: 16px; }
        .editor-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 18px;
          display: grid;
          gap: 12px;
          padding: 14px;
        }
        .editor-section__title { font-size: 14px; font-weight: 700; }
        .editor-section__hint { color: var(--secondary-text-color); font-size: 12px; line-height: 1.45; }
        .editor-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .editor-grid--stacked { grid-template-columns: 1fr; }
        .editor-field { display: grid; gap: 6px; min-width: 0; }
        .editor-field--full { grid-column: 1 / -1; }
        .editor-field span, .editor-toggle span { color: var(--secondary-text-color); font-size: 12px; font-weight: 600; }
        .editor-field input, .editor-field select {
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
          padding: 0;
          position: absolute;
        }
        .editor-color-picker:hover,
        .editor-color-picker:focus-within {
          border-color: color-mix(in srgb, var(--primary-text-color) 22%, transparent);
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
        .editor-styles-subgroup {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border-radius: 14px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }
        .editor-styles-subgroup__title {
          font-size: 12px;
          font-weight: 700;
        }
        .editor-styles-subgroup__hint {
          color: var(--secondary-text-color);
          font-size: 11px;
          line-height: 1.45;
          margin-top: -4px;
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
          margin: 0;
          min-height: auto;
          padding: 0;
          width: auto;
        }
        .editor-toggle {
          align-items: center;
          cursor: pointer;
          display: grid;
          gap: 10px;
          grid-template-columns: auto 1fr;
          min-height: 40px;
        }
        .editor-toggle input { opacity: 0; position: absolute; width: 1px; height: 1px; }
        .editor-toggle__switch {
          background: color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          border-radius: 999px;
          height: 22px;
          position: relative;
          width: 38px;
        }
        .editor-toggle__switch::after {
          background: #fff;
          border-radius: 999px;
          content: "";
          height: 18px;
          left: 2px;
          position: absolute;
          top: 2px;
          transition: transform 160ms ease;
          width: 18px;
        }
        .editor-toggle input:checked + .editor-toggle__switch {
          background: var(--primary-color);
        }
        .editor-toggle input:checked + .editor-toggle__switch::after {
          transform: translateX(16px);
        }
        .editor-section__actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .editor-section__toggle-button, button {
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
        button.danger { color: var(--error-color); }
        button:disabled { cursor: default; opacity: 0.45; }
        .scene-editor-list { display: grid; gap: 12px; }
        .scene-editor-card {
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 16px;
          display: grid;
          gap: 12px;
          padding: 14px;
        }
        .scene-editor-card__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }
        .scene-editor-card__title { font-size: 13px; font-weight: 700; }
        .scene-editor-card__actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
        .empty-note { color: var(--secondary-text-color); font-size: 12px; line-height: 1.5; }
        @media (max-width: 640px) { .editor-grid { grid-template-columns: 1fr; } }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.general_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.scenes.general_section_hint"))}</div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderTextField("ed.weather.card_name", "name", config.name, {
              fullWidth: true,
              placeholder: this._editorLabel("ed.scenes.name_placeholder"),
            })}
            ${this._renderCheckboxField("ed.scenes.show_title", "show_title", config.show_title !== false)}
            ${this._renderSelectField(
              "ed.scenes.layout",
              "layout",
              config.layout,
              [
                { value: "grid", label: "ed.scenes.layout_grid" },
                { value: "list", label: "ed.scenes.layout_list" },
              ],
              { fullWidth: true },
            )}
            ${this._renderTextField("ed.scenes.columns", "columns", config.columns, { type: "number", valueType: "number" })}
            ${this._renderCheckboxField("ed.scenes.show_active", "show_active", config.show_active !== false)}
            ${this._renderCheckboxField("ed.scenes.use_entity_icon", "use_entity_icon", config.use_entity_icon !== false)}
            ${this._renderCheckboxField("ed.scenes.show_entity_picture", "use_entity_picture", config.use_entity_picture === true)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.scenes.scenes_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.scenes.scenes_section_hint"))}</div>
          <div class="scene-editor-list">
            ${
              scenes.length
                ? scenes.map((item, index) => this._renderSceneEditorCard(item, index, scenes.length)).join("")
                : `<div class="empty-note">${escapeHtml(this._editorLabel("ed.scenes.scenes_empty"))}</div>`
            }
          </div>
          <div class="editor-actions">
            <button type="button" data-action="add-scene">${escapeHtml(this._editorLabel("ed.scenes.add_scene"))}</button>
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.scenes.tap_action"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.scenes.actions_section_hint"))}</div>
            <div class="editor-section__actions">
              <button type="button" class="editor-section__toggle-button" data-editor-toggle="actions" aria-expanded="${this._showActionsSection ? "true" : "false"}">
                ${escapeHtml(this._showActionsSection ? this._editorLabel("ed.weather.hide_style_settings") : this._editorLabel("ed.weather.show_style_settings"))}
              </button>
            </div>
          </div>
          ${
            this._showActionsSection
              ? `
            <div class="editor-grid editor-grid--stacked">
              ${this._renderSelectField(
                "ed.scenes.tap_action",
                "tap_action",
                config.tap_action,
                [
                  { value: "activate", label: "ed.scenes.tap_activate" },
                  { value: "more-info", label: "ed.scenes.tap_more_info" },
                  { value: "none", label: "ed.scenes.hold_none" },
                ],
                { fullWidth: true },
              )}
              ${this._renderSelectField(
                "ed.scenes.hold_action",
                "hold_action",
                config.hold_action,
                [
                  { value: "more-info", label: "ed.scenes.hold_more_info" },
                  { value: "activate", label: "ed.scenes.hold_activate" },
                  { value: "none", label: "ed.scenes.hold_none" },
                ],
                { fullWidth: true },
              )}
            </div>
          `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.person.haptics_section_title"))}</div>
          <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.person.haptics_section_hint"))}</div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderCheckboxField("ed.person.enable_haptics", "haptics.enabled", config.haptics?.enabled !== false)}
            ${this._renderCheckboxField("ed.person.fallback_vibrate", "haptics.fallback_vibrate", config.haptics?.fallback_vibrate === true)}
            ${this._renderSelectField(
              "ed.person.haptic_style",
              "haptics.style",
              config.haptics?.style || "medium",
              [
                { value: "selection", label: "ed.person.haptic_selection" },
                { value: "light", label: "ed.person.haptic_light" },
                { value: "medium", label: "ed.person.haptic_medium" },
                { value: "heavy", label: "ed.person.haptic_heavy" },
                { value: "success", label: "ed.person.haptic_success" },
                { value: "warning", label: "ed.person.haptic_warning" },
                { value: "failure", label: "ed.person.haptic_failure" },
              ],
              { fullWidth: true },
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.weather.styles_section_hint"))}</div>
            <div class="editor-section__actions">
              <button type="button" class="editor-section__toggle-button" data-editor-toggle="styles" aria-expanded="${this._showStyleSection ? "true" : "false"}">
                ${escapeHtml(this._showStyleSection ? this._editorLabel("ed.weather.hide_style_settings") : this._editorLabel("ed.weather.show_style_settings"))}
              </button>
            </div>
          </div>
          ${
            this._showStyleSection
              ? `
            <div class="editor-grid editor-grid--stacked">
              ${this._renderColorField("ed.scenes.styles_accent", "styles.accent", config.styles?.accent || DEFAULT_CONFIG.styles.accent, { fullWidth: true })}
              <div class="editor-styles-subgroup editor-field--full">
                <div class="editor-styles-subgroup__title">${escapeHtml(this._editorLabel("ed.scenes.styles_card_section"))}</div>
                <div class="editor-styles-subgroup__hint">${escapeHtml(this._editorLabel("ed.scenes.styles_card_hint"))}</div>
                ${this._renderColorField("ed.entity.style_card_bg", "styles.card.background", config.styles?.card?.background, { fullWidth: true })}
                ${this._renderTextField("ed.entity.style_card_border", "styles.card.border", config.styles?.card?.border, { fullWidth: true })}
                ${this._renderTextField("ed.entity.style_card_shadow", "styles.card.box_shadow", config.styles?.card?.box_shadow, { fullWidth: true })}
                ${this._renderTextField("ed.person.style_card_padding", "styles.card.padding", config.styles?.card?.padding || DEFAULT_CONFIG.styles.card.padding)}
                ${this._renderTextField("ed.person.style_card_gap", "styles.card.gap", config.styles?.card?.gap || DEFAULT_CONFIG.styles.card.gap)}
                ${window.NodaliaUtils.renderEditorCardBorderRadiusHtml({
                  escapeHtml,
                  field: "styles.card.border_radius",
                  value: config.styles?.card?.border_radius || DEFAULT_CONFIG.styles.card.border_radius,
                  tHeading: this._editorLabel("ed.entity.style_card_radius_presets"),
                  labels: {
                    pill: this._editorLabel("ed.entity.chip_radius_pill"),
                    soft: this._editorLabel("ed.entity.chip_radius_soft"),
                    round: this._editorLabel("ed.entity.chip_radius_round"),
                    square: this._editorLabel("ed.entity.chip_radius_square"),
                  },
                })}
              </div>

              <div class="editor-styles-subgroup editor-field--full">
                <div class="editor-styles-subgroup__title">${escapeHtml(this._editorLabel("ed.scenes.styles_icon_section"))}</div>
                <div class="editor-styles-subgroup__hint">${escapeHtml(this._editorLabel("ed.scenes.styles_icon_hint"))}</div>
                ${this._renderTextField("ed.person.style_title_size", "styles.icon.size", config.styles?.icon?.size || DEFAULT_CONFIG.styles.icon.size)}
                ${this._renderColorField("ed.entity.style_main_bubble_bg", "styles.icon.background", config.styles?.icon?.background, { fullWidth: true })}
                ${this._renderColorField("ed.person.style_avatar_color", "styles.icon.color", config.styles?.icon?.color, { fullWidth: true })}
                ${this._renderColorField("ed.entity.style_icon_on", "styles.icon.on_color", config.styles?.icon?.on_color, { fullWidth: true })}
              </div>

              <div class="editor-styles-subgroup editor-field--full">
                <div class="editor-styles-subgroup__title">${escapeHtml(this._editorLabel("ed.scenes.styles_buttons_section"))}</div>
                <div class="editor-styles-subgroup__hint">${escapeHtml(this._editorLabel("ed.scenes.styles_buttons_hint"))}</div>
                ${this._renderColorField("ed.scenes.style_button_bg", "styles.button.background", config.styles?.button?.background, { fullWidth: true })}
                ${this._renderTextField("ed.scenes.style_button_border", "styles.button.border", config.styles?.button?.border, { fullWidth: true })}
                ${this._renderTextField("ed.scenes.style_button_min_height", "styles.button.min_height", config.styles?.button?.min_height || DEFAULT_CONFIG.styles.button.min_height)}
                ${this._renderTextField("ed.entity.style_main_button_size", "styles.button.icon_size", config.styles?.button?.icon_size || DEFAULT_CONFIG.styles.button.icon_size)}
                ${this._renderTextField("ed.circular_gauge.value_size", "styles.button.label_size", config.styles?.button?.label_size || DEFAULT_CONFIG.styles.button.label_size)}
                ${this._renderTextField("ed.person.style_title_size", "styles.title_size", config.styles?.title_size || DEFAULT_CONFIG.styles.title_size)}
                ${window.NodaliaUtils.renderEditorChipBorderRadiusHtml({
                  escapeHtml,
                  field: "styles.button.border_radius",
                  value: config.styles?.button?.border_radius || DEFAULT_CONFIG.styles.button.border_radius,
                  tHeading: this._editorLabel("ed.entity.style_chip_radius"),
                  labels: {
                    pill: this._editorLabel("ed.entity.chip_radius_pill"),
                    soft: this._editorLabel("ed.entity.chip_radius_soft"),
                    round: this._editorLabel("ed.entity.chip_radius_round"),
                    square: this._editorLabel("ed.entity.chip_radius_square"),
                  },
                })}
              </div>

              <div class="editor-styles-subgroup editor-field--full">
                <div class="editor-styles-subgroup__title">${escapeHtml(this._editorLabel("ed.scenes.styles_active_section"))}</div>
                <div class="editor-styles-subgroup__hint">${escapeHtml(this._editorLabel("ed.scenes.styles_active_hint"))}</div>
                ${this._renderColorField("ed.scenes.style_active_border", "styles.active.border_color", config.styles?.active?.border_color, { fullWidth: true })}
                ${this._renderTextField("ed.scenes.style_active_bg", "styles.active.background", config.styles?.active?.background, { fullWidth: true })}
                ${this._renderTextField("ed.scenes.style_active_glow", "styles.active.glow", config.styles?.active?.glow, { fullWidth: true })}
              </div>
            </div>
          `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot.querySelectorAll('[data-mounted-control="scene-entity"]').forEach(host => this._mountSceneEntityPicker(host));
    this.shadowRoot.querySelectorAll("ha-icon-picker[data-field]").forEach(control => {
      control.hass = this._hass;
      control.value = control.dataset.value || "";
      control.addEventListener("value-changed", this._onShadowValueChanged);
    });
    this._ensureEditorControlsReady();
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaScenesCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaScenesCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Scenes Card",
  description: "Tarjeta de escenas de Home Assistant con rejilla o lista de botones",
  preview: true,
  documentationURL: "https://github.com/danielmigueltejedor/nodalia-cards",
});
