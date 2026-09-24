import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./scenes-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./scenes-config";
import { loadNodaliaScenesCard } from "./scenes-card";
import { loadNodaliaScenesCardEditor } from "./scenes-editor";
import type { ScenesPublicApi } from "./scenes-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaScenesCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaScenesCardEditor);

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
