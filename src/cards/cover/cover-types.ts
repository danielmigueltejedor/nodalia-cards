export interface CoverPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: typeof import("./cover-config").DEFAULT_CONFIG;
  normalizeConfig: typeof import("./cover-config").normalizeConfig;
}
