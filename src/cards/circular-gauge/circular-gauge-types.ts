export interface CircularGaugePublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: typeof import("./circular-gauge-config").normalizeConfig;
}
