const CARD_TAG = "nodalia-menu-card";
const EDITOR_TAG = "nodalia-menu-card-editor";
const CARD_VERSION = "2.0.0-alpha.3";

const MENU_VARIANTS = ["segmented", "pill", "dock", "glass", "compact", "icon_only"];
const MENU_MODES = ["navigate", "helper", "action"];
const ACTIVE_SOURCES = ["url", "helper", "manual"];
const MENU_VARIANT_SET = new Set(MENU_VARIANTS);
const MENU_MODE_SET = new Set(MENU_MODES);
const ACTIVE_SOURCE_SET = new Set(ACTIVE_SOURCES);
const CARD_TAP_ACTIONS = new Set(["auto", "toggle", "more-info", "service", "navigate", "url", "none"]);

const DEFAULT_ITEM = {
  id: "",
  name: "",
  icon: "mdi:circle-small",
  navigation_path: "",
  value: "",
  badge: "",
  badge_entity: "",
  badge_color: "",
  tap_action: {},
};

const DEFAULT_CONFIG = {
  variant: "segmented",
  mode: "navigate",
  active_source: "url",
  active: "",
  target: "",
  language: "auto",
  show_labels: true,
  show_icons: true,
  show_badges: true,
  show_zero_badge: false,
  scroll: true,
  haptics: { enabled: true, style: "medium", fallback_vibrate: false },
  items: [],
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "28px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "10px 12px",
    },
    item: {
      background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      color: "var(--primary-text-color)",
      active_background: "color-mix(in srgb, var(--primary-color) 16%, transparent)",
      active_color: "var(--primary-text-color)",
      border: "1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent)",
      active_border: "color-mix(in srgb, var(--primary-color) 24%, transparent)",
    },
    accent: "var(--primary-color)",
  },
};

const STUB_CONFIG = {
  variant: "segmented",
  mode: "navigate",
  active_source: "url",
  show_labels: true,
  show_icons: true,
  show_badges: true,
  scroll: true,
  items: [
    { id: "home", name: "Home", icon: "mdi:home-outline", navigation_path: "/lovelace/home", value: "Home" },
    { id: "lights", name: "Lights", icon: "mdi:lightbulb-outline", navigation_path: "/lovelace/lights", value: "Lights", badge: "2" },
    { id: "climate", name: "Climate", icon: "mdi:thermometer", navigation_path: "/lovelace/climate", value: "Climate" },
  ],
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
  if (value === undefined) {
    return undefined;
  }
  if (window.NodaliaUtils?.deepClone) {
    return window.NodaliaUtils.deepClone(value);
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
    const nextValue = override ? override[key] : undefined;
    if (nextValue === undefined) {
      result[key] = deepClone(baseValue);
      return;
    }
    if (Array.isArray(baseValue)) {
      result[key] = Array.isArray(nextValue) ? deepClone(nextValue) : deepClone(baseValue);
      return;
    }
    if (isObject(baseValue) && isObject(nextValue)) {
      result[key] = mergeConfig(baseValue, nextValue);
      return;
    }
    result[key] = deepClone(nextValue);
  });
  return result;
}

