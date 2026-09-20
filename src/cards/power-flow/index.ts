import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./power-flow-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./power-flow-config";
import { loadNodaliaPowerFlowCard } from "./power-flow-card";
import { loadNodaliaPowerFlowCardVisualEditor } from "./power-flow-editor";
import type { PowerFlowPublicApi } from "./power-flow-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaPowerFlowCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaPowerFlowCardVisualEditor);

try {
  window.NodaliaUtils?.registerCustomCard?.({
    type: CARD_TAG,
    name: "Nodalia Power Flow Card",
    description: "Tarjeta Nodalia de flujo energetico para red, solar, bateria, agua, gas y consumos individuales.",
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
} as PowerFlowPublicApi;

window.__NODALIA_POWER_FLOW__ = publicApi;
