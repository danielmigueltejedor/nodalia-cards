// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  AIR_QUALITY_COMFORT_KEYS,
  AIR_QUALITY_GRAPH_SERIES_COLORS,
  AIR_QUALITY_HISTORY_REFRESH_MS,
  AIR_QUALITY_LEVEL_COLORS,
  AIR_QUALITY_METRIC_KEYS,
  AIR_QUALITY_POLLUTION_KEYS,
  AIR_QUALITY_WHO_BANDS,
  CARD_TAG,
  COVER_SET_POSITION,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  LOCK_LOCK,
  OPTIMISTIC_TOGGLE_TIMEOUT,
  OVERVIEW_LAYOUTS,
} from "./entity-constants";
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
  sanitizeCssValue,
  setByPath,
} from "./entity-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, entityScalar, normalizeAirQualityBlock, normalizeConfig } from "./entity-config";
import {
  applyStubEntity,
  buildAirQualityAreaPath,
  buildAirQualityChartGeometry,
  buildAirQualityInterpolatedSamples,
  buildAirQualitySmoothPath,
  coverEntityIsOpen,
  entitySupportedFeatures,
  entitySupportsFeature,
  formatNumericValue,
  formatNumericValueWithUnit,
  getAirQualityHoverPayload,
  getDynamicEntityIcon,
  getEntityDomain,
  getHomeAssistantStateDisplayValue,
  getSelectEntityCurrentValue,
  getSelectEntityOptions,
  getValueSignature,
  humanizeSelectOptionLabel,
  isSelectDomainEntity,
  isUnavailableState,
  parseAirQualityHistoryTimestamp,
  parseAirQualityNumeric,
  parseNumericValue,
  parseSizeToPixels,
  readAirQualityAttribute,
  resolveAirQualityLevelFromAqi,
  resolveAirQualityLevelFromBands,
  resolveEntityBubbleIconGlyphColor,
  resolveMetricGuidelineBands,
  shouldDarkenEntityBubbleIconGlyph,
  worseAirQualityLevel,
} from "./entity-helpers";

