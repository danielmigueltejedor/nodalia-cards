// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  COMPACT_LAYOUT_THRESHOLD,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  MOP_MODE_PATTERNS,
  SHARED_SMART_MODE_PATTERNS,
  SUCTION_MODE_PATTERNS,
} from "./vacuum-constants";
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
} from "./vacuum-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, getSafeStyles, normalizeConfig } from "./vacuum-config";
import {
  applyStubEntity,
  humanizeModeLabel,
  isHelperRelatedToConfiguredVacuum,
  isUnavailableState,
  listVacuumObjectIds,
  parseSizeToPixels,
} from "./vacuum-helpers";

let _lazyNodaliaVacuumCard;
export function loadNodaliaVacuumCard() {
  if (_lazyNodaliaVacuumCard) {
    return _lazyNodaliaVacuumCard;
  }
class NodaliaVacuumCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["vacuum"], entities, entitiesFallback);
  }

  static getEntitySuggestion(hass, entityId) {
    return [
      window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, {
        domains: ["vacuum"],
        label: "Vacuum — Standard",
        buildConfig: (_hass, selectedEntityId) => ({ entity: selectedEntityId, compact_layout_mode: "auto" }),
      }),
      window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, {
        domains: ["vacuum"],
        label: "Vacuum — Compact",
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
    this._cardWidth = 0;
    this._isCompactLayout = false;
    this._activeModePanel = null;
    this._roomPanelOpen = false;
    this._selectedCleaningAreas = [];
    this._lastNonSmartModeSelection = {
      suction: "",
      mop: "",
    };
    this._pendingModeSelection = {
      suction: "",
      mop: "",
    };
    this._pendingModeSelectionTimers = {
      suction: 0,
      mop: 0,
    };
    this._relatedEntityCache = null;
    this._relatedEntityCacheGeneration = 0;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._suppressNextVacuumTap = false;
    this._resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextWidth = Math.round(entry.contentRect?.width || this.clientWidth || 0);
      // Ignore collapse glitches (display:none, mid-reflow 0-width). Treating those
      // as "not compact" expands the card, sections lock a taller footprint, and
      // returning to dense leaves an empty band under vacuum/media pairs.
      if (nextWidth < 48) {
        return;
      }

      const nextCompact = this._shouldUseCompactLayout(nextWidth);
      const compactChanged = nextCompact !== this._isCompactLayout;

      if (nextWidth === this._cardWidth && !compactChanged) {
        return;
      }

      this._cardWidth = nextWidth;
      this._isCompactLayout = nextCompact;

      if (compactChanged) {
        // Sections caches grid options; compact↔full changes the row footprint.
        this._notifyLayoutChange();
      }

      const signature = this._getRenderSignature();
      if (signature === this._lastRenderSignature) {
        return;
      }

      this._lastRenderSignature = signature;
      this._render();
    });
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const node = event
                .composedPath()
                .find(n => n instanceof HTMLElement && n.dataset?.vacuumAction);
              const action = node?.dataset?.vacuumAction;
              if (action === "body_tap") {
                return "body";
              }
              if (action === "icon_tap") {
                return "icon";
              }
              return null;
            },
            shouldBeginHold: zone => this._canRunConfiguredCardHoldAction(zone),
            onHold: zone => {
              const state = this._getState();
              this._syncRememberedModeSelections(state);
              this._triggerHaptic();
              this._runConfiguredCardHoldAction(state, zone);
            },
            markHoldConsumedClick: () => {
              this._suppressNextVacuumTap = true;
            },
          })
        : () => {};
    }

  connectedCallback() {
    this._detachHostHold?.reconnect?.();
    this._resizeObserver?.observe(this);
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
    Object.keys(this._pendingModeSelectionTimers).forEach(kind => {
      if (this._pendingModeSelectionTimers[kind]) {
        window.clearTimeout(this._pendingModeSelectionTimers[kind]);
        this._pendingModeSelectionTimers[kind] = 0;
      }
    });
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._relatedEntityCache = null;
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._isCompactLayout = this._shouldUseCompactLayout(
      Math.round(this._cardWidth || this.clientWidth || 0),
    );
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._relatedEntityCacheGeneration += 1;
    const nextSignature = this._getRenderSignature(hass);
    const pendingChanged = this._syncPendingModeSelections();

    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature && !pendingChanged) {
      return;
    }

    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    return this._getEstimatedCardSize();
  }

  getGridOptions() {
    // Half-width section tiles (≤ 6 cols) always share Light/Fan's 2-row rhythm.
    // Using the expandable estimate here let transient non-compact measures (or an
    // open panel) reserve 3–5 rows; after collapsing back to dense, HA kept the
    // empty band until a full reload.
    const rows = this._getSectionMinRows();
    return {
      rows: "auto",
      columns: "full",
      min_rows: rows,
      min_columns: 2,
    };
  }

  _getSectionMinRows(state = this._getState()) {
    const columns = this._getConfiguredGridColumns();
    const halfWidthTile = columns !== null && columns <= 6;
    if (this._isCompactLayout || halfWidthTile) {
      return 2;
    }
    return this._getEstimatedCardSize(state);
  }

  _notifyLayoutChange() {
    if (!this.isConnected) {
      return;
    }

    // Prefer the sections-local iron-resize signal. A global window resize made
    // sibling cards remeasure mid-layout and could reintroduce stale footprints.
    fireEvent(this, "iron-resize", {});
  }

  _scheduleLayoutRefresh(delay = 0) {
    if (typeof window === "undefined") {
      return;
    }

    const safeDelay = Math.max(0, Number(delay) || 0);
    const schedule = window.NodaliaUtils?.scheduleDeferTimer;
    const done = () => {
      if (!this.isConnected) {
        return;
      }
      this._notifyLayoutChange();
    };
    if (typeof schedule === "function") {
      schedule(this, done, safeDelay);
    } else {
      window.setTimeout(done, safeDelay);
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

  _getEstimatedCardSize(state = this._getState()) {
    // Dense/compact tiles only show header + a short control row — match Light/Fan
    // (2 section rows). Returning 3 here left an empty band under vacuum/media pairs.
    if (this._isCompactLayout) {
      return 2;
    }

    let size = 2;
    const availableModeDescriptors = this._getVisibleModeDescriptors(state);
    const activeModeDescriptor = availableModeDescriptors.find(mode => mode.kind === this._activeModePanel)
      || null;
    const roomMappings = this._getRoomMappings(state);
    const modePanelVisible = Boolean(this._activeModePanel);
    const roomPanelVisible = Boolean(this._roomPanelOpen && roomMappings.length);

    if (modePanelVisible && activeModeDescriptor?.options?.length) {
      size += Math.min(3, Math.max(1, Math.ceil(activeModeDescriptor.options.length / 4)));
    }

    if (roomPanelVisible) {
      size += Math.min(3, Math.max(1, Math.ceil(roomMappings.length / 4)));
    }

    return size;
  }

  _getRoomPanelMaxHeight(roomMappings) {
    const roomCount = Array.isArray(roomMappings) ? roomMappings.length : 0;
    return clamp(84 + (roomCount * 52), 220, 720);
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const errorEntityId = this._config?.error_entity || this._guessRelatedErrorEntity();
    const errorState = errorEntityId ? hass?.states?.[errorEntityId] || null : null;
    const auxiliaryState = this._getAuxiliaryState();
    const batteryState = this._getAuxiliaryBatteryState();
    const mappingState = this._getRoomMappingSourceState();
    const suctionSelectEntity = this._config?.suction_select_entity || this._guessRelatedSelectEntity("suction");
    const suctionSelectState = suctionSelectEntity ? hass?.states?.[suctionSelectEntity] || null : null;
    const mopSelectEntity = this._config?.mop_select_entity || this._guessRelatedSelectEntity("mop");
    const mopSelectState = mopSelectEntity ? hass?.states?.[mopSelectEntity] || null : null;
    const attrs = state?.attributes || {};
    const joinParts = window.NodaliaRenderSignature?.joinParts;
    const values = [
      entityId,
      state?.state || "",
      state?.last_updated || "",
      attrs.friendly_name || "",
      attrs.icon || "",
      this._config?.show_entity_picture === true,
      this._config?.entity_picture || attrs.entity_picture_local || attrs.entity_picture || "",
      attrs.battery_level ?? -1,
      attrs.status || "",
      attrs.fan_speed || "",
      attrs.water_grade || attrs.water_box_mode || "",
      attrs.current_room || attrs.current_segment || "",
      errorEntityId,
      errorState?.state || "",
      errorState?.last_updated || "",
      auxiliaryState?.entity_id || this._config?.state_entity || "",
      auxiliaryState?.state || "",
      auxiliaryState?.last_updated || "",
      batteryState?.entity_id || this._config?.battery_entity || "",
      batteryState?.state || "",
      batteryState?.last_updated || "",
      mappingState?.entity_id || this._config?.room_mapping_entity || "",
      mappingState?.state || "",
      mappingState?.last_updated || "",
      suctionSelectEntity,
      suctionSelectState?.state || "",
      suctionSelectState?.last_updated || "",
      mopSelectEntity,
      mopSelectState?.state || "",
      mopSelectState?.last_updated || "",
      window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") || "en",
      this._isCompactLayout,
      this._activeModePanel || "",
      this._roomPanelOpen === true,
      this._config?.tap_action || "",
      this._config?.icon_tap_action ?? "",
      this._config?.tap_navigation_path || "",
      this._config?.hold_action || "",
      this._config?.icon_hold_action ?? "",
      this._config?.hold_navigation_path || "",
      this._config?.icon_hold_navigation_path || "",
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "vacuum:", values }]);
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
      Math.round(iconSize + (cardPadding * 2) + (cardGap * 2) + 48),
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

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;
    return {
      enabled: configuredAnimations.enabled !== false,
      iconAnimation: configuredAnimations.icon_animation !== false,
      panelDuration: clamp(
        Number(configuredAnimations.panel_duration) || DEFAULT_CONFIG.animations.panel_duration,
        120,
        2400,
      ),
      buttonBounceDuration: clamp(
        Number(configuredAnimations.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration,
        120,
        1200,
      ),
    };
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

  _openMoreInfo(entityId = this._config?.entity) {
    if (!entityId) {
      return;
    }

    fireEvent(this, "hass-more-info", {
      entityId,
    });
  }

  _navigate(path) {
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
      window.dispatchEvent(new CustomEvent("location-changed", {
        detail: { replace: false },
      }));
      return;
    }

    fireEvent(this, "hass-navigate", { path: navigationPath });
  }

  _effectiveVacuumTapAction(zone = "body") {
    const body = normalizeTextKey(this._config?.tap_action || "default");
    if (zone === "icon") {
      const raw = String(this._config?.icon_tap_action ?? "").trim();
      if (!raw) {
        return body;
      }
      return normalizeTextKey(raw);
    }
    return body;
  }

  _runConfiguredCardTapAction(state = this._getState(), zone = "body") {
    const action = this._effectiveVacuumTapAction(zone);

    switch (action) {
      case "none":
        break;
      case "more_info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "navigate":
        this._navigate(this._config?.tap_navigation_path);
        break;
      case "default":
      default:
        this._runPrimaryAction(state);
        break;
    }
  }

  _canRunConfiguredCardTapAction(zone = "body") {
    const action = this._effectiveVacuumTapAction(zone);

    if (action === "none") {
      return false;
    }

    if (action === "navigate") {
      return Boolean(String(this._config?.tap_navigation_path || "").trim());
    }

    if (action === "more_info") {
      return Boolean(this._config?.entity);
    }

    return true;
  }

  _effectiveVacuumHoldAction(zone = "body") {
    const body = normalizeTextKey(this._config?.hold_action || "none");
    if (zone === "icon") {
      const raw = String(this._config?.icon_hold_action ?? "").trim();
      if (!raw) {
        return body;
      }
      return normalizeTextKey(raw);
    }
    return body;
  }

  _resolveVacuumHoldNavigationPath(zone = "body") {
    const tapPath = String(this._config?.tap_navigation_path ?? "").trim();
    const holdPath = String(this._config?.hold_navigation_path ?? "").trim();
    const iconHoldPath = String(this._config?.icon_hold_navigation_path ?? "").trim();
    if (zone === "icon") {
      return iconHoldPath || holdPath || tapPath;
    }
    return holdPath || tapPath;
  }

  _runConfiguredCardHoldAction(state = this._getState(), zone = "body") {
    const action = this._effectiveVacuumHoldAction(zone);

    switch (action) {
      case "none":
        break;
      case "more_info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "navigate":
        this._navigate(this._resolveVacuumHoldNavigationPath(zone));
        break;
      case "default":
      default:
        this._runPrimaryAction(state);
        break;
    }
  }

  _canRunConfiguredCardHoldAction(zone = "body") {
    const action = this._effectiveVacuumHoldAction(zone);

    if (action === "none") {
      return false;
    }

    if (action === "navigate") {
      return Boolean(this._resolveVacuumHoldNavigationPath(zone));
    }

    if (action === "more_info") {
      return Boolean(this._config?.entity);
    }

    return true;
  }

  _getState() {
    if (!this._config?.entity || !this._hass?.states) {
      return null;
    }

    return this._hass.states[this._config.entity] || null;
  }

  _getRelatedEntityCache() {
    if (!this._hass?.states || !this._config?.entity) {
      return null;
    }

    const objectId = normalizeTextKey(String(this._config.entity).split(".").slice(1).join("_"));
    if (!objectId) {
      return null;
    }

    if (
      this._relatedEntityCache?.objectId === objectId
      && this._relatedEntityCache?.generation === this._relatedEntityCacheGeneration
    ) {
      return this._relatedEntityCache;
    }

    const sortLoc = window.NodaliaUtils?.editorSortLocale?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const candidates = {
      state: [],
      error: [],
      battery: [],
      roomMapping: [],
      suctionSelect: [],
      mopSelect: [],
    };
    const suctionPatterns = ["fan_speed", "fan_power", "suction", "cleaning_mode"];
    const mopPatterns = ["mop", "water", "water_level", "water_volume", "scrub"];
    const states = this._hass.states;
    const registry = this._hass.entities || {};
    const vacuumObjectIds = listVacuumObjectIds(states);
    const vacuumDeviceId = registry[this._config.entity]?.device_id || "";
    const allowUnscopedRoborock = vacuumObjectIds.length <= 1;

    Object.keys(states).forEach(entityId => {
      const isSameDevice = Boolean(vacuumDeviceId && registry[entityId]?.device_id === vacuumDeviceId);
      const related = isHelperRelatedToConfiguredVacuum({
        candidateId: entityId,
        searchable: states[entityId]?.attributes?.friendly_name || "",
        isSameDevice,
        objectId,
        vacuumObjectIds,
      });
      if (entityId.startsWith("sensor.")) {
        if (related && ["estado", "status", "state"].some(pattern => entityId.includes(pattern))) {
          candidates.state.push(entityId);
        }
        if (
          (related || (allowUnscopedRoborock && entityId.includes("roborock")))
          && ["error", "fault", "fallo", "erro"].some(pattern => entityId.includes(pattern))
        ) {
          candidates.error.push(entityId);
        }
        if (related && ["battery", "bateria"].some(pattern => entityId.includes(pattern))) {
          candidates.battery.push(entityId);
        }
        if (related && ["room_mapping", "rooms", "segments", "habitaciones"].some(pattern => entityId.includes(pattern))) {
          candidates.roomMapping.push(entityId);
        }
        return;
      }

      if (!entityId.startsWith("select.") || !related) {
        return;
      }
      if (suctionPatterns.some(pattern => entityId.includes(pattern))) {
        candidates.suctionSelect.push(entityId);
      }
      if (mopPatterns.some(pattern => entityId.includes(pattern))) {
        candidates.mopSelect.push(entityId);
      }
    });

    Object.values(candidates).forEach(items => items.sort((left, right) => left.localeCompare(right, sortLoc)));
    this._relatedEntityCache = {
      objectId,
      generation: this._relatedEntityCacheGeneration,
      state: candidates.state[0] || "",
      error: candidates.error[0] || "",
      battery: candidates.battery[0] || "",
      roomMapping: candidates.roomMapping[0] || "",
      suctionSelect: candidates.suctionSelect[0] || "",
      mopSelect: candidates.mopSelect[0] || "",
    };
    return this._relatedEntityCache;
  }

  _guessRelatedStateEntity() {
    return this._getRelatedEntityCache()?.state || "";
  }

  _getAuxiliaryState() {
    const entityId = this._config?.state_entity || this._guessRelatedStateEntity();
    return entityId ? this._hass?.states?.[entityId] || null : null;
  }

  _guessRelatedErrorEntity() {
    return this._getRelatedEntityCache()?.error || "";
  }

  _getErrorState() {
    const entityId = this._config?.error_entity || this._guessRelatedErrorEntity();
    return entityId ? this._hass?.states?.[entityId] || null : null;
  }

  _getErrorLabel() {
    const raw = String(this._getErrorState()?.state || "").trim();
    if (!raw || !window.NodaliaI18n?.isVacuumErrorState?.(raw)) {
      return "";
    }
    return window.NodaliaI18n?.translateVacuumErrorState
      ? window.NodaliaI18n.translateVacuumErrorState(this._hass, this._config?.language ?? "auto", raw, raw)
      : raw;
  }

  _hasVacuumError() {
    return Boolean(this._getErrorLabel());
  }

  _guessRelatedBatteryEntity() {
    return this._getRelatedEntityCache()?.battery || "";
  }

  _getAuxiliaryBatteryState() {
    const entityId = this._config?.battery_entity || this._guessRelatedBatteryEntity();
    return entityId ? this._hass?.states?.[entityId] || null : null;
  }

  _guessRelatedRoomMappingEntity() {
    return this._getRelatedEntityCache()?.roomMapping || "";
  }

  _getRoomMappingSourceState() {
    const explicitEntityId = this._config?.room_mapping_entity;
    if (explicitEntityId && this._hass?.states?.[explicitEntityId]) {
      return this._hass.states[explicitEntityId];
    }

    const auxiliaryState = this._getAuxiliaryState();
    if (
      auxiliaryState &&
      (
        auxiliaryState.attributes?.room_mapping !== undefined ||
        auxiliaryState.attributes?.rooms !== undefined ||
        String(auxiliaryState.state || "").includes("cleaning_area_id:")
      )
    ) {
      return auxiliaryState;
    }

    const state = this._getState();
    if (
      state &&
      (
        state.attributes?.room_mapping !== undefined ||
        state.attributes?.rooms !== undefined ||
        String(state.state || "").includes("cleaning_area_id:")
      )
    ) {
      return state;
    }

    const guessedEntityId = this._guessRelatedRoomMappingEntity();
    return guessedEntityId ? this._hass?.states?.[guessedEntityId] || null : null;
  }

  _extractRoomsFromString(rawValue) {
    const text = String(rawValue || "").trim();
    if (!text) {
      return [];
    }

    try {
      const parsed = JSON.parse(text);
      return this._normalizeRoomCollection(parsed);
    } catch (_error) {
      // Fall through to YAML-like parsing.
    }

    const roomBlocks = text
      .split(/\n(?=-\s*id:|\s*-\s*id:)/g)
      .map(block => block.trim())
      .filter(Boolean);

    const rooms = roomBlocks
      .map(block => {
        const idMatch = block.match(/(?:^|\n)\s*-?\s*id:\s*([^\n]+)/i);
        const nameMatch = block.match(/(?:^|\n)\s*name:\s*([^\n]+)/i);
        const cleaningAreaMatch = block.match(/(?:^|\n)\s*cleaning_area_id:\s*([^\n]+)/i);

        const id = idMatch ? idMatch[1].trim() : "";
        const name = nameMatch ? nameMatch[1].trim() : "";
        const cleaningAreaId = cleaningAreaMatch ? cleaningAreaMatch[1].trim() : "";

        if (!id && !name && !cleaningAreaId) {
          return null;
        }

        return {
          id,
          name,
          cleaning_area_id: cleaningAreaId,
        };
      })
      .filter(Boolean);

    return this._normalizeRoomCollection(rooms);
  }

  _normalizeRoomCollection(rawValue) {
    let collection = rawValue;

    if (typeof collection === "string") {
      return this._extractRoomsFromString(collection);
    }

    if (Array.isArray(collection)) {
      return collection;
    }

    if (collection && typeof collection === "object") {
      if (Array.isArray(collection.room_mapping)) {
        return collection.room_mapping;
      }

      if (Array.isArray(collection.rooms)) {
        return collection.rooms;
      }

      return Object.values(collection);
    }

    return [];
  }

  _getReportedStateValue(state) {
    const error = this._getErrorLabel();
    if (error) {
      return error;
    }
    const auxiliaryState = this._getAuxiliaryState();
    if (auxiliaryState?.state && !["unknown", "unavailable"].includes(String(auxiliaryState.state).toLowerCase())) {
      return String(auxiliaryState.state);
    }

    return state?.state ? String(state.state) : "";
  }

  _getReportedStateKey(state) {
    return normalizeTextKey(this._getReportedStateValue(state));
  }

  _getVacuumName(state) {
    if (this._config?.name) {
      return this._config.name;
    }

    if (state?.attributes?.friendly_name) {
      return state.attributes.friendly_name;
    }

    return this._config?.entity || "Vacuum";
  }

  _getVacuumIcon(state) {
    if (this._config?.icon) {
      return this._config.icon;
    }

    if (this._hasVacuumError()) {
      return "mdi:alert-circle-outline";
    }

    if (state?.attributes?.icon) {
      return state.attributes.icon;
    }

    switch (state?.state) {
      case "cleaning":
        return "mdi:robot-vacuum";
      case "returning":
        return "mdi:home-map-marker";
      case "paused":
        return "mdi:pause-circle-outline";
      case "error":
        return "mdi:alert-circle-outline";
      default:
        return "mdi:robot-vacuum";
    }
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
    const trState = (stateKey, rawFallback = state?.state) => (
      window.NodaliaI18n?.translateAdvanceVacuumReportedState
        ? window.NodaliaI18n.translateAdvanceVacuumReportedState(hass, langCfg, stateKey, rawFallback)
        : rawFallback
    );

    const errorLabel = this._getErrorLabel();
    if (errorLabel) {
      return errorLabel;
    }

    if (this._isGoingToWashMops(state)) {
      return this._humanizeStateLabel("going_to_wash_mop", hass, langCfg);
    }

    if (this._isWashingMops(state)) {
      return trState("washing_mop", "Washing mops");
    }

    if (this._isDryingMops(state)) {
      return trState("drying_mop", "Drying");
    }

    if (this._isAutoEmptying(state)) {
      return trState("emptying", "Auto-emptying");
    }

    const roomMappings = this._getRoomMappings(state);
    const cleaningAreaLabel = this._getCleaningAreaLabel(state, roomMappings);
    if (cleaningAreaLabel) {
      return `${trState("cleaning", "Cleaning")}: ${cleaningAreaLabel}`;
    }

    const reportedKey = normalizeTextKey(this._getReportedStateValue(state));
    switch (reportedKey) {
      case "cleaning":
      case "segment_cleaning":
      case "room_cleaning":
      case "zone_cleaning":
      case "segment_clean":
      case "room_clean":
      case "zone_clean":
      case "clean_area":
      case "vacuuming":
      case "limpiando":
        return trState("cleaning", "Cleaning");
      case "going_to_wash_the_mop":
      case "going_to_wash_mop":
      case "go_to_wash_mop":
      case "go_wash_mop":
      case "returning_to_wash_mop":
        return this._humanizeStateLabel("going_to_wash_mop", hass, langCfg);
      case "paused":
      case "pause":
      case "pausado":
        return trState("paused", "Paused");
      case "returning":
      case "return_to_base":
      case "returning_home":
      case "volviendo":
        return trState("returning", "Returning to dock");
      case "docked":
      case "charging":
      case "charging_completed":
      case "en_base":
      case "base":
        return trState("docked", "Docked");
      case "idle":
      case "standby":
      case "en_espera":
        return trState("fallback", "Idle");
      case "error":
      case "fallo":
        return trState("error", "Error");
      case "unavailable":
        return trState("unavailable", "Unavailable");
      case "unknown":
        return trState("unknown", "Unknown");
      default:
        return this._humanizeStateLabel(this._getReportedStateValue(state), hass, langCfg) || "No state";
    }
  }

  _humanizeStateLabel(value, hass = null, configLang = null) {
    const raw = String(value ?? "").trim();
    if (!raw) {
      return "";
    }

    const normalized = normalizeTextKey(raw);
    if (!normalized) {
      return raw;
    }

    if (normalized.includes("go") && normalized.includes("wash") && normalized.includes("mop")) {
      return window.NodaliaI18n?.translateAdvanceVacuumReportedState
        ? window.NodaliaI18n.translateAdvanceVacuumReportedState(hass, configLang ?? "auto", "washing_mop", "Going to wash mops")
        : "Going to wash mops";
    }

    if (normalized.includes("wash") && normalized.includes("mop")) {
      return window.NodaliaI18n?.translateAdvanceVacuumReportedState
        ? window.NodaliaI18n.translateAdvanceVacuumReportedState(hass, configLang ?? "auto", "washing_mop", "Washing mops")
        : "Washing mops";
    }

    if (normalized.includes("dry") && normalized.includes("mop")) {
      return window.NodaliaI18n?.translateAdvanceVacuumReportedState
        ? window.NodaliaI18n.translateAdvanceVacuumReportedState(hass, configLang ?? "auto", "drying_mop", "Drying mops")
        : "Drying mops";
    }

    if (normalized.includes("empty")) {
      return window.NodaliaI18n?.translateAdvanceVacuumReportedState
        ? window.NodaliaI18n.translateAdvanceVacuumReportedState(hass, configLang ?? "auto", "emptying", "Auto-emptying")
        : "Auto-emptying";
    }

    if (normalized.includes("zone") && normalized.includes("clean")) {
      return window.NodaliaI18n?.translateAdvanceVacuumReportedState
        ? window.NodaliaI18n.translateAdvanceVacuumReportedState(hass, configLang ?? "auto", "cleaning", "Cleaning zone")
        : "Cleaning zone";
    }

    if ((normalized.includes("room") || normalized.includes("segment")) && normalized.includes("clean")) {
      return window.NodaliaI18n?.translateAdvanceVacuumReportedState
        ? window.NodaliaI18n.translateAdvanceVacuumReportedState(hass, configLang ?? "auto", "cleaning", "Cleaning room")
        : "Cleaning room";
    }

    return raw
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, match => match.toUpperCase());
  }

  _getActivityTextBlob(state) {
    const attributes = state?.attributes || {};
    const auxiliaryState = this._getAuxiliaryState();
    const auxiliaryAttributes = auxiliaryState?.attributes || {};
    return [
      auxiliaryState?.state,
      auxiliaryAttributes.status,
      auxiliaryAttributes.state,
      auxiliaryAttributes.activity,
      auxiliaryAttributes.phase,
      auxiliaryAttributes.job,
      auxiliaryAttributes.job_state,
      auxiliaryAttributes.task_status,
      auxiliaryAttributes.current_task,
      auxiliaryAttributes.vacuum_state,
      auxiliaryAttributes.robot_status,
      auxiliaryAttributes.cleaning_state,
      auxiliaryAttributes.cleaning_progress,
      auxiliaryAttributes.operation,
      state?.state,
      attributes.status,
      attributes.state,
      attributes.activity,
      attributes.phase,
      attributes.job,
      attributes.job_state,
      attributes.task_status,
      attributes.current_task,
      attributes.vacuum_state,
      attributes.robot_status,
      attributes.cleaning_state,
      attributes.cleaning_progress,
      attributes.operation,
    ]
      .filter(Boolean)
      .map(value => normalizeTextKey(value))
      .join(" ");
  }

  _getActiveTaskTokens(state) {
    const attributes = state?.attributes || {};
    const auxiliaryState = this._getAuxiliaryState();
    const auxiliaryAttributes = auxiliaryState?.attributes || {};

    return [
      auxiliaryState?.state,
      auxiliaryAttributes.activity,
      auxiliaryAttributes.phase,
      auxiliaryAttributes.job,
      auxiliaryAttributes.job_state,
      auxiliaryAttributes.task_status,
      auxiliaryAttributes.current_task,
      auxiliaryAttributes.cleaning_state,
      auxiliaryAttributes.operation,
      state?.state,
      attributes.activity,
      attributes.phase,
      attributes.job,
      attributes.job_state,
      attributes.task_status,
      attributes.current_task,
      attributes.cleaning_state,
      attributes.operation,
    ]
      .filter(Boolean)
      .map(value => normalizeTextKey(value));
  }

  _matchesActivity(state, keywords) {
    const activityBlob = this._getActivityTextBlob(state);
    return keywords.some(keyword => activityBlob.includes(normalizeTextKey(keyword)));
  }

  _getBatteryLevel(state) {
    const directValue = Number(state?.attributes?.battery_level);
    if (Number.isFinite(directValue)) {
      return clamp(Math.round(directValue), 0, 100);
    }

    const auxiliaryState = this._getAuxiliaryState();
    const auxiliaryBatteryLevel = Number(
      auxiliaryState?.attributes?.battery_level ??
      auxiliaryState?.attributes?.battery ??
      auxiliaryState?.attributes?.battery_remaining,
    );
    if (Number.isFinite(auxiliaryBatteryLevel)) {
      return clamp(Math.round(auxiliaryBatteryLevel), 0, 100);
    }

    const batterySensorState = this._getAuxiliaryBatteryState();
    const batterySensorValue = Number(
      batterySensorState?.state ??
      batterySensorState?.attributes?.battery_level ??
      batterySensorState?.attributes?.battery ??
      batterySensorState?.attributes?.battery_remaining,
    );
    if (Number.isFinite(batterySensorValue)) {
      return clamp(Math.round(batterySensorValue), 0, 100);
    }

    return null;
  }

  _getBatteryColor(level) {
    if (!Number.isFinite(level)) {
      return "var(--secondary-text-color)";
    }

    if (level <= 15) {
      return "var(--error-color, #ff6b6b)";
    }

    if (level <= 35) {
      return "#f59e0b";
    }

    if (level <= 60) {
      return "#f1c24c";
    }

    return "#61c97a";
  }

  _getRoomMappings(state) {
    const mappingSource = this._getRoomMappingSourceState();
    const rawRooms = [
      mappingSource?.attributes?.room_mapping,
      mappingSource?.attributes?.rooms,
      mappingSource?.state,
      state?.attributes?.room_mapping,
      state?.attributes?.rooms,
    ]
      .map(value => this._normalizeRoomCollection(value))
      .find(value => Array.isArray(value) && value.length) || [];

    if (!Array.isArray(rawRooms)) {
      return [];
    }

    const seen = new Set();
    return rawRooms
      .map(room => {
        if (!room || typeof room !== "object") {
          return null;
        }

        const cleaningAreaId = this._normalizeCleaningAreaId(
          room.cleaning_area_id ?? room.cleaningAreaId ?? room.area_id ?? room.areaId,
        );
        const fallbackId = room.id !== undefined && room.id !== null ? String(room.id) : "";
        const uniqueId = cleaningAreaId || fallbackId;
        if (!uniqueId || seen.has(uniqueId)) {
          return null;
        }

        seen.add(uniqueId);
        const rawName = room.name ? String(room.name) : "";
        const normalizedName = this._humanizeRoomLabel(rawName || uniqueId);
        return {
          cleaningAreaId: uniqueId,
          id: fallbackId,
          name: normalizedName,
        };
      })
      .filter(Boolean);
  }

  _normalizeCleaningAreaId(value) {
    const raw = String(value ?? "").trim();
    if (!raw) {
      return "";
    }

    const cleaned = raw
      .replace(/[\[\]\(\)"']/g, " ")
      .replace(/cleaning_area_id[:=]/gi, " ")
      .replace(/,+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) {
      return "";
    }

    return cleaned.split(" ")[0] || cleaned;
  }

  _humanizeRoomLabel(value) {
    const raw = String(value ?? "").trim();
    if (!raw) {
      return "";
    }

    const normalized = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return raw;
    }

    if (/^\d+$/.test(normalized)) {
      return `Area ${normalized}`;
    }

    return normalized
      .split(" ")
      .map(token => (token ? token[0].toUpperCase() + token.slice(1) : token))
      .join(" ");
  }

  _getCleaningAreaIdFromState(state) {
    const reported = this._getReportedStateValue(state);
    const match = String(reported || "").match(/cleaning_area_id:\s*([^\s,]+)/i);
    return match ? this._normalizeCleaningAreaId(match[1]) : "";
  }

  _getCleaningAreaLabel(state, roomMappings) {
    const id = this._getCleaningAreaIdFromState(state);
    if (!id) {
      return "";
    }

    const room = roomMappings.find(item => item.cleaningAreaId === id || item.id === id);
    return room?.name || "";
  }

  _sanitizeSelectedCleaningAreas(roomMappings) {
    const validIds = new Set(roomMappings.map(room => room.cleaningAreaId));
    this._selectedCleaningAreas = this._selectedCleaningAreas.filter(areaId => validIds.has(areaId));
  }

  _toggleCleaningAreaSelection(areaId) {
    if (!areaId) {
      return;
    }

    if (this._selectedCleaningAreas.includes(areaId)) {
      this._selectedCleaningAreas = this._selectedCleaningAreas.filter(value => value !== areaId);
      return;
    }

    this._selectedCleaningAreas = [...this._selectedCleaningAreas, areaId];
  }

  _canSelectRooms(state, roomMappings = this._getRoomMappings(state)) {
    return this._isDocked(state) && roomMappings.length > 0;
  }

  _runAreaCleaning(roomMappings) {
    if (!roomMappings.length) {
      return false;
    }

    const selectedIds = this._selectedCleaningAreas.length
      ? this._selectedCleaningAreas
      : roomMappings.map(room => room.cleaningAreaId);

    if (!selectedIds.length) {
      return false;
    }

    this._callService("clean_area", {
      cleaning_area_id: selectedIds,
    });
    return true;
  }

  _getCurrentFanSpeed(state) {
    const current = state?.attributes?.fan_speed;
    return current ? String(current) : "";
  }

  _getModeVisibilityField(kind) {
    return kind === "mop" ? "hidden_mop_modes" : "hidden_suction_modes";
  }

  _isModeHidden(kind, value) {
    const field = this._getModeVisibilityField(kind);
    const hiddenModes = Array.isArray(this._config?.[field]) ? this._config[field] : [];
    const expectedKey = normalizeTextKey(value);
    return hiddenModes.some(item => normalizeTextKey(item) === expectedKey);
  }

  _getSelectOptions(entityId) {
    const selectState = entityId ? this._hass?.states?.[entityId] : null;
    const options = Array.isArray(selectState?.attributes?.options)
      ? selectState.attributes.options.map(item => String(item || "").trim()).filter(Boolean)
      : [];

    return {
      entityId,
      options,
      state: selectState,
      value: selectState?.state ? String(selectState.state) : "",
    };
  }

  _getModeDescriptorLabel(kind) {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const labels = window.NodaliaI18n?.strings?.(lang)?.advanceVacuum?.descriptorLabels
      || window.NodaliaI18n?.strings?.("en")?.advanceVacuum?.descriptorLabels
      || {};
    return kind === "mop" ? (labels.mop || "Mop") : (labels.suction || "Vacuum");
  }

  _guessRelatedSelectEntity(kind) {
    const cache = this._getRelatedEntityCache();
    return kind === "mop" ? (cache?.mopSelect || "") : (cache?.suctionSelect || "");
  }

  _categorizeModeOption(value) {
    const key = normalizeTextKey(value);

    if (MOP_MODE_PATTERNS.some(pattern => key.includes(pattern))) {
      return "mop";
    }

    if (SUCTION_MODE_PATTERNS.some(pattern => key.includes(pattern))) {
      return "suction";
    }

    return "unknown";
  }

  _isSharedSmartMode(value) {
    const key = normalizeTextKey(value);
    return SHARED_SMART_MODE_PATTERNS.some(pattern => key.includes(pattern));
  }

  _getFanPresets(state) {
    const configuredPresets = Array.isArray(this._config?.fan_presets) ? this._config.fan_presets : [];
    if (configuredPresets.length) {
      return configuredPresets;
    }

    if (Array.isArray(state?.attributes?.fan_speed_list)) {
      return state.attributes.fan_speed_list
        .map(item => String(item || "").trim())
        .filter(Boolean);
    }

    return [];
  }

  _getModeDescriptor(kind, state) {
    const explicitEntity = kind === "mop"
      ? this._config?.mop_select_entity
      : this._config?.suction_select_entity;
    const selectEntity = explicitEntity || this._guessRelatedSelectEntity(kind);
    const selectDescriptor = this._getSelectOptions(selectEntity);

    if (selectDescriptor.entityId && selectDescriptor.options.length) {
      const visibleOptions = selectDescriptor.options.filter(option => !this._isModeHidden(kind, option));
      if (!visibleOptions.length) {
        return null;
      }

      return {
        current: selectDescriptor.value,
        kind,
        label: this._getModeDescriptorLabel(kind),
        options: visibleOptions,
        service: "select",
        target: selectDescriptor.entityId,
      };
    }

    const rawPresets = this._getFanPresets(state);
    if (!rawPresets.length) {
      return null;
    }

    const options = rawPresets.filter(option => {
      const optionKind = this._categorizeModeOption(option);
      const isSharedSmartMode = this._isSharedSmartMode(option);

      if (kind === "mop") {
        return optionKind === "mop" || isSharedSmartMode;
      }

      return optionKind !== "mop" || isSharedSmartMode;
    }).filter(option => !this._isModeHidden(kind, option));

    if (!options.length) {
      return null;
    }

    return {
      current: this._getCurrentFanSpeed(state),
      kind,
      label: this._getModeDescriptorLabel(kind),
      options,
      service: "fan",
      target: this._config?.entity,
    };
  }

  _getVisibleModeDescriptors(state) {
    const modeControlsEnabled = this._config?.show_mode_controls !== false && this._config?.show_fan_presets !== false;
    if (!modeControlsEnabled) {
      return [];
    }

    return [
      this._getModeDescriptor("suction", state),
      this._getModeDescriptor("mop", state),
    ].filter(Boolean);
  }

  _getActiveModeDescriptor(state, panelKind = this._activeModePanel) {
    return this._getVisibleModeDescriptors(state).find(mode => mode.kind === panelKind) || null;
  }

  _getModePanelMaxHeight(descriptors) {
    const maxOptions = Array.isArray(descriptors)
      ? descriptors.reduce((maxValue, descriptor) => Math.max(maxValue, descriptor?.options?.length || 0), 0)
      : 0;

    return clamp(84 + (maxOptions * 52), 220, 560);
  }

  _getModePanelMarkup(panelKind, state = this._getState()) {
    const descriptor = this._getActiveModeDescriptor(state, panelKind);
    if (!descriptor) {
      return "";
    }

    const activeModeDisplayValue = this._getOptimisticModeValue(
      descriptor.kind,
      descriptor.current,
      descriptor.options,
    );

    return `
      <div class="vacuum-card__presets vacuum-card__mode-panel">
        ${descriptor.options
          .map(option => `
            <button
              class="vacuum-card__preset ${normalizeTextKey(option) === normalizeTextKey(activeModeDisplayValue) ? "vacuum-card__preset--active" : ""}"
              type="button"
              data-vacuum-action="${descriptor.service === "select" ? "select" : "fan"}"
              ${descriptor.service === "select" ? `data-target-entity="${escapeHtml(descriptor.target)}"` : ""}
              data-mode-kind="${escapeHtml(descriptor.kind)}"
              data-value="${escapeHtml(option)}"
            >
              ${escapeHtml(humanizeModeLabel(option, descriptor.kind, this._hass, this._config?.language ?? "auto"))}
            </button>
          `)
          .join("")}
      </div>
    `;
  }

  _getRoomPanelMarkup(state = this._getState()) {
    const roomMappings = this._getRoomMappings(state);
    if (!(this._roomPanelOpen && roomMappings.length)) {
      return "";
    }

    return `
      <div class="vacuum-card__room-panel">
        ${roomMappings
          .map(room => `
            <button
              class="vacuum-card__preset ${this._selectedCleaningAreas.includes(room.cleaningAreaId) ? "vacuum-card__preset--active" : ""}"
              type="button"
              data-vacuum-action="toggle-room"
              data-cleaning-area-id="${escapeHtml(room.cleaningAreaId)}"
            >
              ${escapeHtml(room.name)}
            </button>
          `)
          .join("")}
      </div>
    `;
  }

  _getPanelMarkup(panelKey, state = this._getState()) {
    if (panelKey === "room") {
      return this._getRoomPanelMarkup(state);
    }

    if (panelKey === "suction" || panelKey === "mop") {
      return this._getModePanelMarkup(panelKey, state);
    }

    return "";
  }

  _setPanelToggleButtonsState(panelKey) {
    this.shadowRoot
      ?.querySelectorAll('[data-vacuum-action="toggle-mode-panel"]')
      .forEach(button => {
        if (!(button instanceof HTMLElement)) {
          return;
        }

        const isActive = (button.dataset.modeKind || "") === panelKey;
        button.classList.toggle("vacuum-card__mode-toggle--active", isActive);
        button.classList.toggle("vacuum-card__control--active", isActive);
      });

    this.shadowRoot
      ?.querySelectorAll('[data-vacuum-action="toggle-room-panel"]')
      .forEach(button => {
        if (!(button instanceof HTMLElement)) {
          return;
        }

        const isActive = panelKey === "room";
        button.classList.toggle("vacuum-card__control--active", isActive);
      });
  }

  _setModePanelActiveSelection(modeKind, value) {
    const panelShell = this.shadowRoot?.querySelector(".vacuum-card__panel-shell");
    if (!(panelShell instanceof HTMLElement) || panelShell.dataset.panelKey !== String(modeKind || "")) {
      return;
    }

    panelShell
      .querySelectorAll(".vacuum-card__preset")
      .forEach(button => {
        if (!(button instanceof HTMLElement)) {
          return;
        }

        const isActive = normalizeTextKey(button.dataset.value || "") === normalizeTextKey(value);
        button.classList.toggle("vacuum-card__preset--active", isActive);
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
    const nextPanelKey = panelKey === "room"
      ? (this._canSelectRooms(state) ? "room" : "")
      : this._getActiveModeDescriptor(state, panelKey)?.kind || "";

    this._activeModePanel = nextPanelKey === "suction" || nextPanelKey === "mop" ? nextPanelKey : null;
    this._roomPanelOpen = nextPanelKey === "room";
    const animations = this._getAnimationSettings();
    const panelsHost = this.shadowRoot?.querySelector(".vacuum-card__panels");
    const panelMarkup = nextPanelKey ? this._getPanelMarkup(nextPanelKey, state) : "";

    this._setPanelToggleButtonsState(nextPanelKey);

    if (!panelsHost || !(panelsHost instanceof HTMLElement) || !state) {
      this._render();
      this._notifyLayoutChange();
      return;
    }

    const existingPanel = panelsHost.querySelector(".vacuum-card__panel-shell");
    if (!animations.enabled) {
      if (existingPanel instanceof HTMLElement) {
        existingPanel.remove();
      }

      if (panelMarkup) {
        const panelNode = this._createMarkupNode(`
          <div class="vacuum-card__panel-shell" data-panel-key="${nextPanelKey}">
            <div class="vacuum-card__panel-inner">
              ${panelMarkup}
            </div>
          </div>
        `);

        if (panelNode instanceof HTMLElement) {
          panelsHost.replaceChildren(panelNode);
          this._notifyLayoutChange();
          return;
        }
      }

      panelsHost.replaceChildren();
      this._notifyLayoutChange();
      return;
    }

    const removePanel = (panel, onDone = null) => {
      if (!(panel instanceof HTMLElement)) {
        if (typeof onDone === "function") {
          onDone();
        }
        return;
      }

      panel.classList.remove("vacuum-card__panel-shell--entering");
      panel.classList.add("vacuum-card__panel-shell--leaving");

      const finalizeRemoval = () => {
        if (panel.isConnected) {
          panel.remove();
        }
        this._notifyLayoutChange();
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
        panelsHost.replaceChildren();
        this._notifyLayoutChange();
        return;
      }

      const panelNode = this._createMarkupNode(`
        <div class="vacuum-card__panel-shell vacuum-card__panel-shell--entering" data-panel-key="${nextPanelKey}">
          <div class="vacuum-card__panel-inner">
            ${panelMarkup}
          </div>
        </div>
      `);

      if (!(panelNode instanceof HTMLElement)) {
        this._render();
        return;
      }

      panelsHost.replaceChildren(panelNode);
      this._notifyLayoutChange();
      this._scheduleLayoutRefresh(animations.panelDuration + 120);
      const finalizeEnter = () => {
        if (panelNode.isConnected) {
          panelNode.classList.remove("vacuum-card__panel-shell--entering");
        }
      };
      const schedule = window.NodaliaUtils?.scheduleDeferTimer;
      if (typeof schedule === "function") {
        schedule(this, finalizeEnter, animations.panelDuration + 80);
      } else {
        window.setTimeout(finalizeEnter, animations.panelDuration + 80);
      }
    };

    if (!nextPanelKey) {
      if (existingPanel instanceof HTMLElement) {
        removePanel(existingPanel, () => {
          panelsHost.replaceChildren();
        });
      } else {
        panelsHost.replaceChildren();
        this._notifyLayoutChange();
      }
      return;
    }

    if (!panelMarkup) {
      if (existingPanel instanceof HTMLElement) {
        removePanel(existingPanel, () => {
          panelsHost.replaceChildren();
        });
      } else {
        panelsHost.replaceChildren();
        this._notifyLayoutChange();
      }
      return;
    }

    const existingPanelKey = existingPanel instanceof HTMLElement ? existingPanel.dataset.panelKey || "" : "";
    if (existingPanel instanceof HTMLElement && existingPanelKey === nextPanelKey) {
      if (existingPanel.classList.contains("vacuum-card__panel-shell--leaving")) {
        existingPanel.remove();
      } else {
        const panelInner = existingPanel.querySelector(".vacuum-card__panel-inner");
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

  _isCleaning(state) {
    return this._matchesActivity(state, [
      "cleaning",
      "segment_cleaning",
      "segment_clean",
      "room_cleaning",
      "room_clean",
      "zone_cleaning",
      "zone_clean",
      "clean_area",
      "clean_zone",
      "clean_room",
      "spot_cleaning",
      "vacuuming",
      "limpiando",
    ]);
  }

  _isGoingToWashMops(state) {
    return this._matchesActivity(state, [
      "going_to_wash_the_mop",
      "going_to_wash_mop",
      "go_to_wash_mop",
      "go_wash_mop",
      "returning_to_wash_mop",
      "heading_to_wash_mop",
    ]);
  }

  _isWashingMops(state) {
    return this._matchesActivity(state, [
      "washing",
      "wash_mop",
      "washmop",
      "mop_wash",
      "mopwash",
      "washing_mop",
      "clean_mop",
      "mop_clean",
      "lavando_mopas",
      "lavando_mopa",
      "lavado_mopa",
      "washing_pads",
      "rinse_mop",
      "wash_the_mop",
      "washing_the_mop",
      "mop_rinsing",
      "rinsing_mop",
    ]);
  }

  _isDryingMops(state) {
    return this._matchesActivity(state, [
      "drying",
      "dry_mop",
      "mop_dry",
      "drying_mop",
      "drying_the_mop",
      "air_dry",
      "secando",
      "secado_mopa",
      "secando_mopas",
    ]);
  }

  _isAutoEmptying(state) {
    const keywords = [
      "emptying",
      "self_emptying",
      "selfemptying",
      "auto_empty",
      "autoempty",
      "dust_empty",
      "collecting_dust",
      "dock_empty",
      "autovaciando",
      "auto_vaciado",
      "vaciando",
    ];

    const reportedKey = this._getReportedStateKey(state);
    if (keywords.some(keyword => reportedKey.includes(normalizeTextKey(keyword)))) {
      return true;
    }

    const activeTokens = this._getActiveTaskTokens(state);
    return keywords.some(keyword => activeTokens.includes(normalizeTextKey(keyword)));
  }

  _isPaused(state) {
    return this._matchesActivity(state, [
      "paused",
      "pause",
      "pausado",
    ]);
  }

  _isReturning(state) {
    return this._matchesActivity(state, [
      "returning",
      "return_to_base",
      "returning_home",
      "volviendo",
    ]);
  }

  _isDocked(state) {
    return this._matchesActivity(state, [
      "docked",
      "charging",
      "charging_completed",
      "en_base",
      "base",
    ]);
  }

  _isActive(state) {
    return (
      this._isCleaning(state) ||
      this._isPaused(state) ||
      this._isReturning(state) ||
      this._isWashingMops(state) ||
      this._isDryingMops(state) ||
      this._isAutoEmptying(state)
    );
  }

  _shouldTintCard(state) {
    const reportedStateKey = this._getReportedStateKey(state);

    if (this._hasVacuumError()) {
      return true;
    }

    if (!reportedStateKey || ["unknown", "unavailable"].includes(reportedStateKey)) {
      return false;
    }

    if (this._isDocked(state)) {
      return false;
    }

    return true;
  }

  _getAccentColor(state) {
    const styles = getSafeStyles(this._config?.styles);

    if (state?.state === "error" || this._hasVacuumError()) {
      return styles.icon.error_color;
    }

    if (this._isWashingMops(state)) {
      return styles.icon.washing_color || "#5aa7ff";
    }

    if (this._isDryingMops(state)) {
      return styles.icon.drying_color || "#f1c24c";
    }

    if (this._isAutoEmptying(state)) {
      return styles.icon.emptying_color || "#9b6b4a";
    }

    if (this._isReturning(state)) {
      return styles.icon.returning_color;
    }

    if (this._isCleaning(state) || this._isPaused(state)) {
      return styles.icon.active_color;
    }

    return styles.icon.docked_color;
  }

  _callService(service, data = {}) {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    this._hass.callService("vacuum", service, {
      entity_id: this._config.entity,
      ...data,
    });
  }

  _callSelectOption(entityId, option) {
    if (!this._hass || !entityId || !option) {
      return;
    }

    this._hass.callService("select", "select_option", {
      entity_id: entityId,
      option,
    });
  }

  _findMatchingModeOption(options, value) {
    const expectedKey = normalizeTextKey(value);
    if (!expectedKey || !Array.isArray(options)) {
      return "";
    }

    return options.find(option => normalizeTextKey(option) === expectedKey) || "";
  }

  _findSharedSmartOption(options) {
    return Array.isArray(options)
      ? options.find(option => this._isSharedSmartMode(option)) || ""
      : "";
  }

  _getModeFallbackCandidates(kind) {
    return kind === "mop"
      ? ["off", "low", "medium", "high", "deep", "standard", "normal", "custom"]
      : ["balanced", "standard", "normal", "quiet", "silent", "gentle", "turbo", "max", "strong", "custom"];
  }

  _getModeFallbackOption(kind, descriptor) {
    if (!descriptor?.options?.length) {
      return "";
    }

    const remembered = this._findMatchingModeOption(
      descriptor.options,
      this._lastNonSmartModeSelection[kind],
    );
    if (remembered && !this._isSharedSmartMode(remembered)) {
      return remembered;
    }

    const normalizedOptions = descriptor.options.map(option => ({
      key: normalizeTextKey(option),
      value: option,
    }));

    for (const candidate of this._getModeFallbackCandidates(kind)) {
      const exactMatch = normalizedOptions.find(option => option.key === candidate);
      if (exactMatch && !this._isSharedSmartMode(exactMatch.value)) {
        return exactMatch.value;
      }
    }

    const firstNonSmart = descriptor.options.find(option => !this._isSharedSmartMode(option));
    return firstNonSmart || "";
  }

  _clearPendingModeSelection(kind) {
    if (!kind || !(kind in this._pendingModeSelection)) {
      return false;
    }

    if (this._pendingModeSelectionTimers[kind]) {
      window.clearTimeout(this._pendingModeSelectionTimers[kind]);
      this._pendingModeSelectionTimers[kind] = 0;
    }

    if (!this._pendingModeSelection[kind]) {
      return false;
    }

    this._pendingModeSelection[kind] = "";
    return true;
  }

  _setPendingModeSelection(kind, value) {
    if (!kind || !(kind in this._pendingModeSelection)) {
      return;
    }

    this._clearPendingModeSelection(kind);
    this._pendingModeSelection[kind] = String(value || "").trim();

    if (!this._pendingModeSelection[kind]) {
      return;
    }

    const done = () => {
      this._pendingModeSelectionTimers[kind] = 0;
      if (!this.isConnected || !this._pendingModeSelection[kind]) {
        return;
      }

      this._pendingModeSelection[kind] = "";
      this._render();
    };
    const schedule = window.NodaliaUtils?.scheduleDeferTimer;
    if (typeof schedule === "function") {
      this._pendingModeSelectionTimers[kind] = schedule(this, done, 2500);
    } else {
      this._pendingModeSelectionTimers[kind] = window.setTimeout(done, 2500);
    }
  }

  _syncPendingModeSelections(state = this._getState()) {
    let didChange = false;

    ["suction", "mop"].forEach(kind => {
      const pendingValue = this._pendingModeSelection[kind];
      if (!pendingValue) {
        return;
      }

      const descriptor = this._getModeDescriptor(kind, state);
      if (!descriptor?.current) {
        return;
      }

      if (normalizeTextKey(descriptor.current) === normalizeTextKey(pendingValue)) {
        didChange = this._clearPendingModeSelection(kind) || didChange;
      }
    });

    return didChange;
  }

  _getOptimisticModeValue(kind, currentValue, options = []) {
    const pendingValue = this._pendingModeSelection?.[kind];
    if (!pendingValue) {
      return currentValue;
    }

    const matchedOption = Array.isArray(options)
      ? options.find(option => normalizeTextKey(option) === normalizeTextKey(pendingValue))
      : "";

    return matchedOption || currentValue;
  }

  _rememberNonSmartModeSelection(kind, value) {
    if (!kind || !value || this._isSharedSmartMode(value)) {
      return;
    }

    this._lastNonSmartModeSelection[kind] = value;
  }

  _syncRememberedModeSelections(state) {
    ["suction", "mop"].forEach(kind => {
      const descriptor = this._getModeDescriptor(kind, state);
      if (descriptor?.current && !this._isSharedSmartMode(descriptor.current)) {
        this._rememberNonSmartModeSelection(kind, descriptor.current);
      }
    });
  }

  _applyLinkedSmartModeSelection(kind, value, state) {
    const descriptor = this._getModeDescriptor(kind, state);
    const otherKind = kind === "mop" ? "suction" : "mop";
    const otherDescriptor = this._getModeDescriptor(otherKind, state);

    if (descriptor?.service === "select" && descriptor.target && value) {
      this._callSelectOption(descriptor.target, value);
    } else if (descriptor?.service === "fan" && value) {
      this._callService("set_fan_speed", {
        fan_speed: value,
      });
      return;
    }

    if (!descriptor || !otherDescriptor || otherDescriptor.service !== "select" || !otherDescriptor.target) {
      return;
    }

    if (otherDescriptor.target === descriptor.target) {
      return;
    }

    if (this._isSharedSmartMode(value)) {
      const sharedSmartOption = this._findSharedSmartOption(otherDescriptor.options);
      if (
        sharedSmartOption &&
        normalizeTextKey(sharedSmartOption) !== normalizeTextKey(otherDescriptor.current)
      ) {
        this._callSelectOption(otherDescriptor.target, sharedSmartOption);
      }
      return;
    }

    if (!this._isSharedSmartMode(otherDescriptor.current)) {
      return;
    }

    const fallbackOption = this._getModeFallbackOption(otherKind, otherDescriptor);
    if (
      fallbackOption &&
      normalizeTextKey(fallbackOption) !== normalizeTextKey(otherDescriptor.current)
    ) {
      this._callSelectOption(otherDescriptor.target, fallbackOption);
    }
  }

  _runPrimaryAction(state) {
    const roomMappings = this._getRoomMappings(state);
    if (this._roomPanelOpen && this._canSelectRooms(state, roomMappings) && this._runAreaCleaning(roomMappings)) {
      this._roomPanelOpen = false;
      return;
    }

    if (this._shouldUsePausePrimary(state)) {
      this._callService("pause");
      return;
    }

    this._callService("start");
  }

  _shouldUsePausePrimary(state) {
    const reportedStateKey = this._getReportedStateKey(state);

    if (this._hasVacuumError() || !reportedStateKey || ["unknown", "unavailable", "error"].includes(reportedStateKey)) {
      return false;
    }

    if (this._isDocked(state) || this._isPaused(state)) {
      return false;
    }

    return true;
  }

  _getControls(state) {
    const controls = [];
    const usePausePrimary = this._shouldUsePausePrimary(state);
    const roomMappings = this._getRoomMappings(state);

    controls.push({
      action: "primary",
      icon: usePausePrimary ? "mdi:pause" : "mdi:play",
      label: usePausePrimary ? "Pause" : "Start",
      active: usePausePrimary,
    });

    if (
      this._config?.show_return_to_base !== false &&
      state?.state !== "unavailable" &&
      !this._isDocked(state)
    ) {
      controls.push({
        action: "return_to_base",
        icon: "mdi:home-import-outline",
        label: "Base",
        active: this._isReturning(state),
      });
    }

    if (this._config?.show_stop !== false && (this._isCleaning(state) || this._isPaused(state) || this._isReturning(state))) {
      controls.push({
        action: "stop",
        icon: "mdi:stop",
        label: "Parar",
        active: false,
      });
    }

    if (this._config?.show_locate !== false && state?.state !== "unavailable") {
      controls.push({
        action: "locate",
        icon: "mdi:crosshairs-gps",
        label: "Buscar",
        active: false,
      });
    }

    if (this._canSelectRooms(state, roomMappings)) {
      controls.push({
        action: "toggle-room-panel",
        icon: "mdi:floor-plan",
        label: "Habitaciones",
        active: this._roomPanelOpen,
      });
    }

    return controls.slice(0, 4);
  }

  _vacuumCardUi(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.vacuumCard;
    const enPack = window.NodaliaI18n?.strings?.("en")?.vacuumCard;
    const raw = pack?.[key] ?? enPack?.[key];
    return String(raw != null && raw !== "" ? raw : fallback);
  }

  _renderEmptyState() {
    const title = escapeHtml(this._vacuumCardUi("emptyTitle", "Nodalia Vacuum Card"));
    const body = escapeHtml(
      this._vacuumCardUi("emptyBody", "Set `entity` to a `vacuum.*` entity to show this card."),
    );
    return `
      <ha-card class="vacuum-card vacuum-card--empty">
        <div class="vacuum-card__empty-title">${title}</div>
        <div class="vacuum-card__empty-text">${body}</div>
      </ha-card>
    `;
  }

  _onShadowClick(event) {
    const button = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.vacuumAction);

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const vacuumAction = button.dataset.vacuumAction;
    if ((vacuumAction === "body_tap" || vacuumAction === "icon_tap") && this._suppressNextVacuumTap) {
      this._suppressNextVacuumTap = false;
      return;
    }

    this._triggerHaptic();
    if (button instanceof HTMLButtonElement) {
      this._triggerButtonBounce(button);
    }

    const state = this._getState();
    this._syncRememberedModeSelections(state);

    switch (vacuumAction) {
      case "body_tap":
        this._runConfiguredCardTapAction(state, "body");
        break;
      case "icon_tap":
        this._runConfiguredCardTapAction(state, "icon");
        break;
      case "primary":
        this._runPrimaryAction(state);
        break;
      case "start":
        this._callService("start");
        break;
      case "pause":
        this._callService("pause");
        break;
      case "stop":
        this._callService("stop");
        break;
      case "return_to_base":
        this._callService("return_to_base");
        break;
      case "locate":
        this._callService("locate");
        break;
      case "toggle-mode-panel": {
        const modeKind = button.dataset.modeKind || "";
        const nextModeKind = this._activeModePanel === modeKind ? "" : modeKind;
        this._setVisiblePanelKey(nextModeKind, state);
        break;
      }
      case "toggle-room-panel":
        this._setVisiblePanelKey(this._roomPanelOpen ? "" : "room", state);
        break;
      case "toggle-room":
        if (button.dataset.cleaningAreaId) {
          this._toggleCleaningAreaSelection(button.dataset.cleaningAreaId);
        }
        this._render();
        break;
      case "fan":
        if (button.dataset.value) {
          this._setPendingModeSelection(button.dataset.modeKind || "suction", button.dataset.value);
          this._rememberNonSmartModeSelection(button.dataset.modeKind || "suction", button.dataset.value);
          this._setModePanelActiveSelection(button.dataset.modeKind || "suction", button.dataset.value);
          this._callService("set_fan_speed", {
            fan_speed: button.dataset.value,
          });
        }
        break;
      case "select":
        if (button.dataset.targetEntity && button.dataset.value) {
          this._setPendingModeSelection(button.dataset.modeKind || "", button.dataset.value);
          this._rememberNonSmartModeSelection(button.dataset.modeKind || "", button.dataset.value);
          this._setModePanelActiveSelection(button.dataset.modeKind || "", button.dataset.value);
          this._applyLinkedSmartModeSelection(button.dataset.modeKind || "", button.dataset.value, state);
        }
        break;
      default:
        break;
    }
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    if (!this._config) {
      this.shadowRoot.innerHTML = "";
      return;
    }

    const config = this._config;
    const styles = config.styles;
    const state = this._getState();

    if (!state) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
          }

          * {
            box-sizing: border-box;
          }

          .vacuum-card--empty {
            background: ${styles.card.background};
            border: ${styles.card.border};
            border-radius: ${styles.card.border_radius};
            box-shadow: ${styles.card.box_shadow};
            display: grid;
            gap: 6px;
            padding: ${styles.card.padding};
          }

          .vacuum-card__empty-title {
            color: var(--primary-text-color);
            font-size: 15px;
            font-weight: 700;
          }

          .vacuum-card__empty-text {
            color: var(--secondary-text-color);
            font-size: 13px;
            line-height: 1.5;
          }
        </style>
        ${this._renderEmptyState()}
      `;
      return;
    }

    const title = this._getVacuumName(state);
    const icon = this._getVacuumIcon(state);
    const entityPicture = this._getEntityPicture(state);
    const stateLabel = this._getStateLabel(state);
    const showUnavailableBadge = isUnavailableState(state);
    const batteryLevel = this._getBatteryLevel(state);
    const availableModeDescriptors = this._getVisibleModeDescriptors(state);
    const isCompactLayout = this._isCompactLayout;
    const accentColor = this._getAccentColor(state);
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const shouldAnimateActiveIcon = animations.enabled && animations.iconAnimation && this._isCleaning(state);
    const controls = this._getControls(state);
    const denseCompact = isCompactLayout;
    const visibleControls = denseCompact
      ? controls.filter(control => ["primary", "locate", "return_to_base"].includes(control.action)).slice(0, 3)
      : controls;
    const visibleModeDescriptors = denseCompact ? [] : availableModeDescriptors;
    if (denseCompact) {
      this._activeModePanel = null;
      this._roomPanelOpen = false;
    }
    const isTintedState = this._shouldTintCard(state);
    const shouldDarkenBubbleIconGlyph =
      isTintedState && Boolean(window.NodaliaBubbleContrast?.shouldDarkenBubbleIconGlyph?.(state, accentColor));
    const iconGlyphColor = isTintedState
      ? (
          window.NodaliaBubbleContrast?.resolveBubbleIconGlyphColor?.(state, accentColor)
          || `color-mix(in srgb, ${accentColor} ${shouldDarkenBubbleIconGlyph ? 42 : 72}%, var(--primary-text-color))`
        )
      : styles.icon.color;
    const roomMappings = this._getRoomMappings(state);
    const chips = [];
    const batteryChipColor = this._getBatteryColor(batteryLevel);
    const modePanelMaxHeight = this._getModePanelMaxHeight(availableModeDescriptors);
    const roomPanelMaxHeight = this._getRoomPanelMaxHeight(roomMappings);
    const batteryChipMarkup = config.show_battery_chip !== false && batteryLevel !== null
      ? `
        <span class="vacuum-card__chip vacuum-card__chip--battery">
          <ha-icon icon="mdi:battery"></ha-icon>
          <span>${batteryLevel}%</span>
        </span>
      `
      : "";
    const cardBackground = isTintedState
      ? `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 52%, ${styles.card.background} 100%)`
      : styles.card.background;
    const cardBorder = isTintedState
      ? `color-mix(in srgb, ${accentColor} 34%, var(--divider-color))`
      : styles.card.border;
    const cardShadow = isTintedState
      ? `${styles.card.box_shadow}, 0 16px 32px color-mix(in srgb, ${accentColor} 18%, rgba(0, 0, 0, 0.18))`
      : styles.card.box_shadow;

    if (config.show_state_chip !== false) {
      chips.push(`<span class="vacuum-card__chip vacuum-card__chip--state">${escapeHtml(stateLabel)}</span>`);
    }
    if (denseCompact && batteryChipMarkup) {
      chips.push(batteryChipMarkup);
    }

    if (this._activeModePanel && !availableModeDescriptors.some(mode => mode.kind === this._activeModePanel)) {
      this._activeModePanel = null;
    }
    if (this._roomPanelOpen && !this._canSelectRooms(state, roomMappings)) {
      this._roomPanelOpen = false;
    }
    this._sanitizeSelectedCleaningAreas(roomMappings);

    const activeModeDescriptor = availableModeDescriptors.find(mode => mode.kind === this._activeModePanel) || null;
    const currentModePanelMarkup = activeModeDescriptor ? this._getModePanelMarkup(activeModeDescriptor.kind, state) : "";
    const currentPanelKey = this._roomPanelOpen && roomMappings.length
      ? "room"
      : activeModeDescriptor?.kind || "";
    const currentPanelMarkup = currentPanelKey
      ? this._getPanelMarkup(currentPanelKey, state)
      : "";
    const panelShellMarkup = currentPanelMarkup
      ? `
        <div class="vacuum-card__panel-shell" data-panel-key="${escapeHtml(currentPanelKey)}">
          <div class="vacuum-card__panel-inner">
            ${currentPanelMarkup}
          </div>
        </div>
      `
      : "";

    const showTitle = true;
    const headerBatteryMarkup = denseCompact ? "" : batteryChipMarkup;
    const showCopyBlock = showTitle || chips.length > 0 || Boolean(headerBatteryMarkup);
    const canRunBodyCardTap =
      this._canRunConfiguredCardTapAction("body") || this._canRunConfiguredCardHoldAction("body");
    const canRunIconCardTap =
      this._canRunConfiguredCardTapAction("icon") || this._canRunConfiguredCardHoldAction("icon");
    const iconTapEffective = this._effectiveVacuumTapAction("icon");
    const iconButtonLabel = iconTapEffective === "navigate"
      ? "Open robot view"
      : iconTapEffective === "more_info"
        ? "Show more information"
        : this._isCleaning(state)
          ? "Pause cleaning"
          : "Start cleaning";

    this.shadowRoot.innerHTML = `
        <style>
          :host {
          --vacuum-card-content-duration: ${animations.enabled ? clamp(Math.round(animations.panelDuration * 0.9), 180, 900) : 0}ms;
          align-self: start !important;
          display: block;
          height: fit-content !important;
          max-height: max-content;
          max-width: 100%;
          width: 100%;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          --vacuum-card-panel-duration: ${animations.enabled ? animations.panelDuration : 0}ms;
          --vacuum-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --vacuum-card-panel-max-height: ${Math.max(modePanelMaxHeight, roomPanelMaxHeight)}px;
          align-content: start;
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          display: grid;
          gap: ${styles.card.gap};
          height: fit-content !important;
          min-width: 0;
          overflow: hidden;
          padding: ${styles.card.padding};
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        ha-card::before {
          background: ${isTintedState
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`
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
          opacity: ${isTintedState ? "1" : "0"};
          pointer-events: none;
          position: absolute;
          transition: opacity 180ms ease;
          z-index: 0;
        }

        .vacuum-card {
          color: var(--primary-text-color);
          display: grid;
          gap: ${styles.card.gap};
          min-width: 0;
          position: relative;
          z-index: 1;
        }

        .vacuum-card--entering {
          animation: vacuum-card-fade-up var(--vacuum-card-content-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .vacuum-card__icon-button,
        .vacuum-card__control,
        .vacuum-card__preset {
          transform: translateZ(0);
          transform-origin: center;
          will-change: transform;
        }

        :is(.vacuum-card__icon-button, .vacuum-card__control, .vacuum-card__preset):active:not(:disabled),
        :is(.vacuum-card__icon-button, .vacuum-card__control, .vacuum-card__preset).is-pressing:not(:disabled) {
          animation: vacuum-card-button-bounce var(--vacuum-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .vacuum-card__header {
          align-items: start;
          display: grid;
          gap: ${styles.card.gap};
          grid-template-columns: auto minmax(0, 1fr);
          min-width: 0;
          position: relative;
        }

        .vacuum-card--compact .vacuum-card__header {
          grid-template-columns: auto minmax(0, 1fr);
          text-align: start;
        }

        .vacuum-card--compact .vacuum-card__copy {
          justify-items: start;
          min-width: 0;
        }

        .vacuum-card--compact .vacuum-card__chips {
          justify-content: flex-start;
        }

        .vacuum-card__icon-button {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${isTintedState
            ? `color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent))`
            : "color-mix(in srgb, var(--primary-text-color) 6%, transparent)"};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.16);
          color: ${iconGlyphColor};
          cursor: pointer;
          display: inline-flex;
          height: ${styles.icon.size};
          justify-content: center;
          line-height: 0;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, color 180ms ease, transform 180ms cubic-bezier(0.22, 0.84, 0.26, 1);
          width: ${styles.icon.size};
        }

        .vacuum-card__icon-button ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.46);
          color: ${iconGlyphColor};
          display: inline-flex;
          height: calc(${styles.icon.size} * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          backface-visibility: hidden;
          transform: translate3d(-50%, -50%, 0);
          transform-origin: 50% 70%;
          width: calc(${styles.icon.size} * 0.46);
          will-change: transform;
        }

        .vacuum-card__icon-button--active-motion ha-icon {
          animation: vacuum-card-icon-sweep 1.45s ease-in-out infinite;
          transform-origin: 50% 70%;
        }

        .vacuum-card__picture {
          border-radius: inherit;
          height: 100%;
          inset: 0;
          object-fit: cover;
          pointer-events: none;
          position: absolute;
          width: 100%;
        }

        .vacuum-card__unavailable-badge {
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

        .vacuum-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          color:#fff;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .vacuum-card__copy {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .vacuum-card__headline {
          align-items: center;
          display: grid;
          gap: 8px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .vacuum-card__headline-fill {
          min-width: 0;
        }

        .vacuum-card__header-meta {
          align-items: center;
          display: flex;
          flex-shrink: 0;
          justify-content: flex-end;
        }

        .vacuum-card__title {
          font-size: ${styles.title_size};
          font-weight: 700;
          letter-spacing: -0.01em;
          line-height: 1.15;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .vacuum-card__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          min-width: 0;
        }

        .vacuum-card__chip {
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

        .vacuum-card__chip--state {
          color: var(--primary-text-color);
        }

        .vacuum-card__chip--battery {
          background: color-mix(in srgb, ${batteryChipColor} 16%, color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border-color: color-mix(in srgb, ${batteryChipColor} 38%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          color: ${batteryChipColor};
          flex-shrink: 0;
          gap: 6px;
        }

        .vacuum-card__chip--battery ha-icon {
          --mdc-icon-size: 13px;
          display: inline-flex;
          height: 13px;
          width: 13px;
        }

        .vacuum-card__controls-group {
          display: grid;
          gap: 0;
          min-width: 0;
        }

        .vacuum-card__controls-inner {
          display: grid;
          gap: 0;
          min-width: 0;
        }

        .vacuum-card__controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }

        .vacuum-card--compact .vacuum-card__controls {
          justify-content: center;
        }

        .vacuum-card--dense {
          gap: 8px;
        }

        .vacuum-card--dense .vacuum-card__header {
          align-items: center;
          gap: 10px;
        }

        .vacuum-card--dense .vacuum-card__icon-button {
          height: 40px;
          width: 40px;
        }

        .vacuum-card--dense .vacuum-card__icon-button ha-icon {
          --mdc-icon-size: 18px;
          height: 18px;
          width: 18px;
        }

        .vacuum-card--dense .vacuum-card__headline {
          grid-template-columns: minmax(0, 1fr);
        }

        .vacuum-card--dense .vacuum-card__title {
          font-size: 13px;
          letter-spacing: -0.015em;
        }

        .vacuum-card--dense .vacuum-card__chips {
          gap: 6px;
        }

        .vacuum-card--dense .vacuum-card__controls-group,
        .vacuum-card--dense .vacuum-card__controls-inner {
          min-height: 0;
        }

        .vacuum-card--dense .vacuum-card__controls {
          display: flex;
          flex-wrap: nowrap;
          gap: 10px;
          justify-content: center;
          padding-block: 0;
          width: 100%;
        }

        .vacuum-card--dense .vacuum-card__control {
          flex: 0 0 auto;
          height: 36px;
          min-width: 36px;
          width: 36px;
        }

        .vacuum-card--dense .vacuum-card__control ha-icon {
          --mdc-icon-size: 16px;
          height: 16px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 16px;
        }

        .vacuum-card--dense .vacuum-card__chip {
          font-size: 10px;
          height: 20px;
          padding: 0 7px;
        }

        ha-card:has(.vacuum-card--dense) {
          gap: 8px;
          padding: 12px;
        }

        .vacuum-card__control {
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
          place-content: center;
          place-items: center;
          position: relative;
          width: ${styles.control.size};
        }

        .vacuum-card__control--active {
          background: color-mix(in srgb, ${accentColor} 18%, ${styles.control.accent_background});
          border-color: color-mix(in srgb, ${accentColor} 48%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: ${styles.control.accent_color};
        }

        .vacuum-card__control ha-icon {
          --mdc-icon-size: calc(${styles.control.size} * 0.46);
          align-items: center;
          display: inline-flex;
          flex: 0 0 auto;
          height: calc(${styles.control.size} * 0.46);
          justify-content: center;
          line-height: 0;
          margin: 0;
          padding: 0;
          pointer-events: none;
          width: calc(${styles.control.size} * 0.46);
        }

        .vacuum-card__control ha-svg-icon {
          align-items: center;
          display: inline-flex;
          height: 100%;
          justify-content: center;
          line-height: 0;
          width: 100%;
        }

        .vacuum-card__control ha-icon svg,
        .vacuum-card__control ha-svg-icon svg {
          display: block;
          margin: 0 auto;
        }

        .vacuum-card__presets {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          min-width: 0;
        }

        .vacuum-card__room-panel {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          margin-top: 8px;
          min-width: 0;
        }

        .vacuum-card__mode-toggle {
          color: var(--primary-text-color);
        }

        .vacuum-card__mode-toggle--active {
          background: color-mix(in srgb, ${accentColor} 18%, color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border-color: color-mix(in srgb, ${accentColor} 42%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: var(--primary-text-color);
        }

        .vacuum-card__mode-toggle ha-icon {
          --mdc-icon-size: calc(${styles.control.size} * 0.42);
        }

        .vacuum-card__preset {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          height: ${styles.chip_height};
          justify-content: center;
          margin: 0;
          max-width: 100%;
          min-width: 0;
          padding: ${styles.chip_padding};
          white-space: nowrap;
        }

        .vacuum-card__preset--active {
          background: color-mix(in srgb, ${accentColor} 18%, color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border-color: color-mix(in srgb, ${accentColor} 42%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: var(--primary-text-color);
        }

        .vacuum-card__mode-panel {
          margin-top: 8px;
        }

        .vacuum-card__panels {
          display: grid;
          min-width: 0;
        }

        .vacuum-card__panel-shell {
          backface-visibility: hidden;
          min-width: 0;
          overflow: hidden;
          transform-origin: top center;
          will-change: max-height, opacity;
          width: 100%;
        }

        .vacuum-card__panel-inner {
          backface-visibility: hidden;
          display: grid;
          min-width: 0;
          padding: 4px;
          will-change: opacity, transform;
        }

        .vacuum-card__panel-shell--entering {
          animation: vacuum-card-panel-shell-in var(--vacuum-card-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .vacuum-card__panel-shell--entering .vacuum-card__panel-inner {
          animation: vacuum-card-panel-content-in var(--vacuum-card-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .vacuum-card__panel-shell--leaving {
          animation: vacuum-card-panel-shell-out var(--vacuum-card-panel-duration) cubic-bezier(0.36, 0, 0.2, 1) both;
          pointer-events: none;
        }

        .vacuum-card__panel-shell--leaving .vacuum-card__panel-inner {
          animation: vacuum-card-panel-content-out var(--vacuum-card-panel-duration) cubic-bezier(0.36, 0, 0.2, 1) both;
        }

        @keyframes vacuum-card-button-bounce {
          0% { transform: scale(1); }
          38% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }

        @keyframes vacuum-card-icon-sweep {
          0%, 100% {
            transform: translate(-50%, -50%) rotate(-7deg) translateX(-2px);
          }
          50% {
            transform: translate(-50%, -50%) rotate(7deg) translateX(2px);
          }
        }

        @keyframes vacuum-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes vacuum-card-panel-shell-in {
          0% {
            max-height: 0;
            opacity: 0;
          }
          100% {
            max-height: var(--vacuum-card-panel-max-height);
            opacity: 1;
          }
        }

        @keyframes vacuum-card-panel-shell-out {
          0% {
            max-height: var(--vacuum-card-panel-max-height);
            opacity: 1;
          }
          100% {
            max-height: 0;
            opacity: 0;
          }
        }

        @keyframes vacuum-card-panel-content-in {
          0% {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes vacuum-card-panel-content-out {
          0% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-6px) scaleY(0.96);
          }
        }

        ${animations.enabled ? "" : `
        ha-card,
        ha-card::before,
        .vacuum-card,
        .vacuum-card * {
          animation: none !important;
          transition: none !important;
        }
        `}

        @media (prefers-reduced-motion: reduce) {
          .vacuum-card__icon-button--active-motion ha-icon {
            animation: none !important;
          }
        }

        .vacuum-card--compact .vacuum-card__presets {
          justify-content: center;
        }

        @media (max-width: 480px) {
          .vacuum-card__controls {
            gap: 8px;
          }

          .vacuum-card__header {
            gap: 10px;
            grid-template-columns: auto minmax(0, 1fr);
          }

          .vacuum-card__header-meta {
            justify-content: flex-end;
          }

          .vacuum-card__chip--battery {
            font-size: max(10px, calc(${styles.chip_font_size} - 1px));
            gap: 5px;
            height: max(22px, calc(${styles.chip_height} - 2px));
            padding: 0 8px;
          }

          .vacuum-card__chip--battery ha-icon {
            --mdc-icon-size: 12px;
            height: 12px;
            width: 12px;
          }
        }
      </style>

      <ha-card ${canRunBodyCardTap ? 'data-vacuum-action="body_tap"' : ""}>
        <div class="vacuum-card ${isCompactLayout ? "vacuum-card--compact" : ""} ${denseCompact ? "vacuum-card--dense" : ""} ${shouldAnimateEntrance ? "vacuum-card--entering" : ""}">
          <div class="vacuum-card__header">
            <button
              class="vacuum-card__icon-button ${shouldAnimateActiveIcon ? "vacuum-card__icon-button--active-motion" : ""}"
              type="button"
              ${canRunIconCardTap ? 'data-vacuum-action="icon_tap"' : ""}
              aria-label="${escapeHtml(iconButtonLabel)}"
            >
              ${entityPicture
                ? `<img class="vacuum-card__picture" src="${escapeHtml(entityPicture)}" alt="" loading="lazy" />`
                : `<ha-icon icon="${escapeHtml(icon)}"></ha-icon>`}
              ${showUnavailableBadge ? `<span class="vacuum-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${
              showCopyBlock
                ? `
                  <div class="vacuum-card__copy">
                    <div class="vacuum-card__headline">
                      ${showTitle ? `<div class="vacuum-card__title">${escapeHtml(title)}</div>` : `<span class="vacuum-card__headline-fill"></span>`}
                      ${headerBatteryMarkup ? `<div class="vacuum-card__header-meta">${headerBatteryMarkup}</div>` : ""}
                    </div>
                    ${chips.length ? `<div class="vacuum-card__chips">${chips.join("")}</div>` : ""}
                  </div>
                `
                : ""
            }
          </div>

          ${
            visibleControls.length || visibleModeDescriptors.length
              ? `
                <div class="vacuum-card__controls-group">
                  <div class="vacuum-card__controls-inner">
                    <div class="vacuum-card__controls">
                      ${visibleControls
                        .map(control => `
                          <button
                              class="vacuum-card__control ${control.active ? "vacuum-card__control--active" : ""}"
                              type="button"
                              data-vacuum-action="${escapeHtml(control.action)}"
                              aria-label="${escapeHtml(control.label)}"
                            >
                              <ha-icon icon="${escapeHtml(control.icon)}"></ha-icon>
                            </button>
                          `)
                        .join("")}
                      ${visibleModeDescriptors
                        .map(mode => `
                          <button
                            class="vacuum-card__control vacuum-card__mode-toggle ${activeModeDescriptor?.kind === mode.kind ? "vacuum-card__mode-toggle--active vacuum-card__control--active" : ""}"
                            type="button"
                            data-vacuum-action="toggle-mode-panel"
                            data-mode-kind="${escapeHtml(mode.kind)}"
                            aria-label="${escapeHtml(mode.label)}"
                          >
                            <ha-icon icon="${mode.kind === "mop" ? "mdi:waves" : "mdi:fan"}"></ha-icon>
                          </button>
                        `)
                        .join("")}
                    </div>
                  </div>
                </div>
              `
              : ""
          }

          <div class="vacuum-card__panels">
            ${panelShellMarkup}
          </div>

        </div>
      </ha-card>
    `;

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(clamp(Math.round(animations.panelDuration * 0.9), 180, 900) + 120);
    }
  }
}
  _lazyNodaliaVacuumCard = NodaliaVacuumCard;
  return NodaliaVacuumCard;
}
