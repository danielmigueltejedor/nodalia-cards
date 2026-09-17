import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./light-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./light-config";
import { NodaliaLightCard } from "./light-card";
import { NodaliaLightCardEditor } from "./light-editor";
import type { LightPublicApi } from "./light-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaLightCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaLightCardEditor);
}

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
