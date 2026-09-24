// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CAMERA_LAYOUT,
  CAMERA_PRESENTATION,
  CARD_TAG,
  EDITOR_TAG,
  MAX_FAILED_IMAGE_URLS,
} from "./camera-constants";
import {
  clamp,
  deepClone,
  escapeHtml,
  isMixedContentUrl,
  isObject,
  sanitizeIframeUrl,
} from "./camera-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./camera-config";
import {
  appendQueryParam,
  applyStubEntity,
  cameraStreamName,
  fireEvent,
  formatRelativeAge,
  isUnavailableState,
  isUsableCameraAccessToken,
  normalizeCameras,
  normalizeTextKey,
  parseCameraProxyAuth,
  parseServiceData,
  resolveGo2rtcPlayerSource,
} from "./camera-helpers";

let _lazyNodaliaCameraCard;
export function loadNodaliaCameraCard() {
  if (_lazyNodaliaCameraCard) {
    return _lazyNodaliaCameraCard;
  }
class NodaliaCameraCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["camera"], entities, entitiesFallback);
  }

  static getEntitySuggestion(hass, entityId) {
    return window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, { domains: ["camera"] });
  }

  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._staticRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._expandedOpen = false;
    this._expandedEntityId = "";
    this._expandedReturnFocus = null;
    this._failedImageUrls = new Set();
    // entityId -> access_token that already 401'd. Map (not FIFO Set) so a live
    // bad token cannot leave quarantine when unrelated failures accumulate.
    this._failedCameraTokens = new Map();
    this._previewAgeTimer = 0;
    this._expandedCardCache = new Map();
    this._expandedCardConfigSignatures = new WeakMap();
    this._expandedStreamMountId = 0;
    this._expandedStreamNode = null;
    this._expandedPortal = null;
    this._go2rtcPrefetchOwner = null;
    this._go2rtcPrefetchSignature = "";
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowKeyDown = this._onShadowKeyDown.bind(this);
    this._onWindowKeyDown = this._onWindowKeyDown.bind(this);
    window.NodaliaUtils?.clearDeferTimers?.(this);
    }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    this.shadowRoot?.addEventListener("keydown", this._onShadowKeyDown);
    window.addEventListener("keydown", this._onWindowKeyDown);
    this._animateContentOnNextRender = true;
    this._prefetchGo2rtcSources();
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    window.NodaliaUtils?.releaseModalFocus?.(this);
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
    this.shadowRoot?.removeEventListener("keydown", this._onShadowKeyDown);
    window.removeEventListener("keydown", this._onWindowKeyDown);
    this._teardownExpandedPortal();
    this._emitOverlayChange(false);
    this._expandedOpen = false;
    this._expandedEntityId = "";
    this._expandedReturnFocus = null;
    this._expandedStreamMountId += 1;
    this._disposeExpandedStream();
    this._expandedCardCache.clear();
    this._clearPreviewAgeTimer();
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._staticRenderSignature = JSON.stringify([
      this._config.camera_streams || [],
      this._config.camera_tap_actions || [],
      this._config.camera_actions || [],
      this._config.expanded_actions || [],
    ]);
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._lastRenderSignature = "";
    this._go2rtcPrefetchSignature = "";
    this._animateContentOnNextRender = true;
    this._prefetchGo2rtcSources();
    if (!this.isConnected) {
      return;
    }
    this._render();
  }

  set hass(hass) {
    const previousHass = this._hass;
    this._hass = hass;
    const prefetchOwner = hass?.connection || hass?.auth || hass || null;
    if (prefetchOwner !== this._go2rtcPrefetchOwner) {
      this._go2rtcPrefetchOwner = prefetchOwner;
      this._go2rtcPrefetchSignature = "";
    }
    this._prefetchGo2rtcSources();
    if (!this.isConnected) {
      return;
    }
    const nextSignature = this._getRenderSignature(hass);
    if (previousHass && this._expandedOpen && this.shadowRoot?.innerHTML) {
      this._lastRenderSignature = nextSignature;
      this._updateExpandedCardsHass();
      this._updateExpandedStreamState();
      return;
    }
    if (previousHass && nextSignature === this._lastRenderSignature && this.shadowRoot?.innerHTML) {
      this._updateExpandedCardsHass();
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
      min_rows: 3,
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
    return true;
  }

  _isMosaicLayout() {
    return true;
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
    const cameraStates = cameraIds.map(entityId => {
      const state = hass?.states?.[entityId];
      return [
        entityId,
        state?.state || "",
        state?.last_updated || "",
        state?.attributes?.entity_picture || "",
        state?.attributes?.access_token || "",
        state?.attributes?.frontend_stream_type || "",
      ].join(":");
    });
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
      this._staticRenderSignature || "",
      this._config?.tap_action || "",
      this._config?.hold_action || "",
      String(this._expandedOpen),
      this._expandedEntityId || "",
      ...cameraStates,
      this._resolveLanguage(),
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "camera:", values }]);
    }
    return values.join("|");
  }

  _getTitle(state, entityId = this._config?.entity) {
    const configuredName = String(this._config?.name ?? "").trim();
    const primaryEntity = this._getCameraIds()[0] || this._config?.entity;
    return (entityId === primaryEntity ? configuredName : "")
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
    if (!state || !this._hass || !entityId || isUnavailableState(state)) {
      return "";
    }

    // Always build from the live access_token. Reusing a stale entity_picture token
    // (or requesting camera_proxy without one) returns 401 on HA 2026.6+ and counts
    // toward http IP bans when snapshots refresh.
    const accessToken = String(state.attributes?.access_token || "").trim();
    if (!isUsableCameraAccessToken(accessToken)) {
      return "";
    }
    if (this._failedCameraTokens.get(entityId) === accessToken) {
      return "";
    }

    const path = `/api/camera_proxy/${entityId}?token=${encodeURIComponent(accessToken)}`;
    const resolved = typeof this._hass.hassUrl === "function"
      ? this._hass.hassUrl(path)
      : path;
    const refreshToken = String(state.last_updated || state.last_changed || accessToken);
    return appendQueryParam(resolved, "nodalia_ts", refreshToken);
  }

  _rememberFailedImageUrl(url) {
    const value = String(url || "").trim();
    if (!value) {
      return;
    }
    this._failedImageUrls.delete(value);
    this._failedImageUrls.add(value);
    while (this._failedImageUrls.size > MAX_FAILED_IMAGE_URLS) {
      this._failedImageUrls.delete(this._failedImageUrls.values().next().value);
    }

    const parsed = parseCameraProxyAuth(value);
    if (!parsed.entityId || !isUsableCameraAccessToken(parsed.accessToken)) {
      return;
    }
    this._failedCameraTokens.set(parsed.entityId, parsed.accessToken);
  }

  _clearFailedCameraToken(entityId, accessToken) {
    const id = String(entityId || "").trim();
    if (!id || !isUsableCameraAccessToken(accessToken)) {
      return;
    }
    if (this._failedCameraTokens.get(id) === accessToken) {
      this._failedCameraTokens.delete(id);
    }
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

  _previewAgeRefreshDelay() {
    const now = Date.now();
    const hasSubMinutePreview = Array.from(this.shadowRoot?.querySelectorAll("[data-camera-preview-age]") || [])
      .some(node => {
        const state = this._getState(String(node.dataset?.cameraEntity || "").trim());
        const updatedAt = new Date(state?.last_updated || state?.last_changed || "").getTime();
        return Number.isFinite(updatedAt) && Math.max(0, now - updatedAt) < 60000;
      });
    return hasSubMinutePreview ? 1000 : 15000;
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
    }, this._previewAgeRefreshDelay());
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
    const navigationPath = window.NodaliaUtils?.sanitizeActionUrl?.(pathValue, {
      allowRelative: true,
      allowHash: true,
    }) || "";
    if (!navigationPath || navigationPath.includes("://")) {
      return;
    }

    if (this._hass?.navigate) {
      this._hass.navigate(navigationPath);
      return;
    }

    if (window?.history?.pushState) {
      window.history.pushState(null, "", navigationPath);
      window.dispatchEvent(new CustomEvent("location-changed", {
        detail: { replace: false },
      }));
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

  _getCameraTapAction(entityId = this._config?.entity) {
    const camera = String(entityId || this._config?.entity || "").trim();
    const configured = (this._config?.camera_tap_actions || []).find(item => item?.camera === camera);
    if (configured) {
      return configured;
    }
    return {
      camera,
      tap_action: this._config?.tap_action || "toggle",
      tap_service: this._config?.tap_service || "",
      tap_service_data: this._config?.tap_service_data || "",
      tap_service_target: this._config?.tap_service_target || "",
      tap_url: this._config?.tap_url || "",
      navigation_path: this._config?.navigation_path || "",
      tap_new_tab: this._config?.tap_new_tab === true,
    };
  }

  _performCameraTapAction(entityId = this._config?.entity, returnTarget = null) {
    const camera = String(entityId || this._config?.entity || "").trim();
    const actionConfig = this._getCameraTapAction(camera);
    const action = normalizeTextKey(actionConfig.tap_action || "toggle");
    switch (action) {
      case "none":
        return;
      case "toggle":
        this._openExpanded(camera, returnTarget);
        return;
      case "more-info":
        this._openMoreInfo(camera);
        return;
      case "service":
        this._callConfiguredService(
          actionConfig.tap_service,
          actionConfig.tap_service_data,
          actionConfig.tap_service_target,
          camera,
        );
        return;
      case "url":
        this._openConfiguredUrl(actionConfig.tap_url, actionConfig.tap_new_tab === true);
        return;
      case "navigate":
        this._navigateToPath(actionConfig.navigation_path || actionConfig.tap_url);
        return;
      case "auto":
        this._openMoreInfo(camera);
        return;
      default:
        this._openExpanded(camera, returnTarget);
    }
  }

  _performTapAction(returnTarget = null) {
    this._performCameraTapAction(this._config?.entity, returnTarget);
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

  _openExpanded(entityId = this._config?.entity, returnTarget = null) {
    if (this._expandedOpen) {
      return;
    }
    const active = returnTarget instanceof HTMLElement ? returnTarget : this.shadowRoot?.activeElement;
    const returnAction = active instanceof HTMLElement ? String(active.dataset?.cameraAction || "") : "";
    const returnEntity = active instanceof HTMLElement ? String(active.dataset?.cameraEntity || "") : "";
    this._expandedReturnFocus = () => {
      const candidates = returnAction === "camera-tap"
        ? Array.from(this.shadowRoot?.querySelectorAll('[data-camera-action="camera-tap"]') || [])
        : Array.from(this.shadowRoot?.querySelectorAll('[data-camera-action="body"]') || []);
      const target = returnEntity
        ? candidates.find(element => element.dataset?.cameraEntity === returnEntity)
        : candidates[0];
      target?.focus?.({ preventScroll: true });
    };
    this._expandedEntityId = String(entityId || this._config?.entity || "").trim();
    this._expandedOpen = true;
    this._lastRenderSignature = "";
    this._render();
    this._emitOverlayChange(true);
  }

  _closeExpanded() {
    if (!this._expandedOpen) {
      return;
    }
    this._expandedOpen = false;
    this._expandedEntityId = "";
    this._expandedStreamMountId += 1;
    this._disposeExpandedStream();
    this._teardownExpandedPortal();
    this._lastRenderSignature = "";
    this._render();
    this._emitOverlayChange(false);
  }

  _emitOverlayChange(open) {
    this.dispatchEvent(new CustomEvent("nodalia-overlay-change", {
      bubbles: true,
      composed: true,
      detail: { open: Boolean(open), source: "camera" },
    }));
  }

  _teardownExpandedPortal() {
    const portal = this._expandedPortal;
    this._expandedPortal = null;
    if (!(portal instanceof HTMLElement)) {
      return;
    }
    portal.removeEventListener("click", this._onShadowClick);
    portal.removeEventListener("keydown", this._onShadowKeyDown);
    portal.remove();
  }

  _shouldPortalExpanded() {
    // Only escape Room Summary stacking. Standalone cards keep the dialog in
    // their shadow root so focus-trap browser tests and SPA taps keep working.
    return Boolean(this.closest?.("nodalia-room-summary-card"));
  }

  _syncExpandedPortal() {
    if (!this._expandedOpen || !this.shadowRoot) {
      this._teardownExpandedPortal();
      return;
    }
    if (!this._shouldPortalExpanded()) {
      this._teardownExpandedPortal();
      return;
    }
    const dialog = this.shadowRoot.querySelector(".camera-card__expanded.is-open")
      || this._expandedPortal?.shadowRoot?.querySelector(".camera-card__expanded.is-open");
    if (!(dialog instanceof HTMLElement)) {
      return;
    }
    if (!(this._expandedPortal instanceof HTMLElement)) {
      const host = document.createElement("div");
      host.setAttribute("data-nodalia-overlay-portal", "camera");
      host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483646;";
      const shadow = host.attachShadow({ mode: "open" });
      shadow.addEventListener("click", this._onShadowClick);
      shadow.addEventListener("keydown", this._onShadowKeyDown);
      document.body.appendChild(host);
      this._expandedPortal = host;
    }
    const root = this._expandedPortal.shadowRoot;
    if (!root) {
      return;
    }
    let style = root.querySelector("style[data-camera-expanded-style]");
    const sourceStyle = this.shadowRoot.querySelector("style");
    if (!(style instanceof HTMLStyleElement)) {
      style = document.createElement("style");
      style.setAttribute("data-camera-expanded-style", "");
      root.prepend(style);
    }
    if (sourceStyle && style.textContent !== sourceStyle.textContent) {
      style.textContent = sourceStyle.textContent;
    }
    root.querySelectorAll(".camera-card__expanded").forEach(node => {
      if (node !== dialog) {
        node.remove();
      }
    });
    if (dialog.parentNode !== root) {
      root.appendChild(dialog);
    }
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
    if (action === "camera-tap") {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._performCameraTapAction(button.dataset.cameraEntity || this._config?.entity, button);
      return;
    }
    if (action === "close-expanded") {
      event.preventDefault();
      event.stopPropagation();
      this._closeExpanded();
      return;
    }
    if (action === "body") {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._performTapAction(button);
    }
  }

  _onShadowKeyDown(event) {
    if (window.NodaliaUtils?.isKeyboardActivationEvent?.(event) !== true) {
      return;
    }
    this._onShadowClick(event);
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
    const previewTapAction = normalizeTextKey(this._getCameraTapAction(entityId).tap_action || "toggle");
    const previewActionLabel = previewTapAction === "toggle"
      ? this._cameraUi("openCamera", "Open camera")
      : title;

    return `
      <div class="camera-card__preview ${layout === "compact" ? "camera-card__preview--compact" : ""} ${layout === "security" ? "camera-card__preview--security" : ""}">
        ${showImage
          ? `<img class="camera-card__image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" data-camera-image="true" data-camera-entity="${escapeHtml(entityId)}" />`
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
          class="camera-card__preview-open"
          data-camera-action="camera-tap"
          data-camera-entity="${escapeHtml(entityId)}"
          aria-label="${escapeHtml(previewActionLabel)}"
        ></button>
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

  _expandedRoot() {
    if (this._expandedPortal?.shadowRoot) {
      return this._expandedPortal.shadowRoot;
    }
    return this.shadowRoot;
  }

  _getExpandedActionsForCamera(entityId = this._expandedEntityId || this._config?.entity) {
    const cameraActions = Array.isArray(this._config?.camera_actions) ? this._config.camera_actions : [];
    const actions = cameraActions.filter(action => action.camera === entityId);
    if (actions.length || entityId !== this._getCameraIds()[0]) {
      return actions;
    }
    return Array.isArray(this._config?.expanded_actions) ? this._config.expanded_actions : [];
  }

  _getCameraStreamConfig(entityId = this._expandedEntityId || this._config?.entity) {
    const configured = (this._config?.camera_streams || []).find(item => item?.camera === entityId);
    return configured || {
      camera: entityId,
      provider: "home_assistant",
      client_id: "frigate",
      base_url: "",
      stream: cameraStreamName(entityId),
      mode: "auto",
      url: "",
      muted: true,
      controls: false,
    };
  }

  _prefetchGo2rtcSources() {
    if (!this._hass || !this._config) {
      return;
    }
    const streamConfigs = (this._config.camera_streams || [])
      .filter(streamConfig => streamConfig?.provider === "frigate_go2rtc");
    const signature = JSON.stringify(streamConfigs.map(streamConfig => [
      streamConfig.client_id,
      streamConfig.stream,
    ]));
    if (!streamConfigs.length || signature === this._go2rtcPrefetchSignature) {
      return;
    }
    this._go2rtcPrefetchSignature = signature;
    void Promise.allSettled(streamConfigs.map(streamConfig => (
      resolveGo2rtcPlayerSource(this._hass, streamConfig)
    ))).then(results => {
      if (
        this._go2rtcPrefetchSignature === signature
        && results.some(result => result.status === "rejected" || !result.value)
      ) {
        this._go2rtcPrefetchSignature = "";
      }
    });
  }

  _updateExpandedStreamState() {
    const node = this._expandedStreamNode;
    if (!node || !this._hass) {
      return;
    }
    if (node.localName === "ha-camera-stream") {
      node.hass = this._hass;
      node.stateObj = this._getState(this._expandedEntityId);
    } else if (node.localName !== "nodalia-go2rtc-player") {
      node.hass = this._hass;
    }
  }

  _disposeExpandedStream() {
    if (typeof this._expandedStreamNode?.disconnect === "function") {
      this._expandedStreamNode.disconnect();
    }
    this._expandedStreamNode = null;
  }

  _setExpandedStreamStatus(state, detail = "") {
    const root = this._expandedRoot();
    if (!root) {
      return;
    }
    const status = root.querySelector("[data-camera-stream-status]");
    const host = root.querySelector("[data-camera-expanded-stream]");
    if (!(status instanceof HTMLElement) || !(host instanceof HTMLElement)) {
      return;
    }
    const errorIcon = status.querySelector("[data-camera-stream-error-icon]");
    const label = status.querySelector("[data-camera-stream-status-label]");
    const loaded = state === "loaded";
    status.hidden = loaded;
    host.classList.toggle("is-loaded", loaded);
    status.classList.toggle("is-error", state === "error");
    if (errorIcon instanceof HTMLElement) {
      errorIcon.hidden = state !== "error";
    }
    if (label) {
      label.textContent = state === "error"
        ? this._cameraUi("liveUnavailable", "Live stream unavailable")
        : this._cameraUi("connectingLive", "Connecting live stream");
    }
    status.title = detail;
  }

  async _mountExpandedStream() {
    const root = this._expandedRoot();
    if (!root || !this._expandedOpen) {
      return;
    }
    const host = root.querySelector("[data-camera-expanded-stream]");
    if (!(host instanceof HTMLElement)) {
      return;
    }
    const entityId = this._expandedEntityId || this._config?.entity;
    const streamConfig = this._getCameraStreamConfig(entityId);
    const nativeGo2rtc = streamConfig.provider === "frigate_go2rtc" || streamConfig.provider === "go2rtc";
    if (streamConfig.provider !== "home_assistant" && !nativeGo2rtc) {
      return;
    }
    const mountId = ++this._expandedStreamMountId;
    if (nativeGo2rtc) {
      this._setExpandedStreamStatus("loading");
      const player = document.createElement("nodalia-go2rtc-player");
      try {
        if (typeof player.configure !== "function") {
          throw new Error("The native go2rtc player is not registered");
        }
        player.classList.add("camera-card__expanded-go2rtc");
        const playbackMode = streamConfig.provider === "frigate_go2rtc" && streamConfig.mode === "auto"
          ? "auto-mse"
          : streamConfig.mode;
        player.configure({
          source: "",
          mode: playbackMode,
          muted: streamConfig.muted,
          controls: streamConfig.controls,
        });
        host.replaceChildren(player);
        this._expandedStreamNode = player;
        if (streamConfig.muted === false) {
          player.primeAudioFromUserGesture?.();
        }
        const sourceConfig = {
          ...streamConfig,
          stream: streamConfig.stream || cameraStreamName(entityId),
        };
        let source;
        try {
          source = await resolveGo2rtcPlayerSource(this._hass, sourceConfig);
        } catch (_firstError) {
          await new Promise(resolve => window.setTimeout(resolve, 350));
          if (mountId !== this._expandedStreamMountId || !this._expandedOpen || !host.isConnected) {
            player.disconnect?.();
            return;
          }
          source = await resolveGo2rtcPlayerSource(this._hass, sourceConfig);
        }
        if (
          mountId !== this._expandedStreamMountId
          || !this._expandedOpen
          || !host.isConnected
        ) {
          player.disconnect?.();
          return;
        }
        if (!source) {
          throw new Error("No usable go2rtc WebSocket endpoint was resolved");
        }
        player.addEventListener("nodalia-go2rtc-loaded", () => {
          if (mountId !== this._expandedStreamMountId) {
            return;
          }
          this._setExpandedStreamStatus("loaded");
          const poster = this.shadowRoot?.querySelector('[data-camera-poster="true"]');
          if (poster instanceof HTMLElement) {
            poster.hidden = true;
          }
        }, { once: true });
        player.addEventListener("nodalia-go2rtc-state", event => {
          if (
            mountId === this._expandedStreamMountId
            && (event.detail?.state === "connecting" || event.detail?.state === "retrying")
          ) {
            this._setExpandedStreamStatus("loading", event.detail?.message || "");
          }
        });
        player.addEventListener("nodalia-go2rtc-error", event => {
          if (mountId !== this._expandedStreamMountId) {
            return;
          }
          this._setExpandedStreamStatus("error", event.detail?.message || "go2rtc error");
        });
        player.configure({
          source,
          mode: playbackMode,
          muted: streamConfig.muted,
          controls: streamConfig.controls,
        });
      } catch (error) {
        player.disconnect?.();
        this._setExpandedStreamStatus("error", error?.message || String(error));
        console.warn("[nodalia-camera-card] Unable to start the go2rtc stream", error);
      }
      return;
    }
    const mountNativeStream = () => {
      if (mountId !== this._expandedStreamMountId || !this._expandedOpen || !host.isConnected) {
        return false;
      }
      const stream = document.createElement("ha-camera-stream");
      stream.hass = this._hass;
      stream.stateObj = this._getState(entityId);
      stream.controls = streamConfig.controls === true;
      stream.muted = streamConfig.muted !== false;
      stream.fitMode = "contain";
      stream.aspectRatio = "16:9";
      host.replaceChildren(stream);
      this._expandedStreamNode = stream;
      return true;
    };

    if (customElements.get("ha-camera-stream")) {
      mountNativeStream();
      return;
    }
    try {
      const helpers = await window.loadCardHelpers?.();
      if (mountId !== this._expandedStreamMountId || !this._expandedOpen || !host.isConnected) {
        return;
      }
      if (customElements.get("ha-camera-stream") && mountNativeStream()) {
        return;
      }
      if (typeof helpers?.createCardElement !== "function") {
        return;
      }
      const fallback = await helpers.createCardElement({
        type: "picture-entity",
        entity: entityId,
        camera_view: "live",
        show_name: false,
        show_state: false,
        fit_mode: "contain",
      });
      if (mountId !== this._expandedStreamMountId || !this._expandedOpen || !host.isConnected) {
        return;
      }
      fallback.hass = this._hass;
      fallback.classList.add("camera-card__expanded-native-fallback");
      host.replaceChildren(fallback);
      this._expandedStreamNode = fallback;
    } catch (_error) {
      // The preview poster remains visible if Home Assistant cannot create a live player.
    }
  }

  _expandedCardTag(entityId) {
    const domain = String(entityId || "").split(".")[0];
    return {
      light: "nodalia-light-card",
      fan: "nodalia-fan-card",
      humidifier: "nodalia-humidifier-card",
      vacuum: "nodalia-vacuum-card",
      cover: "nodalia-cover-card",
      climate: "nodalia-climate-card",
    }[domain] || "nodalia-entity-card";
  }

  _expandedCardConfig(action) {
    const domain = String(action.entity || "").split(".")[0];
    const security = deepClone(this._config?.security || DEFAULT_CONFIG.security);
    if (action.tap_action === "service" && action.tap_service) {
      security.allowed_services = Array.from(new Set([
        ...(Array.isArray(security.allowed_services) ? security.allowed_services : []),
        action.tap_service,
      ]));
    }
    const config = {
      entity: action.entity,
      tap_action: action.tap_action || "toggle",
      tap_new_tab: action.tap_new_tab === true,
      security,
      haptics: deepClone(this._config?.haptics || DEFAULT_CONFIG.haptics),
      animations: {
        ...deepClone(this._config?.animations || DEFAULT_CONFIG.animations),
        content_duration: 0,
        panel_duration: 0,
      },
      compact_layout_mode: domain === "lock" || domain === "switch" || domain === "input_boolean" ? "always" : "never",
    };
    ["name", "icon", "tap_service", "tap_service_data", "tap_service_target", "tap_url", "navigation_path"].forEach(key => {
      if (action[key]) {
        config[key] = (key === "tap_service_data" || key === "tap_service_target") && isObject(action[key])
          ? JSON.stringify(action[key])
          : deepClone(action[key]);
      }
    });
    if (action.icon_color) {
      config.styles = {
        icon: {
          color: action.icon_color,
          on_color: action.icon_color,
          off_color: action.icon_color,
        },
      };
    }
    if (domain === "light") {
      Object.assign(config, {
        auto_expand: true,
        show_brightness: true,
        show_slider_mode_buttons: true,
        show_color_controls: true,
        show_temperature_controls: true,
        show_quick_brightness: false,
        show_quick_color_presets: false,
        show_quick_temperature_presets: false,
        icon_tap_action: action.tap_action || "toggle",
      });
    } else if (domain === "fan") {
      Object.assign(config, {
        show_slider: true,
        show_preset_modes: true,
        show_oscillation: true,
        icon_tap_action: action.tap_action || "toggle",
      });
    } else if (domain === "humidifier") {
      Object.assign(config, {
        show_slider: true,
        show_mode_button: true,
        show_fan_mode_button: true,
        icon_tap_action: action.tap_action || "toggle",
      });
    } else if (domain === "vacuum") {
      Object.assign(config, {
        show_mode_controls: true,
        show_fan_presets: true,
        show_return_to_base: true,
        show_stop: true,
        show_locate: true,
      });
    } else if (domain === "lock" || domain === "switch" || domain === "input_boolean") {
      config.grid_options = {
        columns: 3,
        rows: 1,
      };
    }
    return config;
  }

  _updateExpandedCardsHass() {
    for (const card of this._expandedCardCache.values()) {
      if (this._hass) {
        card.hass = this._hass;
      }
    }
  }

  _mountExpandedCards() {
    const root = this._expandedRoot();
    if (!root || !this._expandedOpen) {
      return;
    }
    const entityId = this._expandedEntityId || this._config?.entity;
    const actions = this._getExpandedActionsForCamera(entityId);
    const validKeys = new Set();
    root.querySelectorAll("[data-camera-expanded-card]").forEach(host => {
      if (!(host instanceof HTMLElement)) {
        return;
      }
      const index = Number(host.dataset.actionIndex);
      const action = actions[index];
      if (!action?.entity) {
        return;
      }
      const tagName = this._expandedCardTag(action.entity);
      const cacheKey = `${entityId}:${index}:${tagName}:${action.entity}`;
      validKeys.add(cacheKey);
      let card = this._expandedCardCache.get(cacheKey);
      if (!card) {
        card = document.createElement(tagName);
        this._expandedCardCache.set(cacheKey, card);
      }
      if (card.parentElement !== host) {
        host.replaceChildren(card);
      }
      const cardConfig = this._expandedCardConfig(action);
      const signature = JSON.stringify(cardConfig);
      if (this._expandedCardConfigSignatures.get(card) !== signature) {
        card.setConfig(cardConfig);
        this._expandedCardConfigSignatures.set(card, signature);
      }
      if (this._hass) {
        card.hass = this._hass;
      }
    });
    for (const [key, card] of this._expandedCardCache) {
      if (!validKeys.has(key)) {
        card.remove();
        this._expandedCardCache.delete(key);
      }
    }
  }

  _renderExpandedActionsMarkup(entityId) {
    const actions = this._getExpandedActionsForCamera(entityId);
    if (!actions.length) {
      return "";
    }
    return `
      <div class="camera-card__expanded-actions">
        ${actions.map((action, index) => `
          <div
            class="camera-card__expanded-card-host"
            data-camera-expanded-card
            data-action-index="${index}"
            data-entity="${escapeHtml(action.entity)}"
          ></div>
        `).join("")}
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
    const streamConfig = this._getCameraStreamConfig(entityId);
    const nativeGo2rtc = streamConfig.provider === "frigate_go2rtc" || streamConfig.provider === "go2rtc";
    const iframeUrl = streamConfig.provider === "iframe" ? sanitizeIframeUrl(streamConfig.url) : "";
    const embeddableStreamUrl = isMixedContentUrl(iframeUrl) ? "" : iframeUrl;

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
              ? `<img class="camera-card__expanded-poster" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" data-camera-poster="true" />`
              : `<div class="camera-card__expanded-placeholder">
                  <ha-icon icon="mdi:cctv"></ha-icon>
                  <span>${escapeHtml(this._cameraUi("cameraUnavailable", "Camera unavailable"))}</span>
                </div>`}
            ${streamConfig.provider === "home_assistant" || streamConfig.provider === "frigate_go2rtc" || streamConfig.provider === "go2rtc"
              ? `<div class="camera-card__expanded-stream" data-camera-expanded-stream></div>`
              : embeddableStreamUrl
                ? `<iframe class="camera-card__expanded-stream-frame" src="${escapeHtml(embeddableStreamUrl)}" title="${escapeHtml(title)}" allow="autoplay; fullscreen" sandbox="allow-scripts allow-forms allow-presentation allow-popups" loading="eager" referrerpolicy="no-referrer"></iframe>`
                : ""}
            ${nativeGo2rtc ? `
              <div class="camera-card__stream-status" data-camera-stream-status>
                <span class="camera-card__stream-indicator" aria-hidden="true">
                  <span class="camera-card__stream-spinner"></span>
                  <ha-icon icon="mdi:alert-circle-outline" data-camera-stream-error-icon hidden></ha-icon>
                </span>
                <span data-camera-stream-status-label>${escapeHtml(this._cameraUi("connectingLive", "Connecting live stream"))}</span>
              </div>
            ` : ""}
          </div>
          ${this._renderExpandedActionsMarkup(entityId)}
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
    const mosaicGap = String(styles.preview?.mosaic_gap ?? DEFAULT_CONFIG.styles.preview.mosaic_gap ?? "0px");
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
          position: relative;
          z-index: ${this._expandedOpen ? "2147483000" : "auto"};
        }

        * { box-sizing: border-box; }

        [data-camera-action="camera-tap"]:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: -3px;
        }

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
        .camera-card__preview-open {
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
          max-width: calc(100% - 24px);
          overflow: hidden;
          padding: 5px 9px;
          pointer-events: none;
          position: absolute;
          text-overflow: ellipsis;
          white-space: nowrap;
          z-index: 2;
        }

        .camera-card__preview-open {
          appearance: none;
          background: transparent;
          border: 0;
          cursor: pointer;
          margin: 0;
          padding: 0;
          width: 100%;
          z-index: 1;
        }

        .camera-card__preview-open:focus-visible {
          box-shadow: inset 0 0 0 3px var(--primary-color);
          outline: 0;
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
          z-index: 2147483001;
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
          overflow: auto;
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

        .camera-card__expanded-poster,
        .camera-card__expanded-stream,
        .camera-card__expanded-stream-frame {
          inset: 0;
          position: absolute;
        }

        .camera-card__expanded-poster {
          height: 100%;
          object-fit: contain;
          width: 100%;
        }

        .camera-card__expanded-stream,
        .camera-card__expanded-stream > *,
        .camera-card__expanded-stream-frame {
          border: 0;
          display: block;
          height: 100%;
          width: 100%;
        }

        .camera-card__expanded-stream ha-camera-stream {
          background: #000;
          object-fit: contain;
        }

        .camera-card__stream-status {
          align-items: center;
          backdrop-filter: blur(12px);
          background: color-mix(in srgb, #111 76%, transparent);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          bottom: 14px;
          color: #fff;
          display: inline-flex;
          font-size: 12px;
          font-weight: 650;
          gap: 7px;
          left: 14px;
          max-width: calc(100% - 28px);
          padding: 7px 10px;
          position: absolute;
          z-index: 2;
        }

        .camera-card__stream-status[hidden] {
          display: none;
        }

        .camera-card__stream-indicator {
          display: grid;
          flex: 0 0 auto;
          height: 17px;
          place-items: center;
          width: 17px;
        }

        .camera-card__stream-spinner {
          animation: camera-card-stream-spin 760ms linear infinite;
          background: conic-gradient(from 0deg, transparent 0 62%, currentColor 84% 100%);
          border-radius: 50%;
          height: 16px;
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0);
          mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0);
          transform-origin: 50% 50%;
          width: 16px;
        }

        .camera-card__stream-indicator ha-icon {
          height: 17px;
          width: 17px;
        }

        .camera-card__stream-indicator ha-icon[hidden],
        .camera-card__stream-status.is-error .camera-card__stream-spinner {
          display: none;
        }

        .camera-card__stream-status.is-error .camera-card__stream-indicator ha-icon {
          color: var(--error-color, #db4437);
        }

        .camera-card__stream-status [data-camera-stream-status-label] {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .camera-card__expanded-actions {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
        }

        .camera-card__expanded-card-host,
        .camera-card__expanded-card-host > * {
          display: block;
          min-width: 0;
          width: 100%;
        }

        @keyframes camera-card-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes camera-card-stream-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 720px) {
          .camera-card__expanded-panel {
            border-radius: 18px 18px 0 0;
            bottom: 0;
            max-height: 92vh;
            max-height: 92dvh;
            top: auto;
            transform: translateX(-50%);
            width: 100%;
          }
        }
        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <ha-card class="camera-card camera-card--${escapeHtml(layout)} ${feedLayout ? "camera-card--feed" : ""}">
        <div class="camera-card__content ${shouldAnimateEntrance ? "camera-card__content--entering" : ""}">
          ${previewMarkup}
          ${showHeader ? `
            <div class="camera-card__header">
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
          this._rememberFailedImageUrl(src);
          this._lastRenderSignature = "";
          this._render();
        }
      }, { once: true });
      node.addEventListener("load", () => {
        const src = node.getAttribute("src");
        if (!src) {
          return;
        }
        this._failedImageUrls.delete(src);
        const parsed = parseCameraProxyAuth(src);
        this._clearFailedCameraToken(parsed.entityId, parsed.accessToken);
      }, { once: true });
    });

    this.shadowRoot.querySelectorAll('img[data-camera-poster="true"]').forEach(node => {
      node.addEventListener("error", () => {
        const src = node.getAttribute("src");
        if (src) {
          this._rememberFailedImageUrl(src);
        }
        node.hidden = true;
      }, { once: true });
    });

    this._mountExpandedCards();
    this._mountExpandedStream();
    this._syncExpandedPortal();
    const expandedDialog = (this._expandedPortal?.shadowRoot || this.shadowRoot)
      ?.querySelector('.camera-card__expanded[role="dialog"]');
    if (expandedDialog instanceof HTMLElement) {
      window.NodaliaUtils?.bindModalFocus?.(this, expandedDialog, {
        initialFocusSelector: ".camera-card__expanded-close",
        restoreFocus: () => {
          const restore = this._expandedReturnFocus;
          this._expandedReturnFocus = null;
          restore?.();
        },
      });
    } else {
      window.NodaliaUtils?.releaseModalFocus?.(this);
    }

    if (shouldAnimateEntrance) {
      this._animateContentOnNextRender = false;
      window.NodaliaUtils?.scheduleDeferTimer?.(this, () => {}, animations.contentDuration + 80);
    }
    this._schedulePreviewAgeRefresh();
  }
}
  _lazyNodaliaCameraCard = NodaliaCameraCard;
  return NodaliaCameraCard;
}
