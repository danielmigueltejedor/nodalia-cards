import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./alarm-panel-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./alarm-panel-config";
import { loadNodaliaAlarmPanelCard } from "./alarm-panel-card";
import { loadNodaliaAlarmPanelCardEditor } from "./alarm-panel-editor";
import type { AlarmPanelPublicApi } from "./alarm-panel-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaAlarmPanelCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaAlarmPanelCardEditor);

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
