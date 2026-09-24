// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  ALARM_STATE_TINT_FALLBACKS,
  CARD_TAG,
  EDITOR_TAG,
  FEATURE_ARM_AWAY,
  FEATURE_ARM_CUSTOM_BYPASS,
  FEATURE_ARM_HOME,
  FEATURE_ARM_NIGHT,
  FEATURE_ARM_VACATION,
  HAPTIC_PATTERNS,
} from "./alarm-panel-constants";
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
} from "./alarm-panel-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./alarm-panel-config";
import {
  applyStubEntity,
  isUnavailableState,
  parseSizeToPixels,
} from "./alarm-panel-helpers";

let _lazyNodaliaAlarmPanelCard;
export function loadNodaliaAlarmPanelCard() {
  if (_lazyNodaliaAlarmPanelCard) {
    return _lazyNodaliaAlarmPanelCard;
  }
class NodaliaAlarmPanelCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["alarm_control_panel"], entities, entitiesFallback);
  }

  static getEntitySuggestion(hass, entityId) {
    return window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, { domains: ["alarm_control_panel"] });
  }

  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._cardWidth = 0;
    this._isCompactLayout = false;
    this._codeInput = "";
    this._isCodeInputFocused = false;
    this._pendingRenderWhileCodeFocused = false;
    this._countdownInterval = null;
    this._resizeObserver = null;
    this._lastRenderSignature = "";
    this._pinVerifyWatch = null;
    this._pinErrorVisible = false;
    this._pinErrorClearTimer = 0;
    this._pinErrorBaseline = null;
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowFocusIn = this._onShadowFocusIn.bind(this);
    this._onShadowFocusOut = this._onShadowFocusOut.bind(this);
    }

  _captureCodeFocusState() {
    const activeElement = this.shadowRoot?.activeElement;
    if (!(activeElement instanceof HTMLInputElement) || activeElement.dataset?.alarmField !== "code") {
      return null;
    }

    const supportsSelection =
      typeof activeElement.selectionStart === "number" &&
      typeof activeElement.selectionEnd === "number";

    return {
      selectionEnd: supportsSelection ? activeElement.selectionEnd : null,
      selectionStart: supportsSelection ? activeElement.selectionStart : null,
      value: activeElement.value,
    };
  }

  _restoreCodeFocusState(focusState) {
    if (!focusState || !(this.shadowRoot instanceof ShadowRoot)) {
      return;
    }

    const target = this.shadowRoot.querySelector('input[data-alarm-field="code"]');
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (typeof focusState.value === "string" && target.value !== focusState.value) {
      target.value = focusState.value;
    }

    try {
      target.focus({ preventScroll: true });
    } catch (_error) {
      target.focus();
    }

    if (
      typeof focusState.selectionStart === "number" &&
      typeof focusState.selectionEnd === "number" &&
      typeof target.setSelectionRange === "function"
    ) {
      try {
        target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
      } catch (_error) {
        // Ignore unsupported input selection issues.
      }
    }
  }

  _renderWithFocusPreserved() {
    const focusState = this._captureCodeFocusState();
    this._render();
    this._restoreCodeFocusState(focusState);
  }

  _shouldDeferRenderForCodeInput() {
    if (!this._isCodeInputFocused) {
      return false;
    }

    const activeElement = this.shadowRoot?.activeElement;
    return activeElement instanceof HTMLInputElement && activeElement.dataset?.alarmField === "code";
  }

  _requestRender() {
    this._syncCountdownTimer();

    if (this._shouldDeferRenderForCodeInput()) {
      this._pendingRenderWhileCodeFocused = true;
      return;
    }

    this._pendingRenderWhileCodeFocused = false;
    this._renderWithFocusPreserved();
  }

  connectedCallback() {
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("focusin", this._onShadowFocusIn);
    this.shadowRoot.addEventListener("focusout", this._onShadowFocusOut);

    if (!this._resizeObserver) {
      this._resizeObserver = new ResizeObserver(entries => {
        const entry = entries[0];
        if (!entry) {
          return;
        }

        const nextWidth = Math.round(entry.contentRect?.width || this.clientWidth || 0);
        // Ignore collapse glitches (display:none, mid-reflow 0-width).
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
        this._requestRender();
      });
    }

    this._resizeObserver.observe(this);
    this._syncCountdownTimer();
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
    this._requestRender();
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener("click", this._onShadowClick);
    this.shadowRoot.removeEventListener("input", this._onShadowInput);
    this.shadowRoot.removeEventListener("focusin", this._onShadowFocusIn);
    this.shadowRoot.removeEventListener("focusout", this._onShadowFocusOut);
    this._resizeObserver?.disconnect();
    this._clearCountdownTimer();
    this._clearPinVerifyWatch();
    if (this._pinErrorClearTimer) {
      window.clearTimeout(this._pinErrorClearTimer);
      this._pinErrorClearTimer = 0;
    }
    this._pinErrorVisible = false;
    this._pinErrorBaseline = null;
    if (this._focusDeferTimer) {
      window.clearTimeout(this._focusDeferTimer);
      this._focusDeferTimer = 0;
    }
    window.NodaliaUtils?.clearDeferTimers?.(this);
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._clearPinVerifyWatch();
    if (this._pinErrorClearTimer) {
      window.clearTimeout(this._pinErrorClearTimer);
      this._pinErrorClearTimer = 0;
    }
    this._pinErrorVisible = false;
    this._pinErrorBaseline = null;
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
    this._syncCountdownTimer();
    this._requestRender();
  }

  set hass(hass) {
    const entityId = this._config?.entity || "";
    let bustSignatureCache = false;

    if (this._pinVerifyWatch && entityId) {
      const st = hass?.states?.[entityId];
      const w = this._pinVerifyWatch;
      if (st && (st.state !== w.snapState || st.last_changed !== w.snapLc)) {
        this._clearPinVerifyWatch();
      }
    }

    if (this._pinErrorVisible && this._pinErrorBaseline && entityId) {
      const st = hass?.states?.[entityId];
      if (st && (st.state !== this._pinErrorBaseline.state || st.last_changed !== this._pinErrorBaseline.lc)) {
        if (this._pinErrorClearTimer) {
          window.clearTimeout(this._pinErrorClearTimer);
          this._pinErrorClearTimer = 0;
        }
        this._pinErrorVisible = false;
        this._pinErrorBaseline = null;
        bustSignatureCache = true;
      }
    }
    const nextSignature = this._getRenderSignature(hass);
    this._hass = hass;
    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature && !bustSignatureCache) {
      this._syncCountdownTimer();
      return;
    }
    this._lastRenderSignature = nextSignature;
    this._syncCountdownTimer();
    this._requestRender();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 2,
      min_columns: 3,
    };
  }

  _shouldUseCompactLayout(width) {
    return window.NodaliaUtils.shouldUseCompactCardLayout({
      mode: this._config?.compact_layout_mode,
      width,
      gridColumns: this._config?.grid_options?.columns,
      parentWidth: window.NodaliaUtils.resolveCompactLayoutParentWidth?.(this) || 0,
    });
  }

  _shouldShowCompactTitle(width) {
    return window.NodaliaUtils.shouldShowCompactCardTitle({
      width: Math.round(width || this._cardWidth || this.clientWidth || 0),
    });
  }

  _getState() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const helperEntityId = this._config?.code_entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const helperState = helperEntityId ? hass?.states?.[helperEntityId] || null : null;
    const attrs = state?.attributes || {};
    const joinParts = window.NodaliaRenderSignature?.joinParts;
    const values = [
      entityId,
      String(state?.state || ""),
      String(attrs.friendly_name || ""),
      Number(attrs.supported_features ?? 0),
      String(attrs.code_format || ""),
      this._config?.show_entity_picture === true,
      String(this._config?.entity_picture || attrs.entity_picture_local || attrs.entity_picture || ""),
      Number(attrs.delay ?? -1),
      String(attrs.next_state || ""),
      String(attrs.post_pending_state || ""),
      String(attrs.post_delay_state || ""),
      helperEntityId,
      String(helperState?.state || ""),
      Boolean(this._isCompactLayout),
      Number(this._config?.wrong_code_feedback_ms) || 5000,
      this._config?.show_state !== false ? 1 : 0,
      this._pinErrorVisible === true ? 1 : 0,
      String(this._config?.name || ""),
      String(window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") || "en"),
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "alarm:", values }]);
    }
    return values.join("::");
  }

  _getTitle(state) {
    if (this._config?.name) {
      return this._config.name;
    }
    if (state?.attributes?.friendly_name) {
      return state.attributes.friendly_name;
    }
    if (this._config?.entity) {
      return this._config.entity;
    }
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    return window.NodaliaI18n?.strings?.(lang)?.alarmPanel?.defaultTitle || "Alarm";
  }

  _getIcon() {
    return this._config?.icon || "mdi:shield-home";
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

  _translateState(state) {
    const key = normalizeTextKey(state?.state);
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const langCfg = this._config?.language ?? "auto";
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, langCfg) ?? "en";
    const alarmStrings = window.NodaliaI18n?.strings?.(lang)?.alarmPanel;
    const enAlarm = window.NodaliaI18n?.strings?.("en")?.alarmPanel;
    const translated = alarmStrings?.states?.[key] || enAlarm?.states?.[key];
    if (translated) {
      return translated;
    }

    return state?.state ? String(state.state) : (alarmStrings?.noState || enAlarm?.noState || "No state");
  }

  _getCountdownSecondsRemaining(state) {
    const status = normalizeTextKey(state?.state);
    if (!["arming", "pending"].includes(status)) {
      return null;
    }

    const delay = Number(state?.attributes?.delay);
    if (!Number.isFinite(delay) || delay <= 0) {
      return null;
    }

    const changedAt = Date.parse(state?.last_changed || "");
    if (!Number.isFinite(changedAt)) {
      return Math.ceil(delay);
    }

    const elapsedSeconds = Math.max(0, (Date.now() - changedAt) / 1000);
    return Math.max(0, Math.ceil(delay - elapsedSeconds));
  }

  _formatCountdownLabel(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return null;
    }

    const total = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(total / 60);
    const remainingSeconds = total % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  _clearCountdownTimer() {
    if (this._countdownInterval !== null) {
      window.clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
  }

  _syncCountdownTimer() {
    const state = this._getState();
    const remaining = this._getCountdownSecondsRemaining(state);

    if (!Number.isFinite(remaining)) {
      this._clearCountdownTimer();
      return;
    }

    if (this._countdownInterval !== null) {
      return;
    }

    this._countdownInterval = window.setInterval(() => {
      if (!this.isConnected) {
        this._clearCountdownTimer();
        return;
      }
      const nextState = this._getState();
      const nextRemaining = this._getCountdownSecondsRemaining(nextState);

      if (!Number.isFinite(nextRemaining)) {
        this._clearCountdownTimer();
      }

      this._requestRender();
    }, 1000);
  }

  _getAccentColor(state) {
    const key = normalizeTextKey(state?.state);
    const configuredTint = this._config?.styles?.state_tints?.[key];
    if (typeof configuredTint === "string" && configuredTint.trim()) {
      return configuredTint.trim();
    }

    return ALARM_STATE_TINT_FALLBACKS[key] || "var(--info-color, #71c0ff)";
  }

  _isActiveState(state) {
    const key = normalizeTextKey(state?.state);
    return !["", "disarmed", "unknown", "unavailable"].includes(key);
  }

  _getSupportedFeatures(state) {
    const attrs = state?.attributes;
    if (!attrs || !Object.prototype.hasOwnProperty.call(attrs, "supported_features")) {
      return null;
    }
    const value = Number(attrs.supported_features);
    return Number.isFinite(value) ? value : 0;
  }

  _supportsMode(state, mode) {
    const features = this._getSupportedFeatures(state);

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

  _matchesAlarmMode(state, ...keys) {
    const candidates = this._getAlarmStateCandidates(state);
    return keys.some(key => candidates.includes(normalizeTextKey(key)));
  }

  _getModeDefinitions(state) {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const actionLabels = window.NodaliaI18n?.strings?.(lang)?.alarmPanel?.actions || {};
    const modes = [
      {
        key: "disarm",
        label: actionLabels.disarm || this._translateState({ state: "disarmed" }),
        icon: "mdi:shield-off-outline",
        service: "alarm_disarm",
        enabled: this._config?.show_disarm !== false && !this._matchesAlarmMode(state, "disarmed"),
        active: this._matchesAlarmMode(state, "disarmed"),
      },
      {
        key: "home",
        label: actionLabels.arm_home || this._translateState({ state: "armed_home" }),
        icon: "mdi:home-lock",
        service: "alarm_arm_home",
        enabled: this._config?.show_arm_home !== false
          && this._supportsMode(state, "home")
          && !this._matchesAlarmMode(state, "armed_home"),
        active: this._matchesAlarmMode(state, "armed_home"),
      },
      {
        key: "away",
        label: actionLabels.arm_away || this._translateState({ state: "armed_away" }),
        icon: "mdi:shield-lock",
        service: "alarm_arm_away",
        enabled: this._config?.show_arm_away !== false
          && this._supportsMode(state, "away")
          && !this._matchesAlarmMode(state, "armed_away"),
        active: this._matchesAlarmMode(state, "armed_away"),
      },
      {
        key: "night",
        label: actionLabels.arm_night || this._translateState({ state: "armed_night" }),
        icon: "mdi:weather-night",
        service: "alarm_arm_night",
        enabled: this._config?.show_arm_night !== false
          && this._supportsMode(state, "night")
          && !this._matchesAlarmMode(state, "armed_night"),
        active: this._matchesAlarmMode(state, "armed_night"),
      },
      {
        key: "vacation",
        label: actionLabels.arm_vacation || this._translateState({ state: "armed_vacation" }),
        icon: "mdi:palm-tree",
        service: "alarm_arm_vacation",
        enabled: this._config?.show_arm_vacation === true
          && this._supportsMode(state, "vacation")
          && !this._matchesAlarmMode(state, "armed_vacation"),
        active: this._matchesAlarmMode(state, "armed_vacation"),
      },
      {
        key: "custom_bypass",
        label: actionLabels.arm_custom_bypass || this._translateState({ state: "armed_custom_bypass" }),
        icon: "mdi:tune-variant",
        service: "alarm_arm_custom_bypass",
        enabled: this._config?.show_custom_bypass === true
          && this._supportsMode(state, "custom_bypass")
          && !this._matchesAlarmMode(state, "armed_custom_bypass"),
        active: this._matchesAlarmMode(state, "armed_custom_bypass"),
      },
    ];

    return modes.filter(mode => mode.enabled);
  }

  _getCodeValue(state) {
    const manualPin = String(this._codeInput || "").trim();
    if (manualPin) {
      return manualPin;
    }

    const helperEntityId = String(this._config?.code_entity || "").trim();

    if (helperEntityId) {
      const helperState = this._hass?.states?.[helperEntityId];
      const helperValue = String(helperState?.state || "").trim();
      if (helperValue && !["unknown", "unavailable"].includes(normalizeTextKey(helperValue))) {
        return helperValue;
      }
    }

    const configuredCode = String(this._config?.code || "").trim();
    if (configuredCode) {
      return configuredCode;
    }

    return "";
  }

  _shouldShowCodeInput(state) {
    if (this._config?.show_code_input === false) {
      return false;
    }

    if (this._config?.show_code_input === true) {
      return true;
    }

    const codeFormat = String(state?.attributes?.code_format || "").trim();
    return Boolean(codeFormat);
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

    if (haptics.fallback_vibrate && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      const pattern = HAPTIC_PATTERNS[style] || HAPTIC_PATTERNS.selection;
      navigator.vibrate(pattern);
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
      this._animateContentOnNextRender = false;
    }, safeDelay);
  }

  _clearPinVerifyWatch() {
    if (this._pinVerifyWatch?.timer) {
      window.clearTimeout(this._pinVerifyWatch.timer);
    }
    this._pinVerifyWatch = null;
  }

  _showNativePinErrorChip() {
    this._clearPinVerifyWatch();
    if (this._pinErrorClearTimer) {
      window.clearTimeout(this._pinErrorClearTimer);
      this._pinErrorClearTimer = 0;
    }

    const snap = this._getState();
    this._pinErrorBaseline = snap ? { state: snap.state, lc: snap.last_changed } : null;
    this._pinErrorVisible = true;
    this._lastRenderSignature = "";
    const schedule = window.NodaliaUtils?.scheduleDeferTimer;
    const done = () => {
      this._pinErrorClearTimer = 0;
      if (!this.isConnected) {
        return;
      }
      this._pinErrorVisible = false;
      this._pinErrorBaseline = null;
      this._lastRenderSignature = "";
      this._requestRender();
    };
    if (typeof schedule === "function") {
      this._pinErrorClearTimer = schedule(this, done, 4500);
    } else {
      this._pinErrorClearTimer = window.setTimeout(done, 4500);
    }
    this._requestRender();
  }

  _alarmPanelUi(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.alarmPanel;
    const enPack = window.NodaliaI18n?.strings?.("en")?.alarmPanel;
    const raw = pack?.[key] ?? enPack?.[key];
    return String(raw != null && raw !== "" ? raw : fallback);
  }

  _nativePinErrorLabel() {
    return this._alarmPanelUi("wrongCode", "Wrong code");
  }

  _runAlarmAction(service) {
    const state = this._getState();
    if (!this._hass || !this._config?.entity || !service || !state) {
      return;
    }

    const payload = {
      entity_id: this._config.entity,
    };

    const requiresManualPin = this._shouldShowCodeInput(state);
    const manualPin = String(this._codeInput || "").trim();
    if (requiresManualPin && !manualPin) {
      this._triggerHaptic("warning");
      const input = this.shadowRoot?.querySelector?.('input[data-alarm-field="code"]');
      if (input instanceof HTMLInputElement) {
        input.focus();
      }
      return;
    }

    const code = requiresManualPin ? manualPin : this._getCodeValue(state);
    if (code) {
      payload.code = code;
    }

    const usedManualCode = requiresManualPin && manualPin !== "";
    const invoke = window.NodaliaUtils?.invokeHomeAssistantService?.bind(window.NodaliaUtils)
      || ((host, hass, domain, svc, data) => Promise.resolve(hass?.callService?.(domain, svc, data)));

    this._triggerHaptic();

    if (usedManualCode && code) {
      this._clearPinVerifyWatch();
      const snapState = state.state;
      const snapLc = state.last_changed;
      const pinVerifyMs = clamp(
        Number(this._config?.wrong_code_feedback_ms) || DEFAULT_CONFIG.wrong_code_feedback_ms,
        2000,
        30000,
      );
      this._pinVerifyWatch = {
        snapState,
        snapLc,
        timer: window.setTimeout(() => {
          if (!this._pinVerifyWatch) {
            return;
          }
          this._pinVerifyWatch = null;
          const st = this._getState();
          if (!st || st.state !== snapState || st.last_changed !== snapLc) {
            return;
          }
          this._showNativePinErrorChip();
        }, pinVerifyMs),
      };

      Promise.resolve(invoke(this, this._hass, "alarm_control_panel", service, payload))
        .catch(() => {
          if (!this.isConnected) {
            return;
          }
          this._clearPinVerifyWatch();
          this._showNativePinErrorChip();
        });
    } else {
      Promise.resolve(invoke(this, this._hass, "alarm_control_panel", service, payload)).catch(() => {
        if (!this.isConnected) {
          return;
        }
        this._showNativePinErrorChip();
      });
    }
  }

  _openMoreInfo() {
    if (!this._config?.entity) {
      return;
    }

    fireEvent(this, "hass-more-info", {
      entityId: this._config.entity,
    });
  }

  _onShadowClick(event) {
    const button = event
      .composedPath()
      .find(node => node instanceof HTMLButtonElement && node.dataset?.alarmAction);

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const action = button.dataset.alarmAction;

    if (action === "more-info") {
      this._triggerHaptic();
      this._triggerPressAnimation(this.shadowRoot.querySelector(".alarm-card__content"));
      this._triggerPressAnimation(this.shadowRoot.querySelector(".alarm-card__icon"));
      this._openMoreInfo();
      return;
    }

    this._triggerPressAnimation(this.shadowRoot.querySelector(".alarm-card__content"));
    this._triggerPressAnimation(button);
    this._runAlarmAction(action);
  }

  _onShadowInput(event) {
    const input = event.composedPath().find(node => node instanceof HTMLInputElement && node.dataset?.alarmField === "code");
    if (!input) {
      return;
    }

    this._codeInput = input.value;
  }

  _onShadowFocusIn(event) {
    const input = event.composedPath().find(node => node instanceof HTMLInputElement && node.dataset?.alarmField === "code");
    if (!input) {
      return;
    }

    this._isCodeInputFocused = true;
  }

  _onShadowFocusOut(event) {
    const input = event.composedPath().find(node => node instanceof HTMLInputElement && node.dataset?.alarmField === "code");
    if (!input) {
      return;
    }

    if (this._focusDeferTimer) {
      window.clearTimeout(this._focusDeferTimer);
      this._focusDeferTimer = 0;
    }
    const schedule = window.NodaliaUtils?.scheduleDeferTimer;
    const done = () => {
      this._focusDeferTimer = 0;
      if (!this.isConnected) {
        return;
      }
      const activeElement = this.shadowRoot?.activeElement;
      const stillFocused = activeElement instanceof HTMLInputElement && activeElement.dataset?.alarmField === "code";

      this._isCodeInputFocused = stillFocused;

      if (!stillFocused && this._pendingRenderWhileCodeFocused) {
        this._pendingRenderWhileCodeFocused = false;
        this._renderWithFocusPreserved();
      }
    };
    if (typeof schedule === "function") {
      this._focusDeferTimer = schedule(this, done, 0);
    } else {
      this._focusDeferTimer = window.setTimeout(done, 0);
    }
  }

  _renderChip(label, tone = "default", accentColor = "var(--accent-color)") {
    if (!label) {
      return "";
    }

    return `
      <div class="alarm-card__chip alarm-card__chip--${tone}" ${tone === "state" ? `style="--chip-accent:${escapeHtml(accentColor)};"` : ""}>
        ${escapeHtml(label)}
      </div>
    `;
  }

  _renderEmptyState() {
    const title = escapeHtml(this._alarmPanelUi("emptyTitle", "Nodalia Alarm Panel Card"));
    const body = escapeHtml(this._alarmPanelUi("emptyBody", "Set `entity` to show this card."));
    return `
      <ha-card class="alarm-card alarm-card--empty">
        <div class="alarm-card__empty-title">${title}</div>
        <div class="alarm-card__empty-text">${body}</div>
      </ha-card>
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
      { cardClass: "alarm-card" },
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
    const title = this._getTitle(state);
    const icon = this._getIcon();
    const entityPicture = this._getEntityPicture(state);
    const accentColor = this._getAccentColor(state);
    const darkenAccentForeground = Boolean(
      window.NodaliaBubbleContrast?.shouldDarkenBubbleIconGlyph?.(state, accentColor),
    );
    const accentForegroundColor =
      window.NodaliaBubbleContrast?.resolveBubbleIconGlyphColor?.(state, accentColor)
      || `color-mix(in srgb, ${accentColor} ${darkenAccentForeground ? 42 : 72}%, var(--primary-text-color))`;
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const showUnavailableBadge = isUnavailableState(state);
    const isCompactLayout = this._isCompactLayout;
    const isActive = this._isActiveState(state);
    const configuredOnIconColor = String(styles?.icon?.on_color ?? "").trim();
    const defaultOnIconColor = String(DEFAULT_CONFIG.styles.icon.on_color).trim();
    const iconColor = isActive
      ? (configuredOnIconColor && configuredOnIconColor !== defaultOnIconColor
          ? configuredOnIconColor
          : accentForegroundColor)
      : styles.icon.off_color;
    const stateLabel = config.show_state !== false ? this._translateState(state) : null;
    const countdownLabel = this._formatCountdownLabel(this._getCountdownSecondsRemaining(state));
    const pinErrorLabel = this._pinErrorVisible ? this._nativePinErrorLabel() : null;
    const chips = [
      this._renderChip(stateLabel, "state", accentColor),
      this._renderChip(pinErrorLabel, "pin-error"),
      this._renderChip(countdownLabel, "countdown", accentColor),
    ].filter(Boolean);
    const actions = this._getModeDefinitions(state);
    const showCodeInput = this._shouldShowCodeInput(state);
    const cardBackground = isActive
      ? `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 7%, ${styles.card.background}) 56%, ${styles.card.background} 100%)`
      : styles.card.background;
    const cardBorder = isActive
      ? `1px solid color-mix(in srgb, ${accentColor} 24%, var(--divider-color))`
      : styles.card.border;
    const cardShadow = isActive
      ? `${styles.card.box_shadow}, 0 16px 32px color-mix(in srgb, ${accentColor} 10%, rgba(0, 0, 0, 0.18))`
      : styles.card.box_shadow;
    const titleSize = isCompactLayout
      ? `${Math.max(12, Math.min(parseSizeToPixels(styles.title_size, 14), 13))}px`
      : styles.title_size;
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --alarm-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --alarm-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          display: block;
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
          overflow: hidden;
          position: relative;
        }

        ha-card::before {
          background: ${isActive
            ? `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 14%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)), rgba(255, 255, 255, 0))`
            : "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 4%, transparent), rgba(255, 255, 255, 0))"};
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
          opacity: ${isActive ? "1" : "0"};
          pointer-events: none;
          position: absolute;
          transition: opacity 180ms ease;
          z-index: 0;
        }

        .alarm-card__content {
          display: grid;
          gap: ${styles.card.gap};
          min-width: 0;
          padding: ${styles.card.padding};
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease;
          will-change: transform;
          z-index: 1;
        }

        .alarm-card__content--entering {
          animation: alarm-card-fade-up calc(var(--alarm-card-content-duration) * 0.88) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .alarm-card__content.is-pressing {
          animation: alarm-card-content-bounce var(--alarm-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .alarm-card__hero {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: ${styles.icon.size} minmax(0, 1fr);
          min-width: 0;
        }

        .alarm-card__hero--entering {
          animation: alarm-card-fade-up calc(var(--alarm-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .alarm-card__icon {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          appearance: none;
          background: ${styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 24px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent),
            0 12px 30px rgba(0, 0, 0, 0.18);
          color: ${iconColor};
          cursor: pointer;
          display: inline-flex;
          height: ${styles.icon.size};
          justify-content: center;
          line-height: 0;
          margin: 0;
          outline: none;
          padding: 0;
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease, color 180ms ease;
          will-change: transform;
          width: ${styles.icon.size};
        }

        .alarm-card__icon--entering {
          animation: alarm-card-bubble-bloom calc(var(--alarm-card-content-duration) * 0.92) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 40ms;
        }

        .alarm-card__icon.is-pressing,
        .alarm-card__action.is-pressing {
          animation: alarm-card-bubble-bounce var(--alarm-card-button-bounce-duration) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
        }

        .alarm-card__icon ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.44);
          display: inline-flex;
          height: calc(${styles.icon.size} * 0.44);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${styles.icon.size} * 0.44);
        }

        .alarm-card__picture {
          border-radius: inherit;
          height: 100%;
          inset: 0;
          object-fit: cover;
          position: absolute;
          width: 100%;
        }

        .alarm-card__unavailable-badge {
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

        .alarm-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          color:#fff;
          height: 11px;
          left: auto;
          position: static;
          top: auto;
          transform: none;
          width: 11px;
        }

        .alarm-card__copy {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .alarm-card__copy--entering {
          animation: alarm-card-fade-up calc(var(--alarm-card-content-duration) * 0.92) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 70ms;
        }

        .alarm-card__title {
          font-size: ${titleSize};
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.15;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .alarm-card__chips {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          min-width: 0;
        }

        .alarm-card__chip {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color: var(--secondary-text-color);
          display: inline-flex;
          flex: 0 0 auto;
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          height: max(24px, ${styles.chip_height});
          line-height: 1;
          max-width: 100%;
          min-width: 0;
          padding: ${styles.chip_padding};
          white-space: nowrap;
        }

        .alarm-card__chip--state {
          background: color-mix(in srgb, var(--chip-accent) 16%, color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border-color: color-mix(in srgb, var(--chip-accent) 40%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          color: ${accentForegroundColor};
        }

        .alarm-card__chip--pin-error {
          background: color-mix(in srgb, var(--error-color, #ff6b6b) 22%, color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border-color: color-mix(in srgb, var(--error-color, #ff6b6b) 48%, color-mix(in srgb, var(--primary-text-color) 10%, transparent));
          color: color-mix(in srgb, var(--error-color, #ff6b6b) 72%, var(--primary-text-color));
        }

        .alarm-card__code {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          min-width: 0;
          padding: 0 14px;
        }

        .alarm-card__code--entering {
          animation: alarm-card-fade-up calc(var(--alarm-card-content-duration) * 0.94) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 95ms;
        }

        .alarm-card__code-input {
          appearance: none;
          background: transparent;
          border: 0;
          color: var(--primary-text-color);
          -webkit-text-fill-color: var(--primary-text-color);
          caret-color: var(--primary-text-color);
          font: inherit;
          font-variant-numeric: tabular-nums;
          height: ${styles.input_height};
          letter-spacing: 0.18em;
          line-height: ${styles.input_height};
          outline: none;
          opacity: 1;
          position: relative;
          z-index: 1;
          width: 100%;
        }

        .alarm-card__code-input::placeholder {
          color: var(--secondary-text-color);
          -webkit-text-fill-color: var(--secondary-text-color);
          letter-spacing: normal;
          opacity: 1;
        }

        .alarm-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }

        .alarm-card__actions--entering {
          animation: alarm-card-fade-up calc(var(--alarm-card-content-duration) * 0.96) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 115ms;
        }

        .alarm-card__action {
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
          gap: 8px;
          height: max(${styles.control.size}, 40px);
          justify-content: center;
          line-height: 1;
          margin: 0;
          min-width: max(${styles.control.size}, 40px);
          outline: none;
          padding: 0 14px;
          position: relative;
        }

        .alarm-card__action--active {
          background: ${styles.control.accent_background};
          border-color: color-mix(in srgb, ${accentColor} 36%, color-mix(in srgb, var(--primary-text-color) 10%, transparent));
          color: ${styles.control.accent_color};
        }

        .alarm-card__action ha-icon {
          --mdc-icon-size: calc(${styles.control.size} * 0.46);
          display: inline-flex;
          height: calc(${styles.control.size} * 0.46);
          width: calc(${styles.control.size} * 0.46);
        }

        .alarm-card__action-label {
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }

        .alarm-card__empty-title {
          font-size: 15px;
          font-weight: 700;
        }

        .alarm-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }

        .alarm-card--empty {
          display: grid;
          gap: 8px;
          padding: 16px;
        }

        @keyframes alarm-card-fade-up {
          0% {
            opacity: 0;
            transform: translate3d(0, 18px, 0) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes alarm-card-bubble-bloom {
          0% {
            opacity: 0;
            transform: scale(0.78);
            filter: blur(8px);
          }
          60% {
            opacity: 1;
            transform: scale(1.04);
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0);
          }
        }

        @keyframes alarm-card-content-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(0.985);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes alarm-card-bubble-bounce {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(0.92);
          }
          100% {
            transform: scale(1);
          }
        }

        ${animations.enabled ? "" : `
          .alarm-card__content,
          .alarm-card__icon,
          .alarm-card__action {
            transition: none !important;
          }

          .alarm-card__content--entering,
          .alarm-card__hero--entering,
          .alarm-card__icon--entering,
          .alarm-card__copy--entering,
          .alarm-card__code--entering,
          .alarm-card__actions--entering,
          .alarm-card__content.is-pressing,
          .alarm-card__icon.is-pressing,
          .alarm-card__action.is-pressing {
            animation: none !important;
          }
        `}

        @media (max-width: 420px) {
          .alarm-card__hero {
            gap: 10px;
            grid-template-columns: min(${styles.icon.size}, 52px) minmax(0, 1fr);
          }

          .alarm-card__icon {
            height: min(${styles.icon.size}, 52px);
            width: min(${styles.icon.size}, 52px);
          }

          .alarm-card__actions {
            gap: 8px;
          }

          .alarm-card__action {
            padding: 0 12px;
          }

          .alarm-card__action-label {
            font-size: 12px;
          }
        }
        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <ha-card class="alarm-card ${isActive ? "is-on" : "is-off"}">
        <div class="alarm-card__content ${shouldAnimateEntrance ? "alarm-card__content--entering" : ""}">
          <div class="alarm-card__hero ${shouldAnimateEntrance ? "alarm-card__hero--entering" : ""}">
            <button
              type="button"
              class="alarm-card__icon ${shouldAnimateEntrance ? "alarm-card__icon--entering" : ""}"
              data-alarm-action="more-info"
              aria-label="${escapeHtml(title)}"
            >
              ${entityPicture
                ? `<img class="alarm-card__picture" src="${escapeHtml(entityPicture)}" alt="" loading="lazy" />`
                : `<ha-icon icon="${escapeHtml(icon)}"></ha-icon>`}
              ${showUnavailableBadge ? `<span class="alarm-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
            </button>
            <div class="alarm-card__copy ${shouldAnimateEntrance ? "alarm-card__copy--entering" : ""}">
              ${!isCompactLayout || this._shouldShowCompactTitle() ? `<div class="alarm-card__title">${escapeHtml(title)}</div>` : ""}
              ${chips.length ? `<div class="alarm-card__chips">${chips.join("")}</div>` : ""}
            </div>
          </div>

          ${
            showCodeInput
              ? `
                <label class="alarm-card__code ${shouldAnimateEntrance ? "alarm-card__code--entering" : ""}">
                  <input
                    class="alarm-card__code-input"
                    type="password"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    placeholder="${escapeHtml(this._alarmPanelUi("codePlaceholder", "Code"))}"
                    data-alarm-field="code"
                    value="${escapeHtml(this._codeInput)}"
                  />
                </label>
              `
              : ""
          }

          ${
            actions.length
              ? `
                <div class="alarm-card__actions ${shouldAnimateEntrance ? "alarm-card__actions--entering" : ""}">
                  ${actions.map(action => `
                    <button
                      type="button"
                      class="alarm-card__action ${action.active ? "alarm-card__action--active" : ""}"
                      data-alarm-action="${escapeHtml(action.service)}"
                      aria-label="${escapeHtml(action.label)}"
                    >
                      <ha-icon icon="${escapeHtml(action.icon)}"></ha-icon>
                      ${isCompactLayout ? "" : `<span class="alarm-card__action-label">${escapeHtml(action.label)}</span>`}
                    </button>
                  `).join("")}
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
}
  _lazyNodaliaAlarmPanelCard = NodaliaAlarmPanelCard;
  return NodaliaAlarmPanelCard;
}
