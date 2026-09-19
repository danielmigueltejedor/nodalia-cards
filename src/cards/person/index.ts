import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./person-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./person-config";
import { NodaliaPersonCard } from "./person-card";
import { NodaliaPersonCardEditor } from "./person-editor";
import type { PersonPublicApi } from "./person-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaPersonCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaPersonCardEditor);
}

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