function compactConfig(value) {
  if (window.NodaliaUtils?.compactConfig) {
    return window.NodaliaUtils.compactConfig(value);
  }
  if (Array.isArray(value)) {
    return value
      .map(item => compactConfig(item))
      .filter(item => item !== undefined);
  }
  if (isObject(value)) {
    const compacted = {};
    Object.entries(value).forEach(([key, item]) => {
      const cleaned = compactConfig(item);
      const emptyObject = isObject(cleaned) && Object.keys(cleaned).length === 0;
      if (cleaned !== undefined && !emptyObject) {
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

function normalizeTextKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeId(value, fallback = "") {
  const base = String(value ?? fallback ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || String(fallback || "").trim();
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

function isUnsafeConfigPathKey(key) {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

function setByPath(target, path, value) {
  const parts = String(path || "").split(".");
  if (!parts.length || parts.some(isUnsafeConfigPathKey)) {
    return;
  }
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
  const parts = String(path || "").split(".");
  if (!parts.length || parts.some(isUnsafeConfigPathKey)) {
    return;
  }
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

function moveItem(items, fromIndex, toIndex) {
  if (!Array.isArray(items) || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return;
  }
  const [row] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, row);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeCardActionToken(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

function coerceCardTapAction(rawValue, fallback = "none") {
  if (window.NodaliaUtils?.coerceCardTapAction) {
    return window.NodaliaUtils.coerceCardTapAction(rawValue, fallback);
  }
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback;
  }
  if (typeof rawValue === "string") {
    const key = normalizeCardActionToken(rawValue);
    return CARD_TAP_ACTIONS.has(key) ? key : fallback;
  }
  if (!isObject(rawValue)) {
    return fallback;
  }
  let action = normalizeCardActionToken(rawValue.action || rawValue.perform_action || "");
  if (action === "perform-action" || action === "call-service") {
    const service = String(rawValue.perform_action || rawValue.service || "").trim().toLowerCase();
    if (service === "homeassistant.toggle" || service.endsWith(".toggle")) {
      return "toggle";
    }
    if (service) {
      return "service";
    }
  }
  if (action.includes(".")) {
    if (action === "homeassistant.toggle" || action.endsWith(".toggle")) {
      return "toggle";
    }
    return "service";
  }
  if (action === "open-url") {
    action = "url";
  }
  if (action === "more-info-dialog") {
    action = "more-info";
  }
  return CARD_TAP_ACTIONS.has(action) ? action : fallback;
}

function applyCardTapActionField(config, keys, rawValue, fallback) {
  if (typeof window.NodaliaUtils?.applyCardTapActionField === "function") {
    window.NodaliaUtils.applyCardTapActionField(config, keys, rawValue, fallback);
    return;
  }
  const actionKey = keys.actionKey || "tap_action";
  const serviceKey = keys.serviceKey || "tap_service";
  const serviceDataKey = keys.serviceDataKey || "tap_service_data";
  const serviceTargetKey = keys.serviceTargetKey || "tap_service_target";
  const urlKey = keys.urlKey || "tap_url";
  const navigationKey = keys.navigationKey || "navigation_path";
  const newTabKey = keys.newTabKey || "tap_new_tab";
  config[actionKey] = coerceCardTapAction(rawValue, fallback);
  if (!isObject(rawValue)) {
    return;
  }
  const navigationPath = String(rawValue.navigation_path || rawValue.path || "").trim();
  const urlPath = String(rawValue.url_path || rawValue.url || "").trim();
  const service = String(rawValue.perform_action || rawValue.service || "").trim();
  if (navigationPath && !String(config[navigationKey] || "").trim()) {
    config[navigationKey] = navigationPath;
  }
  if (urlPath && !String(config[urlKey] || "").trim()) {
    config[urlKey] = urlPath;
  }
  if (service && !String(config[serviceKey] || "").trim()) {
    config[serviceKey] = service;
  }
  if (rawValue.data !== undefined && !String(config[serviceDataKey] || "").trim()) {
    config[serviceDataKey] = typeof rawValue.data === "string" ? rawValue.data : JSON.stringify(rawValue.data);
  }
  if (rawValue.target !== undefined && !String(config[serviceTargetKey] || "").trim()) {
    config[serviceTargetKey] = typeof rawValue.target === "string" ? rawValue.target : JSON.stringify(rawValue.target);
  }
  if (rawValue.new_tab !== undefined) {
    config[newTabKey] = rawValue.new_tab === true;
  }
}

function stripEqualToDefaults(config, defaults = DEFAULT_CONFIG) {
  const result = deepClone(config || {});
  const walk = (current, base) => {
    if (!isObject(current) || !isObject(base)) {
      return;
    }
    Object.keys(current).forEach(key => {
      if (isObject(current[key]) && isObject(base[key]) && !Array.isArray(current[key])) {
        walk(current[key], base[key]);
        if (!Object.keys(current[key]).length) {
          delete current[key];
        }
        return;
      }
      if (JSON.stringify(current[key]) === JSON.stringify(base[key])) {
        delete current[key];
      }
    });
  };
  walk(result, defaults);
  return result;
}

function getCurrentPath() {
  if (typeof window === "undefined" || !window.location) {
    return "/";
  }
  const pathname = String(window.location.pathname || "/");
  const search = String(window.location.search || "");
  const hash = String(window.location.hash || "");
  return `${pathname}${search}${hash}` || "/";
}

function normalizedPathForCompare(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const withOrigin = /^(https?:)?\/\//i.test(raw) ? raw : `${window.location.origin}${raw.startsWith("/") ? raw : `/${raw}`}`;
  try {
    const parsed = new URL(withOrigin, window.location.origin);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return path.replace(/\/+$/, "") || "/";
  } catch (_error) {
    return raw.replace(/\/+$/, "") || "/";
  }
}

function parseTapActionValue(value) {
  if (isObject(value)) {
    return deepClone(value);
  }
  if (typeof value !== "string") {
    return {};
  }
  const raw = value.trim();
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return isObject(parsed) ? parsed : { action: raw };
  } catch (_error) {
    return { action: raw };
  }
}

function parseMaybeJsonObject(rawValue) {
  if (isObject(rawValue)) {
    return rawValue;
  }
  const raw = String(rawValue ?? "").trim();
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return isObject(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function normalizeMenuItems(rawItems) {
  if (!Array.isArray(rawItems)) {
    return [];
  }
  const seenIds = new Set();
  return rawItems
    .map((rawItem, index) => {
      const item = isObject(rawItem) ? rawItem : {};
      const name = String(item.name ?? "").trim();
      const inferredId = String(item.id ?? "").trim() || normalizeId(name, `item_${index + 1}`) || `item_${index + 1}`;
      let id = inferredId;
      let duplicateCount = 2;
      while (seenIds.has(id)) {
        id = `${inferredId}_${duplicateCount}`;
        duplicateCount += 1;
      }
      seenIds.add(id);
      return {
        id,
        name,
        icon: String(item.icon ?? DEFAULT_ITEM.icon).trim() || DEFAULT_ITEM.icon,
        navigation_path: String(item.navigation_path ?? "").trim(),
        value: String(item.value ?? "").trim(),
        badge: item.badge === null || item.badge === undefined ? "" : String(item.badge).trim(),
        badge_entity: String(item.badge_entity ?? "").trim(),
        badge_color: String(item.badge_color ?? "").trim(),
        tap_action: parseTapActionValue(item.tap_action),
      };
    })
    .filter(item => item.id || item.name || item.navigation_path);
}

function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const variant = normalizeTextKey(config.variant);
  config.variant = MENU_VARIANT_SET.has(variant) ? variant : DEFAULT_CONFIG.variant;
  const mode = normalizeTextKey(config.mode);
  config.mode = MENU_MODE_SET.has(mode) ? mode : DEFAULT_CONFIG.mode;
  const activeSource = normalizeTextKey(config.active_source);
  config.active_source = ACTIVE_SOURCE_SET.has(activeSource) ? activeSource : DEFAULT_CONFIG.active_source;
  config.active = String(config.active ?? "").trim();
  config.target = String(config.target ?? "").trim();
  config.show_labels = config.show_labels !== false;
  config.show_icons = config.show_icons !== false;
  config.show_badges = config.show_badges !== false;
  config.show_zero_badge = config.show_zero_badge === true;
  config.scroll = config.scroll !== false;
  config.items = normalizeMenuItems(config.items);
  config.language = String(config.language ?? "auto").trim() || "auto";
  config.styles = mergeConfig(DEFAULT_CONFIG.styles, config.styles || {});
  return config;
}

function resolveItemBadge(item, hass, config = DEFAULT_CONFIG) {
  const sourceEntity = String(item?.badge_entity ?? "").trim();
  const showZero = config?.show_zero_badge === true;
  const staticBadge = item?.badge === null || item?.badge === undefined ? "" : String(item.badge).trim();
  let value = staticBadge;
  if (sourceEntity) {
    const state = hass?.states?.[sourceEntity];
    const stateValue = String(state?.state ?? "").trim();
    if (stateValue && stateValue !== "unknown" && stateValue !== "unavailable") {
      value = stateValue;
    } else {
      value = "";
    }
  }
  if (!value) {
    return null;
  }
  const numeric = Number(value);
  if (!showZero && Number.isFinite(numeric) && numeric === 0) {
    return null;
  }
  return {
    value,
    color: String(item?.badge_color ?? "").trim(),
    source: sourceEntity || null,
  };
}

function resolveActiveItemId(config, hass, currentPath = getCurrentPath()) {
  const items = Array.isArray(config?.items) ? config.items : [];
  if (!items.length) {
    return "";
  }
  const activeSource = normalizeTextKey(config?.active_source || "url");
  if (activeSource === "manual") {
    return String(config?.active || "").trim();
  }
  if (activeSource === "helper") {
    const target = String(config?.target || "").trim();
    const stateValue = String(hass?.states?.[target]?.state ?? "").trim();
    if (!stateValue) {
      return "";
    }
    const matched = items.find(item => (
      String(item.value || "").trim() === stateValue
      || String(item.id || "").trim() === stateValue
      || String(item.name || "").trim() === stateValue
    ));
    return matched?.id || "";
  }
  const normalizedCurrentPath = normalizedPathForCompare(currentPath);
  if (!normalizedCurrentPath) {
    return "";
  }
  const matched = items.find(item => normalizedPathForCompare(item.navigation_path) === normalizedCurrentPath);
  return matched?.id || "";
}

function fireEvent(node, type, detail, options) {
  const event = new CustomEvent(type, {
    bubbles: options?.bubbles ?? true,
    cancelable: options?.cancelable === true,
    composed: options?.composed ?? true,
    detail,
  });
  node.dispatchEvent(event);
  return event;
}

function getHelperDomain(entityId) {
  const id = String(entityId || "").trim();
  if (id.startsWith("input_select.")) {
    return "input_select";
  }
  if (id.startsWith("select.")) {
    return "select";
  }
  return "";
}

function resolveMenuItemTapAction(item) {
  const actionConfig = {
    action: "none",
    service: "",
    service_data: "",
    service_target: "",
    url: "",
    navigation_path: String(item?.navigation_path ?? "").trim(),
    new_tab: false,
  };
  applyCardTapActionField(actionConfig, {
    actionKey: "action",
    serviceKey: "service",
    serviceDataKey: "service_data",
    serviceTargetKey: "service_target",
    urlKey: "url",
    navigationKey: "navigation_path",
    newTabKey: "new_tab",
  }, item?.tap_action, "none");
  if (!actionConfig.navigation_path && item?.navigation_path) {
    actionConfig.navigation_path = String(item.navigation_path).trim();
  }
  return actionConfig;
}

function openUrl(urlValue, newTab = false) {
  const sanitized = window.NodaliaUtils?.sanitizeActionUrl?.(urlValue, { allowRelative: true }) || String(urlValue || "").trim();
  if (!sanitized) {
    return;
  }
  if (newTab) {
    window.open(sanitized, "_blank", "noopener,noreferrer");
    return;
  }
  if (/^(https?:)?\/\//i.test(sanitized)) {
    window.open(sanitized, "_self", "noopener,noreferrer");
    return;
  }
  window.history.pushState(null, "", sanitized);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}

class NodaliaMenuCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig() {
    return deepClone(STUB_CONFIG);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._activeItemId = "";
    this._lastKnownPath = getCurrentPath();
    this._handleShadowClick = this._handleShadowClick.bind(this);
    this._handleShadowPointerDown = this._handleShadowPointerDown.bind(this);
    this._handleShadowKeyDown = this._handleShadowKeyDown.bind(this);
    this._handleLocationChange = this._handleLocationChange.bind(this);
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._handleShadowClick);
    this.shadowRoot?.addEventListener("pointerdown", this._handleShadowPointerDown, true);
    this.shadowRoot?.addEventListener("keydown", this._handleShadowKeyDown);
    window.addEventListener("location-changed", this._handleLocationChange);
    window.addEventListener("popstate", this._handleLocationChange);
    this._lastRenderSignature = "";
    this._render();
  }

  disconnectedCallback() {
    this.shadowRoot?.removeEventListener("click", this._handleShadowClick);
    this.shadowRoot?.removeEventListener("pointerdown", this._handleShadowPointerDown, true);
    this.shadowRoot?.removeEventListener("keydown", this._handleShadowKeyDown);
    window.removeEventListener("location-changed", this._handleLocationChange);
    window.removeEventListener("popstate", this._handleLocationChange);
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._lastRenderSignature = "";
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.isConnected) {
      return;
    }
    const signature = this._getRenderSignature();
    if (signature === this._lastRenderSignature && this.shadowRoot?.innerHTML) {
      return;
    }
    this._lastRenderSignature = signature;
    this._render();
  }

  getCardSize() {
    return 1;
  }

  _handleLocationChange() {
    this._lastKnownPath = getCurrentPath();
    if (this._config?.active_source !== "url") {
      return;
    }
    this._lastRenderSignature = "";
    this._render();
  }

  _triggerHaptic(style = this._config?.haptics?.style) {
    if (this._config?.haptics?.enabled === false) {
      return;
    }
    try {
      fireEvent(this, "haptic", String(style || "medium"));
    } catch (_error) {
      // Ignore dispatch issues.
    }
  }

  _t(key, fallback, values = {}) {
    const lang = window.NodaliaI18n?.resolveLanguage?.(this._hass, this._config?.language) ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.menuCard || window.NodaliaI18n?.strings?.("en")?.menuCard || {};
    let text = pack[key] ?? fallback ?? key;
    Object.entries(values).forEach(([token, value]) => {
      text = text.replace(new RegExp(`\\{${token}\\}`, "g"), String(value));
    });
    return text;
  }

  _resolveDisplayName(item) {
    const name = String(item?.name ?? "").trim();
    if (name) {
      return name;
    }
    const id = String(item?.id ?? "").trim();
    if (id) {
      return id.replace(/[_-]+/g, " ");
    }
    return "Menu item";
  }

  _navigate(path) {
    const nextPath = window.NodaliaUtils?.sanitizeActionUrl?.(path, { allowRelative: true }) || String(path || "").trim();
    if (!nextPath) {
      return;
    }
    fireEvent(this, "hass-navigate", { path: nextPath });
  }

  _executeHelperMode(item) {
    if (!this._hass) {
      return;
    }
    const target = String(this._config?.target ?? "").trim();
    const domain = getHelperDomain(target);
    if (!target || !domain) {
      return;
    }
    const option = String(item?.value ?? item?.id ?? item?.name ?? "").trim();
    if (!option) {
      return;
    }
    const invoke = window.NodaliaUtils?.invokeHomeAssistantService?.bind(window.NodaliaUtils)
      || ((host, hass, serviceDomain, service, data, serviceTarget) => Promise.resolve(
        serviceTarget != null
          ? hass?.callService?.(serviceDomain, service, data, serviceTarget)
          : hass?.callService?.(serviceDomain, service, data),
      ));
    invoke(this, this._hass, domain, "select_option", { entity_id: target, option }, null);
  }

  _executeActionMode(item) {
    const action = resolveMenuItemTapAction(item);
    const actionType = normalizeTextKey(action.action || "none");
    if (actionType === "none") {
      return;
    }
    if (actionType === "more-info") {
      const entityId = String(item.badge_entity || this._config?.target || "").trim();
      if (entityId) {
        fireEvent(this, "hass-more-info", { entityId });
      }
      return;
    }
    if (actionType === "navigate") {
      this._navigate(action.navigation_path || item.navigation_path);
      return;
    }
    if (actionType === "url") {
      openUrl(action.url, action.new_tab === true);
      return;
    }
    if (actionType === "toggle") {
      const targetEntity = String(this._config?.target || "").trim();
      if (!targetEntity || !this._hass) {
        return;
      }
      const invoke = window.NodaliaUtils?.invokeHomeAssistantService?.bind(window.NodaliaUtils);
      if (typeof invoke === "function") {
        invoke(this, this._hass, "homeassistant", "toggle", { entity_id: targetEntity }, null);
      } else {
        this._hass.callService?.("homeassistant", "toggle", { entity_id: targetEntity });
      }
      return;
    }
    if (actionType === "service") {
      if (!this._hass) {
        return;
      }
      const service = String(action.service || "").trim();
      if (!service || !service.includes(".")) {
        return;
      }
      const [domain, serviceName] = service.split(".");
      if (!domain || !serviceName) {
        return;
      }
      const data = parseMaybeJsonObject(action.service_data);
      const target = parseMaybeJsonObject(action.service_target);
      const invoke = window.NodaliaUtils?.invokeHomeAssistantService?.bind(window.NodaliaUtils)
        || ((host, hass, svcDomain, svc, payload, svcTarget) => Promise.resolve(
          svcTarget != null
            ? hass?.callService?.(svcDomain, svc, payload, svcTarget)
            : hass?.callService?.(svcDomain, svc, payload),
        ));
      invoke(this, this._hass, domain, serviceName, data, Object.keys(target).length ? target : null);
    }
  }

  _executeItemAction(item) {
    const mode = normalizeTextKey(this._config?.mode || "navigate");
    if (mode === "helper") {
      this._executeHelperMode(item);
      return;
    }
    if (mode === "action") {
      this._executeActionMode(item);
      return;
    }
    this._navigate(item.navigation_path);
  }

  _findItemButtonFromEvent(event) {
    return event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.menuItemId);
  }

  _handleShadowPointerDown(event) {
    const button = this._findItemButtonFromEvent(event);
    if (!button) {
      return;
    }
    if (typeof event.button === "number" && event.button !== 0) {
      return;
    }
    this._triggerHaptic();
  }

  _handleShadowClick(event) {
    const button = this._findItemButtonFromEvent(event);
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const itemId = String(button.dataset.menuItemId || "").trim();
    const item = this._config?.items?.find(row => row.id === itemId);
    if (!item) {
      return;
    }
    this._executeItemAction(item);
  }

  _focusButtonByIndex(index) {
    const buttons = Array.from(this.shadowRoot?.querySelectorAll("[data-menu-item-id]") || []);
    if (!buttons.length) {
      return;
    }
    const safeIndex = Math.max(0, Math.min(buttons.length - 1, index));
    const target = buttons[safeIndex];
    if (target instanceof HTMLElement) {
      target.focus();
    }
  }

  _handleShadowKeyDown(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.dataset?.menuItemIndex) {
      return;
    }
    const currentIndex = Number(target.dataset.menuItemIndex);
    if (!Number.isInteger(currentIndex)) {
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      this._focusButtonByIndex(currentIndex + 1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      this._focusButtonByIndex(currentIndex - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      this._focusButtonByIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      this._focusButtonByIndex((this._config?.items?.length || 1) - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      target.click();
    }
  }

  _getRenderSignature() {
    const config = this._config || {};
    const itemStamp = (config.items || [])
      .map(item => `${item.id}:${item.name}:${item.navigation_path}:${item.value}:${item.badge}:${item.badge_entity}:${item.badge_color}:${JSON.stringify(item.tap_action || {})}`)
      .join("|");
    const badgeStamp = (config.items || [])
      .map(item => {
        if (!item.badge_entity) {
          return "";
        }
        const state = this._hass?.states?.[item.badge_entity];
        return `${item.badge_entity}:${state?.state ?? ""}:${state?.last_updated ?? ""}`;
      })
      .join("|");
    const targetState = config.target
      ? this._hass?.states?.[config.target]?.state || ""
      : "";
    return [
      CARD_VERSION,
      config.variant,
      config.mode,
      config.active_source,
      config.active,
      config.target,
      config.show_labels,
      config.show_icons,
      config.show_badges,
      config.show_zero_badge,
      config.scroll,
      itemStamp,
      badgeStamp,
      targetState,
      this._lastKnownPath,
    ].join("::");
  }

  _renderEmptyState() {
    const cardStyles = (this._config || DEFAULT_CONFIG).styles?.card || DEFAULT_CONFIG.styles.card;
    const body = `
      <ha-card class="menu-card menu-card--empty">
        <div class="menu-empty-title">${escapeHtml(this._t("emptyTitle", "Nodalia Menu Card"))}</div>
        <div class="menu-empty-body">${escapeHtml(this._t("emptyBody", "Add menu items in the card editor."))}</div>
      </ha-card>`;
    return window.NodaliaUtils?.renderCardEmptyStateDocument?.(body, { card: cardStyles }) ?? body;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    const config = this._config || normalizeConfig({});
    if (!Array.isArray(config.items) || !config.items.length) {
      this.shadowRoot.innerHTML = this._renderEmptyState();
      return;
    }

    this._activeItemId = resolveActiveItemId(config, this._hass, this._lastKnownPath);
    const variant = config.variant || "segmented";
    const labelsVisible = config.show_labels !== false && variant !== "icon_only";
    const iconsVisible = config.show_icons !== false;
    const badgesVisible = config.show_badges !== false;
    const scrollEnabled = config.scroll !== false;

    const itemStyles = config.styles?.item || DEFAULT_CONFIG.styles.item;
    const cardStyles = config.styles?.card || DEFAULT_CONFIG.styles.card;
    const accentColor = escapeHtml(config.styles?.accent || DEFAULT_CONFIG.styles.accent || "var(--primary-color)");
    const hasActiveItem = Boolean(this._activeItemId);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --menu-card-background: ${cardStyles.background};
          --menu-card-border: ${cardStyles.border};
          --menu-card-radius: ${cardStyles.border_radius};
          --menu-card-shadow: ${cardStyles.box_shadow};
          --menu-card-padding: ${cardStyles.padding};
          --menu-height: 40px;
          --menu-radius: 999px;
          --menu-gap: 6px;
          --menu-font-size: 11px;
          --menu-active-bg: ${itemStyles.active_background};
          --menu-active-color: ${itemStyles.active_color};
          --menu-active-border: ${itemStyles.active_border};
          --menu-item-bg: ${itemStyles.background};
          --menu-item-border: ${itemStyles.border};
          --menu-item-color: ${itemStyles.color};
          --menu-shadow: var(--ha-card-box-shadow, 0 8px 20px rgba(0, 0, 0, 0.16));
        }
        * { box-sizing: border-box; }

        ha-card {
          background: var(--menu-card-background);
          border: var(--menu-card-border);
          border-radius: var(--menu-card-radius);
          box-shadow: var(--menu-card-shadow);
          color: var(--primary-text-color);
          display: block;
          isolation: isolate;
          overflow: hidden;
          padding: var(--menu-card-padding);
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        ha-card::before {
          background: linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0));
          border-radius: inherit;
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        ha-card::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%);
          border-radius: inherit;
          content: "";
          inset: 0;
          opacity: ${hasActiveItem ? "1" : "0"};
          pointer-events: none;
          position: absolute;
          transition: opacity 180ms ease;
          z-index: 0;
        }

        .menu-wrap {
          position: relative;
          z-index: 1;
        }

        .menu-track {
          align-items: center;
          display: flex;
          gap: var(--menu-gap);
          min-height: var(--menu-height);
          min-width: 0;
          width: 100%;
        }

        .menu-track.is-scrollable {
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: thin;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 2px;
        }

        .menu-track.is-scrollable::-webkit-scrollbar {
          height: 6px;
        }

        .menu-track.is-scrollable::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--primary-text-color) 18%, transparent);
          border-radius: 999px;
        }

        .menu-item {
          align-items: center;
          appearance: none;
          background: var(--menu-item-bg);
          border: 1px solid var(--menu-item-border);
          border-radius: var(--menu-radius);
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color: var(--menu-item-color);
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          font: inherit;
          font-size: var(--menu-font-size);
          font-weight: 600;
          gap: 8px;
          justify-content: center;
          min-height: var(--menu-height);
          min-width: 54px;
          padding: 0 14px;
          position: relative;
          transition: background 180ms ease, transform 150ms ease, color 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
          white-space: nowrap;
        }

        .menu-item:hover {
          border-color: color-mix(in srgb, var(--primary-text-color) 20%, transparent);
        }

        .menu-item:active {
          transform: scale(0.98);
        }

        .menu-item.is-active {
          background: var(--menu-active-bg);
          border-color: var(--menu-active-border);
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent), 0 8px 18px color-mix(in srgb, ${accentColor} 12%, rgba(0, 0, 0, 0.12));
          color: var(--menu-active-color);
        }

        .menu-item:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--primary-text-color) 35%, transparent);
          outline-offset: 1px;
        }

        .menu-item__icon {
          align-items: center;
          display: inline-flex;
          justify-content: center;
          position: relative;
        }

        .menu-item__icon ha-icon {
          --mdc-icon-size: 18px;
        }

        .menu-item__label {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .menu-item__badge {
          align-items: center;
          background: var(--error-color, #ef4444);
          border-radius: 999px;
          color: #fff;
          display: inline-flex;
          font-size: 10px;
          font-weight: 700;
          justify-content: center;
          line-height: 1;
          min-height: 18px;
          min-width: 18px;
          padding: 0 6px;
        }

        .menu-item__badge--dot {
          min-height: 10px;
          min-width: 10px;
          padding: 0;
        }

        .menu-wrap--segmented {
          background: transparent;
          border: none;
          border-radius: 0;
          padding: 0;
        }

        .menu-wrap--segmented .menu-track {
          gap: 6px;
        }

        .menu-wrap--pill .menu-item {
          border-radius: 999px;
          min-height: 42px;
          padding: 0 14px;
        }

        .menu-wrap--pill .menu-item.is-active {
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }

        .menu-wrap--dock {
          background: linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), color-mix(in srgb, var(--primary-text-color) 1%, transparent));
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 14%, transparent);
          border-radius: 999px;
          box-shadow: var(--menu-shadow);
          padding: 8px;
        }

        .menu-wrap--dock .menu-item {
          border-radius: 999px;
          border-width: 0;
          min-height: 46px;
          min-width: 58px;
          padding: 0 10px;
        }

        .menu-wrap--dock .menu-item.is-active {
          background: var(--menu-active-bg);
        }

        .menu-wrap--glass {
          backdrop-filter: blur(14px) saturate(1.1);
          background: color-mix(in srgb, var(--ha-card-background, #1f2330) 72%, transparent);
          border: 1px solid color-mix(in srgb, #ffffff 15%, transparent);
          border-radius: 18px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, #ffffff 14%, transparent), var(--menu-shadow);
          padding: 8px;
        }

        .menu-wrap--glass .menu-item {
          backdrop-filter: blur(8px);
          background: color-mix(in srgb, #ffffff 6%, transparent);
        }

        .menu-wrap--compact {
          --menu-height: 38px;
          --menu-font-size: 11px;
          --menu-gap: 4px;
          --menu-radius: 10px;
        }

        .menu-wrap--compact .menu-item {
          min-width: 44px;
          padding: 0 10px;
        }

        .menu-wrap--icon_only {
          --menu-height: 42px;
          --menu-gap: 8px;
        }

        .menu-wrap--icon_only .menu-item {
          border-radius: 12px;
          min-width: 42px;
          padding: 0 10px;
        }

        .menu-wrap--icon_only .menu-item__icon ha-icon {
          --mdc-icon-size: 20px;
        }

        .menu-wrap--icon_only .menu-item__badge {
          position: absolute;
          right: -3px;
          top: -4px;
        }

        @media (max-width: 760px) {
          .menu-track {
            gap: 8px;
          }
          .menu-item {
            min-width: 54px;
          }
        }
      </style>
      <ha-card class="menu-card menu-card--${escapeHtml(variant)}">
        <div class="menu-wrap menu-wrap--${escapeHtml(variant)}">
        <div class="menu-track ${scrollEnabled ? "is-scrollable" : ""}" role="tablist" aria-label="Nodalia menu">
          ${config.items.map((item, index) => {
    const itemLabel = this._resolveDisplayName(item);
    const isActive = item.id === this._activeItemId;
    const badge = badgesVisible ? resolveItemBadge(item, this._hass, config) : null;
    const hasBadge = Boolean(badge);
    const badgeColorStyle = badge?.color ? ` style="background:${escapeHtml(badge.color)};"` : "";
    const iconMarkup = iconsVisible
      ? `<span class="menu-item__icon"><ha-icon icon="${escapeHtml(item.icon || DEFAULT_ITEM.icon)}"></ha-icon></span>`
      : "";
    return `
            <button
              type="button"
              role="tab"
              class="menu-item ${isActive ? "is-active" : ""}"
              aria-selected="${isActive ? "true" : "false"}"
              aria-label="${escapeHtml(itemLabel)}"
              data-menu-item-id="${escapeHtml(item.id)}"
              data-menu-item-index="${index}"
            >
              ${iconMarkup}
              ${labelsVisible ? `<span class="menu-item__label">${escapeHtml(itemLabel)}</span>` : ""}
              ${hasBadge
    ? `<span class="menu-item__badge ${String(badge.value).trim() === "•" ? "menu-item__badge--dot" : ""}"${badgeColorStyle}>${escapeHtml(badge.value)}</span>`
    : ""}
            </button>
          `;
  }).join("")}
        </div>
        </div>
      </ha-card>
    `;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaMenuCard);
}

class NodaliaMenuCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("input", this._onShadowInput);
    this.shadowRoot?.addEventListener("change", this._onShadowInput);
    this.shadowRoot?.addEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    window.NodaliaUtils?.bindEditorDialogLayoutFix?.(this);
  }

  disconnectedCallback() {
    this.shadowRoot?.removeEventListener("input", this._onShadowInput);
    this.shadowRoot?.removeEventListener("change", this._onShadowInput);
    this.shadowRoot?.removeEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
    window.NodaliaUtils?.releaseEditorDialogLayoutFix?.(this);
  }

  set hass(hass) {
    const nextSignature = this._getEntityOptionsSignature(hass);
    const shouldRender = !this._hass || nextSignature !== this._entityOptionsSignature || !this.shadowRoot?.innerHTML;
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
    return window.NodaliaUtils?.editorFilteredStatesSignature?.(hass, "auto", id => id.startsWith("select.") || id.startsWith("input_select.")) || "";
  }

  _captureFocusState() {
    const active = this.shadowRoot?.activeElement;
    if (
      !(
        active instanceof HTMLInputElement
        || active instanceof HTMLTextAreaElement
        || active instanceof HTMLSelectElement
      )
    ) {
      return null;
    }
    return {
      field: active.dataset?.field || "",
      start: typeof active.selectionStart === "number" ? active.selectionStart : null,
      end: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
    };
  }

  _restoreFocusState(focusState) {
    if (!focusState?.field) {
      return;
    }
    const next = this.shadowRoot?.querySelector(`[data-field="${CSS.escape(focusState.field)}"]`);
    if (
      !(
        next instanceof HTMLInputElement
        || next instanceof HTMLTextAreaElement
        || next instanceof HTMLSelectElement
      )
    ) {
      return;
    }
    next.focus();
    if (typeof focusState.start === "number" && typeof focusState.end === "number" && typeof next.setSelectionRange === "function") {
      next.setSelectionRange(focusState.start, focusState.end);
    }
  }

  _emitConfig() {
    const cleaned = stripEqualToDefaults(this._config, DEFAULT_CONFIG);
    fireEvent(this, "config-changed", {
      config: compactConfig(cleaned),
    });
  }

  _readInputValue(input) {
    const valueType = input.dataset?.valueType || "string";
    if (valueType === "boolean") {
      return input.checked === true;
    }
    if (valueType === "json") {
      return parseTapActionValue(input.value);
    }
    return input.value;
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement);
    if (!input?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    const value = this._readInputValue(input);
    if (input.dataset.clearable === "true" && (value === "" || value === null || value === undefined)) {
      deleteByPath(this._config, input.dataset.field);
    } else {
      setByPath(this._config, input.dataset.field, value);
    }
    this._config = normalizeConfig(this._config);
    this._emitConfig();
  }

  _onShadowValueChanged(event) {
    const control = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.field);
    if (!control?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    setByPath(this._config, control.dataset.field, String(event.detail?.value || "").trim());
    this._config = normalizeConfig(this._config);
    this._emitConfig();
  }

  _onShadowClick(event) {
    const button = event.composedPath().find(node => node instanceof HTMLButtonElement && node.dataset?.action);
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.action;
    const index = Number(button.dataset.index);
    this._config.items = Array.isArray(this._config.items) ? this._config.items : [];

    if (action === "add-item") {
      this._config.items.push(deepClone(DEFAULT_ITEM));
      this._emitConfig();
      this._render();
      return;
    }

    if (!Number.isInteger(index) || index < 0 || index >= this._config.items.length) {
      return;
    }

    if (action === "remove-item") {
      this._config.items.splice(index, 1);
      this._emitConfig();
      this._render();
      return;
    }
    if (action === "move-up") {
      moveItem(this._config.items, index, index - 1);
      this._emitConfig();
      this._render();
      return;
    }
    if (action === "move-down") {
      moveItem(this._config.items, index, index + 1);
      this._emitConfig();
      this._render();
    }
  }

  _editorLabel(key) {
    if (typeof key !== "string") {
      return String(key ?? "");
    }
    return window.NodaliaI18n?.editorStr?.(this._hass, this._config?.language ?? "auto", key) || key;
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = typeof label === "string" && label.startsWith("ed.") ? this._editorLabel(label) : label;
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          type="${escapeHtml(options.type || "text")}"
          data-field="${escapeHtml(field)}"
          value="${escapeHtml(value ?? "")}"
          ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ""}
          ${options.valueType ? `data-value-type="${escapeHtml(options.valueType)}"` : ""}
          ${options.clearable ? 'data-clearable="true"' : ""}
        />
      </label>
    `;
  }

  _renderTextareaField(label, field, value, options = {}) {
    const tLabel = typeof label === "string" && label.startsWith("ed.") ? this._editorLabel(label) : label;
    const normalizedValue = isObject(value) ? JSON.stringify(value) : String(value ?? "");
    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <textarea
          data-field="${escapeHtml(field)}"
          ${options.valueType ? `data-value-type="${escapeHtml(options.valueType)}"` : ""}
          ${options.clearable ? 'data-clearable="true"' : ""}
        >${escapeHtml(normalizedValue)}</textarea>
      </label>
    `;
  }

  _renderSelectField(label, field, value, options, renderOptions = {}) {
    const tLabel = typeof label === "string" && label.startsWith("ed.") ? this._editorLabel(label) : label;
    return `
      <label class="editor-field ${renderOptions.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${(options || []).map(option => {
    const optionLabel = typeof option.label === "string" && option.label.startsWith("ed.")
      ? this._editorLabel(option.label)
      : option.label;
    return `
            <option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? "selected" : ""}>
              ${escapeHtml(optionLabel)}
            </option>
          `;
  }).join("")}
        </select>
      </label>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    const tLabel = typeof label === "string" && label.startsWith("ed.") ? this._editorLabel(label) : label;
    return `
      <label class="editor-toggle">
        <input type="checkbox" data-field="${escapeHtml(field)}" data-value-type="boolean" ${checked ? "checked" : ""} />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span>${escapeHtml(tLabel)}</span>
      </label>
    `;
  }

  _renderEntityPickerField(label, field, value, includeDomains = []) {
    const tLabel = typeof label === "string" && label.startsWith("ed.") ? this._editorLabel(label) : label;
    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(value || "")}"
          data-include-domains="${escapeHtml(includeDomains.join(","))}"
        ></div>
      </label>
    `;
  }

  _renderIconPickerField(label, field, value, options = {}) {
    const tLabel = typeof label === "string" && label.startsWith("ed.") ? this._editorLabel(label) : label;
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="icon-picker"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
        ></div>
      </div>
    `;
  }

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }
    window.NodaliaUtils?.mountEntityPickerHost?.(host, {
      hass: this._hass,
      field: host.dataset.field || "",
      value: host.dataset.value || getByPath(this._config, host.dataset.field || "") || "",
      onShadowInput: this._onShadowInput,
      onShadowValueChanged: this._onShadowValueChanged,
      copyDatasetFromHost: true,
    });
    const includeDomains = String(host.dataset.includeDomains || "")
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
    const picker = host.querySelector("ha-entity-picker");
    if (picker && includeDomains.length) {
      picker.includeDomains = includeDomains;
    }
  }

  _mountIconPicker(host) {
    window.NodaliaUtils?.mountIconPickerHost?.(host, {
      hass: this._hass,
      value: host.dataset.value || getByPath(this._config, host.dataset.field || "") || "",
      onShadowInput: this._onShadowInput,
      onShadowValueChanged: this._onShadowValueChanged,
      copyDatasetFromHost: true,
    });
  }

  _renderItemCard(item, index, total) {
    return `
      <div class="item-card">
        <div class="item-card__header">
          <div class="item-card__title">${escapeHtml(this._editorLabel("ed.menu.item_id"))} ${index + 1}</div>
          <div class="item-card__actions">
            <button type="button" data-action="move-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" data-action="move-down" data-index="${index}" ${index >= total - 1 ? "disabled" : ""}>↓</button>
            <button type="button" data-action="remove-item" data-index="${index}" class="danger">${escapeHtml(this._editorLabel("ed.menu.remove_item"))}</button>
          </div>
        </div>
        <div class="editor-grid">
          ${this._renderTextField("ed.menu.item_id", `items.${index}.id`, item.id, { placeholder: "home", clearable: true })}
          ${this._renderTextField("ed.menu.item_name", `items.${index}.name`, item.name, { placeholder: "Home", clearable: true })}
          ${this._renderIconPickerField("ed.menu.item_icon", `items.${index}.icon`, item.icon)}
          ${this._renderTextField("ed.menu.item_navigation_path", `items.${index}.navigation_path`, item.navigation_path, { placeholder: "/lovelace/home", clearable: true })}
          ${this._renderTextField("ed.menu.item_value", `items.${index}.value`, item.value, { placeholder: "home", clearable: true })}
          ${this._renderTextField("ed.menu.item_badge", `items.${index}.badge`, item.badge, { placeholder: "3", clearable: true })}
          ${this._renderEntityPickerField("ed.menu.item_badge_entity", `items.${index}.badge_entity`, item.badge_entity, ["sensor", "binary_sensor", "input_number"])}
          ${this._renderTextField("ed.menu.item_badge_color", `items.${index}.badge_color`, item.badge_color, { placeholder: "var(--error-color)", fullWidth: true, clearable: true })}
          ${this._renderTextareaField("ed.menu.item_tap_action", `items.${index}.tap_action`, item.tap_action, {
    valueType: "json",
    clearable: true,
  })}
        </div>
      </div>
    `;
  }

  _render() {
    const config = this._config || normalizeConfig({});
    const items = Array.isArray(config.items) ? config.items : [];
    const variantOptions = MENU_VARIANTS.map(value => ({ value, label: `ed.menu.variant_${value}` }));
    const modeOptions = MENU_MODES.map(value => ({ value, label: `ed.menu.mode_${value}` }));
    const activeSourceOptions = ACTIVE_SOURCES.map(value => ({ value, label: `ed.menu.active_source_${value}` }));

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; overflow-anchor: none; }
        * { box-sizing: border-box; }
        .editor { color: var(--primary-text-color); display: grid; gap: 16px; }
        .editor-section {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 18px;
          display: grid;
          gap: 14px;
          padding: 16px;
        }
        .editor-section:last-child { margin-bottom: 0; }
        .editor-section__header { display: grid; gap: 4px; }
        .editor-section__title { font-size: 15px; font-weight: 700; }
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
        .editor-field, .editor-toggle { display: grid; gap: 6px; min-width: 0; }
        .editor-field--full { grid-column: 1 / -1; }
        .editor-field > span, .editor-toggle > span:not(.editor-toggle__switch) {
          color: var(--secondary-text-color);
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
          min-height: 66px;
          resize: vertical;
        }
        .editor-toggle {
          align-items: center;
          column-gap: 10px;
          cursor: pointer;
          grid-template-columns: auto minmax(0, 1fr);
          min-height: 40px;
          position: relative;
        }
        .editor-toggle input {
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
          display: inline-flex;
          height: 22px;
          position: relative;
          transition: background 160ms ease, border-color 160ms ease;
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
        .editor-toggle input:checked + .editor-toggle__switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }
        .editor-toggle input:checked + .editor-toggle__switch::before {
          transform: translateX(18px);
        }
        .editor-section__actions,
        .item-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
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
        button.danger { color: var(--error-color); }
        button:disabled { cursor: default; opacity: 0.45; }
        .item-list { display: grid; gap: 12px; }
        .item-card {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 14px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }
        .item-card__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }
        .item-card__title { font-size: 13px; font-weight: 700; }
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }
        .empty-items {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
        }
        @media (max-width: 640px) {
          .editor-grid { grid-template-columns: 1fr; }
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.menu.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.menu.general_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField("ed.menu.variant", "variant", config.variant, variantOptions)}
            ${this._renderSelectField("ed.menu.mode", "mode", config.mode, modeOptions)}
            ${this._renderSelectField("ed.menu.active_source", "active_source", config.active_source, activeSourceOptions)}
            ${this._renderTextField("ed.menu.active", "active", config.active, { placeholder: "home", clearable: true })}
            ${this._renderEntityPickerField("ed.menu.target", "target", config.target, ["input_select", "select"])}
            ${this._renderCheckboxField("ed.menu.show_labels", "show_labels", config.show_labels !== false)}
            ${this._renderCheckboxField("ed.menu.show_icons", "show_icons", config.show_icons !== false)}
            ${this._renderCheckboxField("ed.menu.show_badges", "show_badges", config.show_badges !== false)}
            ${this._renderCheckboxField("ed.menu.show_zero_badge", "show_zero_badge", config.show_zero_badge === true)}
            ${this._renderCheckboxField("ed.menu.scroll", "scroll", config.scroll !== false)}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.menu.items_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.menu.items_section_hint"))}</div>
          </div>
          <div class="item-list">
            ${items.length
    ? items.map((item, index) => this._renderItemCard(item, index, items.length)).join("")
    : `<div class="empty-items">${escapeHtml(this._editorLabel("ed.menu.items_empty"))}</div>`}
          </div>
          <div class="editor-section__actions">
            <button type="button" data-action="add-item">${escapeHtml(this._editorLabel("ed.menu.add_item"))}</button>
          </div>
        </section>
      </div>
    `;

    this.shadowRoot.querySelectorAll('[data-mounted-control="entity-picker"]').forEach(host => {
      this._mountEntityPicker(host);
    });
    this.shadowRoot.querySelectorAll('[data-mounted-control="icon-picker"]').forEach(host => {
      this._mountIconPicker(host);
    });
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaMenuCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Menu Card",
  description: "Navigation/helper/action menu with active detection, badges, and variant styles.",
  preview: true,
  documentationURL: "https://github.com/danielmigueltejedor/nodalia-cards",
});

globalThis.__NODALIA_MENU__ = {
  normalizeConfig,
  normalizeMenuItems,
  resolveActiveItemId,
  resolveItemBadge,
  getCurrentPath,
  MENU_VARIANTS,
  MENU_MODES,
};
