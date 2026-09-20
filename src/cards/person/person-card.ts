// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
} from "./person-constants";
import {
  clamp,
  compactConfig,
  deepClone,
  deleteByPath,
  escapeHtml,
  escapeSelectorValue,
  fireEvent,
  getByPath,
  isObject,
  mergeConfig,
  normalizeTextKey,
  setByPath,
} from "./person-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./person-config";
import {
  applyStubEntity,
  isUnavailableState,
  parseSizeToPixels,
} from "./person-helpers";

let _lazyNodaliaPersonCard;
export function loadNodaliaPersonCard() {
  if (_lazyNodaliaPersonCard) {
    return _lazyNodaliaPersonCard;
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
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
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
      if (this._cachedZoneEntityId) {
        const cachedZone = this._hass.states[this._cachedZoneEntityId] || null;
        if (cachedZone) {
          return cachedZone;
        }
      }
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
      String(attrs.entity_picture_local || ""),
      String(attrs.entity_picture || ""),
      String(attrs.icon || this._config.icon || ""),
      String(state.state || ""),
      zoneState?.entity_id || "",
      zoneState?.attributes?.friendly_name || "",
      zoneState?.attributes?.icon || "",
      String(window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") || "en"),
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

        ha-card[data-person-action="primary"]:focus-visible {
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
          color:#fff;
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
      <ha-card class="person-card ${singleRowLayout ? "person-card--single-row" : ""} ${avatarCentered ? "person-card--avatar-centered" : ""}" ${canRunPrimaryAction ? `data-person-action="primary" role="button" tabindex="0" aria-label="${escapeHtml(title)}"` : ""}>
        <div class="person-card__content ${animateWithPicture ? "person-card__content--entering" : ""}">
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
  _lazyNodaliaPersonCard = NodaliaPersonCard;
  return NodaliaPersonCard;
}
