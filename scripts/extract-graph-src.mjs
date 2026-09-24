/**
 * One-shot extractor: splits nodalia-graph-card.js into src/cards/graph/*.ts
 * without rewriting logic. Re-run only when regenerating the graph source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-graph-card.js");
const outDir = path.join(root, "src", "cards", "graph");

if (fs.existsSync(path.join(outDir, "graph-card.ts"))) {
  throw new Error(
    "src/cards/graph already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
  path.join(outDir, "graph-runtime.ts"),
  `import type { NodaliaUtilsApi } from "../../core/types/nodalia-utils";

const utils: NodaliaUtilsApi = window.NodaliaUtils;

export const isObject = utils.isObject.bind(utils) as NodaliaUtilsApi["isObject"];
export const deepClone = utils.deepClone.bind(utils) as NodaliaUtilsApi["deepClone"];
export const mergeConfig = utils.mergeDeep.bind(utils) as NodaliaUtilsApi["mergeDeep"];
export const isUnsafeConfigPathKey = utils.isUnsafeConfigPathKey.bind(utils) as NodaliaUtilsApi["isUnsafeConfigPathKey"];
export const setByPath = utils.setByPath.bind(utils) as NodaliaUtilsApi["setByPath"];
export const deleteByPath = utils.deleteByPath.bind(utils) as NodaliaUtilsApi["deleteByPath"];
export const clamp = utils.clamp.bind(utils) as NodaliaUtilsApi["clamp"];
export const escapeHtml = utils.escapeHtml.bind(utils) as NodaliaUtilsApi["escapeHtml"];
export const fireEvent = utils.fireEvent.bind(utils) as NodaliaUtilsApi["fireEvent"];
export const normalizeTextKey = utils.normalizeTextKey.bind(utils) as NodaliaUtilsApi["normalizeTextKey"];
`,
);

fs.writeFileSync(path.join(outDir, "graph-constants.ts"), `${exportConsts(slice(1, 26)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "graph-helpers.ts"),
  `// @ts-nocheck -- chart, history and editor color helpers stay loosely typed until remaining unknowns are narrowed.
import { SERIES_COLORS } from "./graph-constants";
import { clamp, isObject, isUnsafeConfigPathKey, normalizeTextKey } from "./graph-runtime";

${exportFunctions(`${slice(113, 412)}\n\n${slice(426, 502)}`).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "graph-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime graph config.
import { deepClone, mergeConfig } from "./graph-runtime";
import { resolveEntityEntries } from "./graph-helpers";

${slice(28, 95).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(slice(414, 424)).trim()}
`,
);

const cardClass = slice(504, 3172).replace(/^class NodaliaGraphCard/, "export class NodaliaGraphCard");
const legacyEditorClass = slice(3178, 3801).replace(
  /^class NodaliaGraphCardEditorLegacy/,
  "export class NodaliaGraphCardEditorLegacy",
);
const editorClass = slice(3803, 5070).replace(/^class NodaliaGraphCardEditor/, "export class NodaliaGraphCardEditor");

fs.writeFileSync(
  path.join(outDir, "graph-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  HISTORY_REFRESH_INTERVAL,
  SERIES_COLORS,
  TOUCH_CHART_HOLD_MS,
  TOUCH_CLICK_SUPPRESSION_WINDOW,
  TOUCH_MOVE_CANCEL_DISTANCE,
  CHART_TAP_MAX_MOVE,
} from "./graph-constants";
import {
  clamp,
  deepClone,
  escapeHtml,
  fireEvent,
  isObject,
  normalizeTextKey,
} from "./graph-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./graph-config";
import {
  buildAreaPath,
  buildInterpolatedSamples,
  buildSmoothPath,
  escapeSelectorValue,
  formatHoverTimestamp,
  formatNumberValue,
  getHassLocaleTag,
  getRenderSignatureRuntime,
  getStubEntityIds,
  getStubFriendlyName,
  graphChartXToPercent,
  inferDecimals,
  isUnavailableState,
  parseHistoryTimestamp,
  parseNumber,
  parsePaddingEdges,
  parseSizeToPixels,
  resolveEntityEntries,
} from "./graph-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "graph-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import { SERIES_COLORS } from "./graph-constants";
import {
  deleteByPath,
  escapeHtml,
  fireEvent,
  setByPath,
} from "./graph-runtime";
import {
  DEFAULT_CONFIG,
  STUB_CONFIG,
  normalizeConfig,
  normalizeEditorConfig,
} from "./graph-config";
import {
  compactConfig,
  formatEditorColorFromHex,
  getByPath,
  getEditorColorFallbackValue,
  getEditorColorModel,
  moveItem,
} from "./graph-helpers";

${legacyEditorClass.trim()}

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "graph-types.ts"),
  `export interface GraphPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: (rawConfig?: unknown, options?: { preserveEmptyEntities?: boolean }) => Record<string, unknown>;
  normalizeEditorConfig: (rawConfig?: unknown) => Record<string, unknown>;
}
`,
);

fs.writeFileSync(
  path.join(outDir, "index.ts"),
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./graph-constants";
import { DEFAULT_CONFIG, normalizeConfig, normalizeEditorConfig } from "./graph-config";
import { NodaliaGraphCard } from "./graph-card";
import { NodaliaGraphCardEditor } from "./graph-editor";
import type { GraphPublicApi } from "./graph-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaGraphCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaGraphCardEditor);
}

try {
  window.NodaliaUtils?.registerCustomCard?.({
    type: CARD_TAG,
    name: "Nodalia Graph Card",
    description: "Tarjeta de grafica elegante para una o varias entidades numericas con estilo Nodalia.",
    preview: true,
  });
} catch {
  // Picker registration must never prevent the card custom element from loading.
}

const publicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
  normalizeEditorConfig,
} as GraphPublicApi;

window.__NODALIA_GRAPH__ = publicApi;
`,
);

fs.writeFileSync(
  path.join(outDir, "standalone.ts"),
  `import { EDITOR_TAG } from "./graph-constants";
import { NodaliaGraphCardEditorLegacy } from "./graph-editor";
import "./index";

// Keep the historical unused editor class in the standalone artifact.
const _legacyEditorKept =
  customElements.get(\`\${EDITOR_TAG}-legacy\`) === NodaliaGraphCardEditorLegacy;
`,
);

console.log("Wrote graph TypeScript sources to", outDir);
