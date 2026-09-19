/**
 * One-shot extractor: splits nodalia-entity-card.js into src/cards/entity/*.ts
 * without rewriting logic. Re-run only when regenerating the entity source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-entity-card.js");
const outDir = path.join(root, "src", "cards", "entity");

if (fs.existsSync(path.join(outDir, "entity-card.ts"))) {
  throw new Error(
    "src/cards/entity already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
export const sanitizeCssValue = utils.sanitizeCssValue.bind(utils) as NodaliaUtilsApi["sanitizeCssValue"];
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
  sanitizeCssValue,
  setByPath,
} from "./entity-runtime";`;

fs.writeFileSync(path.join(outDir, "entity-runtime.ts"), `${runtimeHeader}\n`);
fs.writeFileSync(
  path.join(outDir, "entity-constants.ts"),
  `${exportConsts(slice(1, 16)).trim()}

${exportConsts(slice(188, 191)).trim()}

${exportConsts(slice(210, 322)).trim()}

${exportConsts(slice(446, 449)).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "entity-helpers.ts"),
  `// @ts-nocheck -- air-quality, icon and editor helpers stay loosely typed until remaining unknowns are narrowed.
import {
  AIR_QUALITY_ATTR_ALIASES,
  AIR_QUALITY_LEVEL_RANK,
  AIR_QUALITY_WHO_BANDS,
} from "./entity-constants";
import { clamp, isObject, normalizeTextKey } from "./entity-runtime";

${exportFunctions(`${slice(324, 392)}\n\n${slice(482, 643)}\n\n${slice(645, 1012)}`).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "entity-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime entity config.
import {
  AIR_QUALITY_GRAPH_SERIES_COLORS,
  AIR_QUALITY_METRIC_KEYS,
  LEGACY_ICON_OFF_COLOR_VALUES,
  NETWORK_ROLES,
  OVERVIEW_LAYOUTS,
} from "./entity-constants";
import { clamp, deepClone, isObject, mergeConfig, sanitizeCssValue } from "./entity-runtime";

${slice(18, 186).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(`${slice(193, 208)}\n\n${slice(412, 480)}\n\n${slice(1014, 1170)}`).trim()}
`,
);

const cardClass = slice(1172, 5362).replace(/^class NodaliaEntityCard/, "export class NodaliaEntityCard");
const editorClass = slice(5388, 7029).replace(/^class NodaliaEntityCardEditor/, "export class NodaliaEntityCardEditor");

fs.writeFileSync(
  path.join(outDir, "entity-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  AIR_QUALITY_COMFORT_KEYS,
  AIR_QUALITY_GRAPH_SERIES_COLORS,
  AIR_QUALITY_HISTORY_REFRESH_MS,
  AIR_QUALITY_LEVEL_COLORS,
  AIR_QUALITY_METRIC_KEYS,
  AIR_QUALITY_POLLUTION_KEYS,
  AIR_QUALITY_WHO_BANDS,
  CARD_TAG,
  COVER_SET_POSITION,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  LOCK_LOCK,
  OPTIMISTIC_TOGGLE_TIMEOUT,
  OVERVIEW_LAYOUTS,
} from "./entity-constants";
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, entityScalar, normalizeAirQualityBlock, normalizeConfig } from "./entity-config";
import {
  applyStubEntity,
  buildAirQualityAreaPath,
  buildAirQualityChartGeometry,
  buildAirQualityInterpolatedSamples,
  buildAirQualitySmoothPath,
  coverEntityIsOpen,
  entitySupportedFeatures,
  entitySupportsFeature,
  formatNumericValue,
  formatNumericValueWithUnit,
  getAirQualityHoverPayload,
  getDynamicEntityIcon,
  getEntityDomain,
  getHomeAssistantStateDisplayValue,
  getSelectEntityCurrentValue,
  getSelectEntityOptions,
  getValueSignature,
  humanizeSelectOptionLabel,
  isSelectDomainEntity,
  isUnavailableState,
  parseAirQualityHistoryTimestamp,
  parseAirQualityNumeric,
  parseNumericValue,
  parseSizeToPixels,
  readAirQualityAttribute,
  resolveAirQualityLevelFromAqi,
  resolveAirQualityLevelFromBands,
  resolveEntityBubbleIconGlyphColor,
  resolveMetricGuidelineBands,
  shouldDarkenEntityBubbleIconGlyph,
  worseAirQualityLevel,
} from "./entity-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "entity-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import {
  AIR_QUALITY_GRAPH_SERIES_COLORS,
  AIR_QUALITY_METRIC_KEYS,
  OVERVIEW_LAYOUTS,
} from "./entity-constants";
${runtimeImports}
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./entity-config";
import {
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
} from "./entity-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "entity-types.ts"),
  `export interface EntityPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: (rawConfig?: unknown) => Record<string, unknown>;
}

export interface EntityAirQualityPublicApi {
  AIR_QUALITY_METRIC_KEYS: readonly string[];
  AIR_QUALITY_GRAPH_SERIES_COLORS: Readonly<Record<string, string>>;
  AIR_QUALITY_WHO_BANDS: Record<string, unknown>;
  AIR_QUALITY_COMFORT_KEYS: Set<string>;
  normalizeAirQualityBlock: (raw?: unknown) => Record<string, unknown>;
  resolveAirQualityLevelFromBands: (value: unknown, bands: unknown) => unknown;
  resolveAirQualityLevelFromAqi: (value: unknown) => unknown;
  resolveMetricGuidelineBands: (kind: unknown, unit?: unknown) => unknown;
  worseAirQualityLevel: (left: unknown, right: unknown) => unknown;
  parseAirQualityNumeric: (value: unknown) => number | null;
  buildAirQualitySmoothPath: (points: unknown) => string;
  buildAirQualityAreaPath: (points: unknown, bottomY: unknown) => string;
  buildAirQualityChartGeometry: (seriesEntries?: unknown) => unknown;
  getAirQualityHoverPayload: (geometry: unknown, hoverState: unknown) => unknown;
  buildAirQualityInterpolatedSamples: (
    events: unknown,
    startMs: unknown,
    endMs: unknown,
    pointsCount: unknown,
    fallbackValue?: unknown,
  ) => unknown;
}
`,
);

fs.writeFileSync(
  path.join(outDir, "index.ts"),
  `import {
  AIR_QUALITY_COMFORT_KEYS,
  AIR_QUALITY_GRAPH_SERIES_COLORS,
  AIR_QUALITY_METRIC_KEYS,
  AIR_QUALITY_WHO_BANDS,
  CARD_TAG,
  CARD_VERSION,
  EDITOR_TAG,
} from "./entity-constants";
import { DEFAULT_CONFIG, normalizeAirQualityBlock, normalizeConfig } from "./entity-config";
import {
  buildAirQualityAreaPath,
  buildAirQualityChartGeometry,
  buildAirQualityInterpolatedSamples,
  buildAirQualitySmoothPath,
  getAirQualityHoverPayload,
  parseAirQualityNumeric,
  resolveAirQualityLevelFromAqi,
  resolveAirQualityLevelFromBands,
  resolveMetricGuidelineBands,
  worseAirQualityLevel,
} from "./entity-helpers";
import { NodaliaEntityCard } from "./entity-card";
import { NodaliaEntityCardEditor } from "./entity-editor";
import type { EntityAirQualityPublicApi, EntityPublicApi } from "./entity-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaEntityCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaEntityCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Entity Card",
  description: "Flexible entity card for state, details, and quick actions.",
  preview: true,
});

const publicApi: EntityPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_ENTITY__ = publicApi;

window.__NODALIA_ENTITY_AIR_QUALITY__ = {
  AIR_QUALITY_METRIC_KEYS,
  AIR_QUALITY_GRAPH_SERIES_COLORS,
  AIR_QUALITY_WHO_BANDS,
  AIR_QUALITY_COMFORT_KEYS,
  normalizeAirQualityBlock,
  resolveAirQualityLevelFromBands,
  resolveAirQualityLevelFromAqi,
  resolveMetricGuidelineBands,
  worseAirQualityLevel,
  parseAirQualityNumeric,
  buildAirQualitySmoothPath,
  buildAirQualityAreaPath,
  buildAirQualityChartGeometry,
  getAirQualityHoverPayload,
  buildAirQualityInterpolatedSamples,
} as EntityAirQualityPublicApi;
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote entity TypeScript sources to", outDir);
