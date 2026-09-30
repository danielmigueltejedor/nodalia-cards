export interface AlarmPanelPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: typeof import("./alarm-panel-config").DEFAULT_CONFIG;
  normalizeConfig: typeof import("./alarm-panel-config").normalizeConfig;
}
