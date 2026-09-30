export interface LightPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: typeof import("./light-config").DEFAULT_CONFIG;
  normalizeConfig: typeof import("./light-config").normalizeConfig;
}