let _lazyNodaliaEntityCard;
export function loadNodaliaEntityCard() {
  if (_lazyNodaliaEntityCard) {
    return _lazyNodaliaEntityCard;
  }
class NodaliaEntityCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, [], entities, entitiesFallback);
  }

  static getEntitySuggestion(hass, entityId) {
    const domain = String(entityId || "").split(".")[0];
    const suggestions = [
      window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, {
        label: "Entity — Standard",
      }),
      window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, {
        label: domain === "media_player" ? "Entity Card — Compact media state" : "Entity — Compact",
        buildConfig: (_hass, selectedEntityId) => ({ entity: selectedEntityId, compact_layout_mode: "always" }),
      }),
    ];
    return suggestions.filter(Boolean);
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
    this._aqHistoryCache = null;
    this._aqHistoryKey = "";
    this._aqHistoryAbort = null;
    this._aqHistoryTimer = 0;
    this._aqHistoryLoading = false;
    this._aqHoverPreview = null;
    this._aqHiddenSeries = new Set();
    this._aqHoverTimeFormatter = null;
    this._aqHoverTimeFormatterLocale = "";
    this._cardWidth = 0;
    this._isCompactLayout = false;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._suppressNextEntityTap = false;
    this._selectPickerOpen = false;
    this._selectPickerAnimating = false;
    this._selectPickerCloseTimer = 0;
    this._selectPickerEnterTimer = 0;
    this._selectPickerAnimationToken = 0;
    this._resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextWidth = Math.round(entry.contentRect?.width || this.clientWidth || 0);
      // Ignore collapse glitches (display:none, mid-reflow 0-width). Treating those
      // as "not compact" expands the card; sections can lock a taller footprint.
      if (nextWidth < 48) {
        return;
      }
      const nextCompact = this._shouldUseCompactLayout(nextWidth);

      if (nextWidth === this._cardWidth && nextCompact === this._isCompactLayout) {
        return;
      }

      this._cardWidth = nextWidth;
      this._isCompactLayout = nextCompact;

      const signature = this._getRenderSignature();
      if (signature === this._lastRenderSignature) {
        return;
      }

      this._lastRenderSignature = signature;
      this._render();
    });
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowPointerDown = this._onShadowPointerDown.bind(this);
    this._onShadowKeyDown = this._onShadowKeyDown.bind(this);
    this._onShadowPointerMove = this._onShadowPointerMove.bind(this);
    this._onShadowPointerLeave = this._onShadowPointerLeave.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown);
    this.shadowRoot.addEventListener("pointermove", this._onShadowPointerMove);
    this.shadowRoot.addEventListener("pointerleave", this._onShadowPointerLeave);
    this.shadowRoot.addEventListener("keydown", this._onShadowKeyDown);
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const path = event.composedPath();
              const actionTarget = path.find(
                node => node instanceof HTMLElement && node.dataset?.entityAction,
              );
              const action = actionTarget?.dataset?.entityAction;
              return action === "body" || action === "icon" ? action : null;
            },
            shouldBeginHold: zone => {
              const state = this._getState();
              return Boolean(state && this._canRunHoldAction(state, zone));
            },
            onHold: zone => {
              const state = this._getState();
              if (!state) {
                return;
              }
              this._triggerPressAnimation(this.shadowRoot.querySelector(".entity-card__content"));
              this._triggerPressAnimation(this.shadowRoot.querySelector(".entity-card__icon"));
              this._performHoldAction(state, zone);
            },
            markHoldConsumedClick: () => {
              this._suppressNextEntityTap = true;
              window.NodaliaUtils?.cancelCardZoneTap?.(this);
            },
          })
        : () => {};
    }

  connectedCallback() {
    this._detachHostHold?.reconnect?.();
    this._resizeObserver?.observe(this);
    this._scheduleOptimisticToggleTimeout();
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    this._detachHostHold?.();
    this._resizeObserver?.disconnect();
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    this._animateContentOnNextRender = true;
    this._selectPickerOpen = false;
    this._selectPickerAnimating = false;
    this._clearSelectPickerAnimationTimer("_selectPickerCloseTimer");
    this._clearSelectPickerAnimationTimer("_selectPickerEnterTimer");
    this.classList.remove("entity-card-host--select-open");
    this._lastRenderSignature = "";
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._clearOptimisticToggleTimer();
    this._clearAirQualityHistory();
    this._aqHoverPreview = null;
    this._aqHoverTimeFormatter = null;
    this._aqHoverTimeFormatterLocale = "";
  }

  setConfig(config) {
    const previousEntity = this._config?.entity || "";
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    if (previousEntity && previousEntity !== this._config.entity) {
      this._clearOptimisticToggleState();
    }
    this._isCompactLayout = this._shouldUseCompactLayout(
      Math.round(this._cardWidth || this.clientWidth || 0),
    );
    this._lastRenderSignature = "";
    this._aqHoverPreview = null;
    this._aqHiddenSeries.clear();
    this._selectPickerOpen = false;
    this._clearSelectPickerAnimationTimer("_selectPickerCloseTimer");
    this._clearSelectPickerAnimationTimer("_selectPickerEnterTimer");
    this._animateContentOnNextRender = true;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    let nextSignature = this._getRenderSignature();
    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature && !this._optimisticToggle) {
      return;
    }

    this._syncOptimisticToggleState(this._getActualState());
    nextSignature = this._getRenderSignature();

    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }

    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    if (this._config?.layout === "air_quality") {
      return this._config?.air_quality?.show_graphs === true ? 5 : 3;
    }
    if (OVERVIEW_LAYOUTS.has(this._config?.layout)) {
      const count = this._config?.[this._config.layout]?.entities?.length || 0;
      return Math.max(3, 2 + Math.ceil(count / 2));
    }
    return 3;
  }

  getGridOptions() {
    if (this._config?.layout === "air_quality" || OVERVIEW_LAYOUTS.has(this._config?.layout)) {
      return {
        rows: "auto",
        columns: 12,
        min_rows: 3,
        min_columns: 6,
      };
    }
    return {
      rows: "auto",
      columns: "full",
      min_rows: 2,
      min_columns: 2,
    };
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const actualState = entityId ? hass?.states?.[entityId] || null : null;
    const state = hass === this._hass ? this._buildOptimisticToggleState(actualState) : actualState;
    const attrs = state?.attributes || {};
    const configuredStateAttribute = String(this._config?.state_attribute || "").trim();
    const configuredPrimaryAttribute = String(this._config?.primary_attribute || "").trim();
    const configuredSecondaryAttribute = String(this._config?.secondary_attribute || "").trim();
    const aq = this._config?.air_quality || {};
    const aqParts = AIR_QUALITY_METRIC_KEYS.map(key => {
      const metricEntity = entityScalar(aq[key]);
      const metricState = metricEntity ? hass?.states?.[metricEntity] : null;
      return [
        key,
        metricEntity,
        String(metricState?.state ?? ""),
        String(metricState?.last_updated || metricState?.last_changed || ""),
      ].join("=");
    });
    const overviewParts = ["battery", "network"].flatMap(layout => (
      (this._config?.[layout]?.entities || []).map((item, index) => {
        const overviewState = item.entity ? hass?.states?.[item.entity] : null;
        const attrs = overviewState?.attributes || {};
        return [
          layout,
          index,
          item.entity,
          item.name,
          item.icon,
          item.role || "",
          String(overviewState?.state ?? ""),
          String(attrs.battery_level ?? attrs.battery ?? ""),
          String(attrs.unit_of_measurement ?? ""),
          String(overviewState?.last_updated || overviewState?.last_changed || ""),
        ].join("=");
      })
    ));
    return [
      `l:${window.NodaliaI18n.resolveLanguage(hass, this._config?.language)}`,
      `e:${entityId}`,
      `s:${String(state?.state || "")}`,
      `sd:${getHomeAssistantStateDisplayValue(state, hass)}`,
      `o:${String(attrs._nodalia_optimistic_toggle || "")}`,
      `lu:${String(state?.last_updated || state?.last_changed || "")}`,
      `sa:${configuredStateAttribute}`,
      `sv:${configuredStateAttribute ? String(attrs[configuredStateAttribute] ?? "") : ""}`,
      `pa:${configuredPrimaryAttribute}`,
      `pv:${configuredPrimaryAttribute ? getValueSignature(attrs[configuredPrimaryAttribute]) : ""}`,
      `xa:${configuredSecondaryAttribute}`,
      `xv:${configuredSecondaryAttribute ? getValueSignature(attrs[configuredSecondaryAttribute]) : ""}`,
      `uei:${this._config?.use_entity_icon ? 1 : 0}`,
      `sep:${this._config?.show_entity_picture ? 1 : 0}`,
      `ep:${String(this._config?.entity_picture || attrs.entity_picture_local || attrs.entity_picture || "")}`,
      `ci:${String(this._config?.icon || "")}`,
      `ia:${String(this._config?.icon_active || "")}`,
      `ii:${String(this._config?.icon_inactive || "")}`,
      `c:${this._isCompactLayout ? 1 : 0}`,
      `ct:${this._shouldShowCompactTitle() ? 1 : 0}`,
      `qa:${Array.isArray(this._config?.quick_actions) ? this._config.quick_actions.length : 0}`,
      `tap:${String(this._config?.tap_action || "")}`,
      `itap:${String(this._config?.icon_tap_action ?? "")}`,
      `ts:${String(this._config?.tap_service || "")}`,
      `its:${String(this._config?.icon_tap_service || "")}`,
      `tu:${String(this._config?.tap_url || "")}`,
      `itu:${String(this._config?.icon_tap_url || "")}`,
      `hold:${String(this._config?.hold_action || "")}`,
      `ihold:${String(this._config?.icon_hold_action ?? "")}`,
      `hs:${String(this._config?.hold_service || "")}`,
      `ihs:${String(this._config?.icon_hold_service || "")}`,
      `hu:${String(this._config?.hold_url || "")}`,
      `ihu:${String(this._config?.icon_hold_url || "")}`,
      `sn:${this._config?.show_name !== false ? 1 : 0}`,
      `ss:${this._config?.show_state !== false ? 1 : 0}`,
      `nm:${String(this._config?.name || "")}`,
      `sel:${isSelectDomainEntity(state) ? getSelectEntityOptions(state).join("\u001f") : ""}`,
      `ly:${String(this._config?.layout || "default")}`,
      `aqg:${String(aq.guidelines || "who")}`,
      `aqs:${aq.show_graphs === true ? 1 : 0}`,
      `aqh:${Number(aq.graph_hours) || 24}`,
      `aqsr:${AIR_QUALITY_METRIC_KEYS.map(key => aq.graph_series?.[key] === false ? 0 : 1).join("")}`,
      `aqcl:${AIR_QUALITY_METRIC_KEYS.map(key => String(aq.graph_colors?.[key] || "")).join(",")}`,
      `aqv:${[...this._aqHiddenSeries].sort().join(",")}`,
      `aq:${aqParts.join(";")}`,
      `aqc:${this._aqHistoryCache ? 1 : 0}`,
      `ov:${overviewParts.join(";")}`,
    ].join("|");
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) ? numericColumns : null;
  }

  _getConfiguredGridRows() {
    const numericRows = Number(this._config?.grid_options?.rows);
    return Number.isFinite(numericRows) ? numericRows : null;
  }

  _shouldUseCompactLayout(width) {
    return window.NodaliaUtils.shouldUseCompactCardLayout({
      mode: this._config?.compact_layout_mode,
      width,
      gridColumns: this._getConfiguredGridColumns(),
      parentWidth: window.NodaliaUtils.resolveCompactLayoutParentWidth?.(this) || 0,
    });
  }

  _shouldShowCompactTitle(width) {
    return window.NodaliaUtils.shouldShowCompactCardTitle({
      width: Math.round(width || this._cardWidth || this.clientWidth || 0),
    });
  }

  _getState() {
    return this._buildOptimisticToggleState(this._getActualState());
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

  _clearOptimisticToggleTimer() {
    if (this._optimisticToggleTimer) {
      window.clearTimeout(this._optimisticToggleTimer);
      this._optimisticToggleTimer = 0;
    }
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
    if (!actualState || !this._isBinaryOnOff(actualState) || actualKey === expectedKey) {
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
    if (!entityId || !this._isBinaryOnOff(actualState)) {
      return;
    }

    this._clearOptimisticToggleState();
    this._optimisticToggle = {
      entityId,
      expectedState,
      expiresAt: Date.now() + OPTIMISTIC_TOGGLE_TIMEOUT,
      stateSnapshot: this._createStateSnapshot(actualState),
    };
    this._scheduleOptimisticToggleTimeout();
  }

  _buildOptimisticToggleState(actualState = this._getActualState()) {
    if (!this._isOptimisticTogglePending(actualState)) {
      return actualState;
    }

    const snapshot = this._optimisticToggle?.stateSnapshot || actualState;
    if (!snapshot) {
      return actualState;
    }

    return {
      ...snapshot,
      entity_id: snapshot.entity_id || actualState?.entity_id || this._config?.entity,
      state: this._optimisticToggle.expectedState,
      attributes: {
        ...(snapshot.attributes || {}),
        ...(actualState?.attributes || {}),
        _nodalia_optimistic_toggle: this._optimisticToggle.expectedState,
      },
    };
  }

  _syncOptimisticToggleState(actualState = this._getActualState()) {
    if (!this._optimisticToggle) {
      return;
    }
    if (!this._isOptimisticTogglePending(actualState)) {
      this._clearOptimisticToggleTimer();
      return;
    }
    this._scheduleOptimisticToggleTimeout();
  }

  _getDomain(entityId = this._config?.entity) {
    return String(entityId || "").split(".")[0] || "";
  }

  _isHomeAssistantToggleable(state) {
    if (!state?.entity_id) {
      return false;
    }

    const stateKey = normalizeTextKey(state.state);
    if (!stateKey || stateKey === "unavailable") {
      return false;
    }

    const domain = this._getDomain(state.entity_id);
    return [
      "switch",
      "light",
      "fan",
      "cover",
      "lock",
      "input_boolean",
      "automation",
      "script",
      "valve",
      "siren",
      "remote",
      "water_heater",
      "humidifier",
      "media_player",
    ].includes(domain);
  }

  _canToggleEntity(state = this._getActualState()) {
    return this._isBinaryOnOff(state) || this._isHomeAssistantToggleable(state);
  }

  _usesDomainToggleService(state = this._getActualState()) {
    const domain = this._getDomain(state?.entity_id);
    return domain === "cover" || domain === "lock";
  }

  _isSelectEntity(state = this._getActualState()) {
    return isSelectDomainEntity(state) && getSelectEntityOptions(state).length > 0;
  }

  _getSelectOptions(state = this._getActualState()) {
    return getSelectEntityOptions(state);
  }

  _getSelectCurrentValue(state = this._getActualState()) {
    return getSelectEntityCurrentValue(state);
  }

  _formatSelectOptionLabel(option) {
    const chipLabel = window.NodaliaI18n?.translateEntityStateChip?.(
      this._hass,
      this._config?.language ?? "auto",
      option,
    );
    if (chipLabel) {
      return chipLabel;
    }
    return humanizeSelectOptionLabel(option);
  }

  _shouldOpenSelectPickerOnTap(state, zone = "body") {
    const tapAction = String(this._effectiveTapAction(zone) || "auto").trim().toLowerCase();
    if (tapAction !== "auto") {
      return false;
    }
    if (isUnavailableState(state)) {
      return false;
    }
    return this._isSelectEntity(state);
  }

  _getSelectPanelDuration(animations = this._getAnimationSettings()) {
    return animations.enabled
      ? Math.max(220, Math.round((animations.contentDuration || 420) * 0.72))
      : 0;
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

  _syncSelectPickerHostState(isOpen) {
    this.classList.toggle("entity-card-host--select-open", isOpen === true);
    const card = this.shadowRoot?.querySelector(".entity-card");
    if (card instanceof HTMLElement) {
      card.classList.toggle("entity-card--select-open", isOpen === true);
    }
  }

  _getSelectPickerShellHost() {
    return this.shadowRoot?.querySelector("[data-select-picker-shell]") || null;
  }

  _buildSelectPickerShellMarkup(state, accentColor, animationClass = "") {
    const panelMarkup = this._renderSelectPickerPanel(state, accentColor);
    if (!panelMarkup) {
      return "";
    }
    const shellClass = animationClass
      ? `entity-card__select-picker-shell ${animationClass}`.trim()
      : "entity-card__select-picker-shell";
    return `
      <div class="${shellClass}">
        <div class="entity-card__select-picker-inner">
          ${panelMarkup}
        </div>
      </div>
    `;
  }

  _refreshSelectPickerContent(state, accentColor, options = {}) {
    const shellHost = this._getSelectPickerShellHost();
    if (!(shellHost instanceof HTMLElement) || !this._isSelectEntity(state)) {
      return;
    }
    const markup = this._buildSelectPickerShellMarkup(state, accentColor);
    if (!markup) {
      shellHost.replaceChildren();
      return;
    }
    const shellNode = this._createMarkupNode(markup);
    if (shellNode instanceof HTMLElement) {
      shellHost.replaceChildren(shellNode);
      return;
    }
    shellHost.innerHTML = markup;
  }

  _setSelectPickerVisibility(isOpen, state = this._getState()) {
    const nextOpen = isOpen === true;
    if (nextOpen === this._selectPickerOpen) {
      if (!nextOpen) {
        return;
      }
      if (!this._selectPickerAnimating) {
        this._refreshSelectPickerContent(state, this._getAccentColor(state));
      }
      return;
    }

    this._selectPickerOpen = nextOpen;
    this._syncSelectPickerHostState(nextOpen);

    const shellHost = this._getSelectPickerShellHost();
    if (!(shellHost instanceof HTMLElement) || !state || !this._isSelectEntity(state)) {
      this._lastRenderSignature = "";
      this._render();
      return;
    }

    const animations = this._getAnimationSettings();
    const accentColor = this._getAccentColor(state);
    const panelDuration = this._getSelectPanelDuration(animations);
    const existingShell = shellHost.querySelector(".entity-card__select-picker-shell");

    this._clearSelectPickerAnimationTimer("_selectPickerCloseTimer");
    this._clearSelectPickerAnimationTimer("_selectPickerEnterTimer");
    const animationToken = ++this._selectPickerAnimationToken;

    const clearShellHost = () => {
      shellHost.replaceChildren();
    };

    const mountStaticShell = () => {
      this._refreshSelectPickerContent(state, accentColor);
    };

    const removeShell = shell => {
      if (!(shell instanceof HTMLElement)) {
        clearShellHost();
        this._selectPickerAnimating = false;
        return;
      }

      this._selectPickerAnimating = true;
      shell.classList.remove("entity-card__select-picker-shell--entering");
      shell.classList.add("entity-card__select-picker-shell--leaving");

      const finalizeRemoval = () => {
        if (animationToken !== this._selectPickerAnimationToken || this._selectPickerOpen) {
          return;
        }
        this._clearSelectPickerAnimationTimer("_selectPickerCloseTimer");
        if (shell.isConnected) {
          shell.remove();
        }
        if (!shellHost.querySelector(".entity-card__select-picker-shell")) {
          clearShellHost();
        }
        this._selectPickerAnimating = false;
      };

      shell.addEventListener("animationend", finalizeRemoval, { once: true });
      this._selectPickerCloseTimer = window.NodaliaUtils?.scheduleDeferTimer?.(
        this,
        finalizeRemoval,
        panelDuration + 80,
      ) || 0;
    };

    const appendShell = () => {
      const markup = this._buildSelectPickerShellMarkup(
        state,
        accentColor,
        animations.enabled ? "entity-card__select-picker-shell--entering" : "",
      );
      const shellNode = this._createMarkupNode(markup);
      if (!(shellNode instanceof HTMLElement)) {
        this._lastRenderSignature = "";
        this._render();
        return;
      }

      clearShellHost();
      shellHost.appendChild(shellNode);
      this._selectPickerAnimating = animations.enabled;

      if (!animations.enabled) {
        this._selectPickerAnimating = false;
        return;
      }

      const finalizeEnter = () => {
        if (
          animationToken !== this._selectPickerAnimationToken
          || !this._selectPickerOpen
          || shellNode.classList.contains("entity-card__select-picker-shell--leaving")
        ) {
          return;
        }
        this._clearSelectPickerAnimationTimer("_selectPickerEnterTimer");
        if (shellNode.isConnected) {
          shellNode.classList.remove("entity-card__select-picker-shell--entering");
        }
        this._selectPickerAnimating = false;
      };

      shellNode.addEventListener("animationend", finalizeEnter, { once: true });
      this._selectPickerEnterTimer = window.NodaliaUtils?.scheduleDeferTimer?.(
        this,
        finalizeEnter,
        panelDuration + 80,
      ) || 0;
    };

    if (!animations.enabled) {
      if (existingShell instanceof HTMLElement) {
        existingShell.remove();
      }
      if (nextOpen) {
        mountStaticShell();
      } else {
        clearShellHost();
      }
      this._selectPickerAnimating = false;
      return;
    }

    if (!nextOpen) {
      if (existingShell instanceof HTMLElement) {
        removeShell(existingShell);
      } else {
        clearShellHost();
        this._selectPickerAnimating = false;
      }
      return;
    }

    if (existingShell instanceof HTMLElement) {
      existingShell.classList.remove("entity-card__select-picker-shell--leaving");
      mountStaticShell();
      this._selectPickerAnimating = false;
      return;
    }

    appendShell();
  }

  _openSelectPicker() {
    if (this._selectPickerOpen) {
      return;
    }
    this._setSelectPickerVisibility(true);
  }

  _closeSelectPicker() {
    if (!this._selectPickerOpen) {
      return;
    }
    this._setSelectPickerVisibility(false);
  }

  _toggleSelectPicker() {
    if (this._selectPickerOpen) {
      this._closeSelectPicker();
      return;
    }
    this._openSelectPicker();
  }

  _clearSelectPickerAnimationTimer(timerKey) {
    const timer = this[timerKey];
    if (!timer || typeof window === "undefined") {
      this[timerKey] = 0;
      return;
    }
    window.clearTimeout(timer);
    this._nodaliaDeferTimers?.delete?.(timer);
    this[timerKey] = 0;
  }

  _selectEntityOption(optionValue) {
    const entityId = this._config?.entity;
    const state = this._getActualState();
    if (!entityId || !state || isUnavailableState(state)) {
      return;
    }
    const value = String(optionValue ?? "").trim();
    if (!value) {
      return;
    }
    const domain = this._getDomain(entityId);
    const serviceDomain = domain === "input_select" ? "input_select" : "select";
    this._invokeEntityService(serviceDomain, "select_option", entityId, { option: value });
    this._closeSelectPicker();
  }

  _invokeEntityService(domain, service, entityId, serviceData = {}) {
    const invoke = window.NodaliaUtils?.invokeHomeAssistantService?.bind(window.NodaliaUtils)
      || ((host, hass, svcDomain, svc, data) => Promise.resolve(hass?.callService?.(svcDomain, svc, data)));
    return invoke(this, this._hass, domain, service, {
      entity_id: entityId,
      ...serviceData,
    });
  }

  _toggleCoverEntity(state, entityId) {
    if (coverEntityIsOpen(state)) {
      if (entitySupportsFeature(state, COVER_SET_POSITION)) {
        this._invokeEntityService("cover", "set_cover_position", entityId, { position: 0 });
      } else {
        this._invokeEntityService("cover", "close_cover", entityId);
      }
      return;
    }

    if (entitySupportsFeature(state, COVER_SET_POSITION)) {
      this._invokeEntityService("cover", "set_cover_position", entityId, { position: 100 });
    } else {
      this._invokeEntityService("cover", "open_cover", entityId);
    }
  }

  _toggleLockEntity(state, entityId) {
    const stateKey = normalizeTextKey(state?.state);
    if (["locking", "unlocking", "jammed", "unavailable", "unknown"].includes(stateKey)) {
      return;
    }

    const features = entitySupportedFeatures(state);
    if (stateKey === "locked") {
      this._invokeEntityService("lock", "unlock", entityId);
      return;
    }

    if (features & LOCK_LOCK) {
      this._invokeEntityService("lock", "lock", entityId);
    } else {
      this._invokeEntityService("lock", "lock", entityId);
    }
  }

  _isBinaryOnOff(state) {
    const stateKey = normalizeTextKey(state?.state);
    return stateKey === "on" || stateKey === "off";
  }

  _isActiveState(state) {
    const stateKey = normalizeTextKey(state?.state);

    if (!stateKey || ["off", "closed", "locked", "unavailable", "unknown", "none", "idle", "standby"].includes(stateKey)) {
      return false;
    }

    return true;
  }

  _getAccentColor(state) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    return this._isActiveState(state)
      ? styles?.icon?.on_color || DEFAULT_CONFIG.styles.icon.on_color
      : styles?.icon?.off_color || DEFAULT_CONFIG.styles.icon.off_color;
  }

  _getNumberDecimals() {
    const configuredValue = Number(this._config?.number_decimals);
    return Number.isFinite(configuredValue) ? clamp(Math.round(configuredValue), 0, 6) : 2;
  }

  _translateStateValue(state) {
    const displayValue = getHomeAssistantStateDisplayValue(state, this._hass);
    if (displayValue) {
      return displayValue;
    }
    const hass = window.NodaliaI18n?.resolveHass?.(this._hass) ?? this._hass;
    const lang = window.NodaliaI18n.resolveLanguage(hass, this._config?.language ?? "auto");
    return window.NodaliaI18n.translateEntityState(
      lang,
      state,
      this._getNumberDecimals(),
      formatNumericValueWithUnit,
      formatNumericValue,
      parseNumericValue,
    );
  }

  _formatAttributeValue(state, attributeName) {
    if (!state || !attributeName) {
      return null;
    }

    const value = state.attributes?.[attributeName];

    if (value === undefined || value === null || value === "") {
      return null;
    }

    const key = normalizeTextKey(attributeName);
    const numberDecimals = this._getNumberDecimals();

    if (typeof value === "boolean") {
      const hass = window.NodaliaI18n?.resolveHass?.(this._hass) ?? this._hass;
      const lang = window.NodaliaI18n.resolveLanguage(hass, this._config?.language ?? "auto");
      const labels = window.NodaliaI18n.strings(lang).entityCard.boolean;
      return value ? labels.yes : labels.no;
    }

    if (Array.isArray(value)) {
      return value
        .map(item => {
          if (isObject(item) && item.name) {
            return item.name;
          }
          return String(item ?? "").trim();
        })
        .filter(Boolean)
        .join(", ");
    }

    if (isObject(value)) {
      if (value.name) {
        return String(value.name);
      }

      const keys = Object.keys(value).sort();
      return keys.map(key => `${key}:${String(value[key] ?? "")}`).join(", ");
    }

    const numericValue = parseNumericValue(value);
    if (numericValue !== null) {
      if (["battery", "battery_level", "humidity", "current_humidity"].includes(key)) {
        return `${Math.round(numericValue)}%`;
      }

      if (key === "brightness") {
        return `${Math.round((numericValue / 255) * 100)}%`;
      }

      if (key === "volume_level") {
        return `${Math.round(numericValue * 100)}%`;
      }

      if (key.includes("temperature")) {
        const unit = state.attributes?.temperature_unit || "°C";
        return formatNumericValueWithUnit(numericValue, unit, numberDecimals);
      }

      return formatNumericValue(numericValue, numberDecimals);
    }

    return String(value);
  }

  _getTitle(state) {
    return this._config?.name || state?.attributes?.friendly_name || this._config?.entity || "Entity";
  }

  _getIcon(state) {
    const trimIcon = value => (typeof value === "string" ? value.trim() : "");
    const iconActive = trimIcon(this._config?.icon_active);
    const iconInactive = trimIcon(this._config?.icon_inactive);
    const configuredIcon = trimIcon(this._config?.icon);
    const hasStateIcons = Boolean(iconActive || iconInactive);

    if (hasStateIcons) {
      const chosen = this._isActiveState(state) ? iconActive : iconInactive;
      if (chosen) {
        return chosen;
      }
    }

    if (configuredIcon) {
      return configuredIcon;
    }

    if (this._config?.use_entity_icon === true) {
      const resolvedEntityIcon = trimIcon(state?.attributes?.icon) || getDynamicEntityIcon(state);
      if (resolvedEntityIcon) {
        return resolvedEntityIcon;
      }
    }

    return trimIcon(state?.attributes?.icon) || "mdi:tune";
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

  _effectiveTapAction(zone) {
    if (zone === "icon") {
      const raw = this._config?.icon_tap_action;
      if (raw === undefined || raw === null || String(raw).trim() === "") {
        return this._config?.tap_action || "auto";
      }
      return String(raw).trim() || "auto";
    }
    return String(this._config?.tap_action || "auto").trim() || "auto";
  }

  _effectiveHoldAction(zone) {
    if (zone === "icon") {
      const raw = this._config?.icon_hold_action;
      if (raw === undefined || raw === null || String(raw).trim() === "") {
        return this._config?.hold_action || "none";
      }
      return String(raw).trim() || "none";
    }
    return String(this._config?.hold_action || "none").trim() || "none";
  }

  _canRunTapAction(state, zone = "body") {
    const tapAction = String(this._effectiveTapAction(zone) || "auto").trim().toLowerCase();
    if (tapAction === "none") {
      return false;
    }

    if (tapAction === "service") {
      const service = zone === "icon" ? this._config?.icon_tap_service : this._config?.tap_service;
      return Boolean(service && String(service).trim());
    }

    if (tapAction === "url") {
      const url = zone === "icon" ? this._config?.icon_tap_url : this._config?.tap_url;
      return Boolean(url && String(url).trim());
    }

    if (tapAction === "navigate") {
      return Boolean(this._navigationPathForZone(zone, "tap"));
    }

    if (tapAction === "toggle") {
      return this._canToggleEntity(this._getActualState());
    }

    if (tapAction === "more-info") {
      return Boolean(this._config?.entity);
    }

    if (tapAction === "auto") {
      return Boolean(this._config?.entity);
    }

    return false;
  }

  _canRunHoldAction(state, zone = "body") {
    const holdAction = String(this._effectiveHoldAction(zone) || "none").trim().toLowerCase();
    if (holdAction === "none") {
      return false;
    }

    if (holdAction === "service") {
      let service = zone === "icon" ? this._config?.icon_hold_service : this._config?.hold_service;
      if (zone === "icon" && !String(service || "").trim()) {
        service = this._config?.hold_service;
      }
      return Boolean(service && String(service).trim());
    }

    if (holdAction === "url") {
      let url = zone === "icon" ? this._config?.icon_hold_url : this._config?.hold_url;
      if (zone === "icon" && !String(url || "").trim()) {
        url = this._config?.hold_url;
      }
      return Boolean(url && String(url).trim());
    }

    if (holdAction === "navigate") {
      return Boolean(this._navigationPathForZone(zone, "hold"));
    }

    if (holdAction === "toggle") {
      return this._canToggleEntity(this._getActualState());
    }

    if (holdAction === "more-info") {
      return Boolean(this._config?.entity);
    }

    if (holdAction === "auto") {
      return Boolean(this._config?.entity);
    }

    return false;
  }

  _effectiveDoubleTapAction(zone) {
    if (zone === "icon") {
      const raw = this._config?.icon_double_tap_action;
      if (raw === undefined || raw === null || String(raw).trim() === "") {
        return this._config?.double_tap_action || "none";
      }
      return String(raw).trim() || "none";
    }
    return String(this._config?.double_tap_action || "none").trim() || "none";
  }

  _canRunDoubleTapAction(state, zone = "body") {
    const doubleAction = String(this._effectiveDoubleTapAction(zone) || "none").trim().toLowerCase();
    if (doubleAction === "none") {
      return false;
    }

    if (doubleAction === "service") {
      let service = zone === "icon" ? this._config?.icon_double_tap_service : this._config?.double_tap_service;
      if (zone === "icon" && !String(service || "").trim()) {
        service = this._config?.double_tap_service;
      }
      return Boolean(service && String(service).trim());
    }

    if (doubleAction === "url") {
      let url = zone === "icon" ? this._config?.icon_double_tap_url : this._config?.double_tap_url;
      if (zone === "icon" && !String(url || "").trim()) {
        url = this._config?.double_tap_url;
      }
      return Boolean(url && String(url).trim());
    }

    if (doubleAction === "navigate") {
      return Boolean(this._navigationPathForZone(zone, "double"));
    }

    if (doubleAction === "toggle") {
      return this._canToggleEntity(this._getActualState());
    }

    if (doubleAction === "more-info" || doubleAction === "auto") {
      return Boolean(this._config?.entity);
    }

    return false;
  }

  _toggleEntity(entityId = this._config?.entity) {
    const state = this._hass?.states?.[entityId];
    const isPrimaryEntity = entityId && entityId === this._config?.entity;
    const actualState = isPrimaryEntity ? this._getActualState() : state;
    const effectiveState = isPrimaryEntity ? this._getState() : state;
    if (!this._hass || !entityId || !actualState) {
      return;
    }

    if (this._isBinaryOnOff(actualState)) {
      const service = normalizeTextKey(effectiveState.state) === "on" ? "turn_off" : "turn_on";
      if (isPrimaryEntity) {
        this._startOptimisticToggle(service === "turn_on" ? "on" : "off", actualState);
      }
      this._invokeEntityService("homeassistant", service, entityId);
      if (isPrimaryEntity) {
        this._render();
      }
      return;
    }

    const domain = this._getDomain(entityId);
    if (domain === "cover") {
      this._toggleCoverEntity(actualState, entityId);
      if (isPrimaryEntity) {
        this._render();
      }
      return;
    }

    if (domain === "lock") {
      this._toggleLockEntity(actualState, entityId);
      if (isPrimaryEntity) {
        this._render();
      }
      return;
    }

    if (!this._isHomeAssistantToggleable(actualState)) {
      return;
    }

    this._invokeEntityService("homeassistant", "toggle", entityId);
    if (isPrimaryEntity) {
      this._render();
    }
  }

  _openMoreInfo(entityId = this._config?.entity) {
    if (!entityId) {
      return;
    }

    fireEvent(this, "hass-more-info", {
      entityId,
    });
  }

  _navigationPathForZone(zone = "body", actionKind = "tap") {
    const kind = actionKind === "hold" ? "hold" : actionKind === "double" ? "double" : "tap";
    const pathKey = kind === "tap"
      ? "navigation_path"
      : kind === "hold"
        ? "hold_navigation_path"
        : "double_tap_navigation_path";
    const iconPathKey = kind === "tap"
      ? "icon_navigation_path"
      : kind === "hold"
        ? "icon_hold_navigation_path"
        : "icon_double_tap_navigation_path";
    const urlKey = kind === "tap" ? "tap_url" : kind === "hold" ? "hold_url" : "double_tap_url";
    const iconUrlKey = kind === "tap" ? "icon_tap_url" : kind === "hold" ? "icon_hold_url" : "icon_double_tap_url";
    if (zone === "icon") {
      const iconPath = String(this._config?.[iconPathKey] ?? "").trim();
      if (iconPath) {
        return iconPath;
      }
      const inheritedBodyPath = String(this._config?.[pathKey] ?? "").trim();
      if (inheritedBodyPath) {
        return inheritedBodyPath;
      }
      return String(this._config?.[iconUrlKey] ?? "").trim() || String(this._config?.[urlKey] ?? "").trim();
    }

    const bodyPath = String(this._config?.[pathKey] ?? "").trim();
    if (bodyPath) {
      return bodyPath;
    }

    return String(this._config?.[urlKey] ?? "").trim();
  }

  _navigateToPath(path) {
    const navigationPath = String(path || "").trim();
    if (!navigationPath) {
      return;
    }

    if (this._hass?.navigate) {
      this._hass.navigate(navigationPath);
      return;
    }

    if (window?.history?.pushState && !navigationPath.includes("://")) {
      window.history.pushState(null, "", navigationPath);
      fireEvent(this, "location-changed", { replace: false });
      return;
    }

    fireEvent(this, "hass-navigate", { path: navigationPath });
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
      return normalizedService === "homeassistant.toggle"
        || normalizedService === "homeassistant.turn_on"
        || normalizedService === "homeassistant.turn_off";
    }
    return services.includes(normalizedService) || domains.includes(domain);
  }

  _callConfiguredService(serviceValue, entityId = this._config?.entity, rawData = "", rawTarget = "") {
    if (!this._hass || !serviceValue) {
      return;
    }

    if (!this._isServiceAllowed(serviceValue)) {
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Entity Card", serviceValue);
      return;
    }

    const [domain, service] = String(serviceValue).split(".");
    if (!domain || !service) {
      return;
    }

    const payload = this._parseServiceData(rawData);
    const target = this._parseServiceData(rawTarget);
    const hasExplicitTarget = Object.keys(target).length > 0;
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

  _openConfiguredUrl(urlValue = this._config?.tap_url, newTab = this._config?.tap_new_tab === true) {
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

  _performTapAction(state, zone = "body") {
    const tapAction = String(this._effectiveTapAction(zone) || "auto").trim().toLowerCase();
    const tapService = zone === "icon" ? this._config?.icon_tap_service : this._config?.tap_service;
    const tapServiceData = zone === "icon" ? this._config?.icon_tap_service_data : this._config?.tap_service_data;
    const tapServiceTarget = zone === "icon" ? this._config?.icon_tap_service_target : this._config?.tap_service_target;
    const tapUrl = zone === "icon" ? this._config?.icon_tap_url : this._config?.tap_url;
    const tapNewTab = zone === "icon" ? this._config?.icon_tap_new_tab === true : this._config?.tap_new_tab === true;

    switch (tapAction) {
      case "toggle":
        this._toggleEntity(this._config?.entity);
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service":
        this._callConfiguredService(tapService, this._config?.entity, tapServiceData, tapServiceTarget);
        break;
      case "url":
        this._openConfiguredUrl(tapUrl, tapNewTab);
        break;
      case "navigate":
        this._navigateToPath(this._navigationPathForZone(zone, "tap"));
        break;
      case "auto":
      default:
        if (this._shouldOpenSelectPickerOnTap(state, zone)) {
          this._toggleSelectPicker();
          return;
        }
        if (this._isBinaryOnOff(state) || this._usesDomainToggleService(state)) {
          this._toggleEntity(this._config?.entity);
          return;
        }

        this._openMoreInfo(this._config?.entity);
        break;
    }
  }

  _performHoldAction(state, zone = "body") {
    const holdAction = String(this._effectiveHoldAction(zone) || "none").trim().toLowerCase();
    let holdService = zone === "icon" ? this._config?.icon_hold_service : this._config?.hold_service;
    let holdServiceData = zone === "icon" ? this._config?.icon_hold_service_data : this._config?.hold_service_data;
    let holdServiceTarget = zone === "icon" ? this._config?.icon_hold_service_target : this._config?.hold_service_target;
    let holdUrl = zone === "icon" ? this._config?.icon_hold_url : this._config?.hold_url;
    let holdNewTab = zone === "icon" ? this._config?.icon_hold_new_tab === true : this._config?.hold_new_tab === true;
    if (zone === "icon") {
      if (!String(holdService || "").trim()) {
        holdService = this._config?.hold_service;
        holdServiceData = this._config?.hold_service_data;
        holdServiceTarget = this._config?.hold_service_target;
      }
      if (!String(holdUrl || "").trim()) {
        holdUrl = this._config?.hold_url;
        holdNewTab = this._config?.hold_new_tab === true;
      }
    }

    switch (holdAction) {
      case "toggle":
        this._toggleEntity(this._config?.entity);
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service":
        this._callConfiguredService(holdService, this._config?.entity, holdServiceData, holdServiceTarget);
        break;
      case "url":
        this._openConfiguredUrl(holdUrl, holdNewTab);
        break;
      case "navigate":
        this._navigateToPath(this._navigationPathForZone(zone, "hold"));
        break;
      case "auto":
      default:
        if (this._isBinaryOnOff(state) || this._usesDomainToggleService(state)) {
          this._toggleEntity(this._config?.entity);
          return;
        }

        this._openMoreInfo(this._config?.entity);
        break;
    }
  }

  _performDoubleTapAction(state, zone = "body") {
    const doubleAction = String(this._effectiveDoubleTapAction(zone) || "none").trim().toLowerCase();
    let doubleService = zone === "icon" ? this._config?.icon_double_tap_service : this._config?.double_tap_service;
    let doubleServiceData = zone === "icon" ? this._config?.icon_double_tap_service_data : this._config?.double_tap_service_data;
    let doubleServiceTarget = zone === "icon" ? this._config?.icon_double_tap_service_target : this._config?.double_tap_service_target;
    let doubleUrl = zone === "icon" ? this._config?.icon_double_tap_url : this._config?.double_tap_url;
    let doubleNewTab = zone === "icon" ? this._config?.icon_double_tap_new_tab === true : this._config?.double_tap_new_tab === true;
    if (zone === "icon") {
      if (!String(doubleService || "").trim()) {
        doubleService = this._config?.double_tap_service;
        doubleServiceData = this._config?.double_tap_service_data;
        doubleServiceTarget = this._config?.double_tap_service_target;
      }
      if (!String(doubleUrl || "").trim()) {
        doubleUrl = this._config?.double_tap_url;
        doubleNewTab = this._config?.double_tap_new_tab === true;
      }
    }

    switch (doubleAction) {
      case "toggle":
        this._toggleEntity(this._config?.entity);
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service":
        this._callConfiguredService(doubleService, this._config?.entity, doubleServiceData, doubleServiceTarget);
        break;
      case "url":
        this._openConfiguredUrl(doubleUrl, doubleNewTab);
        break;
      case "navigate":
        this._navigateToPath(this._navigationPathForZone(zone, "double"));
        break;
      case "auto":
      default:
        if (this._isBinaryOnOff(state) || this._usesDomainToggleService(state)) {
          this._toggleEntity(this._config?.entity);
          return;
        }

        this._openMoreInfo(this._config?.entity);
        break;
    }
  }

  _performQuickAction(action) {
    const targetEntity = action?.entity || this._config?.entity;

    switch (action?.type) {
      case "toggle":
        this._toggleEntity(targetEntity);
        break;
      case "more-info":
        this._openMoreInfo(targetEntity);
        break;
      case "service":
        this._callConfiguredService(action?.service, targetEntity, action?.service_data);
        break;
      default:
        break;
    }
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
      this.shadowRoot?.querySelectorAll([
        ".entity-card__content--entering",
        ".entity-card__hero--entering",
        ".entity-card__icon--entering",
        ".entity-card__copy--entering",
        ".entity-card__actions--entering",
      ].join(",")).forEach(element => {
        const entranceClasses = Array.from(element.classList).filter(name => name.endsWith("--entering"));
        element.classList.remove(...entranceClasses);
      });
      this._animateContentOnNextRender = false;
    }, safeDelay);
  }

  _triggerEntityPressFeedback(action, actionTarget) {
    const hapticStyle = action === "select-option" ? "selection" : null;
    this._triggerHaptic(hapticStyle);

    if (action === "body" || action === "icon") {
      const opensSelectPicker = this._shouldOpenSelectPickerOnTap(this._getState(), action);
      if (!opensSelectPicker) {
        this._triggerPressAnimation(this.shadowRoot.querySelector(".entity-card__content"));
      }
      this._triggerPressAnimation(this.shadowRoot.querySelector(".entity-card__icon"));
      return;
    }

    if (actionTarget instanceof HTMLElement) {
      this._triggerPressAnimation(actionTarget);
    }
  }

  _onShadowPointerDown(event) {
    if (typeof event.button === "number" && event.button !== 0) {
      return;
    }

    const actionTarget = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.entityAction);

    if (!actionTarget) {
      return;
    }

    const action = actionTarget.dataset.entityAction;
    if (action === "body" || action === "icon") {
      if (this._suppressNextEntityTap) {
        return;
      }
      this._triggerEntityPressFeedback(action, actionTarget);
      return;
    }

    if (action === "select-option" || action === "quick" || action === "metric-info" || action === "graph-series-toggle") {
      this._triggerEntityPressFeedback(action, actionTarget);
    }
  }

  _onShadowClick(event) {
    const actionTarget = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.entityAction);

    if (!actionTarget) {
      return;
    }

    const state = this._getState();
    const action = actionTarget.dataset.entityAction;

    event.preventDefault();
    event.stopPropagation();

    if (action === "graph-series-toggle") {
      const kind = String(actionTarget.dataset.seriesKind || "").trim();
      if (!AIR_QUALITY_METRIC_KEYS.includes(kind)) {
        return;
      }
      if (this._aqHiddenSeries.has(kind)) {
        this._aqHiddenSeries.delete(kind);
      } else {
        this._aqHiddenSeries.add(kind);
      }
      if (this._aqHoverPreview?.kind === kind) {
        this._aqHoverPreview = null;
      }
      this._lastRenderSignature = "";
      this._render();
      return;
    }

    if (action === "metric-info") {
      this._openMoreInfo(String(actionTarget.dataset.entity || "").trim());
      return;
    }

    if (action === "select-option") {
      const value = actionTarget.dataset.selectValue || "";
      this._selectEntityOption(value);
      return;
    }

    if (action === "body" || action === "icon") {
      if (this._suppressNextEntityTap) {
        this._suppressNextEntityTap = false;
        return;
      }
      const zone = action;
      const runTap = () => {
        if (!this._canRunTapAction(state, zone)) {
          return;
        }
        this._performTapAction(state, zone);
      };
      const runDouble = () => {
        if (!this._canRunDoubleTapAction(state, zone)) {
          return;
        }
        this._performDoubleTapAction(state, zone);
      };
      if (this._canRunDoubleTapAction(state, zone) && typeof window.NodaliaUtils?.scheduleCardZoneTap === "function") {
        window.NodaliaUtils.scheduleCardZoneTap(this, { zone, onSingle: runTap, onDouble: runDouble });
        return;
      }
      runTap();
      return;
    }

    if (action === "quick") {
      const index = Number(actionTarget.dataset.index);
      const quickAction = this._config?.quick_actions?.[index];

      if (!quickAction) {
        return;
      }

      this._performQuickAction(quickAction);
    }
  }

  _onShadowKeyDown(event) {
    if (window.NodaliaUtils?.isKeyboardActivationEvent?.(event) !== true) {
      return;
    }
    this._onShadowClick(event);
  }

  _renderChip(label, tone = "default", options = {}) {
    if (!label) {
      return "";
    }

    const entityId = String(options.entityId || "").trim();
    if (entityId) {
      return `
        <button
          type="button"
          class="entity-card__chip entity-card__chip--${tone} entity-card__chip--clickable"
          data-entity-action="metric-info"
          data-entity="${escapeHtml(entityId)}"
          aria-label="${escapeHtml(options.ariaLabel || label)}"
        >${escapeHtml(label)}</button>
      `;
    }
    return `<div class="entity-card__chip entity-card__chip--${tone}">${escapeHtml(label)}</div>`;
  }

  _entityCardUi(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.entityCard;
    const enPack = window.NodaliaI18n?.strings?.("en")?.entityCard;
    const nested = key.includes(".") ? getByPath(pack, key) ?? getByPath(enPack, key) : undefined;
    const raw = nested ?? pack?.[key] ?? enPack?.[key];
    return String(raw != null && raw !== "" ? raw : fallback);
  }

  _airQualityLevelLabel(level) {
    const key = String(level || "unknown");
    return this._entityCardUi(`airQuality.levels.${key}`, key.replace(/_/g, " "));
  }

  _airQualityMetricLabel(kind) {
    return this._entityCardUi(`airQuality.metrics.${kind}`, kind.toUpperCase());
  }

  _collectAirQualityMetrics(primaryState) {
    const aq = this._config?.air_quality || normalizeAirQualityBlock();
    const guidelines = aq.guidelines === "none" ? "none" : "who";
    const decimals = this._getNumberDecimals();
    const metrics = [];

    for (const kind of AIR_QUALITY_METRIC_KEYS) {
      const entityId = entityScalar(aq[kind]);
      let stateObj = entityId ? this._hass?.states?.[entityId] : null;
      let rawValue = stateObj ? stateObj.state : null;
      let unit = String(stateObj?.attributes?.unit_of_measurement || "");

      if ((rawValue === null || rawValue === undefined || rawValue === "" || rawValue === "unknown" || rawValue === "unavailable")
        && primaryState) {
        const attrValue = readAirQualityAttribute(primaryState, kind);
        if (attrValue !== null) {
          rawValue = attrValue;
          stateObj = primaryState;
          if (!unit) {
            const attrUnitKey = `${kind}_unit`;
            unit = String(primaryState.attributes?.[attrUnitKey] || primaryState.attributes?.unit_of_measurement || "");
            if (kind.startsWith("pm") && !unit) {
              unit = "µg/m³";
            }
            if (kind === "humidity" && !unit) {
              unit = "%";
            }
            if (kind === "temperature" && !unit) {
              unit = "°C";
            }
            if (kind === "co2" && !unit) {
              unit = "ppm";
            }
          }
        }
      }

      if (rawValue === null || rawValue === undefined || rawValue === "" || rawValue === "unknown" || rawValue === "unavailable") {
        continue;
      }

      const numeric = parseAirQualityNumeric(rawValue);
      if (!Number.isFinite(numeric)) {
        continue;
      }

      let level = "unknown";
      if (guidelines === "who" && AIR_QUALITY_POLLUTION_KEYS.has(kind)) {
        level = resolveAirQualityLevelFromBands(numeric, resolveMetricGuidelineBands(kind, unit));
      }

      const display = formatNumericValueWithUnit
        ? formatNumericValueWithUnit(numeric, unit, decimals)
        : `${Number(numeric.toFixed(decimals))}${unit ? ` ${unit}` : ""}`;

      metrics.push({
        kind,
        entityId,
        infoEntityId: entityId || stateObj?.entity_id || primaryState?.entity_id || "",
        numeric,
        unit,
        display,
        level,
        label: this._airQualityMetricLabel(kind),
      });
    }

    return { metrics, guidelines };
  }

  _resolveAirQualityOverall(primaryState, metrics, guidelines) {
    let overall = "unknown";
    if (guidelines === "who") {
      for (const metric of metrics) {
        if (!AIR_QUALITY_POLLUTION_KEYS.has(metric.kind)) {
          continue;
        }
        overall = worseAirQualityLevel(overall, metric.level);
      }
    }

    const primaryNumeric = parseAirQualityNumeric(primaryState?.state);
    const deviceClass = String(primaryState?.attributes?.device_class || "").toLowerCase();
    const primaryIsAqi = deviceClass === "aqi"
      || /aqi|air_quality_index/i.test(String(primaryState?.entity_id || ""))
      || /aqi|air_quality_index/i.test(String(primaryState?.attributes?.friendly_name || ""));

    if (guidelines === "who" && primaryIsAqi && Number.isFinite(primaryNumeric)) {
      overall = worseAirQualityLevel(overall, resolveAirQualityLevelFromAqi(primaryNumeric));
    }

    return {
      overall,
      primaryNumeric: Number.isFinite(primaryNumeric) ? primaryNumeric : null,
      primaryIsAqi,
      accent: AIR_QUALITY_LEVEL_COLORS[overall] || AIR_QUALITY_LEVEL_COLORS.unknown,
    };
  }

  _commonAria(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.common?.aria;
    const enPack = window.NodaliaI18n?.strings?.("en")?.common?.aria;
    return String(pack?.[key] ?? enPack?.[key] ?? fallback);
  }

  _renderSelectPickerPanel(state, accentColor) {
    const options = this._getSelectOptions(state);
    if (!options.length) {
      return "";
    }
    const current = this._getSelectCurrentValue(state);
    const pickerTitle = this._entityCardUi("selectPickerTitle", "Choose option");

    return `
      <div
        class="entity-card__select-picker"
        role="listbox"
        aria-label="${escapeHtml(pickerTitle)}"
      >
        <div class="entity-card__select-options">
          ${options.map(option => {
            const isActive = normalizeTextKey(option) === normalizeTextKey(current);
            const label = this._formatSelectOptionLabel(option);
            return `
              <button
                type="button"
                class="entity-card__select-option${isActive ? " is-active" : ""}"
                data-entity-action="select-option"
                data-select-value="${escapeHtml(option)}"
                role="option"
                aria-selected="${isActive ? "true" : "false"}"
                style="--select-option-accent:${escapeHtml(accentColor)};"
              >
                <span class="entity-card__select-option-indicator" aria-hidden="true"></span>
                <span class="entity-card__select-option-label">${escapeHtml(label)}</span>
                ${isActive ? '<ha-icon class="entity-card__select-option-check" icon="mdi:check"></ha-icon>' : ""}
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  _renderEmptyState() {
    const title = escapeHtml(this._entityCardUi("emptyTitle", "Nodalia Entity Card"));
    const body = escapeHtml(this._entityCardUi("emptyBody", "Set `entity` to show this card."));
    return `
      <ha-card class="entity-card entity-card--empty">
        <div class="entity-card__empty-title">${title}</div>
        <div class="entity-card__empty-text">${body}</div>
      </ha-card>
    `;
  }

  _airQualityMetricIcon(kind) {
    switch (kind) {
      case "pm1":
        return "mdi:dots-hexagon";
      case "pm25":
        return "mdi:blur";
      case "pm4":
        return "mdi:blur-linear";
      case "pm10":
        return "mdi:cloud";
      case "tvoc":
        return "mdi:molecule";
      case "co2":
        return "mdi:molecule-co2";
      case "temperature":
        return "mdi:thermometer";
      case "humidity":
        return "mdi:water-percent";
      default:
        return "mdi:gauge";
    }
  }

  _overviewTitle(layout) {
    const fallback = layout === "battery" ? "Batteries" : "Network";
    return String(this._config?.name || "").trim()
      || this._entityCardUi(`${layout}.title`, fallback);
  }

  _overviewIcon(layout) {
    return String(this._config?.icon || "").trim()
      || (layout === "battery" ? "mdi:battery-multiple" : "mdi:lan");
  }

  _resolveBatteryPercent(state) {
    const candidates = [
      state?.state,
      state?.attributes?.battery_level,
      state?.attributes?.battery,
      state?.attributes?.percentage,
    ];
    for (const candidate of candidates) {
      const numeric = parseAirQualityNumeric(candidate);
      if (Number.isFinite(numeric)) {
        return clamp(numeric, 0, 100);
      }
    }
    return null;
  }

  _batteryIcon(percent, state) {
    const charging = String(state?.state || "").toLowerCase() === "charging"
      || state?.attributes?.battery_charging === true
      || String(state?.attributes?.charging || "").toLowerCase() === "true";
    if (!Number.isFinite(percent)) {
      return charging ? "mdi:battery-charging" : "mdi:battery-unknown";
    }
    const level = Math.max(10, Math.min(100, Math.round(percent / 10) * 10));
    return charging ? `mdi:battery-charging-${level}` : level === 100 ? "mdi:battery" : `mdi:battery-${level}`;
  }

  _batteryColor(percent) {
    if (!Number.isFinite(percent)) {
      return "var(--secondary-text-color)";
    }
    if (percent <= 15) {
      return "var(--error-color, #ef5350)";
    }
    if (percent <= 35) {
      return "var(--warning-color, #f9a825)";
    }
    return "var(--success-color, #55b77e)";
  }

  _networkRole(item, state) {
    if (item.role && item.role !== "auto") {
      return item.role;
    }
    const deviceClass = String(state?.attributes?.device_class || "").toLowerCase();
    const unit = String(state?.attributes?.unit_of_measurement || "").toLowerCase();
    const key = `${item.entity} ${state?.attributes?.friendly_name || ""}`.toLowerCase();
    if (/latency|ping|round.trip|retardo/.test(key) || unit === "ms") return "latency";
    if (/signal|rssi|wifi.signal/.test(key) || unit === "dbm") return "signal";
    if (/upload|subida|tx\b|outbound/.test(key)) return "upload";
    if (/download|descarga|rx\b|inbound/.test(key)) return "download";
    if (/traffic|tr[aá]fico|data/.test(key) || deviceClass === "data_size") return "traffic";
    if (deviceClass === "data_rate") return "download";
    return "status";
  }

  _networkIcon(role, state) {
    const value = String(state?.state || "").trim().toLowerCase();
    if (role === "download") return "mdi:download-network-outline";
    if (role === "upload") return "mdi:upload-network-outline";
    if (role === "latency") return "mdi:timer-outline";
    if (role === "signal") return "mdi:wifi-strength-3";
    if (role === "traffic") return "mdi:chart-areaspline";
    return ["on", "online", "connected", "home", "true"].includes(value)
      ? "mdi:lan-connect"
      : "mdi:lan-disconnect";
  }

  _networkColor(role, state) {
    if (!state || isUnavailableState(state)) {
      return "var(--secondary-text-color)";
    }
    if (role === "status") {
      const value = normalizeTextKey(state.state);
      return ["on", "online", "connected", "home", "true", "ok"].includes(value)
        ? "var(--success-color, #55b77e)"
        : "var(--error-color, #ef5350)";
    }
    if (role === "download") return "var(--info-color, #42a5f5)";
    if (role === "upload") return "#a78bfa";
    if (role === "latency") return "var(--warning-color, #f6b73c)";
    if (role === "signal") return "#45c4a0";
    return "#e879b7";
  }

  _formatOverviewState(state) {
    const numeric = parseAirQualityNumeric(state?.state);
    const unit = String(state?.attributes?.unit_of_measurement || "").trim();
    if (Number.isFinite(numeric) && unit) {
      return formatNumericValueWithUnit(numeric, unit, this._getNumberDecimals());
    }
    return this._translateStateValue(state);
  }

  _renderOverviewLayout(layout) {
    if (!this.shadowRoot) {
      return;
    }
    const config = this._config || DEFAULT_CONFIG;
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const entries = config?.[layout]?.entities || [];
    const title = this._overviewTitle(layout);
    const icon = this._overviewIcon(layout);
    const available = entries.map((item, index) => ({
      item,
      index,
      state: this._hass?.states?.[item.entity] || null,
    }));
    const batteryValues = layout === "battery"
      ? available.map(({ state }) => this._resolveBatteryPercent(state)).filter(Number.isFinite)
      : [];
    const average = batteryValues.length
      ? batteryValues.reduce((sum, value) => sum + value, 0) / batteryValues.length
      : null;
    const lowest = batteryValues.length ? Math.min(...batteryValues) : null;
    const lowCount = batteryValues.filter(value => value <= 35).length;
    const networkEntries = layout === "network"
      ? available.map(entry => ({ ...entry, role: this._networkRole(entry.item, entry.state) }))
      : [];
    const statusEntry = networkEntries.find(entry => entry.role === "status");
    const accent = layout === "battery"
      ? this._batteryColor(Number.isFinite(lowest) ? lowest : average)
      : statusEntry ? this._networkColor("status", statusEntry.state) : "var(--info-color, #42a5f5)";
    const contrastReferenceState = available.find(entry => entry.state)?.state
      || {
        entity_id: layout === "battery" ? "sensor.battery" : "binary_sensor.network",
        attributes: layout === "battery" ? { device_class: "battery" } : {},
      };
    const overviewIconGlyphColor = resolveEntityBubbleIconGlyphColor(accent, contrastReferenceState);
    const overviewChipGlyphColor = overviewIconGlyphColor;
    const animations = this._getAnimationSettings();
    const insightMarkup = layout === "battery"
      ? `
        <span class="entity-card__overview-chip"><ha-icon icon="mdi:battery-multiple"></ha-icon><strong>${available.length}</strong><span>${escapeHtml(this._entityCardUi("battery.devices", "devices"))}</span></span>
        ${Number.isFinite(average) ? `<span class="entity-card__overview-chip"><ha-icon icon="mdi:chart-donut"></ha-icon><strong>${Math.round(average)}%</strong><span>${escapeHtml(this._entityCardUi("battery.average", "average"))}</span></span>` : ""}
        ${lowCount ? `<span class="entity-card__overview-chip entity-card__overview-chip--alert"><ha-icon icon="mdi:battery-alert-variant-outline"></ha-icon><strong>${lowCount}</strong><span>${escapeHtml(this._entityCardUi("battery.low", "low"))}</span></span>` : ""}
      `
      : `
        ${statusEntry ? `<span class="entity-card__overview-chip" style="--overview-chip-accent:${escapeHtml(this._networkColor("status", statusEntry.state))};"><span class="entity-card__overview-live-dot"></span><strong>${escapeHtml(statusEntry.state ? this._formatOverviewState(statusEntry.state) : this._entityCardUi("overview.unavailable", "Unavailable"))}</strong></span>` : ""}
        <span class="entity-card__overview-chip"><ha-icon icon="mdi:chart-box-outline"></ha-icon><strong>${available.length}</strong><span>${escapeHtml(this._entityCardUi("network.metrics", "metrics"))}</span></span>
      `;
    const rowSource = layout === "network" ? networkEntries : available;
    const rows = rowSource.map(({ item, state, index, role: configuredRole }) => {
      const name = item.name || state?.attributes?.friendly_name || item.entity || this._entityCardUi("overview.unconfigured", "Not configured");
      const unavailable = !state || isUnavailableState(state);
      if (layout === "battery") {
        const percent = this._resolveBatteryPercent(state);
        const value = unavailable
          ? this._entityCardUi("overview.unavailable", "Unavailable")
          : Number.isFinite(percent) ? `${Math.round(percent)}%` : this._translateStateValue(state);
        const color = this._batteryColor(percent);
        const rowIcon = item.icon || this._batteryIcon(percent, state);
        const rowGlyphColor = resolveEntityBubbleIconGlyphColor(color, state || contrastReferenceState);
        const batteryStatus = unavailable
          ? this._entityCardUi("overview.unavailable", "Unavailable")
          : !Number.isFinite(percent)
            ? this._entityCardUi("overview.unconfigured", "Not configured")
            : percent <= 15
              ? this._entityCardUi("battery.critical", "Critical")
              : percent <= 35
                ? this._entityCardUi("battery.low", "Low")
                : this._entityCardUi("battery.good", "Good");
        return `
          <button type="button" class="entity-card__overview-item entity-card__overview-item--battery${unavailable ? " is-unavailable" : ""}" data-entity-action="metric-info" data-entity="${escapeHtml(item.entity)}" style="--overview-accent:${escapeHtml(color)};--overview-glyph:${escapeHtml(rowGlyphColor)};--overview-index:${index};--battery-level:${Number.isFinite(percent) ? percent : 0};">
            <span class="entity-card__battery-gauge" aria-hidden="true">
              <span class="entity-card__battery-gauge-ring"></span>
              <span class="entity-card__battery-gauge-inner"><ha-icon icon="${escapeHtml(rowIcon)}"></ha-icon></span>
            </span>
            <span class="entity-card__overview-copy">
              <strong>${escapeHtml(name)}</strong>
              <span>${escapeHtml(batteryStatus)}</span>
              <span class="entity-card__battery-track" aria-hidden="true"><span class="entity-card__battery-fill"></span></span>
            </span>
            <strong class="entity-card__overview-value">${escapeHtml(value)}</strong>
          </button>`;
      }
      const role = configuredRole || this._networkRole(item, state);
      const value = unavailable ? this._entityCardUi("overview.unavailable", "Unavailable") : this._formatOverviewState(state);
      const rowIcon = item.icon || this._networkIcon(role, state);
      const color = this._networkColor(role, state);
      const rowGlyphColor = resolveEntityBubbleIconGlyphColor(color, state || contrastReferenceState);
      const roleLabel = this._entityCardUi(`network.roles.${role}`, role);
      return `
        <button type="button" class="entity-card__overview-item entity-card__overview-item--network entity-card__overview-item--${escapeHtml(role)}${unavailable ? " is-unavailable" : ""}" data-entity-action="metric-info" data-entity="${escapeHtml(item.entity)}" style="--overview-accent:${escapeHtml(color)};--overview-glyph:${escapeHtml(rowGlyphColor)};--overview-index:${index};">
          <span class="entity-card__overview-icon"><ha-icon icon="${escapeHtml(rowIcon)}"></ha-icon></span>
          <span class="entity-card__overview-copy"><span class="entity-card__overview-role">${escapeHtml(roleLabel)}</span><strong>${escapeHtml(name)}</strong></span>
          <strong class="entity-card__overview-value">${escapeHtml(value)}</strong>
          <span class="entity-card__network-decoration" aria-hidden="true"><i></i><i></i><i></i></span>
        </button>`;
    }).join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host { --entity-card-overview-duration:${animations.enabled ? animations.contentDuration : 0}ms; display:block; position:relative; }
        * { box-sizing:border-box; }
        ha-card {
          --nodalia-entity-surface-base:${styles.card.background};
          background:
            radial-gradient(circle at 12% 0%, color-mix(in srgb,${accent} 18%, transparent), transparent 42%),
            radial-gradient(circle at 100% 100%, color-mix(in srgb,${accent} 10%, transparent), transparent 40%),
            var(--nodalia-entity-surface-base);
          border:1px solid color-mix(in srgb,${accent} 24%,var(--divider-color));
          border-radius:${styles.card.border_radius};
          box-shadow:${styles.card.box_shadow},0 18px 40px color-mix(in srgb,${accent} 14%,rgba(0,0,0,.16));
          color:var(--primary-text-color);
          isolation:isolate;
          overflow:hidden;
          position:relative;
        }
        ha-card::before {
          background:linear-gradient(180deg,color-mix(in srgb,${accent} 14%,color-mix(in srgb,var(--primary-text-color) 5%,transparent)),transparent 52%);
          content:"";
          inset:0;
          pointer-events:none;
          position:absolute;
          z-index:0;
        }
        ha-card::after {
          background:linear-gradient(135deg,color-mix(in srgb,var(--primary-text-color) 5%,transparent),transparent 48%);
          content:"";
          inset:0;
          pointer-events:none;
          position:absolute;
          z-index:0;
        }
        .entity-card__overview { display:grid; gap:12px; padding:${styles.card.padding}; position:relative; z-index:1; }
        .entity-card__overview.entity-card__content--entering { animation:entity-card-overview-enter var(--entity-card-overview-duration) cubic-bezier(.22,.84,.26,1) both; }
        .entity-card__overview-header {
          align-items:center;
          display:grid;
          gap:10px;
          grid-template-columns:44px minmax(0,1fr) minmax(0,auto);
          min-width:0;
        }
        .entity-card__overview-main-icon {
          align-items:center;
          background:
            radial-gradient(circle at 30% 24%,color-mix(in srgb,${accent} 36%,transparent),transparent 64%),
            color-mix(in srgb,${accent} 14%,color-mix(in srgb,var(--primary-text-color) 7%,transparent));
          border:1px solid color-mix(in srgb,${accent} 30%,color-mix(in srgb,var(--primary-text-color) 9%,transparent));
          border-radius:999px;
          box-shadow:inset 0 1px 0 color-mix(in srgb,var(--primary-text-color) 10%,transparent),0 8px 18px color-mix(in srgb,${accent} 16%,rgba(0,0,0,.12));
          color:${overviewIconGlyphColor};
          display:flex;
          height:44px;
          justify-content:center;
          position:relative;
          width:44px;
        }
        .entity-card__overview-main-icon::after {
          background:${accent};
          border:2px solid var(--nodalia-entity-surface-base);
          border-radius:999px;
          bottom:1px;
          box-shadow:0 0 0 3px color-mix(in srgb,${accent} 12%,transparent);
          content:"";
          height:7px;
          position:absolute;
          right:0;
          width:7px;
        }
        .entity-card__overview-main-icon ha-icon { --mdc-icon-size:22px; }
        .entity-card__overview-title { display:grid; gap:2px; min-width:0; }
        .entity-card__overview-title strong { font-size:13px; font-weight:750; letter-spacing:-.02em; line-height:1.15; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .entity-card__overview-title span { color:var(--secondary-text-color); font-size:10px; font-weight:600; letter-spacing:.01em; }
        .entity-card__overview-insights { align-items:center; display:flex; flex-wrap:wrap; gap:5px; justify-content:flex-end; min-width:0; --overview-chip-glyph:${overviewChipGlyphColor}; }
        .entity-card__overview-chip {
          --overview-chip-accent:${accent};
          align-items:center;
          background:color-mix(in srgb,var(--overview-chip-accent) 10%,color-mix(in srgb,var(--primary-text-color) 4%,transparent));
          border:1px solid color-mix(in srgb,var(--overview-chip-accent) 20%,color-mix(in srgb,var(--primary-text-color) 8%,transparent));
          border-radius:${escapeHtml(String(styles.chip_border_radius || "999px"))};
          box-shadow:inset 0 1px 0 color-mix(in srgb,var(--primary-text-color) 6%,transparent);
          display:inline-flex;
          font-size:10px;
          gap:4px;
          height:22px;
          padding:0 8px;
          white-space:nowrap;
        }
        .entity-card__overview-chip ha-icon { --mdc-icon-size:12px; color:var(--overview-chip-glyph,var(--overview-chip-accent)); }
        .entity-card__overview-chip strong { font-weight:750; }
        .entity-card__overview-chip span { color:var(--secondary-text-color); font-weight:600; }
        .entity-card__overview-chip--alert { --overview-chip-accent:var(--error-color,#ef5350); --overview-chip-glyph:color-mix(in srgb,var(--primary-text-color) 52%,var(--error-color,#ef5350)); }
        .entity-card__overview-live-dot { animation:entity-card-network-pulse 1.9s ease-in-out infinite; background:var(--overview-chip-accent, var(--overview-accent, ${accent})); border-radius:999px; box-shadow:0 0 0 3px color-mix(in srgb,var(--overview-chip-accent, var(--overview-accent, ${accent})) 12%,transparent); height:6px; width:6px; }
        .entity-card__overview-grid { display:grid; gap:8px; grid-template-columns:repeat(2,minmax(0,1fr)); }
        .entity-card__overview-item {
          -webkit-backdrop-filter:blur(14px);
          -webkit-tap-highlight-color:transparent;
          align-items:center;
          appearance:none;
          backdrop-filter:blur(14px);
          background:
            radial-gradient(circle at 10% 12%,color-mix(in srgb,var(--overview-accent) 16%,transparent),transparent 48%),
            linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 6%, transparent), color-mix(in srgb, var(--primary-text-color) 2%, transparent));
          border:1px solid color-mix(in srgb,var(--overview-accent) 24%,color-mix(in srgb,var(--primary-text-color) 8%,transparent));
          border-radius:18px;
          box-shadow:inset 0 1px 0 color-mix(in srgb,var(--primary-text-color) 7%,transparent),0 8px 18px rgba(0,0,0,.08);
          color:inherit;
          cursor:pointer;
          font:inherit;
          min-width:0;
          overflow:hidden;
          position:relative;
          text-align:left;
          transform-origin:center;
          transition:transform 160ms ease,background 180ms ease,border-color 180ms ease,box-shadow 180ms ease;
        }
        .entity-card__overview-item::before {
          background:linear-gradient(125deg,color-mix(in srgb,var(--primary-text-color) 8%,transparent),transparent 42%);
          content:"";
          inset:0;
          pointer-events:none;
          position:absolute;
        }
        .entity-card__overview-item:hover {
          border-color:color-mix(in srgb,var(--overview-accent) 42%,transparent);
          box-shadow:inset 0 1px 0 color-mix(in srgb,var(--primary-text-color) 9%,transparent),0 12px 24px color-mix(in srgb,var(--overview-accent) 12%,rgba(0,0,0,.1));
          transform:translateY(-1px);
        }
        .entity-card__overview-item:active { transform:scale(.975); }
        .entity-card__overview-item:focus-visible { outline:2px solid var(--overview-accent); outline-offset:2px; }
        .entity-card__overview-item.is-unavailable { opacity:.62; }
        .entity-card__overview-item--battery { display:grid; gap:10px; grid-template-columns:48px minmax(0,1fr) auto; min-height:76px; padding:10px 12px 10px 10px; }
        .entity-card__battery-gauge {
          align-items:center;
          display:flex;
          height:46px;
          justify-content:center;
          position:relative;
          width:46px;
          z-index:1;
        }
        .entity-card__battery-gauge-ring {
          background:conic-gradient(var(--overview-accent) calc(var(--battery-level) * 1%), color-mix(in srgb,var(--primary-text-color) 10%,transparent) 0);
          border-radius:999px;
          box-shadow:0 0 0 1px color-mix(in srgb, var(--overview-accent) 16%, transparent), 0 8px 16px color-mix(in srgb,var(--overview-accent) 14%,rgba(0,0,0,.1));
          inset:0;
          mask:radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px));
          -webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px));
          position:absolute;
        }
        .entity-card__battery-gauge-inner {
          align-items:center;
          background:
            radial-gradient(circle at 30% 24%, color-mix(in srgb, var(--overview-accent) 20%, transparent), transparent 62%),
            color-mix(in srgb,var(--nodalia-entity-surface-base) 88%,var(--overview-accent));
          border:1px solid color-mix(in srgb,var(--overview-accent) 20%,transparent);
          border-radius:999px;
          box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          color:var(--overview-glyph,var(--overview-accent));
          display:flex;
          height:32px;
          justify-content:center;
          position:relative;
          width:32px;
          z-index:1;
        }
        .entity-card__battery-gauge-inner ha-icon { --mdc-icon-size:17px; }
        .entity-card__battery-track {
          background:color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius:999px;
          display:block;
          height:4px;
          margin-top:1px;
          overflow:hidden;
          width:100%;
        }
        .entity-card__battery-fill {
          background:linear-gradient(90deg, color-mix(in srgb, var(--overview-accent) 70%, transparent), var(--overview-accent));
          border-radius:inherit;
          display:block;
          height:100%;
          width:calc(var(--battery-level) * 1%);
        }
        .entity-card__overview-copy { display:grid; gap:2px; min-width:0; position:relative; z-index:1; }
        .entity-card__overview-copy strong,.entity-card__overview-copy span:not(.entity-card__battery-track):not(.entity-card__battery-fill) { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .entity-card__overview-copy strong { font-size:11px; font-weight:700; letter-spacing:-.01em; }
        .entity-card__overview-copy > span:not(.entity-card__overview-role):not(.entity-card__battery-track) { color:color-mix(in srgb,var(--overview-accent) 70%,var(--secondary-text-color)); font-size:9px; font-weight:650; }
        .entity-card__overview-value { font-size:14px; font-variant-numeric:tabular-nums; font-weight:750; letter-spacing:-.02em; max-width:96px; overflow:hidden; position:relative; text-overflow:ellipsis; white-space:nowrap; z-index:1; }
        .entity-card__overview-item--network { display:grid; gap:6px 10px; grid-template-columns:38px minmax(0,1fr); min-height:72px; padding:10px 12px; }
        .entity-card__overview-item--network .entity-card__overview-value { grid-column:2; line-height:1; }
        .entity-card__overview-grid--has-status .entity-card__overview-item--status {
          grid-column:1 / -1;
          grid-template-columns:38px minmax(0,1fr) auto;
          min-height:64px;
        }
        .entity-card__overview-grid--has-status .entity-card__overview-item--status .entity-card__overview-value { align-self:center; grid-column:3; grid-row:1 / span 2; padding-right:18px; }
        .entity-card__overview-grid--has-status .entity-card__overview-item--network:last-child:nth-child(even) { grid-column:1 / -1; }
        .entity-card__overview-item--download,.entity-card__overview-item--upload { min-height:82px; }
        .entity-card__overview-item--download .entity-card__overview-value,.entity-card__overview-item--upload .entity-card__overview-value { font-size:16px; letter-spacing:-.03em; }
        .entity-card__overview-icon {
          align-items:center;
          align-self:center;
          background:
            radial-gradient(circle at 30% 24%,color-mix(in srgb,var(--overview-accent) 32%,transparent),transparent 62%),
            color-mix(in srgb,var(--overview-accent) 12%,transparent);
          border:1px solid color-mix(in srgb,var(--overview-accent) 24%,transparent);
          border-radius:999px;
          box-shadow:inset 0 1px 0 color-mix(in srgb,var(--primary-text-color) 7%,transparent),0 6px 14px color-mix(in srgb,var(--overview-accent) 12%,rgba(0,0,0,.08));
          color:var(--overview-glyph,var(--overview-accent));
          display:flex;
          grid-row:1 / span 2;
          height:38px;
          justify-content:center;
          position:relative;
          width:38px;
          z-index:1;
        }
        .entity-card__overview-icon ha-icon { --mdc-icon-size:18px; }
        .entity-card__overview-role { color:color-mix(in srgb,var(--overview-accent) 76%,var(--primary-text-color)); font-size:8px; font-weight:750; letter-spacing:.06em; text-transform:uppercase; }
        .entity-card__network-decoration { align-items:end; bottom:9px; display:flex; gap:2px; height:14px; opacity:.24; position:absolute; right:11px; }
        .entity-card__network-decoration i { background:var(--overview-accent); border-radius:999px; display:block; width:2px; }
        .entity-card__network-decoration i:nth-child(1) { height:5px; }
        .entity-card__network-decoration i:nth-child(2) { height:9px; }
        .entity-card__network-decoration i:nth-child(3) { height:14px; }
        .entity-card__overview-item--download .entity-card__network-decoration i,.entity-card__overview-item--upload .entity-card__network-decoration i { animation:entity-card-network-bars 1.35s ease-in-out infinite alternate; }
        .entity-card__overview-item--download .entity-card__network-decoration i:nth-child(2),.entity-card__overview-item--upload .entity-card__network-decoration i:nth-child(2) { animation-delay:.18s; }
        .entity-card__overview-item--download .entity-card__network-decoration i:nth-child(3),.entity-card__overview-item--upload .entity-card__network-decoration i:nth-child(3) { animation-delay:.36s; }
        .entity-card__overview-empty {
          background:color-mix(in srgb,var(--primary-text-color) 4%,transparent);
          border:1px dashed color-mix(in srgb,${accent} 28%,var(--divider-color));
          border-radius:18px;
          color:var(--secondary-text-color);
          font-size:11px;
          padding:20px 12px;
          text-align:center;
        }
        @keyframes entity-card-overview-enter { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes entity-card-network-pulse { 50% { box-shadow:0 0 0 6px color-mix(in srgb,var(--overview-chip-accent, var(--overview-accent, ${accent})) 4%,transparent); transform:scale(.92); } }
        @keyframes entity-card-network-bars { from { transform:scaleY(.55); transform-origin:bottom; } to { transform:scaleY(1); transform-origin:bottom; } }
        @media (prefers-reduced-motion:reduce) { .entity-card__overview-live-dot,.entity-card__network-decoration i { animation:none !important; } }
        @media (max-width:520px) {
          .entity-card__overview-header { grid-template-columns:40px minmax(0,1fr); }
          .entity-card__overview-main-icon { height:40px; width:40px; }
          .entity-card__overview-insights { grid-column:1 / -1; justify-content:flex-start; }
          .entity-card__overview-grid { grid-template-columns:1fr; }
        }
      </style>
      <ha-card class="entity-card entity-card--${escapeHtml(layout)}">
        <div class="entity-card__overview${animations.enabled && this._animateContentOnNextRender ? " entity-card__content--entering" : ""}">
          <div class="entity-card__overview-header">
            <span class="entity-card__overview-main-icon"><ha-icon icon="${escapeHtml(icon)}"></ha-icon></span>
            <span class="entity-card__overview-title"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(this._entityCardUi(`${layout}.subtitle`, layout === "battery" ? "Battery overview" : "Connection overview"))}</span></span>
            <span class="entity-card__overview-insights">${insightMarkup}</span>
          </div>
          ${rows ? `<div class="entity-card__overview-grid${statusEntry ? " entity-card__overview-grid--has-status" : ""}">${rows}</div>` : `<div class="entity-card__overview-empty">${escapeHtml(this._entityCardUi("overview.empty", "Add entities in the visual editor."))}</div>`}
        </div>
      </ha-card>`;
    if (animations.enabled && this._animateContentOnNextRender) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 120);
    }
  }

  _clearAirQualityHistory() {
    if (this._aqHistoryTimer) {
      window.clearTimeout(this._aqHistoryTimer);
      this._aqHistoryTimer = 0;
    }
    if (this._aqHistoryAbort) {
      try {
        this._aqHistoryAbort.abort();
      } catch (_error) {
        /* ignore */
      }
      this._aqHistoryAbort = null;
    }
    this._aqHistoryLoading = false;
  }

  _getAirQualityGraphSeries(metrics = []) {
    const aq = this._config?.air_quality || normalizeAirQualityBlock();
    if (aq.show_graphs !== true) {
      return [];
    }
    return metrics
      .filter(metric => metric?.entityId && aq.graph_series?.[metric.kind] !== false)
      .slice(0, 8)
      .map(metric => ({
        kind: metric.kind,
        entityId: metric.entityId,
        label: metric.label,
        unit: metric.unit,
        color: aq.graph_colors?.[metric.kind] || AIR_QUALITY_GRAPH_SERIES_COLORS[metric.kind],
        currentValue: metric.numeric,
      }));
  }

  _getAirQualityHistoryKey(series = []) {
    const aq = this._config?.air_quality || normalizeAirQualityBlock();
    return [
      aq.graph_hours,
      aq.graph_points,
      series.map(item => item.entityId).join(","),
    ].join("|");
  }

  _scheduleAirQualityHistory(series = []) {
    if (!series.length) {
      this._clearAirQualityHistory();
      this._aqHistoryCache = null;
      this._aqHistoryKey = "";
      return;
    }
    if (typeof this._hass?.callWS !== "function" && typeof this._hass?.auth?.fetchWithAuth !== "function") {
      return;
    }
    const key = this._getAirQualityHistoryKey(series);
    if (key === this._aqHistoryKey && (this._aqHistoryCache || this._aqHistoryLoading)) {
      return;
    }
    if (key !== this._aqHistoryKey) {
      this._aqHistoryCache = null;
      this._aqHistoryKey = key;
    }
    this._requestAirQualityHistory(series);
  }

  async _requestAirQualityHistory(series = []) {
    if (!series.length || !this._hass) {
      return;
    }
    const requestKey = this._getAirQualityHistoryKey(series);
    this._clearAirQualityHistory();
    this._aqHistoryLoading = true;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    this._aqHistoryAbort = controller;
    const aq = this._config?.air_quality || normalizeAirQualityBlock();
    const hours = Number(aq.graph_hours) || 24;
    const pointsCount = Number(aq.graph_points) || 96;
    const end = new Date();
    const start = new Date(end.getTime() - (hours * 60 * 60 * 1000));

    try {
      const raw = await this._fetchAirQualityHistory(
        start,
        end,
        series.map(item => item.entityId),
        controller?.signal,
      );
      if (requestKey !== this._aqHistoryKey) {
        return;
      }
      const startMs = start.getTime();
      const endMs = end.getTime();
      const entries = series.map(item => {
        const rows = Array.isArray(raw?.[item.entityId]) ? raw[item.entityId] : [];
        const events = rows
          .map(row => {
            const ts = parseAirQualityHistoryTimestamp(
              row.last_changed ?? row.last_updated ?? row.lc ?? row.lu ?? row.last_changed,
            );
            const value = parseAirQualityNumeric(row.state ?? row.s ?? row);
            return { ts, value };
          })
          .filter(event => Number.isFinite(event.ts) && Number.isFinite(event.value))
          .sort((left, right) => left.ts - right.ts);
        const live = this._hass?.states?.[item.entityId];
        const liveValue = parseAirQualityNumeric(live?.state);
        if (Number.isFinite(liveValue)) {
          events.push({
            ts: parseAirQualityHistoryTimestamp(live.last_changed || live.last_updated) || endMs,
            value: liveValue,
          });
        }
        return {
          ...item,
          samples: buildAirQualityInterpolatedSamples(
            events,
            startMs,
            endMs,
            pointsCount,
            Number.isFinite(item.currentValue) ? item.currentValue : liveValue,
          ),
        };
      });
      this._aqHistoryCache = { startMs, endMs, entries };
      this._aqHistoryLoading = false;
      if (String(this._config?.layout || "").toLowerCase() === "air_quality") {
        this._lastRenderSignature = "";
        this._render();
      }
    } catch (_error) {
      if (requestKey === this._aqHistoryKey) {
        this._aqHistoryLoading = false;
      }
    } finally {
      if (this.isConnected && String(this._config?.layout || "").toLowerCase() === "air_quality") {
        this._aqHistoryTimer = window.setTimeout(() => {
          this._aqHistoryTimer = 0;
          if (this.isConnected && String(this._config?.layout || "").toLowerCase() === "air_quality") {
            this._aqHistoryKey = "";
            this._scheduleAirQualityHistory(series);
          }
        }, AIR_QUALITY_HISTORY_REFRESH_MS);
      }
    }
  }

  async _fetchAirQualityHistory(start, end, entityIds, signal) {
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
          const rows = Array.isArray(result?.[0])
            ? result[0]
            : Array.isArray(result?.[entityId])
              ? result[entityId]
              : [];
          return [entityId, rows];
        } catch (_error) {
          /* fall through */
        }
      }
      if (typeof this._hass?.auth?.fetchWithAuth === "function") {
        const query = [
          `filter_entity_id=${encodeURIComponent(entityId)}`,
          `end_time=${encodeURIComponent(end.toISOString())}`,
        ].join("&");
        const response = await this._hass.auth.fetchWithAuth(
          `/api/history/period/${encodeURIComponent(start.toISOString())}?${query}`,
          signal ? { signal } : undefined,
        );
        if (!response.ok) {
          return [entityId, []];
        }
        const result = await response.json();
        return [entityId, Array.isArray(result?.[0]) ? result[0] : []];
      }
      return [entityId, []];
    }));
    return Object.fromEntries(groups);
  }

  _buildAirQualityChartSvg(seriesEntries = [], hoverState = this._aqHoverPreview) {
    const geometry = buildAirQualityChartGeometry(seriesEntries);
    if (!geometry.paths.length) {
      return "";
    }
    const hover = getAirQualityHoverPayload(geometry, hoverState);
    const fills = geometry.paths.map((entry, index) => (
      index === 0 && entry.fillPath
        ? `<path d="${escapeHtml(entry.fillPath)}" fill="${escapeHtml(entry.color)}" opacity="0.16"></path>`
        : ""
    )).join("");
    const strokes = geometry.paths.map(entry => (
      entry.linePath
        ? `<path d="${escapeHtml(entry.linePath)}" fill="none" stroke="${escapeHtml(entry.color)}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"></path>`
        : ""
    )).join("");
    const hoverX = hover?.x ?? 0;
    const hoverMarker = `
      <line class="entity-card__aq-hover-line" x1="${hoverX.toFixed(2)}" x2="${hoverX.toFixed(2)}" y1="${geometry.paddingTop}" y2="${geometry.height - geometry.paddingBottom}"${hover ? "" : " hidden"}></line>
    `;
    return `
      <svg class="entity-card__aq-chart" data-air-quality-chart="true" viewBox="0 0 ${geometry.width} ${geometry.height}" preserveAspectRatio="none" aria-hidden="true">
        ${fills}
        ${strokes}
        ${hoverMarker}
      </svg>
    `;
  }

  _getAirQualityChartEntries(graphSeries = this._getAirQualityGraphSeries(this._collectAirQualityMetrics(this._getState()).metrics)) {
    const cached = Array.isArray(this._aqHistoryCache?.entries) ? this._aqHistoryCache.entries : [];
    const currentByKind = new Map(graphSeries.map(entry => [entry.kind, entry]));
    return cached
      .filter(entry => currentByKind.has(entry.kind))
      .map(entry => ({
        ...entry,
        color: currentByKind.get(entry.kind)?.color || entry.color,
      }));
  }

  _clearAirQualityHoverPreview() {
    if (!this._aqHoverPreview) {
      return;
    }
    this._aqHoverPreview = null;
    if (!this._patchAirQualityHoverPreview(null, null)) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  _patchAirQualityHoverPreview(geometry = null, hoverState = this._aqHoverPreview) {
    const line = this.shadowRoot?.querySelector?.(".entity-card__aq-hover-line");
    const point = this.shadowRoot?.querySelector?.(".entity-card__aq-hover-point");
    const chip = this.shadowRoot?.querySelector?.(".entity-card__aq-hover-chip");
    if (!line || !point || !chip) {
      return false;
    }
    let resolvedGeometry = geometry;
    if (!resolvedGeometry) {
      const graphSeries = this._getAirQualityGraphSeries(
        this._collectAirQualityMetrics(this._getState()).metrics,
      );
      resolvedGeometry = buildAirQualityChartGeometry(
        this._getAirQualityChartEntries(graphSeries)
          .filter(entry => !this._aqHiddenSeries.has(entry.kind)),
      );
    }
    const hover = getAirQualityHoverPayload(resolvedGeometry, hoverState);
    for (const element of [line, point, chip]) {
      element.toggleAttribute("hidden", !hover);
    }
    if (!hover) {
      return true;
    }
    const left = `${hover.xPercent.toFixed(3)}%`;
    const top = `${hover.yPercent.toFixed(3)}%`;
    line.setAttribute("x1", hover.x.toFixed(3));
    line.setAttribute("x2", hover.x.toFixed(3));
    point.style.setProperty("--aq-hover-left", left);
    point.style.setProperty("--aq-hover-top", top);
    point.style.setProperty("--aq-hover-color", hover.color);
    chip.style.setProperty("--aq-hover-left", left);
    chip.style.setProperty("--aq-hover-top", top);
    chip.style.setProperty("--aq-hover-color", hover.color);
    chip.dataset.aqHoverPlacement = hover.yPercent < 50 ? "below" : "above";
    const label = chip.querySelector("[data-aq-hover-label]");
    const value = chip.querySelector("[data-aq-hover-value]");
    const time = chip.querySelector("[data-aq-hover-time]");
    if (label) {
      label.textContent = hover.label;
    }
    if (value) {
      value.textContent = formatNumericValueWithUnit(
        hover.value,
        hover.unit,
        this._getNumberDecimals(),
      );
    }
    if (time) {
      time.textContent = this._formatAirQualityHoverTime(hover.ts);
    }
    return true;
  }

  _onShadowPointerMove(event) {
    if (event.pointerType && event.pointerType !== "mouse") {
      return;
    }
    if (String(this._config?.layout || "").toLowerCase() !== "air_quality") {
      return;
    }
    const chart = event.composedPath().find(node => (
      node instanceof Element && node.dataset?.airQualityChart === "true"
    ));
    if (!chart) {
      this._clearAirQualityHoverPreview();
      return;
    }
    const graphSeries = this._getAirQualityGraphSeries(this._collectAirQualityMetrics(this._getState()).metrics);
    const geometry = buildAirQualityChartGeometry(
      this._getAirQualityChartEntries(graphSeries)
        .filter(entry => !this._aqHiddenSeries.has(entry.kind)),
    );
    const rect = chart.getBoundingClientRect();
    if (!geometry.paths.length || !rect.width || !rect.height) {
      this._clearAirQualityHoverPreview();
      return;
    }
    const x = clamp(((event.clientX - rect.left) / rect.width) * geometry.width, 0, geometry.width);
    const y = clamp(((event.clientY - rect.top) / rect.height) * geometry.height, 0, geometry.height);
    let nearest = null;
    geometry.paths.forEach(path => {
      if (!path.points.length) {
        return;
      }
      const position = clamp(
        ((x - geometry.paddingX) / Math.max(geometry.width - (geometry.paddingX * 2), 1)) * (path.points.length - 1),
        0,
        path.points.length - 1,
      );
      const leftIndex = Math.floor(position);
      const rightIndex = Math.ceil(position);
      const fraction = position - leftIndex;
      const leftPoint = path.points[leftIndex];
      const rightPoint = path.points[rightIndex] || leftPoint;
      const pointY = leftPoint.y + ((rightPoint.y - leftPoint.y) * fraction);
      const distance = Math.abs(pointY - y);
      if (!nearest || distance < nearest.distance) {
        nearest = { kind: path.kind, position, distance };
      }
    });
    if (!nearest) {
      this._clearAirQualityHoverPreview();
      return;
    }
    const key = `${nearest.kind}:${nearest.position.toFixed(3)}`;
    if (this._aqHoverPreview?.key === key) {
      return;
    }
    this._aqHoverPreview = { key, kind: nearest.kind, position: nearest.position };
    if (!this._patchAirQualityHoverPreview(geometry, this._aqHoverPreview)) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  _onShadowPointerLeave() {
    this._clearAirQualityHoverPreview();
  }

  _formatAirQualityHoverTime(timestamp) {
    const date = new Date(Number(timestamp));
    if (!Number.isFinite(date.getTime())) {
      return "";
    }
    const locale = window.NodaliaI18n?.resolveLanguage?.(this._hass, this._config?.language) || undefined;
    try {
      const localeKey = String(locale || "");
      if (!this._aqHoverTimeFormatter || this._aqHoverTimeFormatterLocale !== localeKey) {
        this._aqHoverTimeFormatter = new Intl.DateTimeFormat(locale, {
          hour: "2-digit",
          minute: "2-digit",
        });
        this._aqHoverTimeFormatterLocale = localeKey;
      }
      return this._aqHoverTimeFormatter.format(date);
    } catch (_error) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  }

  _renderAirQualityLayout() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || DEFAULT_CONFIG;
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const primaryEntity = entityScalar(config.entity);
    const primaryState = primaryEntity ? this._hass?.states?.[primaryEntity] : null;
    const aqConfig = config.air_quality || normalizeAirQualityBlock();
    const hasMetricEntity = AIR_QUALITY_METRIC_KEYS.some(key => entityScalar(aqConfig[key]));

    if (!primaryState && !hasMetricEntity) {
      this.shadowRoot.innerHTML = window.NodaliaUtils?.renderCardEmptyStateDocument?.(
        this._renderEmptyState(),
        { card: styles?.card },
      ) ?? this._renderEmptyState();
      return;
    }

    if (primaryEntity && !primaryState) {
      const entityGuard = window.NodaliaUtils?.renderLovelaceEntityGuardCardHtml?.(
        this._hass,
        primaryEntity,
        { cardClass: "entity-card" },
      );
      if (entityGuard && !hasMetricEntity) {
        this.shadowRoot.innerHTML = entityGuard;
        return;
      }
    }

    const { metrics, guidelines } = this._collectAirQualityMetrics(primaryState);
    const summary = this._resolveAirQualityOverall(primaryState, metrics, guidelines);
    const title = primaryState
      ? this._getTitle(primaryState)
      : (String(config.name || "").trim() || this._entityCardUi("airQuality.title", "Air quality"));
    const icon = primaryState
      ? (this._getIcon(primaryState) || "mdi:air-filter")
      : (String(config.icon || "").trim() || "mdi:air-filter");
    const accentColor = summary.accent;
    const iconContrastState = primaryState || metrics
      .map(metric => this._hass?.states?.[metric.infoEntityId])
      .find(Boolean);
    const darkenIconGlyph = iconContrastState
      ? shouldDarkenEntityBubbleIconGlyph(iconContrastState, accentColor)
      : false;
    const iconGlyphColor = darkenIconGlyph
      ? `color-mix(in srgb, var(--primary-text-color) 56%, ${accentColor})`
      : accentColor;
    const levelLabel = this._airQualityLevelLabel(summary.overall);
    const guidelinesLabel = guidelines === "who"
      ? this._entityCardUi("airQuality.whoGuidelines", "WHO 24h AQG")
      : "";
    const heroNumeric = summary.primaryNumeric != null
      ? formatNumericValue(summary.primaryNumeric, this._getNumberDecimals())
      : null;
    const heroCaption = summary.primaryIsAqi
      ? this._entityCardUi("airQuality.aqi", "AQI")
      : (metrics.find(metric => metric.kind === "pm25")?.label
        || this._entityCardUi("airQuality.headline", "Air quality"));
    const canRunBodyTap = primaryState ? this._canRunTapAction(primaryState, "body") : false;
    const canRunIconTap = primaryState ? this._canRunTapAction(primaryState, "icon") : false;
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const chipHeight = escapeHtml(String(styles.chip_height ?? "24px"));
    const chipFontSize = escapeHtml(String(styles.chip_font_size ?? "11px"));
    const chipPadding = escapeHtml(String(styles.chip_padding ?? "0 9px"));
    const iconSize = escapeHtml(String(styles.icon?.size ?? "38px"));
    const titleSize = escapeHtml(String(styles.title_size ?? "12px"));
    const surfaceBase = styles.card.background;
    const onCardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${surfaceBase}) 0%, color-mix(in srgb, ${accentColor} 10%, ${surfaceBase}) 52%, ${surfaceBase} 100%)`;
    const cardBackground = onCardBackground;
    const cardBorder = `1px solid color-mix(in srgb, ${accentColor} 32%, var(--divider-color))`;
    const cardShadow = `${styles.card.box_shadow}, 0 16px 32px color-mix(in srgb, ${accentColor} 18%, rgba(0, 0, 0, 0.18))`;
    const surfaceGlaze = `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`;
    const surfaceAmbient = `
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%)`;

    const comfortMetrics = metrics.filter(metric => AIR_QUALITY_COMFORT_KEYS.has(metric.kind));
    const pollutionMetrics = metrics.filter(metric => !AIR_QUALITY_COMFORT_KEYS.has(metric.kind));
    const graphSeries = this._getAirQualityGraphSeries(metrics);
    this._scheduleAirQualityHistory(graphSeries);
    const allChartEntries = this._getAirQualityChartEntries(graphSeries);
    const chartEntries = allChartEntries.filter(entry => !this._aqHiddenSeries.has(entry.kind));
    const chartGeometry = buildAirQualityChartGeometry(chartEntries);
    const chartHover = getAirQualityHoverPayload(chartGeometry, this._aqHoverPreview);
    const chartSvg = aqConfig.show_graphs === true
      ? this._buildAirQualityChartSvg(chartEntries, this._aqHoverPreview)
      : "";
    const chartHoverPoint = chartSvg
      ? `
        <span
          class="entity-card__aq-hover-point"
          style="--aq-hover-left:${(chartHover?.xPercent ?? 0).toFixed(3)}%;--aq-hover-top:${(chartHover?.yPercent ?? 0).toFixed(3)}%;--aq-hover-color:${escapeHtml(chartHover?.color || "var(--primary-color)")};"
          ${chartHover ? "" : "hidden"}
          aria-hidden="true"
        ></span>
      `
      : "";
    const chartHoverChip = chartSvg
      ? `
        <div
          class="entity-card__aq-hover-chip"
          style="--aq-hover-left:${(chartHover?.xPercent ?? 0).toFixed(3)}%;--aq-hover-top:${(chartHover?.yPercent ?? 0).toFixed(3)}%;--aq-hover-color:${escapeHtml(chartHover?.color || "var(--primary-color)")};"
          data-aq-hover-placement="${(chartHover?.yPercent ?? 0) < 50 ? "below" : "above"}"
          ${chartHover ? "" : "hidden"}
        >
          <span class="entity-card__aq-hover-swatch"></span>
          <span class="entity-card__aq-hover-label" data-aq-hover-label>${escapeHtml(chartHover?.label || "")}</span>
          <strong data-aq-hover-value>${escapeHtml(chartHover ? formatNumericValueWithUnit(chartHover.value, chartHover.unit, this._getNumberDecimals()) : "")}</strong>
          <time data-aq-hover-time>${escapeHtml(chartHover ? this._formatAirQualityHoverTime(chartHover.ts) : "")}</time>
        </div>
      `
      : "";

    const rightChips = [
      this._renderChip(levelLabel, "state", { entityId: primaryEntity }),
      heroNumeric != null
        ? this._renderChip(
          summary.primaryIsAqi ? `${heroCaption} ${heroNumeric}` : String(heroNumeric),
          "value",
          { entityId: primaryEntity },
        )
        : "",
      ...comfortMetrics.map(metric => this._renderChip(metric.display, "value", {
        entityId: metric.infoEntityId,
        ariaLabel: `${metric.label}: ${metric.display}`,
      })),
    ].filter(Boolean).join("");

    const statusChips = [
      guidelinesLabel ? this._renderChip(guidelinesLabel, "value") : "",
    ].filter(Boolean).join("");

    const metricBubbles = pollutionMetrics.map(metric => {
      const metricAccent = metric.level !== "unknown"
        ? (AIR_QUALITY_LEVEL_COLORS[metric.level] || accentColor)
        : "var(--primary-text-color)";
      const compactValue = `${metric.label} ${metric.display}`;
      const bubbleTitle = guidelines === "who" && AIR_QUALITY_POLLUTION_KEYS.has(metric.kind)
        ? `${metric.label}: ${metric.display} · ${this._airQualityLevelLabel(metric.level)}`
        : `${metric.label}: ${metric.display}`;
      return `
        <button
          type="button"
          class="entity-card__aq-bubble"
          style="--aq-bubble-accent:${escapeHtml(metricAccent)};"
          title="${escapeHtml(bubbleTitle)}"
          data-entity-action="metric-info"
          data-entity="${escapeHtml(metric.infoEntityId)}"
          aria-label="${escapeHtml(bubbleTitle)}"
        >
          <ha-icon icon="${escapeHtml(this._airQualityMetricIcon(metric.kind))}"></ha-icon>
          <span>${escapeHtml(compactValue)}</span>
        </button>
      `;
    }).join("");

    const legendChips = allChartEntries.map(entry => {
      const isVisible = !this._aqHiddenSeries.has(entry.kind);
      return `
      <button
        type="button"
        class="entity-card__aq-legend-item ${isVisible ? "" : "entity-card__aq-legend-item--hidden"}"
        style="--aq-series-color:${escapeHtml(entry.color)};"
        data-entity-action="graph-series-toggle"
        data-series-kind="${escapeHtml(entry.kind)}"
        aria-pressed="${String(isVisible)}"
        aria-label="${escapeHtml(entry.label)}"
      >
        <span class="entity-card__aq-legend-swatch"></span>
        <span>${escapeHtml(entry.label)}</span>
      </button>
    `;
    }).join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --entity-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --entity-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          display: block;
          position: relative;
        }

        * { box-sizing: border-box; }

        ha-card[data-entity-action="body"]:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: -3px;
        }

        ha-card {
          --nodalia-entity-surface-base: ${surfaceBase};
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          display: block;
          overflow: hidden;
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        ha-card::before {
          background: ${surfaceGlaze};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        ha-card::after {
          background: ${surfaceAmbient};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .entity-card--clickable { cursor: pointer; }
        .entity-card__icon.entity-card__icon--clickable { cursor: pointer; }

        .entity-card__content {
          display: grid;
          gap: ${styles.card.gap};
          min-width: 0;
          padding: ${styles.card.padding};
          position: relative;
          z-index: 1;
        }

        .entity-card__content--entering {
          animation: entity-card-fade-up calc(var(--entity-card-content-duration) * 0.88) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .entity-card__hero {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: ${iconSize} minmax(0, 1fr);
          min-width: 0;
        }

        .entity-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${iconGlyphColor};
          display: inline-flex;
          flex: 0 0 auto;
          height: ${iconSize};
          justify-content: center;
          line-height: 0;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          width: ${iconSize};
        }

        .entity-card__icon ha-icon {
          --mdc-icon-size: calc(${iconSize} * 0.46);
          color: ${iconGlyphColor};
          display: inline-flex;
          height: calc(${iconSize} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${iconSize} * 0.46);
        }

        .entity-card__copy {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .entity-card__headline {
          align-items: start;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .entity-card__title {
          font-size: ${titleSize};
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.15;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .entity-card__chips {
          align-items: center;
          display: flex;
          flex: 0 0 auto;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
          max-width: 100%;
          min-width: 0;
        }

        .entity-card__chip {
          appearance: none;
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: ${chipBorderRadius};
          color: var(--secondary-text-color);
          display: inline-flex;
          flex: 0 0 auto;
          font-size: ${chipFontSize};
          font-weight: 600;
          line-height: 1;
          max-width: 100%;
          min-height: ${chipHeight};
          min-width: 0;
          overflow: hidden;
          padding: ${chipPadding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .entity-card__chip--clickable {
          cursor: pointer;
          font-family: inherit;
          margin: 0;
        }

        .entity-card__chip--clickable:focus-visible,
        .entity-card__aq-bubble:focus-visible,
        .entity-card__aq-legend-item:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }

        .entity-card__chip--state {
          background: color-mix(in srgb, ${accentColor} 16%, transparent);
          border-color: color-mix(in srgb, ${accentColor} 22%, transparent);
          color: ${accentColor};
        }

        .entity-card__aq-metrics {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          min-width: 0;
        }

        .entity-card__aq-bubble {
          appearance: none;
          align-items: center;
          background: color-mix(in srgb, var(--aq-bubble-accent, var(--primary-text-color)) 18%, var(--nodalia-entity-surface-base));
          border: 1px solid color-mix(in srgb, var(--aq-bubble-accent, var(--primary-text-color)) 28%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 7%, transparent),
            0 8px 18px rgba(0, 0, 0, 0.13);
          color: color-mix(in srgb, var(--aq-bubble-accent, var(--primary-text-color)) 88%, var(--primary-text-color));
          cursor: pointer;
          display: inline-flex;
          font-size: 12px;
          font-family: inherit;
          font-weight: 700;
          gap: 5px;
          line-height: 1;
          margin: 0;
          min-height: 32px;
          padding: 0 11px 0 9px;
        }

        .entity-card__aq-bubble ha-icon {
          --mdc-icon-size: 15px;
          flex: 0 0 auto;
        }

        .entity-card__aq-chart-panel {
          display: grid;
          gap: 10px;
          min-width: 0;
        }

        .entity-card__aq-chart-wrap {
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 18px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          min-height: 112px;
          overflow: hidden;
          padding: 0;
          position: relative;
        }

        .entity-card__aq-chart {
          cursor: crosshair;
          display: block;
          height: 112px;
          width: 100%;
        }

        .entity-card__aq-hover-line {
          stroke: color-mix(in srgb, var(--primary-text-color) 36%, transparent);
          stroke-dasharray: 2 2;
          stroke-width: 0.7;
          vector-effect: non-scaling-stroke;
        }

        .entity-card__aq-hover-line[hidden],
        .entity-card__aq-hover-point[hidden],
        .entity-card__aq-hover-chip[hidden] {
          display: none;
        }

        .entity-card__aq-hover-point {
          background: var(--nodalia-entity-surface-base);
          border: 2px solid var(--aq-hover-color);
          border-radius: 50%;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--nodalia-entity-surface-base) 72%, transparent);
          height: 8px;
          left: clamp(4px, var(--aq-hover-left), calc(100% - 4px));
          pointer-events: none;
          position: absolute;
          top: clamp(4px, var(--aq-hover-top), calc(100% - 4px));
          transform: translate(-50%, -50%);
          width: 8px;
          z-index: 2;
        }

        .entity-card__aq-hover-chip {
          align-items: center;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          background: color-mix(in srgb, var(--nodalia-entity-surface-base) 88%, transparent);
          border: 1px solid color-mix(in srgb, var(--aq-hover-color) 38%, var(--divider-color));
          border-radius: 999px;
          box-shadow: 0 8px 22px rgba(0, 0, 0, 0.2), inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          display: flex;
          font-size: 11px;
          gap: 6px;
          left: clamp(86px, var(--aq-hover-left), calc(100% - 86px));
          line-height: 1;
          max-width: calc(100% - 16px);
          min-height: 30px;
          padding: 0 10px;
          pointer-events: none;
          position: absolute;
          top: clamp(4px, var(--aq-hover-top), calc(100% - 4px));
          transform: translate(-50%, calc(-100% - 10px));
          white-space: nowrap;
          will-change: left, top;
          z-index: 3;
        }

        .entity-card__aq-hover-chip[data-aq-hover-placement="below"] {
          transform: translate(-50%, 10px);
        }

        .entity-card__aq-hover-swatch {
          background: var(--aq-hover-color);
          border-radius: 999px;
          flex: 0 0 auto;
          height: 8px;
          width: 8px;
        }

        .entity-card__aq-hover-label {
          color: var(--secondary-text-color);
          font-weight: 650;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .entity-card__aq-hover-chip strong {
          color: var(--primary-text-color);
          font-weight: 750;
        }

        .entity-card__aq-hover-chip time {
          color: var(--secondary-text-color);
          font-variant-numeric: tabular-nums;
        }

        .entity-card__aq-legend {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          min-width: 0;
        }

        .entity-card__aq-legend-item {
          appearance: none;
          align-items: center;
          background: none;
          border: 0;
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          font-size: 11px;
          font-family: inherit;
          font-weight: 650;
          gap: 6px;
          margin: 0;
          padding: 0;
          transition: color 140ms ease, opacity 140ms ease;
        }

        .entity-card__aq-legend-swatch {
          background: var(--aq-series-color);
          border-radius: 999px;
          display: inline-block;
          height: 8px;
          transition: background 140ms ease, box-shadow 140ms ease;
          width: 8px;
        }

        .entity-card__aq-legend-item--hidden {
          opacity: 0.44;
          text-decoration: line-through;
        }

        .entity-card__aq-legend-item--hidden .entity-card__aq-legend-swatch {
          background: transparent;
          box-shadow: inset 0 0 0 1.5px var(--aq-series-color);
        }

        .entity-card__aq-chart-empty {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 600;
          padding: 18px 4px;
          text-align: center;
        }

        @media (max-width: 420px) {
          .entity-card__headline {
            grid-template-columns: minmax(0, 1fr);
          }

          .entity-card__chips {
            justify-content: flex-start;
          }
        }

        @keyframes entity-card-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        ${animations.enabled ? "" : `
        ha-card, .entity-card__content, .entity-card__content * {
          animation: none !important;
          transition: none !important;
        }
        `}
        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <ha-card
        class="entity-card entity-card--air-quality is-on ${canRunBodyTap ? "entity-card--clickable" : ""}"
        style="--accent-color:${escapeHtml(accentColor)};"
        ${canRunBodyTap ? `data-entity-action="body" role="button" tabindex="0" aria-label="${escapeHtml(title)}"` : ""}
      >
        <div class="entity-card__content ${shouldAnimateEntrance ? "entity-card__content--entering" : ""}">
          <div class="entity-card__hero">
            <button
              type="button"
              class="entity-card__icon ${canRunIconTap ? "entity-card__icon--clickable" : ""}"
              ${canRunIconTap ? 'data-entity-action="icon"' : ""}
              aria-label="${escapeHtml(title)}"
            >
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
            </button>
            <div class="entity-card__copy">
              <div class="entity-card__headline">
                <div class="entity-card__title">${escapeHtml(title)}</div>
                ${rightChips ? `<div class="entity-card__chips">${rightChips}</div>` : ""}
              </div>
              ${statusChips ? `<div class="entity-card__chips" style="justify-content:flex-start;">${statusChips}</div>` : ""}
            </div>
          </div>
          ${metricBubbles ? `<div class="entity-card__aq-metrics">${metricBubbles}</div>` : ""}
          ${
            aqConfig.show_graphs === true
              ? `
                <div class="entity-card__aq-chart-panel">
                  <div class="entity-card__aq-chart-wrap">
                    ${
                      chartSvg
                        ? `${chartSvg}${chartHoverPoint}${chartHoverChip}`
                        : allChartEntries.length > 0 && chartEntries.length === 0
                          ? ""
                          : `<div class="entity-card__aq-chart-empty">${escapeHtml(
                          this._aqHistoryLoading
                            ? this._entityCardUi("airQuality.loadingGraphs", "Loading history…")
                            : this._entityCardUi("airQuality.emptyGraphs", "No history yet"),
                        )}</div>`
                    }
                  </div>
                  ${legendChips ? `<div class="entity-card__aq-legend">${legendChips}</div>` : ""}
                </div>
              `
              : ""
          }
        </div>
      </ha-card>
    `;

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 120);
    }
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    if (String(this._config?.layout || "").toLowerCase() === "air_quality") {
      this._renderAirQualityLayout();
      return;
    }

    if (OVERVIEW_LAYOUTS.has(String(this._config?.layout || "").toLowerCase())) {
      this._renderOverviewLayout(this._config.layout);
      return;
    }

    const entityGuard = window.NodaliaUtils?.renderLovelaceEntityGuardCardHtml?.(
      this._hass,
      this._config?.entity,
      { cardClass: "entity-card" },
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

    const config = this._config;
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const quickActions = Array.isArray(config.quick_actions) ? config.quick_actions.filter(action => action?.icon) : [];
    const configuredColumns = this._getConfiguredGridColumns();
    const configuredRows = this._getConfiguredGridRows();
    const singleRowLayout = configuredRows !== null ? configuredRows <= 1 : false;
    const narrowCard = configuredColumns !== null ? configuredColumns < 4 : (this._cardWidth || this.clientWidth || 0) <= 300;
    const compactMetrics = narrowCard || singleRowLayout;
    const singleRowPaddingY = singleRowLayout ? 4 : 0;
    const singleRowPaddingX = singleRowLayout ? 9 : 0;
    const effectivePadding = singleRowLayout ? `${singleRowPaddingY}px ${singleRowPaddingX}px` : compactMetrics ? "10px 12px" : styles.card.padding;
    const effectiveGap = singleRowLayout ? "2px" : compactMetrics ? "8px" : styles.card.gap;
    const effectiveIconSizePx = Math.max(30, Math.min(parseSizeToPixels(styles.icon.size, 58), singleRowLayout ? 38 : compactMetrics ? 46 : 58));
    const effectiveIconSize = `${effectiveIconSizePx}px`;
    const effectiveIconTrackSize = `${effectiveIconSizePx + (singleRowLayout ? 7 : 10)}px`;
    const effectiveControlSize = `${Math.max(34, Math.min(parseSizeToPixels(styles.control.size, 40), compactMetrics ? 36 : 40))}px`;
    const effectiveTitleSize = `${Math.max(9.5, Math.min(parseSizeToPixels(styles.title_size, 14), singleRowLayout ? 10 : compactMetrics ? 12 : 14))}px`;
    const effectiveChipHeight = `${Math.max(15, Math.min(parseSizeToPixels(styles.chip_height, 24), singleRowLayout ? 16 : compactMetrics ? 22 : 24))}px`;
    const effectiveChipFontSize = `${Math.max(8, Math.min(parseSizeToPixels(styles.chip_font_size, 11), singleRowLayout ? 8.5 : compactMetrics ? 10 : 11))}px`;
    const effectiveChipPadding = singleRowLayout ? "0 6px" : compactMetrics ? "0 8px" : styles.chip_padding;
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const effectiveCardHeightPx = singleRowLayout ? Math.max(54, effectiveIconSizePx + (singleRowPaddingY * 2)) : 0;
    const effectiveCardMinHeight = singleRowLayout ? `${effectiveCardHeightPx}px` : "0px";
    const effectiveContentMinHeight = singleRowLayout ? `${Math.max(effectiveIconSizePx, effectiveCardHeightPx - (singleRowPaddingY * 2))}px` : "0px";
    const title = this._getTitle(state);
    const icon = this._getIcon(state);
    const entityPicture = this._getEntityPicture(state);
    const isCompactLayout = this._isCompactLayout;
    const accentColor = this._getAccentColor(state);
    const showUnavailableBadge = isUnavailableState(state);
    const stateLabel = config.show_state ? this._translateStateValue(state) : null;
    const stateChip = this._renderChip(stateLabel, "state");
    const statePosition = config.state_position === "right" ? "right" : "below";
    const primaryValue = config.show_primary_chip !== false
      ? this._formatAttributeValue(state, config.primary_attribute)
      : null;
    const secondaryValue = config.show_secondary_chip !== false
      ? this._formatAttributeValue(state, config.secondary_attribute)
      : null;
    const showTitle = config.show_name !== false && (!isCompactLayout || this._shouldShowCompactTitle());
    const placeStateChipOnTitleRow = statePosition === "right" && Boolean(stateChip);
    const chips = [
      placeStateChipOnTitleRow ? "" : stateChip,
      this._renderChip(primaryValue, "value"),
      this._renderChip(secondaryValue, "value"),
    ].filter(Boolean);
    const showCopyHeader = showTitle || placeStateChipOnTitleRow;
    const showCopyBlock = showCopyHeader || chips.length > 0;
    const canRunBodyTap = this._canRunTapAction(state, "body");
    const canRunIconTap = this._canRunTapAction(state, "icon");
    const isSelectEntity = this._isSelectEntity(state);
    const isActive = this._isActiveState(state);
    const entityBubbleIconGlyphColor = isActive
      ? resolveEntityBubbleIconGlyphColor(accentColor, state)
      : styles.icon.off_color;
    const surfaceBase = styles.card.background;
    const onCardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${surfaceBase}) 0%, color-mix(in srgb, ${accentColor} 10%, ${surfaceBase}) 52%, ${surfaceBase} 100%)`;
    const onCardBorder = `color-mix(in srgb, ${accentColor} 32%, var(--divider-color))`;
    const onCardShadow = `0 16px 32px color-mix(in srgb, ${accentColor} 18%, rgba(0, 0, 0, 0.18))`;
    const cardBackground = isActive
      ? onCardBackground
      : surfaceBase;
    const cardBorder = isActive ? `1px solid ${onCardBorder}` : styles.card.border;
    const cardShadow = isActive ? `${styles.card.box_shadow}, ${onCardShadow}` : styles.card.box_shadow;
    const surfaceGlaze = isActive
      ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`
      : "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0))";
    const surfaceAmbient = `
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%)`;
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --entity-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --entity-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          --entity-card-select-panel-duration: ${animations.enabled ? Math.max(220, Math.round(animations.contentDuration * 0.72)) : 0}ms;
          display: block;
          position: relative;
        }

        :host(.entity-card-host--select-open) {
          z-index: 2;
        }

        * {
          box-sizing: border-box;
        }

        ha-card[data-entity-action="body"]:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: -3px;
        }

        ha-card {
          --nodalia-entity-surface-base: ${styles.card.background};
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          display: block;
          overflow: hidden;
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .entity-card--single-row {
          min-height: ${effectiveCardMinHeight};
        }

        ha-card::before {
          background: ${surfaceGlaze};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        ha-card::after {
          background: ${surfaceAmbient};
          content: "";
          inset: 0;
          opacity: ${isActive ? "1" : "0"};
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .entity-card--clickable {
          cursor: pointer;
        }

        .entity-card__icon.entity-card__icon--clickable {
          cursor: pointer;
        }

        .entity-card__content {
          display: grid;
          gap: ${effectiveGap};
          min-width: 0;
          padding: ${effectivePadding};
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease;
          z-index: 1;
        }

        .entity-card__content--entering {
          animation: entity-card-fade-up calc(var(--entity-card-content-duration) * 0.88) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .entity-card__content.is-pressing {
          animation: entity-card-content-bounce var(--entity-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .entity-card--single-row .entity-card__content {
          align-content: center;
          min-height: ${effectiveContentMinHeight};
        }

        .entity-card__hero {
          align-items: center;
          display: grid;
          gap: ${singleRowLayout ? "6px" : narrowCard ? "10px" : "12px"};
          grid-template-columns: ${effectiveIconTrackSize} minmax(0, 1fr);
          min-height: ${singleRowLayout ? effectiveContentMinHeight : "0px"};
          min-width: 0;
        }

        .entity-card__hero--entering {
          animation: entity-card-fade-up calc(var(--entity-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .entity-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${isActive
            ? `color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent))`
            : styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${entityBubbleIconGlyphColor};
          cursor: ${canRunIconTap || canRunBodyTap ? "pointer" : "default"};
          display: inline-flex;
          flex: 0 0 auto;
          height: ${effectiveIconSize};
          justify-content: center;
          line-height: 0;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          justify-self: start;
          transform-origin: center;
          transition: transform 160ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease, color 180ms ease;
          width: ${effectiveIconSize};
        }

        .entity-card__icon--entering {
          animation: entity-card-bubble-bloom calc(var(--entity-card-content-duration) * 0.92) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 40ms;
        }

        .entity-card__icon.is-pressing,
        .entity-card__control.is-pressing {
          animation: entity-card-bubble-bounce var(--entity-card-button-bounce-duration) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
        }

        .entity-card__icon ha-icon {
          --mdc-icon-size: calc(${effectiveIconSize} * 0.46);
          color: ${entityBubbleIconGlyphColor};
          display: inline-flex;
          height: calc(${effectiveIconSize} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${effectiveIconSize} * 0.46);
        }

        .entity-card__picture {
          border-radius: inherit;
          height: 100%;
          inset: 0;
          object-fit: cover;
          position: absolute;
          width: 100%;
        }

        .entity-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          display: inline-flex;
          height: 18px;
          justify-content: center;
          position: absolute;
          right: 0;
          top: 0;
          transform: translate(28%, -28%);
          width: 18px;
          z-index: 2;
        }

        .entity-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          color:#fff;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .entity-card__copy {
          display: grid;
          gap: ${singleRowLayout ? "0" : narrowCard ? "6px" : "10px"};
          min-width: 0;
        }

        .entity-card__copy--entering {
          animation: entity-card-fade-up calc(var(--entity-card-content-duration) * 0.92) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 70ms;
        }

        .entity-card--single-row .entity-card__copy {
          align-content: center;
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .entity-card--compact .entity-card__hero,
        .entity-card--compact:not(.entity-card--with-copy) .entity-card__hero {
          justify-items: start;
          grid-template-columns: ${effectiveIconTrackSize} minmax(0, 1fr);
        }

        .entity-card__copy-header {
          align-items: center;
          display: flex;
          gap: ${singleRowLayout ? "4px" : narrowCard ? "6px" : "8px"};
          min-width: 0;
        }

        .entity-card__title {
          flex: 1 1 auto;
          font-size: ${effectiveTitleSize};
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: ${singleRowLayout ? "1.02" : narrowCard ? "1.1" : "1.15"};
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .entity-card__copy-header-chip {
          display: flex;
          flex: 0 1 auto;
          justify-content: flex-end;
          margin-left: auto;
          max-width: 100%;
          min-width: 0;
        }

        .entity-card__copy-header-chip .entity-card__chip {
          max-width: 100%;
        }

        .entity-card__chips {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: ${singleRowLayout ? "0" : narrowCard ? "6px" : "8px"};
          min-width: 0;
        }

        .entity-card--single-row .entity-card__chips {
          flex-wrap: nowrap;
          gap: 3px;
          justify-content: flex-start;
          margin-left: 0;
        }

        .entity-card__chip {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: ${chipBorderRadius};
          color: var(--secondary-text-color);
          display: inline-flex;
          flex: 0 0 auto;
          font-size: ${effectiveChipFontSize};
          font-weight: 600;
          line-height: 1;
          min-height: ${effectiveChipHeight};
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding: ${effectiveChipPadding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .entity-card--single-row .entity-card__title {
          min-width: 0;
        }

        .entity-card__chip--state {
          color: var(--primary-text-color);
        }

        .entity-card__select-picker-shell-host {
          min-width: 0;
          width: 100%;
        }

        .entity-card:not(.entity-card--select-open) .entity-card__select-picker-shell-host {
          display: none;
        }

        .entity-card__select-picker-shell {
          border-radius: calc(${styles.card.border_radius} - 8px);
          overflow: hidden;
        }

        .entity-card__select-picker-inner {
          display: grid;
        }

        .entity-card__select-picker-shell--entering {
          animation: entity-card-select-shell-expand var(--entity-card-select-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .entity-card__select-picker-shell--entering .entity-card__select-picker-inner {
          animation: entity-card-select-panel-content-in var(--entity-card-select-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .entity-card__select-picker-shell--leaving {
          animation: entity-card-select-shell-collapse var(--entity-card-select-panel-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
          pointer-events: none;
        }

        .entity-card__select-picker-shell--leaving .entity-card__select-picker-inner {
          animation: entity-card-select-panel-content-out var(--entity-card-select-panel-duration) cubic-bezier(0.38, 0, 0.24, 1) both;
        }

        .entity-card__select-picker {
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--accent-color, var(--primary-color)) 8%, color-mix(in srgb, var(--primary-text-color) 3%, transparent)) 0%, color-mix(in srgb, var(--primary-text-color) 2%, transparent) 100%);
          border: 1px solid color-mix(in srgb, var(--accent-color, var(--primary-color)) 18%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: calc(${styles.card.border_radius} - 8px);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent),
            0 14px 28px color-mix(in srgb, var(--accent-color, var(--primary-color)) 12%, rgba(0, 0, 0, 0.18));
          display: grid;
          gap: 10px;
          margin-top: 2px;
          overflow: hidden;
          padding: 10px;
        }

        .entity-card__select-options {
          display: grid;
          gap: 8px;
          max-height: min(240px, 42vh);
          overflow: auto;
          overscroll-behavior: contain;
          padding-right: 2px;
        }

        .entity-card__select-option {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border-radius: 14px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: grid;
          font: inherit;
          gap: 10px;
          grid-template-columns: auto minmax(0, 1fr) auto;
          min-height: 42px;
          padding: 10px 12px;
          text-align: left;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
          width: 100%;
        }

        .entity-card__select-option:hover,
        .entity-card__select-option:focus-visible {
          background: color-mix(in srgb, var(--select-option-accent, var(--primary-color)) 10%, color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border-color: color-mix(in srgb, var(--select-option-accent, var(--primary-color)) 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          outline: none;
        }

        .entity-card__select-option.is-active {
          background: color-mix(in srgb, var(--select-option-accent, var(--primary-color)) 14%, color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border-color: color-mix(in srgb, var(--select-option-accent, var(--primary-color)) 34%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          box-shadow: 0 8px 18px color-mix(in srgb, var(--select-option-accent, var(--primary-color)) 14%, rgba(0, 0, 0, 0.12));
        }

        .entity-card__select-option-indicator {
          background: color-mix(in srgb, var(--primary-text-color) 16%, transparent);
          border-radius: 999px;
          height: 8px;
          width: 8px;
        }

        .entity-card__select-option.is-active .entity-card__select-option-indicator {
          background: var(--select-option-accent, var(--primary-color));
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--select-option-accent, var(--primary-color)) 18%, transparent);
        }

        .entity-card__select-option-label {
          font-size: 0.88rem;
          font-weight: 600;
          line-height: 1.25;
          min-width: 0;
        }

        .entity-card__select-option-check {
          --mdc-icon-size: 18px;
          color: var(--select-option-accent, var(--primary-color));
        }

        @keyframes entity-card-select-shell-expand {
          from {
            max-height: 0;
            opacity: 0;
          }
          to {
            max-height: 320px;
            opacity: 1;
          }
        }

        @keyframes entity-card-select-shell-collapse {
          from {
            max-height: 320px;
            opacity: 1;
          }
          to {
            max-height: 0;
            opacity: 0;
          }
        }

        @keyframes entity-card-select-panel-content-in {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes entity-card-select-panel-content-out {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-6px);
          }
        }

        .entity-card--select-open .entity-card__content {
          align-content: start;
        }

        .entity-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: ${narrowCard ? "8px" : "10px"};
          justify-content: center;
        }

        .entity-card__actions--entering {
          animation: entity-card-fade-up calc(var(--entity-card-content-duration) * 0.94) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 110ms;
        }

        .entity-card__control {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: ${effectiveControlSize};
          justify-content: center;
          line-height: 0;
          margin: 0;
          min-width: ${effectiveControlSize};
          outline: none;
          padding: 0;
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease, color 180ms ease;
          width: ${effectiveControlSize};
        }

        @keyframes entity-card-content-bounce {
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

        @keyframes entity-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes entity-card-bubble-bloom {
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

        @keyframes entity-card-bubble-bounce {
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

        .entity-card__control ha-icon {
          --mdc-icon-size: calc(${effectiveControlSize} * 0.46);
          display: inline-flex;
          height: calc(${effectiveControlSize} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${effectiveControlSize} * 0.46);
        }

        .entity-card__empty-title {
          font-size: 15px;
          font-weight: 700;
        }

        .entity-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }

        .entity-card--empty {
          display: grid;
          gap: 8px;
          padding: 16px;
        }

        @media (max-width: 420px) {
          .entity-card__hero {
            gap: 10px;
            grid-template-columns: 50px minmax(0, 1fr);
          }

          .entity-card__icon {
            height: 50px;
            width: 50px;
          }
        }

        ${animations.enabled ? "" : `
        ha-card,
        .entity-card,
        .entity-card * {
          animation: none !important;
          transition: none !important;
        }
        `}
        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <ha-card
        class="entity-card ${isActive ? "is-on" : "is-off"} ${isCompactLayout ? "entity-card--compact" : ""} ${showCopyBlock ? "entity-card--with-copy" : ""} ${singleRowLayout ? "entity-card--single-row" : ""} ${isSelectEntity ? "entity-card--select" : ""} ${canRunBodyTap ? "entity-card--clickable" : ""}"
        style="--accent-color:${escapeHtml(accentColor)};"
        ${canRunBodyTap ? `data-entity-action="body" role="button" tabindex="0" aria-label="${escapeHtml(title)}"` : ""}
      >
        <div class="entity-card__content ${shouldAnimateEntrance ? "entity-card__content--entering" : ""}">
          <div class="entity-card__hero ${shouldAnimateEntrance ? "entity-card__hero--entering" : ""}">
            <button
              type="button"
              class="entity-card__icon ${shouldAnimateEntrance ? "entity-card__icon--entering" : ""} ${canRunIconTap ? "entity-card__icon--clickable" : ""}"
              ${canRunIconTap ? 'data-entity-action="icon"' : ""}
              aria-label="${escapeHtml(canRunIconTap || canRunBodyTap ? this._commonAria("primaryAction", "Primary action") : title)}"
            >
              ${entityPicture
                ? `<img class="entity-card__picture" src="${escapeHtml(entityPicture)}" alt="" loading="lazy" />`
                : `<ha-icon icon="${escapeHtml(icon)}"></ha-icon>`}
              ${showUnavailableBadge ? `<span class="entity-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${showCopyBlock
              ? `
                <div class="entity-card__copy ${shouldAnimateEntrance ? "entity-card__copy--entering" : ""}">
                  ${showCopyHeader
                    ? `
                      <div class="entity-card__copy-header">
                        ${showTitle ? `<div class="entity-card__title">${escapeHtml(title)}</div>` : ""}
                        ${placeStateChipOnTitleRow ? `
                          <div class="entity-card__copy-header-chip">
                            ${stateChip}
                          </div>
                        ` : ""}
                      </div>
                    `
                    : ""}
                  ${chips.length ? `<div class="entity-card__chips">${chips.join("")}</div>` : ""}
                </div>
              `
              : ""}
          </div>

          ${isSelectEntity ? '<div class="entity-card__select-picker-shell-host" data-select-picker-shell></div>' : ""}

          ${
            quickActions.length
              ? `
                <div class="entity-card__actions ${shouldAnimateEntrance ? "entity-card__actions--entering" : ""}">
                  ${quickActions
                    .map((action, index) => `
                      <button
                        type="button"
                        class="entity-card__control"
                        data-entity-action="quick"
                        data-index="${index}"
                        aria-label="${escapeHtml(action.label || action.type || "Accion")}"
                        title="${escapeHtml(action.label || action.type || "Accion")}"
                      >
                        <ha-icon icon="${escapeHtml(action.icon || "mdi:flash")}"></ha-icon>
                      </button>
                    `)
                    .join("")}
                </div>
              `
              : ""
          }
        </div>
      </ha-card>
    `;

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 120);
    }

    if (isSelectEntity) {
      this._syncSelectPickerHostState(this._selectPickerOpen);
      if (this._selectPickerOpen && !this._selectPickerAnimating) {
        this._refreshSelectPickerContent(state, accentColor);
      }
    }
  }
}
  _lazyNodaliaEntityCard = NodaliaEntityCard;
  return NodaliaEntityCard;
}
