import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./cover-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./cover-config";
import { NodaliaCoverCard } from "./cover-card";
import { NodaliaCoverCardEditor } from "./cover-editor";
import type { CoverPublicApi } from "./cover-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCoverCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCoverCardEditor);
}

(function registerNodaliaCoverCardPicker() {
  const hass = window.NodaliaI18n?.resolveHass?.(null);
  const lang = window.NodaliaI18n?.resolveLanguage?.(hass, "auto") ?? "en";
  const pack = (window.NodaliaI18n?.strings?.(lang) as { coverCard?: { cardDescription?: string } } | undefined)?.coverCard
    ?? (window.NodaliaI18n?.strings?.("en") as { coverCard?: { cardDescription?: string } } | undefined)?.coverCard;
  const description = String(pack?.cardDescription || "Fan-style controls for Home Assistant cover entities.");
  window.NodaliaUtils.registerCustomCard({
    type: CARD_TAG,
    name: "Nodalia Cover Card",
    description,
    preview: true,
  });
})();

const publicApi: CoverPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_COVER__ = publicApi;
