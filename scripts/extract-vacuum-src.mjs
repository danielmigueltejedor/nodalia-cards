/**
 * One-shot extractor: splits nodalia-vacuum-card.js into src/cards/vacuum/*.ts
 * without rewriting logic. Re-run only when regenerating the vacuum source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-vacuum-card.js");
const outDir = path.join(root, "src", "cards", "vacuum");

if (fs.existsSync(path.join(outDir, "vacuum-card.ts"))) {
  throw new Error(
    "src/cards/vacuum already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
} from "./vacuum-runtime";`;

fs.writeFileSync(path.join(outDir, "vacuum-runtime.ts"), `${runtimeHeader}\n`);
fs.writeFileSync(path.join(outDir, "vacuum-constants.ts"), `${exportConsts(slice(1, 70)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "vacuum-helpers.ts"),
  `// @ts-nocheck -- color, helper matching and mode labels stay loosely typed until remaining unknowns are narrowed.
import { MODE_LABELS } from "./vacuum-constants";
import { clamp, normalizeTextKey } from "./vacuum-runtime";

${exportFunctions(`${slice(175, 207)}\n\n${slice(241, 309)}\n\n${slice(321, 386)}`).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "vacuum-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime vacuum config.
import { isObject, mergeConfig, normalizeTextKey } from "./vacuum-runtime";

${slice(72, 156).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(`${slice(211, 239)}\n\n${slice(388, 433)}`)
    .replace(
      ".test(raw) || raw.includes(\"/*\") || raw.includes(\"*/\")) {",
      ".test(raw) || raw.includes(\"/*\") || raw.includes(\"*/\")) { // eslint-disable-line no-control-regex",
    )
    .trim()}
`,
);

const cardClass = slice(435, 3505).replace(/^class NodaliaVacuumCard/, "export class NodaliaVacuumCard");
const editorClass = slice(3511, 4929).replace(/^class NodaliaVacuumCardEditor/, "export class NodaliaVacuumCardEditor");

fs.writeFileSync(
  path.join(outDir, "vacuum-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  COMPACT_LAYOUT_THRESHOLD,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  MOP_MODE_PATTERNS,
  SHARED_SMART_MODE_PATTERNS,
  SUCTION_MODE_PATTERNS,
} from "./vacuum-constants";
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, getSafeStyles, normalizeConfig } from "./vacuum-config";
import {
  applyStubEntity,
  humanizeModeLabel,
  isHelperRelatedToConfiguredVacuum,
  isUnavailableState,
  listVacuumObjectIds,
  parseSizeToPixels,
} from "./vacuum-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "vacuum-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import {
  MOP_MODE_PATTERNS,
  SHARED_SMART_MODE_PATTERNS,
  SUCTION_MODE_PATTERNS,
} from "./vacuum-constants";
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./vacuum-config";
import {
  arrayFromCsv,
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
  humanizeModeLabel,
  isHelperRelatedToConfiguredVacuum,
  listVacuumObjectIds,
} from "./vacuum-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "vacuum-types.ts"),
  `export interface VacuumPublicApi {
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
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./vacuum-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./vacuum-config";
import { NodaliaVacuumCard } from "./vacuum-card";
import { NodaliaVacuumCardEditor } from "./vacuum-editor";
import type { VacuumPublicApi } from "./vacuum-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaVacuumCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaVacuumCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Vacuum Card",
  description: "Vacuum card with the Nodalia look, quick actions, and visual editor.",
  preview: true,
});

const publicApi: VacuumPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_VACUUM__ = publicApi;
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote vacuum TypeScript sources to", outDir);
