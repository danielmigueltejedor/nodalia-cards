import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./navigation-constants";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./navigation-config";
import { loadNodaliaNavigationBarCard } from "./navigation-card";
import { loadNodaliaNavigationBarEditor } from "./navigation-editor";
import type { NavigationPublicApi } from "./navigation-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaNavigationBarCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaNavigationBarEditor);

try {
  window.NodaliaUtils?.registerCustomCard?.({
    type: CARD_TAG,
    name: "Nodalia Navigation Bar",
    description: "Barra de navegacion fija y configurable para Home Assistant.",
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
  STUB_CONFIG,
  normalizeConfig,
} as NavigationPublicApi;

window.__NODALIA_NAVIGATION__ = publicApi;
