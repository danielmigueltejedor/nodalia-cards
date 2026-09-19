import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./fav-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./fav-config";
import { NodaliaFavCard } from "./fav-card";
import { NodaliaFavCardEditor } from "./fav-editor";
import type { FavPublicApi } from "./fav-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaFavCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaFavCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Fav Card",
  description: "Tarjeta mini y elegante para favoritos y controles rapidos en movil.",
  preview: true,
});

const publicApi: FavPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_FAV__ = publicApi;
