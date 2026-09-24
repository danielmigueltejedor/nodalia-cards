/**
 * One-shot extractor: splits nodalia-advance-vacuum-card.js into src/cards/advance-vacuum/*.ts
 * without rewriting logic. Re-run only when regenerating the advance-vacuum source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-advance-vacuum-card.js");
const outDir = path.join(root, "src", "cards", "advance-vacuum");

if (fs.existsSync(path.join(outDir, "advance-vacuum-card.ts"))) {
  throw new Error(
    "src/cards/advance-vacuum already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
  path.join(outDir, "advance-vacuum-runtime.ts"),
  `import type { NodaliaUtilsApi } from "../../core/types/nodalia-utils";

const utils: NodaliaUtilsApi = window.NodaliaUtils;

export const isObject = utils.isObject.bind(utils) as NodaliaUtilsApi["isObject"];
export const deepClone = utils.deepClone.bind(utils) as NodaliaUtilsApi["deepClone"];
export const mergeConfig = utils.mergeDeep.bind(utils) as NodaliaUtilsApi["mergeDeep"];
export const isUnsafeConfigPathKey = utils.isUnsafeConfigPathKey.bind(utils) as NodaliaUtilsApi["isUnsafeConfigPathKey"];
export const setByPath = utils.setByPath.bind(utils) as NodaliaUtilsApi["setByPath"];
export const deleteByPath = utils.deleteByPath.bind(utils) as NodaliaUtilsApi["deleteByPath"];
export const clamp = utils.clamp.bind(utils) as NodaliaUtilsApi["clamp"];
export const normalizeTextKey = utils.normalizeTextKey.bind(utils) as NodaliaUtilsApi["normalizeTextKey"];
export const escapeHtml = utils.escapeHtml.bind(utils) as NodaliaUtilsApi["escapeHtml"];
export const fireEvent = utils.fireEvent.bind(utils) as NodaliaUtilsApi["fireEvent"];
`,
);

fs.writeFileSync(path.join(outDir, "advance-vacuum-constants.ts"), `${exportConsts(slice(1, 248)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "advance-vacuum-helpers.ts"),
  `// @ts-nocheck -- map geometry, calibration and session helpers stay loosely typed until remaining unknowns are narrowed.
import { VACUUM_MODE_LABELS } from "./advance-vacuum-constants";
import { DEFAULT_CONFIG } from "./advance-vacuum-config";
import {
  deepClone,
  isObject,
  normalizeTextKey,
} from "./advance-vacuum-runtime";

${exportFunctions(slice(385, 1151)).trim()}

${slice(1152, 1219).replace(/^class CoordinatesConverter/, "export class CoordinatesConverter")}

${exportFunctions(slice(1221, 1421)).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "advance-vacuum-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime advance-vacuum config.
import { isObject, mergeConfig } from "./advance-vacuum-runtime";
import { normalizeCustomMenuItems, normalizeRoutineItems } from "./advance-vacuum-helpers";

${slice(250, 369).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(slice(1423, 1445)).trim()}
`,
);

const cardClass = slice(1447, 8973).replace(/^class NodaliaAdvanceVacuumCard/, "export class NodaliaAdvanceVacuumCard");
const editorClass = slice(8979, 9971).replace(/^class NodaliaAdvanceVacuumCardEditor/, "export class NodaliaAdvanceVacuumCardEditor");

fs.writeFileSync(
  path.join(outDir, "advance-vacuum-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  CARD_VERSION,
  CLEANING_SESSION_PENDING_TIMEOUT_MS,
  DOCK_CONTROL_DEFINITIONS,
  DOCK_PANEL_SECTIONS,
  DOCK_SETTING_DEFINITIONS,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  MODE_LABELS,
  MOP_MODE_PATTERNS,
  MOP_ONLY_COMBO_PATTERNS,
  PANEL_MODE_PRESETS,
  SHARED_CLEANING_SESSION_OVERFLOW_SENTINEL,
  SHARED_SMART_MODE_PATTERNS,
  SUCTION_MODE_PATTERNS,
  VACUUM_FEATURE_CLEAN_AREA,
  VACUUM_MOP_COMBO_PATTERNS,
  VACUUM_ONLY_COMBO_PATTERNS,
} from "./advance-vacuum-constants";
import {
  clamp,
  deepClone,
  escapeHtml,
  fireEvent,
  isObject,
  isUnsafeConfigPathKey,
  normalizeTextKey,
} from "./advance-vacuum-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./advance-vacuum-config";
import {
  CoordinatesConverter,
  appendQueryParam,
  applyStubEntity,
  arrayFromMaybe,
  centroid,
  decodeSharedSessionList,
  decodeSharedSessionZones,
  encodeSharedSessionList,
  encodeSharedSessionZones,
  flattenPolygons,
  getSafeStyles,
  humanizeModeLabel,
  humanizeSelectOptionLabel,
  isHelperRelatedToConfiguredVacuum,
  isUnavailableState,
  listVacuumObjectIds,
  parseCalibrationPoints,
  parseInteger,
  parseNumber,
  parseOutlines,
  parsePoint,
  parsePolygon,
  parseSizeToPixels,
  parseZoneRect,
  pickShapeSource,
  pointInPolygon,
  polygonArea,
  polygonBounds,
  rectIntersectionArea,
  resolveGotoPoints,
  resolveHeaderIcons,
  resolveLegacyMode,
  resolvePredefinedZones,
  resolveRoomSegments,
  resolveRoomsFromMapState,
  resolveRoomsFromVacuumState,
  sanitizeCssValue,
  sanitizeStyleTree,
  stripMapCacheBuster,
} from "./advance-vacuum-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "advance-vacuum-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import {
  deleteByPath,
  deepClone,
  escapeHtml,
  fireEvent,
  isObject,
  setByPath,
} from "./advance-vacuum-runtime";
import { DEFAULT_CONFIG, normalizeConfig } from "./advance-vacuum-config";
import {
  compactConfig,
  getByPath,
} from "./advance-vacuum-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "advance-vacuum-types.ts"),
  `export interface AdvanceVacuumPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  STUB_CONFIG: Record<string, unknown>;
  normalizeConfig: (rawConfig?: unknown) => Record<string, unknown>;
}
`,
);

fs.writeFileSync(
  path.join(outDir, "index.ts"),
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./advance-vacuum-constants";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./advance-vacuum-config";
import { NodaliaAdvanceVacuumCard } from "./advance-vacuum-card";
import { NodaliaAdvanceVacuumCardEditor } from "./advance-vacuum-editor";
import type { AdvanceVacuumPublicApi } from "./advance-vacuum-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaAdvanceVacuumCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaAdvanceVacuumCardEditor);
}

try {
  window.NodaliaUtils?.registerCustomCard?.({
    type: CARD_TAG,
    name: "Nodalia Advance Vacuum Card",
    description: "Advanced map card for vacuum robots in Nodalia style with room, zone, and point selection.",
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
  STUB_CONFIG,
  normalizeConfig,
} as AdvanceVacuumPublicApi;

window.__NODALIA_ADVANCE_VACUUM__ = publicApi;
`,
);

fs.writeFileSync(
  path.join(outDir, "standalone.ts"),
  `import "./index";
`,
);

console.log("Wrote advance-vacuum TypeScript sources to", outDir);
