import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./weather-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./weather-config";
import { NodaliaWeatherCard } from "./weather-card";
import { NodaliaWeatherCardEditor } from "./weather-editor";
import type { WeatherPublicApi } from "./weather-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaWeatherCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaWeatherCardEditor);
}

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

