// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  ALLOWED_DOUBLE_TAP_ACTIONS,
  CARD_TAG,
  COMPACT_LAYOUT_THRESHOLD,
  EDITOR_TAG,
  FAN_MEMORY_STORAGE_KEY,
  HAPTIC_PATTERNS,
  OPTIMISTIC_TOGGLE_TIMEOUT,
  OPTIMISTIC_VISUAL_SETTLE_MS,
} from "./fan-constants";
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
} from "./fan-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, getSafeStyles, normalizeConfig } from "./fan-config";
import {
  applyStubEntity,
  getCircularLayoutDialModel,
  getCircularLayoutDialValueFromPoint,
  getRangeValueFromGeometry,
  getSliderDragGeometry,
  isUnavailableState,
  parseSizeToPixels,
  translatePresetLabel,
} from "./fan-helpers";

let _lazyNodaliaFanCard;
export function loadNodaliaFanCard() {
  if (_lazyNodaliaFanCard) {
    return _lazyNodaliaFanCard;
  }
class NodaliaFanCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["fan"], entities, entitiesFallback);
  }

  static getEntitySuggestion(hass, entityId) {
    return [
      window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, {
        domains: ["fan"],
        label: "Fan — Standard",
        buildConfig: (_hass, selectedEntityId) => ({ entity: selectedEntityId, compact_layout_mode: "auto" }),
      }),
      window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, {
        domains: ["fan"],
        label: "Fan — Compact",
        buildConfig: (_hass, selectedEntityId) => ({ entity: selectedEntityId, compact_layout_mode: "always" }),
      }),
    ].filter(Boolean);
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
    this._draftPercentage = new Map();
    this._presetPanelOpen = false;
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
    this._lastRenderedPresetPanelVisible = false;
    this._lastControlsMarkup = "";
    this._lastPresetPanelMarkup = "";
    this._animationCleanupTimer = 0;
    this._powerTransition = null;
    this._controlsTransition = null;
    this._presetPanelTransition = null;
    this._suppressNextFanTap = false;
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
              if (path.some(node => node instanceof HTMLInputElement && node.dataset?.fanControl)) {
                return null;
              }
              if (window.NodaliaUtils?.isNodaliaSliderChromeHit?.(event)) {
                return null;
              }
              const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.fanAction);
              const zone = actionButton?.dataset?.fanAction;
              return zone === "body" || zone === "icon" ? zone : null;
            },
            shouldBeginHold: zone => this._resolveFanHoldEffect(zone) !== "none",
            onHold: zone => {
              const effect = this._resolveFanHoldEffect(zone);
              if (effect === "none") {
                return;
              }
              this._triggerHaptic();
              this._executeFanHoldEffect(zone, effect);
            },
            markHoldConsumedClick: () => {
              this._suppressNextFanTap = true;
              window.NodaliaUtils?.cancelCardZoneTap?.(this);
            },
          })
        : () => {};
    }

  connectedCallback() {
    this._detachHostHold?.reconnect?.();
    this._resizeObserver?.observe(this);
    this._scheduleOptimisticToggleTimeout();
    this._scheduleOptimisticVisualSettleTimeout();
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
    this._powerTransition = null;
    this._controlsTransition = null;
    this._presetPanelTransition = null;
    this._pendingDragUpdate = null;
    this._clearOptimisticToggleTimer();
    this._clearOptimisticVisualSettleTimer();
    window.NodaliaUtils?.clearDeferTimers?.(this);
  }

  setConfig(config) {
    const previousEntity = this._config?.entity || "";
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    if (previousEntity && previousEntity !== this._config.entity) {
      this._draftPercentage.delete(previousEntity);
      this._lastKnownOnState.delete(previousEntity);
      this._clearOptimisticVisualSettle();
      this._clearOptimisticToggleState();
    }
    this._isCompactLayout = this._shouldUseCompactLayout(
      Math.round(this._cardWidth || this.clientWidth || 0),
    );
    this._lastRenderSignature = "";
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const entityId = this._config?.entity || "";
    if (entityId && this._draftPercentage.has(entityId) && !this._activeSliderDrag) {
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
    const actualState = entityId ? hass?.states?.[entityId] || null : null;
    const state = hass === this._hass ? this._buildOptimisticToggleState(actualState) : actualState;
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
      Number(attrs.percentage ?? -1),
      Number(attrs.percentage_step ?? -1),
      String(attrs.preset_mode || ""),
      Array.isArray(attrs.preset_modes) ? attrs.preset_modes.join("|") : "",
      String(attrs.oscillating ?? ""),
      String(attrs.direction || ""),
      String(this._config?.layout || "compact"),
      Boolean(this._isCompactLayout),
      Boolean(this._presetPanelOpen),
      `${String(this._config?.tap_action || "")}|${String(this._config?.icon_tap_action ?? "")}|${String(this._config?.tap_service || "")}|${String(this._config?.icon_tap_service || "")}`,
      `${String(this._config?.hold_action || "")}|${String(this._config?.icon_hold_action ?? "")}|${String(this._config?.hold_service || "")}|${String(this._config?.icon_hold_service || "")}`,
      `${String(this._config?.double_tap_action || "")}|${String(this._config?.icon_double_tap_action ?? "")}|${String(this._config?.double_tap_service || "")}|${String(this._config?.icon_double_tap_service || "")}`,
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "fan:", values }]);
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

  _triggerHaptic(style = this._config?.haptics?.style) {
    if (!this._config?.haptics?.enabled) {
      return;
    }

    this.dispatchEvent(new CustomEvent("haptic", {
      bubbles: true,
      composed: true,
      detail: style || "medium",
    }));

    if (!this._config?.haptics?.fallback_vibrate || !navigator?.vibrate) {
      return;
    }

    const vibration = HAPTIC_PATTERNS[style || "medium"];
    if (vibration) {
      navigator.vibrate(vibration);
    }
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

  _getStoredFanMemory() {
    if (typeof window === "undefined" || !window.localStorage) {
      return {};
    }
    try {
      return JSON.parse(window.localStorage.getItem(FAN_MEMORY_STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  _storeFanMemory(entityId, snapshot) {
    if (!entityId || !snapshot || typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      const memory = this._getStoredFanMemory();
      memory[entityId] = {
        attributes: { ...(snapshot.attributes || {}) },
        last_changed: snapshot.last_changed || new Date().toISOString(),
      };
      window.localStorage.setItem(FAN_MEMORY_STORAGE_KEY, JSON.stringify(memory));
    } catch {
      // Ignore storage quota or privacy mode failures.
    }
  }

  _getStoredFanSnapshot(entityId) {
    const stored = this._getStoredFanMemory()[entityId];
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
      this._storeFanMemory(entityId, snapshot);
      return;
    }

    const rememberedPercentage = Number(actualState.attributes?.percentage);
    if (Number.isFinite(rememberedPercentage) && rememberedPercentage > 0) {
      this._lastKnownOnState.set(entityId, {
        ...snapshot,
        state: "on",
      });
      this._storeFanMemory(entityId, snapshot);
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

    const stored = this._getStoredFanSnapshot(entityId);
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

  _hasPublishedPercentage(actualState) {
    const percentage = Number(actualState?.attributes?.percentage);
    return Number.isFinite(percentage) && percentage > 0;
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

    if (this._hasPublishedPercentage(actualState)) {
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

    if (entityId && this._draftPercentage.has(entityId)) {
      attrs.percentage = clamp(Math.round(Number(this._draftPercentage.get(entityId))), 0, 100);
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
    if (!actualState || !this._isFanToggleableState(actualState) || actualKey === expectedKey) {
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
    if (!entityId || !this._isFanToggleableState(actualState)) {
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

    if (entityId && this._draftPercentage.has(entityId)) {
      attrs.percentage = clamp(Math.round(Number(this._draftPercentage.get(entityId))), 0, 100);
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

  _isOn(state = this._getState()) {
    const stateValue = String(state?.state || "").toLowerCase();
    return Boolean(state) && !["off", "unavailable", "unknown"].includes(stateValue);
  }

  _getFanName(state) {
    if (this._config?.name) {
      return this._config.name;
    }

    if (state?.attributes?.friendly_name) {
      return state.attributes.friendly_name;
    }

    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    return this._config?.entity || window.NodaliaI18n?.strings?.(lang)?.fan?.fallbackName || "Fan";
  }

  _getFanIcon(state) {
    if (this._config?.icon) {
      return this._config.icon;
    }

    if (state?.attributes?.icon) {
      return state.attributes.icon;
    }

    return "mdi:fan";
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
    const stateValue = normalizeTextKey(state?.state);
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const fanStrings = window.NodaliaI18n?.strings?.(lang)?.fan;
    if (fanStrings?.[stateValue]) {
      return fanStrings[stateValue];
    }

    switch (stateValue) {
      case "off":
        return fanStrings?.off || "Off";
      case "on":
        return fanStrings?.on || "On";
      case "unavailable":
        return fanStrings?.unavailable || "Unavailable";
      case "unknown":
        return fanStrings?.unknown || "Unknown";
      default:
        return state?.state ? String(state.state) : (fanStrings?.noState || "No state");
    }
  }

  _supportsPercentage(state) {
    return Number.isFinite(Number(state?.attributes?.percentage)) || Number.isFinite(Number(state?.attributes?.percentage_step));
  }

  _getPercentage(state) {
    const draft = this._draftPercentage.get(this._config?.entity);
    if (Number.isFinite(draft)) {
      return clamp(Number(draft), 0, 100);
    }

    const rawPercentage = Number(state?.attributes?.percentage);
    if (Number.isFinite(rawPercentage)) {
      return clamp(Math.round(rawPercentage), 0, 100);
    }

    return this._isOn(state) ? 100 : 0;
  }

  _syncDraftWithState() {
    const state = this._getActualState();
    const entityId = this._config?.entity;
    if (!entityId || !state || !this._draftPercentage.has(entityId)) {
      return;
    }

    const actualPercentage = Number(state.attributes?.percentage);
    const draftPercentage = Number(this._draftPercentage.get(entityId));
    const configuredStep = Number(state.attributes?.percentage_step);
    const step = Number.isFinite(configuredStep) && configuredStep > 0 ? configuredStep : 1;
    const tolerance = Math.max(1, step / 2);

    if (
      Number.isFinite(actualPercentage)
      && Number.isFinite(draftPercentage)
      && Math.abs(actualPercentage - draftPercentage) <= tolerance
    ) {
      this._draftPercentage.delete(entityId);
    }
  }

  _supportsOscillation(state) {
    return typeof state?.attributes?.oscillating === "boolean";
  }

  _isOscillating(state) {
    return state?.attributes?.oscillating === true;
  }

  _getPresetModes(state) {
    return Array.isArray(state?.attributes?.preset_modes)
      ? state.attributes.preset_modes
        .map(item => String(item || "").trim())
        .filter(Boolean)
        .filter(mode => !this._isPresetModeHidden(mode))
      : [];
  }

  _isPresetModeHidden(value) {
    const hiddenModes = Array.isArray(this._config?.hidden_preset_modes) ? this._config.hidden_preset_modes : [];
    const expectedKey = normalizeTextKey(value);
    return hiddenModes.some(item => normalizeTextKey(item) === expectedKey);
  }

  _getCurrentPresetMode(state) {
    return state?.attributes?.preset_mode ? String(state.attributes.preset_mode) : "";
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
      presetDuration: clamp(Number(configuredAnimations.preset_duration) || DEFAULT_CONFIG.animations.preset_duration, 120, 2400),
      buttonBounceDuration: clamp(Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration, 120, 1200),
    };
  }

  _isTransitionAnimationActive(now = Date.now()) {
    return Boolean(
      (this._powerTransition?.endsAt > now)
      || (this._controlsTransition?.endsAt > now)
      || (this._presetPanelTransition?.endsAt > now),
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
        this._powerTransition || this._controlsTransition || this._presetPanelTransition,
      );
      this._powerTransition = null;
      this._controlsTransition = null;
      this._presetPanelTransition = null;
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

  _setFanState(service, data = {}) {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    this._hass.callService("fan", service, {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _toggleFan(state) {
    const actualState = this._getActualState();
    const effectiveState = state || this._getState();
    const turnOff = this._isOn(effectiveState);
    this._startOptimisticToggle(turnOff ? "off" : "on", actualState);

    if (turnOff) {
      this._setFanState("turn_off");
      this._render();
      return;
    }

    this._setFanState("turn_on");
    this._render();
  }

  _isFanToggleableState(state) {
    const key = String(state?.state || "").trim().toLowerCase();
    return key === "on" || key === "off";
  }

  _resolveFanTapEffect(zone) {
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
      return this._isFanToggleableState(state) ? "toggle" : "more-info";
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
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Fan Card", serviceValue);
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

  _executeFanTapEffect(zone, effect) {
    const isIcon = zone === "icon";
    switch (effect) {
      case "toggle":
        this._toggleFan(this._getState());
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

  _resolveFanHoldEffect(zone) {
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
      return this._isFanToggleableState(state) ? "toggle" : "more-info";
    }
    return effect;
  }

  _executeFanHoldEffect(zone, effect) {
    const isIcon = zone === "icon";
    switch (effect) {
      case "toggle":
        this._toggleFan(this._getState());
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

  _resolveFanDoubleTapEffect(zone) {
    const bodyRaw = this._config?.double_tap_action ?? "none";
    const iconRaw = this._config?.icon_double_tap_action;
    const raw =
      zone === "icon"
        ? (iconRaw === undefined || iconRaw === null || String(iconRaw).trim() === "" ? bodyRaw : iconRaw)
        : bodyRaw;
    let effect = String(raw || "none").trim().toLowerCase();
    if (!ALLOWED_DOUBLE_TAP_ACTIONS.has(effect)) {
      effect = "none";
    }
    if (effect === "auto") {
      const state = this._getState();
      return this._isFanToggleableState(state) ? "toggle" : "more-info";
    }
    return effect;
  }

  _executeFanDoubleTapEffect(zone, effect) {
    const isIcon = zone === "icon";
    switch (effect) {
      case "toggle":
        this._toggleFan(this._getState());
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service": {
        let service = isIcon ? this._config?.icon_double_tap_service : this._config?.double_tap_service;
        let data = isIcon ? this._config?.icon_double_tap_service_data : this._config?.double_tap_service_data;
        let target = isIcon ? this._config?.icon_double_tap_service_target : this._config?.double_tap_service_target;
        if (isIcon && !String(service || "").trim()) {
          service = this._config?.double_tap_service;
          data = this._config?.double_tap_service_data;
          target = this._config?.double_tap_service_target;
        }
        this._callConfiguredService(service, this._config?.entity, data, target);
        break;
      }
      case "navigate": {
        let path = isIcon ? this._config?.icon_double_tap_navigation_path : this._config?.double_tap_navigation_path;
        if (isIcon && !String(path || "").trim()) {
          path = this._config?.double_tap_navigation_path;
        }
        this._openConfiguredNavigation(path);
        break;
      }
      case "url": {
        let url = isIcon ? this._config?.icon_double_tap_url : this._config?.double_tap_url;
        let tab = isIcon ? this._config?.icon_double_tap_new_tab === true : this._config?.double_tap_new_tab === true;
        if (isIcon && !String(url || "").trim()) {
          url = this._config?.double_tap_url;
          tab = this._config?.double_tap_new_tab === true;
        }
        this._openConfiguredUrl(url, tab);
        break;
      }
      case "none":
      default:
        break;
    }
  }

  _commitPercentage(percent) {
    const nextValue = clamp(Math.round(Number(percent)), 0, 100);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    this._setFanState("set_percentage", {
      percentage: nextValue,
    });
  }

  _changePercentageBy(direction, state = this._getState()) {
    if (!state || !this._supportsPercentage(state)) {
      return;
    }
    const configuredStep = Number(state.attributes?.percentage_step);
    const step = Number.isFinite(configuredStep) && configuredStep > 0 ? configuredStep : 5;
    const current = this._getPercentage(state);
    const nextValue = clamp(current + (Number(direction) * step), 0, 100);
    this._draftPercentage.set(this._config.entity, nextValue);
    this._updatePercentagePreview(nextValue);
    this._commitPercentage(nextValue);
  }

  _toggleOscillation(state) {
    if (!this._supportsOscillation(state)) {
      return;
    }

    this._setFanState("oscillate", {
      oscillating: !this._isOscillating(state),
    });
  }

  _commitPresetMode(mode) {
    if (!mode) {
      return;
    }

    this._setFanState("set_preset_mode", {
      preset_mode: mode,
    });
  }

  _getPresetPanelMarkup(state = this._getState()) {
    const presetModes = this._config?.show_preset_modes !== false ? this._getPresetModes(state) : [];
    const currentPresetMode = this._getCurrentPresetMode(state);

    if (!presetModes.length) {
      return "";
    }

    return `
      <div class="fan-card__preset-panel">
        ${presetModes
          .map(mode => `
            <button
              type="button"
              class="fan-card__preset ${normalizeTextKey(mode) === normalizeTextKey(currentPresetMode) ? "is-active" : ""}"
              data-fan-action="preset"
              data-mode="${escapeHtml(mode)}"
            >
              ${escapeHtml(translatePresetLabel(mode))}
            </button>
          `)
          .join("")}
      </div>
    `;
  }

  _setPresetToggleButtonsState(isOpen) {
    this.shadowRoot
      ?.querySelectorAll('[data-fan-action="toggle-preset-panel"]')
      .forEach(button => {
        if (button instanceof HTMLElement) {
          button.classList.toggle("fan-card__control--active", isOpen === true);
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

  _setPresetPanelVisibility(isOpen, state = this._getState()) {
    this._presetPanelOpen = isOpen === true;
    this._lastRenderedPresetPanelVisible = this._presetPanelOpen;
    this._setPresetToggleButtonsState(this._presetPanelOpen);

    const controlsInner = this.shadowRoot?.querySelector(".fan-card__controls-inner");
    const animations = this._getAnimationSettings();
    const panelMarkup = this._presetPanelOpen ? this._getPresetPanelMarkup(state) : "";

    if (panelMarkup) {
      this._lastPresetPanelMarkup = panelMarkup;
    }

    if (!controlsInner || !(controlsInner instanceof HTMLElement) || !state || !this._isOn(state)) {
      this._render();
      return;
    }

    const existingPanel = controlsInner.querySelector(".fan-card__preset-panel-shell");
    if (!animations.enabled) {
      if (existingPanel instanceof HTMLElement) {
        existingPanel.remove();
      }

      if (panelMarkup) {
        const panelNode = this._createMarkupNode(`
          <div class="fan-card__preset-panel-shell" data-panel-key="preset">
            <div class="fan-card__preset-panel-inner">
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

    const removePanel = panel => {
      if (!(panel instanceof HTMLElement)) {
        return;
      }

      panel.classList.remove("fan-card__preset-panel-shell--entering");
      panel.classList.add("fan-card__preset-panel-shell--leaving");

      const finalizeRemoval = () => {
        if (panel.isConnected) {
          panel.remove();
        }
      };

      panel.addEventListener("animationend", finalizeRemoval, { once: true });
      const schedule = window.NodaliaUtils?.scheduleDeferTimer;
      if (typeof schedule === "function") {
        schedule(this, finalizeRemoval, animations.presetDuration + 80);
      } else {
        window.setTimeout(finalizeRemoval, animations.presetDuration + 80);
      }
    };
    const appendPanel = () => {
      if (!panelMarkup) {
        return;
      }

      const panelNode = this._createMarkupNode(`
        <div class="fan-card__preset-panel-shell fan-card__preset-panel-shell--entering" data-panel-key="preset">
          <div class="fan-card__preset-panel-inner">
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
          panelNode.classList.remove("fan-card__preset-panel-shell--entering");
        }
      };
      if (typeof schedule === "function") {
        schedule(this, finalizeEnter, animations.presetDuration + 80);
      } else {
        window.setTimeout(finalizeEnter, animations.presetDuration + 80);
      }
    };

    if (!this._presetPanelOpen) {
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

    if (existingPanel instanceof HTMLElement) {
      existingPanel.remove();
    }

    appendPanel();
  }

  _updatePercentagePreview(value) {
    const nextValue = clamp(Number(value), 0, 100);
    const slider = this.shadowRoot?.querySelector('.fan-card__slider[data-fan-control="percentage"]');

    if (slider instanceof HTMLInputElement) {
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

    const chip = this.shadowRoot?.querySelector('[data-fan-chip="percentage"]');
    if (chip instanceof HTMLElement) {
      chip.textContent = `${Math.round(nextValue)}%`;
    }
  }

  _hapticOnSliderStep(steppedValue, { commit = false } = {}) {
    if (this._config?.haptics?.scrolls?.percentage === false) {
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
    const nextValue = clamp(Number(value), 0, 100);
    const stepped = Math.round(nextValue);

    this._draftPercentage.set(this._config.entity, nextValue);
    this._updatePercentagePreview(nextValue);

    this._hapticOnSliderStep(stepped, { commit });
    if (commit) {
      this._commitPercentage(nextValue);
    }
  }

  _getCircularDialStep(state = this._getState()) {
    const configuredStep = Number(state?.attributes?.percentage_step);
    return Number.isFinite(configuredStep) && configuredStep > 0 ? configuredStep : 5;
  }

  _applyCircularDialValue(value, options = {}) {
    const commit = options.commit === true;
    const nextValue = clamp(Number(value), 0, 100);
    const stepped = Math.round(nextValue);

    this._draftPercentage.set(this._config.entity, nextValue);
    this._updatePercentagePreview(nextValue);
    this._hapticOnSliderStep(stepped, { commit });
    if (commit) {
      this._commitPercentage(nextValue);
    }
  }

  _onShadowPointerDown(event) {
    const path = event.composedPath();
    const slider = path.find(node =>
      node instanceof HTMLInputElement &&
      node.type === "range" &&
      node.dataset?.fanControl,
    );

    if (!this._activeSliderDrag && slider && (typeof event.button !== "number" || event.button === 0)) {
      this._startSliderDrag(slider, event.clientX, event, event.pointerId);
      return;
    }

    if (this._activeSliderDrag || (typeof event.button === "number" && event.button !== 0)) {
      return;
    }

    const controlAction = path.find(
      node => node instanceof HTMLElement && node.dataset?.fanAction && node.dataset.fanAction !== "body",
    );
    if (controlAction) {
      return;
    }

    const dial = path.find(node => node instanceof HTMLElement && node.classList?.contains("fan-card__circular-dial"));
    if (!dial || !this._supportsPercentage(this._getState())) {
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
    if (!state || !this._supportsPercentage(state)) {
      return;
    }

    const step = this._getCircularDialStep(state);
    const seedValue = this._getPercentage(state);
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
      this._suppressNextFanTap = true;
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
    this._suppressNextFanTap = true;

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
      node.dataset?.fanControl,
    );

    if (!this._activeSliderDrag && slider && event.button === 0) {
      this._startSliderDrag(slider, event.clientX, event);
      return;
    }

    if (this._activeSliderDrag || event.button !== 0) {
      return;
    }

    const controlAction = path.find(
      node => node instanceof HTMLElement && node.dataset?.fanAction && node.dataset.fanAction !== "body",
    );
    if (controlAction) {
      return;
    }

    const dial = path.find(node => node instanceof HTMLElement && node.classList?.contains("fan-card__circular-dial"));
    if (!dial || !this._supportsPercentage(this._getState())) {
      return;
    }

    this._startCircularDialDrag(dial, event.clientX, event.clientY, event);
  }

  _onShadowTouchStart(event) {
    const path = event.composedPath();
    const slider = path.find(node =>
      node instanceof HTMLInputElement &&
      node.type === "range" &&
      node.dataset?.fanControl,
    );

    if (!this._activeSliderDrag && slider && event.touches?.length) {
      this._startSliderDrag(slider, event.touches[0].clientX, event);
      return;
    }

    if (this._activeSliderDrag || !event.touches?.length) {
      return;
    }

    const controlAction = path.find(
      node => node instanceof HTMLElement && node.dataset?.fanAction && node.dataset.fanAction !== "body",
    );
    if (controlAction) {
      return;
    }

    const dial = path.find(node => node instanceof HTMLElement && node.classList?.contains("fan-card__circular-dial"));
    if (!dial || !this._supportsPercentage(this._getState())) {
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
      .find(node => node instanceof HTMLInputElement && node.dataset?.fanControl);

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
      .find(node => node instanceof HTMLInputElement && node.dataset?.fanControl);

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
      node => node instanceof HTMLInputElement && node.dataset?.fanControl,
    );

    if (slider) {
      return;
    }

    const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.fanAction);

    if (!actionButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const state = this._getState();
    const fanAction = actionButton.dataset.fanAction;

    if (fanAction === "body" || fanAction === "icon") {
      const zone = fanAction;
      if (zone === "body" && window.NodaliaUtils?.isNodaliaSliderChromeHit?.(event)) {
        return;
      }
      if (this._suppressNextFanTap) {
        this._suppressNextFanTap = false;
        return;
      }
      const tapEffect = this._resolveFanTapEffect(zone);
      const doubleEffect = this._resolveFanDoubleTapEffect(zone);
      const runTap = () => {
        if (tapEffect === "none") {
          return;
        }
        this._triggerHaptic();
        this._executeFanTapEffect(zone, tapEffect);
      };
      const runDouble = () => {
        if (doubleEffect === "none") {
          return;
        }
        this._triggerHaptic();
        this._executeFanDoubleTapEffect(zone, doubleEffect);
      };
      if (doubleEffect !== "none" && typeof window.NodaliaUtils?.scheduleCardZoneTap === "function") {
        window.NodaliaUtils.scheduleCardZoneTap(this, { zone, onSingle: runTap, onDouble: runDouble });
        return;
      }
      runTap();
      return;
    }

    this._triggerHaptic();

    switch (fanAction) {
      case "decrease-percentage":
        this._triggerButtonBounce(actionButton);
        this._changePercentageBy(-1, state);
        break;
      case "increase-percentage":
        this._triggerButtonBounce(actionButton);
        this._changePercentageBy(1, state);
        break;
      case "oscillate":
        this._triggerButtonBounce(actionButton);
        this._toggleOscillation(state);
        break;
      case "toggle-preset-panel":
        this._triggerButtonBounce(actionButton);
        this._setPresetPanelVisibility(!this._presetPanelOpen, state);
        break;
      case "preset":
        this._triggerButtonBounce(actionButton);
        if (actionButton.dataset.mode) {
          this._commitPresetMode(actionButton.dataset.mode);
        }
        break;
      default:
        break;
    }
  }

  _fanCardUi(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.fan;
    const enPack = window.NodaliaI18n?.strings?.("en")?.fan;
    const raw = pack?.[key] ?? enPack?.[key];
    return String(raw != null && raw !== "" ? raw : fallback);
  }

  _fanAria(key, fallback = "") {
    return window.NodaliaI18n?.translateFanAria?.(this._hass, this._config?.language ?? "auto", key, fallback) || fallback;
  }

  _renderEmptyState() {
    const title = escapeHtml(this._fanCardUi("emptyTitle", "Nodalia Fan Card"));
    const body = escapeHtml(
      this._fanCardUi("emptyBody", "Set `entity` to a `fan.*` entity to show this card."),
    );
    return `
      <ha-card class="fan-card fan-card--empty">
        <div class="fan-card__empty-title">${title}</div>
        <div class="fan-card__empty-text">${body}</div>
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
      { cardClass: "fan-card" },
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
    const title = this._getFanName(state);
    const icon = this._getFanIcon(state);
    const entityPicture = this._getEntityPicture(state);
    const accentColor = this._getAccentColor(state);
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const darkenBubbleIconGlyph =
      isOn && Boolean(window.NodaliaBubbleContrast?.shouldDarkenBubbleIconGlyph(state, accentColor));
    const showUnavailableBadge = isUnavailableState(state);
    const currentPercentage = this._getPercentage(state);
    const supportsPercentage = config.show_slider !== false && this._supportsPercentage(state);
    const supportsOscillation = config.show_oscillation !== false && this._supportsOscillation(state);
    const presetModes = config.show_preset_modes !== false ? this._getPresetModes(state) : [];
    const currentPresetMode = this._getCurrentPresetMode(state);
    const translatedPresetMode = currentPresetMode ? translatePresetLabel(currentPresetMode) : "";
    const isCompactLayout = this._isCompactLayout;
    const hasSecondaryControls = isOn && (supportsOscillation || presetModes.length);
    const showCompactSecondary = hasSecondaryControls && (!isCompactLayout || !supportsPercentage);
    const chips = [];
    const showTitle = true;
    const showCopyBlock = showTitle
      || config.show_state === true
      || (!isCompactLayout && isOn && ((config.show_percentage_chip !== false && supportsPercentage) || (config.show_mode_chip !== false && translatedPresetMode)));

    if (config.show_state === true) {
      chips.push(`<span class="fan-card__chip fan-card__chip--state">${escapeHtml(this._getStateLabel(state))}</span>`);
    }

    if (!isCompactLayout && isOn && config.show_percentage_chip !== false && supportsPercentage) {
      chips.push(`<span class="fan-card__chip" data-fan-chip="percentage">${escapeHtml(`${Math.round(currentPercentage)}%`)}</span>`);
    }

    if (!isCompactLayout && isOn && config.show_mode_chip !== false && translatedPresetMode) {
      chips.push(`<span class="fan-card__chip">${escapeHtml(translatedPresetMode)}</span>`);
    }

    if (!presetModes.length) {
      this._presetPanelOpen = false;
    }
    if (isCompactLayout && supportsPercentage) {
      this._presetPanelOpen = false;
    }

    const onCardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 54%, ${styles.card.background} 100%)`;
    const onCardBorder = `color-mix(in srgb, ${accentColor} 34%, var(--divider-color))`;
    const onCardShadow = `0 16px 32px color-mix(in srgb, ${accentColor} 14%, rgba(0, 0, 0, 0.18))`;
    const animations = this._getAnimationSettings();
    const now = Date.now();
    const wasOn = this._lastRenderedIsOn;
    const isPresetPanelVisible = Boolean(isOn && this._presetPanelOpen && presetModes.length);
    let powerAnimationState = "";
    let controlsAnimationState = "";
    let presetPanelAnimationState = "";

    if (!animations.enabled) {
      this._powerTransition = null;
      this._controlsTransition = null;
      this._presetPanelTransition = null;
    } else if (wasOn !== null && wasOn !== isOn) {
      powerAnimationState = isOn ? "powering-up" : "powering-down";
      this._powerTransition = {
        endsAt: now + animations.powerDuration,
        startedAt: now,
        state: powerAnimationState,
      };

      if (supportsPercentage || hasSecondaryControls || this._lastControlsMarkup) {
        controlsAnimationState = isOn ? "entering" : "leaving";
        this._controlsTransition = {
          endsAt: now + animations.controlsDuration,
          startedAt: now,
          state: controlsAnimationState,
        };
      } else {
        this._controlsTransition = null;
      }

      this._presetPanelTransition = null;
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

      if (isOn && wasOn === isOn && this._lastRenderedPresetPanelVisible !== isPresetPanelVisible) {
        presetPanelAnimationState = isPresetPanelVisible ? "entering" : "leaving";
        this._presetPanelTransition = {
          endsAt: now + animations.presetDuration,
          startedAt: now,
          state: presetPanelAnimationState,
        };
      } else if (this._presetPanelTransition?.endsAt > now) {
        presetPanelAnimationState = this._presetPanelTransition.state;
      } else {
        this._presetPanelTransition = null;
      }

      if (!isOn) {
        this._presetPanelTransition = null;
      }
    }

    const shouldAnimatePercentageFill = animations.enabled &&
      powerAnimationState === "powering-up" &&
      isOn &&
      supportsPercentage;
    const percentageFillDuration = shouldAnimatePercentageFill
      ? clamp(Math.round(animations.controlsDuration * 0.82), 220, 1100)
      : 0;
    let percentageFillDelay = 0;
    if (shouldAnimatePercentageFill && this._powerTransition?.startedAt != null) {
      const fillElapsed = now - Number(this._powerTransition.startedAt);
      if (fillElapsed > 0) {
        percentageFillDelay = -clamp(fillElapsed, 0, percentageFillDuration);
      }
    }
    const percentageSliderShellClass = shouldAnimatePercentageFill ? " fan-card__slider-shell--percentage-fill" : "";
    const shouldAnimatePercentageEmpty = animations.enabled && controlsAnimationState === "leaving";
    const percentageEmptyDuration = shouldAnimatePercentageEmpty
      ? clamp(Math.round(animations.controlsDuration * 0.72), 180, 900)
      : 0;
    let percentageEmptyDelay = 0;
    if (shouldAnimatePercentageEmpty && this._controlsTransition?.startedAt != null) {
      percentageEmptyDelay = -clamp(now - Number(this._controlsTransition.startedAt), 0, percentageEmptyDuration);
    }

    const mainControlsMarkup = isOn && supportsPercentage
      ? `
        <div class="fan-card__slider-row ${showCompactSecondary ? "" : "fan-card__slider-row--solo"}">
          <div class="fan-card__slider-wrap">
            <div class="fan-card__slider-shell${percentageSliderShellClass}" style="--percentage:${currentPercentage}; --percentage-target:${currentPercentage};">
              <div class="fan-card__slider-track"></div>
              <input
                type="range"
                class="fan-card__slider"
                data-fan-control="percentage"
                min="0"
                max="100"
                step="any"
                value="${currentPercentage}"
                style="--percentage:${currentPercentage};"
                aria-label="${escapeHtml(this._fanAria("speedSlider", "Speed"))}"
              />
            </div>
          </div>
          ${
            showCompactSecondary
              ? `
                <div class="fan-card__slider-actions">
                  ${
                    supportsOscillation
                      ? `
                        <button
                          type="button"
                          class="fan-card__control ${this._isOscillating(state) ? "fan-card__control--active" : ""}"
                          data-fan-action="oscillate"
                          aria-label="${escapeHtml(this._fanAria(this._isOscillating(state) ? "oscillationOff" : "oscillationOn", this._isOscillating(state) ? "Turn oscillation off" : "Turn oscillation on"))}"
                        >
                          <ha-icon icon="mdi:rotate-360"></ha-icon>
                        </button>
                      `
                      : ""
                  }
                  ${
                    presetModes.length
                      ? `
                        <button
                          type="button"
                          class="fan-card__control ${this._presetPanelOpen ? "fan-card__control--active" : ""}"
                          data-fan-action="toggle-preset-panel"
                          aria-label="${escapeHtml(this._fanAria("showModes", "Show modes"))}"
                        >
                          <ha-icon icon="mdi:tune-variant"></ha-icon>
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
      : !supportsPercentage && showCompactSecondary
        ? `
          <div class="fan-card__controls">
            ${
              supportsOscillation
                ? `
                  <button
                    type="button"
                    class="fan-card__control ${this._isOscillating(state) ? "fan-card__control--active" : ""}"
                    data-fan-action="oscillate"
                    aria-label="${escapeHtml(this._fanAria(this._isOscillating(state) ? "oscillationOff" : "oscillationOn", this._isOscillating(state) ? "Turn oscillation off" : "Turn oscillation on"))}"
                  >
                    <ha-icon icon="mdi:rotate-360"></ha-icon>
                  </button>
                `
                : ""
            }
            ${
              presetModes.length
                ? `
                  <button
                    type="button"
                    class="fan-card__control ${this._presetPanelOpen ? "fan-card__control--active" : ""}"
                    data-fan-action="toggle-preset-panel"
                    aria-label="${escapeHtml(this._fanAria("showModes", "Show modes"))}"
                  >
                    <ha-icon icon="mdi:tune-variant"></ha-icon>
                  </button>
                `
                : ""
            }
          </div>
        `
        : "";

    const currentPresetPanelMarkup = isPresetPanelVisible
      ? `
        <div class="fan-card__preset-panel">
          ${presetModes
            .map(mode => `
              <button
                type="button"
                class="fan-card__preset ${normalizeTextKey(mode) === normalizeTextKey(currentPresetMode) ? "is-active" : ""}"
                data-fan-action="preset"
                data-mode="${escapeHtml(mode)}"
              >
                ${escapeHtml(translatePresetLabel(mode))}
              </button>
            `)
            .join("")}
        </div>
      `
      : "";
    const presetPanelContentMarkup = currentPresetPanelMarkup
      || (presetPanelAnimationState === "leaving" ? this._lastPresetPanelMarkup : "");
    const presetPanelShellMarkup = presetPanelContentMarkup
      ? `
        <div class="fan-card__preset-panel-shell ${presetPanelAnimationState ? `fan-card__preset-panel-shell--${presetPanelAnimationState}` : ""}" data-panel-key="preset">
          <div class="fan-card__preset-panel-inner">
            ${presetPanelContentMarkup}
          </div>
        </div>
      `
      : "";
    const currentControlsAnimatedMarkup = [
      mainControlsMarkup,
      presetPanelShellMarkup,
    ].filter(Boolean).join("");
    const currentControlsStaticMarkup = [
      mainControlsMarkup,
      currentPresetPanelMarkup
        ? `
          <div class="fan-card__preset-panel-shell" data-panel-key="preset">
            <div class="fan-card__preset-panel-inner">
              ${currentPresetPanelMarkup}
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
        <div class="fan-card__controls-shell ${controlsAnimationState ? `fan-card__controls-shell--${controlsAnimationState}` : ""}" data-nodalia-tap-shield="true">
          <div class="fan-card__controls-inner">
            ${controlsContentMarkup}
          </div>
        </div>
      `
      : "";
    const circularDial = getCircularLayoutDialModel(currentPercentage, 0, 100);
    const circularControlsMarkup = `
      <div class="fan-card__circular-layout">
        <div class="fan-card__circular-dial" data-nodalia-tap-shield="true" style="--circular-progress:${circularDial.progress};--circular-marker-left:${circularDial.markerLeft}%;--circular-marker-top:${circularDial.markerTop}%;">
          <svg viewBox="0 0 240 240" aria-hidden="true">
            <circle class="fan-card__circular-track" cx="120" cy="120" r="86" pathLength="100"></circle>
            <circle class="fan-card__circular-hit" cx="120" cy="120" r="86" pathLength="100" data-fan-control="circular-dial"></circle>
            <circle class="fan-card__circular-progress" cx="120" cy="120" r="86" pathLength="100"></circle>
          </svg>
          <span class="fan-card__circular-thumb" data-fan-control="circular-dial" aria-hidden="true"></span>
          <div class="fan-card__circular-center">
            <strong data-fan-chip="percentage">${escapeHtml(`${Math.round(currentPercentage)}%`)}</strong>
            <span class="fan-card__circular-divider" aria-hidden="true"></span>
            <span>${escapeHtml(this._fanAria("speedSlider", "Speed"))}</span>
            <div class="fan-card__circular-actions">
              ${supportsOscillation ? `<button type="button" class="fan-card__control ${this._isOscillating(state) ? "fan-card__control--active" : ""}" data-fan-action="oscillate" aria-label="${escapeHtml(this._fanAria(this._isOscillating(state) ? "oscillationOff" : "oscillationOn", "Oscillation"))}"><ha-icon icon="mdi:rotate-360"></ha-icon></button>` : ""}
              ${presetModes.length ? `<button type="button" class="fan-card__control ${this._presetPanelOpen ? "fan-card__control--active" : ""}" data-fan-action="toggle-preset-panel" aria-label="${escapeHtml(this._fanAria("showModes", "Show modes"))}"><ha-icon icon="mdi:tune-variant"></ha-icon></button>` : ""}
            </div>
          </div>
        </div>
        <div class="fan-card__circular-steps">
          <button type="button" class="fan-card__circular-step" data-nodalia-tap-shield="true" data-fan-action="decrease-percentage" ${supportsPercentage ? "" : "disabled"} aria-label="${escapeHtml(this._fanAria("speedDown", "Decrease speed"))}">&minus;</button>
          <button type="button" class="fan-card__circular-power ${isOn ? "is-active" : ""}" data-fan-action="icon" aria-label="${escapeHtml(window.NodaliaI18n?.translateCommonAria?.(this._hass, config.language ?? "auto", "togglePower", "Turn on or off") || "Turn on or off")}"><ha-icon icon="mdi:power"></ha-icon></button>
          <button type="button" class="fan-card__circular-step" data-nodalia-tap-shield="true" data-fan-action="increase-percentage" ${supportsPercentage ? "" : "disabled"} aria-label="${escapeHtml(this._fanAria("speedUp", "Increase speed"))}">+</button>
        </div>
        <div class="fan-card__controls-inner">${presetPanelShellMarkup}</div>
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
    const presetAnimationRemaining = presetPanelAnimationState && this._presetPanelTransition
      ? Math.max(0, this._presetPanelTransition.endsAt - now)
      : 0;
    const presetAnimationDelay = presetPanelAnimationState && this._presetPanelTransition
      ? -clamp(now - Number(this._presetPanelTransition.startedAt || now), 0, animations.presetDuration)
      : 0;
    const percentageFillAnimationRemaining = shouldAnimatePercentageFill && this._powerTransition
      ? Math.max(0, Number(this._powerTransition.startedAt) + percentageFillDuration - now)
      : 0;
    const percentageEmptyAnimationRemaining = shouldAnimatePercentageEmpty && this._controlsTransition
      ? Math.max(0, Number(this._controlsTransition.startedAt) + percentageEmptyDuration - now)
      : 0;
    const shouldCleanupAfterAnimation = Boolean(
      powerAnimationRemaining ||
      controlsAnimationRemaining ||
      presetAnimationRemaining ||
      percentageFillAnimationRemaining ||
      percentageEmptyAnimationRemaining,
    );
    const cleanupDelay = shouldCleanupAfterAnimation
      ? Math.max(
        powerAnimationRemaining,
        controlsAnimationRemaining,
        presetAnimationRemaining,
        percentageFillAnimationRemaining,
        percentageEmptyAnimationRemaining,
      ) + 40
      : 0;

    if (currentPresetPanelMarkup) {
      this._lastPresetPanelMarkup = currentPresetPanelMarkup;
    }

    if (isOn && currentControlsStaticMarkup && presetPanelAnimationState !== "leaving") {
      this._lastControlsMarkup = currentControlsStaticMarkup;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        ha-card.fan-card {
          --fan-card-controls-max-height: 360px;
          --fan-card-controls-gap: calc(${styles.card.gap} + 4px);
          --fan-card-controls-duration: ${animations.controlsDuration}ms;
          --fan-card-controls-delay: ${controlsAnimationDelay}ms;
          --fan-card-panel-duration: ${animations.presetDuration}ms;
          --fan-card-panel-delay: ${presetAnimationDelay}ms;
          --fan-card-power-duration: ${animations.powerDuration}ms;
          --fan-card-power-delay: ${powerAnimationDelay}ms;
          --fan-card-percentage-fill-delay: ${percentageFillDelay}ms;
          --fan-card-percentage-fill-duration: ${percentageFillDuration}ms;
          --fan-card-percentage-empty-delay: ${percentageEmptyDelay}ms;
          --fan-card-percentage-empty-duration: ${percentageEmptyDuration}ms;
          --fan-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
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

        .fan-card.is-off {
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

        .fan-card--powering-up {
          animation: fan-card-power-up var(--fan-card-power-duration) cubic-bezier(0.24, 0.82, 0.25, 1) var(--fan-card-power-delay, 0ms) both;
        }

        .fan-card--powering-down {
          animation: fan-card-power-down var(--fan-card-power-duration) cubic-bezier(0.32, 0, 0.24, 1) var(--fan-card-power-delay, 0ms) both;
        }

        .fan-card--powering-up::after {
          animation: fan-card-power-glow-in var(--fan-card-power-duration) cubic-bezier(0.24, 0.82, 0.25, 1) var(--fan-card-power-delay, 0ms) both;
        }

        .fan-card--powering-down::after {
          animation: fan-card-power-glow-out var(--fan-card-power-duration) cubic-bezier(0.32, 0, 0.24, 1) var(--fan-card-power-delay, 0ms) both;
        }

        .fan-card {
          color: var(--primary-text-color);
          display: grid;
          min-width: 0;
          position: relative;
          z-index: 1;
        }

        .fan-card__content {
          display: grid;
          gap: 0;
        }

        .fan-card__hero {
          align-items: center;
          display: grid;
          gap: ${styles.card.gap};
          grid-template-columns: auto minmax(0, 1fr);
          min-width: 0;
        }

        .fan-card--compact .fan-card__hero {
          justify-items: start;
          text-align: start;
        }

        .fan-card--compact {
          container-type: inline-size;
        }

        .fan-card--compact .fan-card__controls {
          display: flex;
          flex-wrap: nowrap;
          gap: clamp(12px, 5cqi, 20px);
          justify-content: center;
          padding-block: 4px 2px;
          width: 100%;
        }

        .fan-card--compact .fan-card__control {
          flex: 0 0 auto;
          height: clamp(44px, 16cqi, 56px);
          min-width: clamp(44px, 16cqi, 56px);
          width: clamp(44px, 16cqi, 56px);
        }

        .fan-card--compact .fan-card__control ha-icon {
          --mdc-icon-size: clamp(18px, 6.5cqi, 24px);
        }

        .fan-card--compact .fan-card__title {
          font-size: 14px;
        }

        .fan-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${isOn
            ? `color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent))`
            : "color-mix(in srgb, var(--primary-text-color) 6%, transparent)"};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.16);
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

        .fan-card__icon ha-icon {
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

        .fan-card__icon--active-motion ha-icon {
          animation: fan-card-icon-spin 1.35s linear infinite;
          transform: translate3d(-50%, -50%, 0);
        }

        .fan-card__picture {
          border-radius: inherit;
          height: 100%;
          inset: 0;
          object-fit: cover;
          pointer-events: none;
          position: absolute;
          width: 100%;
        }

        .fan-card__unavailable-badge {
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

        .fan-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          color:#fff;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .fan-card__copy {
          display: grid;
          gap: 10px;
          min-width: 0;
        }

        .fan-card__headline {
          align-items: start;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .fan-card--compact .fan-card__copy {
          justify-items: stretch;
          min-width: 0;
          width: 100%;
        }

        .fan-card--compact .fan-card__headline {
          grid-template-columns: minmax(0, 1fr) auto;
          justify-items: stretch;
          width: 100%;
        }

        .fan-card__title {
          font-size: ${styles.title_size};
          font-weight: 700;
          letter-spacing: -0.01em;
          line-height: 1.15;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .fan-card__chips {
          display: flex;
          flex: 0 0 auto;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          min-width: 0;
          max-width: 100%;
        }

        .fan-card--compact .fan-card__chips {
          justify-content: flex-end;
          justify-self: end;
        }

        .fan-card__chip {
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

        .fan-card__chip--state {
          color: var(--primary-text-color);
        }

        .fan-card__controls-shell {
          backface-visibility: hidden;
          display: grid;
          grid-template-rows: 1fr;
          margin-top: var(--fan-card-controls-gap);
          max-height: 320px;
          overflow: visible;
          will-change: grid-template-rows, max-height, margin-top, opacity;
        }

        .fan-card__controls-inner {
          backface-visibility: hidden;
          display: grid;
          gap: 10px;
          min-height: 0;
          overflow: visible;
          will-change: opacity, transform;
        }

        .fan-card__controls-shell--entering {
          animation: fan-card-controls-expand var(--fan-card-controls-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--fan-card-controls-delay, 0ms) both;
          overflow: hidden;
          transform-origin: top;
        }

        .fan-card__controls-shell--entering .fan-card__controls-inner {
          animation: fan-card-controls-content-in var(--fan-card-controls-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--fan-card-controls-delay, 0ms) both;
          overflow: hidden;
          transform-origin: top;
        }

        .fan-card__controls-shell--leaving {
          animation: fan-card-controls-collapse var(--fan-card-controls-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--fan-card-controls-delay, 0ms) both;
          overflow: hidden;
          pointer-events: none;
          transform-origin: top;
        }

        .fan-card__controls-shell--leaving .fan-card__controls-inner {
          animation: fan-card-controls-content-out var(--fan-card-controls-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--fan-card-controls-delay, 0ms) both;
          overflow: hidden;
          transform-origin: top;
        }

        .fan-card__controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          padding-inline: 4px;
        }

        .fan-card__slider-actions {
          display: inline-flex;
          flex: 0 0 auto;
          gap: 12px;
          justify-content: flex-end;
          padding-block: 10px;
        }

        .fan-card__control {
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

        .fan-card__control--active {
          background: color-mix(in srgb, ${accentColor} 18%, ${styles.control.accent_background});
          border-color: color-mix(in srgb, ${accentColor} 48%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: ${styles.control.accent_color};
        }

        .fan-card__control ha-icon {
          --mdc-icon-size: calc(${styles.control.size} * 0.46);
          display: inline-flex;
          height: calc(${styles.control.size} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${styles.control.size} * 0.46);
        }

        .fan-card__slider-row {
          align-items: center;
          display: grid;
          gap: 14px;
          grid-template-columns: minmax(0, 1fr) auto;
          overflow: visible;
          padding-inline: 4px;
        }

        .fan-card__slider-wrap {
          --fan-card-slider-input-height: max(44px, var(--fan-card-slider-thumb-size));
          --fan-card-slider-thumb-size: calc(${styles.slider_thumb_size} + 12px);
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          display: flex;
          min-height: ${styles.slider_wrap_height};
          padding: 0 14px;
        }

        .fan-card__slider-shell {
          flex: 1;
          min-width: 0;
          position: relative;
        }

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
          transform: scaleX(calc(var(--percentage, ${currentPercentage}) / 100));
          transform-origin: left center;
        }

        .fan-card__slider-shell--percentage-fill .fan-card__slider-track::before {
          transform: scaleX(0.01);
          animation: fan-card-percentage-fill var(--fan-card-percentage-fill-duration) cubic-bezier(0.2, 0.86, 0.18, 1) var(--fan-card-percentage-fill-delay, 0ms) both;
        }

        ${
          shouldAnimatePercentageEmpty
            ? `
        .fan-card__controls-shell--leaving .fan-card__slider-track::before {
          animation: fan-card-percentage-empty var(--fan-card-percentage-empty-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--fan-card-percentage-empty-delay, 0ms) both;
        }
        `
            : ""
        }

        .fan-card__slider-row--solo {
          grid-template-columns: minmax(0, 1fr);
        }

        .fan-card__slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          box-sizing: border-box;
          cursor: pointer;
          flex: 1;
          height: var(--fan-card-slider-input-height);
          margin: 0;
          padding: 0;
          position: relative;
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
          width: 100%;
          z-index: 1;
        }

        .fan-card__slider::-webkit-slider-runnable-track {
          background: transparent;
          border-radius: 999px;
          height: ${styles.slider_height};
        }

        .fan-card__slider::-moz-range-progress {
          background: transparent;
          border: 0;
          height: ${styles.slider_height};
        }

        .fan-card__slider::-moz-range-track {
          background: transparent;
          border-radius: 999px;
          border: 0;
          height: ${styles.slider_height};
        }

        .fan-card__slider::-webkit-slider-thumb {
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

        .fan-card__slider::-moz-range-thumb {
          background: transparent;
          border: 0;
          border-radius: 50%;
          box-shadow: none;
          box-sizing: border-box;
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

        .fan-card__preset-panel-shell {
          backface-visibility: hidden;
          overflow: hidden;
          will-change: max-height, opacity;
        }

        .fan-card__preset-panel-inner {
          backface-visibility: hidden;
          display: grid;
          padding: 4px;
          will-change: opacity, transform;
        }

        .fan-card__preset-panel-shell--entering {
          animation: fan-card-preset-panel-expand var(--fan-card-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--fan-card-panel-delay, 0ms) both;
          transform-origin: top;
        }

        .fan-card__preset-panel-shell--entering .fan-card__preset-panel-inner {
          animation: fan-card-preset-panel-content-in var(--fan-card-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--fan-card-panel-delay, 0ms) both;
          transform-origin: top;
        }

        .fan-card__preset-panel-shell--leaving {
          animation: fan-card-preset-panel-collapse var(--fan-card-panel-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--fan-card-panel-delay, 0ms) both;
          pointer-events: none;
          transform-origin: top;
        }

        .fan-card__preset-panel-shell--leaving .fan-card__preset-panel-inner {
          animation: fan-card-preset-panel-content-out var(--fan-card-panel-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--fan-card-panel-delay, 0ms) both;
          transform-origin: top;
        }

        .fan-card__preset {
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

        .fan-card__preset.is-active {
          background: ${styles.control.accent_background};
          border-color: color-mix(in srgb, ${accentColor} 48%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: ${styles.control.accent_color};
        }

        .fan-card--circular .fan-card__content {
          gap: 14px;
        }

        ha-card.fan-card--circular {
          border-radius: 30px;
          padding: 16px;
        }

        .fan-card--circular .fan-card__hero {
          align-items: center;
          gap: 16px;
          grid-template-columns: 58px minmax(0, 1fr);
        }

        .fan-card--circular .fan-card__icon {
          height: 58px;
          width: 58px;
        }

        .fan-card--circular .fan-card__icon > ha-icon {
          --mdc-icon-size: 25.52px;
          height: 25.52px;
          width: 25.52px;
        }

        .fan-card--circular .fan-card__title {
          font-size: 16px;
        }

        .fan-card__circular-layout {
          display: grid;
          gap: 14px;
          justify-items: center;
          min-width: 0;
        }

        .fan-card__circular-dial {
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
          stroke: ${accentColor};
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

        .fan-card__circular-center strong {
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

        .fan-card__circular-actions,
        .fan-card__circular-steps {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .fan-card__circular-actions {
          pointer-events: auto;
        }

        .fan-card__circular-actions .fan-card__control {
          height: 34px;
          min-width: 34px;
          width: 34px;
        }

        .fan-card__circular-step,
        .fan-card__circular-power {
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

        .fan-card__circular-power.is-active {
          background: color-mix(in srgb, ${accentColor} 22%, ${styles.control.accent_background});
          border-color: color-mix(in srgb, ${accentColor} 50%, transparent);
        }

        .fan-card__circular-power ha-icon {
          --mdc-icon-size: 22px;
        }

        .fan-card__circular-step:disabled {
          cursor: default;
          opacity: 0.4;
        }

        :is(.fan-card__icon, .fan-card__control, .fan-card__preset):active:not(:disabled),
        :is(.fan-card__icon, .fan-card__control, .fan-card__preset).is-pressing:not(:disabled) {
          animation: fan-card-button-bounce var(--fan-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        @keyframes fan-card-power-up {
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

        @keyframes fan-card-power-down {
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

        @keyframes fan-card-power-glow-in {
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

        @keyframes fan-card-power-glow-out {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes fan-card-controls-expand {
          0% {
            grid-template-rows: 0fr;
            max-height: 0;
            margin-top: 0;
            opacity: 0;
          }
          100% {
            grid-template-rows: 1fr;
            max-height: 320px;
            margin-top: var(--fan-card-controls-gap);
            opacity: 1;
          }
        }

        @keyframes fan-card-percentage-fill {
          0% {
            transform: scaleX(0.01);
          }
          100% {
            transform: scaleX(calc(var(--percentage-target, var(--percentage, ${currentPercentage})) / 100));
          }
        }

        @keyframes fan-card-percentage-empty {
          0% {
            transform: scaleX(calc(var(--percentage-target, var(--percentage, 0)) / 100));
          }
          100% {
            transform: scaleX(0.01);
          }
        }

        @keyframes fan-card-controls-collapse {
          0% {
            grid-template-rows: 1fr;
            max-height: 320px;
            margin-top: var(--fan-card-controls-gap);
            opacity: 1;
          }
          100% {
            grid-template-rows: 0fr;
            max-height: 0;
            margin-top: 0;
            opacity: 0;
          }
        }

        @keyframes fan-card-controls-content-in {
          0% {
            opacity: 0;
            transform: translateY(-4px) scaleY(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes fan-card-controls-content-out {
          0% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.94);
          }
        }

        @keyframes fan-card-preset-panel-expand {
          0% {
            max-height: 0;
            opacity: 0;
          }
          100% {
            max-height: 180px;
            opacity: 1;
          }
        }

        @keyframes fan-card-preset-panel-collapse {
          0% {
            max-height: 180px;
            opacity: 1;
          }
          100% {
            max-height: 0;
            opacity: 0;
          }
        }

        @keyframes fan-card-preset-panel-content-in {
          0% {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes fan-card-preset-panel-content-out {
          0% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-6px) scaleY(0.96);
          }
        }

        @keyframes fan-card-button-bounce {
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

        @keyframes fan-card-icon-spin {
          from {
            transform: translate3d(-50%, -50%, 0) rotate(0deg);
          }
          to {
            transform: translate3d(-50%, -50%, 0) rotate(360deg);
          }
        }

        @keyframes fan-card-circular-dial-thumb-pop {
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
        .fan-card,
        .fan-card::after,
        .fan-card__controls-shell,
        .fan-card__controls-inner,
        .fan-card__preset-panel-shell,
        .fan-card__preset-panel-inner,
        .fan-card__icon,
        .fan-card__slider-mode-button,
        .fan-card__preset,
        .fan-card__control,
        .fan-card * {
          animation: none !important;
          transition: none !important;
        }
        `}

        .fan-card--compact:not(.fan-card--with-copy) .fan-card__hero {
          justify-items: start;
        }

        @media (prefers-reduced-motion: reduce) {
          .fan-card,
          .fan-card::after,
          .fan-card__controls-shell,
          .fan-card__controls-inner,
          .fan-card__preset-panel-shell,
          .fan-card__preset-panel-inner,
          .fan-card__icon,
          .fan-card__control,
          .fan-card__preset {
            animation: none !important;
            transition: none !important;
          }

          .fan-card__icon--active-motion ha-icon {
            animation: none !important;
          }
        }

        @media (max-width: 420px) {
          .fan-card__hero {
            grid-template-columns: 50px minmax(0, 1fr);
          }

          .fan-card__icon {
            height: 50px;
            width: 50px;
          }

          .fan-card__slider-row {
            gap: 10px;
            grid-template-columns: minmax(0, 1fr) auto;
          }

          .fan-card__slider-actions {
            gap: 10px;
            justify-content: flex-end;
          }
        }
      </style>
      <ha-card
        data-fan-action="body"
        class="fan-card ${isOn ? "is-on" : "is-off"} ${isCircularLayout ? "fan-card--circular" : ""} ${!isCircularLayout && isCompactLayout ? "fan-card--compact" : ""} ${showCopyBlock ? "fan-card--with-copy" : ""} ${powerAnimationState ? `fan-card--${powerAnimationState}` : ""}"
        style="--accent-color:${escapeHtml(accentColor)};"
      >
        <div class="fan-card__content">
          <div class="fan-card__hero">
            <button
              type="button"
              class="fan-card__icon ${animations.enabled && animations.iconAnimation && isOn ? "fan-card__icon--active-motion" : ""}"
              data-fan-action="icon"
              aria-label="${escapeHtml(window.NodaliaI18n?.translateCommonAria?.(this._hass, config.language ?? "auto", "togglePower", "Turn on or off") || "Turn on or off")}"
            >
              ${entityPicture
                ? `<img class="fan-card__picture" src="${escapeHtml(entityPicture)}" alt="" loading="lazy" />`
                : `<ha-icon icon="${escapeHtml(icon)}"></ha-icon>`}
              ${showUnavailableBadge ? `<span class="fan-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${showCopyBlock
              ? `
                <div class="fan-card__copy">
                  <div class="fan-card__headline">
                    ${showTitle ? `<div class="fan-card__title">${escapeHtml(title)}</div>` : ""}
                    ${chips.length ? `<div class="fan-card__chips">${chips.join("")}</div>` : ""}
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
    this._lastRenderedPresetPanelVisible = isPresetPanelVisible;

    if (shouldCleanupAfterAnimation) {
      this._scheduleAnimationCleanup(cleanupDelay);
    } else if (this._animationCleanupTimer) {
      window.clearTimeout(this._animationCleanupTimer);
      this._animationCleanupTimer = 0;
    }
  }
}
  _lazyNodaliaFanCard = NodaliaFanCard;
  return NodaliaFanCard;
}
