import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./vacuum-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./vacuum-config";
import { NodaliaVacuumCard } from "./vacuum-card";
import { NodaliaVacuumCardEditor } from "./vacuum-editor";
import type { VacuumPublicApi } from "./vacuum-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaVacuumCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaVacuumCardEditor);
}

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
