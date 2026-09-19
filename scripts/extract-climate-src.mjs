/**
 * One-shot extractor: splits nodalia-climate-card.js into src/cards/climate/*.ts
 * without rewriting logic. Re-run only when regenerating the climate source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-climate-card.js");
const outDir = path.join(root, "src", "cards", "climate");

if (fs.existsSync(path.join(outDir, "climate-card.ts"))) {
  throw new Error(
    "src/cards/climate already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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

const utils = window.NodaliaUtils as NodaliaUtilsApi;

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

const constants = `${exportConsts(slice(1, 40))}

export const ENGINE_OVERRIDE_HOLD_HOURS = 2;
export const ENGINE_OVERRIDE_REFRESH_MS = 30_000;

${exportConsts(slice(583, 590))}
`;

const modelBody = exportFunctions(`
${slice(180, 185)}

${slice(186, 193)}

${slice(194, 354)}

${slice(392, 425)}

${slice(430, 554)}
`);

const dialBody = exportFunctions(`
${slice(357, 390)}

${slice(563, 581)}

${slice(1268, 1310)}
`);

const scheduleBody = exportFunctions(slice(592, 1214));

const configMigrate = exportFunctions(slice(1215, 1266));
const stubHelpers = exportFunctions(slice(158, 178));
const defaultConfig = slice(42, 139).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/, "export const STUB_CONFIG");

const cardClass = slice(1312, 7685)
  .replace(/^class NodaliaClimateCard/, "export class NodaliaClimateCard");

const editorRest = slice(7691, 9671)
  .replace(/^async function /gm, "export async function ")
  .replace(/^function /gm, "export function ")
  .replace(/^class /gm, "export class ");

const sharedImports = `import {
  CARD_TAG,
  CARD_VERSION,
  DIAL_CIRCLE_RADIUS,
  DIAL_CIRCUMFERENCE,
  DIAL_END_ANGLE,
  DIAL_HIDDEN_LENGTH,
  DIAL_START_ANGLE,
  DIAL_SWEEP,
  DIAL_VIEWBOX_SIZE,
  DIAL_VISIBLE_LENGTH,
  DRAFT_CONFIRMATION_RETRY_LIMIT,
  DRAFT_CONFIRMATION_TIMEOUT,
  EDITOR_TAG,
  ENGINE_OVERRIDE_HOLD_HOURS,
  ENGINE_OVERRIDE_REFRESH_MS,
  HAPTIC_PATTERNS,
  LEGACY_CLIMATE_DIAL_BACKGROUND,
  LEGACY_CLIMATE_DIAL_OFF_COLOR,
  LEGACY_CLIMATE_DIAL_TRACK_COLOR,
  LEGACY_CLIMATE_ICON_OFF_COLORS,
  RANGE_THUMB_DRAG_THRESHOLD_PX,
  SCHEDULE_BLOCK_DRAG_THRESHOLD_PX,
  SCHEDULE_MIN_BLOCK_MINUTES,
  SCHEDULE_TIMELINE_SNAP_MINUTES,
  SETPOINT_SCHEDULE_DAY_ORDER,
  SETPOINT_SCHEDULE_DAY_TO_JS,
  SETPOINT_SCHEDULE_MINUTES_PER_DAY,
  STEP_BUTTON_COMMIT_DEBOUNCE,
} from "./climate-constants";
import {
  clamp,
  compactConfig,
  deepClone,
  deleteByPath,
  escapeHtml,
  fireEvent,
  isObject,
  isUnsafeConfigPathKey,
  mergeConfig,
  normalizeTextKey,
  setByPath,
} from "./climate-runtime";
`;

fs.writeFileSync(path.join(outDir, "climate-runtime.ts"), `${runtimeHeader}\n`);
fs.writeFileSync(path.join(outDir, "climate-constants.ts"), `${constants.trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "climate-model.ts"),
  `import { clamp, normalizeTextKey } from "./climate-runtime";
import type { HomeAssistant } from "../../core/types/home-assistant";

${modelBody.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "climate-dial.ts"),
  `import {
  DIAL_CIRCLE_RADIUS,
  DIAL_END_ANGLE,
  DIAL_START_ANGLE,
  DIAL_SWEEP,
  DIAL_VIEWBOX_SIZE,
} from "./climate-constants";
import { clamp } from "./climate-runtime";

${dialBody.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "climate-schedule.ts"),
  `import {
  SCHEDULE_MIN_BLOCK_MINUTES,
  SCHEDULE_TIMELINE_SNAP_MINUTES,
  SETPOINT_SCHEDULE_DAY_ORDER,
  SETPOINT_SCHEDULE_DAY_TO_JS,
  SETPOINT_SCHEDULE_MINUTES_PER_DAY,
} from "./climate-constants";
import { clamp, isObject } from "./climate-runtime";

${scheduleBody.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "climate-config.ts"),
  `import {
  LEGACY_CLIMATE_DIAL_BACKGROUND,
  LEGACY_CLIMATE_DIAL_OFF_COLOR,
  LEGACY_CLIMATE_DIAL_TRACK_COLOR,
  LEGACY_CLIMATE_ICON_OFF_COLORS,
} from "./climate-constants";
import { deepClone, isObject, mergeConfig, normalizeTextKey } from "./climate-runtime";
import { normalizeSetpointScheduleWeekStartsOn } from "./climate-schedule";
import type { ClimateConfig } from "./climate-types";

${defaultConfig}

${stubHelpers.trim()}

${configMigrate.trim()}
`,
);

const cardImports = `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
${sharedImports}
import { DEFAULT_CONFIG, STUB_CONFIG, applyStubEntity, normalizeConfig } from "./climate-config";
import {
  climateDialActionMeta,
  formatEditorColorFromHex,
  formatEngineOverrideTime,
  formatTemperature,
  formatTemperatureRangeSummary,
  getActionMeta,
  getClimateTemperatureScaleLetter,
  getClimateTemperatureUnit,
  getHassLocale,
  getModeMeta,
  getRelativeLuminance,
  getStepPrecision,
  isUnavailableState,
  parseEngineOverrideUntil,
  parseFiniteClimateNumber,
  parseRgbColor,
  parseSizeToPixels,
  resolveColorInContext,
  resolveEditorColorValue,
} from "./climate-model";
import {
  buildClimateDialModeButtonRows,
  getClimateDialCenterInsetCss,
  getDialMarkerPosition,
  getDialValueFromPoint,
} from "./climate-dial";
import {
  buildClimateSetpointScheduleAutomationId,
  buildClimateSetpointScheduleAutomationSpecs,
  buildClimateSetpointScheduleAutomationsYaml,
  buildClimateSetpointScheduleWebhookBody,
  decodeSetpointScheduleStorageState,
  encodeSetpointScheduleStorageState,
  findScheduleGapForDay,
  formatScheduleClockMinutes,
  getActiveSetpointScheduleSlot,
  getClimateScheduleStorageEntityId,
  getSetpointScheduleBlockLayout,
  getSetpointScheduleDayOrder,
  isSetpointScheduleStorageStateWithinLimit,
  normalizeSetpointScheduleConfig,
  normalizeSetpointScheduleSlot,
  parseScheduleClockMinutes,
  scheduleMinutesFromTrackClientX,
  snapScheduleTimelineMinutes,
  createSetpointScheduleSlotId,
} from "./climate-schedule";
`;

fs.writeFileSync(path.join(outDir, "climate-card.ts"), `${cardImports}\n${cardClass.trim()}\n`);

const editorImports = `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
${sharedImports}
import { DEFAULT_CONFIG, normalizeConfig } from "./climate-config";
import {
  formatEditorColorFromHex,
  formatEditorHexChannel,
  getEditorColorFallbackValue,
  getEditorColorModel,
  parseSizeToPixels,
} from "./climate-model";
import { compactConfig } from "./climate-runtime";
`;

fs.writeFileSync(path.join(outDir, "climate-editor.ts"), `${editorImports}\n${editorRest.trim()}\n`);

console.log("Wrote climate TypeScript sources to", outDir);
