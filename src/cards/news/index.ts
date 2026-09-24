import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./news-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./news-config";
import {
  applyNewsFilters,
  buildNewsRenderStamp,
  coerceNewsAttributeList,
  collectNormalizedItems,
  decodeCompactNewsHistoryEntry,
  encodeCompactNewsHistoryEntry,
  extractRawItemsFromState,
  fitNewsHistoryPayloadToLimit,
  getNewsHistoryStorageKey,
  getNewsItemsForConfig,
  getNewsSourceHealth,
  isSafeHttpUrl,
  loadNewsHistoryFromHelper,
  mergeNewsItemHistory,
  normalizeNewsItem,
  parseHideOlderThanMs,
  parseNewsHistoryFromHelperState,
  parsePublishedMs,
  resolveSourceEntries,
  restoreNewsHistoryItem,
  writeNewsHistoryToHelper,
} from "./news-helpers";
import { loadNodaliaNewsCard } from "./news-card";
import { loadNodaliaNewsCardEditor } from "./news-editor";
import type { NewsPublicApi } from "./news-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaNewsCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaNewsCardEditor);

window.NodaliaUtils?.registerCustomCard?.({
  type: CARD_TAG,
  name: "Nodalia News Card",
  description: "Editorial newspaper-style news card for Home Assistant dashboards.",
  preview: true,
  documentationURL: "https://github.com/danielmigueltejedor/nodalia-cards/blob/main/docs/cards/news-card.md",
});

const publicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
  normalizeNewsItem,
  resolveSourceEntries,
  collectNormalizedItems,
  applyNewsFilters,
  getNewsItemsForConfig,
  isSafeHttpUrl,
  parsePublishedMs,
  parseHideOlderThanMs,
  buildNewsRenderStamp,
  coerceNewsAttributeList,
  extractRawItemsFromState,
  getNewsSourceHealth,
  mergeNewsItemHistory,
  restoreNewsHistoryItem,
  getNewsHistoryStorageKey,
  encodeCompactNewsHistoryEntry,
  decodeCompactNewsHistoryEntry,
  parseNewsHistoryFromHelperState,
  fitNewsHistoryPayloadToLimit,
  loadNewsHistoryFromHelper,
  writeNewsHistoryToHelper,
};

window.__NODALIA_NEWS__ = publicApi as NewsPublicApi;
