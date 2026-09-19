import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./fan-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./fan-config";
import { NodaliaFanCard } from "./fan-card";
import { NodaliaFanCardEditor } from "./fan-editor";
import type { FanPublicApi } from "./fan-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaFanCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaFanCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Fan Card",
  description: "Tarjeta de ventilador con slider de velocidad, oscilacion y modos.",
  preview: true,
});

const publicApi: FanPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_FAN__ = publicApi;
