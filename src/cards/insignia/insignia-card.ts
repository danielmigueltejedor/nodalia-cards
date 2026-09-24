// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import { CARD_TAG, EDITOR_TAG, HAPTIC_PATTERNS } from "./insignia-constants";
import {
  deepClone,
  escapeHtml,
  fireEvent,
  isObject,
  normalizeTextKey,
} from "./insignia-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./insignia-config";
import {
  applyStubEntity,
  formatNumericString,
  getDynamicEntityIcon,
  getEntityDomain,
  getSafeStyles,
  isUnavailableState,
  parseSizeToPixels,
  sanitizeCssValue,
} from "./insignia-helpers";

let _lazyNodaliaInsigniaCard;
export function loadNodaliaInsigniaCard() {
  if (_lazyNodaliaInsigniaCard) {
    return _lazyNodaliaInsigniaCard;
  }
class NodaliaInsigniaCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    return applyStubEntity(
      deepClone(STUB_CONFIG),
      hass,
      ["sensor", "binary_sensor"],
      entities,
      entitiesFallback,
    );
  }

  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._suppressNextInsigniaTap = false;
    this._onClick = this._onClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    }

  connectedCallback() {
    this.shadowRoot.addEventListener("click", this._onClick);
    this.shadowRoot.addEventListener("keydown", this._onKeyDown);
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const trigger = event
                .composedPath()
                .find(node => node instanceof HTMLElement && node.dataset?.insigniaAction === "primary");
              return trigger ? "primary" : null;
            },
            shouldBeginHold: () => this._resolveInsigniaHoldAction() !== "none",
            onHold: () => {
              this._handlePrimaryHoldAction();
            },
            markHoldConsumedClick: () => {
              this._suppressNextInsigniaTap = true;
            },
          })
        : () => {};
  }

  disconnectedCallback() {
    this._detachHostHold?.();
    this.shadowRoot.removeEventListener("click", this._onClick);
    this.shadowRoot.removeEventListener("keydown", this._onKeyDown);
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    window.NodaliaUtils?.applyDefaultConfigNameFromEntity?.(this._config, this._hass);
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

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 1,
      min_columns: 1,
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
    const visibilityCount = Array.isArray(this._config?.visibility) ? this._config.visibility.length : 0;
    const values = [
      entityId,
      String(state?.state || ""),
      String(attrs.friendly_name || ""),
      String(attrs.icon || ""),
      this._config?.state_attribute ? String(attrs[this._config.state_attribute] ?? "") : "",
      String(this._config?.name || ""),
      String(this._config?.icon || ""),
      String(this._config?.icon_active || ""),
      String(this._config?.icon_inactive || ""),
      this._config?.use_entity_icon !== false,
      this._config?.use_entity_picture !== false,
      this._config?.tint_auto !== false,
      visibilityCount,
      String(this._config?.styles?.tint?.color || ""),
      `${this._config?.tap_action || ""}|${this._config?.hold_action || ""}`,
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "insignia:", values }]);
    }
    return values.join("::");
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

  _getResolvedName(state) {
    return this._config.name
      || state?.attributes?.friendly_name
      || this._config.entity
      || "Insignia";
  }

  _getResolvedValue(state) {
    if (this._config.state_attribute) {
      const attrValue = state?.attributes?.[this._config.state_attribute];
      return attrValue === undefined || attrValue === null ? "" : formatNumericString(attrValue);
    }

    if (!state) {
      return "";
    }

    const unit = String(state.attributes?.unit_of_measurement || "").trim();
    const formatted = formatNumericString(state.state);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  _isActiveState(state) {
    const stateKey = normalizeTextKey(state?.state);

    if (!stateKey || ["off", "closed", "locked", "unavailable", "unknown", "none", "idle", "standby"].includes(stateKey)) {
      return false;
    }

    return true;
  }

  _getResolvedIcon(state) {
    const trimIcon = value => (typeof value === "string" ? value.trim() : "");
    const iconActive = trimIcon(this._config?.icon_active);
    const iconInactive = trimIcon(this._config?.icon_inactive);

    if (iconActive || iconInactive) {
      const chosen = this._isActiveState(state) ? iconActive : iconInactive;
      if (chosen) {
        return chosen;
      }
    }

    if (this._config.use_entity_icon) {
      return getDynamicEntityIcon(state) || trimIcon(this._config?.icon) || "mdi:star-four-points-circle";
    }

    return trimIcon(this._config?.icon) || state?.attributes?.icon || "mdi:star-four-points-circle";
  }

  _getResolvedPicture(state) {
    if (!this._config.use_entity_picture) {
      return "";
    }

    const picture = state?.attributes?.entity_picture;
    return picture ? String(picture) : "";
  }

  _evaluateVisibility() {
    const rules = Array.isArray(this._config?.visibility) ? this._config.visibility : [];
    if (!rules.length) {
      return true;
    }

    for (const rule of rules) {
      if (!rule || rule.condition !== "template") {
        continue;
      }
      const rawValue = String(rule.value ?? "").trim();
      const hasDrawerLogic = rawValue.includes("drawer")
        || rawValue.includes("mdc-drawer")
        || rawValue.includes("hass-toggle-menu");
      if (hasDrawerLogic) {
        const main = document
          .querySelector("body > home-assistant")
          ?.shadowRoot?.querySelector("home-assistant-main");
        const drawer =
          main?.shadowRoot?.querySelector("ha-drawer") ||
          main?.shadowRoot?.querySelector("[drawer]") ||
          main?.shadowRoot?.querySelector(".mdc-drawer");
        const isOpen =
          drawer?.opened === true ||
          drawer?.open === true ||
          drawer?.hasAttribute?.("open") ||
          drawer?.classList?.contains("mdc-drawer--open");
        if (isOpen) {
          return false;
        }
        continue;
      }
    }

    return true;
  }

  _isActive(state) {
    const stateKey = normalizeTextKey(state?.state);
    if (!state) {
      return false;
    }

    return ["on", "home", "playing", "heat", "cool", "dry", "fan_only", "open", "unlocked"].includes(stateKey);
  }

  /**
   * Match Entity card–level tint strength: numeric sensors (temperature, etc.) are never "active"
   * but should still read a clear semantic tint; manual tint mode always wins visibility.
   */
  _shouldApplyStrongCardTint(state) {
    if (!state) {
      return false;
    }
    if (this._config?.tint_auto === false) {
      return true;
    }
    if (this._isActive(state)) {
      return true;
    }
    const domain = getEntityDomain(state);
    return domain === "sensor" || domain === "weather";
  }

  _shouldDimIcon(state) {
    if (!state) {
      return false;
    }

    const domain = getEntityDomain(state);
    if (["sensor", "input_number", "input_datetime", "input_text", "number"].includes(domain)) {
      return false;
    }

    return [
      "light",
      "switch",
      "fan",
      "humidifier",
      "binary_sensor",
      "alarm_control_panel",
      "lock",
      "cover",
      "media_player",
      "vacuum",
      "input_boolean",
      "device_tracker",
      "person",
    ].includes(domain);
  }

  _getTintColor(state) {
    if (this._config?.tint_auto === false) {
      return sanitizeCssValue(this._config?.styles?.tint?.color, DEFAULT_CONFIG.styles.tint.color);
    }

    const domain = getEntityDomain(state);
    const stateKey = normalizeTextKey(state?.state);
    const deviceClass = normalizeTextKey(state?.attributes?.device_class);
    const rawUnit = String(state?.attributes?.unit_of_measurement || "").trim().toLowerCase();
    const unit = normalizeTextKey(rawUnit);

    if (domain === "light") {
      return stateKey === "on" ? "var(--warning-color, #f6b04d)" : "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))";
    }
    if (domain === "fan") {
      return "var(--info-color, #71c0ff)";
    }
    if (domain === "humidifier") {
      return "#7fd0c8";
    }
    if (domain === "person") {
      return "#83d39c";
    }
    if (domain === "alarm_control_panel") {
      return "#b59dff";
    }
    if (domain === "weather") {
      return "#8fc9ff";
    }
    if (domain === "sensor") {
      if (deviceClass === "temperature" || unit === "c" || rawUnit.includes("°c") || rawUnit.includes("degc")) {
        return "#ff6b6b";
      }
      if (deviceClass === "humidity" || rawUnit.includes("%") || unit === "percent") {
        return "#4da3ff";
      }
    }

    return "var(--info-color, #71c0ff)";
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

  _onClick(event) {
    const trigger = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.insigniaAction === "primary");

    if (!trigger) {
      return;
    }

    if (this._suppressNextInsigniaTap) {
      this._suppressNextInsigniaTap = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this._handlePrimaryAction();
  }

  _onKeyDown(event) {
    if (window.NodaliaUtils?.isKeyboardActivationEvent?.(event) !== true) {
      return;
    }
    this._onClick(event);
  }

  _resolveInsigniaHoldAction() {
    const state = this._getState();
    const action = String(this._config?.hold_action || "none").trim().toLowerCase();
    if (action === "none") {
      return "none";
    }
    if (action === "auto") {
      return state && this._config?.entity ? "more-info" : "none";
    }
    if (action === "more-info") {
      return this._config?.entity ? "more-info" : "none";
    }
    if (action === "toggle") {
      return this._config?.entity ? "toggle" : "none";
    }
    if (action === "service") {
      return String(this._config?.hold_service || "").trim() ? "service" : "none";
    }
    if (action === "navigate") {
      return String(this._config?.hold_url || "").trim() ? "navigate" : "none";
    }
    if (action === "url") {
      return String(this._config?.hold_url || "").trim() ? "url" : "none";
    }
    return "none";
  }

  _handlePrimaryHoldAction() {
    const state = this._getState();
    const action = String(this._config?.hold_action || "none").trim().toLowerCase();
    const navigationPath = this._config.hold_url;

    if (action === "none") {
      return;
    }

    this._triggerHaptic();

    if (action === "more-info" || (action === "auto" && state)) {
      fireEvent(this, "hass-more-info", { entityId: this._config.entity });
      return;
    }

    if (action === "toggle") {
      this._hass?.callService("homeassistant", "toggle", { entity_id: this._config.entity });
      return;
    }

    if (action === "service" && this._config.hold_service) {
      if (!this._isServiceAllowed(this._config.hold_service)) {
        window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Insignia Card", this._config.hold_service);
        return;
      }
      const [domain, service] = this._config.hold_service.split(".");
      if (domain && service) {
        let serviceData = {};
        if (this._config.hold_service_data) {
          try {
            serviceData = JSON.parse(this._config.hold_service_data);
          } catch (_error) {
            serviceData = {};
          }
        }
        this._hass?.callService(domain, service, serviceData);
      }
      return;
    }

    if (action === "navigate" && navigationPath) {
      const path = navigationPath;
      if (this._hass?.navigate) {
        this._hass.navigate(path);
        return;
      }
      if (window?.history?.pushState && !path.includes("://")) {
        window.history.pushState(null, "", path);
        fireEvent(this, "location-changed", { replace: false });
        return;
      }
      fireEvent(this, "hass-navigate", { path });
      return;
    }

    if (action === "url" && this._config.hold_url) {
      const safeUrl = window.NodaliaUtils?.sanitizeActionUrl(this._config.hold_url, { allowRelative: true });
      if (!safeUrl) {
        return;
      }
      if (this._config.hold_new_tab) {
        window.open(safeUrl, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = safeUrl;
      }
    }
  }

  _handlePrimaryAction() {
    const state = this._getState();
    const tapConfig = this._config.tap_action;
    const isObjectTap = isObject(tapConfig);
    const action = isObjectTap ? (tapConfig.action || "auto") : (tapConfig || "auto");
    const navigationPath = isObjectTap ? tapConfig.navigation_path : this._config.tap_url;

    if (action === "none") {
      return;
    }

    this._triggerHaptic();

    if (action === "more-info" || (action === "auto" && state)) {
      fireEvent(this, "hass-more-info", { entityId: this._config.entity });
      return;
    }

    if (action === "toggle") {
      this._hass?.callService("homeassistant", "toggle", { entity_id: this._config.entity });
      return;
    }

    if (action === "service" && this._config.tap_service) {
      if (!this._isServiceAllowed(this._config.tap_service)) {
        window.NodaliaUtils?.warnStrictServiceDenied?.("Nodalia Insignia Card", this._config.tap_service);
        return;
      }
      const [domain, service] = this._config.tap_service.split(".");
      if (domain && service) {
        let serviceData = {};
        if (this._config.tap_service_data) {
          try {
            serviceData = JSON.parse(this._config.tap_service_data);
          } catch (_error) {
            serviceData = {};
          }
        }
        this._hass?.callService(domain, service, serviceData);
      }
      return;
    }

    if (action === "navigate" && navigationPath) {
      const path = navigationPath;
      if (this._hass?.navigate) {
        this._hass.navigate(path);
        return;
      }
      if (window?.history?.pushState && !path.includes("://")) {
        window.history.pushState(null, "", path);
        fireEvent(this, "location-changed", { replace: false });
        return;
      }
      fireEvent(this, "hass-navigate", { path });
      return;
    }

    if (action === "url" && this._config.tap_url) {
      const safeUrl = window.NodaliaUtils?.sanitizeActionUrl(this._config.tap_url, { allowRelative: true });
      if (!safeUrl) {
        return;
      }
      if (this._config.tap_new_tab) {
        window.open(safeUrl, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = safeUrl;
      }
    }
  }

  _insigniaCardUi(key, fallback = "") {
    const hass = this._hass ?? window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, this._config?.language ?? "auto") ?? "en";
    const pack = window.NodaliaI18n?.strings?.(lang)?.insigniaCard;
    const enPack = window.NodaliaI18n?.strings?.("en")?.insigniaCard;
    const raw = pack?.[key] ?? enPack?.[key];
    return String(raw != null && raw !== "" ? raw : fallback);
  }

  _renderEmptyState() {
    const title = escapeHtml(this._insigniaCardUi("emptyTitle", "Nodalia Insignia Card"));
    const body = escapeHtml(
      this._insigniaCardUi("emptyBody", "Configure `entity` or basic content to show the badge."),
    );
    return `
      <ha-card class="insignia-card insignia-card--empty">
        <div class="insignia-card__empty-title">${title}</div>
        <div class="insignia-card__empty-text">${body}</div>
      </ha-card>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || normalizeConfig({});
    const styles = getSafeStyles(config.styles);
    const state = this._getState();

    if (!state && !config.name && !config.icon) {
      this.removeAttribute("data-icon-only");
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; }
          * { box-sizing: border-box; }
          .insignia-card--empty {
            background: ${styles.card.background};
            border: ${styles.card.border};
            border-radius: ${styles.card.border_radius};
            box-shadow: ${styles.card.box_shadow};
            display: grid;
            gap: 6px;
            padding: ${styles.card.padding};
          }
          .insignia-card__empty-title {
            color: var(--primary-text-color);
            font-size: 14px;
            font-weight: 700;
          }
          .insignia-card__empty-text {
            color: var(--secondary-text-color);
            font-size: 12px;
            line-height: 1.45;
          }
        </style>
        ${this._renderEmptyState()}
      `;
      return;
    }

    const iconSizePx = Math.max(28, Math.min(parseSizeToPixels(styles.icon.size, 34), 40));
    const titleSize = `${Math.max(12, Math.min(parseSizeToPixels(styles.title_size, 13), 14))}px`;
    const valueSize = `${Math.max(12, Math.min(parseSizeToPixels(styles.value_size, 13), 14))}px`;
    const title = this._getResolvedName(state);
    const value = this._getResolvedValue(state);
    const icon = this._getResolvedIcon(state);
    const active = this._isActive(state);
    const dimIcon = this._shouldDimIcon(state);
    const tint = sanitizeCssValue(this._getTintColor(state), DEFAULT_CONFIG.styles.tint.color);
    const strongTint = this._shouldApplyStrongCardTint(state);
    const cardBackground = strongTint
      ? `linear-gradient(135deg, color-mix(in srgb, ${tint} 18%, ${styles.card.background}) 0%, color-mix(in srgb, ${tint} 10%, ${styles.card.background}) 52%, ${styles.card.background} 100%)`
      : styles.card.background;
    const cardBorder = strongTint
      ? `1px solid color-mix(in srgb, ${tint} 32%, var(--divider-color))`
      : styles.card.border;
    // Match Entity card elevation on full ha-cards; a second large drop shadow on compact
    // pill insignias reads as a flat gray “shelf” under the rounded bottom in toolbars.
    const cardShadow = strongTint
      ? `${styles.card.box_shadow}, inset 0 1px 0 color-mix(in srgb, ${tint} 28%, rgba(255, 255, 255, 0.35))`
      : styles.card.box_shadow;
    const unavailable = config.entity && isUnavailableState(state);
    const showName = config.show_name !== false;
    const showValue = config.show_value !== false && Boolean(value);
    const iconOnly = !showName && !showValue;
    const iconOnlyOffsetY = String(styles.icon?.icon_only_offset_y ?? DEFAULT_CONFIG.styles.icon.icon_only_offset_y);
    const pictureUrl = this._getResolvedPicture(state);
    const showPicture = Boolean(pictureUrl);
    const isVisible = this._evaluateVisibility();

    this.toggleAttribute("data-icon-only", iconOnly);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          line-height: 0;
          vertical-align: middle;
          box-sizing: border-box;
          /* Horizontal scroll rows often omit custom props; a non-zero default keeps pill + shadow inside the strip. */
          align-self: center;
          min-height: min-content;
          /* Scroll strips (header horizontal overflow) need block padding on every pill, not only icon-only,
             or the strip clips shadows and the bottom of the pill. Parent can set --insignia-scroll-strip-padding-block. */
          padding-block: var(
            --insignia-scroll-strip-padding-block,
            var(--insignia-scroll-strip-margin-block, 4px 6px)
          );
        }

        :host([data-icon-only]) {
          /* Same cross-axis behavior as non–icon-only pills (align-items: center on row).
             stretch forced full line height and skewed vertical center vs text pills + menu. */
          align-self: var(--insignia-icon-only-align-self, center);
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
          width: auto;
          min-height: min-content;
          transform: translateY(var(--insignia-icon-only-row-nudge, -2px));
          padding-block: var(
            --insignia-scroll-strip-padding-block,
            var(--insignia-scroll-strip-margin-block, 4px 8px)
          );
        }

        * {
          box-sizing: border-box;
        }

        [data-insignia-action="primary"]:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }

        .insignia-card {
          background: ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          display: inline-flex;
          height: auto;
          min-height: 0;
          isolation: isolate;
          position: relative;
          /* visible: overflow:hidden clipped card box-shadow and rounded bottom in horizontal scroll headers */
          overflow: visible;
          transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .insignia-card--icon-only {
          border-radius: ${styles.card.border_radius};
          height: auto;
          width: fit-content;
          max-width: 100%;
        }

        .insignia-card::before {
          background: ${strongTint
      ? `linear-gradient(180deg, color-mix(in srgb, ${tint} 22%, color-mix(in srgb, var(--primary-text-color) 6%, transparent)), rgba(255, 255, 255, 0))`
      : "linear-gradient(180deg, color-mix(in srgb, var(--primary-text-color) 5%, transparent), rgba(255, 255, 255, 0))"};
          border-radius: inherit;
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .insignia-card::after {
          background:
            radial-gradient(circle at 18% 20%, color-mix(in srgb, ${tint} 26%, color-mix(in srgb, var(--primary-text-color) 12%, transparent)) 0%, transparent 52%),
            linear-gradient(135deg, color-mix(in srgb, ${tint} 16%, transparent) 0%, transparent 66%);
          border-radius: inherit;
          content: "";
          inset: 0;
          opacity: ${strongTint ? "1" : "0"};
          pointer-events: none;
          position: absolute;
          transition: opacity 180ms ease;
          z-index: 0;
        }

        .insignia-card__content {
          align-items: center;
          cursor: pointer;
          display: grid;
          gap: ${styles.card.gap};
          grid-template-columns: ${iconSizePx}px minmax(0, 1fr);
          padding: ${styles.card.padding};
          position: relative;
          z-index: 1;
        }

        /* Solo icono: misma fila / padding / gap que la píldora con texto; sin segunda columna (no forzar cuadrado). */
        .insignia-card--icon-only .insignia-card__content {
          grid-template-columns: min(${iconSizePx}px, 100%);
          width: fit-content;
          max-width: 100%;
        }

        .insignia-card__icon {
          align-items: center;
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--primary-text-color) 6%, transparent), transparent 60%),
            ${styles.icon.background};
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 5%, transparent),
            0 8px 20px rgba(0, 0, 0, 0.14);
          color: ${active ? styles.icon.on_color : (dimIcon ? styles.icon.off_color : "var(--primary-text-color)")};
          display: inline-flex;
          height: ${iconSizePx}px;
          justify-content: center;
          position: relative;
          width: ${iconSizePx}px;
        }

        .insignia-card__icon img {
          border-radius: inherit;
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .insignia-card__icon ha-icon {
          --mdc-icon-size: ${Math.round(iconSizePx * 0.5)}px;
          height: ${Math.round(iconSizePx * 0.5)}px;
          width: ${Math.round(iconSizePx * 0.5)}px;
        }

        .insignia-card--icon-only .insignia-card__icon ha-icon {
          overflow: visible;
          position: relative;
          top: var(--icon-only-offset-y);
          transform: translateY(var(--insignia-icon-optical-y, -1px));
        }

        .insignia-card__copy {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 4px 8px;
          min-width: 0;
        }

        .insignia-card__title,
        .insignia-card__value {
          line-height: 1.15;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .insignia-card__title {
          color: var(--primary-text-color);
          font-size: ${titleSize};
          font-weight: 700;
        }

        .insignia-card__value {
          color: var(--primary-text-color);
          font-size: ${valueSize};
          font-weight: 600;
        }

        .insignia-card__dot {
          background: color-mix(in srgb, ${tint} 82%, white 18%);
          border-radius: 999px;
          box-shadow: 0 0 0 4px color-mix(in srgb, ${tint} 16%, transparent);
          flex: 0 0 auto;
          height: 7px;
          width: 7px;
        }

        .insignia-card__unavailable-badge {
          align-items: center;
          background: #ff9b4a;
          border: 2px solid ${styles.card.background};
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
          display: inline-flex;
          height: 16px;
          justify-content: center;
          position: absolute;
          right: -2px;
          top: -2px;
          width: 16px;
        }

        .insignia-card__unavailable-badge ha-icon {
          --mdc-icon-size: 10px;
          color:#fff;
          height: 10px;
          width: 10px;
        }
        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <div class="insignia-card ${iconOnly ? "insignia-card--icon-only" : ""}" style="--icon-only-offset-y: ${iconOnlyOffsetY}; ${isVisible ? "" : "display:none;"}">
        <div class="insignia-card__content" data-insignia-action="primary" role="button" tabindex="0" aria-label="${escapeHtml(title)}">
          <div class="insignia-card__icon">
            ${showPicture
              ? `<img src="${escapeHtml(pictureUrl)}" alt="${escapeHtml(title)}" />`
              : `<ha-icon icon="${escapeHtml(icon)}"></ha-icon>`
            }
            ${unavailable ? '<span class="insignia-card__unavailable-badge"><ha-icon icon="mdi:help"></ha-icon></span>' : ""}
          </div>
          ${iconOnly
            ? ""
            : `
          <div class="insignia-card__copy">
            ${showName ? `<div class="insignia-card__title">${escapeHtml(title)}</div>` : ""}
            ${showName && showValue ? '<span class="insignia-card__dot"></span>' : ""}
            ${showValue ? `<div class="insignia-card__value">${escapeHtml(value)}</div>` : ""}
          </div>
          `}
        </div>
      </div>
    `;
  }
}
  _lazyNodaliaInsigniaCard = NodaliaInsigniaCard;
  return NodaliaInsigniaCard;
}
