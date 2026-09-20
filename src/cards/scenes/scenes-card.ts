// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import { CARD_TAG, CARD_VERSION, EDITOR_TAG, HAPTIC_PATTERNS, SCENE_LAUNCH_DURATION } from "./scenes-constants";
import {
  clamp,
  deepClone,
  escapeHtml,
  fireEvent,
  normalizeTextKey,
} from "./scenes-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./scenes-config";
import {
  applyStubConfig,
  cancelDashboardScrollRestore,
  collectDashboardScrollSnapshot,
  getSafeStyles,
  parseSizeToPixels,
  resolveSceneEntries,
  scheduleDashboardScrollRestore,
} from "./scenes-helpers";

let _lazyNodaliaScenesCard;
export function loadNodaliaScenesCard() {
  if (_lazyNodaliaScenesCard) {
    return _lazyNodaliaScenesCard;
  }
class NodaliaScenesCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    return applyStubConfig(deepClone(STUB_CONFIG), hass, entities, entitiesFallback);
  }

  static getEntitySuggestion(hass, entityId) {
    return window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, {
      domains: ["scene"],
      buildConfig: (_hass, selectedEntityId) => ({
        layout: "single",
        scenes: [{ entity: selectedEntityId }],
      }),
    });
  }

  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._launchAnimationTimers = new Map();
    this._pressAnimationTimers = new Map();
    this._cancelScrollRestore = null;
    this._suppressNextSceneTap = false;
    this._interactionScrollSnapshot = null;
    this._sceneInteractionScrollUntil = 0;
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowPointerDown = this._onShadowPointerDown.bind(this);
    this._onShadowMouseDown = this._onShadowMouseDown.bind(this);
    this._onShadowTouchStart = this._onShadowTouchStart.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown, true);
    this.shadowRoot.addEventListener("mousedown", this._onShadowMouseDown, true);
    this.shadowRoot.addEventListener("touchstart", this._onShadowTouchStart, { passive: false, capture: true });
    this._detachHostHold =
      typeof window.NodaliaUtils?.bindHostPointerHoldGesture === "function"
        ? window.NodaliaUtils.bindHostPointerHoldGesture(this, {
            resolveZone: event => {
              const button = event
                .composedPath()
                .find(node => node instanceof HTMLElement && node.dataset?.sceneEntity);
              return button?.dataset?.sceneEntity || null;
            },
            shouldBeginHold: entityId => this._canRunHoldAction(entityId),
            onHold: entityId => {
              this._triggerHaptic();
              this._performHoldAction(entityId);
            },
            markHoldConsumedClick: () => {
              this._suppressNextSceneTap = true;
            },
          })
        : () => {};
    }

  connectedCallback() {
    this._detachHostHold?.reconnect?.();
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    this._detachHostHold?.();
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._cancelScrollRestore?.();
    this._cancelScrollRestore = null;
    cancelDashboardScrollRestore();
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const nextSignature = this._getRenderSignature();
    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }
    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    const layout = ["list", "single"].includes(this._config?.layout) ? this._config.layout : "grid";
    const count = Math.max(1, resolveSceneEntries(this._config, this._hass).length || 1);
    if (layout === "single") {
      return 2;
    }
    if (layout === "list") {
      return Math.min(6, count + 1);
    }
    const columns = clamp(Math.round(Number(this._config?.columns) || 3), 1, 6);
    return Math.min(6, Math.ceil(count / columns) + 1);
  }

  getGridOptions() {
    return { columns: "full", min_columns: 2, min_rows: 2, rows: "auto" };
  }

  _getAnimationSettings() {
    const animations = this._config?.animations || DEFAULT_CONFIG.animations;
    return {
      enabled: animations.enabled !== false,
      contentDuration: clamp(Math.round(Number(animations.content_duration) || 420), 0, 2000),
      buttonBounceDuration: clamp(Math.round(Number(animations.button_bounce_duration) || 320), 0, 1200),
      launchDuration: clamp(Math.round(Number(animations.launch_duration) || SCENE_LAUNCH_DURATION), 240, 2400),
    };
  }

  _scenesUiCopy() {
    const NI = window.NodaliaI18n;
    if (!NI?.strings || !NI.resolveLanguage) {
      return {
        emptyTitle: "Nodalia Scenes Card",
        emptyBody: "Add scene entities in the card editor.",
        defaultName: "Scenes",
        unavailable: "Unavailable",
        subtitle: "Tap a mood to launch",
        moods: "moods",
      };
    }
    const lang = NI.resolveLanguage(this._hass, this._config?.language);
    const scenes = NI.strings(lang).scenes || {};
    return {
      emptyTitle: scenes.emptyTitle || "Nodalia Scenes Card",
      emptyBody: scenes.emptyBody || "Add scene entities in the card editor.",
      defaultName: scenes.defaultName || "Scenes",
      unavailable: scenes.unavailable || "Unavailable",
      subtitle: scenes.subtitle || "Tap a mood to launch",
      moods: scenes.moods || "moods",
    };
  }

  _getRenderSignature() {
    const config = this._config || {};
    const entries = resolveSceneEntries(config, this._hass);
    const sceneStamp = (Array.isArray(config.scenes) ? config.scenes : [])
      .map(item => (typeof item === "string" ? item : `${item?.entity || ""}:${item?.tint || ""}`))
      .join("|");
    const styles = config.styles || {};
    return [
      CARD_VERSION,
      config.layout || "grid",
      config.columns ?? 3,
      config.name || "",
      config.language || "auto",
      config.show_title !== false,
      styles.accent || "",
      styles.icon?.size || "",
      sceneStamp,
      entries.map(entry => `${entry.entity}:${entry.unavailable}:${entry.accent}`).join("|"),
    ].join("::");
  }

  _canRunHoldAction(entityId) {
    const action = normalizeTextKey(this._config?.hold_action);
    return Boolean(entityId) && action !== "none";
  }

  _triggerHaptic(styleOverride) {
    const haptics = this._config?.haptics || DEFAULT_CONFIG.haptics;
    if (haptics.enabled === false) {
      return;
    }
    const style = styleOverride || haptics.style || "medium";
    fireEvent(this, "haptic", style, { bubbles: true, composed: true });
    if (haptics.fallback_vibrate && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      const pattern = HAPTIC_PATTERNS[style] ?? HAPTIC_PATTERNS.medium;
      try {
        navigator.vibrate(pattern);
      } catch (_error) {
        // Ignore unsupported vibrate.
      }
    }
  }

  _triggerPressAnimation(tile) {
    if (!(tile instanceof HTMLElement)) {
      return;
    }
    const animations = this._getAnimationSettings();
    tile.classList.remove("is-pressing");
    void tile.offsetWidth;
    tile.classList.add("is-pressing");
    const schedule = window.NodaliaUtils?.scheduleDeferTimer;
    const done = () => {
      if (!tile.isConnected) {
        return;
      }
      tile.classList.remove("is-pressing");
    };
    if (typeof schedule === "function") {
      schedule(this, done, animations.buttonBounceDuration);
    } else {
      window.setTimeout(done, animations.buttonBounceDuration);
    }
  }

  _triggerLaunchAnimation(tile) {
    if (!(tile instanceof HTMLElement)) {
      return;
    }
    const duration = this._getAnimationSettings().launchDuration;
    tile.classList.remove("scenes-card__tile--launching");
    const icon = tile.querySelector(".scenes-card__tile-icon");
    if (icon instanceof HTMLElement) {
      icon.classList.remove("scenes-card__tile-icon--launching");
    }
    void tile.offsetWidth;
    tile.classList.add("scenes-card__tile--launching");
    if (icon instanceof HTMLElement) {
      icon.classList.add("scenes-card__tile-icon--launching");
    }
    const schedule = window.NodaliaUtils?.scheduleDeferTimer;
    const done = () => {
      if (!tile.isConnected) {
        return;
      }
      tile.classList.remove("scenes-card__tile--launching");
      if (icon instanceof HTMLElement) {
        icon.classList.remove("scenes-card__tile-icon--launching");
      }
    };
    if (typeof schedule === "function") {
      schedule(this, done, duration);
    } else {
      window.setTimeout(done, duration);
    }
  }

  _openMoreInfo(entityId) {
    if (!entityId) {
      return;
    }
    fireEvent(this, "hass-more-info", { entityId });
  }

  _captureDashboardScrollSnapshot() {
    return collectDashboardScrollSnapshot(this);
  }

  _scheduleDashboardScrollRestore(snapshot = this._interactionScrollSnapshot) {
    this._cancelScrollRestore?.();
    this._cancelScrollRestore = scheduleDashboardScrollRestore(snapshot);
  }

  _rememberSceneInteractionScroll(button) {
    this._interactionScrollSnapshot = collectDashboardScrollSnapshot(button || this);
    this._sceneInteractionScrollUntil = Date.now() + 1200;
  }

  _blurSceneInteractionFocus() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && this.shadowRoot?.contains(active)) {
      active.blur();
    }
  }

  _activateScene(entityId) {
    if (!this._hass || !entityId) {
      return;
    }
    this._triggerHaptic("success");
    this._hass.callService("scene", "turn_on", { entity_id: entityId });
    const tile = this.shadowRoot?.querySelector(`[data-scene-entity="${escapeSelectorValue(entityId)}"]`);
    this._triggerLaunchAnimation(tile);
    this._scheduleDashboardScrollRestore(this._interactionScrollSnapshot);
  }

  _performTapAction(entityId) {
    const action = normalizeTextKey(this._config?.tap_action);
    if (action === "none") {
      return;
    }
    if (action === "more-info") {
      this._triggerHaptic("selection");
      this._openMoreInfo(entityId);
      return;
    }
    this._activateScene(entityId);
  }

  _performHoldAction(entityId) {
    const action = normalizeTextKey(this._config?.hold_action);
    if (action === "none") {
      return;
    }
    const button = this.shadowRoot?.querySelector(`[data-scene-entity="${escapeSelectorValue(entityId)}"]`);
    this._triggerPressAnimation(button);
    if (action === "more-info") {
      this._openMoreInfo(entityId);
      return;
    }
    this._activateScene(entityId);
  }

  _findSceneButtonFromEvent(event) {
    const button = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.sceneEntity);
    if (!button || button.dataset.unavailable === "true" || button.getAttribute("aria-disabled") === "true") {
      return null;
    }
    return button;
  }

  _prepareSceneInteraction(event, button) {
    this._rememberSceneInteractionScroll(button);
    event.preventDefault();
    this._blurSceneInteractionFocus();
  }

  _onShadowPointerDown(event) {
    const button = this._findSceneButtonFromEvent(event);
    if (!button) {
      return;
    }
    if (typeof event.button === "number" && event.button !== 0) {
      return;
    }
    if (event.pointerType === "touch") {
      this._rememberSceneInteractionScroll(button);
      this._triggerPressAnimation(button);
      return;
    }
    this._prepareSceneInteraction(event, button);
    this._triggerPressAnimation(button);
  }

  _onShadowMouseDown(event) {
    const button = this._findSceneButtonFromEvent(event);
    if (!button || event.button !== 0) {
      return;
    }
    this._prepareSceneInteraction(event, button);
  }

  _onShadowTouchStart(event) {
    const button = this._findSceneButtonFromEvent(event);
    if (!button) {
      return;
    }
    this._rememberSceneInteractionScroll(button);
    this._triggerPressAnimation(button);
  }

  _onShadowClick(event) {
    if (this._suppressNextSceneTap) {
      this._suppressNextSceneTap = false;
      return;
    }
    const button = event
      .composedPath()
      .find(node => node instanceof HTMLElement && node.dataset?.sceneEntity);
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const entityId = button.dataset.sceneEntity;
    if (!entityId || button.dataset.unavailable === "true" || button.getAttribute("aria-disabled") === "true") {
      return;
    }
    this._rememberSceneInteractionScroll(button);
    this._blurSceneInteractionFocus();
    this._triggerPressAnimation(button);
    this._performTapAction(entityId);
    this._scheduleDashboardScrollRestore();
  }

  _renderEmptyState() {
    const ui = this._scenesUiCopy();
    const styles = getSafeStyles(this._config?.styles);
    return `
      <style>
        :host { display: block; }
        * { box-sizing: border-box; }
        ha-card {
          background: ${styles.card.background};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          color: var(--primary-text-color);
          display: grid;
          gap: 8px;
          padding: 16px;
        }
        .scenes-card__empty-title { font-size: 15px; font-weight: 700; letter-spacing: -0.02em; }
        .scenes-card__empty-text { color: var(--secondary-text-color); font-size: 13px; line-height: 1.5; }
      </style>
      <ha-card class="scenes-card scenes-card--empty">
        <div class="scenes-card__empty-title">${escapeHtml(ui.emptyTitle)}</div>
        <div class="scenes-card__empty-text">${escapeHtml(ui.emptyBody)}</div>
      </ha-card>
    `;
  }

  _getSceneTilePresentation(entry, styles, layout = "grid") {
    const iconSize = parseSizeToPixels(styles.icon.size, 44);
    const listIconSize = Math.max(42, iconSize - 2);
    const bubbleSize = layout === "single"
      ? Math.max(56, iconSize + 12)
      : layout === "list"
        ? listIconSize
        : Math.max(46, iconSize + 2);
    const darkenBubbleIconGlyph = Boolean(
      window.NodaliaBubbleContrast?.shouldDarkenBubbleIconGlyph(
        { entity_id: entry.entity || "scene.placeholder" },
        entry.accent,
      ),
    );
    const iconGlyphColor = darkenBubbleIconGlyph
      ? `color-mix(in srgb, var(--primary-text-color) 56%, ${entry.accent})`
      : entry.accent;
    return {
      style: `--scene-accent: ${escapeHtml(entry.accent)}; --scene-icon-glyph: ${escapeHtml(iconGlyphColor)}; --scene-bubble-size: ${bubbleSize}px;`,
      tileClass: `scenes-card__tile scenes-card__tile--${layout}`,
    };
  }

  _renderSceneTileContent(entry, ui) {
    return `
      <span class="scenes-card__tile-ambient" aria-hidden="true"></span>
      <span class="scenes-card__tile-shimmer" aria-hidden="true"></span>
      <span class="scenes-card__tile-burst" aria-hidden="true"></span>
      <span class="scenes-card__tile-launch" aria-hidden="true"></span>
      <span class="scenes-card__tile-body">
        <span class="scenes-card__tile-icon">
          ${
            entry.picture
              ? `<img src="${escapeHtml(entry.picture)}" alt="" loading="lazy" />`
              : `<ha-icon icon="${escapeHtml(entry.icon)}"></ha-icon>`
          }
        </span>
        <span class="scenes-card__tile-copy">
          <span class="scenes-card__tile-label">${escapeHtml(entry.label)}</span>
          ${entry.unavailable ? `<span class="scenes-card__tile-state">${escapeHtml(ui.unavailable)}</span>` : `<span class="scenes-card__tile-hint">${escapeHtml(ui.subtitle)}</span>`}
        </span>
      </span>
    `;
  }

  _renderSceneTile(entry, styles, ui, isList) {
    const presentation = this._getSceneTilePresentation(entry, styles, isList ? "list" : "grid");
    return `
      <div
        role="button"
        tabindex="-1"
        class="${presentation.tileClass}"
        data-scene-entity="${escapeHtml(entry.entity)}"
        data-unavailable="${entry.unavailable ? "true" : "false"}"
        ${entry.unavailable ? 'aria-disabled="true"' : ""}
        aria-label="${escapeHtml(entry.label)}"
        style="${presentation.style}"
      >
        ${this._renderSceneTileContent(entry, ui)}
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || {};
    const entries = resolveSceneEntries(config, this._hass);
    if (!entries.length) {
      this.shadowRoot.innerHTML = this._renderEmptyState();
      return;
    }

    const ui = this._scenesUiCopy();
    const styles = getSafeStyles(config.styles);
    const animations = this._getAnimationSettings();
    const showTitle = config.show_title !== false;
    const title = String(config.name || "").trim() || ui.defaultName;
    const isList = config.layout === "list";
    const isSingle = config.layout === "single";
    const isGrid = !isList && !isSingle;
    const singleEntry = isSingle ? entries[0] : null;
    const renderedEntries = isSingle ? entries.slice(0, 1) : entries;
    const columns = clamp(Math.round(Number(config.columns) || 3), 1, 6);
    const shouldAnimate = animations.enabled && this._animateContentOnNextRender;
    const accentColor = singleEntry?.accent || styles.accent;
    const singlePresentation = singleEntry
      ? this._getSceneTilePresentation(singleEntry, styles, "single")
      : null;
    const chipBorderRadius = escapeHtml(styles.chip_border_radius);
    const configuredBorder = String(styles.card.border || "").trim();
    const defaultBorder = String(DEFAULT_CONFIG.styles.card.border || "").trim();
    const cardBackground = `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 14%, ${styles.card.background}) 0%, color-mix(in srgb, ${accentColor} 6%, ${styles.card.background}) 48%, ${styles.card.background} 100%)`;
    const cardBorder = !configuredBorder || configuredBorder === defaultBorder
      ? `1px solid color-mix(in srgb, ${accentColor} 20%, var(--divider-color))`
      : configuredBorder;
    const cardShadow = `${styles.card.box_shadow}, 0 18px 36px color-mix(in srgb, ${accentColor} 10%, rgba(0, 0, 0, 0.18))`;
    const tileBorderRadius = styles.button.border_radius;
    const tileMinHeight = styles.button.min_height;
    if (shouldAnimate) {
      this._animateContentOnNextRender = false;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --scenes-card-button-bounce-duration: ${animations.enabled ? animations.buttonBounceDuration : 0}ms;
          --scenes-card-content-duration: ${animations.enabled ? animations.contentDuration : 0}ms;
          --scenes-card-launch-duration: ${animations.enabled ? animations.launchDuration : 0}ms;
          --scenes-accent: ${accentColor};
          display: block;
          overflow-anchor: none;
        }

        * { box-sizing: border-box; }

        ha-card {
          background:
            radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--scenes-accent) 16%, transparent), transparent 58%),
            radial-gradient(90% 70% at 100% 0%, color-mix(in srgb, var(--scenes-accent) 10%, transparent), transparent 52%),
            ${cardBackground};
          border: ${cardBorder};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${cardShadow};
          color: var(--primary-text-color);
          display: grid;
          gap: ${styles.card.gap};
          overflow: hidden;
          overflow-anchor: none;
          padding: ${styles.card.padding};
          position: relative;
          touch-action: manipulation;
        }

        ha-card::before {
          background: linear-gradient(180deg, color-mix(in srgb, var(--scenes-accent) 12%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)), rgba(255, 255, 255, 0) 46%);
          border-radius: inherit;
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .scenes-card__header,
        .scenes-card__grid {
          position: relative;
          z-index: 1;
        }

        .scenes-card__header {
          align-items: center;
          display: flex;
          gap: 12px;
          min-width: 0;
        }

        .scenes-card__header--entering {
          animation: scenes-card-fade-up calc(var(--scenes-card-content-duration) * 0.9) cubic-bezier(0.22, 0.84, 0.26, 1) both;
        }

        .scenes-card__brand {
          align-items: center;
          display: flex;
          flex: 1 1 auto;
          gap: 12px;
          min-width: 0;
        }

        .scenes-card__brand-icon {
          align-items: center;
          background:
            radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--scenes-accent) 36%, transparent), transparent 62%),
            color-mix(in srgb, var(--scenes-accent) 14%, ${styles.icon.background});
          border: 1px solid color-mix(in srgb, var(--scenes-accent) 28%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 10%, transparent),
            0 10px 22px color-mix(in srgb, var(--scenes-accent) 16%, rgba(0, 0, 0, 0.14));
          color: ${styles.icon.on_color};
          display: inline-flex;
          flex: 0 0 auto;
          height: 38px;
          justify-content: center;
          width: 38px;
        }

        .scenes-card__brand-icon ha-icon {
          --mdc-icon-size: 20px;
        }

        .scenes-card__title-wrap {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .scenes-card__title {
          font-size: ${styles.title_size};
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scenes-card__subtitle {
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.01em;
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scenes-card__count-chip {
          align-items: center;
          background: color-mix(in srgb, var(--scenes-accent) 10%, color-mix(in srgb, var(--primary-text-color) 4%, transparent));
          border: 1px solid color-mix(in srgb, var(--scenes-accent) 22%, transparent);
          border-radius: ${chipBorderRadius};
          box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          color: color-mix(in srgb, var(--scenes-accent) 72%, var(--primary-text-color));
          display: inline-flex;
          flex: 0 0 auto;
          font-size: 10px;
          font-weight: 800;
          height: 24px;
          letter-spacing: 0.05em;
          padding: 0 10px;
          text-transform: uppercase;
        }

        .scenes-card__grid {
          display: grid;
          gap: ${styles.button.gap};
          grid-template-columns: ${isGrid ? `repeat(${columns}, minmax(0, 1fr))` : "minmax(0, 1fr)"};
        }

        .scenes-card__grid--entering {
          animation: scenes-card-fade-up calc(var(--scenes-card-content-duration) * 0.95) cubic-bezier(0.22, 0.84, 0.26, 1) both;
          animation-delay: 40ms;
        }

        .scenes-card__tile {
          -webkit-tap-highlight-color: transparent;
          appearance: none;
          border: 1px solid color-mix(in srgb, var(--scene-accent) 26%, color-mix(in srgb, var(--primary-text-color) 8%, transparent));
          border-radius: ${tileBorderRadius};
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent),
            0 14px 30px color-mix(in srgb, var(--scene-accent) 14%, rgba(0, 0, 0, 0.16));
          color: var(--primary-text-color);
          cursor: pointer;
          display: block;
          isolation: isolate;
          min-height: ${tileMinHeight};
          min-width: 0;
          overflow: hidden;
          position: relative;
          touch-action: manipulation;
          transition:
            transform 220ms cubic-bezier(0.33, 1, 0.68, 1),
            box-shadow 260ms cubic-bezier(0.33, 1, 0.68, 1),
            border-color 220ms ease,
            filter 260ms ease;
          width: 100%;
        }

        .scenes-card__tile::after {
          background:
            linear-gradient(145deg,
              color-mix(in srgb, var(--scene-accent) 28%, color-mix(in srgb, var(--primary-text-color) 4%, transparent)) 0%,
              color-mix(in srgb, var(--scene-accent) 10%, transparent) 46%,
              color-mix(in srgb, var(--primary-text-color) 3%, transparent) 100%);
          border-radius: inherit;
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 0;
        }

        .scenes-card__tile-ambient {
          background:
            radial-gradient(ellipse 90% 70% at 18% 8%, color-mix(in srgb, var(--scene-accent) 42%, transparent), transparent 68%),
            radial-gradient(ellipse 70% 55% at 92% 88%, color-mix(in srgb, var(--scene-accent) 22%, transparent), transparent 72%);
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 1;
        }

        .scenes-card__tile-shimmer {
          background: linear-gradient(115deg, transparent 36%, color-mix(in srgb, var(--primary-text-color) 10%, transparent) 50%, transparent 64%);
          inset: 0;
          opacity: 0.35;
          pointer-events: none;
          position: absolute;
          z-index: 2;
        }

        .scenes-card__tile-burst {
          background: radial-gradient(circle at 50% 46%, color-mix(in srgb, var(--scene-accent) 36%, transparent), transparent 72%);
          inset: 0;
          opacity: 0;
          pointer-events: none;
          position: absolute;
          transform: scale(0.92);
          z-index: 3;
        }

        .scenes-card__tile-launch {
          border-radius: inherit;
          box-shadow: 0 0 0 0 color-mix(in srgb, var(--scene-accent) 0%, transparent);
          inset: 0;
          opacity: 0;
          pointer-events: none;
          position: absolute;
          z-index: 4;
        }

        .scenes-card__tile-body {
          align-items: center;
          display: flex;
          flex-direction: column;
          gap: 10px;
          height: 100%;
          justify-content: center;
          min-height: inherit;
          padding: 14px 12px 12px;
          position: relative;
          z-index: 3;
        }

        .scenes-card__tile--list .scenes-card__tile-body {
          align-items: center;
          flex-direction: row;
          gap: 14px;
          justify-content: flex-start;
          min-height: 64px;
          padding: 12px 16px 12px 18px;
          text-align: left;
        }

        ha-card.scenes-card--single {
          border-radius: ${styles.card.border_radius};
          min-height: max(104px, ${tileMinHeight});
          padding: 0;
        }

        .scenes-card__tile--single .scenes-card__tile-body {
          align-items: center;
          flex-direction: row;
          gap: 16px;
          justify-content: flex-start;
          min-height: max(104px, ${tileMinHeight});
          padding: 16px 20px;
          text-align: left;
        }

        .scenes-card__tile--single .scenes-card__tile-copy {
          flex: 1 1 auto;
        }

        .scenes-card__tile--single .scenes-card__tile-label {
          font-size: max(15px, ${styles.button.label_size});
          white-space: normal;
        }

        .scenes-card__tile--single .scenes-card__tile-hint,
        .scenes-card__tile--single .scenes-card__tile-state {
          font-size: 11px;
        }

        .scenes-card__tile--list::before {
          background: linear-gradient(180deg, var(--scene-accent), color-mix(in srgb, var(--scene-accent) 42%, transparent));
          border-radius: 999px 0 0 999px;
          bottom: 10px;
          content: "";
          left: 0;
          position: absolute;
          top: 10px;
          width: 4px;
          z-index: 5;
        }

        .scenes-card__tile:hover:not([aria-disabled="true"]) {
          border-color: color-mix(in srgb, var(--scene-accent) 40%, transparent);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 10%, transparent),
            0 18px 36px color-mix(in srgb, var(--scene-accent) 20%, rgba(0, 0, 0, 0.2));
          transform: translateY(-1px);
        }

        .scenes-card__tile.is-pressing {
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent),
            0 8px 18px color-mix(in srgb, var(--scene-accent) 10%, rgba(0, 0, 0, 0.12));
          filter: brightness(0.98);
          transform: scale(0.988);
        }

        .scenes-card__tile--launching {
          animation: scenes-card-tile-launch var(--scenes-card-launch-duration) cubic-bezier(0.22, 1, 0.36, 1) both;
          z-index: 2;
        }

        .scenes-card__tile--launching .scenes-card__tile-ambient {
          animation: scenes-card-tile-ambient-launch var(--scenes-card-launch-duration) cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .scenes-card__tile--launching .scenes-card__tile-burst {
          animation: scenes-card-tile-burst var(--scenes-card-launch-duration) cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .scenes-card__tile--launching .scenes-card__tile-launch {
          animation: scenes-card-tile-launch-ring var(--scenes-card-launch-duration) cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .scenes-card__tile--launching .scenes-card__tile-shimmer {
          animation: scenes-card-tile-shimmer calc(var(--scenes-card-launch-duration) * 0.88) cubic-bezier(0.33, 1, 0.68, 1) both;
        }

        .scenes-card__tile-icon--launching {
          animation: scenes-card-tile-icon-launch calc(var(--scenes-card-launch-duration) * 0.82) cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .scenes-card__tile[aria-disabled="true"] {
          cursor: default;
          filter: grayscale(0.35);
          opacity: 0.55;
          pointer-events: none;
        }

        .scenes-card__tile-icon {
          align-items: center;
          backdrop-filter: blur(10px);
          background:
            radial-gradient(circle at 30% 22%, color-mix(in srgb, var(--scene-accent) 34%, transparent), transparent 58%),
            color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--scene-accent) 32%, color-mix(in srgb, var(--primary-text-color) 10%, transparent));
          border-radius: 999px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 12%, transparent),
            0 12px 24px color-mix(in srgb, var(--scene-accent) 22%, rgba(0, 0, 0, 0.18));
          color: var(--scene-icon-glyph, var(--scene-accent));
          display: inline-flex;
          flex: 0 0 auto;
          height: var(--scene-bubble-size);
          justify-content: center;
          overflow: hidden;
          width: var(--scene-bubble-size);
        }

        .scenes-card__tile-icon ha-icon {
          --mdc-icon-size: ${styles.button.icon_size};
          filter: drop-shadow(0 2px 8px color-mix(in srgb, var(--scene-accent) 28%, transparent));
        }

        .scenes-card__tile-icon img {
          border-radius: inherit;
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .scenes-card__tile-copy {
          display: grid;
          gap: 4px;
          min-width: 0;
          width: 100%;
        }

        .scenes-card__tile--list .scenes-card__tile-copy {
          flex: 1 1 auto;
        }

        .scenes-card__tile-label {
          font-size: ${styles.button.label_size};
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.2;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scenes-card__tile--list .scenes-card__tile-label {
          font-size: calc(${styles.button.label_size} + 1px);
          white-space: normal;
        }

        .scenes-card__tile-hint,
        .scenes-card__tile-state {
          color: color-mix(in srgb, var(--scene-accent) 62%, var(--secondary-text-color));
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.03em;
          line-height: 1.25;
          opacity: 0.92;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scenes-card__tile-state {
          color: var(--error-color, #ff4d4f);
          opacity: 1;
          text-transform: uppercase;
        }

        @keyframes scenes-card-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes scenes-card-tile-launch {
          0% {
            box-shadow:
              inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent),
              0 14px 30px color-mix(in srgb, var(--scene-accent) 14%, rgba(0, 0, 0, 0.16));
            filter: brightness(1) saturate(1);
            transform: scale(1);
          }
          22% {
            box-shadow:
              inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 10%, transparent),
              0 0 0 4px color-mix(in srgb, var(--scene-accent) 16%, transparent),
              0 16px 34px color-mix(in srgb, var(--scene-accent) 20%, rgba(0, 0, 0, 0.18));
            filter: brightness(1.045) saturate(1.04);
            transform: scale(0.992);
          }
          52% {
            box-shadow:
              inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 9%, transparent),
              0 0 0 10px color-mix(in srgb, var(--scene-accent) 6%, transparent),
              0 18px 36px color-mix(in srgb, var(--scene-accent) 16%, rgba(0, 0, 0, 0.14));
            filter: brightness(1.03) saturate(1.02);
            transform: scale(1.004);
          }
          100% {
            box-shadow:
              inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 8%, transparent),
              0 0 0 0 transparent,
              0 14px 28px color-mix(in srgb, var(--scene-accent) 12%, rgba(0, 0, 0, 0.12));
            filter: brightness(1) saturate(1);
            transform: scale(1);
          }
        }

        @keyframes scenes-card-tile-ambient-launch {
          0%, 100% { filter: brightness(1); opacity: 1; }
          34% { filter: brightness(1.1); opacity: 1; }
        }

        @keyframes scenes-card-tile-burst {
          0% { opacity: 0; transform: scale(0.94); }
          28% { opacity: 0.32; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.06); }
        }

        @keyframes scenes-card-tile-launch-ring {
          0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--scene-accent) 0%, transparent); opacity: 0; }
          24% { box-shadow: 0 0 0 1px color-mix(in srgb, var(--scene-accent) 28%, transparent); opacity: 0.85; }
          100% { box-shadow: 0 0 0 12px color-mix(in srgb, var(--scene-accent) 0%, transparent); opacity: 0; }
        }

        @keyframes scenes-card-tile-shimmer {
          0% { opacity: 0; transform: translateX(-36%) skewX(-5deg); }
          38% { opacity: 0.28; }
          100% { opacity: 0; transform: translateX(36%) skewX(-5deg); }
        }

        @keyframes scenes-card-tile-icon-launch {
          0% { transform: scale(1); }
          30% { transform: scale(1.045); }
          100% { transform: scale(1); }
        }
        ${window.NodaliaUtils?.renderReducedMotionStyles?.() || ""}
      </style>
      <ha-card
        class="scenes-card ${isSingle ? `scenes-card--single ${singlePresentation.tileClass}` : ""}"
        ${isSingle ? 'role="button" tabindex="-1"' : ""}
        ${singleEntry ? `data-scene-entity="${escapeHtml(singleEntry.entity)}" data-unavailable="${singleEntry.unavailable ? "true" : "false"}" aria-label="${escapeHtml(singleEntry.label)}"` : ""}
        ${singleEntry?.unavailable ? 'aria-disabled="true"' : ""}
        ${singlePresentation ? `style="${singlePresentation.style}"` : ""}
      >
        ${isSingle
          ? this._renderSceneTileContent(singleEntry, ui)
          : `
            ${
              showTitle
                ? `<div class="scenes-card__header ${shouldAnimate ? "scenes-card__header--entering" : ""}">
                    <div class="scenes-card__brand">
                      <span class="scenes-card__brand-icon" aria-hidden="true">
                        <ha-icon icon="mdi:palette-swatch-variant"></ha-icon>
                      </span>
                      <div class="scenes-card__title-wrap">
                        <div class="scenes-card__title">${escapeHtml(title)}</div>
                        <div class="scenes-card__subtitle">${escapeHtml(ui.subtitle)}</div>
                      </div>
                    </div>
                    <span class="scenes-card__count-chip">${entries.length} ${escapeHtml(ui.moods)}</span>
                  </div>`
                : ""
            }
            <div class="scenes-card__grid ${shouldAnimate ? "scenes-card__grid--entering" : ""}">
              ${renderedEntries.map(entry => this._renderSceneTile(entry, styles, ui, isList)).join("")}
            </div>
          `}
      </ha-card>
    `;

    if (Date.now() < (this._sceneInteractionScrollUntil || 0)) {
      this._scheduleDashboardScrollRestore(this._interactionScrollSnapshot);
    }

    this.style.setProperty("--scenes-accent", accentColor);
  }
}
  _lazyNodaliaScenesCard = NodaliaScenesCard;
  return NodaliaScenesCard;
}
