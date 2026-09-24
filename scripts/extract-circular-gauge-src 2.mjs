/**
 * One-shot extractor: splits nodalia-circular-gauge-card.js into src/cards/circular-gauge/*.ts
 * without rewriting logic. Re-run only when regenerating the circular-gauge source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-circular-gauge-card.js");
const outDir = path.join(root, "src", "cards", "circular-gauge");

if (fs.existsSync(path.join(outDir, "circular-gauge-card.ts"))) {
  throw new Error(
    "src/cards/circular-gauge already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
export const fireEvent = utils.fireEvent.bind(utils) as NodaliaUtilsApi["fireEvent"];
export const normalizeTextKey = utils.normalizeTextKey.bind(utils) as NodaliaUtilsApi["normalizeTextKey"];
`;

const runtimeImports = `import {
  clamp,
  compactConfig,
  deepClone,
  deleteByPath,
  escapeHtml,
  fireEvent,
  isObject,
  mergeConfig,
  normalizeTextKey,
  setByPath,
} from "./circular-gauge-runtime";`;

fs.writeFileSync(path.join(outDir, "circular-gauge-runtime.ts"), `${runtimeHeader}\n`);
fs.writeFileSync(path.join(outDir, "circular-gauge-constants.ts"), `${exportConsts(slice(1, 30)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "circular-gauge-helpers.ts"),
  `// @ts-nocheck -- color, dial and stub helpers stay loosely typed until remaining unknowns are narrowed.
import {
  DEFAULT_GAUGE_MAX_TINT_COLOR,
  DEFAULT_GAUGE_MIN_TINT_COLOR,
  DIAL_CIRCLE_RADIUS,
  DIAL_SWEEP,
  DIAL_VIEWBOX_SIZE,
  GAUGE_SVG_FALLBACK_TINT_SCALE,
} from "./circular-gauge-constants";
import { clamp, normalizeTextKey } from "./circular-gauge-runtime";
import { DEFAULT_CONFIG } from "./circular-gauge-config";

${exportFunctions(`${slice(122, 449)}\n\n${slice(455, 609)}`).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "circular-gauge-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime circular-gauge config.
import { DEFAULT_GAUGE_MAX_TINT_COLOR, DEFAULT_GAUGE_MIN_TINT_COLOR } from "./circular-gauge-constants";
import { mergeConfig } from "./circular-gauge-runtime";

${slice(32, 103).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(slice(451, 453)).trim()}
`,
);

const cardClass = slice(611, 1979).replace(/^class NodaliaCircularGaugeCard/, "export class NodaliaCircularGaugeCard");
const editorClass = slice(1985, 3071).replace(
  /^class NodaliaCircularGaugeCardEditor/,
  "export class NodaliaCircularGaugeCardEditor",
);

fs.writeFileSync(
  path.join(outDir, "circular-gauge-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  DIAL_CIRCLE_RADIUS,
  DIAL_CIRCUMFERENCE,
  DIAL_HIDDEN_LENGTH,
  DIAL_START_ANGLE,
  DIAL_SWEEP,
  DIAL_VIEWBOX_SIZE,
  DIAL_VISIBLE_LENGTH,
  EDITOR_TAG,
  GAUGE_TINT_SEGMENT_COUNT,
  HAPTIC_PATTERNS,
} from "./circular-gauge-constants";
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./circular-gauge-config";
import {
  applyStubEntity,
  buildGaugeTintScale,
  formatNumberValue,
  getContinuousThumbRotate,
  getDialMarkerCoordinates,
  getDialThumbRotate,
  getHassLocaleTag,
  getSafeStyles,
  inferDecimals,
  inferReasonableMax,
  isUnavailableState,
  parseSizeToPixels,
  resolveGaugeSvgStrokeColor,
  resolveGaugeTintColor,
  sanitizeCssValue,
} from "./circular-gauge-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "circular-gauge-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import { DEFAULT_GAUGE_MAX_TINT_COLOR, DEFAULT_GAUGE_MIN_TINT_COLOR } from "./circular-gauge-constants";
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./circular-gauge-config";
import {
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
} from "./circular-gauge-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "circular-gauge-types.ts"),
  `export interface CircularGaugePublicApi {
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
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./circular-gauge-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./circular-gauge-config";
import { NodaliaCircularGaugeCard } from "./circular-gauge-card";
import { NodaliaCircularGaugeCardEditor } from "./circular-gauge-editor";
import type { CircularGaugePublicApi } from "./circular-gauge-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCircularGaugeCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCircularGaugeCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Circular Gauge Card",
  description: "Tarjeta circular para sensores y valores numericos con estetica Nodalia.",
  preview: true,
});

const publicApi: CircularGaugePublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_CIRCULAR_GAUGE__ = publicApi;
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote circular-gauge TypeScript sources to", outDir);
