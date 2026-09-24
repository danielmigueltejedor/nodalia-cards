/**
 * One-shot extractor: splits nodalia-power-flow-card.js into src/cards/power-flow/*.ts
 * without rewriting logic. Re-run only when regenerating the power-flow source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-power-flow-card.js");
const outDir = path.join(root, "src", "cards", "power-flow");

if (fs.existsSync(path.join(outDir, "power-flow-card.ts"))) {
  throw new Error(
    "src/cards/power-flow already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
  path.join(outDir, "power-flow-runtime.ts"),
  `import type { NodaliaUtilsApi } from "../../core/types/nodalia-utils";

const utils: NodaliaUtilsApi = window.NodaliaUtils;

export const isObject = utils.isObject.bind(utils) as NodaliaUtilsApi["isObject"];
export const deepClone = utils.deepClone.bind(utils) as NodaliaUtilsApi["deepClone"];
export const mergeConfig = utils.mergeDeep.bind(utils) as NodaliaUtilsApi["mergeDeep"];
export const isUnsafeConfigPathKey = utils.isUnsafeConfigPathKey.bind(utils) as NodaliaUtilsApi["isUnsafeConfigPathKey"];
export const setByPath = utils.setByPath.bind(utils) as NodaliaUtilsApi["setByPath"];
export const deleteByPath = utils.deleteByPath.bind(utils) as NodaliaUtilsApi["deleteByPath"];
export const getByPath = utils.getByPath.bind(utils) as NodaliaUtilsApi["getByPath"];
export const clamp = utils.clamp.bind(utils) as NodaliaUtilsApi["clamp"];
export const escapeHtml = utils.escapeHtml.bind(utils) as NodaliaUtilsApi["escapeHtml"];
export const escapeSelectorValue = utils.escapeSelectorValue.bind(utils) as NodaliaUtilsApi["escapeSelectorValue"];
export const fireEvent = utils.fireEvent.bind(utils) as NodaliaUtilsApi["fireEvent"];
export const normalizeTextKey = utils.normalizeTextKey.bind(utils) as NodaliaUtilsApi["normalizeTextKey"];
`,
);

fs.writeFileSync(path.join(outDir, "power-flow-constants.ts"), `${exportConsts(slice(1, 60)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "power-flow-helpers.ts"),
  `// @ts-nocheck -- SVG layout and editor color helpers stay loosely typed until remaining unknowns are narrowed.
import { clamp, isObject, isUnsafeConfigPathKey } from "./power-flow-runtime";

${exportFunctions(`${slice(162, 164)}\n\n${slice(184, 698)}\n\n${slice(718, 910)}`).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "power-flow-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime power-flow config.
import { NODE_DEFAULTS } from "./power-flow-constants";
import { deepClone, isObject, mergeConfig } from "./power-flow-runtime";
import { deepCloneNode, sanitizeIndividualEntries } from "./power-flow-helpers";

${slice(62, 160).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(slice(700, 716)).trim()}
`,
);

const cardClass = slice(912, 4311).replace(/^class NodaliaPowerFlowCard/, "export class NodaliaPowerFlowCard");
const legacyEditorClass = slice(4317, 5065).replace(
  /^class NodaliaPowerFlowCardEditor/,
  "export class NodaliaPowerFlowCardEditor",
);
const editorClass = slice(5067, 6382).replace(
  /^class NodaliaPowerFlowCardVisualEditor/,
  "export class NodaliaPowerFlowCardVisualEditor",
);

fs.writeFileSync(
  path.join(outDir, "power-flow-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  NODE_DEFAULTS,
} from "./power-flow-constants";
import {
  clamp,
  deepClone,
  escapeHtml,
  fireEvent,
  isObject,
} from "./power-flow-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./power-flow-config";
import {
  arrayFromMaybe,
  buildFlowPath,
  buildStraightFlowPath,
  formatDisplayValue,
  formatRawValue,
  formatSvgMotionNumber,
  getDiagramIndividualCount,
  getFlowLayoutFlagsFromConfig,
  getHassLocaleTag,
  getLayoutPreset,
  getNodePosition,
  getNodePositionForLayout,
  getStubEntityId,
  getSvgPathMotionStart,
  getSvgRelativeMotionPath,
  isEntitySourceConfigured,
  isHomeDevicePopupEnabled,
  isUnavailableState,
  offsetPoint,
  parseNumber,
  parseSizeToPixels,
  resolveIndividualConfigs,
  resolveNodeConfig,
  rgbArrayToColor,
} from "./power-flow-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "power-flow-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import { HAPTIC_PATTERNS } from "./power-flow-constants";
import {
  deleteByPath,
  escapeHtml,
  fireEvent,
  getByPath,
  isObject,
  setByPath,
} from "./power-flow-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./power-flow-config";
import {
  compactConfig,
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
  getStubEntityId,
  moveItem,
  resolveIndividualConfigs,
  sanitizeIndividualEntries,
} from "./power-flow-helpers";

${legacyEditorClass.trim()}

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "power-flow-types.ts"),
  `export interface PowerFlowPublicApi {
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
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./power-flow-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./power-flow-config";
import { NodaliaPowerFlowCard } from "./power-flow-card";
import { NodaliaPowerFlowCardVisualEditor } from "./power-flow-editor";
import type { PowerFlowPublicApi } from "./power-flow-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaPowerFlowCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaPowerFlowCardVisualEditor);
}

try {
  window.NodaliaUtils?.registerCustomCard?.({
    type: CARD_TAG,
    name: "Nodalia Power Flow Card",
    description: "Tarjeta Nodalia de flujo energetico para red, solar, bateria, agua, gas y consumos individuales.",
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
} as PowerFlowPublicApi;

window.__NODALIA_POWER_FLOW__ = publicApi;
`,
);

fs.writeFileSync(
  path.join(outDir, "standalone.ts"),
  `import { EDITOR_TAG } from "./power-flow-constants";
import { NodaliaPowerFlowCardEditor } from "./power-flow-editor";
import "./index";

// Keep the historical unused editor class in the standalone artifact.
const _legacyEditorKept =
  customElements.get(\`\${EDITOR_TAG}-legacy\`) === NodaliaPowerFlowCardEditor;
`,
);

console.log("Wrote power-flow TypeScript sources to", outDir);
