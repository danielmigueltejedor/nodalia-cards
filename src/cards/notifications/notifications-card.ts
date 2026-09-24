// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  BACKGROUND_MOBILE_NATIVE_HEALTH_TTL_MS,
  CARD_TAG,
  CARD_VERSION,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  LEGACY_BACKGROUND_MOBILE_TOGGLE,
  STORAGE_KEY,
} from "./notifications-constants";
import {
  BACKGROUND_MOBILE_MAX_CHUNKS,
  clamp,
  isObject,
  MOBILE_COOLDOWN_STORAGE_KEY,
  backgroundMobilePayloadOverLimit,
  buildMobileAlertIdentity,
  buildMobileGroupIdentity,
  getNextQuietHoursBoundaryDelay,
  isWithinQuietHours,
  normalizeMobilePolicy,
  resolveMobileDeliveryState,
  resolvePresenceOccupancy,
  resolveSmartEntityMobilePolicy,
} from "./notifications-runtime";
import { DEFAULT_CONFIG, normalizeConfig } from "./notifications-config";
import {
  buildBackgroundMobileWebhookPayload,
  calendarEventDate,
  compactConfig,
  customNotificationTemplateValues,
  entityAreaKey,
  entityMatchTokens,
  escapeHtml,
  escapeSelectorValue,
  fireEvent,
  forecastDate,
  forecastLooksRainy,
  forecastNumber,
  formatNotificationTemplate,
  formatNumber,
  formatTime,
  friendlyName,
  getBackgroundMobileConfigPayload,
  getBackgroundMobileNativeSignature,
  getByPath,
  hasNotificationTapAction,
  isSameLocalDay,
  matchTextIncludes,
  minutesSinceChanged,
  normalizeCalendarFetchResult,
  normalizeEntityList,
  normalizeExternalAlerts,
  normalizeMatchText,
  normalizeNotificationTapAction,
  normalizeSeverity,
  normalizeWeatherForecastResult,
  notificationHash,
  numericState,
  parseServiceData,
  referencedNotificationTemplateEntities,
  sanitizeCssRuntimeValue,
  shouldDarkenNotificationIconGlyph,
  stateIsOff,
  stateIsOn,
  stateIsVacant,
  stateLooksActive,
  stateValue,
  setLegacyBackgroundMobileFallback,
  syncBackgroundMobileNative,
} from "./notifications-helpers";

