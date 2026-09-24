// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  MEDIA_PLAYER_FEATURE_BROWSE_MEDIA,
  MUSIC_ASSISTANT_BROWSER_EXCLUDE_PATTERNS,
  MUSIC_ASSISTANT_DIRECTORY_ICON_RULES,
} from "./media-player-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./media-player-config";
import {
  getArtworkVisuals,
  MediaPlayerArtworkController,
  sampleArtworkPalette,
} from "./media-player-artwork";
import {
  interpolatePlaybackProgress,
  progressPercentFromClientX,
  seekPositionFromPercent,
  supportsMediaSeek,
} from "./media-player-progress";
import { presentationGridOptions, resolvePresentationMode } from "./media-player-layout";
import { clamp, escapeHtml, fireEvent, isObject } from "./media-player-runtime";
import {
  getStubEntityId,
  getStubFriendlyName,
  compactConfig,
  formatEditorJsonValue,
  parseEditorJsonObject,
  normalizePowerActionConfig,
  getByPath,
  arrayFromCsv,
  escapeSelectorValue,
  resolveEditorColorValue,
  resolveColorInContext,
  parseRgbColor,
  getRelativeLuminance,
  formatEditorHexChannel,
  formatEditorColorFromHex,
  getEditorColorModel,
  getEditorColorFallbackValue,
  moveItem,
  getRangeValueFromClientX,
  getSliderDragGeometry,
  getRangeValueFromGeometry,
  formatDuration,
  normalizeTextKey,
  getRenderSignatureRuntime,
  sanitizeMediaArtworkUrl,
  appendQueryParam,
  isUnavailableState,
} from "./media-player-helpers";

