/**
 * One-shot extractor: splits nodalia-navigation-bar.js into src/cards/navigation/*.ts
 * without rewriting logic. Re-run only when regenerating the navigation source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-navigation-bar.js");
const outDir = path.join(root, "src", "cards", "navigation");

if (fs.existsSync(path.join(outDir, "navigation-card.ts"))) {
  throw new Error(
    "src/cards/navigation already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
  path.join(outDir, "navigation-runtime.ts"),
  `import type { NodaliaUtilsApi } from "../../core/types/nodalia-utils";

const utils: NodaliaUtilsApi = window.NodaliaUtils;

export const isObject = utils.isObject.bind(utils) as NodaliaUtilsApi["isObject"];
export const deepClone = utils.deepClone.bind(utils) as NodaliaUtilsApi["deepClone"];
export const mergeConfig = utils.mergeDeep.bind(utils) as NodaliaUtilsApi["mergeDeep"];
export const compactConfig = utils.compactConfig.bind(utils) as NodaliaUtilsApi["compactConfig"];
export const isUnsafeConfigPathKey = utils.isUnsafeConfigPathKey.bind(utils) as NodaliaUtilsApi["isUnsafeConfigPathKey"];
export const fireEvent = utils.fireEvent.bind(utils) as NodaliaUtilsApi["fireEvent"];
export const escapeHtml = utils.escapeHtml.bind(utils) as NodaliaUtilsApi["escapeHtml"];
export const clamp = utils.clamp.bind(utils) as NodaliaUtilsApi["clamp"];
`,
);

fs.writeFileSync(path.join(outDir, "navigation-constants.ts"), `${exportConsts(slice(1, 153)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "navigation-helpers.ts"),
  `// @ts-nocheck -- path, artwork and editor path helpers stay loosely typed until remaining unknowns are narrowed.
import { isObject, isUnsafeConfigPathKey } from "./navigation-runtime";

${exportFunctions(slice(317, 546)).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "navigation-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime navigation config.
import { isObject, mergeConfig } from "./navigation-runtime";

${slice(155, 297).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(slice(548, 567)).trim()}
`,
);

const cardClass = slice(569, 4398).replace(/^class NodaliaNavigationBarCard/, "export class NodaliaNavigationBarCard");
const editorClass = slice(4400, 5900).replace(/^class NodaliaNavigationBarEditor/, "export class NodaliaNavigationBarEditor");

fs.writeFileSync(
  path.join(outDir, "navigation-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CARD_TAG,
  CARD_VERSION,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  MUSIC_ASSISTANT_BROWSER_EXCLUDE_PATTERNS,
  MUSIC_ASSISTANT_DIRECTORY_ICON_RULES,
} from "./navigation-constants";
import {
  clamp,
  deepClone,
  escapeHtml,
  fireEvent,
  isObject,
} from "./navigation-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./navigation-config";
import {
  appendQueryParam,
  escapeSelectorValue,
  formatDuration,
  getRenderSignatureRuntime,
  matchPath,
  normalizePath,
  normalizeTextKey,
  sanitizeCssRuntimeValue,
  sanitizeMediaArtworkUrl,
} from "./navigation-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "navigation-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import {
  compactConfig,
  deepClone,
  escapeHtml,
  fireEvent,
  isObject,
} from "./navigation-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./navigation-config";
import {
  arrayFromCsv,
  deleteByPath,
  escapeSelectorValue,
  moveItem,
  parsePrimitiveValue,
  setByPath,
} from "./navigation-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "navigation-types.ts"),
  `export interface NavigationPublicApi {
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
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./navigation-constants";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./navigation-config";
import { NodaliaNavigationBarCard } from "./navigation-card";
import { NodaliaNavigationBarEditor } from "./navigation-editor";
import type { NavigationPublicApi } from "./navigation-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaNavigationBarCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaNavigationBarEditor);
}

try {
  window.NodaliaUtils?.registerCustomCard?.({
    type: CARD_TAG,
    name: "Nodalia Navigation Bar",
    description: "Barra de navegacion fija y configurable para Home Assistant.",
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
} as NavigationPublicApi;

window.__NODALIA_NAVIGATION__ = publicApi;
`,
);

fs.writeFileSync(
  path.join(outDir, "standalone.ts"),
  `import "./index";
`,
);

console.log("Wrote navigation TypeScript sources to", outDir);
