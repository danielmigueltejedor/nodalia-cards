/**
 * One-shot extractor: splits nodalia-cover-card.js into src/cards/cover/*.ts
 * without rewriting logic. Re-run only when regenerating the cover source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-cover-card.js");
const outDir = path.join(root, "src", "cards", "cover");

if (fs.existsSync(path.join(outDir, "cover-card.ts"))) {
  throw new Error(
    "src/cards/cover already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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

const runtimeHeader = `import type { NodaliaUtilsApi } from "../../core/types/nodalia-utils";

const utils: NodaliaUtilsApi = window.NodaliaUtils;

export const isObject = utils.isObject.bind(utils) as NodaliaUtilsApi["isObject"];
export const deepClone = utils.deepClone.bind(utils) as NodaliaUtilsApi["deepClone"];
export const mergeConfig = utils.mergeDeep.bind(utils) as NodaliaUtilsApi["mergeDeep"];
export const compactConfig = utils.compactConfig.bind(utils) as NodaliaUtilsApi["compactConfig"];
export const isUnsafeConfigPathKey = utils.isUnsafeConfigPathKey.bind(utils) as NodaliaUtilsApi["isUnsafeConfigPathKey"];
export const setByPath = utils.setByPath.bind(utils) as NodaliaUtilsApi["setByPath"];
export const deleteByPath = utils.deleteByPath.bind(utils) as NodaliaUtilsApi["deleteByPath"];
export const clamp = utils.clamp.bind(utils) as NodaliaUtilsApi["clamp"];
export const escapeHtml = utils.escapeHtml.bind(utils) as NodaliaUtilsApi["escapeHtml"];
export const escapeSelectorValue = utils.escapeSelectorValue.bind(utils) as NodaliaUtilsApi["escapeSelectorValue"];
export const fireEvent = utils.fireEvent.bind(utils) as NodaliaUtilsApi["fireEvent"];
export const normalizeTextKey = utils.normalizeTextKey.bind(utils) as NodaliaUtilsApi["normalizeTextKey"];
`;

const constants = `${exportConsts(slice(1, 27))}

${exportConsts(slice(437, 439))}
`;

const defaultConfig = slice(29, 127)
  .replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG")
  .replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG");

const configMigrate = exportFunctions(slice(192, 269));
const helpersBody = exportFunctions(`${slice(311, 382)}\n\n${slice(395, 435)}\n\n${slice(441, 551)}`);

const cardClass = slice(553, 2447)
  .replace(/^class NodaliaCoverCard/, "export class NodaliaCoverCard");

const editorClass = slice(2453, 3342)
  .replace(/^class NodaliaCoverCardEditor/, "export class NodaliaCoverCardEditor");

const runtimeImports = `import {
  clamp,
  compactConfig,
  deepClone,
  deleteByPath,
  escapeHtml,
  escapeSelectorValue,
  fireEvent,
  isObject,
  mergeConfig,
  normalizeTextKey,
  setByPath,
} from "./cover-runtime";`;

fs.writeFileSync(path.join(outDir, "cover-runtime.ts"), `${runtimeHeader}\n`);
fs.writeFileSync(path.join(outDir, "cover-constants.ts"), `${constants.trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "cover-helpers.ts"),
  `// @ts-nocheck -- color/dial helpers stay loosely typed until remaining unknowns are narrowed.
import {
  CIRCULAR_LAYOUT_DIAL_END_ANGLE,
  CIRCULAR_LAYOUT_DIAL_START_ANGLE,
  CIRCULAR_LAYOUT_DIAL_SWEEP,
} from "./cover-constants";
import { DEFAULT_CONFIG } from "./cover-config";
import { clamp, deepClone, isObject, normalizeTextKey } from "./cover-runtime";

${helpersBody.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "cover-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime cover config.
import { deepClone, isObject, mergeConfig, normalizeTextKey } from "./cover-runtime";

${defaultConfig}

${configMigrate.trim()}
`,
);

const cardImports = `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  COVER_CONTROLS_TOGGLE_LANE_MAX_COLUMNS,
  COVER_CONTROLS_TOGGLE_LANE_MAX_WIDTH,
  COVER_FEATURES,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
} from "./cover-constants";
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./cover-config";
import {
  applyStubEntity,
  coverDeviceIcon,
  getCircularLayoutDialModel,
  getCircularLayoutDialValueFromPoint,
  getRangeValueFromGeometry,
  getSliderDragGeometry,
  isUnavailableState,
  parseNumber,
  parseServiceData,
  resolveOpenCloseControlIcons,
} from "./cover-helpers";
`;

fs.writeFileSync(path.join(outDir, "cover-card.ts"), `${cardImports}\n${cardClass.trim()}\n`);

const editorImports = `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig, normalizeList } from "./cover-config";
import {
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
} from "./cover-helpers";
`;

fs.writeFileSync(path.join(outDir, "cover-editor.ts"), `${editorImports}\n${editorClass.trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "cover-types.ts"),
  `export interface CoverPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: (rawConfig?: unknown) => Record<string, unknown>;
}
`,
);

fs.writeFileSync(
  path.join(outDir, "index.ts"),
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./cover-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./cover-config";
import { NodaliaCoverCard } from "./cover-card";
import { NodaliaCoverCardEditor } from "./cover-editor";
import type { CoverPublicApi } from "./cover-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCoverCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCoverCardEditor);
}

(function registerNodaliaCoverCardPicker() {
  const hass = window.NodaliaI18n?.resolveHass?.(null);
  const lang = window.NodaliaI18n?.resolveLanguage?.(hass, "auto") ?? "en";
  const pack = (window.NodaliaI18n?.strings?.(lang) as { coverCard?: { cardDescription?: string } } | undefined)?.coverCard
    ?? (window.NodaliaI18n?.strings?.("en") as { coverCard?: { cardDescription?: string } } | undefined)?.coverCard;
  const description = String(pack?.cardDescription || "Fan-style controls for Home Assistant cover entities.");
  window.NodaliaUtils.registerCustomCard({
    type: CARD_TAG,
    name: "Nodalia Cover Card",
    description,
    preview: true,
  });
})();

const publicApi: CoverPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_COVER__ = publicApi;
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote cover TypeScript sources to", outDir);
