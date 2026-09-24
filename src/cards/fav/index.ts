import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./fav-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./fav-config";
import { loadNodaliaFavCard } from "./fav-card";
import { loadNodaliaFavCardEditor } from "./fav-editor";
import type { FavPublicApi } from "./fav-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaFavCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaFavCardEditor);

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
