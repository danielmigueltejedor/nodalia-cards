/**
 * One-shot extractor: splits nodalia-notifications-card.js into src/cards/notifications/*.ts
 * without rewriting logic. Re-run only when regenerating the notifications source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-notifications-card.js");
const outDir = path.join(root, "src", "cards", "notifications");

if (fs.existsSync(path.join(outDir, "notifications-card.ts"))) {
  throw new Error(
    "src/cards/notifications already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
  path.join(outDir, "notifications-runtime.ts"),
  `import type { NodaliaUtilsApi } from "../../core/types/nodalia-utils";

const utils: NodaliaUtilsApi = window.NodaliaUtils;

export const deepClone = utils.deepClone.bind(utils) as NodaliaUtilsApi["deepClone"];
export const isObject = utils.isObject.bind(utils) as NodaliaUtilsApi["isObject"];
export const clamp = utils.clamp.bind(utils) as NodaliaUtilsApi["clamp"];
export const isUnsafeConfigPathKey = utils.isUnsafeConfigPathKey.bind(utils) as NodaliaUtilsApi["isUnsafeConfigPathKey"];

const mobile = window.NodaliaNotificationsMobilePolicy;

export const BACKGROUND_MOBILE_MAX_CHUNKS = mobile.BACKGROUND_MOBILE_MAX_CHUNKS;
export const MOBILE_COOLDOWN_STORAGE_KEY = mobile.MOBILE_COOLDOWN_STORAGE_KEY;
export const MOBILE_DELIVERY_STATES = mobile.MOBILE_DELIVERY_STATES;
export const normalizeMobilePolicy = mobile.normalizeMobilePolicy.bind(mobile);
export const resolveSmartEntityMobilePolicy = mobile.resolveSmartEntityMobilePolicy.bind(mobile);
export const backgroundMobilePayloadOverLimit = mobile.backgroundMobilePayloadOverLimit.bind(mobile);
export const normalizeSmartEntityMobile = mobile.normalizeSmartEntityMobile.bind(mobile);
export const normalizeSmartEntityOverrideMobile = mobile.normalizeSmartEntityOverrideMobile.bind(mobile);
export const isExplicitSmartEntityMobile = mobile.isExplicitSmartEntityMobile.bind(mobile);
export const isWithinQuietHours = mobile.isWithinQuietHours.bind(mobile);
export const getNextQuietHoursBoundaryDelay = mobile.getNextQuietHoursBoundaryDelay.bind(mobile);
export const normalizeQuietHours = mobile.normalizeQuietHours.bind(mobile);
export const normalizeMobileContext = mobile.normalizeMobileContext.bind(mobile);
export const resolvePresenceOccupancy = mobile.resolvePresenceOccupancy.bind(mobile);
export const passesPresenceContext = mobile.passesPresenceContext.bind(mobile);
export const buildMobileAlertIdentity = mobile.buildMobileAlertIdentity.bind(mobile);
export const buildMobileGroupIdentity = mobile.buildMobileGroupIdentity.bind(mobile);
export const resolveMobileDeliveryState = mobile.resolveMobileDeliveryState.bind(mobile);
export const legacyMobilePolicyLabel = mobile.legacyMobilePolicyLabel.bind(mobile);
`,
);

fs.writeFileSync(path.join(outDir, "notifications-constants.ts"), `${exportConsts(slice(1, 15)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "notifications-helpers.ts"),
  `// @ts-nocheck -- notification template, forecast and editor color helpers stay loosely typed until remaining unknowns are narrowed.
import { STORAGE_KEY } from "./notifications-constants";
import {
  BACKGROUND_MOBILE_MAX_CHUNKS,
  clamp,
  deepClone,
  isExplicitSmartEntityMobile,
  isObject,
  isUnsafeConfigPathKey,
  isWithinQuietHours,
  normalizeMobileContext,
  normalizeMobilePolicy,
  normalizeQuietHours,
  normalizeSmartEntityMobile,
  normalizeSmartEntityOverrideMobile,
} from "./notifications-runtime";

${exportFunctions(`${slice(148, 323)}\n\n${slice(357, 475)}\n\n${slice(577, 1370)}`).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "notifications-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime notifications config.
import { STORAGE_KEY } from "./notifications-constants";
import { normalizeMobileContext, normalizeMobilePolicy } from "./notifications-runtime";
import {
  entityDomain,
  finiteNumber,
  mergeDeep,
  normalizeCustomNotifications,
  normalizeEntityList,
  normalizeExternalAlerts,
  normalizeNotifyServices,
  normalizeSmartEntityOverrides,
  normalizeSmartNotifications,
} from "./notifications-helpers";

${slice(17, 136).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG")}

${exportFunctions(slice(477, 575)).trim()}
`,
);

const cardClass = slice(1372, 4587).replace(
  /^class NodaliaNotificationsCard/,
  "export class NodaliaNotificationsCard",
);
const editorClass = slice(4622, 6403).replace(
  /^class NodaliaNotificationsCardEditor/,
  "export class NodaliaNotificationsCardEditor",
);

fs.writeFileSync(
  path.join(outDir, "notifications-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  BACKGROUND_MOBILE_NATIVE_HEALTH_TTL_MS,
  CARD_TAG,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
  LEGACY_BACKGROUND_MOBILE_TOGGLE,
  STORAGE_KEY,
} from "./notifications-constants";
import {
  BACKGROUND_MOBILE_MAX_CHUNKS,
  MOBILE_COOLDOWN_STORAGE_KEY,
  backgroundMobilePayloadOverLimit,
  buildMobileAlertIdentity,
  buildMobileGroupIdentity,
  getNextQuietHoursBoundaryDelay,
  isWithinQuietHours,
  normalizeMobilePolicy,
  resolveMobileDeliveryState,
  resolvePresenceOccupancy,
  resolveSmartEntityMobilePolicy,
} from "./notifications-runtime";
import { DEFAULT_CONFIG, normalizeConfig } from "./notifications-config";
import {
  buildBackgroundMobileWebhookPayload,
  calendarEventDate,
  compactConfig,
  customNotificationTemplateValues,
  escapeHtml,
  escapeSelectorValue,
  fireEvent,
  forecastDate,
  forecastLooksRainy,
  forecastNumber,
  formatNotificationTemplate,
  formatNumber,
  formatTime,
  friendlyName,
  getBackgroundMobileConfigPayload,
  getBackgroundMobileNativeSignature,
  getByPath,
  hasNotificationTapAction,
  isSameLocalDay,
  matchTextIncludes,
  minutesSinceChanged,
  normalizeCalendarFetchResult,
  normalizeEntityList,
  normalizeMatchText,
  normalizeSeverity,
  normalizeWeatherForecastResult,
  notificationHash,
  numericState,
  parseServiceData,
  referencedNotificationTemplateEntities,
  sanitizeCssRuntimeValue,
  shouldDarkenNotificationIconGlyph,
  stateIsOff,
  stateIsOn,
  stateIsVacant,
  stateLooksActive,
  stateValue,
} from "./notifications-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "notifications-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import { HAPTIC_PATTERNS } from "./notifications-constants";
import {
  BACKGROUND_MOBILE_MAX_CHUNKS,
  backgroundMobilePayloadOverLimit,
  normalizeMobilePolicy,
  normalizeSmartEntityMobile,
} from "./notifications-runtime";
import { DEFAULT_CONFIG, normalizeConfig } from "./notifications-config";
import {
  compactConfig,
  deleteByPath,
  escapeHtml,
  fireEvent,
  formatEditorColorFromHex,
  getByPath,
  getEditorColorFallbackValue,
  getEditorColorModel,
  getBackgroundMobileConfigPayload,
  setByPath,
} from "./notifications-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "notifications-types.ts"),
  `export interface NotificationsPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: (rawConfig?: unknown, options?: { keepDrafts?: boolean }) => Record<string, unknown>;
}
`,
);

fs.writeFileSync(
  path.join(outDir, "index.ts"),
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./notifications-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./notifications-config";
import { NodaliaNotificationsCard } from "./notifications-card";
import { NodaliaNotificationsCardEditor } from "./notifications-editor";
import {
  buildBackgroundMobileWebhookPayload,
  customNotificationTemplateValues,
  formatNotificationTemplate,
  getBackgroundMobileConfigPayload,
  normalizeExternalAlerts,
  referencedNotificationTemplateEntities,
} from "./notifications-helpers";
import {
  BACKGROUND_MOBILE_MAX_CHUNKS,
  MOBILE_DELIVERY_STATES,
  backgroundMobilePayloadOverLimit,
  buildMobileAlertIdentity,
  buildMobileGroupIdentity,
  getNextQuietHoursBoundaryDelay,
  isExplicitSmartEntityMobile,
  isWithinQuietHours,
  normalizeMobileContext,
  normalizeMobilePolicy,
  normalizeQuietHours,
  passesPresenceContext,
  resolvePresenceOccupancy,
  resolveMobileDeliveryState,
  resolveSmartEntityMobilePolicy,
} from "./notifications-runtime";
import type { NotificationsPublicApi } from "./notifications-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaNotificationsCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaNotificationsCardEditor);
}

try {
  window.NodaliaUtils?.registerCustomCard?.({
    type: CARD_TAG,
    name: "Nodalia Notifications Card",
    description: "Centro inteligente de notificaciones, recomendaciones y acciones.",
    preview: true,
  });
} catch {
  // Picker registration must never prevent the card custom element from loading.
}

const templatesApi = {
  customNotificationTemplateValues,
  formatNotificationTemplate,
  referencedNotificationTemplateEntities,
};

const mobileApi = {
  MOBILE_DELIVERY_STATES,
  normalizeMobilePolicy,
  normalizeMobileContext,
  normalizeExternalAlerts,
  normalizeQuietHours,
  isWithinQuietHours,
  resolvePresenceOccupancy,
  passesPresenceContext,
  buildMobileAlertIdentity,
  buildMobileGroupIdentity,
  resolveMobileDeliveryState,
  getBackgroundMobileConfigPayload,
  buildBackgroundMobileWebhookPayload,
  backgroundMobilePayloadOverLimit,
  getNextQuietHoursBoundaryDelay,
  BACKGROUND_MOBILE_MAX_CHUNKS,
  resolveSmartEntityMobilePolicy,
  isExplicitSmartEntityMobile,
  pushExternalAlerts: NodaliaNotificationsCard.pushExternalAlerts,
};

const publicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
} as NotificationsPublicApi;

const globalScope = globalThis as typeof globalThis & {
  __NODALIA_NOTIFICATIONS_TEMPLATES__?: typeof templatesApi;
  __NODALIA_NOTIFICATIONS_MOBILE__?: typeof mobileApi;
  __NODALIA_NOTIFICATIONS__?: NotificationsPublicApi;
};

globalScope.__NODALIA_NOTIFICATIONS_TEMPLATES__ = templatesApi;
globalScope.__NODALIA_NOTIFICATIONS_MOBILE__ = mobileApi;
globalScope.__NODALIA_NOTIFICATIONS__ = publicApi;
window.__NODALIA_NOTIFICATIONS_TEMPLATES__ = templatesApi;
window.__NODALIA_NOTIFICATIONS_MOBILE__ = mobileApi;
window.__NODALIA_NOTIFICATIONS__ = publicApi;
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote notifications TypeScript sources to", outDir);
