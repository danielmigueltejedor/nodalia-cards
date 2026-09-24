// @ts-nocheck -- news, history and URL helpers stay loosely typed until remaining unknowns are narrowed.
import {
  ITEM_LIST_ATTRS,
  NEWS_HISTORY_HELPER_MAX_CHARS,
  NEWS_HISTORY_STORAGE_PREFIX,
} from "./news-constants";
import { deepClone, isObject, isUnsafeConfigPathKey } from "./news-runtime";
import { DEFAULT_CONFIG, normalizeConfig } from "./news-config";

export function compactConfig(value) {
  if (Array.isArray(value)) {
    return value.map(item => compactConfig(item)).filter(item => item !== undefined);
  }
  if (isObject(value)) {
    const compacted = {};
    Object.entries(value).forEach(([key, item]) => {
      if (window.NodaliaUtils?.isUnsafeConfigPathKey?.(key)) {
        return;
      }
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

export function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isSafeHttpUrl(url) {
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

export function sanitizeImageUrl(url) {
  return isSafeHttpUrl(url) ? String(url).trim() : "";
}

export function pickFirstString(source, keys) {
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

export function parsePublishedMs(value) {
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

export function parseHideOlderThanMs(value) {
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

export function normalizeKeywordList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(item => String(item ?? "").trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeNewsItem(raw, sourceMeta = {}) {
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

export function coerceNewsAttributeList(value) {
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

export function extractRawItemsFromState(state) {
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

export function resolveSourceEntries(config) {
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

export function isLovelaceHassStatesHydrated(hass) {
  return window.NodaliaUtils?.isLovelaceHassStatesHydrated?.(hass) === true;
}

export function isNewsSourceStateUnavailable(state) {
  if (!state) {
    return true;
  }
  if (extractRawItemsFromState(state).length > 0) {
    return false;
  }
  const stateKey = String(state.state || "").toLowerCase();
  return stateKey === "unavailable" || stateKey === "unknown";
}

export function getNewsSourceHealth(hass, config) {
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

export function collectNormalizedItems(hass, config) {
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

export function keywordMatches(text, keywords) {
  if (!keywords.length) {
    return true;
  }
  const haystack = String(text || "").toLowerCase();
  return keywords.some(keyword => haystack.includes(keyword));
}

export function applyNewsFilters(items, config, nowMs = Date.now()) {
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

export function getNewsItemsForConfig(hass, config, nowMs = Date.now()) {
  const normalized = normalizeConfig(config);
  const collected = collectNormalizedItems(hass, normalized);
  return applyNewsFilters(collected, normalized, nowMs);
}

export function buildNewsRenderStamp(items) {
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

export function getNewsHistoryStorageKey(config) {
  const explicit = String(config?.storage_key ?? "").trim();
  if (explicit) {
    return `${NEWS_HISTORY_STORAGE_PREFIX}${explicit}`;
  }
  const sources = resolveSourceEntries(config).map(entry => entry.entity).sort().join(",");
  return `${NEWS_HISTORY_STORAGE_PREFIX}${sources || "default"}`;
}

export function compactNewsHistoryItem(item) {
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

export function restoreNewsHistoryItem(stored) {
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

export function mergeNewsItemHistory(stored, incoming, maxItems) {
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

export function loadNewsHistoryFromStorage(storageKey) {
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

export function saveNewsHistoryToStorage(storageKey, items) {
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

export function encodeCompactNewsHistoryEntry(item) {
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

export function decodeCompactNewsHistoryEntry(entry) {
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

export function parseNewsHistoryFromHelperState(rawState) {
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

export function fitNewsHistoryPayloadToLimit(entries, maxChars = NEWS_HISTORY_HELPER_MAX_CHARS) {
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

export function loadNewsHistoryFromHelper(hass, entityId) {
  const id = String(entityId ?? "").trim();
  if (!id || !hass?.states?.[id]) {
    return [];
  }
  return parseNewsHistoryFromHelperState(hass.states[id].state);
}

export function getNewsHistoryHelperSignature(hass, entityId) {
  const id = String(entityId ?? "").trim();
  if (!id || !hass?.states?.[id]) {
    return "";
  }
  const state = hass.states[id];
  return `${state.state ?? ""}::${state.last_changed ?? state.last_updated ?? ""}`;
}

export function writeNewsHistoryToHelper(hass, entityId, items) {
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

export function getLocaleTag(hass, language) {
  const lang = window.NodaliaI18n?.resolveLanguage?.(hass, language ?? "auto");
  return window.NodaliaI18n?.localeTag?.(lang) || hass?.locale?.language || "en";
}

export function formatRelativePublished(ms, ui, locale) {
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

export function setByPath(target, path, value) {
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

export function deleteByPath(target, path) {
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

export function escapeSelectorValue(value) {
  const text = String(value ?? "");
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(text);
  }
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function fireEvent(node, type, detail, options) {
  const event = new CustomEvent(type, {
    bubbles: options?.bubbles !== false,
    composed: options?.composed !== false,
    cancelable: Boolean(options?.cancelable),
    detail,
  });
  node.dispatchEvent(event);
  return event;
}
