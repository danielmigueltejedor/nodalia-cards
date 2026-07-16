const CARD_TAG = "nodalia-camera-card";
const EDITOR_TAG = "nodalia-camera-card-editor";
const CARD_VERSION = "2.0.0-alpha.30";
const LAYOUT_MODES = new Set(["live", "snapshot", "compact", "security", "mosaic"]);
const PRESENTATION_MODES = new Set(["feed", "card"]);
const MAX_CAMERAS = 4;
const TAP_ACTIONS = new Set(["auto", "more-info", "none", "navigate", "url", "service", "toggle"]);
const HOLD_ACTIONS = new Set(["auto", "more-info", "none", "navigate", "url", "service", "toggle"]);

const DEFAULT_CONFIG = {
  entity: "",
  cameras: [],
  name: "",
  layout: "live",
  presentation: "feed",
  language: "auto",
  show_name: false,
  show_state: false,
  show_status_chips: false,
  show_last_changed: false,
  show_preview_age: true,
  expanded_actions: [],
  tap_action: "toggle",
  tap_service: "",
  tap_service_data: "",
  tap_service_target: "",
  tap_url: "",
  navigation_path: "",
  tap_new_tab: false,
  hold_action: "none",
  hold_service: "",
  hold_service_data: "",
  hold_service_target: "",
  hold_url: "",
  hold_navigation_path: "",
  hold_new_tab: false,
  security: {
    strict_service_actions: true,
    allowed_services: [],
    allowed_service_domains: [],
  },
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
      gap: "10px",
    },
    preview: {
      aspect_ratio: "16 / 9",
      border_radius: "18px",
      overlay_strength: 0.42,
      min_height: "220px",
      mosaic_gap: "8px",
    },
    title_size: "15px",
    subtitle_size: "12px",
    chip_height: "24px",
    chip_font_size: "11px",
    chip_padding: "0 9px",
    chip_border_radius: "999px",
  },
};

const STUB_CONFIG = {
  entity: "camera.entrada",
  name: "Entrada",
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
    if (isObject(base[key]) && isObject(override?.[key]) && !Array.isArray(base[key])) {
      result[key] = mergeConfig(base[key], override[key]);
      return;
    }
    result[key] = override?.[key] === undefined ? deepClone(base[key]) : deepClone(override[key]);
  });
  return result;
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
  const parts = String(path || "").split(".");
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeTextKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isUnavailableState(state) {
  const key = normalizeTextKey(state?.state);
  return key === "unavailable" || key === "unknown";
}