let _lazyNodaliaNotificationsCard;
export function loadNodaliaNotificationsCard() {
  if (_lazyNodaliaNotificationsCard) {
    return _lazyNodaliaNotificationsCard;
  }
class NodaliaNotificationsCard extends HTMLElement {
  static getStubConfig(hass) {
    const first = prefix => Object.keys(hass?.states || {}).find(entityId => entityId.startsWith(`${prefix}.`)) || "";
    return {
      title: "Notifications",
      calendar_entities: normalizeEntityList([first("calendar")], ["calendar"]),
      weather_entities: normalizeEntityList([first("weather")], ["weather"]),
      fan_entities: normalizeEntityList([first("fan")], ["fan"]),
      vacuum_entities: normalizeEntityList([first("vacuum")], ["vacuum"]),
    };
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig({});
    this._hass = null;
    this._expanded = false;
    this._dismissed = new Set();
    this._calendarEvents = [];
    this._calendarLoading = false;
    this._calendarError = "";
    this._calendarRefreshTimer = 0;
    this._calendarRefreshInFlight = false;
    this._lastCalendarRefresh = 0;
    this._calendarEventsSignature = "";
    this._weatherForecasts = {};
    this._weatherForecastsSignature = "";
    this._weatherRefreshTimer = 0;
    this._weatherRefreshInFlight = false;
    this._lastWeatherRefresh = 0;
    this._lastDismissedHelperState = "";
    this._mobileSent = new Set();
    this._mobileCooldownMap = {};
    this._runtimeExternalAlerts = [];
    this._mobileNotifyTimer = 0;
    this._mobileNotifyQueue = [];
    this._quietHoursWakeTimer = 0;
    this._lastRenderSignature = "";
    this._trackedEntityIdsCache = null;
    this._trackedEntityRevision = null;
    this._trackedEntitiesStamp = "";
    this._trackedEntityIdsLength = 0;
    this._lastNotificationIdsSignature = "";
    this._lastNotifications = [];
    this._backgroundMobileSyncTimer = 0;
    this._pendingBackgroundMobileSync = false;
    this._forceNextBackgroundMobileSync = false;
    this._lastBackgroundMobileSyncSignature = "";
    this._lastBackgroundMobileNativeSignature = "";
    this._lastBackgroundMobileNativeCheckAt = 0;
    this._engineInbox = [];
    this._animateContentOnNextRender = true;
    this._entranceAnimationTimer = 0;
    this._renderPendingAfterEntrance = false;
    this._stackTransition = "";
    this._stackCollapseTimer = 0;
    this._collapsingStack = false;
    this._viewportResizeTimer = 0;
    this._viewVisibilityObserver = null;
    this._hasObservedViewport = false;
    this._wasInViewport = false;
    this._wasHiddenByLayout = false;
    this._lastEntranceReplayAt = 0;
    this._lastRouteKey = "";
    this._onDocVisibility = this._onDocVisibility.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onViewportResize = this._onViewportResize.bind(this);
    this.shadowRoot.addEventListener("click", this._onClick);
    }

  connectedCallback() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this._onDocVisibility);
    }
    this._attachViewVisibilityObserver();
    this._loadDismissed();
    this._loadMobileSent();
    this._loadMobileCooldown();
    this._syncSharedDismissedFromHass(true);
    this._lastRouteKey = this._getRouteKey();
    // Match entity/weather cards: do not render (or consume entrance) before hass — Lovelace
    // typically attaches the element before the first set(hass), and a pre-hass render would
    // clear _animateContentOnNextRender so the real first paint never gets --enter.
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
    if (this._hass) {
      this._renderIfChanged(true);
    }
    this._scheduleBackgroundMobileSync(this._pendingBackgroundMobileSync ? 0 : 320);
    this._refreshCalendarEventsSoon(0);
    this._refreshWeatherForecastsSoon(0);
    this._scheduleQuietHoursWake();
    window.addEventListener("resize", this._onViewportResize, { passive: true });
    window.addEventListener("orientationchange", this._onViewportResize, { passive: true });
  }

  disconnectedCallback() {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this._onDocVisibility);
    }
    this._detachViewVisibilityObserver();
    window.removeEventListener("resize", this._onViewportResize);
    window.removeEventListener("orientationchange", this._onViewportResize);
    if (this._stackCollapseTimer) {
      window.clearTimeout(this._stackCollapseTimer);
      this._stackCollapseTimer = 0;
    }
    if (this._viewportResizeTimer) {
      window.clearTimeout(this._viewportResizeTimer);
      this._viewportResizeTimer = 0;
    }
    if (this._calendarRefreshTimer) {
      window.clearTimeout(this._calendarRefreshTimer);
      this._calendarRefreshTimer = 0;
    }
    if (this._weatherRefreshTimer) {
      window.clearTimeout(this._weatherRefreshTimer);
      this._weatherRefreshTimer = 0;
    }
    if (this._mobileNotifyTimer) {
      window.clearTimeout(this._mobileNotifyTimer);
      this._mobileNotifyTimer = 0;
    }
    this._mobileNotifyQueue = [];
    if (this._quietHoursWakeTimer) {
      window.clearTimeout(this._quietHoursWakeTimer);
      this._quietHoursWakeTimer = 0;
    }
    if (this._backgroundMobileSyncTimer) {
      window.clearTimeout(this._backgroundMobileSyncTimer);
      this._backgroundMobileSyncTimer = 0;
    }
    if (this._entranceAnimationTimer) {
      window.clearTimeout(this._entranceAnimationTimer);
      this._entranceAnimationTimer = 0;
    }
    this._renderPendingAfterEntrance = false;
    this._calendarRefreshInFlight = false;
    this._weatherRefreshInFlight = false;
    window.NodaliaUtils?.clearDeferTimers?.(this);
  }

  _scheduleEntranceAnimationReset(delay) {
    if (this._entranceAnimationTimer) {
      window.clearTimeout(this._entranceAnimationTimer);
      this._entranceAnimationTimer = 0;
    }

    const safeDelay = clamp(Math.round(Number(delay) || 0), 0, 3000);
    if (!safeDelay || typeof window === "undefined") {
      this._animateContentOnNextRender = false;
      return;
    }

    this._entranceAnimationTimer = window.setTimeout(() => {
      this._entranceAnimationTimer = 0;
      if (!this.isConnected) {
        return;
      }
      this._animateContentOnNextRender = false;
      if (this._renderPendingAfterEntrance) {
        this._renderPendingAfterEntrance = false;
        this._renderIfChanged(true);
      }
    }, safeDelay);
  }

  _replayEntranceAnimation(options = {}) {
    const force = options?.force === true;
    const now = Date.now();
    if (!force && now - this._lastEntranceReplayAt < 260) {
      return;
    }
    this._lastEntranceReplayAt = now;
    if (this._entranceAnimationTimer) {
      window.clearTimeout(this._entranceAnimationTimer);
      this._entranceAnimationTimer = 0;
    }
    this._renderPendingAfterEntrance = false;
    this._animateContentOnNextRender = true;
    this._lastNotificationIdsSignature = "";
    this._lastRenderSignature = "";
    if (this._hass) {
      this._renderIfChanged(true);
    }
  }

  _getRouteKey() {
    if (typeof window === "undefined" || !window.location) {
      return "";
    }
    const { pathname = "", search = "", hash = "" } = window.location;
    return `${pathname}${search}${hash}`;
  }

  _onDocVisibility() {
    if (typeof document === "undefined" || document.visibilityState !== "visible") {
      return;
    }
    this._replayEntranceAnimation();
  }

  _attachViewVisibilityObserver() {
    if (this._viewVisibilityObserver || typeof IntersectionObserver !== "function") {
      return;
    }
    this._viewVisibilityObserver = new IntersectionObserver(
      entries => {
        if (!this.isConnected) {
          return;
        }
        const visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0);
        const hadViewportObservation = this._hasObservedViewport;
        this._hasObservedViewport = true;
        if (visible === this._wasInViewport) {
          return;
        }
        this._wasInViewport = visible;
        if (!visible) {
          this._wasHiddenByLayout = entries.some(entry => {
            const rect = entry.boundingClientRect;
            return rect && rect.width === 0 && rect.height === 0;
          });
          return;
        }
        this._wasHiddenByLayout = false;
        // The first visible observation belongs to the normal initial paint, which
        // already carries the entrance class. Replaying here restarts that animation.
        if (!hadViewportObservation) {
          return;
        }
        this._replayEntranceAnimation();
      },
      { threshold: [0, 0.01] },
    );
    this._viewVisibilityObserver.observe(this);
  }

  _detachViewVisibilityObserver() {
    if (!this._viewVisibilityObserver) {
      return;
    }
    this._viewVisibilityObserver.disconnect();
    this._viewVisibilityObserver = null;
    this._hasObservedViewport = false;
    this._wasInViewport = false;
    this._wasHiddenByLayout = false;
  }

  _onViewportResize() {
    if (this._viewportResizeTimer) {
      window.clearTimeout(this._viewportResizeTimer);
    }
    this._viewportResizeTimer = window.setTimeout(() => {
      this._viewportResizeTimer = 0;
      if (!this.isConnected) {
        return;
      }
      const nextSignature = this._getRenderSignature();
      if (nextSignature === this._lastRenderSignature && this.shadowRoot?.innerHTML) {
        fireEvent(this, "iron-resize", {});
        return;
      }
      this._lastRenderSignature = "";
      this._renderIfChanged(true);
      fireEvent(this, "iron-resize", {});
    }, 160);
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._expanded = false;
    this._animateContentOnNextRender = true;
    this._loadDismissed();
    this._loadMobileSent();
    this._loadMobileCooldown();
    this._syncSharedDismissedFromHass(true);
    this._invalidateTrackedEntityStampCache();
    this._lastRenderSignature = "";
    if (this._hass) {
      this._renderIfChanged(true);
    }
    this._scheduleBackgroundMobileSync(320, { force: true });
    this._refreshCalendarEventsSoon(0);
    this._refreshWeatherForecastsSoon(0);
    this._scheduleQuietHoursWake();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.isConnected) {
      return;
    }
    const nextRouteKey = this._getRouteKey();
    if (nextRouteKey && nextRouteKey !== this._lastRouteKey) {
      this._lastRouteKey = nextRouteKey;
      this._replayEntranceAnimation({ force: true });
    }
    this._syncTrackedEntitiesStamp(hass);
    this._syncSharedDismissedFromHass();
    const nextSignature = this._getRenderSignature(hass);
    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      this._scheduleBackgroundMobileSync(this._pendingBackgroundMobileSync ? 0 : 320);
      return;
    }
    this._refreshCalendarEventsSoon();
    this._refreshWeatherForecastsSoon();
    this._lastRenderSignature = nextSignature;
    this._renderIfChanged(true);
    this._scheduleBackgroundMobileSync();
  }

  getCardSize() {
    const count = this._getNotifications().length;
    const hiddenCount = Math.max(0, count - (this._config?.max_visible || 1));
    const collapsedStackDepth = this._expanded ? 0 : Math.min(4, hiddenCount);
    return Math.max(3, Math.min(10, 2 + Math.ceil(Math.min(count, this._expanded ? 5 : 2) * 1.2) + collapsedStackDepth));
  }

  getGridOptions() {
    return {
      columns: "full",
      min_columns: 2,
      min_rows: 2,
      rows: "auto",
    };
  }

  _getBackgroundMobileConfigPayload() {
    return getBackgroundMobileConfigPayload(this._config, this._hass);
  }

  _buildBackgroundMobileWebhookPayload(options = {}) {
    return buildBackgroundMobileWebhookPayload(this._config, this._hass, options);
  }

  _scheduleBackgroundMobileSync(delay = 320, options = {}) {
    const config = this._config?.background_mobile || {};
    if (options.force === true) {
      this._forceNextBackgroundMobileSync = true;
    }
    if (config.enabled !== true || !this._hass || !this.isConnected) {
      this._pendingBackgroundMobileSync = config.enabled === true;
      return;
    }
    this._pendingBackgroundMobileSync = false;
    if (this._backgroundMobileSyncTimer) {
      window.clearTimeout(this._backgroundMobileSyncTimer);
    }
    this._backgroundMobileSyncTimer = window.setTimeout(() => {
      this._backgroundMobileSyncTimer = 0;
      void this._syncBackgroundMobileConfig();
    }, Math.max(0, Math.min(3000, Number(delay) || 0)));
  }

  async _syncBackgroundMobileConfig() {
    const webhookId = String(this._config?.background_mobile?.webhook || "").trim();
    if (this._config?.background_mobile?.enabled !== true || !this.isConnected) {
      return false;
    }
    const expectedNative = getBackgroundMobileNativeSignature(this._config, this._hass);
    const previousNative = String(this._lastBackgroundMobileNativeSignature || "");
    const force = this._forceNextBackgroundMobileSync === true;
    this._forceNextBackgroundMobileSync = false;
    const nativeRecentlyChecked = Date.now() - this._lastBackgroundMobileNativeCheckAt < BACKGROUND_MOBILE_NATIVE_HEALTH_TTL_MS;
    if (
      !force
      && nativeRecentlyChecked
      && (previousNative === expectedNative.signature || previousNative === `active:${expectedNative.profileId}`)
    ) {
      const helperStandby = await setLegacyBackgroundMobileFallback(this._hass, false);
      const webhookStandby = webhookId
        ? await this._syncLegacyBackgroundMobileFallback(webhookId, false)
        : true;
      const legacyStandby = helperStandby && webhookStandby;
      this._pendingBackgroundMobileSync = !legacyStandby;
      return true;
    }
    this._lastBackgroundMobileNativeCheckAt = Date.now();
    const native = await syncBackgroundMobileNative(this._hass, this._config);
    if (native.synced) {
      const dismissalsChanged = this._mergeNativeDismissed(native.dismissed);
      this._lastBackgroundMobileNativeSignature = native.signature;
      const helperStandby = await setLegacyBackgroundMobileFallback(this._hass, false);
      const webhookStandby = webhookId
        ? await this._syncLegacyBackgroundMobileFallback(webhookId, false, force)
        : true;
      const legacyStandby = helperStandby && webhookStandby;
      this._pendingBackgroundMobileSync = !legacyStandby;
      void this._loadEngineInbox();
      if (dismissalsChanged) {
        this._renderIfChanged(true);
      }
      return true;
    }
    // A websocket timeout or profile write error is not Engine-down. Waking a
    // leftover package here would duplicate every notification Engine delivers.
    if (native.transient === true || native.available === true) {
      this._pendingBackgroundMobileSync = true;
      return false;
    }
    this._lastBackgroundMobileNativeSignature = "";
    if (!webhookId) {
      await setLegacyBackgroundMobileFallback(this._hass, true);
      this._pendingBackgroundMobileSync = true;
      return false;
    }
    if (
      this._config?.security?.allow_webhooks_for_non_admin === false &&
      !this._hass?.user?.is_admin
    ) {
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn("Nodalia Notifications Card: background mobile sync webhook blocked for non-admin user (security.allow_webhooks_for_non_admin=false).");
      }
      await setLegacyBackgroundMobileFallback(this._hass, true);
      return false;
    }
    const payload = this._buildBackgroundMobileWebhookPayload({ enabled: true });
    if (backgroundMobilePayloadOverLimit(payload)) {
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn(
          `Nodalia Notifications Card: background mobile config exceeds ${BACKGROUND_MOBILE_MAX_CHUNKS} chunks (${payload.chunk_count}); sync skipped.`,
        );
      }
      this._lastBackgroundMobileSyncSignature = "";
      this._pendingBackgroundMobileSync = true;
      await setLegacyBackgroundMobileFallback(this._hass, true);
      return false;
    }
    const signature = `${webhookId}:${payload.config_hash}:${payload.chunk_count}`;
    if (!force && signature === this._lastBackgroundMobileSyncSignature) {
      await setLegacyBackgroundMobileFallback(this._hass, true);
      return true;
    }
    const post = typeof window !== "undefined" && window.NodaliaUtils?.postHomeAssistantWebhook;
    if (typeof post !== "function") {
      this._pendingBackgroundMobileSync = true;
      return false;
    }
    try {
      const ok = Boolean(await post(webhookId, payload, this._hass));
      if (ok) {
        this._lastBackgroundMobileSyncSignature = signature;
        this._pendingBackgroundMobileSync = false;
        await setLegacyBackgroundMobileFallback(this._hass, true);
      } else {
        this._pendingBackgroundMobileSync = true;
      }
      return ok;
    } catch (_error) {
      this._pendingBackgroundMobileSync = true;
      return false;
    }
  }

  async _syncLegacyBackgroundMobileFallback(webhookId, enabled, force = false) {
    if (
      this._config?.security?.allow_webhooks_for_non_admin === false
      && !this._hass?.user?.is_admin
    ) {
      return false;
    }
    const payload = this._buildBackgroundMobileWebhookPayload({ enabled });
    if (backgroundMobilePayloadOverLimit(payload)) {
      return false;
    }
    const signature = `${webhookId}:${payload.config_hash}:${payload.chunk_count}`;
    if (!force && signature === this._lastBackgroundMobileSyncSignature) {
      return true;
    }
    const post = typeof window !== "undefined" && window.NodaliaUtils?.postHomeAssistantWebhook;
    if (typeof post !== "function") {
      return false;
    }
    try {
      const ok = Boolean(await post(webhookId, payload, this._hass));
      if (ok) {
        this._lastBackgroundMobileSyncSignature = signature;
      }
      return ok;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Pulls the Engine inbox after a successful background sync so dismissals recorded on other
   * devices are reflected here. The Engine remains the authority for delivered-alert history.
   */
  async _loadEngineInbox() {
    const backend = typeof window !== "undefined" ? window.NodaliaBackend : null;
    if (!backend || typeof backend.listNotificationInbox !== "function" || !this._hass) {
      return false;
    }
    try {
      const status = await backend.status(this._hass, { silent: true });
      if (!backend.hasCapability(status, "notifications_inbox")) {
        return false;
      }
      const result = await backend.listNotificationInbox(this._hass, backend.notificationProfileId(this._config));
      const inbox = Array.isArray(result?.inbox) ? result.inbox : [];
      this._engineInbox = inbox;
      const dismissed = inbox
        .filter(entry => entry?.dismissed === true)
        .map(entry => String(entry?.alert_id || entry?.id || ""))
        .filter(Boolean);
      if (this._mergeNativeDismissed(dismissed)) {
        this._renderIfChanged(true);
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  _getStorageKey() {
    return this._config.storage_key || STORAGE_KEY;
  }

  _getMobileStorageKey() {
    return `${this._getStorageKey()}:mobile_sent`;
  }

  _dismissKey(id) {
    return notificationHash(id);
  }

  _nativeDismissalIds(id) {
    const raw = String(id || "").trim();
    if (!raw) {
      return [];
    }
    const result = [raw];
    const comfort = raw.match(/^comfort:(hot|cold):(?:climate:)?([^:]+)/);
    if (comfort) {
      result.push(`${comfort[1]}:${comfort[2]}`);
    }
    const humidity = raw.match(/^humidity:([^:]+):(high|low)(?:$|:)/);
    if (humidity) {
      result.push(`humidity_${humidity[2]}:${humidity[1]}`);
    }
    const match = raw.match(
      /^(hot|cold|humidity_high|humidity_low|battery_low|humidifier_fill_low|humidifier_fill_full|ink_low|door|window|motion|vacuum|rain|media_absence|outdoor_hot|outdoor_cold):([^:]+)(?::|$)/,
    );
    if (match) {
      result.push(`${match[1]}:${match[2]}`);
    }
    return [...new Set(result)];
  }

  _mergeNativeDismissed(tokens) {
    if (!Array.isArray(tokens) || !tokens.length) {
      return false;
    }
    let changed = false;
    tokens.forEach(token => {
      const value = String(token || "").trim();
      if (value && !this._dismissed.has(value)) {
        this._dismissed.add(value);
        changed = true;
      }
    });
    if (changed && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(this._getStorageKey(), JSON.stringify([...this._dismissed].slice(-250)));
      } catch (_error) {
        // Native storage remains authoritative if browser storage is unavailable.
      }
    }
    return changed;
  }

  _saveNativeDismissed(ids) {
    const backend = typeof window !== "undefined" ? window.NodaliaBackend : null;
    if (!backend || !this._hass) {
      return;
    }
    const profileId = backend.notificationProfileId(this._config);
    [...new Set((Array.isArray(ids) ? ids : [ids]).flatMap(id => this._nativeDismissalIds(id)))]
      .forEach(id => {
        void backend.status(this._hass, { silent: true })
          .then(status => {
            if (status?.available && status.capabilities?.includes("notifications_shared_dismissals")) {
              return backend.dismissNotification(this._hass, id, profileId);
            }
            return null;
          })
          .catch(() => {});
      });
  }

  _parseDismissedTokens(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item || "").trim()).filter(Boolean);
      }
    } catch (_error) {
      // Not JSON, continue with compact helper formats.
    }
    const body = raw.startsWith("v1:") ? raw.slice(3) : raw;
    return body
      .split(/[|,\n]/)
      .map(item => String(item || "").trim())
      .filter(Boolean);
  }

  _loadDismissed() {
    if (typeof localStorage === "undefined") {
      this._dismissed = new Set();
      return;
    }
    try {
      const raw = JSON.parse(localStorage.getItem(this._getStorageKey()) || "[]");
      this._dismissed = new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch (_error) {
      this._dismissed = new Set();
    }
  }

  _loadMobileSent() {
    if (typeof localStorage === "undefined") {
      this._mobileSent = new Set();
      return;
    }
    try {
      const raw = JSON.parse(localStorage.getItem(this._getMobileStorageKey()) || "[]");
      this._mobileSent = new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch (_error) {
      this._mobileSent = new Set();
    }
  }

  _saveDismissed() {
    if (typeof localStorage === "undefined") {
      this._saveSharedDismissed();
      return;
    }
    try {
      localStorage.setItem(this._getStorageKey(), JSON.stringify([...this._dismissed].slice(-250)));
    } catch (_error) {
      // Ignore storage quota/private mode errors.
    }
    this._saveSharedDismissed();
  }

  _saveMobileSent() {
    if (typeof localStorage === "undefined") {
      return;
    }
    try {
      localStorage.setItem(this._getMobileStorageKey(), JSON.stringify([...this._mobileSent].slice(-180)));
    } catch (_error) {
      // Ignore storage quota/private mode errors.
    }
  }

  _getMobileCooldownStorageKey() {
    return `${this._getStorageKey()}:${MOBILE_COOLDOWN_STORAGE_KEY}`;
  }

  _loadMobileCooldown() {
    if (typeof localStorage === "undefined") {
      this._mobileCooldownMap = {};
      return;
    }
    try {
      const raw = JSON.parse(localStorage.getItem(this._getMobileCooldownStorageKey()) || "{}");
      this._mobileCooldownMap = isObject(raw) ? raw : {};
    } catch (_error) {
      this._mobileCooldownMap = {};
    }
  }

  _saveMobileCooldown() {
    if (typeof localStorage === "undefined") {
      return;
    }
    try {
      const entries = Object.entries(this._mobileCooldownMap || {})
        .sort((left, right) => Number(right[1]) - Number(left[1]))
        .slice(0, 240);
      this._mobileCooldownMap = Object.fromEntries(entries);
      localStorage.setItem(this._getMobileCooldownStorageKey(), JSON.stringify(this._mobileCooldownMap));
    } catch (_error) {
      // Ignore storage quota/private mode errors.
    }
  }

  _isMobileCooldownActive(item) {
    const mobileCfg = this._config?.mobile_notifications || {};
    const cooldownMinutes = Math.max(0, Number(mobileCfg.cooldown_minutes) || 0);
    if (!cooldownMinutes) {
      return false;
    }
    const windowMs = cooldownMinutes * 60 * 1000;
    const now = Date.now();
    const keys = [buildMobileAlertIdentity(item)];
    if (mobileCfg.group_similar === true) {
      keys.push(buildMobileGroupIdentity(item));
    }
    return keys.some(key => {
      const timestamp = Number(this._mobileCooldownMap?.[key]);
      return Number.isFinite(timestamp) && now - timestamp < windowMs;
    });
  }

  _recordMobileCooldown(item) {
    const mobileCfg = this._config?.mobile_notifications || {};
    const cooldownMinutes = Math.max(0, Number(mobileCfg.cooldown_minutes) || 0);
    if (!cooldownMinutes || !item) {
      return;
    }
    const now = Date.now();
    const keys = [buildMobileAlertIdentity(item)];
    if (mobileCfg.group_similar === true) {
      keys.push(buildMobileGroupIdentity(item));
    }
    keys.forEach(key => {
      if (key) {
        this._mobileCooldownMap[key] = now;
      }
    });
    this._saveMobileCooldown();
  }

  _resolveMobileDeliveryForItem(item) {
    const mobileCfg = this._config?.mobile_notifications || {};
    const targets = [
      ...(Array.isArray(mobileCfg.entities) ? mobileCfg.entities : []),
      ...(Array.isArray(mobileCfg.services) ? mobileCfg.services : []),
    ];
    return resolveMobileDeliveryState({
      alertPolicy: item?.mobilePolicy,
      defaultPolicy: mobileCfg.default_policy,
      globalMobileEnabled: mobileCfg.enabled === true,
      minSeverity: mobileCfg.min_severity,
      alertSeverity: item?.severity,
      backgroundMobileEnabled: this._config?.background_mobile?.enabled === true,
      notifyTargetsConfigured: targets.length > 0,
      mobileContext: this._config?.mobile_context,
      quietHours: this._config?.mobile_context?.quiet_hours,
      presenceOccupancy: resolvePresenceOccupancy(this._hass, this._config?.presence_entity),
      cooldownActive: this._isMobileCooldownActive(item),
      now: new Date(),
    });
  }

  _enrichMobileDelivery(item) {
    const mobileDeliveryState = this._resolveMobileDeliveryForItem(item);
    return {
      ...item,
      mobileDeliveryState,
      mobilePolicy: normalizeMobilePolicy(item?.mobilePolicy ?? "auto"),
    };
  }

  static pushExternalAlerts(target, alerts = []) {
    if (!target || typeof target._ingestRuntimeExternalAlerts !== "function") {
      return false;
    }
    target._ingestRuntimeExternalAlerts(alerts);
    return true;
  }

  _ingestRuntimeExternalAlerts(alerts = []) {
    this._runtimeExternalAlerts = normalizeExternalAlerts(alerts);
    this._renderIfChanged(true);
  }

  _syncSharedDismissedFromHass(force = false) {
    const entityId = this._config.dismissed_entity;
    if (!entityId || !this._hass) {
      return false;
    }
    const rawState = String(this._hass.states?.[entityId]?.state || "").trim();
    if (!force && rawState === this._lastDismissedHelperState) {
      return false;
    }
    this._lastDismissedHelperState = rawState;
    const tokens = this._parseDismissedTokens(rawState);
    if (!tokens.length) {
      return false;
    }
    let changed = false;
    tokens.forEach(token => {
      if (!this._dismissed.has(token)) {
        this._dismissed.add(token);
        changed = true;
      }
    });
    if (changed && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(this._getStorageKey(), JSON.stringify([...this._dismissed].slice(-250)));
      } catch (_error) {
        // Ignore storage quota/private mode errors.
      }
    }
    return changed;
  }

  _saveSharedDismissed() {
    const entityId = this._config.dismissed_entity;
    if (!entityId || !this._hass || typeof this._hass.callService !== "function") {
      return;
    }
    const hashes = [...new Set([...this._dismissed]
      .map(id => (String(id).includes(":") ? this._dismissKey(id) : String(id)))
      .filter(Boolean))]
      .slice(-30);
    const value = hashes.length ? `v1:${hashes.join("|")}` : "";
    if (value === this._lastDismissedHelperState) {
      return;
    }
    this._lastDismissedHelperState = value;
    Promise.resolve().then(() => this._hass.callService("input_text", "set_value", {
      entity_id: entityId,
      value,
    })).catch(() => {
      // Helper sync is best-effort; the local dismiss state still applies.
    });
  }

  _calendarDismissalsHydrated() {
    return !this._config.calendar_entities.length || this._lastCalendarRefresh > 0;
  }

  _weatherDismissalsHydrated() {
    return !this._config.weather_entities.length || this._lastWeatherRefresh > 0;
  }

  _canPruneDismissedToken(id) {
    const text = String(id || "");
    if (!text) {
      return true;
    }
    if (!text.includes(":")) {
      return this._calendarDismissalsHydrated() && this._weatherDismissalsHydrated();
    }
    if (text.startsWith("calendar:")) {
      return this._calendarDismissalsHydrated();
    }
    if (text.startsWith("weather:")) {
      return this._weatherDismissalsHydrated();
    }
    return true;
  }

  _pruneDismissed(currentIds) {
    const keep = new Set(currentIds);
    currentIds.forEach(id => {
      keep.add(this._dismissKey(id));
      this._nativeDismissalIds(id).forEach(nativeId => keep.add(nativeId));
    });
    let changed = false;
    this._dismissed.forEach(id => {
      if (!this._canPruneDismissedToken(id)) {
        return;
      }
      if (!keep.has(id)) {
        this._dismissed.delete(id);
        changed = true;
      }
    });
    if (changed) {
      this._saveDismissed();
    }
  }

  _isDismissed(item) {
    if (!item?.id) {
      return false;
    }
    return this._dismissed.has(item.id)
      || this._dismissed.has(this._dismissKey(item.id))
      || this._nativeDismissalIds(item.id).some(id => this._dismissed.has(id));
  }

  _refreshCalendarEventsSoon(delay = null) {
    if (!this.isConnected || !this._hass || !this._config.calendar_entities.length) {
      return;
    }
    if (this._calendarRefreshTimer && delay === null) {
      return;
    }
    const intervalMs = this._config.refresh_interval * 1000;
    const elapsed = Date.now() - this._lastCalendarRefresh;
    const nextDelay = delay === null ? Math.max(0, intervalMs - elapsed) : Math.max(0, delay);
    if (this._calendarRefreshTimer) {
      window.clearTimeout(this._calendarRefreshTimer);
    }
    this._calendarRefreshTimer = window.setTimeout(() => {
      this._calendarRefreshTimer = 0;
      this._refreshCalendarEvents();
    }, nextDelay);
  }

  async _refreshCalendarEvents() {
    if (!this._hass || !this._config.calendar_entities.length || this._calendarRefreshInFlight) {
      return;
    }
    if (typeof this._hass.callApi !== "function") {
      this._calendarEvents = [];
      this._calendarError = this._text("messages.calendarQueryFailed", "Could not query calendars.");
      this._renderIfChanged(true);
      return;
    }
    this._calendarRefreshInFlight = true;
    this._calendarLoading = true;
    this._renderIfChanged(true);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const events = [];
    try {
      for (const entityId of this._config.calendar_entities) {
        if (!this.isConnected) {
          return;
        }
        const path = `calendars/${encodeURIComponent(entityId)}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
        const raw = await this._hass.callApi("GET", path);
        if (!this.isConnected) {
          return;
        }
        normalizeCalendarFetchResult(raw).forEach(event => {
          events.push({ ...event, _entity: entityId });
        });
      }
      events.sort((left, right) => {
        const a = calendarEventDate(left.start)?.getTime() || 0;
        const b = calendarEventDate(right.start)?.getTime() || 0;
        return a - b;
      });
      this._calendarEvents = events;
      this._calendarError = "";
      this._lastCalendarRefresh = Date.now();
      this._rebuildCalendarEventsSignature();
    } catch (_error) {
      this._calendarEvents = [];
      this._calendarError = this._text("messages.calendarTodayLoadFailed", "Could not load today's calendar events.");
    } finally {
      this._calendarLoading = false;
      this._calendarRefreshInFlight = false;
      if (!this.isConnected) {
        return;
      }
      this._renderIfChanged(true);
      this._refreshCalendarEventsSoon();
    }
  }

  _refreshWeatherForecastsSoon(delay = null) {
    if (!this.isConnected || !this._hass || !this._config.weather_entities.length) {
      return;
    }
    if (this._weatherRefreshTimer && delay === null) {
      return;
    }
    const intervalMs = Math.max(this._config.refresh_interval * 1000, 10 * 60 * 1000);
    const elapsed = Date.now() - this._lastWeatherRefresh;
    const nextDelay = delay === null ? Math.max(0, intervalMs - elapsed) : Math.max(0, delay);
    if (this._weatherRefreshTimer) {
      window.clearTimeout(this._weatherRefreshTimer);
    }
    this._weatherRefreshTimer = window.setTimeout(() => {
      this._weatherRefreshTimer = 0;
      this._refreshWeatherForecasts();
    }, nextDelay);
  }

  async _refreshWeatherForecasts() {
    if (!this._hass || !this._config.weather_entities.length || this._weatherRefreshInFlight) {
      return;
    }
    this._weatherRefreshInFlight = true;
    const next = {};
    const legacyForecasts = () => {
      this._config.weather_entities.forEach(entityId => {
        const rows = normalizeWeatherForecastResult(this._hass.states?.[entityId]?.attributes?.forecast, entityId);
        if (rows.length && !next[entityId]?.length) {
          next[entityId] = rows;
        }
      });
    };
    try {
      if (typeof this._hass.callWS === "function") {
        for (const forecastType of ["hourly", "daily"]) {
          if (!this.isConnected) {
            return;
          }
          try {
            const response = await this._hass.callWS({
              type: "weather/get_forecasts",
              entity_ids: this._config.weather_entities,
              forecast_type: forecastType,
            });
            this._config.weather_entities.forEach(entityId => {
              const rows = normalizeWeatherForecastResult(response, entityId);
              if (rows.length && !next[entityId]?.length) {
                next[entityId] = rows;
              }
            });
            if (this._config.weather_entities.every(entityId => next[entityId]?.length)) {
              break;
            }
          } catch (_error) {
            // Some weather integrations expose daily but not hourly forecasts.
          }
        }
      }
      legacyForecasts();
      this._weatherForecasts = next;
      this._lastWeatherRefresh = Date.now();
      this._rebuildWeatherForecastsSignature();
    } catch (_error) {
      legacyForecasts();
      this._weatherForecasts = next;
      this._lastWeatherRefresh = Date.now();
      this._rebuildWeatherForecastsSignature();
    } finally {
      this._weatherRefreshInFlight = false;
      if (!this.isConnected) {
        return;
      }
      this._renderIfChanged(true);
      this._refreshWeatherForecastsSoon();
    }
  }

  _getRawNotifications() {
    const items = [];
    const hass = this._hass;
    const now = new Date();
    const add = item => {
      if (!item?.id || !item.title) {
        return;
      }
      const severity = normalizeSeverity(item.severity || "info");
      items.push({
        action: null,
        createdAt: Date.now(),
        icon: "mdi:bell-outline",
        message: "",
        source: "",
        ...item,
        severity,
      });
    };

    this._calendarEvents.forEach(event => {
      const start = calendarEventDate(event.start);
      const end = calendarEventDate(event.end) || start;
      if (!start || !isSameLocalDay(start, now) || (end && end.getTime() < now.getTime())) {
        return;
      }
      const summary = String(event.summary || event.title || this._text("fallbackEvent", "Event")).trim();
      const allDay = String(event.start?.date || "").length > 0 || (typeof event.start === "string" && event.start.length <= 10);
      const timeText = allDay ? this._text("allDay", "All day") : formatTime(start);
      const startsSoon = !allDay && start.getTime() - now.getTime() <= 90 * 60 * 1000 && start.getTime() >= now.getTime();
      const eventKey = `${event._entity || ""}|${event.uid || event.id || ""}|${start.toISOString()}|${summary}`;
      add({
        id: `calendar:${event._entity}:${notificationHash(`${summary}|${start.toISOString()}`)}`,
        title: startsSoon
          ? this._smartTitle("calendar", "titles.calendarSoon", "Event soon", { source: friendlyName(hass, event._entity), time: timeText, value: summary }, event._entity)
          : this._smartTitle("calendar", "titles.calendarToday", "Event due today", { source: friendlyName(hass, event._entity), time: timeText, value: summary }, event._entity),
        message: this._smartMessage("calendar", "", `${timeText} · ${summary}`, { source: friendlyName(hass, event._entity), time: timeText, value: summary }, event._entity),
        icon: "mdi:calendar-clock",
        severity: startsSoon ? "warning" : "info",
        source: friendlyName(hass, event._entity),
        entity: event._entity,
        tintColor: this._smartTint("calendar", event._entity),
        mobilePolicy: this._smartMobilePolicyForKind("calendar", event._entity),
        createdAt: start.getTime(),
        action: this._smartAction("calendar", {
          label: this._text("actions.openCalendar", "Open calendar"),
          type: "calendar-popup",
          entity: event._entity,
          date: start.toISOString(),
          eventKey,
        }, "", event._entity),
      });
    });

    if (this._calendarError) {
      add({
        id: `calendar:error:${notificationHash(this._calendarError)}`,
        title: this._text("titles.calendarUnavailable", "Calendar unavailable"),
        message: this._calendarError,
        icon: "mdi:calendar-alert",
        severity: "warning",
        createdAt: Date.now(),
      });
    }

    this._config.vacuum_entities.forEach(entityId => {
      const state = hass?.states?.[entityId];
      const value = String(state?.state || "").toLowerCase();
      if (!state) {
        return;
      }
      const name = friendlyName(hass, entityId);
      const errorState = this._getVacuumErrorState(entityId);
      const errorValue = this._getVacuumErrorValue(errorState);
      const errorLabel = this._translateVacuumError(errorValue);
      if (errorLabel || ["error", "unavailable"].includes(value)) {
        const displayState = errorLabel || this._translateVacuumState(value, state.state);
        add({
          id: `vacuum:${entityId}:${errorValue || value}`,
          title: this._smartTitle("vacuum", "titles.vacuumAttention", "Robot needs attention", { source: name, name, state: displayState }, entityId),
          message: this._smartMessage("vacuum", "messages.vacuumAttention", "{name} is in state {state}.", { source: name, name, state: displayState }, entityId),
          icon: "mdi:robot-vacuum-alert",
          severity: "critical",
          source: name,
          entity: entityId,
          tintColor: this._smartTint("vacuum", entityId),
          mobilePolicy: this._smartMobilePolicyForKind("vacuum", entityId),
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: this._smartAction("vacuum", { label: this._text("actions.viewRobot", "View robot"), type: "more-info", entity: entityId }, "", entityId),
        });
      } else if (["paused", "idle"].includes(value)) {
        const stateLabel = this._translateVacuumState(value, state.state);
        add({
          id: `vacuum:${entityId}:${value}`,
          title: this._smartTitle("vacuum", "titles.vacuumPaused", "Robot paused", { source: name, name, state: stateLabel }, entityId),
          message: this._smartMessage("vacuum", "messages.vacuumPaused", "{name} is paused or waiting.", { source: name, name, state: stateLabel }, entityId),
          icon: "mdi:pause-circle-outline",
          severity: "warning",
          source: name,
          entity: entityId,
          tintColor: this._smartTint("vacuum", entityId),
          mobilePolicy: this._smartMobilePolicyForKind("vacuum", entityId),
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: this._smartAction("vacuum", { label: this._text("actions.continue", "Continue"), type: "service", service: "vacuum.start", entity: entityId, internal: true }, "", entityId),
        });
      } else if (["cleaning", "returning"].includes(value)) {
        const stateLabel = this._translateVacuumState(value, state.state);
        add({
          id: `vacuum:${entityId}:${value}`,
          title: value === "cleaning"
            ? this._smartTitle("vacuum", "titles.cleaningStarted", "Cleaning started", { source: name, name, state: stateLabel }, entityId)
            : this._smartTitle("vacuum", "titles.returningDock", "Robot returning to dock", { source: name, name, state: stateLabel }, entityId),
          message: this._smartMessage("vacuum", "messages.vacuumState", "{name}: {state}.", { source: name, name, state: stateLabel }, entityId),
          icon: value === "cleaning" ? "mdi:robot-vacuum" : "mdi:home-import-outline",
          severity: "info",
          source: name,
          entity: entityId,
          tintColor: this._smartTint("vacuum", entityId),
          mobilePolicy: this._smartMobilePolicyForKind("vacuum", entityId),
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: this._smartAction("vacuum", { label: this._text("actions.viewRobot", "View robot"), type: "more-info", entity: entityId }, "", entityId),
        });
      }
    });

    this._config.motion_entities.forEach(entityId => {
      const state = hass?.states?.[entityId];
      if (stateIsOn(state)) {
        const sourceName = friendlyName(hass, entityId);
        add({
          id: `motion:${entityId}:${state.state}`,
          title: this._smartTitle("motion", "titles.motionDetected", "Motion detected", { source: sourceName }, entityId),
          message: this._smartMessage("motion", "", sourceName, { source: sourceName }, entityId),
          icon: "mdi:motion-sensor",
          severity: "info",
          source: sourceName,
          entity: entityId,
          tintColor: this._smartTint("motion", entityId),
          mobilePolicy: this._smartMobilePolicyForKind("motion", entityId),
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: this._smartAction("motion", { label: this._text("actions.viewSensor", "View sensor"), type: "more-info", entity: entityId }, "", entityId),
        });
      }
    });

    [
      ["door", this._config.door_entities, "titles.doorOpen", "Door open", "mdi:door-open"],
      ["window", this._config.window_entities, "titles.windowOpen", "Window open", "mdi:window-open-variant"],
    ].forEach(([kind, entities, titleKey, fallbackTitle, icon]) => {
      entities.forEach(entityId => {
        const state = hass?.states?.[entityId];
        if (stateIsOn(state)) {
          const sourceName = friendlyName(hass, entityId);
          add({
            id: `${kind}:${entityId}:${state.state}`,
            title: this._smartTitle(kind, titleKey, fallbackTitle, { source: sourceName }, entityId),
            message: this._smartMessage(kind, "", sourceName, { source: sourceName }, entityId),
            icon,
            severity: "warning",
            source: sourceName,
            entity: entityId,
            tintColor: this._smartTint(kind, entityId),
            mobilePolicy: this._smartMobilePolicyForKind(kind, entityId),
            createdAt: Date.parse(state.last_changed || "") || Date.now(),
            action: this._smartAction(kind, { label: this._text("actions.viewSensor", "View sensor"), type: "more-info", entity: entityId }, "", entityId),
          });
        }
      });
    });

    this._buildComfortNotifications(add);
    this._buildMediaPlayerPresenceNotifications(add);
    this._buildWeatherNotifications(add);
    this._buildLevelNotifications(add);
    this._buildCustomNotifications(add);
    this._buildExternalNotifications(add);

    return items
      .map(item => this._enrichMobileDelivery(item))
      .sort((left, right) => {
      const severityScore = { critical: 4, warning: 3, success: 2, info: 1 };
      return (
        (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0) ||
        (severityScore[right.severity] || 0) - (severityScore[left.severity] || 0) ||
        String(right.id).localeCompare(String(left.id))
      );
    });
  }

  _buildComfortNotifications(add) {
    if (!this._config.smart_recommendations || !this._hass) {
      return;
    }
    const tempSources = [
      ...this._config.temperature_entities.map(entityId => ({
        entityId,
        state: this._hass.states?.[entityId],
        value: numericState(this._hass.states?.[entityId]),
        unit: this._hass.states?.[entityId]?.attributes?.unit_of_measurement || "°",
      })),
    ].filter(item => item.state && item.value !== null);
    const hotCandidates = tempSources
      .filter(item => item.value >= this._config.thresholds.hot_temperature)
      .filter(item => this._presenceAllowsComfortNotification(item.entityId))
      .map(item => ({ ...item, fanTarget: this._getFanTargetForSource(item.entityId) }))
      .filter(item => item.fanTarget)
      .sort((left, right) => right.value - left.value);
    const hottest = hotCandidates[0] || [...tempSources]
      .filter(item => item.value >= this._config.thresholds.hot_temperature)
      .filter(item => this._presenceAllowsComfortNotification(item.entityId))
      .sort((left, right) => right.value - left.value)[0];
    const coolingClimateTarget = hottest?.value >= this._config.thresholds.hot_temperature
      ? this._getClimateTargetForSource(hottest.entityId, "cool")
      : null;
    const coldest = [...tempSources].sort((left, right) => left.value - right.value)[0];
    const heatingClimateTarget = coldest?.value <= this._config.thresholds.cold_temperature
      ? this._getClimateTargetForSource(coldest.entityId, "heat")
      : null;
    if (hottest && hottest.value >= this._config.thresholds.hot_temperature && hottest.fanTarget) {
      const sourceName = friendlyName(this._hass, hottest.entityId);
      const fanName = friendlyName(this._hass, hottest.fanTarget);
      add({
        id: `comfort:hot:${hottest.entityId}:${hottest.fanTarget}:${Math.floor(hottest.value)}`,
        title: this._smartTitle("hot", "titles.hot", "Hot inside", { source: sourceName, value: formatNumber(hottest.value, hottest.unit), fan: fanName }, hottest.entityId),
        message: this._smartMessage("hot", "messages.hot", "{source} reads {value}. You can turn on {fan}.", {
          source: sourceName,
          value: formatNumber(hottest.value, hottest.unit),
          fan: fanName,
        }, hottest.entityId),
        icon: "mdi:fan",
        severity: "warning",
        source: sourceName,
        entity: hottest.entityId,
        tintColor: this._smartTint("hot", hottest.entityId),
        mobilePolicy: this._smartMobilePolicyForKind("hot", hottest.entityId),
        createdAt: Date.parse(hottest.state.last_changed || "") || Date.now(),
        action: this._smartAction("hot", { label: this._text("actions.turnOnFan", "Turn on fan"), type: "service", service: "fan.turn_on", entity: hottest.fanTarget, internal: true }, "", hottest.entityId),
      });
    } else if (hottest && hottest.value >= this._config.thresholds.hot_temperature && coolingClimateTarget) {
      const sourceName = friendlyName(this._hass, hottest.entityId);
      const climateName = friendlyName(this._hass, coolingClimateTarget);
      add({
        id: `comfort:hot:climate:${hottest.entityId}:${coolingClimateTarget}:${Math.floor(hottest.value)}`,
        title: this._smartTitle("hot", "titles.hot", "Hot inside", { source: sourceName, value: formatNumber(hottest.value, hottest.unit), climate: climateName, fan: climateName }, hottest.entityId),
        message: this._smartMessage("hot", "messages.hotClimate", "{source} reads {value}. You can enable cooling on {climate}.", {
          source: sourceName,
          value: formatNumber(hottest.value, hottest.unit),
          climate: climateName,
          fan: climateName,
        }, hottest.entityId),
        icon: "mdi:snowflake",
        severity: "warning",
        source: sourceName,
        entity: hottest.entityId,
        tintColor: this._smartTint("hot", hottest.entityId),
        mobilePolicy: this._smartMobilePolicyForKind("hot", hottest.entityId),
        createdAt: Date.parse(hottest.state.last_changed || "") || Date.now(),
        action: this._smartAction("hot", { label: this._text("actions.turnOnCooling", "Enable cooling"), type: "service", service: "climate.set_hvac_mode", entity: coolingClimateTarget, serviceData: { hvac_mode: "cool" }, internal: true }, "", hottest.entityId),
      });
    } else if (coldest && coldest.value <= this._config.thresholds.cold_temperature) {
      const sourceName = friendlyName(this._hass, coldest.entityId);
      add({
        id: `comfort:cold:${coldest.entityId}:${Math.floor(coldest.value)}`,
        title: this._smartTitle("cold", "titles.cold", "Low temperature", { source: sourceName, value: formatNumber(coldest.value, coldest.unit) }, coldest.entityId),
        message: this._smartMessage("cold", "messages.sensorValue", "{source} reads {value}.", {
          source: sourceName,
          value: formatNumber(coldest.value, coldest.unit),
        }, coldest.entityId),
        icon: "mdi:thermometer-low",
        severity: "info",
        source: sourceName,
        entity: coldest.entityId,
        tintColor: this._smartTint("cold", coldest.entityId),
        mobilePolicy: this._smartMobilePolicyForKind("cold", coldest.entityId),
        createdAt: Date.parse(coldest.state.last_changed || "") || Date.now(),
        action: this._smartAction("cold", heatingClimateTarget ? { label: this._text("actions.turnOnHeat", "Enable heating"), type: "service", service: "climate.set_hvac_mode", entity: heatingClimateTarget, serviceData: { hvac_mode: "heat" }, internal: true } : null, "", coldest.entityId),
      });
    }

    this._config.humidity_entities.forEach(entityId => {
      const state = this._hass.states?.[entityId];
      const value = numericState(state);
      if (value === null) {
        return;
      }
      if (value >= this._config.thresholds.humidity_high || value <= this._config.thresholds.humidity_low) {
        const high = value >= this._config.thresholds.humidity_high;
        const sourceName = friendlyName(this._hass, entityId);
        const smartKind = high ? "humidity_high" : "humidity_low";
        const dehumidifierTarget = high ? this._getHumidifierTargetForSource(entityId, "dehumidifier") : null;
        add({
          id: `humidity:${entityId}:${high ? "high" : "low"}:${Math.round(value)}`,
          title: high
            ? this._smartTitle(smartKind, "titles.humidityHigh", "High humidity", { source: sourceName, value: formatNumber(value, state.attributes?.unit_of_measurement || "%") }, entityId)
            : this._smartTitle(smartKind, "titles.humidityLow", "Low humidity", { source: sourceName, value: formatNumber(value, state.attributes?.unit_of_measurement || "%") }, entityId),
          message: this._smartMessage(smartKind, "messages.sensorValue", "{source} reads {value}.", {
            source: sourceName,
            value: formatNumber(value, state.attributes?.unit_of_measurement || "%"),
          }, entityId),
          icon: high ? "mdi:water-percent-alert" : "mdi:water-percent",
          severity: high ? "warning" : "info",
          source: sourceName,
          entity: entityId,
          tintColor: this._smartTint(smartKind, entityId),
          mobilePolicy: this._smartMobilePolicyForKind(smartKind, entityId),
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: this._smartAction(
            smartKind,
            dehumidifierTarget
              ? { label: this._text("actions.turnOnDehumidifier", "Turn on dehumidifier"), type: "service", service: "humidifier.turn_on", entity: dehumidifierTarget, internal: true }
              : { label: this._text("actions.viewSensor", "View sensor"), type: "more-info", entity: entityId },
            "",
            entityId,
          ),
        });
      }
    });
  }

  _translateVacuumState(stateKey, fallback = "") {
    return window.NodaliaI18n?.translateAdvanceVacuumReportedState
      ? window.NodaliaI18n.translateAdvanceVacuumReportedState(this._hass, this._config?.language ?? "auto", stateKey, fallback)
      : fallback;
  }

  _translateVacuumError(errorValue) {
    return window.NodaliaI18n?.translateVacuumErrorState
      ? window.NodaliaI18n.translateVacuumErrorState(this._hass, this._config?.language ?? "auto", errorValue, "")
      : "";
  }

  _getVacuumErrorValue(stateObj) {
    const raw = String(stateObj?.state || "").trim();
    if (!raw || !window.NodaliaI18n?.isVacuumErrorState?.(raw)) {
      return "";
    }
    return raw;
  }

  _getVacuumErrorState(vacuumEntityId) {
    const explicit = this._config.vacuum_error_entities
      .map(entityId => this._hass?.states?.[entityId])
      .find(stateObj => this._getVacuumErrorValue(stateObj));
    if (explicit) {
      return explicit;
    }
    const vacuumObject = String(vacuumEntityId || "").split(".")[1] || "";
    if (!vacuumObject || !this._hass?.states) {
      return null;
    }
    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const candidates = Object.keys(this._hass.states)
      .filter(entityId => entityId.startsWith("sensor."))
      .filter(entityId => entityId.includes(vacuumObject) || entityId.includes("roborock"))
      .filter(entityId => ["error", "fault", "fallo", "erro"].some(token => entityId.includes(token)))
      .sort((left, right) => left.localeCompare(right, sortLoc));
    return candidates.map(entityId => this._hass.states[entityId]).find(stateObj => this._getVacuumErrorValue(stateObj)) || null;
  }

  _getPresenceSensorForSource(sourceEntityId) {
    const sensors = this._config.motion_entities.filter(entityId => this._hass?.states?.[entityId]);
    if (!sensors.length) {
      return null;
    }
    const sourceArea = entityAreaKey(this._hass, sourceEntityId);
    if (sourceArea) {
      const sameArea = sensors.find(entityId => entityAreaKey(this._hass, entityId) === sourceArea);
      if (sameArea) {
        return sameArea;
      }
    }
    const sourceTokens = new Set(entityMatchTokens(this._hass, sourceEntityId));
    return sensors.find(entityId => entityMatchTokens(this._hass, entityId).some(token => sourceTokens.has(token))) || null;
  }

  _presenceAllowsComfortNotification(sourceEntityId) {
    const presenceEntityId = this._getPresenceSensorForSource(sourceEntityId);
    if (!presenceEntityId) {
      return true;
    }
    return stateIsOn(this._hass?.states?.[presenceEntityId]);
  }

  _getFanTargetForSource(sourceEntityId) {
    const offFans = this._config.fan_entities.filter(entityId => stateIsOff(this._hass?.states?.[entityId]));
    if (!offFans.length) {
      return null;
    }
    const sourceArea = entityAreaKey(this._hass, sourceEntityId);
    if (sourceArea) {
      const sameArea = offFans.find(entityId => entityAreaKey(this._hass, entityId) === sourceArea);
      return sameArea || null;
    }
    const sourceTokens = new Set(entityMatchTokens(this._hass, sourceEntityId));
    const tokenMatch = offFans.find(entityId => entityMatchTokens(this._hass, entityId).some(token => sourceTokens.has(token)));
    if (tokenMatch) {
      return tokenMatch;
    }
    return offFans.length === 1 ? offFans[0] : null;
  }

  _sameAreaTarget(sourceEntityId, entities, predicate = () => true) {
    const candidates = entities.filter(entityId => predicate(entityId, this._hass?.states?.[entityId]));
    if (!candidates.length) {
      return null;
    }
    const sourceArea = entityAreaKey(this._hass, sourceEntityId);
    if (sourceArea) {
      const sameArea = candidates.find(entityId => entityAreaKey(this._hass, entityId) === sourceArea);
      return sameArea || null;
    }
    const sourceTokens = new Set(entityMatchTokens(this._hass, sourceEntityId));
    const tokenMatch = candidates.find(entityId => entityMatchTokens(this._hass, entityId).some(token => sourceTokens.has(token)));
    return tokenMatch || (candidates.length === 1 ? candidates[0] : null);
  }

  _getClimateTargetForSource(sourceEntityId, mode) {
    return this._sameAreaTarget(sourceEntityId, this._config.climate_entities, (_entityId, stateObj) => {
      const modes = Array.isArray(stateObj?.attributes?.hvac_modes) ? stateObj.attributes.hvac_modes.map(item => String(item).toLowerCase()) : [];
      return modes.includes(mode) && ["off", "idle", "unknown", "unavailable"].includes(String(stateObj?.state || "").toLowerCase());
    });
  }

  _getHumidifierTargetForSource(sourceEntityId, deviceClass = "dehumidifier") {
    return this._sameAreaTarget(sourceEntityId, this._config.humidifier_entities, (_entityId, stateObj) => {
      const klass = normalizeMatchText(stateObj?.attributes?.device_class || "");
      return klass === deviceClass && stateIsOff(stateObj);
    });
  }

  _buildMediaPlayerPresenceNotifications(add) {
    if (!this._config.smart_recommendations || !this._hass || !this._config.media_player_entities.length || !this._config.motion_entities.length) {
      return;
    }
    const vacantSensors = this._config.motion_entities
      .map(entityId => ({ entityId, state: this._hass.states?.[entityId] }))
      .filter(item => stateIsVacant(item.state) && minutesSinceChanged(item.state) >= this._config.thresholds.media_absence_minutes);
    vacantSensors.forEach(sensor => {
      const mediaTarget = this._sameAreaTarget(sensor.entityId, this._config.media_player_entities, (_entityId, stateObj) => {
        const state = String(stateObj?.state || "").toLowerCase();
        return ["on", "playing", "paused", "idle", "standby"].includes(state);
      });
      if (!mediaTarget) {
        return;
      }
      const sourceName = friendlyName(this._hass, sensor.entityId);
      const mediaName = friendlyName(this._hass, mediaTarget);
      add({
        id: `media-left-on:${sensor.entityId}:${mediaTarget}:${String(this._hass.states?.[mediaTarget]?.state || "")}`,
        title: this._smartTitle("media_left_on", "titles.mediaLeftOn", "Media on with no presence", { source: sourceName, media: mediaName }, mediaTarget),
        message: this._smartMessage("media_left_on", "messages.mediaLeftOn", "{media} is still on and {source} shows no presence.", { source: sourceName, media: mediaName }, mediaTarget),
        icon: "mdi:television-off",
        severity: "warning",
        source: mediaName,
        entity: mediaTarget,
        tintColor: this._smartTint("media_left_on", mediaTarget),
        mobilePolicy: this._smartMobilePolicyForKind("media_left_on", mediaTarget),
        createdAt: Date.now(),
        action: this._smartAction("media_left_on", { label: this._text("actions.turnOff", "Turn off"), type: "service", service: "media_player.turn_off", entity: mediaTarget, internal: true }, "", mediaTarget),
      });
    });
  }

  _formatTemplate(template, values = {}) {
    return formatNotificationTemplate(template, this._hass, values);
  }

  _smartEntityOverride(entityId) {
    const target = String(entityId || "").trim();
    if (!target) {
      return null;
    }
    return (this._config.smart_entity_overrides || []).find(item => item.entity === target) || null;
  }

  _smartConfig(kind, entityId = "") {
    const base = this._config.smart_notifications?.[kind] || {};
    const override = this._smartEntityOverride(entityId);
    if (!override) {
      return base;
    }
    return {
      ...base,
      ...Object.fromEntries(
        ["title", "message", "tint_color", "url", "action_label"]
          .map(key => [key, override[key]])
          .filter(([, value]) => String(value || "").trim()),
      ),
      ...(hasNotificationTapAction(override.tap_action) ? { tap_action: override.tap_action } : {}),
      mobile: resolveSmartEntityMobilePolicy(override?.mobile, base.mobile ?? "auto"),
    };
  }

  _smartTitle(kind, path, fallback, values = {}, entityId = "") {
    const configured = this._smartConfig(kind, entityId).title;
    return configured ? this._formatTemplate(configured, values) : this._text(path, fallback, values);
  }

  _smartMessage(kind, path, fallback, values = {}, entityId = "") {
    const configured = this._smartConfig(kind, entityId).message;
    return configured ? this._formatTemplate(configured, values) : this._text(path, fallback, values);
  }

  _smartTint(kind, entityId = "") {
    return this._smartConfig(kind, entityId).tint_color || "";
  }

  _smartAction(kind, fallbackAction = null, fallbackUrlLabel = "", entityId = "") {
    const config = this._smartConfig(kind, entityId);
    const tapAction = this._buildNativeNotificationAction(config.tap_action, {
      entityId,
      label: config.action_label || fallbackUrlLabel || this._text("actions.open", "Open"),
    });
    if (tapAction) {
      return tapAction;
    }
    const url = window.NodaliaUtils?.sanitizeActionUrl?.(config.url, { allowRelative: true }) || "";
    if (url) {
      return {
        label: config.action_label || fallbackUrlLabel || this._text("actions.open", "Open"),
        type: "url",
        url,
        newTab: true,
      };
    }
    return fallbackAction;
  }

  _buildNativeNotificationAction(tapAction, options = {}) {
    const action = normalizeNotificationTapAction(tapAction);
    const label = options.label || this._text("actions.open", "Open");
    const fallbackEntity = String(options.entityId || "").trim();
    if (!hasNotificationTapAction(action)) {
      return null;
    }
    if (action.action === "more-info") {
      const entity = action.entity || fallbackEntity;
      return entity ? { label, type: "more-info", entity } : null;
    }
    if (action.action === "toggle") {
      const entity = action.entity || fallbackEntity;
      return entity ? { label: options.label || this._text("actions.toggle", "Toggle"), type: "toggle", entity } : null;
    }
    if (action.action === "navigate") {
      return {
        label,
        type: "navigate",
        navigationPath: action.navigation_path,
      };
    }
    if (action.action === "url") {
      return {
        label,
        type: "url",
        url: action.url_path,
        newTab: action.new_tab === true,
      };
    }
    return null;
  }

  _smartMobilePolicy(entityId) {
    const override = this._smartEntityOverride(entityId);
    return normalizeMobilePolicy(override?.mobile ?? "auto");
  }

  _smartMobilePolicyForKind(kind, entityId = "") {
    return normalizeMobilePolicy(this._smartConfig(kind, entityId).mobile ?? "auto");
  }

  _buildExternalNotifications(add) {
    const configured = this._config.external_alerts || [];
    const runtime = this._runtimeExternalAlerts || [];
    const alerts = normalizeExternalAlerts([...configured, ...runtime]);
    alerts.forEach(alert => {
      const sourceName = alert.source || (alert.entity ? friendlyName(this._hass, alert.entity) : "");
      const icon = alert.icon
        || (alert.type === "camera_event" ? "mdi:cctv" : alert.type === "security_event" ? "mdi:shield-alert" : "mdi:bell-alert-outline");
      const nativeAction = this._buildNativeNotificationAction(alert.tap_action, {
        entityId: alert.entity,
        label: alert.action_label || this._text("actions.open", "Open"),
      });
      const url = window.NodaliaUtils?.sanitizeActionUrl?.(alert.url, { allowRelative: true }) || "";
      add({
        id: `external:${alert.id}`,
        alertType: alert.type,
        type: alert.type,
        title: alert.title,
        message: alert.message || sourceName,
        icon,
        severity: alert.severity,
        source: sourceName,
        entity: alert.entity,
        tintColor: alert.tint_color,
        mobilePolicy: alert.mobile,
        createdAt: Date.now(),
        action: nativeAction || (url ? {
          label: alert.action_label || this._text("actions.open", "Open"),
          type: "url",
          url,
          newTab: true,
        } : null),
      });
    });
  }

  _buildWeatherNotifications(add) {
    if (!this._config.smart_recommendations || !this._hass || !this._config.weather_entities.length) {
      return;
    }
    const now = Date.now();
    const lookaheadMs = this._config.thresholds.rain_lookahead_hours * 60 * 60 * 1000;
    this._config.weather_entities.forEach(entityId => {
      const rows = (this._weatherForecasts?.[entityId] || normalizeWeatherForecastResult(this._hass.states?.[entityId]?.attributes?.forecast, entityId))
        .map(row => ({ row, date: forecastDate(row) }))
        .filter(item => item.date && item.date.getTime() >= now && item.date.getTime() <= now + lookaheadMs)
        .sort((left, right) => left.date.getTime() - right.date.getTime());
      const rainy = rows.find(({ row }) => {
        const probability = forecastNumber(row, [
          "precipitation_probability",
          "precipitationProbability",
          "probability_of_precipitation",
          "rain_probability",
        ]);
        return forecastLooksRainy(row) || (probability !== null && probability >= this._config.thresholds.rain_probability);
      });
      if (!rainy) {
        return;
      }
      const sourceName = friendlyName(this._hass, entityId);
      add({
        id: `weather:rain:${entityId}:${rainy.date.toISOString().slice(0, 13)}`,
        title: this._smartTitle("rain", "titles.rainSoon", "Rain soon", { source: sourceName, time: formatTime(rainy.date) }, entityId),
        message: this._smartMessage("rain", "messages.rainSoon", "{source} expects rain around {time}. If laundry is outside, it is worth checking.", {
          source: sourceName,
          time: formatTime(rainy.date),
        }, entityId),
        icon: "mdi:weather-pouring",
        severity: "warning",
        source: sourceName,
        entity: entityId,
        tintColor: this._smartTint("rain", entityId),
        mobilePolicy: this._smartMobilePolicyForKind("rain", entityId),
        createdAt: rainy.date.getTime(),
        action: this._smartAction("rain", { label: this._text("actions.viewWeather", "View weather"), type: "more-info", entity: entityId }, "", entityId),
      });
    });
  }

  _buildLevelNotifications(add) {
    if (!this._config.smart_recommendations || !this._hass) {
      return;
    }
    const groups = [
      {
        entities: this._config.battery_entities,
        icon: "mdi:battery-alert-variant-outline",
        kind: "battery_low",
        titleKey: "titles.batteryLow",
        titleFallback: "Low battery",
        messageKey: "messages.lowLevel",
        messageFallback: "{source} is at {value}.",
        threshold: this._config.thresholds.battery_low,
        urlLabel: this._text("actions.buyBattery", "Buy batteries"),
      },
      {
        entities: this._config.humidifier_fill_entities,
        icon: "mdi:air-humidifier",
        kind: "humidifier_fill_low",
        titleKey: "titles.humidifierFillLow",
        titleFallback: "Low tank",
        messageKey: "messages.lowLevel",
        messageFallback: "{source} is at {value}.",
        threshold: this._config.thresholds.humidifier_fill_low,
        urlLabel: this._text("actions.open", "Open"),
      },
      {
        entities: this._config.humidifier_full_entities,
        icon: "mdi:cup-water",
        kind: "humidifier_fill_full",
        titleKey: "titles.humidifierFillFull",
        titleFallback: "Tank full",
        messageKey: "messages.highLevel",
        messageFallback: "{source} is at {value}.",
        threshold: this._config.thresholds.humidifier_fill_full,
        mode: "above",
        urlLabel: this._text("actions.open", "Open"),
      },
      {
        entities: this._config.ink_entities,
        icon: "mdi:printer-alert",
        kind: "ink_low",
        titleKey: "titles.inkLow",
        titleFallback: "Low ink",
        messageKey: "messages.lowLevel",
        messageFallback: "{source} is at {value}.",
        threshold: this._config.thresholds.ink_low,
        urlLabel: this._text("actions.buyInk", "Buy ink"),
      },
    ];
    groups.forEach(group => {
      group.entities.forEach(entityId => {
        const state = this._hass.states?.[entityId];
        const value = numericState(state);
        const matchesThreshold = group.mode === "above"
          ? value >= group.threshold
          : value <= group.threshold;
        if (!state || value === null || !matchesThreshold) {
          return;
        }
        const sourceName = friendlyName(this._hass, entityId);
        const unit = state.attributes?.unit_of_measurement || "%";
        const formattedValue = formatNumber(value, unit);
        add({
          id: `${group.kind}:${entityId}:${Math.round(value)}`,
          title: this._smartTitle(group.kind, group.titleKey, group.titleFallback, {
            source: sourceName,
            threshold: formatNumber(group.threshold, unit),
            value: formattedValue,
          }, entityId),
          message: this._smartMessage(group.kind, group.messageKey, group.messageFallback, {
            source: sourceName,
            threshold: formatNumber(group.threshold, unit),
            value: formattedValue,
          }, entityId),
          icon: group.icon,
          severity: "warning",
          source: sourceName,
          entity: entityId,
          tintColor: this._smartTint(group.kind, entityId),
          mobilePolicy: this._smartMobilePolicyForKind(group.kind, entityId),
          createdAt: Date.parse(state.last_changed || "") || Date.now(),
          action: this._smartAction(group.kind, { label: this._text("actions.viewSensor", "View sensor"), type: "more-info", entity: entityId }, group.urlLabel, entityId),
        });
      });
    });
  }

  _buildCustomNotifications(add) {
    this._config.custom_notifications.forEach(item => {
      if (!item.title && !item.message && !item.entity) {
        return;
      }
      if (!this._customNotificationMatches(item)) {
        return;
      }
      const entityName = item.entity ? friendlyName(this._hass, item.entity) : "";
      const templateValues = this._customNotificationTemplateValues(item);
      const resolvedItem = {
        ...item,
        title: this._formatTemplate(item.title, templateValues),
        message: this._formatTemplate(item.message, templateValues),
        action_label: this._formatTemplate(item.action_label, templateValues),
        url: this._formatTemplate(item.url, templateValues),
      };
      add({
        id: `custom:${notificationHash(`${item.title}|${item.message}|${item.entity}|${item.attribute}|${item.condition}|${item.value}|${item.url}|${JSON.stringify(item.tap_action || {})}`)}`,
        title: resolvedItem.title || entityName || this._text("titles.customFallback", "Notification"),
        message: resolvedItem.message || entityName,
        icon: item.icon || "mdi:bell-outline",
        tintColor: item.tint_color || "",
        severity: item.severity || "info",
        source: entityName,
        mobilePolicy: item.mobile || "auto",
        createdAt: item.entity ? Date.parse(this._hass?.states?.[item.entity]?.last_changed || "") || Date.now() : Date.now(),
        action: this._buildCustomAction(resolvedItem),
      });
    });
  }

  _customNotificationTemplateValues(item) {
    const entityId = String(item?.entity || "").trim();
    const fanEntity = entityId
      ? this._getFanTargetForSource(entityId) || this._config.fan_entities[0]
      : this._config.fan_entities[0];
    return customNotificationTemplateValues(this._hass, item, fanEntity);
  }

  _customNotificationMatches(item) {
    const condition = String(item.condition || "always").toLowerCase();
    if (condition === "always") {
      return true;
    }
    const state = this._hass?.states?.[item.entity];
    if (!state) {
      return condition === "missing";
    }
    const raw = stateValue(state, item.attribute);
    const text = String(raw ?? "").trim().toLowerCase();
    const expected = String(item.value || "").trim().toLowerCase();
    const num = Number(raw);
    const expectedNum = Number(item.value);
    switch (condition) {
      case "on":
        return stateIsOn(state);
      case "off":
        return stateIsOff(state);
      case "unavailable":
        return ["unavailable", "unknown"].includes(String(state.state).toLowerCase());
      case "equals":
        return text === expected;
      case "not_equals":
        return text !== expected;
      case "above":
        return Number.isFinite(num) && Number.isFinite(expectedNum) && num > expectedNum;
      case "below":
        return Number.isFinite(num) && Number.isFinite(expectedNum) && num < expectedNum;
      default:
        return false;
    }
  }

  _buildCustomAction(item) {
    const nativeAction = this._buildNativeNotificationAction(item.tap_action, {
      entityId: item.entity,
      label: item.action_label || this._text("actions.open", "Open"),
    });
    if (nativeAction) {
      return nativeAction;
    }
    const type = String(item.action_type || "none").trim();
    if (type === "none") {
      return null;
    }
    return {
      label: item.action_label || (type === "service" ? this._text("actions.run", "Run") : type === "toggle" ? this._text("actions.toggle", "Toggle") : this._text("actions.open", "Open")),
      type,
      entity: item.entity,
      service: item.service,
      serviceData: parseServiceData(item.service_data),
      url: item.url,
      newTab: true,
    };
  }

  _severityScore(severity) {
    return { critical: 4, warning: 3, success: 2, info: 1 }[normalizeSeverity(severity)] || 1;
  }

  _backgroundMobileSuppressesForeground() {
    const background = this._config?.background_mobile || {};
    if (background.enabled !== true) {
      return false;
    }
    const nativeSignature = String(this._lastBackgroundMobileNativeSignature || "");
    const currentNative = getBackgroundMobileNativeSignature(this._config, this._hass);
    if (nativeSignature === currentNative.signature || nativeSignature === `active:${currentNative.profileId}`) {
      return true;
    }
    const lastSignature = String(this._lastBackgroundMobileSyncSignature || "");
    const webhookId = String(background.webhook || "").trim();
    if (!lastSignature || !webhookId) {
      return false;
    }
    const payload = this._buildBackgroundMobileWebhookPayload();
    if (backgroundMobilePayloadOverLimit(payload)) {
      return false;
    }
    const currentSignature = `${webhookId}:${payload.config_hash}:${payload.chunk_count}`;
    return currentSignature === lastSignature;
  }

  _shouldSendMobileNotification(item) {
    if (this._backgroundMobileSuppressesForeground()) {
      return false;
    }
    if (!item?.id) {
      return false;
    }
    // Delivery context is time- and state-sensitive. Never trust the value captured
    // when the visual notification was built or first queued.
    const deliveryState = this._resolveMobileDeliveryForItem(item);
    if (deliveryState !== "allowed") {
      return false;
    }
    return !this._mobileSent.has(this._dismissKey(item.id));
  }

  _enqueueMobileNotifications(items) {
    const queue = this._mobileNotifyQueue || (this._mobileNotifyQueue = []);
    for (const item of items) {
      if (!item?.id) {
        continue;
      }
      const key = this._dismissKey(item.id);
      if (queue.some(entry => this._dismissKey(entry.id) === key)) {
        continue;
      }
      queue.push(item);
    }
  }

  _scheduleMobileNotifyDrain() {
    if (this._mobileNotifyTimer || !this._mobileNotifyQueue?.length) {
      return;
    }
    this._mobileNotifyTimer = window.setTimeout(() => {
      this._mobileNotifyTimer = 0;
      const batch = this._mobileNotifyQueue.splice(0, 4);
      if (!batch.length) {
        return;
      }
      Promise.resolve()
        .then(() => this._flushMobileNotifications(batch))
        .catch(error => {
          console.warn("Nodalia Notifications Card: mobile notification batch failed.", error);
        })
        .finally(() => {
          if (this._mobileNotifyQueue.length) {
            this._scheduleMobileNotifyDrain();
          }
        });
    }, 450);
  }

  _queueMobileNotifications(items) {
    const pending = items.filter(item => this._shouldSendMobileNotification(item));
    if (!pending.length) {
      return;
    }
    this._enqueueMobileNotifications(pending);
    this._scheduleMobileNotifyDrain();
  }

  _buildLegacyMobilePayload(item, hash) {
    const payload = {
      title: item.title,
      message: item.message || item.source || item.title,
      data: {
        group: "nodalia_notifications",
        tag: hash,
      },
    };
    if (this._config.mobile_notifications?.critical_alerts === true && item?.severity === "critical") {
      payload.data = {
        ...payload.data,
        ttl: 0,
        priority: "high",
        channel: "alarm_stream",
        push: {
          sound: {
            name: "default",
            critical: 1,
            volume: 1,
          },
        },
      };
    }
    return payload;
  }

  async _flushMobileNotifications(items) {
    if (!this._hass || typeof this._hass.callService !== "function" || !this.isConnected) {
      return;
    }
    for (const item of items) {
      if (!this.isConnected) {
        return;
      }
      if (!this._shouldSendMobileNotification(item)) {
        continue;
      }
      const hash = this._dismissKey(item.id);
      if (this._mobileSent.has(hash) || this._isDismissed(item)) {
        continue;
      }
      const legacyPayload = this._buildLegacyMobilePayload(item, hash);
      const notifyEntities = Array.isArray(this._config.mobile_notifications.entities)
        ? this._config.mobile_notifications.entities
        : [];
      const legacyServices = Array.isArray(this._config.mobile_notifications.services)
        ? this._config.mobile_notifications.services
        : [];
      const entityPayload = {
        entity_id: notifyEntities,
        title: legacyPayload.title,
        message: legacyPayload.message,
      };
      await Promise.all([
        notifyEntities.length
          ? Promise.resolve().then(() => (
            this._hass.callService("notify", "send_message", entityPayload)
          )).then(() => true, () => false)
          : Promise.resolve(false),
        ...legacyServices.map(service => (
          Promise.resolve().then(() => (
            this._callInternalService(service, legacyPayload)
          )).then(() => true, () => false)
        )),
      ]).then(results => {
        const delivered = results.some(Boolean);
        if (delivered) {
          this._mobileSent.add(hash);
          this._recordMobileCooldown(item);
        }
      });
    }
    this._saveMobileSent();
  }

  _getNotifications(options = {}) {
    const raw = this._getRawNotifications();
    this._pruneDismissed(raw.map(item => item.id));
    const visible = raw.filter(item => !this._isDismissed(item));
    this._lastNotifications = visible;
    if (options.notifyMobile === true) {
      this._queueMobileNotifications(visible);
    }
    return visible;
  }

  _invalidateTrackedEntityStampCache() {
    this._trackedEntityIdsCache = null;
    this._trackedEntityRevision = null;
    this._trackedEntitiesStamp = "";
    this._trackedEntityIdsLength = 0;
  }

  _getTrackedEntityIds() {
    if (this._trackedEntityIdsCache) {
      return this._trackedEntityIdsCache;
    }
    const configuredEntities = [
      ...this._config.vacuum_entities,
      ...this._config.vacuum_error_entities,
      ...this._config.fan_entities,
      ...this._config.climate_entities,
      ...this._config.humidifier_entities,
      ...this._config.media_player_entities,
      ...this._config.weather_entities,
      ...this._config.motion_entities,
      ...this._config.door_entities,
      ...this._config.window_entities,
      ...this._config.temperature_entities,
      ...this._config.humidity_entities,
      ...this._config.outdoor_temperature_entities,
      ...this._config.outdoor_humidity_entities,
      ...this._config.battery_entities,
      ...this._config.humidifier_fill_entities,
      ...this._config.humidifier_full_entities,
      ...this._config.ink_entities,
      this._config.presence_entity,
      this._config.dismissed_entity,
      ...this._config.custom_notifications.map(item => item.entity).filter(Boolean),
      ...this._config.external_alerts.map(item => item.entity).filter(Boolean),
    ];
    const templateEntities = this._config.custom_notifications.flatMap(item => [
      item.title,
      item.message,
      item.action_label,
      item.url,
    ].flatMap(referencedNotificationTemplateEntities));
    this._trackedEntityIdsCache = [...new Set([...configuredEntities, ...templateEntities].filter(Boolean))];
    return this._trackedEntityIdsCache;
  }

  _buildTrackedEntitiesStamp(hass = this._hass) {
    if (!hass || !this._config) {
      return "";
    }
    const chunks = [];
    for (const entityId of this._getTrackedEntityIds()) {
      const state = hass.states?.[entityId];
      chunks.push(`${entityId}:${state?.state ?? ""}:${state?.last_updated ?? state?.last_changed ?? ""}`);
    }
    for (const entityId of this._config.vacuum_entities) {
      const errorState = this._getVacuumErrorState(entityId);
      chunks.push(`vacuum-error:${entityId}:${errorState?.entity_id || ""}:${errorState?.state || ""}:${errorState?.last_changed || ""}`);
    }
    return chunks.join("|");
  }

  _syncTrackedEntitiesStamp(hass = this._hass) {
    if (!hass || !this._config) {
      this._trackedEntitiesStamp = "";
      return;
    }

    if (!this._trackedEntityRevision) {
      this._trackedEntityRevision = new Map();
    }

    const ids = this._getTrackedEntityIds();
    let dirty = ids.length !== this._trackedEntityIdsLength;
    if (!dirty) {
      for (const entityId of ids) {
        const state = hass.states?.[entityId];
        const revision = `${state?.state ?? ""}:${state?.last_updated ?? state?.last_changed ?? ""}`;
        if (this._trackedEntityRevision.get(entityId) !== revision) {
          this._trackedEntityRevision.set(entityId, revision);
          dirty = true;
        }
      }
      if (!dirty) {
        for (const entityId of this._config.vacuum_entities) {
          const errorState = this._getVacuumErrorState(entityId);
          const key = `vacuum-error:${entityId}`;
          const revision = `${errorState?.entity_id || ""}:${errorState?.state || ""}:${errorState?.last_changed || ""}`;
          if (this._trackedEntityRevision.get(key) !== revision) {
            this._trackedEntityRevision.set(key, revision);
            dirty = true;
          }
        }
      }
    } else {
      this._trackedEntityRevision.clear();
      for (const entityId of ids) {
        const state = hass.states?.[entityId];
        this._trackedEntityRevision.set(
          entityId,
          `${state?.state ?? ""}:${state?.last_updated ?? state?.last_changed ?? ""}`,
        );
      }
      for (const entityId of this._config.vacuum_entities) {
        const errorState = this._getVacuumErrorState(entityId);
        const key = `vacuum-error:${entityId}`;
        this._trackedEntityRevision.set(
          key,
          `${errorState?.entity_id || ""}:${errorState?.state || ""}:${errorState?.last_changed || ""}`,
        );
      }
      this._trackedEntityIdsLength = ids.length;
      dirty = true;
    }

    if (dirty || !this._trackedEntitiesStamp) {
      this._trackedEntitiesStamp = this._buildTrackedEntitiesStamp(hass);
    }
  }

  _rebuildCalendarEventsSignature() {
    this._calendarEventsSignature = this._calendarEvents
      .map(event => {
        const start = calendarEventDate(event.start);
        const startMs = start && !Number.isNaN(start.getTime()) ? start.getTime() : "";
        const uid = String(event.uid ?? event.id ?? "");
        const recurrence = String(event.recurrence_id ?? event.recurrenceId ?? "");
        return `${event._entity}:${String(event.summary || event.title || "")}:${startMs}:${uid}:${recurrence}`;
      })
      .join("|");
  }

  _rebuildWeatherForecastsSignature() {
    this._weatherForecastsSignature = Object.entries(this._weatherForecasts || {})
      .map(([entityId, rows]) => `${entityId}:${(rows || []).slice(0, 12).map(row => `${row?.datetime || row?.dateTime || row?.date || ""}:${row?.condition || ""}:${row?.precipitation_probability ?? row?.precipitationProbability ?? ""}`).join(",")}`)
      .join("|");
  }

  _getRenderSignature(hass = this._hass) {
    const parts = [
      CARD_VERSION,
      this._expanded ? "expanded" : "collapsed",
      [...this._dismissed].join(","),
      this._calendarLoading ? "loading" : "",
      this._calendarError,
      this._calendarEventsSignature || "",
      this._weatherForecastsSignature || "",
      isWithinQuietHours(this._config?.mobile_context?.quiet_hours, new Date()) ? "quiet" : "awake",
    ];
    parts.push(this._config.language || "auto");
    parts.push(
      (typeof window !== "undefined" && window.NodaliaI18n?.resolveLanguage?.(hass, this._config.language || "auto")) || "",
    );
    if (!this._trackedEntitiesStamp && hass) {
      this._syncTrackedEntitiesStamp(hass);
    }
    parts.push(this._trackedEntitiesStamp);
    return parts.join("||");
  }

  _scheduleQuietHoursWake(now = new Date()) {
    if (this._quietHoursWakeTimer) {
      window.clearTimeout(this._quietHoursWakeTimer);
      this._quietHoursWakeTimer = 0;
    }
    const delay = getNextQuietHoursBoundaryDelay(this._config?.mobile_context?.quiet_hours, now);
    if (!Number.isFinite(delay) || delay === null || !this.isConnected) {
      return;
    }
    this._quietHoursWakeTimer = window.setTimeout(() => {
      this._quietHoursWakeTimer = 0;
      if (!this.isConnected) {
        return;
      }
      this._lastRenderSignature = "";
      this._renderIfChanged(true);
      this._scheduleQuietHoursWake();
    }, Math.max(250, delay + 50));
  }

  _renderIfChanged(force = false) {
    if (!this.isConnected) {
      return;
    }
    const next = this._getRenderSignature();
    if (!force && next === this._lastRenderSignature) {
      return;
    }
    // Calendar/weather hydration can finish while the entrance animation is still
    // running. Replacing shadow DOM during that window restarts the same CSS
    // animation, so coalesce those rapid updates into one post-entrance render.
    if (
      this._entranceAnimationTimer
      && this.shadowRoot?.querySelector?.(".notifications-card--enter")
    ) {
      this._renderPendingAfterEntrance = true;
      return;
    }
    this._lastRenderSignature = next;
    this._render();
  }

  _triggerHaptic(kind = this._config.haptics?.style) {
    if (!this._config.haptics?.enabled) {
      return;
    }
    const style = String(kind || "medium");
    try {
      fireEvent(this, "haptic", style);
    } catch (_error) {
      // Ignore unsupported HA haptic event.
    }
    if (this._config.haptics?.fallback_vibrate && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.medium);
    }
  }

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;
    return {
      enabled: configuredAnimations.enabled !== false,
      contentDuration: clamp(
        Number(configuredAnimations.content_duration) || DEFAULT_CONFIG.animations.content_duration,
        120,
        1800,
      ),
      buttonBounceDuration: clamp(
        Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration,
        120,
        1200,
      ),
    };
  }

  _triggerPressAnimation(element) {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    const animations = this._getAnimationSettings();
    if (!animations.enabled) {
      return;
    }
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

  _text(path, fallback = "", values = {}) {
    const i18n = typeof window !== "undefined" ? window.NodaliaI18n : null;
    if (typeof i18n?.translateNotificationsUi === "function") {
      return i18n.translateNotificationsUi(this._hass, this._config?.language ?? "auto", path, fallback, values);
    }
    return String(fallback || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
      const value = values?.[key];
      return value === undefined || value === null ? "" : String(value);
    });
  }

  _onClick(event) {
    const button = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.action);
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this._triggerPressAnimation(button);
    const action = button.dataset.action;
    if (action === "toggle-stack") {
      if (this._stackCollapseTimer) {
        window.clearTimeout(this._stackCollapseTimer);
        this._stackCollapseTimer = 0;
      }
      const animations = this._getAnimationSettings();
      if (this._expanded && animations.enabled) {
        this._collapsingStack = true;
        this._stackTransition = "collapse";
        this._triggerHaptic("selection");
        this._renderIfChanged(true);
        const collapseMs = Math.max(140, Math.round(animations.contentDuration * 0.68));
        this._stackCollapseTimer = window.setTimeout(() => {
          this._stackCollapseTimer = 0;
          this._expanded = false;
          this._collapsingStack = false;
          this._stackTransition = "collapse-final";
          this._renderIfChanged(true);
        }, collapseMs);
        return;
      }
      this._collapsingStack = false;
      this._expanded = !this._expanded;
      this._stackTransition = this._expanded ? "expand" : "collapse-final";
      this._triggerHaptic("selection");
      this._renderIfChanged(true);
      return;
    }
    if (action === "dismiss") {
      const id = button.dataset.id;
      if (id) {
        this._dismissed.add(id);
        this._saveDismissed();
        this._saveNativeDismissed(id);
        this._triggerHaptic("light");
        this._renderIfChanged(true);
      }
      return;
    }
    if (action === "clear-all") {
      const ids = this._getRawNotifications().map(item => item.id);
      ids.forEach(id => this._dismissed.add(id));
      this._saveDismissed();
      this._saveNativeDismissed(ids);
      this._triggerHaptic("success");
      this._renderIfChanged(true);
      return;
    }
    if (action === "run-notification") {
      const notification = this._lastNotifications.find(item => item.id === button.dataset.id);
      this._runNotificationAction(notification);
    }
  }

  async _runNotificationAction(notification) {
    const action = notification?.action;
    if (!action || !this._hass) {
      return;
    }
    this._triggerHaptic("medium");
    if (action.type === "more-info" && action.entity) {
      fireEvent(this, "hass-more-info", { entityId: action.entity });
      return;
    }
    if (action.type === "calendar-popup") {
      const detail = {
        entity_id: action.entity || "",
        date: action.date || "",
        event_key: action.eventKey || "",
        source: CARD_TAG,
      };
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("nodalia-calendar-card-open", {
          bubbles: false,
          cancelable: true,
          composed: false,
          detail,
        }));
      }
      return;
    }
    if (action.type === "navigate" && action.navigationPath) {
      const path = window.NodaliaUtils?.sanitizeActionUrl?.(action.navigationPath, { allowRelative: true, allowHash: true }) || "";
      if (path && typeof window !== "undefined" && !/^(?:https?:)?\/\//i.test(path)) {
        window.history.pushState(null, "", path);
        window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
      }
      return;
    }
    if (action.type === "url" && action.url) {
      const url = window.NodaliaUtils?.sanitizeActionUrl?.(action.url, { allowRelative: true, allowHash: true }) || "";
      if (url && typeof window !== "undefined") {
        if (action.newTab === false) {
          window.location.assign(url);
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }
      return;
    }
    if (action.type === "toggle" && action.entity && typeof this._hass.callService === "function") {
      const data = { entity_id: action.entity };
      if (action.internal === true) {
        await this._callInternalService("homeassistant.toggle", data);
      } else {
        await this._callNamedService("homeassistant.toggle", data);
      }
      if (!this.isConnected) {
        return;
      }
      return;
    }
    if (action.type === "service" && action.service && typeof this._hass.callService === "function") {
      const data = {
        ...(action.serviceData || {}),
        ...(action.entity ? { entity_id: action.entity } : {}),
      };
      if (action.internal === true) {
        await this._callInternalService(action.service, data);
      } else {
        await this._callNamedService(action.service, data);
      }
      if (!this.isConnected) {
        return;
      }
    }
  }

  _isServiceAllowed(serviceValue) {
    const security = this._config?.security || {};
    if (security.strict_service_actions !== true) {
      return true;
    }
    const normalizedService = String(serviceValue || "").trim().toLowerCase();
    if (!normalizedService || !normalizedService.includes(".")) {
      return false;
    }
    const [domain] = normalizedService.split(".");
    const domains = security.allowed_service_domains || [];
    const services = security.allowed_services || [];
    if (!domains.length && !services.length) {
      return false;
    }
    return services.includes(normalizedService) || domains.includes(domain);
  }

  _callNamedService(serviceValue, data = {}, target = null) {
    if (!this._hass || typeof this._hass.callService !== "function") {
      return Promise.resolve();
    }
    if (!this._isServiceAllowed(serviceValue)) {
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Notifications Card", serviceValue);
      return Promise.resolve();
    }
    const [domain, service] = String(serviceValue || "").split(".");
    if (!domain || !service) {
      return Promise.resolve();
    }
    return this._hass.callService(domain, service, data, target || undefined);
  }

  _callInternalService(serviceValue, data = {}, target = null) {
    if (!this._hass || typeof this._hass.callService !== "function") {
      return Promise.resolve();
    }
    const [domain, service] = String(serviceValue || "").split(".");
    if (!domain || !service) {
      return Promise.resolve();
    }
    return this._hass.callService(domain, service, data, target || undefined);
  }

  _mobileDeliveryHint(item) {
    const state = String(item?.mobileDeliveryState || "");
    const policy = normalizeMobilePolicy(item?.mobilePolicy);
    if (state === "allowed") {
      return { icon: "mdi:cellphone", title: this._text("mobile.pushEnabled", "Push enabled") };
    }
    if (state === "card_only" || policy === "card_only") {
      return { icon: "mdi:cellphone-off", title: this._text("mobile.cardOnly", "Visible in card only") };
    }
    if (state === "blocked_by_quiet_hours") {
      return { icon: "mdi:bell-sleep", title: this._text("mobile.silencedQuietHours", "Silenced by quiet hours") };
    }
    if (state === "blocked_by_cooldown") {
      return { icon: "mdi:bell-off", title: this._text("mobile.silencedCooldown", "Silenced by cooldown") };
    }
    if (state === "blocked_by_severity") {
      return { icon: "mdi:volume-off", title: this._text("mobile.blockedSeverity", "Blocked by severity") };
    }
    if (state === "blocked_by_context") {
      return { icon: "mdi:home-account", title: this._text("mobile.blockedContext", "Blocked by context") };
    }
    if (policy === "off" || state === "off") {
      return { icon: "mdi:bell-off-outline", title: this._text("mobile.off", "Off") };
    }
    return null;
  }

  _notificationChips(item) {
    const chips = [];
    if (item?.severity && item.severity !== "info") {
      chips.push({ kind: "state", label: this._severityLabel(item.severity) });
    }
    return chips;
  }

  _severityAccent(severity) {
    switch (severity) {
      case "critical":
        return "var(--error-color, #db4437)";
      case "warning":
        return "var(--warning-color, #f59e0b)";
      case "success":
        return "var(--success-color, #43a047)";
      default:
        return sanitizeCssRuntimeValue(this._config.styles.accent, DEFAULT_CONFIG.styles.accent);
    }
  }

  _renderNotification(item, options = {}) {
    const action = item.action;
    const primary = options.primary === true;
    const tint = item.tintColor ? sanitizeCssRuntimeValue(item.tintColor, "") : "";
    const chips = this._notificationChips(item);
    const mobileHint = this._mobileDeliveryHint(item);
    const accent = tint || this._severityAccent(item.severity);
    const stateForIcon = this._hass?.states?.[item.entity || action?.entity];
    const darkenIcon = shouldDarkenNotificationIconGlyph(stateForIcon, accent);
    const iconColor = darkenIcon ? `color-mix(in srgb, var(--primary-text-color) 60%, ${accent})` : "var(--notification-accent)";
    const index = Math.max(0, Number(options.index) || 0);
    const exiting = options.exiting === true;
    const exitIndex = Math.max(0, Number(options.exitIndex) || 0);
    return `
      <article class="notification-item notification-item--${escapeHtml(item.severity)} ${primary ? "notification-item--primary" : ""} ${exiting ? "notification-item--collapsing-tail" : ""}" style="${tint ? `--notification-accent:${escapeHtml(tint)};` : ""}--notification-icon-color:${escapeHtml(iconColor)}; --notification-index:${index}; --notification-exit-index:${exitIndex};">
        <div class="notification-item__icon">
          <ha-icon icon="${escapeHtml(item.icon)}"></ha-icon>
        </div>
        <div class="notification-item__body">
          <div class="notification-item__title-row">
            <div class="notification-item__title">${escapeHtml(item.title)}</div>
            ${mobileHint ? `<span class="notification-item__mobile-hint" title="${escapeHtml(mobileHint.title)}"><ha-icon icon="${escapeHtml(mobileHint.icon)}"></ha-icon></span>` : ""}
            ${chips.length ? `<div class="notification-item__chips notification-item__chips--top">
              ${chips.map(chip => `<span class="notification-item__chip notification-item__chip--${escapeHtml(chip.kind)}">${escapeHtml(chip.label)}</span>`).join("")}
            </div>` : ""}
            <button type="button" class="notification-item__dismiss" data-action="dismiss" data-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(this._text("aria.dismiss", "Dismiss notification"))}">
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          ${item.message ? `<div class="notification-item__message">${escapeHtml(item.message)}</div>` : ""}
          ${
            action
              ? `
                <div class="notification-item__actions">
                  <button type="button" class="notification-item__action" data-action="run-notification" data-id="${escapeHtml(item.id)}">
                    ${escapeHtml(action.label || this._text("actions.open", "Open"))}
                  </button>
                </div>
              `
              : ""
          }
        </div>
      </article>
    `;
  }

  _stackCardStyle(item, index) {
    const stackIndex = Math.max(1, Number(index) || 1);
    const accent = item?.tintColor
      ? sanitizeCssRuntimeValue(item.tintColor, "")
      : this._severityAccent(item?.severity);
    const clampedIndex = Math.min(4, stackIndex);
    const stackPeek = 9;
    const firstLayerPeekCorrection = clampedIndex === 1 ? 1 : 0;
    const inset = 5 + (clampedIndex - 1) * 5;
    const offset = clampedIndex * stackPeek + firstLayerPeekCorrection;
    const opacity = Math.max(0.38, 0.64 - (clampedIndex - 1) * 0.08);
    const zIndex = 4 - clampedIndex;
    return [
      `--stack-index:${clampedIndex}`,
      `--stack-accent:${escapeHtml(accent || "var(--primary-color)")}`,
      `--stack-inset:${inset}px`,
      `--stack-offset:${offset}px`,
      `--stack-opacity:${opacity}`,
      `--stack-z:${zIndex}`,
    ].join(";");
  }

  _renderCollapsedStackCards(notifications, startIndex) {
    return notifications
      .slice(startIndex, startIndex + 4)
      .map((item, index) => (
        `<div class="notification-stack-card" style="${this._stackCardStyle(item, index + 1)}" aria-hidden="true"></div>`
      ))
      .join("");
  }

  _severityLabel(severity) {
    switch (severity) {
      case "critical":
        return this._text("severity.critical", "Critical");
      case "warning":
        return this._text("severity.warning", "Warning");
      case "success":
        return this._text("severity.success", "OK");
      default:
        return this._text("severity.info", "Info");
    }
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    const config = this._config;
    const styles = {
      card: {
        background: sanitizeCssRuntimeValue(config.styles.card.background, DEFAULT_CONFIG.styles.card.background),
        border: sanitizeCssRuntimeValue(config.styles.card.border, DEFAULT_CONFIG.styles.card.border),
        border_radius: sanitizeCssRuntimeValue(config.styles.card.border_radius, DEFAULT_CONFIG.styles.card.border_radius),
        box_shadow: sanitizeCssRuntimeValue(config.styles.card.box_shadow, DEFAULT_CONFIG.styles.card.box_shadow),
        padding: sanitizeCssRuntimeValue(config.styles.card.padding, DEFAULT_CONFIG.styles.card.padding),
        gap: sanitizeCssRuntimeValue(config.styles.card.gap, DEFAULT_CONFIG.styles.card.gap),
      },
      icon: {
        background: sanitizeCssRuntimeValue(config.styles.icon.background, DEFAULT_CONFIG.styles.icon.background),
        color: sanitizeCssRuntimeValue(config.styles.icon.color, DEFAULT_CONFIG.styles.icon.color),
        size: sanitizeCssRuntimeValue(config.styles.icon.size, DEFAULT_CONFIG.styles.icon.size),
      },
      title_size: sanitizeCssRuntimeValue(config.styles.title_size, DEFAULT_CONFIG.styles.title_size),
      item_radius: sanitizeCssRuntimeValue(config.styles.item_radius, DEFAULT_CONFIG.styles.item_radius),
      accent: sanitizeCssRuntimeValue(config.styles.accent, DEFAULT_CONFIG.styles.accent),
    };
    const notifications = this._getNotifications({ notifyMobile: true });
    const hiddenCount = Math.max(0, notifications.length - config.max_visible);
    const shouldStack = notifications.length > config.max_visible;
    const collapsedStackDepth = shouldStack && !this._expanded ? Math.min(4, hiddenCount) : 0;
    const collapsedStackReserve = collapsedStackDepth ? 4 + collapsedStackDepth * 5 : 0;
    const isCollapsingStack = this._collapsingStack && this._expanded;
    const visible = this._expanded || isCollapsingStack ? notifications : notifications.slice(0, config.max_visible);
    const hasNotifications = notifications.length > 0;
    const customEmptyMessage = String(config.empty_message ?? "").trim();
    const emptyText =
      customEmptyMessage ||
      this._text("empty.message", "");
    const animations = this._getAnimationSettings();
    const nextNotificationIdsSignature = notifications.map(item => item.id).join("|");
    const animateEntrance = animations.enabled && this._animateContentOnNextRender;
    const stackTransition = animations.enabled ? this._stackTransition : "";
    this._lastNotificationIdsSignature = nextNotificationIdsSignature;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --nodalia-surface: var(--card-background-color, rgba(32, 34, 42, 0.92));
          --nodalia-surface-soft: var(--ha-card-background, var(--card-background-color, rgba(32, 34, 42, 0.88)));
          --nodalia-border: var(--divider-color, rgba(255, 255, 255, 0.12));
          --nodalia-text: var(--primary-text-color, #f4f4f7);
          --nodalia-muted: var(--secondary-text-color, rgba(244, 244, 247, 0.62));
          --nodalia-user-card-bg: ${styles.card.background};
          display: block;
          overflow: visible;
        }
        * {
          box-sizing: border-box;
        }
        ha-card {
          color: var(--primary-text-color);
          display: block;
        }
        .notifications-card--list {
          background: transparent;
          border: 0;
          box-shadow: none;
          color: var(--primary-text-color);
          display: block;
          overflow: visible;
          padding: 0;
        }
        .notifications-card--empty {
          --notifications-accent: var(--success-color, #43a047);
          --notifications-surface-base: var(--nodalia-user-card-bg, var(--nodalia-surface-soft));
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
            linear-gradient(135deg, color-mix(in srgb, var(--notifications-accent) 18%, var(--notifications-surface-base)) 0%, color-mix(in srgb, var(--notifications-accent) 10%, var(--notifications-surface-base)) 52%, var(--notifications-surface-base) 100%),
            var(--notifications-surface-base);
          border: 1px solid color-mix(in srgb, var(--notifications-accent) 32%, var(--divider-color));
          border-radius: ${styles.card.border_radius};
          box-shadow:
            ${styles.card.box_shadow},
            0 16px 32px color-mix(in srgb, var(--notifications-accent) 18%, rgba(0, 0, 0, 0.18));
          isolation: isolate;
          overflow: hidden;
          position: relative;
          transform: translateZ(0);
        }
        .notifications-card--empty::before {
          background: linear-gradient(180deg, color-mix(in srgb, var(--notifications-accent) 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0));
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }
        .notifications-card--empty::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, var(--notifications-accent) 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, var(--notifications-accent) 14%, transparent) 0%, transparent 66%);
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }
        .notifications-empty-inline {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: auto minmax(0, 1fr);
          min-height: 64px;
          padding: 10px 14px;
          position: relative;
          z-index: 1;
        }
        .notifications-empty-inline__icon {
          align-items: center;
          background: color-mix(in srgb, var(--notifications-accent) 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: color-mix(in srgb, var(--notifications-accent) 78%, var(--primary-text-color));
          display: inline-flex;
          height: 44px;
          justify-content: center;
          width: 44px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.12);
        }
        .notifications-empty-inline__icon ha-icon {
          --mdc-icon-size: 20px;
        }
        .notifications-empty-inline__text {
          font-size: clamp(12px, 1.1vw, 14px);
          font-weight: 650;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }
        .notifications-stack {
          --notifications-stack-reserve: ${collapsedStackReserve}px;
          align-content: start;
          align-items: start;
          display: grid;
          isolation: isolate;
          padding-bottom: var(--notifications-stack-reserve, 0px);
          position: relative;
        }
        .notifications-stack-toggle,
        .notification-item__dismiss,
        .notification-item__action {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 10%, var(--nodalia-user-card-bg, var(--nodalia-surface-soft)));
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, var(--nodalia-border, rgba(255, 255, 255, 0.12)));
          border-radius: 999px;
          color: var(--nodalia-text, var(--primary-text-color));
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          justify-content: center;
          margin: 0;
          min-height: 24px;
          padding: 0 9px;
        }
        .notifications-list {
          align-content: start;
          align-items: start;
          display: grid;
          gap: 8px;
          isolation: isolate;
          position: relative;
          z-index: 6;
        }
        .notification-item {
          --notification-accent: ${styles.accent};
          --notification-surface-base: var(--nodalia-user-card-bg, var(--nodalia-surface-soft));
          align-items: start;
          align-self: start;
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
            linear-gradient(135deg, color-mix(in srgb, var(--notification-accent) 18%, var(--notification-surface-base)) 0%, color-mix(in srgb, var(--notification-accent) 10%, var(--notification-surface-base)) 52%, var(--notification-surface-base) 100%),
            var(--notification-surface-base);
          border: 1px solid color-mix(in srgb, var(--notification-accent) 32%, var(--divider-color));
          border-radius: ${styles.item_radius};
          box-shadow:
            ${styles.card.box_shadow},
            0 16px 32px color-mix(in srgb, var(--notification-accent) 18%, rgba(0, 0, 0, 0.18));
          display: grid;
          gap: 10px;
          grid-template-columns: auto minmax(0, 1fr);
          isolation: isolate;
          min-width: 0;
          min-height: 64px;
          overflow: hidden;
          padding: 10px 12px;
          position: relative;
          transform: translateZ(0);
          transform-origin: center top;
          z-index: 4;
        }
        .notification-item--collapsing-tail {
          pointer-events: none;
        }
        .notification-item::before {
          background: linear-gradient(180deg, color-mix(in srgb, var(--notification-accent) 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0));
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }
        .notification-item::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, var(--notification-accent) 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, var(--notification-accent) 14%, transparent) 0%, transparent 66%);
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }
        .notification-item--success {
          --notification-accent: var(--success-color, #43a047);
        }
        .notification-item--warning {
          --notification-accent: var(--warning-color, #f59e0b);
        }
        .notification-item--critical {
          --notification-accent: var(--error-color, #db4437);
        }
        .notification-item__icon {
          align-items: center;
          background: color-mix(in srgb, var(--notification-accent) 16%, transparent);
          border: 1px solid color-mix(in srgb, var(--notification-accent) 22%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.12);
          color: var(--notification-icon-color, var(--notification-accent));
          display: inline-flex;
          height: 44px;
          justify-content: center;
          position: relative;
          width: 44px;
          z-index: 1;
        }
        .notification-item__icon ha-icon {
          --mdc-icon-size: 20px;
          color: var(--notification-icon-color, var(--notification-accent));
        }
        .notification-item__body {
          display: grid;
          gap: 5px;
          min-width: 0;
          position: relative;
          z-index: 1;
        }
        .notification-item__title-row {
          align-items: start;
          display: grid;
          gap: 6px;
          grid-template-columns: minmax(0, 1fr) auto auto auto;
        }
        .notification-item__mobile-hint {
          align-items: center;
          color: color-mix(in srgb, var(--primary-text-color) 58%, transparent);
          display: inline-flex;
          height: 20px;
          justify-content: center;
          opacity: 0.82;
          width: 20px;
        }
        .notification-item__mobile-hint ha-icon {
          --mdc-icon-size: 14px;
        }
        .notification-item__title {
          font-size: clamp(12px, 1.25vw, 14px);
          font-weight: 700;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }
        .notification-item__dismiss {
          height: 24px;
          min-height: 24px;
          padding: 0;
          width: 24px;
        }
        .notification-item__dismiss ha-icon {
          --mdc-icon-size: 14px;
        }
        .notification-item__message {
          color: var(--primary-text-color);
          font-size: 12px;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }
        .notification-item__chips {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          min-width: 0;
        }
        .notification-item__chips--top {
          align-self: start;
          flex-wrap: nowrap;
          justify-content: flex-end;
          max-width: min(42vw, 160px);
          overflow: hidden;
          padding-top: 1px;
        }
        .notification-item__chips--top .notification-item__chip {
          max-width: 100%;
        }
        .notification-item__chip {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 10%, var(--nodalia-user-card-bg, var(--nodalia-surface-soft)));
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 10%, var(--nodalia-border, rgba(255, 255, 255, 0.12)));
          border-radius: 999px;
          color: var(--nodalia-muted, var(--secondary-text-color));
          display: inline-flex;
          flex: 0 1 auto;
          font-size: 10.5px;
          font-weight: 600;
          line-height: 1;
          min-height: 22px;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding: 0 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .notification-item__chip--state {
          color: var(--nodalia-text, var(--primary-text-color));
        }
        .notification-item__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding-top: 1px;
        }
        .notification-item__action {
          background: color-mix(in srgb, var(--notification-accent) 14%, transparent);
          border-color: color-mix(in srgb, var(--notification-accent) 24%, transparent);
          color: var(--primary-text-color);
          font-size: 11px;
          font-weight: 700;
        }
        .notification-stack-card {
          --stack-surface: var(--nodalia-user-card-bg, var(--nodalia-surface-soft));
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.02)),
            linear-gradient(135deg, color-mix(in srgb, var(--stack-accent, var(--primary-color)) 12%, var(--stack-surface)) 0%, color-mix(in srgb, var(--stack-accent, var(--primary-color)) 6%, var(--stack-surface)) 58%, var(--stack-surface) 100%),
            var(--stack-surface);
          border: 1px solid color-mix(in srgb, var(--stack-accent, var(--primary-color)) 20%, color-mix(in srgb, var(--primary-text-color) 10%, var(--nodalia-border, rgba(255, 255, 255, 0.12))));
          border-radius: ${styles.item_radius};
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.08);
          height: calc(100% - 2px);
          left: var(--stack-inset, 4px);
          opacity: var(--stack-opacity, 0.72);
          overflow: hidden;
          pointer-events: none;
          position: absolute;
          right: var(--stack-inset, 4px);
          top: var(--stack-offset, 7px);
          z-index: calc(var(--stack-z, 2) - 8);
        }
        .notifications-footer {
          align-items: center;
          display: flex;
          justify-content: center;
          margin-top: -7px;
          position: relative;
          z-index: 8;
        }
        .notifications-stack-toggle {
          background: color-mix(in srgb, var(--primary-text-color) 12%, var(--nodalia-user-card-bg, var(--nodalia-surface-soft)));
          border-color: color-mix(in srgb, var(--primary-text-color) 14%, var(--nodalia-border, rgba(255, 255, 255, 0.12)));
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.16);
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          height: 28px;
          min-height: 28px;
          padding: 0 9px;
        }
        .notifications-stack-toggle ha-icon {
          --mdc-icon-size: 16px;
        }
        .notifications-card--animated.notifications-card--enter .notifications-empty-inline,
        .notifications-card--animated.notifications-card--enter .notification-item {
          animation: notifications-card-fade-up calc(var(--notifications-content-duration, 420ms) * 0.96) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: calc(70ms + (var(--notification-index, 0) * 40ms));
        }
        .notifications-card--animated.notifications-card--enter .notification-item__icon {
          animation: notifications-card-bubble-bloom calc(var(--notifications-content-duration, 420ms) * 0.92) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: calc(40ms + (var(--notification-index, 0) * 40ms));
        }
        .notifications-card--animated.notifications-card--enter .notification-item__title,
        .notifications-card--animated.notifications-card--enter .notification-item__message,
        .notifications-card--animated.notifications-card--enter .notification-item__actions {
          animation: notifications-card-fade-up calc(var(--notifications-content-duration, 420ms) * 0.72) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: calc(92ms + (var(--notification-index, 0) * 40ms));
        }
        .notifications-card--animated.notifications-card--enter .notification-item__chip {
          animation: notifications-card-chip-pop calc(var(--notifications-content-duration, 420ms) * 0.58) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
          animation-delay: calc(116ms + (var(--notification-index, 0) * 40ms));
        }
        .notifications-card--animated.notifications-card--stack-expand .notifications-list,
        .notifications-card--animated.notifications-card--stack-collapse-final .notifications-list {
          animation: notifications-stack-reflow calc(var(--notifications-content-duration, 420ms) * 0.72) cubic-bezier(0.18, 0.9, 0.22, 1.08) both;
        }
        .notifications-card--animated.notifications-card--stack-expand .notification-item {
          animation: notifications-card-item-rise calc(var(--notifications-content-duration, 420ms) * 0.74) cubic-bezier(0.18, 0.9, 0.22, 1.08) both;
          animation-delay: calc(var(--notification-index, 0) * 34ms);
        }
        .notifications-card--animated.notifications-card--stack-collapse .notification-item--collapsing-tail {
          animation: notifications-stack-tail-out calc(var(--notifications-content-duration, 420ms) * 0.62) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: calc(var(--notification-exit-index, 0) * 28ms);
          transform-origin: center top;
        }
        .notifications-card--animated.notifications-card--stack-collapse-final .notification-stack-card,
        .notifications-card--animated.notifications-card--stack-collapse-final .notifications-stack-toggle {
          animation: notifications-stack-collapse calc(var(--notifications-content-duration, 420ms) * 0.66) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }
        .notifications-card--animated .notifications-stack-toggle.is-pressing,
        .notifications-card--animated .notification-item__dismiss.is-pressing,
        .notifications-card--animated .notification-item__action.is-pressing {
          animation: notifications-button-bounce var(--notifications-button-bounce-duration, 320ms) cubic-bezier(0.2, 0.9, 0.25, 1.35) both;
        }
        @keyframes notifications-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes notifications-card-item-rise {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.94);
          }
          62% {
            opacity: 1;
            transform: translateY(0) scale(1.018);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes notifications-card-chip-pop {
          0% {
            opacity: 0;
            transform: translateY(-4px) scale(0.86);
          }
          70% {
            opacity: 1;
            transform: translateY(1px) scale(1.05);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes notifications-card-bubble-bloom {
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
        @keyframes notifications-stack-reflow {
          0% {
            opacity: 0.7;
            transform: translateY(-6px) scaleY(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }
        @keyframes notifications-stack-collapse {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.94);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes notifications-stack-tail-out {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-10px) scale(0.965);
          }
        }
        @keyframes notifications-button-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(0.94);
          }
          100% {
            transform: scale(1);
          }
        }
      </style>
      <ha-card
        class="notifications-card ${hasNotifications ? "notifications-card--list" : "notifications-card--empty"} ${animations.enabled ? "notifications-card--animated" : ""} ${animateEntrance ? "notifications-card--enter" : ""} ${stackTransition ? `notifications-card--stack-${stackTransition}` : ""}"
        style="--notifications-content-duration:${animations.enabled ? animations.contentDuration : 0}ms; --notifications-button-bounce-duration:${animations.enabled ? animations.buttonBounceDuration : 0}ms;"
      >
          ${
            hasNotifications
              ? `
                <div class="notifications-stack">
                  <div class="notifications-list">
                    ${
                      shouldStack && !this._expanded
                        ? this._renderCollapsedStackCards(notifications, config.max_visible)
                        : ""
                    }
                    ${visible.map((item, index) => this._renderNotification(item, {
                      primary: index === 0,
                      index,
                      exiting: isCollapsingStack && index >= config.max_visible,
                      exitIndex: Math.max(0, index - config.max_visible),
                    })).join("")}
                  </div>
                  ${
                    shouldStack
                      ? `
                        <div class="notifications-footer">
                          <button type="button" class="notifications-stack-toggle" data-action="toggle-stack" aria-expanded="${this._expanded ? "true" : "false"}" aria-label="${escapeHtml(this._expanded ? this._text("aria.showLess", "Show less") : this._text("aria.showAll", "Show all notifications"))}">
                            <ha-icon icon="${this._expanded ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
                            <span>${this._expanded ? escapeHtml(this._text("actions.less", "Menos")) : hiddenCount}</span>
                          </button>
                        </div>
                      `
                      : ""
                  }
                </div>
              `
              : `
                <div class="notifications-empty-inline">
                  <div class="notifications-empty-inline__icon">
                    <ha-icon icon="mdi:check"></ha-icon>
                  </div>
                  <div class="notifications-empty-inline__text">${escapeHtml(emptyText)}</div>
                </div>
              `
          }
      </ha-card>
    `;
    if (animateEntrance) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 120);
    }
    this._stackTransition = "";
  }
}
  _lazyNodaliaNotificationsCard = NodaliaNotificationsCard;
  return NodaliaNotificationsCard;
}
