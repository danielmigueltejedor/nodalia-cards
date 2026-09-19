/**
 * One-shot extractor: splits nodalia-fav-card.js into src/cards/fav/*.ts
 * without rewriting logic. Re-run only when regenerating the fav source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-fav-card.js");
const outDir = path.join(root, "src", "cards", "fav");

if (fs.existsSync(path.join(outDir, "fav-card.ts"))) {
  throw new Error(
    "src/cards/fav already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
} from "./fav-runtime";`;

fs.writeFileSync(path.join(outDir, "fav-runtime.ts"), `${runtimeHeader}\n`);
fs.writeFileSync(path.join(outDir, "fav-constants.ts"), `${exportConsts(slice(1, 21)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "fav-helpers.ts"),
  `// @ts-nocheck -- color, icon and domain helpers stay loosely typed until remaining unknowns are narrowed.
import { clamp, normalizeTextKey } from "./fav-runtime";

${exportFunctions(`${slice(107, 120)}\n\n${slice(135, 480)}`).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "fav-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime fav config.
import { deepClone, isObject, mergeConfig } from "./fav-runtime";

${slice(23, 87).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(slice(485, 517)).trim()}
`,
);

const cardClass = slice(519, 2193).replace(/^class NodaliaFavCard/, "export class NodaliaFavCard");
const editorClass = slice(2199, 3300).replace(/^class NodaliaFavCardEditor/, "export class NodaliaFavCardEditor");

fs.writeFileSync(
  path.join(outDir, "fav-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  COVER_SET_POSITION,
  EDITOR_TAG,
  FEATURE_ARM_AWAY,
  FEATURE_ARM_CUSTOM_BYPASS,
  FEATURE_ARM_HOME,
  FEATURE_ARM_NIGHT,
  FEATURE_ARM_VACATION,
  HAPTIC_PATTERNS,
  INLINE_LAYOUT_THRESHOLD,
  LOCK_LOCK,
  MINI_LAYOUT_THRESHOLD,
} from "./fav-constants";
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./fav-config";
import {
  applyStubEntity,
  coverEntityIsOpen,
  entitySupportedFeatures,
  entitySupportsFeature,
  getDynamicEntityIcon,
  getEntityDomain,
  isUnavailableState,
  miredToKelvin,
  parseNumericValue,
  parseSizeToPixels,
  resolveFavBubbleIconGlyphColor,
  shouldDarkenFavBubbleIconGlyph,
} from "./fav-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "fav-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./fav-config";
import {
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
} from "./fav-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "fav-types.ts"),
  `export interface FavPublicApi {
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
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./fav-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./fav-config";
import { NodaliaFavCard } from "./fav-card";
import { NodaliaFavCardEditor } from "./fav-editor";
import type { FavPublicApi } from "./fav-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaFavCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaFavCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Fav Card",
  description: "Tarjeta mini y elegante para favoritos y controles rapidos en movil.",
  preview: true,
});

const publicApi: FavPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_FAV__ = publicApi;
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote fav TypeScript sources to", outDir);
