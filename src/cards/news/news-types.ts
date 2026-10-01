export interface NewsPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: typeof import("./news-config").normalizeConfig;
  normalizeNewsItem: typeof import("./news-helpers").normalizeNewsItem;
  resolveSourceEntries: typeof import("./news-helpers").resolveSourceEntries;
  collectNormalizedItems: typeof import("./news-helpers").collectNormalizedItems;
  applyNewsFilters: typeof import("./news-helpers").applyNewsFilters;
  getNewsItemsForConfig: typeof import("./news-helpers").getNewsItemsForConfig;
  isSafeHttpUrl: typeof import("./news-helpers").isSafeHttpUrl;
  parsePublishedMs: typeof import("./news-helpers").parsePublishedMs;
  parseHideOlderThanMs: typeof import("./news-helpers").parseHideOlderThanMs;
  buildNewsRenderStamp: typeof import("./news-helpers").buildNewsRenderStamp;
  coerceNewsAttributeList: typeof import("./news-helpers").coerceNewsAttributeList;
  extractRawItemsFromState: typeof import("./news-helpers").extractRawItemsFromState;
  getNewsSourceHealth: typeof import("./news-helpers").getNewsSourceHealth;
  mergeNewsItemHistory: typeof import("./news-helpers").mergeNewsItemHistory;
  restoreNewsHistoryItem: typeof import("./news-helpers").restoreNewsHistoryItem;
  getNewsHistoryStorageKey: typeof import("./news-helpers").getNewsHistoryStorageKey;
  encodeCompactNewsHistoryEntry: typeof import("./news-helpers").encodeCompactNewsHistoryEntry;
  decodeCompactNewsHistoryEntry: typeof import("./news-helpers").decodeCompactNewsHistoryEntry;
  parseNewsHistoryFromHelperState: typeof import("./news-helpers").parseNewsHistoryFromHelperState;
  fitNewsHistoryPayloadToLimit: typeof import("./news-helpers").fitNewsHistoryPayloadToLimit;
  loadNewsHistoryFromHelper: typeof import("./news-helpers").loadNewsHistoryFromHelper;
  writeNewsHistoryToHelper: typeof import("./news-helpers").writeNewsHistoryToHelper;
}
