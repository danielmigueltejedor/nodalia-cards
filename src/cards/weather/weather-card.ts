// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import { CARD_TAG, EDITOR_TAG, HAPTIC_PATTERNS } from "./weather-constants";
import {
  clamp,
  deepClone,
  escapeHtml,
  fireEvent,
  normalizeTextKey,
} from "./weather-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./weather-config";
import {
  applyStubEntity,
  formatCompactTemperature,
  formatForecastDateTime,
  formatMeteoalarmDate,
  formatNumber,
  getConditionAccent,
  getConditionIcon,
  getConditionIconMotionClass,
  getConditionReadableIconColor,
  getForecastChartPointColor,
  getForecastIconColor,
  getForecastPrecipitationLabel,
  getForecastTemperatureSeriesValue,
  getForecastTemperatureValue,
  getMeteoalarmAccentColor,
  getMeteoalarmAwarenessParts,
  getMetricReadableIconColor,
  getSupportedForecastTypes,
  isUnavailableState,
  normalizeForecastChartColorMode,
  normalizeForecastType,
  normalizeForecastView,
  normalizeTemperatureUnitFromState,
  normalizeTemperatureUnitPreference,
  normalizeUnitSystem,
  normalizeWindUnitFromState,
  normalizeWindUnitPreference,
  translateCondition,
  translateMeteoalarmValue,
} from "./weather-helpers";

