// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  DIAL_CIRCLE_RADIUS,
  DIAL_CIRCUMFERENCE,
  DIAL_HIDDEN_LENGTH,
  DIAL_START_ANGLE,
  DIAL_SWEEP,
  DIAL_VIEWBOX_SIZE,
  DIAL_VISIBLE_LENGTH,
  EDITOR_TAG,
  GAUGE_TINT_SEGMENT_COUNT,
  HAPTIC_PATTERNS,
} from "./circular-gauge-constants";
import {
  clamp,
  compactConfig,
  deepClone,
  deleteByPath,
  escapeHtml,
  fireEvent,
  isObject,
  mergeConfig,
  normalizeTextKey,
  setByPath,
} from "./circular-gauge-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./circular-gauge-config";
import {
  applyStubEntity,
  buildGaugeTintScale,
  formatNumberValue,
  getContinuousThumbRotate,
  getDialMarkerCoordinates,
  getDialThumbRotate,
  getGaugeSvgFallbackColor,
  getHassLocaleTag,
  getRelativeLuminance,
  getSafeStyles,
  inferDecimals,
  inferReasonableMax,
  isUnavailableState,
  parseRgbColor,
  parseSizeToPixels,
  resolveColorInContext,
  resolveGaugeSvgStrokeColor,
  resolveGaugeTintColor,
  sanitizeCssValue,
} from "./circular-gauge-helpers";

export class NodaliaCircularGaugeCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    return applyStubEntity(
      deepClone(STUB_CONFIG),
      hass,
      ["sensor", "number", "input_number"],
      entities,
      entitiesFallback,
    );
  }

  static getEntitySuggestion(hass, entityId) {
    return window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, {
      domains: ["sensor", "number", "input_number"],
    });
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._lastRenderSignature = "";
    this._lastGaugeVisualState = null;
    this._gaugeVisualFrame = 0;
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowKeyDown = this._onShadowKeyDown.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("keydown", this._onShadowKeyDown);
  }

  connectedCallback() {
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    if (this._gaugeVisualFrame) {
      window.cancelAnimationFrame(this._gaugeVisualFrame);
      this._gaugeVisualFrame = 0;
    }
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
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
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
    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 5,
      min_columns: 6,
    };
  }

  _getState() {
    return this._config?.entity ? this._hass?.states?.[this._config.entity] || null : null;
  }

  _getRenderSignature(hass = this._hass) {
    const entityId = this._config?.entity || "";
    const state = entityId ? hass?.states?.[entityId] || null : null;
    const attrs = state?.attributes || {};
    const joinParts = window.NodaliaRenderSignature?.joinParts;
    const values = [
      entityId,
      String(state?.state || ""),
      String(attrs.native_value ?? ""),
      String(attrs.friendly_name || ""),
      String(attrs.icon || ""),
      String(attrs.unit_of_measurement || attrs.native_unit_of_measurement || ""),
      String(attrs.device_class || ""),
      String(attrs.min ?? ""),
      String(attrs.max ?? ""),
      String(getHassLocaleTag(hass, this._config?.language ?? "auto") || ""),
      Number(this._config?.grid_options?.rows || 0),
      Number(this._config?.grid_options?.columns || 0),
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "gauge:", values }]);
    }
    return values.join("::");
  }

  _getConfiguredGridRows() {
    const numericRows = Number(this._config?.grid_options?.rows);
    return Number.isFinite(numericRows) ? numericRows : null;
  }

  _getConfiguredGridColumns() {
    const numericColumns = Number(this._config?.grid_options?.columns);
    return Number.isFinite(numericColumns) ? numericColumns : null;
  }

  _getCompactLevel() {
    const configuredRows = this._getConfiguredGridRows();
    const configuredColumns = this._getConfiguredGridColumns();

    if (
      (configuredRows !== null && configuredRows <= 3)
      || (configuredColumns !== null && configuredColumns <= 6)
    ) {
      return "compact";
    }

    return "default";
  }

  _getTitle(state) {
    return this._config?.name
      || state?.attributes?.friendly_name
      || this._config?.entity
      || "Gauge";
  }

  _getIcon(state) {
    return this._config?.icon
      || state?.attributes?.icon
      || "mdi:gauge";
  }

  _getUnit(state) {
    return String(
      this._config?.unit
      || state?.attributes?.unit_of_measurement
      || state?.attributes?.native_unit_of_measurement
      || "",
    ).trim();
  }

  _getNumericValue(state) {
    const direct = Number(String(state?.state ?? "").replace(",", "."));
    if (Number.isFinite(direct)) {
      return direct;
    }

    const nativeValue = Number(state?.attributes?.native_value);
    return Number.isFinite(nativeValue) ? nativeValue : null;
  }

  _getDecimals(state) {
    const configured = Number(this._config?.decimals);
    if (Number.isFinite(configured) && configured >= 0) {
      return Math.min(3, configured);
    }

    const rawState = String(state?.state ?? "").trim();
    return inferDecimals(rawState);
  }

  _getRange(state, currentValue) {
    const configuredMin = Number(this._config?.min);
    const configuredMax = Number(this._config?.max);
    const attrMin = Number(state?.attributes?.min);
    const attrMax = Number(state?.attributes?.max);
    const unit = this._getUnit(state);

    const min = Number.isFinite(configuredMin)
      ? configuredMin
      : Number.isFinite(attrMin)
        ? attrMin
        : this._config?.start_from_zero === false && Number.isFinite(currentValue) && currentValue < 0
          ? Math.floor(currentValue)
          : 0;

    let max = Number.isFinite(configuredMax)
      ? configuredMax
      : Number.isFinite(attrMax)
        ? attrMax
        : inferReasonableMax(currentValue, unit, state);

    if (!Number.isFinite(max) || max <= min) {
      max = min + 100;
    }

    return { min, max };
  }

  _getRangeLabel(boundary, range, state) {
    const configuredLabel = String(
      boundary === "min" ? this._config?.min_label ?? "" : this._config?.max_label ?? "",
    ).trim();

    if (configuredLabel) {
      return configuredLabel;
    }

    return formatNumberValue(boundary === "min" ? range.min : range.max, this._getDecimals(state), this._getLocaleTag());
  }

  _getGaugeTintScale() {
    const gaugeStyles = this._config?.styles?.gauge || DEFAULT_CONFIG.styles.gauge;
    return buildGaugeTintScale(gaugeStyles.min_tint_color, gaugeStyles.max_tint_color);
  }

  _resolveGaugeSvgStrokeColor(value, fallback) {
    const cacheKey = `${value}\u0000${fallback}`;
    if (this._gaugeSvgColorCache?.has(cacheKey)) {
      return this._gaugeSvgColorCache.get(cacheKey);
    }

    const resolved = resolveGaugeSvgStrokeColor(value, fallback);
    this._gaugeSvgColorCache?.set(cacheKey, resolved);
    return resolved;
  }

  _getGaugeProgressSegments(ratio, tintScale) {
    const safeRatio = clamp(Number(ratio) || 0, 0, 1);
    const configuredColor = String(this._config?.styles?.gauge?.foreground_color || "").trim();
    const segmentLength = DIAL_VISIBLE_LENGTH / GAUGE_TINT_SEGMENT_COUNT;
    const segmentRatioSize = 1 / GAUGE_TINT_SEGMENT_COUNT;

    return Array.from({ length: GAUGE_TINT_SEGMENT_COUNT }, (_, index) => {
      const startRatio = index * segmentRatioSize;
      const fillRatio = clamp((safeRatio - startRatio) / segmentRatioSize, 0, 1);
      const visibleLength = Number((segmentLength * fillRatio).toFixed(3));
      const sampleRatio = startRatio + (segmentRatioSize * 0.5);
      const rawColor = configuredColor || resolveGaugeTintColor(tintScale, sampleRatio);

      return {
        color: this._resolveGaugeSvgStrokeColor(rawColor, getGaugeSvgFallbackColor(sampleRatio)),
        dasharray: `${visibleLength} ${DIAL_CIRCUMFERENCE}`,
        dashoffset: `${Number((-segmentLength * index).toFixed(3))}`,
        opacity: visibleLength > 0.05 ? 0.96 : 0,
      };
    });
  }

  _getAccentColor(state, ratio) {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const configuredColor = String(styles?.gauge?.foreground_color || "").trim();
    if (configuredColor) {
      return configuredColor;
    }

    return resolveGaugeTintColor(this._getGaugeTintScale(), ratio);
  }

  _formatValue(value, state, withUnit = false) {
    const decimals = this._getDecimals(state);
    const formatted = formatNumberValue(value, decimals, this._getLocaleTag());
    if (!withUnit) {
      return formatted;
    }

    const unit = this._getUnit(state);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  _getLocaleTag() {
    return getHassLocaleTag(this._hass, this._config?.language ?? "auto");
  }

  _getAnimationSettings() {
    const configuredAnimations = this._config?.animations || DEFAULT_CONFIG.animations;

    return {
      enabled: configuredAnimations.enabled !== false,
      dialDuration: clamp(
        Number(configuredAnimations.dial_duration) || DEFAULT_CONFIG.animations.dial_duration,
        80,
        2000,
      ),
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

  _canRunTapAction() {
    return (this._config?.tap_action || "more-info") !== "none" && Boolean(this._config?.entity);
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

  _triggerContentBounce(content) {
    if (!(content instanceof HTMLElement)) {
      return;
    }

    const animations = this._getAnimationSettings();
    if (!animations.enabled) {
      return;
    }

    content.classList.remove("is-pressing");
    content.getBoundingClientRect();
    content.classList.add("is-pressing");

    const schedule = window.NodaliaUtils?.scheduleDeferTimer;
    const done = () => {
      if (!content.isConnected) {
        return;
      }
      content.classList.remove("is-pressing");
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
      this._finalizeGaugeEntranceProgress();
    }, safeDelay);
  }

  _finalizeGaugeEntranceProgress() {
    const dial = this.shadowRoot?.querySelector(".gauge-card__dial");
    if (!(dial instanceof HTMLElement)) {
      return;
    }

    const visualState = this._lastGaugeVisualState;
    const ratio = Number(visualState?.ratio) || 0;
    const tintScale = this._getGaugeTintScale();
    const segments = this._getGaugeProgressSegments(ratio, tintScale);
    const dialStartCapColor =
      sanitizeCssValue(this._config?.styles?.gauge?.foreground_color, "")
      || resolveGaugeTintColor(tintScale, 0.02);

    dial.classList.remove("gauge-card__dial--entrance-progress");

    const smoothProgress = dial.querySelector("[data-progress-smooth]");
    if (smoothProgress instanceof SVGElement) {
      smoothProgress.style.opacity = "0";
    }

    dial.querySelectorAll("[data-progress-segment]").forEach((segmentElement, index) => {
      const segment = segments[index];
      if (!(segmentElement instanceof SVGElement) || !segment) {
        return;
      }

      segmentElement.style.transition = "none";
      segmentElement.style.stroke = segment.color;
      segmentElement.style.strokeDasharray = segment.dasharray;
      segmentElement.style.strokeDashoffset = segment.dashoffset;
      segmentElement.style.opacity = String(segment.opacity);
      void segmentElement.getBoundingClientRect();
      segmentElement.style.transition = "";
    });

    const startCap = dial.querySelector("[data-progress-start]");
    if (startCap instanceof SVGElement) {
      startCap.style.fill = dialStartCapColor;
      startCap.style.opacity = ratio > 0 ? "0.96" : "0";
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
    const target = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.gaugeAction === "primary");

    if (!target || !this._canRunTapAction()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._triggerHaptic();
    this._triggerContentBounce(target);
    this._openMoreInfo();
  }

  _onShadowKeyDown(event) {
    if (window.NodaliaUtils?.isKeyboardActivationEvent?.(event) !== true) {
      return;
    }
    this._onShadowClick(event);
  }

  _circularGaugeCardUi(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.circularGaugeCard;
    const enPack = window.NodaliaI18n?.strings?.("en")?.circularGaugeCard;
    const raw = pack?.[key] ?? enPack?.[key];
    return String(raw != null && raw !== "" ? raw : fallback);
  }

  _renderEmptyState() {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const title = escapeHtml(this._circularGaugeCardUi("emptyTitle", "Nodalia Circular Gauge Card"));
    const body = escapeHtml(
      this._circularGaugeCardUi("emptyBody", "Set `entity` to a numeric entity to show the dial."),
    );
    return `
      <style>
        :host {
          display: block;
        }

        * {
          box-sizing: border-box;
        }

        .gauge-card--empty {
          background: ${styles.card.background};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          display: grid;
          gap: 6px;
          padding: ${styles.card.padding};
        }

        .gauge-card__empty-title {
          color: var(--primary-text-color);
          font-size: 15px;
          font-weight: 700;
        }

        .gauge-card__empty-text {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
        }
      </style>
      <ha-card class="gauge-card gauge-card--empty">
        <div class="gauge-card__empty-title">${title}</div>
        <div class="gauge-card__empty-text">${body}</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const styles = getSafeStyles(config.styles);

    const entityGuard = window.NodaliaUtils?.renderLovelaceEntityGuardCardHtml?.(
      this._hass,
      config.entity,
      { cardClass: "gauge-card" },
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

    const compactLayout = this._getCompactLevel() === "compact";
    const title = this._getTitle(state);
    const icon = this._getIcon(state);
    const value = this._getNumericValue(state);
    const unit = this._getUnit(state);
    const range = this._getRange(state, value);
    const ratio = value === null ? 0 : clamp((value - range.min) / Math.max(range.max - range.min, 1), 0, 1);
    this._gaugeSvgColorCache = new Map();
    const tintScale = this._getGaugeTintScale();
    const accentColor = this._getAccentColor(state, ratio);
    const progressLength = Number((DIAL_VISIBLE_LENGTH * ratio).toFixed(3));
    const dialAngle = DIAL_START_ANGLE + (ratio * DIAL_SWEEP);
    const thumbOrbitRatio = DIAL_CIRCLE_RADIUS / DIAL_VIEWBOX_SIZE;
    const dialStartCoordinates = getDialMarkerCoordinates(DIAL_START_ANGLE);
    const dialStartCapColor =
      sanitizeCssValue(styles.gauge.foreground_color, "") || resolveGaugeTintColor(tintScale, 0.02);
    const showUnavailableBadge = config.show_unavailable_badge !== false && isUnavailableState(state);
    const showHeader = config.show_header !== false;
    const showName = config.show_name !== false;
    const showIcon = config.show_icon !== false;
    const dialSizePx = Math.max(
      220,
      Math.min(parseSizeToPixels(styles.gauge.size, 280), compactLayout ? 248 : 280),
    );
    const dialStrokePx = Math.max(
      15,
      Math.min(parseSizeToPixels(styles.gauge.stroke, 18), compactLayout ? 17 : 18),
    );
    const thumbSizePx = Math.max(
      18,
      Math.min(parseSizeToPixels(styles.gauge.thumb_size, 22), compactLayout ? 20 : 22),
    );
    const effectiveCardPadding = compactLayout ? "14px" : styles.card.padding;
    const effectiveGap = compactLayout ? "12px" : styles.card.gap;
    const effectiveIconSize = `${Math.max(50, Math.min(parseSizeToPixels(styles.icon.size, 58), compactLayout ? 54 : 58))}px`;
    const effectiveTitleSize = `${Math.max(14, Math.min(parseSizeToPixels(styles.title_size, 16), compactLayout ? 15 : 16))}px`;
    const effectiveValueSize = `${Math.max(42, Math.min(parseSizeToPixels(styles.value_size, 52), compactLayout ? 46 : 52))}px`;
    const effectiveRangeSize = `${Math.max(12, Math.min(parseSizeToPixels(styles.range_size, 14), compactLayout ? 13 : 14))}px`;
    const effectiveChipHeight = `${Math.max(22, Math.min(parseSizeToPixels(styles.chip_height, 24), compactLayout ? 23 : 24))}px`;
    const effectiveChipFontSize = `${Math.max(10, Math.min(parseSizeToPixels(styles.chip_font_size, 11), compactLayout ? 10.5 : 11))}px`;
    const effectiveChipPadding = compactLayout ? "0 9px" : styles.chip_padding;
    const chipBorderRadius = escapeHtml(String(styles.chip_border_radius ?? "").trim() || "999px");
    const effectiveNameChipMaxWidth = `${Math.max(120, Math.min(parseSizeToPixels(styles.name_chip_max_width, 170), compactLayout ? 148 : 170))}px`;
    const cardBackground = value === null
      ? styles.card.background
      : `
        linear-gradient(135deg, color-mix(in srgb, ${accentColor} 22%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 12%, ${styles.card.background}) 56%, ${styles.card.background} 100%)
      `.trim();
    const cardBorder = value === null
      ? styles.card.border
      : `1px solid color-mix(in srgb, ${accentColor} 34%, var(--divider-color))`;
    const cardShadow = value === null
      ? styles.card.box_shadow
      : `${styles.card.box_shadow}, 0 18px 36px color-mix(in srgb, ${accentColor} 14%, rgba(0, 0, 0, 0.16))`;
    const dialSurfaceBackground = `
      radial-gradient(circle at 24% 18%, color-mix(in srgb, ${accentColor} 20%, transparent), transparent 30%),
      linear-gradient(180deg, color-mix(in srgb, ${accentColor} 14%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)) 0%, rgba(255, 255, 255, 0) 42%),
      linear-gradient(135deg, color-mix(in srgb, ${accentColor} 16%, ${styles.gauge.background}) 0%, color-mix(in srgb, ${accentColor} 8%, ${styles.gauge.background}) 60%, ${styles.gauge.background} 100%)
    `.trim();
    const dialTrackColor = `color-mix(in srgb, ${styles.gauge.track_color} 68%, var(--primary-text-color) 32%)`;
    const animations = this._getAnimationSettings();
    const shouldAnimateEntrance = animations.enabled && this._animateContentOnNextRender;
    const previousVisualState = animations.enabled && !shouldAnimateEntrance ? this._lastGaugeVisualState : null;
    const initialRatio = previousVisualState ? previousVisualState.ratio : shouldAnimateEntrance ? 0 : ratio;
    const initialProgressLength = Number((DIAL_VISIBLE_LENGTH * initialRatio).toFixed(3));
    const initialThumbAngle = previousVisualState
      ? previousVisualState.dialAngle
      : shouldAnimateEntrance
        ? DIAL_START_ANGLE
        : dialAngle;
    const initialThumbRotate = previousVisualState?.thumbRotate ?? getDialThumbRotate(initialThumbAngle);
    const targetThumbRotate = previousVisualState
      ? getContinuousThumbRotate(initialThumbRotate, dialAngle)
      : getDialThumbRotate(dialAngle);
    const initialProgressSegments = this._getGaugeProgressSegments(initialRatio, tintScale);
    const chips = [];

    if (config.show_percentage_chip === true && value !== null) {
      chips.push(`<div class="gauge-card__chip">${escapeHtml(`${Math.round(ratio * 100)}%`)}</div>`);
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --gauge-card-dial-duration: ${animations.enabled ? animations.dialDuration : 0}ms;
          --gauge-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --gauge-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          display: block;
          height: 100%;
          min-height: 0;
        }

        [data-gauge-action="primary"]:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: -3px;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          height: 100%;
          min-height: 0;
          overflow: hidden;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .gauge-card {
          background:
            radial-gradient(circle at top left, color-mix(in srgb, ${accentColor} 34%, transparent) 0%, transparent 60%),
            radial-gradient(circle at 50% 38%, color-mix(in srgb, ${accentColor} 16%, transparent) 0%, transparent 64%),
            linear-gradient(180deg, color-mix(in srgb, ${accentColor} 24%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)) 0%, rgba(255, 255, 255, 0) 44%),
            ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          isolation: isolate;
          overflow: hidden;
          position: relative;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .gauge-card::before {
          background: ${value === null
            ? "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0))"
            : `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 28%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`};
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .gauge-card::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${accentColor} 28%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 54%),
            linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, transparent) 0%, transparent 68%);
          content: "";
          inset: 0;
          opacity: ${value === null ? "0" : "1"};
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .gauge-card__content {
          cursor: ${this._canRunTapAction() ? "pointer" : "default"};
          display: flex;
          flex-direction: column;
          gap: ${effectiveGap};
          height: 100%;
          min-height: 0;
          padding: ${effectiveCardPadding};
          position: relative;
          transform-origin: center;
          transition: transform 160ms ease;
          will-change: transform;
          z-index: 1;
        }

        .gauge-card__content.is-pressing {
          animation: gauge-card-content-bounce var(--gauge-card-button-bounce-duration) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .gauge-card__hero {
          align-items: center;
          display: grid;
          gap: ${effectiveGap};
          grid-template-columns: ${showIcon ? `${effectiveIconSize} minmax(0, 1fr)` : "minmax(0, 1fr)"};
          min-height: 0;
          width: 100%;
        }

        .gauge-card__icon {
          align-items: center;
          appearance: none;
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--primary-text-color) 6%, transparent), transparent 60%),
            ${styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: calc(${effectiveIconSize} * 0.5);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent),
            0 10px 26px rgba(0, 0, 0, 0.16);
          color: ${styles.icon.color};
          display: inline-flex;
          height: ${effectiveIconSize};
          justify-content: center;
          margin: 0;
          padding: 0;
          position: relative;
          width: ${effectiveIconSize};
        }

        .gauge-card__icon ha-icon {
          --mdc-icon-size: calc(${effectiveIconSize} * 0.44);
          display: inline-flex;
          height: calc(${effectiveIconSize} * 0.44);
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(${effectiveIconSize} * 0.44);
        }

        .gauge-card__unavailable-badge {
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

        .gauge-card__unavailable-badge ha-icon {
          --mdc-icon-size: 11px;
          color:#fff;
          height: 11px;
          width: 11px;
        }

        .gauge-card__copy {
          display: grid;
          gap: 10px;
          min-width: 0;
        }

        .gauge-card__headline {
          align-items: start;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
          min-width: 0;
        }

        .gauge-card__title {
          color: var(--primary-text-color);
          font-size: ${effectiveTitleSize};
          font-weight: 700;
          line-height: 1.14;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .gauge-card__chips {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          min-width: 0;
        }

        .gauge-card__chip {
          align-items: center;
          backdrop-filter: blur(18px);
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          color: var(--primary-text-color);
          display: inline-flex;
          font-size: ${effectiveChipFontSize};
          font-weight: 700;
          height: ${effectiveChipHeight};
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          padding: ${effectiveChipPadding};
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .gauge-card__hero--entering {
          animation: gauge-card-fade-up calc(var(--gauge-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .gauge-card__dial-wrap {
          align-items: center;
          display: flex;
          flex: 1 1 auto;
          justify-content: center;
          min-height: 0;
        }

        .gauge-card__dial-wrap--entering {
          animation: gauge-card-fade-up var(--gauge-card-content-duration) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 40ms;
        }

        .gauge-card__dial-wrap--entering .gauge-card__dial {
          animation: gauge-card-dial-bloom calc(var(--gauge-card-content-duration) * 1.02) cubic-bezier(0.2, 0.9, 0.24, 1) both;
        }

        .gauge-card__dial-wrap--entering .gauge-card__dial-center {
          animation: gauge-card-dial-center-bloom calc(var(--gauge-card-content-duration) * 0.92) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 70ms;
        }

        .gauge-card__dial-wrap--entering .gauge-card__dial-thumb::after {
          animation: gauge-card-dial-thumb-pop calc(var(--gauge-card-content-duration) * 0.66) cubic-bezier(0.18, 0.9, 0.22, 1.18) both;
          animation-delay: 90ms;
        }

        .gauge-card__dial {
          --gauge-progress-length: ${initialProgressLength};
          --gauge-dial-size: ${dialSizePx}px;
          --gauge-thumb-orbit: calc(var(--gauge-dial-size) * ${thumbOrbitRatio});
          --gauge-thumb-rotate: ${initialThumbRotate}deg;
          --gauge-thumb-size: ${thumbSizePx}px;
          align-self: center;
          aspect-ratio: 1;
          background: ${dialSurfaceBackground};
          border: 1px solid color-mix(in srgb, ${accentColor} 10%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 50%;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent),
            0 18px 38px rgba(0, 0, 0, 0.16);
          box-sizing: border-box;
          flex-shrink: 0;
          height: auto;
          max-width: 100%;
          position: relative;
          transform: translateZ(0) scale(1);
          transform-origin: center;
          transition:
            background 220ms cubic-bezier(0.22, 0.84, 0.26, 1),
            border-color 220ms cubic-bezier(0.22, 0.84, 0.26, 1),
            box-shadow 220ms cubic-bezier(0.22, 0.84, 0.26, 1),
            transform 220ms cubic-bezier(0.22, 0.84, 0.26, 1);
          width: min(var(--gauge-dial-size), 100%);
          -webkit-backdrop-filter: blur(18px);
          backdrop-filter: blur(18px);
        }

        .gauge-card__dial-svg {
          display: block;
          height: 100%;
          overflow: visible;
          width: 100%;
        }

        .gauge-card__dial-track,
        .gauge-card__dial-progress,
        .gauge-card__dial-progress-segment {
          fill: none;
          stroke-width: ${dialStrokePx};
          transform: rotate(${DIAL_START_ANGLE}deg);
          transform-origin: ${DIAL_VIEWBOX_SIZE / 2}px ${DIAL_VIEWBOX_SIZE / 2}px;
        }

        .gauge-card__dial-track {
          stroke-dasharray: ${DIAL_VISIBLE_LENGTH} ${DIAL_HIDDEN_LENGTH};
          stroke-linecap: round;
          stroke: ${dialTrackColor};
        }

        .gauge-card__dial-progress {
          opacity: 0;
          pointer-events: none;
          stroke: ${sanitizeCssValue(accentColor, styles.gauge.max_tint_color)};
          stroke-dasharray: var(--gauge-progress-length) ${DIAL_CIRCUMFERENCE};
          stroke-linecap: round;
          transition:
            stroke var(--gauge-card-dial-duration) ease,
            stroke-dasharray var(--gauge-card-dial-duration) ease-out,
            opacity 120ms ease;
        }

        .gauge-card__dial--entrance-progress .gauge-card__dial-progress {
          opacity: 0.96;
        }

        .gauge-card__dial--entrance-progress .gauge-card__dial-progress-segment {
          opacity: 0 !important;
          transition: none !important;
        }

        .gauge-card__dial--entrance-progress .gauge-card__dial-progress-start {
          opacity: 0 !important;
          transition: none !important;
        }

        .gauge-card__dial-progress-segment {
          opacity: 0;
          stroke-linecap: butt;
          transition:
            stroke var(--gauge-card-dial-duration) ease,
            stroke-dasharray var(--gauge-card-dial-duration) ease-out,
            opacity 180ms ease,
            stroke-dashoffset 0ms linear;
        }

        .gauge-card__dial-progress-start {
          opacity: ${initialRatio > 0 ? "0.96" : "0"};
          transition:
            fill var(--gauge-card-dial-duration) ease,
            opacity 180ms ease;
        }

        .gauge-card__dial-thumb {
          background: transparent;
          border-radius: 50%;
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--primary-text-color) 4%, transparent),
            0 0 0 6px color-mix(in srgb, var(--primary-text-color) 5%, transparent),
            0 0 18px color-mix(in srgb, ${accentColor} 12%, transparent),
            0 10px 24px rgba(0, 0, 0, 0.18);
          height: var(--gauge-thumb-size);
          left: 50%;
          position: absolute;
          top: 50%;
          transform:
            translate(-50%, -50%)
            rotate(var(--gauge-thumb-rotate, 225deg))
            translateY(calc(-1 * var(--gauge-thumb-orbit, 0px)));
          transition:
            transform var(--gauge-card-dial-duration) ease-out,
            border-color var(--gauge-card-dial-duration) ease,
            box-shadow var(--gauge-card-dial-duration) ease,
            background var(--gauge-card-dial-duration) ease;
          width: var(--gauge-thumb-size);
          z-index: 2;
        }

        .gauge-card__dial-thumb::before {
          -webkit-backdrop-filter: blur(16px);
          backdrop-filter: blur(16px);
          background: radial-gradient(circle, color-mix(in srgb, var(--primary-text-color) 14%, transparent) 0%, color-mix(in srgb, var(--primary-text-color) 8%, transparent) 38%, color-mix(in srgb, var(--primary-text-color) 3%, transparent) 58%, transparent 76%);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 50%;
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          content: "";
          inset: 0;
          position: absolute;
        }

        .gauge-card__dial-thumb::after {
          background: rgba(255, 255, 255, 0.96);
          border-radius: 50%;
          content: "";
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          height: 82%;
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 82%;
        }

        .gauge-card__dial-center {
          align-content: center;
          display: grid;
          gap: ${compactLayout ? "8px" : "10px"};
          inset: ${compactLayout ? "28% 16% 24% 16%" : "26% 16% 24% 16%"};
          justify-items: center;
          position: absolute;
          text-align: center;
          transform: scale(1);
          transition:
            opacity 220ms cubic-bezier(0.22, 0.84, 0.26, 1),
            transform 220ms cubic-bezier(0.22, 0.84, 0.26, 1);
        }

        .gauge-card__name-chip {
          left: ${compactLayout ? "14px" : "16px"};
          max-width: ${effectiveNameChipMaxWidth};
          position: absolute;
          top: ${compactLayout ? "14px" : "16px"};
          z-index: 3;
        }

        .gauge-card__value {
          color: var(--primary-text-color);
          display: inline-block;
          font-size: ${effectiveValueSize};
          font-weight: 500;
          letter-spacing: -0.06em;
          line-height: 0.94;
          min-height: calc(${effectiveValueSize} * 0.94);
          min-width: 0;
          padding-right: ${unit ? `calc(${effectiveValueSize} * 0.34)` : "0"};
          position: relative;
          white-space: nowrap;
        }

        .gauge-card__value-unit {
          color: var(--primary-text-color);
          font-size: calc(${effectiveValueSize} * 0.24);
          font-weight: 500;
          line-height: 1;
          opacity: 0.92;
          position: absolute;
          right: 0;
          top: 0.16em;
        }

        .gauge-card__range-label {
          color: var(--secondary-text-color);
          font-size: ${effectiveRangeSize};
          font-weight: 600;
          line-height: 1;
          position: absolute;
          z-index: 2;
        }

        .gauge-card__range-label--min {
          bottom: ${compactLayout ? "-6px" : "-8px"};
          left: ${compactLayout ? "10px" : "14px"};
        }

        .gauge-card__range-label--max {
          bottom: ${compactLayout ? "-6px" : "-8px"};
          right: ${compactLayout ? "10px" : "14px"};
        }

        .gauge-card__bottom-icon {
          align-items: center;
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--primary-text-color) 8%, transparent), transparent 60%),
            ${styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent),
            0 10px 26px rgba(0, 0, 0, 0.16);
          color: ${styles.icon.color};
          display: inline-flex;
          height: ${compactLayout ? "42px" : "46px"};
          justify-content: center;
          left: 50%;
          bottom: ${compactLayout ? "36px" : "40px"};
          position: absolute;
          transform: translateX(-50%);
          width: ${compactLayout ? "42px" : "46px"};
          z-index: 3;
        }

        .gauge-card__bottom-icon ha-icon {
          --mdc-icon-size: ${compactLayout ? "20px" : "22px"};
          height: ${compactLayout ? "20px" : "22px"};
          width: ${compactLayout ? "20px" : "22px"};
        }

        @keyframes gauge-card-content-bounce {
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

        @keyframes gauge-card-fade-up {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.965);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes gauge-card-dial-bloom {
          0% {
            opacity: 0;
            transform: translateZ(0) scale(0.95);
            box-shadow:
              inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 2%, transparent),
              0 10px 24px rgba(0, 0, 0, 0.08);
          }
          55% {
            opacity: 1;
            transform: translateZ(0) scale(1.015);
            box-shadow:
              inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
              0 22px 42px rgba(0, 0, 0, 0.16);
          }
          100% {
            opacity: 1;
            transform: translateZ(0) scale(1);
            box-shadow:
              inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent),
              0 18px 38px rgba(0, 0, 0, 0.16);
          }
        }

        @keyframes gauge-card-dial-center-bloom {
          0% {
            opacity: 0;
            transform: scale(0.96);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes gauge-card-dial-thumb-pop {
          0% {
            transform: translate(-50%, -50%) scale(1);
          }
          48% {
            transform: translate(-50%, -50%) scale(1.22);
          }
          72% {
            transform: translate(-50%, -50%) scale(1.06);
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
          }
        }

        ${animations.enabled ? "" : `
        ha-card,
        .gauge-card,
        .gauge-card * {
          animation: none !important;
          transition: none !important;
        }
        `}

        @media (max-width: 560px) {
          .gauge-card__headline {
            grid-template-columns: minmax(0, 1fr);
          }

          .gauge-card__chips {
            justify-content: flex-start;
          }
        }
        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <ha-card class="gauge-card">
        <div class="gauge-card__content" ${this._canRunTapAction() ? `data-gauge-action="primary" role="button" tabindex="0" aria-label="${escapeHtml(title)}"` : ""}>
          ${
            showHeader
              ? `
                <div class="gauge-card__hero ${shouldAnimateEntrance ? "gauge-card__hero--entering" : ""}">
                  ${
                    showIcon
                      ? `
                        <div class="gauge-card__icon">
                          <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
                          ${showUnavailableBadge ? `<span class="gauge-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>` : ""}
                        </div>
                      `
                      : ""
                  }
                  <div class="gauge-card__copy">
                    <div class="gauge-card__headline">
                      ${showName ? `<div class="gauge-card__title">${escapeHtml(title)}</div>` : `<div></div>`}
                      ${chips.length ? `<div class="gauge-card__chips">${chips.join("")}</div>` : ""}
                    </div>
                  </div>
                </div>
              `
              : ""
          }

          ${
            !showHeader && showName && config.show_name_chip !== false
              ? `<div class="gauge-card__chip gauge-card__name-chip">${escapeHtml(title)}</div>`
              : ""
          }
          <div class="gauge-card__dial-wrap ${shouldAnimateEntrance ? "gauge-card__dial-wrap--entering" : ""}">
            <div
              class="gauge-card__dial${shouldAnimateEntrance ? " gauge-card__dial--entrance-progress" : ""}"
              aria-hidden="true"
              style="--gauge-progress-length:${initialProgressLength};"
            >
              <svg class="gauge-card__dial-svg" viewBox="0 0 ${DIAL_VIEWBOX_SIZE} ${DIAL_VIEWBOX_SIZE}">
                <circle
                  class="gauge-card__dial-track"
                  cx="${DIAL_VIEWBOX_SIZE / 2}"
                  cy="${DIAL_VIEWBOX_SIZE / 2}"
                  r="${DIAL_CIRCLE_RADIUS}"
                ></circle>
                <circle
                  class="gauge-card__dial-progress"
                  data-progress-smooth
                  cx="${DIAL_VIEWBOX_SIZE / 2}"
                  cy="${DIAL_VIEWBOX_SIZE / 2}"
                  r="${DIAL_CIRCLE_RADIUS}"
                ></circle>
                ${initialProgressSegments
                  .map((segment, index) => `
                    <circle
                      class="gauge-card__dial-progress-segment"
                      data-progress-segment="${index}"
                      cx="${DIAL_VIEWBOX_SIZE / 2}"
                      cy="${DIAL_VIEWBOX_SIZE / 2}"
                      r="${DIAL_CIRCLE_RADIUS}"
                      style="stroke:${sanitizeCssValue(segment.color, styles.gauge.max_tint_color)};stroke-dasharray:${segment.dasharray};stroke-dashoffset:${segment.dashoffset};opacity:${segment.opacity};"
                    ></circle>
                  `)
                  .join("")}
                <circle
                  class="gauge-card__dial-progress-start"
                  data-progress-start
                  cx="${dialStartCoordinates.x}"
                  cy="${dialStartCoordinates.y}"
                  r="${Number((dialStrokePx / 2).toFixed(3))}"
                  style="fill:${sanitizeCssValue(dialStartCapColor, styles.gauge.max_tint_color)};"
                ></circle>
              </svg>
              <span class="gauge-card__dial-thumb" aria-hidden="true"></span>
              ${
                config.show_range_labels !== false
                  ? `
                    <span class="gauge-card__range-label gauge-card__range-label--min">
                      ${escapeHtml(this._getRangeLabel("min", range, state))}
                    </span>
                    <span class="gauge-card__range-label gauge-card__range-label--max">
                      ${escapeHtml(this._getRangeLabel("max", range, state))}
                    </span>
                  `
                  : ""
              }
              ${
                config.show_bottom_icon_bubble === true && showIcon
                  ? `
                    <div class="gauge-card__bottom-icon">
                      <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
                    </div>
                  `
                  : ""
              }
              <div class="gauge-card__dial-center">
                <div class="gauge-card__value">
                  ${escapeHtml(this._formatValue(value, state, false))}
                  ${unit ? `<span class="gauge-card__value-unit">${escapeHtml(unit)}</span>` : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ha-card>
    `;

    if (this._gaugeVisualFrame) {
      window.cancelAnimationFrame(this._gaugeVisualFrame);
      this._gaugeVisualFrame = 0;
    }

    if (animations.enabled && (shouldAnimateEntrance || previousVisualState)) {
      const dial = this.shadowRoot.querySelector(".gauge-card__dial");
      if (dial instanceof HTMLElement) {
        this._gaugeVisualFrame = window.requestAnimationFrame(() => {
          dial.style.setProperty("--gauge-progress-length", `${progressLength}`);
          dial.style.setProperty("--gauge-thumb-rotate", `${targetThumbRotate}deg`);

          if (shouldAnimateEntrance) {
            this._gaugeVisualFrame = 0;
            return;
          }

          const nextProgressSegments = this._getGaugeProgressSegments(ratio, tintScale);
          dial.querySelectorAll("[data-progress-segment]").forEach((segmentElement, index) => {
            const segment = nextProgressSegments[index];
            if (!(segmentElement instanceof SVGElement) || !segment) {
              return;
            }

            segmentElement.style.stroke = segment.color;
            segmentElement.style.strokeDasharray = segment.dasharray;
            segmentElement.style.strokeDashoffset = segment.dashoffset;
            segmentElement.style.opacity = String(segment.opacity);
          });

          const startCap = dial.querySelector("[data-progress-start]");
          if (startCap instanceof SVGElement) {
            startCap.style.fill = dialStartCapColor;
            startCap.style.opacity = ratio > 0 ? "0.96" : "0";
          }

          this._gaugeVisualFrame = 0;
        });
      }
    }

    this._lastGaugeVisualState = {
      progressLength,
      ratio,
      dialAngle,
      thumbRotate: previousVisualState || shouldAnimateEntrance ? targetThumbRotate : getDialThumbRotate(dialAngle),
    };

    if (shouldAnimateEntrance) {
      this._scheduleEntranceAnimationReset(animations.contentDuration + 120);
    }
  }
}
