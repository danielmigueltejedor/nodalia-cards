import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./person-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./person-config";
import { loadNodaliaPersonCard } from "./person-card";
import { loadNodaliaPersonCardEditor } from "./person-editor";
import type { PersonPublicApi } from "./person-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaPersonCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaPersonCardEditor);

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Person Card",
  description: "Tarjeta compacta de persona con foto y zona",
  preview: true,
});

const publicApi: PersonPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_PERSON__ = publicApi;
