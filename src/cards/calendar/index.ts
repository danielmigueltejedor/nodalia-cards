import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./calendar-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./calendar-config";
import { loadNodaliaCalendarCard } from "./calendar-card";
import { loadNodaliaCalendarCardEditor } from "./calendar-editor";
import type { CalendarPublicApi } from "./calendar-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaCalendarCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaCalendarCardEditor);

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
