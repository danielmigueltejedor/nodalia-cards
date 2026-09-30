export interface HumidifierPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: typeof import("./humidifier-config").DEFAULT_CONFIG;
  normalizeConfig: typeof import("./humidifier-config").normalizeConfig;
}
