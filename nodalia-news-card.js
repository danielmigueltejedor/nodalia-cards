const CARD_TAG = "nodalia-news-card";
const EDITOR_TAG = "nodalia-news-card-editor";
const CARD_VERSION = "1.3.3-alpha.1";

const MAGAZINE_SWIPE_THRESHOLD_PX = 48;
const MAGAZINE_SWIPE_LOCK_PX = 10;
const NEWS_HISTORY_STORAGE_PREFIX = "nodalia-news-card:history:";
const NEWS_HISTORY_HELPER_MAX_CHARS = 250;
const NEWS_HISTORY_HELPER_WRITE_MS = 450;
const MAGAZINE_SLIDE_TRANSITION_MS = 520;

const ITEM_LIST_ATTRS = ["items", "articles", "entries", "news", "headlines"];
const LAYOUT_MODES = new Set(["compact", "magazine", "list"]);
const DENSITY_MODES = new Set(["compact", "normal", "relaxed"]);
const APPEARANCE_PRESETS = new Set(["default", "glass"]);

const DEFAULT_CONFIG = {
  title: "",
  entity: "",
  language: "auto",
  max_items: 5,
  remember_items: true,
  storage_key: "",
  history_helper: "",
  mirror_history_local: true,
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
  if (isObject(value)) {
    if (pickFirstString(value, ["title", "headline", "name"])) {
      return [value];
    }
    const numericEntries = Object.keys(value)
      .filter(key => /^\d+$/.test(key))
      .sort((left, right) => Number(left) - Number(right))
      .map(key => value[key])
      .filter(entry => entry && typeof entry === "object");
    if (numericEntries.length) {
      return numericEntries;
    }
    return [];
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
    return coerceNewsAttributeList(parsed);
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

function isLovelaceHassStatesHydrated(hass) {
  return window.NodaliaUtils?.isLovelaceHassStatesHydrated?.(hass) === true;
}

function isNewsSourceStateUnavailable(state) {
  if (!state) {
    return true;
  }
  if (extractRawItemsFromState(state).length > 0) {
    return false;
  }
  const stateKey = String(state.state || "").toLowerCase();
  return stateKey === "unavailable" || stateKey === "unknown";
}

function getNewsSourceHealth(hass, config) {
  const sources = resolveSourceEntries(config);
  if (!sources.length) {
    return { hasSources: false, unavailable: false, loading: false };
  }
  if (!hass) {
    return { hasSources: true, unavailable: false, loading: true };
  }

  if (collectNormalizedItems(hass, config).length > 0) {
    return { hasSources: true, unavailable: false, loading: false };
  }

  const sourceStates = sources.map(source => hass.states?.[source.entity] || null);
  const hasAnySourceState = sourceStates.some(Boolean);
  if (!hasAnySourceState) {
    const states = hass.states;
    const statesPopulated = Boolean(
      states && typeof states === "object" && Object.keys(states).length > 0,
    );
    if (!statesPopulated && !isLovelaceHassStatesHydrated(hass)) {
      return { hasSources: true, unavailable: false, loading: true };
    }
    return { hasSources: true, unavailable: true, loading: false };
  }
  const unavailable = sourceStates.some(state => isNewsSourceStateUnavailable(state));
  return { hasSources: true, unavailable, loading: false };
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
  merged.remember_items = merged.remember_items !== false;
  merged.storage_key = String(merged.storage_key ?? "").trim();
  merged.history_helper = String(merged.history_helper ?? merged.history_entity ?? "").trim();
  merged.mirror_history_local = merged.mirror_history_local !== false;
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

function getNewsHistoryStorageKey(config) {
  const explicit = String(config?.storage_key ?? "").trim();
  if (explicit) {
    return `${NEWS_HISTORY_STORAGE_PREFIX}${explicit}`;
  }
  const sources = resolveSourceEntries(config).map(entry => entry.entity).sort().join(",");
  return `${NEWS_HISTORY_STORAGE_PREFIX}${sources || "default"}`;
}

function compactNewsHistoryItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const title = String(item.title || "").trim();
  if (!title) {
    return null;
  }
  return {
    title,
    summary: String(item.summary || "").trim(),
    source: String(item.source || "").trim(),
    category: String(item.category || "").trim(),
    url: String(item.url || "").trim(),
    image: String(item.image || "").trim(),
    publishedMs: item.publishedMs ?? null,
    sourceEntityId: String(item.sourceEntityId || "").trim(),
    sourceName: String(item.sourceName || "").trim(),
    sourceIcon: String(item.sourceIcon || "").trim(),
    sourceCategory: String(item.sourceCategory || "").trim(),
  };
}

function restoreNewsHistoryItem(stored) {
  if (!stored || typeof stored !== "object") {
    return null;
  }
  const title = String(stored.title || "").trim();
  if (!title) {
    return null;
  }
  const publishedMs = stored.publishedMs ?? null;
  const url = isSafeHttpUrl(stored.url) ? String(stored.url).trim() : "";
  const image = sanitizeImageUrl(stored.image);
  const sourceEntityId = String(stored.sourceEntityId || "").trim();
  return {
    id: `${sourceEntityId || "news"}::${url || title}::${publishedMs || ""}`,
    title,
    summary: String(stored.summary || "").trim(),
    source: String(stored.source || "").trim(),
    category: String(stored.category || "").trim(),
    url,
    image,
    publishedMs,
    publishedISO: publishedMs ? new Date(publishedMs).toISOString() : "",
    sourceEntityId,
    sourceName: String(stored.sourceName || "").trim(),
    sourceIcon: String(stored.sourceIcon || "").trim(),
    sourceCategory: String(stored.sourceCategory || "").trim(),
    hasUrl: Boolean(url),
  };
}

function mergeNewsItemHistory(stored, incoming, maxItems) {
  const limit = Math.max(1, Math.min(50, Number(maxItems) || DEFAULT_CONFIG.max_items));
  const byId = new Map();
  [...(Array.isArray(stored) ? stored : []), ...(Array.isArray(incoming) ? incoming : [])].forEach(item => {
    const normalized = item?.id ? item : restoreNewsHistoryItem(item);
    if (normalized?.id) {
      byId.set(normalized.id, normalized);
    }
  });
  return [...byId.values()]
    .sort((left, right) => {
      const leftMs = left.publishedMs ?? 0;
      const rightMs = right.publishedMs ?? 0;
      if (rightMs !== leftMs) {
        return rightMs - leftMs;
      }
      return left.title.localeCompare(right.title);
    })
    .slice(0, limit);
}

function loadNewsHistoryFromStorage(storageKey) {
  if (typeof localStorage === "undefined" || !storageKey) {
    return [];
  }
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map(restoreNewsHistoryItem).filter(Boolean);
  } catch (_err) {
    return [];
  }
}

function saveNewsHistoryToStorage(storageKey, items) {
  if (typeof localStorage === "undefined" || !storageKey) {
    return;
  }
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify((Array.isArray(items) ? items : []).map(compactNewsHistoryItem).filter(Boolean)),
    );
  } catch (_err) {
    // Ignore quota / private mode errors.
  }
}