export class NodaliaWeatherCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    return applyStubEntity(deepClone(STUB_CONFIG), hass, ["weather"], entities, entitiesFallback);
  }

  static getEntitySuggestion(hass, entityId) {
    return window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, { domains: ["weather"] });
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._forecastExpanded = false;
    this._activeForecastView = DEFAULT_CONFIG.forecast_view;
    this._activeForecastType = DEFAULT_CONFIG.forecast_type;
    this._forecastEvents = {};
    this._forecastSubscription = null;
    this._forecastSubscriptionKey = "";
    this._animateForecastOnNextRender = false;
    this._meteoalarmPopupOpen = false;
    this._forecastPopup = null;
    this._forecastHoverPreview = null;
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowPointerMove = this._onShadowPointerMove.bind(this);
    this._onShadowPointerLeave = this._onShadowPointerLeave.bind(this);
    this._onWindowKeyDown = event => {
      if (event.key !== "Escape" || !this._meteoalarmPopupOpen) {
        return;
      }
      event.preventDefault();
      this._meteoalarmPopupOpen = false;
      this._lastRenderSignature = "";
      this._render();
    };
    this._detachHostHold = () => {};
    this._suppressNextWeatherTap = false;
  }

  connectedCallback() {
    this._detachHostHold?.();
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const path = event.composedPath();
              if (path.some(node => node instanceof HTMLElement && node.dataset?.weatherAction)) {
                return null;
              }
              return path.some(node => node instanceof HTMLElement && node.dataset?.weatherCard === "root")
                ? "body"
                : null;
            },
            shouldBeginHold: () => {
              const action = String(this._config?.hold_action || "more-info");
              return action !== "none" && Boolean(this._getState());
            },
            onHold: () => {
              this._triggerHaptic();
              this._triggerPressAnimation(this.shadowRoot?.querySelector(".weather-card__content"));
              this._performHoldAction();
            },
            markHoldConsumedClick: () => {
              this._suppressNextWeatherTap = true;
              window.NodaliaUtils?.cancelCardZoneTap?.(this);
            },
          })
        : () => {};
    this.shadowRoot?.addEventListener("click", this._onShadowClick);
    this.shadowRoot?.addEventListener("pointermove", this._onShadowPointerMove);
    this.shadowRoot?.addEventListener("pointerleave", this._onShadowPointerLeave);
    window.addEventListener("keydown", this._onWindowKeyDown);
    this._animateContentOnNextRender = true;
    this._ensureForecastSubscription();
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    window.NodaliaUtils?.releaseModalFocus?.(this);
    this._detachHostHold?.();
    this._detachHostHold = () => {};
    window.NodaliaUtils?.cancelCardZoneTap?.(this);
    this.shadowRoot?.removeEventListener("click", this._onShadowClick);
    this.shadowRoot?.removeEventListener("pointermove", this._onShadowPointerMove);
    this.shadowRoot?.removeEventListener("pointerleave", this._onShadowPointerLeave);
    window.removeEventListener("keydown", this._onWindowKeyDown);
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._unsubscribeForecast();
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
    this._activeForecastType = normalizeForecastType(this._config.forecast_type);
    this._activeForecastView = normalizeForecastView(this._config.forecast_view);
    this._forecastExpanded = this._config.show_forecast_details === true;
    this._forecastEvents = {};
    this._forecastPopup = null;
    this._forecastHoverPreview = null;
    this._unsubscribeForecast();
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._render();
  }

  set hass(hass) {
    const nextSignature = this._getRenderSignature(hass);
    this._hass = hass;

    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }

    this._ensureForecastSubscription();
    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    return this._config?.show_forecast_details === true ? 4 : 2;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 2,
      min_columns: 2,
    };
  }

  _getState() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const attrs = state?.attributes || {};
    const joinParts = window.NodaliaRenderSignature?.joinParts;
    const values = [
      entityId,
      String(state?.state || ""),
      String(attrs.friendly_name || ""),
      String(attrs.icon || ""),
      Number(attrs.temperature ?? -1),
      Number(attrs.humidity ?? -1),
      Number(attrs.pressure ?? -1),
      Number(attrs.wind_speed ?? -1),
      normalizeUnitSystem(this._config?.unit_system),
      normalizeTemperatureUnitPreference(this._config?.temperature_unit),
      normalizeWindUnitPreference(this._config?.wind_speed_unit),
      Number(attrs.wind_bearing ?? -1),
      Number(attrs.visibility ?? -1),
      Number(attrs.precipitation ?? -1),
      this._config?.show_forecast_details === true,
      this._forecastExpanded,
      this._activeForecastView,
      this._activeForecastType,
      this._forecastPopup?.key || "",
      this._forecastHoverPreview?.key || "",
      String(this._forecastEvents?.[this._activeForecastType]?.forecast?.[0]?.datetime || ""),
      this._getMeteoalarmSignature(hass),
      this._meteoalarmPopupOpen,
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "weather:", values }]);
    }
    return values.join("::");
  }

  _getMeteoalarmState(hass = this._hass) {
    const entityId = String(this._config?.meteoalarm_entity || "").trim();
    return entityId ? hass?.states?.[entityId] || null : null;
  }

  _getMeteoalarmSignature(hass = this._hass) {
    if (this._config?.show_meteoalarm_chip !== true) {
      return "";
    }

    const state = this._getMeteoalarmState(hass);
    const attrs = state?.attributes || {};
    return [
      String(this._config?.meteoalarm_entity || ""),
      String(state?.state || ""),
      String(attrs.awareness_level || ""),
      String(attrs.awareness_type || ""),
      String(attrs.event || ""),
      String(attrs.expires || ""),
      String(attrs.headline || ""),
      String(attrs.severity || ""),
    ].join("|");
  }

  _unsubscribeForecast() {
    if (!this._forecastSubscription) {
      return;
    }

    this._forecastSubscription.then(unsubscribe => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    }).catch(() => {});
    this._forecastSubscription = null;
    this._forecastSubscriptionKey = "";
  }

  _ensureForecastSubscription() {
    if (!this.isConnected || !this._hass || !this._config?.entity || this._config.show_forecast_details !== true) {
      this._unsubscribeForecast();
      return;
    }

    const state = this._hass.states?.[this._config.entity];
    if (!state) {
      this._unsubscribeForecast();
      return;
    }

    const supportedTypes = getSupportedForecastTypes(state);
    const forecastType = supportedTypes.includes(this._activeForecastType)
      ? this._activeForecastType
      : supportedTypes[0] || "daily";
    if (forecastType !== this._activeForecastType) {
      this._activeForecastType = forecastType;
    }

    const subscriptionKey = `${this._config.entity}:${forecastType}`;
    if (subscriptionKey === this._forecastSubscriptionKey && this._forecastSubscription) {
      return;
    }

    this._unsubscribeForecast();
    if (!this._hass.connection?.subscribeMessage) {
      return;
    }

    this._forecastSubscriptionKey = subscriptionKey;
    this._forecastSubscription = this._hass.connection.subscribeMessage(event => {
      if (!this.isConnected) {
        return;
      }
      this._forecastEvents = {
        ...this._forecastEvents,
        [forecastType]: event,
      };
      this._animateForecastOnNextRender = true;
      this._lastRenderSignature = "";
      this._render();
    }, {
      type: "weather/subscribe_forecast",
      entity_id: this._config.entity,
      forecast_type: forecastType,
    }).catch(() => {
      this._forecastSubscription = null;
      this._forecastSubscriptionKey = "";
    });
  }

  _getTitle(state) {
    const customName = String(this._config?.name || "").trim();
    if (customName) {
      return customName;
    }

    const friendlyName = String(state?.attributes?.friendly_name || "").trim();
    return friendlyName || "Weather";
  }

  _getIcon(state) {
    const customIcon = String(this._config?.icon || "").trim();
    if (customIcon) {
      return customIcon;
    }

    return getConditionIcon(state?.state);
  }

  _getAccentColor(state) {
    return getConditionAccent(state?.state);
  }

  _formatTemperature(state) {
    const prefs = this._getUnitPreferences(state);
    const converted = this._convertTemperatureValue(
      state?.attributes?.temperature,
      prefs.sourceTemperatureUnit,
      prefs.targetTemperatureUnit,
    );
    const value = formatNumber(converted);
    if (!value) {
      return "--";
    }
    return `${value}${this._temperatureUnitLabel(prefs.targetTemperatureUnit)}`;
  }

  _formatHumidity(state) {
    const value = formatNumber(state?.attributes?.humidity);
    return value ? `${value}%` : null;
  }

  _formatWind(state) {
    const prefs = this._getUnitPreferences(state);
    const converted = this._convertWindSpeedValue(
      state?.attributes?.wind_speed,
      prefs.sourceWindUnit,
      prefs.targetWindUnit,
    );
    const value = formatNumber(converted);
    if (!value) {
      return null;
    }
    return `${value} ${this._windUnitLabel(prefs.targetWindUnit)}`;
  }

  _formatPressure(state) {
    const value = formatNumber(state?.attributes?.pressure);
    const unit = String(state?.attributes?.pressure_unit || "").trim();

    if (!value) {
      return null;
    }

    return unit ? `${value} ${unit}` : value;
  }

  _getUnitPreferences(state) {
    const attrs = state?.attributes || {};
    const unitSystem = normalizeUnitSystem(this._config?.unit_system);
    let temperaturePreference = normalizeTemperatureUnitPreference(this._config?.temperature_unit);
    let windPreference = normalizeWindUnitPreference(this._config?.wind_speed_unit);
    if (temperaturePreference === "auto" && unitSystem !== "auto") {
      temperaturePreference = unitSystem === "imperial" ? "f" : "c";
    }
    if (windPreference === "auto" && unitSystem !== "auto") {
      windPreference = unitSystem === "imperial" ? "mph" : "kmh";
    }
    const sourceTemperatureUnit = normalizeTemperatureUnitFromState(attrs.temperature_unit);
    const sourceWindUnit = normalizeWindUnitFromState(attrs.wind_speed_unit);
    return {
      sourceTemperatureUnit,
      sourceWindUnit,
      targetTemperatureUnit: temperaturePreference === "auto" ? sourceTemperatureUnit : temperaturePreference,
      targetWindUnit: windPreference === "auto"
        ? (sourceWindUnit === "ms" ? "kmh" : sourceWindUnit)
        : windPreference,
    };
  }

  _temperatureUnitLabel(unit) {
    return unit === "f" ? "°F" : "°C";
  }

  _windUnitLabel(unit) {
    return unit === "mph" ? "mph" : "km/h";
  }

  _convertTemperatureValue(value, fromUnit, toUnit) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    if (fromUnit === toUnit) {
      return numeric;
    }
    if (fromUnit === "f" && toUnit === "c") {
      return (numeric - 32) * (5 / 9);
    }
    if (fromUnit === "c" && toUnit === "f") {
      return (numeric * (9 / 5)) + 32;
    }
    return numeric;
  }

  _convertWindSpeedValue(value, fromUnit, toUnit) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    if (fromUnit === toUnit) {
      return numeric;
    }
    let kmh = numeric;
    if (fromUnit === "mph") {
      kmh = numeric * 1.609344;
    } else if (fromUnit === "ms") {
      kmh = numeric * 3.6;
    }
    if (toUnit === "mph") {
      return kmh * 0.621371192;
    }
    return kmh;
  }

  _formatForecastTemperature(item, type, targetTemperatureUnit) {
    const sourceUnit = normalizeTemperatureUnitFromState(this._getState()?.attributes?.temperature_unit);
    const high = formatNumber(this._convertTemperatureValue(
      getForecastTemperatureSeriesValue(item, "high"),
      sourceUnit,
      targetTemperatureUnit,
    ));
    const low = formatNumber(this._convertTemperatureValue(
      getForecastTemperatureSeriesValue(item, "low"),
      sourceUnit,
      targetTemperatureUnit,
    ));
    if (!high) {
      return "--";
    }
    const unitLabel = this._temperatureUnitLabel(targetTemperatureUnit);
    if (type === "daily" && low) {
      return `${high}${unitLabel} / ${low}${unitLabel}`;
    }
    return `${high}${unitLabel}`;
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
      iconAnimation: configuredAnimations.icon_animation !== false,
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

  _performWeatherCardAction(actionKind) {
    const key = actionKind === "hold"
      ? "hold_action"
      : actionKind === "double_tap"
        ? "double_tap_action"
        : "tap_action";
    const action = String(this._config?.[key] || "more-info");
    if (action === "none") {
      return;
    }

    this._triggerHaptic();

    if (action === "more-info") {
      fireEvent(this, "hass-more-info", {
        entityId: this._config.entity,
      });
    }
  }

  _performTapAction() {
    this._performWeatherCardAction("tap");
  }

  _performHoldAction() {
    this._performWeatherCardAction("hold");
  }

  _performDoubleTapAction() {
    this._performWeatherCardAction("double_tap");
  }

  _getForecastPointOverlayPosition(actionButton, width, height) {
    const chartElement = actionButton.closest?.(".weather-card__forecast-chart");
    const pointElement = actionButton.querySelector?.(".weather-card__forecast-chart-point");
    const bounds = (pointElement instanceof Element ? pointElement : actionButton).getBoundingClientRect();
    const chartBounds = chartElement instanceof Element
      ? chartElement.getBoundingClientRect()
      : { left: 0, top: 0, width: width + 24, height: height + 24 };
    const pointerX = bounds.left + (bounds.width / 2) - chartBounds.left;
    const pointerY = bounds.top + (bounds.height / 2) - chartBounds.top;
    const safeHalfWidth = Math.min(width / 2, Math.max(chartBounds.width / 2 - 10, 0));
    const left = clamp(pointerX, safeHalfWidth + 10, Math.max(safeHalfWidth + 10, chartBounds.width - safeHalfWidth - 10));
    const vertical = pointerY < Math.min(height + 12, 58) ? "below" : "above";
    const top = vertical === "below"
      ? pointerY + 14
      : pointerY - 14;

    return {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      vertical,
    };
  }

  _setForecastPopupFromPoint(actionButton, options = {}) {
    if (!(actionButton instanceof Element)) {
      return;
    }

    const forecastType = normalizeForecastType(actionButton.dataset.forecastType);
    const series = String(actionButton.dataset.forecastSeries || "high");
    const index = Number(actionButton.dataset.forecastIndex);
    const key = `${forecastType}:${series}:${index}`;
    const shouldToggle = options.toggle === true;

    if (!shouldToggle && this._forecastPopup?.key === key) {
      return;
    }

    if (shouldToggle && this._forecastPopup?.key === key) {
      this._forecastPopup = null;
      this._forecastHoverPreview = null;
      this._lastRenderSignature = "";
      this._render();
      return;
    }

    const popupWidth = 206;
    const popupHeight = forecastType === "daily" ? 194 : 166;
    const position = this._getForecastPointOverlayPosition(actionButton, popupWidth, popupHeight);

    this._forecastPopup = {
      key,
      forecastType,
      index,
      left: position.left,
      series,
      top: position.top,
      vertical: position.vertical,
    };
    this._forecastHoverPreview = null;
    this._lastRenderSignature = "";
    this._render();
  }

  _setForecastHoverPreviewFromPoint(actionButton) {
    if (!(actionButton instanceof Element) || this._forecastPopup) {
      return;
    }

    const forecastType = normalizeForecastType(actionButton.dataset.forecastType);
    const series = String(actionButton.dataset.forecastSeries || "high");
    const index = Number(actionButton.dataset.forecastIndex);
    const key = `${forecastType}:${series}:${index}`;
    if (this._forecastHoverPreview?.key === key) {
      return;
    }

    const previewWidth = forecastType === "daily" ? 190 : 168;
    const position = this._getForecastPointOverlayPosition(actionButton, previewWidth, 48);
    this._forecastHoverPreview = {
      key,
      forecastType,
      index,
      left: position.left,
      series,
      top: position.top,
      vertical: position.vertical,
    };
    this._lastRenderSignature = "";
    this._render();
  }

  _clearForecastHoverPreview() {
    if (!this._forecastHoverPreview) {
      return;
    }

    this._forecastHoverPreview = null;
    this._lastRenderSignature = "";
    this._render();
  }

  _onShadowPointerMove(event) {
    if (event.pointerType && event.pointerType !== "mouse") {
      return;
    }

    const actionButton = event.composedPath().find(node => (
      node instanceof Element && node.dataset?.weatherAction === "open-forecast-point"
    ));
    if (!actionButton) {
      this._clearForecastHoverPreview();
      return;
    }

    this._setForecastHoverPreviewFromPoint(actionButton);
  }

  _onShadowPointerLeave() {
    this._clearForecastHoverPreview();
  }

  _onShadowClick(event) {
    const actionButton = event.composedPath().find(node => node instanceof Element && node.dataset?.weatherAction);
    if (actionButton) {
      event.preventDefault();
      event.stopPropagation();

      if (actionButton.dataset.weatherAction === "noop") {
        return;
      }

      this._triggerHaptic("selection");

      if (actionButton.dataset.weatherAction === "toggle-forecast") {
        this._forecastExpanded = !this._forecastExpanded;
        this._forecastHoverPreview = null;
        this._ensureForecastSubscription();
        this._lastRenderSignature = "";
        this._render();
      } else if (actionButton.dataset.weatherAction === "set-forecast-type") {
        this._activeForecastType = normalizeForecastType(actionButton.dataset.forecastType);
        this._animateForecastOnNextRender = true;
        this._forecastPopup = null;
        this._forecastHoverPreview = null;
        this._ensureForecastSubscription();
        this._lastRenderSignature = "";
        this._render();
      } else if (actionButton.dataset.weatherAction === "set-forecast-view") {
        this._activeForecastView = normalizeForecastView(actionButton.dataset.forecastView);
        this._animateForecastOnNextRender = true;
        this._forecastPopup = null;
        this._forecastHoverPreview = null;
        this._lastRenderSignature = "";
        this._render();
      } else if (actionButton.dataset.weatherAction === "open-forecast-point") {
        this._setForecastPopupFromPoint(actionButton, { toggle: true });
      } else if (actionButton.dataset.weatherAction === "close-forecast-popup") {
        this._forecastPopup = null;
        this._forecastHoverPreview = null;
        this._lastRenderSignature = "";
        this._render();
      } else if (actionButton.dataset.weatherAction === "open-meteoalarm") {
        this._meteoalarmPopupOpen = true;
        this._lastRenderSignature = "";
        this._render();
      } else if (actionButton.dataset.weatherAction === "close-meteoalarm") {
        this._meteoalarmPopupOpen = false;
        this._lastRenderSignature = "";
        this._render();
      }
      return;
    }

    const card = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.weatherCard === "root");
    if (!card) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (this._suppressNextWeatherTap) {
      this._suppressNextWeatherTap = false;
      return;
    }

    const tapAction = String(this._config?.tap_action || "more-info");
    const doubleAction = String(this._config?.double_tap_action || "none");
    const runTap = () => {
      if (tapAction === "none") {
        return;
      }
      this._triggerPressAnimation(this.shadowRoot.querySelector(".weather-card__content"));
      this._triggerPressAnimation(this.shadowRoot.querySelector(".weather-card__icon"));
      this._performTapAction();
    };
    const runDouble = () => {
      if (doubleAction === "none") {
        return;
      }
      this._triggerPressAnimation(this.shadowRoot.querySelector(".weather-card__content"));
      this._triggerPressAnimation(this.shadowRoot.querySelector(".weather-card__icon"));
      this._performDoubleTapAction();
    };

    if (doubleAction !== "none" && typeof window.NodaliaUtils?.scheduleCardZoneTap === "function") {
      window.NodaliaUtils.scheduleCardZoneTap(this, {
        zone: "body",
        onSingle: runTap,
        onDouble: runDouble,
      });
      return;
    }

    runTap();
  }

  _renderChip(icon, label, accentColor, iconColor = getMetricReadableIconColor(accentColor)) {
    if (!label) {
      return "";
    }

    return `
      <div class="weather-card__chip" style="--chip-accent:${escapeHtml(accentColor)}; --chip-icon-color:${escapeHtml(iconColor)};">
        <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
        <span>${escapeHtml(label)}</span>
      </div>
    `;
  }

  _renderMeteoalarmChip() {
    if (this._config?.show_meteoalarm_chip !== true) {
      return "";
    }

    const state = this._getMeteoalarmState();
    const attrs = state?.attributes || {};
    const accentColor = getMeteoalarmAccentColor(state);
    const isActive = state?.state === "on";
    const awareness = getMeteoalarmAwarenessParts(state);
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const langCfg = this._config?.language ?? "auto";
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, langCfg) ?? "en";
    const wm = window.NodaliaI18n?.strings?.(lang)?.weatherCard?.meteoalarm;
    const ev = String(attrs.event || "").trim();
    const headline = String(attrs.headline || "").trim();
    const awareLabel = String(awareness.label || "").trim();
    const label = !isActive
      ? state?.state === "off"
        ? (wm?.noAlerts || "No alerts")
        : (wm?.name || "Meteoalarm")
      : ev
        ? ev
        : headline
          ? headline
          : awareLabel
            ? translateMeteoalarmValue(awareLabel, hass, langCfg)
            : (wm?.alertFallback || "Alert");

    return `
      <button
        type="button"
        class="weather-card__chip weather-card__chip--button weather-card__chip--meteoalarm ${isActive ? "weather-card__chip--alert-active" : ""}"
        style="--chip-accent:${escapeHtml(accentColor)};"
        data-weather-action="open-meteoalarm"
        title="${escapeHtml(label)}"
      >
        <ha-icon icon="${isActive ? "mdi:alert" : "mdi:shield-check"}"></ha-icon>
        <span>${escapeHtml(label)}</span>
      </button>
    `;
  }

  _renderMeteoalarmChipRow(shouldAnimateEntrance) {
    const chipMarkup = this._renderMeteoalarmChip();
    if (!chipMarkup) {
      return "";
    }

    return `<div class="weather-card__alert-row ${shouldAnimateEntrance ? "weather-card__alert-row--entering" : ""}">${chipMarkup}</div>`;
  }

  _renderMeteoalarmPopup() {
    if (!this._meteoalarmPopupOpen || this._config?.show_meteoalarm_chip !== true) {
      return "";
    }

    const state = this._getMeteoalarmState();
    const attrs = state?.attributes || {};
    const accentColor = getMeteoalarmAccentColor(state);
    const awareness = getMeteoalarmAwarenessParts(state);
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const langCfg = this._config?.language ?? "auto";
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, langCfg) ?? "en";
    const wm = window.NodaliaI18n?.strings?.(lang)?.weatherCard?.meteoalarm;
    const title = state?.state === "on"
      ? String(attrs.headline || attrs.event || wm?.weatherAlert || "Weather alert").trim()
      : state?.state === "off"
        ? (wm?.noWeatherAlerts || "No weather alerts")
        : (wm?.name || "Meteoalarm");
    const rows = [
      [wm?.level || "Level", translateMeteoalarmValue(awareness.label || attrs.severity || "", hass, langCfg)],
      [wm?.type || "Type", attrs.event || attrs.awareness_type || ""],
      [wm?.start || "Start", formatMeteoalarmDate(attrs.onset || attrs.effective, hass, langCfg)],
      [wm?.end || "End", formatMeteoalarmDate(attrs.expires, hass, langCfg)],
      [wm?.severity || "Severity", translateMeteoalarmValue(attrs.severity || "", hass, langCfg)],
      [wm?.urgency || "Urgency", translateMeteoalarmValue(attrs.urgency || "", hass, langCfg)],
      [wm?.certainty || "Certainty", translateMeteoalarmValue(attrs.certainty || "", hass, langCfg)],
    ].filter(([, value]) => String(value || "").trim());
    const description = String(attrs.description || "").trim();
    const instruction = String(attrs.instruction || "").trim();

    return `
      <div class="weather-alert-backdrop" data-weather-action="close-meteoalarm">
        <section class="weather-alert-panel" style="--alert-accent:${escapeHtml(accentColor)};" data-weather-action="noop" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
          <div class="weather-alert-panel__header">
            <div class="weather-alert-panel__icon">
              <ha-icon icon="${state?.state === "on" ? "mdi:alert" : "mdi:shield-check"}"></ha-icon>
            </div>
            <div class="weather-alert-panel__copy">
              <div class="weather-alert-panel__eyebrow">${escapeHtml(wm?.name || "Meteoalarm")}</div>
              <div class="weather-alert-panel__title">${escapeHtml(title)}</div>
            </div>
            <button type="button" class="weather-alert-panel__close" data-weather-action="close-meteoalarm" aria-label="${escapeHtml(wm?.close || "Close")}">
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          ${
            rows.length
              ? `<div class="weather-alert-panel__rows">${rows.map(([label, value]) => `
                <div class="weather-alert-panel__row">
                  <span>${escapeHtml(label)}</span>
                  <strong>${escapeHtml(value)}</strong>
                </div>
              `).join("")}</div>`
              : ""
          }
          ${description ? `<div class="weather-alert-panel__section"><h3>${escapeHtml(wm?.descriptionTitle || "Descripcion")}</h3><p>${escapeHtml(description)}</p></div>` : ""}
          ${instruction ? `<div class="weather-alert-panel__section"><h3>${escapeHtml(wm?.instructionsTitle || "Instrucciones")}</h3><p>${escapeHtml(instruction)}</p></div>` : ""}
        </section>
      </div>
    `;
  }

  _getForecastItems(type, state) {
    const eventForecast = this._forecastEvents?.[type]?.forecast;
    if (Array.isArray(eventForecast) && eventForecast.length) {
      return eventForecast;
    }

    const legacyForecast = state?.attributes?.forecast;
    return Array.isArray(legacyForecast) ? legacyForecast : [];
  }

  _renderForecastChart(items, type, state, forecastLocale = undefined, unitPrefs = null) {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const cfgLang = this._config?.language ?? "auto";
    const wf = key => (window.NodaliaI18n?.translateWeatherForecastUi
      ? window.NodaliaI18n.translateWeatherForecastUi(hass, cfgLang, key)
      : "");

    const sourcePoints = items
      .map((item, index) => ({ index, item }))
      .filter(point => Number.isFinite(getForecastTemperatureValue(point.item, type)));

    if (sourcePoints.length < 2) {
      const emptyChart = wf("chartInsufficientData") || "Not enough data to display the chart.";
      return `<div class="weather-card__forecast-empty">${escapeHtml(emptyChart)}</div>`;
    }

    const hasDailyLow = type === "daily" && sourcePoints.some(point => Number.isFinite(Number(point.item?.templow)));
    const rawHighPoints = sourcePoints.map(point => ({
      ...point,
      value: getForecastTemperatureSeriesValue(point.item, "high"),
    })).filter(point => Number.isFinite(point.value));
    const rawLowPoints = hasDailyLow
      ? sourcePoints.map(point => ({
        ...point,
        value: getForecastTemperatureSeriesValue(point.item, "low"),
      })).filter(point => Number.isFinite(point.value))
      : [];
    const highPoints = rawHighPoints.length >= 2 ? rawHighPoints : rawLowPoints;
    const lowPoints = rawHighPoints.length >= 2 ? rawLowPoints : [];

    if (highPoints.length < 2) {
      const emptyChart = wf("chartInsufficientData") || "Not enough data to display the chart.";
      return `<div class="weather-card__forecast-empty">${escapeHtml(emptyChart)}</div>`;
    }

    const showChartLabels = this._config?.forecast_chart_labels === true;
    const values = [...highPoints, ...lowPoints].map(point => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = Math.max(maxValue - minValue, 1);
    const width = showChartLabels ? 640 : 820;
    const height = showChartLabels ? 150 : 102;
    const padding = showChartLabels
      ? { top: 24, right: 16, bottom: 56, left: 16 }
      : { top: 12, right: 5, bottom: 12, left: 5 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const dateLabelY = height - 10;
    const lowLabelY = dateLabelY - 18;

    const getCoordinates = points => points.map((point, pointIndex) => {
      const x = padding.left + (points.length === 1 ? plotWidth / 2 : (plotWidth * pointIndex) / (points.length - 1));
      const y = padding.top + plotHeight - ((point.value - minValue) / valueRange) * plotHeight;
      return {
        ...point,
        x,
        y,
      };
    });

    const highCoordinates = getCoordinates(highPoints);
    const lowCoordinates = getCoordinates(lowPoints);
    const pathFromCoordinates = coordinates => coordinates
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(" ");
    const smoothPathFromCoordinates = coordinates => {
      if (coordinates.length < 3) {
        return pathFromCoordinates(coordinates);
      }

      return coordinates.reduce((path, point, index) => {
        if (index === 0) {
          return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
        }

        const previous = coordinates[index - 1];
        const controlOffset = Math.max(18, Math.min(54, (point.x - previous.x) * 0.42));
        return `${path} C ${(previous.x + controlOffset).toFixed(1)} ${previous.y.toFixed(1)} ${(point.x - controlOffset).toFixed(1)} ${point.y.toFixed(1)} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      }, "");
    };
    const highPath = smoothPathFromCoordinates(highCoordinates);
    const lowPath = smoothPathFromCoordinates(lowCoordinates);
    const areaPath = `${highPath} L ${highCoordinates[highCoordinates.length - 1].x.toFixed(1)} ${height - padding.bottom} L ${highCoordinates[0].x.toFixed(1)} ${height - padding.bottom} Z`;
    const lowAreaPath = lowPath
      ? `${lowPath} L ${lowCoordinates[lowCoordinates.length - 1].x.toFixed(1)} ${height - padding.bottom} L ${lowCoordinates[0].x.toFixed(1)} ${height - padding.bottom} Z`
      : "";
    const chartAccent = getConditionAccent(state?.state);
    const chartFillId = `weather-chart-fill-${type}`;
    const colorChartEnabled = this._config?.forecast_chart_color_enabled === true;
    const colorChartMode = normalizeForecastChartColorMode(this._config?.forecast_chart_color_mode);
    const highGradientId = `weather-chart-line-${type}-high`;
    const lowGradientId = `weather-chart-line-${type}-low`;
    const lowFillId = `weather-chart-fill-${type}-low`;
    const highFillMaskId = `weather-chart-fill-mask-${type}-high`;
    const lowFillMaskId = `weather-chart-fill-mask-${type}-low`;
    const prefs = unitPrefs || this._getUnitPreferences(state);
    const unitLabel = this._temperatureUnitLabel(prefs.targetTemperatureUnit);
    const precipitationUnit = String(state?.attributes?.precipitation_unit || "").trim();
    const allCoordinates = [
      ...highCoordinates.map(point => ({ ...point, series: "high" })),
      ...lowCoordinates.map(point => ({ ...point, series: "low" })),
    ];
    const renderGradientStops = (coordinates, opacity = "") => coordinates.map((point, index) => {
      const offset = coordinates.length <= 1 ? 0 : (index / (coordinates.length - 1)) * 100;
      const color = getForecastChartPointColor(point, colorChartMode, state?.state);
      return `<stop offset="${offset.toFixed(2)}%" stop-color="${escapeHtml(color)}"${opacity ? ` stop-opacity="${opacity}"` : ""}></stop>`;
    }).join("");
    const popupPoint = allCoordinates.find(point => (
      this._forecastPopup?.forecastType === type
      && this._forecastPopup?.series === point.series
      && this._forecastPopup?.index === point.index
    ));
    const hoverPreviewPoint = allCoordinates.find(point => (
      this._forecastHoverPreview?.forecastType === type
      && this._forecastHoverPreview?.series === point.series
      && this._forecastHoverPreview?.index === point.index
    ));
    const popupMarkup = popupPoint ? (() => {
      const item = popupPoint.item || {};
      const conditionValue = item?.condition || state?.state;
      const accent = getConditionAccent(conditionValue);
      const iconColor = getForecastIconColor(accent, conditionValue);
      const precipitationLabel = getForecastPrecipitationLabel(item, precipitationUnit);
      const highLabel = formatNumber(this._convertTemperatureValue(
        getForecastTemperatureSeriesValue(item, "high"),
        prefs.sourceTemperatureUnit,
        prefs.targetTemperatureUnit,
      ));
      const lowLabel = formatNumber(this._convertTemperatureValue(
        getForecastTemperatureSeriesValue(item, "low"),
        prefs.sourceTemperatureUnit,
        prefs.targetTemperatureUnit,
      ));
      const humidityLabel = formatNumber(item?.humidity);
      const windLabel = formatNumber(this._convertWindSpeedValue(
        item?.wind_speed,
        normalizeWindUnitFromState(state?.attributes?.wind_speed_unit || item?.wind_speed_unit || ""),
        prefs.targetWindUnit,
      ));
      const windUnit = this._windUnitLabel(prefs.targetWindUnit);
      const popupRows = [
        type === "daily" && highLabel ? [wf("maxLabel") || "High", `${highLabel}${unitLabel}`] : null,
        type === "daily" && lowLabel ? [wf("minLabel") || "Low", `${lowLabel}${unitLabel}`] : null,
        type !== "daily"
          ? [wf("temperatureLabel") || "Temperature", `${formatNumber(this._convertTemperatureValue(popupPoint.value, prefs.sourceTemperatureUnit, prefs.targetTemperatureUnit))}${unitLabel}`]
          : null,
        precipitationLabel ? [wf("rainLabel") || "Rain", precipitationLabel] : null,
        humidityLabel ? [wf("humidityLabel") || "Humidity", `${humidityLabel}%`] : null,
        windLabel ? [wf("windLabel") || "Wind", windUnit ? `${windLabel} ${windUnit}` : windLabel] : null,
      ].filter(Boolean);
      const vertical = this._forecastPopup?.vertical === "below" ? "below" : "above";
      const popupLeft = this._forecastPopup?.left || "50%";
      const popupTop = this._forecastPopup?.top || "50%";

      return `
        <div
          class="weather-card__forecast-popup weather-card__forecast-popup--${vertical}"
          style="--forecast-accent:${escapeHtml(accent)}; --forecast-icon-color:${escapeHtml(iconColor)}; --forecast-popup-left:${escapeHtml(popupLeft)}; --forecast-popup-top:${escapeHtml(popupTop)};"
          data-weather-action="noop"
        >
          <button type="button" class="weather-card__forecast-popup-close" data-weather-action="close-forecast-popup" aria-label="${escapeHtml(wf("closeDetail") || "Close detail")}">
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
          <div class="weather-card__forecast-popup-time">${escapeHtml(formatForecastDateTime(item?.datetime, type, forecastLocale))}</div>
          <div class="weather-card__forecast-popup-main">
            <ha-icon icon="${escapeHtml(getConditionIcon(item?.condition || state?.state))}"></ha-icon>
            <span>${escapeHtml(translateCondition(item?.condition || "", this._hass, this._config?.language ?? "auto"))}</span>
          </div>
          <div class="weather-card__forecast-popup-rows">
            ${popupRows.map(([label, value]) => `
              <div>
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    })() : "";
    const hoverPreviewMarkup = hoverPreviewPoint ? (() => {
      const item = hoverPreviewPoint.item || {};
      const conditionValue = item?.condition || state?.state;
      const accent = getConditionAccent(conditionValue);
      const iconColor = getForecastIconColor(accent, conditionValue);
      const vertical = this._forecastHoverPreview?.vertical === "below" ? "below" : "above";
      const left = this._forecastHoverPreview?.left || "50%";
      const top = this._forecastHoverPreview?.top || "50%";
      const highValue = getForecastTemperatureSeriesValue(item, "high");
      const lowValue = getForecastTemperatureSeriesValue(item, "low");
      const convertedHigh = this._convertTemperatureValue(highValue, prefs.sourceTemperatureUnit, prefs.targetTemperatureUnit);
      const convertedLow = this._convertTemperatureValue(lowValue, prefs.sourceTemperatureUnit, prefs.targetTemperatureUnit);
      const convertedHover = this._convertTemperatureValue(hoverPreviewPoint.value, prefs.sourceTemperatureUnit, prefs.targetTemperatureUnit);
      const temperatureLabel = type === "daily" && Number.isFinite(convertedHigh) && Number.isFinite(convertedLow)
        ? `${formatCompactTemperature(convertedHigh, unitLabel)} / ${formatCompactTemperature(convertedLow, unitLabel)}`
        : formatCompactTemperature(convertedHover, unitLabel);

      return `
        <div
          class="weather-card__forecast-hover-preview weather-card__forecast-hover-preview--${vertical}"
          style="--forecast-accent:${escapeHtml(accent)}; --forecast-icon-color:${escapeHtml(iconColor)}; --forecast-preview-left:${escapeHtml(left)}; --forecast-preview-top:${escapeHtml(top)};"
          data-weather-action="noop"
        >
          <ha-icon icon="${escapeHtml(getConditionIcon(item?.condition || state?.state))}"></ha-icon>
          <span>${escapeHtml(formatForecastDateTime(item?.datetime, type, forecastLocale))}</span>
          ${temperatureLabel ? `<strong>${escapeHtml(temperatureLabel)}</strong>` : ""}
        </div>
      `;
    })() : "";

    return `
      <div class="weather-card__forecast-chart" style="--forecast-chart-height:${height + 8}px; --forecast-chart-svg-height:${height}px;" role="img" aria-label="${escapeHtml(type === "hourly" ? (wf("chartAriaHourly") || "Hourly forecast chart") : (wf("chartAriaDaily") || "Weekly forecast chart"))}">
        <svg viewBox="0 0 ${width} ${height}">
          <defs>
            ${
              colorChartEnabled
                ? `<linearGradient id="${chartFillId}" x1="0" x2="1" y1="0" y2="0">
                    ${renderGradientStops(highCoordinates, "0.2")}
                  </linearGradient>`
                : `<linearGradient id="${chartFillId}" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="${escapeHtml(chartAccent)}" stop-opacity="0.26"></stop>
                    <stop offset="58%" stop-color="${escapeHtml(chartAccent)}" stop-opacity="0.11"></stop>
                    <stop offset="100%" stop-color="${escapeHtml(chartAccent)}" stop-opacity="0"></stop>
                  </linearGradient>`
            }
            ${colorChartEnabled ? `
              <linearGradient id="${highFillMaskId}-fade" gradientUnits="userSpaceOnUse" x1="0" y1="${padding.top}" x2="0" y2="${height - padding.bottom}">
                <stop offset="0%" stop-color="#fff" stop-opacity="0.86"></stop>
                <stop offset="34%" stop-color="#fff" stop-opacity="0.34"></stop>
                <stop offset="70%" stop-color="#fff" stop-opacity="0.08"></stop>
                <stop offset="100%" stop-color="#fff" stop-opacity="0"></stop>
              </linearGradient>
              <mask id="${highFillMaskId}" x="0" y="0" width="${width}" height="${height}" maskUnits="userSpaceOnUse">
                <rect x="0" y="0" width="${width}" height="${height}" fill="url(#${highFillMaskId}-fade)"></rect>
              </mask>
              <linearGradient id="${highGradientId}" x1="0" x2="1" y1="0" y2="0">
                ${renderGradientStops(highCoordinates)}
              </linearGradient>
              ${lowCoordinates.length ? `
                <linearGradient id="${lowFillMaskId}-fade" gradientUnits="userSpaceOnUse" x1="0" y1="${padding.top}" x2="0" y2="${height - padding.bottom}">
                  <stop offset="0%" stop-color="#fff" stop-opacity="0.86"></stop>
                  <stop offset="34%" stop-color="#fff" stop-opacity="0.34"></stop>
                  <stop offset="70%" stop-color="#fff" stop-opacity="0.08"></stop>
                  <stop offset="100%" stop-color="#fff" stop-opacity="0"></stop>
                </linearGradient>
                <mask id="${lowFillMaskId}" x="0" y="0" width="${width}" height="${height}" maskUnits="userSpaceOnUse">
                  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#${lowFillMaskId}-fade)"></rect>
                </mask>
                <linearGradient id="${lowGradientId}" x1="0" x2="1" y1="0" y2="0">
                  ${renderGradientStops(lowCoordinates)}
                </linearGradient>
                <linearGradient id="${lowFillId}" x1="0" x2="1" y1="0" y2="0">
                  ${renderGradientStops(lowCoordinates, "0.2")}
                </linearGradient>
              ` : ""}
            ` : ""}
          </defs>
          <path class="weather-card__forecast-chart-area" style="fill:url(#${chartFillId});" ${colorChartEnabled ? `mask="url(#${highFillMaskId})"` : ""} d="${areaPath}"></path>
          ${colorChartEnabled && lowAreaPath ? `<path class="weather-card__forecast-chart-area weather-card__forecast-chart-area--low" style="fill:url(#${lowFillId});" mask="url(#${lowFillMaskId})" d="${lowAreaPath}"></path>` : ""}
          ${lowPath ? `<path class="weather-card__forecast-chart-line weather-card__forecast-chart-line--low" style="${colorChartEnabled ? `stroke:url(#${lowGradientId});` : ""}" pathLength="1" d="${lowPath}"></path>` : ""}
          <path class="weather-card__forecast-chart-line weather-card__forecast-chart-line--high" style="${colorChartEnabled ? `stroke:url(#${highGradientId});` : ""}" pathLength="1" d="${highPath}"></path>
          ${highCoordinates.map((point, coordinateIndex) => `
            <g class="weather-card__forecast-chart-hit" data-weather-action="open-forecast-point" data-forecast-type="${escapeHtml(type)}" data-forecast-series="high" data-forecast-index="${point.index}" role="button" tabindex="0" aria-label="${escapeHtml(formatForecastDateTime(point.item?.datetime, type, forecastLocale))}: ${escapeHtml(formatNumber(this._convertTemperatureValue(point.value, prefs.sourceTemperatureUnit, prefs.targetTemperatureUnit)))}${escapeHtml(unitLabel)}">
              <circle class="weather-card__forecast-chart-touch" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="22"></circle>
              <circle class="weather-card__forecast-chart-point weather-card__forecast-chart-point--high" style="--forecast-delay:${Math.min(point.index, 8) * 34}ms; ${colorChartEnabled ? `--forecast-point-color:${escapeHtml(getForecastChartPointColor(point, colorChartMode, state?.state))};` : ""}" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="5.7"></circle>
              ${showChartLabels ? `<text class="weather-card__forecast-chart-value" x="${point.x.toFixed(1)}" y="${Math.max(13, point.y - 14).toFixed(1)}">${escapeHtml(formatNumber(this._convertTemperatureValue(point.value, prefs.sourceTemperatureUnit, prefs.targetTemperatureUnit)))}${escapeHtml(unitLabel)}</text>` : ""}
              ${showChartLabels && (coordinateIndex === 0 || coordinateIndex === highCoordinates.length - 1)
                ? `<text class="weather-card__forecast-chart-label" x="${point.x.toFixed(1)}" y="${dateLabelY}">${escapeHtml(formatForecastDateTime(point.item?.datetime, type, forecastLocale))}</text>`
                : ""}
            </g>
          `).join("")}
          ${lowCoordinates.map(point => `
            <g class="weather-card__forecast-chart-hit" data-weather-action="open-forecast-point" data-forecast-type="${escapeHtml(type)}" data-forecast-series="low" data-forecast-index="${point.index}" role="button" tabindex="0" aria-label="${escapeHtml(formatForecastDateTime(point.item?.datetime, type, forecastLocale))}: ${escapeHtml(formatNumber(this._convertTemperatureValue(point.value, prefs.sourceTemperatureUnit, prefs.targetTemperatureUnit)))}${escapeHtml(unitLabel)}">
              <circle class="weather-card__forecast-chart-touch" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="21"></circle>
              <circle class="weather-card__forecast-chart-point weather-card__forecast-chart-point--low" style="--forecast-delay:${Math.min(point.index, 8) * 34}ms; ${colorChartEnabled ? `--forecast-point-color:${escapeHtml(getForecastChartPointColor(point, colorChartMode, state?.state))};` : ""}" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="5"></circle>
              ${showChartLabels ? `<text class="weather-card__forecast-chart-value weather-card__forecast-chart-value--low" x="${point.x.toFixed(1)}" y="${Math.min(lowLabelY, point.y + 31).toFixed(1)}">${escapeHtml(formatNumber(this._convertTemperatureValue(point.value, prefs.sourceTemperatureUnit, prefs.targetTemperatureUnit)))}${escapeHtml(unitLabel)}</text>` : ""}
            </g>
          `).join("")}
        </svg>
        ${popupMarkup}
        ${hoverPreviewMarkup}
      </div>
    `;
  }

  _renderForecastDetails(state, accentColor, shouldAnimateEntrance, shouldAnimateForecast = false) {
    if (this._config?.show_forecast_details !== true) {
      return "";
    }

    const supportedTypes = getSupportedForecastTypes(state);
    const activeType = supportedTypes.includes(this._activeForecastType)
      ? this._activeForecastType
      : supportedTypes[0] || "daily";
    const forecastItems = this._getForecastItems(activeType, state);
    const slotCount = activeType === "hourly"
      ? clamp(Number(this._config?.forecast_slots_hourly) || DEFAULT_CONFIG.forecast_slots_hourly, 3, 24)
      : clamp(Number(this._config?.forecast_slots_daily) || DEFAULT_CONFIG.forecast_slots_daily, 3, 14);
    const visibleItems = forecastItems.slice(0, slotCount);
    const precipitationUnit = String(state?.attributes?.precipitation_unit || "").trim();
    const activeView = normalizeForecastView(this._activeForecastView);
    const hassFc = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const cfgLangFc = this._config?.language ?? "auto";
    const wfFc = key => (window.NodaliaI18n?.translateWeatherForecastUi
      ? window.NodaliaI18n.translateWeatherForecastUi(hassFc, cfgLangFc, key)
      : "");
    const langFc = window.NodaliaI18n?.resolveLanguage?.(hassFc, cfgLangFc) ?? "en";
    const forecastLocale = window.NodaliaI18n?.localeTag?.(langFc) || langFc;
    const emptyForecastMsg = activeType === "hourly"
      ? (wfFc("emptyHourly") || "No hourly forecast available.")
      : (wfFc("emptyDaily") || "No weekly forecast available.");
    const unitPrefs = this._getUnitPreferences(state);

    return `
      <section class="weather-card__forecast ${shouldAnimateEntrance ? "weather-card__forecast--entering" : ""} ${shouldAnimateForecast ? "weather-card__forecast--switching" : ""}">
        <div class="weather-card__forecast-header ${this._config.show_forecast_toggle === false ? "weather-card__forecast-header--tabs-only" : ""}">
          ${
            this._config.show_forecast_toggle === false
              ? ""
              : `
                <div class="weather-card__forecast-tabs" role="tablist" aria-label="${escapeHtml(wfFc("tabsAria") || "Forecast view")}">
                  <button type="button" class="weather-card__forecast-tab ${activeView === "cards" ? "weather-card__forecast-tab--active" : ""}" data-weather-action="set-forecast-view" data-forecast-view="cards" role="tab" aria-selected="${activeView === "cards" ? "true" : "false"}">
                    <ha-icon icon="mdi:view-grid-outline"></ha-icon>
                    <span>${escapeHtml(wfFc("tabCards") || "Cards")}</span>
                  </button>
                  <button type="button" class="weather-card__forecast-tab ${activeView === "chart" ? "weather-card__forecast-tab--active" : ""}" data-weather-action="set-forecast-view" data-forecast-view="chart" role="tab" aria-selected="${activeView === "chart" ? "true" : "false"}">
                    <ha-icon icon="mdi:chart-line"></ha-icon>
                    <span>${escapeHtml(wfFc("tabChart") || "Chart")}</span>
                  </button>
                </div>
              `
          }
          ${
            this._forecastExpanded
              ? `
                <div class="weather-card__forecast-tabs" role="tablist">
                  ${supportedTypes.includes("hourly") ? `
                    <button type="button" class="weather-card__forecast-tab ${activeType === "hourly" ? "weather-card__forecast-tab--active" : ""}" data-weather-action="set-forecast-type" data-forecast-type="hourly" role="tab" aria-selected="${activeType === "hourly" ? "true" : "false"}">${escapeHtml(wfFc("hoursTab") || "Horas")}</button>
                  ` : ""}
                  ${supportedTypes.includes("daily") ? `
                    <button type="button" class="weather-card__forecast-tab ${activeType === "daily" ? "weather-card__forecast-tab--active" : ""}" data-weather-action="set-forecast-type" data-forecast-type="daily" role="tab" aria-selected="${activeType === "daily" ? "true" : "false"}">${escapeHtml(wfFc("weekTab") || "Semana")}</button>
                  ` : ""}
                </div>
              `
              : ""
          }
        </div>
        ${
          this._forecastExpanded
            ? `
              ${
                activeView === "chart"
                  ? this._renderForecastChart(visibleItems, activeType, state, forecastLocale, unitPrefs)
                  : `
                    <div class="weather-card__forecast-strip">
                      ${
                        visibleItems.length
                          ? visibleItems.map((item, index) => {
                            const conditionValue = item?.condition || state?.state;
                            const accent = getConditionAccent(conditionValue);
                            const iconColor = getForecastIconColor(accent, conditionValue);
                            const precipitationLabel = getForecastPrecipitationLabel(item, precipitationUnit);
                            return `
                              <article class="weather-card__forecast-item" style="--forecast-accent:${escapeHtml(accent)}; --forecast-icon-color:${escapeHtml(iconColor)}; --forecast-delay:${Math.min(index, 8) * 28}ms;">
                                <div class="weather-card__forecast-time">${escapeHtml(formatForecastDateTime(item?.datetime, activeType, forecastLocale))}</div>
                                <ha-icon icon="${escapeHtml(getConditionIcon(item?.condition || state?.state))}"></ha-icon>
                                <div class="weather-card__forecast-temp">${escapeHtml(this._formatForecastTemperature(item, activeType, unitPrefs.targetTemperatureUnit))}</div>
                                <div class="weather-card__forecast-condition">${escapeHtml(translateCondition(item?.condition || "", this._hass, this._config?.language ?? "auto"))}</div>
                                ${precipitationLabel ? `<div class="weather-card__forecast-rain"><ha-icon icon="mdi:weather-rainy"></ha-icon><span>${escapeHtml(precipitationLabel)}</span></div>` : ""}
                              </article>
                            `;
                          }).join("")
                          : `<div class="weather-card__forecast-empty">${escapeHtml(emptyForecastMsg)}</div>`
                      }
                    </div>
                  `
              }
            `
            : ""
        }
      </section>
    `;
  }

  _weatherCardUi(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.weatherCard;
    const enPack = window.NodaliaI18n?.strings?.("en")?.weatherCard;
    const raw = pack?.[key] ?? enPack?.[key];
    return String(raw != null && raw !== "" ? raw : fallback);
  }

  _renderEmptyState() {
    const title = escapeHtml(this._weatherCardUi("emptyTitle", "Nodalia Weather Card"));
    const body = escapeHtml(this._weatherCardUi("emptyBody", "Set `entity` to show the weather."));
    return `
      <ha-card class="weather-card weather-card--empty">
        <div class="weather-card__empty-title">${title}</div>
        <div class="weather-card__empty-text">${body}</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const entityGuard = window.NodaliaUtils?.renderLovelaceEntityGuardCardHtml?.(
      this._hass,
      this._config?.entity,
      { cardClass: "weather-card" },
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
    const title = this._getTitle(state);
    const icon = this._getIcon(state);
    const animations = this._getAnimationSettings();
    const showUnavailableBadge = isUnavailableState(state);
    const iconMotionClass = animations.enabled && animations.iconAnimation && !showUnavailableBadge
      ? getConditionIconMotionClass(state?.state)
      : "";
    const accentColor = this._getAccentColor(state);
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const conditionLabel = translateCondition(state?.state, this._hass, this._config?.language ?? "auto");
    const temperatureLabel = this._formatTemperature(state);
    const chips = [
      config.show_humidity_chip !== false
        ? this._renderChip("mdi:water-percent", this._formatHumidity(state), "#59aef9")
        : "",
      config.show_wind_chip !== false
        ? this._renderChip("mdi:weather-windy", this._formatWind(state), "#7dd7d0")
        : "",
      config.show_pressure_chip === true
        ? this._renderChip("mdi:gauge", this._formatPressure(state), "#8fa4b8")
        : "",
    ].filter(Boolean);
    const tapEnabled = String(config.tap_action || "more-info") !== "none";
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const shouldAnimateForecast = animations.enabled && this._animateForecastOnNextRender;
    const configuredBorder = String(styles.card.border || "").trim();
    const defaultBorder = String(DEFAULT_CONFIG.styles.card.border || "").trim();
    const configuredIconColor = String(styles?.icon?.color || "").trim();
    const defaultIconColor = String(DEFAULT_CONFIG?.styles?.icon?.color || "").trim();
    const conditionIconColor = configuredIconColor && configuredIconColor !== defaultIconColor
      ? configuredIconColor
      : getConditionReadableIconColor(state?.state, accentColor);
    const cardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 9%, ${styles.card.background}) 56%, ${styles.card.background} 100%)`;
    const cardBorder = !configuredBorder || configuredBorder === defaultBorder
      ? `1px solid color-mix(in srgb, ${accentColor} 28%, var(--divider-color))`
      : configuredBorder;
    const cardShadow = `${styles.card.box_shadow}, 0 16px 32px color-mix(in srgb, ${accentColor} 10%, rgba(0, 0, 0, 0.18))`;
    const forecastMarkup = this._renderForecastDetails(state, accentColor, shouldAnimateEntrance, shouldAnimateForecast);
    const meteoalarmChipRowMarkup = this._renderMeteoalarmChipRow(shouldAnimateEntrance);
    const meteoalarmPopupMarkup = this._renderMeteoalarmPopup();
    const hasElevatedOverlay = Boolean(
      this._meteoalarmPopupOpen || this._forecastPopup || this._forecastHoverPreview,
    );

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --weather-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --weather-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          --weather-card-popover-surface: color-mix(in srgb, var(--primary-background-color, #111318) 88%, var(--primary-text-color, #ffffff) 12%);
          --weather-card-popover-surface-strong: color-mix(in srgb, var(--primary-background-color, #111318) 78%, var(--primary-text-color, #ffffff) 22%);
          display: block;
          position: relative;
          z-index: ${hasElevatedOverlay ? "2147483000" : "auto"};
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          background:
            linear-gradient(180deg, color-mix(in srgb, ${accentColor} 15%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)), rgba(255, 255, 255, 0) 44%),
            ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          overflow: ${this._forecastPopup || this._forecastHoverPreview ? "visible" : "hidden"};
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .weather-card--clickable {
          cursor: pointer;
        }

        .weather-card__content {
          cursor: ${tapEnabled ? "pointer" : "default"};
          display: grid;
          gap: ${styles.card.gap};
          min-width: 0;
          padding: ${styles.card.padding};
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease;
          z-index: 1;
        }

        .weather-card__content.is-pressing {
          animation: weather-card-content-bounce var(--weather-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .weather-card__hero {
          display: grid;
          gap: 12px;
          min-width: 0;
        }

        .weather-card__hero--no-alert {
          gap: 6px;
        }

        .weather-card__topline {
          align-items: flex-start;
          display: flex;
          gap: 12px;
          justify-content: space-between;
          min-width: 0;
        }

        .weather-card__main {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: ${styles.icon.size} minmax(0, 1fr);
          min-width: 0;
        }

        .weather-card__hero--entering {
          animation: weather-card-fade-up calc(var(--weather-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .weather-card__icon {
          align-items: center;
          background: ${styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 22px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent),
            0 14px 28px rgba(0, 0, 0, 0.14);
          color: ${conditionIconColor};
          display: inline-flex;
          height: ${styles.icon.size};
          justify-content: center;
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease, color 180ms ease;
          width: ${styles.icon.size};
        }

        .weather-card__icon--entering {
          animation: weather-card-bubble-bloom calc(var(--weather-card-content-duration) * 0.92) cubic-bezier(0.2, 0.9, 0.24, 1) both;
          animation-delay: 40ms;
        }

        .weather-card__icon.is-pressing {
          animation: weather-card-bubble-bounce var(--weather-card-button-bounce-duration) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
        }

        .weather-card__icon ha-icon {
          --mdc-icon-size: calc(${styles.icon.size} * 0.5);
        }

        .weather-card__icon--rain-motion::after,
        .weather-card__icon--snow-motion::after {
          animation: weather-card-icon-fall 0.95s linear infinite;
          background:
            radial-gradient(circle at 22% 18%, currentColor 0 1.3px, transparent 1.8px),
            radial-gradient(circle at 58% 44%, currentColor 0 1.2px, transparent 1.8px),
            radial-gradient(circle at 78% 6%, currentColor 0 1.1px, transparent 1.7px);
          content: "";
          inset: 18% 18% 12%;
          opacity: 0.42;
          pointer-events: none;
          position: absolute;
        }

        .weather-card__icon--snow-motion::after {
          animation-duration: 1.35s;
          opacity: 0.5;
        }

        .weather-card__icon--sun-motion ha-icon {
          animation: weather-card-icon-pulse 2.1s ease-in-out infinite;
        }

        .weather-card__icon--wind-motion ha-icon,
        .weather-card__icon--cloud-motion ha-icon {
          animation: weather-card-icon-drift 2.2s ease-in-out infinite;
        }

        .weather-card__icon--storm-motion ha-icon {
          animation: weather-card-icon-flash 1.3s steps(2, end) infinite;
        }

        .weather-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          display: inline-flex;
          flex: 0 0 18px;
          height: 18px;
          justify-content: center;
          line-height: 1;
          position: absolute;
          right: -2px;
          top: -2px;
          width: 18px;
          z-index: 2;
        }

        .weather-card__unavailable-badge ha-icon {
          --mdc-icon-size: 12px;
          animation: none !important;
          color:#fff;
          display: block;
          flex: 0 0 12px;
          height: 12px;
          left: auto;
          line-height: 1;
          position: static;
          top: auto;
          transform: none;
          width: 12px;
        }

        .weather-card__copy {
          display: grid;
          gap: 10px;
          min-width: 0;
        }

        .weather-card__copy--entering {
          animation: weather-card-fade-up calc(var(--weather-card-content-duration) * 0.92) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 70ms;
        }

        .weather-card__title {
          flex: 1 1 auto;
          font-size: ${styles.title_size};
          font-weight: 700;
          line-height: 1.2;
          min-width: 0;
        }

        .weather-card__chips {
          display: flex;
          flex: 0 1 auto;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
          margin-left: auto;
          min-width: 0;
        }

        .weather-card__chips--entering {
          animation: weather-card-fade-up calc(var(--weather-card-content-duration) * 0.94) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 110ms;
        }

        .weather-card__chips--entering .weather-card__chip {
          animation: weather-card-chip-pop calc(var(--weather-card-content-duration) * 0.58) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
        }

        .weather-card__chips--entering .weather-card__chip:nth-child(2) {
          animation-delay: 35ms;
        }

        .weather-card__chips--entering .weather-card__chip:nth-child(3) {
          animation-delay: 70ms;
        }

        .weather-card__alert-row {
          display: flex;
          justify-content: flex-start;
          min-width: 0;
        }

        .weather-card__alert-row--entering {
          animation: weather-card-fade-up calc(var(--weather-card-content-duration) * 0.94) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 88ms;
        }

        .weather-card__chip {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, var(--chip-accent) 18%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          color: var(--primary-text-color);
          display: inline-flex;
          gap: 6px;
          height: ${styles.chip_height};
          line-height: 1;
          margin: 0;
          padding: ${styles.chip_padding};
          transition: background 160ms ease, border-color 160ms ease, box-shadow 180ms ease, transform 180ms cubic-bezier(0.2, 0.9, 0.24, 1);
          white-space: nowrap;
        }

        .weather-card__chip:hover {
          transform: translateY(-1px);
        }

        .weather-card__chip--button {
          cursor: pointer;
          font: inherit;
          max-width: min(100%, 320px);
          min-width: 0;
          overflow: visible;
          transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
        }

        .weather-card__chip--button:hover {
          background: color-mix(in srgb, var(--chip-accent) 14%, color-mix(in srgb, var(--primary-text-color) 6%, transparent));
        }

        .weather-card__chip--button:active {
          transform: scale(0.97);
        }

        .weather-card__chip--alert-active {
          background: color-mix(in srgb, var(--chip-accent) 18%, color-mix(in srgb, var(--primary-text-color) 5%, transparent));
          border-color: color-mix(in srgb, var(--chip-accent) 45%, transparent);
        }

        .weather-card__chip--meteoalarm {
          max-width: 100%;
        }

        .weather-card__chip ha-icon {
          --mdc-icon-size: 13px;
          color: var(--chip-icon-color, var(--chip-accent));
        }

        .weather-card__chip span {
          font-size: ${styles.chip_font_size};
          font-weight: 700;
          min-width: 0;
          overflow: visible;
          text-overflow: ellipsis;
        }

        .weather-alert-backdrop {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 28%, transparent);
          display: flex;
          inset: 0;
          justify-content: center;
          padding: 16px;
          position: fixed;
          z-index: 2147483000;
        }

        .weather-alert-panel {
          animation: weather-card-alert-panel calc(var(--weather-card-content-duration) * 0.68) cubic-bezier(0.16, 0.84, 0.22, 1) both;
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--alert-accent) 10%, color-mix(in srgb, var(--primary-text-color) 5%, transparent)), rgba(255, 255, 255, 0)),
            var(--ha-card-background, var(--card-background-color, #fff));
          border: 1px solid color-mix(in srgb, var(--alert-accent) 35%, var(--divider-color));
          border-radius: 24px;
          box-shadow: 0 24px 56px rgba(0, 0, 0, 0.34);
          color: var(--primary-text-color);
          display: grid;
          gap: 14px;
          max-height: min(680px, calc(100vh - 32px));
          max-height: min(680px, calc(100dvh - 32px));
          max-width: 520px;
          overflow: auto;
          padding: 16px;
          width: min(520px, calc(100vw - 32px));
          transform-origin: 50% 0%;
        }

        .weather-alert-panel__header {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: 42px minmax(0, 1fr) 36px;
        }

        .weather-alert-panel__icon,
        .weather-alert-panel__close {
          align-items: center;
          border-radius: 999px;
          display: inline-flex;
          height: 36px;
          justify-content: center;
          width: 36px;
        }

        .weather-alert-panel__icon {
          background: color-mix(in srgb, var(--alert-accent) 24%, transparent);
          color: var(--alert-accent);
        }

        .weather-alert-panel__close {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          color: var(--primary-text-color);
          cursor: pointer;
          margin: 0;
          padding: 0;
        }

        .weather-alert-panel__icon ha-icon,
        .weather-alert-panel__close ha-icon {
          --mdc-icon-size: 18px;
        }

        .weather-alert-panel__copy {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .weather-alert-panel__eyebrow {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .weather-alert-panel__title {
          font-size: 16px;
          font-weight: 800;
          line-height: 1.25;
        }

        .weather-alert-panel__rows {
          display: grid;
          gap: 8px;
        }

        .weather-alert-panel__row {
          align-items: baseline;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        .weather-alert-panel__row span {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 700;
        }

        .weather-alert-panel__row strong {
          font-size: 12px;
          line-height: 1.25;
          text-align: right;
        }

        .weather-alert-panel__section {
          display: grid;
          gap: 5px;
        }

        .weather-alert-panel__section h3 {
          font-size: 12px;
          margin: 0;
        }

        .weather-alert-panel__section p {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.45;
          margin: 0;
          white-space: pre-line;
        }

        .weather-card__metrics {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .weather-card__metrics--entering {
          animation: weather-card-fade-up calc(var(--weather-card-content-duration) * 0.94) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 95ms;
        }

        .weather-card__temperature {
          font-size: ${styles.temperature_size};
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1;
        }

        .weather-card__condition {
          color: var(--secondary-text-color);
          font-size: ${styles.condition_size};
          font-weight: 600;
          line-height: 1.3;
        }

        .weather-card__forecast {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .weather-card__forecast--entering {
          animation: weather-card-fade-up calc(var(--weather-card-content-duration) * 0.96) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 130ms;
        }

        .weather-card__forecast--switching .weather-card__forecast-strip,
        .weather-card__forecast--switching .weather-card__forecast-chart {
          animation: weather-card-panel-swap calc(var(--weather-card-content-duration) * 0.86) cubic-bezier(0.18, 0.9, 0.22, 1.08) both;
        }

        .weather-card__forecast-header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
          min-width: 0;
        }

        .weather-card__forecast-header--tabs-only {
          justify-content: flex-end;
        }

        .weather-card__forecast-toggle,
        .weather-card__forecast-tab {
          -webkit-tap-highlight-color: transparent;
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border: 1px solid color-mix(in srgb, ${accentColor} 16%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 11px;
          font-weight: 800;
          gap: 5px;
          height: 28px;
          justify-content: center;
          line-height: 1;
          padding: 0 10px;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 180ms ease, transform 180ms cubic-bezier(0.2, 0.9, 0.24, 1);
          white-space: nowrap;
        }

        .weather-card__forecast-toggle:hover,
        .weather-card__forecast-tab:hover {
          background: color-mix(in srgb, ${accentColor} 14%, color-mix(in srgb, var(--primary-text-color) 6%, transparent));
          box-shadow: 0 8px 18px color-mix(in srgb, ${accentColor} 12%, transparent);
          transform: translateY(-1px);
        }

        .weather-card__forecast-toggle:active,
        .weather-card__forecast-tab:active {
          transform: scale(0.97);
        }

        .weather-card__forecast-toggle ha-icon {
          --mdc-icon-size: 16px;
        }

        .weather-card__forecast-tab ha-icon {
          --mdc-icon-size: 14px;
        }

        .weather-card__forecast-tabs {
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border-radius: 999px;
          display: inline-flex;
          gap: 3px;
          padding: 3px;
        }

        .weather-card__forecast-tab {
          background: transparent;
          border-color: transparent;
          height: 24px;
          padding: 0 9px;
        }

        .weather-card__forecast-tab--active {
          background: color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 7%, transparent));
          border-color: color-mix(in srgb, ${accentColor} 35%, transparent);
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 10%, transparent);
        }

        .weather-card__forecast-strip {
          display: grid;
          gap: 8px;
          grid-auto-columns: minmax(74px, 1fr);
          grid-auto-flow: column;
          min-width: 0;
          overflow-x: auto;
          padding: 5px 0 3px;
          scrollbar-width: thin;
        }

        .weather-card__forecast-item {
          align-content: start;
          background: color-mix(in srgb, var(--forecast-accent) 9%, color-mix(in srgb, var(--primary-text-color) 5%, transparent));
          border: 1px solid color-mix(in srgb, var(--forecast-accent) 18%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 18px;
          display: grid;
          gap: 5px;
          justify-items: center;
          min-height: 114px;
          min-width: 74px;
          padding: 9px 7px;
          text-align: center;
          transform-origin: center;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms cubic-bezier(0.2, 0.9, 0.24, 1);
        }

        .weather-card__forecast-item:hover {
          box-shadow: 0 10px 22px color-mix(in srgb, var(--forecast-accent) 12%, transparent);
          transform: translateY(-2px) scale(1.015);
        }

        .weather-card__forecast--entering .weather-card__forecast-item,
        .weather-card__forecast--switching .weather-card__forecast-item {
          animation: weather-card-item-rise calc(var(--weather-card-content-duration) * 0.74) cubic-bezier(0.18, 0.9, 0.22, 1.08) both;
          animation-delay: calc(70ms + var(--forecast-delay, 0ms));
        }

        .weather-card__forecast-time {
          color: var(--secondary-text-color);
          font-size: 10px;
          font-weight: 800;
          line-height: 1.2;
          min-height: 24px;
          text-transform: capitalize;
        }

        .weather-card__forecast-item > ha-icon {
          --mdc-icon-size: 22px;
          color: var(--forecast-icon-color, var(--forecast-accent));
        }

        .weather-card__forecast-temp {
          font-size: 14px;
          font-weight: 900;
          line-height: 1.1;
        }

        .weather-card__forecast-condition {
          color: var(--secondary-text-color);
          font-size: 9px;
          font-weight: 700;
          line-height: 1.15;
          max-width: 100%;
          min-height: 20px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .weather-card__forecast-rain {
          align-items: center;
          color: var(--secondary-text-color);
          display: inline-flex;
          font-size: 9px;
          font-weight: 800;
          gap: 3px;
          line-height: 1;
        }

        .weather-card__forecast-rain ha-icon {
          --mdc-icon-size: 11px;
          color: var(--forecast-icon-color, var(--forecast-accent));
        }

        .weather-card__forecast-chart {
          background:
            linear-gradient(180deg, color-mix(in srgb, ${accentColor} 8%, rgba(255,255,255,0.04)), rgba(255,255,255,0)),
            color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, ${accentColor} 18%, color-mix(in srgb, var(--primary-text-color) 7%, transparent));
          border-radius: 17px;
          align-self: start;
          height: var(--forecast-chart-height, 160px);
          min-height: 0;
          overflow: visible;
          padding: 4px 2px;
          position: relative;
          isolation: isolate;
        }

        .weather-card__forecast-chart svg {
          display: block;
          height: var(--forecast-chart-svg-height, 150px);
          overflow: visible;
          width: 100%;
        }

        .weather-card__forecast-chart-grid {
          stroke: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          stroke-width: 1;
        }

        .weather-card__forecast-chart-area {
          fill: color-mix(in srgb, ${accentColor} 16%, transparent);
        }

        .weather-card__forecast-chart-line {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 4.2;
        }

        .weather-card__forecast--entering .weather-card__forecast-chart-line,
        .weather-card__forecast--switching .weather-card__forecast-chart-line {
          animation: weather-card-line-draw calc(var(--weather-card-content-duration) * 0.95) cubic-bezier(0.25, 0.85, 0.25, 1) both;
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
        }

        .weather-card__forecast-chart-line--high {
          stroke: ${accentColor};
        }

        .weather-card__forecast-chart-line--low {
          stroke: color-mix(in srgb, ${accentColor} 48%, var(--secondary-text-color));
          stroke-dasharray: 6 5;
          stroke-width: 2.5;
        }

        .weather-card__forecast-chart-point {
          fill: color-mix(in srgb, var(--ha-card-background, #1f1f24) 82%, var(--forecast-point-color, ${accentColor}));
          transform-box: fill-box;
          transform-origin: center;
          stroke-width: 2.6;
        }

        .weather-card__forecast-chart-hit {
          cursor: pointer;
          outline: none;
        }

        .weather-card__forecast-chart-hit:hover .weather-card__forecast-chart-point,
        .weather-card__forecast-chart-hit:focus .weather-card__forecast-chart-point {
          filter: drop-shadow(0 0 7px color-mix(in srgb, ${accentColor} 42%, transparent));
          transform: scale(1.22);
        }

        .weather-card__forecast-chart-touch {
          fill: transparent;
          pointer-events: all;
        }

        .weather-card__forecast--entering .weather-card__forecast-chart-point,
        .weather-card__forecast--switching .weather-card__forecast-chart-point {
          animation: weather-card-point-pop calc(var(--weather-card-content-duration) * 0.58) cubic-bezier(0.18, 0.9, 0.22, 1.2) both;
          animation-delay: calc(90ms + var(--forecast-delay, 0ms));
        }

        .weather-card__forecast-chart-point--high {
          stroke: var(--forecast-point-color, ${accentColor});
        }

        .weather-card__forecast-chart-point--low {
          stroke: color-mix(in srgb, var(--forecast-point-color, ${accentColor}) 58%, var(--secondary-text-color));
        }

        .weather-card__forecast-chart-value,
        .weather-card__forecast-chart-label {
          fill: var(--primary-text-color);
          font-size: 15.8px;
          font-weight: 800;
          paint-order: stroke;
          stroke: color-mix(in srgb, var(--ha-card-background) 88%, transparent);
          stroke-linejoin: round;
          stroke-width: 4px;
          text-anchor: middle;
        }

        .weather-card__forecast-chart-label {
          fill: var(--secondary-text-color);
          font-size: 13.5px;
          font-weight: 850;
          text-transform: capitalize;
        }

        .weather-card__forecast-chart-value--low {
          fill: var(--secondary-text-color);
          font-size: 13.8px;
        }

        .weather-card__forecast-popup {
          --weather-popup-transform: translate(-50%, calc(-100% - 16px));
          animation: weather-card-popup-in calc(var(--weather-card-content-duration) * 0.58) cubic-bezier(0.16, 0.84, 0.22, 1) both;
          background-color: var(--weather-card-popover-surface);
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--forecast-accent) 18%, rgba(255,255,255,0.08)), rgba(255,255,255,0.02)),
            linear-gradient(180deg, color-mix(in srgb, var(--weather-card-popover-surface-strong) 94%, var(--forecast-accent) 6%), var(--weather-card-popover-surface)),
            var(--weather-card-popover-surface);
          border: 1px solid color-mix(in srgb, var(--forecast-accent) 36%, color-mix(in srgb, var(--primary-text-color) 9%, transparent));
          border-radius: 16px;
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28);
          color: var(--primary-text-color);
          display: grid;
          gap: 8px;
          left: var(--forecast-popup-left);
          min-width: 150px;
          max-width: min(206px, calc(100% - 20px));
          padding: 10px 12px 11px;
          position: absolute;
          top: var(--forecast-popup-top);
          transform: var(--weather-popup-transform);
          transform-origin: 50% 100%;
          width: min(206px, calc(100% - 20px));
          isolation: isolate;
          z-index: 2147483001;
        }

        .weather-card__forecast-popup--below {
          --weather-popup-transform: translate(-50%, 16px);
          transform-origin: 50% 0%;
        }

        .weather-card__forecast-hover-preview {
          -webkit-backdrop-filter: blur(14px);
          align-items: center;
          animation: weather-card-hover-preview-in calc(var(--weather-card-content-duration) * 0.34) cubic-bezier(0.16, 0.84, 0.22, 1) both;
          backdrop-filter: blur(14px);
          background-color: var(--weather-card-popover-surface);
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--forecast-accent) 18%, rgba(255,255,255,0.09)), rgba(255,255,255,0.025)),
            linear-gradient(180deg, color-mix(in srgb, var(--weather-card-popover-surface-strong) 90%, var(--forecast-accent) 10%), var(--weather-card-popover-surface)),
            var(--weather-card-popover-surface);
          border: 1px solid color-mix(in srgb, var(--forecast-accent) 34%, color-mix(in srgb, var(--primary-text-color) 9%, transparent));
          border-radius: 999px;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
          color: var(--primary-text-color);
          display: inline-flex;
          gap: 7px;
          left: var(--forecast-preview-left);
          max-width: min(190px, calc(100% - 20px));
          min-height: 34px;
          padding: 7px 11px;
          pointer-events: none;
          position: absolute;
          top: var(--forecast-preview-top);
          transform: translate(-50%, calc(-100% - 12px));
          white-space: nowrap;
          isolation: isolate;
          z-index: 2147483000;
        }

        .weather-card__forecast-hover-preview--below {
          transform: translate(-50%, 12px);
        }

        .weather-card__forecast-hover-preview ha-icon {
          --mdc-icon-size: 17px;
          color: var(--forecast-icon-color, var(--forecast-accent));
          flex: 0 0 auto;
        }

        .weather-card__forecast-hover-preview span {
          font-size: 11px;
          font-weight: 850;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .weather-card__forecast-hover-preview strong {
          color: var(--primary-text-color);
          flex: 0 0 auto;
          font-size: 12px;
          font-weight: 900;
          line-height: 1;
        }

        .weather-card__forecast-popup-close {
          align-items: center;
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--secondary-text-color);
          cursor: pointer;
          display: inline-flex;
          height: 24px;
          justify-content: center;
          margin: 0;
          padding: 0;
          position: absolute;
          right: 7px;
          top: 7px;
          width: 24px;
        }

        .weather-card__forecast-popup-close ha-icon {
          --mdc-icon-size: 14px;
        }

        .weather-card__forecast-popup-time {
          color: var(--secondary-text-color);
          font-size: 10px;
          font-weight: 800;
          padding-right: 26px;
          text-transform: capitalize;
        }

        .weather-card__forecast-popup-main {
          align-items: center;
          display: flex;
          gap: 7px;
          padding-right: 18px;
        }

        .weather-card__forecast-popup-main ha-icon {
          --mdc-icon-size: 20px;
          color: var(--forecast-icon-color, var(--forecast-accent));
        }

        .weather-card__forecast-popup-main span {
          font-size: 13px;
          font-weight: 850;
          line-height: 1.15;
        }

        .weather-card__forecast-popup-rows {
          display: grid;
          gap: 5px;
        }

        .weather-card__forecast-popup-rows div {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
          min-width: 0;
        }

        .weather-card__forecast-popup-rows span {
          color: var(--secondary-text-color);
          font-size: 10px;
          font-weight: 750;
        }

        .weather-card__forecast-popup-rows strong {
          font-size: 12px;
          font-weight: 850;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .weather-card__forecast-chart-meta {
          display: grid;
          gap: 6px;
          grid-auto-columns: minmax(88px, 1fr);
          grid-auto-flow: column;
          min-width: 0;
          overflow-x: auto;
          padding: 0 2px 2px;
          scrollbar-width: thin;
        }

        .weather-card__forecast-chart-chip {
          align-items: center;
          background: color-mix(in srgb, var(--forecast-accent) 10%, color-mix(in srgb, var(--primary-text-color) 5%, transparent));
          border: 1px solid color-mix(in srgb, var(--forecast-accent) 20%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 14px;
          color: var(--secondary-text-color);
          display: grid;
          font-size: 9px;
          font-weight: 800;
          gap: 3px;
          justify-items: center;
          min-height: 56px;
          padding: 6px;
          text-align: center;
          transform-origin: center bottom;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms cubic-bezier(0.2, 0.9, 0.24, 1);
        }

        .weather-card__forecast-chart-chip:hover {
          box-shadow: 0 8px 18px color-mix(in srgb, var(--forecast-accent) 12%, transparent);
          transform: translateY(-2px);
        }

        .weather-card__forecast--entering .weather-card__forecast-chart-chip,
        .weather-card__forecast--switching .weather-card__forecast-chart-chip {
          animation: weather-card-item-rise calc(var(--weather-card-content-duration) * 0.74) cubic-bezier(0.18, 0.9, 0.22, 1.08) both;
          animation-delay: calc(110ms + var(--forecast-delay, 0ms));
        }

        .weather-card__forecast-chart-chip > ha-icon {
          --mdc-icon-size: 18px;
          color: var(--forecast-icon-color, var(--forecast-accent));
        }

        .weather-card__forecast-chart-chip small {
          align-items: center;
          display: inline-flex;
          font-size: 9px;
          gap: 3px;
          line-height: 1;
        }

        .weather-card__forecast-chart-chip small ha-icon {
          --mdc-icon-size: 10px;
        }

        .weather-card__forecast-empty {
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px dashed color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 16px;
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 700;
          padding: 12px;
        }

        .weather-card--empty {
          display: grid;
          gap: 8px;
          padding: 16px;
        }

        .weather-card__empty-title {
          font-size: 15px;
          font-weight: 700;
        }

        .weather-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }

        @keyframes weather-card-content-bounce {
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

        @keyframes weather-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes weather-card-panel-swap {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.975);
          }
          64% {
            opacity: 1;
            transform: translateY(0) scale(1.012);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes weather-card-item-rise {
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

        @keyframes weather-card-line-draw {
          0% {
            opacity: 0;
            stroke-dashoffset: 1;
          }
          35% {
            opacity: 1;
          }
          100% {
            opacity: 1;
            stroke-dashoffset: 0;
          }
        }

        @keyframes weather-card-popup-in {
          0% {
            clip-path: inset(0 48% 86% 48% round 16px);
            opacity: 0;
            transform: var(--weather-popup-transform);
          }
          62% {
            clip-path: inset(0 5% 0 5% round 16px);
            opacity: 1;
            transform: var(--weather-popup-transform);
          }
          100% {
            clip-path: inset(0 0 0 0 round 16px);
            opacity: 1;
            transform: var(--weather-popup-transform);
          }
        }

        @keyframes weather-card-hover-preview-in {
          0% {
            clip-path: inset(0 42% 0 42% round 999px);
            opacity: 0;
          }
          100% {
            clip-path: inset(0 0 0 0 round 999px);
            opacity: 1;
          }
        }

        @keyframes weather-card-point-pop {
          0% {
            opacity: 0;
            transform: scale(0.2);
          }
          65% {
            opacity: 1;
            transform: scale(1.25);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes weather-card-chip-pop {
          0% {
            opacity: 0;
            transform: translateY(-4px) scale(0.86);
          }
          70% {
            opacity: 1;
            transform: translateY(1px) scale(1.05);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes weather-card-alert-panel {
          0% {
            clip-path: inset(0 44% 88% 44% round 24px);
            opacity: 0;
            transform: translateY(0);
          }
          64% {
            clip-path: inset(0 5% 0 5% round 24px);
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            clip-path: inset(0 0 0 0 round 24px);
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes weather-card-bubble-bloom {
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

        @keyframes weather-card-bubble-bounce {
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

        @media (max-width: 520px) {
          .weather-card__topline {
            align-items: flex-start;
            flex-wrap: nowrap;
          }

          .weather-card__chips {
            flex: 0 1 auto;
            justify-content: flex-end;
            max-width: 58%;
          }
        }

        @keyframes weather-card-icon-fall {
          from {
            transform: translateY(-6px);
          }
          to {
            transform: translateY(10px);
          }
        }

        @keyframes weather-card-icon-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.12);
          }
        }

        @keyframes weather-card-icon-drift {
          0%, 100% {
            transform: translateX(-2px);
          }
          50% {
            transform: translateX(3px);
          }
        }

        @keyframes weather-card-icon-flash {
          0%, 100% {
            opacity: 1;
            transform: translateZ(0) scale(1);
          }
          50% {
            opacity: 0.72;
            transform: translateZ(0) scale(1.04);
          }
        }

        ${animations.enabled ? "" : `
        ha-card,
        .weather-card,
        .weather-card * {
          animation: none !important;
          transition: none !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .weather-card__icon,
          .weather-card__icon::after,
          .weather-card__icon ha-icon {
            animation: none !important;
            transition: none !important;
          }
        }
        `}
      </style>
      <ha-card class="weather-card ${tapEnabled ? "weather-card--clickable" : ""}" style="--accent-color:${escapeHtml(accentColor)};">
        <div class="weather-card__content" data-weather-card="root">
          <div class="weather-card__hero ${meteoalarmChipRowMarkup ? "" : "weather-card__hero--no-alert"} ${shouldAnimateEntrance ? "weather-card__hero--entering" : ""}">
            <div class="weather-card__topline">
              <div class="weather-card__title">${escapeHtml(title)}</div>
              ${chips.length ? `<div class="weather-card__chips ${shouldAnimateEntrance ? "weather-card__chips--entering" : ""}">${chips.join("")}</div>` : ""}
            </div>
            <div class="weather-card__main">
              <div class="weather-card__icon ${shouldAnimateEntrance ? "weather-card__icon--entering" : ""} ${iconMotionClass}">
                <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
                ${showUnavailableBadge ? `<span class="weather-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
              </div>
              <div class="weather-card__copy ${shouldAnimateEntrance ? "weather-card__copy--entering" : ""}">
                ${meteoalarmChipRowMarkup}
                <div class="weather-card__metrics ${shouldAnimateEntrance ? "weather-card__metrics--entering" : ""}">
                  <div class="weather-card__temperature">${escapeHtml(temperatureLabel)}</div>
                  ${config.show_condition !== false ? `<div class="weather-card__condition">${escapeHtml(conditionLabel)}</div>` : ""}
                </div>
              </div>
            </div>
          </div>
          ${forecastMarkup}
        </div>
      </ha-card>
      ${meteoalarmPopupMarkup}
    `;

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 120);
    }

    if (shouldAnimateForecast) {
      this._animateForecastOnNextRender = false;
    }

    const meteoalarmDialog = this.shadowRoot.querySelector('.weather-alert-panel[role="dialog"]');
    if (meteoalarmDialog instanceof HTMLElement) {
      window.NodaliaUtils?.bindModalFocus?.(this, meteoalarmDialog, {
        initialFocusSelector: ".weather-alert-panel__close",
      });
    } else {
      window.NodaliaUtils?.releaseModalFocus?.(this);
    }

    this._lastRenderSignature = this._getRenderSignature();
  }
}
