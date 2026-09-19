// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  COLOR_PRESETS,
  COMPACT_LAYOUT_THRESHOLD,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  LIGHT_MEMORY_STORAGE_KEY,
  OPTIMISTIC_TURN_OFF_TIMEOUT,
  OPTIMISTIC_TURN_ON_TIMEOUT,
  OPTIMISTIC_VISUAL_SETTLE_MS,
} from "./light-constants";
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
  setByPath,
} from "./light-runtime";

import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./light-config";
import {
  applyStubEntity,
  getRangeValueFromGeometry,
  getSliderDragGeometry,
  getTemperatureSliderTrackGradient,
  hexToRgb,
  isUnavailableState,
  kelvinToMired,
  miredToKelvin,
  normalizeHexColorForLightPreset,
  parseSizeToPixels,
  rgbToHs,
} from "./light-helpers";

export class NodaliaLightCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["light"], entities, entitiesFallback);
  }

  static getEntitySuggestion(hass, entityId) {
    return [
      window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, {
        domains: ["light"],
        label: "Light — Standard",
        buildConfig: (_hass, selectedEntityId) => ({ entity: selectedEntityId, compact_layout_mode: "auto" }),
      }),
      window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, {
        domains: ["light"],
        label: "Light — Compact",
        buildConfig: (_hass, selectedEntityId) => ({ entity: selectedEntityId, compact_layout_mode: "always" }),
      }),
    ].filter(Boolean);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._draftBrightness = new Map();
    this._draftTemperature = new Map();
    this._draftHue = new Map();
    this._lastKnownOnState = new Map();
    this._activeControlMode = "brightness";
    this._cardWidth = 0;
    this._isCompactLayout = false;
    this._activeSliderDrag = null;
    this._pendingRenderAfterDrag = false;
    this._skipNextSliderChange = null;
    this._dragFrame = 0;
    this._pendingDragUpdate = null;
    this._dragWindowListenersAttached = false;
    this._lastRenderSignature = "";
    this._lastEntityRevision = "";
    this._lastRenderedIsOn = null;
    this._lastRenderedShowDetailedControls = null;
    this._lastControlsMarkup = "";
    this._optimisticTurnOn = null;
    this._optimisticTurnOnTimer = 0;
    this._optimisticTurnOff = null;
    this._optimisticTurnOffTimer = 0;
    this._optimisticVisualSettle = null;
    this._animationCleanupTimer = 0;
    this._entranceAnimationResetTimer = 0;
    this._animateContentOnNextRender = true;
    this._suppressNextLightTap = false;
    this._powerTransition = null;
    this._controlsTransition = null;
    this._modeSwitchTimer = 0;
    this._modeSwitchPressTimer = 0;
    this._modeTransition = null;
    this._controlsPanelUserOpen = false;
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
              if (path.some(node => node instanceof HTMLInputElement && node.dataset?.lightControl)) {
                return null;
              }
              if (window.NodaliaUtils?.isNodaliaSliderChromeHit?.(event)) {
                return null;
              }
              const actionButton = path.find(
                node => node instanceof HTMLElement && node.dataset?.lightAction,
              );
              const zone = actionButton?.dataset?.lightAction;
              return zone === "body" || zone === "icon" ? zone : null;
            },
            shouldBeginHold: zone => this._resolveHoldEffect(zone) !== "none",
            onHold: zone => {
              const effect = this._resolveHoldEffect(zone);
              if (effect === "none") {
                return;
              }
              this._triggerHaptic();
              this._clearModeSwitchTransition();
              this._executeHoldEffect(zone, effect);
            },
            markHoldConsumedClick: () => {
              this._suppressNextLightTap = true;
            },
          })
        : () => {};
  }

  connectedCallback() {
    this._detachHostHold?.reconnect?.();
    this._resizeObserver?.observe(this);
    this._scheduleOptimisticTurnOnTimeout();
    this._scheduleOptimisticTurnOffTimeout();
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    this._detachHostHold?.();
    this._resizeObserver?.disconnect();
    this._detachWindowDragListeners();
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }
    if (this._animationCleanupTimer) {
      window.clearTimeout(this._animationCleanupTimer);
      this._animationCleanupTimer = 0;
    }
    this._clearOptimisticTurnOnTimer();
    this._clearOptimisticTurnOffTimer();
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    this._powerTransition = null;
    this._controlsTransition = null;
    if (this._modeSwitchTimer) {
      window.clearTimeout(this._modeSwitchTimer);
      this._modeSwitchTimer = 0;
    }
    if (this._modeSwitchPressTimer) {
      window.clearTimeout(this._modeSwitchPressTimer);
      this._modeSwitchPressTimer = 0;
    }
    this._modeTransition = null;
    this._pendingDragUpdate = null;
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    const previousEntityId = this._config?.entity || "";
    if (previousEntityId && previousEntityId !== config?.entity) {
      this._lastKnownOnState.delete(previousEntityId);
      this._clearDraftValues(previousEntityId);
      this._clearOptimisticTurnOnState();
      this._clearOptimisticTurnOffState();
      this._controlsPanelUserOpen = false;
      this._lastRenderedShowDetailedControls = null;
    }
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
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
    const actualState = this._getActualState();
    const entityId = this._config?.entity || "";
    const entityRevision = entityId && actualState
      ? `${entityId}:${actualState.state}:${actualState.last_updated || actualState.last_changed || ""}`
      : "";
    const revisionUnchanged = Boolean(entityRevision && entityRevision === this._lastEntityRevision);
    if (entityRevision) {
      this._lastEntityRevision = entityRevision;
    }
    let nextSignature = this._getRenderSignature();
    const hasPendingOptimistic = Boolean(this._optimisticTurnOn || this._optimisticTurnOff);
    const signatureUnchanged = Boolean(
      this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature,
    );

    if (signatureUnchanged && !hasPendingOptimistic) {
      return;
    }

    const hadPendingOptimistic = hasPendingOptimistic;
    if (!revisionUnchanged || hasPendingOptimistic) {
      this._syncLastKnownOnState(actualState);
      this._syncOptimisticTurnOnState(actualState);
      this._syncOptimisticTurnOffState(actualState);
    }
    nextSignature = this._getRenderSignature();
    const optimisticJustConfirmed = hadPendingOptimistic
      && !this._optimisticTurnOn
      && !this._optimisticTurnOff;

    if (signatureUnchanged && !optimisticJustConfirmed) {
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
    return 3;
  }

  getGridOptions() {
    return {
      columns: "full",
      rows: "auto",
      min_columns: 2,
      min_rows: 2,
    };
  }

  _getRenderSignature(state = this._getState()) {
    const entityId = this._config?.entity || "";
    const attrs = state?.attributes || {};
    const joinParts = window.NodaliaRenderSignature?.joinParts;
    const values = [
      entityId,
      String(state?.state || ""),
      String(attrs.friendly_name || ""),
      String(attrs.icon || ""),
      this._config?.show_entity_picture ? 1 : 0,
      String(this._config?.entity_picture || attrs.entity_picture_local || attrs.entity_picture || ""),
      Number(attrs.brightness ?? -1),
      Number(attrs.color_temp ?? -1),
      Number(attrs.color_temp_kelvin ?? -1),
      Array.isArray(attrs.hs_color) ? attrs.hs_color.join(",") : "",
      Array.isArray(attrs.rgb_color) ? attrs.rgb_color.join(",") : "",
      String(attrs.effect || ""),
      Array.isArray(attrs.supported_color_modes) ? attrs.supported_color_modes.join("|") : "",
      Number(attrs.supported_features ?? -1),
      window.NodaliaI18n?.resolveLanguage?.(this._hass, this._config?.language ?? "auto") || "en",
      this._isCompactLayout ? 1 : 0,
      this._shouldShowCompactTitle() ? 1 : 0,
      this._shouldUseMiniLayout() ? 1 : 0,
      String(this._activeControlMode || ""),
      this._config?.show_state === true ? 1 : 0,
      String(this._config?.state_position || "right"),
      this._config?.auto_expand === false ? 0 : 1,
      this._controlsPanelUserOpen ? 1 : 0,
      this._config?.show_quick_temperature_presets === true ? 1 : 0,
      this._config?.show_quick_color_presets === true ? 1 : 0,
      Array.isArray(this._config?.color_presets)
        ? this._config.color_presets.map(p => `${String(p?.label ?? "").trim()}~${normalizeHexColorForLightPreset(p?.color)}`).join(";")
        : "",
      [
        String(this._config?.tap_action || ""),
        String(this._config?.icon_tap_action || ""),
        String(this._config?.tap_service || ""),
        String(this._config?.icon_tap_service || ""),
        String(this._config?.tap_url || ""),
        String(this._config?.icon_tap_url || ""),
        this._config?.tap_new_tab === true ? 1 : 0,
        this._config?.icon_tap_new_tab === true ? 1 : 0,
        String(this._config?.tap_service_data || ""),
        String(this._config?.icon_tap_service_data || ""),
        this._config?.security?.strict_service_actions === true ? 1 : 0,
        Array.isArray(this._config?.security?.allowed_services)
          ? this._config.security.allowed_services.join(",")
          : "",
      ].join("~"),
      [
        String(this._config?.hold_action || ""),
        String(this._config?.icon_hold_action ?? ""),
        String(this._config?.hold_service || ""),
        String(this._config?.icon_hold_service || ""),
        String(this._config?.hold_url || ""),
        String(this._config?.icon_hold_url || ""),
        this._config?.hold_new_tab === true ? 1 : 0,
        this._config?.icon_hold_new_tab === true ? 1 : 0,
        String(this._config?.hold_service_data || ""),
        String(this._config?.icon_hold_service_data || ""),
      ].join("~"),
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "light:", values }]);
    }
    return values.join("|");
  }

  _controlsEditorStr(key) {
    const hass = this._hass;
    if (typeof key !== "string" || !window.NodaliaI18n?.editorStr) {
      return key;
    }
    return window.NodaliaI18n.editorStr(hass, this._config?.language ?? "auto", key);
  }

  _lightCardUi(path, fallback = "", values = {}) {
    if (typeof window.NodaliaI18n?.translateLightUi === "function") {
      return window.NodaliaI18n.translateLightUi(
        this._hass,
        this._config?.language ?? "auto",
        path,
        fallback,
        values,
      );
    }
    return fallback;
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) && numericColumns > 0 ? numericColumns : null;
  }

  _getCompactLayoutThreshold() {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const iconSize = parseSizeToPixels(styles?.icon?.size, 58);
    const cardPadding = parseSizeToPixels(styles?.card?.padding, 14);
    const cardGap = parseSizeToPixels(styles?.card?.gap, 12);

    return Math.max(
      COMPACT_LAYOUT_THRESHOLD,
      Math.round(iconSize + (cardPadding * 2) + cardGap + 24),
    );
  }

  _getQuickColorPresetRows(config = this._config) {
    const rows = Array.isArray(config?.color_presets) ? config.color_presets : [];
    const out = [];
    for (const row of rows.slice(0, 4)) {
      const color = normalizeHexColorForLightPreset(row?.color);
      if (!color) {
        continue;
      }
      const rgb = hexToRgb(color);
      const hs = rgb ? rgbToHs(rgb) : null;
      if (!hs) {
        continue;
      }
      out.push({
        color,
        label: String(row?.label ?? "").trim(),
        hs,
      });
    }
    return out;
  }

  _getMiniLayoutThreshold() {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const iconSize = parseSizeToPixels(styles?.icon?.size, 58);
    const cardPadding = parseSizeToPixels(styles?.card?.padding, 14);

    return Math.max(
      116,
      Math.round(iconSize + (cardPadding * 2) + 12),
    );
  }

  _shouldUseMiniLayout(width = Math.round(this._cardWidth || this.clientWidth || 0)) {
    const gridColumns = this._getConfiguredGridColumns();
    if (gridColumns !== null) {
      return gridColumns <= 2;
    }

    return width > 0 && width < this._getMiniLayoutThreshold();
  }

  _shouldUseCompactLayout(width = Math.round(this._cardWidth || this.clientWidth || 0)) {
    return window.NodaliaUtils.shouldUseCompactCardLayout({
      mode: this._config?.compact_layout_mode,
      width,
      gridColumns: this._getConfiguredGridColumns(),
    });
  }

  _shouldShowCompactTitle(width = Math.round(this._cardWidth || this.clientWidth || 0)) {
    return window.NodaliaUtils.shouldShowCompactCardTitle({ width });
  }

  _triggerHaptic(style = this._config?.haptics?.style) {
    if (!this._config?.haptics?.enabled) {
      return;
    }

    const hapticStyle = String(style || "medium");

    try {
      fireEvent(this, "haptic", hapticStyle);
    } catch (_error) {
      // Ignore event dispatch issues and try vibration fallback below.
    }

    if (
      !this._config.haptics.fallback_vibrate ||
      typeof navigator === "undefined" ||
      typeof navigator.vibrate !== "function"
    ) {
      return;
    }

    navigator.vibrate(HAPTIC_PATTERNS[hapticStyle] || HAPTIC_PATTERNS.selection);
  }

  _getState() {
    const actualState = this._getActualState();
    if (this._isOptimisticTurnOffPending(actualState)) {
      return this._buildOptimisticTurnOffState(actualState);
    }

    if (this._isOptimisticTurnOnPending(actualState)) {
      return this._buildOptimisticTurnOnState(actualState);
    }

    if (this._shouldUseOptimisticVisualSettle(actualState)) {
      return this._buildOptimisticVisualSettleState(actualState);
    }

    return actualState;
  }

  _getActualState() {
    if (!this._config?.entity || !this._hass?.states) {
      return null;
    }

    return this._hass.states[this._config.entity] || null;
  }

  _createStateSnapshot(state) {
    if (!state) {
      return null;
    }

    return {
      ...state,
      attributes: {
        ...(state.attributes || {}),
      },
    };
  }

  _getStoredLightMemory() {
    if (typeof window === "undefined" || !window.localStorage) {
      return {};
    }

    try {
      const parsed = JSON.parse(window.localStorage.getItem(LIGHT_MEMORY_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  _storeLightMemory(entityId, snapshot) {
    if (!entityId || !snapshot || typeof window === "undefined" || !window.localStorage) {
      return;
    }

    const attrs = snapshot.attributes || {};
    const hasVisualAttrs =
      Array.isArray(attrs.rgb_color) ||
      Array.isArray(attrs.hs_color) ||
      typeof attrs.color_temp_kelvin === "number" ||
      typeof attrs.color_temp === "number" ||
      typeof attrs.brightness === "number";

    if (!hasVisualAttrs) {
      return;
    }

    try {
      const memory = this._getStoredLightMemory();
      memory[entityId] = {
        attributes: {
          brightness: attrs.brightness,
          color_temp: attrs.color_temp,
          color_temp_kelvin: attrs.color_temp_kelvin,
          hs_color: Array.isArray(attrs.hs_color) ? [...attrs.hs_color] : undefined,
          rgb_color: Array.isArray(attrs.rgb_color) ? [...attrs.rgb_color] : undefined,
        },
        last_changed: snapshot.last_changed || new Date().toISOString(),
      };
      window.localStorage.setItem(LIGHT_MEMORY_STORAGE_KEY, JSON.stringify(memory));
    } catch (_error) {
      // Storage may be unavailable in private mode; the in-memory cache still works.
    }
  }

  _getStoredLightSnapshot(entityId = this._config?.entity || "") {
    if (!entityId) {
      return null;
    }

    const stored = this._getStoredLightMemory()[entityId];
    if (!stored?.attributes || typeof stored.attributes !== "object") {
      return null;
    }

    return {
      entity_id: entityId,
      state: "on",
      attributes: {
        ...(stored.attributes || {}),
      },
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
      this._storeLightMemory(entityId, snapshot);
      return;
    }

    const attrs = actualState.attributes || {};
    if (
      Array.isArray(attrs.rgb_color) ||
      Array.isArray(attrs.hs_color) ||
      typeof attrs.color_temp_kelvin === "number" ||
      typeof attrs.color_temp === "number" ||
      typeof attrs.brightness === "number"
    ) {
      this._lastKnownOnState.set(entityId, {
        ...snapshot,
        state: "on",
      });
      this._storeLightMemory(entityId, snapshot);
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

    const stored = this._getStoredLightSnapshot(entityId);
    if (stored) {
      this._lastKnownOnState.set(entityId, this._createStateSnapshot(stored));
    }

    return stored;
  }

  _clearDraftValues(entityId = this._config?.entity) {
    if (!entityId) {
      return;
    }

    this._draftBrightness.delete(entityId);
    this._draftTemperature.delete(entityId);
    this._draftHue.delete(entityId);
  }

  _clearOptimisticTurnOnTimer() {
    if (this._optimisticTurnOnTimer) {
      window.clearTimeout(this._optimisticTurnOnTimer);
      this._optimisticTurnOnTimer = 0;
    }
  }

  _clearOptimisticTurnOnState(options = {}) {
    const clearDrafts = options.clearDrafts === true;
    const entityId = this._optimisticTurnOn?.entityId || this._config?.entity;

    this._clearOptimisticTurnOnTimer();
    this._optimisticTurnOn = null;

    if (clearDrafts) {
      this._clearDraftValues(entityId);
    }
  }

  _startOptimisticVisualSettle(actualState, optimisticState) {
    const entityId = this._config?.entity || "";
    if (!entityId || !actualState || actualState.state !== "on" || !optimisticState) {
      this._optimisticVisualSettle = null;
      return;
    }

    this._optimisticVisualSettle = {
      entityId,
      expiresAt: Date.now() + OPTIMISTIC_VISUAL_SETTLE_MS,
      stateSnapshot: this._createStateSnapshot(optimisticState),
    };
  }

  _hasUsefulColorAttributes(state) {
    const attrs = state?.attributes || {};
    return (
      Array.isArray(attrs.rgb_color) ||
      Array.isArray(attrs.hs_color) ||
      typeof attrs.color_temp_kelvin === "number" ||
      typeof attrs.color_temp === "number"
    );
  }

  _shouldUseOptimisticVisualSettle(actualState = this._getActualState()) {
    if (!this._optimisticVisualSettle) {
      return false;
    }

    if (this._optimisticVisualSettle.entityId !== (this._config?.entity || "")) {
      this._optimisticVisualSettle = null;
      return false;
    }

    if (actualState?.state !== "on" || Date.now() >= this._optimisticVisualSettle.expiresAt) {
      this._optimisticVisualSettle = null;
      return false;
    }

    const settledSnapshot = this._optimisticVisualSettle.stateSnapshot;
    if (this._hasUsefulColorAttributes(actualState) && this._hasUsefulColorAttributes(settledSnapshot)) {
      this._optimisticVisualSettle = null;
      return false;
    }

    return true;
  }

  _buildOptimisticVisualSettleState(actualState = this._getActualState()) {
    const snapshot = this._optimisticVisualSettle?.stateSnapshot;
    if (!actualState || !snapshot) {
      return actualState;
    }

    return {
      ...actualState,
      attributes: {
        ...(snapshot.attributes || {}),
        ...(actualState.attributes || {}),
        rgb_color: actualState.attributes?.rgb_color || snapshot.attributes?.rgb_color,
        hs_color: actualState.attributes?.hs_color || snapshot.attributes?.hs_color,
        color_temp_kelvin: actualState.attributes?.color_temp_kelvin ?? snapshot.attributes?.color_temp_kelvin,
        color_temp: actualState.attributes?.color_temp ?? snapshot.attributes?.color_temp,
        brightness: actualState.attributes?.brightness ?? snapshot.attributes?.brightness,
      },
    };
  }

  _clearOptimisticTurnOffTimer() {
    if (this._optimisticTurnOffTimer) {
      window.clearTimeout(this._optimisticTurnOffTimer);
      this._optimisticTurnOffTimer = 0;
    }
  }

  _clearOptimisticTurnOffState() {
    this._clearOptimisticTurnOffTimer();
    this._optimisticTurnOff = null;
  }

  _isOptimisticTurnOnPending(actualState = this._getActualState()) {
    const entityId = this._config?.entity || "";
    if (!entityId || !this._optimisticTurnOn || this._optimisticTurnOn.entityId !== entityId) {
      return false;
    }

    if (actualState?.state === "on") {
      return false;
    }

    return Date.now() < this._optimisticTurnOn.expiresAt;
  }

  _scheduleOptimisticTurnOnTimeout() {
    this._clearOptimisticTurnOnTimer();

    if (!this._optimisticTurnOn) {
      return;
    }

    const remaining = Math.max(0, this._optimisticTurnOn.expiresAt - Date.now());
    if (!remaining || typeof window === "undefined") {
      if (this._isOptimisticTurnOnPending(this._getActualState())) {
        this._flushOptimisticTurnOnQueue();
      }
      if (!this.isConnected) {
        return;
      }
      this._clearOptimisticTurnOnState({ clearDrafts: true });
      this._render();
      return;
    }

    this._optimisticTurnOnTimer = window.setTimeout(() => {
      this._optimisticTurnOnTimer = 0;
      if (!this.isConnected) {
        return;
      }

      if (!this._isOptimisticTurnOnPending(this._getActualState())) {
        return;
      }

      this._flushOptimisticTurnOnQueue();
      this._clearOptimisticTurnOnState({ clearDrafts: true });
      this._render();
    }, remaining);
  }

  _startOptimisticTurnOn(actualState = this._getActualState()) {
    if (!this._config?.entity) {
      return;
    }

    const cachedState = this._getLastKnownOnState(this._config.entity);
    this._optimisticTurnOn = {
      entityId: this._config.entity,
      expiresAt: Date.now() + OPTIMISTIC_TURN_ON_TIMEOUT,
      queuedData: {},
      stateSnapshot: this._createStateSnapshot(cachedState || actualState),
    };

    this._scheduleOptimisticTurnOnTimeout();
  }

  _queueOptimisticTurnOnChange(data = {}) {
    if (!this._isOptimisticTurnOnPending(this._getActualState()) || !this._optimisticTurnOn) {
      return false;
    }

    const nextQueuedData = {
      ...(this._optimisticTurnOn.queuedData || {}),
    };

    if (Object.prototype.hasOwnProperty.call(data, "hs_color")) {
      delete nextQueuedData.color_temp_kelvin;
    }

    if (Object.prototype.hasOwnProperty.call(data, "color_temp_kelvin")) {
      delete nextQueuedData.hs_color;
    }

    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined) {
        delete nextQueuedData[key];
        return;
      }

      nextQueuedData[key] = Array.isArray(value) ? [...value] : value;
    });

    this._optimisticTurnOn.queuedData = nextQueuedData;
    return true;
  }

  _buildOptimisticTurnOnState(actualState = this._getActualState()) {
    const snapshot = this._optimisticTurnOn?.stateSnapshot || this._getLastKnownOnState() || null;
    const baseState = snapshot || actualState;
    if (!baseState) {
      return actualState;
    }

    const entityId = this._config?.entity || "";
    const attrs = {
      ...(baseState.attributes || {}),
    };

    if (entityId && this._draftBrightness.has(entityId)) {
      attrs.brightness = clamp(Math.round((Number(this._draftBrightness.get(entityId)) / 100) * 255), 1, 255);
    }

    if (entityId && this._draftTemperature.has(entityId)) {
      const nextKelvin = clamp(Math.round(Number(this._draftTemperature.get(entityId))), 1, 100000);
      attrs.color_temp_kelvin = nextKelvin;
      attrs.color_temp = kelvinToMired(nextKelvin);
    }

    if (entityId && this._draftHue.has(entityId)) {
      attrs.hs_color = [
        clamp(Math.round(Number(this._draftHue.get(entityId))), 0, 360),
        Math.max(this._getCurrentSaturation(baseState), 50),
      ];
    }

    return {
      ...baseState,
      state: "on",
      attributes: {
        ...attrs,
        _nodalia_optimistic_on: true,
      },
    };
  }

  _flushOptimisticTurnOnQueue() {
    const queuedData = this._optimisticTurnOn?.queuedData || {};
    if (!Object.keys(queuedData).length) {
      return;
    }

    this._setLightState(queuedData);
  }

  _syncOptimisticTurnOnState(actualState) {
    if (!this._optimisticTurnOn) {
      return;
    }

    if (this._optimisticTurnOn.entityId !== (this._config?.entity || "")) {
      this._clearOptimisticTurnOnState();
      return;
    }

    if (actualState?.state === "on") {
      const optimisticState = this._buildOptimisticTurnOnState(actualState);
      const queuedData = {
        ...(this._optimisticTurnOn.queuedData || {}),
      };
      this._clearOptimisticTurnOnState();
      this._startOptimisticVisualSettle(actualState, optimisticState);

      if (Object.keys(queuedData).length) {
        this._setLightState(queuedData);
      }
      return;
    }

    if (["unavailable", "unknown"].includes(actualState?.state)) {
      this._clearOptimisticTurnOnState({ clearDrafts: true });
      return;
    }

    if (!this._isOptimisticTurnOnPending(actualState)) {
      this._clearOptimisticTurnOnState({ clearDrafts: true });
      return;
    }

    this._scheduleOptimisticTurnOnTimeout();
  }

  _isOptimisticTurnOffPending(actualState = this._getActualState()) {
    const entityId = this._config?.entity || "";
    if (!entityId || !this._optimisticTurnOff || this._optimisticTurnOff.entityId !== entityId) {
      return false;
    }

    if (actualState?.state === "off") {
      return false;
    }

    return Date.now() < this._optimisticTurnOff.expiresAt;
  }

  _scheduleOptimisticTurnOffTimeout() {
    this._clearOptimisticTurnOffTimer();

    if (!this._optimisticTurnOff) {
      return;
    }

    const remaining = Math.max(0, this._optimisticTurnOff.expiresAt - Date.now());
    if (!remaining || typeof window === "undefined") {
      if (!this.isConnected) {
        return;
      }
      this._clearOptimisticTurnOffState();
      this._render();
      return;
    }

    this._optimisticTurnOffTimer = window.setTimeout(() => {
      this._optimisticTurnOffTimer = 0;
      if (!this.isConnected) {
        return;
      }

      if (!this._isOptimisticTurnOffPending(this._getActualState())) {
        return;
      }

      this._clearOptimisticTurnOffState();
      this._render();
    }, remaining);
  }

  _startOptimisticTurnOff(actualState = this._getActualState()) {
    if (!this._config?.entity) {
      return;
    }

    const stateSnapshotSource = actualState?.state === "on"
      ? actualState
      : this._getLastKnownOnState(this._config.entity) || actualState;

    this._optimisticTurnOff = {
      entityId: this._config.entity,
      expiresAt: Date.now() + OPTIMISTIC_TURN_OFF_TIMEOUT,
      stateSnapshot: this._createStateSnapshot(stateSnapshotSource),
    };

    this._scheduleOptimisticTurnOffTimeout();
  }

  _buildOptimisticTurnOffState(actualState = this._getActualState()) {
    const baseState = this._optimisticTurnOff?.stateSnapshot || actualState || this._getLastKnownOnState();
    if (!baseState) {
      return actualState;
    }

    return {
      ...baseState,
      state: "off",
      attributes: {
        ...(baseState.attributes || {}),
        _nodalia_optimistic_off: true,
      },
    };
  }

  _syncOptimisticTurnOffState(actualState) {
    if (!this._optimisticTurnOff) {
      return;
    }

    if (this._optimisticTurnOff.entityId !== (this._config?.entity || "")) {
      this._clearOptimisticTurnOffState();
      return;
    }

    if (actualState?.state === "off") {
      this._clearOptimisticTurnOffState();
      return;
    }

    if (["unavailable", "unknown"].includes(actualState?.state)) {
      this._clearOptimisticTurnOffState();
      return;
    }

    if (!this._isOptimisticTurnOffPending(actualState)) {
      this._clearOptimisticTurnOffState();
      return;
    }

    this._scheduleOptimisticTurnOffTimeout();
  }

  _supportsBrightness(state) {
    if (typeof state?.attributes?.brightness === "number") {
      return true;
    }

    const supportedColorModes = Array.isArray(state?.attributes?.supported_color_modes)
      ? state.attributes.supported_color_modes
      : [];

    return supportedColorModes.some(mode =>
      ["brightness", "color_temp", "hs", "rgb", "rgbw", "rgbww", "xy", "white"].includes(mode),
    );
  }

  _supportsColor(state) {
    const supportedColorModes = Array.isArray(state?.attributes?.supported_color_modes)
      ? state.attributes.supported_color_modes
      : [];

    return supportedColorModes.some(mode =>
      ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(mode),
    );
  }

  _supportsColorTemperature(state) {
    const supportedColorModes = Array.isArray(state?.attributes?.supported_color_modes)
      ? state.attributes.supported_color_modes
      : [];

    return (
      supportedColorModes.includes("color_temp") ||
      typeof state?.attributes?.color_temp_kelvin === "number" ||
      typeof state?.attributes?.color_temp === "number"
    );
  }

  _getBrightnessPercent(state) {
    const entityId = this._config?.entity;
    if (entityId && this._draftBrightness.has(entityId)) {
      return clamp(Number(this._draftBrightness.get(entityId)), 1, 100);
    }

    if (typeof state?.attributes?.brightness === "number") {
      return clamp(Math.round((state.attributes.brightness / 255) * 100), 1, 100);
    }

    return state?.state === "on" ? 100 : 50;
  }

  _getTemperatureRange(state) {
    const minKelvin = Number(state?.attributes?.min_color_temp_kelvin);
    const maxKelvin = Number(state?.attributes?.max_color_temp_kelvin);

    if (Number.isFinite(minKelvin) && Number.isFinite(maxKelvin) && minKelvin > 0 && maxKelvin > 0) {
      return {
        min: Math.min(minKelvin, maxKelvin),
        max: Math.max(minKelvin, maxKelvin),
      };
    }

    const minMireds = Number(state?.attributes?.min_mireds);
    const maxMireds = Number(state?.attributes?.max_mireds);

    if (Number.isFinite(minMireds) && Number.isFinite(maxMireds) && minMireds > 0 && maxMireds > 0) {
      const min = miredToKelvin(Math.max(minMireds, maxMireds));
      const max = miredToKelvin(Math.min(minMireds, maxMireds));
      return {
        min: Math.min(min, max),
        max: Math.max(min, max),
      };
    }

    return {
      min: 2200,
      max: 6500,
    };
  }

  _getTemperatureControlDomain(state) {
    const minMireds = Number(state?.attributes?.min_mireds);
    const maxMireds = Number(state?.attributes?.max_mireds);

    if (Number.isFinite(minMireds) && Number.isFinite(maxMireds) && minMireds > 0 && maxMireds > 0) {
      return {
        unit: "mired",
        min: Math.min(minMireds, maxMireds),
        max: Math.max(minMireds, maxMireds),
        step: 1,
      };
    }

    const range = this._getTemperatureRange(state);
    return {
      unit: "kelvin",
      min: range.min,
      max: range.max,
      step: 25,
    };
  }

  _temperatureSliderValueToKelvin(value, state) {
    const domain = this._getTemperatureControlDomain(state);
    const boundedValue = clamp(Math.round(Number(value)), domain.min, domain.max);
    return domain.unit === "mired" ? miredToKelvin(boundedValue) : boundedValue;
  }

  _kelvinToTemperatureSliderValue(kelvin, state) {
    const domain = this._getTemperatureControlDomain(state);
    const numericKelvin = clamp(Math.round(Number(kelvin)), 1, 100000);
    const nextValue = domain.unit === "mired" ? kelvinToMired(numericKelvin) : numericKelvin;
    return clamp(Math.round(nextValue), domain.min, domain.max);
  }

  _getCurrentKelvin(state) {
    const entityId = this._config?.entity;
    if (entityId && this._draftTemperature.has(entityId)) {
      return this._draftTemperature.get(entityId);
    }

    if (typeof state?.attributes?.color_temp_kelvin === "number") {
      return Math.round(state.attributes.color_temp_kelvin);
    }

    if (typeof state?.attributes?.color_temp === "number") {
      return miredToKelvin(state.attributes.color_temp);
    }

    const range = this._getTemperatureRange(state);
    return Math.round((range.min + range.max) / 2);
  }

  _getCurrentHue(state) {
    const entityId = this._config?.entity;
    if (entityId && this._draftHue.has(entityId)) {
      return this._draftHue.get(entityId);
    }

    const hsColor = Array.isArray(state?.attributes?.hs_color) ? state.attributes.hs_color : null;
    if (hsColor?.length === 2 && hsColor.every(value => Number.isFinite(Number(value)))) {
      return clamp(Math.round(Number(hsColor[0])), 0, 360);
    }

    const rgbColor = Array.isArray(state?.attributes?.rgb_color) ? state.attributes.rgb_color : null;
    const derivedHs = rgbToHs(rgbColor);
    if (derivedHs) {
      return clamp(derivedHs[0], 0, 360);
    }

    return 42;
  }

  _getCurrentSaturation(state) {
    const hsColor = Array.isArray(state?.attributes?.hs_color) ? state.attributes.hs_color : null;
    if (hsColor?.length === 2 && hsColor.every(value => Number.isFinite(Number(value)))) {
      return clamp(Math.round(Number(hsColor[1])), 0, 100);
    }

    const rgbColor = Array.isArray(state?.attributes?.rgb_color) ? state.attributes.rgb_color : null;
    const derivedHs = rgbToHs(rgbColor);
    if (derivedHs) {
      return clamp(derivedHs[1], 0, 100);
    }

    return 75;
  }

  _getTemperaturePresets(state) {
    const range = this._getTemperatureRange(state);
    const middle = Math.round((range.min + range.max) / 2);

    return [
      { label: this._lightCardUi("temperaturePresets.warm", "Warm"), kelvin: range.min },
      { label: this._lightCardUi("temperaturePresets.neutral", "Neutral"), kelvin: middle },
      { label: this._lightCardUi("temperaturePresets.cool", "Cool"), kelvin: range.max },
    ];
  }

  _getStateLabel(state) {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const entityStates = window.NodaliaI18n?.strings?.(lang)?.entityCard?.states;

    if (state?.attributes?._nodalia_optimistic_off === true) {
      return entityStates?.closing || "Apagando";
    }

    if (state?.attributes?._nodalia_optimistic_on === true) {
      return entityStates?.opening || "Turning on";
    }

    switch (state?.state) {
      case "on":
        return entityStates?.on || "On";
      case "off":
        return entityStates?.off || "Off";
      case "unavailable":
        return entityStates?.unavailable || "Unavailable";
      case "unknown":
        return entityStates?.unknown || "Unknown";
      default:
        return state?.state ? String(state.state) : (window.NodaliaI18n?.strings?.(lang)?.alarmPanel?.noState || "No state");
    }
  }

  _getLightName(state) {
    if (this._config?.name) {
      return this._config.name;
    }

    if (state?.attributes?.friendly_name) {
      return state.attributes.friendly_name;
    }

    return this._config?.entity || "Luz";
  }

  _getLightIcon(state) {
    return this._config?.icon || state?.attributes?.icon || "mdi:lightbulb";
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

  _getAccentColor(state) {
    const rgbColor = Array.isArray(state?.attributes?.rgb_color) ? state.attributes.rgb_color : null;
    if (state?.state === "on" && rgbColor?.length === 3) {
      return `rgb(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]})`;
    }

    if (state?.state === "on") {
      const kelvin = this._getCurrentKelvin(state);
      if (kelvin >= 5200) {
        return "#8fd3ff";
      }

      if (kelvin <= 3000) {
        return "#f4b55f";
      }

      return "#ffd166";
    }

    return this._config?.styles?.icon?.off_color || "var(--primary-text-color)";
  }

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;
    return {
      enabled: configuredAnimations.enabled !== false,
      powerDuration: clamp(Number(configuredAnimations.power_duration) || DEFAULT_CONFIG.animations.power_duration, 120, 4000),
      controlsDuration: clamp(Number(configuredAnimations.controls_duration) || DEFAULT_CONFIG.animations.controls_duration, 120, 2400),
      modeSwitchDuration: clamp(Number(configuredAnimations.mode_switch_duration) || DEFAULT_CONFIG.animations.mode_switch_duration, 120, 2400),
      buttonBounceDuration: clamp(Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration, 120, 1200),
      modeSwitchHorizontal: configuredAnimations.mode_switch_horizontal !== false,
    };
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
      const shouldFinalizeRender = Boolean(this._powerTransition || this._controlsTransition);
      this._powerTransition = null;
      this._controlsTransition = null;
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

  _clearModeSwitchTransition() {
    if (this._modeSwitchTimer) {
      window.clearTimeout(this._modeSwitchTimer);
      this._modeSwitchTimer = 0;
    }

    if (this._modeSwitchPressTimer) {
      window.clearTimeout(this._modeSwitchPressTimer);
      this._modeSwitchPressTimer = 0;
    }

    this._modeTransition = null;
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

  _startModeSwitchTransition(nextMode, state = this._getState()) {
    const animations = this._getAnimationSettings();
    const availableModes = this._getAvailableControlModes(state);
    const currentMode = this._getActiveControlMode(state);

    if (
      !animations.enabled ||
      !state ||
      !nextMode ||
      nextMode === currentMode ||
      !availableModes.includes(nextMode) ||
      !availableModes.includes(currentMode)
    ) {
      this._clearModeSwitchTransition();
      this._activeControlMode = nextMode || currentMode || "brightness";
      this._render();
      return;
    }

    this._clearModeSwitchTransition();

    const phaseDuration = Math.max(100, Math.round(animations.modeSwitchDuration / 2));
    const settleDuration = phaseDuration + 34;
    const fromMode = currentMode;
    const toMode = nextMode;

    this._modeTransition = {
      from: fromMode,
      to: toMode,
      phase: "collapsing",
    };
    this._render();

    this._modeSwitchTimer = window.setTimeout(() => {
      this._modeSwitchTimer = 0;
      this._activeControlMode = toMode;
      this._modeTransition = {
        from: fromMode,
        to: toMode,
        phase: "expanding",
      };
      this._render();

      this._modeSwitchTimer = window.setTimeout(() => {
        this._modeSwitchTimer = 0;

        const finalizeTransition = () => {
          if (!this.isConnected) {
            return;
          }
          if (
            !this._modeTransition ||
            this._modeTransition.phase !== "expanding" ||
            this._modeTransition.to !== toMode
          ) {
            return;
          }

          this._modeTransition = null;
          this._render();
        };

        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(finalizeTransition);
          });
          return;
        }

        finalizeTransition();
      }, settleDuration);
    }, phaseDuration);
  }

  _setLightState(data = {}) {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    this._hass.callService("light", "turn_on", {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _setLightOff() {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    this._hass.callService("light", "turn_off", {
      entity_id: this._config.entity,
    });
  }

  _isLightToggleableState(state) {
    const key = String(state?.state || "").trim().toLowerCase();
    return key === "on" || key === "off";
  }

  _resolveTapEffect(zone) {
    const raw =
      zone === "icon"
        ? this._config?.icon_tap_action || "toggle"
        : this._config?.tap_action || "toggle";
    let effect = String(raw || "toggle").trim().toLowerCase();
    const allowed = new Set(["auto", "toggle", "more-info", "service", "navigate", "url", "none"]);
    if (!allowed.has(effect)) {
      effect = "toggle";
    }
    if (effect === "auto") {
      const state = this._getState();
      return this._isLightToggleableState(state) ? "toggle" : "more-info";
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
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Light Card", serviceValue);
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

  _executeTapEffect(zone, effect) {
    const isIcon = zone === "icon";
    switch (effect) {
      case "toggle":
        this._toggleLight();
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
        this._openConfiguredUrl(isIcon ? this._config?.icon_tap_url : this._config?.tap_url, isIcon ? this._config?.icon_tap_new_tab === true : this._config?.tap_new_tab === true);
        break;
      case "none":
      default:
        break;
    }
  }

  _resolveHoldEffect(zone) {
    const inheritIcon = zone === "icon" && String(this._config?.icon_hold_action ?? "").trim() === "";
    const raw = inheritIcon
      ? String(this._config?.hold_action ?? "none").trim()
      : String((zone === "icon" ? this._config?.icon_hold_action : this._config?.hold_action) ?? "none").trim();
    let effect = raw.toLowerCase();
    const allowed = new Set(["auto", "toggle", "more-info", "service", "navigate", "url", "none"]);
    if (!allowed.has(effect)) {
      effect = "none";
    }
    if (effect === "auto") {
      const state = this._getState();
      return this._isLightToggleableState(state) ? "toggle" : "more-info";
    }
    return effect;
  }

  _executeHoldEffect(zone, effect) {
    const isIcon = zone === "icon";
    switch (effect) {
      case "toggle":
        this._toggleLight();
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

  _toggleLight() {
    const actualState = this._getActualState();
    const effectiveState = this._getState();
    if (!this._hass || !this._config?.entity) {
      return;
    }

    if (effectiveState?.state === "on") {
      const shouldClearDrafts = this._isOptimisticTurnOnPending(actualState);
      this._clearOptimisticTurnOnState({ clearDrafts: shouldClearDrafts });
      if (actualState?.state === "on" || shouldClearDrafts) {
        this._startOptimisticTurnOff(actualState);
      }
      this._setLightOff();
      this._render();
      return;
    }

    const wasOptimisticallyTurningOff = this._isOptimisticTurnOffPending(actualState);
    this._clearOptimisticTurnOffState();
    if (wasOptimisticallyTurningOff && actualState?.state === "on") {
      this._startOptimisticTurnOn(actualState);
      this._setLightState();
      this._render();
      return;
    }

    this._startOptimisticTurnOn(actualState);
    this._setLightState();
    this._render();
  }

  _commitBrightness(percent) {
    const nextBrightness = clamp(Math.round(Number(percent)), 1, 100);
    if (!Number.isFinite(nextBrightness)) {
      return;
    }

    if (this._queueOptimisticTurnOnChange({ brightness_pct: nextBrightness })) {
      return;
    }

    this._setLightState({
      brightness_pct: nextBrightness,
    });
  }

  _commitColorPreset(hs) {
    if (this._queueOptimisticTurnOnChange({ hs_color: hs })) {
      return;
    }

    this._setLightState({
      hs_color: hs,
    });
  }

  _commitColorHue(hue, state) {
    const numericHue = clamp(Math.round(Number(hue)), 0, 360);
    if (!Number.isFinite(numericHue)) {
      return;
    }

    const saturation = Math.max(this._getCurrentSaturation(state), 50);
    if (this._queueOptimisticTurnOnChange({ hs_color: [numericHue, saturation] })) {
      return;
    }

    this._setLightState({
      hs_color: [numericHue, saturation],
    });
  }

  _commitTemperaturePreset(kelvin) {
    const range = this._getTemperatureRange(this._getState());
    const numericKelvin = clamp(Math.round(Number(kelvin)), range.min, range.max);
    if (!Number.isFinite(numericKelvin) || numericKelvin <= 0) {
      return;
    }

    if (this._queueOptimisticTurnOnChange({ color_temp_kelvin: numericKelvin })) {
      return;
    }

    this._setLightState({
      color_temp_kelvin: numericKelvin,
    });
  }

  _updateBrightnessPreview(value) {
    const slider = this.shadowRoot?.querySelector('.light-card__slider[data-light-control="brightness"]');
    const nextValue = clamp(Number(value), 1, 100);

    if (slider instanceof HTMLInputElement) {
      slider.style.setProperty("--brightness", String(nextValue));
      slider.closest(".light-card__slider-shell")?.style.setProperty("--brightness", String(nextValue));
    }
  }

  _updateTemperaturePreview(value, state) {
    const slider = this.shadowRoot?.querySelector('.light-card__slider[data-light-control="temperature"]');
    const domain = this._getTemperatureControlDomain(state);
    const boundedValue = clamp(Number(value), domain.min, domain.max);
    const percent = domain.max === domain.min
      ? 0
      : ((boundedValue - domain.min) / (domain.max - domain.min)) * 100;

    if (slider instanceof HTMLInputElement) {
      slider.style.setProperty("--temperature-progress", String(clamp(percent, 0, 100)));
      slider.closest(".light-card__slider-shell")?.style.setProperty("--temperature-progress", String(clamp(percent, 0, 100)));
    }
  }

  _updateColorPreview(value) {
    const slider = this.shadowRoot?.querySelector('.light-card__slider[data-light-control="color"]');
    const nextValue = clamp(Math.round(Number(value)), 0, 360);
    const percent = (nextValue / 360) * 100;

    if (slider instanceof HTMLInputElement) {
      slider.style.setProperty("--color-progress", String(clamp(percent, 0, 100)));
      slider.closest(".light-card__slider-shell")?.style.setProperty("--color-progress", String(clamp(percent, 0, 100)));
    }
  }

  _patchLightActiveChip(sliderKind, text) {
    const chip = this.shadowRoot?.querySelector(`[data-light-chip="${escapeSelectorValue(sliderKind)}"]`);
    if (chip instanceof HTMLElement) {
      chip.textContent = text;
    }
  }

  _hapticOnSliderStep(kind, steppedValue, { commit = false } = {}) {
    if (this._config?.haptics?.scrolls?.[kind] === false) {
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

  _lightSliderHapticStep(kind, value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return Number.NaN;
    }
    // Hue spans 360 units — tick every 5° so scrolls stay tactile without buzzing constantly.
    if (kind === "color") {
      return Math.round(numeric / 5) * 5;
    }
    return Math.round(numeric);
  }

  _applySliderValue(slider, value, options = {}) {
    const commit = options.commit === true;
    const kind = slider.dataset.lightControl;

    switch (kind) {
      case "brightness": {
        const nextValue = clamp(Number(value), 1, 100);
        this._draftBrightness.set(this._config.entity, nextValue);
        this._updateBrightnessPreview(nextValue);
        this._patchLightActiveChip("brightness", `${Math.round(nextValue)}%`);
        this._hapticOnSliderStep(kind, this._lightSliderHapticStep(kind, nextValue), { commit });
        if (commit) {
          this._commitBrightness(nextValue);
        }
        break;
      }
      case "temperature": {
        const state = this._getState();
        const domain = this._getTemperatureControlDomain(state);
        const nextValue = clamp(Number(value), domain.min, domain.max);
        const nextKelvin = this._temperatureSliderValueToKelvin(nextValue, state);
        this._draftTemperature.set(this._config.entity, nextKelvin);
        this._updateTemperaturePreview(nextValue, state);
        this._patchLightActiveChip("temperature", `${nextKelvin}K`);
        this._hapticOnSliderStep(kind, this._lightSliderHapticStep(kind, nextKelvin), { commit });
        if (commit) {
          this._commitTemperaturePreset(nextKelvin);
        }
        break;
      }
      case "color": {
        const state = this._getState();
        const nextValue = clamp(Math.round(Number(value)), 0, 360);
        this._draftHue.set(this._config.entity, nextValue);
        this._updateColorPreview(nextValue);
        this._patchLightActiveChip("color", `${nextValue}°`);
        this._hapticOnSliderStep(kind, this._lightSliderHapticStep(kind, nextValue), { commit });
        if (commit) {
          this._commitColorHue(nextValue, state);
        }
        break;
      }
      default:
        break;
    }
  }

  _onShadowPointerDown(event) {
    const slider = event
      .composedPath()
      .find(node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.lightControl,
      );

    if (this._activeSliderDrag || !slider || (typeof event.button === "number" && event.button !== 0)) {
      return;
    }

    this._startSliderDrag(slider, event.clientX, event, event.pointerId);
  }

  _queueSliderDragUpdate(slider, clientX) {
    const nextValue = getRangeValueFromGeometry(this._activeSliderDrag?.geometry, slider.value, clientX);
    slider.value = String(nextValue);
    this._applySliderValue(slider, nextValue, { commit: false });
  }

  _setSliderDragVisualState(slider, isDragging) {
    const sliderShell = slider?.closest?.(".light-card__slider-shell");
    if (!(sliderShell instanceof HTMLElement)) {
      return;
    }

    sliderShell.classList.toggle("is-dragging", isDragging === true);
  }

  _startSliderDrag(slider, clientX, event = null, pointerId = null) {
    if (!slider) {
      return;
    }

    const kind = slider.dataset.lightControl;
    const seedValue = kind === "temperature"
      ? this._temperatureSliderValueToKelvin(Number(slider.value), this._getState())
      : Number(slider.value);
    this._activeSliderDrag = {
      pointerId,
      slider,
      geometry: getSliderDragGeometry(slider),
      lastHapticValue: this._lightSliderHapticStep(kind, seedValue),
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

    this._setSliderDragVisualState(slider, true);
    const nextValue = getRangeValueFromGeometry(this._activeSliderDrag.geometry, slider.value, clientX);
    slider.value = String(nextValue);
    this._applySliderValue(slider, nextValue, { commit: false });
  }

  _commitSliderDrag(clientX, event = null, pointerId = null) {
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

    const nextValue = getRangeValueFromGeometry(drag.geometry, drag.slider.value, clientX);
    drag.slider.value = String(nextValue);
    this._skipNextSliderChange = drag.slider;
    this._applySliderValue(drag.slider, nextValue, { commit: true });
    this._setSliderDragVisualState(drag.slider, false);

    this._activeSliderDrag = null;
    this._detachWindowDragListeners();
    this._suppressNextLightTap = true;

    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }

  _onShadowMouseDown(event) {
    const slider = event
      .composedPath()
      .find(node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.lightControl,
      );

    if (this._activeSliderDrag || !slider || event.button !== 0) {
      return;
    }

    this._startSliderDrag(slider, event.clientX, event);
  }

  _onShadowTouchStart(event) {
    const slider = event
      .composedPath()
      .find(node =>
        node instanceof HTMLInputElement &&
        node.type === "range" &&
        node.dataset?.lightControl,
      );

    if (this._activeSliderDrag || !slider || !event.touches?.length) {
      return;
    }

    this._startSliderDrag(slider, event.touches[0].clientX, event);
  }

  _onWindowPointerMove(event) {
    const drag = this._activeSliderDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(drag.slider, event.clientX);
  }

  _onWindowPointerUp(event) {
    const drag = this._activeSliderDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    this._commitSliderDrag(event.clientX, event, event.pointerId);
  }

  _onWindowMouseMove(event) {
    if (!this._activeSliderDrag || (typeof event.buttons === "number" && (event.buttons & 1) === 0)) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(this._activeSliderDrag.slider, event.clientX);
  }

  _onWindowMouseUp(event) {
    if (!this._activeSliderDrag) {
      return;
    }

    this._commitSliderDrag(event.clientX, event);
  }

  _onWindowTouchMove(event) {
    if (!this._activeSliderDrag || !event.touches?.length) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(this._activeSliderDrag.slider, event.touches[0].clientX);
  }

  _onWindowTouchStartCapture(event) {
    const drag = this._activeSliderDrag;
    if (!drag) {
      return;
    }

    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (path.includes(drag.slider)) {
      return;
    }

    this._setSliderDragVisualState(drag.slider, false);
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

    const clientX = event.changedTouches?.[0]?.clientX;
    if (!Number.isFinite(clientX)) {
      this._setSliderDragVisualState(this._activeSliderDrag.slider, false);
      this._activeSliderDrag = null;
      this._detachWindowDragListeners();
      if (this._pendingRenderAfterDrag) {
        this._pendingRenderAfterDrag = false;
        this._render();
      }
      return;
    }

    this._commitSliderDrag(clientX, event);
  }

  _attachWindowDragListeners() {
    if (this._dragWindowListenersAttached) {
      return;
    }
    this._dragWindowListenersAttached = true;
    window.addEventListener("pointermove", this._onWindowPointerMove);
    window.addEventListener("pointerup", this._onWindowPointerUp);
    window.addEventListener("pointercancel", this._onWindowPointerUp);
    window.addEventListener("mousemove", this._onWindowMouseMove);
    window.addEventListener("mouseup", this._onWindowMouseUp);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
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
    window.removeEventListener("mousemove", this._onWindowMouseMove);
    window.removeEventListener("mouseup", this._onWindowMouseUp);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      window.removeEventListener("touchstart", this._onWindowTouchStartCapture, true);
      window.removeEventListener("touchmove", this._onWindowTouchMove);
      window.removeEventListener("touchend", this._onWindowTouchEnd);
      window.removeEventListener("touchcancel", this._onWindowTouchEnd);
    }
  }

  _getAvailableControlModes(state) {
    const modes = [];

    if (this._config?.show_brightness !== false && this._supportsBrightness(state)) {
      modes.push("brightness");
    }

    if (this._config?.show_temperature_controls !== false && this._supportsColorTemperature(state)) {
      modes.push("temperature");
    }

    if (this._config?.show_color_controls !== false && this._supportsColor(state)) {
      modes.push("color");
    }

    return modes;
  }

  _getActiveControlMode(state) {
    const availableModes = this._getAvailableControlModes(state);
    if (!availableModes.length) {
      return null;
    }

    if (availableModes.includes(this._activeControlMode)) {
      return this._activeControlMode;
    }

    this._activeControlMode = availableModes[0];
    return this._activeControlMode;
  }

  _getControlModeIcon(mode) {
    switch (mode) {
      case "temperature":
        return "mdi:thermometer";
      case "color":
        return "mdi:palette";
      case "brightness":
      default:
        return "mdi:brightness-6";
    }
  }

  _onShadowInput(event) {
    const slider = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.lightControl);

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
      .find(node => node instanceof HTMLInputElement && node.dataset?.lightControl);

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
      node => node instanceof HTMLInputElement && node.dataset?.lightControl,
    );

    if (slider) {
      return;
    }

    const actionButton = path.find(node => node instanceof HTMLElement && node.dataset?.lightAction);

    if (!actionButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const zone = actionButton.dataset.lightAction;
    if (zone === "body" || zone === "icon") {
      if (window.NodaliaUtils?.isNodaliaSliderChromeHit?.(event)) {
        return;
      }
      if (this._suppressNextLightTap) {
        this._suppressNextLightTap = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const effect = this._resolveTapEffect(zone);
      if (effect === "none") {
        return;
      }
      this._triggerHaptic();
      this._clearModeSwitchTransition();
      this._executeTapEffect(zone, effect);
      return;
    }

    this._triggerHaptic();

    switch (actionButton.dataset.lightAction) {
      case "mode":
        this._triggerButtonBounce(actionButton);
        if (this._modeSwitchPressTimer) {
          window.clearTimeout(this._modeSwitchPressTimer);
          this._modeSwitchPressTimer = 0;
        }
        this._modeSwitchPressTimer = window.setTimeout(() => {
          this._modeSwitchPressTimer = 0;
          this._startModeSwitchTransition(actionButton.dataset.mode || "brightness", this._getState());
        }, 180);
        break;
      case "brightness": {
        const value = Number(actionButton.dataset.value);
        this._draftBrightness.set(this._config.entity, clamp(Math.round(value), 1, 100));
        this._commitBrightness(value);
        this._render();
        break;
      }
      case "color": {
        const hs = String(actionButton.dataset.hs || "")
          .split(",")
          .map(value => Number(value));
        if (hs.length === 2 && hs.every(value => Number.isFinite(value))) {
          this._draftHue.set(this._config.entity, clamp(Math.round(hs[0]), 0, 360));
          this._commitColorPreset(hs);
          this._render();
        }
        break;
      }
      case "temperature":
        this._draftTemperature.set(this._config.entity, Math.round(Number(actionButton.dataset.kelvin)));
        this._commitTemperaturePreset(Number(actionButton.dataset.kelvin));
        this._render();
        break;
      case "toggle-controls-expand":
        if (this._config?.auto_expand === false) {
          this._controlsPanelUserOpen = !this._controlsPanelUserOpen;
          this._lastRenderSignature = "";
          this._render();
        }
        break;
      default:
        break;
    }
  }

  _renderEmptyState() {
    const title = escapeHtml(this._lightCardUi("emptyTitle", "Nodalia Light Card"));
    const body = escapeHtml(
      this._lightCardUi("emptyBody", "Set `entity` to a `light.*` entity to show this card."),
    );
    return `
      <ha-card class="light-card light-card--empty">
        <div class="light-card__empty-title">${title}</div>
        <div class="light-card__empty-text">${body}</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    if (!this._config) {
      this.shadowRoot.innerHTML = "";
      this._lastRenderSignature = "";
      return;
    }

    const config = this._config;
    const styles = config.styles;

    const entityGuard = window.NodaliaUtils?.renderLovelaceEntityGuardCardHtml?.(
      this._hass,
      config.entity,
      { cardClass: "light-card" },
    );
    if (entityGuard) {
      this.shadowRoot.innerHTML = entityGuard;
      return;
    }

    const state = this._getState();
    if (!state) {
      this.shadowRoot.innerHTML = window.NodaliaUtils?.renderCardEmptyStateDocument?.(
        this._renderEmptyState(),
        { card: (this._config || DEFAULT_CONFIG).styles?.card },
      ) ?? this._renderEmptyState();
      return;
    }

    const isOn = state.state === "on";
    if (!isOn) {
      this._controlsPanelUserOpen = false;
    }
    const supportsBrightness = this._supportsBrightness(state);
    const supportsColor = this._supportsColor(state);
    const supportsColorTemperature = this._supportsColorTemperature(state);
    const brightnessPercent = this._getBrightnessPercent(state);
    const currentKelvin = this._getCurrentKelvin(state);
    const accentColor = this._getAccentColor(state);
    const darkenBubbleIconGlyph =
      isOn && Boolean(window.NodaliaBubbleContrast?.shouldDarkenBubbleIconGlyph(state, accentColor));
    const configuredOnIconColor = String(styles?.icon?.on_color ?? "").trim();
    const defaultOnIconColor = String(DEFAULT_CONFIG?.styles?.icon?.on_color ?? "").trim();
    const lightIconColor = isOn
      ? (
          configuredOnIconColor && configuredOnIconColor !== defaultOnIconColor
            ? configuredOnIconColor
            : `color-mix(in srgb, ${accentColor} ${darkenBubbleIconGlyph ? 42 : 72}%, var(--primary-text-color))`
        )
      : styles?.icon?.off_color;
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const title = this._getLightName(state);
    const icon = this._getLightIcon(state);
    const entityPicture = this._getEntityPicture(state);
    const showUnavailableBadge = isUnavailableState(state);
    const stateLabel = this._getStateLabel(state);
    const isCompactLayout = this._isCompactLayout;
    const isMiniLayout = this._shouldUseMiniLayout();
    const quickBrightness = Array.isArray(config.quick_brightness) ? config.quick_brightness : [];
    const quickColorPresetRows = this._getQuickColorPresetRows(config);
    const temperaturePresets = this._getTemperaturePresets(state);
    const availableControlModes = isOn ? this._getAvailableControlModes(state) : [];
    const autoExpandControls = config.auto_expand !== false;
    const canShowDetailedControls = isOn && !isMiniLayout && availableControlModes.length > 0;
    const showDetailedControls = canShowDetailedControls && (autoExpandControls || this._controlsPanelUserOpen);
    const useSliderModeButtons = config.show_slider_mode_buttons !== false && availableControlModes.length > 1;
    const activeControlMode = isOn ? this._getActiveControlMode(state) : "brightness";
    const currentHue = this._getCurrentHue(state);
    const temperatureRange = this._getTemperatureRange(state);
    const temperatureControlDomain = this._getTemperatureControlDomain(state);
    const temperatureTrackGradient = getTemperatureSliderTrackGradient(temperatureControlDomain.unit);
    const currentTemperatureSliderValue = this._kelvinToTemperatureSliderValue(currentKelvin, state);
    const temperatureProgress = temperatureControlDomain.max === temperatureControlDomain.min
      ? 0
      : ((currentTemperatureSliderValue - temperatureControlDomain.min) / (temperatureControlDomain.max - temperatureControlDomain.min)) * 100;
    const colorProgress = (currentHue / 360) * 100;
    let stateChipMarkup = "";
    let activeValueChipMarkup = "";
    const onCardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 52%, ${styles.card.background} 100%)`;
    const onCardBorder = `color-mix(in srgb, ${accentColor} 32%, var(--divider-color))`;
    const onCardShadow = `0 16px 32px color-mix(in srgb, ${accentColor} 18%, rgba(0, 0, 0, 0.18))`;
    const animations = this._getAnimationSettings();
    const wasOn = this._lastRenderedIsOn;
    const now = Date.now();
    let powerAnimationState = "";
    let controlsAnimationState = "";

    if (!animations.enabled) {
      this._powerTransition = null;
      this._controlsTransition = null;
    } else if (wasOn !== null && wasOn !== isOn) {
      powerAnimationState = isOn ? "powering-up" : "powering-down";
      this._powerTransition = {
        endsAt: now + animations.powerDuration,
        startedAt: now,
        state: powerAnimationState,
      };

      if (!isMiniLayout) {
        if (isOn) {
          const willShowDetailedOnEnter = availableControlModes.length > 0
            && (autoExpandControls || this._controlsPanelUserOpen);
          if (willShowDetailedOnEnter) {
            controlsAnimationState = "entering";
            this._controlsTransition = {
              endsAt: now + animations.controlsDuration,
              startedAt: now,
              state: controlsAnimationState,
            };
          } else {
            this._controlsTransition = null;
          }
        } else if (this._lastControlsMarkup && this._lastRenderedShowDetailedControls) {
          /** If detailed controls were already collapsed (`auto_expand: false` + chevron), skip replaying expanded markup during `powering-down` — stale `_lastControlsMarkup` would otherwise force a full-height shell off the compact card. */
          controlsAnimationState = "leaving";
          this._controlsTransition = {
            endsAt: now + animations.controlsDuration,
            startedAt: now,
            state: controlsAnimationState,
          };
        } else {
          this._controlsTransition = null;
        }
      } else {
        this._controlsTransition = null;
      }
    } else {
      if (this._powerTransition?.endsAt > now) {
        powerAnimationState = this._powerTransition.state;
      } else {
        this._powerTransition = null;
      }

      if (!isMiniLayout && this._controlsTransition?.endsAt > now) {
        controlsAnimationState = this._controlsTransition.state;
      } else {
        this._controlsTransition = null;
      }
    }

    const controlsTransitionStillActive = Boolean(this._controlsTransition?.endsAt > now);
    if (
      animations.enabled
      && !isMiniLayout
      && isOn
      && this._lastRenderedShowDetailedControls === true
      && !showDetailedControls
      && String(this._lastControlsMarkup || "").trim() !== ""
      && !controlsTransitionStillActive
    ) {
      controlsAnimationState = "leaving";
      this._controlsTransition = {
        endsAt: now + animations.controlsDuration,
        startedAt: now,
        state: "leaving",
      };
    }

    const modeTransition = this._modeTransition
      && isOn
      && useSliderModeButtons
      && availableControlModes.includes(this._modeTransition.from)
      && availableControlModes.includes(this._modeTransition.to)
      ? this._modeTransition
      : null;
    const displayedControlMode = modeTransition
      ? (modeTransition.phase === "collapsing" ? modeTransition.from : modeTransition.to)
      : activeControlMode;
    const controlModeLabel = mode => {
      const fallback = mode === "temperature"
        ? "Show temperature"
        : mode === "color"
          ? "Show color"
          : "Show brightness";
      return this._lightCardUi(`controlModes.${mode}`, fallback);
    };
    const temperatureSectionLabel = this._lightCardUi("sections.temperature", "Temperature");
    const colorSectionLabel = this._lightCardUi("sections.color", "Color");
    const presetsSectionLabel = this._lightCardUi("sections.presets", "Presets");
    const modeTransitionAxisClass = animations.modeSwitchHorizontal
      ? "light-card__mode-panel-inner--horizontal"
      : "light-card__mode-panel-inner--vertical";
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const contentEntranceDuration = clamp(Math.round(animations.controlsDuration * 0.9), 180, 900);
    const shouldAnimateBrightnessFill = animations.enabled &&
      powerAnimationState === "powering-up" &&
      isOn &&
      showDetailedControls &&
      supportsBrightness &&
      !isMiniLayout;
    const brightnessFillDuration = shouldAnimateBrightnessFill
      ? clamp(Math.round(animations.controlsDuration * 0.82), 220, 1100)
      : 0;
    let brightnessFillDelay = 0;
    if (shouldAnimateBrightnessFill && this._powerTransition?.startedAt != null) {
      const fillElapsed = now - Number(this._powerTransition.startedAt);
      if (fillElapsed > 0) {
        brightnessFillDelay = -clamp(fillElapsed, 0, brightnessFillDuration);
      }
    }
    const brightnessSliderShellClass = shouldAnimateBrightnessFill ? " light-card__slider-shell--brightness-fill" : "";

    const statePosition = config.state_position === "below" ? "below" : "right";
    if (!isMiniLayout && config.show_state === true) {
      stateChipMarkup = `<span class="light-card__chip light-card__chip--state">${escapeHtml(stateLabel)}</span>`;
    }
    const stateChipHeaderMarkup = statePosition === "right" ? stateChipMarkup : "";
    const stateChipBelowMarkup = statePosition === "below" ? stateChipMarkup : "";

    const showControlsExpandToggle = canShowDetailedControls && !autoExpandControls;
    const controlsPanelToggleLabel = showControlsExpandToggle
      ? escapeHtml(this._controlsEditorStr(
        showDetailedControls ? "ed.light.collapse_controls_panel" : "ed.light.expand_controls_panel",
      ))
      : "";
    const controlsPanelToggleMarkup = showControlsExpandToggle
      ? `
          <button
            type="button"
            class="light-card__mode-button"
            data-light-action="toggle-controls-expand"
            aria-label="${controlsPanelToggleLabel}"
            title="${controlsPanelToggleLabel}"
          >
            <ha-icon icon="${showDetailedControls ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
          </button>
        `
      : "";

    if (showDetailedControls) {
      let activeValueChip = null;

      if (displayedControlMode === "temperature" && config.show_temperature_controls !== false && supportsColorTemperature) {
        activeValueChip = `${currentKelvin}K`;
      } else if (displayedControlMode === "color" && config.show_color_controls !== false && supportsColor) {
        activeValueChip = `${currentHue}°`;
      } else if (config.show_brightness !== false && supportsBrightness) {
        activeValueChip = `${Math.round(brightnessPercent)}%`;
      }

      if (activeValueChip) {
        activeValueChipMarkup = `
          <span class="light-card__active-chip-shell ${modeTransition ? `light-card__active-chip-shell--${modeTransition.phase}` : ""}">
            <span class="light-card__active-chip-inner">
              <span class="light-card__chip" data-light-chip="${escapeHtml(displayedControlMode)}">${escapeHtml(activeValueChip)}</span>
            </span>
          </span>
        `;
      }
    }

    const activeValueChipHeaderMarkup = statePosition === "right" ? activeValueChipMarkup : "";
    const activeValueChipBelowMarkup = statePosition === "below" ? activeValueChipMarkup : "";
    const hasHeaderChips = Boolean(stateChipHeaderMarkup || activeValueChipHeaderMarkup || controlsPanelToggleMarkup);
    const hasBelowChips = Boolean(stateChipBelowMarkup || activeValueChipBelowMarkup);
    const showTitle = !isMiniLayout && (!isCompactLayout || this._shouldShowCompactTitle());
    const showCopyBlock = showTitle || hasHeaderChips || hasBelowChips;
    const sliderInnerMarkup = showDetailedControls && availableControlModes.length > 0
      ? `
        ${
          displayedControlMode === "temperature"
            ? `
              <div class="light-card__slider-wrap">
                <div class="light-card__slider-shell" style="--temperature-progress:${clamp(temperatureProgress, 0, 100)};">
                  <div class="light-card__slider-track" data-light-control="temperature"></div>
                  <input
                    type="range"
                    class="light-card__slider"
                    data-light-control="temperature"
                    min="${temperatureControlDomain.min}"
                    max="${temperatureControlDomain.max}"
                    step="any"
                    value="${currentTemperatureSliderValue}"
                    style="--temperature-progress:${clamp(temperatureProgress, 0, 100)};"
                    aria-label="${escapeHtml(controlModeLabel("temperature"))}"
                  />
                  <div class="light-card__slider-thumb" data-light-control="temperature"></div>
                </div>
              </div>
            `
            : displayedControlMode === "color"
              ? `
                <div class="light-card__slider-wrap">
                  <div class="light-card__slider-shell" style="--color-progress:${clamp(colorProgress, 0, 100)};">
                    <div class="light-card__slider-track" data-light-control="color"></div>
                    <input
                      type="range"
                      class="light-card__slider"
                      data-light-control="color"
                      min="0"
                      max="360"
                      step="any"
                      value="${currentHue}"
                      style="--color-progress:${clamp(colorProgress, 0, 100)};"
                      aria-label="${escapeHtml(controlModeLabel("color"))}"
                    />
                    <div class="light-card__slider-thumb" data-light-control="color"></div>
                  </div>
                </div>
              `
              : `
                <div class="light-card__slider-wrap">
                  <div class="light-card__slider-shell${brightnessSliderShellClass}" style="--brightness:${brightnessPercent}; --brightness-target:${brightnessPercent};">
                    <div class="light-card__slider-track" data-light-control="brightness"></div>
                    <input
                      type="range"
                      class="light-card__slider"
                      data-light-control="brightness"
                      min="1"
                      max="100"
                      step="any"
                      value="${brightnessPercent}"
                      style="--brightness:${brightnessPercent};"
                      aria-label="${escapeHtml(controlModeLabel("brightness"))}"
                    />
                  </div>
                </div>
              `
        }
      `
      : "";
    const sliderSectionMarkup = sliderInnerMarkup
      ? `
        <div class="light-card__section">
          <div class="light-card__slider-row">
            ${
              useSliderModeButtons
                ? `
                  <div class="light-card__mode-panel">
                    <div class="light-card__mode-panel-inner ${modeTransition ? `light-card__mode-panel-inner--${modeTransition.phase}` : ""} ${modeTransitionAxisClass}">
                      ${sliderInnerMarkup}
                    </div>
                  </div>
                `
                : sliderInnerMarkup
            }
            ${
              useSliderModeButtons
                ? `
                  <div class="light-card__mode-actions">
                      ${availableControlModes
                        .filter(mode => mode !== displayedControlMode)
                        .map(mode => `
                          <button
                            type="button"
                            class="light-card__mode-button"
                            data-light-action="mode"
                            data-mode="${mode}"
                            ${modeTransition ? "disabled" : ""}
                            aria-label="${escapeHtml(controlModeLabel(mode))}"
                          >
                            <ha-icon icon="${this._getControlModeIcon(mode)}"></ha-icon>
                          </button>
                        `)
                        .join("")}
                  </div>
                `
                : ""
            }
          </div>
        </div>
      `
      : "";
    const brightnessPresetsMarkup = showDetailedControls &&
      displayedControlMode === "brightness" &&
      config.show_quick_brightness !== false &&
      supportsBrightness &&
      quickBrightness.length
      ? `
        <div class="light-card__actions">
          ${quickBrightness
            .map(value => `
              <button
                type="button"
                class="light-card__brightness-preset ${value === brightnessPercent ? "is-active" : ""}"
                data-light-action="brightness"
                data-value="${value}"
              >
                ${escapeHtml(`${value}%`)}
              </button>
            `)
            .join("")}
        </div>
      `
      : "";
    const temperatureQuickPresetsMarkup = showDetailedControls &&
      useSliderModeButtons &&
      config.show_quick_temperature_presets === true &&
      config.show_temperature_controls !== false &&
      supportsColorTemperature &&
      displayedControlMode === "temperature" &&
      temperaturePresets.length
      ? `
        <div class="light-card__actions">
          ${temperaturePresets
            .map(item => `
              <button
                type="button"
                class="light-card__temperature-preset ${Math.abs(item.kelvin - currentKelvin) <= 250 ? "is-active" : ""}"
                data-light-action="temperature"
                data-kelvin="${item.kelvin}"
              >
                ${escapeHtml(item.label)}
              </button>
            `)
            .join("")}
        </div>
      `
      : "";
    const colorQuickPresetsMarkup = showDetailedControls &&
      useSliderModeButtons &&
      config.show_quick_color_presets === true &&
      config.show_color_controls !== false &&
      supportsColor &&
      displayedControlMode === "color" &&
      quickColorPresetRows.length
      ? `
        <div class="light-card__actions">
          ${quickColorPresetRows
            .map(item => {
              const label = item.label || item.color;
              return `
              <button
                type="button"
                class="light-card__color-preset"
                style="--swatch-color:${escapeHtml(item.color)};"
                data-light-action="color"
                data-hs="${escapeHtml(item.hs.join(","))}"
                aria-label="${escapeHtml(label)}"
                title="${escapeHtml(label)}"
              ></button>
            `;
            })
            .join("")}
        </div>
      `
      : "";
    const temperatureControlsMarkup = showDetailedControls &&
      !useSliderModeButtons &&
      config.show_temperature_controls !== false &&
      supportsColorTemperature
      ? `
        <div class="light-card__section">
          <div class="light-card__section-header">
            <span>${escapeHtml(temperatureSectionLabel)}</span>
            <span class="light-card__section-value">${escapeHtml(`${currentKelvin}K`)}</span>
          </div>
          <div class="light-card__actions">
            ${temperaturePresets
              .map(item => `
                <button
                  type="button"
                  class="light-card__temperature-preset ${Math.abs(item.kelvin - currentKelvin) <= 250 ? "is-active" : ""}"
                  data-light-action="temperature"
                  data-kelvin="${item.kelvin}"
                >
                  ${escapeHtml(item.label)}
                </button>
              `)
              .join("")}
          </div>
        </div>
      `
      : "";
    const colorControlsMarkup = showDetailedControls &&
      !useSliderModeButtons &&
      config.show_color_controls !== false &&
      supportsColor
      ? `
        <div class="light-card__section">
          <div class="light-card__section-header">
            <span>${escapeHtml(colorSectionLabel)}</span>
            <span class="light-card__section-value">${escapeHtml(presetsSectionLabel)}</span>
          </div>
          <div class="light-card__actions">
            ${COLOR_PRESETS
              .map(item => `
                <button
                  type="button"
                  class="light-card__color-preset"
                  style="--swatch-color:${escapeHtml(item.color)};"
                  data-light-action="color"
                  data-hs="${escapeHtml(item.hs.join(","))}"
                  aria-label="${escapeHtml(item.label)}"
                  title="${escapeHtml(item.label)}"
                ></button>
              `)
              .join("")}
          </div>
        </div>
      `
      : "";
    const currentControlsMarkup = [
      sliderSectionMarkup,
      brightnessPresetsMarkup,
      temperatureQuickPresetsMarkup,
      colorQuickPresetsMarkup,
      temperatureControlsMarkup,
      colorControlsMarkup,
    ].filter(Boolean).join("");
    const controlsContentMarkup = showDetailedControls && currentControlsMarkup
      ? currentControlsMarkup
      : controlsAnimationState === "leaving"
        ? this._lastControlsMarkup
        : "";
    const controlsShellMarkup = !isMiniLayout && controlsContentMarkup
      ? `
        <div class="light-card__controls-shell ${controlsAnimationState ? `light-card__controls-shell--${controlsAnimationState}` : ""}" data-nodalia-tap-shield="true">
          <div class="light-card__controls-inner">
            ${controlsContentMarkup}
          </div>
        </div>
      `
      : "";
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
    const brightnessFillAnimationRemaining = shouldAnimateBrightnessFill
      ? brightnessFillDuration
      : 0;
    const shouldCleanupAfterAnimation = Boolean(powerAnimationRemaining || controlsAnimationRemaining || brightnessFillAnimationRemaining);
    const cleanupDelay = shouldCleanupAfterAnimation
      ? Math.max(powerAnimationRemaining, controlsAnimationRemaining, brightnessFillAnimationRemaining) + 40
      : 0;

    if (isOn && showDetailedControls && currentControlsMarkup) {
      this._lastControlsMarkup = currentControlsMarkup;
    } else if (isOn && !showDetailedControls && controlsAnimationState !== "leaving") {
      this._lastControlsMarkup = "";
    } else if (!isOn && controlsAnimationState !== "leaving") {
      this._lastControlsMarkup = "";
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --light-card-content-duration: ${animations.enabled ? contentEntranceDuration : 0}ms;
          display: block;
          width: 100%;
        }

        * {
          box-sizing: border-box;
        }

        ha-card.light-card {
          --light-card-controls-max-height: 420px;
          --light-card-controls-gap: calc(${styles.card.gap} + 4px);
          --light-card-controls-duration: ${animations.controlsDuration}ms;
          --light-card-mode-duration: ${Math.max(100, Math.round(animations.modeSwitchDuration / 2))}ms;
          --light-card-mode-shell-height: ${styles.slider_wrap_height};
          --light-card-power-duration: ${animations.powerDuration}ms;
          --light-card-power-delay: ${powerAnimationDelay}ms;
          --light-card-controls-delay: ${controlsAnimationDelay}ms;
          --light-card-brightness-fill-delay: ${brightnessFillDelay}ms;
          --light-card-brightness-fill-duration: ${brightnessFillDuration}ms;
          --light-card-brightness-empty-duration: ${animations.controlsDuration}ms;
          --light-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          background: ${isOn ? onCardBackground : styles.card.background};
          border: ${isOn ? `1px solid ${onCardBorder}` : styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${isOn ? `${styles.card.box_shadow}, ${onCardShadow}` : styles.card.box_shadow};
          display: block;
          isolation: isolate;
          overflow: hidden;
          padding: ${styles.card.padding};
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .light-card.is-off,
        .light-card.is-on {
          cursor: pointer;
        }

        .light-card--compact.is-off {
          align-items: center;
          display: flex;
          min-height: 100%;
        }

        .light-card--mini {
          align-items: center;
          display: flex;
          justify-content: center;
          min-height: 100%;
        }

        .light-card::before {
          background: ${isOn
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`
            : "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0))"};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .light-card::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%);
          content: "";
          inset: 0;
          opacity: ${isOn ? "1" : "0"};
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .light-card--powering-up {
          animation: light-card-power-up var(--light-card-power-duration) cubic-bezier(0.24, 0.82, 0.25, 1) var(--light-card-power-delay) both;
        }

        .light-card--powering-down {
          animation: light-card-power-down var(--light-card-power-duration) cubic-bezier(0.32, 0, 0.24, 1) var(--light-card-power-delay) both;
        }

        .light-card--powering-up::after {
          animation: light-card-power-glow-in var(--light-card-power-duration) cubic-bezier(0.24, 0.82, 0.25, 1) var(--light-card-power-delay) both;
        }

        .light-card--powering-down::after {
          animation: light-card-power-glow-out var(--light-card-power-duration) cubic-bezier(0.32, 0, 0.24, 1) var(--light-card-power-delay) both;
        }

        .light-card__content {
          display: grid;
          gap: 0;
          position: relative;
          z-index: 1;
        }

        .light-card__content--entering {
          animation: light-card-fade-up var(--light-card-content-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .light-card--mini .light-card__content {
          align-content: center;
          justify-items: center;
          min-height: 100%;
          width: 100%;
        }

        .light-card--compact.is-off .light-card__content {
          align-content: center;
          min-height: 100%;
          width: 100%;
        }

        .light-card__hero {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: ${styles.icon.size} minmax(0, 1fr);
          min-width: 0;
        }

        .light-card--mini:not(.light-card--with-copy) .light-card__hero {
          gap: 0;
          grid-template-columns: 1fr;
          justify-items: center;
        }

        .light-card--mini.light-card--with-copy .light-card__hero,
        .light-card--compact .light-card__hero {
          gap: 10px;
          grid-template-columns: ${styles.icon.size} minmax(0, 1fr);
          justify-items: start;
        }

        .light-card--compact.is-off .light-card__hero {
          align-content: center;
        }

        .light-card--compact.is-off:not(.light-card--with-copy) .light-card__hero {
          gap: 0;
        }

        .light-card__icon,
        .light-card__brightness-preset,
        .light-card__temperature-preset,
        .light-card__color-preset {
          align-items: center;
          appearance: none;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          justify-content: center;
          line-height: 0;
          padding: 0;
          position: relative;
        }

        .light-card__icon {
          background: ${isOn
            ? `color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent))`
            : "color-mix(in srgb, var(--primary-text-color) 6%, transparent)"};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${lightIconColor};
          cursor: pointer;
          height: ${styles.icon.size};
          justify-self: start;
          width: ${styles.icon.size};
        }

        .light-card--mini .light-card__icon {
          height: min(${styles.icon.size}, calc(100vw - 48px));
          width: min(${styles.icon.size}, calc(100vw - 48px));
        }

        .light-card__icon ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.46);
          align-items: center;
          color: ${lightIconColor};
          display: inline-flex;
          height: calc(${styles.icon.size} * 0.46);
          justify-content: center;
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${styles.icon.size} * 0.46);
          z-index: 1;
        }

        .light-card__picture {
          border-radius: inherit;
          height: 100%;
          inset: 0;
          object-fit: cover;
          pointer-events: none;
          position: absolute;
          width: 100%;
        }

        .light-card__unavailable-badge {
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

        .light-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          color:#fff;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .light-card__copy {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .light-card__copy-header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
          min-width: 0;
          width: 100%;
        }

        .light-card--compact .light-card__copy {
          min-width: 0;
          width: 100%;
        }

        .light-card--compact .light-card__copy-header {
          justify-content: space-between;
          width: 100%;
        }

        .light-card__title {
          color: var(--primary-text-color);
          flex: 1 1 auto;
          font-size: ${styles.title_size};
          font-weight: 700;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .light-card__chips {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
          margin-left: auto;
          min-width: 0;
        }

        .light-card__chips--below {
          justify-content: flex-start;
          margin-left: 0;
        }

        .light-card--compact .light-card__chips {
          justify-content: flex-end;
        }

        .light-card__chip {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: ${chipBorderRadius};
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: ${styles.chip_font_size};
          font-weight: 600;
          line-height: 1;
          min-height: ${styles.chip_height};
          padding: ${styles.chip_padding};
        }

        .light-card__chip--state {
          color: var(--primary-text-color);
        }

        .light-card__active-chip-shell {
          backface-visibility: hidden;
          display: inline-flex;
          overflow: hidden;
          will-change: opacity, transform;
          transform-origin: right center;
        }

        .light-card__active-chip-inner {
          backface-visibility: hidden;
          display: inline-flex;
          opacity: 1;
          transform: none;
          will-change: opacity, transform;
          transform-origin: right center;
        }

        .light-card__active-chip-shell--collapsing .light-card__active-chip-inner {
          animation: light-card-mode-chip-out var(--light-card-mode-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
        }

        .light-card__active-chip-shell--expanding .light-card__active-chip-inner {
          animation: light-card-mode-chip-in var(--light-card-mode-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .light-card__section {
          display: grid;
          gap: 10px;
        }

        .light-card__controls-shell {
          backface-visibility: hidden;
          display: grid;
          grid-template-rows: 1fr;
          margin-top: var(--light-card-controls-gap);
          max-height: 320px;
          overflow: visible;
          will-change: grid-template-rows, max-height, margin-top, opacity;
        }

        .light-card__controls-inner {
          backface-visibility: hidden;
          display: grid;
          gap: 10px;
          min-height: 0;
          overflow: visible;
          will-change: opacity, transform;
        }

        .light-card__mode-panel {
          align-items: center;
          backface-visibility: hidden;
          display: grid;
          min-height: var(--light-card-mode-shell-height);
          overflow: hidden;
          will-change: opacity, transform;
          width: 100%;
        }

        .light-card__mode-panel-inner {
          backface-visibility: hidden;
          display: grid;
          opacity: 1;
          transform: none;
          will-change: opacity, transform;
          width: 100%;
        }

        .light-card__mode-panel-inner--horizontal.light-card__mode-panel-inner--collapsing {
          animation: light-card-mode-slider-out-horizontal var(--light-card-mode-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
          pointer-events: none;
          transform-origin: right center;
        }

        .light-card__mode-panel-inner--horizontal.light-card__mode-panel-inner--expanding {
          animation: light-card-mode-slider-in-horizontal var(--light-card-mode-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          pointer-events: none;
          transform-origin: right center;
        }

        .light-card__mode-panel-inner--vertical.light-card__mode-panel-inner--collapsing {
          animation: light-card-mode-slider-out-vertical var(--light-card-mode-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
          pointer-events: none;
          transform-origin: center;
        }

        .light-card__mode-panel-inner--vertical.light-card__mode-panel-inner--expanding {
          animation: light-card-mode-slider-in-vertical var(--light-card-mode-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          pointer-events: none;
          transform-origin: center;
        }

        .light-card__controls-shell--entering {
          animation: light-card-controls-expand var(--light-card-controls-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--light-card-controls-delay) both;
          overflow: hidden;
          transform-origin: top;
        }

        .light-card__controls-shell--entering .light-card__controls-inner {
          animation: light-card-controls-content-in var(--light-card-controls-duration) cubic-bezier(0.22, 0.84, 0.26, 1) var(--light-card-controls-delay) both;
          overflow: hidden;
          transform-origin: top;
        }

        .light-card__controls-shell--leaving {
          animation: light-card-controls-collapse var(--light-card-controls-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--light-card-controls-delay) both;
          pointer-events: none;
          transform-origin: top;
        }

        .light-card__controls-shell--leaving .light-card__controls-inner {
          animation: light-card-controls-content-out var(--light-card-controls-duration) cubic-bezier(0.38, 0, 0.24, 1) var(--light-card-controls-delay) both;
          overflow: hidden;
          transform-origin: top;
        }

        .light-card__section-header {
          align-items: center;
          color: var(--secondary-text-color);
          display: flex;
          font-size: 12px;
          font-weight: 600;
          justify-content: space-between;
          min-width: 0;
        }

        .light-card__section-value {
          color: var(--primary-text-color);
          font-variant-numeric: tabular-nums;
        }

        .light-card__slider-wrap {
          --light-card-slider-input-height: max(44px, var(--light-card-slider-thumb-size));
          --light-card-slider-thumb-size: calc(${styles.slider_thumb_size} + 12px);
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          display: grid;
          min-height: ${styles.slider_wrap_height};
          padding: 0 16px;
        }

        .light-card__slider-shell {
          min-width: 0;
          overflow: visible;
          position: relative;
          width: 100%;
        }

        .light-card__slider-track {
          border-radius: 999px;
          height: ${styles.slider_height};
          left: 0;
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
        }

        .light-card__slider-thumb {
          display: none;
          pointer-events: none;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%) scale(1);
          transition: transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1);
          z-index: 2;
        }

        .light-card__slider-thumb[data-light-control="temperature"],
        .light-card__slider-thumb[data-light-control="color"] {
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.84) 0%,
              rgba(255, 255, 255, 0.62) 100%
            );
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 18%, transparent);
          border-radius: 999px;
          box-shadow:
            0 10px 24px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 24%, transparent);
          display: block;
          height: calc(${styles.slider_height} + 10px);
          -webkit-backdrop-filter: blur(12px);
          backdrop-filter: blur(12px);
          width: calc(${styles.slider_thumb_size} - 4px);
        }

        .light-card__slider-shell.is-dragging .light-card__slider-thumb[data-light-control="temperature"],
        .light-card__slider-shell.is-dragging .light-card__slider-thumb[data-light-control="color"] {
          transform: translate(-50%, -50%) scale(1.08);
        }

        .light-card__slider-thumb[data-light-control="temperature"] {
          left: clamp(
            calc((${styles.slider_thumb_size} - 4px) / 2),
            calc(var(--temperature-progress, ${clamp(temperatureProgress, 0, 100)}) * 1%),
            calc(100% - ((${styles.slider_thumb_size} - 4px) / 2))
          );
        }

        .light-card__slider-thumb[data-light-control="color"] {
          left: clamp(
            calc((${styles.slider_thumb_size} - 4px) / 2),
            calc(var(--color-progress, ${clamp(colorProgress, 0, 100)}) * 1%),
            calc(100% - ((${styles.slider_thumb_size} - 4px) / 2))
          );
        }

        .light-card__slider-thumb[data-light-control="temperature"]::before,
        .light-card__slider-thumb[data-light-control="color"]::before {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 999px;
          content: "";
          height: calc(100% - 12px);
          left: 50%;
          position: absolute;
          top: 6px;
          transform: translateX(-50%);
          width: 3px;
        }

        .light-card__slider-thumb[data-light-control="temperature"]::after,
        .light-card__slider-thumb[data-light-control="color"]::after {
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: inherit;
          content: "";
          inset: 0;
          position: absolute;
        }

        .light-card__slider-track[data-light-control="brightness"] {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          overflow: hidden;
        }

        .light-card__slider-track[data-light-control="brightness"]::before {
          background: ${styles.slider_color};
          border-radius: inherit;
          content: "";
          inset: 0;
          position: absolute;
          transform: scaleX(calc(var(--brightness, ${brightnessPercent}) / 100));
          transform-origin: left center;
        }

        .light-card__slider-shell--brightness-fill .light-card__slider-track[data-light-control="brightness"]::before {
          animation: light-card-brightness-fill var(--light-card-brightness-fill-duration) cubic-bezier(0.2, 0.86, 0.18, 1) var(--light-card-brightness-fill-delay, 0ms) both;
        }

        .light-card__controls-shell--leaving .light-card__slider-track[data-light-control="brightness"]::before {
          animation: light-card-brightness-empty var(--light-card-brightness-empty-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
        }

        .light-card__slider-track[data-light-control="temperature"] {
          background: ${temperatureTrackGradient};
        }

        .light-card__slider-track[data-light-control="color"] {
          background: linear-gradient(
            90deg,
            #ff4d6d 0%,
            #ff9f1c 17%,
            #ffe66d 33%,
            #4cd964 50%,
            #4dabf7 67%,
            #845ef7 83%,
            #ff4d6d 100%
          );
        }

        .light-card__slider-row {
          align-items: center;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          padding-inline: 4px;
        }

        .light-card__mode-actions {
          display: flex;
          gap: 10px;
        }

        .light-card__mode-button {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: ${styles.control.size};
          justify-content: center;
          line-height: 0;
          min-width: ${styles.control.size};
          padding: 0;
          position: relative;
          transform: scale(1);
          transform-origin: center;
          transition: transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1);
          width: ${styles.control.size};
        }

        .light-card__mode-button ha-icon {
          --mdc-icon-size: 20px;
          align-items: center;
          display: inline-flex;
          justify-content: center;
        }

        .light-card__mode-button:disabled {
          cursor: default;
          opacity: 0.58;
        }

        :is(
          .light-card__icon,
          .light-card__mode-button,
          .light-card__brightness-preset,
          .light-card__temperature-preset,
          .light-card__color-preset
        ) {
          transform: scale(1);
          transform-origin: center;
          transition: transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1);
        }

        :is(
          .light-card__icon,
          .light-card__mode-button,
          .light-card__brightness-preset,
          .light-card__temperature-preset,
          .light-card__color-preset
        ):active:not(:disabled),
        :is(
          .light-card__icon,
          .light-card__mode-button,
          .light-card__brightness-preset,
          .light-card__temperature-preset,
          .light-card__color-preset
        ).is-pressing:not(:disabled) {
          animation: light-card-button-bounce var(--light-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .light-card__slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          box-sizing: border-box;
          cursor: pointer;
          display: block;
          height: var(--light-card-slider-input-height);
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
          width: 100%;
          z-index: 1;
        }

        .light-card__slider::-webkit-slider-runnable-track {
          background: transparent;
          border-radius: 999px;
          height: ${styles.slider_height};
        }

        .light-card__slider::-moz-range-progress {
          background: transparent;
          border: 0;
          height: ${styles.slider_height};
        }

        .light-card__slider::-moz-range-track {
          background: transparent;
          border: 0;
          border-radius: 999px;
          height: ${styles.slider_height};
        }

        .light-card__slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          border-radius: 50%;
          box-shadow: none;
          box-sizing: border-box;
          cursor: pointer;
          height: ${styles.slider_thumb_size};
          margin-top: calc((${styles.slider_height} - ${styles.slider_thumb_size}) / 2);
          width: ${styles.slider_thumb_size};
        }

        .light-card__slider::-moz-range-thumb {
          background: transparent;
          border: 0;
          border-radius: 50%;
          box-shadow: none;
          box-sizing: border-box;
          cursor: pointer;
          height: ${styles.slider_thumb_size};
          width: ${styles.slider_thumb_size};
        }

        .light-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }

        .light-card__brightness-preset,
        .light-card__temperature-preset {
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color: var(--primary-text-color);
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          height: 34px;
          min-width: 46px;
          padding: 0 12px;
        }

        .light-card__brightness-preset.is-active,
        .light-card__temperature-preset.is-active {
          background: ${styles.control.accent_background};
          color: ${styles.control.accent_color};
        }

        .light-card__color-preset {
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          height: 32px;
          width: 32px;
        }

        .light-card__color-preset::after {
          background: var(--swatch-color);
          border-radius: inherit;
          content: "";
          inset: 5px;
          position: absolute;
        }

        @keyframes light-card-power-up {
          0% {
            background: ${styles.card.background};
            box-shadow: ${styles.card.box_shadow};
            transform: scale(0.994);
          }
          55% {
            background: linear-gradient(135deg, color-mix(in srgb, ${accentColor} 26%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 14%, ${styles.card.background}) 52%, ${styles.card.background} 100%);
            box-shadow: ${styles.card.box_shadow}, 0 12px 26px color-mix(in srgb, ${accentColor} 12%, rgba(0, 0, 0, 0.16));
            transform: scale(1);
          }
          100% {
            background: ${onCardBackground};
            box-shadow: ${styles.card.box_shadow}, ${onCardShadow};
            transform: scale(1);
          }
        }

        @keyframes light-card-power-down {
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

        @keyframes light-card-power-glow-in {
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

        @keyframes light-card-power-glow-out {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes light-card-brightness-fill {
          0% {
            transform: scaleX(0.01);
          }
          100% {
            transform: scaleX(calc(var(--brightness-target, var(--brightness, ${brightnessPercent})) / 100));
          }
        }

        @keyframes light-card-brightness-empty {
          100% {
            transform: scaleX(0.01);
          }
        }

        @keyframes light-card-controls-expand {
          0% {
            grid-template-rows: 0fr;
            max-height: 0;
            margin-top: 0;
            opacity: 0;
          }
          100% {
            grid-template-rows: 1fr;
            max-height: 320px;
            margin-top: var(--light-card-controls-gap);
            opacity: 1;
          }
        }

        @keyframes light-card-controls-collapse {
          0% {
            grid-template-rows: 1fr;
            max-height: 320px;
            margin-top: var(--light-card-controls-gap);
            opacity: 1;
          }
          100% {
            grid-template-rows: 0fr;
            max-height: 0;
            margin-top: 0;
            opacity: 0;
          }
        }

        @keyframes light-card-controls-content-in {
          0% {
            opacity: 0;
            transform: translateY(-10px) scaleY(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes light-card-controls-content-out {
          0% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.94);
          }
        }

        @keyframes light-card-mode-slider-out-horizontal {
          0% {
            opacity: 1;
            transform: scaleX(1);
          }
          100% {
            opacity: 0;
            transform: scaleX(0.18);
          }
        }

        @keyframes light-card-mode-slider-in-horizontal {
          0% {
            opacity: 0;
            transform: scaleX(0.18);
          }
          100% {
            opacity: 1;
            transform: scaleX(1);
          }
        }

        @keyframes light-card-mode-slider-out-vertical {
          0% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-4px) scaleY(0.42);
          }
        }

        @keyframes light-card-mode-slider-in-vertical {
          0% {
            opacity: 0;
            transform: translateY(4px) scaleY(0.42);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes light-card-mode-chip-out {
          0% {
            opacity: 1;
            transform: scaleX(1);
          }
          100% {
            opacity: 0;
            transform: scaleX(0.25);
          }
        }

        @keyframes light-card-mode-chip-in {
          0% {
            opacity: 0;
            transform: scaleX(0.25);
          }
          100% {
            opacity: 1;
            transform: scaleX(1);
          }
        }

        @keyframes light-card-button-bounce {
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

        @keyframes light-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        ${animations.enabled ? "" : `
        .light-card,
        .light-card::after,
        .light-card__controls-shell,
        .light-card__controls-inner,
        .light-card__mode-panel,
        .light-card__mode-panel-inner,
        .light-card__mode-actions,
        .light-card__active-chip-inner,
        .light-card__icon,
        .light-card__mode-button,
        .light-card__brightness-preset,
        .light-card__temperature-preset,
        .light-card__color-preset,
        .light-card__slider-thumb,
        .light-card * {
          animation: none !important;
          transition: none !important;
        }
        `}

        @media (prefers-reduced-motion: reduce) {
          .light-card,
          .light-card::after,
          .light-card__controls-shell,
          .light-card__controls-inner,
          .light-card__mode-panel,
          .light-card__mode-panel-inner,
          .light-card__mode-actions,
          .light-card__active-chip-inner,
          .light-card__icon,
          .light-card__mode-button,
          .light-card__brightness-preset,
          .light-card__temperature-preset,
          .light-card__color-preset,
          .light-card__slider-thumb {
            animation: none !important;
            transition: none !important;
          }
        }

        @media (max-width: 420px) {
          .light-card__hero {
            grid-template-columns: 50px minmax(0, 1fr);
          }

          .light-card--compact .light-card__hero,
          .light-card--mini.light-card--with-copy .light-card__hero {
            grid-template-columns: 50px minmax(0, 1fr);
            justify-items: start;
          }

          .light-card__icon {
            height: 50px;
            width: 50px;
          }
        }
      </style>
      <ha-card
        class="light-card ${isOn ? "is-on" : "is-off"} ${isCompactLayout ? "light-card--compact" : ""} ${isMiniLayout ? "light-card--mini" : ""} ${showCopyBlock ? "light-card--with-copy" : ""} ${powerAnimationState ? `light-card--${powerAnimationState}` : ""}"
        data-light-action="body"
        style="--accent-color:${escapeHtml(accentColor)};"
      >
        <div class="light-card__content ${shouldAnimateEntrance ? "light-card__content--entering" : ""}">
          <div class="light-card__hero">
            <button
              type="button"
              class="light-card__icon"
              data-light-action="icon"
              aria-label="${escapeHtml(window.NodaliaI18n?.translateCommonAria?.(this._hass, config.language ?? "auto", "togglePower", "Turn on or off") || "Turn on or off")}"
            >
              ${entityPicture
                ? `<img class="light-card__picture" src="${escapeHtml(entityPicture)}" alt="" loading="lazy" />`
                : `<ha-icon icon="${escapeHtml(icon)}"></ha-icon>`}
              ${showUnavailableBadge ? `<span class="light-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${showCopyBlock
              ? `
                <div class="light-card__copy">
                  <div class="light-card__copy-header">
                    ${showTitle ? `<div class="light-card__title">${escapeHtml(title)}</div>` : ""}
                    ${hasHeaderChips ? `<div class="light-card__chips">${stateChipHeaderMarkup}${activeValueChipHeaderMarkup}${controlsPanelToggleMarkup}</div>` : ""}
                  </div>
                  ${hasBelowChips ? `<div class="light-card__chips light-card__chips--below">${stateChipBelowMarkup}${activeValueChipBelowMarkup}</div>` : ""}
                </div>
              `
              : ""}
          </div>
          ${controlsShellMarkup}
        </div>
      </ha-card>
    `;

    this._lastRenderedIsOn = isOn;
    this._lastRenderedShowDetailedControls = showDetailedControls;
    this._lastRenderSignature = this._getRenderSignature(state);

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