function encodeCompactNewsHistoryEntry(item) {
  const compact = compactNewsHistoryItem(item);
  if (!compact) {
    return null;
  }
  const entry = {
    t: compact.title.slice(0, 48),
    p: compact.publishedMs ?? undefined,
    e: compact.sourceEntityId || undefined,
    u: compact.url ? compact.url.slice(0, 56) : undefined,
    s: compact.source ? compact.source.slice(0, 24) : undefined,
    c: compact.category ? compact.category.slice(0, 20) : undefined,
    m: compact.summary ? compact.summary.slice(0, 48) : undefined,
    g: compact.image ? compact.image.slice(0, 56) : undefined,
  };
  Object.keys(entry).forEach(key => {
    if (entry[key] === undefined || entry[key] === "") {
      delete entry[key];
    }
  });
  return entry;
}

function decodeCompactNewsHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  if (entry.title || entry.headline) {
    return restoreNewsHistoryItem(entry);
  }
  if (!entry.t) {
    return null;
  }
  return restoreNewsHistoryItem({
    title: entry.t,
    summary: entry.m || "",
    source: entry.s || "",
    category: entry.c || "",
    url: entry.u || "",
    image: entry.g || "",
    publishedMs: entry.p ?? null,
    sourceEntityId: entry.e || "",
    sourceName: entry.s || "",
  });
}

function parseNewsHistoryFromHelperState(rawState) {
  const raw = String(rawState ?? "").trim();
  if (!raw || raw === "unknown" || raw === "unavailable") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(decodeCompactNewsHistoryEntry).filter(Boolean);
  } catch (_err) {
    return [];
  }
}

