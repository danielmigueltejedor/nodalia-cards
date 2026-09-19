export interface NewsPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: (rawConfig?: unknown) => Record<string, unknown>;
  normalizeNewsItem: (...args: unknown[]) => unknown;
  resolveSourceEntries: (...args: unknown[]) => unknown;
  collectNormalizedItems: (...args: unknown[]) => unknown;
  applyNewsFilters: (...args: unknown[]) => unknown;
  getNewsItemsForConfig: (...args: unknown[]) => unknown;
  isSafeHttpUrl: (...args: unknown[]) => unknown;
  parsePublishedMs: (...args: unknown[]) => unknown;
  parseHideOlderThanMs: (...args: unknown[]) => unknown;
  buildNewsRenderStamp: (...args: unknown[]) => unknown;
  coerceNewsAttributeList: (...args: unknown[]) => unknown;
  extractRawItemsFromState: (...args: unknown[]) => unknown;
  getNewsSourceHealth: (...args: unknown[]) => unknown;
  mergeNewsItemHistory: (...args: unknown[]) => unknown;
  restoreNewsHistoryItem: (...args: unknown[]) => unknown;
  getNewsHistoryStorageKey: (...args: unknown[]) => unknown;
  encodeCompactNewsHistoryEntry: (...args: unknown[]) => unknown;
  decodeCompactNewsHistoryEntry: (...args: unknown[]) => unknown;
  parseNewsHistoryFromHelperState: (...args: unknown[]) => unknown;
  fitNewsHistoryPayloadToLimit: (...args: unknown[]) => unknown;
  loadNewsHistoryFromHelper: (...args: unknown[]) => unknown;
  writeNewsHistoryToHelper: (...args: unknown[]) => unknown;
}