function appendQueryParam(url, key, value) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl || value === undefined || value === null || value === "") {
    return safeUrl;
  }
  const separator = safeUrl.includes("?") ? "&" : "?";
  return `${safeUrl}${separator}${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
}

function formatRelativeAge(timestamp, locale = "en", now = Date.now()) {
  const value = new Date(timestamp || "").getTime();
  if (!Number.isFinite(value)) {
    return "";
  }
  const elapsedSeconds = Math.max(0, Math.floor((Number(now) - value) / 1000));
  let amount = 0;
  let unit = "second";
  if (elapsedSeconds >= 86400) {
    amount = Math.max(1, Math.floor(elapsedSeconds / 86400));
    unit = "day";
  } else if (elapsedSeconds >= 3600) {
    amount = Math.max(1, Math.floor(elapsedSeconds / 3600));
    unit = "hour";
  } else if (elapsedSeconds >= 60) {
    amount = Math.max(1, Math.floor(elapsedSeconds / 60));
    unit = "minute";
  } else if (elapsedSeconds >= 45) {
    amount = elapsedSeconds;
  }
  try {
    return new Intl.RelativeTimeFormat(locale || "en", {
      numeric: "auto",
      style: "short",
    }).format(-amount, unit);
  } catch (_error) {
    if (amount === 0) return "now";
    const suffix = amount === 1 ? unit : `${unit}s`;
    return `${amount} ${suffix} ago`;
  }
}

function parseServiceData(rawValue) {
  if (!rawValue) {
    return {};
  }
  if (isObject(rawValue)) {
    return rawValue;
  }
  try {
    const parsed = JSON.parse(rawValue);
    return isObject(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function fireEvent(node, type, detail, options) {
  node.dispatchEvent(new CustomEvent(type, {
    bubbles: options?.bubbles !== false,
    composed: options?.composed !== false,
    cancelable: options?.cancelable === true,
    detail,
  }));
}

function stripEqualToDefaults(config, defaults = DEFAULT_CONFIG) {
  const result = deepClone(config || {});
  const walk = (current, base, path = "") => {
    if (!isObject(current) || !isObject(base)) {
      return;
    }
    Object.keys(current).forEach(key => {
      const nextPath = path ? `${path}.${key}` : key;
      if (isObject(current[key]) && isObject(base[key]) && !Array.isArray(current[key])) {
        walk(current[key], base[key], nextPath);
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

function normalizeCameraEntityId(value) {
  if (isObject(value)) {
    return String(value.entity ?? value.entity_id ?? "").trim();
  }
  return String(value ?? "").trim();
}

function normalizeCameras(config = {}) {
  const seen = new Set();
  const ids = [];
  const pushId = value => {
    const id = normalizeCameraEntityId(value);
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    ids.push(id);
  };
  if (Array.isArray(config.cameras)) {
    config.cameras.forEach(pushId);
  }
  pushId(config.entity);
  return ids.slice(0, MAX_CAMERAS);
}

function normalizeExpandedActions(rawActions = []) {
  if (!Array.isArray(rawActions)) {
    return [];
  }
  return rawActions.map(item => {
    if (!isObject(item)) {
      return null;
    }
    const entity = String(item.entity ?? "").trim();
    if (!entity) {
      return null;
    }
    const action = normalizeTextKey(item.tap_action || "toggle");
    return {
      entity,
      name: String(item.name ?? "").trim(),
      icon: String(item.icon ?? "").trim() || "mdi:gesture-tap",
      icon_color: String(item.icon_color ?? item.iconColor ?? "").trim(),
      tap_action: TAP_ACTIONS.has(action) ? action : "toggle",
      tap_service: String(item.tap_service ?? "").trim(),
      tap_service_data: String(item.tap_service_data ?? "").trim(),
      tap_service_target: String(item.tap_service_target ?? "").trim(),
      tap_url: String(item.tap_url ?? "").trim(),
      navigation_path: String(item.navigation_path ?? "").trim(),
      tap_new_tab: item.tap_new_tab === true,
    };
  }).filter(Boolean).slice(0, 8);
}

function normalizeConfig(rawConfig) {
  const config = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const layout = normalizeTextKey(config.layout);
  const cameraIds = normalizeCameras(config);
  config.cameras = cameraIds;
  config.entity = cameraIds[0] || String(config.entity ?? "").trim();
  if (cameraIds.length > 1 && layout !== "security" && layout !== "compact") {
    config.layout = layout === "mosaic" || layout === "live" || layout === "snapshot" ? "mosaic" : layout;
  } else {
    config.layout = LAYOUT_MODES.has(layout) ? layout : DEFAULT_CONFIG.layout;
  }
  const presentation = normalizeTextKey(config.presentation);
  config.presentation = PRESENTATION_MODES.has(presentation) ? presentation : DEFAULT_CONFIG.presentation;
  config.expanded_actions = normalizeExpandedActions(config.expanded_actions);
  config.language = String(config.language ?? "auto").trim() || "auto";
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? { ...DEFAULT_CONFIG.security, ...(isObject(config.security) ? config.security : {}) };

  const applyTap = window.NodaliaUtils?.applyCardTapActionField?.bind(window.NodaliaUtils);
  if (typeof applyTap === "function") {
    applyTap(config, {
      actionKey: "tap_action",
      serviceKey: "tap_service",
      serviceDataKey: "tap_service_data",
      serviceTargetKey: "tap_service_target",
      urlKey: "tap_url",
      navigationKey: "navigation_path",
      newTabKey: "tap_new_tab",
    }, rawConfig?.tap_action ?? config.tap_action, "more-info");
    applyTap(config, {
      actionKey: "hold_action",
      serviceKey: "hold_service",
      serviceDataKey: "hold_service_data",
      serviceTargetKey: "hold_service_target",
      urlKey: "hold_url",
      navigationKey: "hold_navigation_path",
      newTabKey: "hold_new_tab",
    }, rawConfig?.hold_action ?? config.hold_action, "none");
  }

  config.tap_action = TAP_ACTIONS.has(normalizeTextKey(config.tap_action))
    ? normalizeTextKey(config.tap_action)
    : DEFAULT_CONFIG.tap_action;
  config.hold_action = HOLD_ACTIONS.has(normalizeTextKey(config.hold_action))
    ? normalizeTextKey(config.hold_action)
    : DEFAULT_CONFIG.hold_action;
  config.tap_service = String(config.tap_service ?? "").trim();
  config.tap_service_data = String(config.tap_service_data ?? "").trim();
  config.tap_service_target = String(config.tap_service_target ?? "").trim();
  config.tap_url = String(config.tap_url ?? "").trim();
  config.navigation_path = String(config.navigation_path ?? "").trim();
  config.hold_service = String(config.hold_service ?? "").trim();
  config.hold_service_data = String(config.hold_service_data ?? "").trim();
  config.hold_service_target = String(config.hold_service_target ?? "").trim();
  config.hold_url = String(config.hold_url ?? "").trim();
  config.hold_navigation_path = String(config.hold_navigation_path ?? "").trim();
  if (config.tap_action === "navigate" && !config.navigation_path && config.tap_url) {
    config.navigation_path = config.tap_url;
  }
  if (config.hold_action === "navigate" && !config.hold_navigation_path && config.hold_url) {
    config.hold_navigation_path = config.hold_url;
  }
  return config;
}

class NodaliaCameraCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["camera"]);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._expandedOpen = false;
    this._expandedEntityId = "";
    this._failedImageUrls = new Set();
    this._previewAgeTimer = 0;
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onWindowKeyDown = this._onWindowKeyDown.bind(this);
    window.NodaliaUtils?.clearDeferTimers?.(this);
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    window.addEventListener("keydown", this._onWindowKeyDown);
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
    window.removeEventListener("keydown", this._onWindowKeyDown);
    this._expandedOpen = false;
    this._expandedEntityId = "";
    this._clearPreviewAgeTimer();
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    if (!this.isConnected) {
      return;
    }
    this._render();
  }

  set hass(hass) {
    const previousHass = this._hass;
    this._hass = hass;
    if (!this.isConnected) {
      return;
    }
    const nextSignature = this._getRenderSignature(hass);
    if (previousHass && nextSignature === this._lastRenderSignature && this.shadowRoot?.innerHTML) {
      return;
    }
    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    return this._config?.layout === "compact" ? 2 : 3;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: this._config?.layout === "compact" ? 2 : 3,
      min_columns: 3,
    };
  }

  _getCameraIds() {
    return normalizeCameras(this._config || {});
  }

  _getState(entityId = this._expandedEntityId || this._config?.entity) {
    const id = String(entityId || "").trim();
    return id && this._hass?.states?.[id] ? this._hass.states[id] : null;
  }

  _isFeedPresentation() {
    return normalizeTextKey(this._config?.presentation) === "feed";
  }

  _isMosaicLayout() {
    const layout = normalizeTextKey(this._config?.layout);
    return layout === "mosaic" || this._getCameraIds().length > 1;
  }

  _resolveLanguage() {
    return window.NodaliaI18n?.resolveLanguage?.(this._hass, this._config?.language ?? "auto") ?? "en";
  }

  _cameraUi(path, fallback = "", values = {}) {
    const lang = this._resolveLanguage();
    const pack = window.NodaliaI18n?.strings?.(lang)?.cameraCard
      || window.NodaliaI18n?.strings?.("en")?.cameraCard
      || {};
    const value = path.split(".").reduce((cursor, key) => (cursor && cursor[key] !== undefined ? cursor[key] : undefined), pack);
    if (value === undefined || value === null) {
      return fallback;
    }
    return String(value).replace(/\{(\w+)\}/g, (_, key) => (
      values[key] !== undefined && values[key] !== null ? String(values[key]) : `{${key}}`
    ));
  }

  _getRenderSignature(hass = this._hass) {
    const cameraIds = this._getCameraIds();
    const primaryState = cameraIds.length ? hass?.states?.[cameraIds[0]] : null;
    const joinParts = window.NodaliaRenderSignature?.joinParts;
    const values = [
      cameraIds.join(","),
      this._config?.layout || "",
      this._config?.presentation || "",
      this._config?.name || "",
      String(this._config?.show_name),
      String(this._config?.show_state),
      String(this._config?.show_status_chips),
      String(this._config?.show_last_changed),
      String(this._config?.show_preview_age),
      JSON.stringify(this._config?.expanded_actions || []),
      this._config?.tap_action || "",
      this._config?.hold_action || "",
      String(this._expandedOpen),
      this._expandedEntityId || "",
      primaryState?.state || "",
      primaryState?.last_updated || "",
      primaryState?.attributes?.entity_picture || "",
      primaryState?.attributes?.access_token || "",
      primaryState?.attributes?.frontend_stream_type || "",
      this._resolveLanguage(),
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "camera:", values }]);
    }
    return values.join("|");
  }

  _getTitle(state, entityId = this._config?.entity) {
    const configuredName = String(this._config?.name ?? "").trim();
    return configuredName
      || state?.attributes?.friendly_name
      || entityId
      || this._config?.entity
      || this._cameraUi("defaultName", "Camera");
  }

  _translateState(state) {
    const key = normalizeTextKey(state?.state);
    if (key === "streaming") {
      return this._cameraUi("live", "Live");
    }
    if (key === "recording") {
      return this._cameraUi("recording", "Recording");
    }
    if (key === "idle") {
      return this._cameraUi("snapshot", "Snapshot");
    }
    if (key === "unavailable") {
      return this._cameraUi("unavailable", "Unavailable");
    }
    if (key === "unknown") {
      return this._cameraUi("unknown", "Unknown");
    }
    return String(state?.state || this._cameraUi("unknown", "Unknown"));
  }

  _isRecording(state) {
    return normalizeTextKey(state?.state) === "recording"
      || state?.attributes?.recording === true
      || state?.attributes?.is_recording === true;
  }

  _isStreaming(state) {
    const key = normalizeTextKey(state?.state);
    return key === "streaming" || key === "recording" || this._isRecording(state);
  }

  _getCameraImageUrl(state = this._getState(), entityId = this._config?.entity) {
    if (!state || !this._hass || !entityId) {
      return "";
    }

    const refreshToken = String(state.last_updated || state.last_changed || "");
    const fromPicture = String(state.attributes?.entity_picture || "").trim();
    if (fromPicture) {
      const resolved = typeof this._hass.hassUrl === "function"
        ? this._hass.hassUrl(fromPicture)
        : fromPicture;
      return appendQueryParam(resolved, "nodalia_ts", refreshToken);
    }

    if (typeof this._hass.hassUrl === "function") {
      return appendQueryParam(this._hass.hassUrl(`/api/camera_proxy/${entityId}`), "nodalia_ts", refreshToken);
    }

    return "";
  }

  _getStreamProviderHint(state = this._getState()) {
    return String(
      state?.attributes?.frontend_stream_type
      || state?.attributes?.stream_type
      || state?.attributes?.model_name
      || "",
    ).trim();
  }

  _formatLastChanged(state) {
    if (!state?.last_changed) {
      return "";
    }
    try {
      const locale = this._resolveLanguage();
      const date = new Date(state.last_changed);
      if (Number.isNaN(date.getTime())) {
        return "";
      }
      return new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date);
    } catch (_error) {
      return "";
    }
  }

  _formatPreviewAge(state) {
    return formatRelativeAge(
      state?.last_updated || state?.last_changed,
      this._resolveLanguage(),
    );
  }

  _clearPreviewAgeTimer() {
    if (!this._previewAgeTimer) {
      return;
    }
    window.clearTimeout(this._previewAgeTimer);
    this._previewAgeTimer = 0;
  }

  _updatePreviewAgeBubbles() {
    if (!this.shadowRoot || this._config?.show_preview_age === false) {
      return;
    }
    this.shadowRoot.querySelectorAll("[data-camera-preview-age]").forEach(node => {
      const entityId = String(node.dataset?.cameraEntity || "").trim();
      const label = this._formatPreviewAge(this._getState(entityId));
      if (!label) {
        node.hidden = true;
        return;
      }
      node.hidden = false;
      node.textContent = label;
      node.setAttribute("aria-label", this._cameraUi("lastUpdated", "Last updated {time}", { time: label }));
    });
  }

  _schedulePreviewAgeRefresh() {
    this._clearPreviewAgeTimer();
    if (
      !this.isConnected
      || this._config?.show_preview_age === false
      || !this.shadowRoot?.querySelector("[data-camera-preview-age]")
    ) {
      return;
    }
    this._previewAgeTimer = window.setTimeout(() => {
      this._previewAgeTimer = 0;
      this._updatePreviewAgeBubbles();
      this._schedulePreviewAgeRefresh();
    }, 15000);
  }

  _getStatusChips(state) {
    if (this._config?.show_status_chips === false || !state) {
      return [];
    }

    const chips = [];
    if (isUnavailableState(state)) {
      chips.push({ label: this._cameraUi("offline", "Offline"), tone: "offline" });
      return chips;
    }

    const layout = normalizeTextKey(this._config?.layout);
    if (this._isRecording(state)) {
      chips.push({ label: this._cameraUi("recording", "Recording"), tone: "recording" });
    } else if (this._isStreaming(state) || layout === "live") {
      chips.push({ label: this._cameraUi("live", "Live"), tone: "live" });
    } else {
      chips.push({ label: this._cameraUi("snapshot", "Snapshot"), tone: "snapshot" });
    }

    if (this._config?.show_last_changed !== false) {
      const lastChanged = this._formatLastChanged(state);
      if (lastChanged) {
        chips.push({
          label: this._cameraUi("lastUpdated", "Last updated {time}", { time: lastChanged }),
          tone: "meta",
        });
      }
    }

    return chips;
  }

  _triggerHaptic(styleOverride = null) {
    const haptics = this._config?.haptics || {};
    if (haptics.enabled !== true) {
      return;
    }
    const style = styleOverride || haptics.style || "medium";
    fireEvent(this, "haptic", style, { bubbles: true, composed: true });
  }

  _openMoreInfo(entityId = this._config?.entity) {
    if (entityId) {
      fireEvent(this, "hass-more-info", { entityId });
    }
  }

  _navigateToPath(pathValue) {
    const navigationPath = window.NodaliaUtils?.sanitizeActionUrl?.(pathValue, { allowRelative: true }) || "";
    if (!navigationPath) {
      return;
    }
    fireEvent(this, "hass-navigate", { path: navigationPath });
  }

  _openConfiguredUrl(urlValue, newTab = false) {
    const url = window.NodaliaUtils?.sanitizeActionUrl?.(urlValue, { allowRelative: true }) || "";
    if (!url) {
      return;
    }
    if (newTab) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (/^(?:https?:)?\/\//i.test(url)) {
      window.open(url, "_self", "noopener,noreferrer");
      return;
    }
    window.history.pushState(null, "", url);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  _isServiceAllowed(serviceValue) {
    const security = this._config?.security || {};
    if (security.strict_service_actions === false) {
      return true;
    }
    const normalizedService = String(serviceValue || "").trim().toLowerCase();
    if (!normalizedService || !normalizedService.includes(".")) {
      return false;
    }
    const [domain] = normalizedService.split(".");
    const domains = Array.isArray(security.allowed_service_domains)
      ? security.allowed_service_domains.map(item => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    const services = Array.isArray(security.allowed_services)
      ? security.allowed_services.map(item => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    if (!domains.length && !services.length) {
      return false;
    }
    return services.includes(normalizedService) || domains.includes(domain);
  }

  _callConfiguredService(serviceValue, rawData = "", rawTarget = "", fallbackEntityId = "") {
    if (!this._hass || !serviceValue) {
      return;
    }
    if (!this._isServiceAllowed(serviceValue)) {
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Camera Card", serviceValue);
      return;
    }
    const [domain, service] = String(serviceValue).split(".");
    if (!domain || !service) {
      return;
    }
    const payload = parseServiceData(rawData);
    const target = parseServiceData(rawTarget);
    const hasExplicitTarget = Object.keys(target).length > 0;
    const entityId = fallbackEntityId || this._config?.entity;
    if (entityId && payload.entity_id === undefined && !hasExplicitTarget) {
      payload.entity_id = entityId;
    }
    const invoke = window.NodaliaUtils?.invokeHomeAssistantService?.bind(window.NodaliaUtils)
      || ((host, hass, svcDomain, svc, data, svcTarget) => Promise.resolve(
        svcTarget != null
          ? hass?.callService?.(svcDomain, svc, data, svcTarget)
          : hass?.callService?.(svcDomain, svc, data),
      ));
    invoke(this, this._hass, domain, service, payload, hasExplicitTarget ? target : null);
  }

  _performTapAction() {
    const action = normalizeTextKey(this._config?.tap_action || "more-info");
    switch (action) {
      case "none":
        return;
      case "toggle":
        this._openExpanded();
        return;
      case "more-info":
        this._openMoreInfo();
        return;
      case "service":
        this._callConfiguredService(
          this._config?.tap_service,
          this._config?.tap_service_data,
          this._config?.tap_service_target,
        );
        return;
      case "url":
        this._openConfiguredUrl(this._config?.tap_url, this._config?.tap_new_tab === true);
        return;
      case "navigate":
        this._navigateToPath(this._config?.navigation_path || this._config?.tap_url);
        return;
      case "auto":
      default:
        this._openMoreInfo();
    }
  }

  _performHoldAction() {
    const action = normalizeTextKey(this._config?.hold_action || "none");
    switch (action) {
      case "toggle":
        this._openExpanded();
        return;
      case "more-info":
        this._openMoreInfo();
        return;
      case "service":
        this._callConfiguredService(
          this._config?.hold_service,
          this._config?.hold_service_data,
          this._config?.hold_service_target,
        );
        return;
      case "url":
        this._openConfiguredUrl(this._config?.hold_url, this._config?.hold_new_tab === true);
        return;
      case "navigate":
        this._navigateToPath(this._config?.hold_navigation_path || this._config?.hold_url);
        return;
      case "auto":
      case "none":
      default:
        return;
    }
  }

  _openExpanded(entityId = this._config?.entity) {
    if (this._expandedOpen) {
      return;
    }
    this._expandedEntityId = String(entityId || this._config?.entity || "").trim();
    this._expandedOpen = true;
    this._lastRenderSignature = "";
    this._render();
  }

  _closeExpanded() {
    if (!this._expandedOpen) {
      return;
    }
    this._expandedOpen = false;
    this._expandedEntityId = "";
    this._lastRenderSignature = "";
    this._render();
  }

  _performExpandedAction(actionConfig) {
    if (!actionConfig) {
      return;
    }
    const action = normalizeTextKey(actionConfig.tap_action || "toggle");
    const entityId = actionConfig.entity;
    switch (action) {
      case "none":
        return;
      case "toggle":
        if (entityId && this._hass?.states?.[entityId]) {
          const domain = entityId.split(".")[0];
          this._callConfiguredService(`${domain}.toggle`, "", "", entityId);
        }
        return;
      case "more-info":
        this._openMoreInfo(entityId);
        return;
      case "service":
        this._callConfiguredService(
          actionConfig.tap_service,
          actionConfig.tap_service_data,
          actionConfig.tap_service_target,
          entityId,
        );
        return;
      case "url":
        this._openConfiguredUrl(actionConfig.tap_url, actionConfig.tap_new_tab === true);
        return;
      case "navigate":
        this._navigateToPath(actionConfig.navigation_path || actionConfig.tap_url);
        return;
      default:
        this._openMoreInfo(entityId);
    }
  }

  _onWindowKeyDown(event) {
    if (!this.isConnected || !this._expandedOpen) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this._closeExpanded();
    }
  }

  _onShadowClick(event) {
    const path = event.composedPath();
    const button = path.find(node => node instanceof HTMLElement && node.dataset?.cameraAction);
    if (!button) {
      return;
    }

    const action = button.dataset.cameraAction;
    if (action === "expand") {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._openExpanded(button.dataset.cameraEntity || this._config?.entity);
      return;
    }
    if (action === "close-expanded") {
      event.preventDefault();
      event.stopPropagation();
      this._closeExpanded();
      return;
    }
    if (action === "expanded-action") {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      const index = Number(button.dataset.actionIndex);
      const actions = Array.isArray(this._config?.expanded_actions) ? this._config.expanded_actions : [];
      if (Number.isInteger(index) && index >= 0 && index < actions.length) {
        this._performExpandedAction(actions[index]);
      }
      return;
    }
    if (action === "body") {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._performTapAction();
    }
  }

  _renderEmptyState() {
    return `
      <ha-card class="camera-card camera-card--empty">
        <div class="camera-card__empty-title">${escapeHtml(this._cameraUi("emptyTitle", "Nodalia Camera Card"))}</div>
        <div class="camera-card__empty-text">${escapeHtml(this._cameraUi("emptyBody", "Set `entity` to show this card."))}</div>
      </ha-card>
    `;
  }

  _renderPreviewMarkup(state, imageUrl, layout, entityId = this._config?.entity) {
    const unavailable = isUnavailableState(state);
    const imageFailed = imageUrl && this._failedImageUrls.has(imageUrl);
    const showImage = Boolean(imageUrl) && !unavailable && !imageFailed;
    const placeholderLabel = unavailable
      ? this._cameraUi("cameraUnavailable", "Camera unavailable")
      : this._cameraUi("openCamera", "Open camera");
    const title = this._getTitle(state, entityId);
    const previewAge = this._config?.show_preview_age === false ? "" : this._formatPreviewAge(state);

    return `
      <div class="camera-card__preview ${layout === "compact" ? "camera-card__preview--compact" : ""} ${layout === "security" ? "camera-card__preview--security" : ""}">
        ${showImage
          ? `<img class="camera-card__image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" data-camera-image="true" />`
          : `<div class="camera-card__placeholder" aria-hidden="true">
              <ha-icon icon="mdi:cctv"></ha-icon>
              <span>${escapeHtml(placeholderLabel)}</span>
            </div>`}
        <div class="camera-card__overlay"></div>
        ${showImage && previewAge ? `<span
          class="camera-card__preview-age"
          data-camera-preview-age
          data-camera-entity="${escapeHtml(entityId)}"
          aria-label="${escapeHtml(this._cameraUi("lastUpdated", "Last updated {time}", { time: previewAge }))}"
        >${escapeHtml(previewAge)}</span>` : ""}
        <button
          type="button"
          class="camera-card__expand"
          data-camera-action="expand"
          data-camera-entity="${escapeHtml(entityId)}"
          aria-label="${escapeHtml(this._cameraUi("expand", "Expand"))}"
          title="${escapeHtml(this._cameraUi("expand", "Expand"))}"
        >
          <ha-icon icon="mdi:arrow-expand"></ha-icon>
        </button>
      </div>
    `;
  }

  _renderMosaicMarkup(cameraIds, layout) {
    const count = cameraIds.length;
    const mosaicClass = count === 2 ? "camera-card__mosaic--two"
      : count === 3 ? "camera-card__mosaic--three"
        : count >= 4 ? "camera-card__mosaic--four" : "camera-card__mosaic--one";
    const cells = cameraIds.map((entityId, index) => {
      const state = this._getState(entityId);
      const imageUrl = this._getCameraImageUrl(state, entityId);
      const area = count === 3
        ? (index === 0 ? "main" : index === 1 ? "top" : "bottom")
        : count === 4
          ? (index === 0 ? "a" : index === 1 ? "b" : index === 2 ? "c" : "d")
          : "";
      return `
        <div class="camera-card__mosaic-cell ${area ? `camera-card__mosaic-cell--${area}` : ""}" data-camera-entity="${escapeHtml(entityId)}">
          ${this._renderPreviewMarkup(state, imageUrl, layout, entityId)}
        </div>
      `;
    }).join("");
    return `<div class="camera-card__mosaic ${mosaicClass}">${cells}</div>`;
  }

  _renderExpandedActionsMarkup() {
    const actions = Array.isArray(this._config?.expanded_actions) ? this._config.expanded_actions : [];
    if (!actions.length) {
      return "";
    }
    return `
      <div class="camera-card__expanded-actions">
        ${actions.map((action, index) => {
    const state = this._hass?.states?.[action.entity];
    const label = action.name || state?.attributes?.friendly_name || action.entity;
    const colorStyle = action.icon_color ? ` style="color:${escapeHtml(action.icon_color)};"` : "";
    return `
          <button
            type="button"
            class="camera-card__expanded-action"
            data-camera-action="expanded-action"
            data-action-index="${index}"
            aria-label="${escapeHtml(label)}"
          >
            <span class="camera-card__expanded-action-icon"${colorStyle}><ha-icon icon="${escapeHtml(action.icon)}"></ha-icon></span>
            <span class="camera-card__expanded-action-label">${escapeHtml(label)}</span>
          </button>
        `;
  }).join("")}
      </div>
    `;
  }

  _renderExpandedOverlay(state, imageUrl, entityId = this._expandedEntityId || this._config?.entity) {
    if (!this._expandedOpen) {
      return "";
    }

    const unavailable = isUnavailableState(state);
    const imageFailed = imageUrl && this._failedImageUrls.has(imageUrl);
    const showImage = Boolean(imageUrl) && !unavailable && !imageFailed;
    const title = this._getTitle(state, entityId);

    return `
      <div class="camera-card__expanded is-open" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <button type="button" class="camera-card__expanded-backdrop" data-camera-action="close-expanded" aria-label="${escapeHtml(this._cameraUi("close", "Close"))}"></button>
        <div class="camera-card__expanded-panel">
          <div class="camera-card__expanded-toolbar">
            <div class="camera-card__expanded-title">${escapeHtml(title)}</div>
            <button type="button" class="camera-card__expanded-close" data-camera-action="close-expanded" aria-label="${escapeHtml(this._cameraUi("close", "Close"))}">
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          <div class="camera-card__expanded-stage">
            ${showImage
              ? `<img class="camera-card__expanded-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" data-camera-image="true" />`
              : `<div class="camera-card__expanded-placeholder">
                  <ha-icon icon="mdi:cctv"></ha-icon>
                  <span>${escapeHtml(this._cameraUi("cameraUnavailable", "Camera unavailable"))}</span>
                </div>`}
          </div>
          ${this._renderExpandedActionsMarkup()}
        </div>
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    this._clearPreviewAgeTimer();

    const config = this._config || {};
    const cameraIds = this._getCameraIds();
    if (!cameraIds.length) {
      this.shadowRoot.innerHTML = window.NodaliaUtils?.renderCardEmptyStateDocument?.(
        this._renderEmptyState(),
        { card: (config || DEFAULT_CONFIG).styles?.card },
      ) ?? this._renderEmptyState();
      return;
    }

    const entityGuard = window.NodaliaUtils?.renderLovelaceEntityGuardCardHtml?.(
      this._hass,
      cameraIds[0],
      { cardClass: "camera-card" },
    );
    if (entityGuard) {
      this.shadowRoot.innerHTML = entityGuard;
      return;
    }

    const primaryEntity = cameraIds[0];
    const state = this._getState(primaryEntity);
    if (!state && !this._isMosaicLayout()) {
      this.shadowRoot.innerHTML = window.NodaliaUtils?.renderCardEmptyStateDocument?.(
        this._renderEmptyState(),
        { card: (config || DEFAULT_CONFIG).styles?.card },
      ) ?? this._renderEmptyState();
      return;
    }

    const styles = config.styles || DEFAULT_CONFIG.styles;
    const layout = normalizeTextKey(config.layout) || "live";
    const mosaicLayout = this._isMosaicLayout();
    const feedLayout = this._isFeedPresentation();
    const title = this._getTitle(state, primaryEntity);
    const stateLabel = config.show_state !== false ? this._translateState(state) : "";
    const imageUrl = this._getCameraImageUrl(state, primaryEntity);
    const chips = mosaicLayout ? [] : this._getStatusChips(state);
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const unavailable = state ? isUnavailableState(state) : false;
    const securityLayout = layout === "security";
    const animations = {
      enabled: config.animations?.enabled !== false,
      contentDuration: Number(config.animations?.content_duration) || DEFAULT_CONFIG.animations.content_duration,
      buttonBounceDuration: Number(config.animations?.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration,
    };
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const overlayStrength = clamp(Number(styles.preview?.overlay_strength) || DEFAULT_CONFIG.styles.preview.overlay_strength, 0.1, 0.8);
    const previewAspect = String(styles.preview?.aspect_ratio || DEFAULT_CONFIG.styles.preview.aspect_ratio);
    const previewMinHeight = String(styles.preview?.min_height || DEFAULT_CONFIG.styles.preview.min_height || "220px");
    const mosaicGap = String(styles.preview?.mosaic_gap || DEFAULT_CONFIG.styles.preview.mosaic_gap || "8px");
    const chipHeight = escapeHtml(String(styles.chip_height || DEFAULT_CONFIG.styles.chip_height || "24px"));
    const chipFontSize = escapeHtml(String(styles.chip_font_size || DEFAULT_CONFIG.styles.chip_font_size || "11px"));
    const chipPadding = escapeHtml(String(styles.chip_padding || DEFAULT_CONFIG.styles.chip_padding || "0 9px"));
    const effectivePadding = feedLayout ? "0" : (styles.card.padding || DEFAULT_CONFIG.styles.card.padding);
    const effectiveGap = feedLayout ? "0" : (styles.card.gap || DEFAULT_CONFIG.styles.card.gap);
    const previewRadius = feedLayout
      ? "0"
      : escapeHtml(String(styles.preview?.border_radius || DEFAULT_CONFIG.styles.preview.border_radius || "18px"));
    const cardBackground = unavailable
      ? styles.card.background
      : securityLayout
        ? `linear-gradient(180deg, color-mix(in srgb, #ff4d6d 10%, ${styles.card.background}) 0%, ${styles.card.background} 100%)`
        : styles.card.background;
    const cardBorder = securityLayout && !unavailable
      ? "1px solid color-mix(in srgb, #ff4d6d 28%, var(--divider-color))"
      : styles.card.border;
    const showHeader = config.show_name !== false || stateLabel;
    const expandedEntity = this._expandedEntityId || primaryEntity;
    const expandedState = this._getState(expandedEntity);
    const expandedImageUrl = this._getCameraImageUrl(expandedState, expandedEntity);
    const previewMarkup = mosaicLayout
      ? this._renderMosaicMarkup(cameraIds, layout)
      : this._renderPreviewMarkup(state, imageUrl, layout, primaryEntity);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --camera-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          display: block;
        }

        * { box-sizing: border-box; }

        ha-card {
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          color: var(--primary-text-color);
          isolation: isolate;
          overflow: hidden;
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

        .camera-card__content {
          display: grid;
          gap: ${effectiveGap};
          padding: ${effectivePadding};
          position: relative;
          z-index: 1;
        }

        .camera-card__content--entering {
          animation: camera-card-fade-up calc(var(--camera-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .camera-card__preview {
          aspect-ratio: ${previewAspect};
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: ${previewRadius};
          min-height: ${previewMinHeight};
          overflow: hidden;
          position: relative;
        }

        .camera-card--feed .camera-card__preview {
          border-radius: 0;
        }

        .camera-card--feed ha-card::before {
          display: none;
        }

        .camera-card--feed .camera-card__overlay {
          opacity: 0.55;
        }

        .camera-card__mosaic {
          display: grid;
          gap: ${mosaicGap};
          min-height: ${previewMinHeight};
          width: 100%;
        }

        .camera-card__mosaic--one {
          grid-template-columns: 1fr;
        }

        .camera-card__mosaic--two {
          grid-template-columns: 1fr 1fr;
        }

        .camera-card__mosaic--three {
          grid-template-areas:
            "main top"
            "main bottom";
          grid-template-columns: 2fr 1fr;
          grid-template-rows: 1fr 1fr;
        }

        .camera-card__mosaic--four {
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
        }

        .camera-card__mosaic-cell {
          min-height: 0;
          position: relative;
        }

        .camera-card__mosaic-cell .camera-card__preview {
          aspect-ratio: auto;
          height: 100%;
          min-height: ${mosaicLayout && cameraIds.length > 1 ? "106px" : previewMinHeight};
        }

        .camera-card__mosaic-cell--main { grid-area: main; }
        .camera-card__mosaic-cell--top { grid-area: top; }
        .camera-card__mosaic-cell--bottom { grid-area: bottom; }

        .camera-card__preview--compact {
          aspect-ratio: 4 / 3;
        }

        .camera-card__preview--security {
          box-shadow: inset 0 0 0 1px color-mix(in srgb, #ff4d6d 18%, transparent);
        }

        .camera-card__image,
        .camera-card__placeholder,
        .camera-card__overlay,
        .camera-card__expand {
          inset: 0;
          position: absolute;
        }

        .camera-card__image {
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .camera-card__placeholder,
        .camera-card__expanded-placeholder {
          align-items: center;
          color: color-mix(in srgb, var(--primary-text-color) 72%, transparent);
          display: flex;
          flex-direction: column;
          gap: 8px;
          justify-content: center;
          text-align: center;
        }

        .camera-card__placeholder ha-icon,
        .camera-card__expanded-placeholder ha-icon {
          --mdc-icon-size: 42px;
          opacity: 0.82;
        }

        .camera-card__overlay {
          background: linear-gradient(180deg, rgba(0, 0, 0, ${overlayStrength * 0.35}) 0%, rgba(0, 0, 0, ${overlayStrength}) 100%);
          pointer-events: none;
        }

        .camera-card__preview-age {
          backdrop-filter: blur(10px) saturate(1.08);
          -webkit-backdrop-filter: blur(10px) saturate(1.08);
          background: rgba(0, 0, 0, 0.34);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          bottom: 12px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 8px 20px rgba(0, 0, 0, 0.2);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          left: 12px;
          line-height: 1;
          max-width: calc(100% - 68px);
          overflow: hidden;
          padding: 5px 9px;
          pointer-events: none;
          position: absolute;
          text-overflow: ellipsis;
          white-space: nowrap;
          z-index: 2;
        }

        .camera-card__expand {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 8%, rgba(0, 0, 0, 0.32));
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          bottom: 12px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent), 0 10px 24px rgba(0, 0, 0, 0.18);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: 38px;
          justify-content: center;
          left: auto;
          margin: 0;
          padding: 0;
          position: absolute;
          right: 12px;
          top: auto;
          transition: transform 150ms ease, box-shadow 180ms ease;
          width: 38px;
        }

        .camera-card__expand:active {
          transform: scale(0.96);
        }

        .camera-card__header {
          cursor: pointer;
          display: grid;
          gap: 4px;
          min-width: 0;
          padding: ${feedLayout ? "12px 14px 0" : "0"};
        }

        .camera-card__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: ${feedLayout ? "0 14px 12px" : "0"};
        }

        .camera-card__chip {
          align-items: center;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          display: inline-flex;
          font-size: ${chipFontSize};
          font-weight: 600;
          line-height: 1;
          min-height: ${chipHeight};
          padding: ${chipPadding};
        }

        .camera-card__title {
          font-size: ${styles.title_size};
          font-weight: 700;
          line-height: 1.2;
        }

        .camera-card__state {
          color: var(--secondary-text-color);
          font-size: ${styles.subtitle_size};
        }

        .camera-card__chip--live {
          background: color-mix(in srgb, var(--info-color, #71c0ff) 18%, transparent);
          color: var(--info-color, #71c0ff);
        }

        .camera-card__chip--snapshot {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          color: var(--primary-text-color);
        }

        .camera-card__chip--recording {
          background: color-mix(in srgb, #ff4d6d 18%, transparent);
          color: #ff4d6d;
        }

        .camera-card__chip--offline {
          background: color-mix(in srgb, var(--disabled-text-color, #808080) 16%, transparent);
          color: var(--disabled-text-color, #808080);
        }

        .camera-card__chip--meta {
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          color: var(--secondary-text-color);
          text-transform: none;
        }

        .camera-card__expanded {
          display: none;
          inset: 0;
          position: fixed;
          z-index: 30;
        }

        .camera-card__expanded.is-open {
          display: block;
        }

        .camera-card__expanded-backdrop {
          background: rgba(0, 0, 0, 0.62);
          border: 0;
          cursor: pointer;
          height: 100%;
          inset: 0;
          margin: 0;
          padding: 0;
          position: absolute;
          width: 100%;
        }

        .camera-card__expanded-panel {
          background: var(--ha-card-background, #1c1c1c);
          border: 1px solid var(--divider-color);
          border-radius: 24px;
          box-shadow: var(--ha-card-box-shadow, 0 18px 48px rgba(0, 0, 0, 0.35));
          display: grid;
          gap: 12px;
          inset: auto;
          left: 50%;
          max-height: min(88vh, 920px);
          max-width: min(96vw, 1080px);
          overflow: hidden;
          padding: 14px;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: min(96vw, 1080px);
        }

        .camera-card__expanded-toolbar {
          align-items: center;
          display: flex;
          gap: 12px;
          justify-content: space-between;
        }

        .camera-card__expanded-title {
          font-size: 16px;
          font-weight: 700;
          min-width: 0;
        }

        .camera-card__expanded-close {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 0;
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: 36px;
          justify-content: center;
          width: 36px;
        }

        .camera-card__expanded-stage {
          aspect-ratio: 16 / 9;
          background: #000;
          border-radius: 18px;
          overflow: hidden;
          position: relative;
        }

        .camera-card__expanded-image {
          height: 100%;
          object-fit: contain;
          width: 100%;
        }

        .camera-card__expanded-actions {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        }

        .camera-card__expanded-action {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          border-radius: 16px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: grid;
          gap: 8px;
          justify-items: center;
          min-height: 84px;
          padding: 12px;
        }

        .camera-card__expanded-action-icon ha-icon {
          --mdc-icon-size: 28px;
        }

        .camera-card__expanded-action-label {
          font-size: 12px;
          font-weight: 700;
          line-height: 1.2;
          text-align: center;
        }

        @keyframes camera-card-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 720px) {
          .camera-card__expanded-panel {
            border-radius: 18px 18px 0 0;
            bottom: 0;
            max-height: 92vh;
            top: auto;
            transform: translateX(-50%);
            width: 100vw;
          }
        }
      </style>
      <ha-card class="camera-card camera-card--${escapeHtml(layout)} ${feedLayout ? "camera-card--feed" : ""}">
        <div class="camera-card__content ${shouldAnimateEntrance ? "camera-card__content--entering" : ""}" data-camera-action="body">
          ${previewMarkup}
          ${showHeader ? `
            <div class="camera-card__header" data-camera-action="body">
              ${config.show_name !== false ? `<div class="camera-card__title">${escapeHtml(title)}</div>` : ""}
              ${stateLabel ? `<div class="camera-card__state">${escapeHtml(stateLabel)}</div>` : ""}
            </div>
          ` : ""}
          ${chips.length ? `
            <div class="camera-card__chips">
              ${chips.map(chip => `
                <span class="camera-card__chip camera-card__chip--${escapeHtml(chip.tone)}">${escapeHtml(chip.label)}</span>
              `).join("")}
            </div>
          ` : ""}
        </div>
      </ha-card>
      ${this._renderExpandedOverlay(expandedState, expandedImageUrl, expandedEntity)}
    `;

    this.shadowRoot.querySelectorAll('img[data-camera-image="true"]').forEach(node => {
      if (!(node instanceof HTMLImageElement)) {
        return;
      }
      node.addEventListener("error", () => {
        const src = node.getAttribute("src");
        if (src) {
          this._failedImageUrls.add(src);
          this._lastRenderSignature = "";
          this._render();
        }
      }, { once: true });
    });

    if (shouldAnimateEntrance) {
      this._animateContentOnNextRender = false;
      window.NodaliaUtils?.scheduleDeferTimer?.(this, () => {}, animations.contentDuration + 80);
    }
    this._schedulePreviewAgeRefresh();
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCameraCard);
}

class NodaliaCameraCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showTapActionsSection = false;
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
  }

  _attachEditorShadowListeners() {
    if (this._editorShadowListenersAttached || !this.shadowRoot) {
      return;
    }
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this._editorShadowListenersAttached = true;
  }

  _detachEditorShadowListeners() {
    if (!this._editorShadowListenersAttached || !this.shadowRoot) {
      return;
    }
    this.shadowRoot.removeEventListener("input", this._onShadowInput);
    this.shadowRoot.removeEventListener("change", this._onShadowInput);
    this.shadowRoot.removeEventListener("value-changed", this._onShadowValueChanged);
    this.shadowRoot.removeEventListener("click", this._onShadowClick);
    this._editorShadowListenersAttached = false;
  }

  connectedCallback() {
    this._attachEditorShadowListeners();
    window.NodaliaUtils?.bindEditorDialogLayoutFix?.(this);
  }

  disconnectedCallback() {
    this._detachEditorShadowListeners();
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
    this._config = mergeConfig(DEFAULT_CONFIG, config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._render();
    this._restoreFocusState(focusState);
  }

  _editorLabel(key) {
    return window.NodaliaI18n?.editorStr?.(this._hass, this._config?.language ?? "auto", key) || key;
  }

  _getEntityOptionsSignature(hass = this._hass) {
    return window.NodaliaUtils.editorFilteredStatesSignature(
      hass,
      this._config?.language,
      id => id.startsWith("camera."),
    );
  }

  _captureFocusState() {
    const active = this.shadowRoot?.activeElement;
    if (!(active instanceof HTMLElement)) {
      return null;
    }
    return {
      field: active.dataset?.field || "",
      selectionStart: active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
        ? active.selectionStart
        : null,
      selectionEnd: active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
        ? active.selectionEnd
        : null,
    };
  }

  _restoreFocusState(focusState) {
    if (!focusState?.field) {
      return;
    }
    const node = this.shadowRoot?.querySelector(`[data-field="${focusState.field}"]`);
    if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement)) {
      return;
    }
    node.focus();
    if (typeof focusState.selectionStart === "number" && typeof focusState.selectionEnd === "number") {
      node.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
    }
  }

  _emitConfig(reRender = false) {
    const outgoing = stripEqualToDefaults(normalizeConfig(this._config));
    fireEvent(this, "config-changed", {
      config: outgoing,
    });
    if (reRender) {
      this._render();
    }
  }

  _editorCameras() {
    if (Array.isArray(this._config?.cameras) && this._config.cameras.length) {
      return this._config.cameras.map(item => String(item ?? "").trim());
    }
    const entity = String(this._config?.entity ?? "").trim();
    return entity ? [entity] : [];
  }

  _onShadowInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.dataset?.field) {
      return;
    }
    const field = target.dataset.field;
    const value = target instanceof HTMLInputElement && target.type === "checkbox"
      ? target.checked
      : target.value;
    setByPath(this._config, field, value);
    if (field === "entity" && value) {
      if (!Array.isArray(this._config.cameras) || !this._config.cameras.length) {
        this._config.cameras = [value];
      } else {
        this._config.cameras[0] = value;
      }
    }
    this._emitConfig(field === "tap_action" || field === "hold_action" || field.includes("tap_action"));
  }

  _onShadowValueChanged(event) {
    const host = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.field);
    if (!host?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    const detailValue = event.detail?.value ?? "";
    setByPath(this._config, host.dataset.field, String(detailValue || "").trim());
    if (host.dataset.field === "entity" && detailValue) {
      if (!Array.isArray(this._config.cameras) || !this._config.cameras.length) {
        this._config.cameras = [detailValue];
      } else {
        this._config.cameras[0] = detailValue;
      }
    }
    this._emitConfig(false);
  }

  _onShadowClick(event) {
    const button = event.composedPath().find(node => node instanceof HTMLButtonElement && node.dataset?.editorAction);
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.editorAction;
      const index = Number(button.dataset.index);
      if (action === "add-camera") {
        if (!Array.isArray(this._config.cameras)) {
          this._config.cameras = this._editorCameras();
        }
        if (this._config.cameras.length < MAX_CAMERAS) {
          this._config.cameras.push("");
          this._emitConfig(true);
        }
        return;
      }
      if (action === "remove-camera" && Number.isInteger(index)) {
        if (!Array.isArray(this._config.cameras)) {
          this._config.cameras = this._editorCameras();
        }
        this._config.cameras.splice(index, 1);
        this._config.entity = this._config.cameras[0] || "";
        this._emitConfig(true);
        return;
      }
      if (action === "add-expanded-action") {
        if (!Array.isArray(this._config.expanded_actions)) {
          this._config.expanded_actions = [];
        }
        this._config.expanded_actions.push({
          entity: "",
          name: "",
          icon: "mdi:gesture-tap",
          tap_action: "toggle",
        });
        this._emitConfig(true);
        return;
      }
      if (action === "remove-expanded-action" && Number.isInteger(index)) {
        if (!Array.isArray(this._config.expanded_actions)) {
          this._config.expanded_actions = [];
        }
        this._config.expanded_actions.splice(index, 1);
        this._emitConfig(true);
      }
      return;
    }

    const toggleButton = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.editorToggle);
    if (!toggleButton) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (toggleButton.dataset.editorToggle === "tap_actions") {
      this._showTapActionsSection = !this._showTapActionsSection;
      this._render();
    }
  }

  _renderTextareaField(label, field, value, options = {}) {
    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(this._editorLabel(label))}</span>
        <textarea data-field="${escapeHtml(field)}">${escapeHtml(value ?? "")}</textarea>
      </label>
    `;
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input data-field="${escapeHtml(field)}" value="${escapeHtml(value ?? "")}" placeholder="${escapeHtml(options.placeholder || "")}" />
      </label>
    `;
  }

  _renderSelectField(label, field, value, options) {
    return `
      <label class="editor-field">
        <span>${escapeHtml(this._editorLabel(label))}</span>
        <select data-field="${escapeHtml(field)}">
          ${(options || []).map(option => `
            <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>
              ${escapeHtml(this._editorLabel(option.label))}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    return `
      <label class="editor-toggle">
        <input type="checkbox" data-field="${escapeHtml(field)}" ${checked ? "checked" : ""} />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(this._editorLabel(label))}</span>
      </label>
    `;
  }

  _renderCameraEntityField(label, field, value, domains = "camera") {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <div class="editor-control-host" data-mounted-control="camera-entity" data-field="${escapeHtml(field)}" data-domains="${escapeHtml(domains)}" data-value="${escapeHtml(value || "")}"></div>
      </label>
    `;
  }

  _mountCameraEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }
    if (host.querySelector("ha-entity-picker")) {
      return;
    }
    const field = host.dataset.field || "entity";
    const value = getByPath(this._config, field) || "";
    const domains = String(host.dataset.domains || "camera").split(",").filter(Boolean);
    const picker = document.createElement("ha-entity-picker");
    picker.dataset.field = field;
    picker.hass = this._hass;
    picker.value = value;
    picker.includeDomains = domains.length ? domains : ["camera"];
    picker.allowCustomEntity = true;
    host.replaceChildren(picker);
  }

  _renderCameraListSection(config) {
    const cameras = this._editorCameras();
    const rows = cameras.length ? cameras : [String(config.entity || "")];
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div>
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.camera.cameras_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.cameras_section_hint"))}</div>
          </div>
          <button type="button" data-editor-action="add-camera" ${rows.length >= MAX_CAMERAS ? "disabled" : ""}>
            ${escapeHtml(this._editorLabel("ed.camera.add_camera"))}
          </button>
        </div>
        <div class="editor-list">
          ${rows.map((cameraId, index) => `
            <div class="editor-card">
              <div class="editor-card__header">
                <span>${escapeHtml(this._editorLabel("ed.camera.camera_item"))} ${index + 1}</span>
                <button type="button" class="danger" data-editor-action="remove-camera" data-index="${index}">
                  ${escapeHtml(this._editorLabel("ed.camera.remove_camera"))}
                </button>
              </div>
              ${this._renderCameraEntityField("ed.camera.select_entity", `cameras.${index}`, cameraId)}
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  _renderExpandedActionsSection(config) {
    const actions = Array.isArray(config.expanded_actions) ? config.expanded_actions : [];
    return `
      <section class="editor-section">
        <div class="editor-section__header">
          <div>
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.camera.expanded_actions_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.expanded_actions_section_hint"))}</div>
          </div>
          <button type="button" data-editor-action="add-expanded-action">
            ${escapeHtml(this._editorLabel("ed.camera.add_expanded_action"))}
          </button>
        </div>
        <div class="editor-list">
          ${actions.length ? actions.map((action, index) => `
            <div class="editor-card">
              <div class="editor-card__header">
                <span>${escapeHtml(this._editorLabel("ed.camera.expanded_action_item"))} ${index + 1}</span>
                <button type="button" class="danger" data-editor-action="remove-expanded-action" data-index="${index}">
                  ${escapeHtml(this._editorLabel("ed.camera.remove_expanded_action"))}
                </button>
              </div>
              <div class="editor-grid editor-grid--stacked">
                ${this._renderCameraEntityField("ed.camera.expanded_action_entity", `expanded_actions.${index}.entity`, action.entity, "light,cover,lock,switch,input_boolean")}
                ${this._renderTextField("ed.camera.expanded_action_name", `expanded_actions.${index}.name`, action.name, { fullWidth: true })}
                ${this._renderTextField("ed.camera.expanded_action_icon", `expanded_actions.${index}.icon`, action.icon, { placeholder: "mdi:lightbulb" })}
                ${this._renderSelectField("ed.camera.expanded_action_tap", `expanded_actions.${index}.tap_action`, action.tap_action || "toggle", [
    { value: "toggle", label: "ed.entity.tap_toggle" },
    { value: "more-info", label: "ed.entity.tap_more_info" },
    { value: "service", label: "ed.entity.tap_service" },
  ])}
                ${String(action.tap_action) === "service"
    ? this._renderTextField("ed.entity.tap_service_field", `expanded_actions.${index}.tap_service`, action.tap_service, { placeholder: "lock.open", fullWidth: true })
      + this._renderTextareaField("ed.entity.tap_service_data_json", `expanded_actions.${index}.tap_service_data`, action.tap_service_data, { placeholder: "{}" })
    : ""}
              </div>
            </div>
          `).join("") : `<div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.expanded_actions_empty"))}</div>`}
        </div>
      </section>
    `;
  }

  _render() {
    const config = this._config || mergeConfig(DEFAULT_CONFIG, {});
    const tapAction = String(config.tap_action || "more-info");
    const holdAction = String(config.hold_action || "none");

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
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
        .editor-section__header { align-items: start; display: flex; gap: 12px; justify-content: space-between; }
        .editor-section__title { font-size: 15px; font-weight: 700; }
        .editor-section__hint { color: var(--secondary-text-color); font-size: 12px; line-height: 1.45; }
        .editor-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .editor-grid--stacked, .editor-field--full { grid-column: 1 / -1; }
        .editor-field, .editor-toggle { display: grid; gap: 6px; min-width: 0; }
        .editor-field > span, .editor-toggle > span:not(.editor-toggle__switch) {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 600;
        }
        .editor-field input, .editor-field select, .editor-field textarea {
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
        .editor-field textarea { min-height: 76px; resize: vertical; }
        .editor-control-host, .editor-control-host > * { display: block; width: 100%; }
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
        .editor-section__actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .editor-section__header button,
        .editor-card__header button {
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
        .editor-section__header button.danger,
        .editor-card__header button.danger { color: var(--error-color); }
        .editor-section__header button:disabled { cursor: default; opacity: 0.45; }
        .editor-list { display: grid; gap: 12px; }
        .editor-card {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 14px;
          display: grid;
          gap: 12px;
          padding: 12px;
        }
        .editor-card__header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }
        @media (max-width: 640px) { .editor-grid { grid-template-columns: 1fr; } }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div>
              <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.camera.general_section_title"))}</div>
              <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.camera.general_section_hint"))}</div>
            </div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderCameraEntityField("ed.camera.select_entity", "entity", config.entity)}
            ${this._renderSelectField("ed.camera.presentation", "presentation", config.presentation || "feed", [
              { value: "feed", label: "ed.camera.presentation_feed" },
              { value: "card", label: "ed.camera.presentation_card" },
            ])}
            ${this._renderTextField("ed.camera.name_placeholder", "name", config.name, { placeholder: "Entrada", fullWidth: true })}
            ${this._renderSelectField("ed.camera.layout", "layout", config.layout, [
              { value: "live", label: "ed.camera.layout_live" },
              { value: "snapshot", label: "ed.camera.layout_snapshot" },
              { value: "compact", label: "ed.camera.layout_compact" },
              { value: "security", label: "ed.camera.layout_security" },
              { value: "mosaic", label: "ed.camera.layout_mosaic" },
            ])}
            ${this._renderCheckboxField("ed.camera.show_name", "show_name", config.show_name !== false)}
            ${this._renderCheckboxField("ed.camera.show_state", "show_state", config.show_state !== false)}
            ${this._renderCheckboxField("ed.camera.show_status_chips", "show_status_chips", config.show_status_chips !== false)}
            ${this._renderCheckboxField("ed.camera.show_last_changed", "show_last_changed", config.show_last_changed !== false)}
            ${this._renderCheckboxField("ed.camera.show_preview_age", "show_preview_age", config.show_preview_age !== false)}
          </div>
        </section>
        ${this._renderCameraListSection(config)}
        ${this._renderExpandedActionsSection(config)}
        <section class="editor-section">
          <div class="editor-section__header">
            <div>
              <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.light.tap_actions_section_title"))}</div>
              <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.light.tap_actions_section_hint"))}</div>
            </div>
            <div class="editor-section__actions">
              ${window.NodaliaUtils?.renderEditorCollapsibleToggleHtml?.({
                toggleId: "tap_actions",
                expanded: this._showTapActionsSection === true,
                showLabel: this._editorLabel("ed.shared.show_tap_action_settings"),
                hideLabel: this._editorLabel("ed.shared.hide_tap_action_settings"),
                escapeHtml,
              }) || ""}
            </div>
          </div>
          ${this._showTapActionsSection ? `
            <div class="editor-grid editor-grid--stacked">
              ${this._renderSelectField("ed.light.card_tap_action", "tap_action", tapAction, [
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "none", label: "ed.entity.tap_none" },
                { value: "navigate", label: "ed.entity.tap_navigate" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
              ])}
              ${tapAction === "service" ? this._renderTextField("ed.entity.tap_service_field", "tap_service", config.tap_service, { placeholder: "camera.turn_on", fullWidth: true }) + this._renderTextareaField("ed.entity.tap_service_data_json", "tap_service_data", config.tap_service_data, { placeholder: "{}" }) : ""}
              ${tapAction === "url" ? this._renderTextField("ed.entity.tap_url_field", "tap_url", config.tap_url, { placeholder: "https://example.com", fullWidth: true }) + this._renderCheckboxField("ed.entity.tap_new_tab", "tap_new_tab", config.tap_new_tab === true) : ""}
              ${tapAction === "navigate" ? this._renderTextField("ed.entity.navigation_path", "navigation_path", config.navigation_path, { placeholder: "/lovelace/cameras", fullWidth: true }) : ""}
              <div class="editor-section__hint editor-field--full">${escapeHtml(this._editorLabel("ed.light.hold_actions_section_hint"))}</div>
              ${this._renderSelectField("ed.light.card_hold_action", "hold_action", holdAction, [
                { value: "none", label: "ed.entity.tap_none" },
                { value: "more-info", label: "ed.entity.tap_more_info" },
                { value: "navigate", label: "ed.entity.tap_navigate" },
                { value: "url", label: "ed.entity.tap_open_url" },
                { value: "service", label: "ed.entity.tap_service" },
                { value: "toggle", label: "ed.entity.tap_toggle" },
              ])}
              ${holdAction === "service" ? this._renderTextField("ed.entity.hold_service_field", "hold_service", config.hold_service, { placeholder: "camera.turn_off", fullWidth: true }) + this._renderTextareaField("ed.entity.hold_service_data_json", "hold_service_data", config.hold_service_data, { placeholder: "{}" }) : ""}
              ${holdAction === "url" ? this._renderTextField("ed.entity.hold_url_field", "hold_url", config.hold_url, { placeholder: "https://example.com", fullWidth: true }) + this._renderCheckboxField("ed.entity.hold_new_tab", "hold_new_tab", config.hold_new_tab === true) : ""}
              ${holdAction === "navigate" ? this._renderTextField("ed.entity.hold_navigation_path", "hold_navigation_path", config.hold_navigation_path, { placeholder: "/lovelace/cameras", fullWidth: true }) : ""}
            </div>
          ` : ""}
        </section>
      </div>
    `;

    this.shadowRoot.querySelectorAll('[data-mounted-control="camera-entity"]').forEach(node => {
      this._mountCameraEntityPicker(node);
    });
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCameraCardEditor);
}

(function registerNodaliaCameraCardPicker() {
  const hass = window.NodaliaI18n?.resolveHass?.(null);
  const lang = window.NodaliaI18n?.resolveLanguage?.(hass, "auto") ?? "en";
  const pack = window.NodaliaI18n?.strings?.(lang)?.cameraCard
    || window.NodaliaI18n?.strings?.("en")?.cameraCard
    || {};
  const description = String(pack.cardDescription || "Nodalia-style camera preview with status chips and expanded view.");
  window.NodaliaUtils.registerCustomCard({
    type: CARD_TAG,
    name: "Nodalia Camera Card",
    description,
    preview: true,
  });
})();

if (typeof globalThis !== "undefined") {
  globalThis.__NODALIA_CAMERA__ = {
    normalizeConfig,
    normalizeCameras,
    normalizeExpandedActions,
    formatRelativeAge,
    DEFAULT_CONFIG,
    LAYOUT_MODES,
    MAX_CAMERAS,
  };
}
