export interface FanPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: typeof import("./fan-config").DEFAULT_CONFIG;
  normalizeConfig: typeof import("./fan-config").normalizeConfig;
}
