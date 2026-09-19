/**
 * One-shot extractor: splits nodalia-news-card.js into src/cards/news/*.ts
 * without rewriting logic. Re-run only when regenerating the news source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-news-card.js");
const outDir = path.join(root, "src", "cards", "news");

if (fs.existsSync(path.join(outDir, "news-card.ts"))) {
  throw new Error(
    "src/cards/news already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
  );
}

const lines = fs.readFileSync(sourcePath, "utf8").split("\n");
const slice = (start, end) => lines.slice(start - 1, end).join("\n");

function exportFunctions(code) {
  return code
    .replace(/^function /gm, "export function ")
    .replace(/^async function /gm, "export async function ")
    .replace(/^const ([A-Z][A-Z0-9_]*) = /gm, "export const $1 = ");
}

function exportConsts(code) {
  return code.replace(/^const /gm, "export const ");
}

fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, "news-runtime.ts"),
  `import type { NodaliaUtilsApi } from "../../core/types/nodalia-utils";

const utils: NodaliaUtilsApi = window.NodaliaUtils;

export const isObject = utils.isObject.bind(utils) as NodaliaUtilsApi["isObject"];
export const deepClone = utils.deepClone.bind(utils) as NodaliaUtilsApi["deepClone"];
export const mergeConfig = utils.mergeDeep.bind(utils) as NodaliaUtilsApi["mergeDeep"];
export const isUnsafeConfigPathKey = utils.isUnsafeConfigPathKey.bind(utils) as NodaliaUtilsApi["isUnsafeConfigPathKey"];
`,
);

fs.writeFileSync(path.join(outDir, "news-constants.ts"), `${exportConsts(slice(1, 15)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "news-helpers.ts"),
  `// @ts-nocheck -- news, history and URL helpers stay loosely typed until remaining unknowns are narrowed.
import {
  ITEM_LIST_ATTRS,
  NEWS_HISTORY_HELPER_MAX_CHARS,
  NEWS_HISTORY_STORAGE_PREFIX,
} from "./news-constants";
import { deepClone, isObject, isUnsafeConfigPathKey } from "./news-runtime";
import { DEFAULT_CONFIG, normalizeConfig } from "./news-config";

${exportFunctions(`${slice(78, 439)}\n\n${slice(493, 778)}\n\n${slice(2041, 2090)}`).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "news-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime news config.
import { APPEARANCE_PRESETS, DENSITY_MODES, LAYOUT_MODES } from "./news-constants";
import { deepClone, isObject, mergeConfig } from "./news-runtime";

${slice(17, 65).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(slice(441, 491)).trim()}
`,
);

const cardClass = slice(780, 2038).replace(/^class NodaliaNewsCard/, "export class NodaliaNewsCard");
const editorClass = slice(2092, 2498).replace(/^class NodaliaNewsCardEditor/, "export class NodaliaNewsCardEditor");

fs.writeFileSync(
  path.join(outDir, "news-card.ts"),
  `// @ts-nocheck
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

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "news-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./news-config";
import {
  compactConfig,
  deleteByPath,
  escapeHtml,
  fireEvent,
  setByPath,
} from "./news-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "news-types.ts"),
  `export interface NewsPublicApi {
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
`,
);

fs.writeFileSync(
  path.join(outDir, "index.ts"),
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./news-constants";
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
import { NodaliaNewsCard } from "./news-card";
import { NodaliaNewsCardEditor } from "./news-editor";
import type { NewsPublicApi } from "./news-types";

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

const publicApi: NewsPublicApi = {
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
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote news TypeScript sources to", outDir);
