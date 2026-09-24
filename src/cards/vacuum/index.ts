import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./vacuum-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./vacuum-config";
import { loadNodaliaVacuumCard } from "./vacuum-card";
import { loadNodaliaVacuumCardEditor } from "./vacuum-editor";
import type { VacuumPublicApi } from "./vacuum-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaVacuumCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaVacuumCardEditor);

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Vacuum Card",
  description: "Vacuum card with the Nodalia look, quick actions, and visual editor.",
  preview: true,
});

const publicApi: VacuumPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_VACUUM__ = publicApi;
