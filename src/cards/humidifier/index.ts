import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./humidifier-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./humidifier-config";
import { NodaliaHumidifierCard } from "./humidifier-card";
import { NodaliaHumidifierCardEditor } from "./humidifier-editor";
import type { HumidifierPublicApi } from "./humidifier-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaHumidifierCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaHumidifierCardEditor);
}

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
