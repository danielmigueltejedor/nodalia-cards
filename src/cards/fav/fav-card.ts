// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  COVER_SET_POSITION,
  EDITOR_TAG,
  FEATURE_ARM_AWAY,
  FEATURE_ARM_CUSTOM_BYPASS,
  FEATURE_ARM_HOME,
  FEATURE_ARM_NIGHT,
  FEATURE_ARM_VACATION,
  HAPTIC_PATTERNS,
  INLINE_LAYOUT_THRESHOLD,
  LOCK_LOCK,
  MINI_LAYOUT_THRESHOLD,
} from "./fav-constants";
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
} from "./fav-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./fav-config";
import {
  applyStubEntity,
  coverEntityIsOpen,
  entitySupportedFeatures,
  entitySupportsFeature,
  getDynamicEntityIcon,
  getEntityDomain,
  isUnavailableState,
  miredToKelvin,
  parseNumericValue,
  parseSizeToPixels,
  resolveFavBubbleIconGlyphColor,
  shouldDarkenFavBubbleIconGlyph,
} from "./fav-helpers";

let _lazyNodaliaFavCard;
export function loadNodaliaFavCard() {
  if (_lazyNodaliaFavCard) {
    return _lazyNodaliaFavCard;
  }
class NodaliaFavCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["light", "switch"], entities, entitiesFallback);
  }

  static getEntitySuggestion(hass, entityId) {
    return window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, {
      domains: ["light", "switch"],
    });
  }

  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._cardWidth = 0;
    this._layout = "inline";
    this._alarmMenuOpen = false;
    this._alarmCodeInput = "";
    this._ignoreNextPrimaryClickUntil = 0;
    this._lastAlarmPanelRenderedOpen = null;
    this._lastRenderSignature = "";
    this._resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextWidth = Math.round(entry.contentRect?.width || this.clientWidth || 0);
      const nextLayout = this._getResolvedLayout(nextWidth);

      if (nextWidth === this._cardWidth && nextLayout === this._layout) {
        return;
      }

      this._cardWidth = nextWidth;
      this._layout = nextLayout;

      const signature = this._getRenderSignature();
      if (signature === this._lastRenderSignature) {
        return;
      }

      this._lastRenderSignature = signature;
      this._render();
    });
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowInput = this._onShadowInput.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    }

  connectedCallback() {
    this._resizeObserver?.observe(this);
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    this._alarmMenuOpen = false;
    this._applyHostGridSpan(false);
    window.NodaliaUtils?.clearDeferTimers?.(this);
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._layout = this._getResolvedLayout(Math.round(this._cardWidth || this.clientWidth || 0));
    this._lastRenderSignature = "";
    this._render();
  }

  set hass(hass) {
    const nextSignature = this._getRenderSignature(hass);
    this._hass = hass;

    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }

    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    if (this._alarmMenuOpen && this._isAlarmPanelMode(this._getState())) {
      return this._getAlarmGridSpan();
    }

    return 1;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 1,
      min_columns: 1,
    };
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const helperEntityId = this._config?.alarm_code_entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const helperState = helperEntityId ? hass?.states?.[helperEntityId] || null : null;
    const attrs = state?.attributes || {};
    const joinParts = window.NodaliaRenderSignature?.joinParts;
    const values = [
      entityId,
      state?.state || "",
      attrs.friendly_name || "",
      attrs.icon || "",
      attrs.device_class || "",
      attrs.unit_of_measurement || attrs.native_unit_of_measurement || "",
      helperEntityId,
      helperState?.state || "",
      this._layout || "",
      this._alarmMenuOpen === true,
      String(this._config?.tap_action || ""),
      String(this._config?.tap_service || ""),
      String(this._config?.tap_url || ""),
      this._config?.security?.strict_service_actions === true ? 1 : 0,
      Array.isArray(this._config?.security?.allowed_services)
        ? this._config.security.allowed_services.join(",")
        : "",
      this._config?.show_name !== false ? 1 : 0,
      this._config?.show_state !== false ? 1 : 0,
      String(this._config?.state_attribute || ""),
      String(this._config?.name || ""),
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "fav:", values }]);
    }
    return values.join("::");
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) ? numericColumns : null;
  }

  _getConfiguredGridRows() {
    const numericRows = Number(this._config?.grid_options?.rows);
    return Number.isFinite(numericRows) ? numericRows : null;
  }

  _getResolvedLayout(width) {
    const mode = this._config?.layout_mode || "auto";

    if (mode === "mini") {
      return "mini";
    }

    if (mode === "inline") {
      return "inline";
    }

    const columns = this._getConfiguredGridColumns();
    const rows = this._getConfiguredGridRows();

    if (columns !== null) {
      if (columns <= 2) {
        return "mini";
      }

      if (columns <= 6 || rows === 1) {
        return "inline";
      }
    }

    if (width > 0 && width <= MINI_LAYOUT_THRESHOLD) {
      return "mini";
    }

    if (width > 0 && width <= INLINE_LAYOUT_THRESHOLD) {
      return "inline";
    }

    return "inline";
  }

  _getState() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _getDomain(entityId = this._config?.entity) {
    return String(entityId || "").split(".")[0] || "";
  }

  _isAlarmPanelMode(state = this._getState()) {
    const mode = normalizeTextKey(this._config?.entity_mode || "auto");

    if (mode === "alarm_control_panel") {
      return true;
    }

    if (mode === "standard") {
      return false;
    }

    return this._getDomain(state?.entity_id || this._config?.entity) === "alarm_control_panel";
  }

  _isBinaryOnOff(state) {
    const stateKey = normalizeTextKey(state?.state);
    return stateKey === "on" || stateKey === "off";
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

  _canToggleEntity(state) {
    return this._isBinaryOnOff(state) || this._isHomeAssistantToggleable(state);
  }

  _usesDomainToggleService(state = this._getState()) {
    const domain = this._getDomain(state?.entity_id);
    return domain === "cover" || domain === "lock";
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

  _toggleEntity(entityId = this._config?.entity) {
    const state = this._hass?.states?.[entityId];
    if (!this._hass || !entityId || !state) {
      return;
    }

    if (this._isBinaryOnOff(state)) {
      const service = normalizeTextKey(state.state) === "on" ? "turn_off" : "turn_on";
      this._invokeEntityService("homeassistant", service, entityId);
      return;
    }

    const domain = this._getDomain(entityId);
    if (domain === "cover") {
      this._toggleCoverEntity(state, entityId);
      return;
    }

    if (domain === "lock") {
      this._toggleLockEntity(state, entityId);
      return;
    }

    if (!this._isHomeAssistantToggleable(state)) {
      return;
    }

    this._invokeEntityService("homeassistant", "toggle", entityId);
  }

  _isActiveState(state) {
    const stateKey = normalizeTextKey(state?.state);

    if (!stateKey || ["off", "closed", "locked", "unavailable", "unknown", "none", "idle", "standby", "disarmed"].includes(stateKey)) {
      return false;
    }

    return true;
  }

  _isDomainOn(state) {
    const stateKey = normalizeTextKey(state?.state);
    const domain = this._getDomain();

    switch (domain) {
      case "light":
      case "fan":
      case "humidifier":
        return stateKey === "on";
      default:
        return this._isActiveState(state);
    }
  }

  _usesCustomOnColor() {
    const configuredColor = this._config?.styles?.icon?.on_color;
    return Boolean(configuredColor) && configuredColor !== DEFAULT_CONFIG.styles.icon.on_color;
  }

  _usesCustomOffColor() {
    const configuredColor = this._config?.styles?.icon?.off_color;
    return Boolean(configuredColor) && configuredColor !== DEFAULT_CONFIG.styles.icon.off_color;
  }

  _getLightAccentColor(state) {
    const rgbColor = Array.isArray(state?.attributes?.rgb_color) ? state.attributes.rgb_color : null;
    if (this._isActiveState(state) && rgbColor?.length === 3) {
      return `rgb(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]})`;
    }

    if (this._isActiveState(state)) {
      const kelvin = typeof state?.attributes?.color_temp_kelvin === "number"
        ? Math.round(state.attributes.color_temp_kelvin)
        : (typeof state?.attributes?.color_temp === "number" ? miredToKelvin(state.attributes.color_temp) : 0);

      if (kelvin >= 5200) {
        return "#8fd3ff";
      }

      if (kelvin > 0 && kelvin <= 3000) {
        return "#f4b55f";
      }

      if (kelvin > 0) {
        return "#ffe29a";
      }
    }

    return "var(--warning-color, #f6b73c)";
  }

  _getDomainDefaultOnColor(state) {
    switch (this._getDomain()) {
      case "light":
        return this._getLightAccentColor(state);
      case "fan":
        return "var(--info-color, #71c0ff)";
      case "humidifier":
        return "var(--info-color, #71c0ff)";
      case "alarm_control_panel":
        return this._getAlarmAccentColor(state);
      case "switch":
        return "var(--primary-color)";
      case "media_player":
        return "var(--info-color, #71c0ff)";
      case "vacuum":
        return "#82d18a";
      default:
        return DEFAULT_CONFIG.styles.icon.on_color;
    }
  }

  _getAccentColor(state) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    if (!this._isDomainOn(state)) {
      return this._usesCustomOffColor()
        ? styles?.icon?.off_color || DEFAULT_CONFIG.styles.icon.off_color
        : "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))";
    }

    if (this._usesCustomOnColor()) {
      return styles?.icon?.on_color || DEFAULT_CONFIG.styles.icon.on_color;
    }

    return this._getDomainDefaultOnColor(state);
  }

  _getAlarmAccentColor(state) {
    const key = normalizeTextKey(state?.state);

    switch (key) {
      case "armed_home":
        return "#74c0ff";
      case "armed_away":
        return "#8aa7ff";
      case "armed_night":
        return "#9488ff";
      case "armed_vacation":
        return "#5fd7cf";
      case "armed_custom_bypass":
        return "#64d4a6";
      case "arming":
        return "#71c0ff";
      case "pending":
        return "#f2c46d";
      case "triggered":
        return "#ff7474";
      default:
        return "var(--info-color, #71c0ff)";
    }
  }

  _translateStateValue(state) {
    if (!state) {
      return null;
    }

    const rawState = String(state.state ?? "").trim();
    const unit = String(state.attributes?.unit_of_measurement || "").trim();
    const key = normalizeTextKey(rawState);

    if (rawState && unit && /^-?\d+([.,]\d+)?$/.test(rawState)) {
      return `${rawState} ${unit}`;
    }

    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const langCfg = this._config?.language ?? "auto";
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, langCfg) ?? "en";
    if (window.NodaliaI18n?.translateFavState) {
      const translated = window.NodaliaI18n.translateFavState(lang, key);
      if (translated) {
        return translated;
      }
    }

    if (window.NodaliaI18n?.translateEntityStateChip) {
      const chip = window.NodaliaI18n.translateEntityStateChip(hass, langCfg, key);
      if (chip) {
        return chip;
      }
    }

    return rawState || null;
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

    if (typeof value === "boolean") {
      const lang = window.NodaliaI18n?.resolveLanguage?.(this._hass, this._config?.language ?? "auto") || "en";
      const pack = window.NodaliaI18n?.strings?.(lang) || window.NodaliaI18n?.strings?.("en") || {};
      return value ? (pack.boolean?.yes || "Yes") : (pack.boolean?.no || "No");
    }

    if (typeof value === "number") {
      if (["battery", "battery_level", "humidity", "current_humidity"].includes(key)) {
        return `${Math.round(value)}%`;
      }

      if (key === "brightness") {
        return `${Math.round((value / 255) * 100)}%`;
      }

      if (key === "volume_level") {
        return `${Math.round(value * 100)}%`;
      }
    }

    return String(value);
  }

  _getTitle(state) {
    return this._config?.name || state?.attributes?.friendly_name || this._config?.entity || "Favorito";
  }

  _getIcon(state) {
    const configuredIcon = String(this._config?.icon || "").trim();
    if (configuredIcon) {
      return configuredIcon;
    }

    if (this._config?.use_entity_icon === true) {
      const resolvedEntityIcon = String(state?.attributes?.icon || "").trim() || getDynamicEntityIcon(state);
      if (resolvedEntityIcon) {
        return resolvedEntityIcon;
      }
    }

    return String(state?.attributes?.icon || "").trim() || "mdi:star-four-points";
  }

  _canRunTapAction(state) {
    if (this._isAlarmPanelMode(state)) {
      return Boolean(this._config?.entity);
    }

    const tapAction = this._config?.tap_action || "auto";

    if (tapAction === "none") {
      return false;
    }

    if (tapAction === "service") {
      return Boolean(this._config?.tap_service);
    }

    if (tapAction === "url") {
      return Boolean(this._config?.tap_url);
    }

    if (tapAction === "toggle") {
      return this._canToggleEntity(state);
    }

    if (tapAction === "more-info") {
      return Boolean(this._config?.entity);
    }

    return Boolean(this._config?.entity);
  }

  _getAlarmSupportedFeatures(state) {
    const attrs = state?.attributes;
    if (!attrs || !Object.prototype.hasOwnProperty.call(attrs, "supported_features")) {
      return null;
    }
    const value = Number(attrs.supported_features);
    return Number.isFinite(value) ? value : 0;
  }

  _supportsAlarmMode(state, mode) {
    const features = this._getAlarmSupportedFeatures(state);

    if (features === null) {
      return true;
    }

    switch (mode) {
      case "home":
        return Boolean(features & FEATURE_ARM_HOME);
      case "away":
        return Boolean(features & FEATURE_ARM_AWAY);
      case "night":
        return Boolean(features & FEATURE_ARM_NIGHT);
      case "vacation":
        return Boolean(features & FEATURE_ARM_VACATION);
      case "custom_bypass":
        return Boolean(features & FEATURE_ARM_CUSTOM_BYPASS);
      default:
        return true;
    }
  }

  _getAlarmStateCandidates(state) {
    return [
      state?.state,
      state?.attributes?.next_state,
      state?.attributes?.post_pending_state,
      state?.attributes?.post_delay_state,
      state?.attributes?.arm_mode,
      state?.attributes?.arming_mode,
    ]
      .map(value => normalizeTextKey(value))
      .filter(Boolean);
  }

  _getAlarmCurrentModeKey(state) {
    switch (normalizeTextKey(state?.state)) {
      case "disarmed":
        return "disarm";
      case "armed_home":
        return "home";
      case "armed_away":
        return "away";
      case "armed_night":
        return "night";
      case "armed_vacation":
        return "vacation";
      case "armed_custom_bypass":
        return "custom_bypass";
      default:
        return "";
    }
  }

  _getAlarmActionLabel(modeKey) {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const actions = window.NodaliaI18n?.strings?.(lang)?.alarmPanel?.actions;
    const map = {
      disarm: "disarm",
      home: "arm_home",
      away: "arm_away",
      night: "arm_night",
      vacation: "arm_vacation",
      custom_bypass: "arm_custom_bypass",
    };
    const actionKey = map[modeKey];
    if (actionKey && actions?.[actionKey]) {
      return actions[actionKey];
    }
    const enActions = window.NodaliaI18n?.strings?.("en")?.alarmPanel?.actions || {};
    if (actionKey && enActions?.[actionKey]) {
      return enActions[actionKey];
    }
    return modeKey;
  }

  _matchesAlarmMode(state, ...keys) {
    const candidates = this._getAlarmStateCandidates(state);
    return keys.some(key => candidates.includes(normalizeTextKey(key)));
  }

  _getAlarmModeDefinitions(state) {
    const currentModeKey = this._getAlarmCurrentModeKey(state);
    const modes = [
      {
        key: "disarm",
        label: this._getAlarmActionLabel("disarm"),
        icon: "mdi:shield-off-outline",
        service: "alarm_disarm",
        enabled: this._config?.alarm_show_disarm !== false && currentModeKey !== "disarm",
      },
      {
        key: "home",
        label: this._getAlarmActionLabel("home"),
        icon: "mdi:home-lock",
        service: "alarm_arm_home",
        enabled: this._config?.alarm_show_arm_home !== false
          && this._supportsAlarmMode(state, "home")
          && currentModeKey !== "home",
      },
      {
        key: "away",
        label: this._getAlarmActionLabel("away"),
        icon: "mdi:shield-lock",
        service: "alarm_arm_away",
        enabled: this._config?.alarm_show_arm_away !== false
          && this._supportsAlarmMode(state, "away")
          && currentModeKey !== "away",
      },
      {
        key: "night",
        label: this._getAlarmActionLabel("night"),
        icon: "mdi:weather-night",
        service: "alarm_arm_night",
        enabled: this._config?.alarm_show_arm_night !== false
          && this._supportsAlarmMode(state, "night")
          && currentModeKey !== "night",
      },
      {
        key: "vacation",
        label: this._getAlarmActionLabel("vacation"),
        icon: "mdi:palm-tree",
        service: "alarm_arm_vacation",
        enabled: this._config?.alarm_show_arm_vacation === true
          && this._supportsAlarmMode(state, "vacation")
          && currentModeKey !== "vacation",
      },
      {
        key: "custom_bypass",
        label: this._getAlarmActionLabel("custom_bypass"),
        icon: "mdi:tune-variant",
        service: "alarm_arm_custom_bypass",
        enabled: this._config?.alarm_show_custom_bypass === true
          && this._supportsAlarmMode(state, "custom_bypass")
          && currentModeKey !== "custom_bypass",
      },
    ];

    return modes.filter(mode => mode.enabled);
  }

  _getAlarmRenderedModes(state) {
    const detectedModes = this._getAlarmModeDefinitions(state);
    if (detectedModes.length) {
      return detectedModes;
    }

    const currentModeKey = this._getAlarmCurrentModeKey(state);
    const fallbackModes = [
      {
        key: "disarm",
        label: this._getAlarmActionLabel("disarm"),
        icon: "mdi:shield-off-outline",
        service: "alarm_disarm",
        enabled: this._config?.alarm_show_disarm !== false && currentModeKey !== "disarm",
      },
      {
        key: "home",
        label: this._getAlarmActionLabel("home"),
        icon: "mdi:home-lock",
        service: "alarm_arm_home",
        enabled: this._config?.alarm_show_arm_home !== false
          && this._supportsAlarmMode(state, "home")
          && currentModeKey !== "home",
      },
      {
        key: "away",
        label: this._getAlarmActionLabel("away"),
        icon: "mdi:shield-lock",
        service: "alarm_arm_away",
        enabled: this._config?.alarm_show_arm_away !== false
          && this._supportsAlarmMode(state, "away")
          && currentModeKey !== "away",
      },
      {
        key: "night",
        label: this._getAlarmActionLabel("night"),
        icon: "mdi:weather-night",
        service: "alarm_arm_night",
        enabled: this._config?.alarm_show_arm_night !== false
          && this._supportsAlarmMode(state, "night")
          && currentModeKey !== "night",
      },
    ];

    return fallbackModes.filter(mode => mode.enabled);
  }

  _shouldShowAlarmCodeInput(state) {
    if (this._config?.alarm_show_code_input === false) {
      return false;
    }

    return Boolean(String(state?.attributes?.code_format || "").trim());
  }

  _getAlarmCodeValue(state) {
    const manualPin = String(this._alarmCodeInput || "").trim();
    if (manualPin) {
      return manualPin;
    }

    if (this._shouldShowAlarmCodeInput(state)) {
      return "";
    }

    const helperEntityId = String(this._config?.alarm_code_entity || "").trim();
    if (helperEntityId) {
      const helperState = this._hass?.states?.[helperEntityId];
      const helperValue = String(helperState?.state || "").trim();
      if (helperValue && !["unknown", "unavailable"].includes(normalizeTextKey(helperValue))) {
        return helperValue;
      }
    }

    const configuredCode = String(this._config?.alarm_code || "").trim();
    if (configuredCode) {
      return configuredCode;
    }

    return "";
  }

  _runAlarmAction(service) {
    const state = this._getState();
    if (!this._hass || !this._config?.entity || !service || !state) {
      return;
    }

    const payload = {
      entity_id: this._config.entity,
    };

    const requiresManualPin = this._shouldShowAlarmCodeInput(state);
    const manualPin = String(this._alarmCodeInput || "").trim();
    if (requiresManualPin && !manualPin) {
      this._triggerHaptic("warning");
      const input = this.shadowRoot?.querySelector?.('input[data-fav-alarm-ignore="true"]');
      if (input instanceof HTMLInputElement) {
        input.focus();
      }
      return;
    }

    const code = requiresManualPin ? manualPin : this._getAlarmCodeValue(state);
    if (code) {
      payload.code = code;
    }

    this._triggerHaptic();
    const invoke = window.NodaliaUtils?.invokeHomeAssistantService?.bind(window.NodaliaUtils)
      || ((host, hass, domain, service, data) => Promise.resolve(hass?.callService?.(domain, service, data)));
    invoke(this, this._hass, "alarm_control_panel", service, payload);
    this._alarmMenuOpen = false;
    this._applyHostGridSpan(false);
    this._render();
    this._notifyLayoutChange();
  }

  _openMoreInfo(entityId = this._config?.entity) {
    if (!entityId) {
      return;
    }

    fireEvent(this, "hass-more-info", {
      entityId,
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
      window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Fav Card", serviceValue);
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

  _notifyLayoutChange() {
    if (!this.isConnected) {
      return;
    }
    fireEvent(this, "iron-resize", {});

    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        if (!this.isConnected) {
          return;
        }
        window.dispatchEvent(new Event("resize"));
      });
    }
  }

  _getAlarmGridSpan() {
    const state = this._getState();
    const showCodeInput = this._shouldShowAlarmCodeInput(state);
    return showCodeInput ? 4 : 3;
  }

  _applyHostGridSpan(showAlarmPanel = false) {
    const hostCard = this.closest("hui-card");
    if (!(hostCard instanceof HTMLElement)) {
      return;
    }

    if (showAlarmPanel) {
      hostCard.setAttribute("data-fav-alarm-open", "true");
    } else {
      hostCard.removeAttribute("data-fav-alarm-open");
    }
  }

  _getPrimaryActionTarget(event) {
    const path = event.composedPath();
    const alarmInput = path.find(node => node instanceof HTMLElement && node.dataset?.favAlarmIgnore === "true");
    if (alarmInput) {
      return null;
    }

    const alarmButton = path.find(node => node instanceof HTMLButtonElement && node.dataset?.favAlarmAction);
    if (alarmButton) {
      return null;
    }

    const actionTarget = path.find(node => node instanceof HTMLElement && node.dataset?.favAction === "primary");
    return actionTarget || null;
  }

  _activatePrimaryFromEvent(event) {
    const actionTarget = this._getPrimaryActionTarget(event);
    if (!actionTarget) {
      return false;
    }

    const state = this._getState();
    if (!this._canRunTapAction(state)) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();
    this._performPrimaryAction(state);
    return true;
  }

  _performPrimaryAction(state) {
    if (this._isAlarmPanelMode(state)) {
      this._alarmMenuOpen = !this._alarmMenuOpen;
      this._applyHostGridSpan(this._alarmMenuOpen);
      this._render();
      this._notifyLayoutChange();
      return;
    }

    const tapAction = String(this._config?.tap_action || "auto").trim().toLowerCase();

    switch (tapAction) {
      case "toggle":
        this._toggleEntity(this._config?.entity);
        break;
      case "more-info":
        this._openMoreInfo(this._config?.entity);
        break;
      case "service":
        this._callConfiguredService(
          this._config?.tap_service,
          this._config?.entity,
          this._config?.tap_service_data,
          this._config?.tap_service_target,
        );
        break;
      case "url":
        this._openConfiguredUrl(this._config?.tap_url, this._config?.tap_new_tab);
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

  _onShadowClick(event) {
    if (Date.now() < this._ignoreNextPrimaryClickUntil) {
      const actionTarget = this._getPrimaryActionTarget(event);
      if (actionTarget) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }

    const alarmInput = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.favAlarmIgnore === "true");

    if (alarmInput) {
      return;
    }

    const alarmButton = event
      .composedPath()
      .find(node => node instanceof HTMLButtonElement && node.dataset?.favAlarmAction);

    if (alarmButton) {
      event.preventDefault();
      event.stopPropagation();
      this._runAlarmAction(alarmButton.dataset.favAlarmAction);
      return;
    }

    this._activatePrimaryFromEvent(event);
  }

  _onShadowInput(event) {
    const input = event
      .composedPath()
      .find(node => node instanceof HTMLInputElement && node.dataset?.favAlarmField === "alarm-code");

    if (!input) {
      return;
    }

    event.stopPropagation();
    this._alarmCodeInput = input.value;
  }

  _renderChip(label) {
    if (!label) {
      return "";
    }

    return `<div class="fav-card__chip">${escapeHtml(label)}</div>`;
  }

  _isSingleRowLayout() {
    return this._getConfiguredGridRows() === 1;
  }

  _favCardUi(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.favCard;
    const enPack = window.NodaliaI18n?.strings?.("en")?.favCard;
    const raw = pack?.[key] ?? enPack?.[key];
    return String(raw != null && raw !== "" ? raw : fallback);
  }

  _commonAria(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.common?.aria;
    const enPack = window.NodaliaI18n?.strings?.("en")?.common?.aria;
    return String(pack?.[key] ?? enPack?.[key] ?? fallback);
  }

  _renderEmptyState() {
    const title = escapeHtml(this._favCardUi("emptyTitle", "Nodalia Fav Card"));
    const body = escapeHtml(this._favCardUi("emptyBody", "Set `entity` to show the favorite."));
    return `
      <ha-card class="fav-card fav-card--empty">
        <div class="fav-card__empty-title">${title}</div>
        <div class="fav-card__empty-text">${body}</div>
      </ha-card>
    `;
  }

  _renderAlarmActionButton(mode, accentColor, state) {
    const iconColor = resolveFavBubbleIconGlyphColor(accentColor, state);
    return `
      <button
        type="button"
        class="fav-card__alarm-button"
        data-fav-alarm-action="${escapeHtml(mode.service)}"
        style="
          --fav-alarm-accent:${escapeHtml(accentColor)};
          --fav-alarm-glyph:${escapeHtml(iconColor)};
        "
        aria-label="${escapeHtml(mode.label)}"
      >
        <ha-icon icon="${escapeHtml(mode.icon)}"></ha-icon>
        <span>${escapeHtml(mode.label)}</span>
      </button>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || {};

    const entityGuard = window.NodaliaUtils?.renderLovelaceEntityGuardCardHtml?.(
      this._hass,
      config.entity,
      { cardClass: "fav-card" },
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
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const layout = this._layout || "inline";
    const isMini = layout === "mini";
    const configuredColumns = this._getConfiguredGridColumns();
    const configuredRows = this._getConfiguredGridRows();
    const isSingleRow = this._isSingleRowLayout();
    const usesCompactRowMetrics =
      isMini ||
      isSingleRow ||
      (configuredRows !== null && configuredRows <= 1) ||
      (configuredColumns !== null && configuredColumns <= 6);
    const isCompactInline = !isMini && usesCompactRowMetrics;
    const isTightInline = isCompactInline && (configuredColumns === null || configuredColumns >= 4);
    const singleRowHeightPx = usesCompactRowMetrics ? 68 : 0;
    const icon = this._getIcon(state);
    const title = this._getTitle(state);
    const accentColor = this._getAccentColor(state);
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const showUnavailableBadge = isUnavailableState(state);
    const displayValue = config.show_state !== false
      ? (config.state_attribute ? this._formatAttributeValue(state, config.state_attribute) : this._translateStateValue(state))
      : null;
    const isAlarmPanel = this._isAlarmPanelMode(state);
    const alarmModes = isAlarmPanel ? this._getAlarmRenderedModes(state) : [];
    const showAlarmPanel = isAlarmPanel && this._alarmMenuOpen;
    const showAlarmCodeInput = showAlarmPanel && this._shouldShowAlarmCodeInput(state);
    const canRunPrimaryAction = this._canRunTapAction(state);
    const isActive = this._isDomainOn(state);
    const iconSizePx = Math.max(32, Math.min(parseSizeToPixels(styles.icon.size, 52), isMini ? 38 : (isCompactInline ? 38 : 56)));
    const titleSizePx = Math.max(10, Math.min(parseSizeToPixels(styles.title_size, 13), isMini ? 0 : (isCompactInline ? 11 : 14)));
    const chipHeightPx = Math.max(16, Math.min(parseSizeToPixels(styles.chip_height, 22), isCompactInline ? 18 : 24));
    const chipFontSizePx = Math.max(8.5, Math.min(parseSizeToPixels(styles.chip_font_size, 11), isCompactInline ? 9.5 : 12));
    const iconColor = isActive
      ? resolveFavBubbleIconGlyphColor(accentColor, state)
      : (this._usesCustomOffColor()
        ? styles.icon.off_color
        : "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))");
    const cardBackground = isActive
      ? `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 10%, ${styles.card.background}) 52%, ${styles.card.background} 100%)`
      : styles.card.background;
    const cardBorder = isActive
      ? `1px solid color-mix(in srgb, ${accentColor} 32%, var(--divider-color))`
      : styles.card.border;
    const cardShadow = isActive
      ? `${styles.card.box_shadow}, 0 16px 32px color-mix(in srgb, ${accentColor} 18%, rgba(0, 0, 0, 0.18))`
      : styles.card.box_shadow;
    const showTitle = config.show_name !== false && !isMini;
    const showValue = Boolean(displayValue) && !isMini;
    const showCopy = showTitle || showValue;

    this._applyHostGridSpan(showAlarmPanel);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          overflow: visible;
          position: relative;
          isolation: isolate;
          z-index: ${showAlarmPanel ? 4 : "auto"};
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          height: ${showAlarmPanel ? "auto" : (usesCompactRowMetrics ? `${singleRowHeightPx}px` : "100%")};
          min-height: ${usesCompactRowMetrics ? `${singleRowHeightPx}px` : "0"};
          overflow: hidden;
          position: relative;
          z-index: ${showAlarmPanel ? 2 : 1};
        }

        ha-card::before {
          background: ${isActive
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
          content: "";
          inset: 0;
          opacity: ${isActive ? "1" : "0"};
          pointer-events: none;
          position: absolute;
          transition: opacity 180ms ease;
          z-index: 0;
        }

        .fav-card {
          cursor: ${canRunPrimaryAction ? "pointer" : "default"};
          min-width: 0;
          position: relative;
          touch-action: manipulation;
        }

        .fav-card--mini {
          align-items: center;
          display: flex;
          justify-content: center;
          min-height: 100%;
        }

        .fav-card__content {
          align-content: ${showAlarmPanel ? "start" : "center"};
          display: grid;
          gap: ${showAlarmPanel ? "10px" : (isCompactInline ? "6px" : (isMini ? "0" : styles.card.gap))};
          height: ${showAlarmPanel ? "auto" : (usesCompactRowMetrics ? "100%" : "auto")};
          min-width: 0;
          padding: ${showAlarmPanel ? "8px 10px 10px" : (isCompactInline ? "6px 10px" : (isMini ? "0" : styles.card.padding))};
          position: relative;
          overflow: hidden;
          z-index: 1;
        }

        .fav-card--mini .fav-card__content {
          align-content: center;
          justify-items: center;
          min-height: 100%;
          width: 100%;
        }

        .fav-card--single-row .fav-card__content {
          align-content: center;
        }

        .fav-card--alarm-open .fav-card__content {
          align-items: start;
          min-height: 0;
        }

        .fav-card--alarm-open {
          overflow: hidden;
          position: relative;
          z-index: 3;
        }

        .fav-card--alarm-open .fav-card__hero {
          align-items: center;
          height: auto;
        }

        .fav-card__hero {
          align-items: center;
          display: grid;
          gap: ${isMini ? "0" : (isCompactInline ? "10px" : "12px")};
          grid-template-columns: ${isMini ? "1fr" : `${iconSizePx}px minmax(0, 1fr)`};
          height: ${showAlarmPanel ? "auto" : (usesCompactRowMetrics ? "100%" : "auto")};
          min-width: 0;
          width: ${(isCompactInline || isMini) ? "100%" : "auto"};
        }

        .fav-card__icon {
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
          color: ${iconColor};
          cursor: ${canRunPrimaryAction ? "pointer" : "default"};
          display: inline-flex;
          height: ${iconSizePx}px;
          justify-content: center;
          line-height: 0;
          margin: 0;
          min-width: ${iconSizePx}px;
          outline: none;
          padding: 0;
          position: relative;
          width: ${iconSizePx}px;
          touch-action: manipulation;
        }

        .fav-card--mini .fav-card__hero {
          align-content: center;
          justify-items: center;
        }

        .fav-card__icon ha-icon {
          --mdc-icon-size: calc(${iconSizePx}px * 0.46);
          color: ${iconColor};
          display: inline-flex;
          height: calc(${iconSizePx}px * 0.46);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${iconSizePx}px * 0.46);
        }

        .fav-card__unavailable-badge {
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

        .fav-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          color:#fff;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .fav-card__copy {
          align-content: center;
          display: grid;
          gap: ${isCompactInline ? "4px" : "6px"};
          min-width: 0;
        }

        .fav-card__alarm-panel {
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, ${accentColor} 12%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)),
              color-mix(in srgb, var(--primary-text-color) 4%, transparent)
            );
          border: 1px solid color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 20px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 18px 36px rgba(0, 0, 0, 0.24);
          display: grid;
          gap: 10px;
          margin-top: 2px;
          min-width: 0;
          padding: 10px;
          pointer-events: auto;
          position: static;
          width: 100%;
          z-index: 1;
        }

        .fav-card__alarm-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          min-width: 0;
        }

        .fav-card__alarm-button {
          align-items: center;
          appearance: none;
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--fav-alarm-accent) 14%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)),
              color-mix(in srgb, var(--primary-text-color) 5%, transparent)
            );
          border: 1px solid color-mix(in srgb, var(--fav-alarm-accent) 28%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 7%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.14);
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: ${Math.max(11, chipFontSizePx)}px;
          font-weight: 700;
          gap: 6px;
          min-height: ${Math.max(28, chipHeightPx + 6)}px;
          padding: 0 11px;
          touch-action: manipulation;
        }

        .fav-card__alarm-button ha-icon {
          --mdc-icon-size: 14px;
          color: var(--fav-alarm-glyph, var(--fav-alarm-accent));
          height: 14px;
          width: 14px;
        }

        .fav-card__alarm-code {
          min-width: 0;
        }

        .fav-card__alarm-code input {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 14px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 38px;
          padding: 0 12px;
          width: 100%;
        }

        .fav-card__title {
          font-size: ${titleSizePx}px;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: ${isCompactInline ? "1.08" : "1.12"};
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .fav-card__chips {
          align-items: center;
          display: flex;
          gap: ${isCompactInline ? "6px" : "8px"};
          min-width: 0;
        }

        .fav-card__chip {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color: var(--primary-text-color);
          display: inline-flex;
          font-size: ${chipFontSizePx}px;
          font-weight: 700;
          height: ${chipHeightPx}px;
          line-height: 1;
          max-width: 100%;
          min-width: 0;
          padding: ${styles.chip_padding};
          white-space: nowrap;
        }

        .fav-card__empty-title {
          font-size: 14px;
          font-weight: 700;
        }

        .fav-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
        }

        .fav-card--single-row .fav-card__chip {
          max-width: 100%;
        }

        .fav-card--tight-inline:not(.fav-card--alarm-open) .fav-card__copy {
          align-items: center;
          display: flex;
          gap: 6px;
          min-width: 0;
        }

        .fav-card--tight-inline:not(.fav-card--alarm-open) .fav-card__title {
          flex: 1 1 auto;
          min-width: 0;
        }

        .fav-card--tight-inline:not(.fav-card--alarm-open) .fav-card__chips {
          flex: 0 0 auto;
          gap: 4px;
        }

        .fav-card--tight-inline.fav-card--alarm-open .fav-card__copy {
          align-content: start;
          display: grid;
          gap: 6px;
          min-width: 0;
          width: 100%;
        }

        .fav-card--empty {
          display: grid;
          gap: 8px;
          padding: 14px;
        }

        @media (max-width: 420px) {
          .fav-card--inline .fav-card__hero {
            grid-template-columns: 50px minmax(0, 1fr);
          }

          .fav-card--inline .fav-card__icon {
            height: 50px;
            min-width: 50px;
            width: 50px;
          }
        }

        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <ha-card
        class="fav-card ${isActive ? "is-on" : "is-off"} ${isMini ? "fav-card--mini" : "fav-card--inline"} ${isCompactInline ? "fav-card--single-row" : ""} ${isTightInline ? "fav-card--tight-inline" : ""} ${showAlarmPanel ? "fav-card--alarm-open" : ""} ${canRunPrimaryAction ? "fav-card--clickable" : ""}"
        style="--fav-accent:${escapeHtml(accentColor)};"
        ${canRunPrimaryAction ? 'data-fav-action="primary"' : ""}
      >
        <div class="fav-card__content" ${canRunPrimaryAction ? 'data-fav-action="primary"' : ""}>
          <div class="fav-card__hero" ${canRunPrimaryAction ? 'data-fav-action="primary"' : ""}>
            <button
              type="button"
              class="fav-card__icon"
              ${canRunPrimaryAction ? 'data-fav-action="primary"' : ""}
              aria-label="${escapeHtml(canRunPrimaryAction ? this._commonAria("primaryAction", "Primary action") : title)}"
            >
              <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
              ${showUnavailableBadge ? `<span class="fav-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            ${showCopy
              ? `
                <div class="fav-card__copy">
                  ${showTitle ? `<div class="fav-card__title">${escapeHtml(title)}</div>` : ""}
                  ${showValue ? `<div class="fav-card__chips">${this._renderChip(displayValue)}</div>` : ""}
                </div>
              `
              : ""}
          </div>
          ${showAlarmPanel
            ? `
              <div class="fav-card__alarm-panel">
                <div class="fav-card__alarm-actions">
                  ${alarmModes.map(mode => this._renderAlarmActionButton(mode, accentColor, state)).join("")}
                </div>
                ${showAlarmCodeInput
                  ? `
                    <label class="fav-card__alarm-code" data-fav-alarm-ignore="true">
                      <input
                        type="password"
                        inputmode="numeric"
                        autocomplete="one-time-code"
                        data-fav-alarm-ignore="true"
                        data-fav-alarm-field="alarm-code"
                        placeholder="PIN"
                        value="${escapeHtml(this._alarmCodeInput)}"
                      />
                    </label>
                  `
                  : ""}
              </div>
            `
            : ""}
        </div>
      </ha-card>
    `;

    if (isAlarmPanel && this._lastAlarmPanelRenderedOpen !== showAlarmPanel) {
      this._lastAlarmPanelRenderedOpen = showAlarmPanel;
      requestAnimationFrame(() => {
        if (!this.isConnected) {
          return;
        }
        this._applyHostGridSpan(showAlarmPanel);
        this._notifyLayoutChange();
      });
    } else if (!isAlarmPanel) {
      this._lastAlarmPanelRenderedOpen = false;
    }
  }
}
  _lazyNodaliaFavCard = NodaliaFavCard;
  return NodaliaFavCard;
}
