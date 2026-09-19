/**
 * One-shot extractor: splits nodalia-fan-card.js into src/cards/fan/*.ts
 * without rewriting logic. Re-run only when regenerating the fan source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-fan-card.js");
const outDir = path.join(root, "src", "cards", "fan");

if (fs.existsSync(path.join(outDir, "fan-card.ts"))) {
  throw new Error(
    "src/cards/fan already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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

const constants = `${exportConsts(slice(1, 17))}

${exportConsts(slice(328, 330))}

${exportConsts(slice(432, 435))}
`;

const defaultConfig = slice(19, 133)
  .replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG")
  .replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG");

const styleHelpers = exportFunctions(slice(182, 210));
const helpersBody = exportFunctions(`${slice(153, 180)}\n\n${slice(212, 326)}\n\n${slice(331, 429)}`);
const configMigrate = exportFunctions(slice(437, 517));

const cardClass = slice(519, 4123)
  .replace(/^class NodaliaFanCard/, "export class NodaliaFanCard");

const editorClass = slice(4129, 5433)
  .replace(/^class NodaliaFanCardEditor/, "export class NodaliaFanCardEditor");

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
} from "./fan-runtime";`;

fs.writeFileSync(path.join(outDir, "fan-runtime.ts"), `${runtimeHeader}\n`);
fs.writeFileSync(path.join(outDir, "fan-constants.ts"), `${constants.trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "fan-helpers.ts"),
  `// @ts-nocheck -- color/dial helpers stay loosely typed until remaining unknowns are narrowed.
import {
  CIRCULAR_LAYOUT_DIAL_END_ANGLE,
  CIRCULAR_LAYOUT_DIAL_START_ANGLE,
  CIRCULAR_LAYOUT_DIAL_SWEEP,
} from "./fan-constants";
import { clamp, normalizeTextKey } from "./fan-runtime";

${helpersBody.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "fan-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime fan config.
import { LEGACY_ICON_OFF_COLOR_VALUES } from "./fan-constants";
import { isObject, mergeConfig, normalizeTextKey } from "./fan-runtime";

${defaultConfig}

${styleHelpers.trim()}

${configMigrate.trim()}
`,
);

const cardImports = `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  ALLOWED_DOUBLE_TAP_ACTIONS,
  CARD_TAG,
  COMPACT_LAYOUT_THRESHOLD,
  EDITOR_TAG,
  FAN_MEMORY_STORAGE_KEY,
  HAPTIC_PATTERNS,
  OPTIMISTIC_TOGGLE_TIMEOUT,
  OPTIMISTIC_VISUAL_SETTLE_MS,
} from "./fan-constants";
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, getSafeStyles, normalizeConfig } from "./fan-config";
import {
  applyStubEntity,
  getCircularLayoutDialModel,
  getCircularLayoutDialValueFromPoint,
  getRangeValueFromGeometry,
  getSliderDragGeometry,
  isUnavailableState,
  parseSizeToPixels,
  translatePresetLabel,
} from "./fan-helpers";
`;

fs.writeFileSync(path.join(outDir, "fan-card.ts"), `${cardImports}\n${cardClass.trim()}\n`);

const editorImports = `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./fan-config";
import {
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
  translatePresetLabel,
} from "./fan-helpers";
`;

fs.writeFileSync(path.join(outDir, "fan-editor.ts"), `${editorImports}\n${editorClass.trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "fan-types.ts"),
  `export interface FanPublicApi {
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
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./fan-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./fan-config";
import { NodaliaFanCard } from "./fan-card";
import { NodaliaFanCardEditor } from "./fan-editor";
import type { FanPublicApi } from "./fan-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaFanCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaFanCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Fan Card",
  description: "Tarjeta de ventilador con slider de velocidad, oscilacion y modos.",
  preview: true,
});

const publicApi: FanPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_FAN__ = publicApi;
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote fan TypeScript sources to", outDir);
