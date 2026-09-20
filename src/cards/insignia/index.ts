import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./insignia-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./insignia-config";
import { loadNodaliaInsigniaCard } from "./insignia-card";
import { loadNodaliaInsigniaCardEditor } from "./insignia-editor";
import type { InsigniaPublicApi } from "./insignia-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaInsigniaCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaInsigniaCardEditor);

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
