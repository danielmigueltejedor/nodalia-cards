const CARD_TAG = "nodalia-person-card";
const EDITOR_TAG = "nodalia-person-card-editor";
const CARD_VERSION = "2.0.1";
const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};

const DEFAULT_CONFIG = {
  entity: "",
  name: "",
  icon: "",
  tap_action: "more-info",
  tap_service: "",
  tap_service_data: "",
  tap_service_target: "",
  tap_url: "",
  navigation_path: "",
  tap_new_tab: false,
  tap_action_entity: "",
  hold_action: "none",
  hold_service: "",
  hold_service_data: "",
  hold_service_target: "",
  hold_url: "",
  hold_navigation_path: "",
  hold_new_tab: false,
  hold_action_entity: "",
  double_tap_action: "none",
  double_tap_service: "",
  double_tap_service_data: "",
  double_tap_service_target: "",
  double_tap_url: "",
  double_tap_navigation_path: "",
  double_tap_new_tab: false,
  double_tap_action_entity: "",
  language: "auto",
  show_name: true,
  show_state: true,
  show_zone_badge: true,
  use_entity_picture: true,
  use_zone_icon: true,
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
  security: {
    strict_service_actions: true,
    allowed_services: [],
    allowed_service_domains: [],
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid var(--divider-color)",
      border_radius: "var(--nodalia-card-border-radius, 28px)",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "12px",
      gap: "12px",
    },
    avatar: {
      size: "38px",
      background: "rgba(255, 255, 255, 0.06)",
      color: "var(--primary-text-color)",
    },
    badge: {
      size: "22px",
    },
    title_size: "12px",
    subtitle_size: "9px",
    chip_border_radius: "999px",
  },
};

const STUB_CONFIG = {
  entity: "person.ana",
  name: "Ana",
};

// Shared primitives are loaded by nodalia-cards core and inlined for standalone resources.
const {
  isObject,
  deepClone,
  mergeDeep: mergeConfig,
  compactConfig,
  isUnsafeConfigPathKey,
  setByPath,
  deleteByPath,
  getByPath,
  clamp,
  escapeHtml,
  escapeSelectorValue,
  fireEvent,
  normalizeTextKey,
} = window.NodaliaUtils;



function getStubEntityId(hass, domains = [], entities = [], entitiesFallback = []) {
  return window.NodaliaUtils.findStubEntityIds(hass, entities, entitiesFallback, domains, 1)[0] || "";
}

function applyStubEntity(config, hass, domains, entities = [], entitiesFallback = []) {
  const entityId = getStubEntityId(hass, domains, entities, entitiesFallback);
  if (!entityId) {
    return config;
  }

  config.entity = entityId;
  config.name = hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
  return config;
}









function parseSizeToPixels(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}



function resolveEditorColorValue(value) {
  const resolver = window.NodaliaBubbleContrast?.resolveEditorColorValue;
  if (typeof resolver === "function") {
    return resolver(value);
  }
  return String(value ?? "").trim();
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

  if (normalizedField.endsWith("avatar.background")) {
    return "color-mix(in srgb, var(--primary-text-color) 6%, transparent)";
  }

  if (normalizedField.endsWith("avatar.color")) {
    return "var(--primary-text-color)";
  }

  if (normalizedField.endsWith("background")) {
    return "var(--ha-card-background)";
  }

  return "var(--info-color, #71c0ff)";
}



function isUnavailableState(state) {
  return normalizeTextKey(state?.state) === "unavailable";
}

function normalizeConfig(rawConfig) {
  const raw = isObject(rawConfig) ? rawConfig : {};
  const config = mergeConfig(DEFAULT_CONFIG, raw);
  const actionDefinitions = [
    {
      prefix: "tap",
      rawValue: raw.tap_action ?? config.tap_action,
      fallback: "more-info",
      navigationKey: "navigation_path",
    },
    {
      prefix: "hold",
      rawValue: raw.hold_action ?? config.hold_action,
      fallback: "none",
      navigationKey: "hold_navigation_path",
    },
    {
      prefix: "double_tap",
      rawValue: raw.double_tap_action ?? config.double_tap_action,
      fallback: "none",
      navigationKey: "double_tap_navigation_path",
    },
  ];
  const applyAction = window.NodaliaUtils?.applyCardTapActionField?.bind(window.NodaliaUtils);
  if (typeof applyAction === "function") {
    actionDefinitions.forEach(({ prefix, rawValue, fallback, navigationKey }) => {
      applyAction(config, {
        actionKey: `${prefix}_action`,
        serviceKey: `${prefix}_service`,
        serviceDataKey: `${prefix}_service_data`,
        serviceTargetKey: `${prefix}_service_target`,
        urlKey: `${prefix}_url`,
        navigationKey,
        newTabKey: `${prefix}_new_tab`,
      }, rawValue, fallback);
    });
  }

  const allowedActions = new Set(["toggle", "more-info", "service", "navigate", "url", "none"]);
  const serializeActionObject = value => (
    isObject(value) ? JSON.stringify(value) : String(value ?? "").trim()
  );
  actionDefinitions.forEach(({ prefix, rawValue, fallback, navigationKey }) => {
    const actionKey = `${prefix}_action`;
    const normalizedAction = String(config[actionKey] ?? fallback).trim().toLowerCase();
    config[actionKey] = allowedActions.has(normalizedAction) ? normalizedAction : fallback;
    config[`${prefix}_service`] = String(config[`${prefix}_service`] ?? "").trim();
    config[`${prefix}_service_data`] = serializeActionObject(config[`${prefix}_service_data`]);
    config[`${prefix}_service_target`] = serializeActionObject(config[`${prefix}_service_target`]);
    config[`${prefix}_url`] = String(config[`${prefix}_url`] ?? "").trim();
    config[navigationKey] = String(config[navigationKey] ?? "").trim();
    config[`${prefix}_new_tab`] = config[`${prefix}_new_tab`] === true;
    const configuredEntity = isObject(rawValue) ? rawValue.entity : config[`${prefix}_action_entity`];
    config[`${prefix}_action_entity`] = String(configuredEntity ?? "").trim();
  });
  config.security = window.NodaliaUtils?.normalizeSecurityConfig?.(config.security, DEFAULT_CONFIG.security)
    ?? mergeConfig(DEFAULT_CONFIG.security, config.security || {});
  config.styles = window.NodaliaUtils?.sanitizeStyleTree?.(config.styles, DEFAULT_CONFIG.styles)
    ?? deepClone(DEFAULT_CONFIG.styles);
  return config;
}

class NodaliaPersonCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["person"], entities, entitiesFallback);
  }

  static getEntitySuggestion(hass, entityId) {
    return window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, { domains: ["person"] });
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._readyImageUrls = new Set();
    this._failedImageUrls = new Set();
    this._pendingImagePreloads = new Map();
    this._displayPictureUrl = "";
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowKeyDown = this._onShadowKeyDown.bind(this);
    this._detachHostHold = () => {};
    this._suppressNextPersonTap = false;
  }

  connectedCallback() {
    this._detachHostHold?.();
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => event.composedPath().some(
              node => node instanceof HTMLElement && node.dataset?.personAction === "primary",
            ) ? "body" : null,
            shouldBeginHold: () => this._canRunPersonAction("hold"),
            onHold: () => {
              this._triggerPrimaryPressAnimation();
              this._performPersonAction("hold");
            },
            markHoldConsumedClick: () => {
              this._suppressNextPersonTap = true;
              window.NodaliaUtils?.cancelCardZoneTap?.(this);
            },
          })
        : () => {};
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    this.shadowRoot?.addEventListener("keydown", this._onShadowKeyDown);
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
    this._suppressNextPersonTap = false;
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
    this.shadowRoot?.removeEventListener("keydown", this._onShadowKeyDown);
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._cachedZoneTarget = "";
    this._cachedZoneEntityId = "";
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;

    const nextSignature = this._getRenderSignature(hass);
    if (nextSignature && nextSignature === this._lastRenderSignature && this.shadowRoot?.innerHTML) {
      return;
    }

    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 2,
      min_columns: 2,
    };
  }

  _getState() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _getTitle(state) {
    const fallback = this._personUiCopy().defaultName;
    return this._config?.name || state?.attributes?.friendly_name || this._config?.entity || fallback;
  }

  _getPersonPicture(state) {
    if (this._config?.use_entity_picture === false) {
      return "";
    }

    return String(
      state?.attributes?.entity_picture_local
      || state?.attributes?.entity_picture
      || "",
    ).trim();
  }

  _isImageUrlReady(url) {
    return Boolean(url) && this._readyImageUrls.has(url);
  }

  _isImageUrlFailed(url) {
    return Boolean(url) && this._failedImageUrls.has(url);
  }

  _preloadImageUrl(url, onSettled = null) {
    if (!url) {
      return Promise.resolve(false);
    }

    if (this._isImageUrlReady(url)) {
      onSettled?.(true);
      return Promise.resolve(true);
    }

    if (this._isImageUrlFailed(url)) {
      onSettled?.(false);
      return Promise.resolve(false);
    }

    const existing = this._pendingImagePreloads.get(url);
    if (existing) {
      if (onSettled) {
        existing.then(onSettled);
      }
      return existing;
    }

    if (typeof Image === "undefined") {
      this._readyImageUrls.add(url);
      onSettled?.(true);
      return Promise.resolve(true);
    }

    const preloadPromise = new Promise(resolve => {
      const image = new Image();
      image.decoding = "async";

      const settle = loaded => {
        this._pendingImagePreloads.delete(url);
        if (loaded) {
          this._readyImageUrls.add(url);
          this._failedImageUrls.delete(url);
        } else {
          this._failedImageUrls.add(url);
        }
        resolve(loaded);
        onSettled?.(loaded);
      };

      image.onload = () => settle(true);
      image.onerror = () => settle(false);
      image.src = url;
    });

    this._pendingImagePreloads.set(url, preloadPromise);
    return preloadPromise;
  }

  _ensurePersonPictureReady(url) {
    if (!url) {
      this._displayPictureUrl = "";
      return true;
    }

    if (this._isImageUrlReady(url)) {
      this._displayPictureUrl = url;
      return true;
    }

    if (this._isImageUrlFailed(url)) {
      this._displayPictureUrl = "";
      return true;
    }

    this._preloadImageUrl(url, () => {
      const currentPicture = this._getPersonPicture(this._getState());
      if (currentPicture !== url) {
        return;
      }

      this._displayPictureUrl = this._isImageUrlReady(url) ? url : "";
      this._lastRenderSignature = "";
      this._render();
    });

    return false;
  }

  _getRenderablePersonPicture(state) {
    const desiredPicture = this._getPersonPicture(state);
    if (!desiredPicture) {
      this._displayPictureUrl = "";
      return "";
    }

    if (this._isImageUrlReady(desiredPicture)) {
      this._displayPictureUrl = desiredPicture;
      return desiredPicture;
    }

    if (this._isImageUrlFailed(desiredPicture)) {
      this._displayPictureUrl = "";
      return "";
    }

    return this._displayPictureUrl || "";
  }

  _getFallbackIcon(state) {
    return this._config?.icon || state?.attributes?.icon || "mdi:account";
  }

  _personStrings() {
    const NI = window.NodaliaI18n;
    if (!NI?.strings || !NI.resolveLanguage) {
      return {
        home: "Home",
        notHome: "Away",
        work: "Work",
        school: "School",
        unavailable: "Unavailable",
        unknown: "Unknown",
        locationUnknown: "Unknown location",
      };
    }
    const hass = NI.resolveHass?.(this._hass) ?? this._hass;
    const lang = NI.resolveLanguage(hass, this._config?.language ?? "auto");
    return NI.strings(lang).person || NI.strings("en").person || {};
  }

  _translateState(state) {
    const person = this._personStrings();
    const raw = String(state?.state || "").trim();
    const key = normalizeTextKey(raw);

    const NI = window.NodaliaI18n;
    if (NI?.translateEntityState && state && this._config?.entity) {
      const hass = NI.resolveHass?.(this._hass) ?? this._hass;
      const lang = NI.resolveLanguage(hass, this._config?.language ?? "auto");
      const translated = NI.translateEntityState(
        lang,
        { ...state, entity_id: state.entity_id || this._config.entity },
        2,
        (v, u, d) => `${v}${u}`,
        (v) => String(v),
        () => null,
      );
      if (translated && translated !== raw) {
        return translated;
      }
    }

    switch (key) {
      case "home":
      case "casa":
      case "en_casa":
        return person.home || "Home";
      case "not_home":
      case "away":
      case "fuera":
        return person.notHome || "Away";
      case "work":
      case "trabajo":
      case "office":
      case "oficina":
        return person.work || "Work";
      case "school":
      case "colegio":
      case "escuela":
        return person.school || "School";
      case "unavailable":
        return person.unavailable || "Unavailable";
      case "unknown":
        return person.unknown || "Unknown";
      default: {
        const zoneState = this._getMatchingZoneState(state);
        const zoneName = String(zoneState?.attributes?.friendly_name || "").trim();
        if (zoneName) {
          return zoneName;
        }
        return raw || person.locationUnknown || "Unknown location";
      }
    }
  }

  _getMatchingZoneState(state) {
    const target = normalizeTextKey(state?.state);
    if (!target || !this._hass?.states) {
      return null;
    }

    if (this._cachedZoneTarget === target) {
      if (!this._cachedZoneEntityId) {
        return null;
      }
      return this._hass.states[this._cachedZoneEntityId] || null;
    }

    const zoneEntry = Object.entries(this._hass.states).find(([entityId, entityState]) => {
      if (!entityId.startsWith("zone.")) {
        return false;
      }

      const objectId = entityId.split(".")[1] || "";
      const friendlyName = String(entityState?.attributes?.friendly_name || "").trim();

      return normalizeTextKey(objectId) === target || normalizeTextKey(friendlyName) === target;
    });

    this._cachedZoneTarget = target;
    this._cachedZoneEntityId = zoneEntry ? zoneEntry[0] : "";
    return zoneEntry?.[1] || null;
  }

  _getBadgeDescriptor(state) {
    if (this._config?.show_zone_badge === false) {
      return null;
    }

    if (isUnavailableState(state)) {
      return {
        icon: "mdi:help",
        color: "#ff9b4a",
      };
    }

    const key = normalizeTextKey(state?.state);

    switch (key) {
      case "home":
      case "casa":
      case "en_casa":
        return { icon: "mdi:home", color: "#67d26f" };
      case "not_home":
      case "away":
      case "fuera":
        return { icon: "mdi:home-export-outline", color: "#ff6b6b" };
      case "work":
      case "trabajo":
      case "office":
      case "oficina":
        return { icon: "mdi:briefcase", color: "#4dabf7" };
      case "school":
      case "colegio":
      case "escuela":
        return { icon: "mdi:school", color: "#8c7bff" };
      default:
        break;
    }

    const zoneState = this._getMatchingZoneState(state);
    if (this._config?.use_zone_icon !== false && zoneState?.attributes?.icon) {
      return {
        icon: zoneState.attributes.icon,
        color: "var(--info-color, #71c0ff)",
      };
    }

    if (String(state?.state || "").trim()) {
      return {
        icon: "mdi:map-marker",
        color: "var(--info-color, #71c0ff)",
      };
    }

    return null;
  }

  _getAccentColor(state) {
    return this._getBadgeDescriptor(state)?.color || "var(--info-color, #71c0ff)";
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    if (!entityId || !state) {
      return `empty:${this._config?.entity || ""}`;
    }

    const attrs = state.attributes || {};
    const zoneState = this._getMatchingZoneState(state);
    const joinParts = window.NodaliaRenderSignature?.joinParts;
    const values = [
      entityId,
      String(state.state || ""),
      String(attrs.friendly_name || this._config.name || ""),
      this._config.show_state !== false ? String(state.state || "") : "",
      String(attrs.entity_picture || ""),
      String(attrs.icon || this._config.icon || ""),
      String(state.state || ""),
      zoneState?.entity_id || "",
      zoneState?.attributes?.icon || "",
      this._config.show_state !== false,
      this._config.show_name !== false,
      this._config.show_zone_badge !== false,
      this._config.use_entity_picture !== false,
      this._config.use_zone_icon !== false,
      this._config.name || "",
      this._config.icon || "",
      this._config.tap_action || "",
      this._config.hold_action || "",
      this._config.double_tap_action || "",
      this._config.tap_service || "",
      this._config.hold_service || "",
      this._config.double_tap_service || "",
      this._config.navigation_path || "",
      this._config.hold_navigation_path || "",
      this._config.double_tap_navigation_path || "",
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "person:", values }]);
    }
    return values.join("::");
  }

  _personActionPrefix(kind = "tap") {
    return kind === "double" || kind === "double_tap" ? "double_tap" : kind === "hold" ? "hold" : "tap";
  }

  _personActionNavigationKey(prefix) {
    return prefix === "tap" ? "navigation_path" : `${prefix}_navigation_path`;
  }

  _personActionEntity(prefix) {
    return String(this._config?.[`${prefix}_action_entity`] || this._config?.entity || "").trim();
  }

  _canRunPersonAction(kind = "tap") {
    const prefix = this._personActionPrefix(kind);
    const fallback = prefix === "tap" ? "more-info" : "none";
    const action = String(this._config?.[`${prefix}_action`] || fallback).trim().toLowerCase();
    if (action === "none") {
      return false;
    }
    if (action === "service") {
      return Boolean(String(this._config?.[`${prefix}_service`] || "").trim());
    }
    if (action === "navigate") {
      return Boolean(String(this._config?.[this._personActionNavigationKey(prefix)] || "").trim());
    }
    if (action === "url") {
      return Boolean(String(this._config?.[`${prefix}_url`] || "").trim());
    }
    return Boolean(this._personActionEntity(prefix));
  }

  _canRunTapAction() {
    return this._canRunPersonAction("tap");
  }

  _canRunAnyPersonAction() {
    return ["tap", "hold", "double_tap"].some(kind => this._canRunPersonAction(kind));
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

    if (haptics.fallback_vibrate && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection);
    }
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
        140,
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

    const schedule = window.NodaliaUtils?.scheduleDeferTimer;
    const done = () => {
      if (!element.isConnected) {
        return;
      }
      element.classList.remove(className);
    };
    if (typeof schedule === "function") {
      schedule(this, done, animations.buttonBounceDuration + 40);
    } else {
      window.setTimeout(done, animations.buttonBounceDuration + 40);
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
      if (!this.isConnected) {
        return;
      }
      this._animateContentOnNextRender = false;
    }, safeDelay);
  }

  _parsePersonActionObject(value) {
    if (isObject(value)) {
      return deepClone(value);
    }
    const source = String(value || "").trim();
    if (!source) {
      return {};
    }
    try {
      const parsed = JSON.parse(source);
      return isObject(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  _isConfiguredPersonServiceAllowed(serviceValue) {
    const security = this._config?.security || DEFAULT_CONFIG.security;
    if (security.strict_service_actions === false) {
      return true;
    }
    const normalizedService = String(serviceValue || "").trim().toLowerCase();
    const separator = normalizedService.indexOf(".");
    if (separator <= 0 || separator >= normalizedService.length - 1) {
      return false;
    }
    const domain = normalizedService.slice(0, separator);
    const allowedServices = Array.isArray(security.allowed_services)
      ? security.allowed_services.map(item => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    const allowedDomains = Array.isArray(security.allowed_service_domains)
      ? security.allowed_service_domains.map(item => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    return allowedServices.includes(normalizedService) || allowedDomains.includes(domain);
  }

  _invokePersonService(domain, service, data = {}, target = null) {
    const invoke = window.NodaliaUtils?.invokeHomeAssistantService?.bind(window.NodaliaUtils);
    if (typeof invoke === "function") {
      return invoke(this, this._hass, domain, service, data, target);
    }
    return Promise.resolve(this._hass?.callService?.(domain, service, data, target || undefined));
  }

  _runConfiguredPersonService(prefix) {
    const serviceValue = String(this._config?.[`${prefix}_service`] || "").trim();
    const separator = serviceValue.indexOf(".");
    if (separator <= 0 || separator >= serviceValue.length - 1) {
      return;
    }
    if (!this._isConfiguredPersonServiceAllowed(serviceValue)) {
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Person Card", serviceValue);
      return;
    }
    const data = this._parsePersonActionObject(this._config?.[`${prefix}_service_data`]);
    const target = this._parsePersonActionObject(this._config?.[`${prefix}_service_target`]);
    void this._invokePersonService(
      serviceValue.slice(0, separator),
      serviceValue.slice(separator + 1),
      data,
      Object.keys(target).length ? target : null,
    );
  }

  _openPersonNavigation(value) {
    const path = window.NodaliaUtils?.sanitizeActionUrl?.(value, { allowRelative: true, allowHash: true }) || "";
    if (!path || path.includes("://")) {
      return;
    }

    if (this._hass?.navigate) {
      this._hass.navigate(path);
      return;
    }

    if (window?.history?.pushState) {
      window.history.pushState(null, "", path);
      window.dispatchEvent(new CustomEvent("location-changed", {
        detail: { replace: false },
      }));
      return;
    }

    fireEvent(this, "hass-navigate", { path });
  }

  _openPersonUrl(value, newTab = false) {
    const url = window.NodaliaUtils?.sanitizeActionUrl?.(value, { allowRelative: true, allowHash: true }) || "";
    if (!url) {
      return;
    }
    window.open(url, newTab ? "_blank" : "_self", "noopener,noreferrer");
  }

  _performPersonAction(kind = "tap") {
    const prefix = this._personActionPrefix(kind);
    if (!this._canRunPersonAction(prefix)) {
      return;
    }
    const fallback = prefix === "tap" ? "more-info" : "none";
    const action = String(this._config?.[`${prefix}_action`] || fallback).trim().toLowerCase();

    this._triggerHaptic();

    if (action === "more-info") {
      fireEvent(this, "hass-more-info", {
        entityId: this._personActionEntity(prefix),
      });
      return;
    }
    if (action === "toggle") {
      void this._invokePersonService("homeassistant", "toggle", {
        entity_id: this._personActionEntity(prefix),
      });
      return;
    }
    if (action === "service") {
      this._runConfiguredPersonService(prefix);
      return;
    }
    if (action === "navigate") {
      this._openPersonNavigation(this._config?.[this._personActionNavigationKey(prefix)]);
      return;
    }
    if (action === "url") {
      this._openPersonUrl(
        this._config?.[`${prefix}_url`],
        this._config?.[`${prefix}_new_tab`] === true,
      );
    }
  }

  _performTapAction() {
    this._performPersonAction("tap");
  }

  _triggerPrimaryPressAnimation() {
    this._triggerPressAnimation(this.shadowRoot?.querySelector(".person-card__content"));
    this._triggerPressAnimation(this.shadowRoot?.querySelector(".person-card__avatar"));
  }

  _onShadowClick(event) {
    const card = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.personAction === "primary");

    if (!card) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (this._suppressNextPersonTap) {
      this._suppressNextPersonTap = false;
      return;
    }

    const runTap = () => {
      if (!this._canRunPersonAction("tap")) {
        return;
      }
      this._triggerPrimaryPressAnimation();
      this._performPersonAction("tap");
    };
    const runDoubleTap = () => {
      if (!this._canRunPersonAction("double_tap")) {
        return;
      }
      this._triggerPrimaryPressAnimation();
      this._performPersonAction("double_tap");
    };

    if (this._canRunPersonAction("double_tap") && typeof window.NodaliaUtils?.scheduleCardZoneTap === "function") {
      window.NodaliaUtils.scheduleCardZoneTap(this, {
        zone: "body",
        onSingle: runTap,
        onDouble: runDoubleTap,
      });
      return;
    }
    runTap();
  }

  _onShadowKeyDown(event) {
    if (window.NodaliaUtils?.isKeyboardActivationEvent?.(event) !== true) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    window.NodaliaUtils?.cancelCardZoneTap?.(this);
    if (this._canRunPersonAction("tap")) {
      this._triggerPrimaryPressAnimation();
      this._performPersonAction("tap");
    }
  }

  _personUiCopy() {
    const person = this._personStrings();
    if (!person.emptyTitle && !person.emptyBody) {
      return {
        emptyTitle: "Nodalia Person Card",
        emptyBody: "Configure `entity` to show the card.",
        defaultName: person.defaultName || "Person",
      };
    }
    return {
      emptyTitle: person.emptyTitle || "Nodalia Person Card",
      emptyBody: person.emptyBody || "Configure `entity` to show the card.",
      defaultName: person.defaultName || "Person",
    };
  }

  _renderEmptyState() {
    const ui = this._personUiCopy();
    return `
      <ha-card class="person-card person-card--empty">
        <div class="person-card__empty-title">${escapeHtml(ui.emptyTitle)}</div>
        <div class="person-card__empty-text">${escapeHtml(ui.emptyBody)}</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || {};
    const entityGuard = window.NodaliaUtils?.renderLovelaceEntityGuardCardHtml?.(
      this._hass,
      config.entity,
      { cardClass: "person-card" },
    );
    if (entityGuard) {
      this._lastRenderSignature = `guard:${config.entity || ""}`;
      this.shadowRoot.innerHTML = entityGuard;
      return;
    }

    const state = this._getState();
    if (!state) {
      this._lastRenderSignature = `empty:${config.entity || ""}`;
      this.shadowRoot.innerHTML = window.NodaliaUtils?.renderCardEmptyStateDocument?.(
        this._renderEmptyState(),
        { card: (config || DEFAULT_CONFIG).styles?.card },
      ) ?? this._renderEmptyState();
      return;
    }

    const styles = config.styles || DEFAULT_CONFIG.styles;
    const configuredRows = Number(this._config?.grid_options?.rows);
    const singleRowLayout = Number.isFinite(configuredRows) && configuredRows <= 1;
    const title = this._getTitle(state);
    const showName = config.show_name !== false;
    const subtitle = config.show_state !== false ? this._translateState(state) : "";
    const desiredPicture = this._getPersonPicture(state);
    const pictureReady = !desiredPicture || this._ensurePersonPictureReady(desiredPicture);
    const picture = this._getRenderablePersonPicture(state);
    const fallbackIcon = this._getFallbackIcon(state);
    const badge = this._getBadgeDescriptor(state);
    const accentColor = this._getAccentColor(state);
    const canRunPrimaryAction = this._canRunAnyPersonAction();
    const singleRowPaddingY = singleRowLayout ? 4 : 12;
    const singleRowPaddingX = singleRowLayout ? 9 : 12;
    const avatarSizePx = Math.max(34, Math.min(parseSizeToPixels(styles.avatar.size, 38), singleRowLayout ? 38 : 68));
    const avatarSize = `${avatarSizePx}px`;
    const avatarTrackSize = `${avatarSizePx + (singleRowLayout ? 7 : 12)}px`;
    const badgeSize = `${Math.max(16, Math.min(parseSizeToPixels(styles.badge.size, 22), singleRowLayout ? 18 : 26))}px`;
    const effectiveTitleSize = `${Math.max(10, Math.min(parseSizeToPixels(styles.title_size, 12), singleRowLayout ? 10.5 : 14))}px`;
    const effectiveSubtitleSize = `${Math.max(9, Math.min(parseSizeToPixels(styles.subtitle_size, 9), singleRowLayout ? 9.5 : 13))}px`;
    const effectiveStateChipHeight = `${singleRowLayout ? 18 : 22}px`;
    const effectiveStateChipPadding = singleRowLayout ? "0 8px" : "0 10px";
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const effectiveGap = singleRowLayout ? "6px" : styles.card.gap;
    const effectivePadding = singleRowLayout ? `${singleRowPaddingY}px ${singleRowPaddingX}px` : styles.card.padding;
    const effectiveCardHeightPx = singleRowLayout ? Math.max(54, avatarSizePx + (singleRowPaddingY * 2)) : avatarSizePx + (singleRowPaddingY * 2);
    const effectiveContentMinHeight = `${Math.max(avatarSizePx, effectiveCardHeightPx - (singleRowPaddingY * 2))}px`;
    const isUnavailable = isUnavailableState(state);
    const cardBackground = isUnavailable
      ? styles.card.background
      : `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 7%, ${styles.card.background}) 56%, ${styles.card.background} 100%)`;
    const cardBorder = isUnavailable
      ? styles.card.border
      : `1px solid color-mix(in srgb, ${accentColor} 24%, var(--divider-color))`;
    const cardShadow = isUnavailable
      ? styles.card.box_shadow
      : `${styles.card.box_shadow}, 0 16px 32px color-mix(in srgb, ${accentColor} 10%, rgba(0, 0, 0, 0.18))`;
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const animateWithPicture = shouldAnimateEntrance && pictureReady;
    const avatarCentered = !showName;
    const showCopyBlock = showName || Boolean(subtitle);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --person-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --person-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
        }

        * {
          box-sizing: border-box;
        }

        [data-person-action="primary"]:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: -3px;
        }

        ha-card {
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          justify-content: center;
          min-height: 0;
          overflow: hidden;
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        ha-card::before {
          background: ${isUnavailable
            ? "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 4%, transparent), rgba(255, 255, 255, 0))"
            : `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 14%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)), rgba(255, 255, 255, 0))`};
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
          opacity: ${isUnavailable ? "0" : "1"};
          pointer-events: none;
          position: absolute;
          transition: opacity 180ms ease;
          z-index: 0;
        }

        .person-card__content {
          align-items: center;
          cursor: ${canRunPrimaryAction ? "pointer" : "default"};
          display: flex;
          flex: ${singleRowLayout ? "0 0 auto" : "1 1 auto"};
          flex-direction: row;
          gap: ${effectiveGap};
          height: ${singleRowLayout ? "auto" : "100%"};
          min-height: ${singleRowLayout ? "0" : effectiveContentMinHeight};
          min-width: 0;
          padding: ${effectivePadding};
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease;
          will-change: transform;
          z-index: 1;
        }

        .person-card--avatar-centered .person-card__content {
          justify-content: center;
          text-align: center;
        }

        .person-card__avatar-track {
          align-items: center;
          align-self: stretch;
          display: flex;
          flex: 0 0 ${avatarTrackSize};
          justify-content: center;
          min-height: 0;
          min-width: 0;
          width: ${avatarTrackSize};
        }

        .person-card__content--entering {
          animation: person-card-fade-up calc(var(--person-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .person-card__content.is-pressing {
          animation: person-card-content-bounce var(--person-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .person-card--single-row {
          min-height: ${effectiveCardHeightPx}px;
        }

        .person-card__avatar {
          align-items: center;
          flex-shrink: 0;
          background: ${styles.avatar.background};
          border: 1px solid color-mix(in srgb, ${accentColor} 16%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${styles.avatar.color};
          display: inline-flex;
          height: ${avatarSize};
          justify-content: center;
          overflow: visible;
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease, color 180ms ease;
          will-change: transform;
          width: ${avatarSize};
        }

        .person-card__avatar--entering {
          animation: person-card-bubble-bloom calc(var(--person-card-content-duration) * 0.92) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 40ms;
        }

        .person-card__avatar.is-pressing {
          animation: person-card-bubble-bounce var(--person-card-button-bounce-duration) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
        }

        .person-card__avatar img {
          border-radius: inherit;
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .person-card__avatar ha-icon {
          --mdc-icon-size: calc(${avatarSize} * 0.5);
        }

        .person-card__badge {
          align-items: center;
          background: var(--badge-color);
          border: none;
          border-radius: 999px;
          box-shadow:
            0 6px 14px rgba(0, 0, 0, 0.14),
            0 0 0 2px color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          color: #ffffff;
          display: inline-flex;
          height: ${badgeSize};
          justify-content: center;
          position: absolute;
          right: 0;
          top: 0;
          transform: translate(28%, -28%);
          width: ${badgeSize};
          z-index: 2;
        }

        .person-card--single-row .person-card__badge {
          transform: translate(20%, -14%);
        }

        .person-card__badge ha-icon {
          --mdc-icon-size: calc(${badgeSize} * 0.62);
          align-items: center;
          display: inline-flex;
          height: calc(${badgeSize} * 0.62);
          justify-content: center;
          width: calc(${badgeSize} * 0.62);
        }

        .person-card__copy {
          align-content: center;
          display: grid;
          flex: 1 1 auto;
          gap: ${singleRowLayout ? "4px" : "6px"};
          min-width: 0;
        }

        .person-card--avatar-centered .person-card__copy {
          align-items: center;
          justify-items: center;
          text-align: center;
        }

        .person-card__copy--entering {
          animation: person-card-fade-up calc(var(--person-card-content-duration) * 0.92) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 75ms;
        }

        .person-card__title {
          font-size: ${effectiveTitleSize};
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: ${singleRowLayout ? "1.02" : "1.12"};
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .person-card__chips {
          align-items: center;
          display: flex;
          flex-wrap: nowrap;
          gap: 6px;
          min-width: 0;
        }

        .person-card__chips--entering {
          animation: person-card-fade-up calc(var(--person-card-content-duration) * 0.94) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 110ms;
        }

        .person-card__state-chip {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 1px 1px rgba(0, 0, 0, 0.06);
          color: var(--primary-text-color);
          display: inline-flex;
          font-size: ${effectiveSubtitleSize};
          font-weight: 700;
          height: ${effectiveStateChipHeight};
          line-height: 1;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding: ${effectiveStateChipPadding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .person-card--empty {
          display: grid;
          gap: 8px;
          padding: 16px;
        }

        .person-card__empty-title {
          font-size: 15px;
          font-weight: 700;
        }

        .person-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }

        @keyframes person-card-content-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.02);
          }
          72% {
            transform: scale(1.008);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes person-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes person-card-bubble-bloom {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          58% {
            opacity: 1;
            transform: scale(1.04);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes person-card-bubble-bounce {
          0% {
            transform: scale(1);
          }
          48% {
            transform: scale(1.12);
          }
          72% {
            transform: scale(1.04);
          }
          100% {
            transform: scale(1);
          }
        }

        ${animations.enabled ? "" : `
        ha-card,
        .person-card,
        .person-card * {
          animation: none !important;
          transition: none !important;
        }
        `}
        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <ha-card class="person-card ${singleRowLayout ? "person-card--single-row" : ""} ${avatarCentered ? "person-card--avatar-centered" : ""}">
        <div class="person-card__content ${animateWithPicture ? "person-card__content--entering" : ""}" ${canRunPrimaryAction ? `data-person-action="primary" role="button" tabindex="0" aria-label="${escapeHtml(title)}"` : ""}>
          <div class="person-card__avatar-track">
            <div class="person-card__avatar ${animateWithPicture ? "person-card__avatar--entering" : ""}">
            ${
              picture
                ? `<img src="${escapeHtml(picture)}" alt="${escapeHtml(title)}" />`
                : `<ha-icon icon="${escapeHtml(fallbackIcon)}"></ha-icon>`
            }
            ${
              badge
                ? `<span class="person-card__badge" style="--badge-color:${escapeHtml(badge.color)};"><ha-icon icon="${escapeHtml(badge.icon)}"></ha-icon></span>`
                : ""
            }
            </div>
          </div>
          ${showCopyBlock ? `
          <div class="person-card__copy ${animateWithPicture ? "person-card__copy--entering" : ""}">
            ${showName ? `<div class="person-card__title">${escapeHtml(title)}</div>` : ""}
            ${subtitle ? `<div class="person-card__chips ${animateWithPicture ? "person-card__chips--entering" : ""}"><div class="person-card__state-chip">${escapeHtml(subtitle)}</div></div>` : ""}
          </div>
          ` : ""}
        </div>
      </ha-card>
    `;

    if (animateWithPicture) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 120);
    }

    this._lastRenderSignature = this._getRenderSignature();
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaPersonCard);
}

class NodaliaPersonCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._showAnimationSection = false;
    this._showStyleSection = false;
    this._showTapActionsSection = false;
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
    this._onShadowClick = this._onShadowClick.bind(this);
  }

  _attachEditorShadowListeners() {
    window.NodaliaUtils.bindShadowListeners(this, [
      ["input", this._onShadowInput],
      ["change", this._onShadowInput],
      ["value-changed", this._onShadowValueChanged],
      ["click", this._onShadowClick],
    ], "editor");
  }

  _detachEditorShadowListeners() {
    window.NodaliaUtils.releaseShadowListeners(this, "editor");
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
    return window.NodaliaUtils.editorFilteredStatesSignature(
      hass,
      this._config?.language,
      id =>
        id.startsWith("person.") || id.startsWith("device_tracker."),
    );
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

  _getDomainEntityOptions(domains = [], path = "entity") {
    const normalizedDomains = Array.isArray(domains)
      ? domains.filter(Boolean)
      : String(domains || "").split(",").map(domain => domain.trim()).filter(Boolean);

    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const options = Object.entries(this._hass?.states || {})
      .filter(([entityId]) => normalizedDomains.some(domain => entityId.startsWith(`${domain}.`)))
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
    return window.NodaliaUtils.captureEditorFocusState(this);
  }

  _restoreFocusState(focusState) {
    window.NodaliaUtils.restoreEditorFocusState(this, focusState);
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
      case "color":
        return formatEditorColorFromHex(input.value, Number(input.dataset.alpha || 1));
      case "csv": {
        const values = String(input.value || "")
          .split(",")
          .map(item => item.trim().toLowerCase())
          .filter(Boolean);
        return values.length ? values : "";
      }
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

    const focusState = this._captureFocusState();

    if (toggleButton.dataset.editorToggle === "styles") {
      this._showStyleSection = !this._showStyleSection;
    } else if (toggleButton.dataset.editorToggle === "animations") {
      this._showAnimationSection = !this._showAnimationSection;
    } else if (toggleButton.dataset.editorToggle === "tap_actions") {
      this._showTapActionsSection = !this._showTapActionsSection;
    }

    this._render();
    this._restoreFocusState(focusState);
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
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const inputValue = value === undefined || value === null ? "" : String(value);

    return `
      <label class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <textarea data-field="${escapeHtml(field)}" ${placeholder}>${escapeHtml(inputValue)}</textarea>
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
    const domains = Array.isArray(options.domains)
      ? options.domains.join(",")
      : String(options.domains || "");

    return `
      <div class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-domains="${escapeHtml(domains)}"
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

  _mountEntityPicker(host) {
    if (!(host instanceof HTMLElement)) {
      return;
    }

    const field = host.dataset.field || "entity";
    const nextValue = host.dataset.value || "";
    const placeholder = host.dataset.placeholder || "";
    const domains = String(host.dataset.domains || "")
      .split(",")
      .map(domain => domain.trim())
      .filter(Boolean);
    let control = null;

    if (customElements.get("ha-entity-picker")) {
      control = document.createElement("ha-entity-picker");
      control.includeDomains = domains;
      control.allowCustomEntity = true;
      control.entityFilter = stateObj => domains.some(domain => String(stateObj?.entity_id || "").startsWith(`${domain}.`));
      if (placeholder) {
        control.setAttribute("placeholder", placeholder);
      }
    } else if (customElements.get("ha-selector")) {
      control = document.createElement("ha-selector");
      control.selector = {
        entity: domains.length === 1
          ? { domain: domains[0] }
          : {},
      };
    } else {
      control = document.createElement("select");
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = placeholder || this._editorLabel("ed.person.select_entity");
      control.appendChild(emptyOption);
      this._getDomainEntityOptions(domains, field).forEach(option => {
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

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const hapticStyle = config.haptics?.style || "medium";
    const tapAction = config.tap_action || "more-info";
    const holdAction = config.hold_action || "none";
    const doubleTapAction = config.double_tap_action || "none";
    const actionOptions = [
      { value: "more-info", label: "ed.entity.tap_more_info" },
      { value: "toggle", label: "ed.entity.tap_toggle" },
      { value: "navigate", label: "ed.entity.tap_navigate" },
      { value: "url", label: "ed.entity.tap_open_url" },
      { value: "service", label: "ed.entity.tap_service" },
      { value: "none", label: "ed.entity.tap_none" },
    ];
    const showServiceSecurity = [tapAction, holdAction, doubleTapAction].includes("service");
    const animations = config.animations || DEFAULT_CONFIG.animations;

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

        .editor-field span,
        .editor-toggle span {
          color: var(--secondary-text-color);
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
          min-height: 86px;
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

        .editor-toggle {
          align-items: center;
          grid-template-columns: auto 1fr;
          padding-top: 20px;
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
        .editor-field ha-selector,
        .editor-control-host,
        .editor-control-host > * {
          display: block;
          width: 100%;
        }

        @media (max-width: 720px) {
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
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.person.general_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityPickerField("ed.entity.entity_main", "entity", config.entity, {
              domains: ["person", "device_tracker"],
              placeholder: "person.ana",
              fullWidth: true,
            })}
            ${this._renderIconPickerField("ed.person.fallback_icon", "icon", config.icon, {
              placeholder: "mdi:account",
              fullWidth: true,
            })}
            ${this._renderTextField("ed.entity.name", "name", config.name, {
              placeholder: this._editorLabel("ed.person.name_placeholder"),
              fullWidth: true,
            })}
            ${this._renderCheckboxField("ed.person.show_name", "show_name", config.show_name !== false)}
            ${this._renderCheckboxField("ed.person.show_location", "show_state", config.show_state !== false)}
            ${this._renderCheckboxField("ed.person.show_zone_badge", "show_zone_badge", config.show_zone_badge !== false)}
            ${this._renderCheckboxField("ed.person.use_entity_picture", "use_entity_picture", config.use_entity_picture !== false)}
            ${this._renderCheckboxField("ed.person.use_zone_icon", "use_zone_icon", config.use_zone_icon !== false)}
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
              "ed.entity.tap_action",
              "tap_action",
              tapAction,
              actionOptions,
              { fullWidth: true },
            )}
            ${tapAction === "service"
              ? `
                ${this._renderTextField("ed.entity.tap_service_field", "tap_service", config.tap_service, {
                  placeholder: "light.turn_on",
                  fullWidth: true,
                })}
                ${this._renderTextareaField("ed.entity.tap_service_data_json", "tap_service_data", config.tap_service_data, {
                  placeholder: '{"entity_id":"light.salon"}',
                })}
              `
              : ""}
            ${tapAction === "navigate"
              ? this._renderTextField("ed.entity.navigation_path", "navigation_path", config.navigation_path, {
                  placeholder: "#bubblecard_john",
                  fullWidth: true,
                })
              : ""}
            ${tapAction === "url"
              ? `
                ${this._renderTextField("ed.entity.tap_url_field", "tap_url", config.tap_url, {
                  placeholder: "https://example.com",
                  fullWidth: true,
                })}
                ${this._renderCheckboxField("ed.entity.tap_new_tab", "tap_new_tab", config.tap_new_tab === true)}
              `
              : ""}

            <div class="editor-section__hint editor-field--full" style="margin-top: 8px;">${escapeHtml(this._editorLabel("ed.light.hold_actions_section_hint"))}</div>
            ${this._renderSelectField(
              "ed.weather.hold_action",
              "hold_action",
              holdAction,
              actionOptions,
              { fullWidth: true },
            )}
            ${holdAction === "service"
              ? `
                ${this._renderTextField("ed.entity.hold_service_field", "hold_service", config.hold_service, {
                  placeholder: "script.person_hold",
                  fullWidth: true,
                })}
                ${this._renderTextareaField("ed.entity.hold_service_data_json", "hold_service_data", config.hold_service_data, {
                  placeholder: '{"entity_id":"person.john"}',
                })}
              `
              : ""}
            ${holdAction === "navigate"
              ? this._renderTextField("ed.entity.hold_navigation_path", "hold_navigation_path", config.hold_navigation_path, {
                  placeholder: "/lovelace/people",
                  fullWidth: true,
                })
              : ""}
            ${holdAction === "url"
              ? `
                ${this._renderTextField("ed.entity.hold_url_field", "hold_url", config.hold_url, {
                  placeholder: "https://example.com",
                  fullWidth: true,
                })}
                ${this._renderCheckboxField("ed.entity.hold_new_tab", "hold_new_tab", config.hold_new_tab === true)}
              `
              : ""}

            <div class="editor-section__hint editor-field--full" style="margin-top: 8px;">${escapeHtml(this._editorLabel("ed.light.double_tap_actions_section_hint"))}</div>
            ${this._renderSelectField(
              "ed.weather.double_tap_action",
              "double_tap_action",
              doubleTapAction,
              actionOptions,
              { fullWidth: true },
            )}
            ${doubleTapAction === "service"
              ? `
                ${this._renderTextField("ed.entity.tap_service_field", "double_tap_service", config.double_tap_service, {
                  placeholder: "script.person_double_tap",
                  fullWidth: true,
                })}
                ${this._renderTextareaField("ed.entity.tap_service_data_json", "double_tap_service_data", config.double_tap_service_data, {
                  placeholder: '{"entity_id":"person.john"}',
                })}
              `
              : ""}
            ${doubleTapAction === "navigate"
              ? this._renderTextField("ed.entity.double_tap_navigation_path", "double_tap_navigation_path", config.double_tap_navigation_path, {
                  placeholder: "/lovelace/map",
                  fullWidth: true,
                })
              : ""}
            ${doubleTapAction === "url"
              ? `
                ${this._renderTextField("ed.entity.tap_url_field", "double_tap_url", config.double_tap_url, {
                  placeholder: "https://example.com",
                  fullWidth: true,
                })}
                ${this._renderCheckboxField("ed.entity.tap_new_tab", "double_tap_new_tab", config.double_tap_new_tab === true)}
              `
              : ""}

            ${showServiceSecurity
              ? `
                ${this._renderCheckboxField(
                  "ed.entity.security_strict",
                  "security.strict_service_actions",
                  config.security?.strict_service_actions !== false,
                )}
                ${config.security?.strict_service_actions !== false
                  ? `
                    ${this._renderTextField(
                      "ed.entity.allowed_services_csv",
                      "security.allowed_services",
                      Array.isArray(config.security?.allowed_services) ? config.security.allowed_services.join(", ") : "",
                      { placeholder: "light.turn_on, script.person_action", valueType: "csv", fullWidth: true },
                    )}
                    ${this._renderTextField(
                      "ed.notifications.security_allowed_domains",
                      "security.allowed_service_domains",
                      Array.isArray(config.security?.allowed_service_domains) ? config.security.allowed_service_domains.join(", ") : "",
                      { placeholder: "light, script", valueType: "csv", fullWidth: true },
                    )}
                  `
                  : ""}
              `
              : ""}
          </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.animations_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.person.animations_section_hint"))}</div>
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
                  ${this._renderCheckboxField("ed.weather.enable_animations", "animations.enabled", animations.enabled !== false)}
                  ${this._renderTextField("ed.weather.content_entrance_ms", "animations.content_duration", animations.content_duration, {
                    type: "number",
                  })}
                  ${this._renderTextField("ed.weather.button_bounce_ms", "animations.button_bounce_duration", animations.button_bounce_duration, {
                    type: "number",
                  })}
                </div>
              `
              : ""
          }
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.person.haptics_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.person.haptics_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderCheckboxField("ed.person.enable_haptics", "haptics.enabled", config.haptics.enabled === true)}
            ${this._renderCheckboxField("ed.person.fallback_vibrate", "haptics.fallback_vibrate", config.haptics.fallback_vibrate === true)}
            ${this._renderSelectField(
              "ed.person.haptic_style",
              "haptics.style",
              hapticStyle,
              [
                { value: "selection", label: "ed.weather.haptic_selection" },
                { value: "light", label: "ed.weather.haptic_light" },
                { value: "medium", label: "ed.weather.haptic_medium" },
                { value: "heavy", label: "ed.weather.haptic_heavy" },
                { value: "success", label: "ed.weather.haptic_success" },
                { value: "warning", label: "ed.weather.haptic_warning" },
                { value: "failure", label: "ed.weather.haptic_failure" },
              ],
            )}
          </div>
        </section>

        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.weather.styles_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.weather.styles_section_hint"))}</div>
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
                  ${this._renderTextField("ed.person.style_avatar_size", "styles.avatar.size", config.styles.avatar.size)}
                  ${this._renderColorField("ed.person.style_avatar_bg", "styles.avatar.background", config.styles.avatar.background, {
                    fallbackValue: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
                  })}
                  ${this._renderColorField("ed.person.style_avatar_color", "styles.avatar.color", config.styles.avatar.color, {
                    fallbackValue: "var(--primary-text-color)",
                  })}
                  ${this._renderTextField("ed.person.style_badge_size", "styles.badge.size", config.styles.badge.size)}
                  ${this._renderTextField("ed.person.style_title_size", "styles.title_size", config.styles.title_size)}
                  ${this._renderTextField("ed.person.style_subtitle_size", "styles.subtitle_size", config.styles.subtitle_size)}
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
                </div>
              `
              : ""
          }
        </section>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll('.editor-control-host[data-mounted-control="entity"]')
      .forEach(host => this._mountEntityPicker(host));

    this.shadowRoot
      .querySelectorAll("ha-icon-picker[data-field]")
      .forEach(control => {
        control.hass = this._hass;
        control.value = control.dataset.value || "";
      });

    this._ensureEditorControlsReady();
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaPersonCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Person Card",
  description: "Tarjeta compacta de persona con foto y zona",
  preview: true,
});
