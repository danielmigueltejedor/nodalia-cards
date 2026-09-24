/**
 * One-shot extractor: splits nodalia-alarm-panel-card.js into src/cards/alarm-panel/*.ts
 * without rewriting logic. Re-run only when regenerating the alarm panel source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-alarm-panel-card.js");
const outDir = path.join(root, "src", "cards", "alarm-panel");

if (fs.existsSync(path.join(outDir, "alarm-panel-card.ts"))) {
  throw new Error(
    "src/cards/alarm-panel already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
} from "./alarm-panel-runtime";`;

fs.writeFileSync(path.join(outDir, "alarm-panel-runtime.ts"), `${runtimeHeader}\n`);
fs.writeFileSync(path.join(outDir, "alarm-panel-constants.ts"), `${exportConsts(slice(1, 33)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "alarm-panel-helpers.ts"),
  `// @ts-nocheck -- color and stub helpers stay loosely typed until remaining unknowns are narrowed.
import { clamp, normalizeTextKey } from "./alarm-panel-runtime";

${exportFunctions(slice(118, 226)).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "alarm-panel-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime alarm panel config.
import { clamp, deepClone, mergeConfig, normalizeTextKey } from "./alarm-panel-runtime";

${slice(35, 97).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(slice(228, 249)).trim()}
`,
);

const cardClass = slice(251, 1724).replace(/^class NodaliaAlarmPanelCard/, "export class NodaliaAlarmPanelCard");
const editorClass = slice(1730, 2824).replace(/^class NodaliaAlarmPanelCardEditor/, "export class NodaliaAlarmPanelCardEditor");

fs.writeFileSync(
  path.join(outDir, "alarm-panel-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  ALARM_STATE_TINT_FALLBACKS,
  CARD_TAG,
  EDITOR_TAG,
  FEATURE_ARM_AWAY,
  FEATURE_ARM_CUSTOM_BYPASS,
  FEATURE_ARM_HOME,
  FEATURE_ARM_NIGHT,
  FEATURE_ARM_VACATION,
  HAPTIC_PATTERNS,
} from "./alarm-panel-constants";
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./alarm-panel-config";
import {
  applyStubEntity,
  isUnavailableState,
  parseSizeToPixels,
} from "./alarm-panel-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "alarm-panel-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import { ALARM_STATE_TINT_FALLBACKS } from "./alarm-panel-constants";
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./alarm-panel-config";
import {
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
} from "./alarm-panel-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "alarm-panel-types.ts"),
  `export interface AlarmPanelPublicApi {
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
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./alarm-panel-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./alarm-panel-config";
import { NodaliaAlarmPanelCard } from "./alarm-panel-card";
import { NodaliaAlarmPanelCardEditor } from "./alarm-panel-editor";
import type { AlarmPanelPublicApi } from "./alarm-panel-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaAlarmPanelCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaAlarmPanelCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Alarm Panel Card",
  description: "Tarjeta elegante para paneles de alarma",
  preview: true,
});

const publicApi: AlarmPanelPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_ALARM_PANEL__ = publicApi;
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote alarm panel TypeScript sources to", outDir);
