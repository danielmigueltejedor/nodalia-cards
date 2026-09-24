// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  COMPACT_LAYOUT_THRESHOLD,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  HUMIDIFIER_MEMORY_STORAGE_KEY,
  OPTIMISTIC_TOGGLE_TIMEOUT,
  OPTIMISTIC_VISUAL_SETTLE_MS,
} from "./humidifier-constants";
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
} from "./humidifier-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, getSafeStyles, normalizeConfig } from "./humidifier-config";
import {
  applyStubEntity,
  getCircularLayoutDialModel,
  getCircularLayoutDialValueFromPoint,
  getRangeValueFromGeometry,
  getSliderDragGeometry,
  isUnavailableState,
  parseSizeToPixels,
  translateModeLabel,
} from "./humidifier-helpers";

let _lazyNodaliaHumidifierCard;
export function loadNodaliaHumidifierCard() {
  if (_lazyNodaliaHumidifierCard) {
    return _lazyNodaliaHumidifierCard;
  }
class NodaliaHumidifierCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["humidifier"], entities, entitiesFallback);
  }

  static getEntitySuggestion(hass, entityId) {
    return window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, { domains: ["humidifier"] });
  }

  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._optimisticToggle = null;
    this._optimisticToggleTimer = 0;
    this._optimisticVisualSettle = null;
    this._optimisticVisualSettleTimer = 0;
    this._lastKnownOnState = new Map();
    this._draftHumidity = new Map();
    this._modePanelOpen = false;
    this._fanModePanelOpen = false;
    this._cardWidth = 0;
    this._isCompactLayout = false;
    this._activeSliderDrag = null;
    this._pendingRenderAfterDrag = false;
    this._skipNextSliderChange = null;
    this._dragFrame = 0;
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._pendingDragUpdate = null;
    this._dragWindowListenersAttached = false;
    this._lastRenderSignature = "";
    this._lastEntityRevision = "";
    this._lastRenderedIsOn = null;
    this._lastRenderedPanelKey = "";
    this._lastControlsMarkup = "";
    this._lastPanelMarkup = "";
    this._animationCleanupTimer = 0;
    this._entranceAnimationResetTimer = 0;
    this._animateContentOnNextRender = true;
    this._powerTransition = null;
    this._controlsTransition = null;
    this._panelTransition = null;
    this._suppressNextHumidifierTap = false;
    this._resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextWidth = Math.round(entry.contentRect?.width || this.clientWidth || 0);
      const nextCompact = this._shouldUseCompactLayout(nextWidth);

      if (nextWidth === this._cardWidth && nextCompact === this._isCompactLayout) {
        return;
      }

      this._cardWidth = nextWidth;
      this._isCompactLayout = nextCompact;

      if (this._activeSliderDrag) {
        this._pendingRenderAfterDrag = true;
        return;
      }

      const signature = this._getRenderSignature();
      if (signature === this._lastRenderSignature) {
        return;
      }

      this._lastRenderSignature = signature;
      this._render();
    });
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowChange = this._onShadowChange.bind(this);
    this._onShadowPointerDown = this._onShadowPointerDown.bind(this);
    this._onShadowMouseDown = this._onShadowMouseDown.bind(this);
    this._onShadowTouchStart = this._onShadowTouchStart.bind(this);
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
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown);
    this.shadowRoot.addEventListener("mousedown", this._onShadowMouseDown);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      this.shadowRoot.addEventListener("touchstart", this._onShadowTouchStart, { passive: false });
    }
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const path = event.composedPath();
              if (path.some(node => node instanceof HTMLInputElement && node.dataset?.humidifierControl)) {
                return null;
              }
              if (window.NodaliaUtils?.isNodaliaSliderChromeHit?.(event)) {
                return null;
              }
              const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.humidifierAction);
              const zone = actionButton?.dataset?.humidifierAction;
              return zone === "body" || zone === "icon" ? zone : null;
            },
            shouldBeginHold: zone => this._resolveHumidifierHoldEffect(zone) !== "none",
            onHold: zone => {
              const effect = this._resolveHumidifierHoldEffect(zone);
              if (effect === "none") {
                return;
              }
              this._triggerHaptic();
              this._executeHumidifierHoldEffect(zone, effect);
            },
            markHoldConsumedClick: () => {
              this._suppressNextHumidifierTap = true;
            },
          })
        : () => {};
    }

  connectedCallback() {
    this._detachHostHold?.reconnect?.();
    this._resizeObserver?.observe(this);
    this._scheduleOptimisticToggleTimeout();
    this._scheduleOptimisticVisualSettleTimeout();
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    this._detachHostHold?.();
    this._resizeObserver?.disconnect();
    if (this._activeSliderDrag) {
      this._activeSliderDrag.dial?.classList?.remove("is-dragging");
      this._activeSliderDrag = null;
    }
    this._detachWindowDragListeners();
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }
    if (this._animationCleanupTimer) {
      window.clearTimeout(this._animationCleanupTimer);
      this._animationCleanupTimer = 0;
    }
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    this._powerTransition = null;
    this._controlsTransition = null;
    this._panelTransition = null;
    this._pendingDragUpdate = null;
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
    this._clearOptimisticToggleTimer();
    this._clearOptimisticVisualSettleTimer();
    window.NodaliaUtils?.clearDeferTimers?.(this);
  }

  setConfig(config) {
    const previousEntity = this._config?.entity || "";
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    if (previousEntity && previousEntity !== this._config.entity) {
      this._draftHumidity.delete(previousEntity);
      this._lastKnownOnState.delete(previousEntity);
      this._clearOptimisticVisualSettle();
      this._clearOptimisticToggleState();
    }
    this._isCompactLayout = this._shouldUseCompactLayout(
      Math.round(this._cardWidth || this.clientWidth || 0),
    );
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._render();
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

  set hass(hass) {
    this._hass = hass;
    const entityId = this._config?.entity || "";
    if (entityId && this._draftHumidity.has(entityId) && !this._activeSliderDrag) {
      this._syncDraftWithState();
    }
    const actualState = this._getActualState();
    const entityRevision = entityId && actualState
      ? `${entityId}:${actualState.state}:${actualState.last_updated || actualState.last_changed || ""}`
      : "";
    const revisionUnchanged = Boolean(entityRevision && entityRevision === this._lastEntityRevision);
    if (entityRevision) {
      this._lastEntityRevision = entityRevision;
    }
    const hasPendingOptimistic = Boolean(this._optimisticToggle || this._optimisticVisualSettle);
    let nextSignature = this._getRenderSignature();
    const signatureUnchanged = Boolean(
      this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature,
    );

    if (signatureUnchanged && !hasPendingOptimistic) {
      return;
    }

    let visualSettleChanged = false;
    if (!revisionUnchanged || hasPendingOptimistic) {
      visualSettleChanged = this._syncOptimisticVisualSettle(actualState);
    }

    const hadOptimisticToggle = Boolean(this._optimisticToggle);
    if (!revisionUnchanged || hasPendingOptimistic) {
      this._syncLastKnownOnState(actualState);
      this._syncOptimisticToggleState(actualState);
    }
    nextSignature = this._getRenderSignature();
    const optimisticJustConfirmed = hadOptimisticToggle && !this._optimisticToggle;

    if (
      signatureUnchanged
      && !optimisticJustConfirmed
      && !visualSettleChanged
      && this._shouldSkipRenderForUnchangedSignature()
    ) {
      return;
    }

    if (
      this.shadowRoot?.innerHTML
      && nextSignature === this._lastRenderSignature
      && !optimisticJustConfirmed
      && !this._optimisticToggle
      && !visualSettleChanged
    ) {
      return;
    }

    this._lastRenderSignature = nextSignature;

    if (this._activeSliderDrag) {
      this._pendingRenderAfterDrag = true;
      return;
    }

    this._render();
  }

  getCardSize() {
    return this._config?.layout === "circular" ? 5 : 3;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: this._config?.layout === "circular" ? 5 : 2,
      min_columns: this._config?.layout === "circular" ? 7 : 2,
    };
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const modeEntityId = this._config?.mode_entity || "";
    const helperEntityId = this._config?.fan_mode_entity || "";
    const actualState = entityId ? hass?.states?.[entityId] || null : null;
    const state = hass === this._hass ? this._buildOptimisticToggleState(actualState) : actualState;
    const modeEntityState = modeEntityId ? hass?.states?.[modeEntityId] || null : null;
    const helperState = helperEntityId ? hass?.states?.[helperEntityId] || null : null;
    const attrs = state?.attributes || {};
    const joinParts = window.NodaliaRenderSignature?.joinParts;
    const values = [
      entityId,
      String(state?.state || ""),
      String(attrs._nodalia_optimistic_toggle || ""),
      String(attrs.friendly_name || ""),
      String(attrs.icon || ""),
      this._config?.show_entity_picture === true,
      String(this._config?.entity_picture || attrs.entity_picture_local || attrs.entity_picture || ""),
      Number(attrs.humidity ?? -1),
      Number(attrs.target_humidity ?? -1),
      Number(attrs.min_humidity ?? -1),
      Number(attrs.max_humidity ?? -1),
      String(attrs.mode || ""),
      Array.isArray(attrs.available_modes) ? attrs.available_modes.join("|") : "",
      modeEntityId,
      String(modeEntityState?.state || ""),
      Array.isArray(modeEntityState?.attributes?.options)
        ? modeEntityState.attributes.options.join("|")
        : "",
      helperEntityId,
      String(helperState?.state || ""),
      Array.isArray(helperState?.attributes?.options)
        ? helperState.attributes.options.join("|")
        : "",
      String(this._config?.layout || "compact"),
      Boolean(this._isCompactLayout),
      Boolean(this._modePanelOpen),
      Boolean(this._fanModePanelOpen),
      `${String(this._config?.tap_action || "")}|${String(this._config?.icon_tap_action ?? "")}|${String(this._config?.tap_service || "")}|${String(this._config?.icon_tap_service || "")}`,
      `${String(this._config?.hold_action || "")}|${String(this._config?.icon_hold_action ?? "")}|${String(this._config?.hold_service || "")}|${String(this._config?.icon_hold_service || "")}`,
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "humidifier:", values }]);
    }
    return values.join("::");
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) && numericColumns > 0 ? numericColumns : null;
  }

  _getCompactLayoutThreshold() {
    const styles = getSafeStyles(this._config?.styles);
    const iconSize = parseSizeToPixels(styles?.icon?.size, 58);
    const cardPadding = parseSizeToPixels(styles?.card?.padding, 14);
    const cardGap = parseSizeToPixels(styles?.card?.gap, 12);

    return Math.max(
      COMPACT_LAYOUT_THRESHOLD,
      Math.round(iconSize + (cardPadding * 2) + cardGap + 24),
    );
  }

  _shouldUseCompactLayout(width = Math.round(this._cardWidth || this.clientWidth || 0)) {
    return window.NodaliaUtils.shouldUseCompactCardLayout({
      mode: this._config?.compact_layout_mode,
      width,
      gridColumns: this._getConfiguredGridColumns(),
      parentWidth: window.NodaliaUtils.resolveCompactLayoutParentWidth?.(this) || 0,
    });
  }

  _shouldShowCompactTitle(width = Math.round(this._cardWidth || this.clientWidth || 0)) {
    return window.NodaliaUtils.shouldShowCompactCardTitle({ width });
  }

  _getState() {
    const actualState = this._getActualState();
    const optimisticState = this._buildOptimisticToggleState(actualState);
    if (this._shouldUseOptimisticVisualSettle(actualState)) {
      return this._buildOptimisticVisualSettleState(actualState);
    }
    return optimisticState;
  }

  _getActualState(hass = this._hass) {
    return this._config?.entity ? hass?.states?.[this._config.entity] || null : null;
  }

  _createStateSnapshot(state) {
    if (!state) {
      return null;
    }
    return {
      ...state,
      attributes: { ...(state.attributes || {}) },
    };
  }

  _getStoredHumidifierMemory() {
    if (typeof window === "undefined" || !window.localStorage) {
      return {};
    }
    try {
      return JSON.parse(window.localStorage.getItem(HUMIDIFIER_MEMORY_STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  _storeHumidifierMemory(entityId, snapshot) {
    if (!entityId || !snapshot || typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      const memory = this._getStoredHumidifierMemory();
      memory[entityId] = {
        attributes: { ...(snapshot.attributes || {}) },
        last_changed: snapshot.last_changed || new Date().toISOString(),
      };
      window.localStorage.setItem(HUMIDIFIER_MEMORY_STORAGE_KEY, JSON.stringify(memory));
    } catch {
      // Ignore storage quota or privacy mode failures.
    }
  }

  _getStoredHumidifierSnapshot(entityId) {
    const stored = this._getStoredHumidifierMemory()[entityId];
    if (!stored?.attributes || typeof stored.attributes !== "object") {
      return null;
    }
    return {
      entity_id: entityId,
      state: "on",
      attributes: { ...(stored.attributes || {}) },
      last_changed: stored.last_changed || new Date().toISOString(),
      last_updated: stored.last_changed || new Date().toISOString(),
    };
  }

  _syncLastKnownOnState(actualState) {
    const entityId = this._config?.entity || "";
    if (!entityId || !actualState) {
      return;
    }

    const snapshot = this._createStateSnapshot(actualState);
    if (actualState.state === "on") {
      this._lastKnownOnState.set(entityId, snapshot);
      this._storeHumidifierMemory(entityId, snapshot);
      return;
    }

    const attrs = actualState.attributes || {};
    const rememberedHumidity = Number(
      Number.isFinite(Number(attrs.humidity)) ? attrs.humidity : attrs.target_humidity,
    );
    if (Number.isFinite(rememberedHumidity) && rememberedHumidity > 0) {
      this._lastKnownOnState.set(entityId, {
        ...snapshot,
        state: "on",
      });
      this._storeHumidifierMemory(entityId, snapshot);
    }
  }

  _getLastKnownOnState(entityId = this._config?.entity || "") {
    if (!entityId) {
      return null;
    }

    const cached = this._lastKnownOnState.get(entityId);
    if (cached) {
      return cached;
    }

    const stored = this._getStoredHumidifierSnapshot(entityId);
    if (stored) {
      this._lastKnownOnState.set(entityId, this._createStateSnapshot(stored));
    }

    return stored;
  }

  _startOptimisticVisualSettle(actualState, optimisticState) {
    const entityId = this._config?.entity || "";
    if (!entityId || !actualState || actualState.state !== "on" || !optimisticState) {
      this._clearOptimisticVisualSettle();
      return;
    }

    this._optimisticVisualSettle = {
      entityId,
      expiresAt: Date.now() + OPTIMISTIC_VISUAL_SETTLE_MS,
      stateSnapshot: this._createStateSnapshot(optimisticState),
    };
    this._scheduleOptimisticVisualSettleTimeout();
  }

  _hasPublishedHumidity(actualState) {
    const attrs = actualState?.attributes || {};
    const humidity = Number(attrs.humidity);
    const targetHumidity = Number(attrs.target_humidity);
    return (
      (Number.isFinite(humidity) && humidity > 0)
      || (Number.isFinite(targetHumidity) && targetHumidity > 0)
    );
  }

  _shouldUseOptimisticVisualSettle(actualState = this._getActualState()) {
    if (!this._optimisticVisualSettle) {
      return false;
    }

    if (this._optimisticVisualSettle.entityId !== (this._config?.entity || "")) {
      this._clearOptimisticVisualSettle();
      return false;
    }

    if (actualState?.state !== "on" || Date.now() >= this._optimisticVisualSettle.expiresAt) {
      this._clearOptimisticVisualSettle();
      return false;
    }

    if (this._hasPublishedHumidity(actualState)) {
      this._clearOptimisticVisualSettle();
      return false;
    }

    return true;
  }

  _buildOptimisticVisualSettleState(actualState = this._getActualState()) {
    const snapshot = this._optimisticVisualSettle?.stateSnapshot;
    if (!actualState || !snapshot) {
      return actualState;
    }

    const entityId = this._config?.entity || "";
    const attrs = {
      ...(actualState.attributes || {}),
      ...(snapshot.attributes || {}),
    };

    if (entityId && this._draftHumidity.has(entityId)) {
      const nextHumidity = clamp(
        Math.round(Number(this._draftHumidity.get(entityId))),
        this._getHumidityRange(actualState).min,
        this._getHumidityRange(actualState).max,
      );
      attrs.humidity = nextHumidity;
      attrs.target_humidity = nextHumidity;
    }

    return {
      ...actualState,
      attributes: attrs,
    };
  }

  _clearOptimisticToggleTimer() {
    if (this._optimisticToggleTimer) {
      window.clearTimeout(this._optimisticToggleTimer);
      this._optimisticToggleTimer = 0;
    }
  }

  _clearOptimisticVisualSettleTimer() {
    if (this._optimisticVisualSettleTimer) {
      window.clearTimeout(this._optimisticVisualSettleTimer);
      this._optimisticVisualSettleTimer = 0;
    }
  }

  _clearOptimisticVisualSettle() {
    this._clearOptimisticVisualSettleTimer();
    this._optimisticVisualSettle = null;
  }

  _syncOptimisticVisualSettle(actualState = this._getActualState()) {
    const hadSettle = Boolean(this._optimisticVisualSettle);
    this._shouldUseOptimisticVisualSettle(actualState);
    const hasSettle = Boolean(this._optimisticVisualSettle);
    if (hasSettle) {
      this._scheduleOptimisticVisualSettleTimeout();
    } else {
      this._clearOptimisticVisualSettleTimer();
    }
    return hadSettle !== hasSettle;
  }

  _scheduleOptimisticVisualSettleTimeout() {
    this._clearOptimisticVisualSettleTimer();
    if (!this._optimisticVisualSettle || !this.isConnected || typeof window === "undefined") {
      return;
    }

    const remaining = Math.max(0, this._optimisticVisualSettle.expiresAt - Date.now());
    this._optimisticVisualSettleTimer = window.setTimeout(() => {
      this._optimisticVisualSettleTimer = 0;
      if (!this.isConnected) {
        return;
      }
      const nextActualState = this._getActualState();
      if (this._shouldUseOptimisticVisualSettle(nextActualState)) {
        this._scheduleOptimisticVisualSettleTimeout();
        return;
      }
      this._lastRenderSignature = "";
      if (this._activeSliderDrag) {
        this._pendingRenderAfterDrag = true;
        return;
      }
      this._render();
    }, remaining);
  }

  _clearOptimisticToggleState() {
    this._clearOptimisticToggleTimer();
    this._optimisticToggle = null;
  }

  _isOptimisticTogglePending(actualState = this._getActualState()) {
    const entityId = this._config?.entity || "";
    if (!entityId || !this._optimisticToggle || this._optimisticToggle.entityId !== entityId) {
      this._optimisticToggle = null;
      return false;
    }

    const actualKey = normalizeTextKey(actualState?.state);
    const expectedKey = normalizeTextKey(this._optimisticToggle.expectedState);
    if (!actualState || !this._isHumidifierToggleableState(actualState) || actualKey === expectedKey) {
      this._optimisticToggle = null;
      return false;
    }

    if (Date.now() >= this._optimisticToggle.expiresAt) {
      this._optimisticToggle = null;
      return false;
    }

    return true;
  }

  _scheduleOptimisticToggleTimeout() {
    this._clearOptimisticToggleTimer();
    if (!this._optimisticToggle || !this.isConnected || typeof window === "undefined") {
      return;
    }

    const remaining = Math.max(0, this._optimisticToggle.expiresAt - Date.now());
    this._optimisticToggleTimer = window.setTimeout(() => {
      this._optimisticToggleTimer = 0;
      if (!this.isConnected) {
        return;
      }
      if (!this._isOptimisticTogglePending(this._getActualState())) {
        this._lastRenderSignature = "";
        this._render();
        return;
      }
      this._scheduleOptimisticToggleTimeout();
    }, remaining);
  }

  _startOptimisticToggle(expectedState, actualState = this._getActualState()) {
    const entityId = this._config?.entity || "";
    if (!entityId || !this._isHumidifierToggleableState(actualState)) {
      return;
    }

    const turningOn = normalizeTextKey(expectedState) === "on";
    const snapshotSource = turningOn
      ? (this._getLastKnownOnState(entityId) || actualState)
      : actualState;

    this._clearOptimisticToggleState();
    this._clearOptimisticVisualSettle();
    this._optimisticToggle = {
      entityId,
      expectedState,
      expiresAt: Date.now() + OPTIMISTIC_TOGGLE_TIMEOUT,
      stateSnapshot: this._createStateSnapshot(snapshotSource),
    };
    this._scheduleOptimisticToggleTimeout();
  }

  _composeOptimisticToggleState(actualState, toggle = this._optimisticToggle) {
    if (!toggle) {
      return actualState;
    }

    const turningOn = normalizeTextKey(toggle.expectedState) === "on";
    const snapshot = (turningOn
      ? (this._getLastKnownOnState(toggle.entityId) || toggle.stateSnapshot)
      : toggle.stateSnapshot) || actualState;
    if (!snapshot) {
      return actualState;
    }

    const entityId = toggle.entityId || this._config?.entity || "";
    const attrs = turningOn
      ? { ...(actualState?.attributes || {}), ...(snapshot.attributes || {}) }
      : { ...(snapshot.attributes || {}), ...(actualState?.attributes || {}) };

    if (entityId && this._draftHumidity.has(entityId)) {
      const nextHumidity = clamp(
        Math.round(Number(this._draftHumidity.get(entityId))),
        this._getHumidityRange(actualState).min,
        this._getHumidityRange(actualState).max,
      );
      attrs.humidity = nextHumidity;
      attrs.target_humidity = nextHumidity;
    }

    return {
      ...snapshot,
      entity_id: snapshot.entity_id || actualState?.entity_id || entityId,
      state: toggle.expectedState,
      attributes: {
        ...attrs,
        _nodalia_optimistic_toggle: toggle.expectedState,
      },
    };
  }

  _buildOptimisticToggleState(actualState = this._getActualState()) {
    if (!this._isOptimisticTogglePending(actualState)) {
      return actualState;
    }

    return this._composeOptimisticToggleState(actualState);
  }

  _syncOptimisticToggleState(actualState = this._getActualState()) {
    const toggle = this._optimisticToggle;
    if (!toggle) {
      return;
    }

    const optimisticDisplay = this._composeOptimisticToggleState(actualState, toggle);
    const stillPending = this._isOptimisticTogglePending(actualState);

    if (!stillPending) {
      if (actualState?.state === "on" && normalizeTextKey(toggle.expectedState) === "on") {
        this._startOptimisticVisualSettle(actualState, optimisticDisplay);
      }
      this._clearOptimisticToggleTimer();
      return;
    }

    this._scheduleOptimisticToggleTimeout();
  }

  _getExternalEntityState(entityId) {
    return entityId ? this._hass?.states?.[entityId] || null : null;
  }

  _isOn(state) {
    return String(state?.state || "") === "on";
  }

  _supportsTargetHumidity(state) {
    return (
      Number.isFinite(Number(state?.attributes?.humidity)) ||
      Number.isFinite(Number(state?.attributes?.target_humidity)) ||
      (
        Number.isFinite(Number(state?.attributes?.min_humidity)) &&
        Number.isFinite(Number(state?.attributes?.max_humidity))
      )
    );
  }

  _getHumidityRange(state) {
    const min = Number(state?.attributes?.min_humidity);
    const max = Number(state?.attributes?.max_humidity);

    if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
      return {
        min,
        max,
      };
    }

    return {
      min: 30,
      max: 80,
    };
  }

  _getTargetHumidity(state) {
    const entityId = this._config?.entity;
    if (entityId && this._draftHumidity.has(entityId)) {
      return clamp(Number(this._draftHumidity.get(entityId)), this._getHumidityRange(state).min, this._getHumidityRange(state).max);
    }

    const rawHumidity = Number(state?.attributes?.humidity);
    if (Number.isFinite(rawHumidity)) {
      const range = this._getHumidityRange(state);
      return clamp(rawHumidity, range.min, range.max);
    }

    const rawTargetHumidity = Number(state?.attributes?.target_humidity);
    if (Number.isFinite(rawTargetHumidity)) {
      const range = this._getHumidityRange(state);
      return clamp(rawTargetHumidity, range.min, range.max);
    }

    const range = this._getHumidityRange(state);
    return clamp(Math.round((range.min + range.max) / 2), range.min, range.max);
  }

  _syncDraftWithState() {
    const state = this._getActualState();
    const entityId = this._config?.entity;
    if (!entityId || !state || !this._draftHumidity.has(entityId)) {
      return;
    }

    const rawHumidity = Number(state.attributes?.humidity);
    const rawTargetHumidity = Number(state.attributes?.target_humidity);
    const actualHumidity = Number.isFinite(rawHumidity) ? rawHumidity : rawTargetHumidity;
    const draftHumidity = Number(this._draftHumidity.get(entityId));
    const tolerance = Math.max(1, 1 / 2);

    if (
      Number.isFinite(actualHumidity)
      && Number.isFinite(draftHumidity)
      && Math.abs(actualHumidity - draftHumidity) <= tolerance
    ) {
      this._draftHumidity.delete(entityId);
    }
  }

  _getHumidifierName(state) {
    return this._config?.name
      || state?.attributes?.friendly_name
      || this._config?.entity
      || "Humidifier";
  }

  _getHumidifierIcon(state) {
    if (this._config?.icon) {
      return this._config.icon;
    }

    const deviceClass = normalizeTextKey(state?.attributes?.device_class);
    if (deviceClass === "dehumidifier") {
      return this._isOn(state) ? "mdi:air-humidifier" : "mdi:air-humidifier-off";
    }

    return String(state?.attributes?.icon || "mdi:air-humidifier");
  }

  _getEntityPicture(state) {
    if (this._config?.show_entity_picture !== true) {
      return "";
    }
    return String(
      this._config?.entity_picture
      || state?.attributes?.entity_picture_local
      || state?.attributes?.entity_picture
      || "",
    ).trim();
  }

  _getStateLabel(state) {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const langCfg = this._config?.language ?? "auto";
    if (window.NodaliaI18n?.translateHumidifierDeviceState) {
      return window.NodaliaI18n.translateHumidifierDeviceState(hass, langCfg, state?.state);
    }
    const normalized = normalizeTextKey(state?.state);

    switch (normalized) {
      case "on":
        return "On";
      case "off":
        return "Off";
      case "humidifying":
        return "Humidifying";
      case "dehumidifying":
        return "Dehumidifying";
      case "drying":
        return "Drying";
      case "idle":
        return "Idle";
      default:
        return state?.state ? String(state.state) : "";
    }
  }

  _getModeOptions(state) {
    const modeEntity = this._getExternalEntityState(this._config?.mode_entity);

    if (Array.isArray(modeEntity?.attributes?.options)) {
      return modeEntity.attributes.options
        .map(item => String(item || "").trim())
        .filter(Boolean)
        .filter(option => !this._isModeHidden("hidden_modes", option));
    }

    if (Array.isArray(state?.attributes?.available_modes)) {
      return state.attributes.available_modes
        .map(item => String(item || "").trim())
        .filter(Boolean)
        .filter(option => !this._isModeHidden("hidden_modes", option));
    }

    return [];
  }

  _getCurrentMode(state) {
    const modeEntity = this._getExternalEntityState(this._config?.mode_entity);
    if (modeEntity?.state && !["unknown", "unavailable"].includes(modeEntity.state)) {
      return String(modeEntity.state);
    }

    if (state?.attributes?.mode) {
      return String(state.attributes.mode);
    }

    return "";
  }

  _getFanModeOptions() {
    const fanModeEntity = this._getExternalEntityState(this._config?.fan_mode_entity);
    return Array.isArray(fanModeEntity?.attributes?.options)
      ? fanModeEntity.attributes.options
        .map(item => String(item || "").trim())
        .filter(Boolean)
        .filter(option => !this._isModeHidden("hidden_fan_modes", option))
      : [];
  }

  _isModeHidden(field, value) {
    const hiddenModes = Array.isArray(this._config?.[field]) ? this._config[field] : [];
    const expectedKey = normalizeTextKey(value);
    return hiddenModes.some(item => normalizeTextKey(item) === expectedKey);
  }

  _getCurrentFanMode() {
    const fanModeEntity = this._getExternalEntityState(this._config?.fan_mode_entity);
    if (fanModeEntity?.state && !["unknown", "unavailable"].includes(fanModeEntity.state)) {
      return String(fanModeEntity.state);
    }

    return "";
  }

  _getAccentColor(state) {
    const styles = getSafeStyles(this._config?.styles);
    return this._isOn(state)
      ? styles?.icon?.on_color || DEFAULT_CONFIG.styles.icon.on_color
      : styles?.icon?.off_color || DEFAULT_CONFIG.styles.icon.off_color;
  }

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;
    return {
      enabled: configuredAnimations.enabled !== false,
      iconAnimation: configuredAnimations.icon_animation !== false,
      powerDuration: clamp(Number(configuredAnimations.power_duration) || DEFAULT_CONFIG.animations.power_duration, 120, 4000),
      controlsDuration: clamp(Number(configuredAnimations.controls_duration) || DEFAULT_CONFIG.animations.controls_duration, 120, 2400),
      panelDuration: clamp(Number(configuredAnimations.panel_duration) || DEFAULT_CONFIG.animations.panel_duration, 120, 2400),
      buttonBounceDuration: clamp(Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration, 120, 1200),
    };
  }

  _isTransitionAnimationActive(now = Date.now()) {
    return Boolean(
      (this._powerTransition?.endsAt > now)
      || (this._controlsTransition?.endsAt > now)
      || (this._panelTransition?.endsAt > now),
    );
  }

  _shouldSkipRenderForUnchangedSignature() {
    if (!this.shadowRoot?.innerHTML) {
      return false;
    }

    if (this._activeSliderDrag) {
      this._pendingRenderAfterDrag = true;
      return true;
    }

    return Boolean(this._optimisticToggle && this._isTransitionAnimationActive());
  }

  _scheduleAnimationCleanup(delay) {
    if (this._animationCleanupTimer) {
      window.clearTimeout(this._animationCleanupTimer);
      this._animationCleanupTimer = 0;
    }

    const safeDelay = clamp(Math.round(Number(delay) || 0), 0, 5000);
    if (!safeDelay || typeof window === "undefined") {
      return;
    }

    this._animationCleanupTimer = window.setTimeout(() => {
      this._animationCleanupTimer = 0;
      const shouldFinalizeRender = Boolean(
        this._powerTransition || this._controlsTransition || this._panelTransition,
      );
      this._powerTransition = null;
      this._controlsTransition = null;
      this._panelTransition = null;
      if (!shouldFinalizeRender || !this.isConnected) {
        return;
      }
      if (this._activeSliderDrag) {
        this._pendingRenderAfterDrag = true;
        return;
      }
      this._lastRenderSignature = "";
      this._render();
    }, safeDelay);
  }

  _triggerButtonBounce(button) {
    if (!(button instanceof HTMLElement)) {
      return;
    }

    const animations = this._getAnimationSettings();
    if (!animations.enabled) {
      return;
    }

    button.classList.remove("is-pressing");
    button.getBoundingClientRect();
    button.classList.add("is-pressing");

    const schedule = window.NodaliaUtils?.scheduleDeferTimer;
    const done = () => {
      if (!button.isConnected) {
        return;
      }
      button.classList.remove("is-pressing");
    };
    if (typeof schedule === "function") {
      schedule(this, done, animations.buttonBounceDuration + 40);
    } else {
      window.setTimeout(done, animations.buttonBounceDuration + 40);
    }
  }

  _triggerRenderedButtonBounce(selector) {
    if (!selector || !this.shadowRoot || typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      const button = this.shadowRoot?.querySelector(selector);
      if (!(button instanceof HTMLElement)) {
        return;
      }

      this._triggerButtonBounce(button);
    });
  }

  _setHumidifierService(service, data = {}) {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    this._hass.callService("humidifier", service, {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _callOptionService(entityId, option) {
    if (!this._hass || !entityId || !option) {
      return;
    }

    const [domain] = entityId.split(".");
    if (domain === "select") {
      this._hass.callService("select", "select_option", {
        entity_id: entityId,
        option,
      });
      return;
    }

    if (domain === "input_select") {
      this._hass.callService("input_select", "select_option", {
        entity_id: entityId,
        option,
      });
    }
  }

  _toggleHumidifier(state) {
    const actualState = this._getActualState();
    const effectiveState = state || this._getState();
    const turnOff = this._isOn(effectiveState);
    this._startOptimisticToggle(turnOff ? "off" : "on", actualState);

    if (turnOff) {
      this._setHumidifierService("turn_off");
      this._render();
      return;
    }

    this._setHumidifierService("turn_on");
    this._render();
  }

  _isHumidifierToggleableState(state) {
    const key = String(state?.state || "").trim().toLowerCase();
    return key === "on" || key === "off";
  }

  _resolveHumidifierTapEffect(zone) {
    const bodyRaw = this._config?.tap_action ?? "toggle";
    const iconRaw = this._config?.icon_tap_action;
    const raw =
      zone === "icon"
        ? (iconRaw === undefined || iconRaw === null || String(iconRaw).trim() === "" ? bodyRaw : iconRaw)
        : bodyRaw;
    let effect = String(raw || "toggle").trim().toLowerCase();
    const allowed = new Set(["auto", "toggle", "more-info", "service", "navigate", "url", "none"]);
    if (!allowed.has(effect)) {
      effect = "toggle";
    }
    if (effect === "auto") {
      const state = this._getState();
      return this._isHumidifierToggleableState(state) ? "toggle" : "more-info";
    }
    return effect;
  }

  _openMoreInfo(entityId = this._config?.entity) {
    const id = String(entityId || "").trim();
    if (!id) {
      return;
    }
    fireEvent(this, "hass-more-info", {
      entityId: id,
    });
  }

  _parseServiceData(rawValue) {
    if (!rawValue) {
      return {};
    }
    if (isObject(rawValue)) {
      return deepClone(rawValue);
    }
    try {
      const parsed = JSON.parse(rawValue);
      return isObject(parsed) ? parsed : {};
    } catch (_error) {
      return {};
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

  _callConfiguredService(serviceValue, entityId = this._config?.entity, rawData = "", rawTarget = "") {
    if (!this._hass || !serviceValue) {
      return;
    }
    if (!this._isServiceAllowed(serviceValue)) {
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Humidifier Card", serviceValue);
      return;
    }
    const [domain, service] = String(serviceValue).split(".");
    if (!domain || !service) {
      return;
    }
    const payload = this._parseServiceData(rawData);
    const target = this._parseServiceData(rawTarget);
    const hasTarget = Object.keys(target).length > 0;
    if (!hasTarget && entityId && payload.entity_id === undefined) {
      payload.entity_id = entityId;
    }
    this._hass.callService(domain, service, payload, hasTarget ? target : undefined);
  }

  _openConfiguredUrl(urlValue, newTab = false) {
    const url = window.NodaliaUtils?.sanitizeActionUrl(urlValue, { allowRelative: true }) || "";
    if (!url) {
      return;
    }
    if (newTab) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.href = url;
  }

  _openConfiguredNavigation(pathValue) {
    const path = window.NodaliaUtils?.sanitizeActionUrl?.(pathValue, { allowRelative: true }) || "";
    if (!path || path.includes("://")) {
      return;
    }
    fireEvent(this, "hass-navigate", { path });
  }

  _executeHumidifierTapEffect(zone, effect) {
    const isIcon = zone === "icon";
    switch (effect) {
      case "toggle":
        this._toggleHumidifier(this._getState());
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service": {
        const service = isIcon ? this._config?.icon_tap_service : this._config?.tap_service;
        const data = isIcon ? this._config?.icon_tap_service_data : this._config?.tap_service_data;
        const target = isIcon ? this._config?.icon_tap_service_target : this._config?.tap_service_target;
        this._callConfiguredService(service, this._config?.entity, data, target);
        break;
      }
      case "navigate":
        this._openConfiguredNavigation(
          isIcon ? this._config?.icon_navigation_path : this._config?.navigation_path,
        );
        break;
      case "url":
        this._openConfiguredUrl(
          isIcon ? this._config?.icon_tap_url : this._config?.tap_url,
          isIcon ? this._config?.icon_tap_new_tab === true : this._config?.tap_new_tab === true,
        );
        break;
      case "none":
      default:
        break;
    }
  }

  _resolveHumidifierHoldEffect(zone) {
    const bodyRaw = this._config?.hold_action ?? "none";
    const iconRaw = this._config?.icon_hold_action;
    const raw =
      zone === "icon"
        ? (iconRaw === undefined || iconRaw === null || String(iconRaw).trim() === "" ? bodyRaw : iconRaw)
        : bodyRaw;
    let effect = String(raw || "none").trim().toLowerCase();
    const allowed = new Set(["auto", "toggle", "more-info", "service", "navigate", "url", "none"]);
    if (!allowed.has(effect)) {
      effect = "none";
    }
    if (effect === "auto") {
      const state = this._getState();
      return this._isHumidifierToggleableState(state) ? "toggle" : "more-info";
    }
    return effect;
  }

  _executeHumidifierHoldEffect(zone, effect) {
    const isIcon = zone === "icon";
    switch (effect) {
      case "toggle":
        this._toggleHumidifier(this._getState());
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service": {
        let service = isIcon ? this._config?.icon_hold_service : this._config?.hold_service;
        let data = isIcon ? this._config?.icon_hold_service_data : this._config?.hold_service_data;
        let target = isIcon ? this._config?.icon_hold_service_target : this._config?.hold_service_target;
        if (isIcon && !String(service || "").trim()) {
          service = this._config?.hold_service;
          data = this._config?.hold_service_data;
          target = this._config?.hold_service_target;
        }
        this._callConfiguredService(service, this._config?.entity, data, target);
        break;
      }
      case "navigate": {
        let path = isIcon ? this._config?.icon_hold_navigation_path : this._config?.hold_navigation_path;
        if (isIcon && !String(path || "").trim()) {
          path = this._config?.hold_navigation_path;
        }
        this._openConfiguredNavigation(path);
        break;
      }
      case "url": {
        let url = isIcon ? this._config?.icon_hold_url : this._config?.hold_url;
        let tab = isIcon ? this._config?.icon_hold_new_tab === true : this._config?.hold_new_tab === true;
        if (isIcon && !String(url || "").trim()) {
          url = this._config?.hold_url;
          tab = this._config?.hold_new_tab === true;
        }
        this._openConfiguredUrl(url, tab);
        break;
      }
      case "none":
      default:
        break;
    }
  }

  _commitHumidity(value) {
    const state = this._getState();
    const range = this._getHumidityRange(state);
    const nextValue = clamp(Math.round(Number(value)), range.min, range.max);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    this._setHumidifierService("set_humidity", {
      humidity: nextValue,
    });
  }

  _changeHumidityBy(direction, state = this._getState()) {
    if (!state || !this._supportsTargetHumidity(state)) {
      return;
    }
    const step = 1;
    const range = this._getHumidityRange(state);
    const nextValue = clamp(this._getTargetHumidity(state) + (Number(direction) * step), range.min, range.max);
    this._draftHumidity.set(this._config.entity, nextValue);
    this._updateHumidityPreview(nextValue);
    this._commitHumidity(nextValue);
  }

  _commitMode(mode) {
    if (!mode) {
      return;
    }

    if (this._config?.mode_entity) {
      this._callOptionService(this._config.mode_entity, mode);
      return;
    }

    this._setHumidifierService("set_mode", {
      mode,
    });
  }

  _commitFanMode(mode) {
    if (!mode || !this._config?.fan_mode_entity) {
      return;
    }

    this._callOptionService(this._config.fan_mode_entity, mode);
  }

  _getPanelMarkup(panelKey, state = this._getState()) {
    if (panelKey === "mode") {
      const modeOptions = this._config?.show_mode_button !== false ? this._getModeOptions(state) : [];
      const currentMode = this._getCurrentMode(state);

      if (!modeOptions.length) {
        return "";
      }

      return `
        <div class="humidifier-card__panel">
          ${modeOptions
            .map(mode => `
              <button
                type="button"
                class="humidifier-card__option ${normalizeTextKey(mode) === normalizeTextKey(currentMode) ? "is-active" : ""}"
                data-humidifier-action="mode"
                data-mode="${escapeHtml(mode)}"
              >
                ${escapeHtml(translateModeLabel(mode, this._hass, this._config?.language ?? "auto"))}
              </button>
            `)
            .join("")}
        </div>
      `;
    }

    if (panelKey === "fan") {
      const fanModeOptions = this._config?.show_fan_mode_button !== false ? this._getFanModeOptions() : [];
      const currentFanMode = this._getCurrentFanMode();

      if (!fanModeOptions.length) {
        return "";
      }

      return `
        <div class="humidifier-card__panel">
          ${fanModeOptions
            .map(mode => `
              <button
                type="button"
                class="humidifier-card__option ${normalizeTextKey(mode) === normalizeTextKey(currentFanMode) ? "is-active" : ""}"
                data-humidifier-action="fan-mode"
                data-mode="${escapeHtml(mode)}"
              >
                ${escapeHtml(translateModeLabel(mode, this._hass, this._config?.language ?? "auto"))}
              </button>
            `)
            .join("")}
        </div>
      `;
    }

    return "";
  }

  _setPanelToggleButtonsState(panelKey) {
    this.shadowRoot
      ?.querySelectorAll('[data-humidifier-action="toggle-mode-panel"]')
      .forEach(button => {
        if (button instanceof HTMLElement) {
          button.classList.toggle("humidifier-card__control--active", panelKey === "mode");
        }
      });

    this.shadowRoot
      ?.querySelectorAll('[data-humidifier-action="toggle-fan-mode-panel"]')
      .forEach(button => {
        if (button instanceof HTMLElement) {
          button.classList.toggle("humidifier-card__control--active", panelKey === "fan");
        }
      });
  }

  _createMarkupNode(markup) {
    if (!markup || typeof document === "undefined") {
      return null;
    }

    const template = document.createElement("template");
    template.innerHTML = String(markup).trim();
    const node = template.content.firstElementChild;
    return node instanceof HTMLElement ? node : null;
  }

  _setVisiblePanelKey(panelKey, state = this._getState()) {
    const nextPanelKey = panelKey === "mode" || panelKey === "fan" ? panelKey : "";
    this._modePanelOpen = nextPanelKey === "mode";
    this._fanModePanelOpen = nextPanelKey === "fan";
    this._lastRenderedPanelKey = nextPanelKey;
    this._setPanelToggleButtonsState(nextPanelKey);

    const controlsInner = this.shadowRoot?.querySelector(".humidifier-card__controls-inner");
    const animations = this._getAnimationSettings();
    const panelMarkup = nextPanelKey ? this._getPanelMarkup(nextPanelKey, state) : "";

    if (panelMarkup) {
      this._lastPanelMarkup = panelMarkup;
    }

    if (!controlsInner || !(controlsInner instanceof HTMLElement) || !state || !this._isOn(state)) {
      this._render();
      return;
    }

    const existingPanel = controlsInner.querySelector(".humidifier-card__panel-shell");
    if (!animations.enabled) {
      if (existingPanel instanceof HTMLElement) {
        existingPanel.remove();
      }

      if (panelMarkup) {
        const panelNode = this._createMarkupNode(`
          <div class="humidifier-card__panel-shell" data-panel-key="${nextPanelKey}">
            <div class="humidifier-card__panel-inner">
              ${panelMarkup}
            </div>
          </div>
        `);

        if (panelNode instanceof HTMLElement) {
          controlsInner.appendChild(panelNode);
          return;
        }
      }

      this._render();
      return;
    }

    const removePanel = (panel, onDone = null) => {
      if (!(panel instanceof HTMLElement)) {
        if (typeof onDone === "function") {
          onDone();
        }
        return;
      }

      panel.classList.remove("humidifier-card__panel-shell--entering");
      panel.classList.add("humidifier-card__panel-shell--leaving");

      const finalizeRemoval = () => {
        if (panel.isConnected) {
          panel.remove();
        }
        if (typeof onDone === "function") {
          onDone();
        }
      };

      panel.addEventListener("animationend", finalizeRemoval, { once: true });
      const schedule = window.NodaliaUtils?.scheduleDeferTimer;
      if (typeof schedule === "function") {
        schedule(this, finalizeRemoval, animations.panelDuration + 80);
      } else {
        window.setTimeout(finalizeRemoval, animations.panelDuration + 80);
      }
    };
    const appendPanel = () => {
      if (!panelMarkup) {
        return;
      }

      const panelNode = this._createMarkupNode(`
        <div class="humidifier-card__panel-shell humidifier-card__panel-shell--entering" data-panel-key="${nextPanelKey}">
          <div class="humidifier-card__panel-inner">
            ${panelMarkup}
          </div>
        </div>
      `);

      if (!(panelNode instanceof HTMLElement)) {
        this._render();
        return;
      }

      controlsInner.appendChild(panelNode);
      const schedule = window.NodaliaUtils?.scheduleDeferTimer;
      const finalizeEnter = () => {
        if (panelNode.isConnected) {
          panelNode.classList.remove("humidifier-card__panel-shell--entering");
        }
      };
      if (typeof schedule === "function") {
        schedule(this, finalizeEnter, animations.panelDuration + 80);
      } else {
        window.setTimeout(finalizeEnter, animations.panelDuration + 80);
      }
    };

    if (!nextPanelKey) {
      if (existingPanel instanceof HTMLElement) {
        removePanel(existingPanel);
      }
      return;
    }

    if (!panelMarkup) {
      if (existingPanel instanceof HTMLElement) {
        removePanel(existingPanel);
      }
      return;
    }

    const existingPanelKey = existingPanel instanceof HTMLElement ? existingPanel.dataset.panelKey || "" : "";
    if (existingPanel instanceof HTMLElement && existingPanelKey === nextPanelKey) {
      if (existingPanel.classList.contains("humidifier-card__panel-shell--leaving")) {
        existingPanel.remove();
      } else {
        const panelInner = existingPanel.querySelector(".humidifier-card__panel-inner");
        if (panelInner instanceof HTMLElement) {
          panelInner.innerHTML = panelMarkup;
        }
        return;
      }
    }

    if (existingPanel instanceof HTMLElement) {
      removePanel(existingPanel, appendPanel);
      return;
    }

    appendPanel();
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

  _updateHumidityPreview(value) {
    const slider = this.shadowRoot?.querySelector('.humidifier-card__slider[data-humidifier-control="humidity"]');
    const state = this._getState();
    const range = this._getHumidityRange(state);
    const nextValue = clamp(Number(value), range.min, range.max);
    const progress = ((nextValue - range.min) / Math.max(range.max - range.min, 1)) * 100;

    if (slider instanceof HTMLInputElement) {
      slider.style.setProperty("--humidity", String(clamp(progress, 0, 100)));
      slider.closest(".humidifier-card__slider-shell")?.style.setProperty("--humidity", String(clamp(progress, 0, 100)));
    }

    const dial = this.shadowRoot?.querySelector(".humidifier-card__circular-dial");
    if (dial instanceof HTMLElement) {
      const model = getCircularLayoutDialModel(nextValue, range.min, range.max);
      dial.style.setProperty("--circular-progress", String(model.progress));
      dial.style.setProperty("--circular-marker-left", `${model.markerLeft}%`);
      dial.style.setProperty("--circular-marker-top", `${model.markerTop}%`);
    }

    const chip = this.shadowRoot?.querySelector('[data-humidifier-chip="humidity"]');
    if (chip instanceof HTMLElement) {
      chip.textContent = `${Math.round(nextValue)}%`;
    }
  }

  _hapticOnSliderStep(steppedValue, { commit = false } = {}) {
    if (this._config?.haptics?.scrolls?.humidity === false) {
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
      this._lastIdleSliderHapticValue = undefined;
      return;
    }
    if (this._lastIdleSliderHapticValue === next) {
      return;
    }
    this._lastIdleSliderHapticValue = next;
    this._triggerHaptic("selection");
  }

  _applySliderValue(slider, value, options = {}) {
    const commit = options.commit === true;
    const state = this._getState();
    const range = this._getHumidityRange(state);
    const nextValue = clamp(Number(value), range.min, range.max);
    const stepped = Math.round(nextValue);

    this._draftHumidity.set(this._config.entity, nextValue);
    this._updateHumidityPreview(nextValue);

    this._hapticOnSliderStep(stepped, { commit });
    if (commit) {
      this._commitHumidity(nextValue);
    }
  }

  _getCircularDialStep() {
    return 1;
  }

  _applyCircularDialValue(value, options = {}) {
    const commit = options.commit === true;
    const state = this._getState();
    const range = this._getHumidityRange(state);
    const nextValue = clamp(Number(value), range.min, range.max);
    const stepped = Math.round(nextValue);

    this._draftHumidity.set(this._config.entity, nextValue);
    this._updateHumidityPreview(nextValue);
    this._hapticOnSliderStep(stepped, { commit });
    if (commit) {
      this._commitHumidity(nextValue);
    }
  }

  _onShadowPointerDown(event) {
    const path = event.composedPath();
    const slider = path.find(node =>
      node instanceof HTMLInputElement &&
      node.type === "range" &&
      node.dataset?.humidifierControl,
    );

    if (!this._activeSliderDrag && slider && (typeof event.button !== "number" || event.button === 0)) {
      this._startSliderDrag(slider, event.clientX, event, event.pointerId);
      return;
    }

    if (this._activeSliderDrag || (typeof event.button === "number" && event.button !== 0)) {
      return;
    }

    const controlAction = path.find(
      node => node instanceof HTMLElement && node.dataset?.humidifierAction && node.dataset.humidifierAction !== "body",
    );
    if (controlAction) {
      return;
    }

    const dial = path.find(node => node instanceof HTMLElement && node.classList?.contains("humidifier-card__circular-dial"));
    if (!dial || !this._supportsTargetHumidity(this._getState())) {
      return;
    }

    this._startCircularDialDrag(dial, event.clientX, event.clientY, event, event.pointerId);
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

  _startCircularDialDrag(dial, clientX, clientY, event = null, pointerId = null) {
    if (!(dial instanceof HTMLElement)) {
      return;
    }

    const state = this._getState();
    if (!state || !this._supportsTargetHumidity(state)) {
      return;
    }

    const step = this._getCircularDialStep();
    const range = this._getHumidityRange(state);
    const seedValue = this._getTargetHumidity(state);
    this._activeSliderDrag = {
      kind: "circular",
      dial,
      geometry: dial.getBoundingClientRect(),
      range,
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

    this._pendingDragUpdate = null;
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
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
    if (!slider) {
      return;
    }

    this._activeSliderDrag = {
      kind: "linear",
      pointerId,
      slider,
      geometry: getSliderDragGeometry(slider),
      lastHapticValue: Math.round(Number(slider.value)),
    };
    this._attachWindowDragListeners();

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this._pendingDragUpdate = null;
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }

    const nextValue = getRangeValueFromGeometry(this._activeSliderDrag.geometry, slider.value, clientX);
    slider.value = String(nextValue);
    this._applySliderValue(slider, nextValue, { commit: false });
  }

  _commitSliderDrag(clientX, event = null, pointerId = null, clientY = null) {
    const drag = this._activeSliderDrag;
    if (!drag) {
      return;
    }

    if (event) {
      event.preventDefault();
    }

    this._pendingDragUpdate = null;
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
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
      this._suppressNextHumidifierTap = true;
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
    this._suppressNextHumidifierTap = true;

    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _onShadowMouseDown(event) {
    const path = event.composedPath();
    const slider = path.find(node =>
      node instanceof HTMLInputElement &&
      node.type === "range" &&
      node.dataset?.humidifierControl,
    );

    if (!this._activeSliderDrag && slider && event.button === 0) {
      this._startSliderDrag(slider, event.clientX, event);
      return;
    }

    if (this._activeSliderDrag || event.button !== 0) {
      return;
    }

    const controlAction = path.find(
      node => node instanceof HTMLElement && node.dataset?.humidifierAction && node.dataset.humidifierAction !== "body",
    );
    if (controlAction) {
      return;
    }

    const dial = path.find(node => node instanceof HTMLElement && node.classList?.contains("humidifier-card__circular-dial"));
    if (!dial || !this._supportsTargetHumidity(this._getState())) {
      return;
    }

    this._startCircularDialDrag(dial, event.clientX, event.clientY, event);
  }

  _onShadowTouchStart(event) {
    const path = event.composedPath();
    const slider = path.find(node =>
      node instanceof HTMLInputElement &&
      node.type === "range" &&
      node.dataset?.humidifierControl,
    );

    if (!this._activeSliderDrag && slider && event.touches?.length) {
      this._startSliderDrag(slider, event.touches[0].clientX, event);
      return;
    }

    if (this._activeSliderDrag || !event.touches?.length) {
      return;
    }

    const controlAction = path.find(
      node => node instanceof HTMLElement && node.dataset?.humidifierAction && node.dataset.humidifierAction !== "body",
    );
    if (controlAction) {
      return;
    }

    const dial = path.find(node => node instanceof HTMLElement && node.classList?.contains("humidifier-card__circular-dial"));
    if (!dial || !this._supportsTargetHumidity(this._getState())) {
      return;
    }

    this._startCircularDialDrag(dial, event.touches[0].clientX, event.touches[0].clientY, event);
  }

  _onWindowPointerMove(event) {
    const drag = this._activeSliderDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(drag.slider, event.clientX, event.clientY);
  }

  _onWindowPointerUp(event) {
    const drag = this._activeSliderDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    this._commitSliderDrag(event.clientX, event, event.pointerId, event.clientY);
  }

  _onWindowMouseMove(event) {
    if (!this._activeSliderDrag || (typeof event.buttons === "number" && (event.buttons & 1) === 0)) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(this._activeSliderDrag.slider, event.clientX, event.clientY);
  }

  _onWindowMouseUp(event) {
    if (!this._activeSliderDrag) {
      return;
    }

    this._commitSliderDrag(event.clientX, event, null, event.clientY);
  }

  _onWindowTouchMove(event) {
    if (!this._activeSliderDrag || !event.touches?.length) {
      return;
    }

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
    this._pendingDragUpdate = null;
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }

    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _onWindowTouchEnd(event) {
    if (!this._activeSliderDrag) {
      return;
    }

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
    if (this._dragWindowListenersAttached) {
      return;
    }
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
    if (!this._dragWindowListenersAttached) {
      return;
    }
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
    const slider = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.humidifierControl);

    if (!slider) {
      return;
    }

    event.stopPropagation();

    if (this._activeSliderDrag?.slider === slider) {
      return;
    }

    this._applySliderValue(slider, slider.value, { commit: false });
  }

  _onShadowChange(event) {
    const slider = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.humidifierControl);

    if (!slider) {
      return;
    }

    event.stopPropagation();

    if (this._skipNextSliderChange === slider) {
      this._skipNextSliderChange = null;
      return;
    }

    this._applySliderValue(slider, slider.value, { commit: true });
  }

  _onShadowClick(event) {
    const path = event.composedPath();
    const slider = path.find(
      node => node instanceof HTMLInputElement && node.dataset?.humidifierControl,
    );

    if (slider) {
      return;
    }

    const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.humidifierAction);

    if (!actionButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const state = this._getState();
    const humidifierAction = actionButton.dataset.humidifierAction;

    if (humidifierAction === "body" || humidifierAction === "icon") {
      const zone = humidifierAction;
      if (zone === "body" && window.NodaliaUtils?.isNodaliaSliderChromeHit?.(event)) {
        return;
      }
      if (this._suppressNextHumidifierTap) {
        this._suppressNextHumidifierTap = false;
        return;
      }
      const effect = this._resolveHumidifierTapEffect(zone);
      if (effect === "none") {
        return;
      }
      this._triggerHaptic();
      this._executeHumidifierTapEffect(zone, effect);
      return;
    }

    this._triggerHaptic();

    switch (humidifierAction) {
      case "decrease-humidity":
        this._triggerButtonBounce(actionButton);
        this._changeHumidityBy(-1, state);
        break;
      case "increase-humidity":
        this._triggerButtonBounce(actionButton);
        this._changeHumidityBy(1, state);
        break;
      case "toggle-mode-panel":
        this._triggerButtonBounce(actionButton);
        this._setVisiblePanelKey(this._modePanelOpen ? "" : "mode", state);
        break;
      case "toggle-fan-mode-panel":
        this._triggerButtonBounce(actionButton);
        this._setVisiblePanelKey(this._fanModePanelOpen ? "" : "fan", state);
        break;
      case "mode":
        this._triggerButtonBounce(actionButton);
        if (actionButton.dataset.mode) {
          this._commitMode(actionButton.dataset.mode);
        }
        break;
      case "fan-mode":
        this._triggerButtonBounce(actionButton);
        if (actionButton.dataset.mode) {
          this._commitFanMode(actionButton.dataset.mode);
        }
        break;
      default:
        break;
    }
  }

  _humidifierCardUi(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.humidifierCard;
    const enPack = window.NodaliaI18n?.strings?.("en")?.humidifierCard;
    const raw = pack?.[key] ?? enPack?.[key];
    return String(raw != null && raw !== "" ? raw : fallback);
  }

  _humidifierAria(key, fallback = "") {
    return window.NodaliaI18n?.translateHumidifierAria?.(this._hass, this._config?.language ?? "auto", key, fallback) || fallback;
  }

  _renderEmptyState() {
    const title = escapeHtml(this._humidifierCardUi("emptyTitle", "Nodalia Humidifier Card"));
    const body = escapeHtml(
      this._humidifierCardUi("emptyBody", "Set `entity` to a `humidifier.*` entity to show this card."),
    );
    return `
      <ha-card class="humidifier-card humidifier-card--empty">
        <div class="humidifier-card__empty-title">${title}</div>
        <div class="humidifier-card__empty-text">${body}</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const styles = config.styles;

    const entityGuard = window.NodaliaUtils?.renderLovelaceEntityGuardCardHtml?.(
      this._hass,
      config.entity,
      { cardClass: "humidifier-card" },
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

    const isOn = this._isOn(state);
    const isCircularLayout = config.layout === "circular";
    const title = this._getHumidifierName(state);
    const icon = this._getHumidifierIcon(state);
    const entityPicture = this._getEntityPicture(state);
    const accentColor = this._getAccentColor(state);
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const darkenBubbleIconGlyph =
      isOn && Boolean(window.NodaliaBubbleContrast?.shouldDarkenBubbleIconGlyph(state, accentColor));
    const showUnavailableBadge = isUnavailableState(state);
    const supportsHumidity = config.show_slider !== false && this._supportsTargetHumidity(state);
    const humidityRange = this._getHumidityRange(state);
    const currentHumidity = this._getTargetHumidity(state);
    const humidityProgress = ((currentHumidity - humidityRange.min) / Math.max(humidityRange.max - humidityRange.min, 1)) * 100;
    const modeOptions = config.show_mode_button !== false ? this._getModeOptions(state) : [];
    const currentMode = this._getCurrentMode(state);
    const fanModeOptions = config.show_fan_mode_button !== false ? this._getFanModeOptions() : [];
    const currentFanMode = this._getCurrentFanMode();
    const isCompactLayout = this._isCompactLayout;
    const chips = [];

    if (config.show_state === true) {
      chips.push(`<div class="humidifier-card__chip humidifier-card__chip--state">${escapeHtml(this._getStateLabel(state))}</div>`);
    }

    if (!isCompactLayout && config.show_target_humidity_chip !== false && supportsHumidity) {
      chips.push(`<div class="humidifier-card__chip" data-humidifier-chip="humidity">${escapeHtml(`${Math.round(currentHumidity)}%`)}</div>`);
    }

    if (!isCompactLayout && config.show_mode_chip !== false && currentMode) {
      chips.push(`<div class="humidifier-card__chip">${escapeHtml(translateModeLabel(currentMode, this._hass, config.language ?? "auto"))}</div>`);
    }

    if (!isCompactLayout && config.show_fan_mode_chip !== false && currentFanMode) {
      chips.push(`<div class="humidifier-card__chip">${escapeHtml(translateModeLabel(currentFanMode, this._hass, config.language ?? "auto"))}</div>`);
    }

    const showTitle = true;
    const showCopyBlock = showTitle || chips.length > 0;
    const hasSecondaryControls = (modeOptions.length > 0) || (fanModeOptions.length > 0);
    const showCompactSecondary = hasSecondaryControls && (!isCompactLayout || !supportsHumidity);
    if (isCompactLayout && supportsHumidity) {
      this._modePanelOpen = false;
      this._fanModePanelOpen = false;
    }
    const onCardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 54%, ${styles.card.background} 100%)`;
    const onCardBorder = `color-mix(in srgb, ${accentColor} 34%, var(--divider-color))`;
    const onCardShadow = `0 16px 32px color-mix(in srgb, ${accentColor} 14%, rgba(0, 0, 0, 0.18))`;
    const animations = this._getAnimationSettings();
    const now = Date.now();
    const wasOn = this._lastRenderedIsOn;
    const currentPanelKey = isOn
      ? (this._modePanelOpen && modeOptions.length
          ? "mode"
          : this._fanModePanelOpen && fanModeOptions.length
            ? "fan"
            : "")
      : "";
    let powerAnimationState = "";
    let controlsAnimationState = "";
    let panelAnimationState = "";

    if (!animations.enabled) {
      this._powerTransition = null;
      this._controlsTransition = null;
      this._panelTransition = null;
    } else if (wasOn !== null && wasOn !== isOn) {
      powerAnimationState = isOn ? "powering-up" : "powering-down";
      this._powerTransition = {
        endsAt: now + animations.powerDuration,
        startedAt: now,
        state: powerAnimationState,
      };

      if (supportsHumidity || hasSecondaryControls || this._lastControlsMarkup) {
        controlsAnimationState = isOn ? "entering" : "leaving";
        this._controlsTransition = {
          endsAt: now + animations.controlsDuration,
          startedAt: now,
          state: controlsAnimationState,
        };
      } else {
        this._controlsTransition = null;
      }

      this._panelTransition = null;
    } else {
      if (this._powerTransition?.endsAt > now) {
        powerAnimationState = this._powerTransition.state;
      } else {
        this._powerTransition = null;
      }

      if (this._controlsTransition?.endsAt > now) {
        controlsAnimationState = this._controlsTransition.state;
      } else {
        this._controlsTransition = null;
      }

      if (isOn && this._lastRenderedPanelKey !== currentPanelKey) {
        panelAnimationState = currentPanelKey ? "entering" : "leaving";
        this._panelTransition = {
          endsAt: now + animations.panelDuration,
          startedAt: now,
          state: panelAnimationState,
        };
      } else if (this._panelTransition?.endsAt > now) {
        panelAnimationState = this._panelTransition.state;
      } else {
        this._panelTransition = null;
      }

      if (!isOn) {
        this._panelTransition = null;
      }
    }

    const shouldAnimateHumidityFill = animations.enabled &&
      powerAnimationState === "powering-up" &&
      isOn &&
      supportsHumidity;
    const humidityFillDuration = shouldAnimateHumidityFill
      ? clamp(Math.round(animations.controlsDuration * 0.82), 220, 1100)
      : 0;
    let humidityFillDelay = 0;
    if (shouldAnimateHumidityFill && this._powerTransition?.startedAt != null) {
      const fillElapsed = now - Number(this._powerTransition.startedAt);
      if (fillElapsed > 0) {
        humidityFillDelay = -clamp(fillElapsed, 0, humidityFillDuration);
      }
    }
    const humiditySliderShellClass = shouldAnimateHumidityFill ? " humidifier-card__slider-shell--humidity-fill" : "";
    const shouldAnimateHumidityEmpty = animations.enabled && controlsAnimationState === "leaving";
    const humidityEmptyDuration = shouldAnimateHumidityEmpty
      ? clamp(Math.round(animations.controlsDuration * 0.72), 180, 900)
      : 0;
    let humidityEmptyDelay = 0;
    if (shouldAnimateHumidityEmpty && this._controlsTransition?.startedAt != null) {
      humidityEmptyDelay = -clamp(now - Number(this._controlsTransition.startedAt), 0, humidityEmptyDuration);
    }

    const mainControlsMarkup = isOn && supportsHumidity
      ? `
        <div class="humidifier-card__slider-row ${showCompactSecondary ? "" : "humidifier-card__slider-row--solo"}">
          <div class="humidifier-card__slider-wrap">
            <div class="humidifier-card__slider-shell${humiditySliderShellClass}" style="--humidity:${clamp(humidityProgress, 0, 100)}; --humidity-target:${clamp(humidityProgress, 0, 100)};">
              <div class="humidifier-card__slider-track"></div>
              <input
                type="range"
                class="humidifier-card__slider"
                data-humidifier-control="humidity"
                min="${humidityRange.min}"
                max="${humidityRange.max}"
                step="any"
                value="${currentHumidity}"
                style="--humidity:${clamp(humidityProgress, 0, 100)};"
                aria-label="${escapeHtml(this._humidifierAria("targetHumidity", "Target humidity"))}"
              />
            </div>
          </div>
          ${
            showCompactSecondary
              ? `
                <div class="humidifier-card__slider-actions">
                  ${
                    modeOptions.length
                      ? `
                        <button
                          type="button"
                          class="humidifier-card__control ${this._modePanelOpen ? "humidifier-card__control--active" : ""}"
                          data-humidifier-action="toggle-mode-panel"
                          aria-label="${escapeHtml(this._humidifierAria("showModes", "Show modes"))}"
                        >
                          <ha-icon icon="mdi:tune-variant"></ha-icon>
                        </button>
                      `
                      : ""
                  }
                  ${
                    fanModeOptions.length
                      ? `
                        <button
                          type="button"
                          class="humidifier-card__control ${this._fanModePanelOpen ? "humidifier-card__control--active" : ""}"
                          data-humidifier-action="toggle-fan-mode-panel"
                          aria-label="${escapeHtml(this._humidifierAria("showSpeeds", "Show speeds"))}"
                        >
                          <ha-icon icon="mdi:fan"></ha-icon>
                        </button>
                      `
                      : ""
                  }
                </div>
              `
              : ""
          }
        </div>
      `
      : !supportsHumidity && showCompactSecondary && isOn
        ? `
          <div class="humidifier-card__controls">
            ${
              modeOptions.length
                ? `
                  <button
                    type="button"
                    class="humidifier-card__control ${this._modePanelOpen ? "humidifier-card__control--active" : ""}"
                    data-humidifier-action="toggle-mode-panel"
                    aria-label="${escapeHtml(this._humidifierAria("showModes", "Show modes"))}"
                  >
                    <ha-icon icon="mdi:tune-variant"></ha-icon>
                  </button>
                `
                : ""
            }
            ${
              fanModeOptions.length
                ? `
                  <button
                    type="button"
                    class="humidifier-card__control ${this._fanModePanelOpen ? "humidifier-card__control--active" : ""}"
                    data-humidifier-action="toggle-fan-mode-panel"
                    aria-label="${escapeHtml(this._humidifierAria("showSpeeds", "Show speeds"))}"
                  >
                    <ha-icon icon="mdi:fan"></ha-icon>
                  </button>
                `
                : ""
            }
          </div>
        `
        : "";

    const currentPanelMarkup = currentPanelKey === "mode"
      ? `
        <div class="humidifier-card__panel">
          ${modeOptions
            .map(mode => `
              <button
                type="button"
                class="humidifier-card__option ${normalizeTextKey(mode) === normalizeTextKey(currentMode) ? "is-active" : ""}"
                data-humidifier-action="mode"
                data-mode="${escapeHtml(mode)}"
              >
                ${escapeHtml(translateModeLabel(mode, this._hass, config.language ?? "auto"))}
              </button>
            `)
            .join("")}
        </div>
      `
      : currentPanelKey === "fan"
        ? `
          <div class="humidifier-card__panel">
            ${fanModeOptions
              .map(mode => `
                <button
                  type="button"
                  class="humidifier-card__option ${normalizeTextKey(mode) === normalizeTextKey(currentFanMode) ? "is-active" : ""}"
                  data-humidifier-action="fan-mode"
                  data-mode="${escapeHtml(mode)}"
                >
                  ${escapeHtml(translateModeLabel(mode, this._hass, config.language ?? "auto"))}
                </button>
              `)
              .join("")}
          </div>
        `
        : "";
    const panelContentMarkup = currentPanelMarkup
      || (panelAnimationState === "leaving" ? this._lastPanelMarkup : "");
    const panelShellMarkup = panelContentMarkup
      ? `
        <div class="humidifier-card__panel-shell ${panelAnimationState ? `humidifier-card__panel-shell--${panelAnimationState}` : ""}" data-panel-key="${currentPanelKey || "hidden"}">
          <div class="humidifier-card__panel-inner">
            ${panelContentMarkup}
          </div>
        </div>
      `
      : "";
    const currentControlsAnimatedMarkup = [
      mainControlsMarkup,
      panelShellMarkup,
    ].filter(Boolean).join("");
    const currentControlsStaticMarkup = [
      mainControlsMarkup,
      currentPanelMarkup
        ? `
          <div class="humidifier-card__panel-shell" data-panel-key="${currentPanelKey || "hidden"}">
            <div class="humidifier-card__panel-inner">
              ${currentPanelMarkup}
            </div>
          </div>
        `
        : "",
    ].filter(Boolean).join("");
    const controlsContentMarkup = isOn
      ? currentControlsAnimatedMarkup
      : controlsAnimationState === "leaving"
        ? this._lastControlsMarkup
        : "";
    const controlsShellMarkup = controlsContentMarkup
      ? `
        <div class="humidifier-card__controls-shell ${controlsAnimationState ? `humidifier-card__controls-shell--${controlsAnimationState}` : ""}" data-nodalia-tap-shield="true">
          <div class="humidifier-card__controls-inner">
            ${controlsContentMarkup}
          </div>
        </div>
      `
      : "";
    const circularDial = getCircularLayoutDialModel(currentHumidity, humidityRange.min, humidityRange.max);
    const circularControlsMarkup = `
      <div class="humidifier-card__circular-layout">
        <div class="humidifier-card__circular-dial" data-nodalia-tap-shield="true" style="--circular-progress:${circularDial.progress};--circular-marker-left:${circularDial.markerLeft}%;--circular-marker-top:${circularDial.markerTop}%;">
          <svg viewBox="0 0 240 240" aria-hidden="true">
            <circle class="humidifier-card__circular-track" cx="120" cy="120" r="86" pathLength="100"></circle>
            <circle class="humidifier-card__circular-hit" cx="120" cy="120" r="86" pathLength="100" data-humidifier-control="circular-dial"></circle>
            <circle class="humidifier-card__circular-progress" cx="120" cy="120" r="86" pathLength="100"></circle>
          </svg>
          <span class="humidifier-card__circular-thumb" data-humidifier-control="circular-dial" aria-hidden="true"></span>
          <div class="humidifier-card__circular-center">
            <strong data-humidifier-chip="humidity">${escapeHtml(`${Math.round(currentHumidity)}%`)}</strong>
            <span class="humidifier-card__circular-divider" aria-hidden="true"></span>
            <span>${escapeHtml(this._humidifierAria("targetHumidity", "Target humidity"))}</span>
            <div class="humidifier-card__circular-actions">
              ${modeOptions.length ? `<button type="button" class="humidifier-card__control ${this._modePanelOpen ? "humidifier-card__control--active" : ""}" data-humidifier-action="toggle-mode-panel" aria-label="${escapeHtml(this._humidifierAria("showModes", "Show modes"))}"><ha-icon icon="mdi:tune-variant"></ha-icon></button>` : ""}
              ${fanModeOptions.length ? `<button type="button" class="humidifier-card__control ${this._fanModePanelOpen ? "humidifier-card__control--active" : ""}" data-humidifier-action="toggle-fan-mode-panel" aria-label="${escapeHtml(this._humidifierAria("showSpeeds", "Show speeds"))}"><ha-icon icon="mdi:fan"></ha-icon></button>` : ""}
            </div>
          </div>
        </div>
        <div class="humidifier-card__circular-steps">
          <button type="button" class="humidifier-card__circular-step" data-nodalia-tap-shield="true" data-humidifier-action="decrease-humidity" ${supportsHumidity ? "" : "disabled"} aria-label="${escapeHtml(this._humidifierAria("decreaseHumidity", "Decrease humidity"))}">&minus;</button>
          <button type="button" class="humidifier-card__circular-power ${isOn ? "is-active" : ""}" data-humidifier-action="icon" aria-label="${escapeHtml(window.NodaliaI18n?.translateCommonAria?.(this._hass, config.language ?? "auto", "togglePower", "Turn on or off") || "Turn on or off")}"><ha-icon icon="mdi:power"></ha-icon></button>
          <button type="button" class="humidifier-card__circular-step" data-nodalia-tap-shield="true" data-humidifier-action="increase-humidity" ${supportsHumidity ? "" : "disabled"} aria-label="${escapeHtml(this._humidifierAria("increaseHumidity", "Increase humidity"))}">+</button>
        </div>
        <div class="humidifier-card__controls-inner">${panelShellMarkup}</div>
      </div>
    `;
    const powerAnimationRemaining = powerAnimationState && this._powerTransition
      ? Math.max(0, this._powerTransition.endsAt - now)
      : 0;
    const powerAnimationDelay = powerAnimationState && this._powerTransition
      ? -clamp(now - Number(this._powerTransition.startedAt || now), 0, animations.powerDuration)
      : 0;
    const controlsAnimationRemaining = controlsAnimationState && this._controlsTransition
      ? Math.max(0, this._controlsTransition.endsAt - now)
      : 0;
    const controlsAnimationDelay = controlsAnimationState && this._controlsTransition
      ? -clamp(now - Number(this._controlsTransition.startedAt || now), 0, animations.controlsDuration)
      : 0;
    const panelAnimationRemaining = panelAnimationState && this._panelTransition
      ? Math.max(0, this._panelTransition.endsAt - now)
      : 0;
    const panelAnimationDelay = panelAnimationState && this._panelTransition
      ? -clamp(now - Number(this._panelTransition.startedAt || now), 0, animations.panelDuration)
      : 0;
    const humidityFillAnimationRemaining = shouldAnimateHumidityFill && this._powerTransition
      ? Math.max(0, Number(this._powerTransition.startedAt) + humidityFillDuration - now)
      : 0;
    const humidityEmptyAnimationRemaining = shouldAnimateHumidityEmpty && this._controlsTransition
      ? Math.max(0, Number(this._controlsTransition.startedAt) + humidityEmptyDuration - now)
      : 0;
    const shouldCleanupAfterAnimation = Boolean(
      powerAnimationRemaining ||
      controlsAnimationRemaining ||
      panelAnimationRemaining ||
      humidityFillAnimationRemaining ||
      humidityEmptyAnimationRemaining,
    );
    const cleanupDelay = shouldCleanupAfterAnimation
      ? Math.max(
        powerAnimationRemaining,
        controlsAnimationRemaining,
        panelAnimationRemaining,
        humidityFillAnimationRemaining,
        humidityEmptyAnimationRemaining,
      ) + 40
      : 0;
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const contentEntranceDuration = clamp(Math.round(animations.controlsDuration * 0.9), 180, 900);

    if (currentPanelMarkup) {
      this._lastPanelMarkup = currentPanelMarkup;
    }

    if (isOn && currentControlsStaticMarkup && panelAnimationState !== "leaving") {
      this._lastControlsMarkup = currentControlsStaticMarkup;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --humidifier-card-content-duration: ${animations.enabled ? contentEntranceDuration : 0}ms;
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        ha-card.humidifier-card {
          --humidifier-card-controls-max-height: 360px;
          --humidifier-card-controls-gap: calc(${styles.card.gap} + 4px);
          --humidifier-card-controls-duration: ${animations.controlsDuration}ms;
          --humidifier-card-controls-delay: ${controlsAnimationDelay}ms;
          --humidifier-card-panel-duration: ${animations.panelDuration}ms;
          --humidifier-card-panel-delay: ${panelAnimationDelay}ms;
          --humidifier-card-power-duration: ${animations.powerDuration}ms;
          --humidifier-card-power-delay: ${powerAnimationDelay}ms;
          --humidifier-card-humidity-fill-delay: ${humidityFillDelay}ms;
          --humidifier-card-humidity-fill-duration: ${humidityFillDuration}ms;
          --humidifier-card-humidity-empty-delay: ${humidityEmptyDelay}ms;
          --humidifier-card-humidity-empty-duration: ${humidityEmptyDuration}ms;
          --humidifier-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          background: ${isOn ? onCardBackground : styles.card.background};
          border: ${isOn ? `1px solid ${onCardBorder}` : styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${isOn ? `${styles.card.box_shadow}, ${onCardShadow}` : styles.card.box_shadow};
          min-width: 0;
          overflow: hidden;
          padding: ${styles.card.padding};
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .humidifier-card.is-off {
          cursor: pointer;
        }

        ha-card::before {
          background: ${isOn
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
            radial-gradient(circle at 18% 18%, color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 50%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%);
          content: "";
          inset: 0;
          opacity: ${isOn ? "1" : "0"};
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .humidifier-card--powering-up {
          animation: humidifier-card-power-up var(--humidifier-card-power-duration) cubic-bezier(0.24, 0.82, 0.25, 1) var(--humidifier-card-power-delay, 0ms) both;
        }

        .humidifier-card--powering-down {
          animation: humidifier-card-power-down var(--humidifier-card-power-duration) cubic-bezier(0.32, 0, 0.24, 1) var(--humidifier-card-power-delay, 0ms) both;
        }

        .humidifier-card--powering-up::after {
          animation: humidifier-card-power-glow-in var(--humidifier-card-power-duration) cubic-bezier(0.24, 0.82, 0.25, 1) var(--humidifier-card-power-delay, 0ms) both;
        }

        .humidifier-card--powering-down::after {
          animation: humidifier-card-power-glow-out var(--humidifier-card-power-duration) cubic-bezier(0.32, 0, 0.24, 1) var(--humidifier-card-power-delay, 0ms) both;
        }

        .humidifier-card {
          color: var(--primary-text-color);
          display: grid;
          min-width: 0;
          position: relative;
          z-index: 1;
        }

        .humidifier-card__content {
          display: grid;
          gap: 0;
        }

        .humidifier-card__content--entering {
          animation: humidifier-card-fade-up var(--humidifier-card-content-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .humidifier-card__hero {
          align-items: center;
          display: grid;
          gap: ${styles.card.gap};
          grid-template-columns: ${styles.icon.size} minmax(0, 1fr);
        }

        .humidifier-card--compact .humidifier-card__hero {
          grid-template-columns: ${styles.icon.size} minmax(0, 1fr);
        }

        .humidifier-card--compact {
          container-type: inline-size;
        }

        .humidifier-card--compact .humidifier-card__controls {
          display: flex;
          flex-wrap: nowrap;
          gap: clamp(12px, 5cqi, 20px);
          justify-content: center;
          padding-block: 4px 2px;
          width: 100%;
        }

        .humidifier-card--compact .humidifier-card__control {
          flex: 0 0 auto;
          height: clamp(44px, 16cqi, 56px);
          min-width: clamp(44px, 16cqi, 56px);
          width: clamp(44px, 16cqi, 56px);
        }

        .humidifier-card--compact .humidifier-card__control ha-icon {
          --mdc-icon-size: clamp(18px, 6.5cqi, 24px);
        }

        .humidifier-card--compact .humidifier-card__title {
          font-size: 14px;
        }

        .humidifier-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${isOn
            ? `color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent))`
            : "color-mix(in srgb, var(--primary-text-color) 6%, transparent)"};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${isOn ? styles.icon.on_color : styles.icon.off_color};
          cursor: pointer;
          display: inline-flex;
          height: ${styles.icon.size};
          justify-content: center;
          line-height: 0;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          transform: scale(1);
          transform-origin: center;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, color 180ms ease, transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1);
          justify-self: start;
          width: ${styles.icon.size};
        }

        .humidifier-card__icon ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.46);
          color: ${
            darkenBubbleIconGlyph
              ? `color-mix(in srgb, var(--primary-text-color) 56%, ${accentColor})`
              : (isOn ? styles.icon.on_color : styles.icon.off_color)
          };
          display: inline-flex;
          height: calc(${styles.icon.size} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          backface-visibility: hidden;
          transform: translate3d(-50%, -50%, 0);
          transform-origin: 50% 50%;
          width: calc(${styles.icon.size} * 0.46);
          will-change: transform;
        }

        .humidifier-card__icon--active-motion ha-icon {
          animation: humidifier-card-icon-breathe 1.8s ease-in-out infinite;
          transform: translate3d(-50%, -50%, 0);
        }

        .humidifier-card__icon--active-motion::after {
          animation: humidifier-card-icon-mist 1.65s ease-in-out infinite;
          background: radial-gradient(circle, currentColor 0 34%, transparent 38%);
          content: "";
          height: 5px;
          left: 50%;
          opacity: 0.42;
          position: absolute;
          top: 26%;
          transform: translate3d(-50%, 0, 0);
          width: 5px;
          will-change: transform, opacity;
        }

        .humidifier-card__picture {
          border-radius: inherit;
          height: 100%;
          inset: 0;
          object-fit: cover;
          pointer-events: none;
          position: absolute;
          width: 100%;
        }

        .humidifier-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          display: inline-flex;
          height: 18px;
          justify-content: center;
          position: absolute;
          right: -2px;
          top: -2px;
          width: 18px;
          z-index: 2;
        }

        .humidifier-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          color:#fff;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .humidifier-card__copy {
          display: grid;
          gap: 10px;
          min-width: 0;
        }

        .humidifier-card__headline {
          align-items: start;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .humidifier-card--compact .humidifier-card__copy {
          justify-items: stretch;
          min-width: 0;
          text-align: start;
          width: 100%;
        }

        .humidifier-card--compact .humidifier-card__headline {
          grid-template-columns: minmax(0, 1fr) auto;
          justify-items: stretch;
          width: 100%;
        }

        .humidifier-card__title {
          color: var(--primary-text-color);
          display: -webkit-box;
          font-size: ${styles.title_size};
          font-weight: 700;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          line-height: 1.2;
          min-width: 0;
          overflow: hidden;
          overflow-wrap: anywhere;
        }

        .humidifier-card__chips {
          align-items: center;
          display: flex;
          flex: 0 0 auto;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          min-width: 0;
          max-width: 100%;
        }

        .humidifier-card--compact .humidifier-card__chips {
          justify-content: flex-end;
          justify-self: end;
        }

        .humidifier-card--compact .humidifier-card__title {
          -webkit-line-clamp: 1;
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .humidifier-card__chip {
          align-items: center;
          backdrop-filter: blur(18px);
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          height: ${styles.chip_height};
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding: ${styles.chip_padding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .humidifier-card__chip--state {
          color: var(--primary-text-color);
        }

        .humidifier-card--circular .humidifier-card__content {
          gap: 14px;
        }

        ha-card.humidifier-card--circular {
          border-radius: 30px;
          padding: 16px;
        }

        .humidifier-card--circular .humidifier-card__hero {
          gap: 16px;
          grid-template-columns: 58px minmax(0, 1fr);
        }

        .humidifier-card--circular .humidifier-card__icon {
          height: 58px;
          width: 58px;
        }

        .humidifier-card--circular .humidifier-card__icon > ha-icon {
          --mdc-icon-size: 25.52px;
          height: 25.52px;
          width: 25.52px;
        }

        .humidifier-card--circular .humidifier-card__title {
          font-size: 16px;
        }

        .humidifier-card__circular-layout {
          display: grid;
          gap: 14px;
          justify-items: center;
          min-width: 0;
        }

        .humidifier-card__circular-dial {
          -webkit-backdrop-filter: blur(18px);
          backdrop-filter: blur(18px);
          background:
            radial-gradient(circle at 24% 18%, color-mix(in srgb, ${accentColor} 20%, transparent), transparent 30%),
            linear-gradient(180deg, color-mix(in srgb, ${accentColor} 14%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)) 0%, rgba(255, 255, 255, 0) 42%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 16%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)) 0%, color-mix(in srgb, ${accentColor} 8%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)) 60%, color-mix(in srgb, var(--primary-text-color) 5%, transparent) 100%);
          border: 1px solid color-mix(in srgb, ${accentColor} 10%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 50%;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent), 0 18px 38px rgba(0, 0, 0, 0.16);
          aspect-ratio: 1;
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
          .humidifier-card__circular-dial { width: min(280px, 100%, 94cqw); }
        }

        .humidifier-card__circular-dial svg {
          display: block;
          height: 100%;
          overflow: visible;
          width: 100%;
        }

        .humidifier-card__circular-track,
        .humidifier-card__circular-hit,
        .humidifier-card__circular-progress {
          fill: none;
          stroke-dasharray: 75 25;
          stroke-linecap: round;
          stroke-width: 18;
          transform: rotate(135deg);
          transform-origin: 120px 120px;
        }

        .humidifier-card__circular-track {
          stroke: color-mix(in srgb, color-mix(in srgb, var(--primary-text-color) 32%, var(--divider-color)) 52%, var(--primary-text-color) 48%);
        }

        .humidifier-card__circular-hit {
          pointer-events: stroke;
          stroke: transparent;
          stroke-width: 28;
        }

        .humidifier-card__circular-progress {
          filter: drop-shadow(0 0 0 transparent);
          opacity: 0.94;
          pointer-events: none;
          stroke: ${accentColor};
          stroke-dasharray: var(--circular-progress, 0) 100;
          transition: stroke-dasharray 240ms ease-out;
        }

        .humidifier-card__circular-thumb {
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

        .humidifier-card__circular-dial.is-dragging .humidifier-card__circular-progress,
        .humidifier-card__circular-dial.is-dragging .humidifier-card__circular-thumb {
          transition: none;
        }

        .humidifier-card__circular-dial.is-dragging {
          border-color: color-mix(in srgb, ${accentColor} 18%, color-mix(in srgb, var(--primary-text-color) 10%, transparent));
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 24px 44px rgba(0, 0, 0, 0.2);
          transform: translateZ(0) scale(1.03);
        }

        .humidifier-card__circular-dial.is-dragging .humidifier-card__circular-progress {
          filter: drop-shadow(0 0 10px color-mix(in srgb, ${accentColor} 24%, transparent));
          opacity: 1;
        }

        .humidifier-card__circular-dial.is-dragging .humidifier-card__circular-thumb {
          animation: humidifier-card-circular-dial-thumb-pop 260ms cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 0 0 7px color-mix(in srgb, ${accentColor} 12%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)),
            0 0 22px color-mix(in srgb, ${accentColor} 18%, transparent),
            0 18px 34px rgba(0, 0, 0, 0.24);
          transform: translate(-50%, -50%) scale(1.15);
        }

        .humidifier-card__circular-thumb::before {
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

        .humidifier-card__circular-thumb::after {
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

        .humidifier-card__circular-center {
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

        .humidifier-card__circular-dial.is-dragging .humidifier-card__circular-center {
          transform: scale(1.02);
        }

        .humidifier-card__circular-center strong {
          font-size: clamp(42px, 12vw, 50px);
          font-weight: 500;
          letter-spacing: -0.055em;
          line-height: 1;
        }

        .humidifier-card__circular-divider {
          background: color-mix(in srgb, var(--primary-text-color) 18%, transparent);
          border-radius: 999px;
          height: 1px;
          width: clamp(84px, 72%, 148px);
        }

        .humidifier-card__circular-center > span:not(.humidifier-card__circular-divider) {
          color: var(--secondary-text-color);
          font-size: 16px;
          font-weight: 500;
        }

        .humidifier-card__circular-actions,
        .humidifier-card__circular-steps {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .humidifier-card__circular-actions {
          pointer-events: auto;
        }

        .humidifier-card__circular-actions .humidifier-card__control {
          height: 34px;
          min-width: 34px;
          width: 34px;
        }

        .humidifier-card__circular-step,
        .humidifier-card__circular-power {
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
          font-size: 24px;
          height: 50px;
          justify-content: center;
          padding: 0;
          width: 50px;
        }

        .humidifier-card__circular-power.is-active {
          background: color-mix(in srgb, ${accentColor} 22%, ${styles.control.accent_background});
          border-color: color-mix(in srgb, ${accentColor} 50%, transparent);
        }

        .humidifier-card__circular-power ha-icon {
          --mdc-icon-size: 22px;
        }

        .humidifier-card__circular-step:disabled {
          cursor: default;
          opacity: 0.4;
        }

        .humidifier-card__controls-shell {
          backface-visibility: hidden;
          display: grid;
          grid-template-rows: 1fr;
          margin-top: var(--humidifier-card-controls-gap);
          max-height: 320px;
          overflow: visible;
          will-change: grid-template-rows, max-height, margin-top, opacity;
        }

        .humidifier-card__controls-inner {
          backface-visibility: hidden;
          display: grid;
          gap: 10px;
          min-height: 0;
          overflow: visible;
          will-change: opacity, transform;
        }

        .humidifier-card__controls-shell--entering {
          animation: humidifier-card-controls-expand var(--humidifier-card-controls-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--humidifier-card-controls-delay, 0ms) both;
          overflow: hidden;
          transform-origin: top;
        }

        .humidifier-card__controls-shell--entering .humidifier-card__controls-inner {
          animation: humidifier-card-controls-content-in var(--humidifier-card-controls-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--humidifier-card-controls-delay, 0ms) both;
          overflow: hidden;
          transform-origin: top;
        }

        .humidifier-card__controls-shell--leaving {
          animation: humidifier-card-controls-collapse var(--humidifier-card-controls-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--humidifier-card-controls-delay, 0ms) both;
          overflow: hidden;
          pointer-events: none;
          transform-origin: top;
        }

        .humidifier-card__controls-shell--leaving .humidifier-card__controls-inner {
          animation: humidifier-card-controls-content-out var(--humidifier-card-controls-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--humidifier-card-controls-delay, 0ms) both;
          overflow: hidden;
          transform-origin: top;
        }

        .humidifier-card__slider-row {
          align-items: center;
          display: grid;
          gap: 14px;
          grid-template-columns: minmax(0, 1fr) auto;
          overflow: visible;
          padding-inline: 4px;
        }

        .humidifier-card__slider-row--solo {
          grid-template-columns: minmax(0, 1fr);
        }

        .humidifier-card__slider-wrap {
          --humidifier-card-slider-input-height: max(44px, var(--humidifier-card-slider-thumb-size));
          --humidifier-card-slider-thumb-size: calc(${styles.slider_thumb_size} + 12px);
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          display: flex;
          min-height: ${styles.slider_wrap_height};
          padding: 0 14px;
        }

        .humidifier-card__slider-shell {
          flex: 1;
          min-width: 0;
          position: relative;
        }

        .humidifier-card__slider-track {
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

        .humidifier-card__slider-track::before {
          background: ${styles.slider_color};
          border-radius: inherit;
          content: "";
          inset: 0;
          position: absolute;
          transform: scaleX(calc(var(--humidity, ${clamp(humidityProgress, 0, 100)}) / 100));
          transform-origin: left center;
        }

        .humidifier-card__slider-shell--humidity-fill .humidifier-card__slider-track::before {
          transform: scaleX(0.01);
          animation: humidifier-card-humidity-fill var(--humidifier-card-humidity-fill-duration) cubic-bezier(0.2, 0.86, 0.18, 1) var(--humidifier-card-humidity-fill-delay, 0ms) both;
        }

        ${
          shouldAnimateHumidityEmpty
            ? `
        .humidifier-card__controls-shell--leaving .humidifier-card__slider-track::before {
          animation: humidifier-card-humidity-empty var(--humidifier-card-humidity-empty-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--humidifier-card-humidity-empty-delay, 0ms) both;
        }
        `
            : ""
        }

        .humidifier-card__slider-actions {
          display: inline-flex;
          flex: 0 0 auto;
          gap: 12px;
          justify-content: flex-end;
          padding-block: 10px;
        }

        .humidifier-card__slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          box-sizing: border-box;
          cursor: pointer;
          flex: 1;
          height: var(--humidifier-card-slider-input-height);
          margin: 0;
          padding: 0;
          position: relative;
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
          width: 100%;
          z-index: 1;
        }

        .humidifier-card__slider::-webkit-slider-runnable-track {
          background: transparent;
          border-radius: 999px;
          height: ${styles.slider_height};
        }

        .humidifier-card__slider::-moz-range-progress {
          background: transparent;
          border: 0;
          height: ${styles.slider_height};
        }

        .humidifier-card__slider::-moz-range-track {
          background: transparent;
          border-radius: 999px;
          border: 0;
          height: ${styles.slider_height};
        }

        .humidifier-card__slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          border-radius: 50%;
          box-shadow: none;
          box-sizing: border-box;
          height: ${styles.slider_thumb_size};
          margin-top: calc((${styles.slider_height} - ${styles.slider_thumb_size}) / 2);
          width: ${styles.slider_thumb_size};
        }

        .humidifier-card__slider::-moz-range-thumb {
          background: transparent;
          border: 0;
          border-radius: 50%;
          box-shadow: none;
          box-sizing: border-box;
          height: ${styles.slider_thumb_size};
          width: ${styles.slider_thumb_size};
        }

        .humidifier-card__controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          padding-inline: 4px;
        }

        .humidifier-card__control {
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
          flex: 0 0 auto;
          height: ${styles.control.size};
          justify-content: center;
          line-height: 0;
          min-width: ${styles.control.size};
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          transform: scale(1);
          transform-origin: center;
          transition: transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1);
          width: ${styles.control.size};
        }

        .humidifier-card__control--active {
          background: color-mix(in srgb, ${accentColor} 18%, ${styles.control.accent_background});
          border-color: color-mix(in srgb, ${accentColor} 48%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: ${styles.control.accent_color};
        }

        .humidifier-card__control ha-icon {
          --mdc-icon-size: calc(${styles.control.size} * 0.46);
          display: inline-flex;
          height: calc(${styles.control.size} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${styles.control.size} * 0.46);
        }

        .humidifier-card__panel {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          min-width: 0;
        }

        .humidifier-card__panel-shell {
          backface-visibility: hidden;
          overflow: hidden;
          will-change: max-height, opacity;
        }

        .humidifier-card__panel-inner {
          backface-visibility: hidden;
          display: grid;
          padding: 4px;
          will-change: opacity, transform;
        }

        .humidifier-card__panel-shell--entering {
          animation: humidifier-card-panel-expand var(--humidifier-card-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--humidifier-card-panel-delay, 0ms) both;
          transform-origin: top;
        }

        .humidifier-card__panel-shell--entering .humidifier-card__panel-inner {
          animation: humidifier-card-panel-content-in var(--humidifier-card-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--humidifier-card-panel-delay, 0ms) both;
          transform-origin: top;
        }

        .humidifier-card__panel-shell--leaving {
          animation: humidifier-card-panel-collapse var(--humidifier-card-panel-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--humidifier-card-panel-delay, 0ms) both;
          pointer-events: none;
          transform-origin: top;
        }

        .humidifier-card__panel-shell--leaving .humidifier-card__panel-inner {
          animation: humidifier-card-panel-content-out var(--humidifier-card-panel-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--humidifier-card-panel-delay, 0ms) both;
          transform-origin: top;
        }

        .humidifier-card__option {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          height: max(32px, ${styles.chip_height});
          justify-content: center;
          margin: 0;
          max-width: 100%;
          min-width: 0;
          padding: 0 14px;
          transform: scale(1);
          transform-origin: center;
          transition: transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1);
          white-space: nowrap;
        }

        .humidifier-card__option.is-active {
          background: ${styles.control.accent_background};
          border-color: color-mix(in srgb, ${accentColor} 48%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: ${styles.control.accent_color};
        }

        :is(.humidifier-card__icon, .humidifier-card__control, .humidifier-card__option):active:not(:disabled),
        :is(.humidifier-card__icon, .humidifier-card__control, .humidifier-card__option).is-pressing:not(:disabled) {
          animation: humidifier-card-button-bounce var(--humidifier-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        @keyframes humidifier-card-power-up {
          0% {
            background: ${styles.card.background};
            box-shadow: ${styles.card.box_shadow};
            transform: scale(0.994);
          }
          55% {
            background: linear-gradient(135deg, color-mix(in srgb, ${accentColor} 26%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 14%, ${styles.card.background}) 54%, ${styles.card.background} 100%);
            box-shadow: ${styles.card.box_shadow}, 0 12px 26px color-mix(in srgb, ${accentColor} 12%, rgba(0, 0, 0, 0.16));
            transform: scale(1);
          }
          100% {
            background: ${onCardBackground};
            box-shadow: ${styles.card.box_shadow}, ${onCardShadow};
            transform: scale(1);
          }
        }

        @keyframes humidifier-card-power-down {
          0% {
            background: ${onCardBackground};
            box-shadow: ${styles.card.box_shadow}, ${onCardShadow};
            transform: scale(1);
          }
          100% {
            background: ${styles.card.background};
            box-shadow: ${styles.card.box_shadow};
            transform: scale(1);
          }
        }

        @keyframes humidifier-card-power-glow-in {
          0% {
            opacity: 0;
          }
          45% {
            opacity: 1;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes humidifier-card-power-glow-out {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes humidifier-card-controls-expand {
          0% {
            grid-template-rows: 0fr;
            max-height: 0;
            margin-top: 0;
            opacity: 0;
          }
          100% {
            grid-template-rows: 1fr;
            max-height: 320px;
            margin-top: var(--humidifier-card-controls-gap);
            opacity: 1;
          }
        }

        @keyframes humidifier-card-humidity-fill {
          0% {
            transform: scaleX(0.01);
          }
          100% {
            transform: scaleX(calc(var(--humidity-target, var(--humidity, ${clamp(humidityProgress, 0, 100)})) / 100));
          }
        }

        @keyframes humidifier-card-humidity-empty {
          0% {
            transform: scaleX(calc(var(--humidity-target, var(--humidity, 0)) / 100));
          }
          100% {
            transform: scaleX(0.01);
          }
        }

        @keyframes humidifier-card-controls-collapse {
          0% {
            grid-template-rows: 1fr;
            max-height: 320px;
            margin-top: var(--humidifier-card-controls-gap);
            opacity: 1;
          }
          100% {
            grid-template-rows: 0fr;
            max-height: 0;
            margin-top: 0;
            opacity: 0;
          }
        }

        @keyframes humidifier-card-controls-content-in {
          0% {
            opacity: 0;
            transform: translateY(-4px) scaleY(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes humidifier-card-controls-content-out {
          0% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.94);
          }
        }

        @keyframes humidifier-card-panel-expand {
          0% {
            max-height: 0;
            opacity: 0;
          }
          100% {
            max-height: 180px;
            opacity: 1;
          }
        }

        @keyframes humidifier-card-panel-collapse {
          0% {
            max-height: 180px;
            opacity: 1;
          }
          100% {
            max-height: 0;
            opacity: 0;
          }
        }

        @keyframes humidifier-card-panel-content-in {
          0% {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes humidifier-card-panel-content-out {
          0% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-6px) scaleY(0.96);
          }
        }

        @keyframes humidifier-card-button-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.08);
          }
          72% {
            transform: scale(1.03);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes humidifier-card-icon-breathe {
          0%, 100% {
            transform: translate3d(-50%, -50%, 0) scale(1);
          }
          50% {
            transform: translate3d(-50%, -54%, 0) scale(1.08);
          }
        }

        @keyframes humidifier-card-icon-mist {
          0% {
            opacity: 0;
            transform: translate(-50%, 8px) scale(0.7);
          }
          42% {
            opacity: 0.5;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -14px) scale(1.35);
          }
        }

        @keyframes humidifier-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes humidifier-card-circular-dial-thumb-pop {
          0% {
            transform: translate(-50%, -50%) scale(1);
          }
          48% {
            transform: translate(-50%, -50%) scale(1.24);
          }
          72% {
            transform: translate(-50%, -50%) scale(1.09);
          }
          100% {
            transform: translate(-50%, -50%) scale(1.15);
          }
        }

        ${animations.enabled ? "" : `
        .humidifier-card,
        .humidifier-card::after,
        .humidifier-card__controls-shell,
        .humidifier-card__controls-inner,
        .humidifier-card__panel-shell,
        .humidifier-card__panel-inner,
        .humidifier-card__icon,
        .humidifier-card__option,
        .humidifier-card__control,
        .humidifier-card * {
          animation: none !important;
          transition: none !important;
        }
        `}

        .humidifier-card--compact:not(.humidifier-card--with-copy) .humidifier-card__hero {
          justify-items: start;
        }

        @media (prefers-reduced-motion: reduce) {
          .humidifier-card,
          .humidifier-card::after,
          .humidifier-card__controls-shell,
          .humidifier-card__controls-inner,
          .humidifier-card__panel-shell,
          .humidifier-card__panel-inner,
          .humidifier-card__icon,
          .humidifier-card__control,
          .humidifier-card__option {
            animation: none !important;
            transition: none !important;
          }

          .humidifier-card__icon--active-motion ha-icon,
          .humidifier-card__icon--active-motion::after {
            animation: none !important;
          }
        }

        @media (max-width: 620px) {
          .humidifier-card:not(.humidifier-card--compact) .humidifier-card__headline {
            grid-template-columns: minmax(0, 1fr);
          }

          .humidifier-card:not(.humidifier-card--compact) .humidifier-card__chips {
            justify-content: flex-start;
          }
        }

        @media (max-width: 420px) {
          .humidifier-card__hero {
            grid-template-columns: 50px minmax(0, 1fr);
          }

          .humidifier-card--compact .humidifier-card__hero {
            grid-template-columns: 50px minmax(0, 1fr);
            justify-items: start;
          }

          .humidifier-card__icon {
            height: 50px;
            width: 50px;
          }

          .humidifier-card__slider-row {
            gap: 10px;
            grid-template-columns: minmax(0, 1fr) auto;
          }

          .humidifier-card__slider-actions {
            gap: 10px;
            justify-content: flex-end;
          }
        }
      </style>
      <ha-card
        data-humidifier-action="body"
        class="humidifier-card ${isOn ? "is-on" : "is-off"} ${isCircularLayout ? "humidifier-card--circular" : ""} ${!isCircularLayout && isCompactLayout ? "humidifier-card--compact" : ""} ${showCopyBlock ? "humidifier-card--with-copy" : ""} ${powerAnimationState ? `humidifier-card--${powerAnimationState}` : ""}"
        style="--accent-color:${escapeHtml(accentColor)};"
      >
        <div class="humidifier-card__content ${shouldAnimateEntrance ? "humidifier-card__content--entering" : ""}">
          <div class="humidifier-card__hero">
            <button
              type="button"
              class="humidifier-card__icon ${animations.enabled && animations.iconAnimation && isOn ? "humidifier-card__icon--active-motion" : ""}"
              data-humidifier-action="icon"
              aria-label="${escapeHtml(window.NodaliaI18n?.translateCommonAria?.(this._hass, config.language ?? "auto", "togglePower", "Turn on or off") || "Turn on or off")}"
            >
              ${entityPicture
                ? `<img class="humidifier-card__picture" src="${escapeHtml(entityPicture)}" alt="" loading="lazy" />`
                : `<ha-icon icon="${escapeHtml(icon)}"></ha-icon>`}
              ${showUnavailableBadge ? `<span class="humidifier-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${showCopyBlock
              ? `
                <div class="humidifier-card__copy">
                  <div class="humidifier-card__headline">
                    ${showTitle ? `<div class="humidifier-card__title">${escapeHtml(title)}</div>` : ""}
                    ${chips.length ? `<div class="humidifier-card__chips">${chips.join("")}</div>` : ""}
                  </div>
                </div>
              `
              : ""}
          </div>
          ${isCircularLayout ? circularControlsMarkup : controlsShellMarkup}
        </div>
      </ha-card>
    `;

    this._lastRenderedIsOn = isOn;
    this._lastRenderedPanelKey = currentPanelKey;

    if (shouldCleanupAfterAnimation) {
      this._scheduleAnimationCleanup(cleanupDelay);
    } else if (this._animationCleanupTimer) {
      window.clearTimeout(this._animationCleanupTimer);
      this._animationCleanupTimer = 0;
    }

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(contentEntranceDuration + 120);
    }
  }
}
  _lazyNodaliaHumidifierCard = NodaliaHumidifierCard;
  return NodaliaHumidifierCard;
}
