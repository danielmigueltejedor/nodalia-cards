/**
 * One-shot extractor: splits nodalia-insignia-card.js into src/cards/insignia/*.ts
 * without rewriting logic. Re-run only when regenerating the insignia source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-insignia-card.js");
const outDir = path.join(root, "src", "cards", "insignia");

if (fs.existsSync(path.join(outDir, "insignia-card.ts"))) {
  throw new Error(
    "src/cards/insignia already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
export const isUnsafeConfigPathKey = utils.isUnsafeConfigPathKey.bind(utils) as NodaliaUtilsApi["isUnsafeConfigPathKey"];
export const normalizeTextKey = utils.normalizeTextKey.bind(utils) as NodaliaUtilsApi["normalizeTextKey"];
export const escapeHtml = utils.escapeHtml.bind(utils) as NodaliaUtilsApi["escapeHtml"];
export const escapeSelectorValue = utils.escapeSelectorValue.bind(utils) as NodaliaUtilsApi["escapeSelectorValue"];
export const fireEvent = utils.fireEvent.bind(utils) as NodaliaUtilsApi["fireEvent"];
`;

fs.writeFileSync(path.join(outDir, "insignia-runtime.ts"), `${runtimeHeader}\n`);
fs.writeFileSync(path.join(outDir, "insignia-constants.ts"), `${exportConsts(slice(1, 12)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "insignia-helpers.ts"),
  `// @ts-nocheck -- color, icon and path helpers stay loosely typed until remaining unknowns are narrowed.
import { isObject, isUnsafeConfigPathKey, normalizeTextKey } from "./insignia-runtime";
import { DEFAULT_CONFIG } from "./insignia-config";

${exportFunctions(slice(92, 433)).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "insignia-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime insignia config.
import { mergeConfig } from "./insignia-runtime";
import { getTintPresetColor, normalizeTintPreset } from "./insignia-helpers";

${slice(14, 76).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(slice(435, 454)).trim()}
`,
);

const cardClass = slice(456, 1326).replace(/^class NodaliaInsigniaCard/, "export class NodaliaInsigniaCard");
const editorClass = slice(1328, 2234).replace(/^class NodaliaInsigniaCardEditor/, "export class NodaliaInsigniaCardEditor");

fs.writeFileSync(
  path.join(outDir, "insignia-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import { CARD_TAG, EDITOR_TAG, HAPTIC_PATTERNS } from "./insignia-constants";
import {
  deepClone,
  escapeHtml,
  fireEvent,
  isObject,
  mergeConfig,
  normalizeTextKey,
} from "./insignia-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./insignia-config";
import {
  applyStubEntity,
  formatNumericString,
  getDynamicEntityIcon,
  getEntityDomain,
  getSafeStyles,
  isUnavailableState,
  parseSizeToPixels,
  sanitizeCssValue,
} from "./insignia-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "insignia-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import {
  escapeHtml,
  fireEvent,
  isObject,
  mergeConfig,
} from "./insignia-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./insignia-config";
import {
  compactConfig,
  deleteByPath,
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
  setByPath,
} from "./insignia-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "insignia-types.ts"),
  `export interface InsigniaPublicApi {
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
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./insignia-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./insignia-config";
import { NodaliaInsigniaCard } from "./insignia-card";
import { NodaliaInsigniaCardEditor } from "./insignia-editor";
import type { InsigniaPublicApi } from "./insignia-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaInsigniaCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaInsigniaCardEditor);
}

if (Array.isArray(window.customCards)) {
  for (let index = window.customCards.length - 1; index >= 0; index -= 1) {
    if (window.customCards[index]?.type === CARD_TAG) {
      window.customCards.splice(index, 1);
    }
  }
}

window.customBadges = window.customBadges || [];
if (!window.customBadges.some(item => item?.type === CARD_TAG)) {
  const language = window.NodaliaI18n?.resolveLanguage?.(null, "auto") ?? "en";
  const catalog = window.NodaliaI18n?.strings?.(language) as { insigniaCard?: { cardDescription?: string } } | undefined;
  const fallback = window.NodaliaI18n?.strings?.("en") as { insigniaCard?: { cardDescription?: string } } | undefined;
  const strings = catalog?.insigniaCard ?? fallback?.insigniaCard ?? {};
  window.customBadges.push({
    type: CARD_TAG,
    name: "Nodalia Insignia",
    preview: true,
    description: String(strings.cardDescription || "Compact bubble-style badge for Nodalia dashboards."),
    documentationURL: "https://developers.home-assistant.io/docs/frontend/custom-ui/custom-badge/",
  });
}

const publicApi: InsigniaPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_INSIGNIA__ = publicApi;
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote insignia TypeScript sources to", outDir);
