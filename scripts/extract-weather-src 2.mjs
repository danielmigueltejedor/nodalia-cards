/**
 * One-shot extractor: splits nodalia-weather-card.js into src/cards/weather/*.ts
 * without rewriting logic. Re-run only when regenerating the weather source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-weather-card.js");
const outDir = path.join(root, "src", "cards", "weather");

if (fs.existsSync(path.join(outDir, "weather-card.ts"))) {
  throw new Error(
    "src/cards/weather already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
  path.join(outDir, "weather-runtime.ts"),
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

fs.writeFileSync(path.join(outDir, "weather-constants.ts"), `${exportConsts(slice(1, 12)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "weather-helpers.ts"),
  `// @ts-nocheck -- forecast, unit and editor color helpers stay loosely typed until remaining unknowns are narrowed.
import { clamp, isObject, normalizeTextKey } from "./weather-runtime";

${exportFunctions(`${slice(98, 632)}\n\n${slice(649, 705)}`).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "weather-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime weather config.
import { deepClone, mergeConfig } from "./weather-runtime";

${slice(14, 78).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(slice(634, 647)).trim()}
`,
);

const cardClass = slice(707, 3366).replace(/^class NodaliaWeatherCard/, "export class NodaliaWeatherCard");
const editorClass = slice(3372, 4409).replace(/^class NodaliaWeatherCardEditor/, "export class NodaliaWeatherCardEditor");

fs.writeFileSync(
  path.join(outDir, "weather-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import { CARD_TAG, EDITOR_TAG, HAPTIC_PATTERNS } from "./weather-constants";
import {
  clamp,
  deepClone,
  escapeHtml,
  fireEvent,
  normalizeTextKey,
} from "./weather-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./weather-config";
import {
  applyStubEntity,
  formatCompactTemperature,
  formatForecastDateTime,
  formatMeteoalarmDate,
  formatNumber,
  getConditionAccent,
  getConditionIcon,
  getConditionIconMotionClass,
  getConditionReadableIconColor,
  getForecastChartPointColor,
  getForecastIconColor,
  getForecastPrecipitationLabel,
  getForecastTemperatureSeriesValue,
  getForecastTemperatureValue,
  getMeteoalarmAccentColor,
  getMeteoalarmAwarenessParts,
  getMetricReadableIconColor,
  getSupportedForecastTypes,
  isUnavailableState,
  normalizeForecastChartColorMode,
  normalizeForecastType,
  normalizeForecastView,
  normalizeTemperatureUnitFromState,
  normalizeTemperatureUnitPreference,
  normalizeUnitSystem,
  normalizeWindUnitFromState,
  normalizeWindUnitPreference,
  translateCondition,
  translateMeteoalarmValue,
} from "./weather-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "weather-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import {
  deepClone,
  deleteByPath,
  escapeHtml,
  fireEvent,
  getByPath,
  setByPath,
} from "./weather-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./weather-config";
import {
  compactConfig,
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
  normalizeTemperatureUnitPreference,
  normalizeWindUnitPreference,
} from "./weather-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "weather-types.ts"),
  `export interface WeatherPublicApi {
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
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./weather-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./weather-config";
import { NodaliaWeatherCard } from "./weather-card";
import { NodaliaWeatherCardEditor } from "./weather-editor";
import type { WeatherPublicApi } from "./weather-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaWeatherCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaWeatherCardEditor);
}

window.NodaliaUtils?.registerCustomCard?.({
  type: CARD_TAG,
  name: "Nodalia Weather Card",
  description: "Tarjeta de tiempo elegante para Home Assistant",
  preview: true,
});

const publicApi: WeatherPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_WEATHER__ = publicApi;
if (typeof globalThis !== "undefined") {
  globalThis.__NODALIA_WEATHER__ = publicApi;
}
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote weather TypeScript sources to", outDir);
