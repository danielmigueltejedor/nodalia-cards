import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./advance-vacuum-constants";
import { DEFAULT_CONFIG, STUB_CONFIG, normalizeConfig } from "./advance-vacuum-config";
import { loadNodaliaAdvanceVacuumCard } from "./advance-vacuum-card";
import { loadNodaliaAdvanceVacuumCardEditor } from "./advance-vacuum-editor";
import type { AdvanceVacuumPublicApi } from "./advance-vacuum-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaAdvanceVacuumCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaAdvanceVacuumCardEditor);

try {
  window.NodaliaUtils?.registerCustomCard?.({
    type: CARD_TAG,
    name: "Nodalia Advance Vacuum Card",
    description: "Advanced map card for vacuum robots in Nodalia style with room, zone, and point selection.",
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
} as AdvanceVacuumPublicApi;

window.__NODALIA_ADVANCE_VACUUM__ = publicApi;
