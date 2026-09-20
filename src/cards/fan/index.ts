import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./fan-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./fan-config";
import { loadNodaliaFanCard } from "./fan-card";
import { loadNodaliaFanCardEditor } from "./fan-editor";
import type { FanPublicApi } from "./fan-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaFanCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaFanCardEditor);

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
