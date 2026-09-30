export interface VacuumPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: typeof import("./vacuum-config").DEFAULT_CONFIG;
  normalizeConfig: typeof import("./vacuum-config").normalizeConfig;
}
