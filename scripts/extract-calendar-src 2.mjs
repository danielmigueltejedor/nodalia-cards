/**
 * One-shot extractor: splits nodalia-calendar-card.js into src/cards/calendar/*.ts
 * without rewriting logic. Re-run only when regenerating the calendar source split
 * from the previous canonical JS file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "nodalia-calendar-card.js");
const outDir = path.join(root, "src", "cards", "calendar");

if (fs.existsSync(path.join(outDir, "calendar-card.ts"))) {
  throw new Error(
    "src/cards/calendar already exists. This extractor is a one-shot and must not overwrite the TypeScript sources.",
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
  path.join(outDir, "calendar-runtime.ts"),
  `import type { NodaliaUtilsApi } from "../../core/types/nodalia-utils";

const utils: NodaliaUtilsApi = window.NodaliaUtils;

export const isObject = utils.isObject.bind(utils) as NodaliaUtilsApi["isObject"];
export const clamp = utils.clamp.bind(utils) as NodaliaUtilsApi["clamp"];
export const escapeHtml = utils.escapeHtml.bind(utils) as NodaliaUtilsApi["escapeHtml"];
`,
);

fs.writeFileSync(path.join(outDir, "calendar-constants.ts"), `${exportConsts(slice(1, 21)).trim()}\n`);

fs.writeFileSync(
  path.join(outDir, "calendar-helpers.ts"),
  `// @ts-nocheck -- forecast, date and editor color helpers stay loosely typed until remaining unknowns are narrowed.
import {
  DATE_TIME_FORMATTER_CACHE_LIMIT,
  NODALIA_EVENT_METADATA_RE,
  dateTimeFormatterCache,
} from "./calendar-constants";
import { clamp, isObject } from "./calendar-runtime";

${exportFunctions(`${slice(77, 91)}\n\n${slice(102, 250)}\n\n${slice(346, 666)}`).trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "calendar-config.ts"),
  `// @ts-nocheck -- merged Lovelace YAML is projected into the runtime calendar config.
import { HAPTIC_PATTERNS, VALID_TIME_RANGES } from "./calendar-constants";
import { isObject } from "./calendar-runtime";
import {
  daysFromTimeRange,
  mergeConfig,
  normalizeCalendarEntries,
  sanitizeCssRuntimeValue,
} from "./calendar-helpers";

${slice(23, 75).replace(/^const DEFAULT_CONFIG/, "export const DEFAULT_CONFIG")}

${exportFunctions(slice(252, 344)).trim()}
`,
);

const cardClass = slice(668, 4484).replace(/^class NodaliaCalendarCard/, "export class NodaliaCalendarCard");
const editorClass = slice(4486, 5743).replace(
  /^class NodaliaCalendarCardEditor/,
  "export class NodaliaCalendarCardEditor",
);

fs.writeFileSync(
  path.join(outDir, "calendar-card.ts"),
  `// @ts-nocheck
/* Large HTMLElement view/controller: typed incrementally as methods are extracted. */
import {
  CALENDAR_DELETE_RECURRENCE_THIS,
  CALENDAR_DELETE_RECURRENCE_THIS_AND_FUTURE,
  CARD_TAG,
  EDITOR_TAG,
  HAPTIC_PATTERNS,
} from "./calendar-constants";
import { escapeHtml } from "./calendar-runtime";
import { DEFAULT_CONFIG, normalizeConfig } from "./calendar-config";
import {
  appendNodaliaEventMetadata,
  calendarEventKey,
  calendarEventRecurrenceId,
  calendarEventUid,
  dateInputIsBeforeToday,
  daysFromTimeRange,
  deepClone,
  eventDate,
  eventIsAllDay,
  extractNodaliaEventColor,
  forecastDayKey,
  formatDateLabel,
  formatTimeLabel,
  getDateTimeFormatter,
  normalizeCalendarFetchResult,
  normalizeTextKey,
  parseCalendarDateOnlyLocal,
  parseDateInputAsLocalDate,
  pickFirstFiniteNumber,
  sanitizeCalendarTint,
  shouldDarkenCalendarBubbleIconGlyph,
  stripNodaliaEventMetadata,
  supportedWeatherForecastTypes,
  weatherConditionIcon,
  withForecastDateFromKey,
} from "./calendar-helpers";

${cardClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "calendar-editor.ts"),
  `// @ts-nocheck
/* Visual editor surface: typed incrementally after the card runtime split. */
import { escapeHtml } from "./calendar-runtime";
import { DEFAULT_CONFIG, normalizeConfig } from "./calendar-config";
import {
  compactCalendarConfig,
  deepClone,
  formatEditorColorFromHex,
  getEditorColorFallbackValue,
  getEditorColorModel,
  sanitizeCalendarTint,
} from "./calendar-helpers";

${editorClass.trim()}
`,
);

fs.writeFileSync(
  path.join(outDir, "calendar-types.ts"),
  `export interface CalendarPublicApi {
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
  `import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./calendar-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./calendar-config";
import { NodaliaCalendarCard } from "./calendar-card";
import { NodaliaCalendarCardEditor } from "./calendar-editor";
import type { CalendarPublicApi } from "./calendar-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCalendarCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCalendarCardEditor);
}

try {
  const language = window.NodaliaI18n?.resolveLanguage?.(null, "auto") ?? "en";
  const strings = (window.NodaliaI18n?.strings?.(language) as { calendarCard?: { cardDescription?: string } } | undefined)?.calendarCard
    ?? (window.NodaliaI18n?.strings?.("en") as { calendarCard?: { cardDescription?: string } } | undefined)?.calendarCard
    ?? {};
  const meta = {
    type: CARD_TAG,
    name: "Nodalia Calendar Card",
    description: String(strings.cardDescription || "Calendar card with native events and an expanded agenda."),
    preview: true,
  };
  if (typeof window.NodaliaUtils?.registerCustomCard === "function") {
    window.NodaliaUtils.registerCustomCard(meta);
  } else {
    window.customCards = window.customCards || [];
    window.customCards.push(meta);
  }
} catch {
  // Picker registration must never prevent the card custom element from loading.
}

const publicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
} as CalendarPublicApi;

window.__NODALIA_CALENDAR__ = publicApi;
`,
);

fs.writeFileSync(path.join(outDir, "standalone.ts"), `import "./index";\n`);

console.log("Wrote calendar TypeScript sources to", outDir);
