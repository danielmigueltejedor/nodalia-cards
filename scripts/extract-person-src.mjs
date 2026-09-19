/**
 * One-shot extractor: splits nodalia-person-card.js into src/cards/person/*.ts
 * without rewriting logic. Re-run only when regenerating the person source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-person-card.js");
const outDir = path.join(root, "src", "cards", "person");

if (fs.existsSync(path.join(outDir, "person-card.ts"))) {
  throw new Error(
    "src/cards/person already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
} from "./person-runtime";`;

fs.writeFileSync(path.join(outDir, "person-runtime.ts"), `${runtimeHeader}\n`);
fs.writeFileSync(path.join(outDir, "person-constants.ts"), `${exportConsts(slice(1, 12)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "person-helpers.ts"),
  `// @ts-nocheck -- color and stub helpers stay loosely typed until remaining unknowns are narrowed.
import { clamp, normalizeTextKey } from "./person-runtime";

${exportFunctions(slice(110, 210)).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "person-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime person config.
import { deepClone, isObject, mergeConfig } from "./person-runtime";

${slice(14, 89).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(slice(212, 272)).trim()}
`,
);

const cardClass = slice(274, 1509).replace(/^class NodaliaPersonCard/, "export class NodaliaPersonCard");
const editorClass = slice(1515, 2618).replace(/^class NodaliaPersonCardEditor/, "export class NodaliaPersonCardEditor");

fs.writeFileSync(
  path.join(outDir, "person-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
} from "./person-constants";
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./person-config";
import {
  applyStubEntity,
  isUnavailableState,
  parseSizeToPixels,
} from "./person-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "person-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./person-config";
import {
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
} from "./person-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "person-types.ts"),
  `export interface PersonPublicApi {
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
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./person-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./person-config";
import { NodaliaPersonCard } from "./person-card";
import { NodaliaPersonCardEditor } from "./person-editor";
import type { PersonPublicApi } from "./person-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaPersonCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaPersonCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Person Card",
  description: "Tarjeta compacta de persona con foto y zona",
  preview: true,
});

const publicApi: PersonPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_PERSON__ = publicApi;
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote person TypeScript sources to", outDir);
