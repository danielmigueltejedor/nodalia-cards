// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  EDITOR_TAG,
  HUB_PANELS,
} from "./room-summary-constants";
import {
  deepClone,
  escapeHtml,
  finiteNumber,
  formatMetric,
  getState,
  isObject,
  isUnavailable,
  stateIsOn,
  stateIsOpen,
} from "./room-summary-runtime";
import {
  DEFAULT_CONFIG,
  hasRoomContent,
  hubMediaPlayerIds,
  normalizeConfig,
  STUB_CONFIG,
} from "./room-summary-config";
import {
  entityDomain,
  fireEvent,
  hubAlarmEntityIds,
  hubSecurityEntityIds,
  normalizeTextKey,
} from "./room-summary-helpers";

let _lazyNodaliaRoomSummaryCard;
export function loadNodaliaRoomSummaryCard() {
  if (_lazyNodaliaRoomSummaryCard) {
    return _lazyNodaliaRoomSummaryCard;
  }
class NodaliaRoomSummaryCard extends HTMLElement {
  static async getConfigElement() { return document.createElement(EDITOR_TAG); }
  static getStubConfig() { return deepClone(STUB_CONFIG); }

  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._configSignature = JSON.stringify(this._config);
    this._hass = null;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._activePanel = "home";
    this._hubExpanded = false;
    this._hubEmbedCache = new Map();
    this._hubEmbedConfigSignatures = new WeakMap();
    this._hubShellConfigSignature = "";
    this._suppressNextPrimaryClick = false;
    this._detachPrimaryHold = () => {};
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowInput = this._onShadowInput.bind(this);
    }

  connectedCallback() {
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    this.shadowRoot?.addEventListener("input", this._onShadowInput);
    this._detachPrimaryHold?.();
    this._detachPrimaryHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const actionTarget = event.composedPath().find(
                node => node instanceof HTMLElement && node.dataset?.roomAction === "primary",
              );
              return actionTarget ? "primary" : null;
            },
            shouldBeginHold: () => String(this._config?.hold_action || "none") !== "none",
            onHold: () => this._performCardAction("hold"),
            markHoldConsumedClick: () => {
              this._suppressNextPrimaryClick = true;
              window.NodaliaUtils?.cancelCardZoneTap?.(this);
            },
          })
        : () => {};
    this._animateContentOnNextRender = true;
    if (this._hass) { this._lastRenderSignature = ""; this._render(); }
  }

  disconnectedCallback() {
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
    this.shadowRoot?.removeEventListener("input", this._onShadowInput);
    this._detachPrimaryHold?.();
    this._detachPrimaryHold = () => {};
    this._suppressNextPrimaryClick = false;
    this._lastRenderSignature = "";
    this._hubShellConfigSignature = "";
    this._hubEmbedCache?.clear();
    this._hubEmbedConfigSignatures = new WeakMap();
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._configSignature = JSON.stringify(this._config);
    if (this._config.collapsible !== true) this._hubExpanded = false;
    this._lastRenderSignature = "";
    this._hubShellConfigSignature = "";
    this._animateContentOnNextRender = true;
    this._hubEmbedCache?.clear();
    this._hubEmbedConfigSignatures = new WeakMap();
    if (this.isConnected) this._render();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this.isConnected) return;
    const sig = this._getRenderSignature(hass);
    if (prev && sig === this._lastRenderSignature && this.shadowRoot?.innerHTML) return;
    this._lastRenderSignature = sig;
    if (prev && this._patchHubState()) return;
    this._render();
  }

  getCardSize() {
    return this._config?.collapsible === true && this._hubExpanded !== true ? 2 : 4;
  }
  getGridOptions() { return { rows: "auto", columns: "full", min_rows: this.getCardSize() }; }

  _t(key, fallback, values = {}) {
    const lang = window.NodaliaI18n?.resolveLanguage?.(this._hass, this._config?.language) ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.roomSummaryCard || window.NodaliaI18n?.strings?.("en")?.roomSummaryCard || {};
    const raw = key.split(".").reduce((cur, part) => (cur && cur[part] !== undefined ? cur[part] : undefined), pack);
    const text = raw ?? fallback;
    return window.NodaliaI18n?.format?.(text, values) ?? String(text).replace(/\{(\w+)\}/g, (_, t) => String(values[t] ?? ""));
  }

  _getRenderSignature(hass = this._hass) {
    const config = normalizeConfig(this._config);
    const ids = [
      config.temperature, config.humidity, config.presence, config.climate,
      config.camera, config.power, config.air_quality,
      ...hubMediaPlayerIds(config), ...(config.lights || []), ...(config.covers || []),
      ...(config.vacuums || []), ...(config.fans || []),
      ...(config.humidifiers || []), ...(config.others || []),
      ...(config.locks || []), ...(config.doors || []),
      ...(config.windows || []), ...(config.alerts || []), ...(config.alarms || []),
    ].filter(Boolean);
    const states = [...new Set(ids)].map(id => {
      const state = hass?.states?.[id];
      return state ? `${id}:${state.state}:${state.last_updated || state.last_changed}` : `${id}:missing`;
    }).join("|");
    return `${this._activePanel}|${this._hubExpanded ? 1 : 0}|${states}|${this._configSignature}`;
  }

  _entityLabel(entityId) {
    const state = getState(this._hass, entityId);
    return String(state?.attributes?.friendly_name || entityId || "").trim() || entityId;
  }

  _entityIcon(entityId, fallback = "mdi:help-circle-outline") {
    const state = getState(this._hass, entityId);
    return String(state?.attributes?.icon || fallback).trim() || fallback;
  }

  _lightBrightnessPct(state) {
    if (!state || typeof state.attributes?.brightness !== "number") return 0;
    return Math.max(1, Math.min(100, Math.round((state.attributes.brightness / 255) * 100)));
  }

  _supportsLightBrightness(state) {
    return Boolean(state && typeof state.attributes?.brightness === "number");
  }

  _getHubNavItems(config, summary) {
    const items = [];
    if (config.show_lights !== false && config.lights?.length) {
      items.push({
        id: "lights",
        icon: "mdi:lightbulb",
        label: this._t("lights", "Lights"),
        active: summary?.lights_on === true,
      });
    }
    if (config.show_covers !== false && config.covers?.length) {
      items.push({
        id: "covers",
        icon: "mdi:window-shutter",
        label: this._t("covers", "Covers"),
        active: summary?.cover_open === true,
      });
    }
    if (config.show_climate !== false && config.climate) {
      const climateKey = normalizeTextKey(getState(this._hass, config.climate)?.state);
      items.push({
        id: "climate",
        icon: "mdi:home-thermometer-outline",
        label: this._t("climateLabel", "Climate"),
        active: Boolean(climateKey && !["off", "unavailable", "unknown"].includes(climateKey)),
      });
    }
    if (config.vacuums?.length) {
      const anyVacuumActive = config.vacuums.some(id => {
        const key = normalizeTextKey(getState(this._hass, id)?.state);
        return Boolean(key && !["off", "idle", "docked", "paused", "unavailable", "unknown", "error"].includes(key));
      });
      items.push({ id: "vacuum", icon: "mdi:robot-vacuum", label: this._t("vacuum", "Vacuum"), active: anyVacuumActive });
    }
    if (config.fans?.length) {
      const anyFanOn = config.fans.some(id => {
        const state = getState(this._hass, id);
        return state && stateIsOn(state);
      });
      items.push({
        id: "fans",
        icon: "mdi:fan",
        label: this._t("fans", "Fans"),
        active: anyFanOn,
      });
    }
    if (config.humidifiers?.length) {
      const anyHumidifierOn = config.humidifiers.some(id => {
        const state = getState(this._hass, id);
        return state && stateIsOn(state);
      });
      items.push({
        id: "humidifiers",
        icon: "mdi:air-humidifier",
        label: this._t("humidifiers", "Humidifiers"),
        active: anyHumidifierOn,
      });
    }
    if (config.show_media !== false && hubMediaPlayerIds(config).length) {
      const anyMediaOn = hubMediaPlayerIds(config).some(id => stateIsOn(getState(this._hass, id)));
      items.push({
        id: "media",
        icon: "mdi:play-circle",
        label: this._t("mediaPlayer", "Media player"),
        active: anyMediaOn,
      });
    }
    if (config.show_camera !== false && config.camera) {
      items.push({
        id: "camera",
        icon: "mdi:cctv",
        label: this._t("camera", "Camera"),
        active: summary?.camera_available === true,
      });
    }
    if (config.show_security !== false && (hubSecurityEntityIds(config).length || hubAlarmEntityIds(config).length)) {
      items.push({
        id: "security",
        icon: "mdi:shield-home",
        label: this._t("security", "Security"),
        active: summary?.security_issue === true,
      });
    }
    if (config.others?.length) {
      items.push({
        id: "others",
        icon: "mdi:shape-outline",
        label: this._t("others", "Others"),
        active: config.others.some(id => stateIsOn(getState(this._hass, id))),
      });
    }
    return items;
  }

  _getContextualActions(summary, config) {
    if (config.show_quick_actions === false) return [];
    const actions = [];
    if (config.lights?.length) {
      actions.push({
        id: summary.lights_on ? "lights_off" : "lights_on",
        icon: "mdi:lightbulb",
        label: summary.lights_on ? this._t("turnOffLights", "Turn off lights") : this._t("turnOnLights", "Turn on lights"),
        active: summary.lights_on === true,
      });
    }
    if (config.covers?.length) {
      actions.push({
        id: summary.cover_open ? "covers_close" : "covers_open",
        icon: "mdi:window-shutter",
        label: summary.cover_open ? this._t("closeCovers", "Close covers") : this._t("openCovers", "Open covers"),
        active: summary.cover_open === true,
      });
    }
    if (config.fans?.length) {
      const anyFanOn = config.fans.some(id => {
        const state = getState(this._hass, id);
        return state && stateIsOn(state);
      });
      actions.push({
        id: anyFanOn ? "fans_off" : "fans_on",
        icon: "mdi:fan",
        label: anyFanOn ? this._t("turnOffFans", "Turn off fans") : this._t("turnOnFans", "Turn on fans"),
        active: anyFanOn,
      });
    }
    if (config.climate) {
      actions.push({
        id: "climate_up",
        icon: "mdi:chevron-up",
        label: this._t("raiseTemperature", "Raise temperature"),
      });
      actions.push({
        id: "climate_down",
        icon: "mdi:chevron-down",
        label: this._t("lowerTemperature", "Lower temperature"),
      });
    }
    if (config.media_player) {
      const mediaState = getState(this._hass, config.media_player);
      const mediaKey = normalizeTextKey(mediaState?.state);
      if (mediaKey === "playing") {
        actions.push({
          id: "media_play_pause",
          icon: "mdi:play-pause",
          label: this._t("mediaPause", "Pause"),
          active: true,
        });
      } else if (mediaKey === "paused") {
        actions.push({
          id: "media_play_pause",
          icon: "mdi:play-pause",
          label: this._t("mediaPlay", "Play"),
        });
      }
      if (mediaState && stateIsOn(mediaState)) {
        actions.push({
          id: "media_off",
          icon: "mdi:power",
          label: this._t("turnOffMedia", "Turn off media"),
          active: true,
        });
      } else if (mediaState && !isUnavailable(mediaState)) {
        actions.push({
          id: "media_on",
          icon: "mdi:power",
          label: this._t("turnOnMedia", "Turn on media"),
        });
      }
    }
    if (summary.security_issue) {
      actions.push({ id: "security", icon: "mdi:shield-alert", label: this._t("securityIssue", "Security issue"), warn: true });
    }
    return actions;
  }

  _setHubPanel(panel) {
    const next = HUB_PANELS.has(panel) ? panel : "home";
    if (next === this._activePanel) return;
    this._activePanel = next;
    this._triggerHaptic();
    if (!this._activateHubPanel(next)) this._render();
  }

  _ensureHubEmbedStash() {
    let stash = this.shadowRoot?.querySelector("[data-hub-embed-stash]");
    if (stash) return stash;
    stash = document.createElement("div");
    stash.hidden = true;
    stash.setAttribute("data-hub-embed-stash", "");
    stash.setAttribute("aria-hidden", "true");
    stash.style.display = "none";
    this.shadowRoot?.appendChild(stash);
    return stash;
  }

  _parkHubEmbeddedCards() {
    if (!this.shadowRoot || !this._hubEmbedCache?.size) return;
    const stash = this._ensureHubEmbedStash();
    for (const card of this._hubEmbedCache.values()) {
      if (card instanceof HTMLElement && card.parentElement !== stash) {
        stash.appendChild(card);
      }
    }
  }

  _hubViewMarkup(panel, config, summary, styles, accentColor, collapsed) {
    return `<section class="room-hub__view" data-hub-panel="${escapeHtml(panel)}" aria-hidden="false">
      ${panel === "home"
    ? this._renderHubHome(config, summary, styles, accentColor, collapsed)
    : this._renderHubPanelContent(panel, config, summary, styles, accentColor)}
    </section>`;
  }

  _syncHubChrome(config, summary, styles, collapsed, activePanel) {
    const header = this.shadowRoot.querySelector(".room-hub__header");
    if (!header) return false;
    header.outerHTML = this._renderHubHeader(config, summary, styles, collapsed);
    const contextActions = this.shadowRoot.querySelector("[data-hub-context-actions]");
    if (contextActions) {
      const contextual = this._getContextualActions(summary, config);
      contextActions.innerHTML = this._renderHubContextActions(contextual);
      contextActions.hidden = contextual.length === 0;
    }
    const navItems = this._getHubNavItems(config, summary);
    const rail = this.shadowRoot.querySelector(".room-hub__rail");
    const hub = this.shadowRoot.querySelector(".room-hub");
    if (!collapsed && navItems.length) {
      const markup = this._renderHubRail(navItems, activePanel);
      if (rail) rail.outerHTML = markup;
      else hub?.insertAdjacentHTML("beforeend", markup);
    } else {
      rail?.remove();
    }
    return true;
  }

  _activateHubPanel(panel) {
    const body = this.shadowRoot?.querySelector(".room-hub__body");
    if (!body) return false;
    const config = normalizeConfig(this._config || {});
    const summary = buildRoomSummary(this._hass, config);
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const accentColor = styles.accent || "var(--primary-color)";
    const collapsible = config.collapsible === true;
    const collapsed = collapsible && this._hubExpanded !== true;
    this._parkHubEmbeddedCards();
    body.classList.remove("room-hub__body--enter");
    body.innerHTML = this._hubViewMarkup(panel, config, summary, styles, accentColor, collapsed);
    this._syncHubChrome(config, summary, styles, collapsed, panel);
    this._mountHubEmbeddedCards();
    this._lastRenderSignature = this._getRenderSignature(this._hass);
    return true;
  }

  _patchHubState() {
    if (!this.shadowRoot?.querySelector("ha-card.room-summary-card--hub")) return false;
    const config = normalizeConfig(this._config || {});
    const summary = buildRoomSummary(this._hass, config);
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const collapsible = config.collapsible === true;
    const collapsed = collapsible && this._hubExpanded !== true;
    const activePanel = collapsed ? "home" : HUB_PANELS.has(this._activePanel) ? this._activePanel : "home";
    if (!this._syncHubChrome(config, summary, styles, collapsed, activePanel)) return false;

    const patchPanel = (panel, markup) => {
      const view = this.shadowRoot.querySelector(`[data-hub-panel="${panel}"]`);
      if (view) view.innerHTML = markup;
    };
    if (activePanel === "covers" && config.covers?.length) {
      patchPanel("covers", this._renderHubCoverPanel(config));
    }
    this._mountHubEmbeddedCards();
    return true;
  }

  _toggleEntity(entityId) {
    const state = getState(this._hass, entityId);
    const domain = entityDomain(entityId);
    if (!state || !domain) return;
    this._triggerHaptic();
    if (domain === "light") {
      void this._invoke("light", stateIsOn(state) ? "turn_off" : "turn_on", { entity_id: entityId });
      return;
    }
    if (domain === "fan") {
      void this._invoke("fan", stateIsOn(state) ? "turn_off" : "turn_on", { entity_id: entityId });
      return;
    }
    if (domain === "cover") {
      void this._invoke("cover", stateIsOpen(state) ? "close_cover" : "open_cover", { entity_id: entityId });
      return;
    }
    if (domain === "switch") {
      void this._invoke("switch", stateIsOn(state) ? "turn_off" : "turn_on", { entity_id: entityId });
    }
  }

  _runVacuumService(entityId, service) {
    if (!entityId) return;
    this._triggerHaptic();
    void this._invoke("vacuum", service, { entity_id: entityId });
  }

  _runClimateDelta(entityId, delta) {
    const state = getState(this._hass, entityId);
    if (!state) return;
    const current = finiteNumber(state.attributes?.temperature);
    if (current === null) return;
    this._triggerHaptic();
    void this._invoke("climate", "set_temperature", { entity_id: entityId, temperature: current + delta });
  }

  _runMediaControl(control) {
    const entityId = this._config?.media_player;
    if (!entityId) return;
    this._triggerHaptic();
    if (control === "play_pause") {
      const state = getState(this._hass, entityId);
      const playing = normalizeTextKey(state?.state) === "playing";
      void this._invoke("media_player", playing ? "media_pause" : "media_play", { entity_id: entityId });
      return;
    }
    if (control === "next") void this._invoke("media_player", "media_next_track", { entity_id: entityId });
    if (control === "prev") void this._invoke("media_player", "media_previous_track", { entity_id: entityId });
  }

  _onShadowInput(event) {
    const el = event.target;
    if (!(el instanceof HTMLInputElement) || el.type !== "range") return;
    const entityId = String(el.dataset.entityId || "").trim();
    if (!entityId) return;
    const pct = Number(el.value);
    if (!Number.isFinite(pct)) return;
    void this._invoke("light", "turn_on", {
      entity_id: entityId,
      brightness: Math.max(1, Math.min(255, Math.round((pct / 100) * 255))),
    });
  }

  _triggerHaptic() {
    if (this._config?.haptics?.enabled !== true) return;
    fireEvent(this, "haptic", this._config.haptics.style || "medium", { bubbles: true, composed: true });
  }

  _invoke(domain, service, data = {}, target = null) {
    const fn = window.NodaliaUtils?.invokeHomeAssistantService?.bind(window.NodaliaUtils);
    if (typeof fn === "function") return fn(this, this._hass, domain, service, data, target);
    return Promise.resolve().then(() => (
      this._hass?.callService?.(domain, service, data, target || undefined)
    ));
  }

  _parseActionObject(value) {
    if (isObject(value)) return deepClone(value);
    const source = String(value || "").trim();
    if (!source) return {};
    try {
      const parsed = JSON.parse(source);
      return isObject(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  _isConfiguredServiceAllowed(serviceValue) {
    const security = this._config?.security || DEFAULT_CONFIG.security;
    if (security.strict_service_actions === false) return true;
    const normalizedService = String(serviceValue || "").trim().toLowerCase();
    const separator = normalizedService.indexOf(".");
    if (separator <= 0 || separator >= normalizedService.length - 1) return false;
    const domain = normalizedService.slice(0, separator);
    const allowedServices = Array.isArray(security.allowed_services)
      ? security.allowed_services.map(item => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    const allowedDomains = Array.isArray(security.allowed_service_domains)
      ? security.allowed_service_domains.map(item => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    return allowedServices.includes(normalizedService) || allowedDomains.includes(domain);
  }

  _runConfiguredService(prefix) {
    const serviceValue = String(this._config?.[`${prefix}_service`] || "").trim();
    const separator = serviceValue.indexOf(".");
    if (separator <= 0 || separator >= serviceValue.length - 1) return;
    if (!this._isConfiguredServiceAllowed(serviceValue)) {
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Room Summary Card", serviceValue);
      return;
    }
    const domain = serviceValue.slice(0, separator);
    const service = serviceValue.slice(separator + 1);
    const data = this._parseActionObject(this._config?.[`${prefix}_service_data`]);
    const target = this._parseActionObject(this._config?.[`${prefix}_service_target`]);
    void this._invoke(domain, service, data, Object.keys(target).length ? target : null);
  }

  _primaryActionEntity() {
    const cfg = this._config || {};
    return cfg.climate || cfg.temperature || cfg.camera || cfg.media_player || cfg.lights?.[0] || "";
  }

  _performCardAction(prefix) {
    const cfg = this._config || {};
    const action = String(cfg[`${prefix}_action`] || "none");
    if (action === "none") return;
    this._triggerHaptic();
    if (action === "more-info") {
      const entity = this._primaryActionEntity();
      if (entity) fireEvent(this, "hass-more-info", { entityId: entity });
      return;
    }
    if (action === "toggle") {
      this._toggleEntity(this._primaryActionEntity());
      return;
    }
    if (action === "service") {
      this._runConfiguredService(prefix);
      return;
    }
    if (action === "navigate") {
      const pathValue = prefix === "tap" ? cfg.navigation_path : cfg[`${prefix}_navigation_path`];
      const path = window.NodaliaUtils?.sanitizeActionUrl?.(pathValue, { allowRelative: true });
      if (path) fireEvent(this, "hass-navigate", { path });
      return;
    }
    if (action === "url") {
      const url = window.NodaliaUtils?.sanitizeActionUrl?.(cfg[`${prefix}_url`], { allowRelative: true });
      if (url) window.open(url, cfg[`${prefix}_new_tab`] ? "_blank" : "_self", "noopener,noreferrer");
    }
  }

  _runQuickAction(action) {
    const cfg = this._config || {};
    const summary = buildRoomSummary(this._hass, cfg);
    this._triggerHaptic();
    if (action === "lights_on" && cfg.lights?.length) {
      void this._invoke("light", "turn_on", { entity_id: cfg.lights });
      return;
    }
    if (action === "lights_off" && cfg.lights?.length) {
      void this._invoke("light", "turn_off", { entity_id: cfg.lights });
      return;
    }
    if (action === "covers_close" && cfg.covers?.length) {
      void this._invoke("cover", "close_cover", { entity_id: cfg.covers });
      return;
    }
    if (action === "covers_open" && cfg.covers?.length) {
      void this._invoke("cover", "open_cover", { entity_id: cfg.covers });
      return;
    }
    if (action === "camera" && cfg.camera) {
      fireEvent(this, "hass-more-info", { entityId: cfg.camera });
      return;
    }
    if (action === "climate" && cfg.climate) {
      fireEvent(this, "hass-more-info", { entityId: cfg.climate });
      return;
    }
    if (action === "media" && cfg.media_player) {
      fireEvent(this, "hass-more-info", { entityId: cfg.media_player });
      return;
    }
    if (action === "fans_on" && cfg.fans?.length) {
      void this._invoke("fan", "turn_on", { entity_id: cfg.fans });
      return;
    }
    if (action === "fans_off" && cfg.fans?.length) {
      void this._invoke("fan", "turn_off", { entity_id: cfg.fans });
      return;
    }
    if (action === "climate_up" && cfg.climate) {
      this._runClimateDelta(cfg.climate, 1);
      return;
    }
    if (action === "climate_down" && cfg.climate) {
      this._runClimateDelta(cfg.climate, -1);
      return;
    }
    if (action === "media_play_pause" && cfg.media_player) {
      this._runMediaControl("play_pause");
      return;
    }
    if (action === "media_on" && cfg.media_player) {
      void this._invoke("media_player", "turn_on", { entity_id: cfg.media_player });
      return;
    }
    if (action === "media_off" && cfg.media_player) {
      void this._invoke("media_player", "turn_off", { entity_id: cfg.media_player });
      return;
    }
    if (action === "security") {
      this._setHubPanel("security");
    }
  }

  _onShadowClick(event) {
    const el = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.roomAction);
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    const action = el.dataset.roomAction;
    if (action === "primary") {
      if (this._suppressNextPrimaryClick) {
        this._suppressNextPrimaryClick = false;
        return;
      }
      this._performCardAction("tap");
      return;
    }
    if (action?.startsWith("nav:")) {
      this._setHubPanel(action.slice(4));
      return;
    }
    if (action === "toggle-hub-expand") {
      this._hubExpanded = !this._hubExpanded;
      this._activePanel = "home";
      this._lastRenderSignature = "";
      this._triggerHaptic();
      this._render();
      return;
    }
    if (action?.startsWith("toggle:")) {
      this._toggleEntity(action.slice(7));
      return;
    }
    if (action?.startsWith("vacuum:")) {
      const [, service, entityId] = action.split(":");
      this._runVacuumService(entityId, service);
      return;
    }
    if (action?.startsWith("cover:")) {
      const [, service, entityId] = action.split(":");
      if (!entityId) return;
      this._triggerHaptic();
      void this._invoke("cover", service, { entity_id: entityId });
      return;
    }
    if (action?.startsWith("climate:")) {
      const [, delta, entityId] = action.split(":");
      this._runClimateDelta(entityId, Number(delta));
      return;
    }
    if (action?.startsWith("media:")) {
      this._runMediaControl(action.slice(6));
      return;
    }
    if (action?.startsWith("more-info:")) {
      const entityId = action.slice(10);
      if (entityId) {
        this._triggerHaptic();
        fireEvent(this, "hass-more-info", { entityId });
      }
      return;
    }
    if (action?.startsWith("quick:")) this._runQuickAction(action.slice(6));
  }

  _renderHubBubble(icon, action, { active = false, large = false, label = "" } = {}) {
    const classes = [
      "room-hub__bubble",
      active ? "room-hub__bubble--active" : "",
      large ? "room-hub__bubble--large" : "",
    ].filter(Boolean).join(" ");
    return `<button type="button" class="${classes}" data-room-action="${escapeHtml(action)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label || icon)}">
      <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
    </button>`;
  }

  _renderHubRail(navItems, activePanel) {
    const bubbles = [];
    if (activePanel !== "home") {
      bubbles.push(this._renderHubBubble("mdi:home", "nav:home", {
        active: false,
        label: this._t("hubHome", "Home"),
      }));
    }
    navItems
      .filter(item => activePanel === "home" || item.id !== activePanel)
      .forEach(item => {
        bubbles.push(this._renderHubBubble(item.icon, `nav:${item.id}`, {
          active: activePanel === item.id || item.active === true,
          label: item.label,
        }));
      });
    return `<aside class="room-hub__rail" aria-label="${escapeHtml(this._t("hubNavigation", "Room navigation"))}">
      ${bubbles.join("")}
    </aside>`;
  }

  _renderHubHomeMedia(config) {
    if (config.show_media === false) return "";
    const ids = hubMediaPlayerIds(config);
    if (!ids.length) return "";
    return `<div class="room-hub__embed-host room-hub__embed-host--media" data-hub-embed="media" data-hub-slot="group" data-hub-media="group" data-entity="${escapeHtml(ids[0])}"></div>`;
  }

  _renderHubHomeCamera(config) {
    if (config.show_camera === false || !config.camera) return "";
    return `<div class="room-hub__embed-host room-hub__embed-host--camera" data-hub-embed="camera" data-hub-slot="live" data-entity="${escapeHtml(config.camera)}"></div>`;
  }

  _hubEmbedStylePack(config) {
    const base = normalizeConfig(config);
    return {
      language: base.language,
      animations: { ...deepClone(base.animations), content_duration: 0 },
      haptics: deepClone(base.haptics),
    };
  }

  _hubEmbeddedAccentPack(config) {
    const parent = deepClone(normalizeConfig(config).styles);
    const hub = parent.hub || {};
    const hubDefaults = DEFAULT_CONFIG.styles.hub;
    const accent = parent.accent || "var(--primary-color)";
    return {
      ...parent,
      title_size: hub.embed_title_size || hubDefaults.embed_title_size,
      chip_font_size: hub.embed_chip_font_size || hubDefaults.embed_chip_font_size,
      chip_height: hub.embed_chip_height || hubDefaults.embed_chip_height,
      chip_padding: hub.embed_chip_padding || hubDefaults.embed_chip_padding,
      accent,
      control: {
        ...parent.control,
        accent_background: parent.control?.accent_background || `color-mix(in srgb, ${accent} 14%, transparent)`,
      },
    };
  }

  _hubEmbedCustomization(config, host) {
    const listKeyByType = {
      light: "lights",
      vacuum: "vacuums",
      fan: "fans",
      humidifier: "humidifiers",
      entity: "others",
    };
    const listKey = listKeyByType[String(host?.dataset?.hubEmbed || "")];
    if (!listKey) return {};
    const entityId = String(host?.dataset?.entity || "").trim();
    const index = Number(host?.dataset?.hubIndex);
    const options = config.embed_options?.[listKey] || [];
    const option = options.find(item => String(item?.entity || "").trim() === entityId)
      || (Number.isInteger(index) ? options[index] : null)
      || {};
    return {
      ...(option.name ? { name: option.name } : {}),
      ...(option.icon ? { icon: option.icon } : {}),
    };
  }

  _hubMediaEmbedConfig(config, host) {
    const native = isObject(config.media_config) ? deepClone(config.media_config) : {};
    const entityId = String(host?.dataset?.entity || "").trim();
    const scope = String(host?.dataset?.hubMedia || "single");
    const ids = hubMediaPlayerIds(config);
    const nativePlayers = Array.isArray(native.players) ? native.players.filter(player => player?.entity) : [];
    const matchingPlayer = nativePlayers.find(player => String(player.entity || "").trim() === entityId);
    const groupedPlayers = nativePlayers.length
      ? nativePlayers
      : ids.map(entity => ({ entity }));
    const players = (scope === "group" ? groupedPlayers : [matchingPlayer || { entity: entityId }])
      .filter(player => player?.entity)
      .map(player => ({ ...player, show: player.show !== false }));
    const nativeAnimations = isObject(native.animations) ? native.animations : config.animations;
    return {
      ...native,
      show: true,
      show_state: native.show_state ?? false,
      show_device_chip: native.show_device_chip ?? true,
      album_cover_background: native.album_cover_background !== false,
      players,
      animations: { ...deepClone(nativeAnimations), content_duration: 0, panel_duration: 0 },
      layout: {
        ...(isObject(native.layout) ? native.layout : {}),
        fixed: false,
        reserve_space: false,
      },
      styles: isObject(native.styles) ? native.styles : {},
    };
  }

  _hubCameraEmbedConfig(config, host) {
    const entityId = String(host?.dataset?.entity || "").trim();
    const native = isObject(config.camera_config) ? deepClone(config.camera_config) : {};
    const embeddedStyles = this._hubEmbeddedAccentPack(config);
    const cameras = Array.isArray(native.cameras)
      ? native.cameras.map(id => String(id || "").trim()).filter(Boolean)
      : [];
    if (entityId && !cameras.includes(entityId)) {
      cameras.unshift(entityId);
    }
    return {
      ...native,
      entity: entityId || native.entity || cameras[0] || "",
      cameras: cameras.length ? cameras : (entityId ? [entityId] : []),
      show_name: native.show_name === true,
      show_state: native.show_state === true,
      show_status_chips: native.show_status_chips === true,
      styles: {
        ...embeddedStyles,
        ...(isObject(native.styles) ? native.styles : {}),
        card: {
          ...(embeddedStyles.card || {}),
          ...(isObject(native.styles?.card) ? native.styles.card : {}),
          padding: native.styles?.card?.padding || "8px",
        },
        preview: {
          aspect_ratio: "16 / 9",
          min_height: "140px",
          border_radius: "18px",
          ...(isObject(native.styles?.preview) ? native.styles.preview : {}),
        },
      },
    };
  }

  _hubConfiguredEmbedKeys(config) {
    const keys = new Set();
    const add = (type, id, slot) => {
      const entityId = String(id || "").trim();
      if (entityId) keys.add(`${type}:${entityId}:${slot}`);
    };
    (config.lights || []).forEach(id => add("light", id, "panel"));
    (config.vacuums || []).forEach(id => add("vacuum", id, "panel"));
    (config.fans || []).forEach(id => add("fan", id, "panel"));
    (config.humidifiers || []).forEach(id => add("humidifier", id, "panel"));
    (config.others || []).forEach(id => add("entity", id, "panel"));
    hubSecurityEntityIds(config).forEach(id => add("entity", id, "panel"));
    hubAlarmEntityIds(config).forEach(id => add("alarm", id, "panel"));
    if (config.climate) add("climate", config.climate, "panel");
    const mediaIds = hubMediaPlayerIds(config);
    if (mediaIds[0]) add("media", mediaIds[0], "group");
    if (config.camera) add("camera", config.camera, "live");
    return keys;
  }

  _mountHubEmbeddedCards() {
    if (!this.shadowRoot) return;
    const config = normalizeConfig(this._config || {});
    const pack = this._hubEmbedStylePack(config);
    const embeddedStyles = this._hubEmbeddedAccentPack(config);
    const cacheKeyForHost = host => {
      const entityId = String(host?.dataset?.entity || "").trim();
      const embedType = String(host?.dataset?.hubEmbed || "").trim();
      const slot = String(host?.dataset?.hubSlot || "panel").trim();
      return entityId && embedType ? `${embedType}:${entityId}:${slot}` : "";
    };

    const mount = (host, tagName, extra = {}) => {
      if (!(host instanceof HTMLElement)) return;
      const entityId = String(host.dataset.entity || "").trim();
      if (!entityId) return;
      if (!customElements.get(tagName)) return;
      const cacheKey = cacheKeyForHost(host);
      let card = this._hubEmbedCache?.get(cacheKey);
      if (!card) {
        card = document.createElement(tagName);
        this._hubEmbedCache?.set(cacheKey, card);
      }
      if (card.parentElement !== host) {
        host.replaceChildren(card);
      }
      const cardConfig = { entity: entityId, ...pack, ...extra, ...this._hubEmbedCustomization(config, host) };
      const configSignature = JSON.stringify(cardConfig);
      const configChanged = this._hubEmbedConfigSignatures.get(card) !== configSignature;
      if (this._hass) card._hass = this._hass;
      if (configChanged) {
        try {
          card.setConfig(cardConfig);
          this._hubEmbedConfigSignatures.set(card, configSignature);
        } catch (error) {
          console.warn(`[nodalia-room-summary-card] ${tagName} setConfig failed`, error);
        }
      } else if (this._hass) {
        card.hass = this._hass;
      }
    };

    this.shadowRoot.querySelectorAll('[data-hub-embed="light"]').forEach(host => {
      mount(host, "nodalia-light-card", {
        auto_expand: true,
        compact_layout_mode: "never",
        show_brightness: true,
        show_slider_mode_buttons: true,
        show_color_controls: true,
        show_temperature_controls: true,
        show_quick_brightness: false,
        show_quick_color_presets: false,
        show_quick_temperature_presets: false,
        tap_action: "toggle",
        icon_tap_action: "toggle",
        styles: embeddedStyles,
      });
    });
    this.shadowRoot.querySelectorAll('[data-hub-embed="vacuum"]').forEach(host => {
      mount(host, "nodalia-vacuum-card", {
        show_mode_controls: true,
        show_fan_presets: true,
        show_return_to_base: true,
        show_stop: true,
        show_locate: true,
        show_state_chip: true,
        show_battery_chip: true,
        styles: embeddedStyles,
      });
    });
    this.shadowRoot.querySelectorAll('[data-hub-embed="fan"]').forEach(host => {
      mount(host, "nodalia-fan-card", {
        show_slider: true,
        show_preset_modes: true,
        show_oscillation: true,
        compact_layout_mode: "never",
        tap_action: "toggle",
        icon_tap_action: "toggle",
        styles: embeddedStyles,
      });
    });
    this.shadowRoot.querySelectorAll('[data-hub-embed="humidifier"]').forEach(host => {
      mount(host, "nodalia-humidifier-card", {
        show_slider: true,
        show_mode_button: true,
        show_fan_mode_button: true,
        compact_layout_mode: "never",
        tap_action: "toggle",
        icon_tap_action: "toggle",
        styles: embeddedStyles,
      });
    });
    this.shadowRoot.querySelectorAll('[data-hub-embed="climate"]').forEach(host => {
      mount(host, "nodalia-climate-card", {
        layout: "compact",
        show_schedule_button: false,
        styles: embeddedStyles,
      });
    });
    this.shadowRoot.querySelectorAll('[data-hub-embed="alarm"]').forEach(host => {
      mount(host, "nodalia-alarm-panel-card", {
        compact_layout_mode: "never",
        styles: embeddedStyles,
      });
    });
    this.shadowRoot.querySelectorAll('[data-hub-embed="entity"]').forEach(host => {
      mount(host, "nodalia-entity-card", {
        compact_layout_mode: "never",
        styles: embeddedStyles,
      });
    });
    this.shadowRoot.querySelectorAll('[data-hub-embed="media"]').forEach(host => {
      mount(host, "nodalia-media-player", this._hubMediaEmbedConfig(config, host));
    });
    this.shadowRoot.querySelectorAll('[data-hub-embed="camera"]').forEach(host => {
      mount(host, "nodalia-camera-card", this._hubCameraEmbedConfig(config, host));
    });
    const configuredKeys = this._hubConfiguredEmbedKeys(config);
    for (const [key, card] of this._hubEmbedCache || []) {
      if (!configuredKeys.has(key)) {
        card.remove();
        this._hubEmbedCache.delete(key);
      }
    }
  }

  _renderHubEmbedHosts(entityIds, embedType, slot = "panel") {
    return `<div class="room-hub__embed-list">${(entityIds || []).map((entityId, index) => `
      <div class="room-hub__embed-host" data-hub-embed="${escapeHtml(embedType)}" data-hub-slot="${escapeHtml(slot)}" data-hub-index="${index}" data-entity="${escapeHtml(entityId)}"></div>
    `).join("")}</div>`;
  }

  _renderHubRoomIcon(icon, title, styles) {
    return `<button type="button" class="room-hub__room-icon" data-room-action="primary" aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}">
      <ha-icon icon="${escapeHtml(icon || "mdi:floor-plan")}"></ha-icon>
    </button>`;
  }

  _renderHubHeader(config, summary, styles, collapsed = false) {
    const title = config.name || this._t("defaultName", "Room");
    const statusChips = this._renderHubStatusChips(config, summary);
    const collapsible = config.collapsible === true;
    const headerClasses = [
      "room-hub__header",
      "room-hub__home-header",
      collapsible ? "room-hub__header--with-toggle" : "",
      collapsed ? "room-hub__header--collapsed" : "",
    ].filter(Boolean).join(" ");
    const toggleLabel = collapsed
      ? this._t("expandDetails", "Expand room details")
      : this._t("collapseDetails", "Collapse room details");
    return `<header class="${headerClasses}">
      ${this._renderHubRoomIcon(config.icon, title, styles)}
      <div class="room-hub__room-copy">
        <div class="room-hub__room-title">${escapeHtml(title)}</div>
        ${statusChips ? `<div class="room-hub__status-chips">${statusChips}</div>` : ""}
      </div>
      ${collapsible ? `<button type="button" class="room-hub__expand-toggle" data-room-action="toggle-hub-expand" aria-expanded="${collapsed ? "false" : "true"}" aria-label="${escapeHtml(toggleLabel)}" title="${escapeHtml(toggleLabel)}">
        <ha-icon icon="${collapsed ? "mdi:chevron-down" : "mdi:chevron-up"}"></ha-icon>
      </button>` : ""}
    </header>`;
  }

  _renderHubStatusChips(config, summary) {
    const chips = [];
    const pushChip = (className, icon, label, entityId) => {
      if (!entityId) return;
      chips.push(`<button type="button" class="room-hub__metric-bubble ${className}" data-room-action="more-info:${escapeHtml(entityId)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
        <ha-icon icon="${escapeHtml(icon)}"></ha-icon><span>${escapeHtml(label)}</span>
      </button>`);
    };
    const pushIconChip = (className, icon, label, entityId) => {
      if (!entityId) return;
      chips.push(`<button type="button" class="room-hub__metric-bubble room-hub__metric-bubble--icon-only ${className}" data-room-action="more-info:${escapeHtml(entityId)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
        <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
      </button>`);
    };
    if (config.show_temperature && config.temperature && summary.temperature !== "—") {
      pushChip(
        "room-hub__metric-bubble--temperature",
        "mdi:thermometer",
        summary.temperature,
        config.temperature,
      );
    }
    if (config.show_humidity && config.humidity && summary.humidity !== "—") {
      pushChip(
        "room-hub__metric-bubble--humidity",
        "mdi:water-percent",
        summary.humidity,
        config.humidity,
      );
    }
    if (config.show_presence && (config.presence || config.occupancy)) {
      const presenceEntity = config.presence || config.occupancy;
      if (summary.occupied) {
        pushIconChip(
          "room-hub__metric-bubble--presence room-hub__metric-bubble--presence-occupied",
          "mdi:account-check",
          this._t("occupied", "Occupied"),
          presenceEntity,
        );
      } else if (summary.empty) {
        pushIconChip(
          "room-hub__metric-bubble--presence room-hub__metric-bubble--presence-vacant",
          "mdi:account-off-outline",
          this._t("vacant", "Vacant"),
          presenceEntity,
        );
      }
    }
    if (config.show_power && config.power) {
      const powerState = getState(this._hass, config.power);
      const powerLabel = formatMetric(powerState);
      if (powerLabel !== "—") {
        pushChip("room-hub__metric-bubble--power", "mdi:flash", powerLabel, config.power);
      }
    }
    if (config.air_quality) {
      const airState = getState(this._hass, config.air_quality);
      const airLabel = formatMetric(airState);
      if (airLabel !== "—") {
        pushChip("room-hub__metric-bubble--air", "mdi:air-filter", airLabel, config.air_quality);
      }
    }
    if (config.show_camera && config.camera) {
      pushIconChip(
        summary.camera_offline
          ? "room-hub__metric-bubble--camera room-hub__metric-bubble--camera-offline"
          : "room-hub__metric-bubble--camera",
        "mdi:cctv",
        summary.camera_offline ? this._t("cameraOffline", "Camera offline") : this._t("camera", "Camera"),
        config.camera,
      );
    }
    if (config.show_security) {
      if (summary.doorsOpen > 0 && config.doors?.[0]) {
        pushChip(
          "room-hub__metric-bubble--security",
          "mdi:door-open",
          this._t("doorOpen", "Door open"),
          config.doors[0],
        );
      }
      if (summary.windowsOpen > 0 && config.windows?.[0]) {
        pushChip(
          "room-hub__metric-bubble--security",
          "mdi:window-open",
          this._t("windowOpen", "Window open"),
          config.windows[0],
        );
      }
      if (summary.locksUnlocked > 0 && config.locks?.[0]) {
        pushChip(
          "room-hub__metric-bubble--security",
          "mdi:lock-open-variant",
          this._t("lockUnlocked", "Unlocked"),
          config.locks[0],
        );
      }
      if (summary.alertsActive > 0 && config.alerts?.[0]) {
        pushChip(
          "room-hub__metric-bubble--security",
          "mdi:alert",
          this._t("alert", "Alert"),
          config.alerts[0],
        );
      }
      if (summary.alarmsTriggered > 0 && config.alarms?.[0]) {
        pushChip(
          "room-hub__metric-bubble--security",
          "mdi:shield-alert",
          this._t("alarm", "Alarm"),
          config.alarms[0],
        );
      }
    }
    return chips.join("");
  }

  _renderHubHome(config, summary, styles, accentColor, collapsed = false) {
    const image = collapsed ? "" : window.NodaliaUtils?.sanitizeActionUrl?.(config.image, { allowRelative: true }) || "";
    const contextual = this._getContextualActions(summary, config);
    const homeClass = image ? "room-hub__home room-hub__home--image" : "room-hub__home";
    const homeStyle = image ? ` style="--room-hub-bg-image:url('${escapeHtml(image)}')"` : "";
    return `<div class="${homeClass}"${homeStyle}>
      <div class="room-hub__context-actions" data-hub-context-actions${contextual.length ? "" : " hidden"}>
        ${this._renderHubContextActions(contextual)}
      </div>
      ${collapsed ? "" : this._renderHubHomeMedia(config)}
      ${collapsed ? "" : this._renderHubHomeCamera(config)}
    </div>`;
  }

  _renderHubContextActions(contextual) {
    return contextual.map(action => `
      <button type="button" class="room-hub__context-action ${action.active ? "room-hub__context-action--active" : ""} ${action.warn ? "room-hub__context-action--warn" : ""}"
        data-room-action="quick:${escapeHtml(action.id)}"
        aria-label="${escapeHtml(action.label)}" title="${escapeHtml(action.label)}">
        <ha-icon icon="${escapeHtml(action.icon)}"></ha-icon>
      </button>`).join("");
  }

  _renderHubLightPanel(config) {
    return `<div class="room-hub__panel room-hub__panel--embed">${this._renderHubEmbedHosts(config.lights, "light")}</div>`;
  }

  _renderHubFanPanel(config) {
    return `<div class="room-hub__panel room-hub__panel--embed">${this._renderHubEmbedHosts(config.fans, "fan")}</div>`;
  }

  _renderHubHumidifierPanel(config) {
    return `<div class="room-hub__panel room-hub__panel--embed">${this._renderHubEmbedHosts(config.humidifiers, "humidifier")}</div>`;
  }

  _renderHubOthersPanel(config) {
    return `<div class="room-hub__panel room-hub__panel--embed">${this._renderHubEmbedHosts(config.others, "entity")}</div>`;
  }

  _renderHubCoverPanel(config) {
    return `<div class="room-hub__panel room-hub__panel--covers">
      <div class="room-hub__device-list">${(config.covers || []).map(entityId => {
    const state = getState(this._hass, entityId);
    const position = finiteNumber(state?.attributes?.current_position);
    const open = state && stateIsOpen(state);
    const label = this._entityLabel(entityId);
    return `<article class="room-hub__device-row ${open ? "is-on" : ""}">
      <button type="button" class="room-hub__device-icon" data-room-action="toggle:${escapeHtml(entityId)}" aria-label="${escapeHtml(`${open ? this._t("closeCovers", "Close covers") : this._t("openCovers", "Open covers")}: ${label}`)}">
        <ha-icon icon="${escapeHtml(this._entityIcon(entityId, "mdi:window-shutter"))}"></ha-icon>
      </button>
      <div class="room-hub__device-body">
        <div class="room-hub__device-name">${escapeHtml(label)}</div>
        <div class="room-hub__device-state">${escapeHtml(position !== null ? `${position}%` : String(state?.state || "—"))}</div>
        <div class="room-hub__device-controls">
          <button type="button" class="room-hub__mini-control" data-room-action="cover:open_cover:${escapeHtml(entityId)}" aria-label="${escapeHtml(`${this._t("openCovers", "Open covers")}: ${label}`)}"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
          <button type="button" class="room-hub__mini-control" data-room-action="cover:stop_cover:${escapeHtml(entityId)}" aria-label="${escapeHtml(`${this._t("stopCovers", "Stop covers")}: ${label}`)}"><ha-icon icon="mdi:stop"></ha-icon></button>
          <button type="button" class="room-hub__mini-control" data-room-action="cover:close_cover:${escapeHtml(entityId)}" aria-label="${escapeHtml(`${this._t("closeCovers", "Close covers")}: ${label}`)}"><ha-icon icon="mdi:arrow-down"></ha-icon></button>
        </div>
      </div>
    </article>`;
  }).join("")}</div>
    </div>`;
  }

  _renderHubClimatePanel(config) {
    if (!config.climate) return "";
    return `<div class="room-hub__panel room-hub__panel--embed">${this._renderHubEmbedHosts([config.climate], "climate")}</div>`;
  }

  _renderHubVacuumPanel(config) {
    return `<div class="room-hub__panel room-hub__panel--embed">${this._renderHubEmbedHosts(config.vacuums, "vacuum")}</div>`;
  }

  _renderHubMediaPanel(config) {
    const ids = hubMediaPlayerIds(config);
    if (!ids.length) return "";
    return `<div class="room-hub__panel room-hub__panel--embed"><div class="room-hub__embed-list">
      <div class="room-hub__embed-host" data-hub-embed="media" data-hub-slot="group" data-hub-media="group" data-entity="${escapeHtml(ids[0])}"></div>
    </div></div>`;
  }

  _renderHubCameraPanel(config) {
    if (!config.camera) return "";
    return `<div class="room-hub__panel room-hub__panel--embed">${this._renderHubEmbedHosts([config.camera], "camera", "live")}</div>`;
  }

  _renderHubSecurityPanel(config) {
    const alarmIds = hubAlarmEntityIds(config);
    const sensorIds = hubSecurityEntityIds(config);
    return `<div class="room-hub__panel room-hub__panel--embed">
      ${alarmIds.length ? this._renderHubEmbedHosts(alarmIds, "alarm") : ""}
      ${sensorIds.length ? this._renderHubEmbedHosts(sensorIds, "entity") : ""}
    </div>`;
  }

  _renderHubPanelContent(panel, config, summary, styles, accentColor) {
    if (panel === "lights") return this._renderHubLightPanel(config);
    if (panel === "covers") return this._renderHubCoverPanel(config);
    if (panel === "climate") return this._renderHubClimatePanel(config);
    if (panel === "vacuum") return this._renderHubVacuumPanel(config);
    if (panel === "fans") return this._renderHubFanPanel(config);
    if (panel === "humidifiers") return this._renderHubHumidifierPanel(config);
    if (panel === "media") return this._renderHubMediaPanel(config);
    if (panel === "camera") return this._renderHubCameraPanel(config);
    if (panel === "security") return this._renderHubSecurityPanel(config);
    if (panel === "others") return this._renderHubOthersPanel(config);
    return this._renderHubHome(config, summary, styles, accentColor);
  }

  _renderHub() {
    const config = normalizeConfig(this._config || {});
    const summary = buildRoomSummary(this._hass, config);
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const hubStyles = styles.hub || DEFAULT_CONFIG.styles.hub;
    const accentColor = escapeHtml(styles.accent || "var(--primary-color)");
    const hubMetricFont = escapeHtml(hubStyles.metric_chip_font_size || DEFAULT_CONFIG.styles.hub.metric_chip_font_size);
    const hubMetricHeight = escapeHtml(hubStyles.metric_chip_height || DEFAULT_CONFIG.styles.hub.metric_chip_height);
    const hubMetricPadding = escapeHtml(hubStyles.metric_chip_padding || DEFAULT_CONFIG.styles.hub.metric_chip_padding);
    const hubMetricIcon = escapeHtml(hubStyles.metric_chip_icon_size || DEFAULT_CONFIG.styles.hub.metric_chip_icon_size);
    const hubActionSize = escapeHtml(hubStyles.context_action_size || DEFAULT_CONFIG.styles.hub.context_action_size);
    const hubActionIcon = escapeHtml(hubStyles.context_action_icon_size || DEFAULT_CONFIG.styles.hub.context_action_icon_size);
    const hubDeviceName = escapeHtml(hubStyles.device_name_size || DEFAULT_CONFIG.styles.hub.device_name_size);
    const hubDeviceState = escapeHtml(hubStyles.device_state_size || DEFAULT_CONFIG.styles.hub.device_state_size);
    const collapsible = config.collapsible === true;
    const collapsed = collapsible && this._hubExpanded !== true;
    const activePanel = collapsed ? "home" : HUB_PANELS.has(this._activePanel) ? this._activePanel : "home";
    const navItems = this._getHubNavItems(config, summary);
    // Only the visible panel belongs in the DOM. Embedded cards are relatively
    // expensive and must not receive hass updates while their panel is hidden.
    const renderedPanels = [activePanel];
    const animate = config.animations?.enabled !== false && this._animateContentOnNextRender;
    const cardBackground = styles.card.background;
    const cardBorder = styles.card.border;
    const cardShadow = styles.card.box_shadow;
    const embedOffTint = escapeHtml(styles.embed_off_tint || DEFAULT_CONFIG.styles.embed_off_tint);
    const existingShell = this.shadowRoot.querySelector("ha-card.room-summary-card--hub");
    if (existingShell && this._hubShellConfigSignature === this._configSignature) {
      this._parkHubEmbeddedCards();
      const body = this.shadowRoot.querySelector(".room-hub__body");
      if (body) {
        body.classList.toggle("room-hub__body--enter", Boolean(animate));
        body.innerHTML = renderedPanels.map(panel => this._hubViewMarkup(panel, config, summary, styles, styles.accent || "var(--primary-color)", collapsed)).join("");
      }
      this._syncHubChrome(config, summary, styles, collapsed, activePanel);
      this._animateContentOnNextRender = false;
      this._mountHubEmbeddedCards();
      return;
    }
    this._parkHubEmbeddedCards();
    this._hubShellConfigSignature = this._configSignature;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; --room-hub-duration:${config.animations?.enabled ? config.animations.content_duration : 0}ms; }
        * { box-sizing:border-box; }
        ha-card.room-summary-card--hub {
          overflow: visible;
        }
        ha-card {
          background:${cardBackground};
          border:${cardBorder};
          border-radius:${styles.card.border_radius};
          box-shadow:${cardShadow};
          color:var(--primary-text-color);
          display:block;
          isolation:isolate;
          overflow:hidden;
          position:relative;
          transition:background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        ha-card::before {
          background:linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0));
          border-radius:inherit; content:""; inset:0; pointer-events:none; position:absolute; z-index:0;
        }
        ha-card::after {
          background:radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, transparent) 0%, transparent 66%);
          border-radius:inherit; content:""; inset:0; opacity:0; pointer-events:none; position:absolute; z-index:0;
        }
        .room-hub { align-items:start; display:grid; gap:12px; grid-template-columns:minmax(0,1fr) auto; min-height:${collapsed ? "0" : "220px"}; overflow:visible; padding:${styles.card.padding}; position:relative; z-index:1; }
        .room-hub__stage { align-content:start; display:grid; gap:12px; grid-template-rows:auto auto; min-width:0; overflow:visible; }
        .room-hub__body { align-self:start; min-width:0; overflow:visible; }
        .room-hub__body--enter { animation:room-hub-slide calc(var(--room-hub-duration) * 0.9) cubic-bezier(.22,.84,.26,1) both; }
        .room-hub__view { align-content:start; display:grid; min-width:0; overflow:visible; }
        .room-hub__view[hidden] { display:none !important; }
        .room-hub__rail { align-items:center; display:flex; flex-direction:column; gap:8px; justify-content:flex-start; }
        .room-hub__bubble {
          align-items:center; appearance:none; background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); border-radius:999px;
          box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0,0,0,0.14);
          color:var(--primary-text-color); cursor:pointer; display:inline-flex; height:42px; justify-content:center; padding:0; width:42px;
          transition:transform 150ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        .room-hub__bubble--large { height:72px; width:72px; }
        .room-hub__bubble--active, .room-hub__device-row.is-on .room-hub__device-icon {
          background:color-mix(in srgb, ${accentColor} 20%, transparent);
          border-color:color-mix(in srgb, ${accentColor} 28%, transparent);
          color:${accentColor};
        }
        .room-hub__bubble ha-icon, .room-hub__device-icon ha-icon { --mdc-icon-size:20px; }
        .room-hub__bubble--large ha-icon { --mdc-icon-size:34px; }
        .room-hub__bubble:active, .room-hub__mini-control:active, .room-hub__room-icon:active, .room-hub__device-icon:active { transform:scale(0.96); }
        .room-hub__home { display:grid; gap:12px; }
        .room-hub__home--image {
          background:center/cover no-repeat var(--room-hub-bg-image); border-radius:22px; isolation:isolate; overflow:hidden;
          padding:12px; position:relative;
        }
        .room-hub__home--image::before {
          background:linear-gradient(135deg, color-mix(in srgb, var(--ha-card-background) 72%, transparent), color-mix(in srgb, var(--ha-card-background) 90%, transparent));
          border-radius:inherit; content:""; inset:0; pointer-events:none; position:absolute; z-index:0;
        }
        .room-hub__header, .room-hub__context-actions, .room-hub__device-list, .room-hub__embed-list { position:relative; z-index:1; }
        .room-hub__header { align-items:flex-start; display:grid; gap:12px; grid-template-columns:auto minmax(0,1fr); }
        .room-hub__header--with-toggle { grid-template-columns:auto minmax(0,1fr) auto; }
        .room-hub__header--collapsed { grid-template-columns:auto minmax(0,1fr) auto; }
        .room-hub__room-icon {
          align-items:center; appearance:none; background:color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 10%, transparent); border-radius:999px; color:var(--primary-text-color);
          cursor:pointer; display:inline-flex; height:52px; justify-content:center; width:52px;
          box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0,0,0,0.12);
        }
        .room-hub__room-icon ha-icon { --mdc-icon-size:28px; }
        .room-hub__header--collapsed .room-hub__room-icon { height:42px; width:42px; }
        .room-hub__header--collapsed .room-hub__room-icon ha-icon { --mdc-icon-size:22px; }
        .room-hub__expand-toggle {
          align-items:center; appearance:none; background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent); border-radius:999px; color:var(--primary-text-color);
          cursor:pointer; display:inline-flex; height:36px; justify-content:center; padding:0; width:36px;
          transition:transform 150ms ease, background 180ms ease, border-color 180ms ease;
        }
        .room-hub__expand-toggle ha-icon { --mdc-icon-size:20px; }
        .room-hub__expand-toggle:active { transform:scale(0.96); }
        .room-hub__room-copy { align-content:start; display:grid; gap:8px; min-width:0; padding-top:2px; width:100%; }
        .room-hub__room-title { font-size:${styles.title_size}; font-weight:700; line-height:1.2; min-width:0; overflow-wrap:anywhere; width:100%; }
        .room-hub__status-chips { align-items:center; display:flex; flex-wrap:wrap; gap:4px; justify-content:flex-start; min-width:0; width:100%; }
        .room-hub__metric-bubble {
          align-items:center; appearance:none; border:1px solid transparent; border-radius:999px;
          box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 7%, transparent), 0 8px 18px rgba(0,0,0,0.13); cursor:pointer;
          display:inline-flex; font:inherit; font-size:${hubMetricFont}; font-weight:700; gap:4px; line-height:1; min-height:${hubMetricHeight}; padding:${hubMetricPadding};
          transition:transform 150ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        .room-hub__metric-bubble ha-icon { --mdc-icon-size:${hubMetricIcon}; flex:0 0 auto; }
        .room-hub__metric-bubble--icon-only { justify-content:center; min-width:${hubMetricHeight}; padding:0; width:${hubMetricHeight}; }
        .room-hub__metric-bubble:active { transform:scale(0.97); }
        .room-hub__metric-bubble--temperature {
          background:color-mix(in srgb, var(--warning-color, #f6b73c) 18%, var(--ha-card-background));
          border-color:color-mix(in srgb, var(--warning-color, #f6b73c) 28%, transparent);
          color:color-mix(in srgb, var(--warning-color, #f6b73c) 88%, var(--primary-text-color));
        }
        .room-hub__metric-bubble--humidity {
          background:color-mix(in srgb, #5aa7ff 18%, var(--ha-card-background));
          border-color:color-mix(in srgb, #5aa7ff 28%, transparent);
          color:color-mix(in srgb, #5aa7ff 88%, var(--primary-text-color));
        }
        .room-hub__metric-bubble--presence-occupied {
          background:color-mix(in srgb, var(--success-color, #4caf50) 18%, var(--ha-card-background));
          border-color:color-mix(in srgb, var(--success-color, #4caf50) 28%, transparent);
          color:color-mix(in srgb, var(--success-color, #4caf50) 88%, var(--primary-text-color));
        }
        .room-hub__metric-bubble--presence-vacant {
          background:color-mix(in srgb, var(--primary-text-color) 8%, var(--ha-card-background));
          border-color:color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          color:var(--secondary-text-color);
        }
        .room-hub__metric-bubble--power {
          background:color-mix(in srgb, var(--warning-color, #f6b73c) 16%, var(--ha-card-background));
          border-color:color-mix(in srgb, var(--warning-color, #f6b73c) 24%, transparent);
          color:color-mix(in srgb, var(--warning-color, #f6b73c) 86%, var(--primary-text-color));
        }
        .room-hub__metric-bubble--air {
          background:color-mix(in srgb, #7c9cff 16%, var(--ha-card-background));
          border-color:color-mix(in srgb, #7c9cff 24%, transparent);
          color:color-mix(in srgb, #7c9cff 86%, var(--primary-text-color));
        }
        .room-hub__metric-bubble--camera {
          background:color-mix(in srgb, var(--primary-text-color) 8%, var(--ha-card-background));
          border-color:color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          color:var(--primary-text-color);
        }
        .room-hub__metric-bubble--camera-offline,
        .room-hub__metric-bubble--security {
          background:color-mix(in srgb, var(--warning-color,#f59e0b) 16%, var(--ha-card-background));
          border-color:color-mix(in srgb, var(--warning-color,#f59e0b) 26%, transparent);
          color:var(--warning-color,#f59e0b);
        }
        .room-hub__context-actions { display:flex; flex-wrap:wrap; gap:8px; }
        .room-hub__context-actions[hidden] { display:none; }
        .room-hub__context-action {
          align-items:center; appearance:none; background:color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); border-radius:999px; color:var(--primary-text-color);
          box-shadow:inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0,0,0,0.14);
          cursor:pointer; display:inline-flex; font:inherit; height:${hubActionSize}; justify-content:center; padding:0; width:${hubActionSize};
          transition:transform 150ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        .room-hub__context-action ha-icon { --mdc-icon-size:${hubActionIcon}; }
        .room-hub__context-action:active { transform:scale(0.96); }
        .room-hub__context-action--active {
          background:color-mix(in srgb, ${accentColor} 20%, transparent);
          border-color:color-mix(in srgb, ${accentColor} 28%, transparent);
          color:${accentColor};
        }
        .room-hub__context-action--warn { border-color:color-mix(in srgb, var(--warning-color,#f59e0b) 24%, transparent); color:var(--warning-color,#f59e0b); }
        .room-hub__device-list { display:grid; gap:10px; }
        .room-hub__device-row {
          align-items:center; background:var(--ha-card-background); border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius:28px; box-shadow:var(--ha-card-box-shadow); display:grid; gap:12px; grid-template-columns:auto minmax(0,1fr);
          min-height:72px; padding:12px 14px;
        }
        .room-hub__device-row.is-on {
          background:linear-gradient(135deg, color-mix(in srgb, ${accentColor} 16%, var(--ha-card-background)) 0%, var(--ha-card-background) 72%);
          border-color:color-mix(in srgb, ${accentColor} 24%, var(--divider-color));
        }
        .room-hub__device-icon {
          align-items:center; appearance:none; background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); border-radius:999px; color:var(--primary-text-color);
          cursor:pointer; display:inline-flex; height:46px; justify-content:center; width:46px;
        }
        .room-hub__device-body { display:grid; gap:8px; min-width:0; }
        .room-hub__embed-list { align-content:start; display:grid; gap:10px; overflow:visible; }
        .room-hub__panel { align-content:start; display:grid; }
        .room-hub__panel--embed { overflow:visible; }
        .room-hub__embed-host { display:block; min-width:0; overflow:visible; width:100%; }
        .room-hub__embed-host--media { margin-top:8px; }
        .room-hub__embed-host--camera { margin-top:8px; }
        .room-hub__embed-host > nodalia-light-card,
        .room-hub__embed-host > nodalia-vacuum-card,
        .room-hub__embed-host > nodalia-fan-card,
        .room-hub__embed-host > nodalia-humidifier-card,
        .room-hub__embed-host > nodalia-entity-card,
        .room-hub__embed-host > nodalia-climate-card,
        .room-hub__embed-host > nodalia-alarm-panel-card,
        .room-hub__embed-host > nodalia-camera-card,
        .room-hub__embed-host > nodalia-media-player { display:block; max-width:100%; overflow:visible; width:100%; }
        .room-hub__embed-host > nodalia-light-card .light-card.is-off,
        .room-hub__embed-host > nodalia-fan-card .fan-card.is-off,
        .room-hub__embed-host > nodalia-humidifier-card .humidifier-card.is-off,
        .room-hub__embed-host > nodalia-entity-card .entity-card.is-off {
          background: ${embedOffTint};
          border-color: color-mix(in srgb, ${embedOffTint} 55%, var(--divider-color));
          box-shadow: none;
        }
        .room-hub__device-name { font-size:${hubDeviceName}; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .room-hub__device-state { color:var(--secondary-text-color); font-size:${hubDeviceState}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .room-hub__device-controls { align-items:center; display:flex; flex-wrap:wrap; gap:6px; }
        .room-hub__mini-control {
          align-items:center; appearance:none; background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); border-radius:999px; color:var(--primary-text-color);
          cursor:pointer; display:inline-flex; height:34px; justify-content:center; width:34px;
        }
        .room-hub__mini-control--primary { background:color-mix(in srgb, ${accentColor} 18%, transparent); border-color:color-mix(in srgb, ${accentColor} 24%, transparent); color:${accentColor}; height:40px; width:40px; }
        @keyframes room-hub-slide { from { opacity:0.94; transform:translateX(-4px); } to { opacity:1; transform:translateX(0); } }
        @media (max-width:420px) { .room-hub { grid-template-columns:minmax(0,1fr) auto; } .room-hub__bubble { height:38px; width:38px; } }
        @media (prefers-reduced-motion:reduce) { .room-hub__body--enter { animation:none; } }
      </style>
      <ha-card class="room-summary-card room-summary-card--hub">
        <div class="room-hub">
          <div class="room-hub__stage">
            ${this._renderHubHeader(config, summary, styles, collapsed)}
            <div class="room-hub__body ${animate ? "room-hub__body--enter" : ""}">
              ${renderedPanels.map(panel => `
                <section class="room-hub__view" data-hub-panel="${escapeHtml(panel)}" aria-hidden="${panel !== activePanel}"${panel === activePanel ? "" : " hidden"}>
                  ${panel === "home"
    ? this._renderHubHome(config, summary, styles, accentColor, collapsed)
    : this._renderHubPanelContent(panel, config, summary, styles, accentColor)}
                </section>`).join("")}
            </div>
          </div>
          ${!collapsed && navItems.length ? this._renderHubRail(navItems, activePanel) : ""}
        </div>
      </ha-card>`;
    this._animateContentOnNextRender = false;
    this._mountHubEmbeddedCards();
  }

  _renderEmpty() {
    return `<ha-card class="room-summary-card room-summary-card--empty">
      <div class="room-summary-card__empty-title">${escapeHtml(this._t("emptyTitle", "Nodalia Room Summary Card"))}</div>
      <div class="room-summary-card__empty-text">${escapeHtml(this._t("emptyBody", "Set a room name and connect room entities."))}</div>
    </ha-card>`;
  }

  _render() {
    if (!this.shadowRoot) return;
    const config = normalizeConfig(this._config || {});
    if (!hasRoomContent(config)) {
      this.shadowRoot.innerHTML = window.NodaliaUtils?.renderCardEmptyStateDocument?.(this._renderEmpty(), { card: config.styles?.card }) ?? this._renderEmpty();
      return;
    }
    this._renderHub();
    return;
  }
}
  _lazyNodaliaRoomSummaryCard = NodaliaRoomSummaryCard;
  return NodaliaRoomSummaryCard;
}
