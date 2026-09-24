// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  HISTORY_REFRESH_INTERVAL,
  SERIES_COLORS,
  TOUCH_CHART_HOLD_MS,
  TOUCH_CLICK_SUPPRESSION_WINDOW,
  TOUCH_MOVE_CANCEL_DISTANCE,
  CHART_TAP_MAX_MOVE,
} from "./graph-constants";
import {
  clamp,
  deepClone,
  escapeHtml,
  fireEvent,
  isObject,
  normalizeTextKey,
} from "./graph-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./graph-config";
import {
  buildAreaPath,
  buildInterpolatedSamples,
  buildSmoothPath,
  escapeSelectorValue,
  formatHoverTimestamp,
  formatNumberValue,
  getHassLocaleTag,
  getRenderSignatureRuntime,
  getStubEntityIds,
  getStubFriendlyName,
  graphChartXToPercent,
  inferDecimals,
  isUnavailableState,
  parseHistoryTimestamp,
  parseNumber,
  parsePaddingEdges,
  parseSizeToPixels,
  resolveEntityEntries,
} from "./graph-helpers";

let _lazyNodaliaGraphCard;
export function loadNodaliaGraphCard() {
  if (_lazyNodaliaGraphCard) {
    return _lazyNodaliaGraphCard;
  }
class NodaliaGraphCard extends HTMLElement {
  static async getConfigElement() {
    if (!customElements.get(EDITOR_TAG) && typeof customElements?.whenDefined === "function") {
      await customElements.whenDefined(EDITOR_TAG);
    }

    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    const config = deepClone(STUB_CONFIG);
    const entityIds = getStubEntityIds(
      hass,
      ["sensor", "number", "input_number"],
      2,
      entities,
      entitiesFallback,
    );
    if (!entityIds.length) {
      return config;
    }

    config.entities = entityIds.map((entityId, index) => ({
      ...(config.entities?.[index] || {}),
      entity: entityId,
      name: getStubFriendlyName(hass, entityId),
    }));
    return config;
  }

  static getEntitySuggestion(hass, entityId) {
    return window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, {
      domains: ["sensor", "number", "input_number"],
      buildConfig: (_hass, selectedEntityId) => ({
        entities: [{
          entity: selectedEntityId,
          name: getStubFriendlyName(hass, selectedEntityId),
        }],
      }),
    });
  }

  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._historySeries = [];
    this._historyKey = "";
    this._historyLoadedAt = 0;
    this._historyAbortController = null;
    this._historyRefreshTimer = 0;
    this._activeSeriesEntityId = null;
    this._hoverIndex = null;
    this._hoverChart = null;
    this._hoverFrame = 0;
    this._pendingHoverIndex = null;
    this._hoverEntering = false;
    this._animateContentOnNextRender = true;
    this._animateChartOnNextRender = false;
    this._lastRenderSignature = "";
    this._tooltipSyncFrame = 0;
    this._lastTooltipViewportPosition = null;
    this._documentHoverWatchAttached = false;
    this._chartHoldTimer = 0;
    this._touchPressState = null;
    this._touchChartHoldFired = false;
    this._chartPointerSession = null;
    this._suppressClickUntil = 0;
    this._viewVisibilityObserver = null;
    this._wasInViewport = false;
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowPointerMove = this._onShadowPointerMove.bind(this);
    this._onShadowPointerLeave = this._onShadowPointerLeave.bind(this);
    this._onHostPointerOut = this._onHostPointerOut.bind(this);
    this._onDocumentPointerMove = this._onDocumentPointerMove.bind(this);
    this._onHoverMediaChange = this._onHoverMediaChange.bind(this);
    this._onShadowTouchStart = this._onShadowTouchStart.bind(this);
    this._onShadowTouchMove = this._onShadowTouchMove.bind(this);
    this._onShadowTouchEnd = this._onShadowTouchEnd.bind(this);
    this._onShadowTouchCancel = this._onShadowTouchCancel.bind(this);
    this._onShadowPointerDown = this._onShadowPointerDown.bind(this);
    this._onShadowPointerUp = this._onShadowPointerUp.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown);
    this.shadowRoot.addEventListener("pointerup", this._onShadowPointerUp);
    this.shadowRoot.addEventListener("pointercancel", this._onShadowPointerUp);
    this.shadowRoot.addEventListener("pointermove", this._onShadowPointerMove);
    this.shadowRoot.addEventListener("pointerleave", this._onShadowPointerLeave);
    this.shadowRoot.addEventListener("touchstart", this._onShadowTouchStart, { passive: true });
    this.shadowRoot.addEventListener("touchmove", this._onShadowTouchMove, { passive: false });
    this.shadowRoot.addEventListener("touchend", this._onShadowTouchEnd);
    this.shadowRoot.addEventListener("touchcancel", this._onShadowTouchCancel);
    // Defensive close: in some pointer transitions the shadow-root leave may be skipped.
    this.addEventListener("pointerleave", this._onShadowPointerLeave);
    this.addEventListener("mouseleave", this._onShadowPointerLeave);
    this.addEventListener("pointerout", this._onHostPointerOut);
    this.addEventListener("mouseout", this._onHostPointerOut);
    this._hoverMediaQuery =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(hover: hover)")
        : null;
    this._hoverSupported = this._hoverMediaQuery ? this._hoverMediaQuery.matches : true;
    if (this._hoverMediaQuery && typeof this._hoverMediaQuery.addEventListener === "function") {
      this._hoverMediaQuery.addEventListener("change", this._onHoverMediaChange);
    }
    }

  disconnectedCallback() {
    window.clearTimeout(this._historyRefreshTimer);
    this._historyRefreshTimer = 0;
    this._historyAbortController?.abort();
    this._historyAbortController = null;
    this._detachViewVisibilityObserver();
    this.removeEventListener("pointerleave", this._onShadowPointerLeave);
    this.removeEventListener("mouseleave", this._onShadowPointerLeave);
    this.removeEventListener("pointerout", this._onHostPointerOut);
    this.removeEventListener("mouseout", this._onHostPointerOut);
    this._detachDocumentHoverWatch();
    if (this._hoverFrame) {
      window.cancelAnimationFrame(this._hoverFrame);
      this._hoverFrame = 0;
    }
    if (this._tooltipSyncFrame) {
      window.cancelAnimationFrame(this._tooltipSyncFrame);
      this._tooltipSyncFrame = 0;
    }
    this._pendingHoverIndex = null;
    if (this._hoverMediaQuery && typeof this._hoverMediaQuery.removeEventListener === "function") {
      this._hoverMediaQuery.removeEventListener("change", this._onHoverMediaChange);
    }
    this._clearChartHoldTimer();
    this._clearChartPointerSession();
    this._touchPressState = null;
    this._touchChartHoldFired = false;
    this._wasInViewport = false;
    window.NodaliaUtils?.clearDeferTimers?.(this);
  }

  _onHoverMediaChange(event) {
    this._hoverSupported = Boolean(event?.matches);
    if (!this._hoverSupported) {
      this._scheduleHoverRender(null);
    }
  }

  connectedCallback() {
    this.addEventListener("pointerleave", this._onShadowPointerLeave);
    this.addEventListener("mouseleave", this._onShadowPointerLeave);
    this.addEventListener("pointerout", this._onHostPointerOut);
    this.addEventListener("mouseout", this._onHostPointerOut);
    if (this._hoverMediaQuery && typeof this._hoverMediaQuery.addEventListener === "function") {
      this._hoverMediaQuery.addEventListener("change", this._onHoverMediaChange);
    }
    this._animateContentOnNextRender = true;
    this._animateChartOnNextRender = true;
    this._lastRenderSignature = "";
    this._attachViewVisibilityObserver();
    this._scheduleHistoryRefresh();
    if (this._hass && this._config) {
      this._render();
    }
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
        if (visible === this._wasInViewport) {
          return;
        }
        this._wasInViewport = visible;
        if (!visible) {
          return;
        }
        this._animateContentOnNextRender = true;
        this._animateChartOnNextRender = true;
        this._lastRenderSignature = "";
        if (this._hass && this._config) {
          this._requestHistory();
          this._render();
        }
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
  }

  _scheduleHistoryRefresh() {
    window.clearTimeout(this._historyRefreshTimer);
    this._historyRefreshTimer = 0;
    if (!this.isConnected) {
      return;
    }
    this._historyRefreshTimer = window.setTimeout(() => {
      this._historyRefreshTimer = 0;
      if (!this.isConnected) {
        return;
      }
      if (!this._viewVisibilityObserver || this._wasInViewport) {
        this._requestHistory();
      }
      this._scheduleHistoryRefresh();
    }, HISTORY_REFRESH_INTERVAL);
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._historySeries = [];
    this._historyKey = "";
    this._historyLoadedAt = 0;
    this._historyRequestKeyStamp = "";
    this._scheduleHistoryRefresh();
    this._hoverIndex = null;
    this._animateContentOnNextRender = true;
    this._animateChartOnNextRender = true;
    this._lastRenderSignature = "";
    this._requestHistory();
    this._render();
  }

  set hass(hass) {
    const nextSignature = this._getRenderSignature(hass);
    this._hass = hass;
    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }
    this._lastRenderSignature = nextSignature;
    this._requestHistory();
    this._render();
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 3,
      min_columns: 6,
    };
  }

  _getEntityEntries() {
    return resolveEntityEntries(this._config);
  }

  _getLocaleTag() {
    return getHassLocaleTag(this._hass, this._config?.language ?? "auto");
  }

  _getRenderSignature(hass = this._hass) {
    const runtime = getRenderSignatureRuntime();
    const trackedStates = this._getTrackedStateSignatureRows(hass, runtime);
    return runtime.joinParts([
      { prefix: "ts:", values: [trackedStates.join("|")] },
      { prefix: "a:", values: [this._activeSeriesEntityId || ""] },
      { prefix: "s:", values: [this._selectedSeriesEntityId || ""] },
      { prefix: "cfg:", values: [
        String(this._config?.name || ""),
        Number(this._config?.hours_to_show ?? 24),
        this._getEntityEntries().length,
      ] },
    ]);
  }

  _getTrackedStateSignatureRows(hass, runtime) {
    return this._getEntityEntries().map(entry => {
      const state = entry?.entity ? hass?.states?.[entry.entity] || null : null;
      return runtime.joinParts([
        {
          values: [
            entry?.entity || "",
            state?.state || "",
            state?.attributes?.friendly_name || "",
            state?.attributes?.unit_of_measurement || state?.attributes?.native_unit_of_measurement || "",
          ],
        },
      ], "", "::");
    });
  }

  _getPrimaryEntityId() {
    return this._getEntityEntries()[0]?.entity || "";
  }

  _getPrimaryState() {
    const primaryEntityId = this._getPrimaryEntityId();
    return primaryEntityId ? this._hass?.states?.[primaryEntityId] || null : null;
  }

  _getSelectedEntityId() {
    const entityIds = this._getEntityEntries().map(entry => entry.entity);
    return entityIds.includes(this._activeSeriesEntityId) ? this._activeSeriesEntityId : "";
  }

  _getTitle() {
    return this._config?.name || this._graphCardUi("defaultTitle", "Graph");
  }

  _getIcon() {
    return this._config?.icon || this._getPrimaryState()?.attributes?.icon || "mdi:chart-line";
  }

  _getUnit() {
    const entries = this._getEntityEntries();
    const units = entries
      .map(entry => {
        const state = this._hass?.states?.[entry.entity];
        return String(
          state?.attributes?.unit_of_measurement
          || state?.attributes?.native_unit_of_measurement
          || "",
        ).trim();
      })
      .filter(Boolean);

    return units.length && units.every(unit => unit === units[0]) ? units[0] : "";
  }

  _getDecimals() {
    const entry = this._getEntityEntries()[0];
    if (!entry) {
      return 0;
    }

    const state = this._hass?.states?.[entry.entity];
    return inferDecimals(state?.state);
  }

  _getCurrentValuesText() {
    const selectedEntityId = this._getSelectedEntityId();
    const entries = this._getEntityEntries();
    const selectedEntry = entries.find(entry => entry.entity === selectedEntityId) || null;
    const resolvedEntries = selectedEntry ? [selectedEntry] : entries;
    const currentSeries = resolvedEntries
      .map(entry => {
        const state = this._hass?.states?.[entry.entity];
        const value = parseNumber(state?.state);
        if (!Number.isFinite(value)) {
          return null;
        }
        return {
          decimals: inferDecimals(state?.state),
          unit: String(
            state?.attributes?.unit_of_measurement
            || state?.attributes?.native_unit_of_measurement
            || "",
          ).trim(),
          value,
        };
      })
      .filter(Boolean);

    if (!currentSeries.length) {
      return { value: "--", unit: this._getUnit() };
    }

    const locale = this._getLocaleTag();

    // When multiple active series share the same unit, show the mean value.
    if (!selectedEntry && currentSeries.length > 1) {
      const unit = currentSeries[0].unit;
      const sameUnit = currentSeries.every(item => item.unit === unit);
      if (sameUnit) {
        const avg = currentSeries.reduce((sum, item) => sum + item.value, 0) / currentSeries.length;
        const decimals = clamp(
          Math.max(...currentSeries.map(item => item.decimals), 1),
          0,
          3,
        );
        return {
          value: formatNumberValue(avg, decimals, locale),
          unit,
        };
      }
    }

    const primary = currentSeries[0];
    return {
      value: formatNumberValue(primary.value, primary.decimals, locale),
      unit: primary.unit || this._getUnit(),
    };
  }

  _getLegendEntries() {
    const selectedEntityId = this._getSelectedEntityId();
    return this._getEntityEntries().map((entry, index) => {
      const state = this._hass?.states?.[entry.entity];
      return {
        entity: entry.entity,
        name: entry.name || state?.attributes?.friendly_name || entry.entity,
        color: entry.color || SERIES_COLORS[index % SERIES_COLORS.length],
        active: !selectedEntityId || selectedEntityId === entry.entity,
        muted: Boolean(selectedEntityId) && selectedEntityId !== entry.entity,
      };
    });
  }

  _canRunTapAction() {
    return (this._config?.tap_action || "more-info") !== "none" && Boolean(this._getPrimaryEntityId());
  }

  _canRunHoldAction() {
    return (this._config?.hold_action || "more-info") !== "none" && Boolean(this._getPrimaryEntityId());
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

  _openMoreInfo() {
    const entityId = this._getPrimaryEntityId();
    if (!entityId) {
      return;
    }

    fireEvent(this, "hass-more-info", {
      entityId,
    });
  }

  _fireChartHoldAction() {
    if (!this._canRunHoldAction()) {
      return;
    }

    this._scheduleHoverRender(null);
    this._triggerHaptic();
    this._openMoreInfo();
    this._suppressClickUntil = Date.now() + TOUCH_CLICK_SUPPRESSION_WINDOW;
  }

  _clearChartHoldTimer() {
    if (!this._chartHoldTimer) {
      return;
    }

    window.clearTimeout(this._chartHoldTimer);
    this._chartHoldTimer = 0;
  }

  _clearChartPointerSession() {
    this._clearChartHoldTimer();
    if (
      this._chartPointerSession?.surface instanceof HTMLElement
      && typeof this._chartPointerSession.pointerId === "number"
    ) {
      try {
        this._chartPointerSession.surface.releasePointerCapture(this._chartPointerSession.pointerId);
      } catch (_error) {
        // Ignore if capture already released.
      }
    }

    this._chartPointerSession = null;
  }

  _onShadowClick(event) {
    const seriesChip = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.graphSeries);

    if (seriesChip) {
      event.preventDefault();
      event.stopPropagation();
      const entityId = seriesChip.dataset.graphSeries;
      this._activeSeriesEntityId = this._activeSeriesEntityId === entityId ? null : entityId;
      this._hoverIndex = null;
      this._animateChartOnNextRender = true;
      this._triggerHaptic("selection");
      this._triggerButtonBounce(seriesChip);
      this._render();
      return;
    }

    if (Date.now() < this._suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const chartSurface = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.graphSurface === "chart");

    if (chartSurface && this._hoverChart?.entries?.length && this._getHoverSampleCount() > 1) {
      event.preventDefault();
      event.stopPropagation();
      this._updateHoverFromClientX(chartSurface, event.clientX);
      this._triggerHaptic("selection");
      return;
    }

    const target = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.graphAction === "primary");

    if (!target || !this._canRunTapAction()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();
    this._triggerButtonBounce(target);
    this._openMoreInfo();
  }

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;

    return {
      enabled: configuredAnimations.enabled !== false,
      hoverDuration: clamp(
        Number(configuredAnimations.hover_duration) || DEFAULT_CONFIG.animations.hover_duration,
        80,
        1200,
      ),
      buttonBounceDuration: clamp(
        Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration,
        120,
        1200,
      ),
    };
  }

  _triggerButtonBounce(element) {
    const animations = this._getAnimationSettings();
    if (!animations.enabled || !(element instanceof HTMLElement)) {
      return;
    }

    element.classList.remove("is-pressing");
    void element.offsetWidth;
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

  _getVisibleSeries(series) {
    const selectedEntityId = this._getSelectedEntityId();
    if (!selectedEntityId) {
      return series;
    }

    return series.filter(entry => entry.entity === selectedEntityId);
  }

  _getChartSurfaceFromEvent(event) {
    return event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.graphSurface === "chart");
  }

  _getHoverSampleCount() {
    return this._hoverChart?.entries?.[0]?.samples?.length || 0;
  }

  _getHoverIndexFromClientX(surface, clientX) {
    const sampleCount = this._getHoverSampleCount();
    if (!(surface instanceof HTMLElement) || sampleCount <= 1) {
      return null;
    }

    const rect = surface.getBoundingClientRect();
    if (rect.width <= 0) {
      return null;
    }

    const relativeX = clamp(clientX - rect.left, 0, rect.width);
    return Math.round((relativeX / rect.width) * (sampleCount - 1));
  }

  _updateHoverFromClientX(surface, clientX) {
    const nextIndex = this._getHoverIndexFromClientX(surface, clientX);
    if (nextIndex === null) {
      return;
    }

    this._scheduleHoverRender(nextIndex);
  }

  _onShadowPointerMove(event) {
    if (
      (typeof event.pointerType === "string" && event.pointerType === "touch")
      || this._hoverSupported === false
    ) {
      return;
    }

    const surface = this._getChartSurfaceFromEvent(event);

    if (!surface || !this._hoverChart?.entries?.length) {
      this._scheduleHoverRender(null);
      return;
    }

    this._updateHoverFromClientX(surface, event.clientX);
  }

  _onShadowPointerLeave() {
    this._scheduleHoverRender(null);
    this._lastTooltipViewportPosition = null;
  }

  _onHostPointerOut(event) {
    if (this._hoverIndex === null) {
      return;
    }
    const clientX = Number(event?.clientX);
    const clientY = Number(event?.clientY);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return;
    }
    const rect = this.getBoundingClientRect();
    const isOutside = clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;
    if (!isOutside) {
      return;
    }
    this._scheduleHoverRender(null);
    this._lastTooltipViewportPosition = null;
  }

  _onDocumentPointerMove(event) {
    if (this._hoverIndex === null) {
      return;
    }
    const clientX = Number(event?.clientX);
    const clientY = Number(event?.clientY);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return;
    }
    const rect = this.getBoundingClientRect();
    const isOutside = clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;
    if (!isOutside) {
      return;
    }
    this._scheduleHoverRender(null);
    this._lastTooltipViewportPosition = null;
  }

  _attachDocumentHoverWatch() {
    if (this._documentHoverWatchAttached || typeof document === "undefined") {
      return;
    }
    this._documentHoverWatchAttached = true;
    document.addEventListener("pointermove", this._onDocumentPointerMove, true);
    document.addEventListener("mousemove", this._onDocumentPointerMove, true);
  }

  _detachDocumentHoverWatch() {
    if (!this._documentHoverWatchAttached || typeof document === "undefined") {
      return;
    }
    this._documentHoverWatchAttached = false;
    document.removeEventListener("pointermove", this._onDocumentPointerMove, true);
    document.removeEventListener("mousemove", this._onDocumentPointerMove, true);
  }

  _findTrackedTouch(touches) {
    if (!this._touchPressState || !touches) {
      return null;
    }

    return Array.from(touches).find(item => item.identifier === this._touchPressState.identifier) || null;
  }

  _resetChartTouchTracking(options = {}) {
    const clearTooltip = options.clearTooltip === true;
    this._clearChartHoldTimer();
    this._touchPressState = null;
    this._touchChartHoldFired = false;
    if (clearTooltip && this._hoverIndex !== null) {
      this._scheduleHoverRender(null);
      this._lastTooltipViewportPosition = null;
    }
  }

  _onShadowPointerDown(event) {
    if (event.pointerType === "touch") {
      return;
    }

    const surface = this._getChartSurfaceFromEvent(event);
    if (!surface || !this._hoverChart?.entries?.length || this._getHoverSampleCount() <= 1) {
      return;
    }

    this._clearChartPointerSession();
    this._resetChartTouchTracking({ clearTooltip: false });

    this._chartPointerSession = {
      pointerId: event.pointerId,
      surface,
      startX: event.clientX,
      startY: event.clientY,
      startTime: Date.now(),
      holdFired: false,
    };

    try {
      surface.setPointerCapture(event.pointerId);
    } catch (_error) {
      // setPointerCapture may fail for disconnected nodes.
    }

    if (!this._canRunHoldAction()) {
      return;
    }

    const pointerId = event.pointerId;
    this._chartHoldTimer = window.setTimeout(() => {
      this._chartHoldTimer = 0;
      if (!this._chartPointerSession || this._chartPointerSession.pointerId !== pointerId) {
        return;
      }

      this._chartPointerSession.holdFired = true;
      this._fireChartHoldAction();
    }, TOUCH_CHART_HOLD_MS);
  }

  _onShadowPointerUp(event) {
    if (event.pointerType === "touch") {
      return;
    }

    const session = this._chartPointerSession;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    this._clearChartHoldTimer();

    try {
      session.surface.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // Ignore if capture already released.
    }

    this._chartPointerSession = null;

    if (session.holdFired) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  _onShadowTouchStart(event) {
    if (event.touches.length !== 1) {
      this._resetChartTouchTracking({ clearTooltip: false });
      return;
    }

    const surface = this._getChartSurfaceFromEvent(event);
    if (!surface || !this._hoverChart?.entries?.length || this._getHoverSampleCount() <= 1) {
      this._resetChartTouchTracking({ clearTooltip: false });
      return;
    }

    const touch = event.touches[0];
    this._clearChartPointerSession();
    this._clearChartHoldTimer();
    this._touchChartHoldFired = false;
    this._touchPressState = {
      identifier: touch.identifier,
      lastX: touch.clientX,
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      surface,
    };

    if (!this._canRunHoldAction()) {
      return;
    }

    const touchId = touch.identifier;
    this._chartHoldTimer = window.setTimeout(() => {
      this._chartHoldTimer = 0;
      if (!this._touchPressState || this._touchPressState.identifier !== touchId) {
        return;
      }

      this._touchChartHoldFired = true;
      this._touchPressState = null;
      this._fireChartHoldAction();
    }, TOUCH_CHART_HOLD_MS);
  }

  _onShadowTouchMove(event) {
    if (!this._touchPressState) {
      return;
    }

    const touch = this._findTrackedTouch(event.touches);
    if (!touch) {
      return;
    }

    this._touchPressState.lastX = touch.clientX;

    if (!this._touchChartHoldFired) {
      const deltaX = touch.clientX - this._touchPressState.startX;
      const deltaY = touch.clientY - this._touchPressState.startY;
      const isVerticalScroll = Math.abs(deltaY) > TOUCH_MOVE_CANCEL_DISTANCE && Math.abs(deltaY) > Math.abs(deltaX) * 1.2;
      if (isVerticalScroll) {
        this._resetChartTouchTracking({ clearTooltip: false });
        return;
      }
    }

    this._updateHoverFromClientX(this._touchPressState.surface, touch.clientX);
  }

  _onShadowTouchEnd(event) {
    this._clearChartHoldTimer();

    if (this._touchChartHoldFired) {
      this._touchChartHoldFired = false;
      this._touchPressState = null;
      event.preventDefault();
      return;
    }

    const touch = this._findTrackedTouch(event.changedTouches);
    const state = this._touchPressState;
    this._touchPressState = null;

    if (!state) {
      return;
    }

    if (!touch || touch.identifier !== state.identifier) {
      return;
    }

    const elapsed = Date.now() - state.startTime;
    const deltaX = touch.clientX - state.startX;
    const deltaY = touch.clientY - state.startY;
    const isTap = elapsed < TOUCH_CHART_HOLD_MS
      && Math.abs(deltaX) <= CHART_TAP_MAX_MOVE
      && Math.abs(deltaY) <= CHART_TAP_MAX_MOVE;

    if (isTap) {
      this._updateHoverFromClientX(state.surface, touch.clientX);
      this._triggerHaptic("selection");
      this._suppressClickUntil = Date.now() + TOUCH_CLICK_SUPPRESSION_WINDOW;
      event.preventDefault();
    }
  }

  _onShadowTouchCancel() {
    this._resetChartTouchTracking({ clearTooltip: true });
  }

  _scheduleHoverRender(nextIndex) {
    if (nextIndex === this._hoverIndex && this._pendingHoverIndex === null) {
      return;
    }

    this._pendingHoverIndex = nextIndex;
    if (this._hoverFrame) {
      return;
    }

    this._hoverFrame = window.requestAnimationFrame(() => {
      this._hoverFrame = 0;
      if (!this.isConnected) {
        this._pendingHoverIndex = null;
        return;
      }
      const resolvedIndex = this._pendingHoverIndex;
      this._pendingHoverIndex = null;
      if (resolvedIndex === this._hoverIndex) {
        return;
      }
      this._hoverEntering = resolvedIndex !== null && this._hoverIndex === null;
      if (resolvedIndex === null) {
        this._detachDocumentHoverWatch();
        this._lastTooltipViewportPosition = null;
      } else {
        this._attachDocumentHoverWatch();
      }
      this._hoverIndex = resolvedIndex;
      if (!this._hoverEntering && this._patchHoverOverlay()) {
        return;
      }
      this._render();
    });
  }

  _syncTooltipContent(tooltip, hover) {
    if (!(tooltip instanceof HTMLElement) || !hover) {
      return;
    }

    let timeEl = tooltip.querySelector(".graph-card__tooltip-time");
    if (!(timeEl instanceof HTMLElement)) {
      timeEl = document.createElement("div");
      timeEl.className = "graph-card__tooltip-time";
      tooltip.appendChild(timeEl);
    }
    timeEl.textContent = hover.label || "";

    let valuesEl = tooltip.querySelector(".graph-card__tooltip-values");
    if (!(valuesEl instanceof HTMLElement)) {
      valuesEl = document.createElement("div");
      valuesEl.className = "graph-card__tooltip-values";
      tooltip.appendChild(valuesEl);
    }

    const rows = hover.values || [];
    while (valuesEl.children.length > rows.length) {
      valuesEl.lastElementChild?.remove();
    }

    rows.forEach((item, index) => {
      let row = valuesEl.children[index];
      if (!(row instanceof HTMLElement)) {
        row = document.createElement("div");
        row.className = "graph-card__tooltip-row";
        row.innerHTML = `
          <span class="graph-card__tooltip-dot"></span>
          <span class="graph-card__tooltip-name"></span>
          <span class="graph-card__tooltip-value"></span>
        `;
        valuesEl.appendChild(row);
      }

      const dot = row.querySelector(".graph-card__tooltip-dot");
      const nameEl = row.querySelector(".graph-card__tooltip-name");
      const valueEl = row.querySelector(".graph-card__tooltip-value");
      if (dot instanceof HTMLElement) {
        dot.style.background = item.color || "var(--primary-color)";
      }
      if (nameEl instanceof HTMLElement) {
        nameEl.textContent = item.name || "";
      }
      if (valueEl instanceof HTMLElement) {
        valueEl.textContent = item.unit ? `${item.value} ${item.unit}` : String(item.value ?? "");
      }
    });
  }

  _patchHoverOverlay() {
    if (!this.shadowRoot || !this._hoverChart) {
      return false;
    }

    const chart = this._hoverChart;
    const hover = this._getHoverPayload(chart);
    const svg = this.shadowRoot.querySelector(".graph-card__chart-svg");

    if (hover === null) {
      this.shadowRoot.querySelector(".graph-card__hover-line")?.remove();
      const tooltip = this.shadowRoot.querySelector(".graph-card__tooltip");
      if (tooltip) {
        tooltip.style.opacity = "0";
      }
      return true;
    }

    if (!(svg instanceof SVGSVGElement)) {
      return false;
    }

    const hoverLineX = clamp(hover.x, 0, chart.width);
    let hoverLine = svg.querySelector(".graph-card__hover-line");
    if (hoverLine) {
      hoverLine.setAttribute("x1", hoverLineX.toFixed(2));
      hoverLine.setAttribute("x2", hoverLineX.toFixed(2));
    } else {
      return false;
    }

    let tooltip = this.shadowRoot.querySelector(".graph-card__tooltip");
    if (!(tooltip instanceof HTMLElement)) {
      return false;
    }

    const anchorXPct = graphChartXToPercent(hover.x, chart);
    const tooltipTint = hover.values?.[0]?.color || "var(--primary-color)";
    tooltip.dataset.anchorXPct = anchorXPct.toFixed(4);
    tooltip.style.setProperty("--tooltip-tint", tooltipTint);
    tooltip.style.opacity = "1";
    this._syncTooltipContent(tooltip, hover);
    this._scheduleTooltipPositionSync();
    return true;
  }

  _getHistoryRequestKey() {
    if (this._historyRequestKeyStamp) {
      return this._historyRequestKeyStamp;
    }
    const entries = this._getEntityEntries();
    this._historyRequestKeyStamp = JSON.stringify({
      entities: entries.map(entry => entry.entity),
      hours: Number(this._config?.hours_to_show) || DEFAULT_CONFIG.hours_to_show,
      points: Number(this._config?.points) || DEFAULT_CONFIG.points,
    });
    return this._historyRequestKeyStamp;
  }

  _getStatisticsPeriod() {
    const hoursToShow = Math.max(1, Number(this._config?.hours_to_show) || DEFAULT_CONFIG.hours_to_show);

    if (hoursToShow <= 48) {
      return "5minute";
    }

    if (hoursToShow <= 24 * 14) {
      return "hour";
    }

    return "day";
  }

  async _fetchStatistics(start, end, entityIds) {
    if (typeof this._hass?.callWS !== "function") {
      return null;
    }

    try {
      const groups = await Promise.all(entityIds.map(async entityId => {
        const result = await this._hass.callWS({
          type: "recorder/statistics_during_period",
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          statistic_ids: [entityId],
          period: this._getStatisticsPeriod(),
          types: ["mean", "min", "max", "state", "sum"],
        });

        return [entityId, Array.isArray(result?.[entityId]) ? result[entityId] : []];
      }));

      return Object.fromEntries(groups);
    } catch (_error) {
      return null;
    }
  }

  async _fetchHistory(start, end, entityIds, signal) {
    const groups = await Promise.all(entityIds.map(async entityId => {
      if (typeof this._hass?.callWS === "function") {
        try {
          const result = await this._hass.callWS({
            type: "history/history_during_period",
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            entity_ids: [entityId],
            significant_changes_only: false,
          });

          const rows = Array.isArray(result?.[0]) ? result[0] : Array.isArray(result?.[entityId]) ? result[entityId] : [];
          return [entityId, rows];
        } catch (_error) {
          // Fall through to REST.
        }
      }

      if (typeof this._hass?.auth?.fetchWithAuth === "function") {
        const query = [
          `filter_entity_id=${encodeURIComponent(entityId)}`,
          `end_time=${encodeURIComponent(end.toISOString())}`,
        ].join("&");

        const response = await this._hass.auth.fetchWithAuth(
          `/api/history/period/${encodeURIComponent(start.toISOString())}?${query}`,
          { signal },
        );

        if (!response.ok) {
          throw new Error(`History request failed with ${response.status}`);
        }

        const result = await response.json();
        return [entityId, Array.isArray(result?.[0]) ? result[0] : []];
      }

      return [entityId, []];
    }));

    return Object.fromEntries(groups);
  }

  _normalizeStatisticsSeries(raw) {
    const entries = this._getLegendEntries();

    return entries.map(entry => {
      const state = this._hass?.states?.[entry.entity];
      const rows = Array.isArray(raw?.[entry.entity]) ? raw[entry.entity] : [];
      const samples = rows
        .map(item => {
          const ts = parseHistoryTimestamp(item.start ?? item.end);
          const value = parseNumber(item.mean ?? item.state ?? item.max ?? item.min ?? item.sum);
          return { ts, value };
        })
        .filter(item => Number.isFinite(item.ts) && Number.isFinite(item.value))
        .sort((left, right) => left.ts - right.ts);

      const currentValue = parseNumber(state?.state);

      return {
        ...entry,
        unit: String(
          state?.attributes?.unit_of_measurement
          || state?.attributes?.native_unit_of_measurement
          || "",
        ).trim(),
        currentValue: Number.isFinite(currentValue) ? currentValue : samples[samples.length - 1]?.value ?? 0,
        rawEventCount: samples.length,
        samples,
      };
    });
  }

  _normalizeHistorySeries(raw, start, end) {
    const entries = this._getLegendEntries();
    const historyByEntity = new Map();
    const pointsCount = Math.max(20, Number(this._config?.points) || DEFAULT_CONFIG.points);
    const startMs = start.getTime();
    const endMs = end.getTime();

    if (Array.isArray(raw)) {
      raw.forEach((group, index) => {
        if (!Array.isArray(group)) {
          return;
        }

        const resolvedEntityId = group[0]?.entity_id || entries[index]?.entity;
        if (resolvedEntityId) {
          historyByEntity.set(resolvedEntityId, group);
        }
      });
    } else if (isObject(raw)) {
      Object.entries(raw).forEach(([entityId, group]) => {
        if (Array.isArray(group)) {
          historyByEntity.set(entityId, group);
        }
      });
    }

    return entries.map(entry => {
      const state = this._hass?.states?.[entry.entity];
      const rawGroup = historyByEntity.get(entry.entity) || [];
      const events = rawGroup
        .map(item => ({
          ts: parseHistoryTimestamp(
            item.last_changed
            || item.last_updated
            || item.lc
            || item.lu
            || item.last_changed_ts
            || item.last_updated_ts,
          ),
          value: parseNumber(item.state ?? item.s ?? item.value ?? item.v),
        }))
        .filter(item => Number.isFinite(item.ts) && Number.isFinite(item.value))
        .sort((left, right) => left.ts - right.ts);

      const currentValue = parseNumber(state?.state);
      if (Number.isFinite(currentValue)) {
        const nowTs = end.getTime();
        if (!events.length || Math.abs(events[events.length - 1].ts - nowTs) > 1000) {
          events.push({ ts: nowTs, value: currentValue });
        }
      }
      const samples = buildInterpolatedSamples(events, startMs, endMs, pointsCount, currentValue);

      return {
        ...entry,
        unit: String(
          state?.attributes?.unit_of_measurement
          || state?.attributes?.native_unit_of_measurement
          || "",
        ).trim(),
        currentValue: Number.isFinite(currentValue) ? currentValue : samples[samples.length - 1]?.value ?? 0,
        rawEventCount: events.length,
        samples,
      };
    });
  }

  async _requestHistory() {
    if (!this._hass || !this._getEntityEntries().length) {
      return;
    }

    const requestKey = this._getHistoryRequestKey();
    if (
      requestKey === this._historyKey &&
      this._historySeries.length &&
      Date.now() - this._historyLoadedAt < HISTORY_REFRESH_INTERVAL
    ) {
      return;
    }

    this._historyAbortController?.abort();
    const controller = new AbortController();
    this._historyAbortController = controller;

    const end = new Date();
    const hoursToShow = Math.max(1, Number(this._config?.hours_to_show) || DEFAULT_CONFIG.hours_to_show);
    const start = new Date(end.getTime() - (hoursToShow * 60 * 60 * 1000));

    try {
      const entityIds = this._getEntityEntries().map(entry => entry.entity);
      const raw = await this._fetchHistory(start, end, entityIds, controller.signal);
      if (!this.isConnected || controller.signal.aborted) {
        return;
      }

      const normalized = this._normalizeHistorySeries(raw || {}, start, end);
      const hasMeaningfulHistory = normalized.some(entry => entry.rawEventCount > 1 && entry.samples.length > 1);

      if (hasMeaningfulHistory) {
        this._historySeries = normalized;
        this._historyKey = requestKey;
        this._historyLoadedAt = Date.now();
        this._animateChartOnNextRender = true;
        this._render();
        return;
      }

      const statisticsRaw = await this._fetchStatistics(start, end, entityIds);
      if (!this.isConnected || controller.signal.aborted) {
        return;
      }

      const statisticsSeries = this._normalizeStatisticsSeries(statisticsRaw || {});
      const hasMeaningfulStatistics = statisticsSeries.some(entry => entry.rawEventCount > 1 && entry.samples.length > 1);
      this._historySeries = statisticsSeries;
      this._historyKey = hasMeaningfulStatistics ? requestKey : "";
      this._historyLoadedAt = hasMeaningfulStatistics ? Date.now() : 0;
      this._animateChartOnNextRender = true;
      this._render();
    } catch (_error) {
      if (!this.isConnected || controller.signal.aborted) {
        return;
      }

      this._historySeries = [];
      this._historyKey = "";
      this._historyLoadedAt = 0;
      this._animateChartOnNextRender = true;
      this._render();
    } finally {
      if (this._historyAbortController === controller) {
        this._historyAbortController = null;
      }
    }
  }

  _normalizeMetricUnit(unit) {
    return normalizeTextKey(
      String(unit || "")
        .replace("°", "")
        .replaceAll("/", "_")
        .replaceAll("-", "_"),
    );
  }

  _getPrimaryMetricProfile() {
    const selectedEntityId = this._getSelectedEntityId();
    const entry = this._getEntityEntries().find(item => item.entity === selectedEntityId) || this._getEntityEntries()[0];
    const state = entry?.entity ? this._hass?.states?.[entry.entity] || null : null;
    const unit = String(
      state?.attributes?.unit_of_measurement
      || state?.attributes?.native_unit_of_measurement
      || "",
    ).trim();
    const deviceClass = normalizeTextKey(state?.attributes?.device_class || "");
    const stateClass = normalizeTextKey(state?.attributes?.state_class || "");
    const entityId = String(entry?.entity || "");
    const domain = entityId.includes(".") ? entityId.split(".")[0] : "";
    const entityKey = normalizeTextKey(entityId);

    return {
      deviceClass,
      domain,
      entityKey,
      stateClass,
      unit,
      unitKey: this._normalizeMetricUnit(unit),
    };
  }

  _getSmartRangeSuggestion(dataMin, dataMax) {
    const profile = this._getPrimaryMetricProfile();
    const unitKey = profile.unitKey;
    const isPercent = profile.unit === "%" || unitKey === "percent";
    const isHumidity = profile.deviceClass === "humidity"
      || profile.deviceClass === "moisture"
      || /humidity|humedad|moisture|humitat|umidade/.test(profile.entityKey);
    if (isPercent && isHumidity) {
      return { min: 20, max: 80 };
    }

    const isBattery = profile.deviceClass === "battery" || /battery|bateria/.test(profile.entityKey);
    if (isPercent && isBattery) {
      return { min: 0, max: 100 };
    }

    const isTemperature = profile.deviceClass === "temperature"
      || unitKey === "c"
      || unitKey === "f";
    if (isTemperature) {
      if (unitKey === "f") {
        return { min: 60, max: 86 };
      }
      return { min: 16, max: 30 };
    }

    const isPower = /(kw|w|mw|kva|va)\b/.test(unitKey)
      || /power|potencia|consumo/.test(profile.entityKey);
    if (isPower) {
      const upper = Number.isFinite(dataMax) ? Math.max(1, dataMax) : 1;
      return { min: 0, max: upper * 1.12 };
    }

    const isEnergy = /(kwh|wh|mwh)\b/.test(unitKey)
      || profile.deviceClass === "energy";
    if (isEnergy) {
      const upper = Number.isFinite(dataMax) ? Math.max(1, dataMax) : 1;
      return { min: 0, max: upper * 1.08 };
    }

    const isCo2 = profile.deviceClass === "carbon_dioxide"
      || unitKey === "ppm"
      || /co2|carbon_dioxide/.test(profile.entityKey);
    if (isCo2) {
      return { min: 350, max: 2000 };
    }

    const isPressure = profile.deviceClass === "atmospheric_pressure"
      || /(hpa|mbar|bar|kpa|pa)\b/.test(unitKey);
    if (isPressure) {
      if (/(hpa|mbar)\b/.test(unitKey)) {
        return { min: 980, max: 1040 };
      }
      if (unitKey === "bar") {
        return { min: 0.98, max: 1.04 };
      }
    }

    return null;
  }

  _getGraphBounds(series) {
    const configuredMin = Number(this._config?.min);
    const configuredMax = Number(this._config?.max);
    const values = series.flatMap(entry => entry.samples.map(sample => sample.value)).filter(Number.isFinite);
    const dataMin = values.length ? Math.min(...values) : null;
    const dataMax = values.length ? Math.max(...values) : null;
    const suggestion = this._getSmartRangeSuggestion(dataMin, dataMax);

    let min = Number.isFinite(configuredMin)
      ? configuredMin
      : Number.isFinite(dataMin)
        ? dataMin
        : null;
    let max = Number.isFinite(configuredMax)
      ? configuredMax
      : Number.isFinite(dataMax)
        ? dataMax
        : null;

    if (!Number.isFinite(configuredMin) && suggestion?.min !== undefined) {
      min = Number(suggestion.min);
    }
    if (!Number.isFinite(configuredMax) && suggestion?.max !== undefined) {
      max = Number(suggestion.max);
    }

    // Keep suggested ranges stable (e.g. humidity 20-80) but never crop real data.
    if (suggestion && Number.isFinite(dataMin) && Number.isFinite(dataMax)) {
      if (!Number.isFinite(configuredMin) && dataMin < min) {
        min = dataMin;
      }
      if (!Number.isFinite(configuredMax) && dataMax > max) {
        max = dataMax;
      }
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = 0;
      max = 100;
    }

    if (!Number.isFinite(configuredMin) && !suggestion) {
      const spread = Math.max(max - min, 1);
      min -= spread * 0.14;
    }

    if (!Number.isFinite(configuredMax) && !suggestion) {
      const spread = Math.max(max - min, 1);
      max += spread * 0.08;
    }

    if (max <= min) {
      max = min + 1;
    }

    return { min, max };
  }

  _buildChartSeries(series) {
    const width = 100;
    const height = 56;
    const paddingX = -5.5;
    const paddingTop = 4;
    // Reserve extra bottom headroom so min values and stroke/glow
    // never get clipped by the rounded chart container.
    const paddingBottom = 14;
    const spanX = width - (paddingX * 2);
    const xMin = paddingX;
    const xMax = paddingX + spanX;
    const bounds = this._getGraphBounds(series);
    const range = Math.max(bounds.max - bounds.min, 1);

    return {
      width,
      height,
      paddingX,
      paddingTop,
      paddingBottom,
      xMin,
      xMax,
      entries: series.map(entry => {
        if (!entry.samples.length) {
          return {
            ...entry,
            points: [],
            linePath: "",
            fillPath: "",
          };
        }

        const points = entry.samples.map((sample, index) => {
          const x = paddingX + (spanX * index) / Math.max(entry.samples.length - 1, 1);
          const normalized = clamp((sample.value - bounds.min) / range, 0, 1);
          const y = paddingTop + ((height - paddingTop - paddingBottom) * (1 - normalized));
          return { x, y };
        });

        return {
          ...entry,
          points,
          linePath: buildSmoothPath(points),
          fillPath: buildAreaPath(points, height - paddingBottom),
        };
      }),
    };
  }

  _getHoverPayload(chart) {
    if (!this._hoverChart || !chart?.entries?.length || this._hoverIndex === null) {
      return null;
    }

    const boundedIndex = clamp(this._hoverIndex, 0, Math.max((chart.entries[0]?.samples?.length || 1) - 1, 0));
    const primaryEntry = chart.entries[0];
    const primarySample = primaryEntry?.samples?.[boundedIndex];
    const anchorPoint = primaryEntry?.points?.[boundedIndex];

    if (!primarySample || !anchorPoint) {
      return null;
    }

    const decimals = this._getDecimals();
    const locale = this._getLocaleTag();
    return {
      index: boundedIndex,
      label: formatHoverTimestamp(primarySample.ts, locale),
      x: anchorPoint.x,
      values: chart.entries
        .map(entry => {
          const sample = entry.samples?.[boundedIndex];
          if (!sample) {
            return null;
          }

          return {
            color: entry.color,
            name: entry.name,
            value: formatNumberValue(sample.value, decimals, locale),
            unit: entry.unit || this._getUnit(),
            point: entry.points?.[boundedIndex] || null,
          };
        })
        .filter(Boolean),
    };
  }

  _scheduleTooltipPositionSync(retries = 3) {
    if (this._tooltipSyncFrame) {
      window.cancelAnimationFrame(this._tooltipSyncFrame);
      this._tooltipSyncFrame = 0;
    }

    if (typeof window?.requestAnimationFrame !== "function") {
      this._syncTooltipPosition(retries);
      return;
    }

    this._tooltipSyncFrame = window.requestAnimationFrame(() => {
      this._tooltipSyncFrame = 0;
      this._syncTooltipPosition(retries);
    });
  }

  _syncTooltipPosition(retries = 0) {
    if (!this.shadowRoot) {
      return;
    }

    const tooltip = this.shadowRoot.querySelector(".graph-card__tooltip");
    const chartWrap = this.shadowRoot.querySelector(".graph-card__chart-wrap");
    if (!(tooltip instanceof HTMLElement) || !(chartWrap instanceof HTMLElement)) {
      return;
    }

    const anchorXPct = Number(tooltip.dataset.anchorXPct);
    if (!Number.isFinite(anchorXPct)) {
      return;
    }

    const wrapWidth = Math.round(
      chartWrap.getBoundingClientRect().width
      || chartWrap.clientWidth
      || chartWrap.offsetWidth
      || 0,
    );
    if (!wrapWidth) {
      if (retries > 0) {
        this._scheduleTooltipPositionSync(retries - 1);
      }
      return;
    }

    const viewport = typeof window === "undefined" ? null : window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width
      || (typeof document !== "undefined" ? document.documentElement?.clientWidth : 0)
      || (typeof window !== "undefined" ? window.innerWidth : 0)
      || 360;
    const viewportHeight = viewport?.height
      || (typeof document !== "undefined" ? document.documentElement?.clientHeight : 0)
      || (typeof window !== "undefined" ? window.innerHeight : 0)
      || 640;
    const chartRect = chartWrap.getBoundingClientRect();
    const anchorPx = clamp((anchorXPct / 100) * chartRect.width, 0, chartRect.width);
    const anchorViewportX = chartRect.left + anchorPx;
    const anchorViewportY = chartRect.top + Math.max(22, chartRect.height * 0.28);
    const maxTooltipWidth = Math.min(260, viewportWidth - 24);

    tooltip.style.maxWidth = `${maxTooltipWidth}px`;

    const tooltipBox = tooltip.getBoundingClientRect();
    const tooltipWidth = Math.min(Math.round(tooltipBox.width || tooltip.offsetWidth || 0) || maxTooltipWidth, maxTooltipWidth);
    const tooltipHeight = Math.round(tooltipBox.height || tooltip.offsetHeight || 0) || 112;
    if (!tooltipWidth || !tooltipHeight) {
      if (retries > 0) {
        this._scheduleTooltipPositionSync(retries - 1);
      }
      return;
    }

    const resolvedCenter = clamp(
      anchorViewportX,
      viewportLeft + (tooltipWidth / 2) + 12,
      viewportLeft + viewportWidth - (tooltipWidth / 2) - 12,
    );
    const shouldShowBelow = anchorViewportY - tooltipHeight - 14 < viewportTop + 12;
    const resolvedTop = shouldShowBelow
      ? clamp(anchorViewportY + 14, viewportTop + 12, viewportTop + viewportHeight - tooltipHeight - 12)
      : clamp(anchorViewportY - 14, viewportTop + tooltipHeight + 12, viewportTop + viewportHeight - 12);

    tooltip.style.left = `${resolvedCenter}px`;
    tooltip.style.top = `${resolvedTop}px`;
    tooltip.style.setProperty(
      "--graph-tooltip-transform",
      shouldShowBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)",
    );
    tooltip.style.opacity = "1";
    this._lastTooltipViewportPosition = {
      left: resolvedCenter,
      top: resolvedTop,
      transform: shouldShowBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)",
    };
  }

  _getSeriesData() {
    if (this._historySeries.some(entry => entry.samples?.length > 1)) {
      return this._historySeries;
    }
    return [];
  }

  _graphCardUi(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.graphCard;
    const enPack = window.NodaliaI18n?.strings?.("en")?.graphCard;
    const raw = pack?.[key] ?? enPack?.[key];
    return String(raw != null && raw !== "" ? raw : fallback);
  }

  _renderEmptyState() {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const title = escapeHtml(this._graphCardUi("emptyTitle", "Nodalia Graph Card"));
    const body = escapeHtml(
      this._graphCardUi("emptyBody", "Set `entities` to one or more numeric entities to show the chart."),
    );
    return `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        .graph-card--empty {
          background: ${styles.card.background};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          display: grid;
          gap: 6px;
          padding: ${styles.card.padding};
        }

        .graph-card__empty-title {
          color: var(--primary-text-color);
          font-size: 15px;
          font-weight: 700;
        }

        .graph-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }
      </style>
      <ha-card class="graph-card graph-card--empty">
        <div class="graph-card__empty-title">${title}</div>
        <div class="graph-card__empty-text">${body}</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const entries = this._getEntityEntries();
    const graphGuard = window.NodaliaUtils?.renderLovelaceEntityGuardForEntities?.(
      this._hass,
      entries.length ? entries.map((entry) => entry.entity) : [""],
      { cardClass: "graph-card" },
    );
    if (graphGuard) {
      this.shadowRoot.innerHTML = graphGuard;
      return;
    }

    const config = this._config || normalizeConfig({});
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const legendEntries = this._getLegendEntries();
    const showUnavailableBadge = config.show_unavailable_badge !== false && entries.some(entry => isUnavailableState(this._hass?.states?.[entry.entity]));
    const compactLayout = Number(config?.grid_options?.rows) > 0 && Number(config?.grid_options?.rows) <= 3;
    const currentValue = this._getCurrentValuesText();
    const allSeries = this._getSeriesData();
    const chart = this._buildChartSeries(this._getVisibleSeries(allSeries));
    this._hoverChart = chart;
    const hasGraphData = chart.entries.some(entry => entry.linePath);
    const hover = hasGraphData ? this._getHoverPayload(chart) : null;
    const hoverLineX = hover ? clamp(hover.x, 0, chart.width) : 0;
    const icon = this._getIcon();
    const title = this._getTitle();
    const accentColor = chart.entries[0]?.color || legendEntries[0]?.color || "var(--primary-color)";
    const contrastState = entries.map(entry => this._hass?.states?.[entry.entity]).find(Boolean) || null;
    const darkenBubbleIconGlyph = Boolean(
      contrastState && window.NodaliaBubbleContrast?.shouldDarkenBubbleIconGlyph(contrastState, accentColor),
    );
    const iconGlyphColor = darkenBubbleIconGlyph
      ? `color-mix(in srgb, var(--primary-text-color) 56%, ${accentColor})`
      : `color-mix(in srgb, ${accentColor} 72%, var(--primary-text-color))`;
    const chartHeight = `${Math.max(136, Math.min(parseSizeToPixels(styles.chart_height, 150), compactLayout ? 148 : 172))}px`;
    const valueSize = `${Math.max(26, Math.min(parseSizeToPixels(styles.value_size, 52), compactLayout ? 32 : 38))}px`;
    const unitSize = `${Math.max(12, Math.min(parseSizeToPixels(styles.unit_size, 18), compactLayout ? 14 : 16))}px`;
    const titleSize = `${Math.max(11, Math.min(parseSizeToPixels(styles.title_size, 14), compactLayout ? 11.5 : 12.5))}px`;
    const legendSize = `${Math.max(10, Math.min(parseSizeToPixels(styles.legend_size, 12), compactLayout ? 10 : 11))}px`;
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const lineWidth = `${Math.max(1.6, Math.min(parseSizeToPixels(styles.line_width, 2.2), compactLayout ? 1.9 : 2.2))}`;
    const padEdges = parsePaddingEdges(styles.card.padding, 14);
    const chartBleed = Math.round(Math.max(padEdges.left, padEdges.right) * 0.98);
    const chartBleedLeft = Math.round(padEdges.left);
    const chartBleedRight = Math.round(padEdges.right);
    const chartBleedBottom = Math.round(padEdges.bottom);
    const cardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 52%, ${styles.card.background} 100%)`;
    const computedCardBorder = `1px solid color-mix(in srgb, ${accentColor} 32%, var(--divider-color))`;
    const cardBorder = String(styles.card.border || "").trim() && styles.card.border !== DEFAULT_CONFIG.styles.card.border
      ? styles.card.border
      : computedCardBorder;
    const cardShadow = `${styles.card.box_shadow}, 0 16px 32px color-mix(in srgb, ${accentColor} 18%, rgba(0, 0, 0, 0.18))`;
    const tooltipTint = hover?.values?.[0]?.color || accentColor;
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const shouldAnimateChart = animations.enabled && (shouldAnimateEntrance || this._animateChartOnNextRender);
    const primaryHeaderAttr = this._canRunTapAction() && config.show_header !== false ? ' data-graph-action="primary"' : "";
    const primaryValueAttr = this._canRunTapAction() && config.show_value !== false ? ' data-graph-action="primary"' : "";
    const anchorXPct = hover ? graphChartXToPercent(hover.x, chart) : 0;
    const initialTooltipStyle = this._lastTooltipViewportPosition
      ? `left:${this._lastTooltipViewportPosition.left}px; top:${this._lastTooltipViewportPosition.top}px; opacity:1; --graph-tooltip-transform:${this._lastTooltipViewportPosition.transform}; --tooltip-tint:${escapeHtml(tooltipTint)};`
      : `left:-9999px; top:-9999px; opacity:0; --tooltip-tint:${escapeHtml(tooltipTint)};`;
    const tooltipMarkup = hover
      ? `
        <div
          class="graph-card__tooltip ${this._hoverEntering && animations.enabled ? "graph-card__tooltip--entering" : ""}"
          data-anchor-x-pct="${anchorXPct.toFixed(4)}"
          style="${initialTooltipStyle}"
        >
          <div class="graph-card__tooltip-time">${escapeHtml(hover.label)}</div>
          <div class="graph-card__tooltip-values">
            ${hover.values.map(item => `
              <div class="graph-card__tooltip-row">
                <span class="graph-card__tooltip-dot" style="background:${escapeHtml(item.color)};"></span>
                <span class="graph-card__tooltip-name">${escapeHtml(item.name)}</span>
                <span class="graph-card__tooltip-value">${escapeHtml(item.value)}${item.unit ? ` ${escapeHtml(item.unit)}` : ""}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `
      : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --graph-card-hover-duration: ${animations.enabled ? animations.hoverDuration : 0}ms;
          --graph-card-line-draw-duration: ${animations.enabled ? Math.max(560, Math.round(animations.hoverDuration * 2.7)) : 0}ms;
          --graph-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          display: block;
          height: 100%;
          min-height: 0;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }

        .graph-card {
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          display: block;
          position: relative;
        }

        .graph-card::before {
          background: linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0));
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .graph-card::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%);
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .graph-card__content {
          cursor: ${this._canRunTapAction() ? "pointer" : "default"};
          display: flex;
          flex-direction: column;
          gap: ${styles.card.gap};
          height: 100%;
          min-height: 0;
          padding: ${styles.card.padding};
          position: relative;
          z-index: 1;
        }

        .graph-card__content--entering {
          animation: graph-card-fade-up calc(var(--graph-card-hover-duration) * 2.25) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .graph-card__header {
          align-items: center;
          display: flex;
          gap: 8px;
          justify-content: flex-start;
          min-width: 0;
        }

        .graph-card__content--entering .graph-card__header {
          animation: graph-card-fade-up calc(var(--graph-card-hover-duration) * 2.1) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 35ms;
        }

        .graph-card__icon--entering {
          animation: graph-card-bubble-bloom calc(var(--graph-card-hover-duration) * 2.1) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 40ms;
        }

        .graph-card__primary-row {
          align-items: center;
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          gap: 10px 14px;
          justify-content: space-between;
          min-height: 0;
          min-width: 0;
        }

        .graph-card__header + .graph-card__primary-row {
          margin-top: 6px;
        }

        .graph-card__primary-row .graph-card__value {
          flex: 0 1 auto;
          min-width: 0;
        }

        .graph-card__primary-row .graph-card__legend {
          flex: 1 1 0;
          justify-content: flex-end;
          margin-bottom: 0;
          min-width: 0;
        }

        .graph-card__legend--solo {
          margin-bottom: 4px;
          width: 100%;
        }

        .graph-card__title {
          color: var(--primary-text-color);
          font-size: ${titleSize};
          font-weight: 700;
          line-height: 1.15;
          min-width: 0;
          opacity: 0.95;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .graph-card__icon {
          -webkit-backdrop-filter: blur(14px);
          align-items: center;
          backdrop-filter: blur(14px);
          background: color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${iconGlyphColor};
          display: inline-flex;
          height: 38px;
          justify-content: center;
          padding: 0;
          position: relative;
          width: 38px;
        }

        .graph-card__icon > ha-icon {
          --mdc-icon-size: ${Math.max(22, parseSizeToPixels(styles.icon.size, 28))}px;
          color: ${iconGlyphColor};
          height: ${Math.max(22, parseSizeToPixels(styles.icon.size, 28))}px;
          width: ${Math.max(22, parseSizeToPixels(styles.icon.size, 28))}px;
        }

        .graph-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          display: inline-flex;
          height: 18px;
          justify-content: center;
          line-height: 0;
          overflow: hidden;
          position: absolute;
          right: 0;
          top: 0;
          transform: translate(28%, -28%);
          width: 18px;
          z-index: 2;
        }

        .graph-card__icon .graph-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          align-items: center;
          color:#fff;
          display: flex;
          height: 11px;
          justify-content: center;
          left: auto;
          line-height: 0;
          margin-top: -1px;
          overflow: visible;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .graph-card__value {
          align-items: baseline;
          display: flex;
          flex-wrap: nowrap;
          gap: 4px;
          line-height: 0.9;
          min-width: 0;
        }

        .graph-card__content--entering > .graph-card__value,
        .graph-card__content--entering .graph-card__primary-row .graph-card__value {
          animation: graph-card-fade-up calc(var(--graph-card-hover-duration) * 2.2) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 75ms;
        }

        .graph-card__value-number {
          font-size: ${valueSize};
          font-weight: 520;
          letter-spacing: -0.042em;
          line-height: 0.86;
          min-width: 0;
        }

        .graph-card__value-unit {
          font-size: ${unitSize};
          font-weight: 560;
          line-height: 0.92;
          opacity: 0.9;
          padding-top: 1px;
        }

        .graph-card__legend {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 5px 6px;
          justify-content: flex-start;
          margin-bottom: 0;
          min-height: 0;
          padding-top: 0;
        }

        .graph-card__content--entering > .graph-card__legend,
        .graph-card__content--entering .graph-card__primary-row .graph-card__legend {
          animation: graph-card-fade-up calc(var(--graph-card-hover-duration) * 2.1) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 105ms;
        }

        .graph-card__legend-item {
          -webkit-backdrop-filter: blur(12px);
          align-items: center;
          backdrop-filter: blur(12px);
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--legend-color) 10%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border: 1px solid color-mix(in srgb, var(--legend-color) 20%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: ${chipBorderRadius};
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 8px 18px rgba(0, 0, 0, 0.1);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font-size: max(10px, calc(${legendSize} - 1px));
          gap: 6px;
          max-width: min(100%, 184px);
          min-width: 0;
          opacity: 0.9;
          padding: 4px 8px;
          transform: translateZ(0);
          transform-origin: center;
          transition: opacity 160ms ease, transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
          will-change: transform;
        }

        .graph-card__content--entering .graph-card__legend-item {
          animation: graph-card-legend-in calc(var(--graph-card-hover-duration) * 1.8) cubic-bezier(0.18, 0.9, 0.22, 1.12) both;
          animation-delay: calc(135ms + var(--legend-delay, 0ms));
        }

        .graph-card__legend-item:hover {
          opacity: 1;
          transform: translateY(-1px);
        }

        .graph-card__legend-item--active {
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--legend-color) 18%, color-mix(in srgb, var(--primary-text-color) 7%, transparent)), color-mix(in srgb, var(--primary-text-color) 5%, transparent));
          border-color: color-mix(in srgb, var(--legend-color) 34%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent),
            0 10px 24px color-mix(in srgb, var(--legend-color) 12%, rgba(0, 0, 0, 0.14));
        }

        .graph-card__legend-item--muted {
          opacity: 0.48;
        }

        .graph-card__legend-dot {
          border-radius: 999px;
          display: inline-flex;
          flex: 0 0 auto;
          height: 8px;
          width: 8px;
        }

        .graph-card__legend-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .graph-card__chart-wrap {
          -webkit-backdrop-filter: none;
          backdrop-filter: none;
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          flex: 1 1 auto;
          margin: 4px -${chartBleedRight}px -${chartBleedBottom}px -${chartBleedLeft}px;
          max-width: none;
          min-height: ${chartHeight};
          min-width: 0;
          overflow: hidden;
          padding: 0;
          position: relative;
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
          width: calc(100% + ${chartBleedLeft + chartBleedRight}px);
        }

        .graph-card__chart-wrap--entering {
          animation: graph-card-item-rise calc(var(--graph-card-hover-duration) * 2.25) cubic-bezier(0.18, 0.9, 0.22, 1.08) both;
        }

        .graph-card__hover-points-layer {
          bottom: 0;
          left: 0;
          overflow: hidden;
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 0;
          z-index: 2;
        }

        .graph-card__chart {
          display: block;
          height: 100%;
          position: relative;
          width: 100%;
          z-index: 1;
        }

        .graph-card__hover-line {
          stroke: color-mix(in srgb, var(--primary-text-color) 16%, transparent);
          stroke-dasharray: 2 4;
          stroke-width: 0.7;
        }

        .graph-card__hover-point {
          align-items: center;
          display: inline-flex;
          height: 14px;
          justify-content: center;
          left: 0;
          pointer-events: none;
          position: absolute;
          top: 0;
          transform: translate(-50%, -50%);
          width: 14px;
          z-index: 3;
        }

        .graph-card__hover-dot {
          background: radial-gradient(
            circle at 35% 35%,
            rgba(255, 255, 255, 0.98) 0 35%,
            color-mix(in srgb, var(--dot-color) 44%, rgba(255, 255, 255, 0.92)) 36% 100%
          );
          border-radius: 999px;
          box-shadow:
            0 0 0 3px color-mix(in srgb, var(--dot-color) 14%, transparent),
            0 0 10px color-mix(in srgb, var(--dot-color) 20%, transparent);
          display: block;
          flex-shrink: 0;
          height: 8px;
          width: 8px;
          animation: graph-card-hover-dot-pulse calc(var(--graph-card-hover-duration, 180ms) * 2.35) ease-in-out infinite alternate;
          transform-origin: center;
          will-change: transform;
        }

        .graph-card__tooltip {
          -webkit-backdrop-filter: blur(14px);
          backdrop-filter: blur(14px);
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--tooltip-tint) 20%, rgba(255,255,255,0.1)), rgba(255,255,255,0.02)),
            color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 94%, rgba(255,255,255,0.02));
          border: 1px solid color-mix(in srgb, var(--tooltip-tint) 22%, color-mix(in srgb, var(--primary-text-color) 10%, transparent));
          border-radius: 16px;
          box-shadow:
            0 10px 24px rgba(0, 0, 0, 0.24),
            0 2px 6px color-mix(in srgb, var(--tooltip-tint) 14%, transparent);
          color: var(--primary-text-color);
          display: grid;
          gap: 8px;
          max-width: min(260px, calc(100% - 20px));
          min-width: 186px;
          padding: 10px 12px 11px;
          pointer-events: none;
          position: fixed;
          transform: var(--graph-tooltip-transform, translate(-50%, -100%));
          will-change: left, top, transform;
          z-index: 2147483001;
        }

        .graph-card__tooltip::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--tooltip-tint) 18%, rgba(255,255,255,0.09)), rgba(255,255,255,0.025)),
            color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 90%, transparent);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 16%, transparent),
            inset 0 -1px 0 rgba(0, 0, 0, 0.06);
          z-index: -1;
        }

        .graph-card__tooltip--entering {
          animation: graph-card-tooltip-in var(--graph-card-hover-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .graph-card__tooltip-time {
          color: var(--secondary-text-color);
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .graph-card__tooltip-values {
          display: grid;
          gap: 5px;
        }

        .graph-card__tooltip-row {
          align-items: center;
          display: grid;
          gap: 7px;
          grid-template-columns: auto minmax(0, 1fr) auto;
          min-width: 0;
        }

        .graph-card__tooltip-dot {
          border-radius: 999px;
          display: inline-flex;
          height: 8px;
          width: 8px;
        }

        .graph-card__tooltip-name {
          color: var(--secondary-text-color);
          font-size: 10px;
          font-weight: 750;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .graph-card__tooltip-value {
          font-size: 12px;
          font-weight: 850;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .graph-card__chart-empty {
          align-items: center;
          color: var(--secondary-text-color);
          display: flex;
          font-size: 13px;
          inset: 0;
          justify-content: center;
          opacity: 0.8;
          position: absolute;
        }

        .graph-card__chart-series-fill {
          opacity: 1;
          transform-origin: center bottom;
        }

        .graph-card__chart-series-fill--entering {
          animation: graph-card-area-in var(--graph-card-line-draw-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: calc(40ms + var(--series-delay, 0ms));
        }

        .graph-card__chart-series-glow {
          display: block;
          fill: none;
          filter: url(#graph-glow);
          opacity: 0.12;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: calc(${lineWidth} * 1.8);
        }

        .graph-card__chart-series-line {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-opacity: 0.96;
          stroke-width: ${lineWidth};
        }

        .graph-card__chart-series-glow--entering {
          animation: graph-card-glow-draw var(--graph-card-line-draw-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: calc(70ms + var(--series-delay, 0ms));
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
        }

        .graph-card__chart-series-line--entering {
          animation: graph-card-line-draw var(--graph-card-line-draw-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: calc(70ms + var(--series-delay, 0ms));
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
        }

        .graph-card__hover-points-layer--entering .graph-card__hover-point {
          animation: graph-card-hover-point-in var(--graph-card-hover-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .graph-card__hover-line--entering {
          animation: graph-card-hover-line-in var(--graph-card-hover-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .graph-card__legend-item.is-pressing,
        .graph-card__content.is-pressing {
          animation: graph-card-button-bounce var(--graph-card-button-bounce-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        @keyframes graph-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes graph-card-item-rise {
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

        @keyframes graph-card-legend-in {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.94);
          }
          68% {
            opacity: 1;
            transform: translateY(0) scale(1.018);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes graph-card-bubble-bloom {
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

        @keyframes graph-card-area-in {
          0% {
            opacity: 0;
            transform: scaleY(0.74);
          }
          100% {
            opacity: 1;
            transform: scaleY(1);
          }
        }

        @keyframes graph-card-line-draw {
          0% {
            opacity: 0;
            stroke-dashoffset: 1;
          }
          36% {
            opacity: 1;
          }
          100% {
            opacity: 1;
            stroke-dashoffset: 0;
          }
        }

        @keyframes graph-card-glow-draw {
          0% {
            opacity: 0;
            stroke-dashoffset: 1;
          }
          36% {
            opacity: 0.14;
          }
          100% {
            opacity: 0.14;
            stroke-dashoffset: 0;
          }
        }

        @keyframes graph-card-tooltip-in {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes graph-card-hover-point-in {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.72);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes graph-card-hover-dot-pulse {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0.94;
            transform: scale(1.14);
          }
        }

        @keyframes graph-card-hover-line-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }

        @keyframes graph-card-button-bounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }

        ${animations.enabled ? "" : `
        .graph-card__legend-item,
        .graph-card__tooltip,
        .graph-card__hover-line,
        .graph-card__hover-point,
        .graph-card__hover-dot,
        .graph-card__content,
        .graph-card__header,
        .graph-card__primary-row,
        .graph-card__value,
        .graph-card__legend,
        .graph-card__chart-wrap,
        .graph-card__chart-series-fill,
        .graph-card__chart-series-glow,
        .graph-card__chart-series-line {
          animation: none !important;
          transition: none !important;
        }
        `}

        @media (max-width: 640px) {
          .graph-card__header {
            gap: 8px;
          }

          /* Keep value + legend chips on one row; scroll chips horizontally if needed
             (wrapping pushed the chart up and overlapped the plot). */
          .graph-card__primary-row {
            flex-wrap: nowrap;
            gap: 8px 10px;
          }

          .graph-card__primary-row .graph-card__value {
            flex: 0 1 auto;
            min-width: 0;
          }

          .graph-card__primary-row .graph-card__legend {
            flex: 1 1 0;
            flex-wrap: nowrap;
            justify-content: flex-end;
            margin-bottom: 0;
            min-width: 0;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            padding-block: 6px;
            scrollbar-width: thin;
            -webkit-overflow-scrolling: touch;
          }

          .graph-card__primary-row .graph-card__legend-item {
            flex-shrink: 0;
            max-width: min(52vw, 160px);
          }

          .graph-card__primary-row .graph-card__legend-item--active {
            box-shadow:
              inset 0 1px 0 color-mix(in srgb, var(--legend-color) 18%, rgba(255, 255, 255, 0.18)),
              inset 0 -1px 0 color-mix(in srgb, var(--legend-color) 12%, rgba(0, 0, 0, 0.08)),
              0 0 0 1px color-mix(in srgb, var(--legend-color) 10%, transparent);
          }
        }
        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <ha-card class="graph-card">
        <div class="graph-card__content ${shouldAnimateEntrance ? "graph-card__content--entering" : ""}">
          ${
            config.show_header !== false
              ? `
                <div class="graph-card__header"${primaryHeaderAttr}>
                  ${
                    config.show_icon !== false
                      ? `
                        <div class="graph-card__icon ${shouldAnimateEntrance ? "graph-card__icon--entering" : ""}">
                          <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
                          ${showUnavailableBadge ? `<span class="graph-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
                        </div>
                      `
                      : ""
                  }
                  <div class="graph-card__title">${escapeHtml(title)}</div>
                </div>
              `
              : ""
          }

          ${
            config.show_value !== false && config.show_legend !== false
              ? `
                <div class="graph-card__primary-row">
                  <div class="graph-card__value"${primaryValueAttr}>
                    <div class="graph-card__value-number">${escapeHtml(currentValue.value)}</div>
                    ${currentValue.unit ? `<div class="graph-card__value-unit">${escapeHtml(currentValue.unit)}</div>` : ""}
                  </div>
                  <div class="graph-card__legend">
                    ${legendEntries.map((entry, index) => `
                      <div
                        class="graph-card__legend-item ${entry.active ? "graph-card__legend-item--active" : ""} ${entry.muted ? "graph-card__legend-item--muted" : ""}"
                        data-graph-series="${escapeHtml(entry.entity)}"
                        style="--legend-color:${escapeHtml(entry.color)}; --legend-delay:${Math.min(index, 8) * 34}ms;"
                      >
                        <span class="graph-card__legend-dot" style="background:${escapeHtml(entry.color)};"></span>
                        <span class="graph-card__legend-text">${escapeHtml(entry.name)}</span>
                      </div>
                    `).join("")}
                  </div>
                </div>
              `
              : ""
          }
          ${
            config.show_value !== false && config.show_legend === false
              ? `
                <div class="graph-card__value"${primaryValueAttr}>
                  <div class="graph-card__value-number">${escapeHtml(currentValue.value)}</div>
                  ${currentValue.unit ? `<div class="graph-card__value-unit">${escapeHtml(currentValue.unit)}</div>` : ""}
                </div>
              `
              : ""
          }
          ${
            config.show_value === false && config.show_legend !== false
              ? `
                <div class="graph-card__legend graph-card__legend--solo">
                  ${legendEntries.map((entry, index) => `
                    <div
                      class="graph-card__legend-item ${entry.active ? "graph-card__legend-item--active" : ""} ${entry.muted ? "graph-card__legend-item--muted" : ""}"
                      data-graph-series="${escapeHtml(entry.entity)}"
                      style="--legend-color:${escapeHtml(entry.color)}; --legend-delay:${Math.min(index, 8) * 34}ms;"
                    >
                      <span class="graph-card__legend-dot" style="background:${escapeHtml(entry.color)};"></span>
                      <span class="graph-card__legend-text">${escapeHtml(entry.name)}</span>
                    </div>
                  `).join("")}
                </div>
              `
              : ""
          }

          <div class="graph-card__chart-wrap ${shouldAnimateChart ? "graph-card__chart-wrap--entering" : ""}" data-graph-surface="chart" data-visible-inset="${chartBleed}">
            <svg class="graph-card__chart" viewBox="0 0 ${chart.width} ${chart.height}" preserveAspectRatio="none">
              <defs>
                <filter id="graph-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="1.5" />
                </filter>
                ${chart.entries.map((entry, index) => `
                  <linearGradient id="graph-fill-${index}" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="${escapeHtml(entry.color)}" stop-opacity="0.3"></stop>
                    <stop offset="52%" stop-color="${escapeHtml(entry.color)}" stop-opacity="0.12"></stop>
                    <stop offset="100%" stop-color="${escapeHtml(entry.color)}" stop-opacity="0"></stop>
                  </linearGradient>
                `).join("")}
              </defs>
              ${
                hover
                  ? `<line class="graph-card__hover-line ${this._hoverEntering && animations.enabled ? "graph-card__hover-line--entering" : ""}" x1="${hoverLineX.toFixed(2)}" y1="0" x2="${hoverLineX.toFixed(2)}" y2="${chart.height}"></line>`
                  : ""
              }
              ${chart.entries.map((entry, index) => `
                ${
                  config.show_fill !== false
                    ? `<path class="graph-card__chart-series-fill ${shouldAnimateChart ? "graph-card__chart-series-fill--entering" : ""}" style="--series-delay:${Math.min(index, 8) * 42}ms;" d="${entry.fillPath}" fill="url(#graph-fill-${index})"></path>`
                    : ""
                }
                <path class="graph-card__chart-series-glow ${shouldAnimateChart ? "graph-card__chart-series-glow--entering" : ""}" style="--series-delay:${Math.min(index, 8) * 42}ms;" pathLength="1" d="${entry.linePath}" stroke="${escapeHtml(entry.color)}"></path>
                <path class="graph-card__chart-series-line ${shouldAnimateChart ? "graph-card__chart-series-line--entering" : ""}" style="--series-delay:${Math.min(index, 8) * 42}ms;" pathLength="1" d="${entry.linePath}" stroke="${escapeHtml(entry.color)}"></path>
              `).join("")}
            </svg>
            ${
              hover
                ? `
                  <div class="graph-card__hover-points-layer ${this._hoverEntering && animations.enabled ? "graph-card__hover-points-layer--entering" : ""}">
                    ${chart.entries.map(entry => {
                      const point = hover.values.find(item => item.name === entry.name)?.point;
                      if (!point) {
                        return "";
                      }
                      const left = clamp(graphChartXToPercent(point.x, chart), 0.3, 99.7);
                      const top = clamp((point.y / chart.height) * 100, 0.3, 99.7);
                      return `
                        <span class="graph-card__hover-point" style="left:${left}%; top:${top}%; --dot-color:${escapeHtml(entry.color)};">
                          <span class="graph-card__hover-dot"></span>
                        </span>
                      `;
                    }).join("")}
                  </div>
                `
                : ""
            }
            ${hasGraphData ? "" : `<div class="graph-card__chart-empty">${escapeHtml(window.NodaliaI18n?.translateGraphEmptyHistory?.(this._hass, this._config?.language ?? "auto") || "No history available")}</div>`}
          </div>
        </div>
      </ha-card>
      ${tooltipMarkup}
    `;

    this._scheduleTooltipPositionSync(4);
    this._hoverEntering = false;
    if (shouldAnimateEntrance) {
      this._animateContentOnNextRender = false;
    }
    if (shouldAnimateChart) {
      this._animateChartOnNextRender = false;
    }
  }
}
  _lazyNodaliaGraphCard = NodaliaGraphCard;
  return NodaliaGraphCard;
}
