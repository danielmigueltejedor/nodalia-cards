import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./climate-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./climate-config";
import { NodaliaClimateCard } from "./climate-card";
import { NodaliaClimateCardEditor } from "./climate-editor";
import {
  decodeSetpointScheduleStorageState,
  encodeSetpointScheduleStorageState,
  isSetpointScheduleStorageStateWithinLimit,
  parseScheduleClockMinutes,
} from "./climate-schedule";
import type { ClimatePublicApi } from "./climate-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaClimateCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaClimateCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Climate Card",
  description: "Tarjeta de clima con dial circular, modos HVAC y control rapido de temperatura.",
  preview: true,
});

const publicApi: ClimatePublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
  parseScheduleClockMinutes,
  encodeSetpointScheduleStorageState,
  decodeSetpointScheduleStorageState,
  isSetpointScheduleStorageStateWithinLimit,
};

window.__NODALIA_CLIMATE__ = publicApi;
