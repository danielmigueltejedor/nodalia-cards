import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./alarm-panel-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./alarm-panel-config";
import { NodaliaAlarmPanelCard } from "./alarm-panel-card";
import { NodaliaAlarmPanelCardEditor } from "./alarm-panel-editor";
import type { AlarmPanelPublicApi } from "./alarm-panel-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaAlarmPanelCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaAlarmPanelCardEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Alarm Panel Card",
  description: "Tarjeta elegante para paneles de alarma",
  preview: true,
});

const publicApi: AlarmPanelPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_ALARM_PANEL__ = publicApi;
