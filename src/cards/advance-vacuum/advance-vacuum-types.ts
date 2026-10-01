export interface AdvanceVacuumPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  STUB_CONFIG: Record<string, unknown>;
  normalizeConfig: typeof import("./advance-vacuum-config").normalizeConfig;
}
