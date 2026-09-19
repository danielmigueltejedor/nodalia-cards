import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./graph-constants";
import { DEFAULT_CONFIG, normalizeConfig, normalizeEditorConfig } from "./graph-config";
import { NodaliaGraphCard } from "./graph-card";
import { NodaliaGraphCardEditor } from "./graph-editor";
import type { GraphPublicApi } from "./graph-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaGraphCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaGraphCardEditor);
}

try {
  window.NodaliaUtils?.registerCustomCard?.({
    type: CARD_TAG,
    name: "Nodalia Graph Card",
    description: "Tarjeta de grafica elegante para una o varias entidades numericas con estilo Nodalia.",
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
  normalizeEditorConfig,
} as GraphPublicApi;

window.__NODALIA_GRAPH__ = publicApi;