function fitNewsHistoryPayloadToLimit(entries, maxChars = NEWS_HISTORY_HELPER_MAX_CHARS) {
  let payload = Array.isArray(entries) ? entries.filter(Boolean) : [];
  while (payload.length > 0) {
    const json = JSON.stringify(payload);
    if (json.length <= maxChars) {
      return json;
    }
    payload = payload.slice(0, -1);
  }
  return "[]";
}

function loadNewsHistoryFromHelper(hass, entityId) {
  const id = String(entityId ?? "").trim();
  if (!id || !hass?.states?.[id]) {
    return [];
  }
  return parseNewsHistoryFromHelperState(hass.states[id].state);
}

function getNewsHistoryHelperSignature(hass, entityId) {
  const id = String(entityId ?? "").trim();
  if (!id || !hass?.states?.[id]) {
    return "";
  }
  const state = hass.states[id];
  return `${state.state ?? ""}::${state.last_changed ?? state.last_updated ?? ""}`;
}

function writeNewsHistoryToHelper(hass, entityId, items) {
  const id = String(entityId ?? "").trim();
  if (!id || typeof hass?.callService !== "function") {
    return false;
  }
  const domain = id.split(".")[0];
  if (domain !== "input_text" && domain !== "text") {
    return false;
  }
  const payload = fitNewsHistoryPayloadToLimit(
    (Array.isArray(items) ? items : []).map(encodeCompactNewsHistoryEntry).filter(Boolean),
  );
  const current = String(hass.states?.[id]?.state ?? "").trim();
  if (current === payload) {
    return true;
  }
  try {
    hass.callService(domain, "set_value", {
      entity_id: id,
      value: payload,
    });
    return true;
  } catch (_err) {
    return false;
  }
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

function isUnsafeConfigPathKey(key) {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

function setByPath(target, path, value) {
  const parts = String(path || "").split(".");
  if (parts.some(isUnsafeConfigPathKey)) {
    return;
  }
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isObject(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

function deleteByPath(target, path) {
  const parts = String(path || "").split(".");
  if (parts.some(isUnsafeConfigPathKey)) {
    return;
  }
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isObject(cursor[key])) {
      return;
    }
    cursor = cursor[key];
  }
  delete cursor[parts[parts.length - 1]];
}

function escapeSelectorValue(value) {
  const text = String(value ?? "");
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(text);
  }
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function fireEvent(node, type, detail, options) {
  const event = new CustomEvent(type, {
    bubbles: options?.bubbles !== false,
    composed: options?.composed !== false,
    cancelable: Boolean(options?.cancelable),
    detail,
  });
  node.dispatchEvent(event);
  return event;
}

class NodaliaNewsCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig(STUB_CONFIG);
    this._hass = null;
    this._entityOptionsSignature = "";
    this._pendingEditorControlTags = new Set();
    this._onShadowInput = this._onShadowInput.bind(this);
    this._onShadowValueChanged = this._onShadowValueChanged.bind(this);
  }

  _attachEditorShadowListeners() {
    if (this._editorShadowListenersAttached || !this.shadowRoot) {
      return;
    }
    this.shadowRoot.addEventListener("input", this._onShadowInput);
    this.shadowRoot.addEventListener("change", this._onShadowInput);
    this.shadowRoot.addEventListener("value-changed", this._onShadowValueChanged);
    this._editorShadowListenersAttached = true;
  }

  _detachEditorShadowListeners() {
    if (!this._editorShadowListenersAttached || !this.shadowRoot) {
      return;
    }
    this.shadowRoot.removeEventListener("input", this._onShadowInput);
    this.shadowRoot.removeEventListener("change", this._onShadowInput);
    this.shadowRoot.removeEventListener("value-changed", this._onShadowValueChanged);
    this._editorShadowListenersAttached = false;
  }

  connectedCallback() {
    this._attachEditorShadowListeners();
    window.NodaliaUtils?.bindEditorDialogLayoutFix?.(this);
  }

  disconnectedCallback() {
    this._detachEditorShadowListeners();
    window.NodaliaUtils?.releaseEditorDialogLayoutFix?.(this);
  }

  setConfig(config) {
    const focusState = this._captureFocusState();
    this._config = normalizeConfig(config || {});
    this._render();
    this._restoreFocusState(focusState);
  }

  set hass(hass) {
    const nextSignature = window.NodaliaUtils?.editorFilteredStatesSignature?.(
      hass,
      this._config?.language,
      id => id.startsWith("sensor."),
    ) || "";
    const shouldRender = !this._hass || nextSignature !== this._entityOptionsSignature || !this.shadowRoot?.innerHTML;
    this._hass = hass;
    this._entityOptionsSignature = nextSignature;
    if (!shouldRender) {
      return;
    }
    const focusState = this._captureFocusState();
    this._render();
    this._restoreFocusState(focusState);
  }

  _watchEditorControlTag(tagName) {
    if (!tagName || this._pendingEditorControlTags.has(tagName)) {
      return;
    }
    if (typeof customElements?.whenDefined !== "function" || customElements.get(tagName)) {
      return;
    }
    this._pendingEditorControlTags.add(tagName);
    customElements.whenDefined(tagName)
      .then(() => {
        this._pendingEditorControlTags.delete(tagName);
        if (!this.isConnected || !this._hass || !this.shadowRoot) {
          return;
        }
        const focusState = this._captureFocusState();
        this._render();
        this._restoreFocusState(focusState);
      })
      .catch(() => {
        this._pendingEditorControlTags.delete(tagName);
      });
  }

  _ensureEditorControlsReady() {
    this._watchEditorControlTag("ha-entity-picker");
    this._watchEditorControlTag("ha-selector");
  }

  _captureFocusState() {
    const activeElement = this.shadowRoot?.activeElement;
    if (
      !(
        activeElement instanceof HTMLInputElement
        || activeElement instanceof HTMLTextAreaElement
        || activeElement instanceof HTMLSelectElement
      )
    ) {
      return null;
    }
    const selector = activeElement.dataset?.field
      ? `[data-field="${escapeSelectorValue(activeElement.dataset.field)}"]`
      : null;
    if (!selector) {
      return null;
    }
    const supportsSelection = typeof activeElement.selectionStart === "number"
      && typeof activeElement.selectionEnd === "number";
    return {
      selector,
      selectionEnd: supportsSelection ? activeElement.selectionEnd : null,
      selectionStart: supportsSelection ? activeElement.selectionStart : null,
      type: activeElement.type,
    };
  }

  _restoreFocusState(focusState) {
    if (!focusState?.selector || !this.shadowRoot) {
      return;
    }
    const target = this.shadowRoot.querySelector(focusState.selector);
    if (
      !(
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
      )
    ) {
      return;
    }
    try {
      target.focus({ preventScroll: true });
    } catch (_err) {
      target.focus();
    }
    if (
      focusState.type !== "checkbox"
      && typeof focusState.selectionStart === "number"
      && typeof focusState.selectionEnd === "number"
      && typeof target.setSelectionRange === "function"
    ) {
      try {
        target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
      } catch (_err) {
        // Ignore unsupported inputs.
      }
    }
  }

  _emitConfig() {
    const focusState = this._captureFocusState();
    const nextConfig = deepClone(this._config);
    this._config = normalizeConfig(compactConfig(nextConfig));
    this._render();
    this._restoreFocusState(focusState);
    fireEvent(this, "config-changed", {
      config: compactConfig(window.NodaliaUtils?.stripEqualToDefaults?.(nextConfig, DEFAULT_CONFIG) ?? nextConfig),
    });
  }

  _setFieldValue(path, value) {
    if (value === undefined || value === null || value === "") {
      deleteByPath(this._config, path);
      return;
    }
    setByPath(this._config, path, value);
  }

  _readFieldValue(input) {
    const valueType = input.dataset.valueType || "string";
    if (valueType === "boolean") {
      return Boolean(input.checked);
    }
    if (valueType === "number") {
      const numeric = Number(input.value);
      return Number.isFinite(numeric) ? numeric : input.value;
    }
    return input.value;
  }

  _onShadowInput(event) {
    const input = event.composedPath().find(node => (
      node instanceof HTMLInputElement
      || node instanceof HTMLSelectElement
      || node instanceof HTMLTextAreaElement
    ));
    if (!input?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    this._setFieldValue(input.dataset.field, this._readFieldValue(input));
    this._config = normalizeConfig(this._config);
    if (event.type === "change") {
      this._emitConfig();
    }
  }

  _onShadowValueChanged(event) {
    const control = event.composedPath().find(node => node instanceof HTMLElement && node.dataset?.field);
    if (!control?.dataset?.field) {
      return;
    }
    event.stopPropagation();
    const nextValue = typeof event.detail?.value === "string" ? event.detail.value : control.value;
    if (typeof control.dataset?.value === "string") {
      control.dataset.value = String(nextValue || "");
    }
    this._setFieldValue(control.dataset.field, nextValue);
    this._config = normalizeConfig(this._config);
    this._emitConfig();
  }

  _editorLabel(key) {
    if (typeof key !== "string" || !window.NodaliaI18n?.editorStr) {
      return key;
    }
    return window.NodaliaI18n.editorStr(this._hass, this._config?.language ?? "auto", key);
  }

  _renderTextField(label, field, value, options = {}) {
    const tLabel = this._editorLabel(label);
    const inputType = options.type || "text";
    const placeholder = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : "";
    const valueType = options.valueType || "string";
    return `
      <label class="editor-field ${options.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <input
          type="${escapeHtml(inputType)}"
          data-field="${escapeHtml(field)}"
          data-value-type="${escapeHtml(valueType)}"
          value="${escapeHtml(String(value ?? ""))}"
          ${placeholder}
        />
      </label>
    `;
  }

  _renderCheckboxField(label, field, checked) {
    const tLabel = this._editorLabel(label);
    return `
      <label class="editor-toggle">
        <input type="checkbox" data-field="${escapeHtml(field)}" data-value-type="boolean" ${checked ? "checked" : ""} />
        <span class="editor-toggle__switch" aria-hidden="true"></span>
        <span class="editor-toggle__label">${escapeHtml(tLabel)}</span>
      </label>
    `;
  }

  _renderSelectField(label, field, value, options, renderOptions = {}) {
    const tLabel = this._editorLabel(label);
    const strValue = String(value ?? "");
    return `
      <label class="editor-field ${renderOptions.fullWidth ? "editor-field--full" : ""}">
        <span>${escapeHtml(tLabel)}</span>
        <select data-field="${escapeHtml(field)}">
          ${options.map(option => `
            <option value="${escapeHtml(option.value)}" ${String(option.value) === strValue ? "selected" : ""}>
              ${escapeHtml(this._editorLabel(option.label))}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  _renderEntityPickerField(label, field, value) {
    const tLabel = this._editorLabel(label);
    const inputValue = value === undefined || value === null ? "" : String(value);
    return `
      <div class="editor-field editor-field--full">
        <span>${escapeHtml(tLabel)}</span>
        <div
          class="editor-control-host"
          data-mounted-control="entity"
          data-field="${escapeHtml(field)}"
          data-value="${escapeHtml(inputValue)}"
        ></div>
      </div>
    `;
  }

  _mountEntityPicker(host) {
    window.NodaliaUtils?.mountEntityPickerHost?.(host, {
      hass: this._hass,
      field: host.dataset.field || "entity",
      value: host.dataset.value || "",
      onShadowInput: this._onShadowInput,
      onShadowValueChanged: this._onShadowValueChanged,
      copyDatasetFromHost: true,
    });
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    const config = this._config || DEFAULT_CONFIG;
    const layout = config.layout || DEFAULT_CONFIG.layout;
    const appearance = config.appearance || DEFAULT_CONFIG.appearance;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        * { box-sizing: border-box; }
        .editor { color: var(--primary-text-color); display: grid; gap: 16px; }
        .editor-section {
          background: color-mix(in srgb, var(--primary-text-color) 2%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          border-radius: 18px;
          display: grid;
          gap: 14px;
          padding: 16px;
        }
        .editor-section__header { display: grid; gap: 4px; }
        .editor-section__title { font-size: 15px; font-weight: 700; }
        .editor-section__hint {
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.45;
        }
        .editor-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .editor-grid--stacked { grid-template-columns: 1fr; }
        .editor-field, .editor-toggle { display: grid; gap: 6px; min-width: 0; }
        .editor-field--full { grid-column: 1 / -1; }
        .editor-field:has(> .editor-control-host[data-mounted-control="entity"]) { grid-column: 1 / -1; }
        .editor-field > span, .editor-toggle > span {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 600;
        }
        .editor-field input, .editor-field select {
          appearance: none;
          background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border-radius: 12px;
          color: var(--primary-text-color);
          font: inherit;
          min-height: 40px;
          padding: 10px 12px;
          width: 100%;
        }
        .editor-field ha-entity-picker, .editor-field ha-selector, .editor-control-host, .editor-control-host > * {
          display: block;
          width: 100%;
        }
        :is(.editor-toggle, .editor-checkbox) {
          align-items: center;
          column-gap: 10px;
          cursor: pointer;
          grid-template-columns: auto minmax(0, 1fr);
          min-height: 40px;
          position: relative;
        }
        :is(.editor-toggle, .editor-checkbox) input {
          block-size: 1px;
          inline-size: 1px;
          margin: 0;
          opacity: 0;
          pointer-events: none;
          position: absolute;
        }
        .editor-toggle__switch {
          background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
          border-radius: 999px;
          display: inline-flex;
          height: 22px;
          position: relative;
          transition: background 160ms ease, border-color 160ms ease;
          width: 40px;
        }
        .editor-toggle__switch::before {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 999px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.24);
          content: "";
          height: 18px;
          left: 1px;
          position: absolute;
          top: 1px;
          transition: transform 160ms ease;
          width: 18px;
        }
        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch {
          background: var(--primary-color);
          border-color: var(--primary-color);
        }
        :is(.editor-toggle, .editor-checkbox) input:checked + .editor-toggle__switch::before {
          transform: translateX(18px);
        }
        @media (max-width: 640px) {
          .editor-grid { grid-template-columns: 1fr; }
        }
      </style>
      <div class="editor">
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.news.general_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.news.general_section_hint"))}</div>
          </div>
          <div class="editor-grid editor-grid--stacked">
            ${this._renderEntityPickerField("ed.news.entity", "entity", config.entity)}
            ${this._renderTextField("ed.news.title", "title", config.title, { fullWidth: true })}
            ${this._renderTextField("ed.news.max_items", "max_items", config.max_items, { type: "number", valueType: "number" })}
            ${this._renderCheckboxField("ed.news.remember_items", "remember_items", config.remember_items !== false)}
            ${this._renderTextField("ed.news.history_helper", "history_helper", config.history_helper || "", {
              fullWidth: true,
              placeholder: "input_text.nodalia_news_history",
            })}
            ${this._renderCheckboxField("ed.news.mirror_history_local", "mirror_history_local", config.mirror_history_local !== false)}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.news.layout_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.news.layout_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField("ed.news.layout_mode", "layout.mode", layout.mode, [
              { value: "magazine", label: "ed.news.layout_mode_magazine" },
              { value: "compact", label: "ed.news.layout_mode_compact" },
              { value: "list", label: "ed.news.layout_mode_list" },
            ])}
            ${this._renderSelectField("ed.news.density", "layout.density", layout.density || "normal", [
              { value: "compact", label: "ed.news.density_compact" },
              { value: "normal", label: "ed.news.density_normal" },
              { value: "relaxed", label: "ed.news.density_relaxed" },
            ])}
            ${this._renderCheckboxField("ed.news.show_images", "layout.show_images", layout.show_images !== false)}
            ${this._renderCheckboxField("ed.news.show_summary", "layout.show_summary", layout.show_summary !== false)}
            ${this._renderCheckboxField("ed.news.show_source", "layout.show_source", layout.show_source !== false)}
            ${this._renderCheckboxField("ed.news.show_time", "layout.show_time", layout.show_time !== false)}
            ${this._renderCheckboxField("ed.news.show_category", "layout.show_category", layout.show_category !== false)}
          </div>
        </section>
        <section class="editor-section">
          <div class="editor-section__header">
            <div class="editor-section__title">${escapeHtml(this._editorLabel("ed.news.appearance_section_title"))}</div>
            <div class="editor-section__hint">${escapeHtml(this._editorLabel("ed.news.appearance_section_hint"))}</div>
          </div>
          <div class="editor-grid">
            ${this._renderSelectField("ed.news.appearance_preset", "appearance.preset", appearance.preset || "glass", [
              { value: "glass", label: "ed.news.appearance_glass" },
              { value: "default", label: "ed.news.appearance_default" },
            ], { fullWidth: true })}
          </div>
        </section>
      </div>
    `;

    this.shadowRoot.querySelectorAll('[data-mounted-control="entity"]').forEach(host => {
      this._mountEntityPicker(host);
    });
    this._ensureEditorControlsReady();
    window.NodaliaUtils?.clampEditorDialogScroll?.(this);
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaNewsCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaNewsCardEditor);
}

window.NodaliaUtils?.registerCustomCard?.({
  type: CARD_TAG,
  name: "Nodalia News Card",
  description: "Editorial newspaper-style news card for Home Assistant dashboards.",
  preview: true,
  documentationURL: "https://github.com/danielmigueltejedor/nodalia-cards/blob/main/docs/cards/news-card.md",
});
