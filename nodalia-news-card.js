const CARD_TAG = "nodalia-news-card";
const EDITOR_TAG = "nodalia-news-card-editor";
const CARD_VERSION = "1.3.0-alpha.2";

const ITEM_LIST_ATTRS = ["items", "articles", "entries", "news", "headlines"];
const LAYOUT_MODES = new Set(["compact", "magazine", "list"]);
const DENSITY_MODES = new Set(["compact", "normal", "relaxed"]);
const APPEARANCE_PRESETS = new Set(["default", "glass"]);

const DEFAULT_CONFIG = {
  title: "",
  entity: "",
  language: "auto",
  max_items: 5,
  sources: [],
  layout: {
    mode: "magazine",
    density: "normal",
    show_images: true,
    show_summary: true,
    show_source: true,
    show_time: true,
    show_category: true,
  },
  filters: {
    hide_older_than: "",
    max_per_source: 0,
    include_keywords: [],
    exclude_keywords: [],
  },
  appearance: {
    preset: "glass",
  },
  styles: {
    card: {
      background: "var(--ha-card-background)",
      border: "1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
      border_radius: "28px",
      box_shadow: "var(--ha-card-box-shadow)",
      padding: "16px",
      gap: "14px",
    },
    headline_size: "clamp(1.35rem, 2.4vw, 1.85rem)",
    body_size: "0.92rem",
    meta_size: "0.78rem",
    chip_border_radius: "999px",
  },
};

const STUB_CONFIG = {
  title: "News",
  layout: { mode: "magazine" },
  sources: [],
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
  if (window.NodaliaUtils?.deepClone) {
    return window.NodaliaUtils.deepClone(value);
  }
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

function mergeConfig(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override.map(item => deepClone(item)) : deepClone(base);
  }
  if (!isObject(base)) {
    return override === undefined ? base : override;
  }
  const result = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(override || {})]);
  keys.forEach(key => {
    const baseValue = base[key];
    const overrideValue = override ? override[key] : undefined;
    if (overrideValue === undefined) {
      result[key] = deepClone(baseValue);
      return;
    }
    if (Array.isArray(overrideValue)) {
      result[key] = deepClone(overrideValue);
      return;
    }
    if (isObject(baseValue) && isObject(overrideValue)) {
      result[key] = mergeConfig(baseValue, overrideValue);
      return;
    }
    result[key] = overrideValue;
  });
  return result;
}

