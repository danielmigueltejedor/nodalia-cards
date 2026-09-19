// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  COVER_CONTROLS_TOGGLE_LANE_MAX_COLUMNS,
  COVER_CONTROLS_TOGGLE_LANE_MAX_WIDTH,
  COVER_FEATURES,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
} from "./cover-constants";
import {
  clamp,
  compactConfig,
  deepClone,
  deleteByPath,
  escapeHtml,
  escapeSelectorValue,
  fireEvent,
  isObject,
  mergeConfig,
  normalizeTextKey,
  setByPath,
} from "./cover-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./cover-config";
import {
  applyStubEntity,
  coverDeviceIcon,
  getCircularLayoutDialModel,
  getCircularLayoutDialValueFromPoint,
  getRangeValueFromGeometry,
  getSliderDragGeometry,
  isUnavailableState,
  parseNumber,
  parseServiceData,
  resolveOpenCloseControlIcons,
} from "./cover-helpers";

export class NodaliaCoverCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["cover"], entities, entitiesFallback);
  }

  static getEntitySuggestion(hass, entityId) {
    return window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, { domains: ["cover"] });
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._lastRenderedIsActive = null;
    this._controlsTransition = null;
    this._powerTransition = null;
    this._animationCleanupTimer = 0;
    this._activeSliderDrag = null;
    this._skipNextSliderChange = null;
    this._dragWindowListenersAttached = false;
    this._pendingRenderAfterDrag = false;
    this._suppressNextCoverTap = false;
    this._cardWidth = 0;
    this._resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(entries => {
            const entry = entries[0];
            if (!entry) {
              return;
            }
            const nextWidth = Math.round(entry.contentRect?.width || this.clientWidth || 0);
            if (nextWidth === this._cardWidth) {
              return;
            }
            this._cardWidth = nextWidth;
            if (this._activeSliderDrag) {
              this._pendingRenderAfterDrag = true;
              return;
            }
            const signature = this._getRenderSignature(this._hass);
            if (signature === this._lastRenderSignature) {
              this._syncCoverControlsToggleLaneDom();
              return;
            }
            this._lastRenderSignature = signature;
            this._render();
          })
        : null;
    /** `"slider"` = sliders in main cell; `"arrows"` = open/stop/close in main cell (toggle on the right). */
    this._coverControlsViewMode = "slider";
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowChange = this._onShadowChange.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onWindowPointerMove = this._onWindowPointerMove.bind(this);
    this._onWindowPointerUp = this._onWindowPointerUp.bind(this);
    this._onWindowMouseMove = this._onWindowMouseMove.bind(this);
    this._onWindowMouseUp = this._onWindowMouseUp.bind(this);
    this._onWindowTouchStartCapture = this._onWindowTouchStartCapture.bind(this);
    this._onWindowTouchMove = this._onWindowTouchMove.bind(this);
    this._onWindowTouchEnd = this._onWindowTouchEnd.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowChange);
    this.shadowRoot.addEventListener("pointerdown", this._onPointerDown);
    this.shadowRoot.addEventListener("mousedown", this._onMouseDown);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      this.shadowRoot.addEventListener("touchstart", this._onTouchStart, { passive: false });
    }
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const path = event.composedPath();
              if (path.some(node => node instanceof HTMLInputElement && node.dataset?.coverControl)) {
                return null;
              }
              if (window.NodaliaUtils?.isNodaliaSliderChromeHit?.(event)) {
                return null;
              }
              const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.coverAction);
              const zone = actionButton?.dataset?.coverAction;
              return zone === "body" || zone === "icon" ? zone : null;
            },
            shouldBeginHold: zone => this._resolveHoldAction(zone) !== "none",
            onHold: zone => {
              const action = this._resolveHoldAction(zone);
              if (action === "none") {
                return;
              }
              this._triggerHaptic();
              this._runAction(zone, "hold", action);
            },
            markHoldConsumedClick: () => {
              this._suppressNextCoverTap = true;
            },
          })
        : () => {};
  }

  connectedCallback() {
    this._detachHostHold?.reconnect?.();
    this._resizeObserver?.observe(this);
    this._cardWidth = Math.round(this.clientWidth || 0);
    this._render();
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    this._detachHostHold?.();
    if (this._activeSliderDrag) {
      this._activeSliderDrag.dial?.classList?.remove("is-dragging");
      this._activeSliderDrag = null;
    }
    this._detachWindowDragListeners();
    if (this._animationCleanupTimer) {
      window.clearTimeout(this._animationCleanupTimer);
      this._animationCleanupTimer = 0;
    }
    window.NodaliaUtils?.clearDeferTimers?.(this);
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._coverControlsViewMode = "slider";
    this._lastRenderSignature = "";
    this._render();
  }

  set hass(hass) {
    const signature = this._getRenderSignature(hass);
    this._hass = hass;
    if (this._activeSliderDrag) {
      this._lastRenderSignature = signature;
      this._pendingRenderAfterDrag = true;
      return;
    }
    if (this.shadowRoot?.innerHTML && signature === this._lastRenderSignature) {
      return;
    }
    this._lastRenderSignature = signature;
    this._render();
  }

  getCardSize() {
    return this._config?.layout === "circular" ? 5 : 3;
  }

  getGridOptions() {
    if (this._config?.layout === "circular") {
      return {
        rows: "auto",
        columns: "full",
        min_rows: 5,
        min_columns: 7,
      };
    }
    return {
      rows: "auto",
      columns: "full",
      min_rows: 2,
      min_columns: 6,
    };
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) && numericColumns > 0 ? numericColumns : null;
  }

  _shouldReserveCoverToggleLane(width = Math.round(this._cardWidth || this.clientWidth || 0)) {
    const gridColumns = this._getConfiguredGridColumns();
    if (gridColumns !== null) {
      return gridColumns <= COVER_CONTROLS_TOGGLE_LANE_MAX_COLUMNS;
    }
    return width > 0 && width <= COVER_CONTROLS_TOGGLE_LANE_MAX_WIDTH;
  }

  _getState(hass = this._hass) {
    return hass?.states?.[this._config?.entity] || null;
  }

  _getRenderSignature(hass = this._hass) {
    const state = this._getState(hass);
    const attrs = state?.attributes || {};
    const joinParts = window.NodaliaRenderSignature?.joinParts;
    const values = [
      this._config?.entity || "",
      this._coverControlsViewMode,
      state?.state || "",
      attrs.friendly_name || "",
      attrs.icon || "",
      attrs.device_class || "",
      attrs.current_position ?? "",
      attrs.current_tilt_position ?? "",
      attrs.supported_features ?? "",
      String(this._config?.layout || "compact"),
      this._config?.show_state === true ? 1 : 0,
      this._config?.show_name !== false ? 1 : 0,
      String(this._config?.name || ""),
      String(this._config?.tap_action || ""),
      String(this._config?.hold_action || ""),
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "cover:", values }]);
    }
    return values.join("::");
  }

  _features(state = this._getState()) {
    return Number(state?.attributes?.supported_features) || 0;
  }

  _supports(feature, state = this._getState()) {
    return Boolean(this._features(state) & feature);
  }

  _isActive(state = this._getState()) {
    const key = normalizeTextKey(state?.state);
    return ["open", "opening", "closing"].includes(key);
  }

  _getSettledPositionFallback(state = this._getState()) {
    const key = normalizeTextKey(state?.state);
    if (key === "open") {
      return 100;
    }
    if (key === "closed") {
      return 0;
    }
    return null;
  }

  _getCommandablePosition(state = this._getState()) {
    const position = parseNumber(state?.attributes?.current_position);
    if (position !== null) {
      return position;
    }
    return this._getSettledPositionFallback(state);
  }

  _coverCardUi(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.coverCard;
    const enPack = window.NodaliaI18n?.strings?.("en")?.coverCard;
    const raw = pack?.[key] ?? enPack?.[key];
    return String(raw != null && raw !== "" ? raw : fallback);
  }

  _coverTiltChipText(tiltValue) {
    const tpl = this._coverCardUi("tiltChip", "Tilt {value}%");
    return tpl.replace(/\{value\}/g, String(Math.round(Number(tiltValue) || 0)));
  }

  _stateLabel(state = this._getState()) {
    const key = normalizeTextKey(state?.state);
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = this._config?.language ?? "auto";
    const translated = window.NodaliaI18n?.translateEntityStateChip?.(hass, lang, key);
    if (translated) {
      return translated;
    }
    return String(state?.state || window.NodaliaI18n?.translateEntityStateChip?.(hass, lang, "unknown") || "Unknown");
  }

  _getName(state = this._getState()) {
    return this._config?.name || state?.attributes?.friendly_name || this._config?.entity || "Cover";
  }

  _getIcon(state = this._getState()) {
    return this._config?.icon || state?.attributes?.icon || coverDeviceIcon(state);
  }

  _getAccentColor(state = this._getState()) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    return this._isActive(state)
      ? styles.icon.on_color || DEFAULT_CONFIG.styles.icon.on_color
      : styles.icon.off_color || DEFAULT_CONFIG.styles.icon.off_color;
  }

  _getAnimationSettings() {
    const animations = this._config?.animations || DEFAULT_CONFIG.animations;
    return {
      enabled: animations.enabled !== false,
      iconAnimation: animations.icon_animation !== false,
      powerDuration: clamp(Number(animations.power_duration) || DEFAULT_CONFIG.animations.power_duration, 120, 4000),
      controlsDuration: clamp(Number(animations.controls_duration) || DEFAULT_CONFIG.animations.controls_duration, 120, 2400),
      buttonBounceDuration: clamp(Number(animations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration, 120, 1200),
    };
  }

  _isCompactLayout() {
    return window.NodaliaUtils.shouldUseCompactCardLayout({
      mode: this._config?.compact_layout_mode,
      width: Math.round(this._cardWidth || this.clientWidth || 0),
      gridColumns: this._getConfiguredGridColumns(),
    });
  }

  _shouldShowCompactTitle() {
    return window.NodaliaUtils.shouldShowCompactCardTitle({
      width: Math.round(this._cardWidth || this.clientWidth || 0),
    });
  }

  _renderEmptyState() {
    const title = escapeHtml(this._coverCardUi("emptyTitle", "Nodalia Cover Card"));
    const body = escapeHtml(this._coverCardUi("emptyBody", "Set `entity` to a `cover.*` entity to show this card."));
    return `
      <ha-card class="cover-card cover-card--empty">
        <div class="cover-card__empty-title">${title}</div>
        <div class="cover-card__empty-text">${body}</div>
      </ha-card>
    `;
  }

  _triggerHaptic(styleOverride = null) {
    const haptics = this._config?.haptics || {};
    if (haptics.enabled !== true) return;
    const style = styleOverride || haptics.style || "medium";
    fireEvent(this, "haptic", style);
    if (haptics.fallback_vibrate === true && typeof navigator?.vibrate === "function") {
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection);
    }
  }

  _triggerButtonBounce(element) {
    if (!(element instanceof HTMLElement)) return;
    const animations = this._getAnimationSettings();
    if (!animations.enabled) return;
    element.classList.remove("is-pressing");
    element.getBoundingClientRect();
    element.classList.add("is-pressing");
    const schedule = window.NodaliaUtils?.scheduleDeferTimer;
    const done = () => {
      if (!element.isConnected) {
        return;
      }
      element.classList.remove("is-pressing");
    };
    if (typeof schedule === "function") {
      schedule(this, done, animations.buttonBounceDuration + 40);
    } else {
      window.setTimeout(done, animations.buttonBounceDuration + 40);
    }
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

  _callNamedService(service, data = {}, target = null) {
    if (!this._hass || !service) return;
    if (!this._isServiceAllowed(service)) {
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Cover Card", service);
      return;
    }
    const [domain, serviceName] = String(service || "").split(".");
    if (!domain || !serviceName) return;
    const invoke = window.NodaliaUtils?.invokeHomeAssistantService?.bind(window.NodaliaUtils)
      || ((host, hass, svcDomain, svc, payload, svcTarget) => Promise.resolve(
        svcTarget != null
          ? hass?.callService?.(svcDomain, svc, payload, svcTarget)
          : hass?.callService?.(svcDomain, svc, payload),
      ));
    invoke(this, this._hass, domain, serviceName, data, target);
  }

  _callCover(service, data = {}) {
    if (!this._hass || !this._config?.entity) return;
    this._hass.callService("cover", service, { entity_id: this._config.entity, ...data });
  }

  _openMoreInfo(entityId = this._config?.entity) {
    if (entityId) fireEvent(this, "hass-more-info", { entityId });
  }

  _navigate(url, newTab = false) {
    const safeUrl = window.NodaliaUtils?.sanitizeActionUrl?.(url, { allowRelative: true }) || "";
    if (!safeUrl) return;
    if (newTab) {
      window.open(safeUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (/^(?:https?:)?\/\//i.test(safeUrl)) {
      window.open(safeUrl, "_self", "noopener,noreferrer");
      return;
    }
    window.history.pushState(null, "", safeUrl);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  _toggleCover(state = this._getState()) {
    const key = normalizeTextKey(state?.state);
    if (["open", "opening"].includes(key)) {
      this._callCover("close_cover");
      return;
    }
    this._callCover("open_cover");
  }

  _resolveTapAction(zone) {
    const bodyRaw = this._config?.tap_action ?? "toggle";
    const iconRaw = this._config?.icon_tap_action;
    const raw = zone === "icon" && String(iconRaw ?? "").trim() ? iconRaw : bodyRaw;
    let action = String(raw || "toggle").trim().toLowerCase();
    const allowed = new Set(["auto", "toggle", "more-info", "service", "url", "navigate", "none"]);
    if (!allowed.has(action)) {
      action = "toggle";
    }
    if (action === "auto") {
      const isIcon = zone === "icon";
      const service = isIcon ? this._config?.icon_tap_service : this._config?.tap_service;
      const navigationPath = isIcon ? this._config?.icon_navigation_path : this._config?.navigation_path;
      const url = isIcon ? this._config?.icon_tap_url : this._config?.tap_url;
      if (String(service || "").trim()) {
        return "service";
      }
      if (String(navigationPath || "").trim()) {
        return "navigate";
      }
      if (String(url || "").trim()) {
        return "url";
      }
      return "toggle";
    }
    return action;
  }

  _resolveHoldAction(zone) {
    const bodyRaw = this._config?.hold_action ?? "none";
    const iconRaw = this._config?.icon_hold_action;
    const raw = zone === "icon" && String(iconRaw ?? "").trim() ? iconRaw : bodyRaw;
    let action = String(raw || "none").trim().toLowerCase();
    const allowed = new Set(["auto", "toggle", "more-info", "service", "url", "navigate", "none"]);
    if (!allowed.has(action)) {
      action = "none";
    }
    if (action === "auto") {
      const isIcon = zone === "icon";
      const service = isIcon ? this._config?.icon_hold_service : this._config?.hold_service;
      const navigationPath = isIcon ? this._config?.icon_hold_navigation_path : this._config?.hold_navigation_path;
      const url = isIcon ? this._config?.icon_hold_url : this._config?.hold_url;
      if (String(service || "").trim()) {
        return "service";
      }
      if (String(navigationPath || "").trim()) {
        return "navigate";
      }
      if (String(url || "").trim()) {
        return "url";
      }
      return "more-info";
    }
    return action;
  }

  _runAction(zone, interaction = "tap", resolvedAction = null) {
    const isIcon = zone === "icon";
    const isHold = interaction === "hold";
    const action = resolvedAction || (isHold ? this._resolveHoldAction(zone) : this._resolveTapAction(zone));
    if (action === "none") return;
    if (action === "more_info" || action === "more-info") {
      this._openMoreInfo();
      return;
    }
    if (action === "url") {
      let url = isHold
        ? (isIcon ? this._config?.icon_hold_url : this._config?.hold_url)
        : (isIcon ? this._config?.icon_tap_url : this._config?.tap_url);
      let newTab = isHold
        ? (isIcon ? this._config?.icon_hold_new_tab === true : this._config?.hold_new_tab === true)
        : (isIcon ? this._config?.icon_tap_new_tab === true : this._config?.tap_new_tab === true);
      if (isHold && isIcon && !String(url || "").trim()) {
        url = this._config?.hold_url;
        newTab = this._config?.hold_new_tab === true;
      }
      this._navigate(url, newTab);
      return;
    }
    if (action === "navigate") {
      let path = isHold
        ? (isIcon ? this._config?.icon_hold_navigation_path : this._config?.hold_navigation_path)
        : (isIcon ? this._config?.icon_navigation_path : this._config?.navigation_path);
      if (isHold && isIcon && !String(path || "").trim()) {
        path = this._config?.hold_navigation_path;
      }
      this._navigate(path, false);
      return;
    }
    if (action === "service") {
      let service = isHold
        ? (isIcon ? this._config?.icon_hold_service : this._config?.hold_service)
        : (isIcon ? this._config?.icon_tap_service : this._config?.tap_service);
      let dataRaw = isHold
        ? (isIcon ? this._config?.icon_hold_service_data : this._config?.hold_service_data)
        : (isIcon ? this._config?.icon_tap_service_data : this._config?.tap_service_data);
      let targetRaw = isHold
        ? (isIcon ? this._config?.icon_hold_service_target : this._config?.hold_service_target)
        : (isIcon ? this._config?.icon_tap_service_target : this._config?.tap_service_target);
      if (isHold && isIcon && !String(service || "").trim()) {
        service = this._config?.hold_service;
        dataRaw = this._config?.hold_service_data;
        targetRaw = this._config?.hold_service_target;
      }
      const data = parseServiceData(dataRaw);
      const target = parseServiceData(targetRaw);
      const hasExplicitTarget = Object.keys(target).length > 0;
      if (this._config?.entity && data.entity_id === undefined && !hasExplicitTarget) {
        data.entity_id = this._config.entity;
      }
      this._callNamedService(service, data, hasExplicitTarget ? target : null);
      return;
    }
    this._toggleCover();
  }

  _onShadowClick(event) {
    const path = event.composedPath();
    const slider = path.find(node => node instanceof HTMLInputElement && node.dataset?.coverControl);
    if (slider) return;
    const button = path.find(node => node instanceof HTMLElement && node.dataset?.coverAction);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const coverAction = button.dataset.coverAction;
    if (this._isCardTapAction(coverAction)) {
      if (coverAction === "body" || coverAction === "icon") {
        if (coverAction === "body" && window.NodaliaUtils?.isNodaliaSliderChromeHit?.(event)) {
          return;
        }
        if (this._suppressNextCoverTap) {
          this._suppressNextCoverTap = false;
          return;
        }
        this._triggerHaptic();
        this._runAction(coverAction);
      }
      return;
    }
    this._triggerHaptic();
    this._triggerButtonBounce(button);
    switch (coverAction) {
      case "toggle_controls_view":
        this._coverControlsViewMode = this._coverControlsViewMode === "arrows" ? "slider" : "arrows";
        this._syncCoverControlsViewDom();
        break;
      case "open":
        this._callCover("open_cover");
        break;
      case "close":
        this._callCover("close_cover");
        break;
      case "stop":
        this._callCover("stop_cover");
        break;
      default:
        break;
    }
  }

  _isCardTapAction(action) {
    return action === "body" || action === "icon";
  }

  _syncCoverControlsViewDom() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const card = root.querySelector("ha-card.fan-card");
    const toggleButton = root.querySelector('[data-cover-action="toggle_controls_view"]');
    if (!card || !toggleButton) {
      return;
    }

    const isArrows = this._coverControlsViewMode === "arrows";
    card.classList.remove("fan-card--cover-ui-arrows", "fan-card--cover-ui-slider");
    card.classList.add(isArrows ? "fan-card--cover-ui-arrows" : "fan-card--cover-ui-slider");

    const slidersView = root.querySelector(".fan-card__view--sliders");
    const arrowsView = root.querySelector(".fan-card__view--arrows");
    if (slidersView) {
      if (isArrows) {
        slidersView.setAttribute("aria-hidden", "true");
      } else {
        slidersView.removeAttribute("aria-hidden");
      }
    }
    if (arrowsView) {
      if (isArrows) {
        arrowsView.removeAttribute("aria-hidden");
      } else {
        arrowsView.setAttribute("aria-hidden", "true");
      }
    }

    const tToggleToArrows = this._coverCardUi("toggleShowButtons", "Show open, stop, and close");
    const tToggleToSliders = this._coverCardUi("toggleShowSliders", "Show sliders");
    const toggleLabel = isArrows ? tToggleToSliders : tToggleToArrows;
    toggleButton.classList.toggle("fan-card__control--active", isArrows);
    toggleButton.setAttribute("aria-label", toggleLabel);
    toggleButton.setAttribute("title", toggleLabel);
    const toggleIcon = toggleButton.querySelector("ha-icon");
    if (toggleIcon) {
      toggleIcon.setAttribute("icon", isArrows ? "mdi:pan-horizontal" : "mdi:tune-variant");
    }
    this._syncCoverControlsToggleLaneDom();
  }

  _syncCoverControlsToggleLaneDom() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }
    const card = root.querySelector("ha-card.fan-card");
    if (!card) {
      return;
    }
    const reserveToggleLane = this._shouldReserveCoverToggleLane();
    card.classList.toggle(
      "fan-card--cover-ui-toggle-lane",
      this._coverControlsViewMode === "arrows" && reserveToggleLane,
    );
  }

  _onPointerDown(event) {
    const path = event.composedPath();
    const slider = path.find(
      node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.coverControl,
    );

    if (!this._activeSliderDrag && slider && (typeof event.button !== "number" || event.button === 0)) {
      this._startSliderDrag(slider, event.clientX, event, event.pointerId);
      return;
    }

    if (this._activeSliderDrag || (typeof event.button === "number" && event.button !== 0)) {
      return;
    }

    const controlAction = path.find(
      node => node instanceof HTMLElement && node.dataset?.coverAction && node.dataset.coverAction !== "body",
    );
    if (controlAction) {
      return;
    }

    const dial = path.find(node => node instanceof HTMLElement && node.classList?.contains("fan-card__circular-dial"));
    if (!dial || !this._canSetPosition(this._getState())) {
      return;
    }

    this._startCircularDialDrag(dial, event.clientX, event.clientY, event, event.pointerId);
  }

  _onMouseDown(event) {
    const path = event.composedPath();
    const slider = path.find(
      node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.coverControl,
    );

    if (!this._activeSliderDrag && slider && event.button === 0) {
      this._startSliderDrag(slider, event.clientX, event);
      return;
    }

    if (this._activeSliderDrag || event.button !== 0) {
      return;
    }

    const controlAction = path.find(
      node => node instanceof HTMLElement && node.dataset?.coverAction && node.dataset.coverAction !== "body",
    );
    if (controlAction) {
      return;
    }

    const dial = path.find(node => node instanceof HTMLElement && node.classList?.contains("fan-card__circular-dial"));
    if (!dial || !this._canSetPosition(this._getState())) {
      return;
    }

    this._startCircularDialDrag(dial, event.clientX, event.clientY, event);
  }

  _onTouchStart(event) {
    const path = event.composedPath();
    const slider = path.find(node =>
      node instanceof HTMLInputElement &&
      node.type === "range" &&
      node.dataset?.coverControl,
    );

    if (!this._activeSliderDrag && slider && event.touches?.length) {
      this._startSliderDrag(slider, event.touches[0].clientX, event);
      return;
    }

    if (this._activeSliderDrag || !event.touches?.length) {
      return;
    }

    const controlAction = path.find(
      node => node instanceof HTMLElement && node.dataset?.coverAction && node.dataset.coverAction !== "body",
    );
    if (controlAction) {
      return;
    }

    const dial = path.find(node => node instanceof HTMLElement && node.classList?.contains("fan-card__circular-dial"));
    if (!dial || !this._canSetPosition(this._getState())) {
      return;
    }

    this._startCircularDialDrag(dial, event.touches[0].clientX, event.touches[0].clientY, event);
  }

  _canSetPosition(state = this._getState()) {
    return this._config?.show_position_slider !== false && this._supports(COVER_FEATURES.SET_POSITION, state);
  }

  _getDisplayPosition(state = this._getState()) {
    return this._getCommandablePosition(state) ?? 0;
  }

  _updatePositionPreview(value) {
    const nextValue = clamp(Math.round(Number(value)), 0, 100);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    const slider = this.shadowRoot?.querySelector('.fan-card__slider[data-cover-control="position"]');
    if (slider instanceof HTMLInputElement) {
      slider.value = String(nextValue);
      slider.style.setProperty("--percentage", String(nextValue));
      slider.closest(".fan-card__slider-shell")?.style.setProperty("--percentage", String(nextValue));
    }

    const dial = this.shadowRoot?.querySelector(".fan-card__circular-dial");
    if (dial instanceof HTMLElement) {
      const model = getCircularLayoutDialModel(nextValue, 0, 100);
      dial.style.setProperty("--circular-progress", String(model.progress));
      dial.style.setProperty("--circular-marker-left", `${model.markerLeft}%`);
      dial.style.setProperty("--circular-marker-top", `${model.markerTop}%`);
    }

    this.shadowRoot
      ?.querySelectorAll('[data-cover-chip="position"]')
      .forEach(chip => {
        if (chip instanceof HTMLElement) {
          chip.textContent = `${nextValue}%`;
        }
      });
  }

  _getCircularDialStep() {
    return 5;
  }

  _hapticOnPositionStep(steppedValue, { commit = false } = {}) {
    if (this._config?.haptics?.scrolls?.position === false) {
      return;
    }
    const next = Number(steppedValue);
    if (!Number.isFinite(next)) {
      return;
    }
    const drag = this._activeSliderDrag;
    if (drag) {
      if (drag.lastHapticValue === next) {
        return;
      }
      drag.lastHapticValue = next;
      this._triggerHaptic("selection");
      return;
    }
    if (commit) {
      this._triggerHaptic("selection");
    }
  }

  _applyCircularDialValue(value, options = {}) {
    const commit = options.commit === true;
    const nextValue = clamp(Math.round(Number(value)), 0, 100);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    this._updatePositionPreview(nextValue);
    this._hapticOnPositionStep(nextValue, { commit });
    if (commit) {
      this._callCover("set_cover_position", { position: nextValue });
    }
  }

  _startCircularDialDrag(dial, clientX, clientY, event = null, pointerId = null) {
    if (!(dial instanceof HTMLElement)) {
      return;
    }

    const state = this._getState();
    if (!state || !this._canSetPosition(state)) {
      return;
    }

    const seedValue = this._getCommandablePosition(state);
    if (seedValue === null) {
      return;
    }

    const step = this._getCircularDialStep();
    this._activeSliderDrag = {
      kind: "circular",
      dial,
      geometry: dial.getBoundingClientRect(),
      range: { min: 0, max: 100 },
      step,
      pointerId,
      lastValue: seedValue,
      lastClientY: clientY,
      lastHapticValue: Math.round(seedValue),
    };
    dial.classList.add("is-dragging");
    this._attachWindowDragListeners();

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const nextValue = getCircularLayoutDialValueFromPoint(
      dial,
      clientX,
      clientY,
      this._activeSliderDrag.range,
      step,
      seedValue,
      this._activeSliderDrag.geometry,
    );
    this._activeSliderDrag.lastValue = nextValue;
    this._applyCircularDialValue(nextValue, { commit: false });
  }

  _startSliderDrag(slider, clientX, event = null, pointerId = null) {
    if (!slider) return;
    this._activeSliderDrag = {
      kind: "linear",
      pointerId,
      slider,
      geometry: getSliderDragGeometry(slider),
    };
    this._attachWindowDragListeners();
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const nextValue = getRangeValueFromGeometry(this._activeSliderDrag.geometry, slider.value, clientX);
    slider.value = String(nextValue);
    this._applySliderValue(slider, nextValue, { commit: false });
  }

  _queueSliderDragUpdate(slider, clientX, clientY = null) {
    const drag = this._activeSliderDrag;
    if (drag?.kind === "circular") {
      const nextValue = getCircularLayoutDialValueFromPoint(
        drag.dial,
        clientX,
        clientY ?? drag.lastClientY,
        drag.range,
        drag.step,
        drag.lastValue,
        drag.geometry,
      );
      drag.lastValue = nextValue;
      drag.lastClientY = clientY ?? drag.lastClientY;
      this._applyCircularDialValue(nextValue, { commit: false });
      return;
    }

    const nextValue = getRangeValueFromGeometry(drag?.geometry, slider.value, clientX);
    slider.value = String(nextValue);
    this._applySliderValue(slider, nextValue, { commit: false });
  }

  _commitSliderDrag(clientX, event = null, pointerId = null, clientY = null) {
    const drag = this._activeSliderDrag;
    if (!drag || (pointerId !== null && drag.pointerId !== pointerId)) return;
    if (event) {
      event.preventDefault();
    }

    if (drag.kind === "circular") {
      const nextValue = getCircularLayoutDialValueFromPoint(
        drag.dial,
        clientX,
        clientY ?? drag.lastClientY,
        drag.range,
        drag.step,
        drag.lastValue,
        drag.geometry,
      );
      drag.dial?.classList?.remove("is-dragging");
      this._applyCircularDialValue(nextValue, { commit: true });
      this._activeSliderDrag = null;
      this._detachWindowDragListeners();
      this._suppressNextCoverTap = true;
      if (this._pendingRenderAfterDrag) {
        this._pendingRenderAfterDrag = false;
        this._render();
      }
      return;
    }

    const nextValue = getRangeValueFromGeometry(drag.geometry, drag.slider.value, clientX);
    drag.slider.value = String(nextValue);
    this._skipNextSliderChange = drag.slider;
    this._applySliderValue(drag.slider, nextValue, { commit: true });
    this._activeSliderDrag = null;
    this._detachWindowDragListeners();
    this._suppressNextCoverTap = true;
    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _onWindowPointerMove(event) {
    const drag = this._activeSliderDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    this._queueSliderDragUpdate(drag.slider, event.clientX, event.clientY);
  }

  _onWindowPointerUp(event) {
    const drag = this._activeSliderDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    this._commitSliderDrag(event.clientX, event, event.pointerId, event.clientY);
  }

  _onWindowMouseMove(event) {
    if (!this._activeSliderDrag || (typeof event.buttons === "number" && (event.buttons & 1) === 0)) return;
    event.preventDefault();
    this._queueSliderDragUpdate(this._activeSliderDrag.slider, event.clientX, event.clientY);
  }

  _onWindowMouseUp(event) {
    if (!this._activeSliderDrag) return;
    this._commitSliderDrag(event.clientX, event, null, event.clientY);
  }

  _onWindowTouchMove(event) {
    if (!this._activeSliderDrag || !event.touches?.length) return;
    event.preventDefault();
    this._queueSliderDragUpdate(
      this._activeSliderDrag.slider,
      event.touches[0].clientX,
      event.touches[0].clientY,
    );
  }

  _onWindowTouchStartCapture(event) {
    const drag = this._activeSliderDrag;
    if (!drag) {
      return;
    }

    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (drag.kind === "circular" ? path.includes(drag.dial) : path.includes(drag.slider)) {
      return;
    }

    drag.dial?.classList?.remove("is-dragging");
    this._activeSliderDrag = null;
    this._detachWindowDragListeners();

    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _onWindowTouchEnd(event) {
    if (!this._activeSliderDrag) return;
    const touch = event.changedTouches?.[0];
    const clientX = touch?.clientX;
    if (!Number.isFinite(clientX)) {
      this._activeSliderDrag.dial?.classList?.remove("is-dragging");
      this._activeSliderDrag = null;
      this._detachWindowDragListeners();
      if (this._pendingRenderAfterDrag) {
        this._pendingRenderAfterDrag = false;
        this._render();
      }
      return;
    }
    this._commitSliderDrag(clientX, event, null, touch?.clientY);
  }

  _attachWindowDragListeners() {
    if (this._dragWindowListenersAttached) return;
    this._dragWindowListenersAttached = true;
    window.addEventListener("pointermove", this._onWindowPointerMove);
    window.addEventListener("pointerup", this._onWindowPointerUp);
    window.addEventListener("pointercancel", this._onWindowPointerUp);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      window.addEventListener("mousemove", this._onWindowMouseMove);
      window.addEventListener("mouseup", this._onWindowMouseUp);
      window.addEventListener("touchstart", this._onWindowTouchStartCapture, { passive: true, capture: true });
      window.addEventListener("touchmove", this._onWindowTouchMove, { passive: false });
      window.addEventListener("touchend", this._onWindowTouchEnd, { passive: false });
      window.addEventListener("touchcancel", this._onWindowTouchEnd, { passive: false });
    }
  }

  _detachWindowDragListeners() {
    if (!this._dragWindowListenersAttached) return;
    this._dragWindowListenersAttached = false;
    window.removeEventListener("pointermove", this._onWindowPointerMove);
    window.removeEventListener("pointerup", this._onWindowPointerUp);
    window.removeEventListener("pointercancel", this._onWindowPointerUp);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      window.removeEventListener("mousemove", this._onWindowMouseMove);
      window.removeEventListener("mouseup", this._onWindowMouseUp);
      window.removeEventListener("touchstart", this._onWindowTouchStartCapture, true);
      window.removeEventListener("touchmove", this._onWindowTouchMove);
      window.removeEventListener("touchend", this._onWindowTouchEnd);
      window.removeEventListener("touchcancel", this._onWindowTouchEnd);
    }
  }

  _onShadowInput(event) {
    const slider = event.composedPath().find(node => node instanceof HTMLInputElement && node.dataset?.coverControl);
    if (!slider) return;
    event.stopPropagation();
    if (this._activeSliderDrag?.slider === slider) {
      return;
    }
    this._applySliderValue(slider, slider.value, { commit: false });
  }

  _onShadowChange(event) {
    const slider = event.composedPath().find(node => node instanceof HTMLInputElement && node.dataset?.coverControl);
    if (!slider) return;
    event.stopPropagation();
    if (this._skipNextSliderChange === slider) {
      this._skipNextSliderChange = null;
      return;
    }
    this._applySliderValue(slider, slider.value, { commit: true });
    this._activeSliderDrag = null;
    this._detachWindowDragListeners?.();
  }

  _applySliderValue(slider, rawValue, options = {}) {
    const nextValue = clamp(Math.round(Number(rawValue)), 0, 100);
    if (!Number.isFinite(nextValue)) return;
    const sliderKind = String(slider.dataset.coverControl || "").trim();
    slider.style.setProperty("--percentage", String(nextValue));
    slider.closest(".fan-card__slider-shell")?.style.setProperty("--percentage", String(nextValue));
    const chip = this.shadowRoot?.querySelector(`[data-cover-chip="${escapeSelectorValue(sliderKind)}"]`);
    if (chip instanceof HTMLElement) {
      chip.textContent =
        sliderKind === "tilt"
          ? this._coverTiltChipText(nextValue)
          : `${nextValue}%`;
    }
    if (options.commit !== true) return;
    if (this._config?.haptics?.scrolls?.[sliderKind] !== false) {
      this._triggerHaptic("selection");
    }
    if (sliderKind === "position") {
      this._callCover("set_cover_position", { position: nextValue });
    } else if (sliderKind === "tilt") {
      this._callCover("set_cover_tilt_position", { tilt_position: nextValue });
    }
  }

  _renderSlider(kind, label, value, options = {}) {
    const styles = this._config.styles;
    const percentage = clamp(Math.round(Number(value) || 0), 0, 100);
    const rowClass =
      options.variant === "stack" ? "fan-card__slider-row fan-card__slider-row--stack" : "fan-card__slider-row fan-card__slider-row--solo";
    return `
      <div class="${rowClass}">
        <div class="fan-card__slider-wrap">
          <div class="fan-card__slider-shell" style="--percentage:${percentage};">
            <div class="fan-card__slider-track"></div>
            <input
              type="range"
              class="fan-card__slider"
              data-cover-control="${escapeHtml(kind)}"
              min="0"
              max="100"
              step="1"
              value="${percentage}"
              style="--percentage:${percentage};"
              aria-label="${escapeHtml(label)}"
            />
          </div>
        </div>
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) return;
    const config = this._config || normalizeConfig({});
    const styles = config.styles;

    const entityGuard = window.NodaliaUtils?.renderLovelaceEntityGuardCardHtml?.(
      this._hass,
      config.entity,
      { cardClass: "cover-card" },
    );
    if (entityGuard) {
      this.shadowRoot.innerHTML = entityGuard;
      return;
    }

    const state = this._getState();
    if (!state) {
      this.shadowRoot.innerHTML = window.NodaliaUtils?.renderCardEmptyStateDocument?.(
        this._renderEmptyState(),
        { card: (config || DEFAULT_CONFIG).styles?.card },
      ) ?? this._renderEmptyState();
      return;
    }

    const isActive = this._isActive(state);
    const isCircularLayout = config.layout === "circular";
    const isMoving = ["opening", "closing"].includes(normalizeTextKey(state.state));
    const title = this._getName(state);
    const icon = this._getIcon(state);
    const accentColor = this._getAccentColor(state);
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const animations = this._getAnimationSettings();
    const position = parseNumber(state.attributes?.current_position);
    const tilt = parseNumber(state.attributes?.current_tilt_position);
    const canSetPosition = this._canSetPosition(state);
    const supportsPosition = canSetPosition && position !== null;
    const supportsTilt = config.show_tilt_slider !== false && this._supports(COVER_FEATURES.SET_TILT_POSITION, state) && tilt !== null;
    const supportsStop = config.show_stop !== false && this._supports(COVER_FEATURES.STOP, state);
    const showTitle = isCircularLayout || !this._isCompactLayout() || this._shouldShowCompactTitle();
    const showCopyBlock = showTitle || config.show_state === true || config.show_position_chip !== false || config.show_tilt_chip !== false;
    const tOpen = this._coverCardUi("open", "Open");
    const tClose = this._coverCardUi("close", "Close");
    const tStop = this._coverCardUi("stop", "Stop");
    const tPosSlider = this._coverCardUi("positionSlider", "Position");
    const tTiltSlider = this._coverCardUi("tiltSlider", "Tilt");
    const tToggleCover = this._coverCardUi("toggleCover", "Toggle cover");
    const openCloseIcons = resolveOpenCloseControlIcons(config.open_close_icons, state.attributes?.device_class);
    const chips = [];
    if (config.show_state === true) chips.push(`<span class="fan-card__chip fan-card__chip--state">${escapeHtml(this._stateLabel(state))}</span>`);
    if (config.show_position_chip !== false && position !== null) chips.push(`<span class="fan-card__chip" data-cover-chip="position">${Math.round(position)}%</span>`);
    if (config.show_tilt_chip !== false && tilt !== null) chips.push(`<span class="fan-card__chip" data-cover-chip="tilt">${escapeHtml(this._coverTiltChipText(tilt))}</span>`);
    const coverUiMode = this._coverControlsViewMode === "arrows" ? "arrows" : "slider";
    const tToggleToArrows = this._coverCardUi("toggleShowButtons", "Show open, stop, and close");
    const tToggleToSliders = this._coverCardUi("toggleShowSliders", "Show sliders");
    /** Side action matches fan-card preset / light mode column: tune = alternate control set, sliders icon = back to position/tilt. */
    const toggleIcon = coverUiMode === "slider" ? "mdi:tune-variant" : "mdi:pan-horizontal";
    const toggleAria = coverUiMode === "slider" ? tToggleToArrows : tToggleToSliders;
    const hasSliders = supportsPosition || supportsTilt;
    const coverUiClass = hasSliders ? (coverUiMode === "arrows" ? "fan-card--cover-ui-arrows" : "fan-card--cover-ui-slider") : "";
    const coverToggleLaneClass =
      hasSliders && coverUiMode === "arrows" && this._shouldReserveCoverToggleLane()
        ? " fan-card--cover-ui-toggle-lane"
        : "";
    const arrowButtonsHtml = `
        <button type="button" class="fan-card__control fan-card__control--in-transport" data-cover-action="open" aria-label="${escapeHtml(tOpen)}"><ha-icon icon="${escapeHtml(openCloseIcons.open)}"></ha-icon></button>
        ${supportsStop ? `<button type="button" class="fan-card__control fan-card__control--in-transport" data-cover-action="stop" aria-label="${escapeHtml(tStop)}"><ha-icon icon="mdi:stop"></ha-icon></button>` : ""}
        <button type="button" class="fan-card__control fan-card__control--in-transport" data-cover-action="close" aria-label="${escapeHtml(tClose)}"><ha-icon icon="${escapeHtml(openCloseIcons.close)}"></ha-icon></button>
      `;
    const arrowTransportHtml = `<div class="fan-card__transport">${arrowButtonsHtml}</div>`;
    const circularCommandButtonsHtml = `
      <button type="button" class="fan-card__circular-command" data-nodalia-tap-shield="true" data-cover-action="open" aria-label="${escapeHtml(tOpen)}"><ha-icon icon="${escapeHtml(openCloseIcons.open)}"></ha-icon></button>
      ${supportsStop ? `<button type="button" class="fan-card__circular-command fan-card__circular-command--stop${isMoving ? " is-active" : ""}" data-nodalia-tap-shield="true" data-cover-action="stop" aria-label="${escapeHtml(tStop)}"><ha-icon icon="mdi:stop"></ha-icon></button>` : ""}
      <button type="button" class="fan-card__circular-command" data-nodalia-tap-shield="true" data-cover-action="close" aria-label="${escapeHtml(tClose)}"><ha-icon icon="${escapeHtml(openCloseIcons.close)}"></ha-icon></button>
    `;
    const controlsMarkup = hasSliders
      ? `
        <div class="fan-card__slider-row">
          <div class="fan-card__cover-controls-pane">
            <div class="fan-card__view fan-card__view--sliders"${coverUiMode === "arrows" ? ' aria-hidden="true"' : ""}>
              ${supportsPosition ? this._renderSlider("position", tPosSlider, position, { variant: "stack" }) : ""}
              ${supportsTilt ? this._renderSlider("tilt", tTiltSlider, tilt, { variant: "stack" }) : ""}
            </div>
            <div class="fan-card__view fan-card__view--arrows"${coverUiMode === "slider" ? ' aria-hidden="true"' : ""}>
              <div class="fan-card__controls fan-card__controls--embedded">${arrowTransportHtml}</div>
            </div>
          </div>
          <div class="fan-card__slider-actions">
            <button type="button" class="fan-card__control${coverUiMode === "arrows" ? " fan-card__control--active" : ""}" data-cover-action="toggle_controls_view" aria-label="${escapeHtml(toggleAria)}" title="${escapeHtml(toggleAria)}"><ha-icon icon="${escapeHtml(toggleIcon)}"></ha-icon></button>
          </div>
        </div>
      `
      : `<div class="fan-card__controls">${arrowTransportHtml}</div>`;
    const circularPosition = position ?? this._getSettledPositionFallback(state);
    const circularDial = getCircularLayoutDialModel(circularPosition ?? 0, 0, 100);
    const circularControlsMarkup = `
      <div class="fan-card__circular-layout">
        <div class="fan-card__circular-dial" data-nodalia-tap-shield="true" style="--circular-progress:${circularDial.progress};--circular-marker-left:${circularDial.markerLeft}%;--circular-marker-top:${circularDial.markerTop}%;">
          <svg viewBox="0 0 240 240" aria-hidden="true">
            <circle class="fan-card__circular-track" cx="120" cy="120" r="86" pathLength="100"></circle>
            <circle class="fan-card__circular-hit" cx="120" cy="120" r="86" pathLength="100" data-cover-control="circular-dial"></circle>
            <circle class="fan-card__circular-progress" cx="120" cy="120" r="86" pathLength="100"></circle>
          </svg>
          <span class="fan-card__circular-thumb" data-cover-control="circular-dial" aria-hidden="true"></span>
          <div class="fan-card__circular-center">
            <strong data-cover-chip="position">${position === null ? "—" : `${Math.round(position)}%`}</strong>
            <span class="fan-card__circular-divider" aria-hidden="true"></span>
            <span>${escapeHtml(tPosSlider)}</span>
          </div>
        </div>
        <div class="fan-card__circular-commands">${circularCommandButtonsHtml}</div>
        ${supportsTilt ? `<div class="fan-card__circular-secondary">${this._renderSlider("tilt", tTiltSlider, tilt, { variant: "stack" })}</div>` : ""}
      </div>
    `;
    const onCardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 54%, ${styles.card.background} 100%)`;
    const onCardBorder = `color-mix(in srgb, ${accentColor} 34%, var(--divider-color))`;
    const onCardShadow = `0 16px 32px color-mix(in srgb, ${accentColor} 14%, rgba(0, 0, 0, 0.18))`;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          container-name: cover-card;
          container-type: inline-size;
          display: block;
        }
        * { box-sizing: border-box; }
        ha-card.fan-card {
          --fan-card-controls-gap: calc(${styles.card.gap} + 4px);
          --fan-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          background: ${isActive ? onCardBackground : styles.card.background};
          border: ${isActive ? `1px solid ${onCardBorder}` : styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${isActive ? `${styles.card.box_shadow}, ${onCardShadow}` : styles.card.box_shadow};
          color: var(--primary-text-color);
          min-width: 0;
          overflow: hidden;
          overflow-anchor: none;
          padding: ${styles.card.padding};
          position: relative;
          touch-action: manipulation;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        ha-card::before {
          background: ${isActive
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 18%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`
            : "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0))"};
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
          opacity: ${isActive ? "1" : "0"};
          pointer-events: none;
          position: absolute;
          transition: opacity 180ms ease;
          z-index: 0;
        }
        .fan-card { display: grid; min-width: 0; position: relative; z-index: 1; }
        .fan-card__content { display: grid; gap: 0; }
        .fan-card__hero {
          align-items: center;
          display: grid;
          gap: ${styles.card.gap};
          grid-template-columns: auto minmax(0, 1fr);
          min-width: 0;
        }
        .fan-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${isActive ? `color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent))` : "color-mix(in srgb, var(--primary-text-color) 6%, transparent)"};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${isActive ? styles.icon.on_color : styles.icon.off_color};
          cursor: pointer;
          display: inline-flex;
          height: ${styles.icon.size};
          justify-content: center;
          line-height: 0;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          width: ${styles.icon.size};
        }
        .fan-card__icon ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.46);
          color: ${isActive ? styles.icon.on_color : styles.icon.off_color};
        }
        .fan-card__icon--active-motion ha-icon { animation: cover-card-icon-breathe 1.15s ease-in-out infinite; }
        .fan-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          display: inline-flex;
          height: 18px;
          justify-content: center;
          position: absolute;
          right: -2px;
          top: -2px;
          width: 18px;
        }
        .fan-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          color:#fff;
          height: 11px;
          position: static;
          transform: none;
          width: 11px;
        }
        .fan-card__copy { display: grid; gap: 10px; min-width: 0; }
        .fan-card__headline {
          align-items: start;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }
        .fan-card__title {
          font-size: ${styles.title_size};
          font-weight: 700;
          line-height: 1.15;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fan-card__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          min-width: 0;
        }
        .fan-card__chip {
          align-items: center;
          backdrop-filter: blur(18px);
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: ${chipBorderRadius};
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          height: ${styles.chip_height};
          overflow: hidden;
          padding: ${styles.chip_padding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fan-card__chip--state { color: var(--primary-text-color); }
        .fan-card--circular .fan-card__content { gap: 18px; }
        ha-card.fan-card--circular { border-radius: 30px; padding: 16px; }
        .fan-card--circular .fan-card__hero {
          align-items: center;
          gap: 16px;
          grid-template-columns: 58px minmax(0, 1fr);
        }
        .fan-card--circular .fan-card__icon { height: 58px; width: 58px; }
        .fan-card--circular .fan-card__icon > ha-icon {
          --mdc-icon-size: 25.52px;
          height: 25.52px;
          width: 25.52px;
        }
        .fan-card--circular .fan-card__title { font-size: 16px; }
        .fan-card__circular-layout {
          align-items: center;
          display: grid;
          gap: 16px;
          justify-items: center;
          margin-top: 4px;
          min-width: 0;
        }
        .fan-card__circular-dial {
          -webkit-backdrop-filter: blur(18px);
          backdrop-filter: blur(18px);
          aspect-ratio: 1;
          background:
            radial-gradient(circle at 24% 18%, color-mix(in srgb, ${accentColor} 20%, transparent), transparent 30%),
            linear-gradient(180deg, color-mix(in srgb, ${accentColor} 14%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)) 0%, rgba(255, 255, 255, 0) 42%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 16%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)) 0%, color-mix(in srgb, ${accentColor} 8%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)) 60%, color-mix(in srgb, var(--primary-text-color) 5%, transparent) 100%);
          border: 1px solid color-mix(in srgb, ${accentColor} 10%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 50%;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent), 0 18px 38px rgba(0, 0, 0, 0.16);
          box-sizing: border-box;
          cursor: pointer;
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
          will-change: transform, box-shadow;
          width: min(280px, 100%);
        }
        @supports (width: 1cqw) {
          .fan-card__circular-dial { width: min(280px, 100%, 94cqw); }
        }
        .fan-card__circular-dial svg {
          display: block;
          height: 100%;
          overflow: visible;
          width: 100%;
        }
        .fan-card__circular-track,
        .fan-card__circular-hit,
        .fan-card__circular-progress {
          fill: none;
          stroke-dasharray: 75 25;
          stroke-linecap: round;
          stroke-width: 18;
          transform: rotate(135deg);
          transform-origin: 120px 120px;
        }
        .fan-card__circular-track {
          stroke: color-mix(in srgb, color-mix(in srgb, var(--primary-text-color) 32%, var(--divider-color)) 52%, var(--primary-text-color) 48%);
        }
        .fan-card__circular-hit {
          pointer-events: stroke;
          stroke: transparent;
          stroke-width: 28;
        }
        .fan-card__circular-progress {
          filter: drop-shadow(0 0 0 transparent);
          opacity: 0.94;
          pointer-events: none;
          stroke: ${styles.slider_color};
          stroke-dasharray: var(--circular-progress, 0) 100;
          transition: stroke-dasharray 240ms ease-out;
        }
        .fan-card__circular-thumb {
          background: transparent;
          border-radius: 50%;
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary-text-color) 4%, transparent), 0 0 0 6px color-mix(in srgb, var(--primary-text-color) 5%, transparent), 0 0 18px color-mix(in srgb, ${accentColor} 12%, transparent), 0 10px 24px rgba(0, 0, 0, 0.18);
          height: 24px;
          left: var(--circular-marker-left);
          pointer-events: auto;
          position: absolute;
          top: var(--circular-marker-top);
          transform: translate(-50%, -50%);
          transition: left 240ms ease-out, top 240ms ease-out;
          width: 24px;
          z-index: 2;
        }
        .fan-card__circular-dial.is-dragging .fan-card__circular-progress,
        .fan-card__circular-dial.is-dragging .fan-card__circular-thumb {
          transition: none;
        }
        .fan-card__circular-dial.is-dragging {
          border-color: color-mix(in srgb, ${accentColor} 18%, color-mix(in srgb, var(--primary-text-color) 10%, transparent));
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 24px 44px rgba(0, 0, 0, 0.2);
          transform: translateZ(0) scale(1.03);
        }
        .fan-card__circular-dial.is-dragging .fan-card__circular-progress {
          filter: drop-shadow(0 0 10px color-mix(in srgb, ${accentColor} 24%, transparent));
          opacity: 1;
        }
        .fan-card__circular-dial.is-dragging .fan-card__circular-thumb {
          animation: fan-card-circular-dial-thumb-pop 260ms cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 0 0 7px color-mix(in srgb, ${accentColor} 12%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)),
            0 0 22px color-mix(in srgb, ${accentColor} 18%, transparent),
            0 18px 34px rgba(0, 0, 0, 0.24);
          transform: translate(-50%, -50%) scale(1.15);
        }
        .fan-card__circular-thumb::before {
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
        .fan-card__circular-thumb::after {
          background: rgba(255, 255, 255, 0.96);
          border-radius: 50%;
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          content: "";
          height: 82%;
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 82%;
        }
        .fan-card__circular-center {
          align-content: center;
          display: grid;
          gap: 11px;
          inset: 19%;
          justify-items: center;
          pointer-events: none;
          position: absolute;
          text-align: center;
          transform: scale(1);
          transition:
            opacity 220ms cubic-bezier(0.22, 0.84, 0.26, 1),
            transform 220ms cubic-bezier(0.22, 0.84, 0.26, 1);
        }
        .fan-card__circular-dial.is-dragging .fan-card__circular-center {
          transform: scale(1.02);
        }
        .fan-card__circular-center > strong {
          color: var(--primary-text-color);
          font-size: clamp(42px, 12vw, 50px);
          font-weight: 500;
          letter-spacing: -0.055em;
          line-height: 1;
        }
        .fan-card__circular-divider {
          background: color-mix(in srgb, var(--primary-text-color) 18%, transparent);
          border-radius: 999px;
          height: 1px;
          width: clamp(84px, 72%, 148px);
        }
        .fan-card__circular-center > span:not(.fan-card__circular-divider) {
          color: var(--secondary-text-color);
          font-size: 16px;
          font-weight: 500;
        }
        .fan-card__circular-commands {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        .fan-card__circular-command {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent);
          border-radius: 50%;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 7%, transparent), 0 10px 24px rgba(0, 0, 0, 0.16);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          height: 50px;
          justify-content: center;
          padding: 0;
          width: 50px;
        }
        .fan-card__circular-command ha-icon { --mdc-icon-size: 22px; }
        .fan-card__circular-command--stop.is-active {
          background: color-mix(in srgb, ${accentColor} 22%, ${styles.control.accent_background});
          border-color: color-mix(in srgb, ${accentColor} 50%, transparent);
        }
        .fan-card__circular-secondary { min-width: 0; width: 100%; }
        .fan-card__circular-secondary .fan-card__slider-row { padding-inline: 0; }
        .fan-card__controls-shell {
          margin-top: var(--fan-card-controls-gap);
          overflow: visible;
        }
        .fan-card__controls-inner { display: grid; gap: 10px; }
        .fan-card__controls-inner--cover-combined { gap: 0; }
        .fan-card__cover-controls-pane {
          align-items: center;
          display: grid;
          grid-template: auto / minmax(0, 1fr);
          min-width: 0;
        }
        .fan-card__slider-actions {
          display: inline-flex;
          flex: 0 0 auto;
          gap: 12px;
          justify-content: flex-end;
          padding-block: 10px;
        }
        .fan-card__view--sliders,
        .fan-card__view--arrows {
          grid-area: 1 / 1;
          min-width: 0;
        }
        .fan-card__view--sliders {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .fan-card__view--arrows {
          align-items: center;
          display: flex;
          justify-content: center;
        }
        .fan-card__controls--embedded {
          display: flex;
          justify-content: center;
          margin: 0;
          padding: 0;
          width: 100%;
        }
        .fan-card__transport {
          align-items: center;
          backdrop-filter: blur(18px);
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.14);
          display: inline-flex;
          gap: 6px;
          padding: 8px 10px;
        }
        .fan-card__transport .fan-card__control--in-transport {
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent);
        }
        .fan-card__controls > .fan-card__transport {
          margin-inline: auto;
        }
        .fan-card--cover-ui-arrows .fan-card__view--sliders { display: none; }
        .fan-card--cover-ui-slider .fan-card__view--arrows { display: none; }
        .fan-card--cover-ui-arrows .fan-card__slider-row {
          grid-template-columns: minmax(0, 1fr);
          position: relative;
        }
        .fan-card--cover-ui-arrows .fan-card__slider-actions {
          align-items: center;
          inset-block: 0;
          justify-content: flex-end;
          position: absolute;
          right: 4px;
          z-index: 1;
        }
        .fan-card--cover-ui-arrows.fan-card--cover-ui-toggle-lane .fan-card__slider-row {
          grid-template-columns: minmax(0, 1fr) auto;
          position: static;
        }
        .fan-card--cover-ui-arrows.fan-card--cover-ui-toggle-lane .fan-card__slider-actions {
          inset: auto;
          position: static;
        }
        .fan-card--cover-ui-arrows.fan-card--cover-ui-toggle-lane .fan-card__view--arrows {
          justify-content: center;
        }
        @container cover-card (max-width: ${COVER_CONTROLS_TOGGLE_LANE_MAX_WIDTH}px) {
          .fan-card--cover-ui-arrows .fan-card__slider-row {
            grid-template-columns: minmax(0, 1fr) auto;
            position: static;
          }
          .fan-card--cover-ui-arrows .fan-card__slider-actions {
            inset: auto;
            position: static;
          }
          .fan-card--cover-ui-arrows .fan-card__view--arrows {
            justify-content: center;
          }
        }
        .fan-card__control--active {
          background: color-mix(in srgb, ${accentColor} 18%, ${styles.control.accent_background});
          border-color: color-mix(in srgb, ${accentColor} 48%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: ${styles.control.accent_color};
        }
        .fan-card__slider-row--stack {
          gap: 8px;
          grid-template-columns: minmax(0, 1fr);
          padding-inline: 0;
        }
        .fan-card__controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          padding-inline: 4px;
        }
        .fan-card__control,
        .fan-card__preset {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.16);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          height: ${styles.control.size};
          justify-content: center;
          line-height: 0;
          margin: 0;
          min-width: ${styles.control.size};
          outline: none;
          padding: 0 14px;
          transform-origin: center;
          white-space: nowrap;
        }
        .fan-card__control { padding: 0; width: ${styles.control.size}; }
        .fan-card__control ha-icon { --mdc-icon-size: calc(${styles.control.size} * 0.46); }
        .fan-card__preset.is-active {
          background: ${styles.control.accent_background};
          border-color: color-mix(in srgb, ${accentColor} 48%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: ${styles.control.accent_color};
        }
        .fan-card__slider-row {
          align-items: center;
          display: grid;
          gap: 14px;
          grid-template-columns: minmax(0, 1fr) auto;
          overflow: visible;
          padding-inline: 4px;
        }
        .fan-card__slider-row--solo,
        .fan-card__slider-row--stack {
          grid-template-columns: minmax(0, 1fr);
        }
        .fan-card__slider-wrap {
          --fan-card-slider-input-height: max(44px, calc(${styles.slider_thumb_size} + 12px));
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          display: flex;
          min-height: ${styles.slider_wrap_height};
          padding: 0 14px;
        }
        .fan-card__slider-shell { flex: 1; min-width: 0; position: relative; }
        .fan-card__slider-track {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          height: ${styles.slider_height};
          left: 0;
          overflow: hidden;
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
        }
        .fan-card__slider-track::before {
          background: ${styles.slider_color};
          border-radius: inherit;
          content: "";
          inset: 0;
          position: absolute;
          transform: scaleX(calc(var(--percentage, 0) / 100));
          transform-origin: left center;
        }
        .fan-card__slider {
          -webkit-appearance: none;
          -webkit-tap-highlight-color: transparent;
          appearance: none;
          background: transparent;
          border: 0;
          cursor: pointer;
          height: var(--fan-card-slider-input-height);
          margin: 0;
          opacity: 0;
          outline: none;
          padding: 0;
          position: relative;
          touch-action: pan-y;
          width: 100%;
          z-index: 1;
        }
        .fan-card__slider::-webkit-slider-runnable-track { background: transparent; height: ${styles.slider_height}; }
        .fan-card__slider::-moz-range-track { background: transparent; border: 0; height: ${styles.slider_height}; }
        .fan-card__slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          height: ${styles.slider_thumb_size};
          margin-top: calc((${styles.slider_height} - ${styles.slider_thumb_size}) / 2);
          width: ${styles.slider_thumb_size};
        }
        .fan-card__slider::-moz-range-thumb {
          background: transparent;
          border: 0;
          height: ${styles.slider_thumb_size};
          width: ${styles.slider_thumb_size};
        }
        .fan-card__preset-panel {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          margin-top: 8px;
          min-width: 0;
        }
        :is(.fan-card__icon, .fan-card__control, .fan-card__preset):active:not(:disabled),
        :is(.fan-card__icon, .fan-card__control, .fan-card__preset).is-pressing:not(:disabled) {
          animation: fan-card-button-bounce var(--fan-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }
        @keyframes fan-card-button-bounce {
          0% { transform: scale(1); }
          45% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        @keyframes cover-card-icon-breathe {
          0%, 100% { transform: translateY(0); opacity: .86; }
          50% { transform: translateY(-2px); opacity: 1; }
        }
        @keyframes fan-card-circular-dial-thumb-pop {
          0% { transform: translate(-50%, -50%) scale(1); }
          48% { transform: translate(-50%, -50%) scale(1.24); }
          72% { transform: translate(-50%, -50%) scale(1.09); }
          100% { transform: translate(-50%, -50%) scale(1.15); }
        }
        ${animations.enabled ? "" : `.fan-card, .fan-card * { animation: none !important; transition: none !important; }`}
        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <ha-card
        data-cover-action="body"
        class="fan-card ${isActive ? "is-on" : "is-off"} ${isCircularLayout ? "fan-card--circular" : ""} ${!isCircularLayout && this._isCompactLayout() ? "fan-card--compact" : ""} ${showCopyBlock ? "fan-card--with-copy" : ""}${coverUiClass ? ` ${coverUiClass}` : ""}${coverToggleLaneClass}"
      >
        <div class="fan-card__content">
          <div class="fan-card__hero">
            <button type="button" class="fan-card__icon ${animations.enabled && animations.iconAnimation && isMoving ? "fan-card__icon--active-motion" : ""}" data-cover-action="icon" aria-label="${escapeHtml(tToggleCover)}">
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
              ${isUnavailableState(state) ? `<span class="fan-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${showCopyBlock ? `
              <div class="fan-card__copy">
                <div class="fan-card__headline">
                  ${showTitle ? `<div class="fan-card__title">${escapeHtml(title)}</div>` : ""}
                  ${chips.length ? `<div class="fan-card__chips">${chips.join("")}</div>` : ""}
                </div>
              </div>
            ` : ""}
          </div>
          ${isCircularLayout ? circularControlsMarkup : `
            <div class="fan-card__controls-shell" data-nodalia-tap-shield="true">
              <div class="fan-card__controls-inner${hasSliders ? " fan-card__controls-inner--cover-combined" : ""}">
                ${controlsMarkup}
              </div>
            </div>
          `}
        </div>
      </ha-card>
    `;
    this._lastRenderedIsActive = isActive;
  }
}
