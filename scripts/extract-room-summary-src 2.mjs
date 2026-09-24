/**
 * One-shot extractor: splits nodalia-room-summary-card.js into src/cards/room-summary/*.ts
 * without rewriting logic. Re-run only when regenerating the room-summary source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-room-summary-card.js");
const outDir = path.join(root, "src", "cards", "room-summary");

if (fs.existsSync(path.join(outDir, "room-summary-card.ts"))) {
  throw new Error(
    "src/cards/room-summary already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
  path.join(outDir, "room-summary-runtime.ts"),
  `import type { NodaliaUtilsApi } from "../../core/types/nodalia-utils";

const utils: NodaliaUtilsApi = window.NodaliaUtils;

export const isObject = utils.isObject.bind(utils) as NodaliaUtilsApi["isObject"];
export const deepClone = utils.deepClone.bind(utils) as NodaliaUtilsApi["deepClone"];
export const mergeConfig = utils.mergeDeep.bind(utils) as NodaliaUtilsApi["mergeDeep"];
export const escapeHtml = utils.escapeHtml.bind(utils) as NodaliaUtilsApi["escapeHtml"];
export const clamp = utils.clamp.bind(utils) as NodaliaUtilsApi["clamp"];
export const isUnsafeConfigPathKey = utils.isUnsafeConfigPathKey.bind(utils) as NodaliaUtilsApi["isUnsafeConfigPathKey"];
export const getByPath = utils.getByPath.bind(utils) as NodaliaUtilsApi["getByPath"];

const model = window.NodaliaRoomSummaryModel;

export const normalizeEntityField = model.normalizeEntityField;
export const collectHubMediaPlayerIds = model.hubMediaPlayerIds;
export const finiteNumber = model.finiteNumber;
export const isUnavailable = model.isUnavailable;
export const stateIsOn = model.stateIsOn;
export const stateIsOpen = model.stateIsOpen;
export const stateIsUnlocked = model.stateIsUnlocked;
export const formatMetric = model.formatMetric;
export const getState = model.getState;
export const hasNormalizedRoomContent = model.hasRoomContent;
export const buildNormalizedRoomSummary = model.buildRoomSummary;
`,
);

fs.writeFileSync(path.join(outDir, "room-summary-constants.ts"), `${exportConsts(slice(1, 8)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "room-summary-helpers.ts"),
  `// @ts-nocheck -- room entity lists and editor color helpers stay loosely typed until remaining unknowns are narrowed.
import { DEFAULT_CONFIG } from "./room-summary-config";
import {
  clamp,
  deepClone,
  isObject,
  isUnsafeConfigPathKey,
  normalizeEntityField,
} from "./room-summary-runtime";

${exportFunctions(`${slice(164, 182)}\n\n${slice(188, 266)}\n\n${slice(391, 424)}`).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "room-summary-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime room-summary config.
import { COMFORT, CUSTOMIZABLE_EMBED_LISTS, NORMALIZED_ROOM_CONFIG } from "./room-summary-constants";
import {
  buildNormalizedRoomSummary,
  collectHubMediaPlayerIds,
  deepClone,
  hasNormalizedRoomContent,
  isObject,
  mergeConfig,
} from "./room-summary-runtime";
import { entityList, entityScalar } from "./room-summary-helpers";

${slice(10, 135).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(`${slice(184, 186)}\n\n${slice(268, 389)}`).trim()}
`,
);

const cardClass = slice(426, 1967).replace(/^class NodaliaRoomSummaryCard/, "export class NodaliaRoomSummaryCard");
const editorClass = slice(1971, 2677).replace(/^class NodaliaRoomSummaryCardEditor/, "export class NodaliaRoomSummaryCardEditor");

fs.writeFileSync(
  path.join(outDir, "room-summary-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  EDITOR_TAG,
  HUB_PANELS,
} from "./room-summary-constants";
import {
  deepClone,
  escapeHtml,
  finiteNumber,
  formatMetric,
  getState,
  isUnavailable,
  stateIsOn,
  stateIsOpen,
} from "./room-summary-runtime";
import {
  DEFAULT_CONFIG,
  hasRoomContent,
  hubMediaPlayerIds,
  hubSecurityEntityIds,
  hubAlarmEntityIds,
  normalizeConfig,
  STUB_CONFIG,
} from "./room-summary-config";
import {
  fireEvent,
  normalizeTextKey,
} from "./room-summary-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "room-summary-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import { CUSTOMIZABLE_EMBED_LISTS } from "./room-summary-constants";
import {
  deepClone,
  escapeHtml,
  getByPath,
  isObject,
  mergeConfig,
} from "./room-summary-runtime";
import { DEFAULT_CONFIG, normalizeConfig } from "./room-summary-config";
import {
  fireEvent,
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
  moveListItem,
  setByPath,
  stripEqualToDefaults,
} from "./room-summary-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "room-summary-types.ts"),
  `export interface RoomSummaryPublicApi {
  normalizeConfig: (rawConfig?: unknown) => Record<string, unknown>;
  normalizeEntityField: (...args: unknown[]) => unknown;
  hubMediaPlayerIds: (...args: unknown[]) => unknown;
  hubSecurityEntityIds: (...args: unknown[]) => unknown;
  hubAlarmEntityIds: (...args: unknown[]) => unknown;
  buildRoomSummary: (...args: unknown[]) => unknown;
  hasRoomContent: (...args: unknown[]) => unknown;
  formatMetric: (...args: unknown[]) => unknown;
  getState: (...args: unknown[]) => unknown;
}
`,
);

fs.writeFileSync(
  path.join(outDir, "index.ts"),
  `import { CARD_TAG, EDITOR_TAG } from "./room-summary-constants";
import {
  buildRoomSummary,
  hasRoomContent,
  hubAlarmEntityIds,
  hubMediaPlayerIds,
  hubSecurityEntityIds,
  normalizeConfig,
} from "./room-summary-config";
import {
  formatMetric,
  getState,
  normalizeEntityField,
} from "./room-summary-runtime";
import { NodaliaRoomSummaryCard } from "./room-summary-card";
import { NodaliaRoomSummaryCardEditor } from "./room-summary-editor";
import type { RoomSummaryPublicApi } from "./room-summary-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaRoomSummaryCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaRoomSummaryCardEditor);
}

try {
  const lang = window.NodaliaI18n?.resolveLanguage?.(null, "auto") ?? "en";
  const pack = (window.NodaliaI18n?.strings?.(lang) as { roomSummaryCard?: { cardDescription?: string } } | undefined)?.roomSummaryCard
    ?? (window.NodaliaI18n?.strings?.("en") as { roomSummaryCard?: { cardDescription?: string } } | undefined)?.roomSummaryCard
    ?? {};
  window.NodaliaUtils?.registerCustomCard?.({
    type: CARD_TAG,
    name: "Nodalia Room Summary Card",
    description: String(pack.cardDescription || "Room overview for Nodalia dashboards."),
    preview: true,
  });
} catch {
  // Picker registration must never prevent the card custom element from loading.
}

const publicApi = {
  normalizeConfig,
  normalizeEntityField,
  hubMediaPlayerIds,
  hubSecurityEntityIds,
  hubAlarmEntityIds,
  buildRoomSummary,
  hasRoomContent,
  formatMetric,
  getState,
} as RoomSummaryPublicApi;

const globalScope = globalThis as typeof globalThis & {
  __NODALIA_ROOM_SUMMARY__?: RoomSummaryPublicApi;
};

globalScope.__NODALIA_ROOM_SUMMARY__ = publicApi;
window.__NODALIA_ROOM_SUMMARY__ = publicApi;
`,
);

fs.writeFileSync(
  path.join(outDir, "standalone.ts"),
  `import "./index";
`,
);

console.log("Wrote room-summary TypeScript sources to", outDir);
