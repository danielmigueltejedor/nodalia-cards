/**
 * One-shot extractor: splits nodalia-light-card.js into src/cards/light/*.ts
 * without rewriting logic. Re-run only when regenerating the light source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-light-card.js");
const outDir = path.join(root, "src", "cards", "light");

if (fs.existsSync(path.join(outDir, "light-card.ts"))) {
  throw new Error(
    "src/cards/light already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
`;

const constants = `${exportConsts(slice(1, 25))}

${exportConsts(slice(391, 394))}
`;

const defaultConfig = slice(27, 138)
  .replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG")
  .replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG");

const helpersBody = exportFunctions(slice(157, 388));
const configMigrate = exportFunctions(slice(396, 557));

const cardClass = slice(559, 4495)
  .replace(/^class NodaliaLightCard/, "export class NodaliaLightCard");

const editorClass = slice(4501, 5802)
  .replace(/^class NodaliaLightCardEditor/, "export class NodaliaLightCardEditor");

const sharedImports = `import {
  CARD_TAG,
  COLOR_PRESETS,
  COMPACT_LAYOUT_THRESHOLD,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  LIGHT_MEMORY_STORAGE_KEY,
  OPTIMISTIC_TURN_OFF_TIMEOUT,
  OPTIMISTIC_TURN_ON_TIMEOUT,
  OPTIMISTIC_VISUAL_SETTLE_MS,
} from "./light-constants";
import {
  clamp,
  compactConfig,
  deepClone,
  deleteByPath,
  escapeHtml,
  escapeSelectorValue,
  fireEvent,
  isObject,
  mergeConfig,
  setByPath,
} from "./light-runtime";
`;

fs.writeFileSync(path.join(outDir, "light-runtime.ts"), `${runtimeHeader}\n`);
fs.writeFileSync(path.join(outDir, "light-constants.ts"), `${constants.trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "light-helpers.ts"),
  `// @ts-nocheck -- color/slider helpers stay loosely typed until remaining unknowns are narrowed.
import { clamp } from "./light-runtime";

${helpersBody.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "light-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime light config.
import { LEGACY_ICON_OFF_COLOR_VALUES } from "./light-constants";
import { clamp, deepClone, isObject, mergeConfig } from "./light-runtime";
import { normalizeHexColorForLightPreset } from "./light-helpers";

${defaultConfig}

${configMigrate.trim()}
`,
);

const cardImports = `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
${sharedImports}
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./light-config";
import {
  applyStubEntity,
  getRangeValueFromGeometry,
  getSliderDragGeometry,
  getTemperatureSliderTrackGradient,
  hexToRgb,
  isUnavailableState,
  kelvinToMired,
  miredToKelvin,
  normalizeHexColorForLightPreset,
  parseSizeToPixels,
  rgbToHs,
} from "./light-helpers";
`;

fs.writeFileSync(path.join(outDir, "light-card.ts"), `${cardImports}\n${cardClass.trim()}\n`);

const editorImports = `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import {
  clamp,
  compactConfig,
  deepClone,
  deleteByPath,
  escapeHtml,
  fireEvent,
  setByPath,
} from "./light-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./light-config";
import {
  arrayFromCsv,
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
} from "./light-helpers";
`;

fs.writeFileSync(path.join(outDir, "light-editor.ts"), `${editorImports}\n${editorClass.trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "light-types.ts"),
  `export interface LightPublicApi {
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
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./light-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./light-config";
import { NodaliaLightCard } from "./light-card";
import { NodaliaLightCardEditor } from "./light-editor";
import type { LightPublicApi } from "./light-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaLightCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaLightCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Light Card",
  description: "Tarjeta de luz con estilo Nodalia, presets y editor visual.",
  preview: true,
});

const publicApi: LightPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_LIGHT__ = publicApi;
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote light TypeScript sources to", outDir);
