/**
 * One-shot extractor: splits nodalia-camera-card.js into src/cards/camera/*.ts
 * without rewriting logic. Re-run only when regenerating the camera source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-camera-card.js");
const outDir = path.join(root, "src", "cards", "camera");

if (fs.existsSync(path.join(outDir, "camera-card.ts"))) {
  throw new Error(
    "src/cards/camera already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
const streamModel = window.NodaliaCameraStreamModel;

export const isObject = utils.isObject.bind(utils) as NodaliaUtilsApi["isObject"];
export const deepClone = utils.deepClone.bind(utils) as NodaliaUtilsApi["deepClone"];
export const getByPath = utils.getByPath.bind(utils) as NodaliaUtilsApi["getByPath"];
export const clamp = utils.clamp.bind(utils) as NodaliaUtilsApi["clamp"];
export const escapeHtml = utils.escapeHtml.bind(utils) as NodaliaUtilsApi["escapeHtml"];

export const buildGo2rtcViewerUrl = streamModel.buildGo2rtcViewerUrl.bind(streamModel);
export const sanitizeIframeUrl = streamModel.sanitizeIframeUrl.bind(streamModel);
export const buildGo2rtcWebSocketEndpoint = streamModel.buildGo2rtcWebSocketEndpoint.bind(streamModel);
export const buildFrigateGo2rtcPath = streamModel.buildFrigateGo2rtcPath.bind(streamModel);
export const isMixedContentUrl = streamModel.isMixedContentUrl.bind(streamModel);
`;

fs.writeFileSync(path.join(outDir, "camera-runtime.ts"), `${runtimeHeader}\n`);
fs.writeFileSync(path.join(outDir, "camera-constants.ts"), `${exportConsts(slice(2, 13)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "camera-helpers.ts"),
  `// @ts-nocheck -- camera stream, proxy and config helpers stay loosely typed until remaining unknowns are narrowed.
import {
  HOLD_ACTIONS,
  MAX_CAMERAS,
  STREAM_MODES,
  STREAM_PROVIDERS,
  TAP_ACTIONS,
} from "./camera-constants";
import {
  buildFrigateGo2rtcPath,
  buildGo2rtcWebSocketEndpoint,
  deepClone,
  isMixedContentUrl,
  isObject,
} from "./camera-runtime";
import { DEFAULT_CONFIG } from "./camera-config";

${exportFunctions(slice(109, 594)).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "camera-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime camera config.
import { CAMERA_LAYOUT, CAMERA_PRESENTATION, HOLD_ACTIONS, TAP_ACTIONS } from "./camera-constants";
import { isObject } from "./camera-runtime";
import {
  mergeConfig,
  normalizeCameraActions,
  normalizeCameras,
  normalizeCameraStreams,
  normalizeCameraTapActions,
  normalizeExpandedActions,
  normalizeTextKey,
} from "./camera-helpers";

${slice(15, 88).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG").replace(/^const STUB_CONFIG/m, "export const STUB_CONFIG")}

${exportFunctions(slice(596, 661)).trim()}
`,
);

const cardClass = slice(663, 2543).replace(/^class NodaliaCameraCard/, "export class NodaliaCameraCard");
const editorClass = slice(2550, 3363).replace(/^class NodaliaCameraCardEditor/, "export class NodaliaCameraCardEditor");

fs.writeFileSync(
  path.join(outDir, "camera-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CAMERA_LAYOUT,
  CAMERA_PRESENTATION,
  CARD_TAG,
  EDITOR_TAG,
  MAX_FAILED_IMAGE_URLS,
} from "./camera-constants";
import {
  clamp,
  deepClone,
  escapeHtml,
  isMixedContentUrl,
  sanitizeIframeUrl,
} from "./camera-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./camera-config";
import {
  applyStubEntity,
  fireEvent,
  formatRelativeAge,
  isUnavailableState,
  isUsableCameraAccessToken,
  normalizeCameras,
  parseCameraProxyAuth,
  parseServiceData,
  resolveGo2rtcPlayerSource,
} from "./camera-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "camera-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import { MAX_CAMERAS } from "./camera-constants";
import { escapeHtml, getByPath } from "./camera-runtime";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./camera-config";
import {
  fireEvent,
  mergeConfig,
  setByPath,
  stripEqualToDefaults,
} from "./camera-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "camera-types.ts"),
  `export interface CameraPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  CAMERA_LAYOUT: string;
  CAMERA_PRESENTATION: string;
  MAX_CAMERAS: number;
  normalizeConfig: (rawConfig?: unknown) => Record<string, unknown>;
  normalizeCameras: (config?: unknown) => string[];
  normalizeExpandedActions: (rawActions?: unknown) => unknown[];
  normalizeCameraActions: (rawActions?: unknown, cameraIds?: unknown) => unknown[];
  normalizeCameraTapActions: (rawActions?: unknown, cameraIds?: unknown) => unknown[];
  normalizeCameraStreams: (rawStreams?: unknown, cameraIds?: unknown) => unknown[];
  compactCameraTapActions: (rawActions?: unknown, globalTapConfig?: unknown) => unknown[];
  compactCameraStreams: (rawStreams?: unknown) => unknown[];
  buildGo2rtcViewerUrl: (...args: unknown[]) => string;
  buildGo2rtcWebSocketEndpoint: (...args: unknown[]) => string;
  buildFrigateGo2rtcPath: (...args: unknown[]) => string;
  signHomeAssistantPath: (...args: unknown[]) => Promise<string>;
  resolveGo2rtcPlayerSource: (...args: unknown[]) => Promise<string>;
  isMixedContentUrl: (...args: unknown[]) => boolean;
  parseServiceData: (rawValue?: unknown) => Record<string, unknown>;
  formatRelativeAge: (...args: unknown[]) => string;
  stripEqualToDefaults: (config?: unknown, defaults?: unknown) => Record<string, unknown>;
  isUsableCameraAccessToken: (token?: unknown) => boolean;
  parseCameraProxyAuth: (url?: unknown) => { entityId: string; accessToken: string };
  appendQueryParam: (...args: unknown[]) => string;
}
`,
);

fs.writeFileSync(
  path.join(outDir, "index.ts"),
  `// Side-effect: register nodalia-go2rtc-player for standalone and HACS bundles.
// @ts-expect-error -- existing JS player, bundled by esbuild
import "../../../nodalia-go2rtc-player.js";
import {
  CAMERA_LAYOUT,
  CAMERA_PRESENTATION,
  CARD_TAG,
  CARD_VERSION,
  EDITOR_TAG,
  MAX_CAMERAS,
} from "./camera-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./camera-config";
import {
  appendQueryParam,
  compactCameraStreams,
  compactCameraTapActions,
  formatRelativeAge,
  isUsableCameraAccessToken,
  normalizeCameraActions,
  normalizeCameras,
  normalizeCameraStreams,
  normalizeCameraTapActions,
  normalizeExpandedActions,
  parseCameraProxyAuth,
  parseServiceData,
  resolveGo2rtcPlayerSource,
  signHomeAssistantPath,
  stripEqualToDefaults,
} from "./camera-helpers";
import {
  buildFrigateGo2rtcPath,
  buildGo2rtcViewerUrl,
  buildGo2rtcWebSocketEndpoint,
  isMixedContentUrl,
} from "./camera-runtime";
import { NodaliaCameraCard } from "./camera-card";
import { NodaliaCameraCardEditor } from "./camera-editor";
import type { CameraPublicApi } from "./camera-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCameraCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCameraCardEditor);
}

(function registerNodaliaCameraCardPicker() {
  const hass = window.NodaliaI18n?.resolveHass?.(null);
  const lang = window.NodaliaI18n?.resolveLanguage?.(hass, "auto") ?? "en";
  const pack = (window.NodaliaI18n?.strings?.(lang) as { cameraCard?: { cardDescription?: string } } | undefined)?.cameraCard
    ?? (window.NodaliaI18n?.strings?.("en") as { cameraCard?: { cardDescription?: string } } | undefined)?.cameraCard
    ?? {};
  const description = String(pack.cardDescription || "Nodalia-style camera preview with status chips and expanded view.");
  window.NodaliaUtils.registerCustomCard({
    type: CARD_TAG,
    name: "Nodalia Camera Card",
    description,
    preview: true,
  });
})();

const publicApi: CameraPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  CAMERA_LAYOUT,
  CAMERA_PRESENTATION,
  MAX_CAMERAS,
  normalizeConfig,
  normalizeCameras,
  normalizeExpandedActions,
  normalizeCameraActions,
  normalizeCameraTapActions,
  normalizeCameraStreams,
  compactCameraTapActions,
  compactCameraStreams,
  buildGo2rtcViewerUrl,
  buildGo2rtcWebSocketEndpoint,
  buildFrigateGo2rtcPath,
  signHomeAssistantPath,
  resolveGo2rtcPlayerSource,
  isMixedContentUrl,
  parseServiceData,
  formatRelativeAge,
  stripEqualToDefaults,
  isUsableCameraAccessToken,
  parseCameraProxyAuth,
  appendQueryParam,
};

window.__NODALIA_CAMERA__ = publicApi;
if (typeof globalThis !== "undefined") {
  globalThis.__NODALIA_CAMERA__ = publicApi;
}
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote camera TypeScript sources to", outDir);
