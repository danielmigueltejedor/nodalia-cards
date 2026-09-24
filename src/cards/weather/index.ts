import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./weather-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./weather-config";
import { loadNodaliaWeatherCard } from "./weather-card";
import { loadNodaliaWeatherCardEditor } from "./weather-editor";
import type { WeatherPublicApi } from "./weather-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaWeatherCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaWeatherCardEditor);

try {
  window.NodaliaUtils?.registerCustomCard?.({
    type: CARD_TAG,
    name: "Nodalia Weather Card",
    description: "Tarjeta de tiempo elegante para Home Assistant",
    preview: true,
  });
} catch {
  // Picker registration must never prevent the card custom element from loading.
}

const publicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
} as WeatherPublicApi;

window.__NODALIA_WEATHER__ = publicApi;

