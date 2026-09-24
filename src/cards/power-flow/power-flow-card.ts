// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  NODE_DEFAULTS,
} from "./power-flow-constants";
import {
  clamp,
  deepClone,
  escapeHtml,
  fireEvent,
  isObject,
  mergeConfig,
  normalizeTextKey,
} from "./power-flow-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./power-flow-config";
import {
  arrayFromMaybe,
  buildFlowPath,
  buildStraightFlowPath,
  formatDisplayValue,
  formatRawValue,
  formatSvgMotionNumber,
  getDiagramIndividualCount,
  getFlowLayoutFlagsFromConfig,
  getHassLocaleTag,
  getLayoutPreset,
  getNodePosition,
  getNodePositionForLayout,
  getStubEntityId,
  getSvgPathMotionStart,
  getSvgRelativeMotionPath,
  isEntitySourceConfigured,
  isHomeDevicePopupEnabled,
  isUnavailableState,
  offsetPoint,
  parseNumber,
  parseSizeToPixels,
  resolveIndividualConfigs,
  resolveNodeConfig,
  rgbArrayToColor,
} from "./power-flow-helpers";

let _lazyNodaliaPowerFlowCard;
export function loadNodaliaPowerFlowCard() {
  if (_lazyNodaliaPowerFlowCard) {
    return _lazyNodaliaPowerFlowCard;
  }
class NodaliaPowerFlowCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    const config = deepClone(STUB_CONFIG);
    const entityId = getStubEntityId(hass, ["sensor"], entities, entitiesFallback);
    if (!entityId) {
      return config;
    }

    config.entities.grid.entity = entityId;
    config.entities.home.entity = entityId;
    return config;
  }

  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._trackedEntityIdsCache = null;
    this._trackedEntityRevision = null;
    this._trackedEntitiesStamp = "";
    this._trackedEntityIdsLength = 0;
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowKeyDown = this._onShadowKeyDown.bind(this);
    this._onHomePopupKeydown = this._onHomePopupKeydown.bind(this);
    this._homePopupOpen = false;
    this._flowViewportVisible = true;
    this._flowViewportObserver = null;
    this._onFlowViewport = this._onFlowViewport.bind(this);
    this._onFlowVisibility = this._onFlowVisibility.bind(this);
    this._flowUnpauseRaf = 0;
    }

  _onFlowViewport(entries) {
    if (!this.isConnected) {
      return;
    }
    const hit = entries.some(entry => entry.isIntersecting);
    this._flowViewportVisible = hit;
    this._syncFlowMotionPause();
  }

  _onFlowVisibility() {
    this._syncFlowMotionPause();
  }

  _attachFlowViewportTracking() {
    this._detachFlowViewportTracking();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this._onFlowVisibility);
    }
    if (typeof IntersectionObserver === "function") {
      this._flowViewportObserver = new IntersectionObserver(this._onFlowViewport, {
        root: null,
        rootMargin: "0px",
        threshold: 0,
      });
      this._flowViewportObserver.observe(this);
    } else {
      this._flowViewportVisible = true;
    }
    this._syncFlowMotionPause();
  }

  _detachFlowViewportTracking() {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this._onFlowVisibility);
    }
    if (this._flowViewportObserver) {
      this._flowViewportObserver.disconnect();
      this._flowViewportObserver = null;
    }
    this._flowViewportVisible = true;
    this._clearFlowUnpauseRaf();
  }

  _clearFlowUnpauseRaf() {
    if (this._flowUnpauseRaf && typeof window !== "undefined") {
      window.cancelAnimationFrame(this._flowUnpauseRaf);
      this._flowUnpauseRaf = 0;
    }
  }

  _syncFlowMotionPause() {
    if (!this.shadowRoot) {
      return;
    }
    const docHidden = typeof document !== "undefined" && document.hidden;
    const shouldPause = docHidden || !this._flowViewportVisible;
    const haCard = this.shadowRoot.querySelector("ha-card");
    if (shouldPause) {
      this._clearFlowUnpauseRaf();
      haCard?.classList.add("power-flow-card--motion-paused");
      for (const svg of this.shadowRoot.querySelectorAll("svg")) {
        try {
          if (typeof svg.pauseAnimations === "function") {
            svg.pauseAnimations();
          }
        } catch (_err) {
          // Ignore SVG animation control failures in older engines.
        }
      }
      return;
    }
    haCard?.classList.remove("power-flow-card--motion-paused");
    this._clearFlowUnpauseRaf();
    const runUnpause = () => {
      this._flowUnpauseRaf = 0;
      if (!this.isConnected || !this.shadowRoot) {
        return;
      }
      const stillHidden = typeof document !== "undefined" && document.hidden;
      if (stillHidden || !this._flowViewportVisible) {
        return;
      }
      for (const svg of this.shadowRoot.querySelectorAll("svg")) {
        try {
          if (typeof svg.unpauseAnimations === "function") {
            svg.unpauseAnimations();
          }
        } catch (_err) {
          // Ignore SVG animation control failures in older engines.
        }
      }
    };
    /** Two rAFs give freshly-rendered SVG motion paths a stable frame without forcing synchronous layout. */
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      this._flowUnpauseRaf = window.requestAnimationFrame(() => {
        if (!this.isConnected || !this.shadowRoot) {
          this._flowUnpauseRaf = 0;
          return;
        }
        this._flowUnpauseRaf = window.requestAnimationFrame(() => {
          runUnpause();
        });
      });
    } else {
      runUnpause();
    }
  }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    this.shadowRoot?.addEventListener("keydown", this._onShadowKeyDown);
    if (typeof document !== "undefined") {
      document.addEventListener("keydown", this._onHomePopupKeydown);
    }
    this._attachFlowViewportTracking();
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    window.NodaliaUtils?.releaseModalFocus?.(this);
    this._clearFlowUnpauseRaf();
    this._detachFlowViewportTracking();
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
    this.shadowRoot?.removeEventListener("keydown", this._onShadowKeyDown);
    if (typeof document !== "undefined") {
      document.removeEventListener("keydown", this._onHomePopupKeydown);
    }
    this._homePopupOpen = false;
    this._syncHomePopupHostState();
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
    this._homePopupOpen = false;
    this._syncHomePopupHostState();
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._invalidateTrackedEntityStampCache();
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._syncTrackedEntitiesStamp(hass);
    const nextSignature = this._getRenderSignature(hass);
    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }
    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    const flowFlags = getFlowLayoutFlagsFromConfig(this._config);
    const layoutPreset = getLayoutPreset({
      top: flowFlags.topCount,
      bottom: flowFlags.bottomUtilities,
      individual: flowFlags.individualCount,
    });

    return layoutPreset === "simple" ? 4 : 4;
  }

  getGridOptions() {
    const flowFlags = getFlowLayoutFlagsFromConfig(this._config);
    const layoutPreset = getLayoutPreset({
      top: flowFlags.topCount,
      bottom: flowFlags.bottomUtilities,
      individual: flowFlags.individualCount,
    });

    const base = mergeConfig(DEFAULT_CONFIG.grid_options || {}, this._config?.grid_options || {});
    const minRows = Math.max(1, Number(base.min_rows) || 1);
    return {
      rows: base.rows === undefined || base.rows === "" ? "auto" : base.rows,
      columns: base.columns === undefined || base.columns === "" ? "full" : base.columns,
      min_rows: layoutPreset === "simple" ? Math.max(minRows, 3) : minRows,
      min_columns: Math.max(1, Number(base.min_columns) || 6),
    };
  }

  _getLocaleTag() {
    return getHassLocaleTag(this._hass, this._config?.language ?? "auto");
  }

  _powerFlowUi(path, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const readPath = pack => String(path || "").split(".").reduce((value, key) => value?.[key], pack);
    const raw = readPath(window.NodaliaI18n?.strings?.(lang)?.powerFlowCard)
      ?? readPath(window.NodaliaI18n?.strings?.("en")?.powerFlowCard);
    return String(raw != null && raw !== "" ? raw : fallback);
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
        160,
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

  _getNodeIconGlyphColor(node) {
    const defaultColor = this._config?.styles?.icon?.color || DEFAULT_CONFIG.styles.icon.color;
    const accent = String(node?.color || "").trim();
    if (!accent) {
      return defaultColor;
    }
    const state = node?.entityId ? this._hass?.states?.[node.entityId] : null;
    const darken = Boolean(window.NodaliaBubbleContrast?.shouldDarkenBubbleIconGlyph(state, accent));
    return darken
      ? `color-mix(in srgb, var(--primary-text-color) 56%, ${accent})`
      : defaultColor;
  }

  _navigate(path) {
    if (!path) {
      return;
    }

    window.history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  _getNodeSourceState(source) {
    if (!this._hass?.states) {
      return null;
    }

    if (typeof source === "string") {
      return this._hass.states[source] || null;
    }

    if (isObject(source)) {
      const entityId = source.entity || source.consumption || source.production || "";
      return entityId ? this._hass.states[entityId] || null : null;
    }

    return null;
  }

  _getSourceUnit(state) {
    return String(state?.attributes?.unit_of_measurement || state?.attributes?.native_unit_of_measurement || "").trim();
  }

  /**
   * Resolves a numeric `value` from a string entity id or a `{ entity | consumption | production }` object.
   * Split **grid** entities follow import/export semantics: `consumption − production` (positive = net import).
   * Split **battery** entities follow HA energy semantics: `production − consumption` (positive = discharge,
   * negative = charge), matching the single-sensor convention documented on `_applyDerivedHomeAndGridDisplay`.
   */
  _resolveSourceValue(source, kind = null) {
    if (!this._hass?.states || !source) {
      return { value: null, unit: "", state: null, entityId: "" };
    }

    if (typeof source === "string") {
      const state = this._hass.states[source] || null;
      return {
        value: parseNumber(state?.state),
        unit: this._getSourceUnit(state),
        state,
        entityId: source,
      };
    }

    if (isObject(source)) {
      const directEntity = String(source.entity || "").trim();
      if (directEntity) {
        const state = this._hass.states[directEntity] || null;
        return {
          value: parseNumber(state?.state),
          unit: this._getSourceUnit(state),
          state,
          entityId: directEntity,
        };
      }

      const consumptionEntity = String(source.consumption || "").trim();
      const productionEntity = String(source.production || "").trim();
      const consumptionState = consumptionEntity ? this._hass.states[consumptionEntity] || null : null;
      const productionState = productionEntity ? this._hass.states[productionEntity] || null : null;
      const consumptionValue = parseNumber(consumptionState?.state) || 0;
      const productionValue = parseNumber(productionState?.state) || 0;
      const unit = String(
        consumptionState?.attributes?.unit_of_measurement
        || productionState?.attributes?.unit_of_measurement
        || consumptionState?.attributes?.native_unit_of_measurement
        || productionState?.attributes?.native_unit_of_measurement
        || "",
      ).trim();

      const net =
        kind === "battery"
          ? productionValue - consumptionValue
          : consumptionValue - productionValue;

      return {
        value: net,
        unit,
        state: consumptionState || productionState,
        entityId: consumptionEntity || productionEntity,
      };
    }

    return { value: null, unit: "", state: null, entityId: "" };
  }

  _resolveGridExportSource(nodeConfig, sourceResult) {
    const exportEntityId = String(nodeConfig?.export_entity || "").trim();
    const exportState = exportEntityId ? this._hass?.states?.[exportEntityId] || null : null;
    const exportValue = parseNumber(exportState?.state);
    const splitExportActive = Number.isFinite(exportValue) && exportValue > 0.001;
    const negativeExportActive =
      nodeConfig?.export_when_negative !== false &&
      Number.isFinite(sourceResult?.value) &&
      sourceResult.value < -0.001;

    if (!splitExportActive && !negativeExportActive) {
      return null;
    }

    const magnitude = splitExportActive ? exportValue : Math.abs(sourceResult.value);
    const unit = splitExportActive ? this._getSourceUnit(exportState) : sourceResult.unit;
    return {
      value: -Math.abs(magnitude),
      unit,
      state: splitExportActive ? exportState : sourceResult.state,
      entityId: splitExportActive ? exportEntityId : sourceResult.entityId,
      active: true,
    };
  }

  _getSecondaryInfoText(nodeConfig, baseState) {
    if (this._config?.show_secondary_info === false || !isObject(nodeConfig?.secondary_info)) {
      return "";
    }

    const info = nodeConfig.secondary_info;
    const infoEntity = String(info.entity || "").trim();
    const infoAttribute = String(info.attribute || "").trim();
    const infoState = infoEntity ? this._hass?.states?.[infoEntity] || null : baseState;

    if (!infoState) {
      return "";
    }

    if (infoAttribute) {
      const rawAttribute = infoState.attributes?.[infoAttribute];
      if (rawAttribute === undefined || rawAttribute === null || rawAttribute === "") {
        return "";
      }
      return String(rawAttribute);
    }

    if (!infoEntity) {
      return "";
    }

    const rawValue = parseNumber(infoState.state);
    const unit = String(info.unit || infoState.attributes?.unit_of_measurement || infoState.attributes?.native_unit_of_measurement || "").trim();
    if (rawValue === null) {
      return String(infoState.state || "");
    }

    const decimals = Number.isFinite(Number(info.decimals)) ? Number(info.decimals) : 0;
    return `${formatRawValue(rawValue, decimals, this._getLocaleTag())}${unit ? ` ${unit}` : ""}`;
  }

  _resolveNodeDescriptor(kind, configOverride = null, index = 0, total = 0, hasBottomUtilities = false, flowFlags = {}) {
    const nodeConfig = configOverride || resolveNodeConfig(kind, this._config);
    let sourceResult = this._resolveSourceValue(nodeConfig.entity, kind);
    if (
      kind === "grid" &&
      !sourceResult.entityId &&
      String(nodeConfig?.export_entity || "").trim()
    ) {
      const exportEntityId = String(nodeConfig.export_entity).trim();
      const exportState = this._hass?.states?.[exportEntityId] || null;
      sourceResult = {
        value: 0,
        unit: this._getSourceUnit(exportState),
        state: exportState,
        entityId: exportEntityId,
      };
    }
    const gridExport = kind === "grid" ? this._resolveGridExportSource(nodeConfig, sourceResult) : null;
    if (gridExport) {
      sourceResult = {
        ...sourceResult,
        value: gridExport.value,
        unit: gridExport.unit,
        state: gridExport.state,
        entityId: gridExport.entityId,
      };
    }
    const state = sourceResult.state;
    const unavailable = Boolean(nodeConfig.entity || nodeConfig.export_entity) && (!state || isUnavailableState(state));
    const defaultNodeName = NODE_DEFAULTS[kind]?.name || kind;
    const label = kind !== "individual" && nodeConfig.name === defaultNodeName
      ? this._powerFlowUi(`nodes.${kind}`, defaultNodeName)
      : (nodeConfig.name || state?.attributes?.friendly_name || defaultNodeName);
    let icon = nodeConfig.icon || state?.attributes?.icon || NODE_DEFAULTS[kind]?.icon || "mdi:flash";
    const color = gridExport
      ? (nodeConfig.export_color || NODE_DEFAULTS.grid.export_color)
      : (nodeConfig.color || NODE_DEFAULTS[kind]?.color || "#ffffff");
    const secondary = this._getSecondaryInfoText(nodeConfig, state);
    const display = formatDisplayValue(sourceResult.value, sourceResult.unit, this._getLocaleTag());
    const nodeKind = kind === "individual" ? "individual" : kind;

    const descriptor = {
      id: kind === "individual" ? `${kind}-${index}` : kind,
      kind: nodeKind,
      entityId: sourceResult.entityId || String(nodeConfig.entity || ""),
      label,
      icon,
      color,
      value: sourceResult.value,
      unit: sourceResult.unit,
      valueText: display.value,
      unitText: display.unit,
      isExporting: Boolean(gridExport),
      state,
      secondary,
      unavailable,
      position: getNodePositionForLayout(nodeKind, index, total, hasBottomUtilities, this._layoutPreset || "full", flowFlags),
      sourceConfig: nodeConfig,
    };

    if (nodeKind === "battery") {
      descriptor.icon = this._getBatteryStatusIcon(descriptor, icon);
    }

    return descriptor;
  }

  _getBatteryLevel(node) {
    const values = [];
    const addCandidate = value => {
      const parsed = parseNumber(value);
      if (parsed !== null) {
        values.push(parsed);
      }
    };

    addCandidate(node?.state?.attributes?.battery_level);
    addCandidate(node?.state?.attributes?.battery);
    addCandidate(node?.state?.attributes?.battery_remaining);
    addCandidate(node?.state?.attributes?.battery_state_of_charge);
    addCandidate(node?.state?.attributes?.state_of_charge);
    addCandidate(node?.state?.attributes?.soc);

    const info = node?.sourceConfig?.secondary_info;
    if (isObject(info)) {
      const infoEntity = String(info.entity || "").trim();
      const infoState = infoEntity ? this._hass?.states?.[infoEntity] : node?.state;
      if (infoState) {
        const attribute = String(info.attribute || "").trim();
        if (attribute) {
          addCandidate(infoState.attributes?.[attribute]);
        } else {
          const unit = String(info.unit || infoState.attributes?.unit_of_measurement || infoState.attributes?.native_unit_of_measurement || "").trim();
          if (unit === "%") {
            addCandidate(infoState.state);
          }
        }
      }
    }

    const level = values.find(value => Number.isFinite(value) && value >= 0 && value <= 100);
    return Number.isFinite(level) ? clamp(level, 0, 100) : null;
  }

  _getBatteryStatusIcon(node, fallbackIcon = NODE_DEFAULTS.battery.icon) {
    const configuredIcon = String(this._config?.entities?.battery?.icon ?? "").trim();
    if (configuredIcon && configuredIcon !== NODE_DEFAULTS.battery.icon) {
      return configuredIcon;
    }

    const value = Number(node?.value);
    if (Number.isFinite(value)) {
      if (value < -0.001) {
        return "mdi:battery-charging";
      }
      if (value > 0.001) {
        return "mdi:battery-arrow-down";
      }
    }

    const level = this._getBatteryLevel(node);
    if (level !== null && level >= 99.5) {
      return "mdi:battery-check";
    }

    return fallbackIcon || NODE_DEFAULTS.battery.icon;
  }

  _getTrackedEntityIds() {
    const config = this._config || {};
    const entityIds = new Set();

    const registerNodeEntity = nodeConfig => {
      if (!nodeConfig) {
        return;
      }

      const source = nodeConfig.entity;
      if (typeof source === "string" && source.trim()) {
        entityIds.add(source.trim());
      } else if (isObject(source)) {
        if (String(source.entity || "").trim()) {
          entityIds.add(String(source.entity).trim());
        }
        if (String(source.consumption || "").trim()) {
          entityIds.add(String(source.consumption).trim());
        }
        if (String(source.production || "").trim()) {
          entityIds.add(String(source.production).trim());
        }
      }

      const exportEntity = String(nodeConfig.export_entity || "").trim();
      if (exportEntity) {
        entityIds.add(exportEntity);
      }

      const secondaryEntity = String(nodeConfig.secondary_info?.entity || "").trim();
      if (secondaryEntity) {
        entityIds.add(secondaryEntity);
      }
    };

    const chips = config.consumption_chips || {};
    [chips.day_entity, chips.month_entity].forEach(entityId => {
      const value = String(entityId || "").trim();
      if (value) {
        entityIds.add(value);
      }
    });

    ["grid", "home", "solar", "battery", "water", "gas"].forEach(kind => {
      registerNodeEntity(resolveNodeConfig(kind, config));
    });

    resolveIndividualConfigs(config).forEach(registerNodeEntity);

    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    return [...entityIds].sort((left, right) => left.localeCompare(right, sortLoc));
  }

  _invalidateTrackedEntityStampCache() {
    this._trackedEntityIdsCache = null;
    this._trackedEntityRevision = null;
    this._trackedEntitiesStamp = "";
    this._trackedEntityIdsLength = 0;
  }

  _getCachedTrackedEntityIds() {
    if (this._trackedEntityIdsCache) {
      return this._trackedEntityIdsCache;
    }
    this._trackedEntityIdsCache = this._getTrackedEntityIds();
    return this._trackedEntityIdsCache;
  }

  _buildTrackedEntitiesStamp(hass = this._hass) {
    if (!hass) {
      return "";
    }
    return this._getCachedTrackedEntityIds()
      .map(entityId => {
        const state = hass.states?.[entityId];
        return `${entityId}:${state?.state ?? ""}:${state?.last_updated ?? state?.last_changed ?? ""}`;
      })
      .join("|");
  }

  _syncTrackedEntitiesStamp(hass = this._hass) {
    if (!hass) {
      this._trackedEntitiesStamp = "";
      return;
    }

    if (!this._trackedEntityRevision) {
      this._trackedEntityRevision = new Map();
    }

    const ids = this._getCachedTrackedEntityIds();
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
    } else {
      this._trackedEntityRevision.clear();
      for (const entityId of ids) {
        const state = hass.states?.[entityId];
        this._trackedEntityRevision.set(
          entityId,
          `${state?.state ?? ""}:${state?.last_updated ?? state?.last_changed ?? ""}`,
        );
      }
      this._trackedEntityIdsLength = ids.length;
      dirty = true;
    }

    if (dirty || !this._trackedEntitiesStamp) {
      this._trackedEntitiesStamp = this._buildTrackedEntitiesStamp(hass);
    }
  }

  _getLayoutConfigStamp() {
    const branchStamp = ["grid", "solar", "battery", "home", "water", "gas"].map(kind => {
      const cfg = resolveNodeConfig(kind, this._config);
      const entity = cfg?.entity;
      if (typeof entity === "string") {
        return `${kind}:${entity.trim()}`;
      }
      if (isObject(entity)) {
        return `${kind}:${String(entity.entity || "").trim()}|${String(entity.consumption || "").trim()}|${String(entity.production || "").trim()}`;
      }
      if (kind === "grid") {
        return `${kind}:${String(cfg?.export_entity || "").trim()}`;
      }
      return `${kind}:`;
    }).join(";");
    const individualStamp = resolveIndividualConfigs(this._config)
      .map(entry => `${entry.entity}|${entry.name}|${entry.icon}|${entry.color}`)
      .join(";");
    return [
      branchStamp,
      individualStamp,
      isHomeDevicePopupEnabled(this._config) ? "popup:1" : "popup:0",
    ].join("::");
  }

  _getRenderSignature(hass = this._hass) {
    if (!this._trackedEntitiesStamp && hass) {
      this._syncTrackedEntitiesStamp(hass);
    }

    const chips = this._config?.consumption_chips || {};
    const joinParts = window.NodaliaRenderSignature?.joinParts;
    if (typeof joinParts === "function") {
      return joinParts([
        { prefix: "cfg:", values: [
          this._config?.title || this._config?.name || "",
          this._config?.dashboard_link || "",
          this._config?.show_header !== false,
          this._config?.show_values !== false,
          this._config?.show_labels !== false,
        ] },
        { prefix: "popup:", values: [this._homePopupOpen === true] },
        { prefix: "chips:", values: [chips.day_entity || "", chips.month_entity || ""] },
        { prefix: "layout:", values: [this._getLayoutConfigStamp()] },
        { prefix: "states:", values: [this._trackedEntitiesStamp] },
      ]);
    }

    return [
      this._config?.title || this._config?.name || "",
      this._config?.dashboard_link || "",
      this._homePopupOpen === true ? "1" : "0",
      `${chips.day_entity || ""}|${chips.month_entity || ""}`,
      this._getLayoutConfigStamp(),
      this._trackedEntitiesStamp,
    ].join("::");
  }

  _isDiagramBranchConfigured(kind) {
    const cfg = resolveNodeConfig(kind, this._config);
    if (kind === "grid") {
      return isEntitySourceConfigured(cfg?.entity) || Boolean(String(cfg?.export_entity || "").trim());
    }
    return isEntitySourceConfigured(cfg?.entity);
  }

  _shouldRenderDiagramNode(kind, node) {
    return Boolean(node?.entityId) || this._isDiagramBranchConfigured(kind);
  }

  /**
   * No "Home" entity: instantaneous consumption is roughly solar + grid + battery (card conventions:
   * red +import / -export, batería +descarga / -carga).
   * Nodo red con exportación: número en positivo y flecha integrada en el chip de valor.
   */
  _applyDerivedHomeAndGridDisplay(nodes) {
    const homeCfg = resolveNodeConfig("home", this._config);
    const homeConfigured = isEntitySourceConfigured(homeCfg.entity);
    if (!homeConfigured) {
      const grid = nodes.grid;
      const solar = nodes.solar;
      const battery = nodes.battery;
      const branchCount = [grid, solar, battery].filter(n => n.entityId).length;
      const canCompute = branchCount >= 2 || (branchCount === 1 && grid.entityId);

      if (canCompute) {
        let invalid = false;
        let sum = 0;
        const add = (n) => {
          if (!n.entityId) {
            return;
          }
          if (n.unavailable) {
            invalid = true;
            return;
          }
          if (!Number.isFinite(n.value)) {
            invalid = true;
            return;
          }
          sum += n.value;
        };
        add(grid);
        add(solar);
        add(battery);

        if (invalid) {
          nodes.home.unavailable = true;
          nodes.home.value = null;
          nodes.home.valueText = "--";
          nodes.home.unitText = "";
        } else {
          nodes.home.unavailable = false;
          nodes.home.value = sum;
          const unit = String(grid.unit || solar.unit || battery.unit || "").trim();
          const display = formatDisplayValue(sum, unit, this._getLocaleTag());
          nodes.home.valueText = display.value;
          nodes.home.unitText = display.unit;
          nodes.home.state = grid.state || solar.state || battery.state;
        }
      }
    } else {
      this._applyHomeDemandDerivedFlows(nodes);
    }

    const g = nodes.grid;
    if (g.entityId && !g.unavailable && Number.isFinite(g.value) && (g.value < -0.001 || g.isExporting)) {
      const display = formatDisplayValue(Math.abs(g.value), g.unit, this._getLocaleTag());
      g.valueText = display.value;
      g.unitText = display.unit;
    }
  }

  _applyHomeDemandDerivedFlows(nodes) {
    const home = nodes.home;
    const grid = nodes.grid;
    const solar = nodes.solar;
    const battery = nodes.battery;
    if (!home?.entityId || home.unavailable || !Number.isFinite(home.value)) {
      return;
    }

    const hasGridSensor = Boolean(isEntitySourceConfigured(resolveNodeConfig("grid", this._config).entity) || String(resolveNodeConfig("grid", this._config).export_entity || "").trim());
    const hasSolar = Boolean(solar?.entityId && !solar.unavailable && Number.isFinite(solar.value));
    const hasBattery = Boolean(battery?.entityId && !battery.unavailable && Number.isFinite(battery.value));
    if (!hasSolar && !hasBattery && hasGridSensor) {
      return;
    }

    const homeDemand = Math.max(0, Number(home.value));
    const solarProduction = hasSolar ? Math.max(0, Number(solar.value)) : 0;
    const batteryPower = hasBattery ? Number(battery.value) : 0;
    const batteryDischarge = Math.max(0, batteryPower);
    const batteryCharge = Math.max(0, -batteryPower);

    const solarToHome = Math.min(solarProduction, homeDemand);
    let remainingHomeDemand = Math.max(0, homeDemand - solarToHome);
    const batteryToHome = Math.min(batteryDischarge, remainingHomeDemand);
    remainingHomeDemand = Math.max(0, remainingHomeDemand - batteryToHome);
    const gridToHome = remainingHomeDemand;

    let remainingSolar = Math.max(0, solarProduction - solarToHome);
    const solarToBattery = Math.min(remainingSolar, batteryCharge);
    remainingSolar = Math.max(0, remainingSolar - solarToBattery);
    const gridToBattery = Math.max(0, batteryCharge - solarToBattery);
    const batteryToGrid = Math.max(0, batteryDischarge - batteryToHome);
    const solarToGrid = Math.max(0, remainingSolar);
    const gridExport = Math.max(0, solarToGrid + batteryToGrid);
    const gridImport = Math.max(0, gridToHome + gridToBattery);
    const gridNet = gridImport > 0.001 ? gridImport : gridExport > 0.001 ? -gridExport : 0;
    const unit = String(home.unit || solar?.unit || battery?.unit || grid?.unit || "").trim();

    grid.entityId = grid.entityId || home.entityId;
    grid.state = grid.state || home.state;
    grid.unavailable = false;
    grid.value = gridNet;
    grid.unit = unit;
    grid.isDerived = true;
    grid.isExporting = gridExport > 0.001;
    if (grid.isExporting) {
      const gridCfg = resolveNodeConfig("grid", this._config);
      grid.color = gridCfg.export_color || NODE_DEFAULTS.grid.export_color;
    }
    const gridDisplay = formatDisplayValue(Math.abs(gridNet), unit, this._getLocaleTag());
    grid.valueText = gridDisplay.value;
    grid.unitText = gridDisplay.unit;

    nodes._flowValues = {
      gridHome: gridToHome,
      solarHome: solarToHome,
      batteryHome: batteryToHome,
      solarBattery: solarToBattery,
      gridBattery: gridToBattery,
      solarGrid: solarToGrid,
      batteryGrid: batteryToGrid,
      gridImport,
      gridExport,
    };
  }

  _applyMeasuredFlowValues(nodes) {
    if (nodes._flowValues) {
      return;
    }

    const home = nodes.home;
    const grid = nodes.grid;
    const solar = nodes.solar;
    const battery = nodes.battery;
    const hasGrid = Boolean(grid?.entityId && !grid.unavailable && Number.isFinite(grid.value));
    const hasSolar = Boolean(solar?.entityId && !solar.unavailable && Number.isFinite(solar.value));
    const hasBattery = Boolean(battery?.entityId && !battery.unavailable && Number.isFinite(battery.value));
    if (!hasGrid && !hasSolar && !hasBattery) {
      return;
    }

    const homeDemand = home && !home.unavailable && Number.isFinite(home.value) ? Math.max(0, Number(home.value)) : 0;
    const gridNet = hasGrid ? Number(grid.value) : 0;
    const gridImport = gridNet > 0.001 ? gridNet : 0;
    const gridExport = gridNet < -0.001 || grid?.isExporting ? Math.abs(gridNet) : 0;
    const solarProduction = hasSolar ? Math.max(0, Number(solar.value)) : 0;
    const batteryPower = hasBattery ? Number(battery.value) : 0;
    const batteryDischarge = Math.max(0, batteryPower);
    const batteryCharge = Math.max(0, -batteryPower);

    const solarToHome = Math.min(solarProduction, homeDemand);
    let remainingHomeDemand = Math.max(0, homeDemand - solarToHome);
    const batteryToHome = Math.min(batteryDischarge, remainingHomeDemand);
    remainingHomeDemand = Math.max(0, remainingHomeDemand - batteryToHome);
    const gridToHome = Math.min(gridImport, remainingHomeDemand);
    let remainingGridImport = Math.max(0, gridImport - gridToHome);

    let remainingSolar = Math.max(0, solarProduction - solarToHome);
    const solarToBattery = Math.min(remainingSolar, batteryCharge);
    remainingSolar = Math.max(0, remainingSolar - solarToBattery);
    const remainingBatteryCharge = Math.max(0, batteryCharge - solarToBattery);
    const gridToBattery = Math.min(remainingGridImport, remainingBatteryCharge);
    remainingGridImport = Math.max(0, remainingGridImport - gridToBattery);

    let remainingGridExport = gridExport;
    let solarToGrid = Math.min(remainingSolar, remainingGridExport);
    remainingGridExport = Math.max(0, remainingGridExport - solarToGrid);
    const batteryExportCapacity = Math.max(0, batteryDischarge - batteryToHome);
    let batteryToGrid = Math.min(batteryExportCapacity, remainingGridExport);
    remainingGridExport = Math.max(0, remainingGridExport - batteryToGrid);

    // Small positive remainder after measured splits: visualization-only; prefer a solar export path
    // when a solar entity exists (typical PV surplus), else battery discharge-to-grid — not strict physics.
    if (remainingGridExport > 0.001) {
      if (hasSolar) {
        solarToGrid += remainingGridExport;
      } else if (hasBattery) {
        batteryToGrid += remainingGridExport;
      }
    }

    nodes._flowValues = {
      gridHome: gridToHome,
      solarHome: solarToHome,
      batteryHome: batteryToHome,
      solarBattery: solarToBattery,
      gridBattery: gridToBattery,
      solarGrid: solarToGrid,
      batteryGrid: batteryToGrid,
      gridImport,
      gridExport,
    };
  }

  _getNodes() {
    const flowFlags = getFlowLayoutFlagsFromConfig(this._config);
    const bottomUtilities = flowFlags.bottomUtilities;
    const individualConfigs = resolveIndividualConfigs(this._config);
    const diagramIndividualCount = getDiagramIndividualCount(this._config);
    const showIndividualsOnDiagram = diagramIndividualCount > 0;
    this._layoutPreset = getLayoutPreset({
      top: flowFlags.topCount,
      bottom: bottomUtilities,
      individual: diagramIndividualCount,
    });

    const hasBottom = bottomUtilities > 0;
    const nodes = {
      home: this._resolveNodeDescriptor("home", null, 0, 0, hasBottom, flowFlags),
      grid: this._resolveNodeDescriptor("grid", null, 0, 0, hasBottom, flowFlags),
      solar: this._resolveNodeDescriptor("solar", null, 0, 0, hasBottom, flowFlags),
      battery: this._resolveNodeDescriptor("battery", null, 0, 0, hasBottom, flowFlags),
      water: this._resolveNodeDescriptor("water", null, 0, bottomUtilities, hasBottom, flowFlags),
      gas: this._resolveNodeDescriptor("gas", null, 1, bottomUtilities, hasBottom, flowFlags),
      individual: showIndividualsOnDiagram
        ? individualConfigs.map((config, index) =>
          this._resolveNodeDescriptor("individual", config, index, individualConfigs.length, hasBottom, flowFlags),
        )
        : [],
    };

    if (!nodes.home.entityId) {
      nodes.home.entityId = nodes.grid.entityId || nodes.solar.entityId || nodes.battery.entityId || "";
    }

    this._applyDerivedHomeAndGridDisplay(nodes);
    this._applyMeasuredFlowValues(nodes);

    nodes._layoutPreset = this._layoutPreset;
    nodes._flowFlags = flowFlags;

    return nodes;
  }

  _getLineNeutralStyle() {
    const grey = rgbArrayToColor(this._config?.display_zero_lines?.grey_color);
    const opacity = 1 - (clamp(Number(this._config?.display_zero_lines?.transparency ?? 50), 0, 100) / 100);
    return { color: grey, opacity };
  }

  _shouldShowZeroLines() {
    return normalizeTextKey(this._config?.display_zero_lines?.mode) !== "hide";
  }

  _toFlowMagnitude(value, unit) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const unitKey = normalizeTextKey(unit);
    if (unitKey === "kw") {
      return Math.abs(value) * 1000;
    }
    return Math.abs(value);
  }

  _flowDuration(magnitude, maxMagnitude) {
    const minFlowRate = Math.max(0.6, Number(this._config?.min_flow_rate) || DEFAULT_CONFIG.min_flow_rate);
    const maxFlowRate = Math.max(minFlowRate + 0.1, Number(this._config?.max_flow_rate) || DEFAULT_CONFIG.max_flow_rate);
    const safeMax = Math.max(maxMagnitude, 1);
    const ratio = clamp(magnitude / safeMax, 0, 1);
    return maxFlowRate - ((maxFlowRate - minFlowRate) * ratio);
  }

  _buildLines(nodes) {
    const home = nodes.home;
    const layoutPreset = nodes._layoutPreset || "full";
    const zeroLineVisible = this._shouldShowZeroLines();
    const neutralStyle = this._getLineNeutralStyle();
    /** In viewBox units; distance from node centre toward the other node so the stroke meets the bubble edge. */
    const homeRadius = layoutPreset === "simple" ? 8.8 : layoutPreset === "compact" ? 10.2 : 11.8;
    const nodeRadius = layoutPreset === "simple" ? 4.8 : layoutPreset === "compact" ? 5.5 : 6.1;
    const individualRadius = layoutPreset === "simple" ? 4.2 : layoutPreset === "compact" ? 4.6 : 5;
    const lineCandidates = [];
    const flowValues = nodes._flowValues || {};

    const pushLine = (id, sourceNode, targetNode, value, unit, color, bidirectional = true, straight = false) => {
      const magnitude = this._toFlowMagnitude(value, unit);
      const active = magnitude > 0.001;
      if (!active && !zeroLineVisible) {
        return;
      }

      let fromNode = sourceNode;
      let toNode = targetNode;

      if (active && bidirectional && value < 0) {
        fromNode = targetNode;
        toNode = sourceNode;
      }

      const baseFromR = fromNode.kind === "home" ? homeRadius : fromNode.kind === "individual" ? individualRadius : nodeRadius;
      const baseToR = toNode.kind === "home" ? homeRadius : toNode.kind === "individual" ? individualRadius : nodeRadius;
      const chord = Math.hypot(
        toNode.position.x - fromNode.position.x,
        toNode.position.y - fromNode.position.y,
      ) || 0.001;
      /**
       * Endpoints sit on the chord at `baseFromR` / `baseToR` from each centre (toward the other node).
       * Capping each side with a small fraction of the chord (old behaviour) made long spans (1–2 sources)
       * use tiny trims so the stroke never reached the bubble outline. Only scale down when the sum would
       * exceed most of the chord (short diagonal / cramped layouts).
       */
      const maxSum = Math.max(chord * 0.92, 0.55);
      let fromRadius = baseFromR;
      let toRadius = baseToR;
      const sum = fromRadius + toRadius;
      if (sum > maxSum) {
        const scale = maxSum / sum;
        fromRadius *= scale;
        toRadius *= scale;
      }

      lineCandidates.push({
        id,
        fromNode,
        toNode,
        value,
        unit,
        magnitude,
        active,
        color: active ? color : neutralStyle.color,
        opacity: active ? 0.9 : neutralStyle.opacity,
        fromRadius,
        straight,
        toRadius,
      });
    };

    if (nodes.grid.entityId) {
      const value = Number.isFinite(flowValues.gridHome) ? flowValues.gridHome : nodes.grid.value;
      pushLine("grid", nodes.grid, home, value, nodes.grid.unit, nodes.grid.color, true, true);
    }
    if (nodes.solar.entityId) {
      const value = Number.isFinite(flowValues.solarHome) ? flowValues.solarHome : nodes.solar.value;
      pushLine("solar", nodes.solar, home, value, nodes.solar.unit, nodes.solar.color, true);
    }
    if (nodes.solar.entityId && nodes.grid.entityId && Number.isFinite(flowValues.solarGrid)) {
      pushLine("solar-grid", nodes.solar, nodes.grid, flowValues.solarGrid, nodes.solar.unit || nodes.grid.unit, nodes.solar.color, false);
    }
    if (nodes.battery.entityId) {
      const value = Number.isFinite(flowValues.batteryHome) ? flowValues.batteryHome : nodes.battery.value;
      pushLine("battery", nodes.battery, home, value, nodes.battery.unit, nodes.battery.color, true);
    }
    if (nodes.battery.entityId && nodes.grid.entityId && Number.isFinite(flowValues.batteryGrid) && flowValues.batteryGrid > 0.001) {
      pushLine("battery-grid", nodes.battery, nodes.grid, flowValues.batteryGrid, nodes.battery.unit || nodes.grid.unit, nodes.battery.color, false);
    }
    if (nodes.solar.entityId && nodes.battery.entityId && Number.isFinite(flowValues.solarBattery)) {
      pushLine("solar-battery", nodes.solar, nodes.battery, flowValues.solarBattery, nodes.solar.unit || nodes.battery.unit, nodes.battery.color, false, true);
    }
    if (nodes.grid.entityId && nodes.battery.entityId && Number.isFinite(flowValues.gridBattery) && flowValues.gridBattery > 0.001) {
      pushLine("grid-battery", nodes.grid, nodes.battery, flowValues.gridBattery, nodes.grid.unit || nodes.battery.unit, nodes.battery.color, false);
    }
    if (nodes.water.entityId) {
      pushLine("water", nodes.water, home, nodes.water.value, nodes.water.unit, nodes.water.color, false);
    }
    if (nodes.gas.entityId) {
      pushLine("gas", nodes.gas, home, nodes.gas.value, nodes.gas.unit, nodes.gas.color, false);
    }

    nodes.individual.forEach(node => {
      pushLine(node.id, home, node, node.value, node.unit, node.color, true);
    });

    /** Solar often shares the vertical with home; paint it last so it is not covered where paths cross. */
    const lineStackOrder = (id) => {
      if (id === "solar") {
        return 50;
      }
      if (id === "solar-grid") {
        return 48;
      }
      if (id === "gas") {
        return 40;
      }
      if (id === "water") {
        return 35;
      }
      if (id === "battery") {
        return 25;
      }
      if (id === "solar-battery" || id === "grid-battery" || id === "battery-grid") {
        return 30;
      }
      if (id === "grid") {
        return 15;
      }
      return 5;
    };
    lineCandidates.sort((left, right) => lineStackOrder(left.id) - lineStackOrder(right.id));

    const maxMagnitude = Math.max(
      ...lineCandidates.filter(item => item.active).map(item => item.magnitude),
      1,
    );

    return lineCandidates.map(line => {
      const pathHints = {};
      if (line.id === "solar" || line.id === "solar-grid") {
        pathHints.preferVerticalFirst = true;
      }
      /** Battery sits on the bottom spine: vertical-first for home↔battery; grid→battery uses horizontal-first (hub routing). */
      if (line.id === "battery" || line.id === "battery-grid") {
        pathHints.preferVerticalFirst = true;
      }
      const path = line.straight
        ? buildStraightFlowPath(line.fromNode.position, line.toNode.position, line.fromRadius, line.toRadius)
        : buildFlowPath(line.fromNode.position, line.toNode.position, line.fromRadius, line.toRadius, pathHints);
      return {
        ...line,
        path,
        duration: this._flowDuration(line.magnitude, maxMagnitude),
      };
    });
  }

  _getDominantColor(lines) {
    const active = [...lines]
      .filter(line => line.active)
      .sort((left, right) => right.magnitude - left.magnitude);

    return active[0]?.color || "#f6b73c";
  }

  _renderFlowDots(line, dotMetrics = {}) {
    if (!line.active) {
      return "";
    }

    const bubbleDuration = 5.6;
    const glowR = Number(dotMetrics.glowR) || 2.1;
    const coreR = Number(dotMetrics.coreR) || 1.08;
    const coreStroke = Number(dotMetrics.coreStroke) || 0.26;
    const viewAspect = Number(dotMetrics.viewAspect) > 0 ? Number(dotMetrics.viewAspect) : 1;
    /** With preserveAspectRatio none, user Y is squeezed vs X on wide surfaces; taller ry in viewBox renders round on screen. */
    const glowRy = glowR * viewAspect;
    const coreRy = coreR * viewAspect;
    const motionPhase = ((String(line.id || "").split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 19) / 19) * 0.92;
    const beginAttr = motionPhase > 0.02 ? ` begin="${motionPhase.toFixed(3)}s"` : "";
    const motionPath = getSvgRelativeMotionPath(line.path);
    const cx = motionPath.start.x.toFixed(3);
    const cy = motionPath.start.y.toFixed(3);
    const path = escapeHtml(motionPath.path);
    return `
      <g class="power-flow-card__dot-group" style="--dot-color:${escapeHtml(line.color)};">
        <ellipse class="power-flow-card__dot-glow" cx="${cx}" cy="${cy}" rx="${glowR.toFixed(3)}" ry="${glowRy.toFixed(3)}">
          <animateMotion dur="${bubbleDuration.toFixed(2)}s" repeatCount="indefinite" calcMode="linear" path="${path}"${beginAttr}></animateMotion>
        </ellipse>
        <ellipse class="power-flow-card__dot-core" cx="${cx}" cy="${cy}" rx="${coreR.toFixed(3)}" ry="${coreRy.toFixed(3)}" stroke-width="${coreStroke.toFixed(2)}">
          <animateMotion dur="${bubbleDuration.toFixed(2)}s" repeatCount="indefinite" calcMode="linear" path="${path}"${beginAttr}></animateMotion>
        </ellipse>
      </g>
    `;
  }

  _getNodeAnimationDelay(node, index = 0) {
    const delayByKind = {
      home: 110,
      grid: 150,
      solar: 185,
      battery: 215,
      water: 245,
      gas: 275,
      individual: 245,
    };

    const baseDelay = delayByKind[node?.kind] || 150;
    return node?.kind === "individual"
      ? baseDelay + (Math.max(0, Number(index) || 0) * 34)
      : baseDelay;
  }

  _renderNode(node, options = {}) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const iconSizes = styles.icon || DEFAULT_CONFIG.styles.icon;
    const layoutPreset = options.layoutPreset || "full";
    const animateEntrance = options.animateEntrance === true;
    const enterDelay = Math.max(0, Number(options.enterDelay) || 0);
    const nodeSize = node.kind === "home"
      ? Math.max(92, parseSizeToPixels(iconSizes.home_size, 96))
      : node.kind === "individual"
        ? Math.max(38, parseSizeToPixels(iconSizes.individual_size, 40))
        : Math.max(44, parseSizeToPixels(iconSizes.node_size, 48));
    const scaledNodeSize = Math.round(
      nodeSize * (
        layoutPreset === "simple"
          ? (node.kind === "home" ? 0.74 : 0.78)
        : layoutPreset === "compact"
            ? (node.kind === "home" ? 0.88 : 0.92)
            : 1
      )
    );
    const chipHeight = Math.max(22, parseSizeToPixels(styles.chip_height, 24));
    const chipFontSize = Math.max(11, parseSizeToPixels(styles.chip_font_size, 11));
    const chipPadding = styles.chip_padding || "0 10px";
    const secondarySize = Math.max(10, parseSizeToPixels(styles.secondary_size, 11));
    const isBottom = node.position.y >= 74;
    let infoClass;
    if (layoutPreset === "simple") {
      infoClass = node.kind === "home"
        ? "power-flow-card__node-info--home"
        : isBottom
          ? "power-flow-card__node-info--above"
          : "power-flow-card__node-info--below";
    } else if (node.kind === "home") {
      infoClass = "power-flow-card__node-info--home";
    } else if (node.kind === "solar" || node.kind === "gas") {
      infoClass = "power-flow-card__node-info--above";
    } else if (node.kind === "battery" || node.kind === "water" || node.kind === "individual" || node.kind === "grid") {
      infoClass = "power-flow-card__node-info--below";
    } else {
      infoClass = isBottom ? "power-flow-card__node-info--above" : "power-flow-card__node-info--below";
    }
    const color = node.color;
    const unavailableBadge = this._config?.show_unavailable_badge !== false && node.unavailable
      ? `<span class="power-flow-card__unavailable"><ha-icon icon="mdi:help"></ha-icon></span>`
      : "";
    const isClickable = this._config?.clickable_entities !== false && node.entityId;
    const nodeAction = this._getNodeInteractionAction(node);
    const nodeClassName = [
      "power-flow-card__node",
      `power-flow-card__node--${escapeHtml(node.kind)}`,
      animateEntrance ? "power-flow-card__node--entering" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const gridDirectionIcon = this._getGridDirectionIcon(node);
    const valueMarkup = this._config?.show_values === false
      ? ""
      : `
          <span class="power-flow-card__chip power-flow-card__chip--value" style="--chip-tint:${escapeHtml(color)};">
            ${gridDirectionIcon ? `<ha-icon class="power-flow-card__chip-direction" icon="${escapeHtml(gridDirectionIcon)}"></ha-icon>` : ""}
            <span>${escapeHtml(node.valueText)}</span>
            ${node.unitText ? `<span class="power-flow-card__chip-unit">${escapeHtml(node.unitText)}</span>` : ""}
          </span>
        `;

    const labelMarkup = this._config?.show_labels === false
      ? ""
      : `<span class="power-flow-card__chip power-flow-card__chip--label">${escapeHtml(node.label)}</span>`;

    const secondaryMarkup = node.secondary
      ? `<span class="power-flow-card__node-secondary">${escapeHtml(node.secondary)}</span>`
      : "";

    if (node.kind === "home") {
      const homeInteractive = nodeAction === "home-popup";
      return `
        <div
          class="${nodeClassName}${homeInteractive ? " power-flow-card__node--home-interactive" : ""}"
          style="left:${node.position.x}%; top:${node.position.y}%; --node-enter-delay:${enterDelay}ms;"
          ${homeInteractive ? 'data-node-action="home-popup" role="button" tabindex="0"' : ""}
        >
          <button
            type="button"
            class="power-flow-card__bubble power-flow-card__bubble--home ${isClickable ? "is-clickable" : ""}"
            data-node-entity="${escapeHtml(node.entityId)}"
            data-node-action="${escapeHtml(nodeAction)}"
            style="--node-size:${scaledNodeSize}px; --node-tint:${escapeHtml(color)}; --node-icon-glyph:${escapeHtml(this._getNodeIconGlyphColor(node))};"
            title="${escapeHtml(node.label)}"
          >
            ${unavailableBadge}
            <span class="power-flow-card__home-icon-wrap">
              <ha-icon icon="${escapeHtml(node.icon)}"></ha-icon>
            </span>
            ${
              this._config?.show_values === false
                ? ""
                : `
                  <span class="power-flow-card__home-value">
                    <span class="power-flow-card__home-value-number">${escapeHtml(node.valueText)}</span>
                    ${node.unitText ? `<span class="power-flow-card__home-value-unit">${escapeHtml(node.unitText)}</span>` : ""}
                  </span>
                `
            }
          </button>
          <div class="power-flow-card__node-info ${infoClass}">
            ${labelMarkup}
            ${secondaryMarkup}
          </div>
        </div>
      `;
    }

    return `
      <div class="${nodeClassName}" style="left:${node.position.x}%; top:${node.position.y}%; --chip-height:${chipHeight}px; --chip-font-size:${chipFontSize}px; --chip-padding:${escapeHtml(chipPadding)}; --secondary-size:${secondarySize}px; --node-enter-delay:${enterDelay}ms;">
        <button
          class="power-flow-card__bubble ${node.kind === "individual" ? "power-flow-card__bubble--individual" : ""} ${isClickable ? "is-clickable" : ""}"
          data-node-entity="${escapeHtml(node.entityId)}"
          data-node-action="${isClickable ? "more-info" : ""}"
          style="--node-size:${scaledNodeSize}px; --node-tint:${escapeHtml(color)}; --node-icon-glyph:${escapeHtml(this._getNodeIconGlyphColor(node))};"
          title="${escapeHtml(node.label)}"
        >
          ${unavailableBadge}
          <ha-icon icon="${escapeHtml(node.icon)}"></ha-icon>
        </button>
        <div class="power-flow-card__node-info ${infoClass}">
          ${labelMarkup}
          ${valueMarkup}
          ${secondaryMarkup}
        </div>
      </div>
    `;
  }

  _getSimpleSourceNode(nodes) {
    return [
      nodes.grid,
      nodes.solar,
      nodes.battery,
      ...nodes.individual,
    ].find(node => node?.entityId) || nodes.home;
  }

  _renderSimpleLabelChip(node) {
    if (this._config?.show_labels === false) {
      return "";
    }

    return `<span class="power-flow-card__chip power-flow-card__chip--label">${escapeHtml(node.label)}</span>`;
  }

  _renderSimpleValueChip(node) {
    if (this._config?.show_values === false) {
      return "";
    }
    const gridDirectionIcon = this._getGridDirectionIcon(node);

    return `
      <span class="power-flow-card__chip power-flow-card__chip--value" style="--chip-tint:${escapeHtml(node.color)};">
        ${gridDirectionIcon ? `<ha-icon class="power-flow-card__chip-direction" icon="${escapeHtml(gridDirectionIcon)}"></ha-icon>` : ""}
        <span>${escapeHtml(node.valueText)}</span>
        ${node.unitText ? `<span class="power-flow-card__chip-unit">${escapeHtml(node.unitText)}</span>` : ""}
      </span>
    `;
  }

  _getGridDirectionIcon(node) {
    if (node?.kind !== "grid" || !Number.isFinite(Number(node.value)) || Math.abs(Number(node.value)) <= 0.001) {
      return "";
    }
    return node.isExporting || Number(node.value) < -0.001
      ? "mdi:transmission-tower-import"
      : "mdi:transmission-tower-export";
  }

  _shouldUseHomeDevicePopup() {
    return isHomeDevicePopupEnabled(this._config) && resolveIndividualConfigs(this._config).length > 0;
  }

  _shouldShowIndividualsOnDiagram() {
    return resolveIndividualConfigs(this._config).length > 0 && !isHomeDevicePopupEnabled(this._config);
  }

  _syncHomePopupHostState() {
    this.toggleAttribute("data-home-popup-open", this._homePopupOpen === true);
  }

  _getNodeInteractionAction(node) {
    if (node.kind === "home" && this._shouldUseHomeDevicePopup()) {
      return "home-popup";
    }
    if (this._config?.clickable_entities === false || !node?.entityId) {
      return "";
    }
    return "more-info";
  }

  _onHomePopupKeydown(event) {
    if (!this._homePopupOpen || event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    this._closeHomeDevicePopup();
  }

  _openHomeDevicePopup() {
    if (!this._shouldUseHomeDevicePopup()) {
      return;
    }
    this._homePopupOpen = true;
    this._syncHomePopupHostState();
    this._lastRenderSignature = "";
    this._render();
  }

  _closeHomeDevicePopup() {
    if (!this._homePopupOpen) {
      return;
    }
    this._homePopupOpen = false;
    this._syncHomePopupHostState();
    this._lastRenderSignature = "";
    this._render();
  }

  _formatConsumptionChipValue(value, unit = "") {
    const numeric = Number(value);
    const locale = this._getLocaleTag();
    if (!Number.isFinite(numeric)) {
      return { value: "--", unit: unit || "" };
    }

    const unitKey = normalizeTextKey(unit);
    if (["kwh", "mwh"].includes(unitKey)) {
      const decimals = Math.abs(numeric) >= 100 ? 0 : Math.abs(numeric) >= 10 ? 1 : 2;
      return {
        value: formatRawValue(numeric, decimals, locale),
        unit: unit || "kWh",
      };
    }
    if (["wh", "watt", "watts"].includes(unitKey) && Math.abs(numeric) >= 1000) {
      return {
        value: formatRawValue(numeric / 1000, Math.abs(numeric) >= 10000 ? 0 : 1, locale),
        unit: "kWh",
      };
    }

    return formatDisplayValue(numeric, unit, locale);
  }

  _resolveConsumptionChip(period) {
    const chips = this._config?.consumption_chips || {};
    const entityId = String(chips[`${period}_entity`] || "").trim();
    if (!entityId) {
      return null;
    }

    const state = this._hass?.states?.[entityId];
    const unavailable = !state || isUnavailableState(state);
    const unit = String(
      state?.attributes?.unit_of_measurement
      || state?.attributes?.native_unit_of_measurement
      || "",
    ).trim();
    const parsed = parseNumber(state?.state);
    const display = this._formatConsumptionChipValue(parsed, unit);
    const defaultLabel = period === "day"
      ? this._powerFlowUi("today", "Today")
      : this._powerFlowUi("month", "Month");
    const label = String(chips[`${period}_label`] || "").trim() || defaultLabel;
    const icon = period === "day" ? "mdi:calendar-today" : "mdi:calendar-month";

    return {
      period,
      entityId,
      label,
      icon,
      unavailable,
      valueText: display.value,
      unitText: display.unit,
      clickable: this._config?.clickable_entities !== false,
    };
  }

  _renderConsumptionChips() {
    const chips = ["day", "month"]
      .map(period => this._resolveConsumptionChip(period))
      .filter(Boolean);

    if (!chips.length) {
      return "";
    }

    return `
      <div class="power-flow-card__status-chips" role="group" aria-label="${escapeHtml(this._powerFlowUi("consumptionTotals", "Consumption totals"))}">
        ${chips.map(chip => `
          <span
            class="power-flow-card__chip power-flow-card__chip--stat ${chip.clickable ? "is-clickable" : ""}"
            ${chip.clickable ? `data-node-entity="${escapeHtml(chip.entityId)}" data-node-action="more-info"` : ""}
            title="${escapeHtml(chip.label)}"
          >
            <ha-icon icon="${escapeHtml(chip.icon)}"></ha-icon>
            <span class="power-flow-card__chip-stat-label">${escapeHtml(chip.label)}</span>
            <span class="power-flow-card__chip-stat-value">${escapeHtml(chip.unavailable ? "--" : chip.valueText)}</span>
            ${chip.unitText && !chip.unavailable ? `<span class="power-flow-card__chip-unit">${escapeHtml(chip.unitText)}</span>` : ""}
          </span>
        `).join("")}
      </div>
    `;
  }

  _renderHomePopupDeviceRow(node, options = {}) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const iconStyles = styles.icon || DEFAULT_CONFIG.styles.icon;
    const deviceSize = Math.round(Math.max(38, parseSizeToPixels(iconStyles.individual_size, 40)));
    const chipHeight = Math.max(22, parseSizeToPixels(styles.chip_height, 24));
    const chipFontSize = Math.max(11, parseSizeToPixels(styles.chip_font_size, 11));
    const chipPadding = styles.chip_padding || "0 10px";
    const secondarySize = Math.max(10, parseSizeToPixels(styles.secondary_size, 11));
    const deviceClickable = this._config?.clickable_entities !== false && node.entityId;
    const unavailableBadge = this._config?.show_unavailable_badge !== false && node.unavailable
      ? `<span class="power-flow-card__unavailable"><ha-icon icon="mdi:help"></ha-icon></span>`
      : "";
    const labelMarkup = this._config?.show_labels === false
      ? ""
      : `<span class="power-flow-card__home-popup-device-name">${escapeHtml(node.label)}</span>`;
    const valueMarkup = this._config?.show_values === false || node.unavailable
      ? (node.unavailable ? `<span class="power-flow-card__chip power-flow-card__chip--value" style="--chip-tint:${escapeHtml(node.color)};"><span>--</span></span>` : "")
      : `
          <span class="power-flow-card__chip power-flow-card__chip--value" style="--chip-tint:${escapeHtml(node.color)};">
            <span>${escapeHtml(node.valueText)}</span>
            ${node.unitText ? `<span class="power-flow-card__chip-unit">${escapeHtml(node.unitText)}</span>` : ""}
          </span>
        `;
    const secondaryMarkup = node.secondary
      ? `<span class="power-flow-card__node-secondary">${escapeHtml(node.secondary)}</span>`
      : "";

    return `
      <div
        class="power-flow-card__home-popup-node power-flow-card__home-popup-node--entering"
        role="listitem"
        style="--chip-height:${chipHeight}px; --chip-font-size:${chipFontSize}px; --chip-padding:${escapeHtml(chipPadding)}; --secondary-size:${secondarySize}px; --device-enter-delay:${options.enterDelay || 0}ms;"
      >
        <button
          type="button"
          class="power-flow-card__bubble power-flow-card__bubble--individual ${deviceClickable ? "is-clickable" : ""}"
          data-node-entity="${escapeHtml(node.entityId)}"
          data-node-action="${deviceClickable ? "more-info" : ""}"
          style="--node-size:${deviceSize}px; --node-tint:${escapeHtml(node.color)}; --node-icon-glyph:${escapeHtml(this._getNodeIconGlyphColor(node))};"
          title="${escapeHtml(node.label)}"
        >
          ${unavailableBadge}
          <ha-icon icon="${escapeHtml(node.icon)}"></ha-icon>
        </button>
        <div class="power-flow-card__node-info power-flow-card__node-info--popup">
          ${labelMarkup}
          ${valueMarkup}
          ${secondaryMarkup}
        </div>
      </div>
    `;
  }

  _renderHomeDevicePopup(nodes) {
    if (!this._homePopupOpen) {
      return "";
    }

    const flowFlags = getFlowLayoutFlagsFromConfig(this._config);
    const bottomUtilities = flowFlags.bottomUtilities;
    const hasBottom = bottomUtilities > 0;
    const individualConfigs = resolveIndividualConfigs(this._config);
    if (!individualConfigs.length) {
      return "";
    }

    const popupIndividuals = individualConfigs.map((config, index) =>
      this._resolveNodeDescriptor("individual", config, index, individualConfigs.length, hasBottom, flowFlags),
    );

    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const home = nodes.home;
    const homeClickable = this._config?.clickable_entities !== false && home.entityId;
    const homeUnavailableBadge = this._config?.show_unavailable_badge !== false && home.unavailable
      ? `<span class="power-flow-card__unavailable"><ha-icon icon="mdi:help"></ha-icon></span>`
      : "";
    const maxMagnitude = Math.max(
      1,
      this._toFlowMagnitude(home.value, home.unit),
      ...popupIndividuals.map(node => this._toFlowMagnitude(node.value, node.unit)),
    );
    const deviceCountLabel = `${popupIndividuals.length} ${this._powerFlowUi(popupIndividuals.length === 1 ? "device" : "devices", popupIndividuals.length === 1 ? "device" : "devices")}`;
    const closeLabel = this._powerFlowUi("close", "Close");
    const moreInfoLabel = this._powerFlowUi("moreInfo", "More info");
    const consumptionChips = this._renderConsumptionChips();
    const homeSummaryValue = this._config?.show_values === false
      ? ""
      : `${home.valueText}${home.unitText ? ` ${home.unitText}` : ""}`.trim();
    const animations = this._getAnimationSettings();

    const homeSummarySize = Math.round(Math.max(92, parseSizeToPixels(styles.icon?.home_size, 96)));
    const homeSummaryLabel = this._config?.show_labels === false
      ? ""
      : `<span class="power-flow-card__chip power-flow-card__chip--label">${escapeHtml(home.label)}</span>`;

    return `
      <div
        class="power-flow-card__home-popup is-open"
        data-home-popup
        style="--home-popup-accent:${escapeHtml(home.color)};"
        aria-hidden="false"
      >
        <button type="button" class="power-flow-card__home-popup-backdrop" data-home-popup-action="close" aria-label="${escapeHtml(closeLabel)}"></button>
        <div
          class="power-flow-card__home-popup-panel ${animations.enabled ? "power-flow-card__home-popup-panel--entrance" : ""}"
          role="dialog"
          aria-modal="true"
          aria-label="${escapeHtml(home.label)}"
        >
          <div class="power-flow-card__home-popup-header">
            <div class="power-flow-card__home-popup-heading">
              <div class="power-flow-card__home-popup-title">${escapeHtml(home.label)}</div>
              <div class="power-flow-card__home-popup-subtitle">${escapeHtml(deviceCountLabel)}</div>
            </div>
            <div class="power-flow-card__home-popup-actions">
              ${
                homeClickable
                  ? `
                    <button
                      type="button"
                      class="power-flow-card__home-popup-icon-button"
                      data-node-entity="${escapeHtml(home.entityId)}"
                      data-node-action="more-info"
                      title="${escapeHtml(moreInfoLabel)}"
                    >
                      <ha-icon icon="mdi:information-outline"></ha-icon>
                    </button>
                  `
                  : ""
              }
              <button type="button" class="power-flow-card__home-popup-icon-button" data-home-popup-action="close" title="${escapeHtml(closeLabel)}">
                <ha-icon icon="mdi:close"></ha-icon>
              </button>
            </div>
          </div>
          <div class="power-flow-card__home-popup-body">
            ${consumptionChips ? `<div class="power-flow-card__home-popup-chips">${consumptionChips}</div>` : ""}
            <div class="power-flow-card__home-popup-summary">
              <button
                type="button"
                class="power-flow-card__bubble power-flow-card__bubble--home ${homeClickable ? "is-clickable" : ""}"
                data-node-entity="${escapeHtml(home.entityId)}"
                data-node-action="${homeClickable ? "more-info" : ""}"
                style="--node-size:${homeSummarySize}px; --node-tint:${escapeHtml(home.color)}; --node-icon-glyph:${escapeHtml(this._getNodeIconGlyphColor(home))};"
                title="${escapeHtml(home.label)}"
              >
                ${homeUnavailableBadge}
                <span class="power-flow-card__home-icon-wrap">
                  <ha-icon icon="${escapeHtml(home.icon)}"></ha-icon>
                </span>
                ${
                  homeSummaryValue
                    ? `
                      <span class="power-flow-card__home-value">
                        <span class="power-flow-card__home-value-number">${escapeHtml(home.valueText)}</span>
                        ${home.unitText ? `<span class="power-flow-card__home-value-unit">${escapeHtml(home.unitText)}</span>` : ""}
                      </span>
                    `
                    : ""
                }
              </button>
              ${homeSummaryLabel}
            </div>
            <div class="power-flow-card__home-popup-list" role="list">
              ${popupIndividuals.map((node, index) => this._renderHomePopupDeviceRow(node, {
                maxMagnitude,
                enterDelay: 40 + (index * 36),
              })).join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderSimpleLayout(nodes, lines, options = {}) {
    const animateEntrance = options.animateEntrance === true;
    const sourceNode = this._getSimpleSourceNode(nodes);
    const flowLine = lines.find(line => line.id === sourceNode.id || line.fromNode?.id === sourceNode.id || line.toNode?.id === sourceNode.id) || null;
    const lineColor = flowLine?.color || sourceNode.color || "#6da8ff";
    const lineOpacity = flowLine?.active ? 0.92 : (this._shouldShowZeroLines() ? this._getLineNeutralStyle().opacity : 0);
    const lineBackground = flowLine?.active
      ? `color-mix(in srgb, ${lineColor} 24%, rgba(255,255,255,0.12))`
      : this._getLineNeutralStyle().color;
    const bubbleDuration = Math.max(3.6, Number(flowLine?.duration || 4.8));
    const homeSize = Math.round(Math.max(92, parseSizeToPixels(this._config?.styles?.icon?.home_size, 96)) * 0.72);
    const nodeSize = Math.round(Math.max(44, parseSizeToPixels(this._config?.styles?.icon?.node_size, 48)) * 0.8);
    const lineStartOffset = Math.max(18, Math.round(nodeSize * 0.42));
    const lineEndOffset = Math.max(30, Math.round(homeSize * 0.38));
    const sourceClickable = this._config?.clickable_entities !== false && sourceNode.entityId;
    const homeClickable = this._config?.clickable_entities !== false && nodes.home.entityId;
    const homePopupAction = this._getNodeInteractionAction(nodes.home);
    const sourceUnavailableBadge = this._config?.show_unavailable_badge !== false && sourceNode.unavailable
      ? `<span class="power-flow-card__unavailable"><ha-icon icon="mdi:help"></ha-icon></span>`
      : "";
    const homeUnavailableBadge = this._config?.show_unavailable_badge !== false && nodes.home.unavailable
      ? `<span class="power-flow-card__unavailable"><ha-icon icon="mdi:help"></ha-icon></span>`
      : "";
    const showDashboardButton = this._config?.show_dashboard_link_button !== false && Boolean(this._config?.dashboard_link);
    const dashboardLabel = this._config?.dashboard_link_label && this._config.dashboard_link_label !== DEFAULT_CONFIG.dashboard_link_label
      ? this._config.dashboard_link_label
      : this._powerFlowUi("energy", "Energy");

    return `
      <div class="power-flow-card__simple-layout ${showDashboardButton ? "has-footer" : ""} ${animateEntrance ? "power-flow-card__simple-layout--entering" : ""}">
        <div
          class="power-flow-card__simple-top ${animateEntrance ? "power-flow-card__simple-top--entering" : ""}"
          style="--simple-source-column:${nodeSize}px; --simple-home-column:${homeSize}px;"
        >
          <div class="power-flow-card__simple-column power-flow-card__simple-column--source-top">
            ${this._renderSimpleLabelChip(sourceNode)}
          </div>
          <div></div>
          <div class="power-flow-card__simple-column power-flow-card__simple-column--home power-flow-card__simple-column--home-top">
            ${this._renderSimpleLabelChip(nodes.home)}
          </div>
        </div>

        <div
          class="power-flow-card__simple-rail ${animateEntrance ? "power-flow-card__simple-rail--entering" : ""}"
          style="--simple-rail-height:${Math.max(nodeSize, homeSize)}px; --simple-source-column:${nodeSize}px; --simple-home-column:${homeSize}px;"
        >
          <div
            class="power-flow-card__simple-line-wrap"
            style="--line-start-offset:${lineStartOffset}px; --line-end-offset:${lineEndOffset}px;"
          >
            <div
              class="power-flow-card__simple-line ${flowLine?.active ? "is-active" : ""}"
              style="--line-color:${escapeHtml(lineColor)}; --line-opacity:${lineOpacity}; --line-background:${escapeHtml(lineBackground)};"
            >
              ${flowLine?.active ? `
                <span class="power-flow-card__simple-dot" style="animation-duration:${bubbleDuration.toFixed(2)}s;"></span>
              ` : ""}
            </div>
          </div>

          <div class="power-flow-card__simple-rail-node power-flow-card__simple-rail-node--source" style="--simple-node-cover-size:${nodeSize}px;">
            <button
              class="power-flow-card__bubble ${sourceClickable ? "is-clickable" : ""}"
              data-node-entity="${escapeHtml(sourceNode.entityId)}"
              data-node-action="${sourceClickable ? "more-info" : ""}"
              style="--node-size:${nodeSize}px; --node-tint:${escapeHtml(sourceNode.color)}; --node-icon-glyph:${escapeHtml(this._getNodeIconGlyphColor(sourceNode))};"
              title="${escapeHtml(sourceNode.label)}"
            >
              ${sourceUnavailableBadge}
              <ha-icon icon="${escapeHtml(sourceNode.icon)}"></ha-icon>
            </button>
          </div>

          <div class="power-flow-card__simple-rail-spacer"></div>

          <div class="power-flow-card__simple-rail-node power-flow-card__simple-rail-node--home" style="--simple-node-cover-size:${homeSize}px;">
            <button
              class="power-flow-card__bubble power-flow-card__bubble--home ${homeClickable ? "is-clickable" : ""}"
              data-node-entity="${escapeHtml(nodes.home.entityId)}"
              data-node-action="${escapeHtml(homePopupAction)}"
              style="--node-size:${homeSize}px; --node-tint:${escapeHtml(nodes.home.color)}; --node-icon-glyph:${escapeHtml(this._getNodeIconGlyphColor(nodes.home))};"
              title="${escapeHtml(nodes.home.label)}"
            >
              ${homeUnavailableBadge}
              <span class="power-flow-card__home-icon-wrap">
                <ha-icon icon="${escapeHtml(nodes.home.icon)}"></ha-icon>
              </span>
              ${
                this._config?.show_values === false
                  ? ""
                  : `
                    <span class="power-flow-card__home-value">
                      <span class="power-flow-card__home-value-number">${escapeHtml(nodes.home.valueText)}</span>
                      ${nodes.home.unitText ? `<span class="power-flow-card__home-value-unit">${escapeHtml(nodes.home.unitText)}</span>` : ""}
                    </span>
                  `
              }
            </button>
          </div>
        </div>

        <div
          class="power-flow-card__simple-bottom ${animateEntrance ? "power-flow-card__simple-bottom--entering" : ""}"
          style="--simple-source-column:${nodeSize}px; --simple-home-column:${homeSize}px;"
        >
          <div class="power-flow-card__simple-column power-flow-card__simple-column--source power-flow-card__simple-column--source-bottom">
            ${this._renderSimpleValueChip(sourceNode)}
            ${sourceNode.secondary ? `<span class="power-flow-card__node-secondary">${escapeHtml(sourceNode.secondary)}</span>` : ""}
          </div>
          <div></div>
          <div></div>
        </div>

        ${
          showDashboardButton
            ? `
              <div class="power-flow-card__simple-footer ${animateEntrance ? "power-flow-card__simple-footer--entering" : ""}">
                <button class="power-flow-card__dashboard-button power-flow-card__dashboard-button--footer" data-dashboard-action="navigate" title="${escapeHtml(dashboardLabel)}">
                  <ha-icon icon="mdi:lightning-bolt-circle"></ha-icon>
                  <span>${escapeHtml(dashboardLabel)}</span>
                </button>
              </div>
            `
            : ""
        }
      </div>
    `;
  }

  _onShadowClick(event) {
    const homePopupClose = event.composedPath().find(
      node => node instanceof HTMLElement && node.dataset?.homePopupAction === "close",
    );
    if (homePopupClose) {
      event.preventDefault();
      event.stopPropagation();
      this._closeHomeDevicePopup();
      return;
    }

    const dashboardButton = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.dashboardAction === "navigate");
    if (dashboardButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerPressAnimation(dashboardButton);
      this._triggerHaptic("selection");
      this._navigate(this._config?.dashboard_link);
      return;
    }

    const homePopupButton = event.composedPath().find(
      node => node instanceof HTMLElement && node.dataset?.nodeAction === "home-popup",
    );
    if (homePopupButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerPressAnimation(homePopupButton);
      this._triggerHaptic("selection");
      this._openHomeDevicePopup();
      return;
    }

    const nodeAction = event.composedPath().find(
      node => node instanceof HTMLElement && (node.dataset?.nodeAction === "more-info"),
    );
    if (nodeAction && nodeAction.dataset?.nodeEntity) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerPressAnimation(nodeAction);
      this._triggerHaptic("selection");
      fireEvent(this, "hass-more-info", {
        entityId: nodeAction.dataset.nodeEntity,
      });
      return;
    }

    if ((this._config?.tap_action || "none") === "more-info" && this._config?.entities?.home?.entity) {
      const content = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.cardAction === "primary");
      if (content) {
        event.preventDefault();
        event.stopPropagation();
        this._triggerPressAnimation(this.shadowRoot.querySelector(".power-flow-card__content"));
        this._triggerHaptic("selection");
        fireEvent(this, "hass-more-info", {
          entityId: this._config.entities.home.entity,
        });
      }
    }
  }

  _onShadowKeyDown(event) {
    if (window.NodaliaUtils?.isKeyboardActivationEvent?.(event) !== true) {
      return;
    }
    this._onShadowClick(event);
  }

  _getTitle() {
    return this._config?.title || this._config?.name || "Flujo";
  }

  _collectPowerFlowEntityIds() {
    const nodes = this._getNodes();
    const ids = [];
    const push = (id) => {
      const value = String(id ?? "").trim();
      if (value && !ids.includes(value)) {
        ids.push(value);
      }
    };
    push(nodes?.grid?.entityId);
    push(nodes?.solar?.entityId);
    push(nodes?.battery?.entityId);
    push(nodes?.home?.entityId);
    push(nodes?.water?.entityId);
    push(nodes?.gas?.entityId);
    if (Array.isArray(nodes?.individual)) {
      for (const item of nodes.individual) {
        push(item?.entityId);
      }
    }
    return ids;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const powerFlowEntityIds = this._collectPowerFlowEntityIds();
    if (powerFlowEntityIds.length) {
      const powerFlowGuard = window.NodaliaUtils?.renderLovelaceEntityGuardForEntities?.(
        this._hass,
        powerFlowEntityIds,
        { cardClass: "power-flow-card" },
      );
      if (powerFlowGuard) {
        this.shadowRoot.innerHTML = powerFlowGuard;
        return;
      }
    }

    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const nodes = this._getNodes();
    const lines = this._buildLines(nodes);
    const dominantColor = this._getDominantColor(lines);
    const flowWidth = Math.max(1, parseSizeToPixels(styles.flow_width, 1.2));
    const diagramIndividualCount = getDiagramIndividualCount(this._config);
    const showIndividualsOnDiagram = this._shouldShowIndividualsOnDiagram();
    const hasLowerNodes = Boolean(nodes.water.entityId || nodes.gas.entityId || diagramIndividualCount > 0);
    const layoutPreset = nodes._layoutPreset || "full";
    const flowFlags = nodes._flowFlags || getFlowLayoutFlagsFromConfig(this._config);
    const flowDotBoost = 1 + Math.max(0, flowWidth - 1) * 0.065;
    const flowDotGlowR = 2.1 * flowDotBoost;
    const flowDotCoreR = 1.12 * flowDotBoost;
    const flowDotCoreStroke = 0.26;
    const surfaceLayoutExtras = (() => {
      let add = 0;
      if (layoutPreset !== "simple") {
        add += Math.min(Math.max(0, flowFlags.individualCount - 1), 5) * 22;
      }
      return add;
    })();
    const topEnergyConfigured = [nodes.grid.entityId, nodes.solar.entityId, nodes.battery.entityId].filter(Boolean).length;
    const minimalFlowDiagram = layoutPreset !== "simple" && topEnergyConfigured <= 1 && !hasLowerNodes;
    const stripOnlyGridHome =
      layoutPreset !== "simple"
      && Boolean(nodes.grid.entityId && nodes.home.entityId)
      && !nodes.solar.entityId
      && !nodes.battery.entityId
      && !hasLowerNodes
      && diagramIndividualCount === 0;
    const upperBandHubOnly =
      layoutPreset !== "simple"
      && Boolean(nodes.solar.entityId && nodes.grid.entityId && nodes.home.entityId)
      && !nodes.battery.entityId
      && !hasLowerNodes;
    const baseSurfaceDiagram = (() => {
      if (layoutPreset === "simple") {
        return 162;
      }
      if (stripOnlyGridHome) {
        return layoutPreset === "compact" ? 132 : 146;
      }
      if (upperBandHubOnly) {
        return layoutPreset === "compact" ? 188 : 202;
      }
      if (minimalFlowDiagram) {
        return layoutPreset === "compact" ? 200 : 222;
      }
      return layoutPreset === "compact" ? (hasLowerNodes ? 306 : 264) : (hasLowerNodes ? 336 : 286);
    })();
    const surfaceFloor = (() => {
      if (layoutPreset === "simple") {
        return 148;
      }
      if (stripOnlyGridHome) {
        return layoutPreset === "compact" ? 122 : 128;
      }
      if (upperBandHubOnly) {
        return layoutPreset === "compact" ? 152 : 160;
      }
      if (minimalFlowDiagram) {
        return layoutPreset === "compact" ? 158 : 168;
      }
      return 236;
    })();
    const surfaceMinHeight = Math.min(
      Math.max(
        (layoutPreset === "simple" ? 162 : baseSurfaceDiagram) + surfaceLayoutExtras,
        surfaceFloor,
      ),
      540,
    );
    const baseSurfaceMobile = (() => {
      if (layoutPreset === "simple") {
        return 144;
      }
      if (stripOnlyGridHome) {
        return layoutPreset === "compact" ? 126 : 136;
      }
      if (upperBandHubOnly) {
        return layoutPreset === "compact" ? 172 : 184;
      }
      if (minimalFlowDiagram) {
        return layoutPreset === "compact" ? 186 : 200;
      }
      return hasLowerNodes ? 308 : 268;
    })();
    const surfaceMinHeightMobile = Math.min(
      Math.max(
        baseSurfaceMobile + surfaceLayoutExtras,
        layoutPreset === "simple"
          ? 132
          : stripOnlyGridHome
            ? (layoutPreset === "compact" ? 118 : 124)
            : upperBandHubOnly
              ? (layoutPreset === "compact" ? 146 : 152)
              : minimalFlowDiagram
              ? (layoutPreset === "compact" ? 150 : 158)
              : 236,
      ),
      520,
    );
    const surfaceAspectCss = upperBandHubOnly
      ? (layoutPreset === "compact" ? "1 / 0.64" : "1 / 0.58")
      : stripOnlyGridHome
        ? (layoutPreset === "compact" ? "1 / 0.40" : "1 / 0.36")
        : "1 / 1.04";
    const flowDotViewAspect = (() => {
      const m = String(surfaceAspectCss).trim().match(/^([\d.]+)\s*\/\s*([\d.]+)/);
      if (!m) {
        return 1;
      }
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a > 0 && b > 0) {
        return a / b;
      }
      return 1;
    })();
    const flowDotOpts = {
      glowR: flowDotGlowR,
      coreR: flowDotCoreR,
      coreStroke: flowDotCoreStroke,
      viewAspect: flowDotViewAspect,
    };
    const showDashboardButton = this._config?.show_dashboard_link_button !== false && Boolean(this._config?.dashboard_link);
    const titleText = this._config?.title || this._config?.name || (layoutPreset === "simple" ? "" : "Flujo");
    const consumptionChipsMarkup = this._renderConsumptionChips();
    const hasHeader = this._config?.show_header !== false && (
      Boolean(titleText)
      || Boolean(consumptionChipsMarkup)
      || (showDashboardButton && layoutPreset !== "simple")
    );
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --power-flow-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          --power-flow-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          display: block;
          height: auto;
          min-height: 0;
          position: relative;
        }

        :host([data-home-popup-open]) {
          z-index: 120;
        }

        :host([data-home-popup-open]) ha-card {
          overflow: hidden;
        }

        * {
          box-sizing: border-box;
        }

        [data-card-action="primary"]:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: -3px;
        }

        ha-card {
          background-color: var(--ha-card-background, var(--card-background-color, #fff));
          border-radius: ${styles.card.border_radius};
          height: auto;
          isolation: isolate;
          min-height: 0;
          overflow: hidden;
          position: relative;
        }

        ha-card::before {
          background: color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 95%, transparent);
          border-radius: inherit;
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .power-flow-card {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${dominantColor} 12%, transparent) 0%, transparent 42%),
            linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(0,0,0,0.03) 100%),
            ${styles.card.background};
          border: 1px solid color-mix(in srgb, ${dominantColor} 18%, var(--divider-color));
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow}, 0 14px 28px color-mix(in srgb, ${dominantColor} 7%, rgba(0,0,0,0.14));
          color: var(--primary-text-color);
          display: flex;
          flex-direction: column;
          gap: ${styles.card.gap};
          height: auto;
          isolation: isolate;
          min-height: 0;
          overflow: hidden;
          padding: ${styles.card.padding};
          position: relative;
          transform-origin: center;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 160ms ease;
        }

        .power-flow-card__header {
          display: grid;
          gap: 8px;
          isolation: isolate;
          position: relative;
          z-index: 4;
        }

        .power-flow-card__header-main {
          align-items: center;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .power-flow-card__status-chips,
        .power-flow-card__home-popup-chips .power-flow-card__status-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .power-flow-card__chip--stat {
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--primary-color) 12%, transparent) 0%,
            color-mix(in srgb, var(--primary-text-color) 5%, transparent) 100%
          );
          border-color: color-mix(in srgb, var(--primary-color) 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          gap: 6px;
          min-height: calc(var(--chip-height, 22px) + 2px);
          padding-inline: 10px;
        }

        .power-flow-card__chip--stat.is-clickable {
          cursor: pointer;
        }

        .power-flow-card__chip--stat ha-icon {
          --mdc-icon-size: calc(var(--chip-font-size, 10px) + 4px);
          color: var(--primary-color);
          flex: 0 0 auto;
        }

        .power-flow-card__chip-stat-label {
          color: var(--secondary-text-color);
          font-weight: 600;
        }

        .power-flow-card__chip-stat-value {
          font-variant-numeric: tabular-nums;
          font-weight: 800;
        }

        .power-flow-card__node--home-interactive {
          cursor: pointer;
        }

        .power-flow-card__home-popup {
          inset: 0;
          opacity: 0;
          pointer-events: none;
          position: fixed;
          transition: opacity 220ms cubic-bezier(0.16, 0.84, 0.22, 1);
          z-index: 120;
        }

        .power-flow-card__home-popup.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        .power-flow-card__home-popup-backdrop {
          -webkit-backdrop-filter: blur(12px);
          backdrop-filter: blur(12px);
          background: rgba(0, 0, 0, 0.32);
          border: 0;
          cursor: pointer;
          inset: 0;
          margin: 0;
          padding: 0;
          position: absolute;
        }

        .power-flow-card__home-popup-panel {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--home-popup-accent) 12%, transparent) 0%, transparent 42%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.018) 0%, rgba(0, 0, 0, 0.03) 100%),
            ${styles.card.background};
          border: 1px solid color-mix(in srgb, var(--home-popup-accent) 18%, var(--divider-color));
          border-radius: 16px;
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28);
          color: var(--primary-text-color);
          display: grid;
          gap: 10px;
          grid-template-rows: auto minmax(0, 1fr);
          isolation: isolate;
          left: 50%;
          max-height: min(88vh, 780px);
          max-width: min(calc(100vw - 24px), 640px);
          overflow: hidden;
          padding: 14px;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: min(calc(100vw - 24px), 640px);
          z-index: 1;
        }

        .power-flow-card__home-popup-panel--entrance {
          animation: power-flow-card-home-popup-in calc(var(--power-flow-card-content-duration) * 0.55) cubic-bezier(0.16, 0.84, 0.22, 1) both;
        }

        @keyframes power-flow-card-home-popup-in {
          0% {
            opacity: 0;
            transform: translate(-50%, -48%) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        .power-flow-card__home-popup-header {
          align-items: flex-start;
          display: flex;
          flex: 0 0 auto;
          gap: 10px;
          justify-content: space-between;
          padding-bottom: 4px;
        }

        .power-flow-card__home-popup-title {
          font-size: calc(${Math.max(14, parseSizeToPixels(styles.title_size, 16))}px + 1px);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.15;
        }

        .power-flow-card__home-popup-subtitle {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 600;
          margin-top: 4px;
        }

        .power-flow-card__home-popup-actions {
          display: inline-flex;
          flex: 0 0 auto;
          gap: 6px;
        }

        .power-flow-card__home-popup-icon-button {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: 34px;
          justify-content: center;
          width: 34px;
        }

        .power-flow-card__home-popup-icon-button ha-icon {
          --mdc-icon-size: 18px;
        }

        .power-flow-card__home-popup-chips {
          min-width: 0;
        }

        .power-flow-card__home-popup-body {
          display: grid;
          gap: 12px;
          max-height: min(76vh, 680px);
          min-height: 0;
          overflow: auto;
          overscroll-behavior: contain;
          padding-right: 2px;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-y;
        }

        .power-flow-card__home-popup-summary {
          align-items: center;
          display: flex;
          flex-direction: column;
          gap: 6px;
          justify-content: center;
          padding: 2px 0 6px;
          width: 100%;
        }

        .power-flow-card__home-popup-summary .power-flow-card__bubble--home {
          aspect-ratio: 1 / 1;
          height: auto;
          min-height: var(--node-size);
          min-width: var(--node-size);
          width: var(--node-size);
        }

        .power-flow-card__home-popup-list {
          border-top: 1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 2px;
          min-width: 0;
          padding-bottom: 4px;
          padding-top: 12px;
          width: 100%;
        }

        .power-flow-card__home-popup-node {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 14px;
          display: grid;
          gap: 12px;
          grid-template-columns: auto minmax(0, 1fr);
          max-width: 100%;
          min-width: 0;
          padding: 10px 12px;
          width: 100%;
        }

        .power-flow-card__home-popup-node--entering {
          animation: power-flow-card-fade-up 360ms cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: var(--device-enter-delay, 0ms);
        }

        .power-flow-card__home-popup-node .power-flow-card__bubble--individual {
          flex-shrink: 0;
        }

        .power-flow-card__home-popup-node .power-flow-card__node-info--popup {
          align-items: flex-start;
          gap: 5px;
          justify-content: center;
          left: auto;
          max-width: none;
          min-width: 0;
          position: static;
          transform: none;
          width: 100%;
        }

        .power-flow-card__home-popup-device-name {
          color: var(--primary-text-color);
          display: block;
          font-size: calc(var(--chip-font-size, 11px) + 1px);
          font-weight: 600;
          line-height: 1.25;
          min-width: 0;
          overflow-wrap: anywhere;
          text-align: left;
          width: 100%;
          word-break: break-word;
        }

        .power-flow-card__home-popup-node .power-flow-card__chip--value {
          align-self: flex-start;
          max-width: none;
        }

        .power-flow-card__home-popup-node .power-flow-card__node-secondary {
          max-width: none;
          text-align: left;
          white-space: normal;
        }

        .power-flow-card__header--entering {
          animation: power-flow-card-fade-up calc(var(--power-flow-card-content-duration) * 0.82) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .power-flow-card__title {
          color: var(--primary-text-color);
          font-size: ${Math.max(14, parseSizeToPixels(styles.title_size, 16))}px;
          font-weight: 700;
          line-height: 1.1;
          min-width: 0;
          opacity: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .power-flow-card__dashboard-button {
          align-items: center;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--primary-text-color) 7%, transparent) 0%,
            color-mix(in srgb, var(--primary-text-color) 3%, transparent) 100%
          );
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          gap: 8px;
          min-height: 34px;
          padding: 0 12px;
          transform-origin: center;
          transition: transform 160ms ease, border-color 160ms ease, box-shadow 180ms ease, background 180ms ease;
          will-change: transform;
        }

        .power-flow-card__dashboard-button:hover {
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--primary-text-color) 11%, transparent) 0%,
            color-mix(in srgb, var(--primary-text-color) 5%, transparent) 100%
          );
          border-color: color-mix(in srgb, var(--primary-text-color) 20%, transparent);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 12%, transparent),
            0 6px 16px rgba(0, 0, 0, 0.08);
        }

        .power-flow-card__dashboard-button ha-icon {
          --mdc-icon-size: 16px;
        }

        .power-flow-card__content {
          flex: 0 1 auto;
          min-height: 0;
          position: relative;
          transform-origin: center;
          z-index: 1;
        }

        .power-flow-card__content--entering {
          animation: power-flow-card-fade-up var(--power-flow-card-content-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 34ms;
        }

        .power-flow-card--simple .power-flow-card__content {
          align-items: stretch;
          display: flex;
          justify-content: flex-start;
        }

        .power-flow-card__surface {
          background: linear-gradient(180deg, color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 18%, transparent) 0%, transparent 100%);
          border-radius: calc(${styles.card.border_radius} - 6px);
          box-sizing: border-box;
          height: auto;
          min-height: ${surfaceMinHeight}px;
          position: relative;
          transform-origin: center;
          width: 100%;
        }

        .power-flow-card--compact .power-flow-card__surface,
        .power-flow-card--full .power-flow-card__surface {
          aspect-ratio: ${surfaceAspectCss};
          max-height: none;
          padding: 9px 11px 11px;
        }

        .power-flow-card__surface--entering {
          animation: power-flow-card-surface-in calc(var(--power-flow-card-content-duration) * 0.94) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 46ms;
        }

        .power-flow-card__svg {
          height: 100%;
          inset: 0;
          overflow: hidden;
          position: absolute;
          width: 100%;
          pointer-events: none;
          shape-rendering: geometricPrecision;
        }

        .power-flow-card__svg--lines {
          z-index: 0;
        }

        .power-flow-card__surface--entering .power-flow-card__svg--lines {
          animation: power-flow-card-lines-in calc(var(--power-flow-card-content-duration) * 0.92) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 82ms;
          transform-origin: center;
        }

        .power-flow-card__svg--dots {
          z-index: 3;
        }

        .power-flow-card__surface--entering .power-flow-card__svg--dots {
          animation: power-flow-card-dots-in calc(var(--power-flow-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 124ms;
          transform: none;
          transform-origin: center;
        }

        .power-flow-card__line {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: ${flowWidth}px;
        }

        .power-flow-card__line-glow {
          fill: none;
          filter: url(#power-flow-glow);
          opacity: 0.08;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: ${flowWidth * 1.28}px;
        }

        .power-flow-card__dot-group {
          opacity: 0;
        }

        .power-flow-card:not(.power-flow-card--motion-paused) .power-flow-card__dot-group {
          opacity: 1;
        }

        .power-flow-card__dot-glow {
          fill: color-mix(in srgb, var(--dot-color) 32%, rgba(255,255,255,0.2));
          opacity: 0.88;
        }

        .power-flow-card__dot-core {
          fill: rgba(255, 255, 255, 0.98);
          stroke: color-mix(in srgb, var(--dot-color) 36%, rgba(255,255,255,0.5));
        }

        .power-flow-card__node {
          position: absolute;
          transform: translate(-50%, -50%);
          transform-origin: center;
          will-change: opacity, transform;
          z-index: 1;
        }

        .power-flow-card__node--entering {
          animation: power-flow-card-node-in calc(var(--power-flow-card-content-duration) * 0.86) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: var(--node-enter-delay, 0ms);
        }

        .power-flow-card__node-info {
          align-items: center;
          display: flex;
          flex-direction: column;
          gap: 5px;
          left: 50%;
          max-width: 180px;
          min-width: 0;
          position: absolute;
          transform: translateX(-50%);
        }

        .power-flow-card__node-info--below {
          top: calc(100% + 5px);
        }

        .power-flow-card__node-info--above {
          bottom: calc(100% + 5px);
        }

        .power-flow-card__node-info--home {
          bottom: calc(100% + 8px);
        }

        .power-flow-card--simple .power-flow-card__header {
          gap: 8px;
        }

        .power-flow-card--simple {
          gap: 8px;
          padding: 10px;
        }

        .power-flow-card--simple .power-flow-card__dashboard-button {
          min-height: 38px;
          padding: 0 15px;
        }

        .power-flow-card--simple .power-flow-card__surface {
          min-height: 148px;
        }

        .power-flow-card--simple .power-flow-card__node-info {
          gap: 4px;
        }

        .power-flow-card--simple .power-flow-card__chip {
          max-width: 120px;
        }

        .power-flow-card__simple-layout {
          align-content: space-between;
          display: grid;
          gap: 4px;
          grid-template-rows: auto 1fr auto;
          min-height: 100%;
          position: relative;
          width: 100%;
        }

        .power-flow-card__simple-layout.has-footer {
          padding-bottom: 42px;
        }

        .power-flow-card__simple-top--entering {
          animation: power-flow-card-fade-up calc(var(--power-flow-card-content-duration) * 0.74) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 46ms;
        }

        .power-flow-card__simple-rail--entering {
          animation: power-flow-card-surface-in calc(var(--power-flow-card-content-duration) * 0.88) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 92ms;
        }

        .power-flow-card__simple-bottom--entering {
          animation: power-flow-card-fade-up calc(var(--power-flow-card-content-duration) * 0.76) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 132ms;
        }

        .power-flow-card__simple-top,
        .power-flow-card__simple-bottom {
          align-items: center;
          display: grid;
          gap: 0;
          grid-template-columns: var(--simple-source-column, 48px) minmax(64px, 1fr) var(--simple-home-column, 96px);
          width: 100%;
        }

        .power-flow-card__simple-top {
          margin-bottom: 1px;
        }

        .power-flow-card__simple-bottom {
          margin-top: 2px;
        }

        .power-flow-card__simple-rail {
          align-items: center;
          display: grid;
          gap: 0;
          grid-template-columns: var(--simple-source-column, 48px) minmax(64px, 1fr) var(--simple-home-column, 96px);
          min-height: var(--simple-rail-height, 96px);
          position: relative;
          width: 100%;
        }

        .power-flow-card__simple-rail-node {
          align-items: center;
          display: flex;
          justify-content: center;
          min-width: 0;
          position: relative;
          z-index: 2;
        }

        .power-flow-card__simple-rail-node::before {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${dominantColor} 9%, transparent) 0%, transparent 58%),
            linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(0,0,0,0.03) 100%),
            ${styles.card.background};
          border-radius: 999px;
          content: "";
          height: calc(var(--simple-node-cover-size, 48px) + 12px);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(var(--simple-node-cover-size, 48px) + 12px);
          z-index: 0;
        }

        .power-flow-card__simple-rail-node--source {
          grid-column: 1;
        }

        .power-flow-card__simple-rail-node--home {
          grid-column: 3;
        }

        .power-flow-card__simple-rail-spacer {
          grid-column: 2;
          min-width: 64px;
        }

        .power-flow-card__simple-column {
          align-items: center;
          display: grid;
          gap: 4px;
          justify-items: center;
          min-width: 0;
          position: relative;
          z-index: 1;
        }

        .power-flow-card__simple-column--home {
          gap: 3px;
          justify-self: center;
          margin-bottom: 0;
          max-width: 100%;
          width: max-content;
        }

        .power-flow-card__simple-column--source {
          justify-self: center;
          margin-top: 0;
          max-width: 100%;
          width: max-content;
        }

        .power-flow-card__simple-column--source-top {
          justify-self: center;
          max-width: 100%;
          width: max-content;
        }

        .power-flow-card__simple-column--home-top {
          transform: translateY(-4px);
        }

        .power-flow-card__simple-column--source-top {
          gap: 3px;
          transform: translateY(4px);
        }

        .power-flow-card__simple-column--source-bottom {
          gap: 3px;
          transform: translateY(-6px);
        }

        .power-flow-card__simple-info {
          align-items: center;
          display: grid;
          gap: 4px;
          justify-items: center;
          min-width: 0;
        }

        .power-flow-card__simple-info .power-flow-card__chip,
        .power-flow-card__simple-info .power-flow-card__node-secondary {
          max-width: 150px;
        }

        .power-flow-card__simple-top .power-flow-card__chip,
        .power-flow-card__simple-bottom .power-flow-card__chip {
          justify-self: center;
          margin-left: auto;
          margin-right: auto;
        }

        .power-flow-card__simple-line-wrap {
          left: var(--line-start-offset, 18px);
          min-width: 64px;
          pointer-events: none;
          position: absolute;
          right: var(--line-end-offset, 28px);
          top: 50%;
          transform: translateY(-50%);
          width: auto;
          z-index: 1;
        }

        .power-flow-card__simple-line {
          background: linear-gradient(180deg, color-mix(in srgb, var(--line-background) 100%, transparent) 0%, color-mix(in srgb, var(--line-background) 78%, transparent) 100%);
          border-radius: 999px;
          height: ${Math.max(flowWidth, 2)}px;
          opacity: var(--line-opacity);
          overflow: hidden;
          position: relative;
          width: 100%;
        }

        .power-flow-card__simple-line.is-active {
          box-shadow: 0 0 12px color-mix(in srgb, var(--line-color) 16%, transparent);
        }

        .power-flow-card__simple-dot {
          animation: power-flow-card-simple-dot linear infinite both;
          background: radial-gradient(circle at 35% 35%, rgba(255,255,255,0.98) 0 35%, color-mix(in srgb, var(--line-color) 44%, rgba(255,255,255,0.92)) 36% 100%);
          border-radius: 999px;
          box-shadow:
            0 0 0 3px color-mix(in srgb, var(--line-color) 14%, transparent),
            0 0 10px color-mix(in srgb, var(--line-color) 20%, transparent);
          height: 8px;
          left: 0;
          opacity: 0;
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 8px;
          will-change: left, opacity;
        }

        .power-flow-card__simple-rail--entering .power-flow-card__simple-dot {
          animation: none;
          opacity: 0;
          visibility: hidden;
        }

        .power-flow-card--motion-paused .power-flow-card__simple-dot {
          animation-play-state: paused !important;
        }

        @keyframes power-flow-card-simple-dot {
          0% {
            left: 0;
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          92% {
            opacity: 1;
          }
          100% {
            left: calc(100% - 8px);
            opacity: 0;
          }
        }

        .power-flow-card__bubble {
          align-items: center;
          appearance: none;
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--node-tint) 12%, transparent) 0%, transparent 48%),
            linear-gradient(180deg, color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 88%, rgba(255,255,255,0.07)) 0%, color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 72%, rgba(255,255,255,0.03)) 100%);
          border: 1px solid color-mix(in srgb, var(--node-tint) 24%, rgba(255,255,255,0.09));
          border-radius: 999px;
          box-shadow: 0 10px 20px color-mix(in srgb, var(--node-tint) 7%, rgba(0,0,0,0.14));
          color: var(--node-icon-glyph, ${styles.icon.color || "var(--primary-text-color)"});
          cursor: default;
          display: inline-flex;
          height: var(--node-size);
          justify-content: center;
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
          will-change: transform;
          z-index: 1;
          width: var(--node-size);
        }

        .power-flow-card__bubble.is-clickable {
          cursor: pointer;
        }

        .power-flow-card__bubble:hover.is-clickable {
          transform: translateY(-1px);
        }

        .power-flow-card__simple-footer {
          display: flex;
          inset: auto 0 0 0;
          justify-content: center;
          position: absolute;
          width: 100%;
        }

        .power-flow-card__simple-footer--entering {
          animation: power-flow-card-fade-up calc(var(--power-flow-card-content-duration) * 0.74) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 168ms;
        }

        .power-flow-card__dashboard-button--footer {
          min-width: 0;
          min-height: 40px;
          padding: 0 16px;
        }

        .power-flow-card__dashboard-button--footer ha-icon {
          --mdc-icon-size: 18px;
        }

        .power-flow-card__bubble ha-icon {
          --mdc-icon-size: calc(var(--node-size) * 0.44);
        }

        .power-flow-card__bubble--home {
          align-items: center;
          border-radius: 30px;
          display: grid;
          gap: 5px;
          grid-auto-rows: min-content;
          justify-items: center;
          padding: 10px 12px;
        }

        .power-flow-card--simple .power-flow-card__bubble--home {
          gap: 4px;
          padding: 9px 11px;
        }

        .power-flow-card__home-icon-wrap {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          display: inline-flex;
          height: 31px;
          justify-content: center;
          width: 31px;
        }

        .power-flow-card--simple .power-flow-card__home-icon-wrap {
          height: 29px;
          width: 29px;
        }

        .power-flow-card__home-icon-wrap ha-icon {
          --mdc-icon-size: 17px;
        }

        .power-flow-card__home-value {
          align-items: baseline;
          display: inline-flex;
          gap: 4px;
          justify-content: center;
          min-width: 0;
        }

        .power-flow-card--simple .power-flow-card__home-value {
          gap: 3px;
        }

        .power-flow-card__home-value-number {
          font-size: ${Math.max(19, parseSizeToPixels(styles.home_value_size, 22))}px;
          font-weight: 700;
          letter-spacing: -0.04em;
          line-height: 0.9;
        }

        .power-flow-card--simple .power-flow-card__home-value-number {
          font-size: ${Math.max(16, parseSizeToPixels(styles.home_value_size, 22) - 4)}px;
          letter-spacing: -0.035em;
        }

        .power-flow-card__home-value-unit {
          font-size: ${Math.max(12, parseSizeToPixels(styles.home_unit_size, 14))}px;
          font-weight: 600;
          opacity: 0.84;
        }

        .power-flow-card--simple .power-flow-card__home-value-unit {
          font-size: ${Math.max(10, parseSizeToPixels(styles.home_unit_size, 14) - 2)}px;
        }

        .power-flow-card__bubble--individual {
          border-radius: 18px;
        }

        .power-flow-card__chip {
          align-items: center;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--primary-text-color) 6%, transparent) 0%,
            color-mix(in srgb, var(--primary-text-color) 3%, transparent) 100%
          );
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          color: var(--primary-text-color);
          display: inline-flex;
          font-size: var(--chip-font-size, 10px);
          font-weight: 600;
          gap: 4px;
          height: var(--chip-height, 22px);
          justify-content: center;
          max-width: 180px;
          min-width: 0;
          padding: var(--chip-padding, 0 9px);
          white-space: nowrap;
        }

        .power-flow-card__chip--label,
        .power-flow-card__chip--value {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .power-flow-card__chip--value {
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--chip-tint) 16%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)) 0%,
            color-mix(in srgb, var(--primary-text-color) 4%, transparent) 100%
          );
          border-color: color-mix(in srgb, var(--chip-tint) 30%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        }

        .power-flow-card__chip-unit {
          opacity: 0.82;
        }

        .power-flow-card__chip-direction {
          --mdc-icon-size: calc(var(--chip-font-size, 10px) + 4px);
          flex: 0 0 auto;
          opacity: 0.9;
        }

        .power-flow-card__node-secondary {
          color: var(--secondary-text-color);
          display: block;
          font-size: var(--secondary-size, 10px);
          font-weight: 500;
          max-width: 170px;
          overflow: hidden;
          text-align: center;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .power-flow-card__unavailable {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          display: inline-flex;
          height: 18px;
          justify-content: center;
          position: absolute;
          right: -3px;
          top: -3px;
          width: 18px;
          z-index: 2;
        }

        .power-flow-card__unavailable ha-icon {
          --mdc-icon-size: 11px;
          color:#fff;
        }

        .power-flow-card__content.is-pressing {
          animation: power-flow-card-content-bounce var(--power-flow-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        :is(.power-flow-card__bubble, .power-flow-card__dashboard-button).is-pressing {
          animation: power-flow-card-bubble-bounce var(--power-flow-card-button-bounce-duration) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
        }

        @keyframes power-flow-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes power-flow-card-surface-in {
          0% {
            opacity: 0;
            transform: scale(0.975);
          }
          60% {
            opacity: 1;
            transform: scale(1.015);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes power-flow-card-lines-in {
          0% {
            opacity: 0;
            transform: scale(0.985);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes power-flow-card-dots-in {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes power-flow-card-node-in {
          0% {
            opacity: 0;
            transform: translate(-50%, calc(-50% + 10px)) scale(0.9);
          }
          62% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.04);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes power-flow-card-content-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.015);
          }
          72% {
            transform: scale(1.006);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes power-flow-card-bubble-bounce {
          0% {
            transform: scale(1);
          }
          48% {
            transform: scale(1.1);
          }
          72% {
            transform: scale(1.03);
          }
          100% {
            transform: scale(1);
          }
        }

        @media (max-width: 640px) {
          .power-flow-card__surface {
            min-height: ${surfaceMinHeightMobile}px;
          }

          .power-flow-card__dashboard-button {
            min-height: 34px;
            padding: 0 12px;
          }
        }

        ${animations.enabled ? "" : `
        .power-flow-card,
        .power-flow-card *,
        .power-flow-card *::before,
        .power-flow-card *::after {
          animation: none !important;
          transition: none !important;
        }
        `}
        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <ha-card class="power-flow-card power-flow-card--${layoutPreset}">
        ${
          hasHeader
            ? `
              <div class="power-flow-card__header ${shouldAnimateEntrance ? "power-flow-card__header--entering" : ""}">
                <div class="power-flow-card__header-main">
                  <div class="power-flow-card__title">${escapeHtml(titleText)}</div>
                  ${
                    showDashboardButton && layoutPreset !== "simple"
                      ? `
                        <button class="power-flow-card__dashboard-button" data-dashboard-action="navigate" title="${escapeHtml(this._config?.dashboard_link_label && this._config.dashboard_link_label !== DEFAULT_CONFIG.dashboard_link_label ? this._config.dashboard_link_label : this._powerFlowUi("energy", "Energy"))}">
                          <ha-icon icon="mdi:lightning-bolt-circle"></ha-icon>
                          <span>${escapeHtml(this._config?.dashboard_link_label && this._config.dashboard_link_label !== DEFAULT_CONFIG.dashboard_link_label ? this._config.dashboard_link_label : this._powerFlowUi("energy", "Energy"))}</span>
                        </button>
                      `
                      : ""
                  }
                </div>
                ${consumptionChipsMarkup}
              </div>
            `
            : ""
        }
        <div class="power-flow-card__content ${shouldAnimateEntrance ? "power-flow-card__content--entering" : ""}" ${this._config?.tap_action === "more-info" ? `data-card-action="primary" role="button" tabindex="0" aria-label="${escapeHtml(titleText || this._powerFlowUi("energy", "Energy"))}"` : ""}>
          ${
            layoutPreset === "simple"
              ? this._renderSimpleLayout(nodes, lines, {
                animateEntrance: shouldAnimateEntrance,
              })
              : `
                <div class="power-flow-card__surface ${shouldAnimateEntrance ? "power-flow-card__surface--entering" : ""}">
                  <svg class="power-flow-card__svg power-flow-card__svg--lines" viewBox="0 0 100 100" preserveAspectRatio="none" shape-rendering="geometricPrecision">
                    <defs>
                      <filter id="power-flow-glow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="0.85"></feGaussianBlur>
                      </filter>
                      <filter id="power-flow-soften" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="0.06"></feGaussianBlur>
                      </filter>
                    </defs>
                    ${lines.map(line => `
                      <path class="power-flow-card__line-glow" d="${line.path}" stroke="${escapeHtml(line.color)}" opacity="${line.opacity * (line.active ? 1 : 0.7)}"></path>
                      <path class="power-flow-card__line" d="${line.path}" stroke="${escapeHtml(line.color)}" opacity="${line.opacity}"></path>
                    `).join("")}
                  </svg>
                  ${this._renderNode(nodes.home, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.home),
                  })}
                  ${this._shouldRenderDiagramNode("grid", nodes.grid) ? this._renderNode(nodes.grid, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.grid),
                  }) : ""}
                  ${this._shouldRenderDiagramNode("solar", nodes.solar) ? this._renderNode(nodes.solar, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.solar),
                  }) : ""}
                  ${this._shouldRenderDiagramNode("battery", nodes.battery) ? this._renderNode(nodes.battery, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.battery),
                  }) : ""}
                  ${this._shouldRenderDiagramNode("water", nodes.water) ? this._renderNode(nodes.water, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.water),
                  }) : ""}
                  ${this._shouldRenderDiagramNode("gas", nodes.gas) ? this._renderNode(nodes.gas, {
                    layoutPreset,
                    animateEntrance: shouldAnimateEntrance,
                    enterDelay: this._getNodeAnimationDelay(nodes.gas),
                  }) : ""}
                  ${
                    showIndividualsOnDiagram
                      ? nodes.individual.map((node, index) => this._renderNode(node, {
                        layoutPreset,
                        animateEntrance: shouldAnimateEntrance,
                        enterDelay: this._getNodeAnimationDelay(node, index),
                      })).join("")
                      : ""
                  }
                  <svg class="power-flow-card__svg power-flow-card__svg--dots" viewBox="0 0 100 100" preserveAspectRatio="none" shape-rendering="geometricPrecision">
                    ${lines.map(line => this._renderFlowDots(line, flowDotOpts)).join("")}
                  </svg>
                </div>
              `
          }
        </div>
      </ha-card>
      ${this._renderHomeDevicePopup(nodes)}
    `;

    this._syncFlowMotionPause();
    const homePopupDialog = this.shadowRoot.querySelector('.power-flow-card__home-popup-panel[role="dialog"]');
    if (homePopupDialog instanceof HTMLElement) {
      window.NodaliaUtils?.bindModalFocus?.(this, homePopupDialog, {
        initialFocusSelector: '[data-home-popup-action="close"]',
      });
    } else {
      window.NodaliaUtils?.releaseModalFocus?.(this);
    }
    this._lastRenderSignature = this._getRenderSignature();

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 180);
    }
  }
}
  _lazyNodaliaPowerFlowCard = NodaliaPowerFlowCard;
  return NodaliaPowerFlowCard;
}
