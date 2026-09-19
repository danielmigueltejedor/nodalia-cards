import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./circular-gauge-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./circular-gauge-config";
import { NodaliaCircularGaugeCard } from "./circular-gauge-card";
import { NodaliaCircularGaugeCardEditor } from "./circular-gauge-editor";
import type { CircularGaugePublicApi } from "./circular-gauge-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCircularGaugeCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCircularGaugeCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Circular Gauge Card",
  description: "Tarjeta circular para sensores y valores numericos con estetica Nodalia.",
  preview: true,
});

const publicApi: CircularGaugePublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_CIRCULAR_GAUGE__ = publicApi;
