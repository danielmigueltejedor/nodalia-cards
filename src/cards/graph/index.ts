import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./graph-constants";
import { DEFAULT_CONFIG, normalizeConfig, normalizeEditorConfig } from "./graph-config";
import { loadNodaliaGraphCard } from "./graph-card";
import { loadNodaliaGraphCardEditor } from "./graph-editor";
import type { GraphPublicApi } from "./graph-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaGraphCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaGraphCardEditor);

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
