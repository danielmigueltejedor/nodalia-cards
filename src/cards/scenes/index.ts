import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./scenes-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./scenes-config";
import { NodaliaScenesCard } from "./scenes-card";
import { NodaliaScenesCardEditor } from "./scenes-editor";
import type { ScenesPublicApi } from "./scenes-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaScenesCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaScenesCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Scenes Card",
  description: "Cinematic Home Assistant scene moods with per-scene tints and launch feedback",
  preview: true,
  documentationURL: "https://github.com/danielmigueltejedor/nodalia-cards",
});

const publicApi: ScenesPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_SCENES__ = publicApi;
