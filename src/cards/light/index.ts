import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./light-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./light-config";
import { loadNodaliaLightCard } from "./light-card";
import { loadNodaliaLightCardEditor } from "./light-editor";
import type { LightPublicApi } from "./light-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaLightCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaLightCardEditor);

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Light Card",
  description: "Tarjeta de luz con estilo Nodalia, presets y editor visual.",
  preview: true,
});

const publicApi: LightPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_LIGHT__ = publicApi;
