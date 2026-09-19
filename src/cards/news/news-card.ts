// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  EDITOR_TAG,
  MAGAZINE_SLIDE_TRANSITION_MS,
  MAGAZINE_SWIPE_LOCK_PX,
  MAGAZINE_SWIPE_THRESHOLD_PX,
  NEWS_HISTORY_HELPER_WRITE_MS,
} from "./news-constants";
import { deepClone } from "./news-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./news-config";
import {
  applyNewsFilters,
  buildNewsRenderStamp,
  collectNormalizedItems,
  escapeHtml,
  formatRelativePublished,
  getLocaleTag,
  getNewsHistoryHelperSignature,
  getNewsHistoryStorageKey,
  getNewsSourceHealth,
  isSafeHttpUrl,
  loadNewsHistoryFromHelper,
  loadNewsHistoryFromStorage,
  mergeNewsItemHistory,
  resolveSourceEntries,
  saveNewsHistoryToStorage,
  writeNewsHistoryToHelper,
} from "./news-helpers";

export class NodaliaNewsCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities = [], entitiesFallback = []) {
    const config = deepClone(STUB_CONFIG);
    const entityId = window.NodaliaUtils
      .findStubEntityIds(
        hass,
        entities,
        entitiesFallback,
        ["sensor"],
        Object.keys(hass?.states || {}).length,
      )
      .find(id => (
        Array.isArray(hass.states[id]?.attributes?.items)
        && hass.states[id].attributes.items.length
      ));
    if (entityId) {
      config.sources = [{ entity: entityId, name: "News" }];
    }
    return config;
  }

  static getEntitySuggestion(hass, entityId) {
    return window.NodaliaUtils.createEntitySuggestion(CARD_TAG, hass, entityId, {
      domains: ["sensor"],
      isSupported: (_hass, selectedEntityId) => (
        Array.isArray(hass?.states?.[selectedEntityId]?.attributes?.items)
      ),
      buildConfig: (_hass, selectedEntityId) => ({
        sources: [{ entity: selectedEntityId, name: "News" }],
      }),
    });
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
    this._animateContentOnNextRender = true;
    this._entranceAnimationResetTimer = 0;
    this._magazineIndex = 0;
    this._magazineItemsStamp = "";
    this._magazineSwipeState = null;
    this._magazineSwipeWindowAttached = false;
    this._suppressArticleTap = false;
    this._newsHistory = [];
    this._historyStorageKey = "";
    this._historyHelperEntityId = "";
    this._historyHelperSignature = "";
    this._historyHelperWriteTimer = 0;
    this._magazineSlideResetTimer = 0;
    this._onShadowClick = this._onShadowClick.bind(this);
    this._onShadowKeyDown = this._onShadowKeyDown.bind(this);
    this._onShadowPointerDown = this._onShadowPointerDown.bind(this);
    this._onWindowMagazinePointerMove = this._onWindowMagazinePointerMove.bind(this);
    this._onWindowMagazinePointerUp = this._onWindowMagazinePointerUp.bind(this);
    this.shadowRoot.addEventListener("click", this._onShadowClick);
    this.shadowRoot.addEventListener("keydown", this._onShadowKeyDown);
    this.shadowRoot.addEventListener("pointerdown", this._onShadowPointerDown, true);
  }

  connectedCallback() {
    this._animateContentOnNextRender = true;
    if (this._hass && this._config) {
      this._lastRenderSignature = "";
      this._render();
    }
  }

  disconnectedCallback() {
    if (this._entranceAnimationResetTimer) {
      window.clearTimeout(this._entranceAnimationResetTimer);
      this._entranceAnimationResetTimer = 0;
    }
    if (this._historyHelperWriteTimer) {
      window.clearTimeout(this._historyHelperWriteTimer);
      this._historyHelperWriteTimer = 0;
    }
    if (this._magazineSlideResetTimer) {
      window.clearTimeout(this._magazineSlideResetTimer);
      this._magazineSlideResetTimer = 0;
    }
    this._cancelMagazineSwipe();
    window.NodaliaUtils?.clearDeferTimers?.(this);
    this._animateContentOnNextRender = true;
    this._lastRenderSignature = "";
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._lastRenderSignature = "";
    this._magazineItemsStamp = "";
    this._magazineIndex = 0;
    this._historyStorageKey = "";
    this._historyHelperEntityId = "";
    this._historyHelperSignature = "";
    this._newsHistory = [];
    this._animateContentOnNextRender = true;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const nextSignature = this._getRenderSignature(hass);
    if (this.shadowRoot?.innerHTML && nextSignature === this._lastRenderSignature) {
      return;
    }
    this._lastRenderSignature = nextSignature;
    this._render();
  }

  getCardSize() {
    const mode = this._config?.layout?.mode || "magazine";
    if (mode === "compact") {
      return 3;
    }
    if (mode === "list") {
      return 4;
    }
    return 5;
  }

  getGridOptions() {
    return {
      rows: "auto",
      columns: "full",
      min_rows: 3,
      min_columns: 6,
    };
  }

  _ui(key, fallback = "", values = {}) {
    if (window.NodaliaI18n?.translateNewsUi) {
      return window.NodaliaI18n.translateNewsUi(
        this._hass,
        this._config?.language ?? "auto",
        key,
        fallback,
        values,
      );
    }
    let text = fallback;
    Object.entries(values).forEach(([name, value]) => {
      text = text.replace(`{${name}}`, String(value));
    });
    return text;
  }

  _getSourceEntries() {
    return resolveSourceEntries(this._config);
  }

  _getSourceHealth(hass = this._hass) {
    return getNewsSourceHealth(hass, this._config);
  }

  _ensureNewsHistory(incoming) {
    const config = this._config || DEFAULT_CONFIG;
    const helperEntityId = String(config.history_helper || "").trim();
    const storageKey = getNewsHistoryStorageKey(config);
    const helperSignature = helperEntityId
      ? getNewsHistoryHelperSignature(this._hass, helperEntityId)
      : "";

    if (helperEntityId && this._hass) {
      if (
        helperEntityId !== this._historyHelperEntityId
        || helperSignature !== this._historyHelperSignature
      ) {
        this._historyHelperEntityId = helperEntityId;
        this._historyHelperSignature = helperSignature;
        this._newsHistory = loadNewsHistoryFromHelper(this._hass, helperEntityId);
      }
    } else if (storageKey !== this._historyStorageKey) {
      this._historyStorageKey = storageKey;
      this._historyHelperEntityId = "";
      this._historyHelperSignature = "";
      this._newsHistory = loadNewsHistoryFromStorage(storageKey);
    }

    const merged = mergeNewsItemHistory(this._newsHistory, incoming, config.max_items);
    const previousStamp = buildNewsRenderStamp(this._newsHistory);
    const nextStamp = buildNewsRenderStamp(merged);
    if (previousStamp !== nextStamp) {
      this._newsHistory = merged;
      if (helperEntityId && this._hass) {
        this._scheduleNewsHistoryHelperWrite(merged, helperEntityId);
      }
      if (!helperEntityId || config.mirror_history_local !== false) {
        if (!this._historyStorageKey) {
          this._historyStorageKey = storageKey;
        }
        saveNewsHistoryToStorage(this._historyStorageKey, merged);
      }
    }
    return merged;
  }

  _scheduleNewsHistoryHelperWrite(items, helperEntityId) {
    if (this._historyHelperWriteTimer) {
      window.clearTimeout(this._historyHelperWriteTimer);
    }
    const entityId = String(helperEntityId || this._config?.history_helper || "").trim();
    if (!entityId) {
      return;
    }
    this._historyHelperWriteTimer = window.setTimeout(() => {
      this._historyHelperWriteTimer = 0;
      if (!this.isConnected || !this._hass) {
        return;
      }
      if (writeNewsHistoryToHelper(this._hass, entityId, items)) {
        this._historyHelperSignature = getNewsHistoryHelperSignature(this._hass, entityId);
      }
    }, NEWS_HISTORY_HELPER_WRITE_MS);
  }

  _getDisplayItems(hass = this._hass) {
    if (!hass) {
      return [];
    }
    const config = this._config || DEFAULT_CONFIG;
    const collected = collectNormalizedItems(hass, config);
    const pool = config.remember_items !== false
      ? this._ensureNewsHistory(collected)
      : collected;
    return applyNewsFilters(pool, config);
  }

  _getRenderSignature(hass = this._hass) {
    const config = this._config || DEFAULT_CONFIG;
    const layout = config.layout || DEFAULT_CONFIG.layout;
    const items = this._getDisplayItems(hass);
    const health = getNewsSourceHealth(hass, config);
    const joinParts = window.NodaliaRenderSignature?.joinParts;
    const values = [
      String(config.title || ""),
      config.max_items,
      config.remember_items === false ? 0 : 1,
      String(config.storage_key || ""),
      String(config.history_helper || ""),
      config.mirror_history_local === false ? 0 : 1,
      getNewsHistoryHelperSignature(hass, config.history_helper),
      layout.mode,
      layout.density,
      layout.show_images ? 1 : 0,
      layout.show_summary ? 1 : 0,
      layout.show_source ? 1 : 0,
      layout.show_time ? 1 : 0,
      layout.show_category ? 1 : 0,
      config.appearance?.preset || "glass",
      config.filters?.hide_older_than || "",
      config.filters?.max_per_source || 0,
      (config.filters?.include_keywords || []).join(","),
      (config.filters?.exclude_keywords || []).join(","),
      resolveSourceEntries(config).map(entry => entry.entity).join(","),
      health.loading ? 1 : 0,
      health.unavailable ? 1 : 0,
      buildNewsRenderStamp(items),
      window.NodaliaI18n?.resolveLanguage?.(hass, config.language) || "",
    ];
    if (typeof joinParts === "function") {
      return joinParts([{ prefix: "news:", values }]);
    }
    return values.join("::");
  }

  _getCardTitle() {
    return this._config?.title || this._ui("title", "News");
  }

  _getCardBackground(styles, preset) {
    if (preset === "glass") {
      return `linear-gradient(180deg, color-mix(in srgb, var(--primary-color) 5%, transparent) 0%, ${styles.card.background} 100%)`;
    }
    return styles.card.background;
  }

  _openArticleUrl(url) {
    if (!isSafeHttpUrl(url)) {
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  _onShadowClick(event) {
    const path = event.composedPath();
    const actionTarget = path.find(node => (
      node instanceof HTMLElement && node.dataset?.newsAction
    ));
    if (!(actionTarget instanceof HTMLElement)) {
      return;
    }

    const action = actionTarget.dataset.newsAction || "";
    if (action === "prev") {
      event.preventDefault();
      event.stopPropagation();
      this._navigateMagazine(-1);
      return;
    }
    if (action === "next") {
      event.preventDefault();
      event.stopPropagation();
      this._navigateMagazine(1);
      return;
    }
    if (action === "goto") {
      event.preventDefault();
      event.stopPropagation();
      const index = Number.parseInt(actionTarget.dataset.newsIndex || "", 10);
      if (Number.isFinite(index)) {
        this._goToMagazineIndex(index);
      }
      return;
    }
    if (action !== "open") {
      return;
    }
    if (this._suppressArticleTap) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const url = actionTarget.dataset.newsUrl || "";
    if (!url) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this._openArticleUrl(url);
  }

  _onShadowKeyDown(event) {
    const carousel = event.composedPath().find(node => (
      node instanceof HTMLElement && node.dataset?.newsCarousel !== undefined
    ));
    if (carousel instanceof HTMLElement) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this._navigateMagazine(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        this._navigateMagazine(1);
        return;
      }
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.dataset?.newsAction !== "open") {
      return;
    }
    if (!target.dataset.newsUrl) {
      return;
    }
    event.preventDefault();
    this._openArticleUrl(target.dataset.newsUrl);
  }

  _syncMagazineIndex(items) {
    const stamp = buildNewsRenderStamp(items);
    if (stamp !== this._magazineItemsStamp) {
      this._magazineItemsStamp = stamp;
      this._magazineIndex = 0;
      return;
    }
    const maxIndex = Math.max(0, items.length - 1);
    if (this._magazineIndex > maxIndex) {
      this._magazineIndex = maxIndex;
    }
  }

  _goToMagazineIndex(index) {
    const items = this._getDisplayItems();
    if (!items.length) {
      return;
    }
    this._syncMagazineIndex(items);
    const maxIndex = items.length - 1;
    const nextIndex = Math.max(0, Math.min(index, maxIndex));
    if (nextIndex === this._magazineIndex) {
      return;
    }
    if (this._canPatchMagazineCarousel(items)) {
      this._commitMagazineSlide(nextIndex);
      return;
    }
    this._magazineIndex = nextIndex;
    this._render();
  }

  _navigateMagazine(delta) {
    const items = this._getDisplayItems();
    if (items.length <= 1) {
      return;
    }
    this._syncMagazineIndex(items);
    const nextIndex = this._magazineIndex + delta;
    if (nextIndex < 0 || nextIndex >= items.length) {
      return;
    }
    if (this._canPatchMagazineCarousel(items)) {
      this._commitMagazineSlide(nextIndex);
      return;
    }
    this._magazineIndex = nextIndex;
    this._render();
  }

  _canPatchMagazineCarousel(items) {
    if (!this.shadowRoot?.querySelector("[data-news-track]")) {
      return false;
    }
    const stamp = buildNewsRenderStamp(items);
    return stamp === this._magazineItemsStamp && (this._config?.layout?.mode || "magazine") === "magazine";
  }

  _commitMagazineSlide(nextIndex) {
    const items = this._getDisplayItems();
    const track = this.shadowRoot?.querySelector("[data-news-track]");
    if (!(track instanceof HTMLElement) || !items.length) {
      this._magazineIndex = nextIndex;
      this._render();
      return;
    }

    const maxIndex = Math.max(0, items.length - 1);
    const safeIndex = Math.max(0, Math.min(nextIndex, maxIndex));
    this._magazineIndex = safeIndex;
    this._cancelMagazineSwipe();

    track.classList.remove("news-card__carousel-track--dragging");
    track.style.setProperty("--news-drag-offset", "0px");
    track.style.setProperty("--news-slide-index", String(safeIndex));
    track.classList.add("news-card__carousel-track--animating");

    track.querySelectorAll(".news-card__carousel-slide").forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === safeIndex);
    });

    this._updateMagazineChrome(safeIndex, items.length);

    if (this._magazineSlideResetTimer) {
      window.clearTimeout(this._magazineSlideResetTimer);
    }
    this._magazineSlideResetTimer = window.setTimeout(() => {
      this._magazineSlideResetTimer = 0;
      track.classList.remove("news-card__carousel-track--animating");
    }, MAGAZINE_SLIDE_TRANSITION_MS + 40);
  }

  _updateMagazineChrome(index, total) {
    const carousel = this.shadowRoot?.querySelector("[data-news-carousel]");
    if (!(carousel instanceof HTMLElement)) {
      return;
    }
    const positionLabel = this._ui("articlePosition", "Article {current} of {total}", {
      current: index + 1,
      total,
    });
    carousel.setAttribute("aria-label", positionLabel);

    carousel.querySelectorAll('[data-news-action="goto"]').forEach(button => {
      if (!(button instanceof HTMLElement)) {
        return;
      }
      const dotIndex = Number.parseInt(button.dataset.newsIndex || "", 10);
      const isActive = dotIndex === index;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-current", isActive ? "true" : "false");
    });

    const prevButton = carousel.querySelector('[data-news-action="prev"]');
    const nextButton = carousel.querySelector('[data-news-action="next"]');
    if (prevButton instanceof HTMLButtonElement) {
      prevButton.disabled = index <= 0;
      prevButton.classList.toggle("is-disabled", index <= 0);
    }
    if (nextButton instanceof HTMLButtonElement) {
      nextButton.disabled = index >= total - 1;
      nextButton.classList.toggle("is-disabled", index >= total - 1);
    }
  }

  _attachMagazineSwipeWindowListeners() {
    if (this._magazineSwipeWindowAttached || typeof window === "undefined") {
      return;
    }
    this._magazineSwipeWindowAttached = true;
    window.addEventListener("pointermove", this._onWindowMagazinePointerMove, { passive: false });
    window.addEventListener("pointerup", this._onWindowMagazinePointerUp);
    window.addEventListener("pointercancel", this._onWindowMagazinePointerUp);
  }

  _detachMagazineSwipeWindowListeners() {
    if (!this._magazineSwipeWindowAttached || typeof window === "undefined") {
      return;
    }
    this._magazineSwipeWindowAttached = false;
    window.removeEventListener("pointermove", this._onWindowMagazinePointerMove);
    window.removeEventListener("pointerup", this._onWindowMagazinePointerUp);
    window.removeEventListener("pointercancel", this._onWindowMagazinePointerUp);
  }

  _cancelMagazineSwipe() {
    this._magazineSwipeState = null;
    this._detachMagazineSwipeWindowListeners();
    const track = this.shadowRoot?.querySelector("[data-news-track]");
    if (track instanceof HTMLElement) {
      track.classList.remove("news-card__carousel-track--dragging");
      track.style.removeProperty("--news-drag-offset");
    }
  }

  _getMagazineCarouselViewport(event) {
    return event.composedPath().find(node => (
      node instanceof HTMLElement && node.classList?.contains("news-card__carousel-viewport")
    )) || null;
  }

  _updateMagazineTrackTransform(track, index, dragOffsetPx = 0, animate = true) {
    if (!(track instanceof HTMLElement)) {
      return;
    }
    track.style.setProperty("--news-slide-index", String(index));
    track.style.setProperty("--news-drag-offset", `${dragOffsetPx}px`);
    track.classList.toggle("news-card__carousel-track--dragging", !animate);
  }

  _onShadowPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    const viewport = this._getMagazineCarouselViewport(event);
    if (!(viewport instanceof HTMLElement)) {
      return;
    }
    const carousel = viewport.closest("[data-news-carousel]");
    const count = Number.parseInt(carousel?.dataset?.newsCount || "0", 10);
    if (!carousel || count <= 1) {
      return;
    }
    const navTarget = event.composedPath().find(node => (
      node instanceof HTMLElement
      && node !== viewport
      && node.dataset?.newsAction
      && node.dataset.newsAction !== "open"
    ));
    if (navTarget instanceof HTMLElement) {
      return;
    }

    this._cancelMagazineSwipe();
    this._magazineSwipeState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      locked: false,
      dragging: false,
      viewport,
      track: viewport.querySelector("[data-news-track]"),
      width: viewport.getBoundingClientRect().width || 1,
      startIndex: this._magazineIndex,
    };
    this._attachMagazineSwipeWindowListeners();
    if (typeof viewport.setPointerCapture === "function") {
      try {
        viewport.setPointerCapture(event.pointerId);
      } catch (_err) {
        // Ignore capture failures on unsupported browsers.
      }
    }
  }

  _onWindowMagazinePointerMove(event) {
    const swipe = this._magazineSwipeState;
    if (!swipe || event.pointerId !== swipe.pointerId) {
      return;
    }

    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    if (!swipe.locked) {
      if (Math.hypot(deltaX, deltaY) < MAGAZINE_SWIPE_LOCK_PX) {
        return;
      }
      swipe.locked = true;
      swipe.dragging = Math.abs(deltaX) >= Math.abs(deltaY);
      if (!swipe.dragging) {
        this._cancelMagazineSwipe();
        return;
      }
    }
    if (!swipe.dragging) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const atStart = swipe.startIndex <= 0 && deltaX > 0;
    const items = this._getDisplayItems();
    const atEnd = swipe.startIndex >= items.length - 1 && deltaX < 0;
    let offset = deltaX;
    if (atStart || atEnd) {
      offset = deltaX * 0.35;
    }
    this._updateMagazineTrackTransform(swipe.track, swipe.startIndex, offset, false);
  }

  _onWindowMagazinePointerUp(event) {
    const swipe = this._magazineSwipeState;
    if (!swipe || event.pointerId !== swipe.pointerId) {
      return;
    }

    const deltaX = event.clientX - swipe.startX;
    const items = this._getDisplayItems();
    let navigated = false;
    if (swipe.dragging && Math.abs(deltaX) >= MAGAZINE_SWIPE_THRESHOLD_PX) {
      if (deltaX < 0 && swipe.startIndex < items.length - 1) {
        this._magazineIndex = swipe.startIndex + 1;
        navigated = true;
      } else if (deltaX > 0 && swipe.startIndex > 0) {
        this._magazineIndex = swipe.startIndex - 1;
        navigated = true;
      }
      this._suppressArticleTap = true;
      window.setTimeout(() => {
        this._suppressArticleTap = false;
      }, 320);
    }

    this._cancelMagazineSwipe();
    if (navigated) {
      if (this._canPatchMagazineCarousel(items)) {
        this._commitMagazineSlide(this._magazineIndex);
      } else {
        this._render();
      }
      return;
    }
    this._updateMagazineTrackTransform(
      this.shadowRoot?.querySelector("[data-news-track]"),
      this._magazineIndex,
      0,
      true,
    );
  }

  _renderMetaLine(item, layout, locale) {
    const parts = [];
    if (layout.show_source !== false) {
      parts.push(escapeHtml(item.source || this._ui("sourceUnknown", "Unknown source")));
    }
    if (layout.show_time !== false) {
      const timeLabel = formatRelativePublished(item.publishedMs, (key, fb, vals) => this._ui(key, fb, vals), locale);
      if (timeLabel) {
        parts.push(escapeHtml(timeLabel));
      }
    }
    if (layout.show_category !== false && item.category) {
      parts.push(`<span class="news-card__category">${escapeHtml(item.category)}</span>`);
    }
    if (!parts.length) {
      return "";
    }
    return `<div class="news-card__meta">${parts.join('<span class="news-card__meta-sep" aria-hidden="true">·</span>')}</div>`;
  }

  _renderImage(item, className, layout) {
    if (layout.show_images === false || !item.image) {
      return "";
    }
    return `
      <div class="${className}">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async" />
      </div>
    `;
  }

  _renderArticleItem(item, options = {}) {
    const layout = this._config?.layout || DEFAULT_CONFIG.layout;
    const locale = getLocaleTag(this._hass, this._config?.language);
    const variant = options.variant || "list";
    const interactive = item.hasUrl;
    const tag = interactive ? "button" : "article";
    const typeAttr = interactive ? ' type="button"' : "";
    const tabindexAttr = interactive ? "" : ' tabindex="-1"';
    const actionAttrs = interactive
      ? ` data-news-action="open" data-news-url="${escapeHtml(item.url)}"`
      : "";
    const ariaLabel = interactive
      ? ` aria-label="${escapeHtml(`${item.title}. ${this._ui("readMore", "Read more")}`)}"`
      : "";
    const disabledClass = interactive ? "" : " news-card__article--static";
    const summary = layout.show_summary !== false && item.summary
      ? `<p class="news-card__summary">${escapeHtml(item.summary)}</p>`
      : "";
    const readMore = interactive
      ? `<span class="news-card__read-more">${escapeHtml(this._ui("readMore", "Read more"))}</span>`
      : "";
    const headlineClass = variant === "hero" ? "news-card__headline news-card__headline--hero" : "news-card__headline";
    const copyMarkup = `
        <div class="news-card__copy">
          <h3 class="${headlineClass}">${escapeHtml(item.title)}</h3>
          ${this._renderMetaLine(item, layout, locale)}
          ${summary}
          ${readMore}
        </div>
    `;
    const imageMarkup = this._renderImage(item, `news-card__media news-card__media--${variant}`, layout);

    return `
      <${tag}
        class="news-card__article news-card__article--${variant}${disabledClass}"
        ${typeAttr}${tabindexAttr}${actionAttrs}${ariaLabel}
      >
        ${variant === "hero" ? `${copyMarkup}${imageMarkup}` : `${imageMarkup}${copyMarkup}`}
      </${tag}>
    `;
  }

  _renderMagazineCarousel(items) {
    this._syncMagazineIndex(items);
    const index = this._magazineIndex;
    const count = items.length;
    const positionLabel = this._ui("articlePosition", "Article {current} of {total}", {
      current: index + 1,
      total: count,
    });
    const dots = count > 1
      ? items.map((_, dotIndex) => {
        const activeClass = dotIndex === index ? " is-active" : "";
        const dotLabel = this._ui("goToArticle", "Go to article {index}", { index: dotIndex + 1 });
        return `
          <button
            type="button"
            class="news-card__dot${activeClass}"
            data-news-action="goto"
            data-news-index="${dotIndex}"
            aria-label="${escapeHtml(dotLabel)}"
            aria-current="${dotIndex === index ? "true" : "false"}"
          ></button>
        `;
      }).join("")
      : "";
    const prevDisabled = index <= 0 ? " is-disabled" : "";
    const nextDisabled = index >= count - 1 ? " is-disabled" : "";

    return `
      <div
        class="news-card__magazine"
        data-news-carousel
        data-news-count="${count}"
        tabindex="0"
        aria-roledescription="carousel"
        aria-label="${escapeHtml(positionLabel)}"
      >
        <div class="news-card__carousel-viewport">
          <div
            class="news-card__carousel-track"
            data-news-track
            style="--news-slide-index: ${index}; --news-drag-offset: 0px;"
          >
            ${items.map((item, slideIndex) => `
              <div class="news-card__carousel-slide${slideIndex === index ? " is-active" : ""}">
                ${this._renderArticleItem(item, { variant: "hero" })}
              </div>
            `).join("")}
          </div>
        </div>
        ${count > 1 ? `
          <div class="news-card__carousel-nav">
            <button
              type="button"
              class="news-card__carousel-btn${prevDisabled}"
              data-news-action="prev"
              aria-label="${escapeHtml(this._ui("previousArticle", "Previous article"))}"
              ${index <= 0 ? "disabled" : ""}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <div class="news-card__dots" role="tablist" aria-label="${escapeHtml(positionLabel)}">
              ${dots}
            </div>
            <button
              type="button"
              class="news-card__carousel-btn${nextDisabled}"
              data-news-action="next"
              aria-label="${escapeHtml(this._ui("nextArticle", "Next article"))}"
              ${index >= count - 1 ? "disabled" : ""}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
        ` : ""}
      </div>
    `;
  }

  _renderArticles(items) {
    const mode = this._config?.layout?.mode || "magazine";
    if (!items.length) {
      return "";
    }
    if (mode === "magazine") {
      return this._renderMagazineCarousel(items);
    }
    if (mode === "compact") {
      return `<div class="news-card__stack news-card__stack--compact">${items.map(item => this._renderArticleItem(item, { variant: "compact" })).join("")}</div>`;
    }
    return `<div class="news-card__stack news-card__stack--list">${items.map(item => this._renderArticleItem(item, { variant: "list" })).join("")}</div>`;
  }

  _renderEmptyState(kind = "empty") {
    const styles = this._config?.styles || DEFAULT_CONFIG.styles;
    const isError = kind === "error";
    const isLoading = kind === "loading";
    const title = isError
      ? this._ui("errorTitle", "News source unavailable")
      : isLoading
        ? this._ui("loading", "Loading news…")
        : this._ui("emptyTitle", "No news available");
    const body = isError
      ? this._ui("errorBody", "Check your configured entity or source attributes.")
      : isLoading
        ? ""
        : this._ui("emptyBody", "Add a news entity or check your feed source.");
    return window.NodaliaUtils?.renderCardEmptyStateDocument?.(
      `
        <ha-card class="news-card news-card--${kind}">
          <div class="news-card__empty-title">${escapeHtml(title)}</div>
          ${body ? `<div class="news-card__empty-text">${escapeHtml(body)}</div>` : ""}
        </ha-card>
      `,
      { card: styles.card },
    ) || "";
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config || DEFAULT_CONFIG;
    const styles = config.styles || DEFAULT_CONFIG.styles;
    const layout = config.layout || DEFAULT_CONFIG.layout;
    const preset = config.appearance?.preset || "glass";
    const density = layout.density || "normal";
    const health = this._getSourceHealth();
    const items = this._getDisplayItems();
    const cardTitle = this._getCardTitle();
    const cardBackground = this._getCardBackground(styles, preset);
    const animateClass = this._animateContentOnNextRender ? " news-card--enter" : "";

    let bodyMarkup = "";
    if (items.length > 0) {
      bodyMarkup = `
        <ha-card class="news-card news-card--ready news-card--${layout.mode} news-card--density-${density}${animateClass}">
          <header class="news-card__header">
            <div class="news-card__kicker">${escapeHtml(this._ui("title", "News"))}</div>
            <h2 class="news-card__title">${escapeHtml(cardTitle)}</h2>
          </header>
          ${this._renderArticles(items)}
        </ha-card>
      `;
    } else if (!health.hasSources) {
      bodyMarkup = this._renderEmptyState("empty");
    } else if (health.loading) {
      bodyMarkup = this._renderEmptyState("loading");
    } else if (health.unavailable) {
      bodyMarkup = this._renderEmptyState("error");
    } else {
      bodyMarkup = this._renderEmptyState("empty");
    }

    try {
      this._renderShell(bodyMarkup, styles, cardBackground, density, layout);
    } catch (error) {
      console.error("Nodalia News Card render failed:", error);
      this._renderShell(this._renderEmptyState("error"), styles, cardBackground, density, layout);
    }

    if (this._animateContentOnNextRender) {
      this._animateContentOnNextRender = false;
      if (this._entranceAnimationResetTimer) {
        window.clearTimeout(this._entranceAnimationResetTimer);
      }
      this._entranceAnimationResetTimer = window.NodaliaUtils?.scheduleDeferTimer?.(
        this,
        () => {
          this._entranceAnimationResetTimer = 0;
        },
        480,
      ) || 0;
    }
  }

  _renderShell(bodyMarkup, styles, cardBackground, density = "normal", layout = DEFAULT_CONFIG.layout) {
    if (!this.shadowRoot) {
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --nodalia-news-headline-font: Georgia, "Times New Roman", ui-serif, serif;
          --nodalia-news-body-font: var(--primary-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        }

        * {
          box-sizing: border-box;
        }

        .news-card,
        .news-card--empty,
        .news-card--loading,
        .news-card--error {
          background: ${cardBackground};
          border: ${styles.card.border};
          border-radius: ${styles.card.border_radius};
          box-shadow: ${styles.card.box_shadow};
          color: var(--primary-text-color);
          display: grid;
          gap: ${styles.card.gap};
          padding: ${styles.card.padding};
        }

        .news-card--enter {
          animation: news-card-enter 420ms ease;
        }

        @media (prefers-reduced-motion: reduce) {
          .news-card--enter {
            animation: none;
          }
        }

        @keyframes news-card-enter {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .news-card__header {
          display: grid;
          gap: 4px;
        }

        .news-card__kicker {
          color: var(--secondary-text-color);
          font-family: var(--nodalia-news-body-font);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .news-card__title {
          font-family: var(--nodalia-news-headline-font);
          font-size: clamp(1.1rem, 2vw, 1.35rem);
          font-weight: 700;
          line-height: 1.15;
          margin: 0;
        }

        .news-card__magazine,
        .news-card__stack {
          display: grid;
          gap: ${density === "compact" ? "10px" : density === "relaxed" ? "18px" : "14px"};
        }

        .news-card__magazine {
          gap: 12px;
          outline: none;
        }

        .news-card__magazine:focus-visible {
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 24%, transparent);
          border-radius: calc(${styles.card.border_radius} - 6px);
        }

        .news-card__carousel-viewport {
          overflow: hidden;
          touch-action: pan-y;
          width: 100%;
        }

        .news-card__carousel-track {
          display: flex;
          transform: translateX(calc((var(--news-slide-index, 0) * -100%) + var(--news-drag-offset, 0px)));
          transition: transform ${MAGAZINE_SLIDE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
          width: 100%;
          will-change: transform;
        }

        .news-card__carousel-track--dragging {
          transition: none;
        }

        .news-card__carousel-track--animating {
          transition: transform ${MAGAZINE_SLIDE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        @media (prefers-reduced-motion: reduce) {
          .news-card__carousel-track,
          .news-card__carousel-track--animating,
          .news-card__carousel-slide {
            transition: none !important;
          }
        }

        .news-card__carousel-slide {
          flex: 0 0 100%;
          filter: saturate(0.94);
          min-width: 0;
          opacity: 0.78;
          transform: scale(0.992);
          transition:
            filter ${MAGAZINE_SLIDE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity ${MAGAZINE_SLIDE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
            transform ${MAGAZINE_SLIDE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
          width: 100%;
        }

        .news-card__carousel-slide.is-active {
          filter: none;
          opacity: 1;
          transform: scale(1);
        }

        .news-card__carousel-slide .news-card__media--hero {
          max-height: 200px;
        }

        .news-card__carousel-nav {
          align-items: center;
          display: grid;
          gap: 10px;
          grid-template-columns: auto 1fr auto;
        }

        .news-card__carousel-btn {
          align-items: center;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 999px;
          color: var(--primary-text-color);
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          height: 34px;
          justify-content: center;
          width: 34px;
        }

        .news-card__carousel-btn:hover:not(:disabled),
        .news-card__carousel-btn:focus-visible:not(:disabled) {
          border-color: color-mix(in srgb, var(--primary-color) 28%, transparent);
          outline: none;
        }

        .news-card__carousel-btn:disabled,
        .news-card__carousel-btn.is-disabled {
          cursor: default;
          opacity: 0.35;
        }

        .news-card__dots {
          align-items: center;
          display: flex;
          gap: 8px;
          justify-content: center;
          min-width: 0;
        }

        .news-card__dot {
          background: color-mix(in srgb, var(--primary-text-color) 18%, transparent);
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          height: 8px;
          padding: 0;
          width: 8px;
        }

        .news-card__dot.is-active {
          background: var(--primary-color);
          width: 18px;
        }

        .news-card__dot:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--primary-color) 40%, transparent);
          outline-offset: 2px;
        }

        .news-card__article {
          background: color-mix(in srgb, var(--primary-text-color) 3%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: calc(${styles.card.border_radius} - 6px);
          color: inherit;
          display: grid;
          gap: 12px;
          padding: ${density === "compact" ? "10px 12px" : "14px"};
          text-align: left;
          width: 100%;
        }

        button.news-card__article {
          cursor: pointer;
          font: inherit;
        }

        button.news-card__article:hover,
        button.news-card__article:focus-visible {
          border-color: color-mix(in srgb, var(--primary-color) 28%, transparent);
          outline: none;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 18%, transparent);
        }

        .news-card__article--hero {
          gap: 14px;
          padding: ${density === "compact" ? "12px" : "16px"};
        }

        .news-card__article--compact,
        .news-card__article--list {
          grid-template-columns: ${layout.show_images !== false ? "72px minmax(0, 1fr)" : "minmax(0, 1fr)"};
          align-items: start;
        }

        .news-card__article--hero {
          grid-template-columns: minmax(0, 1fr);
          align-items: start;
        }

        .news-card__article--static {
          cursor: default;
        }

        .news-card__copy {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .news-card__headline {
          font-family: var(--nodalia-news-headline-font);
          font-size: ${styles.headline_size};
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.12;
          margin: 0;
        }

        .news-card__headline--hero {
          font-size: clamp(1.45rem, 2.8vw, 2rem);
        }

        .news-card__article--compact .news-card__headline,
        .news-card__article--list .news-card__headline {
          font-size: clamp(1rem, 1.8vw, 1.18rem);
        }

        .news-card__summary {
          color: var(--secondary-text-color);
          font-family: var(--nodalia-news-body-font);
          font-size: ${styles.body_size};
          line-height: 1.55;
          margin: 0;
        }

        .news-card__meta {
          align-items: center;
          color: var(--secondary-text-color);
          display: flex;
          flex-wrap: wrap;
          font-family: var(--nodalia-news-body-font);
          font-size: ${styles.meta_size};
          gap: 6px;
          letter-spacing: 0.02em;
        }

        .news-card__meta-sep {
          opacity: 0.55;
        }

        .news-card__category {
          background: color-mix(in srgb, var(--primary-color) 12%, transparent);
          border-radius: ${styles.chip_border_radius};
          padding: 2px 8px;
        }

        .news-card__read-more {
          color: var(--primary-color);
          font-family: var(--nodalia-news-body-font);
          font-size: 0.82rem;
          font-weight: 600;
        }

        .news-card__media {
          overflow: hidden;
          border-radius: calc(${styles.card.border_radius} - 10px);
          background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
        }

        .news-card__media img {
          display: block;
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .news-card__media--hero {
          min-height: 140px;
          max-height: 220px;
        }

        .news-card__media--compact,
        .news-card__media--list {
          aspect-ratio: 4 / 3;
          min-height: 54px;
        }

        .news-card__empty-title {
          font-family: var(--nodalia-news-headline-font);
          font-size: 1.15rem;
          font-weight: 700;
          margin: 0;
        }

        .news-card__empty-text {
          color: var(--secondary-text-color);
          font-family: var(--nodalia-news-body-font);
          font-size: 0.92rem;
          line-height: 1.5;
          margin: 0;
        }

      </style>
      ${bodyMarkup}
    `;
  }
}