function compactConfig(value) {
  if (Array.isArray(value)) {
    return value.map(item => compactConfig(item)).filter(item => item !== undefined);
  }
  if (isObject(value)) {
    const compacted = {};
    Object.entries(value).forEach(([key, item]) => {
      const cleaned = compactConfig(item);
      const isEmptyObject = isObject(cleaned) && Object.keys(cleaned).length === 0;
      if (cleaned !== undefined && !isEmptyObject) {
        compacted[key] = cleaned;
      }
    });
    return compacted;
  }
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isSafeHttpUrl(url) {
  const raw = String(url ?? "").trim();
  if (!raw) {
    return false;
  }
  try {
    const base = typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : undefined;
    const parsed = base ? new URL(raw, base) : new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_err) {
    return false;
  }
}

function sanitizeImageUrl(url) {
  return isSafeHttpUrl(url) ? String(url).trim() : "";
}

function pickFirstString(source, keys) {
  if (!source || typeof source !== "object") {
    return "";
  }
  for (const key of keys) {
    const value = source[key];
    if (value === undefined || value === null) {
      continue;
    }
    const text = String(value).trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function parsePublishedMs(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (/^\d+$/.test(text)) {
    const numeric = Number(text);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return numeric > 1e12 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseHideOlderThanMs(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) {
    return null;
  }
  const match = text.match(/^(\d+(?:\.\d+)?)(h|d)$/);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  const unit = match[2];
  if (unit === "h") {
    return amount * 60 * 60 * 1000;
  }
  if (unit === "d") {
    return amount * 24 * 60 * 60 * 1000;
  }
  return null;
}

function normalizeKeywordList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(item => String(item ?? "").trim().toLowerCase())
    .filter(Boolean);
}

function normalizeNewsItem(raw, sourceMeta = {}) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const title = pickFirstString(raw, ["title", "headline", "name"]);
  if (!title) {
    return null;
  }
  const summary = pickFirstString(raw, ["summary", "description", "content", "excerpt"]);
  const source = pickFirstString(raw, ["source", "publisher", "feed", "author"])
    || String(sourceMeta.name || "").trim();
  const category = pickFirstString(raw, ["category", "section", "tag"])
    || String(sourceMeta.category || "").trim();
  const url = pickFirstString(raw, ["url", "link"]);
  const image = sanitizeImageUrl(pickFirstString(raw, ["image", "image_url", "thumbnail", "picture"]));
  const publishedRaw = pickFirstString(raw, ["published", "published_at", "date", "datetime", "timestamp"])
    || raw.published
    || raw.published_at
    || raw.date
    || raw.datetime
    || raw.timestamp;
  const publishedMs = parsePublishedMs(publishedRaw);
  const safeUrl = isSafeHttpUrl(url) ? url.trim() : "";
  return {
    id: `${sourceMeta.entity || "news"}::${safeUrl || title}::${publishedMs || ""}`,
    title,
    summary,
    source,
    category,
    url: safeUrl,
    image,
    publishedMs,
    publishedISO: publishedMs ? new Date(publishedMs).toISOString() : "",
    sourceEntityId: String(sourceMeta.entity || "").trim(),
    sourceName: String(sourceMeta.name || "").trim(),
    sourceIcon: String(sourceMeta.icon || "").trim(),
    sourceCategory: String(sourceMeta.category || "").trim(),
    hasUrl: Boolean(safeUrl),
  };
}

function coerceNewsAttributeList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return [];
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function extractRawItemsFromState(state) {
  if (!state?.attributes) {
    return [];
  }
  const attrs = state.attributes;
  for (const key of ITEM_LIST_ATTRS) {
    if (!Object.prototype.hasOwnProperty.call(attrs, key)) {
      continue;
    }
    const items = coerceNewsAttributeList(attrs[key]);
    if (items.length > 0) {
      return items;
    }
  }
  return [];
}

function resolveSourceEntries(config) {
  const entries = [];
  const pushEntry = raw => {
    if (!raw || typeof raw !== "object") {
      return;
    }
    const entity = String(raw.entity ?? raw.entity_id ?? "").trim();
    if (!entity) {
      return;
    }
    entries.push({
      entity,
      name: String(raw.name ?? "").trim(),
      icon: String(raw.icon ?? "").trim(),
      category: String(raw.category ?? "").trim(),
    });
  };
  if (Array.isArray(config?.sources)) {
    config.sources.forEach(pushEntry);
  }
  const legacyEntity = String(config?.entity ?? "").trim();
  if (legacyEntity && !entries.some(entry => entry.entity === legacyEntity)) {
    entries.unshift({
      entity: legacyEntity,
      name: "",
      icon: "",
      category: "",
    });
  }
  return entries;
}

function collectNormalizedItems(hass, config) {
  const sources = resolveSourceEntries(config);
  const collected = [];
  sources.forEach(source => {
    const state = hass?.states?.[source.entity] || null;
    const rawItems = extractRawItemsFromState(state);
    rawItems.forEach(raw => {
      const normalized = normalizeNewsItem(raw, source);
      if (normalized) {
        collected.push(normalized);
      }
    });
  });
  return collected;
}

function keywordMatches(text, keywords) {
  if (!keywords.length) {
    return true;
  }
  const haystack = String(text || "").toLowerCase();
  return keywords.some(keyword => haystack.includes(keyword));
}

function applyNewsFilters(items, config, nowMs = Date.now()) {
  const filters = config?.filters || {};
  const hideOlderMs = parseHideOlderThanMs(filters.hide_older_than);
  const includeKeywords = normalizeKeywordList(filters.include_keywords);
  const excludeKeywords = normalizeKeywordList(filters.exclude_keywords);
  const maxPerSource = Math.max(0, Number(filters.max_per_source) || 0);

  let filtered = items.filter(item => {
    const blob = `${item.title} ${item.summary}`;
    if (includeKeywords.length && !keywordMatches(blob, includeKeywords)) {
      return false;
    }
    if (excludeKeywords.length && keywordMatches(blob, excludeKeywords)) {
      return false;
    }
    if (hideOlderMs !== null && item.publishedMs !== null) {
      if (nowMs - item.publishedMs > hideOlderMs) {
        return false;
      }
    }
    return true;
  });

  filtered.sort((left, right) => {
    const leftMs = left.publishedMs ?? 0;
    const rightMs = right.publishedMs ?? 0;
    if (rightMs !== leftMs) {
      return rightMs - leftMs;
    }
    return left.title.localeCompare(right.title);
  });

  if (maxPerSource > 0) {
    const perSource = new Map();
    filtered = filtered.filter(item => {
      const key = item.sourceEntityId || item.source || "unknown";
      const count = perSource.get(key) || 0;
      if (count >= maxPerSource) {
        return false;
      }
      perSource.set(key, count + 1);
      return true;
    });
  }

  const maxItems = Math.max(1, Math.min(50, Number(config?.max_items) || DEFAULT_CONFIG.max_items));
  return filtered.slice(0, maxItems);
}

function normalizeConfig(rawConfig) {
  const merged = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const layout = isObject(merged.layout) ? merged.layout : {};
  merged.layout = {
    ...DEFAULT_CONFIG.layout,
    ...layout,
    mode: LAYOUT_MODES.has(String(layout.mode || "").trim())
      ? String(layout.mode).trim()
      : DEFAULT_CONFIG.layout.mode,
    density: DENSITY_MODES.has(String(layout.density || "").trim())
      ? String(layout.density).trim()
      : DEFAULT_CONFIG.layout.density,
    show_images: layout.show_images !== false,
    show_summary: layout.show_summary !== false,
    show_source: layout.show_source !== false,
    show_time: layout.show_time !== false,
    show_category: layout.show_category !== false,
  };
  const filters = isObject(merged.filters) ? merged.filters : {};
  merged.filters = {
    hide_older_than: String(filters.hide_older_than ?? "").trim(),
    max_per_source: Math.max(0, Number(filters.max_per_source) || 0),
    include_keywords: Array.isArray(filters.include_keywords) ? filters.include_keywords.map(String) : [],
    exclude_keywords: Array.isArray(filters.exclude_keywords) ? filters.exclude_keywords.map(String) : [],
  };
  const appearance = isObject(merged.appearance) ? merged.appearance : {};
  merged.appearance = {
    preset: APPEARANCE_PRESETS.has(String(appearance.preset || "").trim())
      ? String(appearance.preset).trim()
      : DEFAULT_CONFIG.appearance.preset,
  };
  merged.max_items = Math.max(1, Math.min(50, Number(merged.max_items) || DEFAULT_CONFIG.max_items));
  merged.title = String(merged.title ?? "").trim();
  merged.entity = String(merged.entity ?? "").trim();
  merged.language = String(merged.language ?? "auto").trim() || "auto";
  merged.sources = Array.isArray(merged.sources)
    ? merged.sources.map(entry => ({
      entity: String(entry?.entity ?? entry?.entity_id ?? "").trim(),
      name: String(entry?.name ?? "").trim(),
      icon: String(entry?.icon ?? "").trim(),
      category: String(entry?.category ?? "").trim(),
    })).filter(entry => entry.entity)
    : [];
  return merged;
}

function getNewsItemsForConfig(hass, config, nowMs = Date.now()) {
  const normalized = normalizeConfig(config);
  const collected = collectNormalizedItems(hass, normalized);
  return applyNewsFilters(collected, normalized, nowMs);
}

function buildNewsRenderStamp(items) {
  return items
    .slice(0, 12)
    .map(item => [
      item.sourceEntityId,
      item.title,
      item.publishedMs ?? "",
      item.source,
      item.hasUrl ? 1 : 0,
    ].join(":"))
    .join("|");
}

function getLocaleTag(hass, language) {
  const lang = window.NodaliaI18n?.resolveLanguage?.(hass, language ?? "auto");
  return window.NodaliaI18n?.localeTag?.(lang) || hass?.locale?.language || "en";
}

function formatRelativePublished(ms, ui, locale) {
  if (ms === null || ms === undefined) {
    return "";
  }
  const now = Date.now();
  const delta = Math.max(0, now - ms);
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) {
    return ui("publishedNow", "Just now");
  }
  if (minutes < 60) {
    return ui("publishedMinutesAgo", "{count} min ago", { count: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return ui("publishedHoursAgo", "{count} h ago", { count: hours });
  }
  const days = Math.floor(hours / 24);
  if (days < 14) {
    return ui("publishedDaysAgo", "{count} d ago", { count: days });
  }
  try {
    return new Date(ms).toLocaleString(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_err) {
    return "";
  }
}

class NodaliaNewsCard extends HTMLElement {
  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    const config = deepClone(STUB_CONFIG);
    const entityId = Object.keys(hass?.states || {}).find(id => (
      id.startsWith("sensor.")
      && Array.isArray(hass.states[id]?.attributes?.items)
      && hass.states[id].attributes.items.length
    ));
    if (entityId) {
      config.sources = [{ entity: entityId, name: "News" }];
    }
    return config;
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._lastRenderSignature = "";
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

  _isHassHydrated(hass = this._hass) {
    return window.NodaliaUtils?.isLovelaceHassStatesHydrated?.(hass) === true;
  }

  _getSourceHealth() {
    const sources = this._getSourceEntries();
    if (!sources.length) {
      return { hasSources: false, unavailable: false, loading: false };
    }
    if (!this._hass || !this._isHassHydrated(this._hass)) {
      return { hasSources: true, unavailable: false, loading: true };
    }
    const unavailable = sources.some(source => {
      const state = this._hass?.states?.[source.entity];
      return !state || String(state.state || "").toLowerCase() === "unavailable";
    });
    return { hasSources: true, unavailable, loading: false };
  }

  _getDisplayItems(hass = this._hass) {
    if (!hass) {
      return [];
    }
    return getNewsItemsForConfig(hass, this._config);
  }

  _getRenderSignature(hass = this._hass) {
    const config = this._config || DEFAULT_CONFIG;
    const layout = config.layout || DEFAULT_CONFIG.layout;
    const items = this._getDisplayItems(hass);
    const health = this._getSourceHealth();
    const joinParts = window.NodaliaRenderSignature?.joinParts;
    const values = [
      String(config.title || ""),
      config.max_items,
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
    const target = event.composedPath().find(node => (
      node instanceof HTMLElement && node.dataset?.newsAction === "open"
    ));
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const url = target.dataset.newsUrl || "";
    if (!url) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this._openArticleUrl(url);
  }

  _onShadowKeyDown(event) {
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

    return `
      <${tag}
        class="news-card__article news-card__article--${variant}${disabledClass}"
        ${typeAttr}${tabindexAttr}${actionAttrs}${ariaLabel}
      >
        ${this._renderImage(item, `news-card__media news-card__media--${variant}`, layout)}
        <div class="news-card__copy">
          <h3 class="${headlineClass}">${escapeHtml(item.title)}</h3>
          ${this._renderMetaLine(item, layout, locale)}
          ${summary}
          ${readMore}
        </div>
      </${tag}>
    `;
  }

  _renderArticles(items) {
    const mode = this._config?.layout?.mode || "magazine";
    if (!items.length) {
      return "";
    }
    if (mode === "magazine") {
      const [hero, ...rest] = items;
      return `
        <div class="news-card__magazine">
          ${this._renderArticleItem(hero, { variant: "hero" })}
          ${rest.length ? `<div class="news-card__stack">${rest.map(item => this._renderArticleItem(item, { variant: "compact" })).join("")}</div>` : ""}
        </div>
      `;
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
    if (!health.hasSources) {
      bodyMarkup = this._renderEmptyState("empty");
    } else if (health.loading) {
      bodyMarkup = this._renderEmptyState("loading");
    } else if (health.unavailable) {
      bodyMarkup = this._renderEmptyState("error");
    } else if (!items.length) {
      bodyMarkup = this._renderEmptyState("empty");
    } else {
      bodyMarkup = `
        <ha-card class="news-card news-card--ready news-card--${layout.mode} news-card--density-${density}${animateClass}">
          <header class="news-card__header">
            <div class="news-card__kicker">${escapeHtml(this._ui("title", "News"))}</div>
            <h2 class="news-card__title">${escapeHtml(cardTitle)}</h2>
          </header>
          ${this._renderArticles(items)}
        </ha-card>
      `;
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
          grid-template-columns: ${layout.show_images !== false ? "minmax(0, 1.35fr) minmax(120px, 0.75fr)" : "minmax(0, 1fr)"};
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

        @media (max-width: 520px) {
          .news-card__article--hero {
            grid-template-columns: minmax(0, 1fr);
          }

          .news-card__media--hero {
            order: 2;
          }
        }
      </style>
      ${bodyMarkup}
    `;

    if (this._animateContentOnNextRender) {
      this._animateContentOnNextRender = false;
      if (this._entranceAnimationResetTimer) {
        window.clearTimeout(this._entranceAnimationResetTimer);
      }
      this._entranceAnimationResetTimer = window.NodaliaUtils?.scheduleDeferTimer?.(
        this,
        "_entranceAnimationResetTimer",
        () => {
          this._entranceAnimationResetTimer = 0;
        },
        480,
      ) || 0;
    }
  }
}

class NodaliaNewsCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._hass = this._hass || null;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _updateConfig(path, value) {
    const next = deepClone(this._config || DEFAULT_CONFIG);
    const parts = String(path).split(".");
    let cursor = next;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const key = parts[index];
      if (!isObject(cursor[key])) {
        cursor[key] = {};
      }
      cursor = cursor[key];
    }
    cursor[parts[parts.length - 1]] = value;
    this._config = normalizeConfig(next);
    this._dispatchConfig();
    this._render();
  }

  _dispatchConfig() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      bubbles: true,
      composed: true,
      detail: { config: compactConfig(deepClone(this._config)) },
    }));
  }

  _renderField(label, path, value, options = {}) {
    const type = options.type || "text";
    const placeholder = options.placeholder ? ` placeholder="${escapeHtml(options.placeholder)}"` : "";
    return `
      <label class="editor-field">
        <span>${escapeHtml(label)}</span>
        <input
          type="${escapeHtml(type)}"
          data-config-path="${escapeHtml(path)}"
          value="${escapeHtml(String(value ?? ""))}"${placeholder}
        />
      </label>
    `;
  }

  _renderCheckbox(label, path, checked) {
    return `
      <label class="editor-field editor-field--checkbox">
        <input type="checkbox" data-config-path="${escapeHtml(path)}" ${checked ? "checked" : ""} />
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  _renderSelect(label, path, value, options) {
    return `
      <label class="editor-field">
        <span>${escapeHtml(label)}</span>
        <select data-config-path="${escapeHtml(path)}">
          ${options.map(option => `
            <option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>
              ${escapeHtml(option.label)}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  _onInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      return;
    }
    const path = target.dataset.configPath;
    if (!path) {
      return;
    }
    let value = target.value;
    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      value = target.checked;
    } else if (target instanceof HTMLInputElement && target.type === "number") {
      value = Number(target.value);
    }
    this._updateConfig(path, value);
  }

  _render() {
    const config = this._config || DEFAULT_CONFIG;
    const layout = config.layout || DEFAULT_CONFIG.layout;
    this.shadowRoot.innerHTML = `
      <style>
        .editor {
          display: grid;
          gap: 12px;
          padding: 8px 0;
        }
        .editor-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }
        .editor-field {
          display: grid;
          gap: 6px;
          font-size: 12px;
        }
        .editor-field input,
        .editor-field select {
          width: 100%;
        }
        .editor-field--checkbox {
          align-items: center;
          grid-template-columns: auto 1fr;
        }
        .editor-section__title {
          font-size: 14px;
          font-weight: 700;
        }
      </style>
      <div class="editor">
        <div class="editor-section__title">Nodalia News Card</div>
        <div class="editor-grid">
          ${this._renderField("Title", "title", config.title)}
          ${this._renderField("Entity", "entity", config.entity, { placeholder: "sensor.news" })}
          ${this._renderField("Max items", "max_items", config.max_items, { type: "number" })}
          ${this._renderSelect("Layout mode", "layout.mode", layout.mode, [
            { value: "magazine", label: "Magazine" },
            { value: "compact", label: "Compact" },
            { value: "list", label: "List" },
          ])}
          ${this._renderCheckbox("Show images", "layout.show_images", layout.show_images !== false)}
          ${this._renderCheckbox("Show summary", "layout.show_summary", layout.show_summary !== false)}
          ${this._renderCheckbox("Show source", "layout.show_source", layout.show_source !== false)}
          ${this._renderCheckbox("Show time", "layout.show_time", layout.show_time !== false)}
          ${this._renderCheckbox("Show category", "layout.show_category", layout.show_category !== false)}
        </div>
      </div>
    `;
    this.shadowRoot.querySelectorAll("[data-config-path]").forEach(node => {
      node.removeEventListener("change", this._onInputBound);
    });
    this._onInputBound = this._onInputBound || this._onInput.bind(this);
    this.shadowRoot.querySelectorAll("[data-config-path]").forEach(node => {
      node.addEventListener("change", this._onInputBound);
    });
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaNewsCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaNewsCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia News Card",
  description: "Editorial newspaper-style news card for Home Assistant dashboards.",
  preview: true,
  documentationURL: "https://github.com/danielmigueltejedor/nodalia-cards/blob/main/docs/cards/news-card.md",
});
