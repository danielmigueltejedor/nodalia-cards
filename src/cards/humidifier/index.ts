import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./humidifier-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./humidifier-config";
import { loadNodaliaHumidifierCard } from "./humidifier-card";
import { loadNodaliaHumidifierCardEditor } from "./humidifier-editor";
import type { HumidifierPublicApi } from "./humidifier-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaHumidifierCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaHumidifierCardEditor);

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Humidifier Card",
  description: "Tarjeta de humidificador o deshumidificador con control visual de humedad y modos.",
  preview: true,
});

const publicApi: HumidifierPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_HUMIDIFIER__ = publicApi;
