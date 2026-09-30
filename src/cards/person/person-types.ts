export interface PersonPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: typeof import("./person-config").DEFAULT_CONFIG;
  normalizeConfig: typeof import("./person-config").normalizeConfig;
}
