/**
 * One-shot extractor: splits nodalia-humidifier-card.js into src/cards/humidifier/*.ts
 * without rewriting logic. Re-run only when regenerating the humidifier source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-humidifier-card.js");
const outDir = path.join(root, "src", "cards", "humidifier");

if (fs.existsSync(path.join(outDir, "humidifier-card.ts"))) {
  throw new Error(
    "src/cards/humidifier already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
export const getByPath = utils.getByPath.bind(utils) as NodaliaUtilsApi["getByPath"];
export const clamp = utils.clamp.bind(utils) as NodaliaUtilsApi["clamp"];
export const escapeHtml = utils.escapeHtml.bind(utils) as NodaliaUtilsApi["escapeHtml"];
export const escapeSelectorValue = utils.escapeSelectorValue.bind(utils) as NodaliaUtilsApi["escapeSelectorValue"];
export const fireEvent = utils.fireEvent.bind(utils) as NodaliaUtilsApi["fireEvent"];
export const normalizeTextKey = utils.normalizeTextKey.bind(utils) as NodaliaUtilsApi["normalizeTextKey"];
`;

const constants = `${exportConsts(slice(1, 16))}

${exportConsts(slice(313, 315))}

${exportConsts(slice(432, 435))}
`;

const defaultConfig = slice(18, 122)
  .replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG")
  .replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG");

const styleHelpers = exportFunctions(slice(173, 201));
const helpersBody = exportFunctions(`${slice(143, 171)}\n\n${slice(203, 311)}\n\n${slice(317, 430)}`);
const configMigrate = exportFunctions(slice(437, 516));

const cardClass = slice(518, 4349)
  .replace(/^class NodaliaHumidifierCard/, "export class NodaliaHumidifierCard");

const editorClass = slice(4355, 5818)
  .replace(/^class NodaliaHumidifierCardEditor/, "export class NodaliaHumidifierCardEditor");

const runtimeImports = `import {
  clamp,
  compactConfig,
  deepClone,
  deleteByPath,
  escapeHtml,
  escapeSelectorValue,
  fireEvent,
  getByPath,
  isObject,
  mergeConfig,
  normalizeTextKey,
  setByPath,
} from "./humidifier-runtime";`;

fs.writeFileSync(path.join(outDir, "humidifier-runtime.ts"), `${runtimeHeader}\n`);
fs.writeFileSync(path.join(outDir, "humidifier-constants.ts"), `${constants.trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "humidifier-helpers.ts"),
  `// @ts-nocheck -- color/dial helpers stay loosely typed until remaining unknowns are narrowed.
import {
  CIRCULAR_LAYOUT_DIAL_END_ANGLE,
  CIRCULAR_LAYOUT_DIAL_START_ANGLE,
  CIRCULAR_LAYOUT_DIAL_SWEEP,
} from "./humidifier-constants";
import { clamp, normalizeTextKey } from "./humidifier-runtime";

${helpersBody.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "humidifier-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime humidifier config.
import { LEGACY_ICON_OFF_COLOR_VALUES } from "./humidifier-constants";
import { isObject, mergeConfig, normalizeTextKey } from "./humidifier-runtime";

${defaultConfig}

${styleHelpers.trim()}

${configMigrate.trim()}
`,
);

const cardImports = `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  COMPACT_LAYOUT_THRESHOLD,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  HUMIDIFIER_MEMORY_STORAGE_KEY,
  OPTIMISTIC_TOGGLE_TIMEOUT,
  OPTIMISTIC_VISUAL_SETTLE_MS,
} from "./humidifier-constants";
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, getSafeStyles, normalizeConfig } from "./humidifier-config";
import {
  applyStubEntity,
  getCircularLayoutDialModel,
  getCircularLayoutDialValueFromPoint,
  getRangeValueFromGeometry,
  getSliderDragGeometry,
  isUnavailableState,
  parseSizeToPixels,
  translateModeLabel,
} from "./humidifier-helpers";
`;

fs.writeFileSync(path.join(outDir, "humidifier-card.ts"), `${cardImports}\n${cardClass.trim()}\n`);

const editorImports = `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./humidifier-config";
import {
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
  translateModeLabel,
} from "./humidifier-helpers";
`;

fs.writeFileSync(path.join(outDir, "humidifier-editor.ts"), `${editorImports}\n${editorClass.trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "humidifier-types.ts"),
  `export interface HumidifierPublicApi {
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
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./humidifier-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./humidifier-config";
import { NodaliaHumidifierCard } from "./humidifier-card";
import { NodaliaHumidifierCardEditor } from "./humidifier-editor";
import type { HumidifierPublicApi } from "./humidifier-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaHumidifierCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaHumidifierCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Humidifier Card",
  description: "Tarjeta de humidificador o deshumidificador con control visual de humedad y modos.",
  preview: true,
});

const publicApi: HumidifierPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_HUMIDIFIER__ = publicApi;
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote humidifier TypeScript sources to", outDir);