let _lazyNodaliaMediaPlayer;
export function loadNodaliaMediaPlayer() {
  if (_lazyNodaliaMediaPlayer) {
    return _lazyNodaliaMediaPlayer;
  }
class NodaliaMediaPlayer extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    const entityId = getStubEntityId(hass, ["media_player"], entities, entitiesFallback);
    return {
      players: [
        {
          entity: entityId || "media_player.spotify",
          label: entityId ? getStubFriendlyName(hass, entityId) : "Spotify",
        },
      ],
      layout: {
        mode: "standard",
        fixed: false,
        reserve_space: false,
      },
    };
  }

  static getEntitySuggestion(hass, entityId) {
    const player = {
      entity: entityId,
      label: getStubFriendlyName(hass, entityId),
    };
    const variants = [
      { label: "Media Player — Standard", mode: "standard" },
      { label: "Media Player — Square", mode: "square" },
      { label: "Media Player — Compact", mode: "compact" },
      { label: "Media Player — Horizontal", mode: "chip" },
      { label: "Media Player — Artwork", mode: "artwork" },
    ];
    return variants
      .map(variant => window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, {
        domains: ["media_player"],
        label: variant.label,
        buildConfig: (_hass, selectedEntityId) => ({
          players: [{ ...player, entity: selectedEntityId }],
          layout: { mode: variant.mode, fixed: false, reserve_space: false },
        }),
      }))
      .filter(Boolean);
  }

  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._mediaBrowserState = null;
    this._mediaBrowserScrollPositions = new Map();
    this._mediaBrowserRequestToken = 0;
    this._activePlayerIndex = 0;
    this._activePlayerEntity = "";
    this._mediaTicker = null;
    this._lastRenderSignature = "";
    this._draftVolume = new Map();
    this._draftVolumeTimers = new Map();
    this._activeSliderDrag = null;
    this._pendingRenderAfterDrag = false;
    this._skipNextSliderChange = null;
    this._dragFrame = 0;
    this._pendingDragUpdate = null;
    this._dragWindowListenersAttached = false;
    this._volumeStepFallback = new Set();
    this._tvSourcePickerEntity = null;
    this._tvVolumePickerEntity = null;
    this._tvPanelScrollPositions = new Map();
    this._tvSourcePanelAnimatingEntity = null;
    this._tvVolumePanelAnimatingEntity = null;
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._readyArtworkUrls = new Set();
    this._failedArtworkUrls = new Set();
    this._pendingArtworkPreloads = new Map();
    this._displayArtworkByEntity = new Map();
    this._artworkController = new MediaPlayerArtworkController();
    this._artworkStageEl = null;
    this._resolvedLayoutMode = "";
    this._presentationEntityId = "";
    this._layoutObserver = null;
    this._activeProgressDrag = null;
    this._idleSlideshowUrl = "";
    this._onResize = () => {
      if (this._activeSliderDrag || this._activeProgressDrag) {
        this._pendingRenderAfterDrag = true;
        return;
      }
      this._syncPresentationMode();
    };
    this._onWindowKeyDown = event => {
      if (event.key === "Escape" && this._mediaBrowserState) {
        event.preventDefault();
        this._closeMediaBrowser();
      }
    };
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
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowChange);
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown);
    this.shadowRoot.addEventListener("mousedown", this._onShadowMouseDown);
    if (!(typeof window !== "undefined" && "PointerEvent" in window)) {
      this.shadowRoot.addEventListener("touchstart", this._onShadowTouchStart, { passive: false });
    }
    }

  connectedCallback() {
    window.addEventListener("resize", this._onResize);
    window.addEventListener("keydown", this._onWindowKeyDown);
    document.addEventListener("visibilitychange", this._onVisibilityChange);
    this._observeLayout();
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
    this._render();
  }

  disconnectedCallback() {
    window.NodaliaUtils?.releaseModalFocus?.(this);
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("keydown", this._onWindowKeyDown);
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    this._detachWindowDragListeners();
    if (this._dragFrame) {
      window.cancelAnimationFrame(this._dragFrame);
      this._dragFrame = 0;
    }
    this._pendingDragUpdate = null;
    if (this._mediaTicker) {
      window.clearInterval(this._mediaTicker);
      this._mediaTicker = null;
    }
    this._draftVolumeTimers.forEach(timerId => window.clearTimeout(timerId));
    this._draftVolumeTimers.clear();
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    this._mediaBrowserRequestToken += 1;
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
    this._layoutObserver?.disconnect();
    this._layoutObserver = null;
    this._artworkController?.detach();
    this._artworkStageEl = null;
    this._activeProgressDrag = null;
    window.NodaliaUtils?.clearDeferTimers?.(this);
  }

  setConfig(config) {
    this._config = normalizeConfig(config);
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    if (!this.isConnected) {
      return;
    }
    this._render();
  }

  set hass(hass) {
    const previousHass = this._hass;
    this._hass = hass;

    if (!this.isConnected) {
      return;
    }

    if (!this._activeSliderDrag && !this._activeProgressDrag) {
      this._syncVolumeControlsFromHass(hass);
    }

    const nextSignature = this._getRenderSignature(hass);
    if (previousHass && nextSignature === this._lastRenderSignature) {
      return;
    }

    this._lastRenderSignature = nextSignature;

    if (this._activeSliderDrag || this._activeProgressDrag) {
      this._pendingRenderAfterDrag = true;
      return;
    }

    this._render();
  }

  getCardSize() {
    const mode = this._getPresentationMode();
    if (mode === "chip") {
      return 1;
    }
    if (mode === "compact") {
      return 2;
    }
    return 3;
  }

  getGridOptions() {
    return presentationGridOptions(this._getPresentationMode());
  }

  _observeLayout() {
    if (this._layoutObserver || typeof ResizeObserver === "undefined") {
      return;
    }
    this._layoutObserver = new ResizeObserver(() => {
      if (!this.isConnected || this._activeSliderDrag || this._activeProgressDrag) {
        return;
      }
      this._syncPresentationMode();
    });
    this._layoutObserver.observe(this);
  }

  _getActivePlayerContext() {
    const players = this._getVisiblePlayers();
    const player = players[this._resolveActivePlayerIndex(players)] || players[0] || this._getConfiguredPlayers()[0];
    if (!player?.entity) {
      return null;
    }
    return {
      player,
      state: this._hass?.states?.[player.entity] || null,
    };
  }

  _getPresentationMode() {
    const context = this._getActivePlayerContext();
    const entityId = String(context?.player?.entity || "");
    if (entityId !== this._presentationEntityId) {
      this._presentationEntityId = entityId;
      this._resolvedLayoutMode = "";
    }
    const isTvPlayer = context
      ? this._getPlayerDeviceType(context.player, context.state) === "tv"
      : false;
    const isIdleLayout = Boolean(
      context && this._shouldUseIdleLayout(context.player, context.state),
    );
    const artworkUrl = context
      ? this._getPlayerArtwork(context.player, context.state)
      : "";
    const preferSquareTiles = Boolean(!isTvPlayer && !isIdleLayout && artworkUrl);
    return resolvePresentationMode(
      this._config?.layout?.mode,
      {
        width: this.clientWidth,
        height: preferSquareTiles ? this.clientHeight : 0,
      },
      this._resolvedLayoutMode,
      { preferSquareTiles },
    );
  }

  _syncPresentationMode() {
    const next = this._getPresentationMode();
    if (next === this._resolvedLayoutMode) {
      return false;
    }
    this._resolvedLayoutMode = next;
    this.setAttribute("data-presentation", next);
    if (this.isConnected && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
    return true;
  }

  _getTrackedEntities() {
    const configuredPlayers = Array.isArray(this._config?.players)
      ? this._config.players.map(player => player?.entity).filter(Boolean)
      : [];

    if (configuredPlayers.length) {
      return [...new Set(configuredPlayers)];
    }

    return this._config?.entity ? [this._config.entity] : [];
  }

  _getRenderSignature(hass = this._hass) {
    const states = hass?.states || {};
    const entities = this._getTrackedEntities();
    const runtime = getRenderSignatureRuntime();

    return entities
      .map(entityId => {
        const state = states[entityId];
        if (!state) {
          return runtime.joinParts([{ values: [entityId, "missing"] }], "", "::");
        }

        const attrs = state.attributes || {};
        return runtime.joinParts([
          {
            values: [
              entityId,
              state.state || "",
              attrs.friendly_name || "",
              attrs.entity_picture || "",
              attrs.media_title || "",
              attrs.media_artist || "",
              attrs.media_series_title || "",
              attrs.media_album_name || "",
              attrs.app_name || "",
              attrs.source || "",
              attrs.media_channel || "",
              attrs.media_duration ?? "",
              attrs.supported_features ?? "",
              Array.isArray(attrs.source_list) ? attrs.source_list.join("|") : "",
            ],
          },
        ], "", "::");
      })
      .join("||");
  }

  _isInEditMode() {
    const homeAssistantRoot = document.querySelector("body > home-assistant");

    const inEditDashboardMode = this.closest("hui-card-edit-mode") !== null;
    const inPreviewMode = this.closest("hui-card-preview") !== null || this.closest(".card > .preview") !== null;
    const inEditCardMode = Boolean(
      homeAssistantRoot?.shadowRoot
        ?.querySelector("hui-dialog-edit-card")
        ?.shadowRoot?.querySelector("ha-dialog"),
    );

    return inEditDashboardMode || inPreviewMode || inEditCardMode;
  }

  _shouldHideForScreen() {
    if (this._isInEditMode()) {
      return false;
    }

    if (this._config.layout.show_desktop) {
      return false;
    }

    return window.innerWidth > Number(this._config.layout.mobile_breakpoint || 1279);
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
      panelDuration: clamp(
        Number(configuredAnimations.panel_duration) || DEFAULT_CONFIG.animations.panel_duration,
        120,
        2400,
      ),
      browserDuration: clamp(
        Number(configuredAnimations.browser_duration) || DEFAULT_CONFIG.animations.browser_duration,
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

  _isLightThemeSurface() {
    const textColor = parseRgbColor(resolveColorInContext(this, "var(--primary-text-color)"));
    const backgroundColor = parseRgbColor(resolveColorInContext(this, "var(--ha-card-background, var(--card-background-color, #ffffff))"));

    const textLuminance = getRelativeLuminance(textColor);
    if (textLuminance !== null) {
      return textLuminance < 0.36;
    }

    const backgroundLuminance = getRelativeLuminance(backgroundColor);
    if (backgroundLuminance !== null) {
      return backgroundLuminance > 0.62;
    }

    return false;
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

  _isArtworkUrlReady(url) {
    return Boolean(url) && this._readyArtworkUrls.has(url);
  }

  _isArtworkUrlFailed(url) {
    return Boolean(url) && this._failedArtworkUrls.has(url);
  }

  _preloadArtworkUrl(url, onSettled = null) {
    if (!url) {
      return Promise.resolve(false);
    }

    if (this._isArtworkUrlReady(url)) {
      onSettled?.(true);
      return Promise.resolve(true);
    }

    if (this._isArtworkUrlFailed(url)) {
      onSettled?.(false);
      return Promise.resolve(false);
    }

    const existing = this._pendingArtworkPreloads.get(url);
    if (existing) {
      if (onSettled) {
        existing.then(onSettled);
      }
      return existing;
    }

    if (typeof Image === "undefined") {
      this._readyArtworkUrls.add(url);
      onSettled?.(true);
      return Promise.resolve(true);
    }

    const preloadPromise = new Promise(resolve => {
      const image = new Image();
      image.decoding = "async";

      const settle = loaded => {
        this._pendingArtworkPreloads.delete(url);
        if (loaded) {
          this._readyArtworkUrls.add(url);
          this._failedArtworkUrls.delete(url);
        } else {
          this._failedArtworkUrls.add(url);
        }
        resolve(loaded);
        onSettled?.(loaded);
      };

      image.onload = () => settle(true);
      image.onerror = () => settle(false);
      image.src = url;
    });

    this._pendingArtworkPreloads.set(url, preloadPromise);
    return preloadPromise;
  }

  _ensureArtworkReady(entityId, url, { rerenderOnReady = false } = {}) {
    if (!entityId) {
      return !url;
    }

    if (!url) {
      this._displayArtworkByEntity.delete(entityId);
      return true;
    }

    if (this._isArtworkUrlReady(url)) {
      this._displayArtworkByEntity.set(entityId, url);
      return true;
    }

    if (this._isArtworkUrlFailed(url)) {
      this._displayArtworkByEntity.delete(entityId);
      return true;
    }

    this._preloadArtworkUrl(url, () => {
      const currentPlayer = this._findPlayerConfig(entityId) || { entity: entityId };
      const currentState = this._hass?.states?.[entityId];
      const currentArtwork = currentState ? this._getPlayerArtwork(currentPlayer, currentState) : null;
      if (currentArtwork !== url) {
        return;
      }

      if (this._isArtworkUrlReady(url)) {
        this._displayArtworkByEntity.set(entityId, url);
      } else {
        this._displayArtworkByEntity.delete(entityId);
      }

      if (rerenderOnReady) {
        const existingStage = this.shadowRoot?.querySelector("[data-media-art-stage]");
        if (existingStage instanceof HTMLElement && this._config?.album_cover_background !== false) {
          this._activeArtworkUrl = url;
          this._syncArtworkLayer(existingStage, {
            artworkUrl: url,
            idle: false,
            entityId,
            hasAlbumBackground: true,
          });
          return;
        }
        this._lastRenderSignature = "";
        this._render();
      }
    });

    return false;
  }

  _getRenderableArtwork(entityId, desiredArtworkUrl) {
    if (!entityId || !desiredArtworkUrl) {
      if (entityId) {
        this._displayArtworkByEntity.delete(entityId);
      }
      return "";
    }

    if (this._isArtworkUrlReady(desiredArtworkUrl)) {
      this._displayArtworkByEntity.set(entityId, desiredArtworkUrl);
      return desiredArtworkUrl;
    }

    if (this._isArtworkUrlFailed(desiredArtworkUrl)) {
      this._displayArtworkByEntity.delete(entityId);
      return "";
    }

    return this._displayArtworkByEntity.get(entityId) || "";
  }

  _resolveMediaUrl(value, options = {}) {
    const baseUrl = sanitizeMediaArtworkUrl(value, this._hass);
    if (!baseUrl) {
      return "";
    }
    return appendQueryParam(baseUrl, "nodalia_ts", options.cacheToken);
  }

  _getArtworkCacheToken(state) {
    if (!state) {
      return "";
    }

    return [
      String(state.last_updated || state.last_changed || ""),
      String(state.attributes?.entity_picture || state.attributes?.entity_picture_local || ""),
      String(state.attributes?.media_title || ""),
      String(state.attributes?.media_artist || ""),
      String(state.attributes?.media_album_name || ""),
      String(state.attributes?.app_name || ""),
    ].filter(Boolean).join("|");
  }

  _getConfiguredPlayers() {
    return Array.isArray(this._config?.players) ? this._config.players : [];
  }

  _resolveActivePlayerIndex(players) {
    if (!Array.isArray(players) || players.length === 0) {
      this._activePlayerIndex = 0;
      return 0;
    }

    const entityIndex = this._activePlayerEntity
      ? players.findIndex(player => player?.entity === this._activePlayerEntity)
      : -1;
    const nextIndex = entityIndex >= 0
      ? entityIndex
      : clamp(this._activePlayerIndex ?? 0, 0, players.length - 1);

    this._activePlayerIndex = nextIndex;
    this._activePlayerEntity = String(players[nextIndex]?.entity || "");
    return nextIndex;
  }

  _findPlayerConfig(entityId) {
    return this._getConfiguredPlayers().find(player => player.entity === entityId) || null;
  }

  _shouldShowOnCurrentScreen() {
    if (this._isInEditMode()) {
      return true;
    }

    const isDesktop = window.innerWidth > Number(this._config.layout.mobile_breakpoint || 1279);
    return !isDesktop || this._config.layout.show_desktop;
  }

  _getVisiblePlayers() {
    if (this._config.show === false || !this._shouldShowOnCurrentScreen()) {
      return [];
    }

    return this._getConfiguredPlayers().filter(player => {
      if (!player?.entity || player.show === false) {
        return false;
      }

      const state = this._hass?.states?.[player.entity];
      if (!state) {
        return false;
      }

      if (this._config.show === true || player.show === true || this._isInEditMode()) {
        return true;
      }

      const visibleStates = Array.isArray(player.show_states) && player.show_states.length > 0
        ? player.show_states
        : ["playing", "paused"];

      return visibleStates.includes(state.state);
    });
  }

  _getReservedHeight(showPlayer) {
    if (!this._config.layout.reserve_space) {
      return "0px";
    }

    if (showPlayer) {
      return this._config.layout.reserve_height || this._config.styles.player.min_height;
    }

    return "0px";
  }

  _getPlayerLabel(player, state) {
    return player.label || player.name || state.attributes.friendly_name || player.entity;
  }

  _isAppleTvPlayer(player, state) {
    const candidates = [
      player?.entity,
      player?.label,
      player?.name,
      player?.title,
      state?.attributes?.friendly_name,
      state?.attributes?.app_name,
      state?.attributes?.source,
      state?.attributes?.device_class,
    ];

    return candidates.some(candidate => normalizeTextKey(candidate).includes("apple tv"));
  }

  _getPlayerDeviceType(player, state) {
    if (player?.tv_mode === true) {
      return "tv";
    }

    if (player?.tv_mode === false) {
      return "music";
    }

    if (player?.device_type === "music" || player?.device_type === "tv") {
      return player.device_type;
    }

    const deviceClass = normalizeTextKey(state?.attributes?.device_class);
    if (["tv", "receiver", "set_top_box"].includes(deviceClass)) {
      return "tv";
    }

    const haystack = normalizeTextKey([
      player?.entity,
      player?.label,
      player?.name,
      player?.title,
      player?.icon,
      state?.attributes?.friendly_name,
      state?.attributes?.app_name,
      state?.attributes?.source,
      state?.attributes?.media_content_type,
    ].filter(Boolean).join(" "));

    if (
      this._isAppleTvPlayer(player, state) ||
      haystack.includes("google tv") ||
      haystack.includes("android tv") ||
      haystack.includes("chromecast") ||
      haystack.includes("television") ||
      haystack.includes("televisor") ||
      /\btv\b/.test(haystack)
    ) {
      return "tv";
    }

    return "music";
  }

  _getPlayerFallbackIcon(player, state, deviceType) {
    if (player?.icon) {
      return player.icon;
    }

    if (deviceType === "tv") {
      return this._isAppleTvPlayer(player, state) ? "mdi:apple" : "mdi:television";
    }

    return "mdi:music";
  }

  _getPlayerTitle(player, state) {
    if (player.title) {
      return player.title;
    }

    return state.attributes.media_title || state.attributes.friendly_name || player.entity;
  }

  _getTvContentTitle(player, state) {
    if (player.title) {
      return player.title;
    }

    return (
      state?.attributes?.media_title ||
      state?.attributes?.media_series_title ||
      state?.attributes?.media_channel ||
      ""
    );
  }

  _getPlayerSubtitle(player, state) {
    if (player.subtitle) {
      return player.subtitle;
    }

    const fallbackState = this._config?.show_state === true
      ? this._getPlayerStateLabel(state.state)
      : "";

    return (
      state.attributes.media_artist ||
      state.attributes.media_series_title ||
      state.attributes.media_album_name ||
      state.attributes.app_name ||
      fallbackState
    );
  }

  _shouldShowTvArtwork(player, state) {
    const deviceType = this._getPlayerDeviceType(player, state);
    if (deviceType !== "tv") {
      return true;
    }

    const plexSignals = [
      state?.attributes?.source,
      state?.attributes?.app_name,
      state?.attributes?.media_channel,
      state?.attributes?.media_content_type,
    ]
      .filter(Boolean)
      .map(value => normalizeTextKey(value));

    return plexSignals.some(value => value.includes("plex"));
  }

  _getPlayerArtwork(player, state) {
    if (player.image) {
      return this._resolveMediaUrl(player.image);
    }

    if (!this._shouldShowTvArtwork(player, state)) {
      return null;
    }

    const artwork =
      state.attributes.entity_picture_local ||
      state.attributes.entity_picture ||
      "";

    return artwork
      ? this._resolveMediaUrl(artwork, {
          cacheToken: this._getArtworkCacheToken(state),
        })
      : null;
  }

  _getPlayerStateLabel(stateValue) {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const langCfg = this._config?.language ?? "auto";
    if (window.NodaliaI18n?.translateMediaPlayerState) {
      return window.NodaliaI18n.translateMediaPlayerState(hass, langCfg, stateValue);
    }
    switch (stateValue) {
      case "on":
        return "On";
      case "playing":
        return "Playing";
      case "paused":
        return "Paused";
      case "buffering":
        return "Buffering";
      case "idle":
        return "Idle";
      case "off":
        return "Off";
      case "standby":
        return "Standby";
      case "unavailable":
        return "Unavailable";
      default:
        return stateValue || "Unknown";
    }
  }

  _isPlayerActive(state) {
    const stateKey = normalizeTextKey(state?.state);
    return !!stateKey && !["off", "standby", "unavailable", "unknown"].includes(stateKey);
  }

  _getPlayerProgress(state) {
    if (this._activeProgressDrag?.entityId && this._hass?.states?.[this._activeProgressDrag.entityId] === state) {
      const duration = Number(state?.attributes?.media_duration || 0);
      if (!(duration > 0)) {
        return null;
      }
      const position = seekPositionFromPercent(this._activeProgressDrag.percent, duration);
      return {
        duration,
        position,
        percent: this._activeProgressDrag.percent,
      };
    }
    return interpolatePlaybackProgress(state);
  }

  _renderProgressMarkup(player, state, progress) {
    if (!progress || this._config?.progress?.show === false) {
      return "";
    }
    const canSeek = this._config?.progress?.draggable !== false && supportsMediaSeek(state);
    const percent = this._activeProgressDrag?.entityId === player.entity
      ? this._activeProgressDrag.percent
      : progress.percent;
    return `
      <div
        class="media-player__progress${canSeek ? " is-interactive" : ""}"
        data-media-progress="${canSeek ? "seek" : "readonly"}"
        data-entity="${escapeHtml(player.entity)}"
        ${canSeek
          ? `role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="${progress.duration}" aria-valuenow="${progress.position}" aria-label="${escapeHtml(this._commonAria("seek", "Seek"))}"`
          : `role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"`}
      >
        <span class="media-player__progress-fill" style="width:${percent}%"></span>
      </div>
    `;
  }

  _getPlayerSourceLabel(state) {
    const sourceLabel =
      state.attributes.source ||
      state.attributes.app_name ||
      state.attributes.media_album_name ||
      state.attributes.media_channel;

    const sourceKey = normalizeTextKey(sourceLabel);

    if (
      !sourceKey ||
      sourceKey.includes("music assistant") ||
      sourceKey === "airmusic" ||
      sourceKey.startsWith("airmusic ")
    ) {
      return null;
    }

    return sourceLabel;
  }

  _getPlayerSourceOptions(player, state) {
    if (player?.show_source_controls === false) {
      return [];
    }

    const sources = Array.isArray(state?.attributes?.source_list)
      ? state.attributes.source_list.filter(source => String(source || "").trim())
      : [];

    if (!sources.length) {
      return [];
    }

    const currentSource = String(state?.attributes?.source || "").trim();
    const orderedSources = [];

    if (currentSource && sources.includes(currentSource)) {
      orderedSources.push(currentSource);
    }

    sources.forEach(source => {
      if (!orderedSources.includes(source)) {
        orderedSources.push(source);
      }
    });

    const fallbackMaxSources = this._getPlayerDeviceType(player, state) === "tv" ? sources.length : 4;
    const maxSources = clamp(Number(player?.max_sources || fallbackMaxSources), 1, 32);
    return orderedSources.slice(0, maxSources);
  }

  _hasActiveMediaContent(state) {
    if (!state?.attributes) {
      return false;
    }

    return Boolean(
      state.attributes.media_title ||
      state.attributes.media_artist ||
      state.attributes.media_album_name ||
      state.attributes.media_series_title ||
      state.attributes.media_channel ||
      state.attributes.media_duration,
    );
  }

  _shouldUseIdleLayout(player, state) {
    if (!state) {
      return false;
    }

    if (player?.compact_when_idle === false) {
      return false;
    }

    if (this._hasActiveMediaContent(state)) {
      return false;
    }

    return ["idle", "off", "standby", "paused", "unknown", "unavailable"].includes(state.state);
  }

  _isMusicAssistantPlayer(player, state) {
    const candidates = [
      player?.entity,
      player?.label,
      player?.name,
      player?.title,
      state?.attributes?.friendly_name,
      state?.attributes?.source,
      state?.attributes?.app_name,
      state?.attributes?.media_channel,
      state?.attributes?.media_content_id,
    ];

    return candidates.some(candidate => normalizeTextKey(candidate).includes("music assistant"));
  }

  _getPlayerBrowsePath(player, state) {
    if (player?.browse_path) {
      return player.browse_path;
    }

    if (player?.media_browser_path) {
      return player.media_browser_path;
    }

    return this._isMusicAssistantPlayer(player, state) ? "/media-browser/browser" : "";
  }

  _supportsMediaBrowser(player, state) {
    if (player?.browse_path || player?.media_browser_path) {
      return true;
    }

    const supportedFeatures = Number(state?.attributes?.supported_features || 0);
    return Number.isFinite(supportedFeatures) && (supportedFeatures & MEDIA_PLAYER_FEATURE_BROWSE_MEDIA) !== 0;
  }

  _supportsVolumeControl(state) {
    return typeof state?.attributes?.volume_level === "number";
  }

  _getPlayerVolumePercent(entityId, state) {
    const draftValue = this._draftVolume.get(entityId);
    if (Number.isFinite(draftValue)) {
      return clamp(Number(draftValue), 0, 100);
    }

    return clamp(Math.round(Number(state?.attributes?.volume_level || 0) * 100), 0, 100);
  }

  _updatePlayerVolumePreview(entityId, value) {
    const nextValue = clamp(Number(value), 0, 100);
    const normalizedEntityId = escapeSelectorValue(entityId);
    const sliders = this.shadowRoot?.querySelectorAll(
      `.media-player__volume-slider[data-entity="${normalizedEntityId}"]`,
    ) || [];

    sliders.forEach(slider => {
      if (!(slider instanceof HTMLInputElement)) {
        return;
      }

      slider.value = String(nextValue);
      slider.style.setProperty("--media-volume", String(nextValue));
      slider.closest(".media-player__volume-slider-shell")?.style.setProperty("--media-volume", String(nextValue));
    });

    const volumeButtons = this.shadowRoot?.querySelectorAll(
      `.media-player__volume-button[data-entity="${normalizedEntityId}"][data-media-volume]`,
    ) || [];

    volumeButtons.forEach(button => {
      if (!(button instanceof HTMLElement)) {
        return;
      }

      button.dataset.mediaVolume = String(clamp(nextValue / 100, 0, 1));
    });
  }

  _clearDraftVolume(entityId) {
    const timerId = this._draftVolumeTimers.get(entityId);
    if (timerId) {
      window.clearTimeout(timerId);
      this._draftVolumeTimers.delete(entityId);
    }

    this._draftVolume.delete(entityId);
  }

  _syncVolumeControlsFromHass(hass = this._hass) {
    if (!this.shadowRoot?.innerHTML) {
      return;
    }

    const states = hass?.states || {};
    this._getTrackedEntities().forEach(entityId => {
      const state = states[entityId];
      if (!this._supportsVolumeControl(state)) {
        return;
      }

      const actualPercent = clamp(Math.round(Number(state.attributes?.volume_level || 0) * 100), 0, 100);
      const draftValue = this._draftVolume.get(entityId);
      if (Number.isFinite(draftValue) && Math.abs(actualPercent - draftValue) <= 2) {
        this._clearDraftVolume(entityId);
      }

      this._updatePlayerVolumePreview(entityId, this._getPlayerVolumePercent(entityId, state));
    });
  }

  _scheduleDraftVolumeClear(entityId, delay = 1400) {
    const existingTimer = this._draftVolumeTimers.get(entityId);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      this._draftVolumeTimers.delete(entityId);
    }

    const timerId = window.setTimeout(() => {
      this._clearDraftVolume(entityId);
      this._syncVolumeControlsFromHass(this._hass);
    }, delay);

    this._draftVolumeTimers.set(entityId, timerId);
  }

  async _stepPlayerVolumeToTarget(entityId, targetPercent) {
    if (!this._hass || !entityId) {
      return;
    }

    const state = this._hass.states?.[entityId];
    const currentPercent = clamp(Math.round(Number(state?.attributes?.volume_level || 0) * 100), 0, 100);
    const delta = targetPercent - currentPercent;

    if (Math.abs(delta) < 3) {
      this._scheduleDraftVolumeClear(entityId, 800);
      return;
    }

    const service = delta > 0 ? "volume_up" : "volume_down";
    const stepCount = clamp(Math.round(Math.abs(delta) / 6), 1, 12);

    for (let index = 0; index < stepCount; index += 1) {
      if (!this.isConnected) {
        break;
      }
      try {
        await this._callInternalMediaService(service, { entity_id: entityId });
      } catch (_error) {
        break;
      }

      if (!this.isConnected) {
        break;
      }

      await new Promise(resolve => window.setTimeout(resolve, 90));
    }

    this._scheduleDraftVolumeClear(entityId, 1800);
  }

  _commitPlayerVolume(entityId, value) {
    if (!this._hass || !entityId) {
      return;
    }

    const nextValue = clamp(Math.round(Number(value)), 0, 100);
    const state = this._hass.states?.[entityId];
    const player = this._findPlayerConfig(entityId) || { entity: entityId };
    const isTvPlayer = this._getPlayerDeviceType(player, state) === "tv";

    this._scheduleDraftVolumeClear(entityId);

    if (isTvPlayer) {
      this._volumeStepFallback.add(entityId);
      void this._stepPlayerVolumeToTarget(entityId, nextValue);
      return;
    }

    Promise.resolve(
      this._callInternalMediaService("volume_set", {
        entity_id: entityId,
        volume_level: clamp(nextValue / 100, 0, 1),
      }),
    ).catch(() => {
      if (!isTvPlayer) {
        return;
      }

      this._volumeStepFallback.add(entityId);
      void this._stepPlayerVolumeToTarget(entityId, nextValue);
    });
  }

  _getPlayerChips(player, state, progress, title, subtitle) {
    const chips = [];
    const seen = new Set();
    const titleKey = normalizeTextKey(title);
    const subtitleKey = normalizeTextKey(subtitle);

    const addChip = (label, tone = "default") => {
      const text = String(label || "").trim();
      if (!text) {
        return;
      }

      const key = normalizeTextKey(text);
      if (!key || key === titleKey || key === subtitleKey || seen.has(key)) {
        return;
      }

      seen.add(key);
      chips.push({ label: text, tone });
    };

    addChip(this._getPlayerSourceLabel(state), "source");

    if (progress) {
      addChip(`${formatDuration(progress.position)} / ${formatDuration(progress.duration)}`, "time");
    }

    return chips.slice(0, 4);
  }

  _getTvPlayerChips(player, state, progress, title, subtitle, sourceOptions = []) {
    const chips = [];
    const seen = new Set();
    const titleKey = normalizeTextKey(title);
    const subtitleKey = normalizeTextKey(subtitle);

    const addChip = (label, tone = "default") => {
      const text = String(label || "").trim();
      if (!text) {
        return;
      }

      const key = normalizeTextKey(text);
      if (!key || key === titleKey || key === subtitleKey || seen.has(key)) {
        return;
      }

      seen.add(key);
      chips.push({ label: text, tone });
    };

    if (progress) {
      addChip(`${formatDuration(progress.position)} / ${formatDuration(progress.duration)}`, "time");
    }

    return chips.slice(0, 3);
  }

  _syncTicker(players) {
    if (!this.isConnected) {
      if (this._mediaTicker) {
        window.clearInterval(this._mediaTicker);
        this._mediaTicker = null;
      }
      return;
    }

    if (typeof document !== "undefined" && document.hidden) {
      if (this._mediaTicker) {
        window.clearInterval(this._mediaTicker);
        this._mediaTicker = null;
      }
      return;
    }

    if (this._mediaBrowserState) {
      if (this._mediaTicker) {
        window.clearInterval(this._mediaTicker);
        this._mediaTicker = null;
      }
      return;
    }

    const shouldTick = players.some(player => {
      const state = this._hass?.states?.[player.entity];
      const progress = state ? this._getPlayerProgress(state) : null;
      return state?.state === "playing" && progress;
    });

    if (shouldTick && !this._mediaTicker) {
      this._mediaTicker = window.setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) {
          return;
        }

        if (this._activeSliderDrag || this._activeProgressDrag) {
          this._pendingRenderAfterDrag = true;
          return;
        }

        const updated = this._updateProgressTick(players);
        if (!updated && this.isConnected) {
          this._progressTickMisses = (this._progressTickMisses || 0) + 1;
          if (this._progressTickMisses >= 3) {
            this._progressTickMisses = 0;
            this._render();
          }
        } else {
          this._progressTickMisses = 0;
        }
      }, 1000);
      return;
    }

    if (!shouldTick && this._mediaTicker) {
      window.clearInterval(this._mediaTicker);
      this._mediaTicker = null;
    }
  }

  _onVisibilityChange() {
    if (typeof document !== "undefined" && document.hidden) {
      if (this._mediaTicker) {
        window.clearInterval(this._mediaTicker);
        this._mediaTicker = null;
      }
      return;
    }

    this._render();
  }

  _updateProgressTick(players) {
    if (!this.shadowRoot || !Array.isArray(players) || players.length === 0) {
      return false;
    }

    const activeIndex = this._resolveActivePlayerIndex(players);
    const player = players[activeIndex];
    if (!player?.entity) {
      return false;
    }

    const state = this._hass?.states?.[player.entity];
    const progress = state ? this._getPlayerProgress(state) : null;
    if (!progress) {
      return false;
    }

    const card = this.shadowRoot.querySelector(
      `.media-player-card[data-media-card-index="${activeIndex}"]`,
    );
    if (!card) {
      return false;
    }

    let updated = false;
    const fill = card.querySelector(".media-player__progress-fill");
    if (fill && this._activeProgressDrag?.entityId !== player.entity) {
      fill.style.width = `${progress.percent}%`;
      updated = true;
    }

    const progressNode = card.querySelector("[data-media-progress]");
    if (progressNode instanceof HTMLElement && this._activeProgressDrag?.entityId !== player.entity) {
      progressNode.setAttribute("aria-valuenow", String(progress.position));
    }

    const timeChip = card.querySelector(".media-player__chip--time");
    if (timeChip) {
      timeChip.textContent = `${formatDuration(progress.position)} / ${formatDuration(progress.duration)}`;
      updated = true;
    }

    return updated;
  }

  _callInternalMediaService(service, data = {}) {
    if (!this._hass || !service) {
      return;
    }

    return this._hass.callService("media_player", service, data);
  }

  _callService(action) {
    if (!this._hass || !action?.service) {
      return;
    }

    if (!this._isServiceAllowed(action.service)) {
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Media Player", action.service);
      return;
    }

    const [domain, service] = String(action.service).split(".");
    if (!domain || !service) {
      return;
    }

    let payload = action.service_data ?? action.data ?? {};

    if (typeof payload === "string") {
      try {
        const parsed = JSON.parse(payload);
        payload = isObject(parsed) ? parsed : {};
      } catch (_error) {
        payload = {};
      }
    }

    if (!isObject(payload)) {
      payload = {};
    }

    this._hass.callService(domain, service, payload);
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

  _runActionDefinition(action, fallbackEntityId = "") {
    if (!action || action.action === "none") {
      return;
    }

    switch (action.action) {
      case "more-info": {
        const entityId = action.entity || fallbackEntityId;
        if (entityId) {
          fireEvent(this, "hass-more-info", { entityId });
        }
        break;
      }
      case "navigate": {
        const path = window.NodaliaUtils?.sanitizeActionUrl(action.navigation_path, { allowRelative: true }) || "";
        if (path && !/^https?:\/\//i.test(path)) {
          window.history.pushState(null, "", path);
          window.dispatchEvent(new Event("location-changed"));
        }
        break;
      }
      case "url": {
        const url = window.NodaliaUtils?.sanitizeActionUrl(action.url_path || action.url, { allowRelative: true }) || "";
        if (!url) {
          return;
        }

        if (action.new_tab) {
          window.open(url, "_blank", "noopener,noreferrer");
        } else {
          window.location.assign(url);
        }
        break;
      }
      case "call-service":
        this._callService(action);
        break;
      default:
        break;
    }
  }

  _getPlayerPowerAction(player, currentState) {
    const stateKey = normalizeTextKey(currentState);

    if (["unavailable", "unknown"].includes(stateKey) && player?.power_action_unavailable?.action && player.power_action_unavailable.action !== "default") {
      return player.power_action_unavailable;
    }

    if (["off", "standby"].includes(stateKey) && player?.power_action_off?.action && player.power_action_off.action !== "default") {
      return player.power_action_off;
    }

    if (player?.power_action_on?.action && player.power_action_on.action !== "default") {
      return player.power_action_on;
    }

    return null;
  }

  _runPlayerAction(player, defaultAction = null) {
    this._runActionDefinition(player.tap_action || defaultAction, player.entity);
  }

  _handleMediaControl(control, entityId, options = {}) {
    if (!this._hass || !entityId) {
      return;
    }

    switch (control) {
      case "power-toggle": {
        const player = this._findPlayerConfig(entityId) || { entity: entityId };
        const currentState = String(options.state || this._hass?.states?.[entityId]?.state || "");
        this._tvSourcePickerEntity = null;
        this._tvVolumePickerEntity = null;
        this._tvSourcePanelAnimatingEntity = null;
        this._tvVolumePanelAnimatingEntity = null;
        const customAction = this._getPlayerPowerAction(player, currentState);

        if (customAction) {
          this._runActionDefinition(customAction, entityId);
          break;
        }

        const service = ["off", "standby", "unavailable", "unknown"].includes(normalizeTextKey(currentState))
          ? "turn_on"
          : "turn_off";
        this._callInternalMediaService(service, { entity_id: entityId });
        break;
      }
      case "play":
        this._callInternalMediaService("media_play", { entity_id: entityId });
        break;
      case "stop":
        this._callInternalMediaService("media_stop", { entity_id: entityId });
        break;
      case "previous":
        this._callInternalMediaService("media_previous_track", { entity_id: entityId });
        break;
      case "next":
        this._callInternalMediaService("media_next_track", { entity_id: entityId });
        break;
      case "play-pause":
        this._callInternalMediaService("media_play_pause", { entity_id: entityId });
        break;
      case "volume-down": {
        const currentVolume = Number.isFinite(options.volume) ? options.volume : 0;
        const nextVolumeLevel = clamp(currentVolume - 0.08, 0, 1);
        this._draftVolume.set(entityId, Math.round(nextVolumeLevel * 100));
        this._updatePlayerVolumePreview(entityId, nextVolumeLevel * 100);
        this._scheduleDraftVolumeClear(entityId);
        this._callInternalMediaService("volume_set", {
          entity_id: entityId,
          volume_level: nextVolumeLevel,
        });
        break;
      }
      case "volume-down-step":
        this._callInternalMediaService("volume_down", { entity_id: entityId });
        break;
      case "volume-up": {
        const currentVolume = Number.isFinite(options.volume) ? options.volume : 0;
        const nextVolumeLevel = clamp(currentVolume + 0.08, 0, 1);
        this._draftVolume.set(entityId, Math.round(nextVolumeLevel * 100));
        this._updatePlayerVolumePreview(entityId, nextVolumeLevel * 100);
        this._scheduleDraftVolumeClear(entityId);
        this._callInternalMediaService("volume_set", {
          entity_id: entityId,
          volume_level: nextVolumeLevel,
        });
        break;
      }
      case "volume-up-step":
        this._callInternalMediaService("volume_up", { entity_id: entityId });
        break;
      case "select-source":
        if (options.source) {
          this._callInternalMediaService("select_source", {
            entity_id: entityId,
            source: options.source,
          });
          if (this._tvSourcePickerEntity === entityId) {
            this._tvSourcePickerEntity = null;
            this._tvVolumePickerEntity = null;
            this._tvSourcePanelAnimatingEntity = null;
            this._tvVolumePanelAnimatingEntity = null;
            this._render();
          }
        }
        break;
      case "toggle-source-panel": {
        const willOpen = this._tvSourcePickerEntity !== entityId;
        this._tvVolumePickerEntity = null;
        this._tvVolumePanelAnimatingEntity = null;
        this._tvSourcePickerEntity = willOpen ? entityId : null;
        this._tvSourcePanelAnimatingEntity = willOpen ? entityId : null;
        this._render();
        break;
      }
      case "toggle-volume-panel": {
        const willOpen = this._tvVolumePickerEntity !== entityId;
        this._tvSourcePickerEntity = null;
        this._tvSourcePanelAnimatingEntity = null;
        this._tvVolumePickerEntity = willOpen ? entityId : null;
        this._tvVolumePanelAnimatingEntity = willOpen ? entityId : null;
        this._render();
        break;
      }
      case "browse-media":
        this._openMediaBrowser(entityId, options.path || "");
        break;
      default:
        break;
    }
  }

  _onShadowInput(event) {
    const slider = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.mediaSlider);

    if (!slider) {
      return;
    }

    event.stopPropagation();

    if (this._activeSliderDrag?.slider === slider) {
      return;
    }

    if (slider.dataset.mediaSlider === "volume") {
      const nextValue = clamp(Number(slider.value), 0, 100);
      this._draftVolume.set(slider.dataset.entity, nextValue);
      this._updatePlayerVolumePreview(slider.dataset.entity, nextValue);
    }
  }

  _onShadowPointerDown(event) {
    const path = event.composedPath();
    const progress = path.find(node => node instanceof HTMLElement && node.dataset?.mediaProgress);
    if (progress && !this._activeProgressDrag && !this._activeSliderDrag && (typeof event.button !== "number" || event.button === 0)) {
      this._startProgressDrag(progress, event.clientX, event, event.pointerId);
      return;
    }

    const slider = path.find(node =>
      node instanceof HTMLInputElement &&
      node.type === "range" &&
      node.dataset?.mediaSlider,
    );

    if (this._activeSliderDrag || this._activeProgressDrag || !slider || (typeof event.button === "number" && event.button !== 0)) {
      return;
    }

    this._startSliderDrag(slider, event.clientX, event, event.pointerId);
  }

  _startSliderDrag(slider, clientX, event = null, pointerId = null) {
    if (!slider) {
      return;
    }

    this._activeSliderDrag = {
      pointerId,
      slider,
      geometry: getSliderDragGeometry(slider),
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

    if (slider.dataset.mediaSlider === "volume") {
      this._draftVolume.set(slider.dataset.entity, nextValue);
      this._updatePlayerVolumePreview(slider.dataset.entity, nextValue);
    }
  }

  _queueSliderDragUpdate(slider, clientX) {
    const nextValue = getRangeValueFromGeometry(this._activeSliderDrag?.geometry, slider.value, clientX);
    slider.value = String(nextValue);

    if (slider.dataset.mediaSlider === "volume") {
      this._draftVolume.set(slider.dataset.entity, nextValue);
      this._updatePlayerVolumePreview(slider.dataset.entity, nextValue);
    }
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

    if (drag.slider.dataset.mediaSlider === "volume") {
      this._triggerHaptic("selection");
      this._draftVolume.set(drag.slider.dataset.entity, nextValue);
      this._updatePlayerVolumePreview(drag.slider.dataset.entity, nextValue);
      this._commitPlayerVolume(drag.slider.dataset.entity, nextValue);
    }

    this._activeSliderDrag = null;
    this._detachWindowDragListeners();

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
        node.dataset?.mediaSlider,
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
        node.dataset?.mediaSlider,
      );

    if (this._activeSliderDrag || !slider || !event.touches?.length) {
      return;
    }

    this._startSliderDrag(slider, event.touches[0].clientX, event);
  }

  _onWindowPointerMove(event) {
    if (this._activeProgressDrag && this._activeProgressDrag.pointerId === event.pointerId) {
      event.preventDefault();
      this._moveProgressDrag(event.clientX);
      return;
    }
    const drag = this._activeSliderDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(drag.slider, event.clientX);
  }

  _onWindowPointerUp(event) {
    if (this._activeProgressDrag && this._activeProgressDrag.pointerId === event.pointerId) {
      this._commitProgressDrag();
      return;
    }
    const drag = this._activeSliderDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    this._commitSliderDrag(event.clientX, event, event.pointerId);
  }

  _onWindowMouseMove(event) {
    if (this._activeProgressDrag) {
      event.preventDefault();
      this._moveProgressDrag(event.clientX);
      return;
    }
    if (!this._activeSliderDrag || (typeof event.buttons === "number" && (event.buttons & 1) === 0)) {
      return;
    }

    event.preventDefault();
    this._queueSliderDragUpdate(this._activeSliderDrag.slider, event.clientX);
  }

  _onWindowMouseUp(event) {
    if (this._activeProgressDrag) {
      this._commitProgressDrag();
      return;
    }
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

  _onShadowChange(event) {
    const slider = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.mediaSlider);

    if (!slider) {
      return;
    }

    event.stopPropagation();

    if (this._skipNextSliderChange === slider) {
      this._skipNextSliderChange = null;
      return;
    }

    this._triggerHaptic("selection");

    if (slider.dataset.mediaSlider === "volume") {
      const nextValue = clamp(Number(slider.value), 0, 100);
      this._draftVolume.set(slider.dataset.entity, nextValue);
      this._commitPlayerVolume(slider.dataset.entity, nextValue);
    }
  }

  _getMediaBrowserClient() {
    if (typeof this._hass?.callWS === "function") {
      return this._hass.callWS.bind(this._hass);
    }

    if (typeof this._hass?.connection?.sendMessagePromise === "function") {
      return this._hass.connection.sendMessagePromise.bind(this._hass.connection);
    }

    return null;
  }

  _normalizeMediaBrowserItem(item) {
    if (!item || typeof item !== "object") {
      return null;
    }

    return {
      title: item.title || item.name || "Elemento",
      media_class: item.media_class || "",
      media_content_id: item.media_content_id || "",
      media_content_type: item.media_content_type || "",
      can_play: item.can_play === true,
      can_expand: item.can_expand === true,
      thumbnail: item.thumbnail || item.thumbnail_url || "",
      children: Array.isArray(item.children)
        ? item.children.map(child => this._normalizeMediaBrowserItem(child)).filter(Boolean)
        : [],
    };
  }

  _normalizeMediaBrowserNode(result, entityId) {
    let node = result;

    if (node?.result && typeof node.result === "object") {
      node = node.result;
    }

    if (node && entityId && typeof node[entityId] === "object") {
      node = node[entityId];
    }

    const normalized = this._normalizeMediaBrowserItem(node);
    if (!normalized) {
      return null;
    }

    return {
      ...normalized,
      title: normalized.title || "Media",
    };
  }

  async _fetchMediaBrowserNode(entityId, mediaContentType = "", mediaContentId = "") {
    const client = this._getMediaBrowserClient();
    if (!client || !entityId) {
      return null;
    }

    const payload = {
      type: "media_player/browse_media",
      entity_id: entityId,
    };

    if (mediaContentType) {
      payload.media_content_type = mediaContentType;
    }

    if (mediaContentId) {
      payload.media_content_id = mediaContentId;
    }

    const result = await client(payload);
    return this._normalizeMediaBrowserNode(result, entityId);
  }

  _closeMediaBrowser(shouldRender = true) {
    if (!this._mediaBrowserState) {
      return;
    }

    this._mediaBrowserState = null;
    this._mediaBrowserScrollPositions.clear();
    this._mediaBrowserRequestToken += 1;

    if (shouldRender) {
      this._render();
    }
  }

  async _openMediaBrowser(entityId, fallbackPath = "") {
    if (!entityId) {
      return;
    }

    const playerConfig = this._findPlayerConfig(entityId) || { entity: entityId };
    const playerState = this._hass?.states?.[entityId];
    const isMusicAssistant = this._isMusicAssistantPlayer(playerConfig, playerState);
    const isTvPlayer = this._getPlayerDeviceType(playerConfig, playerState) === "tv";
    const token = this._mediaBrowserRequestToken + 1;
    this._mediaBrowserRequestToken = token;
    this._mediaBrowserState = {
      entityId,
      fallbackPath,
      browserLabel: isMusicAssistant ? "Music Assistant" : this._getPlayerLabel(playerConfig, playerState),
      isMusicAssistant,
      isTvPlayer,
      animateIn: true,
      loading: true,
      error: "",
      stack: [],
    };
    this._render();

    try {
      const rootNode = await this._fetchMediaBrowserNode(entityId);
      if (this._mediaBrowserRequestToken !== token || !this.isConnected) {
        return;
      }

      if (!rootNode) {
        throw new Error("Empty media browser response");
      }

      this._mediaBrowserState = {
        ...this._mediaBrowserState,
        loading: false,
        error: "",
        stack: [rootNode],
      };
      this._render();
    } catch (_error) {
      if (this._mediaBrowserRequestToken !== token || !this.isConnected) {
        return;
      }

      const safeFallbackPath = window.NodaliaUtils?.sanitizeActionUrl(fallbackPath, { allowRelative: true }) || "";
      if (safeFallbackPath && !/^https?:\/\//i.test(safeFallbackPath)) {
        this._mediaBrowserState = null;
        window.history.pushState(null, "", safeFallbackPath);
        window.dispatchEvent(new Event("location-changed"));
        return;
      }

      this._mediaBrowserState = {
        ...this._mediaBrowserState,
        loading: false,
        error: this._mediaBrowserState?.isTvPlayer
          ? "Este dispositivo no expone medios compatibles."
          : "No se pudieron cargar los medios.",
        stack: [],
      };
      this._render();
    }
  }

  async _browseMediaBrowserItem(mediaContentType, mediaContentId) {
    if (!this._mediaBrowserState?.entityId) {
      return;
    }

    const previousState = this._mediaBrowserState;
    const token = this._mediaBrowserRequestToken + 1;
    this._mediaBrowserRequestToken = token;
    this._mediaBrowserState = {
      ...previousState,
      loading: true,
      error: "",
    };
    this._render();

    try {
      const nextNode = await this._fetchMediaBrowserNode(
        previousState.entityId,
        mediaContentType,
        mediaContentId,
      );

      if (this._mediaBrowserRequestToken !== token || !this.isConnected) {
        return;
      }

      if (!nextNode) {
        throw new Error("Empty media browser response");
      }

      this._mediaBrowserState = {
        ...previousState,
        loading: false,
        error: "",
        stack: [...previousState.stack, nextNode],
      };
      this._render();
    } catch (_error) {
      if (this._mediaBrowserRequestToken !== token || !this.isConnected) {
        return;
      }

      this._mediaBrowserState = {
        ...previousState,
        loading: false,
        error: "No se pudo abrir este elemento.",
      };
      this._render();
    }
  }

  _goBackMediaBrowser() {
    if (!this._mediaBrowserState) {
      return;
    }

    if (this._mediaBrowserState.stack.length <= 1) {
      this._closeMediaBrowser();
      return;
    }

    this._mediaBrowserState = {
      ...this._mediaBrowserState,
      error: "",
      loading: false,
      stack: this._mediaBrowserState.stack.slice(0, -1),
    };
    this._render();
  }

  _playMediaBrowserItem(mediaContentType, mediaContentId) {
    const entityId = this._mediaBrowserState?.entityId;

    if (!this._hass || !entityId || !mediaContentType || !mediaContentId) {
      return;
    }

    this._callInternalMediaService("play_media", {
      entity_id: entityId,
      media_content_id: mediaContentId,
      media_content_type: mediaContentType,
    });
    this._closeMediaBrowser();
  }

  _getMusicAssistantDirectoryIcon(item) {
    const haystack = normalizeTextKey([
      item?.title,
      item?.media_content_type,
      item?.media_content_id,
    ].filter(Boolean).join(" "));

    const match = MUSIC_ASSISTANT_DIRECTORY_ICON_RULES.find(rule =>
      rule.patterns.some(pattern => haystack.includes(pattern)),
    );

    return match?.icon || "";
  }

  _getMediaBrowserDisplayTitle(value) {
    const label = typeof value === "string" ? value : value?.title;
    const fallback = String(label || "").trim();
    const lang =
      window.NodaliaI18n?.resolveLanguage?.(this._hass, this._config?.language ?? "auto") ?? "en";
    const dict = window.NodaliaI18n?.strings?.(lang)?.navigationMusicAssist || {};
    const enDict = window.NodaliaI18n?.strings?.("en")?.navigationMusicAssist || {};

    if (!fallback) {
      return dict.browseFallback || enDict.browseFallback || "Item";
    }

    if (!this._mediaBrowserState?.isMusicAssistant) {
      return fallback;
    }

    const key = normalizeTextKey(fallback);
    return dict[key] || enDict[key] || fallback;
  }

  _getMediaBrowserViewKey(state = this._mediaBrowserState) {
    const currentNode = state?.stack?.[state.stack.length - 1];
    if (!currentNode) {
      return "";
    }

    return [
      state?.entityId || "",
      currentNode.media_content_type || "",
      currentNode.media_content_id || "",
      currentNode.title || "",
    ].join("::");
  }

  _captureMediaBrowserScrollState() {
    if (!this.shadowRoot || !this._mediaBrowserState) {
      return;
    }

    const list = this.shadowRoot.querySelector(".media-browser__list");
    if (!(list instanceof HTMLElement)) {
      return;
    }

    const viewKey = this._getMediaBrowserViewKey();
    if (!viewKey) {
      return;
    }

    this._mediaBrowserScrollPositions.set(viewKey, list.scrollTop);
  }

  _restoreMediaBrowserScrollState() {
    if (!this.shadowRoot || !this._mediaBrowserState) {
      return;
    }

    const list = this.shadowRoot.querySelector(".media-browser__list");
    if (!(list instanceof HTMLElement)) {
      return;
    }

    const viewKey = this._getMediaBrowserViewKey();
    if (!viewKey) {
      return;
    }

    const savedScrollTop = this._mediaBrowserScrollPositions.get(viewKey);
    if (typeof savedScrollTop !== "number") {
      return;
    }

    list.scrollTop = savedScrollTop;
  }

  _captureTvPanelScrollState() {
    if (!this.shadowRoot || !this._tvSourcePickerEntity) {
      return;
    }

    const panel = this.shadowRoot.querySelector(".media-player__tv-source-panel");
    if (!(panel instanceof HTMLElement)) {
      return;
    }

    this._tvPanelScrollPositions.set(this._tvSourcePickerEntity, panel.scrollTop);
  }

  _restoreTvPanelScrollState() {
    if (!this.shadowRoot || !this._tvSourcePickerEntity) {
      return;
    }

    const panel = this.shadowRoot.querySelector(".media-player__tv-source-panel");
    if (!(panel instanceof HTMLElement)) {
      return;
    }

    const savedScrollTop = this._tvPanelScrollPositions.get(this._tvSourcePickerEntity);
    if (typeof savedScrollTop !== "number") {
      return;
    }

    panel.scrollTop = savedScrollTop;
  }

  _getMediaBrowserIcon(item) {
    const musicAssistantDirectoryIcon =
      item?.media_class === "directory" ? this._getMusicAssistantDirectoryIcon(item) : "";

    if (musicAssistantDirectoryIcon) {
      return musicAssistantDirectoryIcon;
    }

    switch (item?.media_class) {
      case "directory":
        return "mdi:folder";
      case "album":
        return "mdi:album";
      case "artist":
        return "mdi:account-music";
      case "playlist":
        return "mdi:playlist-music";
      case "track":
      case "music":
        return "mdi:music-note";
      case "podcast":
        return "mdi:podcast";
      case "radio":
        return "mdi:radio";
      case "tv_show":
        return "mdi:television";
      case "video":
      case "movie":
        return "mdi:movie";
      default:
        return item?.can_expand ? "mdi:folder-outline" : "mdi:music-box";
    }
  }

  _shouldFilterMusicAssistantBrowserItems() {
    return Boolean(
      this._mediaBrowserState?.isMusicAssistant &&
      Array.isArray(this._mediaBrowserState?.stack) &&
      this._mediaBrowserState.stack.length <= 1,
    );
  }

  _shouldFilterTvBrowserItems() {
    return Boolean(
      this._mediaBrowserState?.isTvPlayer &&
      Array.isArray(this._mediaBrowserState?.stack) &&
      this._mediaBrowserState.stack.length <= 1,
    );
  }

  _shouldHideMediaBrowserItem(item) {
    if ((!this._shouldFilterMusicAssistantBrowserItems() && !this._shouldFilterTvBrowserItems()) || !item) {
      return false;
    }

    const haystack = normalizeTextKey([
      item.title,
      item.media_class,
      item.media_content_type,
      item.media_content_id,
    ].filter(Boolean).join(" "));

    return MUSIC_ASSISTANT_BROWSER_EXCLUDE_PATTERNS.some(pattern => haystack.includes(pattern));
  }

  _onShadowClick(event) {
    const mediaSlider = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.mediaSlider);

    if (mediaSlider) {
      event.stopPropagation();
      return;
    }

    const mediaControlButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaControl);

    if (mediaControlButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._triggerButtonBounce(mediaControlButton);
      this._handleMediaControl(mediaControlButton.dataset.mediaControl, mediaControlButton.dataset.entity, {
        path: mediaControlButton.dataset.mediaPath,
        source: mediaControlButton.dataset.mediaSource,
        state: mediaControlButton.dataset.mediaState,
        volume: Number(mediaControlButton.dataset.mediaVolume),
      });
      return;
    }

    const mediaArtwork = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.classList?.contains("media-player__artwork"));

    if (mediaArtwork) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const mediaDotButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaIndex !== undefined);

    if (mediaDotButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._triggerButtonBounce(mediaDotButton);
      const visiblePlayers = this._getVisiblePlayers();
      this._activePlayerIndex = clamp(Number(mediaDotButton.dataset.mediaIndex), 0, visiblePlayers.length - 1);
      this._activePlayerEntity = String(visiblePlayers[this._activePlayerIndex]?.entity || "");
      this._animateContentOnNextRender = true;
      this._render();
      return;
    }

    const mediaBrowserCloseButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaBrowserClose === "true");

    if (mediaBrowserCloseButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerButtonBounce(mediaBrowserCloseButton);
      this._closeMediaBrowser();
      return;
    }

    const mediaBrowserBackButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaBrowserBack === "true");

    if (mediaBrowserBackButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerButtonBounce(mediaBrowserBackButton);
      this._goBackMediaBrowser();
      return;
    }

    const mediaBrowserActionButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaBrowserAction);

    if (mediaBrowserActionButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._triggerButtonBounce(mediaBrowserActionButton);

      const action = mediaBrowserActionButton.dataset.mediaBrowserAction;
      const mediaContentType = mediaBrowserActionButton.dataset.mediaContentType || "";
      const mediaContentId = mediaBrowserActionButton.dataset.mediaContentId || "";

      if (action === "browse") {
        this._browseMediaBrowserItem(mediaContentType, mediaContentId);
        return;
      }

      if (action === "play") {
        this._playMediaBrowserItem(mediaContentType, mediaContentId);
      }
      return;
    }

    const mediaCard = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaCardIndex !== undefined);

    if (mediaCard) {
      const visiblePlayers = this._getVisiblePlayers();
      const player = visiblePlayers[Number(mediaCard.dataset.mediaCardIndex)];

      if (player) {
        event.preventDefault();
        event.stopPropagation();
        this._triggerHaptic();
        this._runPlayerAction(player, {
          action: "more-info",
          entity: player.entity,
        });
      }
    }
  }

  _mediaPlayerCardUi(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.mediaPlayerCard;
    const enPack = window.NodaliaI18n?.strings?.("en")?.mediaPlayerCard;
    const raw = pack?.[key] ?? enPack?.[key];
    return String(raw != null && raw !== "" ? raw : fallback);
  }

  _commonAria(key, fallback = "") {
    return window.NodaliaI18n?.translateCommonAria?.(this._hass, this._config?.language ?? "auto", key, fallback) || fallback;
  }

  _mediaBrowserUi(key, fallback = "", values = {}) {
    return window.NodaliaI18n?.translateMediaBrowserUi?.(this._hass, this._config?.language ?? "auto", key, fallback, values) || fallback;
  }

  _mediaPlayerAria(key, fallback = "", values = {}) {
    return window.NodaliaI18n?.translateMediaPlayerAria?.(this._hass, this._config?.language ?? "auto", key, fallback, values) || fallback;
  }

  _renderEmptyState() {
    const title = escapeHtml(this._mediaPlayerCardUi("emptyTitle", "Nodalia Media Player"));
    const body = escapeHtml(
      this._mediaPlayerCardUi("emptyBody", "Set `entity` or `players` to show a player."),
    );
    return `
      <ha-card class="empty-card">
        <div class="empty-card__title">${title}</div>
        <div class="empty-card__text">${body}</div>
      </ha-card>
    `;
  }

  _renderMediaBrowser() {
    if (!this._mediaBrowserState) {
      return "";
    }

    const currentNode = this._mediaBrowserState.stack[this._mediaBrowserState.stack.length - 1] || null;
    const items = (Array.isArray(currentNode?.children) ? currentNode.children : []).filter(
      item => !this._shouldHideMediaBrowserItem(item),
    );

    const bodyMarkup = this._mediaBrowserState.loading
      ? `<div class="media-browser__empty">${escapeHtml(this._mediaBrowserUi("loading", "Loading media..."))}</div>`
      : this._mediaBrowserState.error
        ? `<div class="media-browser__empty">${escapeHtml(this._mediaBrowserState.error)}</div>`
        : items.length === 0
          ? `<div class="media-browser__empty">${escapeHtml(this._mediaBrowserUi("empty", "No items available here."))}</div>`
          : `
            <div class="media-browser__list">
              ${items
                .map(item => {
                  const canExpand = item.can_expand === true;
                  const canPlay = item.can_play === true;
                  const defaultAction = canExpand ? "browse" : canPlay ? "play" : "";
                  const itemIcon = this._getMediaBrowserIcon(item);
                  const itemTitle = this._getMediaBrowserDisplayTitle(item);
                  const itemThumbnail = this._resolveMediaUrl(item.thumbnail || item.thumbnail_url || "", {
                    cacheToken: item.media_content_id || itemTitle,
                  });

                  return `
                    <div class="media-browser__item">
                      <button
                        type="button"
                        class="media-browser__item-main"
                        ${defaultAction ? `data-media-browser-action="${defaultAction}"` : "disabled"}
                        data-media-content-type="${escapeHtml(item.media_content_type || "")}"
                        data-media-content-id="${escapeHtml(item.media_content_id || "")}"
                      >
                        <span class="media-browser__item-artwork">
                          ${
                            itemThumbnail
                              ? `<img src="${escapeHtml(itemThumbnail)}" alt="${escapeHtml(itemTitle)}" />`
                              : `<ha-icon icon="${escapeHtml(itemIcon)}"></ha-icon>`
                          }
                        </span>
                        <span class="media-browser__item-copy">
                          <span class="media-browser__item-title">${escapeHtml(itemTitle)}</span>
                        </span>
                        ${
                          canExpand
                            ? `<ha-icon class="media-browser__item-chevron" icon="mdi:chevron-right"></ha-icon>`
                            : ""
                        }
                      </button>
                      ${
                        canPlay && canExpand
                          ? `
                            <button
                              type="button"
                              class="media-browser__item-play"
                              data-media-browser-action="play"
                              data-media-content-type="${escapeHtml(item.media_content_type || "")}"
                              data-media-content-id="${escapeHtml(item.media_content_id || "")}"
                              aria-label="${escapeHtml(this._mediaBrowserUi("playItem", "Play {title}", { title: itemTitle }))}"
                            >
                              <ha-icon icon="mdi:play"></ha-icon>
                            </button>
                          `
                          : ""
                      }
                    </div>
                  `;
                })
                .join("")}
            </div>
          `;
    const mediaBrowserBackdropClasses = [
      "media-browser-backdrop",
      this._mediaBrowserState?.animateIn === true ? "media-browser-backdrop--entering" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const mediaBrowserPanelClasses = [
      "media-browser-panel",
      this._mediaBrowserState?.animateIn === true ? "media-browser-panel--entering" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `
      <div class="${mediaBrowserBackdropClasses}" data-media-browser-close="true"></div>
      <div class="${mediaBrowserPanelClasses}" role="dialog" aria-modal="true" aria-label="${escapeHtml(this._mediaBrowserUi("dialog", "Media browser"))}">
        <div class="media-browser__header">
          <button
            type="button"
            class="media-browser__header-button"
            data-media-browser-back="true"
            aria-label="${escapeHtml(this._commonAria("back", "Back"))}"
          >
            <ha-icon icon="mdi:chevron-left"></ha-icon>
          </button>
          <div class="media-browser__header-copy">
            <div class="media-browser__eyebrow">${escapeHtml(this._mediaBrowserState?.browserLabel || this._mediaBrowserUi("eyebrow", "Media Browser"))}</div>
            <div class="media-browser__title">${escapeHtml(this._getMediaBrowserDisplayTitle(currentNode?.title || "Media"))}</div>
          </div>
          <button
            type="button"
            class="media-browser__header-button"
            data-media-browser-close="true"
            aria-label="${escapeHtml(this._commonAria("close", "Close"))}"
          >
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </div>
        ${bodyMarkup}
      </div>
    `;
  }

  _renderPlayerCard(players, { animateEntrance = false } = {}) {
    if (!players.length) {
      return {
        markup: "",
        animateEntranceApplied: false,
      };
    }

    this._resolveActivePlayerIndex(players);

    const player = players[this._activePlayerIndex];
    const state = this._hass?.states?.[player.entity];
    if (!state) {
      return {
        markup: "",
        animateEntranceApplied: false,
      };
    }

    players.forEach((visiblePlayer, index) => {
      const visibleState = this._hass?.states?.[visiblePlayer.entity];
      if (!visibleState) {
        return;
      }

      const visibleArtwork = this._getPlayerArtwork(visiblePlayer, visibleState);
      if (!visibleArtwork) {
        return;
      }

      this._ensureArtworkReady(visiblePlayer.entity, visibleArtwork, {
        rerenderOnReady: index === this._activePlayerIndex,
      });
    });

    const desiredArtwork = this._getPlayerArtwork(player, state);
    const artworkReady = !desiredArtwork || this._ensureArtworkReady(player.entity, desiredArtwork, {
      rerenderOnReady: true,
    });
    const artwork = this._getRenderableArtwork(player.entity, desiredArtwork);
    // Prefer cached/ready art, but still paint the album stage immediately with the
    // desired URL so compact tiles and CI fixtures are never blank while preloading.
    const backgroundArtwork = artwork || desiredArtwork || "";
    const renderAnimateEntrance = animateEntrance && artworkReady;
    const safeArtwork = artwork ? escapeHtml(artwork) : "";
    const deviceType = this._getPlayerDeviceType(player, state);
    const isTvPlayer = deviceType === "tv";
    const playerLabel = this._getPlayerLabel(player, state);
    const sourceLabel = this._getPlayerSourceLabel(state);
    const title = isTvPlayer
      ? this._getTvContentTitle(player, state)
      : this._getPlayerTitle(player, state);
    const subtitle = isTvPlayer
      ? ""
      : this._getPlayerSubtitle(player, state);
    const artworkAlt = escapeHtml(title || playerLabel);
    const subtitleMarkup = subtitle && normalizeTextKey(subtitle) !== normalizeTextKey(title)
      ? `<div class="media-player__subtitle">${escapeHtml(subtitle)}</div>`
      : "";
    const progress = this._getPlayerProgress(state);
    const hasActiveMediaContent = this._hasActiveMediaContent(state);
    const sourceOptions = isTvPlayer ? this._getPlayerSourceOptions(player, state) : [];
    const chips = isTvPlayer
      ? this._getTvPlayerChips(player, state, progress, title, subtitle, sourceOptions)
      : this._getPlayerChips(player, state, progress, title, subtitle);
    const showPrimaryTitle = !isTvPlayer
      ? hasActiveMediaContent && (!playerLabel || normalizeTextKey(title) !== normalizeTextKey(playerLabel))
      : Boolean(title) && (
          !playerLabel ||
          normalizeTextKey(title) !== normalizeTextKey(playerLabel) ||
          !hasActiveMediaContent
        );
    const showTopChip = this._config.show_device_chip !== false && !!playerLabel && (
      isTvPlayer
        ? !showPrimaryTitle || normalizeTextKey(playerLabel) !== normalizeTextKey(title)
        : !hasActiveMediaContent || normalizeTextKey(playerLabel) !== normalizeTextKey(title)
    );
    const statusLabel = this._getPlayerStateLabel(state.state);
    const showStateLabel = this._config.show_state === true;
    const browsePath = this._getPlayerBrowsePath(player, state);
    const browseAvailable = isTvPlayer
      ? Boolean(player?.browse_path || player?.media_browser_path)
      : this._supportsMediaBrowser(player, state) || Boolean(browsePath);
    const isIdleLayout = this._shouldUseIdleLayout(player, state);
    const isTvOff = isTvPlayer && ["off", "standby", "unavailable", "unknown"].includes(normalizeTextKey(state.state));
    const useCompactIdleLayout = isIdleLayout && (!isTvPlayer || isTvOff);
    const volumeLevel = Number(state.attributes.volume_level ?? 0);
    const currentVolumePercent = this._getPlayerVolumePercent(player.entity, state);
    const volumeSupported = this._supportsVolumeControl(state);
    const playerStyles = this._config.styles.player;
    const hasAlbumBackground = this._config.album_cover_background !== false && Boolean(backgroundArtwork);
    const useActiveTint = isTvPlayer && this._isPlayerActive(state) && !hasAlbumBackground;
    const showUnavailableBadge = this._config.show_unavailable_badge !== false && isUnavailableState(state);
    const playerCardClasses = [
      "media-player-card",
      `media-player-card--${this._getPresentationMode()}`,
      useCompactIdleLayout ? "media-player-card--idle" : "",
      isTvPlayer ? "media-player-card--tv" : "",
      hasAlbumBackground ? "has-album-background" : "",
      useActiveTint ? "media-player-card--active" : "",
    ]
      .filter(Boolean)
      .join(" ");
    this._activeArtworkUrl = backgroundArtwork;
    this._activeArtworkIdle = Boolean(useCompactIdleLayout);

    const volumeDownMarkup = volumeSupported
      ? `
        <button
          type="button"
          class="media-player__volume-button"
          data-media-control="volume-down"
          data-entity="${escapeHtml(player.entity)}"
          data-media-volume="${volumeLevel}"
          aria-label="${escapeHtml(this._commonAria("volumeDown", "Volume down"))}"
        >
          <ha-icon icon="mdi:minus"></ha-icon>
        </button>
      `
      : "";
    const volumeUpMarkup = volumeSupported
      ? `
        <button
          type="button"
          class="media-player__volume-button"
          data-media-control="volume-up"
          data-entity="${escapeHtml(player.entity)}"
          data-media-volume="${volumeLevel}"
          aria-label="${escapeHtml(this._commonAria("volumeUp", "Volume up"))}"
        >
          <ha-icon icon="mdi:plus"></ha-icon>
        </button>
      `
      : "";
    const browseMarkup = browseAvailable && !isTvPlayer
      ? `
        <button
          type="button"
          class="media-player__volume-button media-player__volume-button--browse"
          data-media-control="browse-media"
          data-entity="${escapeHtml(player.entity)}"
          data-media-path="${escapeHtml(browsePath)}"
          aria-label="${escapeHtml(this._commonAria("openMedia", "Open media"))}"
        >
          <ha-icon icon="mdi:music-box-multiple-outline"></ha-icon>
        </button>
      `
      : "";
    const tvPowerMarkup = `
      <button
        type="button"
        class="media-player__control ${state.state === "off" ? "media-player__control--primary" : ""}"
        data-media-control="power-toggle"
        data-entity="${escapeHtml(player.entity)}"
        data-media-state="${escapeHtml(state.state)}"
        aria-label="${escapeHtml(state.state === "off" ? this._mediaPlayerAria("turnOn", "Turn on") : this._mediaPlayerAria("turnOff", "Turn off"))}"
      >
        <ha-icon icon="mdi:power"></ha-icon>
      </button>
    `;
    const tvPlayPauseMarkup = !isTvOff
      ? `
      <button
        type="button"
        class="media-player__control media-player__control--primary"
        data-media-control="play-pause"
        data-entity="${escapeHtml(player.entity)}"
        aria-label="${escapeHtml(this._mediaPlayerAria("playPause", "Play or pause"))}"
      >
        <ha-icon icon="${escapeHtml(state.state === "playing" ? "mdi:pause" : "mdi:play")}"></ha-icon>
      </button>
    `
      : "";
    const tvVolumeToggleMarkup = volumeSupported && !isTvOff
      ? `
        <button
          type="button"
          class="media-player__control ${this._tvVolumePickerEntity === player.entity ? "media-player__control--active" : ""}"
          data-media-control="toggle-volume-panel"
          data-entity="${escapeHtml(player.entity)}"
          aria-label="${escapeHtml(this._mediaPlayerAria("showVolume", "Show volume"))}"
        >
          <ha-icon icon="mdi:volume-high"></ha-icon>
        </button>
      `
      : "";
    const artworkIsSourceToggle = isTvPlayer && sourceOptions.length && !isTvOff;
    const tvBrowseMarkup = browseAvailable && !isTvOff
      ? `
        <button
          type="button"
          class="media-player__control"
          data-media-control="browse-media"
          data-entity="${escapeHtml(player.entity)}"
          data-media-path="${escapeHtml(browsePath)}"
          aria-label="${escapeHtml(this._commonAria("openMedia", "Open media"))}"
        >
          <ha-icon icon="mdi:apps"></ha-icon>
        </button>
      `
      : "";
    const sourceButtonsMarkup = sourceOptions.length
      ? `
        <div class="media-player__source-buttons" aria-label="${escapeHtml(this._mediaPlayerAria("sources", "Sources"))}">
          ${sourceOptions
            .map(source => `
              <button
                type="button"
                class="media-player__source-button ${normalizeTextKey(source) === normalizeTextKey(state.attributes.source) ? "active" : ""}"
                data-media-control="select-source"
                data-entity="${escapeHtml(player.entity)}"
                data-media-source="${escapeHtml(source)}"
                aria-label="${escapeHtml(this._mediaPlayerAria("switchToSource", "Switch to {source}", { source }))}"
              >
                ${escapeHtml(source)}
              </button>
            `)
            .join("")}
        </div>
      `
      : "";
    const tvSourcePanelMarkup = sourceButtonsMarkup && !isTvOff && this._tvSourcePickerEntity === player.entity
      ? `
        <div class="media-player__tv-source-panel ${this._tvSourcePanelAnimatingEntity === player.entity ? "media-player__tv-source-panel--entering" : ""}">
          ${sourceButtonsMarkup}
        </div>
      `
      : "";
    const tvVolumeSliderMarkup = volumeSupported && !isTvOff && this._tvVolumePickerEntity === player.entity
      ? `
        <div class="media-player__tv-volume-wrap ${this._tvVolumePanelAnimatingEntity === player.entity ? "media-player__tv-volume-wrap--entering" : ""}">
          <div class="media-player__volume-slider-shell" style="--media-volume:${currentVolumePercent};">
            <div class="media-player__volume-track"></div>
            <input
              type="range"
              class="media-player__volume-slider"
              data-media-slider="volume"
              data-entity="${escapeHtml(player.entity)}"
              min="0"
              max="100"
              step="any"
              value="${currentVolumePercent}"
              style="--media-volume:${currentVolumePercent};"
              aria-label="${escapeHtml(this._mediaPlayerAria("volume", "Volume"))}"
            />
          </div>
        </div>
      `
      : "";
    const tvControlsMarkup = `
      <div class="media-player__tv-actions ${isTvOff ? "media-player__tv-actions--off" : ""}">
        ${tvPowerMarkup}
        ${tvPlayPauseMarkup}
        ${tvVolumeToggleMarkup}
        ${tvBrowseMarkup}
      </div>
    `;
    const tvSourceMarkup = isTvPlayer && sourceLabel
      && normalizeTextKey(sourceLabel) !== normalizeTextKey(playerLabel)
      && normalizeTextKey(sourceLabel) !== normalizeTextKey(title)
      ? `<div class="media-player__subtitle media-player__subtitle--tv">${escapeHtml(sourceLabel)}</div>`
      : "";
    const dotsMarkup = players.length > 1
      ? `
        <div class="media-player__dots" aria-label="${escapeHtml(this._commonAria("mediaPlayers", "Media players"))}">
          ${players
            .map(
              (_item, index) => `
                <button
                  type="button"
                  class="media-player__dot ${index === this._activePlayerIndex ? "active" : ""}"
                  data-media-index="${index}"
                  aria-label="${escapeHtml(this._mediaPlayerAria("selectPlayer", "Select player {index}", { index: index + 1 }))}"
                ></button>
              `,
            )
            .join("")}
        </div>
      `
      : "";
    const chipsMarkup = chips.length
      ? `
        <div class="media-player__chips-wrap">
          <div class="media-player__chips">
            ${chips
              .map(
                chip => `
                  <span class="media-player__chip media-player__chip--${escapeHtml(chip.tone)}">
                    <span class="media-player__chip-label">${escapeHtml(chip.label)}</span>
                  </span>
                `,
              )
              .join("")}
          </div>
        </div>
      `
      : "";
    const infoRailItems = [
      showTopChip
        ? `
          <span class="media-player__chip media-player__chip--device media-player__chip--top" title="${escapeHtml(playerLabel)}">
            <span class="media-player__chip-label">${escapeHtml(playerLabel)}</span>
          </span>
        `
        : "",
      showStateLabel
        ? `
          <span class="media-player__chip media-player__chip--${escapeHtml(state.state || "default")} media-player__chip--status">
            <span class="media-player__chip-label">${escapeHtml(statusLabel)}</span>
          </span>
        `
        : "",
    ]
      .filter(Boolean)
      .join("");
    const infoRailMarkup = infoRailItems
      ? `
        <div class="media-player__info-rail ${useCompactIdleLayout ? "media-player__info-rail--idle" : ""}">
          ${infoRailItems}
        </div>
      `
      : "";
    const idleControlsMarkup = `
      <div class="media-player__idle-actions">
        ${volumeDownMarkup}
        <button
          type="button"
          class="media-player__control media-player__control--primary"
          data-media-control="play"
          data-entity="${escapeHtml(player.entity)}"
          aria-label="${escapeHtml(this._mediaPlayerAria("play", "Play"))}"
        >
          <ha-icon icon="mdi:play"></ha-icon>
        </button>
        ${volumeUpMarkup}
        ${browseMarkup}
      </div>
    `;
    const idleTvControlsMarkup = `
      <div class="media-player__idle-tv-stack">
        <div class="media-player__idle-actions media-player__idle-actions--tv">
          ${tvControlsMarkup}
        </div>
        ${tvVolumeSliderMarkup}
      </div>
    `;
    const idleNameText = String(playerLabel || title || "").trim();
    const idleNameMarkup = idleNameText
      ? `<div class="media-player__idle-name">${escapeHtml(idleNameText)}</div>`
      : "";
    const idleTvOffPowerMarkup = `
      <div class="media-player__idle-actions media-player__idle-actions--tv media-player__idle-actions--tv-off">
        ${tvPowerMarkup}
      </div>
    `;

    if (useCompactIdleLayout) {
      return {
        markup: `
        <div
          class="${playerCardClasses}"
          data-media-card-index="${this._activePlayerIndex}"
        >
          ${this._renderProgressMarkup(player, state, progress)}
          <div class="media-player__content media-player__content--idle${renderAnimateEntrance ? " media-player__content--entering" : ""}">
            <div class="media-player__idle-hero${isTvPlayer && isTvOff ? " media-player__idle-hero--tv-off" : ""}">
              ${
                artworkIsSourceToggle
                  ? `
                    <button
                      type="button"
                      class="media-player__artwork media-player__artwork--idle media-player__artwork--interactive ${this._tvSourcePickerEntity === player.entity ? "media-player__artwork--active" : ""}"
                      data-media-control="toggle-source-panel"
                      data-entity="${escapeHtml(player.entity)}"
                      aria-label="${escapeHtml(this._mediaPlayerAria("switchSource", "Switch source"))}"
                    >
                      ${
                        artwork
                          ? `<img src="${safeArtwork}" alt="${artworkAlt}" />`
                          : `<ha-icon icon="${escapeHtml(this._getPlayerFallbackIcon(player, state, deviceType))}"></ha-icon>`
                      }
                      ${showUnavailableBadge ? `<span class="media-player__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
                    </button>
                  `
                  : `
                    <div class="media-player__artwork media-player__artwork--idle">
                      ${
                        artwork
                          ? `<img src="${safeArtwork}" alt="${artworkAlt}" />`
                          : `<ha-icon icon="${escapeHtml(this._getPlayerFallbackIcon(player, state, deviceType))}"></ha-icon>`
                      }
                      ${showUnavailableBadge ? `<span class="media-player__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
                    </div>
                  `
              }
              ${
                isTvPlayer && isTvOff
                  ? `${idleNameMarkup}${idleTvOffPowerMarkup}`
                  : `
                    <div class="media-player__idle-main">
                      ${idleNameMarkup}
                      ${isTvPlayer ? idleTvControlsMarkup : idleControlsMarkup}
                    </div>
                  `
              }
            </div>
            ${isTvPlayer ? tvSourcePanelMarkup : ""}
            ${dotsMarkup ? `<div class="media-player__switcher media-player__switcher--idle">${dotsMarkup}</div>` : ""}
          </div>
        </div>
      `,
        animateEntranceApplied: renderAnimateEntrance,
      };
    }

    return {
      markup: `
      <div
        class="${playerCardClasses}"
        data-media-card-index="${this._activePlayerIndex}"
      >
        ${this._renderProgressMarkup(player, state, progress)}
        <div class="media-player__content${renderAnimateEntrance ? " media-player__content--entering" : ""}">
          <div class="media-player__hero">
            ${
              artworkIsSourceToggle
                ? `
                  <button
                    type="button"
                    class="media-player__artwork media-player__artwork--interactive ${this._tvSourcePickerEntity === player.entity ? "media-player__artwork--active" : ""}"
                    data-media-control="toggle-source-panel"
                    data-entity="${escapeHtml(player.entity)}"
                    aria-label="${escapeHtml(this._mediaPlayerAria("switchSource", "Switch source"))}"
                  >
                    ${
                      artwork
                        ? `<img src="${safeArtwork}" alt="${artworkAlt}" />`
                        : `<ha-icon icon="${escapeHtml(this._getPlayerFallbackIcon(player, state, deviceType))}"></ha-icon>`
                    }
                    ${showUnavailableBadge ? `<span class="media-player__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
                  </button>
                `
                : `
                  <div class="media-player__artwork">
                    ${
                      artwork
                        ? `<img src="${safeArtwork}" alt="${artworkAlt}" />`
                        : `<ha-icon icon="${escapeHtml(this._getPlayerFallbackIcon(player, state, deviceType))}"></ha-icon>`
                    }
                    ${showUnavailableBadge ? `<span class="media-player__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
                  </div>
                `
            }
            <div class="media-player__hero-copy">
              <div class="media-player__hero-top">
                ${isTvPlayer ? infoRailMarkup : ""}
                <div class="media-player__meta ${isTvPlayer ? "media-player__meta--tv" : ""}">
                  ${showPrimaryTitle ? `<div class="media-player__title">${escapeHtml(title)}</div>` : ""}
                  ${isTvPlayer ? tvSourceMarkup : subtitleMarkup}
                </div>
                ${isTvPlayer ? "" : infoRailMarkup}
              </div>
            </div>
          </div>
          <div class="media-player__center-stack">
            ${dotsMarkup ? `<div class="media-player__switcher">${dotsMarkup}</div>` : ""}
            <div class="media-player__transport-row">
              ${
                isTvPlayer
                  ? `
                    <div class="media-player__tv-shell">
                      <div class="media-player__tv-stack">
                        ${tvControlsMarkup}
                        ${tvVolumeSliderMarkup}
                        ${tvSourcePanelMarkup}
                      </div>
                    </div>
                  `
                  : `
                    <div class="media-player__transport-shell">
                      <div class="media-player__transport-cluster">
                        ${volumeDownMarkup}
                        <div class="media-player__transport">
                          <button
                            type="button"
                            class="media-player__control"
                            data-media-control="previous"
                            data-entity="${escapeHtml(player.entity)}"
                            aria-label="${escapeHtml(this._commonAria("previous", "Previous"))}"
                          >
                            <ha-icon icon="mdi:skip-previous"></ha-icon>
                          </button>
                          <button
                            type="button"
                            class="media-player__control media-player__control--primary"
                            data-media-control="play-pause"
                            data-entity="${escapeHtml(player.entity)}"
                            aria-label="${escapeHtml(this._commonAria("playPause", "Play or pause"))}"
                          >
                            <ha-icon icon="${escapeHtml(state.state === "playing" ? "mdi:pause" : "mdi:play")}"></ha-icon>
                          </button>
                          <button
                            type="button"
                            class="media-player__control"
                            data-media-control="next"
                            data-entity="${escapeHtml(player.entity)}"
                            aria-label="${escapeHtml(this._commonAria("next", "Next"))}"
                          >
                            <ha-icon icon="mdi:skip-next"></ha-icon>
                          </button>
                        </div>
                        ${volumeUpMarkup}
                        ${browseMarkup}
                      </div>
                    </div>
                  `
              }
            </div>
          </div>
          ${chipsMarkup ? `<div class="media-player__footer">${chipsMarkup}</div>` : ""}
        </div>
      </div>
    `,
      animateEntranceApplied: renderAnimateEntrance,
    };
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    this._captureMediaBrowserScrollState();
    this._captureTvPanelScrollState();

    if (!this._config) {
      this.shadowRoot.innerHTML = "";
      return;
    }

    if (this._shouldHideForScreen()) {
      this.shadowRoot.innerHTML = "";
      return;
    }

    const mediaGuardIds = [];
    const mediaEntity = String(this._config?.entity ?? "").trim();
    if (mediaEntity) {
      mediaGuardIds.push(mediaEntity);
    }
    for (const player of Array.isArray(this._config?.players) ? this._config.players : []) {
      const playerEntity = String(player?.entity ?? "").trim();
      if (playerEntity && !mediaGuardIds.includes(playerEntity)) {
        mediaGuardIds.push(playerEntity);
      }
    }
    const mediaEntityGuard = window.NodaliaUtils?.renderLovelaceEntityGuardForEntities?.(
      this._hass,
      mediaGuardIds.length ? mediaGuardIds : [""],
      { cardClass: "media-player" },
    );
    if (mediaEntityGuard) {
      this.shadowRoot.innerHTML = mediaEntityGuard;
      return;
    }

    const inEditMode = this._isInEditMode();
    const players = this._getVisiblePlayers();
    const hasPlayers = players.length > 0;
    if (!hasPlayers) {
      this._activeArtworkIdle = false;
    }
    const isFixed = this._config.layout.fixed && !inEditMode;
    const spacerHeight = isFixed ? this._getReservedHeight(hasPlayers) : "0px";
    const mediaBrowserMarkup = this._renderMediaBrowser();
    const animations = this._getAnimationSettings();

    this._syncTicker(hasPlayers ? players : []);

    const playerCardRender = hasPlayers
      ? this._renderPlayerCard(players, {
        animateEntrance: animations.enabled && this._animateContentOnNextRender,
      })
      : { markup: "", animateEntranceApplied: false };

    const contentMarkup = hasPlayers
      ? playerCardRender.markup
      : inEditMode
        ? this._renderEmptyState()
        : "";

    const config = this._config;
    const playerStyles = config.styles.player;
    const browserStyles = config.styles.browser;
    const tvArtworkSize = playerStyles.tv_artwork_size || playerStyles.artwork_size;
    const activeTintColor = playerStyles.active_tint_color || "var(--info-color, #71c0ff)";
    const isLightThemeSurface = this._isLightThemeSurface();
    const albumOverlayColor = isLightThemeSurface
      ? `color-mix(in srgb, ${playerStyles.overlay_color} 24%, var(--ha-card-background))`
      : playerStyles.overlay_color;
    const albumOverlayTop = isLightThemeSurface
      ? `color-mix(in srgb, ${albumOverlayColor} 72%, transparent)`
      : `color-mix(in srgb, ${albumOverlayColor} 64%, rgba(0, 0, 0, 0.08))`;
    const albumOverlayBottom = isLightThemeSurface
      ? `color-mix(in srgb, ${albumOverlayColor} 88%, color-mix(in srgb, var(--ha-card-background) 92%, transparent))`
      : `color-mix(in srgb, ${albumOverlayColor} 86%, rgba(0, 0, 0, 0.16))`;
    const artworkVisuals = getArtworkVisuals(
      config.artwork,
      config.album_cover_background !== false,
      isLightThemeSurface,
    );
    const albumBackgroundFilter = artworkVisuals.filter;
    const albumBackgroundOpacity = artworkVisuals.opacity;
    const albumDim = artworkVisuals.dim;
    const presentationMode = this._getPresentationMode();
    this._resolvedLayoutMode = presentationMode;
    this.setAttribute("data-presentation", presentationMode);
    if (this._activeArtworkIdle) {
      this.setAttribute("data-idle-compact", "true");
    } else {
      this.removeAttribute("data-idle-compact");
    }
    const cardTopHighlight = isLightThemeSurface
      ? "linear-gradient(180deg, color-mix(in srgb, var(--ha-card-background) 34%, transparent), rgba(255, 255, 255, 0))"
      : "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 6%, transparent), rgba(255, 255, 255, 0))";
    const activeTintPrimaryStrength = isLightThemeSurface ? 52 : 46;
    const activeTintSecondaryStrength = isLightThemeSurface ? 34 : 30;
    const activeTintTopStrength = isLightThemeSurface ? 40 : 34;
    const activeTintBaseStrength = isLightThemeSurface ? 56 : 48;
    const activeTintMidStrength = isLightThemeSurface ? 34 : 30;
    const activeCardBaseBackground = "var(--ha-card-background, var(--card-background-color, #111827))";
    const activeCardBackground = `
      radial-gradient(circle at 18% 20%, color-mix(in srgb, ${activeTintColor} ${activeTintPrimaryStrength}%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 56%),
      radial-gradient(circle at top left, color-mix(in srgb, ${activeTintColor} ${activeTintPrimaryStrength}%, transparent) 0%, transparent 62%),
      radial-gradient(circle at 50% 38%, color-mix(in srgb, ${activeTintColor} ${activeTintSecondaryStrength}%, transparent) 0%, transparent 68%),
      linear-gradient(180deg, color-mix(in srgb, ${activeTintColor} ${activeTintTopStrength}%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)) 0%, transparent 44%),
      linear-gradient(135deg, color-mix(in srgb, ${activeTintColor} ${activeTintBaseStrength}%, ${activeCardBaseBackground}) 0%, color-mix(in srgb, ${activeTintColor} ${activeTintMidStrength}%, ${activeCardBaseBackground}) 58%, ${activeCardBaseBackground} 100%)
    `.trim();
    const activeCardBorder = `color-mix(in srgb, ${activeTintColor} 52%, var(--divider-color))`;
    const activeCardShadow = `${playerStyles.box_shadow}, inset 0 0 0 999px color-mix(in srgb, ${activeTintColor} ${isLightThemeSurface ? 18 : 16}%, transparent), 0 0 0 1px color-mix(in srgb, ${activeTintColor} 22%, color-mix(in srgb, var(--primary-text-color) 8%, transparent)), 0 18px 38px color-mix(in srgb, ${activeTintColor} 34%, rgba(16, 34, 82, 0.18))`;
    const activeCardHighlight = `
      radial-gradient(circle at 18% 20%, color-mix(in srgb, ${activeTintColor} 34%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 54%),
      linear-gradient(135deg, color-mix(in srgb, ${activeTintColor} 24%, transparent) 0%, transparent 68%),
      linear-gradient(180deg, color-mix(in srgb, ${activeTintColor} ${activeTintTopStrength}%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)), rgba(255, 255, 255, 0))
    `.trim();

    const markup = `
      <style>
        :host {
          --media-player-panel-duration: ${animations.enabled ? animations.panelDuration : 0}ms;
          --media-player-browser-duration: ${animations.enabled ? animations.browserDuration : 0}ms;
          --media-player-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --media-player-content-duration: ${animations.enabled ? clamp(Math.round(animations.panelDuration * 0.9), 180, 900) : 0}ms;
          aspect-ratio: auto;
          display: block;
          height: auto;
          width: 100%;
        }

        :host([data-presentation="square"]),
        :host([data-presentation="artwork"]) {
          align-self: start;
          aspect-ratio: 1 / 1;
          height: auto;
          max-width: 100%;
          overflow: hidden;
          width: 100%;
        }

        :host([data-presentation="compact"]) {
          align-self: stretch;
          aspect-ratio: auto;
          height: 100%;
          max-width: 100%;
          min-height: 88px;
          width: 100%;
        }

        :host([data-idle-compact="true"]) {
          align-self: stretch;
          aspect-ratio: auto;
          height: 100%;
          max-height: none;
          min-height: 88px;
          overflow: visible;
        }

        * {
          box-sizing: border-box;
        }

        .spacer {
          display: ${isFixed && config.layout.reserve_space ? "block" : "none"};
          height: ${spacerHeight};
        }

        .dock {
          position: ${isFixed ? "fixed" : "static"};
          left: ${isFixed ? config.layout.side_margin : "auto"};
          right: ${isFixed ? config.layout.side_margin : "auto"};
          ${isFixed
            ? config.layout.position === "top"
              ? `top: ${config.layout.offset};`
              : `bottom: ${config.layout.offset};`
            : "top: auto; bottom: auto;"}
          z-index: ${isFixed ? config.layout.z_index : "auto"};
          pointer-events: ${isFixed ? "none" : "auto"};
        }

        .dock-inner {
          margin: ${isFixed ? "0 auto" : "0"};
          max-width: ${config.layout.max_width};
          pointer-events: none;
          width: 100%;
        }

        .player-stack {
          display: grid;
          gap: 0;
          pointer-events: none;
        }

        .player-stack > *,
        .player-stack > * > *,
        .media-browser-backdrop,
        .media-browser-panel {
          pointer-events: auto;
        }

        .empty-card,
        .media-player-card {
          pointer-events: none;
        }

        .empty-card > *,
        .media-player-card > * {
          pointer-events: auto;
        }

        .empty-card,
        .media-player-card {
          background: ${playerStyles.background};
          border: ${playerStyles.border};
          border-radius: ${playerStyles.border_radius};
          box-shadow: ${playerStyles.box_shadow};
          isolation: isolate;
          min-height: ${playerStyles.min_height};
          max-width: 100%;
          overflow: hidden;
          padding: ${playerStyles.padding};
          position: relative;
          width: 100%;
        }

        .media-player-card--chip {
          min-height: 72px;
          padding: 10px 12px 14px;
        }

        .media-player-card--compact {
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-between;
          min-height: 88px;
          padding: 12px;
        }

        .media-player-card--compact .media-player__volume-button:not(.media-player__volume-button--browse),
        .media-player-card--compact .media-player__chips-wrap,
        .media-player-card--compact .media-player__subtitle {
          display: none;
        }

        .media-player-card--compact .media-player__transport-cluster {
          display: flex;
          flex-wrap: nowrap;
          gap: 10px;
          grid-template-columns: none;
          justify-content: center;
          width: 100%;
        }

        .media-player-card--compact .media-player__control {
          flex: 0 0 auto;
          height: 40px;
          min-width: 40px;
          width: 40px;
        }

        .media-player-card--compact .media-player__control--primary {
          height: 44px;
          min-width: 44px;
          width: 44px;
        }

        .media-player-card--compact .media-player__title {
          font-size: 13px;
        }

        .media-player-card--active {
          background: ${activeCardBackground};
          border-color: ${activeCardBorder};
          box-shadow: ${activeCardShadow};
        }

        .empty-card {
          display: grid;
          gap: 6px;
          min-height: 100px;
        }

        .empty-card__title {
          color: var(--primary-text-color);
          font-size: 15px;
          font-weight: 700;
        }

        .empty-card__text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }

        .media-player-card::before {
          background: ${cardTopHighlight};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 1;
        }

        .media-player-card.media-player-card--active::before {
          background: ${activeCardHighlight};
        }

        .media-player-card.has-album-background::after {
          background: linear-gradient(
            180deg,
            ${albumOverlayTop},
            color-mix(in srgb, ${albumOverlayColor} ${Math.round(albumDim * 100)}%, transparent),
            ${albumOverlayBottom}
          );
          content: "";
          inset: 0;
          position: absolute;
          z-index: 2;
        }

        .media-player__art-stage,
        .media-player__album-bg {
          background-position: center;
          background-size: cover;
          inset: -8px;
          position: absolute;
          z-index: 0;
        }

        .media-player__art-stage {
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .media-player__album-bg,
        .media-player__art-layer {
          filter: ${albumBackgroundFilter};
          inset: ${config.artwork?.mode === "immersive" ? "-6px" : "-24px"};
          opacity: ${albumBackgroundOpacity};
          transform: ${config.artwork?.mode === "immersive" ? "scale(1.04)" : "scale(1.14)"};
          transition: opacity ${config.artwork?.crossfade !== false ? config.artwork.crossfade_duration : 0}ms ease;
        }

        .media-player__art-layer.is-incoming {
          opacity: 0;
        }

        .media-player__art-layer.is-incoming.is-visible {
          opacity: ${albumBackgroundOpacity};
        }

        .media-player__art-layer.is-idle-animated {
          animation: nodalia-media-kenburns 48s ease-in-out alternate infinite;
        }

        .media-player__progress {
          background: ${playerStyles.progress_background};
          border-radius: 999px;
          bottom: 8px;
          height: 6px;
          inset-inline: 12px;
          overflow: hidden;
          position: absolute;
          z-index: 3;
        }

        .media-player__progress.is-interactive {
          cursor: pointer;
          touch-action: none;
        }

        .media-player__progress.is-interactive:focus-visible {
          outline: 2px solid ${playerStyles.progress_color};
          outline-offset: 3px;
        }

        .media-player__progress-fill {
          background: ${playerStyles.progress_color};
          display: block;
          height: 100%;
        }

        .media-player__content,
        .media-player__dots {
          position: relative;
          z-index: 3;
        }

        .media-player__content {
          align-content: start;
          display: grid;
          gap: 10px;
          min-width: 0;
          padding-bottom: 18px;
        }

        .media-player__content--entering {
          animation: media-player-fade-up var(--media-player-content-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .media-player__content--idle {
          gap: 6px;
          padding-bottom: 2px;
        }

        .media-player-card--idle {
          min-height: 0;
        }

        .media-player__hero {
          align-items: start;
          display: grid;
          gap: 12px;
          grid-template-columns: ${playerStyles.artwork_size} minmax(0, 1fr);
        }

        .media-player__idle-hero {
          align-items: center;
          display: grid;
          gap: 10px;
          grid-template-columns: 40px minmax(0, 1fr);
          min-width: 0;
          width: 100%;
        }

        .media-player__idle-hero--tv-off {
          grid-template-columns: 40px minmax(0, 1fr) auto;
        }

        .media-player__idle-name {
          color: var(--primary-text-color);
          font-size: ${playerStyles.title_size};
          font-weight: 700;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-player__idle-main {
          align-items: center;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .media-player__idle-hero--tv-off .media-player__idle-actions--tv-off {
          justify-self: end;
        }

        .media-player__hero-copy {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .media-player__hero-top {
          align-items: start;
          display: grid;
          gap: 8px;
          grid-template-columns: minmax(0, 1fr);
          min-width: 0;
        }

        .media-player__info-rail {
          align-items: end;
          display: grid;
          gap: 6px;
          justify-self: end;
          justify-items: end;
          max-width: min(100%, clamp(132px, 36vw, 220px));
          min-width: 0;
          pointer-events: none;
          width: fit-content;
        }

        .media-player__info-rail--idle {
          align-items: start;
          gap: 4px;
          justify-items: start;
          max-width: none;
        }

        .media-player__artwork {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 22px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.18);
          color: inherit;
          cursor: default;
          display: flex;
          height: ${playerStyles.artwork_size};
          justify-content: center;
          overflow: visible;
          padding: 0;
          position: relative;
          text-decoration: none;
          width: ${playerStyles.artwork_size};
        }

        .media-player__artwork--idle {
          height: 40px;
          width: 40px;
        }

        .media-player__artwork img {
          border-radius: inherit;
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .media-player__artwork ha-icon {
          --mdc-icon-size: calc(${playerStyles.artwork_size} * 0.5);
          align-items: center;
          color: var(--primary-text-color);
          display: inline-flex;
          height: auto;
          justify-content: center;
          left: 50%;
          line-height: 1;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: auto;
        }

        .media-player__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid var(--ha-card-background, rgba(28, 28, 32, 1));
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
          z-index: 3;
        }

        .media-player__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          color:#fff;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .media-player__artwork--interactive {
          cursor: pointer;
        }

        .media-player__artwork--active {
          background: rgba(var(--rgb-primary-color), 0.14);
          border-color: rgba(var(--rgb-primary-color), 0.2);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.18),
            0 0 0 1px rgba(var(--rgb-primary-color), 0.1);
        }

        .media-player__meta {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .media-player__title,
        .media-player__subtitle {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-player-card.has-album-background .media-player__title,
        .media-player-card.has-album-background .media-player__subtitle {
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.32), 0 6px 18px rgba(0, 0, 0, 0.28);
        }

        .media-player__title {
          color: var(--primary-text-color);
          font-size: ${playerStyles.title_size};
          font-weight: 700;
        }

        .media-player__subtitle {
          color: var(--secondary-text-color);
          font-size: ${playerStyles.subtitle_size};
        }

        .media-player__subtitle--tv {
          max-width: min(100%, 420px);
          text-align: center;
          width: 100%;
        }

        .media-player__center-stack {
          display: grid;
          gap: 10px;
          justify-items: center;
        }

        .media-player__switcher {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .media-player__switcher--idle {
          margin-top: -4px;
        }

        .media-player__transport-row {
          align-items: center;
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .media-player__transport-row--idle {
          justify-content: flex-start;
        }

        .media-player__idle-actions {
          align-items: center;
          display: inline-flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
          min-width: 0;
        }

        .media-player__idle-actions--tv {
          justify-content: flex-start;
          width: 100%;
        }

        .media-player__idle-actions--tv-off {
          justify-content: flex-end;
          width: auto;
        }

        .media-player__idle-tv-stack {
          display: grid;
          gap: 8px;
          justify-items: stretch;
          min-width: min(100%, 230px);
        }

        .media-player__transport-shell {
          align-items: center;
          display: flex;
          justify-content: center;
          max-width: 100%;
          min-width: 0;
          width: 100%;
        }

        .media-player__transport-cluster {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          max-width: 100%;
          min-width: 0;
          width: 100%;
        }

        .media-player__transport-cluster--idle {
          gap: 8px;
        }

        .media-player__transport {
          display: contents;
        }

        .media-player__tv-shell {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .media-player__tv-stack {
          display: grid;
          gap: 8px;
          justify-items: center;
          width: min(100%, 340px);
        }

        .media-player__tv-actions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          width: 100%;
        }

        .media-player__tv-actions--off {
          justify-content: flex-end;
          width: auto;
        }

        .media-player-card--tv .media-player__content {
          gap: 6px;
          padding-bottom: 4px;
        }

        .media-player-card--tv:not(.media-player-card--idle) {
          min-height: 0;
          padding: 12px 14px 8px;
        }

        .media-player-card--tv:not(.media-player-card--idle) .media-player__content {
          gap: 8px;
          padding-bottom: 6px;
        }

        .media-player-card--tv .media-player__hero {
          gap: 14px;
          grid-template-columns: ${tvArtworkSize} minmax(0, 1fr);
        }

        .media-player-card--tv .media-player__hero-copy {
          align-content: start;
          gap: 6px;
          min-width: 0;
          overflow: hidden;
        }

        .media-player-card--tv .media-player__artwork {
          height: ${tvArtworkSize};
          width: ${tvArtworkSize};
        }

        .media-player-card--tv .media-player__artwork ha-icon {
          --mdc-icon-size: calc(${tvArtworkSize} * 0.5);
        }

        .media-player-card--tv.media-player-card--idle .media-player__artwork--idle {
          height: 40px;
          width: 40px;
        }

        .media-player-card--tv.media-player-card--idle .media-player__artwork ha-icon {
          --mdc-icon-size: 22px;
        }

        .media-player-card--tv .media-player__hero-top {
          gap: 4px;
          grid-template-columns: minmax(0, 1fr);
          justify-items: end;
        }

        .media-player-card--tv .media-player__info-rail {
          align-items: end;
          gap: 4px;
          justify-items: end;
          justify-self: end;
          max-width: min(100%, 100%);
          width: fit-content;
        }

        .media-player-card--tv .media-player__meta {
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding-left: 10px;
          justify-items: end;
          text-align: right;
          width: 100%;
        }

        .media-player-card--tv .media-player__meta--tv {
          justify-self: end;
        }

        .media-player-card--tv .media-player__chip--top,
        .media-player-card--tv .media-player__chip--status {
          justify-content: flex-end;
          text-align: right;
        }

        .media-player-card--tv .media-player__title {
          display: block;
          font-size: calc(${playerStyles.title_size} - 1px);
          max-width: 100%;
          overflow: hidden;
          text-align: right;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-player-card--tv .media-player__subtitle--tv,
        .media-player-card--tv .media-player__chips-wrap {
          justify-self: end;
          max-width: 100%;
          text-align: right;
        }

        .media-player-card--tv:not(.media-player-card--idle) .media-player__chips-wrap {
          margin-bottom: 4px;
        }

        .media-player-card--tv .media-player__subtitle--tv {
          display: block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
        }

        .media-player-card--tv:not(.media-player-card--idle) .media-player__center-stack {
          gap: 6px;
        }

        .media-player-card--tv:not(.media-player-card--idle) .media-player__tv-stack {
          gap: 5px;
        }

        .media-player-card--tv .media-player__chips,
        .media-player-card--tv .media-player__footer {
          justify-content: flex-end;
        }

        .media-player-card--tv.media-player-card--idle .media-player__idle-main {
          align-items: start;
          gap: 20px;
          grid-template-columns: minmax(0, 1fr);
          padding-top: 6px;
        }

        .media-player-card--tv.media-player-card--idle .media-player__idle-tv-stack {
          gap: 10px;
          padding-top: 6px;
        }

        .media-player-card--tv.media-player-card--idle .media-player__idle-hero--tv-off {
          align-items: center;
          gap: 8px;
          grid-template-columns: 40px minmax(0, 1fr) auto;
        }

        .media-player-card--tv.media-player-card--idle .media-player__idle-actions--tv-off {
          justify-content: flex-end;
          width: fit-content;
        }

        .media-player-card--idle .media-player__control {
          height: 32px;
          min-width: 32px;
          width: 32px;
        }

        .media-player-card--idle .media-player__control ha-icon {
          --mdc-icon-size: 15px;
          height: 15px;
          width: 15px;
        }

        .media-player-card--tv.media-player-card--idle .media-player__idle-hero {
          align-items: center;
        }

        .media-player-card--tv .media-player__tv-source-panel {
          justify-content: center;
          max-height: 190px;
          overflow: auto;
          padding-right: 2px;
        }

        .media-player-card--tv .media-player__source-buttons {
          gap: 6px;
          justify-content: center;
        }

        .media-player-card--tv .media-player__source-button {
          max-width: 100%;
          min-height: 32px;
          padding: 0 10px;
        }

        .media-player-card--tv .media-player__tv-volume-wrap {
          margin-top: 8px;
          min-height: ${playerStyles.slider_wrap_height};
          padding: 0 14px;
          width: 100%;
        }

        @media (max-width: 520px) {
          .media-player-card--tv .media-player__hero {
            gap: 12px;
            grid-template-columns: min(${tvArtworkSize}, 64px) minmax(0, 1fr);
          }

          .media-player-card--tv .media-player__artwork {
            height: min(${tvArtworkSize}, 64px);
            width: min(${tvArtworkSize}, 64px);
          }

          .media-player-card--tv .media-player__tv-stack {
            width: 100%;
          }

          .media-player-card--tv .media-player__tv-actions {
            justify-content: center;
          }

          .media-player-card--tv .media-player__subtitle--tv {
            text-align: right;
          }
        }

        .media-player__tv-source-panel {
          display: flex;
          justify-content: center;
          transform-origin: top center;
          width: 100%;
        }

        .media-player__tv-source-panel--entering {
          animation: media-player-panel-in var(--media-player-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .media-player__footer {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
        }

        .media-player__tv-footer {
          display: flex;
          justify-content: flex-start;
          width: 100%;
        }

        .media-player__chips {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: center;
          min-width: 0;
        }

        .media-player__chips-wrap {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .media-player__tv-volume-wrap {
          --media-player-slider-input-height: max(44px, var(--media-player-slider-thumb-size));
          --media-player-slider-thumb-size: calc(${playerStyles.slider_thumb_size} + 12px);
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          display: grid;
          min-height: ${playerStyles.slider_wrap_height};
          padding: 0 16px;
          transform-origin: top center;
          width: min(100%, 320px);
        }

        .media-player__tv-volume-wrap--entering {
          animation: media-player-panel-in var(--media-player-panel-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .media-player__volume-slider-shell {
          min-width: 0;
          position: relative;
          width: 100%;
        }

        .media-player__volume-track {
          background:
            linear-gradient(
              90deg,
              ${playerStyles.progress_color} 0%,
              ${playerStyles.progress_color} calc(var(--media-volume, 0) * 1%),
              color-mix(in srgb, var(--primary-text-color) 8%, transparent) calc(var(--media-volume, 0) * 1%),
              color-mix(in srgb, var(--primary-text-color) 8%, transparent) 100%
            );
          border-radius: 999px;
          height: ${playerStyles.slider_height};
          left: 0;
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
        }

        .media-player__volume-slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          box-sizing: border-box;
          cursor: pointer;
          display: block;
          height: var(--media-player-slider-input-height);
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

        .media-player__volume-slider::-webkit-slider-runnable-track {
          background: transparent;
          border-radius: 999px;
          height: ${playerStyles.slider_height};
        }

        .media-player__volume-slider::-moz-range-progress {
          background: transparent;
          border: 0;
          height: ${playerStyles.slider_height};
        }

        .media-player__volume-slider::-moz-range-track {
          background: transparent;
          border: 0;
          border-radius: 999px;
          height: ${playerStyles.slider_height};
        }

        .media-player__volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: 0;
          border-radius: 50%;
          box-shadow: none;
          box-sizing: border-box;
          cursor: pointer;
          height: ${playerStyles.slider_thumb_size};
          margin-top: calc((${playerStyles.slider_height} - ${playerStyles.slider_thumb_size}) / 2);
          width: ${playerStyles.slider_thumb_size};
        }

        .media-player__volume-slider::-moz-range-thumb {
          background: transparent;
          border: 0;
          border-radius: 50%;
          box-shadow: none;
          box-sizing: border-box;
          cursor: pointer;
          height: ${playerStyles.slider_thumb_size};
          width: ${playerStyles.slider_thumb_size};
        }

        .media-player__chip {
          align-items: center;
          -webkit-backdrop-filter: blur(22px) saturate(1.35);
          backdrop-filter: blur(22px) saturate(1.35);
          background: color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #1c1c20)) 62%, color-mix(in srgb, var(--primary-text-color) 14%, transparent));
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 18%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          color: var(--primary-text-color);
          display: inline-flex;
          font-size: ${playerStyles.subtitle_size};
          font-weight: 700;
          line-height: 1;
          max-width: 100%;
          min-height: 26px;
          overflow: hidden;
          padding: 0 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-player__chip-label {
          display: block;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-player__chip--top {
          justify-content: flex-end;
          margin-left: auto;
          max-width: min(100%, 220px);
          text-align: right;
        }

        .media-player__info-rail--idle .media-player__chip--top,
        .media-player__info-rail--idle .media-player__chip--status {
          justify-content: flex-start;
          text-align: left;
        }

        .media-player__chip--status {
          max-width: min(100%, 160px);
        }

        .media-player__chip--playing {
          background: rgba(var(--rgb-primary-color), 0.16);
          border-color: rgba(var(--rgb-primary-color), 0.22);
          color: ${playerStyles.accent_color};
        }

        .media-player__chip--paused,
        .media-player__chip--buffering,
        .media-player__chip--device,
        .media-player__chip--source {
          color: var(--primary-text-color);
        }

        .media-player__chip--time {
          font-variant-numeric: tabular-nums;
        }

        .media-player__source-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          width: 100%;
        }

        .media-player__source-button {
          align-items: center;
          appearance: none;
          -webkit-backdrop-filter: blur(18px);
          backdrop-filter: blur(18px);
          background: color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent), 0 10px 24px rgba(0, 0, 0, 0.16);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: ${playerStyles.subtitle_size};
          font-weight: 700;
          justify-content: center;
          line-height: 1;
          max-width: 100%;
          min-height: 32px;
          overflow: hidden;
          padding: 0 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-player__source-button.active {
          background: ${playerStyles.accent_background};
          border-color: rgba(var(--rgb-primary-color), 0.22);
          color: ${playerStyles.accent_color};
        }

        .media-player__control,
        .media-player__volume-button,
        .media-player__source-button,
        .media-player__dot,
        .media-browser__header-button,
        .media-browser__item-play,
        .media-browser__item-main {
          transform: translateZ(0);
          transform-origin: center;
          will-change: transform;
        }

        :is(
          .media-player__control,
          .media-player__volume-button,
          .media-player__source-button,
          .media-player__dot,
          .media-browser__header-button,
          .media-browser__item-play,
          .media-browser__item-main
        ).is-pressing {
          animation: media-player-button-bounce var(--media-player-button-bounce-duration) cubic-bezier(0.22, 0.84, 0.26, 1);
        }

        .media-player__control,
        .media-player__volume-button {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          -webkit-backdrop-filter: blur(22px) saturate(1.35);
          backdrop-filter: blur(22px) saturate(1.35);
          background: color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #1c1c20)) 72%, color-mix(in srgb, var(--primary-text-color, #f4f4f4) 16%, transparent));
          border: 1px solid color-mix(in srgb, var(--primary-text-color, #f4f4f4) 22%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color, #f4f4f4) 14%, transparent), 0 10px 24px rgba(0, 0, 0, 0.28);
          color: var(--primary-text-color, #f4f4f4);
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          height: ${playerStyles.control_size};
          justify-content: center;
          line-height: 0;
          margin: 0;
          min-width: ${playerStyles.control_size};
          outline: none;
          padding: 0;
          position: relative;
          width: ${playerStyles.control_size};
        }

        .media-player__control--primary {
          background: var(--primary-color);
          border-color: color-mix(in srgb, var(--primary-color) 70%, #fff);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 10px 24px rgba(0, 0, 0, 0.32);
          color: var(--text-primary-color, #161616);
        }

        .media-player__control--active {
          background: color-mix(in srgb, var(--primary-color) 18%, ${playerStyles.accent_background});
          border-color: color-mix(in srgb, var(--primary-color) 42%, color-mix(in srgb, var(--primary-text-color) 12%, transparent));
          color: ${playerStyles.accent_color};
        }

        .media-player__control ha-icon,
        .media-player__volume-button ha-icon {
          --mdc-icon-size: calc(${playerStyles.control_size} * 0.46);
          align-items: center;
          display: inline-flex;
          height: calc(${playerStyles.control_size} * 0.46);
          justify-content: center;
          left: 50%;
          line-height: 1;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${playerStyles.control_size} * 0.46);
        }

        .media-player__dots {
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          display: inline-flex;
          gap: 4px;
          justify-content: center;
          padding: 3px;
        }

        .media-player__dot {
          align-items: center;
          appearance: none;
          background: transparent;
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          height: 24px;
          justify-content: center;
          padding: 0;
          position: relative;
          width: 24px;
        }

        .media-player__dot::before {
          background: color-mix(in srgb, var(--primary-text-color) 18%, transparent);
          border-radius: 999px;
          content: "";
          height: ${playerStyles.dot_size};
          transition: background 160ms ease, width 160ms ease;
          width: ${playerStyles.dot_size};
        }

        .media-player__dot.active::before {
          background: ${playerStyles.accent_color};
          width: calc(${playerStyles.dot_size} + 10px);
        }

        .media-browser-backdrop {
          background: ${browserStyles.backdrop};
          inset: 0;
          position: fixed;
          z-index: ${Number(config.layout.z_index) + 10};
        }

        .media-browser-backdrop--entering {
          animation: media-player-browser-backdrop-in var(--media-player-browser-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .media-browser-panel {
          background: ${browserStyles.background};
          background-color: var(--ha-card-background, var(--card-background-color, #fff));
          border: ${browserStyles.border};
          border-radius: ${browserStyles.border_radius};
          box-shadow: ${playerStyles.box_shadow}, ${browserStyles.box_shadow};
          display: flex;
          flex-direction: column;
          gap: 14px;
          inset: max(16px, calc(env(safe-area-inset-top, 0px) + 12px)) 12px max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px)) 12px;
          isolation: isolate;
          margin: 0 auto;
          max-width: 560px;
          overflow: hidden;
          padding: 14px;
          position: fixed;
          z-index: ${Number(config.layout.z_index) + 11};
        }

        .media-browser-panel::before {
          background: color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 96%, transparent);
          border-radius: inherit;
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .media-browser-panel > * {
          position: relative;
          z-index: 1;
        }

        .media-browser-panel--entering {
          animation: media-player-browser-panel-in var(--media-player-browser-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .media-browser__header {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: 40px minmax(0, 1fr) 40px;
        }

        .media-browser__header-copy {
          min-width: 0;
          text-align: center;
        }

        .media-browser__eyebrow {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .media-browser__title {
          color: var(--primary-text-color);
          font-size: 16px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-browser__header-button,
        .media-browser__item-play {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: 40px;
          justify-content: center;
          padding: 0;
          width: 40px;
        }

        .media-browser__header-button ha-icon,
        .media-browser__item-play ha-icon {
          font-size: 20px;
        }

        .media-browser__list {
          display: grid;
          gap: 10px;
          min-height: 0;
          overflow: auto;
          padding-right: 2px;
        }

        .media-browser__item {
          align-items: center;
          display: grid;
          gap: 8px;
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .media-browser__item-main {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 3%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border-radius: 20px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: grid;
          gap: 12px;
          grid-template-columns: 46px minmax(0, 1fr) auto;
          min-height: 58px;
          padding: 8px 10px;
          text-align: left;
          width: 100%;
        }

        .media-browser__item-main:disabled {
          cursor: default;
          opacity: 0.72;
        }

        .media-browser__item-artwork {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border-radius: 14px;
          display: inline-flex;
          height: 46px;
          justify-content: center;
          overflow: hidden;
          width: 46px;
        }

        .media-browser__item-artwork img,
        .media-browser__item-artwork ha-icon {
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .media-browser__item-artwork ha-icon {
          font-size: 22px;
          padding: 11px;
        }

        .media-browser__item-copy {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .media-browser__item-title {
          color: var(--primary-text-color);
          font-size: 14px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-browser__item-chevron {
          color: var(--secondary-text-color);
          font-size: 20px;
        }

        .media-browser__empty {
          align-items: center;
          color: var(--secondary-text-color);
          display: flex;
          flex: 1 1 auto;
          font-size: 13px;
          justify-content: center;
          line-height: 1.5;
          min-height: 120px;
          padding: 12px;
          text-align: center;
        }

        @keyframes media-player-button-bounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }

        @keyframes media-player-panel-in {
          0% {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.94);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes media-player-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes media-player-browser-backdrop-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }

        @keyframes media-player-browser-panel-in {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        ${animations.enabled ? "" : `
        .media-player-card,
        .media-player-card::before,
        .media-player-card::after,
        .media-player__tv-source-panel,
        .media-player__tv-volume-wrap,
        .media-browser-backdrop,
        .media-browser-panel,
        .media-player__control,
        .media-player__volume-button,
        .media-player__source-button,
        .media-player__dot,
        .media-browser__header-button,
        .media-browser__item-play,
        .media-browser__item-main,
        .media-player-card *,
        .media-browser-panel * {
          animation: none !important;
          transition: none !important;
        }
        `}

        @media (max-width: 520px) {
          .media-player__footer {
            justify-content: center;
          }

          .media-player__idle-actions--tv:not(.media-player__idle-actions--tv-off),
          .media-player__tv-footer {
            justify-content: center;
          }
        }

        @media (max-width: 420px) {
          .media-player-card:not(.media-player-card--square):not(.media-player-card--artwork) .media-player__hero {
            grid-template-columns: ${playerStyles.artwork_size} minmax(0, 1fr);
          }
        }

        .media-player-card--square,
        .media-player-card--artwork {
          align-self: start;
          aspect-ratio: 1 / 1;
          container-type: inline-size;
          display: grid;
          grid-template-rows: minmax(0, 1fr) auto;
          height: auto;
          max-height: 100%;
          max-width: 100%;
          min-height: 0;
          padding: 14px 14px 12px;
          width: 100%;
        }

        .media-player-card--square.has-album-background::before,
        .media-player-card--artwork.has-album-background::before {
          background: transparent;
        }

        .media-player-card--square.has-album-background::after,
        .media-player-card--artwork.has-album-background::after {
          background: linear-gradient(
            180deg,
            rgba(8, 8, 10, 0.46) 0%,
            rgba(8, 8, 10, 0.1) 24%,
            rgba(8, 8, 10, 0.08) 48%,
            rgba(8, 8, 10, 0.52) 74%,
            rgba(8, 8, 10, 0.78) 100%
          );
        }

        .media-player-card--square .media-player__album-bg,
        .media-player-card--square .media-player__art-layer,
        .media-player-card--artwork .media-player__album-bg,
        .media-player-card--artwork .media-player__art-layer {
          filter: none;
          inset: 0;
          opacity: 1;
          transform: none;
        }

        .media-player-card--square .media-player__art-layer.is-idle-animated,
        .media-player-card--artwork .media-player__art-layer.is-idle-animated {
          animation: none;
        }

        .media-player-card--square.has-album-background .media-player__title,
        .media-player-card--square.has-album-background .media-player__subtitle,
        .media-player-card--artwork.has-album-background .media-player__title,
        .media-player-card--artwork.has-album-background .media-player__subtitle {
          color: #fff;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45), 0 8px 24px rgba(0, 0, 0, 0.42);
        }

        .media-player-card--square .media-player__content,
        .media-player-card--artwork .media-player__content {
          align-content: stretch;
          display: grid;
          gap: 10px;
          grid-row: 1;
          grid-template-rows: auto minmax(0, 1fr) auto;
          height: 100%;
          min-height: 0;
          padding-top: 2px;
          padding-bottom: 0;
        }

        .media-player-card--square .media-player__progress,
        .media-player-card--artwork .media-player__progress {
          grid-row: 2;
          inset: auto;
          margin-top: 10px;
          position: static;
          width: 100%;
        }

        .media-player-card--square .media-player__hero,
        .media-player-card--artwork .media-player__hero {
          grid-row: 1;
          grid-template-columns: minmax(0, 1fr);
        }

        .media-player-card--square .media-player__artwork,
        .media-player-card--artwork .media-player__artwork {
          display: none;
        }

        .media-player-card--square .media-player__hero-copy,
        .media-player-card--artwork .media-player__hero-copy {
          padding-right: 44px;
        }

        .media-player-card--square .media-player__hero-top,
        .media-player-card--artwork .media-player__hero-top {
          gap: 8px;
          grid-template-columns: minmax(0, 1fr);
        }

        .media-player-card--square .media-player__info-rail,
        .media-player-card--artwork .media-player__info-rail {
          justify-self: start;
          max-width: 100%;
        }

        .media-player-card--square .media-player__title {
          font-size: 16px;
        }

        .media-player-card--square .media-player__subtitle,
        .media-player-card--artwork .media-player__subtitle {
          font-size: 13px;
        }

        .media-player-card--square .media-player__center-stack,
        .media-player-card--artwork .media-player__center-stack {
          align-content: end;
          align-self: end;
          grid-row: 3;
          min-width: 0;
          width: 100%;
        }

        .media-player-card--square .media-player__transport-row,
        .media-player-card--artwork .media-player__transport-row {
          align-content: end;
          min-width: 0;
          width: 100%;
        }

        @container (max-width: 260px) {
          .media-player__info-rail {
            display: none;
          }

          .media-player__title {
            font-size: 14px;
          }

          .media-player__subtitle {
            font-size: 12px;
          }

          .media-player-card--square .media-player__content,
          .media-player-card--artwork .media-player__content {
            gap: 6px;
          }
        }

        @container (max-width: 200px) {
          .media-player__subtitle,
          .media-player__volume-button:not(.media-player__control):not(.media-player__volume-button--browse),
          .media-player-card--square .media-player__volume-button:not(.media-player__volume-button--browse),
          .media-player-card--artwork .media-player__volume-button:not(.media-player__volume-button--browse) {
            display: none;
          }

          .media-player__title {
            font-size: 12px;
          }
        }

        .media-player-card--square,
        .media-player-card--artwork {
          container-type: inline-size;
        }

        .media-player-card--square .media-player__transport-cluster,
        .media-player-card--artwork .media-player__transport-cluster {
          display: flex;
          flex-wrap: nowrap;
          gap: 10px;
          grid-template-columns: none;
          justify-content: center;
          width: 100%;
        }

        .media-player-card--square .media-player__control,
        .media-player-card--square .media-player__volume-button:not(.media-player__volume-button--browse),
        .media-player-card--artwork .media-player__control,
        .media-player-card--artwork .media-player__volume-button:not(.media-player__volume-button--browse) {
          aspect-ratio: auto;
          flex: 0 0 auto;
          height: 36px;
          justify-self: center;
          max-width: none;
          min-width: 36px;
          width: 36px;
        }

        .media-player-card--square .media-player__control--primary,
        .media-player-card--artwork .media-player__control--primary {
          height: 40px;
          min-width: 40px;
          width: 40px;
        }

        .media-player-card--square .media-player__control ha-icon,
        .media-player-card--square .media-player__volume-button ha-icon,
        .media-player-card--artwork .media-player__control ha-icon,
        .media-player-card--artwork .media-player__volume-button ha-icon {
          --mdc-icon-size: 16px;
          height: 16px;
          width: 16px;
        }

        .media-player-card--square .media-player__volume-button--browse,
        .media-player-card--artwork .media-player__volume-button--browse {
          height: 32px;
          min-width: 32px;
          position: absolute;
          right: 10px;
          top: 10px;
          width: 32px;
          z-index: 4;
        }

        .media-player-card--chip {
          display: grid;
          padding: 10px 12px 16px;
        }

        .media-player-card--chip .media-player__content {
          align-items: center;
          gap: 8px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
          padding-bottom: 10px;
        }

        .media-player-card--chip .media-player__hero {
          align-items: center;
          grid-template-columns: 44px minmax(0, 1fr);
          min-width: 0;
        }

        .media-player-card--chip .media-player__artwork {
          height: 44px;
          width: 44px;
        }

        .media-player-card--chip .media-player__center-stack,
        .media-player-card--chip .media-player__transport-row,
        .media-player-card--chip .media-player__transport-shell {
          justify-self: end;
          max-width: 100%;
          min-width: 0;
          width: auto;
        }

        .media-player-card--chip .media-player__transport-cluster {
          flex-wrap: nowrap;
          gap: 6px;
          justify-content: flex-end;
          width: auto;
        }

        .media-player-card--chip .media-player__control,
        .media-player-card--chip .media-player__volume-button {
          height: 28px;
          min-width: 28px;
          width: 28px;
        }

        .media-player-card--chip .media-player__control ha-icon,
        .media-player-card--chip .media-player__volume-button ha-icon {
          --mdc-icon-size: 13px;
          height: 13px;
          width: 13px;
        }

        .media-player-card--chip .media-player__info-rail,
        .media-player-card--chip .media-player__volume-button--browse {
          display: none;
        }

        .media-player-card--compact .media-player__content {
          display: flex;
          flex: 1 1 auto;
          flex-direction: column;
          gap: 10px;
          justify-content: space-between;
          min-height: 0;
          padding-bottom: 0;
        }

        .media-player-card--compact .media-player__transport-cluster {
          gap: 10px;
          margin-top: auto;
        }

        .media-player-card--compact .media-player__transport-row {
          margin-top: auto;
        }

        .media-player-card--chip .media-player__footer,
        .media-player-card--square .media-player__chips-wrap,
        .media-player-card--artwork .media-player__chips-wrap,
        .media-player-card--compact .media-player__chips-wrap {
          display: none;
        }

        .media-player-card--compact .media-player__hero {
          grid-template-columns: 48px minmax(0, 1fr);
        }

        .media-player-card--compact .media-player__artwork {
          height: 48px;
          width: 48px;
        }

        @keyframes nodalia-media-kenburns {
          0% { transform: scale(1.04) translate3d(-1%, 0, 0); }
          100% { transform: scale(1.12) translate3d(1.2%, -1.1%, 0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .media-player__art-layer.is-idle-animated {
            animation: none !important;
          }
        }
        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <div class="spacer" aria-hidden="true"></div>
      <div class="dock">
        <div class="dock-inner">
          <div class="player-stack">
            ${contentMarkup}
          </div>
        </div>
      </div>
      ${mediaBrowserMarkup}
    `;
    const idleArtworkConfig = this._config?.idle_artwork || {};
    const artworkEntityId = String(this._activePlayerEntity || "");
    const keepIdleArtwork = Boolean(this._activeArtworkIdle)
      && idleArtworkConfig.enabled !== false
      && this._artworkController.recentFor(artworkEntityId).length > 0;
    this._commitPersistentMediaShadow(markup, {
      artworkUrl: this._activeArtworkUrl || "",
      idle: Boolean(this._activeArtworkIdle),
      entityId: artworkEntityId,
      hasAlbumBackground: Boolean(contentMarkup)
        && this._config.album_cover_background !== false
        && Boolean(this._activeArtworkUrl || keepIdleArtwork),
    });

    this._restoreMediaBrowserScrollState();
    this._restoreTvPanelScrollState();
    const mediaBrowserDialog = this.shadowRoot.querySelector('.media-browser-panel[role="dialog"]');
    if (mediaBrowserDialog instanceof HTMLElement) {
      window.NodaliaUtils?.bindModalFocus?.(this, mediaBrowserDialog, {
        initialFocusSelector: '[data-media-browser-close="true"]',
      });
    } else {
      window.NodaliaUtils?.releaseModalFocus?.(this);
    }
    this._tvSourcePanelAnimatingEntity = null;
    this._tvVolumePanelAnimatingEntity = null;
    if (this._mediaBrowserState?.animateIn === true) {
      this._mediaBrowserState = {
        ...this._mediaBrowserState,
        animateIn: false,
      };
    }

    if (animations.enabled && playerCardRender.animateEntranceApplied) {
      this._scheduleEntranceAnimationReset(clamp(Math.round(animations.panelDuration * 0.9), 180, 900) + 120);
    }
    this._lastRenderSignature = this._getRenderSignature(this._hass);
  }

  _commitPersistentMediaShadow(markup, artOptions = {}) {
    if (!this.shadowRoot) {
      return;
    }
    const styleStart = markup.indexOf("<style>");
    const styleEnd = markup.indexOf("</style>");
    if (styleStart < 0 || styleEnd < 0) {
      this.shadowRoot.innerHTML = markup;
      return;
    }
    const css = markup.slice(styleStart + 7, styleEnd);
    const body = markup.slice(styleEnd + 8);
    const previousArt = this._artworkStageEl instanceof HTMLElement
      ? this._artworkStageEl
      : this.shadowRoot.querySelector("[data-media-art-stage]");
    // Park outside chrome before wiping so identity survives the commit.
    if (previousArt instanceof HTMLElement && previousArt.parentNode !== this.shadowRoot) {
      this.shadowRoot.appendChild(previousArt);
    }

    let styleEl = this.shadowRoot.querySelector("[data-media-style]");
    let chrome = this.shadowRoot.querySelector("[data-media-chrome]");
    if (!(styleEl instanceof HTMLStyleElement) || !(chrome instanceof HTMLElement)) {
      const keptArt = previousArt instanceof HTMLElement ? previousArt : null;
      this.shadowRoot.innerHTML = `<style data-media-style></style><div data-media-chrome></div>`;
      styleEl = this.shadowRoot.querySelector("[data-media-style]");
      chrome = this.shadowRoot.querySelector("[data-media-chrome]");
      if (keptArt) {
        this.shadowRoot.appendChild(keptArt);
      }
    }
    if (styleEl.textContent !== css) {
      styleEl.textContent = css;
    }
    chrome.innerHTML = body;

    const card = this.shadowRoot.querySelector(".media-player-card");
    if (card instanceof HTMLElement && artOptions.hasAlbumBackground) {
      const stage = previousArt instanceof HTMLElement
        ? previousArt
        : this._createArtworkStage();
      this._artworkStageEl = stage;
      if (stage.parentElement !== card || card.firstChild !== stage) {
        card.insertBefore(stage, card.firstChild);
      }
      this._syncArtworkLayer(stage, artOptions);
    } else if (this._artworkController) {
      if (previousArt instanceof HTMLElement) {
        previousArt.remove();
      }
      this._artworkStageEl = null;
      this._artworkController.clear();
      this._artworkController.detach();
    }
  }

  _createArtworkStage() {
    const stage = document.createElement("div");
    stage.className = "media-player__art-stage";
    stage.setAttribute("data-media-art-stage", "");
    stage.innerHTML = `
      <div class="media-player__album-bg media-player__art-layer is-current" data-media-art-current></div>
      <div class="media-player__album-bg media-player__art-layer is-incoming" data-media-art-incoming></div>
    `;
    return stage;
  }

  _syncArtworkLayer(stage, artOptions = {}) {
    if (!(stage instanceof HTMLElement)) {
      return;
    }
    const current = stage.querySelector("[data-media-art-current]");
    const incoming = stage.querySelector("[data-media-art-incoming]");
    if (!(current instanceof HTMLElement) || !(incoming instanceof HTMLElement)) {
      return;
    }
    this._artworkController.attach({ stage, current, incoming });
    const config = this._config || {};
    const idleConfig = config.idle_artwork || {};
    const playing = !artOptions.idle;
    const artworkUrl = String(artOptions.artworkUrl || "").trim();
    const entityId = String(artOptions.entityId || this._activePlayerEntity || "");
    const entityRecent = this._artworkController.recentFor(entityId);
    if (this._idleSlideshowUrl && !entityRecent.includes(this._idleSlideshowUrl)) {
      this._idleSlideshowUrl = "";
    }
    if (artworkUrl) {
      this._artworkController.remember(artworkUrl, idleConfig.max_items, entityId);
      this._artworkController.stopSlideshow();
      this._artworkController.show(artworkUrl, {
        crossfade: config.artwork?.crossfade !== false,
        duration: config.artwork?.crossfade_duration,
        idle: Boolean(artOptions.idle) && idleConfig.animation === "subtle",
        animation: idleConfig.animation,
        connected: this.isConnected,
        entityId,
      });
      if (config.artwork?.dynamic_colors !== false) {
        sampleArtworkPalette(artworkUrl).then(palette => {
          if (!this.isConnected || !palette) {
            return;
          }
          this._artworkController.palette = palette;
          stage.style.setProperty("--nodalia-media-accent", palette.primary);
        }).catch(() => {});
      }
      return;
    }

    if (playing || idleConfig.enabled === false || !entityRecent.length) {
      this._artworkController.clear();
      return;
    }

    const first = (this._idleSlideshowUrl && entityRecent.includes(this._idleSlideshowUrl)
      ? this._idleSlideshowUrl
      : entityRecent[0]) || "";
    if (first) {
      this._artworkController.show(first, {
        crossfade: config.artwork?.crossfade !== false,
        duration: Math.max(config.artwork?.crossfade_duration || 500, 700),
        idle: true,
        animation: idleConfig.animation,
        connected: this.isConnected,
        entityId,
      });
    }
    this._artworkController.startSlideshow(idleConfig, url => {
      if (!this.isConnected) {
        return;
      }
      this._idleSlideshowUrl = url;
      this._artworkController.show(url, {
        crossfade: true,
        duration: Math.max(config.artwork?.crossfade_duration || 500, 700),
        idle: true,
        animation: idleConfig.animation,
        connected: this.isConnected,
        entityId,
      });
    }, entityId);
  }

  _startProgressDrag(track, clientX, event = null, pointerId = null) {
    if (!(track instanceof HTMLElement) || track.dataset.mediaProgress !== "seek") {
      return;
    }
    const entityId = track.dataset.entity || "";
    const state = this._hass?.states?.[entityId];
    const progress = state ? this._getPlayerProgress(state) : null;
    if (!progress || !supportsMediaSeek(state)) {
      return;
    }
    const percent = progressPercentFromClientX(track, clientX);
    this._activeProgressDrag = { entityId, percent, pointerId, track };
    this._attachWindowDragListeners();
    this._updateProgressFill(track, percent, progress.duration);
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  _updateProgressFill(track, percent, duration) {
    const fill = track.querySelector(".media-player__progress-fill");
    if (fill instanceof HTMLElement) {
      fill.style.width = `${percent}%`;
    }
    track.setAttribute("aria-valuenow", String(seekPositionFromPercent(percent, duration)));
  }

  _moveProgressDrag(clientX) {
    const drag = this._activeProgressDrag;
    if (!drag) {
      return;
    }
    const state = this._hass?.states?.[drag.entityId];
    const duration = Number(state?.attributes?.media_duration || 0);
    drag.percent = progressPercentFromClientX(drag.track, clientX);
    this._updateProgressFill(drag.track, drag.percent, duration);
  }

  _commitProgressDrag() {
    const drag = this._activeProgressDrag;
    if (!drag) {
      return;
    }
    const state = this._hass?.states?.[drag.entityId];
    const duration = Number(state?.attributes?.media_duration || 0);
    const seekPosition = seekPositionFromPercent(drag.percent, duration);
    this._activeProgressDrag = null;
    this._detachWindowDragListeners();
    if (duration > 0 && drag.entityId) {
      this._callInternalMediaService("media_seek", {
        entity_id: drag.entityId,
        seek_position: seekPosition,
      });
    }
    if (this._pendingRenderAfterDrag) {
      this._pendingRenderAfterDrag = false;
      this._render();
    }
  }
}
  _lazyNodaliaMediaPlayer = NodaliaMediaPlayer;
  return NodaliaMediaPlayer;
}
