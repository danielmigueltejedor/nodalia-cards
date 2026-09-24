/**
 * One-shot extractor: splits nodalia-scenes-card.js into src/cards/scenes/*.ts
 * without rewriting logic. Re-run only when regenerating the scenes source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-scenes-card.js");
const outDir = path.join(root, "src", "cards", "scenes");

if (fs.existsSync(path.join(outDir, "scenes-card.ts"))) {
  throw new Error(
    "src/cards/scenes already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
export const getByPath = utils.getByPath.bind(utils) as NodaliaUtilsApi["getByPath"];
export const isUnsafeConfigPathKey = utils.isUnsafeConfigPathKey.bind(utils) as NodaliaUtilsApi["isUnsafeConfigPathKey"];
export const setByPath = utils.setByPath.bind(utils) as NodaliaUtilsApi["setByPath"];
export const deleteByPath = utils.deleteByPath.bind(utils) as NodaliaUtilsApi["deleteByPath"];
export const clamp = utils.clamp.bind(utils) as NodaliaUtilsApi["clamp"];
export const normalizeTextKey = utils.normalizeTextKey.bind(utils) as NodaliaUtilsApi["normalizeTextKey"];
export const escapeHtml = utils.escapeHtml.bind(utils) as NodaliaUtilsApi["escapeHtml"];
export const escapeSelectorValue = utils.escapeSelectorValue.bind(utils) as NodaliaUtilsApi["escapeSelectorValue"];
export const fireEvent = utils.fireEvent.bind(utils) as NodaliaUtilsApi["fireEvent"];
`;

fs.writeFileSync(path.join(outDir, "scenes-runtime.ts"), `${runtimeHeader}\n`);
fs.writeFileSync(path.join(outDir, "scenes-constants.ts"), `${exportConsts(slice(1, 17)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "scenes-helpers.ts"),
  `// @ts-nocheck -- scene, scroll and color helpers stay loosely typed until remaining unknowns are narrowed.
import { DEFAULT_SCENE_ACCENT } from "./scenes-constants";
import { clamp, deepClone, isObject, isUnsafeConfigPathKey, normalizeTextKey } from "./scenes-runtime";
import { DEFAULT_CONFIG } from "./scenes-config";

${exportFunctions(`${slice(95, 442)}\n\n${slice(457, 514)}`).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "scenes-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime scenes config.
import { DEFAULT_SCENE_ACCENT, HOLD_ACTIONS, SCENE_LAUNCH_DURATION, TAP_ACTIONS } from "./scenes-constants";
import { clamp, normalizeTextKey } from "./scenes-runtime";
import { mergeConfig, normalizeSceneRows } from "./scenes-helpers";

${slice(19, 76).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(slice(444, 455)).trim()}
`,
);

const cardClass = slice(516, 1554).replace(/^class NodaliaScenesCard/, "export class NodaliaScenesCard");
const editorClass = slice(1556, 2395).replace(/^class NodaliaScenesCardEditor/, "export class NodaliaScenesCardEditor");

fs.writeFileSync(
  path.join(outDir, "scenes-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import { CARD_TAG, CARD_VERSION, EDITOR_TAG, HAPTIC_PATTERNS, SCENE_LAUNCH_DURATION } from "./scenes-constants";
import {
  clamp,
  deepClone,
  escapeHtml,
  fireEvent,
  normalizeTextKey,
} from "./scenes-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./scenes-config";
import {
  applyStubConfig,
  cancelDashboardScrollRestore,
  collectDashboardScrollSnapshot,
  getSafeStyles,
  parseSizeToPixels,
  resolveSceneEntries,
  scheduleDashboardScrollRestore,
} from "./scenes-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "scenes-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import {
  deleteByPath,
  escapeHtml,
  fireEvent,
  getByPath,
  setByPath,
} from "./scenes-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./scenes-config";
import {
  compactConfig,
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
  moveItem,
} from "./scenes-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "scenes-types.ts"),
  `export interface ScenesPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: (rawConfig?: unknown, options?: Record<string, unknown>) => Record<string, unknown>;
}
`,
);

fs.writeFileSync(
  path.join(outDir, "index.ts"),
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./scenes-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./scenes-config";
import { NodaliaScenesCard } from "./scenes-card";
import { NodaliaScenesCardEditor } from "./scenes-editor";
import type { ScenesPublicApi } from "./scenes-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaScenesCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaScenesCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Scenes Card",
  description: "Cinematic Home Assistant scene moods with per-scene tints and launch feedback",
  preview: true,
  documentationURL: "https://github.com/danielmigueltejedor/nodalia-cards",
});

const publicApi: ScenesPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_SCENES__ = publicApi;
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote scenes TypeScript sources to", outDir);
