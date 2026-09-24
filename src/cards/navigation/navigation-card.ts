// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  CARD_VERSION,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  MUSIC_ASSISTANT_BROWSER_EXCLUDE_PATTERNS,
  MUSIC_ASSISTANT_DIRECTORY_ICON_RULES,
} from "./navigation-constants";
import {
  clamp,
  deepClone,
  escapeHtml,
  fireEvent,
  isObject,
} from "./navigation-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./navigation-config";
import {
  appendQueryParam,
  escapeSelectorValue,
  formatDuration,
  getRenderSignatureRuntime,
  matchPath,
  normalizePath,
  normalizeTextKey,
  sanitizeCssRuntimeValue,
  sanitizeMediaArtworkUrl,
} from "./navigation-helpers";

let _lazyNodaliaNavigationBarCard;
export function loadNodaliaNavigationBarCard() {
  if (_lazyNodaliaNavigationBarCard) {
    return _lazyNodaliaNavigationBarCard;
  }
class NodaliaNavigationBarCard extends HTMLElement {
  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    const config = deepClone(STUB_CONFIG);
    const entityId = window.NodaliaUtils?.findStubEntityIds?.(hass, entities, entitiesFallback, ["media_player"], 1)[0] || "";
    if (entityId) {
      config.media_player = {
        players: [{
          entity: entityId,
          label: hass?.states?.[entityId]?.attributes?.friendly_name || "",
        }],
      };
    }
    return config;
  }

  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._renderedRoutes = [];
    this._popupState = null;
    this._mediaBrowserState = null;
    this._mediaBrowserRequestToken = 0;
    this._popupPositionFrame = null;
    this._activeMediaPlayerIndex = 0;
    this._activeMediaPlayerEntity = "";
    this._mediaPlayerExpanded = false;
    this._mediaTicker = null;
    this._lastRenderSignature = "";
    this._animateDockEntranceNext = true;
    this._dockEntrancePlayed = false;
    this._dockEntranceResetFrame = 0;
    this._lastShouldHide = false;
    this._playDockEntrance = false;
    this._lastMediaToggleVisible = false;
    this._playPopupEntrance = false;
    this._lastMediaPlayerCardVisible = false;
    this._onResize = () => {
      this._closePopup(false);
      this._closeMediaBrowser(false);
      this._render();
    };
    this._onLocationChange = () => {
      this._closePopup(false);
      this._closeMediaBrowser(false);
      this._render();
    };
    this._onWindowKeyDown = event => {
      if (event.key === "Escape" && this._mediaBrowserState) {
        event.preventDefault();
        this._closeMediaBrowser();
        return;
      }

      if (event.key === "Escape" && this._popupState) {
        event.preventDefault();
        this._closePopup();
      }
    };
    this._onVisibilityChange = () => {
      if (typeof document !== "undefined" && document.hidden) {
        if (this._mediaTicker) {
          window.clearInterval(this._mediaTicker);
          this._mediaTicker = null;
        }
        return;
      }

      this._render();
    };
    this._onShadowClick = this._onShadowClick.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    }

  connectedCallback() {
    window.addEventListener("resize", this._onResize);
    window.addEventListener("popstate", this._onLocationChange);
    window.addEventListener("location-changed", this._onLocationChange);
    window.addEventListener("keydown", this._onWindowKeyDown);
    document.addEventListener("visibilitychange", this._onVisibilityChange);
    this._render();
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("popstate", this._onLocationChange);
    window.removeEventListener("location-changed", this._onLocationChange);
    window.removeEventListener("keydown", this._onWindowKeyDown);
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    this._mediaBrowserRequestToken += 1;
    this._mediaBrowserState = null;
    if (this._popupPositionFrame) {
      cancelAnimationFrame(this._popupPositionFrame);
      this._popupPositionFrame = null;
    }
    if (this._mediaTicker) {
      window.clearInterval(this._mediaTicker);
      this._mediaTicker = null;
    }
    if (this._dockEntranceResetFrame) {
      window.cancelAnimationFrame(this._dockEntranceResetFrame);
      this._dockEntranceResetFrame = 0;
    }
    window.NodaliaUtils?.clearDeferTimers?.(this);
  }

  setConfig(config) {
    this._config = normalizeConfig(config);
    this._lastRenderSignature = "";
    this._render();
  }

  set hass(hass) {
    const nextSignature = this._getRenderSignature(hass);
    this._hass = hass;
    if (!this.isConnected) {
      return;
    }
    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      this._patchMediaVolumeControls();
      return;
    }
    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 1,
      min_columns: 4,
    };
  }

  _getTrackedEntityIds() {
    const entityIds = new Set();

    (this._config?.routes || []).forEach(route => {
      if (route?.badge?.entity) {
        entityIds.add(route.badge.entity);
      }
      (route?.popup || []).forEach(item => {
        if (item?.badge?.entity) {
          entityIds.add(item.badge.entity);
        }
      });
    });

    (this._config?.media_player?.players || []).forEach(player => {
      if (player?.entity) {
        entityIds.add(player.entity);
      }
    });

    const tag = window.NodaliaI18n.localeTag(window.NodaliaI18n.resolveLanguage(this._hass, this._config?.language));
    return [...entityIds].sort((left, right) => left.localeCompare(right, tag));
  }

  _getRenderSignature(hass = this._hass) {
    const runtime = getRenderSignatureRuntime();
    const routeBadgeStates = this._getRouteBadgeSignatureRows(hass, runtime);
    const mediaPlayerStates = this._getMediaPlayerSignatureRows(hass, runtime);

    return runtime.joinParts([
      {
        prefix: "l:",
        values: [window.NodaliaI18n.resolveLanguage(hass, this._config?.language)],
      },
      { prefix: "u:", values: [hass?.user?.id || ""] },
      { prefix: "r:", values: [routeBadgeStates.join("|")] },
      { prefix: "m:", values: [mediaPlayerStates.join("|")] },
      { prefix: "mx:", values: [this._mediaPlayerExpanded ? 1 : 0] },
      { prefix: "mi:", values: [Number(this._activeMediaPlayerIndex || 0)] },
      { prefix: "po:", values: [this._popupState ? 1 : 0] },
      { prefix: "mb:", values: [this._mediaBrowserState ? 1 : 0] },
    ]);
  }

  _getRouteBadgeSignatureRows(hass, runtime) {
    return (this._config?.routes || []).flatMap((route, routeIndex) => {
      const items = [{ badge: route?.badge, scope: `route:${routeIndex}` }];
      (route?.popup || []).forEach((item, popupIndex) => {
        items.push({ badge: item?.badge, scope: `popup:${routeIndex}:${popupIndex}` });
      });

      return items
        .filter(item => item?.badge?.entity)
        .map(item => {
          const state = hass?.states?.[item.badge.entity] || null;
          const attribute = String(item.badge.attribute || "");
          return runtime.joinParts([
            {
              values: [
                item.scope,
                item.badge.entity || "",
                state?.state || "",
                attribute,
                attribute ? state?.attributes?.[attribute] ?? "" : state?.state || "",
              ],
            },
          ], "", "::");
        });
    });
  }

  _getMediaPlayerSignatureRows(hass, runtime) {
    return (this._config?.media_player?.players || [])
      .filter(player => player?.entity)
      .map(player => {
        const state = hass?.states?.[player.entity] || null;
        const attrs = state?.attributes || {};
        return runtime.joinParts([
          {
            values: [
              player.entity || "",
              state?.state || "",
              attrs.friendly_name || "",
              attrs.entity_picture || "",
              attrs.media_title || "",
              attrs.media_artist || "",
              attrs.media_series_title || "",
              attrs.media_album_name || "",
              attrs.app_name || "",
              attrs.source || "",
              attrs.media_channel || "",
              typeof attrs.volume_level === "number" ? 1 : 0,
              Number(attrs.media_duration ?? -1),
              Number(attrs.supported_features ?? 0),
              Array.isArray(attrs.source_list) ? attrs.source_list.join("|") : "",
            ],
          },
        ], "", "::");
      });
  }

  _triggerHaptic(style = this._config?.haptics?.style) {
    if (!this._config?.haptics?.enabled) {
      return;
    }

    const hapticStyle = String(style || "medium");

    try {
      fireEvent(this, "haptic", hapticStyle);
    } catch (_error) {
      // Ignore event dispatch issues and try browser vibration fallback below.
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

  _onShadowClick(event) {
    const popupCloseTrigger = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.popupClose === "true");

    if (popupCloseTrigger) {
      event.preventDefault();
      event.stopPropagation();
      this._closePopup();
      return;
    }

    const mediaControlButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaControl);

    if (mediaControlButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._handleMediaControl(
        mediaControlButton.dataset.mediaControl,
        mediaControlButton.dataset.entity,
        {
          muted: mediaControlButton.dataset.mediaMuted === "true",
          path: mediaControlButton.dataset.mediaPath,
          volume: Number(mediaControlButton.dataset.mediaVolume),
        },
      );
      return;
    }

    const mediaToggleButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaToggle);

    if (mediaToggleButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      this._mediaPlayerExpanded = mediaToggleButton.dataset.mediaToggle === "expand";
      this._render();
      return;
    }

    const mediaDotButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaIndex !== undefined);

    if (mediaDotButton) {
      event.preventDefault();
      event.stopPropagation();
      this._triggerHaptic();
      const visiblePlayers = this._getVisibleMediaPlayers();
      this._activeMediaPlayerIndex = clamp(
        Number(mediaDotButton.dataset.mediaIndex),
        0,
        Math.max(0, visiblePlayers.length - 1),
      );
      this._activeMediaPlayerEntity = String(visiblePlayers[this._activeMediaPlayerIndex]?.entity || "");
      this._render();
      return;
    }

    const mediaBrowserCloseButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaBrowserClose === "true");

    if (mediaBrowserCloseButton) {
      event.preventDefault();
      event.stopPropagation();
      this._closeMediaBrowser();
      return;
    }

    const mediaBrowserBackButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaBrowserBack === "true");

    if (mediaBrowserBackButton) {
      event.preventDefault();
      event.stopPropagation();
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
      const action = mediaBrowserActionButton.dataset.mediaBrowserAction;
      const mediaContentType = mediaBrowserActionButton.dataset.mediaContentType || "";
      const mediaContentId = mediaBrowserActionButton.dataset.mediaContentId || "";

      if (action === "browse") {
        this._browseMediaBrowserItem(mediaContentType, mediaContentId);
        return;
      }

      if (action === "play") {
        this._playMediaBrowserItem(mediaContentType, mediaContentId);
        return;
      }
    }

    const mediaCard = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.mediaCardIndex !== undefined);

    if (mediaCard) {
      const visiblePlayers = this._getVisibleMediaPlayers();
      const player = visiblePlayers[Number(mediaCard.dataset.mediaCardIndex)];

      if (player) {
        event.preventDefault();
        event.stopPropagation();
        this._triggerHaptic();
        this._runAction(player, {
          closePopup: false,
          defaultAction: {
            action: "more-info",
            entity: player.entity,
          },
        });
      }
      return;
    }

    const popupButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.popupItemIndex !== undefined);

    if (popupButton) {
      const routeIndex = Number(popupButton.dataset.popupRouteIndex);
      const popupItemIndex = Number(popupButton.dataset.popupItemIndex);
      const route = this._renderedRoutes[routeIndex];
      const popupItems = this._getPopupItems(route);
      const popupItem = popupItems[popupItemIndex];

      if (popupItem) {
        event.preventDefault();
        event.stopPropagation();
        this._triggerHaptic();
        this._runAction(popupItem, {
          closePopup: true,
        });
      }
      return;
    }

    const routeButton = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.routeIndex !== undefined);

    if (!routeButton) {
      return;
    }

    const index = Number(routeButton.dataset.routeIndex);
    const route = this._renderedRoutes[index];

    if (!route) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();
    this._runAction(route, {
      anchorElement: routeButton,
    });
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

  _shouldHideForScreen(config) {
    if (this._isInEditMode()) {
      return false;
    }

    if (config.layout.show_desktop) {
      return false;
    }

    return window.innerWidth > Number(config.layout.mobile_breakpoint || 1279);
  }

  _isItemVisible(item) {
    if (!item || item.hidden === true || item.show === false) {
      return false;
    }

    if (this._isInEditMode()) {
      return true;
    }

    const currentUserId = this._hass?.user?.id;
    if (Array.isArray(item.users) && item.users.length > 0) {
      return item.users.includes(currentUserId);
    }

    return true;
  }

  _getVisibleRoutes() {
    if (!this._config) {
      return [];
    }

    return this._config.routes.filter(route => this._isItemVisible(route));
  }

  _getPopupItems(route) {
    if (!route || !Array.isArray(route.popup)) {
      return [];
    }

    return route.popup.filter(item => this._isItemVisible(item));
  }

  _getRoutePath(route) {
    if (typeof route.path === "string" && route.path) {
      return route.path;
    }

    if (route.tap_action?.action === "navigate" && route.tap_action.navigation_path) {
      return route.tap_action.navigation_path;
    }

    return null;
  }

  _isNavItemActive(item, currentPath) {
    if (!item) {
      return false;
    }

    if (item.selected === true) {
      return true;
    }

    const candidates = [];
    const mainPath = normalizePath(this._getRoutePath(item));
    if (mainPath) {
      candidates.push(mainPath);
    }

    if (Array.isArray(item.active_paths)) {
      item.active_paths.forEach(path => {
        const normalized = normalizePath(path);
        if (normalized) {
          candidates.push(normalized);
        }
      });
    }

    return candidates.some(path => matchPath(currentPath, path, item.match || "exact"));
  }

  _isRouteActive(route, currentPath) {
    if (this._isNavItemActive(route, currentPath)) {
      return true;
    }

    return this._getPopupItems(route).some(item => this._isNavItemActive(item, currentPath));
  }

  _getBadge(route) {
    const badge = route.badge;

    if (badge === undefined || badge === null || badge === false) {
      return null;
    }

    if (typeof badge === "string" || typeof badge === "number") {
      return {
        content: String(badge),
        background: this._config.styles.badge.background,
        color: this._config.styles.badge.color,
      };
    }

    if (badge.show === false) {
      return null;
    }

    let content = badge.content;

    if (content === undefined && badge.entity && this._hass?.states?.[badge.entity]) {
      const stateObject = this._hass.states[badge.entity];
      content = badge.attribute ? stateObject.attributes?.[badge.attribute] : stateObject.state;
    }

    if (content === undefined || content === null || content === "") {
      return null;
    }

    if (!badge.show_unavailable && ["unknown", "unavailable", "none"].includes(String(content).toLowerCase())) {
      return null;
    }

    if (!badge.show_zero && Number(content) === 0) {
      return null;
    }

    if (!Number.isNaN(Number(content)) && Number(content) > Number(badge.max || 99)) {
      content = `${badge.max || 99}+`;
    }

    return {
      content: String(content),
      background: badge.background || this._config.styles.badge.background,
      color: badge.color || this._config.styles.badge.color,
    };
  }

  _getRouteLabel(route) {
    return route?.label || route?.name || route?.title || "";
  }

  _shouldShowRouteLabels(routes) {
    if (!this._config?.show_labels) {
      return false;
    }

    return routes.some(route => Boolean(this._getRouteLabel(route)));
  }

  _getPopupLayout(route) {
    const layout = route?.popup_layout || this._config?.styles?.popup?.layout || "auto";
    return ["auto", "vertical", "horizontal"].includes(layout) ? layout : "auto";
  }

  _getPopupMetrics(route, items) {
    const popupStyles = this._config?.styles?.popup || {};
    const popupMinWidth = Number.parseFloat(popupStyles.min_width || "220") || 220;
    const popupMaxWidth =
      Number.parseFloat(popupStyles.max_width || popupStyles.min_width || "380") ||
      Math.max(popupMinWidth, 380);
    const itemSize = Number.parseFloat(popupStyles.item_size || "48") || 48;
    const itemGap = Number.parseFloat(popupStyles.item_gap || "12") || 12;
    const panelPadding = Number.parseFloat(popupStyles.padding || "12") || 12;
    const viewportWidth = Math.max(240, (window.innerWidth || popupMaxWidth) - 24);
    const maxWidth = Math.max(Math.min(popupMaxWidth, viewportWidth), Math.min(popupMinWidth, viewportWidth));
    const minWidth = Math.min(popupMinWidth, maxWidth);
    const hasText = items.some(item => Boolean(this._getRouteLabel(item) || item.description));
    const itemMinWidth = itemSize + (hasText ? 42 : 20);
    const maxColumnsThatFit = Math.max(
      1,
      Math.min(
        items.length || 1,
        Math.floor((maxWidth - panelPadding * 2 + itemGap) / (itemMinWidth + itemGap)),
      ),
    );

    let columns = 1;
    const layout = this._getPopupLayout(route);
    if (layout === "horizontal") {
      columns = maxColumnsThatFit;
    } else if (layout === "auto") {
      columns = items.length <= 2 ? 1 : maxColumnsThatFit;
    }

    columns = Math.max(1, Math.min(columns, items.length || 1));

    const rows = Math.max(1, Math.ceil((items.length || 1) / columns));
    const widthFromColumns =
      columns * itemMinWidth + Math.max(0, columns - 1) * itemGap + panelPadding * 2;
    const minimumWidth = Math.min(
      maxWidth,
      !hasText && columns === 1 ? Math.max(itemSize + panelPadding * 2 + 20, 88) : minWidth,
    );
    const width = clamp(widthFromColumns, minimumWidth, maxWidth);
    const rowHeight = itemSize + (hasText ? 56 : 26);
    const viewportHeight = Math.max(160, (window.innerHeight || 320) - 48);
    const estimatedHeight = Math.min(
      Math.max(120, rows * rowHeight + panelPadding * 2),
      viewportHeight,
    );

    return {
      columns,
      estimatedHeight,
      hasText,
      itemMinWidth,
      layout,
      width,
    };
  }

  _renderIcon(route, isActive) {
    const image = isActive ? route.image_active || route.image : route.image || route.image_active;

    if (image) {
      return `<img class="nav-image" src="${escapeHtml(image)}" alt="${escapeHtml(this._getRouteLabel(route) || "navigation item")}" />`;
    }

    const icon = isActive ? route.icon_active || route.icon : route.icon || route.icon_active;
    if (!icon) {
      return `<span class="nav-icon nav-icon--placeholder"></span>`;
    }

    return `<ha-icon class="nav-icon" icon="${escapeHtml(icon)}"></ha-icon>`;
  }

  _getRouteAction(route, defaultAction = null) {
    if (!route) {
      return defaultAction;
    }

    if (route.tap_action) {
      return route.tap_action;
    }

    if (Array.isArray(route.popup) && route.popup.length > 0) {
      return {
        action: "open-popup",
      };
    }

    if (route.path) {
      return {
        action: "navigate",
        navigation_path: route.path,
      };
    }

    return defaultAction;
  }

  _navigate(path) {
    if (!path) {
      return;
    }

    window.history.pushState(null, "", path);
    window.dispatchEvent(new Event("location-changed"));
  }

  _callService(action) {
    if (!this._hass || !action?.service) {
      return;
    }

    if (!this._isServiceAllowed(action.service)) {
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Navigation Bar", action.service);
      return;
    }

    const [domain, service] = String(action.service).split(".");
    if (!domain || !service) {
      return;
    }

    this._hass.callService(domain, service, action.service_data || {}, action.target);
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

  _applyRouteRuntimeStyles(visibleRoutes, playDockEntrance) {
    if (!this.shadowRoot) {
      return;
    }
    visibleRoutes.forEach((route, index) => {
      const node = this.shadowRoot.querySelector(`.nav-item[data-route-index="${index}"]`);
      if (!(node instanceof HTMLElement)) {
        return;
      }
      if (playDockEntrance) {
        node.style.setProperty("--nav-enter-delay", `${Math.min(index * 38, 520)}ms`);
      }
      const routeBackground = sanitizeCssRuntimeValue(route.background);
      const routeColor = sanitizeCssRuntimeValue(route.color);
      const routeActiveColor = sanitizeCssRuntimeValue(route.active_color);
      const routeActiveBackground = sanitizeCssRuntimeValue(route.active_background);
      if (routeBackground) node.style.setProperty("--route-background", routeBackground);
      if (routeColor) node.style.setProperty("--route-color", routeColor);
      if (routeActiveColor) node.style.setProperty("--route-active-color", routeActiveColor);
      if (routeActiveBackground) node.style.setProperty("--route-active-background", routeActiveBackground);
      const badge = this._getBadge(route);
      const badgeNode = node.querySelector(".nav-badge");
      if (badgeNode instanceof HTMLElement) {
        const badgeBackground = sanitizeCssRuntimeValue(badge.background);
        const badgeColor = sanitizeCssRuntimeValue(badge.color);
        if (badgeBackground) badgeNode.style.setProperty("--badge-background", badgeBackground);
        if (badgeColor) badgeNode.style.setProperty("--badge-color", badgeColor);
      }
    });
  }

  _applyPopupRuntimeStyles() {
    if (!this.shadowRoot || !this._popupState?.route) {
      return;
    }
    const panel = this.shadowRoot.querySelector(".popup-panel");
    if (panel instanceof HTMLElement) {
      const popupItems = this._getPopupItems(this._popupState.route);
      const popupHasText = popupItems.some(item => Boolean(this._getRouteLabel(item) || item.description));
      const isCompactPopup = !popupHasText && Number(this._popupState.columns || 1) === 1;
      panel.style.left = this._popupState.left;
      panel.style.top = this._popupState.top;
      panel.style.width = isCompactPopup ? "fit-content" : this._popupState.width;
      panel.style.setProperty("--popup-columns", String(this._popupState.columns || 1));
      panel.style.setProperty(
        "--popup-item-min",
        this._popupState.itemMinWidth || `calc(${this._config.styles.popup.item_size} + 24px)`,
      );
    }
    const popupItems = this._getPopupItems(this._popupState.route);
    popupItems.forEach((item, popupIndex) => {
      const node = this.shadowRoot.querySelector(`.popup-item[data-popup-item-index="${popupIndex}"]`);
      if (!(node instanceof HTMLElement)) {
        return;
      }
      const itemBackground = sanitizeCssRuntimeValue(item.background);
      const itemColor = sanitizeCssRuntimeValue(item.color);
      const itemActiveColor = sanitizeCssRuntimeValue(item.active_color);
      const itemActiveBackground = sanitizeCssRuntimeValue(item.active_background);
      if (itemBackground) node.style.setProperty("--popup-route-background", itemBackground);
      if (itemColor) node.style.setProperty("--popup-route-color", itemColor);
      if (itemActiveColor) node.style.setProperty("--popup-route-active-color", itemActiveColor);
      if (itemActiveBackground) node.style.setProperty("--popup-route-active-background", itemActiveBackground);
      const badge = this._getBadge(item);
      const badgeNode = node.querySelector(".nav-badge");
      if (badgeNode instanceof HTMLElement) {
        const badgeBackground = sanitizeCssRuntimeValue(badge.background);
        const badgeColor = sanitizeCssRuntimeValue(badge.color);
        if (badgeBackground) badgeNode.style.setProperty("--badge-background", badgeBackground);
        if (badgeColor) badgeNode.style.setProperty("--badge-color", badgeColor);
      }
    });
  }

  _closePopup(shouldRender = true) {
    if (!this._popupState) {
      return;
    }

    if (this._popupPositionFrame) {
      cancelAnimationFrame(this._popupPositionFrame);
      this._popupPositionFrame = null;
    }

    this._popupState = null;
    if (shouldRender) {
      this._render();
    }
  }

  _schedulePopupPositionSync() {
    if (!this._popupState || !this.shadowRoot) {
      return;
    }

    if (this._popupPositionFrame) {
      cancelAnimationFrame(this._popupPositionFrame);
    }

    this._popupPositionFrame = requestAnimationFrame(() => {
      this._popupPositionFrame = null;
      this._syncPopupPosition();
    });
  }

  _syncPopupPosition() {
    if (!this._popupState || !this.shadowRoot) {
      return;
    }

    const panel = this.shadowRoot.querySelector(".popup-panel");
    const anchor = this.shadowRoot.querySelector(
      `[data-route-index="${escapeSelectorValue(this._popupState.routeIndex)}"]`,
    );

    if (!(panel instanceof HTMLElement) || !(anchor instanceof HTMLElement)) {
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const preferredGap = this._popupState.layout === "horizontal" ? 4 : 6;
    const previousDirection = this._popupState.direction;
    let direction = previousDirection;
    let left = anchorRect.left + anchorRect.width / 2 - panelRect.width / 2;

    left = clamp(left, 12, Math.max(12, window.innerWidth - panelRect.width - 12));

    let top = direction === "up"
      ? anchorRect.top - panelRect.height - preferredGap
      : anchorRect.bottom + preferredGap;

    if (direction === "up" && top < 12) {
      direction = "down";
      top = anchorRect.bottom + preferredGap;
    }

    if (direction === "down" && top + panelRect.height > window.innerHeight - 12) {
      direction = "up";
      top = anchorRect.top - panelRect.height - preferredGap;
    }

    top = clamp(top, 12, Math.max(12, window.innerHeight - panelRect.height - 12));

    const nextLeft = `${left}px`;
    const nextTop = `${top}px`;

    this._popupState = {
      ...this._popupState,
      direction,
      left: nextLeft,
      top: nextTop,
      width: `${panelRect.width}px`,
    };

    if (direction !== previousDirection) {
      this._render();
      return;
    }

    panel.style.left = nextLeft;
    panel.style.top = nextTop;
  }

  _openPopup(route, anchorElement) {
    const items = this._getPopupItems(route);
    if (!items.length || !anchorElement) {
      return;
    }

    // Avoid replaying dock entrance classes on the same frame the popup opens.
    this._animateDockEntranceNext = false;
    this._playDockEntrance = false;

    const anchorRect = anchorElement.getBoundingClientRect();
    const popupMetrics = this._getPopupMetrics(route, items);
    const popupWidth = popupMetrics.width;
    const estimatedHeight = popupMetrics.estimatedHeight;
    const preferredGap = popupMetrics.layout === "horizontal" ? 4 : 6;
    let direction = this._config.layout.position === "top" ? "down" : "up";
    let left = anchorRect.left + anchorRect.width / 2 - popupWidth / 2;

    left = clamp(left, 12, window.innerWidth - popupWidth - 12);

    let top = direction === "up"
      ? anchorRect.top - estimatedHeight - preferredGap
      : anchorRect.bottom + preferredGap;

    if (direction === "up" && top < 12) {
      direction = "down";
      top = anchorRect.bottom + preferredGap;
    }

    if (direction === "down" && top + estimatedHeight > window.innerHeight - 12) {
      direction = "up";
      top = anchorRect.top - estimatedHeight - preferredGap;
    }

    top = clamp(top, 12, Math.max(12, window.innerHeight - estimatedHeight - 12));

    const routeIndex = this._renderedRoutes.indexOf(route);
    if (routeIndex < 0) {
      return;
    }

    this._popupState = {
      columns: popupMetrics.columns,
      direction,
      itemMinWidth: `${popupMetrics.itemMinWidth}px`,
      layout: popupMetrics.layout,
      left: `${left}px`,
      top: `${top}px`,
      route,
      routeIndex,
      width: `${popupWidth}px`,
    };
    this._playPopupEntrance = true;
    this._render();
  }

  _getReservedHeight(showMediaPlayer, showMediaPlayerToggle = false) {
    const baseHeight = this._config.layout.reserve_height;
    const mediaGap = this._config.media_player.gap || "0px";

    if (!showMediaPlayer) {
      if (showMediaPlayerToggle) {
        return `calc(${baseHeight} + ${mediaGap} + 48px)`;
      }

      return baseHeight;
    }

    const mediaHeight =
      this._config.media_player.reserve_height ||
      this._config.styles.media_player.min_height;

    return `calc(${baseHeight} + ${mediaGap} + ${mediaHeight})`;
  }

  _shouldShowMediaPlayerOnCurrentScreen() {
    if (this._isInEditMode()) {
      return true;
    }

    const isDesktop = window.innerWidth > Number(this._config.layout.mobile_breakpoint || 1279);
    return !isDesktop || this._config.media_player.show_desktop;
  }

  _getVisibleMediaPlayers() {
    if (!this._config?.media_player || !Array.isArray(this._config.media_player.players)) {
      return [];
    }

    if (this._config.media_player.show === false) {
      return [];
    }

    if (!this._shouldShowMediaPlayerOnCurrentScreen()) {
      return [];
    }

    return this._config.media_player.players.filter(player => {
      if (!player || !player.entity) {
        return false;
      }

      if (player.show === false) {
        return false;
      }

      const state = this._hass?.states?.[player.entity];
      if (!state) {
        return false;
      }

      if (this._config.media_player.show === true || player.show === true || this._isInEditMode()) {
        return true;
      }

      const visibleStates = Array.isArray(player.show_states) && player.show_states.length > 0
        ? player.show_states
        : ["playing", "paused"];

      return visibleStates.includes(state.state);
    });
  }

  _resolveActiveMediaPlayerIndex(players) {
    if (!Array.isArray(players) || players.length === 0) {
      this._activeMediaPlayerIndex = 0;
      this._activeMediaPlayerEntity = "";
      return 0;
    }

    const entityIndex = this._activeMediaPlayerEntity
      ? players.findIndex(player => player?.entity === this._activeMediaPlayerEntity)
      : -1;
    const nextIndex = entityIndex >= 0
      ? entityIndex
      : clamp(this._activeMediaPlayerIndex ?? 0, 0, players.length - 1);

    this._activeMediaPlayerIndex = nextIndex;
    this._activeMediaPlayerEntity = String(players[nextIndex]?.entity || "");
    return nextIndex;
  }

  _getMediaPlayerTitle(player, state) {
    if (player.title) {
      return player.title;
    }

    return state.attributes.media_title || state.attributes.friendly_name || player.entity;
  }

  _getMediaPlayerPlayerLabel(player, state) {
    return (
      player.label ||
      player.name ||
      state.attributes.friendly_name ||
      player.entity
    );
  }

  _getMediaPlayerSubtitle(player, state) {
    if (player.subtitle) {
      return player.subtitle;
    }

    return (
      state.attributes.media_artist ||
      state.attributes.media_series_title ||
      state.attributes.media_album_name ||
      state.attributes.app_name ||
      this._getMediaPlayerStateLabel(state.state)
    );
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

  _getMediaPlayerArtwork(player, state) {
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

  _getMediaPlayerStateLabel(stateValue) {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const langCfg = this._config?.language ?? "auto";
    if (window.NodaliaI18n?.translateMediaPlayerState) {
      return window.NodaliaI18n.translateMediaPlayerState(hass, langCfg, stateValue);
    }
    switch (stateValue) {
      case "playing":
        return "Playing";
      case "paused":
        return "Paused";
      case "buffering":
        return "Loading";
      case "idle":
        return "Idle";
      case "off":
        return "Off";
      case "standby":
        return "Standby";
      case "unavailable":
        return "No disponible";
      default:
        return stateValue || "Desconocido";
    }
  }

  _getMediaPlayerProgress(state) {
    const duration = Number(state?.attributes?.media_duration || 0);

    if (!(duration > 0)) {
      return null;
    }

    let position = Number(state.attributes.media_position || 0);
    const updatedAt = state.attributes.media_position_updated_at;

    if (state.state === "playing" && updatedAt) {
      const updatedAtTime = new Date(updatedAt).getTime();

      if (!Number.isNaN(updatedAtTime)) {
        position += Math.max(0, (Date.now() - updatedAtTime) / 1000);
      }
    }

    position = clamp(position, 0, duration);

    return {
      duration,
      percent: clamp((position / duration) * 100, 0, 100),
      position,
    };
  }

  _getMediaPlayerSourceLabel(state) {
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

  _getMediaPlayerBrowsePath(player, state) {
    if (player?.browse_path) {
      return player.browse_path;
    }

    if (player?.media_browser_path) {
      return player.media_browser_path;
    }

    return this._isMusicAssistantPlayer(player, state) ? "/media-browser/browser" : "";
  }

  _supportsVolumeControl(state) {
    return typeof state?.attributes?.volume_level === "number";
  }

  _playPickedMedia(entityId, pickedMedia) {
    const mediaContentId = pickedMedia?.item?.media_content_id;
    const mediaContentType = pickedMedia?.item?.media_content_type;

    if (!this._hass || !entityId || !mediaContentId || !mediaContentType) {
      return;
    }

    this._hass.callService("media_player", "play_media", {
      entity_id: entityId,
      media_content_id: mediaContentId,
      media_content_type: mediaContentType,
    });
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

  _showEntityMediaBrowser(entityId, fallbackPath = "") {
    this._openMediaBrowser(entityId, fallbackPath);
    return true;
  }

  _closeMediaBrowser(shouldRender = true) {
    if (!this._mediaBrowserState) {
      return;
    }

    this._mediaBrowserState = null;
    this._mediaBrowserRequestToken += 1;

    if (shouldRender) {
      this._render();
    }
  }

  async _openMediaBrowser(entityId, fallbackPath = "") {
    if (!entityId) {
      return;
    }

    this._closePopup(false);
    const token = this._mediaBrowserRequestToken + 1;
    this._mediaBrowserRequestToken = token;
    this._mediaBrowserState = {
      entityId,
      fallbackPath,
      isMusicAssistant: this._isMusicAssistantPlayer(
        { entity: entityId },
        this._hass?.states?.[entityId],
      ),
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
        entityId,
        fallbackPath,
        isMusicAssistant: this._isMusicAssistantPlayer(
          { entity: entityId },
          this._hass?.states?.[entityId],
        ),
        loading: false,
        error: "",
        stack: [rootNode],
      };
      this._render();
    } catch (_error) {
      if (this._mediaBrowserRequestToken !== token || !this.isConnected) {
        return;
      }

      if (fallbackPath) {
        this._mediaBrowserState = null;
        this._navigate(fallbackPath);
        return;
      }

      this._mediaBrowserState = {
        entityId,
        fallbackPath,
        isMusicAssistant: this._isMusicAssistantPlayer(
          { entity: entityId },
          this._hass?.states?.[entityId],
        ),
        loading: false,
        error: "No se pudieron cargar los medios.",
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

    this._hass.callService("media_player", "play_media", {
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

  _commonAria(key, fallback = "") {
    return window.NodaliaI18n?.translateCommonAria?.(this._hass, this._config?.language ?? "auto", key, fallback) || fallback;
  }

  _mediaBrowserUi(key, fallback = "", values = {}) {
    return window.NodaliaI18n?.translateMediaBrowserUi?.(this._hass, this._config?.language ?? "auto", key, fallback, values) || fallback;
  }

  _mediaPlayerAria(key, fallback = "", values = {}) {
    return window.NodaliaI18n?.translateMediaPlayerAria?.(this._hass, this._config?.language ?? "auto", key, fallback, values) || fallback;
  }

  _getMediaBrowserDisplayTitle(value) {
    const label = typeof value === "string" ? value : value?.title;
    const fallback = String(label || "").trim();
    const lang = window.NodaliaI18n.resolveLanguage(this._hass, this._config?.language ?? "auto");
    const dict = window.NodaliaI18n.strings(lang).navigationMusicAssist || {};
    const enDict = window.NodaliaI18n.strings("en").navigationMusicAssist || {};

    if (!fallback) {
      return dict.browseFallback || enDict.browseFallback || "Item";
    }

    if (!this._mediaBrowserState?.isMusicAssistant) {
      return fallback;
    }

    const key = normalizeTextKey(fallback);
    return dict[key] || enDict[key] || fallback;
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

  _shouldHideMediaBrowserItem(item) {
    if (!this._shouldFilterMusicAssistantBrowserItems() || !item) {
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

  _getMediaPlayerChips(player, state, progress, title, subtitle) {
    const chips = [];
    const seen = new Set();
    const subtitleKey = normalizeTextKey(subtitle);
    const titleKey = normalizeTextKey(title);

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

    addChip(this._getMediaPlayerSourceLabel(state), "source");

    if (progress) {
      addChip(`${formatDuration(progress.position)} / ${formatDuration(progress.duration)}`, "time");
    }

    return chips.slice(0, 4);
  }

  _syncMediaTicker(visiblePlayers) {
    if (typeof document !== "undefined" && document.hidden) {
      if (this._mediaTicker) {
        window.clearInterval(this._mediaTicker);
        this._mediaTicker = null;
      }
      return;
    }

    const shouldTick = visiblePlayers.some(player => {
      const state = this._hass?.states?.[player.entity];
      const progress = state ? this._getMediaPlayerProgress(state) : null;
      return state?.state === "playing" && progress;
    });

    if (shouldTick && !this._mediaTicker) {
      this._mediaTicker = window.setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) {
          return;
        }

        this._refreshMediaProgress();
      }, 1000);
      return;
    }

    if (!shouldTick && this._mediaTicker) {
      window.clearInterval(this._mediaTicker);
      this._mediaTicker = null;
    }
  }

  _refreshMediaProgress() {
    if (!this.shadowRoot || !this._mediaPlayerExpanded) {
      return;
    }

    const visiblePlayers = this._getVisibleMediaPlayers();
    if (!visiblePlayers.length) {
      return;
    }

    const player = visiblePlayers[this._resolveActiveMediaPlayerIndex(visiblePlayers)];
    const state = this._hass?.states?.[player.entity];
    const progress = state ? this._getMediaPlayerProgress(state) : null;
    if (!progress) {
      return;
    }

    const progressFill = this.shadowRoot.querySelector(".media-player__progress-fill");
    if (progressFill) {
      progressFill.style.width = `${progress.percent}%`;
    }

    const timeChip = this.shadowRoot.querySelector('[data-media-chip="time"]');
    if (timeChip) {
      timeChip.textContent = `${formatDuration(progress.position)} / ${formatDuration(progress.duration)}`;
    }
  }

  _patchMediaVolumeControls(entityId = "", volumeLevel = NaN) {
    if (!this.shadowRoot) {
      return;
    }
    let targetEntityId = String(entityId || "").trim();
    let nextVolume = Number(volumeLevel);
    if (!targetEntityId || !Number.isFinite(nextVolume)) {
      const visiblePlayers = this._getVisibleMediaPlayers();
      const player = visiblePlayers[this._resolveActiveMediaPlayerIndex(visiblePlayers)];
      targetEntityId = String(player?.entity || "").trim();
      nextVolume = Number(this._hass?.states?.[targetEntityId]?.attributes?.volume_level);
    }
    if (!targetEntityId || !Number.isFinite(nextVolume)) {
      return;
    }
    const normalizedVolume = String(clamp(nextVolume, 0, 1));
    this.shadowRoot
      .querySelectorAll('[data-media-control="volume-down"], [data-media-control="volume-up"]')
      .forEach(button => {
        if (button instanceof HTMLElement && button.dataset.entity === targetEntityId) {
          button.dataset.mediaVolume = normalizedVolume;
        }
      });
  }

  _handleMediaControl(control, entityId, options = {}) {
    if (!this._hass || !entityId) {
      return;
    }

    switch (control) {
      case "previous":
        this._hass.callService("media_player", "media_previous_track", { entity_id: entityId });
        break;
      case "next":
        this._hass.callService("media_player", "media_next_track", { entity_id: entityId });
        break;
      case "play-pause":
        this._hass.callService("media_player", "media_play_pause", { entity_id: entityId });
        break;
      case "volume-down": {
        const currentVolume = Number.isFinite(options.volume) ? options.volume : 0;
        const nextVolume = clamp(currentVolume - 0.08, 0, 1);
        this._patchMediaVolumeControls(entityId, nextVolume);
        this._hass.callService("media_player", "volume_set", {
          entity_id: entityId,
          volume_level: nextVolume,
        });
        break;
      }
      case "volume-up": {
        const currentVolume = Number.isFinite(options.volume) ? options.volume : 0;
        const nextVolume = clamp(currentVolume + 0.08, 0, 1);
        this._patchMediaVolumeControls(entityId, nextVolume);
        this._hass.callService("media_player", "volume_set", {
          entity_id: entityId,
          volume_level: nextVolume,
        });
        break;
      }
      case "browse-media":
        this._showEntityMediaBrowser(entityId, options.path || "/media-browser/browser");
        break;
      default:
        break;
    }
  }

  _runAction(route, options = {}) {
    const action = this._getRouteAction(route, options.defaultAction || null);

    if (!action || action.action === "none") {
      return;
    }

    switch (action.action) {
      case "navigate":
        this._navigate(action.navigation_path || route.path);
        break;
      case "open-popup":
        this._openPopup(route, options.anchorElement);
        return;
      case "url": {
        const url = window.NodaliaUtils?.sanitizeActionUrl(action.url_path || action.url || route.url || route.path, { allowRelative: true }) || "";
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
      case "toggle": {
        const entityId = action.entity || route.entity;
        if (!entityId || !this._hass) {
          return;
        }

        this._hass.callService("homeassistant", "toggle", { entity_id: entityId });
        break;
      }
      case "more-info": {
        const entityId = action.entity || route.entity;
        if (!entityId) {
          return;
        }

        fireEvent(this, "hass-more-info", { entityId });
        break;
      }
      default:
        // Unsupported actions are ignored so the card stays safe to use.
        break;
    }

    if (options.closePopup) {
      this._closePopup();
    }
  }

  _renderPopup(currentPath, playPopupEntrance = false) {
    if (!this._popupState?.route) {
      return "";
    }

    if (this._popupState.routeIndex < 0 || !this._renderedRoutes[this._popupState.routeIndex]) {
      this._popupState = null;
      return "";
    }

    const popupItems = this._getPopupItems(this._popupState.route);
    if (!popupItems.length) {
      this._popupState = null;
      return "";
    }
    const popupHasText = popupItems.some(item => Boolean(this._getRouteLabel(item) || item.description));
    const isCompactPopup = !popupHasText && Number(this._popupState.columns || 1) === 1;

    const popupMarkup = popupItems
      .map((item, popupIndex) => {
        const isActive = this._isNavItemActive(item, currentPath);
        const badge = this._getBadge(item);
        const label = this._getRouteLabel(item);
        const hasLabel = Boolean(label);
        const hasDescription = Boolean(item.description);
        const isIconOnly = !hasLabel && !hasDescription;
        const ariaLabel = label || item.description || item.path || `Popup ${popupIndex + 1}`;
        return `
          <button
            class="popup-item ${isActive ? "active" : ""} ${isIconOnly ? "icon-only" : ""}"
            type="button"
            data-popup-route-index="${this._popupState.routeIndex}"
            data-popup-item-index="${popupIndex}"
            aria-label="${escapeHtml(ariaLabel)}"
          >
            <span class="popup-item__icon-wrap">
              ${this._renderIcon(item, isActive)}
              ${
                badge
                  ? `<span
                      class="nav-badge"
                    >${escapeHtml(badge.content)}</span>`
                  : ""
              }
            </span>
            ${
              hasLabel || hasDescription
                ? `
                  <span class="popup-item__content">
                    ${
                      hasLabel
                        ? `<span class="popup-item__label">${escapeHtml(label)}</span>`
                        : ""
                    }
                    ${
                      hasDescription
                        ? `<span class="popup-item__description">${escapeHtml(item.description)}</span>`
                        : ""
                    }
                  </span>
                `
                : ""
            }
          </button>
        `;
      })
      .join("");

    return `
      <div class="popup-backdrop" data-popup-close="true"></div>
      <div
        class="popup-panel popup-panel--${this._popupState.direction} popup-panel--layout-${this._popupState.layout || "auto"} ${popupHasText ? "popup-panel--with-text" : "popup-panel--icon-only"} ${isCompactPopup ? "popup-panel--compact" : ""}${playPopupEntrance ? " popup-panel--entering" : ""}"
      >
        <div class="popup-items">
          ${popupMarkup}
        </div>
      </div>
    `;
  }

  _renderMediaBrowser() {
    if (!this._mediaBrowserState) {
      return "";
    }

    const currentNode =
      this._mediaBrowserState.stack[this._mediaBrowserState.stack.length - 1] || null;
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
                            item.thumbnail
                              ? `<img src="${escapeHtml(item.thumbnail)}" alt="${escapeHtml(itemTitle)}" />`
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

    return `
      <div class="media-browser-backdrop" data-media-browser-close="true"></div>
      <div class="media-browser-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(this._mediaBrowserUi("dialog", "Media browser"))}">
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

  _renderMediaPlayer(visiblePlayers, animateCardEntrance = false) {
    if (!visiblePlayers.length) {
      return "";
    }

    const player = visiblePlayers[this._resolveActiveMediaPlayerIndex(visiblePlayers)];
    const state = this._hass?.states?.[player.entity];

    if (!state) {
      return "";
    }

    const artwork = this._getMediaPlayerArtwork(player, state);
    const title = this._getMediaPlayerTitle(player, state);
    const subtitle = this._getMediaPlayerSubtitle(player, state);
    const subtitleMarkup = subtitle && normalizeTextKey(subtitle) !== normalizeTextKey(title)
      ? `<div class="media-player__subtitle">${escapeHtml(subtitle)}</div>`
      : "";
    const progress = this._getMediaPlayerProgress(state);
    const albumCoverBackground = this._config.media_player.album_cover_background && artwork;
    const chips = this._getMediaPlayerChips(player, state, progress, title, subtitle);
    const playerName = this._getMediaPlayerPlayerLabel(player, state);
    const statusLabel = this._getMediaPlayerStateLabel(state.state);
    const browsePath = this._getMediaPlayerBrowsePath(player, state);
    const volumeLevel = Number(state.attributes.volume_level ?? 0);
    const volumeSupported = this._supportsVolumeControl(state);
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
    const browseMediaMarkup = browsePath
      ? `
        <div class="media-player__transport-addon">
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
        </div>
      `
      : "";
    const dotsMarkup =
      visiblePlayers.length > 1
        ? `
          <div class="media-player__dots" aria-label="${escapeHtml(this._commonAria("mediaPlayers", "Media players"))}">
            ${visiblePlayers
              .map(
                (_item, index) => `
                  <button
                    type="button"
                    class="media-player__dot ${index === this._activeMediaPlayerIndex ? "active" : ""}"
                    data-media-index="${index}"
                    aria-label="${escapeHtml(this._mediaPlayerAria("selectPlayer", "Select player {index}", { index: index + 1 }))}"
                  ></button>
                `,
              )
              .join("")}
          </div>
        `
        : "";
    const switcherMarkup = dotsMarkup
      ? `<div class="media-player__switcher">${dotsMarkup}</div>`
      : "";
    const topPlayerNameMarkup = playerName
      ? `
        <div class="media-player__topline">
          <span class="media-player__chip media-player__chip--device media-player__chip--top">
            ${escapeHtml(playerName)}
          </span>
        </div>
      `
      : "";
    const statusMarkup = statusLabel
      ? `
        <div class="media-player__status-wrap">
          <span class="media-player__chip media-player__chip--${escapeHtml(state.state || "default")} media-player__chip--status">
            ${escapeHtml(statusLabel)}
          </span>
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
                <span
                  class="media-player__chip media-player__chip--${escapeHtml(chip.tone)}"
                  ${chip.tone === "time" ? 'data-media-chip="time"' : ""}
                >
                  ${escapeHtml(chip.label)}
                </span>
              `,
            )
            .join("")}
          </div>
        </div>
      `
      : "";
    const collapseMarkup = `
      <button
        type="button"
        class="media-player__collapse"
        data-media-toggle="collapse"
        aria-label="${escapeHtml(this._mediaPlayerAria("hidePlayer", "Hide player"))}"
      >
        <ha-icon icon="mdi:chevron-down"></ha-icon>
      </button>
    `;

    return `
      <div
        class="media-player-card ${albumCoverBackground ? "has-album-background" : ""}${animateCardEntrance ? " media-player-card--entering" : ""}"
        data-media-card-index="${this._activeMediaPlayerIndex}"
      >
        ${
          albumCoverBackground
            ? `<div class="media-player__album-bg" style="background-image:url('${escapeHtml(artwork)}');"></div>`
            : ""
        }
        ${
          progress !== null
            ? `
              <div class="media-player__progress">
                <span class="media-player__progress-fill" style="width:${progress.percent}%"></span>
              </div>
            `
            : ""
        }
        ${collapseMarkup}
        <div class="media-player__content">
          ${topPlayerNameMarkup}
          <div class="media-player__hero">
            <div class="media-player__artwork">
              ${
                artwork
                  ? `<img src="${escapeHtml(artwork)}" alt="${escapeHtml(title)}" />`
                  : `<ha-icon icon="${escapeHtml(player.icon || "mdi:music")}"></ha-icon>`
              }
            </div>
            <div class="media-player__meta">
              <div class="media-player__title-row">
                <div class="media-player__title">${escapeHtml(title)}</div>
                ${statusMarkup}
              </div>
              ${subtitleMarkup}
            </div>
          </div>
          <div class="media-player__center-stack">
            ${switcherMarkup}
            <div class="media-player__transport-row">
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
                </div>
                ${browseMediaMarkup}
              </div>
            </div>
          </div>
          <div class="media-player__footer">
            ${chipsMarkup}
          </div>
        </div>
      </div>
    `;
  }

  _renderMediaPlayerToggle(visiblePlayers, playToggleEntrance = false) {
    if (!visiblePlayers.length) {
      return "";
    }

    const player = visiblePlayers[this._resolveActiveMediaPlayerIndex(visiblePlayers)];
    const state = this._hass?.states?.[player.entity];

    if (!state) {
      return "";
    }

    const artwork = this._getMediaPlayerArtwork(player, state);
    const title = this._getMediaPlayerTitle(player, state);
    const subtitle = this._getMediaPlayerStateLabel(state.state);

    return `
      <div class="media-player-toggle-wrap${this._playDockEntrance ? " media-player-toggle-wrap--entering" : ""}">
        <button
          type="button"
          class="media-player-toggle${playToggleEntrance ? " media-player-toggle--entering" : ""}"
          data-media-toggle="expand"
          aria-label="${escapeHtml(this._mediaPlayerAria("showPlayer", "Show player"))}"
        >
          <span class="media-player-toggle__artwork">
            ${
              artwork
                ? `<img src="${escapeHtml(artwork)}" alt="${escapeHtml(title)}" />`
                : `<ha-icon icon="${escapeHtml(player.icon || "mdi:music")}"></ha-icon>`
            }
          </span>
          <span class="media-player-toggle__meta">
            <span class="media-player-toggle__eyebrow">${escapeHtml(subtitle)}</span>
            <span class="media-player-toggle__title">${escapeHtml(title)}</span>
          </span>
          <ha-icon class="media-player-toggle__icon" icon="mdi:chevron-up"></ha-icon>
        </button>
      </div>
    `;
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
    const mediaToggleBackgroundBase = sanitizeCssRuntimeValue(config.styles.media_player.background)
      || sanitizeCssRuntimeValue(DEFAULT_CONFIG.styles.media_player.background)
      || "var(--ha-card-background, var(--card-background-color))";
    const mediaToggleBorder = sanitizeCssRuntimeValue(config.styles.media_player.border)
      || sanitizeCssRuntimeValue(DEFAULT_CONFIG.styles.media_player.border)
      || "1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent)";
    const mediaToggleBorderRadius = sanitizeCssRuntimeValue(config.styles.media_player.border_radius)
      || sanitizeCssRuntimeValue(DEFAULT_CONFIG.styles.media_player.border_radius)
      || "18px";
    const mediaToggleBoxShadow = sanitizeCssRuntimeValue(config.styles.media_player.box_shadow)
      || sanitizeCssRuntimeValue(DEFAULT_CONFIG.styles.media_player.box_shadow)
      || "inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent), 0 10px 24px rgba(0, 0, 0, 0.16)";
    const animations = {
      enabled: config.animations?.enabled !== false,
      barDuration: clamp(Number(config.animations?.bar_duration) || DEFAULT_CONFIG.animations.bar_duration, 120, 1600),
      popupDuration: clamp(Number(config.animations?.popup_duration) || DEFAULT_CONFIG.animations.popup_duration, 120, 2400),
      mediaDuration: clamp(Number(config.animations?.media_duration) || DEFAULT_CONFIG.animations.media_duration, 120, 2400),
      buttonBounceDuration: clamp(Number(config.animations?.button_bounce_duration) || DEFAULT_CONFIG.animations.button_bounce_duration, 120, 1600),
      dockEntranceDuration: clamp(
        Number(config.animations?.dock_entrance_duration) || DEFAULT_CONFIG.animations.dock_entrance_duration,
        180,
        1400,
      ),
    };
    const inEditMode = this._isInEditMode();
    const shouldHide = this._shouldHideForScreen(config);

    if (shouldHide && !inEditMode) {
      this._renderedRoutes = [];
      this.shadowRoot.innerHTML = "";
      this._lastShouldHide = true;
      return;
    }

    if (this._lastShouldHide && !shouldHide) {
      this._animateDockEntranceNext = true;
    }
    this._lastShouldHide = false;

    const hasActiveOverlay = Boolean(this._popupState || this._mediaBrowserState);
    const playDockEntrance = animations.enabled
      && !inEditMode
      && this._animateDockEntranceNext
      && !hasActiveOverlay
      && !this._dockEntrancePlayed;
    if (playDockEntrance) {
      this._dockEntrancePlayed = true;
    }
    // Lovelace typically calls setConfig then set(hass) in the same turn; clearing the flag
    // synchronously made the second _render strip entrance classes before paint. Defer reset
    // one frame so follow-up renders still emit --entering until the browser composites.
    if (this._animateDockEntranceNext) {
      if (animations.enabled) {
        if (this._dockEntranceResetFrame) {
          window.cancelAnimationFrame(this._dockEntranceResetFrame);
        }
        this._dockEntranceResetFrame = window.requestAnimationFrame(() => {
          this._dockEntranceResetFrame = 0;
          if (!this.isConnected) {
            return;
          }
          this._animateDockEntranceNext = false;
        });
      } else {
        this._animateDockEntranceNext = false;
      }
    }
    this._playDockEntrance = playDockEntrance;

    const visibleRoutes = this._getVisibleRoutes();
    const showRouteLabels = this._shouldShowRouteLabels(visibleRoutes);
    const visiblePlayers = this._getVisibleMediaPlayers();
    const hasVisiblePlayers = visiblePlayers.length > 0;

    if (!hasVisiblePlayers) {
      this._mediaPlayerExpanded = false;
    }

    const showMediaPlayerCard = hasVisiblePlayers && (inEditMode || this._mediaPlayerExpanded === true);
    const showMediaPlayerToggle = hasVisiblePlayers && !showMediaPlayerCard;
    const playMediaToggleEntrance = animations.enabled && showMediaPlayerToggle && !this._lastMediaToggleVisible;
    this._lastMediaToggleVisible = showMediaPlayerToggle;
    const playMediaCardEntrance = animations.enabled && showMediaPlayerCard && !this._lastMediaPlayerCardVisible;
    this._lastMediaPlayerCardVisible = showMediaPlayerCard;
    const mediaStackGap = hasVisiblePlayers ? config.media_player.gap || "0px" : "0px";
    const currentPath = normalizePath(window.location.pathname) || "/";
    const isFixed = config.layout.fixed && !inEditMode;
    const spacerHeight = isFixed && config.layout.reserve_space
      ? this._getReservedHeight(showMediaPlayerCard, showMediaPlayerToggle)
      : "0px";
    const titleMarkup = config.title
      ? `<div class="navbar-title${playDockEntrance ? " navbar-title--entering" : ""}">${escapeHtml(config.title)}</div>`
      : "";

    this._renderedRoutes = visibleRoutes;
    this._syncMediaTicker(showMediaPlayerCard ? visiblePlayers : []);

    const mediaPlayerMarkup = showMediaPlayerCard
      ? this._renderMediaPlayer(visiblePlayers, playMediaCardEntrance)
      : "";
    const mediaPlayerToggleMarkup = showMediaPlayerToggle
      ? this._renderMediaPlayerToggle(visiblePlayers, playMediaToggleEntrance)
      : "";
    const fullWidthBar = config.layout.full_width === true;
    const barRadiusToken = String(config.styles.bar.border_radius || "28px")
      .trim()
      .split(/\s+/)[0] || "28px";
    const navbarCardBorderRadius = fullWidthBar
      ? "0"
      : isFixed && config.layout.position === "bottom"
        ? `${barRadiusToken} ${barRadiusToken} 0 0`
        : isFixed && config.layout.position === "top"
          ? `0 0 ${barRadiusToken} ${barRadiusToken}`
          : config.styles.bar.border_radius;
    const barPadding = isFixed
      ? config.styles.bar.padding
      : String(config.styles.bar.padding || "12px 16px").replace(
        /calc\(\s*12px\s*\+\s*env\(safe-area-inset-bottom\s*,\s*0px\)\s*\)/gi,
        "12px",
      );
    const navbarSurfaceBase =
      "linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)), var(--nodalia-user-bar-bg, var(--nodalia-surface-soft))";
    const navbarSurfaceBackground = window.NodaliaUtils?.composeCardSurfaceBackground?.({
      base: navbarSurfaceBase,
      glazeMode: "neutral",
      glazeNeutralStrength: 5,
      ambient: false,
    }) || `linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0)), ${navbarSurfaceBase}`;
    const popupMarkup = this._renderPopup(currentPath, Boolean(this._popupState) && this._playPopupEntrance);
    const mediaBrowserMarkup = this._renderMediaBrowser();

    const routesMarkup =
      visibleRoutes.length > 0
        ? visibleRoutes
            .map((route, index) => {
              const isActive = this._isRouteActive(route, currentPath);
              const badge = this._getBadge(route);
              const label = this._getRouteLabel(route);
              const hasPopup = this._getPopupItems(route).length > 0;

              return `
                <button
                  class="nav-item ${isActive ? "active" : ""} ${hasPopup ? "has-popup" : ""}${playDockEntrance ? " nav-item--entering" : ""}"
                  data-route-index="${index}"
                  type="button"
                  aria-label="${escapeHtml(label || route.path || `Route ${index + 1}`)}"
                >
                  <span class="nav-icon-wrap">
                    ${this._renderIcon(route, isActive)}
                    ${
                      badge
                        ? `<span
                            class="nav-badge"
                          >${escapeHtml(badge.content)}</span>`
                        : ""
                    }
                    ${
                      hasPopup
                        ? `<span class="nav-popup-indicator" aria-hidden="true"></span>`
                        : ""
                    }
                  </span>
                  ${
                    showRouteLabels
                      ? label
                        ? `<span class="nav-label">${escapeHtml(label)}</span>`
                        : '<span class="nav-label nav-label--placeholder" aria-hidden="true">&nbsp;</span>'
                      : ""
                  }
                </button>
              `;
            })
            .join("")
        : `
          <div class="empty-state">
            No visible routes. Check user IDs or add entries to "routes".
          </div>
        `;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --navbar-dock-entrance-ms: ${animations.dockEntranceDuration};
          --nodalia-surface: var(--card-background-color, rgba(32, 34, 42, 0.92));
          --nodalia-surface-soft: var(--ha-card-background, var(--card-background-color, rgba(32, 34, 42, 0.88)));
          --nodalia-border: var(--divider-color, rgba(255, 255, 255, 0.12));
          --nodalia-text: var(--primary-text-color, #f4f4f7);
          --nodalia-muted: var(--secondary-text-color, rgba(244, 244, 247, 0.62));
          --nodalia-overlay: rgba(10, 12, 18, 0.72);
          --nodalia-user-bar-bg: ${config.styles.bar.background};
          display: block;
          width: 100%;
          ${inEditMode ? "height: 100%; min-height: 240px; position: relative;" : ""}
        }

        * {
          box-sizing: border-box;
        }

        .spacer {
          display: ${isFixed && config.layout.reserve_space ? "block" : "none"};
          height: ${spacerHeight};
        }

        .dock {
          position: ${isFixed ? "fixed" : inEditMode ? "absolute" : "relative"};
          left: ${inEditMode ? "12px" : fullWidthBar ? "0" : config.layout.side_margin};
          right: ${inEditMode ? "12px" : fullWidthBar ? "0" : config.layout.side_margin};
          ${inEditMode
            ? (config.layout.position === "top" ? "top: 12px;" : "bottom: 12px;")
            : (config.layout.position === "top" ? `top: ${config.layout.offset};` : `bottom: ${config.layout.offset};`)}
          z-index: ${config.layout.z_index};
          pointer-events: none;
        }

        .dock-inner {
          width: 100%;
          max-width: ${fullWidthBar ? "none" : config.styles.bar.max_width};
          margin: 0 auto;
          pointer-events: none;
        }

        .dock-stack--full-width > .media-player-card {
          border-radius: 0;
        }

        .dock-stack {
          display: grid;
          gap: ${mediaStackGap};
          pointer-events: none;
        }

        .dock-stack > *,
        .dock-stack > * > *,
        .navbar,
        .navbar *,
        .media-player-toggle-wrap,
        .media-player-toggle,
        .media-player-toggle *,
        .media-player-card,
        .media-player-card *,
        .popup-backdrop,
        .popup-panel,
        .media-browser-backdrop,
        .media-browser-panel {
          pointer-events: auto;
        }

        .media-player-toggle-wrap {
          display: flex;
          justify-content: flex-end;
        }

        ha-card.navbar-card {
          background: ${navbarSurfaceBackground};
          border: ${config.styles.bar.border};
          border-radius: ${navbarCardBorderRadius};
          box-shadow: ${config.styles.bar.box_shadow};
          backdrop-filter: ${config.styles.bar.backdrop_filter};
          display: block;
          padding: ${barPadding};
          min-height: ${config.styles.bar.min_height};
          overflow: hidden;
          pointer-events: none;
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, border-radius 180ms ease;
        }

        ha-card.navbar-card > * {
          position: relative;
          z-index: 1;
        }

        @keyframes nodalia-navbar-dock-in-from-bottom {
          0% {
            opacity: 0;
            transform: translateY(22px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes nodalia-navbar-dock-in-from-top {
          0% {
            opacity: 0;
            transform: translateY(-18px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes nodalia-navbar-chip-in {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.94);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes nodalia-navbar-soft-in {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        ha-card.navbar-card.navbar-card--entering-bottom {
          animation: nodalia-navbar-dock-in-from-bottom ${animations.dockEntranceDuration}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        ha-card.navbar-card.navbar-card--entering-top {
          animation: nodalia-navbar-dock-in-from-top ${animations.dockEntranceDuration}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .nav-item.nav-item--entering {
          animation: nodalia-navbar-chip-in ${Math.round(animations.dockEntranceDuration * 0.92)}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: var(--nav-enter-delay, 0ms);
        }

        .navbar-title.navbar-title--entering {
          animation: nodalia-navbar-soft-in ${Math.round(animations.dockEntranceDuration * 0.78)}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: ${Math.round(animations.dockEntranceDuration * 0.1)}ms;
        }

        .media-player-toggle-wrap.media-player-toggle-wrap--entering {
          animation: nodalia-navbar-soft-in ${Math.round(animations.dockEntranceDuration * 0.72)}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: ${Math.round(animations.dockEntranceDuration * 0.06)}ms;
        }

        .navbar-title {
          margin-bottom: 10px;
          color: var(--primary-text-color);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        .navbar {
          display: ${showRouteLabels ? "flex" : "grid"};
          align-items: center;
          justify-content: ${showRouteLabels ? config.styles.bar.justify_content : "stretch"};
          gap: ${config.styles.bar.gap};
          flex-wrap: nowrap;
          grid-template-columns: ${showRouteLabels ? "none" : `repeat(${Math.max(visibleRoutes.length, 1)}, minmax(0, 1fr))`};
          justify-items: ${showRouteLabels ? "stretch" : "center"};
          transform: translateY(${showRouteLabels ? "0px" : "4px"});
          width: 100%;
        }

        .nav-item {
          --route-background: ${config.styles.button.background};
          --route-color: ${config.styles.button.color};
          --route-active-color: ${config.styles.button.active_color};
          --route-active-background: ${config.styles.button.active_background};
          appearance: none;
          background: transparent;
          border: 0;
          border-radius: ${config.styles.button.border_radius};
          color: var(--route-color);
          cursor: pointer;
          display: inline-flex;
          flex: ${showRouteLabels ? "1 1 0" : "0 0 auto"};
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: ${showRouteLabels ? config.styles.button.label_gap : "0px"};
          min-width: ${showRouteLabels ? "0" : config.styles.button.size};
          min-height: ${config.styles.button.size};
          padding: 0;
          position: relative;
          width: ${showRouteLabels ? "auto" : config.styles.button.size};
          transition:
            background ${animations.enabled ? animations.barDuration : 0}ms ease,
            color ${animations.enabled ? animations.barDuration : 0}ms ease,
            transform ${animations.enabled ? animations.buttonBounceDuration : 0}ms ease;
        }

        .nav-item:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }

        .nav-item.active {
          color: var(--route-active-color);
        }

        .nav-item.active .nav-icon-wrap {
          background: var(--route-active-background);
        }

        .nav-icon-wrap {
          background: var(--route-background);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          width: ${config.styles.button.size};
          height: ${config.styles.button.size};
          border-radius: ${config.styles.button.border_radius};
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.16);
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 0;
          position: relative;
          transition:
            background ${animations.enabled ? animations.barDuration : 0}ms ease,
            box-shadow ${animations.enabled ? animations.barDuration : 0}ms ease,
            transform ${animations.enabled ? animations.buttonBounceDuration : 0}ms ease;
        }

        .nav-icon,
        .nav-image {
          display: block;
          flex: 0 0 auto;
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(
            calc(-50% + ${config.styles.button.icon_offset_x}),
            calc(-50% + ${config.styles.button.icon_offset_y})
          );
          width: ${config.styles.button.icon_size};
          height: ${config.styles.button.icon_size};
        }

        .nav-icon {
          --mdc-icon-size: ${config.styles.button.icon_size};
          align-items: center;
          display: inline-flex;
          font-size: ${config.styles.button.icon_size};
          justify-content: center;
          line-height: 1;
          margin: 0;
          padding: 0;
        }

        .nav-image {
          border-radius: 50%;
          object-fit: cover;
        }

        .nav-icon--placeholder {
          display: inline-block;
        }

        .nav-label {
          color: ${config.styles.button.label_color};
          display: block;
          font-size: ${config.styles.button.label_size};
          line-height: 1.2;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nav-label--placeholder {
          visibility: hidden;
        }

        .nav-item.active .nav-label {
          color: ${config.styles.button.active_label_color};
        }

        .nav-popup-indicator {
          background: currentColor;
          border-radius: 999px;
          bottom: 5px;
          height: 4px;
          left: 50%;
          opacity: 0.75;
          position: absolute;
          transform: translateX(-50%);
          width: 4px;
        }

        .nav-badge {
          align-items: center;
          background: var(--badge-background);
          border-radius: 999px;
          color: var(--badge-color);
          display: inline-flex;
          font-size: ${config.styles.badge.font_size};
          font-weight: 700;
          inset-inline-end: -4px;
          justify-content: center;
          min-height: ${config.styles.badge.min_size};
          min-width: ${config.styles.badge.min_size};
          padding: 0 6px;
          position: absolute;
          top: -2px;
        }

        .empty-state {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.4;
          padding: 4px 0;
          text-align: center;
          width: 100%;
        }

        .popup-backdrop {
          background: ${config.styles.popup.backdrop};
          inset: 0;
          position: fixed;
          z-index: ${Number(config.layout.z_index) + 1};
        }

        .popup-panel {
          background:
            color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 96%, transparent),
            ${config.styles.popup.background};
          background-color: var(--ha-card-background, var(--card-background-color, #fff));
          border: ${config.styles.popup.border};
          border-radius: ${config.styles.popup.border_radius};
          box-shadow: ${config.styles.bar.box_shadow}, ${config.styles.popup.box_shadow};
          --popup-columns: 1;
          --popup-item-min: calc(${config.styles.popup.item_size} + 24px);
          max-height: calc(100vh - 24px);
          max-height: calc(100dvh - 24px);
          min-width: min(${config.styles.popup.min_width}, calc(100vw - 24px));
          overflow: auto;
          padding: ${config.styles.popup.padding};
          position: fixed;
          transform-origin: center bottom;
          width: min(${config.styles.popup.max_width}, calc(100vw - 24px));
          z-index: ${Number(config.layout.z_index) + 2};
        }

        .popup-panel.popup-panel--entering {
          ${animations.enabled ? `animation: nodalia-navbar-surface-in ${animations.popupDuration}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;` : ""}
        }

        .popup-panel > * {
          position: relative;
          z-index: 1;
        }

        .popup-panel--down {
          transform-origin: center top;
        }

        .popup-items {
          align-items: stretch;
          display: grid;
          gap: ${config.styles.popup.item_gap};
          grid-template-columns: repeat(var(--popup-columns), minmax(0, 1fr));
          justify-items: stretch;
        }

        .popup-panel--layout-vertical .popup-items {
          grid-template-columns: 1fr;
        }

        .popup-panel--layout-vertical.popup-panel--icon-only {
          min-width: 0;
        }

        .popup-panel--compact {
          min-width: 0;
          padding: 8px;
          width: auto;
        }

        .popup-panel--compact .popup-items {
          align-items: center;
          display: flex;
          flex-direction: column;
          gap: ${config.styles.popup.item_gap};
          justify-content: center;
        }

        .popup-panel--layout-horizontal .popup-items,
        .popup-panel--layout-auto .popup-items {
          grid-template-columns: repeat(var(--popup-columns), minmax(var(--popup-item-min), 1fr));
        }

        .media-browser-backdrop {
          background: ${config.styles.popup.backdrop};
          inset: 0;
          position: fixed;
          z-index: ${Number(config.layout.z_index) + 3};
        }

        .media-browser-panel {
          background: ${config.styles.media_player.background};
          background-color: var(--ha-card-background, var(--card-background-color, #fff));
          border: ${config.styles.media_player.border};
          border-radius: ${config.styles.media_player.border_radius};
          box-shadow: ${config.styles.bar.box_shadow}, ${config.styles.popup.box_shadow};
          display: flex;
          flex-direction: column;
          gap: 14px;
          inset: max(16px, calc(env(safe-area-inset-top, 0px) + 12px)) 12px max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px)) 12px;
          isolation: isolate;
          max-width: 560px;
          margin: 0 auto;
          overflow: hidden;
          padding: 14px;
          position: fixed;
          z-index: ${Number(config.layout.z_index) + 4};
          ${animations.enabled ? `animation: nodalia-navbar-surface-in ${animations.mediaDuration}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;` : ""}
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
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-browser__item-title {
          color: var(--primary-text-color);
          font-size: 14px;
          font-weight: 700;
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

        .popup-item {
          --popup-route-background: ${config.styles.button.background};
          --popup-route-color: ${config.styles.button.color};
          --popup-route-active-color: ${config.styles.button.active_color};
          --popup-route-active-background: ${config.styles.button.active_background};
          appearance: none;
          align-items: center;
          background: rgba(255, 255, 255, 0.015);
          border: 0;
          border-radius: 20px;
          color: var(--popup-route-color);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 8px;
          justify-content: center;
          min-height: calc(${config.styles.popup.item_size} + 36px);
          padding: 10px 8px;
          text-align: center;
          transition:
            background ${animations.enabled ? animations.barDuration : 0}ms ease,
            transform ${animations.enabled ? animations.buttonBounceDuration : 0}ms ease;
          width: 100%;
        }

        .popup-item.icon-only {
          min-height: calc(${config.styles.popup.item_size} + 18px);
        }

        .popup-item:hover {
          background: rgba(var(--rgb-primary-color), 0.08);
        }

        .popup-item.active {
          background: rgba(var(--rgb-primary-color), 0.12);
          color: var(--popup-route-active-color);
        }

        .popup-item__icon-wrap {
          align-items: center;
          background: var(--popup-route-background);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border-radius: ${config.styles.button.border_radius};
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 3%, transparent),
            0 8px 18px rgba(0, 0, 0, 0.12);
          display: flex;
          height: max(${config.styles.popup.item_size}, calc(${config.styles.button.icon_size} + 14px));
          justify-content: center;
          line-height: 0;
          position: relative;
          width: max(${config.styles.popup.item_size}, calc(${config.styles.button.icon_size} + 14px));
        }

        .popup-item.active .popup-item__icon-wrap {
          background: var(--popup-route-active-background);
        }

        .popup-panel--layout-horizontal .popup-item.icon-only,
        .popup-panel--layout-auto .popup-item.icon-only {
          background: transparent;
          min-height: auto;
          padding: 2px 0;
        }

        .popup-panel--layout-horizontal .popup-item.icon-only:hover,
        .popup-panel--layout-auto .popup-item.icon-only:hover,
        .popup-panel--layout-horizontal .popup-item.icon-only.active,
        .popup-panel--layout-auto .popup-item.icon-only.active {
          background: transparent;
        }

        .popup-panel--layout-vertical .popup-item {
          min-height: calc(${config.styles.popup.item_size} + 24px);
        }

        .popup-panel--layout-vertical.popup-panel--icon-only .popup-items {
          justify-items: center;
        }

        .popup-panel--layout-vertical.popup-panel--icon-only .popup-item {
          background: transparent;
          min-height: auto;
          padding: 0;
          width: auto;
        }

        .popup-panel--layout-vertical.popup-panel--icon-only .popup-item:hover,
        .popup-panel--layout-vertical.popup-panel--icon-only .popup-item.active {
          background: transparent;
        }

        .popup-item__content {
          display: grid;
          gap: 4px;
          justify-items: center;
          min-width: 0;
          width: 100%;
        }

        .popup-item__label {
          color: inherit;
          font-size: ${config.styles.popup.label_size};
          font-weight: 600;
          line-height: 1.2;
          text-align: center;
          white-space: normal;
        }

        .popup-item__description {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.2;
          max-width: 100%;
          text-align: center;
          white-space: normal;
        }

        .media-player-card {
          background: ${config.styles.media_player.background};
          border: ${config.styles.media_player.border};
          border-radius: ${config.styles.media_player.border_radius};
          box-shadow: ${config.styles.media_player.box_shadow};
          cursor: pointer;
          isolation: isolate;
          min-height: ${config.styles.media_player.min_height};
          overflow: hidden;
          padding: ${config.styles.media_player.padding};
          position: relative;
        }

        .media-player-card.media-player-card--entering {
          ${animations.enabled ? `animation: nodalia-navbar-surface-in ${animations.mediaDuration}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;` : ""}
        }

        .media-player-card::before {
          background: linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 6%, transparent), rgba(255, 255, 255, 0));
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .media-player-card.has-album-background::after {
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.08),
            ${config.styles.media_player.overlay_color},
            rgba(0, 0, 0, 0.16)
          );
          content: "";
          inset: 0;
          position: absolute;
          z-index: 0;
        }

        .media-player__album-bg {
          background-position: center;
          background-size: cover;
          filter: blur(30px) saturate(0.82);
          inset: -24px;
          opacity: 0.38;
          position: absolute;
          transform: scale(1.14);
          z-index: -1;
        }

        .media-player__progress {
          background: ${config.styles.media_player.progress_background};
          border-radius: 999px;
          bottom: 10px;
          height: 6px;
          inset-inline: 14px;
          overflow: hidden;
          position: absolute;
          z-index: 1;
        }

        .media-player__progress-fill {
          background: ${config.styles.media_player.progress_color};
          display: block;
          height: 100%;
        }

        .media-player__content,
        .media-player__dots {
          position: relative;
          z-index: 1;
        }

        .media-player__content {
          align-content: start;
          display: grid;
          gap: 14px;
          padding-bottom: 12px;
        }

        .media-player__topline {
          display: flex;
          justify-content: center;
          min-height: 28px;
          padding-inline: 42px;
          width: 100%;
        }

        .media-player__hero {
          align-items: start;
          display: grid;
          gap: 14px;
          grid-template-columns: ${config.styles.media_player.artwork_size} minmax(0, 1fr);
          padding-right: 42px;
        }

        .media-player__artwork {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 22px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.18);
          display: flex;
          height: ${config.styles.media_player.artwork_size};
          justify-content: center;
          overflow: hidden;
          width: ${config.styles.media_player.artwork_size};
        }

        .media-player__artwork img,
        .media-player__artwork ha-icon {
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .media-player__artwork ha-icon {
          font-size: calc(${config.styles.media_player.artwork_size} * 0.52);
          padding: 14px;
        }

        .media-player__meta {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .media-player__title-row {
          align-items: center;
          display: grid;
          gap: 8px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .media-player__title,
        .media-player__subtitle {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-player__title {
          color: var(--primary-text-color);
          font-size: ${config.styles.media_player.title_size};
          font-weight: 700;
        }

        .media-player__subtitle {
          color: var(--secondary-text-color);
          font-size: ${config.styles.media_player.subtitle_size};
        }

        .media-player__center-stack {
          display: grid;
          gap: 12px;
          justify-items: center;
        }

        .media-player__switcher {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .media-player__status-wrap {
          display: flex;
          justify-content: flex-end;
          min-width: 0;
          pointer-events: none;
        }

        .media-player__transport-row {
          align-items: center;
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .media-player__transport-shell {
          align-items: center;
          display: inline-flex;
          justify-content: center;
          position: relative;
          width: auto;
        }

        .media-player__transport-cluster {
          align-items: center;
          display: inline-flex;
          gap: 10px;
          justify-content: center;
          width: auto;
        }

        .media-player__transport-addon {
          align-items: center;
          display: inline-flex;
          left: calc(100% + 10px);
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
        }

        .media-player__footer {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }

        .media-player__transport {
          align-items: center;
          display: inline-flex;
          gap: 8px;
          padding: 6px;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          margin: 0 auto;
        }

        .media-player__volume-button {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: calc(${config.styles.media_player.control_size} - 4px);
          justify-content: center;
          line-height: 0;
          padding: 0;
          flex: 0 0 auto;
          position: relative;
          width: calc(${config.styles.media_player.control_size} - 4px);
        }

        .media-player__chips {
          align-items: center;
          display: flex;
          flex: 0 1 auto;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          min-width: 0;
        }

        .media-player__chips-wrap {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .media-player__chip {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: ${config.styles.media_player.subtitle_size};
          font-weight: 600;
          line-height: 1;
          max-width: 100%;
          min-height: 28px;
          overflow: hidden;
          padding: 0 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-player__chip--top {
          justify-content: center;
          max-width: min(100%, 320px);
          text-align: center;
        }

        .media-player__chip--status {
          max-width: min(100%, 160px);
        }

        .media-player__chip--playing {
          background: rgba(var(--rgb-primary-color), 0.16);
          border-color: rgba(var(--rgb-primary-color), 0.22);
          color: ${config.styles.button.active_color};
        }

        .media-player__chip--paused,
        .media-player__chip--buffering {
          color: var(--primary-text-color);
        }

        .media-player__chip--device,
        .media-player__chip--source {
          color: var(--primary-text-color);
        }

        .media-player__chip--time {
          font-variant-numeric: tabular-nums;
        }

        .media-player__control {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: ${config.styles.media_player.control_size};
          justify-content: center;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          line-height: 0;
          position: relative;
          width: ${config.styles.media_player.control_size};
        }

        .media-player__control--primary {
          background: rgba(var(--rgb-primary-color), 0.18);
          border-color: rgba(var(--rgb-primary-color), 0.24);
          color: ${config.styles.button.active_color};
          height: calc(${config.styles.media_player.control_size} + 6px);
          width: calc(${config.styles.media_player.control_size} + 6px);
        }

        .media-player__control ha-icon {
          align-items: center;
          display: inline-flex;
          font-size: 22px;
          height: 22px;
          justify-content: center;
          left: 50%;
          line-height: 1;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 22px;
        }

        .media-player__volume-button ha-icon {
          align-items: center;
          display: inline-flex;
          font-size: 20px;
          height: 20px;
          justify-content: center;
          left: 50%;
          line-height: 1;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 20px;
        }

        .media-player__dots {
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          display: inline-flex;
          gap: 4px;
          justify-content: center;
          padding: 4px;
        }

        .media-player__collapse {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: 28px;
          justify-content: center;
          padding: 0;
          position: absolute;
          right: 14px;
          top: 14px;
          z-index: 2;
          width: 28px;
        }

        .media-player__collapse ha-icon {
          font-size: 18px;
        }

        .media-player__dot {
          appearance: none;
          align-items: center;
          background: transparent;
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          height: 28px;
          justify-content: center;
          padding: 0;
          position: relative;
          width: 28px;
        }

        .media-player__dot::before {
          background: color-mix(in srgb, var(--primary-text-color) 18%, transparent);
          border-radius: 999px;
          content: "";
          height: ${config.styles.media_player.dot_size};
          transition:
            background ${animations.enabled ? animations.barDuration : 0}ms ease,
            width ${animations.enabled ? animations.barDuration : 0}ms ease;
          width: ${config.styles.media_player.dot_size};
        }

        .media-player__dot.active::before {
          background: ${config.styles.button.active_color};
          width: calc(${config.styles.media_player.dot_size} + 10px);
        }

        .media-player-toggle {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, ${mediaToggleBackgroundBase} 78%, var(--card-background-color) 22%);
          border: ${mediaToggleBorder};
          border-radius: ${mediaToggleBorderRadius};
          box-shadow: ${mediaToggleBoxShadow};
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          gap: 11px;
          max-width: min(100%, 292px);
          min-height: 48px;
          padding: 8px 12px 8px 8px;
          transition:
            background ${animations.enabled ? animations.barDuration : 0}ms ease,
            box-shadow ${animations.enabled ? animations.barDuration : 0}ms ease;
        }

        .media-player-toggle.media-player-toggle--entering {
          ${animations.enabled ? `animation: nodalia-navbar-surface-in ${animations.mediaDuration}ms cubic-bezier(0.22, 0.84, 0.26, 1) both;` : ""}
        }

        .media-player-toggle__artwork {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 10%, transparent);
          border-radius: 14px;
          display: inline-flex;
          flex: 0 0 auto;
          height: 34px;
          justify-content: center;
          overflow: hidden;
          width: 34px;
        }

        .media-player-toggle__artwork img,
        .media-player-toggle__artwork ha-icon {
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .media-player-toggle__artwork ha-icon {
          font-size: 18px;
          padding: 7px;
        }

        .media-player-toggle__meta {
          display: grid;
          flex: 1 1 auto;
          gap: 2px;
          min-width: 0;
          text-align: left;
        }

        .media-player-toggle__eyebrow,
        .media-player-toggle__title {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-player-toggle__eyebrow {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 600;
        }

        .media-player-toggle__title {
          color: var(--primary-text-color);
          font-size: 13px;
          font-weight: 700;
        }

        .media-player-toggle__icon {
          color: var(--secondary-text-color);
          flex: 0 0 auto;
          font-size: 18px;
        }

        @keyframes nodalia-navbar-surface-in {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        ${animations.enabled ? "" : `
        .nav-item,
        .nav-icon-wrap,
        .navbar-title,
        .navbar-card,
        .media-player-toggle-wrap,
        .popup-panel,
        .popup-item,
        .media-player-card,
        .media-player-toggle,
        .media-browser-panel {
          animation: none !important;
          transition: none !important;
        }
        `}

        @media (max-width: 520px) {
          .media-player__footer {
            justify-content: center;
          }
        }

        @media (max-width: 420px) {
          .media-player__hero {
            grid-template-columns: ${config.styles.media_player.artwork_size} minmax(0, 1fr);
          }
        }
        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <div class="spacer" aria-hidden="true"></div>
      <div class="dock">
        <div class="dock-inner">
          <div class="dock-stack${fullWidthBar ? " dock-stack--full-width" : ""}">
            ${mediaPlayerToggleMarkup}
            ${mediaPlayerMarkup}
            <ha-card class="navbar-card${playDockEntrance ? ` navbar-card--entering navbar-card--entering-${config.layout.position === "top" ? "top" : "bottom"}` : ""}">
              ${titleMarkup}
              <nav class="navbar" aria-label="${escapeHtml(this._commonAria("navigationBar", "Navigation bar"))}">
                ${routesMarkup}
              </nav>
            </ha-card>
          </div>
        </div>
      </div>
      ${popupMarkup}
      ${mediaBrowserMarkup}
    `;

    this._applyRouteRuntimeStyles(visibleRoutes, playDockEntrance);
    this._applyPopupRuntimeStyles();
    this._playPopupEntrance = false;

    if (this._popupState) {
      this._schedulePopupPositionSync();
    }
    this._lastRenderSignature = this._getRenderSignature(this._hass);
  }
}
  _lazyNodaliaNavigationBarCard = NodaliaNavigationBarCard;
  return NodaliaNavigationBarCard;
}
